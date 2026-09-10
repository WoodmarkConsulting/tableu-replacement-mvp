import { z } from "zod";

export const barChartDataSchema = z.object({
  category: z.string(),
  values: z.array(z.number().finite().nullable()),
  target: z.number().finite().nullable().optional(),
});

export type BarChartData = z.infer<typeof barChartDataSchema>;

export default barChartDataSchema;
