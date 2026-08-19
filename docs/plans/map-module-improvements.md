# MapModule improvements plan

This plan captures the review findings against `docs/plans/map-module-plan.md` and the current working-tree changes. The four `MapModule/` files exist, the registry regenerated, and `npm run lint`, `npm run module:validate`, and `npx tsc --noEmit` all pass. The items below are about soundness, not missing artifacts.

Priority order at the bottom.

---

## 1. Type-system regressions in `components/ChartWrapper/index.tsx`

### Problem

The wrapper used to derive the per-module schema through the registry:

```ts
type ModuleSchema<M extends ModuleRegistryKeys> =
  (typeof moduleRegistry)[M]["dataSchema"];
```

The agent widened it to `z.ZodTypeAny` and now discards the return type of `fetchChartData` with `as DataType[]`. The module data type is no longer connected to the module name, so the registry no longer gives us any type guarantees.

Additionally, this line inside `ChartWrapper`:

```ts
type ModuleChartData<M extends ModuleRegistryKeys> =
  z.infer<ModuleSchema<M>> & Record<string, unknown>;
```

silently strips discriminated-union narrowing (`MapChartData` is a discriminated union and does not extend `Record<string, unknown>`).

### Fix

- Restore the indexed access:

  ```ts
  type ModuleSchema<M extends ModuleRegistryKeys> =
    (typeof moduleRegistry)[M]["dataSchema"];
  ```

- Remove the `& Record<string, unknown>` intersection.
- Relax the `ChartDataTemplate` constraint on `ChartWrapperInjectedProps<D>` in `types/baseChart.d.ts` so a discriminated union like `MapChartData` satisfies it. Either:
  - drop the constraint entirely (`D`, no `extends`), or
  - use `D extends object`.
- Drop the `as DataType[]` cast in `queryFn`.

---

## 2. `chartConfig` is a union — casts in every module

### Problem

`BaseChartProps.chartConfig: ChartConfigs` is `LineChartConfig | MapChartConfig`. Because of that, every module now has to unsound-cast the config:

- `modules/LineChartModule/index.tsx` — `const config = chartConfig as LineChartConfig;`
- `modules/MapModule/index.tsx` — `const config = chartConfig as MapChartConfig;`

This is a design leak: the module knows exactly which config it wants, but the type system was widened so far that both modules launder a cast.

### Fix

Make the base props generic over the config type:

```ts
export type BaseChartProps<C extends ChartConfigs = ChartConfigs> = {
  chartTitle?: string;
  chartDescription: string;
  chartID: string;
  filterConfig: FilterConfig[];
  chartConfig: C;
};

export interface ChartWrapperInjectedProps<D, C extends ChartConfigs = ChartConfigs>
  extends BaseChartProps<C> {
  height: number;
  chartData: D[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
}
```

Then in each module:

```ts
type Props = ChartWrapperInjectedProps<MapChartData, MapChartConfig>;
```

The `chartConfig as XChartConfig` casts disappear from both modules.

In `ChartWrapper`, the `Module` cast can then be tightened to:

```ts
React.ComponentType<ChartWrapperInjectedProps<DataType, ChartConfigs>>
```

or a lookup keyed by `moduleName` if we want fully sound resolution.

---

## 3. MapModule correctness issues

All in `modules/MapModule/index.tsx`.

### 3.1 `noDataColor` is never used

The choropleth branch falls back to `config.geography.defaultFill` when a region has no value. The plan calls out `choropleth.noDataColor` explicitly.

Fix: when `config.choropleth.enabled` and no value is present, use `config.choropleth.noDataColor`. Keep `config.geography.defaultFill` as the fallback only when choropleth is disabled entirely.

### 3.2 Bubble radius domain is wrong

```ts
const min = Math.min(...pointValues, config.bubbles.radius.min);
const max = Math.max(...pointValues, config.bubbles.radius.max);
```

`radius.min` / `radius.max` are pixel radii, not data values. Mixing them into the scale domain distorts sizing.

Fix:

```ts
const min = Math.min(...pointValues);
const max = Math.max(...pointValues);

scaleSqrt<number, number>()
  .domain([min, max])
  .range([config.bubbles.radius.min, config.bubbles.radius.max])
  .clamp(true);
```

Guard against `pointValues.length === 0` (already partially handled) and `min === max` (return a constant radius).

### 3.3 Bucket legend is missing

`hasChoropleth = colorScale?.type === "gradient"` — the legend never renders when `type === "buckets"`, even though buckets are a first-class scale per the plan.

Fix: extend `MapLegend` to render a stepped legend when `colorScale.type === "buckets"`, using the configured `threshold` / `color` list. Include the `noDataColor` swatch when relevant.

### 3.4 `getBucketColor` fallback references gradient config

When `type === "buckets"` but the bucket list is empty, the function falls back to `colorScale.gradient?.minColor`. That mixes two scale modes.

Fix: return `config.choropleth.noDataColor` (or a documented fallback) instead of the gradient color.

### 3.5 Duplicated `<Geographies>` + `<Marker>` JSX

