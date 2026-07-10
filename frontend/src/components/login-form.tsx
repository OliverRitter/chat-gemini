"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { sendResetEmailAction } from "@/app/actions/reset-actions"; // 🔌 Shared server action hook

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    setLoading(true);
    try {
      const response = await authClient.signIn.email({
        email: values.email.toLowerCase().trim(),
        password: values.password,
      });

      if (response?.error) {
        const isUnverified =
          response.error.message?.toLowerCase().includes("verified") ||
          response.error.status === 403;

        if (isUnverified) {
          try {
            await authClient.sendVerificationEmail({
              email: values.email.toLowerCase().trim(),
              callbackURL: "/auth/verify",
            });
            setServerError(
              `Your email is not verified yet. We have automatically sent a brand-new activation link to ${values.email.toLowerCase().trim()} right now. Please check your Spam folder!`,
            );
          } catch (emailErr) {
            setServerError(
              "Your account is unverified, and we failed to auto-dispatch a new link. Please try again later.",
            );
          }
        } else {
          setServerError(
            response.error.message || "Invalid email or password.",
          );
        }
      } else {
        if (typeof window !== "undefined") {
          window.location.replace("/chat");
          return;
        }
      }
    } catch (err) {
      setServerError("Connection error. Is the backend server running?");
    } finally {
      setLoading(false);
    }
  };

  // 🔑 YOUR PASSWORD RESET LOGIC (Perfectly preserved)
  const handleForgotPassword = async () => {
    const emailInput = prompt(
      "Enter your account email address to receive a reset link:",
    );
    if (!emailInput || !emailInput.trim()) return;

    setServerError(null);
    setLoading(true);
    try {
      const result = await sendResetEmailAction(emailInput);
      if (result?.success) {
        alert(
          `Dispatched reset link to ${emailInput.trim().toLowerCase()}. Check your Spam folder.`,
        );
      }
    } catch (err: any) {
      setServerError(
        err.message || "Failed to process password reset request.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card rounded-xl border border-border shadow-md">
      <h2 className="text-2xl font-bold mb-1">Welcome Back</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Sign in to your real-time workspace.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md space-y-2">
            <p>{serverError}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Email Address
          </label>
          <input
            type="email"
            disabled={loading}
            {...register("email")}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none"
            placeholder="john@example.com"
          />
          {errors.email && (
            <p className="text-xs text-destructive mt-1">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium">Password</label>
            <button
              type="button"
              disabled={loading}
              onClick={handleForgotPassword}
              className="text-xs text-primary hover:underline font-medium"
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            disabled={loading}
            {...register("password")}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-xs text-destructive mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? "Authenticating Session..." : "Sign In"}
        </Button>

        {/* 🚀 RESTORED: Google Social Sign-In Button Block (Cleanly appended) */}
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or connect with
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={async () => {
              setServerError(null);
              setLoading(true);
              try {
                await authClient.signIn.social({
                  provider: "google",
                  callbackURL: "/chat",
                });
              } catch (err: any) {
                console.error("OAuth loop crash:", err);
                // 💡 Capture network dropouts gracefully
                if (
                  err.message?.includes("fetch") ||
                  !window.navigator.onLine
                ) {
                  setServerError(
                    "Authentication server is unreachable. Please check your connection.",
                  );
                } else {
                  setServerError("Failed to initialize Google login session.");
                }
              } finally {
                // Keep loading true if page is actively redirecting to Google
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-background hover:bg-muted border-input text-foreground h-[40px] text-sm font-semibold transition-colors"
          >
            <span>🌐</span> Sign In with Google
          </Button>
        </div>
      </form>
    </div>
  );
}
