// src/store/use-chat-store.ts
import { create } from "zustand";
import { Socket } from "socket.io-client";

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string; // 🚀 ADD THIS PROPERTY RIGHT HERE so Zustand preserves names!
  content: string;
  createdAt: string;
}

interface ChatState {
  activeChannelId: string | null;
  messagesByChannel: Record<string, Message[]>;
  socket: Socket | null; // 🔌 Holds the single, production-safe reference
  setActiveChannel: (channelId: string | null) => void;
  addMessage: (channelId: string, message: Message) => void;
  setInitialMessages: (channelId: string, messages: Message[]) => void;
  setSocket: (socket: Socket | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeChannelId: null,
  messagesByChannel: {},
  socket: null,
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  addMessage: (channelId, message) =>
    set((state) => {
      const existing = state.messagesByChannel[channelId] || [];
      // Guard clause: Avoid duplicating messages across rapid real-time multi-device loops
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
  setSocket: (socket) => set({ socket }),
}));
