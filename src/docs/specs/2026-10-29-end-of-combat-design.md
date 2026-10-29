# End of combat: design

**Status:** approved in conversation 2026-10-29. It is wave 4 of [1.9.0](../wiki/roadmap/1.9.0.md), the
capstone.
**Issue:** #105 (Combat End Dialog). One branch, `issue/105-end-of-combat`.
**Mockup:** `.superpowers/brainstorm/55197-1793279092/content/end-combat-layout.html`. Layout B was chosen
(folded sections), with the window opening after the fight has ended rather than before (§2, decision 1).

**Read first:**
- [Combat view](../wiki/features/combat-view.md): `combatStart()`, `combatEnd()` and what it hands back,
  `endCombatAsk()`, the initiative tracker.
- [Ammunition](../wiki/features/ammunition.md): the recovery rule, `applyAmmoRecovery()`, its Undo, the
  per-fight log lines.
- [Inventory](../wiki/features/inventory.md): the trade window (`openTrade(opts)` and its `{with, give, get}`
  seam, built for this) and the inventory log.
- [Journal](../wiki/features/journal.md): pages, tickable checkboxes, tracker tiles.
- [Shell](../wiki/ui/shell.md): the modal, `askConfirm()`, the dismiss guard.

---

## 1. What it is

When a player ends a fight, Fieldbook asks first, then ends it and opens one window that wraps the fight
up: what happened, the ammunition that came back, experience, loot, and anything the player marked to
see after every fight. Every section can be skipped; Done closes the window.

Today End combat asks with the browser's `confirm("End combat at round N?")`, ends the fight, writes one
inventory-log line per kind of ammunition, and recovers ammunition with a toast and an Undo. Nothing
else happens at the end of a fight.

## 2. Decisions

Mike's, in conversation, 2026-10-29. The 1.9.0 roadmap's two #105 rows (one screen with sections; a
"Show after combat" switch) stand, refined as below.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | When the window opens | **After the fight has ended.** End combat asks "are you sure?" in the app's warning window; confirming ends the fight and opens the window | Opening the window with the fight still running, End combat as its last button (first chosen, then changed by Mike): the question and the wrap-up are different moments |
| 2 | What the summary shows | **What the app already knows**: rounds, time (6 seconds a round), the combatants with the fallen struck through, and the ammunition line | HP, slots and resources spent this fight: a snapshot at Start for a recap nothing acts on; rests restore them |
| 3 | The XP box | **One box, with a "Split among N" switch** (N = the Party roster plus this character, rounded down), off by default and remembered per character. If the XP reaches a level, the level-up opens after Done | A plain box: the split is the common table rule and the roster already knows N |
| 4 | Layout | **Folded sections**: the summary open, each other section a one-line row that opens on a tap and remembers being open, per character | Everything open in one scroll: long after every fight |

## 3. The flow

1. **End combat** (`#cvEnd`, the combat view's head; the only entry point) calls `endCombatAsk()`, which
   now asks through `askConfirm()`:
   - title "End combat?";
   - message "End the fight at round 5? Ammunition comes back under your recovery rule." The second
     sentence appears only when something was fired since Start and the rule is not None;
   - buttons "Keep fighting" (safe) and "End combat".
   Keep fighting changes nothing. This is the one `confirm()` #105 converts; the rest are #126's.
2. **On End combat**, in this order, as today: the per-kind inventory-log lines are written, `ammoFight`
   is cleared, `combatEnd()` ends the fight and hands back `{rounds, sec, combatants}`, the chrome is
   redrawn, the save is scheduled, and ammunition recovery is applied, **quietly**: no toast, its result
   and Undo handed to the window (§5).
3. **The End of combat window** opens (§4).
4. **Done** adds the XP (§4.3), closes the window, and opens the level-up if the XP reached a level.
   Closing with × or Escape while XP is typed asks, in the app's warning window, "Add 112 XP?" ("Add XP"
   does exactly what Done does, the level-up included; "Don't add" or Escape closes without it). With no XP
   typed, × and Escape simply close.

