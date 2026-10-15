"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import {
  Banknote,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Loader2,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMethod } from "@/lib/db/schemas";
import { formatCurrency } from "@/lib/utils";
import {
  createPaymentMethod,
  type PaymentMethodFormValues,
  type PaymentMethodType,
  paymentMethodSchema,
  updatePaymentMethod,
} from "@/services/features/payments";

const PAYMENT_TYPES: {
  value: PaymentMethodType;
  label: string;
  icon: typeof Banknote;
}[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "bank", label: "Bank", icon: Building2 },
  { value: "ewallet", label: "E-Wallet", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "other", label: "Other", icon: CircleDollarSign },
];

const TOP_PRESETS: {
  name: string;
  type: PaymentMethodType;
}[] = [
  { name: "BCA", type: "bank" },
  { name: "Mandiri", type: "bank" },
  { name: "GoPay", type: "ewallet" },
  { name: "Cash", type: "cash" },
];

const POPULAR_BANKS: {
  name: string;
  type: PaymentMethodType;
}[] = [
  { name: "BCA", type: "bank" },
  { name: "Mandiri", type: "bank" },
  { name: "BRI", type: "bank" },
  { name: "BNI", type: "bank" },
  { name: "BSI", type: "bank" },
  { name: "CIMB Niaga", type: "bank" },
  { name: "Permata", type: "bank" },
  { name: "SeaBank", type: "bank" },
  { name: "Bank Jago", type: "bank" },
  { name: "Jenius (BTPN)", type: "bank" },
];

