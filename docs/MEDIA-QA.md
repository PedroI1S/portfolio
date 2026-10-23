# Portfolio media and live-embed checks

Captured 2026-10-23 from the delivered concepts, without changing their files. The old `docs/storyboard/` images are planning references; public portfolio pages use fresh assets in `site/_studio/media/`.

- 25 desktop posters at 1440 × 900; 25 phone posters at 390 × 844; 25 blurred variants.
- 50 silent H.264 MP4 interaction previews, with 4:2:0 pixels and fast-start metadata. The six selected concepts have 7.2-second loops; others have 3.8-second previews.
- Every capture ran inside a same-origin iframe at the exact intended viewport. All 50 capture reports completed without JavaScript exceptions, audible autoplay, or scrolling the parent document.
- Native phone behavior is captured where it differs: Brisure uses its strategy accordion; Snack Atlas flips its country postcard because its packed-box sequence is a desktop treatment. Thimble Planet flies to the lighthouse and sweeps its beam. The recordings show a focused interaction rather than a general page tour.
- A second pass through the actual story template checks its sandboxed frame, 390 px default phone viewport, 1440 px Desktop mode, Stop, and offscreen unloading.

## Embed policy

23 stories enable the visitor-initiated live frame. Brisure Capital and Mossline show interaction previews with an ordinary link to the standalone concept:

| Concept | Observation | Portfolio behavior |
| --- | --- | --- |
| Brisure Capital | Terrain captions overlapped at later years during the initial capture review. | Clip fallback. Desktop media shows the contour pointer; phone media shows the strategy accordion. |
| Mossline | The delivered 390 px mobile page reports horizontal document overflow. | Clip fallback. Both device clips retain the delivered specimen/probe sequence. |

These are observations about the existing concepts; this portfolio build does not alter those implementations. Their routes and assets remain unchanged.

## Reproduce

Start `python3 scripts/preview.py --port 4317`, then run `node scripts/capture_media.mjs` for all concepts, or supply slugs and `--phone` / `--desktop` for a bounded recapture. The script needs Playwright, a Chromium browser, FFmpeg, and Pillow. `PLAYWRIGHT_MODULE`, `CAPTURE_BROWSER`, `FFMPEG`, and `CAPTURE_ORIGIN` can override local paths. Its raw frames use temporary directories outside the repository; diagnostic captures in ignored `docs/media-qa/` are local evidence only.

These are headless Chromium checks, not physical-device or high-refresh-display measurements. Visual review and sampled interaction checks do not establish exhaustive accessibility or every state of the 25 concepts.
