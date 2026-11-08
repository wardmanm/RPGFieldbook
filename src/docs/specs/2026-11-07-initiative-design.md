# Initiative: monster rows on a phone, and familiars in the fight — design

**Status:** approved 2026-11-07 (Mike) · wave 2 of [1.9.1](../wiki/roadmap/1.9.1.md), the Initiative worktree
**Issues:** #164 (P2: on a phone each Roll initiative monster row wraps its Init box) → #163 (P1:
familiars and companions from the paw don't join initiative). One branch, built in that order:
#163 adds rows to the same dialog #164 lays out.
Read [Combat view](../wiki/features/combat-view.md) (the tracker), the
[initiative tracker spec](1.9.0/2026-10-25-initiative-tracker-design.md), the
[end-of-combat spec](1.9.0/2026-10-29-end-of-combat-design.md),
[Sections & layout](../wiki/ui/sections-and-layout.md) ("Familiars") and
[Story & notes](../wiki/features/story-and-notes.md) (the Party card) first. Line numbers below are
at e07a136.

**Merge.** Beyond the roadmap row's files (`87-initiative.js`, `50-modal.css`, `45-combat.css`,
`87-combat-end.js`), this branch also edits `migrate()` (`71-char-io.js`), the familiar click
handlers in `90-boot.js`, `40-sheet.js` (`familiarCardHTML()` and the new summon and delete
functions) and `openFamiliarForm()` (`80-modal-forms.js`). Bio chips and Skin & settings saves edit
other functions in `71-char-io.js` and `90-boot.js`, so Initiative merges after both and rebases
onto them.

---

## 1. What it is

**#164.** Roll initiative gets one heading row (Name · × · AC · Init) above every row but yours,
and each row becomes one grid, so on a phone a monster's name, count, AC and Init boxes sit on one
line. The party's and the familiars' Init boxes line up in the same Init column.

**#163.** A familiar or companion that is **summoned** on the header's paw joins the fight. Each
familiar says how it acts, on its own form: **Own initiative** (it gets an Init box in Roll
initiative, like a party member) or **Right after you** (no roll; it always sits directly after you
in the order). In the fight its hit points are the familiar's own: damage taken in the tracker
shows on the paw at once, and an edit on the paw shows in the tracker.

