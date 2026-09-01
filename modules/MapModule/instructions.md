# `MapModule` Instructions

## 1. Purpose

`MapModule` renders a geo map with region choropleth styling and optional bubble overlays for latitude/longitude points.

Use this module when you need to show values by country, region, or market footprint across a map-based surface. It is appropriate for choropleth-style comparisons, geographic distribution summaries, and dashboards where a regional or location-based view is more informative than a standard table or chart.

Do not use this module for heatmap density overlays, tile-based basemaps, or click-through drill-down navigation. Those behaviors are intentionally outside the current module scope.

The map is rendered with `@visx/geo` (projections and geography paths) and `@visx/zoom` (pan/zoom). Geography features come from `world-atlas` TopoJSON converted with `topojson-client`. Choropleth coloring and bubble sizing use `d3-scale`, ISO matching uses `i18n-iso-countries`, and region label placement uses `d3-geo` `geoCentroid`.

---

## 2. Module Files

The module consists of the following required files:

```text
modules/MapModule/
├── index.tsx
├── chartDataSchema.ts
├── chartType.d.ts
└── instructions.md
```

### `index.tsx`

Contains the map renderer implementation.

The file must have a default export.

### `chartDataSchema.ts`

Defines the data contract for region and point records.

The file must have a default export.

### `chartType.d.ts`

Contains the configuration object for the map.

The file must contain exactly one type declaration.

### `instructions.md`

Contains the usage instructions for this module.

---

## 3. Data Contract

### Data Type

```ts
MapChartData =
  | { kind: "region"; regionCode: string; value: number; label?: string }
  | { kind: "point"; lat: number; lng: number; value: number; label?: string };
```

### Data Structure

#### `kind`

Type:

```ts
"region" | "point";
```

Description:

Indicates whether the row represents a geopolitical region or a geographic point.

Rules:

- `kind: "region"` rows must include `regionCode` and `value`.
- `kind: "point"` rows must include `lat`, `lng`, and `value`.

#### `regionCode`

Type:

```ts
string;
```

Description:

Two-letter ISO alpha-2 country code used to match a geography feature.

Rules:

- Must be a valid alpha-2 code such as `US`, `FR`, or `JP`.
- Values are matched against the map geography dataset using numeric ISO-3 lookup plus alpha-2 conversion.

#### `lat`

Type:

```ts
number;
```

Description:

Latitude for a map point marker.

Rules:

- Must be between `-90` and `90`.

#### `lng`

Type:

```ts
number;
```

Description:

Longitude for a map point marker.

Rules:

- Must be between `-180` and `180`.

#### `value`

Type:

```ts
number;
```

Description:

The metric used for choropleth coloring or bubble sizing.

Rules:

- Must be a finite number.
- Should reflect the measure being shown in the current dashboard filter context.

#### `label`

Type:

```ts
string | undefined;
```

Description:

Optional text used in the tooltip label.

Rules:

- If omitted, the region code or location label is used as a fallback.

### Example API Response

```json
[
  { "kind": "region", "regionCode": "US", "value": 82, "label": "United States" },
  { "kind": "region", "regionCode": "FR", "value": 64, "label": "France" },
  { "kind": "point", "lat": 47.6062, "lng": -122.3321, "value": 14, "label": "Seattle" },
  { "kind": "point", "lat": 51.5074, "lng": -0.1278, "value": 19, "label": "London" }
]
```

### Data Rules

- `regionCode` must use ISO alpha-2 codes.
- `lat` and `lng` must remain within the valid coordinate ranges.
- `value` must always be present and finite.
- Region rows and point rows can be mixed in the same response.
- Each record may optionally provide a human-readable `label` for tooltip display.
- Region `label`, when present, is used as the tooltip and accessibility title for that region; otherwise the ISO code or geography name is used.
- Multiple region rows that share the same `regionCode` are aggregated by summing their `value`; the first non-empty `label` is retained.

---

## 4. Configuration

The module is controlled through its configuration object.

The complete configuration type is defined in:

```text
chartType.d.ts
```

### Configuration Type

```ts
type MapChartConfig = {
  projection: {
    type: "geoEqualEarth" | "geoMercator" | "geoNaturalEarth1" | "geoOrthographic";
    center: [number, number];
    scale: number;
  };
  zoom: {
    enabled: boolean;
    min: number;
    max: number;
    initial: number;
  };
  geography: {
    url?: string;
    stroke: string;
    strokeWidth: number;
    defaultFill: string;
  };
  choropleth: {
    enabled: boolean;
    colorScale: {
      type: "gradient" | "buckets";
      gradient?: { minColor: string; maxColor: string };
      buckets?: { threshold: number; color: string }[];
    };
    noDataColor: string;
  };
  bubbles: {
    enabled: boolean;
    radius: { min: number; max: number };
    color: {
      mode: "fixed" | "value";
      fixedColor?: string;
      gradient?: { minColor: string; maxColor: string };
    };
    stroke: string;
    strokeWidth: number;
    opacity: number;
  };
  tooltip: { show: boolean };
  regionLabels: {
    show: boolean;
    color: string;
    fontSize: number;
    fontWeight?: number | string;
  };
  legend: {
    show: boolean;
    position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  };
};
```

---

## 5. Configuration Reference

### `projection`

Description of the map projection used by the `@visx/geo` renderer.

