-- Add speed and progress fields to shipment_movement_states table
ALTER TABLE "shipment_movement_states"
ADD COLUMN IF NOT EXISTS "vehicle_speed_kmh" DOUBLE PRECISION NOT NULL DEFAULT 105,
ADD COLUMN IF NOT EXISTS "current_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_position_lat" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "last_position_lng" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "progress_updated_at" TIMESTAMP(3);
