// frontend/src/hooks/use-socket-sync.ts
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

  // =========================================================================
  // HOOK 1: Stable Connection Instance Lifecycle (Runs once per session)
  // =========================================================================
  useEffect(() => {
    const sessionToken = session?.session?.token || (session as any)?.token;
    if (!sessionToken) return;

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

    // Listener C: Workspace Presence Updates (Clean & Consolidated)
    socketInstance.on("workspace_presence_update", (onlineIds: string[]) => {
      console.log("📡 [Socket] Received online user list payload:", onlineIds);
      useChatStore.getState().setOnlineUsers(onlineIds);
    });
    socketInstance.on(
      "typing_status_changed",
      (data: { channelId: string; typingUsers: string[] }) => {
        // Pass the incoming real-time names array directly into your updated Zustand store
        useChatStore
          .getState()
          .setTypingStatus(data.channelId, data.typingUsers || []);
      },
    );

    return () => {
      socketInstance.off("message_received");
      socketInstance.off("room_presence_update");
      socketInstance.off("workspace_presence_update");
      socketInstance.off("typing_status_changed");
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [session, setSocket]); // Completely stable dependency array

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
