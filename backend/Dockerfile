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

# Copy the start script and fix line endings (Windows CRLF -> Unix LF)
COPY backend/start.sh ./start.sh
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

# Keep prisma for db push at runtime
# Remove other devDependencies after build (but keep prisma)
RUN npm prune --production && npm install prisma --save

# Expose port
EXPOSE 3000

# Start the application with schema push
CMD ["sh", "start.sh"]
