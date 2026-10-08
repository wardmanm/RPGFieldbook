# SRD 5.2

`data/srd52/` is the **SRD 5.2** pack (`system: "SRD 5.2"`): only the D&D content Wizards of the
Coast publishes free under Creative Commons in the System Reference Document. It is built by
`convert.py srd` from the same 5e-tools dump as the 2024 pack, its text is matched to the official
SRD 5.2.1 PDF, and it carries the attribution the licence asks for. It is a system of its own, read
as D&D, so a new player can make a D&D character with nothing else loaded. In #85, when the
copyrighted packs leave the public repo, it becomes the D&D content every player gets.

**Code:** `srd_view()`, `srd_book()`, `_srd_flag()`, `_srd_tag_renamer()`, `_run_core()`,
`_run_srd()`, `_srd_post()`, `_srd_apply_corrections()`, `_srd_targets()`, `_srd_sub()`,
`_srd_leaks()` in `scripts/convert.py`; `check()`, `compare()`, `norm()`, `records()`,
`strip_generated()` in `scripts/srd_text.py`; `systemOf()`, `racesForCharacter()` in `52-race.js`;
`findTable()` in `86-tables.js`; `dispName()` in `89-rules-merge.js` · **Data:** `data/srd52/*.json`,
`scripts/srd-corrections.json`, its entry in `data/packs.json`, `_conversion-data/srd52/SRD_CC_v5.2.1.pdf`
(gitignored) · **Tests:** `converter.py`, `rules-data.js`, `tables.js`, `srd-verbatim.py`, `data-kit.py`,
`docs.js` (the README and README-converter credit, the zip's corrections file) · **See also:** [Converter](converter.md),
[Rules packs](../architecture/rules-packs.md), [Data archive](../architecture/data-archive.md),
[Homebrew](homebrew.md), [Humblewood](humblewood.md) (the other verbatim check), [Testing](../process/testing.md),
[the spec](../../specs/2026-10-08-srd-pack-design.md)

## How it works

**What it holds.** Eleven files, each `system: "SRD 5.2"` with `excludeSystems: ["humblewood"]`,
no `_note` and no `requires`. The pack names are "SRD 5.2 Items", "SRD 5.2 Backgrounds", "SRD 5.2
Classes", "SRD 5.2 Species", "SRD 5.2 Tables" and "SRD 5.2 Options" (`SRD_NAMES`). Counted from
`data/srd52/`, and asserted in `rules-data.js`:

| Category | Count |
|---|---|
| backgrounds | 4 (Acolyte, Criminal, Sage, Soldier) |
| feats | 17 |
| species | 9 (Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, Tiefling) |
| spells | 339, each with a class list, none naming the Artificer |
| classes | 12, each with 1 subclass |
| options | 38 (28 Eldritch Invocations, 10 Metamagic) |
| magic items | 476 |
| base items | 94 |
| conditions | 21 |
| glossary terms | 115 |
| tables | 71 |

The classes read the same helper files as the 2024 pack, so the Barbarian, Monk and Sorcerer carry
their resource trackers (Rage, Focus Points, Sorcery Points) and the Archery option its attack
effect. The Fighting Style menu is the four SRD Fighting Style feats (Archery, Defense,
Great Weapon Fighting, Two-Weapon Fighting), plus Blessed Warrior for the Paladin and Druidic
Warrior for the Ranger.

**Its credit.** The registry entry carries `license: "CC-BY-4.0"` and this attribution, whose first
two sentences are SRD 5.2.1's required statement, verbatim (PDF p. 1), and whose third is the change
note CC-BY-4.0 asks for:

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Changed: converted to Fieldbook's rules format, with renamed entries' references updated.

`bundle()` stamps it on `dist/srd52_full.json`, so it is listed in Settings → Credits & licences
while the pack is loaded and in the archive's `NOTICE.md`; README §10 carries the statement too.
**Fieldbook adds no other attribution to Wizards** (not in the pack, Settings, README §10 or the
player notes), because the SRD's legal page asks for none:
"Please do not include any other attribution to Wizards or its parent or affiliates other than
that provided above." The statement names SRD **5.2.1**, the revision the text was matched to; the
system label stays "SRD 5.2".

**How it is built.** One command, reproducing the committed folder:

```bash
python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o data/srd52
```

1. **The view.** `srd_view()` writes an SRD-only copy of the dump into a temporary directory (the
   dump itself is never written) and deletes it after the run. It keeps only flagged entries:
   `_srd_flag()` reads `srd52` as `true` or a string, which is a rename; a magic variant carries it
   on `inherits`. Every kept entry is marked `srd52: true`, so the 2024 pipeline's own checks keep
   it whatever its source. Lookup data (item properties, types, masteries, the `itemEntry`
   templates) is copied whole: it is not content, and filtering it would break the items that use
   it. A class file with no SRD class in it is left out of the view.
2. **Renames, in three layers.** 33 entries are renamed (Bigby's Hand → Arcane Hand, Leomund's
   Tiny Hut → Tiny Hut, Heward's Handy Haversack → Handy Haversack, Orb of Dragonkind → Dragon
   Orb…). `_srd_tag_renamer()` makes every `{@spell X}` and `{@item X}` tag in the view follow its
   entry, case-insensitively, with a display text equal to the old name renamed too. The old name in
   the entry's own prose and table captions becomes the new one, before any table is built, so
   `[Table: …]` anchors and table names agree. `sources.json`, which gives spells their classes and is
   keyed by the original name, is re-keyed, and its Artificer (EFA) tags are dropped. Where the SRD
   rewrote a passage rather than renaming it, the corrections file carries the PDF's wording.
3. **Referenced feats.** The Paladin's and Ranger's Fighting Style feature embeds Blessed Warrior or
   Druidic Warrior by reference (`refFeat`), and neither is one of the SRD's 17 feats. The view
   carries those feats' text in `srd-ref-feats.json`, which `_run_core()` reads into `_FEAT_INDEX`
   beside `feats.json`, so the menu can offer the option. The view's other output is the list of
   Fighting Style feats it kept, which limits the menu.
4. **The pipeline.** `_run_srd()` runs `_run_core()` (the body `all` uses, unchanged) over the view,
   with `srd_book()`: a `Book` with system "SRD 5.2", `SRD_NAMES`, `excludeSystems` humblewood, mode
   `"srd"` and **no source codes**, so `is_default` holds and every 2024 behaviour stays on (the
   Fighting Style menu, 2024 prerequisites, the `shipped` item rule).
5. **After the pipeline, before writing.** `_srd_post()` applies the corrections, then the leak
   scan, to the converted pack in memory. Any error is printed and **nothing is written** to `-o`.
   `_srd_leaks()` fails on a record, class or subclass named as a non-SRD entry (every XPHB or XDMG
   entry the view dropped, matched as a whole name, so "Aura of Protection" never trips on the feat
   Protection) and on a renamed entry's old name anywhere in the text. On the v2.36.1 dump: 0 leaks,
   502 non-SRD names, 33 renames. `--excluded-out PATH` writes those two lists; they are committed
   as `src/tests/fixtures/srd-excluded-names.json`, because the data tests need them and CI has no
   dump.

A player can run it too: the app zip ships `scripts/srd-corrections.json` beside `convert.py`, and
[README-converter](../../../../docs/README-converter.md) gives the command, which from the zip also
names `--overlay` and `--resources`. The pack in the rules-data zip is still the one to use.

**Matching the PDF.** `scripts/srd-corrections.json` is hand-authored, a converter input beside
`overlay.json`, never a pack. `_srd_apply_corrections()` applies, in order:

| Key | What it does | Today |
|---|---|---|
| `remove` | Drops a whole record or table the SRD doesn't print | 1 (the Iron Flask Table) |
| `global` | A whole-word swap across the pack | 1 (DM → GM: the SRD never says "DM") |
| `corrections` | `{entry, find, replace, page, why}` on the entry it names | 124 |
| `accepted` | `{entry, text, why}`: a span `srd-verbatim` lets through | 93 |
| `aliases` | An entry the SRD titles differently (`"Ring of Fire Resistance": "Ring of Resistance"`) | 158 |

An entry is named by the keys `_srd_targets()` and `records()` share: a record by its name (a
keyword by its term), a subclass by its name, a trait or choice option as "Owner/Name", a subrace as
"Species/Subrace" and its trait as "Subrace/Trait", a table as "table:Name". `_srd_sub()` never
rewrites names, terms, owners or sources (`SRD_KEY_EXEMPT`), because a table's name is what its
anchors resolve by. A removal or swap that matches nothing, a correction naming no entry in the
pack, or a `find` its entry doesn't contain is an error: a correction that no longer applies means
the source moved under it. **The file itself is required.** The default is `srd-corrections.json`
beside `convert.py` (`--corrections PATH` names another); a missing or unreadable one is an error,
so the pack is built with its corrections or not at all. A run that succeeds prints the file it
applied and its counts: `corrections: …/srd-corrections.json (1 removal, 1 global, 124 corrections)`.
A replacement is written as text, never as a regex template.

`scripts/srd_text.py` is the pure half of the check. `norm()` reduces text to comparable words
(curly quotes and dashes unified, the PDF's running heads and line-end hyphenation removed,
punctuation dropped). `records()` lists every checkable piece of the pack: each entry's text, its
traits, subraces, subclass descriptions and described choice options; a level's `spells` note is left
out, because the converter writes those counts itself. `strip_generated()` drops the stat segments
`convert_items()` writes on an item's first line. `compare()` finds the entry's section in the SRD by
its heading (or its alias) and returns the spans of pack text the SRD lacks. `check()` returns every
such span, and every table cell the SRD lacks, that `accepted` doesn't list. **A finding is a span of
pack text that appears nowhere in the SRD.** Text the SRD has elsewhere (the Ammunition rules quoted
on an arrow) is SRD text, and passes. `check()` also reports the corrections file's own stale lines,
as the converter fails on a stale correction: an `accepted` (entry, text) that matched no finding
("(accepted, matched nothing) …") and an `aliases` key that names no record ("(alias names no
record)"). An alias whose entry is found without it is not stale: 14 of them still pick the right
heading where the bare name also occurs (Elf/Drow, the Goliath ancestries, the Tiefling legacies).

`src/tests/srd-verbatim.py` reads the PDF with PyMuPDF and runs `check()`. It needs `.venv` and
`_conversion-data/srd52/SRD_CC_v5.2.1.pdf`, and prints `SKIP` without either, so CI stays green:
run it as `.venv/bin/python src/tests/srd-verbatim.py` (`--report PATH` writes the findings as a
list). Today: ALL PASSED, 1561 records.

**When 5e-tools or the SRD moves.**

1. Run `srd` on the new dump. A correction whose `find` is gone, or whose entry is gone, fails the run
   and names itself. Open the PDF page it cites: if 5e-tools now agrees with the SRD, delete it;
   otherwise rewrite its `find` against the new text.
2. A new leak (a non-SRD name, or an old name in the text) also fails the run. Fix it with a
   correction or a removal, citing the page.
3. Regenerate `data/srd52` and the fixture (`--excluded-out src/tests/fixtures/srd-excluded-names.json`),
   then run `srd-verbatim`. Each new finding is either a **correction** (a name, a number, a rule:
   anything of substance, with its page), an **acceptance** (form only, with a `why`), or an
   **alias** (the SRD titles the entry differently). Never accept a difference of substance. A stale
   acceptance or alias is a finding too: delete it.
4. A new SRD revision also means a new PDF in `_conversion-data/srd52/`, a new attribution (the
   registry entry, README §10 and the `docs.js` check all name 5.2.1), and a full re-triage.
5. Run the SRD gate and the suites. A moved `data/srd52` changes the pack's digest, so it is a data
   release.

**In the app.** `systemOf()` reads a source label starting `srd` as `"dnd"`, so
`racesForCharacter()` offers a D&D character the nine SRD species and a Humblewood character none.
`excludeSystems` says the same to an older app that doesn't know the label. Everything else in the
pack is offered to every character, as any pack's is. With the 2024 pack also loaded, same-named
entries show both sources ("Fireball (SRD 5.2)", through `dispName()`), as any duplicate does. The
registry lists SRD 5.2 after XPHB, so the archive, and an import of it, loads the 2024 pack first,
and existing characters keep resolving to it. Tables are looked up by name across every pack
(`findTable()`): the two packs share 68 table names, 59 of them word for word, and the first loaded
wins (see [Rules packs](../architecture/rules-packs.md)).

## Rules that must hold

- **The flag is the filter.** Here, and only here, an entry is in because `srd52` says so: never
  select by `source`, never backfill, never read `basicRules2024` (it marks a free subset, not an
  open licence). This is the [converter](converter.md)'s free-rules trap reversed.
- **Every correction and removal cites its page** in SRD 5.2.1 (`page`), and says why (`why`) where
  the change alone doesn't. An acceptance says why. Every difference between the pack and the PDF is
  corrected or recorded; `srd-verbatim` fails on any other.
- **The SRD gate.** `data/srd52` reproduces byte for byte, or the pack's digest moves:
  `python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o /tmp/srd && diff -r /tmp/srd data/srd52`.
  CI has neither the dump nor the PDF, so this and `srd-verbatim` are manual gates.
- **The attribution is verbatim** wherever it appears, and Fieldbook adds no other attribution to
  Wizards.
- **The leak scan stays clean,** and the converter's renames stay complete: `rules-data.js` fails on
  any record or table named as a non-SRD entry and on any of the 33 old names, from the committed
  fixture.
- **The committed pack carries its corrections.** CI has neither the dump nor the PDF, so
  `converter.py` checks it from committed files alone: the corrections file's shape, every
  correction's entry in the pack, each `find` gone and each `replace` there, no removed entry, no
  global word left.

## Traps

- **A side file named `feats*.json`.** `_run_core()` finds the feats file with the glob
  `feats*.json`, so a referenced-feats file named that way would be converted as the pack's feats.
  Hence `srd-ref-feats.json`.
- **The `is True` test on rename flags.** `srd52` is `true` or a string, and a string is a rename:
  `is True` reads a renamed entry as not flagged. That is how the 2024 pack lost Carrion Crawler
  Mucus and Lolth's Sting until #84. Read the flag as truthy, as `_srd_flag()` and the 2024 selection
  helpers now do.
- **Seeding resets every pack.** `fbdata.py versions --seed` records every pack's current digest, not
  only a new one, so it would mark the 2024 pack's #84 fixes as already released and 1.8.0 would
  never bump it. The SRD pack's digest is left absent instead (a missing digest already means
  "changed"), and `data-kit.py` requires a digest only of packs that have a version.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How the SRD pack is selected | An SRD view of the dump (`srd_view()`), run through the 2024 pipeline unchanged (`_run_core()`) (R1) | An SRD branch at each of the converter's 20 selection sites: threading a mode through all of them risks the 2024 pack at every one. A prototype of the view reproduced every entry the two packs share byte for byte |
