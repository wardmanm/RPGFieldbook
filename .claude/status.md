# Status: Fieldbook
Updated: 2026-11-05 · Branch: main

## Current focus
1.9.1 is scoped (Mike, 2026-11-05): waves 1–3 of `src/docs/wiki/roadmap/1.9.1.md` plus #140, 32 issues
labelled `1.9.1`; cut after wave 3. Waves 4–5 (22 issues) moved to `1.9.2`, not scoped yet. Next: wave
1's six design calls with Mike, then its seven worktrees. No branch open.

## Recent changes
- 2026-11-05: Scoped 1.9.1 (Mike): the roadmap's waves 1–3 and #140; waves 4–5 relabelled `1.9.2`
  (22 issues, new label); everything stays on the v1.9.0 milestone (ledger L9090). Filed #183 (P2,
  1.9.2): #182's four set-aside follow-ups. Added CLAUDE.md's "Context handoffs" rule (Mike).
- 2026-11-05: Released private data 1.9.0-2 (Mike: `/release private`, "publish"): Homebrew
  1.9.0-1 → 1.9.0-2 (the XGE name), the others unchanged; the tag carries `releases/data/` (the pack
  list and five packs), so private sources can install from it. One private zip; nothing public.
- 2026-11-05: Homebrew names Xanathar's by its system, `XGE`, so the Extensions page matches its
  requirement (private c9f53c5, ledger L9061; Mike's yes). Pushed, both repos.
- 2026-11-05: Merged and pushed #182 (closed): Settings → Extensions installs and updates packs from a private
  GitHub repo with a read-only token the owner sends (one source link); the token stays on the device.
  The data kit gains `release` and a version stamp; `/release private` writes `releases/data/` and can
  release with nothing changed (`--allow-unchanged`); an owner's guide ships in `docs/` (four files
  now). Built task by task with reviews, a final review and its fixes; proven with a real fine-grained
  token on a scratch private repo (ledger L8943, L9016). Mike chose this over making
  RPGFieldbookPrivate public.
- 2026-11-05: Closed #139: the official source installs SRD 5.2 1.9.0 from the v1.9.0 tag in the
  released `fieldbook.html` (cleared profile, `file://`), and it survives a reload.
- 2026-11-05: Released private data 1.9.0-1 (Mike: `/release private`, "publish"): XPHB, XGE, TCE
  1.8.1-1 → 1.9.0-1, Homebrew 1.8.0 → 1.9.0-1, Humblewood unchanged; the leak scan now allows the SRD
  run in `releases/data/srd52_full.json` (#138 closed, ledger L8921). Mike: every 1.9.x issue stays on
  the v1.9.0 milestone, which closes only when all of it is fixed or delivered.
- 2026-11-05: Released v1.9.0 (Mike: `/release 1.9.0`, "publish", approved in Actions). 36 player
  notes; SRD 5.2 pack 1.9.0; the first release carrying `releases/data/`; marked latest.
- 2026-11-05: Pre-release 1.9.0 step 5: Mike approved the release notes (3 rewritten, 1 folded).
- 2026-11-04: Pre-release step 4: Mike's test pass finished (95 lines ticked, no FAIL); 9 fixed in
  1.9.0, 17 open for 1.9.1, no P0 open.
- 2026-11-04: Merged and pushed #181 (P0): Undo on a second class's level-up card restores the sheet
  from before Add class.

## Pending decisions
- None open.

## Loose ends
- Installing RPGFieldbookPrivate through Extensions on Mike's devices (a read-only token each) is his
  to do, with an app that has #182 (main's build now, or the next app release).
- 1 player-visible note in `UNRELEASED.md` (#182), not released.
- Deferred review minors are filed in the groups #145–#152, now labelled 1.9.2.
