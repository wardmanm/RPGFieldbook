# Status: Fieldbook
Updated: 2026-11-05 · Branch: main

## Current focus
v1.9.0 and the private data release 1.9.0-1 are out. Next: checking the official extension source
against the real release (#139), then 1.9.1. No branch open.

## Recent changes
- 2026-11-05: Released private data 1.9.0-1 (Mike: `/release private`, "publish"): XPHB, XGE, TCE
  1.8.1-1 → 1.9.0-1, Homebrew 1.8.0 → 1.9.0-1, Humblewood unchanged; one private zip, nothing public.
  Its preflight's leak scan failed on v1.9.0's `releases/data/srd52_full.json`: the SRD run already
  allowed in `data/srd52/tables.json`, now allowed there too (Mike's yes; #138, ledger L8921).
- 2026-11-05: Released v1.9.0 (Mike: `/release 1.9.0`, "publish", approved in Actions). 36 player
  notes; the SRD 5.2 pack moves to 1.9.0 (#118's feats); the first release carrying `releases/data/`,
  served at the tag. Assets: fieldbook.html, fieldbook-v1.9.0.zip, the standalone data zip and the
  data kit; marked latest; nothing private.
- 2026-11-05: Pre-release 1.9.0 step 5: Mike approved the release notes, with 3 rewritten
  (checklists, Trade, End combat) and the combat header note folded into the initiative tracker's.
- 2026-11-04: Pre-release step 4: Mike's test pass finished (95 lines ticked, no FAIL); 26 bugs and
  features from it: 9 fixed in 1.9.0, 17 open for 1.9.1, no P0 open.
- 2026-11-04: Merged and pushed #181 (P0 from the test pass): Undo on a second class's level-up card
  restores the sheet from before Add class; it had restored the previous level-up's copy.
- 2026-11-04: Merged and pushed #180 (Mike): one command for a release. `/release X.Y.Z` runs the open
  pre-release steps first, stops when one waits on Mike, and goes on to the cut; `/pre-release` is gone.
- 2026-11-04: Filed the pre-drive's probable bugs with Mike's priorities: #170 (P1), #171 (P1),
  #172–#179 (P2), all for 1.9.1; #179's Priority and Status set after GitHub's rate limit reset.
  Filed #169 (P2) and noted Stonesinger's run-on text on #160.
- 2026-11-04: Merged and pushed #168: Balance trade fills the coins that even a trade, splitting a
  bigger coin for change; Complete warns when short or giving more.
- 2026-11-04: Merged and pushed #167: an open journal page sits on a page in a style picked per page
  (Sheet, the default; Notebook; Book; Parchment); a follow-up gave Notebook room (Mike).
- 2026-11-04: Merged and pushed #166: End of combat's Open loot opens the trade window as Loot, its
  You get side alone; looted rules items read Found (Mike).

## Pending decisions
- None open.

## Loose ends
- #138 (cut the data releases for #118 and #125) is still open on GitHub; both halves have shipped
  (SRD 5.2 in v1.9.0, the private packs in 1.9.0-1).
- #139: verify the official extension source against v1.9.0. `releases/data/fieldbook-data.json`
  answers at the tag's raw URL; installing from it in the app is not yet checked.
- The v1.9.0 milestone is still open on GitHub with 55 open issues, all labelled 1.9.1.
- Deferred review minors are filed in the 1.9.1 groups #145–#152.
