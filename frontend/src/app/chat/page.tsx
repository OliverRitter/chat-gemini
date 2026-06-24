"use client";

import { useState, useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { useSocketSync } from "@/hooks/use-socket-sync";
import { useChatStore } from "@/store/use-chat-store";
import { useNotificationStore } from "@/store/use-notification-store";
import { ChatInputBar } from "@/components/chat-input-bar";
import {
  getDirectoryData,
  createGlobalChannel,
  searchNewUsers,
  searchGlobalChannels, // 🚀 ADDED THIS CRITICAL IMPORT
} from "@/app/actions/user-actions";
import { useDirectorySearch } from "@/hooks/use-directory-search";
import { getOrCreateDirectMessageChannel } from "@/app/actions/dm-actions";
import { Button } from "@/components/ui/button";
import { getChannelMessages } from "@/app/actions/chat-actions";
import { RelativeTime } from "@/components/relative-time";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useWorkspaceScrollAndSync } from "@/hooks/use-workspace-scroll-and-sync";

interface SidebarItem {
  id: string;
  name: string;
  isUser?: boolean;
}
const EMPTY_MESSAGES_ARRAY: any[] = [];

export default function ChatDashboardPage() {
  useSocketSync();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-muted-foreground bg-zinc-900">
        Validating profiles...
      </div>
    );
  }
  if (!session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-muted-foreground bg-zinc-900">
        Access Denied. Please log in.
      </div>
    );
  }

  return <ConnectedWorkspace session={session} />;
}

