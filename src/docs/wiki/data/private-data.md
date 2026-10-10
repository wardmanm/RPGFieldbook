# Private data

The public repository and its releases carry only rules data that may be shared: **SRD 5.2**
(CC-BY-4.0) and **homebrew** (CC-BY-SA-3.0). The copyrighted packs, the full D&D 2024 pack (XPHB),
Xanathar's (XGE), Tasha's (TCE) and Humblewood, carry the books' own words and no open licence, so
they live in a private repository, `wardmanm/RPGFieldbookPrivate`, and are released only there. Its
tests run against a public checkout, and its leak scan keeps the books' text out of the public repo.
Nothing changed for a player's characters or loaded packs; anyone else builds their own packs with
the [data kit](data-kit.md). This page is how the two repositories work together. The private
repo's own guide is its `README.md`, and this page agrees with it.

**Code:** `bundle()`, `cmd_build()`, `validate_archive()` in `tools/data-kit/fbdata.py`;
`dataStatus()` in `88-settings.js`; `scripts/data-release.js`, `scripts/wt.sh`, `dev.sh` (the
converter menu), `src/tests/private-data.js` · **Data:** `data/packs.json` (public: SRD 5.2 and
Homebrew); the private repo's `data/packs.json` (XPHB, Humblewood, XGE, TCE) · **Tests:**
`private-data.js` (runs the private suites), `docs.js` (no public test reads a private pack),
`data-kit.py` (`data-release.js` against another registry; the `private-data` suite's three outcomes)
· **See also:** [Data kit](data-kit.md), [Data archive](../architecture/data-archive.md),
[Testing](../process/testing.md), [Supplements](supplements.md), [Converter](converter.md),
[RELEASING](../../RELEASING.md), [2.0](../roadmap/2.0.md) (the history purge),
[the spec](../../specs/2026-10-09-private-split-design.md)

## How it works

### The split, and why

A pack's text is the book's when it comes from the book: 5e-tools copies the published prose, and the
converter keeps it. SRD 5.2 is the part of D&D that Wizards of the Coast publishes under CC-BY-4.0, and
The Predator is CC-BY-SA-3.0, so those two may be shared and carry their credit (see
[SRD 5.2](srd.md), [Homebrew](homebrew.md)). The other four may not. Since #85 the public repo holds:

- `data/srd52/` and `data/homebrew/`, the only folders `data/packs.json` registers;
- the converter, `scripts/convert.py`, with its `all` and `supplement` code: the code is Fieldbook's,
  and so is its prose since the class one-liners were rewritten (spec decision 1);
- the hand-authored inputs (`data/overlay.json`, `data/class-resources.json`,
  `scripts/srd-corrections.json`), the icon map and the kit.

The private repo holds the four packs, the Humblewood extractor and its PDF suite, the tests that
read those packs, and the leak scan. Packs players already loaded keep working: the app changed only
to show such a pack's version quietly (the `known` state of `dataStatus()`; see
[Settings & updates](../features/settings-and-updates.md)).

### The private repo

Its paths mirror the public ones, so the kit's `--registry` and `--data-root` options and the same
`convert.py` commands work against it unchanged (spec R2):

```
README.md                      how the repo works with the public one; the leak-scan rules
data/packs.json                the registry: XPHB, Humblewood, XGE, TCE (versions, digests, release)
data/5e2024/ xanathars/ tashas/ humblewood/
scripts/extract-humblewood.py  the Humblewood PDFs to rules data (needs PyMuPDF)
tests/run.sh                   every private suite, run against a public checkout
tests/private-data.js          the four packs' content checks, on the public test harness
tests/gate-2024.py             data/5e2024 reproduces byte for byte from the 5e-tools dump
tests/humblewood-verbatim.py   the Humblewood prose matches the book
tests/leak-scan.py             no public file carries the private text
tests/leak-allowlist.json      the reviewed exceptions: file, hash and reason, never text
docs/humblewood.md             how the extractor works (the old wiki page)
docs/HUMBLEWOOD-PLAYTESTS.md   what each Humblewood playtest packet adds and supersedes
.github/workflows/ci.yml       builds public main beside it and runs tests/run.sh
.github/workflows/data-release.yml   publishes a private data release from a data-v* tag
```

