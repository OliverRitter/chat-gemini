// src/store/use-notification-store.ts
import { create } from "zustand";
import { useChatStore } from "./use-chat-store";

interface NotificationState {
  unreadCounts: Record<string, number>; // Maps channelId or privateRoomId -> total unread number
  incrementUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCounts: {},

  incrementUnread: (channelId) => {
    // 1. Grab the active channel ID the user is currently looking at on their screen
    const activeChannelId = useChatStore.getState().activeChannelId;

    // 2. CRUCIAL GUARD: If the message arrived in the channel they are already viewing, DO NOT add a badge!
    if (channelId === activeChannelId) return;

    // 3. Otherwise, increment the counter for that specific unviewed room
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: (state.unreadCounts[channelId] || 0) + 1,
      },
    }));
  },

  clearUnread: (channelId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: 0,
      },
    })),
}));
