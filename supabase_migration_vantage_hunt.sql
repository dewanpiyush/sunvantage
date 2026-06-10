-- Vantage Hunt metadata on sunrise logs (optional; client tolerates missing columns).
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS hunt_movement_mode text;
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS hunt_displacement_meters integer;
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS hunt_vantage_label text;
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS predawn_photo_url text;
