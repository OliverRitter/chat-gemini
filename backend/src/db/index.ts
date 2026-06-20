// src/db/index.ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import dotenv from "dotenv"; // <-- Add this import
import * as schema from "./schema.js";

// Force load the .env parameters before initializing the connection pool properties
dotenv.config();

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Will now safely map your Neon URL string
});

export const db = drizzle(pool, { schema });
