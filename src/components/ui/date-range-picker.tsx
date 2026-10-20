"use client";

import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronUp } from "lucide-react";
import React, { type FC, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { DateInput } from "./date-input";

export interface DateRange {
  from: Date;
  to: Date | undefined;
}

export interface DateRangePickerProps {
  /** Click handler for applying the updates from DateRangePicker */
  onUpdate?: (values: { range: DateRange; rangeCompare?: DateRange }) => void;
  /** Initial value for start date */
  initialDateFrom?: Date | string;
  /** Initial value for end date */
  initialDateTo?: Date | string;
  /** Initial value for start date for compare */
  initialCompareFrom?: Date | string;
  /** Initial value for end date for compare */
  initialCompareTo?: Date | string;
  /** Alignment of popover */
  align?: "start" | "center" | "end";
  /** Option for locale format */
  locale?: string;
  /** Option for showing compare feature */
  showCompare?: boolean;
  className?: string;
}

interface Preset {
  name: string;
  label: string;
}

const PRESETS: Preset[] = [
  { name: "today", label: "Today" },
  { name: "yesterday", label: "Yesterday" },
  { name: "last7", label: "Last 7 days" },
  { name: "last14", label: "Last 14 days" },
  { name: "last30", label: "Last 30 days" },
  { name: "thisWeek", label: "This Week" },
  { name: "lastWeek", label: "Last Week" },
  { name: "thisMonth", label: "This Month" },
  { name: "lastMonth", label: "Last Month" },
];

const formatDateStr = (date: Date): string => {
  return format(date, "MMM dd, yyyy");
};

const getPresetRange = (presetName: string): DateRange => {
  const now = new Date();

  switch (presetName) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "last14":
      return { from: startOfDay(subDays(now, 13)), to: endOfDay(now) };
    case "last30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "thisWeek":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "lastWeek": {
      const lastWeek = subDays(now, 7);
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      };
    }
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "lastMonth": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
};

const areRangesEqual = (a?: DateRange, b?: DateRange): boolean => {
  if (!a || !b) return a === b;
  return (
    a.from.getTime() === b.from.getTime() &&
    (!a.to || !b.to || a.to.getTime() === b.to.getTime())
  );
};

