# Fieldbook — project brief for Claude Code

Read this first. It holds the rules this project is built by. Follow them unless the owner (Mike —
product owner, decision-maker, and QA) says otherwise. When in doubt, ask before doing something
irreversible.

**The reference is the wiki, `src/docs/wiki/`.** How each part of Fieldbook works, why, and what has
already gone wrong there, one topic per page. Its index is loaded below (links in it are relative to
`src/docs/wiki/`). **Read the page before changing the thing it describes**, and update it after —
see "Keeping the docs current". This file holds only the rules.

@src/docs/wiki/index.md

## What this is

**Fieldbook** is a standalone, single-file HTML character sheet app supporting **D&D 5e 2024 (XPHB)**
and the **Humblewood** TTRPG, plus additive packs for **Xanathar's Guide**, **Tasha's Cauldron** and
hand-authored **homebrew**. It ships as one self-contained file, `dist/fieldbook.html`, built by
concatenating the fragments in `src/`. A Python CLI (`scripts/convert.py`) turns 5e-tools exports into
the app's JSON; a dev-only one (`scripts/extract-humblewood.py`) reads the Humblewood books and
playtest PDFs. Players load the resulting rules packs at runtime. Details: [overview](src/docs/wiki/overview.md).

## Non-negotiable constraints

1. **Single shipped file.** Everything ends up in one `dist/fieldbook.html` that opens from a local
   file and works offline. No `<script src>`/`<link href>` to third-party URLs, no ES modules
   (`import`/`export`, `type="module"`) — the `src/` split is concatenation only (ADR-001).
2. **Offline-first, and storage failures are loud.** localStorage for characters, settings and the
   library; IndexedDB for the rules cache (localStorage, LZW-compressed, as fallback). Every IndexedDB
   call is timed out. A storage write that does not land must SAY SO — never an empty `catch` around
   `setItem`. The only network calls — the rules-source fetch and the GitHub update check — are
   optional and fail silently offline. → [storage](src/docs/wiki/architecture/storage.md)
3. **Backward-compatible data.** Never break loading of existing saved characters. New character
   fields are optional, get a default in `blankChar()`, and survive a save→load round trip.
   → [character model](src/docs/wiki/architecture/character-model.md)

## Where to edit what

```
src/                     THE SOURCE OF TRUTH — edit here, never the built file
  fieldbook.template.html  the page SHELL: top bar, tab bar, ToC, home, modal
  manifest.json          the authoritative concatenation ORDER — add/remove a fragment here
  html/*.html            7 fragments, one tab panel each
  js/*.js                28 fragments, concatenated into the single <script>
  css/*.css              8 fragments, concatenated into the single <style>
  icons/icons.json       hand-authored emblem map → scripts/fetch-icons.js → js/05-icons.js
  tests/                 the suites — ./src/tests/run.sh
  docs/                  dev docs (never ship): wiki/, specs/, plans/, UNRELEASED.md, …
dist/fieldbook.html      BUILD ARTIFACT, tracked. Never hand-edit
data/<system>/*.json     rules data; bundled into dist/*_full.json packs
docs/                    PLAYER-FACING, ships — an allowlist of exactly three files
```

- JS → the `src/js/` fragment whose area matches (they are positional slices of the original file,
  so the code map in the overview is the way to find things). A tab panel's markup → its
  `src/html/` file. Everything else in `<body>` → the template.
- `APP_VERSION` / `DATA_VERSIONS` / `CHANGELOG` live in `src/js/30-version.js`. Do not split or rename
  that fragment: `dev.sh`, `release.yml`, `release.js` and the `docs` suite name it.
- **Cut, don't reorder.** Fragments concatenate in the original top-to-bottom order and `boot()` stays
  last (TDZ on top-level `const`/`let`). The build rejects CR bytes and BOMs — byte hygiene is
  load-bearing. → [build & source split](src/docs/wiki/architecture/build-and-source-split.md)
- **Anything added under `docs/` ships.** Dev docs and tools go under `src/`.

## Build, test, QA — build freely, never release

- **Tests: `./src/tests/run.sh`** (across seven suites). `humblewood-verbatim` needs PyMuPDF and the
  PDFs, so under the system `python3` it skips cleanly; run it directly with
  `.venv/bin/python src/tests/humblewood-verbatim.py`. Safe to run unprompted — they touch no tracked file. Run them after any
  change to `src/`, `scripts/` or `data/`. For a pure function you touch, also write a throwaway Node
  check in the scratchpad. → [testing](src/docs/wiki/process/testing.md)
- **Building to test is fine:** `./build.sh`, or `./build.sh --no-zip` for just the artifact. It
  rewrites the tracked `dist/fieldbook.html` and `docs/CHANGELOG.md`; say plainly when you've built.
  → [building & CI](src/docs/wiki/process/building-and-ci.md)
- **Never cut a release on your own** — no `./build.sh --release`, no `APP_VERSION` bump, no version
  tag, no publishing push. Pushing the tag is what publishes. Add notes to `src/docs/UNRELEASED.md`,
  say a release is ready, and stop. Procedure: [RELEASING](src/docs/RELEASING.md).
