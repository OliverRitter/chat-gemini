// src/store/use-chat-store.ts
import { create } from "zustand";
import { Socket } from "socket.io-client";

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  content: string;
  createdAt: string;
}

interface ChatState {
  activeChannelId: string | null;
  messagesByChannel: Record<string, Message[]>;
  socket: Socket | null;
  onlineUserIds: string[];
  presenceByChannel: Record<string, string[]>; // 🟩 ADDED MISSING INTERFACE KEY
  setActiveChannel: (channelId: string | null) => void;
  addMessage: (channelId: string, message: Message) => void;
  setInitialMessages: (channelId: string, messages: Message[]) => void;
  prependHistoricalMessages: (
    channelId: string,
    oldMessages: Message[],
  ) => void;
  setRoomPresence: (channelId: string, userIds: string[]) => void; // 🟩 ADDED MISSING METHOD TYPE
  setSocket: (socket: Socket | null) => void;
  setOnlineUsers: (userIds: string[]) => void;
  isUserScrolledUp: boolean;
  setIsUserScrolledUp: (scrolledUp: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeChannelId: null,
  messagesByChannel: {},
  socket: null,
  presenceByChannel: {}, // Now perfectly type-checked
  onlineUserIds: [],
  isUserScrolledUp: false,
  setIsUserScrolledUp: (scrolledUp) => set({ isUserScrolledUp: scrolledUp }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  setOnlineUsers: (userIds) => set({ onlineUserIds: userIds }),

  addMessage: (channelId, message) =>
    set((state) => {
      const existing = state.messagesByChannel[channelId] || [];
      if (existing.some((m) => m.id === message.id)) return state;

      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: [...existing, message],
        },
      };
    }),

  setInitialMessages: (channelId, messages) =>
    set((state) => ({
      messagesByChannel: {
        ...state.messagesByChannel,
        [channelId]: messages,
      },
    })),

  prependHistoricalMessages: (channelId, oldMessages) =>
    set((state) => {
      const existing = state.messagesByChannel[channelId] || [];
      const uniqueOldMessages = oldMessages.filter(
        (oldMsg) => !existing.some((m) => m.id === oldMsg.id),
      );

      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: [...uniqueOldMessages, ...existing],
        },
      };
    }),

  setRoomPresence: (channelId, userIds) =>
    set((state: any) => ({
      // Cast state to any here or let Zustand infer it
      presenceByChannel: {
        ...state.presenceByChannel,
        [channelId]: userIds,
      },
    })),

  setSocket: (socket) => set({ socket }),
}));
