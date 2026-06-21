import { create } from "zustand";
import { useChatStore } from "./use-chat-store";

interface NotificationState {
  unreadCounts: Record<string, number>;
  incrementUnread: (channelId: string, senderId: string) => void;
  clearUnread: (targetId: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCounts: {},

  incrementUnread: (channelId, senderId) => {
    const activeChannelId = useChatStore.getState().activeChannelId;

    // GUARD: If you are already looking at this conversation room, do nothing
    if (channelId === activeChannelId) return;

    set((state) => {
      // 🟩 THE LOGIC RULES:
      // If the message is a DM (the senderId is present and it is a unique person),
      // we save the count under the sender's personal ID so the sidebar can read it.
      // Otherwise, it is a public channel, so we save it under the channel ID.
      const isPublicChannel = channelId.startsWith("channel_") || !senderId;
      const trackingKey = isPublicChannel ? channelId : senderId;

      return {
        unreadCounts: {
          ...state.unreadCounts,
          [trackingKey]: (state.unreadCounts[trackingKey] || 0) + 1,
        },
      };
    });
  },

  clearUnread: (targetId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [targetId]: 0,
      },
    })),
}));
