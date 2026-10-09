# Releasing Fieldbook

How a version gets from your working copy to a player's download. Dev-only — this file lives under
`src/docs/` and is deliberately excluded from the player bundle.

> **Release freeze (from 2026-10-07):** no releases — app or data — until 1.8.0 is complete:
> #83 (the data archive), #84 (the SRD 5.2 pack) and #85 (the private split). Mike lifts it.

Publishing is automated. **You never upload assets by hand.** Pushing a tag is the whole trigger.

**`./dev.sh` drives all of this from a menu** — build, tests, cut a release, cut a data release, and a
condensed copy of the checklist — so you shouldn't need this file for the routine path. It's here for the detail:
what each guard refuses and why, and how to recover.

---

## 1. The happy path — `./dev.sh`

`./dev.sh` is the entry point for all of this. Its status header is the fastest way to see where a
release stands:

```
  v1.3.1 · main · no pending notes · artifact fresh · v1.3.1 NOT TAGGED
```

Every field is a release precondition: the version, the branch, how many bullets are waiting, whether
`dist/fieldbook.html` needs rebuilding, and — if a release has been cut but never tagged — a warning,
because that state publishes nothing and produces no error anywhere.

### The steps

**1. Write the notes as you work.** One `- ` bullet per player-visible change in
`src/docs/UNRELEASED.md`. The header counts them; `--release` refuses if there are none.

**2. `4` — Run all tests.** Safe any time; touches no tracked file.

**3. Check nothing is untracked.** The menu can't do this one for you:

```bash
git status --porcelain          # every line must be M/A/R, never ??
```

The release workflow checks out the **tag** into a clean runner, so an untracked file is simply not
there. A new fragment stops the build dead. A new data file silently ships an emptier rules pack. An
untracked `.github/` means the tag runs **no workflow at all** — no release, no error, nothing.

**4. `7` — Cut a release…** then pick patch / minor / major / explicit. This bumps `APP_VERSION`,
folds the notebook into the changelog, and rebuilds. It publishes nothing.

**5. Read the diff.** `git diff` — the last chance to fix changelog wording. After the tag, the notes
are public.

**6. Browser smoke-test** anything that touched the UI. No test here can do it for you.

**7. Commit, tag, push.** `dev.sh` prints these with the real version filled in, right after the cut:

```bash
git add -A                          # NOT `commit -am` — see below
git commit -m "Release v1.3.1"
git tag -a v1.3.1 -m "v1.3.1"
git push --follow-tags              # branch + the annotated tag together
```

Two things that have each bitten once:

- **`git add -A`, never `git commit -am`.** `-a` stages tracked modifications only, so it cannot pick
  up a new fragment, data file or workflow — which is exactly how a release ends up unbuildable at
  its own tag.
- **The tag is the publish button.** Cutting a release changes nothing public. Skip the `git tag`
  line and `git push --tags` succeeds with nothing to push, Actions never runs, and no release
  appears — with no error to go looking for. The `NOT TAGGED` warning in the header exists for this.

**8. Watch Actions → Release.** About a minute. When it's green,
`https://github.com/wardmanm/RPGFieldbook/releases/latest` has the new version and the in-app update
badge starts pointing at it.

### Doing it without the menu

`dev.sh` only shells out to `build.sh` and `scripts/*`, so the manual path is the same thing:

```bash
./src/tests/run.sh
git status --porcelain
./build.sh --release patch          # or: minor | major | 2.0.0
git diff
git add -A && git commit -m "Release v1.3.1"
git tag -a v1.3.1 -m "v1.3.1"
git push --follow-tags
```

### What `--release` does for you

`scripts/release.js` owns `APP_VERSION`, `DATA_VERSIONS` and the `CHANGELOG` array, and shares the
versions, digests and `release` in `data/packs.json` with `data-release.js` — **never hand-edit any
of them.** It:

- bumps `APP_VERSION` in `src/js/30-version.js`,
- runs `tools/data-kit/fbdata.py versions --bump <new version>`, which gives the new version **only
  to the packs whose content changed since their last release** (by content digest, so
  re-indenting a file changes nothing) and sets the registry's `release` to it (it prints which
  packs, or "rules data unchanged — every pack keeps its version"),
