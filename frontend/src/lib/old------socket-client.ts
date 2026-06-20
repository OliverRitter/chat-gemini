// src/lib/socket-client.ts
import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export async function getSocket(sessionToken: string): Promise<Socket> {
  // If a valid connection layer is already up and listening, reuse it instantly
  if (socketInstance?.connected) {
    return socketInstance;
  }

  // Double check that the token is not accidentally empty to avoid triggering the backend killswitch
  if (!sessionToken) {
    console.warn(
      "⚠️ Cannot initialize socket sync layer: sessionToken parameter is empty!",
    );
  }

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

  // Build the network allocation instance mapping parameters explicitly
  socketInstance = io(socketUrl, {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"], // Match backend engine parameters
    auth: {
      token: sessionToken, // 🔑 Crucial payload token insertion point!
    },
    query: {
      token: sessionToken, // Fallback query string parameters layer
    },
  });

  // Execute connection loop
  socketInstance.connect();

  // Handle connection failures cleanly in your browser logging channels
  socketInstance.on("connect_error", (err) => {
    console.error("❌ SOCKET REFUSED BY SECURITY MIDDLEWARE:", err.message);
  });

  return socketInstance;
}