Why: entering initiative is what Roll initiative is for, and on a phone each monster reads as two
rows (#164). A ranger's beast or a wizard's familiar fights too, and today the only way in is to
type it into the Party card, which keeps a second copy of its HP (#163).

## 2. Decisions

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Which familiars join | **The summoned ones** (Mike, 2026-11-07). A dismissed familiar is not in the fight | Every familiar, with a tick to leave one out: a dismissed familiar isn't there to act |
| 2 | When a familiar acts | **A switch per familiar, on its form: Own initiative or Right after you** (Mike, 2026-11-07). Under the 2024 rules a familiar rolls its own; a beast companion or a summoned creature shares your count and acts right after you | All roll their own; all act after you: each is wrong for half the creatures the paw holds |
| 3 | Its hit points in the fight | **One HP, shared** (Mike, 2026-11-07): the tracker reads and writes the familiar's own `hp.cur`, its max is `hp.max` | Written back at End combat: two numbers that disagree for the whole fight. Never written back: the player keeps two HPs in step by hand |
| 4 | The switch's default | **Own initiative**, for a new familiar and for every existing one (my call) | Right after you: a wrong Own shows a blank Init box and the familiar goes last, where the player sees it; a wrong After places it silently. The paw and the form both call it a familiar, and a 2024 familiar rolls its own |
| 5 | What a familiar's row is | **A new combatant kind, `familiar`**, carrying `famId`, the id of the familiar it stands for (my call) | Reusing `party`: a party row keeps its own copy of HP, offers Estimate and a Dead switch, and stands for someone on another sheet. A familiar's HP is on this sheet, like yours |
| 6 | Where "Right after you" sits | **Directly after your row, always.** `initSort()` places every after-you row straight after you, in familiar order, whatever anyone rolled, so it follows you when your initiative changes. Its chip shows your number (my call) | Copying your number into the row and breaking the tie after you: stale as soon as your roll changes, and a foe with the same number could end up between you |
| 7 | Ties around you | **You and your after-you rows are one block for every tie move, yours and your neighbours'.** The block's initiative is yours. Your Act earlier / Act later moves the block past a tied neighbour; a tied neighbour's own Act earlier / Act later moves it past the whole block, from either side; an after-you row's Act earlier / Act later only reorders it among the other after-you rows. Nothing ever lands between you and an after-you row (my call) | Treating after-you rows as ordinary ties: a foe's Act later could put it between you and your companion, and a foe after the companion would never be offered Act earlier, since the companion's own initiative is blank |
| 8 | A familiar at 0 HP | **Struck through and skipped by Next**, like a dead party member. It stays summoned on the paw; healing it above 0 puts it back in the turn order; dismissing it stays the player's tap (Mike, 2026-11-07) | Dismissing it automatically: its effects on your sheet would switch off without asking. A Dead switch: its HP is known exactly, so 0 says it |
| 9 | Summoned, dismissed or deleted mid-fight | **Summon joins at once** (after you, or with a blank initiative, last, with a toast saying how to set it). **Dismiss or Delete leaves the fight**; if it was acting, the marker moves on as Remove's does. **The familiar form's "Summoned (active)" tick is the same summon**: saving with it newly ticked joins, newly unticked leaves (my call) | A dismissed familiar's row kept, greyed: a second kind of "not here" beside the dead, and a chip for something not on the field. The form's tick ignored in a fight: three ways to summon that behave two ways |
| 10 | Edited mid-fight | **The familiar is the truth while it exists.** Its name, AC, switch and HP show in the tracker as soon as the form is saved. The row keeps a copy only so a reload can clean it. An edit that drops the acting familiar to 0 moves the marker on (my call) | Copying once at Start, as party rows do: the shared HP (decision 3) would be the only field in step |
| 11 | What its combatant dialog holds | **The HP stepper** (− n / max +, typed values accepted), writing to the familiar; **the same switch**, writing the familiar's setting too; **Initiative** only on Own; **AC read from the familiar**; **Remove** takes it out of this fight only (it stays summoned) (my call) | Editable AC in the dialog: a second place to change the familiar's own AC. Remove dismissing it: a fight-only action shouldn't switch its effects off |
| 12 | A blank current HP with a max | **Filled with the max on the familiar itself when it joins a fight, and when its form is saved while it is in one** (my call). Never on load: `migrate()` doesn't write to familiars | Leaving it blank: the familiar's card reads a blank as 0 (`familiarCardHTML()`, `HP 0/7`), while the tracker would read it as unknown, so the one shared HP would show two ways |
| 13 | XP split and Loot | **Unchanged:** Split among N counts the Party roster and you, and Loot names fallen foes only. A familiar is in the summary, struck through if it fell (my call) | Counting familiars in the split: they don't take a share of XP |
| 14 | The monster row's layout (#164) | **Column headings and one grid:** `Name · × · AC · Init` once, above the party, familiar and monster rows; each row is the name, then three fixed columns. The words × and AC leave each row for the heading. Party and familiar rows leave × and AC blank and put their Init box in the same column (my call) | Narrower boxes, labels kept: fits at 390 px but wraps again at 360. A planned two-line row: twice as tall, which is the issue |
| 15 | A companion already typed into the Party card (#163's workaround) | **A line in the release note** telling players they can remove it from the Party card now that summoned familiars join on their own. No code (my call) | Saying nothing: the player gets two rows for it in the next fight and has to work out why. Roll initiative flagging a Party name that matches a summoned familiar: code for a one-time tidy-up |

## 3. Data

All new fields are optional. Nothing new at the top level of `blankChar()`.

- **A familiar's `turn`:** `"own"` or `"after"`. `openFamiliarForm()`'s new-familiar record gets
  `turn:"own"`. A reader, say `famTurn(f)`, returns `"after"` only for `"after"` and `"own"` for
  anything else, so an old familiar with no field reads as Own. `migrate()` normalizes the field the
  same way on each familiar, after the existing object filter (`71-char-io.js` line 146), keeping
  every other key.
- **The form's record is a whitelist.** Today's Save (`80-modal-forms.js` line 978) builds `rec`
  from the fields it shows, so it would drop a key it doesn't name. It must carry `turn`. (A trap
  for the builder: forget it and every save resets the switch to Own.)
- **A combatant row of kind `familiar`:** `{id, kind:"familiar", name, init, ac, track, band, hp,
  maxHp, dead, partyId, famId, after}`, the existing shape plus two fields. Every other kind gets
  `famId:""` and `after:false`, so every row has every key, as now.
  - `famId`: the familiar's id. A familiar row without one is dropped.
  - `after`: `true` for Right after you. Its `init` is then `null`, and is never read for order.
  - `hp`, `maxHp`: a mirror of the familiar's `hp.cur` and `hp.max`, cleaned like a party row's
    (whole number ≥ 0, or `""`). The familiar is the truth (decision 10); the mirror lets the pure
    functions (`combatantDead()`, `combatantBar()`, `initNextTurn()`) and `migrate()` work from the
    list alone, as they do now.
  - `name` and `ac`: a copy of the familiar's, refreshed whenever the familiar changes. `name`
    falls back to "Familiar".
  - `track` is `"exact"`, `band` `null`, `dead` `false`, `partyId` `""`: unused for this kind.
- **`cleanCombatants()`** accepts the kind, with the rules above.
- **After cleaning,** `migrate()` brings familiar rows in step with `base.familiars` (§5.6's
  `syncFamiliarRows()`): a row whose familiar is gone or dismissed is dropped, and the others take
  the familiar's name, AC, `turn` and HP. (`migrate()` builds `base` before this, so the sync must
  take the character as an argument and never read the global `character`.) Then the existing
  `combatTurn` line (`71-char-io.js` line 197) runs unchanged: when the acting row was dropped, or
  is a familiar at 0, it puts the marker on the **first living row** and does not advance the round.
  That differs from a live removal (`removeCombatant()`, lines 470–473: the successor, and a wrap
  advances the round), but it only meets a familiar that left between saves, which takes a
  hand-edited file or an older app, so `migrate()` stays as it is.
- **`migrate()` never writes to a familiar.** The sync copies from the familiar into the row only. A
  blank current HP with a max (decision 12 fills it everywhere else, so again only a hand-edited
  file) is copied as blank: the row shows "HP ? / 7" with the grey "?" bar, is not counted as
  fallen, and the familiar's next form save or tracker HP change fills it.
- **Backward compatibility.** An older app drops a `familiar` row on load (unknown kind), so a save
  opened in 1.9.0 loses the familiar from a running fight. It keeps `turn` on load (its `migrate()`
  keeps every key), but 1.9.0's familiar form builds its record from the fields it shows, so
  editing a familiar there drops `turn`, and back in this version it reads as Own again. (Corrected
  after review; the draft said 1.9.0 ignores `turn` and nothing else.) A save from before this
  change has no familiar rows, and its familiars read as Own.
- **A naming trap.** A familiar already has a `kind`: its creature type ("Owl"). The combatant's
  `kind` is the row's kind. The two never meet in code, but a reviewer will ask.

## 4. The monster rows (#164)

- **Today** (`irFoeRowHTML()`, `.ir-foe` in `50-modal.css` lines 278–288) a row is a wrapping
  flex line whose parts need at least 353 px: the name's `min-width:120px`, "× [60px]", "AC [60px]",
  the 60 px Init box and three 8 px gaps. A phone's dialog body gives it 326 px, so Init wraps.
- **After.** One heading row below your own row (`.ir-you`, which keeps its roll controls) and above
  every other row, party, familiar and monster alike: `Name`, `×`, `AC`, `Init` in small heading
  type (`.ir-k`'s look). Every row under it is a grid, `minmax(0,1fr)` then three fixed columns
  (about 48, 52 and 60 px) with a 6 px gap, the same columns as the heading. That is about 178 px
  of fixed width, so the name keeps about 148 px at 390 and about 78 px at 320, and nothing wraps.
  The boxes stay 44 px tall. `initRollHTML()` always draws one monster row, so the heading always
  has a row under it.
- **Labels.** The visible "×" and "AC" leave the rows. Each box keeps its `aria-label` ("How many",
  "AC guess (optional)", "Initiative"), and the heading row is `aria-hidden`, so a screen reader
  hears each box by its own name.
- **Party and familiar rows** (`.ir-row`): the name in the first column, the × and AC columns
  blank, and the Init box in the Init column. A Right-after-you familiar has no box (§5.2).
- "+ Add a monster" adds rows at the end, under the same heading.
- `#mBody`'s width is unchanged: this is the ordinary dialog since #161.

## 5. Familiars in the fight (#163)

### 5.1 The familiar form and card

- **The form** (`openFamiliarForm()`) gets a field "In a fight" with a two-button `.seg`: **Own
  initiative** / **Right after you**, `aria-pressed` on each, after Speed. A one-line hint: "A
  familiar rolls its own. A beast companion or a summoned creature acts right after you." Saved as
  `turn`.
- **The card** (`familiarCardHTML()`) adds "Right after you" to its stats line when set; Own shows
  nothing extra.

### 5.2 Roll initiative

- `initRollHTML()` takes the summoned familiars too (`famTurn()` and `active` decide). After the
  party rows, each one is a row tagged `familiar`:
  - **Own:** an Init box, `data-irfam="<id>"`, placeholder "Init", `aria-label` "<name>'s
    initiative", blank allowed (last), as a party row.
  - **Right after you:** no box. The row reads "<name> · familiar" with "right after you" in the
    Init column's place.
- The opening hint names them when there are any: "You, your party and your summoned familiars are
  in. Add the monsters, then everyone's roll." The mid-fight wording (`midFight`, an old save with a
  fight and no list) is unchanged, and that path lists familiars the same way.
- `openInitRoll()` passes the summoned familiars to `initRollHTML()` and `irStart()`; `irStart()`
  reads each Own familiar's box into its `init`.
- **Joining fills a blank current HP with the max** (decision 12), on the familiar, before the row
  is built.

### 5.3 Building and ordering

- **`buildCombatants(you, party, foes, fams)`** gains a fourth list,
  `[{id, name, ac, hp:{cur,max}, turn, init}]` of summoned familiars, built after the party: `kind:
  "familiar"`, `famId` its id, `after` from `turn`, `init` its typed value (Own) or `null`
  (After), `hp`/`maxHp` mirrored. Then `initSort()` as now. The caller filters to summoned ones.
- **`initSort()`** sorts every row that is not after-you as today (stable, highest first, unrolled
  last), then puts the after-you rows, in their existing order, directly after the `you` row. With
  no `you` row (only a hand-edited file), they go last. It stays pure.
- **`initTie()` and `moveCombatant()`** (decision 7). Today `initTie()` compares the two rows'
  `init` only (`87-initiative.js` line 420) and `moveCombatant()` swaps two array places with no
  re-sort (lines 476–481). Both learn the block: you plus the after-you rows directly after you,
  whose initiative is yours.
  - **You:** your neighbour is the row just outside the block on that side; a tie with it moves the
    whole block past it.
  - **A row next to the block** (just before you, or just after your last after-you row): its
    neighbour on that side is the block, tied when its `init` equals yours, and its move takes it
    past the whole block. So a foe tied with you, before you, gets Act later and lands after your
    companion; one after your companion gets Act earlier and lands before you.
  - **An after-you row** ties only with another after-you row and moves only among them.
  - **Any other row** ties and swaps as today.
- **`combatantDead()`** is true for a familiar row whose `hp` is `0` (a number). `""` is not dead.
  `initNextTurn()`, `initPrevTurn()`, `initFirstAlive()`, `setInitMode()` and every "marker off a
  dead actor" path then skip a fallen familiar without change.
- **Your initiative changing** (your dialog, `setCombatant()`) re-sorts through `initSort()`, so
  your after-you rows move with you.

### 5.4 The strip, the table and health

- **Chips and rows** (`initChipHTML()`, `initRowHTML()`): a familiar's name, its kind tag
  `familiar` in the table, and its health as a party member on Exact shows it
  (`combatantBar()`, `combatantHealthText()`): a share bar and "HP 5 / 7" with a max, "HP 5" without
  one, "Health not set" with neither. At 0 it shows "HP 0 / 7", struck through and faded (`.dead`),
  rather than the word "Dead". A blank current HP with a max reads "HP ? / 7" with the "?" bar
  (only after a hand-edited load, §3).
- **An after-you row's number** is your initiative (decision 6), shown or hidden by Show rolls like
  every number. Its accessible label says "acts right after you" in place of "initiative N".
- **Next ▸** goes from you to your after-you rows in turn, then on, skipping any at 0.

### 5.5 The combatant dialog, and HP written through

- `combatantDialogHTML()` gets a `familiar` branch (decision 11):
  - **Hit points:** the party stepper's markup (`cd-step`, `data-chp`, `#cdHp`), with "/ max" when
    the familiar has one.
  - **In a fight:** the same Own initiative / Right after you `.seg` as the form. A tap writes the
    familiar's `turn` and the row's `after`, re-sorts, reopens the dialog and refocuses the pressed
    button (`cdRefocus()`).
  - **Initiative** only on Own. Switching to After sets `init` to `null`; switching back to Own
    leaves it blank (last) for the player to type.
  - **AC** as a line, not a box: "AC 13, from the familiar. Edit the familiar from the paw to
    change it." No AC line when it has none.
  - **Remove** (confirmed as now: "Remove them from this fight?") and **Done**. Remove leaves it
    summoned.
- **`setCombatant()`** on a familiar row, for `hp`: the same clamp as a party row's (0..max, a
  negative reads 0), written to the familiar's `hp.cur` (as a string of the whole number, the way
  the form stores it) and to the row's mirror. A familiar the row no longer finds is left alone.
  Then the marker moves off the row if it just fell while acting: `setCombatant()`'s existing
  dead-actor step (lines 451–456) does it, and that step becomes a named function, say
  `initSettleTurn()` (the marker leaves a dead or missing actor for its living successor, and a
  wrap advances the round once, T5-M2), so §5.6 can call it too. The chrome repaints;
  `renderFamiliars()` repaints too, so the Familiars card in the combat view and the paw's card show
  the new HP.
