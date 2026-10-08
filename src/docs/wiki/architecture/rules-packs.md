# Rules packs

No rules content is baked into the app. Species, classes, subclasses, spells, items, feats,
backgrounds, glossary terms and tables all arrive as JSON packs that the player imports at runtime.
Each pack is either a **system** a character can be created in (D&D 2024, SRD 5.2, Humblewood) or
an additive **supplement** (Xanathar's, Tasha's, Homebrew). Every loaded pack merges into one pool,
the global `rules`, which is cached across reloads (see [Storage](storage.md)) and consulted by
name. The pack format itself is [rules-schema](../../../../docs/rules-schema.md), so this page
covers what the app does with packs.

**Code:** `mergeRules()`, `srcLabel()`, `keyOf()`, `ruleName()`, `reindexRules()`, `tidyRules()`, `tidyRule()`,
`skippedSummary()`, `recomputeDups()`,
`dispName()`, `ruleById()`, `resetRules()`, `importRulesFiles()`, `importPack()`, `dropOwnedPackMeta()`,
`creditOf()`, `fetchAllRules()`,
`fetchRulesFrom()`, `applyFetchedSource()`, `poolFromExport()`, `missingRequirements()`, `requiresStatusHTML()`,
`missingSummary()`, `rulesDataHTML()`, `renderRulesData()` in `89-rules-merge.js`; `glossRepair()` in `00-constants.js`;
`loadedRulesGroups()`, `rulesBucket()`, `removeRulesGroup()`, `prunePackMeta()`, `clearAllRules()`,
`dataStatus()`, `dataStatusHTML()`, `refreshRulesUI()`, `rulesBadge()` in `88-settings.js`; `systemOf()`, `racesForCharacter()` in `52-race.js`; `findRaceDef()`,
`findClassDef()`, `subclassesFor()` in `50-classrace.js`; `DATA_VERSIONS` and `cmpDataVer()` in
`30-version.js`; `bundle()` and `registry()` in `scripts/bundle-rules.js`; `pack_digest()` and
`changed_packs()` in `tools/data-kit/fbdata.py` · **Data:** `data/packs.json`, `data/<dir>/*.json` →
`dist/<file>` · **Tests:**
`rules-data.js` (bundle ≡ individual files, the data states, every bundle agrees with
`data/packs.json` on its system, title, `dataVersion`, licence and credit, missing requirements,
Fetch all keeping what is loaded, a settings file's pool
rebuilt and round-tripped, entries with no name skipped and reported), `data-archive.js` (importing
bytes and zips, `importPack()` replacing, credits, the `update` state), `sheet.js` (a wholesale pool
full of junk, tidied and rendered), `tables.js`, `docs.js` (`data/packs.json` parses, every pack's
`dir` exists, and every `DATA_VERSIONS` system has a pack at or after it) · **See also:**
[Data archive](data-archive.md), [Converter](../data/converter.md),
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
| `srd52_full.json` | `SRD 5.2` | system: the free D&D rules ([SRD 5.2](../data/srd.md)) | `["humblewood"]` | — |

**Systems and supplements.** A character's `system` is `"dnd"` or `"humblewood"`. Nothing else is
possible, because `migrate()` coerces it. A pack's `system` stamp is a source label (`XPHB`, `XGE`, …)
and a different thing. Humblewood is a 5e *setting*: its class, subclasses and spells supplement the
D&D core rather than replacing it. **Only species are exclusive.** `racesForCharacter()` filters the
ancestry picker through `systemOf()`, which reads `xphb`/`phb`/`dnd`/`d&d` as D&D, a label starting
`srd` ("SRD 5.2") as D&D too, `humblewood` as Humblewood, and anything else as "" (offered to both),
and through a pack's `excludeSystems`, which beats that name-based guess. The SRD pack carries both:
`systemOf()` places it, and its `excludeSystems: ["humblewood"]` says the same to an older app that
doesn't know the label. Classes, subclasses, spells, feats, items and backgrounds are offered
to every character.

**Getting packs in.** `importRulesFiles()` handles the file picker, reached from Settings, the home
screen, and the import links on the Rules tab. It reads each chosen file as bytes and hands them to
`importRulesPayloads()`: a zip, known by its first bytes, is opened and each pack inside is imported
under its own file name; anything else is one JSON pack (see [Data archive](data-archive.md)). Every
pack goes through `importPack()`, which **replaces what that file name and system loaded before**:
entries the new copy no longer has are removed, not left beside it. Packs with the same file name
and a different system are untouched. `fetchAllRules()` handles the player's own source
URLs from Settings → **Fetch all**. That is the only rules fetch the app makes; it runs on the button
and never at boot. (The newer-data check at boot reads a registry of versions, never rules; see
[Settings & updates](../features/settings-and-updates.md).) **Fetching never loses what is loaded:**

