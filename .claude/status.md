# Status: Fieldbook
Updated: 2026-10-24 · Branch: main

## Current focus
1.9.0 wave 2 is complete: #103 and #101 merged 2026-10-24, and the #102 spike is done. Next is wave 3
(#91, #47, #52, #102), then wave 4 (#105). #102's spec waits on its install-route decision. No branch
open.

## Recent changes
- 2026-10-24: Merged #101. Levelling up plays a short animation (rune circle, the ring ticking up, a
  LEVEL N banner). A card then shows what the level gave, with the HP roll on it (roll it, type it,
  or take the average). The choice window follows only when there is something to choose. Paladin and
  Ranger spell slots round up (2024 rule). The multiclass note states the 13+ prerequisite. A "don't
  stack" tag appears on Extra Attack and Unarmored Defense (Claude's ruling: narrowed from every
  same-named feature, which wrongly flagged Spellcasting).
- 2026-10-24: Merged #103. The Sheet now has:
  - a Foundry-style header: class menu, level badge, XP or Milestone advancement, rests, inspiration
    and a familiars paw;
  - a dark rail: portrait, AC, death saves, HP, and a hit-dice bar with a spend box (roll it, or
    enter your roll);
  - the ability strip, then Skills/Features beside Defences/Statuses/Resources.

  Resistances, immunities, languages and senses are chips; species and backgrounds grant
  languages. Story is now Bio, and Attacks moved to Inventory. The ☰ section menu is retired
  (Mike), and there is a back-to-top button. #97's phone-width question no longer applies: the
  Class card it was about is gone.
- 2026-10-23: Merged #88: a pack's `requires` and credits are kept in prototype-free maps.
- 2026-10-23: #102 spike: a file:// page cannot download a GitHub release zip (both the download link
  and the API asset end at storage with no CORS header). api.github.com JSON and
  raw.githubusercontent.com files do work, so #102 would fetch pack files one by one.
- 2026-10-22: Merged #99 and #53: the Rules tab is a browser over every loaded category.
- 2026-10-21: Merged #97: a pencil in each list card's header hides that card's edit buttons.
- 2026-10-19: Public app and data releases wait for Mike's approval in GitHub (`release`
  environment); Claude Code asks before release commands (#109). `/status` and `/release` skills (#108).
- 2026-10-19: Merged #104: ammunition recovery rules, Throw, End combat recovery with Undo.
- 2026-10-18: Merged #95, #93, #94: journal checklists, tracker group totals, counter tiles.
- 2026-10-16: Released v1.8.1; first private data release, 1.8.1-1.

## Pending decisions
- **#102's install route** (raised 2026-10-23, from the spike). Options: fetch each pack file from the
  release tag via raw.githubusercontent.com / keep announce-and-link. Blocks: #102's spec (wave 3).
- **End combat clears every outstanding ammunition count** (raised 2026-10-19, #104 final review).
  Shots that give nothing back are spent at End combat. Mike was told earlier they would stay on
  record. Options: keep / revert. Blocks: nothing; it is on main.
- **Firearm bullets on sheets saved before #104 now recover nothing** (they recovered half)
  (raised 2026-10-19). Options: keep / let old sheets keep half.
- **Undo recovery does not restore a stack deleted while its Undo was showing** (raised
  2026-10-19). Options: keep / restore it.

## Loose ends
- 15 player-visible notes in `src/docs/UNRELEASED.md`, not released (APP_VERSION 1.8.1).
- #101 on Mike's devices: Claude drove it at 1280 and 390 in both skins (`.claude/qa/101-*.png`).
  Still to check: touch, print, real reduced motion, Safari and Firefox, Mike's own characters. Also:
  - a long card at phone width puts the HP step and Done below the fold;
  - the card's class line and banner now use the body font (the Cinzel "1" read as an "I").
- #103 on Mike's devices: Claude drove it at 1280/900/390 in both skins (`.claude/qa/103-*.png`).
  Still to check: touch, print, Safari/Firefox, and Mike's own characters. Also for that pass:
  - the phone AC shield overlaps the portrait rather than sitting beside it;
  - the ↑ button can sit over a row's delete button mid-scroll on a phone.
- #103 known issues (in `roadmap/known-issues.md`): Settings → Skin rewrites the open character's
  system; languages lifted from an old "Languages:" line become the player's own.
- #97 and #99 on Mike's devices: driven at desktop and phone widths; real devices, touch, print and
  Mike's own characters not checked.
- #99 follow-ups: keyboard focus drops to the page after a sort, filter or Show more in the Rules
  tables; a rules fetch landing while typing in a category's search box takes focus.
- #104 follow-ups:
  - `src/tests/sheet.js`'s #8 item-editor block no longer ends with `X.resetRules()`;
  - two doc sentences to tighten: the spec's As built "Old sheets" bullet, and `ammunition.md`'s
    End combat row.
