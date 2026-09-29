# Fieldbook wiki

How Fieldbook works **now**, one topic per page. The [ledger](../_claude/WIRING-LEDGER.md) is the log
of how it got here; these pages are what that log compiles to. Dev-only: nothing under `src/` ships.

**Keeping it current is part of every change.** When a task alters behaviour, append its ledger
entry, then update the pages that describe it in the same branch, in present tense, each with a
one-line History entry citing that ledger heading. Adding a page means adding its line below. The `wiki` skill
(`.claude/skills/wiki/`) holds the procedure and the page template; `src/tests/docs.js` checks that
every page is listed here, every link resolves, every function a page names exists, every JS
fragment is covered by some page, and every ledger `L<n>` a page cites is still a ledger heading
(so the ledger stays append-only). Design: [the wiki spec](../specs/2026-09-28-living-wiki-design.md).

## Start here

- [Overview](overview.md) — what Fieldbook is, the three non-negotiables, the code map, a glossary of project terms
- [Decisions](decisions.md) — register of every recorded decision, one line each, linking to where it is argued

## Architecture

- [Build & source split](architecture/build-and-source-split.md) — src/ → one file: template, manifest, order, byte hygiene, the clobber guard
- [Storage](architecture/storage.md) — localStorage for characters/settings/library, IndexedDB for the rules cache, and failing loudly
- [Character model](architecture/character-model.md) — `blankChar()`, `migrate()`, the save→load round trip, `notes` vs `secNotes`
- [Rules packs](architecture/rules-packs.md) — systems vs supplements, loading and merging, `requires`, `dataVersion`
- [Grants & provenance](architecture/grants-and-provenance.md) — source ids, clean revert, granted gold and equipment
- [Computed stats & effects](architecture/computed-stats-and-effects.md) — `recompute()`, numeric-only effects, `usesMax` formulas
- [Rich text](architecture/rich-text.md) — `highlight()`, glossary, table anchors, markdown on top, and why that order is safe

## Features

- [Home & characters](features/home-and-characters.md) — the home screen, character cards, export/import, conflicts, backups
- [Character building](features/character-building.md) — ancestry, background, class, subclass, feats; choices; level-up; option pickers
- [Abilities & skills](features/abilities-and-skills.md) — abilities, saves, skills, expertise, the layout choice
- [Vitals & rest](features/vitals-and-rest.md) — HP, temp HP, max-HP lock, Hit Dice, death saves, Rest & Recovery, size
- [Conditions & concentration](features/conditions-and-concentration.md) — statuses, Concentrating, and its mirror on the Spells tab
- [Attacks & damage](features/attacks-and-damage.md) — attacks and weapons, spell→attack sync, damage types and detection
- [Class resources](features/class-resources.md) — resource trackers, the class-resources overlay, Superiority Dice
- [Features & traits](features/features-and-traits.md) — the features list, feat uses and cost, favourites, search
- [Spells](features/spells.md) — list and browser, prepared, slots, casting and upcast, Active Spells and rounds
- [Inventory](features/inventory.md) — items, sections, origin and cost, the finder, weight, item uses, coins
- [Armor & AC](features/armor-and-ac.md) — `itemArmor()`, `armorAC()`, armor kinds, shields
- [Story & notes](features/story-and-notes.md) — the Story tab's bio fields, section notes and the Section Notes card
- [Rules & tables](features/rules-and-tables.md) — the Rules tab, glossary browse, reference tables and `cols`
- [Combat view](features/combat-view.md) — the combat tab: real cards moved in, the tracker, Undo
- [Rules-update tool](features/rules-update-tool.md) — finding drift between a sheet and its packs, and the three rules
- [Settings & updates](features/settings-and-updates.md) — settings sections, rules sources, pack badges, the update pill

## UI

- [Shell](ui/shell.md) — top bar, tab bar, ToC flyout, the modal, the browse picker, `selectTab()`
- [Sections & layout](ui/sections-and-layout.md) — the section registry, per-tab layout, collapse/favourite conventions
- [Theming & icons](ui/theming-and-icons.md) — skins, light/dark, tokens, the emblem pipeline and its licence

## Data

- [Converter](data/converter.md) — `convert.py`, the `basicRules2024`/`srd52` trap, the byte-for-byte gate
- [Supplements](data/supplements.md) — Xanathar's and Tasha's as additive packs, and the three traps
- [Humblewood](data/humblewood.md) — `extract-humblewood.py`, verbatim prose, tables, playtest packets
- [Homebrew](data/homebrew.md) — the hand-authored pack and `requires`

## Process

- [Building & CI](process/building-and-ci.md) — `build.sh`, the zip allowlist, CI, the git hooks
- [Testing](process/testing.md) — the suites, the harness, and why a green check is not proof
- [Screenshot QA](process/screenshot-qa.md) — the Playwright MCP launcher, its flags, and the traps

## Roadmap

- [Known issues](roadmap/known-issues.md) — limitations, deferred work, and what is verified NOT a gap
- [2.0](roadmap/2.0.md) — the refactor: goals, what it must carry, open questions

## Elsewhere (indexed in place, not moved)

- [RELEASING](../RELEASING.md) — cutting and publishing a release, what CI refuses, rollback
- [WORKTREES](../WORKTREES.md) — several issues at once in parallel worktrees
- [ADR-001](../ADR-001-source-split.md) — why the source is split and still ships as one file
- [UNRELEASED](../UNRELEASED.md) — the changelog notebook for the next release
- [Humblewood playtests](../_claude/HUMBLEWOOD-PLAYTESTS.md) — what each playtest packet adds and supersedes
- [Specs](../specs/) and [plans](../plans/) — one design spec per feature, and the plans that execute them
- [rules-schema](../../../docs/rules-schema.md) and [README-converter](../../../docs/README-converter.md) — player-facing, ship in the zip
