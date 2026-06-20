// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

// Global singleton client module
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});
