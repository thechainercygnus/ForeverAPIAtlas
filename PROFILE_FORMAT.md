# Character profiles and history

The hosted atlas is file-based and private. It stores no database credentials and has no live game connection. Importing a file updates local artifacts; publishing updates the hosted copy.

## Import

From the atlas checkout, with ForeverAPIExplorer beside it, refresh the current catalog/evidence and append the character snapshot to history:

```powershell
python scripts/import_dump.py ../ForeverAPIExplorer/data/ForeverAPIExplorer-20261116-202559.lua dist/catalog.json
```

To import all existing dumps into history:

```powershell
python scripts/build_profiles.py ../ForeverAPIExplorer/data dist
```

Environment-only dumps do not create profiles. A character snapshot needs a public GUID. Existing profiles and evidence files are retained when a newer capture arrives. Copying the same capture under another filename does not duplicate it. Keep the generated `dist/history.json` and `dist/snapshots/` when updating or moving the site.

## Contract

`dist/profile.schema.json` is the JSON Schema for normalized version 1. Each profile contains the character GUID, capture time, client build/locale, addon version, source filename, and these sections:

| Section | Stable keys / content |
| --- | --- |
| identity | Name, realm, level, class, race, faction, sex, GUID |
| stats | Current/maximum health and power, XP, rested XP, money in copper, armor, attack power, five attributes |
| equipment | Inventory slot IDs 1–19; item ID/link/quality and durability |
| professions | Learned profession skill-line IDs from GetProfessions indices; name, rank and maximum |
| spells | Spell IDs, including separate ranks; name, sub-name, passive flag and icon |
| quests | Non-header quest IDs; title, level, difficulty level and frequency |
| reputation | Non-header faction IDs; name, standing, reaction and thresholds |

General profession metadata is deliberately excluded from learned-profession membership. Modern structured collections have mappings; unmapped/legacy collection results remain available in raw evidence. Enumeration counts describe visible rows or spellbook lines, not a complete game-wide inventory. Profession count is derived from distinct non-nil returned indices. Snapshot boundaries, UI state, caches and collapsed headers can affect results.

Every field is an observation with `state` and an `evidence` array. States are `value`, `empty`, `restricted`, `unavailable`, `error`, `notCaptured`, and `partial`. Only `value` contains a scalar `value`; zero and false are retained. `empty` means the getter returned nil or no value at that position. It does not prove an equipment slot was unequipped. An absent structured table field is `notCaptured`, or `partial` if the parent was truncated.

Evidence references contain a zero-based query index and return index, the function path, query capture time, and optionally a table field name. The profile's `evidenceFile` points to the unchanged typed character capture (with source filename attached). The site's Evidence buttons open the actual record for the selected historical snapshot.

Snapshot IDs combine a hash of GUID, capture time and a content digest; filenames contain no raw GUID. The GUID still appears inside the private JSON data. Hashing excludes the copied source filename to deduplicate identical captures. Multiple captures in the same second remain distinct if their contents differ. Source dumps stay outside the site checkout.

## Comparison semantics

`dist/compare.mjs` provides `compareProfiles(before, after)` and runs in the browser or Node. It rejects different characters, unsupported versions and reversed time order. It produces one row per normalized field:

- `changed`: both sides have explicit public values/empty results, and the observation changed.
- `unchanged`: both sides have the same public observation.
- `newlyObserved`: only the later side has a usable observation. This is coverage, not proof of newly learning a spell or profession.
- `notComparable`: missing, partial, restricted, unavailable, errored, or otherwise incompatible observations.

Different client builds or locales suppress change claims. Missing collection entries are never classified as confirmed removals, completed quests, or unlearned spells. Empty collections and unobserved collections can both have no entries; the enumeration observations and raw evidence distinguish whether a count was actually captured. The profile selector and comparison selectors are independent, so you can inspect one snapshot while comparing another pair.

Download a comparison from the website or generate the same JSON locally with `node scripts/compare_profiles.mjs before.json after.json comparison.json`. Each comparison row contains both observations with their evidence references. Comparison counts describe fields, not unique gameplay actions. Missing client build or locale also suppresses change claims.

## Validation

```powershell
python scripts/test_import_dump.py
python scripts/test_profiles.py
node --test scripts/test_compare.mjs
python ../ForeverAPIExplorer/tests/test_extended_capture.py
```

Profile tests use `jsonschema` installed in the sibling ForeverAPIExplorer checkout under `.test-deps`. Lua regression tests use `lupa` there. Fixtures include the actual 0.2.0 and 0.3.0 captures; controlled comparisons cover changed values, missing records, restricted values, zero/false, explicit empty results, character identity, chronology and build differences. Tests do not create invented gameplay records in hosted history.

## Multi-character captures

History now retains five snapshots across Ett (Human Mage), Lilalx (Dwarf Priest), and Brumboldt (Gnome Warrior). Selecting a profile snapshot also refreshes Character evidence and its download link to that exact capture. Characters with one snapshot have a self-comparison until a second capture is imported. Warrior power is preserved as RAGE; no mana-specific interpretation is applied. All three new exports report zero errors and GetNumSkillLines unavailable.
