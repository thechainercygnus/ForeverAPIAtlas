# Forever API Atlas

A buildless, snapshot-driven Lua environment reference. There is no live game connection and no inferred function signature database. Topic filters identify research leads by name only. This is deliberately not an OpenAPI document: the source describes Lua symbols, not HTTP operations.

## Refresh the catalog

From the atlas checkout, with ForeverAPIExplorer beside it:

```powershell
python scripts/import_dump.py ../ForeverAPIExplorer/data/ForeverAPIExplorer-20261116-202559.lua dist/catalog.json
```

The importer parses both SavedVariables globals without executing Lua, checks all four discovery record counts and the character status/return counts against captured statistics, and writes catalog.json plus character.json. Environment-only imports write null character evidence to prevent stale results. The character view shows observed arguments and typed returns, and distinguishes learned profession indices from broader skill-line metadata. It rejects unsupported syntax. Keep source dumps outside this site's checkout. The catalog contains all captured values, which can include addon or character state, and the repository is public, so everything in `dist/` is public too.

Preview from this directory with `python -m http.server 8080 --directory dist` and visit localhost:8080. No install or build step is required.

## Evidence and next steps

The first export used addon 0.1.0 and client 1.60.1, build 70938, interface 16001, enUS. It scanned 100,000 entries in five seconds, recording 35,278 function paths, 26,503 table paths, 35,968 primitive values and 2,251 other paths. It reported no traversal errors or unsupported keys, but reached its entry cap. Traversal uses `next`, so partial coverage is not a reliable alphabetical boundary. Tables are traversed once by identity; aliases may have no descendants. The depth limit is 15 and strings are capped at 512 bytes.

The environment includes UI objects and addon/library globals as well as game functions. No path provenance, parameters, returns, events, protection status or function behavior was captured. The capture timestamp comes from the game client, while the filename comes from the copy script; preserve them as distinct provenance.

For character extraction, add curated probes with explicit argument and return capture and review any callable snippet before execution. Separate discovery from extraction. Later, describe an HTTP ingestion/query service with OpenAPI and use Swagger UI for that actual service.

Validation: `python scripts/test_import_dump.py` from this directory. The hosted reference includes the 0.3.0 capture: 231 calls, 230 successful, two with restricted values, one unavailable, and zero errors. Discovery remains the original partial 0.1.0 snapshot; its capture time is independent of the newer character capture.

The Character profile view uses versioned normalized JSON and immutable history/evidence sidecars. Both existing character captures are retained. See [PROFILE_FORMAT.md](PROFILE_FORMAT.md) for import commands and comparison rules. `dist/` includes all retained history (character name, GUID and every snapshot), and it is public along with the rest of the repository.
