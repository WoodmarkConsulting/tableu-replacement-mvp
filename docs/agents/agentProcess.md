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

Filters are defined once per dashboard as **dimensions** and then **bound** to fields in each chart's JSON SQL input. There is no chart-local filter config.

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

On each component, map dimension ids to fields that the chart SQL declares in
its `:input` struct:

```json
{
  "filterBindings": { "from": "from", "department": "department" }
}
```

Only add filters that are actually needed.

Filters must also be considered when generating SQL (Step 12). The framework
collects every bound value and connection value into one JSON object and always
binds that object as `:input`. A field can be missing entirely or explicitly
`null`; both must behave as an unset filter.

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
- the configured filters (bound via `filterBindings`; declared as typed fields in the JSON `:input` struct)

Do not modify the module data schema to make the SQL easier.

Adapt the SQL to the existing module contract.

Every normal chart SQL that accepts filters or incoming chart connections must
use exactly one named parameter, `:input`. Parse it once with `from_json` and a
typed `STRUCT` containing every accepted field, then `CROSS JOIN` that one-row
input into the query. Never reference dynamic named markers such as `:from`,
`:department`, or a bound SQL field name directly.

Example:

```sql
WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<`from`: STRING, department: STRING, CarName: ARRAY<STRING>>'
  ) AS params
)
SELECT ...
FROM source
CROSS JOIN chart_input
WHERE (
  chart_input.params.`from` IS NULL
  OR DATE(source.created_at) >= CAST(chart_input.params.`from` AS DATE)
)
AND (
  chart_input.params.CarName IS NULL
  OR array_contains(chart_input.params.CarName, source.CarName)
)
```

Choose each struct type from the actual client value shape. Filter values are
normally scalar; `multiselect` currently arrives as a comma-joined `STRING` and
must be expanded with `split`. Incoming connection values arrive as native JSON
arrays and must be declared as `ARRAY<...>`. Missing fields and explicit JSON
`null` both become SQL `NULL`, so guard every optional field with
`chart_input.params.<field> IS NULL`. A chart without filters or incoming
connections may ignore the framework's unused `:input` parameter.

This rule applies only to normal chart SQL in `pagesConfig/sql/<chartID>.sql`.
Tooltip SQL uses the separate batched data-point contract in Step 13.

Save the SQL using the same `chartID`:

```text
pagesConfig/sql/<chartID>.sql
```

Example:

```text
pagesConfig/sql/123456as.sql
```

---

## 13. Configure the Selection Tooltip

Every visualization that enables `enhancedTooltip` or acts as the source of a
chart connection requires a tooltip query. The same endpoint supports a clicked
point, a lasso selection, reopening details from the right-click menu, and
resolving outgoing connection values.

Ask the user which information should be shown for selected rows when the
detail tooltip opens after a click, lasso selection, or context-menu action.
Use simple, visible examples based on the visualization, such as:

```text
What should the tooltip show for a point in this chart?

1. Date and active users
2. Date, active users, and department
3. Other information
```

Do not decide the tooltip contents without the user.

Before writing the tooltip SQL, analyze all of the following for the selected
module and visualization:

- `modules/<ModuleName>/chartDataSchema.ts`, which defines the chart data
- `modules/<ModuleName>/index.tsx`, specifically the original rows reported by
  click selection or the registered lasso adapter and any direct tooltip call
- `pagesConfig/sql/<chartID>.sql`, which defines how source rows are transformed
  into chart rows
- the retrieved source table schemas

The tooltip route converts every property of the sent `dataPoint` into a named
SQL parameter with the same name. The tooltip SQL must use those exact names.
For example, if the module sends `{ x, y }`, the available parameters are `:x`
and `:y`. Use the identifying parameter such as `:x` to find the source data
for exactly the selected chart rows. Do not assume that displayed chart series
names or source column names are available as parameters unless they are
actually present in the sent `dataPoint`.

Each tooltip endpoint invocation batches every selected data point into one
request and one Databricks query. It groups properties by name and serializes
every group as a JSON array. This applies to a single click as well as lasso or
multi-selection. Tooltip SQL must therefore parse every used parameter with
`from_json`. A visible enhanced tooltip and connection resolution can invoke
the endpoint separately, but neither may issue one query per selected row.

Derive the element type from `chartDataSchema.ts` and the actual `dataPoint`:

- scalar `x: number` becomes `ARRAY<DOUBLE>`
- scalar `name: string` becomes `ARRAY<STRING>`
- array `y: number[]` becomes `ARRAY<ARRAY<DOUBLE>>`

For example, when `x` is a number, use:

```sql
from_json(CAST(:x AS STRING), 'ARRAY<DOUBLE>')
```

Use the Databricks SQL type that matches the real value. Do not assume that all
arrays contain numbers or that every module sends the same data-point shape.
Never generate one tooltip request or one SQL query per selected row.

### Parameter Shape Contract

For every filter or chart connection, trace one representative value through
the complete path before finalizing SQL:

```text
source column -> source SQL result -> API JSON -> client request parameter -> target SQL -> target column
```

