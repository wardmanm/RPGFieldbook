# Status: Fieldbook
Updated: 2026-10-22 · Branch: main

## Current focus
1.9.0: wave 1 is complete (#95/#93/#94, #104, #97, #99 with #53 all merged). Wave 0's #88 is not
started. Next is wave 2: #103 (Sheet tab makeover), #101 beside it, and the #102 CORS spike. No
branch open.

## Recent changes
- 2026-10-22: Merged #99 and #53 — the Rules tab is a browser over every loaded category: a sidebar
  with counts and a search across everything, sortable filterable tables, rows open the sheet's own
  windows in a reference mode; the item and feat pickers share its filters and previews.
- 2026-10-21: Merged #97 — a pencil in every list card's header hides that card's edit, delete and
  remove buttons, per card and per character, shown by default.
- 2026-10-19: Public app and data releases now wait for Mike's approval in GitHub before
  publishing (`release` environment); Claude Code asks before release commands (#109).
- 2026-10-19: `/status` and `/release` skills; this status log tracked and written on main only
  (#108, #109).
- 2026-10-19: Merged #104 — ammunition recovery rule (half/all/hits only/none), per-item
  always/never, Throw for thrown weapons, End combat recovering on its own with Undo recovery.
- 2026-10-18: Merged #95, #93, #94 — tickable checklists in journal pages and section notes (old
  checklist/task trackers migrate into pages); tracker group totals; counters as tiles.
- 2026-10-16: Merged #107 (Settings as a sidebar of pages, and its scrollbar gap), #106 (clicking
  outside a dialog closes it only when that setting is on), #98 (a feature's source sets its group).
- 2026-10-16: Released v1.8.1; first private data release, 1.8.1-1.

## Pending decisions
- **End combat clears every outstanding ammunition count** (raised 2026-10-19, #104 final review).
  Shots that give nothing back (None, Never, firearm bullets) are spent at End combat; earlier Mike
  was told they would stay on record for a later rule change. Options: keep / revert to keeping
  them. Blocks: nothing; it is on main.
- **Firearm bullets on sheets saved before #104 now recover nothing** (they recovered half), from
  the app-side default (raised 2026-10-19). Options: keep / let old sheets keep half.
- **Undo recovery does not restore the count of a stack deleted while its Undo was showing**
  (raised 2026-10-19). Options: keep / restore it.
- **#97 at phone width** (raised 2026-10-19, #97 final review): the Class card's header wraps one
  line taller ("▲ Level up"), and the header icons are ~24×22px tap targets, like the note and
  combat buttons. Options: leave / tighten the header CSS. For Mike's device pass.

## Loose ends
- 6 player-visible changes in `src/docs/UNRELEASED.md`, not released (APP_VERSION 1.8.1).
- #97 and #99 on Mike's devices: Claude drove them at desktop and phone widths
  (`.claude/qa/97-*.png`, `.claude/qa/99-*.png`); real devices, touch, print and Mike's own
  characters not checked.
- #99 follow-ups parked at its final review: keyboard focus drops to the page after a sort, filter
  or Show more tap in the Rules tables; a rules fetch landing while typing in a category's search
  box takes focus (the text is kept).
- #104 follow-up: `src/tests/sheet.js`, the #8 item-editor test block no longer ends with
  `X.resetRules()`, so its SRD items stay loaded for the tests after it (suite still passes).
- #104 follow-up: two doc sentences to tighten — the spec's As built "Old sheets" bullet says
  declined counts come back "under the sheet's rule" (each entry's own rule applies, and nothing
  comes back for bullets); `ammunition.md`'s older Decisions row says End combat acts "when anything
  is recoverable" (it now retires every count).
