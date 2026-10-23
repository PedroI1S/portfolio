# otherweather° — studio and portfolio plan

Draft 02 for discussion · 2026-10-21 · Planning only

Draft 01 aimed for a calm editorial frame with one restrained effect. That undersold the studio. This site is the flagship piece: it has to move at least as well as the best of the 25 concepts it presents. Draft 02 replaces that direction with a motion-led one. Routes, project-story content and launch requirements carry over.

Storyboard: [PORTFOLIO-STORYBOARD.html](PORTFOLIO-STORYBOARD.html). Open it in a browser; the frames are animated and use real captures in `docs/storyboard/`. It replaces the draft 01 wireframe.

## Direction

**otherweather is an independent studio in São Paulo for distinctive websites, motion, and interactive experiences.** The site's job is to win project enquiries from international clients. Its proof is that it feels unlike any template.

Creative concept: **scroll from fog to night.** The landing page is one continuous weather system:

- It opens on a fogged window that the visitor wipes clear with the cursor.
- Each selected project sweeps in like a weather front, and the whole page takes on that project's atmosphere.
- The day turns to dusk and then night as the visitor moves toward contact.
- At the end the fog returns, as a bookend.

The studio's own identity stays monochrome and typographic. The color comes from the projects themselves.

Name and mark: **otherweather°**, lowercase, with the degree sign as the brand mark. The degree sign also becomes the cursor, the active-section marker in the navigation, and the favicon. The plain-text name still works on an invoice or in an email signature.

Treat all copy below as draft language, not approved claims about services or team size.

**Source for project content:** [style.md](style.md) describes every concept's purpose, core idea and signature interactions. Where it notes that an earlier brief was superseded, follow the delivered version. Examples: Mossline's rendered sequences, Kamen Lodge's Summer/Winter switch, Fieldbook's restored 3D gallery.

## Showing the work: interactions and phones

All 25 concepts have their own signature interactions and a polished mobile build. The studio site should prove both everywhere, rather than presenting them as desktop screenshots.

- **Data.** Each project gets:
  - a one-line signature interaction, for example "Incense smoke follows the pointer";
  - two to four interaction bullets, taken from `style.md`.

  These appear on the landing page, the strip, the index and the story pages.
- **Media.** For every concept:
  - a desktop poster and a phone poster;
  - a desktop clip and a phone clip of its signature interaction being used. Show the interaction itself, not a scroll-through.

  Selected projects get 6–8 s loops; the rest get 3–4 s previews.
- **Landing.**
  - The hero fog hides clips of these interactions.
  - Each forecast scene pairs the tilted desktop clip with a phone playing the mobile build. The phone sits at a different parallax depth.
  - Every strip card carries its phone capture and its interaction caption.
- **Index.** The fourth column is the signature interaction, so the list reads as 25 ideas. A "Phone view" toggle swaps every preview to the mobile build.
- **Story pages.** A **Play it here** block runs the actual concept in a device frame, phone first, with a Desktop toggle:
  - It loads only when the visitor presses Play: a same-origin iframe of `/work/<slug>/`, unloaded offscreen.
  - The frame has a title and an "Open full screen" link.
  - Check each concept inside an iframe before enabling it (sound, pointer capture, fixed headers, pins). If one misbehaves, fall back to its clips.
- **Decisions** in each story come from that project's interactions in `style.md`, each shown on both devices where the mobile version solves it differently.

## Reference research

### Hello Hello (live browser pass, 2026-10-21)

