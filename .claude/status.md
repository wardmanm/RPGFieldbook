# Status: Fieldbook
Updated: 2026-10-30 · Branch: main

## Current focus
1.9.0's items are all merged (#127, the pre-release process, on 2026-10-30). Next: Mike's `/pre-release 1.9.0`
— its first run is also the one-time backfill of specs and plans into version folders — then `/release`.
The thirteen `1.9.1`-labelled issues wait for 1.9.1; #110 and #126 have no milestone. No branch open.

## Recent changes
- 2026-10-30: `/pre-release 1.9.0` step 2: 25 issues filed to the milestone (#128–#152: 17 P1 and 8
  grouped P2), the old releases' copyrighted-asset cleanse among them as #140, and two items noted on
  #100. Mike's decisions: End combat keeps clearing every ammunition count; pre-#104 firearm bullets
  stay at never (old sheets don't keep half); Undo recovery and a deleted stack closed (unreachable
  since #105); loot trades stay in the With suggestions; the Warlock's Pact Magic columns stay; a
  permission ask rule for `/pre-release`'s GitHub writes is wanted (being added); the device pass is
  the QA checklist's; the End of combat window pins to the top (#145); a fixed feat's +1 goes through
  the +1 step (#146).
- 2026-10-30: Merged #127, the pre-release process: `/pre-release <ver>` (docs filed by version with every
  link rewritten, outstanding issues filed to the milestone with a fix label and project Priority, a QA
  checklist Claude pre-drives, QA bugs where only a P0 blocks, release notes checked), recorded in
  `src/docs/PRE-RELEASE.md`; `./build.sh --release` and `/release` refuse without a complete record.
  Mike's decisions: the recorded-checklist gate, links rewritten everywhere, a one-time backfill, archive
  not delete, filing by milestone + next-fix label + project Priority (P0 blocks), the QA pre-drive, and
  a missing project scope files nothing (§9 amended).
- 2026-10-29: Merged #105, the end-of-combat window: End combat asks in the app's warning window, then
  an End of combat window with folded sections — summary, ammunition with Undo recovery, XP with Split
  among N into the level-up, Loot through a trade with the fallen foes, and trackers/pages marked Show
  after combat. A shot's Undo refuses once End combat has settled it. Mike's decisions: ask first then the
  window; summary from what the app knows; the split switch; folded sections. Claude's rulings: Loot names
  fallen foes only; "Add N XP?" in the app's window; XP the sheet can't read is never overwritten; the
  window sizes to its content.
- 2026-10-28: Merged #125: the Homebrew pack (The Predator) moved to the private repo with its CC BY-SA
  credit; the public data download now holds only SRD 5.2. Installed copies keep working (release note
  only, Mike's decision). Claude's ruling: the private leak scan still counts Homebrew as free text where
  an older public checkout or tag carries it, so the next private data release passes on v1.8.1.
- 2026-10-27: Merged #118, feat support: feats at ASI levels (one list, ASI pinned first, prerequisites
  warn), Feats allowed per character, Epic Boons at 19, species/background feat choices, Undo level-up and a
  Level-down dialog, and the app's own warning window (`askConfirm()`; the other confirm() boxes are #126).

## Pending decisions
- None.

## Loose ends
- 34 player-visible notes in `src/docs/UNRELEASED.md`, not released (APP_VERSION 1.8.1).
- Data releases needed (Mike's to cut): SRD 5.2 and the private 2024, Xanathar's and Tasha's packs
  (#118 feat ability increases and species feats), and Homebrew in the private repo (#125); filed as #138.
- #118 deferred minors, in the spec's As built: a feat's fixed skills aren't granted; a fixed species or
  background feat's +1 isn't applied (dormant in shipped data); "+1 to two" accepts one score twice (#146).
- Mike's device pass for #105, #118, #102, #47, #91, #52, #101, #103, #97 and #99: touch, print, Safari and Firefox, and his own
  characters. Claude drove each at desktop and phone widths (`.claude/qa/`). Specific things to check:
  - #101: a long level card at phone width puts the HP step and Done below the fold (#146);
  - #101: the card's class line and banner now use the body font;
  - #103: the phone AC shield overlaps the portrait;
  - #103: the ↑ button can sit over a row's delete button mid-scroll (#151).
  - #91: the strip's sideways scroll on a real phone; a fight with Mike's own characters.
  - #47: a trade on a real phone; the Log dialog's scroll on Safari; Mike's own inventory's log.
  - #102: drag and drop from the desktop, a zip through Manual install, the phone notice row.
- #102: the official source is untested against a real release — no published release carries
  `releases/data/` yet; the first release cut after this merge is its first real run (#139).
- #102: 13 deferred minors, listed in the spec's As built (e.g. three GitHub API calls per boot;
  manifests stored inside the settings key; the home screen doesn't point at Extensions) (#149, #150, #100).
- #52 leftover: hiding a tab while the combat view is open, then pressing the swords, lands on the
  Sheet at that tab's scroll position (#151).
- #99 follow-ups:
  - focus drops to the page after a sort, filter or Show more in the Rules tables (#151);
  - a rules fetch that lands while typing in a search box takes focus (#151).
- #104 follow-ups:
  - `src/tests/sheet.js`'s #8 item-editor block no longer ends with `X.resetRules()` (#150);
  - two doc sentences to tighten: the spec's As built "Old sheets" bullet, and `ammunition.md`'s End
    combat row (#152).
