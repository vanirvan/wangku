"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  type CurrencyConfig,
  type FormatMoneyOptions,
  formatMoney,
  getCurrencyConfig,
} from "@/lib/currency";
import { convertAmountSync, FALLBACK_RATES_USD } from "@/lib/exchange-rates";
import {
  getExchangeRatesAction,
  getUserSettings,
  updateUserBaseCurrency,
} from "@/services/features/settings";

interface CurrencyContextValue {
  baseCurrency: string;
  config: CurrencyConfig;
  rates: Record<string, number>;
  setBaseCurrency: (code: string) => Promise<void>;
  convert: (
    amount: number,
    fromCurrency: string,
    toCurrency?: string,
  ) => number;
  format: (
    amount: number | string,
    currencyOverride?: string,
    options?: FormatMoneyOptions,
  ) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

interface CurrencyProviderProps {
  children: ReactNode;
  initialBaseCurrency?: string;
  initialRates?: Record<string, number>;
}

export function CurrencyProvider({
  children,
  initialBaseCurrency = "IDR",
  initialRates = FALLBACK_RATES_USD,
}: CurrencyProviderProps) {
  const [baseCurrency, setBaseCurrencyState] =
    useState<string>(initialBaseCurrency);
  const [rates, setRates] = useState<Record<string, number>>(initialRates);

  useEffect(() => {
    if (initialBaseCurrency) {
      setBaseCurrencyState(initialBaseCurrency);
    }
  }, [initialBaseCurrency]);

  useEffect(() => {
    if (initialRates) {
      setRates(initialRates);
    }
  }, [initialRates]);

  useEffect(() => {
    let mounted = true;

    getUserSettings().then((res) => {
      if (mounted && res.data?.baseCurrency) {
        setBaseCurrencyState(res.data.baseCurrency);
      }
    });

    getExchangeRatesAction().then((latestRates) => {
      if (mounted && latestRates) {
        setRates(latestRates);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const config = useMemo(() => getCurrencyConfig(baseCurrency), [baseCurrency]);

  const setBaseCurrency = useCallback(async (code: string) => {
    const validConfig = getCurrencyConfig(code);
    setBaseCurrencyState(validConfig.code);
    await updateUserBaseCurrency(validConfig.code);
  }, []);

  const convert = useCallback(
    (amount: number, fromCurrency: string, toCurrency?: string): number => {
      const target = toCurrency || baseCurrency;
      return convertAmountSync(amount, fromCurrency, target, rates);
    },
    [baseCurrency, rates],
  );

  const format = useCallback(
    (
      amount: number | string,
      currencyOverride?: string,
      options?: FormatMoneyOptions,
    ): string => {
      const targetCurrency = currencyOverride || baseCurrency;
      return formatMoney(amount, targetCurrency, options);
    },
    [baseCurrency],
  );

  const value = useMemo(
    () => ({
      baseCurrency,
      config,
      rates,
      setBaseCurrency,
      convert,
      format,
    }),
    [baseCurrency, config, rates, setBaseCurrency, convert, format],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    const fallbackConfig = getCurrencyConfig("IDR");
    return {
      baseCurrency: "IDR",
      config: fallbackConfig,
      rates: FALLBACK_RATES_USD,
      setBaseCurrency: async () => {},
      convert: (amount: number) => amount,
      format: (
        amount: number | string,
        currencyOverride?: string,
        options?: FormatMoneyOptions,
      ) => formatMoney(amount, currencyOverride || "IDR", options),
    };
  }
  return context;
}
