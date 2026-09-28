# Testing

`./src/tests/run.sh` runs seven suites: plain Node and Python asserting against the real source, with
no framework, no dependencies and no browser. The JS suites load the app exactly as the build
concatenates it, which is itself the guard against a top-level ordering bug. One suite turns claims in
the docs into assertions. The rest of this page is the list of ways a check has passed while the
thing it checked was broken, because in this repo that has happened often enough to be the main
lesson.

**Code:** `src/tests/run.sh`, `src/tests/harness.js`; the app's `blankChar()` in `00-constants.js`
and `APP_VERSION` in `30-version.js` (the TDZ pair); `90-boot.js` (left out of the harness) ·
**Tests:** `converter.py`, `tables.js`, `rules-data.js`, `sheet.js`, `char-update.js`, `docs.js`,
`humblewood-verbatim.py` · **See also:** [Building & CI](building-and-ci.md),
[Screenshot QA](screenshot-qa.md), [Rules-update tool](../features/rules-update-tool.md),
[Build & source split](../architecture/build-and-source-split.md)

## How it works

### Running

```bash
./src/tests/run.sh           # every suite
./src/tests/run.sh tables    # only suites whose name contains "tables"
```

`run.sh` changes to the repo root, **always** rebundles (`node scripts/bundle-rules.js`) and picks a
Python by running it (`"$PY" -c ''`, with `python3` falling back to `python`). It then runs each name in
its `SUITES` line (`.py` if one exists, else `.js`) and reads **each suite's last line**:
`ALL PASSED (n)`, `FAILURES: …`, or `SKIP - reason`. It prints per-suite counts and a total, and exits
non-zero if any suite failed or if the filter matched nothing. CI, `pre-push`, `release.yml` and
`./dev.sh` item 4 all call it.

It touches no tracked file (the bundles it writes are gitignored), so it is safe to run unprompted.
`rules-data.js` needs a `dist/fieldbook.html` whose markup matches `src/html` (see Rules), so run
it after a build.

### The suites

| Suite | What it guards |
|---|---|
| `converter.py` | `scripts/convert.py` on real-shaped fixtures: table extraction and naming, the XPHB selection with its free-subset backfill, races, supplement source selection, the `_copy` subclass dedupe, optional features, cross-pack table-name collisions, option pickers from `optionalfeatureProgression`, option costs, subclass resources, Student of War |
| `tables.js` | `tableHTML()` structure and escaping, the `[Table: X]` anchor pass through `highlight()`, the tables rules category, `migrate()` round-trip, the shipped-table defects (non-empty `cols`, no `_` keys, row widths, unique names, owners), and `noteHTML()`, whose safety argument is that pipeline |
| `rules-data.js` | Species filtering by system and `excludeSystems`, missing-dependency reporting, the rules cache never failing silently and its LZW fallback, Settings bucketing and clear-all, **the bundle round-trip** (a bundle equals importing each file), supplement packs, `DATA_VERSIONS` staleness. It also holds the markup guards: the note registry, the tab bar, every `getElementById` target existing app-wide, the Vitals structure, every Settings control still wired, the combat tab, and the byte-pin of `src/html` against the built file |
| `sheet.js` | The pure functions the sheet leans on: signed coin/HP entry, temp HP, weight and encumbrance, size, origins, "choose N" budgets, stat layouts, feature grouping and the feat picker, dice expressions, item uses, spell allotments, rich text, emblems, attack damage strings, armor and AC, concentration, the combat view's pure helpers, modal focus |
| `char-update.js` | The version stamp and the rules-update tool: fingerprints, diff classification, apply keeping character-local state, backups, gating, the R1–R5 regressions; plus level-1 HP seeding, the level-up HP step, option pickers, resource dice, starting-equipment grants |
| `docs.js` | Doc claims as assertions (below) |
| `humblewood-verbatim.py` | Humblewood core prose is word-for-word the book; Gadgeteer prose too. Needs `.venv` (pymupdf) and the source PDF; **prints `SKIP` and exits 0 without them** |

`humblewood-verbatim` runs under whichever `python3` is first on `PATH`. So even on a machine that has
`.venv` it skips unless the venv is activated, or you run it directly:
`.venv/bin/python src/tests/humblewood-verbatim.py`. Do that after any change to the extractor.

### The harness

`harness.js` gives the JS suites three things.

