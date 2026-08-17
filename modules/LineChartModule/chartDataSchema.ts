import { z } from "zod";

export const lineChartDataSchema = z.object({
  x: z.number().finite(),
  y: z.array(z.number().finite().nullable()),
});

export type LineChartData = z.infer<typeof lineChartDataSchema>;

export default lineChartDataSchema;
