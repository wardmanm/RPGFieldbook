# Character building

How a sheet gets its ancestry, background and classes: the three Add pickers, reached from the
Sheet's header,
level-up and level-down, choosing or changing a subclass, and the choice modal that every one of
them ends in — "choose 2 skills", an Ability Score Improvement, a feat, hit points, a subclass, or an
option list such as Battle Master maneuvers. Everything these add is tagged with where it came from,
so removing the source takes it back out; that mechanism is
[Grants & provenance](../architecture/grants-and-provenance.md). This page is the player-facing flow.

**Code:** `openAddClass()`, `addClass()`, `applyClassLevel()`, `removeClass()`, `doLevelUp()`,
`doLevelDown()`, `selectSubclass()`, `chooseSubclass()`, `hpChoice()`, `commitHPChoice()`,
`seedLevel1HP()`, `grantClassSaves()`, `multiclassChoices()`, `multiclassNote()` in
`56-class.js`; `choiceFieldHTML()`, `runChoices()`, `gatherChoices()`, `commitChoices()`,
`effectiveChoose()`, `choiceShortfall()`, `armChoiceDismissGuard()`, `choiceWindowTitle()`,
`choiceLevelSpan()`, `choiceNoteText()` in `58-choices.js`;
`openAddRace()`, `applyRace()`, `racesForCharacter()` in `52-race.js`; `openAddBackground()`,
`applyBackground()` in `54-background.js`; `subclassesFor()`, `addFeatureFromDef()`,
`grantFeatDef()`, `runExtraChoices()` in `50-classrace.js`; `dismissModal()`,
`setDismissGuard()` in `80-modal-forms.js`; `classLineHTML()`, `classFlyHTML()`, `openShFly()` in
`40-sheet.js`; `raceInfoFoot()` in `52-race.js`, `bgInfoFoot()` in `54-background.js`;
`grantLanguages()`, `dropLanguages()` in `41-chips.js` · `levelSnapshot()`, `levelGains()`,
`luHPCheck()`, `openLevelUp()`, `levelUpCardHTML()`, `levelUpHPHTML()`, `luSetHP()`, `luFinish()`,
`luDismissed()`, `playLevelUpFx()`, `luSkip()` in `57-levelup.js` · **Data:** `choices` on class, subclass and race
levels, per [rules-schema](../../../../docs/rules-schema.md) §5; a class's `multiclass` block,
§6.3; the `features.json` of the 2024 pack (private repo) and of `data/srd52/` ·
**Tests:** `sheet.js`, `char-update.js`, `rules-data.js` · **See also:**
[Vitals & rest](vitals-and-rest.md), [Class resources](class-resources.md),
[Features & traits](features-and-traits.md), [Converter](../data/converter.md)

## How it works

**Where it starts: the header** (#103). Under the name, the header's class line reads
"Cleric 12 · Fighter 3 · Half-Elf · Acolyte" (`classLineHTML()`), every part a button:

- **A class** opens the header's popover with its menu (`classFlyHTML()`): About (its info window),
  its subclass (or Choose subclass), ▲ Level up, ▼ Level down, + Add class and Remove (with the
  existing confirm). These are the old Class card's controls, moved; its Level up / Level down
  buttons and its chips are gone. The menu's ▲ / ▼ carry the class's index (`data-shidx`), so they
  act on **that** class.
- **The species or background** opens its info window (the species button reads "Elf · High Elf"
  when there is a subrace), which, from the sheet and for the
  character's own pick, ends in **Change** (the picker again) and **Remove** (confirm, then the
  window closes) — `raceInfoFoot()` / `bgInfoFoot()`. Reference mode (`{ref:true}`) shows neither.
- **Nothing chosen** reads "+ Class", "+ Race" / "+ Ancestry" (by skin, `raceTerm()`) and
  "+ Background", each opening its picker.

