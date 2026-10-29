---
name: pre-release
description: Use when Mike types /pre-release <version> to get an app release ready before it is cut — specs and plans filed by version, out-of-date docs archived or corrected, loose ends filed as issues, a QA checklist pre-driven in the browser, its bugs filed, and release notes a player can read. /release and ./build.sh --release refuse an app release until this is complete for that exact version.
argument-hint: <version X.Y.Z>
disable-model-invocation: true
---

# Pre-release

Arguments: `$ARGUMENTS` — the version being prepared, `X.Y.Z`. It is required: ask for it if missing.

The design, which binds this procedure: `src/docs/specs/2026-10-29-pre-release-design.md`. The
record this skill keeps is what `scripts/release.js` checks: `./build.sh --release X.Y.Z` refuses
until `src/docs/PRE-RELEASE.md` names exactly `X.Y.Z` with all five steps `done`. Run
`node scripts/pre-release-record.js X.Y.Z` to see what it would say: it prints
`pre-release X.Y.Z: complete` and exits 0, or prints the refusal and exits 1.

## Who decides what

Mike typing `/pre-release` is his instruction to prepare the release. **He decides; you propose and
then carry out what he confirmed.** He confirms:

- the move list, and archive, correct or keep for each out-of-date doc (step 1);
- file, skip or merge with #N for each loose end, and its priority (step 2);
- the title and priority of each bug (step 4);
- each release-note rewrite, and the final yes (step 5).

Nothing is written to GitHub (issues, labels, project fields, comments) before his confirmation.
You commit each step on main. **You never push, and you never cut the release:** that is `/release`.
"Skip the checks" never skips a step: say so in one line and keep going.

## 0. Preflight, every run

```bash
git branch --show-current                             # must print main: refuse otherwise
git fetch -q && git status -sb                        # not behind origin
git status --porcelain -- . ':!src/docs/PRE-RELEASE.md' ':!src/docs/QA-CHECKLIST.md'   # must print nothing
git worktree list; git branch --no-merged main        # an open issue branch: say so and ask
grep -o 'APP_VERSION="[^"]*"' src/js/30-version.js    # the current version
```

- **Off main, refuse.** Name the branch and stop; never switch it yourself, since Mike decides when
  to leave the branch he is on. Behind origin, refuse the way `/release` does.
- **A dirty tree.** The only changes allowed are to the two files this pre-release keeps between
  sessions, `src/docs/PRE-RELEASE.md` and `src/docs/QA-CHECKLIST.md`: Mike marks the checklist, and
  the record can be left mid-step. Any other change (the porcelain line above prints it): refuse,
  name it, and stop.
- With an open worktree branch, name it and ask whether its work belongs in this release before
  going on.
- `X.Y.Z` must be three numbers and higher than `APP_VERSION`. If not, stop and say so.
- **The record.** No `src/docs/PRE-RELEASE.md`: create it (below), with today's date and the current
  `APP_VERSION`, and start at step 1. A record for another version: stop and ask, **replace** (start
  over for `X.Y.Z`) or **keep** (stop here). A record for `X.Y.Z`: resume, as below.
- **On a resume, commit the two files first** if either has changed, before anything else runs, so
  Mike's marks are safe in git:

  ```bash
  git add -A     # the preflight allowed nothing else, so this takes only those two files
  git commit -m "docs: pre-release X.Y.Z — record" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

  Then continue at the record's first `open` step.
- **Has main moved?** On a resume after step 3 is done, list what has reached main since the
  commit the checklist names (the last `Generated against` or `Kept at` line in its header),
  leaving out this pre-release's own commits and any commit that
  touches only the two files:

  ```bash
  git log --format='%h %s' <that commit>..HEAD --invert-grep --grep='^docs: pre-release X\.Y\.Z — ' \
    -- . ':!src/docs/PRE-RELEASE.md' ':!src/docs/QA-CHECKLIST.md'
  ```

  Anything listed is work merged since the checklist was built (a merged P0 fix is expected
  here). Say so, list it, and **ask** whether to rebuild step 3; Mike may decline, or ask for only
  the areas the new work touched to be re-driven. If he declines, add "Kept at `<short sha>` on
  YYYY-MM-DD" (HEAD now) under the checklist's header and commit it as the record commit, so the
  next check starts there. A rebuild reopens step 3 and every later step
  (3, 4 and 5: new work can bring new release notes), and carries his marks forward (step 3).
- **Every step already done.** Run `node scripts/pre-release-record.js X.Y.Z`, then re-check two
  things: whether main has moved (above), and whether a P0 is open (step 4's query). If neither,
  say "Pre-release X.Y.Z is complete — run /release X.Y.Z." and change nothing. If main moved,
  ask about the rebuild, as above. If a P0 is open, step 4's "done when" no longer holds: say
  so, name it, and reopen step 4, which reopens every later step.

## The record

Created by the first run, rewritten as each step finishes, committed with each step:

```markdown
# Pre-release X.Y.Z
Started: YYYY-MM-DD · App was A.B.C