const POPULAR_EWALLETS: {
  name: string;
  type: PaymentMethodType;
}[] = [
  { name: "GoPay", type: "ewallet" },
  { name: "OVO", type: "ewallet" },
  { name: "DANA", type: "ewallet" },
  { name: "ShopeePay", type: "ewallet" },
  { name: "LinkAja", type: "ewallet" },
  { name: "Astrapay", type: "ewallet" },
  { name: "iSaku", type: "ewallet" },
  { name: "DOKU", type: "ewallet" },
  { name: "Sakuku", type: "ewallet" },
  { name: "Flip", type: "ewallet" },
];

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethod?: PaymentMethod | null;
  onSuccess?: () => void;
  onDelete?: (paymentMethod: PaymentMethod) => void;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  paymentMethod,
  onSuccess,
  onDelete,
}: PaymentMethodDialogProps) {
  const isEditing = Boolean(paymentMethod);
  const [formattedBalance, setFormattedBalance] = useState("0");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const balanceInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      name: "",
      type: "cash" as PaymentMethodType,
      balance: 0,
    },
  });

  const currentName = watch("name");
  const currentType = watch("type");

  useEffect(() => {
    register("balance");
  }, [register]);

  useEffect(() => {
    if (open) {
      const validTypes: PaymentMethodType[] = [
        "cash",
        "bank",
        "ewallet",
        "card",
        "other",
      ];
      const initialType = validTypes.includes(
        paymentMethod?.type as PaymentMethodType,
      )
        ? (paymentMethod?.type as PaymentMethodType)
        : "cash";

      const initialBalance =
        paymentMethod?.balance !== undefined && paymentMethod?.balance !== null
          ? Number(paymentMethod.balance) || 0
          : 0;

      reset({
        name: paymentMethod?.name ?? "",
        type: initialType,
        balance: initialBalance,
      });
      setFormattedBalance(
        initialBalance > 0 ? formatCurrency(initialBalance) : "0",
      );
      setSubmitError(null);
    }
  }, [open, paymentMethod, reset]);

  const handlePresetSelect = (preset: {
    name: string;
    type: PaymentMethodType;
  }) => {
    setValue("name", preset.name, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("type", preset.type, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursor = input.selectionStart ?? 0;
    const oldVal = input.value;
    const digitsBeforeCursor = oldVal
      .slice(0, cursor)
      .replace(/\D/g, "").length;
    const formatted = formatCurrency(oldVal);

    setFormattedBalance(formatted);
    const rawDigits = oldVal.replace(/\D/g, "");
    setValue("balance", rawDigits ? Number(rawDigits) : 0, {
      shouldValidate: true,
      shouldDirty: true,
    });

    requestAnimationFrame(() => {
      if (!balanceInputRef.current) return;
      let newCursor = 0;
      let digitsCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (digitsCount >= digitsBeforeCursor) {
          newCursor = i;
          break;
        }
        if (/\d/.test(formatted[i])) {
          digitsCount++;
        }
        newCursor = i + 1;
      }
      balanceInputRef.current.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleBalanceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const input = e.currentTarget;
      const { selectionStart, selectionEnd, value } = input;
      if (
        selectionStart !== null &&
        selectionStart === selectionEnd &&
        selectionStart > 1 &&
        value[selectionStart - 1] === "."
      ) {
        e.preventDefault();
        const before = value.slice(0, selectionStart - 2);
        const after = value.slice(selectionStart);
        const newVal = before + after;
        const formatted = formatCurrency(newVal);
        setFormattedBalance(formatted);
        const rawDigits = newVal.replace(/\D/g, "");
        setValue("balance", rawDigits ? Number(rawDigits) : 0, {
          shouldValidate: true,
          shouldDirty: true,
        });

        requestAnimationFrame(() => {
          if (!balanceInputRef.current) return;
          const targetDigits = before.replace(/\D/g, "").length;
          let newCursor = 0;
          let count = 0;
          for (let i = 0; i < formatted.length; i++) {
            if (count >= targetDigits) {
              newCursor = i;
              break;
            }
            if (/\d/.test(formatted[i])) count++;
            newCursor = i + 1;
          }
          balanceInputRef.current.setSelectionRange(newCursor, newCursor);
        });
      }
    }
  };

  const onFormSubmit = async (values: PaymentMethodFormValues) => {
    setSubmitError(null);
    try {
      const res =
        isEditing && paymentMethod
          ? await updatePaymentMethod(paymentMethod.id, values)
          : await createPaymentMethod(values);

      if (res.error) {
        setSubmitError(res.error);
        return;
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save payment method",
      );
    }
  };

  const handleDeleteClick = () => {
    if (paymentMethod && onDelete) {
      onOpenChange(false);
      onDelete(paymentMethod);
    }
  };

  const activeMorePreset = [...POPULAR_BANKS, ...POPULAR_EWALLETS].find(
    (preset) => preset.name === currentName && preset.type === currentType,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base sm:text-lg">
            {isEditing ? "Edit Payment Method" : "Add Payment Method"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update your payment method or wallet details."
              : "Create a new wallet or account to track your balances."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Quick Presets
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {TOP_PRESETS.map((preset) => {
                const isActive =
                  currentName === preset.name && currentType === preset.type;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    disabled={isSubmitting}
                    className={cn(
                      "h-7 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                    )}
                  >
                    {preset.name}
                  </button>
                );
              })}

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      disabled={isSubmitting}
                      className={cn(
                        "flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeMorePreset
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                      )}
                    >
                      <span>
                        {activeMorePreset
                          ? activeMorePreset.name
                          : "More Presets"}
                      </span>
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  }
                />
                <DropdownMenuContent
                  align="start"
                  className="max-h-72 w-52 overflow-y-auto"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Popular Banks (10)
                    </DropdownMenuLabel>
                    {POPULAR_BANKS.map((preset) => (
                      <DropdownMenuItem
                        key={preset.name}
                        onClick={() => handlePresetSelect(preset)}
                        className="flex cursor-pointer items-center justify-between text-xs"
                      >
                        <span>{preset.name}</span>
                        {currentName === preset.name &&
                          currentType === preset.type && (
                            <Check className="size-3.5 text-primary" />
                          )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      E-Wallets (10)
                    </DropdownMenuLabel>
                    {POPULAR_EWALLETS.map((preset) => (
                      <DropdownMenuItem
                        key={preset.name}
                        onClick={() => handlePresetSelect(preset)}
                        className="flex cursor-pointer items-center justify-between text-xs"
                      >
                        <span>{preset.name}</span>
                        {currentName === preset.name &&
                          currentType === preset.type && (
                            <Check className="size-3.5 text-primary" />
                          )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-name" className="text-xs font-medium">
              Wallet / Account Name
            </Label>
            <Input
              id="payment-name"
              placeholder="e.g. BCA, GoPay, Dompet Utama"
              {...register("name")}
              value={currentName ?? ""}
              disabled={isSubmitting}
              autoFocus
              className="text-sm"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = currentType === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setValue("type", item.value, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    disabled={isSubmitting}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-medium shadow-2xs"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate text-[11px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.type && (
              <p className="text-[11px] text-destructive">
                {errors.type.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-balance" className="text-xs font-medium">
              Initial Balance
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="select-none text-xs font-semibold text-muted-foreground">
                  Rp
                </span>
              </div>
              <Input
                ref={balanceInputRef}
                id="payment-balance"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={formattedBalance}
                onChange={handleBalanceChange}
                onKeyDown={handleBalanceKeyDown}
                disabled={isSubmitting}
                className="pl-9 font-medium tabular-nums text-sm"
                aria-invalid={Boolean(errors.balance)}
              />
            </div>
            {errors.balance && (
              <p className="text-[11px] text-destructive">
                {errors.balance.message}
              </p>
            )}
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
              {submitError}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            {isEditing && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                onClick={handleDeleteClick}
                className="gap-1.5 text-xs"
              >
                <Trash2 className="size-3.5" />
                <span>Delete Wallet</span>
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-2">
              <DialogClose
                render={
                  <Button variant="outline" size="sm" disabled={isSubmitting}>
                    Cancel
                  </Button>
                }
              />
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Wallet"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