[Hello Hello](https://www.hellohello.is/) is a Next.js site using GSAP with ScrollTrigger, Lenis smooth scrolling, one WebGL canvas and seven videos. It is about 13 screens long, with three pinned sequences.

What makes it feel alive:

| Device | What it does | Our version |
| --- | --- | --- |
| Hero object | A WebGL glass "++" sits behind giant stacked type. A red light inside it follows the cursor, and the camera slowly drifts and zooms. | Fogged glass that the cursor wipes. The pointer is the light source. |
| Large statements | Sentences in two tones, grey lead-in and white claim. | Words fill from grey to ink as you scroll, with inline project pictures. |
| Pinned photo collage | One small photo grows and others fly in around it to form a collage while the text holds. | The hero picture shrinks into a word of the statement (the same move, reversed). |
| Pinned capabilities | A numbered category list steps through while rows swap. | Three capabilities, each with a live pointer toy. |
| Featured work | Sticky project label on the left; large media on the right swaps project by project. | The forecast: each project takes over the page's atmosphere. |
| Big analog figure | A giant clock arc collapses into five time-zone clocks. | A barometer dial for the process. |
| Persistent details | Live local time, a "now playing" widget, a section dot in the navigation, a pixel-glitch logo. | Live time and conditions, the degree marker in the navigation, a wordmark that responds to wind. |
| Bookend | The footer brings the hero object back behind a red "Let's make it happen." | Night fog and a magnetic "Start a project". |

The other references still apply to content structure:

- **Instrument:** make clear what a client can commission.
- **Instrument's Oura case study** and **Koto:** project stories are told as decisions paired with artifacts.

None of these is a template. Their client lists, awards and scale belong to them.

## Art direction

**Palette by time of day.**

| Section | Background | Ink | Mood |
| --- | --- | --- | --- |
| Hero (dawn) | Fog `#E6EAEC` | `#101317` | Morning |
| Statement (day) | `#F0F1ED` | `#101317` | Daylight |
| Studio (dusk) | Gradient from `#34405A` to `#1A2030` | Light | Dusk |
| Process (night) | `#10151F` | Light | Night |
| Contact and footer (deep night) | `#07090C` | Light | Night |

During the forecast, each project supplies its own background and ink, sampled from its live site:

| Project | Background | Ink |
| --- | --- | --- |
| Challenger Deep | `#061016` | `#E8F0F2` |
| Mossline | `#132316` | `#E9EEDF` |
| SORT | `#EAE3DB` | `#1B2BD6` |
| House of Vey | `#0F3327` | `#EFE6D2` |
| Thimble Planet | `#0A0C22` | `#EEF0FF` |
| Snack Atlas | `#FF5A36` | `#2A1036` |

One fixed accent, signal blue `#315CFF`, is used for the degree mark, the cursor, focus rings and the main call to action.

**Type.** A neutral grotesk with a width axis, so the footer wordmark can stretch in the wind and headings can tighten on small screens. Candidates under the SIL Open Font License:

- Mona Sans (width 75–125, weight 200–900): the leading choice.
- Hubot Sans: an alternative.
- A small monospace, such as Geist Mono or JetBrains Mono, for metadata.

Headings are huge and tight, at about −0.045em letter spacing. Confirm licensing and self-host the fonts.

**Layout.** A 12-column grid with 48–56 px desktop margins. Giant headings sit against small monospace labels. Media is large and slightly tilted toward the pointer. Thin rules are kept for the index and capability lists.

**Imagery.** Each concept gets:

- desktop and phone posters;
- desktop and phone interaction clips (see above);
- one blurred variant for the hero's fog.

The project captures are the palette.

## Motion and interaction system

**Engine:**

- Lenis smooth scrolling on desktop pointers only; touch devices keep native scroll.
- GSAP with ScrollTrigger for pins and scrubbing. GSAP and its plugins are free to use; vendor them locally as ES modules, not from a CDN.
- One shared WebGL canvas, fixed behind the content, for the fog, the fronts and the lens. Use Three.js or raw WebGL, following the pattern from earlier pieces.
- Plain static HTML pages. No framework.

**Cursor.** A small blue degree ring that eases behind the pointer. It changes state by context:

| State | Where |
| --- | --- |
| Wipe | Hero and contact glass |
| View | Project media |
| Drag | The 25-concept strip |
| Magnetic pull | Buttons |
| Open | Index rows |

The native cursor stays available, the custom cursor is hidden on touch, and focus styles never depend on it.

**Pinned scenes.** Every pin has a visible progress indicator and a clear start and end state. Pins are scrubbed rather than auto-played, so scrolling back reverses them exactly. No single pin is longer than 2.5 viewports. The landing page totals about 16 desktop screens.

**Page transitions.**

- Cross-document View Transitions (`@view-transition { navigation: auto; }`) morph a project card's media and title into the story hero.
- "Open live concept" plays a short front-wipe in the project's color, then navigates normally.
- Browsers without support simply navigate.

**Ambient details:**

- Live São Paulo time and current conditions in the header, for example "São Paulo 19:13 · 22° · light drizzle".
  - Time uses `America/Sao_Paulo` (UTC−3).
  - Conditions come from Open-Meteo at about −23.55, −46.63. It needs no API key; cache the result for 15 minutes.
  - The line is always real. The time-of-day palette is a scroll metaphor, not the clock.
  - If the fetch fails, show the time only.
- The degree marker in the navigation tracks the current section.
- A first-visit loader only if fonts and the poster need it, capped at about 1 s and skipped on repeat visits.

**Guardrails.** The rest is spectacle; these are the requirements.

- `prefers-reduced-motion` gets a complete static page:
  - no Lenis, no pins, no WebGL;
  - posters with a static frost;
  - all copy and links identical.
- Without JavaScript, the same static page renders.
- All text is real DOM text. Canvases are decorative and hidden from assistive technology.
- Keyboard focus moves through pinned scenes and scrolls them correctly.
- Performance:
  - posters paint first, with LCP under 2.5 s on a mid-range phone;
  - device pixel ratio capped at 1.5;
  - only the visible video plays;
  - offscreen scenes pause their render loops.
- The studio site must match the polish of the concepts' own mobile builds. Mobile keeps every scene's idea, with shorter pins and touch gestures. For example, horizontal drags wipe the hero glass while vertical drags still scroll.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page: the weather-system scroll |
| `/work/` | Index of all 25 concepts |
| `/projects/<slug>/` | Project story, separate from the live concept |
| `/work/<slug>/` | Existing finished concept. Route and experience are preserved untouched. |
| `/#studio` | Studio, capabilities, process |
| `/#contact` | Enquiry |

Navigation: **Work · Studio · Start a project**. The wordmark links home.

Visitor journey: landing → project story → live concept → Back → next project or enquiry. Live concepts open in the same tab.

**`/work/` today.** There is no `site/work/index.html` yet; `scripts/preview.py` points at `/work/`, which currently shows a directory listing. Adding the index file is compatible with `check_site.py`, which only compares the slug directories.

## Landing page, scene by scene

The storyboard shows each scene's frame, its scroll length, pointer behavior and fallback.

1. **The fogged window** (arrival; 1 viewport).
   - Full-screen condensation, with clips of the 25 concepts' signature interactions drifting behind it as blurred color.
   - The cursor wipes the glass clear. Headline text inside the wiped area flips from ink to white, beads run from the edges, and the fog re-forms after about 3 s.
   - After 2 s idle, a "ghost finger" draws one stroke to teach the gesture.
   - A "Behind the glass" label with 25 ticks names the current project and links to it.
   - Headline: "A different atmosphere for the web." Supporting line plus **Explore the work** and **Start a project**.
2. **Clearing the glass** (pinned, 1 viewport). Scrolling evaporates the fog. The revealed picture then shrinks and lands as an inline image in the next sentence.
3. **Statement** (pinned, 1.25 viewports).
   - Text: "otherweather is an independent studio for distinctive websites [img], motion [img] and interactive experiences [img]. Every project gets its own [img] climate."
   - Words fill from grey to ink with scroll. Each picture widens under the cursor and links to its project.
4. **The forecast** (pinned, about 0.9 viewport per project; the centrepiece).
   - Six selected projects. As each one arrives, a front sweeps across: a WebGL wipe with a refraction band at its edge.
   - The page then adopts that project's background, ink and grain.
   - Left column: number, giant name, a one-line forecast, capability tags, the "Self-initiated concept" label and View project.
   - Right: the desktop interaction clip tilts toward the pointer, with a magnifying lens under the "View" cursor. Beside it, a phone plays the mobile build at a different parallax depth.
   - The left column also gets a **Try in the concept** line naming the real interaction from `style.md`, under the playful forecast.
5. **25 atmospheres** (pinned, 2.5 viewports, horizontal).
   - The full collection slides sideways. Each card shows its desktop capture, an inset phone capture and a one-line signature interaction.
   - Cards lean with scroll velocity, and the counter and style label update as each card crosses the centre.
   - The strip can also be dragged or moved with the keyboard. It ends at **Explore all 25 →**.
6. **Studio** (dusk; pinned, 2 viewports in 3 steps).
   - A personal introduction and portrait on the left.
   - On the right, three capabilities step through, each with a live toy:
     - **Website design:** type that reflows and widens under the cursor.
     - **Creative development:** isobars that bend around the pointer.
     - **Motion and interactive storytelling:** a timeline scrubbed by pointer x.
   - Each capability links to two projects that prove it.
7. **The barometer** (night; pinned, 1.25 viewports). A large dial rises from the bottom edge, and scroll swings the needle through Direction → Design → Build → Refine & launch. The readout states what happens and what the client receives at each stage. Ticks lean toward the cursor.
8. **Contact and footer** (deep night).
   - The fog returns over blurred city lights.
   - Headline: "What are you imagining?" One large magnetic **Start a project** button and a plain email address.
   - The footer wordmark stretches letter by letter as the cursor passes.
   - Real links only.

## Featured selection (revised after the capture review)

Desktop (1440 × 900) and phone (390 × 844) captures of all 25 opening screens were taken on 2026-10-21. For a motion-led studio, the opening six should show interaction and atmosphere range. Thimble Planet replaces Cal & Sombra in the six. Cal & Sombra stays prominent in the strip and the index.

| # | Project | Atmosphere | Draft forecast line |
| --- | --- | --- | --- |
| 1 | Challenger Deep | Abyssal blue-black | "Pressure rising past 1,000 bar. Light gone by 200 m." |
| 2 | Mossline | Moss green | "Humid and still. Carbon settling slowly into the soil." |
| 3 | SORT | Paper white, cobalt | "Clear and high contrast. One strong front, six objects." |
| 4 | House of Vey | Bottle green, cream | "Indoors. Four rooms, lamps on by evening." |
| 5 | Thimble Planet | Night indigo | "A small world turning. Local weather, tiny and clear." |
| 6 | Snack Atlas | Tomato orange | "Warm spells, scattered crumbs, a good chance of seconds." |

The order alternates dark and light so that every front is a visible change. Each scene also shows its "Try in the concept" line:

| Project | Try in the concept |
| --- | --- |
| Challenger Deep | Scroll is the descent: depth, light, pressure and labels follow it, through a window crack to the seabed. |
| Mossline | A pinned image sequence turns the specimen, descends its horizons and inserts the probe. |
| SORT® | Reorder the wordmark and the product grid rearranges to match. |
| House of Vey | The gate opens into the 3D door; four lit rooms; colorways recolor the scene. |
| Thimble Planet | Fly to a landmark and work it: lighthouse beam, windmill, tide. |
| Snack Atlas | Pick a country, pack the box, and it becomes a postcard stamp. |

Verify the forecasts' facts against each concept. Alternates: Night Train, hello.exe, Noct & Vale.

## Portfolio index, `/work/`

- Title: **Work & explorations**, with one line explaining that these are self-initiated concepts.
- Desktop shows a large typographic list of all 25 (number, name, style, signature interaction), with a **Phone view** toggle for the previews:
  - The hovered row brightens.
  - A preview follows the cursor with spring lag and leans with velocity.
  - The clip plays after 400 ms of rest.
  - The page tints toward that project's atmosphere.
- Touch devices get a column of poster cards instead, with nothing that depends on hover.
- Filters: **All · Web design · Motion · 3D & interaction**, with counts and keyboard and assistive-technology state. The selection is stored in the URL and restored on Back. Rows animate when the filter changes.
- The primary action is the project story. A separately labeled **Open live concept** gives direct access to the finished site.
- Never run live concepts inside the index; it uses posters and clips only.

## Project-story template, `/projects/<slug>/`

All 25 get a concise story. The six selected get the richer, pinned version.

1. Hero, morphed from the card via a View Transition: name, premise, "Self-initiated concept" label, verified scope, and **Open live concept ↗**.
2. A brief: the imagined subject, the intended visitor, and the design question, drawn from "What it does" and "Core idea" in `style.md`.
3. **Play it here:** the live concept in a phone frame, with a Desktop toggle (see above).
4. Two or three decisions built from the signature interactions, each pinned briefly beside its desktop and phone artifacts, with implementation notes where they explain the craft.
5. Credits, including third-party assets and AI-generated imagery. Keep the disclosures that already exist in the concepts. Fictional brands, people, figures and commerce states stay labeled as illustrative.
6. Next project, all work, and an enquiry link.

Opening the live concept plays the front-wipe in the project's color, then navigates normally. The concept itself is untouched.

## Build sequence

1. **Hero prototype first.** This is the riskiest part and the strongest first impression. Build the fogged window (wipe mask, droplets, montage, masked headline twin) and its static fallback as a standalone page. Test it on a mid-range phone and a high-refresh desktop, then judge it before building anything else.
2. **Asset and content pass.** Prepare:
   - desktop and phone posters for all 25;
   - desktop and phone clips of each signature interaction (6–8 s for the selected six, 3–4 s for the rest);
   - blurred hero variants;
   - per-project palette tokens;
   - signature lines and interaction bullets from `style.md`.

   Also test every concept inside an iframe. The `docs/storyboard/` captures (960 px desktop, 390 px phone in `m/`) are placeholders only.
3. **Landing system.** Build the shared canvas, Lenis with ScrollTrigger, the cursor, then the scenes in order. Check reduced motion and mobile after each scene, not at the end.
4. **Index and story template.** Build the list with previews, the filters, the View Transitions and one complete story (Challenger Deep).
5. **Populate.** Add all 25 stories and finish the six rich stories.
6. **Launch preparation.**
   - A verified enquiry channel.
   - Metadata and social images.
   - Keyboard, screen-reader and Lighthouse passes, plus structural checks.
   - Hosting for the existing directory structure.

## Repository notes

- Keep `site/` as the web root and preserve every `/work/<slug>/` concept. Studio assets live in a shared folder, for example `site/_studio/`.
- A small Node or Python generator can produce the 25 story pages and index entries from one data source extended from `docs/projects.json`. Keep the single source of truth for slugs, and add story fields: premise, signature line, interaction bullets, forecast line, tags, palette, desktop and phone media, and whether the live embed is enabled.
- Add checks for the new routes, story completeness, poster and clip presence, and generated links.
- `_src/` stays out of deployment output, and nothing may depend on `legacy/`.
- Preview with `python3 scripts/preview.py`; validate with `python3 scripts/check_site.py`.

## Decisions to confirm

- **Concept:** fog-to-night weather system as the spine. Alternatively, keep the motion vocabulary and drop the day cycle.
- **Featured six and order:** Thimble Planet in, Cal & Sombra out.
- **Content:** Pedro's bio and portrait, the service list, process deliverables.
- **Contact:** a working mailbox or form service, and real social profiles.
- **Display typeface:** Mona Sans, or alternatives.
