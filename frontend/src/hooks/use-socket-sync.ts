import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { authClient } from "@/lib/auth-client";
import { io, Socket } from "socket.io-client";

export function useSocketSync() {
  const { data: session } = authClient.useSession();
  const activeChannelId = useChatStore((state) => state.activeChannelId);
  const socket = useChatStore((state) => state.socket);
  const setSocket = useChatStore((state) => state.setSocket);
  const addMessage = useChatStore((state: any) => state.addMessage);

  const addMessageRef = useRef(addMessage);
  useEffect(() => {
    addMessageRef.current = addMessage;
  }, [addMessage]);

  // HOOK 1: Stable Connection Instance Lifecycle (Runs once per session)
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
      if (targetChannel && addMessageRef.current) {
        addMessageRef.current(targetChannel, payload);
      }
    });

    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [session]); // Only reconnects if your main session parameters rotate

  // HOOK 2: Room Switching Logic (Fast, lightweight event emission)
  useEffect(() => {
    if (!socket || !activeChannelId) return;

    // Join the newly selected room instantly
    socket.emit("join_channel", activeChannelId);

    return () => {
      // Leave cleanly right before joining the next target room
      socket.emit("leave_channel", activeChannelId);
    };
  }, [socket, activeChannelId]); // Runs instantly when changing UI channels
}