It was made from this repo's history by `git filter-repo` over the moving paths, on a fresh clone,
so the data, the extractor and the playtest notes keep their history and blame (spec R15). Its CI
runs on every push and nightly, so a leak that lands on public `main` is caught within a day even
when the private repo is idle.

### `_private-data`

A checkout reaches the private clone through `_private-data`, a symlink gitignored on the public
side (spec R16). One-time setup, from the private repo's README:

```bash
cd ~/Documents/Repos                       # wherever RPGFieldbook lives
git clone git@github.com:wardmanm/RPGFieldbookPrivate.git
cd RPGFieldbook        && ln -s ../RPGFieldbookPrivate _private-data
cd ../RPGFieldbookPrivate && ln -s ../RPGFieldbook/_conversion-data _conversion-data
```

The second link gives the Humblewood extractor and its suite the PDFs from the folder the public
checkout already keeps the 5e-tools dump in. `scripts/wt.sh` links `_private-data` into each new
worktree beside `.venv` and `_conversion-data`, and removes the link on `rm`. **Until #85 is merged,
only the #85 worktree is linked**: the main checkout's
`/Users/mwardman/Documents/Repos/RPGFieldbook/_private-data` is made at the finish, after the merge
brings the `.gitignore` line, since before that it would show as untracked there.

Three things use the link: the `private-data` suite, `dev.sh`'s converter menu and `wt.sh`. CI and
any other clone have no link, and simply skip.

### How the tests reach across

`./src/tests/run.sh` lists `private-data` as its tenth suite. `src/tests/private-data.js` looks for
`_private-data/tests/run.sh` (or `$FIELDBOOK_PRIVATE`): absent, it prints `SKIP - no _private-data`.
Present, it runs it with `FIELDBOOK` set to this checkout, relays its output, and passes only when
the runner exits 0 and its last line is `ALL PASSED (n)`; anything else is `FAILURES: private-data`,
never a pass.

The private `tests/run.sh` bundles the four packs into its own `dist/` with the public
`tools/data-kit/fbdata.py bundle`, then runs five suites, each judged the same way:

| Suite | Checks | Skips when |
|---|---|---|
| `leak-scan-self-test` | the scanner itself, on invented text | never |
| `private-data` | the registry agrees with every bundle; the four packs' content checks, loaded through the public `harness.js` | never |
| `leak-scan` | no public file carries the private text (below) | never |
| `2024-gate` | `convert.py all` on the dump reproduces `data/5e2024/` byte for byte | no dump in `$FIELDBOOK/_conversion-data/5etools-v2.36.1` |
| `humblewood-verbatim` | the Humblewood prose matches the book | no PyMuPDF, or no PDFs |

So the private checks reuse the public harness and the public app, and a public change that breaks
them fails Mike's local `./src/tests/run.sh` (and the private CI by the next night). Put `.venv/bin`
on `PATH` so `humblewood-verbatim` finds PyMuPDF rather than skipping:
`PATH=$PWD/.venv/bin:$PATH ./src/tests/run.sh`.

### The leak scan

`tests/leak-scan.py` (spec R9) reads every string of the four private packs (the private text) and
every string of `data/srd52/` and `data/homebrew/` (the free text), then every file git tracks in the
public checkout, plus `dist/fieldbook.html`. It reports runs of words that a file shares with the
private text and not with the free text. All three sides are normalised by one function: escapes
undone, 5e-tools tags, table anchors and HTML tags stripped, lower-cased, and split into words where
an apostrophe counts only inside a word, so text in a single-quoted or escaped string is seen whole.

- **A run of 14 words or more fails**, unless the allowlist names it. A prototype found every real
  leak at 14 words, with no formulaic false positives.
- **A run of 10 to 13 words is reported** as a `NOTE` and never fails.
- **An allowlist entry that matches nothing fails**, so an entry goes when its run does.
- **A missing private pack folder fails**, or the scan would quietly look for less.

An allowlist entry is `{file, hash, why}`: the hash is the first 16 hex of the sha256 of the run's
normalised words joined by single spaces, so the allowlist is never a second copy of the text. Entries
are added by review, one run at a time, and the scan refuses any `why` that is not one of four
reasons, word for word:

