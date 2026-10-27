# Feat support: design

**Status:** approved in conversation 2026-10-26 and 2026-10-27; built 2026-10-27 on `issue/118-feats`
(see As built, at the end). It is wave 3b of
[1.9.0](../wiki/roadmap/1.9.0.md).
**Issue:** #118 (Feat Support). One branch, `issue/118-feats`.
**Mockup:** `.superpowers/brainstorm/32894-1793047656/content/asi-or-feat.html`. Layout B was chosen: one list,
with Ability Score Improvement pinned first.

**Read first:**
- [Character building](../wiki/features/character-building.md): the choice modal, `asi`/`feat` choices, level-up.
- [Grants & provenance](../wiki/architecture/grants-and-provenance.md): origins and clean revert.
- [Abilities & skills](../wiki/features/abilities-and-skills.md): `abilFinal()`, base plus effects.
- [Converter](../wiki/data/converter.md): the byte-for-byte gates, and how [private data](../wiki/data/private-data.md)
  moves.

---

## 1. What it is

At every Ability Score Improvement level, a player can take the ASI or a feat. Those levels are the ones whose
class data has an `asi` choice (4, 8, 12 and 16 in every shipped class), plus level 19's Epic Boon.

The choice step is one list. **Ability Score Improvement** is pinned first. Below it come the feats the character
qualifies for, and a **Show all** switch lists every feat. The step's lower half depends on what is chosen:
- **The ASI:** today's +2 / +1+1 controls.
- **A feat:** its text, and, when the feat raises a score, a "+1 to: [X / Y]" choice.

Choosing a feat whose prerequisites aren't met and pressing Continue asks first. It never blocks.

A per-character setting, **Feats allowed**, is on by default. Turned off, the step is the ASI controls alone,
exactly as today. Turning it off never removes a feat the character already has.

The converter keeps each feat's structured ability increase (5etools' `ability` field), which it drops today. This
lets the app ask for a feat's +1 without reading its text. The rules packs that carry feats change as a result:
SRD 5.2, and the private 2024, Xanathar's and Tasha's packs. Each needs a data release, which Mike cuts.

Three more pieces were added on 2026-10-27:
- a species grants feats the way a background does, so Human's Versatile asks for its Origin feat;
- **Undo level-up**, straight after a level-up;
- a record of what each level gave, which level down shows and can partly revert.

## 2. Decisions

All made by Mike in conversation on 2026-10-26.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Which feats the picker offers | **The feats the character qualifies for, with a Show all switch. A feat whose prerequisites aren't met asks "Take it anyway?" on Continue, and never blocks** | Every feat, unchecked: dozens the character can't legally take. Strict, with no override: house rules need a manual edit |
| 2 | A feat's own +1 | **Asked in the same step, and stored with the feat**, so removing the feat removes the +1 | By hand: the step players forget. A cap of 20: a wider change (nothing caps scores today) |
| 3 | Level 19's Epic Boon | **An ASI level too, detected in the app** from the class's level-19 Epic Boon trait. Epic Boon feats appear only there. Rules data is not changed for this | In the converter: every pack's class data would move for something the app can see. Left manual: nothing prompts the player |
| 4 | The setting's default | **"Feats allowed" is on for every character.** Feats are core in 2024 and SRD 5.2, and Humblewood's own text offers them | Off for Humblewood: its text says otherwise. Asked once: one more dialog |
| 5 | The layout | **One list with Ability Score Improvement pinned first** (mockup B), as the 2024 book frames ASI as a General feat | Two tabs, ASI and Feat: one more control, and the book doesn't separate them |
| 7 | Species feats | **A species grants feats the same way a background does:** a fixed `feat`, or a feat choice. The converter writes 5etools' race `feats` as `choices:[{type:"feat", category:"origin"}]` (Human's Versatile) or a fixed `feat`. The same list opens, filtered to Origin feats, and the feat reverts with the species | Leaving Versatile as prose: the player adds the feat by hand (2026-10-27) |
| 8 | Undo | **Undo level-up**: a copy of the character is saved just before a level-up. The level-up card and its toast offer Undo, which restores it exactly. Undo goes away at the next change to the sheet | A general per-level revert: too much is not recorded per level (§10) |
| 9 | Level down | **Every level-up records what it gave.** Level down shows that record, removes the HP and that level's features and feats where the player leaves the boxes ticked, and lists the rest to adjust by hand. Levels with no record (from before this) keep today's number-only behaviour | Number only (today): the player has to remember what the level gave (2026-10-27) |
| 6 | Where a feat's +1 comes from | **The converter keeps 5etools' structured `ability` field on each feat.** The app reads it first, then falls back to the feat's text ("Increase your X, Y, or Z score by 1") for packs without it, which covers Humblewood and homebrew | Text only: the 2024 and SRD packs don't carry the sentence (the converter drops it), so 55 of 77 2024 feats would get nothing |

