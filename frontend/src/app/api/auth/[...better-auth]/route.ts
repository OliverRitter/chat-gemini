// src/app/api/auth/[...better-auth]/route.ts
import { auth } from "../../../../lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Export the catch-all API handlers for Next.js to parse incoming auth hooks
export const { GET, POST } = toNextJsHandler(auth);
