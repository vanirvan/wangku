"use client";

import { Check, Coins, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { useCurrency } from "@/components/providers/currency-provider";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { formatMoney, SUPPORTED_CURRENCIES } from "@/lib/currency";

export function CurrencySection() {
  const { baseCurrency, setBaseCurrency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSelect = (code: string) => {
    setSelectedCurrency(code);
    setSavedSuccess(false);
    startTransition(async () => {
      await setBaseCurrency(code);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    });
  };

  const activeOption =
    SUPPORTED_CURRENCIES.find((c) => c.code === selectedCurrency) ??
    SUPPORTED_CURRENCIES[0];

  return (
    <section id="currency" className="scroll-mt-8 space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg">Currency & Region</h2>
        <p className="text-muted-foreground text-sm">
          Set your primary currency for dashboard analytics, net cash flow, and
          monthly totals.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label
              htmlFor="base-currency-select"
              className="text-sm font-medium"
            >
              Primary Currency
            </Label>
            <p className="text-xs text-muted-foreground">
              Wallets can use their own currency. The dashboard aggregates
              balances using this base currency.
            </p>
          </div>

          <div className="w-full sm:w-64">
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
              value={activeOption}
              onValueChange={(
                val: (typeof SUPPORTED_CURRENCIES)[number] | null,
              ) => {
                if (val?.code) handleSelect(val.code);
              }}
            >
              <ComboboxInput
                id="base-currency-select"
                placeholder="Search currency..."
              />
              <ComboboxContent>
                <ComboboxEmpty>No currency found.</ComboboxEmpty>
                <ComboboxList>
                  {(currency: (typeof SUPPORTED_CURRENCIES)[number]) => (
                    <ComboboxItem key={currency.code} value={currency}>
                      <span className="mr-2">{currency.flag}</span>
                      <span className="font-medium mr-1.5">
                        {currency.code}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {currency.name} ({currency.symbol})
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>

        {/* Live Preview Display */}
        <div className="rounded-lg bg-muted/40 p-3 border border-border/50 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5">
              <Coins className="size-3.5" />
              Preview formatting
            </span>
            {isPending ? (
              <span className="flex items-center gap-1 text-primary">
                <Loader2 className="size-3 animate-spin" />
                Updating...
              </span>
            ) : savedSuccess ? (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <Check className="size-3" />
                Saved
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded border bg-background px-3 py-2">
              <span className="text-[11px] text-muted-foreground block">
                Income
              </span>
              <span className="font-semibold text-emerald-600 tabular-nums">
                +{formatMoney(1250.5, selectedCurrency)}
              </span>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <span className="text-[11px] text-muted-foreground block">
                Expense
              </span>
              <span className="font-semibold text-destructive tabular-nums">
                -{formatMoney(340.25, selectedCurrency)}
              </span>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <span className="text-[11px] text-muted-foreground block">
                Compact Scale
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(1500000, selectedCurrency, { compact: true })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
