"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { useNotificationStore } from "@/store/use-notification-store";
import { ChatInputBar } from "@/components/chat-input-bar";
import { SidebarLayout } from "@/components/SidebarLayout";
import { MessageCanvasLayout } from "@/components/MessageCanvasLayout";
import { useDirectorySearch } from "@/hooks/use-directory-search";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useWorkspaceScrollAndSync } from "@/hooks/use-workspace-scroll-and-sync";
import { getChannelMessages } from "@/app/actions/chat-actions";
import { getOrCreateDirectMessageChannel } from "@/app/actions/dm-actions";
import { createGlobalChannel } from "@/app/actions/user-actions";

interface SidebarItem {
  id: string;
  name: string;
  isUser?: boolean;
}
const EMPTY_MESSAGES_ARRAY: any[] = [];

export function ConnectedWorkspace({ session }: { session: any }) {
  const activeChannelId = useChatStore((state) => state.activeChannelId);
  const setActiveChannel = useChatStore((state) => state.setActiveChannel);
  const setInitialMessages = useChatStore((state) => state.setInitialMessages);
  const messagesByChannel = useChatStore((state) => state.messagesByChannel);
  const onlineUserIds = useChatStore(
    (state) => state.onlineUserIds || EMPTY_MESSAGES_ARRAY,
  );
  const setIsUserScrolledUp = useChatStore(
    (state) => state.setIsUserScrolledUp,
  );

  const clearUnread = useNotificationStore((state) => state.clearUnread);

  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [channelsList, setChannelsList] = useState<SidebarItem[]>([]);
  const [usersList, setUsersList] = useState<SidebarItem[]>([]);
  const [activeRoomTitle, setActiveRoomTitle] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showNewMessageBadge, setShowNewMessageBadge] = useState(false);

  // Track the underlying user target ID if viewing a 1-on-1 Direct Message conversation
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isRoomLoading = useRef<string | null>(null);
  const isFetchingPage = useRef(false);

  const currentChannelMessages = activeChannelId
    ? messagesByChannel[activeChannelId] || EMPTY_MESSAGES_ARRAY
    : EMPTY_MESSAGES_ARRAY;

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
    setShowNewMessageBadge,
  });

  const handleScrollTracking = () => {
    const container = containerRef.current;
    if (!container) return;
    const distanceToFloor =
      container.scrollHeight - container.clientHeight - container.scrollTop;
    if (distanceToFloor <= 60) {
      setShowNewMessageBadge(false);
      setIsUserScrolledUp(false);
    } else if (distanceToFloor > 200) {
      setIsUserScrolledUp(true);
    }
  };

  const scrollToBottomViewport = () => {
    if (!containerRef.current) return;
    setShowNewMessageBadge(false);
    setIsUserScrolledUp(false);
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const handleChannelSelect = async (channel: SidebarItem) => {
    if (isRoomLoading.current === channel.id) return;
    isRoomLoading.current = channel.id;
    setCurrentPage(0);
    setHasMoreMessages(true);
    setShowNewMessageBadge(false);
    setIsUserScrolledUp(false);
    setActivePartnerId(null); // Not a direct message room
    try {
      const history = await getChannelMessages(channel.id, 0);
      if (isRoomLoading.current === channel.id) {
        setActiveChannel(channel.id);
        setActiveRoomTitle(`# ${channel.name}`);
        clearUnread(channel.id);
        setInitialMessages(channel.id, history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isRoomLoading.current === channel.id) isRoomLoading.current = null;
    }
  };

  const handleUserSelect = async (user: SidebarItem) => {
    if (isRoomLoading.current === user.id) return;
    isRoomLoading.current = user.id;
    setCurrentPage(0);
    setHasMoreMessages(true);
    setShowNewMessageBadge(false);
    setIsUserScrolledUp(false);
    setActivePartnerId(user.id); // Track partner to calculate presence
    try {
      const sharedChannelId = await getOrCreateDirectMessageChannel(user.id);
      const history = await getChannelMessages(sharedChannelId, 0);
      if (isRoomLoading.current === user.id) {
        setActiveRoomTitle(`💬 ${user.name}`);
        setActiveChannel(sharedChannelId);
        clearUnread(sharedChannelId); // 🟩 FIXED: Clear by the channel ID, matching your socket store structure!
        setInitialMessages(sharedChannelId, history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isRoomLoading.current === user.id) isRoomLoading.current = null;
    }
  };

  const handleCreateChannel = async () => {
    const name = prompt("Enter new channel name:");
    if (!name || !name.trim()) return;
    try {
      const newChan = await createGlobalChannel(name.trim());
      setChannelsList((prev) => [...prev, newChan]);
    } catch (err) {
      console.error(err);
    }
  };

  // Determine if the header dot should be illuminated green
  // If it's a DM, check if your partner is online. If it's a regular room, default it to active.
  const isTargetRoomActive = activePartnerId
    ? onlineUserIds.includes(activePartnerId)
    : true;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-900 text-zinc-100 font-sans antialiased">
      <SidebarLayout
        session={session}
        channelsList={channelsList}
        usersList={usersList}
        activeChannelId={activeChannelId}
        activeRoomTitle={activeRoomTitle}
        channelSearchQuery={channelSearchQuery}
        userSearchQuery={userSearchQuery}
        onlineUserIds={onlineUserIds}
        setChannelSearchQuery={setChannelSearchQuery}
        setUserSearchQuery={setUserSearchQuery}
        handleChannelSelect={handleChannelSelect}
        handleUserSelect={handleUserSelect}
        handleCreateChannel={handleCreateChannel}
      />

      <main className="flex-1 h-full flex flex-col min-w-0 bg-zinc-900 relative">
        {activeChannelId ? (
          <>
            <div className="h-14 border-b border-zinc-800 flex items-center px-6 shrink-0 bg-zinc-950">
              <h1 className="font-semibold text-sm tracking-wide text-white truncate flex items-center">
                {activeRoomTitle}
                <span
                  className={`h-2.5 w-2.5 rounded-full border border-zinc-950 ml-2 inline-block ${
                    isTargetRoomActive
                      ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                      : "bg-zinc-600"
                  }`}
                />
              </h1>
            </div>

            <MessageCanvasLayout
              containerRef={containerRef}
              topSentinelRef={topSentinelRef}
              currentChannelMessages={currentChannelMessages}
              session={session}
              showNewMessageBadge={showNewMessageBadge}
              scrollToBottomViewport={scrollToBottomViewport}
              handleScrollTracking={handleScrollTracking}
              hasMoreMessages={hasMoreMessages}
              activeChannelId={activeChannelId}
            />

            <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-950 w-full">
              <ChatInputBar activeChannelId={activeChannelId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-900">
            <div className="h-12 w-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 mb-4">
              <span className="text-xl">👋</span>
            </div>
            <h2 className="text-lg font-medium text-white mb-1">
              No Active Chat
            </h2>
            <p className="text-sm text-zinc-400 max-w-sm">
              Select a channel or direct message from the sidebar workspace
              directory to start communicating with your team.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