**Ancestry.** `openAddRace()` lists `racesForCharacter()`: every loaded species except those whose
system (read from `_source` by `systemOf()`) is the other one, or whose pack lists this system in
`excludeSystems`. Unknown sources (homebrew) show for both. Only the picker filters — `findRaceDef()`
does not, so an imported cross-system ancestry keeps resolving. A species with subraces must have one
picked. If it (or the subrace) carries `abilityChoice`, the modal offers +2/+1, +1/+1/+1 or **None**
(the 2024 rule puts the increase on the background). `applyRace()` removes any current ancestry,
then grants from the species and then the subrace: fixed `abilityScores` as a feature, skills and
saves as grants, each trait as a feature, any `choices` (skill) queued, `equipmentGrants`, and speed
and size **only if those boxes are empty**. `proficiencies` is appended to the free-text
Proficiencies box; `languages` become chips stamped `race:<Name>` (`grantLanguages()`), which
removing or changing the species takes back ([Grants & provenance](../architecture/grants-and-provenance.md)). Queued skill choices then open through `runExtraChoices()`.
`openRaceInfo(idOrName,opts)` opens by the pack entry's `_id` as readily as by name, and the Rules
tab's Species rows open it with `{ref:true}` (#99): the window shows the species' own rules with no
"— selected" mark, since there is no character to mark it against.

**Background.** `openAddBackground()` previews the 2024 shape: the three eligible abilities as
+2/+1 or +1/+1/+1, a feat (a select when the background offers more than one), the granted skills,
tools and languages. `applyBackground()` adds the ability feature, the skill grants, the feat through
`grantFeatDef()`, the single background `feature`, `equipmentGrants`, appends tools to
Proficiencies, and grants its `languages` as chips stamped `bg:<Name>`. `openBackgroundInfo(idOrName,opts)` opens by id as well as by name, and
the Rules tab's Backgrounds rows open it with `{ref:true}` (#99): the window shows the background's
options, not this character's choices.

**Class.** `openAddClass()` takes a pack class or a custom name and a starting level (1–20). With
no class in the loaded rules it says so in the old Class card's words (`NO_RULES_HINT`): load a
rules pack with races and classes from Settings → Rules, or use a custom name.
`addClass()` sets the spellcasting ability if none is set and runs `applyClassLevel()` for every
level up to the starting one — traits become features, `choices` and spell notes collect — then
opens one choice modal for all of them. What else it grants depends on whether a class is already
on the sheet:

| | First class (none on the sheet yet) | Any later class (multiclass) |
|---|---|---|
| Saving throws | the class's `savingThrows`, via `grantClassSaves()` | none |
| Fixed class `skills` | granted | none |
| Level-1 `skill` choice | offered in full ("choose 2"; a Bard chooses 3 from all 18) | replaced by the pack's `multiclass.choices` (`multiclassChoices()`): one skill for a Bard, Ranger or Rogue, none for most; nothing if the class has no `multiclass` block |
| Other level-1 choices, traits, spells | yes | yes (Fighting Style, invocations, Spellcasting) |
| Starting equipment and gold | `equipmentGrants`, fixed blocks at once and a picker after the window | none |
| Hit points | level 1 seeded by `seedLevel1HP()`; a class starting above level 1 then asks for levels 2..N in the window | the level-up card's HP step (#101), for all its levels, with its own die |
| A note in the window | — | `multiclassNote()`: no saves or equipment, and what it gains (`multiclass.proficiencies` and the skill count), or that the pack does not list it |

