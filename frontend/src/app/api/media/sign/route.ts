// src/app/api/media/sign/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Link your keys directly into the cloud package compiler instance
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST() {
  try {
    // 1. Authenticate Request: Verify the requester has a valid Better-Auth session cookie
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized access blocked" },
        { status: 401 },
      );
    }

    // Unix epoch timestamp calculation
    const timestamp = Math.round(new Date().getTime() / 1000);

    // 2. Build parameter packet matching parameters expected by Cloudinary's uploader API
    const paramsToSign = {
      timestamp: timestamp,
      folder: "chat_attachments",
    };

    // 3. Cryptographically sign the request body using your private server key
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!,
    );

    return NextResponse.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    console.error("Cloudinary signing engine dropped:", error);
    return NextResponse.json(
      { error: "Internal signing error" },
      { status: 500 },
    );
  }
}
