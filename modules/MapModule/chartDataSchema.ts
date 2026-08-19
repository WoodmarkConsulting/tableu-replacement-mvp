import { z } from "zod";

const regionChartDataSchema = z.object({
  kind: z.literal("region"),
  regionCode: z.string().min(2).max(2).transform((value) => value.toUpperCase()),
  value: z.number().finite(),
  label: z.string().optional(),
});

const pointChartDataSchema = z.object({
  kind: z.literal("point"),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  value: z.number().finite(),
  label: z.string().optional(),
});

export const mapChartDataSchema = z.discriminatedUnion("kind", [
  regionChartDataSchema,
  pointChartDataSchema,
]);

export type MapChartData = z.infer<typeof mapChartDataSchema>;

export default mapChartDataSchema;
