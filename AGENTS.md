<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project-specific guidance

## What this repository does

This is a config-driven Next.js dashboard MVP built on the App Router.
Pages under `app/` can be generated from JSON dashboard definitions in `pagesConfig/`.
The generated page composes reusable chart modules from `modules/` and renders them through `components/TapsWrapper`.

## Important paths

- `app/`: Next.js App Router pages. Generated dashboards live here as `app/<DashboardName>/page.tsx`.
- `modules/`: Reusable dashboard modules. Every module should export a React component that accepts `BaseChartProps`.
- `modules/instructions.md`: Overview of all available modules and their intended use.
- `modules/<ModuleName>/instructions.md`: Module-specific implementation and usage notes.
- `pagesConfig/index.ts`: Registry of dashboards that should be generated.
- `pagesConfig/*.json`: Declarative tab and row layout for each dashboard.
- `scripts/generateNextPage.ts`: Generates App Router pages from `pagesConfig` entries.
- `components/TapsWrapper/index.tsx`: Resolves config rows into rendered modules inside tabs.

## Rendering model

1. `pagesConfig/index.ts` defines which dashboards exist.
2. Each dashboard points to a JSON config file in `pagesConfig/`.
3. `scripts/generateNextPage.ts` reads that JSON file, collects module names, writes imports, and creates `app/<DashboardName>/page.tsx`.
4. The generated page passes a typed `tabsConfig` object into `TapsWrapper`.
5. `TapsWrapper` renders tabs, fills remaining row width to 12 columns, and mounts each referenced module.

## Module contract

- Export the module as a named React component from `modules/<ModuleName>/index.tsx`.
- The component must be usable as `React.ComponentType<BaseChartProps>`.
- `height` is passed from the row config and is defined as a numeric range from 1 to 100.
- The module name in JSON must exactly match the exported component name used by the generator.

## Editing rules for agents

- Prefer updating JSON layout in `pagesConfig/*.json` when the change is about arrangement, tabs, row height, or module placement.
- Prefer updating `modules/` when the change is about chart behavior, data, styling, or component internals.
- If you add a new module, also add or update:
  - `modules/instructions.md`
  - `modules/<ModuleName>/instructions.md`
  - Any dashboard config that should reference the new module
- If you change generator behavior, keep `README.md` aligned with the actual flow in `scripts/generateNextPage.ts`.

## Known implementation details

- The component is named `TapsWrapper`, but it renders tabs using the shared tabs UI.
- The generator skips dashboards whose target folder already exists.
- The current example module uses static sample data and is intended as a visual scaffold, not a production data source.
