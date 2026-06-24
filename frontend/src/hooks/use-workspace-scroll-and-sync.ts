"use client";

import { useEffect, MutableRefObject } from "react";
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
}

export function useWorkspaceScrollAndSync({
  session,
  activeChannelId,
  currentChannelMessages,
  setChannelsList,
  setUsersList,
  containerRef,
}: UseWorkspaceScrollAndSyncProps) {
  // 1. Initial Baseline Workspace Data Synchronization Fetch
  useEffect(() => {
    async function loadActiveWorkspaceData() {
      try {
        const data = await getDirectoryData();
        if (data) {
          setChannelsList(data.channels || []);
          setUsersList(data.users || []);
        }
      } catch (error) {
        console.error("Failed to boot workspace indices:", error);
      }
    }
    loadActiveWorkspaceData();
  }, [setChannelsList, setUsersList]);

  // 2. Automated Smart Message Alignment (Gravity Zone Check)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || currentChannelMessages.length === 0) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isUserAtBottom = distanceFromBottom <= 400;

    const latestMessage =
      currentChannelMessages[currentChannelMessages.length - 1];
    const amISender =
      (latestMessage?.senderId || latestMessage?.userId) === session.user.id;

    if (amISender || isUserAtBottom) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [
    currentChannelMessages.length,
    activeChannelId,
    session.user.id,
    containerRef,
  ]);
}
