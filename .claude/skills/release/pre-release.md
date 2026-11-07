# Pre-release (part of /release)

`/release` follows this for an app release whose pre-release record isn't complete (`SKILL.md`
§1a): specs and plans filed by version, out-of-date docs archived or corrected, loose ends filed as
issues, a high-level test pass for Mike over everything new plus Claude's separate pre-drive, their
bugs filed, and release notes a player can read. `X.Y.Z` is the version `/release` named. (It was
its own command, `/pre-release`, until #180.)

The design, which binds this procedure: `src/docs/specs/1.9.0/2026-10-29-pre-release-design.md`. The
record this skill keeps is what `scripts/release.js` checks: `./build.sh --release X.Y.Z` refuses
until `src/docs/PRE-RELEASE.md` names exactly `X.Y.Z` with all five steps `done`. Run
`node scripts/pre-release-record.js X.Y.Z` to see what it would say: it prints
`pre-release X.Y.Z: complete` and exits 0, or prints the refusal and exits 1.

**The milestone** for release X.Y.Z is `vX.Y.0`, the minor line's: every X.Y.x issue is on it,
and there is no `vX.Y.1` (Mike, 2026-11-05; #199). Steps 2 and 4 file into it, and the open-P0
check reads it, so an open P0 anywhere in the line holds the release. Step 3 picks this release's
own issues out of it by date: the ones closed since the previous release's tag.

## Who decides what

Mike typing `/release` for an app release is his instruction to prepare it. **He decides; you
propose and then carry out what he confirmed.** He confirms:

- the move list, and archive, correct or keep for each out-of-date doc (step 1);
- file, skip or merge with #N for each loose end, and its priority (step 2);
- the title and priority of each bug (step 4);
- each release-note rewrite, and the final yes (step 5).

Nothing is written to GitHub (issues, labels, project fields, comments) before his confirmation.
You commit each step on main. **You never push here, and nothing is cut here:** the cut and the
push are `/release`'s own gates (`SKILL.md` §3–§5), after step 5.
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
  leaving out this pre-release's own commits and any commit that touches only the two files or
  the status log, `.claude/status.md` (a routine `docs(repo): status` commit is not new work):

  ```bash
  git log --format='%h %s' <that commit>..HEAD --invert-grep --grep='^docs: pre-release X\.Y\.Z — ' \
    -- . ':!src/docs/PRE-RELEASE.md' ':!src/docs/QA-CHECKLIST.md' ':!.claude/status.md'
  ```

  Anything listed is work merged since the checklist was built (a merged P0 fix is expected
  here). Say so, list it, and **ask** whether to rebuild step 3; Mike may decline, or ask for only
  the areas the new work touched to be re-driven. If he declines, add "Kept at `<short sha>` on
  YYYY-MM-DD" (HEAD now) under the checklist's header and commit it as the record commit, so the
  next check starts there. A rebuild reopens step 3 and every later step
  (3, 4 and 5: new work can bring new release notes), and carries his marks forward (step 3).
- **Every step already done.** Run `node scripts/pre-release-record.js X.Y.Z`, then re-check two
  things: whether main has moved (above), and whether a P0 is open (step 4's query). If neither,
  say "Pre-release X.Y.Z is complete." and go on to `/release`'s preflight (`SKILL.md` §2). If main moved,
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
     `git log main --merges --format='%H %s' | grep -E "issue/<n>-" | tail -1`;
   - **its issue is closed but no merge names it, or the doc names no issue at all:** fall back to
     the commit that added the file, `git log main --diff-filter=A --format=%H -- <file> | tail -1`.
     The issue read from the file can be the wrong one (a first `#<n>` quoted from an example), and
     a closed issue never gains a merge, so without this the doc would stay at the top level for
     good. Mark its line "no merge: from the commit that added it" and leave it for Mike to confirm;
   - its version: `git tag --contains <sha> --sort=v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1`
     without the `v`; no tag but merged into main (`git merge-base --is-ancestor <sha> main`) means
     `X.Y.Z`.

   The destination is `src/docs/specs/<ver>/<same name>` or `src/docs/plans/<ver>/<same name>`. A
   spec split across releases files by its first merge. A plan with no matching spec is listed for
   Mike to place by hand, and every add-commit line waits for his confirmation. Only an open issue
   keeps a doc at the top level. The first run backfills every
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
     (prefixed with its folder when names would collide). The release's roadmap page,
     `src/docs/wiki/roadmap/X.Y.Z.md`, always becomes `src/docs/archive/X.Y.Z/roadmap-X.Y.Z.md`, the
     name `/release` reads. An archived wiki page leaves the index's topic list; its index line
     moves under "Elsewhere", pointing at the archive.
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
   `.claude/status.md`, `.github/workflows/`, `data/packs.json`, `scripts/`, `src/` (the wiki,
   specs, plans, archive, `src/docs/*.md`, the ledger, code comments), `tools/data-kit/`, and, when
   `_private-data` is linked, the private repo's `tests/leak-allowlist.json`, which names public
   files by path. Repo-rooted and docs-rooted
   paths are rewritten as written; relative links are recomputed from each file's own folder, and
   from a moved file's new folder; fenced blocks are included; and no file gains or loses a line, so
   every ledger `L<n>` citation stays valid. It checks the whole list first (a missing source, a
   target that exists, a path moved twice, a changed extension, a folder or file it cannot write):
   a bad list writes nothing and says so. A non-text file is moved byte for byte. It removes the
   moved sources last; if a write still fails part way, it stops, names what it wrote, and prints
   the commands that undo exactly that. Show them to Mike, run them only once he agrees, then fix
   the cause and run the same list again.
   When the run ends "the private repo changed too", the allowlist is committed with the step (5).
4. **If any `src/js/` file changed**, run `./build.sh --no-zip`: the step's commit takes
   `dist/fieldbook.html` with it, since main carries the built artifact and its CI fails on a stale
   one.
5. Run the full suite, `PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh`. The docs suite's link
   check fails on any path to a spec, plan or archived doc that a move missed, and the
   `private-data` suite's leak scan on an allowlist path the move missed. Then commit the step, and,
   **if the private repo changed**, commit it there too:

   ```bash
   git -C _private-data add tests/leak-allowlist.json
   git -C _private-data commit -m "docs: pre-release X.Y.Z — paths moved" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
   ```

   Never push it here. It is pushed **right after public main, never before**, when `/release`
   pushes (CLAUDE.md, "the private packs move with this repo"): its leak scan reads the public
   tree, so before then its CI would look for the moved docs at paths public main does not have
   yet. Every checkout shares the one private clone, so a worktree branched before this step reports
   stale allowlist entries in its `private-data` suite until it merges main: say so to Mike.

**Done when** the confirmed moves and archive/correct decisions are applied, every link resolves,
the suite is green, and a changed private allowlist is committed in the private repo (not pushed).

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
4. **File** the "file" rows. The milestone is `vX.Y.0` (above); the label is the **next fix
   version**, the patch plus one (`1.9.0` → `1.9.1`, `1.9.1` → `1.9.2`), except on a P0; type is
   the label `bug` or `task`. See "Filing an issue" below. "Merge with #N" is `gh issue comment <N> --body "<the
   item>, from <source> (pre-release X.Y.Z)"`.
5. **Write each number back**: into the table's Issue column, and into its source line (a
   known-issues entry gains "(#131)"; so does an As built line or a status loose end).
6. **Commit straight after filing**, in the same session: the record and every write-back
   (`known-issues.md`, a spec's As built, `.claude/status.md`) go into step 2's own commit,
   `docs: pre-release X.Y.Z — step 2`, even while a "priority not set" keeps the step open (finishing
   it later commits again under the same message). Never leave a write-back uncommitted between
   sessions: the preflight allows only the record and the checklist to be dirty, and would refuse.

**Done when** every row is marked and every "file" row has an issue with its priority set.

### Priorities

- **P2**: a minor bug, a visual problem, a tweak.
- **P1**: a medium bug; functionality is affected, a workaround exists, no data is at risk.
- **P0**: a blocker. Only an open P0 in the milestone blocks the release. A P0 is filed in the
  milestone with no fix-version label, whichever step finds it, and step 4's P0 check holds the
  release until it is closed.

### Filing an issue

One issue is **one block, run as ONE Bash call**: Claude Code keeps no shell variables between
calls, so a block split across two calls would run its second half with `$URL` and `$PRIORITY`
empty. Fill in the five placeholders with literal values (`PRIORITY`, `NEXT`, the title, the
label, and the milestone's `X.Y`) and the body between the `BODY` lines; nothing else changes.

- `PRIORITY` is the priority Mike confirmed, exactly `P0`, `P1` or `P2` (uppercase). The block
  checks it first and exits on anything else, before it writes anything.
- A **P0** gets no fix-version label (it stays in the milestone, where the open-P0 check finds it);
  a P1 or P2 carries the next fix version's label, `NEXT`.
- The project's ids are looked up by name every time, never hard-coded, and **before** the issue
  is created: a missing `project` scope (`gh auth refresh -s project`) or a network failure stops
  the block with nothing filed. Fix it and run the block again.
- The body goes in on stdin (`--body-file -`), so no body file is ever written into the repo for
  `git add -A` to take. It cites its source (file and section, or the checklist line) and says it
  came from the X.Y.Z pre-release.

```bash
PRIORITY=<P0, P1 or P2: the priority Mike confirmed>
NEXT=<the next fix version>
case "$PRIORITY" in P0|P1|P2) ;; *) echo "PRIORITY must be P0, P1 or P2, not '$PRIORITY': nothing filed"; exit 1;; esac
PROJ=$(gh project view 3 --owner wardmanm --format json --jq .id)
F() { gh project field-list 3 --owner wardmanm --format json --jq "$(cat)"; }   # the jq filter comes on stdin: never a positional
STATUS=$(F <<<'.fields[]|select(.name=="Status")|.id')
BACKLOG=$(F <<<'.fields[]|select(.name=="Status")|.options[]|select(.name=="Backlog")|.id')
PRIO=$(F <<<'.fields[]|select(.name=="Priority")|.id')
PICK=$(F <<<".fields[]|select(.name==\"Priority\")|.options[]|select(.name==\"$PRIORITY\")|.id")
[ -n "$PROJ" ] && [ -n "$STATUS" ] && [ -n "$BACKLOG" ] && [ -n "$PRIO" ] && [ -n "$PICK" ] \
  || { echo "project #3 lookup failed (scope, network, or no Priority option $PRIORITY): nothing filed"; exit 1; }
LABELS=(--label <bug|task>)
if [ "$PRIORITY" = P0 ]; then
  :   # a P0 carries no fix-version label
else
  gh label list --search "$NEXT" --json name -q '.[].name' | grep -qx "$NEXT" \
    || gh label create "$NEXT" --color aaaaaa || exit 1
  LABELS+=(--label "$NEXT")
fi
OUT=$(mktemp)   # the body is never inside $(…): macOS bash 3.2 can't parse an apostrophe there
gh issue create --title "<title>" --milestone "vX.Y.0" "${LABELS[@]}" --body-file - > "$OUT" <<'BODY'
<the body>
BODY
URL=$(tail -1 "$OUT"); rm -f "$OUT"
[ -n "$URL" ] || { echo "gh issue create failed: nothing filed"; exit 1; }
echo "filed $URL"
N=${URL##*/}
ITEM=$(gh project item-add 3 --owner wardmanm --url "$URL" --format json --jq .id 2>/dev/null)
for try in 1 2 3; do   # project #3 auto-adds new issues, so item-add can fail "already exists": find that item
  [ -n "$ITEM" ] && break; sleep 2
  ITEM=$(gh project item-list 3 --owner wardmanm --format json -L 2000 --jq ".items[]|select(.content.number==$N)|.id")
done
[ -n "$ITEM" ] \
  && gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$STATUS" --single-select-option-id "$BACKLOG" \
  && gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$PRIO" --single-select-option-id "$PICK" \
  || { echo "filed $URL, but its project fields were not set: record it as (priority not set)"; exit 1; }
```

Project #3 adds every new issue to itself, so `item-add` often fails with "Content already exists
in this project": the block then finds that item by issue number and sets its fields on it.
If the block ends "filed …, but its project fields were not set", the issue exists: record it as
"#N (priority not set)" and come back to it (the step is not done until it is set).

## Step 3 — The test pass, and Claude's pre-drive

Two separate things (Mike, 2026-11-02): **the test pass** is Mike's, a high-level manual pass over
everything new in the release, with nothing of Claude's in it; **the pre-drive** is Claude's own
detailed run, kept out of the repo, whose failures reach Mike only as probable bugs in step 4.

1. **Build** the release candidate: `./build.sh --no-zip`. It also bundles `dist/srd52_full.json`
   for the pre-drive.
2. **Write the test pass, `src/docs/QA-CHECKLIST.md`, from scratch** (a rebuild carries Mike's marks
   forward: see 5 below):
   - Top: `# Test pass X.Y.Z`, then "Generated against `<short sha>` (<subject>) on YYYY-MM-DD",
     the sha being `git rev-parse --short HEAD` now, then how to mark: `- [x]` when a line holds,
     `FAIL: <what happened>` appended to a line that doesn't.
   - **One `## <feature> (#N)` section per thing going into the release**: this release's closed
     issues that change what a player sees, and the `UNRELEASED.md` bullets, one section per feature
     (several issues of one feature share a section). This release's issues are the ones closed as
     completed in the milestone since the previous release's tag, whatever their labels: a feature
     or a P0 carries no fix-version label, and a later patch's issue fixed early ships too (#199).
     One Bash call, since the two variables don't survive between calls:

     ```bash
     PREV=$(git tag --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)   # the previous release
     T=$(git log -1 --format=%ct "$PREV")
     gh issue list --milestone "vX.Y.0" --state closed -L 500 --json number,title,labels,closedAt,stateReason \
       --jq ".[]|select(.stateReason==\"COMPLETED\" and (.closedAt|fromdateiso8601) > $T)|\"#\(.number) \(.title)\""
     ```

     Each has three to six **high-level** lines: a scenario to play through and what should hold,
     the way a player would try it (e.g. "Level a character to 4 and take a feat you don't qualify
     for: the list, the warning and the +1 all make sense"). Not one line per detail: the specs'
     testing sections and the pre-drive cover the detail.
   - `## Across the app`: both skins, light and dark; phone width; offline; an old character
     loading; print.
   - Last, `## Device pass`: touch, Safari and Firefox, real phones, his own characters, and every
     specific device item in `.claude/status.md`'s Loose ends.
   - Every line is a checkbox, `- [ ] <scenario>: <what should hold>`. **No Claude marks** in this
     file, ever: no ticks, no `✓ Claude`, no `(not driven)`.
3. **Pre-drive, separately.** Claude's own detailed run, in the project's Playwright MCP
   (`mcp__playwright__*`, never a plugin's: it refuses `file://`), at 1280 and 390 wide
   (`browser_resize`), in both skins: a `newCharacter("QA", "dnd")` sheet is classic, a
   `newCharacter("QA", "humblewood")` sheet is humblewood. Open `file://<repo>/dist/fieldbook.html`.
   A line that needs rules data: install `dist/srd52_full.json` through Settings → Extensions →
   Manual install (`browser_file_upload`).
   - What it drives: a line for every check in the testing sections of this release's specs
     (`src/docs/specs/X.Y.Z/`), each ending with its source, then every line of
     `src/docs/qa/smoke.md` (the standing regression set; never edit it: Mike owns it), by app area
     in tab order: Home, Sheet, Combat, Spells, Inventory, Bio, Journal, Rules, Settings, Extensions and updates.
   - Its report: `.claude/qa/pre-release-X.Y.Z/predrive.md` (not in the repo), screenshots beside
     it. A pass `- [x] <line> ✓`; a failure `- [ ] <line> ✗ <what happened>` with a screenshot;
     a line it can't drive `- [ ] <line> (not driven: <why>)`.
   - It never writes to `QA-CHECKLIST.md`. Its failures are listed to Mike as probable bugs.
4. **Restore the build** after the pre-drive and before the commit, as always:
   `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`. Then commit, and tell Mike the test
   pass is ready: how many features and lines, and the pre-drive's probable bugs.
5. **A rebuild** (only after Mike says yes, see the preflight) never wipes his marks. Before
   writing, read the old test pass. A line's text is the line without its checkbox and without
   `FAIL: …`. Every new line whose text is unchanged keeps his checkbox and `FAIL:` note. Re-run the
   pre-drive for the areas the new work touched, and any Mike asks for. Say how many lines carried
   forward and how many changed.

**Done when** the test pass is written and the pre-drive report covers every line it lists.

## Step 4 — Bugs from QA

1. Mike works through the test pass and marks it.
2. Gather the failures: every `FAIL:` line in the test pass, and every `✗` line in the pre-drive
   report. Show the pre-drive's as probable bugs; Mike dismisses any he disagrees with. For each
   remaining one, propose a title and a priority, and wait for his confirmation.
3. **P2 and P1** are filed as in step 2 (the milestone `vX.Y.0`, next fix version label, project,
   Backlog, Priority). **P0** is filed in the milestone with Priority P0 and no fix version label.
   Each goes in the record's "Step 4" table with its checklist line and its state.
4. **An open P0 holds this step open**, whichever step filed it. Mike fixes it through the normal
   worktree flow. Each rerun re-checks: an issue number in both lists is an open P0.

   ```bash
   gh issue list --milestone "vX.Y.0" --state open -L 500 --json number --jq '.[].number'
   gh project item-list 3 --owner wardmanm --format json -L 2000 \
     --jq '.items[]|select(.content.type=="Issue" and .milestone.title=="vX.Y.0" and .priority=="P0")|.content.number'
   ```
5. Commit.

**Done when** Mike says the test pass is finished, every failure has an issue with its priority
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

**Done when** Mike gives the final yes. Then say "Pre-release X.Y.Z is complete." and go on to
`/release`'s preflight (`SKILL.md` §2) in the same run: Gate 1 still asks for the number before
anything is cut.

## Red flags — stop

| Thought | Reality |
|---|---|
| "I'm on a branch, I'll switch to main" | Refuse and name the branch; Mike switches |
| "The move list is obvious, I'll just run it" | Mike confirms the list first; the dry run shows it |
| "This loose end is clearly P1, I'll file it" | Nothing reaches GitHub before he marks the row |
| "I'll fix the ledger link by hand" | `move-docs.js` rewrites it in place; a hand edit can shift a line and break every `L<n>` below |
| "A P1 bug is bad, I'll hold the release" | Only an open P0 blocks |
| "1.9.1's milestone is v1.9.1" | There is none: release X.Y.Z's milestone is `vX.Y.0`, the line's |
| "I couldn't drive that line, I'll tick it" | It stays `- [ ]` with `(not driven: <why>)` |
| "Main moved, but the checklist is close enough" | Ask whether to rebuild step 3; it reopens 3, 4 and 5 |
| "I'll rebuild the checklist from scratch" | His ticks and `FAIL:` notes carry forward to every unchanged line |
| "The tree is dirty, but it's only his checklist marks" | Commit the two files as the record commit first; anything else, refuse |
| "It's a P0, but the template adds the fix-version label" | A P0 never gets the fix-version label; set `PRIORITY` and the commands branch |
| "I'll run the filing block in two calls" | One Bash call: variables do not survive between calls |
| "Every step is done, I'll cut" | Go on to `/release`'s preflight and Gate 1: the number is Mike's to confirm |
| "The test pass isn't finished, I'll go on to step 5" | Stop and say what step 4 waits on; his next `/release X.Y.Z` resumes |
| "I'll push the step commits" | Never: they go up with the release |
| "The private allowlist is committed, I'll push it" | Never before public main: `/release` pushes it right after |
