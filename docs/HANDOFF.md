# Portfolio build handoff

Prepared on 2026-10-21. The user considers all 25 portfolio pages ready. This preparation did not build or deploy the portfolio homepage.

## Starting point

- Public repository: https://github.com/PedroI1S/portfolio
- Web root: `site/`.
- Finished concepts: `site/work/<slug>/index.html`, with page-specific CSS, JavaScript, images, and generated assets.
- Catalog: `docs/projects.json`; readable index: `docs/PAGES.md`.
- Preview: `python3 scripts/preview.py` (default port 4173).
- Validation: `python3 scripts/check_site.py` (Python 3.9+ and Node.js 24+).

## Next phase

Build the portfolio presentation around the existing concepts. Decide the portfolio's visual direction, content, and hosting approach with the user when that work begins. There is currently no homepage, framework, package dependency tree, deployment workflow, or GitHub Pages configuration.

Keep the existing `/work/<slug>/` routes working. Each concept is self-contained and currently uses relative assets and pinned CDN libraries. A hosting solution needs to serve `site/` as its document root, or provide an equivalent mapping. Keep `_src/` authoring directories out of any published output; the local preview blocks them. The future deployment should publish runtime files only.

Mossline contains all 96 hero frames and all 160 cut frames for both desktop and mobile. Its delivered sequences are deliberately retained in Git. As last approved by the user, the cut snaps between frames with blending disabled; the hero sway still blends. The camera handoff uses `seq/handoff.json`. Preserve this implementation while building the portfolio shell.

## Local history

The original `site/PLAN.md`, briefs, and critiques were moved into `legacy/site/`. They describe earlier iterations and may contain obsolete names, verdicts, performance figures, and implementation details. The current catalog uses final names and the current page folders. The most recent Mossline source README reflects the shipped files, rather than the older delivery plan.

The archive also holds research, screenshots, prototypes, tooling, image originals, raw renders, and obsolete Blender sources. It is intentionally excluded from Git; see local `legacy/README.md`. Runtime files were checked against SHA-256 hashes captured before reorganization. Existing page code and delivered assets were left byte-for-byte unchanged.

## Validation limits

The environment check covers static local references, JavaScript syntax, catalog completeness, and expected Mossline frame sets. Dynamically composed asset paths other than the frame sets, CDN availability, rendering, motion quality, accessibility, and device interactions require browser testing when page code changes. This preparation did not repeat the pages' prior full visual QA.
