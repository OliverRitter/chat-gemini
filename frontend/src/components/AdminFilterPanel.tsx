"use client";

interface AdminFilterPanelProps {
  // Filters State Props
  searchFilter: string;
  authProvider: string;
  emailVerified: string;
  minMessageCount: number;
  createdAfter: string;
  sortByField: string;
  sortDirection: string;

  // Actions Updater Props
  setSearchFilter: (val: string) => void;
  setAuthProvider: (val: string) => void;
  setEmailVerified: (val: string) => void;
  setMinMessageCount: (val: number) => void;
  setCreatedAfter: (val: string) => void;
  setSortByField: (val: string) => void;
  setSortDirection: (val: string) => void;
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
  sortByField,
  setSortByField,
  sortDirection,
  setSortDirection,
}: AdminFilterPanelProps) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {/* TEXT SEARCH */}
      <div className="flex flex-col space-y-1">
        <label className="text-[10px] text-zinc-500 font-bold uppercase">
          Text Search
        </label>
        <input
          type="text"
          placeholder="Search..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none focus:border-zinc-700"
        />
      </div>

      {/* LOGIN PROVIDER */}
      <div className="flex flex-col space-y-1">
        <label className="text-[10px] text-zinc-500 font-bold uppercase">
          Login Provider
        </label>
        <select
          value={authProvider}
          onChange={(e) => setAuthProvider(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
        >
          <option value="all">🌐 All Providers</option>
          <option value="google">📬 Google</option>
          <option value="credential">🔑 Password</option>
        </select>
      </div>

      {/* EMAIL STATUS */}
      <div className="flex flex-col space-y-1">
        <label className="text-[10px] text-zinc-500 font-bold uppercase">
          Email Status
        </label>
        <select
          value={emailVerified}
          onChange={(e) => setEmailVerified(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
        >
          <option value="all">📜 All Statuses</option>
          <option value="verified">✅ Verified</option>
          <option value="unverified">❌ Unverified</option>
        </select>
      </div>

      {/* ACTIVITY LEVEL */}
      <div className="flex flex-col space-y-1">
        <label className="text-[10px] text-zinc-500 font-bold uppercase">
          Activity Level
        </label>
        <select
          value={minMessageCount}
          onChange={(e) => setMinMessageCount(Number(e.target.value))}
          className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
        >
          <option value={0}>💬 0+ Messages</option>
          <option value={1}>💬 1+ Messages</option>
          <option value={5}>🔥 5+ Messages</option>
          <option value={10}>⚡ 10+ Messages</option>
        </select>
      </div>

      {/* REGISTERED SINCE */}
      <div className="flex flex-col space-y-1">
        <label className="text-[10px] text-zinc-500 font-bold uppercase">
          Registered Since
        </label>
        <input
          type="date"
          value={createdAfter}
          onChange={(e) => setCreatedAfter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-zinc-200 focus:outline-none"
        />
      </div>

      {/* SORT BY FIELD */}
      <div className="flex flex-col space-y-1">
        <label className="text-[10px] text-zinc-500 font-bold uppercase">
          Sort By Field
        </label>
        <select
          value={sortByField}
          onChange={(e) => setSortByField(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-blue-400 focus:outline-none"
        >
          <option value="createdAt">⏰ Registration Date</option>
          <option value="name">🔤 User Name (A-Z)</option>
          <option value="email">📧 Email Address</option>
        </select>
      </div>

      {/* SORTING VECTOR */}
      <div className="flex flex-col space-y-1">
        <label className="text-[10px] text-zinc-500 font-bold uppercase">
          Sorting Vector
        </label>
        <select
          value={sortDirection}
          onChange={(e) => setSortDirection(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-xs rounded p-2 text-blue-400 focus:outline-none"
        >
          <option value="desc">📉 Descending</option>
          <option value="asc">📈 Ascending</option>
        </select>
      </div>
    </div>
  );
}
