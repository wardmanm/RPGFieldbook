# Character building

How a sheet gets its ancestry, background and classes: the three Add pickers on the Sheet tab,
level-up and level-down, choosing or changing a subclass, and the choice modal that every one of
them ends in — "choose 2 skills", an Ability Score Improvement, a feat, hit points, a subclass, or an
option list such as Battle Master maneuvers. Everything these add is tagged with where it came from,
so removing the source takes it back out; that mechanism is
[Grants & provenance](../architecture/grants-and-provenance.md). This page is the player-facing flow.

**Code:** `openAddClass()`, `addClass()`, `applyClassLevel()`, `removeClass()`, `doLevelUp()`,
`doLevelDown()`, `selectSubclass()`, `chooseSubclass()`, `hpChoice()`, `commitHPChoice()`,
`seedLevel1HP()`, `grantClassSaves()`, `multiclassChoices()`, `multiclassNote()` in
`56-class.js`; `choiceFieldHTML()`, `runChoices()`, `gatherChoices()`, `commitChoices()`,
`effectiveChoose()`, `choiceShortfall()`, `armChoiceDismissGuard()` in `58-choices.js`;
`openAddRace()`, `applyRace()`, `racesForCharacter()` in `52-race.js`; `openAddBackground()`,
`applyBackground()` in `54-background.js`; `subclassesFor()`, `addFeatureFromDef()`,
`grantFeatDef()`, `runExtraChoices()`, `classChipHTML()` in `50-classrace.js`; `dismissModal()`,
`setDismissGuard()` in `80-modal-forms.js` · **Data:** `choices` on class, subclass and race
levels, per [rules-schema](../../../../docs/rules-schema.md) §5; a class's `multiclass` block,
§6.3; `data/5e2024/features.json` ·
**Tests:** `sheet.js`, `char-update.js`, `rules-data.js` · **See also:**
[Vitals & rest](vitals-and-rest.md), [Class resources](class-resources.md),
[Features & traits](features-and-traits.md), [Converter](../data/converter.md)

## How it works

**Ancestry.** `openAddRace()` lists `racesForCharacter()`: every loaded species except those whose
system (read from `_source` by `systemOf()`) is the other one, or whose pack lists this system in
`excludeSystems`. Unknown sources (homebrew) show for both. Only the picker filters — `findRaceDef()`
does not, so an imported cross-system ancestry keeps resolving. A species with subraces must have one
picked. If it (or the subrace) carries `abilityChoice`, the modal offers +2/+1, +1/+1/+1 or **None**
(the 2024 rule puts the increase on the background). `applyRace()` removes any current ancestry,
then grants from the species and then the subrace: fixed `abilityScores` as a feature, skills and
saves as grants, each trait as a feature, any `choices` (skill) queued, `equipmentGrants`, and speed
and size **only if those boxes are empty**. `proficiencies` and `languages` are appended to the
free-text Proficiencies box. Queued skill choices then open through `runExtraChoices()`.

**Background.** `openAddBackground()` previews the 2024 shape: the three eligible abilities as
+2/+1 or +1/+1/+1, a feat (a select when the background offers more than one), the granted skills,
tools and languages. `applyBackground()` adds the ability feature, the skill grants, the feat through
`grantFeatDef()`, the single background `feature`, `equipmentGrants`, and appends tools and
languages to Proficiencies.

**Class.** `openAddClass()` takes a pack class or a custom name and a starting level (1–20).
`addClass()` sets the spellcasting ability if none is set and runs `applyClassLevel()` for every
level up to the starting one — traits become features, `choices` and spell notes collect — then
opens one choice modal for all of them. What else it grants depends on whether a class is already
on the sheet:

| | First class (none on the sheet yet) | Any later class (multiclass) |
|---|---|---|
| Saving throws | the class's `savingThrows`, via `grantClassSaves()` | none |
| Fixed class `skills` | granted | none |
| Level-1 `skill` choice | offered in full ("choose 2") | replaced by the pack's `multiclass.choices` (`multiclassChoices()`): one skill for a Bard, Ranger or Rogue, none for most; nothing if the class has no `multiclass` block |
| Other level-1 choices, traits, spells | yes | yes (Fighting Style, invocations, Spellcasting) |
| Starting equipment and gold | `equipmentGrants`, fixed blocks at once and a picker after the window | none |
| Hit points | level 1 seeded by `seedLevel1HP()`; a class starting above level 1 then asks for levels 2..N in the window | an HP step for all its levels, with its own die |
| A note in the window | — | `multiclassNote()`: no saves or equipment, and what it gains (`multiclass.proficiencies` and the skill count), or that the pack does not list it |

The Add class preview shows the same note once a class is on the sheet, so its "Saves" line is not
read as a promise. Armor, weapon and tool training is text in either case: the first class's lives
in its data only, and a multiclass's is shown in the note, never tracked. Removing the **first**
class while another remains makes that one first: it takes its saving throws, tagged to it, with a
toast, and nothing else is re-offered. The class chip
(`classChipHTML()`) opens the class; its subclass is a separate link button (`data-sub-info`), matched
before `data-info-class` so it wins inside the chip.

**Level up.** `doLevelUp()` asks which class when there are several, raises it, and runs
`applyClassLevel()` for the new level (class and subclass). `hpChoice()` is built **before** Max HP is
unlocked, so it remembers the lock; the level's modal then opens with a synthesized `{type:"hp"}`
block first. Blank takes the fixed value (half the die + 1), "Roll for me" rolls it, CON is added
once per level via `conModNow()`, and the floor is 1 per level. `commitHPChoice()` raises Max and
Current and puts the lock back only if it was locked. **Level down** (`doLevelDown()`) only lowers
the number: traits, grants and choices stay.

**Subclass.** Either a `subclass` choice at the class's level, or Choose/Change in the class info
window (`chooseSubclass()`), which shows each with its pack and description. `selectSubclass()`
removes every subclass-origin feature of that class and the old subclass's grants, then applies each
subclass level up to the current one and opens their choices, carrying whatever waits behind that
window (see below). `subclassesFor()` merges the class's
own subclasses with standalone `subclasses` entries naming it; a same-named entry from a *different*
pack is keyed "Name (PACK)" and offered alongside, and `subSourceTag()` tags the rest.

**The choice modal.** `runChoices()` renders each choice with `choiceFieldHTML()`:

| `type` | Renders | On Done |
|---|---|---|
| `skill` | checkboxes; ones you already have are ticked, disabled and `data-fixed`, naming the source | a grant per pick under the choice's sid |
| `option` | radios for `choose:1`, capped checkboxes above that; options already on the sheet are marked "already yours" unless `repeatable` | each pick becomes a feature (with `effects`, `skills`, `saves`, `cost`) whose origin comes from `sidToOrigin()` |
| `asi` | +2 to one, or +1 to two | an "Ability Score Improvement" feature carrying the effects |
| `feat` | a select over `from`, or every loaded feat | `grantFeatDef()` |
| `subclass` | radios with pack and description | `selectSubclass()` after the rest commits |
| `hp` | a dice box, Roll for me, and the working ("Average 6 + 2 CON = 8 HP") | `commitHPChoice()` |

`effectiveChoose()` sets how many new picks a block asks for: granted options do not spend the
budget, but it never asks for more than remain. The target is written as `data-choose` on the
`.choice` wrapper; a `change` listener on the modal calls `syncChoiceLimits()`, which disables the
unticked boxes once the block is full and re-enables them off `data-fixed`, never off `checked`. On
Done, `choiceShortfall(choiceBlocks())` warns about unmade picks; `gatherChoices()` reads only
checked, **enabled** boxes; `commitChoices()` grants, renders, then opens the next window.

