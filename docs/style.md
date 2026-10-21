# otherweather — styles, ideas, and interactions

Compiled 2026-10-21 for the studio landing page and portfolio project stories.

This document covers **all 25 finished sites across 12 styles**. It summarizes each site's purpose, visual direction, central idea, and distinctive interactions, with links back to the archived documents. The summaries are self-contained: the future public site must not load anything from `legacy/`.

## How to read the sources

- Current names, slugs, and style groups come from [the project catalog](projects.json). Existing live concepts remain at `/work/<slug>/`.
- The primary briefs are in `legacy/site/briefs/`. Many retain working-name filenames; the entries below map them to the final names.
- Each style has a `STYLE.md` in `legacy/awwwards-research/<style>/`, plus per-reference `notes.md` files.
- [The historical build tracker](../legacy/site/PLAN.md), later polish documents, and current implementation clarify where the brief changed. [The current handoff](HANDOFF.md) and current source take precedence over older instructions.
- The critique links preserve review context. Their verdicts and requested changes describe those review dates, not a new assessment of the finished work. All 25 are treated as ready per the current handoff.
- These are self-initiated concepts. Their brands, people, products, services, business results, and local form/commerce states are illustrative unless explicitly identified otherwise. Challenger Deep is a factual editorial piece with its own listed sources.
- This is a documentation/source review, not a fresh browser or interaction audit. The interactions below are described in the project records, with targeted current-source checks for known conflicts.

## The 12 styles

