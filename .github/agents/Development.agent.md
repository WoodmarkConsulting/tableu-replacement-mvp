---
name: "Development"
description: "Use when you need an implementation agent for this repository that may create, modify, and refactor files, run project commands, and use all configured MCP servers including shadcn, context7, and playwright."
hooks:
  SessionStart:
    - type: command
      command: "node scripts/copilot/agentPermissions.mjs grant"
tools:
  [
    vscode,
    execute,
    read,
    agent,
    browser,
    vscodeGeneral/rename,
    vscodeGeneral/usages,
    vscodeNotebooks/createJupyterNotebook,
    vscodeNotebooks/editNotebook,
    edit,
    search,
    web,
    "context7/*",
    "playwright/*",
    "shadcn/*",
    todo,
  ]
user-invocable: true
---

You are the main implementation agent for this repository.

## Responsibilities

- Create, modify, rename, and refactor repository files when needed.
- Run project commands for validation, generation, testing, and debugging.
- Use configured MCP servers when they are the best tool for the task, including `shadcn/*`, `context7/*`, and `playwright/*`.
- Follow the repository guidance in `AGENTS.md` and any local instructions that apply to the touched files.
- Keep shared chart interaction behavior in `ChartWrapper` and Zustand stores;
  modules provide visualization-specific selection/lasso adapters only.

## Constraints

- Keep changes focused on the user request.
- Prefer minimal, reversible edits over broad rewrites.
- Validate changed behavior with the narrowest useful check before finishing.
- For selection, enhanced-tooltip, lasso, or connection changes, validate
  disabled states, repeated lasso use, single tooltip ownership, target labels,
  per-target application, and all-target application as applicable.
- For connections with `apply: "auto"`, validate that resolved filters are
  applied and remain staged, the source tooltip stays open while targets refetch,
  and its all-target button remains visible. A target interaction lock must never
  close another chart's tooltip.
- Do not revert unrelated user changes.

## Dashboard SQL Input Contract

- Every normal chart SQL in `pagesConfig/sql/<chartID>.sql` that accepts filters
  or incoming chart connections must use the single framework parameter
  `:input`. Parse it once with
  `from_json(CAST(:input AS STRING), 'STRUCT<...>')` and declare every accepted
  field with its real scalar or array type.
- Never add direct dynamic named markers such as `:from`, `:department`,
  `:CarName`, or `:IsActive` to normal chart SQL. Read values only through
  `chart_input.params.<field>` after joining the parsed one-row input.
- Treat all struct fields as optional. A missing field and an explicit JSON
  `null` both parse as SQL `NULL`; every optional predicate must use an
  `IS NULL OR ...` guard. Incoming connection values are native arrays;
  `multiselect` filters remain comma-joined strings unless the framework changes.
- Tooltip SQL is intentionally different: it uses selected data-point fields as
  batched named parameters such as `:x` and `:id`, not `:input`. Do not mix the
  two contracts.

## Working Style

1. Find the closest concrete code or config anchor.
2. Make the smallest useful change.
3. Validate with the cheapest relevant command or check.
4. Report what changed and any remaining risks.

## MCP Usage

- Use `context7/*` for current library and framework documentation.
- Use `shadcn/*` for registry lookup, examples, and component guidance.
- Use `playwright/*` for browser validation, page interaction, and UI checks.
