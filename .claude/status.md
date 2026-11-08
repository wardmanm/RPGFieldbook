# Status: Fieldbook
Updated: 2026-11-08 · Branch: main

## Current focus
1.9.1 wave 2 is merged and pushed (`src/docs/wiki/roadmap/1.9.1.md`). No branch open. Next: wave 3
(Backgrounds & Humblewood #169 → #177 → #160, Class training #137, old release assets #140), then
the 1.9.1 pre-release.

## Recent changes
- 2026-11-08: Pushed main (e07a136..bec7b60): wave 2's four merges, the artifact, the roadmap and
  four smoke lines. Its 11 issues closed; #146's S2-24, S2-26 and S2-41 ticked, and W2-1–W2-4 added
  (1.9.2). Wave-2 worktrees removed.
- 2026-11-08: Merged wave 2 into main, one branch each: Bio chips (#121, #120, #119, #123, #131),
  Skin & settings saves (#133, #141), ASI (#172, #171, with #146 S2-24 and S2-26), Initiative (#164,
  #163). Each had a fresh review (all findings fixed) and a browser pass; 9659 checks green after the
  last merge. Mike approved four new smoke-list lines (ledger L10190).
- 2026-11-07: Wave 2's design calls settled by Mike, and its four specs and plans approved
  (`src/docs/specs/2026-11-07-*-design.md` on each branch). Tools become Bio chips with a pick step
  for a tool choice; a removed or swapped source reverts only what it seeded, the player's values
  stay; a Base speed box; Skin is look only, a Game system row changes the system with a warning,
  and PP/EP show on a Humblewood sheet while held; each ASI starts blank, capped at 20 in level
  order (#146 S2-24 rides along); summoned familiars join initiative, "Own initiative" or "Right
  after you", one shared HP, struck and skipped at 0.
- 2026-11-07: Merged #200: `/sign-off-notes`, typed on main in a second window during a release's
  test pass. A note that fails a line gets that line's `FAIL:`; anything else is filed after Mike's
  yes and recorded as a `while on` row in the pre-release record's Step 4 table, which step 4 lists
  first and never files again. The filing blocks of `/issue`, the pre-release and `/sign-off-notes`
  now read the title as typed, so quotes, `$` and backticks are safe. Two dry runs (ledger L9723).
- 2026-11-07: Merged #199: a release's milestone is its minor line's, `vX.Y.0`, in the pre-release,
  `/release` and `/issue`. Step 3's test pass takes the issues closed in it since the previous tag;
  `/issue` files into the line of the release in hand, with the line's highest open fix label
  (Mike's calls; `/status` keeps its own lookup). Ledger L9692.
- 2026-11-07: Pushed main (9caff27..c744b5b): wave 1's seven merges, the rebuilt artifact, the
  /sign-off-notes design and the roadmap's wave-1 update (ledger L9669).
- 2026-11-06: Merged Armour & attack numbers (#130, #129, #132): Calculated or Flat AC, only the
  best shield, Include spells on generic to-hit and damage, scaling uses kept on edit. Mike approved
  smoke-list wording for it (lines 23 and 49, and one new line each in Sheet and Spells).
- 2026-11-06: Merged Vitals & HP (#115, #112, #113): the Vitals pencil, the Hit points window on a
  touchscreen, the HP numbers centred.
- 2026-11-06: Merged Boot & storage (#142, #134, #135, #143), Glossary editor (#136), Ammo undo
  (#170) and Grants redraw (#153, #154, #128).
- 2026-11-06/07: Wave 1's QA filed 15 follow-ups, #184–#198: all bugs labelled `1.9.2` on v1.9.0,
  except #189 (death saves at 0 HP), a feature with no milestone.

## Pending decisions
- None open.

## Loose ends
- Five older issues from wave 2's QA for Mike to `/issue` (ledger L10190): Combatants table stays
  open into another character's fight; live region keeps the old turn on a removed actor; home
  "Classic D&D" clips at 390 px; Coins "Auto-convert" wraps at 390 px; the private 2024 pack's
  Blessed Warrior and Druidic Warrior have no category line.
- Installing RPGFieldbookPrivate through Extensions on Mike's devices (a read-only token each) is his
  to do, with an app that has #182 (main's build now, or the next app release).
- 32 player-visible notes in `UNRELEASED.md`, not released.
- Deferred review minors are filed in the groups #145–#152, labelled 1.9.2.
- #140 (old release assets): nothing is deleted until Mike confirms the exact asset list.
- `/issue` §6 adds a Step 4 row to the pre-release record without checking whether step 4 is
  already done (found in #200's second dry run; open in its spec's As built and ledger L9723).
- #200's wording fixes after its second dry run were not dry-run a third time.
