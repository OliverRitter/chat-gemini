// src/components/chat-messages.tsx
"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { getChannelMessages } from "@/app/actions/chat-actions";

interface ChatMessagesProps {
  currentUserId: string;
  currentPage: number;
  hasMoreMessages: boolean;
  onPageChange: (nextPage: number) => void;
  onHasMoreChange: (hasMore: boolean) => void;
}

// 🟩 Helper function to check for image urls
const IMAGE_REGEX = /\.(jpeg|jpg|gif|png|svg|webp)$/i;
function renderMessageContent(content: string) {
  const isImage =
    IMAGE_REGEX.test(content) ||
    content.startsWith("data:image/") ||
    content.includes("://unsplash.com");

  if (isImage) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-zinc-800 max-w-sm max-h-60 bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={content}
          alt="Shared media artifact"
          className="w-full h-full object-contain max-h-60 block hover:opacity-90 transition-opacity cursor-pointer"
          onClick={() => window.open(content, "_blank")}
        />
      </div>
    );
  }
  return <p className="text-sm text-zinc-200 break-words">{content}</p>;
}

export function ChatMessages({
  currentUserId,
  currentPage,
  hasMoreMessages,
  onPageChange,
  onHasMoreChange,
}: ChatMessagesProps) {
  const activeChannelId = useChatStore((state) => state.activeChannelId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingPage = useRef(false);

  const messages = useChatStore((state) =>
    activeChannelId ? state.messagesByChannel[activeChannelId] || [] : [],
  );

  // Infinite Scroll Pagination
  useEffect(() => {
    if (!activeChannelId || !hasMoreMessages || messages.length === 0) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const container = containerRef.current;
        if (entries[0].isIntersecting && container && !isFetchingPage.current) {
          isFetchingPage.current = true;
          const nextPage = currentPage + 1;

          try {
            const previousHeight = container.scrollHeight;
            const olderHistory = await getChannelMessages(
              activeChannelId,
              nextPage,
            );

            if (olderHistory && olderHistory.length > 0) {
              useChatStore
                .getState()
                .prependHistoricalMessages(activeChannelId, olderHistory);
              onPageChange(nextPage);

              setTimeout(() => {
                container.scrollTop = container.scrollHeight - previousHeight;
                isFetchingPage.current = false;
              }, 10);
            } else {
              onHasMoreChange(false);
              isFetchingPage.current = false;
            }
          } catch (err) {
            console.error("Failed loading history:", err);
            isFetchingPage.current = false;
          }
        }
      },
      { root: containerRef.current, threshold: 1.0 },
    );

    const sentinel = topSentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [
    activeChannelId,
    currentPage,
    hasMoreMessages,
    messages.length,
    onPageChange,
    onHasMoreChange,
  ]);

  // Smart Auto-Scroll Pinning
  useEffect(() => {
    const container = containerRef.current;
    if (!container || messages.length === 0) return;

    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distance <= 400;

    const lastMsg = messages[messages.length - 1];
    const amISender = (lastMsg?.senderId || lastMsg?.userId) === currentUserId;

    if (amISender || isAtBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, activeChannelId, currentUserId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-6 min-h-0 bg-zinc-900/30 flex flex-col"
    >
      <div className="flex flex-col gap-3 w-full min-w-0 flex-1">
        <div
          ref={topSentinelRef}
          className="h-1 w-full opacity-0 pointer-events-none shrink-0"
        />

        {messages.map((msg: any) => (
          <div
            key={msg.id}
            className="flex flex-col bg-zinc-950/40 border border-zinc-800/60 rounded-lg p-3 max-w-xl self-start"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold text-zinc-300">
                {msg.senderName || "User"}
              </span>
              <span className="text-[10px] text-zinc-600">
                {msg.createdAt
                  ? new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
            </div>
            {/* 🟩 Uses image detection engine helper */}
            {renderMessageContent(msg.content)}
          </div>
        ))}
      </div>
    </div>
  );
}
