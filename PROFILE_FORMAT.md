# API coverage, profiles and history

The atlas is file-based and public: its repository includes everything in `dist/`. It stores no database credentials and has no live game connection. Importing a file updates local artifacts; publishing updates the hosted copy.

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

Snapshot IDs combine a hash of GUID, capture time and a content digest; filenames contain no raw GUID. The GUID still appears inside the JSON data. Hashing excludes the copied source filename to deduplicate identical captures. Multiple captures in the same second remain distinct if their contents differ. Source dumps stay outside the site checkout.

## Coverage view

The site's API coverage view reads each profile as coverage, not as a character sheet. `coverageOf(profile)` in `dist/compare.mjs` turns a profile into one row per field: a section field such as `stats.xp`, or a collection field pooled across its entries such as `equipment.*.itemID`. Each row has the calls that supplied it (from the evidence `functionPath`s), a count per state, and the individual observations with their evidence. Gameplay values stay in the evidence and are not the headline.

The atlas tracks what the API returns; the Character Planner tracks a character's progress. That split was decided in #18.

## Comparison semantics

`dist/compare.mjs` provides `compareProfiles(before, after)` and runs in the browser or Node. It compares the coverage of any two captures, including different addon versions, client builds and characters; only an unsupported schema version is rejected. Values are never compared: a level-up, more money or an emptied slot is gameplay, not coverage. Collection entries are pooled per field, so two characters compare by what the API returned, not by what each one holds.

`value` and `empty` both count as returned, and `unavailable` and `error` both count as failed. Each field gets one of:

- `becameRestricted`: After has restricted observations that Before didn't.
- `becameUnavailable`: After has unavailable or errored observations that Before didn't.
- `nowAvailable`: After returned where Before was only restricted, unavailable or errored, or Before's restriction or failure is gone.
- `newlyCaptured`: only After captured the field. This is coverage, not proof of newly learning a spell or profession.
- `notCapturedAfter`: only Before captured the field. Missing data is coverage too; it never means removed, completed or unlearned.
- `otherChange`: another state difference, such as a partial result.
- `unchanged`: the same states were observed, whatever the values.

The result also describes each side (capture, character, addon version, client build and locale) and says whether the character and the build are the same. A different build or locale means a change may come from the client rather than the addon.

Download a comparison from the website or generate the same JSON locally with `node scripts/compare_profiles.mjs before.json after.json comparison.json`. Each row has the field key, its assessment, and each side's state counts and calls. Counts describe fields, not gameplay actions.

## Validation

```powershell
python scripts/test_import_dump.py
python scripts/test_profiles.py
node --test scripts/test_compare.mjs scripts/test_items.mjs
python ../ForeverAPIExplorer/tests/test_extended_capture.py
```

Profile tests use `jsonschema` installed in the sibling ForeverAPIExplorer checkout under `.test-deps`. Lua regression tests use `lupa` there. Fixtures include the actual 0.2.0 and 0.3.0 captures; controlled comparisons cover value-only changes, restriction, failure and recovery, fields captured on one side only, partial results, pooling entries across characters, and build differences. Tests do not create invented gameplay records in hosted history.

## Multi-character captures

History now retains five snapshots across Ett (Human Mage), Lilalx (Dwarf Priest), and Brumboldt (Gnome Warrior). Selecting a profile snapshot also refreshes Character evidence and its download link to that exact capture. A character with one capture is compared with another character's latest capture by default. Warrior power is preserved as RAGE; no mana-specific interpretation is applied. All three new exports report zero errors and GetNumSkillLines unavailable.
