# Overview

Fieldbook is a character sheet for **D&D 5e 2024** and **Humblewood**, shipped as one self-contained
HTML file that opens from disk and works offline. Rules content is not built in: players load **rules
packs** (JSON) generated from 5e-tools exports and the Humblewood books, and the sheet copies what a
character takes from them. This page is the map — what the pieces are called, where they live, and
which page explains each.

**Code:** all of `src/` · **See also:** [index](index.md), [CLAUDE.md](../../../CLAUDE.md) (the rules),
[README](../../../README.md) (the player guide)

## How it works

Two layers, joined at runtime:

- **The app** — `src/` concatenated by `scripts/build-html.js` into `dist/fieldbook.html`: one
  `<style>`, one `<script>`, the page shell with seven tab panels spliced in. No framework, no
  modules, no network needed. → [Build & source split](architecture/build-and-source-split.md)
- **The rules packs** — `data/<dir>/*.json`, bundled by `scripts/bundle-rules.js` into one
  `dist/<dir>_full.json` per pack. A player imports them in Settings (or fetches them from
  configured URLs); they are cached in IndexedDB. → [Rules packs](architecture/rules-packs.md),
  [Storage](architecture/storage.md)

A **character** is created in one of two **systems**, `"dnd"` or `"humblewood"`, which also picks
the **skin** (`classic` or `humblewood`). Packs are stamped with a `system` of their own:

| Pack dir | `system` stamp | Role |
|---|---|---|
| `data/5e2024/` | `XPHB` | core D&D 2024 |
| `data/humblewood/` | `Humblewood` | core Humblewood (supplements D&D classes/spells; replaces species) |
| `data/xanathars/` | `XGE` | additive supplement, not a system you create a character in |
| `data/tashas/` | `TCE` | additive supplement |
| `data/homebrew/` | `Homebrew` | hand-authored, additive; declares `requires` |

The three non-negotiables — one shipped file, offline-first with loud storage failures,
backward-compatible saves — are stated in [CLAUDE.md](../../../CLAUDE.md) and argued on
[Build & source split](architecture/build-and-source-split.md), [Storage](architecture/storage.md)
and [Character model](architecture/character-model.md).

### Repo layout

The split is by **audience**: everything under `src/` is development material and never reaches
players; `docs/` is player-facing and ships in the zip.

```
src/                      THE SOURCE OF TRUTH — edit here, never the built file
  fieldbook.template.html   the page SHELL — top bar, tab bar, ToC, home, modal; three markers:
                            /*@@CSS@@*/, <!--@@HTML@@--> and //@@JS@@
  manifest.json           the authoritative concatenation ORDER for html/, js/ and css/
  html/*.html             one tab panel each, spliced into <div class="page">
  js/*.js                 concatenated into the single <script>
  css/*.css               concatenated into the single <style>
  icons/icons.json        HAND-AUTHORED emblem map → scripts/fetch-icons.js → js/05-icons.js
  tests/                  the suites — ./src/tests/run.sh
  docs/                   DEV DOCS — deliberately excluded from the zip
    wiki/                   this wiki
    UNRELEASED.md           changelog notebook since the last release
    RELEASING.md            cutting and publishing a release
    WORKTREES.md            several issues at once in parallel worktrees
    ADR-001-source-split.md why the source is split
    specs/  plans/          one design spec per feature, and the plans that execute them
    _claude/                agent context: WIRING-LEDGER.md (the log), HUMBLEWOOD-PLAYTESTS.md
dist/
  fieldbook.html          the app — a BUILD ARTIFACT, tracked in git. Never hand-edit
  <dir>_full.json         one bundled rules pack per data dir (gitignored)
  fieldbook-v<ver>.zip    the player bundle — allowlisted, no dev material (gitignored)
data/
  <dir>/*.json            per-category rules data — bundled into the packs, does not ship as-is
  overlay.json            hand-authored convert.py inputs; ship to the zip's scripts/,
  class-resources.json      not its data/, because they are not loadable packs
docs/                     PLAYER-FACING — ships. An allowlist of exactly three files:
  rules-schema.md           the schema of every data file
  README-converter.md       how convert.py works
  CHANGELOG.md              generated from the in-app CHANGELOG array
scripts/
  convert.py              5e-tools JSON → rules data (ships, for advanced players)
  extract-humblewood.py   Humblewood PDFs → rules data; needs .venv (dev)
  build-html.js           src/ → dist/fieldbook.html (dev)
  bundle-rules.js         data/<dir>/ → dist/<dir>_full.json (dev)
  gen-changelog.js        regenerates docs/CHANGELOG.md (dev)
  release.js              bumps APP_VERSION, folds in UNRELEASED.md (dev)
  release-notes.js        one version's changelog section, for the release body (dev)
  fetch-icons.js          vendors game-icons.net glyphs into js/05-icons.js (dev)
  playwright-mcp.js       cross-platform launcher for the screenshot MCP (dev)
  wt.sh                   add/list/rm parallel issue worktrees (dev)
.claude/skills/wiki/      the skill that maintains this wiki (tracked; never ships)
.github/workflows/        ci.yml (every push and PR), release.yml (on a version tag)
build.sh · dev.sh         build + validate + zip; the interactive menu over every task
```

