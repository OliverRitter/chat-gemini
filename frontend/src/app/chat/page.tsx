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

import { getOrCreateDirectMessageChannel } from "@/app/actions/dm-actions";
import { Button } from "@/components/ui/button";
import { getChannelMessages } from "@/app/actions/chat-actions";

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

  // Inside function ConnectedWorkspace({ session }) inside src/app/chat/page.tsx:

  // 🚀 TRUE CONCURRENT THROTTLE FLAG: Prevents overlapping network calls
  // const isFetchingHistory = useRef(false);
  const isRoomLoading = useRef<string | null>(null);

  // Inside function ConnectedWorkspace({ session }) { ... in src/app/chat/page.tsx

  // 🚀 ATOMIC MUTATION LOCK: Strictly prevents parallel historical over-fetches
  const isFetchingPage = useRef(false);

  useEffect(() => {
    // Guard Clause: Block observation loops if we run out of database rows or are loading a new room
    if (
      !activeChannelId ||
      !hasMoreMessages ||
      currentChannelMessages.length === 0
    )
      return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const firstEntry = entries[0];
        const container = containerRef.current;

        // 🚀 THE SENIOR-GRADE BOUNDARY GATEWAY:
        // Trigger execution only if the element is 100% visible AND no other fetch is currently running!
        if (firstEntry.isIntersecting && container && !isFetchingPage.current) {
          isFetchingPage.current = true; // Engage atomic lock instantly
          const nextPage = currentPage + 1;

          try {
            // Cache the layout height measurement to protect active anchor lines
            const previousScrollHeight = container.scrollHeight;

            const olderHistory = await getChannelMessages(
              activeChannelId,
              nextPage,
            );

            if (olderHistory && olderHistory.length > 0) {
              // Prepend old history blocks down into your Zustand memory frame
              useChatStore
                .getState()
                .prependHistoricalMessages(activeChannelId, olderHistory);
              setCurrentPage(nextPage);

              // Stabilize reader position so content doesn't snap down violently
              setTimeout(() => {
                container.scrollTop =
                  container.scrollHeight - previousScrollHeight;
                isFetchingPage.current = false; // Release lock safely on layout shift complete
              }, 10);
            } else {
              setHasMoreMessages(false); // No records left in Postgres, shut down tracking
              isFetchingPage.current = false;
            }
          } catch (err) {
            console.error("Failed to load paginated history logs:", err);
            isFetchingPage.current = false;
          }
        }
      },
      {
        root: containerRef.current,
        threshold: 1.0, // Requires the entire height of the sentinel to cross into view
      },
    );

    const currentSentinel = topSentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) observer.unobserve(currentSentinel);
    };
  }, [
    activeChannelId,
    currentPage,
    hasMoreMessages,
    currentChannelMessages.length,
  ]);

  useEffect(() => {
    async function loadWorkspaceData() {
      try {
        const data = await getDirectoryData();

        // 1. Set the channels list safely
        setChannelsList(data.channels || []);

        // 🚀 THE FINAL BUG FIX:
        // Do not use the manual .map((u) => ...) loop here anymore!
        // Passing the server data array directly guarantees that your freshly
        // sanitized, clean usernames are saved into state without getting overwritten.
        setUsersList(data.users || []);
      } catch (err) {
        console.error(
          "Critical sidebar workspace initialization failure:",
          err,
        );
      }
    }
    loadWorkspaceData();
  }, []);

  // Instant scroll snap down on every incoming text layout shift
  // Look for this exact useEffect block inside src/app/chat/page.tsx:
  useEffect(() => {
    const container = containerRef.current;
    if (!container || currentChannelMessages.length === 0) return;

    // 1. GRAVITY ZONE CHECK: Determine if reader is lingering near the bottom (within 400px)
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isUserAtBottom = distanceFromBottom <= 400;

    // 2. CHECK THE SENDER: Did the current profile user type the latest message?
    const latestMessage =
      currentChannelMessages[currentChannelMessages.length - 1];
    const amISender =
      (latestMessage?.senderId || latestMessage?.userId) === session.user.id;

    // 3. EXECUTE SMOOTH ALIGNMENT: Smooth scroll down if you sent it OR if you're actively following live chat at the bottom
    if (amISender || isUserAtBottom) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth", // Enforces a beautiful, hardware-accelerated glide animation
      });
    }
    // Otherwise, the user is high up reading logs, so their screen stays perfectly frozen!
  }, [currentChannelMessages.length, activeChannelId, session.user.id]);

  const handleChannelSelect = async (channel: SidebarItem) => {
    if (isRoomLoading.current === channel.id) return;
    setActiveChannel(channel.id);
    setActiveRoomTitle(`# ${channel.name}`);
    clearUnread(channel.id);

    // 🚀 FIXED: Reset page counter state and force page 0 boundary caps
    setCurrentPage(0);
    setHasMoreMessages(true);

    try {
      const history = await getChannelMessages(channel.id, 0); // 👈 Explicitly fetch ONLY freshest 30 messages
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

  // Inside your function ConnectedWorkspace({ session }) { ...

  // 🔑 PASTE THIS EXTRACTED CODE BLOCK HERE TO RESTORE THE FUNCTION:
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

  // ... Your existing handleChannelSelect and handleUserSelect code continues right below ...

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-100 font-sans antialiased">
      {/* SIDEBAR */}
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 h-full border-r border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between shrink-0 relative">
        {/* TOP CONTENT WRAPPER */}
        <div className="space-y-6 overflow-y-auto flex-1 pr-1">
          <div>
            <h2 className="text-xl font-bold text-white">Workspace</h2>
            <p className="text-xs text-zinc-500 mt-1">
              User: {session.user.name}
            </p>
          </div>

          {/* CHANNELS LAYER WITH RESTORED CREATION TRIGGER */}
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
          {/* 🛠️ ADDED: HIGH-PERFORMANCE USER DIRECTORY SEARCH LAYER */}

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
                console.log({ userUnreadCount });
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
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
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
        <div className="pt-4 border-t border-zinc-800 mt-auto shrink-0">
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
                      {/* 🚀 FIXED: We must print {senderLabel} here, NOT msg.senderId! */}
                      <span className="text-[10px] text-zinc-500 mb-0.5 px-1">
                        {senderLabel}
                      </span>

                      <div
                        className={`p-3 rounded-2xl text-sm shadow-md max-w-[75%] break-all break-words whitespace-pre-wrap [word-break:break-word] overflow-hidden ${
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
