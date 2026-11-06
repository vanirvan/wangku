import { endOfMonth, startOfMonth } from "date-fns";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { DashboardView } from "@/components/features/dashboard/dashboard-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaymentMethods } from "@/services/features/payments";
import {
  getCategoryBreakdown,
  getDailyCashFlow,
  getTransactionSummary,
  getTransactions,
} from "@/services/features/transactions";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Overview of your personal finances, cash flow, and recent transactions.",
};

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
  await connection();
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const [walletsRes, txRes, summaryRes, categoryRes, dailyRes] =
    await Promise.all([
      getPaymentMethods(),
      getTransactions({ limit: 5 }),
      getTransactionSummary({ startDate: start, endDate: end }),
      getCategoryBreakdown({ startDate: start, endDate: end }),
      getDailyCashFlow({ startDate: start, endDate: end }),
    ]);

  const wallets = walletsRes.data ?? [];
  const recentTransactions = txRes.data ?? [];
  const summary = summaryRes.data ?? {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
  };
  const categoryBreakdown = categoryRes.data ?? [];
  const dailyCashFlow = dailyRes.data ?? [];

  return (
    <DashboardView
      wallets={wallets}
      recentTransactions={recentTransactions}
      summary={summary}
      initialCategoryBreakdown={categoryBreakdown}
      initialDailyCashFlow={dailyCashFlow}
      initialDateFrom={start}
      initialDateTo={end}
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
