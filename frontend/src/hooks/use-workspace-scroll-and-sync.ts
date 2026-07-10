"use client";

import { useEffect, MutableRefObject, useRef } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { getDirectoryData } from "@/app/actions/user-actions";

interface SidebarItem {
  id: string;
  name: string;
  isUser?: boolean;
}

interface UseWorkspaceScrollAndSyncProps {
  session: any;
  activeChannelId: string | null;
  currentChannelMessages: any[];
  setChannelsList: React.Dispatch<React.SetStateAction<SidebarItem[]>>;
  setUsersList: React.Dispatch<React.SetStateAction<SidebarItem[]>>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  setShowNewMessageBadge: (show: boolean) => void;
  isFetchingPage?: MutableRefObject<boolean>;
}

export function useWorkspaceScrollAndSync({
  session,
  activeChannelId,
  currentChannelMessages,
  setChannelsList,
  setUsersList,
  containerRef,
  setShowNewMessageBadge,
  isFetchingPage,
}: UseWorkspaceScrollAndSyncProps) {
  const isUserScrolledUp = useChatStore((state) => state.isUserScrolledUp);
  const setIsUserScrolledUp = useChatStore(
    (state) => state.setIsUserScrolledUp,
  );

  const prevMsgCountRef = useRef(0);
  const prevLastMsgIdRef = useRef<string | null>(null);

  // Baseline workspace sync directory fetch
  useEffect(() => {
    async function loadActiveWorkspaceData() {
      const data = await getDirectoryData().catch(() => null);
      if (data) {
        setChannelsList(data.channels || []);
        setUsersList(data.users || []);
      }
    }
    loadActiveWorkspaceData();
  }, []);

  // Real-Time Scroll and Tracking Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container || currentChannelMessages.length === 0) {
      prevMsgCountRef.current = 0;
      prevLastMsgIdRef.current = null;
      return;
    }

    const latestMessage =
      currentChannelMessages[currentChannelMessages.length - 1];
    const latestMessageId = latestMessage?.id || null;

    if (isFetchingPage?.current) {
      prevMsgCountRef.current = currentChannelMessages.length;
      prevLastMsgIdRef.current = latestMessageId;
      return;
    }

    // Check if history was prepended at the top
    const historyWasPrepended =
      currentChannelMessages.length > prevMsgCountRef.current &&
      latestMessageId === prevLastMsgIdRef.current &&
      prevMsgCountRef.current !== 0;

    if (historyWasPrepended) {
      prevMsgCountRef.current = currentChannelMessages.length;
      return;
    }

    const amISender =
      (latestMessage?.senderId || latestMessage?.userId) === session?.user?.id;
    const isInitialRoomLoad = prevLastMsgIdRef.current === null;

    if (isInitialRoomLoad) {
      container.scrollTop = container.scrollHeight;
      if (typeof setShowNewMessageBadge === "function") {
        setShowNewMessageBadge(false);
      }
      setIsUserScrolledUp(false);

      prevMsgCountRef.current = currentChannelMessages.length;
      prevLastMsgIdRef.current = latestMessageId;
      return;
    }

    // 🚀 THE SMART BEHAVIOR UPDATE:
    // When a message happens, if you are the sender OR you are sitting at the bottom of the chat,
    // automatically snap the screen down to see it.
    if (amISender || !isUserScrolledUp) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      if (typeof setShowNewMessageBadge === "function") {
        setShowNewMessageBadge(false);
      }
    } else {
      // 🚀 FIXED: If a brand-new real-time message lands while you are scrolled up reading history,
      // ONLY THEN do we turn on the floating notification badge button!
      const aRealNewMessageArrivedAtTheBottom =
        currentChannelMessages.length > prevMsgCountRef.current;

      if (
        aRealNewMessageArrivedAtTheBottom &&
        typeof setShowNewMessageBadge === "function"
      ) {
        setShowNewMessageBadge(true);
      }
    }

    prevMsgCountRef.current = currentChannelMessages.length;
    prevLastMsgIdRef.current = latestMessageId;
  }, [
    currentChannelMessages,
    activeChannelId,
    session?.user?.id,
    containerRef,
    setShowNewMessageBadge,
    isUserScrolledUp,
    setIsUserScrolledUp,
    isFetchingPage,
  ]);
}
