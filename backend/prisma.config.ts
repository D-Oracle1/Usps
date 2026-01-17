import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

// Load .env file for Prisma CLI
config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/usps';
const DIRECT_URL = process.env.DIRECT_URL || DATABASE_URL;

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  migrate: {
    async development() {
      return {
        url: DATABASE_URL,
      };
    },
  },

  datasource: {
    url: DATABASE_URL,
  },
});
