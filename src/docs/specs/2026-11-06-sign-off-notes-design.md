# `/sign-off-notes`: notes during the test pass — design

**Status:** approved 2026-11-06 (Mike).
**Issue:** not filed yet: a task, filed by Mike with `/issue` once this is approved. One branch.
**Depends on:** the pre-release's milestone fix (decision 18), its own issue, built first.
**Why:** while Mike works through a release's test pass he notices things that don't fail the line he
is on: a bug elsewhere, a change he wants, a new idea. Today he has to leave the pass to `/issue` each
one, or keep a list and file it later. This is a side command he runs in a second window that files
each note as he goes, without touching the pass. It mirrors `/sign-off-notes` in rollcall_derby
(Mike, 2026-11-06), fitted to Fieldbook's pre-release.

**Read first:**
- `.claude/skills/release/pre-release.md`: the record, step 3 (the test pass) and step 4 (bugs from QA).
- `.claude/skills/issue/SKILL.md`: the fields, the draft and the filing block this reuses.
- [Building & CI](../wiki/process/building-and-ci.md), "`/release` (with its pre-release), `/issue`
  and `/status`".
- [The pre-release spec](1.9.0/2026-10-29-pre-release-design.md) §2–§3: the record and the priorities.

---

## 1. What it is

A new skill, **`/sign-off-notes [X.Y.Z]`**, that only Mike starts (`disable-model-invocation: true`). He
runs it in a second Claude window, open in the same checkout, while he marks the test pass
(`src/docs/QA-CHECKLIST.md`). Each message is one note starting with its kind: **`Bug - …`**
(something doesn't work), **`Change - …`** (alter something that exists) or **`Feat - …`** (something
new). Case doesn't matter, and `-` or `:` both work. A few follow-up questions, about details or how
serious it is, are fine.

For each note it either files a GitHub issue, once Mike confirms its title and priority, and adds a row
for it to the pre-release record's "Step 4: bugs from QA" table, or it tells him which test-pass line
the note fails and gives him the exact text to put on it.

## 2. How rollcall's design fits Fieldbook

| Rollcall | Fieldbook |
|---|---|
| A sign-off record with a checks table | `src/docs/PRE-RELEASE.md`. The checks are the lines of `src/docs/QA-CHECKLIST.md` |
| The release skill walks Mike through the checks, one at a time | No walk-through: step 3 writes the test pass and stops. Mike marks it himself in his editor, in any order (`- [x]`, or `FAIL: …` added to a line), and his next `/release` collects the failures (step 4) |
| A check is numbered; pending / passed / skipped | A line is named by its section and its text; it is ticked, unticked, or has a `FAIL:` |
| `<app> <version>` | `[version]`: Fieldbook is one app |
| A `## Found while testing` list | Rows in the existing Step 4 table, the same table `/issue` adds `reported by Mike` rows to |
| Priority P1 (soon) / P2 (deferred), never in the milestone | Bugs: P1/P2 by Fieldbook's severity meanings, in the minor line's milestone (v1.9.0), with a fix-version label. Only an open P0 blocks, so neither holds the release |
| Labels: kind, `sign-off`, app | `bug` or `feature` only |
| A blocker goes to the release window | No release window is running. Fieldbook's blocker is a P0 issue, so the side window files it as one |
| "Try check N again", "add a check" | Not needed: Mike unticks or adds lines himself |

## 3. Decisions

