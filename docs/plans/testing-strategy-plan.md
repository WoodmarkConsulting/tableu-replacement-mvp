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
| Filter key helpers     | `stores/filterProvider.ts` (`globalKey`, `tabKey`, `buildDefaultValues`)                             | Correct key format; default values applied per scope (`global` vs `tab`); dimensions without `defaultValue` skipped.                                      |
| Filter store actions   | `stores/filterProvider.ts`                                                                           | `setFilter`, `clearDimension`, `clearAll`, `applySelection` (in-place vs `navigateTo`), `setActiveTab`, `initFilterStore`/`resetFilterStore` idempotency. |
| Query timing store     | `stores/queryTimingStore.ts`                                                                         | `recordTiming` accumulation/reset behavior.                                                                                                               |
| Chart param resolution | `components/ChartWrapper/index.tsx` (extract `toQueryParam` + param builder if not already exported) | `filterBindings` → SQL param map; global value takes precedence over tab value; unset → `null`.                                                           |
| Utilities              | `lib/utils.ts` (`cn`, etc.)                                                                          | Class merge behavior, edge cases.                                                                                                                         |
| Module Zod schemas     | `modules/*/chartDataSchema.ts`                                                                       | Valid rows parse; malformed rows reject; type export matches inferred schema.                                                                             |

### Layer B — Generation scripts (Vitest, `node` environment)

These scripts are the backbone of the config-driven model and are pure Node — high value, easy to test against a temp fixture dir.

| Target                     | File                                        | What to assert                                                                                                                       |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Module registry generation | `scripts/modules/generateModuleRegistry.ts` | Given a fixture `modules/` tree, emits correct registry keys + config union; deterministic output.                                   |
| Module validation          | `scripts/modules/validateModules.ts`        | Passes on a compliant fixture; fails with clear errors for each missing contract file / missing default export / wrong `type` count. |
| Page generation            | `scripts/pages/generateNextPage.ts`         | Emits `app/Dashboards/<Name>/page.tsx` from a fixture config; **skips** when the directory already exists; embeds referenced JSON.   |
| Dashboard ID generation    | `scripts/modules/generateDashboardID.ts`    | ID format/uniqueness.                                                                                                                |

> Run these against fixtures in a temp dir (`os.tmpdir()`), never against the real `modules/` or `app/` tree.

### Layer C — API route handlers (Vitest, `node` environment)

Test the App Router route handlers directly by importing `POST`/`GET` and passing a constructed `Request`/`NextRequest`. **Mock the warehouse layer.**

| Route                   | File                                     | What to assert                                                                                                                                                                     |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chart data              | `app/api/data/[...chartIDs]/route.ts`    | Missing `chartID` → 400; path-traversal `chartID` → 400; unknown SQL file → 404; `runQuery` throws → 500; happy path returns JSON from mocked `runQuery`; named filters forwarded. |
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
| `components/FilterControl` | Each filter `type` (`string`, `number`, `dateString`, `dateRange`, `select`) renders and writes to the store.                                                      |
| `components/ActiveFilters` | Renders chips for active values; removing a chip clears the dimension; interactive controls carry `print:hidden`.                                                  |

> Wrap render in a helper that provides the React Query provider and initializes the filter store.

### Layer E — End-to-end (Playwright)

Runs against the built app with the **data API mocked at the network layer** (Playwright route interception) so no Databricks is needed.

| Flow                    | Steps / assertions                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dashboard loads         | Navigate to a generated dashboard; charts render (no error/empty states); no console errors.                |
| Global filter           | Change a global filter → all bound charts re-query with the new param (assert intercepted request body).    |
| Tab-scoped filter       | Filter on tab A does not affect tab B.                                                                      |
| Tab navigation          | Switch tabs; correct components render; `?tab=` in URL updates.                                             |
| Chart selection         | Select data on a selection-capable chart → central selection callback receives the expected rows.           |
| Multi-selection         | Additive click/lasso selection returns all selected rows.                                                   |
| Share link              | `ShareButton` → `POST /api/filters/snapshot` (intercepted) returns id; visiting `?s=<id>` restores filters. |
| Applied filters / print | `ActiveFilters` chips render; `print:hidden` controls hidden in print emulation.                            |

**Data mocking for E2E:** intercept `POST /api/data/*` and `**/api/filters/snapshot*` with `page.route(...)` returning fixtures that match each module's Zod schema. This keeps E2E deterministic and credential-free while still exercising the real page/generation/render pipeline.

---

## 4. Tooling & Configuration

### 4.1 Dependencies (dev)

```
vitest
@vitejs/plugin-react
vite-tsconfig-paths          # honor "@/..." path aliases
jsdom
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
@playwright/test
```

Install Playwright browsers via `npx playwright install --with-deps chromium` (CI) / `npx playwright install` (local).

