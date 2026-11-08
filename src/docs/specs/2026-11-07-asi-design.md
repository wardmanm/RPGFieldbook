# ASI: every increase asked, none past 20 — design

**Status:** approved 2026-11-07 (Mike) · wave 2 of [1.9.1](../wiki/roadmap/1.9.1.md), the ASI worktree
**Issues:** #172 (Fighting Style feats marked unqualified, P2) → #171 (a high-level start leaves every
ASI on its default, past 20, P1). One branch, `issue/172-asi`, built in that order. From #146's
checklist, S2-26 (the dismiss guard doesn't count a feat pick) is fixed by construction, and S2-24
("+1 to two" accepts the same ability twice) rides along (Mike, 2026-11-07).
Read [Character building](../wiki/features/character-building.md) (the choice windows and "The ASI
step"), [Abilities & skills](../wiki/features/abilities-and-skills.md) (scores are a base plus
effects), [Computed stats & effects](../wiki/architecture/computed-stats-and-effects.md) and the
[feat-support spec](1.9.0/2026-10-26-feat-support-design.md) first. Line numbers are at e07a136.

---

## 1. What it is

**#172.** A Fighter who took Defense at level 1 reaches level 4, turns on Show all at the ASI step,
and every Fighting Style feat says "needs the Fighting Style feature". With Show all off they are
not offered at all. The character has the feature: the check looks for it in the wrong place. After
this, a Fighter (level 1+), a Paladin or Ranger (level 2+), a Champion (level 7+) and a College of
Swords bard (level 3+) qualify for Fighting Style feats, which then appear at the ASI step without
Show all. The style the class already gave counts as that feat taken, so Defense can't be taken a
second time for +2 AC.

**#171.** Adding a class above level 1 opens one choices window with every level's choices in it. A
level-18 Fighter's has six ASI steps, and each starts with the Ability Score Improvement row pressed,
"+2 to one" ticked and Strength selected. Press Done and six +2 STR land: STR 10 → 22. After this:

- each ASI step names its level ("Level 4 · Ability Score Improvement — or a feat instead");
- each starts **blank**: no ability is selected, and a feat's "+1 to:" has no chip pressed;
- "Picks left" at Done counts every step not yet set, and the dismiss guard counts them too;
- an increase that would take a score past 20 can't be chosen, counting the sheet and the steps at
  earlier levels in the same window (30 for an Epic Boon's own increase); a change at an earlier
  level that takes a later pick's room clears that pick and says "choose again";
- a feat pressed at one step can't be pressed again at another step of the same window;
- a normal level-up's ASI step is the same control, so it starts blank too.

Why: a silent default is a choice the player never made, and here it was also an illegal one. Under
the 2024 rules an Ability Score Improvement "can't increase an ability score above 20", nor can a
General feat's +1; an Epic Boon's can reach 30.

## 2. Decisions

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | How a high-level start asks for its ASIs | **One window, each must be set** (Mike, 2026-11-07): the existing single choices window, each step labelled by its level and starting blank; Picks left counts the blank ones | One window per ASI level: clearer per step, but a level-18 start opens six or more windows in a row, and the one-modal queue (#63) gets longer |
| 2 | Where the cap is enforced | **In the step: an ability with no room is disabled** (Mike, 2026-11-07: "can't be chosen"). `commitAsiPick()` applies the same rule at Done | A warning at Done only: the player can still press past it |
| 3 | What counts toward the cap | **The base score plus the `ability.<k>` effects of enabled features, plus the steps at earlier levels in the open window**, chosen and fixed increases alike (my call). Level order is the window's order and `commitChoices()`'s commit order (L605–608), so the screen and the commit agree | `abilFinal()`: it adds equipped items, active statuses and summoned familiars, so a Belt of Giant Strength or a spell's buff would block a permanent pick. Every other step, in any order: the commit runs in level order, so a later step could be shown room the commit then refuses |
| 4 | An earlier change that takes a later pick's room | **The later pick is cleared**: its select goes back to "— choose —" or its chip unpresses, the step shows "Choose again: level 4's pick took the room", and it counts in Picks left again (my call) | Keeping it and refusing at Done: the player would see a pick that never lands. Blocking the earlier change: the earlier level is the one the rules apply first |
| 5 | The cap's value | **20, or the increase's own `max`** where the feat's `ability` field gives one (Epic Boons: 30) (my call; the data already carries it) | A fixed 20: wrong for Epic Boons |
| 6 | A feat's "+1 to:" | **Starts with no chip pressed**, and counts as a pick left until answered (my call: the same rule as decision 1, and the first-chip default could itself be past the cap) | Keeping the first chip pressed: the same silent default the issue is about |
| 7 | "+2 to one" / "+1 to two" | **"+2 to one" starts ticked; both ability selects start on "— choose —"**. The second select shows only under "+1 to two" (my call: the mode alone changes nothing on the sheet, and it saves a tap in the common case) | Both radios blank: one more tap for no information. Both selects always shown: today's, where the second is silently ignored under +2 |
| 8 | "+1 to two" with the same ability twice | **Not allowed**: each select disables the other's ability, and `commitAsiPick()` refuses a pair that matches. #146 S2-24, riding along (Mike, 2026-11-07) | Leaving it: it's +2 to one by another route, and doubles the cap arithmetic |
| 9 | A fixed increase with no room | **The feat stays pickable; the increase is dropped**, shown as "+1 Charisma (already 20: no increase)" and skipped at commit: one rule on screen and at Done (my call: that is the rule's "to a maximum of 20") | Hiding the feat: its other benefits are still worth taking |
| 10 | Show all and the cap | **Show all doesn't lift the cap** (my call). It lifts the feat filters only, as before | Lifting it: a house rule past 20 is one typed score away, and the escape hatch was for feats |
| 11 | Continue anyway with a step blank | **That step grants nothing** (`commitAsiPick()` already returns on a missing ability); a feat with a blank "+1 to:" is granted without that increase (my call) | Falling back to a default: the bug |
| 12 | Sheets already past 20 | **Untouched.** Nothing re-reads or lowers a score; that ability is simply disabled at the next ASI | Clamping on load: the rules-update rule, never touch the player's numbers |
| 13 | What has the Fighting Style feature (#172) | **A feature named "Fighting Style" (today's test), or a class on the sheet whose rules give one at or below its level**: a trait named, or a choice labelled, "Fighting Style", on the class or its chosen subclass (my call: the packs' own shape, read like `classCasterKind()` reads casters) | Renaming the option's feature to "Fighting Style: Defense": every existing sheet still fails, and it changes names the rules-update tool matches on. A converter change: data moves for what the app can see |
| 14 | A style the class already gave (#172) | **Counts as that Fighting Style feat taken, and the reverse** (my call): in 2024 the class's Fighting Style option is the feat (the Defense option and the Defense feat both carry `ac` +1), and Fighting Style feats aren't repeatable | Leaving them separate: a Fighter can take Defense twice for +2 AC |
| 15 | The same feat at two steps of one window | **A non-repeatable feat pressed at one step is disabled at the others**, tagged "picked at level N", until it's unpressed. A Fighting Style option picked in the window counts the same way. Show all doesn't lift this (my call) | Catching it at Done: two grants of one feat, or a warning after the fact |

## 3. Data

No new field. Nothing in `blankChar()` or `migrate()`. The ASI and feat features keep their shape:
an "Ability Score Improvement" feature carrying `ability.<k>` effects, or `Feat: <name>` with its +1
as an effect. A pick refused by the cap writes no effect, so a refused ASI writes no feature at all.

## 4. #172: Fighting Style feats

**Root cause.** `featHasFeature(/Fighting Style/i)` (58-choices.js:87) looks for a sheet feature
whose name contains "Fighting Style". No pack puts one there. The SRD and 2024 Fighter (level 1),
Paladin and Ranger (level 2) carry an `option` choice labelled "Choose a Fighting Style". Its pick is
committed by `commitChoices()` as a feature named after the option ("Defense"), not after the
choice. Only the Champion's level-7 trait "Additional Fighting Style" matches. So `featPartUnmet()`
(the `style` part, L102) says "the Fighting Style feature", and `featOfferable()` (L174) hides the
whole category. The feat-support spec assumed the feature exists by name (its line 216); the test
that covers it pushes a hand-made "Fighting Style" feature, so it never saw the pack shape.

**Fix, part 1: the feature.** One DOM-free walk in `58-choices.js` over each class on the sheet and
its chosen subclass: the rules entry's (`findClassDef()`, `subclassesFor(d)[c.subclass]`)
`levels["1"]` to `levels[<the class's level>]`, collecting traits whose name matches
`/Fighting Style/i` and choices whose `label` does, with those choices' option names. Say
`classStyleSources()`. On it:

- **`hasFightingStyle()`**, used in place of `featHasFeature(/Fighting Style/i)` by
  `featPartUnmet()` and `featOfferable()`. True when a feature on the sheet is named with "Fighting
  Style" (kept: a custom class, a hand-added feature, Champion's trait), or the walk finds a trait or
  choice. That covers every shape in the shipped packs: Fighter 1, Paladin 2, Ranger 2 (SRD and
  2024), Champion 7, and Xanathar's College of Swords 3 (label "Fighting Style: choose 1"). A class
  below the choice's level (a level-1 Paladin) doesn't qualify. The class having the feature is what
  counts, not which style was picked.

**Fix, part 2: the style already taken (decision 14).**

- **Option → feat.** `featTaken()` (L153), and with it `featOfferable()`, counts a Fighting Style
  feat (`featCategory()` is `style`) as taken when the sheet has a feature with a class origin whose
  name equals the feat's and that name is an option of a Fighting Style choice the walk found for
  that class. Defense is then hidden from a Fighter who chose the Defense option, as any taken feat
  is (Show all still lists it, the escape hatch, as today).
- **Feat → option.** The option list's "already yours" check (L450) also counts an option of a
  Fighting Style choice as owned when the sheet has `Feat: <its name>`. Only for choices labelled
  "Fighting Style": invocations and maneuvers keep their name-only match.
- **In the same window** (a Fighter added at level 4: the level-1 option and the level-4 ASI step
  together) the two are checked live, by decision 15 (§5.3).

**Other "X feature" prerequisites.** Across all six packs the only other one is "Spellcasting
feature" (and "Spellcasting or Pact Magic feature"), which `featPartUnmet()` already answers from
the classes through `classCasterKind()` (#118 round 1). Not this bug. What the parser can't read
(Xanathar's race prerequisites such as "Dwarf"; Humblewood's "Glide trait)", whose stray parenthesis
comes from its data) stays "shown, never unmet", as designed. Noted in §9, not fixed here.

## 5. #171: the ASI step

### 5.1 Blank to start

- **The label** (`asiFeatListHTML()`, L245, and the Feats-allowed-off heading in `asiControlsHTML()`,
  L188): a class step with a `_level` reads "Level 4 · Ability Score Improvement — or a feat
  instead", "Level 19 · Epic Boon — a feat, or an Ability Score Improvement", or "Level 4 · " before a
  pack's own `label`. The level sits before the em dash, because `choiceBlocks()` (L44) keeps the
  text before it as the Picks left line. A species or background list has no `_level` and keeps its
  label.
- **The ASI row stays pressed to start** (it is the step's route, not an increase). Its controls:
  "+2 to one" ticked, the ability select on a new first option "— choose —" (`value=""`), the second
  select hidden until "+1 to two" is ticked, also on "— choose —".
- **A feat's "+1 to:" chips** (`asiPanelHTML()`, L251) start with none pressed (`j===0?" on"` goes).
- **`gatherChoices()`** (L579) reads `""` for a blank select and leaves `plus[i]` unset for an
  unanswered group. Its per-step read is factored into one helper (say `asiReadStep(div)`) that
  `gatherChoices()`, the refresh (5.2) and the pick count (5.4) all use.

### 5.2 The cap, in level order

Pure helpers in `58-choices.js` (names are the builder's):

- **`asiScore(k)`**: `character.abilities[k]` plus the `ability.<k>` effects of enabled features
  (the `kind:"feature"` entries of `contributions()`). Decision 3.
- **`asiLedger(base, steps)`**: walks the window's ASI steps **in window order** (level order, and
  `commitChoices()`'s commit order). `base` is the six `asiScore()`s; each step is its selection
  with its feat's pending increases (`featPendingIncreases()`) and their caps. For each step it
  returns `{before, adds, invalid}`: the scores before it (the sheet plus every earlier step's
  `adds`), what it adds, and which of its *chosen* increases no longer fit (`before[k] + amount >
  cap`). A *fixed* increase that doesn't fit adds nothing and is not invalid (decision 9). Blank
  adds nothing.
- **Room** for a step's options is then `cap − before[k]`: an ability whose room is below the amount
  can't be chosen.

**On screen.** A DOM function (say `asiRefresh()`) runs when the window opens and after every change
in the window (§5.3 binds it). It reads every ASI step with `asiReadStep()`, runs `asiLedger()`,
then for each step:

- **clears an invalid pick** (decision 4): the select back to "— choose —", or the chip unpressed,
  and a note on the step, "Choose again: level 4's pick took the room" (naming the earlier level
  whose pick used it). The step counts in Picks left again. The ledger is run again after clearing,
  so a cleared pick frees its own room for the steps after it;
- disables each select option without room, its text ending " — max 20" (or " — max 30");
- in "+1 to two", disables in each select the ability the other holds (decision 8);
- disables each "+1 to:" chip without room (its group's own `max`, else 20). A group with every chip
  disabled reads "no increase: all at the maximum" and counts as answered;
- shows a fixed increase with no room as "+1 Strength (already 20: no increase)";
- writes a line under the controls with the scores after this step: "After level 6: STR 20 · DEX 14
  · CON 16 · INT 10 · WIS 12 · CHA 8", an ability at its cap marked "max".

Switching "+1 to two" back to "+2 to one" can also make a step's own pick too big (a +1 with room
for one, now a +2): that select is cleared the same way.

**Example** (the §7 test). STR 18. Level 4 takes Great Weapon Master (fixed +1 STR); level 6 takes
the ASI. Filled in level order: GWM makes STR 19 before level 6, so level 6's "+2 to one" disables
Strength ("— max 20") and "+1 to two" allows it. Filled the other way: level 6's +2 STR is picked
first (18 → 20); pressing GWM at level 4 makes STR 19 before level 6, so level 6's Strength is
cleared with "Choose again: level 4's pick took the room".

**At commit.** `commitChoices()` calls `commitAsiPick()` (L346) per step in the same order, after
the earlier steps are granted, so `asiScore()` already includes them. It applies the same rule:
a chosen increase that doesn't fit is refused (an ASI so refused writes no feature; a feat is
granted without it), and a fixed increase without room is skipped. The screen and the commit use one
rule, so what the window shows is what lands.

**"+1 to two" twice** (decision 8): `commitAsiPick()` also refuses mode `"1"` with `a===b`.

### 5.3 One feat per window, and the binding

**The same feat twice (decision 15).** `asiRefresh()` also collects the feats pressed at each step
and the Fighting Style options picked in the window's `option` steps. At every other step, a
non-repeatable feat pressed elsewhere is disabled with the tag "picked at level N", and so is a
Fighting Style feat whose option is picked in the window (and, the other way, an option radio whose
feat is pressed at an ASI step). Unpressing re-enables it. Repeatable feats (a `Repeatable:` line)
stay open. Show all doesn't lift this: it widens what the list offers, not how many times one Done
grants a feat.

**Prerequisites stay read from the sheet.** A feat whose prerequisite only an earlier step in the
same window would meet (Strength 13 reached by the level-4 ASI, a feat at level 8) still shows
"needs …", and Done's "Take it anyway" still warns. Out of scope (§9).

**The binding.** `wireAsiFeats()` (L263) today returns early for a step with no list or panel
(L269), which is exactly the Feats-allowed-off step (L418), and binds `click` only (L280). It
changes to:

- for **every** `.choice[data-ctype="asi"]`, a delegated `change` listener (the ability selects and
  the mode radios) and the existing delegated `click` (rows, chips, Show all), each ending in
  `asiRefresh()`. The list-only parts (search, Show all, row press) stay inside the "has a list"
  branch; the early return no longer skips the `change` binding;
- a `change` listener on each `option` step that holds a Fighting Style choice, also ending in
  `asiRefresh()` (decision 15's option side);
- one `asiRefresh()` once everything is bound, so a blank window opens with its caps and its
  "taken" tags already drawn.

`asiRefresh()` reads only the open modal's steps (`#mBody`), so nothing reaches a window behind it.

### 5.4 Picks left and the dismiss guard

- **A class ASI step gets `data-choose="1"`** in `choiceFieldHTML()` (L416–418), as a species or
  background list already does.
- **`choiceBlockPicked()`** (L54) gains an ASI branch: for a `.choice[data-ctype="asi"]` it returns 1
  when the step is set, else 0. "Set" is a pure function of `asiReadStep()`'s result (say
  `asiStepDone(sel)`): the ASI row with a valid ability ("+2 to one"), or two valid, different ones
  ("+1 to two"); or a feat row pressed with every pending "+1 to:" group answered or capped out. No
  row pressed is not set. With Feats allowed off it reads the controls alone. A pick cleared by
  §5.2 is not set.
- **Picks left** then lists each blank step: "• Level 4 · Ability Score Improvement: 0 of 1".
- **The dismiss guard** (`armChoiceDismissGuard()`, L562) counts ASI steps with no change of its
  own. Before this, a level-up window holding only an ASI closed silently on Escape, and a feat
  picked there wasn't counted (#146 S2-26), because the step had no `data-choose`. Both are fixed by
  this. **Not every choice is counted yet:** a single-radio "choose 1" option (L452) and a subclass
  (L391) still carry no `data-choose`, so a blank one is neither in Picks left nor in the guard. Out
  of scope here (§9).

### 5.5 Every path that shows the step

All of them build the step with `choiceFieldHTML()` and bind it with `wireAsiFeats()`, so one
change covers them.

- **First class at any level** (`addClass()` → `runChoices()`): the issue's case.
- **A second class** (`addClass()` with a class already on the sheet → `openLevelUp()` → the card's
  Done → `runChoices()`).
- **A level-up** (`doLevelUp()` → the card → `runChoices()`). The card's row for the step
  (`LU_CHOICE.asi`, `levelGains()`) is unchanged.
- **A species or background feat list** (`runExtraChoices()`, 50-classrace.js): no ASI row, so only
  the "+1 to:" chips, the cap and the one-feat rule apply.
- **Feats allowed off**: `asiControlsHTML()` alone, blank, capped, counted, bound for `change`.

**Unchanged:** Undo level-up (its copy is taken before anything is granted, and picks commit at
Done), `luSettle()` and the level-log record (it sums whatever effects were granted), the level-up
card, the order of windows.

## 6. What it doesn't touch

`56-class.js` and `57-levelup.js` need no change: every step already carries its `_level` from
`applyClassLevel()` (the level-19 boon step too). Wave 3's Class training (#137) edits `addClass()`
after this merges, and this branch leaves that function as it is. The roadmap row's "Touches" for
ASI shrinks to `58-choices.js` and `50-modal.css`.

## 7. Tests

**A new block at the end of `src/tests/sheet.js`** (the roadmap's rule for that file), named for
the issues, with the new pure functions added to the harness's export list (L95–111):

- **#172, the feature:** a rules Fighter with the SRD shape (a level-1 `option` choice labelled
  "Choose a Fighting Style", no trait) at level 4, no "Fighting Style" feature and no style picked:
  `featUnmet(Defense)` is empty and `featOfferable(Defense, {})` is true. A Paladin at level 1 is
  unmet; at 2, met. A Champion subclass trait at 7 counts and at 6 doesn't. A subclass choice
  labelled "Fighting Style: choose 1" (the Xanathar's College of Swords label) counts. A custom class
  with no rules entry and no feature is unmet. A feature named "Fighting Style" still counts alone.
  If the suite loads the SRD pack, one check against its real Fighter.
- **#172, taken both ways:** the same Fighter with a class-origin "Defense" feature (the option
  picked): `featTaken('Defense')` is true, `featOfferable(Defense, {})` is false, Show all still
  lists it, and `featOfferable(Archery, {})` is true. A "Defense" feature with a race origin, or a
  "Defense" from a class with no Fighting Style choice, doesn't count. The other way: with
  `Feat: Defense` on the sheet, the Fighting Style option step's markup shows Defense as already
  yours (disabled); an invocation step's option named like a feat is unaffected.
- **#171, the markup:** a class `asi` step with `_level:4` carries "Level 4 · " before the em dash
  and `data-choose="1"`; its ability select's selected option is "— choose —"; a feat panel's chips
  have none `aria-pressed="true"`; Feats allowed off gets the same blank controls; a species list's
  label has no level.
- **The cap, pure (`asiLedger()`):**
  - STR 19: a "+2 to one" STR is invalid, a "+1 to two" STR fits.
  - STR 18, level 4 Great Weapon Master (fixed +1 STR) then level 6 "+2 STR": level 6 is invalid,
    whichever was filled first (the ledger has no notion of fill order, only level order); with
    level 6 "+1 STR, +1 DEX" it fits.
  - STR 18, level 4 "+2 STR" then level 6 GWM: GWM's fixed +1 adds nothing, is not invalid, and the
    feat stays a valid pick.
  - an Epic Boon group with `max:30` takes STR 20 → 21; an equipped item's or an active status's STR
    effect doesn't count toward `asiScore()`, a feature's does.
- **`asiStepDone()`:** blank ability, "+1 to two" with one or two of the same, a feat with an
  unanswered group, a feat whose group is capped out, no row pressed.
- **Commit, in level order:** a feat with a blank "+1 to:" is granted with no increase (the old
  fallback to the first option is gone); `commitAsiPick()` refuses `a===b` under "+1 to two"; on
  STR 18, committing level 4 GWM then level 6 "+2 STR" leaves STR 19, `Feat: Great Weapon Master`
  and no ASI feature; six "+2 STR" selections on STR 16 leave STR 20 and two ASI features, not 28.
- **End to end:** `addClass('Fighter', 18)` with a rules Fighter carrying `asi` at 4, 6, 8, 12, 14
  and 16 opens one window whose HTML holds six steps, labelled 4 to 16, none with an ability selected.
- **Existing checks to update, in place:** `sheet.js` L7512–7514 and L7763–7764 (Fighting Style
  checks with a hand-made feature: still true, kept), L7530 ("style with the feature": still true,
  kept), L7563 ("the ASI is selected by default" stays true of the pressed row), and any check in
  `sheet.js` or `char-update.js` that reads the first chip pressed or `featTaken()`'s old answer.
  Run the whole suite: `./src/tests/run.sh`.
- **Driven in the browser, not the harness** (it stubs `querySelectorAll`): clearing and "Choose
  again", the "picked at level N" tags, the Feats-off `change` binding. Covered by the screenshots
  in §8.
- A throwaway Node check in the scratchpad for the pure functions, per CLAUDE.md.

## 8. Docs, notes, screenshots

- **Wiki:**
  - [Character building](../wiki/features/character-building.md): "The ASI step" (blank start,
    the label, the cap in level order, clearing, the line, one feat per window, Picks left), "What
    is offered" (the Fighting Style test, a style option counting as the feat taken), the Decisions
    rows for decisions 1–4 and 13–15, and its Decisions row "A feat's own +1", whose rejected "a cap
    of 20: a wider change" is now built. From its Open list, "+1 to two" goes (S2-24) and
    "The dismiss guard doesn't count a feat pick" goes (S2-26). A Traps entry for #172 (the feature
    was looked for by name; the packs give a choice).
  - [Abilities & skills](../wiki/features/abilities-and-skills.md): "Nothing caps a score at 20"
    becomes what the ASI step caps and what it doesn't (a typed score, items, statuses); its Open
    item on "+1 to two" goes (S2-24).
  - [Known issues](../wiki/roadmap/known-issues.md): the "+1 to two" entry goes (S2-24).
    Two entries are added, both 1.9.2 under #146: prerequisites in a choices window are read from
    the sheet, not from the window's earlier picks; a blank single-radio option or subclass isn't in
    Picks left or the dismiss guard.
  - [Decisions](../wiki/decisions.md): rows for decisions 1, 2, 3, 13 and 14.
  - The [1.9.1 roadmap](../wiki/roadmap/1.9.1.md) row: "Settled (Mike)" and the smaller Touches.
  - A ledger entry; History lines citing it.
- **#146 at merge:** tick S2-26 and S2-24. Add the two known-issues items
  above to its checklist.
- **`UNRELEASED.md`**, worded for players (drafts):
  - Starting a character above level 1 now asks for each Ability Score Improvement on the way up,
    each labelled with its level. Nothing is filled in for you.
  - At every Ability Score Improvement, choose the ability (or a feat, and its +1) yourself: nothing
    is picked for you, and an increase can't take a score past 20 (30 for an Epic Boon). "+1 to two"
    now needs two different abilities.
  - Fighters, Paladins and Rangers with the Fighting Style feature now qualify for Fighting Style
    feats, and the style you already have counts as that feat taken.
- **Screenshots** to `.claude/qa/in-progress/172-asi/`, through the project's Playwright MCP: before
  and after of a level-18 Fighter's choices window (top, one blank step, a step with STR at the cap
  showing the disabled option and the line, a cleared step's "Choose again", a feat tagged "picked at
  level N"), Picks left at Done, a level-up's ASI step, Feats allowed off, and the ASI list for a
  level-4 Fighter showing the Fighting Style feats with their own style missing. Desktop and 390px.
  Both skins if `50-modal.css` changes (the disabled chip, the note). Drive it: pick, switch the
  mode, fill the §5.2 example in both orders, press Done with a step blank, and say what was driven
  and what wasn't.

## 9. Out of scope

- **Prerequisites met only by an earlier step in the same window** (§5.3): read from the sheet, so
  the row says "needs …" and Done warns. 1.9.2, under #146, and in known-issues.
- **A blank single-radio option or subclass** isn't counted by Picks left or the dismiss guard
  (§5.4). 1.9.2, under #146, and in known-issues.
- **The ASI feature's origin level.** `commitChoices()` stamps every ASI in a multi-level window with
  the class's final level (18), not its step's (4…16). Nothing displays it, and a level-up's is
  right, so it stays.
- **Prerequisites the parser can't read** (Xanathar's race prerequisites, Humblewood's "Glide
  trait)"): shown, never counted, as designed in #118.
- **A score typed above 20**, and items or statuses past it: the player's, untouched.
- **The rest of #146** (feats, ASI, level-up items): wave 5.

## 10. Left to the builder

The helper names, the exact wording of " — max 20", "Choose again" and the scores line, where the
line and the note sit in the panel, the disabled chip's style, whether the second select is hidden or
disabled under "+2 to one", and whether `asiLedger()` takes the steps as read or a lighter shape.