function ConnectedWorkspace({ session }: { session: any }) {
  const activeChannelId = useChatStore((state) => state.activeChannelId);
  const setActiveChannel = useChatStore((state) => state.setActiveChannel);
  const setInitialMessages = useChatStore((state) => state.setInitialMessages);
  const presenceByChannel = useChatStore((state) => state.presenceByChannel);
  const onlineUserIds = useChatStore(
    (state) => state.onlineUserIds || EMPTY_MESSAGES_ARRAY,
  );

  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

  // const messagesByChannel = useChatStore((state) => state.messagesByChannel);

  const currentRoomOnlineIds = activeChannelId
    ? presenceByChannel[activeChannelId] || []
    : [];

  const currentChannelMessages = useChatStore((state: any) =>
    state.activeChannelId
      ? state.messagesByChannel[state.activeChannelId] || EMPTY_MESSAGES_ARRAY
      : EMPTY_MESSAGES_ARRAY,
  );

  const { unreadCounts, clearUnread } = useNotificationStore();

  const [channelsList, setChannelsList] = useState<SidebarItem[]>([]);
  const [usersList, setUsersList] = useState<SidebarItem[]>([]);
  const [activeRoomTitle, setActiveRoomTitle] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isRoomLoading = useRef<string | null>(null);
  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // 🚀 ATOMIC MUTATION LOCK: Strictly prevents parallel historical over-fetches
  const isFetchingPage = useRef(false);

  useDirectorySearch({
    channelSearchQuery,
    userSearchQuery,
    setChannelsList,
    setUsersList,
  });

  useInfiniteScroll({
    activeChannelId,
    hasMoreMessages,
    currentChannelMessages,
    currentPage,
    setCurrentPage,
    setHasMoreMessages,
    containerRef,
    topSentinelRef,
    isFetchingPage,
  });

  useWorkspaceScrollAndSync({
    session,
    activeChannelId,
    currentChannelMessages,
    setChannelsList,
    setUsersList,
    containerRef,
  });

  const handleChannelSelect = async (channel: SidebarItem) => {
    if (isRoomLoading.current === channel.id) return;
    setActiveChannel(channel.id);
    setActiveRoomTitle(`# ${channel.name}`);
    clearUnread(channel.id);

    // 🚀 FIXED: Reset page counter state and force page 0 boundary caps
    setCurrentPage(0);
    setHasMoreMessages(true);

    try {
      const history = await getChannelMessages(channel.id, 0);
      console.log({ history });
      setInitialMessages(channel.id, history || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserSelect = async (user: SidebarItem) => {
    if (isRoomLoading.current === user.id) return;
    setActiveRoomTitle(`💬 ${user.name}`);

    setCurrentPage(0);
    setHasMoreMessages(true);

    try {
      const sharedChannelId = await getOrCreateDirectMessageChannel(user.id);
      setActiveChannel(sharedChannelId);

      // 🟩 THE LAYOUT CORRECTION:
      // Clear the unread badge using the teammate's user ID, NOT the server room token!
      clearUnread(user.id);

      const history = await getChannelMessages(sharedChannelId, 0);
      setInitialMessages(sharedChannelId, history || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateChannel = async () => {
    const name = prompt("Enter new channel name:");
    if (!name || !name.trim()) return;
    try {
      const newChan = await createGlobalChannel(name.trim());
      setChannelsList((prev) => [...prev, newChan]);
    } catch (err) {
      console.error("Database initialization write failed:", err);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-100 font-sans antialiased">
      {/* SIDEBAR */}
      <aside className="w-64 h-full border-r border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between shrink relative">
        {/* TOP CONTENT WRAPPER */}
        <div className="space-y-6 overflow-y-auto flex-1 pr-1">
          <div>
            <h2 className="text-xl font-bold text-white">Workspace</h2>
            <p className="text-xs text-zinc-500 mt-1">
              User: {session.user.name}
            </p>
          </div>

          {/* CHANNELS LAYER */}
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

            {/* 🛠️ ADDED: HIGH-PERFORMANCE GROUP CHANNELS DIRECTORY SEARCH BAR */}
            <div className="px-1 mb-3">
              <input
                type="text"
                placeholder="Search public groups to join..."
                onChange={async (e) => {
                  const value = e.target.value.trim();
                  if (!value) {
                    // If search is empty, restore only your joined channels list
                    const originalData = await getDirectoryData();
                    setChannelsList(originalData.channels || []);
                    return;
                  }

                  // Dynamic global channel search text-matching over the server
                  const channelResults = await searchGlobalChannels(value);
                  setChannelsList(
                    (channelResults || []).map((ch) => ({
                      id: ch.id,
                      name: ch.name,
                    })),
                  );
                }}
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

          {/* DIRECT MESSAGES LAYER */}

          <div>
            <div className="px-1 mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-1.5">
                Find Coworkers
              </label>
              <input
                type="text"
                placeholder="Search name or email to start a chat..."
                onChange={async (e) => {
                  const value = e.target.value.trim();

                  if (!value) {
                    // 🚀 1. If empty, restore ONLY users you have active message history with
                    const originalData = await getDirectoryData();
                    setUsersList(
                      (originalData.users || []).map((u) => ({
                        id: u.id,
                        name: u.name,
                        isUser: true,
                      })),
                    );
                    return;
                  }

                  // 🚀 2. If typing, dynamically fetch matching users from the whole DB
                  const searchResults = await searchNewUsers(value);
                  setUsersList(
                    (searchResults || []).map((u) => ({
                      id: u.id,
                      name: u.name,
                      isUser: true,
                    })),
                  );
                }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 placeholder-zinc-600 transition-colors"
              />
            </div>

            <nav className="space-y-1">
              {usersList.map((usr: any) => {
                const isRoomActive = activeRoomTitle.includes(usr.name);

                // 🚀 STEP A: Check if this specific user ID is active inside the global online array!
                const isOnline = onlineUserIds.includes(usr.id);

                const userUnreadCount = unreadCounts[usr.id] || 0;

                return (
                  <button
                    key={usr.id}
                    onClick={() => handleUserSelect(usr)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium text-left transition-colors ${
                      isRoomActive
                        ? "bg-blue-600 text-white"
                        : "hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <span className="truncate">
                      👤 {usr.name || "Workspace Member"}
                      {/* 🟩 2. THE VISUAL FIX: If a coworker sent you a message, render the number badge here! */}
                      {userUnreadCount > 0 && (
                        <span className="bg-gray-800 ml-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                          {userUnreadCount}
                        </span>
                      )}
                    </span>

                    {/* 🚀 STEP B: THE VISUAL ANCHOR DOTS
                        Renders glowing green if online, and flat grey if offline! */}
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

        {/* BOTTOM PINNED ACTIONS LAYER */}
        <div className="pt-4 border-t border-zinc-800 mt-auto shrink">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await authClient.signOut();
              if (typeof window !== "undefined") {
                window.location.replace("/");
              }
            }}
            className="w-full text-zinc-400 hover:text-red-400 hover:bg-zinc-900 border-zinc-800 text-xs py-2 h-auto transition-colors"
          >
            Disconnect Session
          </Button>
        </div>
      </aside>

      {/* CHAT DISPLAY BODY CANVAS */}
      <main className="flex-1 h-full flex flex-col min-w-0 bg-zinc-900 relative">
        {activeChannelId ? (
          <>
            <div className="h-14 border-b border-zinc-800 flex items-center px-6 shrink-0 bg-zinc-950">
              <h1 className="font-semibold text-sm tracking-wide text-white truncate">
                {activeRoomTitle}
                {currentRoomOnlineIds.length > 1 ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-zinc-950" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600 border border-zinc-950" />
                )}
              </h1>
            </div>

            {/* SCROLL WINDOW */}
            <div
              ref={containerRef}
              className="flex-1 overflow-y-auto p-6 min-h-0 bg-zinc-900/30 flex flex-col"
            >
              <div className="flex flex-col gap-3 w-full min-w-0 flex-1">
                <div
                  ref={topSentinelRef}
                  className="h-1 w-full opacity-0 pointer-events-none shrink-0"
                />
                {currentChannelMessages.map((msg: any, index: number) => {
                  // 1. Determine if the active user sent the message
                  const isMe = (msg.senderId || msg.userId) === session.user.id;
                  const textContent = msg.text || msg.content || "";

                  // 2. 🚀 THE CRITICAL VARIABLE MAPPER: Falls back safely until a property catches
                  const senderLabel = isMe
                    ? "You"
                    : msg.senderName ||
                      msg.sender?.name ||
                      msg.user?.name ||
                      "Them";

                  return (
                    <div
                      key={msg.id || index}
                      className={`flex flex-col w-full min-w-0 ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`p-3 rounded-2xl text-sm shadow-md max-w-[75%] break-all break-words whitespace-pre-wrap [word-break:break-word] overflow-hidden flex flex-col ${
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700"
                        }`}
                      >
                        {/* Image Attachment check */}
                        {textContent.startsWith("🖼️ Attached Image:") ? (
                          <div className="flex flex-col gap-2">
                            <span className="text-xs opacity-75 italic block mb-1">
                              Sent an image:
                            </span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={textContent
                                .replace("🖼️ Attached Image: ", "")
                                .trim()}
                              alt="Chat attachment"
                              className="rounded-lg max-w-full h-auto max-h-[300px] object-cover border border-black/20 shadow-inner"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          textContent
                        )}
                        <div className="flex justify-between items-center text-gray-100/40 border-t-amber-950/20 border-t mt-2.5">
                          <RelativeTime timestamp={msg.createdAt} />
                          {/* 🚀 FIXED: We must print {senderLabel} here, NOT msg.senderId! */}
                          <span className="text-[10px] ml-6 text-gray-100/40 ">
                            {senderLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-950 w-full">
              <ChatInputBar activeChannelId={activeChannelId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8">
            <span className="text-4xl mb-2">💬</span>
            <p className="text-sm font-medium">
              Select a room to begin live chat updates.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
