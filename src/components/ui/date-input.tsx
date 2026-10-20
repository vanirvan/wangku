"use client";

import React, { useEffect, useRef } from "react";

interface DateInputProps {
  value?: Date;
  onChange: (date: Date) => void;
}

interface DateParts {
  day: number;
  month: number;
  year: number;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange }) => {
  const [date, setDate] = React.useState<DateParts>(() => {
    const d = value ? new Date(value) : new Date();
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
  });

  const monthRef = useRef<HTMLInputElement | null>(null);
  const dayRef = useRef<HTMLInputElement | null>(null);
  const yearRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const d = value ? new Date(value) : new Date();
    setDate({
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    });
  }, [value]);

  const validateDate = (field: keyof DateParts, val: number): boolean => {
    if (
      (field === "day" && (val < 1 || val > 31)) ||
      (field === "month" && (val < 1 || val > 12)) ||
      (field === "year" && (val < 1000 || val > 9999))
    ) {
      return false;
    }

    const newDate = { ...date, [field]: val };
    const d = new Date(newDate.year, newDate.month - 1, newDate.day);
    return (
      d.getFullYear() === newDate.year &&
      d.getMonth() + 1 === newDate.month &&
      d.getDate() === newDate.day
    );
  };

  const handleInputChange =
    (field: keyof DateParts) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const num = raw ? Number(raw) : 0;
      const isValid = !Number.isNaN(num) && validateDate(field, num);

      const newDate = { ...date, [field]: num };
      setDate(newDate);

      if (isValid) {
        onChange(new Date(newDate.year, newDate.month - 1, newDate.day));
      }
    };

  const initialDate = useRef<DateParts>(date);

  const handleBlur =
    (field: keyof DateParts) => (e: React.FocusEvent<HTMLInputElement>) => {
      if (!e.target.value) {
        setDate(initialDate.current);
        return;
      }

      const num = Number(e.target.value);
      const isValid = validateDate(field, num);

      if (!isValid) {
        setDate(initialDate.current);
      } else {
        initialDate.current = { ...date, [field]: num };
      }
    };

  const handleKeyDown =
    (field: keyof DateParts) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.metaKey || e.ctrlKey) return;

      if (
        !/^[0-9]$/.test(e.key) &&
        ![
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Delete",
          "Tab",
          "Backspace",
          "Enter",
        ].includes(e.key)
      ) {
        e.preventDefault();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const newDate = { ...date };

        if (field === "day") {
          const maxDays = new Date(date.year, date.month, 0).getDate();
          if (date[field] === maxDays) {
            newDate.day = 1;
            newDate.month = (date.month % 12) + 1;
            if (newDate.month === 1) newDate.year += 1;
          } else {
            newDate.day += 1;
          }
        }

        if (field === "month") {
          if (date[field] === 12) {
            newDate.month = 1;
            newDate.year += 1;
          } else {
            newDate.month += 1;
          }
        }

        if (field === "year") {
          newDate.year += 1;
        }

        setDate(newDate);
        onChange(new Date(newDate.year, newDate.month - 1, newDate.day));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const newDate = { ...date };

        if (field === "day") {
          if (date[field] === 1) {
            newDate.month -= 1;
            if (newDate.month === 0) {
              newDate.month = 12;
              newDate.year -= 1;
            }
            newDate.day = new Date(newDate.year, newDate.month, 0).getDate();
          } else {
            newDate.day -= 1;
          }
        }

        if (field === "month") {
          if (date[field] === 1) {
            newDate.month = 12;
            newDate.year -= 1;
          } else {
            newDate.month -= 1;
          }
        }

        if (field === "year") {
          newDate.year -= 1;
        }

        setDate(newDate);
        onChange(new Date(newDate.year, newDate.month - 1, newDate.day));
      }

      if (e.key === "ArrowRight") {
        if (
          e.currentTarget.selectionStart === e.currentTarget.value.length ||
          (e.currentTarget.selectionStart === 0 &&
            e.currentTarget.selectionEnd === e.currentTarget.value.length)
        ) {
          e.preventDefault();
          if (field === "month") dayRef.current?.focus();
          if (field === "day") yearRef.current?.focus();
        }
      } else if (e.key === "ArrowLeft") {
        if (
          e.currentTarget.selectionStart === 0 ||
          (e.currentTarget.selectionStart === 0 &&
            e.currentTarget.selectionEnd === e.currentTarget.value.length)
        ) {
          e.preventDefault();
          if (field === "day") monthRef.current?.focus();
          if (field === "year") dayRef.current?.focus();
        }
      }
    };

  return (
    <div className="flex items-center rounded-lg border bg-background px-1.5 py-1 text-sm shadow-2xs">
      <input
        type="text"
        ref={monthRef}
        maxLength={2}
        value={String(date.month).padStart(2, "0")}
        onChange={handleInputChange("month")}
        onKeyDown={handleKeyDown("month")}
        onFocus={(e) => e.target.select()}
        onBlur={handleBlur("month")}
        className="w-6 border-none bg-transparent p-0 text-center font-mono text-xs outline-none focus:text-primary"
        placeholder="MM"
      />
      <span className="text-muted-foreground/40 text-xs">/</span>
      <input
        type="text"
        ref={dayRef}
        maxLength={2}
        value={String(date.day).padStart(2, "0")}
        onChange={handleInputChange("day")}
        onKeyDown={handleKeyDown("day")}
        onFocus={(e) => e.target.select()}
        onBlur={handleBlur("day")}
        className="w-6 border-none bg-transparent p-0 text-center font-mono text-xs outline-none focus:text-primary"
        placeholder="DD"
      />
      <span className="text-muted-foreground/40 text-xs">/</span>
      <input
        type="text"
        ref={yearRef}
        maxLength={4}
        value={String(date.year)}
        onChange={handleInputChange("year")}
        onKeyDown={handleKeyDown("year")}
        onFocus={(e) => e.target.select()}
        onBlur={handleBlur("year")}
        className="w-10 border-none bg-transparent p-0 text-center font-mono text-xs outline-none focus:text-primary"
        placeholder="YYYY"
      />
    </div>
  );
};

DateInput.displayName = "DateInput";
