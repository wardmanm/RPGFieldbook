# Status: Fieldbook
Updated: 2026-11-07 · Branch: main

## Current focus
1.9.1 wave 1 is merged on main: all seven worktrees (`src/docs/wiki/roadmap/1.9.1.md`), not pushed
yet; its browser QA filed #191–#198 for 1.9.2. Next: wave 2's design calls (Bio chips, Skin &
settings saves, ASI, Initiative). The release process (#199, then #200) runs beside any wave and
merges before the 1.9.1 pre-release. No branch open.

## Recent changes
- 2026-11-07: Filed #199 (P1, `1.9.1`): the pre-release reads a 1.9.x release's milestone as
  v1.9.1, which doesn't exist, so the open-P0 check and filing would miss v1.9.0. Filed #200 (P2,
  `1.9.1`): `/sign-off-notes`, notes filed during a test pass; design approved by Mike
  (`src/docs/specs/2026-11-06-sign-off-notes-design.md`), built after #199. Mike put both in 1.9.1:
  34 issues (ledger L9656).
- 2026-11-06: Merged wave 1's Armour & attack numbers (#130, #129, #132): Flat or calculated AC,
  only the best shield, Include spells on generic to-hit and damage, scaling uses kept on edit.
- 2026-11-06: Merged Vitals & HP (#115, #112, #113): the Vitals pencil, the Hit points window on a
  touchscreen, the HP numbers centred.
- 2026-11-06: Merged Web fonts (#144): the three fonts embedded, Latin only, with their OFL notices;
  no third-party address left.
- 2026-11-06: Merged Boot & storage (#142, #134, #135, #143), Glossary editor (#136), Ammo undo
  (#170) and Grants redraw (#153, #154, #128).
- 2026-11-06/07: Wave 1's browser QA filed #191–#198 (`1.9.2`).
- 2026-11-05: Scoped 1.9.1 (Mike): the roadmap's waves 1–3 and #140; waves 4–5 relabelled `1.9.2`;
  everything stays on the v1.9.0 milestone (ledger L9090). Filed #183 (P2, 1.9.2).
- 2026-11-05: Released private data 1.9.0-2 (Mike): Homebrew names Xanathar's `XGE`; the tag
  carries `releases/data/`.
- 2026-11-05: Merged and pushed #182 (closed): Extensions installs packs from a private GitHub repo
  with a read-only token. Closed #139.
- 2026-11-05: Released v1.9.0 (Mike: `/release 1.9.0`, "publish", approved in Actions).

## Pending decisions
- None open.

## Loose ends
- main is 64 commits ahead of origin (wave 1's merges, these docs): not pushed. Wave 1's issues
  (#128, #129, #130, #132, #134, #135, #136, #142, #143, #144, #153, #154, #170, #112, #113, #115)
  are still open on GitHub; their merges' Closes lines close them on the push.
- `dist/fieldbook.html` has an uncommitted rebuild on main (last committed 2026-11-05). Main's CI
  fails on a stale artifact, so it goes in before the push.
- Wave 1's seven merged worktrees are still in `.claude/worktrees/` (115, 130, 136, 142, 144, 153,
  170).
- Installing RPGFieldbookPrivate through Extensions on Mike's devices (a read-only token each) is his
  to do, with an app that has #182 (main's build now, or the next app release).
- 17 player-visible notes in `UNRELEASED.md`, not released.
- Deferred review minors are filed in the groups #145–#152, labelled 1.9.2.
