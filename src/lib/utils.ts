export { cn } from "cn";

export function formatCurrency(val: string | number): string {
  if (val === "" || val === null || val === undefined) return "";

  if (typeof val === "number") {
    if (Number.isNaN(val)) return "0";
    const isNeg = val < 0;
    const rounded = Math.round(Math.abs(val));
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return isNeg ? `-${formatted}` : formatted;
  }

  const str = String(val).trim();
  if (!str) return "";

  // Database numeric strings: e.g. "-115000.00", "1500000.00", or integer strings "-115000"
  if (/^-?\d+\.\d{1,2}$/.test(str) || /^-?\d+$/.test(str)) {
    const num = Number(str);
    if (!Number.isNaN(num)) {
      const isNeg = num < 0;
      const rounded = Math.round(Math.abs(num));
      const formatted = rounded
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return isNeg ? `-${formatted}` : formatted;
    }
  }

  // Fallback for user input during typing (e.g. "100.000", "1.500.000")
  const isNeg = str.startsWith("-");
  const digits = str.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return isNeg ? "-0" : "0";
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return isNeg ? `-${formatted}` : formatted;
}

export function formatRupiah(val: string | number): string {
  const formatted = formatCurrency(val);
  if (!formatted) return "Rp 0";
  if (formatted.startsWith("-")) {
    return `Rp -${formatted.slice(1)}`;
  }
  return `Rp ${formatted}`;
}
