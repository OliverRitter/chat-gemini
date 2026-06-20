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
  setActiveChannel: (channelId: string | null) => void;
  addMessage: (channelId: string, message: Message) => void;
  setInitialMessages: (channelId: string, messages: Message[]) => void;
  // 🚀 ADDED TO INTERFACE: Explicit type mapping footprint configuration
  prependHistoricalMessages: (
    channelId: string,
    oldMessages: Message[],
  ) => void;
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

  // 🚀 THE CRITICAL HISTORICAL CHUNK PREPENDER:
  // Adds older history logs cleanly to the top of the chat view container array
  prependHistoricalMessages: (channelId, oldMessages) =>
    set((state) => {
      const existing = state.messagesByChannel[channelId] || [];

      // Safety filter: Avoid duplicating entries if real-time packets overlap with fetch requests
      const uniqueOldMessages = oldMessages.filter(
        (oldMsg) => !existing.some((m) => m.id === oldMsg.id),
      );

      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: [...uniqueOldMessages, ...existing], // Prepend historical logs directly to the top!
        },
      };
    }),

  setSocket: (socket) => set({ socket }),
}));
