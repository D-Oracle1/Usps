# Backend API - Courier Tracking System

Real-time shipment tracking backend built with NestJS, PostgreSQL, Prisma, and Socket.IO.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run start:dev
```

## Project Structure

```
backend/
├── src/
│   ├── auth/              # JWT authentication & authorization
│   │   ├── dto/           # Data transfer objects
│   │   ├── guards/        # Auth guards (JWT, Roles)
│   │   ├── strategies/    # Passport strategies
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   │
│   ├── shipments/         # Shipment management
│   │   ├── dto/
│   │   ├── shipments.controller.ts
│   │   ├── shipments.service.ts
│   │   └── shipments.module.ts
│   │
│   ├── tracking/          # Tracking event timeline
│   │   ├── dto/
│   │   ├── tracking.controller.ts
│   │   ├── tracking.service.ts
│   │   └── tracking.module.ts
│   │
│   ├── location/          # GPS location data
│   │   ├── dto/
│   │   ├── location.controller.ts
│   │   ├── location.service.ts
│   │   └── location.module.ts
│   │
│   ├── movement/          # Pause/Resume controls
│   │   ├── movement.controller.ts
│   │   ├── movement.service.ts
│   │   └── movement.module.ts
│   │
│   ├── websocket/         # Real-time WebSocket gateway
│   │   ├── tracking.gateway.ts
│   │   └── websocket.module.ts
│   │
│   ├── prisma/            # Database service
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   │
│   ├── app.module.ts      # Root module
│   └── main.ts            # Application entry point
│
├── prisma/
│   └── schema.prisma      # Database schema
│
├── .env                   # Environment variables
├── tsconfig.json          # TypeScript config
├── nest-cli.json          # NestJS CLI config
└── package.json           # Dependencies
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register admin user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/profile` - Get current user profile (protected)

### Shipments
- `POST /shipments` - Create shipment (protected)
- `GET /shipments` - List shipments with pagination (protected)
- `GET /shipments/statistics` - Get shipment statistics (protected)
- `GET /shipments/:id` - Get shipment details (protected)
- `GET /shipments/tracking/:trackingNumber` - Public tracking lookup
- `PATCH /shipments/:id` - Update shipment (protected)
- `DELETE /shipments/:id` - Delete shipment (protected)

### Tracking Events
- `POST /tracking/events` - Create tracking event (protected)
- `GET /tracking/timeline/:shipmentId` - Get timeline (protected)
- `GET /tracking/public/:trackingNumber` - Public timeline

### Movement Control
- `POST /movement/:shipmentId/pause` - Pause shipment (protected)
- `POST /movement/:shipmentId/resume` - Resume shipment (protected)
- `GET /movement/:shipmentId/state` - Get movement state (protected)
- `GET /movement/:shipmentId/history` - Get pause/resume history (protected)

### Locations
- `POST /locations` - Record location (protected)
- `GET /locations/:shipmentId` - Get locations (protected)
- `GET /locations/:shipmentId/latest` - Get latest location (protected)

## WebSocket Gateway

Namespace: `/tracking`

### Events

**Client → Server:**
- `joinShipment` - Join shipment room
- `leaveShipment` - Leave shipment room
- `updateLocation` - Update location (admin only)

**Server → Client:**
- `joinedShipment` - Confirmation with current state
- `locationUpdate` - Real-time location update
- `shipmentPaused` - Shipment paused event
- `shipmentResumed` - Shipment resumed event
- `error` - Error messages

## Database Models

See `prisma/schema.prisma` for full schema.

### Key Tables
- **admin_users** - Admin authentication
- **shipments** - Core shipment data
- **tracking_events** - Permanent timeline
- **shipment_locations** - GPS stream (can be pruned)
- **shipment_movement_states** - Pause/resume control

## Development

### Available Scripts

```bash
# Start development server with hot reload
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Generate Prisma Client
npm run prisma:generate

# Create and run migrations
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

### Database Migrations

```bash
# Create a new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset
```

## Environment Variables

Required variables in `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
```

## Authentication Flow

1. Register admin user via `/auth/register`
2. Login to get JWT token via `/auth/login`
3. Include token in Authorization header: `Bearer <token>`
4. Token is validated by JwtAuthGuard on protected routes
5. WebSocket connections can authenticate via handshake

## Real-Time Tracking Logic

### Core Concept
- Each shipment has `isMoving` boolean in `shipment_movement_states`
- When `isMoving = true`, location updates are emitted via WebSocket
- When `isMoving = false` (paused), updates are blocked
- Admin can toggle via `/movement/:id/pause` and `/movement/:id/resume`

### WebSocket Flow
1. Client joins shipment room via `joinShipment` event
2. Server checks movement state
3. If moving, location updates are emitted every few seconds
4. If paused, no updates are sent (marker freezes on map)
5. When resumed, updates continue from last known position

### Simulation Feature
For testing, the gateway includes `startSimulation()`:
```typescript
trackingGateway.startSimulation('shipment-uuid');
```
This simulates GPS movement from NY to LA with realistic coordinates.

## Security Features

- JWT-based authentication
- Password hashing with bcrypt (10 rounds)
- Role-based access control (ADMIN, SUPER_ADMIN, VIEWER)
- WebSocket JWT verification
- CORS protection
- Input validation with class-validator
- SQL injection prevention via Prisma

## Testing

### Manual API Testing

```bash
# Test health
curl http://localhost:3000

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Create shipment (use token from login)
curl -X POST http://localhost:3000/shipments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumber":"TEST123",
    "originLocation":"New York, NY",
    "destinationLocation":"Los Angeles, CA"
  }'
```

### WebSocket Testing

Use a WebSocket client or the frontend to test real-time features:
```javascript
const socket = io('http://localhost:3000/tracking', {
  auth: { token: 'your-jwt-token' }
});

socket.emit('joinShipment', { shipmentId: 'uuid' });

socket.on('locationUpdate', (data) => {
  console.log('Location update:', data);
});
```

## Deployment

### Production Checklist

- [ ] Set strong `JWT_SECRET` in environment
- [ ] Use production PostgreSQL database
- [ ] Set `NODE_ENV=production`
- [ ] Enable rate limiting
- [ ] Configure CORS for your frontend domain
- [ ] Set up SSL/TLS certificates
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up monitoring and logging
- [ ] Regular database backups
- [ ] Consider pruning old location data

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "run", "start:prod"]
```

## Performance Considerations

- Location data grows quickly - consider periodic cleanup
- Use database indexes (already defined in schema)
- Consider Redis for WebSocket scaling across multiple servers
- Implement connection pooling for database
- Add caching for frequently accessed shipments

## Troubleshooting

### Database Connection Issues
```bash
# Check Prisma connection
npx prisma db pull

# View current schema
npx prisma db push --skip-generate
```

### WebSocket Not Connecting
- Check CORS settings in `main.ts`
- Verify JWT token is valid
- Check firewall/network settings

### Build Errors
```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

## Contributing

1. Create feature branch
2. Make changes
3. Add migrations if schema changed
4. Test thoroughly
5. Submit pull request

## License

MIT