The Add class preview shows the same note once a class is on the sheet, so its "Saves" line is not
read as a promise. Armor, weapon and tool training is text in either case: the first class's lives
in its data only, and a multiclass's is shown in the note, never tracked. Removing the **first**
class while another remains makes that one first: it takes its saving throws, tagged to it, with a
toast, and nothing else is re-offered. The header's class menu (`classFlyHTML()`) offers the
class's window, and its subclass as its own entry (`data-sub-info`). `openClassInfo(idOrName,opts)` and
`openSubclassInfo(classIdOrName,subName,opts)` open by id as well as by name, and the Rules tab's
Classes and Subclasses rows open them with `{ref:true}` (#99): no "— current" level, no subclass
marker, nothing from `character.classes`; a subclass link inside such a window carries
`data-sub-ref="1"` so following it stays in reference mode too.

**Level up (#101).** From the class menu, or the level ring's "Level up ready"
([Vitals & rest](vitals-and-rest.md)). `doLevelUp(idx)` levels class `idx` when the menu passes
one; with none (Level up ready) it asks which class when there are several. It takes a
`levelSnapshot()`, runs `applyClassLevel()` for the new level (class and subclass) and the Max HP
unlock exactly as before, then calls `openLevelUp(info)` in place of `runChoices()` — and so does
`addClass()` when the new class is a second class (not creation; see below). `openLevelUp` plays
the scene (a rune circle draws itself, the level ring glows and ticks old → new, a flash, a LEVEL N
banner with sparks — skipped under `prefers-reduced-motion`, or by a click, tap or Esc/Enter/Space,
which focuses the card), then shows the card (`levelUpCardHTML()`): a header naming the class and
levels, `levelGains()`'s rows (new features — tagged with the subclass, and warned when a feature's
name matches one already held from a *different* class — choices still to make, new or changed
resources, new or bigger spell slots, a rising proficiency bonus, then the pack's own notes for
that level), and the hit-points step at the foot (`levelUpHPHTML()`): the same controls, wording
and order as the hit-dice spend box ([Vitals & rest](vitals-and-rest.md)) — Roll for me, "I rolled"
plus Apply (live-checked by `luHPCheck()`, n dice for a second class arriving above level 1), or
Take the average. **Done** (nothing left to choose) or **Continue to your choice ▸** both stay
disabled until HP is set (`luSetHP()`); either commits it (`commitHPChoice()`, which raises Max and
Current and puts the lock back only if it was locked) and Continue then opens the usual choice
window, `runChoices(cls, choices, [], pending)` — no `notes`, since the card already showed them,
and no `hp` block, since the card already asked for it. **Closing the card early** (`luDismissed()`,
through the same guard as the choice windows, `LU_HP_CLOSE`) asks first when HP isn't set; either
way the choices and any pending window (a second class's starting equipment) still open, because a
choice the player never saw must not vanish with the card. **Creation is unchanged**: a first class
added above level 1 still gets its `{type:"hp"}` block inside the choice window for levels 2..N
(see the table below), because creation has no fanfare. **Level down** (`doLevelDown(idx)`) only lowers
the number: traits, grants and choices stay. From a class's menu it lowers that class, and at level 1
says to use Remove in the class's menu; with no index it lowers the one class above level 1, or asks
which when there are several.

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
| `hp` | a dice box, Roll for me, and the working ("Average 6 + 2 CON = 8 HP") — creation only now: a level-up or a second class gets the level-up card's own HP step instead (#101) | `commitHPChoice()` |

`effectiveChoose()` sets how many new picks a block asks for: granted options do not spend the
budget, but it never asks for more than remain. The target is written as `data-choose` on the
`.choice` wrapper; a `change` listener on the modal calls `syncChoiceLimits()`, which disables the
unticked boxes once the block is full and re-enables them off `data-fixed`, never off `checked`. On
Done, `choiceShortfall(choiceBlocks())` warns about unmade picks; `gatherChoices()` reads only
checked, **enabled** boxes; `commitChoices()` grants, renders, then opens the next window.

**The window's title** names the levels the window holds, read off its contents by
`choiceWindowTitle()`. Every choice and every spell note carries the `_level` it was collected at
(notes as `{text, _level}`, read by `choiceNoteText()`), and an HP step covers `levels` levels ending
at its own. One level reads "Fighter — Level 4"; several read "Fighter — Levels 1–3". Add class at 3
holds the level-1 skills, the HP for levels 2–3 and the level-3 subclass; a multiclass added at 3 has
an HP step for 1–3; Change subclass at 10 re-asks Battle Master's picks from 3, 7 and 10. A window
with nothing levelled in it (a plain-text note alone) names the class and no level. The name goes in
as written, because the title is text ([Shell](../ui/shell.md)).

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
registers a guard (via `setDismissGuard()`) that ✕, Escape and a backdrop click (only when
Settings → Appearance allows it, #106) all consult through `dismissModal()`: it warns that picks will be discarded, or asks a milder question when only hit
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
ship as library entries in the 2024 pack's `features.json` ("D&D 2024 Options": 20 maneuvers, 28
invocations, 10 metamagic; in the private repo since #85), and the SRD 5.2 pack's 38 ("SRD 5.2
Options": 28 invocations, 10 metamagic) in `data/srd52/features.json`, reachable from the
Features & Traits browser to swap one by hand. How
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
- **Every choice and level note a window shows carries `_level`.** The title is derived from them,
  never passed in, so a new source of choices or notes that leaves `_level` off drops out of the
  title's span.
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
- **A first-class Bard had no skill picks (#67).** The 2024 Bard's starting skills are "any 3",
  which the converter dropped, so the pack gave it no level-1 `skill` choice and this window offered
  nothing. The app was right; the data was empty. Fixed in the converter
  ([Converter](../data/converter.md)); `char-update.js` drives a first-class Bard through the real
  pack, and `rules-data.js` fails on any class in any pack that starts with no skills.
- **One level in the title of a window holding three (#69).** The title took the first choice's
  `_level`, so Add class at 3 said "Level 3" or "Level 1" depending on which block led, and spell
  notes carried no level at all. It also `esc()`'d the class name, which `openModal()` writes as
  text, so `&` showed as `&amp;`.
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
| What a choice window's title names (#69) | The span of levels its choices and notes carry, an HP step's own span included; no level when nothing carries one | The first choice's level: whichever block led decided it. A level the caller passes: a second source that can disagree with what the window shows |

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
- A picked subclass's own window carries the class name, like the window before it, so the two
  can share a title ("Fighter — Level 3" twice). Naming the subclass there needs a display name
  apart from the `className` the flow keys on.
- The unreverted Proficiencies text, speed and size. See
  [Known issues](../roadmap/known-issues.md).

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
- 2026-09-28 — a first-class Bard chooses 3 skills from all 18: the pack now carries the level-1
  choice the converter used to drop. No app change. → ledger L3985, #67
- 2026-09-28 — a choice window's title names the span of levels it holds, from its choices and
  notes, and shows the class name as written. → ledger L4086, #69
- 2026-10-09 — The options library: the 2024 pack's in the private repo, the SRD 5.2 pack's here. → ledger L5426, #85
- 2026-10-22 — The class, subclass, species and background windows open by `_id` as well as by name, and gain a reference mode (`{ref:true}`) for the Rules tab's rows, with nothing from the open character. → ledger L6327, #99
- 2026-10-23 — The Class and Ancestry & Background cards go: the header's class line opens a class menu (About, subclass, Level up / down, + Add class, Remove) and the species and background windows gain Change and Remove; species and backgrounds grant languages as chips; Add class with no classes loaded points to Settings → Rules. → ledger L6633, #103
- 2026-10-23 — A class's menu levels that class: ▲ / ▼ pass its index to `doLevelUp(idx)` / `doLevelDown(idx)`; the species button names the subrace. → ledger L6729, #103
- 2026-10-24 — Levelling up (and adding a second class) plays a short scene, then a card listing
  everything the level gave with the hit-point step on it; Done or Continue, closing early asks
  first, and creation keeps the old `hp` block in the choice window. → ledger L6840, #101
