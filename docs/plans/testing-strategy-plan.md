# Testing Strategy Plan

Status: Proposed
Owners: Engineering
Tooling: Vitest (unit + component), Playwright (E2E)
Scope: `tableu-replacement-mvp` — config-driven Next.js 16 / React 19 App Router dashboard MVP

---

## 1. Goals

- Establish a fast, deterministic test suite that runs locally and in CI **without any live Databricks connection**.
- Cover the three layers that carry the most risk in this codebase:
  1. Pure logic (filter resolution, key helpers, Zod schemas, generation scripts).
  2. React components/modules rendering with mocked data.
  3. End-to-end dashboard behavior (filtering, chart selection, tab nav, share links).
- Keep the config-driven contract enforced: SQL output shape ↔ module Zod schema ↔ dashboard JSON.
- No coverage thresholds are enforced yet (deferred — see §9).

## 2. Non-Goals (for this iteration)

- No live Databricks / integration tier. The `@databricks/sql` layer is mocked at the `runQuery` boundary.
- No visual-regression / screenshot-diff baseline (may be added later).
- No load/performance testing.

---

## 3. Test Layers & Boundaries

### Layer A — Unit (Vitest, `node` environment)

Pure and near-pure logic. Fast, no DOM.

| Target                 | File(s)                                                                                              | What to assert                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filter key helpers     | `stores/filterProvider.ts` (`globalKey`, `tabKey`; defaults through `initFilterStore`)                | Correct key format; default values applied per scope (`global` vs `tab`); dimensions without `defaultValue` skipped. Test private default-building behavior through the public store API. |
| Filter store actions   | `stores/filterProvider.ts`                                                                           | `setDraftFilter`, `clearDimension`, `clearAll`, `applySelection` (in-place vs `navigateTo`), `setActiveTab`, `initFilterStore`/`resetFilterStore` idempotency. |
| Deferred-query gate    | `stores/filterProvider.ts`                                                                           | `draftValues` vs `appliedValues` split; `hasApplied` gate (false until first `applyFilters()`/snapshot hydration); `resetDraft`; `isDirty(state)`; `clearDimension`/`applySelection` bypass the Apply gate (write draft **and** applied). |
| Chart connections store | `stores/chartConnectionsStore.ts`                                                                   | `filtersBySource` keyed by source chartID; `mergeFiltersByChart` dedupe/union across sources; `stageSourceFilters` → `applyPendingSourceFilters` → `clearPendingSourceFilters` lifecycle; `setSourceFilters(chartID, {})` clears one source; `resetConnections`. |
| Tooltip store          | `stores/tooltip.ts`                                                                                  | Single-owner `chartID` semantics (only the owning wrapper renders); static vs transient tooltip; `pending`/`rejected`/`fulfilled` transitions; `failedBatches`; `hideTooltip`. |
| Query timing store     | `stores/queryTimingStore.ts`                                                                         | `recordTiming` accumulation/reset behavior.                                                                                                               |
| Chart param resolution | `components/ChartWrapper/index.tsx` (extract `toQueryParam` + param builder if not already exported) | `filterBindings` → SQL param map; global value takes precedence over tab value; unset → `null`.                                                           |
| Utilities              | `lib/utils.ts` (`cn`, etc.)                                                                          | Class merge behavior, edge cases.                                                                                                                         |
| Module Zod schemas     | `modules/*/chartDataSchema.ts`                                                                       | Valid rows parse; malformed rows reject. Verify exported data types against the inferred schemas with compile-time `expectTypeOf` assertions rather than runtime tests. |

### Layer B — Generation scripts (Vitest, `node` environment)

These scripts are the backbone of the config-driven model and are pure Node — high value, easy to test against a temp fixture dir.

| Target                     | File                                        | What to assert                                                                                                                       |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Module registry generation | `scripts/modules/generateModuleRegistry.ts` | Given a fixture `modules/` tree, emits correct registry keys + config union; deterministic output.                                   |
| Module validation          | `scripts/modules/validateModules.ts`        | Passes on a compliant fixture; fails with clear errors for each missing contract file / missing default export / wrong `type` count. |
| Page generation            | `scripts/pages/generateNextPage.ts`         | Emits `app/Dashboards/<Name>/page.tsx` and `dashboardConfig.ts`; `dashboardConfig.ts` contains the referenced configuration and `INITIAL_TAB`; **skips** when the directory already exists.   |
| Dashboard ID generation    | `scripts/modules/generateDashboardID.ts`    | ID format/uniqueness.                                                                                                                |

