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
  setShowNewMessageBadge: (show: boolean) => void;
}

export function useWorkspaceScrollAndSync({
  session,
  activeChannelId,
  currentChannelMessages,
  setChannelsList,
  setUsersList,
  containerRef,
  setShowNewMessageBadge,
}: UseWorkspaceScrollAndSyncProps) {
  // 1. Initial Data Synchronization
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

  // 2. 🚀 STABLE REAL-TIME CHANNEL SCROLL SYNC
  useEffect(() => {
    const container = containerRef.current;
    if (!container || currentChannelMessages.length === 0) return;

    const latestMessage =
      currentChannelMessages[currentChannelMessages.length - 1];
    const amISender =
      (latestMessage?.senderId || latestMessage?.userId) === session.user.id;
    const isInitialRoomLoad =
      currentChannelMessages.length <= 15 && container.scrollTop === 0;

    // Read the stable scroll tracking status directly from the Zustand store slice
    const userIsScrolledUp = useChatStore.getState().isUserScrolledUp;

    if (isInitialRoomLoad) {
      container.scrollTop = container.scrollHeight;
      setShowNewMessageBadge(false);
      useChatStore.getState().setIsUserScrolledUp(false);
      return;
    }

    if (amISender || !userIsScrolledUp) {
      // Automatically slide view down if you typed it or are active at the bottom
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      setShowNewMessageBadge(false);
    } else {
      // 🌟 RELIABLE BADGE TRIGGER: Someone else typed while your Zustand flag is set to scrolled up!
      setShowNewMessageBadge(true);
    }
  }, [
    currentChannelMessages.length,
    activeChannelId,
    session.user.id,
    containerRef,
    setShowNewMessageBadge,
  ]);
}
