# Grants & provenance

Taking an ancestry, background, class, subclass or feat copies what it grants onto the sheet:
features, skill and save proficiencies, starting equipment and gold, and the choices it offers.
Every copy is tagged with where it came from. Removing the source removes exactly those copies and
nothing the player added themselves. That is **clean revert**, and it is why a player can swap a
background or drop a class without hand-cleaning the sheet.

**Code:** `originSid()`, `grantProf()`, `removeGrants()`, `grantedProf()`, `grantSources()`,
`sidLabel()`, `effSkill()`, `effSaveProf()` in `00-constants.js`; `addFeatureFromDef()`,
`removeFeaturesWhere()`, `grantItemByName()`, `addGrantGold()`, `applyEquipOption()`,
`applyEquipGrants()`, `revertEquipmentGrants()`, `grantFeatDef()`, `runExtraChoices()` in
`50-classrace.js`; `applyRace()`, `removeRace()` in `52-race.js`; `applyBackground()`,
`removeBackground()` in `54-background.js`; `addClass()`, `applyClassLevel()`, `removeClass()`,
`grantClassSaves()`, `multiclassChoices()`, `selectSubclass()`, `doLevelDown()`, `seedLevel1HP()` in
`56-class.js`; `runChoices()`,
`commitChoices()`, `sidToOrigin()` in `58-choices.js`; `originFromSid()`, `itemOrigin()`,
`costToGp()` in `25-origins-items.js`; `syncResources()` in `65-resources.js`;
`forgetGrantAmmo()` in `62-ammo.js`; `logGrant()`, `grantSourceName()` in `67-trade.js`; `grantLanguages()`, `dropLanguages()`, `langParse()` in
`41-chips.js` · **Tests:**
`char-update.js` (grant and revert, `grantItemByName()` called for real, the pending equipment
picker travelling with its window, the order the choice windows open in), `sheet.js` (`invSection()` filing) · **See also:** [Character building](../features/character-building.md),
[Inventory](../features/inventory.md), [Ammunition](../features/ammunition.md),
[Class resources](../features/class-resources.md),
[Rules-update tool](../features/rules-update-tool.md)

## How it works

**Source ids.** A proficiency or item grant is keyed by a *sid*:

| sid | Written by |
|---|---|
| `race:<Name>` | `applyRace()`, and the ancestry's traits and skill choices |
| `bg:<Name>` | `applyBackground()` |
| `class:<Name>` | `addClass()` (saves, skills and equipment only for the first class), class-level choices, a multiclass's `multiclass` skill choice |
| `subclass:<Class>:<Sub>` | subclass-level choices and traits |

`originSid()` derives a sid from a feature's `origin`, and `sidToOrigin()` goes the other way for a
picked option.

**What is granted, how it is tagged, and what takes it back:**

