# Humblewood

The Humblewood pack, `data/humblewood/`, is the one system whose rules come from PDFs rather than
5e-tools. Its **words** are extracted verbatim from the condensed core book and the monthly playtest
packets by `scripts/extract-humblewood.py`; its **mechanics** (ability choices, skills, `uses`,
effects, choices, equipment, level structure) are hand-authored and the extractor never touches
them. The extractor is dev-only: it needs PyMuPDF from `.venv` and the PDFs under the gitignored
`_conversion-data/Rulebooks/`, and its committed output is what ships. What each packet adds and
supersedes is mapped in [Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md); this page is
how the extractor works and what it must keep doing.

**Code:** `main()`, `normalise()`, `audit_th()`, `classify()`, `styled_spans()`, `doc_stream()`,
`parse_entity()`, `build_tables()`, `write_prose()`, `set_prose()`, `merge_traits()`,
`add_anchors()`, `pt_write()`, `pt_extract()`, `pt_stream()`, `pt_clips()`, `dropcap_repair()`,
`pt_all_subs()`, `pt_new_race()`, `build_pt_tables()`, `extract_vol2_spells()`, `pt_reference()` in
`scripts/extract-humblewood.py`; `descHTML()` in `10-compute.js`; `richHTML()` in `87-notes.js`;
`tableChipsHTML()` in `86-tables.js` · **Data:** `data/humblewood/*.json` (26 species, 35
lineages, 10 backgrounds, 10 feats, 44 spells, 1 class with 2 paths, 11 subclasses, 35 tables) ·
**Tests:** `humblewood-verbatim.py`, `rules-data.js`, `tables.js` · **See also:**
[Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md), [Converter](converter.md),
[Rich text](../architecture/rich-text.md), [Rules & tables](../features/rules-and-tables.md),
[Testing](../process/testing.md)

## How it works

**Modes.** Previews write nothing: `--dump PAGES` (text by column), `--tables`, `--playtests
[--only DATE]` (every packet, with a verbatim self-check; exits 1 on problems). Three modes write:

| Mode | Writes | On problems |
|---|---|---|
| `--write-prose` | core-book prose into races, backgrounds, subclasses, feats | refuses if table extraction has problems |
| `--write` | `tables.json`: the 19 core tables plus the verified playtest ones | refuses on a core problem; a failed playtest table is reported and left out |
| `--write-playtests` | every packet's prose into all six entity files | writes anyway and lists the problems |

**Reading a page.** `classify()` maps font and size to a role, because in these PDFs style is
structure: `P22Aragon` 30pt+ is an entity title, bold 13pt+ a heading, bold-italic ≤11pt a run-in
trait name, italic ≤11pt `prereq`, regular 13pt+ a narrative subsection (skipped, like for like),
display faces at body size are page furniture. `styled_spans()` drops double-printed duplicate
spans by geometry, treats anything in the bottom 35pt as furniture (the page number is set in the
body face), coalesces same-style fragments on one baseline (small-caps headings arrive
letter-split), and runs `normalise()`. `doc_stream()` reads page, then left column, then right, and
skips the bands the table extractor claimed, so an entity crossing a column or page is contiguous.

