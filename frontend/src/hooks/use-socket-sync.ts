// frontend/src/hooks/use-socket-sync.ts
import { useEffect } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { authClient } from "@/lib/auth-client";
import { io } from "socket.io-client";

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

    // Listener A: Live Text Messages (Now safely calling getState directly)
    socketInstance.on("message_received", (payload: any) => {
      const targetChannel = payload.channelId || payload.roomId;
      if (targetChannel) {
        useChatStore.getState().addMessage(targetChannel, payload);
      }
    });

    // Listener B: Room Presence Updates
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

    return () => {
      // Explicitly tear down listeners to prevent ghost memory leaks
      socketInstance.off("message_received");
      socketInstance.off("room_presence_update");
      socketInstance.off("workspace_presence_update");
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
