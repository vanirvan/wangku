"use client";

import { cn } from "cn";
import { endOfMonth, startOfMonth } from "date-fns";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Scale,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  type DateRange,
  DateRangePicker,
} from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PaymentMethod } from "@/lib/db/schemas";
import { formatCurrency, formatRupiah } from "@/lib/utils";
import { invalidatePaymentMethodsCache } from "@/services/features/payments";
import {
  deleteTransaction,
  getTransactionSummary,
  getTransactions,
  type TransactionWithPaymentMethod,
} from "@/services/features/transactions";

import { TransactionDialog } from "./transaction-dialog";

interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

interface TransactionListProps {
  initialData: TransactionWithPaymentMethod[];
  initialSummary: TransactionSummary;
  initialDateFrom?: Date;
  initialDateTo?: Date;
  wallets?: PaymentMethod[];
  categories?: string[];
}

export function TransactionList({
  initialData,
  initialSummary,
  initialDateFrom,
  initialDateTo,
  wallets = [],
  categories = [],
}: TransactionListProps) {
  const [items, setItems] =
    useState<TransactionWithPaymentMethod[]>(initialData);
  const [summary, setSummary] = useState<TransactionSummary>(initialSummary);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: initialDateFrom ?? startOfMonth(new Date()),
    to: initialDateTo ?? endOfMonth(new Date()),
  });

  const [filterType, setFilterType] = useState<
    "all" | "expense" | "income" | "transfer"
  >("all");
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionWithPaymentMethod | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange);
    startTransition(async () => {
      const [txRes, summaryRes] = await Promise.all([
        getTransactions({
          startDate: newRange.from,
          endDate: newRange.to,
        }),
        getTransactionSummary({
          startDate: newRange.from,
          endDate: newRange.to,
        }),
      ]);

      if (!txRes.error && txRes.data) {
        setItems(txRes.data);
      }
      if (summaryRes.data) {
        setSummary(summaryRes.data);
      }
    });
  };

  const availableCategories = useMemo(() => {
    const set = new Set<string>(categories);
    for (const item of items) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort();
  }, [categories, items]);

  const hasActiveFilters =
    filterType !== "all" ||
    selectedWalletIds.length > 0 ||
    selectedCategories.length > 0 ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setFilterType("all");
    setSelectedWalletIds([]);
    setSelectedCategories([]);
    setSearchQuery("");
  };

  const toggleWallet = (id: string) => {
    setSelectedWalletIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat],
    );
  };

  const filteredItems = items.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) {
      return false;
    }
    if (selectedWalletIds.length > 0) {
      const matchSource = selectedWalletIds.includes(item.paymentMethodId);
      const matchDest =
        item.toPaymentMethodId &&
        selectedWalletIds.includes(item.toPaymentMethodId);
      if (!matchSource && !matchDest) return false;
    }
    if (
      selectedCategories.length > 0 &&
      !selectedCategories.includes(item.category)
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q) ?? false;
      const matchCat = item.category.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q) ?? false;
      const matchWallet =
        item.paymentMethod?.name.toLowerCase().includes(q) ?? false;
      const matchToWallet =
        item.toPaymentMethod?.name.toLowerCase().includes(q) ?? false;
      return (
        matchTitle || matchCat || matchDesc || matchWallet || matchToWallet
      );
    }
    return true;
  });

  const handleOpenCreate = () => {
    setEditingTransaction(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (tx: TransactionWithPaymentMethod) => {
    setEditingTransaction(tx);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Delete this transaction? The corresponding wallet balance(s) will be reverted.",
      )
    )
      return;
    setDeletingId(id);
    try {
      const res = await deleteTransaction(id);
      if (res.success) {
        invalidatePaymentMethodsCache();
        setItems((prev) => prev.filter((item) => item.id !== id));
        // Refresh summary for current period
        const summaryRes = await getTransactionSummary({
          startDate: dateRange.from,
          endDate: dateRange.to,
        });
        if (summaryRes.data) {
          setSummary(summaryRes.data);
        }
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards for Selected Date Range */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-3",
          isPending && "opacity-60",
        )}
      >
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
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
            <span className="text-xs font-medium text-muted-foreground">
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
            <span className="text-xs font-medium text-muted-foreground">
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

      {/* Action & Filter Toolbar - Top Row: Search, Date Range, Add Button */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search title, note, merchant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            onClick={handleOpenCreate}
            className="h-8 w-full gap-1.5 text-xs font-semibold sm:w-auto"
          >
            <Plus className="size-3.5" />
            <span>Add Transaction</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar - Second Row: Type pills, Wallets dropdown, Categories dropdown */}
      <div className="flex flex-col gap-2.5 rounded-xl border bg-card/60 p-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter tabs */}
          <div className="flex h-8 max-w-full items-center overflow-x-auto rounded-lg border bg-muted/40 p-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={cn(
                "h-full shrink-0 rounded-md px-2.5 text-xs font-medium transition-colors",
                filterType === "all"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType("expense")}
              className={cn(
                "h-full shrink-0 rounded-md px-2.5 text-xs font-medium transition-colors",
                filterType === "expense"
                  ? "bg-background font-semibold text-destructive shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setFilterType("income")}
              className={cn(
                "h-full shrink-0 rounded-md px-2.5 text-xs font-medium transition-colors",
                filterType === "income"
                  ? "bg-background font-semibold text-emerald-600 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => setFilterType("transfer")}
              className={cn(
                "h-full shrink-0 rounded-md px-2.5 text-xs font-medium transition-colors",
                filterType === "transfer"
                  ? "bg-background font-semibold text-primary shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Transfer
            </button>
          </div>

          {/* Wallets & Categories Multi-Select Dropdowns */}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            {wallets.length > 0 && (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className="h-8 w-full justify-between gap-1.5 border-input bg-transparent px-2.5 text-xs font-normal shadow-2xs hover:bg-muted/50 sm:w-auto sm:min-w-[130px]"
                    />
                  }
                >
                  <span className="truncate">
                    {selectedWalletIds.length === 0
                      ? "All Wallets"
                      : selectedWalletIds.length === 1
                        ? (wallets.find((w) => w.id === selectedWalletIds[0])
                            ?.name ?? "1 Wallet")
                        : `${selectedWalletIds.length} Wallets`}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-1.5 text-xs">
                  <div className="flex items-center justify-between px-2 py-1 text-muted-foreground">
                    <span className="font-medium text-[11px]">Wallets</span>
                    {selectedWalletIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedWalletIds([])}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 max-h-56 space-y-0.5 overflow-y-auto">
                    {wallets.map((w) => {
                      const checked = selectedWalletIds.includes(w.id);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => toggleWallet(w.id)}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            checked
                              ? "bg-accent/60 font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{w.name}</span>
                          {checked && (
                            <Check className="size-3.5 shrink-0 text-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {availableCategories.length > 0 && (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className="h-8 w-full justify-between gap-1.5 border-input bg-transparent px-2.5 text-xs font-normal shadow-2xs hover:bg-muted/50 sm:w-auto sm:min-w-[140px]"
                    />
                  }
                >
                  <span className="truncate">
                    {selectedCategories.length === 0
                      ? "All Categories"
                      : selectedCategories.length === 1
                        ? selectedCategories[0]
                        : `${selectedCategories.length} Categories`}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-1.5 text-xs">
                  <div className="flex items-center justify-between px-2 py-1 text-muted-foreground">
                    <span className="font-medium text-[11px]">Categories</span>
                    {selectedCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCategories([])}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 max-h-56 space-y-0.5 overflow-y-auto">
                    {availableCategories.map((cat) => {
                      const checked = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            checked
                              ? "bg-accent/60 font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{cat}</span>
                          {checked && (
                            <Check className="size-3.5 shrink-0 text-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Reset button if any filter active */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Reset all filters"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </Button>
          )}

          {isPending && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="hidden sm:block text-right text-[11px] text-muted-foreground">
          Showing{" "}
          <strong className="text-foreground">{filteredItems.length}</strong> of{" "}
          <strong className="text-foreground">{items.length}</strong> in period
        </div>
      </div>

      {/* Transaction Records */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
          <ReceiptText className="mb-3 size-10 text-muted-foreground/40" />
          <h3 className="text-sm font-medium">No transactions found</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {hasActiveFilters
              ? "No transactions match your current filters."
              : "No transactions recorded for this period."}
          </p>
          {hasActiveFilters ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetFilters}
              className="mt-4 gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset Filters</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenCreate}
              className="mt-4 gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              <span>Record Transaction</span>
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "divide-y rounded-xl border bg-card shadow-2xs transition-opacity",
            isPending && "opacity-60",
          )}
        >
          {filteredItems.map((tx) => {
            const isExpense = tx.type === "expense";
            const isIncome = tx.type === "income";
            const isTransfer = tx.type === "transfer";

            const dateStr = new Date(tx.date).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                      isExpense &&
                        "border-destructive/20 bg-destructive/10 text-destructive",
                      isIncome &&
                        "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
                      isTransfer &&
                        "border-primary/20 bg-primary/10 text-primary",
                    )}
                  >
                    {isExpense && <ArrowDownLeft className="size-4" />}
                    {isIncome && <ArrowUpRight className="size-4" />}
                    {isTransfer && <ArrowLeftRight className="size-4" />}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        {tx.title ||
                          (isTransfer ? "Wallet Transfer" : tx.category)}
                      </span>
                      {tx.title && (
                        <span className="rounded border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {tx.category}
                        </span>
                      )}
                      {isTransfer ? (
                        <div className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <span>{tx.paymentMethod?.name ?? "Wallet"}</span>
                          <span className="font-bold text-primary">→</span>
                          <span>{tx.toPaymentMethod?.name ?? "Wallet"}</span>
                        </div>
                      ) : (
                        tx.paymentMethod && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {tx.paymentMethod.name}
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{dateStr}</span>
                      {tx.description && (
                        <>
                          <span>•</span>
                          <span className="max-w-[200px] truncate sm:max-w-xs">
                            {tx.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        isExpense && "text-destructive",
                        isIncome && "text-emerald-600",
                        isTransfer && "font-medium text-foreground",
                      )}
                    >
                      {isExpense && "- "}
                      {isIncome && "+ "}
                      {formatRupiah(tx.amount)}
                    </span>
                  </div>

                  {/* Edit button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(tx)}
                    className="size-7 text-muted-foreground hover:text-foreground"
                    title="Edit transaction"
                  >
                    <Pencil className="size-3.5" />
                  </Button>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deletingId === tx.id}
                    onClick={() => handleDelete(tx.id)}
                    className="size-7 text-muted-foreground hover:text-destructive"
                    title="Delete transaction"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editingTransaction}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
