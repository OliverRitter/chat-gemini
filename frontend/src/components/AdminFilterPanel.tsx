"use client";

interface AdminFilterPanelProps {
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  authProvider: string;
  setAuthProvider: (val: string) => void;
  emailVerified: string;
  setEmailVerified: (val: string) => void;
  minMessageCount: number;
  setMinMessageCount: (val: number) => void;
  createdAfter: string;
  setCreatedAfter: (val: string) => void;
  triggerSearch: (key: string, value: any) => void;
}

export function AdminFilterPanel({
  searchFilter,
  setSearchFilter,
  authProvider,
  setAuthProvider,
  emailVerified,
  setEmailVerified,
  minMessageCount,
  setMinMessageCount,
  createdAfter,
  setCreatedAfter,
  triggerSearch,
}: AdminFilterPanelProps) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <input
        type="text"
        placeholder="Search text matching..."
        value={searchFilter}
        onChange={(e) => {
          setSearchFilter(e.target.value);
          triggerSearch("search", e.target.value);
        }}
        className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none focus:border-zinc-700"
      />
      <select
        value={authProvider}
        onChange={(e) => {
          setAuthProvider(e.target.value);
          triggerSearch("provider", e.target.value);
        }}
        className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
      >
        <option value="all">🌐 All Providers</option>
        <option value="google">📬 Google</option>
        <option value="credential">🔑 Password Login</option>
      </select>
      <select
        value={emailVerified}
        onChange={(e) => {
          setEmailVerified(e.target.value);
          triggerSearch("verified", e.target.value);
        }}
        className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
      >
        <option value="all">📜 All Statuses</option>
        <option value="verified">✅ Verified</option>
        <option value="unverified">❌ Unverified</option>
      </select>
      <select
        value={minMessageCount}
        onChange={(e) => {
          setMinMessageCount(Number(e.target.value));
          triggerSearch("minMessages", Number(e.target.value));
        }}
        className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
      >
        <option value={0}>💬 0+ Messages</option>
        <option value={1}>💬 1+ Messages</option>
        <option value={5}>🔥 5+ Messages</option>
        <option value={10}>⚡ 10+ Messages</option>
      </select>
      <input
        type="date"
        value={createdAfter}
        onChange={(e) => {
          setCreatedAfter(e.target.value);
          triggerSearch("afterDate", e.target.value);
        }}
        className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
      />
    </div>
  );
}
