/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

type Input = {
  path: string;
  type: "sunrise" | "avatar";
  logId?: number | string;
  userId?: string;
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

  const userIdRaw = input?.userId ?? "";
  const userId = sanitizePath(String(userIdRaw));
  if (!userId) {
    return json(400, { error: "Invalid userId" });
  }
  if (userId.includes("/")) {
    return json(400, { error: "Invalid userId format" });
  }

  // Ownership check: staged path must be under "<userId>/..."
  if (!path.startsWith(`${userId}/`)) {
    return json(403, { error: "Not allowed for this path" });
  }

  console.log("PATH:", path);
  console.log("USER ID:", userId);
  console.log("LOG ID:", logId ?? null);

  // Service role client for Storage + DB writes.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

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
    await admin.storage.from("uploads_pending").remove([path]);
    return json(200, { status: "rejected" as const });
  }

  // Approved: upload to public bucket with UUID-based name, then delete staging.
  const uuid = crypto.randomUUID();
  const destBucket = input.type === "sunrise" ? "sunrise_photos" : "avatars";
  const destPath = `${userId}/${uuid}.jpg`;

  const { error: upErr } = await admin.storage.from(destBucket).upload(destPath, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (upErr) {
    return json(500, { error: "Unable to publish approved image" });
  }

  await admin.storage.from("uploads_pending").remove([path]);

  const publicUrl = admin.storage.from(destBucket).getPublicUrl(destPath).data.publicUrl;
  console.log("PUBLIC URL:", publicUrl);

  // Update DB record(s).
  if (input.type === "avatar") {
    await admin.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", userId);
  } else {
    const result = await admin
      .from("sunrise_logs")
      .update({ photo_url: publicUrl })
      .eq("id", logId as number)
      .eq("user_id", userId);
    console.log("DB UPDATE RESULT:", result);
  }

  return json(200, { status: "approved" as const, publicUrl });
});

