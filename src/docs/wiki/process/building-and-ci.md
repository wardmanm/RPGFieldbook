# Building & CI

`./build.sh` turns `src/` into the shipped `dist/fieldbook.html`, validates it, bundles the rules
packs, packs them into the rules-data archive and zips the player download. CI runs the same script,
plus the test suites, on every push to `main` and every pull request, and two opt-in git hooks run
the cheap half of it locally. This page is the everyday build and the two release workflows' checks.
Cutting and publishing a release (`--release`, the tag, a data release) is
[RELEASING](../../RELEASING.md); the archive itself is [Data archive](../architecture/data-archive.md);
several branches at once is [WORKTREES](../../WORKTREES.md).

**Code:** `build.sh`, `dev.sh`, `.githooks/`, `.github/workflows/ci.yml`, `release.yml`,
`data-release.yml`; `validateOrder()`, `mayOverwrite()` in `scripts/build-html.js`; `bundle()`,
`registry()` in `scripts/bundle-rules.js`; `cmd_pack()`, `validate_archive()` in
`tools/data-kit/fbdata.py`; `scripts/gen-changelog.js`, `scripts/data-release.js`,
`scripts/data-release-notes.js`; `APP_VERSION` and `DATA_VERSIONS` in `30-version.js` · **Data:**
`data/packs.json` · **Tests:** `docs.js` (zip allowlist vs README §9, README names the archive,
`data/packs.json` against `DATA_VERSIONS`), `data-kit.py` (the archive is reproducible and
validates; the release scripts in a scratch repo) · **See also:**
[Build & source split](../architecture/build-and-source-split.md), [Data archive](../architecture/data-archive.md),
[Testing](testing.md),
[RELEASING](../../RELEASING.md), [WORKTREES](../../WORKTREES.md), [README](../../../../README.md)

## How it works

### `./build.sh`, in order

1. **`--release <level>` only:** `node scripts/release.js` runs first, so the build carries the new
   version. The rest of that path is [RELEASING](../../RELEASING.md).
2. **`node scripts/build-html.js`** concatenates `src/` into `dist/fieldbook.html`. It runs first
   because every check below reads the built file. Its own guards (manifest drift, CR/BOM, `boot();`
   last, the clobber guard) are on [Build & source split](../architecture/build-and-source-split.md).
3. **`node --check` on each `src/js` fragment**, in manifest order. The whole file is checked next;
   this pass exists for error attribution, so a failure names `src/js/56-class.js:88` rather than a
   line deep in the concatenation.
4. **`node --check` on the `<script>` block** extracted from the built file.
5. **`JSON.parse` on every `data/**/*.json`.**
6. **`node scripts/bundle-rules.js`** writes `dist/<file>` for every pack in `data/packs.json`
   (gitignored), stamped with the registry's title, version and credit. A folder whose files
   disagree about `system`, `excludeSystems` or `requires`, or whose `system` is not the
   registry's, fails the build.
7. **`node scripts/gen-changelog.js`** regenerates `docs/CHANGELOG.md` from the in-app `CHANGELOG`
   array and prints `APP_VERSION`. Anything that isn't `X.Y.Z` stops the build, since it goes into a
   filename.
8. **The notebook is counted**: `- ` bullets under `## Pending` in `src/docs/UNRELEASED.md`.
9. **`--no-zip` exits here.** Everything above has run; no zip is touched, not even the old ones.
10. **`rm -f dist/*.zip`**, then **the rules-data archive** (below). This is where Python is first
    needed: without `python3` (or `python`) the build stops with "the zips need python3
    (tools/data-kit/fbdata.py); use --no-zip for just the app".
11. **The player zip**, then its allowlist guard (below).
12. The closing line. With notes pending it says how many, and how to cut a release.

A bare `./build.sh` never changes `APP_VERSION`, `CHANGELOG`, the notebook or `data/packs.json`, so
it is safe to run constantly. It does **not** run the test suites; `./src/tests/run.sh` is separate,
and CI runs both. It needs node, bash, `zip`, `unzip` and, for the zips, `python3`, and no network.

### The rules-data archive

