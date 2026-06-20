"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

function VerifyContent() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");
  const errorParam = searchParams.get("error");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState(
    "Authenticating your secure link profile...",
  );
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // 1. BACKUP SHIELD: Check if the user is already authenticated/verified first
    async function checkExistingSession() {
      try {
        const sessionRes = await authClient.getSession();
        if (sessionRes?.data?.user?.emailVerified) {
          setStatus("success");
          setMessage(
            "Your account has been successfully verified and activated!",
          );
          return true;
        }
      } catch (e) {
        console.error("Session check skipped");
      }
      return false;
    }

    async function executeVerification() {
      // Prioritize checking if the user is already verified to stop URL parameter wiping bugs
      const alreadyVerified = await checkExistingSession();
      if (alreadyVerified) return;

      // A. Intercept pre-existing server redirect error codes
      if (errorParam) {
        setStatus("error");
        setMessage(
          errorParam === "TOKEN_EXPIRED"
            ? "Your verification link has expired. Please use the button below to request a new one."
            : "Invalid or corrupted security link token configuration.",
        );
        return;
      }

      // B. If the token parameter is genuinely missing from the address bar
      if (!tokenParam) {
        setStatus("error");
        setMessage("Missing secure verification token payload.");
        return;
      }

      // C. StrictMode Protection Check
      if (hasTriggeredRef.current) return;
      hasTriggeredRef.current = true;

      // D. Actively send token parameter back to Better-Auth's verification handler
      try {
        const { error } = await authClient.verifyEmail({
          token: tokenParam as string,
        });

        if (error) {
          setStatus("error");
          setMessage(error.message || "Verification failed or token expired.");
        } else {
          setStatus("success");
          setMessage(
            "Your account has been successfully verified and activated!",
          );
        }
      } catch (err) {
        setStatus("error");
        setMessage("Failed to communicate with authentication servers.");
      }
    }

    executeVerification();
  }, [tokenParam, errorParam]);

  const handleResendNewLink = async () => {
    const emailInput = prompt("Please confirm your registered email address:");
    if (!emailInput || !emailInput.trim()) return;

    setIsResending(true);
    setResendStatus(null);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: emailInput.trim().toLowerCase(),
        callbackURL: "/auth/verify",
      });

      if (error) {
        setResendStatus(`❌ Error: ${error.message}`);
      } else {
        setResendStatus(
          "📩 Success! A brand-new activation link has been sent to your inbox.",
        );
      }
    } catch (err) {
      setResendStatus("❌ Failed to contact the authentication server.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl space-y-6 text-center">
      <div className="text-4xl">
        {status === "loading" && "⏳"}
        {status === "success" && "✅"}
        {status === "error" && "❌"}
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {status === "loading" && "Processing Link"}
          {status === "success" && "Account Activated"}
          {status === "error" && "Verification Failed"}
        </h1>
        <p className="text-sm text-zinc-400">{message}</p>
      </div>

      {resendStatus && (
        <div
          className={`p-3 text-xs rounded-lg font-medium border ${
            resendStatus.startsWith("❌")
              ? "bg-red-500/10 text-red-400 border-red-500/20"
              : "bg-green-500/10 text-green-400 border-green-500/20"
          }`}
        >
          {resendStatus}
        </div>
      )}

      <div className="pt-2 space-y-3">
        {status === "success" ? (
          <Button
            onClick={() => (window.location.href = "/chat")}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg text-white"
          >
            Enter Chat Workspace
          </Button>
        ) : (
          <>
            <Button
              onClick={handleResendNewLink}
              disabled={isResending}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg font-medium text-sm transition-colors"
            >
              {isResending
                ? "Sending fresh link..."
                : "Request a New Verification Link"}
            </Button>
            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
              className="w-full border-zinc-700 text-zinc-300"
            >
              Return to Login Screen
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthVerifyPage() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 font-sans p-4 antialiased text-zinc-100">
      <Suspense
        fallback={
          <div className="text-zinc-400 text-sm">
            Loading verification frameworks...
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  );
}