- **`loadApp`** concatenates every `src/js` fragment **in `src/manifest.json` order, minus
  `90-boot.js`** (which calls `boot()` at load) and evaluates the result in a `vm` context. The DOM is
  a no-op proxy. `localStorage` is real, with a quota switch so the "storage refused" path can be
  reached, and `confirm` is scriptable. Top-level `let`/`const` are not context properties, so a
  suite names what it needs and gets it back on one object. `rules`, `character`, `activeId` and
  `updateAvailable` get accessors, so they can be written.
- **`loadHTML`** assembles the page body the way the build does: `src/html` fragments joined with
  `""` and **spliced** into the template at `<!--@@HTML@@-->`.
- **`makeCheck`** is the whole assertion library. It prints `PASS`/`FAIL` per check, and `done`
  prints the last line `run.sh` parses and sets the exit code.

### The docs suite

`docs.js` checks facts, not wording, so rewriting a paragraph never breaks it. It asserts:

- the fragment counts quoted in CLAUDE.md and ADR-001 against `manifest.json`, and one tab panel per
  `src/html` fragment;
- CLAUDE.md's "across N suites" against `run.sh`'s `SUITES`, and that every suite file on disk is
  registered there;
- that no doc names a pre-reorganisation data filename, and that README names the two core packs;
- that no pending `UNRELEASED.md` bullet or changelog line holds an angle-bracket tag (GitHub eats
  it), and that no pending bullet hard-codes a version;
- that every `docs/*.md` on disk passes `build.sh`'s allowlist, and that `LICENSE` ships and is
  listed;
- that `DATA_VERSIONS` parses, holds `X.Y.Z` values, and maps every system to a `SYSTEM_DIRS` entry
  in `release.js`;
- that the icon map is parity-checked against the generated `05-icons.js`, covers every shipped
  class, ancestry and background, and carries the CC BY 3.0 credits in README and in `88-settings.js`;
- for the wiki: every page is listed in `index.md`, every link resolves, there are no wikilinks,
  every cited function and fragment exists, and every JS fragment is cited by some page and named in
  the overview's code map. This is the lint from the
  [wiki spec](../../specs/2026-09-28-living-wiki-design.md) §7, and it was being added while this page
  was written.

### Throwaway checks

For a pure function you are changing, CLAUDE.md asks for a quick Node check in the scratchpad, run
unprompted. `require('./src/tests/harness').loadApp([...])` gives you the real function in a few
lines. When a check guards something that should stay true, move it into a suite: every throwaway
written before `src/tests/` existed was lost along with its scratchpad.

## Rules that must hold

- **The harness evaluates the real concatenation, in manifest order.** This is the boot-order guard.
  `00-constants.js` runs `let character=blankChar()` at top level before `30-version.js` defines
  `APP_VERSION`, so `blankChar()` referencing `APP_VERSION` would white-screen the app. Evaluating the
  real order catches it. Never turn this into per-fragment `require`s.
- **`loadHTML` re-implements the splice rather than calling the builder.** `build-html.js` builds and
  exits at require time. A test that used the builder's own splice could never catch the
  builder splicing wrongly. One assertion in `rules-data.js` pins the two together: the assembled
  markup must appear byte for byte in `dist/fieldbook.html`. That is also why the suite needs a
  current artifact, and why the tests live in `pre-push` and not `pre-commit`.
- **Splice, don't append.** Guards slice the body by position. Panels appended after the shell would
  sit outside `.page` and turn them into tautologies that still pass.
- **Every suite ends with `ALL PASSED (n)`, `FAILURES: …` or `SKIP - …`,** prints its own total, is
  listed in `SUITES`, and is counted in CLAUDE.md. `docs.js` enforces the last two.
- **Suites live under `src/tests/`,** so the zip guard's `^src/` keeps them out of the player bundle.
  They are not fragments: `validateOrder()` reads `src/js`, `src/css` and `src/html` without recursing.
- **A new guard must be seen to fail.** Revert the thing it guards and watch it go red before
  trusting it.

## Traps

- **Fixtures that idealise the app hide its bugs.** The first rules-update suite built copies by hand
  (`copy.description = def.description`), and no copy site in the app does that. Five real bugs sat
  behind that one shortcut. Fixtures now build copies the way `browseItems`, `grantItemByName()`,
  `browseSpells` and `grantFeatDef()` do.
- **A fixture can mirror the bug faithfully.** `grantItemByName()` had no tests, and the char-update
  fixture copied its buggy shape closely enough to hide it for a release. Tests now call the real
  function. `invSection()` had no tests at all when it mis-filed items.
- **Counting `PASS` with grep counted `ALL PASSED` too,** one phantom check per suite (231 reported,
  227 real). Suites now print their own totals.
