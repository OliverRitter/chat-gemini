"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAdminUsersDirectory,
  toggleUserRoleAdmin,
  deleteUserAccountAdmin,
} from "@/app/actions/admin-actions";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  role: string | null;
}

export function useAdminUsers(session: any) {
  const [userRecords, setUserRecords] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [cursors, setCursors] = useState<{
    next: string | null;
    prev: string | null;
  }>({ next: null, prev: null });
  const [flags, setFlags] = useState({ hasNext: false, hasPrev: false });

  const [searchFilter, setSearchFilter] = useState("");
  const [authProvider, setAuthProvider] = useState("all");
  const [emailVerified, setEmailVerified] = useState("all");
  const [minMessageCount, setMinMessageCount] = useState(0);
  const [createdAfter, setCreatedAfter] = useState("");

  const [sortByField, setSortByField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");

  const adminId = session?.user?.id;
  const isAdmin = session?.user?.role === "admin";

  const fetchUsers = useCallback(
    async (
      cursor: string | null = null,
      direction: "next" | "prev" = "next",
    ) => {
      if (!adminId || !isAdmin) return;
      setIsLoading(true);
      try {
        const result = await getAdminUsersDirectory({
          adminUserId: adminId,
          queryText: searchFilter,
          authProvider,
          emailVerified,
          minMessageCount,
          createdAfter,
          cursor,
          direction,
          pageSize: 2,
          sortByField,
          sortDirection,
        });
        setUserRecords(result.users);
        setTotalCount(result.totalCount);
        setFlags({ hasNext: result.hasMoreNext, hasPrev: result.hasMorePrev });
        setCursors({
          next: result.nextCursorToken,
          prev: result.prevCursorToken,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      adminId,
      isAdmin,
      searchFilter,
      authProvider,
      emailVerified,
      minMessageCount,
      createdAfter,
      sortByField,
      sortDirection,
    ],
  );

  useEffect(() => {
    if (!adminId || !isAdmin) return;

    const delayDebounce = setTimeout(() => {
      fetchUsers(null, "next");
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [
    searchFilter,
    authProvider,
    emailVerified,
    minMessageCount,
    createdAfter,
    sortByField,
    sortDirection,
    adminId,
    isAdmin,
    fetchUsers,
  ]);

  const toggleRole = async (userId: string, currentRole: string | null) => {
    if (isProcessingId || !adminId) return;
    setIsProcessingId(userId);
    try {
      const result = await toggleUserRoleAdmin(adminId, userId, currentRole);
      setUserRecords((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: result.updatedRole } : u,
        ),
      );
    } catch (err) {
      alert("Failed to alter privileges.");
    } finally {
      setIsProcessingId(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (
      isProcessingId ||
      !adminId ||
      !window.confirm("Permanently delete this user?")
    )
      return;
    setIsProcessingId(userId);
    try {
      await deleteUserAccountAdmin(adminId, userId);
      setUserRecords((prev) => prev.filter((u) => u.id !== userId));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      alert("Failed to delete user account.");
    } finally {
      setIsProcessingId(null);
    }
  };

  return {
    state: {
      userRecords,
      isLoading,
      isProcessingId,
      totalCount,
      cursors,
      flags,
      searchFilter,
      authProvider,
      emailVerified,
      minMessageCount,
      createdAfter,
      sortByField,
      sortDirection,
    },
    actions: {
      setSearchFilter,
      setAuthProvider,
      setEmailVerified,
      setMinMessageCount,
      setCreatedAfter,
      setSortByField,
      setSortDirection,
      fetchUsers,
      toggleRole,
      deleteUser,
    },
  };
}
