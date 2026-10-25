import type { Express } from "express";
import type { Brief } from "../../src/shared/brief.js";
import { createApp } from "../../src/server/app.js";
import { loadConfig } from "../../src/server/config.js";
import { challengeReportSchema } from "../../src/shared/run.js";
import { createLogger } from "../../src/server/logger.js";
import { createOrchestrator } from "../../src/server/orchestrator/index.js";
import { createMemoryStore, type RunStore } from "../../src/server/persistence/index.js";
import { createEventHub } from "../../src/server/sse/index.js";
import type { QlooEnvelope, QlooGateway, QlooOperation } from "../../src/server/qloo/index.js";
import type { LlmCompletionRequest } from "../../src/server/agent/llm.js";
import {
  TEST_NOW,
  fakeGateway,
  fakeLlm,
  okEnvelope,
  type FakeLlmResponse
} from "../agent/support/fakes.js";

export interface JudgeFixtureServer {
  baseUrl: string;
  runId: string;
  store: RunStore;
  gatewayCalls: number;
  llmCalls: () => LlmCompletionRequest[];
  close: () => Promise<void>;
}

export type JudgeLlmResponse = FakeLlmResponse | ((request: LlmCompletionRequest) => FakeLlmResponse);

/** Distinctive order so the e2e can prove `attackOrderSource: "llm"` (Plan 738). */
export const JUDGE_ATTACK_ORDER = challengeReportSchema.shape.attackOrder.parse([
  "bridge",
  "ablation",
  "substitution",
  "catchment",
  "rival"
]);

export const JUDGE_COMPOSE_TITLE = "The Williamsburg corner plan";
/** Cited in the fixture narrative to prove the strip-unknown rule live (D-8.11). */
export const JUDGE_INVENTED_CITATION = "ev-invented-not-real";

function firstAllowedEvidenceId(request: LlmCompletionRequest): string {
  const user = request.messages.find((message) => message.role === "user");
  if (typeof user?.content !== "string") {
    return "";
  }
  try {
    const payload = JSON.parse(user.content) as { allowedEvidenceIds?: unknown };
    const first = Array.isArray(payload.allowedEvidenceIds) ? payload.allowedEvidenceIds[0] : undefined;
    return typeof first === "string" ? first : "";
  } catch {
    return "";
  }
}

/**
 * Answers the two post-completion turns the judge flow needs (S4 challenge order
 * and S5 narrative). Keyed on the request label, so it survives call-order drift;
 * any other turn gets an honest refusal rather than a scripted success.
 */
export const judgeChallengeAndCompose: JudgeLlmResponse = (request) => {
  if (request.label === "challenge.attack_order") {
    return { content: JSON.stringify({ order: [...JUDGE_ATTACK_ORDER] }) };
  }
  if (request.label === "blueprint:compose") {
    const real = firstAllowedEvidenceId(request);
    const realCitation = real === "" ? "" : `[${real}]`;
    return {
      content: JSON.stringify({
        title: JUDGE_COMPOSE_TITLE,
        rationale: `${realCitation} The corner plan holds a micro-screening anchor beside a quiet social edge [${JUDGE_INVENTED_CITATION}]; its thinnest audience bridge is the honest weakness to watch.`
      })
    };
  }
  throw new Error(`judge fixture: no scripted response for label "${request.label}"`);
};

export const JUDGE_BRIEF: Brief = {
  location: "Williamsburg, Brooklyn, NY",
  coordinates: { lat: 40.7144, lon: -73.9614 },
  objective: "Design what should exist together on a narrow mixed-use corner site",
  constraints: ["No late night", "Ground-floor only"],
  admiredPlaces: ["Devoción", "Blue Note Corner", "Nitehawk Cinema"]
};

interface JudgePlace {
  entityId: string;
  name: string;
  tag: string;
  tagId: string;
  lat: number;
  lon: number;
}

