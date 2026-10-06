# Zorq: Design Thinking for the Final Product

*Design rationale only. No mockups, no code. Everything here sits on top of `zorq-product-spec.md` (S0 to S5, overlays, /method), which stays the source of truth for what the product does. This document decides how it should look, feel, and behave, and why.*

**Naming rule applied:** the product is **Zorq** everywhere. Nothing below uses the old name.

**Evidence labels used in this document** (same spirit as the spec): `RESEARCHED` = I found a source and paraphrased it. `REASONED` = my inference from researched facts; it needs a test. `UNVERIFIED` = I could not confirm it; it appears in the spike list at the end.

---

## 0. The design in one paragraph

Zorq is a **drawing set for a place**, made on a **white gallery wall that lets the street in**.

The interface is pure black ink on white paper. It borrows the visual language of architectural drawings (line weights, hatching, title blocks, scale bars, sheet references) because Zorq's job is the same as a drawing set's job: tell a developer exactly what should exist, where, and why, with every line accountable. All colour in the product comes from one place only: **real cultural evidence** (album covers, film posters, venue photos returned by the data). The chrome is monochrome. The world is in colour. Colour therefore *means* "this is real", and it never decorates.

The single memorable moment is the **Prior-vs-Evidence reveal**: a sheet that was drawn in pen before the agent looked, and then re-inked, line by line, after it did.

---

## 1. What I researched and what it changed

I ran about twenty searches and page fetches. Below, only findings that changed a decision. Each row says what I found, then what Zorq does about it.

### 1.1 Psychology of serious, trust-critical products

