"use client";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  role: string | null;
}

interface AdminUserTableProps {
  userRecords: AdminUserRow[];
  isLoading: boolean;
  isProcessingId: string | null;
  session: any;
  handleToggleRoleClick: (userId: string, currentRole: string | null) => void;
  handleDeleteUserClick: (userId: string) => void; // 🚀 ADDED PROP METHOD
}

export function AdminUserTable({
  userRecords,
  isLoading,
  isProcessingId,
  session,
  handleToggleRoleClick,
  handleDeleteUserClick, // 🚀 READ PROP HERE
}: AdminUserTableProps) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/40 rounded-lg overflow-x-auto shadow-xl">
      <table className="w-full text-left min-w-[700px]">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <th className="p-4">User ID</th>
            <th className="p-4">Profile Metadata</th>
            <th className="p-4">Verification</th>
            <th className="p-4">Privileges</th>
            <th className="p-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 text-sm text-zinc-300">
          {userRecords.map((user) => (
            <tr
              key={user.id}
              className="hover:bg-zinc-900/50 transition-colors h-16"
            >
              <td className="p-4 font-mono text-xs text-zinc-500 select-all">
                {user.id}
              </td>
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="font-medium text-white">{user.name}</span>
                  <span className="text-xs text-zinc-500">{user.email}</span>
                </div>
              </td>
              <td className="p-4">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.emailVerified ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"}`}
                >
                  {user.emailVerified ? "VERIFIED" : "PENDING"}
                </span>
              </td>
              <td className="p-4">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${user.role === "admin" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-zinc-800 text-zinc-400"}`}
                >
                  {user.role === "admin" ? "🛡️ Admin" : "👤 User"}
                </span>
              </td>
              <td className="p-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleRoleClick(user.id, user.role)}
                    disabled={
                      isProcessingId !== null || user.id === session.user.id
                    }
                    className={`text-xs font-bold px-3 py-1.5 rounded transition-all min-w-[100px] uppercase tracking-wider ${user.id === session.user.id ? "bg-zinc-900 text-zinc-600 border border-zinc-800/40 cursor-not-allowed shadow-none" : user.role === "admin" ? "bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-zinc-800" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
                  >
                    {isProcessingId === user.id
                      ? "Writing..."
                      : user.role === "admin"
                        ? "Demote"
                        : "Promote"}
                  </button>

                  {/* 🚀 NEW DELETE BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleDeleteUserClick(user.id)}
                    disabled={
                      isProcessingId !== null || user.id === session.user.id
                    }
                    className={`text-xs font-bold px-3 py-1.5 rounded transition-all uppercase tracking-wider ${user.id === session.user.id ? "bg-zinc-900 text-zinc-600 border border-zinc-800/40 cursor-not-allowed shadow-none" : "bg-red-950/40 hover:bg-red-900 text-red-400 border border-red-900/30"}`}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {userRecords.length === 0 && !isLoading && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-zinc-600 text-sm">
                No accounts found matching criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
