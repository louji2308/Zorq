import { z } from "zod";
import { apiErrorBodySchema } from "./errors.js";
import { runIdParamsSchema, runStateSchema } from "./run.js";

export const ledgerEventSchema = z.object({
  kind: z.enum(["Qloo", "Compute", "LLM"]),
  label: z.string(),
  summary: z.string(),
  duration: z.number(),
  cacheState: z.string(),
  resultCount: z.number()
});

export type LedgerEvent = z.infer<typeof ledgerEventSchema>;

export const sseEventNames = [
  "state",
  "phase",
  "ledger",
  "evidence",
  "dna",
  "compositions",
  "stress",
  "blueprint",
  "error"
] as const;

export const sseEventNameSchema = z.enum(sseEventNames);

export type SseEventName = z.infer<typeof sseEventNameSchema>;

const sseFrameBase = {
  id: z.string().min(1)
};

export const sseFrameSchema = z.discriminatedUnion("event", [
  z.object({ ...sseFrameBase, event: z.literal("state"), data: runStateSchema }),
  z.object({ ...sseFrameBase, event: z.literal("ledger"), data: ledgerEventSchema }),
  z.object({ ...sseFrameBase, event: z.literal("error"), data: apiErrorBodySchema }),
  z.object({ ...sseFrameBase, event: z.literal("phase"), data: z.unknown() }),
  z.object({ ...sseFrameBase, event: z.literal("evidence"), data: z.unknown() }),
  z.object({ ...sseFrameBase, event: z.literal("dna"), data: z.unknown() }),
  z.object({ ...sseFrameBase, event: z.literal("compositions"), data: z.unknown() }),
  z.object({ ...sseFrameBase, event: z.literal("stress"), data: z.unknown() }),
  z.object({ ...sseFrameBase, event: z.literal("blueprint"), data: z.unknown() })
]);

export type SseFrame = z.infer<typeof sseFrameSchema>;

export const eventsRequestSchema = z.object({
  params: runIdParamsSchema,
  headers: z.object({
    "last-event-id": z.string().optional()
  })
});

export type EventsRequest = z.infer<typeof eventsRequestSchema>;