| Step | State | Done | Summary |
|---|---|---|---|
| 1. Docs | open | | |
| 2. Outstanding issues | open | | |
| 3. QA checklist | open | | |
| 4. QA bugs | open | | |
| 5. Release notes | open | | |

## Step 2: outstanding issues
| Item | Source | Title | Priority | Decision | Issue |
|---|---|---|---|---|---|

## Step 4: bugs from QA
| Line | Title | Priority | Issue | State |
|---|---|---|---|---|
```

- **State** is `open` or `done`, nothing else. A step becomes `done` only when its own "Done when"
  holds; **Done** is the date it did. Steps run in strict order: never mark a step done while an
  earlier one is open, and reopening a step reopens every later step (each goes back to `open`,
  its Done and Summary cleared).
- Keep exactly one row per step, numbered as above: `release.js` refuses a record with a step row
  missing or doubled.
- **Summary** is one line with counts, e.g. "21 specs and 20 plans filed; 3 archived; 112 links
  rewritten". No `|` in a cell, and no relative links anywhere in the record: `release.js` moves it
  to `src/docs/archive/X.Y.Z/` at the cut.
- An issue whose Priority could not be set (scope, network) is written "#N (priority not set)", and
  its step is not done until it is set.

**Each step's commit.** Update the record, then:

```bash
git add -A
git commit -m "docs: pre-release X.Y.Z — step N" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The tree was clean at preflight, so `git add -A` takes only this step's work. Never push.

## Step 1 — Documentation

1. **File specs and plans by version.** For every `src/docs/specs/*.md` and `src/docs/plans/*.md`
   at the top level (never one already in a version folder):
   - its issue: the spec's `**Issue:**` line, or the plan's `wt.sh add <n>` line, else the first
     `#<n>` in the file;
   - **its issue is still open** (in `gh issue list --state open -L 500 --json number --jq '.[].number'`,
     fetched once): it stays at the top level. Specs and plans are committed on main before their
     branch merges, so an open issue is work still in progress;
   - the merge that shipped it: the oldest merge naming its issue branch,
     `git log main --merges --format='%H %s' | grep -E "issue/<n>-" | tail -1`. **No such merge
     into main:** it stays at the top level;
   - **a doc that names no issue at all:** the only case that falls back to the commit that added
     the file, `git log main --diff-filter=A --format=%H -- <file> | tail -1`. Mark its line "no
     issue: from the commit that added it" and leave it for Mike to place;
   - its version: `git tag --contains <sha> --sort=v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1`
     without the `v`; no tag but merged into main (`git merge-base --is-ancestor <sha> main`) means
     `X.Y.Z`.

   The destination is `src/docs/specs/<ver>/<same name>` or `src/docs/plans/<ver>/<same name>`. A
   spec split across releases files by its first merge. A plan with no matching spec is listed for
   Mike to place by hand, as is every doc that names no issue. The first run backfills every
   existing document; on later runs only this release's are left at the top level. Show the whole
   list, each line with its evidence (open issue, merge or added commit, tag), and those that stay,
   and wait for Mike to confirm or change it.
