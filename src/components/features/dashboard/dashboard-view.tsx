"use client";

import { cn } from "cn";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  LineChart as LineChartIcon,
  PieChart as PieIcon,
  Plus,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TransactionDialog } from "@/components/features/transactions";
import { Button } from "@/components/ui/button";
import {
  type DateRange,
  DateRangePicker,
} from "@/components/ui/date-range-picker";
import type { PaymentMethod } from "@/lib/db/schemas";
import { formatRupiah } from "@/lib/utils";
import {
  type CategoryBreakdownItem,
  type DailyCashFlowItem,
  getCategoryBreakdown,
  getDailyCashFlow,
  getTransactionSummary,
  type TransactionWithPaymentMethod,
} from "@/services/features/transactions";

interface DashboardViewProps {
  wallets: PaymentMethod[];
  recentTransactions: TransactionWithPaymentMethod[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
  };
  initialCategoryBreakdown?: CategoryBreakdownItem[];
  initialDailyCashFlow?: DailyCashFlowItem[];
  initialDateFrom?: Date;
  initialDateTo?: Date;
}

// Purposeful palette derived from theme colors for the donut chart (antislop-ui R-29: restrained palette)
const CATEGORY_COLORS = [
  "var(--foreground)",
  "var(--chart-2, #3b82f6)",
  "var(--chart-3, #8b5cf6)",
  "var(--chart-4, #f59e0b)",
  "var(--muted-foreground)",
];