## 3. Data

### 3.1 The `ability` field on a feat (rules data)

The field is optional. The converter writes it from 5etools' `feat.ability`:

```json
"ability": [ { "choose": ["str", "dex"], "amount": 1 } ]
"ability": [ { "str": 1 } ]
"ability": [ { "choose": ["str", "dex", "con", "int", "wis", "cha"], "amount": 1, "max": 30 } ]
```

- Each array entry is one increase. It is either `{"choose": [abil…], "amount": N}` (the player picks one of
  `choose`) or fixed amounts `{abil: N}`.
- `max` is the score cap the feat states. It is kept for display only; nothing enforces it.
- Entries 5etools marks `hidden` are skipped. Only the Ability Score Improvement feat has them, and the app
  provides that one itself.
- Ability keys are `str`, `dex`, `con`, `int`, `wis` and `cha`, matching the app's ABIL keys.
- `docs/rules-schema.md` documents the field in its feats section, for pack authors.

**Gates.**
- The SRD gate `diff -r` (CLAUDE.md, Converter) now shows exactly one kind of change: the `ability` field on
  `feats.json` entries.
- Every other file must still match byte for byte.
- The private packs are regenerated with `python3 scripts/sync-private.py --write`, and their diff is the same
  single change.
- The SRD verbatim suite must still pass. The field is data, not prose.

### 3.2 The character

- `character.featsAllowed`: a boolean. Its default is `true` in `blankChar()`. `migrate()` keeps a boolean and
  sets anything else to `true`.
- A feat taken at an ASI level is one feature, granted through `grantFeatDef()` with the origin
  `{kind:"class", class, level}`. This is the origin an ASI already uses, so removing the class removes it. Its
  +1 is stored as an effect on that same feature: `{target:"ability.<k>", value:N}`. Fixed increases are stored
  the same way.
- An ASI taken is stored exactly as today.
- `character.levelLog`: an array, default `[]`. One record per level-up from now on:
  `{at, class, level, hp, features:[{id, name}], abilities:{k:+n}, subclass, grants:[{type, key}], slots:{before, after}}`.
  `migrate()` keeps well-formed records and drops the rest.
- `character._undo` is never saved. It is an in-memory copy of the character from just before the last
  level-up, with the time of that level-up.

### 3.3 Species data

The converter writes 5etools' race `feats` on the species, using the same shapes a background's feat already uses:
- `[{"anyFromCategory":{"category":["O"],"count":1}}]` (Human, XPHB) becomes
  `"choices":[{"type":"feat","category":"origin","label":"Versatile: an Origin feat"}]`;
- `[{"any":1}]` becomes `"choices":[{"type":"feat"}]`;
- a named feat (`{"alert|xphb":true}`) becomes `"feat":"Alert"`, as backgrounds have it.

The species' `traits` are unchanged. The SRD and private gates (§3.1) now show this field on `races.json` too.

## 4. The choice step

It applies to every `asi` choice, and to level 19 when §5 makes it one.

