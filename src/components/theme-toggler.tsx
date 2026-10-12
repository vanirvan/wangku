"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
  AnimatedThemeToggler,
  type TransitionVariant,
} from "@/components/ui/animated-theme-toggler";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ThemeTogglerProps {
  className?: string;
  variant?: TransitionVariant;
  duration?: number;
  fromCenter?: boolean;
  size?: "default" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
}

export function ThemeToggler({
  className,
  variant = "circle",
  duration = 400,
  fromCenter = false,
  size = "icon",
}: ThemeTogglerProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline", size }), className)}
        aria-label="Toggle theme"
      >
        <span className="size-4" />
      </button>
    );
  }

  return (
    <AnimatedThemeToggler
      variant={variant}
      duration={duration}
      fromCenter={fromCenter}
      className={cn(buttonVariants({ variant: "outline", size }), className)}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      onThemeChange={setTheme}
    />
  );
}

export default ThemeToggler;
