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
`costToGp()` in `25-origins-items.js`; `syncResources()` in `65-resources.js` · **Tests:**
`char-update.js` (grant and revert, `grantItemByName()` called for real, the pending equipment
picker travelling with its window), `sheet.js` (`invSection()` filing) · **See also:** [Character building](../features/character-building.md),
[Inventory](../features/inventory.md), [Class resources](../features/class-resources.md),
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
| Starting equipment, and the attacks it made | `inventory[]` with `grant: sid`; attacks linked by `itemId` | `grant` | `revertEquipmentGrants()` |
| Starting gold | added to `coins.gp` and recorded in `grantGold[sid]` | `sid` | `revertEquipmentGrants()`: subtracts exactly that amount, never below 0 |
| Class resource pools | `resources[]` with `auto:true` and a `class:`/`subclass:` key | `key` | `syncResources()` on every `recompute()`: an auto pool whose class or subclass is gone is dropped |
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
sheet as a gp number. It stamps the copy, and a weapon gets its attack. An unmatched name becomes a
plain named item. A second grant of the same name from the same sid adds to the quantity. The
item's origin badge (C, B or A) comes from `originFromSid()`.

**Choices.** Skill choices on a race, a race trait or a feat go into a `pending` list that
`runExtraChoices()` presents after the add, and each pick is granted to the sid that queued it.
Class and subclass level choices go through `runChoices()` → `commitChoices()`: skills to the
choice's sid, an ASI as a feature, a feat through `grantFeatDef()`, an option through
`addFeatureFromDef()` with `sidToOrigin()` (so it reverts with its class or subclass) and its
`cost` forwarded. A picked subclass is applied by `selectSubclass()` after the rest. The class's
starting-equipment picker is passed **with the window** as `eq`, from `runChoices()` to its own Done
to `commitChoices()`, which hands it to `runExtraChoices()`.

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
- **The pending equipment picker travels with its window.** Never park it in a module global.

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
| Where the starting-equipment picker waits | Passed with its window to its own Done | A module global: it outlived a dismissed window and fired after the next level-up (L3649) |
| Where Student of War's tool proficiency goes | A feature | The free-text Proficiencies box: it would not revert with the subclass (L3649) |
| Which class grants saves, equipment and gold | The first class only; a multiclass gets the pack's `multiclass` subset | Every `addClass()`: the 2024 multiclass rules give neither (L3761, #66) |
| Removing the first class while another remains | The new first class takes its saving throws, under its own sid | Leaving the sheet with no save proficiencies (L3761) |
| Stripping extra grants from multiclass characters saved earlier | No: `migrate()` is untouched | Retroactive strip: it would silently change sheets players have been playing (L3761) |

## Open

- **A subclass's own choices can be lost when a first class is added at level 3 or higher.**
  `commitChoices()` calls `selectSubclass()`, which opens that subclass's level-choice window
  (Battle Master's maneuvers and Student of War, say), and then immediately calls
  `runExtraChoices()` with the starting-equipment picker. A multiclass add has no equipment picker
  since #66, so it races only when a feat skill choice is pending. `openModal()` replaces the window, so the
  subclass picks are never offered. Reproduced in the harness: the windows open as "Fighter — Level
  3" and then "Choose". A feat skill choice at the same level races the same way.
- **Level-down keeps everything.** `doLevelDown()` lowers the number and nothing else: traits,
  grants, choices and HP stay. The grant model does not key by class level, so a class-level choice
  reverts when the class is removed but not per level. Race and background choices revert fully.
- **Some grants are not tagged, so they do not revert:** text appended to `proficiencies` (race
  proficiencies and languages, background tools and languages), `speed` and `size` (seeded only when
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
- 2026-09-28 — Only the first class grants saves, starting equipment and gold; a multiclass gets the pack's `multiclass` subset, and removing the first class hands its saves on. → ledger L3761, #66