### 4.2 Vitest config

Use a single `vitest.config.ts` with **projects** to separate environments:

- `unit` project → `environment: "node"`, matches `**/*.test.ts` in `stores/`, `lib/`, `scripts/`, `app/api/`, `modules/**/chartDataSchema`.
- `component` project → `environment: "jsdom"`, `setupFiles` with `@testing-library/jest-dom`, matches `**/*.test.tsx`.

Key settings:

- `plugins: [react(), tsconfigPaths()]` so `@/…` aliases resolve.
- `test.globals: true` (optional) or explicit imports.
- `test.exclude` must include `tests/e2e/**` and `**/node_modules/**` so Playwright specs never run under Vitest.
- `setupFiles` mocks: stub `next/navigation` (`useRouter`, `useSearchParams`, `usePathname`) and provide env defaults where needed.

### 4.3 Playwright config

`playwright.config.ts`:

- `testDir: "tests/e2e"`.
- `webServer`: build + start (`npm run build && npm run start`) or `npm run dev` for local, with `reuseExistingServer: !process.env.CI`.
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

### 4.5 npm scripts

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
3. **E2E:** `page.route()` interception for `**/api/data/*` and `**/api/filters/snapshot*`.
4. **Fixtures are the single source of truth for shape** and must validate against the corresponding module `chartDataSchema.ts` (add a meta-test that parses each fixture through its schema).

---

## 6. CI — GitHub Actions

`.github/workflows/test.yml`:

- Trigger on `push` and `pull_request`.
- Node/npm pinned to the repo `engines` (`node >=24.17 <25`, `npm >=11.13 <12`).
- `postinstall` runs `databricks:install` — either allow it (it only installs the CLI) or set an env flag to skip in CI if it requires network/credentials (decide during implementation; prefer `npm ci --ignore-scripts` + explicit steps if `postinstall` needs Databricks auth).

Jobs:

1. **lint-and-types**: `npm run lint` + `npm run verify:typescript`.
2. **unit-component**: `npm run test` (Vitest, both projects). Upload results.
3. **e2e**: `npx playwright install --with-deps chromium` → `npm run build` → `npm run test:e2e`. Upload Playwright HTML report + traces as artifacts on failure.

Dummy env vars provided at the job level for the Next server (`HOSTNAME`, `HTTP_PATH`, `DATABRICKS_TOKEN`), since all data access is mocked.

---

## 7. Contract / config-integrity tests (high leverage)

Because this repo is config-driven, add guard tests that fail fast when the contract drifts:

- **Module contract:** for every folder in `modules/`, assert presence of `index.tsx` (default export), `chartDataSchema.ts` (default Zod export + type export), `chartType.d.ts` (exactly one `type`), `instructions.md`. (Mirrors `scripts/modules/validateModules.ts`; run it as a test too.)
- **Registry freshness:** regenerate the registry in a temp copy and diff against committed `modules/modulRegistry.ts` → fail if stale.
- **SQL ↔ config linkage:** every `chartID` referenced in `pagesConfig/*.json` has a matching `pagesConfig/sql/<chartID>.sql`, and vice-versa (warn on orphans).
- **Fixture ↔ schema:** each E2E/component fixture parses cleanly through its module schema.

---

## 8. Phased Rollout

1. **Phase 1 — Foundation:** add deps, `vitest.config.ts`, `playwright.config.ts`, npm scripts, `tests/` scaffolding, `next/navigation` + warehouse mocks, provider render helper.
2. **Phase 2 — Unit + scripts (Layers A/B):** filter store, timing store, param resolution, schemas, generation/validation scripts. Highest ROI, fully deterministic.
3. **Phase 3 — API handlers (Layer C):** data route (400/404/500/happy), snapshot read/write, error handler.
4. **Phase 4 — Component (Layer D):** `ChartWrapper` states, one line-chart + one map render, `TabsWrapper`, `FilterControl`, `ActiveFilters`.
5. **Phase 5 — E2E (Layer E):** load, global filter, tab-scoped filter, tab nav, chart selection, multi-select, share link.
6. **Phase 6 — CI:** wire the GitHub Actions workflow; add contract/integrity guard tests.

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
| `postinstall` (`databricks:install`) breaks CI             | Use `npm ci --ignore-scripts` or gate the script; install what's needed explicitly.                                     |
| Path aliases (`@/…`) don't resolve in Vitest               | `vite-tsconfig-paths` plugin.                                                                                           |
| Next server components / RSC quirks under jsdom            | Test client components/modules directly; cover server routes as plain handler imports; cover full pages via Playwright. |
| Generated pages skipped when dir exists                    | Script tests run in an isolated temp dir; E2E generates against a clean checkout in CI.                                 |
| Fixtures drift from schemas                                | Meta-test parses every fixture through its module schema.                                                               |