The map body is rendered twice, once inside `<ZoomableGroup>` and once at the top level. That is ~80 lines of duplication.

Fix: extract the map body into a single subcomponent (or a local render function) and only toggle the `<ZoomableGroup>` wrapper.

### 3.6 ISO numeric ID may not be zero-padded

```ts
const featureId = geo.id?.toString() ?? "";
const normalized = featureId ? countries.numericToAlpha2(featureId) : null;
```

`geo.id` for Afghanistan is numeric `4` → `"4"`, but `numericToAlpha2` expects `"004"`.

Fix: `featureId.padStart(3, "0")` before the lookup.

### 3.7 Dead className on the legend gradient

```tsx
<div
  className="h-2 w-28 rounded-full bg-gradient-to-r from-[var(--color-1)] to-[var(--color-2)]"
  style={{ background: `linear-gradient(90deg, ${gradientColors[0]}, ${gradientColors[1]})`, width: 112 }}
/>
```

The Tailwind classes reference CSS vars that are never defined and are then overridden by the inline `background`. Also, `w-28` and `width: 112` fight each other.

Fix: keep either the inline gradient or the Tailwind classes, not both. Drop the `--color-1` / `--color-2` references entirely.

### 3.8 Unnecessary casts around the bundled geography

```ts
const defaultGeography = worldAtlas as unknown as object;
...
const geometrySource = config.geography.url
  ? config.geography.url
  : (defaultGeography as string | object);
```

The shim in `types/react-simple-maps.d.ts` types `Geographies.geography` as `unknown`. All these casts are noise.

Fix: `const geometrySource = config.geography.url ?? worldAtlas;` and pass through as-is.

### 3.9 Optional: reuse the point-row memo for the bubbles pass

`chartData.filter(kind === "point")` is done twice inline for bubble rendering. `pointValues` already exists; add a matching `pointRows` memo and iterate over that.

---

## 4. Out-of-scope edits worth keeping

- `scripts/utils.ts` import fix from `@/pagesConfig` → `@/types/pagesConfig`, plus making `PagesConfig` a named export in `types/pagesConfig.d.ts`. Real bugfix.
- `package.json` `"lint"` script fix `modules:validate` → `module:validate`. Matches the actual script name.
- Adding `types/react-simple-maps.d.ts` shim is legitimate — the package ships no types. Shim is minimal.

Keep these.

---

## 5. Out-of-scope edits to revert or move

### 5.1 `app/page.tsx` demo instantiation

`app/page.tsx` now hand-instantiates `LineChartModule` with:

```tsx
<LineChartModule
  ...
  chartConfig={sampleChartConfig as any}
  ...
/>
```

Problems:

- `as any` cast in a production route.
- Hard-coded `sampleChartConfig` and inline sample data.
- Phase 5 of the plan called for a "temporary dashboard or test page" — this is neither temporary nor isolated.

Fix: move the smoke test to `app/testPage/page.tsx` (which already exists as a test surface) or delete it. If it stays, drop the `as any` by typing `sampleChartConfig` as `LineChartConfig`.

### 5.2 Unused import in `scripts/pages/generateNextPage.ts`

`import type { PagesConfig } from "@/types/pagesConfig";` was added but is not used in the file. Drop it.

---

## 6. Docs / registry

- `modules/MapModule/instructions.md` follows the template structure but omits the `Example:` / `Allowed values:` / `Behavior:` blocks that the template uses per property (and that `LineChartModule/instructions.md` includes). Not a blocker, but the plan says "must follow the template exactly." Fill in those subsections for the properties where they add real information.
- `modules/instructions.md` update reads well. No change needed.
- Generated `modules/modulRegistry.ts` correctly adds `MapModule` and extends `ChartConfigs`. No change needed.

---

## 7. Verification after fixes

Rerun the standard gates and add a manual smoke check:

- `npm run module:validate`
- `npm run module:generateRegistry`
- `npm run lint`
- `npx tsc --noEmit`
- Manual browser check of the MapModule via a temporary dashboard entry:
  - choropleth renders with `noDataColor` on missing regions
  - both gradient and bucket legends render
  - bubble sizing scales sensibly across `radius.min`/`radius.max`
  - zoom, pan, and hover tooltip all work
  - no console warnings from `react-simple-maps`

---

## 8. Suggested priority order

1. Revert or relocate the `app/page.tsx` demo; drop the `as any`.
2. Undo the `ChartWrapper` type widening; make `BaseChartProps` / `ChartWrapperInjectedProps` generic on the config type; relax `ChartDataTemplate` so `MapChartData` fits without `& Record<string, unknown>`. Remove the `chartConfig as XChartConfig` casts from both modules.
3. MapModule correctness: use `noDataColor`, fix bubble scale domain, render a bucket legend, extract the zoom vs non-zoom branch, pad `geo.id` to length 3.
4. Cleanup: fix the legend gradient className, drop the unused `PagesConfig` import in `generateNextPage.ts`, remove unnecessary `worldAtlas` casts.
5. Optional: flesh out `Example` / `Allowed values` / `Behavior` blocks in `modules/MapModule/instructions.md`.
