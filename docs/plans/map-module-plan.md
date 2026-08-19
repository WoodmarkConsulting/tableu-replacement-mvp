# MapModule plan

## Goal

Create a new module at `modules/MapModule/` that follows the same contract as `LineChartModule`:

- `index.tsx`
- `chartDataSchema.ts`
- `chartType.d.ts`
- `instructions.md`

The module should render via `react-simple-maps` using SVG/TopoJSON, without a tile basemap, and without requiring an API key. It supports:

- choropleth region coloring with either a gradient or discrete bucket scale
- value-driven bubbles/points at lat/lng coordinates
- configurable zoom and pan behavior
- hover tooltips
- map legends for both value scales and bubble sizing
- configurable geography source with a default world countries TopoJSON import

This scope explicitly defers heatmap/density overlays and click-through navigation.

---

## Decisions from the Q&A

- Library: `react-simple-maps` is the chosen map renderer.
- Geography default: use bundled world-atlas countries-110m TopoJSON, with `geography.url` available for override.
- Data region keys: ISO alpha-2 codes such as `US` and `FR`.
- TopoJSON feature IDs are numeric ISO-3 values, so the module needs numeric-to-alpha-2 conversion at render time using `i18n-iso-countries`.
- Choropleth supports both `"gradient"` and `"buckets"` scales.
- Bubble size uses a continuous square-root scale with configurable min/max radius.
- Bubble color is optional and can be fixed or value-driven.
- Size-by-value and color-by-value may be enabled simultaneously.
- The map should not support click behaviors on regions or markers; hover tooltip only.
- Legends are intentionally simple and should include min/max labels and bubble-size guidance when applicable.
- Heatmaps, marker click-through navigation, and tile basemaps are out of scope.

---

## Dependencies to add in `package.json`

Required runtime dependencies:

- `react-simple-maps`
- `world-atlas`
- `d3-scale`
- `d3-interpolate`
- `i18n-iso-countries`

Potential dev-time type dependencies if needed:

- `@types/d3-scale`
- `@types/d3-interpolate`
- `@types/react-simple-maps` if the library does not include its own types

Notes:

- `topojson-client` and `d3-geo` should be installed automatically as peer dependencies if required.
- `tsconfig.json` already has `resolveJsonModule: true`, so importing the bundled TopoJSON should work without a config change.

---

## Implementation plan

### Phase 1 — Data contract and config type

Create `modules/MapModule/chartDataSchema.ts` with a Zod discriminated union:

```ts
{ kind: "region"; regionCode: string; value: number; label?: string }
{ kind: "point"; lat: number; lng: number; value: number; label?: string }
```

Rules:

- `regionCode` must be ISO alpha-2, like `US` or `FR`
- `lat` must stay within `[-90, 90]`
- `lng` must stay within `[-180, 180]`
- `value` is the value driving color, size, or both
- `label` is optional display text for tooltip content

Export:

- default export: `mapChartDataSchema`
- named type: `MapChartData`

Create `modules/MapModule/chartType.d.ts` as a single type declaration named `MapChartConfig` covering:

```ts
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
legend: {
  show: boolean;
  position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
};
```

### Phase 2 — Component implementation

Create `modules/MapModule/index.tsx` with a default export typed as:

```ts
ChartWrapperInjectedProps<MapChartData>
```

The component should:

1. Destructure `chartConfig`, `chartData`, `height`, `loading`, and `error` from injected props.
2. Split data rows into:
   - `regionRows = chartData.filter(kind === "region")`
   - `pointRows = chartData.filter(kind === "point")`
3. Build a `Map<string, number>` for region values keyed by alpha-2 country code.
4. Build a choropleth color scale:
   - gradient mode: `d3-scale.scaleLinear()` over min/max domain with interpolated RGB output
   - bucket mode: `d3-scale.scaleThreshold()` using configured bucket thresholds/colors
