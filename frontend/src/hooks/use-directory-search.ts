"use client";

import { useEffect } from "react";
import {
  getDirectoryData,
  searchGlobalChannels,
  searchNewUsers,
} from "@/app/actions/user-actions";

interface SidebarItem {
  id: string;
  name: string;
  isUser?: boolean;
}

interface UseDirectorySearchProps {
  channelSearchQuery: string;
  userSearchQuery: string;
  setChannelsList: React.Dispatch<React.SetStateAction<SidebarItem[]>>;
  setUsersList: React.Dispatch<React.SetStateAction<SidebarItem[]>>;
}

export function useDirectorySearch({
  channelSearchQuery,
  userSearchQuery,
  setChannelsList,
  setUsersList,
}: UseDirectorySearchProps) {
  // 1. Debounced Group Channel Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!channelSearchQuery) {
        const originalData = await getDirectoryData().catch(() => null);
        if (originalData) setChannelsList(originalData.channels || []);
        return;
      }
      try {
        const channelResults = await searchGlobalChannels(channelSearchQuery);
        setChannelsList(
          (channelResults || []).map((ch) => ({ id: ch.id, name: ch.name })),
        );
      } catch (err) {
        console.error("Failed to query global channels:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [channelSearchQuery, setChannelsList]);

  // 2. Debounced Coworker User Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!userSearchQuery) {
        const originalData = await getDirectoryData().catch(() => null);
        if (originalData) {
          setUsersList(
            (originalData.users || []).map((u) => ({ ...u, isUser: true })),
          );
        }
        return;
      }
      try {
        const searchResults = await searchNewUsers(userSearchQuery);
        setUsersList(
          (searchResults || []).map((u) => ({
            id: u.id,
            name: u.name,
            isUser: true,
          })),
        );
      } catch (err) {
        console.error("Failed to query user directory:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [userSearchQuery, setUsersList]);
}
