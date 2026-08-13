# tableu-abloese-mvp

This repository is a small Next.js 16 dashboard MVP built with the App Router. Its core idea is to describe dashboards declaratively in JSON, map those dashboard slots to reusable React modules, and generate concrete `app/` pages from that configuration.

The current implementation ships one example module, `LineChartModule`, and one example dashboard config, `DacoDa`. The structure is intentionally simple so new modules and dashboards can be added with minimal boilerplate.

## Tech stack

- Next.js 16 with the App Router
- React 19
- TypeScript
- Recharts for chart rendering
- Shared UI primitives in `components/ui`

## How the project is structured

- `app/`: App Router entrypoints. The root page currently renders `LineChartModule` directly. Generated dashboards live in their own folders such as `app/DacoDa/page.tsx`.
- `components/`: Layout and UI composition helpers. `ChartPageWrapper` wraps dashboard pages; `TapsWrapper` renders tabs, rows, and module instances.
- `modules/`: Reusable dashboard modules. Each module should export a named React component compatible with `BaseChartProps`.
- `pagesConfig/`: Source of truth for generated dashboards. `index.ts` registers dashboards, and each JSON file defines tab layout and module placement.
- `scripts/`: Project automation. `generateNextPage.ts` turns registered dashboard configs into concrete Next.js pages.
- `types/`: Shared global types for module props and dashboard tab configuration.

## How the dashboard flow works

1. A dashboard is registered in `pagesConfig/index.ts` with a `dashboardName` and a JSON config file name.
2. The JSON file in `pagesConfig/` defines tabs, rows, row heights, and which modules should be rendered in each row.
3. `npm run generatePage` executes `scripts/generateNextPage.ts`.
4. The script validates the project root and the referenced JSON file, creates `app/<DashboardName>/page.tsx`, and injects module imports based on the JSON content.
5. The generated page builds a `tabsConfig` object and passes it into `TapsWrapper`.
6. `TapsWrapper` renders one tab per `trigger`, lays out rows as a 12-column grid, and mounts each configured module.

## How `generateNextPage.ts` works

The user request mentions `generateNextPage.js`, but in this repository the generator is implemented as TypeScript in `scripts/generateNextPage.ts` and is executed through `npx tsx` via `npm run generatePage`.

The generator performs these steps for every dashboard entry in `pagesConfig/index.ts`:

1. Read `dashboardName` and `dashboardConfigName`.
2. Build the target page folder path `app/<dashboardName>` and the JSON source path `pagesConfig/<dashboardConfigName>`.
3. Run `validateRootDirectoryAndPagesConfig(...)` from `scripts/utils.ts`.
4. Stop for that dashboard if the target folder already exists.
5. Read and parse the JSON dashboard config.
6. Collect every distinct `components[].module` value used anywhere in the config.
7. Generate import statements like `import { LineChartModule } from "@/modules/LineChartModule";`.
8. Serialize the JSON config into code and replace quoted module names with actual component identifiers so `TapsWrapper` receives component references instead of strings.
9. Write a complete `app/<dashboardName>/page.tsx` file that wraps the tab config in `ChartPageWrapper` and `TapsWrapper`.

That means the JSON layout is declarative, but the generated page is fully typed TypeScript/TSX with real component imports.

## Example dashboard config

The current `pagesConfig/dacodaPageConfig.json` uses this shape:

```json
[
  {
    "trigger": "Overview",
    "rows": [
      {
        "height": 12,
        "components": [
          { "module": "LineChartModule", "space": 3 },
          { "module": "LineChartModule", "space": 6 }
        ]
      }
    ]
  }
]
```

Meaning of the fields:

- `trigger`: Tab label.
- `rows`: Vertical sections inside the tab.
- `height`: Module height in `svh`, passed to each module in that row as `height`.
- `components`: Modules rendered in that row.
- `module`: Name of the exported module component.
- `space`: Requested width in a 12-column grid.

## Module conventions

Every module under `modules/` should follow the same basic contract:

- Export a named component from `modules/<ModuleName>/index.tsx`.
- Accept `BaseChartProps` so the dashboard layout can pass a `height` value.
- Be safe to render multiple times on the same page.
- Document itself in `modules/<ModuleName>/instructions.md`.

The current module overview lives in `modules/instructions.md`.

## Development commands

```bash
npm install
npm run dev
npm run lint
npm run generatePage
```

## Adding a new module

1. Create `modules/<ModuleName>/index.tsx` and export a named component.
2. Add `modules/<ModuleName>/instructions.md`.
3. Update `modules/instructions.md` with the new module's purpose.
4. Reference the module name in a dashboard JSON config.
5. Run `npm run generatePage` if the page does not already exist.

## Current limitations

- Generated pages are only created if the target folder does not already exist.
- Existing generated pages are not refreshed automatically when the JSON changes.
- The sample module uses static demo data.
- `TapsWrapper` normalizes remaining row width by assigning unused columns to the last component in a row.