At each boundary, record whether the value is:

- a scalar such as `"167-5188"`
- a native array such as `["167-5188", "167-5516"]`
- a delimited string such as `"167-5188,167-5516"`
- a JSON string representing an array such as
  `"[\"167-5188\",\"167-5516\"]"`

Tooltip input parameters always use the last form because they are batched.
For one selected point, the array contains one element. For 1,000 selected
points, the same parameter contains 1,000 elements and still produces exactly
one tooltip SQL execution.

These shapes are not interchangeable. JSON serialization does not split a
delimited string into separate values. In particular, this request is invalid
when the target compares one `CarName` at a time:

```json
{
  "CarName": "[\"167-5188,167-5516\",\"167-4439\"]"
}
```

The inner CSV strings must first be normalized into atomic values. Prefer doing
this in the source SQL so Databricks returns a real array:

```sql
SELECT array_sort(collect_set(trim(raw_value))) AS CarName
FROM source_rows
LATERAL VIEW explode(split(csv_column, ',')) AS raw_value
WHERE csv_column IS NOT NULL
  AND trim(raw_value) <> ''
```

The resulting API value must have this shape:

```json
{
  "CarName": ["167-4439", "167-5188", "167-5516"]
}
```

When the client applies that connection, the array becomes a field of the
target chart's JSON `:input`. Target SQL must declare the same element type:

```sql
chart_input.params.CarName IS NULL
OR array_contains(chart_input.params.CarName, trim(CAST(CarName AS STRING)))
```

For chart connections, every mapping must meet all of these conditions:

- Its `sourceField` is returned by the source tooltip SQL with exactly that alias.
- Its returned value is a scalar or an array of atomic values, never an array
  whose elements still contain delimited lists.
- Its `targetDimensionId` names a `multiselect` dimension in `DashboardConfig.filters`.
- The target chart binds that dimension in `filterBindings`, and the target chart
  SQL declares the bound SQL field in its typed `:input` struct.
- A representative source value, after normalization, equals a representative
  target-column value under the actual comparison expression.

Do not consider the SQL complete until this end-to-end example succeeds by
inspection or, when query execution is available, with actual query results.

If the selected module cannot report original rows through click selection or a
lasso adapter, explain that it does not currently support this selected-row
tooltip workflow. Do not create tooltip SQL that cannot be called, and do not
modify the module during normal dashboard creation.

Write a separate tooltip query that:

- uses only tables and columns from the retrieved schemas
- reverses or mirrors the transformation in the chart SQL as needed to identify
  the selected rows
- returns only the information requested by the user
- formats technical values for display, for example dates as `dd.MM.yyyy`
- gives every result column a concise, human-readable alias

Choose aliases that `formatLabel` can turn into visible labels, for example
`datum` and `aktive_nutzer`, which become `Datum` and `Aktive Nutzer`. Return
display-ready values so a result can be read as:

```text
Datum          30.07.2024
Aktive Nutzer  1
```

Save this SQL as:

```text
pagesConfig/sql/tooltipSql/<chartID>.tooltip.sql
```

Example:

```text
pagesConfig/sql/tooltipSql/123456as.tooltip.sql
```

The tooltip SQL filename must use the same `chartID` as the visualization.

### Runtime behavior supplied by `ChartWrapper`

Do not implement tooltip, lasso, or connection-menu UI in a dashboard page or
module. `ChartWrapper` provides it consistently:

- `enhancedTooltip: true` enables the selected-row detail tooltip.
- A successful lasso selection opens the tooltip and leaves lasso mode active
  for another gesture. Starting a new valid gesture closes the previous tooltip.
- Right-click **Tooltip anzeigen** reopens details for the current selection and
  is disabled without selected rows or when `enhancedTooltip` is false.
- Right-click **Verlinktes Diagramm filtern** is disabled until outgoing
  connection values resolve. Choosing one target applies that target immediately.
- The tooltip footer button applies the staged values to all linked targets.
- Tooltip state belongs to its source `chartID`; only that wrapper renders the card.
- Target menu labels come from `chartTitle` across all configured tabs. Require a
  useful title for connected targets; never expose `chartID` as user-facing text.

---

## 14. Configure Chart Connections

After the relevant visualizations are complete, ask whether selecting data in
one chart should filter another chart. Present source and target choices using
their visible titles, not their internal IDs.

For each source chart with outgoing connections, also ask whether resolved
connection filters should be applied manually or automatically. Manual is the
default and requires no property. For automatic application, set
`apply: "auto"` on the connection object itself. Automatic
application must keep the resolved filters staged: target refetches must not
close the source tooltip, and its all-target button remains visible.

For every requested link:

1. Confirm that the source module supports selection.
2. Resolve the selected titles to `fromChartID` and `toChartID` internally.
3. Give the connection a non-empty, dashboard-unique `id`.
4. Add one `mappings` entry per linked value with a `sourceField` alias and a
   `targetDimensionId` naming a `multiselect` dimension in `filters`.