| Grant | Stored as | Tagged by | Reverted by |
|---|---|---|---|
| Features and traits, ability increases, feats, options | `features[]` | `origin`: `{kind:"race"\|"background", name}` or `{kind:"class", class, level, subclass?}` | `removeFeaturesWhere()` on that origin |
| Skill and save proficiencies | `grants[]` as `{sid, type, key, level}` | `sid` | `removeGrants()` on that sid |
| Starting equipment, and the attacks it made | `inventory[]` with `grant: sid`; attacks linked by `itemId` | `grant` | `revertEquipmentGrants()`, which also forgets each removed item's spent-ammunition count, and — by the snapshot's own `grant`, through `forgetGrantAmmo()` — a granted stack already fired down to nothing and so already gone before the source is removed |
| Starting gold | added to `coins.gp` and recorded in `grantGold[sid]` | `sid` | `revertEquipmentGrants()`: subtracts exactly that amount, never below 0 |
| Class resource pools | `resources[]` with `auto:true` and a `class:`/`subclass:` key | `key` | `syncResources()` on every `recompute()`: an auto pool whose class or subclass is gone is dropped |
| Languages (#103) | `languages[]` chips `{id, name, src}` | `src`: `race:<Name>` or `bg:<Name>`, the grant's own sid | `dropLanguages()` on that src, in `removeRace()` / `removeBackground()` |
| Level-1 max HP | `hp.max` / `hp.cur` | nothing: recognised by value | `removeClass()` blanks it only if the box still holds exactly `level1HP()` |

**Proficiencies are layered, never merged.** The player's own dots live in `character.skills` and
`character.saves`, and grants live in `character.grants`. `effSkill()` takes the higher of the two
and `effSaveProf()` either. `grantProf()` keeps one record per sid, type and key. Its `level` is
proficiency *depth* (1 proficient, 2 expertise), not a class level. Removing a source therefore
never touches a proficiency the player set by hand, and the stat breakdown names the source through
`grantSources()` → `sidLabel()`.

**Features.** `addFeatureFromDef(t, origin)` copies the name, description, effects, `uses` and
`cost`, stamps the copy for the rules-update tool, and grants the entry's own `skills`/`saves` to
`originSid(origin)`. `grantFeatDef()` wraps a feat as a feature named `Feat: <name>`, forwards its
`uses` and `cost`, re-stamps it against the real feat entry (the wrapper has no pack and the wrong
name), and queues the feat's skill `choices`.

**Equipment.** `equipmentGrants` is read on races, backgrounds and classes — a class's only when
it is the character's first (#66): a multiclass add grants no equipment and no gold. A fixed block
applies at once through `applyEquipOption()`. A `choose` block is queued as a pending picker. `grantItemByName()` matches the loaded item list by name,
case-insensitively, and copies `description`, `effects`, `weapon`, `weight`, `category`, `type` and
**`cost` through `costToGp()`**, because the pack stores cost as a display string ("2 gp") and the
sheet as a gp number. A bundle unpacks into its pieces the same way the finder does (`unpackAmmo()`),
so "Arrows (20)" grants 20 single arrows, each tagged with the grant's `sid` — see
[Ammunition](../features/ammunition.md). It stamps the copy, and a weapon gets its attack. An
unmatched name becomes a plain named item. A second grant of the same name from the same sid adds to
the quantity. The item's origin badge (C, B or A) comes from `originFromSid()`.

**The grant's line in the inventory log (#47).** `grantItemByName()` and `addGrantGold()` each
report what they added through `logGrant(sid, line)` in `67-trade.js`, which writes one `grant`
line per source to the [inventory log](../features/inventory.md) — "Granted by Fighter", the source
read from the sid by `grantSourceName()` — and folds in every later grant from the same sid within
5 seconds, so a class's starting gear and gold are one line. The line has no Undo: removing the
source is what reverts a grant. `revertEquipmentGrants()` writes one line of its own, "Removed
with Fighter", listing the items and the gold that actually left (a `grant` line with
`meta.revert`, filed under Items as a grant is, and never folded into by a later grant), and none
when the source had granted nothing. It has no Undo either: granting again belongs to the source.
An Undo elsewhere in the log that brings back an item granted by a source now gone (a trade that
gave the Rope away, undone after the class was removed) restores it as an ordinary item, its
`grant` dropped and its origin kept, since nothing could ever revert that grant.

**Languages** (#103). A species or background whose definition lists `languages` (a string,
"Common, Elvish and one other language of your choice") grants them as chips: `langParse()` splits on
commas, "and" and semicolons and skips an entry that names a choice ("one", "other", "any", "choice"),
which the player adds by hand; `grantLanguages()` stamps each with the grant's sid. A language the
sheet already has keeps its own source — the player's, an earlier grant's or the ruleset's — so a
name the player also added stays theirs when the grant goes. A granted chip shows its source
("· species", "· background") and has no ×: it is the grant's to take back. Nothing is appended to
`proficiencies` for languages any more; a sheet's old "Languages: …" lines become the player's own
chips once, in `migrate()` ([Character model](character-model.md)). Their grant cannot be recovered,
so they stay after a species or background change (a known issue, not a bug). A `src` the sheet does
not know (hand-edited) reads as the player's: `chipSrcLabel()` looks up own keys only, and
`chipClean()` clears it, so the chip's × and `removeChip()` agree.

