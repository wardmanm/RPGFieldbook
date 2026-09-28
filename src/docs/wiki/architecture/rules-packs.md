# Rules packs

No rules content is baked into the app. Species, classes, subclasses, spells, items, feats,
backgrounds, glossary terms and tables all arrive as JSON packs that the player imports at runtime.
Each pack is either a **system** a character can be created in (D&D 2024, Humblewood) or an
additive **supplement** (Xanathar's, Tasha's, Homebrew). Every loaded pack merges into one pool,
the global `rules`, which is cached across reloads (see [Storage](storage.md)) and consulted by
name. The pack format itself is [rules-schema](../../../../docs/rules-schema.md), so this page
covers what the app does with packs.

**Code:** `mergeRules()`, `srcLabel()`, `keyOf()`, `reindexRules()`, `recomputeDups()`,
`dispName()`, `ruleById()`, `resetRules()`, `importRulesFiles()`, `fetchAllRules()`,
`fetchRulesFrom()`, `missingRequirements()`, `requiresStatusHTML()`, `missingSummary()`,
`rulesDataHTML()` in `89-rules-merge.js`; `loadedRulesGroups()`, `rulesBucket()`,
`removeRulesGroup()`, `clearAllRules()`, `dataStatus()`, `dataStatusHTML()`, `refreshRulesUI()` in
`88-settings.js`; `systemOf()`, `racesForCharacter()` in `52-race.js`; `findRaceDef()`,
`findClassDef()`, `subclassesFor()` in `50-classrace.js`; `DATA_VERSIONS` and `cmpVer()` in
`30-version.js`; `bundle()` and `dataVersions()` in `scripts/bundle-rules.js`; `dataChangedSince()`
in `scripts/release.js` · **Data:** `data/<dir>/*.json` → `dist/<dir>_full.json` · **Tests:**
`rules-data.js` (bundle ≡ individual files, the three data states, every shipped pack agrees with
`DATA_VERSIONS`, missing requirements), `tables.js`, `docs.js` (`DATA_VERSIONS` is flat JSON,
X.Y.Z, and every system maps to a data dir) · **See also:** [Converter](../data/converter.md),
[Supplements](../data/supplements.md), [Homebrew](../data/homebrew.md),
[Settings & updates](../features/settings-and-updates.md), [Rich text](rich-text.md)

## How it works

| Pack | `system` stamp | Kind | `excludeSystems` | `requires` |
|---|---|---|---|---|
| `5e2024_full.json` | `XPHB` | system: D&D 2024 core | — | — |
| `humblewood_full.json` | `Humblewood` | system | — | — |
| `xanathars_full.json` | `XGE` | supplement | `["humblewood"]` | — |
| `tashas_full.json` | `TCE` | supplement | `["humblewood"]` | — |
| `homebrew_full.json` | `Homebrew` | supplement, hand-authored | — | yes |

**Systems and supplements.** A character's `system` is `"dnd"` or `"humblewood"`. Nothing else is
possible, because `migrate()` coerces it. A pack's `system` stamp is a source label (`XPHB`, `XGE`, …)
and a different thing. Humblewood is a 5e *setting*: its class, subclasses and spells supplement the
D&D core rather than replacing it. **Only species are exclusive.** `racesForCharacter()` filters the
ancestry picker through `systemOf()`, which reads `xphb`/`phb`/`dnd`/`d&d` as D&D, `humblewood` as
Humblewood, and anything else as "" (offered to both), and through a pack's `excludeSystems`, which
beats that name-based guess. Classes, subclasses, spells, feats, items and backgrounds are offered
to every character.

**Getting packs in.** `importRulesFiles()` handles the file picker, reached from Settings, the home
screen, and the import links on the Rules tab. `fetchAllRules()` handles the player's own source
URLs from Settings → **Fetch all**. That is the only rules fetch the app makes; it runs on the button
and never at boot. Before fetching it calls `resetRules()`, then fetches each URL in order with
`cache:"no-store"`. Through `fetchRulesFrom()` it follows any `include` array relative to the URL
(so a manifest pulls in its files), and a `seen` set stops loops. On a failure it keeps what loaded
and says to import files instead if the app is offline or CORS-blocked.

**`mergeRules(obj, fileName)`:**

- The source label is `srcLabel()`: `obj.system`, else `obj.name`, else `"Rules"`. Every entry is
  stamped `_source`, plus `_file` (file imports), `_rulebook`, `_dataVersion` and
  `_excludeSystems` when the pack carries them.
- Each entry is keyed by source + `keyOf()` (a lower-cased name, or `term` for keywords, or
  `class|name` for subclasses). **The same source and name replaces the entry in place**, which is
  how re-importing a pack updates it. The same name from a *different* source is kept beside it,
  and `dispName()` shows it as "Name (SRC)" using `rules._dups`.
- Keywords are rebuilt from a fixed set of fields (`term`, `type`, `text`, `image`, `cond`) with a
  fresh `id`. Every other entry is a shallow copy of what the pack had.