- snapshots `DATA_VERSIONS` from `data/packs.json`: the versions this build ships with,
- folds every pending bullet from `src/docs/UNRELEASED.md` into a new `CHANGELOG` entry,
- empties the notebook,
- and then `build.sh` rebuilds, revalidates and re-zips, the rules-data archive included.

It refuses to release with an empty notebook, and refuses a version that isn't higher than the
current one (that would break the in-app update check). **A release needs `python3`** (`python`
will do): without it, `release.js` refuses before writing anything. `src/js/30-version.js` is
checked for a `DATA_VERSIONS` line *before* the registry bump runs, so a failure there — or the
registry bump itself failing — leaves `data/packs.json` and `30-version.js` both untouched.

### What gets attached

| Asset | Who it's for |
|---|---|
| `fieldbook.html` | Players who just want the app. This is the whole thing. |
| `fieldbook-v<V>.zip` | The player bundle — app, README, the rules-data archive in `data/`, docs, converter. |
| `fieldbook-data-standalone-<V>.zip` | The rules data on its own: every pack, a manifest and `NOTICE.md`. Fieldbook opens it directly. |
| GitHub's own `Source code (zip)` / `(tar.gz)` | Attached automatically from the tag — we don't build or upload a source archive. |

The release body is that version's section of `docs/CHANGELOG.md`, sliced out by
`scripts/release-notes.js`, then `scripts/data-release-notes.js <V> --app`: what to download, and
which rules packs changed in this release (those whose version is `<V>`) and which didn't.

---

## 1a. Building without releasing

A plain `./build.sh` is the everyday build: it validates everything and produces the player zip at the
**current** `APP_VERSION`, and never touches the version or the notebook.

```bash
./build.sh            # everything, zips included (the zips need python3)
./build.sh --no-zip   # stop after the artifact + rules packs; leaves existing zips alone
./build.sh --data     # only the rules packs and the rules-data archive
```

**Zips from a build with pending notes are marked `+dev`:**

```
dist/fieldbook-v1.2.1+dev.zip
```

That build contains unreleased work, so it is *not* v1.2.1 — and a zip named `fieldbook-v1.2.1.zip`
that isn't v1.2.1 is a trap for whoever you hand it to for testing. `+dev` is semver build metadata
(`1.2.1+dev` = "1.2.1 plus extra"), which is exactly right; a `-dev` suffix would mean a
*pre*-release of 1.2.1, the opposite of the truth.

Once `--release` empties the notebook, names go back to plain `fieldbook-v1.2.2.zip`. **The release
workflow relies on this** — it builds at the tag, where the notebook is empty, and checks for the
plain filename. A tag carrying pending notes therefore fails the asset check rather than publishing
a mislabelled bundle.

**The rules-data archive is marked `+dev` the same way, for its own reason:** when some pack's
content differs from what `data/packs.json` recorded at the last release, app or data
(`dist/fieldbook-data-standalone-1.8.0+dev.zip`). That zip is not release 1.8.0's data.

Note that a zipping build starts with `rm -f dist/*.zip`, so it clears earlier zips (including a
previous release's). They're gitignored and rebuildable from the tag, so nothing is lost — but don't
leave one in `dist/` expecting it to survive the next build. `--no-zip` skips that wipe.

---

## 1b. Data releases

A **data release** publishes new rules data without a new app: the rules-data archive alone, under
a tag `data-vX.Y.Z-N`, where X.Y.Z is the current `APP_VERSION` and N counts up from 1. Its packs
get versions like `1.8.0-1`, which Fieldbook sorts after `1.8.0` and before `1.8.1`.

**When.** Rules data changed and the app didn't — a data fix, a converter run, new homebrew. If app
changes are also pending, cut an app release instead; it carries the data too. The `./dev.sh`
header says when one is waiting: `data 1.8.0, 2 changed`.

**How.** `./dev.sh` → `d` (it shows the dry run first, then asks), or by hand:

```bash
node scripts/data-release.js --dry-run   # what it would do; writes nothing
node scripts/data-release.js             # bump data/packs.json
```

It gives every pack whose content changed since its last release the next `<APP_VERSION>-N`, and
sets the registry's `release` to it. It touches nothing else: not `fieldbook.html`, not
`APP_VERSION` or `DATA_VERSIONS`, not the changelog or the notebook. It refuses when `APP_VERSION`
is older than 1.8.0 (the first release that can open the data zip at all), when `data/` has
uncommitted changes (the digests must describe what gets tagged), when no pack changed, when the
registry's `release` belongs to another app version, and when the tag already exists. Then it
prints, and never runs:

```bash
git add data/packs.json
git commit -m "Data release 1.8.0-1"
git tag -a data-v1.8.0-1 -m "Fieldbook data 1.8.0-1"
git push && git push origin data-v1.8.0-1
```

**Pushing the tag publishes.** `data-release.yml` runs, and refuses, in order, with an `::error::`
saying what to do:

1. a tag that isn't `data-vX.Y.Z-N`;
2. `data/packs.json`'s `release` isn't the tag's version (tagged without running the script, or
   without committing its change);
