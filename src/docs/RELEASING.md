# Releasing Fieldbook

How a version gets from your working copy to a player's download. Dev-only — this file lives under
`src/docs/` and is deliberately excluded from the player bundle.

Publishing is automated. **You never upload assets by hand.** Pushing a tag is the whole trigger.

**`./dev.sh` drives all of this from a menu** — build, tests, cut a release, and a condensed copy of
the checklist — so you shouldn't need this file for the routine path. It's here for the detail:
what each guard refuses and why, and how to recover.

---

## 1. The happy path

```bash
# 0. NOTHING is untracked. The release workflow checks out the TAG into a clean
#    runner, so an untracked file simply does not exist there. A new fragment
#    stops the build dead; a new data file silently ships an emptier rules pack;
#    and an untracked .github/ means the tag runs no workflow AT ALL — no
#    release, no error, nothing. Check before anything else:
git status --porcelain          # every line must be M/A/R, never ??

# 1. Every player-visible change has a bullet in src/docs/UNRELEASED.md.

./build.sh --release patch          # or: minor | major | 2.0.0

# 2. Read the diff. This is the moment to catch bad changelog wording — after
#    the tag, the notes are public.
git diff

# 3. Stage EVERYTHING, not just modifications. `git commit -am` stages tracked
#    changes only, so it cannot pick up a new fragment, data file or workflow —
#    which is exactly how a release ends up unbuildable at its own tag.
git add -A
git commit -m "Release v1.2.2"      # the version bump AND the rebuilt artifact
git tag -a v1.2.2 -m "v1.2.2"
git push && git push --tags         # the tag push publishes
```

Then watch **Actions → Release**. It takes about a minute. When it's green,
`https://github.com/wardmanm/RPGFieldbook/releases/latest` has the new version and the in-app
update badge starts pointing at it.

### What `--release` does for you

`scripts/release.js` owns `APP_VERSION` and the `CHANGELOG` array — **never hand-edit either.** It:

- bumps `APP_VERSION` in `src/js/30-version.js`,
- bumps `DATA_VERSIONS[<system>]` to the new version **only for systems whose `data/<dir>/` changed
  since the previous tag** (it prints which, or "rules data unchanged — players need only the app"),
- folds every pending bullet from `src/docs/UNRELEASED.md` into a new `CHANGELOG` entry,
- empties the notebook,
- and then `build.sh` rebuilds, revalidates and re-zips.

It refuses to release with an empty notebook, and refuses a version that isn't higher than the
current one (that would break the in-app update check).

### What gets attached

| Asset | Who it's for |
|---|---|
| `fieldbook.html` | Players who just want the app. This is the whole thing. |
| `fieldbook-v<V>.zip` | The player bundle — app, README, rules packs, docs, converter. |
| GitHub's own `Source code (zip)` / `(tar.gz)` | Attached automatically from the tag — we don't build or upload a source archive. |
| `5e2024_full.json`, `humblewood_full.json` | Rules packs on their own, for someone updating data without re-downloading the app. |

The release body is that version's section of `docs/CHANGELOG.md`, sliced out by
`scripts/release-notes.js`.

---

## 1a. Building without releasing

A plain `./build.sh` is the everyday build: it validates everything and produces both zips at the
**current** `APP_VERSION`, and never touches the version or the notebook.

```bash
./build.sh            # everything, zips included
./build.sh --no-zip   # stop after the artifact + rules packs; leaves existing zips alone
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

Note that a zipping build starts with `rm -f dist/*.zip`, so it clears earlier zips (including a
previous release's). They're gitignored and rebuildable from the tag, so nothing is lost — but don't
leave one in `dist/` expecting it to survive the next build. `--no-zip` skips that wipe.

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
| **`build-html.js --check`** | `dist/fieldbook.html` is tracked; a stale one is what turns into an unreproducible release. Kept out of `build.sh` on purpose — that script's job is to *fix* staleness, CI's job is to *notice* it. |
| `bundle-rules.js` | The per-system packs still merge without a name collision. |
| `./src/tests/run.sh` | The suites. Also run by the release workflow, because `ci.yml` triggers only on pushes to `main` and would otherwise be skipped entirely by a tag. |
| Byte hygiene | A stripped final newline or a CRLF changes the shipped app. |
| Full `./build.sh` + zip allowlist | Nothing development-shaped leaked into the player zip. |
| Build changed no tracked file | You committed the rebuilt artifact. |

### `release.yml` — on a `v*.*.*` tag

**The tag doesn't match `APP_VERSION`.**
You tagged without cutting the release. Delete the tag, run `./build.sh --release <level>`, commit,
re-tag:

```bash
git tag -d v1.2.2 && git push --delete origin v1.2.2
```

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
- **Don't hand-edit `docs/CHANGELOG.md`** — regenerated from the array on every build.
- **Don't move or re-point an existing tag.** Cut a new patch instead.
- **Don't put dev docs in `docs/`.** That directory ships. Dev material goes here in `src/docs/`,
  and the zip verifier will delete the bundle if something development-shaped gets in.