2. **Find out-of-date docs** and list each candidate with why:
   - wiki lines naming a function that no longer exists, or contradicting the code:
     `./src/tests/run.sh docs`, plus a grep for each `name()` the wiki cites;
   - `src/docs/wiki/roadmap/known-issues.md` entries whose issue is closed
     (`gh issue view <n> --json state -q .state`) or whose fix has merged;
   - the released version's roadmap page, `src/docs/wiki/roadmap/X.Y.Z.md`, which becomes a record;
   - one-time sections that are done (e.g. RELEASING §4a);
   - specs superseded by a later spec.

   Mike marks each **archive**, **correct** or **keep**:
   - **archive** a whole doc: add it to the move list, to `src/docs/archive/X.Y.Z/<name>.md`
     (prefix the folder when names would collide: a wiki roadmap page becomes `roadmap-X.Y.Z.md`). An
     archived wiki page leaves the index's topic list; its index line moves under "Elsewhere",
     pointing at the archive.
   - **archive** a section: cut it into `src/docs/archive/X.Y.Z/<doc>-<section>.md`, headed with one
     line naming where it came from, and leave a one-line pointer in its place. Never cut from the
     ledger (`src/docs/_claude/WIRING-LEDGER.md`): it is append-only, and the wiki cites its lines.
   - **correct**: show the diff first, then apply it.
   - Nothing is deleted.
3. **Rewrite links.** Write the confirmed moves to the scratchpad as JSON, repo-relative paths under
   `src/docs/`, `[{"from": "src/docs/…", "to": "src/docs/…"}, …]`, then:

   ```bash
   node scripts/move-docs.js <moves.json> --dry-run    # the plan: every move, every file it edits
   node scripts/move-docs.js <moves.json>              # moves the files, rewrites every reference
   ```

   It searches CLAUDE.md, README.md, `build.sh`, `dev.sh`, `.githooks/`, `.claude/skills/`,
   `.github/workflows/`, `data/packs.json`, `scripts/`, `src/` (the wiki, specs, plans, archive,
   `src/docs/*.md`, the ledger, code comments) and `tools/data-kit/`. Repo-rooted and docs-rooted
   paths are rewritten as written; relative links are recomputed from each file's own folder, and
   from a moved file's new folder; fenced blocks are included; and no file gains or loses a line, so
   every ledger `L<n>` citation stays valid. It checks the whole list first (a missing source, a
   target that exists, a path moved twice, a changed extension): a bad list writes nothing and says
   so. A non-text file is moved byte for byte.
4. **If any `src/js/` file changed**, run `./build.sh --no-zip`: the step's commit takes
   `dist/fieldbook.html` with it, since main carries the built artifact and its CI fails on a stale
   one.
5. Run the full suite, `PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh`. The docs suite's link
   check fails on any path to a spec, plan or archived doc that a move missed. Then commit.

**Done when** the confirmed moves and archive/correct decisions are applied, every link resolves,
and the suite is green.

## Step 2 — Outstanding issues

1. **Gather** non-blocking loose ends from: the `## As built` of this release's specs (now in
   `src/docs/specs/X.Y.Z/`: deferred minors, "Open for Mike"); `known-issues.md` entries with no
   issue number; and `.claude/status.md`'s Loose ends and Pending decisions.
2. **De-duplicate** against open issues:
   `gh issue list --state open -L 500 --json number,title,labels,milestone`. A match by title or key
   words is shown as "already #N".
3. **Table** them in the record's "Step 2" table: item, source (file and section), proposed title,
   proposed priority. Mike marks each row **file**, **skip** or **merge with #N**, and confirms or
   changes its priority. Nothing is created until every row is marked.
4. **File** the "file" rows. The milestone is `vX.Y.Z`; the label is the **next fix version**, the
   patch plus one (`1.9.0` → `1.9.1`, `1.9.1` → `1.9.2`), except on a P0; type is the label `bug`
   or `task`. See "Filing an issue" below. "Merge with #N" is `gh issue comment <N> --body "<the
   item>, from <source> (pre-release X.Y.Z)"`.
5. **Write each number back**: into the table's Issue column, and into its source line (a
   known-issues entry gains "(#131)"; so does an As built line or a status loose end).

**Done when** every row is marked and every "file" row has an issue with its priority set.

### Priorities

- **P2**: a minor bug, a visual problem, a tweak.
- **P1**: a medium bug; functionality is affected, a workaround exists, no data is at risk.
- **P0**: a blocker. Only an open P0 in the milestone blocks the release. A P0 is filed in the
  milestone with no fix-version label, whichever step finds it, and step 4's P0 check holds the
  release until it is closed.

### Filing an issue

Set `PRIORITY` to the priority Mike confirmed for this issue. The commands branch on it: a **P0**
gets no fix-version label (it stays in the milestone, where the open-P0 check finds it); a P1 or
P2 carries the next fix version's label.

