## Google Vision Moderation (SunVantage)

This doc explains how SunVantage integrates Google Vision SafeSearch to moderate user-uploaded sunrise photos, and how that moderation affects public vs private UI.

### High-level goal

Protect the system without slowing the ritual:

- Users can save their sunrise immediately.
- Moderation runs asynchronously in the background.
- Public galleries only show photos that have been approved.
- Your own logs remain visible to you even while moderation is pending.

---

## What we moderate

We run **SafeSearch** against user-uploaded photos using **Google Vision API**.

We classify a photo as unsafe if SafeSearch marks any of these categories as **LIKELY** or **VERY_LIKELY**:

- `adult`
- `racy`
- `violence`

If any category is “high”, we reject the photo.

---

## Database: `moderation_status`

We added `sunrise_logs.moderation_status` with these values:

- `pending` (default)
- `approved`
- `rejected`

Migration: `supabase_migration_moderation_status.sql`

Also, existing rows with a non-null `photo_url` are backfilled to `approved` so older content continues to show in public feeds.

---

## Storage buckets

Two buckets are involved:

- **Staging (private)**: `uploads_pending`
- **Published (public)**:
  - `sunrise_photos` (sunrise images)
  - `avatars` (only for avatar uploads)

Uploads start in `uploads_pending`, and approved images get moved to the published bucket.

### Architectural rule: no silent storage/DB mismatch

The Edge Function follows a single rule: **if the DB update does not succeed, the operation fails** (HTTP 500) and storage is left in a **retryable** or **rolled-back** state.

**Canonical server order (`moderate-image`):**

1. **Moderation** — Google Vision SafeSearch on the staged bytes.
2. **Approve path:** Upload to the **public** bucket (`sunrise_photos` / `avatars`) → **UPDATE DB** (must succeed; `.select()` verifies rows) → **only then** remove the object from **`uploads_pending`**.
3. If the DB update fails **after** the public upload, the function **removes the newly uploaded public object** (best-effort rollback) so you don’t keep a published file without a matching row.
4. **Reject path (sunrise):** **UPDATE DB** (`rejected`, `photo_url` null) **first** → **then** remove the staged file (so a DB failure leaves the staged file for retry).

---

## Edge Function: `moderate-image`

Location: `supabase/functions/moderate-image/index.ts`

### Request

The client triggers the function with a `POST` body like:

```json
{
  "path": "userId/some-file.jpg",
  "type": "sunrise",
  "logId": 123,
  "userId": "…"
}
```

Key points:

- The function downloads the image from `uploads_pending` using the provided `path`.
- It enforces ownership by checking that the staged path starts with `${userId}/`.

### Google Vision call

The function calls Vision’s `images:annotate` endpoint with:

- the image encoded as base64
- `SAFE_SEARCH_DETECTION`

### Decision logic

```text
reject if adult == LIKELY/VERY_LIKELY OR racy == LIKELY/VERY_LIKELY OR violence == LIKELY/VERY_LIKELY
otherwise approve
```

### What the function does after the decision

- **Rejected**
  - Deletes the staged file from `uploads_pending`
  - Updates the related `sunrise_logs` row:
    - `moderation_status = 'rejected'`
    - `photo_url = null`

- **Approved**
  - Uploads the image to `sunrise_photos` under a generated UUID-based name
  - Deletes the staged file from `uploads_pending`
  - Updates the related `sunrise_logs` row:
    - `moderation_status = 'approved'`
    - `photo_url = <public URL>`

Function response is a small JSON payload with status.

---

## Client flow (upload + async moderation)

### 1) Save log immediately (no blocking UX)

When the user saves a sunrise with a photo:

- The app inserts the `sunrise_logs` row immediately.
- If a photo is present, it sets:
  - `moderation_status = 'pending'`
- It uploads the raw image bytes to `uploads_pending`.
- It triggers `moderate-image` **asynchronously** (fire-and-forget).

Main places this happens:

- `components/SunriseLogCard.tsx` (when logging from the modal)
- `app/sunrise.tsx` (when adding/replacing the photo from the Witness screen)

