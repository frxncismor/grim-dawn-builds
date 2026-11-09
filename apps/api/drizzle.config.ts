import { defineConfig } from 'drizzle-kit';
import { resolveDrizzleCredentials } from './src/db/credentials.js';

// Credentials are resolved only for migrate/push/pull/studio. generate/check need no database.
const credentials = resolveDrizzleCredentials(process.argv.slice(2), process.env);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  ...(credentials ? { dbCredentials: credentials } : {}),
});