> Run these against fixtures in an isolated temp dir (`os.tmpdir()`), never against the real `modules/` or `app/` tree. Before adding these tests, refactor each script entry point to accept an explicit project root/input/output path and guard CLI execution so importing the module has no filesystem side effects. Keep production defaults pointed at the repository root.

### Layer C — API route handlers (Vitest, `node` environment)

Test the App Router route handlers directly by importing `POST`/`GET` and passing a constructed `Request`/`NextRequest`. **Mock the warehouse layer.**

| Route                   | File                                     | What to assert                                                                                                                                                                     |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chart data              | `app/api/data/chart/[...chartIDs]/route.ts` | Missing `chartID` → 400; path-traversal `chartID` → 400; unknown SQL file → 404; `runQuery` throws → 500; happy path returns JSON from mocked `runQuery`; the single `:input` object is serialized from named filters. |
| Tooltip (batched)       | `app/api/data/chart/tooltip/route.ts`    | Keeps only named params referenced by the tooltip SQL; dedupes identical parameter tuples; splits into batches (`TOOLTIP_BATCH_SIZE`, default 6,000) honoring the concurrency cap (`TOOLTIP_MAX_CONCURRENT_QUERIES`, default 5); streams NDJSON chunks (`TOOLTIP_STREAM_CHUNK_SIZE`, default 250); a failed batch adds a partial-results warning without discarding completed batches. |
| Filter options          | `app/api/filters/options/[id]/route.ts`  | Loads `pagesConfig/sql/filterOptions/<id>.sql` with **no** filter params; returns `value` (+ optional `label`) rows; unknown id → 404.                                            |
| Filter snapshot (write) | `app/api/filters/snapshot/route.ts`      | Persists snapshot, returns id; validates payload.                                                                                                                                  |
| Filter snapshot (read)  | `app/api/filters/snapshot/[id]/route.ts` | Returns stored snapshot; unknown id → 404.                                                                                                                                         |
| Error handler           | `app/api/router/errorhandler.ts`         | `buildErrorMessage` shape/status.                                                                                                                                                  |

**Mock boundary:** `vi.mock("app/api/warehouse/connection")` (or the relative import) so `runQuery` / the snapshot store are stubbed. This avoids importing `@databricks/sql` and env-var requirements (`HOSTNAME`, `HTTP_PATH`, tokens) entirely.

### Layer D — Component/module rendering (Vitest, `jsdom` + React Testing Library)

Render components with mocked `/api/data` responses and a seeded filter store.

