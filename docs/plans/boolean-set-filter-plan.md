# Plan: `booleanSet` Filter (Boolean Expressions over ARRAY Columns)

A new filter dimension `type: "booleanSet"` that lets users build an arbitrarily
nested AND/OR/NOT expression over a value list and filters rows whose
`ARRAY<STRING>` column satisfies that expression — e.g. `((A UND B) ODER NICHT C)`.

## Context & Goals

- **Source shape:** one row carries a single `ARRAY<STRING>` column (e.g. `tags`).
  `A AND B` means *this row's array contains both A and B*.
- **Expression power:** arbitrary nesting, with negation available on individual
  values *and* on groups.
- **Authoring:** a visual group builder — values are picked from a combobox fed by
  static `options` or a warehouse `optionsSource`. No free-text SQL, ever.
- **Delivery:** the expression must reach chart SQL through the existing single
  `:input` JSON object, with no string concatenation into the query.

## Constraints & Non-Goals

**Constraints**

- Values are never interpolated into SQL text. The only SQL marker stays `:input`
  (see `AGENTS.md`, "Filtering framework").
- Databricks/Spark SQL cannot recurse over an arbitrary-depth JSON tree, so the
  wire format must be flat and fixed-depth.
- Edits go into the draft layer; charts fetch only after **Anwenden**
  (`stores/filterProvider.ts`, `components/FilterActions/index.tsx`).
- `FilterValue` is a global type in `types/filters.d.ts`; widening it touches every
  exhaustive switch over filter types.

**Non-goals (v1)**

- Chart connections targeting a `booleanSet` dimension.
- Tab jumps / drilldowns targeting a `booleanSet` dimension.
- `composition` rules (union/intersect merging of multiple producers).
- Long-format (one row per value) or multi-boolean-column sources.
- Expressions spanning more than one array column per dimension.

## Proposed Approach

### Decision: normalize to DNF client-side, ship a flat term list to SQL

Two candidate wire formats were considered:

| Option | Verdict |
| --- | --- |
| Ship the literal expression tree as JSON and evaluate it in SQL | **Rejected.** Spark SQL has no recursion; only a fixed nesting depth could be supported, which contradicts "arbitrary nesting". |
| Build the SQL predicate server-side from a validated AST | **Rejected.** Breaks the `:input`-only contract and re-introduces query-construction surface for user-supplied strings. |
| **Normalize the AST to Disjunctive Normal Form and ship a flat term list** | **Chosen.** |

Every boolean expression over atoms — including NOT at any depth — reduces to an
OR of AND-terms. With negation pushed down via De Morgan, each term is exactly
`{ include: string[], exclude: string[] }`. That is flat, fixed-depth, evaluable
with Spark higher-order functions, and keeps the builder's nesting unrestricted.

**Trade-off:** DNF expands multiplicatively (`(a OR b) AND (c OR d) AND (e OR f)`
→ 8 terms). Mitigated by a hard cap of **10 terms**, enforced *in the builder* —
actions that would push the expression over the cap are disabled, so the user
never reaches an unsubmittable state.

### Wire format

Bound as a JSON **string** inside the `:input` object, so
`ResolvedChartFilters["params"]` keeps its `string | number | null` type:

```jsonc
// value of the bound input field
"[{\"include\":[\"A\",\"B\"],\"exclude\":[]},{\"include\":[],\"exclude\":[\"C\"]}]"
```

`null` means "no filter".

### Chart SQL contract

```sql
WITH chart_input AS (
  SELECT from_json(CAST(:input AS STRING), 'STRUCT<tag_expr: STRING>') AS params
),
tag_expr AS (
  SELECT from_json(
    params.tag_expr,
    'ARRAY<STRUCT<include: ARRAY<STRING>, exclude: ARRAY<STRING>>>'
  ) AS terms
  FROM chart_input
)
SELECT ...
FROM source
CROSS JOIN tag_expr
WHERE tag_expr.terms IS NULL
   OR exists(tag_expr.terms, t ->
        forall(t.include, v -> array_contains(source.tags, v))
        AND forall(t.exclude, v -> NOT coalesce(array_contains(source.tags, v), false))
      )
```

NULL/empty-array semantics (per decision):

- `array_contains(NULL, v)` yields `NULL`, so a NULL or empty array **never**
  satisfies an `include` term → the row is excluded.
- The `coalesce(..., false)` on the exclude side makes "column is NULL" **satisfy**
  an exclude term — a row with no tags does not have the excluded tag.

### Resolution semantics

`booleanSet` is deliberately **not** added to `enumerableTypes`. It falls into the
existing "all producers must agree" branch of `resolveChartFilters`, which compares
`JSON.stringify(contribution.value)`. Two differing expressions on one dimension →
`markConflict()` → the chart renders the conflict state with removable chips
instead of querying. This matches `string`/`number` behaviour and needs no new
merge logic.

