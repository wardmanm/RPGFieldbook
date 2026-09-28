# Shell

The shell is everything that is not a tab's own content: the title bar that scrolls away, the
sticky tab bar (six word tabs, the combat swords and ☰), the section flyout, the one generic modal
that every form and info screen reuses, the full-screen browse picker behind the rules-pack "Add"
buttons, the toast, and the wiring in `90-boot.js` that binds all of it once at load. Most of it is
`src/fieldbook.template.html`; the tab panels are spliced in at its `<!--@@HTML@@-->` marker from
`src/html/` (see [Sections & layout](sections-and-layout.md)).

**Code:** `selectTab()`, `buildToc()`, `openToc()`, `closeToc()`, `scrollToCard()` in `40-sheet.js` ·
`openModal()`, `closeModal()`, `dismissModal()`, `setDismissGuard()`, `modalTakeFocus()`,
`modalGiveBackFocus()`, `openerSelector()` in `80-modal-forms.js` · `openBrowse()`, `closeBrowse()`
in `85-browse.js` · `wire()`, `boot()` in `90-boot.js` · `toast()` in `60-attacks.js` ·
`showUpdatePill()` in `30-version.js` · `10-chrome.css`, `50-modal.css` ·
**Tests:** `rules-data.js` (tab bar, dismissals, ToC visibility, combat tab, no escaped modal
title), `sheet.js` (`MODAL_FOCUS_FIELDS`, `openerSelector()`, `finderQty()`), `char-update.js`
(what a dismissal hands on, what a choice window writes to `#mTitle`) ·
**See also:** [Sections & layout](sections-and-layout.md), [Theming & icons](theming-and-icons.md),
[Combat view](../features/combat-view.md), [Build & source split](../architecture/build-and-source-split.md),
[Screenshot QA](../process/screenshot-qa.md)

## How it works

### The page, top to bottom

Source order in the template matters (see Rules). Layers are `z-index`:

| Element | What it is | Layer |
|---|---|---|
| `#rough` SVG filter | the hand-drawn wobble, used as `filter:url(#rough)` | — |
| `.topbar` | wordmark, version / update pill, save state, Home, theme, Settings, Print, Load, Save | 50, scrolls away |
| `.tabbar` | six `.tab` buttons, then `.tab-tools` holding `#btnCombat` and `#btnToc` (☰) | 40, `position:sticky;top:0` |
| `#tocBack`, `#tocFly` | the flyout's backdrop and the flyout | 55, 60 |
| `.page` | the seven tab panels | — |
| `#home` | character library and first-run setup ([Home & characters](../features/home-and-characters.md)) | 60 |
| `#modal` | the generic dialog | 80 |
| `#toast` | one status line, optionally with one button | 9999 |
| `<script>` | all the JS, ending in `boot();` | — |
| `#printArea` | filled by `printSheet()`; print CSS hides every other body child | — |

`#browse` is not in the template: `openBrowse()` creates it on first use and appends it to
`<body>`. At 70 it covers the flyout and the home screen and sits under the modal, so a preview
opened from a finder lands on top of it.

In the top bar, `#btnVer` reads `v` + `APP_VERSION` and opens the changelog. When the update check
finds a newer release, `showUpdatePill()` hides it and shows `#updatePill` in the same slot, with
the same target ([Settings & updates](../features/settings-and-updates.md)). `#savestate` says
Saving… / Autosaved / "Use Save ↑"; `scheduleSave()` writes it, and `boot()` writes the last one if
storage is refused. The theme button flips light and dark, resolving "system" to what is showing
first. Save is `exportChar()`; Load clicks the hidden `#fileLoad`, whose change runs `importChar()`.

### Tabs

Each `.tab` carries `data-tab="<name>"` and owns a panel `#tab-<name>`. The names are lowercase:
`sheet`, `spells`, `inventory`, `story`, `notes`, `rules`, and `combat`, whose button is
`#btnCombat` in `.tab-tools`, not a `.tab`.

`selectTab()` reads which panel is active; leaving `combat` calls `closeCombatView()` first, which
sends the moved cards home, and entering it records `cvPrevTab`. It then toggles `.active` on every
`.tab` and `.tabpanel` by exact name match, marks `#btnCombat`, calls `openCombatView()` for
`combat`, and closes the flyout. **It never scrolls.** The tab click handler in `wire()` scrolls to
the top, `jumpToNote()` scrolls to its card, and `enterCombatTab()` / `leaveCombatTab()` restore
their own positions.

