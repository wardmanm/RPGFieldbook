# Status: Fieldbook
Updated: 2026-11-04 · Branch: main

## Current focus
`/pre-release 1.9.0`, step 4: Mike is working through the test pass (`src/docs/QA-CHECKLIST.md`) and
reporting bugs; each becomes an issue, or a fix when it's a P0. Steps 1–3 are done; steps 4 and 5
(release-note review) remain, then `/release 1.9.0` and the private data release. No branch open.

## Recent changes
- 2026-11-04: Filed the pre-drive's probable bugs with Mike's priorities: #170 (Undo recovery gives ammo
  back again, P1), #171 (high-level start's ASIs past the cap, P1), #172–#179 (P2), all for 1.9.1. #179 was
  filed through the REST API while GitHub's project API was rate-limited; its Priority and Status are
  set after the hourly reset.
- 2026-11-04: Filed #169 (P2, 1.9.1: a 2024 background typed into Or custom name gets no ability
  increase) and noted Stonesinger's run-on Stonewise text on #160 (Mike's yes to both).
- 2026-11-04: Merged and pushed #168 (feature from the test pass): Balance trade fills the coins that even
  a trade (yours biggest first, splitting a bigger coin for change; or the other side's in gp/sp/cp);
  typed coins split too; Complete warns in the app's window when short or giving more. Mike approved
  both rulings (typed coins split; Balance pays a sale's extra back). Pushed with #166 and #167.
- 2026-11-04: Merged #167 (feature from the test pass, Mike's mockup picks), not pushed: an open journal
  page sits on a page, in a style picked per page in the editor (Sheet, the default; Notebook; Book;
  Parchment), in both skins and themes.
  Follow-up merged the same day (Mike: "really tight margins"): Notebook's rules 30px apart, room above,
  below and beside the writing.
- 2026-11-04: Merged #166 (P2 from the test pass), not pushed: End of combat's Open loot opens the trade
  window as Loot, its You get side alone (From, Worth, Take loot; no You give, tabs or switches), logged
  "Looted from …" under Trades; the Equipment card's Trade is unchanged. Mike: looted rules items read
  Found, as built, and loot sources stay as name chips in the ordinary Trade's With box.
- 2026-11-04: Merged #165 (feature from the test pass, Mike's mockup picks): the initiative strip keeps
  the acting combatant in the middle, overflow goes into +N lists in order, and ◂ Prev steps back a turn
  (across a round's top too); during a fight the header is three rows: title and round centred between
  the round arrows, the strip, then a centred foot with Combatants ▾ and End combat. Pushed with #161/#162.
- 2026-11-04: Merged #161 (P0) and #162 (P2): Roll initiative is the ordinary dialog,
  which grows and scrolls, so Start is always in reach (three monster rows clipped it on a phone); the
  "I rolled" box sits beside its words in Roll initiative, Spend a Hit Die and level-up HP. Filed from
  the same report: #163 (paw companions don't join initiative, P1, 1.9.1) and #164 (a phone's monster
  row wraps its Init box, P2, 1.9.1).
- 2026-11-04: Merged #159 (P0 from the test pass): seven Humblewood backgrounds with no ability scores
  (Ambassador, Underscout, Courtier, Seaborn, Stonesinger, Warrenborn, Wonderstruck) can be added; the
  Add background window drew empty +2/+1 boxes and refused. Their missing skills, tools, languages and
  equipment are #160 (P1, 1.9.1). Mike: keep the accidental test issues #156 and #157 (closed, not
  planned), don't delete them.
- 2026-11-02: Test-pass bugs filed for 1.9.1: #153 (granted gold not in the coin boxes), #154 (granted
  language pill; also on changing ancestry), #158 (the familiar paw always dim; icon colour, not faint).
- 2026-11-02: Merged #155, three rounds (Mike's calls): Features & Traits is a full-width row, one card
  per row; Statuses & Conditions sits under Skills; at three columns the columns always end level, in
  CSS alone. Closed by hand.

## Pending decisions
- None open.

## Loose ends
- `src/docs/PRE-RELEASE.md`: the step 4 rows for #158–#168 are uncommitted; the next `/pre-release`
  run commits them.
- 37 player-visible notes in `src/docs/UNRELEASED.md`, not released (APP_VERSION 1.8.1).
- Data releases (Mike's to cut): SRD 5.2 and the private 2024, Xanathar's and Tasha's packs (#118), and
  Homebrew in the private repo (#125); filed as #138.
- #102: the official source is untested against a real release; 1.9.0 is its first real run (#139).
- Mike's device pass (touch, print, Safari and Firefox, his own characters) for #105, #118, #102, #47,
  #91, #52, #101, #103, #97, #99 and #155, in the test pass's Device pass section. Items already filed
  from it: #146 (the long level card at phone width), #151 (the ↑ button over a delete button).
- #165 is driven in Playwright at 320–1280px only; tapping +N, Prev and Next on a real phone is Mike's
  pass (not in the test pass's Device pass section).
- Deferred review minors are filed in the 1.9.1 groups #145–#152.
