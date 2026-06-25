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
  sql,
} from "drizzle-orm";

export async function getAdminUsersDirectory({
  adminUserId,
  queryText = "",
  authProvider = "all",
  emailVerified = "all",
  minMessageCount = 0,
  createdAfter = "",
  pageSize = 2,
  cursor = null, // Compound token format: "value|id"
  direction = "next",
  sortByField = "createdAt",
  sortDirection = "desc",
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
  sortByField?: string;
  sortDirection?: string;
}) {
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

  const requestingAdmin = await db.query.users.findFirst({
    where: eq(users.id, adminUserId),
    columns: { role: true },
  });

  if (!requestingAdmin || requestingAdmin.role !== "admin") {
    throw new Error("Unauthorized: Access Denied.");
  }

  const conditions: any[] = [];

  if (queryText.trim()) {
    conditions.push(
      or(
        ilike(users.name, `%${queryText.trim()}%`),
        ilike(users.email, `%${queryText.trim()}%`),
      ),
    );
  }
  if (emailVerified === "verified")
    conditions.push(eq(users.emailVerified, true));
  if (emailVerified === "unverified")
    conditions.push(eq(users.emailVerified, false));

  if (authProvider !== "all") {
    const providerSubquery = db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(eq(accounts.providerId, authProvider));
    conditions.push(inArray(users.id, providerSubquery));
  }
  if (createdAfter)
    conditions.push(gte(users.createdAt, new Date(createdAfter)));

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

  // 🚀 CHRONOLOGICAL TIE-BREAKER SCHEMAS
  const isNameSort = sortByField === "name";
  const isEmailSort = sortByField === "email";

  // Pure column mappings without pre-applied SQL wrappers
  const primarySortColumn = isNameSort
    ? users.name
    : isEmailSort
      ? users.email
      : users.createdAt;

  // Determine pagination evaluation vector flags
  const goForward = direction === "next";
  const wantDesc = sortDirection === "desc";
  const lookOlder = (goForward && wantDesc) || (!goForward && !wantDesc);

  // 🚀 BULLETPROOF COMPOUND CURSOR GATEWAYS
  if (cursor && cursor.includes("|")) {
    const pipeIndex = cursor.lastIndexOf("|");
    const cursorValueStr = cursor.substring(0, pipeIndex);
    const cursorId = cursor.substring(pipeIndex + 1);

    if (lookOlder) {
      if (isNameSort || isEmailSort) {
        conditions.push(
          or(
            sql`LOWER(${primarySortColumn}) < LOWER(${cursorValueStr})`,
            and(
              sql`LOWER(${primarySortColumn}) = LOWER(${cursorValueStr})`,
              lt(users.id, cursorId),
            ),
          ),
        );
      } else {
        // Safe numerical Unix Epoch parsing
        const cursorDate = new Date(Number(cursorValueStr));
        conditions.push(
          or(
            lt(users.createdAt, cursorDate),
            and(eq(users.createdAt, cursorDate), lt(users.id, cursorId)),
          ),
        );
      }
    } else {
      if (isNameSort || isEmailSort) {
        conditions.push(
          or(
            sql`LOWER(${primarySortColumn}) > LOWER(${cursorValueStr})`,
            and(
              sql`LOWER(${primarySortColumn}) = LOWER(${cursorValueStr})`,
              gt(users.id, cursorId),
            ),
          ),
        );
      } else {
        const cursorDate = new Date(Number(cursorValueStr));
        conditions.push(
          or(
            gt(users.createdAt, cursorDate),
            and(eq(users.createdAt, cursorDate), gt(users.id, cursorId)),
          ),
        );
      }
    }
  }

  const finalConditions = and(...conditions);

  // Calculate deterministic order sequences
  const currentDirectionDesc = goForward ? wantDesc : !wantDesc;
  const finalSortTarget =
    isNameSort || isEmailSort
      ? sql`LOWER(${primarySortColumn})`
      : primarySortColumn;

  const orderStrategy = currentDirectionDesc
    ? [desc(finalSortTarget), desc(users.id)]
    : [asc(finalSortTarget), asc(users.id)];

  const records = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      role: users.role,
    })
    .from(users)
    .where(finalConditions)
    .limit(pageSize + 1)
    .orderBy(...orderStrategy);

  let pageResults = records.slice(0, pageSize);
  if (direction === "prev") {
    pageResults = pageResults.reverse();
  }

  const hasMore = records.length > pageSize;

  // Token assembly built directly from raw db instances before string serialization
  const makeCompoundToken = (userRow: any) => {
    if (!userRow) return null;
    let baselineVal =
      userRow.createdAt instanceof Date
        ? userRow.createdAt.getTime()
        : new Date(userRow.createdAt).getTime();

    if (sortByField === "name") baselineVal = userRow.name;
    if (sortByField === "email") baselineVal = userRow.email;
    return `${baselineVal}|${userRow.id}`;
  };

  const nextCursorToken = hasMore
    ? makeCompoundToken(pageResults[pageResults.length - 1])
    : null;

  const prevCursorToken = cursor
    ? direction === "prev" && !hasMore
      ? null
      : makeCompoundToken(pageResults[0])
    : null;

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
    nextCursorToken,
    prevCursorToken,
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
  if (!adminUserId) throw new Error("Unauthorized");
  const requestingAdmin = await db.query.users.findFirst({
    where: eq(users.id, adminUserId),
    columns: { role: true },
  });
  if (!requestingAdmin || requestingAdmin.role !== "admin")
    throw new Error("Unauthorized: Administrative privileges required.");
  if (targetUserId === adminUserId)
    throw new Error("Operation Blocked: Self deletion forbidden.");
  await db.delete(users).where(eq(users.id, targetUserId));
  return { success: true };
}
