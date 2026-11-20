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
