---
name: sign-off-notes
description: Use when Mike types /sign-off-notes, in a second window while he marks a Fieldbook release's test pass, to file the bugs, changes and features he notices that don't fail a line.
argument-hint: [X.Y.Z]
disable-model-invocation: true
---

# Notes during the test pass

Arguments: `$ARGUMENTS` — optional, the release under test (`X.Y.Z`); without it, the record's own.

Mike runs this in a second Claude window, open in the same checkout as `/release`, while he marks
the release's test pass, `src/docs/QA-CHECKLIST.md`, in his editor. This window files what he
notices that **doesn't fail a line**: a bug somewhere else, a change, a new feature. Each one becomes
a GitHub issue and a row in the pre-release record's "Step 4: bugs from QA" table, which his next
`/release` lists before it asks whether the pass is finished. The design, which binds this:
`src/docs/specs/2026-11-06-sign-off-notes-design.md` (#200).

## Who decides what

**You draft; he confirms.** Nothing reaches GitHub (an issue, a label, a comment, the project
fields) until he has seen the whole draft and said yes; his yes covers its title and its priority.
The test pass and its marks are his, and the record's steps are `/release`'s: this window only adds
issues, and one row per note to the record.

## 1. Start

Read-only checks, in this order. The first that fails: say why in one line, and stop.

```bash
git branch --show-current                                     # must print main
head -12 src/docs/PRE-RELEASE.md                              # its heading and the five step rows
grep -n '^## Step 4: bugs from QA' src/docs/PRE-RELEASE.md    # the table this window appends to
head -1 src/docs/QA-CHECKLIST.md                              # "# Test pass X.Y.Z"
grep -E '^(Generated against|Kept at)' src/docs/QA-CHECKLIST.md | tail -1   # the build under test
gh api repos/:owner/:repo/milestones --jq '.[]|select(.state=="open")|.title'
```

- **On main.** Off main, name the branch and stop: the record is often uncommitted on main, so no
  other branch or worktree sees it.
- **The record**, `src/docs/PRE-RELEASE.md`: headed `# Pre-release X.Y.Z` (the version typed, or the
  record's own when none was), step 3 `done`, step 4 `open`, and a `## Step 4: bugs from QA` table.
  No record, or step 3 not done: there is no test pass to note against. **Step 4 `done`:** Mike has
  said the pass is finished, and nothing in the pre-release would pick up a `FAIL:` now. Say so,
  and that `/issue` files a note from here on (`/release`'s open-P0 re-check still catches a P0).
- **The test pass**, `src/docs/QA-CHECKLIST.md`, headed `# Test pass X.Y.Z`.
- **The milestone** is `vX.Y.0`, the minor line's: every X.Y.x issue is on it (#199). It must be
  open; if it isn't, say so and stop.
- **The fix-version label** is X.Y.Z's patch plus one, the pre-release's rule (not `/issue`'s,
  which can be higher): the 1.9.1 test pass files `1.9.2`.
- **The build under test** is the sha in the last `Generated against` or `Kept at` line.

**The line he's on** is the first line of the test pass that is neither ticked nor marked `FAIL:`
(a `- [ ]` with no `FAIL:`). With none left, ask which line he was on. It is a guess: he may work
out of order.

Then one line: the release, the build's sha, the line he's on (its section's heading without issue
numbers, and that he should say if he's elsewhere), and how to write a note: a message starting
`Bug -`, `Change -` or `Feat -`.

## 2. Each note

A message starting `Bug`, `Change` or `Feat` (any case, then `-` or `:`) is a note, **unless it
answers a question you just asked**: a reply belongs to the note in hand, whatever its first word.
Any other message: answer it if it's a question; if it reads like a note with no kind, ask which
kind. Two things in one message: split them, one draft each, asked about in turn.

1. **Read the record and the test pass again**, every time: Mike marks the pass as he goes, and a
   `/release` or `/issue` run may have written the record. Step 4 `done` now: stop, as in §1. Note
   the line he's on now; the draft names it.
2. **Does it fail a line?** Compare the note with **every** line of the test pass, in every
   section, whatever its mark: the one he's on, a later one, one already ticked. A line fails when
   doing what it says didn't give what it says should hold; a note about a different action is not
   that line's failure, even when the line would need it to work. If the note fails a line, **file
   nothing**. Name the section and the line, and give him the exact text for it,
   `FAIL: <what he saw, in his words>`:
   - an unticked line: he adds it to the line;
   - a ticked line: he unticks it (`- [ ]`) and adds it;
   - a line that already has a `FAIL:`: the text extends it.

   Before you give it, read the line's wiki page: if part of what he saw is what the page says
   should happen, say which part, so his `FAIL:` names only what's wrong. Step 4 files it later. If
   it should block the release (a crash, data lost, something a player can't get past), say so too,
   so he can ask for a P0 there. Ask no follow-up first, and never edit the test pass yourself. Then
   wait for the next note.
3. **Check the kind.** Read the wiki page for the area (`src/docs/wiki/`), and the feature's spec
   if it has one (`src/docs/specs/`: this release's in `X.Y.Z/`, where step 1 filed them, an
   earlier feature's in its own version's folder). A Change or a Feat that the page or spec already
   says works is probably a Bug; a Bug about something the page says is intended, or a Feat for
   something that already exists, is probably a Change. Ask which, and say why, before drafting.
4. **Does it block the release?** If it should hold the release (a crash, data lost, something a
   player can't get past) and no line covers it, propose **P0** and say why. Only a Bug can be a
   P0: a Change or a Feat that "must block" isn't one. Say so, and offer to file it as a Bug if
   that's what it is.
5. **Duplicates**, as `/issue` §2 checks them, and by the note's two or three key words in the
   bodies too, where a grouped issue lists many small items:

   ```bash
   gh issue list --state open -L 500 --json number,title,labels,milestone
   gh issue list --state open -L 100 --search "<key words> in:title,body" --json number,title
   ```

   An open issue that covers it: "this looks like #N: <title>" (for a grouped issue, the item that
   matches), asked before you draft. Mike chooses: file anyway, or a comment on #N (§5).
6. **A bug's cause**, as `/issue` §1 looks for one: a few minutes in the code. Name the file, line
   and function if you find it; say plainly if you don't. A path you read that could cause it but
   couldn't confirm goes in as `Possible: <file:line, function>: <why>; not confirmed`. Never name
   a cause you haven't read.
7. **Follow-ups:** ask only for what the issue can't do without (for a bug, what he expected, or
   the steps), one at a time, two or three at most.

## 3. The fields

| Kind | Label | Priority | Milestone | Fix-version label |
|---|---|---|---|---|
| Bug | `bug` | P1 or P2 by severity; P0 only as in §2.4 | `vX.Y.0` | X.Y.Z's patch plus one; none on a P0 |
| Change | `feature` | none (`—` in the row) | none, unless Mike names one | none |
| Feat | `feature` | none (`—` in the row) | none, unless Mike names one | none |

- **P2**: a minor bug, a visual problem, a tweak. **P1**: a medium bug; functionality is affected,
  a workaround exists, no data is at risk. **P0**: a blocker: an open P0 in the milestone holds the
  release.
- Project #3 (RPGFieldbook), Status **Backlog**, for every kind. There is no label for a Change: the
  body's Kind line says which it is.

## 4. The draft

Show it whole: first the header lines `/issue` §4 shows (**Title**, **Labels**, **Milestone**,
**Project #3**), then the body below for its kind. After the body, for a bug, the screenshot
reminder: `gh` can't attach one, so he can drop it into the issue on GitHub once it's filed. Then
the guess: "Found during says you were on <section>: say if you were elsewhere." Last, ask "File it
as <Pn>, or change anything first?" (for a Change or a Feat, "File it, or change anything first?")
and wait. If he changes something, redraft and ask again; a change that comes with his yes
("change the title to …, then file it") is his yes: make it, show the line that changed, and file.

**A bug:**

```markdown
**What happened**
<what he saw, in his words; the steps if he gave them>

**What should happen**
<in his words, or what the wiki page says>

**Where** — <tab> / <D&D or Humblewood> / <browser and width> / the X.Y.Z test-pass build (`<sha>`)

**Cause:** <file:line and function, one or two sentences; a Possible: line; or "not found">

**Found during:** the X.Y.Z test pass, while on <section>: "<the line's first six words or so>…"
```

In **Where**, leave out a part he didn't give (the system, the browser and width), and don't ask
just for it, except the browser and width for a layout bug, where they are how to make it happen.

**A change or a feature:**

```markdown
**What**
<what's wanted, in his words; for a Change, what it does now and what it should do instead>

**Why**
<why it matters to a player>

**Kind:** <Change or Feat>
**Area:** <wiki page title> (`src/docs/wiki/<path>.md`)
**Found during:** the X.Y.Z test pass, while on <section>: "<the line's first six words or so>…"
```

"Found during" says *when* he noticed it, not what it's about, so it carries no issue number: leave
out the `(#103)` on the section's heading and any `#N` in the line, or GitHub would link the two.
No secrets, and nothing from the private packs' text: this repo is public.

## 5. File it

After his yes, run this as **ONE Bash call** (Claude Code keeps no shell variables between calls).
It is `/issue`'s own block, word for word, so the two can't drift: fill in the literal values, the
title between the `TITLE` lines exactly as he approved it (quotes and all, nothing escaped), and the
body between the `BODY` lines.

- `KIND`: `bug` for a Bug, `feature` for a Change or a Feat.
- `MILESTONE`: `vX.Y.0` for a bug; empty for a Change or a Feat, unless Mike named one.
- `PRIORITY`: `P0`, `P1` or `P2` for a bug; empty for a Change or a Feat.
- `NEXT`: the fix-version label for a P1 or P2 bug; empty otherwise (the block clears it on a P0).
- `SIZE`: empty, unless Mike gave one.

```bash
KIND=<bug|feature|task>
MILESTONE=<vX.Y.0, or empty for none>
PRIORITY=<P0, P1 or P2; empty for a feature with no priority>
NEXT=<the next fix version for a P1/P2 bug or task; empty otherwise>
SIZE=<XS, S, M, L or XL; empty unless Mike gave one>
case "$KIND" in bug|feature|task) ;; *) echo "KIND must be bug, feature or task: nothing filed"; exit 1;; esac
case "$PRIORITY" in ''|P0|P1|P2) ;; *) echo "PRIORITY must be P0, P1 or P2: nothing filed"; exit 1;; esac
IFS= read -r TITLE <<'TITLE'   # read as typed: quotes, $ and backticks in a title are safe here
<title>
TITLE
[ -n "$TITLE" ] || { echo "no title: nothing filed"; exit 1; }
[ "$PRIORITY" = P0 ] && NEXT=
PROJ=$(gh project view 3 --owner wardmanm --format json --jq .id)
F() { gh project field-list 3 --owner wardmanm --format json --jq "$(cat)"; }   # the jq filter comes on stdin: never a positional
STATUS=$(F <<<'.fields[]|select(.name=="Status")|.id')
BACKLOG=$(F <<<'.fields[]|select(.name=="Status")|.options[]|select(.name=="Backlog")|.id')
PRIO=$(F <<<'.fields[]|select(.name=="Priority")|.id')
SIZEF=$(F <<<'.fields[]|select(.name=="Size")|.id')
PICK=; [ -n "$PRIORITY" ] && PICK=$(F <<<".fields[]|select(.name==\"Priority\")|.options[]|select(.name==\"$PRIORITY\")|.id")
SPICK=; [ -n "$SIZE" ] && SPICK=$(F <<<".fields[]|select(.name==\"Size\")|.options[]|select(.name==\"$SIZE\")|.id")
[ -n "$PROJ" ] && [ -n "$STATUS" ] && [ -n "$BACKLOG" ] && { [ -z "$PRIORITY" ] || [ -n "$PICK" ]; } && { [ -z "$SIZE" ] || [ -n "$SPICK" ]; } \
  || { echo "project #3 lookup failed (scope, network, or an unknown option): nothing filed"; exit 1; }
if [ -n "$NEXT" ]; then
  gh label list --search "$NEXT" --json name -q '.[].name' | grep -qx "$NEXT" || gh label create "$NEXT" --color aaaaaa || exit 1
fi
ARGS=(--title "$TITLE" --label "$KIND")
[ -n "$NEXT" ] && ARGS+=(--label "$NEXT")
[ -n "$MILESTONE" ] && ARGS+=(--milestone "$MILESTONE")
OUT=$(mktemp)   # the body is never inside $(…): macOS bash 3.2 can't parse an apostrophe there
gh issue create "${ARGS[@]}" --body-file - > "$OUT" <<'BODY'
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
  && gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$STATUS" --single-select-option-id "$BACKLOG" >/dev/null \
  && { [ -z "$PICK" ] || gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$PRIO" --single-select-option-id "$PICK" >/dev/null; } \
  && { [ -z "$SPICK" ] || gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$SIZEF" --single-select-option-id "$SPICK" >/dev/null; } \
  && echo "#$N: Backlog${PRIORITY:+, $PRIORITY}${SIZE:+, Size $SIZE}" \
  || { echo "filed $URL, but its project fields were not set: set them by hand"; exit 1; }
```

The block is bash (arrays) and the shell is zsh: write it to a scratchpad file and run it with
`bash <file>`.

**A comment on #N**, in place of an issue (§2.5). Show it as you would a draft, ending with the
guess about the line and "Post it on #N, or change anything first?":

```markdown
<the note, in his words; for a grouped issue, which item it is>; seen in the X.Y.Z test pass
(build `<sha>`). <Cause: as in a bug's draft, if you found one>

**Found during:** the X.Y.Z test pass, while on <section>: "<the line's first six words or so>…"
```

After his yes, post it with `gh issue comment <N> --body-file -`, the comment on stdin
(`<<'BODY'` … `BODY`), then read that issue's Priority on the board for its row:

```bash
gh project item-list 3 --owner wardmanm --format json -L 2000 --jq '.items[]|select(.content.number==<N>)|.priority'
```

## 6. Record it

Straight after filing, **read `src/docs/PRE-RELEASE.md` again** (another window may have written it
since), then add **one row** to its `## Step 4: bugs from QA` table, after the table's last row (the
last `|` line under that heading). Change nothing else in the record.

```markdown
| while on Level-up: "Type enough XP into the header…" | <title> | P2 | #190 | open |
| while on Trade and the inventory log: "Open a trade with…" (a feature) | <title> | — | #191 | open |
```

- **Line:** `while on <section>: "<the line's first six words or so>…"`, the section's heading
  without its issue numbers; then, by the kind it was filed as, ` (a change)` for a Change or
  ` (a feature)` for a Feat.
- **Title:** the issue's title. **Priority:** the bug's, or `—` for a Change or a Feat.
- **Issue:** `#N`. A comment on an existing issue: `#N (noted)`, that issue's title (for a grouped
  issue, the item's own words, so the row says what the note was), and its Priority on the board
  (`—` if it has none). When the block ends "its project fields were not set":
  `#N (priority not set)`, and the report says to set them by hand on project #3, and that
  `gh auth refresh -s project` fixes a missing scope. Step 4 stays open until they are set; the next
  `/release` comes back to it.
- **State:** `open`.
- No `|` inside a cell, and no relative link anywhere: `release.js` moves the record at the cut.

Then **report**: the number and its link, and what was set. Commit nothing: the next `/release`
commits the record first. Wait for the next note.

## What it never does

- Edit `QA-CHECKLIST.md`: a line, a mark, or the sha in its header. Only Mike marks it.
- Change a step's state in the record, or any row but the one it adds.
- Commit, push, switch branches, or edit any other file.
- Fix what it files.

## Red flags — stop

| Thought | Reality |
|---|---|
| "It's about a later line, not the one he's on: I'll file it" | Any line whose "what should hold" failed gets a `FAIL:`. Give him the text; file nothing |
| "That line is ticked, so this must be something new" | A ticked line can still fail: he unticks it and adds the `FAIL:` |
| "I'll add the `FAIL:` for him" | Never edit the test pass: give him the text |
| "He answered 'Bug: yes', so that's a new note" | A reply to your question belongs to the note in hand |
| "It's obviously P2, I'll file it" | Show the draft and wait for his yes |
| "This feature matters, so P0" | Only a Bug can be a P0 |
| "Step 4 is done, but one more note won't hurt" | Refuse and point to `/issue`: nothing would pick it up |
| "I read the record when I started" | Read it again just before adding the row: other windows write it |
| "I'll commit the record so the row is safe" | Commit nothing: the next `/release` commits it first |
| "1.9.1's milestone is v1.9.1" | There is none: the milestone is `vX.Y.0` |
| "I'll escape the quotes in the title" | It goes between the `TITLE` lines as typed: nothing is expanded there |
| "I'll run the block in two calls" | One call: variables don't survive between calls |