- **`setCombatant()` for `after`**: writes both, then `initSort()`.

### 5.6 Keeping the tracker in step with the familiars

- **The copy, `syncFamiliarRows(c)`** (pure over the character it is given, in
  `87-initiative.js`): for each familiar row in `c.combatants`, copy its familiar's name, AC, `turn`
  (as `after`, with `init` set to `null` when it becomes After) and HP into the row, and re-sort if
  any `after` changed. It reads familiars and never writes them, and it never adds or removes a row:
  it returns the ids of rows whose familiar is gone or not summoned.
- **On load,** `migrate()` calls it and drops those rows itself, then its own `combatTurn` line runs
  (§3).
- **Live, one function does the rest,** say `familiarsChanged(id, wasActive)`, called after every
  change to a familiar: the paw's Summon / Dismiss, Delete, and the familiar form's Save. In a fight
  with a list (`inCombat()` with combatants), in order:
  1. **Join.** The familiar `id` is summoned now and wasn't (`wasActive` false) and has no row: its
     blank current HP is filled with its max, on the familiar (decision 12), and its row is added.
     After goes straight after you; Own joins with a blank initiative, placed last, and a toast
     says "<name> joined the fight. Tap its chip to set its initiative."
  2. **Fill.** A familiar in the fight whose form was just saved with a blank current HP and a max
     gets its max, on the familiar (decision 12), so the row and the card never disagree.
  3. **Copy and leave.** `syncFamiliarRows()`; each id it returns leaves the fight through
     `removeCombatant()`'s marker step (the successor, a wrap advancing the round, T5-M2), drawn
     once at the end rather than once per row.
  4. **Settle.** `initSettleTurn()` (§5.5): if the acting row now has 0 HP, the marker moves to its
     living successor. This is what moves the marker when a form save drops the acting familiar to
     0.
  5. One `renderCombatChrome()`, `renderInitTable()`, `renderFamiliars()` and save.
  With no fight, or a fight with no list yet, it changes nothing in the tracker: Roll initiative
  will list a summoned familiar.
