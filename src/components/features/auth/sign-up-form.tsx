"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { GoogleAuthButton } from "@/components/features/auth/google-auth-button";
import { signUp } from "@/lib/auth/auth-client";
import {
  type SignUpValues,
  signUpSchema,
} from "@/services/features/auth/schema";

interface SignUpFormProps {
  callbackUrl?: string;
}

export function SignUpForm({ callbackUrl = "/" }: SignUpFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignUpValues) => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
        callbackURL: callbackUrl,
      });

      if (res.error) {
        setError(res.error.message || "Failed to create account.");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px]">
      {/* Title & Subtitle */}
      <div className="mb-8">
        <h1 className="font-bold text-3xl sm:text-4xl tracking-tight text-foreground">
          Create an account
        </h1>
        <p className="mt-1 font-medium text-2xl sm:text-3xl tracking-tight text-muted-foreground/60">
          Start your financial journey
        </p>
      </div>

      {/* Social Button */}
      <GoogleAuthButton
        callbackUrl={callbackUrl}
        onError={setError}
        disabled={isLoading}
      />

      {/* Divider */}
      <div className="relative my-6 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/70" />
        </div>
        <span className="relative bg-background px-3 text-xs text-muted-foreground">
          or
        </span>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <div>
          <input
            {...register("name")}
            type="text"
            placeholder="Full name"
            disabled={isLoading}
            className="h-11 w-full rounded-full border border-border/80 bg-background px-4 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          {errors.name && (
            <p className="mt-1 px-3 text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <input
            {...register("email")}
            type="email"
            placeholder="janesmith@example.com"
            disabled={isLoading}
            className="h-11 w-full rounded-full border border-border/80 bg-background px-4 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          {errors.email && (
            <p className="mt-1 px-3 text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="relative">
          <input
            {...register("password")}
            type={showPassword ? "text" : "password"}
            placeholder="Create a password (min. 6 characters)"
            disabled={isLoading}
            className="h-11 w-full rounded-full border border-border/80 bg-background px-4 pr-11 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
          {errors.password && (
            <p className="mt-1 px-3 text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground font-semibold text-sm text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Create account with email"
          )}
        </button>
      </form>

      {/* Switch between Sign Up / Sign In */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/sign-in${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
        >
          Sign in
        </Link>
      </p>

      {/* Disclaimer as in attachment */}
      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/70">
        By signing up, you agree to the{" "}
        <Link
          href="#terms"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Terms of Use
        </Link>
        ,{" "}
        <Link
          href="#privacy"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Privacy Notice
        </Link>
        , and{" "}
        <Link
          href="#cookies"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Cookie Notice
        </Link>
        .
      </p>
    </div>
  );
}
