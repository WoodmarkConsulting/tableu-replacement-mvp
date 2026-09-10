# `CardModule` Instructions

## 1. Purpose

`CardModule` renders a single key figure as a text label and a
formatted number.

Use this module when a dashboard needs to highlight one aggregate figure
(for example a total, an average, a count, or a ratio) with a short caption.

Do not use this module when you need to compare multiple values or show a
distribution; use `BarChartModule`, `LineChartModule`, or `TableModule`
instead. `CardModule` does not support selection, lasso, enhanced tooltips, or
outgoing connections.

---

## 2. Module Files

The module consists of the following required files:

```text
modules/CardModule/
├── index.tsx
├── chartDataSchema.ts
├── chartType.d.ts
└── instructions.md
```

### `index.tsx`

Contains the module implementation.

The file has a default export.

### `chartDataSchema.ts`

Defines and validates the data format expected from the API.

The file has a default export.

### `chartType.d.ts`

Contains the configuration type for this module.

The file contains exactly one type declaration.

### `instructions.md`

Contains the usage instructions for this module.

---

## 3. Data Contract

### Data Type

```ts
type CardData = {
  label: string;
  value: number | null;
};
```

The module reads only the first row of the returned array. Additional rows are
ignored, so the SQL should return exactly one row.

### Data Structure

#### `label`

Type:

```ts
string;
```

Description:

The caption shown above the value. Overridden by `chartConfig.label` when that
property is set.

Rules:

- Must always be present.

#### `value`

Type:

```ts
number | null;
```

Description:

The numeric figure shown on the card.

Rules:

- Must be a finite number or `null`.
- When `null`, the module renders an en dash (`–`) placeholder.

### Example API Response

```json
[{ "label": "Total Revenue", "value": 1284000 }]
```

### Data Rules

- The API must return an array; only the first element is used.
- Return exactly one row per card chart.

---

## 4. Configuration

The module is controlled through its configuration object.

The complete configuration type is defined in:

```text
chartType.d.ts
```

### Configuration Type

```ts
type CardChartConfig = {
  format: "number" | "compact" | "percent" | "currency";
  decimals?: number;
  currency?: string;
  locale?: string;
  prefix?: string;
  suffix?: string;
  label?: string;
  align?: "start" | "center" | "end";
};
```

---

## 5. Configuration Reference

### `format`

Type:

```ts
"number" | "compact" | "percent" | "currency";
```

Required:

`yes`

Description:

Controls how `value` is rendered.

Allowed values:

```text
number   -> 12.500
compact  -> 12,5 Tsd.
percent  -> value is treated as a ratio (0.45 -> 45 %)
currency -> 12.500,00 € (uses `currency` and `locale`)
```

Behavior:

- `percent` expects a ratio, so pass `0.45` to display `45 %`.
- `currency` uses `currency` for the ISO code and `locale` for formatting.

### `decimals`

Type:

```ts
number;
```

Required:

`no`

Description:

Number of fraction digits to display. Defaults to `0`.

### `currency`

Type:

```ts
string;
```

Required:

`no`

Description:

ISO 4217 currency code used when `format` is `"currency"`. Defaults to `"EUR"`.

### `locale`

Type:

```ts
string;
```

Required:

`no`

Description:

BCP 47 locale used for number formatting. Defaults to `"de-DE"`.

### `prefix`

Type:

```ts
string;
```

Required:

`no`

Description:

Text rendered immediately before the formatted value.

### `suffix`

Type:

```ts
string;
```

Required:

`no`

Description:

Text rendered immediately after the formatted value.

### `label`

Type:

```ts
string;
```

Required:

`no`

Description:

Overrides the caption from the data row. When omitted, the row's `label` is
used.

### `align`

Type:

```ts
"start" | "center" | "end";
```

Required:

`no`

Description:

Horizontal alignment of the label and value. Defaults to `"center"`.

---

## 6. Example Configuration

```json
{
  "moduleName": "CardModule",
  "chartConfig": {
    "format": "currency",
    "currency": "EUR",
    "decimals": 0,
    "label": "Total Revenue"
  }
}
```