Additionally: if DNF normalization removes *every* term (each term contained a
value in both `include` and `exclude`, i.e. the expression is unsatisfiable), the
resolver marks a conflict rather than emitting an empty term list — an empty list
would otherwise read as "match nothing" silently.

## Implementation Plan

### Task 1 — Types and structural guards

**Objective:** Make `booleanSet` a first-class `FilterType` and teach the shared
guards about its value shape.

**Files**

- `types/filters.d.ts`
- `lib/filters/contributions.ts`

**Contracts**

```ts
type BooleanSetNode =
  | { kind: "value"; value: string; negated?: boolean }
  | { kind: "group"; op: "and" | "or"; negated?: boolean; children: BooleanSetNode[] };

type BooleanSetExpression = Extract<BooleanSetNode, { kind: "group" }>;

type FilterType = ... | "booleanSet";
type FilterValue = string | number | null | DateRangeValue | string[] | BooleanSetExpression;
```

- `isBooleanSetShape(value): value is BooleanSetExpression` — recursive structural
  check; root must be a group.
- `isFilterValueShape` accepts it (today it falls through to `isDateRangeShape`,
  which requires exactly `from`/`to` keys and would reject it).
- `isEmptyFilterValue` returns `true` for a root group with zero children
  (today's `value.from === null` check would wrongly report it as non-empty).
- `matchesDimensionType` gains a `case "booleanSet"` (the `default` branch
  currently demands `typeof value === "string"`).

**Acceptance criteria**

- A `booleanSet` contribution survives `isFilterContributionShape` round-tripping.
- An empty root group is treated as "no filter" by `isEmptyFilterValue`.
- `pnpm exec tsc --noEmit` shows no *new* errors beyond the documented baseline.

---

### Task 2 — DNF normalizer

**Objective:** Pure, dependency-free conversion from expression tree to capped DNF.

**Files**

- `lib/filters/booleanSet.ts` (new)

**Contracts**

```ts
export type DnfTerm = { include: string[]; exclude: string[] };

export const MAX_DNF_TERMS = 10;

// null => unsatisfiable (every term self-contradictory)
export function normalizeToDnf(expr: BooleanSetExpression): DnfTerm[] | null;

// Term count the expression would expand to; used to gate builder actions.
export function countDnfTerms(expr: BooleanSetExpression): number;

// Every group has >=1 child and every value node has a non-empty value.
export function isBooleanSetComplete(expr: BooleanSetExpression): boolean;

// "(A und B) oder nicht C" — chips, summaries, print/export.
export function formatBooleanSet(
  expr: BooleanSetExpression,
  options?: FilterOption[],
): string;
```

Normalization steps: push negations down (De Morgan, flipping `and`/`or` and
double-negation), distribute AND over OR, dedupe + sort values inside each term,
drop terms where `include ∩ exclude ≠ ∅`, dedupe identical terms.

**Acceptance criteria**

- `((A AND B) OR NOT C)` → `[{include:[A,B],exclude:[]},{include:[],exclude:[C]}]`.
- `NOT (A OR B)` → `[{include:[],exclude:[A,B]}]`.
- `NOT (A AND B)` → `[{include:[],exclude:[A]},{include:[],exclude:[B]}]`.
- `A AND NOT A` → `null` (unsatisfiable).
- `countDnfTerms` matches `normalizeToDnf(...).length` for all satisfiable inputs.
- Output ordering is deterministic (stable `JSON.stringify` for snapshot equality).

---

### Task 3 — Resolver and SQL serialization

**Objective:** Emit the DNF JSON string into `params`, and conflict on unsatisfiable.

**Files**

- `lib/filters/resolveChartFilters.ts`

**Changes**

- `serializeValue`: `case "booleanSet"` → `JSON.stringify(normalizeToDnf(value))`,
  or `null` when the expression is empty.
- In the resolve loop, when `normalizeToDnf` returns `null`, call `markConflict()`
  and `continue`.
- Do **not** add `booleanSet` to the enumerable type list — the existing
  "distinct.size !== 1" branch already gives the agreed conflict behaviour.

**Acceptance criteria**

- Single control contribution → one JSON string param, keys in fixed order.
- Empty expression → param is `null`, chart queries unfiltered.
- Unsatisfiable expression → `impossible: true`, dimension listed in `conflicts`,
  its contribution key in `conflictKeys`.
- Two differing expressions on one dimension → conflict, no param emitted.

---

### Task 4 — Config validation

**Objective:** Reject misconfigured `booleanSet` dimensions at generation time.

**Files**

- `lib/validateDashboardConfig.ts`
- `lib/filterDimensions.ts`

**Rules**

- A `booleanSet` dimension must declare `options` or `optionsSource`.
- `defaultValue`, if present, must pass `isBooleanSetShape`, `isBooleanSetComplete`,
  and `countDnfTerms(...) <= MAX_DNF_TERMS`.
- A chart connection mapping or tab jump mapping targeting a `booleanSet`
  dimension throws (v1 non-goal — add `"booleanSet"` to `undrillableTypes` and to
  the connection target check next to the existing multiselect requirement).

**Acceptance criteria**

- `npm run pageConfig:generatePage` fails with a named, actionable message for each
  rule above.
- Existing dashboards in `pagesConfig/` still generate unchanged.

---

### Task 5 — Group builder UI

**Objective:** A recursive tree editor that cannot produce an over-cap expression.

**Files**

- `components/FilterControl/BooleanSetBuilder.tsx` (new)
- `components/ui/toggle-group.tsx`, `components/ui/toggle.tsx`,
  `components/ui/scroll-area.tsx` (new, vendored from `@shadcn`)

**shadcn components**

Reused from `components/ui/`: `popover` (builder surface), `button` (trigger,
add/remove actions), `command` (value picker), `tooltip` (cap explanation),
`badge` (chip), `separator`, `label`, `spinner`.

To be added:

| Component | Purpose |
| --- | --- |
| `toggle-group` (+ `toggle`) | Per-group `UND`/`ODER` switch in `type="single"` mode; per-node "nicht" negation toggle with real pressed state |
| `scroll-area` | Bounded, scrollable container — deep nesting overflows the popover |

The existing `option` filter type builds its segmented control from
`radio-group`. `toggle-group` is used here instead: a group operator is a mode
switch, not a form value, and the compact toggle reads better inline. The
divergence is intentional.

**Behaviour**

- Trigger `Button` in the filter bar renders `formatBooleanSet(...)` (or
  `"Kein Filter"`); the editor opens in a `Popover`.
- Each group row: `ToggleGroup` for `UND`/`ODER`, a `Toggle` for "nicht",
  `+ Wert`, `+ Gruppe`, and remove. Nested groups render indented and recursively
  inside a `ScrollArea`.
- Each value row: searchable combobox (reuse the `Command` pattern and the
  `MAX_VISIBLE_OPTIONS = 100` truncation already in `components/FilterControl/index.tsx`),
  a `Toggle` for "nicht", and remove.
- Options come from `hooks/useFilterOptions.ts`; static `options` are the fallback
  while warehouse options load.
- **Permissive validation:** a value already present in the expression is retained
  and rendered even if it is absent from the loaded option set (restored
  permalinks must not silently lose values); it is shown with its raw value as
  label.
- **Cap enforcement:** `+ Wert` / `+ Gruppe` are disabled when the resulting
  `countDnfTerms` would exceed `MAX_DNF_TERMS`, with a tooltip explaining the
  10-term limit.

**Acceptance criteria**

- Nesting depth is unrestricted as long as the term cap holds.
- Disabled add-actions re-enable after the user removes a branch.
- Every mutation calls `onChange` with a fresh immutable tree (no in-place edits).

---

### Task 6 — FilterControl wiring and the Apply gate

**Objective:** Surface the builder as a normal control and prevent applying an
incomplete expression.

**Files**

- `components/FilterControl/index.tsx`
- `stores/filterProvider.ts`
- `components/FilterActions/index.tsx`

**Changes**

- `case "booleanSet"` in the `FilterControl` switch renders `BooleanSetBuilder`.
- New selector in `stores/filterProvider.ts`, alongside `isDirty`:

```ts
export const hasIncompleteDraft = (state: FilterStoreState): boolean;
```

  It walks `draftContributions`, looks each `dimensionId` up in `state.dimensions`
  (the store already holds them), and returns `true` when any `booleanSet` value
  fails `isBooleanSetComplete`.
- `FilterActions`: `canApply = (dirty || !hasApplied) && !incomplete`, plus a short
  hint (`"Unvollständiger Ausdruck"`) when blocked.

**Acceptance criteria**

- A group with zero children, or a value row with no value picked, disables
  **Anwenden** and shows the hint.
- Completing or removing the offending node re-enables **Anwenden**.
- Charts still never fetch before the first Apply.

---

### Task 7 — Chips, print/export, snapshots

**Objective:** Represent the expression everywhere existing filter values appear.

**Files**

- `components/ActiveFilters/index.tsx`
- `hooks/useShareFilters.ts`, `hooks/useFilterUrlSync.ts`
- `app/api/filters/snapshot/**`

**Changes**

- `formatValue` gains a `booleanSet` branch delegating to `formatBooleanSet`, so
  one chip represents the whole dimension: `Tags: (A und B) oder nicht C`. Truncate
  with a `title` attribute carrying the full string; the chip is already the
  print/export summary and must remain readable unexpanded.
- Snapshot persistence needs no schema change (v2 already stores arbitrary
  `FilterValue`), but the server-side snapshot validation path must accept the new
  shape via the updated `isFilterValueShape` / `matchesDimensionType`.
- Confirm restore is **permissive**: values absent from the current option set are
  preserved, not dropped.

**Acceptance criteria**

- Removing the chip clears the expression and re-queries immediately (existing
  `removeContribution` bypass of the Apply gate).
- A shared permalink reproduces the exact expression and auto-applies.
- Print preview shows the full expression text.

---

### Task 8 — Reference dashboard and SQL

**Objective:** An end-to-end example and a copy-paste SQL template.

**Files**

- `pagesConfig/booleanSetTest.json` (new), registered in `pagesConfig/pages.json`
- `pagesConfig/sql/<chartID>.sql` (new), using the snippet above
- `pagesConfig/sql/filterOptions/<id>.sql` (new), returning the distinct array
  values via `explode`

**Acceptance criteria**

- `npm run pageConfig:generatePage` produces the page.
- The chart returns different row counts for `A AND B`, `A OR B`, and `NOT A`.
- Rows with a NULL tag array appear only for exclude-only terms.

---

### Task 9 — Documentation

**Objective:** Keep the agent-facing contracts authoritative.

**Files**

- `AGENTS.md` — add `booleanSet` to the `type` list; add a "SQL for `booleanSet`"
  section mirroring the `multiselect` one; note the 10-term cap and the v1
  non-goals (no connections, no tab jumps, no composition).
- `README.md` — same, user-facing.
- `.github/agents/Dashboard.agent.md`, `.github/agents/Development.agent.md`,
  `docs/agents/agentProcess.md` — document the JSON-string binding so generated
  SQL uses the correct `from_json` shape.

**Acceptance criteria**

- Each doc states: values arrive as a JSON string of
  `ARRAY<STRUCT<include: ARRAY<STRING>, exclude: ARRAY<STRING>>>`, and `NULL`
  means no filter.

## Testing & Validation

**Unit (`tests/booleanSet.test.ts`, new)**

- De Morgan / double negation / distribution cases from Task 2.
- Unsatisfiable detection; term dedupe; deterministic ordering.
- `countDnfTerms` agrees with `normalizeToDnf().length`.
- `formatBooleanSet` label resolution and negation rendering.

**Unit (`tests/unifiedFilterDomain.test.ts`, extend)**

- `serializeValue` output for a known expression (exact JSON string).
- Unsatisfiable expression → conflict, not an empty param.
- Two differing expressions → conflict.
- Empty expression → `null` param.

**Unit (`tests/generateNextPage.test.ts`, extend)**

- Each Task 4 validation rule throws with its expected message.

**Component**

- Builder: add/remove/nest/negate; cap disables add-actions; unknown restored
  value survives; incomplete expression disables **Anwenden**.

**E2E (`tests/e2e/`)**

- Build `((A AND B) OR NOT C)` on the reference dashboard, Apply, assert the chip
  text and that the chart row count matches a fixture.
- Share the permalink, reload, assert the expression and results are restored
  without pressing Apply.

**Commands**

- `pnpm exec vitest run`
- `pnpm exec eslint .` — must stay at the single known `react-hooks` warning.
- `pnpm exec tsc --noEmit` — compare against the documented baseline error count.

**Observability**

- Log the DNF term count on the chart query path so over-wide expressions are
  visible if the cap is ever raised.

## Open Questions / Decisions Needed

All blocking questions were answered:

| Question | Decision |
| --- | --- |
| Data shape | Single `ARRAY<STRING>` column per row |
| Nesting | Arbitrary depth |
| Negation | Per-value **and** per-group |
| UI | Visual group builder in a popover, triggered from the filter bar |
| Wire format | DNF term list, JSON string inside `:input` |
| Type name | `booleanSet` |
| DNF cap | 10 terms, enforced by disabling builder actions |
| Two producers | Conflict state, no query |
| Value validation | Permissive — options drive the picker, chosen values survive restore |
| Chip | One chip, compact expression string |
| Incomplete groups | Block **Anwenden** |
| NULL arrays | Never satisfy include; do satisfy exclude |

Remaining, non-blocking:

1. Should the cap be configurable per dimension (`maxTerms`) later, or stay a
   framework constant? Plan assumes constant.
2. Do any real source tables store tags as a delimited string rather than a true
   array? If so, a per-dimension note on the SQL template (`split(col, ',')`
   before the higher-order functions) is enough — no framework change.
