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

      // 1. Combine your historical incoming logs with your current room view logs
      const combinedPool = [...historicalMessages, ...current];

      // 2. 🚀 THE ULTIMATE DEFENSE: Filter out items with the same message ID
      // This checks the combined pool and only keeps the very first instance of any ID,
      // completely wiping out duplicates before they can hit your screen!
      const uniqueList = combinedPool.filter(
        (msg, index, self) => self.findIndex((m) => m.id === msg.id) === index,
      );

      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: uniqueList,
        },
      };
    }),

  addMessage: (channelId, message) =>
    set((state) => {
      const current = state.messagesByChannel[channelId] || [];

      // 🚀 STRICT STRING TRIMMING SAFETY VALVE:
      // Drop any incoming duplicates right at the door before they mess up your view layouts!
      if (
        current.some((m) => String(m.id).trim() === String(message.id).trim())
      ) {
        return state;
      }

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
