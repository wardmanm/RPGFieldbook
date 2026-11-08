# Skin is look only, and every settings save says so — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skin changes only the look. A character's game system is changed from a new Game system
row that asks first. "Race"/"Ancestry", the wordmark and the page title follow the character's
system. A Humblewood sheet shows PP or EP while it holds some. Every refused settings save says so,
once a session (#133, #141).

**Architecture:**
- The skin-to-system link is cut in the three open paths and in the Skin control. `raceTerm()` and
  `applyTheme()`'s wordmark read `character.system`.
- A system change is three functions in `75-home-theme.js`: a pure `systemChangePlan()`, a pure
  `systemChangeLines()` that reads only the plan, and `changeSystem()`, which applies the plan to
  the character. They sit on one new `swapDefaultLanguages()` in `41-chips.js`.
- `88-settings.js` asks through `askConfirm()` and redraws.
- Refused settings saves go through one helper beside `saveSettings()` in `70-persistence.js`.

**Tech Stack:** plain JS fragments concatenated into one file, Node suites in `src/tests/`.

**Spec:** `src/docs/specs/2026-11-07-skin-settings-saves-design.md` (approved by Mike, 2026-11-07).

## Global Constraints

**Git and branch:**
- Work only in `.claude/worktrees/133`, on branch `issue/133-skin-settings-saves`.
- Never `git stash`, merge, push, rebase, tag, bump `APP_VERSION` or run `./build.sh --release`.
- Never commit `dist/fieldbook.html` or `docs/CHANGELOG.md`. Commit with explicit
  `git add <paths>`.

**The three constraints:**
- Constraint 2: a refused write says so. A settings save that doesn't land toasts through
  `saveSettingsSaid()`, or reports on its caller's existing channel (spec §8).
- Constraint 3: old saves load. No new character field and no new settings key. `migrate()` is
  untouched, and an old save loads as before, except that loading no longer writes
  `settings.skin`.
- Nothing converts coins. The system change never touches `character.coins` and writes no
  inventory-log line (spec decision 10).

**`41-chips.js`:** add only `swapDefaultLanguages()`, directly below `ensureDefaultLanguages()`.
Change no existing function there. Bio chips merges first and edits this file, and this branch
rebases onto it.

**Words fixed by the spec, verbatim:**
- **Skin row help:** "How Fieldbook looks: colours, lettering and frames. It doesn't change any
  character."
- **The new group and row:**
  - group "Game"; row "Game system";
  - help "The game this character is for. It sets the coins, the ancestries you're offered and the
    default languages.";
  - buttons "Humblewood" and "D&D".
- **The warning's title and buttons:**
  - title "Make *name* a D&D character?" / "Make *name* a Humblewood character?", with "this
    character" for an unnamed sheet;
  - buttons "Cancel" and "Make it D&D" / "Make it Humblewood".
- **The warning's sentences, in this order:**
  1. **Coins.** To D&D: "Coins gain platinum and electrum." To Humblewood, holding some: "Your 3 PP
     and 4 EP stay on the Coins card until you spend or convert them." (only the coins held: "Your 3
     PP stay…", "Your 4 EP stay…").
  2. **The ancestry list.** "The + Race list offers D&D species." / "The + Ancestry list offers
     Humblewood ancestries."
  3. **A cross-system ancestry**, only when there is one: "*Name* stays on the sheet."
  4. **Languages**, only when chips change: "*A* (a *Humblewood* default) goes; *B* stays.", then
     "*C* is added." Plurals: "A and B (Humblewood defaults) go", "C and D are added". "; *B*
     stays" appears only when some default stays.
  5. **The XP table**, only when it differs: "The XP bar uses D&D's table." (or "Humblewood's").
  6. **The words**, always: "The sheet says Race, and the top bar reads D&D Character Sheet." /
     "The sheet says Ancestry, and the top bar reads Humblewood."
  7. **Always:** "Classes, spells, feats and items from every loaded pack stay available. The look
     doesn't change: that's Skin, on Appearance."
- **The New character hint:** "The game this character is for. It sets the coins, the ancestries
  you're offered and your starting languages. Classes, spells, feats and items from every loaded
  pack are offered either way. You can change it later in Settings → Sheet display."
- **Toasts:**
  - "Couldn't save your settings: *why*. Changes to settings last until you close Fieldbook."
  - The pill's: "Couldn't save that you cleared the notice: *why*."
- **Wordmark texts,** unchanged: D&D is `{main:"D&D",sub:"Character Sheet",title:"D&D Character
  Sheet"}`; Humblewood is `{main:"Humblewood",sub:"The Fieldbook",title:"Fieldbook —
  Humblewood"}`.

**Where the new `sheet.js` checks go:**
- **Block A**, the checks on the shared `X`/`ctx`: one new synchronous block directly above
  `async function t118EndToEnd()` (line 8921 at e07a136). The file ends in the async chain that
  calls `ck.done()`, and a synchronous block after that line runs while `t118EndToEnd()` holds its
  mocks.
- **Block B**, the checks that need a fresh app: one new synchronous block at the very end of the
  file, after the Boot & storage block's `ck.done` wrapper. It uses only fresh `BS.app()` contexts,
  never the shared ones, because `const BS` (line 10428) is not initialised above it. This covers
  the #141 helper's once-a-session memory (which must start empty), blocked storage, and the boot
  fold.

**Tests and builds:**
- Existing checks are rewritten in place, never deleted (the spec's §9 list).
- After each task: `./build.sh --no-zip && ./src/tests/run.sh` is green. `rules-data.js` reads the
  built artifact. Rerun `private-data` alone before diagnosing it.

**Screenshots:**
- Use the project's Playwright MCP (`mcp__playwright__*`), never the plugin's (it refuses
  `file://`).
- They go into the main checkout's
  `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/in-progress/133-skin-settings-saves/`.
- Shoot before and after, in both skins, at 1280 and 390 wide.
- Set the skin with `browser_evaluate`: `settings.skin="classic";applyTheme()` (or tap Skin).
- Say plainly what was driven and what wasn't.

## Review Focus

1. **Cancel, Escape or a dismissal on the warning** leaves `character.system`, the languages, the
   control's `on` class and its `aria-pressed` exactly as they were. Test in Task 3.
2. **A tap on the system the character already has** shows no warning and changes nothing. Test in
   Task 3.
3. **Junk coin values on a Humblewood sheet:** `"abc"`, `"-2"`, `0` and `""` show no PP or EP row,
   while `"3"` does. Test in Task 2.
4. **A round trip D&D → Humblewood → D&D** leaves the languages and coins as they were, with and
   without declared defaults. Test in Task 3.
5. **Import settings carrying `skin:"classic"`** while a Humblewood character is open changes the
   skin, but not `character.system`, the wordmark or `raceTerm()`. Test in Task 1.

---

### Task 1: Skin is look only; the system's words (#133)

**Files:**
- Modify: `src/js/75-home-theme.js`: `loadCharById()`, `newCharacter()`, `openNewCharacter()`'s
  hint, `applyTheme()`; remove `skinForSystem()` and `systemForSkin()`.
- Modify: `src/js/71-char-io.js`: `finishImport()`, one line.
- Modify: `src/js/52-race.js`: `raceTerm()`, and the picker placeholder at `:52`.
- Modify: `src/js/88-settings.js`: the Skin row's help, and the `#segSkin` handler.
- Modify: the docs that name the removed functions, minimally, so `docs.js` stays green (the full
  rewrite is Task 6):
  - `src/docs/wiki/overview.md:159`
  - `src/docs/wiki/ui/theming-and-icons.md:12` and `:49–50`
  - `src/docs/wiki/process/screenshot-qa.md:11` and `:81`
  - `src/docs/wiki/roadmap/1.9.1.md:58`
- Test: `src/tests/sheet.js` (block A), `src/tests/rules-data.js`.

**Interfaces:**
- Produces:
  - `raceTerm() -> "Race"|"Ancestry"`, from `character.system` (`"dnd"` gives "Race").
  - `applyTheme()` takes its wordmark from `character.system` when `activeId`, else from
    `settings.skin`.

- [ ] **Step 1: Shoot "before".** On the worktree's untouched `dist/fieldbook.html` (main's build):
  - Settings → Appearance and Settings → Sheet display, with a D&D character open.
  - The sheet header and top bar of that character, in both skins.
  - The New character dialog.
  - Coins on a Humblewood sheet holding `ep:50`, set with `browser_evaluate` and `renderCoins()`.

  Name the files `before-<what>-<skin>-<width>.png`.
- [ ] **Step 2: Write the failing checks.**
  - **Block A** (add `'settings'`, `'raceTerm'` and `'applyTheme'` to `sheet.js`'s `loadApp` names):
    - `#133 newCharacter('S','dnd') under the humblewood skin leaves settings.skin 'humblewood'`. The
      same for `loadCharById()` of that sheet and for `finishImport(X.migrate({...system:'dnd'...}))`.
    - `#133 raceTerm` is 'Race' for a D&D character under either skin, and 'Ancestry' for a
      Humblewood one.
    - `#133 applyTheme with a D&D character open under the humblewood skin`:
      - Swap `ctx.document.getElementById` for a recorder, and `documentElement` for
        `{dataset:{}}`.
      - Expect `wmMain` "D&D", `wmSub` "Character Sheet", `document.title` "D&D Character Sheet" and
        `dataset.skin` "humblewood".
      - With `X.activeId=null`, the wordmark follows the skin.
      - Restore every mock in a `finally`.
    - Review Focus 5: `finishSettingsImport({settings:{skin:'classic'},pool:null,used:0,skipped:0},false)`
      with a Humblewood character open:
      - `settings.skin==='classic'`;
      - `character.system==='humblewood'`;
      - `raceTerm()==='Ancestry'`;
      - the recorded wordmark "Humblewood".

      Add `'finishSettingsImport'` to the names.
  - **`rules-data.js`:**
    - no `skinForSystem` or `systemForSkin` in any `src/js` fragment;
    - exactly two `settings.skin=` assignments in `src/js` (the `#segSkin` and `#homeSkin`
      handlers);
    - the `#segSkin` handler's source holds no `character.`;
    - `raceTerm()`'s body, and the picker's example name (`52-race.js:52`), read
      `character.system` and no `settings.skin`;
    - the Skin row's help is the spec's sentence;
    - the New character hint is the spec's sentence.
- [ ] **Step 3: Run and see them fail.**
  Run: `./src/tests/run.sh sheet; ./build.sh --no-zip && ./src/tests/run.sh rules-data`.
  Expected: FAIL on the new checks only.
- [ ] **Step 4: Implement** spec §4, §6 and §7.
  - `loadCharById()`, `newCharacter()` and `finishImport()` drop
    `settings.skin=skinForSystem(…);saveSettings();` and keep `applyTheme()`.
  - The `#segSkin` handler drops its `if(activeId){…}` tail. It still calls `saveSettings()` here;
    Task 4 moves it to the helper.
  - In the four docs, replace each removed function's name with what is now true: "the skin is
    `settings.skin`, set by the Skin control".
- [ ] **Step 5: Run; all green.** Run: `./build.sh --no-zip && ./src/tests/run.sh`. Expected:
  every suite passes, `docs` included.
- [ ] **Step 6: Commit:** `feat(#133): Skin is look only; Race, Ancestry and the wordmark follow the system`.

### Task 2: The default-language swap, and coins shown while held

**Files:**
- Modify: `src/js/41-chips.js`: add `swapDefaultLanguages()` below `ensureDefaultLanguages()`, and
  nothing else.
- Modify: `src/js/66-coins-hp.js`: `coinKeys()`'s body only.
- Test: `src/tests/sheet.js` (block A, and `:840–842` renamed in place).

**Interfaces:**
- Produces:
  - `swapDefaultLanguages(c, sys) -> {drop:string[], add:string[], keep:string[]}`:
    - it changes `c.languages` only (never `c.system`);
    - `drop` is each `src==="system"` chip whose name (case-blind) isn't in
      `defaultLanguagesFor({system:sys})`;
    - `keep` is each `system` chip that stays;
    - `add` is each default the character lacks (case-blind), pushed as
      `{id:uid(),name,src:"system"}`;
    - chips with `src:""` or `race:…`/`bg:…` are never touched.
  - `coinKeys() -> string[]`:
    - unchanged for a D&D sheet;
    - for a Humblewood sheet, `["pp","gp","ep","sp","cp"].filter(k=>k==="gp"||k==="sp"||k==="cp"||num(character.coins&&character.coins[k])>0)`.

- [ ] **Step 1: Write the failing checks** (block A; add `'swapDefaultLanguages'`,
  `'defaultLanguagesFor'`, `'tradeCoinsHTML'` and `'convertCoins'` to the names).
  - **Stubs:** stub `X.rules.defaultLanguages={'Humblewood':['Common','Humblefolk'],'XPHB':['Common','Dwarvish']}`,
    and restore it in a `finally`.
  - **`#133 swapDefaultLanguages to dnd`:**
    - starting from `[Common·system, Humblefolk·system, Elvish·"", Sylvan·race:Elf]`, it returns
      `{drop:['Humblefolk'], add:['Dwarvish'], keep:['Common']}`;
    - Elvish and Sylvan are untouched;
    - Dwarvish arrives stamped `system`;
    - `c.system` is unchanged.
  - **`#133 …with no declared defaults`** (`{}`): languages unchanged, and every list empty.
  - **`#133 coinKeys on a Humblewood sheet`:**
    - `{ep:50}` gives `['gp','ep','sp','cp']`, and `{pp:3,ep:4}` gives
      `['pp','gp','ep','sp','cp']`;
    - Review Focus 3: `ep` set to `'abc'`, `'-2'`, `0` or `''` gives `['gp','sp','cp']`, and `'3'`
      shows EP;
    - a D&D sheet gives all five, whatever it holds.
  - **`#133 Convert on a Humblewood sheet holding ep:50`:** it folds it into `sp` (+250), and EP
    leaves `coinKeys()`.
  - **`#133 the trade window's give side offers the held EP`:**
    `X.tradeCoinsHTML('give',{},{ep:50,gp:0,sp:0,cp:0})` includes `data-trcoin="give:ep"`.
  - **In place** at `:840–842:** the check's name becomes "electrum counts on a Humblewood sheet,
    which shows it while held". Its assertion is unchanged.
- [ ] **Step 2: Run and see them fail.** `./src/tests/run.sh sheet`.
- [ ] **Step 3: Implement** the two Interfaces.
- [ ] **Step 4: Run; all green.** `./build.sh --no-zip && ./src/tests/run.sh`.
- [ ] **Step 5: Commit:** `feat(#133): the default-language swap; a Humblewood sheet shows PP and EP while it holds some`.

### Task 3: The Game system row and its warning (#133)

**Files:**
- Modify: `src/js/75-home-theme.js`: three new functions after `applyTheme()`.
- Modify: `src/js/88-settings.js`: `secDisplay`'s new first group, the `#segSystem` handler, and
  `confirmSystemChange()`.
- Test: `src/tests/sheet.js` (block A), `src/tests/rules-data.js`.

**Interfaces:**
- Consumes:
  - `swapDefaultLanguages()` and `coinKeys()` (Task 2);
  - `raceTerm()` (Task 1);
  - `defaultLanguagesFor()`, `advancementFor()`, `findRaceDef()`, `systemOf()`, `askConfirm()`.
- Produces:
  - `systemChangePlan(c, sys) -> {from, to, langs:{drop,add,keep}, coins, ancestryStays, advDiffers, term, wordmark}`.
    It writes nothing.
    - `langs` comes from `swapDefaultLanguages({system:c.system, languages:JSON-copy of c.languages}, sys)`.
    - `coins` is `{gain:true}` for `to==="dnd"`. For `to==="humblewood"` it is `{pp,ep}` (whole
      numbers held, at least one > 0), else `null`.
    - `ancestryStays` is the race name when `systemOf(findRaceDef(...))===from`, else `""`.
    - `advDiffers` is `JSON.stringify(advancementFor({system:from}))!==JSON.stringify(advancementFor({system:to}))`.
    - `term` is "Race" or "Ancestry". `wordmark` is "D&D Character Sheet" or "Humblewood".
  - `systemChangeLines(plan) -> string[]`: the Global Constraints' sentences 1–7, each only when it
    applies.
  - `changeSystem(c, plan) -> void`: `c.system=plan.to`, then `swapDefaultLanguages(c, plan.to)`.
    No log, and no coins.
  - `confirmSystemChange(sys) -> Promise<boolean>` (in `88-settings.js`):
    - It resolves `false` without asking when there is no `activeId`, when `sys` isn't `"dnd"` or
      `"humblewood"`, or when `sys===character.system`.
    - Otherwise it calls `askConfirm({title, message:lines.join(" "), cancel:"Cancel", ok})`.
    - On yes:
      - `changeSystem(character, plan)`;
      - `applyTheme()`;
      - `renderCoins()`;
      - `renderInventory()`;
      - `renderChipsAll()`;
      - `recompute()`;
      - `scheduleSave()`;
      - then it resolves `true`.
  - `#segSystem`: two buttons, `data-sys="humblewood"` and `data-sys="dnd"`, each with
    `aria-pressed`. Its click handler calls `confirmSystemChange()` and, only on `true`, moves `on`
    and `aria-pressed` itself.

- [ ] **Step 1: Write the failing checks** (block A; add the four names).
  - **Plan purity:** `#133 systemChangePlan writes nothing`. The character (and its `invLog`) is
    deep-equal before and after. Its `langs` equal what `changeSystem()` then returns from the
    swap.
  - **Coins in the plan:** `#133 plan coins`:
    - D&D → Humblewood with `pp:3,ep:4` gives `{pp:3,ep:4}`, and with neither, `null`;
    - → D&D gives `{gain:true}`.
  - **`systemChangeLines` sentences** (`#133 systemChangeLines`):
    - the coin sentence "Your 3 PP and 4 EP stay on the Coins card until you spend or convert them.";
    - "Your 4 EP stay…" when only EP is held;
    - "Strig stays on the sheet." only with a Humblewood-sourced ancestry (stub a race
      `{name:'Strig',_source:'Humblewood'}` into `X.rules.races`);
    - the language sentence only when `langs` drop or add, with the stubbed defaults from Task 2:
      "Humblefolk (a Humblewood default) goes; Common stays." and "Dwarvish is added.";
    - the last two sentences always.
  - **`changeSystem()`** sets `system`, swaps the languages, and leaves `coins` and `invLog`
    deep-equal.
  - **Review Focus 4:** a round trip through `changeSystem()` both ways restores the languages and
    coins, with the stubbed defaults and with `{}`.
  - **Asking, and Review Focus 1–2** (`ctx.askConfirm` stubbed to record its options and answer):
    - `confirmSystemChange('dnd')` on a Humblewood character asks:
      - title "Make Wren a D&D character?";
      - ok "Make it D&D".
    - On `false` it resolves `false` with the character deep-equal.
    - On `true` it resolves `true` with `system==='dnd'`.
    - For an unnamed sheet, "Make this character a Humblewood character?".
    - With the current system, or with `'pathfinder'`, it resolves `false` without asking.
  - **`rules-data.js`:**
    - Sheet display's first group is "Game", holding `segSystem` before `swHpColor`, and its help
      is the spec's;
    - the `#segSystem` handler moves `on` only after `confirmSystemChange(...)` resolves `true`.
- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement** spec §5 and the Interfaces above. Joining names in the language
  sentence: "A", "A and B", "A, B and C".
- [ ] **Step 4: Run; all green.** Also a throwaway Node check in the scratchpad (CLAUDE.md): load
  the app with `harness.loadApp`. For each pairing of `{system, languages}` (four chip mixes, both
  systems, both stubbed default maps), compare `systemChangePlan().langs` with what
  `changeSystem()` then does. Expected: no mismatch.
- [ ] **Step 5: Commit:** `feat(#133): a Game system row on Sheet display that says what changes first`.

### Task 4: Every settings save says so (#141)

**Files:**
- Modify: `src/js/70-persistence.js`: `saveSettingsSaid()` and its memory, beside
  `saveSettings()`.
- Modify: `src/js/88-settings.js`: `showPage()`, `#segSkin`, `#segTheme`, `#swRough`,
  `#swTabIcons`, `#swBackdrop`.
- Modify: `src/js/86-rules-browser.js`: `rbOpenCat()`.
- Modify: `src/js/90-boot.js`: `#btnTheme`; `_pillSaved` goes, so the two pill handlers call the
  helper; `#homeSkin`, `#homeMode`, `#homeRough`; the fold line at `:409`.
- Test: `src/tests/sheet.js` (block B), `src/tests/rules-data.js` (`:2204` and `:2502` in place,
  plus new guards).

**Interfaces:**
- Produces: `saveSettingsSaid(what?) -> string`, the result of `saveSettings()`.
  - It toasts `{err:true}` with the Global Constraints' sentence: with no `what`, the settings one;
    with `what`, "Couldn't save *what*: *why*."
  - It doesn't toast when `storageBlockedWhy()` is non-empty, or when that exact sentence has
    already shown this session.
  - A save that lands empties the memory: a module-level `Set` in `70-persistence.js`, never saved.
- Boot: `if(foldLegacySettings())extSaveError=saveSettings()||"";` (`extSaveError` is
  `89-extensions.js`'s top-level `let`, visible to `boot()`).

- [ ] **Step 1: Write the failing checks.**
  - **Block B**, each case in a fresh `BS.app({}, {noBoot:true})` with `a.ctx.toast` replaced by a
    recorder:
    - `#141 a refused settings save toasts once`:
      - `a.state.quotaFull=true`, then `saveSettingsSaid()` twice gives one toast, reading "Couldn't
        save your settings: your browser's storage is full. Changes to settings last until you close
        Fieldbook.", with `{err:true}`;
      - `saveSettingsSaid('that you cleared the notice')` then gives a second, different toast;
      - `quotaFull=false`, then a save gives no toast;
      - `quotaFull=true` again gives the settings toast again.
    - `#141 rbOpenCat with storage full raises the same one toast` (`a.ctx.rbOpenCat('glossary')`;
      Glossary is always in `RB_CATS`).
    - The handlers bound in `openSettings()` and `wire()` can't be clicked in the harness, so each
      is pinned by the `rules-data.js` site check below plus this behaviour of the helper. That is
      this plan's reading of spec §9's "through their handlers".
    - `#141 with storage working no toast at all`.
    - `#141 blocked storage`: `BS.app({}, {ls:BS.denied()})` gives boot's one alert; then
      `saveSettingsSaid()` gives no toast.
    - `#141 a refused boot fold is kept for the Extensions page`:
      - store `hw-fb-settings` as `{"rulesSources":[…one old source…]}`;
      - in `opts.before`, set `a.state.quotaFull=true`;
      - after boot, `a.ctx.extSaveErrorText()` is "your browser's storage is full", and no toast.
  - **`rules-data.js`:**
    - Rewrite `:2204` and `:2502` in place so they expect `saveSettingsSaid()`.
    - **New, every save reports:** each `saveSettings()` call in `src/js` other than its own
      definition is either inside `saveSettingsSaid()`, or its result is assigned, tested or
      returned. No bare statement.
    - **New, each named site:** each of the twelve sites in spec §8's "helper" rows calls
      `saveSettingsSaid(`.
    - **New:** `_pillSaved` is gone.
    - **New:** the fold line assigns `extSaveError`.
- [ ] **Step 2: Run and see them fail.**
- [ ] **Step 3: Implement** the Interfaces and spec §8's table. The `#segSkin` handler from Task 1
  now calls the helper.
- [ ] **Step 4: Run; all green.**
- [ ] **Step 5: Commit:** `fix(#141): a refused settings save says so, once a session`.

### Task 5: Drive and shoot

**Files:** none tracked. PNGs go to `.claude/qa/in-progress/133-skin-settings-saves/` in the main
checkout.

- [ ] **Step 1:** `./build.sh --no-zip`, then open `file://…/.claude/worktrees/133/dist/fieldbook.html`
  in the project's Playwright MCP.
- [ ] **Step 2: Drive and shoot the after set,** spec §10's list, both skins, at 1280 and 390:
  - Appearance; Sheet display with Game system.
  - The warning both ways:
    - to Humblewood holding `pp:3,ep:4`, Cancel first (the control is unmoved), then yes;
    - to D&D with a Humblewood ancestry.
  - The header and top bar: a D&D character under the Humblewood skin, and a Humblewood character
    under Classic.
  - The Humblewood Coins card holding EP; the New character hint.
  - The error toast:
    - Override `localStorage.setItem` to throw `QuotaExceededError` for `hw-fb-settings`.
    - Toggle Mode over Settings, then toggle borders and see no second toast.
    - Toggle Skin on the home screen.
- [ ] **Step 3:** List, in the task's report, what was driven, what was only shot, and what wasn't
  done (real devices, touch, Mike's characters).

### Task 6: Docs

**Files:**
- `src/docs/_claude/WIRING-LEDGER.md` (append at the end);
- the wiki pages in spec §10;
- `.claude/skills/release/pre-release.md` ≈ 364;
- `src/docs/specs/1.9.0/2026-10-23-sheet-makeover-design.md` (one pointer);
- `src/docs/UNRELEASED.md`.

- [ ] **Step 1:** Append one ledger entry at the end of `WIRING-LEDGER.md`, headed
  `## #133, #141: Skin is look only; every settings save says so (Mike, 2026-11-07)`. Note the
  heading's line number, `L<n>`.
- [ ] **Step 2:** Rewrite each spec §10 wiki page to the new truth, each with a History line citing
  `L<n>, #133` (or `#141`).
  - **Theming & icons:** "The skin is look only; the system is the character's", and its Decisions
    row.
  - **Settings & updates, Home & characters, Storage, Character model, Character building,
    Overview, Inventory.**
  - **Decisions:** rows for spec decisions 1, 2, 3, 8, 15 and 16.
  - **Known issues:** the #133 and #141 lines go. Decision 9's case is added under "Latent: no
    shipped data triggers these yet".
  - **Screenshot QA:** the both-skins rule, shot by setting `settings.skin` and `applyTheme()` or
    tapping Skin. Shoot one D&D and one Humblewood character for system lines.
  - **The 1.9.1 roadmap row,** naming `swapDefaultLanguages()`.
- [ ] **Step 3:** The other docs:
  - `pre-release.md` ≈ 364 gets the same both-skins wording.
  - The sheet makeover spec's "§4 … not needed (#133)" deviation gets a one-line pointer to this
    spec.
  - Don't edit `src/docs/qa/smoke.md` (Mike's). Put spec §10's proposed line 78 in the branch's
    final report.
- [ ] **Step 4:** Add spec §10's four `UNRELEASED.md` bullets verbatim, under `## Pending`.
- [ ] **Step 5:** `./build.sh --no-zip && ./src/tests/run.sh`: every suite green.
- [ ] **Step 6: Commit:** `docs(#133, #141): Skin is look only and settings saves say so, in the wiki and ledger`.