1. Each source URL is fetched in order with `cache:"no-store"`. `fetchRulesFrom()` follows any
   `include` array relative to the URL (so a manifest pulls in its files) and **collects** the packs
   without merging them. A per-source `seen` set stops loops, and a per-run memo means a URL listed
   twice, or included by two sources, is still requested once. Every error names its file
   (`b.json: HTTP 404`, `not a rules file` for a `null` or array body).
2. A source counts only if all of it arrived, with at least one rule in it. One failed include
   fails the whole source, and so does an answer with no rules in it (`{}`, an error object), which
   would otherwise read as "this source now serves nothing" and wipe what it loaded.
3. Nothing arrived: the pool and the cache are left exactly as they were, and the status line says
   "…so nothing changed", names each failed file, and suggests importing files if offline or
   CORS-blocked.
4. Otherwise each source that arrived goes through `applyFetchedSource()`, in list order: merge its
   packs stamped with its `_url`, then drop that source's old entries the merge did not replace. An
   entry it still serves is replaced in place, so a re-fetch never doubles anything. One it stopped
   serving goes. Entries from files, and from sources that failed, are not touched. Its `requires`
   declaration follows its fresh copy, unless a file import shares the label.
5. The cache is saved once. A refused save is written into the status line, on top of the red line
   above the list (see [Storage](storage.md)). So are the entries the sources' packs had with no name
   (`skippedSummary()`), as for a file import.

A **settings file** (Settings → Import settings) is the third way in. It carries a whole pool, the
one Export settings saved, and replaces the loaded pool only if the player says so (see
[Settings & updates](../features/settings-and-updates.md)). `poolFromExport()` rebuilds that pool
through `mergeRules()` on a scratch pool, never assigning it as it came. Each run of consecutive
entries that share their provenance is merged as one pack. The entry's stamps go back in as the
pack fields `mergeRules()` reads: `_source` as `system`, `_rulebook`, `_dataVersion`,
`_excludeSystems`, the pool's `requires` for that label, and `_file` or `_url` as the file name or
URL. So every group, version badge, `requires` declaration and `_url` comes back as it was, and so
does the order within each category, which name lookups take the first match from. Keywords get
fresh ids, repeats collapse, and non-arrays and entries without a name are dropped, exactly as for
a file. Only a non-object is filtered before the merge, so whatever `mergeRules()` learns to read,
a settings file gets too. The live pool is swapped out for that synchronous call alone and put back
in a `finally`.

**`mergeRules(obj, fileName)`:**

- The source label is `srcLabel()`: `obj.system`, else `obj.name`, else `"Rules"`. Every entry is
  stamped `_source`, plus `_rulebook`, `_dataVersion` and `_excludeSystems` when the pack carries
  them. Where it came from is `_file` (a file import, `mergeRules(obj, fileName)`) or `_url` (a
  fetch, `mergeRules(obj, null, url)`, the source URL from Settings rather than an include under
  it). Any `_file`/`_url` the pack itself carried is dropped first: provenance is the merge's to
  record, so a file can never be deleted by a later fetch.
- **An entry nothing could reach is skipped, and counted.** `ruleName()` is an entry's name (a
  keyword's `term`) as text: a non-blank string, or a number, which becomes text. An entry that is
  not an object or has none is skipped, and `mergeRules()` returns the count per category.
- Each entry is keyed by source + `keyOf()` (a lower-cased name, or `term` for keywords, or
  `class|name` for subclasses). **The same source and name replaces the entry in place**; on a
  re-import, `importPack()` then drops what the new copy did not replace. The same name from a
  *different* source is kept beside it, and `dispName()` shows it as "Name (SRC)" using
  `rules._dups`.
- Keywords are rebuilt from a fixed set of fields (`term`, `type`, `text`, `image`, `cond`) with a
  fresh `id`, after `glossRepair()`: a keyword written `{name, description}`, the way every other
  category is, reads as its term and text. Every other entry is a shallow copy of what the pack had.
