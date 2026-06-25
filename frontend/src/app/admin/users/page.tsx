"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useAdminUsers } from "@/hooks/use-admin-users";
import { AdminFilterPanel } from "@/components/AdminFilterPanel";
import { AdminUserTable } from "@/components/AdminUserTable";

export default function AdminUsersDirectoryPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const { state, actions } = useAdminUsers(session);

  useEffect(() => {
    if (!isPending && (!session || session.user.role !== "admin"))
      router.replace("/chat");
  }, [session, isPending, router]);

  if (isPending || !session || !session.user || session.user.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center space-y-2 text-zinc-500 text-sm">
        🛡️ Verifying parameters...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-900 text-zinc-100 p-8 overflow-y-auto font-sans antialiased select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="text-xs font-semibold text-zinc-400 hover:text-white transition-all bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 flex items-center gap-1.5 shadow-md"
        >
          💬 Return to Chat Workspace
        </button>

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
            {state.totalCount}
          </span>
        </div>

        {/* 🚀 FIXED PROPS MAPPING LAYER PASSING NEW RE-ORDERING TOKENS */}
        <AdminFilterPanel {...state} {...actions} />

        <AdminUserTable
          userRecords={state.userRecords}
          isLoading={state.isLoading}
          isProcessingId={state.isProcessingId}
          session={session}
          handleToggleRoleClick={actions.toggleRole}
          handleDeleteUserClick={actions.deleteUser}
        />

        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/40">
          <button
            type="button"
            onClick={() => actions.fetchUsers(state.cursors.prev, "prev")}
            disabled={
              !state.flags.hasPrev ||
              state.isLoading ||
              state.userRecords.length === 0
            }
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-md text-xs font-semibold disabled:opacity-30 transition-all min-w-[90px] uppercase tracking-wider"
          >
            ◀ Back
          </button>
          <span className="text-xs font-medium text-zinc-600">
            Stable Condition Matrices Workspace Labs
          </span>
          <button
            type="button"
            onClick={() => actions.fetchUsers(state.cursors.next, "next")}
            disabled={
              !state.flags.hasNext ||
              state.isLoading ||
              state.userRecords.length === 0
            }
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-md text-xs font-semibold disabled:opacity-30 transition-all min-w-[90px] uppercase tracking-wider"
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}
