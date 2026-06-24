// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import nodemailer from "nodemailer";

// 1. INITIALIZE TRANSPORTER AT THE TOP (Makes it globally accessible)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "ol.ritter71@gmail.com",
    pass: process.env.SMTP_PASS,
  },
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  // 2. EMAIL VERIFICATION ENGINE
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`🔄 Triggering email verification for: ${user.email}`);
      const link = new URL(url);
      link.searchParams.set("callbackURL", "/auth/verify");

      await transporter.sendMail({
        from: `"Chat Core Node" <${process.env.SMTP_FROM || "ol.ritter71@gmail.com"}>`,
        to: user.email,
        subject: "Verify your email address",
        html: `
          <p>Hello ${user.name || "User"},</p>
          <p>Please click the secure link below to complete your registration process:</p>
          <p><a href="${String(link)}"><strong>Verify Email Address</strong></a></p>
          <p>If the link doesn't work, copy and paste this URL into your browser:</p>
          <p><code>${String(link)}</code></p>
        `,
      });

      console.log(`✅ Verification email successfully sent to: ${user.email}`);
    },
  },

  // 3. PASSWORD HANDLERS
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 4,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(`🔄 Triggering password reset for: ${user.email}`);

      await transporter.sendMail({
        from: `"Chat Core Node" <${process.env.SMTP_FROM || "ol.ritter71@gmail.com"}>`,
        to: user.email,
        subject: "Reset your password",
        html: `
          <p>Hello,</p>
          <p>Please click the link below to securely configure a new password for your account:</p>
          <p><a href="${url}"><strong>Reset Password</strong></a></p>
        `,
      });

      console.log(`✅ Reset email successfully sent to: ${user.email}`);
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});