#### `projection.type`

Type:

```ts
"geoEqualEarth" | "geoMercator" | "geoNaturalEarth1" | "geoOrthographic";
```

Required:

`yes`

Description:

Controls the geographic projection used for the map.

#### `projection.center`

Type:

```ts
[number, number];
```

Required:

`yes`

Description:

Centers the projection on the configured longitude/latitude pair.

#### `projection.scale`

Type:

```ts
number;
```

Required:

`yes`

Description:

Sets the map scale.

### `zoom`

Description of the zoom controls.

#### `zoom.enabled`

Type:

```ts
boolean;
```

Required:

`yes`

Description:

Enables zoom and pan behavior for the map.

#### `zoom.min` / `zoom.max` / `zoom.initial`

Type:

```ts
number;
```

Required:

`yes`

Description:

Defines the min, max, and initial zoom levels.

### `geography`

Description of the source geometry and styling.

#### `geography.url`

Type:

```ts
string | undefined;
```

Required:

`no`

Description:

Optional override for the geography TopoJSON source.

#### `geography.stroke` and `geography.strokeWidth`

Type:

```ts
string;
number;
```

Required:

`yes`

Description:

Controls region borders and their width.

#### `geography.defaultFill`

Type:

```ts
string;
```

Required:

`yes`

Description:

Fallback fill when a region has no value.

### `choropleth`

Description of the value-to-color mapping for region data.

#### `choropleth.enabled`

Type:

```ts
boolean;
```

Required:

`yes`

Description:

Turns the choropleth fill behavior on or off.

#### `choropleth.colorScale.type`

Type:

```ts
"gradient" | "buckets";
```

Required:

`yes`

Description:

Sets how region values are mapped to colors.

#### `choropleth.noDataColor`

Type:

```ts
string;
```

Required:

`yes`

Description:

Color used only when a region has no matching data row. When the color scale is `buckets`, values below the smallest threshold are painted with the first bucket's color, not `noDataColor`, so genuine low values stay distinguishable from missing data.

### `bubbles`

Description of the point bubble overlay.

#### `bubbles.enabled`

Type:

```ts
boolean;
```

Required:

`yes`

Description:

Turns marker bubbles on or off.

#### `bubbles.radius`

Type:

```ts
{ min: number; max: number };
```

Required:

`yes`

Description:

Defines the minimum and maximum bubble radii.

#### `bubbles.color`

Type:

```ts
{ mode: "fixed" | "value"; fixedColor?: string; gradient?: { minColor: string; maxColor: string } };
```

Required:

`yes`

Description:

Controls bubble color behavior.

#### `bubbles.stroke` and `bubbles.strokeWidth`

Type:

```ts
string;
number;
```

Required:

`yes`

Description:

Styles bubble borders.

#### `bubbles.opacity`

Type:

```ts
number;
```

Required:

`yes`

Description:

Sets bubble opacity, typically in the `0..1` range.

### `tooltip`

#### `tooltip.show`

Type:

```ts
boolean;
```

Required:

`yes`

Description:

Controls whether tooltips are rendered for hovered regions and markers.

### `regionLabels`

Description of the numeric value labels drawn on top of each region.

#### `regionLabels.show`

Type:

```ts
boolean;
```

Required:

`yes`

Description:

Controls whether a region's value is drawn as a text label at the region centroid. Labels are only rendered for regions that have a matching data row.

#### `regionLabels.color`

Type:

```ts
string;
```

Required:

`yes`

Description:

Fill color of the region value labels.

#### `regionLabels.fontSize`

Type:

```ts
number;
```

Required:

`yes`

Description:

Font size of the region value labels, in pixels.

#### `regionLabels.fontWeight`

Type:

```ts
number | string | undefined;
```

Required:

`no`

Description:

Optional font weight of the region value labels (for example `600` or `"bold"`).

### `legend`

#### `legend.show`

Type:

```ts
boolean;
```

Required:

`yes`

Description:

Controls whether the map legend is displayed.

#### `legend.position`

Type:

```ts
"bottom-left" | "bottom-right" | "top-left" | "top-right";
```

Required:

`yes`

Description:

Places the legend in a fixed corner of the map container.

---

## 6. Configuration Rules

- The API data contract combines both region and point rows in a single array.
- Region matching relies on ISO alpha-2 codes and a valid country dataset.
- Bubble sizing is based on the `value` field and uses a square-root scale.
- `choropleth.colorScale.type` must match the configured color mapping shape.
- For `choropleth.colorScale.type: "buckets"`, each bucket's `color` applies to values greater than or equal to its `threshold`; the first bucket's color also applies to any value below the smallest threshold. `choropleth.noDataColor` is used only for regions without a data row.
- `bubbles.color.mode: "value"` requires a valid value-driven gradient range.
- `bubbles.color.mode: "fixed"` uses `fixedColor` when present.
- `legend.show` is independent from `tooltip.show`, but they are often used together.
- `geography.url` is optional and should be used only to override the default bundled world map source.

---

## 7. Notes

This module expects the API to resolve the map data into a flat array of records. The chart wrapper validates the array using the Zod schema defined in `chartDataSchema.ts`.

The default source geography is the bundled countries TopoJSON shipped with `world-atlas`, which keeps the module self-contained and avoids a tile basemap or API key requirement.
