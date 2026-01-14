import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Supabase Pooler - Transaction mode (port 6543)
const DATABASE_URL = 'postgresql://postgres.kcnudftcmxtxmwslcbxm:1%402%233%244%255%266-@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

export default defineConfig({
  earlyAccess: true,
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
