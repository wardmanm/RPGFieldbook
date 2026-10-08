# The SRD 5.2 rules pack — design

**Status:** proposed · 2026-10-08
**Issue:** #84, part 2 of #82. Part 1 (#83, the data archive) is merged; part 3 (#85, the private split
and the data kit) follows.
**Branch:** `issue/84-srd-pack`

---

## 1. What it is

A new rules pack, **SRD 5.2**, holding only the D&D content Wizards of the Coast publishes under
CC-BY-4.0 in the System Reference Document. It is built by `scripts/convert.py` from the same
5e-tools dump as the 2024 pack, lives in `data/srd52/`, and is its own system: `"SRD 5.2"`. In #85,
when the copyrighted packs leave the public repo, it becomes the D&D content every player gets.

It holds:

| Category | Count |
|---|---|
| backgrounds | 4 |
| feats | 17 |
| species | 9 |
| spells | 339 |
| classes | 12, each with 1 subclass |
| options | 38 (28 Eldritch Invocations, 10 Metamagic) |
| magic items | 476 |
| base items | 94 |
| conditions | 21 |
| glossary terms | 115 |
| tables | about 72 |

Its text follows the official SRD 5.2.1 PDF wherever the 5e-tools text (the 2024 books' wording)
differs. It carries the attribution the SRD requires.

## 2. Decisions

From the #82 planning (Mike, 2026-10-07):
- The pack is its own system, "SRD 5.2".
- There is no SRD 5.1 backfill.

From this spec (Mike, 2026-10-08):

| # | Question | Decision |
|---|---|---|
| 1 | The two existing converter bugs that also hit the 2024 pack (two renamed items missing; a Python dict printed in three Warlock invocations' prerequisites) | **Fix them in both packs.** `data/5e2024` regenerates with the fixes |
| 2 | The official SRD PDF | **Downloaded** into `_conversion-data/srd52/` (gitignored): `SRD_CC_v5.2.pdf` and `SRD_CC_v5.2.1.pdf`, from `media.dndbeyond.com` |
| 3 | Non-SRD names inside SRD-flagged text (Witch Bolt in Pact Magic's example, Aasimar in Reincarnate's table, Monster Manual creatures in Iron Flask) | **Match the SRD PDF.** Every difference is listed for Mike to confirm |

**Rulings this spec makes, for review:**

| # | Ruling | Why |
|---|---|---|
| R1 | **The SRD pack is built from an SRD view of the dump:** filtered, renamed and corrected in memory, then run through the existing 2024 pipeline. There is no SRD branch at each of the 20 selection sites | A prototype of exactly this reproduced every entry the two packs share byte-identically. Threading a mode through 20 sites risks the 2024 pack at every one of them |
| R2 | **The text and attribution target SRD 5.2.1**, the current revision | It is what Wizards publishes now, and the stray-name passages read the same in 5.2 and 5.2.1. The system label stays "SRD 5.2" (Mike's name for the pack) |
| R3 | **A pack's text must match the PDF.** A new dev-only suite, `srd-verbatim`, compares every entry with its PDF section. A difference is either corrected in `scripts/srd-corrections.json` or recorded there as accepted, with a reason | Where the 2024 book's wording differs from the SRD, that wording is the book's, not the SRD's |
| R4 | **The Fighting Style choice follows the rules in both packs:** the Fighting Style feats the pack has, plus Blessed Warrior for the Paladin and Druidic Warrior for the Ranger | The SRD names both options ("Instead of choosing one of those feats…"), and the 2024 pack's hard-coded menu has never offered them. This is decision 1 applied to a third bug the research found |
| R5 | **Two packs may share a table name when the tables are identical.** `rules-data.js`'s "no table name used by two packs" check exempts byte-identical twins and still fails on a same-named table with different content | The SRD and 2024 packs share 69 tables, word for word. `findTable()` takes the first, so identical twins are harmless |
| R6 | **`systemOf()` reads "SRD 5.2" as D&D**, and the pack also carries `excludeSystems: ["humblewood"]` | Its species belong to D&D characters. The `excludeSystems` keeps older apps, which don't know the label, from offering SRD species to Humblewood characters |
| R7 | **Homebrew's `requires` is left as it is** | All 12 names in its D&D group are in the SRD, unrenamed, and `requires` matches against everything loaded. #85 repoints the chip text when the 2024 pack goes private |

## 3. The SRD view (R1)

A new function `srd_view(dump) -> dump` runs before the existing pipeline. It reads each file the
converter reads and returns a copy that holds only the SRD. It changes nothing on disk.

1. **Keep only flagged entries.** An entry is SRD when `srd52` is truthy: `true`, or a string, which
   is a rename. Everything else is dropped, including 2014 `basicRules` content.
   - For `magicvariants.json`, the flag sits on `inherits`.
   - The flag is never read as `is True` here; that test is the cause of the existing bug
     (decision 1).
   - Lookup data the converter needs whole is not filtered: item properties, item types, `itemEntry`
     templates, the item index. None of them is content.
2. **Rename.** For an entry whose `srd52` is a string, that string becomes its name. Every reference
   follows:
   - **Tags:** `{@spell X}` and `{@item X}` (and their `|source|display` forms) anywhere in the view,
     matched case-insensitively. A display text equal to the old name becomes the new one.
   - **The entry's own prose and table captions:** the old name becomes the new one. This is done
     before tables are built, so `[Table: …]` anchors and table names agree.
   - **Anything else** comes from the corrections file (§5). Where the SRD rewrote a passage rather
     than renaming it — its Dragon Orb text says "an orb" where the book says "Orbs of
     Dragonkind" — the correction carries the PDF's wording. A mechanical plural would invent words
     the SRD doesn't use.
   - **`sources.json`**, which gives spells their classes and is keyed by the original name.
3. **Mark every kept entry `srd52: true`.** The 2024 pipeline's own checks then keep it, whatever its
   source.
4. **Drop the Artificer (EFA) class tags** from `sources.json`. There is no Artificer in the SRD.
5. **Apply `scripts/srd-corrections.json`** (§5).

The pipeline then runs with `Book(system="SRD 5.2", names=SRD_NAMES, exclude_systems=["humblewood"])`.
It has no `codes`, so every 2024 behaviour (`is_default`) stays on: the Fighting Style menu,
2024-style prerequisites, `shipped` items. There is one SRD-specific hook: the Fighting Style menu
lists only Fighting Style feats present in the view (R4).

## 4. Converter changes (`scripts/convert.py`)

- **`srd <dump> -o <out>`**, a new command. Its body is `all`'s, extracted into `_run_core(dump,
  out, book)` so `all` and `srd` share it; `all` calls it with the default Book and is otherwise
  unchanged. `srd` refuses `--include-legacy`.
- **`Book` gains a `mode`:** `"xphb"` (the default), `"supplement"` (has `codes`) or `"srd"`.
  `is_default` stays "no `codes`". The mode only chooses names, the `system` stamp and the SRD hook.
- **Pack and file names:** "SRD 5.2 Backgrounds", "SRD 5.2 Classes", and so on. The per-record
  `system` stamps (items, backgrounds, races) read the Book's `system`.
- **Decision 1, in both packs:**
  - **Renamed items:** `pick_2024_preferred()`, `_shipped_2024()` and `_variant_selected()` read
    `srd52` as truthy, not `is True`. The 2024 pack gains Carrion Crawler Mucus and Lolth's Sting,
    under those names.
  - **Invocation prerequisites:** `_render_optfeat_prereq()` renders a dict-shaped spell prerequisite
    by its `entry` text (through `strip_tags()`), not `str()`. Agonizing Blast, Eldritch Spear and
    Repelling Blast read "Level 2 Warlock and a Warlock cantrip that deals damage" (the dump's
    wording, not title-cased); 24 occurrences in the 2024 pack.
- **R4, in both packs:** the Paladin's and Ranger's Fighting Style choice adds Blessed Warrior or
  Druidic Warrior respectively, with the dump's text. The SRD menu is the four SRD Fighting Style
  feats plus that option. The 2024 menu keeps its ten styles plus the option.
- **The leak scan.** At the end of an `srd` run, the converter checks every record name and table
  name against a list of non-SRD names generated from the dump (everything XPHB/XDMG ships that the
  view dropped, plus the renames' old names). A hit fails the run. Names are matched as names, not
  substrings, so "Aura of Protection" never trips on the feat Protection.

`data/5e2024` changes only by decision 1 and R4. The byte-for-byte gate is re-established on the
regenerated files in the same commit, and a test pins each intended difference.

## 5. Matching the PDF (decision 3, R3)

- **`src/tests/srd-verbatim.py`** is a new dev-only suite, like `humblewood-verbatim`. It needs
  PyMuPDF and `_conversion-data/srd52/SRD_CC_v5.2.1.pdf`, and skips cleanly without them.
  - It extracts the PDF's text, normalises it (curly quotes, hyphenation at line ends, running
    heads, whitespace), and locates each SRD entry's section by its heading.
  - It compares the entry's converted text with the section, after the same normalisation.
  - Every difference must appear in `scripts/srd-corrections.json`, as either:
    - a **correction**, applied by the view (`{"entry": "Iron Flask", "find": "…", "replace": "…"}`);
      or
    - an **accepted difference**, with a reason (`{"entry": "…", "accept": "…", "why": "a table
      rendered as rows"}`).

  An unrecorded difference fails the suite, so the pack can't drift from the PDF unnoticed.
- **`scripts/srd-corrections.json`** is hand-authored and lives beside `overlay.json`. It is a
  converter input, not a pack. Every correction cites the PDF page it comes from.
- **The first pass is a review.** The plan generates the difference list. Corrections for the known
  stray names (Witch Bolt, Aasimar, the Iron Flask and Deck of Illusions creatures, Water Weird, Slaad
  Tadpole) and any other change of substance (a name, a number, a rule) are applied. Formatting-only
  differences are accepted. Mike confirms the list before the branch merges.

## 6. Output and registry

- **`data/srd52/`:** `backgrounds`, `classes`, `conditions`, `feats`, `features`, `glossary`,
  `items`, `items-magic`, `races`, `spells` and `tables`, each `.json`. Each has `"system": "SRD
  5.2"`, its SRD pack name, and `"excludeSystems": ["humblewood"]`. There is no `_note` and no
  `requires`.
- **`data/packs.json` gains:**

  ```json
  {"system": "SRD 5.2", "dir": "srd52", "file": "srd52_full.json",
   "title": "SRD 5.2 — System Reference Document", "version": null,
   "license": "CC-BY-4.0",
   "attribution": "This work includes material from the System Reference Document 5.2.1 (\"SRD 5.2.1\") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Changed: converted to Fieldbook's rules format, with renamed entries' references updated."}
  ```

  - The attribution's first two sentences are the PDF's required statement, verbatim (page 1 of
    SRD 5.2.1). Wizards asks for no other attribution to them; the "Changed" sentence is the change
    note CC-BY-4.0 asks for.
  - `version: null` until the 1.8.0 release gives it one. The bundle has no `dataVersion` until then.
  - The digest is seeded by `fbdata.py versions --seed` on the new folder only. The pack is new, so
    no older tree applies.
- **The archive** picks the pack up from the registry with no other change: `srd52_full.json` sits
  beside the others.

## 7. The app

- **`systemOf()`** (`src/js/52-race.js`) maps a source starting `srd` to `"dnd"` (R6).
- Nothing else changes. When the SRD and 2024 packs are both loaded, same-named entries show both
  sources, as any duplicate does (`dispName()`). The 2024 pack comes first in the archive, so
  existing characters keep resolving to it.

## 8. Tests

- **`src/tests/converter.py`**, on a synthetic mini dump in `src/tests/fixtures/5etools-mini/`.
  - **Its content:** invented entries in the dump's shape — flagged `true`, flagged with a rename,
    unflagged, an `inherits`-flagged variant, a `basicRules`-only 2014 entry, tags in mixed case,
    and a plural self-mention in a caption.
  - **Selection:** `srd` keeps exactly the flagged entries, applies every rename layer, and drops EFA.
  - **Corrections:** corrections apply, and an unknown `entry` in the corrections file fails loudly.
  - **The leak scan:** it fails on a planted name.
  - **Decision 1 and R4:** the dict prerequisite renders its `entry`; a rename-flagged item survives
    in `all`; the Paladin and Ranger menus carry their extra option.
- **`src/tests/rules-data.js`**, on the real `data/srd52`:
  - the counts in §1;
  - no record name or table name from the generated non-SRD list;
  - none of the 33 renamed originals;
  - no `{'` anywhere in either pack (the repr leak can't come back);
  - every homebrew `requires` name resolves with only SRD loaded;
  - R5's twin rule;
  - the SRD bundle agrees with `data/packs.json`.
- **`src/tests/srd-verbatim.py`** (§5), registered in `run.sh`. It skips cleanly without the PDF,
  so CI and other machines stay green.
- **Both byte-for-byte gates, in CLAUDE.md and the converter wiki:**

  ```bash
  python3 scripts/convert.py all _conversion-data/5etools-v2.36.1 -o /tmp/chk && diff -r /tmp/chk data/5e2024
  python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o /tmp/srd && diff -r /tmp/srd data/srd52
  ```

- **Screenshots, both skins:**
  - a D&D character built on SRD 5.2 alone (species, class, subclass, spells);
  - a Humblewood character, whose species list shows no SRD species;
  - Settings → Credits & licences showing the SRD attribution;
  - the Paladin Fighting Style choice with Blessed Warrior.

## 9. Milestones

1. **`srd_view()` and the `srd` command:** selection, renames, Book mode, `_run_core`, plus the
   fixture dump and the converter tests.
2. **Decision 1 and R4 in the shared pipeline:** regenerate `data/5e2024`, pin each difference,
   re-establish the gate.
3. **The leak scan and the generated non-SRD list.**
4. **`srd-verbatim`:** the PDF reader, the comparison, `srd-corrections.json`, and the first
   difference list for Mike to confirm.
5. **`data/srd52`, the registry entry, `systemOf()`, and the data tests.**
6. **Docs:**
   - wiki: converter (SRD mode, and the trap reversed: here the flag *is* the filter), a new
     `data/srd.md`, homebrew, rules-packs, testing, overview;
   - `docs/rules-schema.md`, README §3a and §10 (the SRD attribution);
   - CLAUDE.md (both gates, suite count);
   - the ledger and `UNRELEASED.md`.

## 10. Player-facing notes

- A new **SRD 5.2** rules pack: the D&D rules Wizards of the Coast publishes free under Creative
  Commons — 12 classes, 339 spells, 9 species, 4 backgrounds and over 470 magic items — in the rules
  data zip. It credits Wizards in Settings → Credits & licences, as the licence asks.
- The 2024 pack gains Carrion Crawler Mucus and Lolth's Sting, which were missing.
- The Warlock invocations Agonizing Blast, Eldritch Spear and Repelling Blast show their
  prerequisite properly, instead of a line of code.
- A Paladin choosing a Fighting Style can take Blessed Warrior, and a Ranger Druidic Warrior.

## 11. Out of scope

- **#85:** moving the copyrighted packs out; repointing homebrew's `requires` chip text; the data
  kit's `build --srd`.
- **SRD content outside the converter's categories** (monsters, magic-item crafting rules, the game
  rules chapters beyond the glossary). Fieldbook has no place for them.