const PLACES: JudgePlace[] = [
  {
    entityId: "urn:entity:place-devocion",
    name: "Devoción",
    tag: "coffee",
    tagId: "tag-coffee-1",
    lat: 40.717,
    lon: -73.958
  },
  {
    entityId: "urn:entity:place-court-tree",
    name: "Court Tree Roasters",
    tag: "espresso",
    tagId: "tag-espresso-1",
    lat: 40.7162,
    lon: -73.9601
  },
  {
    entityId: "urn:entity:place-blue-note",
    name: "Blue Note Corner",
    tag: "jazz",
    tagId: "tag-jazz-1",
    lat: 40.7144,
    lon: -73.9614
  },
  {
    entityId: "urn:entity:place-nitehawk",
    name: "Nitehawk Cinema",
    tag: "film",
    tagId: "tag-film-1",
    lat: 40.7181,
    lon: -73.9556
  },
  {
    entityId: "urn:entity:place-sunset-vinyl",
    name: "Sunset Vinyl",
    tag: "vinyl",
    tagId: "tag-vinyl-1",
    lat: 40.7138,
    lon: -73.9572
  },
  {
    entityId: "urn:entity:place-hallen",
    name: "Hallen Biergarten",
    tag: "beer",
    tagId: "tag-beer-1",
    lat: 40.7195,
    lon: -73.9631
  },
  {
    entityId: "urn:entity:place-clay",
    name: "Clay Collective",
    tag: "ceramics",
    tagId: "tag-ceramics-1",
    lat: 40.7129,
    lon: -73.9548
  },
  {
    entityId: "urn:entity:place-rooftop",
    name: "Rooftop at Pine",
    tag: "cocktails",
    tagId: "tag-cocktails-1",
    lat: 40.7187,
    lon: -73.9609
  }
];

const POOL_COMPONENTS = PLACES.map((place, index) => {
  const roles = ["Anchor", "Anchor", "Social", "Discovery", "Social", "Night", "Community", "Experience"];
  const exemplarSets = [
    "specialty coffee roasters",
    "neighborhood espresso bars",
    "intimate jazz rooms",
    "independent cinemas",
    "record shops with listening bars",
    "early-evening beer gardens",
    "community ceramics studios",
    "rooftop cocktail terraces"
  ];
  const tastes = [
    "daytime coffee culture",
    "slow espresso mornings",
    "live jazz evenings",
    "film-led discovery",
    "crate-digging socials",
    "after-work beer culture",
    "maker community",
    "golden-hour gatherings"
  ];
  return {
    id: `comp-${place.entityId.replace("urn:entity:place-", "")}`,
    role: roles[index],
    tags: [place.tag],
    exemplars: [{ id: place.entityId, name: place.name }],
    provenancePath: {
      anchorPlace: "Williamsburg, Brooklyn, NY",
      qlooSignal: place.tag,
      resolvedCategory: `urn:tag:${place.tagId}`,
      exemplarSet: exemplarSets[index],
      tasteNeighborhood: tastes[index]
    },
    evidenceState: "measured"
  };
});

const JUDGE_PRIOR = JSON.stringify({
  composition: {
    thesis: "A daytime cultural corner where coffee, film and live music reinforce each other",
    members: [
      { role: "Anchor", name: "Devoción" },
      { role: "Anchor", name: "Court Tree Roasters" },
      { role: "Social", name: "Blue Note Corner" },
      { role: "Discovery", name: "Nitehawk Cinema" },
      { role: "Night", name: "Hallen Biergarten" }
    ]
  },
  rationale: "derived from the brief only, before any Qloo evidence",
  polish:
    "Given only this brief, Zorq would open with a coffee anchor, a discovery draw like micro-cinema, and live music to carry the evening — a defensible first proposal made before any cultural evidence is consulted."
});

const SEARCH_RESULTS = {
  entities: [
    ...PLACES.map((place) => ({
      entityId: place.entityId,
      name: place.name,
      type: "place",
      location: { lat: place.lat, lon: place.lon },
      affinity: 0.9,
      popularity: 0.6,
      tags: [{ id: place.tagId, name: place.tag }]
    })),
    { entityId: "urn:entity:artist-sonic-youth", name: "Sonic Youth", type: "artist", affinity: 0.7 },
    { entityId: "urn:entity:artist-yo-la-tengo", name: "Yo La Tengo", type: "artist", affinity: 0.65 }
  ]
};

