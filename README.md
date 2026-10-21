# Portfolio

25 finished website concepts, prepared for the next phase: building the portfolio that presents them. The portfolio homepage has not been built yet.

## Local development

Requirements: Python 3.9+ for the preview server; Node.js 24+ for JavaScript checks. No package installation or build step is needed to view the pages. Fonts and animation libraries load from their existing public CDNs, so a network connection is needed for the full experience.

```sh
python3 scripts/preview.py
```

Open <http://127.0.0.1:4173/work/> to browse the page folders, or open a specific page, such as <http://127.0.0.1:4173/work/mossline/>. The preview uses concurrent requests for image sequences. Choose another port with `--port 4317` if needed. Stop with Ctrl-C.

```sh
python3 scripts/check_site.py
```

Checks the page catalog, required files, local asset references, all four Mossline frame sets, and JavaScript syntax. The same check runs in GitHub Actions. These are structural checks; visual and interaction testing remains a separate step when changing a page.

## Layout

```text
site/work/<slug>/     Finished pages and their runtime assets
  _src/              Editable asset-generation scripts and current source models
docs/                Page catalog and handoff for the portfolio build
scripts/             Local preview and repository checks
.github/workflows/   Continuous validation
legacy/              Local archive, ignored by Git (not present in fresh clones)
```

See [the page list](docs/PAGES.md) and [the build handoff](docs/HANDOFF.md). The `site/` directory is the document root; existing `/work/<slug>/` routes are preserved.

## Source assets and local history

Current generation scripts stay beside their page so relative imports and output paths continue to work. Mossline's current `specimen.blend` is committed along with its scripts and delivered WebP sequences. Blender and image-conversion dependencies are only required to regenerate assets; see [its source README](site/work/mossline/_src/README.md).

Old briefs and plans, critiques, screenshots, research, original image exports, experimental tools, obsolete Mossline v2 files, and raw renders are preserved under the local `legacy/` folder. `legacy/README.md` explains the archive; `legacy/inventory.json` records original locations, archive locations, file sizes, and runtime-file SHA-256 checksums. Back up this folder separately if needed: GitHub does not contain it.

The pages are fictional website concepts. Page disclosures and existing source credits are retained. No repository-wide license has been added.
