import type { Metadata } from "next";
import { Suspense } from "react";

import { PaymentMethodList } from "@/components/features/payments";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaymentMethods } from "@/services/features/payments";

export const metadata: Metadata = {
  title: "Payment Methods",
  description:
    "Manage your physical wallets, bank accounts, cards, and e-wallets.",
};

function PaymentListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="h-8 w-48 rounded-md" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-6 w-28 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
      </div>

      {/* Toolbar skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-full sm:w-64 rounded-lg" />
          <Skeleton className="h-8 w-28 shrink-0 rounded-lg" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={`tab-skel-${i + 1}`}
              className="h-7 w-14 shrink-0 rounded-md"
            />
          ))}
        </div>
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={`card-skel-${i + 1}`} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function PaymentMethodsData() {
  const { data: paymentMethods = [] } = await getPaymentMethods();

  return <PaymentMethodList initialData={paymentMethods ?? []} />;
}

export default function PaymentsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Payment Methods
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your physical wallets, bank accounts, cards, and e-wallets.
        </p>
      </div>

      <Separator />

      <Suspense fallback={<PaymentListSkeleton />}>
        <PaymentMethodsData />
      </Suspense>
    </div>
  );
}
