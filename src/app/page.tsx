"use client";

import { useRouter } from "next/navigation";

import { ThemeToggler } from "@/components/theme-toggler";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/auth-client";

export default function Home() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center gap-4 p-4">
      <ThemeToggler />
      <Button variant="outline" onClick={handleSignOut}>
        Sign out
      </Button>
    </main>
  );
}