| Which SRD revision the text and attribution target | SRD 5.2.1, the current one; the system label stays "SRD 5.2" (R2) | SRD 5.2: what Wizards published first, now superseded. The stray-name passages read the same in both |
| Whose wording the pack ships | The PDF's: every difference corrected or accepted in `srd-corrections.json`, checked by `srd-verbatim` (R3, decision 3) | 5e-tools' text as it stands: where it differs from the SRD it is the 2024 books' wording, which CC-BY-4.0 does not cover |
| Two packs sharing a table name (R5) | Allowed for byte-identical twins and for the nine pinned SRD/2024 pairs that differ; any other same-named pair, or a change to the nine, fails `rules-data.js` | Renaming the SRD's copies: breaks the anchors in its prose and departs from the PDF's names. Identical twins only (the spec's R5): the SRD's own wording differs in 9 of the 68 shared tables. Any SRD/2024 pair (the plan's widening): a new difference, from a 5e-tools update say, would pass without a word |
| A missing corrections file (#84) | An error: exit 1, nothing written, the path named; the app zip ships the file beside `convert.py` | No corrections (the plan's ruling): the run succeeded with 5e-tools' wording, and with the file missing from the zip, every player's own run did |

## Open

- **Judgment calls awaiting Mike** (listed in ledger L5148): 5e-tools' ammunition and holy-symbol
  glosses removed; the 12 class blurbs empty; "3rd"/"5th" ordinals accepted as form; Goliath
  subraces opening with the SRD's own "Choose one of the following benefits" framing; 5e-tools'
  table-row restatements handled unevenly (Holy Symbol rows removed; Horn of Valhalla, Carpet,
  Potion and Ring rows accepted, Horn of Valhalla's row saying "Berserkers" beside the corrected
  "spirits", Spell Scroll stating its DC two ways).
- **A reordering of SRD words is not caught.** A span passes if it appears anywhere in the SRD.
- **With both packs loaded, the 2024 twin of a shared table wins** (in archive order), so the SRD's
  corrected Reincarnate, Deck of Illusions and Object Armor Class tables are shadowed. See
  [Known issues](../roadmap/known-issues.md).
- No version until 1.8.0 gives it one (`version: null`), so the bundle carries no `dataVersion` yet.
- Homebrew's `requires` still names `5e2024_full.json` for its D&D group, though every name in it
  resolves with SRD 5.2 alone; #85 repoints it.

## History

- 2026-10-08 — The SRD 5.2 pack: `convert.py srd` over an SRD view of the dump, three rename layers, the leak scan, corrections matched to the SRD 5.2.1 PDF and `srd-verbatim`, the registry entry and credit, `systemOf()`. → ledger L5148, #84
- 2026-10-08 — The final review's fixes: a missing corrections file fails the run and the app zip ships it; CI checks the committed pack carries its corrections; stale acceptances and aliases fail `srd-verbatim`; Carrying Capacity's correction is gone with the converter bug it covered (124 corrections, three shadowed tables); the nine differing twins are pinned; README-converter documents `srd`. → ledger L5269, #84
