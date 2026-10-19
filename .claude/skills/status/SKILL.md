---
name: status
description: Use when Mike types /status, before pushing to main, before ending a session, or after merging a branch — whenever `.claude/status.md` (the session status log in CLAUDE.md) may be out of date.
argument-hint: (no arguments)
---

# Status log

`.claude/status.md` is what Mike's daily update reads. Every line in it is a claim someone acts on, so
each one is checked against the repo, not recalled from the conversation.

## Where it is written

- **On main only.** Worktree branches never touch it, so it never conflicts in a merge (#108).
- If you are in a worktree (`git rev-parse --git-dir` ≠ `--git-common-dir`), stop and say: "the
  status log is written on main; run /status there after merging".

## Gather, then write

Run these and read the output. Use only what they show, decisions Mike stated in this session, and
follow-ups this session left that you have checked against the code (a parked review finding lives
nowhere else).

```bash
git log --merges --date=short --format='%ad %s%n%b' -8 main  # what landed: dates, and the Closes lines
git log --date=short --format='%ad %h %s' -15 main          # the commits around it
git worktree list; git branch --no-merged main              # work still open
gh issue list --state open --milestone "$(gh api repos/:owner/:repo/milestones --jq '[.[]|select(.state=="open")][0].title')" --limit 50
sed -n '/^## Pending/,$p' src/docs/UNRELEASED.md | grep -c '^- '   # player notes waiting for a release
grep -n 'APP_VERSION=' src/js/30-version.js
cat .claude/status.md                                        # the old file: its open decisions and loose ends
```

Read the roadmap page for the open milestone (`src/docs/wiki/roadmap/<version>.md`) to say where the
plan stands (which wave, what's next).

## The file

The structure is CLAUDE.md's "Session status log" section: Current focus, Recent changes, Pending
decisions, Loose ends, under ~60 lines.

- **Recent changes:** one line per merge or notable commit, dated from `git log`, naming every issue
  the merge closed (`#95, #93, #94`). Keep the last ~10.
- **Current focus:** where the milestone plan stands, and what is in progress (open worktrees), or
  "no branch open".
- **Pending decisions:** carry over every open one from the old file; add any raised since. A
  question is decided only when Mike said so. Your recommendation is a "Leaning" only if Mike said
  it; otherwise list it as an option.
- **Loose ends** are unfinished work: follow-ups a review deferred (the newest spec's "As built" and
  the ledger's last entries name them), failing or skipped tests, commits not pushed, branches not
  merged, unreleased notes waiting ("4 player-visible changes in UNRELEASED.md, not released"). Carry
  over the old file's items that are still true; check each against the code or an issue, and
  describe it the way the code shows it. A limitation already recorded in
  `src/docs/wiki/roadmap/known-issues.md` is not a loose end — leave it there.
- Nothing secret; this repo is public.

## Commit

```bash
git add .claude/status.md && git commit -m "docs(repo): status" && git push
```

Push only when main is otherwise ready to push (tests green, nothing half-merged). If main has other
unpushed work Mike hasn't approved for pushing, commit and do not push; say so.

## Common mistakes

| Mistake | Instead |
|---|---|
| Paraphrasing the session ("a line needs removing") | Read the code or issue and say what it actually shows |
| Calling an issue "done" because work started | Done means merged and the issue closed (`gh issue view <n> --json state`) |
| Dropping the old file's open decisions | Carry them over until Mike decides them |
| Your recommendation written as the plan | An option under Pending decisions |