- **Screenshots are required for any UI-affecting change** — each affected tab, before and after for
  a change to existing UI, via the project's Playwright MCP server (`.mcp.json`), never a
  plugin-provided one (it refuses `file://`). Tab names are lowercase; `newCharacter(name, system)`
  is the one-line way into a sheet; shoot both skins when themed CSS changes. No screenshot, no claim
  that the UI works. → [screenshot QA](src/docs/wiki/process/screenshot-qa.md)
- **Drive interactive changes** (click, fill, then screenshot) and state plainly what you drove and
  what you did not. Real devices, touch, print and Mike's own characters remain his pass.
- **Worktrees:** one issue per worktree via `scripts/wt.sh`; branches carry **src-only diffs — never
  commit `dist/fieldbook.html` from one**; integrate one branch per `git merge`.
  → [WORKTREES](src/docs/WORKTREES.md)
- Git hooks are opt-in (`./dev.sh` menu `h`); staleness is checked on push, never on commit.

Do not ship partial patches. Diagnose the root cause and fix it completely; bugs caught in play are
blocking.

## Versioning & changelog

- **Player-visible change → one `- ` bullet in `src/docs/UNRELEASED.md`** under `## Pending`, written
  the way it should read to a player. No `<tags>` and no hard-coded versions (the `docs` suite checks).
- **Never hand-edit `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array** — `scripts/release.js`
  owns all three. `docs/CHANGELOG.md` is generated.
- **Data-only or converter-only changes need no note and no release** — record them in the ledger.

## Architecture invariants — don't violate without discussing

Each links to the page that explains it and what broke when it was ignored.

- **`migrate(s)` preserves every field by default,** then normalizes; never a whitelist. New fields
  get a default in `blankChar()`. → [character model](src/docs/wiki/architecture/character-model.md)
- **Effects are numeric-only.** Advantage, resistance, senses, movement modes, "you know X" stay
  prose. That is correct, not a gap. → [effects](src/docs/wiki/architecture/computed-stats-and-effects.md)
- **Grants carry provenance** (`race:`, `bg:`, `class:`) and removing the source reverts them cleanly,
  gold and equipment included. → [grants](src/docs/wiki/architecture/grants-and-provenance.md)
- **Items:** `origin`, optional `cost`/`fav`/`sectionOverride`; an override never clobbers the real
  `category`. → [inventory](src/docs/wiki/features/inventory.md)
- **Armor drives AC**; magic armor still needs an `ac` effect. → [armor & AC](src/docs/wiki/features/armor-and-ac.md)
- **Spells sync into Attacks** as attack or save; an explicit "Not an attack" sticks.
  → [attacks & damage](src/docs/wiki/features/attacks-and-damage.md)
- **The tab bar is sticky; the title bar scrolls away.** The ☰ flyout lists the active tab's sections
  and opens below the top bars. → [shell](src/docs/wiki/ui/shell.md)
- **Tables are data and `cols` is the key**; prose links them with `[Table: Exact Name]`;
  underscore keys never reach `data/`. → [rules & tables](src/docs/wiki/features/rules-and-tables.md)
- **`character.notes` ≠ `character.secNotes`.** Notes render markdown on top of `highlight()` —
  escape first; that order is the security argument. → [rich text](src/docs/wiki/architecture/rich-text.md)
- **Character copies are not their definitions.** The rules-update tool never deletes, never touches
  the player's numbers, and never updates without a backup first.
  → [rules-update tool](src/docs/wiki/features/rules-update-tool.md)

## Converter

- **The recurring bug is the free-rules subset.** `basicRules2024` or `srd52` selects only it, and has
  already trimmed backgrounds, spells, feats, items and magic items. Assume any converter path you
  touch has it, and check its count against the full XPHB source.
- **`data/5e2024/` must reproduce byte for byte** after any converter change, or `release.js` tells
  every player to re-download a pack that didn't change:

  ```bash
  python3 scripts/convert.py all _conversion-data/5etools-v2.36.1 -o /tmp/chk && diff -r /tmp/chk data/5e2024
  ```
- Supplements have three traps that all produce correct-looking output. Read
  [supplements](src/docs/wiki/data/supplements.md) before touching `convert.py supplement`.
  → [converter](src/docs/wiki/data/converter.md)

## Keeping the docs current

At the end of any task that changed behaviour, data, the converter, the build or the process:

1. **Append a short ledger entry** to the end of `src/docs/_claude/WIRING-LEDGER.md` — what changed
   and why, linking the page. The ledger is the log; the wiki is the reference. Append only: pages
   cite its headings by line number.
2. **Update the wiki pages it touched** — rewrite them to the new truth and add a History line
   citing that entry; list any new page in the index. The `wiki` skill (`/wiki ingest`) holds the
   procedure, including re-pointing citations after a worktree merge.
3. **Add the `UNRELEASED.md` bullet** if a player can see the change.

## Working style

- Make one coherent change at a time; track what changed and why (wiki + ledger + notebook).
- Prefer a proper interactive chooser over storing descriptive text when rules allow player choice.
- Verify before diagnosing something as "missing" — don't over-infer from data shape.
- Keep responses and commits focused. Mike does the browser QA and makes scope calls.
