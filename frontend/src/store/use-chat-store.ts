import { create } from "zustand";

interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

interface ChatState {
  activeChannelId: string | null;
  messagesByChannel: Record<string, ChatMessage[]>;
  socket: any | null;
  presenceByChannel: Record<string, string[]>;
  onlineUserIds: string[];
  isUserScrolledUp: boolean;
  typingByChannel: Record<string, string[]>;

  // Actions mutators
  setActiveChannel: (channelId: string | null) => void;
  setInitialMessages: (channelId: string, messages: ChatMessage[]) => void;
  prependHistoricalMessages: (
    channelId: string,
    historicalMessages: ChatMessage[],
  ) => void;
  addMessage: (channelId: string, message: ChatMessage) => void;
  setSocket: (socketInstance: any) => void;
  setRoomPresence: (channelId: string, onlineUserIds: string[]) => void;
  setOnlineUsers: (onlineIds: string[]) => void;
  setIsUserScrolledUp: (scrolledUp: boolean) => void;
  setTypingStatus: (channelId: string, typingUsers: string[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeChannelId: null,
  messagesByChannel: {},
  socket: null,
  presenceByChannel: {},
  onlineUserIds: [],
  isUserScrolledUp: false,
  typingByChannel: {},

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  setInitialMessages: (channelId, messages) =>
    set((state) => ({
      messagesByChannel: {
        ...state.messagesByChannel,
        [channelId]: messages,
      },
    })),

  prependHistoricalMessages: (channelId, historicalMessages) =>
    set((state) => {
      const current = state.messagesByChannel[channelId] || [];
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: [...historicalMessages, ...current],
        },
      };
    }),

  addMessage: (channelId, message) =>
    set((state) => {
      const current = state.messagesByChannel[channelId] || [];
      // Prevent duplicate rendering tracking
      if (current.some((m) => m.id === message.id)) return state;
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: [...current, message],
        },
      };
    }),

  setSocket: (socketInstance) => set({ socket: socketInstance }),

  setRoomPresence: (channelId, onlineUserIds) =>
    set((state) => ({
      presenceByChannel: {
        ...state.presenceByChannel,
        [channelId]: onlineUserIds,
      },
    })),

  setOnlineUsers: (onlineIds) => set({ onlineUserIds: onlineIds }),

  setIsUserScrolledUp: (scrolledUp) => set({ isUserScrolledUp: scrolledUp }),

  setTypingStatus: (channelId, typingUsers) =>
    set((state) => ({
      typingByChannel: {
        ...state.typingByChannel,
        [channelId]: typingUsers,
      },
    })),
}));
