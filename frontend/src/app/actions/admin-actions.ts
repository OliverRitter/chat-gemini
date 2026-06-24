"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, or, ilike, lt, desc } from "drizzle-orm";

export async function getAdminUsersDirectory({
  queryText = "",
  pageSize = 10,
  cursorTimestamp, // Older users loaded via their createdAt ISO string cursor token
}: {
  queryText?: string;
  pageSize?: number;
  cursorTimestamp?: string | null;
}) {
  // 1. Session verification check
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");
  if (session.user.role !== "admin") {
    throw new Error(
      "Forbidden: Access Denied. Administrative privileges required.",
    );
  }

  // Optional: If your session object tracks roles, check for admin here
  // if (session.user.role !== "admin") throw new Error("Forbidden");

  // 2. Build up search text match criteria filters
  const searchFilter = queryText.trim()
    ? or(
        ilike(users.name, `%${queryText.trim()}%`),
        ilike(users.email, `%${queryText.trim()}%`),
      )
    : undefined;

  // 3. Build up cursor baseline constraints (Grab records created before the token)
  const cursorFilter = cursorTimestamp
    ? lt(users.createdAt, new Date(cursorTimestamp))
    : undefined;

  // Combine filters together dynamically
  const combinedConditions = and(searchFilter, cursorFilter);

  // 4. Run the database selection query
  const records = await db.query.users.findMany({
    where: combinedConditions,
    limit: pageSize + 1, // Fetch an extra record to determine if there is a next page
    orderBy: [desc(users.createdAt)],
  });

  const hasNextPage = records.length > pageSize;
  const pageResults = hasNextPage ? records.slice(0, pageSize) : records;

  // Calculate next page token
  const nextCursorToken = hasNextPage
    ? pageResults[pageResults.length - 1].createdAt.toISOString()
    : null;

  return {
    users: pageResults.map((u) => ({
      id: u.id,
      name: u.name || "N/A",
      email: u.email || "N/A",
      createdAt: u.createdAt.toISOString(),
    })),
    nextCursorToken,
  };
}
