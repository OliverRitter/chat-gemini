// src/db/index.ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

// Required for Neon serverless WebSockets to function correctly in standard Node runtimes
neonConfig.webSocketConstructor = ws;

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const pool =
  globalForDb.conn ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") globalForDb.conn = pool;

// Export the Neon-optimized drizzle instance loaded with our schema definitions
export const db = drizzle(pool, { schema });