Every tab button holds both an `svg.tabicon` (`aria-hidden`) and a `span.tlbl`, and CSS shows one:
glyphs below 860px, or at any width when `html[data-tabs="icons"]` (Settings → Icon tabs, set by
`applyTheme()`). Below 400px the bar scrolls sideways and `.tab-tools` becomes
`position:sticky;right:0`, so the swords and ☰ stay on screen.

### The ☰ flyout

`openToc()` calls `buildToc()`, which lists every `.card > .label` and `.inv-sec-head` inside the
active panel, or inside `#cvList` while the combat view is open. A heading whose card has
`offsetParent===null` (hidden) is skipped. Each entry's text is a clone of the heading with
`button, svg, input, select, .grow, .add, .cnt, .enc-pill` stripped; `.inv-sec-head` entries are
indented as sub-entries. The flyout's title is the active tab button's `textContent` ("Combat" in
the view). The flyout and backdrop then take `top` from the live bottom edge of `.tabbar` (or of
`#cvHead` in the combat view): the title bar has usually scrolled away, so the offset is measured,
not assumed. Picking an entry calls `scrollToCard()`, a smooth scroll that clears the measured tab
bar (plus `#cvHead` inside the combat view) and 10px. The flyout closes on a tab switch, a backdrop
tap or an entry tap.

