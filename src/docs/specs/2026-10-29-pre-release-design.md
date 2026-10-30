# Pre-release: design

**Status:** approved in conversation 2026-10-29.
**Issue:** #127 (Release Process Updates). One branch, `issue/127-pre-release`.
**Why:** the app is large enough that a release needs a fixed checklist before it is cut — docs tidied,
loose ends filed, a QA pass with its bugs filed, and release notes a player can read. This is also
groundwork for 2.0 ([roadmap](../wiki/roadmap/2.0.md)).

**Read first:**
- [RELEASING](../RELEASING.md) and the `release` skill (`.claude/skills/release/SKILL.md`): today's flow, its
  preflight and its two gates.
- [Building & CI](../wiki/process/building-and-ci.md): `build.sh --release`, `scripts/release.js`.
- [Testing](../wiki/process/testing.md) and `src/tests/docs.js`: the docs checks this extends.
- [Screenshot QA](../wiki/process/screenshot-qa.md): the Playwright MCP the checklist pre-drive uses.

---

## 1. What it is

A new skill, **`/pre-release <ver>`**, that Mike runs before an app release. It works through five steps in
order, records each in a committed file, and resumes where it stopped. Until every step is done for that
exact version, **`/release` and `./build.sh --release <ver>` refuse to cut it.** Data and private data
releases do not need it.

## 2. Decisions

Mike's, in conversation, 2026-10-29.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | How hard the block is | **A committed record, `src/docs/PRE-RELEASE.md`, checked by `/release` and by `./build.sh --release`**: both refuse unless it is complete for exactly that version | A CI check as well: it refuses after the tag is pushed, the worst place to learn. Convention only: not rigid |
| 2 | Links when docs move | **Rewritten by script in the same step**, everywhere: wiki, specs, plans, code comments, CLAUDE.md, skills, and the ledger (a same-line substitution, so every `L<n>` citation stays valid). The docs suite gains a check that every link to a spec, plan or archived doc resolves | Leaving the ledger's old paths: dead links in the log |
| 3 | Existing specs and plans | **Backfilled once**, each into the version it shipped in, worked out from git | From 1.9.0 onward only: folders consistent only from now |
| 4 | Out-of-date docs | **Candidates found, Mike confirms each; finished docs move to `src/docs/archive/<ver>/`**, wrong ones are corrected in place. Nothing is deleted | Deleting: breaks old links, buries old decisions |
| 5 | Filing issues | **Milestone = the release's (v1.9.0), label = the next fix version (`1.9.1`), added to project #3 (RPGFieldbook) with Status Backlog and a Priority Mike confirms**: P2 minor bug / visual / tweak; P1 medium bug, functionality affected, workaround exists, no data at risk; P0 blocker | A `blocker` label: the project already has Priority |
| 6 | What blocks | **Only an open P0** in the release's milestone. A P0 gets no next-version label; it stays in the milestone and holds step 4 open until it is closed | P1 also blocking: it has a workaround and risks no data |
| 7 | The QA checklist | **One file, rebuilt every run**, by app area, "New in this release" plus a standing "Still works" list, then a device pass; **Claude pre-drives what it can** in the project Playwright browser before Mike tests | A blank checklist: Mike tests everything Claude could have |

## 3. The record: `src/docs/PRE-RELEASE.md`

Created by the first `/pre-release <ver>` and rewritten as it goes. Dev-only (under `src/docs/`, never ships).

```markdown
# Pre-release 1.9.0
Started: 2026-10-30 · App was 1.8.1

| Step | State | Done | Summary |
|---|---|---|---|
| 1. Docs | done | 2026-10-30 | 21 specs and 20 plans filed; 3 archived; 112 links rewritten |
| 2. Outstanding issues | done | 2026-10-30 | 9 filed (#131–#139), 4 skipped, 2 merged |
| 3. QA checklist | done | 2026-10-30 | 64 lines; Claude drove 41, 2 probable bugs |
| 4. QA bugs | open | | waiting on the device pass; P0: #140 |
| 5. Release notes | open | | |

## Step 2: outstanding issues
| Item | Source | Title | Priority | Decision | Issue |
|---|---|---|---|---|---|

## Step 4: bugs from QA
| Line | Title | Priority | Issue | State |
|---|---|---|---|---|
```