| Style and archived guide | Core language | Sites |
| --- | --- | --- |
| [Swiss / Minimal](../legacy/awwwards-research/swiss-minimal/STYLE.md) | Precise grids, neutral grotesk type, extreme size contrast, hairlines, white/ink, and very limited accent color. | [01 Brisure Capital](#01-brisure-capital) · [02 Cal & Sombra](#02-cal-sombra) |
| [Brutalist / Raw](../legacy/awwwards-research/brutalist-raw/STYLE.md) | Visible scaffolding: grid lines, ledgers, metadata, bare controls, and a strong generative or spatial centerpiece. | [03 Seedfile](#03-seedfile) · [04 Fieldbook Type](#04-fieldbook) |
| [Editorial / Magazine](../legacy/awwwards-research/editorial-magazine/STYLE.md) | Publication structure with mastheads, cover lines, contents, spreads, clippings, and distinct serif/grotesk/mono roles. | [05 Side Street Quarterly](#05-side-street) · [06 Nice & Specific](#06-nice-specific) |
| [Organic / Nature](../legacy/awwwards-research/organic-nature/STYLE.md) | Natural materials and earth-derived palettes; quiet interfaces in pale linen or dark forest variants. | [07 Corkwood Public](#07-corkwood) · [08 Mossline](#08-mossline) |
| [Dark Luxury](../legacy/awwwards-research/dark-luxury/STYLE.md) | A darkened theatre/gallery: refined serif typography, sparse controls, photographic light, and deliberate pacing. | [09 Noct & Vale](#09-noct-vale) · [10 Silver Hour](#10-silver-hour) |
| [3D / WebGL](../legacy/awwwards-research/immersive-3d/STYLE.md) | A procedural place or journey in which camera, lighting, and spatial interaction carry the content. | [11 Thimble Planet](#11-thimble-planet) · [12 10,935 m: A Descent into the Challenger Deep](#12-challenger-deep) |
| [Gradient Tech](../legacy/awwwards-research/gradient-tech/STYLE.md) | Luminous fields, ultra-light type, translucent UI, technical readouts, and either night-neon or daylight-sky environments. | [13 Vectorhaus](#13-vectorhaus) · [14 Undersun](#14-undersun) |
| [Scroll Storytelling](../legacy/awwwards-research/scroll-storytelling/STYLE.md) | A directed sequence of chapters, image/camera transitions, progress cues, and factual details placed inside the narrative. | [15 Kamen Lodge](#15-kamen-lodge) · [16 House of Vey](#16-house-of-vey) · [17 Night Train to Porto](#17-night-train) |
| [Kinetic Typography](../legacy/awwwards-research/kinetic-typography/STYLE.md) | The headline supplies the main image; scale, letterforms, variable axes, and embedded media carry the expression. | [18 SORT®](#18-sort) · [19 Loud Hours](#19-loud-hours) |
| [Retro / Y2K](../legacy/awwwards-research/retro-y2k/STYLE.md) | Two related poles: printed 1990s Memphis stickers and glossy early-2000s chrome/desktop interfaces. | [20 Throwback Pace Co.](#20-throwback-pace) · [21 hello.exe](#21-hello-exe) |
| [Playful / Illustrative](../legacy/awwwards-research/playful-illustrative/STYLE.md) | Custom illustrated worlds, expressive color, handwritten marks, humorous copy, and responsive objects/controls. | [22 Snack Atlas](#22-snack-atlas) · [23 Sowsheet](#23-sowsheet) |
| [Corporate Premium](../legacy/awwwards-research/corporate-premium/STYLE.md) | Restrained UI, strong photography, large declarative type, clear navigation, and carefully presented data/specifications. | [24 Grevholt Group](#24-grevholt) · [25 Tidewright](#25-tidewright) |

## Document map

The number is stable even when the brand or slug changed. Use this table to locate a project's brief without searching its old name.

| # | Current site | Route | Archived brief filename |
| --- | --- | --- | --- |
| 01 | Brisure Capital | `/work/brisure-capital/` | [01-brisure-capital.md](../legacy/site/briefs/01-brisure-capital.md) |
| 02 | Cal & Sombra | `/work/cal-sombra/` | [02-ferro-vale.md](../legacy/site/briefs/02-ferro-vale.md) |
| 03 | Seedfile | `/work/seedfile/` | [03-null-index.md](../legacy/site/briefs/03-null-index.md) |
| 04 | Fieldbook Type | `/work/fieldbook/` | [04-fieldnotes.md](../legacy/site/briefs/04-fieldnotes.md) |
| 05 | Side Street Quarterly | `/work/side-street/` | [05-margin.md](../legacy/site/briefs/05-margin.md) |
| 06 | Nice & Specific | `/work/nice-specific/` | [06-oddly-specific.md](../legacy/site/briefs/06-oddly-specific.md) |
| 07 | Corkwood Public | `/work/corkwood/` | [07-terrane.md](../legacy/site/briefs/07-terrane.md) |
| 08 | Mossline | `/work/mossline/` | [08-mossline.md](../legacy/site/briefs/08-mossline.md) |
| 09 | Noct & Vale | `/work/noct-vale/` | [09-atelier-noct.md](../legacy/site/briefs/09-atelier-noct.md) |
| 10 | Silver Hour | `/work/silver-hour/` | [10-silver-hour.md](../legacy/site/briefs/10-silver-hour.md) |
| 11 | Thimble Planet | `/work/thimble-planet/` | [11-little-orbit.md](../legacy/site/briefs/11-little-orbit.md) |
| 12 | 10,935 m: A Descent into the Challenger Deep | `/work/challenger-deep/` | [12-challenger-deep.md](../legacy/site/briefs/12-challenger-deep.md) |
| 13 | Vectorhaus | `/work/vectorhaus/` | [13-latentfield.md](../legacy/site/briefs/13-latentfield.md) |
| 14 | Undersun | `/work/undersun/` | [14-brightwater.md](../legacy/site/briefs/14-brightwater.md) |
| 15 | Kamen Lodge | `/work/kamen-lodge/` | [15-kamen-lodge.md](../legacy/site/briefs/15-kamen-lodge.md) |
| 16 | House of Vey | `/work/house-of-vey/` | [16-maison-ondine.md](../legacy/site/briefs/16-maison-ondine.md) |
| 17 | Night Train to Porto | `/work/night-train/` | [17-night-train.md](../legacy/site/briefs/17-night-train.md) |
| 18 | SORT® | `/work/sort/` | [18-sort.md](../legacy/site/briefs/18-sort.md) |
| 19 | Loud Hours | `/work/loud-hours/` | [19-loud-hours.md](../legacy/site/briefs/19-loud-hours.md) |
| 20 | Throwback Pace Co. | `/work/throwback-pace/` | [20-rewind-run-club.md](../legacy/site/briefs/20-rewind-run-club.md) |
| 21 | hello.exe | `/work/hello-exe/` | [21-hello-exe.md](../legacy/site/briefs/21-hello-exe.md) |
| 22 | Snack Atlas | `/work/snack-atlas/` | [22-snack-atlas.md](../legacy/site/briefs/22-snack-atlas.md) |
| 23 | Sowsheet | `/work/sowsheet/` | [23-plotline.md](../legacy/site/briefs/23-plotline.md) |
| 24 | Grevholt Group | `/work/grevholt/` | [24-northvale.md](../legacy/site/briefs/24-northvale.md) |
| 25 | Tidewright | `/work/tidewright/` | [25-tidewright.md](../legacy/site/briefs/25-tidewright.md) |

## Site ideas and interactions

<a id="01-brisure-capital"></a>

### 01 · Brisure Capital

**What it does:** A private-credit firm's website explaining patient five-to-seven-year lending, its approach, facilities, and contact desks.

**Style:** Swiss / Minimal. Swiss typography on a 12-column grid; white and ink, hairline rules, oversized regular-weight type, and one red accent.

**Core idea:** A company's growth over a loan's lifetime becomes a changing terrain. Contour rings begin at the headline's red full stop and develop around one company point.

**Interactions and signature moments:**

- Contour-field arrival and a pointer-responsive elevation bump.
- A reversible scroll scene advances through seven years, synchronizing growing contours, a rolling year, captions, and illustrative lending readouts.
- Strategy range bars highlight on hover/focus; image plates follow the pointer on desktop and expand as an accordion on touch.
- Digit-roll facts and office clocks support the quieter information sections.

**Version/context note:** The v2 brief adds the lending-terrain sequence to the earlier build. All financial figures are illustrative.

**Source documents:** [Brief](../legacy/site/briefs/01-brisure-capital.md) · [Style guide](../legacy/awwwards-research/swiss-minimal/STYLE.md) · [Reference research: Tresmares Capital](../legacy/awwwards-research/swiss-minimal/tresmares-capital/notes.md) · [Critique](../legacy/site/briefs/critiques/01-brisure-capital.md) · [Current HTML](../site/work/brisure-capital/index.html) · [Current interaction source](../site/work/brisure-capital/main.js).

<a id="02-cal-sombra"></a>

### 02 · Cal & Sombra

**What it does:** An architecture and interiors practice's website presenting projects, services, people, and contact information.

**Style:** Swiss / Minimal. Pure monochrome, a precise Swiss grid, huge stair-stepped type, architectural hairlines, white study models, and cast shadows.

**Core idea:** The page is a lime-washed wall lit by one sun. Scrolling advances the day, so the model, wordmark shadows, section labels, and dusk contact scene belong to one lighting system.

**Interactions and signature moments:**

- A sunrise arrival introduces the wordmark and architectural model.
- A pinned 3D courtyard model tilts from an oblique view into a measured plan as dimension lines appear.
- Scroll changes the shared sun direction and shadow length; the page darkens toward the footer.
- Services reveal floor-plan drawings; the people track supports dragging and keyboard movement.

**Version/context note:** The archived filename still says Ferro & Vale. The canonical project is Cal & Sombra; its shared lighting module is sun.js.

**Source documents:** [Brief](../legacy/site/briefs/02-ferro-vale.md) · [Style guide](../legacy/awwwards-research/swiss-minimal/STYLE.md) · [Reference research: AIR](../legacy/awwwards-research/swiss-minimal/air-1/notes.md) · [Critique](../legacy/site/briefs/critiques/02-cal-sombra.md) · [Current HTML](../site/work/cal-sombra/index.html) · [Current interaction source](../site/work/cal-sombra/main.js).

<a id="03-seedfile"></a>

### 03 · Seedfile

**What it does:** A creative-coding studio's website presenting generative identities, plotter installations, data tools, and a project ledger.

**Style:** Brutalist / Raw. A dark plotter bed, small monospace metadata, visible grid logic, hairlines, and one contrasting white-paper scene.

**Core idea:** Programs that draw should be demonstrated through the act of drawing. One pen engine drives the hero, project plots, and smaller service sketches.

**Interactions and signature moments:**

- The hero performs a preflight/homing sequence and draws a seeded composition stroke by stroke, with reseed and skip controls.
- A scroll-scrubbed reel draws and reverses eight plots while the job readout follows the active drawing.
- Ledger rows reveal plots; services can generate fresh sketches.
- A stepped dark-to-paper transition, G grid overlay, and copy-email feedback complete the workshop language.

**Version/context note:** Null Index is the working name retained in the brief filename. The current build imports plot.js.

**Source documents:** [Brief](../legacy/site/briefs/03-null-index.md) · [Style guide](../legacy/awwwards-research/brutalist-raw/STYLE.md) · [Reference research: 2xA Studio](../legacy/awwwards-research/brutalist-raw/2xa-studio/notes.md) · [Critique](../legacy/site/briefs/critiques/03-seedfile.md) · [Current HTML](../site/work/seedfile/index.html) · [Current interaction source](../site/work/seedfile/main.js).

<a id="04-fieldbook"></a>

### 04 · Fieldbook Type

**What it does:** An independent type foundry's website for exploring fictional font families, testing type, and comparing licence options.

**Style:** Brutalist / Raw. A light survey-sheet/ledger aesthetic: black hairlines, enormous type, compact plain-text controls, with an inverted ink tester.

**Core idea:** Type is measured and manipulated rather than presented only as specimens. Variable axes and spatial arrangements make the collection directly explorable.

**Interactions and signature moments:**

- The hero Plot maps pointer position to variable width and weight, with metric lines, rulers, and live axis values.
- A 24-card 3D specimen gallery morphs between Ring, Grid, Spiral, and Scatter, with drag inertia, pause/resume, and keyboard selection.
- Choosing a specimen transfers its family into the editable tester with size/weight controls.
- Paper/Ink and the G grid toggle expose the page's underlying system.

**Version/context note:** Important override: the v2 brief removed the 3D gallery in favor of a proof sheet, but the later build tracker records the user's restoration of the original gallery. Current HTML and JavaScript confirm it is present. Do not describe the removed proof sheet as the delivered design.

**Source documents:** [Brief](../legacy/site/briefs/04-fieldnotes.md) · [Style guide](../legacy/awwwards-research/brutalist-raw/STYLE.md) · [Reference research: Obys Experiment Space](../legacy/awwwards-research/brutalist-raw/obys-r-experiment-space/notes.md) · [Critique](../legacy/site/briefs/critiques/04-fieldbook.md) · [Current HTML](../site/work/fieldbook/index.html) · [Current interaction source](../site/work/fieldbook/main.js).

<a id="05-side-street"></a>

### 05 · Side Street Quarterly

**What it does:** A quarterly publication's website introducing an issue about cities at walking pace, its articles, contributors, and subscription.

**Style:** Editorial / Magazine. Printed-paper editorial design: a condensed masthead, serif articles, mono page furniture, photo clippings, department inks, and awning stripes.

**Core idea:** The issue is one side street. Reading its contents feels like visiting shopfronts, and the central feature becomes a walk along the whole block.

**Interactions and signature moments:**

- A dawn clock and upward wipe reveal the cover.
- Five shopfront accordions open beneath scalloped awnings; After Hours changes the contents scene to night.
- The Long Block is a pinned SVG street panorama with a fold line, distance odometer, bench count, and station captions.
- Clippings react gently to hover; the street has a directly scrollable static alternative.

**Version/context note:** Margin is the former name in the filename. The publication's invented figures and stories should remain identified as concept content.

**Source documents:** [Brief](../legacy/site/briefs/05-margin.md) · [Style guide](../legacy/awwwards-research/editorial-magazine/STYLE.md) · [Reference research: Mosby's Files](../legacy/awwwards-research/editorial-magazine/mosbys-files/notes.md) · [Critique](../legacy/site/briefs/critiques/05-side-street.md) · [Current HTML](../site/work/side-street/index.html) · [Current interaction source](../site/work/side-street/main.js).

<a id="06-nice-specific"></a>

### 06 · Nice & Specific

**What it does:** A B2B content studio's website offering articles, short films, and podcasts, with example work and an illustrated process.

**Style:** Editorial / Magazine. Magazine-cover composition with Instrument Serif, Hanken Grotesk, and IBM Plex Mono; paper, ink, coral highlighter, tilted clippings, and printer's-proof details.

**Core idea:** The boring detail becomes the story. A dull brochure is transformed into a specific, memorable headline in front of the visitor.

**Interactions and signature moments:**

- The cover arrives in stages: nameplate letters, a highlighter swipe, and overlapping clippings.
- The Detail Pass scroll sequence rejects generic brochure lines, finds one buried detail, lifts it into a large headline, and hands it into a vertical-format work card.
- Recent-work cards advance with pause controls and enlarge the active item on desktop.
- A coral quote carousel and large editorial process verbs vary the page's rhythm.

**Version/context note:** Oddly Specific is the earlier name. The page is a fictional studio concept; its quotes, clients, and view counts are invented.

**Source documents:** [Brief](../legacy/site/briefs/06-oddly-specific.md) · [Style guide](../legacy/awwwards-research/editorial-magazine/STYLE.md) · [Reference research: Hildén & Kaira](../legacy/awwwards-research/editorial-magazine/hilden-kaira/notes.md) · [Critique](../legacy/site/briefs/critiques/06-nice-specific.md) · [Current HTML](../site/work/nice-specific/index.html) · [Current interaction source](../site/work/nice-specific/main.js).

<a id="07-corkwood"></a>

### 07 · Corkwood Public

**What it does:** A public-furniture company's website explaining its collections, materials, repairability, applications, and bench configurations.

**Style:** Organic / Nature. Warm linen with sand, sage, clay, and sky product scenes; a dark workshop chapter, natural material textures, rounded controls, and fine technical drawings.

**Core idea:** A workshop table and one repairable kit of parts. A bench is assembled in view so the replaceable construction becomes the main product argument.

**Interactions and signature moments:**

- Scroll assembles the Sobreiro bench from blocks, slats, bolts, and a hex key; a parts counter and callouts explain the components.
- The finished 3D bench transitions into its product photograph.
- Collections change scene tint; material photographs expand through a darker workshop sequence.
- Places reveal drawn plans; the configurator changes base finish, length, and the resulting specification.

**Version/context note:** Terrane is the earlier name. A Three.js bench module supports assembly and configuration; generated product/material imagery supplies the photographic scenes.

**Source documents:** [Brief](../legacy/site/briefs/07-terrane.md) · [Style guide](../legacy/awwwards-research/organic-nature/STYLE.md) · [Reference research: Floema](../legacy/awwwards-research/organic-nature/floema/notes.md) · [Critique](../legacy/site/briefs/critiques/07-corkwood.md) · [Current HTML](../site/work/corkwood/index.html) · [Current interaction source](../site/work/corkwood/main.js).

<a id="08-mossline"></a>

### 08 · Mossline

**What it does:** A soil-carbon monitoring concept explaining buried probes, measurement models, reports, plot readings, and regenerative-farming applications.

**Style:** Organic / Nature. Forest-black and green, lime data accents, Geist/Geist Mono, an original rendered specimen of living ground, and anchored scientific labels.

**Core idea:** The specimen: lift a piece of living ground out of the field, turn toward its cut face, descend through its soil horizons, and insert the measuring probe. Nature leads; data annotates.

**Interactions and signature moments:**

- The specimen rises with plant growth, then sways gently with a small pointer-driven frame nudge.
- A pinned image sequence turns the specimen, moves down its profile, and inserts a probe whose three bands align with depth labels and readouts.
- The sequence leads into a five-season soil-carbon chart with plot controls and keyboard tooltips.
- An illustrated field map connects plot selection to probe pillars and readings.

**Version/context note:** The delivered v3 uses pre-rendered Blender Cycles sequences on canvas, not the earlier live Three.js stone. The final delivery disables cut-frame blending while retaining blended hero sway. Current source README and HANDOFF supersede the brief's smoothing and transfer-budget descriptions.

**Source documents:** [Brief](../legacy/site/briefs/08-mossline.md) · [Style guide](../legacy/awwwards-research/organic-nature/STYLE.md) · [Reference research: Alethia](../legacy/awwwards-research/organic-nature/alethia/notes.md) · [Critique 1](../legacy/site/briefs/critiques/08-mossline-r2.md) · [Critique 2](../legacy/site/briefs/critiques/08-mossline.md) · [Current HTML](../site/work/mossline/index.html) · [Current interaction source](../site/work/mossline/main.js).

**Additional documents:** [Current specimen source and delivery notes](../site/work/mossline/_src/README.md) · [Superseded stone-development brief](../legacy/site/briefs/08-mossline-stone-prompt.md).

<a id="09-noct-vale"></a>

### 09 · Noct & Vale

**What it does:** A perfume house's anniversary website presenting current scents, bottle details, ingredient histories, and a fifteen-year archive.

**Style:** Dark Luxury. Tinted near-black with amber, plum, and champagne; Instrument Serif and DM Sans; macro ingredient photography, smoke, sparse rules, and slow light.

**Core idea:** Make scent visible through smoke, shifting color, and engraved glass. Each scent has its own atmosphere within the same visual system.

**Interactions and signature moments:**

- A real-time incense-smoke field responds to the pointer; Enter produces a smoke transition.
- A pinned scent sequence changes the photograph, name, notes, page tint, smoke palette, and vial progress indicators.
- A bottle zoom catches its engraving with a light sweep.
- Archive filters and individual smoke-dissolve previews reveal the history; a word-by-word quote leads to the closing scene.

**Version/context note:** Atelier Noct is the earlier name. Later polish notes refine smoke arrival, bottle zoom, and engraving legibility.

**Source documents:** [Brief](../legacy/site/briefs/09-atelier-noct.md) · [Style guide](../legacy/awwwards-research/dark-luxury/STYLE.md) · [Reference research: /nk.studio 20 Years](../legacy/awwwards-research/dark-luxury/20-years-inspired-by-people/notes.md) · [Critique 1](../legacy/site/briefs/critiques/09-noct-vale-r2.md) · [Critique 2](../legacy/site/briefs/critiques/09-noct-vale.md) · [Current HTML](../site/work/noct-vale/index.html) · [Current interaction source](../site/work/noct-vale/main.js).

**Additional documents:** [Later smoke and bottle polish notes](../legacy/scratch/noct-vale-polish/README.md).

<a id="10-silver-hour"></a>

### 10 · Silver Hour

**What it does:** An exhibition website for a fictional photographer's retrospective, showing eight works, captions, an archive index, and visitor information.

**Style:** Dark Luxury. Pure black, white/grey serif typography, Newsreader throughout, no color accent, and black-and-white photographs treated as physical prints.

**Core idea:** Light is the interaction. Prints develop as visitors reach them, and a dark-room viewer makes illumination part of looking.

**Interactions and signature moments:**

- The title develops through recorded noise/light stages.
- An eight-print exhibition walk varies image scale and placement, developing photographs with highlights first and shadows later.
- List/Grid changes how the full collection is browsed.
- Shared-element transitions enter the dark room, where a moving spotlight, full-light control, arrows, keyboard controls, and touch gestures support viewing.

**Version/context note:** Later v3 work supersedes the brief's simpler grain-to-grey development and improves dark-room discovery. The people, venue, and photographs are fictional.

**Source documents:** [Brief](../legacy/site/briefs/10-silver-hour.md) · [Style guide](../legacy/awwwards-research/dark-luxury/STYLE.md) · [Reference research: Hearst Exhibit 2026](../legacy/awwwards-research/dark-luxury/hearst-exhibit-2026/notes.md) · [Critique 1](../legacy/site/briefs/critiques/10-silver-hour-r2.md) · [Critique 2](../legacy/site/briefs/critiques/10-silver-hour.md) · [Current HTML](../site/work/silver-hour/index.html) · [Current interaction source](../site/work/silver-hour/main.js).

**Additional documents:** [Later exhibition and dark-room revision](../legacy/scratch/silver-hour-r3/README.md).

<a id="11-thimble-planet"></a>

### 11 · Thimble Planet

**What it does:** A fictional one-person 3D studio's playable portfolio, where a tiny planet's landmarks represent interactive projects.

**Style:** 3D / WebGL. A low-poly storybook diorama, dusk colors, fog, bronze-framed controls, procedural landmarks, and a thin interface over the scene.

**Core idea:** The portfolio is a place to visit. Each project changes the light and offers something to do, with no avatar or scoring.

**Interactions and signature moments:**

- Orbit/drag the planet or choose a place to fly the camera to its landmark.
- Turn the lighthouse beam to uncover logbook lines; scrub the cottage through twelve months.
- Hold the windmill control to grind flour, change the dock's tide, and scrub tree growth in the grove.
- Each flight changes time-of-day lighting; menu, reset, optional sound, and an illustrated list provide alternate access.

**Version/context note:** Little Orbit is the earlier name. Later work turns the landmarks from text destinations into working scene controls.

**Source documents:** [Brief](../legacy/site/briefs/11-little-orbit.md) · [Style guide](../legacy/awwwards-research/immersive-3d/STYLE.md) · [Reference research: Where Worlds Take Shape](../legacy/awwwards-research/immersive-3d/where-worlds-take-shape/notes.md) · [Critique](../legacy/site/briefs/critiques/11-thimble-planet.md) · [Current HTML](../site/work/thimble-planet/index.html) · [Current interaction source](../site/work/thimble-planet/main.js).

<a id="12-challenger-deep"></a>

### 12 · 10,935 m: A Descent into the Challenger Deep

**What it does:** A factual editorial experience taking visitors from the ocean surface toward the Challenger Deep, with depth-related events, explanatory notes, and listed sources.

**Style:** 3D / WebGL. A dark procedural ocean, a reflected DEEP wordmark, Jost and IBM Plex Mono, marine snow, point-cloud landmarks, and a depth/pressure HUD.

**Core idea:** Make ocean depth and scale physically understandable through a continuous descent. The opening waterline is a boundary the camera actually crosses.

**Interactions and signature moments:**

- Pointer/tap rings distort the reflected title on the water.
- The plunge creates an above/below-water split view, bubbles, and an exposure change before the camera enters the ocean.
- Native scroll drives depth, zone, light, pressure, particles, landmark positions, and projected labels; a chapter rail supports jumps.
- A staged window-crack effect near the deepest section leads to the seabed, dive history, sources, and credits.

**Version/context note:** This is the collection's sourced factual editorial piece. Its title depth is approximate and the in-page source notes govern factual copy; this documentation pass does not re-verify the science.

**Source documents:** [Brief](../legacy/site/briefs/12-challenger-deep.md) · [Style guide](../legacy/awwwards-research/immersive-3d/STYLE.md) · [Reference research: 21 Hrs On The Moon](../legacy/awwwards-research/immersive-3d/21-hrs-on-the-moon/notes.md) · [Critique](../legacy/site/briefs/critiques/12-challenger-deep.md) · [Current HTML](../site/work/challenger-deep/index.html) · [Current interaction source](../site/work/challenger-deep/main.js).

<a id="13-vectorhaus"></a>

### 13 · Vectorhaus

**What it does:** A serverless GPU-inference platform concept explaining startup latency, deployment, regions, scaling, code examples, and usage-based pricing.

**Style:** Gradient Tech. Blue-black with cyan/violet luminous ribbons, ultra-light display type, glass docks and tiles, monospace telemetry, and a persistent WebGL field.

**Core idea:** Make a fraction of a second physical. Dormant strands wake as a request becomes a first token, then the same field changes atmosphere across the product story.

**Interactions and signature moments:**

- An ignition intro and a pinned wake sequence synchronize ribbon emission, a large 0.84-second clock, and three milestones.
- A command palette supports section jumps and install-command copying.
- Region chips interact with a draggable globe; code tabs switch examples and copy their contents.
- A pricing calculator updates estimates from GPU choice, request duration, and daily volume; the field resolves to a dawn horizon at the close.

**Version/context note:** Latentfield is the earlier name. The timings, benchmarks, customers, and prices are fictional product claims. Later verification records a repaired calculator selector collision.

**Source documents:** [Brief](../legacy/site/briefs/13-latentfield.md) · [Style guide](../legacy/awwwards-research/gradient-tech/STYLE.md) · [Reference research: Cerebrium](../legacy/awwwards-research/gradient-tech/cerebrium/notes.md) · [Critique](../legacy/site/briefs/critiques/13-vectorhaus.md) · [Current HTML](../site/work/vectorhaus/index.html) · [Current interaction source](../site/work/vectorhaus/main.js).

**Additional documents:** [Build and calculator follow-up notes](../legacy/scratch/vectorhaus-qa/VERIFICATION.md).

<a id="14-undersun"></a>

### 14 · Undersun

**What it does:** A closed-loop geothermal energy concept explaining the system, pilot sites, industrial/district-heating applications, and careers.

**Style:** Gradient Tech. Daylight sky gradients over cream/peach ground, copper and luminous amber underground, a chrome wellhead, ultra-light type, glass readouts, and technical diagrams.

**Core idea:** The sun is under the horizon. The page goes down through the ground to the heat, follows the closed loop, and brings energy back to factories and homes.

**Interactions and signature moments:**

- A staged arrival raises the wellhead through the horizon and draws the underground pipes.
- Pilot-site maps draw their heat mains and highlight active sites.
- A scroll-driven descent synchronizes depth, rock temperature, water temperature, strata, casing, and the cold/hot loop legs.
- The return to the surface becomes the careers sunrise and closing half-disc motif.

**Version/context note:** Brightwater is the earlier name. Later build notes move pilot sites before the descent and shorten/simplify the mobile journey.

**Source documents:** [Brief](../legacy/site/briefs/14-brightwater.md) · [Style guide](../legacy/awwwards-research/gradient-tech/STYLE.md) · [Reference research: ZettaJoule](../legacy/awwwards-research/gradient-tech/zettajoule/notes.md) · [Critique](../legacy/site/briefs/critiques/14-undersun.md) · [Current HTML](../site/work/undersun/index.html) · [Current interaction source](../site/work/undersun/main.js).

<a id="15-kamen-lodge"></a>

### 15 · Kamen Lodge

**What it does:** A mountain-lodge website introducing a fictional forty-room retreat, its approach route, rooms, sauna/lake rituals, seasons, table, and booking enquiry.

**Style:** Scroll Storytelling. Earth tones, warm dusk and amber windows, serif chapter typography, a bead-built wordmark, mountain-shaped section seams, and large lodge/room renders.

**Core idea:** Altitude and warmth connect arrival to departure: climb from the valley to the lodge, enter the window light, and experience heat, lake, and changing weather.

**Interactions and signature moments:**

- An altitude loader counts from valley to lodge and transfers the final elevation into the hero.
- A pinned push-in darkens the valley, warms the windows, unthreads the wordmark, and hands amber light into the paper page.
- An arrival map follows the shuttle; the rooms carousel supports weighted dragging and image parallax.
- Sauna/lake temperatures drive changing grades; a Summer/Winter switch lowers a ridge-shaped snow line.

**Version/context note:** Important override: the later build replaces the original hold-to-reveal season interaction with a single accessible Summer/Winter switch, confirmed in current source. Booking is a local concept interaction.

**Source documents:** [Brief](../legacy/site/briefs/15-kamen-lodge.md) · [Style guide](../legacy/awwwards-research/scroll-storytelling/STYLE.md) · [Reference research: Son Daven](../legacy/awwwards-research/scroll-storytelling/son-daven/notes.md) · [Critique](../legacy/site/briefs/critiques/15-kamen-lodge.md) · [Current HTML](../site/work/kamen-lodge/index.html) · [Current interaction source](../site/work/kamen-lodge/main.js).

<a id="16-house-of-vey"></a>

### 16 · House of Vey

**What it does:** An accessories-house collection launch introducing four bags through a walk-through townhouse and a final collection grid.

**Style:** Scroll Storytelling. Deep-green gate and facade, brass accents, softly lit baked rooms, Work Sans with Cormorant Garamond italic, transparent bag imagery, and a cream collection.

**Core idea:** One room, one bag, one light. The arch ties together the opening gate, actual front door, room passages, and final window.

**Interactions and signature moments:**

- Entering opens the arch into the front door; the camera moves into the house while the facade and lamps light up.
- Scroll advances through four rooms with different proportions, colors, and lighting.
- Bag hotspots open detail panels; colorway swatches update both the panel and the bag in the 3D scene.
- The bedroom window opens and expands into the collection grid; sound is optional.

**Version/context note:** Maison Ondine is the earlier name. Later build work strengthens the continuous gate-to-door handoff and implements real recoloring of the cutout imagery.

**Source documents:** [Brief](../legacy/site/briefs/16-maison-ondine.md) · [Style guide](../legacy/awwwards-research/scroll-storytelling/STYLE.md) · [Reference research: Miu Miu, A House that we shaped](../legacy/awwwards-research/scroll-storytelling/miu-miu-a-house-that-we-shaped/notes.md) · [Critique](../legacy/site/briefs/critiques/16-house-of-vey.md) · [Current HTML](../site/work/house-of-vey/index.html) · [Current interaction source](../site/work/house-of-vey/main.js).

**Additional documents:** [Later house-entry polish evidence folder](../legacy/scratch/house-of-vey-polish).

<a id="17-night-train"></a>

### 17 · Night Train to Porto

**What it does:** A campaign for fictional rail operator Linha Atlântica, presenting an overnight Atlantic-coast journey to Porto through five stops and an invented upgrade reward.

**Style:** Scroll Storytelling. Navy, cream, and amber; Anybody/Fraunces; painted gouache-style scenes, layered windows, ticket perforations, stamps, and timetable typography.

**Core idea:** The ticket stays with the visitor throughout the journey. Its torn stub becomes the record of stops and finally the upgraded ticket.

**Interactions and signature moments:**

- Start punches and tears the opening ticket, then sends its stub into the stamp card.
- Painted chapters use different window silhouettes, lateral movement, rising shutters, and camera depth.
- Passing the chapter ranges collects stamps, including during fast scrolling.
- Completing the journey reissues a gold GRAND ticket; optional procedural sound and timetable details reinforce the railway world.

**Version/context note:** The operator, through-route, timetable, fares, and upgrade are fictional. Later polish varies the window treatments and maintains larger mobile paintings.

**Source documents:** [Brief](../legacy/site/briefs/17-night-train.md) · [Style guide](../legacy/awwwards-research/scroll-storytelling/STYLE.md) · [Reference research: The Tuscan Journey Begins](../legacy/awwwards-research/scroll-storytelling/the-tuscan-journey-begins/notes.md) · [Critique](../legacy/site/briefs/critiques/17-night-train.md) · [Current HTML](../site/work/night-train/index.html) · [Current interaction source](../site/work/night-train/main.js).

**Additional documents:** [Later ticket and chapter polish notes](../legacy/scratch/night-train-polish/README.md).

<a id="18-sort"></a>

### 18 · SORT®

**What it does:** A design team's limited-run merchandise storefront concept, with six products, an issue archive, product details, and a local shopping bag.

**Style:** Kinetic Typography. Cobalt on putty paper, a full-width SVG wordmark, heavy variable type, thick rules, offset product columns, serif marginalia, and product-photo pairs.

**Core idea:** Sorting is the identity and the interaction. Reordering the wordmark connects directly to how the shop rearranges its objects.

**Interactions and signature moments:**

- Wordmark letters arrive and can reorder through logo controls.
- A traveling rule highlight hands the selected logo mode into a matching product-grid arrangement.
- Product cards reveal a second photograph; quick view supports size selection and local add/remove bag behavior.
- Variable-width type, an image slot, archive treatments, and a velocity-reactive marquee extend the graphic system.

**Version/context note:** The short original brief omits the developed logo-to-shop interaction; the build tracker and later verification document it. No purchases are processed.

**Source documents:** [Brief](../legacy/site/briefs/18-sort.md) · [Style guide](../legacy/awwwards-research/kinetic-typography/STYLE.md) · [Reference research: Outfit](../legacy/awwwards-research/kinetic-typography/outfit/notes.md) · [Critique](../legacy/site/briefs/critiques/18-sort.md) · [Current HTML](../site/work/sort/index.html) · [Current interaction source](../site/work/sort/main.js).

**Additional documents:** [Later sorting and shop-handoff verification](../legacy/scratch/sort-polish/VERIFICATION.md).

<a id="19-loud-hours"></a>

### 19 · Loud Hours

**What it does:** A social-first creative agency concept presenting six services, short-form creative treatments, a manifesto, and contact.

**Style:** Kinetic Typography. Ink on warm paper, a heavy Kumbh Sans type totem, Archivo variable axes, serif marginalia, alternating arrows, and media embedded in the type.

**Core idea:** Typography behaves like a loud broadcast. Tiny media inside the headline expands into a larger demonstration, while scroll increases the manifesto's visual volume.

**Interactions and signature moments:**

- Masked lines cascade into the hero and an embedded slot cycles original procedural loops.
- Large service rows dim siblings and open their own animated examples.
- Shorts enlarges its bracketed media into a work canvas with three treatments and a shared pause control.
- Scroll changes manifesto width/weight and the VOL meter, then carries the key phrase into the two-tone footer.

**Version/context note:** Later polish enlarges the work demonstrations and shortens the manifesto sequence; the original brief mostly describes the earlier type totem.

**Source documents:** [Brief](../legacy/site/briefs/19-loud-hours.md) · [Style guide](../legacy/awwwards-research/kinetic-typography/STYLE.md) · [Reference research: Adcker](../legacy/awwwards-research/kinetic-typography/adcker/notes.md) · [Critique](../legacy/site/briefs/critiques/19-loud-hours.md) · [Current HTML](../site/work/loud-hours/index.html) · [Current interaction source](../site/work/loud-hours/main.js).

**Additional documents:** [Later Shorts and manifesto verification](../legacy/scratch/loud-hours-polish/VERIFICATION.md).

<a id="20-throwback-pace"></a>

### 20 · Throwback Pace Co.

**What it does:** A retro running capsule and club concept presenting apparel colorways, group runs, a local bag, and a signup.

**Style:** Retro / Y2K. Off-white, loud Memphis stickers, lime pills, hard offset shadows, grain/halftone, condensed split lettering, and 1990s-style runner/product photography.

**Core idea:** Nostalgia is tactile and active: peel, toss, scrub, change a colorway, and join a run. The track motif connects the opening campaign to the products.

**Interactions and signature moments:**

- Desktop stickers can be dragged and tossed within bounds; the headline pops into place.
- Scroll velocity drives fast-forward/rewind cues and stepped directional image wipes.
- The blue track morphs into a frame around the product row; swatches change product photography.
- The calendar filters by distance, Join controls expose route drawings, and the local bag/signup provide working front-end states.

**Version/context note:** The brief still says Rewind Run Club and uses its former slug. The shipped name and route are Throwback Pace Co. and /work/throwback-pace/.

**Source documents:** [Brief](../legacy/site/briefs/20-rewind-run-club.md) · [Style guide](../legacy/awwwards-research/retro-y2k/STYLE.md) · [Reference research: Decathlon Yestalgia](../legacy/awwwards-research/retro-y2k/decathlon-yestalgia/notes.md) · [Critique](../legacy/site/briefs/critiques/20-throwback-pace.md) · [Current HTML](../site/work/throwback-pace/index.html) · [Current interaction source](../site/work/throwback-pace/main.js).

**Additional documents:** [Later capsule and route verification](../legacy/scratch/throwback-pace-polish/VERIFICATION.md).

<a id="21-hello-exe"></a>

### 21 · hello.exe

**What it does:** A fictional designer-engineer's portfolio presented as a working desktop of interactive mini applications.

**Style:** Retro / Y2K. Aqua-sky gradients, inflated chrome lettering and icons, glossy spring-driven windows, pearl bezels, gel controls, mono telemetry, and pixel-era interface details.

**Core idea:** Software with a nice finish. Projects are usable little applications inside a physical-feeling operating system, rather than static portfolio thumbnails.

**Interactions and signature moments:**

- Procedural chrome lettering and a 3D cursor introduce the desktop.
- Open, drag, focus, minimize, restore, and close app windows; a dock and mobile Focus window action keep them reachable.
- Use a ticket kiosk, FM synthesizer, variable tile-font tester, pixel forecast, virtualized table, typing readme, and recycle bin.
- Theme/sound controls, copy-email feedback, and consistent visibility pauses support the desktop.

**Version/context note:** The brief's fictional designer name is superseded by Juno Rebelo. The seven working apps and later mobile/visibility improvements are documented in the tracker and polish notes.

**Source documents:** [Brief](../legacy/site/briefs/21-hello-exe.md) · [Style guide](../legacy/awwwards-research/retro-y2k/STYLE.md) · [Reference research: HAOQI.DESIGN](../legacy/awwwards-research/retro-y2k/haoqi-design/notes.md) · [Critique](../legacy/site/briefs/critiques/21-hello-exe.md) · [Current HTML](../site/work/hello-exe/index.html) · [Current interaction source](../site/work/hello-exe/main.js).

**Additional documents:** [Desktop/app and mobile polish notes](../legacy/scratch/hello-exe-polish/QA.md).

<a id="22-snack-atlas"></a>

### 22 · Snack Atlas

**What it does:** A monthly international-snack subscription concept explaining the box, a featured country, plan options, FAQs, and newsletter signup.

**Style:** Playful / Illustrative. Tomato, cream, mint, and cobalt fields; Bricolage/Caveat typography; original SVG snacks and mascot, doodled arrows, crimped packaging seams, and postcard details.

**Core idea:** A box becomes a little trip. Packing, tasting, and receiving a postcard turn the subscription explanation into an illustrated sequence.

**Interactions and signature moments:**

- The hero box arrives with bursting snacks; tapping a snack crumbles it.
- A scroll scene selects Mexico on a map, packs snacks, closes the box, and turns it into a postcard stamp.
- The country postcard flips; snack crunch meters animate.
- Billing controls change displayed plan prices; FAQ and newsletter validation provide local interaction states.

**Version/context note:** Later work extends the original three-step section into the map/packing/stamp sequence and simplifies mobile pacing. Plans and subscription states are illustrative.

**Source documents:** [Brief](../legacy/site/briefs/22-snack-atlas.md) · [Style guide](../legacy/awwwards-research/playful-illustrative/STYLE.md) · [Reference research: Aardvark Book Club](../legacy/awwwards-research/playful-illustrative/aardvark-book-club/notes.md) · [Critique](../legacy/site/briefs/critiques/22-snack-atlas.md) · [Current HTML](../site/work/snack-atlas/index.html) · [Current interaction source](../site/work/snack-atlas/main.js).

**Additional documents:** [Later packing story and mobile verification](../legacy/scratch/snack-atlas-polish/VERIFICATION.md).

<a id="23-sowsheet"></a>

### 23 · Sowsheet

**What it does:** A garden-planning app concept with an actual browser-local bed planner, seasonal visualization, plan comparison, and waitlist.

**Style:** Playful / Illustrative. Graph paper, cobalt axonometric drawings, taped/grain-textured sheets, hand-lettered notes, drawn arrows, mono tools, and a blueprint footer.

**Core idea:** A small garden starts as a sketch and becomes a living plan. The same bed the visitor edits carries into the seasonal illustration.

**Interactions and signature moments:**

- The annotated hero garden appears plant by plant, with live plot coordinates.
- Place, move, or remove plants on a 6×4 bed using drag, touch placement, or keyboard controls.
- Sun/shade overlays, spread rings, and spacing/neighbour notes respond to the arrangement.
- The live axonometric view reflects the edited bed across four seasons, with hemisphere controls; the waitlist has validation and a sprouting success state.

**Version/context note:** Plotline is the earlier name and slug in the brief. Later work connects the planner to the seasonal rendering and places the footer in normal flow after the waitlist.

**Source documents:** [Brief](../legacy/site/briefs/23-plotline.md) · [Style guide](../legacy/awwwards-research/playful-illustrative/STYLE.md) · [Reference research: Illoca](../legacy/awwwards-research/playful-illustrative/illoca/notes.md) · [Critique](../legacy/site/briefs/critiques/23-sowsheet.md) · [Current HTML](../site/work/sowsheet/index.html) · [Current interaction source](../site/work/sowsheet/main.js).

**Additional documents:** [Planner, seasons, and waitlist polish notes](../legacy/scratch/sowsheet-polish/QA.md).

<a id="24-grevholt"></a>

### 24 · Grevholt Group

**What it does:** A corporate group website organizing four workwear/outdoor/safety/textile brands, operations, investor information, news, careers, and responsibility.

**Style:** Corporate Premium. Restrained monochrome UI, very large statements, framed photographic hero, strong image crops, clear corporate information architecture, and a dark careers band.

**Core idea:** Own the whole working life of a product: material, construction, use, and repair. One boot provides a continuous object through that story.

**Interactions and signature moments:**

- The hero uses a slow photographic move; a Group mega-menu and single-open brand panels organize the portfolio.
- One pair, three lives scrolls from separate material panels into a stitched boot, then replaces its worn outsole.
- An explicitly illustrative market chart supports period selection and pointer/keyboard inspection.
- A news carousel, KPI counters, and repaired-boot handoff connect product craft to the responsibility section.

**Version/context note:** Northvale is the earlier name. The v2 boot assembly/repair story supersedes the warehouse-only set piece; the warehouse remains a shorter operations band. Investor values are illustrative.

**Source documents:** [Brief](../legacy/site/briefs/24-northvale.md) · [Style guide](../legacy/awwwards-research/corporate-premium/STYLE.md) · [Reference research: Wolverine Worldwide](../legacy/awwwards-research/corporate-premium/wolverine-worldwide/notes.md) · [Critique](../legacy/site/briefs/critiques/24-grevholt.md) · [Current HTML](../site/work/grevholt/index.html) · [Current interaction source](../site/work/grevholt/main.js).

<a id="25-tidewright"></a>

### 25 · Tidewright

**What it does:** An autonomous marine-drone company concept presenting capabilities, vessel comparisons, mission examples, leadership, press, and a survey enquiry.

**Style:** Corporate Premium. Sea-glass/steel-blue tint ramps, light Newsreader headlines, framed maritime images, precise telemetry, a persistent numbered side index, and aligned technical specifications.

**Core idea:** Turn steadiness and autonomous inspection into something visible: show the vessel holding position, the fleet at scale, and the route and findings of an actual illustrative mission.

**Interactions and signature moments:**

- A retractable index tracks section progress and preserves its collapsed state; mobile uses a top/index treatment.
- Telemetry/leader lines identify the vessel and sensor mast, while an aerial sequence illustrates station keeping.
- Fleet specs switch metric/imperial order and highlight corresponding rows across cards.
- A schematic mission map filters eight points and runs finite approach/sonar/result replays with Play, Pause, Resume, Replay, and Coast controls.

**Version/context note:** The original brief only specifies hover cards for the missions map; later polish turns it into an operational replay. The vessel imagery and mission outcomes are fictional, and the footer tide is simulated.

**Source documents:** [Brief](../legacy/site/briefs/25-tidewright.md) · [Style guide](../legacy/awwwards-research/corporate-premium/STYLE.md) · [Reference research: Seasats](../legacy/awwwards-research/corporate-premium/seasats/notes.md) · [Critique](../legacy/site/briefs/critiques/25-tidewright.md) · [Current HTML](../site/work/tidewright/index.html) · [Current interaction source](../site/work/tidewright/main.js).

**Additional documents:** [Later mission replay and station-keeping notes](../legacy/scratch/tidewright-polish/README.md).

## Important differences between old briefs and the delivered sites

| Site | Earlier document | Use for the portfolio description |
| --- | --- | --- |
| Fieldbook Type | The revised brief removed the 3D gallery and specified a proof sheet. | The later user-approved build restores Ring/Grid/Spiral/Scatter while retaining the interactive Plot and tester. |
| Mossline | Earlier stone instructions describe live Three.js; the v3 brief describes smoothing and smaller transfer targets. | The final build uses Blender-rendered image sequences. Cut frames snap without blending; hero sway still blends. Use the current source README for delivery details. |
| Silver Hour | The earlier brief describes a simpler print-development treatment. | The later revision develops highlights before shadows and improves discovery of the dark-room viewer. |
| Kamen Lodge | The brief proposes holding to reveal winter. | The later build uses a single Summer/Winter switch. |
| Undersun | The brief puts pilot sites after the underground sequence. | The later build places sites before the descent, allowing the return to flow into careers. |
| SORT, Loud Hours, Snack Atlas, Tidewright | Their short initial briefs predate several signature moments. | Include the developed logo/shop handoff, expanded Shorts canvas, packing/stamp sequence, and mission replays respectively. |
| hello.exe | The brief names Rui Amaral and describes windows more generally. | Use fictional designer Juno Rebelo and the seven developed working apps. |
| Sowsheet | The old Plotline brief uses a separate seasonal strip. | The later build carries the edited bed into the live seasonal axonometric view. |
| Grevholt Group | An earlier build centered a long warehouse-image sequence. | The revised signature is the boot's material/assembly/repair story. |

## Using this material in the portfolio

Project stories can start with the purpose and core idea above, then explain two or three decisions through screenshots, interaction clips, or drawings from the actual build. Label the work as self-initiated and describe what was made rather than implying that the fictional business was a paying client.

The archived reference names document the original research. They are provenance, not a direction to reuse another site's copy, images, branding, or code. Local archive links are for authoring only and will not resolve in a fresh clone without that archive; the descriptions in this file remain readable without it.

