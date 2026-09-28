# Inventory

The Inventory tab: everything the character carries, filed into sections, with where each thing came
from, what it cost, what it weighs, whether it is worn, and — for potions, wands and the like — a
**Use** button. Below it, the Coins card. Items arrive from a rules pack through the item finder,
from starting-equipment grants, or typed in by hand; each is a *copy* of the pack entry, so the sheet
can carry the player's own fields (quantity, origin, favourite, filing) alongside the rules-owned ones.

**Code:** `renderInventory()`, `invItemHTML()`, `invSection()`, `invTotalsHTML()`, `renderEncPill()`,
`itemUse()`, `detectItemUse()`, `itemUsesRowHTML()` in `40-sheet.js` · `ORIGIN_KINDS`,
`originBadge()`, `originFromSid()`, `itemOrigin()`, `originOptionsHTML()`, `itemMetaLine()`,
`costToGp()`, `inventoryTotal()`, `itemWeight()`, `coinsWeight()`, `carriedWeight()`, `encState()`,
`encSpeed()` in `25-origins-items.js` · `browseItems()`, `addLibraryItems()`, `finderQty()`,
`openBrowse()` in `85-browse.js` · `openItemForm()`, `useItem()`, `applyItemUse()`,
`openItemUsePrompt()`, `addStatusByName()` in `80-modal-forms.js` · `resetItemUses()`,
`parseDiceExpr()`, `rollDiceExpr()` in `65-resources.js` · `renderCoins()`, `applyCoinInput()`,
`signedEntry()`, `coinKeys()`, `openCoinAdjust()`, `convertCoins()` in `66-coins-hp.js` ·
`grantItemByName()` in `50-classrace.js` · markup `src/html/10-inventory.html` · **Data:**
[rules-schema §6.8](../../../../docs/rules-schema.md) · **Tests:** `sheet.js`, `char-update.js`,
`rules-data.js` · **See also:** [Armor & AC](armor-and-ac.md), [Attacks & damage](attacks-and-damage.md),
[Grants & provenance](../architecture/grants-and-provenance.md),
[Rules-update tool](rules-update-tool.md), [Vitals & rest](vitals-and-rest.md)

## How it works

**The item.** `{id, name, qty, description, effects, equipped}` plus optional `category`, `type`,
`cost` (a gp **number**), `weight` (lb per unit), `weapon`, `armor`, `uses`, `use`, `origin`, `fav`,
`sectionOverride`, `grant` (the granting sid), `attackId` and the `src` stamp. Effects apply only
while `equipped` — see [Computed stats & effects](../architecture/computed-stats-and-effects.md).

**Sections.** `invSection(it)` files an item under one of `INV_ORDER` — Weapons, Armor, Consumables,
Magic Items, Tools, Gear, Loot. A valid `sectionOverride` wins outright; otherwise it reads
`category` (else `type`): a `weapon` object or "weapon" → Weapons; `itemArmor()` or armor/shield →
Armor; then word-bounded alternations for potion/scroll/consumable/ammunition, wand/rod/staff/ring/
wondrous/focus, tool/kit/instrument/supplies/utensils; "gear" → Gear; else Loot. A starred item
(`fav`) is lifted into `★ Favorites` at the top, sorted by name, and appears **only** there. Inside a
section, equipped items sort first, then by name. Section heads collapse (`invCollapse.sections`,
keyed by title); Collapse all folds item bodies (`invCollapse.items`).

**Custom category.** The item form's Category select offers "Automatic (*the section it would fall
into*)" plus the seven sections, and writes `sectionOverride` — never `category`, which belongs to the
pack entry. The form carries `category` and `type` across an edit.

