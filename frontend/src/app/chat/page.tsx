"use client";

import { authClient } from "@/lib/auth-client";
import { useSocketSync } from "@/hooks/use-socket-sync";
import { ConnectedWorkspace } from "@/components/ConnectedWorkspace";

export default function ChatDashboardPage() {
  useSocketSync();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-zinc-500 bg-zinc-900">
        Validating user profiles...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-zinc-500 bg-zinc-900">
        Access Denied. Please log in.
      </div>
    );
  }

  return <ConnectedWorkspace session={session} />;
}
