# Homebrew

The Homebrew pack (`system: "Homebrew"`) is the only pack with no script behind it: third-party
content written as JSON by hand, under CC-BY-SA-3.0. It lives in the private repo,
RPGFieldbookPrivate, as `data/homebrew/` beside the copyrighted packs ([Private data](private-data.md)),
though its own text is shareable: it moved there (#125) because it leans on two Xanathar's spells,
and Xanathar's is private. Today it holds one Warlock subclass, The Predator, with its pact boon,
six invocations and an expanded-spell table. It leans on a class and spells that other packs ship,
which made it the case that forced missing-dependency reporting into the open, and it is still the
working example of `requires`.

**Code:** `missingRequirements()`, `requiresStatusHTML()`, `missingSummary()`, `mergeRules()` in
`89-rules-merge.js`; `subclassesFor()` in `50-classrace.js`; `bundle()` in
`tools/data-kit/fbdata.py`; `pack_digest()` in `tools/data-kit/fbdata.py`; `rulesCreditsHTML()` in
`88-settings.js`; `DATA_VERSIONS` in `30-version.js` · **Data (private repo):**
`data/homebrew/features.json`, `subclasses.json`, `tables.json`; its entry in that repo's
`data/packs.json` · **Tests:** the private repo's `private-data.js` (the pack, its `requires`, its
credit); `rules-data.js` tests `requires` on invented packs · **See also:**
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
entry in the private repo's `data/packs.json`: `license: "CC-BY-SA-3.0"` and an `attribution`
crediting The Predator to D&D Wiki's contributors, with its page, the licence, and "Changed:
converted to Fieldbook's rules format." `bundle()` rolls the folder into `homebrew_full.json` like
any other pack and stamps both on it, so they ship in the bundle, are listed in Settings → Credits
once the pack is loaded, and appear in the private archive's `NOTICE.md` (see
[Data archive](../architecture/data-archive.md)). That is how CC BY-SA's credit travels with every
private release. Its version is that registry's (`1.8.0`, carried over from the public registry);
the move added a `file` to its Xanathar's group, which changed its digest, so the next private data
release bumps it.

**Why by hand.** Homebrew arrives as PDFs, HTML and JSON, and each piece needs judgement: which
features are subclass traits and which are invocations, and what level each lands on. The files
follow the XGE/TCE convention, so invocations and the pact boon are standalone `features` (the
library a player picks from by hand), not level-up choices. A throwaway generator wrote the three
files once, only so their `requires` blocks are byte-identical; it is not kept.

**`requires`.** Declared per file, two groups: `{"pack": "SRD 5.2", "file": "srd52_full.json", …}`
for the Warlock class and 11 spells, and `{"pack": "Xanathar's Guide to Everything", "file":
"xanathars_full.json", …}` for Cause Fear and Primal Savagery. The expanded spell list is prose and
a table, so those 13 spells are invisible to any structural check; declaring them is the only way
the app can say what is missing. The schema is in [rules-schema](../../../../docs/rules-schema.md) §1.

