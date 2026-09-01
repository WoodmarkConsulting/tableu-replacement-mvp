# MapModule — Test Plan

Status: Proposed
Scope: `modules/MapModule/`
Depends on: `docs/plans/testing-strategy-plan.md` (tooling, mocks, directory layout)
Tooling: Vitest (`node` for schema/helpers, `jsdom` + React Testing Library for render)

---

## 1. What we are testing

`MapModule` renders a choropleth country map (bundled `world-atlas` TopoJSON, or a fetched
`geography.url`) with an optional bubble overlay for `lat`/`lng` points. Data is a
discriminated union of `region` and `point` rows. It is a **drill source**: clicking a
region or a bubble calls `onSelectionChange(rows)`.

Files under test:

- `modules/MapModule/chartDataSchema.ts` — `mapChartDataSchema` / `MapChartData`
- `modules/MapModule/chartType.d.ts` — `MapChartConfig`
- `modules/MapModule/index.tsx` — component + pure helpers (color/scale/map builders)

---

## 2. Test layers

| Layer | Environment | Focus |
| --- | --- | --- |
| Schema | `node` | Discriminated-union parse/reject, coordinate bounds, region-code normalization |
| Pure helpers | `node` | `getRegionValueMap`, `getColorForScale`, `getBucketColor`, `getLegendPosition` |
| Component render | `jsdom` | Region/bubble rendering, scales, tooltip, legend, geography fetch, drill |
| Contract | `node` | Module folder contract (shared guard test) |

> `getRegionValueMap`, `getColorForScale`, `getBucketColor`, and `getLegendPosition` are
> module-private today. Export them (or move to `helpers.ts`) so they can be unit-tested
> without mounting the SVG. This is the only production change this plan requires.

---

## 3. Schema tests (`chartDataSchema.test.ts`, `node`)

### Region rows
- Valid `{ kind: "region", regionCode: "de", value: 42 }` parses **and normalizes**
  `regionCode` to `"DE"` (uppercase transform).
- Optional `label` accepted.
- Rejects `regionCode` shorter/longer than 2 chars.
- Rejects non-finite `value`.

### Point rows
- Valid `{ kind: "point", lat: 52.5, lng: 13.4, value: 10 }` parses.
- Rejects `lat` outside `[-90, 90]` and `lng` outside `[-180, 180]` (boundary cases: exactly
  `-90`, `90`, `-180`, `180` accepted; `90.1`, `-180.1` rejected).
- Rejects non-finite `value`.

### Union behavior
- Unknown `kind` (e.g. `"line"`) rejected by the discriminated union.
- A row missing `kind` rejected.
- `MapChartData` type matches `z.infer` (compile-time assert via `expectTypeOf`).

## 4. Pure-helper tests (`helpers.test.ts`, `node`)

### `getRegionValueMap`
- Builds a `Map` of uppercased `regionCode → value` from region rows only.
- Skips `point` rows.
- Skips rows whose `value` is non-finite.
- Later duplicate `regionCode` overwrites the earlier value (last-wins).

### `getColorForScale`
- Returns `minColor` when `min === max` (degenerate domain).
- Returns `minColor` for non-finite input value.
- Interpolates between `minColor` and `maxColor` for a mid-domain value (assert the
  interpolated color is not equal to either endpoint).
- Clamps values below `min` / above `max` to the endpoints.

### `getBucketColor`
- Returns `noDataColor` when `colorScale.type !== "buckets"` or buckets are empty.
- Maps a value below the first threshold to `noDataColor`.
- Maps values into the correct bucket color for a threshold scale
  (e.g. thresholds `[10, 20]` → below 10 = noData, 10–19 = bucket[0], ≥20 = bucket[1]).

### `getLegendPosition`
- Each `position` (`bottom-left`, `bottom-right`, `top-left`, `top-right`) maps to the
  expected Tailwind class string; unknown/default → `top-right` classes.

## 5. Component render tests (`index.test.tsx`, `jsdom`)

The component uses `ResizeObserver`, `fetch`, and TopoJSON. Provide:

- A `ResizeObserver` polyfill/mock in the setup file (returns a non-zero container size).
- A `fetch` mock for the `geography.url` path.
- The bundled `world-atlas` import works under Vitest (JSON import); if it is heavy, mock the
  `topojson-client` `feature()` output with a tiny 2-country collection.

Tests:

- **Renders regions**: with region rows and `choropleth.enabled`, country paths render and
  matched regions receive a computed fill (not the no-data color).
- **No-data fill**: a country absent from `chartData` receives `choropleth.noDataColor`.
- **Gradient vs buckets**: `colorScale.type: "gradient"` vs `"buckets"` produce different
  fills for the same value; legend switches between gradient bar and bucket swatches.
- **Bubbles**: with `bubbles.enabled` and point rows, one bubble per point renders; radius is
  driven by the sqrt scale (larger value → larger radius); `min === max` values → all bubbles
  use `radius.max`.
- **Bubble color mode**: `color.mode: "value"` colors bubbles by the gradient; `"fixed"` uses
  `fixedColor`.
- **Legend**: `legend.show` toggles the legend; position class matches config.
- **Geography source**: when `geography.url` is set, `fetch` is called with that URL and the
  fetched TopoJSON is used; on fetch failure the component falls back gracefully (no crash,
  empty feature set).
- **Empty data**: `chartData: []` renders the base map without regions/bubbles and does not
  throw.

### Drill / selection
- `handleRegionSelect("de")` calls `onSelectionChange` with all region rows whose
  `regionCode` (uppercased) matches; unknown/empty code → no call.
- `handlePointSelect(entry)` calls `onSelectionChange` with `[entry]`.
- When `onSelectionChange` is absent, selection handlers are no-ops (drill disabled).

## 6. Fixtures

Add `tests/fixtures/map.ts`:

- `regionsOnly` — several countries with a value spread for gradient/bucket tests.
- `pointsOnly` — a few `lat`/`lng` points with varied values.
- `mixed` — region + point rows.

Meta-test: every fixture parses through `mapChartDataSchema`.

## 7. Out of scope

- Correctness of the map projection geometry and `@visx/geo` / `@visx/zoom` internals.
- Zoom/pan interaction fidelity (candidate for optional Playwright coverage).
- Visual/pixel comparison of rendered countries.
