# Status: Fieldbook
Updated: 2026-10-25 · Branch: main

## Current focus
1.9.0 wave 3: #52, #91 and #47 merged 2026-10-25. Remaining 1.9.0 order (Mike, 2026-10-25):
#102 packs from a public manifest → #118 feat support → #105 end-of-combat dialog. The thirteen
`1.9.1`-labelled issues filed 2026-10-25 wait for 1.9.1; #110 is on the backlog with no milestone. No branch open.

## Recent changes
- 2026-10-25: Merged #47's follow-ups, as Mike decided them: inventory-log edit lines keep only what changed
  (500 magic-item edits: 2.35M characters → 117k); coins you receive never make a trade red; grant lines that
  moved gold also file under Coins; `--on-accent`, a readable text colour on every accent fill (lowest 4.8:1).
- 2026-10-25: Merged #47, the trade window and inventory log:
  - Trade, opened from the Equipment card: give and get side by side (tabs on a phone), items and coins,
    the balance with optional item values, and Complete Trade as one step.
  - Every item and coin change writes one line to a Log dialog with filters, receipts and Undo. Undo is
    refused, with the reason, when it can't put things back.
  - Log size (100–2,500, default 500) set in Settings.
  - Claude's rulings: Use and trade copies make every Use undoable; removing a class logs "Removed with …"
    with no Undo; Recover counts in the fight's ammo line; lowering the size asks first.
- 2026-10-25: Mike set 1.9.0's remaining scope: #118 in, #110 to the backlog (no milestone), #111–#117 and
  #119–#124 (labelled 1.9.1) deferred. QA screenshots now filed by issue in `.claude/qa/in-progress/` and `complete/`.
- 2026-10-25: Merged #91, an initiative tracker in the combat view: rolled initiative, a strip of chips with health
  bars, Turns or Rounds, a dialog per combatant, a Party card on Bio. Claude's ruling: ties break in the dialog.
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
- 2026-10-24: Merged #103, the Sheet makeover: Foundry-style header, dark rail, chips, Story renamed Bio, Attacks
  moved to Inventory, the ☰ menu retired (Mike), a back-to-top button.
- 2026-10-22: Merged #99 and #53: the Rules tab is a browser over every loaded category.

## Pending decisions
- **End combat clears every outstanding ammunition count** (raised 2026-10-19, at #104's final
  review). Shots that give nothing back are spent at End combat, though Mike was earlier told they
  would stay on record. Options: keep / revert. Blocks: nothing; it is on main.
- **Firearm bullets on sheets saved before #104 now recover nothing**; they used to recover half
  (raised 2026-10-19). Options: keep / let old sheets keep half.
- **Undo recovery does not restore a stack deleted while its Undo was showing** (raised
  2026-10-19). Options: keep / restore it.

## Loose ends
- 22 player-visible notes in `src/docs/UNRELEASED.md`, not released (APP_VERSION 1.8.1).
- Mike's device pass for #47, #91, #52, #101, #103, #97 and #99: touch, print, Safari and Firefox, and his own
  characters. Claude drove each at desktop and phone widths (`.claude/qa/`). Specific things to check:
  - #101: a long level card at phone width puts the HP step and Done below the fold;
  - #101: the card's class line and banner now use the body font;
  - #103: the phone AC shield overlaps the portrait;
  - #103: the ↑ button can sit over a row's delete button mid-scroll.
  - #91: the strip's sideways scroll on a real phone; a fight with Mike's own characters.
  - #47: a trade on a real phone; the Log dialog's scroll on Safari; Mike's own inventory's log.
- #52 leftover: hiding a tab while the combat view is open, then pressing the swords, lands on the
  Sheet at that tab's scroll position.
- #99 follow-ups:
  - focus drops to the page after a sort, filter or Show more in the Rules tables;
  - a rules fetch that lands while typing in a search box takes focus.
- #104 follow-ups:
  - `src/tests/sheet.js`'s #8 item-editor block no longer ends with `X.resetRules()`;
  - two doc sentences to tighten: the spec's As built "Old sheets" bullet, and `ammunition.md`'s End
    combat row.
