import type { ReactNode } from "react";

import { AuthHeader } from "@/components/features/auth/auth-header";
import { AuthPreview } from "@/components/features/auth/auth-preview";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      <AuthHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-6 sm:px-10 lg:px-16">
        <div className="grid w-full max-w-7xl items-center gap-10 lg:grid-cols-2">
          <div className="flex w-full justify-center lg:justify-start lg:pl-10">
            {children}
          </div>
          <div className="flex w-full items-center justify-center">
            <AuthPreview />
          </div>
        </div>
      </main>
    </div>
  );
}