The flyout is DOM-driven. It does not read `NOTE_SECTIONS`, so cards outside the registry (the
Rules tab's two cards, `#concCard`) are listed too.

### The modal

One `#modal` backdrop holds `.modal` (`role="dialog"`, `aria-modal`, `tabindex="-1"`) with
`#mIcon`, `#mTitle`, `#mClose` and `#mBody`.

- `openModal()` (title, html, icon) clears the dismiss guard and its `then`, sets the title as
  `textContent`, sets `#mIcon` to the icon or `""` on **every** call, puts the HTML into `#mBody` as
  `innerHTML`, shows the dialog and calls `modalTakeFocus()`. Calling it while open swaps the content
  in place. **The title is plain text and the body is markup:** a title holds class, spell, item and
  pack names, and callers pass it exactly as written, never `esc()`'d; they escape what goes into
  the body.
- `closeModal()` clears the guard and its `then`, hides the dialog, empties `#mBody` and gives
  focus back.
- **Dismissal.** ×, a backdrop click and Escape (a document `keydown` bound at load in
  `80-modal-forms.js`) all go to `dismissModal()`. If a guard is set, it returns a message and the
  close waits on a `confirm` prompt. Done and Save handlers call `closeModal()` directly. Only
  the "choose N" pickers arm a guard, via `armChoiceDismissGuard()` after `openModal()`
  ([Character building](../features/character-building.md)).
- **What a dismissal hands on.** `setDismissGuard(fn, then)` may also register `then`, and
  `dismissModal()` runs it after `closeModal()`. The choice windows use it to open the windows still
  queued behind them, so a dismissed window costs only its own picks. Because every open and close
  clears it, `then` lives exactly as long as its window. The second window opens the way a Done's
  follow-up does, and `modalGiveBackFocus()`'s deferred look leaves focus alone once it is inside
  that window.
- **Focus in.** On a fresh open, `modalTakeFocus()` records the opener (the focused element, unless
  it is `<body>` or inside the dialog) and `openerSelector()` for it. It makes every other `<body>`
  child `inert` except the dialog, `#toast`, scripts and anything already inert, and remembers
  which ones it changed. It then focuses, with `(pointer:fine)`, the first enabled, editable,
  visible `MODAL_FOCUS_FIELDS` element above the fold of `#mBody`, putting the caret at the end of a
  one-line box; otherwise, and always on touch, it focuses the dialog box.
- **Focus back.** `modalGiveBackFocus()` releases exactly the elements it made inert, then refocuses
  the opener if it is still connected, not inert and rendered. A Save usually re-renders the
  opener's list straight after closing, so a `setTimeout` 0 looks again. If nothing has focus, it
  finds the opener by its selector (its id, else its first `data-*` hook, used only if it matches
  one usable element), else `#cvClose` when the combat view is open.
- **Listeners.** `#mBody` survives every open, so a form binds to elements inside its own HTML,
  which die with it, and never to `#mBody` (Settings delegates from `#setSections` for this reason).
  The dialog's one persistent listener, `change` on `#modal` feeding `syncChoiceLimits()`, is bound
  once at load.

### The browse picker

`openBrowse()` takes a config: `items`, `id`, `row` (title and tag), `search`, `facets`, `sort`,
`group` / `groupKey` / `groupBadge`, `added`, `preview`, `onAdd` (chosen, origin, cost override, qty),
`onCustom`, `noun` / `noun1`, and the footer switches `originSelect`, `qtyInput`, `costInput`. There
are three callers, `browseItems()`, `browseSpells()` and `browseFeatures()`, reached through the
`data-add` buttons ([Inventory](../features/inventory.md), [Spells](../features/spells.md),
[Features & traits](../features/features-and-traits.md)).

State is per call: query, facet sets, the selection, filters shown, and whether it has drawn. A row
tap toggles that row in place and calls `foot()`, which repaints the Add label, the count and the
group badges without redrawing the list. `render()` redraws the whole finder for Filters, a facet
chip or Clear, reading Origin, Detail, Qty and Cost first and restoring them afterwards
(`readFoot()` / `writeFoot()`, only after the first draw, so a reopened finder starts clean). The
handlers are assigned as `host.oninput` / `onchange` / `onclick` properties, so each open replaces
the last set rather than adding to it. Opening focuses `#brSearch`. Close shuts it, "+ Custom" shuts
it and runs `onCustom`, and Add runs `onAdd` then shuts it. The eye button runs `preview`, which
opens the modal over the finder.

### The toast

`#toast` (`role="status"`) is in the template and empty from load. `toast()` fills it. With an
action (`label`, `run`, optional `back`) it adds one button (the combat view's Undo), stays 6 s
instead of 1.9 s, stays longer while hovered or focused, and returns the button; Tab or Esc on the
button hides the toast and focuses what `action.back` returns.

### Wiring and boot

`wire()` binds everything once:

- Tab clicks run `selectTab()` and scroll to the top.
- **Two-way binding.** Any input with `data-path="character.…"` writes through `setP()` and
  schedules a save; `data-recompute` also runs `recompute()`. `renderAll()` fills them back with
  `get()`.
- **One delegated `click` on `document`**, a chain of `closest` tests on `[data-…]` hooks, where
  the first match returns. Row controls speak through `data-*` hooks (`data-edit-item`,
  `data-fav-feature`, `data-invsec`, `data-notebtn`, `data-combatbtn`, …), so re-rendered lists need
  no rebinding. `data-add` maps to `browseFeatures()`, `browseItems()`, `openStatusForm()`,
  `openFamiliarForm()`, `openAttackForm()` or `browseSpells()`.
- **Delegated `keydown`:** Enter/Space on `.kw`, `.tblref` and `[data-notegroup]`; ↑/↓ on combat
  grips; Enter commits the coin and HP boxes, which commit on `change`, not `input`.
- Fixed-id listeners for the top bar, the home screen and the card-header buttons, five of them
  through a local `on()` that skips a missing element.
- A `prefers-color-scheme` listener re-applies the theme in "system" mode.

`boot()` then runs: settings from localStorage (folding a legacy `rulesUrl` into `rulesSources`),
the rules cache from localStorage synchronously (`readRulesCacheString()`), `reindexRules()`,
`recomputeDups()`, `buildStats()`, `buildDeath()`, `buildSlots()`, `buildBio()`, `wire()`,
`applyTheme()`, `migrateOldChar()`. It opens the autoload character, or seeds a blank one behind
`showHome()`. It writes the save-state warning if storage is refused, then runs
`loadRulesCacheAsync()` (IndexedDB, after first paint, see [Storage](../architecture/storage.md))
and `checkForUpdate()`.

The test harness evaluates every fragment except `90-boot.js`, so `wire()` and `boot()` never run
under test. What guards them is regexes over the source in `rules-data.js`, plus browser QA.

## Rules that must hold

- **`boot();` is the last line of the JS.** `scripts/build-html.js` refuses to build unless the
  concatenated JS ends with exactly `boot();` and one newline. Every top-level `const`/`let` in every
  fragment has to be initialised before `boot()` runs ([ADR-001](../../ADR-001-source-split.md)).
- **The script comes after the markup it touches at load.** `80-modal-forms.js` binds `#modal` and
  `#mClose` at top level, and `wire()` binds dozens of ids. Only `#printArea` follows the script,
  and nothing touches it until Print.
- **`wire()` has no try/catch.** An unguarded `getElementById(…).addEventListener` on a missing id
  throws, and every listener after it never binds: the sheet draws and is dead, and nothing names
  the cause. Markup that moves goes through `on()`, or is looked up with a guard.
- **Tab names are lowercase and agree in three places:** `data-tab`, `id="tab-…"`, and every
  `selectTab()` caller. `rules-data.js` asserts six tabs, a panel for each, a tab for each panel
  (`combat` via `#btnCombat`), one active at load, and a glyph and a word in each.
- **`selectTab()` never scrolls, and sends combat cards home before any other tab shows**, so a
  note jump never lands on a tab with its cards missing.
- **No `<title>` inside a tab SVG** (asserted). `buildToc()` reads the button's `textContent`.
- **Card headings stay ToC-clean.** Anything in a `.label` that is not the title must be a
  `button`/`svg`/`input`/`select` or carry `.grow`/`.add`/`.cnt`/`.enc-pill`, or its text leaks into
  the flyout entry. The note preview is a `<span>` inside the note button for this reason.
- **`openModal()` begins `_dismissGuard=null;`.** `rules-data.js` asserts that literal prefix, and
  that `closeModal()` clears it too. Both also clear `_dismissThen`, so a dismissal's follow-up
  never fires for a later window (`char-update.js` checks this by behaviour). A guard is armed after
  `openModal()`, never before. The three user dismissals go through `dismissModal()`, which reads
  `then` before `closeModal()` clears it.
- **`#mIcon` is assigned on every open.** No test guards this.
- **The modal title is `textContent`, the body is `innerHTML`.** Callers escape the body and must
  not escape the title. `rules-data.js` pins the assignment and reads every `openModal()` call's
  first argument, refusing `esc(` or an entity in it.
- **`MODAL_FOCUS_FIELDS` never includes `select`**, checkbox, radio or file (asserted in `sheet.js`).
- **`modalGiveBackFocus()` releases only what `modalTakeFocus()` made inert.**
- **Never bind a listener to `#mBody` or `#browse` with `addEventListener`.** Both are reused, so
  the listeners would stack.
- **The toast stays in the template**, outside `.page`, empty at load, and exempt from the modal's
  inert.

## Traps

- **`selectTab("Sheet")` renders a blank app.** Any name that matches no panel deactivates all of
  them: an intact top bar over an empty body, with nothing thrown. A screenshot probe did exactly
  this during the emblem work (ledger L3289).
- **The flyout listed hidden cards.** `buildToc()` had no visibility filter, so "Familiars &
  Companions" appeared while the card was hidden and scrolled to a zero-height box. It now makes the
  same `offsetParent` check `jumpToNote()` always made (L2242).
- **☰ scrolled off the end.** In a scroll container `margin-left:auto` collapses to nothing, so
  below 400px the tool group is pinned with `position:sticky;right:0` (L1557).
- **Type-ahead on a focused `<select>`.** The item, feature and spell forms open on a rules-pack
  picker. When auto-focus landed on it, typing "t" turned an edited "My Sword" into a Torch, effects
  and all (L3470).
- **Escape discarded a level's picks.** Closing a "choose N" picker threw every choice away, with
  no way to reopen it. Hence the guard (L2298).
- **`.m-body p` is `white-space:pre-wrap`.** A modal paragraph wrapped in source keeps its newline
  and indentation and renders as a stair-step, so keep each one on one source line (L3289).
- **The finder's Add button was off-screen.** An inline `flex:0 0 auto` on the origin select, plus
  the global `width:100%` on inputs, let it claim the whole footer. `.br-origin select{width:auto}`
  fixes it and `flex-wrap` is the safety net. A guard asserts the global rule still exists, since the
  fix is an override of it (L2429).
- **A finder redraw reset the footer.** Filters and facet chips re-render everything, which quietly
  put Origin and Cost back to defaults. Qty made it noticeable (L3503).
- **Five unguarded lookups in `wire()`** pointed at Vitals markup that a restructure moved (L1666).
- **An escaped title shows its entities.** `runChoices()` passed `esc(className)`, so a class named
  with `&` or `'` read `&amp;` or `&#39;` in the header. It was the only one of 52 calls (L4086).

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Does `selectTab()` scroll? | No. The caller decides: the tab bar goes to the top, a note jump to its card | Scrolling inside it: a note jump would fight its own tab switch |
| Where does the dismissal guard live? | `dismissModal()`, in front of the three user dismissals only | Inside `closeModal()`: every Done handler calls it and would have to answer its own prompt |
| Which modals get a guard? | Only one that stands to lose something (the choice pickers) | A guard everywhere: for an ordinary form Escape is cancel and must stay instant |
| Where a dismissed window's follow-up lives | With its guard, as `then`, cleared by every open and close | A module global: the old equipment queue outlived its window and fired after the next level-up (L3649) |
| Where does auto-focus land? | The first text box on the first screenful with a fine pointer; the dialog itself on touch | A field on touch: it raises the on-screen keyboard for every form. A `<select>`: type-ahead rewrote the form |
| The emblem slot in the header | Assigned on every open | Behind `if(icon)`: all but six of the ~50 call sites pass nothing and must clear it, or a class emblem leaks into the next modal |
| Where the toast lives | In the template, empty from load | Created on demand: a live region created and filled in the same moment is not announced |
| A tap on a finder row | Updates that row and the footer in place | Re-rendering: it throws away the scroll position and redraws 400+ rows per tap |
| The off-screen Add button | `width:auto` on the origin select, `flex-wrap` as a safety net | `overflow-x:hidden` on `.browse`: hides a recurrence instead of preventing one |
| Markup that moves, in `wire()` | A local `on()` that skips a missing id | — (reason: one dead button is a far better failure than every later listener unbound) |
| The modal title's contract (#69) | Plain text, set as `textContent`; callers never escape it | `innerHTML` with callers escaping: 51 of 52 calls already passed plain text and a header needs no markup, so every call would change and any one that forgot would be an injection point |

## Open

- **The browse picker is outside the modal's focus system.** It has no Escape, does not inert the
  page and does not return focus on close. With the finder open over the combat view, Esc used to
  leave both open (L3397). The flyout has no Escape either.
- **Two comments still describe the combat view's `inert`**, which went when the view became a tab
  (L3676): the focus comment above `modalTakeFocus()` and the one above `toast()`.
- The tab bar is buttons with `aria-label`s, not an ARIA tablist.
- More: [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Sticky tab bar under a title bar that scrolls away, and the ☰ flyout of the active tab's sections (first commit; the work predates the repo). → ledger L256
- 2026-08-07 — Import on the home screen; the modal's z-index 80 confirmed above the home screen's 60. → ledger L505
- 2026-08-11 — `selectTab()` split out of the tab handler without the scroll; `scrollToCard()` split out of `buildToc()`. → ledger L1535
- 2026-08-11 — Icon tabs: glyph and word in every tab, glyphs under 860px or by setting; ☰ pinned when the bar scrolls. → ledger L1557
- 2026-08-11 — Five unguarded `wire()` lookups of moved Vitals markup go through a guarded helper. → ledger L1666
- 2026-08-15 — Escape, × and backdrop go through `dismissModal()`; the choice pickers arm a guard. → ledger L2298
- 2026-08-15 — The flyout skips hidden cards, matching `jumpToNote()`. → ledger L2242, #27
- 2026-08-15 — The finder's Add button brought back on screen; group badges repaint from `foot()`. → ledger L2429
- 2026-08-17 — The Tables tab folds into Rules: seven word tabs become six. → ledger L2714, #32
- 2026-08-18 — `openModal()` takes an optional emblem, assigned unconditionally. → ledger L3289
- 2026-09-24 — The combat view arrives as a full-screen overlay behind swords in the tab bar. → ledger L3397, #9, #10, #11
- 2026-09-24 — The general modal takes focus and gives it back; the toast moves into the template. → ledger L3470
- 2026-09-24 — The item finder gains Qty, and a redraw keeps the footer. → ledger L3503, #50
- 2026-09-24 — A clear button in every search box, `#brSearch` included. → ledger L3525, #49
- 2026-09-25 — The combat view becomes a tab; `cvInert`, `aria-modal` and its capture-phase Esc are removed. → ledger L3676
- 2026-09-28 — `setDismissGuard()` takes `then`, what a dismissed window hands on; `dismissModal()` runs it after closing. → ledger L3847, #63
- 2026-09-28 — The title contract is stated and guarded: plain text, never `esc()`'d; `runChoices()`, the one caller that escaped, no longer does. → ledger L4086, #69
