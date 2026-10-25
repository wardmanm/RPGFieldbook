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
