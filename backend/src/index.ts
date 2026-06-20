// src/index.ts
import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import dotenv from "dotenv";
import { db } from "./db/index.js";
import { eq } from "drizzle-orm";
import { sessions, messages, users } from "./db/schema.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// User to active device socket set registration registry cache mapping
const userDeviceRegistry = new Map<string, Set<string>>();

// =========================================================================
// SECURITY MIDDLEWARE: Handshake Verification via Neon Sessions & Users Lookup
// =========================================================================
// =========================================================================
// SECURITY MIDDLEWARE: Handshake Verification via Neon Sessions Lookup
// =========================================================================
// =========================================================================
// SECURITY MIDDLEWARE: Handshake Verification via Neon Sessions Lookup
// =========================================================================
io.use(async (socket: Socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token || typeof token !== "string") {
      return next(
        new Error("Authentication failed: Missing token header footprint"),
      );
    }

    // A. Find the valid session row directly
    const sessionResult = await db.query.sessions.findFirst({
      where: eq(sessions.token, token),
    });

    // 🚀 THE GOOGLE LOGIN FIX: Safely reject the handshake instead of crashing the server process!
    if (!sessionResult || new Date() > new Date(sessionResult.expiresAt)) {
      console.warn(
        `⚠️ Blocked unauthorized socket handshake token entry request.`,
      );
      return next(
        new Error("Authentication failed: Expired or unmapped session key"),
      );
    }

    // B. Fetch the user profile safely now that sessionResult is verified to exist
    const userResult = await db.query.users.findFirst({
      where: eq(users.id, sessionResult.userId),
      columns: { name: true },
    });

    // Cache records safely inside socket memory space
    socket.data.userId = sessionResult.userId;
    socket.data.senderName = userResult?.name || "Unknown User";

    next();
  } catch (error) {
    console.error("Critical Socket Handshake Interception Interrupted:", error);
    next(new Error("Internal Authentication Validation Pipeline Crash"));
  }
});

// =========================================================================
// CORE REAL-TIME PIPELINES
// =========================================================================
io.on("connection", (socket: Socket) => {
  const userId = socket.data.userId as string;
  const senderName = socket.data.senderName as string;

  console.log(
    `📡 Secure Socket Established: User [${senderName}] (${userId}) linked on [${socket.id}]`,
  );

  // Device Mapping Layer initialization
  if (!userDeviceRegistry.has(userId)) {
    userDeviceRegistry.set(userId, new Set());
  }
  userDeviceRegistry.get(userId)!.add(socket.id);

  // Inside io.on("connection", (socket: Socket) => { ... in backend/src/index.ts

  // 🚀 ROOM NAVIGATION LISTENERS
  socket.on("join_channel", (channelId: string) => {
    socket.join(channelId);
    console.log(
      `👤 User [${socket.data.senderName}] joined channel room [${channelId}]`,
    );
  });

  socket.on("leave_channel", (channelId: string) => {
    socket.leave(channelId);
    console.log(
      `👤 User [${socket.data.senderName}] left channel room [${channelId}]`,
    );
  });

  // Core Receiver Pipeline
  socket.on(
    "send_message",
    async (data: { channelId: string; content: string }) => {
      try {
        const { channelId, content } = data;
        if (!content.trim() || !channelId) return;

        const [insertedMessage] = await db
          .insert(messages)
          .values({
            channelId: channelId,
            senderId: userId,
            content: content.trim(),
            createdAt: new Date(),
          })
          .returning();

        const messagePayload = {
          id: insertedMessage.id,
          channelId: insertedMessage.channelId,
          senderId: insertedMessage.senderId,
          senderName: senderName, // Mapped clean human name string
          content: insertedMessage.content,
          createdAt: insertedMessage.createdAt.toISOString(),
        };

        // 🚀 FIXED: Emits ONLY to clients residing inside this targeted room channel!
        io.to(channelId).emit("message_received", messagePayload);
      } catch (err) {
        console.error(err);
      }
    },
  );

  socket.on("disconnect", () => {
    const deviceSet = userDeviceRegistry.get(userId);
    if (deviceSet) {
      deviceSet.delete(socket.id);
      if (deviceSet.size === 0) {
        userDeviceRegistry.delete(userId);
        console.log(
          `👤 User [${senderName}] completely offline (All devices disconnected safely)`,
        );
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(
    `🚀 Standalone Real-Time Server running smoothly on http://localhost:${PORT}`,
  );
});