| Finding | Status | Decision it drives |
|---|---|---|
| People judge a page's visual appeal in about 50 ms, and that first impression colours later judgments of credibility and usability (Lindgaard et al., 2006; "halo effect"). | RESEARCHED | S0 must be a finished composition on first paint. No skeleton screens, no layout shift, fonts preloaded. |
| In Stanford web-credibility surveys of 2,600+ people, about 46% cited a clean, professional look when judging credibility (Fogg). | RESEARCHED | The visual system is a credibility instrument, not decoration. Every pixel is held to "would a board member trust this?" |
| **Labor illusion** (Buell & Norton, *Management Science*, 2011): people value results more when they can see the effort behind them, and some prefer a slower, visibly working service over an instant, opaque one. Blind progress bars did not help; *specific* work shown (which airlines are being searched) did. | RESEARCHED | The Agent Ledger is not an engineering log. It is the product's strongest persuasion device. It must show *specific* work in plain language ("Reading what people near the site over-index on"), never "Processing…". |
| **Fluency feels like truth** (Reber & Schwarz, 1999; Schwarz's later reviews): statements that are easier to read feel more true, independent of whether they are true. | RESEARCHED | This is double-edged and drives one of my most important decisions: **calibrated fluency** (Section 3.3). A product built on honesty must not let high-contrast typography make weak evidence feel strong. |
| Nielsen's response-time limits: 0.1 s feels instant, 1 s keeps flow, 10 s is about where attention leaves. Past 10 s, show percent-done and a way to stop. For unknown-length work, show the absolute amount of work done. | RESEARCHED | A Zorq run takes tens of seconds. The ledger doubles as the progress indicator, with a visible call budget ("47 of about 200 lookups") and a "Stop and show best so far" control. |
| Microsoft's 18 Guidelines for Human-AI Interaction include: show how well the system can do what it does, match the precision of the UI to the system's real precision (language *and* numbers), support efficient correction, explain why the system did what it did, and provide global controls. | RESEARCHED | Validates the spec's choice of relative bands over decimals. Gives me a checklist for S1 to S5 (Section 12). |
| Colour psychology is context-dependent. Elliot's review says the meaning of a colour depends on its physical and psychological context, and that the theory is still immature. | RESEARCHED | I do **not** justify the palette with "black means luxury". I justify it with function (Section 3). Anyone quoting colour-symbolism at a judge is on weak ground. |
| Dark-on-light text is read more accurately than light-on-dark across ages (the "positive polarity advantage"; Piepenbrock et al.), linked to display brightness and pupil size. | RESEARCHED | White background is correct for a reading-heavy product. Inverted black blocks are allowed, but small, with larger and heavier type, because they are the harder polarity to read. |

### 1.2 Data-visualisation science (this is why black and white works so well here)

- **Cleveland & McGill and Bertin**: position on a common scale and length are decoded most accurately; area, saturation and hue are weaker. Colour is *near the bottom* of the accuracy ranking for quantities. Bertin's visual variables (position, size, value, texture, colour) give you four strong channels that need no hue at all. `RESEARCHED`
- **Connectedness beats proximity, size, colour and shape** as a grouping cue (Ware, 2004, as summarised in University of Washington course notes). `RESEARCHED`
- **Edge bundling and hairballs:** dense node-link graphs collapse into clutter; filtering and aggregation are the real fixes, and bundling creates ambiguity about who connects to whom. `RESEARCHED`

**What this means for Zorq:** a pool of 8 to 10 components has up to 45 pairwise edges. A force-directed graph of a nearly complete graph is a hairball by construction. So the product's central object is **not** a force graph. See Section 7 (S3) for the replacement.

### 1.3 Typography research

- **Raleway** began as a single thin display weight (Matt McInerney, 2010) and was expanded to nine weights by Impallari and Fuenzalida. Reviewers consistently say its light weights are fragile at small sizes; use 400 to 500 and more line height for text. `RESEARCHED`
- **Raleway's default numerals are old-style (lowercase-height) figures.** It ships lining figures and fixes exist via the `lnum` OpenType feature. For a product full of percentages and square footage this matters more than any other type detail. `RESEARCHED` (default old-style behaviour confirmed in the TeX package docs and a user report; whether the Google Fonts build ships lining by default is `UNVERIFIED`, so I specify `lnum` explicitly either way).
- **Bricolage Grotesque** (Mathieu Triay, open source) has three axes: weight 200 to 800, width 75 to 100, optical size 12 to 96. Small optical sizes are tamer and more neutral; large ones reveal exaggerated ink traps and eccentric details. The compressed widths lean "anxious and wonky". `RESEARCHED`
- The name is a gift. *Bricolage* means improvising something from whatever materials are at hand. Zorq does exactly that with cultural fragments. See Section 4.

### 1.4 What the best products have in common (and what I took)

I looked at how products people call "best designed" earn that reputation, then asked what fits Zorq specifically. Borrowing everything would produce a pastiche, so here is what I kept and what I refused.

| Reference | What they do that is true and transferable | What I took | What I refused |
|---|---|---|---|
| **Linear** | Near-achromatic UI with one accent; theme built in a perceptual colour space (LCH) from three inputs (base, accent, contrast); density as a feature for people who live in the tool | Build the neutral ramp from perceptual steps, not eyeballed hexes; allow a contrast control | Dark-first look. "Every SaaS looks like Linear" now; a dark, purple-accented Zorq would be forgettable. Also Linear's accent: I use none. |
| **Kayak (labor illusion)** | Shows each source it queries | Ledger design (1.1) | Fake delays. Zorq's work is real; showing it is enough. |
| **Dieter Rams / Braun** | "Good design is honest": it does not make a product seem more innovative, powerful or valuable than it is. "Unobtrusive: neutral and restrained, to leave room for the user's self-expression." | Honesty as the visual rule (calibrated fluency). Restraint so the *place's* culture is the expression. | Skeuomorphic Braun nostalgia |
| **Architectural drawing sets** | Line-weight hierarchy (darkest = foreground, faint = background), three line types (solid, dashed, chain), hatching for material, title block with sheet number and scale, north arrow, graphic scale, cross-references between sheets | The whole visual grammar (Sections 2 and 5) | Literal CAD chrome, blueprint-blue, technical monospace |
| **Apple Design Awards 2026** (Tide Guide: Charts & Tables won Visuals and Graphics) | I confirmed only the award and category, not how the app is designed. Treat it as a pointer that a data-first product can win on visuals, not as a source of technique. | Confidence that a chart can be the hero object | Any claim about its internals |
| **Qloo's own site** | Two interactive primitives already on their homepage: "Taste Context" (tap tastes, see the picture change) and "Geo Explorer" (heat on a map plus ranked places). They also stress that every result is explainable down to entities and affinities. | Zorq must feel like the *next* step beyond both: from "heat and a list" to "a tested composition". Evidence drawer language mirrors their "which entities, which attributes, which affinities". | Imitating their visuals; the sponsor's CTO has seen their own look many times |
| **Protomaps basemaps** | Ships `white`, `grayscale` and `black` flavours explicitly "for data visualization", with overridable colour objects | Map = `white` flavour, overridden (Section 7, S1) | Colourful default maps |

---

## 2. The concept, and why it beat the alternatives

I generated seven candidate directions before choosing, because grandmaster research (de Groot, Chase & Simon) says experts do not search *deeper* than weaker players; they generate *better candidate moves*. A weak designer polishes their first idea.

| # | Candidate | Verdict | Reason |
|---|---|---|---|
| 1 | Generic AI dashboard (cards, gradients, chat) | Killed | It is the median output. It is also the product the spec warns against. |
| 2 | Dark "mission control" | Killed | Contradicts the brief (white is the main colour), loses the positive-polarity reading advantage, and clones Linear/Vercel/Bloomberg. |
| 3 | Editorial magazine (big serif, long scroll) | Killed | A judge clicks around alone; scroll-narrative hides the agent's work. |
| 4 | Pure white-cube gallery | **Modified, not adopted whole** | See below. It has a failure mode. |
| 5 | Playbill / programme (theatre-programme typography) | Kept as a *print output* idea only | Charming for venue judges, too themed for a working tool. |
| 6 | Press/newsprint with halftone | **Kept as one technique** | Halftone dots are a legitimate monochrome encoding for heat. |
| 7 | **Architectural drawing set** | **Chosen as the grammar** | Matches the deliverable (a "Blueprint"), the audience (developers, real-estate, venue people read drawings), the palette (ink on paper), and the honesty rule (every line weight means something). |

**The failure mode of the white cube.** Brian O'Doherty's *Inside the White Cube* argues the gallery wall only *looks* neutral: it conditions what is shown, strips social and local context away, and signals exclusivity and expense. A white, quiet, minimal UI for a product whose whole thesis is *local context matters* would commit exactly that error. It would feel placeless. Marc Augé's "non-places" (airports, motorways, malls: spaces that are the same anywhere) are, not coincidentally, what Zorq's users are trying *not* to build.

So the rule: **Zorq is a white wall that lets the street in.** Concretely:
1. The map never leaves the screen in S1 to S4; at minimum it is a persistent thumbnail.
2. The site address and neighbourhood name are always in the header, set large enough to read.
3. Real local entity names appear everywhere instead of abstractions ("Sunset Rubdown" not "an indie artist").
4. Evidence images arrive in full colour (Section 3.4). The wall is white; the work on it is not.
5. No stock illustration, no abstract hero art. Ever.

---

## 3. Colour system

### 3.1 The rule

> **Black and white are the whole interface. Colour exists only inside evidence.**

This is deliberately stronger than "mostly monochrome with one accent". Linear-style products spend an accent colour on buttons and active states. I spend nothing on UI. Reasons, in order of strength:

1. **Perceptual science:** colour hue/saturation are the weakest channels for quantity (Cleveland & McGill). Zorq's key readings (coherence percentile, distinctiveness, edge strength) are quantities. Position, length, line weight, dot size and hatch density decode better, and all of them work in black and white.
2. **Simultaneous contrast:** colour looks more vivid against a neutral surround. A film poster on a pure white wall will glow more than the same poster on a branded blue UI.
3. **Honesty:** an interface with no decorative colour makes colour *informative*. When a judge sees a coloured image, they learn the rule within a minute: colour = something Qloo returned.
4. **Differentiation:** the dark/purple/gradient AI aesthetic is saturated. A confident ink-on-paper product is rare.
5. **Print and share:** the blueprint prints and photocopies perfectly. A placemaker can fax it to a landlord. Pure ink survives.

**Honest caveat:** this needs a fallback. If image URLs are not available from the API or cannot be displayed under the hackathon terms, the "colour = evidence" idea disappears. Section 3.4 specifies the typographic fallback that keeps the system coherent. This is spike D1 below. `UNVERIFIED`

### 3.2 The ramp

True black and true white, plus an **untinted** grey ramp. I chose untinted greys on purpose: tinted near-blacks (the "#0B0B0B / #111" move) are one of the commonest tells of generated design, and the brief says black and white.

Contrast ratios below were computed (WCAG formula), not guessed.

| Token | Hex | On white | Role |
|---|---|---|---|
| `ink` | `#000000` | 21.00:1 | Primary text, leader strokes, primary buttons, inverted blocks |
| `ink-800` | `#262626` | 15.13:1 | Body text where pure black would feel heavy in long passages |
| `ink-600` | `#595959` | 7.00:1 | Secondary text, captions |
| `ink-500` | `#6B6B6B` | 5.33:1 | Tertiary text; **"thin evidence" text** (see 3.3) |
| `ink-450` | `#767676` | 4.54:1 | **Lowest permitted text grey on white** (just passes AA) |
| `ink-350` | `#949494` | 3.03:1 | UI boundaries only (input borders, unselected nodes). Never text. |
| `ink-200` | `#D4D4D4` | 1.48:1 | Hairlines, gridlines, decorative rules. Never carries meaning alone. |
| `ink-100` | `#EEEEEE` | 1.16:1 | Hover fill, selected-row fill |
| `ink-50` | `#F7F7F7` | 1.07:1 | Drawer background, recessed regions |
| `paper` | `#FFFFFF` | n/a | The page |

Two derived facts worth knowing:
- `ink-450` on `ink-50` is only 4.24:1 and on `ink-100` is 3.91:1. **Rule:** `ink-450` text may only sit on pure paper. On grey fills, step up to `ink-600`.
- White on `#595959` is 7.00:1, so inverted chips can use `ink-600` as a "quiet inverted" level and `ink` as a "loud inverted" level.

### 3.3 Calibrated fluency (my most important colour decision)

Fluency research says high contrast makes statements feel truer. Zorq is a product *about* evidence strength. If a grade-C claim is set in 21:1 black bold type next to a grade-A claim, the typography lies.

So **contrast tracks evidence**:

| Evidence state | Text treatment | Line treatment |
|---|---|---|
| Confirmed (both measurement routes agree) | `ink`, weight 600 | Solid, heavy line |
| Typical | `ink-800`, weight 500 | Solid, medium line |
| Contested (routes disagree) | `ink-600`, weight 500 | Dashed line |
| Thin (fewer than 5 results) | `ink-500`, weight 500 | Dotted line |
| Unmeasured | `ink-450`, weight 500, italic not used | **Hatched** (spec rule: never fill unmeasured with guesses) |

Every level passes AA, so accessibility is intact. But the *felt* confidence of the page now rises and falls with the real evidence. A judge scanning the Blueprint will, without reading a word, feel which receipts are strong. This is the typographic version of the spec's "no invented confidence". `REASONED` (grounded in fluency research; the exact felt-confidence mapping needs the 5-second test in Section 14).

### 3.4 Where colour is allowed (the full list)

1. **Entity images** from the data source: artist photos, film posters, brand marks, venue photos.
2. **User-uploaded or map-sourced imagery**, if ever added. (Out of scope for now.)
3. Nothing else.

Treatment rules:
- **At rest in dense contexts** (ledger rows, DNA strip, Replace panel list): images are shown in greyscale at about 100% contrast, so the dense areas stay calm and print cleanly.
- **In focus contexts** (Evidence drawer, Blueprint receipts, Prior-vs-Final reveal): full colour. The shift from grey to colour on selection is the interaction's reward and also teaches the rule.
- Never crop faces awkwardly; never place text over images.

**Fallback if no images (UNVERIFIED, spike D1):** each entity becomes a **specimen tile**: its name set in Bricolage Grotesque at a large optical size inside a square, with a small domain mark (artist / film / brand) and a hatch pattern unique to the domain. Visually it reads as a typographic poster. Typography becomes the "colour". This is also elegant and fully on-brief, so the design does not collapse if images are unavailable.

### 3.5 Status without colour

Because there is no red/amber/green, status uses **shape, fill and line style** (Bertin's non-colour variables):

| State | Encoding |
|---|---|
| Running | Hollow circle with an animated half-fill |
| Done | Solid black circle |
| Rate-limited, retrying | Hollow circle with a dashed outline and "retry 2 of 3" text |
| Failed or not measured | Hollow circle crossed by a single diagonal line |
| Survived | Solid square |
| Revised | Square with one diagonal hatch half |
| Replaced | Square with a cross (an "X" in the cell) |

All paired with a word. Never shape alone.

---

## 4. Typography

### 4.1 The pairing and the idea behind it

- **Bricolage Grotesque**: display only. Large numbers, screen titles, the composition names, the landing line.
- **Raleway**: everything else. Interface, body, labels, receipts, tables.

The pairing is sound as contrast: Raleway is a calm, wide, geometric face; Bricolage is a quirky, historically layered grotesque. They are different enough to look chosen rather than accidental.

The *story* is the part that is hard to copy. Claude Lévi-Strauss's distinction (from his 1962 book *The Savage Mind*; I am citing this from memory, not from a source I opened this session): the **bricoleur** assembles meaning from the fragments at hand; the **engineer** designs from first principles. Zorq's spec has both: the agent is a bricoleur (it assembles a place from cultural fragments Qloo returns), and the code is the engineer (all numbers are deterministic). Setting the *results of assembly* in Bricolage and the *explanations* in Raleway lets the typography enact that split. I would put one sentence about this on /method. It costs nothing and it is the sort of detail a design-literate judge remembers.

### 4.2 Rules that fix Raleway's known weaknesses

1. **Never below 14 px** for readable text. The one exception is Micro (13 px, weight 600), used only for provenance badges and sheet references.
2. **Weight floor:** 500 below 16 px; 400 only at 16 px and up. Never use 100 to 300 for text; use 300 only for very large display (not needed, since Bricolage handles display).
3. **Line height 1.55** for body (Raleway is wide, and its even stroke weight tires readers over long passages), 1.25 for headings.
4. **Lining, tabular numerals everywhere numbers appear:** `font-variant-numeric: lining-nums tabular-nums` with `font-feature-settings: "lnum" 1, "tnum" 1` as a belt-and-braces pair. Confirm the build ships `tnum`; if not, set numbers in Bricolage. (Spike D2.)
5. **Line length 60 to 72 characters** for prose; receipts are narrower.
6. Raleway's distinctive capital **W** is a signature. Keep the default W. (Some builds offer a stylistic alternate; do not enable it. A built-in quirk is a free identity.)
7. **No all-caps labels**, no tracked-out eyebrows above headings. Sentence case, weight 600. (Both are template tells and both hurt scanning.)

### 4.3 Bricolage settings (it has more range than people use)

- `font-optical-sizing: auto` so it stays neutral small and expressive large. Optical size 12 to 96.
- **Width axis as a hierarchy tool:** use the narrow end (about 75 to 85) for very large numerals and composition names so they fit and feel urgent; use full width (100) for the landing line where calm authority is wanted.
- Weight 600 to 700 for display. Avoid 200 to 300 for display because the ink traps need mass to show.
- **Never** use Bricolage below about 24 px. At small sizes Raleway does the work.

### 4.4 Type scale (ratio 1.25, base 16 px)

I computed candidate scales. 1.25 gives steps that are distinct without exploding on a dense workspace screen; 1.333 jumps too far for a tool with small and large data in the same view.

| Step | Size | Face | Use |
|---|---|---|---|
| Display XL | about 76 px | Bricolage, narrow, 700 | S0 landing line only (desktop) |
| Display L | about 49 px | Bricolage, 700 | Blueprint title, composition name on the leader |
| Display M | about 31 px | Bricolage, 600 | The big readings (percentile), screen titles |
| Heading | 25 px | Raleway 600 | Section titles in Blueprint |
| Subheading | 20 px | Raleway 600 | Card titles, member names |
| Body | 16 px | Raleway 500 | All running text |
| Small | 14 px | Raleway 500 | Receipts, ledger rows, table cells. A deliberate floor, set between the scale's 12.8 and 16 steps. |
| Micro | 13 px | Raleway 600 | Provenance badges and sheet references only. About the scale's 12.8 step. |

Mobile: Display XL drops to about 40 px, and Display L to about 31 px. Nothing else scales.

### 4.5 Copy voice

Plain verbs, sentence case, active voice. Name things the way the user thinks, not how the system is built. Examples that set the register:
- Button: "Investigate this site" (not "Submit", not "Run agent").
- Ledger: "Reading what people near Broadway and 7th over-index on" (not "Fetching insights").
- Error: "We couldn't place that address. Pick a point on the map." (says what happened and what to do.)
- Empty state is an invitation: "No components measured yet. Start with a site."
- An action keeps its name across the flow: "Replace" is "Replace" on the button, in the panel title, and in the confirmation ("Replaced cinema with gallery").

---

## 5. Layout system, line weights and shape language

### 5.1 Grid and spacing

- **Base unit 8 px.** Spacing scale: 4, 8, 12, 16, 24, 32, 48, 72, 120.
- **Workspace (S1 to S4):** 12 columns, 24 px gutters, 64 px outer margin, max width 1440 px, then centred.
- **Reading screens (S5 Blueprint, /method):** a Tufte-style two-column layout. Main column 720 px, margin column 320 px, 48 px between. The margin carries *receipts*, so every claim sits next to its proof with no click needed. This is the single biggest credibility upgrade available to the Blueprint, because it puts evidence where the eye already is (Fogg: surface credibility is judged visually and fast).
- **Persistent chrome height:** top bar 56 px plus site line 48 px = 104 px. Everything else is workspace. On a 900 px tall window that leaves about 796 px; every workspace screen is designed to show its hero object inside that.
- Alignment: **left-aligned everywhere.** No centred body text. The only centred element is the S0 map's site marker.

### 5.2 Line weights (taken straight from drafting practice)

Drawings use a small set of pen weights so hierarchy is felt before it is read. Zorq uses five, in pixels:

| Token | Width | Used for |
|---|---|---|
| `L1` | 1 px | Gridlines, row dividers, histogram baseline (`ink-200`) |
| `L2` | 1.5 px | Control borders, card outlines (`ink-350`) |
| `L3` | 2 px | Selected state, focus ring, drawer edge, member rows in a chosen composition (`ink`) |
| `L4` | 3 px | Leader-composition edges, decision-card left rule (`ink`) |
| `L5` | 4 px | The chosen composition's outline in S3 and the verdict square in S4 |

**Hierarchy rule:** the darkest and heaviest thing on any screen is the thing the user should act on or trust most. Nothing decorative may use `L3` or above.

### 5.3 Line styles (drawing convention: solid = seen, dashed = hidden, chain = reference)

| Style | Meaning in Zorq |
|---|---|
| Solid | Measured and confirmed |
| Dashed (6 on, 4 off) | Contested evidence **or** the Prior layer (a "reference" assumption). Context tells which; the label always says. |
| Dotted (1 on, 3 off) | Thin evidence |
| Hatched fill (45 degrees, 4 px pitch, 1 px stroke) | Unmeasured. Never replaced with a guess. |

**Legibility guard:** at 1.5 px, dashed and dotted lines are hard to tell apart (blunder check, Section 14). So line style is *never* the only carrier: each is also paired with weight (3.3) and a word.

### 5.4 Shape language (so a judge can learn the whole system in a minute)

| Shape | Always means |
|---|---|
| **Circle** | A *process state* (running, done, retrying, failed) |
| **Square** | A *verdict or an object* (survived, revised, replaced; a component; a distinctiveness mark) |
| **Pill** | A *provenance badge* (where a claim came from) |
| **Rectangle with a 1.5 px border** | An *input* (constraint toggles, text fields) |

Radius follows role, not taste: sheets, panels, cards and buttons have **0 px** radius (drawn sheets have square corners); only pills and circles are round. This avoids the "one radius on everything" look and makes shape informative.

**Provenance badge encoding** (monochrome, three levels, mirrors the calibrated-fluency idea):

| Badge | Fill | Border | Reading |
|---|---|---|---|
| `Qloo` | Solid `ink`, white text | none | Measured data |
| `Zorq heuristic` and `Compute` | Paper | Solid 1.5 px | Our deterministic arithmetic or rule |
| `LLM` | Paper | **Dashed** 1.5 px | Model-written; least authority |

### 5.5 Elevation

None. No shadows, no blur, no glass. Layers separate by line weight and by an `ink-50` fill. Drawers carry an `L3` edge on the side they open from. This keeps the product printable and unmistakably not a template.

### 5.6 Iconography

Fourteen glyphs maximum, 24 px, 1.5 px stroke, square caps. The set: search, lock (Prior), check, cross, retry, stop, share, copy, print, replace, expand, collapse, help, external. If a concept can be a word, it is a word. No emoji, no decorative icons.

### 5.7 The hatch and mark library (design assets to make once)

1. Unmeasured hatch (45 degrees).
2. Domain marks for specimen tiles and legends: artist = vertical lines, film = horizontal lines, brand = dots.
3. Halftone dot (heat): dot diameter encodes affinity in three to five steps.
4. Break-line symbol (two short parallel diagonal strokes across a line): drafting shorthand for "this link is interrupted". Used on the **weakest link**.
5. North arrow and graphic scale bar on every map.
6. Revision block (small table) for Replace history on the Blueprint.
7. Wordmark: "Zorq" in Bricolage Grotesque 700, narrow width, tracking −0.02 em. A human eye must check the Z and Q kerning. Favicon: a Z in a 1.5 px square.

Per the drafting handbooks, hatch density has to match drawing scale and must never fill in solid when reduced. Patterns are defined at **fixed pixel pitch** (not scaled with zoom) and tested at 1x, 2x and in print (spike D3).

---

## 6. Navigation: tabs, screens, overlays

### 6.1 The count

| | Count | What |
|---|---|---|
| **Global destinations** | 3 | Brief (home), the Run, Method |
| **Run tabs** | **5** | Investigate, Compositions, Connections, Challenge, Blueprint |
| **Screens** | **8** | S0 Brief, S1 Investigate, S2 Compositions, S3 Connections (two views), S4 Challenge, S5 Blueprint, Without-Qloo compare, /method |
| **Overlays** | 4 | Evidence drawer, Replace panel, Without-Qloo compare modal, How-to-read legend |

Why five tabs and not three or eight: the run *is* a five-step story (look, propose, relate, attack, deliver) and each step has one hero object. Fewer tabs would stack two hero objects on one screen (the S3 failure mode). More would turn the story into a menu. The count is also within what people comfortably hold at a glance.

**Plain names** (replaces the spec's internal view keys): Investigate, Compositions, Connections, Challenge, Blueprint. "Compositions" stays because it is the product's own concept and the landing line teaches it. Internal route names stay as in the spec.

### 6.2 Sitemap

```text
Zorq
 |
 +-- /                  S0 Brief
 |
 +-- /run/:id           Run workspace (persistent: top bar + site line)
 |     |
 |     +-- Investigate      S1  map + ledger + DNA strip
 |     +-- Compositions     S2  headline + the Field + options
 |     +-- Connections      S3  Map of meaning | Distance chart
 |     +-- Challenge        S4  five attacks + verdict
 |     +-- Blueprint        S5  reading layout with margin receipts
 |
 +-- /run/:id/blueprint     S5 read-only share view (no top-bar tabs)
 |
 +-- /method                How Zorq measures; limits; how it can be wrong

Overlays: Evidence drawer | Replace panel | Compare (Without Qloo) | How to read
```

### 6.3 Tab behaviour

- Tabs unlock as phases complete (spec). **Locked tabs stay visible**, with a dashed underline and a one-line tooltip saying what will appear ("Appears when the agent has measured the relationships"). No mystery, no dead tab.
- A **sheet reference** sits after each tab name in small type: Z1, Z2, Z3, Z4, Z5. These are not decoration. They are cross-reference targets used inside receipts and risk notes ("weakest link, see Z3"). **Test: if the references are not clickable, delete the numbers.** Structural devices must carry information.
- The active tab has an `L4` underline, `ink` text, weight 600. Inactive: `ink-600`, weight 500. Locked: `ink-450`.
- Keyboard: left and right arrows move between unlocked tabs; `Esc` closes any drawer; `E` opens evidence for the focused edge. Three shortcuts only.

### 6.4 Global chrome (persistent in S1 to S5)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Zorq    Investigate Z1   Compositions Z2   Connections Z3   Challenge Z4   Blueprint Z5     │  56 px
│                                                          [New brief]   [How to read]        │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ 44 Berry St, Williamsburg, Brooklyn · 28,000 sq ft · Goal: creative destination  | Grade B  │  48 px
│ 47 of about 200 lookups · 31 cached · run started 14:02                                     │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

(The address above is a layout placeholder, not a recommended preset.)

- **Left, top bar:** wordmark (links to S0 with a "leave this run?" confirmation only if a run is in progress).
- **Right, top bar:** `New brief` (secondary), `How to read` (tertiary). Nothing else. No avatar, no settings, no theme toggle. There are no accounts, and the product is single-theme by decision.
- **Site line, left:** the address at Subheading size, weight 600, then sq ft and goal at Small. The place is always named (white cube that lets the street in).
- **Site line, right:** the **Evidence grade** as a square with a letter (A/B/C) and, on hover or focus, the rule that produced it, plus the **lookup counter**. These two are the permanent honesty instruments: they are on screen in every state.
- The drawing-sheet **title block** (project, site, scale, sheet, revision) appears as a designed object on the Blueprint and in print, not as persistent chrome.

---

## 7. The screens, placement by placement

Format for each screen: the question the user is asking, the hero object, layout, what goes where, buttons, states. The spec's behaviours are unchanged; this adds the visual and spatial decisions.

### 7.0 S0 Brief

**User state:** curious, unsure the tool is real. **Question:** "What will this do with my site?" **Hero object:** the map with the three preset sites, plus the landing line.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Zorq                                                                      [How to read]  │
├────────────────────────────────────────────────┬─────────────────────────────────────────┤
│                                                │                                         │
│                                                │  Design what belongs                    │
│        map: Protomaps white flavour            │  together on a site.     Display XL     │
│        full height, no controls clutter        │                                         │
│                                                │  Zorq reads the culture around a site,  │
│            ●  preset site                      │  tests which combinations of places     │
│                                                │  belong together, then tries to break   │
│                       ●  preset site           │  its own answer.                        │
│                                                │                                         │
│      ●  preset site                            │  Try a site                             │
│                                                │  ┌──────┐ Site name, area               │
│                                                │  │ crop │ 28,000 sq ft · one-line goal  │
│   north arrow    ├──────┤ graphic scale        │  ├──────┤ ...second preset...           │
│                                                │  ├──────┤ ...third preset...            │
│                                                │                                         │
│                                                │  Or describe your own site              │
│                                                │  [ Search an address            ]       │
│                                                │                                         │
│                                                │  Read, test, challenge. (3 steps)       │
└────────────────────────────────────────────────┴─────────────────────────────────────────┘
```

**Why this arrangement**
- Map is left and fills the height because **a place is the subject** and the map is the proof that this is not another chat box. The right column holds the decision.
- The landing line is a complete sentence in one weight, no highlighted word. It tells the user what the product does in the verb "design" and what it designs in "what belongs together".
- **Presets are the primary action, above the custom form.** A judge who clicks around alone should reach a running investigation in one click, so the three presets come first and the custom path is the secondary invitation. (Hick's law: reduce the first decision to "pick one of three".)
- **Hover or focus on a preset flies the map to its site** and draws the radius ring (a chain line). The page answers the pointer within 100 ms (Nielsen's direct-manipulation limit).
- The three-step strip at the bottom is a true sequence, so numbering is legitimate: 1 Read the culture. 2 Test combinations. 3 Challenge the answer. It sits at Small size, quiet.

**Preset selection (design brief for the spike that picks them, spec Spike 5):**
1. **A gut-check site** in a neighbourhood a broad audience can sanity-check from their own knowledge. Qloo's own site lists its office on Crosby Street in New York, which makes New York an obvious candidate, but I do not know where each judge lives, so let the spike pick the city that is both well covered by the data and widely known. An expert trusts a tool when it passes a test they can run in their own head. That is the strongest trust move available to a solo viewer.
2. **A venue-led brief** (an entertainment district or event-led site) because one judge works in live entertainment and another in real-estate-style investing. They will grasp it instantly.
3. **A control** where Qloo mostly confirms the Prior (spec's honest control case). Do not label it as a control on S0; the Blueprint will say so itself. Unlabelled, it builds credibility when it happens.

**The custom form (expands from "Or describe your own site")**
Order is by necessity, not by importance, and it *grows as you answer* (progressive disclosure):
1. **Address search** (56 px tall, search glyph at the left). Only mandatory field.
2. When the address resolves, the card expands: **Area (sq ft)** (140 px wide) and **Goal** (flexible width, 200 characters), side by side.
3. **Constraint toggles** as rectangles (not pills; pills are reserved for provenance): No late night, No loud venue, Ground floor only, plus Custom. Order adapts to the site type (spec).
4. **Places we admire (optional):** up to three, each shown with a greyscale thumbnail, a name and a remove cross.
5. **Primary button: "Investigate this site"**, full width, 56 px, solid `ink`, white text at weight 600. The only filled element in the card.
6. Below it, a tertiary link: "How Zorq measures".

**Empty and error states**
- Geocode fails: "We couldn't place that address. Pick a point on the map." and the map takes a crosshair cursor.
- Data search is down: autocomplete for admired places is disabled with a note; the run still works (spec).

### 7.1 S1 Investigate

**User state:** waiting, but ready to be convinced. **Question:** "What is it actually doing?" **Hero objects:** the Agent Ledger and the map heat, equally weighted; the Prior card as a quiet third.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ top bar + tabs                                                                            │
│ site line                                                                                 │
├───────────────────────────────────────────────────────────┬──────────────────────────────┤
│  ┌ Before looking ┐                                       │  What Zorq is doing          │
│  ┊ dashed border  ┊                                       │  [Stop and show best so far] │
│  ┊ lock 14:02:11  ┊                                       │ ─────────────────────────────│
│  ┊ components...  ┊     halftone heat (black dots)        │ ● Located the site      0.4s │
│  └ no cultural    ┘                                       │ ● Read local anchors  Qloo   │
│       data used            ◎ site, dashed radius ring      │ ○ Decision: chose anchors    │
│                                  ■A  ■C  anchor squares    │   Question / Evidence /      │
│                              ■D                            │   Chose / Rejected           │
│  N↑   ├──┤ 400 m                                           │ ◐ Reading what people near.. │
├───────────────────────────────────────────────────────────┴──────────────────────────────┤
│ Cultural DNA   Artists | Films | Brands   dumbbell dot plots: ● local  ○ city            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensions:** map about 56% of the width, ledger fixed at 480 px, DNA strip 220 px high and collapsible.

**Map details**
- Heat is drawn as a **halftone dot grid**: black dots, diameter encodes affinity in four steps. (Monochrome-native, and a nod to print; position and size are strong channels.)
- Site marker: a circle with a crosshair. The search radius is a dashed ring (a chain line, "reference").
- **Anchor pins are small solid squares with letters A to E.** The same letters appear in the ledger's decision cards and in the DNA strip, so the eye can travel between map and text. This is a real cross-reference, not decoration.
- North arrow bottom-left and a graphic scale bar bottom-left. Drawing conventions treat both as non-negotiable orientation aids.
- Unpin control appears on each anchor on hover or focus ("Not representative"), per the spec's first chance to correct the evidence.

**Prior card (top-left of the map)**
- Dashed `L2` border (the Prior is a reference layer), a lock glyph and the lock time, the heading **"Before looking"**, and the five-ish component names as a plain list.
- Footer line: "No cultural data used." This sentence is the promise the whole product is built on, so it is always visible, never hidden in a tooltip.
- Collapses to a small tab labelled "Before looking" so it never covers the heat.

**The Agent Ledger (right column)**
- Header: "What Zorq is doing" (Subheading) and a tertiary "Stop and show best so far". No spinner anywhere.
- **Rows (40 px):** state circle, plain-language label (Raleway 500, 14 px), a kind pill (`Qloo`, `Compute`, `LLM`) and a tabular duration at the right. Click expands to the endpoint, parameters (key redacted), result count, live-or-cached. This expansion is the proof-of-integration technical judges want.
- **Decision cards** interleave: an `L4` left rule marks them as heavier than ledger rows. Four labelled lines: **Question, Evidence, Chose, Rejected**. The labels here are structure (they are the same four labels every time), so they earn their place.
- **New rows appear only when real calls complete.** No artificial delay. The labor-illusion research is about showing *real* effort; manufactured pauses would be dishonest, and the spec's whole premise is honesty.
- Auto-scroll to the latest row; if the user scrolls up, a tertiary "Jump to latest" appears.
- **Progress, by Nielsen's ladder:** the first meaningful row must appear within 1 s; by 10 s there must be visible interim artefacts (heat on the map, anchors placed). The call budget is shown in the site line ("47 of about 200 lookups"), and it is a true percent-done indicator for a bounded job.

**The DNA strip**
- Three side-by-side groups: Artists, Films, Brands. Each lists five or six entities.
- Each entity row: greyscale thumbnail (40 px), name, and a **dumbbell dot plot**: a solid dot for local affinity, a hollow dot for the city, on a shared horizontal scale; the gap *is* distinctiveness. Cleveland's dot plot is the high-accuracy encoding (position on a common scale), and it is monochrome. It replaces the bar-chart convention.
- Each row opens the Evidence drawer.

**Feel picks (adaptive step)**
- When DNA completes, a card slides into the ledger: "Which of these feel like the place you want?" Six real local entities as selectable tiles, **in full colour** (focus context; the user is judging feel, so the world appears).
- Selected = `L3` border plus a check glyph. Controls: tertiary "Skip", secondary "Use these".
- Only one primary button exists on the screen at a time. While running there is none; when the run completes, "See compositions" becomes the primary and docks at the ledger's bottom edge.

**States**
- Rate limit: the ledger row's circle becomes dashed with "retrying, 2 of 3".
- Thin data at site scale: a decision card appears: "Thin data here. Widening to neighbourhood scale." (an agent decision, shown, never silent).
- Hard failure: partial results remain visible, with a "Retry" secondary button.

### 7.2 S2 Compositions

**User state:** the first payoff moment. **Question:** "What are my real options, and where did the evidence disagree with the agent's first guess?" **Hero object:** the **Field**, a single shared histogram of every valid combination, with the options dropped onto it.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ top bar + tabs                                                                            │
│ site line                                                                                 │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  The evidence moved 3 of 5 components.                                       Display M   │
│                                                                                           │
│  THE FIELD   all 252 valid combinations from this pool, by coherence                      │
│        P ┆        ┃A           ┃B                  ┃C                                      │
│  ▁▂▃▅▇██▇▆▅▅▄▃▃▂▂▁▁▁                                                                      │
│  10th        30th        50th        70th        90th       (percentile ticks)            │
│                                                                                           │
│  Familiar ──────────●────────── Distinctive    (dial, default centre)                     │
│                                                                                           │
│ ┌ Prior ┄┄┄┐ ┌ A  name ──────┐ ┌ B  name ───────┐ ┌ C  name ────────┐                      │
│ ┊ dashed   ┊ │ roles + members│ │                │ │                 │                      │
│ ┊ readings ┊ │ readings       │ │                │ │                 │                      │
│ └┄┄┄┄┄┄┄┄┄┄┘ └────────────────┘ └────────────────┘ └─────────────────┘                      │
│                          [ Show the connections ]   Challenge the leader                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Why the Field is the hero:** the spec's most convincing number is "more coherent than 91% of 252 valid combinations". A sentence asks the reader to trust it; a picture lets them *see* it. One histogram with four markers also lets the eye compare all options by **position on a common scale**, the most accurate channel. It also makes the Prior (a dashed marker) honest: if the Prior sits at the 70th percentile, the user sees that. Honesty as a visual.

**Details**
- **Headline** (Display M), generated from the diff: "The evidence moved 3 of 5 components." It says the news in one line. For the control preset it must read "The evidence confirmed the first guess." and be equally prominent.
- **Field:** bars in `ink-200` with an `L1` outline; markers are vertical lines: Prior dashed `L3`, A, B, C solid `L3`; the leader's marker is `L5`. Labels sit above the markers. Percentile ticks, no absolute numbers (matches the spec's "relative bands").
- **Dial** ("Familiar to Distinctive", right under the Field): a native-feeling slider with a 44 px thumb, shows the weight value and "default". Dragging re-ranks client-side; cards slide into new positions (250 ms).
- **Cards:** the Prior is pinned at the far left with a dashed border and a lock glyph. A, B, C follow in rank order. Widths: 280 px for the Prior, then 320 px each, 24 px gutters.
- Inside each card:
  - Name in Bricolage at 25 to 31 px, LLM-named, two or three words.
  - Members grouped by role as 44 px rows: role word (Raleway 600, `ink-600`), member name (Raleway 600, `ink`), and a **square** at the right: filled if the member over-indexes locally, hollow if not.
  - Three readings in a fixed order: coherence percentile (Display M number), distinctiveness ("4 of 5 over-index locally"), weakest link ("Café and cinema, weak" with the break-line mark).
  - An **Evidence grade** square with letter (rule shown on hover).
- **Buttons:** primary "Show the connections" under the leader. Secondary "Challenge the leader". The primary is always at the bottom right of the main region and mirrored nowhere else, so the user learns where "forward" lives (Fitts: stable target location).
- **First-view re-inking** (the single orchestrated motion, Section 8): the Prior's members appear in dashed linework; the leader's members then draw in solid, kept items staying put, new items drawing in, removed items being struck through. Under two seconds. Reduced-motion users get the final state with a static legend.

**Error state:** fewer than three valid compositions: show those that exist, with "Only N valid combinations from this pool."

### 7.3 S3 Connections

**User state:** "show me why these belong together." **Hero object:** the relationships between components. This is the screen the whole product is about ("relationships between components, not ranking businesses"), so it must be the most carefully designed.

**The problem with a force-directed graph here.** With K of about 8 to 10 components, every pair has an edge: up to 45. A force layout of a near-complete graph collapses into a hairball and the layout moves every time something changes, destroying the user's mental map. Dense-graph research is clear that filtering and aggregation fix this, and edge bundling adds its own ambiguity about who connects to whom.

**So S3 offers two views of the same numbers, both monochrome:**

#### View A: Map of meaning (default)

- Place the nodes **once**, by multidimensional scaling of (1 minus edge strength), so *distance on the page means how much culture two components share*. Closeness is meaning. (Gestalt proximity, but made truthful.)
- Positions never move after the first layout, even when the user selects a different composition. The mental map is preserved.
- **Draw lines only for the selected composition.** Connectedness is the strongest grouping cue, so connecting exactly the chosen members says "these belong together" without drawing 45 lines. Non-members remain small hollow squares, dimmed to `ink-350`.
- Line weight and style encode evidence state (Section 3.3): confirmed = solid `L4`, typical = solid `L3`, contested = dashed, thin = dotted, unmeasured = hatched band.
- **The weakest link** carries the break-line mark at its midpoint and pulses **once** on arrival, then rests. No permanent animation.
- A graphic-scale note, in the drafting spirit: "Distance shows shared culture. Nearer means more shared. The axes have no meaning."
- **Honest fidelity note:** a 2-D map of ten items always distorts something. Compute the map's stress (code, cheap) and show one plain sentence under the scale: "This map keeps most pairwise distances accurately. 2 pairs are drawn closer than they are." If distortion is high, say so, and point the user to View B. (Spike D4.) A product that admits its own picture is imperfect is rare, and it is exactly the Zorq voice.

#### View B: Distance chart (secondary, and the accessible equivalent)

- A **triangular matrix like the mileage table in a road atlas.** Component names sit on the diagonal; each of the 45 cells holds a halftone dot sized by relative band (none, small, medium, large). Unmeasured cells are hatched.
- Pairs in the selected composition have an `L3` outline; the weakest pair has the break mark.
- This is the precise view for people who want to read every pair and the screen-reader-friendly view (it can be exposed as a sorted list).
- It is also an **immediately legible metaphor** for the audience: place professionals have used atlas tables all their lives.

```text
┌──────────────────────────────────────────────────────────────┬───────────────────────────────┐
│ Selected: A  name   members listed in role order               │  Evidence                     │
│                                          [ Map of meaning | Distance chart ]                   │
│                                                              │  (empty until a line or cell  │
│        ▫ Gallery                                             │   is chosen)                  │
│                      ■──────────■  Cinema                    │                               │
│     ▫ Bookshop        \         / (heavy solid = confirmed)  │  "Choose a line to see the    │
│                        ■──┤┤──■    Café  (break mark =       │   culture its two audiences   │
│                      Listening      weakest link)            │   share."                     │
│                                                              │                               │
│  Distance shows shared culture. Axes have no meaning.        │                               │
│  This map keeps most distances accurately.                   │                               │
├──────────────────────────────────────────────────────────────┴───────────────────────────────┤
│ Weakest link: Café and cinema.   The two audiences share little beyond popular entities.       │
│                                              Compositions    [ Challenge the plan ]            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Interactions**
- Click a line (or a matrix cell): the **Evidence drawer** opens in the right column (Section 7.6). Hover shows a small tooltip with the pair names.
- Click a node: a **node sheet** replaces the drawer content: exemplar places (real names, colour images), the path (anchor, entity, category), and a secondary button **Replace**.
- Switch composition via a small selector at the top-left ("A, B, C, Prior"); the lines redraw on the fixed node positions.
- **Primary button, bottom-right:** "Challenge the plan." It is the natural next step.
- **Mobile:** View B becomes a sorted list of pairs with band chips; View A is not offered (it needs width).

### 7.4 S4 Challenge

**User state:** suspicious, which is right. **Question:** "Did the agent try to break its own answer, and what happened?" **Hero object:** the **verdict**, preceded by five visible attacks.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ■ Survived                                                                  Display L   │
│  The leader held against all five attacks. One member was substituted without loss.        │
├──────────────────────────────────────┬───────────────────────────────────────────────────┤
│  Five attacks                        │  The leader, as drawn                             │
│  ● Remove a member                   │   Anchor     Cinema                               │
│     Without the anchor, coherence    │   Social     Café                                 │
│     fell to the 61st percentile.     │   Discovery  Design and publishing                │
│  ● Substitute a member               │   Night      ───Listening room───  (struck, then  │
│     ...                              │               Listening bar        replaced)      │
│  ◐ Bridge the weakest link           │                                                   │
│     Looking for what both audiences  │   changes animate here, in place                  │
│     love...                          │                                                   │
│  ○ Shift the catchment               │                                                   │
│  ○ Check the rival                   │                                                   │
│                                      │                       [ Open blueprint ]          │
└──────────────────────────────────────┴───────────────────────────────────────────────────┘
```

**Details**
- **Verdict banner** is the screen's top element once it exists: a verdict **square** (solid = survived, half-hatched = revised, crossed = replaced) plus the word at Display L, plus a one-sentence reason. Always the reason (spec).
- **Before the verdict exists**, the banner slot shows the question "Can the leader be broken?" in the same size, so the layout does not shift when the answer arrives (no layout shift is a credibility rule).
- **Five attacks** in plain language, in the spec's order: *Remove a member* (ablation), *Substitute a member*, *Bridge the weakest link*, *Shift the catchment*, *Check the rival*. Each row: circle state, name (Raleway 600), a one-line "what it asks" in `ink-600`, and, when complete, one result sentence and a tiny before/after mini-diagram (the member names, struck or added).
- The active attack has the half-filled circle. A failed probe shows the crossed circle and "not completed", and the grade is capped at B (spec). A failed attack is not hidden to protect the mood.
- **The leader, as drawn** (right column) is the S2 member list in Final style. Changes animate in place: removal = a line strikes through the name; substitution = new name slides in beneath the struck one; both remain legible until the user moves on. The user sees the *argument*, not just the outcome.
- **Primary button:** "Open blueprint" appears bottom-right only when a verdict exists.
- If the leader is **replaced**, the banner says "Replaced by {Rival}" and the right column redraws the rival. Never silent.

### 7.5 S5 Blueprint

**User state:** deciding whether to rely on this. **Question:** "Could I put this in front of my board?" **Hero object:** the Blueprint as a readable document with receipts in the margin. It is also the object most likely to be remembered (Kahneman and Fredrickson's peak-end rule, cited from memory: peaks and endings weigh heavily in how an experience is recalled).

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ top bar + site line                                                                       │
├───────────────────────────────────────────────────┬──────────────────────────────────────┤
│ TITLE BLOCK (drafting style)                      │  margin (receipts)                   │
│ Project | Site | Area | Constraints | Grade | Rev │                                      │
│                                                   │                                      │
│ Composition name                      Display L   │                                      │
│ One paragraph of rationale with superscript 1 2 3 │  1  [Qloo] Anchor path: [dot]--[dot] │
│                                                   │     colour thumbnails x3, names      │
│ Anchor        Cinema (micro-screening format)     │  2  [Qloo] shared by cinema and café │
│               footprint bar ▬▬▬▬▬                 │     entities...                      │
│ Social        Café                                │                                      │
│ ...           ...  [Replace]                      │                                      │
│                                                   │                                      │
│ Fit to site   stacked footprint bar; hours bars   │                                      │
│               ░░░░ hatched band = not permitted   │                                      │
│                                                   │                                      │
│ What Qloo changed   slope chart: Prior | Final    │                                      │
│                                [ Without Qloo ]   │                                      │
│ Risks                                             │                                      │
│ Evidence grade and method link                    │                                      │
│ Revision block: Rev 0 Rev 1 ...                   │                                      │
│                                                   │                                      │
│  [ Share blueprint ]   Copy as Markdown   Print   │                                      │
└───────────────────────────────────────────────────┴──────────────────────────────────────┘
```

**Section by section**

1. **Title block** at the top, in the drafting convention: a bordered strip with Project, Site, Area, Constraints, Evidence grade, Revision, Date, Run ID. It does four jobs at once: it looks like a professional deliverable, it records provenance, it prints, and it is a visible nod to the product's metaphor. Type: Small, labels in weight 600 `ink-600`, values in weight 500 `ink`.
2. **Title and rationale.** Composition name at Display L (Bricolage). One paragraph (max 70 characters wide lines) in Raleway 16 px, 1.55 line height, with **superscript numerals** that match margin receipts. The rationale may cite only evidence the ledger contains (spec). Paragraph carries the `LLM` pill at its top-right corner (dashed outline) because it is model-written; the receipts carry `Qloo` pills. The two are visually adjacent, so the user can see which is voice and which is data.
3. **Composition by role.** Rows, not cards. Left: role word (Raleway 600, `ink-600`). Centre: member name (Heading, 25 px), chosen format and footprint range (Small), a **footprint bar** (length against the available area; common scale across rows). Right: a tertiary **Replace** button. The row's `L3` left rule appears on hover or focus.
4. **Receipts in the margin.** For each member, two or three: the path (anchor place, entity, category) drawn as **three dots on a line** with labels, three **colour thumbnails** of real entities, and one sentence in plain language. This is where colour appears in the Blueprint, and it is where the eye lands. Because the margin is adjacent to the claim, there is nothing to click to check.
5. **Fit to site.** A stacked horizontal bar of footprints against the total area, with the circulation allowance shown as a hatched segment (honest about the 85% rule). Below it, an **hours timeline** (24 h axis; each member's hours as a bar), with the constraint (for example "No late night") drawn as a hatched forbidden band. Every downshift is a sentence in the form the spec gives: "Cinema becomes micro-screening. Role preserved: Anchor."
6. **What Qloo changed** (the key honesty section). A **slope chart**: Prior items listed on the left in dashed type, Final items on the right in solid type, with connecting lines: *kept* = straight across; *reformatted* = straight with a small marker; *removed* = a line that ends in a cross; *added* = a line that begins with a dot. No colour needed, and the diff is understandable in two seconds. Beneath it, one plain sentence. The **"Without Qloo" button** (secondary) opens the compare modal.
7. **Risks.** The weakest edge (with the break mark and a cross-reference "Z3"), thin-evidence components, contested edges, constraint conflicts. Written as plain sentences, not a list of alarm icons. Honesty is more convincing quietly.
8. **Evidence grade and method link.** The A/B/C square, the rule that produced it, and a link to /method.
9. **Revision block** (bottom): every Replace adds a row: "Rev 2. Replaced bookshop with gallery. Coherence moved from 70th to 74th percentile." This is a real drafting feature, and it makes the Replace interaction feel like professional, accountable work.
10. **Actions, bottom of the main column:** primary **Share blueprint** (copies the URL, then the button label changes to "Link copied" for 2 seconds, and a plain status line confirms "Anyone with the link can read this snapshot"). Secondary: Copy as Markdown, Print or save PDF.

**Print:** a landscape sheet. Title block in the bottom-right (the drafting position), margin receipts rendered as endnotes in a second column, hatch patterns tested to not fill in at print scale. Grayscale-only, so nothing is lost on a black-and-white printer. Colour thumbnails print in greyscale; their names carry the meaning.

**Without-Qloo compare modal**
- Two columns: **left, "What the agent would have recommended with no cultural evidence"** (the frozen Prior plus the LLM-only polish generated at run start, so the comparison is fair); **right, "Zorq's final"**. Differences carry an `L4` left rule and a small inverted tag "changed".
- Modal width 960 px. Close with `Esc` or a visible Close button (tertiary).
- If the two are the same: the modal opens with one plain line at Display M: "Here, the evidence changed nothing." Then the two columns. This is the control-case moment and it must be as visually confident as a success.

### 7.6 Overlays

**Evidence drawer** (right, 400 px, `ink-50` background, `L3` left edge). Content order:
1. The claim as one sentence (Raleway 600, 16 px).
2. The provenance pill.
3. "Shared by both audiences": entity tiles in **full colour** (three visible, "show all" tertiary), with a length-encoded weight bar under each.
4. Triangulation line: a shape (solid square = agrees, half-hatched = disagrees) plus a sentence: "Direct check agrees: places of this type rank in the top half for the other audience."
5. "How this was computed": one sentence and a link to its anchor on /method.
6. "See the lookups": links that open the matching ledger rows (cross-reference to Z1).

**Replace panel** (right, 440 px). Heading "Replace {member}". Line: "Keeps the role: Anchor." Then three to five alternatives from the pool, each a row with the name, a one-line format hint, and **two small diverging bars** (coherence change and distinctiveness change; a centre baseline, left = lower, right = higher; relative bands, no decimals) plus "Weakest link becomes: gallery and café". At the bottom, a free-text "Something else" field that resolves and measures (spec, at most 4 calls) and a primary **"Replace with {name}"**. Confirming triggers a mini challenge pass, shown as two ledger-style rows inside the panel, then the panel closes and the Blueprint gains a revision row.

**How-to-read legend** (modal, 720 px). A drawing-style legend block with five small sections: *Line weights*, *Line styles*, *Hatches and marks*, *Shapes* (circle, square, pill), and *The colour rule*: "Colour appears only inside evidence from Qloo." Auto-offered once, as a small call-out beside the "How to read" button after the Prior card appears; dismissed for the session when ignored. It is the only onboarding the product has; there is no tour.

### 7.7 /method

A long-form reading page in the Blueprint's two-column layout, with the same title block at the top ("Method, rev 1"). Sections:
1. **What Zorq measures** in plain words, then each formula from the spec (IDF-weighted shared-culture edge, null-model percentile, distinctiveness, triangulation, evidence grade) with a **worked example** using real entities from a preset, so the arithmetic is concrete.
2. **What is a heuristic**, listed and marked editable (format library, role map, 85% rule).
3. **How Zorq can be wrong**, the spec's known limits stated on the page before a judge finds them.
4. **A short note on the type** (two sentences on the Bricolage and bricoleur idea, Section 4.1).
5. **Open source and how to run it.**

Design purpose: this page is where the Technological Implementation judge and the Qloo CTO decide whether the product is serious. It must look as considered as the app, because credibility is judged visually first and rationally second.

---

## 8. Motion

Principle: **motion answers an action or marks one real event. It never decorates.** Scroll-triggered entrances, hover lifts on cards and staggered fade-ins on every section are the commonest tell of a generated page; none appear.

| Motion | Duration | Trigger | Why it exists |
|---|---|---|---|
| **Re-inking** (S2 first view) | under 2 s total | The first time the user lands on S2 for a run | The product's one orchestrated moment: dashed Prior lines become solid evidence. Kept items stay, new items draw in (stroke-dashoffset), removed items are struck through. |
| Ledger row arrival | 120 ms fade | A real call completes | Real work, shown when it happens |
| Weakest-link pulse | one 600 ms pulse | Arrival on S3 | Directs attention once, then rests |
| Drawer open and close | 200 ms ease-out | User action | Shows where the panel came from |
| Dial re-rank | 250 ms (FLIP) | User drags the dial | Shows *what moved*, not just the new order |
| Tab underline slide | 150 ms | Tab change | Orientation |
| Map fly-to on preset hover | 400 ms | Pointer or focus | Direct manipulation: the map answers the cursor |
| Colour thumbnails: grey to colour | 150 ms | Selection or focus | Teaches the colour rule through the interaction itself |

- **Page transitions:** none. Instant. Under 0.1 s the system feels like it is reacting directly.
- **Reduced motion:** every item above has a static equivalent. Re-inking becomes an instant final state with a one-line legend: "Dashed = the first guess. Solid = after evidence."
- **No sound.** (Considered and rejected: a faint pen-on-paper sound for the re-inking. It would delight once and annoy a judge on a third run in an open office.)

---

## 9. States and copy that carry the trust

Failure and emptiness are moments for direction, not mood. The interface voice never apologises and is never vague about what happened.

| Where | Situation | Copy and behaviour |
|---|---|---|
| S0 | Address can't be placed | "We couldn't place that address. Pick a point on the map." |
| S0 | Admired-places search down | "Place suggestions are unavailable. You can still investigate this site." |
| S1 | Rate limited | Ledger row: "Retrying (2 of 3)". No modal. |
| S1 | Thin data at site scale | Decision card: "Thin data here. Widening to neighbourhood scale." Evidence grade capped at B and the site line shows why on hover. |
| S1 | All data down | "The cultural data service isn't responding. Here is the first guess, which uses no data. Retry when you're ready." Shows the Prior only; **never fabricates evidence**. |
| S2 | Fewer than three compositions | "Only {N} valid combinations from this pool." |
| S3 | Unmeasured pair | Hatched cell and "Not measured. This pair can't be part of a leading composition." |
| S4 | A probe failed | "Not completed" row; grade capped at B; reason in one line. |
| S5 | Control case (Qloo changed nothing) | Display M: "Here, the evidence changed nothing." followed by what that implies. |
| S5 | Snapshot expired | "This snapshot has expired. Re-run the same brief." with one primary button. |
| Any | Model invented an entity | Ledger row: "Removed: not in the data results." |
| Any | Browser back | Returns to the previous view; the run continues. |

**Naming consistency (so the vocabulary teaches itself):** "Investigate" is the tab, the button ("Investigate this site") and the ledger header's verb. "Replace" is Replace everywhere. "Challenge" is the tab, the verb and the primary button ("Challenge the plan"). "Share blueprint" produces "Link copied".

---

## 10. Accessibility and responsive behaviour

### 10.1 Accessibility (a floor, not a feature)

- **Contrast:** every text colour in Section 3.2 is at or above 4.54:1 on paper. `ink-450` is never placed on a grey fill (it falls to 3.9 to 4.2:1 there). Non-text boundaries use `ink-350` (3.03:1 on white), which clears the 3:1 non-text threshold.
- **Never colour alone** (there is no colour to depend on), and **never line style alone**: every encoding has a word or a second channel.
- **Focus ring:** a double ring, 2 px `ink` with a 2 px `paper` gap outside it, so it reads on both white and black fills. Visible on every interactive element, never removed.
- **Targets:** at least 44 px high and wide for primary controls (above the 24 px WCAG 2.2 minimum), because the dial and the graph are pointer-fine tasks on touch devices.
- **Graph alternative:** View B exposes a sorted list of pairs with their bands. The map is `aria-hidden` with a pointer to the list. Screen-reader users get the same facts.
- **Ledger announcements:** `aria-live="polite"`, batched every few seconds so the log doesn't spam. Decision cards announce as headings.
- **Zoom:** layouts hold at 200% without horizontal scroll; hatch patterns are fixed-pitch, so they don't blur or fill in on zoom.
- **Inverted blocks and halation.** White-on-black is the harder polarity to read (the polarity research above). Accessibility practitioners also report that very bright-on-dark text can appear to glow for some readers, for example people with astigmatism; I found that in practitioner writing, not in a primary study, so treat it as a precaution. Rule: inverted regions are small (badges, the `Qloo` pill, the primary button), and text inside is at least 16 px and weight 600. No large black panels with long text.
- **Contrast control (stretch):** a single "Soften contrast" toggle in /method's settings that shifts `ink` text to `ink-800` for readers who find pure black harsh. Costs one token and respects a complaint practitioners raise about pure black on white.

### 10.2 Responsive

| Width | Behaviour |
|---|---|
| 1200 px and up | The designed experience. Judges most likely arrive here. |
| 768 to 1199 | S1: map becomes the top 40%, ledger below, DNA strip a horizontal scroll. S2: the Field stays; cards become a horizontally scrolling row. S3: View A is offered at reduced size; View B is the default. |
| Below 768 | Tabs become a **bottom tab bar** (five items; this is the platform maximum). The site line collapses to a one-line chip that expands. S3 is a sorted pair list only. S5's margin receipts move **inline under each claim** (the margin collapses into the flow). Display XL drops to about 40 px. |

Design the 1200+ layout first and perfectly; make the narrower ones *not break*. The spec's own judgement (judges click around alone, on their own devices) means a broken mobile view costs more than a missing one, so every narrow layout is a simplification, never a half-rendered desktop.


---

## 11. Designing for who is actually looking

The spec establishes two facts that change design priorities: **no demo video is required**, and the judges include people from live entertainment, an investment group, Qloo's own engineering, venture investing, AI governance, and entertainment itself. They will meet Zorq **alone, on their own device, with no narration**. So the product must teach itself, and every screen must hold its own as a screenshot.

| Judge's likely lens (REASONED, from titles only) | What in the design speaks to them |
|---|---|
| **Live entertainment and venue strategy** | A venue-led preset; "role preserved" format downshift (cinema becomes micro-screening); hours timeline with the late-night constraint as a hatched band. These are the questions a programmer of venues actually asks. |
| **Investment and portfolio ownership** | Blueprint as a board-readable document with a title block, a revision block and a risks section written in plain sentences. The control case ("the evidence changed nothing") signals a tool that will not flatter you. |
| **Qloo engineering** | Ledger rows that expand to endpoint, parameters and cache state; the Evidence drawer's entity-and-affinity language (Qloo itself says every result is explainable down to entities and affinities); /method with formulas and limits. Two independent measurement routes drawn as triangulation. |
| **Angel investing** | Repeated, recognisable workflow (tenant-mix planning is an established discipline); shareable Blueprint link; the Without-Qloo view as a one-click proof of value. |
| **AI governance and agent quality** | Prior Lock, "no cultural data used", calibrated fluency, the agent attacking its own answer, no fabricated evidence on failure, and a plainly stated list of what can go wrong. |
| **Entertainer and general-audience warmth** | Real names, real posters, real places. A page that is human and specific, not abstract. One line of personality in the right place: the S5 control-case sentence is allowed to be dry and funny. |

### The first sixty seconds (no video, so the product must stage itself)

| Time | What the judge sees | What it must achieve |
|---|---|---|
| 0 to 0.05 s | S0 first paint: map, landing line, three presets, all in final position and font | Visual credibility (the 50 ms impression). No skeleton, no layout shift. |
| 0 to 10 s | Reads one sentence, hovers a preset, map flies to the site | "I know what this does and the map answers me." |
| 10 to 20 s | Clicks a preset; the Prior card appears within about 3 s | Creates the question: will the evidence change the agent's mind? |
| 20 to 60 s | The ledger fills with specific named work; heat appears on the map; DNA fills with real names | Labor illusion: effort made visible, with the first interim artefact inside 10 s. |

### Submission gallery

Devpost needs images. Compose them as **drawing sheets**, each a full-bleed screenshot with a small title block in the corner: the S2 Field with four markers, the S3 Map of meaning, the S5 slope chart (What Qloo changed), the Evidence drawer with colour thumbnails. Four images tell the whole story, and they look like one author made them.

---

## 12. Mapping to the 18 Guidelines for Human-AI Interaction

Used as a checklist, not as a reason. (Microsoft's own advice is that these are decision support, not a checklist.)

| Guideline | Where Zorq meets it |
|---|---|
| G1 Make clear what the system can do | S0 sentence plus the three-step strip; the presets show it in one click |
| G2 Make clear how well it does it | Evidence grade (rule shown), relative bands instead of decimals, /method limits. The UI never states more precision than the system has. |
| G4 Show contextually relevant information | Receipts sit in the Blueprint margin beside the claim |
| G7, G8 Invocation and dismissal | "Stop and show best so far", Skip on Feel picks, collapsible Prior and DNA |
| G9 Support efficient correction | Unpin anchor (S1), dial (S2), Replace (S3, S5) |
| G10 Scope services when in doubt | Thin data triggers a visible widen decision, not a silent guess |
| G11 Make clear why it did what it did | Decision cards, ledger expansion, Evidence drawer, slope chart |
| G12 Remember recent interaction | Replace choices bias later alternatives within the run (spec) and the revision block records them |
| G15 Granular feedback | Per-member Replace and per-anchor unpin are fine-grained feedback |
| G16 Convey consequences of user actions | Replace panel previews coherence and distinctiveness change before commit |
| G17 Global controls | The Familiar-to-Distinctive dial |
| G18 Notify about changes | Re-inking, "changed" tags in the compare modal, revision block |

---

## 13. Self-audit: where my design thinking differs from a human grandmaster's, and what I did about it

You asked me to examine how my thinking differs from a human master's and to fix the gaps. This is the candid version, and it also tells you where to apply your own eyes.

### 13.1 Differences, and the countermeasure for each

| My tendency | Why it hurts a design | What I did |
|---|---|---|
| **I average.** My default output is the median of every design I have seen. That is the same trap the Zorq spec warns about (popular things look "coherent" everywhere). | A median design is forgettable and looks generated. | Generated seven candidate concepts first, killed the ones I would produce for *any* similar brief, and tested each surviving choice with a **swap test**: "if I replaced the product name, would this still be right?" The drafting-sheet grammar and the colour-equals-evidence rule fail that test for every other product, which is why I kept them. |
| **I cannot see rendered output.** I cannot judge optical balance, feel latency, or confirm a font renders lining figures. | Many design decisions are about what the eye does. I could be confidently wrong about spacing or density. | Converted each visual claim into something checkable: contrast ratios were computed, the type scale was computed, spacing sits on an 8 px grid. What I could not verify is labelled `UNVERIFIED` and appears in the spike list. |
| **I am fluent, and fluency feels like truth.** The same research I cite applies to my own prose. | A persuasive rationale can hide a weak decision. | Marked every claim `RESEARCHED`, `REASONED` or `UNVERIFIED`, kept a rejected-candidates table, and wrote a blunder check and pre-mortem *against* my own plan (Section 14). |
| **I complete symmetric structures.** Five tabs, six sections and four cards feel finished. | Symmetry is not a reason. It leads to filler. | Asked of every element "what would the user lose if this were deleted?" and cut accordingly. Cut: dashboard home, accounts, theme toggle, onboarding tour, illustration, scroll animations, shadows, a large icon set, a chat box. Kept five tabs because each owns a different hero object, and said why. |
| **My taste is borrowed, not lived.** A human designer has years of embodied use of products and print. | I may reproduce fashionable choices without knowing why they work. | Anchored decisions to documented practice with stated reasons (drafting conventions, Cleveland and McGill, Bertin, Rams, O'Doherty, Nielsen) rather than "it feels premium". |
| **I anchor on the first frame I am given.** The earlier draft you pasted had a map-plus-activity-plus-DNA-bars layout and a force-graph picture. | Anchoring skips better candidates. | Audited both. Kept the *idea* (visible work next to a map) and replaced the encodings that perception research ranks lower: DNA bars became dumbbell dot plots, and the force-graph became a stable Map of meaning plus a Distance chart. |

### 13.2 What the grandmaster research actually taught me

De Groot's classic finding, as later summarised: grandmasters did not search deeper than strong players. They *generated better candidate moves* (a result Chase and Simon explained with chunked pattern recognition), while weaker players analysed poor moves carefully. "You cannot analyse a move you never considered."

Applied here: the quality of this design depends on the *candidates considered*, not on polish. That is why Section 2 has seven concepts, why every major element below went through at least two alternatives (force graph versus MDS versus matrix; dashboard versus slope chart; accent colour versus none), and why the pre-mortem exists.

### 13.3 Tangents that became design (the random walk, kept honest)

You asked me to follow random thoughts. Most led nowhere. These did not:

| Tangent | What it became |
|---|---|
| The typeface's name means improvising from available materials. | The bricoleur versus engineer idea: the agent assembles, the code calculates. One line on /method and the pairing logic. |
| Road-atlas mileage tables. | The Distance chart in S3: a triangular matrix with component names on the diagonal. |
| Slope charts (Tufte-style). | "What Qloo changed" as Prior-to-Final lines in the Blueprint. |
| Print halftone. | Heat drawn as black dots of varying size; it also prints well. |
| Drafting "break line" symbol. | The mark on the weakest link. |
| Drafting revision blocks. | The Replace history on the Blueprint. |
| Drafting "chain line" for reference. | The Prior layer drawn dashed. |
| The white cube's critique (O'Doherty) and non-places (Augé). | The rule that Zorq must be a white wall that lets the street in: map always present, real names everywhere, colour only from the world. |
| Fluency research. | Calibrated fluency: contrast and weight track evidence strength. |
| Qloo's office location, found on their own site. | The gut-check preset idea. |

### 13.4 What I would ask a human to eyeball

These are exactly the decisions a text-only designer should not make alone:
1. Wordmark kerning (Z and Q) and whether Bricolage's narrow width looks authoritative or quirky.
2. Hatch angle and pitch; halftone dot steps.
3. Greyscale-at-rest images: do they look alive and calm, or dead?
4. Whether true black on white feels too stark in the first five seconds of S0.
5. Headline wording on S2 ("The evidence moved 3 of 5 components.") against the spec's tone.

---

## 14. Pre-mortem, blunder check and tests

### 14.1 Pre-mortem (Klein's method: assume it failed, then explain why)

*It is October 30. Zorq lost on Design. What happened?*

| Failure story | Counter built into this design |
|---|---|
| "The first screen looked like a form." | Presets are the primary path; the map is the hero; no field is visible until the user chooses to enter their own site. |
| "Black and white read as unfinished or cold." | Colour arrives with evidence (thumbnails, posters). If images are unavailable, specimen tiles in large Bricolage carry the warmth (Section 3.4). |
| "S1 was overwhelming: map, ledger and DNA all at once." | The ledger is the hero; DNA is collapsible; the Prior card is collapsible; the first row appears at once and the order is chronological, so the screen tells a story rather than showing a dashboard. |
| "I couldn't read the graph." | No hairball. Lines only for the chosen composition; a second, tabular view; a fidelity note. |
| "The ledger felt like debug output." | Plain-language labels; decision cards; expansion is optional. |
| "It was slow and I didn't know if it was working." | Real rows within 1 s, interim artefacts by 10 s, a visible call budget, and a stop control. |
| "I didn't understand why there was a Prior." | The Prior card says "Before looking. No cultural data used." and the S2 headline states what changed. |
| "Fonts flashed or didn't load." | Preload both families; `font-display: swap` with metrics-matched fallbacks to prevent shift; verify in spike D2. |
| "It broke on my laptop or phone." | Narrow layouts are designed simplifications (Section 10.2). |

### 14.2 Blunder check (list the worst consequence of each major choice before committing)

| Choice | Worst case | Mitigation |
|---|---|---|
| Pure monochrome UI | Feels austere, loses warmth | Colour from evidence; specimen fallback; warmth through real names |
| Raleway for UI text | Delicate at small sizes; old-style digits among numbers | Weight floor 500; size floor 14 px; explicit `lnum` and `tnum`; spike D2 |
| Hatch and dash encodings | Indistinguishable at 1.5 px on a 1x screen | Never the sole channel; paired with weight and a word; spike D3 |
| Map of meaning (MDS) | A 2-D picture of a 10-item space misleads | Fidelity note; Distance chart alongside; stable positions |
| Greyscale images at rest | Feels lifeless or hides what the entity is | Names always visible; full colour on focus; spike D7 |
| Calibrated fluency (grey for weak evidence) | Weak evidence looks "disabled" and gets ignored rather than weighed | Always paired with a label ("Thin evidence") and a line style; never `ink-450` for primary actions |
| Zero shadows and zero radius | Looks harsh or "unfinished" | Line weight hierarchy gives structure; generous space; pills and circles soften where meaning allows |
| Sheet references (Z1 to Z5) | Look like gimmicks | They must be clickable cross-references; delete if not |
| Slope chart for "what changed" | A judge doesn't read slope charts | Two-second legend on first view; the same words ("Kept, Added, Removed, Reformatted") appear beside the lines |
| Persistent Evidence grade | Looks like a score and invites false precision | It is a letter with the rule beside it, never a number, never coloured |

### 14.3 Tests to run (cheap, in priority order)

1. **Five-second test (S0 and S2):** show five people the screen for five seconds, then ask what the product does and what they'd click. Targets: four of five say it designs what belongs together on a site; four of five can identify what changed on S2.
2. **Squint test:** blur each screen; the hero object must still be the darkest, heaviest thing.
3. **Swap test:** hide the wordmark. Is it still obviously Zorq, and could it be mistaken for another product?
4. **Greyscale and print test:** print the Blueprint on a black-and-white laser printer; every distinction must survive.
5. **Keyboard-only run** of S0 to S5.
6. **200% zoom and 360 px width** sweep.
7. **Cold-read test:** a stranger reads /method for two minutes, then must be able to say what a Zorq edge means.

---

## 15. Design spikes (extending the spec's Day-1 spikes)

| # | Test | Pass | Fallback |
|---|---|---|---|
| D1 | Does the data API return image URLs for places, artists, films and brands, and do the hackathon terms allow showing them? | Images for most entities and permission to display | Specimen tiles (Section 3.4). The design holds without images. |
| D2 | Do both fonts render as intended: Raleway lining figures and tabular numbers; Bricolage optical size and width axes; no layout shift on load? | All four render; no shift | Set numbers in Bricolage; use metric-matched fallbacks |
| D3 | Do hatches, dashes and dots remain distinguishable at 1x, 2x and in print? | Yes at the sizes used | Increase pitch; rely more on weight and labels |
| D4 | With real edges for K of about 10, does the 2-D Map of meaning keep distances honestly (low stress)? | Fidelity note says "most distances kept" | Default to the Distance chart; offer the map as secondary |
| D5 | Five-second tests on S0 and S2 with five people | Targets in Section 14.3 | Rewrite headline and landing line first (cheapest fix) |
| D6 | Real run duration: what appears by 1 s and 10 s? | A first row inside 1 s; an interim artefact inside 10 s | Reorder phases so the heat and anchors come first |
| D7 | Greyscale-at-rest thumbnails: alive or lifeless? | Calm and readable | Show colour everywhere but at reduced size in dense lists |

---

## 16. Decision log and the design statement

### 16.1 The sixteen decisions that matter most

| # | Decision | Why | Status |
|---|---|---|---|
| 1 | Black and white UI; colour only inside evidence | Perceptual ranking of channels; simultaneous contrast; honesty; differentiation | RESEARCHED + REASONED |
| 2 | Untinted greys, true black | Matches the brief; avoids a common generated-design tell | REASONED |
| 3 | Contrast and weight track evidence strength (calibrated fluency) | Fluency makes claims feel truer; honesty requires typography not to lie | RESEARCHED + REASONED |
| 4 | Drafting-set visual grammar | Matches the deliverable, the audience and the palette; every line weight means something | REASONED |
| 5 | White wall that lets the street in | Avoids the white cube's placelessness; Zorq is about context | RESEARCHED + REASONED |
| 6 | Five tabs, eight screens, four overlays | One hero object per step; a five-step story | REASONED |
| 7 | Ledger shows real, specific work | Labor illusion; honesty about effort | RESEARCHED |
| 8 | The Field (shared histogram) as S2's hero | Position on a common scale; shows the percentile claim and the Prior's true rank | RESEARCHED + REASONED |
| 9 | Replace the force graph with Map of meaning plus Distance chart | A near-complete graph becomes a hairball; connectedness and proximity done honestly | RESEARCHED + REASONED |
| 10 | Dumbbell dot plots for DNA | Highest-accuracy channel, monochrome | RESEARCHED |
| 11 | Margin receipts (Tufte-style) in the Blueprint | Evidence beside the claim; credibility is visual and fast | RESEARCHED + REASONED |
| 12 | Slope chart for "What Qloo changed" | A two-second diff without colour | REASONED |
| 13 | Shape language: circle = process, square = verdict or object, pill = provenance | Teachable in a minute; every shape carries one meaning | REASONED |
| 14 | Raleway with explicit weight, size and numeral rules; Bricolage large only | Honours the brief and neutralises Raleway's known weaknesses | RESEARCHED |
| 15 | One orchestrated motion (re-inking); none elsewhere | Motion that marks the product's key event | REASONED |
| 16 | A judge-verifiable gut-check preset | Experts trust what they can check from their own knowledge | REASONED |

### 16.2 A design statement for the submission text (about 120 words)

> Zorq looks like a drawing set because it does a drawing set's job: it tells you what should exist on a site, and every line is accountable. The interface is black ink on white paper. Line weight, hatching and shape carry meaning, so nothing depends on colour, and the only colour in the product comes from real cultural evidence. Contrast tracks evidence strength: well-supported claims are set bold and black, thin evidence is lighter and dashed, and unmeasured pairs are hatched, never guessed. Before it looks at any data, the agent commits a first guess; you can watch the evidence re-ink it. The design's job is to make the agent's reasoning checkable at a glance.

### 16.3 The sentence to protect (design edition)

> **Colour means "this is real", line weight means "how sure", and the first guess is never hidden.**

If a later design change breaks any of the three halves of that sentence, it is the wrong change.

---

## 17. Build order for the design work (aligned to the spec's 24 days)

| Spec days | Design deliverables |
|---|---|
| 1 to 2 (spikes) | D1, D2 and D6 alongside the spec's spikes; they decide images, fonts and phase order |
| 3 to 7 (headless engine) | Design tokens (colour ramp, type scale, spacing, line weights, shape language), the hatch and mark library, the wordmark, the legend. No screens yet. Done early so every later screen inherits them. |
| 8 to 13 (S0 to S3) | S0, S1 ledger and map, S2 Field and cards, S3 both views, Evidence drawer. D3, D4 and D5 run as soon as S2 exists. |
| 14 to 18 (S4, S5, diff) | S4 attacks and verdict; S5 reading layout with margin receipts; slope chart; compare modal; revision block |
| 19 to 21 (stretch) | Replace panel polish; dial; print stylesheet |
| 22 to 23 (hardening) | State copy audit (Section 9), accessibility sweep (Section 10), five-second and cold-read tests, gallery images, /method worked example |
| 24 (buffer) | Fix only what the tests found |

**If time runs short, cut in this order** (never touching the items in bold below):
1. "Soften contrast" toggle
2. Print stylesheet polish
3. Re-inking animation, replaced by an instant diff with a legend
4. DNA dumbbells, replaced by simple paired bars
5. Halftone heat, replaced by plain circles
6. Specimen-tile polish

**Never cut:** the Prior card, the ledger, the Field, the Evidence drawer, the "What Qloo changed" slope chart, the Without-Qloo compare modal, and /method. They are the product's argument.

---

## References used (paraphrased, not quoted)

- Buell & Norton (2011), *The Labor Illusion*, Management Science 57(9).
- Lindgaard et al. (2006), 50 ms first impressions, *Behaviour & Information Technology*; Fogg's Stanford web-credibility surveys (cited via Website Optimization and CXL summaries).
- Reber & Schwarz (1999), *Effects of perceptual fluency on judgments of truth*; Schwarz, *Metacognitive experiences and judgments of truth and beauty* (Daedalus).
- Elliot (2015), *Color and psychological functioning*, Frontiers in Psychology.
- Piepenbrock, Mayr & Buchner (2013, 2014), the positive-polarity advantage, *Ergonomics*.
- Cleveland & McGill (1984) and Bertin (1967), via teaching summaries from Harvard Sensory Lab, UBC and University of Washington notes.
- Cambridge Intelligence on graph UX; Telea et al. and others on edge bundling and ambiguity.
- Amershi et al. (2019), Guidelines for Human-AI Interaction (Microsoft Research, HAX Toolkit).
- Nielsen Norman Group, response-time limits; Myers (1985) on percent-done indicators.
- Dieter Rams's ten principles (Braun, Vitsœ).
- O'Doherty, *Inside the White Cube*; Simon Sheikh's e-flux essay on it; Marc Augé, *Non-Places* (Verso).
- Architectural drawing conventions: AE Drawing Handbook (University of Waterloo), ArchToolbox, Architectural Graphic Standards overviews.
- de Groot, Chase & Simon on chess expertise and chunking (Brunel and NYU summaries; Chase & Simon 1973).
- Typefaces: Raleway (McInerney; Impallari and Fuenzalida), Bricolage Grotesque (Mathieu Triay), documentation from The League of Moveable Type, Google Fonts, the Bricolage repository, and TeX packaging notes for Raleway's numerals.
- Protomaps basemap flavours documentation; Linear's redesign write-up; Apple's 2026 Design Awards announcement; Qloo's own website.
- The Zorq product spec (`zorq-product-spec.md`).

**Cited from my own knowledge and not looked up this session:** Lévi-Strauss on bricolage; Tufte on sidenotes and slope charts; Klein's pre-mortem; Kahneman and Fredrickson's peak-end rule; Hick's and Fitts's laws; the WCAG 2.2 thresholds for non-text contrast (3:1) and minimum target size (24 px). Verify these before quoting them to anyone.
