"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Loader2,
  Plus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMethod } from "@/lib/db/schemas";
import { formatCurrency, formatRupiah } from "@/lib/utils";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  fetchCategoriesWithCache,
  getCachedCategoriesSync,
  invalidateCategoriesCache,
} from "@/services/features/categories";
import {
  fetchPaymentMethodsWithCache,
  getCachedPaymentMethodsSync,
  invalidatePaymentMethodsCache,
} from "@/services/features/payments";
import {
  createTransaction,
  type TransactionFormValues,
  type TransactionInput,
  type TransactionWithPaymentMethod,
  transactionSchema,
  updateTransaction,
} from "@/services/features/transactions";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultType?: "expense" | "income" | "transfer";
  transaction?: TransactionWithPaymentMethod | null;
}

function toLocalDatetimeString(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function TransactionDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultType = "expense",
  transaction = null,
}: TransactionDialogProps) {
  const isEditing = Boolean(transaction);
  const [wallets, setWallets] = useState<PaymentMethod[]>(
    () => getCachedPaymentMethodsSync() ?? [],
  );
  const [categories, setCategories] = useState<string[]>(() =>
    defaultType === "transfer"
      ? ["Transfer"]
      : getCachedCategoriesSync(defaultType),
  );
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [formattedAmount, setFormattedAmount] = useState("0");
  const [dateTimeInput, setDateTimeInput] = useState(() =>
    toLocalDatetimeString(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    watch,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<TransactionInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: transaction?.type ?? defaultType,
      amount: transaction ? Number(transaction.amount) : 0,
      title: transaction?.title ?? "",
      paymentMethodId: transaction?.paymentMethodId ?? "",
      toPaymentMethodId: transaction?.toPaymentMethodId ?? "",
      category:
        transaction?.category ??
        (defaultType === "income"
          ? DEFAULT_INCOME_CATEGORIES[0]
          : defaultType === "transfer"
            ? "Transfer"
            : DEFAULT_EXPENSE_CATEGORIES[0]),
      description: transaction?.description ?? "",
      date: transaction?.date ? new Date(transaction.date) : new Date(),
    },
  });

  const currentType = watch("type");
  const currentCategory = watch("category");
  const currentWalletId = watch("paymentMethodId");
  const currentToWalletId = watch("toPaymentMethodId");

  useEffect(() => {
    register("amount");
    register("category");
    register("paymentMethodId");
    register("toPaymentMethodId");
  }, [register]);

  // Initialize and reset dialog state when opening or transaction changes
  useEffect(() => {
    if (open && (!prevOpenRef.current || transaction?.id)) {
      setSubmitError(null);
      clearErrors();

      const initialType = transaction?.type ?? defaultType;
      const initialAmount = transaction ? Number(transaction.amount) : 0;
      setFormattedAmount(
        initialAmount > 0 ? formatCurrency(initialAmount) : "0",
      );

      const txDate = transaction?.date
        ? new Date(transaction.date)
        : new Date();
      setDateTimeInput(toLocalDatetimeString(txDate));

      const initialCat =
        transaction?.category ??
        (initialType === "income"
          ? DEFAULT_INCOME_CATEGORIES[0]
          : initialType === "transfer"
            ? "Transfer"
            : DEFAULT_EXPENSE_CATEGORIES[0]);

      setIsCustomCategory(false);
      setCustomCategoryInput("");

      if (initialType === "transfer") {
        setCategories(["Transfer"]);
      } else {
        setCategories(getCachedCategoriesSync(initialType));
      }

      reset({
        type: initialType,
        amount: initialAmount,
        title: transaction?.title ?? "",
        paymentMethodId: transaction?.paymentMethodId ?? "",
        toPaymentMethodId: transaction?.toPaymentMethodId ?? "",
        category: initialCat,
        description: transaction?.description ?? "",
        date: txDate,
      });

      // Load wallets and prefetch categories with cache
      fetchPaymentMethodsWithCache().then((fetched) => {
        setWallets(fetched);
        if (fetched.length > 0 && !getValues("paymentMethodId")) {
          setValue("paymentMethodId", fetched[0].id, { shouldValidate: true });
        }
      });
      fetchCategoriesWithCache("expense");
      fetchCategoriesWithCache("income");
    }
    prevOpenRef.current = open;
  }, [open, transaction, defaultType, reset, clearErrors, setValue, getValues]);

  // Load categories with cache when dialog is open and type changes
  useEffect(() => {
    if (!open || currentType === "transfer") return;

    let mounted = true;
    fetchCategoriesWithCache(currentType).then((fetchedCategories) => {
      if (!mounted) return;
      setCategories(fetchedCategories);

      if (fetchedCategories.length > 0) {
        const current = getValues("category");
        if (!current || !fetchedCategories.some((c) => c === current)) {
          setValue("category", fetchedCategories[0], {
            shouldValidate: true,
          });
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [open, currentType, setValue, getValues]);

  const handleTypeChange = (newType: "expense" | "income" | "transfer") => {
    setValue("type", newType, { shouldValidate: false });
    setIsCustomCategory(false);
    setCustomCategoryInput("");
    clearErrors("category");
    clearErrors("toPaymentMethodId");

    if (newType === "transfer") {
      setValue("category", "Transfer", { shouldValidate: true });
      setValue("title", getValues("title") || "Wallet Transfer", {
        shouldValidate: false,
      });
      // Pick second wallet as destination if available
      const srcId = getValues("paymentMethodId");
      const otherWallet = wallets.find((w) => w.id !== srcId);
      if (otherWallet) {
        setValue("toPaymentMethodId", otherWallet.id, {
          shouldValidate: true,
        });
      }
      setCategories(["Transfer"]);
    } else {
      const cached = getCachedCategoriesSync(newType);
      setValue("category", cached[0], { shouldValidate: true });
      setValue("toPaymentMethodId", null, { shouldValidate: false });
      setCategories(cached);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursor = input.selectionStart ?? 0;
    const oldVal = input.value;
    const digitsBeforeCursor = oldVal
      .slice(0, cursor)
      .replace(/\D/g, "").length;
    const formatted = formatCurrency(oldVal);

    setFormattedAmount(formatted);
    const rawDigits = oldVal.replace(/\D/g, "");
    setValue("amount", rawDigits ? Number(rawDigits) : 0, {
      shouldValidate: true,
      shouldDirty: true,
    });

    requestAnimationFrame(() => {
      if (!amountInputRef.current) return;
      let newCursor = 0;
      let digitsCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (digitsCount >= digitsBeforeCursor) {
          newCursor = i;
          break;
        }
        if (/\d/.test(formatted[i])) digitsCount++;
        newCursor = i + 1;
      }
      amountInputRef.current.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleCategorySelect = (cat: string) => {
    setIsCustomCategory(false);
    setValue("category", cat, { shouldValidate: true, shouldDirty: true });
  };

  const handleCustomCategoryToggle = () => {
    setIsCustomCategory(true);
    setValue("category", customCategoryInput.trim(), {
      shouldValidate: false,
      shouldDirty: true,
    });
  };

  const handleCustomCategoryChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const val = e.target.value;
    setCustomCategoryInput(val);
    setValue("category", val.trim(), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const onFormSubmit = async (values: TransactionFormValues) => {
    setSubmitError(null);
    try {
      const res =
        isEditing && transaction
          ? await updateTransaction(transaction.id, values)
          : await createTransaction(values);

      if (res.error) {
        setSubmitError(res.error);
        return;
      }

      invalidatePaymentMethodsCache();
      if (isCustomCategory) {
        invalidateCategoriesCache(
          values.type === "transfer" ? undefined : values.type,
        );
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save transaction",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base sm:text-lg">
            {isEditing ? "Edit Transaction" : "Record Transaction"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update transaction details and wallet balances will be updated automatically."
              : "Log your income, expense, or wallet transfer to keep your balances accurate."}
          </DialogDescription>
        </DialogHeader>

        {/* 3-Way Type Switcher: Expense | Income | Wallet Transfer */}
        <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleTypeChange("expense")}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all",
              currentType === "expense"
                ? "bg-destructive text-destructive-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowDownLeft className="size-3.5" />
            <span>Expense</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleTypeChange("income")}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all",
              currentType === "income"
                ? "bg-emerald-600 text-white shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowUpRight className="size-3.5" />
            <span>Income</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleTypeChange("transfer")}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all",
              currentType === "transfer"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowLeftRight className="size-3.5" />
            <span>Transfer</span>
          </button>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3.5">
          {/* Amount Input */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount" className="text-xs font-medium">
              Amount
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="select-none text-xs font-semibold text-muted-foreground">
                  Rp
                </span>
              </div>
              <Input
                ref={amountInputRef}
                id="tx-amount"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={formattedAmount}
                onChange={handleAmountChange}
                disabled={isSubmitting}
                autoFocus
                className="pl-9 font-medium tabular-nums text-sm"
                aria-invalid={Boolean(errors.amount)}
              />
            </div>
            {errors.amount && (
              <p className="text-[11px] text-destructive">
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-title" className="text-xs font-medium">
              {currentType === "expense"
                ? "What was this spent on?"
                : currentType === "income"
                  ? "Income Source / Received from"
                  : "Transfer Note / Purpose"}
            </Label>
            <Input
              id="tx-title"
              placeholder={
                currentType === "expense"
                  ? "e.g. Lunch, coffee, groceries, electric bill..."
                  : currentType === "income"
                    ? "e.g. Monthly salary, freelance project, gift..."
                    : "e.g. Move money to utility wallet, savings rebalance..."
              }
              {...register("title")}
              disabled={isSubmitting}
              className="text-xs"
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && (
              <p className="text-[11px] text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Wallet Selector(s) */}
          {wallets.length === 0 ? (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
              No wallet found. Create a wallet in the <strong>Payments</strong>{" "}
              menu first.
            </div>
          ) : currentType === "transfer" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Source Wallet (From) */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-wallet-from" className="text-xs font-medium">
                  From Wallet
                </Label>
                <Combobox
                  items={wallets}
                  itemToStringLabel={(w: PaymentMethod) =>
                    w
                      ? `${w.name} (${w.type}) — ${formatRupiah(w.balance)}`
                      : ""
                  }
                  itemToStringValue={(w: PaymentMethod) =>
                    w ? `${w.name} ${w.type}` : ""
                  }
                  isItemEqualToValue={(a: PaymentMethod, b: PaymentMethod) =>
                    a?.id === b?.id
                  }
                  value={wallets.find((w) => w.id === currentWalletId) ?? null}
                  onValueChange={(w: PaymentMethod | null) => {
                    setValue("paymentMethodId", w?.id ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  disabled={isSubmitting}
                >
                  <ComboboxInput
                    id="tx-wallet-from"
                    placeholder="Source wallet..."
                    className="w-full text-xs"
                    aria-invalid={Boolean(errors.paymentMethodId)}
                  />
                  <ComboboxContent className="z-50">
                    <ComboboxEmpty>No wallet found.</ComboboxEmpty>
                    <ComboboxList>
                      {(w: PaymentMethod) => (
                        <ComboboxItem key={w.id} value={w} className="text-xs">
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span className="font-medium">
                              {w.name}{" "}
                              <span className="font-normal text-muted-foreground">
                                ({w.type})
                              </span>
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {formatRupiah(w.balance)}
                            </span>
                          </div>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {errors.paymentMethodId && (
                  <p className="text-[11px] text-destructive">
                    {errors.paymentMethodId.message}
                  </p>
                )}
              </div>

              {/* Destination Wallet (To) */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-wallet-to" className="text-xs font-medium">
                  To Wallet
                </Label>
                <Combobox
                  items={wallets.filter((w) => w.id !== currentWalletId)}
                  itemToStringLabel={(w: PaymentMethod) =>
                    w
                      ? `${w.name} (${w.type}) — ${formatRupiah(w.balance)}`
                      : ""
                  }
                  itemToStringValue={(w: PaymentMethod) =>
                    w ? `${w.name} ${w.type}` : ""
                  }
                  isItemEqualToValue={(a: PaymentMethod, b: PaymentMethod) =>
                    a?.id === b?.id
                  }
                  value={
                    wallets.find((w) => w.id === currentToWalletId) ?? null
                  }
                  onValueChange={(w: PaymentMethod | null) => {
                    setValue("toPaymentMethodId", w?.id ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  disabled={isSubmitting}
                >
                  <ComboboxInput
                    id="tx-wallet-to"
                    placeholder="Destination wallet..."
                    className="w-full text-xs"
                    aria-invalid={Boolean(errors.toPaymentMethodId)}
                  />
                  <ComboboxContent className="z-50">
                    <ComboboxEmpty>No destination wallet found.</ComboboxEmpty>
                    <ComboboxList>
                      {(w: PaymentMethod) => (
                        <ComboboxItem key={w.id} value={w} className="text-xs">
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span className="font-medium">
                              {w.name}{" "}
                              <span className="font-normal text-muted-foreground">
                                ({w.type})
                              </span>
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {formatRupiah(w.balance)}
                            </span>
                          </div>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {errors.toPaymentMethodId && (
                  <p className="text-[11px] text-destructive">
                    {errors.toPaymentMethodId.message}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Single Wallet Selector for Expense & Income */
            <div className="space-y-1.5">
              <Label htmlFor="tx-wallet" className="text-xs font-medium">
                Wallet / Payment Method
              </Label>
              <Combobox
                items={wallets}
                itemToStringLabel={(w: PaymentMethod) =>
                  w ? `${w.name} (${w.type}) — ${formatRupiah(w.balance)}` : ""
                }
                itemToStringValue={(w: PaymentMethod) =>
                  w ? `${w.name} ${w.type}` : ""
                }
                isItemEqualToValue={(a: PaymentMethod, b: PaymentMethod) =>
                  a?.id === b?.id
                }
                value={wallets.find((w) => w.id === currentWalletId) ?? null}
                onValueChange={(w: PaymentMethod | null) => {
                  setValue("paymentMethodId", w?.id ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                disabled={isSubmitting}
              >
                <ComboboxInput
                  id="tx-wallet"
                  placeholder="Select wallet..."
                  className="w-full text-xs"
                  aria-invalid={Boolean(errors.paymentMethodId)}
                />
                <ComboboxContent className="z-50">
                  <ComboboxEmpty>No wallet found.</ComboboxEmpty>
                  <ComboboxList>
                    {(w: PaymentMethod) => (
                      <ComboboxItem key={w.id} value={w} className="text-xs">
                        <div className="flex flex-1 items-center justify-between gap-2">
                          <span className="font-medium">
                            {w.name}{" "}
                            <span className="font-normal text-muted-foreground">
                              ({w.type})
                            </span>
                          </span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {formatRupiah(w.balance)}
                          </span>
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {errors.paymentMethodId && (
                <p className="text-[11px] text-destructive">
                  {errors.paymentMethodId.message}
                </p>
              )}
            </div>
          )}

          {/* Category Selector (Hidden on Transfer, since Category is auto "Transfer") */}
          {currentType !== "transfer" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Category</Label>
                {isCustomCategory ? (
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(false)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Choose from list
                  </button>
                ) : null}
              </div>

              {isCustomCategory ? (
                <div className="space-y-1">
                  <Input
                    placeholder="Enter new category name (e.g. Subscriptions)..."
                    value={customCategoryInput}
                    onChange={handleCustomCategoryChange}
                    disabled={isSubmitting}
                    className="text-xs"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    This new category will be saved to your account
                    automatically.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {categories.map((cat) => {
                    const isSelected = currentCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategorySelect(cat)}
                        disabled={isSubmitting}
                        className={cn(
                          "h-7 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleCustomCategoryToggle}
                    disabled={isSubmitting}
                    className="flex h-7 items-center gap-1 rounded-md border border-dashed border-border bg-muted/30 px-2 text-xs font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  >
                    <Plus className="size-3" />
                    <span>New Category</span>
                  </button>
                </div>
              )}
              {errors.category && (
                <p className="text-[11px] text-destructive">
                  {errors.category.message}
                </p>
              )}
            </div>
          )}

          {/* Date & Note in Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tx-date" className="text-xs font-medium">
                Date & Time
              </Label>
              <Input
                id="tx-date"
                type="datetime-local"
                disabled={isSubmitting}
                value={dateTimeInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateTimeInput(val);
                  if (val) {
                    setValue("date", new Date(val), {
                      shouldValidate: true,
                    });
                  }
                }}
                className="text-xs"
              />
              {errors.date && (
                <p className="text-[11px] text-destructive">
                  {errors.date.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-note" className="text-xs font-medium">
                Additional Notes (Optional)
              </Label>
              <Input
                id="tx-note"
                placeholder="Any extra details or notes..."
                {...register("description")}
                disabled={isSubmitting}
                className="text-xs"
              />
            </div>
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
              {submitError}
            </div>
          )}

          <DialogFooter className="pt-2">
            <div className="flex w-full items-center justify-end gap-2">
              <DialogClose
                render={
                  <Button variant="outline" size="sm" disabled={isSubmitting}>
                    Cancel
                  </Button>
                }
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || wallets.length === 0}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Save Transaction"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
