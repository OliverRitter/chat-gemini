// src/app/actions/user-actions.ts
"use server";

import { db } from "@/db";
import { users, channels, channelMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ne, eq, desc, and, or, ilike, inArray } from "drizzle-orm";

/**
 * 1. SIDEBAR WORKSPACE LOADING
 * Fetches ONLY public groups you have joined, and ONLY users you share a private DM channel with.
 */
export async function getDirectoryData() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  const currentUserId = session.user.id;

  // A. 🚀 OPTIMIZED: Fetch ONLY public group channels that the current user has joined
  const myJoinedChannels = await db
    .select({
      id: channels.id,
      name: channels.name,
      isGroup: channels.isGroup,
    })
    .from(channels)
    .innerJoin(channelMembers, eq(channelMembers.channelId, channels.id))
    .where(
      and(eq(channels.isGroup, true), eq(channelMembers.userId, currentUserId)),
    )
    .orderBy(desc(channels.name));

  // B. Find all private 1-to-1 DM channel IDs you belong to
  const myPrivateMemberships = await db
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    .innerJoin(channels, eq(channels.id, channelMembers.channelId))
    .where(
      and(
        eq(channels.isGroup, false),
        eq(channelMembers.userId, currentUserId),
      ),
    );

  const privateChannelIds = myPrivateMemberships.map((m) => m.channelId);

  let conversationPartners: any[] = [];

  if (privateChannelIds.length > 0) {
    // C. Grab the exact profiles of the other participants inside those exact same DM channels
    conversationPartners = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .innerJoin(channelMembers, eq(channelMembers.userId, users.id))
      .where(
        and(
          inArray(channelMembers.channelId, privateChannelIds),
          ne(users.id, currentUserId),
        ),
      );
  }

  // Fallback: If you have zero active chats yet, show the first 5 workspace members
  if (conversationPartners.length === 0) {
    conversationPartners = await db.query.users.findMany({
      where: ne(users.id, currentUserId),
      columns: { id: true, name: true, email: true },
      limit: 5,
    });
  }

  // D. Sanitize and format name outputs nicely
  const cleanedUsers = conversationPartners.map((u) => {
    let cleanName = u.name ? u.name.trim() : "";

    const isNameAnIdOrChannel =
      !cleanName ||
      cleanName === u.id ||
      cleanName.startsWith("#") ||
      cleanName.toLowerCase().includes("dm-") ||
      cleanName.length > 20 ||
      /^[a-zA-Z0-9_\-]+$/.test(cleanName);

    // 🚀 FIXED EMAIL STRING PROCESSING
    if (isNameAnIdOrChannel && u.email) {
      const emailPrefix = u.email.split("@")[0]; // ✅ Fixed array indexing
      cleanName = emailPrefix
        .split(/[._-]/)
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    return {
      id: u.id,
      name: cleanName || "Workspace Member",
    };
  });

  return {
    users: cleanedUsers,
    channels: myJoinedChannels, // 🚀 Returns only your active joined groups!
  };
}

/**
 * 2. EXPLICIT GLOBAL DIRECTORY SEARCH (For Coworkers)
 */
export async function searchNewUsers(queryText: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");
  if (!queryText || !queryText.trim()) return [];

  const searchedUsers = await db.query.users.findMany({
    where: and(
      ne(users.id, session.user.id),
      or(
        ilike(users.name, `%${queryText.trim()}%`),
        ilike(users.email, `%${queryText.trim()}%`),
      ),
    ),
    columns: { id: true, name: true, email: true },
    limit: 15,
  });

  return searchedUsers.map((u) => {
    let cleanName = u.name ? u.name.trim() : "";

    const isNameAnIdOrChannel =
      !cleanName ||
      cleanName === u.id ||
      cleanName.startsWith("#") ||
      cleanName.toLowerCase().includes("dm-") ||
      cleanName.length > 20 ||
      /^[a-zA-Z0-9_\-]+$/.test(cleanName);

    if (isNameAnIdOrChannel && u.email) {
      const emailPrefix = u.email.split("@")[0];
      cleanName = emailPrefix
        .split(/[._-]/)
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    return {
      id: u.id,
      name: cleanName || "Workspace Member",
    };
  });
}

/**
 * 3. EXPLICIT GLOBAL CHANNELS SEARCH (New Function!)
 * Lets you search through all global groups so you can discover and join them.
 */
export async function searchGlobalChannels(queryText: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");
  if (!queryText || !queryText.trim()) return [];

  return await db.query.channels.findMany({
    where: and(
      eq(channels.isGroup, true),
      ilike(channels.name, `%${queryText.trim()}%`),
    ),
    columns: { id: true, name: true, isGroup: true },
    limit: 10,
  });
}

/**
 * 4. PUBLIC CHANNEL CREATION
 * Automatically joins the creator into the new channel's junction member grid.
 */
export async function createGlobalChannel(name: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  // A. Create the group row
  const [newChannel] = await db
    .insert(channels)
    .values({
      name: name,
      isGroup: true,
    })
    .returning();

  // B. 🚀 Automatically map the creator as an admin member so it renders on their sidebar instantly
  await db.insert(channelMembers).values({
    channelId: newChannel.id,
    userId: session.user.id,
    role: "admin",
  });

  return { id: newChannel.id, name: newChannel.name };
}

// src/app/actions/chat-actions.ts
export async function getChannelMessages(channelId: string, page: number = 0) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  const pageSize = 30;
  const calculatedOffset = page * pageSize;

  const history = await db.query.messages.findMany({
    where: eq(messages.channelId, channelId),
    orderBy: [desc(messages.createdAt)],
    limit: pageSize,
    offset: calculatedOffset,
    // 🚀 THE FIX: Tell Drizzle to fetch the linked sender user record
    with: {
      user: {
        columns: {
          name: true,
        },
      },
    },
  });

  // Map database entries cleanly to match frontend property specifications
  return history.reverse().map((msg: any) => ({
    id: msg.id,
    channelId: msg.channelId,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
    // 🚀 Extract the clean username string from the joined relation record
    senderName: msg.user?.name || "Unknown User",
  }));
}