| | Reason | What it covers |
|---|---|---|
| (a) | "R8: a span the SRD correction must find" | the `find` strings in `scripts/srd-corrections.json`, the shortest spans of 5e-tools wording that identify what to correct into the SRD's |
| (b) | "decision 3" | the 10-word footnote in the shipped `CHANGELOG` (`30-version.js`, `docs/CHANGELOG.md`, `dist/fieldbook.html`). Below 14 words it is only reported and needs no entry; the reason exists in case it ever grows |
| (c) | "Fieldbook's own text, in the packs because convert.py writes it there" | `FIGHTING_STYLES`, `CLASS_BLURB`, the edition notes and `SUPPLEMENTS` profiles, `overlay.json` prose, wherever they appear |
| (d) | "the SRD's own text" | `data/srd52/` runs the SRD splits across two strings where a private pack keeps one |

Anything else is a leak: paraphrase it, or replace it with invented text, in the public repo.

### Private data releases

A private release is a data-only release in the public scheme (spec R4): changed packs become
`<APP_VERSION>-N`, the tag is `data-vX.Y.Z-N`, and the asset is
`fieldbook-data-private-X.Y.Z-N.zip`, published on the private repo only. From the public checkout:

```bash
node scripts/data-release.js --registry _private-data/data/packs.json --data-root _private-data/data
```

It bumps the changed packs in the private registry, refuses what a public data release refuses
(nothing changed, uncommitted data, an existing tag, an `APP_VERSION` before 1.8.0), and prints the
commit and tag commands to run in the private repo. Pushing the tag runs the private
`data-release.yml`: it checks that the public app has a `vX.Y.Z` tag, that the tag matches the
registry's `release` and no pack changed after the bump; builds the public app at `vX.Y.Z`; runs the
private suites; bundles and packs the archive with the public kit; validates it **without**
`--public`, because these packs carry no open licence; and publishes it with `--latest=false`. The
full procedure is [RELEASING](../../RELEASING.md) §1c.

XPHB and XGE have changed since their 1.7.2 versions, so the first private release is `1.8.0-1`,
after app 1.8.0. No app release ever bumps a private pack.

### Mike's workflow

1. **Tests:** `./src/tests/run.sh` runs everything, private coverage included through
   `private-data`; with `.venv/bin` on `PATH` for the PDF suites.
2. **Converting:** `./dev.sh` item 6 writes SRD 5.2 to `data/srd52` and the 2024, Xanathar's and
   Tasha's packs to `_private-data/data/…`, and refuses those three, with a message, when
   `_private-data` is not linked. The 2024 byte gate is
   `python3 scripts/convert.py all _conversion-data/5etools-v2.36.1 -o /tmp/chk && diff -r /tmp/chk _private-data/data/5e2024`,
   and the private `2024-gate` suite runs it too. Humblewood extraction runs in the private repo.
3. **His own archive:** `python3 tools/data-kit/fbdata.py build _private-data/data -o mine.zip`, or a
   private data release. He imports it alone or beside the public archive.
4. **Releasing:** the public app and data releases are unchanged; a private data release is the
   command above, then commit and tag in the private repo.

### Import order