- **List.** A search box, a **Show all** switch (off), and a scrolling list. The rows, in order:
  1. **Ability Score Improvement**, always first. It has the subline "+2 to one score, or +1 to two" and the
     tag General.
  2. Every other offered feat, sorted by name. Each row shows its name, a short line ("+1 Str or Dex", or the
     first benefit's name), and a tag: the category, or the unmet prerequisite in amber when Show all lists it.
- **Which feats are offered** (Show all off):
  - **Category**, read from the feat's first line ("General feat", "Origin feat", "Fighting Style feat",
    "Epic Boon"):
    - General is offered.
    - Origin is not, because backgrounds grant it.
    - Fighting Style only when the character has a feature whose name contains "Fighting Style".
    - Epic Boon only at a level-19 choice.
    - A feat with no category line is offered.
  - **Prerequisites the app reads** (§6). A feat is offered when they are met, or when it can't read them.
  - **Already taken.** A feat the character already has is hidden unless its text contains "Repeatable".
    Ability Score Improvement is always listed.
  - **Not offered.** The rules feat named "Ability Score Improvement" is never listed, because the pinned row
    replaces it.
- **Show all** lists every loaded feat, Origin and Epic Boon included, along with feats already taken.
- **Below the list:**
  - **Ability Score Improvement chosen:** today's +2 to one, or +1 to two, controls.
  - **A feat chosen:** its description (escaped, with paragraphs). If the feat's `ability` gives a choice, a
    "+1 to:" segmented control lists its options. The first is selected, and fixed increases are shown as
    text. With no `ability` field, the app reads "Increase your A, B, or C score by N" in the text the same way.
    A feat with neither gets no control.
  - **Nothing chosen:** the ASI is selected by default, so the step always has a valid pick.
- **Continue.** If the chosen feat has unmet prerequisites the app could read, it asks: "*Feat* needs
  *what's missing* (yours is *value*). Take it anyway?", with **Choose another** and **Take it anyway**. The
  wording lists every unmet part.
- **Feats allowed off.** The list and the switch aren't drawn. The step is the ASI controls, exactly as today.
- A feat's own skill choices still follow, behind the step, when a pack carries them in structured form.
  No 2024 or SRD feat does today, so in practice the choices inside a feat, such as spells, tools, damage types,
  a saving throw or a weapon mastery, remain by hand (§12).

### 4.1 Species and backgrounds

A `feat` choice on a species or a background (`{type:"feat", category:"origin"}`) opens the same list:
- It is filtered to that category, with Show all available, and the same panel and the same +1 question appear.
- It has no pinned Ability Score Improvement row.
- With Feats allowed off it is still offered, because a species' feat isn't the optional ASI-or-feat rule.

The feat is granted with the species or background origin, so changing or removing the species reverts it, as a
background's feat does now.

## 5. Level 19

`applyClassLevel()` reads a class level's `choices`. When the class's level 19 has no `asi` choice but carries a
trait named "Epic Boon", that level is treated as having `{type:"asi", boon:true}`:
- The level-up card's choice row says "Epic Boon — a feat, or an Ability Score Improvement".
- The step offers Epic Boon feats as qualified.

With Feats allowed off it is an ASI, as the older rules have it. The trait itself is still added as today.

## 5a. Undo level-up

- **Saving the copy.** `doLevelUp()` saves `_undo = {copy, at}`, a deep copy of the character, before it
  changes anything (corrected as built: `openLevelUp()` runs after the level is applied; see As built,
  Ruling 1).
- **Where Undo appears.** The level-up card shows **Undo level-up** next to Done, and the toast after the
  level's choices offers Undo too.
