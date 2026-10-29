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
- **The project field write fails** (scope, network): the issue is still filed; the record lists it as
  "priority not set" and the step is not done until it is.
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