- `requires` is stored per source in `rules.requires`.
- Then `reindexRules()` gives every entry a positional `_id` (`r0`, `r1`, …), and
  `recomputeDups()` rebuilds the duplicate sets.

After the last file, the importer saves the cache, calls `refreshRulesUI()` and
`renderRulesData()`, and writes one status line, with `missingSummary()` appended when something is
missing. **Boot never merges.** It restores the already-merged pool from the cache and rebuilds
only `_id` and `_dups`.

**Lookups are by name.** `ruleById(kind, idOrName)` matches an `_id` or a `keyOf()` name.
`findRaceDef()` and `findClassDef()` are thin wrappers over it. A character stores names, and the
class, species and background descriptions re-resolve live by name. `findTable()` is also a global
name lookup, and `[Table: …]` anchors carry no pack (see [Rich text](rich-text.md)).

**Subclasses.** `subclassesFor(d)` returns the class's own subclasses plus every standalone entry in
`rules.subclasses` whose `class` matches. The key is the subclass name, because that is what
`character.classes[].subclass` stores. When a *different* pack brings a same-named subclass, it is
added beside the existing one as "Gloom Stalker (XGE)", and the existing key is left alone.

**The loaded-data list** (Settings and the home screen). `loadedRulesGroups()` groups entries by
`_file` (file imports) or `_source` (fetched), and `rulesBucket()` files each group under Rulebook,
its single category, or Mixed. Each row carries the pack's version badge (`dataStatusHTML()`), its
missing-content chip (`requiresStatusHTML()`) and a delete button (`removeRulesGroup()`, which also
drops a source's `requires` once none of its entries remain). `clearAllRules()` confirms with
counts and says plainly that characters are not affected: `resetRules()` touches only the pool.

**Missing dependencies.** `missingRequirements(src)` is a pure function of `rules`, called at
render time, and it combines two detectors:

- **Structural:** a subclass whose `class` is not loaded. This needs no authoring at all, so it
  catches homebrew nobody annotated. Humblewood's, Xanathar's and Tasha's subclasses all hang off
  the D&D 2024 classes.
- **Declared:** each `requires` group, checked per `RULE_CATS` category. Names match
  case-insensitively and **pack-blind**, so `pack` and `file` only serve the message, and a
  category the app does not know is ignored.

The result is a red `.chip.bad` reading "**! n missing**". Its `title=` tooltip is grouped by
category and names what is absent, plus the file to import where one was declared. Nothing blocks
loading.

**Is my pack current?** `DATA_VERSIONS` in `30-version.js` records, for each pack `system`, the
release in which that system's data last changed. `scripts/release.js` bumps a system only when
`git diff` against the last `v*` tag, working tree included, says its `data/<dir>/` moved. With no
tag, it bumps every system. `bundle-rules.js` reads `DATA_VERSIONS` and never duplicates it,
stamping each pack's `dataVersion`. It fails the build for a system with no entry. `mergeRules()`
copies that value onto every entry as `_dataVersion`, so it survives the cache. `dataStatus()`
compares with `cmpVer()`: an **older** pack is `stale` (an amber "update available" chip), an equal
or newer one is `current` (a quiet version tag), and a pack with no stamp, or a system with no entry,
is `unknown` (nothing shown). `release.yml` runs the same per-directory diff to name, in the release
notes, only the packs worth re-downloading.

**Bundling.** `bundle-rules.js` rolls each `data/<dir>/` into one `dist/<dir>_full.json` stamped
`rulebook:true`, `version:1` (the *schema* version) and `dataVersion`. It mirrors `mergeRules()`
(keyed by name, last one wins, replaced in place), because importing the bundle has to equal
importing the files one by one, and a test asserts that for every system. `system`,
`excludeSystems` and `requires` are folder-level: every file in a folder must agree, or the build
fails. Duplicates are reported on every build rather than silently deduped (`Net` is in both item
files).

## Rules that must hold

- **Characters reference rules by name, never by `_id`.** `_id` is reassigned on every boot and
  every import.
- **Only the species picker is system-filtered.** `findRaceDef()` stays unfiltered: a character
  with a cross-system ancestry (an imported sheet, a switched system) must keep resolving it, or
  its traits vanish silently. Unknown sources show in both systems, because someone's own content
  is never hidden.
- **A same-named subclass from another pack never takes the existing key,** or loading a supplement
  would rewrite subclasses that characters had already chosen.
- **The bundle equals the individual files.** Any change to `mergeRules()` keying needs the same
  change in `bundle-rules.js`, and `RULE_CATS` (`88-settings.js`), `mergeRules()`'s category map
  and the bundler's `CATS` must stay in step.
- **Missing-dependency verdicts are computed, not stored.** Only the declaration persists, since
  boot never re-runs `mergeRules()`.
- **`rules` is persisted whole, so it stays plain JSON** (see [Storage](storage.md)).
- **Unknown is not stale.** A false alarm on someone's own content is worse than silence, and a pack
  *newer* than the build is simply ahead.
- **`DATA_VERSIONS` is owned by `release.js`.** Never hand-edit it. It must stay a flat JSON object:
  both scripts find it with `\{[^}]*\}` and `JSON.parse` it. Every key needs a `SYSTEM_DIRS` entry
  in `release.js` and a line in `release.yml`'s diff.
- **`data/5e2024/` must reproduce byte for byte** from the converter. Otherwise XPHB's version bumps
  and every player is told to re-download a pack that did not change. See
  [Converter](../data/converter.md).

## Traps

- **Unreachable subclasses that looked loaded.** `subclassesFor()` returns nothing when the parent
  class is missing, so a supplement loaded alone merged its subclasses and Settings counted them,
  while the picker said *"This class has no subclasses in the loaded rules"*, which was false. The
  structural detector exists for this.
- **The reprint collision.** The 2024 PHB reprinted seven Xanathar's/Tasha's subclasses (Gloom
  Stalker, Fey Wanderer, Soulknife, Psi Warrior, Oath of Glory, Path of the Zealot, College of
  Glamour). Keyed by name alone, loading a supplement would have silently swapped every existing
  2024 character's subclass for the 2014 one.
- **The bundle has to learn every folder-level property.** It is built from a fixed key list, so
  when `excludeSystems` arrived, the per-category files filtered correctly and the bundle players
  actually import did not.
- **Colour cannot carry the chip.** In the Classic skin `--accent` and `--brick` are the same value,
  so the red "missing" chip and the amber "update available" chip look identical there. Hence the
  `!` glyph. `CAT_ONE` spells out singulars, because stripping a trailing `s` with `.replace(/s$/,"")`
  produced "classe".
- **`fetchAllRules()` never refreshed the loaded-data list**, so its chips stayed stale after a URL
  fetch. It now calls `renderRulesData()`.
- **Clear all** once had no confirmation and did not refresh the list.
- **`requires` cannot name a subclass.** `ruleById()` matches `keyOf()`, which is `class|name` for
  subclasses, so a plain subclass name in `requires` always reports missing. No shipped pack
  declares one. Found by reading the code.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Which categories are filtered by system | Species only, in the picker only | Filtering classes and spells: Humblewood's supplement the D&D core. Filtering `findRaceDef()`: a cross-system ancestry's traits would vanish (L625) |
| How a supplement keeps its species away from Humblewood | `excludeSystems`, which says who the pack is *not* for | Extending `systemOf()`: the app cannot place a supplement's `system`, so the pack declares it instead (L1816) |
| A same-named subclass from another pack | Offer it beside the existing one, tagged with its pack | Replacing by name: silently changes subclasses characters already chose (L1816) |
| Where missing-dependency state lives | The declaration in `rules.requires`; the verdict at render | Computing it during merge: `mergeRules()` never runs at boot, so it would be lost on reload (L1883) |
| How references are found | Structural (`subclasses[].class`) plus declared `requires` | Scanning prose for names: it would invent as many references as it found (L1883) |
| How precise the data version is | Per system | One global flag: tells a D&D-only player to re-import Humblewood (L1323) |
| A pack with no `dataVersion` | `unknown`, no badge | Flagging it stale: a false alarm on someone's own content (L1323) |
| Duplicates inside a folder | Mirror `mergeRules()`, and report them | Silent dedupe: `Net` is a real duplicate that someone should see (L625) |
| Where `overlay.json` and `class-resources.json` live | The `data/` root | Inside a system folder: the bundler globs those, and they are converter inputs, not packs (L625) |
| The Artificer and Mystic in the core pack | Leave them, labelled `XPHB` | Dropping them: moves `data/5e2024/`, bumps XPHB for everyone, and strands Artificer players without Tasha's (L1816) |

## Open

- **Fetch all wipes file-imported packs.** `fetchAllRules()` calls `resetRules()` first, with no
  confirmation. A player who imported packs from files and also has one source URL loses the file
  imports when they press it.
- `requires` entries under `subclasses` can never match (see Traps).
- The Artificer and Mystic are 2014/UA content labelled `XPHB` in the core pack.
- The header comment on `scripts/release.js`'s data-version block says it leaves versions alone
  when tags are unavailable. The code bumps every system in that case.
- `rules.features` is a manual picker library, so invocations and pact boons shipped as features
  cannot attach themselves to a character.

See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-10 — Data is reorganised by system and bundled into one pack per system. The `rulebook` flag arrives, species are filtered by system, and Clear all now confirms. → ledger L625
- 2026-08-10 — `DATA_VERSIONS` and per-pack `dataVersion` answer "do I need the new data too?". → ledger L1323
- 2026-08-14 — Xanathar's and Tasha's arrive as supplements, with `excludeSystems`, reprinted subclasses offered side by side, and table names suffixed. → ledger L1816
- 2026-08-14 — The Homebrew pack arrives, with structural and declared missing-dependency reporting. → ledger L1883
- 2026-08-14 — The merged pool's cache moves to IndexedDB. → ledger L1950
