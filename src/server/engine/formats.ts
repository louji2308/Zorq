import { type ComponentRole } from "./types.js";

export const FORMAT_LIBRARY_HEURISTIC = "[Zorq heuristic]" as const;

export const noiseClasses = ["quiet", "moderate", "loud"] as const;
export type NoiseClass = (typeof noiseClasses)[number];

export interface FormatHours {
  open: string;
  close: string;
}

export interface ComponentFormat {
  formatId: string;
  name: string;
  footprintSqFtMin: number;
  footprintSqFtMax: number;
  noiseClass: NoiseClass;
  hours: FormatHours;
}

export interface FormatType {
  typeKey: string;
  displayName: string;
  typicalRole: ComponentRole;
  keywords: readonly string[];
  formats: readonly ComponentFormat[];
}

function format(
  formatId: string,
  name: string,
  footprintSqFtMin: number,
  footprintSqFtMax: number,
  noiseClass: NoiseClass,
  open: string,
  close: string
): ComponentFormat {
  return { formatId, name, footprintSqFtMin, footprintSqFtMax, noiseClass, hours: { open, close } };
}

export const FORMAT_TYPES: readonly FormatType[] = [
  {
    typeKey: "cinema",
    displayName: "Cinema",
    typicalRole: "Anchor",
    keywords: ["cinema", "film", "movie", "screening", "nippon", "arthouse", "documentary"],
    formats: [
      format("cinema-full", "Cinema", 2500, 4000, "moderate", "12:00", "23:30"),
      format("cinema-micro", "Micro-screening", 600, 1200, "quiet", "17:00", "23:00"),
      format("cinema-series", "Screening series", 200, 400, "quiet", "18:00", "22:00")
    ]
  },
  {
    typeKey: "music-venue",
    displayName: "Music venue",
    typicalRole: "Anchor",
    keywords: ["music", "jazz", "live", "concert", "band", "blues", "blue note"],
    formats: [
      format("music-full", "Music venue", 2000, 3500, "loud", "17:00", "01:00"),
      format("music-bar", "Stage-and-bar", 900, 1500, "moderate", "17:00", "01:00"),
      format("music-listening", "Listening room", 500, 900, "moderate", "17:00", "00:00")
    ]
  },
  {
    typeKey: "museum",
    displayName: "Museum",
    typicalRole: "Anchor",
    keywords: ["museum", "collection", "exhibition hall"],
    formats: [
      format("museum-full", "Museum", 5000, 12000, "quiet", "10:00", "18:00"),
      format("museum-gallery", "Gallery-museum", 1500, 3000, "quiet", "10:00", "18:00")
    ]
  },
  {
    typeKey: "gallery",
    displayName: "Gallery",
    typicalRole: "Discovery",
    keywords: ["gallery", "art", "contemporary", "ceramics", "sculpture", "clay"],
    formats: [
      format("gallery-full", "Gallery", 900, 1800, "quiet", "11:00", "19:00"),
      format("gallery-project", "Project space", 400, 800, "quiet", "12:00", "19:00"),
      format("gallery-popup", "Pop-up gallery", 200, 400, "quiet", "12:00", "18:00")
    ]
  },
  {
    typeKey: "library",
    displayName: "Library",
    typicalRole: "Anchor",
    keywords: ["library", "books", "reading", "archive", "zine archive"],
    formats: [
      format("library-full", "Library", 3000, 6000, "quiet", "09:00", "20:00"),
      format("library-reading", "Reading room", 600, 1200, "quiet", "09:00", "20:00")
    ]
  },
  {
    typeKey: "market",
    displayName: "Market hall",
    typicalRole: "Social",
    keywords: ["market", "hall", "vendors", "food hall", "stalls"],
    formats: [
      format("market-hall", "Market hall", 3000, 6000, "moderate", "09:00", "21:00"),
      format("market-food", "Food hall", 1500, 3000, "moderate", "11:00", "22:00"),
      format("market-popup", "Pop-up market", 500, 1200, "moderate", "10:00", "20:00")
    ]
  },
  {
    typeKey: "theater",
    displayName: "Theater",
    typicalRole: "Experience",
    keywords: ["theater", "theatre", "play", "performance stage", "dance house"],
    formats: [
      format("theater-full", "Theater", 2000, 3500, "moderate", "17:00", "23:00"),
      format("theater-blackbox", "Black box", 900, 1800, "moderate", "17:00", "23:00"),
      format("theater-studio", "Studio theater", 400, 800, "quiet", "17:00", "22:00")
    ]
  },
  {
    typeKey: "cafe",
    displayName: "Cafe",
    typicalRole: "Social",
    keywords: ["cafe", "café", "coffee", "espresso", "tea house", "roasters", "roastery"],
    formats: [
      format("cafe-full", "Cafe", 800, 1500, "moderate", "07:30", "19:00"),
      format("cafe-counter", "Coffee counter", 250, 500, "moderate", "07:30", "18:00"),
      format("cafe-bakery", "Cafe-bakery", 600, 1000, "moderate", "08:00", "18:00")
    ]
  },
  {
    typeKey: "bar",
    displayName: "Bar",
    typicalRole: "Social",
    keywords: ["bar", "pub", "cocktails", "wine", "beer", "biergarten", "bier", " spirits"],
    formats: [
      format("bar-full", "Bar", 900, 1800, "loud", "16:00", "02:00"),
      format("bar-wine", "Wine bar", 500, 900, "moderate", "16:00", "00:00"),
      format("bar-shop", "Bottle shop-bar", 300, 600, "moderate", "14:00", "23:00")
    ]
  },
  {
    typeKey: "restaurant",
    displayName: "Restaurant",
    typicalRole: "Social",
    keywords: ["restaurant", "dining", "kitchen", "bistro", " trattoria"],
    formats: [
      format("restaurant-full", "Restaurant", 1400, 2800, "moderate", "11:30", "23:00"),
      format("restaurant-counter", "Counter dining", 500, 900, "moderate", "11:30", "22:00"),
      format("restaurant-window", "Food counter", 250, 500, "moderate", "11:00", "21:00")
    ]
  },
  {
    typeKey: "bakery",
    displayName: "Bakery",
    typicalRole: "Social",
    keywords: ["bakery", "pastry", "bread", "patisserie"],
    formats: [
      format("bakery-full", "Bakery", 400, 800, "moderate", "07:00", "18:00"),
      format("bakery-counter", "Counter bakery", 150, 300, "moderate", "07:00", "15:00")
    ]
  },
  {
    typeKey: "bookstore",
    displayName: "Bookstore",
    typicalRole: "Discovery",
    keywords: ["bookstore", "bookshop", "books", "literature", "poetry"],
    formats: [
      format("bookstore-full", "Bookstore", 1200, 2400, "quiet", "10:00", "20:00"),
      format("bookstore-bar", "Bookbar", 600, 1000, "quiet", "10:00", "22:00"),
      format("bookstore-zine", "Zine library", 150, 350, "quiet", "11:00", "19:00")
    ]
  },
  {
    typeKey: "record-shop",
    displayName: "Record shop",
    typicalRole: "Discovery",
    keywords: ["record", "vinyl", "records", "hi-fi", "hifi"],
    formats: [
      format("record-full", "Record shop", 500, 1000, "moderate", "11:00", "20:00"),
      format("record-counter", "Listening counter", 200, 400, "moderate", "11:00", "20:00")
    ]
  },
  {
    typeKey: "makerspace",
    displayName: "Makerspace",
    typicalRole: "Community",
    keywords: ["maker", "workshop", "studio", "craft", "pottery", "woodshop", "textile"],
    formats: [
      format("maker-full", "Makerspace", 1500, 3000, "moderate", "10:00", "21:00"),
      format("maker-studio", "Workshop studio", 500, 1200, "moderate", "10:00", "21:00"),
      format("maker-counter", "Craft counter", 200, 450, "moderate", "11:00", "19:00")
    ]
  },
  {
    typeKey: "coworking",
    displayName: "Coworking",
    typicalRole: "Community",
    keywords: ["cowork", "coworking", "desk", "office", "work club"],
    formats: [
      format("cowork-full", "Coworking floor", 2500, 5000, "quiet", "08:00", "20:00"),
      format("cowork-room", "Hot desk room", 600, 1200, "quiet", "08:00", "20:00")
    ]
  },
  {
    typeKey: "climbing",
    displayName: "Climbing gym",
    typicalRole: "Experience",
    keywords: ["climb", "boulder", "bouldering", "ropes", "fitness"],
    formats: [
      format("climbing-full", "Climbing gym", 4000, 9000, "moderate", "08:00", "22:00"),
      format("climbing-boulder", "Bouldering room", 1500, 3500, "moderate", "08:00", "22:00")
    ]
  },
  {
    typeKey: "nightclub",
    displayName: "Nightclub",
    typicalRole: "Night",
    keywords: ["nightclub", "club", "dancefloor", "dance floor", "rave", "disco"],
    formats: [
      format("nightclub-full", "Nightclub", 3000, 6000, "loud", "21:00", "04:00"),
      format("nightclub-lounge", "Club lounge", 1200, 2400, "loud", "20:00", "03:00"),
      format("nightclub-speakeasy", "Speakeasy", 400, 800, "moderate", "20:00", "02:00")
    ]
  },
  {
    typeKey: "performance",
    displayName: "Performance space",
    typicalRole: "Experience",
    keywords: ["performance", "stage", "spoken word", "comedy", "open mic"],
    formats: [
      format("performance-full", "Performance space", 1000, 2000, "moderate", "17:00", "23:00"),
      format("performance-open", "Open mic room", 300, 600, "moderate", "18:00", "23:00")
    ]
  },
  {
    typeKey: "community",
    displayName: "Community center",
    typicalRole: "Community",
    keywords: ["community", "neighborhood", "civic", "association", "mutual aid"],
    formats: [
      format("community-full", "Community center", 2000, 4000, "moderate", "09:00", "21:00"),
      format("community-hub", "Neighborhood hub", 700, 1500, "moderate", "09:00", "21:00")
    ]
  },
  {
    typeKey: "wellness",
    displayName: "Wellness studio",
    typicalRole: "Community",
    keywords: ["yoga", "wellness", "meditation", "sauna", "spa"],
    formats: [
      format("wellness-full", "Wellness studio", 900, 1800, "quiet", "07:00", "21:00"),
      format("wellness-room", "Meditation room", 250, 500, "quiet", "08:00", "21:00")
    ]
  },
  {
    typeKey: "arcade",
    displayName: "Arcade bar",
    typicalRole: "Night",
    keywords: ["arcade", "games", "pinball", "tabletop", "board games"],
    formats: [
      format("arcade-full", "Arcade bar", 800, 1600, "loud", "15:00", "01:00"),
      format("arcade-room", "Game room", 300, 700, "moderate", "14:00", "23:00")
    ]
  },
  {
    typeKey: "beer-garden",
    displayName: "Beer garden",
    typicalRole: "Night",
    keywords: ["beer garden", "biergarten", "beer hall", "taproom", "brewery"],
    formats: [
      format("beer-garden-patio", "Beer garden patio", 1500, 3000, "loud", "12:00", "23:00"),
      format("beer-hall", "Beer hall", 1000, 2000, "loud", "12:00", "01:00"),
      format("beer-taproom", "Taproom", 500, 1000, "moderate", "14:00", "00:00")
    ]
  },
  {
    typeKey: "antique",
    displayName: "Antique shop",
    typicalRole: "Discovery",
    keywords: ["antique", "vintage", "second hand", "thrift", "flea"],
    formats: [
      format("antique-full", "Antique shop", 700, 1400, "quiet", "11:00", "19:00"),
      format("antique-stall", "Vintage stall", 200, 450, "quiet", "11:00", "19:00")
    ]
  },
  {
    typeKey: "print-studio",
    displayName: "Print studio",
    typicalRole: "Discovery",
    keywords: ["print", "risograph", "letterpress", "screenprint", "publishing"],
    formats: [
      format("print-full", "Print studio", 600, 1200, "moderate", "10:00", "20:00"),
      format("print-riso", "Risograph room", 150, 350, "moderate", "10:00", "19:00")
    ]
  },
  {
    typeKey: "rooftop",
    displayName: "Rooftop",
    typicalRole: "Social",
    keywords: ["rooftop", "roof", "terrace", "skyline", "outdoor bar"],
    formats: [
      format("rooftop-terrace", "Rooftop terrace", 800, 2000, "moderate", "12:00", "23:00"),
      format("rooftop-bar", "Roof bar", 500, 1000, "loud", "16:00", "01:00")
    ]
  }
];

