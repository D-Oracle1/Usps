import path from 'node:path';
import { defineConfig } from 'prisma/config';

const DATABASE_URL = 'postgresql://postgres:Consignment1245@db.rejdfspkwefgckosopsk.supabase.co:5432/postgres';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),

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