- `requires` is stored per source in `rules.requires`, and a pack's `license` and `attribution` in
  `rules.credits` (`creditOf()`: a licence over 64 characters is dropped, an attribution cut to
  2,000). Both only ever get set here; `importPack()` (through `dropOwnedPackMeta()`),
  `applyFetchedSource()` and `prunePackMeta()` remove a label's once nothing else carries it.
- Then `reindexRules()` gives every entry a positional `_id` (`r0`, `r1`, …), and
  `recomputeDups()` rebuilds the duplicate sets.

The importer writes "Reading N files…" to both status lines, Settings' and the home screen's, before
any work. After the last file it saves the cache, calls `refreshRulesUI()` and `renderRulesData()`,
and writes one line to both: each zip with its pack count and data version, each file that failed
and why (`importSummary()`), the counts, then `missingSummary()` when something is missing and
`skippedSummary()` when entries were skipped ("Skipped 2 glossary entries with no term."), in red
for any of those. A cache save that fails is added to the same line once it settles.
`renderRulesData()` also refreshes the Settings "Rules data" header chip through
`rulesBadge()`, because every path that changes the pool calls it. **Boot never merges.** It restores the already-merged pool from the cache and rebuilds
only `_id` and `_dups`.

**The pool is made safe on every change.** `reindexRules()` runs `tidyRules()` before it numbers
anything, and every path that changes the pool ends in `reindexRules()`: a merge, a fetch, a
removal, Settings → Import (which assigns `rules` wholesale, never through `mergeRules()`), and both
cache restores. A category that is not a list becomes an empty one; `tidyRule()` drops an entry
with no `ruleName()`, turns a numeric name into text, and gives a keyword the glossary aliases and an
id if it has none. It returns what it dropped per category, for a caller to report; none does yet,
so a settings file's unusable entries go without a message.

**Lookups are by name.** `ruleById(kind, idOrName)` matches an `_id` or a `keyOf()` name.
`findRaceDef()` and `findClassDef()` are thin wrappers over it. A character stores names, and the
class, species and background descriptions re-resolve live by name. `findTable()` is also a global
name lookup, first match in load order, and `[Table: …]` anchors carry no pack (see
[Rich text](rich-text.md)). So two packs may share a table name only when that is harmless:
**identical twins**, or **the SRD 5.2 and 2024 packs' copies of one table** (R5). The SRD pack
reprints 68 of the 2024 pack's tables, 59 word for word and 9 in the SRD's own wording ("GM" for
"DM", renamed spells, three corrections), so whichever loads first is the same table either way. The
registry, and so the archive, loads the 2024 pack first. `rules-data.js` pins those nine by name, so
a new difference (from a 5e-tools update, say) fails until it is added on purpose. Any other
same-named pair fails too, and the converter suffixes a supplement's colliding name (see
[Supplements](../data/supplements.md)).

**Subclasses.** `subclassesFor(d)` returns the class's own subclasses plus every standalone entry in
`rules.subclasses` whose `class` matches. The key is the subclass name, because that is what
`character.classes[].subclass` stores. When a *different* pack brings a same-named subclass, it is
added beside the existing one as "Gloom Stalker (XGE)", and the existing key is left alone.

**The loaded-data list** (Settings and the home screen). `loadedRulesGroups()` groups entries by
`_file` (file imports) or `_source` (fetched), and `rulesBucket()` files each group under Rulebook,
its single category, or Mixed. Each row carries the pack's version badge (`dataStatusHTML()`), its
missing-content chip (`requiresStatusHTML()`) and a delete button (`removeRulesGroup()`). After a
removal, `prunePackMeta()` drops a source's `requires` and credits once none of its entries remain;
the fetch uses it too. Fetched entries group by label, whatever URL they came from. `clearAllRules()` confirms with
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

**Is my pack current?** Each pack's version lives in the registry, `data/packs.json`, beside a
digest of its content (see [Data archive](data-archive.md)). A release, app or data, gives a new
version only to the packs whose digest changed; `bundle-rules.js` stamps each bundle's `dataVersion`
from the registry, and `mergeRules()` copies it onto every entry as `_dataVersion`, so it survives
the cache. `DATA_VERSIONS` in `30-version.js` is a snapshot of the registry taken at each app
release: the versions this build shipped with. `dataStatus()` compares with `cmpDataVer()`, which
reads `X.Y.Z` and `X.Y.Z-N`, and gives one of four states:

- **unknown** — no stamp, a stamp `cmpDataVer()` can't read, or nothing to compare it with: no
  `DATA_VERSIONS` entry and no data release's copy of the pack. Nothing is shown.