5. Build a bubble radius scale using `d3-scale.scaleSqrt()`.
6. Build a value-based bubble color scale if `bubbles.color.mode === "value"` using similar gradient logic.
7. Render the map with `ComposableMap` and `ZoomableGroup` when enabled.
8. Render each geography with `Geographies` and use `geo.id` conversion from ISO numeric to alpha-2 via `i18n-iso-countries`.
9. Fill regions using the choropleth scale or the configured `noDataColor`.
10. Render point markers as `<Marker />` entries with circles sized and colored by the configured scales.
11. Keep tooltip state locally for hover events and render a small absolute-positioned overlay.
12. Render a legend inline based on the map config and bubble settings.
13. Wrap the map in a container with height handling consistent with the existing chart modules.

Additional optional extraction:

- `modules/MapModule/scales.ts` for pure scale-building utilities
- `modules/MapModule/Legend.tsx` for presentational legend rendering

These helpers are optional and not required by the module contract.

Important implementation note:

- Verify whether `i18n-iso-countries` requires a locale registration call even for numeric-alpha-2 conversion.
- If required, register the English locale at module init time before using the conversion function.

### Phase 3 — Documentation and registry

Create `modules/MapModule/instructions.md` following the project template exactly.

It should include:

- Purpose
- Module files
- Data contract
- Configuration details
- Example API response mixing region and point data
- Notes on valid ranges, defaults, and alpha-2 code requirements

Also update the root `modules/instructions.md` to add a `MapModule` entry describing:

- when to use it
- how it differs from `LineChartModule`
- why it is appropriate for region value maps and geo point overlays

Then run:

- `npm run module:validate`
- `npm run module:generateRegistry`

This should add the module to `modules/modulRegistry.ts` and include `MapChartConfig` in the generated `ChartConfigs` union.

### Phase 4 — Dependency install and config

Add dependencies to `package.json` for:

- `react-simple-maps`
- `world-atlas`
- `d3-scale`
- `d3-interpolate`
- `i18n-iso-countries`

Install them with `npm` and verify the project builds without TypeScript errors.

No `tsconfig` change should be needed because `resolveJsonModule` is already enabled.

### Phase 5 — Optional smoke test

This is not required for the module contract, but it is helpful for a manual visual check.

Add a temporary dashboard or test page entry using `moduleName: "MapModule"` and a small hardcoded or SQL-backed result set, then visually confirm:

- choropleth regions render correctly
- point bubbles appear at the correct latitude/longitude
- legends render correctly
- zoom and pan work
- hover tooltips show the label and value

---

## Relevant files

- `modules/LineChartModule/*` — structural template for the new module
- `modules/MapModule/index.tsx` — map rendering component
- `modules/MapModule/chartDataSchema.ts` — Zod schema and data type
- `modules/MapModule/chartType.d.ts` — single config type
- `modules/MapModule/instructions.md` — module documentation
- `modules/instructions.md` — module registry overview
- `modules/modulRegistry.ts` — generated registry output
- `types/baseChart.d.ts` — reusable `ChartWrapperInjectedProps` contract
- `scripts/modules/validateModules.ts` — validation contract
- `scripts/modules/generateModuleRegistry.ts` — registry generation contract
- `package.json` — new dependency installation
- `docs/instructions.template.md` — instruction template to follow

---

## Verification checklist

Successful completion requires:

- `npm run module:validate` passes
- `npm run module:generateRegistry` succeeds
- `npm run lint` passes
- TypeScript compiles without errors
- The map renders properly in a browser smoke test

Expected validation outcomes:

- four required MapModule files exist
- each file follows the required default export and module contract
- `ChartConfigs` includes `MapChartConfig`
- the generated registry includes the `MapModule` dynamic import and schema

---

## Further considerations

- `i18n-iso-countries` may require a locale registration call even for numeric-to-alpha-2 conversion depending on version.
- If the dependency is unreliable or too heavy, a small local numeric-to-alpha-2 lookup can be embedded as a fallback.
- Heatmap and density layers are deliberately deferred.
- Marker click-through navigation is intentionally deferred.

These are valid follow-up enhancements, but they are not part of the initial MapModule scope.