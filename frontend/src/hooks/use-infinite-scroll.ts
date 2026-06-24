"use client";

import { useEffect, MutableRefObject } from "react";
import { useChatStore } from "@/store/use-chat-store";
import { getChannelMessages } from "@/app/actions/chat-actions";

interface UseInfiniteScrollProps {
  activeChannelId: string | null;
  hasMoreMessages: boolean;
  currentChannelMessages: any[];
  currentPage: number;
  setCurrentPage: (page: number) => void;
  setHasMoreMessages: (hasMore: boolean) => void;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  topSentinelRef: MutableRefObject<HTMLDivElement | null>;
  isFetchingPage: MutableRefObject<boolean>;
}

export function useInfiniteScroll({
  activeChannelId,
  hasMoreMessages,
  currentChannelMessages,
  currentPage,
  setCurrentPage,
  setHasMoreMessages,
  containerRef,
  topSentinelRef,
  isFetchingPage,
}: UseInfiniteScrollProps) {
  useEffect(() => {
    if (
      !activeChannelId ||
      !hasMoreMessages ||
      currentChannelMessages.length === 0
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        const firstEntry = entries[0];
        const container = containerRef.current;

        if (firstEntry.isIntersecting && container && !isFetchingPage.current) {
          isFetchingPage.current = true;
          const nextPage = currentPage + 1;

          try {
            const previousScrollHeight = container.scrollHeight;
            const olderHistory = await getChannelMessages(
              activeChannelId,
              nextPage,
            );

            if (olderHistory && olderHistory.length > 0) {
              useChatStore
                .getState()
                .prependHistoricalMessages(activeChannelId, olderHistory);
              setCurrentPage(nextPage);

              setTimeout(() => {
                container.scrollTop =
                  container.scrollHeight - previousScrollHeight;
                isFetchingPage.current = false;
              }, 10);
            } else {
              setHasMoreMessages(false);
              isFetchingPage.current = false;
            }
          } catch (err) {
            console.error("Failed to load paginated history logs:", err);
            isFetchingPage.current = false;
          }
        }
      },
      {
        root: containerRef.current,
        threshold: 1.0,
      },
    );

    const currentSentinel = topSentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) observer.unobserve(currentSentinel);
    };
  }, [
    activeChannelId,
    currentPage,
    hasMoreMessages,
    currentChannelMessages.length,
    containerRef,
    topSentinelRef,
    isFetchingPage,
    setCurrentPage,
    setHasMoreMessages,
  ]);
}
