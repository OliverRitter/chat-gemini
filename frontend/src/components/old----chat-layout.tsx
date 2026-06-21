"use client";

import { useChatStore } from "@/store/use-chat-store";
import { useNotificationStore } from "@/store/use-notification-store";
import { ChatInputBar } from "@/components/chat-input-bar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { renderContentTextOrMedia } from "@/lib/render-media";

export function ChatLayout({
  session,
  channelsList,
  usersList,
  activeRoomTitle,
  currentChannelMessages,
  currentRoomOnlineIds,
  containerRef,
  topSentinelRef,
  onChannelSelect,
  onUserSelect,
  onCreateChannel,
  onSearchChannels,
  onSearchUsers,
}: any) {
  const activeChannelId = useChatStore((state) => state.activeChannelId);
  const onlineUserIds = useChatStore((state) => state.onlineUserIds || []);
  const { unreadCounts } = useNotificationStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-100 antialiased">
      <aside className="w-64 h-full border-r border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between shrink-0 relative">
        <div className="space-y-6 overflow-y-auto flex-1 pr-1">
          <div>
            <h2 className="text-xl font-bold text-white">Workspace</h2>
            <p className="text-xs text-zinc-500 mt-1">
              User: {session.user.name}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold uppercase text-zinc-500">
                Channels
              </span>
              <button
                onClick={onCreateChannel}
                className="text-xs text-blue-500 font-bold hover:underline"
              >
                + New
              </button>
            </div>
            <input
              type="text"
              placeholder="Search public groups..."
              onChange={(e) => onSearchChannels(e.target.value.trim())}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none mb-2"
            />
            <nav className="space-y-1">
              {channelsList.map((ch: any) => (
                <button
                  key={ch.id}
                  onClick={() => onChannelSelect(ch)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium text-left truncate transition-colors ${activeChannelId === ch.id ? "bg-blue-600 text-white" : "hover:bg-zinc-800 text-zinc-400"}`}
                >
                  <span className="truncate"># {ch.name}</span>
                  {(unreadCounts[ch.id] || 0) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full font-bold">
                      !
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div>
            <div className="px-1 mb-3">
              <label className="text-xs font-semibold uppercase text-zinc-500 block mb-1.5">
                Find Coworkers
              </label>
              <input
                type="text"
                placeholder="Search name or email..."
                onChange={(e) => onSearchUsers(e.target.value.trim())}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
            <nav className="space-y-1">
              {usersList.map((usr: any) => (
                <button
                  key={usr.id}
                  onClick={() => onUserSelect(usr)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium text-left transition-colors ${activeRoomTitle.includes(usr.name) ? "bg-blue-600 text-white" : "hover:bg-zinc-800 text-zinc-400"}`}
                >
                  <span className="truncate">👤 {usr.name || "Member"}</span>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 border border-zinc-950 ml-2 ${onlineUserIds.includes(usr.id) ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-zinc-600"}`}
                  />
                </button>
              ))}
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
            className="w-full text-zinc-400 hover:text-red-400 hover:bg-zinc-900 border-zinc-800 text-xs py-2 h-auto"
          >
            Disconnect Session
          </Button>
        </div>
      </aside>

      <main className="flex-1 h-full flex flex-col min-w-0 bg-zinc-900 relative">
        {activeChannelId ? (
          <>
            <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 bg-zinc-950">
              <h1 className="font-semibold text-sm tracking-wide text-white flex items-center gap-2 truncate">
                <span>{activeRoomTitle}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full border border-zinc-950 ${currentRoomOnlineIds.length > 0 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-600"}`}
                />
              </h1>
            </div>
            <div
              ref={containerRef}
              className="flex-1 overflow-y-auto p-6 min-h-0 bg-zinc-900/30 flex flex-col"
            >
              <div className="flex flex-col gap-3 w-full min-w-0 flex-1">
                <div
                  ref={topSentinelRef}
                  className="h-1 w-full opacity-0 pointer-events-none shrink-0"
                />
                {currentChannelMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className="flex flex-col bg-zinc-950/40 border border-zinc-800/60 rounded-lg p-3 max-w-xl self-start"
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold text-zinc-300">
                        {msg.senderName || "User"}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    {renderContentTextOrMedia(msg.content)}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 shrink-0">
              <ChatInputBar channelId={activeChannelId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-sm gap-2">
            <p>💬 No Active Chat Selected</p>
            <p className="text-xs text-zinc-600">
              Choose a channel or user in the sidebar to begin chatting.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
