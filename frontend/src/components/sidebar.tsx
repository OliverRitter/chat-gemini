// src/components/sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { useNotificationStore } from "@/store/use-notification-store";
import { getDirectoryData } from "@/app/actions/user-actions";

export function Sidebar({ user }: { user: { name: string } }) {
  const { activeChannelId, setActiveChannel } = useChatStore();
  const { unreadCounts, clearUnread } = useNotificationStore();
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getDirectoryData()
      .then((data) => setChannels(data.channels))
      .catch(console.error);
  }, []);

  return (
    <aside className="w-64 h-full border-r bg-card flex flex-col p-4 shrink-0 overflow-y-auto">
      <div className="space-y-4">
        <div>
          <h2 className="font-bold">Workspace</h2>
          <p className="text-xs text-muted-foreground">User: {user.name}</p>
        </div>
        <nav className="space-y-1">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => {
                setActiveChannel(ch.id);
                clearUnread(ch.id);
              }}
              className={`w-full text-left px-3 py-1.5 rounded text-sm flex justify-between ${activeChannelId === ch.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <span># {ch.name}</span>
              {(unreadCounts[ch.id] || 0) > 0 && (
                <span className="bg-destructive text-white text-[10px] px-2 rounded-full">
                  !
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
