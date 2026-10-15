"use client";

import { Plus, Search, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentMethod } from "@/lib/db/schemas";
import {
  deletePaymentMethod,
  type PaymentMethodType,
} from "@/services/features/payments";

import { DeletePaymentMethodDialog } from "./delete-payment-method-dialog";
import { PaymentMethodCard } from "./payment-method-card";
import { PaymentMethodDialog } from "./payment-method-dialog";

const FILTER_TABS: { value: "all" | PaymentMethodType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

interface PaymentMethodListProps {
  initialPaymentMethods?: PaymentMethod[];
  initialData?: PaymentMethod[];
  onDelete?: (id: string) => Promise<void> | void;
}

export function PaymentMethodList({
  initialPaymentMethods,
  initialData,
  onDelete,
}: PaymentMethodListProps) {
  const items = initialData ?? initialPaymentMethods ?? [];
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | PaymentMethodType>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentMethod | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<PaymentMethod | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { liquidBalance, cardCount, breakdown } = useMemo(() => {
    let liquid = 0;
    let cash = 0;
    let bank = 0;
    let ewallet = 0;
    let card = 0;
    let other = 0;

    for (const item of items) {
      const bal = Number(item.balance || 0);
      if (item.type === "cash") {
        cash++;
        liquid += bal;
      } else if (item.type === "bank") {
        bank++;
        liquid += bal;
      } else if (item.type === "ewallet") {
        ewallet++;
        liquid += bal;
      } else if (item.type === "card") {
        card++;
      } else {
        other++;
      }
    }

    const parts: string[] = [];
    if (bank > 0) parts.push(`${bank} ${bank === 1 ? "Bank" : "Banks"}`);
    if (ewallet > 0)
      parts.push(`${ewallet} E-Wallet${ewallet === 1 ? "" : "s"}`);
    if (cash > 0) parts.push(`${cash} Cash`);
    if (card > 0) parts.push(`${card} ${card === 1 ? "Card" : "Cards"}`);
    if (other > 0) parts.push(`${other} ${other === 1 ? "Other" : "Others"}`);

    return { liquidBalance: liquid, cardCount: card, breakdown: parts };
  }, [items]);

  const formattedLiquidBalance = useMemo(() => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(liquidBalance);
  }, [liquidBalance]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesType = activeTab === "all" || item.type === activeTab;
      return matchesSearch && matchesType;
    });
  }, [items, search, activeTab]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: PaymentMethod) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleTriggerDelete = (item: PaymentMethod) => {
    setDeletingItem(item);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      if (onDelete) {
        await onDelete(deletingItem.id);
      } else {
        const res = await deletePaymentMethod(deletingItem.id);
        if (res.error) throw new Error(res.error);
      }
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete payment method",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Liquid Balance & Account Summary */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Total Liquid Balance
          </p>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <p className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">
              {formattedLiquidBalance}
            </p>
            {cardCount > 0 && (
              <span className="font-medium text-muted-foreground text-xs">
                ({cardCount} {cardCount === 1 ? "card" : "cards"} excluded)
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
            {items.length}{" "}
            {items.length === 1 ? "Active Account" : "Active Accounts"}
          </span>
          {breakdown.map((part) => (
            <span
              key={part}
              className="inline-flex items-center rounded-md border border-border bg-card/50 px-2 py-1 text-muted-foreground"
            >
              {part}
            </span>
          ))}
        </div>
      </div>

      {/* Responsive Toolbar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search wallets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button onClick={handleOpenCreate} size="sm" className="shrink-0">
            <Plus className="size-4" />
            <span>Add Wallet</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Wallet className="size-6" />
          </div>
          {items.length === 0 ? (
            <>
              <h3 className="mt-3 font-semibold text-base">
                No payment methods added
              </h3>
              <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                Get started by adding your first payment method or wallet to
                manage your transactions.
              </p>
              <Button onClick={handleOpenCreate} size="sm" className="mt-4">
                <Plus className="size-4" />
                <span>Add Wallet</span>
              </Button>
            </>
          ) : (
            <>
              <h3 className="mt-3 font-semibold text-base">
                No matching payment methods
              </h3>
              <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                No wallets match your current search or filter criteria.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setActiveTab("all");
                }}
              >
                Clear filters
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <PaymentMethodCard
              key={item.id}
              paymentMethod={item}
              onEdit={handleOpenEdit}
            />
          ))}
        </div>
      )}

      <PaymentMethodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        paymentMethod={editingItem}
        onDelete={handleTriggerDelete}
      />

      <DeletePaymentMethodDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        paymentMethod={deletingItem}
        loading={deleteLoading}
        error={deleteError}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
