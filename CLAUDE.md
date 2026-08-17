# Fieldbook — project brief for Claude Code

Read this first. It encodes the conventions this project has been built with. Follow them unless the
owner (Mike — product owner, decision-maker, and QA) says otherwise. When in doubt, ask before doing
something irreversible.

## What this is

**Fieldbook** is a standalone, single-file HTML character sheet app supporting **D&D 5e 2024 (XPHB)**
and the **Humblewood** TTRPG, plus two D&D supplement packs (**Xanathar's Guide**, **Tasha's
Cauldron**). The app ships as one self-contained file, `dist/fieldbook.html`, built
by concatenating the fragments in `src/` — HTML + CSS + JS, no runtime dependencies. A Python CLI
(`scripts/convert.py`) turns 5e-tools exports into the app's JSON; a second, dev-only CLI
(`scripts/extract-humblewood.py`) reads the Humblewood books and playtest PDFs. Players load the
resulting JSON at runtime.

## Non-negotiable constraints

1. **Single shipped file.** All app functionality ends up in one `dist/fieldbook.html`. No external
   runtime dependencies, no build step to *run* the app, no network needed to use it. It must open
   from a local file and work offline. Do not add `<script src>`/`<link href>` to third-party URLs,
   and do not split the *delivered* app into modules — the `src/` split is concatenation only, with
   no `import`/`export` and no `type="module"` (see src/docs/ADR-001-source-split.md).
2. **Offline-first.** localStorage for characters, settings and the library; **IndexedDB for the
   rules cache**, which at five packs is ~4.4 MiB of UTF-16 and does not fit in a 5 MiB origin quota
   (localStorage remains its fallback and migration source, compressed — LZW, ~19% — because
   uncompressed it cannot hold five packs). Every IndexedDB call is timed out: absent and throwing
   reject at once, but a request that *hangs* would leave a failed save unreported forever. A storage
   write that does not land must SAY SO — an empty `catch` around `setItem` is how five loaded packs
   silently became two.
   The only network calls are optional and must fail
   silently when offline: the rules-source fetch (user-configured URLs) and the GitHub update check.
3. **Backward-compatible data.** Never break loading of existing saved characters. New character
   fields must be optional and must survive a save→load round-trip (see `migrate`).

## Repo layout

The split is by AUDIENCE: anything under `src/` is development material and never reaches players;
`docs/` is player-facing and ships in the bundle zip.

