"use client";

import { CalendarIcon, CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFilterOptions } from "@/hooks/useFilterOptions";
import { cn } from "@/lib/utils";

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

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[] | null) => void;
}) {
  const selectedSet = new Set(value);

  const toggle = (optionValue: string) => {
    const next = new Set(selectedSet);

    if (next.has(optionValue)) {
      next.delete(optionValue);
    } else {
      next.add(optionValue);
    }

    const nextArray = options
      .map((option) => option.value)
      .filter((optionValue) => next.has(optionValue));

    onChange(nextArray.length ? nextArray : null);
  };

  const selectedLabels = options
    .filter((option) => selectedSet.has(option.value))
    .map((option) => option.label);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal">
          <span className="flex min-w-0 items-center gap-1">
            {selectedLabels.length === 0 ? (
              <span className="text-muted-foreground">{label}</span>
            ) : selectedLabels.length <= 2 ? (
              selectedLabels.map((selectedLabel) => (
                <Badge
                  key={selectedLabel}
                  variant="secondary"
                  className="max-w-32 truncate">
                  {selectedLabel}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">
                {selectedLabels.length} ausgewählt
              </Badge>
            )}
          </span>

          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`${label} suchen…`} />

          <CommandList>
            <CommandEmpty>Keine Einträge gefunden.</CommandEmpty>

            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggle(option.value)}>
                    <CheckIcon
                      className={cn(
                        "size-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />

                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>

          {selectedLabels.length > 0 ? (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={() => onChange(null)}>
                Auswahl löschen
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function FilterControl({
  dimension,
  value,
  onChange,
}: FilterControlProps) {
  const options = useFilterOptions(dimension);

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
          value && typeof value === "object" && !Array.isArray(value)
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

            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "multiselect":
        return (
          <MultiSelect
            label={dimension.label}
            options={options}
            value={Array.isArray(value) ? value : []}
            onChange={onChange}
          />
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
