"use server";

import { db } from "@/db";
import { users, accounts, messages } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
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

async function assertAdminSession(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user || session.user.role !== "admin") {
    throw new Error("Unauthorized: Administrative privileges required.");
  }

  return session.user.id;
}

export async function getAdminUsersDirectory({
  queryText = "",
  authProvider = "all",
  emailVerified = "all",
  minMessageCount = 0,
  createdAfter = "",
  pageSize = 2,
  cursor = null,
  direction = "next",
  sortByField = "createdAt",
  sortDirection = "desc",
}: {
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
  await assertAdminSession();

  const conditions: any[] = [];

  // Core Search Filters
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
  if (createdAfter) {
    conditions.push(gte(users.createdAt, new Date(createdAfter)));
  }

  if (minMessageCount > 0) {
    const activeSendersSubquery = db
      .select({ senderId: messages.senderId })
      .from(messages)
      .groupBy(messages.senderId)
      .having(gte(count(messages.id), minMessageCount));
    conditions.push(inArray(users.id, activeSendersSubquery));
  }

  // Count conditions locked
  const countConditions = and(...conditions);
  const [countResult] = await db
    .select({ value: count() })
    .from(users)
    .where(countConditions);
  const totalCount = countResult?.value || 0;

  const isNameSort = sortByField === "name";
  const isEmailSort = sortByField === "email";

  const primarySortColumn = isNameSort
    ? users.name
    : isEmailSort
      ? users.email
      : users.createdAt;

  const goForward = direction === "next";
  const wantDesc = sortDirection === "desc";
  const lookOlder = (goForward && wantDesc) || (!goForward && !wantDesc);

  // 🚀 SECURE: Re-written Cursor logic protecting against template manipulation injection
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
  const currentDirectionDesc = goForward ? wantDesc : !wantDesc;

  // Enforce consistent lowercase mapping matching filter constraints
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

  const hasMore = records.length > pageSize;
  let pageResults = records.slice(0, pageSize);

  if (direction === "prev") {
    pageResults = pageResults.reverse();
  }

  const makeCompoundToken = (userRow: any) => {
    if (!userRow) return null;
    let baselineVal =
      userRow.createdAt instanceof Date
        ? userRow.createdAt.getTime()
        : new Date(userRow.createdAt).getTime();

    if (sortByField === "name") baselineVal = userRow.name || "";
    if (sortByField === "email") baselineVal = userRow.email || "";
    return `${baselineVal}|${userRow.id}`;
  };

  // State mapping calculations modified for dynamic pagination paths
  const nextCursorToken = goForward
    ? hasMore
      ? makeCompoundToken(pageResults[pageResults.length - 1])
      : null
    : cursor
      ? makeCompoundToken(pageResults[pageResults.length - 1])
      : null;

  const prevCursorToken = goForward
    ? cursor
      ? makeCompoundToken(pageResults[0])
      : null
    : hasMore
      ? makeCompoundToken(pageResults[0])
      : null;

  const mappedUsers = pageResults.map((u) => ({
    id: u.id,
    name: u.name || "N/A",
    email: u.email || "N/A",
    emailVerified: u.emailVerified,
    createdAt: u.createdAt
      ? new Date(u.createdAt).toISOString()
      : new Date().toISOString(),
    role: u.role,
  }));

  return {
    users: mappedUsers,
    hasMoreNext: goForward ? hasMore : cursor !== null,
    hasMorePrev: goForward ? cursor !== null : hasMore,
    nextCursorToken,
    prevCursorToken,
    totalCount,
  };
}

export async function toggleUserRoleAdmin(
  targetUserId: string,
  currentRole: string | null,
) {
  const adminUserId = await assertAdminSession();

  if (targetUserId === adminUserId) {
    throw new Error("Blocked: Cannot self demote.");
  }

  const nextRole = currentRole === "admin" ? "user" : "admin";
  await db
    .update(users)
    .set({ role: nextRole, updatedAt: new Date() })
    .where(eq(users.id, targetUserId));

  return { success: true, updatedRole: nextRole };
}

export async function deleteUserAccountAdmin(targetUserId: string) {
  const adminUserId = await assertAdminSession();

  if (targetUserId === adminUserId) {
    throw new Error("Operation Blocked: Self deletion forbidden.");
  }

  await db.delete(users).where(eq(users.id, targetUserId));
  return { success: true };
}