`fbdata.py versions --check` decides the name: `dist/fieldbook-data-standalone-<release>.zip`, after
`data/packs.json`'s `release`, or `…+dev.zip` when some pack's content has changed since, because
that zip is not that release's data. `fbdata.py pack dist -o <archive>` writes it from the bundles
the registry lists, and `fbdata.py validate` checks it: the manifest, every pack's SHA-256, `system`
and `dataVersion`, and nothing in the zip but the manifest's packs and `NOTICE.md`. **An archive that
fails validation is deleted**, and the build exits 1. What is inside, and why, is
[Data archive](../architecture/data-archive.md).

**`./build.sh --data`** builds only this: it validates `data/**/*.json`, bundles, and packs and
validates the archive. It never builds or checks `fieldbook.html`, never regenerates
`docs/CHANGELOG.md`, and builds no app zip, because a data release ships no app.
`data-release.yml` uses it. It refuses to be combined with `--release` or `--no-zip`.

### The player zip

The name is `dist/fieldbook-v<APP_VERSION>.zip`, or `…+dev.zip` when this is not a `--release` build
**and** the notebook has pending bullets. `+dev` is semver build metadata: "that version plus
extra", which is what such a build is.

Contents are an **allowlist**, assembled in `.buildtmp/`: `fieldbook.html` at the zip root, `README.md`,
`LICENSE`, `data/` holding only the rules-data archive, `docs/*.md`, and `scripts/convert.py`
with its three hand-authored inputs `data/overlay.json`, `data/class-resources.json` and
`scripts/srd-corrections.json`, which go in `scripts/` because they are converter inputs and not
loadable packs. `convert.py srd` looks for its corrections beside itself and fails without them, so
that one must be there. That is README §9. Fieldbook opens this zip as it is: it finds the archive
inside it.

After zipping, the guard lists the entries with `unzip -Z1` and fails on any of:

- a dev path: anything under `src/`, any dot-path, `CLAUDE.md`, `build.sh`, `dev.sh`, the ledger, an
  ADR, `UNRELEASED`, `RELEASING`, or a dev script (`build-html.js`, `gen-changelog.js`, `release.js`,
  `release-notes.js`, `bundle-rules.js`, `fetch-icons.js`, `extract-humblewood.py`);
- anything in `data/` other than exactly one `data/fieldbook-data-standalone-*.zip`, or no archive
  at all;
- anything in `docs/` other than `CHANGELOG.md`, `README-converter.md` and `rules-schema.md`.

On failure it **deletes the zip** and exits 1. A zip that fails the check must not exist to be
uploaded.

### No source zip

There is deliberately none. GitHub attaches **Source code (zip)** and **(tar.gz)** to every release,
built from the tag. `.gitattributes` has no `export-ignore`, so that is exactly the tracked file set.
For a local snapshot: `git archive HEAD -o snapshot.zip`.

### `ci.yml`

It triggers on a push to `main`, on every pull request, and manually. It runs on Ubuntu with Node 20
and Python 3.11, checked out at `fetch-depth: 2`. The steps run in order:

1. Syntax: `node --check` over `src/js`, `scripts` and `src/tests`; `py_compile` over `scripts/*.py`
   and `src/tests/*.py`; `bash -n` over `dev.sh`, `src/tests/run.sh` and `build.sh`.
2. Manifest parity for `js`, `css` and `html`, in both directions.
3. Every `data/**/*.json` parses.
4. The artifact gate (see below), then `bundle-rules.js`.
5. `./src/tests/run.sh`.
6. Byte hygiene (no CR, no BOM, a final newline) over every fragment, the manifest and the template.
7. The full `./build.sh`, the archive's validation and the zip guard included. Its Python is the
   3.11 the job sets up.
8. "The build changed no tracked file": `git diff --exit-code`.

**A src-only PR is built, not checked.** On a `pull_request`, CI asks
`git diff --quiet HEAD^1 HEAD -- dist/fieldbook.html`. A PR is checked out as a merge commit whose
first parent is the base, so that asks whether this PR commits the artifact. If it does not, the gate
runs `node scripts/build-html.js` instead of `--check`, and the last step excludes
`dist/fieldbook.html` from its diff. Generated docs are still held to it. A push to `main`, or a PR
that does commit the artifact, keeps the strict `--check`. The builder is willing to overwrite in CI
because `mayOverwrite()` accepts an artifact identical to HEAD's.