- **State** is `open` or `done`. A step is `done` only when its own end condition (§4) holds; the date is
  when it became done. Steps run in order; a step can't be done while an earlier one is open.
- **Resume:** `/pre-release <ver>` reads the record and continues at the first open step. With a record for
  a different version it stops and asks: replace it (start over for the new version) or keep it.
- **On release:** `scripts/release.js`, when it cuts `X.Y.Z`, moves the record to
  `src/docs/archive/X.Y.Z/PRE-RELEASE.md`.

## 4. The five steps

### Step 1 — Documentation

1. **File specs and plans by version.** Each spec in `src/docs/specs/` and plan in `src/docs/plans/` whose
   feature has shipped moves to `specs/<ver>/` or `plans/<ver>/`: `<ver>` is the first release tag after the
   commit that merged its feature (git: the merge commit naming its issue, else the file's last commit on a
   feature branch; `git tag --contains`, earliest `v*`). For the release being prepared, a document whose
   feature is merged goes into `<ver>` of this release. Anything not yet merged stays at the top level.
   **The first run backfills every existing document** (decision 3); later runs move only this release's.
   The skill shows the full move list and Mike confirms it before anything moves.
2. **Find out-of-date docs** (decision 4) and list each with why:
   - wiki lines that name a function that no longer exists or contradict the code (the docs suite, plus a
     grep of named functions);
   - `known-issues.md` entries whose issue is closed or fixed;
   - the released version's roadmap page (`wiki/roadmap/<ver>.md`), which becomes a record;
   - one-time sections that are done (e.g. RELEASING §4a);
   - specs superseded by a later spec.
   Mike marks each: **archive** (to `src/docs/archive/<ver>/`, for whole documents or a section moved into
   one), **correct** (fixed in place, shown as a diff first), or **keep**.
3. **Rewrite links** (decision 2) with one script, `scripts/move-docs.js`, given the move list: every
   reference to an old path in the wiki, specs, plans, archive, code comments in `src/js/`, CLAUDE.md,
   `.claude/skills/`, `src/docs/*.md` and the ledger is replaced in place. In the ledger the replacement never
   adds or removes a line. Relative links are recomputed from each file's own folder.
4. Run the full suite (the new link check included, §6). Commit: `docs: pre-release X.Y.Z — step 1`.

**Done when** the confirmed moves and archive/correct decisions are applied, every link resolves, and the
suite is green.

### Step 2 — Outstanding issues

1. **Gather** non-blocking loose ends from: the As built of this release's specs (deferred minors, "Open for
   Mike"), `known-issues.md` entries with no issue number, and `.claude/status.md`'s Loose ends and Pending
   decisions.
2. **De-duplicate** against open GitHub issues (title and key words); a match is shown as "already #N".
3. **Table** them in the record: item, source, proposed title, proposed priority (P2/P1). Mike marks each row
   **file**, **skip**, or **merge with #N**, and confirms or changes the priority. Nothing is created until
   every row is marked.
4. **File** the "file" rows (decision 5): milestone = the release's, label = the next fix version (created if
   missing), type `bug` or `task`, body citing the source; added to project #3 with Status Backlog and the
   confirmed Priority. "Merge with #N" adds a comment to #N citing the source. Each issue number is written
   back into the table and into its source line (e.g. a known-issues entry gains "(#131)").
5. Commit: `docs: pre-release X.Y.Z — step 2`.

**Done when** every row is marked and every "file" row has an issue.

**The next fix version** is the release's patch + 1: `1.9.0` → `1.9.1`, `1.9.1` → `1.9.2`.

### Step 3 — The QA checklist

1. **Build** the release candidate: `./build.sh --no-zip` (restored after, as always).
2. **Write `src/docs/QA-CHECKLIST.md`** from scratch (decision 7). Top: the version and the commit it was
   generated against. Then one section per app area, in tab order — Home, Sheet, Combat, Spells, Inventory,
   Bio, Journal, Rules, Settings, Extensions and updates — each with:
   - **New in this release:** lines written from this version's `UNRELEASED.md` bullets, the milestone's
     closed issues, and each of this release's specs' testing section;
   - **Still works:** that area's lines from the standing template `src/docs/qa/smoke.md` (Mike edits it over
     time; the skill never rewrites it).
   Last, a **Device pass** section: touch, print, Safari and Firefox, real phones, his own characters, plus
   every specific device item `.claude/status.md` names.
