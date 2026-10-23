# otherweather° implementation

Updated 2026-10-23 after continuing the portfolio rebuild. Local only; no hosting account or production deployment has been created.

## Current implementation

The rewritten `scripts/build_portfolio.py` is the source for the homepage, work index, 25 stories and public catalog. Its Python 3.9 syntax errors were fixed, and the shared CSS and JavaScript were brought into sync with its new markup. Regenerate with `python3 scripts/build_portfolio.py`; `--check` detects stale output.

- `/`: wipeable dawn glass with a rotating concept reel, studio statement, six featured project climates, a draggable 25-project collection, studio capabilities, process barometer, and night contact.
- `/work/`: counted filters, phone previews, delayed desktop hover previews, URL state and browser Back restoration.
- `/projects/<slug>/`: brief, desktop/phone captures, interactions to try, device-switchable live concept, decisions, credits and next project.
- `/work/<slug>/`: the 25 original concepts, unchanged.

The homepage uses the shortened display title “Challenger Deep” in its featured section; the catalog and story retain the full project name.

## Interaction and fallback behavior

The rebuild uses native scrolling and CSS sticky sections, with no GSAP or Lenis dependency. Desktop forecasts stack as visitors scroll; phone layouts remain in normal flow. The studio introduction and process dial stay beside their content on desktop. The process needle follows the visible step. All content remains in the document and keyboard navigation order.

The fog uses independent, section-local Canvas 2D surfaces. The previous fixed WebGL surface, animated grain, automatic wipe and droplets were removed after visible scroll flicker. Condensation has stable broad tonal variation and a feathered persistent wipe mask shared with the blur and text layers. Scrolling does not redraw, move or reparent a canvas. Window resizing scales the existing normalized texture and masks without clearing or reallocating the visible canvas; pointer coordinates map into the retained texture. Initial painting completes before the fog is shown. Horizontal touch wiping preserves native vertical scrolling. The reel pauses offscreen or when the tab is hidden. Visible project clips play lazily; hover clips wait for interaction on desktop. The collection supports dragging, native touch scrolling, arrow keys and previous/next buttons.

Concept iframes load only on Play. Phone view uses a 390×844 viewport; desktop uses 1440×900. Stop, Escape (including inside the same-origin frame), or leaving the device offscreen unloads it. Two concepts retain their catalog-defined standalone-only fallback.

Reduced motion uses posters, native scrolling, no canvas fog, no cursor effect and no stacked forecasts. With JavaScript disabled, the content and navigation remain available. If Canvas 2D is unavailable, static frost remains. Changing the OS motion preference reloads the page into the corresponding mode.

The real São Paulo clock and optional Open-Meteo conditions remain. Failed weather requests leave the clock alone. Contact links use the previously supplied `pedromariano.s@outlook.com`; they open the visitor’s mail client.

## Validation

Use `python3 scripts/check_site.py` for generated output, catalog completeness, local references, JavaScript syntax and all four Mossline frame sets. Use `python3 scripts/preview.py` for local preview.

The browser suite is `node scripts/test_portfolio.mjs`, with `TEST_ORIGIN`, `PLAYWRIGHT_MODULE` and `CAPTURE_BROWSER` overrides. It covers desktop/phone filtering and Back, homepage navigation, all 25 project stories, device switching and iframe unloading, plus reduced-motion, no-JavaScript and no-WebGL fallbacks. Screenshots and reports go to `/tmp`.

The rebuild passed all 57 browser journeys, plus focused checks for fog wiping, collection buttons/keyboard, delayed video previews and overflow at 320, 768 and 1024 pixels. Desktop and phone screenshots were reviewed. Structural checks passed, and Git reports no modifications to the original concept files.

`node scripts/test_fog.mjs` verifies that the fog’s pixel output remains identical through six scroll positions on desktop and phone, and checks the separate night surface. The resize regression originally detected 16 transparent surface samples. After retaining the textures across resizes, desktop and phone checks found zero blank frames and exactly preserved fog pixels and wipe masks.

Earlier Lighthouse scores and browser results describe the previous implementation and should not be treated as measurements of this rebuild. Physical-device, manual screen-reader and production performance checks remain separate from local headless verification.

## Deployment boundary

`python3 scripts/export_site.py --output dist` checks and exports runtime files to a new or empty directory. It excludes `_src/`, dotfiles and the optional prototype. A static host must preserve directory routes and compress text responses.

Hosting and a production domain remain to be chosen. Set absolute social-image/canonical URLs for that origin and verify enquiry delivery before launch. The original concepts and their editable sources are preserved; local `legacy/` is not a runtime dependency.
