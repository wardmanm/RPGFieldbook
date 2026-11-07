---
name: issue
description: Use when Mike types /issue to file a bug, feature or task for Fieldbook on GitHub.
argument-hint: <bug|feature|task> <what you saw or want>
disable-model-invocation: true
---

# Issue

Arguments: `$ARGUMENTS` — the kind (`bug`, `feature` or `task`; ask if it's missing or unclear),
then what Mike saw or wants, in his words.

## Who decides what

Mike typing `/issue` is his request to file one issue. **You draft; he confirms.** Nothing reaches
GitHub (the issue, a label, the project fields) until he has seen the whole draft and said yes, or
told you what to change. You never fix the bug here: filing is the whole job.

## 1. Understand it

- Restate what he reported in one line. If the kind, the place in the app, or (for a bug) what
  happened versus what he expected is unclear, ask one question before drafting.
- **Look before you draft.** Read the wiki page for that area (`src/docs/wiki/`) and the code it
  names. For a bug, find the cause if you can in a few minutes: name the file and function, and say
  plainly if you did not find it. Don't guess a cause you haven't seen in the code.

## 2. Duplicates

```bash
gh issue list --state open -L 500 --json number,title,labels,milestone
```

If an open issue covers it (by title or key words), say "this looks like #N: <title>" and ask:
file anyway, or add it as a comment on #N (`gh issue comment <N> --body-file -`, after his yes).

## 3. The fields

- **Milestone.** A **bug** or **task** goes in its line's milestone, `vX.Y.0`: every X.Y.x issue is
  on it, and there is no `vX.Y.1` (Mike, 2026-11-05; #199). The line is the **release in hand**'s:
  the pre-release record's version while a pre-release is in progress, otherwise `APP_VERSION`, the
  line players have. During 2.0 work that is still 1.9 until 2.0.0 ships, since a bug in the
  shipped app is fixed in its patch line (Mike, 2026-11-07).

  ```bash
  head -1 src/docs/PRE-RELEASE.md 2>/dev/null                  # "# Pre-release X.Y.Z": a pre-release is in progress
  grep -o 'APP_VERSION="[^"]*"' src/js/30-version.js           # otherwise, the app's version
  gh api repos/:owner/:repo/milestones --jq '.[]|select(.state=="open")|.title'   # the line's must be open
  ```

  If the line's milestone isn't open, say so and ask. A **feature** goes in the milestone Mike
  names, or none.
- **Labels.** The kind: `bug`, `feature` or `task`. A bug or task also carries the **next fix
  version**, the patch it is meant for: the higher of the release in hand's patch plus one
  (`1.9.0` → `1.9.1`) and the highest `X.Y.Z` label on the line's open issues, since a later patch
  is often scoped already (`1.9.2` while 1.9.1 is being built; Mike, 2026-11-07). Mike changes it
  in the draft when he opens a new patch.

  ```bash
  gh issue list --milestone "vX.Y.0" --state open -L 500 --json labels \
    --jq '[.[].labels[].name|select(test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))]|unique|sort_by(split(".")|map(tonumber))|last'
  ```

  A **P0** carries no fix version label (it stays in the milestone, where the pre-release's
  open-P0 check finds it).
- **Project #3 (RPGFieldbook):** Status **Backlog**, and for a bug or task a **Priority**:
  - **P2**: a minor bug, a visual problem, a tweak.
  - **P1**: a medium bug; functionality is affected, a workaround exists, no data is at risk.
  - **P0**: a blocker. An open P0 in the milestone blocks the release.

  Propose one, with a reason; Mike decides. A feature may take a **Size** (XS, S, M, L, XL) if he
  gives one; don't guess it.

## 4. The draft

Show the whole thing, ready to file:

```markdown
**Title:** <short, plain words: what goes wrong, or what's wanted>
**Labels:** <kind>[, <next fix version>] · **Milestone:** <vX.Y.0 or none> · **Project #3:** Backlog[, <Pn>][, Size <s>]

**What**
<what happens, or what's wanted, the way a player would put it; an example with numbers if he gave one>

**Steps:** <for a bug: the shortest way to make it happen>
**Cause:** <for a bug, if found: file:line and function, one or two sentences>

**Why**
<why it matters to a player>
```

Mike's own issues use **What** and **Why**: keep that shape. No secrets, and nothing from the
private packs' text (this repo is public). Then ask: "File it as <Pn>, or change anything first?"
and wait.

## 5. File it

After his yes, run this as **ONE Bash call** (Claude Code keeps no shell variables between calls).
Fill in the literal values; the title goes between the `TITLE` lines exactly as Mike approved it
(quotes and all, nothing escaped), and the body between the `BODY` lines, on stdin, so no file is
written into the repo.

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

The block is bash (arrays): if the shell is zsh, run it as `bash -c '…'` or from a scratchpad file
with `bash <file>`.

## 6. After filing

- Report the number and link, and what was set.
- **A pre-release in progress** (`src/docs/PRE-RELEASE.md` exists, and the issue went in its line's
  milestone: `vX.Y.0` for a record naming X.Y.Z):
  add a row to its "Step 4: bugs from QA" table for a bug found in testing, `| <checklist line or
  "reported by Mike"> | <title> | <Pn> | #N | open |`. Don't commit: the next `/release` run
  commits the record first.
- Nothing else changes: no code, no other file.

## Red flags — stop

| Thought | Reality |
|---|---|
| "It's obviously P1, I'll just file it" | Show the draft and wait for his yes |
| "I can see the fix, I'll make it" | Filing is the job; the fix is its own branch later |
| "I'll guess the cause" | Name it only if you read it in the code; otherwise say you didn't find it |
| "It's a P0, the block adds the fix label" | A P0 never gets the fix version label |
| "1.9.1's bug goes in v1.9.1" | There is none: the line's milestone is `vX.Y.0` |
| "v2.0.0 is open, so bugs go there" | The line players have, from `APP_VERSION`, until 2.0.0 ships |
| "item-add failed, so it isn't in the project" | Project #3 auto-adds: the block finds the item |
| "I'll run the block in two calls" | One call: variables don't survive between calls |
