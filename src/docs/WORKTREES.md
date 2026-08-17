# Working several issues at once

How to hand a batch of GitHub issues to parallel agents, each in its own git worktree, and get the
results back onto `main` without fighting merge conflicts.

Companion to `RELEASING.md`. Dev-only — this file never ships (anything under `src/` is excluded from
the player bundle by the audience rule).

---

## 1. The happy path

```bash
./scripts/wt.sh add 41            # branch + worktree for issue 41
./scripts/wt.sh add 43
./scripts/wt.sh list
# …agents work…
git merge --no-ff issue/41-… issue/43-…
./build.sh                        # ONE build produces the one correct artifact
# browser QA, commit the artifact, push
./scripts/wt.sh rm 41 43
```

`wt.sh add <n> [slug]` creates `.claude/worktrees/<n>/` on branch `issue/<n>-<slug>`, based on your
**local `main`** — so a batch you merged but have not pushed is already in it (see section 7). With
`gh` available the slug comes from the issue title; pass one explicitly to skip the lookup. The directory sits inside the repo but `.gitignore` covers `.claude/`, so `git status` on
`main` stays clean.

Each worktree gets:

- symlinks to `.venv` and `_conversion-data` — 102 MB and 461 MB, so symlinked, never copied
- a copy of `.claude/settings.local.json`, so agents don't re-trigger permission prompts you already
  answered

Everything else it needs is tracked. `dist/*_full.json` is gitignored but `src/tests/run.sh`
rebundles on every run, so a fresh worktree heals itself.

---

## 2. The branch contract

**Branches carry `src/` changes only. Never commit `dist/fieldbook.html` on a feature branch.**

Build in a worktree as much as you like — that is how you verify a change — but leave the built
artifact uncommitted. Then:

- merges never conflict on a 473 KB generated file, which has no meaningful 3-way merge
- one `./build.sh` on `main` after merging produces the single correct artifact, committed once

This is why the `pre-commit` hook does **not** check artifact freshness. A stale `dist/` is the
*expected* state on a branch; enforcing it at commit time would block every agent commit. The check
lives in `pre-push`, and in this flow agents never push — only you do, at the point work reaches CI.

A useful side effect: the built artifact sitting uncommitted in each worktree is exactly what you
open in a browser to QA that issue in isolation.

---

## 3. Which issues can run in parallel

Schedule by **which files they touch**, not by how many issues there are. Git merges hunks, not
files, so two edits far apart in one file are fine — but same-region edits are a real conflict.

- `src/html/*.html` is one file per tab, so tab-level UI work is disjoint by construction
- `src/css/*.css` and `src/js/*.js` are positional slices; check the fragment, not the concern
- the page shell (`src/fieldbook.template.html`) holds the top bar, tab bar, home screen and modal —
  two issues both adding a tab **will** collide there
- `src/manifest.json` is touched only when fragments are added or removed, which is rare

Map the issues to fragments before creating any worktrees, and run overlapping ones in a second wave
rather than resolving conflicts afterwards.

---

## 4. Two files every branch touches

`src/docs/UNRELEASED.md` and `src/docs/_claude/WIRING-LEDGER.md` are append-only logs that *every*
issue adds to. A plain 3-way merge conflicts on every merge after the first, on lines that do not
actually disagree.

`.gitattributes` gives both `merge=union`, which keeps both sides. Nothing to do by hand.

`dist/fieldbook.html` also carries `merge=ours` as a dead-man's switch — if a branch commits the
artifact despite section 2, keeping ours and rebuilding is the only sane resolution. That attribute
needs a driver definition, which `wt.sh` sets idempotently:

```bash
git config merge.ours.driver true    # `ours` is not built in; `union` and `binary` are
```

---

## 5. Integration

```bash
git switch main
git merge --no-ff issue/41-… issue/43-…
./build.sh && ./src/tests/run.sh
```

