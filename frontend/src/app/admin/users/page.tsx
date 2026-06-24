"use client";

import { useState, useEffect } from "react";
import { getAdminUsersDirectory } from "@/app/actions/admin-actions";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function AdminUsersDirectoryPage() {
  const [userRecords, setUserRecords] = useState<AdminUserRow[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [nextCursorToken, setNextCursorToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  const router = useRouter();
  // 1. Core Data Retrieval Sequence Block
  const executeUsersSearchFetch = async (
    isInitialLoad = true,
    cursorToken: string | null = null,
  ) => {
    setIsLoading(true);
    try {
      const result = await getAdminUsersDirectory({
        queryText: searchFilter,
        cursorTimestamp: cursorToken,
        pageSize: 10,
      });

      if (isInitialLoad) {
        setUserRecords(result.users);
      } else {
        setUserRecords((prev) => [...prev, ...result.users]);
      }
      setNextCursorToken(result.nextCursorToken);
    } catch (err) {
      console.error("Failed executing directory data retrieve:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isPending) return;

    // Check better-auth schema field directly
    if (!session || session.user.role !== "admin") {
      router.replace("/chat");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      executeUsersSearchFetch(true, null);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchFilter]);
  if (isPending) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center text-sm text-zinc-500">
        Verifying administrator parameters...
      </div>
    );
  }

  // Block rendering tree immediately if the role token doesn't match
  if (!session || session.user.role !== "admin") {
    return null;
  }
  // Trigger search refresh when search typing inputs mutate

  return (
    <div className="min-h-screen w-full bg-zinc-900 text-zinc-100 p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Admin Dashboard
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Manage and audit system user directory nodes.
          </p>
        </div>

        {/* CONTROLS FILTERS GRID ROW */}
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Filter users by name or email address..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="flex-1 max-w-md bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
          />
        </div>

        {/* DIRECTORY GRID BLOCK */}
        <div className="border border-zinc-800 bg-zinc-950/40 rounded-lg overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <th className="p-4">User ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Registered On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-sm text-zinc-300">
                {userRecords.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="p-4 font-mono text-xs text-zinc-500 select-all">
                      {user.id}
                    </td>
                    <td className="p-4 font-medium text-white">{user.name}</td>
                    <td className="p-4 text-zinc-400">{user.email}</td>
                    <td className="p-4 text-zinc-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </td>
                  </tr>
                ))}
                {userRecords.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-zinc-600 text-sm"
                    >
                      No registered user accounts found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION CONTROL ACTIONS FOOTER BLOCK */}
        {nextCursorToken && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => executeUsersSearchFetch(false, nextCursorToken)}
              disabled={isLoading}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900 transition-all rounded-md px-4 py-2 text-xs font-semibold tracking-wide disabled:opacity-40 uppercase shrink-0 select-none shadow-md"
            >
              {isLoading ? "Loading parameters..." : "Load More Users"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
