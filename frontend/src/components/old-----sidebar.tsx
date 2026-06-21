// src/components/sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { useNotificationStore } from "@/store/use-notification-store";
import {
  getDirectoryData,
  createGlobalChannel,
  searchNewUsers,
  searchGlobalChannels,
} from "@/app/actions/user-actions";
import { getOrCreateDirectMessageChannel } from "@/app/actions/dm-actions";
import { getChannelMessages } from "@/app/actions/chat-actions";

interface SidebarItem {
  id: string;
  name: string;
  isUser?: boolean;
}

export function Sidebar({
  user,
  onRoomTitleChange,
}: {
  user: { name: string };
  onRoomTitleChange: (title: string) => void;
}) {
  const activeChannelId = useChatStore((state) => state.activeChannelId);
  const setActiveChannel = useChatStore((state) => state.setActiveChannel);
  const setInitialMessages = useChatStore((state) => state.setInitialMessages);
  const onlineUserIds = useChatStore((state) => state.onlineUserIds || []);
  const { unreadCounts, clearUnread } = useNotificationStore();

  const [channels, setChannels] = useState<SidebarItem[]>([]);
  const [usersList, setUsersList] = useState<SidebarItem[]>([]);
  const [activeTitle, setActiveTitle] = useState("");

  useEffect(() => {
    getDirectoryData()
      .then((data) => {
        setChannels(data.channels || []);
        setUsersList(data.users || []);
      })
      .catch(console.error);
  }, []);

  const handleChannelSelect = async (ch: SidebarItem) => {
    setActiveChannel(ch.id);
    clearUnread(ch.id);
    const title = `# ${ch.name}`;
    setActiveTitle(title);
    onRoomTitleChange(title);

    try {
      const history = await getChannelMessages(ch.id, 0);
      setInitialMessages(ch.id, history || []);
    } catch (err) {
      console.error("Error setting channel history:", err);
    }
  };

  const handleUserSelect = async (usr: SidebarItem) => {
    try {
      const response = await getOrCreateDirectMessageChannel(usr.id);
      if (response?.channelId) {
        // 🟩 FIX: Set active channel ID globally so chat-messages can see it!
        setActiveChannel(response.channelId);
        clearUnread(response.channelId);

        const title = `👤 ${usr.name}`;
        setActiveTitle(title);
        onRoomTitleChange(title);

        const history = await getChannelMessages(response.channelId, 0);
        setInitialMessages(response.channelId, history || []);
      }
    } catch (err) {
      console.error("Failed DM routing:", err);
    }
  };

  const handleCreateChannel = async () => {
    const name = prompt("Enter a name for the new public channel:");
    if (!name || !name.trim()) return;

    try {
      const newChan = await createGlobalChannel(name.trim());
      if (newChan) {
        setChannels((prev) => [
          ...prev,
          { id: newChan.id, name: newChan.name },
        ]);
        await handleChannelSelect({ id: newChan.id, name: newChan.name });
      }
    } catch (err) {
      console.error("Failed creating channel:", err);
    }
  };

  return (
    <aside className="w-64 h-full border-r bg-zinc-950 flex flex-col p-4 shrink-0 text-zinc-200">
      <div className="space-y-6 overflow-y-auto flex-1 pr-1">
        <div>
          <h2 className="font-bold text-white text-lg">Workspace</h2>
          <p className="text-xs text-zinc-500">User: {user.name}</p>
        </div>

        {/* CHANNELS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Channels
            </span>
            <button
              onClick={handleCreateChannel}
              className="text-xs text-blue-500 font-bold hover:underline"
            >
              + New
            </button>
          </div>
          <input
            type="text"
            placeholder="Search public groups..."
            onChange={async (e) => {
              const val = e.target.value.trim();
              const res = val
                ? await searchGlobalChannels(val)
                : (await getDirectoryData()).channels;
              setChannels(
                (res || []).map((ch: any) => ({ id: ch.id, name: ch.name })),
              );
            }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none placeholder-zinc-600"
          />
          <nav className="space-y-1">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleChannelSelect(ch)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm flex justify-between items-center transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-blue-600 text-white"
                    : "hover:bg-zinc-800 text-zinc-400"
                }`}
              >
                <span className="truncate"># {ch.name}</span>
                {(unreadCounts[ch.id] || 0) > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full font-bold">
                    !
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* DIRECT MESSAGES */}
        <div className="space-y-2">
          <div className="px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Find Coworkers
            </span>
          </div>
          <input
            type="text"
            placeholder="Search name or email..."
            onChange={async (e) => {
              const val = e.target.value.trim();
              const res = val
                ? await searchNewUsers(val)
                : (await getDirectoryData()).users;
              setUsersList(
                (res || []).map((u: any) => ({
                  id: u.id,
                  name: u.name,
                  isUser: true,
                })),
              );
            }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none placeholder-zinc-600"
          />
          <nav className="space-y-1">
            {usersList.map((usr) => (
              <button
                key={usr.id}
                onClick={() => handleUserSelect(usr)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm flex justify-between items-center transition-colors ${
                  activeTitle.includes(usr.name)
                    ? "bg-blue-600 text-white"
                    : "hover:bg-zinc-800 text-zinc-400"
                }`}
              >
                <span className="truncate">👤 {usr.name || "Member"}</span>
                <span
                  className={`h-2 w-2 rounded-full shrink-0 border border-zinc-950 ${
                    onlineUserIds.includes(usr.id)
                      ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                      : "bg-zinc-600"
                  }`}
                />
              </button>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
