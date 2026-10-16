"use client";

import { cn } from "cn";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/utils";
import { invalidatePaymentMethodsCache } from "@/services/features/payments";
import {
  deleteTransaction,
  type TransactionWithPaymentMethod,
} from "@/services/features/transactions";

import { TransactionDialog } from "./transaction-dialog";

interface TransactionListProps {
  initialData: TransactionWithPaymentMethod[];
}

export function TransactionList({ initialData }: TransactionListProps) {
  const [items, setItems] =
    useState<TransactionWithPaymentMethod[]>(initialData);
  const [filterType, setFilterType] = useState<
    "all" | "expense" | "income" | "transfer"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionWithPaymentMethod | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) {
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
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action & Filter Toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transaction, category, wallet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
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
                "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
                filterType === "expense"
                  ? "bg-background text-destructive shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setFilterType("income")}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
                filterType === "income"
                  ? "bg-background text-emerald-600 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => setFilterType("transfer")}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
                filterType === "transfer"
                  ? "bg-background text-primary shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Transfer
            </button>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="gap-1.5 self-start text-xs sm:self-auto"
        >
          <Plus className="size-3.5" />
          <span>Add Transaction</span>
        </Button>
      </div>

      {/* Transaction Records */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
          <ReceiptText className="size-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-medium">No transactions found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchQuery || filterType !== "all"
              ? "No transactions match your current filters."
              : "No transactions recorded yet. Click the button below to add your first transaction."}
          </p>
          {!searchQuery && filterType === "all" && (
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
        <div className="divide-y rounded-xl border bg-card shadow-2xs">
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
                        <div className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                          <span>{tx.paymentMethod?.name ?? "Wallet"}</span>
                          <span className="text-primary font-bold">→</span>
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
                          <span className="truncate max-w-[200px] sm:max-w-xs">
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
                        isTransfer && "text-foreground font-medium",
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
          // window.location.reload() provides full state refresh including server actions and wallet balances
          window.location.reload();
        }}
      />
    </div>
  );
}
