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
`seedLevel1HP()`, `grantClassSaves()`, `multiclassChoices()`, `multiclassNote()`,
`levelRecordFor()`, `levelDownHTML()`, `applyLevelDown()` in
`56-class.js`; `choiceFieldHTML()`, `runChoices()`, `gatherChoices()`, `commitChoices()`,
`effectiveChoose()`, `choiceShortfall()`, `choiceDoneHandler()`, `choiceWarningsConfirmed()`,
`armChoiceDismissGuard()`, `choiceWindowTitle()`,
`choiceLevelSpan()`, `choiceNoteText()`, and for feats (#118) `featCategory()`, `featPrereq()`,
`featUnmet()`, `featOfferable()`, `featAbilityChoices()`, `featPendingIncreases()`,
`asiFeatListHTML()`, `asiPanelHTML()`, `wireAsiFeats()`, `asiPickWarnings()`,
`asiScreenPicks()`, `commitAsiPick()`, `commitExtraChoices()` in `58-choices.js`;
`openAddRace()`, `applyRace()`, `racesForCharacter()` in `52-race.js`; `openAddBackground()`,
`applyBackground()` in `54-background.js`; `subclassesFor()`, `addFeatureFromDef()`,
`grantFeatDef()`, `runExtraChoices()` in `50-classrace.js`; `dismissModal()`,
`setDismissGuard()`, `askConfirm()` in `80-modal-forms.js`; `classLineHTML()`, `classFlyHTML()`, `openShFly()` in
`40-sheet.js`; `raceInfoFoot()` in `52-race.js`, `bgInfoFoot()` in `54-background.js`;
`grantLanguages()`, `dropLanguages()` in `41-chips.js` · `levelSnapshot()`, `levelGains()`,
`luHPCheck()`, `openLevelUp()`, `levelUpCardHTML()`, `levelUpHPHTML()`, `luSetHP()`, `luFinish()`,
`luDismissed()`, `playLevelUpFx()`, `luSkip()`, `undoLevelUp()`, `undoLevelUpAvailable()`,
`luUndoCard()`, `levelLogRecord()`, `luMaybeSettle()`, `luSettle()` in `57-levelup.js` · **Data:** `choices` on class, subclass and race
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
removing or changing the species takes back ([Grants & provenance](../architecture/grants-and-provenance.md)).
A species grants feats the way a background does (#118):
- **A fixed `feat`** (a string, or a one-item array) is granted through `grantFeatDef()` with the
  race origin.
- **An array of two or more is a choose-one menu**, as a background's is. It is queued as
  `{type:"feat", from:[…]}`.
- **Each `{type:"feat"}` in `choices`** is queued with the `race:` sid. That includes Human's
  Versatile, `{type:"feat", category:"origin", label:"An Origin feat of your choice"}`.

Queued skill and feat choices then open through `runExtraChoices()`. Each feat choice there is the
ASI step's list without its ASI row (below).
`openRaceInfo(idOrName,opts)` opens by the pack entry's `_id` as readily as by name, and the Rules
tab's Species rows open it with `{ref:true}` (#99): the window shows the species' own rules with no
"— selected" mark, since there is no character to mark it against.

**Background.** `openAddBackground()` previews the 2024 shape: the three eligible abilities as
+2/+1 or +1/+1/+1, a feat (a select when the background offers more than one), the granted skills,
tools and languages. `applyBackground()` adds the ability feature, the skill grants, the feat through
`grantFeatDef()`, the single background `feature`, `equipmentGrants`, appends tools to
Proficiencies, and grants its `languages` as chips stamped `bg:<Name>`. A `{type:"feat"}` in a
background's `choices` is queued with the `bg:` sid and opens the same list as a species' (#118).
No shipped background carries one yet. `openBackgroundInfo(idOrName,opts)` opens by id as well as by name, and
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
which focuses the card; otherwise one 2.4s timer, the scene's only end, calls `luSkip()`), then
shows the card (`levelUpCardHTML()`): a header naming the class and levels, `levelGains()`'s rows
(new features — tagged with the subclass, and warned "they don't stack" only when the feature is on
`LU_NO_STACK`, Extra Attack or Unarmored Defense, and is already held from a *different* class —
choices still to make, new or changed resources, new or bigger spell slots, a rising proficiency
bonus, then the pack's own notes, only the highest level's when a second class arrives above level 1,
`luLatestNotes()`), and the hit-points step at the foot (`levelUpHPHTML()`): the same controls, wording
and order as the hit-dice spend box ([Vitals & rest](vitals-and-rest.md)) — Roll for me, "I rolled"
plus Apply (live-checked by `luHPCheck()`, n dice for a second class arriving above level 1), or
Take the average. **Done** (nothing left to choose) or **Continue to your choice ▸** both stay
disabled until HP is set (`luSetHP()`); a value that fails takes back any earlier one and disables
them again, so the card never commits a number it no longer shows. Either commits it (`commitHPChoice()`, which raises Max and
Current and puts the lock back only if it was locked) and Continue then opens the usual choice
window, `runChoices(cls, choices, [], pending)` — no `notes`, since the card already showed them,
and no `hp` block, since the card already asked for it. **Closing the card early** (`luDismissed()`,
wired through `setDismissGuard()` directly in `showLevelUpCard()`, with `LU_HP_CLOSE`; the choice
windows' `armChoiceDismissGuard()` only shares that string) asks first when HP isn't set; either
way the choices and any pending window (a second class's starting equipment) still open, because a
choice the player never saw must not vanish with the card. **A level-up belongs to its character**:
`_lu.id` is the `activeId` it started on, and the scene's end, Done and closing drop one whose
character has changed (`luStale()`): no card, no HP, no choices. Loading, importing or starting a
character, or going Home, calls `luAbandon()` first, which ends a playing scene and closes an open
card. **Creation is unchanged**: a first class
added above level 1 still gets its `{type:"hp"}` block inside the choice window for levels 2..N
(see the table below), because creation has no fanfare.

**Undo level-up (#118).**
- **The copy.** `doLevelUp()` stores `_undo`, a JSON copy of the character, before it changes
  anything, and marks a level-up as in progress. `_undo` is a variable in `57-levelup.js`, never a
  field of `character`, so it is never saved.
- **The card.** The card carries **Undo level-up** beside Done or Continue. `luUndoCard()` drops the
  level-up first, so closing the card neither commits its HP nor opens its choices, then restores
  the copy with `undoLevelUp({force:true})`.
- **Settling.** A level-up spans the card and every window behind it: the choices, a subclass's
  own window, and the Choose window. `closeModal()` and `scheduleSave()` both call
  `luMaybeSettle()`, which waits one turn of the event loop. A window that closes only to open the
  next one is therefore still seen as open. When the last window has closed, by Done or by
  Escape, `luSettle()` runs once:
  1. it writes the `levelLog` record (below);
  2. it takes a signature, the sheet as JSON, after the record;
  3. it saves;
  4. it toasts "Fighter is now level 8 · Max HP 61 → 68" with **Undo**.

  The toast carries the HP because it replaces the HP step's own toast.
- **When Undo is offered.** `undoLevelUpAvailable()` is true only while the sheet is exactly as the
  level-up left it, meaning `JSON.stringify(character)` still equals the signature. Any edit after
  the level-up spends it, and saving alone does not. The toast's Undo after a change answers "Undo is no longer
  available: the sheet has changed since the level-up." and changes nothing.
- **Restoring.** `undoLevelUp()` restores the copy exactly (`JSON.parse`, no `migrate()`),
  re-renders, saves, and says "Level-up undone". The toast stays reachable over a modal, so first
  it closes any open window, which is about the sheet being replaced: a Level down dialog left open
  would act on the restored sheet. It clears `_undo` before that `closeModal()`, so the close's
  settle hook records nothing.
- **When it ends.** `luAbandon()` clears the copy, so loading, importing or starting a character,
  or going Home, ends it. A reload ends it too.

**The level log (#118).** Each settled level-up appends one record to `character.levelLog`, from
`levelLogRecord(before, after, cls, level)`:

```
{at, class, level, hp, features:[{id, name, grants}], abilities, subclass, grants, slots:{before, after}}
```

- `features` lists the new features whose origin is that class and level: traits, the ASI or the
  feat.
- A feature's `grants` are the new proficiencies tied to it. A grant is tied only when exactly one
  of the level's new features is an embedded class or subclass trait whose rules entry grants that
  proficiency outright (`lvFeatureGrantKeys()`). A level's skill pick, a feat's skill choices and
  anything ambiguous stay untied, in `grants` only.
- The log keeps the newest 200 records. `removeClass()` drops that class's records.
- `migrate()` keeps only well-formed records, and normalizes the inside of each without dropping
  its other keys ([Character model](../architecture/character-model.md)). `levelDownHTML()` and
  `applyLevelDown()` read a record's features and grants through `lvRecFeats()` and
  `lvRecGrants()`, so a malformed one can't make Level down throw.

**Level down** (`doLevelDown(idx)`). From a class's menu it lowers that class, and at level 1 says
to use Remove in the class's menu. With no index it lowers the one class above level 1, or asks
which when there are several. What happens next depends on whether `levelRecordFor()` finds the
newest record for that class at its current level:
- **With a record**, the "Level down" dialog (`levelDownHTML()`) reads "Fighter 8 → 7. Level 8 gave
  you:", then:
  - **Ticked boxes**, for "+7 hit points (max HP 68 → 61)" and each feature still on the sheet,
    for example "Feat: Grappler (+1 Dexterity)". A feature's tied grants are named with it ("…, and
    the proficiency it gave: Survival") and go with it.
  - **What changes by itself:** proficiency bonus, spell slots and class resources.
  - **What to adjust by hand:** the subclass, untied grants, and any spells you learned.

  **Level down** calls `applyLevelDown()`, which removes what is ticked, lowers the level, and
  deletes the record whatever was ticked. A feature removed by hand since is skipped, and the dialog
  says how many. The button passes what the dialog showed: the class entry, its level and the
  record. If the sheet has changed under the dialog, `applyLevelDown()` changes nothing and toasts
  "The sheet changed while Level down was open, so nothing was changed. Open Level down again."
- **With no record** (a level gained before #118), it lowers only the number and toasts "Only the
  level is lowered: traits, proficiencies and choices you've gained are kept."

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
| `asi` | the ASI step (#118, below): a list with Ability Score Improvement pinned first, and a panel. With Feats allowed off, +2 to one or +1 to two, as before | `commitAsiPick()`: an "Ability Score Improvement" feature carrying the effects, or the feat with its +1 |
| `feat` | on a species or background, or with a `category` and no `from`: the ASI step's list with no ASI row. On a class level: a select over `from`, or every loaded feat | `commitAsiPick()` with the species or background origin; a class level's select through `grantFeatDef()` |
| `subclass` | radios with pack and description | `selectSubclass()` after the rest commits |
| `hp` | a dice box, Roll for me, and the working ("Average 6 + 2 CON = 8 HP") — creation only now: a level-up or a second class gets the level-up card's own HP step instead (#101) | `commitHPChoice()` |

`effectiveChoose()` sets how many new picks a block asks for: granted options do not spend the
budget, but it never asks for more than remain. The target is written as `data-choose` on the
`.choice` wrapper; a `change` listener on the modal calls `syncChoiceLimits()`, which disables the
unticked boxes once the block is full and re-enables them off `data-fixed`, never off `checked`. On
Done is `choiceDoneHandler(btn, commit)`, in both choice windows (`runChoices()`,
`runExtraChoices()`). It asks its warnings in the app's warning window (`askConfirm()`,
[Shell](../ui/shell.md)), over the choice window, which stays open while it asks:
- **Picks left** (Go back / Continue anyway), with `choiceShortfall(choiceBlocks())`'s text;
- then, one feat at a time, the prerequisite warning below.

`choiceWarningsConfirmed()` asks them in turn and stops at the first "no", which leaves the window
open with every pick. Only then does `commit` read the picks: `gatherChoices()` reads only checked,
**enabled** boxes, and `commitChoices()` grants, renders, then opens the next window.
- **Nothing to ask:** Done commits at once, in the same task, as it always has.
- **Something to ask:** pressing Done again while a warning is open does nothing, so a double press
  can't commit twice. If the window went while the question was open (its Done is out of the page),
  nothing commits.

**The ASI step (#118).** At an `asi` choice the player takes the Ability Score Improvement or a feat,
in one list (`asiFeatListHTML()`).

- **The list.**
  - It has a search box (it matches the name only, and never hides the pressed row) and a
    **Show all** switch.
  - **Ability Score Improvement** is pinned first and pressed to start, with the subline "+2 to one
    score, or +1 to two" and the tag General.
  - Then come the offered feats, by name. Each shows a short line and a tag.
    - The short line (`asiFeatShort()`) is its increase and its first benefit's name. The increase
      reads "+1 Str or Dex", or "+1 any" when all six abilities are allowed, as most Epic Boons'
      are. The first benefit is the first "Name: …" line that isn't a `Repeatable:` or
      `Prerequisite:` line, so Skilled has none.
    - The tag is its category, or, under Show all, the first unmet prerequisite in amber ("needs
      the Fighting Style feature").
  - A row's key is the feat's `_id` when the merge gave it one, else its name, because two packs
    can share a name.
- **What is offered** (`featOfferable()`, Show all off):
  - **The category** is read from the feat's first line (`featCategory()`). General feats are
    offered when their prerequisites are met. Origin feats are not (backgrounds and species grant
    them). Fighting Style feats need a feature named "Fighting Style". Epic Boons need a level-19
    choice. A feat with no category line is offered when its prerequisites are met.
  - **Prerequisites** come from "Prerequisite:" on that line (`featPrereq()`). The parts it reads
    are `Level N+`, `<Ability> N+` (after effects, through `abilFinal()`), "Spellcasting feature"
    (a caster class by `classCasterKind()`, Pact Magic excluded, or a feature named Spellcasting),
    "Spellcasting or Pact Magic feature" and "Fighting Style feature". The text can hold "or"
    groups and parts joined by "and" or commas. An unknown part is shown and never counts as unmet.
    `featUnmet()` says what is missing. A part every alternative shares (Grappler's "Level 4+")
    is listed on its own. What is left of the alternatives is one entry naming them all: "Strength
    13 or Dexterity 13 (yours: Strength 10, Dexterity 10)". With a single alternative each unmet
    part is its own entry, "Strength 13 or higher (yours is 12)". The amber tag shows the first
    entry, and the warning joins them with "and".
  - **A feat already taken** is hidden unless its text has a `Repeatable:` line. The rules entry
    named "Ability Score Improvement" is never listed.
- **Show all** lists every loaded feat. It lifts every filter, a species list's category included
  (Ruling 6, Mike's "turn off that filter and see all feats"). A fixed `from` menu is the one thing
  it never widens.
- **The panel** (`asiPanelHTML()`):
  - **For the ASI**, today's +2 / +1+1 controls.
  - **For a feat**, its text below the category line (escaped, in paragraphs), then one "+1 to:"
    chip group per choose increase, the first option pressed. A fixed increase is shown as text.
  - **The increases** come from the feat's `ability` field, else from "Increase your A, B, or C
    score by N" in its text (`featAbilityChoices()`). `featPendingIncreases()` drops anything the
    feat's own `effects` already raise, so a pack that carries both never gives +2.
- **Done.**
  - **The warning.** For each pressed feat (`asiScreenPicks()`) with unmet readable prerequisites,
    `asiPickWarnings()` writes the sentence: "Grappler needs level 4 or higher (yours is 1) and
    Strength 13 or Dexterity 13 (yours: Strength 10, Dexterity 10). Take it anyway?" Done asks it in the warning window, titled
    "Prerequisite not met", with **Choose another** and **Take it anyway**, one feat at a time. It
    never blocks. Choose another keeps the step open with the pick.
  - **The grant.** `commitAsiPick()` stores the ASI as before. A feat goes through `grantFeatDef()`
    with the class-level origin `{kind:"class", class, level}`, and its +1 is added as an
    `ability.<k>` effect on that same feature, so removing the class removes both.
  - **No pick.** A list with no row pressed commits nothing.
- **Feats allowed off** (`character.featsAllowed === false`, Settings → Sheet display) draws exactly
  the old controls, with no list. The feats a character already has stay.
- **Level 19.** `applyClassLevel()` adds `{type:"asi", boon:true}` at level 19 when the level has a
  trait named exactly "Epic Boon" and no `asi` choice of its own. The trait is still added. The
  card's row reads "Epic Boon — a feat, or an Ability Score Improvement" (`LU_CHOICE.boon`), and the
  step offers Epic Boons as qualified. While feats are allowed, that choice row is the card's only
  Epic Boon row: `levelGains()` leaves the trait's feature row off, and the trait is still on the
  Features card. With Feats allowed off it is a plain ASI, and the feature row stays.
- **Species and background feat choices** use the same list with no ASI row and nothing pressed to
  start (Ruling 9). This applies to every `{type:"feat"}` queued with a `race:` or `bg:` sid, and
  any with a `category` and no `from`.
  - With a `category` it is filtered to that category.
  - With a `from` menu it lists exactly those feats, and a name with no loaded feat still gets a
    row.
  - With neither (Tasha's Custom Lineage) it offers Origin feats, plus General and Fighting Style
    feats whose readable prerequisites are met. Epic Boons appear only under Show all.

  Feats allowed off does not hide this list: it is the species' own feat, not the optional rule.
  `data-choose="1"` asks for the pick only when the list has a row. `commitExtraChoices()` grants it
  with the origin its sid names, and a picked feat's own skill choices open as the next window. A
  class level's `{type:"feat"}` keeps its select.

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
- **Nothing may `openModal()` over the level card.** `openModal()` clears the dismiss guard, so
  `luDismissed()` would not run, and the level's HP and choices would be lost.
- **Every way on from a level-up checks its character.** `showLevelUpCard()`, `luFinish()` and
  `luDismissed()` go through `_lu.id`, and a new path that replaces `character` calls
  `luAbandon()` first, as `loadCharById()`, `newCharacter()`, `finishImport()` and `showHome()` do.
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
- **The undo copy is never part of `character`** (#118). `_undo` lives in `57-levelup.js`, so no
  save or export carries it, and every path that replaces `character` ends it through
  `luAbandon()`.
- **The signature is taken after the record is written,** and `luSettle()`'s save leaves
  `character` alone. Taken before the push, writing the record would spend Undo at once. Six
  tests in `sheet.js` fail if the order flips.
- **A level-up settles once, after its last window.** `luSettle()` gives up while the card is up,
  the scene plays or `#modal` is open. A new window opened behind a level-up must open
  synchronously from the one closing, or the record misses its picks.
- **Level down removes a grant only when it traces to one feature.** Grants carry the class sid,
  not a level or a feature id. Matching more loosely, for example a feat by its rules `skills`,
  which `grantFeatDef()` doesn't grant, could take away a skill the player picked.
- **A feat's +1 lives on the feat's own feature,** so it reverts with whatever granted the feat.
  It is never a separate ASI feature.
- **The feat helpers stay DOM-free:** `featOfferable()`, `featUnmet()`, `asiPickWarnings()`,
  `asiRowHidden()` and the HTML builders. Only `wireAsiFeats()` and `asiScreenPicks()` read the
  document.
- **Done reads the picks after the warnings,** in its `commit`, with the window still open, and
  commits at once when there is nothing to ask. The synchronous flow tests in `char-update.js`
  depend on that.
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
- **A feat's +1 counted twice (#118).** A Humblewood feat (Arboreal Acrobat) carries its +1 as an
  effect and also names it in its text, which the fallback reads, so Dex went 14 → 16. Fixed by
  `featPendingIncreases()`, which drops what the feat's effects already raise.
- **"+1 to:" answers read in order went to the wrong increase (#118).** A fixed increase draws no
  chips, so the groups after it shifted down by one. Each chip carries the index of the increase it
  answers (`data-ft-plus`).
- **Search matched the tag (#118).** Matching a row's whole text matched "st" against "needs the
  Fighting Style feature". It matches the name only.
- **A Warlock met "Spellcasting feature" (#118).** `classCasterKind()` returns `"pact"` for a
  Warlock, which counts only for "Spellcasting or Pact Magic". Reading the class's own
  `spellcasting` field instead missed Eldritch Knights and Arcane Tricksters, whose casting lives
  on the subclass.
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
| Hit points on a level-up | On the level card (#101), Done or Continue waiting for it; creation (a first class above level 1) keeps the choice window's `{type:"hp"}` block | Only unlocking Max: on a subclass level the choice modal was the only thing on screen and the hit points were forgotten. The `hp` block in every level's window (#58): two screens a level once the card came |
| Where a level-up's HP step lives (#101) | On the level card; the choice window follows only when the level has something to choose | In the choice window: two screens every level, even when nothing is chosen |
| An "animate level-ups" setting (#101) | None: reduced motion skips the scene, and a tap, click or Esc skips it at any time | A Settings switch: more surface for a 2.4s moment that can always be skipped |
| What the level card lists (#101) | What changed on the sheet, from `levelSnapshot()` before and after the level (`levelGains()`) | Reading each class's table: misses homebrew and resources, and can claim what the sheet didn't get |
| Which features the card says "don't stack" (#101) | An allowlist, `LU_NO_STACK`: Extra Attack and Unarmored Defense (SRD 5.2.1 p.26) | Any same name from another class: told Spellcasting doesn't stack, a Wizard/Cleric would think the new slots were wrong; Expertise and Epic Boon are separate picks |
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
| Which feats the ASI step offers (#118, decision 1) | The feats the character qualifies for, with Show all; an unmet prerequisite asks "Take it anyway?" at Done and never blocks | Every feat, unchecked: dozens the character can't legally take. Strict, no override: house rules need a manual edit |
| A feat's own +1 (#118, decision 2) | Asked in the same step and stored on the feat, so removing the feat removes it | By hand: the step players forget. A cap of 20: a wider change, since nothing caps scores |
| Level 19's Epic Boon (#118, decision 3) | An ASI level too, detected in the app from the level-19 "Epic Boon" trait; Epic Boons are offered only there | In the converter: every pack's class data would move for what the app can see. Left manual: nothing prompts |
| The step's layout (#118, decision 5) | One list, Ability Score Improvement pinned first (mockup B); 2024 frames the ASI as a General feat | Two tabs, ASI and Feat: one more control, and the book doesn't separate them |
| Species feats (#118, decision 7) | Granted as a background's are: a fixed `feat`, or a feat choice through the same list, reverting with the species | Versatile as prose: the player adds the feat by hand |
| A species `feat` array (#118, Ruling 10) | Choose one, as a background's array | Granting every entry: backgrounds already read an array as a menu |
| A species or background feat choice with no category (#118, Ruling 9) | The list: Origin feats plus General and Fighting Style feats whose readable prerequisites are met; Epic Boons only under Show all | The old full select: no text, no warning, no +1 (Tasha's Custom Lineage) |
| What Show all lifts (#118, Ruling 6) | Every filter, a species list's category included; a fixed `from` menu stays | Keeping the category: Show all is the house-rule escape hatch |
| The unmet-prerequisite warning (#118, Ruling 2; Mike 2026-10-27) | The app's warning window with the spec's sentence and its buttons, Choose another / Take it anyway; the shortfall warning moves into it too (Go back / Continue anyway) | The browser's `confirm` (as first built): its buttons can only say OK and Cancel |
| The Epic Boon rows on the level-19 card (#118, Mike 2026-10-27) | One: the choice row while feats are allowed; the feature row only with Feats allowed off | Both, as §5 first read: the same thing listed twice |
| When Done commits with nothing to ask (#118) | At once, in the same task | Always after a promise: every flow behind the window would change timing for no question asked |
| Undo after a level-up (#118, decision 8) | A copy taken before the level-up; the card and its toast offer Undo while the sheet is exactly as the level-up left it (a signature) | A general per-level revert: too much isn't recorded per level. Cleared by the next save (spec §5a as first written): the level-up's own saves would spend it |
| Level down (#118, decision 9) | Every level-up records what it gave; level down removes the ticked HP and features (with grants traced to one feature) and lists the rest; a level with no record lowers only the number | Number only: the player has to remember what the level gave |

## Open

- **A feat's fixed `skills` are not granted** by `grantFeatDef()`, and the ASI's "+1 to two" accepts
  the same ability twice. Both predate #118 ([Known issues](../roadmap/known-issues.md)).
- **The choices inside a feat stay by hand:** its spells, tools, damage types, Resilient's saving
  throw and Weapon Master's mastery. Only its +1 is asked.
- **Deferred from #118's review.** None blocks a level-up:
  - An error part-way through `doLevelUp()` can leave a settle armed for the next unrelated edit.
  - The toast's Undo stays clickable after a change. It answers "no longer available" instead of
    disappearing.
  - Subclass traits below the reached level, picked late, aren't in the record.
  - With max HP blank, the dialog reads "max HP 0 → 1".
  - The dismiss guard doesn't count a feat pick (as before #118, for the ASI).
  - `sidLabel()` cuts a colon-named species in its "from …" label.
- A class's gold alternative uses the average of its dice, not a roll.
- The Humblewood Gadgeteer has no `multiclass` data (no Humblewood source defines it), so a
  multiclass Gadgeteer is offered no class skills and told so. The pack's Artificer carries TCE's
  2014 multiclass row, because that is the printing the pack holds.
- A first class added above level 1 and then removed keeps the Max HP its window added; the un-seed
  only recognises a level-1 seed ([Vitals & rest](vitals-and-rest.md)).
- A feat picked from the Features & Traits browser gets no skill-choice prompt:
  `grantFeatDef()` only queues those when there is an origin sid.
- Level down lists a level's skill picks, its subclass and its spells to adjust by hand, and a
  level gained before #118 has no record, so level down keeps everything from it:
  [Grants & provenance](../architecture/grants-and-provenance.md).
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
- 2026-10-24 — The final review's fixes: only Extra Attack and Unarmored Defense say "they don't
  stack"; a failed Apply takes the earlier HP back; a level-up whose character changed is dropped;
  one spell note per class. Closing early is wired through `setDismissGuard()`, and the timer is
  the scene's only end (correcting L6840). → ledger L6928, #101
- 2026-10-27 — At an Ability Score Improvement, the ASI or a feat from one list, with Show all,
  the prerequisite warning and the feat's +1; Feats allowed; level 19's Epic Boon; species and
  background feat choices through the same list; Undo level-up while the sheet is unchanged; each
  level-up records what it gave, and level down shows it and removes the ticked HP and features.
  → ledger L7569, #118
- 2026-10-27 — The final review's fixes: Undo closes an open window, and a stale Level down
  dialog changes nothing. A malformed level record can't make Level down throw. A feat's short
  line skips `Repeatable:` and `Prerequisite:` lines, and reads "+1 any" for all six abilities.
  → ledger L7657, #118
- 2026-10-27 — The choice windows' two warnings (picks left, a feat's unmet prerequisite) ask in the
  app's own warning window with named buttons; Done reads the picks after them and commits once.
  Epic Boon shows once on the level-19 card. → ledger L7710, #118
- 2026-10-27 — Fix round 1: an "or" prerequisite is named whole ("Strength 13 or Dexterity 13"), not just its closest alternative. → ledger L7710, #118
