# Courier Tracking System - Real-Time Backend Admin Portal

A production-ready real-time shipment tracking system with admin controls, similar to USPS + Bolt-style tracking. Built with NestJS, PostgreSQL, Socket.IO, and designed for live GPS tracking with pause/resume capabilities.

## Table of Contents

- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [Database Schema](#database-schema)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [WebSocket Events](#websocket-events)
- [Testing](#testing)

## System Architecture

The system separates **Tracking Events** (permanent timeline) from **Live Location Stream** (real-time GPS):

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN PORTAL (React/Next.js)            │
│  - Shipment Management                                      │
│  - Live Map View with Pause/Resume Controls                │
│  - Tracking Timeline                                        │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │
                  REST APIs │ WebSocket
                           │
┌─────────────────────────────────────────────────────────────┐
│                    NESTJS BACKEND API                       │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Auth      │  │  Shipments   │  │   Tracking      │  │
│  │   Module    │  │   Module     │  │   Events        │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Movement   │  │  Location    │  │   WebSocket     │  │
│  │  (Pause/    │  │  Service     │  │   Gateway       │  │
│  │  Resume)    │  │              │  │  (Socket.IO)    │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │
                      Prisma ORM
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                      │
│                                                             │
│  - AdminUser                                                │
│  - Shipment                                                 │
│  - TrackingEvent (Permanent Timeline)                      │
│  - ShipmentLocation (Live GPS Stream)                      │
│  - ShipmentMovementState (Pause/Resume Control)            │
└─────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Separation of Concerns**
   - Tracking events = Permanent audit trail
   - Live locations = Real-time GPS stream (can be cleared periodically)

2. **Real-Time Control**
   - Admin can PAUSE shipment movement
   - When paused, location updates stop being emitted
   - When RESUMED, updates continue from last known position

3. **WebSocket Architecture**
   - Each shipment has its own Socket.IO room
   - JWT authentication for admin sockets
   - Public read-only access for tracking pages

## Tech Stack

### Backend
- **NestJS** - Progressive Node.js framework
- **PostgreSQL** - Primary database
- **Prisma ORM** - Type-safe database client
- **Socket.IO** - Real-time WebSocket communication
- **JWT** - Authentication & authorization
- **bcrypt** - Password hashing

### Frontend (To Be Implemented)
- **Next.js** - React framework
- **TypeScript** - Type safety
- **Mapbox GL JS** - Map rendering
- **shadcn/ui** - UI component library
- **Socket.IO Client** - Real-time connection

## Key Features

### Admin Features
- ✅ Create and manage shipments
- ✅ Add tracking events to timeline
- ✅ View shipment statistics
- ✅ **PAUSE shipment movement** (stops live updates)
- ✅ **RESUME shipment movement** (restarts live updates)
- ✅ Real-time map view per shipment
- ✅ Audit log for all pause/resume actions
- ✅ Role-based access control (ADMIN, SUPER_ADMIN, VIEWER)

### Public Features
- ✅ Track shipments by tracking number
- ✅ View tracking timeline (read-only)
- ✅ Real-time map updates (read-only WebSocket)
- ✅ Rate-limited access

### Security
- ✅ JWT authentication for admin routes
- ✅ Password hashing with bcrypt
- ✅ WebSocket JWT verification
- ✅ CORS protection
- ✅ Rate limiting (configured)
- ✅ Input validation with class-validator

## Database Schema

### Models

**AdminUser**
- Authentication and role management
- Tracks who created events and paused shipments

**Shipment**
- Core entity with tracking number
- Origin and destination locations
- Current status and location

**TrackingEvent**
- Permanent timeline of shipment events
- Includes status changes, scan events, etc.
- Associated with admin who created it

**ShipmentLocation**
- Real-time GPS coordinates
- Speed and heading information
- Can be purged periodically for storage

**ShipmentMovementState**
- Controls whether shipment is moving or paused
- Tracks who paused and when
- Resume timestamp for audit

### Enums

```typescript
enum UserRole {
  ADMIN
  SUPER_ADMIN
  VIEWER
}

enum ShipmentStatus {
  PENDING
  PICKED_UP
  IN_TRANSIT
  OUT_FOR_DELIVERY
  DELIVERED
  FAILED
  CANCELLED
}
```

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- npm or yarn package manager

### 1. Clone and Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create or update `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/courier_tracking"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"

# WebSocket
WS_PORT=3001
WS_CORS_ORIGIN="http://localhost:3000,http://localhost:3001"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
PUBLIC_RATE_LIMIT_MAX=20
```

### 3. Run Database Migrations

```bash
cd backend
npx prisma migrate dev --name init
```

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Start the Backend

Development mode with hot reload:
```bash
npm run start:dev
```

Production mode:
```bash
npm run build
npm run start:prod
```

The API will be available at:
- REST API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/tracking`

### 6. Create First Admin User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "password": "secure-password",
    "role": "ADMIN"
  }'
```

## API Documentation

### Authentication

#### Register Admin
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "ADMIN"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "ADMIN"
  }
}
```

#### Get Profile
```http
GET /auth/profile
Authorization: Bearer <token>
```

### Shipments

#### Create Shipment
```http
POST /shipments
Authorization: Bearer <token>
Content-Type: application/json

{
  "trackingNumber": "TRACK123456",
  "originLocation": "New York, NY",
  "destinationLocation": "Los Angeles, CA",
  "currentStatus": "PENDING"
}
```

#### List Shipments
```http
GET /shipments?page=1&limit=20
Authorization: Bearer <token>
```

#### Get Shipment Details
```http
GET /shipments/:id
Authorization: Bearer <token>
```

#### Get Shipment by Tracking Number (Public)
```http
GET /shipments/tracking/:trackingNumber
```

#### Update Shipment
```http
PATCH /shipments/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentStatus": "IN_TRANSIT",
  "currentLocation": "Philadelphia, PA"
}
```

#### Get Statistics
```http
GET /shipments/statistics
Authorization: Bearer <token>

Response:
{
  "total": 150,
  "pending": 20,
  "inTransit": 80,
  "delivered": 45,
  "failed": 5
}
```

### Tracking Events

#### Create Tracking Event
```http
POST /tracking/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "shipmentId": "uuid",
  "status": "IN_TRANSIT",
  "description": "Package departed from facility",
  "location": "Philadelphia, PA",
  "eventTime": "2024-01-15T10:30:00Z"
}
```

#### Get Timeline
```http
GET /tracking/timeline/:shipmentId
Authorization: Bearer <token>
```

#### Get Public Timeline
```http
GET /tracking/public/:trackingNumber
```

### Movement Control (Pause/Resume)

#### Pause Shipment
```http
POST /movement/:shipmentId/pause
Authorization: Bearer <token>

Response:
{
  "message": "Shipment paused successfully",
  "movementState": {
    "isMoving": false,
    "pausedBy": "admin-uuid",
    "pausedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Resume Shipment
```http
POST /movement/:shipmentId/resume
Authorization: Bearer <token>

Response:
{
  "message": "Shipment resumed successfully",
  "movementState": {
    "isMoving": true,
    "resumedAt": "2024-01-15T10:35:00Z"
  }
}
```

#### Get Movement State
```http
GET /movement/:shipmentId/state
Authorization: Bearer <token>
```

#### Get Movement History
```http
GET /movement/:shipmentId/history
Authorization: Bearer <token>
```

### Location Data

#### Record Location
```http
POST /locations
Authorization: Bearer <token>
Content-Type: application/json

{
  "shipmentId": "uuid",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "speed": 55.5,
  "heading": 180.0
}
```

#### Get Locations
```http
GET /locations/:shipmentId?limit=100
Authorization: Bearer <token>
```

#### Get Latest Location
```http
GET /locations/:shipmentId/latest
Authorization: Bearer <token>
```

## WebSocket Events

### Connection

Connect to the WebSocket server at `/tracking` namespace:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/tracking', {
  auth: {
    token: 'your-jwt-token' // Optional: for admin features
  }
});
```

### Client Events (Emit)

#### Join Shipment Room
```javascript
socket.emit('joinShipment', {
  shipmentId: 'uuid'
});
```

#### Leave Shipment Room
```javascript
socket.emit('leaveShipment', {
  shipmentId: 'uuid'
});
```

#### Update Location (Admin Only)
```javascript
socket.emit('updateLocation', {
  shipmentId: 'uuid',
  latitude: 40.7128,
  longitude: -74.0060,
  speed: 55.5,
  heading: 180.0,
  timestamp: new Date()
});
```

### Server Events (Listen)

#### Joined Shipment
```javascript
socket.on('joinedShipment', (data) => {
  console.log('Joined:', data);
  // data contains: shipmentId, isMoving, currentLocation, shipment
});
```

#### Location Update
```javascript
socket.on('locationUpdate', (data) => {
  console.log('New location:', data);
  // data contains: shipmentId, latitude, longitude, speed, heading, timestamp
  // Update marker on map
});
```

#### Shipment Paused
```javascript
socket.on('shipmentPaused', (data) => {
  console.log('Shipment paused:', data);
  // Freeze marker, show paused indicator
});
```

#### Shipment Resumed
```javascript
socket.on('shipmentResumed', (data) => {
  console.log('Shipment resumed:', data);
  // Resume marker animation
});
```

#### Error
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

## Testing

### Test with Prisma Studio

View and edit data in a GUI:
```bash
cd backend
npm run prisma:studio
```

### Test Simulation

The WebSocket gateway includes a built-in simulation feature for testing:

```javascript
// In your backend code or via admin API
trackingGateway.startSimulation('shipment-uuid');
// This will simulate GPS movement from New York to Los Angeles

// Stop simulation
trackingGateway.stopSimulation('shipment-uuid');
```

### Manual Testing Flow

1. **Register and Login**
   ```bash
   # Register
   curl -X POST http://localhost:3000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Admin","email":"test@example.com","password":"test123","role":"ADMIN"}'

   # Login
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'
   ```

2. **Create Shipment**
   ```bash
   curl -X POST http://localhost:3000/shipments \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "trackingNumber":"TEST123",
       "originLocation":"New York, NY",
       "destinationLocation":"Los Angeles, CA"
     }'
   ```

3. **Add Tracking Event**
   ```bash
   curl -X POST http://localhost:3000/tracking/events \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "shipmentId":"SHIPMENT_UUID",
       "status":"PICKED_UP",
       "description":"Package picked up",
       "location":"New York, NY"
     }'
   ```

4. **Test Pause/Resume**
   ```bash
   # Pause
   curl -X POST http://localhost:3000/movement/SHIPMENT_UUID/pause \
     -H "Authorization: Bearer YOUR_TOKEN"

   # Resume
   curl -X POST http://localhost:3000/movement/SHIPMENT_UUID/resume \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

5. **Connect WebSocket and Test Live Tracking**
   Use the provided WebSocket events to connect and test real-time updates.

## Next Steps

### Frontend Implementation
The backend is complete and ready. Next steps:

1. **Set up Next.js Admin Portal**
   - Authentication pages (login/register)
   - Dashboard with shipment statistics
   - Shipment list and detail pages

2. **Implement Map View**
   - Integrate Mapbox GL JS or Google Maps
   - Moving marker with smooth animations
   - Route polyline display
   - Pause/Resume controls

3. **Public Tracking Page**
   - Search by tracking number
   - Timeline view
   - Read-only map view

4. **Additional Features**
   - Email notifications
   - Push notifications
   - Analytics dashboard
   - Export shipment data
   - Bulk operations

## Architecture Decisions

### Why Separate Tracking Events and Live Locations?

- **Tracking Events**: Permanent audit trail, never deleted
- **Live Locations**: Can be pruned after delivery for storage efficiency
- Different access patterns and retention policies

### Why Socket.IO Room Per Shipment?

- Scalable: Clients only receive updates for shipments they're watching
- Efficient: No unnecessary data transmission
- Isolated: Pause/resume affects only specific shipment room

### Why Movement State Table?

- Central source of truth for pause/resume state
- Audit trail with timestamps
- Easy to query and enforce in location updates

## License

MIT

## Support

For issues or questions, please create an issue in the project repository.
