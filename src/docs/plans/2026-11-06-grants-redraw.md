# Grants redraw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** What an ancestry, background or class grants or takes back shows at once, with no reload:
its gold in the coin boxes (#153), its languages as Bio pills (#154), its items in the inventory;
and a weapon that arrives outside the item finder (a grant, or a new item on the form) arrives
equipped with its attack row, as the finder's does (#128).

**Architecture:**
- **Task 1 (#153, #154).** `renderClassRace()` in `50-classrace.js` is the one call every class,
  species and background change already ends in, but since #103 it repaints only the header. It
  becomes the redraw of everything a grant can touch that `recompute()` does not: the header, the
  inventory, the coins and the chips. `runExtraChoices()`' Done, the one grant path that does not
  end in it, now does. The three callers that want only the header (`renderAll()`, `applyTheme()`,
  `refreshRulesUI()`) call `renderSheetHead()` instead, so their behaviour is unchanged.
- **Task 2 (#128).** The finder's arrival path (`equipped:!!x.weapon`, then `addAttackForItem()`)
  becomes one function, `equipNewWeapon(it)` in `85-browse.js`, called by `addLibraryItems()` and
  `grantItemByName()`. In `openItemForm()` a new item's Equipped box follows its Weapon box until the
  player sets Equipped. `newCharacter()` marks `wpnEquipInit`, so the one-time equip pass never runs
  on a new sheet and re-equips a weapon the player unequipped.
- **Task 3.** Ledger, wiki, known issues, `UNRELEASED.md`; build; full suite.

**Tech Stack:** the single-file app's plain JS fragments (concatenated, no modules); Node suites
through `src/tests/harness.js` (`loadApp`, `makeCheck`), with recorder DOM elements as
`sheet.js`'s hostile-file block uses them.

**Spec:** none; this is an S item with its design in the issues and the brief. Read
`gh issue view 153`, `154` (and its comment: the change flow, and "redraw everything a grant can
touch"), `128`; then `src/docs/wiki/architecture/grants-and-provenance.md` and
`src/docs/wiki/features/attacks-and-damage.md`.

**Worktree:** `.claude/worktrees/153`, branch `issue/153-grants-redraw`, from `main` at 9caff27.

## Global Constraints

- **#128 equips weapons only (Mike).** Granted armour and shields stay unequipped, as today: a later
  branch changes shield stacking (#130), and it must not go live first.
- **Reuse the finder's path**, never a copy of it.
- **`openItemForm()` changes stay minimal and self-contained**: #132 rebases onto this branch and
  edits the same function.
- **`wpnEquipInit` is never set by `blankChar()`** (a test asserts it): only `newCharacter()` and
  `migrateWeaponEquip()` set it.
- **Tests:** new checks go in one new block at the end of `src/tests/sheet.js`. The file ends in an
  async promise chain; this block is synchronous, so it sits **just before** the chain's call (code
  after the call would run while `t118EndToEnd()` is suspended mid-level-up with its doubles in
  place). It restores every double and `X.character`/rules in a `finally`.
- **Public tests read no private pack.** Fixtures are invented, plus entries from `data/srd52/items.json`.
- **No `git stash`, no merge/push/rebase, no release.** Commit with explicit `git add <paths>`;
  never commit `dist/fieldbook.html` or `docs/CHANGELOG.md`.

## Review Focus

1. **Changing an ancestry** (remove then add in one call): the old pill and the old gold leave and
   the new arrive, in one redraw. → Task 1, flow B.
2. **Removing a source whose gold was partly spent**: the box shows what the floored revert left,
   not the pre-spend amount. → Task 1, flow F.
3. **A granted shield or armour** stays unequipped and AC does not move. → Task 2, test G.
4. **The player unticks Equipped on a new weapon**, or edits an existing unequipped one: it stays
   unequipped. → Task 2, tests M and P.
5. **A new sheet's weapon unequipped by the player, then a reload** (`migrate()`): still unequipped.
   → Task 2, test Q.

---

### Task 1: One redraw for every grant and revert (#153, #154)

**Files:**
- Modify: `src/js/50-classrace.js` (`renderClassRace()`, and the Done handler in `runExtraChoices()`)
- Modify: `src/js/66-coins-hp.js` (`renderAll()`), `src/js/75-home-theme.js` (`applyTheme()`),
  `src/js/88-settings.js` (`refreshRulesUI()`): `renderClassRace()` → `renderSheetHead()`
- Test: `src/tests/sheet.js` (new block before the final promise chain)

**Interfaces:**
- Produces: `renderClassRace()` = `renderSheetHead(); renderInventory(); renderCoins(); renderChipsAll();`
  The callers keep their own `renderFeatures()`, `renderAllRT()`, `recompute()` (which repaints the
  attack rows and resources) and `scheduleSave()`.

- [ ] **Step 1: Write the failing test.** In the new block, a recorder DOM: `getElementById` hands out
  one recorder per id (value, `innerHTML` that clears its appended children, `appendChild` and
  `insertAdjacentHTML` that collect HTML, `_on` listeners, `firstElementChild` returning itself);
  `createElement` hands out recorders; `querySelectorAll('[data-ctype="equip"]')` returns one fake
  picker block whose checked option is the test's choice. `screen(id)` = the element's innerHTML
  plus what was appended since. Fixture pack (`mergeRules`, invented, items from SRD 5.2): species
  **Testfolk** (`languages:"Common, Birdfolk"`, fixed `equipmentGrants:[{items:[{name:"Rope"}],gold:3}]`),
  species **Otherfolk** (`languages:"Sylvan"`), background **Wanderer** (`languages:"Auran"`,
  fixed `{items:[{name:"Rope"}],gold:10}`), class **Tester** (`hitDie:"d8"`,
  `equipmentGrants:[{choose:[{label:"A",items:[{name:"Club"}],gold:15},{label:"B",gold:50}]}]`).
  Checks, each `#153`/`#154`-prefixed:
  - A. `applyRace("Testfolk")`: `screen("coins")` holds `data-coin="gp" value="3"`; `screen("bioLanguages")`
    holds `BIRDFOLK`; `screen("inventoryList")` holds `Rope`.
  - B. `applyRace("Otherfolk")` (a change): no `BIRDFOLK`, has `SYLVAN`; gp `value="0"`; no `Rope`.
  - C. `removeRace()`: no `SYLVAN`.
  - D. `applyBackground("Wanderer")`: gp `value="10"`, `AURAN`, `Rope`; `removeBackground()`: gp `value="0"`,
    no `AURAN`, no `Rope`.
  - E. `addClass("Tester",1)` opens the picker; press the captured `xchDone` with option A: gp
    `value="15"`, `Club` in the inventory.
  - F. spend 10 gp (`coins.gp=5`), then `removeClass(0)`: gp `value="0"`, no `Club`.
- [ ] **Step 2: Run it and watch it fail** — `node src/tests/sheet.js | grep -E '#15[34]'`: A–F's coin,
  pill and inventory checks FAIL (the recorders were never written), which confirms the cause.
- [ ] **Step 3: Implement.** `renderClassRace()` as in Interfaces, its comment saying which flows end
  there and what each redraw is for. In `runExtraChoices()`' Done, `renderInventory();renderAttacks();`
  becomes `renderClassRace();` (recompute already redraws the attacks). `renderAll()`, `applyTheme()`
  and `refreshRulesUI()` call `renderSheetHead()` where they called `renderClassRace()`.
- [ ] **Step 4: Run** `node src/tests/sheet.js` — the new checks PASS and the suite ends `ALL PASSED`.
- [ ] **Step 5: Commit** `src/js/50-classrace.js src/js/66-coins-hp.js src/js/75-home-theme.js
  src/js/88-settings.js src/tests/sheet.js` as `fix(#153, #154): a grant's gold, languages and items
  show without a reload`.

### Task 2: A weapon arrives equipped, wherever it comes from (#128)

**Files:**
- Modify: `src/js/85-browse.js` (new `equipNewWeapon()` beside `addAttackForItem()`; `addLibraryItems()`)
- Modify: `src/js/50-classrace.js` (`grantItemByName()`)
- Modify: `src/js/80-modal-forms.js` (`openItemForm()`)
- Modify: `src/js/75-home-theme.js` (`newCharacter()`)
- Test: `src/tests/sheet.js` (the same new block)

**Interfaces:**
- Produces: `equipNewWeapon(it)` — no-op unless `it.weapon`; sets `it.equipped=true` and calls
  `addAttackForItem(it)`. Called after the item is pushed. Returns nothing.

- [ ] **Step 1: Write the failing tests** (`#128`-prefixed), SRD 5.2 items `Longsword`, `Club`,
  `Shield`, `Chain Mail`:
  - F2. `grantItemByName("Longsword",1,"class:Tester")`: `equipped===true`, one attack with its
    `itemId`, `attackVisible()` true.
  - G. `Shield` and `Chain Mail` granted: `equipped===false` (weapons only).
  - H. `"Imaginary Blade"` (no pack entry): unequipped, no attack, no throw.
  - I. `Longsword` again from the same sid: `qty===2`, still one attack.
  - J. `addLibraryItems([Longsword, Shield])`: the sword equipped with one attack, the shield not.
  - K. Task 1's flow E: the granted `Club` is equipped and its row visible.
  - L. `openItemForm()` (new), click `iIsWeapon`, name and `iWDice="1d6"`, Save: equipped, one attack.
  - M. same, then click `iEquip` before Save: unequipped.
  - N. new form, Insert `Longsword` from the pack (`iLib` change), Save: equipped.
  - O. new form, Insert `Shield`, Save: unequipped.
  - P. `openItemForm(unequippedWeapon)`, Save with its fields filled: still unequipped.
  - Q. `newCharacter()`: `wpnEquipInit===1`; grant a Longsword, unequip it, `migrate(JSON round trip)`:
    still unequipped. (`blankChar().wpnEquipInit` stays undefined: already asserted.)
- [ ] **Step 2: Run and watch F2, K, L, N and Q fail** (equipped false; `wpnEquipInit` undefined).
- [ ] **Step 3: Implement.** `equipNewWeapon()` with a comment naming its callers and the
  weapons-only rule. `addLibraryItems()`: the literal's `equipped:!!x.weapon` → `equipped:false`,
  `if(it.weapon)addAttackForItem(it)` → `equipNewWeapon(it)`. `grantItemByName()`: the same
  replacement. `openItemForm()`: `let eqFollows=!existing;` the Equipped click sets it false; a
  helper `eqFollow()` sets `equipped=isWeapon` (and the box's `on`) while `eqFollows`; called from the
  Weapon toggle and after Insert from rules pack fills the weapon. `newCharacter()`: `c.wpnEquipInit=1;`
  beside `ammoInit`, with the reason.
- [ ] **Step 4: Run** `node src/tests/sheet.js` and `node src/tests/char-update.js`: all PASS.
- [ ] **Step 5: Commit** the four fragments and `sheet.js` as `fix(#128): starting and granted
  weapons arrive equipped, with their attack row`.

### Task 3: Docs, build, full suite

**Files:** `src/docs/_claude/WIRING-LEDGER.md` (append), `src/docs/UNRELEASED.md` (two bullets),
`src/docs/wiki/architecture/grants-and-provenance.md`, `features/attacks-and-damage.md`,
`features/inventory.md`, `features/story-and-notes.md`, `features/character-building.md`,
`architecture/character-model.md`, `decisions.md`, `roadmap/known-issues.md` (the #128 entry only,
neighbours untouched).

- [ ] **Step 1:** Append the ledger entry; note its heading line `L<n>`.
- [ ] **Step 2:** Rewrite the pages in present tense, one History line each citing `L<n>`; the
  Decisions rows (where the grant redraw lives; which granted items arrive equipped) and their
  lines in `decisions.md`; delete the #128 known issue and the matching Open line in Attacks & damage.
- [ ] **Step 3:** `UNRELEASED.md`: one bullet for the redraw, one for the weapons, in player wording.
- [ ] **Step 4:** `./build.sh --no-zip`, then `./src/tests/run.sh`: every suite passes (rerun
  `private-data` alone before diagnosing it).
- [ ] **Step 5: Commit** the docs and the plan as `docs(#153, #154, #128): the grants redraw in the
  ledger and wiki`.