const HEAT_RESULTS = {
  heatmap: [
    { latitude: 40.715, longitude: -73.962, affinity: 0.8 },
    { latitude: 40.716, longitude: -73.961, affinity: 0.55 },
    { latitude: 40.717, longitude: -73.959, affinity: 0.42 }
  ]
};

interface Signal {
  id: string;
  name: string;
  affinity: number;
}

const SITE_ARTIST: Record<string, Signal[]> = {
  "urn:entity:place-devocion": [
    { id: "urn:entity:artist-alice-coltrane", name: "Alice Coltrane", affinity: 0.9 },
    { id: "urn:entity:artist-kim-gordon", name: "Kim Gordon", affinity: 0.95 },
    { id: "urn:entity:artist-tortoise", name: "Tortoise", affinity: 0.8 },
    { id: "urn:entity:artist-bill-evans", name: "Bill Evans", affinity: 0.7 },
    { id: "urn:entity:artist-pharoah-sanders", name: "Pharoah Sanders", affinity: 0.6 },
    { id: "urn:entity:artist-dorothy-ashby", name: "Dorothy Ashby", affinity: 0.5 }
  ],
  "urn:entity:place-court-tree": [
    { id: "urn:entity:artist-kim-gordon", name: "Kim Gordon", affinity: 0.9 },
    { id: "urn:entity:artist-sonic-youth", name: "Sonic Youth", affinity: 0.85 },
    { id: "urn:entity:artist-alice-coltrane", name: "Alice Coltrane", affinity: 0.8 },
    { id: "urn:entity:artist-animal-collective", name: "Animal Collective", affinity: 0.65 },
    { id: "urn:entity:artist-grant-green", name: "Grant Green", affinity: 0.55 }
  ],
  "urn:entity:place-blue-note": [
    { id: "urn:entity:artist-tortoise", name: "Tortoise", affinity: 0.8 },
    { id: "urn:entity:artist-sonic-youth", name: "Sonic Youth", affinity: 0.9 },
    { id: "urn:entity:artist-alice-coltrane", name: "Alice Coltrane", affinity: 0.7 },
    { id: "urn:entity:artist-sun-ra", name: "Sun Ra", affinity: 0.6 },
    { id: "urn:entity:artist-ornette-coleman", name: "Ornette Coleman", affinity: 0.5 }
  ],
  "urn:entity:place-nitehawk": [
    { id: "urn:entity:artist-bill-evans", name: "Bill Evans", affinity: 0.85 },
    { id: "urn:entity:artist-yo-la-tengo", name: "Yo La Tengo", affinity: 0.75 },
    { id: "urn:entity:artist-katherine-dunham", name: "Katherine Dunham", affinity: 0.6 }
  ],
  "urn:entity:place-sunset-vinyl": [
    { id: "urn:entity:artist-animal-collective", name: "Animal Collective", affinity: 0.7 },
    { id: "urn:entity:artist-mac-demarco", name: "Mac DeMarco", affinity: 0.9 },
    { id: "urn:entity:artist-broadcast", name: "Broadcast", affinity: 0.6 }
  ],
  "urn:entity:place-hallen": [
    { id: "urn:entity:artist-yo-la-tengo", name: "Yo La Tengo", affinity: 0.8 },
    { id: "urn:entity:artist-kraftwerk", name: "Kraftwerk", affinity: 0.7 },
    { id: "urn:entity:artist-can", name: "Can", affinity: 0.55 }
  ],
  "urn:entity:place-clay": [
    { id: "urn:entity:artist-sun-ra", name: "Sun Ra", affinity: 0.7 },
    { id: "urn:entity:artist-brian-eno", name: "Brian Eno", affinity: 0.8 },
    { id: "urn:entity:artist-ali-farka-toure", name: "Ali Farka Touré", affinity: 0.5 }
  ],
  "urn:entity:place-rooftop": [
    { id: "urn:entity:artist-mac-demarco", name: "Mac DeMarco", affinity: 0.85 },
    { id: "urn:entity:artist-kraftwerk", name: "Kraftwerk", affinity: 0.8 },
    { id: "urn:entity:artist-pharoah-sanders", name: "Pharoah Sanders", affinity: 0.6 },
    { id: "urn:entity:artist-khruangbin", name: "Khruangbin", affinity: 0.5 }
  ],
  "urn:entity:artist-sonic-youth": [
    { id: "urn:entity:artist-kim-gordon", name: "Kim Gordon", affinity: 0.9 },
    { id: "urn:entity:artist-alice-coltrane", name: "Alice Coltrane", affinity: 0.8 },
    { id: "urn:entity:artist-tortoise", name: "Tortoise", affinity: 0.75 },
    { id: "urn:entity:artist-animal-collective", name: "Animal Collective", affinity: 0.6 },
    { id: "urn:entity:artist-sonic-youth", name: "Sonic Youth", affinity: 0.55 }
  ]
};