**Important (SunriseLogCard):** The pipeline must be **upload to `uploads_pending` → update `sunrise_logs.photo_url` → invoke `moderate-image`**. Updating the row *before* the file exists, or relying on a detached async task that can be dropped when the modal closes, left rows stuck `pending` with `uploads_pending/...` and **no Edge Function run**.

**Recovery:** `lib/pendingModerationRecovery.ts` re-invokes `moderate-image` for the current user’s rows that are still `pending` with a staged `uploads_pending/` ref. It is triggered by **`runPendingModerationRecoveryDebounced`** (shared **45s** throttle): **Home focus** (`app/home.tsx`) and **`AppState` → `'active'`** (`hooks/use-pending-moderation-recovery-on-app-active.ts` in root `app/_layout.tsx`) so returning from background on any screen retries, not only when opening Home.

**DB cleanup (public URL but still `pending`):** If `photo_url` is already a full `https://...` link but `moderation_status` stayed `pending`, public galleries won’t show the row. Run the one-time SQL in **`supabase_fix_pending_public_url_gallery.sql`** (Supabase Dashboard → SQL Editor).

### 2) User can see their own photo right away

Private view behavior:

- Your own logs are always visible to you, regardless of moderation status.
- For the photo itself:
  - while pending, we still store a reference pointing at the staged upload
  - the Witness/memory-card UI resolves that reference via a **signed URL** from `uploads_pending`

This is why your photo doesn’t “vanish” before moderation completes.

### 3) Public views wait for approval

Public gallery behavior:

- Public galleries only select rows where:
  - `moderation_status = 'approved'`
  - and `photo_url` is present

This ensures moderation is invisible (no delays in UX), but public safety is enforced.

---

## Where moderation is applied in queries

### Global sunrise gallery (public)

RPC function: `supabase_get_global_sunrise_gallery.sql`

It filters:

- `photo_url is not null`
- `moderation_status = 'approved'`

### City galleries / shared previews (public)

Client-side queries include:

- `app/my-city-sunrises.tsx`
- `app/my-mornings.tsx` (city section)
- `components/SharedDawnPreview.tsx`

Each includes:

- `.eq('moderation_status', 'approved')`

---

## UI expectation: “seconds” after upload

Moderation runs asynchronously, so there may be a short delay before a photo appears in public galleries.

However:

- private views should show immediately (pending is allowed privately)
- public views show only once `moderation_status` becomes `approved`

---

## Implementation notes / gotchas

### `photo_url` representation

Depending on the stage, `photo_url` may be:

- a staged/pending ref (so we resolve with signed URLs privately)
- a fully-qualified public URL (after approval)

Gallery/image components now handle both cases by:

- using the URL directly if `photo_url` already starts with `http://` or `https://`
- otherwise treating it as a storage ref/key

### Security boundary

Even though the function can run with service role privileges, we still protect access by:

- limiting staged access to paths that begin with the provided `userId/` prefix
- using private staging bucket (`uploads_pending`) with storage RLS policies

### Why logs showed `DB UPDATE RESULT: { error: null, data: null, status: 204 }` but rows stayed `pending`

There is **no scheduled job** — moderation runs only when the client invokes `moderate-image` after upload.

A **successful-looking** Supabase client response (`error: null`, `status: 204`) on `.update()` **without** `.select()` does **not** prove a row was updated. PostgREST often returns **204 No Content** with **no body** even when the `UPDATE` matched **zero rows** (e.g. `id` / `user_id` filter mismatch). The row then stays `moderation_status = 'pending'` while the function still returns HTTP 200 to the client.

The Edge Function now uses **`.select('id')` after update** and returns **500** with a clear message if **no row** matched, and logs a **probe** (`select id, user_id where id = logId`) to distinguish “wrong `user_id`” vs “missing `id`”.

**Check in SQL** if debugging:

```sql
select id, user_id, moderation_status, photo_url
from sunrise_logs
where id = <logId>;
```

Compare `user_id` to the `userId` sent in the invoke body — they must match exactly for the update filter used by the function.

