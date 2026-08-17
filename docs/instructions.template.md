# `<ModuleName>` Instructions

## 1. Purpose

Describe what this module renders and what it is intended to be used for.

Include:

- What kind of visualization or component this module provides.
- Typical use cases.
- Important limitations.
- When this module should be preferred over similar modules.

Example:

`<ModuleName>` renders `<short description>`.

Use this module when `<use case>`.

Do not use this module when `<limitation or alternative>`.

---

## 2. Module Files

The module consists of the following required files:

```text
modules/<ModuleName>/
├── index.tsx
├── chartDataSchema.ts
├── chartType.d.ts
└── instructions.md
```

### `index.tsx`

Contains the module implementation.

The file must have a default export.

### `chartDataSchema.ts`

Defines and validates the data format expected from the API.

The file must have a default export.

### `chartType.d.ts`

Contains the configuration type for this module.

The file must contain exactly one type declaration.

### `instructions.md`

Contains the usage instructions for this module.

---

## 3. Data Contract

Describe the exact data format expected by this module.

### Data Type

```ts
<Insert the data type here>
```

### Data Structure

Describe every field.

#### `<fieldName>`

Type:

```ts
<type>
```

Description:

`<description>`

Rules:

- `<rule>`
- `<rule>`

Repeat this subsection for every field.

### Example API Response

```json
<Insert a valid API response example>
```

### Data Rules

Document all rules that the API response must follow.

For example:

- `<field>` must always be present.
- `<field>` may contain `null`.
- Array indexes have a specific meaning.
- Dates must use Unix timestamps in milliseconds.
- Values must use a specific unit.
- Data must be sorted before being passed to the module.

If no special rules exist, explicitly state:

`There are no additional data rules.`

---

## 4. Configuration

The module is controlled through its configuration object.

The complete configuration type is defined in:

```text
chartType.d.ts
```

### Configuration Type

```ts
<Insert the complete configuration type or a simplified readable version>
```

---

## 5. Configuration Reference

Document every configurable property.

The structure in this section must follow the actual configuration object hierarchy.

### `<property>`

Type:

```ts
<type>
```

Required:

`yes | no`

Description:

`<description>`

Example:

```ts
<example value>
```

Allowed values:

```text
<allowed values if applicable>
```

Behavior:

- `<explain what changing this value does>`
- `<important interaction with another property>`

Repeat this section recursively for all relevant configuration properties.

For nested configuration objects, use nested headings.

Example:

### `xAxis`

Description of the complete `xAxis` object.

#### `xAxis.show`

Type:

```ts
boolean;
```

Required:

`yes`

Description:

Controls whether the X axis is visible.

Example:

```ts
true;
```

---

## 6. Configuration Rules

Document relationships and restrictions that cannot be understood from the TypeScript type alone.

Examples:

- `seriesIndex` is zero-based.
- A configured series must have a corresponding value in the API response.
- `opacity` must be between `0` and `1`.
- Certain options may only be used together.
- Some combinations are invalid.
- A configuration property may affect the required API data.

If no additional restrictions exist, explicitly state:

`There are no additional configuration rules.`

---

## 7. Complete Configuration Example

Provide at least one complete and valid configuration.

```ts
const chartConfig: <ConfigType> = {
  // Complete valid configuration
};
```

The example must be usable without adding missing required properties.

---

## 8. Data and Configuration Relationship

Explain how the configuration maps to the API data.

This section is especially important when configuration values reference positions, keys, indexes, series, categories, columns, or other parts of the API response.

Example:

```text
API response:

{
  "x": 1782864000000,
  "y": [12, 9]
}

Configuration:

seriesIndex: 0 -> y[0] -> 12
seriesIndex: 1 -> y[1] -> 9
```

Document all similar relationships used by this module.

If the configuration does not reference the API data structure directly, state that explicitly.

---

## 9. Usage

Describe how this module is used by the application.

### Import

```ts
import <ModuleName> from "@/modules/<ModuleName>";
```

### Minimal Example

```tsx
<Insert the smallest valid usage example>
```

### Complete Example

```tsx
<Insert a realistic complete usage example>
```

---

## 10. Expected Props

Document the props that are relevant when this module is instantiated.

Do not repeat framework-internal details that developers or agents do not need to configure manually.

### `<propName>`

Type:

```ts
<type>
```

Description:

`<description>`

Source:

`<configuration | API data | wrapper | application>`

Repeat for every relevant prop.

---

## 11. Runtime Behavior

Describe important behavior that happens inside the module.

Examples:

- Data transformations.
- Formatting.
- Sorting.
- Aggregation.
- Conversion between API data and library-specific data.
- Memoization.
- Fallback behavior.
- Conditional rendering.
- Handling of `null` values.

Do not describe every implementation detail.

Only document behavior that is important for correctly configuring or using the module.

---

## 12. Validation and Errors

Document conditions that cause validation errors or runtime errors.

### `<Error condition>`

Cause:

`<description>`

Example:

```text
<example invalid state>
```

How to fix:

`<solution>`

Repeat for all relevant error conditions.

---

## 13. Agent Instructions

When an AI agent uses this module, it must follow these rules.

1. Read this `instructions.md` before creating or changing a configuration for this module.
2. Read `chartType.d.ts` before generating a configuration.
3. Read `chartDataSchema.ts` before generating or modifying API data.
4. Do not modify the module implementation only to satisfy a page-specific requirement.
5. Prefer solving page-specific requirements through the module configuration.
6. Do not invent configuration properties that are not defined by `chartType.d.ts`.
7. Do not invent API fields that are not accepted by `chartDataSchema.ts`.
8. Respect all relationships documented in **Data and Configuration Relationship**.
9. Use only valid values documented in **Configuration Reference**.
10. Generate complete configuration objects unless the surrounding API explicitly supports partial configuration.
11. Do not change `index.tsx`, `chartDataSchema.ts`, or `chartType.d.ts` unless the user explicitly requests a change to the module itself.
12. If the requested visualization cannot be represented by this module's existing configuration, report the limitation instead of silently modifying the module.

---

## 14. Agent Workflow

When using this module to build a page or visualization, follow this order:

1. Determine whether this module is suitable for the requested visualization.
2. Read this `instructions.md`.
3. Read `chartType.d.ts`.
4. Read `chartDataSchema.ts`.
5. Determine the required API data structure.
6. Create the module configuration.
7. Verify that every configuration property exists in `chartType.d.ts`.
8. Verify that the expected API data matches `chartDataSchema.ts`.
9. Verify all configuration-to-data relationships.
10. Integrate the module into the requested page or configuration.
11. Run the repository's relevant validation commands.

---

## 15. Do Not

Do not:

- Add undocumented configuration properties.
- Assume behavior that is not documented here or implemented by the module.
- Change the module implementation for a page-specific styling preference when the configuration already supports it.
- Change the API data format without also changing the schema intentionally.
- Use array indexes without checking their documented meaning.
- Ignore required configuration properties.
- Copy configuration from another module without checking that module's type.
- Modify module files unless the task explicitly requires changing the module itself.

---

## 16. Known Limitations

Document limitations that users and agents should know.

Examples:

- Maximum supported number of series.
- Unsupported chart combinations.
- Unsupported formatting options.
- No automatic aggregation.
- No automatic unit conversion.
- No responsive behavior beyond the provided wrapper.

If there are no known limitations, state:

`There are currently no known module-specific limitations.`

---

## 17. Notes

Add module-specific information that does not fit into the sections above.

Do not use this section for information that belongs in one of the defined sections.

If there are no additional notes, state:

`No additional notes.`