What each refusal means and how to clear it is the table in [RELEASING](../../RELEASING.md) §2.

### `release.yml` and `data-release.yml`

**`release.yml`** runs on a `vX.Y.Z` tag. It refuses a tag that doesn't match `APP_VERSION`, then
one whose `data/packs.json` `release` isn't the tag's version (a tag cut without `--release`), then
one with notes still pending. It runs the tests (a tag never triggers `ci.yml`) and the full build
under the runner's own `python3`, printing `python3 --version` first, and refuses to publish unless
that rebuild reproduces the committed `dist/fieldbook.html` byte for byte. The release body is the
changelog section plus `data-release-notes.js <v> --app`: what to download and which packs changed.
The assets are `fieldbook.html`, `fieldbook-v<v>.zip` and `fieldbook-data-standalone-<v>.zip`, and
it checks all three exist before publishing.

**`data-release.yml`** runs on a `data-vX.Y.Z-N` tag. In order, it checks: the tag's form;
`data/packs.json`'s `release` is the tag's version; the tag's base is `APP_VERSION` at that commit (a
data release is for the current app); `fbdata.py versions --check` (the recorded digests are
current); the tests; `./build.sh --data`; and `fbdata.py validate` on the archive. It writes the
body with `data-release-notes.js <v> --data` and publishes the archive alone with `--latest=false`.
Its last step reads `releases/latest`: if that is not a `v…` tag, it re-marks the newest app release
as latest and fails, because a data release marked latest hides app updates from every installed
copy. Both workflows also take `workflow_dispatch` with a tag, to re-publish one. See
[RELEASING](../../RELEASING.md).

### Git hooks

Tracked in `.githooks/` and opt-in: `./dev.sh` menu `h` runs `git config core.hooksPath .githooks`.
`core.hooksPath` is shared config and the relative path resolves per working tree, so one install
covers the main checkout and every worktree. `checks.sh` is a library the two hooks source.

- **`pre-commit`** runs on staged files, in about a second: JS syntax (`src/js`, `scripts`,
  `src/tests`), byte hygiene on fragments, the manifest and the template, JSON under `data/` and `src/`,
  workflow YAML through `npx js-yaml`, manifest parity, and **every manifest-listed fragment tracked or
  staged** (`check_manifest_tracked`).
- **`pre-push`** runs the same checks over every tracked file, plus `build-html.js --check` and the
  full `./src/tests/run.sh`. On a stale artifact it prints `./build.sh --no-zip` and refuses. It never
  rebuilds for you.

Both bypass with `--no-verify`. Uninstall with `git config --unset core.hooksPath`. The YAML check
skips cleanly with no `npx` or no network.

### `./dev.sh`

A menu with no build logic. Each item shells out to `build.sh` or `scripts/*` and prints the command
first, so there is one implementation of every task and the menu teaches the CLI. The header shows the
version, the branch, pending notes, `artifact fresh` or `STALE` (from `build-html.js --check`),
`vX.Y.Z NOT TAGGED` when `APP_VERSION` has no tag, and `hooks off` when the hooks aren't installed.

The header also shows `data <release>`, or `data <release>, N changed` when packs have changed since
the registry's `release` (a data release waiting to happen); without Python it leaves that out.

The items are: build (`1`), build without zips (`2`), a staleness check (`3`), tests (`4`), workflow
YAML (`w`), hooks (`h`), rebundle (`5`), and re-convert from `_conversion-data/5etools-*` (`6`). Then
there is commit (`c`), which builds a `type [26/30]: message, closes #26, closes #30` subject, stages
with `git add -A` and pushes without `--follow-tags`. Release (`7`) confirms, runs `--release`, then
prints the commit, tag and push commands and runs none of them. Data release (`d`) runs
`data-release.js --dry-run`, asks, then bumps `data/packs.json` and prints its commands, also running
none. The last are the release checklist
(`8`), open the app (`9`) and where things live (`s`). It is Bash 3.2 compatible, and with no TTY it
prints the menu and exits 0.

## Rules that must hold

- **A plain build is idempotent on versioning.** Only `--release` touches `APP_VERSION`, `CHANGELOG`
  or the notebook. `build.sh` is run constantly; it must not be the thing that bumps.