5. Return those values from the source tooltip SQL using the exact aliases.
6. Bind the target dimension in the target chart's `filterBindings` and add the
   matching optional field to the target chart SQL's typed `:input` struct. A
   missing or `null` field must not restrict the target query.
7. Normalize delimited source strings into atomic values before returning them.
8. Verify one representative value through source row, tooltip result, API JSON,
   client filter, target SQL parser, and target column comparison.

Example:

```json
{
  "id": "active-users-to-fleets",
  "fromChartID": "active-users-over-time",
  "toChartID": "cumulative-fleets",
  "mappings": [
    {
      "sourceField": "fleet_creation_date",
      "targetDimensionId": "fleet_creation_date"
    }
  ]
}
```

The source tooltip SQL must return `fleet_creation_date`; the target chart must
bind the `fleet_creation_date` dimension and declare that SQL field in its
`:input` struct. A `multiselect` value arrives as a comma-joined `STRING`, so
compare it with `array_contains(split(...), column)`. Multiple links from one
source are allowed.

Connection example with automatic application:

```json
{
  "id": "active-users-to-fleets",
  "fromChartID": "active-users-over-time",
  "toChartID": "cumulative-fleets",
  "apply": "auto",
  "mappings": [
    {
      "sourceField": "fleet_creation_date",
      "targetDimensionId": "fleet_creation_date"
    }
  ]
}
```

---

## 15. Configure Layout

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

## 16. Validate the Visualization

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
- When `enhancedTooltip` or an outgoing connection is used, the user selected
  the tooltip contents and the required connection values are included.
- The sent tooltip `dataPoint` and its available parameter names were verified
  in the selected module implementation.
- `pagesConfig/sql/tooltipSql/<chartID>.tooltip.sql` exists, uses only available
  data-point parameters, and returns the requested display-ready values with
  readable aliases.
- Serialized array or object parameters are converted from JSON using types
  that match the module's data schema.
- Tooltip SQL treats every input parameter as a batched JSON array, including
  single-click requests, and does not execute once per selected row.
- Every connection parameter passed an end-to-end shape check from source value
  through target comparison.
- Connected targets have useful `chartTitle` values for the context menu.
- A connection target is listed once even when multiple columns bind to it.
- Delimited source strings were normalized before array serialization; no
  request array contains elements that are themselves comma-separated lists.
- Layout values are valid.

Only after these checks succeed is the visualization complete.

---

## 17. Continue With the Next Visualization

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
10. Configure the selection tooltip and generate its SQL when required.
11. Configure chart connections when requested.
12. Configure layout.
13. Validate the visualization.

Do not mix unfinished visualizations.

---

## 18. Create DashboardConfig

After all visualizations are complete, build the full dashboard configuration.

The configuration must conform to the repository's `DashboardConfig` type: a top-level object with `reportName`, `filters`, `tabs`, and optional `connections`.

Example:

```json
{
  "reportName": "Fleet Overview",
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
  ],
  "connections": [
    {
      "id": "fleet-activity-to-cumulative",
      "fromChartID": "123456as",
      "toChartID": "789012bc",
      "mappings": [
        {
          "sourceField": "fleet_creation_date",
          "targetDimensionId": "fleet_creation_date"
        }
      ]
    }
  ]
}
```

One trigger may contain multiple rows and multiple modules. Omit `filterBindings` for charts without filters and `connections` when no chart links are configured.

---

## 19. Save Dashboard Config

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

## 20. Register Dashboard

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

## 21. Final Validation

Before generating the page, verify:

- The dashboard has a name.
- All tabs have valid `trigger` values.
- All visualizations are complete.
- Every visualization has a unique `chartID`.
- Every required schema file exists.
- Every chart SQL file exists and belongs to the correct `chartID`.
- Every tooltip SQL file exists at
  `pagesConfig/sql/tooltipSql/<chartID>.tooltip.sql` and belongs to the correct
  `chartID`.
- Every tooltip SQL uses parameters provided by the data point that its module
  sends and returns the information requested by the user with readable labels.
- Every chart connection has a unique `id`, `mappings` whose `sourceField`
  matches a source tooltip alias, atomic runtime values, a `multiselect`
  `targetDimensionId` bound by the target chart, and matching target `:input`
  struct fields and SQL types.
- Every connected target has a user-facing `chartTitle`; menu labels are never
  derived from internal chart IDs.
- When browser validation is available, each single-target action refetches only
  the chosen chart with connection parameters and the tooltip footer applies all
  staged targets.
- Every module configuration is valid.
- The dashboard config is valid JSON.
- The dashboard config conforms to `DashboardConfig`.
- The dashboard is registered in `pagesConfig/pages.json`.

---

## 22. Generate the Page

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
  of `chartConfig`, then rechecking the tooltip parameters and tooltip SQL.
- Changing the tooltip contents requires updating and validating only the
  tooltip SQL unless the requested information cannot be identified from the
  currently sent data point.
- Changing the module may require redoing the module configuration and SQL
  because the data contract and sent tooltip data point can be different.

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
