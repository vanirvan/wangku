"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { invalidateCategoriesCache } from "@/services/features/categories";
import { invalidatePaymentMethodsCache } from "@/services/features/payments";
import { resetTransactions } from "@/services/features/transactions";

export function ResetTransactionsAction() {
  const [isPending, setIsPending] = useState(false);

  const handleReset = async () => {
    if (
      !confirm(
        "Are you sure you want to reset all transactions? This will erase all transaction records, reset wallet balances to 0, and clear your custom categories. This cannot be undone.",
      )
    ) {
      return;
    }

    setIsPending(true);
    try {
      const res = await resetTransactions();
      if (res.error) {
        alert(res.error);
      } else {
        invalidatePaymentMethodsCache();
        invalidateCategoriesCache();
        alert("All transactions and balances have been reset successfully.");
        window.location.reload();
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="space-y-0.5">
        <p className="font-medium text-sm">Reset Transactions</p>
        <p className="text-muted-foreground text-xs">
          Erase all transaction records, custom categories, and reset wallet
          balances to 0 while keeping your account.
        </p>
      </div>
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={handleReset}
        className="gap-1.5"
      >
        {isPending && <Loader2 className="size-3.5 animate-spin" />}
        Reset Transactions
      </Button>
    </div>
  );
}
