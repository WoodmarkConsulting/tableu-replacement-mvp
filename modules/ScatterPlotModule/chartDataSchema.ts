import { z } from "zod";

const scatterPlotDataSchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  color: z.number().int().optional(),
});

export type ScatterPlotData = z.infer<typeof scatterPlotDataSchema>;

export default scatterPlotDataSchema;
