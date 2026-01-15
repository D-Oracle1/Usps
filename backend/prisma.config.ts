import path from 'node:path';
import { defineConfig } from 'prisma/config';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/usps';

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