- **Build first.** Every later check reads `dist/fieldbook.html`.
- **The zip is an allowlist, and a zip that fails the guard is deleted.** Dev material goes under
  `src/` (banned wholesale by `^src/`) or at the repo root, never in `docs/`. A new player-facing doc
  means editing the `docs/` regex in `build.sh` **and** README §9. `docs.js` fails if any `docs/*.md`
  on disk would be rejected, and checks that `LICENSE` is both shipped and listed.
- **`+dev` if and only if** it is not a `--release` build and notes are pending. `release.yml` builds at
  the tag with an empty notebook and looks for the plain filename.
- **Staleness is checked in CI and `pre-push` only.** It is never checked in `build.sh`, whose job is to
  fix staleness, and never in `pre-commit`, because a stale `dist/` is the expected state on a feature
  branch.
- **`build.sh` needs no network.** Icon fetching (`scripts/fetch-icons.js`) and the workflow YAML
  check are kept out of it deliberately.
- **The zips need Python; nothing before them does.** `--no-zip` and the Node suites run without it,
  so the everyday loop never depends on it.
- **The archive that ships is the archive that validated.** A failed `fbdata.py validate` deletes
  it, as the allowlist guard deletes a leaking app zip.
- **A build never writes `data/packs.json`.** Only `release.js` and `data-release.js` do, through
  `fbdata.py`.
- **Portable shell.** `build.sh` must run under macOS bash 3.2 with BSD tools and under the GNU tools on
  the CI runner.
- `dist/fieldbook.html` is tracked. `dist/*.zip` (the archive included), `dist/*_full.json`,
  `dist/.buildstamp` and `.buildtmp/` are ignored.

## Traps

- **`build.sh` was zsh-only.** An apostrophe inside a `<<'NODE'` heredoc nested in a command
  substitution parsed under zsh and not under bash, which is the shell its own shebang names. It was
  fixed by moving the changelog step into `scripts/gen-changelog.js`.
- **`mktemp -t` means different things.** BSD reads it as a prefix and GNU as a whole template.
  `build.sh` passes an explicit `…/fieldbook.XXXXXXXX` template, which both accept.
- **An empty `VER` would ship `fieldbook-v.zip`.** That is the reason for the `X.Y.Z` check. The
  `rm -f dist/*.zip` stops a failed build from leaving last version's bundle looking current.
- **A blocklist leaks the next doc.** The `docs/` guard used to name dev docs to ban, and
  `HUMBLEWOOD-PLAYTESTS.md` was not on the list. It is an allowlist now.
- **`git commit -am` cannot pick up a new file.** The tag is built in a clean checkout, where an
  untracked fragment, data file or workflow simply doesn't exist. A tag with no `release.yml` queues
  no run at all, with no error. `check_manifest_tracked` catches the fragment case; `dev.sh` and
  RELEASING use `git add -A`.
- **`bundle-rules.js` skips a missing system directory with a log line**, and a missing category file
  just leaves its key out. On a clean checkout an untracked data file produces a complete-looking pack
  with a category missing.
- **Failing a src-only PR at `--check` skipped every later step, tests included.** Skipping the check
  alone would not have worked either: `rules-data.js` asserts that the assembled markup appears byte
  for byte in `dist/fieldbook.html`, so any `src/html` PR would then fail against the stale artifact.
  So the PR is built.
- **Merging a src-only PR with GitHub's button leaves `main` stale**, and `main`'s CI then says so. Merge
  locally and build instead, as in [WORKTREES](../../WORKTREES.md) §5.
- **A PR's CI runs the workflow from its merge commit.** An open PR picks up a `ci.yml` change only on
  a new run (a push, or close and reopen), not from "Re-run jobs".
- **The hooks read the working tree, not the staged blobs.** `git add -p` can therefore validate bytes
  you are not committing. This is accepted: the repo commits whole files.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| What goes in the player zip | An allowlist matching README §9, verified after zipping; failure deletes the zip | A snapshot of the repo: it shipped `CLAUDE.md`, `build.sh`, dotfiles and `src/` |
