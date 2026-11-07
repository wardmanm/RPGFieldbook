# Status: Fieldbook
Updated: 2026-11-07 · Branch: main

## Current focus
1.9.1 wave 1 is done (`src/docs/wiki/roadmap/1.9.1.md`), and so is the release process: #199 and
#200 (`/sign-off-notes`) are merged, so the 1.9.1 pre-release can run as designed. Next: wave 2's
design calls (Bio chips, Skin & settings saves, ASI, Initiative), then wave 2. No branch open.

## Recent changes
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
- 2026-11-07: Filed #199 (P1, `1.9.1`): the pre-release reads a 1.9.x release's milestone as
  v1.9.1, which doesn't exist. Filed #200 (P2, `1.9.1`): `/sign-off-notes`, design approved by Mike
  (`src/docs/specs/2026-11-06-sign-off-notes-design.md`), built after #199. Mike put both in
  1.9.1: 34 issues (ledger L9656).
- 2026-11-06: Merged Armour & attack numbers (#130, #129, #132): Calculated or Flat AC, only the
  best shield, Include spells on generic to-hit and damage, scaling uses kept on edit. Mike approved
  smoke-list wording for it (lines 23 and 49, and one new line each in Sheet and Spells).
- 2026-11-06: Merged Vitals & HP (#115, #112, #113): the Vitals pencil, the Hit points window on a
  touchscreen, the HP numbers centred.
- 2026-11-06: Merged Web fonts (#144): the three fonts embedded, Latin only, with their OFL notices.
- 2026-11-06: Merged Boot & storage (#142, #134, #135, #143), Glossary editor (#136), Ammo undo
  (#170) and Grants redraw (#153, #154, #128).
- 2026-11-06/07: Wave 1's QA filed 15 follow-ups, #184–#198: all bugs labelled `1.9.2` on v1.9.0,
  except #189 (death saves at 0 HP), a feature with no milestone.
- 2026-11-05: Scoped 1.9.1 (Mike): the roadmap's waves 1–3 and #140; waves 4–5 relabelled `1.9.2`;
  everything stays on the v1.9.0 milestone (ledger L9090). Filed #183 (P2, 1.9.2).

## Pending decisions
- None open.

## Loose ends
- Installing RPGFieldbookPrivate through Extensions on Mike's devices (a read-only token each) is his
  to do, with an app that has #182 (main's build now, or the next app release).
- 17 player-visible notes in `UNRELEASED.md`, not released.
- Deferred review minors are filed in the groups #145–#152, labelled 1.9.2.
- #140 (old release assets): nothing is deleted until Mike confirms the exact asset list.
- `/issue` §6 adds a Step 4 row to the pre-release record without checking whether step 4 is
  already done (found in #200's second dry run; open in its spec's As built and ledger L9723).
- #200's wording fixes after its second dry run were not dry-run a third time.
