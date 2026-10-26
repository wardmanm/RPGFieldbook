# Trade window and inventory log: design

**Status:** approved in conversation 2026-10-25, awaiting Mike's review of this written spec. It is in
wave 3 of [1.9.0](../wiki/roadmap/1.9.0.md).
**Issue:** #47 (Trade Window). One branch, `issue/47-trade-window`.
**Mockups:** in `.superpowers/brainstorm/47470-1792949937/content/`:
- `trade-layout.html`: A on wide screens, B (tabs) on narrow ones;
- `trade-log.html`: the entry point and the log's lines. The log became a dialog, not a card.

**Read first:**
- [Inventory](../wiki/features/inventory.md): items, origin and cost, the finder, item uses, coins.
- [Grants & provenance](../wiki/architecture/grants-and-provenance.md).
- [Ammunition](../wiki/features/ammunition.md).
- [Character model](../wiki/architecture/character-model.md).
- [Shell](../wiki/ui/shell.md): the modal and the browse picker.

---

## 1. What it is

A **⇄ Trade** button on the Equipment card opens a window. One side lists what you give: items from
your inventory and your coins. The other side lists what you get: items from the finder or custom
items, each with a cost, plus coins. A **"With"** field names the other party.

The window shows the balance. If you give less than you get, it shows red, and **Complete Trade**
asks you to confirm. It never blocks the trade.

Every change to your items and coins goes into an **inventory log**: trades, adds, edits, deletes,
Use, coin changes, grants, and per-fight ammunition. A **Log** button on the same card opens the
log as a dialog. Any line that can still be reversed cleanly can be undone.

The issue asks for the trade window, the red shortfall with a confirm, a log on the inventory
screen, and the log covering items added outside the window.

## 2. Decisions

