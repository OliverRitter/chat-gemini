// src/lib/test-mail.ts
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";

// Explicitly inject your local environment keys
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function debugGmail() {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Enforces STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // Your 16-character Google App Password
    },
  });

  try {
    console.log("🔄 Testing connection to Gmail SMTP servers...");
    await transporter.verify();
    console.log("✅ Gmail Connection verified successfully!");

    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_USER}" <${process.env.SMTP_USER}>`,
      to: "ol.ritter@web.de",
      subject: "Manual Gmail Verification Pass",
      html: "<h3>Testing Nodemailer Handshake</h3><p>If you read this, your credentials are 100% correct!</p>",
    });

    console.log("🚀 Email sent successfully! Message ID:", info.messageId);
  } catch (error) {
    console.error("❌ Gmail Transport Failed:", error);
  }
}

debugGmail();