const SITE_MOVIE: Record<string, Signal[]> = {
  "urn:entity:place-devocion": [
    { id: "urn:entity:movie-paris-texas", name: "Paris, Texas", affinity: 0.85 },
    { id: "urn:entity:movie-wanda", name: "Wanda", affinity: 0.6 }
  ],
  "urn:entity:place-court-tree": [
    { id: "urn:entity:movie-killer-of-sheep", name: "Killer of Sheep", affinity: 0.7 },
    { id: "urn:entity:movie-yi-yi", name: "Yi Yi", affinity: 0.65 }
  ],
  "urn:entity:place-blue-note": [
    { id: "urn:entity:movie-chungking-express", name: "Chungking Express", affinity: 0.75 },
    { id: "urn:entity:movie-in-the-mood", name: "In the Mood for Love", affinity: 0.8 }
  ],
  "urn:entity:place-nitehawk": [
    { id: "urn:entity:movie-paris-texas", name: "Paris, Texas", affinity: 0.9 },
    { id: "urn:entity:movie-do-the-right-thing", name: "Do the Right Thing", affinity: 0.7 }
  ],
  "urn:entity:place-sunset-vinyl": [
    { id: "urn:entity:movie-stalker", name: "Stalker", affinity: 0.75 },
    { id: "urn:entity:movie-dazed", name: "Dazed and Confused", affinity: 0.65 }
  ],
  "urn:entity:place-hallen": [
    { id: "urn:entity:movie-in-the-mood", name: "In the Mood for Love", affinity: 0.85 },
    { id: "urn:entity:movie-withnail", name: "Withnail and I", affinity: 0.6 }
  ],
  "urn:entity:place-clay": [
    { id: "urn:entity:movie-tokyo-story", name: "Tokyo Story", affinity: 0.7 },
    { id: "urn:entity:movie-yi-yi", name: "Yi Yi", affinity: 0.75 }
  ],
  "urn:entity:place-rooftop": [
    { id: "urn:entity:movie-stalker", name: "Stalker", affinity: 0.8 },
    { id: "urn:entity:movie-paterson", name: "Paterson", affinity: 0.7 }
  ]
};