export function DashboardView({
  wallets,
  recentTransactions,
  summary: initialSummary,
  initialCategoryBreakdown = [],
  initialDailyCashFlow = [],
  initialDateFrom,
  initialDateTo,
}: DashboardViewProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [categories, setCategories] = useState<CategoryBreakdownItem[]>(
    initialCategoryBreakdown,
  );
  const [dailyData, setDailyData] =
    useState<DailyCashFlowItem[]>(initialDailyCashFlow);
  const [chartFlowFilter, setChartFlowFilter] = useState<
    "all" | "income" | "expense"
  >("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: initialDateFrom,
    to: initialDateTo,
  });
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<
    "expense" | "income" | "transfer"
  >("expense");

  const totalWalletBalance = wallets.reduce(
    (acc, w) => acc + (Number(w.balance) || 0),
    0,
  );

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange);
    startTransition(async () => {
      const [summaryRes, categoryRes, dailyRes] = await Promise.all([
        getTransactionSummary({
          startDate: newRange.from,
          endDate: newRange.to,
        }),
        getCategoryBreakdown({
          startDate: newRange.from,
          endDate: newRange.to,
          type: "expense",
        }),
        getDailyCashFlow({
          startDate: newRange.from,
          endDate: newRange.to,
        }),
      ]);

      if (summaryRes.data) setSummary(summaryRes.data);
      if (categoryRes.data) setCategories(categoryRes.data);
      if (dailyRes.data) setDailyData(dailyRes.data);
    });
  };

  const handleOpenTransaction = (
    type: "expense" | "income" | "transfer" = "expense",
  ) => {
    setDialogType(type);
    setDialogOpen(true);
  };

  const savingsRate =
    summary.totalIncome > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((summary.totalIncome - summary.totalExpense) /
                summary.totalIncome) *
                100,
            ),
          ),
        )
      : 0;

  const topCategories = categories.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Financial Overview
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Cash flow performance, expense distribution, and active balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            initialDateFrom={dateRange.from}
            initialDateTo={dateRange.to}
            onUpdate={({ range }) => {
              if (range.from) {
                handleDateRangeChange({
                  from: range.from,
                  to: range.to || range.from,
                });
              }
            }}
          />

          <Button
            size="sm"
            onClick={() => handleOpenTransaction("expense")}
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Add Transaction</span>
          </Button>
        </div>
      </div>

      {/* Primary KPI Metrics: 4-card grid */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-4",
          isPending && "opacity-60",
        )}
      >
        {/* Total Net Balance in Wallets */}
        <Link
          href="/payments"
          className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-2xs transition-all duration-200 hover:border-foreground/30 hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                Total Balance
              </span>
              <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                <Wallet className="size-3.5" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {formatRupiah(totalWalletBalance)}
            </p>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{wallets.length} active wallets</span>
            <span className="flex items-center gap-0.5 font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span>Wallets</span>
              <ArrowRight className="size-2.5" />
            </span>
          </div>
        </Link>

        {/* Total Income */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Income
              </span>
              <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="size-3.5" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              +{formatRupiah(summary.totalIncome)}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Selected period
          </p>
        </div>

        {/* Total Expense */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Expense
              </span>
              <div className="rounded-md bg-destructive/10 p-1.5 text-destructive">
                <ArrowDownLeft className="size-3.5" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-destructive">
              -{formatRupiah(summary.totalExpense)}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Selected period
          </p>
        </div>

        {/* Net Flow / Savings Rate */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Net Cash Flow
              </span>
              <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
                <TrendingUp className="size-3.5" />
              </div>
            </div>
            <p
              className={cn(
                "mt-2 text-xl font-bold tabular-nums",
                summary.netBalance >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive",
              )}
            >
              {summary.netBalance >= 0 ? "+" : ""}
              {formatRupiah(summary.netBalance)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Savings rate</span>
            <span className="font-semibold text-foreground">
              {summary.totalIncome > 0 ? `${savingsRate}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Cash Flow Trend (Bar Chart) & Expense by Category (Donut Chart) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cash Flow Timeline Chart */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs lg:col-span-2">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1.5 text-foreground">
                  <LineChartIcon className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Cash Flow Activity</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Income vs expense trend over time
                  </p>
                </div>
              </div>

              {/* Segmented Filter Control */}
              <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setChartFlowFilter("all")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    chartFlowFilter === "all"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  All Flow
                </button>
                <button
                  type="button"
                  onClick={() => setChartFlowFilter("income")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    chartFlowFilter === "income"
                      ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>Income</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartFlowFilter("expense")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    chartFlowFilter === "expense"
                      ? "bg-background text-rose-600 dark:text-rose-400 shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-rose-500" />
                  <span>Expense</span>
                </button>
              </div>
            </div>

            <div className="mt-4 h-64 w-full">
              {dailyData.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    No transactions in this period
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Your income and expense trends will plot here.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dailyData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="incomeGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="expenseGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f43f5e"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f43f5e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={11}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(value) => {
                        const d = new Date(value);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={10}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(value) => {
                        if (value >= 1_000_000)
                          return `${(value / 1_000_000).toFixed(1)}M`;
                        if (value >= 1_000)
                          return `${(value / 1_000).toFixed(0)}k`;
                        return value;
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload as DailyCashFlowItem;
                        const formattedDate = new Date(
                          `${data.date}T00:00:00`,
                        ).toLocaleDateString("en-US", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        });
                        return (
                          <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1">
                            <p className="font-medium text-muted-foreground text-[11px]">
                              {formattedDate}
                            </p>
                            {(chartFlowFilter === "all" ||
                              chartFlowFilter === "income") && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  Income:
                                </span>
                                <span className="font-bold tabular-nums">
                                  {formatRupiah(data.income)}
                                </span>
                              </div>
                            )}
                            {(chartFlowFilter === "all" ||
                              chartFlowFilter === "expense") && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-destructive font-medium">
                                  Expense:
                                </span>
                                <span className="font-bold tabular-nums">
                                  {formatRupiah(data.expense)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    {(chartFlowFilter === "all" ||
                      chartFlowFilter === "income") && (
                      <Area
                        type="monotone"
                        dataKey="income"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#incomeGradient)"
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    )}
                    {(chartFlowFilter === "all" ||
                      chartFlowFilter === "expense") && (
                      <Area
                        type="monotone"
                        dataKey="expense"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#expenseGradient)"
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Expense by Category (Donut Chart & Legend) */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs">
          <div>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1.5 text-foreground">
                  <PieIcon className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Expense Breakdown</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Spending by top category
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {formatRupiah(summary.totalExpense)}
              </span>
            </div>

            {topCategories.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  No expense records
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Record transactions to see breakdown.
                </p>
              </div>
            ) : (
              <div className="mt-3 flex flex-col items-center">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topCategories}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="total"
                        nameKey="category"
                        shape={(props) => {
                          const fill =
                            CATEGORY_COLORS[
                              (props.index ?? 0) % CATEGORY_COLORS.length
                            ];
                          return (
                            <Sector
                              {...props}
                              fill={fill}
                              stroke="var(--card)"
                              strokeWidth={2}
                            />
                          );
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as CategoryBreakdownItem;
                          return (
                            <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1.5 min-w-[130px]">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-foreground truncate max-w-[100px]">
                                  {d.category}
                                </span>
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary tabular-nums shrink-0">
                                  {d.percentage}%
                                </span>
                              </div>
                              <p className="text-muted-foreground text-[11px] font-medium tabular-nums">
                                {formatRupiah(d.total)}
                              </p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Minimalist legend */}
                <div className="w-full space-y-1.5 pt-1">
                  {topCategories.map((cat, i) => (
                    <div
                      key={cat.category}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                          }}
                        />
                        <span className="font-medium text-foreground truncate max-w-[120px]">
                          {cat.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-muted-foreground">
                          {formatRupiah(cat.total)}
                        </span>
                        <span className="font-semibold text-[11px] text-foreground w-8 text-right">
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Wallets list, AI Quick Prompt, Recent Transactions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left Side: Wallets snapshot + Ask Wangku AI */}
        <div className="space-y-4 lg:col-span-1">
          {/* Wallets snapshot */}
          <div className="rounded-xl border bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1.5 text-foreground">
                  <Wallet className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Your Wallets</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Balances per account
                  </p>
                </div>
              </div>
              <Link
                href="/payments"
                className="text-xs font-medium text-primary hover:underline"
              >
                Manage
              </Link>
            </div>

            <div className="mt-3 divide-y">
              {wallets.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No wallets set up yet.
                </div>
              ) : (
                wallets.slice(0, 4).map((wallet) => (
                  <div
                    key={wallet.id}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary/60" />
                      <div>
                        <p className="font-medium text-foreground">
                          {wallet.name}
                        </p>
                        <p className="text-[10px] capitalize text-muted-foreground">
                          {wallet.type}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatRupiah(wallet.balance)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick AI Trigger Card */}
          <div className="rounded-xl border border-dashed bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary shrink-0">
                <Bot className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Ask Wangku AI
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Analyze anomalies in your cash flow or find opportunities to
                  increase your savings rate.
                </p>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-1.5 pt-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Sparkles className="size-3" />
                  <span>Start AI Conversation</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Recent Transactions (2 columns on lg) */}
        <div className="space-y-3 lg:col-span-2">
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
                            "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
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
                              <span>
                                {tx.toPaymentMethod?.name ?? "Wallet"}
                              </span>
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
                        isIncome && "text-emerald-600 dark:text-emerald-400",
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
