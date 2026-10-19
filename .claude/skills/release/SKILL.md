---
name: release
description: Use when Mike types /release to cut and publish a Fieldbook release — an app release, a public rules-data release, or a private data release.
argument-hint: [app|data|private] [version]
disable-model-invocation: true
---

# Release

Arguments: `$ARGUMENTS` — optional kind (`app`, `data`, `private`), optional version.

## Who decides what

Mike typing `/release` is his instruction to prepare and cut a release; CLAUDE.md's "never cut a
release on your own" means *without* this command, never *despite* it. Two gates stay his:

- **Gate 1 — the number.** Nothing is cut until he confirms the exact version you show him.
- **Gate 2 — publishing.** Nothing is committed, tagged or pushed until he says **publish** after
  seeing the changelog (or, for a data release, the dry run).

Between and after the gates, you run the commands. Handing him commands to paste is not doing the
release. "Skip the checks" never skips preflight or a gate: say so in one line and keep going.

## 1. Which release

| What's waiting | Release |
|---|---|
| bullets under `## Pending` in `src/docs/UNRELEASED.md` | **app** (`./build.sh --release`), which carries changed public data too |
| no bullets; `node scripts/data-release.js --dry-run` lists changed packs | **data** |
| `_private-data` has changed packs (`node scripts/data-release.js --registry _private-data/data/packs.json --data-root _private-data/data --dry-run`) | **private**, after any public release above |

If the argument names a kind that isn't due, say so and recommend the one that is.

## 2. Preflight — report every line with its result

```bash
git switch main && git fetch -q && git status -sb             # on main, not behind origin
git status --porcelain                                        # every line
PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh                # all suites; PDF suites run
git worktree list; git branch --no-merged main                # nothing half-merged
git -C _private-data status -sb                               # committed; pushed unless releasing it
```

- **`??` lines:** an untracked file is missing from the tagged build. Ask whether each should be
  committed first or removed, and do not propose a version until none are left.
- **` M` lines:** list each and ask whether it belongs in this release; `git add -A` will include it.
  Do not propose a version until Mike has answered.
- **The milestone:** read the open roadmap page (`src/docs/wiki/roadmap/<version>.md`). If this release
  ships part of a milestone, say which items are in and which are not.
- Check memory for a release freeze. Read the pending bullets back to Mike.

## 3. Gate 1 — the exact number

Propose it: patch / minor / major from `APP_VERSION` in `src/js/30-version.js`, or the data script's
`X.Y.Z-N`. A typed version is checked (higher than current; `X.Y.Z` for app, `X.Y.Z-N` for data).
"Minor" once meant 1.7.1, so always ask: "Cut **vX.Y.Z**?" — then wait.

## 4. Cut

- **app:** `./build.sh --release X.Y.Z`, then show the new `CHANGELOG` entry and `git diff --stat`.
- **data / private:** run `data-release.js` (with `--registry … --data-root …` for private) without
  `--dry-run`; show which packs moved.

## 5. Gate 2 — publish

Ask: "Publish **vX.Y.Z**? Reply **publish**." Then run, per `src/docs/RELEASING.md`:

| Kind | Commands |
|---|---|
| app | `git add -A && git commit -m "Release vX.Y.Z" && git tag -a vX.Y.Z -m "vX.Y.Z" && git push --follow-tags` |
| data | the four lines `data-release.js` printed (`data-vX.Y.Z-N`) |
| private | its printed `git -C _private-data …` lines, only after public main is pushed |

Never `git commit -am`. Never force-push, delete a tag or delete a release without Mike's word.

## 6. Check it landed

For app and data, the push publishes nothing yet. The run's `verify` job checks and builds; then
its `publish` job waits for Mike to approve it in GitHub (the `release` environment). Once
`verify` is green, give him the run URL and say "waiting for your approval in Actions"; you never
approve it. Private releases have no such gate (see RELEASING §2).

```bash
gh run watch "$(gh run list --workflow <release.yml|data-release.yml> -L1 --json databaseId -q '.[0].databaseId')"
gh release view <tag> --json assets,isLatest -q '[.isLatest, [.assets[].name]]'
gh api repos/:owner/:repo/releases/latest -q .tag_name     # still the app's v… tag
```

- **app:** assets `fieldbook.html`, `fieldbook-vX.Y.Z.zip` (no `+dev`), the data zips; nothing named
  `*private*`.
- **data:** one asset, not latest.
- **private:** check with `-R wardmanm/RPGFieldbookPrivate`; nothing appeared publicly.

On a failure: `RELEASING.md` §2 and §4. Then run `/status`, and report the release URL.

## Red flags — stop

| Thought | Reality |
|---|---|
| "Cutting is Mike's, so I'll hand him the commands" | He typed /release. Cut after Gate 1, publish after Gate 2 |
| "He said minor, that's 1.9.0" | Show the exact number and wait |
| "He's in a hurry, skip tests" | Preflight is the release; one line to say so, then run it |
| "Those `M` files are probably part of it" | Ask; `git add -A` takes them all |
| "Pushed, done" | Not until CI is green and the assets are checked |
