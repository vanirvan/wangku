import Link from "next/link";

import { ThemeToggler } from "@/components/theme-toggler";
import { buttonVariants } from "@/components/ui/button";

export function AuthHeader() {
  return (
    <header className="relative z-20 flex w-full items-center justify-between px-6 py-4 lg:px-12">
      {/* Brand Logo */}
      <Link
        href="/"
        className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80"
      >
        <span className="font-bold font-serif text-lg tracking-tight">
          Wangku
        </span>
      </Link>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <ThemeToggler size="icon-sm" />
        <Link
          href="/sign-in"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          Sign up
        </Link>
      </div>
    </header>
  );
}
