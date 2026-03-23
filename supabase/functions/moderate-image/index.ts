console.log("FUNCTION FILE LOADED")
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const config = {
  auth: false,
};

type Input = {
  path: string;
  type: "sunrise" | "avatar";
  logId?: number | string;
};

type Likelihood =
  | "UNKNOWN"
  | "VERY_UNLIKELY"
  | "UNLIKELY"
  | "POSSIBLE"
  | "LIKELY"
  | "VERY_LIKELY";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function base64FromBytes(bytes: Uint8Array): string {
  // Chunk to avoid call stack / arg length issues.
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function isHigh(l: Likelihood | undefined): boolean {
  return l === "LIKELY" || l === "VERY_LIKELY";
}

function sanitizePath(p: string): string | null {
  if (!p) return null;
  const trimmed = p.replace(/^\/+/, "");
  if (trimmed.includes("..")) return null;
  return trimmed;
}

serve(async (req) => {
  try {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: "Missing Supabase environment variables" });
  }
  if (!GOOGLE_VISION_API_KEY) {
    return json(500, { error: "Missing GOOGLE_VISION_API_KEY" });
  }

  // TEMPORARILY DISABLED AUTH CHECK (pipeline validation)
  // We intentionally do not read/validate Authorization header right now.

  let input: Input;
  try {
    input = (await req.json()) as Input;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const path = sanitizePath(input?.path ?? "");
  if (!path) return json(400, { error: "Invalid path" });
  if (input?.type !== "sunrise" && input?.type !== "avatar") {
    return json(400, { error: "Invalid type" });
  }
  const logId =
    typeof input?.logId === "number"
      ? input.logId
      : typeof input?.logId === "string"
        ? Number.parseInt(input.logId, 10)
        : undefined;

  if (input.type === "sunrise" && (!Number.isFinite(logId) || (logId ?? 0) <= 0)) {
    console.log("BAD REQUEST: invalid logId", { provided: input?.logId ?? null });
    return json(400, { error: "Invalid or missing logId for sunrise moderation" });
  }

  // Use staged path as source of user partition for storage paths.
  const ownerIdFromPath = path.split("/")[0] ?? "";
  if (!ownerIdFromPath) return json(400, { error: "Invalid path owner prefix" });

  console.log("PATH:", path);
  console.log("PATH OWNER:", ownerIdFromPath);
  console.log("LOG ID:", logId ?? null);

  // Service role client for Storage + DB writes.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // For sunrise: fetch DB row and use DB user_id as source of truth.
  let sunriseOwnerId: string | null = null;
  if (input.type === "sunrise" && logId != null) {
    const { data: existing, error: selErr } = await admin
      .from("sunrise_logs")
      .select("id, user_id")
      .eq("id", logId as number)
      .maybeSingle();
    if (selErr) {
      return json(500, { error: "Failed to read sunrise log", detail: selErr.message });
    }
    if (!existing) {
      return json(404, { error: "Sunrise log not found", id: logId });
    }
    sunriseOwnerId = String(existing.user_id ?? "").trim() || null;
    if (!sunriseOwnerId) {
      return json(500, { error: "Sunrise log user_id missing", id: logId });
    }
  }

  // Download from private staging bucket.
  const { data: blob, error: dlErr } = await admin.storage
    .from("uploads_pending")
    .download(path);

  if (dlErr || !blob) {
    console.log("DOWNLOAD ERROR:", dlErr?.message ?? dlErr ?? null);
    return json(400, { error: "Unable to download staged image" });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length === 0) {
    // Clean up obviously broken uploads.
    await admin.storage.from("uploads_pending").remove([path]);
    return json(400, { error: "Empty image upload" });
  }

  // Google Vision SafeSearch.
  const visionReq = {
    requests: [
      {
        image: { content: base64FromBytes(bytes) },
        features: [{ type: "SAFE_SEARCH_DETECTION" }],
      },
    ],
  };

  const visionResp = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(GOOGLE_VISION_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(visionReq),
    },
  );

  if (!visionResp.ok) {
    let details = "";
    try {
      details = await visionResp.text();
    } catch {
      details = "";
    }
    console.log("VISION API ERROR:", { status: visionResp.status, details: details.slice(0, 500) });
    return json(502, { error: "Vision API error" });
  }

  let visionJson: any;
  try {
    visionJson = await visionResp.json();
  } catch {
    return json(502, { error: "Vision API invalid response" });
  }

  const ann = visionJson?.responses?.[0]?.safeSearchAnnotation as
    | { adult?: Likelihood; racy?: Likelihood; violence?: Likelihood }
    | undefined;

  const reject = isHigh(ann?.adult) || isHigh(ann?.racy) || isHigh(ann?.violence);

  if (reject) {
    // Reject: update DB first (must succeed), then delete staging — same rule as approve.
    if (input.type === "sunrise") {
      const { data: rejectedRows, error: rejErr } = await admin
        .from("sunrise_logs")
        .update({ moderation_status: "rejected", photo_url: null })
        .eq("id", logId as number)
        .select("id");
      console.log("DB REJECT UPDATE:", { rejErr, rows: rejectedRows?.length ?? 0 });
      if (rejErr) {
        return json(500, { error: "Failed to update log after rejection", detail: rejErr.message });
      }
      if (!rejectedRows?.length) {
        return json(500, { error: "No sunrise_logs row updated on reject", id: logId });
      }
    }
    await admin.storage.from("uploads_pending").remove([path]);
    return json(200, { status: "rejected" as const });
  }

  // Approved: upload to public bucket → update DB → then delete staging (so DB failure leaves staged file for retry).
  const uuid = crypto.randomUUID();
  const destBucket = input.type === "sunrise" ? "sunrise_photos" : "avatars";
  const destUserId = input.type === "sunrise" ? (sunriseOwnerId as string) : ownerIdFromPath;
  const destPath = `${destUserId}/${uuid}.jpg`;

  const { error: upErr } = await admin.storage.from(destBucket).upload(destPath, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (upErr) {
    return json(500, { error: "Unable to publish approved image" });
  }

  const publicUrl = admin.storage.from(destBucket).getPublicUrl(destPath).data.publicUrl;
  console.log("PUBLIC URL:", publicUrl);

  // DB must succeed before we delete staging. If DB fails after public upload, roll back public object.
  try {
    if (input.type === "avatar") {
      const { data: profileRows, error: profileErr } = await admin
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", ownerIdFromPath)
        .select("user_id");
      if (profileErr) {
        console.error("❌ PROFILE UPDATE FAILED", { userId: ownerIdFromPath, detail: profileErr.message });
        throw new Error("DB update failed - aborting");
      }
      if (!profileRows?.length) {
        console.error("❌ PROFILE UPDATE matched 0 rows", { userId: ownerIdFromPath });
        throw new Error("DB update failed - aborting");
      }
    } else {
      console.log("Updating row:", { logId, userId: sunriseOwnerId });
      const { data, error: updateErr } = await admin
        .from("sunrise_logs")
        .update({
          moderation_status: "approved",
          photo_url: publicUrl,
        })
        .eq("id", logId as number)
        .select("id");

      if (updateErr || !data || data.length === 0) {
        console.error("❌ UPDATE FAILED", { logId, userId });
        throw new Error("DB update failed - aborting");
      }
    }
  } catch (dbErr) {
    const { error: rollbackErr } = await admin.storage.from(destBucket).remove([destPath]);
    if (rollbackErr) {
      console.error("ROLLBACK public upload failed (orphan may remain)", { destPath, detail: rollbackErr.message });
    }
    throw dbErr;
  }

  await admin.storage.from("uploads_pending").remove([path]);

  return json(200, { status: "approved" as const, publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("moderate-image error:", e);

    return new Response(
      JSON.stringify({
        error: msg,
        stack: e instanceof Error ? e.stack : null,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
});