3. the tag's `X.Y.Z` isn't `APP_VERSION` at that commit — a data release is for the current app;
4. `fbdata.py versions --check` fails: a pack changed after the bump;
5. the tests fail;
6. `./build.sh --data` fails;
7. `fbdata.py validate` finds a problem with the archive.

It then writes the release body (`data-release-notes.js <v> --data`: which packs changed, how to
import, and the unzip fallback for Fieldbook older than 1.8.0) and publishes
`fieldbook-data-standalone-<v>.zip` as the only asset, with `--latest=false`.

**A data release is never "latest".** Every installed copy of Fieldbook, 1.7.2 included, finds app
updates through GitHub's `/releases/latest`; a data release there would hide them. Running copies
of 1.8.0 and later find data releases through the full releases list instead. The workflow's last
step reads `/releases/latest`, and if it is not a `v…` tag, it marks the newest app release as
latest again, then fails, so you see it. Check the releases page if it does.

**Re-publishing.** Actions → Data release → *Run workflow* → enter the tag. It rebuilds the archive
at that tag and re-uploads it with `--clobber`.

**Rolling back.** Delete the GitHub release and the tag:

```bash
gh release delete data-v1.8.0-1 --yes
git tag -d data-v1.8.0-1 && git push --delete origin data-v1.8.0-1
```

Running copies stop announcing it on their next load. `data/packs.json` keeps the versions it
recorded, so the next data release is `-2`: a number is never reused. Fix the data and cut that.

---

## 2. What CI checks, and what to do when it stops you

Both workflows are in `.github/workflows/`. Everything below is a *deliberate* refusal — if one
fires, the fix is in your working copy, not in the workflow.

### `ci.yml` — every push and PR

| Check | Why it exists |
|---|---|
| JS / Python / shell syntax | Fast fail before anything else runs. |
| `manifest.json` matches `src/` on disk | Adding a fragment without listing it is the classic mistake. |
| Every `data/**/*.json` parses | A broken pack is invisible until a player imports it. |
| **`build-html.js --check`** | `dist/fieldbook.html` is tracked; a stale one is what turns into an unreproducible release. Kept out of `build.sh` on purpose — that script's job is to *fix* staleness, CI's job is to *notice* it. **Except on a PR that doesn't touch the artifact** — a worktree branch's src-only diff — where CI *builds* it instead, so every step below still runs. Such a PR merged with GitHub's button leaves `main` stale, and `main`'s own CI then fails here: merge locally, build, commit (`WORKTREES.md` §5). |
| `fbdata.py bundle` | The per-system packs still merge without a name collision. |
| `./src/tests/run.sh` | The suites. Also run by the release workflow, because `ci.yml` triggers only on pushes to `main` and would otherwise be skipped entirely by a tag. |
| Byte hygiene | A stripped final newline or a CRLF changes the shipped app. |
| Full `./build.sh` + archive validation + zip allowlist | The rules-data archive holds exactly what its manifest says, and nothing development-shaped leaked into the player zip. |
| Build changed no tracked file | You committed the rebuilt artifact. |

### `release.yml` — on a `v*.*.*` tag

**The tag doesn't match `APP_VERSION`.**
You tagged without cutting the release. Delete the tag, run `./build.sh --release <level>`, commit,
re-tag:

```bash
git tag -d v1.2.2 && git push --delete origin v1.2.2
```

**`data/packs.json`'s `release` isn't the tag's version.**
`release.js` records every pack's version and sets `release` to the new version; a tag cut without
`--release` would publish an archive named for the previous release. Delete the tag, cut properly,
re-tag.