**`normalise()`** applies `TEXT_ERRATA` (the book's own typos, e.g. "Stig Lineage"), repairs the
unmapped "Th" ligature from an explicit `TH_FIX` map plus `TH_CONTEXT` phrases, and folds quotes and
dashes. `audit_th()` reports any capital-T word that is neither in `TH_ALLOW` nor a `TH_FIX`
repair, but only `build_tables()` calls it, on core table cells; prose relies on the map and the
verbatim suite.

**Entities.** `parse_entity()` treats each run-in trait as structure (its own named trait and body),
ends at a heading or title, and skips narrative subsections. Headings are matched against expected
names (`CORE_RACES`, `CORE_SUBCLASSES`, …) with a dropped-first-letter tolerance, because drop caps
split titles. `HEAD_ERRATA` resolves the one repeated heading in the book (p35 prints "LEVEL 3:
NIGHT DOMAIN SPELLS" twice). Any other repeat is skipped rather than allowed to overwrite the
first, and recorded as a problem. `RENAMED` maps the one trait the source renamed.

**The merge.** `write_prose()` and `pt_write()` change only prose: `description`,
`feature.description`, `traits[].description`, and a spell's `text`, via `set_prose()` (which runs
`add_anchors()`) and `merge_traits()` (which updates traits by name, appends ones the old data had
dropped, and logs any it keeps that the source lacks). Everything else in a record is ours. A new
species from a packet is built by `pt_new_race()`, which derives `speed`, `languages` and
`abilityChoice` from the stat rows once, and reports anything it cannot parse rather than
guessing; Lunin states no speed, so its spec declares `speed=30`.

**Playtest packets.** `PACKETS` lists 19 packets newest first, each declaring what to expect: a
race's trait count (or names), a subclass's feature list, and flags for the packet's quirks
(`merge_into_core` for a lineage on a core species, `no_description`, `bold_traits`, `bands`).
Humblewood Spells Vol 2 has its own reader, `extract_vol2_spells()`. Of the 23 unique source
documents, two carry no player options and March 2024 is excluded; see
[Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md) for the supersessions. In `pt_write()`
the first packet to claim a field wins, so the newest printing of a shared trait is the one kept.
`pt_stream()` repairs drop caps (`dropcap_repair()`) and reads a page in the order `pt_clips()`
gives, which for a page listed in a packet's `bands` is stacked bands, each left then right.

**Class prose keeps its shape.** `pt_all_subs()` supplies the Gadgeteer's and its paths' words by
feature name. It emits a blank line and `**Name**` for a heading inside a section, a newline and
`**Name.**` for a run-in trait or label, and starts a new line for an italic run only when it
directly follows a heading (a tagline). `parse_entity()` breaks after the first italic run only if
nothing precedes it. The `**` markers render as bold through `descHTML()`, which delegates to
`richHTML()`; see [Rich text](../architecture/rich-text.md).

**Tables.** Core tables are explicit `SPECS` (page, anchor heading, column count, side, owner and a
declared row count); `build_tables()` refuses a spec with no `rows`. Playtest background tables come
from `build_pt_tables()`, which keeps a table only if it has exactly n rows, its die faces read 1..n
in order and no cell carries text bled from a neighbouring column, and keeps a background's four
characteristic tables or none. `--write` strips every underscore-prefixed key (the `_region` band
`write_prose()` needs in memory), refuses a table with no `cols`, and refuses duplicate names.
`add_anchors()` turns a named reference ("…the Bandit Specialty table") into `[Table: …]` in place;
unnamed references are left alone and the app's owner chips (`tableChipsHTML()`) cover them. The
extractor writes no `footnotes` (schema §6.11): the book's one starred table, Night Domain Spells,
explains its `*` in a line printed after the table ("Spells marked with an asterisk (*) can be
found in this book."), and that line stays in the feature prose right after the table's anchor.

## Rules that must hold

- **Verbatim, measured.** Core prose must match the book; `humblewood-verbatim.py` checks it
  (129 of 133 fields, the four exceptions listed in the test) plus 36/36 Gadgeteer fields against the
  November 2024 packet: `ALL PASSED (165)` when run with `.venv/bin/python`.
- **The book owns the words, we own the mechanics.** Only the prose fields above are written. A
  hand-added `uses`, effect or choice survives any re-extraction.
- **New content is folded into the existing consolidated files** (`races.json`, `classes.json`,
  `spells.json`, …), never into a new per-packet file. The pack is one set of categories, not a
  history of packets; [Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md) is where the
  per-packet record lives.
- **Never hand-edit Humblewood prose.** `set_prose()` rewrites wholesale with no preserve check, so
  a hand edit is reverted on the next run and logged only as "reworded". Fix the extractor.
- **The extractor is idempotent.** Before any extractor change, run each write mode unchanged and
  confirm `git diff data/humblewood` is empty; only then change anything. Otherwise a real change
  arrives mixed with unrelated churn.
- **Declare what you expect.** Every table spec declares `rows`; every race its traits; every
  subclass its features. A spec that declares nothing is unverifiable, which is how four broken
  tables once passed as "no problems" **(unverified)**.
- **Tables ship `cols`, and no underscore keys.** `tables.js` asserts, for every pack, a non-empty
  `cols`, no underscore keys, rectangular rows, unique names and an owner.
- **A tagline is positional, never stylistic.** `prereq` only means italic, and the book italicises
  inline spell names too. `rules-data.js` asserts both parsers' positional tests.
- **The extractor stays out of `convert.py`.** `convert.py` ships and is stdlib-only by contract.

## Traps

- **The old prose was a paraphrase.** Core prose was 0 of 45 verbatim and had dropped a dozen
  traits, including every species' Lineage trait; playtest content was 27 of 172, and the spells
  were summaries (median 72% of the real length). These are the ledger's measurements of the old
  data **(unverified)**. Guard: the verbatim suite.
- **The checker was wrong three times.** Its reference once interleaved the columns and kept page
  furniture; the page-number bug was invisible to it because both sides contained "38"; and a
  walker read only `description` (skipping all 44 spells, which use `text`) and assumed `levels`
  was a list (it is `{"1": {"traits": […]}}`). Guard: the reference is built the way the extractor
  reads the page (`pt_reference()` for packets). A measurement that finds fewer problems than
  expected is a reason to check the measurement.
- **`columns` for `cols`.** `build_pt_tables()` once wrote `columns`, and 16 of 35 tables rendered
  headerless while the JSON looked right; the extractor-internal `_region` shipped on 19. Guard:
  `--write` refuses and strips; `tables.js` asserts.
- **Right size, wrong pixels.** Two characteristic tables had six rows numbered 1–6 and had still
  absorbed words from the next column. Guard: the face-order and bleed checks.
- **A lineage packet claimed the species intro.** The February 2025 "Mustel, Webpaw" packet, being
  newest, took the Mustel description. Guard: `no_description` on that spec (narrower than
  `merge_into_core`, which would also stop its traits merging), asserted in `rules-data.js`.
- **Italics are not taglines.** A blanket `prereq` break produced `you can cast\ncharm person` in
  three species, and the live Gadgeteer rule split `divert power*` across two lines. Guard: the positional rules, and
  a `rules-data.js` scan for `[a-z,]\n[a-z]` in every `description` of five Humblewood files.
- **Banded pages.** November 2024 pages 5 and 10 end one section part-way down both columns and
  start the next underneath; read as columns, Magic Item Hacking's tail became the Engineer's
  Crafty Components. Guard: the packet's `bands`; `FEATURES_TABLE_HEADS` stops a subclass intro at
  its features table; small `Trattatello` captions are furniture. `rules-data.js` asserts the
  repaired Gadgeteer text.
- **`--write-playtests` always has problems.** The 10 spells with no source are appended to the
  problem list on every run, and the mode writes regardless. Read the list; do not treat a
  non-empty one as failure or a written file as success.
- **`./src/tests/run.sh` skips the verbatim suite.** It runs Python suites with the system
  `python3`, which has no PyMuPDF, so `humblewood-verbatim` reports `skipped` even with `.venv` and
  the PDFs present. Run `.venv/bin/python src/tests/humblewood-verbatim.py` after any extractor
  change.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where PDF extraction lives | A separate dev-only script whose reviewed output is committed | Extending `convert.py`: it ships to players and is stdlib-only by contract |
| How tables are found | Explicit `SPECS`, each with a declared row count | Auto-detection: produced confident nonsense (0 found with ruled lines, 38 false positives in text mode) |
| The unmapped "Th" ligature | An explicit map, a phrase list for the ambiguous cases, and an allow list | Guessing: "Ten", "Tree" and "Tank" are real words, and silence is what lets corruption ship |
| The book's own defects | Corrected explicitly: typos in `TEXT_ERRATA`, applied inside `normalise()`; the repeated heading in `HEAD_ERRATA` | Propagating them: a misspelt species name helps nobody, and the repeated heading would overwrite the real Night Domain Spells text. Patching at a call site: the verbatim check must see the same corrected text on both sides |
| Four core traits the condensed book lacks (Raptor ×2, Hedge, Mapach) | Kept (owner's call) | Dropping them: removing rules someone may be using is the harder error to undo |
| The core book's four subclass "Features" tables | Not extracted | Extracting: they duplicate `subclasses.json` levels and print the un-renumbered 2014 levels |
| Unnamed table references ("roll on the table below") | Left as printed; owner chips cover them | Inserting a table name: editorialising |
| March 2024 (Fizzar as a class) | Excluded | Extracting: superseded in full by November 2024; would add a dead class |
| A background whose characteristic tables only partly verify | Ship all four or none | Shipping the good ones: a Flaw table with no Ideal table reads as "the book has no Ideals" |
| Where the Gadgeteer's layout is fixed | In the extractor | In the data: the next run reverts a hand edit |
| Night Domain Spells' asterisk note (#73) | Left in the feature prose, where the book prints it after the table; no `footnotes` | Moving it into `footnotes`: the prose must match the book (the verbatim suite), and the line already sits beside the table's anchor |

## Open

- **10 spells have no source we hold** (Humblewood Vol 1 content); their text is untouched.
- **Sep 2024's 12 characteristic tables** are not taken: those pages stack tables and set them side
  by side. Several smaller tables are not extracted either; see §7 of
  [Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md). In-feature tables (Magic Item
  Hacking's rarity costs, Spell Emulator's tiers) read as flat text.
- **No species declares a size**, so all read Medium; Jerbeen, Luma and Hedge are Small in the book.
  The ledger routed the fix through the extractor. By the code, a hand-added `size` would survive
  re-extraction just as `uses` does, since only prose fields are written.
- **Cervan's Surge of Vigor has no `uses` tracker.** It was deferred because the prose ended "(see
  book)"; the verbatim text now says "You can't use this feature again until you have completed a
  Long Rest", so the reason no longer holds. Adding `uses {1/long}` is a data change the extractor
  would preserve.
- Two `_note`s are stale: `races.json` says skill choices are described in text, but five traits
  carry real choosers; `subclasses.json` names `humblewood-spells.json`, which is now `spells.json`.
- The mid-sentence scan reads `description` only, so it does not cover the spells' `text`.
- `--write-prose` never prints the problems `extract_subclasses()` records: `main()` shows problems
  only when `write_prose()` refuses, which it does for table problems alone. An undocumented repeated
  heading is therefore skipped silently, not reported as the ledger describes. Likewise the module
  docstring says any unknown capital-T word is a hard error; only core table cells are audited.
  Both verified by reading the code, not by running it.
- The four kept core traits remain expected exceptions in the verbatim suite; the ledger asked for
  each to be confirmed against the playtests.

## History

- 2026-08-07 — Data pass: `uses` on Fated, Songbird and Sensitive Skin; `speed +5` on both Swift traits. → ledger L11
- 2026-08-07 — Cervan's Surge of Vigor left without a tracker: the prose gave no frequency. → ledger L1808
- 2026-08-10 — Core prose made verbatim by `extract-humblewood.py`; 19 tables, with anchors. → ledger L904
- 2026-08-10 — Two checker bugs found; `humblewood-verbatim.py` added. → ledger L972
- 2026-08-10 — Playtest survey written up as HUMBLEWOOD-PLAYTESTS.md. → ledger L990
- 2026-08-10 — A third checker bug: spells use `text`, `levels` is a dict. → ledger L1030
- 2026-08-10 — Playtest packets folded in (`PACKETS`, `--write-playtests`, the Vol 2 reader). → ledger L1045
- 2026-08-10 — Characteristic tables must number 1..n and carry no bleed, not just count right. → ledger L1103
- 2026-08-10 — 16 tables shipped `columns`, 19 shipped `_region`; both fixed and guarded. → ledger L1219
- 2026-08-11 — Species size deferred: the PDFs state none. → ledger L1426
- 2026-08-15 — Gadgeteer prose keeps its shape as `**` markers, fixed in the extractor. → ledger L2484
- 2026-08-15 — Extractor made idempotent with `no_description` on the Webpaw packet. → ledger L2501
- 2026-08-15 — `descHTML()` renders `**bold**` on top of `highlight()`. → ledger L2519
- 2026-08-15 — Tagline rule made positional in both parsers; the mid-sentence scan became a test. → ledger L2538
- 2026-08-18 — `descHTML()` delegates to `richHTML()`, one grammar for every field. → ledger L3035
- 2026-09-25 — #59 reported: Gadgeteer, Engineer and Fizzar text bled across features. → ledger L3548, #59
- 2026-09-25 — #59 fixed: banded pages, captions as furniture, `FEATURES_TABLE_HEADS`. → ledger L3596, #59
- 2026-09-28 — Table `footnotes` exist (#73); the extractor needs none, since the one starred table's note is already in the prose. → ledger L4273, #73