export const DateRangePicker: FC<DateRangePickerProps> = ({
  initialDateFrom = startOfMonth(new Date()),
  initialDateTo = endOfMonth(new Date()),
  initialCompareFrom,
  initialCompareTo,
  onUpdate,
  align = "end",
  showCompare = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const [range, setRange] = useState<DateRange>({
    from: new Date(initialDateFrom),
    to: initialDateTo ? new Date(initialDateTo) : new Date(initialDateFrom),
  });

  const [rangeCompare, setRangeCompare] = useState<DateRange | undefined>(
    initialCompareFrom
      ? {
          from: new Date(initialCompareFrom),
          to: initialCompareTo
            ? new Date(initialCompareTo)
            : new Date(initialCompareFrom),
        }
      : undefined,
  );

  const openedRangeRef = useRef<DateRange>({
    from: new Date(initialDateFrom),
    to: initialDateTo ? new Date(initialDateTo) : new Date(initialDateFrom),
  });
  const openedRangeCompareRef = useRef<DateRange | undefined>(
    initialCompareFrom
      ? {
          from: new Date(initialCompareFrom),
          to: initialCompareTo
            ? new Date(initialCompareTo)
            : new Date(initialCompareFrom),
        }
      : undefined,
  );
  const isApplyingRef = useRef(false);

  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(
    "thisMonth",
  );
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const setPreset = (preset: string) => {
    const newRange = getPresetRange(preset);
    setRange(newRange);
    setSelectedPreset(preset);

    if (rangeCompare) {
      setRangeCompare({
        from: subMonths(newRange.from, 12),
        to: newRange.to ? subMonths(newRange.to, 12) : undefined,
      });
    }
  };

  const handleCancel = () => {
    if (openedRangeRef.current) {
      setRange(openedRangeRef.current);
    }
    if (openedRangeCompareRef.current) {
      setRangeCompare(openedRangeCompareRef.current);
    }
    setIsOpen(false);
  };

  const handleApply = () => {
    isApplyingRef.current = true;
    const finalFrom = startOfDay(range.from);
    const finalTo = range.to ? endOfDay(range.to) : endOfDay(range.from);
    const appliedRange = { from: finalFrom, to: finalTo };

    setRange(appliedRange);
    openedRangeRef.current = appliedRange;
    openedRangeCompareRef.current = rangeCompare;
    setIsOpen(false);

    onUpdate?.({ range: appliedRange, rangeCompare });
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (open) {
          openedRangeRef.current = { ...range };
          openedRangeCompareRef.current = rangeCompare
            ? { ...rangeCompare }
            : undefined;
        } else if (!isApplyingRef.current) {
          if (openedRangeRef.current) {
            setRange(openedRangeRef.current);
          }
          if (openedRangeCompareRef.current) {
            setRangeCompare(openedRangeCompareRef.current);
          }
        }
        isApplyingRef.current = false;
        setIsOpen(open);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 w-full sm:w-auto justify-between sm:justify-start gap-2 border-input bg-background px-2.5 text-xs font-normal shadow-2xs hover:bg-muted/50",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="size-3.5 text-muted-foreground" />
        <span className="tabular-nums">
          {formatDateStr(range.from)}
          {range.to ? ` - ${formatDateStr(range.to)}` : ""}
        </span>
        {isOpen ? (
          <ChevronUp className="size-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3 text-muted-foreground" />
        )}
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className="w-auto p-3"
      >
        <div className="flex flex-col gap-3">
          {/* Header Controls: DateInputs, Compare Switch */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <DateInput
                value={range.from}
                onChange={(date) => {
                  const toDate = range.to && date > range.to ? date : range.to;
                  setRange({ from: date, to: toDate });
                  setSelectedPreset(undefined);
                }}
              />
              <span className="text-xs text-muted-foreground font-medium">to</span>
              <DateInput
                value={range.to}
                onChange={(date) => {
                  const fromDate = date < range.from ? date : range.from;
                  setRange({ from: fromDate, to: date });
                  setSelectedPreset(undefined);
                }}
              />
            </div>

            {showCompare && (
              <div className="flex items-center gap-2">
                <Switch
                  id="compare-mode"
                  size="sm"
                  checked={Boolean(rangeCompare)}
                  onCheckedChange={(checked: boolean) => {
                    if (checked) {
                      setRangeCompare({
                        from: subMonths(range.from, 12),
                        to: range.to ? subMonths(range.to, 12) : undefined,
                      });
                    } else {
                      setRangeCompare(undefined);
                    }
                  }}
                />
                <Label htmlFor="compare-mode" className="text-xs">
                  Compare
                </Label>
              </div>
            )}
          </div>

          {/* Body: Presets + Calendar */}
          <div className="flex flex-col gap-3 md:flex-row">
            {/* Presets dropdown for mobile, sidebar buttons for desktop */}
            {isSmallScreen ? (
              <Select
                value={selectedPreset}
                onValueChange={(val) => {
                  if (val) setPreset(val);
                }}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Quick Presets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex flex-col gap-0.5 border-r pr-3">
                {PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setPreset(preset.name)}
                      className={cn(
                        "flex items-center justify-between rounded-md px-2.5 py-1 text-left text-xs transition-colors hover:bg-muted",
                        isSelected
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      <span>{preset.label}</span>
                      {isSelected && (
                        <Check className="ml-2 size-3 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Calendar */}
            <div className="overflow-hidden">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(val) => {
                  if (val?.from) {
                    setRange({ from: val.from, to: val.to });
                    setSelectedPreset(undefined);
                  }
                }}
                numberOfMonths={isSmallScreen ? 1 : 2}
                defaultMonth={range.from}
              />
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleApply}
            >
              Apply Range
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

DateRangePicker.displayName = "DateRangePicker";
