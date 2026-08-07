# Fieldbook — project brief for Claude Code

Read this first. It encodes the conventions this project has been built with. Follow them unless the
owner (Mike — product owner, decision-maker, and QA) says otherwise. When in doubt, ask before doing
something irreversible.

## What this is

**Fieldbook** is a standalone, single-file HTML character sheet app supporting **D&D 5e 2024 (XPHB)**
and the **Humblewood** TTRPG. The whole app is `fieldbook.html` — HTML + CSS + JS in one file. A
Python CLI (`scripts/convert.py`) turns source data (5e-tools exports, Humblewood playtest PDFs) into
the app's JSON, which players load at runtime.

## Non-negotiable constraints

1. **Single file.** All app functionality lives in `fieldbook.html`. No external runtime
   dependencies, no build step to *run* the app, no network needed to use it. It must open from a
   local file and work offline. Do not add `<script src>`/`<link href>` to third-party URLs or split
   the app into modules.
2. **Offline-first.** localStorage for persistence. The only network calls are optional and must fail
   silently when offline: the rules-source fetch (user-configured URLs) and the GitHub update check.
3. **Backward-compatible data.** Never break loading of existing saved characters. New character
   fields must be optional and must survive a save→load round-trip (see `migrate`).

## Repo layout

```
fieldbook.html          the app (single file)
README.md               player-facing guide
CLAUDE.md               this file
build.sh                validate + regenerate CHANGELOG.md + build the bundle zip
data/*.json             rules data the app loads (D&D 2024 + Humblewood)
docs/
  rules-schema.md       schema for every data file — READ before changing data shape
  README-converter.md   how convert.py works
  WIRING-LEDGER.md       running log of what's been done + what's deferred — READ THIS
  CHANGELOG.md          generated from the in-app CHANGELOG array (do not hand-edit)
scripts/convert.py      the data converter
```

`docs/WIRING-LEDGER.md` is the memory of the project — what's been built, why, and what's still
open. Read it at the start of any non-trivial task, and append a short entry when you finish one.

## Build & validate — always do this before delivering

There is no runtime build, but every change must pass these checks. `./build.sh` runs all of them:

1. **JS syntax:** extract the inline `<script>` blocks from `fieldbook.html` and run `node --check`.
2. **JSON:** every `data/*.json` must `JSON.parse` cleanly.
3. **Logic tests:** for any pure function you touch (version compare, cost/duration parsing, AC math,
   inventory sectioning, `migrate` round-trip, etc.), write a quick Node check and run it. This
   project leans on these because the next check can't be automated:
4. **Browser smoke-test is the owner's job.** You cannot click the UI here. When a change affects
   interactive DOM behavior, say so plainly and list what to verify in a browser — don't claim it's
   fully tested.

Do not ship partial patches. Diagnose the root cause fully and fix it completely; bugs caught in play
(e.g. a spell missing from attacks, armor not equippable) are blocking.

## Versioning & changelog — required on every fieldbook.html change

- `const APP_VERSION` near the top of the script is the source of truth; it shows as a badge in the
  top bar and opens the in-app changelog.
- The `const CHANGELOG = [ … ]` array (also near the top) holds `{v, date, notes:[…]}` entries,
  newest first.
- **On every change to `fieldbook.html`:** bump `APP_VERSION` (semver — patch = fix, minor = feature,
  major = breaking rework), add a CHANGELOG entry at the top of the array describing the change since
  the last version, then run `./build.sh` (it regenerates `docs/CHANGELOG.md` from the array).
- **Data-only or converter-only changes do NOT bump `APP_VERSION`** (the app didn't change). Note
  them in the ledger instead.

## Publishing / updates

The app has a GitHub update check: set `const UPDATE_REPO = "owner/repo"` to enable it. To publish an
update, cut a **GitHub Release** tagged `vX.Y.Z` (matching `APP_VERSION`) and attach `fieldbook.html`.
The in-app badge compares the latest release tag to `APP_VERSION` and links players to the release.

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

## Converter (scripts/convert.py) conventions

- Subcommands: `conditions, glossary, feats, backgrounds, items, spells, classes, all`. Common flags:
  `--sources sources.json` (spell→class map), `--overlay overlay.json` (class-resources overlay).
- **The recurring bug: `basicRules2024`.** That flag selects only the *free* rules subset. It has
  already caused missing **backgrounds** (4 vs 16) and missing **spells** (339 vs 391). Backgrounds
  and spells now filter on `source == "XPHB"` instead. **If you touch any other converter path
  (feats, items, classes) assume it may have the same trim** and check against the full XPHB source.
- Spells only get `class` tags when `--sources sources.json` is provided; the 5e-tools spell file has
  no per-spell class data.
- New Humblewood content is folded into the existing consolidated files, not new per-packet files.

## Planned: source split (see docs/ADR-001-source-split.md)

The owner intends to split the source into modules (`src/js/*.js`, optional `src/css/*.css`) while
still **shipping a single `fieldbook.html`** built by concatenation. This is decided but **not yet
implemented** — until it is, `fieldbook.html` remains the source and everything above applies as
written. Do not start the split unless the owner asks; ADR-001 is the full brief for when they do.

Once the split has been executed, these rules take effect:
- **Source of truth is `src/`.** `fieldbook.html` becomes a build artifact — never hand-edit it;
  edit the fragments and run `./build.sh`.
- **Concatenation only** — no ES modules, no `import`/`export`, no bundler. Ordered `.js` fragments
  are inlined into one `<script>`; ordered `.css` into one `<style>`. This is what keeps the app
  working from `file://` on every device with no server.
- **Cut, don't reorder:** fragments concatenate in the same top-to-bottom order as the current file,
  and `boot()` stays last. See ADR-001 for the ordering rationale (TDZ on top-level const/let).
- **Prove it's a pure refactor:** the first build must produce a `fieldbook.html` whose JS/CSS is
  identical (whitespace-only diffs) to the pre-split app. `APP_VERSION`/CHANGELOG live in
  `src/js/00-constants.js` after the split; the version/changelog process is otherwise unchanged.

## Working style

- Make one coherent change at a time; track what changed and why (ledger + changelog).
- Prefer a proper interactive chooser over storing descriptive text when rules allow player choice.
- Verify before diagnosing something as "missing" — don't over-infer from data shape.
- Keep responses and commits focused. Owner does the browser QA and makes scope calls.