export function formatLibrarySize(): number {
  return FORMAT_TYPES.reduce((count, type) => count + type.formats.length, 0);
}

const ROLE_FALLBACKS: Record<ComponentRole, FormatType> = {
  Anchor: {
    typeKey: "unmapped-anchor",
    displayName: "Anchor space",
    typicalRole: "Anchor",
    keywords: [],
    formats: [
      format("unmapped-anchor-full", "Anchor space", 1500, 3000, "moderate", "10:00", "21:00"),
      format("unmapped-anchor-mid", "Compact anchor", 700, 1400, "moderate", "10:00", "21:00")
    ]
  },
  Social: {
    typeKey: "unmapped-social",
    displayName: "Social space",
    typicalRole: "Social",
    keywords: [],
    formats: [
      format("unmapped-social-full", "Social space", 800, 1600, "moderate", "10:00", "22:00"),
      format("unmapped-social-mid", "Compact social", 400, 800, "moderate", "10:00", "22:00")
    ]
  },
  Discovery: {
    typeKey: "unmapped-discovery",
    displayName: "Discovery space",
    typicalRole: "Discovery",
    keywords: [],
    formats: [
      format("unmapped-discovery-full", "Discovery space", 700, 1400, "quiet", "10:00", "20:00"),
      format("unmapped-discovery-mid", "Compact discovery", 300, 700, "quiet", "10:00", "20:00")
    ]
  },
  Experience: {
    typeKey: "unmapped-experience",
    displayName: "Experience space",
    typicalRole: "Experience",
    keywords: [],
    formats: [
      format("unmapped-experience-full", "Experience space", 1200, 2400, "moderate", "12:00", "23:00"),
      format("unmapped-experience-mid", "Compact experience", 500, 1000, "moderate", "12:00", "23:00")
    ]
  },
  Night: {
    typeKey: "unmapped-night",
    displayName: "Night space",
    typicalRole: "Night",
    keywords: [],
    formats: [
      format("unmapped-night-full", "Night space", 1000, 2000, "loud", "18:00", "02:00"),
      format("unmapped-night-mid", "Compact night", 450, 900, "loud", "18:00", "02:00")
    ]
  },
  Community: {
    typeKey: "unmapped-community",
    displayName: "Community space",
    typicalRole: "Community",
    keywords: [],
    formats: [
      format("unmapped-community-full", "Community space", 1000, 2000, "moderate", "09:00", "21:00"),
      format("unmapped-community-mid", "Compact community", 450, 900, "moderate", "09:00", "21:00")
    ]
  }
};

export interface FormatMatchInput {
  id: string;
  role: ComponentRole;
  tags: readonly string[];
  exemplarNames?: readonly string[];
}

export interface FormatMatch {
  type: FormatType;
  mapped: boolean;
  matchedOn: string | null;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD");
}

export function resolveFormatType(input: FormatMatchInput): FormatMatch {
  const haystacks = [input.id, ...input.tags, ...(input.exemplarNames ?? [])].map(normalize);
  let best: FormatType | null = null;
  let bestOn: string | null = null;
  let bestLength = 0;
  for (const type of FORMAT_TYPES) {
    for (const keyword of type.keywords) {
      const needle = normalize(keyword);
      if (needle.length <= bestLength) {
        continue;
      }
      if (haystacks.some((text) => text.includes(needle))) {
        best = type;
        bestOn = keyword;
        bestLength = needle.length;
      }
    }
  }
  if (best === null) {
    return { type: ROLE_FALLBACKS[input.role], mapped: false, matchedOn: null };
  }
  return { type: best, mapped: true, matchedOn: bestOn };
}
