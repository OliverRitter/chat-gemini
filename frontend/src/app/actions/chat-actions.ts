// src/app/actions/chat-actions.ts
"use server";

import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq, desc } from "drizzle-orm"; // 🛠️ Changed asc to desc to grab freshest history first
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Fetches messages belonging to a channel using high-performance pagination.
 * @param channelId - The targeted room or DM channel UUID
 * @param page - The current pagination tracking slice (defaults to 0 for initial load)
 */
export async function getChannelMessages(channelId: string, page: number = 0) {
  // 1. Guard check: Is the requester logged in?
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  const pageSize = 30; // 🚀 Planned Pagination parameter size config
  const calculatedOffset = page * pageSize;

  // 2. Fetch chunked messages using relational mapping to pull clean usernames
  const dbMessages = await db.query.messages.findMany({
    where: eq(messages.channelId, channelId),
    limit: pageSize,
    offset: calculatedOffset,
    orderBy: [desc(messages.createdAt)], // Grab freshest records first for page calculations
    // 🚀 FIXED: Links directly to your exact schema relation alias 'sender'
    with: {
      sender: {
        columns: {
          name: true,
        },
      },
    },
  });

  // 3. Reverse the array so it reads chronologically from top-to-bottom in the UI canvas,
  // and map cleanly into your frontend structure with human-readable names.
  return dbMessages.reverse().map((msg: any) => ({
    id: msg.id,
    channelId: msg.channelId,
    senderId: msg.senderId,
    senderName: msg.sender?.name || "Unknown User", // 🚀 Populates usernames across history logs!
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  }));
}
