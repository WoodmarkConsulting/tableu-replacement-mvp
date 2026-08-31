# Dashboard Creation Flow

This document defines how an agent should guide a user through creating a dashboard.

The process has two levels:

1. Define the dashboard structure.
2. Complete each visualization one by one.

A visualization must be completed before the next visualization is started.

## Permissions

The Dashboard agent may create and modify dashboard files directly inside
`pagesConfig/` only. This includes dashboard configuration files, SQL files,
schema files, and `pagesConfig/pages.json`.

It may run only the approved dashboard npm scripts for generating chart IDs,
retrieving table schemas, and generating pages. Generated pages remain outputs;
the agent must not edit files outside `pagesConfig/` directly.

Do not ask the user to switch to the Development agent for normal dashboard
creation. Use the Dashboard agent for this workflow.

---

## 1. Create Dashboard

Ask for the dashboard name.

The dashboard name is required and is displayed later in the application.

Example:

```text
DacoDa
```

Do not invent a dashboard name.

---

## 2. Define Dashboard Tabs

Ask how many tabs the dashboard should contain.

Each tab becomes one `trigger` in the dashboard's `tabs` array.

For every tab, ask for its visible name.

Example:

```text
Overview
Costs
Users
```

Result:

```json
{
  "trigger": "Overview",
  "rows": []
}
```

---

## 3. Define Visualizations per Tab

For every tab, ask how many visualizations should be displayed and what the user wants to see.

Do not expect the user to know technical module names.

Read:

```text
modules/instructions.md
```

Use the available modules to suggest suitable visualization types in simple language.

Example:

Instead of:

> Select `LineChartModule`.

ask:

> How should the data be displayed?
>
> - Development over time
> - Comparison between values
> - Distribution
> - Single key figure

At this stage, only define the rough dashboard structure.

Do not retrieve table schemas or generate SQL for multiple unfinished visualizations.

---

# Visualization Workflow

The following workflow must be completed for one visualization before starting the next one.

---

## 4. Understand the Visualization

Ask what the user wants to visualize.

Clarify what information the chart should communicate.

Example:

> Show how many fleets were created over time.

Use this information to select a suitable existing module.

Do not create or modify a module during normal dashboard creation.

---

## 5. Select the Module

Use:

```text
modules/instructions.md
```

to determine which existing module best matches the requested visualization.

Then read:

```text
modules/<ModuleName>/instructions.md
```

The module instructions define how the selected module is used and configured.

---

## 6. Generate Chart ID

Every visualization requires its own unique `chartID`.

Never invent this ID manually.

Run:

```bash
npm run pageConfig:generateId
```

Example result:

```text
123456as
```

The `chartID` is the common identifier for all files and configuration belonging to this visualization.

Example:

```text
chartID: 123456as

Dashboard config
pagesConfig/schemas/123456as.json
pagesConfig/sql/123456as.sql
```

Each visualization must have a different `chartID`.

---

## 7. Collect Chart Description and Title

Every visualization requires a `chartDescription`.

The `chartTitle` is optional.

Ask the user what the visualization should communicate.

Example:

```json
{
  "chartTitle": "Fleet activity",
  "chartDescription": "Shows how fleet activity changes over time."
}
```

Rules:

- `chartDescription` is required.
- `chartTitle` is optional.
- The description should explain what the user should learn from the visualization.

---

## 8. Select Databricks Tables

Ask which Databricks table or tables contain the data required for this visualization.

One visualization may use multiple tables.

Ask for the fully qualified table paths.

Example:

```text
westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.2021024_sofa_gold_dev.announcement_2021024_sofa_gold
```

Do not guess table paths.

If a copied table path contains backticks, it must be wrapped in single quotes when passed to the CLI.

Example:

```bash
'catalog.`schema`.table'
```

---

## 9. Retrieve Table Schemas

After all source tables for the current visualization are known, retrieve their schemas.

Run:

```bash
npm run databricks:tableSchemas -- <chartID> '<table-path>' ['<table-path>' ...]
```

Example:

```bash
npm run databricks:tableSchemas -- 123456as \
  'catalog.schema.table_one' \
  'catalog.schema.table_two'
```

The first argument must be the visualization's `chartID`.

The command stores the result in:

```text
pagesConfig/schemas/
```

The generated schema file belongs only to the current visualization.

The agent must read the generated schema before generating SQL.

Do not retrieve schemas for several unfinished visualizations at once.

---

## 10. Configure the Visualization

Use:

```text
modules/<ModuleName>/instructions.md
modules/<ModuleName>/chartType.d.ts
```

