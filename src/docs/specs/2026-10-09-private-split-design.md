# The private data split and the data kit — design

**Status:** proposed · 2026-10-09
**Issue:** #85, part 3 of #82. Part 1 (#83, the data archive) and part 2 (#84, the SRD 5.2 pack) are
merged. This merge also closes #82.
**Branch:** `issue/85-private-data-split-public-srd-homebrew-a`

---

## 1. What it is

After this change, the public repository and its releases carry only rules data that may be shared:
**SRD 5.2** (CC-BY-4.0) and **homebrew** (CC-BY-SA-3.0).

- The copyrighted packs move to the existing private repository `wardmanm/RPGFieldbookPrivate` and
  are released from there, privately: the full 2024 pack (XPHB), Xanathar's (XGE), Tasha's (TCE)
  and Humblewood. The Humblewood extractor, its PDF suite and its playtest notes go with them.
- Anyone can build their own archive from a 5e-tools export with a new **data kit**: `fbdata.py`
  and the converter, attached to every app release.
- The old releases' copyrighted assets are deleted, and a full history purge is written up for 2.0.

Nothing changes for an existing player's characters or loaded rules: packs already in the app stay
loaded and keep working.

## 2. Decisions

From the #82 planning (Mike, 2026-10-07):

- The copyrighted data lives in `wardmanm/RPGFieldbookPrivate` and is released privately.
- It is removed from public `main` now. The history purge is logged for 2.0.
- The old releases' pack assets are deleted when the split lands.
- The kit is `tools/data-kit/fbdata.py` (Python stdlib), attached to app releases.
- App releases attach `fieldbook.html`, the app zip (with the data archive inside), the data archive
  and the kit.

From this spec (Mike, 2026-10-09):

