// fallback taken on oct 21 2026
export const FALLBACK_RATES_USD: Record<string, number> = {
  USD: 1,
  IDR: 18001.598375,
  EUR: 0.89075,
  GBP: 0.748335,
  SGD: 1.278172,
  JPY: 158.224062,
  AUD: 1.428632,
  CAD: 1.40605,
  MYR: 4.082917,
  CHF: 0.825328,
  CNY: 6.691314,
  INR: 94.995216,
  KRW: 1327.17027,
  THB: 33.616253,
  PHP: 63.087647,
  VND: 25846.196303,
};

export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 21600 },
    });
    if (!res.ok) {
      throw new Error(`FX fetch failed with status ${res.status}`);
    }
    const data = (await res.json()) as {
      result: string;
      rates: Record<string, number>;
    };

    if (data?.result === "success" && data.rates) {
      return data.rates;
    }
  } catch {
    // Fall back to pre-defined reference rates when network is unavailable
  }

  return FALLBACK_RATES_USD;
}

export function convertAmountSync(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> = FALLBACK_RATES_USD,
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to || !amount) return amount;

  const fromRate = rates[from] || FALLBACK_RATES_USD[from] || 1;
  const toRate = rates[to] || FALLBACK_RATES_USD[to] || 1;

  const amountInUSD = amount / fromRate;
  return amountInUSD * toRate;
}

export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to || !amount) return amount;

  const rates = await getExchangeRates();
  return convertAmountSync(amount, from, to, rates);
}

export async function getRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return 1;

  const rates = await getExchangeRates();
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  return toRate / fromRate;
}
