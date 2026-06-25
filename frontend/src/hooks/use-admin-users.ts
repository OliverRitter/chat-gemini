"use client";

import { useState, useEffect, useRef } from "react";
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

  // 🚀 NEW: RE-ORDERING STATES TRACKED IN MEMORY
  const [sortByField, setSortByField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");

  const isInitialMount = useRef(true);
  const adminId = session?.user?.id;

  const fetchUsers = async (
    cursor: string | null = null,
    direction: "next" | "prev" = "next",
  ) => {
    if (!adminId) return;
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
        sortDirection, // 🚀 PASS VARIABLES
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
  };

  useEffect(() => {
    if (adminId && session?.user?.role === "admin") fetchUsers(null, "next");
  }, [adminId]);

  // Inside src/hooks/use-admin-users.ts - Look at your second useEffect debouncer loop:

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!adminId) return;

    // 🚀 STABILITY ADJUSTMENT: When filters or sort column rules shift,
    // force a reset to page 1 by clearing cursors completely!
    const delayDebounce = setTimeout(() => {
      fetchUsers(null, "next");
    }, 400);

    return () => clearTimeout(delayDebounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchFilter,
    authProvider,
    emailVerified,
    minMessageCount,
    createdAfter,
    sortByField,
    sortDirection,
    adminId,
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