- **Summon and Delete leave `90-boot.js`.** Today both live in boot's click handler (`90-boot.js`
  lines 130 and 132), which the test harness doesn't load. They become two functions (say
  `setFamiliarSummoned(id, on)` and `deleteFamiliar(id)`, beside `renderFamiliars()` in
  `40-sheet.js`) that change the familiar and call `familiarsChanged()`. Boot keeps the confirm, the
  modal reopen and the focus.
- **The familiar form is the third path** (decision 9). `openFamiliarForm()`'s "Summoned (active)"
  tick (`80-modal-forms.js` lines 969–978) can summon or dismiss too: Save stores the record as now
  (with `turn`, §3), then calls `familiarsChanged(f.id, wasActive)`, where `wasActive` is the
  familiar's `active` before the edit, and `false` for a new one. So in a fight, saving a familiar
  with the tick newly on joins it exactly as the paw does, saving a new familiar with it ticked
  joins it, and saving with the tick newly off takes it out of the fight.
- **A familiar summoned before a fight that the player Removed** from the fight stays out until the
  next fight, or until it is dismissed and summoned again.

### 5.7 End combat, Undo, print

- **End combat** (`combatEnd()`) clears the rows as now. The familiar keeps its HP: it was always
  the familiar's.
- **The End of combat window** lists a familiar like a party member (`endFightSummaryHTML()` reads
  every row but yours); a fallen one is struck, "fell". Split among N and Loot are unchanged
  (decision 13).