### Code map

The JS fragments are **positional slices** of what was once one file (ADR-001), so a fragment's
name says where its first function came from, not everything it holds: `migrate()` lives in
`71-char-io.js`, `highlight()` in `10-compute.js`, `renderAll()` in `66-coins-hp.js`, and
`renderSpells()` in `60-attacks.js`. Search by function name; use this table to find the page.

| Fragment | What is in it | Pages |
|---|---|---|
| `00-constants.js` | `ABIL`, `SKILLS`, `BIO`; `blankChar()`; `contributions()`, `sumFx()`, `abilFinal()`; `originSid()`, `grantProf()`, `removeGrants()`; the ability/skill/death/slot builders; caster and slot maths | [Character model](architecture/character-model.md), [Computed stats](architecture/computed-stats-and-effects.md), [Grants](architecture/grants-and-provenance.md), [Abilities & skills](features/abilities-and-skills.md), [Spells](features/spells.md) |
| `05-icons.js` | GENERATED emblem glyphs and `ICON_MAP` | [Theming & icons](ui/theming-and-icons.md) |
| `10-compute.js` | `recompute()`; `highlight()`, `descHTML()`, `renderRT()` | [Computed stats](architecture/computed-stats-and-effects.md), [Rich text](architecture/rich-text.md) |
| `20-lists.js` | features list, `usesMax()`, `renderFeatures()` | [Features & traits](features/features-and-traits.md) |
| `25-origins-items.js` | `ORIGIN_KINDS`, item origin and cost, weight and encumbrance, size, `itemArmor()`, `armorAC()` | [Inventory](features/inventory.md), [Armor & AC](features/armor-and-ac.md), [Vitals & rest](features/vitals-and-rest.md) |
| `30-version.js` | `APP_VERSION`, `DATA_VERSIONS`, `CHANGELOG`, `UPDATE_REPO`; `checkForUpdate()`, the update pill | [Settings & updates](features/settings-and-updates.md), [Rules packs](architecture/rules-packs.md) |
| `40-sheet.js` | `selectTab()`, the ToC; `invSection()`, item uses, `renderInventory()`; statuses, concentration card, familiars | [Shell](ui/shell.md), [Inventory](features/inventory.md), [Conditions & concentration](features/conditions-and-concentration.md), [Sections & layout](ui/sections-and-layout.md) |
| `50-classrace.js` | rules lookups, emblems (`iconSVG()`), subclasses; the grant machinery (`applyEquipGrants()`, `revertEquipmentGrants()`, `grantFeatDef()`, `runExtraChoices()`); `renderClassRace()` | [Grants](architecture/grants-and-provenance.md), [Character building](features/character-building.md) |
| `52-race.js` | ancestry/species pickers, `systemOf()` | [Character building](features/character-building.md) |
| `54-background.js` | background pickers | [Character building](features/character-building.md) |
| `56-class.js` | add/remove class, level up/down, subclass, level-1 HP seed | [Character building](features/character-building.md), [Vitals & rest](features/vitals-and-rest.md) |
| `58-choices.js` | "choose N" choices: `runChoices()`, `gatherChoices()`, `commitChoices()` | [Character building](features/character-building.md) |
| `60-attacks.js` | `attackNumbers()`, damage; spell→attack sync; casting, Active Spells, `advanceRound()`; `renderAttacks()`, `renderSpells()` | [Attacks & damage](features/attacks-and-damage.md), [Spells](features/spells.md), [Conditions & concentration](features/conditions-and-concentration.md) |
| `65-resources.js` | death saves, rests, Hit Dice, dice expressions, resource trackers, slot bubbles | [Vitals & rest](features/vitals-and-rest.md), [Class resources](features/class-resources.md) |
| `66-coins-hp.js` | portrait, coins and the Adjust transaction, HP entry, `renderAll()` | [Inventory](features/inventory.md), [Vitals & rest](features/vitals-and-rest.md) |
| `70-persistence.js` | localStorage keys, the character library, backups, IndexedDB with timeouts, LZW | [Storage](architecture/storage.md), [Home & characters](features/home-and-characters.md) |
| `71-char-io.js` | IDB rules-cache hydration, `migrate()`, export/import, print | [Character model](architecture/character-model.md), [Home & characters](features/home-and-characters.md), [Storage](architecture/storage.md) |
| `72-char-update.js` | pure diff of a sheet against its packs: `stampSrc()`, `diffCharacter()` | [Rules-update tool](features/rules-update-tool.md) |
| `73-char-update-ui.js` | the review modal for that diff | [Rules-update tool](features/rules-update-tool.md) |
| `75-home-theme.js` | home screen, `newCharacter()`, `skinForSystem()`, `applyTheme()` | [Home & characters](features/home-and-characters.md), [Theming & icons](ui/theming-and-icons.md) |
| `80-modal-forms.js` | `openModal()` with dismiss guards and focus; the item, feature, spell, status and familiar forms | [Shell](ui/shell.md), [Inventory](features/inventory.md), [Spells](features/spells.md) |
| `85-browse.js` | `openBrowse()`, the full-screen finder; item, spell and feat pickers | [Shell](ui/shell.md), [Inventory](features/inventory.md), [Spells](features/spells.md), [Features & traits](features/features-and-traits.md) |
| `86-tables.js` | Rules-tab folding, `findTable()`, `tableHTML()` | [Rules & tables](features/rules-and-tables.md) |
| `87-notes.js` | `NOTE_SECTIONS`, section notes, `noteHTML()`, the Section Notes card | [Story & notes](features/story-and-notes.md), [Rich text](architecture/rich-text.md), [Sections & layout](ui/sections-and-layout.md) |
| `87-combat.js` | the combat tab and tracker | [Combat view](features/combat-view.md) |
| `87-journal.js` | the Journal card's pages: tags, order, search, the page rule, the stamp | [Journal](features/journal.md) |
| `88-settings.js` | the Settings modal, rules status, `dataStatus()` | [Settings & updates](features/settings-and-updates.md) |
| `89-rules-merge.js` | `requires` checking, `mergeRules()`, `ruleById()`, fetch and import of packs | [Rules packs](architecture/rules-packs.md) |
| `90-boot.js` | `wire()`, `boot()` — always last | [Shell](ui/shell.md), [Build & source split](architecture/build-and-source-split.md) |
| `00-tokens.css` | theme tokens, both skins, light/dark | [Theming & icons](ui/theming-and-icons.md) |
| `10-chrome.css` | top bar and tabs | [Shell](ui/shell.md) |
| `20-cards.css` | ink cards | [Sections & layout](ui/sections-and-layout.md) |
| `30-sheet.css` | the sheet's cards | [Sections & layout](ui/sections-and-layout.md) |
| `35-tables.css` | reference tables and table anchors | [Rules & tables](features/rules-and-tables.md) |
| `40-spells-coins.css` | spell slots, spells, coins | [Spells](features/spells.md), [Inventory](features/inventory.md) |
| `45-combat.css` | the combat button and tab | [Combat view](features/combat-view.md) |
| `50-modal.css` | the modal | [Shell](ui/shell.md) |
| `00-sheet.html` | the Sheet tab | [Sections & layout](ui/sections-and-layout.md) |
| `10-inventory.html` | the Inventory tab | [Inventory](features/inventory.md) |
| `20-spells.html` | the Spells tab | [Spells](features/spells.md) |
| `30-story.html` | the Story tab | [Story & notes](features/story-and-notes.md) |
| `40-rules.html` | the Rules tab | [Rules & tables](features/rules-and-tables.md) |
| `60-journal.html` | the Journal tab | [Story & notes](features/story-and-notes.md) |
| `70-combat.html` | the Combat tab | [Combat view](features/combat-view.md) |

