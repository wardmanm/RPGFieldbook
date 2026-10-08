# Homebrew

`data/homebrew/` is the fifth rules pack (`system: "Homebrew"`) and the only one with no script
behind it: third-party content written as JSON by hand. Today it holds one Warlock subclass, The
Predator, with its pact boon, six invocations and an expanded-spell table. It leans on a class and
spells that other packs ship, which made it the case that forced missing-dependency reporting into
the open, and it is still the working example of `requires`.

**Code:** `missingRequirements()`, `requiresStatusHTML()`, `missingSummary()`, `mergeRules()` in
`89-rules-merge.js`; `subclassesFor()` in `50-classrace.js`; `bundle()` in
`scripts/bundle-rules.js`; `pack_digest()` in `tools/data-kit/fbdata.py`; `rulesCreditsHTML()` in
`88-settings.js`; `DATA_VERSIONS` in `30-version.js` · **Data:** `data/homebrew/features.json`,
`subclasses.json`, `tables.json`; its entry in `data/packs.json` · **Tests:** `rules-data.js`,
`tables.js`, `data-archive.js` (its credit reaches Settings) · **See also:**
[Rules packs](../architecture/rules-packs.md), [Data archive](../architecture/data-archive.md),
[Supplements](supplements.md), [rules-schema](../../../../docs/rules-schema.md)

## How it works

**The files.** Three, each `system: "Homebrew"`, each with the same `_note` and the same `requires`:

| File | Holds |
|---|---|
| `features.json` | 7 library `features`: Pact of Tooth and Claw (`source: "Pact Boon"`) and six Eldritch Invocations |
| `subclasses.json` | The Predator, `class: "Warlock"`, traits at levels 1, 6, 10 and 14 |
| `tables.json` | Predator Expanded Spells, owned by the subclass and anchored from its level-1 trait |

The `_note` names the source (a D&D Wiki page) and its licence, CC-BY-SA 3.0, but it is not copied
into the bundle, so it never reached players. **The licence and credit that do** live in the pack's
entry in `data/packs.json`: `license: "CC-BY-SA-3.0"` and an `attribution` crediting The Predator to
D&D Wiki's contributors, with its page, the licence, and "Changed: converted to Fieldbook's rules
format." `bundle()` rolls the folder into `dist/homebrew_full.json` like any other pack and stamps
both on it, so they ship in the bundle, are listed in Settings → Credits & licences once the pack is
loaded, and appear in the archive's `NOTICE.md` (see [Data archive](../architecture/data-archive.md)).
Its version is the registry's (`1.5.0` today); adding the credit changed its digest, so the next
release moves it.

**Why by hand.** Homebrew arrives as PDFs, HTML and JSON, and each piece needs judgement: which
features are subclass traits and which are invocations, and what level each lands on. The files
follow the XGE/TCE convention, so invocations and the pact boon are standalone `features` (the
library a player picks from by hand), not level-up choices. A throwaway generator wrote the three
files once, only so their `requires` blocks are byte-identical; it is not kept.

**`requires`.** Declared per file, two groups: the D&D 2024 pack (`5e2024_full.json`) for the
Warlock class and 11 spells, and Xanathar's (`xanathars_full.json`) for Cause Fear and Primal
Savagery. The expanded spell list is prose and a table, so those 13 spells are invisible to any
structural check; declaring them is the only way the app can say what is missing. The schema is in
[rules-schema](../../../../docs/rules-schema.md) §1.

**With SRD 5.2 instead of the 2024 pack.** Every name in the D&D group (the Warlock and its 11
spells) is also in the [SRD 5.2](srd.md) pack, under the same name, and a declared name matches
whichever pack supplies it. So that group resolves with SRD 5.2 alone, and The Predator attaches to
the SRD Warlock; only the Xanathar's group still asks for `xanathars_full.json`. `rules-data.js`
asserts it against `data/srd52/`. The group's `pack` and `file` still name the 2024 pack; they are
shown only when something in the group is missing, and #85 repoints them when that pack goes
private.

