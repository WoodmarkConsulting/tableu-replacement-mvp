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

import type { ChartFiltersState } from "@/hooks/useChartState";

type SetFilterCallback = (
  currentFilters: ChartFiltersState,
) => ChartFiltersState;

type ChartFiltersProps = {
  filterConfig: FilterConfig[];
  filters: ChartFiltersState;
  setFilter: (callback: SetFilterCallback) => ChartFiltersState;
};

function parseDate(value: string | number | null): Date | undefined {
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
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const ChartFilters = ({
  filterConfig,
  filters,
  setFilter,
}: ChartFiltersProps) => {
  const updateFilter = (key: string, value: string | number | null) => {
    setFilter((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  };

  const renderFilter = (filter: FilterConfig) => {
    const value = filters[filter.key];

    switch (filter.type) {
      case "dateString": {
        const selectedDate = parseDate(value);

        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-60 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 size-4" />

                {selectedDate
                  ? formatDateForDisplay(selectedDate)
                  : (filter.label ?? "Select date")}
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  updateFilter(
                    filter.key,
                    date ? formatDateForState(date) : null,
                  );
                }}
              />
            </PopoverContent>
          </Popover>
        );
      }

      case "number":
        return (
          <Input
            type="number"
            value={
              typeof value === "number" || typeof value === "string"
                ? value
                : ""
            }
            onChange={(event) => {
              const inputValue = event.target.value;

              updateFilter(
                filter.key,
                inputValue === "" ? null : Number(inputValue),
              );
            }}
          />
        );

      case "string":
        return (
          <Input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => {
              updateFilter(filter.key, event.target.value || null);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap gap-4">
      {filterConfig.map((filter) => (
        <div key={filter.key} className="flex min-w-60 flex-col gap-2">
          <Label>{filter.label ?? filter.key}</Label>

          {renderFilter(filter)}
        </div>
      ))}
    </div>
  );
};

export default ChartFilters;
