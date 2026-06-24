"use server";

import { db } from "@/db";
import { users, accounts, messages } from "@/db/schema";
import {
  and,
  or,
  ilike,
  lt,
  gt,
  desc,
  asc,
  count,
  eq,
  inArray,
  gte,
} from "drizzle-orm";

export async function getAdminUsersDirectory({
  adminUserId,
  queryText = "",
  authProvider = "all",
  emailVerified = "all",
  minMessageCount = 0,
  createdAfter = "",
  pageSize = 2,
  cursor = null,
  direction = "next",
}: {
  adminUserId: string | undefined | null;
  queryText?: string;
  authProvider?: string;
  emailVerified?: string;
  minMessageCount?: number;
  createdAfter?: string;
  pageSize?: number;
  cursor?: string | null;
  direction?: "next" | "prev";
}) {
  // 🚀 DEFENSIVE INTERCEPTOR GUARD: If user token is missing or loading, return zero logs safely
  if (!adminUserId || typeof adminUserId !== "string" || !adminUserId.trim()) {
    return {
      users: [],
      hasMoreNext: false,
      hasMorePrev: false,
      nextCursorToken: null,
      prevCursorToken: null,
      totalCount: 0,
    };
  }

  // Query database directly to verify privileges
  const requestingAdmin = await db.query.users.findFirst({
    where: eq(users.id, adminUserId),
    columns: { role: true },
  });

  if (!requestingAdmin || requestingAdmin.role !== "admin") {
    throw new Error(
      "Unauthorized: Access Denied. Administrative privileges required.",
    );
  }

  const conditions: any[] = [];

  // Text search filtering (ilike)
  if (queryText.trim()) {
    conditions.push(
      or(
        ilike(users.name, `%${queryText.trim()}%`),
        ilike(users.email, `%${queryText.trim()}%`),
      ),
    );
  }

  // Email status filtering (boolean matching)
  if (emailVerified === "verified") {
    conditions.push(eq(users.emailVerified, true));
  } else if (emailVerified === "unverified") {
    conditions.push(eq(users.emailVerified, false));
  }

  // Cross-table better-auth provider filtering (subquery)
  if (authProvider !== "all") {
    const providerSubquery = db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(eq(accounts.providerId, authProvider));
    conditions.push(inArray(users.id, providerSubquery));
  }

  // Timestamp filtering
  if (createdAfter) {
    conditions.push(gte(users.createdAt, new Date(createdAfter)));
  }

  // Chat activity levels filtering (having count aggregation subquery)
  if (minMessageCount > 0) {
    const activeSendersSubquery = db
      .select({ senderId: messages.senderId })
      .from(messages)
      .groupBy(messages.senderId)
      .having(gte(count(messages.id), minMessageCount));
    conditions.push(inArray(users.id, activeSendersSubquery));
  }

  const countConditions = and(...conditions);
  const [countResult] = await db
    .select({ value: count() })
    .from(users)
    .where(countConditions);
  const totalCount = countResult?.value || 0;

  // Stable bi-directional cursor math boundaries
  if (cursor) {
    const targetDate = new Date(cursor);
    conditions.push(
      direction === "next"
        ? lt(users.createdAt, targetDate)
        : gt(users.createdAt, targetDate),
    );
  }

  const finalConditions = and(...conditions);
  const orderStrategy =
    direction === "next" ? desc(users.createdAt) : asc(users.createdAt);

  const records = await db.query.users.findMany({
    where: finalConditions,
    limit: pageSize + 1,
    orderBy: [orderStrategy],
  });

  let pageResults = records.slice(0, pageSize);
  if (direction === "prev") {
    pageResults = pageResults.reverse();
  }

  const hasMore = records.length > pageSize;
  const mappedUsers = pageResults.map((u) => ({
    id: u.id,
    name: u.name || "N/A",
    email: u.email || "N/A",
    emailVerified: u.emailVerified,
    createdAt: u.createdAt.toISOString(),
    role: u.role,
  }));

  return {
    users: mappedUsers,
    hasMoreNext: direction === "next" ? hasMore : true,
    hasMorePrev: direction === "prev" ? hasMore : cursor !== null,
    nextCursorToken: hasMore
      ? mappedUsers[mappedUsers.length - 1].createdAt
      : null,
    prevCursorToken: cursor
      ? direction === "prev" && !hasMore
        ? null
        : mappedUsers[0]?.createdAt || null
      : null,
    totalCount,
  };
}

export async function toggleUserRoleAdmin(
  adminUserId: string,
  targetUserId: string,
  currentRole: string | null,
) {
  if (!adminUserId) throw new Error("Unauthorized");

  const requestingAdmin = await db.query.users.findFirst({
    where: eq(users.id, adminUserId),
    columns: { role: true },
  });

  if (!requestingAdmin || requestingAdmin.role !== "admin")
    throw new Error("Unauthorized");
  if (targetUserId === adminUserId)
    throw new Error("Blocked: Cannot self demote.");

  const nextRole = currentRole === "admin" ? "user" : "admin";
  await db
    .update(users)
    .set({ role: nextRole, updatedAt: new Date() })
    .where(eq(users.id, targetUserId));
  return { success: true, updatedRole: nextRole };
}

export async function deleteUserAccountAdmin(
  adminUserId: string,
  targetUserId: string,
) {
  // 1. Security check: verify the requester is actually an admin
  const requestingAdmin = await db.query.users.findFirst({
    where: eq(users.id, adminUserId),
    columns: { role: true },
  });

  if (!requestingAdmin || requestingAdmin.role !== "admin") {
    throw new Error("Unauthorized: Administrative privileges required.");
  }

  // 2. Prevent self-deletion
  if (targetUserId === adminUserId) {
    throw new Error(
      "Operation Blocked: You cannot delete your own administrative account.",
    );
  }

  // 3. Execute the atomic deletion (foreign keys will cascade delete related data)
  await db.delete(users).where(eq(users.id, targetUserId));

  return { success: true };
}
