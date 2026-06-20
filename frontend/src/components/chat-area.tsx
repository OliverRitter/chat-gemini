// src/components/chat-area.tsx
"use client";

import { useChatStore } from "@/store/use-chat-store";
import { useSmartScroll } from "@/hooks/use-smart-scroll";
import { ChatInputBar } from "@/components/chat-input-bar";

export function ChatArea({ userId }: { userId: string }) {
  const { activeChannelId, messagesByChannel } = useChatStore();
  const messages = activeChannelId
    ? messagesByChannel[activeChannelId] || []
    : [];
  const latestMessage = messages[messages.length - 1];

  // The scroll tracker logic is perfectly bound to this element layer
  const { containerRef, bottomAnchorRef } = useSmartScroll({
    messagesLength: messages.length,
    latestSenderId: latestMessage?.senderId,
    currentUserId: userId,
    isEnabled: true,
  });

  if (!activeChannelId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a channel to begin.
      </div>
    );
  }

  return (
    <main className="flex-1 h-full flex flex-col min-w-0 bg-background">
      {/* Scroll Box Layer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0"
      >
        <div className="flex flex-col gap-3">
          {messages.map((msg) => {
            const isMe = msg.senderId === userId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[70%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <div
                  className={`p-3 rounded-xl text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomAnchorRef} className="h-px w-full" />
      </div>

      <div className="p-4 border-t shrink-0">
        <ChatInputBar channelId={activeChannelId} />
      </div>
    </main>
  );
}