const SITE_BRAND: Record<string, Signal[]> = {
  "urn:entity:place-devocion": [
    { id: "urn:entity:brand-la-colombe", name: "La Colombe", affinity: 0.9 },
    { id: "urn:entity:brand-counter-culture", name: "Counter Culture", affinity: 0.6 }
  ],
  "urn:entity:place-court-tree": [
    { id: "urn:entity:brand-la-colombe", name: "La Colombe", affinity: 0.85 },
    { id: "urn:entity:brand-blue-bottle", name: "Blue Bottle", affinity: 0.6 }
  ],
  "urn:entity:place-blue-note": [
    { id: "urn:entity:brand-rough-trade", name: "Rough Trade", affinity: 0.75 },
    { id: "urn:entity:brand-verve", name: "Verve", affinity: 0.5 }
  ],
  "urn:entity:place-nitehawk": [
    { id: "urn:entity:brand-a24", name: "A24", affinity: 0.8 },
    { id: "urn:entity:brand-criterion", name: "Criterion Collection", affinity: 0.7 }
  ],
  "urn:entity:place-sunset-vinyl": [
    { id: "urn:entity:brand-rough-trade", name: "Rough Trade", affinity: 0.8 },
    { id: "urn:entity:brand-numbers", name: "Numbers", affinity: 0.55 }
  ],
  "urn:entity:place-hallen": [
    { id: "urn:entity:brand-weihenstephan", name: "Weihenstephan", affinity: 0.7 },
    { id: "urn:entity:brand-a24", name: "A24", affinity: 0.55 }
  ],
  "urn:entity:place-clay": [
    { id: "urn:entity:brand-le-creuset", name: "Le Creuset", affinity: 0.75 },
    { id: "urn:entity:brand-hasami", name: "Hasami Porcelain", affinity: 0.65 }
  ],
  "urn:entity:place-rooftop": [
    { id: "urn:entity:brand-le-creuset", name: "Le Creuset", affinity: 0.7 },
    { id: "urn:entity:brand-fellow", name: "Fellow", affinity: 0.6 }
  ]
};

const CITY_ARTIST_COMMON: Signal[] = [
  { id: "urn:entity:artist-city-alpha", name: "City Artist Alpha", affinity: 1 },
  { id: "urn:entity:artist-city-beta", name: "City Artist Beta", affinity: 0.85 }
];

const CITY_MOVIE_COMMON: Signal[] = [
  { id: "urn:entity:movie-city-alpha", name: "City Film Alpha", affinity: 1 }
];

const CITY_BRAND_COMMON: Signal[] = [
  { id: "urn:entity:brand-city-alpha", name: "City Brand Alpha", affinity: 1 }
];

function siteTable(): Record<string, Record<string, Signal[]>> {
  return {
    artist: SITE_ARTIST,
    movie: SITE_MOVIE,
    brand: SITE_BRAND
  };
}

function cityTable(): Record<string, Record<string, Signal[]>> {
  const indexByEntity = new Map(PLACES.map((place, index) => [place.entityId, index]));
  const build = (
    site: Record<string, Signal[]>,
    common: Signal[],
    commonMass: (index: number) => number
  ): Record<string, Signal[]> => {
    const table: Record<string, Signal[]> = {};
    for (const [entityId, signals] of Object.entries(site)) {
      const index = indexByEntity.get(entityId) ?? 0;
      const city = signals.map((signal) => ({ ...signal, affinity: Number((signal.affinity * 0.6).toFixed(3)) }));
      for (const entry of common) {
        city.push({ ...entry, affinity: commonMass(index) });
      }
      table[entityId] = city;
    }
    return table;
  };
  return {
    artist: build(SITE_ARTIST, CITY_ARTIST_COMMON, (index) => Number((0.2 + 0.15 * index).toFixed(3))),
    movie: build(SITE_MOVIE, CITY_MOVIE_COMMON, () => 0.5),
    brand: build(SITE_BRAND, CITY_BRAND_COMMON, () => 0.5)
  };
}

const ROUTE2_PLAN: Record<string, { count: number; focalIndex: number }> = {
  "tag-coffee-1": { count: 8, focalIndex: 0 },
  "tag-espresso-1": { count: 8, focalIndex: 0 },
  "tag-jazz-1": { count: 8, focalIndex: 1 },
  "tag-film-1": { count: 8, focalIndex: 5 },
  "tag-vinyl-1": { count: 8, focalIndex: 1 },
  "tag-beer-1": { count: 8, focalIndex: 0 },
  "tag-ceramics-1": { count: 3, focalIndex: 0 },
  "tag-cocktails-1": { count: 8, focalIndex: 6 }
};

interface InsightsRequest {
  filterType?: string;
  signalEntities?: string[];
  filterTags?: string[];
  signalLocation?: string;
  location?: unknown;
  take?: number;
}

