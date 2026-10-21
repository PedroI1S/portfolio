# Mossline v3 · specimen sources

The hero and the pinned cut play pre-rendered Blender 5.2 Cycles image sequences on a canvas (`../frames.js`). Everything is original and procedural: no downloaded textures or models, and nothing from `legacy/alethia_rock/` (that local archive was only looked at as a quality bar).

## Files
- `specimen_build.py` builds the whole scene and saves `specimen.blend`. Run `blender -b --factory-startup -P specimen_build.py` (about 20 s).
  - **Soil block:** a superellipsoid that is voxel-remeshed and then displaced: torn sides, voronoi clods with fissures, a lumpy root-ball bottom, hummocky turf and an overhanging turf lip. It is cut by the plane `x = 0.20`, and the clean face is filled with a constrained-Delaunay grid. An EXACT boolean adds a worm burrow and pores. The material carries the horizons (humus `#1f160e`-ish, topsoil, subsoil), crumb aggregates, pores, mineral grains, mottles and mycelium. It has adaptive-subdivision displacement.
  - **Stone:** a sculpted icosphere with cleavage planes, tilted bedding terraces (each bed set back by its own amount), a crack network and a ridged erosion pass. Cavity, strata and moss-mask attributes are baked per vertex. The material is ochre, buff and warm grey per bed, with dark crevices, worn edges, iron streaks, algal film and three lichen types. It also uses adaptive displacement.
  - **Plants:** made with bmesh: moss sprigs, moss fronds, white clover with the pale chevron, sorrel rosettes, a creeping stitchwort-like herb, grass, seed heads and four-petalled tormentil. The geometry-node groups `MS_SurfaceScatter` (mask-driven, upright blend) and `MS_PlantPoints` scatter them, and both have a `Growth` input for the intro unfurl.
  - **Ground detail:** roots, rootlets, cut-face roots and stubs, and mycelium threads as tubes. Pebbles and crumbs (on the face about 45 per cm²) are instanced by geometry nodes.
  - **Crumbs:** `MS_Crumbs` is a scrub-safe "particle sim": `u = fract(phase + Fall·speed)`. It is used for crumbs falling from the underside and for drifting crumbs in world space.
  - **Probe:** a lathed profile: graphite anodised body (radial anisotropy), three emissive lime bands, a cap with a status LED, and a steel tip. A light-linked strip softbox lights only the probe.
  - **Lights:** warm key, cool-lime rim plus a second rim, a top light, a low fill, an under light, a face rake (cut only) and the probe strip. AgX (Medium High Contrast) on a forest-black world with alpha film.
- `seq.py` holds the choreography. Every animated value is keyed on every frame.
  - **Hero (96 frames, 1200²):** frames 0–47 are the rise with growth, frames 48–95 a 12° yaw sway.
  - **Cut (160 frames, 1600×900):** 0–40 an 87° turn to the face, 40–100 a push-in down the profile, 100–150 the probe slides in and lights its bands at frames 133/138/143, 150–159 the lights drop.
- `render_seq.py` renders frames (resumable). All 160 cut frames are shipped; they render coarse-to-fine so the page can be tested early.
  - `render_all.sh` queues hero and cut.
  - Example: `blender -b specimen.blend -P render_seq.py -- --seq hero --res 1200 --samples 112`
- `export_anchors.py` writes `../seq/anchors-hero.json` and `../seq/anchors-cut.json`. These hold per-frame normalised screen positions of the `A_*` empties (via `world_to_camera_view`) for every rendered frame index.
- `convert_frames.py hero|cut` (system Python with Pillow and `cwebp`) writes the WebP frames into `../seq/`. Cut frames are composited over the page's background ramp (`#0F1F10` to `#080d0b`, the same function as `cutBg()` in `main.js`) and fade fully to `#080d0b` over frames 150–159.
- Raw PNG renders, review stills, logs, `_archive_v2/`, and v2 model sources now live under the local `legacy/site/work/mossline/_src/` archive, outside the repository.
- The current `specimen.blend` and its generation scripts remain here and are committed.
- To reconvert the archived PNGs without rerendering, copy `legacy/site/work/mossline/_src/renders/` back here as `renders/` first. Otherwise `render_seq.py` creates a new ignored render directory.

## Current delivery (2026-10-21)

The shipped files reflect the user's final higher-quality revision, superseding the earlier "Balanced" plan:

| Sequence | Frames | Dimensions | Approximate on-disk size |
|---|---:|---|---:|
| `seq/hero` | 96 | 1200 × 1200 | 18.63 MB |
| `seq/hero-m` | 96 | 800 × 800 | 9.95 MB |
| `seq/cut` | 160 | 1600 × 900 | 23.65 MB |
| `seq/cut-m` | 160 | 720 × 720 | 13.18 MB |

`convert_frames.py` currently uses q82 (hero), q78 (mobile hero), q80 (cut), and q78 (mobile cut). Desktop sequences total about 42.3 MB, mobile about 23.1 MB, before posters and other assets. These are file sizes, not new browser-transfer measurements.

The cut snaps to the nearest frame with blending disabled at the user's request. Hero sway still crossfades. The camera handoff uses `seq/handoff.json`, exported by `export_handoff.py` from projected specimen points. Keep these choices when changing the surrounding portfolio.

The static hero poster uses `seq/hero/0048.webp`; cut panels use `seq/cut/0040.webp`, `0100.webp`, and `0145.webp`, with equivalents in the mobile sequences.

## Regenerating assets

Previewing the page needs no rendering tools. Regeneration uses Blender 5.2 with Cycles; `render_seq.py` currently targets the macOS Metal GPU backend. WebP conversion additionally needs Python with Pillow and NumPy, plus `cwebp` on PATH. Work from this `_src/` directory so documented relative paths resolve.

```sh
blender -b specimen.blend -P render_seq.py -- --seq hero --res 1200 --samples 112
blender -b specimen.blend -P render_seq.py -- --seq cut --res 1600 --samples 112
python3 convert_frames.py hero
python3 convert_frames.py cut
```

Conversion replaces delivered WebPs; run it only when intentionally updating the visuals. Raw renders and logs are ignored by Git.

## Quality gate (blind critic, 2026-10-21)
A fresh agent got the 1600 px rest frame and `legacy/alethia_rock/site_original.png`, unlabelled and in random order, and was asked which is "the professional production render":
1. Ours picked as the production render (80 %).
2. Ours (85 %).
3. The reference (70 %). The named giveaways were fixed: dried-mud soil crackle, regular strata, glossy leaves, flat light, a box-like silhouette and pin-like rootlets.
4. Ours (85 %).

## Licences
No third-party assets. The fonts (Geist, Geist Mono) come from Google Fonts under the SIL OFL.