Then browser-QA the result, commit the rebuilt `dist/fieldbook.html`, and push. `pre-push` will stop
you if the artifact is stale or a suite fails.

Add one `UNRELEASED.md` bullet per player-visible change — the union merge means each branch can add
its own and they all survive. Cutting a release stays a separate, deliberate act (`RELEASING.md`).

---

## 6. Teardown

```bash
./scripts/wt.sh rm 41
```

Removes the worktree and deletes the branch if it merged cleanly; keeps the branch and says so if it
did not. `rm` first deletes the symlinks and copied settings that `add` created — without that, git
counts them as untracked files and refuses forever. **Genuine uncommitted work still blocks removal**,
which is the behaviour worth keeping. Discard it deliberately with
`git worktree remove --force <path>`.

---

## 7. Things that have already gone wrong

- **A trailing slash in `.gitignore` does not match a symlink.** `.venv/` matches a *directory*;
  `wt.sh` creates a symlink, which git sees as a file. The patterns are now `.venv` and
  `/_conversion-data` with no slash. Get this wrong and `git add -A` in a worktree commits two broken
  symlinks into the repo.
- **`wt.sh rm` refusing forever.** Same root cause — see section 6.
- **`\+` in `sed` is a GNU extension.** `slugify` used `s/[^a-z0-9]\+/-/g`, which BSD sed on macOS
  reads as "one non-alphanumeric followed by a literal `+`" — matching nothing. Issue titles kept
  their spaces and `git worktree add` rejected the branch name. Use `sed -E` with `+`; both BSD and
  GNU understand it. `wt.sh` now also runs `git check-ref-format --branch` before creating anything,
  so a bad name fails with the name in the message.
- **A generic `issue/<n>-work` branch means the title lookup failed**, usually a GitHub API 503.
  `wt.sh` says so now rather than falling back silently. Pass a slug explicitly to skip the lookup:
  `wt.sh add 30 additional-damage-types-to-attacks`.
- **`gh` missing from non-login shells.** Homebrew's `brew shellenv` lives in `~/.zprofile`, which
  only login shells read, so `/opt/homebrew/bin` can be absent from a spawned shell. `wt.sh` resolves
  `gh` by looking in the usual places rather than trusting `PATH`.
- **Worktrees branch from LOCAL `main`, deliberately.** They used to branch from `origin/main`, which
  broke the normal rhythm: merge a batch, then open the next worktree before pushing, and the new
  branch silently lacked everything just merged — so it rebuilt or conflicted with work already done.
  Local `main` is never behind origin (a merge has to happen first), so it is the strictly better
  base. `wt.sh` prints how many commits are not yet pushed when the two differ, because the branch
  then carries commits nobody else has.
- **A worktree that built to verify always has a modified `dist/fieldbook.html`.** That is the
  prescribed end state, and `git worktree remove` counts it as uncommitted work — so `wt.sh rm`
  restores the artifact first (it regenerates from `src/` in a second) rather than making `--force`
  routine, which would blunt the guard that still has to catch real uncommitted source.
- **`git branch -d` measures merged-ness against the branch's UPSTREAM**, not against your local
  `main`. Branches tracking `origin/main` therefore read as "unmerged" when their work sits in an
  unpushed local `main`. `wt.sh rm` asks `git merge-base --is-ancestor <branch> main` instead, which
  is the question that actually matters.

---

## 8. Things not to do

- Don't commit `dist/fieldbook.html` on a feature branch (section 2).
- Don't let an agent cut a release, bump `APP_VERSION`, or push a tag. Releases are the owner's, and
  pushing the tag is what publishes.
- Don't hand-resolve a conflict in `UNRELEASED.md` or the ledger — if you are seeing one, the
  `merge=union` attribute is missing or `.gitattributes` was not checked out.
- Don't create worktrees outside `.claude/worktrees/`; anywhere else in the repo is not gitignored and
  will show up in `git status` and in `git ls-files` sweeps.
