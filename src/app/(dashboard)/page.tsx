import { Suspense } from "react";

import { DashboardView } from "@/components/features/dashboard/dashboard-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaymentMethods } from "@/services/features/payments";
import {
  getTransactionSummary,
  getTransactions,
} from "@/services/features/transactions";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`dash-stat-${i + 1}`} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-36 rounded-md" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`dash-tx-${i + 1}`} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function DashboardData() {
  const [walletsRes, txRes, summaryRes] = await Promise.all([
    getPaymentMethods(),
    getTransactions({ limit: 5 }),
    getTransactionSummary(),
  ]);

  const wallets = walletsRes.data ?? [];
  const recentTransactions = txRes.data ?? [];
  const summary = summaryRes.data ?? {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
  };

  return (
    <DashboardView
      wallets={wallets}
      recentTransactions={recentTransactions}
      summary={summary}
    />
  );
}

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}
