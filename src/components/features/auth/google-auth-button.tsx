"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { signIn } from "@/lib/auth/auth-client";

interface GoogleAuthButtonProps {
  callbackUrl?: string;
  onError?: (error: string | null) => void;
  disabled?: boolean;
}

export function GoogleAuthButton({
  callbackUrl = "/",
  onError,
  disabled = false,
}: GoogleAuthButtonProps) {
  const [isPending, setIsPending] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsPending(true);
      onError?.(null);
      const res = await signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
      });

      if (res?.error) {
        onError?.(res.error.message || "Failed to sign in with Google");
        setIsPending(false);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in with Google";
      onError?.(message);
      setIsPending(false);
    }
  };

  const isDisabled = disabled || isPending;

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={isDisabled}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-border/80 bg-background px-4 font-medium text-sm text-foreground shadow-2xs transition-all hover:bg-muted/50 hover:border-border active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
          />
        </svg>
      )}
      <span>Continue with Google</span>
    </button>
  );
}
