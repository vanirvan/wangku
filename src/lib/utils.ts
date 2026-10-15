export { cn } from "cn";

export function formatCurrency(val: string | number): string {
  const digits = String(val)
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