These were settled with Mike on 2026-10-16 (the 1.9.0 page, row #47) and in this brainstorm on
2026-10-25, with mockups.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | What the log records | **Every item and coin change**: trades, finder and custom adds, form edits (only when something changed) and deletes, Use consumption, grants, and coin changes from Adjust, the coin fields and Convert. Each line has a date and time, what changed, how many, the cost, and who | Adds and removes only: an edited quantity would leave no trace |
| 2 | Ammunition | **One line per fight, written at End combat**: "Arrows: 12 fired, 6 recovered" | One line per shot floods the log. Leaving ammo out loses where arrows went |
| 3 | Log size | **Per-character setting `invLogSize`: 100 · 250 · 500 · 1,000 · 2,500, default 500**. The oldest entries drop at the next write | A fixed 1,000: Mike wants it settable. Keeping everything: grows forever |
| 4 | Where the log lives | **A Log button on the Equipment card that opens a dialog** (Mike: Inventory is already long) | A collapsible card at the bottom of Inventory: makes the tab longer |
| 5 | Undo | **Any line that can still be reversed cleanly** gets Undo. Otherwise it is greyed out, with the reason. An undo writes its own "Undid: …" line and strikes through the original. **Grants and ammo summaries have no Undo**: removing the source reverts a grant, and End combat's recovery has its own Undo | Newest-only undo: you couldn't reach a trade three changes back |
| 6 | Trade layout | **Side by side above 700px. Tabs ("You give · n / You get · n") at 700px and narrower.** The balance is always visible | One list: mixes giving and getting |
| 7 | The finish button | **"Complete Trade" on wide screens; a ✓ icon button with the label "Complete trade" on narrow ones** | "Finish": vague |
| 8 | Balance | **You give: coins, plus item worth if that side's "Apply item value" is on. You get: coins, plus item cost if that side's switch is on.** Giving less shows "N short" in red, and Complete Trade confirms. Giving more shows "N over". Both switches start on. The log line records each switch | Coins only: bartering an item is common. Editable per-item worth: more than Mike asked for |
| 9 | Giving | **Capped at what you own**: item quantities, and coins per denomination | Allowing negative coins: you can't hand over gold you don't have |
| 10 | Other parties | **"With" is free text, with suggestion chips** from the Party card and names already in the log | A managed contact list: more than a trade needs |
| 11 | Shortfall | **Shown, confirmed, never blocked** | Blocking Complete: gifts and haggling couldn't be recorded |

## 3. Data

The new fields are optional. Each has a literal default in `blankChar()`, is cleaned by `migrate()`
after migrate keeps every field, and survives a save and load.

- **`invLog`**: `[{id, at, kind, title, lines, undo, undone}]`, default `[]`.
  - `at` is a timestamp in milliseconds.
  - `kind` is one of `trade`, `add`, `edit`, `delete`, `use`, `coins`, `grant` or `ammo`.
  - `title` is the line's text, for example "Traded with Olvin the Merchant".
  - `lines` is a list of `{dir:"+"|"-"|"", text}` for the details.
  - `undo` is the data needed to reverse the line, described in §5, or `null`.
  - `undone` is `true` once the line has been undone.
  - `meta` holds extra facts. For a trade that means the other party, both "apply item value" switches, and the balance.
  - Cleaning keeps only known kinds, forces the types, drops an entry with no `at`, and keeps the newest `invLogSize` entries.
- **`invLogSize`**: one of `100`, `250`, `500`, `1000` or `2500`, default `500`.

## 4. The log

- **One writer, `logInv(entry)`.** It stamps `id` and `at`, puts the entry at the front, and trims the
  log to `invLogSize`. Every path below calls it once per change and never calls it twice for one
  change.
- **What writes, and what each records:**
  - **The finder** (`addLibraryItems`): `add`. The item, the quantity and the cost.
  - **The item form** (`openItemForm`, on save): `add` for a new custom item; `edit`, with a copy of
    the item before and after, only when a field changed; `delete`, with a full copy of the item.
    The other delete paths (the row's 🗑, bulk deletes) also log `delete`.
  - **`useItem`**: `use`. The quantity or uses spent, and what's left.
  - **Coins**: `coins`, with the change for each denomination. One line per commit of a coin field
    (`applyCoinInput`), one per Adjust, and one per Convert. A Convert line is a re-denomination: the
    value doesn't change.
  - **Grants**: `grant`. One line per source when items or gold are granted (`grantItemByName` and
    gold grants under one sid), for example "Granted by Fighter". No undo.
  - **Ammunition**: `ammo`. At End combat, one line per ammunition kind that was fired: "Arrows: 12
    fired, 6 recovered", with the number of rounds. No undo.
  - **A trade**: `trade`. One line, with the full receipt in `lines`. The receipt shows each item and
    coin given or got, with costs, and the two switches.
- **The Log dialog** (§6.3) reads the log and never writes it, except for Undo and Clear log.

## 5. Undo

Each kind checks whether its reversal is still clean. If it isn't, Undo is disabled and the reason
is shown.

| Kind | Undo does | Clean only if | Reason when not |
|---|---|---|---|
| `add` | Removes the added quantity, or the item if that is all of it | The item (by id) still exists with at least that quantity | "It has since been used, sold or removed." |
| `edit` | Puts the item back as it was before the edit | The item still exists and matches the after-copy | "It has been changed again since." |
| `delete` | Puts the copy back, with a new id if the old one is taken | Always | — |
| `use` | Gives back the quantity or uses spent | The item exists | "It is no longer in your inventory." |
| `coins` | Applies the opposite change | Every denomination you'd lose is still in your purse | "Not enough <coin> left to take back." |
| `trade` | Reverses every part as one step: given items and coins come back, and items and coins you got leave | Every part passes its own check | The first part that fails, named |
| `grant`, `ammo` | No undo | — | — |

- An undo is applied as one step. It writes `{kind:<same>, title:"Undid: "+title}` with no undo of its
  own, and marks the original `undone:true`, which strikes it through.
- An undone line can't be undone again. There is no redo.
- Matching the after-copy compares the item's saved fields, ignoring the order of keys.

## 6. Interface

### 6.1 The Equipment card

The heading reads **+ Add · ⇄ Trade · Log**. The Log button carries an icon and the word "Log",
which collapses to just the icon on narrow cards. Both new buttons use the existing `.label .add`
style.

### 6.2 The trade window

`openTrade(opts)`, where `opts` may hold `{with, give, get}` for #105's Loot. It opens a wide modal,
titled "Trade":
- **"With"**: a text box with suggestion chips (§2 decision 10). It is optional.
- **You give**:
  - your items, each with a − / + stepper (capped at what you own) and its worth;
  - "+ From your inventory", which opens a picker listing your items;
  - a coin box for each of your system's denominations (D&D: pp gp ep sp cp; Humblewood: gp sp cp), each capped at what you hold;
  - the **Apply item value** switch.
- **You get**:
  - "+ Find an item", which opens the same finder Add uses and puts its choice here instead of in your inventory;
  - "+ Custom item": a name, a quantity and a cost;
  - each item's quantity stepper and editable cost, which starts at the item's listed cost;
  - coin boxes;
  - that side's **Apply item value** switch.
- **The balance line** reads "You give X gp · you get Y gp", then "N gp short" in red, or "N gp
  over". Values are worked in cp and shown in gp to two places, dropping zeros: 1 pp = 10 gp,
  1 gp = 10 sp = 100 cp, 1 ep = 5 sp.
- **Above 700px:** the two sides sit side by side, with Cancel and **Complete Trade** at the foot.
- **At 700px and narrower:** tabs read **You give · n** and **You get · n** (n is the number of
  lines). The balance line and a ✓ icon button (`aria-label="Complete trade"`) stay at the foot.
- **Complete** confirms first if you are short: "You're N gp short. Complete the trade anyway?" It
  then applies the trade as one step:
  1. given items are reduced or removed, and given coins subtracted;
  2. the items you got are added through the same item-making path as the finder, or as custom items with origin `custom`, cost included;
  3. the coins you got are added;
  4. the trade is logged as one line;
  5. the sheet is re-rendered and saved.

  An empty trade, with nothing on either side, can't be completed.
- **Touch targets** are at least 44px.

### 6.3 The Log dialog

`openInvLog()` opens a wide modal, titled "Inventory log":
- **Filters**: All, Trades, Items (add, edit, delete, use, grant), Coins, Ammo. The chosen filter is
  remembered for the session only.
- **Lines** are grouped by day (Today, Yesterday, then the date), newest first. Each line shows:
  - a kind icon;
  - the title;
  - the ± details, in green for in and red for out;
  - the time;
  - **Undo** when it is clean. When it isn't, Undo is disabled with the reason as its title, and the reason also shows as small text.

  An undone line is struck through and faded.
- **A trade line** expands to its receipt: each item and coin, and the switches.
- **The foot** reads "Keeps the newest 500" (the current setting), with **Clear log**. Clear log asks
  "Clear the whole inventory log? Undo will no longer be possible for any of it."
- **After an Undo**, the dialog repaints in place, and the Inventory and Coins cards behind it update.

### 6.4 Settings

Settings → Sheet display gets an **Inventory log size** select with the five values.

## 7. Code

- **A new fragment, `src/js/67-trade.js`,** placed after `66-coins-hp.js` in `src/manifest.json`.
  The JS fragment count goes from 36 to 37, in both CLAUDE.md and ADR-001. It gets a code-map row in
  the overview and a citation on a topic page. It holds:
  - `cleanInvLog`, `logInv`;
  - the coin maths (`coinsToCp`, `cpToText`);
  - `tradeBalance(give, get, applyGive, applyGet)`;
  - `invUndoCheck(entry)`, `invUndo(id)`;
  - `openTrade`, `openInvLog`.
- **Each writer** gets one `logInv` call:
  - `85-browse.js`;
  - `80-modal-forms.js` (form, delete, use);
  - `40-sheet.js` (row deletes, if they live there);
  - `66-coins-hp.js` (Adjust, field, Convert);
  - `50-classrace.js` (grants);
  - `87-combat.js` or `62-ammo.js` (the ammo line at End combat).
- **Markup** in `src/html/10-inventory.html`: the Trade and Log buttons.
- **Styles** in `src/css/50-modal.css` (the trade window and log dialog, with a media query after its
  base rules) and `src/css/40-spells-coins.css` if needed.
- **Settings** in `src/js/88-settings.js` (Inventory log size).

## 8. Edge cases

- **Giving an item you also receive** (a swap): it is allowed. The two are separate lines.
- **Receiving an item that stacks with one you have:** it follows the finder's own stacking rule.
  Undo removes exactly the quantity added.
- **An item with no cost:** its worth and cost are 0, and it still counts toward the line count.
- **Trading with no "With":** the line reads "Traded".
- **Changing system** (Settings → Skin rewrites the system): the coin boxes follow
  `coinKeys()`. Log lines keep the denominations they recorded.
- **An old save:** it gets `invLog:[]` and `invLogSize:500`. Nothing that happened before the
  update is logged.
- **Clear log:** the next write starts a fresh log.
- **Storage:** the log is saved with the character, so a full-storage save failure is loud, as for
  any save.

## 9. Testing

- **Pure tests:**
  - `cleanInvLog`: junk, kinds, types, and trimming at each size;
  - `logInv`: front insertion and trimming;
  - the coin maths, including ep and pp;
  - `tradeBalance`: both switches, short, over, even, and items with no cost;
  - the giving caps;
  - `invUndoCheck` and `invUndo` for each kind, clean and blocked, each with its reason;
  - a trade undone as one step;
  - an undo writing its own line and striking the original;
  - no Undo on `grant` or `ammo`.
- **Flow tests** in `sheet.js`, using the real paths:
  - a finder add, a form add, a form edit (and an unchanged save, which writes no line), a delete,
    and Use each write exactly one line;
  - Adjust, a coin field, and Convert each write one line;
  - a grant writes one line per source;
  - End combat writes one ammo line per kind fired;
  - a completed trade writes one line, and moves items and coins correctly.
- **Markup tests:**
  - the window's sides and switches, and the balance text;
  - the ✓ button's aria-label;
  - the log dialog's filters, Undo and its disabled reason, and the struck line;
  - escaping of names, other parties and custom item names;
  - `${…}` in attributes is wrapped in `esc`.
- **Browser QA** with the project's Playwright MCP. Shots go in
  `.claude/qa/in-progress/47-trade-window/`. Cover:
  - a trade at 1280 (side by side) and at 390 (tabs, the ✓ button);
  - short and over;
  - both switches;
  - "With" chips;
  - the log dialog: filters, a trade receipt, Undo clean and blocked, Clear log;
  - the size setting;
  - both skins.

## 10. Docs

- Rewrite inventory.md (the trade window, the log, undo) and each page whose writer changes:
  ammunition.md (the per-fight line), grants-and-provenance.md (grant lines), character-model.md
  (the fields) and settings-and-updates.md (the size setting). Add History lines citing
  `## Trade window and inventory log (#47, <date>)`. Add the Decisions rows and their register lines.
- `UNRELEASED.md`:
  - "Trade from the Inventory tab: give items and coins, get items and coins, see whether it
    balances, and complete it in one step."
  - "An inventory log records every change to your items and coins, and lets you undo any change
    that can still be reversed."

## 11. Out of scope

- Selling prices or merchant markups.
- Haggling maths.
- Shared trades between two players' sheets.
- Exporting the log.
- Redo.
- #105's Loot section, which only calls `openTrade`.

## As built

As specified, §1–§9, with the differences below, built in five tasks on `issue/47-trade-window`
(the implementer and reviewer reports, every `Ruling:` and `minor (deferred)` line, and the
browser-QA account are in `.superpowers/sdd/2026-10-25-trade-window/`; the ledger entry "Trade
window and inventory log (#47, 2026-10-25)" is the condensed version).

**The plan-level `use` Ruling.** §5 makes `use` clean only while the item exists. The plan widened
it and told Mike at handoff: **every Use is undoable**, the last one too. Since the final review
(K1, below) `applyItemUse()` keeps a copy of the item, its linked attack and both indexes at
*every* Use, and a trade keeps one of every row it gives: Undo adds back to the row while it is
there, or restores the copy with the quantity used or given, at its old place. It is refused only
when nothing can give back what was used: an old line with neither a row nor a copy, or a Use that
spent only a use (a wand's charge) whose row is gone or has lost its uses. An `add` part sums its
records per row before checking, since received items of one name stack onto one row. Cost if this turns out wrong: one condition in
`invCheckPart()`.

**Rulings made during the build:**
- **A custom item received in a trade gets origin `custom`**, detail "traded from *who*" (or
  "traded"), as §6.2 step 2 says; library items get `traded` with the other party as detail. The
  Task 4 brief's test asked for `traded` on both. Cost if wrong: a label string.
- **The finder's Cost override now reads `fnum()`** (it read `num()`, which truncated 0.5 gp to 0).
  The fix is shared by the ordinary Add finder, so it has its own `UNRELEASED.md` bullet.
- **Open for Mike, not decided: selling above an item's worth reads red.** The balance is give
  minus get with no exception (§1, §2 decision 8, §6.2), so giving a 2 gp Dagger for 5 gp reads
  "3 gp short" in red and Complete asks to confirm. The brainstorm mockup's note said "coins you
  receive (selling) never turn it red". The code follows the spec. The options:
  1. **Keep the spec's rule**: any shortfall is red and confirms, selling included.
  2. **Never red for coins received**: a shortfall made up of coins you get (selling) reads plainly
     and skips the confirm; only a shortfall in items stays red. One condition in `tradeBalance()`
     and `tradeBalHTML()`, plus the confirm in `openTrade()`.
  Shot: `.claude/qa/in-progress/47-trade-window/47-after-trade-selling-reads-short-1280.png`.

**Fixed mid-build, not left open:**
- At 390px the Log dialog's time and Undo column ran past the dialog's right edge, and the filter
  chips and Undo were 32px. The row now wraps its time and Undo onto a second line under 480px,
  and every target is 44px (Task 3, `d96acd8`).
- Undo after giving a whole row put it back at the end of the list. `invRemoveQty()` now returns the
  row's index and `invRestore()` splices it back there; a delete and a last Use record it too, and
  a trade's given rows come back newest removal first, or two whole rows swapped places (Task 4
  review, `b112251`).
- A seeded draft (#105's `opts`) was not capped at what you hold; `tradeClamp()` now caps it at
  creation and again at Complete, so the balance, the receipt and `meta.giveCp` describe what is
  applied. Coin boxes rewrite a typed 2.5 or −3 to the whole number the draft holds. A merged
  finder add keeps its Cost override. The tabs carry `aria-controls` and the sides `role="tabpanel"`
  (Task 4 review, `b112251`).
- **Found in Task 5's QA, fixed in CSS** (`style(#47)`):
  - **The Log dialog could not scroll.** It sits straight in the wide dialog's body, which is a
    non-scrolling flex column built for Settings' own scrollers, so a log longer than one screen
    squashed its rows into each other and the rest could not be reached. Task 3's shots held four
    lines and never showed it. Task 5 made the body scroll with a `:has()` rule; the final review
    (C5) replaced it with the log's own scroller, `.il-scroll`, so it no longer needs `:has()`.
  - **The Equipment heading pushed the page sideways at 390px.** + Add, ⇄ Trade and Log made it
    wider than a phone, so its edit, combat and note buttons ran 91px off the page and the page
    scrolled horizontally. At 480px and under the heading now wraps its buttons onto a second row.
  - The trade's five coin boxes wrapped to four and one on a phone; under 700px they share one row.

**Where the build differs from §1–§9:**
- **§7's names.** The coin text is `cpToGpText()`, not `cpToText`; `tradeBalance(draft, character)`
  takes the draft, not four arguments. The fragment also holds helpers §7 doesn't list:
  `itemWorthCp()`, `invSnap()`, `invSame()`, `logGrant()`, `logFinderAdd()`, `logItemSave()`,
  `logCoins()`, `invRemoveQty()`, `invRestore()`, `newTradeDraft()`, `tradeClamp()`,
  `completeTrade()`, and the dialog's painters.
- **§4, the item form's delete.** The item form has no delete and there is no bulk delete; the
  row's 🗑 is the one delete path, and it logs `delete`.
- **§4, grants** fold every grant from one sid within 5 seconds into one line, which is how a
  class's starting gear and gold become one "Granted by Fighter".
- **§4, the finder's add line** names each item with its quantity and cost (since the final
  review; Task 2 left out the cost).
- **§4, the ammo line** reads "Fight of N rounds" under its title, as the mockup does (since the
  final review; the round count was only in `meta.rounds`).
- **§5, a blocked trade's reason** names the item ("The Healing Potion you got has since been
  used, sold or removed."), since the final review.
- **§6.1, the Log button** is an inline SVG book and the word "Log", the word hidden at 480px and
  under (it was 🕮 until the final review: no glyph in the app's fonts on macOS).
- **§6.2:**
  - at 700px and under, Cancel is hidden (mockup panel B): × and Escape close the window, through
    a "Discard this trade?" confirm when the draft isn't empty;
  - Complete is disabled while the draft is empty, and a toast follows a completed trade;
  - the trade's finder hides the Origin select, since a trade always stamps Traded, and its
    "added" badge marks what is already in the trade;
  - the receipt adds two lines: the totals given and got, and the two switches in words.
- **§6.3:** since the final review an "Undid:" line for a trade draws no Receipt (it has no lines),
  and a receipt lists coins high to low (pp → cp), as the coin card does.

**Found in Task 5's QA and reported, then fixed in the final review:** the Log button's 🕮 drew as
an empty box on macOS (C1); an unchanged save of a potion whose healing is read from its description
wrote "Edited … Details changed" — and so did Chain Mail, a wand with no `used`, an item with no
`qty` and a trade's custom item (I1).

**Deferred minors, from code review across Tasks 1–4 (all recorded in progress.md; those marked ✔
were fixed in Task 4's fix round, the rest left by ruling):**
- The coins-undo reason's fallback to `k.toUpperCase()` is dead code: every key comes from a real
  denomination (Task 1).
- `invUndo()` re-renders the inventory, attacks and coins and recomputes for every kind, even one
  that touched only coins or only items (Task 1).
- The item form reads the item by `it.id` and the saved copy by `rec.id`, always equal but not
  self-evidently so (Task 2).
- `logItemSave()` computes `itemQty(after)` twice (Task 2).
- `ammoFightSummary()` and `ammoRecoverable()` are near-duplicate tallies, differing only in the
  final filter (Task 2).
- `invLogHTML()` relies on `logInv()` keeping the log newest first and does no sort of its own
  (Task 3).
- The foot's "Keeps the newest N." has a trailing full stop the brief's snippet didn't (Task 3).
- ✔ Given rows came back at the end of the list; ✔ coin boxes showed 2.5 while the draft held 2;
  ✔ seeded drafts were not clamped; ✔ a merged finder add dropped its Cost override; ✔ the
  `onClose` comment overstated when it fires; ✔ the tabs lacked `aria-controls` and tabpanels
  (Task 4).
- The finder's `fnum()` fix needed a player note: it is the third `UNRELEASED.md` bullet (Task 4,
  Minor 7, taken in Task 5).

**The final review (ledger "#47 final review fixes (2026-10-25)"; the brief, review and report are
in `.superpowers/sdd/2026-10-25-trade-window/`).** Each finding was ruled by the controller:
- **K1, blocking: Undo reported success while restoring nothing.** Use and a trade's give kept a
  copy only when they removed the row, and `invCheckPart()` called both "always clean". Now both
  always keep a copy (item, attack, both indexes); the check is exactly what the apply step can
  do; a line with neither row nor copy is refused and never marked undone.
- **I1: an unchanged item-form Save writes no line.** `openItemForm()` builds its record in one
  function, `readRec()`, takes a baseline from it as the form opens, and writes no line when the
  record at Save equals it. No field is special-cased. An origin with no date takes the form's
  opening time, so the function is the same both times. A trade's custom items get `description`,
  `effects` and `equipped` at creation.
- **I2: the remaining unlogged changes.**
  - Removing a class, background or ancestry writes one `grant` line, "Removed with *source*",
    listing the items and gold that left (`meta.revert`, no Undo, filed under Items).
  - A row's **Recover N** during a fight counts in that fight's End combat line. This needed a
    character field §3 doesn't list: **`ammoFight`**, kind → `{fired, back}`, `{}` in
    `blankChar()`, coerced by `migrate()`, emptied by `combatStart()` and End combat. Outside a
    fight nothing is kept. The toast's Undo recovery takes End combat's own recovery back off the
    line; there is no separate line.
  - **Item-use pips are not logged**: they change uses, not quantity, as equipping and the rests'
    resets don't.
- **M1, a deliberate deviation from §2 decision 3** ("the oldest entries drop at the next write"):
  lowering the log size trims at once, through `setInvLogSize()`, and first asks "Keep the newest
  100? This removes 2,400 older lines." when it would drop any; declined, the size stays.
- **M2:** `cleanInvLog()` drops an `undo` whose shape doesn't fit its kind (`invUndoShape()`),
  keeping the line; `invUndoCheck()` never throws. **M3:** an undone item whose granting source is
  gone (`grantSidLive()`) comes back ordinary. **M4:** a Use that only heals or applies a status
  writes no line. **M5:** `itemWorthCp()` multiplies before rounding (20 sling bullets at 0.002 gp
  are 4 cp); `tradeGetCp()` had the same bug and got the same fix. **M6:** a restored attack goes
  back at its own index. **M7:** the first day header's rule now matches, and the active filter's
  text is `var(--paper)`, not `#20160a`.
- **Line text (C4, M9):** costs on the finder and form add lines and on receipt items ("Dagger ×1
  (2 gp)"); receipt coins pp → cp; the Use line says what is left ("−1 · 2 left", "1 use · 2 of 3
  left").
- **Still open for Mike: C3**, selling above an item's worth reading red (above).
- **Storage, measured** (Recommendation 5). An edit line holds two full copies of the item. On SRD
  items, a 2,500-line log of edits is about 1,470 characters a line for mundane gear — 3.7 million
  characters for the log alone — and 2,090 for a median magic item (5.3 million); the 20 longest
  magic items reach 5,460 a line (13.7 million). The default 500 lines is 0.7 to 1 million.
  Browsers commonly allow about 5 MB of localStorage a site, shared by every character, so the
  largest size can fill it on its own; a save that doesn't land says so. Recorded in known issues.
