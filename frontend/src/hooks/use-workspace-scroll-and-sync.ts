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
  const isUserScrolledUp = useChatStore((state) => state.isUserScrolledUp);
  const setIsUserScrolledUp = useChatStore(
    (state) => state.setIsUserScrolledUp,
  );

  // 🟩 SYSTEMATIC FIX: Empty the dependency array so this ONLY fires once when you open the app!
  // This completely stops incoming messages from destroying and recreatng your sidebar items.
  useEffect(() => {
    async function loadActiveWorkspaceData() {
      console.log(
        "📁 [Directory Sync] Fetching baseline workspace lists once...",
      );
      const data = await getDirectoryData().catch(() => null);
      if (data) {
        setChannelsList(data.channels || []);
        setUsersList(data.users || []);
      }
    }
    loadActiveWorkspaceData();
  }, []); // 💡 KEEP THIS EMPTY: Stops the endless loop!

  // 2. Real-Time Scroll and Tracking Loop (Remains untouched for auto-scrolling)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || currentChannelMessages.length === 0) return;

    const latestMessage =
      currentChannelMessages[currentChannelMessages.length - 1];
    const amISender =
      (latestMessage?.senderId || latestMessage?.userId) === session?.user?.id;
    const isInitialRoomLoad =
      currentChannelMessages.length <= 15 && container.scrollTop === 0;

    if (isInitialRoomLoad) {
      container.scrollTop = container.scrollHeight;
      if (typeof setShowNewMessageBadge === "function") {
        setShowNewMessageBadge(false);
      }
      setIsUserScrolledUp(false);
      return;
    }

    if (amISender || !isUserScrolledUp) {
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
    session?.user?.id,
    containerRef,
    setShowNewMessageBadge,
    isUserScrolledUp,
    setIsUserScrolledUp,
  ]);
}
