// src/app/page.tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AuthForm } from "@/components/auth-form";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";

export default function GlobalHomepage() {
  const { data: session, isPending } = authClient.useSession();

  // Tracks whether the active panel should show the login card or register card
  const [showLoginPanel, setShowLoginPanel] = useState(true);

  if (isPending) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-background text-muted-foreground font-sans">
        Checking infrastructure session arrays...
      </div>
    );
  }

  return (
    <main className="min-h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground font-sans p-4 antialiased">
      {/* TOP DEPLOYMENT STATUS GREETING CAPSULE */}
      <div className="text-center space-y-2 mb-8 max-w-md">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Enterprise Chat Node
        </h1>
        <p className="text-sm text-muted-foreground">
          Secure, low-latency cross-device messaging engine powered by
          WebSockets.
        </p>
      </div>

      {session ? (
        /* PANEL A: USER SESSION RECOGNIZED ACTIVE */
        <div className="text-center space-y-4 bg-card p-8 rounded-xl border border-border max-w-sm w-full shadow-md">
          <p className="text-sm text-muted-foreground">
            Active session recognized for{" "}
            <strong className="text-foreground">{session.user.name}</strong>
          </p>
          <Button
            onClick={() => (window.location.href = "/chat")}
            className="w-full"
          >
            Enter Chat Workspace
          </Button>
          <Button
            variant="outline"
            onClick={() => authClient.signOut()}
            className="w-full text-muted-foreground hover:text-destructive"
          >
            Disconnect Session
          </Button>
        </div>
      ) : (
        /* PANEL B: GUEST SYSTEM ENTRY GATEWAY */
        <div className="w-full max-w-md space-y-4">
          {/* Reactive Form Box Container Toggles */}
          {showLoginPanel ? <LoginForm /> : <AuthForm />}

          {/* Core Footer Link Toggles */}
          <div className="text-center">
            <button
              onClick={() => setShowLoginPanel(!showLoginPanel)}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              {showLoginPanel
                ? "Don't have an account yet? Create one here"
                : "Already have an account? Sign in here"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
