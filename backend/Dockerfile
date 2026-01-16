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

# Remove devDependencies after build
RUN npm prune --production

# Expose port
EXPOSE 3000

# Run prisma db push and start the application
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]
