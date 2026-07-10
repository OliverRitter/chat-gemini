"use client";

import { useState, useRef } from "react";
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
  const presenceByChannel = useChatStore((state) => state.presenceByChannel);
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isRoomLoading = useRef<string | null>(null);
  const isFetchingPage = useRef(false);

  const currentRoomOnlineIds = activeChannelId
    ? presenceByChannel[activeChannelId] || EMPTY_MESSAGES_ARRAY
    : EMPTY_MESSAGES_ARRAY;
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

    // If a room is actively loading history data, we stop tracking scroll math entirely.
    if (!container || isRoomLoading.current) return;

    // If your scrollbar is resting at the absolute top ceiling (scrollTop === 0),
    // it means you are reading deep history. Keep the badge out of the way.
    if (container.scrollTop === 0) {
      setIsUserScrolledUp(true); // You are scrolled up into history
      return;
    }

    const distanceToFloor =
      container.scrollHeight - container.clientHeight - container.scrollTop;

    // 🚀 THE BOTTOM CHECKER:
    // If you scroll down and get within 60 pixels of the bottom floor row,
    // it means you are looking at the newest messages. Hide the badge instantly!
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
    try {
      const sharedChannelId = await getOrCreateDirectMessageChannel(user.id);
      const history = await getChannelMessages(sharedChannelId, 0);
      if (isRoomLoading.current === user.id) {
        setActiveRoomTitle(`💬 ${user.name}`);
        setActiveChannel(sharedChannelId);
        clearUnread(user.id);
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
                  className={`h-2.5 w-2.5 rounded-full border border-zinc-950 ml-2 inline-block ${currentRoomOnlineIds.length > 1 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-600"}`}
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

            {/* 🟩 RESTORED: The static action input bar container handles full emoji and media layout states */}
            <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-950 w-full">
              <ChatInputBar activeChannelId={activeChannelId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-900">
            <div className="h-12 w-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 mb-4">
              <span className="text-xl">👋</span>
            </div>
            <h2 className="text-sm font-medium text-zinc-200">
              Welcome to your Workspace
            </h2>
            <p className="text-xs text-zinc-500 max-w-sm mt-1.5 leading-relaxed">
              Select a channel or direct message from the menu bar to begin
              real-time updates.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
