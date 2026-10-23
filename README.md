# otherweather° — portfolio

A static studio portfolio presenting 25 finished website concepts. The fog-to-night homepage, work index and 25 project stories surround the original, unchanged concepts.

## Local development

Requirements: Python 3.9+ for the preview server; Node.js 24+ for JavaScript checks. No package installation or build step is needed to view the pages. Fonts and animation libraries load from their existing public CDNs, so a network connection is needed for the full experience.

```sh
python3 scripts/preview.py
```

Open <http://127.0.0.1:4173/> for the studio, <http://127.0.0.1:4173/work/> for all 25 projects, or a live concept such as <http://127.0.0.1:4173/work/mossline/>. Stories live at `/projects/<slug>/`. The preview uses concurrent requests for image sequences and compresses text responses. Choose another port with `--port 4317` if needed. Stop with Ctrl-C.

```sh
python3 scripts/check_site.py
```

Checks the catalog, all 27 portfolio routes and 25 concepts, generated output, story content, poster/clip presence, local asset references, all four Mossline frame sets, and JavaScript syntax. The same check runs in GitHub Actions. These are structural checks; browser verification remains a separate step.

The committed pages need no build step to view. After changing the project catalog or studio template, regenerate with `python3 scripts/build_portfolio.py`. Optional browser journeys use `node scripts/test_portfolio.mjs`; see [implementation and launch notes](docs/PORTFOLIO-IMPLEMENTATION.md) for tooling overrides and verification limits.

Create a deployment directory with `python3 scripts/export_site.py --output dist`. This runs checks and copies runtime files only, excluding `_src/`, dotfiles and the standalone prototype. The output must be new or empty; serve it as the static host's document root.

### Live Tunnel (GitHub Pages + Cloudflare)

Share the portfolio publicly via a fixed link that redirects to a live Cloudflare tunnel (active for up to 24h per run):

```sh
node scripts/tunel.mjs
# or: npm run tunnel
```

The script verifies the local preview server on port 4173, starts `cloudflared`, tests the route through public DNS, updates `destino.json` on GitHub Pages, and presents the fixed link at <https://pedroi1s.github.io/portfolio/>. Press Ctrl-C in that terminal to turn off the tunnel and mark the fixed link as offline.

## Layout

```text
site/index.html      otherweather° landing page
site/_studio/        Shared studio styles, motion, fonts and captured media
site/projects/<slug>/ Generated project stories
site/work/index.html Filterable collection of all 25 concepts
site/work/<slug>/     Finished pages and their runtime assets
  _src/              Editable asset-generation scripts and current source models
docs/                Page catalog and handoff for the portfolio build
scripts/             Local preview and repository checks
.github/workflows/   Continuous validation
legacy/              Local archive, ignored by Git (not present in fresh clones)
```

See [the page list](docs/PAGES.md), [build handoff](docs/HANDOFF.md), [portfolio plan](docs/PORTFOLIO-PLAN.md), and [media QA](docs/MEDIA-QA.md). The `site/` directory is the document root; existing `/work/<slug>/` routes are preserved.

## Source assets and local history

Current generation scripts stay beside their page so relative imports and output paths continue to work. Mossline's current `specimen.blend` is committed along with its scripts and delivered WebP sequences. Blender and image-conversion dependencies are only required to regenerate assets; see [its source README](site/work/mossline/_src/README.md).

Old briefs and plans, critiques, screenshots, research, original image exports, experimental tools, obsolete Mossline v2 files, and raw renders are preserved under the local `legacy/` folder. `legacy/README.md` explains the archive; `legacy/inventory.json` records original locations, archive locations, file sizes, and runtime-file SHA-256 checksums. Back up this folder separately if needed: GitHub does not contain it.

The pages are fictional website concepts. Page disclosures and existing source credits are retained. No repository-wide license has been added.
