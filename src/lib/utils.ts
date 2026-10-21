export { cn } from "cn";

export * from "./currency";

import { formatMoney } from "./currency";

export function formatCurrency(
  val: string | number,
  currencyCode = "IDR",
): string {
  return formatMoney(val, currencyCode, { showSymbol: false });
}

export function formatRupiah(val: string | number): string {
  return formatMoney(val, "IDR");
}