| # | Decision | Whose |
|---|---|---|
| 1 | A separate skill only Mike starts, run in a second window in the same checkout; optional version; without one it uses the record there is | Mike, rollcall handoff |
| 2 | One note per message, its kind first (`Bug`, `Change`, `Feat`; any case; `-` or `:`); a few follow-ups are fine | Mike, rollcall handoff |
| 3 | Filed as soon as Mike confirms its title and priority | Mike, rollcall handoff |
| 4 | Recorded as a row in PRE-RELEASE.md's "Step 4: bugs from QA" table; never in QA-CHECKLIST.md, which carries no Claude marks | Mike, 2026-11-06 |
| 5 | Bugs: Priority P1 or P2 by severity (P1 a medium bug with a workaround, no data at risk; P2 minor, visual, a tweak), the minor line's milestone (decision 18), the fix-version label, Status Backlog | Mike, 2026-11-06 ("as /issue") |
| 6 | Changes and features: no priority (`—` in the row), no milestone unless Mike names one, Status Backlog | Mike, 2026-11-06 ("as /issue") |
| 7 | Labels: `bug` for a Bug, `feature` for a Change or a Feat; no new labels. The body says which kind it is | Mike, 2026-11-06 |
| 8 | A note that should block the release and that no line covers: the side window files it itself as a **P0** (the milestone, no fix-version label), with a Step 4 row. The open-P0 check then holds the release | Mike, 2026-11-06 |
| 9 | A bug's body follows the bug form (What happened / What should happen / Where), and the side window looks for a cause in the code as `/issue` does | Mike, 2026-11-06 |
| 10 | A change's or a feature's body follows the feature form (What / Why) | Mike, rollcall handoff |
| 11 | The line he was on is guessed (the first line neither ticked nor marked `FAIL:`) and shown in the draft, for him to correct | Mike, 2026-11-06 |
| 12 | The command is `/sign-off-notes`, the same name as in rollcall | Mike, 2026-11-06 |
| 13 | A spec first, then an issue and one worktree | Mike, 2026-11-06 |
| 14 | A note that means any line's "what should hold" didn't hold (the one he's on, a later one, or one already ticked) is not filed: the side window names the line and gives him the `FAIL:` text for it | Mike, rollcall handoff, carried over |
| 15 | If the kind looks wrong, it asks which kind before drafting (a Change the wiki or spec already promises is really a Bug) | Mike approved, rollcall handoff |
| 16 | It never changes the test pass, a mark, or the commit the test pass names; it never commits, pushes or switches branches | Mike, rollcall handoff |
| 17 | The release skill names the command when it hands Mike the test pass, and lists what it filed before asking whether the pass is finished | Mike, rollcall handoff |
| 18 | The milestone for release X.Y.Z is **vX.Y.0**, the minor line's (every 1.9.x issue is on v1.9.0). The pre-release's open-P0 check and filing blocks read `vX.Y.Z` today, which for 1.9.1 names a milestone that doesn't exist, so a P0 filed in v1.9.0 would never hold the release. That is fixed first, as its own issue (the P0 query in both release files, the filing blocks, and `/issue`'s pre-release row rule); this skill then takes vX.Y.0 from the record's version | Mike, 2026-11-06 |
| 19 | Once step 4 is `done` (Mike has said the pass is finished), it refuses and points to `/issue`: nothing in the pre-release would pick up a `FAIL:` added after that. A P0 filed through `/issue` is still caught by `/release`'s open-P0 re-check | Mike, 2026-11-06 |

## 4. The skill

### 4.1 Starting

Read-only checks, in this order; any failure stops with one line saying why:

- **On main, in the checkout that has the record.** `git branch --show-current` must print `main`
  (the pre-release runs only on main). Off main: name the branch and stop. A worktree does not
  see the record, which is often uncommitted on main.
- **The record.** `src/docs/PRE-RELEASE.md` exists, its heading names `X.Y.Z` (the version typed, or
  the record's own when none was), its step 3 is `done`, its step 4 is `open`, and it has a
  `## Step 4: bugs from QA` table. Step 4 already `done`: the pass is over; say so and point to
  `/issue` (decision 19).
- **The test pass.** `src/docs/QA-CHECKLIST.md` exists and is headed `# Test pass X.Y.Z`.
- **Once per session:** the milestone, `vX.Y.0` from the record's version (decision 18), which must
  exist and be open (`gh api repos/:owner/:repo/milestones`; if not, stop and say so); and the
  fix-version label, `X.Y.Z`'s patch plus one (the pre-release's rule: the 1.9.1 test pass files
  `1.9.2`). The build under test is the last `Generated against` or `Kept at` sha in the test pass's
  header.

Then one line: what it's ready for, and the three kinds.

### 4.2 A note arrives

1. **The kind.** Read it from the start of the message. Missing or not one of the three: ask.
2. **Re-read the test pass**, every time (Mike marks it as he goes). The line he's on is the first
   line that is neither ticked nor marked `FAIL:`; with none left, ask which.
3. **Compare the note with every line**, in every section, whatever its mark. If the note means some
   line's "what should hold" did not hold, **file nothing**. Say which section and line, and give
   him the text to add to it: `FAIL: <what he saw, in his words>`. If that line is ticked, tell him
   to untick it; if it already has a `FAIL:`, the text extends it. Step 4 files it later, as a P0 if
   it should block. The side window never edits the test pass itself.
