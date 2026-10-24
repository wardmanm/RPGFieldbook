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
`openCombatView()`, `closeCombatView()`, `enterCombatTab()`, `leaveCombatTab()`,
`renderCombatHeader()`, `setCombatLive()`, `toggleCombatSection()`, `undoCombatRemove()`,
`cvNeighbours()`, `syncCombatView()`, `startCombatNow()`, `endCombatAsk()`, `startCombatDrag()`,
`moveCombatCard()`, `setCombatOrder()`, `combatHeaderHTML()` in `87-combat.js` · `toggleInspiration()` in `10-compute.js` · `COMBAT_DEFAULTS` in `00-constants.js` ·
`selectTab()`, `scrollToCard()` in `40-sheet.js` · `advanceRound()`, `toast()` in
`60-attacks.js` · `applyAmmoRecovery()`, `undoRecoveryTap()` in `62-ammo.js` · markup
`src/html/70-combat.html`, styles `src/css/45-combat.css` · **Tests:**
`sheet.js` (the pure half), `rules-data.js` (the tab wiring) · **See also:**
[the spec](../../specs/2026-09-24-combat-view-design.md), [the plan](../../plans/2026-09-24-combat-view.md),
[Spells](spells.md), [Ammunition](ammunition.md), [Sections & layout](../ui/sections-and-layout.md),
[Shell](../ui/shell.md)

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
they were pressed from, at its scroll, with focus on that tab. The tab has no ✕ of its own
(#80): like any tab, another tab leaves it. `selectTab()`
itself never scrolls.

**Choosing sections.** `renderCombatToggles()` puts a swords toggle (`.cvbtn`, `data-combatbtn`,
`aria-pressed`) just before the note button in every `NOTE_SECTIONS` card's heading but the
header's: `portrait` is marked `nocv`, because its rest buttons are not a fight action and the
portrait itself rides in with Vitals (#103). `toggleCombatSection()` refuses it too, and `migrate()`
turns a saved `portrait` (or the retired `rest`) into `vitals`, deduped. Adding appends
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
`startCombatNow()` → `combatStart()`: active, round 1, active spells untouched. ◀ and ▶ are
`advanceRound(∓1)`, shared with the Active Spells card: every active spell and every active timed
condition moves 6 s ([Conditions & concentration](conditions-and-concentration.md)), and in combat
the round cannot drop below 1. End asks first (`endCombatAsk()`), then `combatEnd()` zeroes the
round and returns the summary. `applyAmmoRecovery()` (#104) then recovers ammunition **on its
own** — no question — and retires every outstanding count: each gives back what its rule allows and
is cleared, the rest spent, so a count on None or Never never piles up for a later change of rule.
When something came back its summary ("recovered 6 of 12 arrows, 2 of 2 daggers") joins the End
combat toast, which carries **Undo recovery** (`undoRecoveryTap()`): it reverses exactly that
recovery, every cleared entry included, scoped to the character it was shown for, and does nothing
after a switch. When nothing came back the counts clear quietly and the toast says only that combat
ended — see [Ammunition](ammunition.md). The header shows time
at the *start* of the round (`combatElapsedSec()`, round 7 → 36 sec); the summary counts the round
being ended (round 7 → 7 rounds, 42 sec). Every round-mover repaints through `renderCombatChrome()`.
The round is announced from `#cvLive`, outside the header that is repainted; a repaint keeps focus
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

## Open

- The spec, including its "As built" section, describes the overlay and is historical: `inert`, the
  view's Esc, `aria-modal`, `html.cv-lock`, focus on ✕ at open, and since #80 the ✕ and the header's
  ☰ themselves, are all gone.
- The item finder has no Esc of its own.
- Initiative and turn order are out of scope; time is in-game only.
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
