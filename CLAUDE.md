# CLAUDE.md

Instructions for AI coding agents working in this repo.

## What this is

A public, buildless static site (`dist/`) that browses ForeverAPIExplorer captures: the
Lua environment catalog, typed character evidence, and an API coverage map built from
normalized character profiles (which call supplies each field, and in what state), with
coverage comparisons between captures. Python scripts in `scripts/` import captures into
`dist/`; the front end is plain JS (`dist/*.js`, `dist/compare.mjs`). `PROFILE_FORMAT.md`
and `dist/profile.schema.json` define the profile contract.

The atlas maps what the API returns; it doesn't track a character's progress, which is the
Character Planner's job (#18). Don't add progress or value-change features here.

## Commands

Run from `scripts/`:

```
python test_profiles.py
node --test test_compare.mjs test_items.mjs
python test_import_dump.py
```

`test_profiles.py` imports `jsonschema` from `../ForeverAPIExplorer/.test-deps` when that
folder exists, else from the installed package. `test_import_dump.py`'s real-dump test needs
dumps in `../ForeverAPIExplorer/data/` (local only) and skips without them; report the skip
rather than treating it as a pass.

## CI

GitHub Actions in `.github/workflows/`, on pushes to `main` and on pull requests:

- `ci` / `secret-scan`: gitleaks over the full history.
- `ci` / `test`: the three test commands above, with `jsonschema` pip-installed (pinned
  version) and the real-dump test skipped.
- `codeql`: advanced setup for `actions`, `python` and `javascript-typescript` (also weekly);
  GitHub's default CodeQL setup must stay off.
- `dependency-review`: fails a PR that adds a dependency with a high or critical
  vulnerability or a non-permissive license (`.github/dependency-review-config.yml`).

Actions are pinned to full commit SHAs with the version in a comment; Dependabot
(`.github/dependabot.yml`) updates them weekly. Keep new actions pinned the same way and give
each job only the permissions it needs.

Import a capture: `python scripts/import_dump.py ../ForeverAPIExplorer/data/<dump>.lua dist/catalog.json`.
Rebuild all profiles: `python scripts/build_profiles.py ../ForeverAPIExplorer/data dist`.
Preview: `python -m http.server 8080 --bind 127.0.0.1 --directory dist`.
Container (what atlas.durishlabs.com runs, roadmap #33): `docker build -t atlas-test .` then
`docker run --rm -p 127.0.0.1:8090:80 atlas-test`. `nginx.conf` serves `dist/`;
`security-headers.conf` holds the CSP and security headers and must be included in every
`location` that sets its own headers (a location with any `add_header` stops inheriting the
server's). Check a change under the real CSP in the container, not only with `http.server`:
anything new loaded from another origin, or inline, needs the CSP changed on purpose.

Hosting config is `.openai/hosting.json` (serves `dist/`). Publishing is the user's call.

## Rules

- `dist/` holds real character data (catalog values, character name and GUID, history,
  snapshots), and the repository is public. Don't add new personal data (other characters,
  account names, chat) unless the user means to share it.
- The importer parses SavedVariables as data and must never execute Lua. Keep rejecting
  unsupported syntax rather than guessing.
- Never invent API signatures or fields: everything shown comes from a capture.
- Keep `history.json` and `snapshots/` append-only; don't rewrite or drop past snapshots.
- Missing or restricted values are never zero, false or "removed" in comparisons.
- Changing the profile shape means a new schema version, with `profile.schema.json`,
  `PROFILE_FORMAT.md` and the tests updated together.
- Every behaviour change gets a test.
- The site loads nothing from third parties. Fonts are self-hosted in `dist/fonts/` (SIL OFL,
  licenses alongside); add new weights or fonts there, not from a CDN.
- Commits and pushes need the user's go-ahead. Work on a branch and open a PR.
