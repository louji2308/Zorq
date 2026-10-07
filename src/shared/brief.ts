import { z } from "zod";

export const briefSchema = z.object({
  location: z.string().min(1),
  coordinates: z
    .object({
      lat: z.number(),
      lon: z.number()
    })
    .optional(),
  radius: z.number().optional(),
  areaSqFt: z.number().optional(),
  objective: z.string().min(1).max(200),
  constraints: z.array(z.string()).optional(),
  admiredPlaces: z.array(z.string()).max(3).optional(),
  presetId: z.string().optional()
});

export type Brief = z.infer<typeof briefSchema>;