## 4. The window

`openModal()`, titled **"End of combat"**, with the time under the title: "Round 5 · 30 seconds"
(`fmtCombatTime()`). Wide on desktop. A section with nothing to show is left out entirely, so a quiet
fight is a short window.

The **summary** is always open. Every other section is a folded row: a label and a one-line status,
opening on a tap. Which rows are open is remembered per character (`endCombatOpen`, §6); the first time,
every row is folded.

### 4.1 Summary

A chip per combatant from `combatEnd()`'s `combatants`, in initiative order, the fallen
(`combatantDead()`) struck through with "fell" in their accessible name. This character is not listed. With
no combatants (the initiative tracker unused), the summary is just the time.

### 4.2 Ammunition

Shown when anything was fired since Start. Row status and body, per kind: "Arrows: 9 fired, 4 came
back" (the log line's own wording, `ammoLogTitle()`). With the rule None: "Arrows: 9 fired, none come
back (recovery: None)". The body has **Undo recovery**, which does what the toast's Undo does today
(`undoRecoveryTap()`: puts the recovered ammunition back as spent and corrects the log lines' `back`),
and then reads "Recovery undone". It is offered only while the window is open.

### 4.3 Experience

Shown when the character levels by XP (`advancementOf(c)==="xp"`); hidden for milestone. Row status:
"XP 6,350 / 6,500" (`xpProgress()`), or "+112 XP" once something is typed.
- A whole-number box, 0 to 1,000,000.
- **Split among N**, a switch, shown only when the Party roster has at least one member. On: the line
  reads "450 ÷ 4 = 112 each" and 112 is what Done adds. Its state is `xpSplit`, saved on change.
- When the total after adding would reach a level the character hasn't reached yet, the section says
  "Level 6 ready — the level-up opens when you press Done."

Done writes `character.xp = xpNumber(character.xp) + n`. If `xpProgress()` was not `ready` before and is
after, the level-up opens next, through the same path as the level ring's button (`doLevelUp()`).

### 4.4 Loot

Always shown. Row status: "Open trade…". The body says "Coins and items from the fight go through a trade,
so they're in your inventory log", and an **Open trade** button calls
`openTrade({with: <name>, onClose: <reopen>})`:
- `<name>` is the fallen foes' names joined with commas ("Goblin 1, Bugbear"), or "Combat loot" when none
  fell or there were no combatants. A fallen party member is struck through in the summary but never named
  here: the loot came from the foes. The trade window lets the player edit it, as today.
- The trade window replaces this one (the modal has one layer). When it closes, by Complete Trade or by
  cancelling, `onClose` reopens the End of combat window with its state intact: typed XP, the split, open
  rows, Undo still offered or done. After a completed trade the Loot row reads "Traded with Goblin 1,
  Bugbear"; another trade is allowed.

The window's state lives in memory (`_endFight`), not on the character, tied to the character's id. It
is dropped on Done, on ×/Escape, and if the character changes.

### 4.5 After combat

Shown when at least one open tracker or one journal page has `afterCombat` on, and the Journal tab is not
hidden (`isTabHidden("journal")`, #52). Row status: "2 trackers · 1 page".
- **Trackers**: the open ones (not closed), as their tiles (`trackerRowHTML()`), live: + and − change the
  counter there, exactly as on the Journal tab, and the tab's copy follows. Hidden when the sheet's
  trackers are switched off (`showTrackers === false`).
- **Pages**: each flagged page's title and its rendered text (`noteHTML()`), with its checkboxes tickable
  there; a tick rewrites that page's line as on the Journal tab. Long pages scroll inside the section.
Nothing changes on its own: a tracker is never bumped and a box never ticked by ending a fight.

## 5. Ammunition recovery, quietly

`applyAmmoRecovery(opts)` gains `opts.quiet`. Quiet, it applies the rule exactly as now and returns
`{lines, undo}` (what came back per kind, and a function that undoes it) instead of showing the toast.
Without `quiet` it behaves as today. The undo is the toast's own logic (`undoRecoveryTap()`), moved behind
the returned function so both callers share it; nothing about what is recovered or logged changes. The
pending #104 decisions (End combat settling every outstanding count; old firearm sheets; a stack deleted
under Undo) are untouched by this and stay open.

## 6. Data

New character fields, each optional, defaulted in `blankChar()`, cleaned by `migrate()` (never a
whitelist), and round-trip tested:

| Field | Shape | Default | migrate() |
|---|---|---|---|
| `xpSplit` | boolean | `false` | anything not `true` → `false` |
| `endCombatOpen` | `{ammo?, xp?, loot?, after?: true}` | `{}` | not a plain object → `{}`; non-`true` values dropped |
| `trackers[i].afterCombat` | boolean, absent when off | absent | kept only when `true` |
| `journal[i].afterCombat` | boolean, absent when off | absent | kept only when `true` |

**The switch.** "Show after combat" is a switch in the tracker's edit window and in the page's edit
window, beside the existing fields. Off by default.

**Party size** for the split: `character.party` (the #91 roster) length plus one.

## 7. Code

- **New fragment `src/js/87-combat-end.js`**, after `87-journal.js` and `87-trackers.js` in
  `src/manifest.json` (it calls their renderers), before `88-settings.js`: `openEndOfCombat(result)`,
  the window's HTML per section, `_endFight`, the fold toggles, Done, the dismiss guard, the reopen hook.
- **`87-combat.js` `endCombatAsk()`**: async, `askConfirm()`; after ending, `applyAmmoRecovery({quiet:true})`
  and `openEndOfCombat({...combatEnd's result, ammo})`.
- **`62-ammo.js` `applyAmmoRecovery()`**: the `quiet` option and the returned `{lines, undo}` (§5).
- **`67-trade.js` `openTrade()`**: an optional `onClose`, run once when the trade window closes, however
  it closes.
- **`87-trackers.js`**: `trkPatchRow()` and the tracker re-render patch **every** copy of a tile in the
  page (the Journal tab's and the window's), not the first one found. The edit window gains the switch.
- **`87-journal.js`**: the page editor gains the switch.
- **`90-boot.js`**: the checkbox click dispatcher (`data-ck`) gains a branch for a page shown in the End of
  combat window (it falls through to section notes today); the fold rows and Done are wired in the new
  fragment.
- **`00-constants.js` `blankChar()`, `71-char-io.js` `migrate()`**: §6.
- **CSS** in `50-modal.css` (window) and `47-journal.css` only if a tile needs it inside a modal; tokens
  only, both skins.

## 8. Edge cases

- **No initiative used**: summary is just the time; Loot's party is "Combat loot".
- **Nothing fired**: no Ammunition row; the warning's second sentence is left out.
- **Recovery rule None**: the Ammunition row says none come back; no Undo.
- **Milestone character**: no Experience row; nothing about XP anywhere in the window.
- **No Party roster**: no split switch; the box adds what is typed.
- **XP field holding text** (`character.xp` is free text): `xpNumber()` reads it; Done writes a number.
- **A trade cancelled**: the window comes back, Loot unchanged, nothing logged.
- **The character changes** (home, another sheet) while the window or its trade is open: `_endFight` is
  dropped and nothing reopens.
- **A reload** with the window open: the fight already ended and saved; typed XP is lost, as any unsaved
  form is.
- **A hidden Journal tab**: no After combat row. A closed tracker or an unflagged page never shows.
- **Undo level-up** settling on `closeModal()`: the window's closing goes through `closeModal()` like
  every modal, which is harmless (§5a of the feat spec).
- **End combat pressed twice**: the warning's own guard (one at a time) and the button's re-entry guard
  mean one end.

## 9. Testing

`src/tests/sheet.js` (harness `loadApp`), new checks for:
- the warning: its text with and without ammunition; Keep fighting changes nothing (still in combat,
  `ammoSpent` untouched, no log lines); End combat ends it.
- `applyAmmoRecovery({quiet:true})`: same recovery and log as today, no toast, `{lines, undo}` returned;
  `undo` restores exactly what the toast's Undo restores.
- the window: sections present/absent per §8; the summary chips and struck-through fallen; the time line.
- XP: plain add; split on/off and its rounding; party size; milestone hides it; Done writes the number;
  the level-up opens only when `ready` flips; the dismiss guard's "Add N XP?" both ways.
- Loot: `openTrade` gets the right `with`; `onClose` reopens with state intact after Complete and after
  cancel; a character change drops it.
- After combat: flagged open trackers and pages only; hidden Journal tab hides it; + in the window
  changes the counter and both copies of the tile; a tick in the window rewrites the page's line.
- Data: `blankChar()` defaults, `migrate()` cleaning of each field, save → load round trip.

Throwaway Node checks for the split arithmetic and the `with` name. Screenshots via the project Playwright
MCP (`mcp__playwright__*`), both skins, 1280 and 390: the warning, the window folded, each section open,
the window back after a trade; before and after for the combat view's End flow. Drive one whole fight
end (fire, End combat, Undo recovery, split XP, open trade and come back, tick a page, + a tracker, Done
into a level-up) and say what was driven and what wasn't.

## 10. Docs

- Ledger entry; wiki: combat-view.md (End combat and the window), ammunition.md (quiet recovery, Undo in
  the window), journal.md (Show after combat), inventory.md (`onClose`), shell.md if `askConfirm()` gains
  a user, character-model.md (the four fields), decisions.md (§2), known-issues.md, the 1.9.0 roadmap
  page (#105 done; its two rows updated to match §2).
- `UNRELEASED.md`: one bullet for the window, one for "Show after combat".

## 11. Out of scope

- Active spells, conditions and concentration at the end of a fight: untouched, as today.
- HP, spell slot and resource recaps (§2, decision 2).
- The app's other `confirm()` boxes (#126).
- The pending #104 ammunition decisions.
- Party members' XP: the split tells this character its share; other sheets are their own.

## As built

Built 2026-10-29 on `issue/105-end-of-combat` in seven tasks and a final fix wave
([the plan](../plans/2026-10-29-end-of-combat.md); ledger "End of combat (#105, 2026-10-29)" and
"End of combat: the final fix wave (#105, 2026-10-29)").
How it works now: [Combat view](../wiki/features/combat-view.md), with
[Ammunition](../wiki/features/ammunition.md), [Journal](../wiki/features/journal.md),
[Inventory](../wiki/features/inventory.md), [Shell](../wiki/ui/shell.md) and
[Character model](../wiki/architecture/character-model.md).

### Where the code lives

- **`src/js/87-combat-end.js`**, a new fragment after `87-trackers.js` (JS fragments 38 → 39): the
  window (`openEndOfCombat()`, `endFightShow()`, `endFightHTML()`), its state (`_endFight`,
  `endFightLive()`), the rows (`EC_ROWS`, `endFightSection()`, `endFightToggle()`), each section's
  helpers (`endFightAmmo*`, `endFightXp*`, `endFightLoot*`, `endFightAfter*`), Done
  (`endFightDone()`, `endFightClose()`), the dismiss guard (`endFightGuard()`), the reopen hook
  (`endFightReopen()`), the tick (`endFightTick()`), the inert chips (`EC_INERT`, `endFightKey()`),
  and the wiring on `#mBody` (`endFightClick()`, `endFightWire()`).
- **`87-combat.js`:** `endCombatAsk()` is async and asks through `askConfirm()`; the ending is
  `endCombatNow()`, which the old synchronous tests call directly.
- **`62-ammo.js`:** `applyAmmoRecovery({quiet, logged})`, `undoRecoveryTap(…, {quiet})`, and
  `_ammoSettled`, which `undoFireTap()` checks.
- **`67-trade.js`:** `openTrade({onClose})` and `tradeClosed(done)`; `tradeFind()`'s way back focuses
  the Equipment card's Trade only for a trade with no `onClose`.
- **`87-journal.js`:** `jnlTogglePage(id, n)`, the one writer for a page's tick, shared by the Journal
  tab and the window; `jnlToggleAfterCombat()` for the editor's switch.
- **`87-trackers.js`:** `trackerRowHTML(t, {noEdit})`, every copy patched (`trkPatchRow()`,
  `renderTrackers()`), the form's `#tkAfter`; `trkFocusScope()`, which keeps `trkNextControl()` and
  `undoTrackerChange()` inside the window while it is open.
- **`90-boot.js`:** the `[data-ck]` dispatcher's `[data-ecpage]` branch, and `[data-jnlac]`.
- **`00-constants.js`, `71-char-io.js`:** the §6 fields, `cleanEndCombatOpen()`.
- **`50-modal.css`:** the `.ec-*` rules, tokens only. `47-journal.css` needed nothing.

### Deviations, and why

- **"Arrows: 9 fired, 4 recovered", not "4 came back"** (§4.2). The spec names the log line's own
  wording, `ammoLogTitle()`, which says "recovered"; the window and the log read the same.
- **"Round 5 · 30 sec", not "30 seconds"** (§4). The spec names `fmtCombatTime()`, which writes "sec".
- **`_endFight` is tied to the character object, not its id** (§4.4). Import → Replace keeps the id and
  swaps the sheet, so an id-keyed state would survive it; the object is the codebase's rule for every
  toast Undo, `jnlUI.who` and `trkWho`.
- **`applyAmmoRecovery()` takes `opts.logged` as well as `opts.quiet`, and `undoRecoveryTap()` takes
  `opts.quiet`** (§5). The window's Undo must still correct End combat's log lines, which are written
  before recovery; and its "Recovery undone" toast would sit over a window that says it itself.
- **The window's tiles have no edit pen, and the rules chips in its pages are inert** (§4.5). The modal
  has one layer: the tracker form, a glossary entry or a table would replace the window and lose the
  typed XP and the Undo. Inert chips keep `role="button"` and a tab stop from `highlight()`, so a
  screen reader announces a button that does nothing there (accepted).
- **The dismiss guard answers through `askConfirm()`** (§3.4, Ruling 2). `dismissModal()`'s guard is
  synchronous and its Cancel keeps the window open, where the spec wants Cancel to close without the
  XP, and #105 adds no new browser `confirm()`. So with XP typed the guard returns `true` (refusing
  the dismissal) and asks; on the answer it closes the window itself. **Add XP behaves exactly as
  Done**, the level-up included. A second × while asking does nothing new; the answer acts only if
  that window is still the one open (Ruling 16).
- **The guard's wording:** title "Add 112 XP?", message "You typed XP but didn't press Done.", buttons
  "Add XP" and "Don't add" (Ruling 17).
- **Loot names the fallen foes only** (§4.4, Ruling 1). `combatantDead()` also covers a party member
  marked dead, but the loot came from the foes; a fallen party member is struck through in the summary
  and never named in the trade.
- **The "Show after combat" switches are the house `.switch` (50×28)**, like every Settings and
  tracker switch, not the plan's 44 px target (Ruling 9).
- **The window does not reopen over another dialog** (Task 5). If something else holds the modal when
  the trade closes, the window is not drawn over it and its state is dropped, as on ×.
- **End combat hides the last Fire toast, and a shot's Undo refuses once End combat has settled it**
  (Task 3 review fix). With End combat's own toast gone, the Fire toast stayed up over the window and
  its Undo re-spent shots in an ended fight. An error toast is left up. Ruling 18: a shot fired outside
  a fight also stops undoing once a later End combat sweeps it up, since undoing it then would recover
  it twice.
- **End combat's screen-reader announcement** (`#cvLive`) says only "Combat ended after 5 rounds
  (30 sec)", no longer what was recovered, and it lands in a region the window makes inert the same
  moment, so a screen reader may not speak it (Task 3 minor, accepted; the window's Ammunition row
  shows what came back).
- **`endFightDone()` returns whether it closed**; `endFightClose()` returns whether XP was added.
- **XP the sheet can't read is never overwritten** (§4.3, Ruling 21). The spec's "Done writes
  `xpNumber(character.xp) + n`" left text it can't read undefined; Done wrote just the added amount.
  Now blank is 0 and anything `xpNumber()` reads as `null` ("6350 xp", "lots") is left alone: the
  Experience row says "Your XP on the sheet isn't a number, so it can't be added to here." in place of
  the box (no split switch: nothing would be added), status "XP", no ready line, × asks nothing.
- **The XP box is a text box with a strict parse** (§4.3). `type="number"` let desktop Safari take
  letters and report them as blank, dropping the XP silently. The box is `type="text"
  inputmode="numeric" maxlength="12"`; `endFightXpInt()` accepts digits or digits in thousands groups
  ("6,350"; "1,2,3" is not one), blank as 0, over 1,000,000 as 1,000,000, and anything else as `null`.
  Then "Whole numbers only" shows in its own line directly under the box (`#ecXpErr`, `--brick`, with
  `aria-invalid` and `aria-describedby`), not in the split line under the switch; the status reads as
  if nothing were typed; Done refuses, opening the row if folded and focusing the box; × closes
  without adding and asks nothing.
- **Enter in the XP box is Done** (review M8), once per press (a held key's repeats are ignored) and
  never while an input method is composing; it lives in `endFightKey()` beside the inert chips.
- **The window keeps its opener across a trade** (review M2). `openEndOfCombat()` records the
  modal's opener; `endFightReopen()` restores it (element and selector, `null` included, so the final
  close falls back as the first open would) and focuses Open trade.
- **The After combat list stays for the window's life** once it opened with trackers (`st.trk`,
  `endFightTrkList()`), across a trade's round trip too: with none left open it reads "Nothing here is
  still open." and the row "All done"; with pages still below it the empty list hides instead, since
  "nothing is still open" above pages with open boxes would mislead.
- **A tick refused while its page is in the Journal editor toasts** "Finish editing “<title>” first."
  from `jnlTogglePage()`, the one writer, with the saved title. `toast()` sets text, so the title is
  not `esc()`'d (that would show entities) and is never markup. The review's optional "Open in the
  Journal's editor" hint on the page in the window was not added.
- **The window sizes to its content** up to the wide modal's height (Ruling 19).
- **Loot's seeded name is capped at 60 characters** (review M7), the With box's `maxlength`, which a
  seeded value gets past: cut at a name with the rest counted ("Goblin 1, Goblin 2, … and 3 more"); a
  first name too long alone is cut inside it, by characters, never mid-surrogate ("Name… and 2
  more"). The review's second half — marking loot trades so they stay out of the With suggestions —
  was not in the fix brief and is not done.

### Tests

`sheet.js`: the #105 data block, the quiet-recovery block, `t105End()`, the review-fix block,
`t105Xp()`, `t105Loot()`, `t105After()`; the #41/#93 typed-count blocks stub `querySelectorAll`. The
fix wave adds: unreadable XP ("6350 xp", "lots") surviving Done, "6,350" and blank still adding, the
strict parse, "Whole numbers only" and Done's refusal, Enter (refused, held, composing, adding), ×
asking nothing for letters or unreadable XP, the opener and Open trade's focus after a trade, the
finder's way back, the name cap, a tracker closing in the window and its Undo (list, status, focus),
"All done", the editor-tick toast and the Ruling 19 CSS. `harness.js` gains `_modalOpener` and
`_modalOpenerSel` in `MUTABLE`. The suites end at 8104 checks.
Two existing text checks changed: `rules-data.js`'s #104 check (quiet recovery and
`openEndOfCombat(`, no "Undo recovery" toast label), and `sheet.js`'s #104 and #47 End combat checks,
which call `endCombatNow()`. `harness.js`: `_endFight` in `MUTABLE`. Throwaway Node checks: the split
arithmetic (16,008 cases) and `endFightLootWith()`.

### Browser QA (Task 7)

Project Playwright MCP, `file://`, the built artifact; shots in
`.claude/qa/in-progress/105-end-of-combat/`. Before: main's End combat (the browser's `confirm`, then
the toast with Undo recovery), classic at 1280 and Humblewood at 390. After, driven with real clicks
and typing: the warning, Keep fighting (the fight still running, nothing spent or logged), End combat,
the folded window, Ammunition's Undo recovery (arrows 15 → 11, "Recovery undone"), 450 split among 4
("450 ÷ 4 = 112 each"), Open trade ("Goblin 1, Bugbear"), 5 gp and Complete Trade (back with "Traded
with Goblin 1, Bugbear", 450 and the split kept), After combat's + (3 → 4, both copies) and a tick, the
split off and 200 typed ("Level 5 ready — …"), Done into the level-up, the Journal tab after (4, the
box ticked); Humblewood at 390 for the warning, the folded window, the split, the window after a trade
and After combat, with nothing scrolling sideways and a long status ellipsizing; both skins folded and
open in dark; the guard both ways (Add XP 6,350 → 6,462; Don't add and Escape on the warning add
nothing; Add XP that reaches a level opens the level-up; × with nothing typed simply closes); a
milestone character (no Experience row), a hidden Journal tab (no After combat row), a quiet fight
(no chips, no Ammunition row, the warning's second sentence left out); both "Show after combat"
switches, driven and saved. The console held only the two boot-time network errors both builds show.
Not driven: touch, real devices, print, a backdrop tap, the finder's round trip from a loot trade, a
character switch with the window open, a reload with it open.

**Final fix wave**, shots `105-fix-*.png`: a quiet fight at 1280 (the box fits its two rows, 260 px
tall); "4S0" typed for real and Done clicked (the window stays, focus in the box, "Whole numbers
only" in red under it), in light classic and both dark skins; the box cleared, 100 typed and Enter
(6,350 → 6,450, the window closed); "6350 xp" on the sheet (the row's sentence, status "XP", Done left
it as it was); + on the window's last tracker ("Nothing here is still open.", "All done"), then the
toast's Undo (the tile back in the window and on the Journal tab); Open trade ("Goblin 1, Goblin 2"),
+ Find an item, the finder's Close, the trade's Cancel (focus on Open trade, the opener still the
combat header's button), then Done (focus back there); Enter on a window tile's + that closes it,
Tab from the Undo (focus on the next tile in the window), and Enter on Undo (focus on the tile's +);
a tick on a page open in the Journal editor ("Finish editing “Loot list <i>” first.", nothing
ticked); everything open at 1280 and 390 (capped at 680 px, the rows scrolling, Done in view, nothing
scrolling sideways) and folded at 390. Not driven: Safari itself (the box's type is what changed),
touch, real devices.

### Deferred

**Fixed in the final fix wave** (each above, under Deviations): XP held as text the app can't read
was overwritten by Done (data loss; Ruling 21); desktop Safari let letters into the XP box; focus did
not return to Open trade after a trade; a tracker closed from the window sent focus to the Journal
tab's inert copy; the After combat row went blank when its last tracker closed; a tick on a page open
in the editor was refused silently; the window kept the wide modal's fixed height (Ruling 19); Loot's
seeded name could exceed 60 characters; Enter in the XP box did nothing.

**Not done, for Mike:** loot trades still feed the trade window's With suggestions (the review's M7
second half: mark them `meta.loot` and skip them there).

**Accepted minors:**
- `t105End()` has no check for a character switch while the warning is open (the code handles it).
- `hideToast()` runs after `applyAmmoRecovery()`; `undoFireTap()` folds two guards into one boolean.
- A classless character is told "Level 2 ready", then Done's "Add a class first".
- No test of a warning answered late (the harness can't remove `#ecDone`).
- `#ecXpReady` has no `aria-live`.
- `endFightReopen()`'s safety branch drops typed XP silently.
- The `onClose` hand-back check and the `[data-ck]` dispatcher check are source regexes.
- The inert chips look tappable and announce as buttons (above).
- A comment nit in `endFightGuard()` ("the hand-on closes it").

### Rulings

Every ruling taken while building it, in the order taken (the controller's ledger has the detail).

1. Loot's other party names fallen **foes** only (`kind:"foe"`); a fallen party member is struck
   through in the summary only.
2. The × guard with XP typed asks through `askConfirm()` (Add XP / Don't add), refuses the dismissal
   and closes on the answer; Add XP behaves exactly as Done, the level-up included.
3. End combat's tests empty the toast list before its await, so "no toast" tests only End combat.
4. Attribute interpolations use `${esc(k)}` inline, never a pre-escaped variable (rules-data's scan).
5. The #41/#93 typed-count tests stub `querySelectorAll` alongside `querySelector`.
6. The plan's quoted test replacements win over its line numbers.
7. The guard's QA drives the app's warning window and shoots it; no browser dialog.
8. Task 7 may commit `docs(#105)` and `style(#105)`.
9. The "Show after combat" switches are the house `.switch` (50×28), not the 44 px target.
10. Tightened: a trade with no `onClose` closes as before, and ending a fight bumps no tracker; an
    unfalsifiable "with no toast" clause dropped.
11. `commitTrackerValue()` queries inside the list the input came from.
12. The Ammunition lines use `ammoKindLabel()`; one `EC_INERT` for the inert-chip selector.
13. `endFightDone()` carries its comment.
14. Line numbers drift; the plan's quoted code and content are authoritative.
15. A "watch it fail" step may fail with a TypeError at top level instead of FAIL lines.
16. The guard's late answer closes only if `#ecDone` is still the open dialog and `_endFight` is still
    the state it asked about.
17. The guard's message is "You typed XP but didn't press Done."
18. A shot fired outside a fight is no longer undoable once a later End combat's recovery has swept
    it (`recoverAmmo` consumes every entry); undoing it then would recover it twice.
19. The window sizes to its content up to the wide modal's height, scrolling inside only when it
    needs to.
20. The window-height item, logged after Task 7 was dispatched, is folded into the final fix wave,
    which records every fix-wave item here and in its ledger entry.
21. XP the app can't read (`xpNumber()` null on non-blank text) is never overwritten: the Experience
    section says so and adds nothing, no ready line, no guard question.

The final fix wave's own calls (its report has each): over 1,000,000 still reads 1,000,000 rather than
"not a number"; thousands commas must group by three; "Whole numbers only" has its own line under the
box; unreadable XP shows no split switch; Done's refusal opens a folded Experience row; the box's
`maxlength` matches the 12 characters the state keeps; the restored opener may be `null`; a tracker's
focus in the window falls back to its first control, then Done; the After combat list stays for the
window's life and hides, rather than reading "Nothing here is still open.", when pages remain; the
editor-tick toast uses the saved title, unescaped because `toast()` sets text; a first name over 60 is
cut inside it.