```
src/                    THE SOURCE OF TRUTH — edit here, never the built file
  fieldbook.template.html  the page SHELL — top bar, tab bar, home, modal; three markers:
                        /*@@CSS@@*/, <!--@@HTML@@--> and //@@JS@@
  manifest.json         the authoritative concatenation ORDER for html/, js/ and css/
  html/*.html           7 fragments, one tab panel each, spliced into <div class="page">
  js/*.js               26 fragments, concatenated into the single <script>
  css/*.css             7 fragments, concatenated into the single <style>
  tests/                THE TEST SUITES — run with ./src/tests/run.sh (dev)
    harness.js          loads the app the way the build concatenates it
    converter.py · tables.js · rules-data.js · sheet.js · char-update.js · docs.js
    humblewood-verbatim.py   needs .venv + the PDFs; SKIPS cleanly without them
  docs/                 DEV DOCS — deliberately excluded from the zip
    UNRELEASED.md       running notebook of changes since the last release — ADD TO THIS
    RELEASING.md        how to cut and publish a release, and what CI refuses
    WORKTREES.md        working several issues at once in parallel worktrees
    ADR-001-source-split.md  why the source is split and how the build works
    _claude/            AGENT CONTEXT — working memory and reference, not for humans
      WIRING-LEDGER.md    running log of what's been done + what's deferred — READ THIS
      HUMBLEWOOD-PLAYTESTS.md  what each playtest packet adds, and what supersedes what
dist/
  fieldbook.html        the app — a BUILD ARTIFACT. Never hand-edit. Tracked in git.
  5e2024_full.json      one bundled rules pack per system — generated (gitignored)
  humblewood_full.json    …these are what the zip's data/ contains
  xanathars_full.json     XGE and TCE are D&D *supplements*: additive packs, not
  tashas_full.json        systems a character is created in
  homebrew_full.json      hand-authored third-party content, likewise additive
  fieldbook-v1.3.0.zip  the player bundle — allowlisted, no dev material (gitignored)
.github/workflows/
  ci.yml                syntax, manifest parity, data, byte hygiene, tests, full build
  release.yml           publishes on a version tag; refuses if it can't reproduce
README.md               player-facing guide                      → ships
LICENSE                 MIT                                      → ships
CLAUDE.md               this file (dev)
build.sh                build + validate + both zips; --release <level> also cuts a version
dev.sh                  interactive menu over every build/test/release task (dev)
data/
  5e2024/*.json         per-category rules data — does NOT ship; bundled into the packs
  humblewood/*.json       (the four dist/*_full.json bundles are what players get)
  xanathars/*.json      Xanathar's Guide (system "XGE") — 2014-era, converted as published
  tashas/*.json         Tasha's Cauldron (system "TCE") — ditto
  homebrew/*.json       HAND-AUTHORED (system "Homebrew"); no converter — sources are
                          PDFs/HTML/JSON and each piece needs judgement. Declares
                          `requires` for what it references but does not ship.
  overlay.json          hand-authored convert.py inputs — ship to the zip's scripts/,
  class-resources.json    NOT to its data/, because they are not loadable packs
docs/                   PLAYER-FACING reference                  → ships
  rules-schema.md       schema for every data file — READ before changing data shape
  README-converter.md   how convert.py works
  CHANGELOG.md          generated from the in-app CHANGELOG array (do not hand-edit)
scripts/
  convert.py            5e-tools JSON → rules data (advanced players)  → ships
  extract-humblewood.py Humblewood PDFs → rules data; needs .venv      (dev)
  build-html.js         concatenates src/ → dist/fieldbook.html        (dev)
  bundle-rules.js       data/<system>/*.json → dist/<system>_full.json (dev)
  gen-changelog.js      regenerates docs/CHANGELOG.md                  (dev)
  release.js            bumps APP_VERSION + folds in UNRELEASED.md     (dev)
  release-notes.js      slices one version out of the changelog for the release body
  wt.sh                 add/list/rm parallel issue worktrees            (dev)
```

**Anything added under `docs/` ships.** The zip's `docs/` is an allowlist of exactly three files;
build.sh deletes the bundle if a fourth appears. Dev docs go in `src/docs/`.

`./build.sh --no-zip` stops after the artifact, the rules-pack bundles and all the validation —
the fast path when you only want `dist/fieldbook.html`. It leaves any existing zips alone.

A plain build with pending notes in `src/docs/UNRELEASED.md` names its zips **`v<version>+dev`**,
because their contents are *not* the released version their name would otherwise claim. `--release`
empties the notebook first, so releases (and clean rebuilds at a tag) keep plain names — the release
workflow depends on that.

`./build.sh` emits **one** zip:

- **`dist/fieldbook-v<version>.zip` — player-facing only.** Exactly what README section 9 advertises:
  `fieldbook.html`, `README.md`, `LICENSE`, `data/`, `docs/`, `scripts/convert.py`. It is an
  allowlist, and the build verifies it afterwards and **deletes the zip** if anything
  development-shaped got in. If you add a dev-only doc or tool, put it under `src/` (or leave it at
  root) — never in `docs/`, or it ships.

**There is deliberately no source zip.** GitHub attaches `Source code (zip)` and `(tar.gz)` to every
release itself, built from the tag — which on a clean checkout is the identical file set, so ours
was a byte-for-byte duplicate of a free asset. It was also the only asset that differed between a
local build and the runner's, because it swept in untracked files. For a local snapshot:
`git archive HEAD -o snapshot.zip`.

`src/docs/_claude/WIRING-LEDGER.md` is the memory of the project — what's been built, why, and what's still
open. Read it at the start of any non-trivial task, and append a short entry when you finish one.

## Build & validate — the owner runs the build

**`./dev.sh`** is the human entry point: a menu over every task below, with a status header showing
version, branch, pending notes and whether the artifact is stale. It only shells out to `build.sh`
and `scripts/*` — no build logic lives in it, so it can't drift from what CI runs.

