"use client";

import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Input } from "@/components/ui/input";
import { getCurrencyConfig } from "@/lib/currency";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange"> {
  value?: number | string;
  onChange?: (val: number) => void;
  currencyCode?: string;
}

function formatWithSeparators(
  rawInteger: string,
  rawDecimal: string | null,
  thousandSep: string,
  decimalSep: string,
): string {
  const formattedInt = rawInteger
    ? rawInteger.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep)
    : "0";

  if (rawDecimal !== null) {
    return `${formattedInt}${decimalSep}${rawDecimal}`;
  }
  return formattedInt;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value = 0,
      onChange,
      currencyCode = "IDR",
      className,
      disabled,
      placeholder = "0",
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const config = getCurrencyConfig(currencyCode);
    const isZeroDecimal = config.decimals === 0;

    const thousandSep = isZeroDecimal ? "." : ",";
    const decimalSep = isZeroDecimal ? "" : ".";

    const formatFromNumber = useCallback(
      (numVal: number | string): string => {
        const num = typeof numVal === "string" ? Number(numVal) : numVal;
        if (Number.isNaN(num) || num === null || num === undefined || num === 0) {
          return "";
        }

        if (isZeroDecimal) {
          const rounded = Math.round(Math.abs(num));
          return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
        }

        const fixed = Math.abs(num).toFixed(config.decimals);
        const [intPart, decPart] = fixed.split(".");
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
        return `${formattedInt}${decimalSep}${decPart}`;
      },
      [isZeroDecimal, config.decimals, thousandSep, decimalSep],
    );

    const [displayValue, setDisplayValue] = useState(() => formatFromNumber(value));

    useEffect(() => {
      const currentNumeric = Number(
        displayValue.replace(new RegExp(`\\${thousandSep}`, "g"), "").replace(decimalSep, "."),
      );
      const incomingNumeric = Number(value);

      if (Math.abs((currentNumeric || 0) - (incomingNumeric || 0)) > 0.0001) {
        setDisplayValue(formatFromNumber(value));
      }
    }, [value, formatFromNumber, displayValue, thousandSep, decimalSep]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const rawText = input.value;
      const cursorPos = input.selectionStart ?? 0;

      if (!rawText.trim()) {
        setDisplayValue("");
        onChange?.(0);
        return;
      }

      if (isZeroDecimal) {
        const digits = rawText.replace(/\D/g, "");
        const formatted = digits
          ? digits.replace(/^0+/, "").replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep)
          : "";

        setDisplayValue(formatted);
        const numericVal = digits ? Number(digits) : 0;
        onChange?.(numericVal);
        return;
      }

      const normalized = rawText.replace(/,/g, ".");
      const allowedRegex = /[^0-9.]/g;
      const sanitized = normalized.replace(allowedRegex, "");

      const parts = sanitized.split(".");
      const intRaw = parts[0].replace(/^0+(?=\d)/, "");
      let decRaw: string | null = null;

      if (parts.length > 1) {
        decRaw = parts.slice(1).join("").slice(0, config.decimals);
      }

      const formatted = formatWithSeparators(
        intRaw,
        decRaw,
        thousandSep,
        decimalSep,
      );

      setDisplayValue(formatted);

      const parsedNumberStr = decRaw !== null ? `${intRaw || "0"}.${decRaw}` : intRaw || "0";
      const numericVal = Number(parsedNumberStr) || 0;
      onChange?.(numericVal);

      requestAnimationFrame(() => {
        if (!inputRef.current) return;
        const newPos = Math.min(cursorPos, formatted.length);
        inputRef.current.setSelectionRange(newPos, newPos);
      });
    };

    const prefixWidthClass =
      config.symbol.length > 2
        ? "pl-11"
        : config.symbol.length === 2
          ? "pl-9"
          : "pl-7";

    return (
      <div className="relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <span className="select-none text-xs font-semibold text-muted-foreground">
            {config.symbol}
          </span>
        </div>
        <Input
          ref={inputRef}
          type="text"
          inputMode={isZeroDecimal ? "numeric" : "decimal"}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          className={cn(prefixWidthClass, "font-medium tabular-nums text-sm", className)}
          {...props}
        />
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";