| # | Question | Decision |
|---|---|---|
| 1 | The PHB's 14 one-line class summaries hard-coded in `convert.py` (`CLASS_BLURB`) | **Rewrite them in Fieldbook's own words.** The XPHB pack uses the new wording; the SRD pack stays blank |
| 2 | Book quotes in dev-only files that stay public (the ammunition plan's 19 pasted entries, short quotes in the log, wiki and playtest notes) | **Redact in place**, keeping the line count so the log's line citations hold: a one-time exception to the log's append-only rule |
| 3 | A shipped changelog entry quoting a 10-word Xanathar's footnote | **Leave it.** The leak scanner allowlists that one span |
| 4 | Releases | **None until Mike says**, whatever happens with #85. 1.8.0 holds more issues |

**Rulings this spec makes, for review:**

| # | Ruling | Why |
|---|---|---|
| R1 | **Order: the private repo holds the data (pushed) before public `main` loses it.** The public removal is **one commit** that carries everything depending on the data: the suite list, the registry, the tests, the wiki links. Old release assets are deleted last | No commit on `main` may fail CI, and no step may leave the data in neither place |
| R2 | **The private repo mirrors the public paths:** `data/<dir>/`, its own `data/packs.json`, `scripts/extract-humblewood.py`, `tests/`, a `README.md` | The kit's `--registry`/`--data-root` and the same `convert.py` commands then work unchanged against it |
| R3 | **The public registry drops XPHB, Humblewood, XGE and TCE in the removal commit**; the private registry starts with those four entries, versions and digests carried over | Installed apps read the public `data/packs.json` live (`checkForDataUpdate()`). An entry left behind would show its players an update notice that can never resolve |
| R4 | **Private releases are data-only releases in the existing scheme:** `scripts/data-release.js --registry <f> --data-root <d>` bumps changed private packs to `<APP_VERSION>-N` and prints the tag (`data-vX.Y.Z-N`) for the private repo. The asset is `fieldbook-data-private-<ver>.zip` | `X.Y.Z-N` already means "the Nth data-only release after app X.Y.Z". No app release ever bumps a private pack, so no second scheme is needed |
| R5 | **The app shows a quiet `vX` chip for a pack its build has no version baseline for:** no "update available" alarm and no notice | Private packs, and a v1.7.2 player's old XPHB/Humblewood/XGE/TCE packs, are not in the new `DATA_VERSIONS`. Today they would show no version at all. The #82 plan promised the quiet chip |
| R6 | **`CLASS_BLURB` is rewritten (decision 1), and SRD mode sets no blurb in code.** The 12 corrections in `scripts/srd-corrections.json` that blank the PHB blurbs are removed with it | `data/srd52` stays byte-identical, and the corrections file stops quoting the PHB lines |
| R7 | **Shipped text loses its book quotes:** the Bard line in `downloadRulesTemplates()` (it ships inside `fieldbook.html`), `docs/README-converter.md`'s spell-save line and `docs/rules-schema.md`'s Wild Magic row become Fieldbook's own invented examples | These ship to every player, whatever packs they load |
| R8 | **`srd-corrections.json`'s `find` strings stay, allowlisted** | They are the shortest spans of the 5e-tools wording that identify what to correct into the SRD's wording, and they are useless without the dump. This is the one place public files quote the 2024 book on purpose. **For Mike to confirm** |
| R9 | **The leak scanner lives in the private repo**, since it needs the private text. Runs of 14 words or more shared with the private packs (and not with SRD or homebrew) fail; runs of 10 are reported. An allowlist entry is `{file, hash of the run, why}`. It runs in Mike's local suite and in private CI against public `main` | A prototype found every real leak at 14 words, with no formulaic false positives. Hashes keep the allowlist from being a second copy of the text |
| R10 | **Public tests keep their logic and lose their book content.** Assertions about the four packs move to the private tests. Logic tests that read a pack entry use the SRD entry where the SRD has one, and an invented fixture otherwise. `converter.py`'s book-prose inputs become invented text. The 2024 byte gate and the SRD/2024 twin checks move private | The public suites must pass with no private data present, and must not carry book text |
| R11 | **The bundler moves to Python** (`fbdata.py bundle`) behind a parity test against `bundle-rules.js` over every pack; then `build.sh` switches and `bundle-rules.js` is removed. `build.sh --no-zip` then needs `python3` | Kit users have Python, not Node. The parity test is what makes the switch safe |
| R12 | **The kit is one flat zip** (`fieldbook-data-kit-<ver>.zip`). `fbdata.py` finds `convert.py` beside itself or in the repo's `scripts/`, and passes `--overlay`, `--resources` and `--corrections` explicitly. The app zip drops `scripts/` | This also fixes `convert.py`'s helper lookup, which misses its overlay files in the zip layout |
| R13 | **Public releases carry only allowlisted licences:** `fbdata.py validate --public` refuses a pack whose licence is not CC-BY-4.0, CC-BY-SA-3.0 or MIT. Both release workflows run it and refuse any asset whose name contains `private` | A mistake here republishes what this change removes |
| R14 | **Homebrew's `requires`:** the D&D group becomes `{pack: "SRD 5.2", file: "srd52_full.json"}`; the XGE group keeps its pack name and drops `file`, so its chip reads "from Xanathar's Guide to Everything" | Every name in the D&D group is in the SRD (#84's R7 test). The XGE spells are not, and no public file provides them |
| R15 | **The private repo is created from public history** with `git filter-repo` over the paths that move, run on a fresh local clone, before its first push | It keeps the data's and the extractor's history and blame, which the 2.0 purge would otherwise erase |
| R16 | **Mike's checkout links the private clone** as the gitignored `_private-data` (→ `../RPGFieldbookPrivate`); `scripts/wt.sh` links it into worktrees beside `.venv` and `_conversion-data` | His local runs, hooks and converter menu keep full coverage; CI and other clones simply skip |

## 3. The private repository

```
RPGFieldbookPrivate/
  README.md                       from wiki data/humblewood.md + how this repo works with the public one
  data/packs.json                 XPHB, Humblewood, XGE, TCE: versions, digests, release
  data/5e2024/ xanathars/ tashas/ humblewood/
  scripts/extract-humblewood.py
  tests/run.sh                    the private suites, run against a public checkout
  tests/humblewood-verbatim.py
  tests/private-data.js           the four packs' content checks, moved from the public suites
  tests/leak-scan.py              R9
  tests/leak-allowlist.json
  docs/HUMBLEWOOD-PLAYTESTS.md    moved from src/docs/_claude/
  .github/workflows/ci.yml        checks out public main beside it; runs tests/run.sh
  .github/workflows/data-release.yml
```

- **`tests/run.sh`** takes the public checkout's path (`$FIELDBOOK`, default `..` when run through
  `_private-data`). It runs the moved content checks with the public harness, the 2024 byte gate
  (when the dump is present), `humblewood-verbatim` (when PyMuPDF and the PDFs are present) and the
  leak scan.