**A pack changed after the release was cut (`fbdata.py versions --check` fails).**
Someone committed a data change after `--release` ran, or hand-edited `data/`, so the recorded
digests no longer match. Without this check the job would die three steps later at "missing or
empty asset" with no explanation, because `build.sh` names the archive `+dev` for any digest it
can't match to a release. Re-run `./build.sh --release <level>` (or revert the data change), commit,
re-tag.

**A clean rebuild doesn't reproduce the committed `dist/fieldbook.html`.**
This is the check that makes a release *provably* the thing the source produces. Either the artifact
was hand-edited, or you committed a build from different sources. Run `./build.sh` locally, commit
the result, re-tag.

**`docs/CHANGELOG.md` is out of date.**
Regenerated on every build — run `./build.sh` and commit.

**Unreleased notes still in the notebook.**
The tag wasn't cut with `--release`, so those bullets are missing from the changelog and the release
notes would be incomplete. (It also makes `build.sh` name the zips `+dev`, which would otherwise
surface later as a baffling "missing asset" failure — hence the early, explicit refusal.) Delete the
tag, cut properly, re-tag.

---

## 3. Tags, not release branches

A **tag is already an immutable snapshot** — it points at a content-addressed commit that cannot
change. A **branch is a mutable pointer**, which makes branch-per-release both weaker for "must
never change" and permanent clutter.

- Roll back the source: `git checkout v1.2.1`
- Roll back a player: point them at that release's `fieldbook.html`. Characters are forward- and
  backward-compatible (`migrate` preserves unknown fields), so an older app opens a newer save.

Create a release branch only if you actually need to **maintain** an old line — say, patch 1.2.x
while `main` is on 1.4. Do it then, from the tag that already exists:

```bash
git switch -c release/1.2.x v1.2.1
```

---

## 4. Fixing a release

**An upload failed but the tag is fine.** Re-run without cutting a new version:
Actions → Release → *Run workflow* → enter the tag. It rebuilds and re-uploads with `--clobber`.

**Re-publishing a tag from before 1.8.0** (v1.7.2 or older): in *Run workflow*, set **Use workflow
from** to that tag, not `main`. `main`'s `release.yml` requires `data/packs.json` and uploads the
rules-data archive, and neither exists at an old tag, so it would refuse. The tag's own workflow
builds and uploads what that release always had.

**Wrong notes, right build.** Fix the wording in `src/js/30-version.js`'s `CHANGELOG` entry, rebuild,
commit, then re-run the workflow for that tag. (This is the one time editing the array by hand is
right — the version already exists, so `release.js` can't help.)

**The build itself was wrong.** Don't move the tag — a tag that changes meaning is exactly what the
immutability is for. Cut a new patch release. Delete the bad GitHub *release* if it's misleading,
but leave its tag in history.

---

## 5. Before the first automated release

- **The first tag must be ≥ `v1.2.2`.** The in-app badge only appears when a release tag compares
  *newer* than `APP_VERSION` (1.2.1 today), so re-tagging the current version shows players nothing.
- **The repo must be public**, or the unauthenticated `api.github.com` call the badge makes returns
  404 and it silently never appears. The check is deliberately silent on failure — it must never
  break an offline player — so a private repo looks identical to "no update available".
- CI will fail until `dist/fieldbook.html` is built and committed. That's the staleness gate doing
  its job.

---

## 6. Things not to do

- **Don't upload release assets by hand.** They'd bypass the reproducibility check, which is the
  main reason this is automated at all.
- **Don't hand-edit `APP_VERSION` or the `CHANGELOG` array** (except the notes-only fix above).
  `release.js` owns both, and its guards exist because a version that goes backwards breaks the
  update check for everyone.
- **Don't hand-edit the `version`, `digest` or `release` fields of `data/packs.json`**, or
  `DATA_VERSIONS`. `release.js` and `data-release.js` write them through `fbdata.py`, and the
  workflows check them against the content.
- **Don't mark a data release "latest"** on GitHub, by hand or otherwise. It hides app updates from
  every installed copy.
- **Don't hand-edit `docs/CHANGELOG.md`** — regenerated from the array on every build.
- **Don't move or re-point an existing tag.** Cut a new patch instead.
- **Don't put dev docs in `docs/`.** That directory ships. Dev material goes here in `src/docs/`,
  and the zip verifier will delete the bundle if something development-shaped gets in.
