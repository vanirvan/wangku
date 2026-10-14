"use client";

import { Laptop, Loader2, Monitor, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth/auth-client";

interface SessionItem {
  id: string;
  token: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId: string;
}

// ponytail: basic UA sniffing; upgrade to UAParser if device models are requested
function parseUserAgent(ua?: string | null) {
  if (!ua) return { device: "Unknown Device", icon: Monitor };
  const lower = ua.toLowerCase();
  const icon = /mobile|android|iphone|ipad/.test(lower)
    ? Smartphone
    : /macintosh|windows|linux/.test(lower)
      ? Laptop
      : Monitor;

  let browser = "Browser";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/") && !lower.includes("chrome/"))
    browser = "Safari";

  let os = "Unknown OS";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os") || lower.includes("macintosh"))
    os = "macOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("linux")) os = "Linux";

  return { device: `${browser} on ${os}`, icon };
}

function formatDate(dateVal: Date | string) {
  try {
    const date = new Date(dateVal);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(dateVal);
  }
}

export function DeviceSessionsSection() {
  const { data: currentSessionData } = useSession();
  const currentToken = currentSessionData?.session?.token;

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const res = await authClient.listSessions();
      if (res.data) {
        setSessions(res.data as unknown as SessionItem[]);
      } else if (res.error) {
        setError(res.error.message || "Failed to load active sessions");
      }
    } catch {
      setError("Failed to load active sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (token: string) => {
    setRevokingToken(token);
    setError(null);
    try {
      const res = await authClient.revokeSession({ token });
      if (res.error) {
        setError(res.error.message || "Failed to revoke session");
      } else {
        await fetchSessions();
      }
    } catch {
      setError("Failed to revoke session");
    } finally {
      setRevokingToken(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokingOthers(true);
    setError(null);
    try {
      const res = await authClient.revokeOtherSessions();
      if (res.error) {
        setError(res.error.message || "Failed to revoke other sessions");
      } else {
        await fetchSessions();
      }
    } catch {
      setError("Failed to revoke other sessions");
    } finally {
      setRevokingOthers(false);
    }
  };

  const otherSessionsCount = sessions.filter(
    (s) => s.token !== currentToken,
  ).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">Active Sessions</h2>
          <p className="text-muted-foreground text-sm">
            Manage devices and browsers currently logged into your account.
          </p>
        </div>

        {otherSessionsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={revokingOthers}
            onClick={handleRevokeOtherSessions}
          >
            {revokingOthers ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            <span>Revoke other sessions</span>
          </Button>
        )}
      </div>

      {error ? <p className="mt-4 text-destructive text-xs">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            <Loader2 className="mx-auto size-5 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-4 text-muted-foreground text-sm">
            No active sessions found.
          </p>
        ) : (
          sessions.map((session) => {
            const isCurrent = session.token === currentToken;
            const { device, icon: DeviceIcon } = parseUserAgent(
              session.userAgent,
            );

            return (
              <div
                key={session.id || session.token}
                className="flex flex-col justify-between gap-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md border bg-muted/40 p-2 text-muted-foreground">
                    <DeviceIcon className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{device}</p>
                      {isCurrent ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[0.7rem] text-primary">
                          Current session
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
                      <span>{session.ipAddress || "Unknown IP"}</span>
                      <span>•</span>
                      <span>{formatDate(session.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {!isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-center"
                    disabled={revokingToken === session.token}
                    onClick={() => handleRevokeSession(session.token)}
                  >
                    {revokingToken === session.token ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    <span>Revoke</span>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