4. **Does it block the release?** If the note should hold the release (a crash, data lost, something
   a player can't get past) and no line covers it, propose **P0** and say why. Only a Bug can be a P0.
5. **Check the kind.** Read the wiki page for the area (and this release's spec for it, if there is
   one). A Change or Feat that the page or spec already says works is probably a Bug; a Bug about
   something the page says is intended is probably a Change. Ask which before drafting.
6. **Duplicates**, as `/issue` §2 does: an open issue that covers it is shown as "this looks like #N";
   Mike chooses between filing anyway and a comment on #N.
7. **A bug's cause**, as `/issue` §1 does: a few minutes in the code; name the file, line and function
   if found, say plainly if not, never guess.

### 4.3 The draft

Shown whole, as `/issue` §4 shows it: title, labels, milestone, project fields, body. Then: "File it
as P2, or change anything first?" (for a feature, "File it?"), and wait. Mike's yes covers the title
and the priority.

**A bug:**

```markdown
**What happened**
<what he saw, in his words; the steps if he gave them>

**What should happen**
<in his words, or what the wiki page says>

**Where** — <tab> / <D&D, SRD 5.2 or Humblewood> / the X.Y.Z test-pass build (`<sha>`)

**Cause:** <file:line and function, one or two sentences; or "not found">

**Found during:** the X.Y.Z test pass, while on <section>: "<the line's first words>…"
```

**A change or a feature:**

```markdown
**What**
<what's wanted, in his words; for a Change, what it does now and what it should do instead>

**Why**
<why it matters to a player>

**Area:** <wiki page title> (`src/docs/wiki/<path>.md`)
**Found during:** the X.Y.Z test pass, while on <section>: "<the line's first words>…"
```

"Found during" says *when* he noticed it, not what it is about, so it carries no issue number: the
`(#103)` on a section heading and any `#N` in the line are left out, or the two would read as linked.
For a bug, end the draft with a reminder that `gh` can't attach a screenshot, so he can drop one into
the issue on GitHub after it is filed.

### 4.4 Filing and recording

- **File** with `/issue` §5's block, copied into this skill: one Bash call, the body on stdin, the
  project ids looked up before anything is created, the item found by number with `-L 2000` and three
  retries when the auto-add got there first. `KIND` is `bug` or `feature`; a P0 gets no fix-version
  label and a feature no priority, as that block already does.
- **Record**, straight after: re-read `src/docs/PRE-RELEASE.md` (another window may have written it),
  then append one row to the end of the Step 4 table:

  ```markdown
  | while on Level-up: "Type enough XP into the header…" | <title> | P2 | #190 | open |
  | while on Trade: "Open a trade with…" (a feature) | <title> | — | #191 | open |
  ```

  No `|` and no relative link in any cell (the record's rule). A comment on an existing issue (step 6)
  adds a row with that issue's number and title, its Priority cell that issue's Priority on the board
  (`—` if it has none), its Issue cell `#N (noted)`. When the copied block ends "its project fields
  were not set" (`/issue`'s words are "set them by hand"), the row's Issue cell is
  `#N (priority not set)`, as the pre-release writes it, and the report says to set it.
- **Report** the number and link, and what was set. Commit nothing: the next `/release` commits the
  record first.

### 4.5 What it never does

- Edit `QA-CHECKLIST.md`, a mark in it, or the sha in its header.
- Change a step's state in the record, or any row but the one it adds.
- Commit, push, switch branches, or edit any other file.
- Fix what it files.

## 5. Changes to the release skill (`pre-release.md`)

- **Step 3, item 4** (telling Mike the test pass is ready) also says he can run `/sign-off-notes` in a
  second window in this checkout, to file what he notices that doesn't fail a line.
- **Step 4, item 2** (gathering the failures) first lists the rows `/sign-off-notes` added (their Line
  cell starts `while on`) before asking whether the pass is finished. They are filed already: never
  file them again. A `(priority not set)` among them keeps the step open, as it does for any row.
- **Red flags** gain: "A `while on` row isn't filed yet" → it is; `/sign-off-notes` filed it.

`/issue` is unchanged here: its §6 still adds `reported by Mike` rows for issues filed outside the
side window (its "for the milestone's version" condition is corrected by the milestone fix,
decision 18).

## 6. Files

- **New:** `.claude/skills/sign-off-notes/SKILL.md`.
- **Changed:** `.claude/skills/release/pre-release.md` (§5); `src/tests/pre-release.js` and
  `src/tests/docs.js` (§8).
- **Docs** (§9): the ledger, the wiki's building-and-ci page and the decisions register, CLAUDE.md's
  `/issue` line.

## 7. Edge cases

- **Two windows write the record.** The side window re-reads it just before each edit and only
  appends a row to the end of the Step 4 table, so a `/release` run or an `/issue` in between is kept.
- **Mike edits the test pass while a note is open.** It is re-read for each note; the draft names the
  line it guessed, so a stale guess shows.
- **One message, two things.** Split it: one draft each, asked about in turn.
- **A Feat or Change that "must block".** Not a P0: say so, and offer to file it as a Bug if that's
  what it is.
- **`gh` fails, or the `project` scope is missing.** The block stops with nothing filed, or (after the
  issue exists) records `(priority not set)`; say which, and `gh auth refresh -s project`.
- **No open line** (every line marked): ask which line he was on.
- **No record, or step 3 not done:** stop; there is no test pass to note against.
- **Step 4 done while the side window is open** (a `/release` run in between): the next note finds it
  `done` on the re-read; stop and point to `/issue`, as at the start.

## 8. Testing

- **`src/tests/pre-release.js`:** a complete record whose Step 4 table holds rows in exactly the
  side window's format (a P2 bug, a P0, a feature with `—`, a `(noted)` row and a
  `(priority not set)` row) still passes `recordProblem()`, and `parseRecord()` still reads five steps.
  The existing test already shows rows under the Step 4 heading are ignored; this pins the new format.
- **`src/tests/docs.js`:** `/sign-off-notes` is Mike's to start (`name: sign-off-notes`,
  `disable-model-invocation: true`); its filing block is the same block as `/issue`'s, so the two
  can't drift (compared the way the open-P0 query is); it contains no `git commit`, `git push`,
  `git switch` or `git checkout`; `pre-release.md` names `/sign-off-notes` in step 3 and the `while on`
  rows in step 4.
