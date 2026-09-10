import { z } from "zod";

const tableCellSchema = z.union([
  z.number().finite(),
  z.string(),
  z.boolean(),
  z.null(),
]);

// SQL emits `values` via `to_json(named_struct(...))`, so the transport value may
// arrive as a JSON string (driver-dependent). Parse strings, pass objects through.
const valuesSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}, z.record(z.string(), tableCellSchema));

export const tableRowSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  values: valuesSchema,
});

export type TableCellValue = z.infer<typeof tableCellSchema>;
export type TableRowData = z.infer<typeof tableRowSchema>;

export default tableRowSchema;
