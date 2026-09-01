# tableu-abloese-mvp

This repository is a config-driven Next.js 16 dashboard MVP.

The intended workflow is not to hand-build dashboard pages in React. Instead, dashboards are described declaratively in `pagesConfig/*.json`, each chart gets its data from `pagesConfig/sql/<chartID>.sql`, and existing runtime wrappers resolve modules, fetch data, validate the returned shape, and render the chart.

## Core idea

The long-term target flow is:

1. A user asks for one or more visualizations and names the source database tables.
2. An agent selects suitable existing visualization modules from `modules/`.
3. The agent reads the selected module's `instructions.md`, `chartType.d.ts`, and `chartDataSchema.ts`.
4. The agent writes or updates dashboard JSON and SQL so the SQL output matches the selected module schema exactly.
5. Existing generation and runtime code render the dashboard without page-specific module implementation changes.

For normal dashboard work, the source of truth is config plus SQL, not page-specific React code.

## Tech stack

- Next.js 16 with the App Router
- React 19
- TypeScript
- TanStack Query for client-side chart data loading
- Zod for runtime data validation
- Recharts for chart rendering
- Databricks SQL integration for chart queries

## Repository structure

- `pagesConfig/index.ts`: Registry of dashboards and the JSON file each dashboard uses.
- `pagesConfig/*.json`: Declarative dashboard definitions with tabs, rows, chart metadata, filters, and module config.
- `pagesConfig/sql/<chartID>.sql`: SQL source for a chart. The `chartID` maps directly to the SQL filename.
- `app/Dashboards/<DashboardName>/page.tsx`: Generated App Router pages for dashboards.
- `components/TabsWrapper/index.tsx`: Renders tabs and rows and passes each chart entry into `ChartWrapper`.
- `components/ChartWrapper/index.tsx`: Resolves the selected module, fetches chart data, validates it against the module schema, and injects runtime props.
- `app/api/data/[...chartIDs]/route.ts`: Loads `pagesConfig/sql/<chartID>.sql`, executes it, and returns the query result.
- `modules/`: Reusable visualization modules.
- `modules/modulRegistry.ts`: Auto-generated registry of available modules and the union of chart config types.
- `modules/instructions.md`: High-level overview of the available modules and when to use them.
- `modules/<ModuleName>/instructions.md`: Module-specific behavior, data contract, config rules, and usage notes.
- `scripts/pages/generateNextPage.ts`: Generates `app/Dashboards/<DashboardName>/page.tsx` from `pagesConfig/index.ts` and the referenced JSON.
- `scripts/modules/validateModules.ts`: Validates the required module file contract.
- `scripts/modules/generateModuleRegistry.ts`: Regenerates `modules/modulRegistry.ts` from module folders.

## How a chart gets rendered

The dashboard config stays declarative all the way until the runtime wrappers resolve and render the selected module.

```mermaid
flowchart TD
    A[pagesConfig/index.ts] --> B[pagesConfig/<dashboard>.json]
    B --> C[npm run pageConfig:generatePage]
    C --> D[app/Dashboards/<DashboardName>/page.tsx]
    D --> E[ChartPageWrapper]
    E --> F[TabsWrapper]
    F --> G[ChartWrapper]
    G --> H[moduleRegistry via moduleName]
    G --> I[/api/data/<chartID>]
    I --> J[pagesConfig/sql/<chartID>.sql]
    J --> K[Databricks query result]
    K --> G
    G --> L[Zod validation via module chartDataSchema.ts]
    L --> M[Module default export]
```

In practice that means:

1. `pagesConfig/index.ts` points to a dashboard JSON file.
2. `npm run pageConfig:generatePage` embeds that JSON into `app/Dashboards/<DashboardName>/page.tsx`.
3. The generated page renders `ChartPageWrapper` and `TabsWrapper`.
4. `TabsWrapper` lays out rows in a 12-column grid and passes each configured chart entry to `ChartWrapper`.
5. `ChartWrapper` resolves the selected module from `modules/modulRegistry.ts` using `moduleName`.
6. `ChartWrapper` fetches `/api/data/<chartID>`.
7. The API route loads `pagesConfig/sql/<chartID>.sql` and executes it.
8. The returned data is validated against the selected module's `chartDataSchema.ts`.
9. The module receives `ChartWrapperInjectedProps<...>` with `chartData`, loading state, error state, and the configured chart metadata.

## Deferred queries (Apply to run)

Charts do **not** fetch on dashboard open. Editing a filter updates a *draft*
layer only; queries fire when the user presses **Apply**.

- The filter store (`stores/filterProvider.ts`) keeps two layers: `draftValues`
  (edited by controls) and `appliedValues` (drives queries + chips), plus a
  `hasApplied` gate that is `false` until the first Apply.
