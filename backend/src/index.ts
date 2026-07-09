import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import dotenv from "dotenv";
import { db } from "./db/index.js";
import { eq, sql } from "drizzle-orm";

// 🟩 FIX: Import the entire schema as an object to stop "not defined" ReferenceErrors
import * as schema from "./db/schema.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Standard body parser middleware
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userDeviceRegistry = new Map<string, Set<string>>();
const typingRoomsRegistry = new Map<string, Map<string, string>>();

// Secure Authentication Token Handshake Interceptor
io.use(async (socket: Socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    console.log(
      `🔌 [Handshake] Socket session link attempt from ID: ${socket.id}`,
    );

    if (!token || typeof token !== "string") {
      console.error(
        `❌ [Handshake Error] Rejected ${socket.id}: Token string is missing or malformed.`,
      );
      return next(new Error("Authentication failed: Missing token footprint"));
    }

    // Lookup validation token using the fresh schema binding wrapper
    const sessionResult = await db.query.sessions.findFirst({
      where: eq(schema.sessions.token, token),
    });

    if (!sessionResult) {
      console.error(
        `❌ [Handshake Error] Rejected ${socket.id}: Token key does not exist in sessions database table.`,
      );
      return next(
        new Error("Authentication failed: Expired or unmapped session key"),
      );
    }

    if (new Date() > new Date(sessionResult.expiresAt)) {
      console.error(
        `❌ [Handshake Error] Rejected ${socket.id}: Token found, but it has EXPIRED.`,
      );
      return next(new Error("Authentication failed: Expired session window"));
    }

    const userResult = await db.query.users.findFirst({
      where: eq(schema.users.id, sessionResult.userId),
      columns: { name: true },
    });

    socket.data.userId = sessionResult.userId;
    socket.data.senderName = userResult?.name || "Unknown User";

    console.log(
      `✅ [Handshake Success] Authenticated: "${socket.data.senderName}" (${socket.data.userId})`,
    );
    next();
  } catch (error) {
    console.error(
      "💥 [Handshake Crash] Critical intercept pipeline failure:",
      error,
    );
    next(new Error("Internal Authentication Validation Pipeline Crash"));
  }
});

