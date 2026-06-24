// src/app/actions/dm-actions.ts
"use server";

import { db } from "@/db";
import { channels, channelMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm"; // 🚀 Imported inArray

export async function getOrCreateDirectMessageChannel(targetUserId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  const currentUserId = session.user.id;

  if (currentUserId === targetUserId) {
    throw new Error("Operation blocked: You cannot create a DM with yourself.");
  }

  // 1. 🌟 THE NATURAL SUBQUERY
  // We prepare a subquery to select all private channel IDs where YOU are a member
  // const myPrivateChannelsSubquery = db
  //   .select({ channelId: channelMembers.channelId })
  //   .from(channelMembers)
  //   .innerJoin(channels, eq(channels.id, channelMembers.channelId))
  //   .where(
  //     and(
  //       eq(channels.isGroup, false),
  //       eq(channelMembers.userId, currentUserId), // Filter by your ID
  //     ),
  //   ); // Notice there is no 'await' here! It's an unexecuted query object.

  // 2. 🌟 THE MAIN QUERY
  // Find a row where the coworker is a member, but ONLY inside your private channel list
  const [existingChannel] = await db
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    // 1. Join channels on the OUTER query to protect the final result
    .innerJoin(channels, eq(channels.id, channelMembers.channelId))
    .where(
      and(
        eq(channels.isGroup, false), // 👈 Crucial safety check moved here!
        eq(channelMembers.userId, targetUserId), // Outer filter checks for coworker
        inArray(
          channelMembers.channelId,
          db
            .select({ channelId: channelMembers.channelId })
            .from(channelMembers)
            .where(eq(channelMembers.userId, currentUserId)), // Inner query simply gets all your rooms
        ),
      ),
    )
    .limit(1);

  if (existingChannel) {
    return existingChannel.channelId;
  }

  // 3. Fallback: Create a clean channel if nothing was found
  const [newChannel] = await db
    .insert(channels)
    .values({
      name: "Direct Message",
      isGroup: false,
    })
    .returning();

  // 4. Map both users into the junction table
  await db.insert(channelMembers).values([
    {
      channelId: newChannel.id,
      userId: currentUserId,
      role: "member" as const,
    },
    { channelId: newChannel.id, userId: targetUserId, role: "member" as const },
  ]);

  return newChannel.id;
}