**Origin.** `ORIGIN_KINDS` has 13 kinds, each with a badge letter and a detail placeholder ("at
(place)", "from (who)"). `originBadge()` draws the letter; tapping it opens the kind, detail and the
date added. Items from a grant are tagged automatically from their sid (`originFromSid()`: B, C, A),
and a legacy item with only `grant` synthesizes one (`itemOrigin()`). In the form and the finder the
Detail box is **disabled** until a kind is chosen. `origin` is character-local: it is not in
`UPD_FIELDS`, so a rules update never touches it.

**Cost and value.** `costToGp()` parses the pack's display string ("15 gp", "2 sp", "1 gp 5 sp") into
gp. The row shows cost each; `inventoryTotal()` (Σ cost × qty, 2 dp) is the Total value line, shown
when above zero.

**The item finder.** `browseItems()` is the shared picker ([Shell](../ui/shell.md)) over
`rules.items`: search on name/type/category/rarity, facets Category, Rarity and Needs attunement,
grouped by category, an "added" badge on what the sheet already has, preview, and "+ Custom" into the
item form (which Add opens directly when no items are loaded). Its footer — Origin, Detail, **Qty**,
Cost (gp) — applies to the whole batch and survives a filter redraw (`readFoot`/`writeFoot` inside
`openBrowse()`). `addLibraryItems(entries, og, costOverride, qty)` stacks by name: an item already
carried gains N, a new one is one stack of N with the meta line (`itemMetaLine()`) prepended to its
description, cost from the override or the listed price, weight, category, type, weapon, a `src`
stamp, and `equipped` set for weapons; a weapon gets one linked attack however many are added.
`finderQty()`: blank, 0, negative or text → 1, decimals floor, cap 999.

**Granted items** come from `grantItemByName()`: the same copy with cost parsed through `costToGp()`
and category/type copied, tagged `grant: sid`, and removed again when the source goes — see
[Grants & provenance](../architecture/grants-and-provenance.md).

**Weight and encumbrance.** All measured values use `fnum()` (parseFloat), never `num()`.
`carriedWeight()` is items × qty plus coins (50 to the pound, every denomination held, unless
`coinWeight` is off), **rounded to 2 dp before any comparison**. `encState()` is the one function
every consumer reads: mode `none` (the default), `standard` (over capacity: speed becomes 5; past
double: cannot move) or `variant` (−10 ft past ⅓, −20 ft past ⅔, then the standard limits), where
capacity is STR × 15 × the size multiplier. `encSpeed()` applies it in `recompute()` *after* the
numeric effects. The header pill and the Carried weight / Capacity rows show it; the settings live in
Settings → This character, and size in [Vitals & rest](vitals-and-rest.md).

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

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where a custom item's section is stored | `sectionOverride` | Writing `category`: clobbers a library item's own category |
| Starred items | Shown only in `★ Favorites` | Also in their section: duplication |
| Encumbrance default | `"none"` | `"standard"`: drops a hoarding character to 5 ft on upgrade, with no warning (owner's call) |
| Encumbrance as an effect | No — applied in `recompute()` after the effects | An effect: renders as an editable chip, and cannot say "speed becomes 5" or "disadvantage" |
| Weight on the copy | A numeric field; `itemMetaLine()` untouched | Changing the meta line: flags every browse-added item as changed forever |
| `category`/`type` in `UPD_FIELDS.item` | Left out | Adding them: silently baselined rather than backfilled, and two more fields in every fingerprint |
| Auto-detecting charges ("7 charges") | No | Phrasing varies too much; a wrong guess is worse than a blank box |
| Coins: inline entry and Adjust | Both | Either alone: each covers the other's weakness |
| Reading `"1 2"` in a coin box | Rejected | Coercing to 12: quietly rewrites someone's gold |

## Open

- **Insert from rules pack in the item form** copies name, description, cost, weight, effects,
  weapon (its notes and `+N` included), armor and healing, but not `category`, `type` or a `src`
  stamp — so the item files by inference and the rules-update tool can only match it by name. The
  finder does all three.
- Stacking by name ignores the batch's origin and cost for an item already carried.
- Ammunition comes in bundles ("Arrows (20)"); unpacking belongs to #6–#8.
- Use does not remove conditions (Elixir of Health) and prints nothing on the sheet.
- Humblewood species all read Medium until the extractor learns sizes.
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
