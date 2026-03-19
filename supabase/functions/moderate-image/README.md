# `moderate-image` (Supabase Edge Function)

Moderates an image staged in the private `uploads_pending` bucket, then publishes it to a public bucket if approved.

## Request

- **Method**: `POST`
- **Auth**: required (`Authorization: Bearer <supabase_jwt>`)
- **Body**:

```json
{ "path": "userId/some-file.jpg", "type": "sunrise" }
```

`type` is `"sunrise"` or `"avatar"`.

## Response

```json
{ "status": "approved", "publicUrl": "https://..." }
```

or

```json
{ "status": "rejected" }
```

## Environment variables

Set these as function secrets (do not put them in the client):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (used only to validate the caller JWT)
- `SUPABASE_SERVICE_ROLE_KEY` (used to access private storage + write DB)
- `GOOGLE_VISION_API_KEY`

## Buckets

- Staging (private): `uploads_pending`
- Public publish targets:
  - `sunrise_photos`
  - `avatars`

