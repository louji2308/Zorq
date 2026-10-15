import type { ComponentRole } from "./types.js";
import {
  FORMAT_LIBRARY_HEURISTIC,
  resolveFormatType,
  type ComponentFormat,
  type FormatType,
  type NoiseClass
} from "./formats.js";

export const CIRCULATION_ALLOWANCE = 0.85;

export interface FitMemberInput {
  id: string;
  name: string;
  role: ComponentRole;
  tags: readonly string[];
  exemplarNames?: readonly string[];
}

export interface FitBriefInput {
  areaSqFt?: number;
  constraints: readonly string[];
}

export interface ConstraintRead {
  key: "lateNight" | "quiet" | "noLargeNightclub" | "raw";
  source: string;
}

export interface FormatChoice {
  memberId: string;
  name: string;
  role: ComponentRole;
  typeKey: string;
  typeDisplayName: string;
  mapped: boolean;
  formatId: string;
  formatName: string;
  footprintSqFtMin: number;
  footprintSqFtMax: number;
  noiseClass: NoiseClass;
  hours: { open: string; close: string };
  downshiftedFrom: string | null;
}

export interface FitDownshift {
  memberId: string;
  name: string;
  role: ComponentRole;
  fromFormat: string;
  toFormat: string;
  sentence: string;
}

export interface FitDrop {
  memberId: string;
  name: string;
  role: ComponentRole;
  reason: string;
}

export interface FitResult {
  heuristic: typeof FORMAT_LIBRARY_HEURISTIC;
  areaSqFt: number | null;
  usableSqFt: number | null;
  totalFootprintSqFt: number | null;
  feasible: boolean;
  choices: FormatChoice[];
  downshifts: FitDownshift[];
  drops: FitDrop[];
  constraintsRead: ConstraintRead[];
  reasons: string[];
}

const NOISE_RANK: Record<NoiseClass, number> = { quiet: 0, moderate: 1, loud: 2 };

interface ParsedConstraints {
  lateNightRestricted: boolean;
  quietPreferred: boolean;
  noLargeNightclub: boolean;
  reads: ConstraintRead[];
}

export function parseFitConstraints(constraints: readonly string[]): ParsedConstraints {
  const reads: ConstraintRead[] = [];
  let lateNightRestricted = false;
  let quietPreferred = false;
  let noLargeNightclub = false;
  for (const raw of constraints) {
    const text = raw.trim().toLowerCase();
    if (text === "") {
      continue;
    }
    if (text.includes("late night") || text.includes("after 10 pm") || text.includes("after 10pm")) {
      lateNightRestricted = true;
      reads.push({ key: "lateNight", source: raw });
      continue;
    }
    if (text.includes("quiet") && !text.includes("noisy")) {
      quietPreferred = true;
      reads.push({ key: "quiet", source: raw });
      continue;
    }
    if (text.includes("nightclub") || text.includes("night club")) {
      noLargeNightclub = true;
      reads.push({ key: "noLargeNightclub", source: raw });
      continue;
    }
    reads.push({ key: "raw", source: raw });
  }
  return { lateNightRestricted, quietPreferred, noLargeNightclub, reads };
}

function midpoint(format: ComponentFormat): number {
  return Math.round((format.footprintSqFtMin + format.footprintSqFtMax) / 2);
}

function closesLate(format: ComponentFormat): boolean {
  const hour = Number.parseInt(format.hours.close.slice(0, 2), 10);
  if (Number.isNaN(hour)) {
    return false;
  }
  return hour >= 22 || hour < 5;
}

function violates(format: ComponentFormat, parsed: ParsedConstraints, type: FormatType): boolean {
  if (parsed.lateNightRestricted && closesLate(format)) {
    return true;
  }
  if (parsed.quietPreferred && NOISE_RANK[format.noiseClass] > NOISE_RANK.moderate) {
    return true;
  }
  if (parsed.noLargeNightclub && type.typeKey === "nightclub" && format.footprintSqFtMax >= 2000) {
    return true;
  }
  return false;
}

function downshiftSentence(member: FitMemberInput, fromName: string, toName: string): string {
  return `${fromName} becomes ${toName.toLowerCase()}. Role preserved: ${member.role}.`;
}

