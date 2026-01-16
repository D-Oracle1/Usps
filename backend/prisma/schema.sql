-- Create enums
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');
CREATE TYPE "ConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SenderType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- Create admin_users table
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- Create support_users table
CREATE TABLE "support_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "support_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "support_users_email_key" ON "support_users"("email");

-- Create conversations table
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "support_user_id" TEXT NOT NULL,
    "tracking_number" TEXT,
    "subject" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ConversationPriority" NOT NULL DEFAULT 'NORMAL',
    "assigned_admin_id" TEXT,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conversations_support_user_id_idx" ON "conversations"("support_user_id");
CREATE INDEX "conversations_tracking_number_idx" ON "conversations"("tracking_number");
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- Create messages table
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_type" "SenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- Create shipments table
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "origin_location" TEXT NOT NULL,
    "destination_location" TEXT NOT NULL,
    "current_status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "current_location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "goods_description" TEXT,
    "package_weight" DOUBLE PRECISION,
    "package_dimensions" TEXT,
    "declared_value" DOUBLE PRECISION,
    "service_type" TEXT,
    "sender_name" TEXT,
    "sender_phone" TEXT,
    "sender_email" TEXT,
    "recipient_name" TEXT,
    "recipient_phone" TEXT,
    "recipient_email" TEXT,
    "special_instructions" TEXT,
    "total_distance" DOUBLE PRECISION,
    "remaining_distance" DOUBLE PRECISION,
    "estimated_arrival" TIMESTAMP(3),
    "trip_started_at" TIMESTAMP(3),
    "average_speed" DOUBLE PRECISION DEFAULT 45,
    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shipments_tracking_number_key" ON "shipments"("tracking_number");
CREATE INDEX "shipments_tracking_number_idx" ON "shipments"("tracking_number");

-- Create tracking_events table
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tracking_events_shipment_id_idx" ON "tracking_events"("shipment_id");
CREATE INDEX "tracking_events_event_time_idx" ON "tracking_events"("event_time");

-- Create shipment_locations table
CREATE TABLE "shipment_locations" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION DEFAULT 0,
    "heading" DOUBLE PRECISION DEFAULT 0,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipment_locations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shipment_locations_shipment_id_recorded_at_idx" ON "shipment_locations"("shipment_id", "recorded_at");

-- Create shipment_movement_states table
CREATE TABLE "shipment_movement_states" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "is_moving" BOOLEAN NOT NULL DEFAULT true,
    "paused_by" TEXT,
    "paused_at" TIMESTAMP(3),
    "resumed_at" TIMESTAMP(3),
    "intercept_reason" TEXT,
    "clear_reason" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipment_movement_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shipment_movement_states_shipment_id_key" ON "shipment_movement_states"("shipment_id");

-- Create address_change_fees table
CREATE TABLE "address_change_fees" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "previous_destination" TEXT NOT NULL,
    "new_destination" TEXT NOT NULL,
    "distance_difference" DOUBLE PRECISION NOT NULL,
    "time_difference" DOUBLE PRECISION NOT NULL,
    "base_fee" DOUBLE PRECISION NOT NULL DEFAULT 5.00,
    "per_mile_fee" DOUBLE PRECISION NOT NULL DEFAULT 0.50,
    "total_fee" DOUBLE PRECISION NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_by" TEXT,
    CONSTRAINT "address_change_fees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "address_change_fees_shipment_id_idx" ON "address_change_fees"("shipment_id");

-- Add foreign keys
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_support_user_id_fkey" FOREIGN KEY ("support_user_id") REFERENCES "support_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment_locations" ADD CONSTRAINT "shipment_locations_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_movement_states" ADD CONSTRAINT "shipment_movement_states_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_movement_states" ADD CONSTRAINT "shipment_movement_states_paused_by_fkey" FOREIGN KEY ("paused_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "address_change_fees" ADD CONSTRAINT "address_change_fees_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "address_change_fees" ADD CONSTRAINT "address_change_fees_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
