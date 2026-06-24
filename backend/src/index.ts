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
const typingRoomsRegistry = new Map<string, Map<string, string>>();

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

  // 🚀 REAL-TIME TYPING UPDATES RECEIVER
  socket.on(
    "typing_update",
    (data: { channelId: string; isTyping: boolean }) => {
      try {
        const { channelId, isTyping } = data;
        if (!channelId) return;

        // Initialize map for this room if it doesn't exist
        if (!typingRoomsRegistry.has(channelId)) {
          typingRoomsRegistry.set(channelId, new Map());
        }

        const roomMap = typingRoomsRegistry.get(channelId)!;

        if (isTyping) {
          // Record this user as typing
          roomMap.set(userId, senderName);
        } else {
          // Remove this user from the typing list
          roomMap.delete(userId);
        }

        // Clean up empty room maps to prevent memory leaks
        if (roomMap.size === 0) {
          typingRoomsRegistry.delete(channelId);
        }

        // Convert map values to an array of strings to broadcast
        const currentTypingUsers = roomMap ? Array.from(roomMap.values()) : [];

        // Broadcast the list of names back to everyone in the room EXCEPT the sender
        socket.to(channelId).emit("typing_status_changed", {
          channelId,
          typingUsers: currentTypingUsers, // Example: ["Lisa"] or ["John", "Lisa"]
        });
      } catch (err) {
        console.error("Failed to process typing state transit:", err);
      }
    },
  );

  socket.join(userId);

  // Device Mapping Layer initialization
  if (!userDeviceRegistry.has(userId)) {
    userDeviceRegistry.set(userId, new Set());
  }
  userDeviceRegistry.get(userId)!.add(socket.id);

  // Calculates who is inside this specific channel and alerts all active members in it
  // =========================================================================
  // SCOPED PRESENCE BROADCASTER (Replace your old broadcastWorkspacePresence)
  // =========================================================================
  const broadcastWorkspacePresence = async (targetSocket = null) => {
    try {
      // 1. Get a list of ALL user IDs currently online across the entire machine infrastructure
      const globalOnlineUserIds = Array.from(userDeviceRegistry.keys());

      // Optimization: If a specific socket triggered this (like joining), update just them first to save bandwidth
      if (targetSocket) {
        const activeUserId = targetSocket.data.userId;

        // Fetch only the direct message channel IDs this user belongs to
        const rawConnectedPartners = await db.execute(
          sql`SELECT DISTINCT user_id as "partnerId" 
            FROM channel_members 
            WHERE channel_id IN (
              SELECT channel_id FROM channel_members WHERE user_id = ${activeUserId}
            ) AND user_id != ${activeUserId}`,
        );

        const connectedUserIds = (rawConnectedPartners.rows || []).map(
          (r) => r.partnerId,
        );

        // Filter global online users to ONLY include people they actually talk to
        const customOnlineList = globalOnlineUserIds.filter((id) =>
          connectedUserIds.includes(id),
        );

        targetSocket.emit("workspace_presence_update", customOnlineList);
        return;
      }

      // 2. Full System Re-evaluation: Loop through every active device link to distribute scoped data
      for (const [
        activeUserId,
        deviceSockets,
      ] of userDeviceRegistry.entries()) {
        // Pull partners this specific user shares channels with
        const rawConnectedPartners = await db.execute(
          sql`SELECT DISTINCT user_id as "partnerId" 
            FROM channel_members 
            WHERE channel_id IN (
              SELECT channel_id FROM channel_members WHERE user_id = ${activeUserId}
            ) AND user_id != ${activeUserId}`,
        );

        const connectedUserIds = (rawConnectedPartners.rows || []).map(
          (r) => r.partnerId,
        );
        const customOnlineList = globalOnlineUserIds.filter((id) =>
          connectedUserIds.includes(id),
        );

        // Emit securely to each of the user's active device threads
        deviceSockets.forEach((socketId) => {
          io.to(socketId).emit("workspace_presence_update", customOnlineList);
        });
      }
    } catch (err) {
      console.error(
        "Failed to distribute scoped workspace presence updates:",
        err,
      );
    }
  };

  // Alert everyone the moment a user establishes a socket line connection
  broadcastWorkspacePresence();

  // ROOM NAVIGATION LISTENERS
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

        const rawMembersResult = await db.execute(
          sql`SELECT user_id as "userId" FROM channel_members WHERE channel_id = ${channelId}`,
        );

        const validMembers = rawMembersResult.rows || [];

        validMembers.forEach((member: any) => {
          const targetRecipient = member?.userId;
          if (targetRecipient) {
            io.to(targetRecipient).emit("message_received", messagePayload);
          }
        });
      } catch (err) {
        console.error("Failed to process message transit payload:", err);
      }
    },
  );

  // 🚀 SECURE DISCONNECTION HARVESTER WITH AUTO-TYPING CLEANUP
  socket.on("disconnect", () => {
    const deviceSet = userDeviceRegistry.get(userId);
    if (deviceSet) {
      deviceSet.delete(socket.id);
      if (deviceSet.size === 0) {
        userDeviceRegistry.delete(userId);
        console.log(
          `👤 User [${senderName}] completely offline (All devices disconnected safely)`,
        );

        // 🌟 CRITICAL REPAIR: Wipe typing history flags across all rooms if user closes application entirely
        typingRoomsRegistry.forEach((roomMap, channelId) => {
          if (roomMap.has(userId)) {
            roomMap.delete(userId);
            const currentTypingUsers = Array.from(roomMap.values());
            socket.to(channelId).emit("typing_status_changed", {
              channelId,
              typingUsers: currentTypingUsers,
            });
            if (roomMap.size === 0) {
              typingRoomsRegistry.delete(channelId);
            }
          }
        });
      }
      broadcastWorkspacePresence();
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(
    `🚀 Standalone Real-Time Server running smoothly on http://localhost:${PORT}`,
  );
});
