# Inventory

The Inventory tab: everything the character carries, filed into sections, with where each thing came
from, what it cost, what it weighs, whether it is worn, and — for potions, wands and the like — a
**Use** button. Above it, the Attacks & Weapons card ([Attacks & damage](attacks-and-damage.md), moved here from the Sheet in #103); below it, the Coins card. Items arrive from a rules pack through the item finder,
from starting-equipment grants, or typed in by hand; each is a *copy* of the pack entry, so the sheet
can carry the player's own fields (quantity, origin, favourite, filing) alongside the rules-owned ones.

**Code:** `renderInventory()`, `invItemHTML()`, `invSection()`, `invSectionName()`, `invGroups()`, `invTotalsHTML()`, `renderEncPill()`,
`itemUse()`, `detectItemUse()`, `itemUsesRowHTML()` in `40-sheet.js` · `ORIGIN_KINDS`,
`originBadge()`, `originFromSid()`, `itemOrigin()`, `originOptionsHTML()`, `itemMetaLine()`,
`costToGp()`, `inventoryTotal()`, `itemWeight()`, `itemWeightTotal()`, `coinsWeight()`,
`carriedWeight()`, `encState()`, `encSpeed()` in `25-origins-items.js` · `browseItems()`,
`addLibraryItems()`, `finderQty()`, `openBrowse()` in `85-browse.js` · `openItemForm()`,
`groupFieldHTML()`, `useItem()`, `applyItemUse()`, `itemQty()`,
`openItemUsePrompt()`, `addStatusByName()` in `80-modal-forms.js` · `resetItemUses()`,
`parseDiceExpr()`, `rollDiceExpr()` in `65-resources.js` · `renderCoins()`, `applyCoinInput()`,
`signedEntry()`, `coinKeys()`, `openCoinAdjust()`, `convertCoins()` in `66-coins-hp.js` ·
`logInv()`, `cleanInvLog()`, `logGrant()`, `logFinderAdd()`, `logItemSave()`, `logCoins()`,
`invSame()`, `invUndoShape()`, `invRemoveQty()`, `invRestore()`, `invUndoCheck()`, `invUndo()`,
`invLogHTML()`, `openInvLog()`, `setInvLogSize()`, `INV_FILTERS`, `coinsToCp()`, `cpToGpText()`, `itemWorthCp()`, `newTradeDraft()`,
`tradeClamp()`, `tradeBalance()`, `tradeHTML()`, `completeTrade()`, `showTrade()`, `tradeClosed()`, `openTrade()` in `67-trade.js` ·
`grantItemByName()` in `50-classrace.js` · markup `src/html/10-inventory.html` · **Data:**
[rules-schema §6.8](../../../../docs/rules-schema.md) · **Tests:** `sheet.js`, `char-update.js`,
`rules-data.js` · **See also:** [Armor & AC](armor-and-ac.md), [Attacks & damage](attacks-and-damage.md),
[Ammunition](ammunition.md), [Grants & provenance](../architecture/grants-and-provenance.md),
[Rules-update tool](rules-update-tool.md), [Vitals & rest](vitals-and-rest.md)

## How it works

**The item.** `{id, name, qty, description, effects, equipped}` plus optional `category`, `type`,
`cost` (a gp **number**), `weight` (lb per unit), `weapon`, `armor`, `uses`, `use`, `origin`, `fav`,
`sectionOverride`, `grant` (the granting sid), `attackId`, the `src` stamp, a launcher's or a
stack's ammunition fields `ammo` and `ammoStack`, and a top-level `recover` (`"always"` or
`"never"`, #104) — see [Ammunition](ammunition.md). `qty` may be `0`: the item editor's Quantity box
allows it (`min="0"`, no longer floored to 1 on save), for a Thrown weapon spent down to nothing or
any other item a player wants to zero out rather than delete. Effects apply only while `equipped` —
see [Computed stats & effects](../architecture/computed-stats-and-effects.md). The item editor's own
**Ammunition it fires** select (on a weapon) writes `weapon.ammo`, and its **Ammunition** toggle — a
**Kind** and a **Bonus to attack and damage** of +0 to +3 — writes `ammo`; Other… opens a box for a
kind not yet on the sheet. For ammunition or a Thrown weapon, an **After a fight** select writes
`recover` — the default ("Default (never comes back)" or "Default (always comes back)" when the
app has one for this item, else "Sheet's rule"), "Always comes back", "Never comes back"; it shows
exactly when Save would keep it, following the Weapon and Ammunition toggles. See
[Ammunition](ammunition.md).

**Sections.** `invSection(it)` files an item under one of `INV_ORDER` — Weapons, Armor, Consumables,
Magic Items, Tools, Gear, Loot — or a section of the player's own. A `sectionOverride` wins outright,
read through `invSectionName()`; otherwise it reads
`category` (else `type`): a `weapon` object or "weapon" → Weapons; `itemArmor()` or armor/shield →
Armor; then word-bounded alternations for potion/scroll/consumable/ammunition, wand/rod/staff/ring/
wondrous/focus, tool/kit/instrument/supplies/utensils; "gear" → Gear; else Loot. `invGroups()`
(pure) gives the sections in order: a starred item (`fav`) is lifted into `★ Favorites` (`INV_FAV`) at
the top, sorted by name, and appears **only** there; then the seven; then the player's own sections
A to Z, grouped by `tagKey()` and labelled by the first spelling met. Inside a section, equipped
items sort first, then by name. Section heads collapse (`invCollapse.sections`, keyed by title, a
player's section included); Collapse all folds item bodies (`invCollapse.items`). A player's section
is an `.inv-sec-head` like any other, so it folds and styles like the seven.

**Custom category.** The item form's Category is the group field (`groupFieldHTML()`, see
[Sections & layout](../ui/sections-and-layout.md)), the box the journal's tags use: it offers the
seven sections and any the player has made, a new one is typed, and left empty it reads
"Automatic (*the section the item's own data puts it in*)", worked out without the override.
`invSectionName()` reads what is typed: one of the seven in any case files there (a typed
"consumables" is Consumables, so it is still read for healing), anything else is the player's own
section tidied as a tag, blank is no override, and "★ Favorites" is not a section. It writes
`sectionOverride` — never `category`, which belongs to the pack entry. The form carries `category`
and `type` across an edit.

**Origin.** `ORIGIN_KINDS` has 13 kinds, each with a badge letter and a detail placeholder ("at
(place)", "from (who)"). `originBadge()` draws the letter; tapping it opens the kind, detail and the
date added. Items from a grant are tagged automatically from their sid (`originFromSid()`: B, C, A),
and a legacy item with only `grant` synthesizes one (`itemOrigin()`). In the form and the finder the
Detail box is **disabled** until a kind is chosen. `origin` is character-local: it is not in
`UPD_FIELDS`, so a rules update never touches it.

**Cost and value.** `costToGp()` parses the pack's display string ("15 gp", "2 sp", "1 gp 5 sp") into
gp. The row shows cost each, and its ×N quantity badge (`itemQty(it)!==1`) once qty is anything but
1 — a ×0 item (a Thrown weapon spent down, or any item zeroed by hand, #104) shows **×0** rather
than nothing, which used to look like ×1; the print sheet (`printSheet()`) counts the same way.
`inventoryTotal()` (Σ cost × qty, 2 dp) is the Total value
line, shown when above zero, and `itemWeightTotal()` (`itemWeight()` × qty) is what the carried
weight sums; both read quantity through `itemQty(it)` — never `num(it.qty)||1`, which read a ×0
item's quantity as 1 — so a ×0 item adds no value and no weight (#104 review).

**The item finder.** `browseItems()` is the shared picker ([Shell](../ui/shell.md)) over
`rules.items`: search on name/type/category/rarity, facets Category, Rarity and Needs attunement
from `itemFacets(lib)`, grouped by category, an "added" badge on what the sheet already has, a
preview that opens `openItemInfo(x)`, and "+ Custom" into the item form (which Add opens directly
when no items are loaded). `itemFacets()` and `openItemInfo()` are shared with the Rules tab's Items
category (#99), which filters and previews the very same way so the two can never disagree. Its footer — Origin, Detail, **Qty**,
Cost (gp) — applies to the whole batch and survives a filter redraw (`readFoot`/`writeFoot` inside
`openBrowse()`). The Cost override is read with `fnum()`, so 0.5 gp stays 0.5 gp. `addLibraryItems(entries, og, costOverride, qty)` stacks by name: an ammunition bundle unpacks first
(`unpackAmmo()`, [Ammunition](ammunition.md)) — ×2 of "Arrows (20)" adds 40 single arrows — then an
item already carried gains N, a new one is one stack of N with the meta line (`itemMetaLine()`)
prepended to its description, cost from the override or the listed price, weight, category, type,
weapon, a `src` stamp, and `equipped` set for weapons; a weapon gets one linked attack however many
are added. `finderQty()`: blank, 0, negative or text → 1, decimals floor, cap 999.

**Granted items** come from `grantItemByName()`: a bundle unpacks the same way, so starting
equipment's "Arrows (20)" grants 20 single arrows; otherwise the same copy with cost parsed through
`costToGp()` and category/type copied, tagged `grant: sid`, and removed again when the source goes —
see [Grants & provenance](../architecture/grants-and-provenance.md).

**The inventory log (#47).** Every change to items and coins writes one line to `character.invLog`
through `logInv()`, which stamps `id` and `at`, puts the line first and trims the log to
`invLogSize` (100 · 250 · 500 · 1,000 · 2,500, default 500; Settings → Sheet display → Inventory,
through `setInvLogSize()`: a smaller size trims at once, and asks first — "Keep the newest 100?
This removes 2,400 older lines." — when it would drop any; declined, the size stays).
A line is `{id, at, kind, title, lines, undo, undone, meta}`; `kind` is one of `trade`, `add`,
`edit`, `delete`, `use`, `coins`, `grant`, `ammo`, and `lines` are `{dir:"+"|"-"|"", text}`. The
writers, each exactly once per change:
- the finder's Add (`logFinderAdd()`): one `add` line for the whole batch, each item with its
  quantity and cost ("Rope ×2 · 2 gp");
- the item form (`logItemSave()`): `add` for a new item, with its cost; `edit` with copies of the
  item before and after, only when something on the form changed. `openItemForm()` builds the
  record in one function, `readRec()`, and takes a baseline from it as the form opens; Save writes
  no line when the record equals that baseline (`invSame()`, keys in any order). The baseline,
  not the stored item, is the comparison because the form fills in fields of its own — a potion's
  healing read from its description, armour's AC, a missing `used` or `qty` — and saves them;
- the row's 🗑: `delete`, with a copy of the item, its linked attack and both their indexes;
- `applyItemUse()`: `use`, saying what is left ("−1 · 2 left", "1 use · 2 of 3 left"), with a copy
  of the item, its attack and both indexes every time. A Use that only heals or applies a status
  changes no item and writes no line;
- Adjust, a coin box and Auto-convert (`logCoins()`): one `coins` line with the change per
  denomination, and none when nothing moved;
- grants (`logGrant()`): one "Granted by *source*" line per source, which folds in every grant from
  the same sid within 5 seconds, so a class's starting gear is one line; removing the source
  (`revertEquipmentGrants()`) writes one "Removed with *source*" line listing the items and gold
  that left, a `grant` line with `meta.revert` and no Undo — see
  [Grants & provenance](../architecture/grants-and-provenance.md);
- End combat: one `ammo` line per kind fired ("Arrows: 5 fired, 2 recovered", then "Fight of 3
  rounds"), from `ammoFightTotals()`, which counts what a row's Recover gave back during the fight
  too — see [Ammunition](ammunition.md);
- a completed trade: one `trade` line holding the whole receipt: each item with its cost ("Dagger
  ×1 (2 gp)"), each coin high to low (pp → cp), the totals, and the two switches.

Tapping an item's use pips is not logged: it changes uses, not quantity, as equipping and the
rests' resets don't.

The **Log** button on the Equipment card opens `openInvLog()`, a wide dialog: filters All, Trades,
Items (add, edit, delete, use, grant), Coins and Ammo (`INV_FILTERS`, remembered for the session;
`invInFilter()` also files a grant or "Removed with" line that moved gold under Coins),
lines grouped by day newest first, each with its kind's icon, the ± details in green and red, the
time, and Undo. A trade's details fold under Receipt (an "Undid:" line has none, so it draws
none). The filters and the foot stay put; the rows scroll between them in `.il-scroll`, as the
trade's sides do. The foot says how many lines are kept and holds **Clear log**, which confirms.

**Undo.** `invUndoCheck()` asks whether a line can still be reversed cleanly, and `invUndo()`
applies it as one step, marks the line `undone` (struck through and faded) and writes its own
"Undid: …" line with no undo. The check is exactly what the apply step can do, so an Undo that
passes always puts something back, and one that is refused changes nothing and marks nothing.
- `add` needs the item still there with at least the quantity added; records of one line that
  stacked onto one row are summed first ("It has since been used, sold or removed.").
- `edit` needs the item to still match the row as edited ("It has been changed again since.").
  An edit line keeps only what changed (`invEditUndo()`): each differing field's value before and
  after, and an `invHash()` fingerprint of the row as edited, so the check stays exact and Undo
  sets those fields back. A line saved with two whole copies is converted on load (`invEditU()`).
- `coins` needs every coin it would take back still in the purse ("Not enough GP left to take
  back.").
- `delete` puts its copy back.
- `use` adds the quantity or the use back to the row; if the row has gone since (deleted, sold,
  used up), it restores the copy with the quantity used. It is refused when nothing can give back
  what was used: an old line, from before every Use kept a copy, whose row is gone ("It is no
  longer in your inventory."), or a Use that spent only a use (a wand's charge) whose row is gone or
  has since lost its uses ("It has been changed again since.").
- `trade` checks every part before applying any. Its give part works as `use` does: back onto the
  row, or the copy with the quantity given (a trade keeps a copy of every given row). Inside a
  trade the reason names the item ("The Healing Potion you got has since been used, sold or
  removed.").

A copy comes back through `invRestore()`: at its old index, its attack at its own old index, with a
new id if the old one is taken, and — when it was granted by a source that has since been removed
(`grantSidLive()`) — as an ordinary item, its `grant` dropped and its origin kept. `cleanInvLog()`
drops an `undo` whose shape doesn't fit its kind (`invUndoShape()`), keeping the line, and
`invUndoCheck()` never throws. `grant` and `ammo` lines have no Undo: removing the source reverts a
grant, and End combat's recovery has its own Undo, in the End of combat window (#105).

**The trade window (#47).** **⇄ Trade** on the Equipment card opens `openTrade(opts)`, a wide
dialog over a draft (`newTradeDraft()`; `opts` may seed `{with, give, get}`). `opts.onClose` (#105)
is run once when the trade window closes for good, however it closes; the End of combat window's
Loot uses both, seeding `with` with the fallen and coming back on close (below).
- **With**: free text, and chips from the Party card and the names of earlier trades.
- **You give**: items picked from the inventory, each with a − / + stepper capped at what you own
  and its worth; a coin box per `coinKeys()` denomination, capped at what you hold; and an **Apply
  item value** switch. `tradeClamp()` holds the caps, on a seeded draft and again at Complete.
- **You get**: "+ Find an item" opens the same finder Add uses (its Origin select hidden; a trade
  stamps Traded) and brings the choice back here, merging by name; "+ Custom item" adds a name, a
  quantity and a cost; coin boxes; and its own Apply item value switch.
- **The balance** (`tradeBalance()`), worked in copper and shown in gp: what you give is its coins
  plus item worth when its switch is on; what you get, likewise. When the items you get are worth
  more than everything you give, it reads "N gp short" in red and Complete asks "You're N gp short.
  Complete the trade anyway?". Coins you receive never make it red: getting more than you give
  because of them (selling) reads "N gp in your favour", and Complete doesn't ask. Giving more
  reads "N gp over". It never blocks.
- **Complete** (`completeTrade()`) applies it as one step: given items are reduced or removed (and
  their attacks with them), coins move by the net per denomination, library items arrive through
  `addLibraryItems()` with origin Traded and the agreed cost, custom items with origin Custom
  ("traded from *who*"), then one `trade` line, a render and a save. An empty trade can't be
  completed; × and Escape on a non-empty draft ask "Discard this trade?".
- **Closing, and `onClose` (#105).** Cancel is `closeModal()` then `tradeClosed(null)`; Complete
  Trade is `completeTrade()`, `closeModal()`, the toast, then `tradeClosed(done)` with the trade's log
  line; ×, Escape and a backdrop tap reach it as the dismiss guard's hand-on (`setDismissGuard(…,
  ()=>tradeClosed(null))` in `showTrade()`), after "Discard this trade?" when the draft holds
  something — declining that keeps the trade open and runs nothing. `tradeClosed()` takes the hook
  (`_trOnClose`), clears it and the draft, and runs the hook once. The finder (`tradeFind()`) steps
  aside with `closeModal()`, never a dismissal, so it never runs it, and on its way back focuses the
  Equipment card's ⇄ Trade only for a trade with no `onClose` (one with an opener of its own hands
  focus back there). `openTrade()` with no `onClose` drops any earlier opener's hook. The End of
  combat window's seeded `with` is capped at the With box's 60 characters, since a seeded value gets
  past `maxlength`.
- **Layout**: the two sides side by side above 700px, with Cancel and Complete Trade at the foot;
  at 700px and under, tabs "You give · n" and "You get · n" and a ✓ button labelled "Complete
  trade". The balance is always in view. Every target is at least 44px.

**Weight and encumbrance.** All measured values use `fnum()` (parseFloat), never `num()`.
`carriedWeight()` is items × qty plus coins (50 to the pound, every denomination held, unless
`coinWeight` is off), **rounded to 2 dp before any comparison**. `encState()` is the one function
every consumer reads: mode `none` (the default), `standard` (over capacity: speed becomes 5; past
double: cannot move) or `variant` (−10 ft past ⅓, −20 ft past ⅔, then the standard limits), where
capacity is STR × 15 × the size multiplier. `encSpeed()` applies it in `recompute()` *after* the
numeric effects. The header pill and the Carried weight / Capacity rows show it; the settings live in
Settings → Carrying, and size in [Vitals & rest](vitals-and-rest.md).

**Item uses.** `it.uses = {max, per, used}` is the feature shape, so `usesMax()` and the pips read
both; `resetItemUses()` runs on a long rest (short + long) and a short rest (short); `per:"none"` is
reset by the pips only. `it.use = {heal, status, consume}` is what Use does; when absent,
`detectItemUse()` reads "regains 2d4 + 2 Hit Points" from a **Consumables-section** item only.
`use:{off:true}` records that the player cleared a detected use. `useItem()` refuses when uses or
quantity are out; a dice heal opens `openItemUsePrompt()` (type what the table rolled, or Roll for
me), where the box holds the dice total and the flat bonus is added once. `applyItemUse()` heals
through `adjustHP()`, switches a status on by name (`addStatusByName()`), spends a use, consumes one
(the last one removes the row and its attack) and summarises. The editor refuses a heal that
`parseDiceExpr()` cannot read.

**Coins.** The card lists `coinKeys()` high to low — PP GP EP SP CP (D&D), GP SP CP (Humblewood);
display order only. Each box takes `signedEntry()` grammar: a number sets, `+10` adds, `-5` spends,
empty clears, anything else is rejected and the old value restored; never below zero. Boxes are
`type="text" inputmode="tel"`, **not** `data-path`, and commit on change or Enter (`applyCoinInput()`).
**Adjust** (`openCoinAdjust()`) takes a signed amount per coin, previews the totals, and plans the
whole transaction before applying any of it: Apply stays disabled while an entry is not a number or
would overdraw, and the message names the short coin. **Auto-convert** (`convertCoins()`) totals in
copper and re-issues the largest coins (electrum is read but never produced). Coin changes re-render
the inventory and recompute, because coins have weight.

## Rules that must hold

- **`sectionOverride` never clobbers `category`.** The pack's category drives filing, and the
  rules-update tool compares copies against pack entries.
- **`invSection()`'s alternations are word-bounded.** They are load-bearing, not tidy — see Traps.
- **Every rebuild-from-form save carries what the form does not ask about**: `category`, `type`,
  `grant`, `attackId`, `fav`, `src`, an untouched `armor`, `uses.used` (clamped), and a weapon's
  `notes`, `atkMisc` and `dmgMisc` (from the pack entry just inserted, else the item's own). Losing
  `src` sends the rules-update tool down its name-only legacy path.
- **`itemMetaLine()` is frozen.** It is shared with `updProject()`; changing its output flips the
  description fingerprint of every browse-added item on every sheet. A test pins its exact output.
- **Cost on the sheet is a number**; the pack's is a string. Every copy path parses with `costToGp()`
  — `fnum("1 gp")` is 0.
- **Weight is rounded before comparison**, and encumbrance is never an effect: two of its three
  outcomes replace speed rather than adjust it, and disadvantage is not a number.
- **Nothing is ever blocked** by weight; past the hard limit the app says so.
- **Explicit use wins** over the detected one, and a cleared detected use is recorded, or it could
  never stick.
- **Coin and HP boxes are not `data-path`** — that handler writes on every keystroke and would store
  `"+"` the moment it was typed.
- **Adjust's listener is installed once** on `#mBody`, which outlives every modal (`_adjWired`).
- **Deleting an ammunition stack forgets its spent count** (`forgetAmmo()`): there is nothing left
  to recover into, and the player chose to delete it — see [Ammunition](ammunition.md).
- **One change, one log line.** Every item and coin writer calls its log helper exactly once, and
  an unchanged form save, a coin entry that moves nothing, or a Use that only heals writes none.
- **The item form compares against its own baseline,** never against the stored item: Save writes
  a line only when `readRec()` returns something other than it did as the form opened.
- **An Undo never succeeds while restoring nothing.** The check matches the apply step, and Use
  and a trade's give always keep a copy to restore from.
- **The log never writes itself** except through Undo and Clear log; the dialog only reads it.
- **Cost is gp of one and may be fractional:** every cost read in the log and the trade goes
  through `fnum()` (an arrow is 0.05 gp), and money is worked in whole copper.
- **Giving is capped at what you own,** items and each denomination, in the window and again at
  Complete.
- **A trade undoes as one step or not at all,** and its given rows come back newest removal first,
  because each recorded index was read with the earlier removals already gone.

## Traps

- **A typed origin detail with no kind was silently dropped**, because `og` is only built when a kind
  is set; hence the disabled box. `originOptionsHTML()`'s `includeClass` flag was deleted, not
  honoured: hiding Class would make a class-granted item's own origin unselectable. → L74
- **Granted equipment had no cost** — `grantItemByName()` never read `def.cost`, which is a string
  where weight is a number. Copying `category`/`type` then filed every rope under Magic Items,
  because "Adventu*ring* Gear" contains `ring`; `\b` fixed it and stopped "Quarterstaff" matching
  `staff`. `invSection()` had no tests, which is how the misfiling shipped. → L1444
- **`num()` on pounds and coins** turned a 0.05 lb arrow and a 1 sp item into 0. → L1361
- **20 arrows weighed 1.0000000000000002 lb** and read as over a capacity of exactly 1. → L1361
- **The item form dropped `fav` and `src`** on every save. → L1361
- **`updChangedFields` compared `now[f] !== then[f]`**, so adding `weight` to `UPD_FIELDS` would have
  flagged every stamped item; no baseline is now not a change. → L1361
- **`type=number` rejects a leading `+`**, and iOS's numeric keypad has no sign keys. → L1143
- **A finder redraw reset the footer** (Origin and Cost always had; Qty made it noticeable). → L3503
- **Insert from rules pack dropped a weapon's `+N`** and its notes: the form carried
  `atkMisc`/`dmgMisc`/`notes` only from the item being edited. A pack effect that double-counted the
  bonus hid it; when #74 removed the effect, the inserted Dagger of Venom would have had no +1. → L4392
- **The inventory caret pointed left when open**: drawn down, then rotated again by the shared
  `.fcaret`. → L3525
- **Before #104, the Quantity box floored to 1 on save**, so editing a thrown weapon already at ×0
  (nothing else touched) turned it back into ×1. Found while planning #104, not caught by Playwright
  — the fixture never saved a ×0 item. The box now allows `0` end to end: `min="0"` and the save
  reading `Math.max(0, num(v))` rather than `num(v)||1`. → L6081, #104
- **The finder's Cost override read `num()`**, so 0.5 gp became 0 on every Add, not only in the
  trade. → L7291, #47
- **The wide dialog's body is a flex column that does not scroll** (built for Settings' own
  scrollers). The log sat straight in it, so a long log squashed its rows into each other and the
  rest could not be reached; only a log longer than one screen showed it. → L7291, #47
- **Undoing two whole rows in recorded order swapped them**: each `at` was read after the earlier
  removal, so they must go back newest first. → L7291, #47
- **Use and a trade's give kept a copy only when they removed the row,** and the check called
  both "always clean". Use 1 of 2 potions then delete the other, or give 2 of 5 arrows then fire
  the other 3 to zero, and Undo reported success while restoring nothing — the trade took back its
  coins and left the arrows lost. → L7339, #47
- **The item form's Save rebuilt the record and compared it with the stored item,** so every field
  the form fills in on its own (healing read from a description, armour's AC, `used:0`, `qty:1`)
  read as an edit on the first unchanged Save. The suite only grepped for `logItemSave(`; the
  fixed test drives the real form through a small DOM. → L7339, #47
- **The log's scroll was a `:has()` rule on the dialog body**, which a browser without `:has()`
  never applied. → L7339, #47

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where a custom item's section is stored | `sectionOverride` | Writing `category`: clobbers a library item's own category |
| What a category can be (#98) | One of the seven, in any case, or a section of the player's own, typed in the group field the journal's tags use | The select of seven: Mike asked for the journal's tag pattern everywhere a source or category is set |
| Where the player's own sections go (#98) | After the seven, A to Z | Interleaved A to Z with the seven: Weapons and Armor would no longer lead |
| Starred items | Shown only in `★ Favorites` | Also in their section: duplication |
| Encumbrance default | `"none"` | `"standard"`: drops a hoarding character to 5 ft on upgrade, with no warning (owner's call) |
| Encumbrance as an effect | No — applied in `recompute()` after the effects | An effect: renders as an editable chip, and cannot say "speed becomes 5" or "disadvantage" |
| Weight on the copy | A numeric field; `itemMetaLine()` untouched | Changing the meta line: flags every browse-added item as changed forever |
| `category`/`type` in `UPD_FIELDS.item` | Left out | Adding them: silently baselined rather than backfilled, and two more fields in every fingerprint |
| Auto-detecting charges ("7 charges") | No | Phrasing varies too much; a wrong guess is worse than a blank box |
| Coins: inline entry and Adjust | Both | Either alone: each covers the other's weakness |
| Reading `"1 2"` in a coin box | Rejected | Coercing to 12: quietly rewrites someone's gold |
| What the inventory log records (#47) | Every item and coin change: trades, adds, edits (only when something changed), deletes, Use, coin changes, grants, and one ammunition line per kind per fight | Adds and removes only: an edited quantity would leave no trace. One line per shot: floods the log |
| Where the log lives (#47) | A Log button on the Equipment card, opening a dialog | A collapsible card at the bottom of Inventory: the tab is already long |
| How long the log is (#47) | Per character, `invLogSize` 100 · 250 · 500 · 1,000 · 2,500, default 500 | A fixed 1,000: Mike wants it settable. Everything: grows forever |
| What can be undone (#47) | Any line that can still be reversed cleanly; otherwise Undo is disabled with the reason. Not grants (removing the source reverts them) nor ammo (recovery has its own Undo) | Newest only: a trade three changes back couldn't be reached |
| How far Use is undoable (#47) | Always, from a copy of the item kept at every Use (and every trade's give); refused only when nothing can give it back: an old line with neither a row nor a copy, or a uses-only Use whose row is gone or lost its uses | Only while the item exists (the spec): a used-up potion couldn't come back. A copy only when the Use removed the row: Undo then did nothing once the row went another way |
| What removing a source logs (#47) | One "Removed with *source*" line listing the items and gold that left, no Undo | No line: a class's whole kit vanished without a trace. An Undo: granting again belongs to the source |
| A row's Recover in the log (#47) | Counted in that fight's End combat line; no line of its own | A line per Recover: one more line per tap. Not counted: the fight's line under-reported |
| Item-use pips in the log (#47) | Not logged: they change uses, not quantity, as equipping and rest resets do | A line per pip: Use already logs the deliberate spend |
| Lowering the log size (#47) | Trims at once, asking first when lines would go | At the next write (the spec): a mis-tap still drops the lines, later and silently |
| A trade's balance (#47) | Coins, plus item worth or cost on each side whose Apply item value switch is on; short (the items you get worth more than all you give) is red and confirms; coins received never make it red | Coins only: bartering is common. Editable worth per item: more than asked for |
| A shortfall (#47) | Shown and confirmed, never blocked | Blocking Complete: gifts and haggling couldn't be recorded |
| The trade's layout (#47) | Side by side above 700px; tabs and a ✓ button at 700px and under | One list: mixes giving and getting |
| Other parties (#47) | Free text with chips from the Party card and earlier trades | A managed contact list: more than a trade needs |
| How an edit line is stored (#47) | Only the changed fields, before and after, plus a fingerprint of the row as edited | Two whole copies (as built first): 500 lines of a magic item took 2.3 million characters of a ~5 MB browser limit shared by every character |
| A custom item's origin in a trade (#47) | Custom, "traded from *who*"; library items get Traded | Traded for both: the spec names Custom for custom items |

## Open

- **Insert from rules pack in the item form** copies name, description, cost, weight, effects,
  weapon (its notes and `+N` included), armor and healing, but not `category`, `type` or a `src`
  stamp — so the item files by inference and the rules-update tool can only match it by name. The
  finder does all three.
- Stacking by name ignores the batch's origin and cost for an item already carried.
- Use does not remove conditions (Elixir of Health) and prints nothing on the sheet.
- Humblewood species all read Medium until the extractor learns sizes.
- **The log's Use, give and delete lines each keep one whole copy of the item** (#47), so a long
  log of them is still large — see [Known issues](../roadmap/known-issues.md).
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Starting-equipment grants land items with linked attacks and revert cleanly. → ledger L42
- 2026-08-07 — Origin badges on items and spells; per-item cost and a Total value line. → ledger L153
- 2026-08-07 — The finder gains origin detail and cost; cost defaults to the listed price (`costToGp()`). → ledger L229
- 2026-08-07 — Inventory sections, favourites, equipped-first sorting. → ledger L256
- 2026-08-07 — Custom category via `sectionOverride`. → ledger L276
- 2026-08-10 — Coins take `+10` / `-5`; the Adjust transaction. → ledger L1143
- 2026-08-11 — Item weight, carried weight, encumbrance and character size; `fnum()`. → ledger L1361
- 2026-08-11 — Granted items get cost, category and type; `invSection()` word boundaries. → ledger L1444
- 2026-08-11 — `coinEntry` renamed `signedEntry()`: the same grammar now serves the HP boxes. → ledger L1614
- 2026-08-17 — Item uses and the Use button: heal, status, consume. → ledger L2818, #25
- 2026-09-01 — Origin controls polished; a detail with no kind can no longer be lost. → ledger L74, #14
- 2026-09-24 — Qty in the item finder; the footer survives a redraw. → ledger L3503, #50
- 2026-09-24 — Coins high to low; one section-heading style; a clear button in the finder's search. → ledger L3525, #48, #51, #49
- 2026-09-28 — Insert from rules pack keeps a weapon's `+N` and notes. → ledger L4392, #74
- 2026-10-02 — Ammunition: launchers fire from a loaded stack with Undo, bundles unpack on arrival, recovery at End combat and on the row, the loaded +N. → ledger L4952, #6
- 2026-10-02 — The item editor sets what a weapon fires and marks ammunition, with a bonus; Insert from pack unpacks a bundle. → ledger L4978, #8
- 2026-10-16 — Category is the shared group field: a section of the player's own, or one of the seven in any case. → ledger L5823, #98
- 2026-10-19 — `recover` joins the item shape; the editor's Quantity allows 0; totals and the ×N badge read quantity through `itemQty()`. → ledger L6081, #104
- 2026-10-19 — The "After a fight" select's labels as built, and it follows the form's current weapon; the print sheet counts a ×0 item. → ledger L6147, #104
- 2026-10-22 — The item finder's facets and preview become `itemFacets()` and `openItemInfo()`, shared with the Rules tab's Items category. → ledger L6327, #99
- 2026-10-23 — Attacks & Weapons heads the tab, above Equipment & Inventory. → ledger L6633, #103
- 2026-10-24 — The ☰ section flyout is retired, so a section is no longer listed anywhere. → ledger L6804, #103
- 2026-10-25 — The trade window and the inventory log: one log line per item and coin change, Undo, the Log dialog and its size setting; the finder's Cost override keeps fractions. → ledger L7291, #47
- 2026-10-25 — Final review: Undo never succeeds while restoring nothing; an unchanged form Save writes no line; removing a source and a row's Recover are logged; costs, pp → cp and "what is left" in the lines; the log scrolls in its own box; the size confirm. → ledger L7339, #47
- 2026-10-25 — Re-review: an `add` undo sums the records that stacked onto one row; Use's refusals stated in full. → ledger L7387, #47
- 2026-10-25 — Edit lines keep only what changed; coins received never make a trade red; grant lines that moved gold file under Coins. → ledger L7401, #47
- 2026-10-29 — `openTrade({onClose})` and `tradeClosed()`: the hook runs once however the trade closes (Cancel, Complete Trade, ×, Escape, a backdrop tap), never for the finder; the End of combat window's Loot seeds `with` with the fallen and comes back on close. → ledger L7921, #105
- 2026-10-29 — The finder's way back focuses ⇄ Trade only for a trade with no `onClose`; Loot's seeded `with` is capped at 60 characters. → ledger L8025, #105
