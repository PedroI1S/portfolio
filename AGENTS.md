# Working in this repository

- Read `README.md`, `docs/HANDOFF.md`, and `docs/projects.json` for the current structure and page list.
- `site/` is the web root. Finished pages live at `/work/<slug>/`. Preserve these routes when building the portfolio.
- Keep changes within the user's requested scope. Environment preparation does not include redesigning finished concepts.
- Use `python3 scripts/preview.py` for a threaded local preview and `python3 scripts/check_site.py` for structural checks. Node.js is needed for the JavaScript checks.
- `_src/` contains editable authoring sources; it must not be included in future public deployment output.
- `legacy/` is local-only history, not an input dependency. Never force-add it or introduce runtime references to it.