- **stale** — older than `DATA_VERSIONS`: the amber "update available" chip.
- **update** — not stale, but a data release has a newer copy of this file (`dataUpdateFor()`): a
  muted "v*A* · v*B* out" (see [Settings & updates](../features/settings-and-updates.md)).
- **current** — otherwise: a quiet version tag.

The release notes name the packs whose version is that release's, from the registry
(`scripts/data-release-notes.js`).

**Bundling.** `bundle-rules.js` rolls each registered `data/<dir>/` into one `dist/<file>` stamped
`rulebook:true`, `version:1` (the *schema* version), and the registry's `title` as `name`, `version`
as `dataVersion`, and `license` and `attribution` when it has them. The folder's files must declare
the registry's `system`, or the build fails. It mirrors `mergeRules()`
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
- **Every pool entry is an object with a name** (keywords: a term) that is text, whatever path
  loaded it (`tidyRules()` in `reindexRules()`), so a reader of the pool may treat `name` (`term`)
  as a non-blank string. A new path that changes the pool must end in `reindexRules()`.
- **An entry a pack can't use is said on the status line,** never dropped in silence.
- **The bundle equals the individual files.** Any change to `mergeRules()` keying needs the same
  change in `bundle-rules.js` (a keyword with no term keys by its `name` in both), and `RULE_CATS` (`88-settings.js`), `mergeRules()`'s category map
  and the bundler's `CATS` must stay in step.
- **Fetching never loses what is loaded.** A source replaces only the entries stamped with its own
  `_url`, and only once all of it has arrived. A run where nothing arrives writes neither the pool
  nor the cache. Never reset the pool ahead of a network call.
- **Every load goes through `mergeRules()`.** Nothing assigns `rules` a pool the app did not build,
  a settings file's included (`poolFromExport()`). Boot is the exception, and it restores only the
  app's own cache.
- **Missing-dependency verdicts are computed, not stored.** Only the declaration persists, since
  boot never re-runs `mergeRules()`.
- **`rules` is persisted whole, so it stays plain JSON** (see [Storage](storage.md)).
- **Unknown is not stale.** A false alarm on someone's own content is worse than silence, and a pack
  *newer* than the build is simply ahead.
- **`DATA_VERSIONS` is a snapshot written by `release.js` from `data/packs.json`.** Never hand-edit
  it, nor the registry's versions, digests or `release`. It must stay a flat JSON object: `release.js`
  and the `docs` suite find it with `\{[^}]*\}` and `JSON.parse` it.
- **Re-importing replaces by file name and system,** never by file name alone.
- **`data/5e2024/` and `data/srd52/` must reproduce byte for byte** from the converter. Any value
  that moves changes that pack's digest, so the next release bumps it and every player is told to
  re-download a pack that did not change. See [Converter](../data/converter.md).
