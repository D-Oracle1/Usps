FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from backend directory
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY backend/ .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production

# Generate Prisma client in production
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start script: run migrations then start the app
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main.js"]
