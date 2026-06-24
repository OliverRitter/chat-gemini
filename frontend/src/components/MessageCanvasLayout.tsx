"use client";

import { RefObject } from "react";
import { RelativeTime } from "@/components/relative-time";

interface MessageCanvasLayoutProps {
  containerRef: RefObject<HTMLDivElement | null>;
  topSentinelRef: RefObject<HTMLDivElement | null>;
  currentChannelMessages: any[];
  session: any;
  showNewMessageBadge: boolean;
  scrollToBottomViewport: () => void;
  handleScrollTracking: () => void;
  hasMoreMessages: boolean;
}

export function MessageCanvasLayout({
  containerRef,
  topSentinelRef,
  currentChannelMessages,
  session,
  showNewMessageBadge,
  scrollToBottomViewport,
  handleScrollTracking,
  hasMoreMessages,
}: MessageCanvasLayoutProps) {
  return (
    // 🚀 CRITICAL REPAIR: Ensure the wrapper element is 'relative' so absolute buttons anchor flawlessly
    <div className="flex-1 min-h-0 relative w-full flex flex-col">
      {/* SCROLLABLE VIEWPORT CANVAS */}
      <div
        ref={containerRef}
        onScroll={handleScrollTracking} // Clears badge automatically if they scroll to bottom manually
        className="flex-1 overflow-y-auto p-6 min-h-0 bg-zinc-900/30 flex flex-col"
      >
        <div className="flex flex-col gap-3 w-full min-w-0 flex-1">
          <div
            ref={topSentinelRef}
            className="h-1 w-full opacity-0 pointer-events-none shrink-0"
          />
          {currentChannelMessages.map((msg: any, index: number) => {
            const isMe = (msg.senderId || msg.userId) === session.user.id;
            const textContent = msg.text || msg.content || "";

            const senderLabel = isMe
              ? "You"
              : msg.senderName || msg.sender?.name || msg.user?.name || "Them";

            return (
              <div
                key={msg.id || index}
                className={`flex flex-col w-full min-w-0 ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`p-3 rounded-2xl text-sm shadow-md max-w-[75%] break-all break-words whitespace-pre-wrap [word-break:break-word] overflow-hidden flex flex-col ${
                    isMe
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700"
                  }`}
                >
                  {/* Image Attachment check */}
                  {textContent.startsWith("🖼️ Attached Image:") ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs opacity-75 italic block mb-1">
                        Sent an image:
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={textContent
                          .replace("🖼️ Attached Image: ", "")
                          .trim()}
                        alt="Chat attachment"
                        className="rounded-lg max-w-full h-auto max-h-[300px] object-cover border border-black/20 shadow-inner"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    textContent
                  )}
                  <div className="flex justify-between items-center text-gray-100/40 border-t-amber-950/20 border-t mt-2.5">
                    <RelativeTime timestamp={msg.createdAt} />
                    <span className="text-[10px] ml-6 text-gray-100/40">
                      {senderLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🌟 FLOATING NOTIFICATION BADGE: PINNED TO THE BOTTOM CENTER OF THE ACTIVE CHAT TIMELINE */}
      {showNewMessageBadge && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 animate-bounce">
          <button
            onClick={scrollToBottomViewport}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-full py-2.5 px-4 shadow-[0_4px_16px_rgba(0,0,0,0.65)] flex items-center gap-2 border border-blue-400/30 transition-all active:scale-95 tracking-wide uppercase"
          >
            <span className="text-sm">⬇️</span> New messages below
          </button>
        </div>
      )}
    </div>
  );
}