**One window at a time.** There is one modal, so a window opens only once the one before it is
finished. The windows go: the class's level choices, then the picked subclass's own level choices
(Battle Master's maneuvers and Student of War), then one "Choose" window from `runExtraChoices()`
with the skill choices of any feat picked on the way and the new class's starting-equipment picker.
What waits behind a window is a `pending` list in `runExtraChoices()`'s shape, and it travels with
the window: `runChoices(…, pending)` → its Done → `commitChoices(…, pending)`, which adds this
window's feat skill choices and hands the lot to `selectSubclass(…, next)` when a subclass was
picked, otherwise to `runExtraChoices()`. `runChoices()` with nothing to show (Champion at 3 has no
picks) passes the queue straight on.

**Dismissing.** Closing wipes `#mBody` and a chooser cannot be reopened. `armChoiceDismissGuard()`
registers a guard (via `setDismissGuard()`) that ✕, a backdrop click and Escape all consult through
`dismissModal()`: it warns that picks will be discarded, or asks a milder question when only hit
points are at stake (`hpPending()`), since Max is unlocked. The guard also carries the window's
`pending` as `then`, so a dismissed window still opens the ones queued behind it: dismissing costs
that window's own picks, never the starting equipment of a class already on the sheet.
`openModal()` and `closeModal()` clear the guard and `then`, so an ordinary form's Escape stays
instant and a queue never outlives its window.

**Option lists and the library.** Maneuvers (Battle Master), Metamagic, Eldritch Invocations and
Artificer infusions — and in the supplements Arcane Archer shots, College of Swords styles and Rune
Knight runes — arrive from the converter as `option` choices at every level the count rises
("Maneuvers: choose 2 more"), with each option's text, `cost` and `repeatable` inlined. Battle
Master's level 3 also carries Student of War: a `skill` choice from the Fighter's own level-1 list,
and an `option` over the 17 artisan's tools, so the tool is a feature that reverts with the subclass.
The same XPHB options
ship as library entries in `data/5e2024/features.json` ("D&D 2024 Options": 20 maneuvers, 28
invocations, 10 metamagic), reachable from the Features & Traits browser to swap one by hand. How
they are built: [Converter](../data/converter.md).

## Rules that must hold

- **The choice helpers stay DOM-free.** `effectiveChoose()`, `choiceShortfall()` and
  `choiceFieldHTML()` read character state but no document: the harness stubs `querySelectorAll` to
  `[]`, so anything that reads the DOM cannot be tested. The live locking is regex-guarded in
  `rules-data.js` instead.
- **`data-choose` is the only place the target exists** for `runExtraChoices()`, which never fills
  `_activeChoices`. `choiceBlocks()` reads it from the DOM for that reason.
- **Re-enable keys on `data-fixed`.** Only unchecked boxes are ever disabled, which is what keeps a
  player's own picks undoable and a granted proficiency locked.
- **`gatherChoices()` skips `:disabled`.** A granted skill or an owned option is never re-granted
  under the class sid.
- **Arm the dismiss guard after `openModal()`**, which clears it. Never put the check in
  `closeModal()` — every Done handler calls that and would have to answer its own prompt.
- **`hpChoice()` before the unlock.** `_wasLocked` is read when the choice is built; `doLevelUp()`
  then clears `hp.locked` as the fallback for a dismissed modal.
- **`commitChoices()` passes `cost` into `addFeatureFromDef()`.** A picked maneuver's Use button
  spends a Superiority Die only because the cost survives this hop.
- **One choice window at a time, and the queue travels with it** (`runChoices(…, pending)` →
  `commitChoices(…, pending)` → `selectSubclass(…, next)`, or the guard's `then` on a dismissal).
  A Done opens at most one window. The queue never waits in a module global.
- **`character.classes[].subclass` stores the `subclassesFor()` key**, so a supplement must never be
  allowed to take an existing key from another pack.
- **The first class is `character.classes[0]`**, the one added while the list was empty. Classes
  are only ever pushed and spliced, never reordered; anything that reorders them would move the
  saving throws' owner without moving the grants.
- **A class's own level-1 `skill` choice is its starting proficiencies**, and that is what a
  multiclass add drops. The converter writes nothing else there, and the Gadgeteer's hand-authored
  one is the same list. A class feature that grants a skill at level 1 must use a trait's `skills`
  or an `option`, or a multiclass add will drop it too.

## Traps

- **`choose` never reached the DOM.** `choiceFieldHTML` put it in the label prose only, so a Rogue's
  "choose 4 of 10" granted all ten and ticking none was accepted too. Fixed by carrying it as
  `data-choose`; `choiceFieldHTML`'s markup is asserted in `sheet.js`.
- **Escape was the easiest way past the new warning** until the guard covered the dismissals.
- **The `option` checkbox branch is live.** Maneuvers (choose 3, then 2), Metamagic (2),
  Invocations (up to 2) and infusions (4) all render as capped checkboxes. The comment in
  `choiceFieldHTML()` calling that half "dead code" predates the #60 pickers and is stale.
- **`_equipQueue` outlived its window.** Dismissing Add class left the equipment picker queued, and
  it popped up after the next level-up's Done. Found with #58, removed in the Battle Master pass;
  `char-update.js` spies on `runExtraChoices` through the vm context to prove the picker now travels
  with the window.
- **Two windows opened at once (#63).** `commitChoices()` used to open the subclass's window and
  then, in the same step, `runExtraChoices()`, and `openModal()` replaced the first window and
  cleared its guard. A Fighter added at 3 as a Battle Master was never offered maneuvers, and every
  2024 class has an equipment choice, so any choice-bearing subclass taken at a starting level was
  exposed. The ledger (L2571) had recorded only the narrower feat-plus-subclass case. `char-update.js`
  now drives the real 2024 Fighter through the whole flow and asserts the order of the windows.
- **Every class add was character creation.** `addClass()` granted saving throws, starting
  equipment and gold, and the full "choose 2" skills to a second class exactly as to the first, so a
  Fighter who took a Wizard level gained INT and WIS saves, a spellbook kit and 55 gp (#66). The HP
  path had always told the two apart, which is why only it was right.
- **"(TCE) (TCE)".** A reprint already keyed "Psi Warrior (TCE)" was tagged again in both subclass
  pickers; `subSourceTag()` now skips a tag already in the name.
- **Not everything reverts.** Tools and languages go into the free-text Proficiencies box and stay
  there when the ancestry or background is removed. Speed and size are seeded only into empty boxes
  and are not cleared by `removeRace()`, so swapping ancestry keeps the first one's values (traced in
  the code).

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where a block's "choose N" lives | `data-choose` on the `.choice` wrapper | Label prose only: `gatherChoices()` had nothing to check against, so every box ticked was granted |
| What unlocks a disabled option | `data-fixed` | `checked`: unticking your own pick would hand a granted proficiency back as an editable box |
| Options you already have | Don't spend the budget, but cap it at what remains (`effectiveChoose()`) | Asking for the full count: nagging forever for a pick the player cannot make |
| Where the dismiss guard is checked | `dismissModal()`, for ✕, backdrop and Escape only | Inside `closeModal()`: every Done handler calls it and would answer its own prompt |
| Hit points on a level-up | A synthesized `{type:"hp"}` block in the level's own modal | Only unlocking Max: on a subclass level the choice modal was the only thing on screen and the hit points were forgotten |
| CON for a level-up's hit points | `abilFinal()`, via `conModNow()` | `modOf()` of the score: an ASI lives in an effect, and this number is spent once, never re-derived |
| A same-named subclass from another pack | Offered alongside, keyed "Name (PACK)" | Taking the key: loading a supplement would silently rewrite what every character already chose |
| Species from the other system | Filtered out of the picker only | Filtering `findRaceDef()`: an imported cross-system ancestry would lose its traits |
| An option already on the sheet | Ticked and `data-fixed` in checkboxes; just disabled in radios | A tick in a radio group, which reads as this level's pick |
| Where the equipment picker waits | Passed to `runChoices()` and on to its own Done | A module global: it outlived a dismissed window |
| When a picked subclass has choices of its own | Its window opens first; feat skill choices and the equipment picker wait behind it | Opening each window as soon as it is known: one modal, so the last one opened replaced the subclass's picks (#63) |
| What a dismissed choice window does with the windows behind it | Hands them on (`then`) | Drops them with it: a notes-only subclass window arms no warning, so Escape would silently cost a class already on the sheet its equipment |
| Student of War's tool | An `option` that becomes a feature | The free-text Proficiencies box: it would not revert with the subclass |
| What a multiclass add grants (#66) | Level-1 features and non-skill choices, the pack's `multiclass` skills, an HP step; no saves, no equipment or gold | Everything, as for the first class: 2024 multiclassing gives neither saves nor equipment, and only a subset of skills |
| A class with no `multiclass` data, added as a second class | No class skills, and a note that the pack does not list them | A multiclass table in the app: rules text belongs in the pack, and a guess would be silently wrong for homebrew |
| Removing the first class while another remains | The class now first takes its own saving throws, with a toast | Leaving the saves off: the sheet would have no save proficiencies at all (owner may reverse) |
| Hit points for a first class that starts above level 1 | Seed level 1, then an HP step for levels 2..N in the same window | None at all, as before: a level-3 character was created with no hit points |

## Open

- An `asi` choice offers +2 / +1+1 only. [rules-schema](../../../../docs/rules-schema.md) §5 says
  "or a feat instead"; the app has no such branch.
- A class's gold alternative uses the average of its dice, not a roll.
- The Humblewood Gadgeteer has no `multiclass` data (no Humblewood source defines it), so a
  multiclass Gadgeteer is offered no class skills and told so. The pack's Artificer carries TCE's
  2014 multiclass row, because that is the printing the pack holds.
- A first class added above level 1 and then removed keeps the Max HP its window added; the un-seed
  only recognises a level-1 seed ([Vitals & rest](vitals-and-rest.md)).
- A feat picked from the Features & Traits browser gets no skill-choice prompt:
  `grantFeatDef()` only queues those when there is an origin sid.
- Level-down keeps everything, and class-level feat skill choices revert with the class, not the
  level: [Grants & provenance](../architecture/grants-and-provenance.md).
- The unreverted Proficiencies text, speed and size. See
  [Known issues](../roadmap/known-issues.md).
- `runChoices()` titles a window with the level of its first choice, so Add class at level 3 opens
  as "Fighter — Level 1" even though it holds the level-3 subclass pick too.

## History

- 2026-08-07 — skill choices on race traits, subraces and feats via `runExtraChoices()`;
  `grantFeatDef()` forwards a feat's uses and cost. → ledger L16
- 2026-08-07 — starting equipment from `equipmentGrants`, with "choose" blocks as a picker.
  → ledger L42
- 2026-08-15 — "choose N" enforced: `data-choose`, `data-fixed`, the shortfall warning and the
  dismiss guard. → ledger L2298, #34
- 2026-09-25 — every level-up asks for hit points; subclass radios show pack and description; the
  subclass is its own button on the chip. → ledger L3548, #58, #59, #61
- 2026-09-25 — option pickers for maneuvers, metamagic, invocations and infusions; owned options
  marked, `repeatable` honoured, `gatherChoices()` skips disabled. → ledger L3596, #60
- 2026-09-25 — option costs, Student of War, the 2024 options library; `_equipQueue` removed.
  → ledger L3649
- 2026-09-28 — choice windows open one at a time: the subclass's own picks before feat skill
  choices and the equipment picker, and a dismissed window hands its queue on. → ledger L3847, #63
- 2026-09-28 — only the first class grants saving throws, starting equipment and its full skill
  choice; a multiclass gets the pack's `multiclass` subset and a note. A first class above level 1
  gets its hit points. → ledger L3886, #66