3. **Pre-drive.** Claude drives every line it can in the project Playwright MCP (`mcp__playwright__*`), at
   1280 and 390, in both skins. A passing line becomes `- [x] … ✓ Claude, Chrome 1280/390`; a failing one
   `- [ ] … ✗ Claude: <what happened>` and is listed as a probable bug; a line it can't drive stays
   `- [ ]` with `(not driven: <why>)`. Screenshots of failures go to `.claude/qa/pre-release-<ver>/`.
4. Commit: `docs: pre-release X.Y.Z — step 3`.

**Done when** the checklist is written and the pre-drive has run over every line.

**Mike's marks:** `- [x]` when a line passes; `FAIL: <what happened>` appended to a line that fails.

### Step 4 — Bugs from QA

1. Mike tests from the checklist (his device pass and anything not driven) and marks it.
2. The skill reads every `FAIL:` line and every `✗ Claude` line Mike hasn't dismissed, proposes a title and a
   priority for each, and Mike confirms. **P2 and P1** are filed as in step 2 (milestone, next fix version
   label, project, Status Backlog, Priority). **P0** is filed in the milestone with Priority P0 and no fix
   version label, and listed in the record.
3. **A P0 holds the step open** (decision 6). Mike fixes it through the normal worktree flow; rerunning
   `/pre-release <ver>` re-checks (GitHub: open issues in the milestone with Priority P0).
4. Commit: `docs: pre-release X.Y.Z — step 4`.

**Done when** Mike says the checklist is finished, every failure has an issue, and no P0 in the milestone is
open.

### Step 5 — Release notes

1. Read every bullet under `## Pending` in `src/docs/UNRELEASED.md` as a player would and flag: internal
   words (function, file or field names, "migrate", issue numbers, "As built", "ledger"), vague or over-long
   bullets, and two bullets about one change.
2. Show each flagged bullet with a suggested rewrite; Mike accepts, edits or keeps each. Accepted rewrites
   are written into `UNRELEASED.md`.
3. Show the whole set the way the app's "What's new" will render it, and ask for a final yes.
4. Commit: `docs: pre-release X.Y.Z — step 5`.

**Done when** Mike gives the final yes.

## 5. The gate

- **`./build.sh --release X.Y.Z`** (through `scripts/release.js`) refuses unless `src/docs/PRE-RELEASE.md`
  exists, its heading names exactly `X.Y.Z`, and all five steps are `done`. The message names the first open
  step and says to run `/pre-release X.Y.Z`. It does not query GitHub (it must work offline).
- **The `release` skill's preflight** checks the same, and also that no issue in the release's milestone with
  Priority P0 is open. A number changed at Gate 1 that the record doesn't name sends Mike back to
  `/pre-release` for it.
- **Data and private data releases** (`data-release.js`) are not gated.
- **After the cut** `release.js` moves the record into `src/docs/archive/X.Y.Z/` (§3).

## 6. Docs suite: links to specs, plans and the archive

`src/tests/docs.js` gains a check: every reference to `src/docs/specs/`, `src/docs/plans/` or
`src/docs/archive/` — a markdown link or a bare path — in the wiki, specs, plans, archive, `src/docs/*.md`,
the ledger, `src/js/` comments, CLAUDE.md and `.claude/skills/` resolves to an existing file. So a move that
misses a link fails the suite.

## 7. Where it runs, and what it commits

- On **main**, like `/release`: release preparation, not an issue's work. It refuses on another branch or a
  dirty tree (the same preflight lines `/release` uses), and with an open worktree branch it says so and
  asks.
- One commit per step, `docs: pre-release X.Y.Z — step N`, each ending with the Co-Authored-By trailer, so a
  step is easy to undo. **It never pushes**; the commits go up with the release.
- GitHub writes (issues, labels, project fields, comments) happen only after Mike's confirmation in steps 2
  and 4.

## 8. Files

