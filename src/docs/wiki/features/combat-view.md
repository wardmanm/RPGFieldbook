# Combat view

A tab of just the sections a player needs mid-fight — any of the 17 noteable cards it may take
(every section but the Sheet's header), the Journal
tab's Trackers included, from any tab, in an order they choose — with a round tracker in its
header. It is reached from the crossed swords in
the tab bar and has no word tab of its own. The cards in it are the **real** cards, moved in while
the tab shows and sent home when another tab is picked, so every control works exactly as it does on
its own tab. Leaving the tab never ends combat.

**Code:** `combatSectionsOf()`, `combatAddable()`, `withCombatSection()`, `insertCombatSection()`, `stepCombatSection()`,
`combatStart()`, `combatEnd()`, `combatElapsedSec()`, `fmtCombatTime()`, `renderCombatButton()`,
`renderCombatToggles()`, `paintCombatToggle()`, `fillCombatView()`, `sendCardHome()`,
`openCombatView()`, `closeCombatView()`, `enterCombatTab()`, `leaveCombatTab()` (#52),
`renderCombatHeader()`, `setCombatLive()`, `toggleCombatSection()`, `undoCombatRemove()`,
`cvNeighbours()`, `syncCombatView()`, `startCombatNow()`, `endCombatAsk()`, `startCombatDrag()`,
`moveCombatCard()`, `setCombatOrder()`, `combatHeaderHTML()` in `87-combat.js` ·
**the End of combat window** (#105), in `87-combat-end.js`: `EC_ROWS`, `EC_LABEL`, `EC_INERT`, `EC_WITH_MAX`,
`_endFight`, `endFightLive()`, `endCombatOpenOf()`, `openEndOfCombat()`, `endFightShow()`,
`endFightGuard()`, `endFightClose()`, `endFightDone()`; the markup `endFightSummaryHTML()`,
`endFightAmmoLines()`, `endFightAmmoSection()`, `endFightSection()`, `endFightSectionHTML()`,
`endFightHTML()`; Experience `endFightN()`, `endFightXpInt()`, `endFightXpMath()`,
`endFightPartySize()`, `endFightXpBase()`, `endFightReadyLevel()`, `endFightXpView()`,
`endFightXpToAdd()`, `endFightXpSection()`, `endFightSetXp()`, `endFightSetStatus()`,
`endFightXpPatch()`, `endFightSetSplit()`; Loot `endFightLootWith()`, `endFightNamesCap()`, `endFightLootSection()`,
`endFightOpenLoot()`, `endFightReopen()`; After combat `endFightAfterLists()`,
`endFightAfterStatus()`, `endFightTrkList()`, `endFightAfterSection()`,
`endFightPaintTrackers()`, `endFightTick()`, `endFightKey()`; the DOM layer `endFightToggle()`,
`endFightRepaintSection()`, `endFightUndoAmmo()`, `endFightClick()`, `endFightWire()` ·
`endCombatNow()` in `87-combat.js` · `openTrade()`, `tradeClosed()`, `tradeFind()` in `67-trade.js` ·
`jnlTogglePage()` in `87-journal.js` · `trkFocusScope()`, `trkNextControl()`, `undoTrackerChange()` in
`87-trackers.js` · `askConfirm()` in `80-modal-forms.js` ·
**the initiative tracker** (#91), in `87-initiative.js`: `cleanParty()`, `cleanCombatants()`,
`combatantDead()`, `initSort()`, `initFirstAlive()`, `initNextTurn()`, `bandOfShare()`,
`combatantBar()`, `initRollCheck()`, `initRollLine()`, `initModOf()`, `youAC()`,
`buildCombatants()`, `initFreshId()`; `irState()`, `irFoeRowHTML()`, `initRollHTML()`, `irPaint()`, `irSetTyped()`,
`irRoll()`, `startInitFight()`, `openInitRoll()`, `irStart()`; `hbBarHTML()`, `combatantHealthText()`,
`initChipHTML()`, `initRowHTML()`, `initStripHTML()`, `initTableHTML()`, `initChipScroll()`,
`initKeepActorInView()`, `renderInitStrip()`, `renderInitTable()`, `toggleInitTable()`, `initNext()`,
`setInitMode()`, `toggleInitRolls()`; `initTie()`, `combatantDialogHTML()`, `setCombatant()`,
`initTurnWrapped()`, `removeCombatant()`, `moveCombatant()`, `addCombatant()`, `openCombatant()`,
`cdRefocus()`, `openAddCombatant()` · `renderHP()` in `66-coins-hp.js` (it ends in
`renderInitStrip()`) ·
`toggleInspiration()` in `10-compute.js` · `COMBAT_DEFAULTS` in `00-constants.js` ·
`selectTab()`, `scrollToCard()` in `40-sheet.js` · `advanceRound()`, `toast()` in
`60-attacks.js` · `applyAmmoRecovery()`, `undoRecoveryTap()` in `62-ammo.js` · markup
`src/html/70-combat.html`, styles `src/css/45-combat.css` · **Tests:**
`sheet.js` (the pure half), `rules-data.js` (the tab wiring) · **See also:**
[the spec](../../specs/2026-09-24-combat-view-design.md), [the plan](../../plans/2026-09-24-combat-view.md),
[the initiative tracker spec](../../specs/2026-10-25-initiative-tracker-design.md),
[the End of combat spec](../../specs/2026-10-29-end-of-combat-design.md),
[Spells](spells.md), [Ammunition](ammunition.md), [Sections & layout](../ui/sections-and-layout.md),
[Story & notes](story-and-notes.md), [Shell](../ui/shell.md)

## How it works

**State.** Three character fields: `combatSections` (`NOTE_SECTIONS` keys, in the player's order;
defaults `vitals`, `statuses`, `attacks`, `resources`, `slots`, `activespells`), `combatActive` and the
long-standing `combatRound`. `combatSectionsOf(c)` resolves them: not an array → the defaults; an
array → keys the view may take (`combatAddable()`) only, first of any repeat; an **empty** array stays empty — the player removed
everything. Session-only, never saved: whether the tab is showing, its scroll, the scroll of the tab
it came from (`cvPrevTab`), and whose cards are in it.

**Getting in and out.** The swords (`#btnCombat`) call `enterCombatTab()`, which remembers the page
scroll and runs `selectTab("combat")`; that shows `#tab-combat` and calls `openCombatView()`, which
runs `fillCombatView()`: for each chosen key it finds `.card[data-note="<k>"]` **at that moment**,
leaves a hidden `<span data-cvhome="<k>">` in its place, appends the card to `#cvList` and gives it a
grip. `selectTab()` for any other tab calls `closeCombatView()` first, which sends every card back to
its marker (`sendCardHome()`, grip removed). The swords again are `leaveCombatTab()`: back to the tab
they were pressed from, at its scroll, with focus on that tab — unless that tab has since been
hidden (#52: `cvPrevTab&&!isTabHidden(cvPrevTab)`), in which case it goes to the Sheet instead
([Shell](../ui/shell.md)). The tab has no ✕ of its own
(#80): like any tab, another tab leaves it. `selectTab()`
itself never scrolls.

**Choosing sections.** `renderCombatToggles()` puts a swords toggle (`.cvbtn`, `data-combatbtn`,
`aria-pressed`) just before the note button in every `NOTE_SECTIONS` card's heading but the
header's: `portrait` is marked `nocv`, because its rest buttons are not a fight action and the
portrait itself rides in with Vitals (#103). `toggleCombatSection()` refuses it too, and `migrate()`
turns a saved `portrait` (or the retired `rest`) into `vitals`, deduped. **Hiding a word tab (#52)
moves no card in the view**: a card from Spells stays in the combat view exactly as placed even
after Spells is hidden in Settings, since hiding a tab is a tab-bar fact, the combat layout a
separate one — its own per-card toggle inside the view still works. Adding appends
the section and toasts. Removing — from its tab or inside the view — sends the card home and toasts
an **Undo** that `undoCombatRemove()` answers by reinserting at the old index
(`insertCombatSection()`) and re-laying the view (`setCombatOrder()`); the Undo carries the character
id and does nothing after a switch. Removing by keyboard from inside the view focuses the Undo; Tab or
Esc from it lands on the grip of the next *shown* card (`cvNeighbours()`, recorded before removal),
else the previous one, else the swords (`#btnCombat`).

**The tracker.** `combatHeaderHTML()` draws title · ✦ · Start combat out of combat, and
title · ✦ · ◀ Round N · time ▶ · (gap) · End combat in it — End set well apart from ▶. The ✦ is an
Inspiration toggle (`data-inspire`, no id) wired to `toggleInspiration()`, the same as the Sheet
header's `#starBtn`, and `recompute()` paints both: the star left Vitals for the header in #103, so
the view carries its own. The rests stay out of the view. On a phone the
header is one row out of combat and two in it (`.fighting`, set by `renderCombatHeader()`): the title,
then the tracker with End at the far right.
Start combat opens Roll initiative (below), whose Start ▸ ends in `combatStart()`: active, round 1,
active spells untouched. (`startCombatNow()` is the same start with no roll and no list; no button
calls it since #91, only the combat-view and ammunition tests.) ◀ and ▶ are
`advanceRound(∓1)`, shared with the Active Spells card: every active spell and every active timed
condition moves 6 s ([Conditions & concentration](conditions-and-concentration.md)), and in combat
the round cannot drop below 1. End asks first, and then wraps the fight up in one window (#105,
below). The header shows time
at the *start* of the round (`combatElapsedSec()`, round 7 → 36 sec); the summary counts the round
being ended (round 7 → 7 rounds, 42 sec). Every round-mover repaints through `renderCombatChrome()`.
The round is announced from `#cvLive`, outside the header that is repainted, and only when it has
moved since it was last said (`cvLiveRound`, reset on open, on a character switch and out of combat):
a repaint that leaves the round alone (▾, a band, a mode switch) says nothing. A repaint keeps focus
on the same button by id, falling back when it is gone or disabled (◀ at round 1 → ▶, Start → ▶, End
→ Start).

**The tab-bar button.** `renderCombatButton()`: the swords alone when idle; highlighted with "Rd N"
in combat, on every tab (at ≤400px just the number). It takes `.active` while the combat tab shows.

**Arranging.** In the view only, each card heading gets a grip — a real `<button>`. Dragging
(`startCombatDrag()`) uses pointer events and never moves the dragged card: its neighbours hop over
it, a hidden card hops along with the next shown one, the window scrolls near the header's bottom
edge or the window's, and the order is read back off the DOM on release. ↑/↓ on a focused grip
(`moveCombatCard()` → `stepCombatSection()`) move it past the next shown section and any hidden ones
between.

**Layout.** One centred column. The header is sticky at `--cv-top`, the tab bar's **measured**
height (`cvStickyTop()`, on open and resize); ≤640px it wraps to two rows and ≤480px the time stacks
under the round. Active Spells and Familiars, which hide on their own tab when empty, always show in
the view with "None right now." (Familiars is always hidden on the Sheet, so the view is the one
place its card shows; its toggle on the Sheet is the **Combat view** item in the header paw's menu,
the same `[data-combatbtn="familiars"]` hook); Trackers stays hidden when Settings hides it. `cvCardShown()` tests computed style. `renderCombatEmpty()` shows the
"Add sections with the … button on any card." hint when no card in the view shows. `fillCombatView()`
and a toggle call it, and so does `renderTrackers()` while the view is open, so hiding Trackers
when it is the only card there brings the hint back instead of leaving the view blank. A note jump into the view goes through
`scrollToCard()`, which clears both the tab bar and the header. Ability Scores & Saves and Skills, added here like any other card, draw compact and
read-only instead — `syncStatLock()` disables their score boxes and proficiency dots while they sit
in `#cvList` ([Abilities & skills](abilities-and-skills.md)). **Vitals is the rail** (#103): the
same dark card, laid out in the view as two columns — the portrait and its AC shield at the left,
the death saves, badges, HP and hit-dice bars beside it (`#cvList .rail`, 45-combat.css), 96px for
the portrait at ≤480px.

**Character switches.** `syncCombatView()` is the last thing `renderAll()` does: with the tab open it
empties and refills from the new character (scroll to top if the character changed), then repaints
the toggles and the button.

## The initiative tracker (#91)

A strip of chips under the combat header shows the fight's order, each with a health bar and,
optionally, a "now acting" marker; a ▾ table below it is the read-only, one-row-per-combatant view.
**Start combat** (`#cvStart`) opens `openInitRoll()` — **Roll initiative**; Cancel or × starts
nothing. Full data model, decisions and code list
are in [the spec](../../specs/2026-10-25-initiative-tracker-design.md); this section is the
as-built summary.

**Data.** `character.party` ([{id,name,ac,maxHp}]`, the Bio-tab roster, see
[Story & notes](story-and-notes.md)) and `character.combatants` ([{id,kind,name,init,ac,track,band,
hp,maxHp,dead,partyId}]`, `kind` one of `you`/`party`/`foe`) are saved **with the character while a
fight is on** (`combatActive`, same as `combatRound`); `combatEnd()` clears `combatants` and
`combatTurn` the same moment it zeroes the round, so a mid-fight reload restores everything
including the marker, and End leaves nothing behind. Cleaning (`migrate()`) gives a missing or
repeated id a fresh one (`initFreshId()`: two rows sharing an id would open one dialog for both),
names a blank foe "Unnamed" and a blank party row "Party member", and sets `combatTurn` only in
Turns mode, never to a dead row. The combatants array order **is** the turn
order; `initSort()` (stable, unrolled rows last) re-sorts it whenever a row's initiative changes.

**Roll initiative** (`initRollHTML()`) lists you first (🎲 Roll for me — a d20 plus your initiative
modifier, or a typed roll + Apply, with an Advantage switch that rolls two and keeps the higher,
and a working line like "14 + 3 = 17"), then every `party` row (a typed total, blank allowed), then
foe rows (name, a `× N` count that becomes "Name 1" … "Name N" sharing one roll, an optional AC, a
typed total) with **+ Add a monster** to add more; party and foe initiative boxes both carry an
"Init" placeholder. **Start ▸** is `irStart()`, and it is the commit: a roll typed into "I rolled"
but never Applied is applied there, and a bad one stops Start with its message (a blank box still
means unrolled, last). Then `startInitFight()`: calls
`combatStart()` if not already in combat, builds `combatants` via `buildCombatants()` (sorted,
unrolled last), and in Turns mode sets `combatTurn` to the first living row.

**Turns vs Rounds** (`character.initMode`, default `"turns"`). *Turns* shows a "now acting" chip
(accent background) and a **Next ▸** button; `initNext()` → `initNextTurn()` moves the marker to
the next living row, skipping dead foes (`band===4`) and dead party members (`dead===true`) but
never you — passing the end calls `advanceRound(1)` exactly once (so active spells and timed
conditions tick as they do for the header's own ▶) and wraps the marker to the first living row.
Next announces "<name>'s turn"; a wrap announces "Round N — <name>'s turn" as one message, since a
screen reader speaks only the last write of a task. The marker also moves off an actor who is
marked Dead or removed; when that move wraps past the end onto a living row
(`initTurnWrapped()`), the round advances once too, exactly as Next's does (ruling T5-M2).
*Rounds* shows neither; the header's ◀ ▶ still move the round and never move the marker. Switching
Rounds→Turns keeps a stored actor only while alive, else lands on the first living row.

**The strip** (`initStripHTML()`, drawn inside `combatHeaderHTML()`'s in-combat branch, so it
sticks with `#cvHead` and repaints on every header redraw) is a row of chips, each showing the
initiative (if `initShowRolls`), the name, and a bar: a four-segment band bar, a smooth share bar
for you and for a party member on Exact with a max HP, or a grey "?" when nothing is known (a party
member on Exact with no max reads "HP n" with a "?" bar). It scrolls sideways on a narrow screen and
keeps the actor in view: `renderCombatHeader()` carries `.ini-chips`' `scrollLeft` across its
repaint and `initKeepActorInView()` scrolls only as far as the acting chip needs
(`initChipScroll()`, setting `scrollLeft` directly rather than scrolling the chip into view, which can move the page).
**Your chip and table row follow your HP**: `renderHP()` ends in `renderInitStrip()`, which patches
those two nodes in place — never the whole strip (see Traps) — and returns at once with the view
closed or no fight. The right end holds Next ▸ (Turns) and **▾**, which toggles the read-only table
(`initTableHTML()`) below it. The ▾ open/closed state (`_iniTableOpen`) is a module-level flag, not
a dataset attribute on the panel: the panel sits outside `#cvHead`, so a dataset flag on it could
never agree with the header's own full repaint (see Traps). `toggleInitTable()` is the one place
that flips it; it closes itself whenever there is no fight or no rows, so a later fight always
starts collapsed. `.cv-init-table` shares `.cv-head`/`#cvList`'s `max-width:780px;margin:0 auto`,
so the table never runs wider than the column it sits under.

**The combatant dialog** (`openCombatant()`, one per combatant, opened from a chip or a table row,
every target ≥44px): a **foe** gets five full-width band buttons (Healthy…Dead, each with the DM's
words) that set the band and close the dialog in one tap; a **party** member gets an Exact HP /
Estimate switch (Exact: a stepper clamped `0..max`, a typed value accepted — a negative reads 0, and
the box is rewritten from the stored row, so it shows the clamp; Estimate: four band
buttons, no Dead band since party death is its own switch) and a **Dead** switch; **you** gets
initiative only, with HP and AC read live off the sheet (`effMaxHP()`, `character.hp.cur`,
`youAC()`) and a note that HP changes on the Vitals card. Every kind but you gets **Remove**
(`removeCombatant()`, confirmed; if the removed row was acting, the marker moves to its living
successor first) and **Done**. A tied neighbour (`initTie()`) offers **Act earlier** / **Act
later** (`moveCombatant()`), swapping places within the tie — the only way to resolve one; see the
Ruling below. `openCombatant()` binds one delegated `click` listener on `#mBody`, guarded by a
dataset flag so it survives every `innerHTML` swap rather than stacking a new listener on each
reopen (the dialog reopens itself after most changes so the player sees the result). After a reopen
`cdRefocus()` puts the keyboard back on the control that was pressed (−, +, Dead, the track, Act
earlier/later — at the end of a tie the other one, then Done), so three presses of + stay on +.

**Adding mid-fight** (`+ Add combatant`, `openAddCombatant()` → `addCombatant()`): a name (up to 60
characters), an
initiative and an optional AC, inserted in sorted place; if it lands before the current actor the
actor doesn't change.

## End combat and the End of combat window (#105)

Full decisions and wording are in [the spec](../../specs/2026-10-29-end-of-combat-design.md) and its
As built; this section is the summary.

**The warning.** End (`#cvEnd`) calls `endCombatAsk()`, which is async and asks in the app's own
warning window ([Shell](../ui/shell.md), `askConfirm()`): "End combat?", "End the fight at round 5?",
plus " Ammunition comes back under your recovery rule." only when something was fired since Start
(`ammoFightTotals()`) and the rule is not None. **Keep fighting** (the safe button, focused) changes
nothing; **End combat** ends it. One question at a time: a second press while it is open is refused
(`_endAsking`), and an answer that comes after a character switch, or after the fight ended some
other way, does nothing.

**Ending** is `endCombatNow()`, in this order: one `ammo` log line per kind fired (#47, read before
anything touches `ammoSpent`), `ammoFight` emptied, `combatEnd()` (which zeroes the round, clears the
fight and returns `{rounds, sec, combatants}`), the chrome redrawn and saved, then the ammunition
recovered **quietly** (`applyAmmoRecovery({quiet:true, logged})`, #104's rule, every outstanding
count retired — see [Ammunition](ammunition.md)). The last Fire toast is hidden, since its Undo would
re-spend shots in an ended fight (an error toast is left up: a save that did not land must never
vanish unread), and the settlement is counted (`_ammoSettled`) so that Undo refuses even if it is
reached. `#cvLive` says "Combat ended after 5 rounds (30 sec)". Then `openEndOfCombat()`.

**The window** is `openModal("End of combat", …, {wide:true})`: wide on a desktop, and sized to its
content up to the wide modal's height (Ruling 19: `.modal.wide:has(.ec-wrap)` is `height:auto` with
the wide box's `max-height`, and its `.m-body` may shrink), so a quiet fight is a short box and a long
one scrolls its rows in `.ec-scroll` with Done pinned at the foot.
Under the title, "Round 5 · 30 sec" (`fmtCombatTime()`); then a chip per combatant in initiative
order (`endFightSummaryHTML()`), this character left out, the fallen (`combatantDead()`) struck
through with ", fell" in their accessible name. Then the folded rows, each a `<button>` with a label
and a one-line status that ellipsizes (`endFightSectionHTML()`); a row with nothing to show is left
out (`endFightSection()` returns null), so a quiet fight is a short window. A tap opens or folds a row
in place (`endFightToggle()`, never a rebuild, so the XP box keeps its caret), remembered per character
in `endCombatOpen`; the first time every row is folded.

- **Ammunition** (when anything was fired since Start): per kind, `ammoLogTitle()`'s own words,
  "Arrows: 9 fired, 4 recovered", read from the log line's `meta` so an Undo shows at once; under
  None, "Arrows: 9 fired, none come back (recovery: None)". **Undo recovery** (`endFightUndoAmmo()`)
  runs the quiet `undoRecoveryTap()` that `applyAmmoRecovery()` handed back — the same reversal the
  toast's Undo did, log lines corrected — once, then reads "Recovery undone". Offered only while the
  window is open, and only when something came back.
- **Experience** (only when `advancementOf(c)==="xp"`): status "XP 6,350 / 6,500", or "+112 XP" once
  something is typed. The sheet's XP is read with its own `xpNumber()` (`endFightXpBase()`, Ruling 21):
  blank is 0, and text it can't read ("6350 xp", "lots") is never overwritten — the row shows "Your
  XP on the sheet isn't a number, so it can't be added to here." in place of the box, status "XP",
  and Done adds nothing. The box is `type="text" inputmode="numeric"` (Safari's number box lets
  letters in and reports them as blank) with a strict parse (`endFightXpInt()`): digits, or digits in
  thousands groups, blank 0, over 1,000,000 read as 1,000,000, anything else `null`. Then "Whole
  numbers only" shows under the box (`#ecXpErr`, `aria-invalid`), the status reads as if nothing were
  typed, and Done refuses: the row opens if folded and focus goes to the box. **Split among N** (N = the Party roster plus this character,
  `endFightPartySize()`), shown only with a roster, is a house `.switch` saved at once in `xpSplit`;
  on, the line reads "450 ÷ 4 = 112 each", rounded down (`endFightXpMath()`). When the XP would make
  the level-up ready, "Level 5 ready — the level-up opens when you press Done."
  (`endFightReadyLevel()`). Typing patches the status and the two lines in place (`endFightXpPatch()`).
- **Loot** (always): "Open trade…", then **Open trade** (`endFightOpenLoot()`), which calls
  `openTrade({with, onClose: endFightReopen})` ([Inventory](inventory.md)). `with` is the fallen
  **foes'** names joined with commas, or "Combat loot" (`endFightLootWith()`): a fallen party member is
  struck through but never named, since the loot came from the foes. It is capped at the With box's
  60 characters (`endFightNamesCap()`): cut at a name, the rest counted, "Goblin 1, Goblin 2, … and
  3 more". The trade replaces the window
  (the modal has one layer); however it closes, `tradeClosed()` runs `endFightReopen()`, which redraws
  the window from `_endFight` with everything as it was, puts back the window's first opener (recorded
  by `openEndOfCombat()`) for the final close, and focuses **Open trade**. After a completed trade the row reads the
  trade's log title, "Traded with Goblin 1, Bugbear". If another dialog has taken the modal
  meanwhile, nothing is drawn over it and the window's state is dropped.
- **After combat** (when an open tracker or a page has `afterCombat` and the Journal tab is not hidden,
  #52): status "1 tracker · 1 page" (`endFightAfterStatus()`). The open flagged trackers, as tiles
  without the pen (`trackerRowHTML(t, {noEdit:true})`) — the form would replace the window — and only
  while the sheet shows trackers; + and − work exactly as on the Journal tab, which patches both copies
  ([Journal](journal.md)). The list (`#ecTrkList`, `endFightTrkList()`) stays for the window's life
  once it opened with trackers (`st.trk`), across a trade's round trip too, so a closed tile's Undo
  can paint it back: with none left open it reads "Nothing here is still open." and the row "All
  done"; with pages below it, the empty list hides. While the window is open, a tracker's focus
  stays inside it (`trkFocusScope()`): Tab or Esc from a close's Undo goes to the next tile there (else
  its first control, else Done), and the Undo itself focuses the tile's +. Each flagged page's title
  and text (`noteHTML()`), its checkboxes tickable there (`endFightTick()` → `jnlTogglePage()`); a
  tick on a page open in the Journal tab's editor is refused with "Finish editing “Loot list”
  first."; a long page scrolls inside its box. Rules terms and table
  links in a page are inert (`EC_INERT`, `endFightKey()`), for the same reason. Nothing changes on its
  own: ending a fight never bumps a tracker or ticks a box.

**Done** (`endFightDone()`, or Enter in the XP box, `endFightKey()`) closes the window, adds the XP (`endFightClose()`: `character.xp` becomes a
number, its share when split) and, when that XP made the level-up ready, opens it through
`doLevelUp()`, the level ring's own path. **× and Escape** with nothing typed, letters typed or XP the sheet can't read simply close. With XP
typed, the dismiss guard (`endFightGuard()`) refuses that dismissal and asks, in the warning window,
"Add 112 XP?" / "You typed XP but didn't press Done." / **Add XP** / **Don't add**. Either answer
closes the window: Add XP exactly as Done, the level-up included; Don't add, or Escape on the warning,
without the XP. The answer acts only on the window it was asked about (`endFightLive()` is still that
state, and its `#ecDone` is still in the open dialog).

**The state**, `_endFight`, is in memory only — never on the character — and belongs to the character
**object** the window was opened for (`endFightLive()` drops it the moment `character` is another
object, as every toast Undo's `who` does; Import → Replace keeps the id, so an id would not do). It is
dropped on Done, on ×/Escape and when the character changes. A reload with the window open loses typed
XP; the fight itself had already ended and saved.

## Rules that must hold

- **Move the real cards, never copy them.** A copy duplicates every id, and `getElementById` finds the
  first: the visible copy updates while the hidden one rots (the #17 `#skill-perception` bug).
- **Find a card fresh every time**, never cached, so a card re-rendered while in the view still goes
  home.
- **`combatActive` is its own flag.** The Active Spells card has always moved `combatRound`; deriving
  "in combat" from `round > 0` would drop old sheets into a fight on update.
- **`COMBAT_DEFAULTS` lives in `00-constants.js`**: `blankChar()` reads it at load, when a later
  fragment's `const` is still in its TDZ (ADR-001).
- **Leaving never ends combat**; only End does, and it asks — the round count is what a stray tap
  would lose.
- **`selectTab()` sends the cards home before showing another tab**, so a note link never lands on a
  tab with its cards missing.
- **Toggles replace only their own button** (and a click repaints just that one in place), never
  `label.innerHTML +=`, which destroys `#starBtn`, `#encPill` and `#roundNum` and drops focus.
- **The dragged card is never moved** — moving an element can drop its pointer capture. A drag also
  ends on `lostpointercapture` heard on the **document**, guarded against running twice.
- **Live regions are never replaced**: `#cvLive` and the toast (`role="status"`) are in the template,
  empty from load. A hidden toast is `visibility:hidden` after its fade, or its Undo stays clickable
  while invisible.
- **`renderFamiliars()` clears its list before its early return**, or the view shows a stale familiar.
- **Hiding a tab never moves or drops a combat card (#52).** The view's own per-card toggle is the
  only thing that adds or removes a card from it; hiding a word tab in Settings only ever changes
  whether that tab's own button shows in the bar.
- **Ties break in the dialog, never by dragging the table (#91).** `initTie()`'s Act earlier / Act
  later are the only way to reorder two rows with the same initiative — see the plan-level Ruling
  under Decisions.
- **`_iniTableOpen` is the single source of truth for the ▾ table's open state (#91).** Both the
  strip's button and `renderInitTable()` read it; a dataset flag on `#cvInitTable` itself cannot
  stay in step with `combatHeaderHTML()`'s full repaint of `#cvHead`, which is where the button
  lives (see Traps).
- **`combatEnd()` clears `combatants` and `combatTurn` in the same step as `combatActive`/
  `combatRound` (#91)**, so nothing can read a stale fight off the character after End; the fight
  it cleared comes back in its return value, which is where #105 reads it.
- **Your HP repaints your chip and row in place, never the strip (#91).** `renderInitStrip()`
  patches two nodes; a swap of the strip there loses the next tap (see Traps).
- **The End of combat window's state is never saved, and belongs to the character object (#105).**
  `_endFight` is read only through `endFightLive()`, which drops it once `character` is another
  object.
- **Nothing in the End of combat window opens a dialog over it except the trade, which brings it
  back (#105).** The modal has one layer: a dialog opened over the window replaces it, losing the
  typed XP and the Undo. So its tiles have no pen and the rules chips in its pages are inert.
- **Its dismiss guard answers through `askConfirm()` and closes the window itself (#105).**
  `endFightGuard()` returns `true` (refuse) while it asks; a guard that returned a message would put
  the browser's `confirm` back.
- **End combat's Undo-bearing toasts die with the fight (#105).** `endCombatNow()` hides the last Fire
  toast and counts the settlement (`_ammoSettled`), and `undoFireTap()` refuses a shot from before it.

## Traps

- **The Esc that closed two layers**: the overlay's own Esc had to run in the capture phase or the
  modal's handler closed the modal and the same keypress closed the view behind it. Removed with the
  overlay. → L3397
- **`aria-modal` did not stop Tab** reaching invisible controls behind the overlay, which needed
  `inert` on the page — and a hand-off with the modal's own inert. Also removed with the overlay.
  → L3397, L3470
- **Familiars pinned last whatever the order**: an old ≤820px `order:1` in 10-chrome.css was not
  scoped to the sheet; `#combatView #familiarCard{order:0}` undid it, and stays as a guard now the
  Sheet's own `order`s are scoped to `.sheet-grid`. → L3397, L6633
- **Arrows that did nothing**: swapping with a hidden Skills card looked like no move at all, hence
  "past the next shown section". → L3470
- **The header breakpoint was measured, not guessed**: the one-row header needs about 610px in
  combat, so it wraps at 640px, not 480px. → L3470
- **A dialog opened over the view focused a `<select>`** and type-ahead rewrote a whole item form;
  `MODAL_FOCUS_FIELDS` never includes `select` — see [Shell](../ui/shell.md). → L3470
- **The ▾ button forgot the table was open (#91).** Its glyph/`aria-expanded` were hard-coded
  `"false"`/`▾` inside `initStripHTML()`, which `combatHeaderHTML()` rewrites whole on every round,
  turn or mode change — so a real tap right after any of those could silently close an
  already-open table. Fixed with `_iniTableOpen`, a module-level flag both the button and the panel
  read, in place of a dataset attribute on the panel itself. → L7097
- **The ▾ table ran the full page width (#91).** `#cvInitTable` sits at the `.cview` level, a
  sibling of `#cvHead` rather than inside it, so it inherited no width constraint until it was given
  `.cv-head`/`#cvList`'s own `max-width:780px;margin:0 auto`. → L7097
- **A tap on Next after typing an HP did nothing (#91).** The HP box commits on `change`, which its
  blur fires on the *mousedown* of the next tap; a first `renderInitStrip()` that replaced the whole
  strip there swapped Next ▸ out between mousedown and mouseup, so the click never landed. Driven,
  reproduced, and fixed by patching only your chip and row in place. → L7212
- **Roll initiative's inputs went full width (#91).** The app's general `input{width:100%}` rule
  won for every box with no flex override, so a party row's initiative box and a foe row's ×/AC/Init
  boxes each landed alone on their own line under `flex-wrap:wrap`; fixed with scoped widths. →
  L7097
- **The last Fire toast outlived the fight (#105).** End combat used to replace it with its own
  toast. With no toast of its own any more, the Fire toast stayed up over the End of combat window and
  its Undo took a shot back into an ended fight: 8 spent shots came back on record, to be recovered a
  second time. Fixed at both ends (above, and [Ammunition](ammunition.md)). → L7921

## Decisions

Settled in the [spec](../../specs/2026-09-24-combat-view-design.md) §2, with the as-built differences.

| Question | Decision | Rejected, and why |
|---|---|---|
| How it opens | **As built:** a tab (`#tab-combat`) reached from the swords, with no word tab (owner's call after play) | The spec's full-screen overlay: in play it covered the tabs a player wanted to glance at. A 7th word tab: crowds the tab bar on a phone. A side panel: the most complex, and a card pinned from the visible tab would vanish from it |
| Where the button lives | The sticky tab bar, alone in its pinned tool group | The title bar: it scrolls away, taking the "combat running" indicator with it |
| What a round changes | Active spells and timed conditions, through `advanceRound()` | Active spells only — timed conditions came in #55 |
| Start and End | Start sets round 1; End is its own button and asks; leaving never ends combat | Opening and closing as start and end: closing to look something up would end the fight |
| Which sections | Any but the Sheet's header, six by default, drag to reorder, saved per character | Fixed sheet order; starting empty (no reason recorded). The header (#103): its rests are not a fight action, and the portrait comes with Vitals |
| Inspiration in the view (#103) | Its own ✦ in the view's header, wired like `#starBtn` | Nothing: the star left Vitals for the Sheet header, which the view does not take |
| Mechanism | Move the real cards | Copies: every id duplicated. A purpose-built dashboard: re-implements every section's controls |
| "In combat" | `combatActive`, its own flag | `combatRound > 0`: old sheets would start in a fight |
| Dragging | Pointer events; neighbours hop, the dragged card stays | HTML5 drag-and-drop: unreliable on phones. Moving the dragged card: can drop its pointer capture |
| Esc | Not handled | The overlay's capture-phase Esc: Esc is not how you leave a tab |
| A ✕ and a ☰ in the header | **Removed** (#80): the tab acts like every tab — another tab or the swords leave it; the tab bar's own ☰ was retired in #103 | Keeping them from the overlay: a close button no other tab has, and a second ☰ beside the tab bar's |
| Cards from a hidden tab (#52) | They stay in the view; the player put them there, and hiding a tab is a tab-bar fact, not a combat-layout one | Dropping them while their tab is hidden: hiding Spells would quietly strip the slots from a fight already running (Mike chose to keep them) |

Settled in the [initiative tracker spec](../../specs/2026-10-25-initiative-tracker-design.md) §2, with Mike, 2026-10-16/2026-10-24/25 (#91):

| Question | Decision | Rejected, and why |
|---|---|---|
| Where the fight is kept | Saved with the character while a fight is on, beside `combatActive`/`combatRound`; End combat clears it | Session only: a phone reload mid-fight loses the order. Kept after End: stale |
| Turns or rounds | Both, per character (`initMode`); Turns shows a marker and Next, skipping the dead, wrapping to `advanceRound(1)`; Rounds has neither | One mode only: Mike wants the granular marker and plain rounds both |
| Where it sits | A strip of chips stuck under the combat header; ▾ opens the full table | A card at the top: scrolls away. A side column: cramped, and a phone needs the strip anyway |
| Editing a combatant | One dialog per combatant, targets ≥44px; the table is read-only | Inline segments and inputs in the table: too small to tap on a phone (Mike) |
| Health | Five bands (Healthy·Injured·Bloodied·Near death·Dead) plus "?" for not set, a four-segment bar coloured by band; "Bloodied" over the issue's "Severely injured", matching the 2024 rules | Exact HP for everyone: enemy HP is never known |
| A party member's health | Exact HP (a stepper and a smooth bar) or Estimate (band buttons), chosen per member, flippable any time; starts on Exact when the party list gives a max HP | Exact only: friends' HP is often unknown (Mike) |
| AC | Optional for party members and enemies; a blank shows nothing; yours is read from the sheet | A required AC: rarely known for enemies (Mike) |
| Your initiative | The hit-die spend box's own controls: Roll for me, or a typed roll + Apply, with Advantage | A typed total only: Mike wants the same roll dialog as the HP steps |
| Everyone else's initiative | A typed total; their players or the DM roll it | n/a |
| Who is skipped | Dead foes and Dead party members (a switch, since 0 HP means dying, not dead); you never are | Skipping anyone at 0 HP: wrong for dying characters |
| Show rolls | A switch (`initShowRolls`, default on) hides initiative numbers from the strip | n/a |
| Ties (plan-level, not in the spec table) | **Act earlier** / **Act later** buttons inside the combatant dialog | Dragging a table row: the table's targets are 44px inside a sideways-scrolling strip, where drag and scroll gestures collide |

Settled in the [End of combat spec](../../specs/2026-10-29-end-of-combat-design.md) §2, with Mike,
2026-10-29 (#105):

| Question | Decision | Rejected, and why |
|---|---|---|
| When the window opens | **After the fight has ended.** End combat asks "are you sure?" in the app's warning window; confirming ends the fight and opens the window | The window with the fight still running and End combat as its last button (first chosen, then changed by Mike): the question and the wrap-up are different moments |
| What the summary shows | **What the app already knows**: rounds, time (6 seconds a round), the combatants with the fallen struck through, the ammunition line | HP, slots and resources spent this fight: a snapshot at Start for a recap nothing acts on; rests restore them |
| The XP box | **One box, with a "Split among N" switch** (the roster plus this character, rounded down), off by default and remembered per character; the level-up opens after Done when the XP reaches a level | A plain box: the split is the common table rule and the roster already knows N |
| Layout | **Folded sections**: the summary open, each other section a one-line row that opens on a tap and remembers being open, per character | Everything open in one scroll: long after every fight |
| Loot's other party (plan ruling) | **The fallen foes only**, or "Combat loot" | Every fallen combatant: a fallen party member is not who the loot came from |
| Closing with XP typed (plan ruling) | **Refuse the dismissal and ask in the warning window**; Add XP is Done, Don't add closes without it | `dismissModal()`'s `confirm` message: a browser box, and its Cancel would keep the window open rather than close it without the XP |

## Open

- The spec, including its "As built" section, describes the overlay and is historical: `inert`, the
  view's Esc, `aria-modal`, `html.cv-lock`, focus on ✕ at open, and since #80 the ✕ and the header's
  ☰ themselves, are all gone.
- The item finder has no Esc of its own.
- **End combat's screen-reader announcement** (`#cvLive`) no longer says what ammunition was
  recovered (the window shows it), and it lands in a region the End of combat window makes inert the
  same moment, so a screen reader may not speak it at all (#105, an accepted minor).
- **The End of combat window's rules chips stay buttons to assistive tech**: inert there, they keep
  `role="button"` and a tab stop from `highlight()` (#105, accepted).
- The #105 accepted minors are listed in the spec's As built.
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-09-24 — The combat view as a full-screen overlay: real cards moved in, per-card toggles, the tracker, drag and ↑/↓. → ledger L3397, #9, #10, #11
- 2026-09-24 — Undo on removal; `toast()` gains an action; toasts announce. → ledger L3454
- 2026-09-24 — ↑/↓ skip hidden sections; header wraps at 640px; keyboard removal lands on the Undo; the toast moves into the template. → ledger L3470
- 2026-09-25 — The overlay becomes a tab; `inert`, the lock, `aria-modal` and its Esc are removed; Hit Dice leave Vitals for Rest & Recovery, so they no longer ride in by default. → ledger L3676
- 2026-09-29 — Trackers: counters, checklists and tasks that close themselves when done, with Undo; registered section 20, in the combat view; hideable per character. → ledger L4822, #41
- 2026-09-29 — Hiding Trackers while it is the view's only card brings back the "Add sections…" hint. → ledger L4856, #41
- 2026-10-02 — Ammunition: launchers fire from a loaded stack with Undo, bundles unpack on arrival, recovery at End combat and on the row, the loaded +N. → ledger L4952, #6
- 2026-10-02 — The final review's fixes: a hostile item name no longer stops a sheet loading; removing a class forgets its spent arrows; End combat asks only about new shots; recovery joins an equivalent stack; the picker shows +N. → ledger L4989, #6
- 2026-10-06 — Timed conditions: a duration in rounds, minutes or hours, counted down by the round
  tracker, clearing itself with an Undo. → ledger L5031, #55
- 2026-10-06 — In the combat view the two cards draw compact and read-only. → ledger L5046, #62
- 2026-10-12 — No ✕ and no ☰ of its own: the tab bar's ☰ serves the Combat tab; focus fallbacks go to the swords; the phone header is one row out of combat. → ledger L5684, #80
- 2026-10-16 — The By ability header keeps a full-size name, modifier and score in the view. → ledger L5756, #92
- 2026-10-19 — End combat recovers ammunition on its own in place of asking, with Undo recovery on the toast. → ledger L6081, #104
- 2026-10-19 — End combat retires every outstanding ammunition count, quietly when nothing comes back. → ledger L6147, #104
- 2026-10-23 — Vitals arrives as the rail, in two columns; the view gains its own Inspiration ✦; the Sheet's header is not combat-addable, and a saved `portrait` or `rest` becomes `vitals`; By ability's compact header is gone. → ledger L6633, #103
- 2026-10-23 — Familiars is addable again, from the paw's menu (its card is hidden on the Sheet); the card shows in the view and goes home hidden. → ledger L6729, #103
- 2026-10-24 — The tab bar's ☰ is retired, so nothing lists the view's cards; the swords stand alone in the tab bar's tool group, and `selectTab()` no longer calls `closeToc()`. → ledger L6804, #103
- 2026-10-25 — `leaveCombatTab()` goes to the Sheet rather than a `cvPrevTab` that has since been hidden; combat cards from a hidden tab stay in the view untouched. → ledger L6989, #52
- 2026-10-25 — The initiative tracker: Roll initiative on Start combat, a strip of chips with a ▾ table under the header, a dialog per combatant, Turns/Rounds, Show rolls, and `87-initiative.js` as a new fragment. → ledger L7097, #91
- 2026-10-25 — The final review's fixes: your chip follows your HP, the actor stays in view, Start commits a typed roll, a wrap on Dead or Remove advances the round, the dialog keeps focus and shows the clamped HP, the round is said once, and `combatEnd()` hands back the fight. → ledger L7212, #91
- 2026-10-29 — End combat asks in the app's warning window and opens the End of combat window: the time and the fallen, folded rows for Ammunition (Undo recovery), Experience (Split among N, Done into the level-up, "Add N XP?" on close), Loot (a trade with the fallen, and back) and After combat (flagged tiles and pages); `endCombatNow()`, `87-combat-end.js`. → ledger L7921, #105
- 2026-10-29 — The final fix wave: XP the sheet can't read is never overwritten (Ruling 21); a strict text box with "Whole numbers only", Enter is Done; focus back on Open trade after a trade; tracker focus stays in the window; After combat reads "All done"; the window fits its content (Ruling 19); Loot's name capped at 60. → ledger L8025, #105
