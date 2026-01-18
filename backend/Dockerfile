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
# Run prisma db push synchronously (must complete before server starts)
RUN printf '#!/bin/sh\n\
set -e\n\
echo "=== Starting USPS Backend ==="\n\
echo "DATABASE_URL set: $(test -n "$DATABASE_URL" && echo YES || echo NO)"\n\
echo "=== Running Prisma DB Push ==="\n\
node node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate\n\
echo "=== Prisma DB Push Complete ==="\n\
echo "=== Starting Node Server ==="\n\
exec node dist/main\n' > start.sh && chmod +x start.sh

# Expose port
EXPOSE 3000

# Start the application with schema push
CMD ["sh", "start.sh"]
