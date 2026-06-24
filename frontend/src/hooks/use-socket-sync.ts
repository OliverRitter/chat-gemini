"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { authClient } from "@/lib/auth-client";
import { io } from "socket.io-client";
import { useNotificationStore } from "@/store/use-notification-store";

export function useSocketSync() {
  const { data: session } = authClient.useSession();
  const activeChannelId = useChatStore((state) => state.activeChannelId);
  const socket = useChatStore((state) => state.socket);
  const setSocket = useChatStore((state) => state.setSocket);

  // 🚀 EXTRACT EXPLICITLY THE UNIQUE IMMUTABLE STRING KEYS
  const sessionToken = session?.session?.token || (session as any)?.token;

  // =========================================================================
  // HOOK 1: Stable Connection Instance Lifecycle (Runs exactly ONCE per token)
  // =========================================================================
  useEffect(() => {
    // Guard Clause: Block if the string doesn't exist yet
    if (!sessionToken) return;

    console.log("🔌 [Socket] Initializing unified secure socket line link...");

    const socketInstance = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
      {
        autoConnect: true,
        withCredentials: true,
        transports: ["websocket"],
        auth: { token: sessionToken }, // Feed raw token string securely
      },
    );

    setSocket(socketInstance);

    socketInstance.on("message_received", (payload: any) => {
      const targetChannel = payload.channelId || payload.roomId;
      if (targetChannel) {
        useNotificationStore
          .getState()
          .incrementUnread(targetChannel, payload.senderId);
        useChatStore.getState().addMessage(targetChannel, payload);
      }
    });

    socketInstance.on(
      "room_presence_update",
      (payload: { channelId: string; onlineUserIds: string[] }) => {
        useChatStore
          .getState()
          .setRoomPresence(payload.channelId, payload.onlineUserIds);
      },
    );

    socketInstance.on("workspace_presence_update", (onlineIds: string[]) => {
      console.log("📡 [Socket] Received online user list payload:", onlineIds);
      useChatStore.getState().setOnlineUsers(onlineIds);
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
      console.log("🔌 [Socket] Cleaning up connection footprint gracefully...");
      socketInstance.off("message_received");
      socketInstance.off("room_presence_update");
      socketInstance.off("workspace_presence_update");
      socketInstance.off("typing_status_changed");
      socketInstance.disconnect();
      setSocket(null);
    };

    // 🚀 FIXED: Bind to 'sessionToken' string and 'setSocket'.
    // Since strings are compared by value, this effect will NEVER run again while logged in!
  }, [sessionToken, setSocket]);

  // =========================================================================
  // HOOK 2: Room Switching Logic (Fast, lightweight event emission)
  // =========================================================================
  useEffect(() => {
    if (!socket || !activeChannelId) return;

    socket.emit("join_channel", activeChannelId);

    return () => {
      socket.emit("leave_channel", activeChannelId);
    };
  }, [socket, activeChannelId]);
}
