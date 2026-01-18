FROM node:20-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install ALL dependencies (need devDeps for build)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy backend source code
COPY backend/ .

# Build the application
RUN npm run build

# Create start script directly to avoid line ending issues
# Run prisma db push in background to not block server startup
RUN printf '#!/bin/sh\n\
echo "=== Starting USPS Backend ==="\n\
echo "DATABASE_URL set: $(test -n "$DATABASE_URL" && echo YES || echo NO)"\n\
npx prisma db push --accept-data-loss --skip-generate &\n\
PRISMA_PID=$!\n\
echo "=== Started Prisma DB Push (PID: $PRISMA_PID) ==="\n\
echo "=== Starting Node Server ==="\n\
exec node dist/main\n' > start.sh && chmod +x start.sh

# Expose port
EXPOSE 3000

# Start the application with schema push
CMD ["sh", "start.sh"]
