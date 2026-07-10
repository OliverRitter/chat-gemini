"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { authClient } from "@/lib/auth-client";
import { io } from "socket.io-client";
import { useNotificationStore } from "@/store/use-notification-store";

export function useSocketSync() {
  const { data: session } = authClient.useSession();
  const socket = useChatStore((state) => state.socket);
  const setSocket = useChatStore((state) => state.setSocket);
  const activeChannelId = useChatStore((state) => state.activeChannelId);

  const sessionToken = session?.session?.token || (session as any)?.token;

  // Track the channel using a simple ref to avoid stale closure bugs
  const activeChannelRef = useRef<string | null>(null);

  // 🟩 FIXED SUBSCRIPTION: Standard vanilla Zustand state listener loop
  useEffect(() => {
    // Set the initial value manually to avoid passing multi-argument options
    activeChannelRef.current = useChatStore.getState().activeChannelId;

    const unsubscribe = useChatStore.subscribe((state) => {
      activeChannelRef.current = state.activeChannelId;
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionToken) return;

    console.log("🔌 [Socket] Connecting unified line...");

    const socketInstance = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
      {
        autoConnect: true,
        withCredentials: true,
        transports: ["websocket"],
        auth: { token: sessionToken },
      },
    );

    setSocket(socketInstance);

    socketInstance.on("message_received", (payload: any) => {
      console.log("📨 [Socket Sync Diagnostic] Raw Payload Arrived:", payload);

      const targetChannel = payload.channelId;
      const targetSender = payload.senderId || payload.userId;

      if (!targetChannel) return;

      // 🟩 THE LOGICAL FIX: Check if the user is actively viewing this channel
      if (targetChannel === activeChannelRef.current) {
        // CASE A: User is in the room. Keep notifications clear and inject the message onto the live screen!
        useNotificationStore.getState().clearUnread(targetChannel);
        useChatStore.getState().addMessage(targetChannel, payload);
      } else {
        // CASE B: This is a background message! ONLY increment the notification badge.
        // DO NOT add it to the chat store here. This prevents background state changes from flushing your counts!
        useNotificationStore
          .getState()
          .incrementUnread(targetChannel, targetSender);
      }
    });

    // socketInstance.on(
    //   "room_presence_update",
    //   (payload: { channelId: string; onlineUserIds: string[] }) => {
    //     useChatStore
    //       .getState()
    //       .setRoomPresence(payload.channelId, payload.onlineUserIds);
    //   },
    // );

    socketInstance.on("workspace_presence_update", (onlineIds: string[]) => {
      useChatStore.getState().setOnlineUsers(onlineIds);
    });

    socketInstance.on("user_online", (data: { userId: string }) => {
      const chatState = useChatStore.getState();
      const currentOnline = chatState.onlineUserIds || [];
      if (!currentOnline.includes(data.userId)) {
        chatState.setOnlineUsers([...currentOnline, data.userId]);
      }
    });

    socketInstance.on("user_offline", (data: { userId: string }) => {
      const chatState = useChatStore.getState();
      const currentOnline = chatState.onlineUserIds || [];
      chatState.setOnlineUsers(
        currentOnline.filter((id) => id !== data.userId),
      );
    });

    socketInstance.on(
      "typing_status_changed",
      (data: { channelId: string; typingUsers: string[] }) => {
        useChatStore
          .getState()
          .setTypingStatus(data.channelId, data.typingUsers || []);
      },
    );

    return () => {
      console.log("🔌 [Socket] Disconnecting cleanly...");
      socketInstance.off("message_received");
      socketInstance.off("room_presence_update");
      socketInstance.off("workspace_presence_update");
      socketInstance.off("user_online");
      socketInstance.off("user_offline");
      socketInstance.off("typing_status_changed");
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [sessionToken, setSocket]);

  // Channel room stream synchronizer effect block
  useEffect(() => {
    if (!socket || !activeChannelId) return;

    socket.emit("join_channel", activeChannelId);

    return () => {
      socket.emit("leave_channel", activeChannelId);
    };
  }, [socket, activeChannelId]);
}
