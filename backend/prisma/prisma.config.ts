import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Use DATABASE_URL from environment - Railway provides this
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL not set, using localhost fallback');
}

const dbUrl = DATABASE_URL || 'postgresql://localhost:5432/usps';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),

  migrate: {
    async development() {
      return {
        url: dbUrl,
      };
    },
  },

  datasource: {
    url: dbUrl,
  },
});
