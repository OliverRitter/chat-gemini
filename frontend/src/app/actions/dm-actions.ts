// src/app/actions/dm-actions.ts
"use server";

import { db } from "@/db";
import { channels, channelMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

export async function getOrCreateDirectMessageChannel(targetUserId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  const currentUserId = session.user.id;

  // 1. Look for an existing hidden 1-to-1 DM channel between these two users
  const existingMembership = await db
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    .innerJoin(channels, eq(channels.id, channelMembers.channelId))
    .where(
      and(
        eq(channels.isGroup, false),
        eq(channelMembers.userId, currentUserId),
      ),
    );

  for (const member of existingMembership) {
    const match = await db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, member.channelId),
        eq(channelMembers.userId, targetUserId),
      ),
    });

    if (match) {
      return match.channelId;
    }
  }

  // 2. 🚀 THE CRITICAL FIX: Set a generic system fallback name string
  // so it never pollutes room titles or sidebar handles!
  const [newChannel] = await db
    .insert(channels)
    .values({
      name: "Direct Message", // 👈 Clean static string label instead of alphanumeric strings!
      isGroup: false,
    })
    .returning();

  // 3. Map BOTH users into the channelMembers junction table
  await db.insert(channelMembers).values([
    { channelId: newChannel.id, userId: currentUserId, role: "member" },
    { channelId: newChannel.id, userId: targetUserId, role: "member" },
  ]);

  return newChannel.id;
}
