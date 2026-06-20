"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "://gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "ol.ritter71@gmail.com",
    pass: process.env.SMTP_PASS,
  },
});

export async function sendResetEmailAction(email: string) {
  const cleanEmail = email.toLowerCase().trim();

  try {
    // 1. Generate a secure unique token string
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour lifetime

    // 2. Write it directly to the database in Better-Auth format
    await db.insert(schema.verifications).values({
      id: uuidv4(),
      identifier: cleanEmail, // Better-Auth uses the email as the identifier for password resets
      value: token,
      expiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?resetToken=${token}&email=${cleanEmail}`;

    await transporter.sendMail({
      from: '"Chat Core Node" <ol.ritter71@gmail.com>',
      to: cleanEmail,
      subject: "Reset your account password",
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 450px; margin: auto; border: 1px solid #e4e4e7; border-radius: 12px;">
          <h2>Password Reset Request</h2>
          <p>Please click the secure link below to configure your new chat account password:</p>
          <p><a href="${resetLink}" style="background: #2563eb; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset Password</a></p>
          <p style="font-size: 11px; color: #71717a;">This link will stay active for 1 hour.</p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("❌ BACKEND RESET FAILED:", error);
    throw new Error("Failed to process security reset lookup.");
  }
}