- **A runner that cannot go red is worth nothing.** It was proven once by breaking `fpNorm()`'s
  whitespace collapse. Note that `run.sh`'s closing "All N suites passed" counts a **skipped** suite as
  run.
- **The checker read the page differently from the extractor.** A plain `get_text` interleaves two
  columns and keeps page furniture, so correct text looked wrong. A page number the extractor leaked
  was invisible because both sides contained "38". The reference must be assembled the way the
  extractor reads the page.
- **The checker didn't look where the data was.** A walker over `description` skipped all 44 spells,
  which store `text`, and assuming `levels` is a list skipped every class feature. It is a dict. The
  defect looked half its real size. A measurement that finds fewer problems than expected is a reason
  to check the measurement.
- **Right size, wrong pixels.** A table with exactly six rows numbered 1–6 still carried words bled in
  from the neighbouring column. Row counts are not proof. The builder now checks die faces and
  neighbour bleed.
- **Stale inputs pass.** `run.sh` once rebundled only when a bundle was missing, so a stale pack passed
  the round-trip after `data/` gained a category. It always rebundles now.
- **Shape guards encode nesting.** Slicing to "the next `<div class="card"`" broke whenever a block
  moved. The `block` helper counts `<div>`/`</div>`, and it **throws** on unbalanced markup. It used to
  return the rest of the file, which made every `.includes` check against it true.
- **A guard can check the wrong half.** One confirmed a CSS rule existed but not that the panel wore
  the class. Mutation-testing the guards found it.
- **Invisible to every test: `columns` instead of `cols`.** Sixteen tables shipped headerless while the
  JSON looked right. `tables.js` asserts `cols` on every shipped table now.
- **Green units, broken saved sheets.** A damage-detection rule passed every unit test and worked on a
  fresh character, but sheets saved before the change kept their damage-less spell rows. Only browser
  QA showed it. Test against data that predates the change.
- **A test that fails on a legitimate state is worse than none.** `docs.js` once demanded pending
  bullets and went red the moment a release emptied the notebook.
- **`command -v python3` lies on Windows.** The Microsoft Store stub resolves, then exits non-zero with
  "Python was not found", which failed both Python suites on a machine with a working `python`.
  `run.sh` probes by running it.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Framework | None: plain node and python3 with a small recorder | — |
| How suites load the app | The real concatenation in manifest order, in a `vm` | Per-fragment `require`: loses the TDZ guard |
| How suites get the markup | An independent splice in `harness.js`, pinned to the artifact by one assertion | Calling `build-html.js`: it exits at require time, and could never catch its own splice bug |
| Where tests live | `src/tests/`, where the audience rule keeps them out of the zip | Scratchpad throwaways: they vanished, and CI covered no logic |
| How checks are counted | Each suite prints its total; `run.sh` sums them | `grep -c PASS`: it matched the summary lines |
| When bundles are rebuilt | On every run | Only when missing: a stale bundle passed the round-trip |
| The PDF-dependent suite in CI | Skips cleanly without `.venv` or the PDF | — |
| Finding Python | Run it | `command -v`: the Windows Store stub |
| What `docs.js` checks | Mechanically checkable facts | A prose linter: rewording would break it (a blank-line-before-heading check was declined on the same grounds) |

## History

- 2026-08-10 — Five bugs found by probing the finished rules-update tool; fixtures now copy as the app does. → ledger L772
- 2026-08-10 — Suites move from the scratchpad into `src/tests/`, with `harness.js`, self-reported counts and `run.sh`. → ledger L846
- 2026-08-10 — Two verbatim-checker bugs; `humblewood-verbatim` added, skipping cleanly; `run.sh` always rebundles. → ledger L972
- 2026-08-10 — A third measurement bug: the walker skipped spells' `text` and dict-shaped `levels`. → ledger L1030
- 2026-08-10 — Table builder checks die faces and neighbour bleed, not just row counts. → ledger L1103
- 2026-08-10 — `docs.js` added; `tables.js` asserts `cols` and no `_` keys on shipped tables. → ledger L1232
- 2026-08-11 — `invSection()` and `grantItemByName()` get tests that call the real functions. → ledger L1467
- 2026-08-14 — Vitals guards rebuilt on `block`; every new guard mutation-tested. → ledger L2227
- 2026-08-17 — `loadHTML` splices the markup; `block` throws on unbalanced markup; the byte-pin assertion. → ledger L2592
- 2026-08-18 — Saved sheets kept damage-less spell rows that only browser QA caught. → ledger L2989
- 2026-08-18 — `run.sh` probes Python by running it, fixing both Python suites on Windows. → ledger L3246