**Tests: `./src/tests/run.sh`** (across seven suites; `humblewood-verbatim` adds 129 more locally and
skips cleanly without `.venv` and the PDFs). The `docs` suite asserts the counts and filenames these
notes quote, so this file can't drift from the code again without a test going red.

**Parallel worktrees (`scripts/wt.sh`).** Several issues at once, one worktree each, in
`.claude/worktrees/<issue>/` (ignored, so `git status` on main stays clean). `wt.sh add <n> [slug]`
branches `issue/<n>-<slug>` from `origin/main`, symlinks `.venv` and `_conversion-data` in, and copies
`settings.local.json`; `wt.sh rm <n>` tears both down. **Branches carry src-only diffs — build in a
worktree to verify, but never commit `dist/fieldbook.html`.** Merges then never conflict on a 473 KB
generated file, and one `./build.sh` on main after merging produces the single correct artifact.
`.gitattributes` gives `UNRELEASED.md` and `WIRING-LEDGER.md` `merge=union`, because every branch
appends to both and a plain 3-way merge conflicts on every one. Schedule issues by which fragments
they touch: `src/html/*` is one file per tab, so tab-level UI work is disjoint by construction.
**Full procedure, scheduling rules and failure modes: `src/docs/WORKTREES.md`.**

**Git hooks (`.githooks/`, opt-in).** `./dev.sh` menu `h` sets `core.hooksPath` — one install covers
the main checkout and every worktree, since a relative `core.hooksPath` resolves against whichever
working tree the hook runs in. `pre-commit` is the fast set (js syntax, byte hygiene, JSON, workflow
YAML, manifest parity, and that every manifest-listed fragment is actually tracked — the one that
catches a new fragment nobody `git add`ed). `pre-push` adds artifact freshness and the full suite.
**Staleness is checked only on push, never on commit**, because a stale `dist/` is the expected state
on a feature branch and enforcing it at commit time would block every src-only worktree commit. The
dev-menu header shows `hooks off` when they are not installed. `--no-verify` bypasses either.

Unlike the build, the tests are safe to run unprompted — they touch no tracked file. Run them after any change to `src/js`, `scripts/`, or
`data/`. The builder's fragment validator only reads `src/js`, `src/css` and `src/html`, so `.js`
files under `src/tests/` are deliberately outside it.

**Building to test is fine. Cutting a release is not.** Run `./build.sh` (or
`node scripts/build-html.js`) whenever you want to verify a change end to end — it rewrites the
tracked artifact `dist/fieldbook.html` and regenerates `docs/CHANGELOG.md`, and that diff churn is
accepted as the cost of checking your work. Say plainly when you've built, so the artifact's state is
never in doubt, and still list what needs browser QA.

**Never cut a release on your own** — no `./build.sh --release`, no `APP_VERSION` bump, no version
tag, no publishing push. Releases are Mike's call and irreversible: pushing the tag is what makes
`.github/workflows/release.yml` publish. Add your bullets to `src/docs/UNRELEASED.md`, say a release
is ready, and stop there.

There is no runtime build *for players* either — the app is still one file they just open. But every
change must eventually pass these checks, and `./build.sh` runs all of them:

0. **Build:** `node scripts/build-html.js` concatenates `src/` into `dist/fieldbook.html`. This runs
   first; every check below reads the built file.
1. **JS syntax:** `node --check` on each `src/js` fragment, then on the `<script>` block extracted
   from `dist/fieldbook.html`.
2. **JSON:** every `data/*.json` must `JSON.parse` cleanly.
3. **Logic tests:** for any pure function you touch (version compare, cost/duration parsing, AC math,
   inventory sectioning, `migrate` round-trip, etc.), write a quick Node check and run it. These are
   the one part you *should* run unprompted — they are throwaway scripts in the scratchpad that touch
   nothing tracked, and the next two checks can't be automated:
4. **Browser smoke-test is the owner's job.** You cannot click the UI here. When a change affects
   interactive DOM behavior, say so plainly and list what to verify in a browser — don't claim it's
   fully tested.

Do not ship partial patches. Diagnose the root cause fully and fix it completely; bugs caught in play
(e.g. a spell missing from attacks, armor not equippable) are blocking.

