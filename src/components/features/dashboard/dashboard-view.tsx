"use client";

import { cn } from "cn";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { TransactionDialog } from "@/components/features/transactions";
import { Button } from "@/components/ui/button";
import type { PaymentMethod } from "@/lib/db/schemas";
import { formatCurrency, formatRupiah } from "@/lib/utils";
import type { TransactionWithPaymentMethod } from "@/services/features/transactions";

interface DashboardViewProps {
  wallets: PaymentMethod[];
  recentTransactions: TransactionWithPaymentMethod[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
  };
}

export function DashboardView({
  wallets,
  recentTransactions,
  summary,
}: DashboardViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<
    "expense" | "income" | "transfer"
  >("expense");

  const totalWalletBalance = wallets.reduce(
    (acc, w) => acc + (Number(w.balance) || 0),
    0,
  );

  const handleOpenTransaction = (
    type: "expense" | "income" | "transfer" = "expense",
  ) => {
    setDialogType(type);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Financial Overview
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Overview of your wallet balance and cash flow.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => handleOpenTransaction("expense")}
          className="gap-2 text-xs font-semibold shadow-xs"
        >
          <Plus className="size-3.5" />
          <span>Add Transaction</span>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Total Net Balance in Wallets (Clickable Card navigating to /payments) */}
        <Link
          href="/payments"
          className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-2xs transition-all duration-200 hover:border-foreground/30 hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                Total Wallet Balance
              </span>
              <div className="rounded-full bg-primary/10 p-1.5 text-primary transition-transform duration-200 group-hover:scale-105">
                <Wallet className="size-3.5" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {formatRupiah(totalWalletBalance)}
            </p>
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{wallets.length} active wallets</span>
            {/* Manage link reveals by sliding up and fading in on hover */}
            <span className="flex items-center gap-0.5 font-medium text-primary opacity-0 translate-y-1.5 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
              <span>Manage</span>
              <ArrowRight className="size-2.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {/* Total Income */}
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Total Income
            </span>
            <div className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600">
              <ArrowUpRight className="size-3.5" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-emerald-600">
            + Rp {formatCurrency(summary.totalIncome)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Cumulative recorded income
          </p>
        </div>

        {/* Total Expense */}
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Total Expense
            </span>
            <div className="rounded-full bg-destructive/10 p-1.5 text-destructive">
              <ArrowDownLeft className="size-3.5" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-destructive">
            - Rp {formatCurrency(summary.totalExpense)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Cumulative recorded expenses
          </p>
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Recent Transactions</h2>
            <p className="text-[11px] text-muted-foreground">
              Latest transactions recorded in your account.
            </p>
          </div>
          <Link
            href="/transactions"
            className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            <span>View All</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center bg-card/50">
            <ReceiptText className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium">No transactions yet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Record your first income or expense to start tracking.
            </p>
            <Button
              size="sm"
              onClick={() => handleOpenTransaction("expense")}
              className="mt-3 gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              <span>Record Transaction</span>
            </Button>
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card shadow-2xs">
            {recentTransactions.map((tx) => {
              const isExpense = tx.type === "expense";
              const isIncome = tx.type === "income";
              const isTransfer = tx.type === "transfer";

              const dateStr = new Date(tx.date).toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
              });

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        isExpense &&
                          "border-destructive/20 bg-destructive/10 text-destructive",
                        isIncome &&
                          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
                        isTransfer &&
                          "border-primary/20 bg-primary/10 text-primary",
                      )}
                    >
                      {isExpense && <ArrowDownLeft className="size-3.5" />}
                      {isIncome && <ArrowUpRight className="size-3.5" />}
                      {isTransfer && <ArrowLeftRight className="size-3.5" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">
                          {tx.title ||
                            (isTransfer ? "Wallet Transfer" : tx.category)}
                        </span>
                        {tx.title && (
                          <span className="rounded bg-muted/60 px-1 py-0.5 text-[9px] text-muted-foreground">
                            {tx.category}
                          </span>
                        )}
                        {isTransfer ? (
                          <div className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground font-medium">
                            <span>{tx.paymentMethod?.name ?? "Wallet"}</span>
                            <span className="text-primary font-bold">→</span>
                            <span>{tx.toPaymentMethod?.name ?? "Wallet"}</span>
                          </div>
                        ) : (
                          tx.paymentMethod && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                              {tx.paymentMethod.name}
                            </span>
                          )
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {dateStr}
                        {tx.description ? ` • ${tx.description}` : ""}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      isExpense && "text-destructive",
                      isIncome && "text-emerald-600",
                      isTransfer && "text-foreground font-medium",
                    )}
                  >
                    {isExpense && "- "}
                    {isIncome && "+ "}
                    {formatRupiah(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={dialogType}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
