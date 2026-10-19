# Status: Fieldbook
Updated: 2026-10-19 · Branch: main

## Current focus
1.9.0, wave 1 of 5: #95/#93/#94 and #104 are merged; #97 (edit-button toggles) and #99 with #53
(Rules tab overhaul) are not started, and wave 0's #88 neither. No worktree is open. Today also
added two commands, `/status` (this file, #108) and `/release` (#109), and an approval gate on
releases.

## Recent changes
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
- **Next item in wave 1** (raised 2026-10-19). Options: #97 (smaller; wave 2's #103 depends on it) /
  #99 with #53. The recommendation was #97; not decided.

## Loose ends
- 4 player-visible changes in `src/docs/UNRELEASED.md`, not released (APP_VERSION 1.8.1).
- #104 follow-up: `src/tests/sheet.js`, the #8 item-editor test block no longer ends with
  `X.resetRules()`, so its SRD items stay loaded for the tests after it (suite still passes).
- #104 follow-up: two doc sentences to tighten — the spec's As built "Old sheets" bullet says
  declined counts come back "under the sheet's rule" (each entry's own rule applies, and nothing
  comes back for bullets); `ammunition.md`'s older Decisions row says End combat acts "when anything
  is recoverable" (it now retires every count).
- Gate test run 39281505979 (a re-run of v1.8.1) passed `verify` and waits at the `release`
  approval. Cancel and reject both failed during GitHub's Actions incident (2026-10-19). Reject it
  in the run page (*Review deployments* → Reject), never approve; it expires on its own in 30 days.