- **A table name is shared only by identical twins or by one of the nine pinned SRD 5.2/2024 pairs.**
  `findTable()` takes the first match and an anchor names no pack, so any other pair would open one
  book's table from the other's prose. `rules-data.js` enforces it across every pack folder.

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
- **Fetch all emptied the pool offline** (#65). It called `resetRules()` before fetching, so every
  file-imported pack went the moment the button was pressed, and its `catch` then cached the empty
  pool for the next launch. The status line said "Kept what loaded" directly above "No rules data
  loaded", and the Settings chip still counted 2151 entries, because nothing redrew it after
  `openSettings()`.
- **A settings file's pool went in raw** (#70). Import settings ran `rules=p.rules`: no question, so
  packs loaded since the export were lost, and no validation, so a keyword with `name` for `term`
  broke `highlight()` on every render and a category that was not an array broke the next
  re-index. → L4134
- **`fetchAllRules()` never refreshed the loaded-data list**, so its chips stayed stale after a URL
  fetch. It now calls `renderRulesData()`.
- **Clear all** once had no confirmation and did not refresh the list.
- **A settings file's pool never went through `mergeRules()`** (#71), so a keyword with no term,
  a `null` in any category or a category that was not a list reached the renderers as it was: the
  glossary pass threw, and so did `reindexRules()` itself (`x._id=` on a `null`). A keyword whose
  term was a number, or a spell whose name was, passed `mergeRules()` too, since `keyOf()` stringifies.
  Hence the tidy on every change rather than in one import handler.
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
| What Fetch all does to what is loaded | Each source that arrives whole replaces only what it loaded last time (`_url`); nothing else changes | Reset first (the old way): discarded file imports, and cached an empty pool when offline. Confirming before the reset: still loses everything when the fetch fails. Replacing by label: a file import sharing the label would go (L3797) |
| How a settings file's pool is loaded | Rebuilt through `mergeRules()`, one run of same-provenance entries at a time (`poolFromExport()`) | Assigning it as it came: nothing validated it (#70). Merging it as one pack: every entry would be relabelled with one source and file, losing groups, versions and `_url`. Grouping by provenance rather than runs: reorders categories, and name lookups take the first match (L4134) |
| An entry a pack has with no name | Skip it, count it, and say so on the status line | Dropping it silently (the old way): the author never learns why it is missing. A chip on its loaded-data row, as missing dependencies get: skipped entries are not in the pool to compute from, so it would need a stored count per source with its own pruning (L4206) |
| Where a wholesale pool is made safe | `tidyRules()`, run by `reindexRules()` | In the Settings import handler: misses both cache restores. In every reader: hundreds of sites, and the next one written would not know (L4206) |
| A keyword written `{name, description}` | Read as its term and text | Skipping it: every other category is written that way, and it is plainly a term (L4206) |
| How the SRD pack's species reach D&D characters (#84, R6) | `systemOf()` reads a label starting `srd` as D&D, and the pack also carries `excludeSystems: ["humblewood"]` | `excludeSystems` alone: it says only who the pack is not for, and SRD 5.2 is a D&D system whose species belong to D&D characters (spec R6). `systemOf()` alone: an older app, which doesn't know the label, would offer SRD species to Humblewood characters (L5148) |
| The Artificer and Mystic in the core pack | Leave them, labelled `XPHB` | Dropping them: moves `data/5e2024/`, bumps XPHB for everyone, and strands Artificer players without Tasha's (L1816) |

## Open

- **Removing a source URL does not unload its packs.** They stay until removed under Loaded data.
  The reset used to clear them at the next Fetch all.
- **Entries fetched before `_url` existed** carry no mark of their URL. A re-fetch replaces them by
  name, but one the source has since dropped lingers until removed under Loaded data.
- A fetched pack with the same `system` and entry names as a file-imported one replaces those
  entries, as re-importing the file would. That is the source + name keying, not a fetch rule.
- `requires` entries under `subclasses` can never match (see Traps).
- The Artificer and Mystic are 2014/UA content labelled `XPHB` in the core pack.
- **A settings file's unusable entries are dropped without a message.** `reindexRules()` returns
  the counts, but the Settings import handler (being rewritten in #70) does not report them yet.
- `rules.features` is a manual picker library, so invocations and pact boons shipped as features
  cannot attach themselves to a character.

See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-10 — Data is reorganised by system and bundled into one pack per system. The `rulebook` flag arrives, species are filtered by system, and Clear all now confirms. → ledger L625
- 2026-08-10 — `DATA_VERSIONS` and per-pack `dataVersion` answer "do I need the new data too?". → ledger L1323
- 2026-08-14 — Xanathar's and Tasha's arrive as supplements, with `excludeSystems`, reprinted subclasses offered side by side, and table names suffixed. → ledger L1816
- 2026-08-14 — The Homebrew pack arrives, with structural and declared missing-dependency reporting. → ledger L1883
- 2026-08-14 — The merged pool's cache moves to IndexedDB. → ledger L1950
- 2026-09-28 — Fetch all no longer resets the pool: a source replaces only what it loaded (`_url`), a failed run changes nothing, and the Settings chip follows the pool. → ledger L3797, #65
- 2026-09-28 — A settings file's pool is rebuilt through `mergeRules()` (`poolFromExport()`), keeping provenance and order, and replaces the loaded one only when the player says so. → ledger L4134, #70
- 2026-09-28 — Entries with no name are skipped and reported at import and fetch; `reindexRules()` tidies the pool on every path; keywords written `{name, description}` load. → ledger L4206, #71
- 2026-10-07 — Imports take bytes and zips; a re-import replaces its pack (`importPack()`); versions come from `data/packs.json` and compare with `cmpDataVer()`, with an `update` state for a newer data release; pack credits are kept like `requires`. → ledger L5082, #83
- 2026-10-08 — SRD 5.2 joins as a system: `systemOf()` reads it as D&D, it loads after the 2024 pack, and an SRD/2024 table pair may share a name (R5, refined). → ledger L5148, #84
- 2026-10-08 — R5 pinned: the nine SRD/2024 tables that differ are listed by name; Carrying Capacity is now an identical twin (59), leaving three corrected ones. → ledger L5269, #84
