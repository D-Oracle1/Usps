-- Migration: Add route, stops columns and extended ShipmentStatus values
-- This migration is backward-compatible - all new fields are optional
-- Existing shipments continue to work without modification

-- Add route column (JSON array of route points)
-- Format: [{lat: number, lng: number, cumulativeDistance?: number}, ...]
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "route" JSONB;

-- Add stops column (JSON array of stops for multi-stop shipments)
-- Format: [{id: string, type: string, lat: number, lng: number, label?: string, dwellTimeMs?: number, completed?: boolean, completedAt?: timestamp}, ...]
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "stops" JSONB;

-- Extend ShipmentStatus enum with new values for interception/clearance workflow
-- Note: PostgreSQL allows adding enum values but not removing them
-- These values are additive and do not affect existing shipments

-- Add INTERCEPTED status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'ShipmentStatus' AND e.enumlabel = 'INTERCEPTED') THEN
    ALTER TYPE "ShipmentStatus" ADD VALUE 'INTERCEPTED';
  END IF;
END$$;

-- Add AT_CLEARANCE status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'ShipmentStatus' AND e.enumlabel = 'AT_CLEARANCE') THEN
    ALTER TYPE "ShipmentStatus" ADD VALUE 'AT_CLEARANCE';
  END IF;
END$$;

-- Add CLEARED status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'ShipmentStatus' AND e.enumlabel = 'CLEARED') THEN
    ALTER TYPE "ShipmentStatus" ADD VALUE 'CLEARED';
  END IF;
END$$;

-- Create index on route column for efficient querying (optional, for performance)
CREATE INDEX IF NOT EXISTS "shipments_route_idx" ON "shipments" USING GIN ("route") WHERE "route" IS NOT NULL;

-- Create index on stops column for efficient querying (optional, for performance)
CREATE INDEX IF NOT EXISTS "shipments_stops_idx" ON "shipments" USING GIN ("stops") WHERE "stops" IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN "shipments"."route" IS 'Optional JSON array of route points for advanced tracking. Format: [{lat, lng, cumulativeDistance?}]';
COMMENT ON COLUMN "shipments"."stops" IS 'Optional JSON array of stops for multi-stop shipments. Format: [{id, type, lat, lng, label?, dwellTimeMs?, completed?, completedAt?}]';