- **What Undo does.** It restores the copy, re-renders, saves, and says "Level-up undone".
- **When it goes away.** Undo is offered only while the sheet is exactly as the level-up left it. When the
  level-up's last window closes, the app takes a signature of the sheet. Any later change spends Undo, and a
  save alone does not. Switching character clears the copy (corrected as built: this sentence first said
  the next `scheduleSave()` clears it, but the level-up's own saves would have spent it).
- **Lifetime.** The copy is never saved, so a reload ends it.

## 5b. Level down with a record

At the end of a level-up, after its choices are committed, the app writes one `levelLog` record. It holds:
- the HP added;
- the ids and names of features whose origin is that class and level, which includes an ASI or a feat;
- the ability changes from those features' effects;
- the subclass, if it was chosen at that level;
- the skill and other grants added during the level-up;
- spell slots before and after.

`doLevelDown()` finds the newest record for that class and level and shows a dialog:
- **A heading:** "Fighter 8 → 7. Level 8 gave you:".
- **Two ticked boxes, for what Fieldbook can remove exactly:**
  - "+7 hit points (max HP 68 → 61)";
  - "Feat: Athlete (+1 Strength)" and each other feature by name.
- **A list of what changes by itself:** proficiency bonus, spell slots and class resources.
- **A list to adjust by hand:** granted skills, the subclass, and spells you learned.
- **Buttons:** **Level down** and Cancel.

On Level down it lowers the level, removes what was ticked, deletes the record, re-renders and saves. A level
with no record shows today's notice and lowers only the number.

## 6. Reading prerequisites

`featPrereq(feat)` reads the feat's first line, after "Prerequisite:". It returns alternatives: an "or" list of
"and" groups. The parts it understands:
- `Level N+` means the character's total level is N or more.
- `<Ability> N+` means that score is N or more, after all bonuses, as `abilFinal()` computes it.
- `Spellcasting feature` means the character has any spellcasting class or a feature named "Spellcasting".
  `Spellcasting or Pact Magic feature` also accepts a feature named "Pact Magic".
- `Fighting Style feature` means the character has a feature whose name contains "Fighting Style".
- Anything else is unknown. It is shown on the row and never counts as unmet.

A feat qualifies when any alternative has every known part met. The mismatch text names the closest
alternative's unmet parts.

## 7. Settings

The Sheet display page gets a **Feats allowed** switch, next to Advancement in "Levels and companions". The
help text is: "Offer a feat instead of an Ability Score Improvement. Turning it off keeps the feats you have."

## 8. Code

- `scripts/convert.py` `convert_feats()`: write `ability` as in §3.1. The supplement and private paths inherit it.
- `src/js/58-choices.js`:
  - the `asi` branch of `choiceFieldHTML()`, `gatherChoices()` and `commitChoices()` gain the list, the
    lower panel and the warning;
  - the existing `feat` type is unchanged.
- `src/js/56-class.js` `applyClassLevel()`: the level-19 Epic Boon rule (§5).
- `src/js/57-levelup.js`: the `LU_CHOICE` text for a boon choice.
- New helpers, placed with the feat helpers in `85-browse.js`, or in `58-choices.js` if that reads better:
  - `featPrereq()` and `featQualifies()`;
  - `featAbilityChoice()`, which uses the field first and the text second;
  - `featOffered()`.
- `00-constants.js` `blankChar()` and `71-char-io.js` `migrate()`: `featsAllowed`, `levelLog`.
- `src/js/52-race.js`: a species' `feat` and `choices` handled the way `54-background.js` handles a background's.
- `src/js/57-levelup.js` and `56-class.js`: the undo copy and button, the level log record, and the level-down
  dialog.
- `88-settings.js`: the switch.
- `src/css/50-modal.css`: the list and the panel, with 44px targets and no sideways scroll at 390px.
- `docs/rules-schema.md`: the feat `ability` field.

## 9. Edge cases

- **Multiclass:** each class's ASI levels are its own, as now. A feat taken through one class reverts with that
  class.
- **Level-down** keeps the feature, as level-down does today. The known issue already records this.
- **No feats loaded:** the list is just the pinned ASI row.
- **A feat that gives +1 to a fixed score** (`{"str":1}`): applied with no control.
- **A feat with two increases:** one control per choose entry.
- **Undo after another change:** not offered (§5a).
- **Level down twice in a row:** each step uses its own level's record. A record is deleted once it is used.
- **A record whose feature was deleted by hand since:** that box is skipped, and the dialog says so.
- **Re-opening the step after Back:** selections are kept where the modal already keeps them.
- **Hostile feat text from a pack:** every string is escaped, as everywhere.

## 10. Why level down doesn't revert everything

- **Features, and the ASI or feat:** can be reverted exactly, because they carry their class and level.
- **Skill and proficiency grants:** recorded against the class as level 1, so a level's own grants can't be told
  apart in older characters.
- **HP gained:** not recorded per level before this change.
- **Edits made by hand afterwards:** a blind revert could delete them.

The record (§5b) covers everything levelled from now on. Anything it can't remove exactly is listed for the
player.

## 10a. Testing

- **converter suite:**
  - `ability` is written for choose, fixed and max entries;
  - hidden entries are skipped;
  - only `feats.json` changes in the SRD diff (the gate in CI);
  - the private repo's sync diff is the same single change.
- **sheet or rules-data suite:**
  - `featPrereq` on every prerequisite string in the SRD and 2024 data (a fixture copied from §6's survey);
  - `featQualifies` for level, ability (after effects), "or" groups, the spellcasting and fighting-style
    features, and unknown parts;
  - `featAbilityChoice` from the field, from the text, and from neither;
  - the offered list for a level-8 Fighter, a level-19 Wizard, Show all, and an already-taken non-repeatable
    feat;
  - commit:
    - an ASI is stored as today;
    - a feat is stored with its class-level origin and its +1 effect;
    - removing the class removes both;
  - the unmet-prerequisite confirm, both answers;
  - Feats allowed off draws today's controls;
  - the level-19 Epic Boon detection;
  - `migrate` defaults `featsAllowed` and cleans `levelLog`;
  - species: Human's Versatile opens an Origin-filtered list, and removing the species removes the feat;
  - undo restores the exact pre-level-up character, and is gone after the next change;
  - level-up writes a record, level down removes ticked HP and features, and a level without a record keeps
    today's behaviour;
  - escaping of feat names and descriptions.
- **Screenshots**, saved in `.claude/qa/in-progress/118-feats/`:
  - the step at level 8 and level 19;
  - Show all with an amber prerequisite;
  - the warning;
  - Feats allowed off;
  - the Settings switch;
  - both skins, at 1280 and 390.

## 11. Docs

- **Wiki pages:**
  - [Character building](../wiki/features/character-building.md): the choice step and level 19; close the Open
    line "An `asi` choice offers +2 / +1+1 only".
  - [Abilities & skills](../wiki/features/abilities-and-skills.md): feat increases are asked, not applied by
    hand.
  - [Converter](../wiki/data/converter.md): the `ability` field.
  - [Settings & updates](../wiki/features/settings-and-updates.md): the switch.
  - [Decisions](../wiki/decisions.md): rows for §2.
  - [1.9.0](../wiki/roadmap/1.9.0.md): #118 built.
- **Player docs:** `docs/rules-schema.md`.
- **Release notes:** `UNRELEASED.md` gets "At an Ability Score Improvement, take a feat instead — with only the
  feats you qualify for listed, and its +1 asked for", and "A new Feats allowed setting turns feats off for tables
  that don't use them", "Human's Versatile asks for your Origin feat", and "Undo a level-up straight after it,
  and level down shows what the level gave you, removing the hit points and features for you".
- **Ledger:** one entry.

## 12. Out of scope

- Enforcing the 20 (or a feat's 30) maximum.
- Structured prerequisites in rules data. The text is regular enough to read; see §6.
- Feats from backgrounds or species: Origin feats keep their current path.
- Prompting the choices inside a feat beyond its +1: spells (Magic Initiate, Fey-Touched, Ritual Caster…), tools and
  instruments (Crafter, Musician), damage types (Elemental Adept), Resilient's saving throw, and Weapon Master's
  mastery. These stay by hand.
- Automatically reverting a level's skills, subclass or spells on level down. They are listed for the player
  (§5b), because grants are not recorded per level for characters made before this change.

## As built

Built in six tasks on `issue/118-feats` (`2bf87c3..be89263`, then the docs), each reviewed. The code is
the truth, and the wiki pages in §11 describe it. This section records:
- the rulings made while building;
- where the build differs from the text above;
- what was deferred;
- what is still open.

### Rulings

1. **The undo copy is taken in `doLevelUp()`,** before `entry.level` changes. §5a named `openLevelUp()`,
   but that runs after the level is applied. The intent was "before it applies anything".
2. **The unmet-prerequisite warning uses `confirm()`** with the §4 sentence, because the app has no in-modal
   two-button dialog. Its buttons are therefore the browser's OK and Cancel, not **Choose another** and
   **Take it anyway**.
3. **`undoLevelUp(opts)` takes `opts.force`,** which skips the signature check. The card's Undo uses it,
   because it comes before the level-up has settled. It still needs the copy.
4. **The plan's test fixtures use invented feat text.** The plan as first written quoted two 14-word runs
   of private 2024 feat text, which the leak scan refuses. The controller fixed the plan doc on the branch.
5. **The converter review's four dormant findings were fixed in one round:**
   - a named species feat resolves to its canonical name through the feat index, else
     `_title_feat_name()`;
   - subraces are read too;
   - a fixed increase keeps its `max`;
   - a non-Origin `anyFromCategory` keeps its category.

   No shipped byte moved.
6. **Show all lifts every filter,** a species or background list's category included (Mike's decision 1,
   "turn off that filter and see all feats"). A test pins `{category:'origin', showAll:true}` offering a
   General feat. Only a fixed `from` menu is never widened.
7. **"Spellcasting feature" is checked with `classCasterKind()`,** which covers subclass casters (Eldritch
   Knight, Arcane Trickster). A Warlock's `"pact"` counts only for "Spellcasting or Pact Magic feature".
   Other changes from the same review:
   - `Repeatable` is matched only as its own line (`/^Repeatable:/m`);
   - parts split on commas as well as "and";
   - the choose entry's `max` is asserted.
8. **No double +1.** `featPendingIncreases()` drops any increase the feat's own `effects` already make.
   Humblewood's Arboreal Acrobat had gone 14 → 16. Other changes from the same review:
   - a pressed-nothing list returns `pick:null` and commits nothing;
   - `commitAsiPick()` refuses an ASI whose ability isn't one of the six;
   - search never hides the pressed row.
9. **Every species or background feat choice without `from` uses the list** (§4.1's intent; "origin" was
   the example). With no category, the qualified filter is Origin feats, plus General and Fighting Style
   feats whose readable prerequisites are met. Epic Boons appear only under Show all. No such list has an
   ASI row. A class level's `{type:"feat"}` keeps its select.
10. **A species `feat` array means choose one,** as a background's does (decision 7, "the same way"). A
    one-item array or a string is granted outright. The list asks for a pick (`data-choose`) only when it
    has a row. Epic Boon shown twice on the level-19 card stays as §5 wrote it (Open, below).

### Where the build differs from the text above

- **§5a, when Undo goes away.** The text first said `_undo` is cleared by the next `scheduleSave()`. As built:
  - when the level-up's last window closes, `luSettle()` writes the record and then takes a signature
    (`JSON.stringify(character)`);
  - Undo is offered while the sheet still matches it exactly (`undoLevelUpAvailable()`);
  - saving alone never spends it, because the level-up's own saves would have;
  - switching character, going Home or reloading clears the copy.

  After a change, the toast's Undo answers "Undo is no longer available: the sheet has changed since the
  level-up." §5a above is corrected.
- **§5a, the toast.** It reads "Fighter is now level 8 · Max HP 61 → 68" with Undo. It replaces the HP
  step's own toast, so it carries the HP.
- **§5b, grants.** Grants carry the class sid, not a level or a feature. So a level's new grant is tied to
  a feature, and removed with it, only when exactly one of the level's new traits grants that proficiency
  outright: an embedded class or subclass trait's `skills` or `saves`, with a matching sid. Its row reads
  "…, and the proficiency it gave: Survival". Everything else goes under "adjust by hand": the subclass,
  untied grants (a level's skill pick, a feat's skill choices) and spells. Feats are never matched by
  their rules `skills`, which `grantFeatDef()` doesn't grant.
- **§5b, the record.** It is `{at, class, level, hp, features:[{id, name, grants}], abilities, subclass,
  grants:[{sid, type, key}], slots:{before, after}}`. The log keeps the newest 200. A record is deleted
  once level down acts on it, even with nothing ticked. `removeClass()` drops that class's records. The
  dialog reads a feature's +1 from the live feature, and says how many features were already removed by
  hand. A level with no record toasts the old notice and opens no dialog.
- **§3.3, labels.** Human's choice reads "An Origin feat of your choice", not "Versatile: an Origin feat".
  `any`, or an unknown category code, gets "A feat of your choice".
- **§4, row keys.** A row is keyed by the feat's `_id` when the merge gave it one (two packs can share a
  name), else by its name. Search matches the name only.
- **§4, the panel.** The ASI's controls in the panel drop their own heading, because the list's label
  names the step. With Feats allowed off the step is exactly the old markup, heading included.
- **§4, the warning.** It reads "Grappler needs level 4 or higher (yours is 1) and Strength 13 or higher
  (yours is 10). Take it anyway?" Cancel keeps the step open with the pick.
- **§8, names.** The helpers live in `58-choices.js` as `featCategory()`, `featPrereq()`, `featUnmet()`,
  `featOfferable()`, `featAbilityChoices()` and `featPendingIncreases()`. There is no `featQualifies()`:
  `featUnmet()` returning `[]` is the test.
- **`rules-data.js`.** Its count of Settings switches moves from 8 to 9, and a check pins `swFeats`
  between `segAdv` and `swFamiliars`.

### Data releases

The rules packs changed:
- SRD 5.2: `feats.json` (8 of 17 feats gain `ability`) and `races.json` (Human's Origin-feat choice);
- the private 2024 pack: feats (54 of 77) and races;
- Xanathar's: feats (11 of 15);
- Tasha's: feats (10 of 15) and races.

The three private packs are committed in the private repo as `999bf63`, which is **not pushed**. Push it
right after public `main`. Each of the four packs needs a data release, which Mike cuts. Until then, a
player's installed SRD pack has no `ability` fields and no Human feat choice. The step still lists the
feats, but asks no +1 for them, because the SRD text doesn't carry the sentence the fallback reads. Human's
Origin feat stays prose.

### Deferred minors

- **Task 1:** `_title_feat_name()` doesn't capitalise after a hyphen ("Fey-touched"). It is dormant: no
  species uses the named-feat branch.
- **Task 3:** the dismiss guard doesn't count a feat pick. This predates #118, since the ASI selects
  worked the same way.
- **Task 3 → known issue:** `grantFeatDef()` doesn't grant a feat's fixed `skills`.
- **Task 3 → known issue:** the ASI's "+1 to two" accepts the same ability twice.
- **Task 4:** `sidLabel()` cuts a colon-named species in its "from …" label. This predates #118.
- **Task 5, for the final fix wave:** both fixed there (below).
  - Undo from the toast while a Level down dialog is open let `applyLevelDown()` apply an older record.
  - A malformed imported record (a feature's `grants` not an array) made level down throw.
- **Task 5, deferred:**
  - an error part-way through `doLevelUp()` can leave settle armed for the next unrelated edit;
  - the toast's Undo stays clickable after a change and answers "no longer available" (§5a says the
    action is gone);
  - subclass traits below the reached level, picked late, aren't in the record;
  - the dialog reads "max HP 0 → 1" when max HP is blank.
- **Known issue, by §12:** the choices inside a feat (spells, tools, damage types, Resilient's saving
  throw, Weapon Master's mastery) stay by hand.

### The final fix wave

The final whole-branch review found five minors, all fixed (ledger "#118 final fix wave"):

- **M1.** `undoLevelUp()` closes any open window before it restores. `applyLevelDown(idx, remove,
  expect)` changes nothing, and says so, when the class entry, level or record differ from what the
  dialog showed.
- **M2.** `migrate()` normalizes the inside of each kept `levelLog` record without dropping its other
  keys. `levelDownHTML()` and `applyLevelDown()` read records through `lvRecFeats()` and `lvRecGrants()`.
- **M3.** A row's short line skips `Repeatable:` and `Prerequisite:` lines. Skilled now has none.
- **M5.** A +1 that allows all six abilities reads "+1 any".
- **M4.** A doc fix in `docs/rules-schema.md`. A species' fixed `feat` gets its `effects` but not its
  `ability` increase, which is asked only when the feat is picked from a list.

### Open for Mike

- **"Epic Boon" appears twice on the level-19 card,** once as the trait ("feature") and once as the
  choice ("choose next"). §5 asks for both. Dropping the trait row is a one-line change in `levelGains()`.
- **The warning's buttons can't read "Choose another" / "Take it anyway"** without a custom in-modal
  dialog, which the app doesn't have (Ruling 2).
- **The data releases** above, and pushing the private repo's `999bf63` after public `main`.
- **A fixed species or background feat's `ability` increase** (M4) is not applied or asked. The
  alternative is to route a fixed grant that has `ability` through the +1 step. It is dormant for
  shipped data: no shipped species uses a fixed `feat`, and Origin feats carry no `ability`.
