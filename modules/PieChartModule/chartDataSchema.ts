import { z } from "zod";

export const pieChartDataSchema = z.object({
  name: z.string(),
  value: z.number().finite().nonnegative(),
});

export type PieChartData = z.infer<typeof pieChartDataSchema>;

export default pieChartDataSchema;