# Shell

The shell is everything that is not a tab's own content: the title bar that scrolls away, the
sticky tab bar (six word tabs and the combat swords), the one generic modal that every form and
info screen reuses, the full-screen browse picker behind the rules-pack "Add" buttons, the toast,
the back-to-top button, and the wiring in `90-boot.js` that binds all of it once at load. Most of it is
`src/fieldbook.template.html`; the tab panels are spliced in at its `<!--@@HTML@@-->` marker from
`src/html/` (see [Sections & layout](sections-and-layout.md)).

**Code:** `selectTab()`, `scrollToCard()`, `toTopShown()`, `updateToTop()`, `toTopBehavior()`,
`scrollToTop()`, `HIDEABLE_TABS`, `TAB_LABELS`, `isTabHidden()`, `cleanHiddenTabs()`,
`applyHiddenTabs()`, `setTabHidden()` (#52) in `40-sheet.js` ·
`openModal()`, `closeModal()`, `dismissModal()`, `setDismissGuard()`, `modalTakeFocus()`,
`modalGiveBackFocus()`, `openerSelector()` in `80-modal-forms.js` · `openBrowse()`, `closeBrowse()`
in `85-browse.js` · `wire()`, `boot()` in `90-boot.js` · `toast()` in `60-attacks.js` ·
`showUpdatePill()` in `30-version.js` · `renderExtPill()`, `extPillFocusBack()`, `checkSources()` in
`89-extensions.js` · `10-chrome.css`, `50-modal.css` ·
**Tests:** `rules-data.js` (tab bar, the retired ☰ stays gone, back to top, dismissals,
combat tab, no escaped modal title), `sheet.js` (`MODAL_FOCUS_FIELDS`, `openerSelector()`, `finderQty()`), `char-update.js`
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
| `.topbar` | wordmark, version / update pill and its ×, the Extensions pill and its ×, save state, Home, theme, Settings, Print, Load, Save | 50, scrolls away |
| `.tabbar` | six `.tab` buttons, then `.tab-tools` holding `#btnCombat` | 40, `position:sticky;top:0` |
| `.page` | the seven tab panels; 80px of bottom padding (plus the safe area) so the last card scrolls clear of the back-to-top button | — |
| `#btnToTop` | the back-to-top button, fixed bottom-right | 25 |
| `#home` | character library and first-run setup ([Home & characters](../features/home-and-characters.md)) | 60 |
| `#modal` | the generic dialog | 80 |
| `#toast` | one status line, optionally with one button | 9999 |
| `<script>` | all the JS, ending in `boot();` | — |
| `#printArea` | filled by `printSheet()`; print CSS hides every other body child | — |

`#browse` is not in the template: `openBrowse()` creates it on first use and appends it to
`<body>`. At 70 it covers the home screen and sits under the modal, so a preview
opened from a finder lands on top of it.

In the top bar, `#btnVer` reads `v` + `APP_VERSION` and opens the changelog. When the update check
finds a newer release, `showUpdatePill()` hides it and shows `#updatePill` in the same slot, with
the same target ([Settings & updates](../features/settings-and-updates.md)). Beside it,
`#updatePillX` clears that notice, and `#extPill` holds the Extensions pill (`#extPillGo`, "Extensions
· N updates", which opens Settings → Extensions) and its own × (`#extPillX`), #102. The version,
the pills and their ×s pack left as one group: `#savestate` carries the bar's only auto margin
(`margin-left:auto`), since one per pill split the free space and floated the Extensions pill
mid-bar. A × is a 38×32px glyph whose `::after` widens the target to 44px rightwards, up and down,
never left onto its pill. **Up to 560px** a notice and its × don't fit in the first row: the pills
and ×s take `order:5`, a row of their own after the buttons, and the Extensions pill reads "N
updates". So a phone showing a notice has three header rows instead of two. `#savestate` says
Saving… / Autosaved / "Use Save ↑"; `scheduleSave()` writes it, and `boot()` writes the last one if
storage is refused. The theme button flips light and dark, resolving "system" to what is showing
first. Save is `exportChar()`; Load clicks the hidden `#fileLoad`, whose change runs `importChar()`.

### Tabs

Each `.tab` carries `data-tab="<name>"` and owns a panel `#tab-<name>`. The names are lowercase:
`sheet`, `spells`, `inventory`, `story`, `journal`, `rules`, and `combat`, whose button is
`#btnCombat` in `.tab-tools`, not a `.tab`. The `story` tab's button reads **Bio** (#103); its id
stays `story`, because saved Section Notes fold state keys on it.

`selectTab()` reads which panel is active; leaving `combat` calls `closeCombatView()` first, which
sends the moved cards home, and entering it records `cvPrevTab`. It then toggles `.active` on every
`.tab` and `.tabpanel` by exact name match, marks `#btnCombat`, calls `openCombatView()` for
`combat`, and closes the Sheet header's popover (`closeShFly()`). **It never scrolls.** The tab click handler in `wire()` scrolls to
the top, `jumpToNote()` scrolls to its card, and `enterCombatTab()` / `leaveCombatTab()` restore
their own positions.

Every tab button holds both an `svg.tabicon` (`aria-hidden`) and a `span.tlbl`, and CSS shows one:
glyphs below 860px, or at any width when `html[data-tabs="icons"]` (Settings → Icon tabs, set by
`applyTheme()`). Below 400px the bar scrolls sideways and `.tab-tools` becomes
`position:sticky;right:0`, so the swords stay on screen.

**Hiding a tab (#52).** A player can hide the word tabs a character doesn't use, per character,
from Settings → Sheet display → Tabs ([Settings & updates](../features/settings-and-updates.md)).
`HIDEABLE_TABS` is `spells`, `inventory`, `story`, `journal`, `rules` — the Sheet and the combat
swords are structurally unreachable, not merely unlisted: `isTabHidden()` is always false for them
and `setTabHidden()` refuses any other name. `applyHiddenTabs()` sets the `hidden` attribute on
each `.tab[data-tab]` button `isTabHidden()` names and clears it on the rest; it runs from
`renderAll()` (load, a character switch) and from `setTabHidden()` (a Settings flip, a note jump),
so every way a tab gets hidden or shown repaints the bar the same way.
`.tab[hidden]{display:none!important}` (`10-chrome.css`) removes the button from the flow at every
width, icon tabs included — the `!important` is load-bearing, since `.tab` sets its own `display`.
If the active panel's tab is now hidden, `applyHiddenTabs()` selects `"sheet"` and scrolls to the
top (`window.scrollTo({top:0})`), so the player doesn't land mid-Sheet at the old tab's scroll
position; `selectTab(name)` carries the same hidden-name guard for a stale caller, treating a
hidden name as `"sheet"` on every call, not only this one — but it never scrolls itself, same as
always. Two ways back in: `jumpToNote()` unhides a hidden tab and toasts before jumping
([Story & notes](../features/story-and-notes.md)); `leaveCombatTab()` goes to the Sheet rather than
a now-hidden `cvPrevTab` ([Combat view](../features/combat-view.md)).

### Jumping to a card

`scrollToCard()` is a smooth scroll that brings a card to just under the sticky tab bar, clearing
its measured height (plus `#cvHead` inside the combat view) and 10px: the title bar has usually
scrolled away, so the offset is measured, not assumed. The note jump (`jumpToNote()`,
[Story & notes](../features/story-and-notes.md)) and the journal use it.

There is no index of a tab's sections. The ☰ flyout that listed them was retired in #103 (Mike,
2026-10-24): the tabs are organised well enough to need none.

### The Sheet header's popover

The Sheet's header (#103) has one popover of its own, `#shFly` over a transparent `#shBack`:
`openShFly()` fills it with the class menu (`classFlyHTML()`) or the
familiars menu (`famFlyHTML()`), hangs it under the button that opened it (positioned inside the
header, so it scrolls with the page), marks that button `aria-expanded`, and focuses its first
item. A tap outside lands on `#shBack` and closes it; any button inside closes it before its own
action runs; Esc closes it and puts focus back on its button; `selectTab()` and `renderSheetHead()`
close it. With no anchor (a familiars-note jump while the paw is hidden) it hangs from the
header's bar.

### The modal

One `#modal` backdrop holds `.modal` (`role="dialog"`, `aria-modal`, `tabindex="-1"`) with
`#mIcon`, `#mTitle`, `#mClose` and `#mBody`.

- `openModal()` (title, html, icon, opts) clears the dismiss guard and its `then`, sets the title as
  `textContent`, sets `#mIcon` to the icon or `""` on **every** call, sets or clears the dialog's
  `wide` class from `opts.wide` on **every** call (Settings passes `{wide:true}`, #107), puts the HTML into `#mBody` as
  `innerHTML`, shows the dialog and calls `modalTakeFocus()`. Calling it while open swaps the content
  in place. **The title is plain text and the body is markup:** a title holds class, spell, item and
  pack names, and callers pass it exactly as written, never `esc()`'d; they escape what goes into
  the body.
- `closeModal()` clears the guard and its `then`, hides the dialog, empties `#mBody` and gives
  focus back.
- **Dismissal.** × and Escape (a document `keydown` bound at load in `80-modal-forms.js`) go to
  `dismissModal()`. A backdrop click does too, but only when `settings.backdropClose` is `true`
  (Settings → Appearance, off by default, #106), and only for a click pressed and let go on the
  backdrop (`_downOnBackdrop` and `_upOnBackdrop`, set on `pointerdown` and `pointerup`, spent by
  every click). A press and release on different elements deliver their click to the backdrop, so
  without both a selection dragged out of a field, or a press outside slid onto the dialog, would
  close it. If a guard is set, it returns a message and the
  close waits on a `confirm` prompt; a guard that returns `true` refuses outright, with no prompt.
  Done and Save handlers call `closeModal()` directly. The "choose N" pickers arm a guard, via
  `armChoiceDismissGuard()` after `openModal()`
  ([Character building](../features/character-building.md)), and so does the install plan while
  its files download (#102): its guard returns `true` and says "Installing… please wait.", since
  closing can't stop an install already under way.
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
  one usable element), else the swords (`#btnCombat`) when the combat view is open (#80).
- **Listeners.** `#mBody` survives every open, so a form binds to elements inside its own HTML,
  which die with it, and never to `#mBody` (Settings delegates from `#setSections` for this reason).
  The dialog's one persistent listener, `change` on `#modal` feeding `syncChoiceLimits()`, is bound
  once at load.

### The browse picker

`openBrowse()` takes a config: `items`, `id`, `row` (title and tag), `search`, `facets`, `sort`,
`group` / `groupKey` / `groupBadge`, `added`, `preview`, `onAdd` (chosen, origin, cost override, qty),
`onCustom`, `onClose` (#47), `noun` / `noun1`, and the footer switches `originSelect`, `qtyInput`,
`costInput`. There are four callers: `browseItems()`, `browseSpells()` and `browseFeatures()`,
reached through the `data-add` buttons ([Inventory](../features/inventory.md),
[Spells](../features/spells.md), [Features & traits](../features/features-and-traits.md)), and the
trade window's "+ Find an item" (`tradeFind()` in `67-trade.js`). The item finder's list, search,
facets, Qty and Cost come from `itemBrowseCfg(lib)`, which `browseItems()` and the trade share; each
adds its own `added`, `onAdd` and `onCustom`, and the trade an `onClose` that brings its window back.

State is per call: query, facet sets, the selection, filters shown, and whether it has drawn. A row
tap toggles that row in place and calls `foot()`, which repaints the Add label, the count and the
group badges without redrawing the list. `render()` redraws the whole finder for Filters, a facet
chip or Clear, reading Origin, Detail, Qty and Cost first and restoring them afterwards
(`readFoot()` / `writeFoot()`, only after the first draw, so a reopened finder starts clean). The
handlers are assigned as `host.oninput` / `onchange` / `onclick` properties, so each open replaces
the last set rather than adding to it. Opening focuses `#brSearch`. Close shuts it and runs `onClose`, if
given; "+ Custom" shuts it and runs `onCustom`, and Add runs `onAdd` then shuts it, so `onClose`
fires on Close alone. The eye button runs `preview`, which
opens the modal over the finder.

### The toast

`#toast` (`role="status"`) is in the template and empty from load. `toast()` fills it. With an
action (`label`, `run`, optional `back`) it adds one button (the combat view's Undo), stays 6 s
instead of 1.9 s, stays longer while hovered or focused, and returns the button; Tab or Esc on the
button hides the toast and focuses what `action.back` returns. A third argument, `opts`, adds two
forms (#87): `{err:true}` is a failure the player must read — the danger colour (`.toast.err`), led
by "!" (Classic's danger and accent colours are the same red), `role="alert"`, a Dismiss button, a tap anywhere hides it, and no auto-hide at all; `{long:true}` is a
notice of a sentence or two, given the 6 s an action gets. Every other caller passes neither.

### Back to top

`#btnToTop` (#103) is a round 48px button with a line-icon ↑, `aria-label="Back to top"`, in the
template after `.page` and outside every panel, so it serves every tab and the combat view. It is
fixed 16px from the bottom-right corner, plus the right and bottom safe-area insets, in theme tokens
(`--panel`, `--line`, `--ink`, `--shadow`, `--accent` on hover), so it follows both skins and both
themes.

- **When it shows.** `wire()` listens for `scroll` and `resize` on `window`, passive, and runs
  `updateToTop()` at most once a frame through `requestAnimationFrame`. `updateToTop()` toggles
  `.show` by `toTopShown(scrollY, innerHeight)`: true only past one viewport height. Without
  `.show` it is `opacity:0`, `pointer-events:none` and `visibility:hidden`, which flips only after
  the 0.2s fade (the toast's pattern), so a hidden button can be neither tapped nor tabbed to.
- **What it does.** `scrollToTop()` scrolls to 0 with `toTopBehavior()`: `"smooth"`, or `"auto"`
  (an instant jump) when `prefers-reduced-motion: reduce` matches. The button hides as the page
  reaches the top, which would drop focus to `<body>`, so it focuses the active `.tab` (the swords,
  `#btnCombat`, in the combat view) with `preventScroll`.
- **Its layer.** `z-index:25`: over the cards, which set none; under the note popover and the
  combat header (30), the Sheet header's popover (`#shBack` 35, `#shFly` 36), the tab bar (40),
  `#home` and `#saveWarn` (60), `#browse` (70) and the modal (80). An open modal also makes it
  `inert`, like every body child. Print hides it (`@media print`, and the print rule that hides
  every body child but `#printArea`).
- **What else sits at the foot of the window.** The refused-write strip (`#saveWarn`, #81): with
  `body.saving-failed` the button rises to 130px, where the toast goes. The toast: centred and at
  most 80vw wide, it can reach the corner only below 640px, and there, while `#toast.show`, the
  button rises above it (`body:has(#toast.show)`); `toast()` writes the toast's height to
  `--toast-h` on `<body>` for that. Both at once stack: strip, toast, button. The update pill is in
  the top bar and the combat view has no footer, so neither meets it.

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

`boot()` then runs: settings from localStorage (`foldLegacySettings()`, which converts the old
`rulesSources` and `rulesUrl` into `settings.sources`, #102),
the rules cache from localStorage synchronously (`readRulesCacheString()`), `reindexRules()`,
`recomputeDups()`, `buildStats()`, `buildDeath()`, `buildSlots()`, `buildBio()`, `wire()`,
`applyTheme()`, `migrateOldChar()`. It opens the autoload character, or seeds a blank one behind
`showHome()`. It writes the save-state warning if storage is refused, then runs
`loadRulesCacheAsync()` (IndexedDB, after first paint, see [Storage](../architecture/storage.md))
and the three network checks, each optional and silent: `checkForUpdate()`, `checkForDataUpdate()`
and `checkSources({boot:true})`. `wire()` has already drawn the Extensions pill from the manifests
saved at the last check (`renderExtPill()`), so it shows before the network answers.

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
- **The Sheet and the combat swords can never be hidden (#52).** `isTabHidden()` is false for them
  by construction (they are not in `HIDEABLE_TABS`) and `setTabHidden()` refuses any name outside
  it, so a hidden-tab bug can't reach them even by a bad write to `character.hiddenTabs`.
- **`selectTab()` treats a hidden tab as `"sheet"` (#52).** This is a guard, independent of
  `applyHiddenTabs()`'s own redirect, so a stale caller — a leftover `cvPrevTab`, or a future caller
  — can never open a hidden panel.
- **`selectTab()` never scrolls, and sends combat cards home before any other tab shows**, so a
  note jump never lands on a tab with its cards missing.
- **No `<title>` inside a tab SVG** (asserted). Each is `aria-hidden` and its button has an
  `aria-label`, so a title would add only a stray tooltip.
- **Every section card keeps its own `.label`.** `renderNoteIcons()`, `renderEditToggles()` and
  `renderCombatToggles()` find it and append their buttons to it (asserted). Nothing reads a
  `.label`'s text since the ☰ flyout went (#103).
- **A backdrop click closes nothing unless `settings.backdropClose === true`.** Off is the default
  for every player, a saved settings file without the key included; a stray click or a tap to hide
  a phone's keyboard must not throw away a form. × and Escape are never gated.
- **`openModal()` begins `_dismissGuard=null;`.** `rules-data.js` asserts that literal prefix, and
  that `closeModal()` clears it too. Both also clear `_dismissThen`, so a dismissal's follow-up
  never fires for a later window (`char-update.js` checks this by behaviour). A guard is armed after
  `openModal()`, never before. The three user dismissals go through `dismissModal()`, which reads
  `then` before `closeModal()` clears it.
- **`#mIcon` is assigned on every open.** No test guards this.
- **The `wide` class is set or cleared on every open** (`rules-data.js` asserts it), so a dialog
  opened from Settings — Import settings, the rules-update review — comes up at the normal width,
  and Settings comes back wide.
- **The modal title is `textContent`, the body is `innerHTML`.** Callers escape the body and must
  not escape the title. `rules-data.js` pins the assignment and reads every `openModal()` call's
  first argument, refusing `esc(` or an entity in it.
- **`MODAL_FOCUS_FIELDS` never includes `select`**, checkbox, radio or file (asserted in `sheet.js`).
- **`modalGiveBackFocus()` releases only what `modalTakeFocus()` made inert.**
- **Never bind a listener to `#mBody` or `#browse` with `addEventListener`.** Both are reused, so
  the listeners would stack.
- **The back-to-top button stays under every popover, the tab bar and the modal** (`z-index` 25,
  asserted), unreachable when hidden (`visibility:hidden`, asserted), and outside the panels.
- **The toast stays in the template**, outside `.page`, empty at load, and exempt from the modal's
  inert.

## Traps

- **`selectTab("Sheet")` renders a blank app.** Any name that matches no panel deactivates all of
  them: an intact top bar over an empty body, with nothing thrown. A screenshot probe did exactly
  this during the emblem work (ledger L3289).
- **A jump to a hidden card lands nowhere.** Familiars and Active Spells are `display:none` until
  they have content, so a scroll to one lands on a zero-height box. `jumpToNote()` checks
  `offsetParent` first (asserted); the retired ☰ flyout once listed such cards without the check
  (L2242).
- **The tool group scrolled off the end.** In a scroll container `margin-left:auto` collapses to nothing, so
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
| Does a click outside close a dialog? (#106) | Only with Settings → Appearance → Tap outside to close dialogs, off by default, app-wide; and only a click pressed and let go on the backdrop | Always: a stray click, or a tap to put a phone's keyboard away, lost the form. Never: some players want it. Per character: it is how the app behaves, not the sheet |
| Do × and Escape follow that setting? | No, they always close | Gating them: both are deliberate, and Escape is how a keyboard leaves a form |
| Where a dismissed window's follow-up lives | With its guard, as `then`, cleared by every open and close | A module global: the old equipment queue outlived its window and fired after the next level-up (L3649) |
| Where does auto-focus land? | The first text box on the first screenful with a fine pointer; the dialog itself on touch | A field on touch: it raises the on-screen keyboard for every form. A `<select>`: type-ahead rewrote the form |
| The emblem slot in the header | Assigned on every open | Behind `if(icon)`: all but six of the ~50 call sites pass nothing and must clear it, or a class emblem leaks into the next modal |
| Where the toast lives | In the template, empty from load | Created on demand: a live region created and filled in the same moment is not announced |
| A tap on a finder row | Updates that row and the footer in place | Re-rendering: it throws away the scroll position and redraws 400+ rows per tap |
| The off-screen Add button | `width:auto` on the origin select, `flex-wrap` as a safety net | `overflow-x:hidden` on `.browse`: hides a recurrence instead of preventing one |
| Markup that moves, in `wire()` | A local `on()` that skips a missing id | — (reason: one dead button is a far better failure than every later listener unbound) |
| The modal title's contract (#69) | Plain text, set as `textContent`; callers never escape it | `innerHTML` with callers escaping: 51 of 52 calls already passed plain text and a header needs no markup, so every call would change and any one that forgot would be an injection point |
| An index of a tab's sections (#103) | None: the ☰ section flyout is retired (Mike, 2026-10-24); the tabs are organised well enough to need no index | Keeping it: after the Sheet makeover each tab is short and plainly laid out, and the flyout was one more control in a crowded tab bar |
| Where focus goes after Back to top (#103) | The active tab, or the swords in the combat view | Leaving it on the button: the button hides at the top, and a focused element that hides drops focus to `<body>`, stranding a keyboard user |
| The button over a toast on a phone (#103) | It rises above the toast, by the toast's measured height | Hiding it while a toast shows: the button vanishes under the player's thumb. A fixed lift: a two-line toast with Undo is taller than a one-line one |
| What can't be hidden (#52) | The Sheet tab and the combat swords | n/a — hiding Combat would drop the swords mid-fight |
| A hidden tab that is active (#52) | The Sheet shows, both from `applyHiddenTabs()`'s own redirect and from a `selectTab()` guard | n/a |

## Open

- **The browse picker is outside the modal's focus system.** It has no Escape, does not inert the
  page and does not return focus on close. With the finder open over the combat view, Esc used to
  leave both open (L3397).
- **Two comments still describe the combat view's `inert`**, which went when the view became a tab
  (L3676): the focus comment above `modalTakeFocus()` and the one above `toast()`.
- The tab bar is buttons with `aria-label`s, not an ARIA tablist.
- **The phone notice row (#102), open for Mike:** a showing notice adds a third header row at
  560px and under. The alternative is one combined "↑ N" pill with a menu; the Task 6 reviewer
  recommends keeping the row. The app pill's × is 38×32 with a 44px target only to its right.
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
- 2026-09-29 — The Notes tab is the Journal tab (`tab-journal`); the notes print as "Section notes". → ledger L4756, #39
- 2026-10-12 — `toast()` gains `opts`: `err` (stays until tapped, danger colour, alert) and `long` (6 s). → ledger L5648, #87
- 2026-10-12 — The Combat tab uses the tab bar's ☰ like every tab; a modal closing over it gives focus to the swords. → ledger L5684, #80
- 2026-10-16 — A backdrop click closes a dialog only with `settings.backdropClose` on (off by default), and only when the press began on the backdrop. → ledger L5903, #106
- 2026-10-16 — `openModal()` takes `opts`; `{wide:true}` widens the dialog, set or cleared on every open. → ledger L5930, #107
- 2026-10-22 — The ☰ flyout gains a Rules-tab case: it lists `rbShown()`'s categories by name and count instead of walking the DOM, and a tap calls `rbOpenCat()` rather than `scrollToCard()`. → ledger L6327, #99
- 2026-10-22 — The Rules-tab flyout entries now also call `scrollToCard()` after `rbOpenCat()`, clearing the tab-bar offset like every other tab's entries. → ledger L6455, #99
- 2026-10-23 — The Story tab's button reads Bio (id `story` kept); the Sheet header is a card whose ☰ entry is "Character"; the header's own popover (`openShFly()`). → ledger L6633, #103
- 2026-10-23 — The ☰ strips the Sheet header's `.sh-level`, now inside its `.label`. → ledger L6776, #103
- 2026-10-24 — The ☰ section flyout is retired (Mike): `buildToc()`, `openToc()`, `closeToc()` and their markup go; `scrollToCard()` stays. A back-to-top button (`#btnToTop`) arrives, with its collisions handled. → ledger L6804, #103
- 2026-10-25 — A player can hide the word tabs a character doesn't use, per character: `HIDEABLE_TABS`, `applyHiddenTabs()`, `.tab[hidden]`, and a `selectTab()` guard; the Sheet and the combat swords can never be hidden. → ledger L6989, #52
- 2026-10-25 — Final review fixes: `applyHiddenTabs()`'s redirect to the Sheet now scrolls to the top; corrected the Settings-flip repaint path and the hidden-tab guard's rationale. → ledger L7064, #52
- 2026-10-25 — `openBrowse()` takes an `onClose`, run by Close only; the item finder's config is `itemBrowseCfg()`, shared with the trade window. → ledger L7291, #47
- 2026-10-26 — The top bar gains the Extensions pill and a × on both pills, one auto margin on the save state, and a notice row after the buttons up to 560px; a dismissal guard returning `true` refuses outright; boot ends with the source check. → ledger L7428, #102
