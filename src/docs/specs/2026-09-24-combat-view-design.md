# Combat view — design

**Status:** implemented on branch `issue/9-combat-view` · 2026-09-24 — see [As built](#as-built) for where
the code differs from this text
**Issues:** #9 (the feature), #10 (template + styles), #11 (per-section "add to combat view") — one
branch, `issue/9-combat-view`, closes all three. #10 and #11 touch the same code and cannot be tested
apart, so they are not split across worktrees.

---

## 1. What it is

A full-screen **combat view**, opened from a crossed-swords button in the tab bar, holding whichever
sections of the sheet the player chose — from any tab. Each section works exactly as it does on its
own tab, because it *is* that card, moved into the view while the view is open and moved back when it
closes. The view's header carries a **combat tracker**: Start combat, round and in-game time, next and
previous round, End combat. Closing the view never ends combat.

Why: mid-fight, the numbers a player needs — HP, conditions, attacks, slots, active spells — are spread
across three tabs.

## 2. Decisions

Settled with Mike on 2026-09-24. The rejected options are recorded so they are not re-proposed
without the reason they lost.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | How it opens | A button opens a full-screen overlay over whatever tab is showing | A 7th tab (crowds the tab bar on a phone); a side panel (most complex, and a card pinned from the visible tab would vanish from it) |
| 2 | Where the button lives | The **sticky tab bar**, left of ☰ | The title bar — it scrolls away, taking the "combat running" indicator with it |
| 3 | Icon | `lorc/crossed-swords` from the game-icons library | — |
| 4 | What a round changes | **Active spells only**, through the existing `advanceRound()` | Timed conditions — Mike is filing them as their own issue for the next release |
| 5 | Start / End | Start sets round 1. End is its own button and asks first. **Closing the view never ends combat**; reopening returns to the same place | Opening/closing the view as start/end — closing to look something up would end the fight |
| 6 | Which sections | Any of the 19; six by default; **drag to reorder**; saved per character | Fixed sheet order; starting empty |
| 7 | Mechanism | **Move the real cards** | Copies (every id duplicated — the #17 `#skill-perception` bug); a purpose-built combat dashboard (re-implements every section's controls) |

## 3. Data

Per character. Both new fields are optional, and `blankChar()` gets defaults for them, so a sheet saved
before this feature loads unchanged and needs no migration. `migrate()` preserves unknown fields by
default and needs no change.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `combatSections` | `string[]` | the six defaults | The chosen sections, **in the player's order**. Values are `NOTE_SECTIONS` keys. |
| `combatActive` | `boolean` | `false` | True from Start combat until End combat. |
| `combatRound` | `number` | `0` | **Existing.** Start sets 1, End sets 0. |

- **Defaults, in sheet order:** `vitals`, `statuses`, `attacks`, `resources`, `slots`, `activespells`.
- **`combatActive` has to be its own field.** `combatRound` already exists and is above 0 on any sheet
  where someone used the Active Spells card's round buttons. Deriving "in combat" from `round > 0`
  would drop those characters into a fight the moment they update.
- **Resolver `combatSectionsOf(c)`:** not an array (missing, `null`, a string) → the defaults. An
  array → keep only strings that are `NOTE_SECTIONS` keys, drop repeats (first wins). **An empty array
  is a legitimate state** — the player removed everything — and resolves to empty, not to the defaults.
- **Session only, never saved:** whether the view is open, and its scroll position. After a reload
  the view starts closed; combat state, being saved, survives.
- **Not touched by the rules update** (`72-char-update.js`): these are the player's own state, not
  copies of a rules entry.

## 4. Code layout

**New fragment `src/js/87-combat.js`**, listed in `src/manifest.json` directly after `87-notes.js`. The
builder only checks that the manifest and the disk agree, not prefixes, so the shared `87-` is fine.
It has no top-level statement that reads another fragment's `const`/`let` (the default list is a
literal), so fragment order cannot trip the TDZ rule in ADR-001.

Two layers, kept apart so the logic stays testable:

- **Pure — no DOM:** `COMBAT_DEFAULTS`, `combatSectionsOf(c)`, `withCombatSection(list, k, on)`,
  `moveCombatSection(list, from, to)`, `combatStart(c)`, `combatEnd(c)` (returns rounds and seconds
  for the summary), `combatElapsedSec(c)`, `fmtCombatTime(sec)`.
- **DOM:** `openCombatView()`, `closeCombatView()`, `syncCombatView()`, `renderCombatButton()`,
  `renderCombatHeader()`, `renderCombatToggles()`, and the drag and keyboard handlers.

**Existing code touched:**

| Where | Change |
|---|---|
| `src/fieldbook.template.html` | `#btnCombat` in the tab bar before `#btnToc`; the view shell `#combatView` (header + body) as a direct child of `<body>`, so the print CSS's `body>*:not(#printArea)` already hides it |
| `src/css/45-combat.css` (new, after `40-spells-coins.css`) | The view, its header, toggles, handles, drag states, empty states, button states — all through existing theme tokens |
| `00-constants.js` · `blankChar()` | `combatSections` and `combatActive` defaults |
| `60-attacks.js` · `advanceRound()` | While `combatActive`, a step back from round 1 does nothing. Repaint the tab-bar button, because the Active Spells card's own round buttons also move the counter |
| `40-sheet.js` · `selectTab()` | Close the view first if it is open |
| `40-sheet.js` · `buildToc()` / `scrollToCard()` | Take a root and a scroll container, so the view's ☰ lists the view's cards and scrolls the view, not the window |
| `66-coins-hp.js` · `renderAll()` | Call `syncCombatView()` last |
| `90-boot.js` | Clicks on `#btnCombat`, the toggles (`data-combatbtn`), the header buttons; Esc |
| `src/icons/icons.json` · `scripts/fetch-icons.js` | A fourth kind, `"ui": {"Combat": "lorc/crossed-swords"}`, added to `KINDS`; regenerate `05-icons.js` by hand |
| `88-settings.js` · README §10 | Credits say "the emblems beside each class, ancestry and background, **and the combat button**". Lorc is already credited |
| `CLAUDE.md` | Fragment counts (28 JS, 8 CSS); `src/docs/specs/` in the layout |

## 5. The view

**The button.** `#btnCombat`, the crossed-swords glyph, in the tab bar left of ☰. Idle: the icon alone,
`aria-label="Combat view"`. During combat: highlighted, reading **⚔ Rd 3**, `aria-label="Combat view —
round 3"`. It must still fit at 400px wide beside six tabs and ☰ — the game-icons glyph is a solid
shape among line icons, so its weight gets judged in the screenshots.

**Opening:**
1. Remember the window's scroll position; lock page scrolling.
2. For each key in `combatSectionsOf(character)`, find the card by `[data-note="<k>"]` **at that
   moment** (never a cached reference, so a re-rendered card cannot be stranded), put a hidden marker
   `<span hidden data-cvhome="<k>">` in its place, and move the card into the view's body.
3. Show the view; restore the view's own remembered scroll position.

**Closing** reverses it: remember the view's scroll position, move every card back to its marker and
remove the marker, hide the view, unlock page scrolling, restore the window's scroll position.

**Layout.** One column, centred, as wide as the sheet's main column (about 780px at full width), full
width on a phone. One column is the only layout where drag order and reading order are the same
thing, and each card renders at about the width it was designed for.

**Header** (sticky inside the view): ✕ close · the title · the tracker (§6) · ☰ sections. Esc also
closes.

**Adding and removing.** Every card heading on every tab gets a small crossed-swords toggle beside the
notes button: `<button class="cvbtn" data-combatbtn="<k>" aria-pressed="…">`, highlighted when the
section is in the view. `renderCombatToggles()` follows `renderNoteIcons()` exactly — idempotent,
replacing only its own button and never re-parsing the label, which would destroy `#starBtn`,
`#encPill` and `#roundNum`. `syncCombatView()` calls it, so every `renderAll()` repaints the toggles;
a click repaints only the button it changed. Inside the view the same toggle removes the card, which
goes straight back to its marker.

**Arranging.** Inside the view only, each card heading gets a grip handle (⋮⋮) on its left — inserted
as a card moves in, removed as it moves out, so no tab ever shows one:

- **Pointer events**, so mouse and touch behave the same. HTML5 drag-and-drop is unreliable on phones.
- **Only the handle** starts a drag (`touch-action:none` on the handle alone), so a finger anywhere
  else on a card still scrolls.
- The dragged card lifts; the others shift to show where it will land; near the view's top or bottom
  edge the view scrolls. Letting go saves the order via `moveCombatSection`.
- **The handle is a `<button>`.** Focused, ↑ and ↓ move the card one place and keep focus on the
  handle. This is the path for anyone without a mouse or touch.

**Empty states.**

- **Nothing chosen:** "Add sections with the ⚔ button on any card."
- **Active Spells and Familiars** hide themselves on their tab when empty (inline `display:none`). In
  the view that would look like a bug, so the view's CSS shows `#activeSpellCard` and `#familiarCard`
  anyway, with a short "none right now" line.
- **Skills in By ability mode** (#17) is hidden because the skills live in the Abilities card. The
  override above does **not** apply to it — the view shows no empty Skills card.

## 6. The tracker

In the view's sticky header.

- **Not in combat:** a **Start combat** button.
- **Start combat** → `combatActive = true`, `combatRound = 1` — always 1, even if an old round was
  higher. Active spells are not touched.
- **In combat:** `◀  Round 3 · 12 sec  ▶`, and **End combat** set apart from the arrows.
  - **Time** is in-game: `(round − 1) × 6` seconds. `fmtCombatTime`: under a minute → `12 sec`; under
    an hour → `1 min` or `1 min 6 sec`; from an hour → `1 hr 4 min`.
  - **▶** is the existing `advanceRound(1)`: round up, every active spell +6 s, with the existing
    "reached its duration — end it?" prompt.
  - **◀** is `advanceRound(-1)`, which already takes the 6 s back off active spells. Disabled at
    round 1 while in combat.
  - The Active Spells card's own round buttons keep working and share the counter.
- **End combat** asks `End combat at round 7?`. Yes → `combatActive = false`, `combatRound = 0`, toast
  `Combat ended after 7 rounds (42 sec)`. Active spells keep running. The view stays open; the tab-bar
  button returns to the plain icon.
- **The header and the summary count time differently, on purpose.** The header shows the time at the
  *start* of the current round (round 7 → 36 sec). The summary counts the round being ended as
  finished: `combatEnd` returns `{rounds: round, sec: round × 6}` (round 7 → 7 rounds, 42 sec).
- **Closing the view does nothing to combat.** The button keeps reading ⚔ Rd 3 on every tab, and
  reopening lands on the same scroll position and round.

## 7. Edge cases

- **Layering.** The view sits at `z-index: 50`: above the tab bar (40), below the ☰ flyout (55/60),
  the item finder (70), modals (80) and toasts (9999). Cast, Use, Edit and Add open over it.
- **Esc closes only the top layer.** With a modal, the item finder or the ☰ flyout open, Esc closes
  that and leaves the view.
- **Tab switches close the view first.** `selectTab()` closes it — sending the cards home — before
  switching, so a note link never lands on a tab with its cards missing.
- **Character switch while open.** Every path ends in `renderAll()`, whose `syncCombatView()` sends all
  cards home and repopulates from the new character's list, and repaints the tab-bar button from that
  character's combat state. The view's remembered scroll position resets to the top — it belonged to
  the other character's cards.
- **Print is unaffected.** `printSheet()` builds `#printArea` from character data, and the print CSS
  hides every other child of `<body>`, the view included.
- **Bad or old data** resolves through `combatSectionsOf`; a missing `combatActive` is `false`.
- **Storage** goes through the existing `scheduleSave()` path, which already reports a failed write.

## 8. Testing

**Unit tests** — in the existing `src/tests/sheet.js` suite (the harness runs app code in a VM with the
DOM stubbed and a settable `confirm()`), so the "seven suites" CLAUDE.md quotes stays true:

- `combatSectionsOf`: missing, `null`, a string → defaults; unknown keys and repeats dropped; empty
  array stays empty.
- `withCombatSection`: adds at the end, removes, no-ops on repeats; `moveCombatSection`: first ↔ last,
  out-of-range indices, a one-item list.
- `combatStart` from round 5 → round 1 and active; `combatEnd` at round 7 → round 0, inactive, active
  spells untouched, returns `{rounds: 7, sec: 42}`.
- `advanceRound(1)` adds 6 s to each active spell; `advanceRound(-1)` takes it back; it will not go
  below round 1 while in combat.
- `fmtCombatTime`: 0 → `0 sec`, 12 → `12 sec`, 60 → `1 min`, 66 → `1 min 6 sec`, 3840 → `1 hr 4 min`.
- `blankChar()` carries both fields; a save → load round trip keeps them; an old sheet without them
  resolves to not-in-combat with the defaults.

**Driven in Playwright** — the suites cannot run page code:

- Add sections from their tabs; open the view: cards in order, **no element id appears twice anywhere
  in the document**, and closing returns every card to exactly its original position (compare the DOM
  order before and after).
- Use cards inside the view: change HP, spend a slot, add a condition, Next round → an active spell
  ticks.
- Reorder by mouse drag, then by ↑ ↓; reload; the order holds.
- Start combat, Next twice, close, visit another tab: the button reads ⚔ Rd 3. Reopen: same scroll,
  round 3. End combat, confirm: round 0, active spells still there.
- Esc with a modal open over the view closes only the modal.
- Switch characters with the view open.

**Screenshots** at 1280 and 400 wide:

- The view in and out of combat, in all four combinations: D&D and Humblewood skins × light and dark.
- The tab-bar button, idle and at ⚔ Rd 3.
- A Sheet tab card heading before and after, since the toggle changes existing UI.

**Left for Mike:** touch-dragging on a real phone, browsers other than Chrome, his own saved
characters.

## 9. Out of scope

- Timed conditions — the next release, as its own issue.
- A real-world clock. Time here is in-game only.
- Initiative and turn order.
- More than one saved arrangement per character.
- A printed combat view. Print is data-driven and unaffected.

## 10. Release note

For `src/docs/UNRELEASED.md`:

> - New **combat view**. Tap the crossed swords in the tab bar to open a full-screen view of just the
>   sections you need in a fight — any card from any tab, added with the crossed-swords button in its
>   heading and arranged by dragging. Everything works there exactly as it does on its own tab.
>   **Start combat** counts rounds and in-game time and moves your active spells along each round.
>   Close the view to look something up and combat keeps going — the button shows the round, and one
>   tap brings you back. **End combat** is its own button.

## As built

Where the code differs from the text above, and why:

- **`COMBAT_DEFAULTS` lives in `00-constants.js`**, not `87-combat.js` (§4). `blankChar()` reads it at
  load (`let character=blankChar()`), when a later fragment's `const` is still in its TDZ (ADR-001).
- **`buildToc()` and `scrollToCard()` take no root or scroller** (§4). Both branch on
  `combatViewOpen()`: ☰ lists `#cvList`'s cards, and a card inside `#cvBody` scrolls that box, not the
  window.
- **The item finder has no Esc of its own** (§7), so with the finder open over the view, Esc leaves
  both open. Adding Esc to the finder was out of scope.
- **The page behind is `inert` while the view is open** — `.topbar`, `.tabbar` and `.page`. `aria-modal`
  alone did not stop Tab reaching invisible controls. The modal, the item finder, the ☰ flyout and
  the toast sit outside those three and keep working.
- **Focus.** Opening focuses ✕; closing returns focus to the tab-bar button. A header repaint keeps
  focus on the same button, or falls back when it is gone or disabled: ◀ at round 1 → ▶, Start → ▶,
  End → Start. A toggle click repaints only that button in place (§5 says so; the first build
  replaced it and dropped focus). The round is announced from one persistent live region, `#cvLive`,
  outside the header that is repainted.
- **Phone widths.** At 400px and below the tab-bar pill drops "Rd" and shows the swords and the
  number (the `aria-label` still reads "round N"), and the tabs narrow to 42px, so the pinned group
  never covers Rules. At 640px and below the header is two rows — ✕ · title · ☰, then ◀ round ▶ with
  End (or Start) at the far right — because the one-row header needs about 610px in combat. At
  480px and below the time also stacks under the round.
- **↑/↓ skip hidden sections.** A section hidden in the view (Skills in By ability mode) keeps its
  slot, and the arrow keys step past it together with the next shown one, as dragging does.
- **Keyboard removal lands on the Undo.** Removing a card from inside the view with Enter/Space
  focuses the toast's Undo: Enter restores it and focuses its toggle; Tab or Esc returns to the grip
  of the card that filled the gap.
- **Undo on removal** (decided after build, not in §5). Removing a section — from its tab or from
  inside the view — shows a toast with an **Undo** that puts it back at its old position. It closes
  the gap where Active Spells and Familiars, hidden on their tab when empty, could not be toggled back.
  The toast gained an optional action for it; see the ledger.
