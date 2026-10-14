"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

interface UserAccount {
  id: string;
  providerId: string;
  accountId: string;
}

export function ThirdPartyLoginSection() {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setError(null);
      const res = await authClient.listAccounts();
      if (res.data) {
        setAccounts(res.data as unknown as UserAccount[]);
      } else if (res.error) {
        setError(res.error.message || "Failed to load linked accounts");
      }
    } catch {
      setError("Failed to load linked accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const googleAccount = accounts.find((acc) => acc.providerId === "google");
  const isGoogleConnected = Boolean(googleAccount);

  const handleConnect = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await authClient.linkSocial({
        provider: "google",
        callbackURL: "/settings",
      });
    } catch {
      setError("Failed to connect Google account");
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!googleAccount) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await authClient.unlinkAccount({
        accountId: googleAccount.id,
      });
      if (res.error) {
        setError(res.error.message || "Failed to disconnect Google account");
      } else {
        await fetchAccounts();
      }
    } catch {
      setError("Failed to disconnect Google account");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg">Third-party Logins</h2>
        <p className="text-muted-foreground text-sm">
          Connect your accounts to enable single click login.
        </p>
      </div>

      {error ? <p className="mt-4 text-destructive text-xs">{error}</p> : null}

      <div className="mt-4">
        {loading ? (
          <div className="py-4 text-center text-muted-foreground text-sm">
            <Loader2 className="mx-auto size-5 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg border bg-background p-2 shadow-2xs">
                <svg
                  viewBox="0 0 24 24"
                  className="size-4 shrink-0"
                  aria-hidden="true"
                >
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
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">Google</p>
                  {isGoogleConnected ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-[0.7rem] text-emerald-600 dark:text-emerald-400">
                      Connected
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {isGoogleConnected
                    ? "Your Google account is linked for sign in."
                    : "Link your Google account to log in with one click."}
                </p>
              </div>
            </div>

            {isGoogleConnected ? (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleDisconnect}
              >
                {actionLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                <span>Disconnect</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleConnect}
              >
                {actionLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                <span>Connect</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
