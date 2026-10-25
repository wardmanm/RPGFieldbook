# Status: Fieldbook
Updated: 2026-10-25 · Branch: main

## Current focus
1.9.0 wave 3: #52 and #91 merged 2026-10-25. Left in this wave: #47 (trade window) and #102 (packs
from a public manifest; install route decided). Then wave 4 (#105). No branch open.

## Recent changes
- 2026-10-25: Merged #91, an initiative tracker in the combat view:
  - Start combat rolls initiative: yours with the HP step's controls and Advantage, typed totals for
    everyone else.
  - A strip of chips with health bars, Turns (Next moves a marker) or Rounds.
  - A dialog per combatant: bands, Exact HP or Estimate, Dead, Act earlier/later for ties.
  - A Party card on Bio, whose members join every fight.
  - Claude's ruling: ties break in the dialog, not by drag.
- 2026-10-25: Merged #52. Settings → Sheet display → Tabs hides Spells, Inventory, Bio, Journal or
  Rules per character. Sheet and the combat swords always show. A section note into a hidden tab
  brings it back with a toast.
- 2026-10-24: Mike decided #102's install route. The app fetches each pack file a public manifest
  names: by default from the release tag on raw.githubusercontent.com, or from any public host that
  allows cross-origin reads. Each download is checked against its digest. Private packs stay a manual
  download.
- 2026-10-24: Merged #101. Levelling up plays a rune-circle animation, then shows a card with what the
  level gave and the HP roll on it (roll, type, or average). Paladin and Ranger slots round up (2024).
  The multiclass note states the 13+ rule. A "don't stack" tag shows on Extra Attack and Unarmored
  Defense (Claude's ruling: narrowed from every same-named feature).
- 2026-10-24: Merged #103, the Sheet makeover:
  - a Foundry-style header and a dark rail;
  - chips for defences, languages and senses;
  - a hit-dice spend box;
  - Story renamed Bio, and Attacks moved to Inventory;
  - the ☰ menu retired (Mike), and a back-to-top button.
- 2026-10-23: Merged #88: a pack's `requires` and credits are kept in prototype-free maps.
- 2026-10-22: Merged #99 and #53: the Rules tab is a browser over every loaded category.
- 2026-10-21: Merged #97: a pencil in each list card's header hides its edit buttons.
- 2026-10-19: Releases wait for Mike's approval in GitHub (#109); `/status` and `/release` skills (#108).
- 2026-10-19: Merged #104: ammunition recovery rules, Throw, End combat recovery with Undo.

## Pending decisions
- **End combat clears every outstanding ammunition count** (raised 2026-10-19, at #104's final
  review). Shots that give nothing back are spent at End combat, though Mike was earlier told they
  would stay on record. Options: keep / revert. Blocks: nothing; it is on main.
- **Firearm bullets on sheets saved before #104 now recover nothing**; they used to recover half
  (raised 2026-10-19). Options: keep / let old sheets keep half.
- **Undo recovery does not restore a stack deleted while its Undo was showing** (raised
  2026-10-19). Options: keep / restore it.

## Loose ends
- 18 player-visible notes in `src/docs/UNRELEASED.md`, not released (APP_VERSION 1.8.1).
- Mike's device pass for #91, #52, #101, #103, #97 and #99: touch, print, Safari and Firefox, and his own
  characters. Claude drove each at desktop and phone widths (`.claude/qa/`). Specific things to check:
  - #101: a long level card at phone width puts the HP step and Done below the fold;
  - #101: the card's class line and banner now use the body font;
  - #103: the phone AC shield overlaps the portrait;
  - #103: the ↑ button can sit over a row's delete button mid-scroll.
  - #91: the strip's sideways scroll on a real phone; a fight with Mike's own characters.
- #52 leftover: hiding a tab while the combat view is open, then pressing the swords, lands on the
  Sheet at that tab's scroll position.
- #99 follow-ups:
  - focus drops to the page after a sort, filter or Show more in the Rules tables;
  - a rules fetch that lands while typing in a search box takes focus.
- #104 follow-ups:
  - `src/tests/sheet.js`'s #8 item-editor block no longer ends with `X.resetRules()`;
  - two doc sentences to tighten: the spec's As built "Old sheets" bullet, and `ammunition.md`'s End
    combat row.