**What the app does with it.** `mergeRules()` stores the declaration on `rules.requires`, keyed by
source, so it survives the rules cache. `missingRequirements()` is a pure function of `rules`,
called at render time: a structural check (any `subclasses[].class` with no loaded class) plus the
declared groups, matched case-insensitively and pack-blind. `requiresStatusHTML()` shows a red
`! n missing` chip on the pack in Settings, with a tooltip naming what to import, and
`missingSummary()` adds a line to the status after an import or a fetch. Loading never fails. Full
mechanism: [Rules packs](../architecture/rules-packs.md). With the 2024 pack but not Xanathar's, the
chip names the two spells and `xanathars_full.json`; with every pack loaded it is silent.

## Rules that must hold

- **Every file in the folder declares the same `system` and the same `requires`.** The bundle is one
  file and can carry one answer; `bundle()` compares `requires` with `JSON.stringify` and fails the
  build on a mismatch, and `rules-data.js` asserts it first.
- **Every name in `requires` must exist in a shipped pack.** `rules-data.js` resolves each against
  the other four packs' data, so the report can only ever mean "not imported", never "misspelt".
- **Declare only what the schema cannot see.** A subclass's parent class is found structurally with
  no authoring; `requires` is for references that live in prose.
- **A new homebrew folder with its own `system` is one registration, plus its tests:** a pack in
  `data/packs.json` (`system`, `dir`, `file`, `title`, and `version: null` until its first release),
  else it is never bundled, archived or versioned; and the pack lists in `tables.js`, `rules-data.js`
  and the emblem check in `docs.js`, else it is untested. Its licence and credit go in the same
  registry entry. `DATA_VERSIONS` picks it up at the next release, and the archive and the app zip
  from the registry. Adding to the existing folder under `system: "Homebrew"` needs none of it.

## Traps

- **Subclasses were unreachable, and the app said the opposite.** Before this pack, a subclass whose
  class was not loaded merged, counted as loaded in Settings, and never appeared, while the picker
  said "This class has no subclasses in the loaded rules". Humblewood's, Xanathar's and Tasha's
  subclasses all attach to 2024 classes, so each of those packs loaded alone did this. Guard: the
  structural check, which needed no change to any of those packs.
- **Colour alone cannot carry the chip.** In the Classic skin `--brick` and `--accent` are the same
  value, so the red chip and the amber "update available" one would be identical; the chip leads
  with `!`.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How homebrew is produced | Hand-authored JSON | A converter: sources are PDFs, HTML and JSON, and every piece needs a judgement call |
| How a pack's dependencies are found | Two detectors: structural (`subclasses[].class`) and declared (`requires`) | Structural only: an expanded spell list names spells only inside prose. Scanning prose: would invent as many references as it found |
| Matching a declared name | Case-insensitive against everything loaded, whichever pack supplies it | Matching the named pack: having the spell from somewhere else is not an error |
| Where the verdict lives | Recomputed at render time from `rules`; only the declaration is stored | Computing it during merge: `mergeRules()` never runs at boot, so anything computed there would be lost on reload |
| Where the pack's licence and credit live | `license` and `attribution` in `data/packs.json`, stamped into the bundle | The `_note`: never copied into the bundle, so no player ever saw it (L5082) |
| Its `requires` once SRD 5.2 exists (#84, R7) | Left as it is | Repointing it to the SRD pack now: every name already resolves with either pack, and the 2024 pack stays public until #85, which repoints it (L5148) |

## Open

- The app cannot attach an invocation or pact boon automatically; like every invocation shipped in
  any pack's `features`, they are picked by hand from the library.
- Loaded alone, the pack's chip reads "15 missing" for 14 distinct entries: the Warlock is found by
  the structural check and again by the declared group. Verified in the test harness against
  `dist/homebrew_full.json`.

## History

- 2026-08-14 — Homebrew pack added with The Predator; `requires` and structural missing-dependency reporting. → ledger L1883
- 2026-10-07 — Its CC BY-SA 3.0 licence and credit to D&D Wiki ship for the first time, in the bundle, Settings → Credits & licences and `NOTICE.md`; a new folder is registered in `data/packs.json`. → ledger L5082, #83
- 2026-10-08 — Its D&D group resolves with SRD 5.2 alone, left as it is until #85 (spec R7). → ledger L5148, #84