**Choices.** Skill choices on a race, a race trait or a feat, and feat choices on a species or a
background (#118), go into a `pending` list that `runExtraChoices()` presents after the add. Each
pick is granted to the sid that queued it: `commitExtraChoices()` grants a feat with
`sidToOrigin()`'s `{kind:"race"}` or `{kind:"background"}` origin, so changing or removing the
species or background reverts it. A feat taken at an ASI carries its class-level origin, and its +1
is an effect on that same feature.
Class and subclass level choices go through `runChoices()` → `commitChoices()`: skills to the
choice's sid, an ASI as a feature, a feat through `grantFeatDef()`, an option through
`addFeatureFromDef()` with `sidToOrigin()` (so it reverts with its class or subclass) and its
`cost` forwarded. A picked subclass is applied by `selectSubclass()` after the rest, and its own
window opens before anything else queued. What waits behind a window (the class's starting-equipment
picker, and the skill choices of feats picked on the way) is passed **with the window** as `pending`,
from `runChoices()` to its own Done to `commitChoices()`, which hands it on to the subclass's window
or else to `runExtraChoices()`. A dismissed window hands it on too, so a class already on the sheet
always gets its equipment picker. The flow is on
[Character building](../features/character-building.md).

**The first class grants what a multiclass does not.** Saving throws, fixed class skills,
starting equipment and gold, and the full level-1 skill choice come only from the class added while
none was on the sheet. A later class gets its level-1 features and the pack's `multiclass` skill
choice, all under its own `class:<Name>` sid, so removing it reverts exactly that. The table of who
gets what is in [Character building](../features/character-building.md).

**Removal and swapping.** `removeRace()`, `removeBackground()` and `removeClass()` each remove the
features by origin, the proficiencies by sid, and the equipment and gold by sid. `removeClass()`
also removes every `subclass:<Class>:` grant and un-seeds the level-1 HP. Removing the first class
while another remains hands the saving throws on: the class now first gets its own through
`grantClassSaves()`, under its own sid, so they revert with it in turn. `applyRace()` and
`applyBackground()` remove the previous one first. Changing a subclass removes the old subclass's
features and grants before applying the new one.

## Rules that must hold

- **Every grant carries its source, and every source has a revert.** A new kind of grant needs
  both, or the source can no longer be removed cleanly.
- **A multiclass add never grants what only the first class may**: no saves, no equipment, no gold,
  and no class-level-1 skill choice beyond the pack's `multiclass` block. Characters saved before
  this rule keep what their second class granted; `migrate()` does not strip it.
- **Revert never touches what the player owns:** an item without that `grant`, a proficiency the
  player set, a Max HP they typed, or gold beyond what that sid added.
- **`feature.origin` is structural.** It drives the revert predicates and `featGroupLabel()`.
  Features added from the browser get `origin:null` and land in "Other". Do not borrow the field
  for a display label: browse origins carry `detail`, not `name`, and would never match a revert
  predicate.
- **An item's `origin` is display only** (`{kind, detail, at}`, the badge). Item revert keys on
  `grant`. The two fields share a name and nothing else.
- **Sources are never re-applied wholesale.** Remove-then-add replays every level from 1 and
  destroys choices the app keeps no record of: ASI targets, skill picks, the subclass, the
  background feat, and the race ability spread. The rules-update tool therefore works per feature,
  spell and item.
- **The level-1 HP seed reads CON with `modOf()` on the score, not `abilFinal()`.** Effects come
  and go (un-equip a cloak), and the seed has to be recomputable unchanged when the class is
  removed. `resyncLevel1HP()` re-seeds when CON is edited so the match keeps landing.
- **What waits behind a choice window travels with it, and one window opens at a time.** Never park
  the queue in a module global, and never open a second window from a Done that already opened one.

## Traps

- **Granted equipment had no cost, and everything filed as Loot.** `grantItemByName()` never read
  `def.cost`. Weight worked because the pack stores weight as a number, while cost is a display
  string, and copying it raw would have been worse: `fnum("1 gp")` is 0. Then copying
  `category`/`type` fed `invSection()`'s **unanchored** substrings, and "Adventuring Gear"
  contains `ring`, which filed every rope and bedroll under Magic Items. `\b` boundaries fixed it.
  The test fixture had mirrored the buggy copy faithfully enough to hide it for a release, so the
  tests now call the real function.
- **The equipment leak.** The starting-equipment picker used to wait in a module global,
  `_equipQueue`. Closing an Add-class window without Done left it queued, and it popped up after the
  *next* level-up's Done. `char-update.js` now spies on `runExtraChoices()` through the vm context to
  prove it travels with its window.
- **A subclass's own choices were lost (#63).** `commitChoices()` opened the subclass's window and,
  in the same step, the equipment picker, which replaced it. Fighter 3 as a Battle Master was never
  offered maneuvers or Student of War. The queue now waits behind the subclass's window.
- **A picked option's cost was dropped:** `commitChoices()` did not pass `cost` into
  `addFeatureFromDef()`. It does now, because `useFeature()` spends from a resource matched by name.
- **Free-text proficiencies do not revert.** That is why Student of War's tool lands as a feature
  rather than in the Proficiencies box: as a feature, it leaves with the subclass.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How grants are undone | Provenance-tracked clean revert | — (L42) |
| How an origin's content is updated from a newer pack | Per feature, spell and item | Remove-then-add: replays from level 1 and destroys choices the app keeps no record of (L702) |
| Which CON the level-1 HP seed reads | `modOf()` of the score | `abilFinal()`: effects move under it, so un-equipping an item between add and remove silently stops the revert (L2035) |
| Where the starting-equipment picker waits | Passed with its window to its own Done, or on from its dismissal | A module global: it outlived a dismissed window and fired after the next level-up (L3649). Dropped with a dismissed window: a class already on the sheet lost its equipment (L3847) |
| Where Student of War's tool proficiency goes | A feature | The free-text Proficiencies box: it would not revert with the subclass (L3649) |
| Which class grants saves, equipment and gold | The first class only; a multiclass gets the pack's `multiclass` subset | Every `addClass()`: the 2024 multiclass rules give neither (L3886, #66) |
| Removing the first class while another remains | The new first class takes its saving throws, under its own sid | Leaving the sheet with no save proficiencies (L3886) |
| Stripping extra grants from multiclass characters saved earlier | No: `migrate()` is untouched | Retroactive strip: it would silently change sheets players have been playing (L3886) |
| How a species or background grants languages (#103) | Chips stamped with the grant's sid, removed with it; a choice ("one of your choice") is the player's to add | Appending "Languages: …" to Proficiencies: it never reverted. Player-entered only: grants would keep writing prose |
| What the inventory log records for a grant (#47) | One line per source, no Undo | One line per item: a class's starting gear floods the log. An Undo: it would take back part of a grant the source still claims; removing the source reverts it |
| What the log records when a source is removed (#47) | One "Removed with *source*" line listing what left, no Undo | No line: the kit and its gold vanished without a trace. An Undo: granting again belongs to the source |

## Open

- **Level down reverts only what a level's record names.** Since #118 each level-up writes a
  `levelLog` record, and level down removes its ticked HP and features. A grant goes with a
  feature only when it traces to that one feature. The grant model still does not key by class
  level, so a level's skill pick, its subclass and its spells are listed to adjust by hand, and a
  level with no record (gained before #118) keeps everything. Removing the class reverts all of
  it, and race and background choices revert fully
  ([Character building](../features/character-building.md)).
- **Some grants are not tagged, so they do not revert:** text appended to `proficiencies` (race
  proficiencies, background tools), `speed` and `size` (seeded only when
  empty), `spellAbility` (set by a class or subclass), and the legacy `ancestry` and `background`
  strings.
- **Multiclass characters saved before #66 keep the extra grants.** Their second class carries its
  saving throws, full skill picks and starting equipment under its sid. They revert if that class is
  removed; nothing strips them on load, by design.
- **Armor, weapon and tool training is not a grant** for any class — the first class's is only in
  its data, a multiclass's only in the window's note — so none of it reverts because none of it is
  applied.
- A class's gold alternative is granted as the average of its dice, not a roll.

See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — `grantFeatDef()` forwards feat `uses` and `cost`. `runExtraChoices()` grants race, trait and feat skill choices to the right sid. → ledger L16
- 2026-08-07 — Structured `equipmentGrants` arrive, with `revertEquipmentGrants()` taking back items, their attacks and granted gold. → ledger L42
- 2026-08-07 — Granted items get an automatic origin badge derived from their sid. → ledger L153
- 2026-08-07 — Known limitations recorded: no per-level revert, and racing prompts. → ledger L2571
- 2026-08-10 — Origins are updated per entry and never re-applied wholesale. → ledger L702
- 2026-08-11 — Granted items carry cost, category and type, and `invSection()` gains word boundaries. → ledger L1444
- 2026-08-14 — The level-1 HP seed includes CON and re-syncs, so its clean revert keeps landing. → ledger L2035
- 2026-09-25 — `_equipQueue` is removed, and option costs are forwarded. → ledger L3649
- 2026-09-28 — Choice windows open one at a time; the queue behind a window travels with it and survives its dismissal. → ledger L3847, #63
- 2026-09-28 — Only the first class grants saves, starting equipment and gold; a multiclass gets the pack's `multiclass` subset, and removing the first class hands its saves on. → ledger L3886, #66
- 2026-10-02 — Ammunition: launchers fire from a loaded stack with Undo, bundles unpack on arrival, recovery at End combat and on the row, the loaded +N. → ledger L4952, #6
- 2026-10-02 — The final review's fixes: a hostile item name no longer stops a sheet loading; removing a class forgets its spent arrows; End combat asks only about new shots; recovery joins an equivalent stack; the picker shows +N. → ledger L4989, #6
- 2026-10-23 — Species and backgrounds grant languages as chips stamped `race:`/`bg:`, taken back by `dropLanguages()`; nothing appends "Languages:" to Proficiencies any more. → ledger L6633, #103
- 2026-10-23 — Lifted languages noted as the player's own; an unknown language `src` reads as the player's. → ledger L6729, #103
- 2026-10-25 — Grants write one inventory-log line per source (`logGrant()`), with no Undo. → ledger L7291, #47
- 2026-10-25 — Removing a source writes one "Removed with *source*" line; an undone item whose source is gone comes back ordinary. → ledger L7339, #47
- 2026-10-27 — Species and background feat choices are granted with their origin through `commitExtraChoices()`; a feat at an ASI carries the class-level origin with its +1 on the feature; level down reverts what a level's record names. → ledger L7569, #118
