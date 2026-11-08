# Initiative: monster rows on a phone, and familiars in the fight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roll initiative's rows become one grid under a Name · × · AC · Init heading, so a monster
row fits one line on a phone (#164); summoned familiars join the fight, each rolling its own
initiative or acting right after you, with one HP shared between the paw and the tracker (#163).

**Architecture:** A familiar row is a new combatant kind, `familiar`, carrying `famId` and `after`
and a copy of the familiar's name, AC and HP. The familiar is the truth: one pure copier,
`syncFamiliarRows(c)`, refreshes the copies, and one live function, `familiarsChanged(id,
wasActive)`, runs after every familiar change (paw Summon / Dismiss, Delete, the form's Save) to
join, fill, copy, drop and settle the marker. Order stays pure: `initSort()` glues after-you rows
behind you, and the tie moves treat you plus those rows as one block. Everything new lives in
`87-initiative.js`; the edits elsewhere are a few lines each.

**Tech Stack:** plain JS fragments concatenated into one file, CSS fragments, Node suites in `src/tests/`.

**Spec:** `src/docs/specs/2026-11-07-initiative-design.md` (approved by Mike, 2026-11-07).

## Global Constraints

- Work only in `.claude/worktrees/164`, branch `issue/164-initiative`. Never `git stash`, merge,
  push, rebase, tag, bump `APP_VERSION` or run `./build.sh --release`. Never commit
  `dist/fieldbook.html` or `docs/CHANGELOG.md` (a build rewrites both; leave them unstaged). Commit
  with explicit `git add <paths>`.
- Constraint 3: old saves load. A familiar with no `turn` reads as Own; a save from before this
  change has no familiar rows. An older app drops a `familiar` row on load (unknown kind) and
  ignores `turn`, so nothing else breaks: keep the existing row keys and add `famId` and `after`
  to every row, never rename one.
- `migrate()` never writes a familiar's HP. Its only familiar change is normalizing `turn`, on a
  copy (`Object.assign({}, f, {turn})`), never by mutating the loaded object.
- Stay small outside `87-initiative.js`: `migrate()` gets two lines beside the #91 lines
  (`71-char-io.js` ≈194), `90-boot.js` only its two familiar lines (130 and 132), `40-sheet.js`
  `familiarCardHTML()` plus two new functions after `renderFamiliars()`, `openFamiliarForm()` its
  switch, its `rec` and one call. Bio chips and Skin & settings saves edit other functions in
  `71-char-io.js` and `90-boot.js`, and this branch rebases onto them.
- Keep `openInitRoll()`'s call `openModal("Roll initiative",initRollHTML(party,mid));` exactly:
  `rules-data.js`'s #161 check reads it. New parameters are optional and default inside the callee.
- Keep boot's focus line `openFamiliar(f.id);const b=document.querySelector("#mBody "+attrSel("data-toggle-familiar",f.id));if(b)b.focus();`:
  `sheet.js`'s #103 M-14 check (≈5117) reads it.
- Words fixed by the spec and this plan, verbatim:
  - Roll initiative heading: `Name`, `×`, `AC`, `Init`. Its hint, with any summoned familiar:
    "You, your party and your summoned familiars are in. Add the monsters, then everyone's roll."
    (without one, today's "Your party and you are in. Add the monsters, then everyone's roll.").
    A familiar's tag: `familiar`; an after-you row's text: `right after you`.
  - Familiar form: label "In a fight", buttons "Own initiative" / "Right after you", hint "A
    familiar rolls its own. A beast companion or a summoned creature acts right after you." Card:
    "Right after you".
  - Toast on an Own familiar joining mid-fight: "<name> joined the fight. Tap its chip to set its
    initiative."
  - Combatant dialog AC line: "AC 13, from the familiar. Edit the familiar from the paw to change
    it." Health: "HP 5 / 7", "HP 5", "HP 0 / 7", "HP ? / 7", "Health not set". A chip's label for an
    after-you row says "acts right after you" where others say "initiative N".
- New `sheet.js` checks go in **one new block directly above the line that begins
  `t118EndToEnd().then(`** (≈10273 at e07a136), after the #170 block, headed
  `/* ---------- #164 #163 Initiative: …`. That line starts the async chain; a synchronous block
  after it runs while `t118EndToEnd()` holds its mocks. Each task adds its own `{ … }` sub-block
  inside it and puts back everything it swaps (`X.character`, `ctx.toast`, `ctx.document.*`,
  `ctx.openModal`/`closeModal`), as the #170 block does. New function names go into the
  `loadApp([...])` list at the top; anything else is reached through `ctx`.
- Existing checks are rewritten in place, never deleted. None should need it: every new parameter
  is optional and no existing check pins a row's full key set.
- `./src/tests/run.sh` green at the end of every task. Build with `./build.sh --no-zip` before
  `rules-data` runs.
- Screenshots through the project's Playwright MCP (`mcp__playwright__*`, never the plugin's), of
  `file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/164/dist/fieldbook.html`
  after `./build.sh --no-zip`, into the **main checkout's**
  `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/in-progress/164-initiative/` (absolute
  filenames). `newCharacter("QA","dnd")` gives the classic skin, `"humblewood"` the other.

## Review Focus

1. **Summoning an Own familiar while it is someone's turn** adds it last with a blank initiative and
   moves neither the marker nor the round. Test in Task 6.
2. **Dismissing the acting familiar at the bottom of the order** moves the marker to the first
   living row and advances the round once (T5-M2), exactly as Remove does. Test in Task 6.
3. **A hand-edited familiar** with `hp:{cur:"abc",max:"x"}`, or no `hp` at all, joins with `hp:""`,
   `maxHp:""`, reads "Health not set", and `famFillHP()` neither throws nor writes. Test in Task 2
   (fill) and Task 3 (row).
4. **Two Right-after-you familiars, then you change your initiative**: both follow you, in familiar
   order, and Act earlier / Act later swaps only them. Test in Task 3.
5. **Saving the familiar form mid-fight with nothing about summoning changed** adds and removes no
   row, shows no toast, and leaves the marker and round alone. Test in Task 6.

---

### Task 1: Roll initiative's heading and grid (#164)

**Files:**
- Modify: `src/js/87-initiative.js` (`irFoeRowHTML()`, `initRollHTML()`)
- Modify: `src/css/50-modal.css` (the `/* ---- Roll initiative (#91) ---- */` rules, ≈276–288)
- Test: `src/tests/sheet.js` (the new block), `src/tests/rules-data.js` (beside the #161/#162 checks, ≈3255)

**Interfaces:**
- Produces: a heading row `<div class="ir-head" aria-hidden="true">` with four `<span>`s, Name · × ·
  AC · Init, placed after `.ir-you` and before `.ir-party` and `#irFoes`. `.ir-head`, `.ir-row` and
  `.ir-foe` share one grid: `grid-template-columns:minmax(0,1fr) 48px 52px 60px; gap:6px`. A foe row
  is its four boxes, bare (no "×" or "AC" label text), each keeping its `data-irf` and `aria-label`.
  A party row's name sits in column 1 and its Init box in column 4. Task 4 adds familiar rows to
  the same grid.

- [ ] **Step 1: Before screenshots.** `./build.sh --no-zip`; through the Playwright MCP,
  `newCharacter("QA","dnd")`, open the combat view, Start combat, add two monsters
  (Roll initiative then holds three foe rows), resize to 390×844 and shoot
  `164-roll-initiative-390-before.png`; resize to 1280×900, shoot `164-roll-initiative-1280-before.png`.
- [ ] **Step 2: Write the failing checks.**
  - `#164 one heading row, aria-hidden, after your row and before the party and the monsters`:
    `X.initRollHTML([{id:'p1',name:'Thorn',ac:'',maxHp:''}],false)` matches
    `/id="irRes"[\s\S]*class="ir-head" aria-hidden="true">[\s\S]*>Name<[\s\S]*>×<[\s\S]*>AC<[\s\S]*>Init<[\s\S]*data-irparty="p1"[\s\S]*data-irfoe/`.
  - `#164 a monster row shows no × or AC words; its boxes keep their names`: `X.irFoeRowHTML()` has
    no `>×` and no `>AC`, and has `aria-label="How many"`, `aria-label="AC guess (optional)"`,
    `aria-label="Initiative"`, `placeholder="Init"`, `value="1"`.
  - `rules-data.js` `#164 Roll initiative's rows are one grid that never wraps`: `50-modal.css` has a
    rule whose selector lists `.ir-head`, `.ir-row` and `.ir-foe` with `display:grid` and
    `grid-template-columns:minmax(0,1fr) 48px 52px 60px`, and no `.ir-row` or `.ir-foe` rule has
    `flex-wrap:wrap` or `min-width:120px`.
- [ ] **Step 3: Run and see them fail.** `./src/tests/run.sh sheet`; `./build.sh --no-zip && ./src/tests/run.sh rules-data`.
- [ ] **Step 4: Implement** per spec §4. Boxes fill their cell (`width:100%`, `min-width:0`) and keep
  `min-height:44px`; the heading uses `.ir-k`'s type. Remove the flex rules the grid replaces.
- [ ] **Step 5: Run; all pass** (the #91 checks at ≈6289 and ≈6531 included). Full `./src/tests/run.sh`.
- [ ] **Step 6: Commit** — `fix(#164): Roll initiative's rows are one grid under Name, ×, AC, Init`.

### Task 2: A familiar's `turn`, on the form, the card and on load

**Files:**
- Modify: `src/js/87-initiative.js` (three new helpers)
- Modify: `src/js/80-modal-forms.js` (`openFamiliarForm()`: the switch, `rec.turn`)
- Modify: `src/js/40-sheet.js` (`familiarCardHTML()`)
- Modify: `src/js/71-char-io.js` (`migrate()`, one line after `base.combatants=cleanCombatants(…)`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Produces, in `87-initiative.js`:
  - `famTurn(f) -> "own"|"after"`: `"after"` only when `f && f.turn === "after"`.
  - `fightFamiliars(c) -> Array<familiar>`: `c.familiars` entries that are objects, `active` truthy,
    with a non-empty string `id`, in familiar order. (Plan decision: an id-less familiar can't be
    matched to a row, so it never joins.)
  - `famFillHP(f) -> boolean`: when `f.hp.cur` is blank after trimming and `initOpt(f.hp.max) > 0`,
    sets `f.hp = Object.assign({}, f.hp, {cur: String(max)})` and returns `true`; otherwise changes
    nothing and returns `false` (a missing `hp` included).
- The form's switch: `<div class="seg" id="faTurn">` with `<button type="button" data-turn="own">` and
  `data-turn="after"`, `.on` and `aria-pressed` on the current one, kept in a local `turn` that Save
  writes into `rec.turn`. A new familiar starts `turn:"own"`.

- [ ] **Step 1: Write the failing checks.**
  - `#163 famTurn`: `undefined`, `{}`, `{turn:'AFTER'}`, `{turn:7}` → `'own'`; `{turn:'after'}` → `'after'`.
  - `#163 fightFamiliars`: from `[{id:'a',active:true},{id:'b',active:false},{active:true},null,{id:'',active:true},{id:'c',active:1}]` → ids `a,c`.
  - `#163 famFillHP` (Review Focus 3): `{hp:{cur:'',max:'7'}}` → `true`, cur `'7'`; `{hp:{cur:'  ',max:7}}` →
    `'7'`; `{hp:{cur:'3',max:'7'}}`, `{hp:{cur:'',max:''}}`, `{hp:{cur:'abc',max:'x'}}`, `{}` → `false`,
    unchanged, no throw.
  - `#163 migrate normalizes turn on a copy`: `migrate({abilities:{},familiars:[{id:'a',name:'Owl'},{id:'b',turn:'after',kind:'Wolf',speed:'40 ft'},{id:'c',turn:'sideways'}]})`
    gives `own,after,own`, keeps `kind` and `speed`, and the input's familiar objects have no `turn`
    added (compare `JSON.stringify` of the input before and after).
  - `#163 the card says Right after you`: `familiarCardHTML({id:'w',name:'Wolf',turn:'after',active:true})`
    contains `Right after you`; with `turn:'own'` it doesn't.
  - `#163 the form keeps turn`: with recorder elements (the `byId`/`el()` pattern at ≈448) and
    `ctx.openModal` capturing the HTML: the HTML has "In a fight", "Own initiative", "Right after
    you" and the hint; Save on a new familiar pushes `turn:'own'`; reopening an existing familiar
    with `turn:'after'` and pressing Save untouched keeps `'after'` (the whitelist trap); a click on
    `#faTurn` whose target's `closest('[data-turn]')` is `{dataset:{turn:'own'}}`, then Save, gives `'own'`.
- [ ] **Step 2: Run and see them fail.** `./src/tests/run.sh sheet`.
- [ ] **Step 3: Implement.** The switch sits after Speed. `familiarCardHTML()` appends "Right after
  you" to its stats line when `famTurn(f)==="after"`. In `migrate()`:
  `base.familiars=base.familiars.map(f=>Object.assign({},f,{turn:famTurn(f)}));`.
- [ ] **Step 4: Run; all pass.** Full `./src/tests/run.sh`.
- [ ] **Step 5: Commit** — `feat(#163): a familiar's form says how it acts in a fight`.

### Task 3: The familiar row in the tracker's core

**Files:**
- Modify: `src/js/87-initiative.js` (`cleanCombatants()`, `combatantDead()`, `initSort()`, `initTie()`,
  `moveCombatant()`, `buildCombatants()`, `combatantBar()`, `combatantHealthText()`,
  `initChipHTML()`, `initRowHTML()`; one new helper)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `famTurn(f)` (Task 2).
- Produces:
  - Every row has `famId` (string) and `after` (boolean); `familiar` rows: `famId` non-empty,
    `track:"exact"`, `band:null`, `dead:false`, `partyId:""`, `init:null` when `after`, `hp`/`maxHp`
    through `initOpt()`, name fallback `"Familiar"`. A second row with the same `famId` is dropped
    (plan decision: two rows would write one HP).
  - `famRow(f, init) -> row`: one familiar row from a familiar object (fresh `uid()` id, `famId`
    `f.id`, `after` from `famTurn(f)`, `init` the given value or `null` when After, `name`, `ac`,
    `hp`/`maxHp` from `f.hp.cur`/`f.hp.max` through `initOpt()`, a missing `hp` read as blank).
  - `buildCombatants(you, party, foes, fams = []) -> rows`: `fams` are familiar objects with an
    added `init`, each through `famRow(f, f.init)`, after the party; then `initSort()`.
  - `initBlock(list) -> {start, end} | null`: the index of the `you` row and of the last after-you
    row directly behind it (`end === start` with none); `null` with no `you` row.
  - `combatantDead(r)`: also `r.kind==="familiar" && r.hp===0`.

- [ ] **Step 1: Write the failing checks.**
  - `#163 cleanCombatants keeps a familiar row`: a `{kind:'familiar',id:'r',famId:'f1',after:'yes',init:'14',hp:'5',maxHp:'7'}`
    → `after===false`, `init===14`, `hp===5`, `maxHp===7`, `track==='exact'`; one with `after:true,init:9`
    → `init===null`; one with no `famId` dropped; a second row with `famId:'f1'` dropped; a foe gets
    `famId:''`, `after:false`.
  - `#163 combatantDead`: familiar `hp:0` true; `hp:''`, `hp:3` false.
  - `#163 initSort glues after-you rows behind you`: rows `[foe 20, you 12, foe 12, fam(after) , party 8, fam(after, second)]`
    → `foe20, you, famA, famB, foe12, party` (a foe tied with you never lands between); with you
    `init:null` → `…, you, famA, famB` last; with no you row → after-rows last; stable among themselves.
  - `#163 ties treat you and your after-you rows as one block` (decision 7, Review Focus 4). Each
    case starts from `[foeX 12, you 12, famA, famB, foeY 12]`:
    - foeX: `initTie(+1)` true; `moveCombatant(foeX,1)` → `you, famA, famB, foeX, foeY`.
    - foeY: `initTie(-1)` true (its neighbour is the block, initiative 12); `moveCombatant(foeY,-1)`
      → `foeX, foeY, you, famA, famB`.
    - you: `moveCombatant(you,1)` → `foeX, foeY, you, famA, famB`; `moveCombatant(you,-1)` →
      `you, famA, famB, foeX, foeY`.
    - famA: `initTie(+1)` true and its move gives `foeX, you, famB, famA, foeY`; `initTie(-1)` false.
    - with foeY at 11: no tie either way across the block's end.
    - then `setCombatant(youId,{init:5})`: famA and famB still directly behind you.
  - `#163 Next goes you → companion → on, skipping a companion at 0`: `initNextTurn` from you lands on
    famA; with famA `hp:0` it lands on famB.
  - `#163 buildCombatants with familiars`: Own with init 14, Own blank (last), After (behind you);
    `hp`/`maxHp` from the familiar's `hp.cur`/`hp.max`; `name` falls back to "Familiar"; the call
    with three arguments still builds as the #91 check expects.
  - `#163 a familiar's health` (Review Focus 3): `combatantHealthText` gives "HP 5 / 7", "HP 5" (no
    max), "HP 0 / 7" (not "Dead"), "HP ? / 7" (`hp:''`, max 7), "Health not set" (neither, and
    `famRow({id:'h',hp:{cur:'abc',max:'x'}},null)` and `famRow({id:'n'},null)`, which have
    `hp===''`, `maxHp===''` and no `NaN`); `combatantBar` gives a share with a max,
    `{band:null,share:null}` with `hp:''`.
  - `#163 chips and rows`: `initRowHTML` of a familiar row has `familiar` as its kind tag; an
    after-you chip shows your number in `.ini-n` and its `aria-label` contains `acts right after
    you`; a familiar at 0 has class `dead`; names escaped.
  - `#163 End of combat lists a familiar`: `endFightSummaryHTML({combatants:[you, famRow at hp 0, famRow at hp 4]})`
    has the fallen one struck with ", fell" and the other plain (no code change: it reads
    `combatantDead()`).
- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.** `initSort()`: sort the non-after rows as today, then splice the after
  rows, in their current order, in right after the `you` row (at the end with none). `initTie(list,i,dir)`
  and `moveCombatant(id,dir)` work on units: the block from `initBlock()` is one unit whose
  initiative is `you.init`, any other row is its own unit; an after-you row's unit is itself, and
  it ties only with an adjacent after-you row inside the block. A tie is two adjacent units with
  equal initiative; a move swaps the two units whole. With no after-you rows this is exactly
  today's behaviour.
- [ ] **Step 4: Run; all pass** (the #91 tie, sort and build checks unchanged). Full `./src/tests/run.sh`.
  Also a throwaway Node check in the scratchpad (CLAUDE.md): random lists of 2–8 rows with 0–2
  after-you rows and inits from {null, 10, 12}; after `initSort()` and after any sequence of 20
  random `moveCombatant()` calls, the after-you rows always sit directly behind you. Expected: no
  violation.
- [ ] **Step 5: Commit** — `feat(#163): a familiar row in the tracker, right after you or by its own roll`.

### Task 4: Roll initiative lists summoned familiars; Start brings them in

**Files:**
- Modify: `src/js/87-initiative.js` (`initRollHTML()`, `irStart()`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `fightFamiliars(c)`, `famTurn(f)`, `famFillHP(f)` (Task 2); `buildCombatants(…, fams)` (Task 3).
- Produces: `initRollHTML(party, midFight, fams = fightFamiliars(character))`;
  `irStart(party, fams = fightFamiliars(character)) -> string`. An Own familiar's row is a
  `<label class="ir-row">` with `<input data-irfam="<id>" … placeholder="Init" aria-label="<name>'s initiative">`
  in column 4; an after-you row has no input and `right after you` across columns 2–4 (plan
  decision: 60 px is too narrow for the words). Both carry the tag `familiar` as `.ir-k`.

- [ ] **Step 1: Write the failing checks.**
  - `#163 Roll initiative lists summoned familiars after the party`: with familiars Sprocket (Own,
    summoned), Wolf (After, summoned), Cat (dismissed): `data-irfam="s"` with `placeholder="Init"` and
    `aria-label="Sprocket's initiative"`; Wolf's row has no `data-irfam` and says `right after you`;
    no Cat; both tagged `familiar`; the party row comes first; the hint is the familiars wording;
    with none summoned the hint is today's; a name `<b>` comes out escaped; `midFight` true lists them
    the same way.
  - `#163 Start brings them in`: recorder `ctx.document.querySelector` returning `{value:'14'}` for
    `[data-irfam="s"]`; `irStart([])` → `''`; rows `you, Wolf(after), …, Sprocket(14)` per sort;
    Sprocket's blank `hp.cur` with `max:'7'` is now `'7'` on the familiar and `hp:7` on the row; a
    dismissed familiar has no row.
- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement.** `irStart()` runs `famFillHP()` on each familiar before reading the boxes,
  then passes `fams.map(f=>Object.assign({},f,{init: famTurn(f)==="after"?null:<box value>}))`.
- [ ] **Step 4: Run; all pass** (the #91 Roll initiative and Start checks, and `rules-data` #161).
- [ ] **Step 5: Commit** — `feat(#163): summoned familiars in Roll initiative`.

### Task 5: The familiar's combatant dialog, and HP written through

**Files:**
- Modify: `src/js/87-initiative.js` (`combatantDialogHTML()`, `setCombatant()`, `openCombatant()`'s
  delegated click; one function extracted)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: Task 3's rows; `famTurn()`.
- Produces:
  - `initSettleTurn() -> void`: `setCombatant()`'s lines ≈450–456 moved out verbatim (Turns mode and
    the actor missing or dead → `initNextTurn()`, else `initFirstAlive()`; a wrap that lands on a
    living row advances the round once). `setCombatant()` calls it; Task 6 calls it.
  - `setCombatant(id, {hp})` on a `familiar` row: clamp as a party row (0..`maxHp` when known; a
    negative reads 0), write `String(h)` (or `""`) to the familiar's `hp.cur` found by `famId`, and
    `h` to the row; a familiar not found is left alone. `setCombatant(id, {after})`: `after` boolean
    on the row and `turn` on the familiar, `init` to `null`, then `initSort()`. Both end in
    `initSettleTurn()`, the existing repaint and save, and `renderFamiliars()`.
  - The dialog's switch: `<div class="seg cd-turn">` with `<button type="button" data-cturn="own">` /
    `data-cturn="after"`, `.on` and `aria-pressed`; a tap does `setCombatant(cid,{after})`, reopens,
    and `cdRefocus('[data-cturn="…"]')`.

- [ ] **Step 1: Write the failing checks.**
  - `#163 the familiar's dialog`: `combatantDialogHTML(row,ch)` for an Own familiar with max 7: `data-chp="-1"`,
    `id="cdHp"`, `/ 7`, both `data-cturn` buttons with Own pressed, `id="cdInit"`, no `id="cdAC"`, the
    AC line verbatim for AC 13 and no AC line when blank, `id="cdRemove"`, `id="cdDone"`, no
    `data-ctrack`, no `id="cdDead"`; for an After familiar no `id="cdInit"`.
  - `#163 HP written through`: `setCombatant(r,{hp:4})` → familiar `hp.cur==='4'`, row `hp===4`;
    `{hp:99}` → 7; `{hp:-3}` → 0; with no max, `{hp:12}` → 12.
  - `#163 the acting familiar at 0 moves the marker`: acting famA mid-order → marker on its living
    successor; acting and last in the order → marker on the first living row and `combatRound` up by one.
  - `#163 the switch from the dialog`: `{after:true}` → familiar `turn==='after'`, row behind you,
    `init===null`; `{after:false}` → `turn==='own'`, `init===null`, row last among the unrolled.
  - The #91 `setCombatant` checks pass unchanged (the extraction is behaviour-free).
- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement** per spec §5.5 and the Interfaces above.
- [ ] **Step 4: Run; all pass.** Full `./src/tests/run.sh`.
- [ ] **Step 5: Commit** — `feat(#163): a familiar's HP in the tracker is its own`.

### Task 6: Keeping the tracker in step with the familiars

**Files:**
- Modify: `src/js/87-initiative.js` (`syncFamiliarRows()`, `familiarsChanged()`, `initDropRow()`
  extracted from `removeCombatant()`)
- Modify: `src/js/40-sheet.js` (two functions after `renderFamiliars()`)
- Modify: `src/js/90-boot.js` (lines 130 and 132 only)
- Modify: `src/js/80-modal-forms.js` (`openFamiliarForm()`'s Save: one call)
- Modify: `src/js/71-char-io.js` (`migrate()`: one line after Task 2's)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `fightFamiliars()`, `famTurn()`, `famFillHP()` (Task 2); `initSort()`, `famRow()`
  (Task 3); `initSettleTurn()` (Task 5).
- Produces:
  - `syncFamiliarRows(c) -> string[]`: for each `familiar` row of `c.combatants` whose familiar (by
    `famId`, in `c.familiars`) exists and is summoned, copy `name` (fallback "Familiar"), `ac`
    (`initOpt`), `after` (`famTurn`, `init:null` when it becomes After), `hp`/`maxHp` (`initOpt`);
    re-sort with `initSort()` if any `after` changed; return the ids of the other familiar rows.
    Reads only its argument; never writes a familiar; never adds or removes a row.
  - `initDropRow(id) -> void`: `removeCombatant()`'s body without its repaint and save (the marker
    step, the filter, the T5-M2 round). `removeCombatant()` becomes `initDropRow` + its repaint +
    save, and still refuses `you`.
  - `familiarsChanged(id, wasActive) -> void`: nothing unless `inCombat(character)` with
    combatants. Then, in order: **join** (the familiar `id` is in `fightFamiliars()`, `wasActive` is
    false and it has no row: `famFillHP()`, append `famRow(f, null)`, `initSort()`; an Own one gets
    the toast); **fill** (`id` has a row:
    `famFillHP()`); **copy and leave** (`syncFamiliarRows(character)`, then `initDropRow()` for each id
    returned); **settle** (`initSettleTurn()`); then one `renderCombatChrome()`, `renderInitTable()`,
    `renderFamiliars()`, `scheduleSave()`.
  - `setFamiliarSummoned(id, on) -> boolean` and `deleteFamiliar(id) -> boolean` in `40-sheet.js`:
    change the familiar (`active`; or remove it from `character.familiars`), call
    `familiarsChanged(id, wasActive)`, then `renderFamiliars()`, `recompute()`, `scheduleSave()`;
    `false` when no familiar has that id. Boot's two lines keep the confirm, the modal close or
    reopen and the focus, and call these.
  - The form's Save, after storing `rec`: `familiarsChanged(rec.id, !!f.active)` (`f` is the record
    before the edit; a new one's `active` is `false`).
  - `migrate()`: `{const gone=syncFamiliarRows(base);base.combatants=base.combatants.filter(r=>gone.indexOf(r.id)<0);}`,
    before the `combatTurn` line, which stays as it is.

- [ ] **Step 1: Write the failing checks.** (`ctx.toast` recorded; `X.character` a fight with
  `combatActive:true`, Turns mode, rows you 15, foe 12, party 8, and familiars.)
  - `#163 syncFamiliarRows`: renamed, re-ACed, re-switched and re-HPed familiars show in their rows;
    a switch to After re-sorts; a dismissed and a deleted familiar's ids are returned and their rows
    still there; the familiars' JSON is unchanged after the call.
  - `#163 a summon mid-fight joins` (Review Focus 1): `setFamiliarSummoned('w',true)` for an After
    familiar → row directly behind you, no toast; for an Own familiar with `hp:{cur:'',max:'6'}` →
    row last, `init===null`, familiar `hp.cur==='6'`, one toast reading "Owl joined the fight. Tap
    its chip to set its initiative."; marker and round unchanged.
  - `#163 a dismiss or delete leaves` (Review Focus 2): dismissing the acting familiar mid-order →
    marker on its successor; dismissing it when it is last → marker on the first living row and the
    round up by one; `deleteFamiliar()` likewise removes the row; out of a fight, both change
    nothing in `combatants`.
  - `#163 the form's tick is the same summon`: drive `openFamiliarForm()` as in Task 2: an existing
    dismissed familiar saved with `#faActive` clicked → joins exactly as `setFamiliarSummoned` does
    (same row, same fill, same toast); a new familiar saved with it ticked → joins; an existing
    summoned one saved with it unticked → leaves; **saved with nothing about summoning changed**
    (Review Focus 5) → same rows, no toast, marker and round unchanged.
  - `#163 a form save fills and settles`: a familiar in the fight saved with blank current HP and max
    7 → `hp.cur==='7'`, row `hp===7`; the acting familiar saved at HP 0 → marker on its living successor.
  - `#163 on load`: `migrate()` of a fight whose familiar row's familiar is dismissed → row gone,
    `combatTurn` on the first living row, `combatRound` unchanged; a kept row's `hp` refreshed from
    its familiar; a familiar with `hp:{cur:'',max:'7'}` keeps `cur:''` and its row reads "HP ? / 7";
    a save → load round trip mid-fight keeps a familiar row in its place.
  - `rules-data.js` is not needed: boot's lines are covered by the #103 M-14 check, kept passing.
- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement** per spec §5.6 and the Interfaces above.
- [ ] **Step 4: Run; all pass.** Full `./src/tests/run.sh`.
- [ ] **Step 5: Commit** — `feat(#163): summon, dismiss, delete and edit a familiar mid-fight`.

### Task 7: Browser QA

**Files:** none tracked. Screenshots to the main checkout's `.claude/qa/in-progress/164-initiative/`.

- [ ] **Step 1:** `./build.sh --no-zip` (leave `dist/` and `docs/CHANGELOG.md` unstaged).
- [ ] **Step 2: #164 after.** As Task 1 Step 1: `164-roll-initiative-390-after-classic.png`,
  `164-roll-initiative-390-after-humblewood.png`, `164-roll-initiative-1280-after-classic.png`.
- [ ] **Step 3: #163 shots**, at 390 and 1280, classic and Humblewood: the familiar form with the
  switch (`163-familiar-form-*`); Roll initiative with Sprocket (Own) and Wolf (After), both
  summoned (`163-roll-initiative-familiars-*`); the strip with Wolf right after you
  (`163-strip-*`) and the ▾ table; Sprocket at 0 HP struck (`163-strip-fallen-*`); Sprocket's
  combatant dialog (`163-dialog-*`); the paw's Sprocket card showing the HP set in the tracker
  (`163-paw-card-*`).
- [ ] **Step 4: Drive and record what happened:** summon Owl mid-fight (the toast, the row last);
  dismiss Wolf while it acts (the marker moves); change your initiative in your dialog (Wolf
  follows); a foe tied with you: Act later lands after Wolf; reload mid-fight (the rows and marker
  come back). Say plainly what was driven and what wasn't; real phones and touch are Mike's pass.
- [ ] **Step 5:** No commit (nothing tracked changed). Note any defect found as a fix in the owning
  task's file, with a test, and commit that fix separately.

### Task 8: Docs, notes, full run

**Files:** `src/docs/_claude/WIRING-LEDGER.md` (append), wiki: `features/combat-view.md`,
`ui/sections-and-layout.md`, `features/story-and-notes.md`, `architecture/character-model.md`,
`decisions.md`, `roadmap/1.9.1.md`; `src/docs/UNRELEASED.md`.

- [ ] **Step 1:** Append one ledger entry at the end of `WIRING-LEDGER.md` (a heading such as
  `## #164, #163: Roll initiative's grid; familiars in the fight (2026-11-07)`), and note its line.
- [ ] **Step 2:** Rewrite the pages to the new truth (spec §7's list): the combatant shape and kinds,
  Roll initiative's heading, the order and the block rule, the familiar's health, the dialog,
  `syncFamiliarRows()`/`familiarsChanged()`, Rules that must hold ("the familiar is the truth for
  its row", "after-you rows sit directly after you"), Traps (the #164 wrap; the form's whitelist),
  Decisions rows for the spec's 15 calls with `decisions.md` lines; every new function named on its
  page (the `docs` suite checks names exist); each page gets a History line citing the new `L<n>`.
  The roadmap's Initiative row: Touches gains `71-char-io.js` `migrate()`, `90-boot.js` (the
  familiar handlers), `40-sheet.js`, `80-modal-forms.js` `openFamiliarForm()`; its design-call column
  records "**Settled (Mike):** summoned familiars join; a switch per familiar, Own initiative or
  Right after you; one HP, shared; at 0 HP struck and skipped, still summoned".
- [ ] **Step 3:** The three `UNRELEASED.md` bullets under `## Pending`, verbatim from spec §7 (the
  familiars line, the Party-card line, the phone-row line); no tags, no versions.
- [ ] **Step 4:** `./build.sh --no-zip && ./src/tests/run.sh` — every suite green (rerun
  `private-data` alone if it fails, before diagnosing).
- [ ] **Step 5: Commit** — `docs(#164, #163): Roll initiative's grid and familiars in the fight, in the wiki and ledger`.
- [ ] **Step 6:** In the handoff (not in `src/docs/qa/smoke.md`, which is Mike's file), propose the
  smoke line for his yes: "a summoned familiar joins Roll initiative, and damage to it in the
  tracker shows on the paw".