function entitiesFromSignals(signals: readonly Signal[]): Array<Record<string, unknown>> {
  return signals.map((signal) => ({
    entityId: signal.id,
    name: signal.name,
    type: "signal",
    affinity: signal.affinity
  }));
}

function route2Response(tagId: string): { results: { entities: unknown[] }; resultCount: number } {
  const plan = ROUTE2_PLAN[tagId] ?? { count: 0, focalIndex: 0 };
  const owner = PLACES.find((place) => place.tagId === tagId);
  const focalId = owner?.entityId ?? "";
  const fillers = PLACES.filter((place) => place.entityId !== focalId).map((place) => ({
    entityId: place.entityId,
    name: place.name,
    type: "place"
  }));
  const chosen = fillers.slice(0, Math.max(0, plan.count - 1));
  const entities: unknown[] = [];
  let fillerIndex = 0;
  for (let index = 0; index < plan.count; index += 1) {
    if (index === plan.focalIndex) {
      entities.push({ entityId: focalId, name: owner?.name ?? "", type: "place" });
    } else {
      entities.push(chosen[fillerIndex % chosen.length]);
      fillerIndex += 1;
    }
  }
  return { results: { entities }, resultCount: entities.length };
}

function judgeGateway(): { gateway: QlooGateway; calls: () => number } {
  const siteSignals = siteTable();
  const citySignals = cityTable();
  const tagEntry = (id: string, name: string): { id: string; name: string; type: string; popularity: number } => ({
    id,
    name,
    type: "Interest",
    popularity: 0.7
  });
  const tagsByQuery = new Map<string, ReturnType<typeof tagEntry>>([
    ...PLACES.map((place): [string, ReturnType<typeof tagEntry>] => [place.tag, tagEntry(place.tagId, place.tag)]),
    ["Sonic Youth", tagEntry("tag-noise-rock-1", "noise rock")]
  ]);

  const scripted = fakeGateway({
    onCall: (call): QlooEnvelope<unknown> => {
      const request = (call.request ?? {}) as InsightsRequest;
      if (call.operation === "resolveTags") {
        const query = String((call.request as { query?: string } | undefined)?.query ?? "");
        const tag = tagsByQuery.get(query);
        if (tag === undefined) {
          throw new Error(`judge fixture: resolveTags query "${query}" is not part of the fixture`);
        }
        return okEnvelope("resolveTags", { results: { tags: [tag] }, resultCount: 1 });
      }
      if (call.operation === "search") {
        return okEnvelope("search", { results: SEARCH_RESULTS, resultCount: SEARCH_RESULTS.entities.length });
      }
      if (call.operation === "bridge") {
        return okEnvelope("bridge", {
          results: {
            entities: [
              {
                entityId: "urn:entity:artist-sonic-youth",
                name: "Sonic Youth",
                type: "artist",
                affinity: 0.9,
                popularity: 0.7
              },
              {
                entityId: "urn:entity:artist-yo-la-tengo",
                name: "Yo La Tengo",
                type: "artist",
                affinity: 0.85,
                popularity: 0.65
              }
            ]
          },
          resultCount: 2
        });
      }
      if (call.operation === "insights") {
        if (typeof request.filterTags === "object" && request.filterTags !== null && request.filterTags.length > 0) {
          const response = route2Response(request.filterTags[0] ?? "");
          return okEnvelope("insights", { ...response, resultCount: response.resultCount });
        }
        if (request.filterType === "heatmap") {
          return okEnvelope("insights", { results: HEAT_RESULTS, resultCount: HEAT_RESULTS.heatmap.length });
        }
        const domain = request.filterType;
        if (domain !== "artist" && domain !== "movie" && domain !== "brand") {
          throw new Error(`judge fixture: insights filterType "${String(domain)}" is not part of the fixture`);
        }
        const componentEntity = request.signalEntities?.[0] ?? "";
        const scoped = typeof request.signalLocation === "string" && request.signalLocation !== ""
          ? siteSignals
          : citySignals;
        const signals = scoped[domain]?.[componentEntity];
        if (signals === undefined) {
          throw new Error(
            `judge fixture: no ${String(domain)} neighborhood for "${componentEntity}" in ${
              scoped === siteSignals ? "site" : "city"
            } scope`
          );
        }
        return okEnvelope("insights", {
          results: { entities: entitiesFromSignals(signals) },
          resultCount: signals.length
        });
      }
      throw new Error(`judge fixture: operation "${call.operation as QlooOperation}" is not part of the fixture`);
    }
  });

  return { gateway: scripted.gateway, calls: () => scripted.calls.length };
}