export function fitConstraints(brief: FitBriefInput, members: readonly FitMemberInput[]): FitResult {
  const parsed = parseFitConstraints(brief.constraints);
  const reasons: string[] = [];
  const downshifts: FitDownshift[] = [];
  const drops: FitDrop[] = [];
  const choices: FormatChoice[] = [];

  const areaSqFt = brief.areaSqFt !== undefined && brief.areaSqFt > 0 ? brief.areaSqFt : null;
  const usableSqFt = areaSqFt !== null ? Math.floor(areaSqFt * CIRCULATION_ALLOWANCE) : null;
  if (areaSqFt === null) {
    reasons.push(
      "no floor area was supplied; footprint fit is not measured and formats are chosen by constraint only"
    );
  } else {
    reasons.push(
      `usable footprint is ${usableSqFt} sq ft (${Math.round(CIRCULATION_ALLOWANCE * 100)}% of ${areaSqFt} sq ft after the circulation allowance)`
    );
  }

  interface Working {
    member: FitMemberInput;
    type: FormatType;
    mapped: boolean;
    format: ComponentFormat;
    downshiftedFrom: string | null;
  }

  const working: Working[] = [];
  for (const member of members) {
    const match = resolveFormatType(member);
    working.push({
      member,
      type: match.type,
      mapped: match.mapped,
      format: match.type.formats[0]!,
      downshiftedFrom: null
    });
  }

  const targetTotal = usableSqFt;
  let guard = 0;
  const GUARD_LIMIT = 64;

  for (;;) {
    guard += 1;
    if (guard > GUARD_LIMIT) {
      reasons.push("format fitting stopped at its iteration guard; the last honest state is reported");
      break;
    }
    const total = working.reduce((sum, entry) => sum + midpoint(entry.format), 0);

    const violatingEntry = working.find((entry) => violates(entry.format, parsed, entry.type));
    if (violatingEntry !== undefined) {
      const index = working.indexOf(violatingEntry);
      const nextFormat = violatingEntry.type.formats
        .slice(1)
        .find((candidate) => !violates(candidate, parsed, violatingEntry.type));
      if (nextFormat === undefined) {
        working.splice(index, 1);
        drops.push({
          memberId: violatingEntry.member.id,
          name: violatingEntry.member.name,
          role: violatingEntry.member.role,
          reason: `no format of ${violatingEntry.type.displayName} satisfies the site constraints`
        });
        continue;
      }
      downshifts.push({
        memberId: violatingEntry.member.id,
        name: violatingEntry.member.name,
        role: violatingEntry.member.role,
        fromFormat: violatingEntry.format.name,
        toFormat: nextFormat.name,
        sentence: downshiftSentence(violatingEntry.member, violatingEntry.format.name, nextFormat.name)
      });
      working[index] = {
        ...violatingEntry,
        format: nextFormat,
        downshiftedFrom: violatingEntry.downshiftedFrom ?? violatingEntry.format.name
      };
      continue;
    }

    if (targetTotal !== null && total > targetTotal) {
      let downshiftIndex = -1;
      let largestFootprint = -1;
      for (let index = 0; index < working.length; index += 1) {
        const entry = working[index]!;
        if (entry.member.role === "Anchor") {
          continue;
        }
        const nextFormat = entry.type.formats[entry.type.formats.indexOf(entry.format) + 1];
        if (nextFormat === undefined) {
          continue;
        }
        const footprint = midpoint(entry.format);
        if (footprint > largestFootprint) {
          largestFootprint = footprint;
          downshiftIndex = index;
        }
      }
      if (downshiftIndex !== -1) {
        const entry = working[downshiftIndex]!;
        const nextFormat = entry.type.formats[entry.type.formats.indexOf(entry.format) + 1]!;
        downshifts.push({
          memberId: entry.member.id,
          name: entry.member.name,
          role: entry.member.role,
          fromFormat: entry.format.name,
          toFormat: nextFormat.name,
          sentence: downshiftSentence(entry.member, entry.format.name, nextFormat.name)
        });
        working[downshiftIndex] = {
          ...entry,
          format: nextFormat,
          downshiftedFrom: entry.downshiftedFrom ?? entry.format.name
        };
        continue;
      }
      let droppableIndex = -1;
      let worstScore = Number.POSITIVE_INFINITY;
      for (let index = 0; index < working.length; index += 1) {
        const entry = working[index]!;
        const score = entry.member.role === "Anchor" ? Number.POSITIVE_INFINITY : midpoint(entry.format);
        if (score < worstScore) {
          worstScore = score;
          droppableIndex = index;
        }
      }
      if (droppableIndex === -1) {
        reasons.push(
          `the remaining footprint of ${total} sq ft still exceeds ${targetTotal} sq ft; only Anchor members remain and none are dropped`
        );
        break;
      }
      const dropped = working.splice(droppableIndex, 1)[0]!;
      drops.push({
        memberId: dropped.member.id,
        name: dropped.member.name,
        role: dropped.member.role,
        reason: `footprint pressure: ${midpoint(dropped.format)} sq ft was released to approach the ${targetTotal} sq ft usable limit`
      });
      continue;
    }

    break;
  }

  for (const entry of working) {
    choices.push({
      memberId: entry.member.id,
      name: entry.member.name,
      role: entry.member.role,
      typeKey: entry.type.typeKey,
      typeDisplayName: entry.type.displayName,
      mapped: entry.mapped,
      formatId: entry.format.formatId,
      formatName: entry.format.name,
      footprintSqFtMin: entry.format.footprintSqFtMin,
      footprintSqFtMax: entry.format.footprintSqFtMax,
      noiseClass: entry.format.noiseClass,
      hours: { open: entry.format.hours.open, close: entry.format.hours.close },
      downshiftedFrom: entry.downshiftedFrom
    });
  }

  const totalFootprint = choices.reduce(
    (sum, choice) => sum + Math.round((choice.footprintSqFtMin + choice.footprintSqFtMax) / 2),
    0
  );
  const footprintTotal = areaSqFt !== null ? totalFootprint : null;
  const withinFootprint = usableSqFt === null || totalFootprint <= usableSqFt;
  const feasible = choices.length > 0 && withinFootprint;

  if (choices.length === 0) {
    reasons.push("no member survived constraint fitting; the blueprint would be empty and is refused");
  } else if (!withinFootprint) {
    reasons.push(
      `the fitted footprint of ${totalFootprint} sq ft still exceeds the usable ${usableSqFt} sq ft; the result stays marked infeasible rather than invented`
    );
  } else if (downshifts.length > 0 || drops.length > 0) {
    reasons.push(
      `constraint fitting held the plan at ${totalFootprint} sq ft through ${downshifts.length} downshift(s) and ${drops.length} drop(s)`
    );
  } else if (footprintTotal !== null) {
    reasons.push(`the plan fits ${totalFootprint} sq ft inside the usable ${usableSqFt} sq ft without a format change`);
  }

  return {
    heuristic: FORMAT_LIBRARY_HEURISTIC,
    areaSqFt,
    usableSqFt,
    totalFootprintSqFt: footprintTotal,
    feasible,
    choices,
    downshifts,
    drops,
    constraintsRead: parsed.reads,
    reasons
  };
}
