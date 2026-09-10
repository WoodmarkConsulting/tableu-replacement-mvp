import { z } from "zod";

export const cardDataSchema = z.object({
  label: z.string(),
  value: z.number().finite().nullable(),
});

export type CardData = z.infer<typeof cardDataSchema>;

export default cardDataSchema;
