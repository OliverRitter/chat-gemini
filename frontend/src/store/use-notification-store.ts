import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useChatStore } from "./use-chat-store";

interface NotificationState {
  unreadCounts: Record<string, number>;
  incrementUnread: (channelId: string, senderId: string) => void;
  clearUnread: (targetId: string) => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      unreadCounts: {},

      incrementUnread: (channelId, senderId) => {
        const chatState = useChatStore.getState();
        const activeChannelId = chatState.activeChannelId;

        // Guard Clause: If the user is actively viewing this room, skip counting
        if (channelId === activeChannelId) return;

        // 🟩 SYSTEMATIC TRACE: Let's see why the math is getting reset
        console.log("🔢 [Notification Math Check] Incoming:", {
          channelId,
          senderId,
        });

        // A robust check to decide if this is a public room or a personal DM
        const messagesMap = chatState.messagesByChannel || {};
        const isPublicChannel = !!messagesMap[channelId] || !senderId;
        const trackingKey = isPublicChannel ? channelId : senderId;

        set((state) => {
          const nextCounts = { ...state.unreadCounts };

          // 🟩 THE MATH FIX: Forcefully convert the existing value to a strict integer
          const previousCount = Number(nextCounts[trackingKey]) || 0;
          nextCounts[trackingKey] = previousCount + 1;

          console.log(
            `📈 [Notification Math Success] Key "${trackingKey}" went from ${previousCount} to ${nextCounts[trackingKey]}`,
          );

          return { unreadCounts: nextCounts };
        });
      },

      clearUnread: (targetId) => {
        set((state) => {
          if (!state.unreadCounts[targetId]) return state;

          const nextCounts = { ...state.unreadCounts };
          nextCounts[targetId] = 0;
          return { unreadCounts: nextCounts };
        });
      },
    }),
    { name: "NotificationStore" },
  ),
);
