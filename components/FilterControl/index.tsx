"use client";

import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type {
  DateRangeValue,
  FilterDimension,
  FilterValue,
} from "@/types/filters";

type FilterControlProps = {
  dimension: FilterDimension;
  value: FilterValue | undefined;
  onChange: (value: FilterValue) => void;
};

function parseDate(value: string | null | undefined): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function formatDateForState(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function DatePicker({
  value,
  placeholder,
  onChange,
}: {
  value: string | null;
  placeholder: string;
  onChange: (value: string | null) => void;
}) {
  const selectedDate = parseDate(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal">
          <CalendarIcon className="mr-2 size-4" />

          {selectedDate ? formatDateForDisplay(selectedDate) : placeholder}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) =>
            onChange(date ? formatDateForState(date) : null)
          }
        />
      </PopoverContent>
    </Popover>
  );
}

export function FilterControl({
  dimension,
  value,
  onChange,
}: FilterControlProps) {
  const renderControl = () => {
    switch (dimension.type) {
      case "string":
        return (
          <Input
            type="text"
            placeholder={dimension.label}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || null)}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={typeof value === "number" || typeof value === "string" ? value : ""}
            onChange={(event) => {
              const inputValue = event.target.value;
              onChange(inputValue === "" ? null : Number(inputValue));
            }}
          />
        );

      case "dateString":
        return (
          <DatePicker
            value={typeof value === "string" ? value : null}
            placeholder="Select date"
            onChange={onChange}
          />
        );

      case "dateRange": {
        const range: DateRangeValue =
          value && typeof value === "object"
            ? value
            : { from: null, to: null };

        return (
          <div className="flex gap-2">
            <DatePicker
              value={range.from}
              placeholder="From"
              onChange={(from) => onChange({ from, to: range.to })}
            />

            <DatePicker
              value={range.to}
              placeholder="To"
              onChange={(to) => onChange({ from: range.from, to })}
            />
          </div>
        );
      }

      case "select":
        return (
          <select
            className={cn(
              "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 py-0.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30",
            )}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || null)}>
            <option value="">Alle</option>

            {dimension.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-w-60 flex-col gap-2">
      <Label>{dimension.label}</Label>

      {renderControl()}
    </div>
  );
}
