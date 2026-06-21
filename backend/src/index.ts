import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import dotenv from "dotenv";
import { db } from "./db/index.js";
import { eq, and, sql } from "drizzle-orm"; // 🟩 Ensure 'sql' is imported here

import { sessions, messages, users, channelMembers } from "./db/schema.js";
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
  socket.join(userId);
  // Device Mapping Layer initialization
  if (!userDeviceRegistry.has(userId)) {
    userDeviceRegistry.set(userId, new Set());
  }
  userDeviceRegistry.get(userId)!.add(socket.id);

  // 🚀 HIGH-PERFORMANCE REUSABLE PRESENCE BROADCASTER
  // Calculates who is inside this specific channel and alerts all active members in it
  // 🚀 HIGH-PERFORMANCE REUSABLE PRESENCE BROADCASTER (100% Database-Free!)
  // Scans active memory sockets inside this specific room and maps user IDs cleanly.
  const broadcastWorkspacePresence = () => {
    try {
      // Extract all user IDs that currently have an active socket session running in memory
      const onlineUserIds = Array.from(userDeviceRegistry.keys());

      // Broadcast this simple string array to EVERYONE authenticated on the server
      // Since it only contains active user IDs, the data package remains incredibly light!
      io.emit("workspace_presence_update", onlineUserIds);
    } catch (err) {
      console.error("Failed to broadcast workspace presence update:", err);
    }
  };

  // Update your connection and room navigation hooks to call our new method:
  // 1. Alert everyone the moment a user establishes a socket line connection
  broadcastWorkspacePresence();

  // 🚀 ROOM NAVIGATION LISTENERS
  socket.on("join_channel", (channelId: string) => {
    socket.join(channelId);
    console.log(`👤 User [${senderName}] joined channel room [${channelId}]`);
  });

  socket.on("leave_channel", (channelId: string) => {
    socket.leave(channelId);
    console.log(`👤 User [${senderName}] left channel room [${channelId}]`);
  });

  // CORE REAL-TIME RECEIVER PIPELINE
  socket.on(
    "send_message",
    async (data: { channelId: string; content: string }) => {
      try {
        const { channelId, content } = data;
        if (!content.trim() || !channelId) return;

        // 1. Insert the message text into your rows safely
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
          senderName: senderName,
          content: insertedMessage.content,
          createdAt: insertedMessage.createdAt.toISOString(),
        };

        // 🟩 THE ABSOLUTE REPAIR: Run a raw SQL query execution parameter string!
        // This reads the raw Postgres strings directly, bypassing the Drizzle object schema compilation
        // completely so it can NEVER crash your node process with a Symbol columns error again.
        const rawMembersResult = await db.execute(
          sql`SELECT user_id as "userId" FROM channel_members WHERE channel_id = ${channelId}`,
        );

        // Access the raw data rows safely from the Postgres database engine result instance
        const validMembers = rawMembersResult.rows || [];

        if (validMembers.length > 0) {
          validMembers.forEach((member: any) => {
            // Direct-route the data package to each user's permanent private account socket room
            const targetRecipient = member?.userId;
            if (targetRecipient) {
              io.to(targetRecipient).emit("message_received", messagePayload);
            }
          });
        } else {
          // Fallback option if no database connection rows exist yet
          io.to(channelId).emit("message_received", messagePayload);
        }
      } catch (err) {
        console.error("Failed to process message transit payload:", err);
      }
    },
  );

  // SECURE DEVICE LIFECYCLE DISCONNECTION HARVESTER
  socket.on("disconnect", () => {
    const deviceSet = userDeviceRegistry.get(userId);
    if (deviceSet) {
      deviceSet.delete(socket.id);
      if (deviceSet.size === 0) {
        userDeviceRegistry.delete(userId);
        console.log(
          `👤 User [${senderName}] completely offline (All devices disconnected safely)`,
        );

        // 🚀 UPDATED: Alerts everyone instantly that this user went offline
        broadcastWorkspacePresence();
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
