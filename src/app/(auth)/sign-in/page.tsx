import type { Metadata } from "next";

import { SignInForm } from "@/components/features/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Wangku account",
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export const instant = false;

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl = "/" } = await searchParams;

  return <SignInForm callbackUrl={callbackUrl} />;
}
