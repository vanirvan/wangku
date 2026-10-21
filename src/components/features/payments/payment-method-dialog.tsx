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
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { getCurrencyConfig, SUPPORTED_CURRENCIES } from "@/lib/currency";
import type { PaymentMethod } from "@/lib/db/schemas";
import {
  createPaymentMethod,
  invalidatePaymentMethodsCache,
  type PaymentMethodFormValues,
  type PaymentMethodInput,
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
  const { baseCurrency } = useCurrency();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodInput, unknown, PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      name: "",
      type: "cash" as PaymentMethodType,
      currency: baseCurrency,
      balance: 0,
    },
  });

  const currentName = watch("name");
  const currentType = watch("type");
  const currentCurrency = watch("currency") || baseCurrency;
  const currentBalance = watch("balance");

  useEffect(() => {
    register("balance");
    register("currency");
  }, [register]);

  useEffect(() => {
    if (open) {
      setSubmitError(null);
      if (paymentMethod) {
        const validTypes: PaymentMethodType[] = [
          "cash",
          "bank",
          "ewallet",
          "card",
          "other",
        ];
        const safeType = validTypes.includes(
          paymentMethod.type as PaymentMethodType,
        )
          ? (paymentMethod.type as PaymentMethodType)
          : "other";

        reset({
          name: paymentMethod.name,
          type: safeType,
          currency: paymentMethod.currency || baseCurrency,
          balance: Number(paymentMethod.balance) || 0,
        });
      } else {
        reset({
          name: "",
          type: "cash",
          currency: baseCurrency,
          balance: 0,
        });
      }
    }
  }, [open, paymentMethod, reset, baseCurrency]);

  const onSubmit = async (values: PaymentMethodFormValues) => {
    setSubmitError(null);
    try {
      if (isEditing && paymentMethod) {
        const res = await updatePaymentMethod(paymentMethod.id, values);
        if (res.error) {
          setSubmitError(res.error);
          return;
        }
      } else {
        const res = await createPaymentMethod(values);
        if (res.error) {
          setSubmitError(res.error);
          return;
        }
      }

      invalidatePaymentMethodsCache();
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    }
  };

  const handleSelectPreset = (name: string, type: PaymentMethodType) => {
    setValue("name", name, { shouldValidate: true, shouldDirty: true });
    setValue("type", type, { shouldValidate: true, shouldDirty: true });
  };

  const handleDeleteClick = () => {
    if (paymentMethod && onDelete) {
      onOpenChange(false);
      onDelete(paymentMethod);
    }
  };

  const activeCurrencyConfig = getCurrencyConfig(currentCurrency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Payment Method" : "Add Payment Method"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details and balance for this account."
              : "Create a new wallet, bank account, card, or e-wallet."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Quick Presets (Only when creating) */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">
                Quick Presets
              </Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {TOP_PRESETS.map((p) => {
                  const isSelected =
                    currentName === p.name && currentType === p.type;
                  return (
                    <Button
                      key={p.name}
                      type="button"
                      variant={isSelected ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => handleSelectPreset(p.name, p.type)}
                      className={cn(
                        "h-7 text-xs font-normal",
                        isSelected && "border-foreground/30 font-medium",
                      )}
                    >
                      {p.name}
                    </Button>
                  );
                })}

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                      />
                    }
                  >
                    <span>More</span>
                    <ChevronDown className="ml-1 size-3 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Banks
                      </DropdownMenuLabel>
                      {POPULAR_BANKS.map((bank) => (
                        <DropdownMenuItem
                          key={bank.name}
                          onClick={() =>
                            handleSelectPreset(bank.name, bank.type)
                          }
                          className="flex items-center justify-between text-xs"
                        >
                          <span>{bank.name}</span>
                          {currentName === bank.name && (
                            <Check className="size-3 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        E-Wallets
                      </DropdownMenuLabel>
                      {POPULAR_EWALLETS.map((ew) => (
                        <DropdownMenuItem
                          key={ew.name}
                          onClick={() => handleSelectPreset(ew.name, ew.type)}
                          className="flex items-center justify-between text-xs"
                        >
                          <span>{ew.name}</span>
                          {currentName === ew.name && (
                            <Check className="size-3 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          {/* Account Name */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-name" className="text-xs font-medium">
              Account / Wallet Name
            </Label>
            <Input
              id="payment-name"
              placeholder="e.g. BCA Main, Cash, GoPay"
              {...register("name")}
              disabled={isSubmitting}
              className="text-sm"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Currency Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-currency" className="text-xs font-medium">
              Currency
            </Label>
            <Combobox
              items={SUPPORTED_CURRENCIES}
              itemToStringLabel={(c: (typeof SUPPORTED_CURRENCIES)[number]) =>
                c ? `${c.flag} ${c.code} (${c.symbol})` : ""
              }
              itemToStringValue={(c: (typeof SUPPORTED_CURRENCIES)[number]) =>
                c ? `${c.code} ${c.name}` : ""
              }
              isItemEqualToValue={(
                a: (typeof SUPPORTED_CURRENCIES)[number],
                b: (typeof SUPPORTED_CURRENCIES)[number],
              ) => a?.code === b?.code}
              value={activeCurrencyConfig}
              onValueChange={(
                val: (typeof SUPPORTED_CURRENCIES)[number] | null,
              ) => {
                if (val?.code) {
                  setValue("currency", val.code, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }
              }}
            >
              <ComboboxInput
                id="payment-currency"
                placeholder="Select currency..."
              />
              <ComboboxContent>
                <ComboboxEmpty>No currency found.</ComboboxEmpty>
                <ComboboxList>
                  {(c: (typeof SUPPORTED_CURRENCIES)[number]) => (
                    <ComboboxItem key={c.code} value={c}>
                      <span className="mr-2">{c.flag}</span>
                      <span className="font-medium mr-1.5">{c.code}</span>
                      <span className="text-muted-foreground text-xs">
                        {c.name} ({c.symbol})
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {/* Account Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = currentType === t.value;
                return (
                  <Button
                    key={t.value}
                    type="button"
                    variant={isSelected ? "secondary" : "outline"}
                    size="sm"
                    onClick={() =>
                      setValue("type", t.value, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    className={cn(
                      "flex h-auto flex-col items-center gap-1 py-2 px-1 text-center transition-all",
                      isSelected &&
                        "border-foreground/30 bg-muted font-medium shadow-2xs",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="text-[11px] leading-tight">{t.label}</span>
                  </Button>
                );
              })}
            </div>
            {errors.type && (
              <p className="text-[11px] text-destructive">
                {errors.type.message}
              </p>
            )}
          </div>

          {/* Balance Input with CurrencyInput */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-balance" className="text-xs font-medium">
              {isEditing ? "Current Balance" : "Initial Balance"}
            </Label>
            <CurrencyInput
              id="payment-balance"
              value={Number(currentBalance) || 0}
              currencyCode={currentCurrency}
              onChange={(val) =>
                setValue("balance", val, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.balance)}
            />
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

            <div className="flex items-center gap-2">
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="min-w-20"
              >
                {isSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isEditing ? (
                  "Save Changes"
                ) : (
                  "Create Account"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
