// src/hooks/use-smart-scroll.ts
import { useEffect, useRef } from "react";

interface SmartScrollProps {
  messagesLength: number;
  latestSenderId: string | undefined;
  currentUserId: string | undefined;
}

export function useSmartScroll({
  messagesLength,
  latestSenderId,
  currentUserId,
}: SmartScrollProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const anchor = bottomAnchorRef.current;
    if (!container || !anchor || messagesLength === 0) return;

    requestAnimationFrame(() => {
      const amISender = latestSenderId === currentUserId;

      // 1. SENDER RULE: Always snap down for your own messages
      if (amISender) {
        anchor.scrollIntoView({ behavior: "smooth", block: "end" });
        return;
      }

      // 2. RECEIVER ERGONOMIC CUSHION: Increased threshold to 400px
      // This creates a "gravity zone." If you are within 400 pixels of the bottom,
      // the app knows you are still casually reading live chat and pulls you down.
      const THRESHOLD = 400;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      const isUserHangingNearBottom = distanceFromBottom <= THRESHOLD;

      if (isUserHangingNearBottom) {
        anchor.scrollIntoView({ behavior: "smooth", block: "end" });
      }
      // If they are higher than 400px, they are deep in reading old logs, so they freeze safely!
    });
  }, [messagesLength, latestSenderId, currentUserId]);

  return { containerRef, bottomAnchorRef };
}