## Versioning & changelog — the notebook, then a release

**Versions are cut deliberately, not on every edit.** `APP_VERSION` always names the last *released*
version, so a plain `./build.sh` never changes it — only `--release` does.

- **While you work:** add a `- ` bullet to **`src/docs/UNRELEASED.md`** under `## Pending`, written
  the way it should read to a player. One bullet per player-visible change. That's the whole
  obligation — do not touch `APP_VERSION` or `CHANGELOG`.
- **When the owner asks for a release:** `./build.sh --release patch|minor|major` (or an explicit
  `X.Y.Z`). That folds every pending bullet into a new `CHANGELOG` entry in `src/js/30-version.js`,
  bumps `APP_VERSION`, empties the notebook, and then builds. Semver as usual: patch = fix,
  minor = feature, major = breaking rework.
- **Never hand-edit `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array.** `scripts/release.js`
  owns all three. It refuses to release with an empty notebook, and refuses a version that isn't
  higher than the current one (that would break the in-app update check).
- **`DATA_VERSIONS` answers "do players need the new rules packs too?"** It records, per system, the
  release in which that system's `data/<dir>/` last changed — `release.js` bumps a system only when
  git says its directory actually moved since the previous tag. `bundle-rules.js` stamps each pack
  with its own value as `dataVersion`; the app compares what a player loaded against it and badges
  the pack in Settings. The release notes use the same per-system diff to name only the packs worth
  re-downloading. A system whose data didn't change keeps its old version, so nobody is nagged to
  re-import a file that is still correct.
- A plain build prints how many unreleased notes are pending, so work in progress can't be silently
  forgotten.
- **Data-only or converter-only changes need no note and no release** (the app didn't change). Put
  them in the ledger instead.
- `docs/CHANGELOG.md` is regenerated from the array on every build — never hand-edit it either.

## Publishing / updates

The app has a GitHub update check (`UPDATE_REPO = "wardmanm/RPGFieldbook"`). The in-app badge
compares the latest release tag to `APP_VERSION` and links players to the release.

**Publishing is automated — pushing the tag is the whole trigger.** Do not upload assets by hand.

```bash
./build.sh --release patch          # bumps APP_VERSION, folds in UNRELEASED.md, builds
git commit -am "Release v1.2.2"     # the version bump AND the rebuilt dist/fieldbook.html
git tag -a v1.2.2 -m "v1.2.2"
git push && git push --tags         # the tag push publishes
```

`.github/workflows/release.yml` then rebuilds from the tag in a clean checkout and refuses to
publish unless: the tag matches `APP_VERSION`, and the rebuild **reproduces the committed
`dist/fieldbook.html` byte for byte**. That second check is the point — it makes a release provably
the thing the source produces. It attaches `fieldbook.html`, both zips, and both `*_full.json` rules
packs, with that version's `docs/CHANGELOG.md` section as the body.

**Tags, not release branches.** A tag is already an immutable snapshot; a branch is a *mutable*
pointer and would be the wrong tool for "must never change". Roll back with `git checkout v1.2.1`,
or point a player at the older release. Only create a branch if you actually need to *maintain* an
old line — and then create it from the tag, at that moment: `git switch -c release/1.2.x v1.2.1`.

`.github/workflows/ci.yml` runs the mechanical checks on every push and PR, including
`build-html.js --check`. A stale committed artifact fails CI *before* it can become a bad release.

**Full procedure, failure modes and rollback: `src/docs/RELEASING.md`.**

## Architecture invariants (don't violate without discussing)

- **`migrate(s)` preserves every field by default,** then normalizes the structured ones
  (hp/abilities/saves/skills/slots/coins) onto complete defaults and guarantees list/map types. This
  is why new fields survive load. Do not turn it back into a field whitelist. New character fields
  should also get a default in `blankChar()`.
- **Effects are numeric-only.** The effects system (`{target, value}`) handles numeric modifiers
  (AC +1, save +2, speed +5). Non-numeric things — advantage, resistance, darkvision, alternate
  movement, "you know X spell" — stay as prose / glossary, not effects. This is correct, not a gap.
- **Provenance / grants.** Race/background/class add features, skills, and equipment tagged with a
  source id (`race:Name`, `bg:Name`, `class:Name`). Removing the source cleanly reverts its grants,
  including granted gold (`grantGold`) and equipment. Keep this clean-revert behavior.
- **Items carry `origin` and optional `cost`, `fav`, `sectionOverride`.** Inventory is grouped into
  sections by `invSection(it)`; a `sectionOverride` (a section name) wins over the item's real
  `category`, which must NOT be clobbered when editing a library item.
- **Armor drives AC.** `itemArmor(it)` parses armor from a structured field or the description
  ("AC 14 + Dex (max 2)"); `armorAC(c)` computes base + capped Dex (light uncapped / medium +2 /
  heavy none) + shields, and `ac` effects stack on top (magic armor still needs an `ac` effect).
- **Spells:** a spell can be an attack (`atkType:"attack"`) or a save (`atkType:"save"`); these sync
  into Attacks & Weapons via `syncSpellAttack`. `detectSpellAttack` auto-infers this from spell text
  for library spells, but only when the spell has no explicit setting (so "Not an attack" sticks).
  Casting spends the right slot (with upcast prompt), handles concentration conflicts, and adds
  timed/concentration spells to the Active Spells card (elapsed time + global round counter).
- **Tabs & ToC.** The tab bar is sticky; the title bar scrolls away. The ☰ flyout lists the active
  tab's sections and opens below the top bars.
- **Tables are data, and `cols` is the key.** Every table carries `name` (the merge key), `cols`,
  `rows`, `owner` and `ownerKind`. `tableHTML()` reads **`cols`** — a table using any other key
  renders with no header row and looks fine in the JSON, which is exactly how 16 shipped broken
  once. Prose links to a table by embedding the anchor `[Table: Exact Name]`, resolved at render
  time; `highlight()` lifts anchors out *before* escaping and before the glossary pass. Extractor
  internals must never reach `data/` — underscore-prefixed keys are stripped on write.
- **`character.notes` and `character.secNotes` are different things.** `notes` is one of the eight
  `BIO` free-text fields on the Story tab and predates everything. `secNotes` is the per-section
  notes map, keyed by `NOTE_SECTIONS` id (`src/js/87-notes.js`). Don't merge them and don't rename
  either into the other. Notes render through `noteHTML()`, which layers markdown **on top of**
  `highlight()` — escape first, then hold the tags `highlight()` inserted aside while the markdown
  regexes run. That order is the security argument; reversing it is not safe.
- **Character copies are not their definitions.** A sheet stores *copies* of rules entries, so it
  drifts as packs update. `72-char-update.js` finds that drift with per-field fingerprints and a
  `src` provenance stamp, and is pure — no DOM — so it stays testable. Three rules hold: it never
  deletes, it never touches the player's own numbers (quantities, equipped/prepared, uses, HP), and
  it **never updates without a backup first** — if storage refuses, it offers the backup as a
  download rather than proceeding unprotected.

## Converter (scripts/convert.py) conventions

- Subcommands: `conditions, glossary, feats, backgrounds, items, spells, classes, races, all`. Flags:
  `--sources sources.json` (spell→class map), `--overlay overlay.json` (class-resources overlay).
- **The recurring bug: `basicRules2024`.** That flag selects only the *free* rules subset. It has
  already caused missing **backgrounds** (4 vs 16) and missing **spells** (339 vs 391). Backgrounds
  and spells now filter on `source == "XPHB"` instead. The same trim was then found and fixed in
  **feats** (17 vs 77), **items** (78 vs 99) and **magic items** (440 vs 528). **Assume any converter
  path you touch has it too** and check the count against the full XPHB source before believing it.
- Spells only get `class` tags when `--sources sources.json` is provided; the 5e-tools spell file has
  no per-spell class data.
- New Humblewood content is folded into the existing consolidated files, not new per-packet files.

### Supplements (`convert.py supplement`)

One book at a time, selected by `source` code, into its own pack folder. `Book` carries the source
codes, the `system` stamp, the pack names, the `_note` and `excludeSystems`; the **default `Book` is
the 2024 path**, so omitting the flags reproduces `data/5e2024/` byte for byte. That equality is the
gate on any converter change — if `data/5e2024/` moves, `release.js` bumps XPHB's `DATA_VERSIONS`
and every player is told to re-download a pack that didn't really change. Check it first and last:

```bash
python3 scripts/convert.py all _conversion-data/5etools-v2.33.2 -o /tmp/chk && diff -r /tmp/chk data/5e2024
```

Three traps, all of which produce output that looks entirely correct:

- **Subclasses dedupe on `_copy`, never on name.** 5e-tools ships each XGE/TCE subclass twice; the
  second is a `_copy` stub under the 2024 `classSource`, and 35 of 57 carry no features. Preferring
  the newer `classSource` ships subclasses with `"levels": {}`.
- **Spell class tags live under `classVariant`** for a 2014-era book, and under PHB/TCE sources.
  Reading only `class`/XPHB gives Xanathar's 0 of 95 tags — a complete-looking pack whose "only my
  class" filter shows nothing.
- **Table names are a global lookup** (`findTable`), and `[Table: …]` anchors carry no pack. Pass
  `--avoid-table-names data/5e2024/tables.json` so the eight names the 2024 PHB reuses get suffixed;
  the anchors follow automatically because `_register` returns the final name.

Anything a supplement adds that the core pack already has — the Artificer and its subclasses — is
**skipped**, not shipped again: `subclassesFor()` offers a same-named subclass alongside the
existing one rather than replacing it, so a duplicate would be visible, not silent.

## Source split — IN EFFECT (see src/docs/ADR-001-source-split.md)

The split is done. These rules are live:

- **Source of truth is `src/`. `dist/fieldbook.html` is a build artifact — never hand-edit it.**
  Edit the fragments; the owner builds (see "Build & validate" above). Leaving `dist/` stale is the
  expected state between an edit and his build. The builder refuses to overwrite an artifact that
  looks hand-edited, and tells you to port the change into `src/`.
- **Where to edit what:**
  - JS → `src/js/*.js` (the fragment whose name matches the area; they are positional slices)
  - CSS → `src/css/*.css`
  - **A tab panel's markup → `src/html/*.html`** (one file per tab). This is the easy one to forget.
  - **Everything else in the `<body>` → `src/fieldbook.template.html`** — the top bar, tab bar, ToC
    flyout, home screen and the generic modal. It is the SHELL, not the whole body any more.
  - `APP_VERSION` / `CHANGELOG` → `src/js/30-version.js`. (Not `00-constants.js` as ADR-001
    originally sketched — they sit mid-file in the original and rule 1 forbids moving them.)
    Do NOT split this fragment: `dev.sh`, `release.yml`, `release.js` and the `docs` suite all
    hardcode its name, and the release pipeline dies at the tag if it moves.
- **Adding or removing a fragment means editing `src/manifest.json`.** It is the authoritative
  order, not the filename prefixes and not a glob. The build hard-fails if a `.js`/`.css`/`.html`
  file exists in `src/` but is not listed, or is listed but missing.
- **Concatenation only** — no ES modules, no `import`/`export`, no bundler. Ordered `.js` fragments
  are inlined into one `<script>`; ordered `.css` into one `<style>`; ordered `.html` into the page
  body. This is what keeps the app working from `file://` on every device with no server.
- **Cut, don't reorder:** fragments concatenate in the same top-to-bottom order as the original file,
  and `boot()` stays last — machine-checked by the builder. See ADR-001 for the ordering rationale
  (TDZ on top-level const/let).
- **Byte hygiene is load-bearing.** The build is byte-exact, so a stripped final newline, a CRLF, or
  a BOM in a fragment changes the shipped app. `.editorconfig` and `.gitattributes` guard this, and
  the builder rejects CR bytes and BOMs outright.
- `node scripts/build-html.js --check` exits non-zero if `dist/fieldbook.html` is stale — useful as a
  pre-commit or CI gate. Don't put it inside `build.sh`; that script's job is to *fix* staleness.

## Working style

- Make one coherent change at a time; track what changed and why (ledger + changelog).
- Prefer a proper interactive chooser over storing descriptive text when rules allow player choice.
- Verify before diagnosing something as "missing" — don't over-infer from data shape.
- Keep responses and commits focused. Owner does the browser QA and makes scope calls.