- **New:** `.claude/skills/pre-release/SKILL.md` (the procedure, the record format, red flags);
  `scripts/move-docs.js` (moves files and rewrites every reference; `--dry-run` prints the plan);
  `src/docs/qa/smoke.md` (the standing list, a first version written from the wiki's feature pages);
  `src/docs/archive/` (created on first use).
- **Changed:** `scripts/release.js` (the gate and the record's move); `.claude/skills/release/SKILL.md`
  (preflight); `src/docs/RELEASING.md` (a "Before you cut: /pre-release" section); `src/tests/docs.js` (§6,
  and any rule that lists `src/docs/` folders); CLAUDE.md (the release rule names `/pre-release`; the docs
  tree names `specs/<ver>/`, `plans/<ver>/`, `archive/`); the wiki's building-and-ci and testing pages.
- **Generated by the skill, not by this branch:** `PRE-RELEASE.md`, `QA-CHECKLIST.md`, the moves.

## 9. Edge cases

- **A spec for a feature split across releases** (built in one, extended in the next): filed by its first
  merge; the later work's spec is its own file.
- **A plan with no matching spec, or a spec with no merge found:** listed for Mike to place by hand.
- **`git tag` has no release after a merge** (it's in this release): it goes into the version being prepared.
- **A link inside a fenced code block** is rewritten too (they are paths people copy).
- **The project's fields can't be looked up** (no `project` scope, or the network): nothing is filed.
  The skill stops and says why (`gh auth refresh -s project`), so every issue that exists has its
  Priority and the open-P0 gate can't miss one (Mike, 2026-10-30, amending the first text here).
- **The project write fails after the issue exists** (adding it to the project, or setting its fields):
  the issue stays filed; the record lists it as "priority not set" and the step is not done until it is.
- **A rerun after more work merged** (between steps 3 and 5): step 3's checklist names the commit it was
  built against; if main has moved, the skill says so and offers to rebuild step 3, which reopens 3 and 4.
- **`/release` for a version with no record at all:** refused, naming `/pre-release`.

## 10. Testing

- `scripts/move-docs.js`: Node tests (a new suite or `docs.js`) on a temp tree — a move rewrites relative
  and absolute links in every listed location, never changes the ledger's line count, recomputes relative
  links from moved files, handles code-fence paths, and `--dry-run` writes nothing.
- The gate: `release.js` refuses with no record, a record for another version, or an open step; accepts a
  complete one; moves the record after cutting (tested against a temp copy, no tag, no push).
- The docs suite's new link check: a broken spec link fails it.
- The skill itself is a procedure; it is exercised by the first real `/pre-release 1.9.0`, which is also the
  backfill.

## 11. Docs

Ledger entry; wiki: building-and-ci, testing, decisions (§2), overview's code-and-docs map; RELEASING;
CLAUDE.md. No UNRELEASED bullet: nothing a player sees.

## 12. Out of scope

- A CI check of the record (decision 1).
- Gating data and private data releases.
- Keeping a history of QA checklists (rebuilt each run, as asked).
- Changing `/release`'s two gates; this adds a precondition before them.

## As built

Built 2026-10-29 in six tasks on `issue/127-pre-release` (`2d97fab..`), each reviewed, then a final
fix wave after the final review. The code is the truth, and the wiki pages in §11 describe it (ledger
"Pre-release (#127, 2026-10-29)" and "Pre-release: the final fix wave (#127, 2026-10-29)"). This section
records where the code lives, every deviation and ruling with what it costs if it is wrong, and what
was deferred.

### Where it lives

- `scripts/move-docs.js`: step 1.3's script (`findRefs()`, `rewriteText()`, `checkMoves()`,
  `planMoves()`, `writeProblems()`, `applyPlan()`, `undoCommands()`, `scanFiles()`, `SCAN`), with
  `--dry-run` and `--root`.
- `scripts/pre-release-record.js`: the record's parser and the gate's words (`parseRecord()`,
  `recordProblem()`, `gateProblem()`, `archiveRecord()`, `archiveByHand()`, `STEPS`), and the CLI
  `node scripts/pre-release-record.js [X.Y.Z]` (and `--help`) that `/release`'s preflight runs.
- The gate in `scripts/release.js`: after the version resolves and the "must be higher" check,
  before anything is written; the record is filed last, after the notebook is emptied, and a failed
  filing leaves the cut standing with the command that files it by hand.
- The skill, `.claude/skills/pre-release/SKILL.md`; `/release`'s preflight in
  `.claude/skills/release/SKILL.md`.
- The standing list, `src/docs/qa/smoke.md`.
- Tests: `src/tests/pre-release.js` (a new suite, eleven in all), the gate's cases in
  `src/tests/data-kit.py`, and three blocks in `src/tests/docs.js` (the link check of §6, the smoke
  list's areas, the skills against the gate).
- Docs: RELEASING §0 (and undoing a cut), CLAUDE.md, `dev.sh`'s checklist and Release item,
  `build.sh`'s closing line, the wiki's building-and-ci, testing, overview, decisions and index.

### Deviations from the text above (accepted at plan review)

- **Two extra files**: `scripts/pre-release-record.js`, so the gate, its CLI and its tests share
  one parser, and `src/tests/pre-release.js`. The gate inside `release.js` is tested in
  `data-kit.py`, beside the other `release.js` cases, on a scratch git checkout.
- **`move-docs.js` searches more than §4.3 lists**: also `.github/workflows/`, `data/packs.json`,
  `scripts/`, `tools/data-kit/`, the suites, README.md, `build.sh`, `dev.sh` and `.githooks/`, since
  paths to specs already sit there and decision 2 says "everywhere"; and `.claude/status.md` and,
  when linked, the private repo's `tests/leak-allowlist.json` (Rulings 24, 25).
- **§6's check is scoped** to real claims: it skips `src/tests/` (invented fixtures); a relative link
  counts only outside fenced blocks, and only when it names `specs/`, `plans/` or `archive/` or a
  dated doc; an `X.Y.Z`, `YYYY` or `example-` path is an illustration. Without this, 23 false alarms.
- **The gate checks the resolved version** (`patch` becomes a number first) **and refuses a version
  cut before**. Its words are fixed in the plan's Global Constraints.
- **Step 1 rebuilds and commits `dist/fieldbook.html`** when a moved path sat in a `src/js/`
  comment: main carries the artifact, and its CI fails on a stale one.
- **A ticked `✗ Claude` line counts as dismissed** in step 4.
- **Step 5 also flags markdown**, which "What's new" shows as typed (`openChangelog()`).
- **`dev.sh`'s checklist gains step 0**, `/pre-release`, or it would send Mike straight to a cut
  `release.js` refuses; `dev.sh`'s Release item and `build.sh`'s closing line name it too.
- **CLAUDE.md's main-branch exception** names release preparation: `/pre-release` commits its steps
  on main, and `/release` its release commit.
- **`smoke.md` before the skill** (Task 4, then 5): the skill's checklist copies its areas.
- **`QA-CHECKLIST.md` is not archived at the cut**: it is rebuilt by each run (§12).

### Rulings

Each with what it costs if it is wrong.

1. The `checkout()` copy-loop edit moved into Task 3's step 3, so step 2 failed with FAIL lines.
   Cost: none.
2. `move-docs.js`'s test writes its move list in its own temp dir and removes it. Cost: none.
3. The usage test passes `--root`, never defaulting to the real repo. Cost: none.
4. Every `move-docs.js` error path ends "nothing was written". Cost: none.
5. Both skills keep their own open-P0 query, since each must run alone; `docs.js` asserts the two
   are identical. Cost: none.
6. A P0 loose end is filed in the milestone with Priority P0 and no fix-version label, and step 4's
   P0 check holds the release (decisions 5 and 6). Cost: none.
7. When no merge names a doc's issue, its version comes from the commit that added it (`git log
   --diff-filter=A`, the earliest `v*` tag containing it), and Mike confirms. Cost if wrong: a doc
   filed one version off, caught at confirmation.
8. `/pre-release` checks the branch and refuses off main; it never switches. `/release`'s own
   preflight still switches. Cost: none.
9. testing.md's suite count, in its Open list, becomes eleven too. Cost: none.
10. RELEASING's two new "What `--release` does" bullets each say where they go. Cost: none.
11. building-and-ci's Decisions table keeps its three columns; §2's `#` column is dropped. Cost: none.
12. Every "writes nothing" check also asserts `git status --porcelain` (exactly the test's own record
    when it wrote one). Cost: none.
13. The plan's line numbers are pre-edit; edits go in by quoted text. Cost: none.
14. `parseRecord()` matches step rows by number. Cost: none.
15. `move-docs.js` also searches README.md, `build.sh`, `dev.sh` and `.githooks/`. Cost: none.
16. The link check counts a folder link (`../specs/`) as resolving when the folder exists, and
    `move-docs.js` rewrites folder links too. Cost if wrong: a link to a vanished folder still fails;
    a link to an existing folder never does.
17. "Cut before" means the tag `vX.Y.Z` exists or the archived record is tracked in git. An untracked
    archived record with no tag is an abandoned cut, refused with the exact command that puts it
    back (`mv src/docs/archive/X.Y.Z/PRE-RELEASE.md src/docs/PRE-RELEASE.md`), never moved
    automatically. Cost if wrong: one extra command after an abandoned cut.
18. A duplicated or missing step row makes the record invalid, refused naming the row: the gate
    fails closed. Cost: none.
19. The preflight's clean-tree check allows exactly `src/docs/PRE-RELEASE.md` and
    `src/docs/QA-CHECKLIST.md` (modified or untracked); a resume commits them first
    (`docs: pre-release X.Y.Z — record`); the moved-main check ignores commits touching only those
    two; a step-3 rebuild asks first and carries Mike's marks forward on every unchanged line. Cost
    if wrong: a resume asks one extra question.
20. Steps are strictly ordered: reopening any step reopens every later step. A rerun with all five
    done re-checks main and open P0s, and if nothing changed says "complete — run /release X.Y.Z"
    and changes nothing. Cost: none.
21. (Amended.) Only an open issue keeps a doc at the top level. A doc whose issue is closed but has
    no merge naming it, or that names no issue, uses the add-commit fallback (Ruling 7) and is listed
    for Mike to confirm. Cost if wrong: Mike corrects a version on the move list.
22. The filing block takes the confirmed priority; a P0 gets no fix-version label. Cost: none.
23. Step 2's write-backs (issue numbers into `known-issues.md`, an As built, `.claude/status.md`) go
    into step 2's own commit straight after filing, so none is left uncommitted between sessions.
    Cost: none.
24. `move-docs.js` also rewrites `_private-data/tests/leak-allowlist.json`, whose entries name public
    files by repo path, when the private repo is linked (skipped without a word when it is not);
    step 1 commits the private repo too, and it is pushed right after public main, never before.
    Cost: none.
25. `.claude/status.md` joins `move-docs.js`'s `SCAN`, and the moved-main check ignores commits that
    touch only it; RELEASING's undo of a cut first unstages (`git restore --staged .`), since
    `/release` stages with `git add -A`. Cost: none.

The implementers' own, upheld: `pre-release-record.js` is mode 644 like every other script, run as
`node scripts/…`; step 3 restores the build files before its commit; archiving never cuts a section
from the ledger; `/release` looks for the roadmap page under `archive/` too; a declined rebuild
records "Kept at `<sha>`" under the checklist's header as the next moved-main baseline (cost if
wrong: one header line).

The final fix wave's own (implementer's), each with its cost if wrong:

- a. `move-docs.js` checks, before writing, that every file it rewrites and every folder it writes
  into or removes from is writable, so a read-only folder refuses with nothing written (the dry run
  too); the part-way failure path is tested by fault injection into `main()`. Cost: none.
- b. Its undo commands name each file (`git checkout -- <files>`, `rm -f <files>`, the private repo
  through `git -C`), never `git checkout -- .` or `git clean`: a tree-wide checkout would also throw
  away step 1's corrections, and a clean would delete the untracked first-run record. It prints
  them and runs none. Cost if wrong: a long command line after a rare failure.
- c. A record `release.js` cannot file leaves the cut standing (exit 0, so `build.sh` finishes the
  build) and prints `mkdir -p … && git mv …` (plain `mv` when git does not track the record);
  `archiveRecord()` removes the folder it made. `/release` runs that command before its commit.
  Cost if wrong: one command by hand.
- d. The CLI: `--help`/`-h` print the usage to stdout and exit 0; usage errors exit 2; a refusal
  exits 1, printed as it is when it already starts "pre-release", else prefixed "pre-release: ".
  Cost: none.
- e. The filing block looks up every project id, the Priority option included, before
  `gh issue create`, so a missing `project` scope now stops with nothing filed rather than filing
  an issue with no priority; a project write failing after filing still reads "(priority not
  set)". Cost if wrong: a scope refresh before the first filing.