const TURN_ONE = {
  content: "resolving the brief's tags and searching the observed places",
  toolCalls: [
    ...PLACES.map((place, index) => ({
      id: `call_tag_${index}`,
      name: "qloo_resolve_tags",
      arguments: JSON.stringify({ query: place.tag, take: 5 })
    })),
    {
      id: "call_search",
      name: "qloo_search",
      arguments: JSON.stringify({ query: "cultural places in Williamsburg Brooklyn", take: 10 })
    }
  ]
};

const TURN_TWO = {
  content: "reading local heat, then proposing the grounded pool",
  toolCalls: [
    {
      id: "call_heat",
      name: "qloo_insights",
      arguments: JSON.stringify({
        filterType: "heatmap",
        location: { point: { lat: 40.7144, lon: -73.9614 } }
      })
    },
    {
      id: "call_pool",
      name: "propose_candidate_pool",
      arguments: JSON.stringify({ components: POOL_COMPONENTS })
    }
  ]
};

const FINAL_TURN = {
  content:
    "Eight grounded components proposed from observed entities and tags; anything beyond the evidence remains unproven."
};

async function listen(app: Express): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", (error) => reject(error));
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("judge fixture: server did not expose a tcp port");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

export interface JudgeLlmOptions {
  nodeEnv?: "test" | "production";
  /** Turn order after the four setup turns. Label-keyed turns stay out of this queue. */
  extraLlmResponses?: JudgeLlmResponse[];
  /** Turns answered by label only, after the positional queue is exhausted. */
  labelLlmResponses?: Record<string, JudgeLlmResponse[]>;
}

export async function startJudgeFixtureServer(options: JudgeLlmOptions = {}): Promise<JudgeFixtureServer> {
  const config = loadConfig({
    NODE_ENV: options.nodeEnv ?? "test",
    APP_BASE_URL: "http://127.0.0.1:3999",
    QLOO_API_KEY: "fixture-key-never-used",
    RAPIDROUTER_API_KEY: "fixture-key-never-used"
  });
  const store = createMemoryStore();
  const hub = createEventHub();
  const base: FakeLlmResponse[] = [{ content: JUDGE_PRIOR }, TURN_ONE, TURN_TWO, FINAL_TURN];
  const llm = fakeLlm([...base, ...(options.extraLlmResponses ?? [])], options.labelLlmResponses ?? {});
  const scripted = judgeGateway();
  const orchestrator = createOrchestrator({
    store,
    gateway: scripted.gateway,
    llm: llm.client,
    now: () => TEST_NOW,
    eventSink: (event) => hub.publish(event)
  });
  const app = createApp(createLogger("judge-fixture"), {
    config,
    orchestrator,
    store,
    eventHub: hub
  });
  const running = await listen(app);

  let runId = "";
  try {
    const response = await fetch(`${running.baseUrl}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(JUDGE_BRIEF)
    });
    const body = (await response.json()) as { run?: { id?: string; status?: string }; error?: unknown };
    if (response.status !== 201 || typeof body.run?.id !== "string") {
      throw new Error(`judge fixture: run creation failed with ${response.status} ${JSON.stringify(body.error ?? body)}`);
    }
    if (body.run.status !== "complete") {
      throw new Error(`judge fixture: run ended as "${String(body.run.status)}" instead of complete`);
    }
    runId = body.run.id;
  } catch (error) {
    await running.close();
    throw error;
  }

  return {
    baseUrl: running.baseUrl,
    runId,
    store,
    gatewayCalls: scripted.calls(),
    llmCalls: () => llm.calls,
    close: running.close
  };
}
