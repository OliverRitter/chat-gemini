"use client";

import { RefObject } from "react";
import { RelativeTime } from "@/components/relative-time";

interface MessageDisplayProps {
  containerRef: RefObject<HTMLDivElement | null>;
  topSentinelRef: RefObject<HTMLDivElement | null>;
  handleScrollTracking: () => void;
  hasMoreMessages: boolean;
  currentChannelMessages: any[];
  showNewMessageBadge: boolean;
  scrollToBottomViewport: () => void;
}

export function MessageDisplay({
  containerRef,
  topSentinelRef,
  handleScrollTracking,
  hasMoreMessages,
  currentChannelMessages,
  showNewMessageBadge,
  scrollToBottomViewport,
}: MessageDisplayProps) {
  return (
    <div className="flex-1 min-h-0 relative w-full flex flex-col">
      {/* SCROLL WINDOW */}
      <div
        ref={containerRef}
        onScroll={handleScrollTracking}
        className="flex-1 overflow-y-auto p-6 bg-zinc-900/30 flex flex-col space-y-4"
      >
        {hasMoreMessages && currentChannelMessages.length > 0 && (
          <div
            ref={topSentinelRef}
            className="h-1 w-full bg-transparent shrink-0"
          />
        )}

        {currentChannelMessages.map((msg: any) => (
          <div
            key={msg.id}
            className="flex flex-col space-y-1 bg-zinc-950/40 border border-zinc-800/40 rounded-lg p-3 max-w-2xl"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-semibold text-blue-400 truncate">
                {msg.senderName || msg.userName || "User"}
              </span>
              <RelativeTime timestamp={msg.createdAt} />
            </div>
            <p className="text-sm text-zinc-200 break-words whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}
      </div>

      {/* FLOATING ACTION BADGE */}
      {showNewMessageBadge && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 animate-bounce">
          <button
            onClick={scrollToBottomViewport}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-full py-2 px-4 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center gap-2 border border-blue-400/20 transition-colors tracking-wide"
          >
            ⬇️ New messages below
          </button>
        </div>
      )}
    </div>
  );
}