to determine which configuration options are available.

Ask the user only about meaningful choices.

Explain options in simple language.

Example:

Instead of:

> Which `curve` should be used?

ask:

> How should the line look?
>
> - Straight
> - Smooth
> - Step-like

Translate the answer into the correct technical value.

The generated `chartConfig` must conform to `chartType.d.ts`.

Do not invent configuration properties.

---

## 11. Configure Filters

Filters are defined once per dashboard as **dimensions** and then **bound** to each chart's SQL parameters. There is no chart-local filter config.

Ask whether the dashboard requires filters.

Examples:

- Date from / date to
- Department
- User
- Category

### Step A — Declare dimensions (dashboard level)

Add each filter to the top-level `filters` array as a `FilterDimension`:

```json
{
  "filters": [
    {
      "id": "from",
      "label": "Von",
      "type": "dateString",
      "scope": "global"
    },
    {
      "id": "department",
      "label": "Abteilung",
      "type": "select",
      "scope": "tab",
      "tab": "Overview",
      "options": [{ "label": "Sales", "value": "sales" }]
    }
  ]
}
```

- `type`: `"string" | "number" | "dateString" | "dateRange" | "select"`.
- `scope`: `"global"` (all tabs) or `"tab"` (requires `tab` = the tab `trigger`).
- `options` is required for `"select"`; `defaultValue` is optional.

### Step B — Bind dimensions to a chart

On each component, map dimension ids to the SQL named parameters that chart uses:

```json
{
  "filterBindings": { "from": "from", "department": "department" }
}
```

Only add filters that are actually needed.

Filters must also be considered when generating SQL (Step 12): each bound dimension arrives as a named parameter (`:from`, `:department`), and unset filters are passed as `null`.

---

## 12. Generate SQL

Read:

```text
modules/<ModuleName>/chartDataSchema.ts
```

The SQL must transform the selected Databricks tables into exactly the data structure expected by the selected module.

Use:

- the user's visualization request
- the selected module
- the retrieved table schemas
- `chartDataSchema.ts`
- the configured filters (bound via `filterBindings`; referenced in SQL as named parameters like `:from`, and `null` when unset)

Do not modify the module data schema to make the SQL easier.

Adapt the SQL to the existing module contract.

Guard each bound parameter so an unset (`null`) filter does not restrict results, e.g. `(:from IS NULL OR col >= :from)`. For a multi-select drill parameter (comma-joined), use `(:p IS NULL OR array_contains(split(:p, ','), col))`.

Save the SQL using the same `chartID`:

```text
pagesConfig/sql/<chartID>.sql
```

Example:

```text
pagesConfig/sql/123456as.sql
```

---

## 13. Configure Layout

Ask how the visualization should be positioned on the current tab.

Determine:

- row
- width
- optional row height

`space` uses a 12-column grid.

Example:

```text
3  = 25%
6  = 50%
12 = 100%
```

Explain this in simple language.

Example:

> How wide should the chart be?
>
> - Small
> - Half width
> - Full width

Translate the answer into the appropriate `space` value.

---

## 14. Validate the Visualization

Before continuing with the next visualization, verify:

- An existing module was selected.
- A unique `chartID` was generated.
- `chartDescription` exists.
- All required table paths were provided.
- The table schemas were retrieved successfully.
- `chartConfig` matches `chartType.d.ts`.
- SQL uses only valid tables and columns from the retrieved schemas.
- SQL returns exactly the structure required by `chartDataSchema.ts`.
- Filters are reflected correctly in the SQL where required.
- Layout values are valid.

Only after these checks succeed is the visualization complete.

---

## 15. Continue With the Next Visualization

After one visualization is complete, continue with the next visualization in the dashboard structure.

Repeat the complete visualization workflow:

1. Understand the visualization.
2. Select the module.
3. Generate `chartID`.
4. Collect description and optional title.
5. Select Databricks tables.
6. Retrieve table schemas.
7. Configure the visualization.
8. Configure filters.
9. Generate SQL.
10. Configure layout.
11. Validate the visualization.

Do not mix unfinished visualizations.

---

## 16. Create DashboardConfig

After all visualizations are complete, build the full dashboard configuration.

The configuration must conform to the repository's `DashboardConfig` type: a top-level object with `reportName`, `filterLayout`, `filters`, and `tabs`.

Example:

```json
{
  "reportName": "Fleet Overview",
  "filterLayout": "sidebar",
  "filters": [
    { "id": "from", "label": "Von", "type": "dateString", "scope": "global" }
  ],
  "tabs": [
    {
      "trigger": "Overview",
      "rows": [
        {
          "height": 12,
          "components": [
            {
              "moduleName": "LineChartModule",
              "space": 6,
              "chartID": "123456as",
              "chartTitle": "Fleet activity",
              "chartDescription": "Shows how fleet activity changes over time.",
              "filterBindings": { "from": "from" },
              "chartConfig": {}
            }
          ]
        }
      ]
    }
  ]
}
```

One trigger may contain multiple rows and multiple modules. Omit `filterBindings` for charts without filters. Add optional `drill` on a component to enable cross-tab drill-down.

---

## 17. Save Dashboard Config

Save the finished `DashboardConfig` as JSON in:

```text
pagesConfig/
```

Example:

```text
pagesConfig/dacodaPageConfig.json
```

The filename should clearly belong to the dashboard.

---

## 18. Register Dashboard

Register the dashboard in:

```text
pagesConfig/pages.json
```

The file uses:

```ts
export type PagesConfig = {
  dashboardName: string;
  dashboardConfigName: string;
};
```

Example:

```json
[
  {
    "dashboardName": "DacoDa",
    "dashboardConfigName": "dacodaPageConfig.json"
  }
]
```

`dashboardName` is the visible dashboard name.

`dashboardConfigName` must exactly match the generated dashboard JSON filename.

Preserve all existing entries when adding another dashboard.

---

## 19. Final Validation

Before generating the page, verify:

- The dashboard has a name.
- All tabs have valid `trigger` values.
- All visualizations are complete.
- Every visualization has a unique `chartID`.
- Every required schema file exists.
- Every required SQL file exists.
- Every SQL file belongs to the correct `chartID`.
- Every module configuration is valid.
- The dashboard config is valid JSON.
- The dashboard config conforms to `DashboardConfig`.
- The dashboard is registered in `pagesConfig/pages.json`.

---

## 20. Generate the Page

After all configuration, schemas, and SQL files are complete and valid, use the repository's existing page generation process.

Run:

```bash
npm run pageConfig:generatePage
```

The generated Next.js page must be based on the configuration.

Normal dashboard creation must not:

- modify module implementations
- create page-specific chart components
- change module data contracts
- manually implement generated pages

If an existing module cannot represent the requested visualization, report that limitation instead of modifying the module automatically.

## Changing Previous Decisions

The user may change any previous decision while creating a visualization.

Until the visualization has been explicitly confirmed as complete, treat its
configuration as a draft.

If the user changes a previous decision:

1. Update the affected configuration.
2. Determine which later steps depend on that decision.
3. Re-run only the affected dependent steps.
4. Keep all unrelated decisions unchanged.
5. Continue the workflow from the current point.

Do not restart the complete visualization workflow unless the change makes the
existing visualization fundamentally invalid.

Examples:

- Changing line style only requires updating and validating `chartConfig`.
- Changing a filter may require updating the dashboard `filters` / a chart's `filterBindings` and SQL.
- Changing the selected data or grouping may require regenerating SQL and parts
  of `chartConfig`.
- Changing the module may require redoing the module configuration and SQL
  because the data contract can be different.

## Configure Layout

Do not ask the user for `space` values or grid column numbers.

Ask how visualizations should be arranged visually.

Examples:

- One visualization across the full row
- Two visualizations next to each other
- Three visualizations next to each other
- Four visualizations next to each other

For equally sized visualizations, translate the choice to:

- 1 visualization: `space: 12`
- 2 visualizations: `space: 6` each
- 3 visualizations: `space: 4` each
- 4 visualizations: `space: 3` each

If the user wants different widths, ask which visualization should receive more or less space and derive valid `space` values internally.

Do not describe `space` as a percentage unless the resulting rendered width is actually guaranteed to match that percentage.

Ask about row height separately. Do not combine width and height into the same question.

### Row Height

Do not ask the user for numeric `height` values or CSS units such as `svh`.

Ask for the desired visible height in simple terms.

Use these choices:

- Compact -> `height: 20`
- Normal -> `height: 30`
- Large -> `height: 40`
- Very large -> `height: 50`

Example question:

"How high should the chart be displayed?"

1. Compact - uses little vertical space
2. Normal - suitable for most charts
3. Large - gives the chart more room
4. Very large - uses a large part of the screen

Translate the user's choice into the corresponding numeric `height` value internally.

Do not mention `svh`, `Range1To100`, or the numeric configuration value unless the user explicitly asks for technical details.

Ask about height separately from chart width and arrangement.
