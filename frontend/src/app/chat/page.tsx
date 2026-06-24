"use client";

import { useState, useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { useSocketSync } from "@/hooks/use-socket-sync";
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

export default function ChatDashboardPage() {
  useSocketSync();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-zinc-500 bg-zinc-900">
        Validating user profiles...
      </div>
    );
  }
  if (!session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-zinc-500 bg-zinc-900">
        Access Denied. Please log in.
      </div>
    );
  }

  return <ConnectedWorkspace session={session} />;
}

function ConnectedWorkspace({ session }: { session: any }) {
  // Zustand State hooks
  const activeChannelId = useChatStore((state) => state.activeChannelId);
  const setActiveChannel = useChatStore((state) => state.setActiveChannel);
  const setInitialMessages = useChatStore((state) => state.setInitialMessages);
  const presenceByChannel = useChatStore((state) => state.presenceByChannel);
  const messagesByChannel = useChatStore((state) => state.messagesByChannel);
  const onlineUserIds = useChatStore(
    (state) => state.onlineUserIds || EMPTY_MESSAGES_ARRAY,
  );

  // Zustand Store flags added for safe scroll monitoring
  const setIsUserScrolledUp = useChatStore(
    (state) => state.setIsUserScrolledUp,
  );

  const { unreadCounts, clearUnread } = useNotificationStore();

  // Local React UI State variables
  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [channelsList, setChannelsList] = useState<SidebarItem[]>([]);
  const [usersList, setUsersList] = useState<SidebarItem[]>([]);
  const [activeRoomTitle, setActiveRoomTitle] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showNewMessageBadge, setShowNewMessageBadge] = useState(false);

  // Element reference wrappers
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isRoomLoading = useRef<string | null>(null);
  const isFetchingPage = useRef(false);

  const currentRoomOnlineIds = activeChannelId
    ? presenceByChannel[activeChannelId] || []
    : [];
  const currentChannelMessages = activeChannelId
    ? messagesByChannel[activeChannelId] || EMPTY_MESSAGES_ARRAY
    : EMPTY_MESSAGES_ARRAY;

  // Custom Extracted Hooks Matrix Wiring
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

  // Action Event Helpers
  const handleScrollTracking = () => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollPosition = container.scrollTop;
    const maximumScrollRange = container.scrollHeight - container.clientHeight;
    const distanceToFloor = maximumScrollRange - currentScrollPosition;

    if (distanceToFloor <= 60) {
      setShowNewMessageBadge(false);
      setIsUserScrolledUp(false);
    } else if (distanceToFloor > 200) {
      setIsUserScrolledUp(true);
    }
  };

  const scrollToBottomViewport = () => {
    const container = containerRef.current;
    if (!container) return;
    setShowNewMessageBadge(false);
    setIsUserScrolledUp(false);
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
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
        unreadCounts={unreadCounts}
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
              <h1 className="font-semibold text-sm tracking-wide text-white truncate">
                {activeRoomTitle}
                {currentRoomOnlineIds.length > 1 ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] border border-zinc-950 ml-2 inline-block" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600 border border-zinc-950 ml-2 inline-block" />
                )}
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
