"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  getAdminUsersDirectory,
  toggleUserRoleAdmin,
} from "@/app/actions/admin-actions";
import { AdminUserTable } from "@/components/AdminUserTable";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  role: string | null;
}

export default function AdminUsersDirectoryPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // Core records dataset states
  const [userRecords, setUserRecords] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [cursors, setCursors] = useState<{
    next: string | null;
    prev: string | null;
  }>({ next: null, prev: null });
  const [flags, setFlags] = useState({ hasNext: false, hasPrev: false });

  // Filter Controlled Input Strings
  const [searchFilter, setSearchFilter] = useState("");
  const [authProvider, setAuthProvider] = useState("all");
  const [emailVerified, setEmailVerified] = useState("all");
  const [minMessageCount, setMinMessageCount] = useState(0);
  const [createdAfter, setCreatedAfter] = useState("");

  useEffect(() => {
    if (!isPending && (!session || session.user.role !== "admin")) {
      router.replace("/chat");
    }
  }, [session, isPending, router]);

  // Hook-free plain raw async service data utility method
  const loadPageSlice = async (
    cursor: string | null = null,
    direction: "next" | "prev" = "next",
  ) => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const result = await getAdminUsersDirectory({
        adminUserId: session.user.id,
        queryText: searchFilter,
        authProvider,
        emailVerified,
        minMessageCount,
        createdAfter,
        cursor,
        direction,
        pageSize: 2,
      });

      setUserRecords(result.users);
      setTotalCount(result.totalCount);
      setFlags({ hasNext: result.hasMoreNext, hasPrev: result.hasMorePrev });
      setCursors({
        next: result.nextCursorToken,
        prev: result.prevCursorToken,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id && session?.user?.role === "admin") {
      loadPageSlice(null, "next");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const handleApplyFiltersAction = (e: React.FormEvent) => {
    e.preventDefault();
    loadPageSlice(null, "next");
  };

  const handleToggleRoleClick = async (
    userId: string,
    currentRole: string | null,
  ) => {
    if (isProcessingId || !session?.user?.id) return;
    setIsProcessingId(userId);
    try {
      const result = await toggleUserRoleAdmin(
        session.user.id,
        userId,
        currentRole,
      );
      setUserRecords((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: result.updatedRole } : u,
        ),
      );
    } catch (err) {
      alert("Failed to alter user privileges.");
    } finally {
      setIsProcessingId(null);
    }
  };

  if (isPending || !session || !session.user || session.user.role !== "admin") {
    return (
      <div className="min-h-screen w-screen bg-zinc-900 flex flex-col items-center justify-center space-y-2 text-zinc-500 text-sm select-none">
        <span className="text-xl animate-spin">🛡️</span>
        <span>Verifying admin directory parameters...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-900 text-zinc-100 p-8 overflow-y-auto font-sans antialiased select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 🚀 THE RETURN TO CHAT LINK PANEL ROW */}
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => router.push("/chat")}
            className="text-xs font-semibold text-zinc-400 hover:text-white transition-all bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 flex items-center gap-1.5 shadow-md active:scale-95"
          >
            💬 Return to Chat Workspace
          </button>
        </div>

        {/* HEADER AREA */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Advanced Filter Labs
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Testing Drizzle database queries and sub-queries aggregates.
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-500 font-mono bg-zinc-950 px-4 py-1.5 rounded-lg border border-zinc-800 shadow-inner">
            {totalCount}
          </span>
        </div>

        {/* SEARCH AND FILTER CONTROL PANEL */}
        <form
          onSubmit={handleApplyFiltersAction}
          className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-zinc-400 font-semibold uppercase">
                Text Search
              </label>
              <input
                type="text"
                placeholder="Name or email string..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-zinc-400 font-semibold uppercase">
                Login Provider
              </label>
              <select
                value={authProvider}
                onChange={(e) => setAuthProvider(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
              >
                <option value="all">🌐 All Providers</option>
                <option value="google">📬 Google</option>
                <option value="credential">🔑 Password Login</option>
              </select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-zinc-400 font-semibold uppercase">
                Email Status
              </label>
              <select
                value={emailVerified}
                onChange={(e) => setEmailVerified(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
              >
                <option value="all">📜 All Statuses</option>
                <option value="verified">✅ Verified</option>
                <option value="unverified">❌ Unverified</option>
              </select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-zinc-400 font-semibold uppercase">
                Chat Activity Level
              </label>
              <select
                value={minMessageCount}
                onChange={(e) => setMinMessageCount(Number(e.target.value))}
                className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
              >
                <option value={0}>💬 0+ Messages</option>
                <option value={1}>💬 Sent 1+ Messages</option>
                <option value={5}>🔥 Active (5+ Messages)</option>
                <option value={10}>⚡ Super Active (10+ Messages)</option>
              </select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-zinc-400 font-semibold uppercase">
                Registered Since
              </label>
              <input
                type="date"
                value={createdAfter}
                onChange={(e) => setCreatedAfter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-zinc-900">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded transition-all select-none shadow-md uppercase tracking-wider disabled:opacity-40"
            >
              {isLoading ? "Querying..." : "🔍 Search & Filter Directory"}
            </button>
          </div>
        </form>

        {/* DATA CONTAINER GRID TABLE */}
        <AdminUserTable
          userRecords={userRecords}
          isLoading={isLoading}
          isProcessingId={isProcessingId}
          session={session}
          handleToggleRoleClick={handleToggleRoleClick}
        />

        {/* PAGINATION ACTIONS FOOTER LAYER */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/40">
          <button
            type="button"
            onClick={() => loadPageSlice(cursors.prev, "prev")}
            disabled={!flags.hasPrev || isLoading || userRecords.length === 0}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-md text-xs font-semibold disabled:opacity-30 transition-all min-w-[90px] uppercase tracking-wider select-none"
          >
            ◀ Back
          </button>
          <span className="text-xs font-medium text-zinc-600">
            Stable Condition Matrices Workspace Labs
          </span>
          <button
            type="button"
            onClick={() => loadPageSlice(cursors.next, "next")}
            disabled={!flags.hasNext || isLoading || userRecords.length === 0}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-md text-xs font-semibold disabled:opacity-30 transition-all min-w-[90px] uppercase tracking-wider select-none"
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}
