"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaymentMethod } from "@/lib/db/schemas";

interface DeletePaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethod: PaymentMethod | null;
  loading: boolean;
  error: string | null;
  onConfirm: () => Promise<void> | void;
}

export function DeletePaymentMethodDialog({
  open,
  onOpenChange,
  paymentMethod,
  loading,
  error,
  onConfirm,
}: DeletePaymentMethodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Payment Method</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{paymentMethod?.name}</strong>?
            This action cannot be undone and will affect associated
            transactions.
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-destructive text-xs">{error}</p> : null}

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="sm" disabled={loading}>
                Cancel
              </Button>
            }
          />
          <Button
            variant="destructive"
            size="sm"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
