"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CircleHelp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CurrencyInput } from "@/components/shared/currency-input";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PaymentMethod } from "@/lib/db/schemas";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  deleteCategory,
  fetchCategoriesWithCache,
  getCachedCategoriesSync,
  getTransactionCountByCategory,
  invalidateCategoriesCache,
  renameCategory,
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

import { EditCategoryDialog } from "./edit-category-dialog";

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
  const { convert, baseCurrency, format } = useCurrency();

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
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryTxCounts, setCategoryTxCounts] = useState<
    Record<string, number>
  >({});
  const [dateTimeInput, setDateTimeInput] = useState(() =>
    toLocalDatetimeString(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
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
      currency: transaction?.currency ?? baseCurrency,
      amount: transaction ? Number(transaction.amount) : 0,
      toAmount: transaction?.toAmount ? Number(transaction.toAmount) : null,
      exchangeRate: transaction?.exchangeRate
        ? Number(transaction.exchangeRate)
        : null,
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
  const currentAmount = watch("amount");
  const currentToAmount = watch("toAmount");

  const sourceWallet = wallets.find((w) => w.id === currentWalletId);
  const destWallet = wallets.find((w) => w.id === currentToWalletId);

  const sourceCurrency = sourceWallet?.currency || baseCurrency;
  const destCurrency = destWallet?.currency || baseCurrency;
  const isCrossCurrency =
    currentType === "transfer" &&
    Boolean(destWallet) &&
    destCurrency !== sourceCurrency;

  useEffect(() => {
    register("amount");
    register("toAmount");
    register("currency");
    register("category");
    register("paymentMethodId");
    register("toPaymentMethodId");
  }, [register]);

  useEffect(() => {
    if (open && (!prevOpenRef.current || transaction?.id)) {
      setSubmitError(null);
      clearErrors();

      const initialType = transaction?.type ?? defaultType;
      const initialAmount = transaction ? Number(transaction.amount) : 0;
      const initialToAmount = transaction?.toAmount
        ? Number(transaction.toAmount)
        : null;

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
      setEditingCategory(null);
      setCategoryTxCounts({});

      fetchPaymentMethodsWithCache().then((cachedWallets) => {
        setWallets(cachedWallets);
        let defaultWalletId = transaction?.paymentMethodId ?? "";
        if (!defaultWalletId && cachedWallets.length > 0) {
          defaultWalletId = cachedWallets[0].id;
        }

        let defaultToWalletId = transaction?.toPaymentMethodId ?? "";
        if (
          initialType === "transfer" &&
          !defaultToWalletId &&
          cachedWallets.length > 1
        ) {
          const other = cachedWallets.find((w) => w.id !== defaultWalletId);
          defaultToWalletId = other ? other.id : "";
        }

        const selectedSource = cachedWallets.find(
          (w) => w.id === defaultWalletId,
        );

        reset({
          type: initialType,
          currency:
            transaction?.currency ?? selectedSource?.currency ?? baseCurrency,
          amount: initialAmount,
          toAmount: initialToAmount,
          title: transaction?.title ?? "",
          paymentMethodId: defaultWalletId,
          toPaymentMethodId: defaultToWalletId,
          category: initialCat,
          description: transaction?.description ?? "",
          date: txDate,
        });
      });

      if (initialType === "transfer") {
        setCategories(["Transfer"]);
      } else {
        fetchCategoriesWithCache(initialType).then((cachedCats) => {
          setCategories(cachedCats);
          if (!cachedCats.includes(initialCat) && initialCat !== "Transfer") {
            setIsCustomCategory(true);
            setCustomCategoryInput(initialCat);
          }
        });
      }
    }
    prevOpenRef.current = open;
  }, [open, transaction, defaultType, reset, clearErrors, baseCurrency]);

  const onSubmit = async (values: TransactionFormValues) => {
    setSubmitError(null);
    try {
      const selectedSource = wallets.find(
        (w) => w.id === values.paymentMethodId,
      );
      const effectiveCurrency = selectedSource?.currency || baseCurrency;

      const payload: TransactionFormValues = {
        ...values,
        currency: effectiveCurrency,
      };

      if (payload.type === "transfer" && payload.toPaymentMethodId) {
        const dest = wallets.find((w) => w.id === payload.toPaymentMethodId);
        if (dest && dest.currency !== effectiveCurrency) {
          const toAmt =
            payload.toAmount ??
            convert(payload.amount, effectiveCurrency, dest.currency);
          payload.toAmount = toAmt;
          payload.exchangeRate = toAmt / payload.amount;
        } else {
          payload.toAmount = payload.amount;
          payload.exchangeRate = 1;
        }
      }

      if (isEditing && transaction) {
        const res = await updateTransaction(transaction.id, payload);
        if (res.error) {
          setSubmitError(res.error);
          return;
        }
      } else {
        const res = await createTransaction(payload);
        if (res.error) {
          setSubmitError(res.error);
          return;
        }
      }

      invalidatePaymentMethodsCache();
      invalidateCategoriesCache();
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    }
  };

  const handleTypeChange = (newType: "expense" | "income" | "transfer") => {
    setValue("type", newType, { shouldValidate: true, shouldDirty: true });
    setIsCustomCategory(false);
    setCustomCategoryInput("");
    setEditingCategory(null);
    setCategoryTxCounts({});

    if (newType === "transfer") {
      setValue("category", "Transfer", { shouldValidate: true });
      const currentSource = getValues("paymentMethodId");
      const otherWallet = wallets.find((w) => w.id !== currentSource);
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

  const handleAmountChange = (val: number) => {
    setValue("amount", val, { shouldValidate: true, shouldDirty: true });
    if (isCrossCurrency && destWallet) {
      const converted = convert(val, sourceCurrency, destCurrency);
      setValue("toAmount", converted, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
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
    const text = e.target.value;
    setCustomCategoryInput(text);
    setValue("category", text.trim(), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const defaultCategoriesSet = new Set<string>(
    currentType === "expense"
      ? DEFAULT_EXPENSE_CATEGORIES
      : DEFAULT_INCOME_CATEGORIES,
  );

  const isCustomCat = useCallback(
    (cat: string) => !defaultCategoriesSet.has(cat),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentType],
  );

  const fetchTxCount = useCallback(
    async (cat: string) => {
      if (
        currentType === "transfer" ||
        categoryTxCounts[cat] !== undefined
      )
        return;
      const count = await getTransactionCountByCategory(
        cat,
        currentType as "income" | "expense",
      );
      setCategoryTxCounts((prev) => ({ ...prev, [cat]: count }));
    },
    [currentType, categoryTxCounts],
  );

  const handleEditCategory = (cat: string) => {
    setEditingCategory(cat);
  };

  const handleSaveEditedCategory = async (newName: string) => {
    if (!editingCategory) return;
    const type = currentType as "income" | "expense";
    const result = await renameCategory(editingCategory, newName, type);
    if (result.error) {
      return { error: result.error };
    }
    invalidateCategoriesCache(type);
    const refreshed = await fetchCategoriesWithCache(type, true);
    setCategories(refreshed);
    if (currentCategory === editingCategory) {
      setValue("category", newName, { shouldValidate: true });
    }
    setCategoryTxCounts({});
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (cat: string) => {
    const type = currentType as "income" | "expense";
    const result = await deleteCategory(cat, type);
    if (result.success) {
      invalidateCategoriesCache(type);
      const refreshed = await fetchCategoriesWithCache(type, true);
      setCategories(refreshed);
      if (currentCategory === cat) {
        setValue("category", refreshed[0] ?? "Other", {
          shouldValidate: true,
        });
      }
      setCategoryTxCounts((prev) => {
        const next = { ...prev };
        delete next[cat];
        return next;
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Transaction" : "Record Transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify transaction details and adjust wallet balances."
              : "Track a new expense, income, or transfer between wallets."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Type Selector Tabs */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => handleTypeChange("expense")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors",
                currentType === "expense"
                  ? "bg-background text-destructive shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowDownLeft className="size-3.5" />
              <span>Expense</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("income")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors",
                currentType === "income"
                  ? "bg-background text-emerald-600 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowUpRight className="size-3.5" />
              <span>Income</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("transfer")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors",
                currentType === "transfer"
                  ? "bg-background text-primary shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowLeftRight className="size-3.5" />
              <span>Transfer</span>
            </button>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tx-amount" className="text-xs font-medium">
                Amount
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Wallet Currency: <strong>{sourceCurrency}</strong>
              </span>
            </div>
            <CurrencyInput
              id="tx-amount"
              value={Number(currentAmount) || 0}
              currencyCode={sourceCurrency}
              onChange={handleAmountChange}
              disabled={isSubmitting}
              autoFocus
              aria-invalid={Boolean(errors.amount)}
            />
            {errors.amount && (
              <p className="text-[11px] text-destructive">
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Cross-Currency Transfer Received Amount */}
          {isCrossCurrency && destWallet && (
            <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <Label
                  htmlFor="tx-to-amount"
                  className="font-medium text-foreground"
                >
                  Received in {destWallet.name} ({destCurrency})
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  FX Conversion
                </span>
              </div>
              <CurrencyInput
                id="tx-to-amount"
                value={
                  currentToAmount !== null && currentToAmount !== undefined
                    ? Number(currentToAmount)
                    : convert(
                        Number(currentAmount) || 0,
                        sourceCurrency,
                        destCurrency,
                      )
                }
                currencyCode={destCurrency}
                onChange={(val) =>
                  setValue("toAmount", val, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                disabled={isSubmitting}
              />
              <p className="text-[10px] text-muted-foreground">
                Auto-converted using reference rates. Adjust if your bank
                charged a different fee.
              </p>
            </div>
          )}

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
                      ? `${w.name} (${w.type}) : ${format(w.balance, w.currency || baseCurrency)}`
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
                              {format(w.balance, w.currency || baseCurrency)}
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
                      ? `${w.name} (${w.type}) : ${format(w.balance, w.currency || baseCurrency)}`
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
                              {format(w.balance, w.currency || baseCurrency)}
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
            /* Single Wallet Selector */
            <div className="space-y-1.5">
              <Label htmlFor="tx-wallet" className="text-xs font-medium">
                Wallet / Payment Method
              </Label>
              <Combobox
                items={wallets}
                itemToStringLabel={(w: PaymentMethod) =>
                  w
                    ? `${w.name} (${w.type}) : ${format(w.balance, w.currency || baseCurrency)}`
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
                            {format(w.balance, w.currency || baseCurrency)}
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

          {/* Category Selector */}
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
                    placeholder="Enter new category name..."
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
                    const isCustom = isCustomCat(cat);

                    const categoryButton = (
                      <button
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

                    if (!isCustom) {
                      return (
                        <span key={cat}>
                          {categoryButton}
                        </span>
                      );
                    }

                    const txCount = categoryTxCounts[cat];
                    const hasTransactions =
                      txCount === undefined || txCount > 0;

                    return (
                      <ContextMenu key={cat} onOpenChange={(open) => {
                        if (open) fetchTxCount(cat);
                      }}>
                        <ContextMenuTrigger className="inline-flex">
                          {categoryButton}
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onSelect={() => handleEditCategory(cat)}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </ContextMenuItem>
                          {hasTransactions ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <div className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground opacity-50">
                                    <Trash2 className="size-3.5" />
                                    Delete
                                    <CircleHelp className="ml-auto size-3.5" />
                                  </div>
                                }
                              />
                              <TooltipContent side="bottom">
                                You have{" "}
                                {txCount === undefined
                                  ? "…"
                                  : txCount}{" "}
                                transaction
                                {txCount !== 1 ? "s" : ""} with this
                                category, change them first before
                                deleting it
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <ContextMenuItem
                              variant="destructive"
                              onSelect={() => handleDeleteCategory(cat)}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </ContextMenuItem>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
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

    <EditCategoryDialog
      open={Boolean(editingCategory)}
      onOpenChange={(open) => {
        if (!open) setEditingCategory(null);
      }}
      category={editingCategory}
      onSave={handleSaveEditedCategory}
    />
  </>
  );
}