```bash
PRIORITY=<the priority Mike confirmed: P0, P1 or P2>
NEXT=<the next fix version>
if [ "$PRIORITY" = P0 ]; then
  URL=$(gh issue create --title "<title>" --body-file <body.md> --milestone "vX.Y.Z" \
          --label <bug|task>)
else
  gh label list --search "$NEXT" --json name -q '.[].name' | grep -qx "$NEXT" \
    || gh label create "$NEXT" --color aaaaaa
  URL=$(gh issue create --title "<title>" --body-file <body.md> --milestone "vX.Y.Z" \
          --label <bug|task> --label "$NEXT")
fi
```

The body cites its source (file and section, or the checklist line) and says it came from the
X.Y.Z pre-release.

Then add it to project #3, "RPGFieldbook", with Status **Backlog** and that same `$PRIORITY`. Look
the ids up by name every time; never hard-code them:

```bash
PROJ=$(gh project view 3 --owner wardmanm --format json --jq .id)
F() { gh project field-list 3 --owner wardmanm --format json --jq "$1"; }
STATUS=$(F '.fields[]|select(.name=="Status")|.id')
BACKLOG=$(F '.fields[]|select(.name=="Status")|.options[]|select(.name=="Backlog")|.id')
PRIO=$(F '.fields[]|select(.name=="Priority")|.id')
PICK=$(F ".fields[]|select(.name==\"Priority\")|.options[]|select(.name==\"$PRIORITY\")|.id")
[ -n "$PICK" ] || echo "no Priority option named $PRIORITY: stop"
ITEM=$(gh project item-add 3 --owner wardmanm --url "$URL" --format json --jq .id)
gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$STATUS" --single-select-option-id "$BACKLOG"
gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$PRIO" --single-select-option-id "$PICK"
```

If a project write fails (a missing `project` scope: `gh auth refresh -s project`; or the network),
the issue is still filed: record it as "#N (priority not set)" and come back to it.

## Step 3 — The QA checklist

1. **Build** the release candidate: `./build.sh --no-zip`. It also bundles `dist/srd52_full.json`
   for the pre-drive.
2. **Write `src/docs/QA-CHECKLIST.md` from scratch**, every run (a rebuild carries Mike's marks
   forward: see 5 below):
   - Top: `# QA checklist X.Y.Z`, then "Generated against `<short sha>` (<subject>) on YYYY-MM-DD",
     the sha being `git rev-parse --short HEAD` now, then Mike's marks: `- [x]` when a line passes,
     `FAIL: <what happened>` appended to a line that fails.
   - One `## ` section per app area, in tab order: Home, Sheet, Combat, Spells, Inventory, Bio, Journal, Rules, Settings, Extensions and updates.
     Each has **New in this release** (lines written from this version's `UNRELEASED.md` bullets,
     the milestone's closed issues, `gh issue list --milestone vX.Y.Z --state closed -L 500 --json number,title`,
     and the testing section of each spec in `src/docs/specs/X.Y.Z/`, each line ending with its
     source, e.g. "(#105)"), then **Still works**: that area's lines from `src/docs/qa/smoke.md`,
     word for word. Never edit `smoke.md`: Mike owns it.
   - Last, `## Device pass`: touch, print, Safari and Firefox, real phones, his own characters, and
     every specific device item in `.claude/status.md`'s Loose ends.
   - Every line is a checkbox, `- [ ] <what to do>: <what you should see>`.
3. **Pre-drive** every line you can, in the project's Playwright MCP (`mcp__playwright__*`, never a
   plugin's: it refuses `file://`), at 1280 and 390 wide (`browser_resize`), in both skins: a
   `newCharacter("QA", "dnd")` sheet is classic, a `newCharacter("QA", "humblewood")` sheet is
   humblewood. Open `file://<repo>/dist/fieldbook.html`. A line that needs rules data: install
   `dist/srd52_full.json` through Settings → Extensions → Manual install (`browser_file_upload`).
   - a pass: `- [x] <line> ✓ Claude, Chrome 1280/390`;
   - a failure: `- [ ] <line> ✗ Claude: <what happened>`, listed back to Mike as a probable bug, with
     a screenshot in `.claude/qa/pre-release-X.Y.Z/`;
   - a line you can't drive (touch, print, another browser, a real phone, his characters):
     `- [ ] <line> (not driven: <why>)`.