**Why SRD 5.2, and why Xanathar's names its file.** Every name in the first group (the Warlock and
its 11 spells) is also in the [SRD 5.2](srd.md) pack, under the same name, and a declared name
matches whichever pack supplies it — so that group is satisfied by SRD 5.2 alone (#84, R7); #85
repointed its `pack`/`file` to say so when the D&D 2024 pack left the public repo. The Xanathar's
group had no `file` while Homebrew was public, since no public file could provide it; now the two
packs ship in the same private archive, so it names `xanathars_full.json` (#125), and the tooltip
says "— import xanathars_full.json". A group with no `file` would read "— from `<pack>`".
Neither `pack` nor `file` affects whether a name resolves — matching is case-insensitive and
pack-blind — they only drive what a *missing* group's tooltip tells a player to go get.

**What the app does with it.** `mergeRules()` stores the declaration on `rules.requires`, keyed by
source, so it survives the rules cache. `missingRequirements()` is a pure function of `rules`,
called at render time: a structural check (any `subclasses[].class` with no loaded class) plus the
declared groups, matched case-insensitively and pack-blind. `requiresStatusHTML()` shows a red
`! n missing` chip on the pack in Settings, with a tooltip naming what to import, and
`missingSummary()` adds a line to the status after an import or a fetch. Loading never fails. Full
mechanism: [Rules packs](../architecture/rules-packs.md). With SRD 5.2 loaded but not Xanathar's, the
chip names the two spells and `xanathars_full.json`; with both loaded it is silent.

**Players who installed it from an earlier public release** keep it: it stays loaded and keeps
working. The public registry no longer lists it, so the extensions screen shows it as a plain
installed pack with no updates, and Settings shows its version quietly (`dataStatus()` state
`known`, once the next app release retakes `DATA_VERSIONS`). Its old copy still reads "— from
Xanathar's Guide to Everything" for the two spells. The release notes say it has moved; no app code
announces it (Mike, 2026-10-27).

## Rules that must hold

- **Every file in the folder declares the same `system` and the same `requires`.** The bundle is one
  file and can carry one answer; `bundle()` compares `requires` with `JSON.stringify` and fails the
  build on a mismatch, and the private `private-data.js` asserts it first.
- **Every name in `requires` must exist in a pack, and every `file` must be a bundle a registry
  ships.** The private suite resolves the D&D group's names against the public SRD 5.2 folder
  (#84's R7 check) and the Xanathar's group's against the Xanathar's pack, and checks both files
  against the two registries, so the report can only ever mean "not imported", never "misspelt".
- **Declare only what the schema cannot see.** A subclass's parent class is found structurally with
  no authoring; `requires` is for references that live in prose.
- **Homebrew stays shareable.** Only content under an open licence goes here, with its licence
  and credit in its registry entry, though it now ships in the private archive.
- **The leak scan counts it as free text, never private.** Its text is CC BY-SA. The scan reads
  the public `data/homebrew/`, which only refs older than #125 still carry (such as the `v1.8.1` a
  private release builds on); afterwards that folder is gone and adds nothing. See
  [Private data](private-data.md).
- **A new homebrew folder with its own `system` is one registration, plus its tests:** a pack in
  the private repo's `data/packs.json` (`system`, `dir`, `file`, `title`, and `version: null` until
  its first release), else it is never bundled, archived or versioned; and the folder lists in its
  `private-data.js`, else it is untested. Its licence and credit go in the same registry entry.
  Adding to the existing folder under `system: "Homebrew"` needs none of it.

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
| Its `requires` once SRD 5.2 exists (#84, R7) | Left pointed at the 2024 pack for that release | Repointing it to the SRD pack right away: every name already resolved with either pack, so there was no behaviour to fix yet — #85 repoints it once the 2024 pack is about to go private (L5148, L5388) |
| The "requires Xanathar's Guide to Everything" chip on the official manifest (#102, Mike 2026-10-26) | It stays. Homebrew depends on private content, so it is to move into the private repo, as separate work | Marking the group optional, or copying only class requirements into the manifest: either hides a real gap (L7513) |
| Xanathar's group's `file` once it goes private (#85) | Dropped — the group names the book only | Keeping a `file` nothing public ever ships: `requiresStatusHTML()` already renders a `file`-less group as "— from `<pack>`", so pointing at a filename a player can never get would be the lie |
| Where Homebrew lives (#125, Mike 2026-10-27) | The private repo, beside Xanathar's, its licence and credit carried in its registry entry | Staying public: its chip names a pack no public file provides |
| Players who already installed it (#125, Mike 2026-10-27) | Release notes only; their copy keeps working as a plain installed pack | A "moved" signal in the app: their copy keeps working, and it shows as installed with no updates, which is true |
| Xanathar's group's `file` once both are private (#125) | `xanathars_full.json`, the file beside it in the same archive | Keeping it book-only: the file is now one the player who has Homebrew can get |
| The leak scan's corpora (#125, Mike's fix-round ruling) | Free, read from the public checkout's `data/homebrew/` when it is there | Neither: a public ref that still carries the folder (`v1.8.1`, the base of the next private release) fails on the Predator's sentence shared with Xanathar's. Private: its CC BY-SA text has nothing to protect |

## Open

- **A public player's old copy** still names the Xanathar's spells "from Xanathar's Guide to
  Everything", which no public file provides; re-importing the pack from the private archive
  replaces it.
- The app cannot attach an invocation or pact boon automatically; like every invocation shipped in
  any pack's `features`, they are picked by hand from the library.
- Loaded alone, the pack's chip reads "15 missing" for 14 distinct entries: the Warlock is found by
  the structural check and again by the declared group. Verified in the test harness against
  the bundle.

## History

- 2026-08-14 — Homebrew pack added with The Predator; `requires` and structural missing-dependency reporting. → ledger L1883
- 2026-10-07 — Its CC BY-SA 3.0 licence and credit to D&D Wiki ship for the first time, in the bundle, Settings → Credits & licences and `NOTICE.md`; a new folder is registered in `data/packs.json`. → ledger L5082, #83
- 2026-10-08 — Its D&D group resolves with SRD 5.2 alone, left as it is until #85 (spec R7). → ledger L5148, #84
- 2026-10-09 — `bundle()` moves to `tools/data-kit/fbdata.py` (Python), replacing the Node bundler. → ledger L5342, #85
- 2026-10-09 — Its D&D group's `pack`/`file` repointed to `"SRD 5.2"`/`srd52_full.json`; Xanathar's group drops `file` and is named by the book alone. → ledger L5388, #85
- 2026-10-09 — One of the two public packs; the Xanathar's names are checked in the private suite. → ledger L5426, #85
- 2026-10-26 — The official manifest's "requires Xanathar's" chip stays; Homebrew is to move into the private repo as separate work. → ledger L7513, #102
- 2026-10-28 — Moves to the private repo with its licence and credit; its Xanathar's group names `xanathars_full.json`; its tests move to the private suite; players who installed it get release notes only. → ledger L7858, #125