The 2024 and SRD 5.2 packs share names: 68 tables, and many spells, items and classes. Each entry
keeps its pack, so both copies stay in the pool (`Fireball (XPHB)`, `Fireball (SRD 5.2)`), but a
lookup by name, such as `findTable()` for a `[Table: …]` anchor, takes the first match in the pool,
and a re-import replaces a pack in place, keeping its position. With both packs in one archive, the
registry ordered them, 2024 first (#84's RF5). They now come from two archives, so **the order the
player imports them decides which copy wins**: whichever was imported first, for good. Mike should
import the private archive first on a fresh install, or keep his existing loads. A fresh install that
imports the public archive and then the private one resolves a shared table name to the SRD's copy.

## Rules that must hold

- **The data is never in neither place** (spec R1). The private repo holds it, pushed, before public
  `main` loses it; the removal is one commit carrying everything that depended on the data (the
  suite list, the registry, the tests, the wiki links), so no commit on `main` fails CI; old release
  assets are deleted last.
- **A public release never carries a private pack** (spec R13). `fbdata.py validate --public`
  (`validate_archive()` with `public=True`) refuses any pack whose licence is missing or not
  `CC-BY-4.0`, `CC-BY-SA-3.0` or `MIT`, and both public release workflows run it and refuse any
  asset named `*private*`. A private archive is validated without `--public` and published only in
  the private repo.
- **The public registry lists only public packs** (spec R3). Installed apps read it live
  (`checkForDataUpdate()`): an entry left behind would announce an update that can never resolve.
  The private registry is never copied into the public one.
- **No public test reads a private pack.** The public suites pass with no private data present, as
  CI has none; `docs.js` fails on any read of the four folders or their bundles from any file under
  `src/tests/`. A check on those packs belongs in the private `tests/private-data.js`.
- **The allowlist holds hashes and one of four reasons, nothing else** (above), each entry added by
  review. A new leak is fixed in the public file, not allowlisted.
- **No book text in a public file**, dev docs included: a paraphrase, an invented example, or a
  `[book text: …]` placeholder. The allowlist's four reasons are the only exceptions, and the leak
  scan is the backstop, not the rule.
- **The private paths mirror the public ones**, so the kit and the converter need no second mode.

## Traps

- **A stale allowlist entry fails the scan.** Rewording or deleting an allowlisted run (a
  `CLASS_BLURB` line, a correction's `find`) leaves its entry matching nothing, and the private
  suite goes red in the public run. Remove the entry in the private repo in the same change.
- **A symlink is a file to git.** `.gitignore` names `_private-data` (and `.venv`) with no trailing
  slash: `_private-data/` matches only a directory, so the link would show as untracked and
  `git add -A` would commit it as a path that dangles in every other clone.
- **The private CI builds public `main`.** So it fails until #85 is merged (the kit on `main` has no
  `bundle` before then), and any public change that breaks the private suites (a harness change, a
  renamed function a private check calls) turns it red by the next night, though public CI stays
  green. Run `./src/tests/run.sh` with the link before merging.
- **Homebrew masks a shared run.** The free corpus includes homebrew, as R9 says, so text homebrew
  shares with a private pack is never flagged: The Predator's stock expanded-spell sentence is one
  such run. Mike's call whether to narrow it.
- **The private history is imprecise in one file.** `git filter-repo`'s rewrite of the #73 merge
  (`1c3aa49`) took `data/xanathars/tables.json` from the merge's first parent, so the private copy
  lacks its 17 footnotes across `1c3aa49..e8f8582`; `c0b0e64` restores them and the tip is exact.
  Blame or bisect on that file within that range shows the pre-#73 table. The private README says
  so too.
- **Import order is the player's** (above): the archive no longer orders the 2024 and SRD packs.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where the copyrighted packs live (#82) | `wardmanm/RPGFieldbookPrivate`, released privately | Public with a disclaimer: they carry no open licence. Dropped entirely: Mike plays with them |
| When they leave public `main` (#82) | Now; the history purge waits for 2.0 | Purging history now: force-pushing rewritten tags and releases is its own project ([2.0](../roadmap/2.0.md)) |
| The old releases' pack assets (#82) | Deleted when the split lands, by hand, with Mike's go-ahead | Leaving them: each release would keep handing out what `main` removed |
| Book quotes in public dev files (decision 2) | Redacted in place, keeping the ledger's line count so its citations hold: a one-time exception to append-only | Leaving them: they are book text in a public repo. Deleting the lines: every wiki citation into the ledger would move |
| The 10-word footnote in the shipped changelog (decision 3) | Left; the scan reports it, and the allowlist has a reason ready | Rewriting a shipped changelog entry |
| Releases (decision 4) | None until Mike says; 1.8.0 holds more issues | — |
| The order of the move (R1) | Private repo first, then one public removal commit, then the old assets | Removing first: the data would be in neither place. Several commits: one of them would fail CI |
| The private repo's layout (R2) | Mirror the public paths | Its own layout: the kit and `convert.py` would need a second mode |
| The public registry (R3) | Drops the four packs in the removal commit | Keeping them: installed apps would announce updates that never resolve |
| How private packs are released (R4) | Data-only releases, `X.Y.Z-N`, `fieldbook-data-private-<ver>.zip`, through `data-release.js --registry` | A second version scheme: no app release ever bumps a private pack, so the existing one fits |
| A pack the build has no baseline for (R5) | A quiet `vX` chip, the `known` state | Nothing: a v1.7.2 player's old packs would lose their version |
| Shipped book quotes (R7) | Invented examples in `downloadRulesTemplates()`, README-converter and rules-schema | Allowlisting them: they ship to every player |
| `srd-corrections.json`'s `find` strings (R8) | Kept, allowlisted; for Mike to confirm | Rewording them: they must match the dump's text to correct it |
| Where the leak scan lives (R9) | The private repo, in Mike's local run and the private CI (push and nightly) | The public repo: it needs the private text |
| Public tests (R10) | Same logic, no book content: SRD entries or invented fixtures; pack assertions move private | Skipping when the data is absent: CI would test nothing of them |
| Public releases' licences (R13) | Only `CC-BY-4.0`, `CC-BY-SA-3.0`, `MIT`, and no asset named `private` | Trusting the build: a mistake would republish what this change removed |
| Homebrew's `requires` (R14) | D&D group names SRD 5.2; the Xanathar's group keeps its name and drops `file` | A `file` nothing public ships |
| How the private repo starts (R15) | `git filter-repo` from public history, before its first push | A fresh repo: loses the data's history and blame, which the purge would then erase for good |
| How a checkout finds it (R16) | The gitignored `_private-data` link; `wt.sh` links worktrees | A path setting: every tool would need to read it |
| Same-named 2024 and SRD entries, now in two archives (ruling) | The player's import order decides; import the private archive first | Keeping #84's RF5 check: neither registry holds both packs, so it could only pass vacuously |
| `DATA_VERSIONS` naming the departed packs (ruling) | `docs.js` tolerates those four (`LEFT_FOR_PRIVATE`) until the next release retakes the snapshot; then delete it | A tripwire once it is inert: it would fail CI at the release itself |
| The filter-repo footnote gap (ruling) | Left, documented here and in the private README; the tip is exact | Rebuilding the history: cheap only before the first push, so it is Mike's call then |
| Text homebrew shares with a private pack (ruling) | Not flagged, as R9 has it; Mike's call | Scanning homebrew as private: its CC-BY-SA text is free |
| The main checkout's link (ruling) | Made at the finish, after the merge | Before: it would show as untracked until `.gitignore` names it |

## Open

- **The main checkout has no `_private-data` link yet.** It is made at the finish, after the merge.
- **The private repo is unpushed and its CI unproven.** Its first push and a manual CI run are the
  finish's first step; the CI needs #85 on public `main`.
- **Private packs get no newer-data notice**: `checkForDataUpdate()` reads the public registry
  (spec §8). Mike knows when he has cut one.
- **Homebrew's Xanathar's spells cannot resolve publicly.** Its chip names Cause Fear and Primal
  Savagery "from Xanathar's Guide to Everything" for any player without that pack; the cross-check
  that they exist runs only in the private suite.
- **The old releases' data stays reachable until 2.0**, through GitHub's Source code archives of
  each tag and through public history, even after the assets go. See [2.0](../roadmap/2.0.md).
- **`LEFT_FOR_PRIVATE` in `docs.js` is to be deleted after the next release**, once `DATA_VERSIONS`
  no longer names the departed packs.
- **New characters still default to Humblewood** (`blankChar()`), with no public Humblewood data
  (spec §13): Mike's call, as its own issue.
- The private README says `private-data` joins `run.sh` "with #85's removal commit"; it has. Its next
  edit can say so in the present tense.

See [Known issues](../roadmap/known-issues.md).

## History

- 2026-10-09 — The copyrighted packs, the Humblewood extractor and its suite move to RPGFieldbookPrivate; `_private-data`, the `private-data` suite, the leak scan, private data releases, the import-order and `LEFT_FOR_PRIVATE` rulings. → ledger L5426, #85
