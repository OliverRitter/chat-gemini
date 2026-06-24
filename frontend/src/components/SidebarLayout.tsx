"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

interface SidebarItem {
  id: string;
  name: string;
  isUser?: boolean;
}

interface SidebarLayoutProps {
  session: any;
  channelsList: SidebarItem[];
  usersList: SidebarItem[];
  activeChannelId: string | null;
  activeRoomTitle: string;
  channelSearchQuery: string;
  userSearchQuery: string;
  onlineUserIds: string[];
  unreadCounts: Record<string, number>;
  setChannelSearchQuery: (val: string) => void;
  setUserSearchQuery: (val: string) => void;
  handleChannelSelect: (ch: SidebarItem) => void;
  handleUserSelect: (usr: SidebarItem) => void;
  handleCreateChannel: () => void;
}

export function SidebarLayout({
  session,
  channelsList,
  usersList,
  activeChannelId,
  activeRoomTitle,
  channelSearchQuery,
  userSearchQuery,
  onlineUserIds,
  unreadCounts,
  setChannelSearchQuery,
  setUserSearchQuery,
  handleChannelSelect,
  handleUserSelect,
  handleCreateChannel,
}: SidebarLayoutProps) {
  return (
    <aside className="w-64 h-full border-r border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between shrink-0 relative">
      <div className="space-y-6 overflow-y-auto flex-1 pr-1">
        <div>
          <h2 className="text-xl font-bold text-white">Workspace</h2>
          <p className="text-xs text-zinc-500 mt-1">
            User: {session.user.name}
          </p>
        </div>

        {/* CHANNELS ACCORDION LAYER */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Channels
            </span>
            <button
              onClick={handleCreateChannel}
              className="text-xs text-blue-500 font-bold hover:underline"
            >
              + New
            </button>
          </div>
          <div className="px-1 mb-3">
            <input
              type="text"
              placeholder="Search public groups..."
              value={channelSearchQuery}
              onChange={(e) => setChannelSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 placeholder-zinc-600 transition-colors mb-2"
            />
          </div>
          <nav className="space-y-1">
            {channelsList.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleChannelSelect(ch)}
                className={`w-full flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-left truncate transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-blue-600 text-white"
                    : "hover:bg-zinc-800 text-zinc-400"
                }`}
              >
                # {ch.name}
              </button>
            ))}
          </nav>
        </div>

        {/* DIRECT MESSAGES ACCORDION LAYER */}
        <div>
          <div className="px-1 mb-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-1.5">
              Find Coworkers
            </label>
            <input
              type="text"
              placeholder="Search name or email..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 placeholder-zinc-600 transition-colors"
            />
          </div>
          <nav className="space-y-1">
            {usersList.map((usr) => {
              const isOnline = onlineUserIds.includes(usr.id);
              const userUnreadCount = unreadCounts[usr.id] || 0;

              return (
                <button
                  key={usr.id}
                  onClick={() => handleUserSelect(usr)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium text-left transition-colors ${
                    activeRoomTitle.includes(usr.name)
                      ? "bg-blue-600 text-white"
                      : "hover:bg-zinc-800 text-zinc-400"
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    <span>👤 {usr.name || "Workspace Member"}</span>
                    {userUnreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                        {userUnreadCount}
                      </span>
                    )}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 border border-zinc-950 transition-colors ml-2 ${
                      isOnline
                        ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                        : "bg-zinc-600"
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-800 mt-auto shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await authClient.signOut();
            if (typeof window !== "undefined") window.location.replace("/");
          }}
          className="w-full text-zinc-400 hover:text-red-400 hover:bg-zinc-900 border-zinc-800 text-xs py-2 h-auto transition-colors"
        >
          Disconnect Session
        </Button>
      </div>
    </aside>
  );
}
