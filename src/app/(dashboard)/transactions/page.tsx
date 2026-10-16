import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { Suspense } from "react";

import { TransactionList } from "@/components/features/transactions";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatRupiah } from "@/lib/utils";
import {
  getTransactionSummary,
  getTransactions,
} from "@/services/features/transactions";

function TransactionSummaryCards({
  summary,
}: {
  summary: { totalIncome: number; totalExpense: number; netBalance: number };
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Total Income
          </span>
          <div className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600">
            <ArrowUpRight className="size-3.5" />
          </div>
        </div>
        <p className="mt-2 text-lg font-bold tabular-nums text-emerald-600">
          + Rp {formatCurrency(summary.totalIncome)}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Total Expense
          </span>
          <div className="rounded-full bg-destructive/10 p-1.5 text-destructive">
            <ArrowDownLeft className="size-3.5" />
          </div>
        </div>
        <p className="mt-2 text-lg font-bold tabular-nums text-destructive">
          - Rp {formatCurrency(summary.totalExpense)}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Net Cash Flow
          </span>
          <div className="rounded-full bg-primary/10 p-1.5 text-primary">
            <Scale className="size-3.5" />
          </div>
        </div>
        <p className="mt-2 text-lg font-bold tabular-nums">
          {formatRupiah(summary.netBalance)}
        </p>
      </div>
    </div>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`stat-${i + 1}`} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-64 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={`row-${i + 1}`} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function TransactionsData() {
  const [txRes, summaryRes] = await Promise.all([
    getTransactions(),
    getTransactionSummary(),
  ]);

  const transactions = txRes.data ?? [];
  const summary = summaryRes.data ?? {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
  };

  return (
    <div className="space-y-6">
      <TransactionSummaryCards summary={summary} />
      <TransactionList initialData={transactions} />
    </div>
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
