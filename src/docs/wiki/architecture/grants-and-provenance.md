# Grants & provenance

Taking an ancestry, background, class, subclass or feat copies what it grants onto the sheet:
features, skill and save proficiencies, starting equipment and gold, and the choices it offers.
Every copy is tagged with where it came from. Removing the source removes exactly those copies and
nothing the player added themselves. That is **clean revert**, and it is why a player can swap a
background or drop a class without hand-cleaning the sheet.

**Code:** `originSid()`, `grantProf()`, `removeGrants()`, `grantedProf()`, `grantSources()`,
`sidLabel()`, `effSkill()`, `effSaveProf()` in `00-constants.js`; `addFeatureFromDef()`,
`removeFeaturesWhere()`, `grantItemByName()`, `addGrantGold()`, `applyEquipOption()`,
`applyEquipGrants()`, `revertEquipmentGrants()`, `grantFeatDef()`, `runExtraChoices()`,
`renderClassRace()`, and the seeds (#131) `seedsOf()`, `playerOwns()`, `seedField()`, `unseedSource()`,
`handOnSpellAbility()`, `setPlayerField()` in `50-classrace.js`; `raceWould()` in `52-race.js`; `equipNewWeapon()` in `85-browse.js`; `applyRace()`, `removeRace()` in `52-race.js`; `applyBackground()`,
`removeBackground()` in `54-background.js`; `addClass()`, `applyClassLevel()`, `removeClass()`,
`grantClassSaves()`, `multiclassChoices()`, `selectSubclass()`, `doLevelDown()`, `seedLevel1HP()` in
`56-class.js`; `runChoices()`,
`commitChoices()`, `sidToOrigin()` in `58-choices.js`; `originFromSid()`, `itemOrigin()`,
`costToGp()` in `25-origins-items.js`; `syncResources()` in `65-resources.js`;
`forgetGrantAmmo()` in `62-ammo.js`; `logGrant()`, `grantSourceName()` in `67-trade.js`; `grantLanguages()`, `dropLanguages()`, `langParse()`,
`grantTools()`, `dropChips()`, `toolParse()`, `nameToolChip()` in `41-chips.js`; `commitExtraChoices()` in `58-choices.js` · **Tests:**
`char-update.js` (grant and revert, `grantItemByName()` called for real, the pending equipment
picker travelling with its window, the order the choice windows open in), `sheet.js` (`invSection()` filing; what the screen holds after each add, change and remove, and granted weapons equipped) · **See also:** [Character building](../features/character-building.md),
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
| Tools (#121) | `tools[]` chips `{id, name, src}`, a placeholder also `ask` | `src`: `bg:<Name>` (no species or class grants tools yet) | `dropChips()` on that src, in `removeBackground()` (and `removeRace()` for `race:`), placeholders included, named or not |
| Seeded fields (#131): `speed`, `size`, `spellAbility`, a species' `proficiencies` line | the field itself, and a record in `seeds[]` `{sid, field, value}` | the record's `sid`: `race:<Name>`, `class:<Name>`, `subclass:<Class>:<Sub>` | `unseedSource()`, in `removeRace()`, `removeBackground()`, `removeClass()` and a subclass swap: only while the field still equals the record |
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
[Ammunition](../features/ammunition.md). It stamps the copy, and a weapon arrives equipped with its
attack row through `equipNewWeapon()`, the finder's own path (#128); armour and shields arrive
unequipped. An unmatched name becomes a plain named item. A second grant of the same name from the same sid adds to
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

**Tools** (#121). A background's `tools` text grants chips the same way, through `grantTools()`:
`toolParse()` splits it as `langParse()` does, a named tool becomes a chip stamped `bg:<Name>` (one
the sheet already has keeps its own source), and a part naming a choice ("Choose one kind of Gaming
Set") adds `count` **placeholders** stamped the same way, each `{id, name, src, ask}` with the pack's
wording in `ask` and the kinds it names as its `name` ("Gaming Set", or "Tool of your choice" when
it names none). When it names a kind, a `tool` step is queued for `runExtraChoices()` with the
placeholders' ids. Naming a placeholder (`nameToolChip()`, from that step or the chip's namer)
replaces its name and drops its `ask`; its `src` stays, so removing the background takes it back
named or not. A name the sheet already holds is refused, so the player's own Dice Set never becomes
the background's. Nothing is appended to `proficiencies` for tools any more; a sheet's old "Tools: …"
lines become the player's own chips once, in `migrate()` ([Character model](character-model.md)).

**Seeds** (#131). A species seeds `speed`, `size` and a line of `proficiencies` text; a class or
subclass seeds `spellAbility`. Every one goes through `seedField(c, field, value, sid)`, which writes
into an **empty** field only (today's rule, so a subrace never overrides its species and the
player's value always wins; `0` is full) and records `{sid, field, value}` in `character.seeds`: the
value as the source gave it (a Humblewood speed `30`, an SRD one `"30 ft"`), or `null` when the field
was already full. There is one entry per sid and field, replaced when the source applies again; a
species and its subrace share one sid, so a later `null` never replaces the same sid's value, and
their two text lines are recorded as the one text they make together. The text is appended, never
"full". `unseedSource(c, sid, would)` reverts each field:
- a field with a `player` entry is skipped entirely;
- an entry with a value: the field is emptied only while it still equals it (compared as text, so
  `30` and `"30"` match), and the recorded text is taken out where it still stands as its own line, with the newline
  that joined it; anything the player changed stays;
- an entry with `null`: nothing is touched;
- **no entry at all** for that sid and field means a source applied before the record: the outgoing
  source's loaded definition (`would`, from `raceWould()` for a species, `spellcasting` for a class or
  subclass) says what it would have seeded, and a field equal to exactly that is reverted. With no
  definition loaded, or a different value, it is kept.

Then the sid's entries go. **The `player` sid** marks a speed or size the player set in its window
(the Speed window, the Size window, Settings → Carrying), through `setPlayerField()`: no seed writes
over it (it records `null`) and no revert touches it. The sources' own entries stay beside it, so
their reverts still know what they seeded. Clearing it ("From ancestry", a blank Base speed) removes
the `player` entry and empties the field; Size then reads the species' live through `charSize()`,
and Speed, which has no live fallback, is seeded again from the current species. Every read goes
through `seedsOf()`, which ignores an entry without a string `sid`, a known field and a string,
finite number or `null` value; such junk stays in the list, so it round-trips.

**Choices.** Skill choices on a race, a race trait or a feat, feat choices on a species or a
background (#118), and a background's tool choices (#121), go into a `pending` list that
`runExtraChoices()` presents after the add. Each pick is granted to the sid that queued it:
`commitExtraChoices()` grants a feat with `sidToOrigin()`'s `{kind:"race"}` or `{kind:"background"}`
origin, so changing or removing the species or background reverts it, and names a tool step's
placeholders in turn. A feat taken at an ASI carries its class-level origin, and its +1
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

**The redraw (#153, #154).** Every class, species and background change ends in
`renderClassRace()`: an add, change or remove, a level up or down, a subclass, and the Done of each
choice window (`commitChoices()`, `runExtraChoices()`). It repaints the header and everything a
grant can touch beyond it: the inventory (items, and a removed source's leaving), the coin boxes
(`renderCoins()`) and the chips (`renderChipsAll()`: the Defences, languages, senses and tools). The caller's
`renderFeatures()` and `recompute()` repaint the features, the numbers, the attack rows and the
resources. The grant functions themselves (`addGrantGold()`, `grantLanguages()`,
`grantItemByName()` and the rest) only change the character: they run in loops and inside one
another. `renderAll()`, `applyTheme()` and `refreshRulesUI()` want the header alone and call
`renderSheetHead()`.

**Removal and swapping.** `removeRace()`, `removeBackground()` and `removeClass()` each remove the
features by origin, the proficiencies by sid, the chips by src, the equipment and gold by sid, and
what the source seeded (`unseedSource()`). `removeRace()` and `removeBackground()` also clear the
legacy `ancestry` / `background` string when it is the removed name, so print stops showing it.
`removeClass()` also removes every `subclass:<Class>:` grant and seed and un-seeds the level-1 HP.
Removing the first class while another remains hands the saving throws on: the class now first gets
its own through `grantClassSaves()`, under its own sid, so they revert with it in turn. An emptied
spellcasting ability is handed on the same way: after `removeClass()`, and after `selectSubclass()`
replaces a subclass that seeded it, `handOnSpellAbility()` seeds it from the first remaining class,
or that class's subclass, that casts, under that one's sid. `applyRace()` and `applyBackground()`
remove the previous one first, so a swap empties the old species' unchanged speed and size and the
new species seeds them; a speed or size the player set survives, its `player` entry skipped by the
revert and counted full by the seed. Changing a subclass removes the old subclass's features,
grants and seeds before applying the new one.

## Rules that must hold

- **Every grant carries its source, and every source has a revert.** A new kind of grant needs
  both, or the source can no longer be removed cleanly.
- **A multiclass add never grants what only the first class may**: no saves, no equipment, no gold,
  and no class-level-1 skill choice beyond the pack's `multiclass` block. Characters saved before
  this rule keep what their second class granted; `migrate()` does not strip it.
- **Revert never touches what the player owns:** an item without that `grant`, a proficiency the
  player set, a Max HP they typed, gold beyond what that sid added, a seeded field they changed, a
  speed or size they set (its `player` entry), or a tool they already had.
- **Every seed goes through `seedField()` and is recorded, even over a full field** (as `null`).
  Writing no entry would make the fallback take the source for one applied before the record and
  revert the player's value: a Wizard added over an INT the player set, then removed.
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
- **Every grant and revert path ends in `renderClassRace()`.** A flow that changes what a source
  grants and ends anywhere else shows the change only after a reload (#153, #154).
- **A granted weapon arrives through `equipNewWeapon()`,** the finder's path; armour and shields do
  not (#128, until #130's shield stacking).
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
- **Grants that showed only after a reload (#153, #154).** Since #103 `renderClassRace()` repainted
  only the header, so a grant's gold never reached the coin boxes, its languages never became
  pills, and a fixed grant's items (or a removed source's) stayed off the inventory until a reload;
  only the equipment picker's Done redrew the inventory, and it alone skipped `renderClassRace()`.
  Changing a species showed the old pill and not the new one. The tests read what recorder elements
  hold after each flow, not which functions ran.
- **Free text reverts only while it is unchanged.** A species' Proficiencies line is recorded and
  taken out verbatim; once edited, it stays. That is why Student of War's tool lands as a feature
  rather than in the Proficiencies box: as a feature, it leaves with the subclass whatever the player
  does to the text.
- **A species and its subrace seed under one sid.** Recording the subrace's `null` over the species'
  value (the field already full) would have left a removed species' speed behind; a later `null`
  never replaces the same sid's value.

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
| Where a grant's redraw happens (#153, #154) | Once, at the end of every grant and revert path, in `renderClassRace()` | A render in each grant function: they run in loops and inside one another. A call per flow: one missed caller brought the bug back (L9101) |
| Which granted items arrive equipped (#128) | Weapons, through the finder's `equipNewWeapon()` | Armour and shields too: #130 changes shield stacking and must not go live first (Mike, L9101) |
| A background's tool choice (#121) | Asked when the background is added, a step in the choices window; the pick names a placeholder carrying the background's source (Mike) | A placeholder to name later as the only path: the pick belongs with the add. Named tools only: leaves the choice as prose (L9760) |
| Wording the app can't list, and a pick left unmade (#121) | A placeholder chip with the pack's wording, carrying the background's source; tapping it names it | Dropping a skipped pick: the background would grant nothing visible, and the choice would be lost |
| Is a tool lifted from old text tied to the background? (#121) | No: it is the player's, as lifted languages are | Guessing from `bg.name`: a wrong guess deletes a player's tool when they change background |
| A swap or remove when the player changed a seeded value (#131) | The player's value stays: a source's value is reverted only while it still matches what that source put in (Mike) | The source always wins: overwrites the player's choice. Asking each time: a dialog for something with one right answer |
| How the sheet knows what a source seeded (#131) | A record, `character.seeds`, one `{sid, field, value}` per sid and field, with `null` for a source that found the field full | Reading speed and size live from the pack: a sheet without its pack reads Speed 0. Recognising by value alone, as level-1 HP is: a pack update that changes a species' speed strands the old value |
| Sheets saved before the record (#131) | A fallback only where there is no entry at all for that sid and field: reverted if it equals what the loaded definition seeds, else kept | No fallback: every existing character keeps the bug. A one-time pass in `migrate()`: the rules may not be loaded when it runs |
| The spellcasting ability when its source goes (#131) | Handed to the next caster, after every revert that can empty it | Leaving it blank: a Cleric/Wizard who drops Cleric would have no spell DC |
| How a value the player set is told apart from a seed (#131) | A `player` entry in `seeds`, which `seedField()` counts as full and `unseedSource()` skips | Deleting the field's entries on a typed save: the fallback would then revert a typed speed equal to the old species' |

## Open

- **Level down reverts only what a level's record names.** Since #118 each level-up writes a
  `levelLog` record, and level down removes its ticked HP and features. A grant goes with a
  feature only when it traces to that one feature. The grant model still does not key by class
  level, so a level's skill pick, its subclass and its spells are listed to adjust by hand, and a
  level with no record (gained before #118) keeps everything. Removing the class reverts all of
  it, and race and background choices revert fully
  ([Character building](../features/character-building.md)).
- **Tools lifted from old "Tools:" text are the player's** (#121, decision 5): the background behind
  them can't be recovered, so they stay after a background change, as lifted languages do.
- **A feat's tool choices** (Crafter, Musician, Skilled) stay feature text; a later issue can queue
  them through the same `tool` step.
- **Multiclass characters saved before #66 keep the extra grants.** Their second class carries its
  saving throws, full skill picks and starting equipment under its sid. They revert if that class is
  removed; nothing strips them on load, by design.
- **Armor, weapon and tool training is not a grant** for any class — the first class's is only in
  its data, a multiclass's only in the window's note — so none of it reverts because none of it is
  applied. If #137 tracks a class's tools, it adds a `class` source to `CHIP_SRC` and uses the tool
  chip row.
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
- 2026-11-06 — Every grant and revert path ends in one redraw, `renderClassRace()`, which repaints the inventory, coins and chips; granted weapons arrive equipped through `equipNewWeapon()`. → ledger L9101, #153, #154, #128
- 2026-11-07 — A background's tools are chips stamped `bg:`, a choice a placeholder asked for in the choices window; what a source seeds is recorded in `seeds` and reverted only while unchanged, with a fallback for older sheets, a `player` entry for a value the player set, and the spellcasting ability handed on; the legacy strings clear. → ledger L9760, #121, #131
