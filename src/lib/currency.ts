export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  defaultLocale: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  {
    code: "IDR",
    name: "Indonesian Rupiah",
    symbol: "Rp",
    decimals: 0,
    defaultLocale: "id-ID",
    flag: "🇮🇩",
  },
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    decimals: 2,
    defaultLocale: "en-US",
    flag: "🇺🇸",
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    decimals: 2,
    defaultLocale: "de-DE",
    flag: "🇪🇺",
  },
  {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    decimals: 2,
    defaultLocale: "en-GB",
    flag: "🇬🇧",
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    decimals: 2,
    defaultLocale: "en-SG",
    flag: "🇸🇬",
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
    decimals: 0,
    defaultLocale: "ja-JP",
    flag: "🇯🇵",
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
    decimals: 2,
    defaultLocale: "en-AU",
    flag: "🇦🇺",
  },
  {
    code: "CAD",
    name: "Canadian Dollar",
    symbol: "C$",
    decimals: 2,
    defaultLocale: "en-CA",
    flag: "🇨🇦",
  },
  {
    code: "MYR",
    name: "Malaysian Ringgit",
    symbol: "RM",
    decimals: 2,
    defaultLocale: "ms-MY",
    flag: "🇲🇾",
  },
  {
    code: "CHF",
    name: "Swiss Franc",
    symbol: "CHF",
    decimals: 2,
    defaultLocale: "de-CH",
    flag: "🇨🇭",
  },
  {
    code: "CNY",
    name: "Chinese Yuan",
    symbol: "¥",
    decimals: 2,
    defaultLocale: "zh-CN",
    flag: "🇨🇳",
  },
  {
    code: "INR",
    name: "Indian Rupee",
    symbol: "₹",
    decimals: 2,
    defaultLocale: "en-IN",
    flag: "🇮🇳",
  },
  {
    code: "KRW",
    name: "South Korean Won",
    symbol: "₩",
    decimals: 0,
    defaultLocale: "ko-KR",
    flag: "🇰🇷",
  },
  {
    code: "THB",
    name: "Thai Baht",
    symbol: "฿",
    decimals: 2,
    defaultLocale: "th-TH",
    flag: "🇹🇭",
  },
  {
    code: "PHP",
    name: "Philippine Peso",
    symbol: "₱",
    decimals: 2,
    defaultLocale: "en-PH",
    flag: "🇵🇭",
  },
  {
    code: "VND",
    name: "Vietnamese Dong",
    symbol: "₫",
    decimals: 0,
    defaultLocale: "vi-VN",
    flag: "🇻🇳",
  },
];

const CURRENCY_MAP = new Map<string, CurrencyConfig>(
  SUPPORTED_CURRENCIES.map((c) => [c.code.toUpperCase(), c]),
);

export function getCurrencyConfig(code = "IDR"): CurrencyConfig {
  const upper = (code || "IDR").toUpperCase();
  const found = CURRENCY_MAP.get(upper);
  if (found) return found;

  return {
    code: upper,
    name: upper,
    symbol: upper,
    decimals: 2,
    defaultLocale: "en-US",
    flag: "🌐",
  };
}

export interface FormatMoneyOptions {
  compact?: boolean;
  showSymbol?: boolean;
  locale?: string;
  signDisplay?: "auto" | "never" | "always" | "exceptZero";
}

export function formatMoney(
  amount: number | string,
  currencyCode = "IDR",
  options?: FormatMoneyOptions,
): string {
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(num) || num === null || num === undefined) {
    return "0";
  }

  const config = getCurrencyConfig(currencyCode);
  const locale = options?.locale || config.defaultLocale;

  try {
    return new Intl.NumberFormat(locale, {
      style: options?.showSymbol === false ? "decimal" : "currency",
      currency: config.code,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
      notation: options?.compact ? "compact" : "standard",
      signDisplay: options?.signDisplay ?? "auto",
    }).format(num);
  } catch {
    const fixed = num.toFixed(config.decimals);
    return `${config.symbol} ${fixed}`;
  }
}

export function formatCompactMoney(
  amount: number | string,
  currencyCode = "IDR",
): string {
  return formatMoney(amount, currencyCode, { compact: true });
}

export function getSeparators(
  currencyCode = "IDR",
  locale?: string,
): { decimal: string; thousand: string } {
  const config = getCurrencyConfig(currencyCode);
  const targetLocale = locale || config.defaultLocale;

  try {
    const parts = new Intl.NumberFormat(targetLocale, {
      style: "decimal",
      minimumFractionDigits: 1,
    }).formatToParts(1000.5);

    const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
    const thousand = parts.find((p) => p.type === "group")?.value ?? ",";
    return { decimal, thousand };
  } catch {
    return { decimal: ".", thousand: "," };
  }
}
