"use client";

import { Button } from "@/components/ui/button";

export function ResetTransactionsAction() {
  // dummy button; wire transaction purge mutation when transactions schema ready
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="space-y-0.5">
        <p className="font-medium text-sm">Reset Transactions</p>
        <p className="text-muted-foreground text-xs">
          Erase all transaction records, wallets, and budgets while keeping your
          account.
        </p>
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => alert("Reset transactions feature coming soon.")}
      >
        Reset Transactions
      </Button>
    </div>
  );
}
