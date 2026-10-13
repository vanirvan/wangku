import type { Metadata } from "next";

import { SignUpForm } from "@/components/features/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Sign Up - Wangku",
  description: "Create your Wangku account",
};

interface SignUpPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export const instant = false;

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { callbackUrl = "/" } = await searchParams;

  return <SignUpForm callbackUrl={callbackUrl} />;
}
