# CLAUDE.md

Instructions for AI coding agents working in this repo.

## What this is

A private, buildless static site (`dist/`) that browses ForeverAPIExplorer captures: the
Lua environment catalog, typed character evidence, normalized character profiles and
snapshot comparisons. Python scripts in `scripts/` import captures into `dist/`; the
front end is plain JS (`dist/*.js`, `dist/compare.mjs`). `PROFILE_FORMAT.md` and
`dist/profile.schema.json` define the profile contract.

## Commands

Run from `scripts/`:

```
python test_profiles.py
node --test test_compare.mjs
python test_import_dump.py
```

`test_profiles.py` imports `jsonschema` from `../ForeverAPIExplorer/.test-deps`.
`test_import_dump.py` needs real dumps in `../ForeverAPIExplorer/data/` (local only) and
fails without them; report that rather than changing the test.

Import a capture: `python scripts/import_dump.py ../ForeverAPIExplorer/data/<dump>.lua dist/catalog.json`.
Rebuild all profiles: `python scripts/build_profiles.py ../ForeverAPIExplorer/data dist`.
Preview: `python -m http.server 8080 --bind 127.0.0.1 --directory dist`.

Hosting config is `.openai/hosting.json` (serves `dist/`). Publishing is the user's call.

## Rules

- `dist/` holds real character data (catalog values, history, snapshots). Keep the site
  private; never publish it or link it publicly without the user saying so.
- The importer parses SavedVariables as data and must never execute Lua. Keep rejecting
  unsupported syntax rather than guessing.
- Never invent API signatures or fields: everything shown comes from a capture.
- Keep `history.json` and `snapshots/` append-only; don't rewrite or drop past snapshots.
- Missing or restricted values are never zero, false or "removed" in comparisons.
- Changing the profile shape means a new schema version, with `profile.schema.json`,
  `PROFILE_FORMAT.md` and the tests updated together.
- Every behaviour change gets a test.
- Git refuses this checkout (dubious ownership: it was created by another Windows user).
  Don't change global git config to fix it; tell the user.
- Commits and pushes need the user's go-ahead.