| How `docs/` is guarded | Three filenames allowed | Banning dev docs by name: it misses the next one written |
| A source archive | None; GitHub's automatic Source code archives | Our own `git ls-files` zip: a byte duplicate of a free asset, and the only asset that differed between a local and a runner build |
| Naming a build with pending notes | `v<version>+dev` | `-dev`: semver reads it as a *pre*-release, the opposite of the truth |
| When the version moves | Only on `--release` | Bumping per change: `build.sh` is run constantly for validation |
| Where staleness is checked | CI and `pre-push` | `build.sh` (its job is to fix staleness); `pre-commit` (a stale `dist/` is expected on a branch and would block every worktree commit) |
| A src-only PR in CI | Build the artifact, exclude it from the tracked-files diff | Fail it at `--check`, which skipped the tests; skip the check, which fails the byte-pin test instead |
| Where the hooks live | Tracked `.githooks/` via `core.hooksPath` | `.git/hooks`: neither cloned nor reviewed |
| Whether `pre-push` rebuilds | It refuses and prints the command | Rebuilding silently changes what you are about to push, the wrong shape for a byte-exact artifact |
| Where the workflow YAML is checked | Hooks and `dev.sh` `w`, skipping offline | In `ci.yml`: GitHub must parse the workflow to start the job, so the check can only pass. In `build.sh`: a network dependency |
| What `dev.sh` is | A menu that shells out and prints each command | Logic in the menu: it would drift from what CI runs |
| Icon generation | Run by hand (`scripts/fetch-icons.js`), not wired into `build.sh` | In the build: CI's "no tracked file changed" check would become network-dependent |
| What the app zip's `data/` holds | The rules-data archive, which the app opens inside the zip | The five loose packs: two copies of one thing, and the loose ones have no manifest or `NOTICE.md` (L5082) |
| Python for the archive | Required for the zips only (`fbdata.py`) | A Node port of the digest and the packer: two implementations that must agree byte for byte (L5082) |

## Open

- `release.yml`'s header comment still shows `git commit -am`. See
  [known issues](../roadmap/known-issues.md).
- `ci.yml`'s Python syntax step compiles `scripts/*.py` and `src/tests/*.py`, not
  `tools/data-kit/`. The `data-kit` suite imports `fbdata.py`, so a syntax error there still fails
  CI, under a less direct name.
- `release.yml` keeps `fetch-depth: 0`, which has not been needed since the source zip went. It is
  harmless and was left in place deliberately.

## History

- 2026-08-07 — `build.sh` fixed to run under bash; the changelog step moved to `gen-changelog.js`. → ledger L397
- 2026-08-07 — The player zip becomes an allowlist that deletes itself on a leak, and dev docs move under `src/`. → ledger L418
- 2026-08-07 — A second, full-repo source zip is added (removed 2026-08-10). → ledger L441
- 2026-08-07 — Zips are named `fieldbook-v<version>.zip`, with `VER` validated and old zips wiped first. → ledger L463
- 2026-08-07 — Versions are cut only by `--release`, and a plain build prints the pending-note count. → ledger L475
- 2026-08-10 — `ci.yml` and the tag-triggered `release.yml` added. → ledger L811
- 2026-08-10 — `./dev.sh` menu added. → ledger L846
- 2026-08-10 — `--no-zip`, and `+dev` naming when notes are pending. → ledger L878
- 2026-08-10 — Pre-release audit: `LICENSE` ships, `docs/` guard is an allowlist, CI compiles every `scripts/*.py`, `release.yml` runs the tests. → ledger L1194
- 2026-08-10 — Source zip removed; GitHub's archives replace it. → ledger L1276
- 2026-08-10 — Dev docs split into `src/docs/_claude/`, already covered by the zip guard's `^src/`. → ledger L1302
- 2026-08-17 — Tracked git hooks: `pre-commit` fast set, `pre-push` adds freshness and the suite. → ledger L2651
- 2026-08-18 — Icon generation kept out of `build.sh`; the hooks' JSON check widened to all of `src/`. → ledger L3289
- 2026-09-24 — CI builds a src-only PR instead of failing it. → ledger L3339
- 2026-10-07 — The rules-data archive: built and validated after `--no-zip`'s exit, carried in the app zip's `data/` in place of the five packs; `--data`; Python for the zips; `release.yml`'s registry guard and three assets; `data-release.yml` and its "latest" check; dev.sh `d`. → ledger L5082, #83
- 2026-10-08 — The app zip ships `scripts/srd-corrections.json` beside `convert.py`. → ledger L5269, #84