4. **Restore the build** after the pre-drive and before the commit, as always:
   `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`. Then commit, and tell Mike the
   checklist is ready for his pass: how many lines, how many you drove, the probable bugs.
5. **A rebuild** (only after Mike says yes, see the preflight) never wipes his marks. Before
   writing, read the old checklist. A line's text is the line without its checkbox and without
   the marks (`✓ Claude…`, `✗ Claude: …`, `(not driven: …)`, `FAIL: …`). Every new line whose
   text is unchanged keeps its old checkbox and marks: his ticks and `FAIL:` notes come forward
   as they were. Pre-drive only the lines that are new or changed, plus any area Mike asks to be
   re-driven. Say how many lines carried forward and how many changed.

**Done when** the checklist is written and the pre-drive has run over every line.

## Step 4 — Bugs from QA

1. Mike tests from the checklist (his device pass, and every line not driven) and marks it.
2. Read every line with `FAIL:` and every `✗ Claude` line he has not dismissed (ticking it `- [x]`
   dismisses it). For each, propose a title and a priority, and wait for his confirmation.
3. **P2 and P1** are filed as in step 2 (milestone, next fix version label, project, Backlog,
   Priority). **P0** is filed in the milestone with Priority P0 and no fix version label. Each goes in
   the record's "Step 4" table with its checklist line and its state.
4. **An open P0 holds this step open**, whichever step filed it. Mike fixes it through the normal
   worktree flow. Each rerun re-checks: an issue number in both lists is an open P0.

   ```bash
   gh issue list --milestone "vX.Y.Z" --state open -L 500 --json number --jq '.[].number'
   gh project item-list 3 --owner wardmanm --format json -L 2000 \
     --jq '.items[]|select(.content.type=="Issue" and .milestone.title=="vX.Y.Z" and .priority=="P0")|.content.number'
   ```
5. Commit.

**Done when** Mike says the checklist is finished, every failure has an issue with its priority
set, and no P0 in the milestone is open.

## Step 5 — Release notes

1. Read every bullet under `## Pending` in `src/docs/UNRELEASED.md` as a player would, and flag:
   internal words (function, file or field names, "migrate", issue numbers, "As built", "ledger");
   markdown the app shows as typed (backticks, `**`: `openChangelog()` prints notes as plain text);
   vague or over-long bullets; and two bullets about one change.
2. Show each flagged bullet with a suggested rewrite. Mike accepts, edits or keeps each; write the
   accepted ones into `UNRELEASED.md`. No angle brackets and no version numbers (the docs suite
   refuses both).
3. Show the whole set the way the app's "What's new" will show it: under `vX.Y.Z` and today's date,
   one item per bullet, a wrapped bullet joined into one line. Ask for a final yes.
4. Commit.

**Done when** Mike gives the final yes. Then say: "Pre-release X.Y.Z is complete — run /release
X.Y.Z." Stop there.

## Red flags — stop

| Thought | Reality |
|---|---|
| "I'm on a branch, I'll switch to main" | Refuse and name the branch; Mike switches |
| "The move list is obvious, I'll just run it" | Mike confirms the list first; the dry run shows it |
| "This loose end is clearly P1, I'll file it" | Nothing reaches GitHub before he marks the row |
| "I'll fix the ledger link by hand" | `move-docs.js` rewrites it in place; a hand edit can shift a line and break every `L<n>` below |
| "A P1 bug is bad, I'll hold the release" | Only an open P0 blocks |
| "I couldn't drive that line, I'll tick it" | It stays `- [ ]` with `(not driven: <why>)` |
| "Main moved, but the checklist is close enough" | Ask whether to rebuild step 3; it reopens 3, 4 and 5 |
| "I'll rebuild the checklist from scratch" | His ticks and `FAIL:` notes carry forward to every unchanged line |
| "The tree is dirty, but it's only his checklist marks" | Commit the two files as the record commit first; anything else, refuse |
| "It's a P0, but the template adds the fix-version label" | A P0 never gets the fix-version label; set `PRIORITY` and the commands branch |
| "Every step is done, I'll run /release" | Stop. `/release` is Mike's to type |
| "I'll push the step commits" | Never: they go up with the release |