- **CI** runs on push, and nightly against public `main`, so a leak introduced publicly is caught
  within a day even when the private repo is idle.
- **`data-release.yml`**, on a `data-v*` tag:
  - checks the tag against the private registry's `release`;
  - runs the private tests;
  - bundles with the public kit and packs `fieldbook-data-private-<ver>.zip`;
  - validates it, then publishes a private release (`--latest=false` is moot in a private repo; it
    is set anyway).
- **The data's versions** carry over (XPHB 1.7.2, Humblewood 1.7.1, XGE 1.7.2, TCE 1.7.2). The XPHB
  digest moves with this change (the #84 fixes and the new blurbs), so its first private release
  will be `1.8.0-1`.

## 4. The public repository after the split

**Leaves:** `data/5e2024/`, `data/xanathars/`, `data/tashas/`, `data/humblewood/`,
`scripts/extract-humblewood.py`, `src/tests/humblewood-verbatim.py`,
`src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md`, wiki `data/humblewood.md`.

**Stays:**
- `scripts/convert.py` with its `all` and `supplement` code. The converter is ours; its prose,
  after decision 1, is too.
- `data/overlay.json`, `data/class-resources.json`, `src/icons/icons.json`. The scan found no book
  text in them.
- `data/srd52/`, `data/homebrew/`, `scripts/srd-corrections.json`, `scripts/srd_text.py`, the kit.

**The removal commit (R1) also:**
- removes the four entries from `data/packs.json` (R3);
- removes `humblewood-verbatim` from `src/tests/run.sh` and adds the `private-data` suite (§7), so
  the count stays ten;
- moves the four packs' content assertions out of `rules-data.js`, `tables.js`, `sheet.js` and
  `char-update.js` (prepared in an earlier commit; §7);
- fixes the wiki index's links to the moved pages, and trims `docs.js`'s icon-coverage folder list;
- updates `dev.sh`'s converter menu: SRD → `data/srd52`; XPHB, XGE and TCE → `_private-data/data/…`,
  offered only when `_private-data` exists. The Humblewood extraction runs from the private repo.

**Text clean-up** (from the scan; §6) lands before the removal, so the leak scanner can run green on
the day it starts.

## 5. The data kit

**`tools/data-kit/fbdata.py`** gains:

| Command | What it does |
|---|---|
| `bundle <data-root> -o <dir> [--registry F]` | The Python port of `bundle-rules.js` (R11): one `<file>` per registered pack, byte-identical to the Node output |
| `convert ...` | Runs `convert.py` with the kit's own overlay, resources and corrections paths filled in (R12) |
| `build <src> [--srd \| --full \| --book XGE\|TCE] -o OUT.zip` | One command, from a 5e-tools dump, a folder of packs or a single pack file: convert, bundle, stamp the versions a `--registry` gives (none otherwise; R5 shows such a pack quietly), pack, validate |
| `validate OUT.zip --public` | Adds the licence allowlist (R13) |

- **`--full`** builds the 2024 pack (`all`), **`--book`** a supplement, and **`--srd`** (the default)
  the SRD pack.
- Its output is an archive Fieldbook opens as it is. **The kit never publishes**: it writes a local
  zip.

**The kit zip `fieldbook-data-kit-<ver>.zip`** holds, flat:
- `fbdata.py`, `convert.py`, `overlay.json`, `class-resources.json`, `srd-corrections.json`;
- `README.md` (the kit's own: install, the three `build` recipes, what you may share);
- `README-converter.md`, `rules-schema.md`, `LICENSE`;
- `example-pack/`: a small invented pack showing every category.

`build.sh` builds the kit zip with its own allowlist guard; `release.yml` attaches it. The app zip
drops `scripts/`, and README §9 points to the kit instead.

**Parity before the switch:** a test bundles every pack with both bundlers and compares bytes. It
covers the public packs in CI, all packs locally through `_private-data`, and synthetic cases:
duplicates, nameless entries, `excludeSystems` and `requires` disagreements, an empty folder. Only
when it passes does `build.sh` call `fbdata.py bundle`, and `bundle-rules.js` and its test are
removed.

## 6. Copyrighted text in public files

A prototype scan of every tracked file against the private packs' text (14-word runs not found in
SRD or homebrew) found:

| Where | What | Change |
|---|---|---|
| `scripts/convert.py` `CLASS_BLURB` | 14 PHB class-table lines | Rewritten (decision 1, R6) |
| `src/js/89-rules-merge.js` `downloadRulesTemplates()` | The PHB Bard line, shipping in `fieldbook.html` | Our own line (R7) |
| `docs/README-converter.md`, `docs/rules-schema.md` | A spell-save sentence; a Wild Magic table row | Invented examples (R7) |
| `src/js/30-version.js` `CHANGELOG` → `docs/CHANGELOG.md` | A 10-word Xanathar's footnote | Allowlisted (decision 3) |
| `scripts/srd-corrections.json` | 5e-tools wording being corrected into the SRD's | The blurb corrections go (R6); the rest is allowlisted (R8) |
| `src/tests/converter.py` | About 113 entries' worth of quoted inputs (XGE, TCE, Mystic, 2024) | Invented text (R10) |
| `src/tests/rules-data.js`, `tables.js`, `sheet.js` | Quoted expectations | Move private, or invented fixtures (R10) |
| `src/docs/plans/2026-10-02-ammo.md` | 19 pasted 5e-tools entries | Each becomes `[5e-tools entry: <name>]` (decision 2) |
| Ledger, wiki (`converter`, `supplements`, `known-issues`) | Short quotes | Paraphrased in place, same line count (decision 2) |

- **Fighting Style summaries in `FIGHTING_STYLES` are Fieldbook's own** and stay. Only the option
  names come from the book.
- **Humblewood proper nouns** (ancestry and class names) stay in the icon map, the changelog and the
  tests: names are not the protected text.

## 7. Tests

| Suite | After |
|---|---|
| `converter` | Book-prose inputs replaced by invented text (same structure, same assertions on behaviour). The `all` byte gate is private |
| `rules-data` | Generic checks (bundling, `excludeSystems`, `requires`, dedupe, anchors, the SRD checks) run on `srd52` and `homebrew`. The four packs' counts, entries and twin-table checks move to the private `tests/private-data.js` |
| `tables` | SRD-coverable class-table checks repoint to `srd52`; the XGE footnote checks move private, and an invented fixture keeps the footnote logic covered |
| `sheet`, `char-update` | Item and class regressions use the SRD entry where the SRD has it (Staff of Power, Dragon Scale Mail, the core classes) and an invented fixture where it doesn't (Moon Sickle) |
| `docs` | The icon-coverage folders shrink to the public packs; new checks: README §9/§10 name the kit and the SRD statement; no public wiki page links a moved page |
| `data-kit` | Gains `bundle` parity (R11), `build` on the mini dump, `validate --public` refusing a bad licence |
| `humblewood-verbatim` | Leaves (private) |
| **`private-data`** (new) | Runs `_private-data/tests/run.sh` with this checkout when `_private-data` exists; otherwise `SKIP (no _private-data)` |

The count stays **ten**. CI never has `_private-data`, so it runs nine suites and skips one.

## 8. The app

- **Quiet version chip (R5):** `dataStatus()` gets a state for a pack with a valid `dataVersion`
  but no baseline: `dataStatusHTML()` shows `vX` with the title "This pack's version.", the same chip
  `current` shows, minus the claim that it is up to date.
- **`downloadRulesTemplates()`:** the Bard sample gets an invented line (R7).
- **Homebrew** (R14) is a data change; the app already renders a `requires` group without a file as
  "from <pack>".
- **Nothing else changes.** `checkForDataUpdate()` reads the public registry, which after R3 lists
  only public packs. Private packs get no notice; Mike knows when he has cut one.

## 9. Mike's workflow afterwards

1. **One-time setup:** clone `RPGFieldbookPrivate` to `../RPGFieldbookPrivate`, then
   `ln -s ../RPGFieldbookPrivate _private-data` in the main checkout (gitignored).
2. **Tests:** `./src/tests/run.sh` runs everything, with private coverage through the `private-data`
   suite.
3. **Converting:**
   - `./dev.sh`'s converter menu writes SRD to `data/srd52`, and XPHB, XGE and TCE to
     `_private-data/data/…`;
   - the 2024 byte gate becomes
     `diff -r /tmp/chk _private-data/data/5e2024`;
   - Humblewood extraction runs in the private repo.
4. **His own archive:** `fbdata.py build _private-data/data -o mine.zip`, or a private data release.
   He imports it alone or alongside the public archive.
5. **Releasing:** the public app and data releases are unchanged, still his alone. Private data
   releases are `node scripts/data-release.js --registry _private-data/data/packs.json --data-root
   _private-data/data`, then commit and tag in the private repo. `RELEASING.md` gains the procedure.

## 10. Old releases and the 2.0 purge

- **Delete**, with Mike's go-ahead, from v1.3.0 to v1.7.2:
  - every `*_full.json`;
  - every `fieldbook-v*.zip` (each carries the packs);
  - `fieldbook-v1.3.0-source.zip`.

  `fieldbook.html` stays: it holds no rules data.
- **What deleting the assets cannot do:** GitHub generates "Source code" archives from each tag on
  request, so the data stays reachable through them, and through public history, until the 2.0
  purge.
- **`roadmap/2.0.md` gains the purge plan:**
  - every data path in both layouts, plus the extractor, its suite, the playtest notes and the
    quoted test inputs;
  - `git filter-repo` over all of it;
  - force-pushed `main`, then re-created tags and re-published releases;
  - what cannot be recalled: forks, clones, caches and archived copies.

## 11. Milestones

1. **Kit and bundler** (§5): Python `bundle` with the parity test, `build`, `convert`,
   `validate --public`, `build.sh`'s switch, `bundle-rules.js` removed, the kit zip, the app zip
   without `scripts/`, the release workflows' asset list and licence guard.
2. **Public text** (§6): `CLASS_BLURB` rewritten (regenerate `data/5e2024`; `data/srd52` byte-identical;
   the 12 blurb corrections removed); the Bard line; the doc examples; `converter.py`'s invented
   inputs; dev-doc redaction.
3. **The app** (§8): the quiet chip; homebrew `requires`.
4. **Test split** (§7): public tests repointed or given fixtures; the private assertions collected
   into a staging tree that becomes the private `tests/`.
5. **The private repo** (§3), assembled locally at `../RPGFieldbookPrivate` by `git filter-repo`
   (R15): data, registry, extractor, tests, leak scanner and allowlist, CI, data-release workflow,
   README. Green locally against this worktree through `_private-data`. The `private-data` suite,
   `wt.sh` and `dev.sh` wiring.
6. **The removal commit** (§4): public suites green with no private data; private suites green
   through `_private-data`; the leak scan clean.
7. **Docs:**
   - README §3a, §9, §10, `docs/README-converter.md`, `docs/rules-schema.md`, `CLAUDE.md`,
     `RELEASING.md`;
   - the wiki: new `data/private-data.md` and `data/data-kit.md`; `converter`, `supplements`,
     `homebrew`, `rules-packs`, `data-archive`, `settings-and-updates`, `building-and-ci`,
     `testing`, `known-issues`, `overview`, `index`, `decisions`, and `roadmap/2.0` (the purge);
   - the ledger and `UNRELEASED.md`.

**At the finish, each step on Mike's go-ahead:**
1. The first push to `RPGFieldbookPrivate`, then confirm its CI.
2. Merge and push public `main` (`Closes #85, closes #82`).
3. Delete the old release assets.

## 12. Player-facing notes

- The rules data zip now holds the SRD 5.2 and homebrew packs. The D&D 2024 books, Xanathar's,
  Tasha's and Humblewood packs are no longer distributed; packs you have already loaded keep working.
- A new data kit lets you build your own rules data zip from a 5e-tools export, in one command.
- Packs this version of Fieldbook doesn't know show their version quietly instead of nothing.
- The homebrew pack's "needs" note points to the SRD 5.2 pack.

## 13. Out of scope

- **The history purge itself** (2.0, §10).
- **Changing the default system for new characters.** `blankChar()` defaults to `"humblewood"`. With
  no public Humblewood data, a D&D default may suit new players better. This is Mike's call, as a
  separate issue.
- **Update notices for private packs.**
- **Re-deriving `FIGHTING_STYLES` names, or the Humblewood names in the icon map.**
