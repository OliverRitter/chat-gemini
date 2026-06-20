"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { resetPasswordWithTokenAction } from "@/app/actions/password-actions";

// Form input structure matching validation rules
const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("resetToken");
  const emailParam = searchParams.get("email");

  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    if (!tokenParam || !emailParam) {
      setServerError(
        "Missing secure link parameters. Try requesting another email.",
      );
      return;
    }

    setServerError(null);
    setLoading(true);

    try {
      // 🔑 CALLS YOUR NEW SECURE DIRECT DATABASE UPDATER OVERWRITING THE 400 ERROR!
      const res = await resetPasswordWithTokenAction(
        tokenParam,
        emailParam,
        values.password,
      );

      if (res.error) {
        setServerError(res.error);
        setLoading(false);
      } else {
        alert(
          "🎉 Password updated successfully! You can now log in using your new credentials.",
        );
        if (typeof window !== "undefined") {
          window.location.replace("/");
        }
      }
    } catch (err) {
      setServerError("Connection failure. Check your server terminal.");
      setLoading(false);
    }
  };

  // Prevent accessing the route if parameters are empty
  if (!tokenParam || !emailParam) {
    return (
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl text-center space-y-4">
        <span className="text-4xl">❌</span>
        <h1 className="text-xl font-bold text-white">Access Denied</h1>
        <p className="text-sm text-zinc-400">
          This route can only be accessed via a secure link fired to your email
          address.
        </p>
        <Button
          onClick={() => (window.location.href = "/")}
          className="w-full bg-zinc-800 hover:bg-zinc-700"
        >
          Return Home
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl shadow-xl space-y-6">
      <div className="space-y-1 text-center md:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Configure New Password
        </h1>
        <p className="text-xs text-zinc-400">
          Type your fresh security password for{" "}
          <span className="text-blue-400">{emailParam}</span> below.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
            {serverError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-400">
            New Password
          </label>
          <input
            type="password"
            disabled={loading}
            {...register("password")}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-white focus:outline-none focus:border-blue-500"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-xs text-destructive mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-400">
            Confirm New Password
          </label>
          <input
            type="password"
            disabled={loading}
            {...register("confirmPassword")}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-white focus:outline-none focus:border-blue-500"
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          disabled={loading}
        >
          {loading ? "Updating credentials..." : "Update Password & Log In"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 font-sans p-4 antialiased text-zinc-100">
      <Suspense
        fallback={
          <div className="text-zinc-400 text-sm">
            Loading recovery frameworks...
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