- f. The private commit is `docs: pre-release X.Y.Z — paths moved`, with no issue number (every
  later pre-release makes it too), made with the step-1 commit after the suite; `/release`'s
  preflight expects exactly that unpushed commit and Gate 2 pushes it after public main. Cost: none.
- g. Only the allowlist is scanned in the private repo, never its packs; and the docs suite's link
  check leaves `_private-data/` out, since the one clone serves every checkout and its own leak scan
  catches a stale path. Cost if wrong: a stale allowlist path is caught by the private suite, not
  the docs suite.

### Deferred minors

- `move-docs.js`: the test tree has no file under `src/docs/archive/` (the `SCAN` test covers
  Ruling 15's four roots since the final fix wave); a backup like `foo.md.orig` is rewritten as `foo.md`; `LINK_TARGET`
  stops at a space or `(` even inside `<…>`. (The unused `RECORD_JS` constant is used since Task 3.)
- The link check: its archive branch is only self-tested until `src/docs/archive/` exists.
- The gate: no test for `--release patch` or `minor` succeeding, or for a CRLF record;
  `data-kit.py`'s undone-cut case extracts the `mv` command by splitting the refusal's wording.
- `smoke.md`: the ancestry/background/class line and the trade window line each bundle several
  checks.
- The skill (final review): step 1's "first `#<n>`" fallback picked the wrong issue for 4 of 43
  docs (each still landed in the right version, and Mike confirms the list); the merge grep also
  matches merges *into* an issue branch. Fix later: take a plan's issue from its `**Spec:**`, and
  anchor the grep to `^[0-9a-f]+ Merge (branch ')?issue/<n>-`.
- The link check (final review): it does not verify a moved doc's outgoing links (`../../wiki/…`),
  which only `move-docs.js`'s recompute protects; the backfill broke none.
- For Mike (final review): no `permissions.ask` rule guards the skill's `gh issue create|comment`,
  `gh label create` or `gh project item-add|item-edit`; the skill's text is the only guard.
- After the backfill, a worktree branched before it reports stale allowlist entries in its
  `private-data` suite until it merges main (the one private clone serves every checkout).
- The skill: the P0 check leaves comparing two lists to the reader; a resume with a missing or
  doubled record row is undefined (the gate refuses such a record anyway); step 1's rebuild trigger
  is narrower than the build's inputs; `--grep` also matches body lines; a second "Kept at" line
  picks the older sha; a stale dirty `QA-CHECKLIST.md` can enter step 1's commit; all steps done
  plus a declined rebuild is not spelled out.
- RELEASING's undo (final re-review): a full `./build.sh --release` (not `--no-zip`) also writes new
  files under `releases/data/` (`build.sh:127-130`), which `git restore --staged . && git checkout -- .`
  leaves untracked; RELEASING (around :66-69) says only the record's copy is left behind. Fix: name
  `releases/data/`'s new files in the undo, or remove them by path.
- `/release`'s private check (final re-review): "exactly one unpushed private `paths moved` commit" is
  prose; the preflight only runs `git -C _private-data status -sb`, and its comment still reads
  "pushed unless releasing it". Fix: `git -C _private-data log --format='%h %s' @{u}..` must print one
  `paths moved` line and `git -C _private-data diff --name-only @{u}..` only
  `tests/leak-allowlist.json`; the private commit names that file as its pathspec.
- Push order (final review and re-review): between step 1 and the release, public main and the private
  repo each hold an unpushed commit; a push of public main for any other reason (or a private data
  release) first turns the private CI's leak scan red until the private commit is pushed. Nothing
  enforces the order.
- The filing block under macOS `/bin/bash` 3.2: a body with an unmatched `(` fails to parse (here-doc
  inside `$(…)`), so nothing is filed — it fails safe; zsh, which Claude Code uses, is unaffected.

### Decided after the build

- **A missing `project` scope at filing** (Mike, 2026-10-30): ruling e stands — the project fields are
  looked up before `gh issue create`, so a missing scope stops with nothing filed; §9 is amended to match.
  Rejected: filing anyway as "priority not set", because a P0 with no Priority is invisible to the
  open-P0 gate.

### Not yet run

The first `/pre-release 1.9.0` is the backfill and the skill's first exercise (§8, §10): Mike's, on
main, after the merge. Nothing in this branch moved a spec, plan or wiki page.
