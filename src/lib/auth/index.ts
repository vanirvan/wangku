import type { User } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";

import { db } from "../db";
import * as schema from "../db/schemas";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});

export async function getSessionUser(): Promise<User | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return (session?.user as User) ?? null;
}

export async function requireAuthUser(): Promise<
  { user: User; error: null } | { user: null; error: { error: string } }
> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: { error: "Unauthorized" } };
  }
  return { user, error: null };
}
