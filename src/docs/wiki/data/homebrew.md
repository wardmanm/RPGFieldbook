# Homebrew

`data/homebrew/` is the fifth rules pack (`system: "Homebrew"`) and the only one with no script
behind it: third-party content written as JSON by hand. Today it holds one Warlock subclass, The
Predator, with its pact boon, six invocations and an expanded-spell table. It leans on a class and
spells that other packs ship, which made it the case that forced missing-dependency reporting into
the open, and it is still the working example of `requires`.

**Code:** `missingRequirements()`, `requiresStatusHTML()`, `missingSummary()`, `mergeRules()` in
`89-rules-merge.js`; `subclassesFor()` in `50-classrace.js`; `bundle()` in
`scripts/bundle-rules.js`; `pack_digest()` in `tools/data-kit/fbdata.py`; `DATA_VERSIONS` in
`30-version.js` · **Data:** `data/homebrew/features.json`, `subclasses.json`, `tables.json` ·
**Tests:** `rules-data.js`, `tables.js` · **See also:** [Rules packs](../architecture/rules-packs.md),
[Supplements](supplements.md), [rules-schema](../../../../docs/rules-schema.md)

## How it works

**The files.** Three, each `system: "Homebrew"`, each with the same `_note` and the same `requires`:

| File | Holds |
|---|---|
| `features.json` | 7 library `features`: Pact of Tooth and Claw (`source: "Pact Boon"`) and six Eldritch Invocations |
| `subclasses.json` | The Predator, `class: "Warlock"`, traits at levels 1, 6, 10 and 14 |
| `tables.json` | Predator Expanded Spells, owned by the subclass and anchored from its level-1 trait |

The `_note` names the source (a D&D Wiki page) and its licence, CC-BY-SA 3.0. `bundle()` rolls the
folder into `dist/homebrew_full.json` like any other system, and `DATA_VERSIONS` carries a
`Homebrew` entry (`1.5.0` today), which `bundle()` requires and `release.js` bumps when
`data/homebrew/` changes.

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

**What the app does with it.** `mergeRules()` stores the declaration on `rules.requires`, keyed by
source, so it survives the rules cache. `missingRequirements()` is a pure function of `rules`,
called at render time: a structural check (any `subclasses[].class` with no loaded class) plus the
declared groups, matched case-insensitively and pack-blind. `requiresStatusHTML()` shows a red
`! n missing` chip on the pack in Settings, with a tooltip naming what to import, and
`missingSummary()` adds a line to the status after an import or a fetch. Loading never fails. Full
mechanism: [Rules packs](../architecture/rules-packs.md). With the 2024 pack but not Xanathar's, the
chip names the two spells and `xanathars_full.json`; with all five packs it is silent.

## Rules that must hold

- **Every file in the folder declares the same `system` and the same `requires`.** The bundle is one
  file and can carry one answer; `bundle()` compares `requires` with `JSON.stringify` and fails the
  build on a mismatch, and `rules-data.js` asserts it first.
- **Every name in `requires` must exist in a shipped pack.** `rules-data.js` resolves each against
  the other four packs' data, so the report can only ever mean "not imported", never "misspelt".
- **Declare only what the schema cannot see.** A subclass's parent class is found structurally with
  no authoring; `requires` is for references that live in prose.
- **A new homebrew folder with its own `system` is five registrations:** `SYSTEMS` in
  `bundle-rules.js` (else it is never bundled), `DATA_VERSIONS` in `30-version.js` (else bundling
  fails), `SYSTEM_DIRS` in `release.js` (else its data version never bumps, with a warning), the
  bundle copy and the `data/` allowlist in `build.sh` (else it misses the zip, or the zip is
  deleted), and the pack lists in `tables.js` and `rules-data.js` (else it is untested). Adding to
  the existing folder under `system: "Homebrew"` needs none of them.

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

## Open

- The app cannot attach an invocation or pact boon automatically; like every invocation shipped in
  any pack's `features`, they are picked by hand from the library.
- Loaded alone, the pack's chip reads "15 missing" for 14 distinct entries: the Warlock is found by
  the structural check and again by the declared group. Verified in the test harness against
  `dist/homebrew_full.json`.

## History

- 2026-08-14 — Homebrew pack added with The Predator; `requires` and structural missing-dependency reporting. → ledger L1883