- **Undo.** Nothing in the tracker has an Undo, and the view's two (a card taken out of the view;
  End combat's recovery) don't touch combatants. A familiar's HP change from the tracker has no
  Undo, as a party member's has none.
- **Print** prints neither familiars nor the fight (`printSheet()`); unchanged.

## 6. Tests

A new block at the end of `src/tests/sheet.js` (the roadmap's rule), with the initiative helpers
added to its export list (line 89–91):

- **Cleaning:** a `familiar` row is kept with its `famId`, dropped without one; `after` is a boolean
  and `init` `null` when it is set; `hp`/`maxHp` cleaned as a party row's; other kinds get
  `famId:""`, `after:false`.
- **`combatantDead()`:** a familiar at `hp:0` is dead, at `""` and `3` is not.
- **`initSort()`:** after-you rows land directly after you whatever their stored place, with a foe
  tied with you, with you unrolled (you and they last), with no `you` row (they go last); stable
  among themselves.
- **Ties (the block, decision 7):** an after-you row ties only with another; Act later on you
  moves you and your after-you rows together past the tied foe; **a foe tied with you, just before
  you, gets Act later and lands after your companion, never between you**; **a foe tied with you,
  just after your companion, is offered Act earlier and lands before you**; a foe with a different
  initiative next to the block gets neither.
- **`initNextTurn()`:** you → companion → the next row; a companion at 0 is skipped.
- **`buildCombatants()` with familiars:** Own with a roll, Own blank (last), After (glued), HP
  mirrored.
- **`syncFamiliarRows()`:** a renamed, re-ACed or re-switched familiar's row follows; a dismissed
  or deleted one's id is returned and its row left in place; it never adds a row and never writes
  to a familiar.
- **Summon and delete (the new functions, through `familiarsChanged()`):** a summon mid-fight adds
  the row (After glued; Own blank, last) and toasts; a dismiss removes it and moves the marker off
  it when it was acting (a wrap advances the round once); a summon out of a fight adds nothing; a
  blank current HP with a max is filled with the max on joining.
- **The form's tick (the third path):** in a fight, saving an existing familiar with "Summoned"
  newly ticked joins it exactly as the paw's summon does (same row, same HP fill, same toast);
  saving a new familiar with it ticked joins it; saving with it newly unticked takes it out; saving
  with it unchanged adds or removes nothing.
- **Form save and HP:** saving a familiar in the fight with a blank current HP and a max fills its
  `hp.cur` with the max and the row shows it; saving the acting familiar at 0 HP moves the marker
  to its living successor (`initSettleTurn()`).
- **HP written through:** `setCombatant()` on a familiar row writes `familiars[i].hp.cur`, clamps to
  the max, reads a negative as 0, and moves the marker off it at 0 when it was acting.
- **`migrate()`:** `turn` normalized (`"after"` kept, junk and missing read `"own"`, other keys
  kept); a row whose familiar is gone or dismissed dropped on load and `combatTurn` put on the first
  living row, the round unchanged; a mirror refreshed from the familiar; **no familiar written** (a
  blank current HP with a max stays blank on the familiar and reads "HP ? / 7" in the row); a save →
  load round trip mid-fight keeps a familiar row and its place.
- **Markup:** `initRollHTML()` lists summoned familiars only, an Own one with a `data-irfam` box,
  an After one with none and "right after you"; names escaped. The heading row (Name · × · AC ·
  Init) sits above the party, familiar and monster rows. The dialog's familiar branch has the
  stepper, the switch and no AC box.
- **CSS** (in `rules-data.js`, beside the other `50-modal.css` checks): `.ir-foe` is a grid and no
  longer `flex-wrap:wrap`.
- A throwaway Node check in the scratchpad for `initSort()`, the tie rule and
  `syncFamiliarRows()`, per CLAUDE.md.
- **Existing tests:** the #91 `buildCombatants()` and `cleanCombatants()` checks (line ≈6189–6250)
  keep passing untouched; the new fields are additions.

## 7. Docs, notes, screenshots

- **Wiki:** [Combat view](../wiki/features/combat-view.md) (the Data paragraph's combatant shape and
  kinds; Roll initiative; Turns and the order; the strip's health; the dialog; Rules that must hold
  gains "the familiar is the truth for its row" and "after-you rows sit directly after you"; Traps
  gains the #164 wrap; Decisions rows for the calls above; History),
  [Sections & layout](../wiki/ui/sections-and-layout.md) ("Familiars": `turn`, the form's switch,
  summon and dismiss in a fight, the functions that left boot),
  [Story & notes](../wiki/features/story-and-notes.md) (the Party card: familiars on the paw join on
  their own, so a companion needn't be typed into Party),
  [Character model](../wiki/architecture/character-model.md) (the familiar's `turn`, the
  `familiar` kind and its two fields) and [Decisions](../wiki/decisions.md) (the register lines).
  The [1.9.1 roadmap](../wiki/roadmap/1.9.1.md)'s Initiative row: its Touches column gains
  `71-char-io.js` `migrate()`, `90-boot.js` (the familiar handlers), `40-sheet.js` and
  `80-modal-forms.js` `openFamiliarForm()`, and its design-call column records Mike's calls. A
  ledger entry; History lines citing it.
- **`UNRELEASED.md`**, worded for players (drafts):
  - Summoned familiars and companions from the paw now join the initiative tracker. On each one's
    form, choose whether it rolls its own initiative or acts right after you. Damage it takes in the
    fight changes its hit points on the paw too.
  - If you typed a companion into the Party card so it could join fights, you can remove it there
    now: summoned familiars and companions from the paw join on their own.
  - On a phone, each monster row in Roll initiative now fits on one line, under column headings.
- **Smoke list:** Mike's file (#150). The branch proposes one line for him to say yes to: "a
  summoned familiar joins Roll initiative, and damage to it in the tracker shows on the paw".
- **Screenshots** to `.claude/qa/in-progress/164-initiative/`, through the project's Playwright
  MCP:
  - #164: Roll initiative at 390 px with three monsters, before (wrapped) and after, and after at
    1280 px; both skins after, since the heading row uses themed type.
  - #163: the familiar form with the switch; Roll initiative with an Own and an After familiar;
    the strip with the companion right after you, and with a familiar at 0 HP struck; the
    familiar's combatant dialog; the paw's familiar card showing the HP the tracker set. 390 and
    1280 px, both skins.
  - Driven: summon mid-fight (the toast), dismiss mid-fight while it acts (the marker moves), change
    your initiative (the companion follows), a reload mid-fight. Real phones remain Mike's pass.

## 8. Out of scope

- Familiars and companions with their own temp HP, conditions or death saves.
- Adding a familiar that was Removed from a fight back into it, short of dismissing and summoning
  it again.
- Party members' HP (still a copy per fight, decision 6 of the 1.9.0 spec).
- #145's initiative items (1.9.2).

## 9. Open

None. Every design call is settled (decisions 1–3 and 8 by Mike, the rest marked "my call" for him
to check while reading).

## 10. Left to the builder

The markup and class names, the exact column widths within §4's budget, the hint's and toast's
exact words within the shapes above, whether `syncFamiliarRows()` lives in `87-initiative.js` or
beside the familiar functions (it must be callable from `migrate()` with `base`), how
`removeCombatant()`'s marker step is shared so several leaving rows draw once, and how the block
tie rule (decision 7) is coded, as long as the tests in §6 hold.

## 11. As built

Built on `issue/164-initiative` (2026-11-07). The builder's calls, and what review and the browser
pass changed:

- **The join toast is the long one (6 s).** At the default 1.9 s it was gone before it could be
  read beside the familiar's reopened window (browser QA).
- **Re-tapping the switch already pressed changes nothing.** `setCombatant(id, {after})` acts only
  on a change; it used to wipe an Own roll and sort it last, and with the familiar acting the next
  Next wrapped the round (review).
- **Decision 12 also covers the tracker's own HP box:** clearing it, with a max set, writes the max
  to the familiar and the row, so the card and the tracker never disagree (review).
- **A negative familiar HP reads 0 in its row,** fallen, as the tracker's own entry stores it
  (`famHP()`); the familiar keeps the number its form was given (review).
- **One familiar per id.** `fightFamiliars()` keeps the first familiar with an id (a hand-edited
  file can repeat one), as `famOfRow()` and the paw's handlers find it, so one familiar's damage is
  never written to another's HP (review).
- **Backward compatibility** is corrected in §3: 1.9.0 drops `turn` when a familiar is edited there.
