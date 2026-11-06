import { endOfMonth, startOfMonth } from "date-fns";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { TransactionList } from "@/components/features/transactions";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategories } from "@/services/features/categories";
import { getPaymentMethods } from "@/services/features/payments";
import {
  getTransactionSummary,
  getTransactions,
} from "@/services/features/transactions";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Track and manage your expenses and incomes across all wallets.",
};

function TransactionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`stat-${i + 1}`} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={`row-${i + 1}`} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function TransactionsData() {
  await connection();
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const [txRes, summaryRes, walletsRes, expenseCatsRes, incomeCatsRes] =
    await Promise.all([
      getTransactions({ startDate: start, endDate: end }),
      getTransactionSummary({ startDate: start, endDate: end }),
      getPaymentMethods(),
      getCategories("expense"),
      getCategories("income"),
    ]);

  const transactions = txRes.data ?? [];
  const summary = summaryRes.data ?? {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
  };
  const wallets = walletsRes.data ?? [];
  const categoriesList = Array.from(
    new Set([
      ...(expenseCatsRes.data ?? []),
      ...(incomeCatsRes.data ?? []),
      "Transfer",
    ]),
  ).sort();

  return (
    <TransactionList
      initialData={transactions}
      initialSummary={summary}
      initialDateFrom={start}
      initialDateTo={end}
      wallets={wallets}
      categories={categoriesList}
    />
  );
}

export default function TransactionsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">
          Track and manage your expenses and incomes across all wallets.
        </p>
      </div>

      <Separator />

      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsData />
      </Suspense>
    </div>
  );
}
