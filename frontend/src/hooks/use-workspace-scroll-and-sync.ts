"use client";

import { useEffect, MutableRefObject } from "react";
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
  setShowNewMessageBadge: (show: boolean) => void; // Locked type
}

// 🚀 FIXED HEADER SIGNATURE: Must read variables as an object parameter package!
export function useWorkspaceScrollAndSync({
  session,
  activeChannelId,
  currentChannelMessages,
  setChannelsList,
  setUsersList,
  containerRef,
  setShowNewMessageBadge,
}: UseWorkspaceScrollAndSyncProps) {
  // 1. Directory Initializer List Setup
  useEffect(() => {
    async function loadActiveWorkspaceData() {
      const data = await getDirectoryData().catch(() => null);
      if (data) {
        setChannelsList(data.channels || []);
        setUsersList(data.users || []);
      }
    }
    loadActiveWorkspaceData();
  }, [setChannelsList, setUsersList]);

  // 2. Real-Time Tracking Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container || currentChannelMessages.length === 0) return;

    const latestMessage =
      currentChannelMessages[currentChannelMessages.length - 1];
    const amISender =
      (latestMessage?.senderId || latestMessage?.userId) === session.user.id;
    const isInitialRoomLoad =
      currentChannelMessages.length <= 15 && container.scrollTop === 0;

    const userIsScrolledUp = useChatStore.getState().isUserScrolledUp;

    if (isInitialRoomLoad) {
      container.scrollTop = container.scrollHeight;
      if (typeof setShowNewMessageBadge === "function") {
        setShowNewMessageBadge(false);
      }
      useChatStore.getState().setIsUserScrolledUp(false);
      return;
    }

    if (amISender || !userIsScrolledUp) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      if (typeof setShowNewMessageBadge === "function") {
        setShowNewMessageBadge(false);
      }
    } else {
      if (typeof setShowNewMessageBadge === "function") {
        setShowNewMessageBadge(true);
      }
    }
  }, [
    currentChannelMessages,
    activeChannelId,
    session.user.id,
    containerRef,
    setShowNewMessageBadge,
  ]);
}