- `components/FilterActions/index.tsx` renders **Apply**/**Reset**; Reset discards
  pending draft edits. A dirty indicator shows when draft ≠ applied.
- `ChartWrapper` reads `appliedValues`, gates `useQuery` on `hasApplied`, and shows
  an idle prompt until the first Apply.
- **Chip removal** (`clearDimension`) and **drill** (`applySelection`) bypass the
  gate on purpose: they write to both layers and re-query immediately.
- A shared permalink (`?s=<id>`) auto-applies on hydration so recipients see data
  without pressing Apply.

## Dashboard config model

The generated dashboard pages consume a `DashboardConfig` object from `types/tabs.d.ts`.

At a high level, each JSON file contains:

- `reportName` and `filterLayout` (`"sidebar" | "top"`)
- `filters`: dashboard-level filter dimensions (`FilterDimension[]`)
- `tabs` identified by `trigger`
- rows with optional `height`
- `components` entries
- one `moduleName` per chart entry
- chart metadata such as `chartID`, `chartTitle`, `chartDescription`, `chartConfig`, and per-chart `filterBindings` (dimension id → SQL parameter)

The row layout uses a 12-column grid. If a row uses less than 12 columns, `TabsWrapper` assigns the remaining width to the last component in that row.

## Module system

Each module lives in `modules/<ModuleName>/` and must follow this contract:

- `index.tsx`
- `chartDataSchema.ts`
- `chartType.d.ts`
- `instructions.md`

Additional files and subfolders are allowed, but these four files are mandatory.

The required behavior is:

- `index.tsx` must have a default export.
- The default-exported component must use `ChartWrapperInjectedProps` as its props type.
- `chartDataSchema.ts` must default-export a Zod schema and also export the module data type.
- `chartType.d.ts` must contain exactly one `type` declaration.
- `instructions.md` must follow `.github/agents/instructions.template.md`.

When agents or developers choose a module for a new chart, they should use:

- `modules/instructions.md` for a quick overview of available modules
- `modules/<ModuleName>/instructions.md` for module-specific behavior and rules
- `modules/<ModuleName>/chartType.d.ts` for the required config shape
- `modules/<ModuleName>/chartDataSchema.ts` for the required SQL output shape

## Generator behavior

`npm run pageConfig:generatePage` runs `scripts/pages/generateNextPage.ts`.

For each entry in `pagesConfig/index.ts`, the generator:

1. Reads `dashboardName` and `dashboardConfigName`.
2. Validates that the project root and referenced JSON file exist.
3. Reads and parses the dashboard JSON.
4. Creates `app/Dashboards/<DashboardName>/page.tsx` if the target folder does not already exist.
5. Embeds the parsed dashboard JSON directly into the generated page as `tabsConfig`.

Important limitation:

- the generator does not overwrite an existing page directory

That means JSON changes do not automatically refresh an already generated page folder.

## Data flow and SQL

Each chart entry carries a `chartID`.

At runtime:

- `ChartWrapper` calls `/api/data/<chartID>`
- the API route resolves that to `pagesConfig/sql/<chartID>.sql`
- the SQL query runs against the configured warehouse connection
- the raw result is returned to `ChartWrapper`
- `ChartWrapper` validates the array against the selected module schema before rendering the module

The intended authoring rule is simple:

- SQL must return exactly the data structure required by the selected module's `chartDataSchema.ts`

## Working on dashboards

For normal dashboard work, prefer changing only:

- `pagesConfig/index.ts`
- `pagesConfig/*.json`
- `pagesConfig/sql/*.sql`

Avoid implementing dashboard-specific behavior in generated `app/` page files.

Avoid changing module implementation files for normal dashboard requests.

## Working on modules

Change module implementation files only when the task is explicitly about module capabilities, shared framework behavior, validation, registry generation, or infrastructure.

After changing module folders:

- run `npm run module:validate`
- run `npm run module:generateRegistry` if you changed exports, config types, schema files, or module names

Keep `modules/instructions.md` up to date whenever the available modules, their intended usage, or their capabilities change.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run pageConfig:generatePage
npm run module:validate
npm run module:generateRegistry
npm run databricks:connect
npm run databricks:tableSchemas
```

## Current caveats

- `app/Dashboards/<DashboardName>/page.tsx` files are generated outputs, not the primary authoring surface.
- The generator skips dashboards whose target page directory already exists.
- `ChartPageWrapper` is currently only a thin layout wrapper.
- The root `app/page.tsx` is not the main dashboard authoring flow; the config-driven dashboard path is the intended architecture.