| Target                     | What to assert                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ChartWrapper`             | Loading (spinner) → success (module renders) → error (Empty state) → invalid-schema data surfaces an error, not a crash. Uses a mocked `fetch`/React Query client. |
| `modules/LineChartModule`  | Renders series from valid `chartData`; empty data → empty state.                                                                                                   |
| `modules/MapModule`        | Renders regions; selection callback (`onSelectionChange`) fires with expected rows when selection is enabled.                                                      |
| `components/TabsWrapper`   | Renders tabs/rows from declarative config; switching tabs updates `activeTab`.                                                                                     |
| `components/FilterControl` | Every filter `type` (`string`, `number`, `dateString`, `dateRange`, `select`, `multiselect`, `option`) renders and writes to the store. Cover async warehouse options, searchable multiselect truncation, mandatory option fallback selection, and multiselect serialization through `toQueryParam`. |
| `components/ActiveFilters` | Renders chips for active values; removing a chip clears the dimension; interactive controls carry `print:hidden`.                                                  |
| `components/FilterActions` | Apply/Reset in the top bar: `ChartWrapper` stays idle until first Apply (`hasApplied`); Apply promotes draft → applied and triggers re-query; Reset discards draft. |
| `components/TooltipCard`   | Static tooltip renders the virtualized table from `dataPoint`; value formatting for string/number/boolean/array/object/null; only the owning `chartID` renders; "Verknüpfte Diagramme filtern" footer visible only with connections + staged source filters. |

> Wrap render in a helper that provides the React Query provider and initializes the filter store.

### Layer D.1 — Connections & tooltip interaction (Vitest, `jsdom` + RTL)

The cross-chart selection → tooltip → connection machinery lives in `ChartWrapper` +
`chartConnectionsStore` and is the subtlest behavior in the app. Cover it explicitly:

| Target                              | What to assert                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual connection application       | Selection on a source chart stages outgoing filters; the target only re-queries after the context-menu/tooltip action applies them; empty selection clears staged filters. |
| `autoApplyConnections: true`        | Resolved filters apply immediately after the source tooltip query, yet remain **staged** so the source tooltip stays open and its all-target button stays visible; an empty selection clears that source's applied connection filters immediately. |
| Interaction lock                    | A target refetch/interaction lock never closes **another** chart's tooltip (`shouldHideTooltipForInteractionLock` only hides the locked chart's own tooltip).             |
| **Bidirectional teardown (regression)** | With reciprocal `A→B` and `B→A` connections, applying `B→A` forces `A` to refetch; the `zoomContext`-keyed effect calls `setSourceFilters(A, {})`, unwinding `A→B` (and cascading to clear `B→A`). Pin this so the filters cannot silently stack. |
| Context-menu enablement             | "Tooltip anzeigen" disabled without selection or when `enhancedTooltip` is false; "Verlinktes Diagramm filtern" disabled without outgoing connections, selection, or resolved connection values; target submenu dedupes target IDs and uses `chartTitle` labels (never internal chart IDs; untitled → `Unbenanntes Diagramm`). |
| `expectedColumns` resolution        | Connection values are read from the source tooltip aliases, normalized to atomic scalar/array values, and forwarded into the target's `:input` struct field of the same name. |

### Layer E — End-to-end (Playwright)

Runs against the built app with the **data API mocked at the network layer** (Playwright route interception) so no Databricks is needed.

| Flow                    | Steps / assertions                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dashboard loads         | Navigate to a generated dashboard; charts show the deferred-query idle prompt and make no chart-data request before Apply; no console errors. |
| Global filter           | Change a global filter → no request while the value is only draft; press Apply → all bound charts re-query with the new param (assert intercepted request bodies). |
| Tab-scoped filter       | Filter on tab A does not affect tab B.                                                                      |
| Tab navigation          | Switch tabs; correct components render; `?tab=` in URL updates.                                             |
| Chart selection         | Select data on a selection-capable chart → central selection callback receives the expected rows.           |
| Multi-selection         | Additive click/lasso selection returns all selected rows.                                                   |
| Share link              | `ShareButton` → `POST /api/filters/snapshot` (intercepted) returns id; visiting `?s=<id>` restores filters and auto-applies (data shows without pressing Apply). |
| Deferred queries        | Editing a filter leaves charts idle ("Apply to run"); pressing **Apply** re-queries bound charts; **Reset** discards the draft.                            |
| Tab-jump drilldown      | A chart with `tabJumps` drills into the target tab, binds selected values as tab filters, pushes a `TabBreadcrumb`, and single-click return restores prior filter state (`restoreOnReturn !== false`). |
| Applied filters / print | `ActiveFilters` chips render; `print:hidden` controls hidden in print emulation.                            |

**Data mocking for E2E:** intercept `POST /api/data/*`, `**/api/filters/snapshot*`, and `GET **/api/filters/options/*` with `page.route(...)`. Return chart fixtures that match each module's Zod schema, snapshot fixtures for share-link flows, and option fixtures for warehouse-backed filters. This keeps E2E deterministic and credential-free while still exercising the real page/generation/render pipeline. A test may omit the filter-options interception only when its dashboard uses static options exclusively.

---

## 4. Tooling & Configuration

### 4.1 Dependencies (dev)

```
vitest
@vitejs/plugin-react
jsdom
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
@playwright/test
```

Install Playwright browsers via `pnpm exec playwright install --with-deps chromium` (CI) / `pnpm exec playwright install` (local).

### 4.2 Vitest config

Use a single `vitest.config.ts` with **projects** to separate environments:

- `unit` project → `environment: "node"`, matches `**/*.test.ts` in `stores/`, `lib/`, `scripts/`, `app/api/`, `modules/**/chartDataSchema`.
- `component` project → `environment: "jsdom"`, `setupFiles` with `@testing-library/jest-dom`, matches `**/*.test.tsx`.

Key settings:

- `plugins: [react()]` for React transforms. Use Vitest 5's native `resolve.tsconfigPaths: true` for `@/…` aliases; do not configure `vite-tsconfig-paths` as a second resolver.
- `test.globals: true` (optional) or explicit imports.
- `test.exclude` must include `tests/e2e/**` and `**/node_modules/**` so Playwright specs never run under Vitest.
- `setupFiles` mocks: stub `next/navigation` (`useRouter`, `useSearchParams`, `usePathname`) and provide env defaults where needed.

### 4.3 Playwright config

`playwright.config.ts`:

- `testDir: "tests/e2e"`.
- `webServer`: build + start (`pnpm build && pnpm start`) or `pnpm dev` for local, with `reuseExistingServer: !process.env.CI`.
- Provide dummy env vars (`HOSTNAME`, `HTTP_PATH`, `DATABRICKS_TOKEN`) so the server boots; all data is route-intercepted regardless.
- Single `chromium` project to start; expand later.
- `trace: "on-first-retry"`, `retries: process.env.CI ? 2 : 0`.

### 4.4 Directory layout

```
tests/
  unit/            # (optional) shared unit specs not colocated
  fixtures/        # module-schema-shaped sample data, sample dashboard configs
  helpers/         # renderWithProviders, buildRequest, tmp module tree builder
  mocks/           # warehouse/runQuery mock, next/navigation mock
  e2e/             # Playwright specs + route-interception fixtures
```

Colocate small unit specs next to source (e.g. `stores/filterProvider.test.ts`); keep cross-cutting fixtures/helpers under `tests/`.

### 4.5 Package scripts

```jsonc
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run --project unit",
  "test:component": "vitest run --project component",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:all": "vitest run && playwright test",
}
```

---

## 5. Mocking Strategy (Databricks-free)

1. **Route-handler tests:** `vi.mock` the `warehouse/connection` module so `runQuery` returns fixtures and `@databricks/sql` is never imported (avoids env-var throw at module load).
2. **Component tests:** mock `fetch`/React Query so `/api/data/<chartID>` resolves to schema-valid fixtures.
3. **E2E:** `page.route()` interception for `**/api/data/*`, `**/api/filters/snapshot*`, and warehouse-backed `**/api/filters/options/*` requests.
4. **Fixtures are the single source of truth for shape** and must validate against the corresponding module `chartDataSchema.ts` (add a meta-test that parses each fixture through its schema).

---

## 6. CI — GitHub Actions

`.github/workflows/test.yml`:

- Trigger on `push` and `pull_request`.
- Node pinned to the repo `engines` (`node >=24.17 <25`) and pnpm pinned from the `packageManager` field (`pnpm@12.3.4`). Use pnpm for development and test CI; the synchronized `package-lock.json` remains a deployment artifact.
- `postinstall` runs `databricks:install` and synchronizes the npm lock. In test CI, install with `pnpm install --frozen-lockfile --ignore-scripts`, then run only the explicit setup steps required by the test jobs. Add a dedicated skip flag before enabling lifecycle scripts in CI.

Jobs:

1. **lint-and-types**: `pnpm lint` + `pnpm verify:typescript`.
2. **unit-component**: `pnpm test` (Vitest, both projects). Upload results.
3. **e2e**: `pnpm exec playwright install --with-deps chromium` → `pnpm build` → `pnpm test:e2e`. Upload Playwright HTML report + traces as artifacts on failure.

Dummy env vars provided at the job level for the Next server (`HOSTNAME`, `HTTP_PATH`, `DATABRICKS_TOKEN`), since all data access is mocked.

---

## 7. Contract / config-integrity tests (high leverage)

Because this repo is config-driven, add guard tests that fail fast when the contract drifts:

- **Module contract:** for every folder in `modules/`, assert presence of `index.tsx` (default export), `chartDataSchema.ts` (default Zod export + type export), `chartType.d.ts` (exactly one `type`), `instructions.md`. (Mirrors `scripts/modules/validateModules.ts`; run it as a test too.)
- **Registry freshness:** regenerate the registry in a temp copy and diff against committed `modules/modulRegistry.ts` → fail if stale.
- **SQL ↔ config linkage:** every `chartID` referenced in `pagesConfig/*.json` has a matching `pagesConfig/sql/<chartID>.sql`, and vice-versa (warn on orphans).
- **`:input` contract lint:** every normal chart SQL uses only the framework `:input` marker (parsed via `from_json(CAST(:input AS STRING), 'STRUCT<...>')`) and never references stray dynamic markers (`:from`, `:region`, connection column names) directly. Conversely, tooltip SQL uses batched data-point markers (`:x`, `:id`, …) and must **not** use `:input`.
- **Connection contract:** every `DashboardConfig.connections[].expectedColumns` entry is aliased in the source `*.tooltip.sql` and declared as a same-named field in the target chart SQL's `:input` struct.
- **Fixture ↔ schema:** each E2E/component fixture parses cleanly through its module schema.

---

## 8. Phased Rollout

1. **Phase 1 — Foundation + CI smoke gate:** add deps, Vitest projects, `playwright.config.ts`, pnpm scripts, `tests/` scaffolding, `next/navigation` + warehouse mocks, and the provider render helper. Add CI immediately with lint, typecheck, and the existing test suite so every later phase is enforced when it lands.
2. **Phase 2 — Unit, script isolation, and core contracts (Layers A/B):** refactor script entry points for injectable temp roots and side-effect-free imports; cover the filter store, timing store, param resolution, schemas, generation/validation scripts, module contract, registry freshness, and SQL/config linkage.
3. **Phase 3 — API handlers (Layer C):** data route (400/404/500/happy), tooltip batching/streaming, filter options, snapshot read/write, error handler, and the SQL `:input`/connection contract guards.
4. **Phase 4 — Component (Layer D + D.1):** `ChartWrapper` states, one line-chart + one map render, `TabsWrapper`, all seven `FilterControl` types, `FilterActions`, `ActiveFilters`, `TooltipCard`; then the connections/tooltip interaction track (manual vs `autoApplyConnections`, interaction lock, **bidirectional teardown regression**, context-menu enablement).
5. **Phase 5 — E2E (Layer E):** initial idle gate, Apply-triggered load, global filter draft/Apply behavior, tab-scoped filter, tab nav, chart selection, multi-select, Reset, tab-jump drilldown, and share link. Intercept chart data, snapshots, and warehouse-backed filter options.
6. **Phase 6 — Hardening:** make the accumulated CI jobs required, add fixture/schema compile-time checks, review coverage, and close gaps found from early CI runs.

---

## 9. Deferred Decisions

- **Coverage thresholds:** intentionally not set yet. Once Phases 2–4 land, review real coverage and set per-area gates (candidates: `lib/`, `stores/`, `hooks/`, `modules/**/chartDataSchema.ts`, `scripts/`).
- **Visual regression** (Playwright screenshots) — revisit after E2E stabilizes.
- **Integration tier against a real test warehouse** — out of scope; can be added behind an opt-in `TEST_DATABRICKS=1` flag later.

---

## 10. Risks & Mitigations

| Risk                                                       | Mitigation                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `@databricks/sql` module throws on import without env vars | Mock the `warehouse/connection` module; never import it in unit tests.                                                  |
| `postinstall` (`databricks:install`) breaks CI             | Use `pnpm install --frozen-lockfile --ignore-scripts`; gate lifecycle setup and run required setup explicitly.          |
| Path aliases (`@/…`) don't resolve in Vitest               | Use Vitest 5's native `resolve.tsconfigPaths: true`.                                                                    |
| Generation tests mutate the working tree or execute on import | Inject project/input/output roots, guard CLI entry points, and run fixtures only in temporary directories.          |
| E2E accidentally reaches Databricks through filter options | Intercept `GET **/api/filters/options/*` or use static-option-only dashboards for tests that do not exercise that API. |
| Next server components / RSC quirks under jsdom            | Test client components/modules directly; cover server routes as plain handler imports; cover full pages via Playwright. |
| Generated pages skipped when dir exists                    | Script tests run in an isolated temp dir; E2E generates against a clean checkout in CI.                                 |
| Fixtures drift from schemas                                | Meta-test parses every fixture through its module schema.                                                               |
