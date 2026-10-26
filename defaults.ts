import type { Prisma } from "@prisma/client";
import { DEFAULT_LEAD_SOURCES, DEFAULT_STAGES } from "./constants";

export const defaultStageRows = (orgId: string): Prisma.DealStageCreateManyInput[] =>
  DEFAULT_STAGES.map((s, i) => ({ orgId, name: s.name, kind: s.kind, probability: s.probability, position: i }));
export const defaultSources = () => [...DEFAULT_LEAD_SOURCES];
