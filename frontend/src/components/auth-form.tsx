"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const authSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type AuthFormValues = z.infer<typeof authSchema>;

export function AuthForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Track if the registration succeeded to change the view panel inline
  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
  });

  const onSubmit = async (values: AuthFormValues) => {
    setServerError(null);
    setServerSuccess(null);
    setLoading(true);
    try {
      const response = await authClient.signUp.email({
        email: values.email.toLowerCase().trim(),
        password: values.password,
        name: values.name.trim(),
      });

      if (response?.error) {
        setServerError(response.error.message || "Registration failed.");
      } else {
        // Switch the interface to the success view panel instantly
        setRegisteredEmail(values.email.toLowerCase().trim());
        setIsRegistered(true);
      }
    } catch (err) {
      setServerError("Connection error. Check your server configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendToken = async () => {
    setServerError(null);
    setServerSuccess(null);
    setLoading(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: registeredEmail,
        callbackURL: "/auth/verify",
      });

      if (error) {
        setServerError(error.message || "Could not resend email verification.");
      } else {
        setServerSuccess(
          "📩 A brand-new activation link has been sent to your inbox (check Spam)!",
        );
      }
    } catch (err) {
      setServerError("Failed to transmit email request.");
    } finally {
      setLoading(false);
    }
  };

  // 📬 POST-REGISTRATION SUCCESS VIEW STATE
  if (isRegistered) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-card rounded-xl border border-border shadow-md text-center space-y-4">
        <div className="text-4xl animate-bounce">📧</div>
        <h2 className="text-2xl font-bold mb-1">Verify Your Email</h2>
        <p className="text-sm text-muted-foreground">
          An activation link has been sent to{" "}
          <strong className="text-foreground">{registeredEmail}</strong>.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 p-3 rounded-lg border border-border">
          Please check your inbox and your{" "}
          <strong className="text-foreground">Spam/Junk folder</strong>. Click
          the link inside that email to activate your account.
        </p>

        {serverError && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
            {serverError}
          </div>
        )}

        {serverSuccess && (
          <div className="p-3 text-sm bg-green-500/10 text-green-600 border border-green-500/20 rounded-md font-medium">
            {serverSuccess}
          </div>
        )}

        <div className="pt-2 space-y-3">
          <Button
            onClick={handleResendToken}
            disabled={loading}
            variant="outline"
            className="w-full py-2.5 text-xs font-semibold"
          >
            {loading ? "Requesting link..." : "Resend Verification Link"}
          </Button>

          <Button
            onClick={() => window.location.reload()}
            variant="ghost"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  // STANDARD REGISTRATION VIEW STATE
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card rounded-xl border border-border shadow-md">
      <h2 className="text-2xl font-bold mb-1">Create Account</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Join the secure real-time workspace.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
            {serverError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            {...register("name")}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none"
            placeholder="John Doe"
          />
          {errors.name && (
            <p className="text-xs text-destructive mt-1">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Email Address
          </label>
          <input
            type="email"
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
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
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

        <div>
          <label className="block text-sm font-medium mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            {...register("confirmPassword")}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none"
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? "Registering account..." : "Complete Registration"}
        </Button>
      </form>
    </div>
  );
}