- **A dry run before real use**, by a fresh subagent that follows the skill against scratch copies
  of a record and a test pass (the 1.9.0 ones, renamed to the next version, step 4 set `open`, some
  lines unticked), told to read and write those copies in place of the real paths, GitHub writes
  forbidden (it prints the commands instead). Notes to send: one about a later line (must not be filed: the trap
  the rollcall dry run found), one about a line already ticked, one blocker no line covers (P0), a
  Change the wiki already promises (asks the kind), and a plain Feat. Fix what it finds and run again.
- Then `./src/tests/run.sh`.

## 9. Docs

Ledger entry; wiki: building-and-ci (the `/release`, `/issue` and `/status` section gains
`/sign-off-notes`) and decisions (one register line); CLAUDE.md's "Filing a bug, feature or task" line
names it for the test pass. No UNRELEASED bullet: nothing a player sees. No ADR: this adds to the
pre-release's existing decisions.

## 10. Out of scope

- The pre-release's own milestone rule: its own issue, built first (decision 18).
- Picking up a `FAIL:` added after step 4 is done (decision 19 refuses instead).
- Attaching screenshots (`gh` can't).
- Data and private releases, which have no test pass.
- Notes on Claude's pre-drive report: its failures are already step 4's.

## Claude's calls

Settled while writing, for Mike to check; none changes what gets built in a way the decisions fix.

- **The fix-version label** is the release under test's patch plus one (the pre-release's rule), not
  `/issue`'s milestone-plus-one: the 1.9.1 pass files `1.9.2`, since 1.9.1 is the release in hand.
- **Only a Bug can be a P0**; a Change or Feat never holds the release.
- **Off main it refuses**, naming the branch, as the pre-release does.
- **Duplicates** are checked as `/issue` checks them; a comment on #N records a `(noted)` row.
- **"Where"** names the test-pass build by its sha, since the top bar of a dev build shows no release
  number; the steps, if Mike gives them, go under "What happened".
- **A change or feature names its wiki page** under "Area".
- **`docs.js` keeps the filing block identical to `/issue`'s**, the way it keeps the two open-P0 queries
  identical.
- **CLAUDE.md's `/issue` line** names `/sign-off-notes` for notes during a test pass.
