"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
// 🔑 THE MODULE FIX: Import the native scrypt hashing module directly from Better-Auth crypto sub-paths!
import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";

dotenv.config();

export async function resetPasswordWithTokenAction(
  resetToken: string,
  email: string,
  passwordString: string,
) {
  try {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Look up the custom token row inside your verification table
    const [verificationRow] = await db
      .select()
      .from(schema.verifications)
      .where(
        and(
          eq(schema.verifications.value, resetToken),
          eq(schema.verifications.identifier, cleanEmail),
        ),
      )
      .limit(1);

    if (!verificationRow) {
      return {
        error: "This password reset link is invalid or has already been used.",
      };
    }

    if (new Date() > verificationRow.expiresAt) {
      return {
        error:
          "This password reset link has expired. Please request a new one.",
      };
    }

    // 2. Look up the user's ID using their email address
    const [targetUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, cleanEmail))
      .limit(1);

    if (!targetUser) {
      return {
        error: "No user account was found associated with this email address.",
      };
    }

    // 3. 🔑 THE CRYPTO FIX: Call hashPassword natively. This outputs the exact scrypt format Better-Auth requires!
    const hashedPassword = await hashPassword(passwordString);

    // 4. Overwrite the credential row inside the accounts table
    await db
      .update(schema.accounts)
      .set({
        password: hashedPassword,
      })
      .where(eq(schema.accounts.userId, targetUser.id));

    // 5. Delete the used tracking token row out of the system
    await db
      .delete(schema.verifications)
      .where(eq(schema.verifications.id, verificationRow.id));

    return { success: true };
  } catch (err) {
    console.error("❌ DIRECT PASSWORD RESET CRASHED:", err);
    return { error: "Database transaction pool connection failure." };
  }
}