io.on("connection", async (socket: Socket) => {
  const userId = socket.data.userId as string;
  const senderName = socket.data.senderName as string;

  console.log(
    `📡 [Connection Active] Socket established for: "${senderName}" on line [${socket.id}]`,
  );

  if (!userDeviceRegistry.has(userId)) {
    userDeviceRegistry.set(userId, new Set());
  }
  userDeviceRegistry.get(userId)!.add(socket.id);
  socket.join(userId);

  const getConnectedPartnerIds = async (id: string): Promise<string[]> => {
    try {
      const rawConnectedPartners = await db.execute(
        sql`SELECT DISTINCT user_id as "partnerId" 
          FROM channel_members 
          WHERE channel_id IN (
            SELECT channel_id FROM channel_members WHERE user_id = ${id}
          ) AND user_id != ${id}`,
      );
      return (rawConnectedPartners.rows || []).map((r: any) => r.partnerId);
    } catch (err) {
      console.error("Failed to query partner relations:", err);
      return [];
    }
  };

  const emitPresenceToUser = async (
    targetUserId: string,
    preFetchedPartners?: string[],
  ) => {
    const partners =
      preFetchedPartners || (await getConnectedPartnerIds(targetUserId));
    const globalOnlineUserIds = Array.from(userDeviceRegistry.keys());
    const customOnlineList = globalOnlineUserIds.filter((id) =>
      partners.includes(id),
    );
    io.to(targetUserId).emit("workspace_presence_update", customOnlineList);
  };

  try {
    const myPartners = await getConnectedPartnerIds(userId);
    await emitPresenceToUser(userId, myPartners);

    for (const partnerId of myPartners) {
      if (userDeviceRegistry.has(partnerId)) {
        io.to(partnerId).emit("user_online", { userId });
      }
    }
  } catch (err) {
    console.error(
      "Failed to distribute online status on connection startup:",
      err,
    );
  }

  // CHANNEL MANAGEMENT SUBSCRIBERS
  socket.on("join_channel", (channelId: string) => {
    if (!channelId) return;
    socket.join(channelId);
    console.log(
      `📥 [Room Join] Socket ${socket.id} entered channel: [${channelId}]`,
    );
  });

  socket.on("leave_channel", (channelId: string) => {
    if (!channelId) return;
    socket.leave(channelId);
    console.log(
      `📤 [Room Leave] Socket ${socket.id} exited channel: [${channelId}]`,
    );
  });

  // TYPING SPEED INDICATORS
  socket.on(
    "typing_update",
    (data: { channelId: string; isTyping: boolean }) => {
      try {
        const { channelId, isTyping } = data;
        if (!channelId) return;

        if (!typingRoomsRegistry.has(channelId)) {
          typingRoomsRegistry.set(channelId, new Map());
        }

        const roomMap = typingRoomsRegistry.get(channelId)!;

        if (isTyping) {
          roomMap.set(userId, senderName);
        } else {
          roomMap.delete(userId);
        }

        if (roomMap.size === 0) {
          typingRoomsRegistry.delete(channelId);
        }

        const currentTypingUsers = roomMap ? Array.from(roomMap.values()) : [];

        socket.to(channelId).emit("typing_status_changed", {
          channelId,
          typingUsers: currentTypingUsers,
        });
      } catch (err) {
        console.error("Failed to process typing status update:", err);
      }
    },
  );

  // MESSAGE HUB TRANSIT ROUTER
  // 🟩 SYSTEMATIC FIX: Route channel messages to every member's personal user ID room
  socket.on(
    "send_message",
    async (data: { channelId: string; content: string }) => {
      try {
        const { channelId, content } = data;
        if (!content || !content.trim() || !channelId) return;

        console.log(
          `✉️ [Message Received] Processing content from "${senderName}" for room [${channelId}]`,
        );

        // 1. Save the message to your database
        const [insertedMessage] = await db
          .insert(schema.messages)
          .values({
            channelId: channelId,
            senderId: userId,
            content: content.trim(),
            createdAt: new Date(),
          })
          .returning();

        // 2. Build the exact data payload your frontend hooks expect
        const messagePayload = {
          id: insertedMessage.id,
          channelId: channelId,
          senderId: userId,
          senderName: senderName,
          content: content.trim(),
          createdAt: new Date().toISOString(),
        };

        // 3. Find all user IDs who are members of this specific channel
        console.log(
          `🔍 [Database Lookup] Fetching active members for channel [${channelId}]...`,
        );
        const channelMembersList = await db
          .select({ memberId: schema.channelMembers.userId })
          .from(schema.channelMembers)
          .where(eq(schema.channelMembers.channelId, channelId));

        console.log(
          `📣 [Message Routing] Distributing payload to ${channelMembersList.length} workspace members...`,
        );

        // 4. LOOP through each member and emit directly to their private userId room!
        channelMembersList.forEach((member) => {
          // This hits the user immediately, even if they are sitting in a different chat room!
          io.to(member.memberId).emit("message_received", messagePayload);
        });
      } catch (err) {
        console.error(
          "💥 Message routing pipeline database submission failed:",
          err,
        );
      }
    },
  );

  // CLEANUP ON DISCONNECT
  socket.on("disconnect", async () => {
    console.log(
      `🔌 [Disconnect Event] Connection offline for socket ID: ${socket.id}`,
    );
    const deviceSet = userDeviceRegistry.get(userId);
    if (deviceSet) {
      deviceSet.delete(socket.id);

      if (deviceSet.size === 0) {
        userDeviceRegistry.delete(userId);

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

        try {
          const myPartners = await getConnectedPartnerIds(userId);
          for (const partnerId of myPartners) {
            if (userDeviceRegistry.has(partnerId)) {
              io.to(partnerId).emit("user_offline", { userId });
            }
          }
        } catch (err) {
          console.error("Failed to distribute offline presence alerts:", err);
        }
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