### Glossary

| Term | Meaning |
|---|---|
| **system** | For a *character*: `"dnd"` or `"humblewood"`, chosen at creation. For a *pack*: its `system` stamp (`XPHB`, `Humblewood`, `XGE`, `TCE`, `Homebrew`), the key of `DATA_VERSIONS` |
| **pack** | One bundled rules file, `dist/<dir>_full.json`; loaded packs merge into the global `rules` |
| **supplement** | A pack that adds to a system rather than being one (XGE, TCE, homebrew) |
| **skin** | The visual theme, `classic` or `humblewood`; follows the character's system |
| **sid** | A grant's source id: `race:<name>`, `bg:<name>`, `class:<name>`, `subclass:<class>:<sub>` — from `originSid()` |
| **grant** | Something a source added to the character (a proficiency, feature, item, gold), recorded with its sid so removing the source reverts it |
| **origin** | Where an item came from — one of `ORIGIN_KINDS` (class, background, ancestry, feat, starting, purchased, found, …), shown as a letter badge |
| **section** | Two meanings. An *inventory section* is the group an item files under (`invSection()`, `sectionOverride`). A *sheet section* is a card in `NOTE_SECTIONS`, the registry that section notes, the combat view and print share (the ☰ ToC is separate: it walks the DOM) |
| **library** | The character library: the index of saved characters in localStorage (`K_LIB`). Not the rules — those are "packs" or "the rules cache" |
| **stamp / fingerprint** | What `stampSrc()` writes on a copied rules entry: its pack, category and per-field hashes, so the rules-update tool can tell drift from player edits |
| **effect** | A numeric modifier `{target, value}` (AC +1, save +2, speed +5). Nothing non-numeric is an effect |
| **BIO / notes / secNotes** | `BIO` lists the Story tab's free-text fields, of which `character.notes` is one; `character.secNotes` is the per-section notes map. Different things |

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where dev docs live | Split by reader: `src/docs/` for Mike's, `src/docs/_claude/` for agent context; ADR-001 stays with the human docs | — ; the zip guard's `^src\/` rule covers both, so there is no packaging risk either way |
| How the reference is kept | This wiki, compiled from the ledger and kept current by each change ([spec](../specs/2026-09-28-living-wiki-design.md)) | The ledger alone: it is in date order, so learning the current state of spells meant replaying 11 entries to see which won |

## History

- 2026-08-07 — Moved to Claude Code: CLAUDE.md, build.sh and .gitignore added. → ledger L341
- 2026-08-10 — Dev docs split by reader into `src/docs/` and `src/docs/_claude/`. → ledger L1302
- 2026-09-28 — The wiki: reference compiled out of the ledger into topic pages; CLAUDE.md slimmed to the rules. → ledger L3709
