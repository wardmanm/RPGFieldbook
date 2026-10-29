# End of Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End combat asks in the app's own warning window. Confirming ends the fight and opens one "End of combat"
window that wraps the fight up in folded sections: the summary, the ammunition that came back (with Undo), XP (with a
party split), loot through a trade, and the trackers and journal pages flagged "Show after combat".

**Architecture:**
- **Task 1.** The data: `xpSplit`, `endCombatOpen`, and `afterCombat` on trackers and pages. This covers `blankChar()`,
  `migrate()` and the round trip, plus the "Show after combat" switch in the tracker form and the page editor.
- **Task 2.** Quiet recovery: `applyAmmoRecovery({quiet})` returns `{lines, undo}` instead of toast words.
- **Task 3.** The new fragment `87-combat-end.js`:
  - `endCombatAsk()` asks through `askConfirm()`, and `endCombatNow()` does the ending;
  - the window shell, the summary, the folded rows, and the Ammunition section with Undo.
- **Task 4.** Experience: the box, the split, Done, the level-up hand-off, and the dismiss guard.
- **Task 5.** Loot: `openTrade()` gains `onClose`, and the window comes back after a trade.
- **Task 6.** After combat: live tiles with every copy patched, pages ticked through a new dispatcher branch, and the
  hidden-tab and `showTrackers` rules.
- **Task 7.** QA and docs.

**Tech Stack:** Plain ES2020, concatenated, no modules. Node suites through `src/tests/harness.js`. The project's
Playwright MCP (`mcp__playwright__*`) for screenshots.

**Spec:** `src/docs/specs/2026-10-29-end-of-combat-design.md`. Read it first: it is the binding authority, and its §2
decisions are Mike's.
**Mockup:** `.superpowers/brainstorm/55197-1793279092/content/end-combat-layout.html`, layout **B** (folded sections).

**Worktree:** create it with `./scripts/wt.sh add 105 end-of-combat`. That gives `.claude/worktrees/105`, branch
`issue/105-end-of-combat`. Run every command from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/105`.

## Global Constraints

- **Build.** One shipped file, built by concatenation:
  - no modules, no `import`/`export`, no new network calls;
  - `boot()` stays last in `90-boot.js`;
  - the new fragment goes into `src/manifest.json` after `87-trackers.js` and before `88-settings.js`;
  - top-level `let`/`const` are only read inside functions, never at load (TDZ).
- **Bytes.** LF line endings, a final newline, no BOM, no CR.
- **Git.**
  - Never `git add` `dist/fieldbook.html` or `docs/CHANGELOG.md`.
  - Never touch `APP_VERSION`, `DATA_VERSIONS`, `CHANGELOG`, or `data/packs.json`'s `version`/`digest`/`release`.
  - Commit messages are `feat(#105): …` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **The character.**
  - New fields are optional, defaulted in `blankChar()` and cleaned in `migrate()`. `migrate()` keeps every other
    field: never a whitelist.
  - The defaults are `xpSplit:false` and `endCombatOpen:{}`.
  - `trackers[i].afterCombat` and `journal[i].afterCombat` exist only when `true`.
- **Markup.**
  - Every `${…}` that reaches HTML goes through `esc()`. Page text goes through `noteHTML()`, which escapes first.
  - Every new control is a real `<button type="button">`, and touch targets are at least 44px.
  - Nothing scrolls sideways at 390px.
- **CSS.** Use tokens only (`var(--ink)`, `var(--hair)`, `var(--accent-2)`, …), with no hex colours, so both skins
  (classic, humblewood) and both themes follow. The window's CSS goes in `src/css/50-modal.css`.
- **Private text.** No 2024/XGE/TCE/Humblewood rules text in any public file, tests and fixtures included. The leak
  scan fails on a run of 14 words. Use invented names (Goblin 1, Bugbear, Brindle, "Loot list").
- **Wording.** The spec's UI strings are verbatim, with the two exceptions noted on Task 3:
  - Warning title "End combat?". Message "End the fight at round 5?", plus " Ammunition comes back under your
    recovery rule." only when something was fired since Start and the rule is not None. Buttons "Keep fighting"
    (safe) and "End combat".
  - Window title "End of combat". Time line "Round 5 · 30 sec", from `fmtCombatTime()`. Rows "Ammunition",
    "Experience", "Loot", "After combat". Button "Done".
  - A fallen chip's accessible name ends ", fell".
  - Ammunition lines come from `ammoLogTitle()`, for example "Arrows: 9 fired, 4 recovered". Under None they read
    "Arrows: 9 fired, none come back (recovery: None)". The buttons are "Undo recovery", then "Recovery undone".
  - XP: "XP 6,350 / 6,500", "+112 XP", "Split among 4", "450 ÷ 4 = 112 each",
    "Level 6 ready — the level-up opens when you press Done.", and the guard "Add 112 XP?".
  - Loot: "Open trade…" (row status), "Coins and items from the fight go through a trade, so they're in your inventory
    log.", "Open trade" (button), "Combat loot". The completed trade's own log title is "Traded with Goblin 1, Bugbear".
  - After combat: "2 trackers · 1 page", "1 tracker", "1 page".
  - The switch: "Show after combat".
- **The harness.**
  - Run one suite: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.
  - Run everything:
    `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`.
    Then restore the build files: `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.
  - App functions are on `ctx` (top-level function declarations are global in the vm). A suite can replace one,
    for example `ctx.askConfirm = …`, and app code calling it gets the replacement.
  - Top-level `let`s are read and written through `X.<name>` only when listed in `MUTABLE` in `harness.js`.
  - `setTimeout` is a no-op.
  - Never use `instanceof` on a value from the app. The vm has its own realm, so a vm `[]`, `{}` or Promise fails
    `instanceof` against the suite's constructors. Use `Array.isArray`, `typeof x.then === 'function'`, and
    `JSON.stringify` comparisons.
- **Screenshots.** Use the project's Playwright MCP only (`mcp__playwright__*`, never `mcp__plugin_playwright_*`).
  Save them to `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/in-progress/105-end-of-combat/`.

## Review Focus

1. **A rules term or table link in a flagged page, tapped in the window.** The document dispatcher would open the
   glossary or the table with `openModal()`, which would replace the End of combat window and lose the typed XP and the
   Undo. In the window they do nothing. → Task 6, "chips are inert in the window".
2. **The tracker tile's edit pen.** `trackerRowHTML()` draws one, and tapping it would replace the window with the
   tracker form in the same way. The window's tiles have no pen. → Task 6, "a tile without its edit pen".
3. **Odd input in the XP box, and Done pressed twice.** The box takes `""`, `abc`, `-3`, `12.9`, `1e3` and
   `2000000` as 0, 0, 0, 12, 1000 and 1,000,000. A second Done (a double-click) adds nothing and opens no second
   level-up. → Task 4, "the box takes whole numbers" and "Done again does nothing".
4. **A flagged page that is open in the Journal tab's editor.** A tick in the window would rewrite `p.text`, and the
   editor's next keystroke (`jnlInput()`) would write the textarea's old text back over it, silently undoing the
   tick. A tick on that page is refused. → Task 6, "not a page the Journal tab is editing".
5. **The loot trade closed with × or Escape.** Cancel and Complete are not the only ways out. `dismissModal()` runs
   the guard "Discard this trade?" and then the window's hand-on (`then`). Every way out must bring End of combat
   back, and declining the guard must not. → Task 5, "× on the trade runs onClose" and "declining Discard".

---

### Task 1: The data, and the "Show after combat" switches

**Files:**
- Modify: `src/js/00-constants.js`, `blankChar()` (:53). Add the two fields after
  `trackers:[], trackerCollapse:{}, trackerTotals:{}, showTrackers:true,` (:101).
- Modify: `src/js/71-char-io.js`:
  - add `cleanEndCombatOpen()` above `migrate()` (:101);
  - in `migrate()`, add the cleaning after `base.featsAllowed=…` (:153), which runs after `migrateTrackerPages()`
    (:140).
- Modify: `src/js/87-trackers.js`:
  - `trkFromForm()` (:103);
  - `trackerFormHTML()` (:182, the switch after `tkAutoRow`, :187);
  - `openTrackerForm()` (:309; `fields` at :324).
- Modify: `src/js/87-journal.js`:
  - `jnlSavePage()` (:78);
  - `journalEditorHTML()` (:177, the switch after the `jnl-tools` row, :186);
  - the new `jnlToggleAfterCombat()` after `jnlInput()`.
- Modify: `src/js/90-boot.js`, the click dispatcher, after `[data-jnlck]` (:65).
- Test: `src/tests/sheet.js`, a new block placed just above `async function t118EndToEnd()` (:7519).

**Interfaces:**
- Produces:
  - `character.xpSplit: boolean` (default `false`);
  - `character.endCombatOpen: {[row]: true}` (default `{}`);
  - `tracker.afterCombat === true | absent` and `page.afterCombat === true | absent`;
  - `cleanEndCombatOpen(v) -> {}`;
  - `jnlToggleAfterCombat() -> boolean` (the new state);
  - markup hooks `#tkAfter` (tracker form) and `[data-jnlac]` (page editor).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests.** Add this block to `src/tests/sheet.js` just above
  `async function t118EndToEnd()`:

```js
/* ---------- #105 the data: xpSplit, endCombatOpen, afterCombat on trackers and pages */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const src105 = n => require('fs').readFileSync(require('path').join(__dirname, '..', 'js', n), 'utf8');
  const keep = X.character;
  const b = X.blankChar();
  ck('#105 a new character: no split, every row folded', b.xpSplit === false && same(b.endCombatOpen, {}));
  const m = X.migrate({abilities: {}, xpSplit: 'yes', endCombatOpen: {ammo: true, xp: 1, loot: 'true', after: true, later: true},
    trackers: [{id: 't1', name: 'Goblins', afterCombat: true}, {id: 't2', name: 'Pages', afterCombat: 'yes'}],
    journal: [{id: 'p1', title: 'Loot list', afterCombat: true}, {id: 'p2', title: 'Notes', afterCombat: false}]});
  ck('#105 migrate: anything but true is no split', m.xpSplit === false && X.migrate({abilities: {}, xpSplit: true}).xpSplit === true);
  ck('#105 migrate: open rows keep only true values, any key', same(m.endCombatOpen, {ammo: true, after: true, later: true}), m.endCombatOpen);
  ck('#105 migrate: open rows that are not a plain object become {}',
     same(X.migrate({abilities: {}, endCombatOpen: ['ammo']}).endCombatOpen, {}) && same(X.migrate({abilities: {}, endCombatOpen: 'x'}).endCombatOpen, {}) &&
     same(X.migrate({abilities: {}}).endCombatOpen, {}) && same(X.migrate({abilities: {}, endCombatOpen: null}).endCombatOpen, {}));
  ck('#105 migrate: a tracker keeps afterCombat only when true', m.trackers[0].afterCombat === true && !('afterCombat' in m.trackers[1]));
  ck('#105 migrate: a page likewise', m.journal[0].afterCombat === true && !('afterCombat' in m.journal[1]));
  const back = X.migrate(JSON.parse(JSON.stringify(m)));
  ck('#105 a save → load round trip keeps all four', back.xpSplit === false && same(back.endCombatOpen, m.endCombatOpen) &&
     back.trackers[0].afterCombat === true && back.journal[0].afterCombat === true && !('afterCombat' in back.trackers[1]) && !('afterCombat' in back.journal[1]));
  ck('#105 ...and a split that is on stays on', X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {xpSplit: true})))).xpSplit === true);
  // the tracker form
  const f = X.trackerFormHTML({id: 't', type: 'counter', afterCombat: true}, [], false);
  ck('#105 the tracker form has Show after combat, on when set', /id="tkAfter" role="switch" aria-checked="true"/.test(f) && />Show after combat</.test(f), f);
  ck('#105 ...off by default', /id="tkAfter" role="switch" aria-checked="false"/.test(X.trackerFormHTML({type: 'counter', autoClose: true}, [], true)));
  ck('#105 the form writes it, and takes it away',
     X.trkFromForm({}, {afterCombat: true}).afterCombat === true && !('afterCombat' in X.trkFromForm({afterCombat: true}, {afterCombat: false})));
  ck('#105 the tracker form wires and reads the switch',
     /\$\("tkAfter"\)\.addEventListener\("click"/.test(src105('87-trackers.js')) && /afterCombat:\$\("tkAfter"\)\.classList\.contains\("on"\)/.test(src105('87-trackers.js')));
  // the page editor
  const ed = X.journalEditorHTML({id: 'p', title: 't', tag: '', text: '', afterCombat: true}, []);
  ck('#105 the page editor has Show after combat', /data-jnlac role="switch" aria-checked="true"/.test(ed) && />Show after combat</.test(ed), ed);
  ck('#105 ...off by default', /data-jnlac role="switch" aria-checked="false"/.test(X.journalEditorHTML({id: 'p', title: '', tag: '', text: ''}, [])));
  ck('#105 the switch is wired in the dispatcher', /t\.closest\("\[data-jnlac\]"\)\)return jnlToggleAfterCombat\(\)/.test(src105('90-boot.js')));
  const c = X.blankChar(); X.character = c;
  c.journal = [{id: 'p1', title: 'Loot list', tag: '', text: 'x', at: 1, editedAt: 1}];
  ctx.renderJournal(); ctx.jnlStartEdit('p1', 1, 'jnlText');
  ck('#105 on a saved page the switch writes the page', ctx.jnlToggleAfterCombat() === true && c.journal[0].afterCombat === true && c.journal[0].editedAt === 1);
  ck('#105 ...and off removes the key', ctx.jnlToggleAfterCombat() === false && !('afterCombat' in c.journal[0]));
  ctx.jnlNewPage();
  ck('#105 on a draft it is held until the page exists', ctx.jnlToggleAfterCombat() === true && c.journal.length === 1);
  ck('#105 ...and the new page takes it', X.jnlSavePage(c, {id: 'n1', afterCombat: true}, {title: 'New'}, 5).afterCombat === true &&
     !('afterCombat' in X.jnlSavePage(c, {id: 'n2'}, {title: 'Other'}, 6)));
  ctx.jnlReset();
  ck('#105 not while nothing is being edited', ctx.jnlToggleAfterCombat() === false);
  X.character = keep;
}
```

- [ ] **Step 2: Run and watch it fail.** Run `node src/tests/sheet.js | grep -E "^FAIL|LOAD FAIL" | head`.
  Expected: FAIL on the `#105` checks, with `jnlToggleAfterCombat` undefined.

- [ ] **Step 3: Implement.**
  - `blankChar()`, after `trackers:[], trackerCollapse:{}, trackerTotals:{}, showTrackers:true,`:

```js
    /* #105: the End of combat window (87-combat-end.js): whether its XP box
       splits among the party, and which of its folded rows are open (row key ->
       true). Trackers and pages carry their own optional afterCombat:true. */
    xpSplit:false, endCombatOpen:{},
```

  - `71-char-io.js`, just above `function migrate(s){`:

```js
/* #105: which End of combat rows are open — key -> true; any other value is
   dropped. Not a whitelist of keys: a row added later keeps its state. */
function cleanEndCombatOpen(v){
  const o={};
  if(v&&typeof v==="object"&&!Array.isArray(v))Object.keys(v).forEach(k=>{if(v[k]===true&&k!=="__proto__")o[k]=true;});
  return o;
}
```

  - In `migrate()`, after the `base.featsAllowed=…` line:

```js
  /* #105: the End of combat window's settings, and "Show after combat" on
     trackers and pages, kept only when true — absent is off */
  base.xpSplit=s.xpSplit===true;
  base.endCombatOpen=cleanEndCombatOpen(s.endCombatOpen);
  base.trackers.forEach(t=>{if(t.afterCombat!==true)delete t.afterCombat;});
  base.journal.forEach(p=>{if(p.afterCombat!==true)delete p.afterCombat;});
```

  - `trkFromForm()`: add one line before `return t;`:

```js
  if(f.afterCombat===true)t.afterCombat=true;else delete t.afterCombat;   /* #105 */
```

  - `trackerFormHTML()`: insert after the `tkAutoRow` toggle's closing `</div>` and before
    `` `<div class="m-actions">` ``:

```js
    `<div class="toggle"><div><div class="t-lbl">Show after combat</div></div>`+
      `<button type="button" class="switch ${t.afterCombat===true?"on":""}" id="tkAfter" role="switch" aria-checked="${t.afterCombat===true?"true":"false"}" aria-label="Show after combat"></button></div>`+
```

  - `openTrackerForm()`: after the `$("tkAuto").addEventListener(…)` line, add the line below. Then add
    `afterCombat:$("tkAfter").classList.contains("on")` to the `fields` object, after `autoClose:…`.

```js
  $("tkAfter").addEventListener("click",e=>{const b=e.currentTarget,on=!b.classList.contains("on");b.classList.toggle("on",on);b.setAttribute("aria-checked",on?"true":"false");});
```

  - `jnlSavePage()`: in the create branch, replace `const p={id:draft.id,title,tag,text,at:draft.at,editedAt:now};`
    with:

```js
    const p={id:draft.id,title,tag,text,at:draft.at,editedAt:now};
    if(draft.afterCombat===true)p.afterCombat=true;   /* #105: set on the draft before the page existed */
```

  - `journalEditorHTML()`: insert after the `jnl-tools` line and before `NOTE_FMT_HINT+`:

```js
    `<div class="toggle"><div><div class="t-lbl">Show after combat</div></div>`+
      `<button type="button" class="switch ${p.afterCombat===true?"on":""}" data-jnlac role="switch" aria-checked="${p.afterCombat===true?"true":"false"}" aria-label="Show after combat"></button></div>`+
```

  - `87-journal.js`, after `jnlInput()`:

```js
/* "Show after combat" (#105), from the editor. A saved page takes it at once,
   and it is not content, so editedAt stays. A draft that is not a page yet
   (jnlSavePage()'s rule) holds it until its first keystroke makes the page. The
   switch is patched in place: the editor is never rebuilt while open. */
function jnlToggleAfterCombat(){
  if(!jnlUI.editing||!jnlUI.draft)return false;
  const p=jnlPages(character).find(x=>x.id===jnlUI.draft.id);
  const on=!((p||jnlUI.draft).afterCombat===true);
  if(on)jnlUI.draft.afterCombat=true;else delete jnlUI.draft.afterCombat;
  if(p){if(on)p.afterCombat=true;else delete p.afterCombat;scheduleSave();}
  const b=document.querySelector("[data-jnlac]");
  if(b){b.classList.toggle("on",on);b.setAttribute("aria-checked",on?"true":"false");}
  return on;
}
```

  - `90-boot.js`: after `if(t.closest("[data-jnlck]"))return insertJournalCheckbox();`:

```js
    if(t.closest("[data-jnlac]"))return jnlToggleAfterCombat();
```

- [ ] **Step 4: Run.** Run `sheet.js` first, then the full suite and restore the build files. Expected: ALL PASSED.
  The existing editor checks (:2770–:2793) must still pass. The switch sits after the stamp/checkbox pair, never
  between them.

- [ ] **Step 5: Commit.**

```bash
git add src/js/00-constants.js src/js/71-char-io.js src/js/87-trackers.js src/js/87-journal.js src/js/90-boot.js src/tests/sheet.js
git commit -m "feat(#105): the End of combat window's data, and Show after combat on trackers and pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Quiet ammunition recovery

**Files:**
- Modify: `src/js/62-ammo.js`:
  - `applyAmmoRecovery()` (:751–758);
  - `undoRecoveryTap()` (:762–772).
- Test: `src/tests/sheet.js`, a new block just below Task 1's.

**Interfaces:**
- Consumes: `recoverAmmo(c,kinds,rec)` (:387), `ammoRecoverable(c)` (:328), `ammoSpentMap(c)` (:254),
  `undoRecovery(c,rec)` (:467) and `ammoLogTitle(kind,fired,back)` (:366).
- Produces:
  - `applyAmmoRecovery(opts)`, where `opts = {quiet?:boolean, logged?:[{kind, e}]}`. `logged` holds End combat's log
    lines.
  - Quiet, it returns `{lines:[{kind, fired, back}], undo:(()=>boolean)|null}`. `lines` is what came back per kind,
    and `undo` is `null` when nothing did. It never returns null.
  - Without `quiet`, it behaves exactly as today: `{text, rec, list}` or `null`.
  - `undoRecoveryTap(rec, who, amend, opts)`, where `opts = {quiet?:boolean}`. Quiet skips the "Recovery undone"
    toast; nothing else changes.

> **Note (spec §5):** the spec gives `applyAmmoRecovery()` only `opts.quiet`. Its Undo must still correct End
> combat's log lines, as the toast's does (`undoRecoveryTap(rec, who, {lines, list})`). Those lines are written in
> `endCombatAsk()` before recovery, so they are passed in as `opts.logged`. `undoRecoveryTap()` also gains
> `opts.quiet`, so the window's Undo doesn't put a "Recovery undone" toast over the window that already says it.

- [ ] **Step 1: Write the failing tests:**

```js
/* ---------- #105 quiet recovery: applyAmmoRecovery({quiet}) hands back {lines, undo} */
{
  const keep = {ch: X.character, toast: ctx.toast};
  const toasts = []; ctx.toast = (m, a) => { toasts.push({m: String(m), a}); return null; };
  const mk = () => {
    const c = X.blankChar(); X.character = c;
    c.inventory = [{id: 's1', name: 'Arrow', qty: 7, ammo: {kind: 'arrow'}}];
    c.ammoSpent = {s1: {n: 13, kind: 'arrow'},
                   s2: {n: 4, kind: 'bolt', snap: {id: 's2', name: 'Bolt', qty: 1, ammo: {kind: 'bolt'}}},
                   s3: {n: 1, kind: 'needle'}};
    return c;
  };
  const qty = c => c.inventory.map(i => i.id + ':' + i.qty).join();
  const loud = mk(), a = ctx.applyAmmoRecovery();
  const quiet = mk(), logged = [{kind: 'arrow', e: {title: 'Arrows: 13 fired, 6 recovered', meta: {fired: 13, back: 6}}}];
  const b = ctx.applyAmmoRecovery({quiet: true, logged});
  ck('#104 without quiet it behaves as today', a && a.text === 'recovered 6 of 13 arrows, 2 of 4 bolts' && !!a.rec && Array.isArray(a.list), a);
  ck('#105 quiet recovers exactly what the toast path recovers', qty(quiet) === qty(loud) && JSON.stringify(quiet.ammoSpent) === '{}', [qty(quiet), qty(loud)]);
  ck('#105 ...and hands back {lines, undo}, with no toast', b && Array.isArray(b.lines) && typeof b.undo === 'function' &&
     b.lines.map(r => r.kind + ':' + r.back).join() === a.list.map(r => r.kind + ':' + r.back).join() && toasts.length === 0, b);
  ck("#105 undo restores what the toast's Undo restores, and corrects the log line",
     b.undo() === true && quiet.inventory.find(i => i.id === 's1').qty === 7 && !quiet.inventory.some(i => i.id === 's2') &&
     quiet.ammoSpent.s1.n === 13 && quiet.ammoSpent.s3.n === 1 && logged[0].e.meta.back === 0 && logged[0].e.title === 'Arrows: 13 fired, 0 recovered', logged[0].e);
  ck('#105 ...quietly: no "Recovery undone" toast', !toasts.some(t => /Recovery undone/.test(t.m)), toasts);
  ck('#105 ...once', b.undo() === false);
  ck("#105 the toast's own Undo still says so", (() => { const k = mk(), rec = {}; X.recoverAmmo(k, null, rec); toasts.length = 0;
     return ctx.undoRecoveryTap(rec, k) === true && toasts.some(t => t.m === 'Recovery undone'); })());
  ck('#105 quiet with nothing counted: no lines, no undo', (() => { X.character = X.blankChar(); const r = ctx.applyAmmoRecovery({quiet: true});
     return !!r && r.lines.length === 0 && r.undo === null; })());
  ck('#105 quiet under None: the counts are cleared, nothing back, no undo', (() => { const k = mk(); k.ammoRecovery = 'none';
     const r = ctx.applyAmmoRecovery({quiet: true}); return r.lines.length === 0 && r.undo === null && JSON.stringify(k.ammoSpent) === '{}'; })());
  ck('#105 the quiet undo belongs to its own sheet', (() => { const k = mk(); const r = ctx.applyAmmoRecovery({quiet: true});
     X.character = X.blankChar(); return r.undo() === false && k.inventory[0].qty === 13; })());
  ctx.toast = keep.toast; X.character = keep.ch;
}
```

- [ ] **Step 2: Run and watch it fail.** Expected: FAIL on the `#105` checks, because the quiet call returns `{text…}`.

- [ ] **Step 3: Implement.** Replace `applyAmmoRecovery()` and `undoRecoveryTap()`, keeping their comments and adding
  to them:

```js
/* … (keep the existing comment) …
   #105: `opts.quiet` is End combat's path now: the same recovery, but instead
   of toast words it hands back {lines, undo} — `lines` what came back per kind
   (empty when nothing did), `undo` the toast's own Undo (undoRecoveryTap(),
   quiet) or null — for the End of combat window to show and offer.
   `opts.logged` is End combat's log lines, which that Undo corrects. Never
   null when quiet. Without `quiet`, exactly as before. */
function applyAmmoRecovery(opts){
  const o=opts||{};
  if(!Object.keys(ammoSpentMap(character)).length)return o.quiet?{lines:[],undo:null}:null;
  const list=ammoRecoverable(character), rec={}, who=character;
  recoverAmmo(character,null,rec);
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  if(o.quiet)return {lines:list,undo:list.length?()=>undoRecoveryTap(rec,who,{lines:Array.isArray(o.logged)?o.logged:[],list},{quiet:true}):null};
  return list.length?{text:`recovered ${ammoSummaryText(list)}`,rec,list}:null;
}
/* … (keep the existing comment) …
   `opts.quiet` (#105): no toast — the End of combat window says it itself. */
function undoRecoveryTap(rec,who,amend,opts){
  if(!character||character!==who)return false;
  if(!undoRecovery(character,rec))return false;
  if(amend&&Array.isArray(amend.lines)&&Array.isArray(amend.list))amend.list.forEach(r=>{
    const l=amend.lines.find(x=>x.kind===r.kind);if(!l||!l.e||!l.e.meta)return;
    l.e.meta.back=Math.max(0,num(l.e.meta.back)-num(r.back));l.e.title=ammoLogTitle(r.kind,num(l.e.meta.fired),l.e.meta.back);});
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  if(!(opts&&opts.quiet))toast("Recovery undone");
  return true;
}
```

- [ ] **Step 4: Run** `sheet.js`, then the full suite and restore the build files. Expected: ALL PASSED. The
  existing `#104` and `#47 I2` checks still pass, because `endCombatAsk()` hasn't changed yet.

- [ ] **Step 5: Commit.**

```bash
git add src/js/62-ammo.js src/tests/sheet.js
git commit -m "feat(#105): quiet ammunition recovery hands back what came back and its Undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The End of combat window, End combat's warning, and the Ammunition section

**Files:**
- Create: `src/js/87-combat-end.js`.
- Modify: `src/manifest.json`. Insert `"src/js/87-combat-end.js",` after `"src/js/87-trackers.js",`.
- Modify: `src/js/87-combat.js`:
  - replace `endCombatAsk()` (:355–372) with `endCombatAsk()` (async) and `endCombatNow()`;
  - add `let _endAsking`.
- Modify: `src/css/50-modal.css`. Append the `.ec-*` rules.
- Modify: `src/tests/harness.js`. Add `"_endFight"` to `MUTABLE` (:24).
- Modify: `src/tests/sheet.js`:
  - the new async `t105End()`, chained;
  - the existing `endCombatAsk` checks at :2471–2476, :4310–4357 and :6874–6888, which move to `endCombatNow()`;
  - the existing `t118…` chain (:8018).
- Modify: `src/tests/rules-data.js`, the `#104 End combat recovers…` text check (:446–447).
- Modify, for the `docs` suite (it fails the moment the fragment exists):
  - `CLAUDE.md:48` (`38 fragments` → `39 fragments`; only that number changes);
  - `src/docs/ADR-001-source-split.md:95` (`js/ (38 fragments)` → `js/ (39 fragments)`);
  - `src/docs/wiki/overview.md`: a code-map row after the `87-trackers.js` row (:159);
  - `src/docs/wiki/features/combat-view.md`: its **Code:** line cites `87-combat-end.js`.

**Interfaces:**
- Consumes:
  - Task 2's `applyAmmoRecovery({quiet:true, logged}) -> {lines, undo}`;
  - Task 1's `character.endCombatOpen`;
  - `askConfirm({title,message,cancel,ok}) -> Promise<boolean>` (`80-modal-forms.js:151`);
  - `openModal(title,html,icon,{wide})` (:36), `closeModal()` (:37), `setDismissGuard(fn, then)` (:22);
  - `combatEnd(c) -> {rounds, sec, combatants}` (`87-combat.js:73`), `fmtCombatTime(sec)` (:80),
    `combatantDead(r)` (`87-initiative.js:35`).
- Produces:
  - `endCombatAsk() -> Promise<boolean>`, and `endCombatNow() -> {rounds, sec, combatants}`, which ends the fight
    unasked;
  - `openEndOfCombat({rounds, sec, combatants, ammo:{logged, lines, undo}}) -> state`;
  - `let _endFight`, the window's memory, never saved:
    `{who, rounds, sec, combatants, ammo:{logged, lines, undo, undone}, xp:"", traded:"", asking:false}`;
  - `endFightLive() -> state|null`, which drops the state when `who !== character`;
  - `endFightShow() -> boolean` ((re)opens the window from `_endFight`), and `endFightGuard()`;
  - `endFightClose(add, levelUp) -> boolean`, `endFightDone() -> boolean`;
  - `endFightHTML(st, c) -> string`, `endFightSectionHTML(k, st, c)`, `endFightSection(k, st, c) -> {status, body}|null`;
  - `endFightToggle(k) -> boolean`, `endFightUndoAmmo() -> boolean`, `endFightRepaintSection(k, focusSel)`;
  - `endFightClick(e)`, `endFightWire()`;
  - `EC_ROWS = ["ammo","xp","loot","after"]` and `EC_LABEL`;
  - markup hooks: `[data-ecrow="<k>"]`, `#ecBody-<k>`, `#ecSt-<k>`, `#ecSec-<k>`, `#ecUndoAmmo`, `#ecDone`,
    `.ec-chips`.

> **Note (spec §4.2, Wording):** the spec's example "Arrows: 9 fired, 4 came back" calls itself "the log line's own
> wording, `ammoLogTitle()`". `ammoLogTitle()` (`62-ammo.js:366`) says "recovered". The intent is that the window and
> the log read the same, so the lines come from `ammoLogTitle()` and read "Arrows: 9 fired, 4 recovered".

> **Note (spec §4, Wording):** the spec's "Round 5 · 30 seconds" names `fmtCombatTime()`, which writes "30 sec"
> (`87-combat.js:80`). The window uses `fmtCombatTime()`: "Round 5 · 30 sec".

> **Note (spec §4.4):** `_endFight` is tied to the character **object** (`who`), not its id. That is the codebase's
> rule (`jnlUI.who`, `trkWho`, every toast Undo's `who`). Import → Replace keeps the id and swaps the sheet, and an
> id-keyed state would survive it. The object covers every case the id does.

> **Note:** `endCombatAsk()` becomes async, so the part after the question is its own function, `endCombatNow()`.
> The existing synchronous checks (#104, #47 I2) call that directly, and the asking is tested on its own in
> `t105End()`.

> **Note (layout):** `{wide:true}` gives the box a fixed height (`.modal.wide`, `50-modal.css:10`, set for Settings).
> Like the trade window, the window fills it: the sections scroll inside `.ec-scroll`, and Done is pinned at the
> bottom.

- [ ] **Step 1: Write the failing tests.**
  - `harness.js`: change `MUTABLE` to
    `["rules", "character", "activeId", "updateAvailable", "dataUpdate", "_undo", "_endFight"]`.
  - `sheet.js` :2471–2476. Replace the six lines from `c.combatRound = 7; state.confirm = false;` through
    `ck('saying yes ends it', …);` with:

```js
  c.combatRound = 7;
  ck('saying yes ends it (#105: the asking is t105End\'s)', !!ctx.endCombatNow() && !X.inCombat(c) && c.combatRound === 0);
```

  - `sheet.js` :4310–4313 (`let c = mk(); state.confirm = true; …` through `…[state.lastConfirm, c.inventory]);`)
    becomes:

```js
  let c = mk();
  ck('#104 End combat recovers half of each kind once the fight has ended',
     !!ctx.endCombatNow() && c.inventory.find(i => i.id === 's1').qty === 13 && (c.inventory.find(i => i.id === 's2') || {}).qty === 2, c.inventory);
```

  - `sheet.js` :4320–4329, the `c = mk(); c.ammoRecovery = 'none';` block, becomes:

```js
  c = mk(); c.ammoRecovery = 'none';
  {
    const realToast = ctx.toast; const said = [];
    ctx.toast = (msg, action) => { said.push({msg, action}); return null; };
    ck('#104 with nothing recoverable, End combat recovers nothing and clears the counts',
       !!ctx.endCombatNow() && c.inventory[0].qty === 7 && JSON.stringify(c.ammoSpent) === '{}', c.ammoSpent);
    ck('#105 ...hands the window no Undo recovery, and nothing is toasted', X._endFight && X._endFight.ammo.undo === null && said.length === 0, said);
    ctx.toast = realToast;
  }
```

  - `sheet.js` :4338: `X.endCombatAsk();` → `ctx.endCombatNow();`.
  - `sheet.js` :4347–4357, the block that starts `const k = mk(); let offer = null;`, becomes:

```js
  {
    const k = mk();
    ctx.endCombatNow();
    const undo = X._endFight && X._endFight.ammo.undo;
    ck('#105 End combat that recovered something hands the window its Undo recovery, the needle cleared too',
       typeof undo === 'function' && JSON.stringify(k.ammoSpent) === '{}', X._endFight && X._endFight.ammo);
    ck('#104 ...and Undo recovery brings the needle back with the rest',
       typeof undo === 'function' && undo() === true && k.ammoSpent.s3 && k.ammoSpent.s3.n === 1 && k.ammoSpent.s1.n === 13 && k.ammoSpent.s2.n === 4 &&
       k.inventory.find(i => i.id === 's1').qty === 7, k.ammoSpent);
  }
```

  - `sheet.js` :6874–6888. Replace `let offer = null; ctx.toast = (msg, action) => { offer = action; return null; };`
    and the following `X.endCombatAsk();` with `ctx.endCombatNow();`. The Undo check becomes
    ``ck('#47 I2 Undo recovery in the window takes End combat\'s recovery back off the line', X._endFight.ammo.undo() === true && am.title === 'Arrows: 6 fired, 2 recovered' && X.character.invLog.length === 1, am.title);``.
    In the second half, replace `X.recoverWeaponAmmo('bow', false); offer = 'none';` and `X.endCombatAsk();` with
    `X.recoverWeaponAmmo('bow', false);` and `ctx.endCombatNow();`. Replace `&& offer === undefined` with
    `&& X._endFight.ammo.undo === null`. Keep the `ctx.toast = () => null;` line that follows.
  - `rules-data.js` :446–447 becomes:

```js
  ck('#104 End combat recovers the ammunition once the fight has ended — quietly, for the End of combat window (#105)',
     /combatEnd\(character\)[\s\S]{0,200}applyAmmoRecovery\(\{quiet:true,logged\}\)/.test(js) && /openEndOfCombat\(Object\.assign\(\{\},s,\{ammo:/.test(js) &&
     !/label:"Undo recovery"/.test(js));
```

  - `sheet.js`: add above the chain line at the end of the file:

```js
/* ---------- #105 End combat asks in the app's own window, then opens End of combat.
   askConfirm is the test's (the #118 seam); openModal is wrapped so each
   window's title, body and options are recorded while the real one runs. */
async function t105End() {
  const keep = {ask: ctx.askConfirm, om: ctx.openModal, cm: ctx.closeModal, ch: X.character, toast: ctx.toast};
  const asks = [], opened = [], toasts = [];
  let answer = true;
  try {
    ctx.askConfirm = o => { asks.push(o); return Promise.resolve(answer); };
    ctx.openModal = function (t, h, i, o) { opened.push({title: t, html: h, opts: o}); return keep.om.apply(null, arguments); };
    ctx.toast = (m, a) => { toasts.push({m: String(m), a}); return null; };
    const mk = () => {
      const c = X.blankChar(); X.character = c; c.name = 'Tess';
      c.inventory = [{id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
                     {id: 's1', name: 'Arrow', qty: 20, ammo: {kind: 'arrow'}}];
      X.startCombatNow(); c.combatRound = 5;
      return c;
    };
    // the warning
    let c = mk(); answer = false;
    let r = await X.endCombatAsk();
    ck('#105 End combat asks through the app\'s warning window',
       asks.length === 1 && asks[0].title === 'End combat?' && asks[0].cancel === 'Keep fighting' && asks[0].ok === 'End combat', asks);
    ck('#105 ...nothing fired: just the round', asks[0].message === 'End the fight at round 5?', asks[0].message);
    ck('#105 Keep fighting changes nothing', r === false && X.inCombat(c) && c.combatRound === 5 && c.invLog.length === 0 && opened.length === 0);
    for (let i = 0; i < 9; i++) X.fireWeapon('w1', false);
    const spent = JSON.stringify(c.ammoSpent);
    r = await X.endCombatAsk();
    ck('#105 ...something fired: the recovery sentence', asks[1].message === 'End the fight at round 5? Ammunition comes back under your recovery rule.', asks[1].message);
    ck('#105 ...Keep fighting leaves the shots counted and logs nothing', r === false && JSON.stringify(c.ammoSpent) === spent && c.invLog.length === 0 && X.inCombat(c));
    c.ammoRecovery = 'none'; await X.endCombatAsk();
    ck('#105 ...under None the second sentence is left out', asks[2].message === 'End the fight at round 5?', asks[2].message);
    c.ammoRecovery = 'half';
    // End combat
    answer = true;
    r = await X.endCombatAsk();
    ck('#105 End combat ends the fight', r === true && !X.inCombat(c) && c.combatRound === 0);
    ck('#105 ...logs the kind and recovers, quietly: no toast, no Undo there',
       c.invLog.length === 1 && c.invLog[0].title === 'Arrows: 9 fired, 4 recovered' && c.inventory.find(i => i.id === 's1').qty === 15 && !toasts.some(t => t.a), [c.invLog[0] && c.invLog[0].title, toasts]);
    ck('#105 ...and opens End of combat, wide, with the time under the title',
       opened.length === 1 && opened[0].title === 'End of combat' && opened[0].opts && opened[0].opts.wide === true && opened[0].html.includes('<p class="ec-time">Round 5 · 30 sec</p>'), opened[0]);
    const st = X._endFight;
    ck('#105 the window\'s state is in memory, tied to this sheet', !!st && st.who === c && st.rounds === 5 && st.sec === 30 && typeof st.ammo.undo === 'function' && st.ammo.undone === false);
    let h = opened[0].html;
    ck('#105 Ammunition: a folded row with the log line\'s words',
       /data-ecrow="ammo" aria-expanded="false" aria-controls="ecBody-ammo"/.test(h) && /id="ecSt-ammo">Arrows: 9 fired, 4 recovered</.test(h) && /id="ecBody-ammo" hidden/.test(h), h);
    ck('#105 ...with Undo recovery', /id="ecUndoAmmo">Undo recovery</.test(h));
    ck('#105 Done', /id="ecDone">Done</.test(h));
    ck('#105 a row opens on a tap and remembers it on the character', ctx.endFightToggle('ammo') === true && c.endCombatOpen.ammo === true &&
       /data-ecrow="ammo" aria-expanded="true"/.test(ctx.endFightHTML(X._endFight, c)) && !/id="ecBody-ammo" hidden/.test(ctx.endFightHTML(X._endFight, c)));
    ck('#105 ...and folds again', ctx.endFightToggle('ammo') === false && !('ammo' in c.endCombatOpen));
    ck('#105 an unknown row is refused', ctx.endFightToggle('nope') === false && !('nope' in c.endCombatOpen));
    ck('#105 Undo recovery in the window does what the toast\'s did', ctx.endFightUndoAmmo() === true &&
       c.inventory.find(i => i.id === 's1').qty === 11 && c.invLog[0].title === 'Arrows: 9 fired, 0 recovered' && X._endFight.ammo.undone === true, c.invLog[0].title);
    h = ctx.endFightHTML(X._endFight, c);
    ck('#105 ...then reads "Recovery undone", with no toast', /Recovery undone/.test(h) && !/id="ecUndoAmmo"/.test(h) && !toasts.some(t => /Recovery undone/.test(t.m)));
    ck('#105 ...once', ctx.endFightUndoAmmo() === false);
    // Done, and ×
    let closes = 0; ctx.closeModal = () => { closes++; };
    ck('#105 Done closes the window and drops its state', ctx.endFightDone() === false && closes === 1 && X._endFight === null);
    ck('#105 ...a second Done does nothing', ctx.endFightDone() === false && closes === 1);
    ctx.closeModal = keep.cm;
    ctx.openEndOfCombat({rounds: 2, sec: 12, combatants: []});
    ctx.dismissModal();
    ck('#105 × and Escape close it and drop its state', X._endFight === null);
    ctx.openEndOfCombat({rounds: 2, sec: 12, combatants: []});
    X.character = X.blankChar();
    ck('#105 a change of character drops it', ctx.endFightLive() === null && X._endFight === null);
    // the summary
    c = mk();
    c.combatants = [{id: 'y', kind: 'you', name: 'Tess', init: 15}, {id: 'g1', kind: 'foe', name: 'Goblin 1', init: 14, band: 4},
                    {id: 'p', kind: 'party', name: 'Brindle', init: 12, dead: false}, {id: 'b', kind: 'foe', name: 'Bugbear <b>', init: 9, band: 2}];
    opened.length = 0; await X.endCombatAsk();
    h = opened[0].html;
    ck('#105 the summary: a chip per combatant in initiative order, this character left out',
       /<ul class="ec-chips">/.test(h) && h.indexOf('Goblin 1') < h.indexOf('Brindle') && h.indexOf('Brindle') < h.indexOf('Bugbear') && !h.includes('>Tess<'), h);
    ck('#105 ...the fallen struck through, "fell" in their name', h.includes('<li class="ec-chip fell"><s>Goblin 1</s><span class="sh-vh">, fell</span></li>') && h.includes('<li class="ec-chip">Brindle</li>'));
    ck('#105 ...escaped', h.includes('Bugbear &lt;b&gt;') && !h.includes('Bugbear <b>'));
    c = mk(); opened.length = 0; await X.endCombatAsk();
    ck('#105 a quiet fight: the time alone, no chips, no Ammunition row', !/ec-chips/.test(opened[0].html) && !/data-ecrow="ammo"/.test(opened[0].html), opened[0].html);
    c = mk(); for (let i = 0; i < 9; i++) X.fireWeapon('w1', false); c.ammoRecovery = 'none';
    opened.length = 0; await X.endCombatAsk();
    h = opened[0].html;
    ck('#105 under None: the row says none come back, and there is no Undo',
       /id="ecSt-ammo">Arrows: 9 fired, none come back \(recovery: None\)</.test(h) && !/id="ecUndoAmmo"/.test(h) && X._endFight.ammo.undo === null, h);
    // pressed twice
    c = mk(); opened.length = 0;
    let release = null; ctx.askConfirm = o => { asks.push(o); return new Promise(res => { release = res; }); };
    const p1 = X.endCombatAsk(), p2 = X.endCombatAsk();
    release(true);
    const a1 = await p1, a2 = await p2;
    ck('#105 End combat pressed twice ends once', a1 === true && a2 === false && opened.length === 1);
    const src105 = n => require('fs').readFileSync(require('path').join(__dirname, '..', 'js', n), 'utf8');
    ck('#105 the browser\'s confirm() is gone from End combat', !/confirm\(`End combat/.test(src105('87-combat.js')) && /t\.closest\("#cvEnd"\)\)return endCombatAsk\(\)/.test(src105('90-boot.js')));
  } catch (err) {
    ck('#105 t105End ran without throwing', false, String(err && err.stack || err));
  } finally {
    ctx.askConfirm = keep.ask; ctx.openModal = keep.om; ctx.closeModal = keep.cm; ctx.toast = keep.toast;
    X.character = keep.ch; X._endFight = null;
  }
}
```

  Change the last line of `sheet.js` to
  `t118EndToEnd().then(t118Warn).then(t118UndoUnderWarning).then(t105End).then(() => ck.done(), err => { ck('#118 e2e ran without throwing', false, String(err && err.stack || err)); ck.done(); });`.

- [ ] **Step 2: Run and watch it fail.** Run `node src/tests/sheet.js | grep -E "^FAIL|LOAD FAIL" | head -20`.
  Expected: FAIL, with `endCombatNow` and `openEndOfCombat` undefined.

- [ ] **Step 3: Implement.**
  - `87-combat.js`. Replace the comment `/* Asked first: … */` and the whole of `endCombatAsk()` with:

```js
/* Asked first (#105), in the app's own warning window: "Keep fighting" or
   "End combat" — the round count is what a stray tap would lose. Its second
   sentence only when something was fired since Start and the rule gives
   something back. One question at a time: a second press while it is open is
   refused (_endAsking). Resolves true when the fight ended. */
let _endAsking=false;
async function endCombatAsk(){
  if(_endAsking||!inCombat(character))return false;
  const who=character,r=num(character.combatRound);
  const ammo=ammoFightTotals(character).length>0&&ammoRecoveryOf(character)!=="none";
  _endAsking=true;
  let ok=false;
  try{ok=await askConfirm({title:"End combat?",message:`End the fight at round ${r}?`+(ammo?" Ammunition comes back under your recovery rule.":""),cancel:"Keep fighting",ok:"End combat"});}
  finally{_endAsking=false;}
  if(!ok||character!==who||!inCombat(character))return false;
  endCombatNow();
  return true;
}
/* What End combat does once confirmed (spec §3.2), in this order. First, one
   log line per ammunition kind fired this fight (#47), read before combatEnd()
   or the recovery touch ammoSpent, counting what the rows' Recover already
   gave back (ammoFight). Then the fight ends, the chrome is redrawn and saved,
   the ammunition is recovered quietly (#104's rule, no toast), and the End of
   combat window opens with what came back and its Undo. Returns combatEnd()'s
   {rounds, sec, combatants}. */
function endCombatNow(){
  const r=num(character.combatRound);
  const logged=ammoFightTotals(character).map(a=>({kind:a.kind,e:logInv({kind:"ammo",title:ammoLogTitle(a.kind,a.fired,a.back),
    lines:[{dir:"",text:`Fight of ${r} round${r===1?"":"s"}`}],undo:null,meta:{rounds:r,kind:a.kind,fired:a.fired,back:a.back}})}));
  character.ammoFight={};
  const s=combatEnd(character);
  renderActiveSpells();renderCombatChrome();scheduleSave();
  const got=applyAmmoRecovery({quiet:true,logged});
  setCombatLive(`Combat ended after ${s.rounds} round${s.rounds===1?"":"s"} (${fmtCombatTime(s.sec)})`);
  openEndOfCombat(Object.assign({},s,{ammo:{logged,lines:got.lines,undo:got.undo}}));
  return s;
}
```

  - `src/manifest.json`: add `"src/js/87-combat-end.js",` on the line after `"src/js/87-trackers.js",`.
  - Create `src/js/87-combat-end.js`:

```js
/* ================= the End of combat window (#105) =================
   Opened by endCombatNow() (87-combat.js) once End combat is confirmed and
   the fight has ended. One wide modal: the time, a chip per combatant, then
   folded rows (Ammunition, Experience, Loot, After combat), each a label and
   a one-line status that opens on a tap, remembered per character
   (endCombatOpen). A row with nothing to show is left out. Done closes it.
   Its memory, `_endFight`, is never saved: it belongs to the character OBJECT
   it was opened for (`who`), like every toast Undo here, and is dropped on
   Done, on ×/Escape and when the character changes (endFightLive()).
   After 87-journal.js and 87-trackers.js in the manifest: it draws their tiles
   and pages. Design: src/docs/specs/2026-10-29-end-of-combat-design.md */
const EC_ROWS=["ammo","xp","loot","after"];
const EC_LABEL={ammo:"Ammunition",xp:"Experience",loot:"Loot",after:"After combat"};
let _endFight=null;
function endFightLive(){if(_endFight&&_endFight.who!==character)_endFight=null;return _endFight;}
function endCombatOpenOf(c){const m=c&&c.endCombatOpen;return (m&&typeof m==="object"&&!Array.isArray(m))?m:{};}
function openEndOfCombat(r){
  const o=r||{},a=(o.ammo&&typeof o.ammo==="object")?o.ammo:{};
  _endFight={who:character,rounds:Math.max(0,num(o.rounds)),sec:Math.max(0,num(o.sec)),
    combatants:Array.isArray(o.combatants)?o.combatants:[],
    ammo:{logged:Array.isArray(a.logged)?a.logged:[],lines:Array.isArray(a.lines)?a.lines:[],undo:typeof a.undo==="function"?a.undo:null,undone:false},
    xp:"",traded:"",asking:false};
  endFightShow();
  return _endFight;
}
/* (Re)opens the window from _endFight: first from End combat, again after a
   trade. openModal() clears any guard, so it is set again every time. */
function endFightShow(){
  const st=endFightLive();if(!st)return false;
  openModal("End of combat",endFightHTML(st,character),"",{wide:true});
  setDismissGuard(endFightGuard,()=>endFightClose(false,false));
  endFightWire();
  return true;
}
/* ×/Escape: nothing to ask yet (the XP box arrives with Task 4). */
function endFightGuard(){return null;}
/* The window has closed for good: drop its memory. */
function endFightClose(add,levelUp){
  endFightLive();_endFight=null;
  return false;
}
function endFightDone(){
  if(!endFightLive())return false;
  closeModal();
  return endFightClose(true,true);
}

/* ---- markup: pure strings over (state, character), so the harness can assert every state ---- */
function endFightSummaryHTML(st){
  const list=(st.combatants||[]).filter(r=>r&&typeof r==="object"&&r.kind!=="you");
  if(!list.length)return "";
  return `<ul class="ec-chips">`+list.map(r=>{const nm=String(r.name||"");
    return combatantDead(r)?`<li class="ec-chip fell"><s>${esc(nm)}</s><span class="sh-vh">, fell</span></li>`:`<li class="ec-chip">${esc(nm)}</li>`;}).join("")+`</ul>`;
}
/* Per kind, the log line's own words (ammoLogTitle()), read from the line's
   meta so an Undo shows at once; under None, what that rule means. */
function endFightAmmoLines(st,c){
  const none=ammoRecoveryOf(c)==="none";
  return ((st.ammo&&st.ammo.logged)||[]).filter(l=>l&&l.e&&l.e.meta).map(l=>{
    const fired=Math.max(0,num(l.e.meta.fired)),back=Math.max(0,num(l.e.meta.back));
    if(none&&back===0){const nm=ammoPlural(l.kind);return `${nm.charAt(0).toUpperCase()+nm.slice(1)}: ${fired} fired, none come back (recovery: None)`;}
    return ammoLogTitle(l.kind,fired,back);
  });
}
function endFightAmmoSection(st,c){
  const lines=endFightAmmoLines(st,c);if(!lines.length)return null;
  const a=st.ammo||{},can=typeof a.undo==="function"&&(a.lines||[]).length>0;
  return {status:lines.join(" · "),
    body:lines.map(t=>`<p class="ec-line">${esc(t)}</p>`).join("")+
      (can?(a.undone?`<p class="ec-done">Recovery undone</p>`:`<button type="button" class="tbtn" id="ecUndoAmmo">Undo recovery</button>`):"")};
}
/* One row's {status, body}, or null to leave it out. */
function endFightSection(k,st,c){
  if(k==="ammo")return endFightAmmoSection(st,c);
  return null;
}
function endFightSectionHTML(k,st,c){
  const s=endFightSection(k,st,c);if(!s)return "";
  const open=endCombatOpenOf(c)[k]===true,K=esc(k);
  return `<section class="ec-sec" id="ecSec-${K}">`+
    `<button type="button" class="ec-row" data-ecrow="${K}" aria-expanded="${open?"true":"false"}" aria-controls="ecBody-${K}">`+
    `<svg class="fcaret${open?"":" c"}" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`+
    `<span class="ec-lbl">${esc(EC_LABEL[k]||k)}</span><span class="ec-st" id="ecSt-${K}">${esc(s.status)}</span></button>`+
    `<div class="ec-body" id="ecBody-${K}"${open?"":" hidden"}>${s.body}</div></section>`;
}
function endFightHTML(st,c){
  return `<div class="ec-wrap"><p class="ec-time">${esc(`Round ${st.rounds} · ${fmtCombatTime(st.sec)}`)}</p>`+
    `<div class="ec-scroll">${endFightSummaryHTML(st)}${EC_ROWS.map(k=>endFightSectionHTML(k,st,c)).join("")}</div>`+
    `<div class="m-actions ec-foot"><button type="button" class="tbtn primary" id="ecDone">Done</button></div></div>`;
}

/* ---- the DOM layer ---- */
/* A row opens or folds in place (never a rebuild: the XP box keeps its caret),
   remembered on the character. Returns whether it is now open. */
function endFightToggle(k){
  if(EC_ROWS.indexOf(k)<0||!endFightLive())return false;
  if(!character.endCombatOpen||typeof character.endCombatOpen!=="object"||Array.isArray(character.endCombatOpen))character.endCombatOpen={};
  const m=character.endCombatOpen;
  if(m[k]===true)delete m[k];else m[k]=true;
  const on=m[k]===true;
  scheduleSave();
  const b=document.querySelector(attrSel("data-ecrow",k)),body=document.getElementById("ecBody-"+k);
  if(b){b.setAttribute("aria-expanded",on?"true":"false");const cr=b.querySelector(".fcaret");if(cr)cr.classList.toggle("c",!on);}
  if(body)body.hidden=!on;
  return on;
}
/* One section redrawn from the state, focus put back by selector. */
function endFightRepaintSection(k,focusSel){
  const st=endFightLive(),el=document.getElementById("ecSec-"+k);if(!st||!el)return;
  el.outerHTML=endFightSectionHTML(k,st,character);
  if(focusSel){const f=document.querySelector(focusSel);if(f&&f.focus)f.focus({preventScroll:true});}
}
/* The toast's Undo recovery (undoRecoveryTap(), via applyAmmoRecovery's
   undo), offered only while this window is open; once. */
function endFightUndoAmmo(){
  const st=endFightLive(),a=st&&st.ammo;
  if(!a||a.undone||typeof a.undo!=="function")return false;
  if(!a.undo())return false;
  a.undone=true;
  endFightRepaintSection("ammo",attrSel("data-ecrow","ammo"));
  return true;
}
/* Wired once on #mBody, like the trade window's listener (67-trade.js), and
   idle unless this window is the one open. */
function endFightClick(e){
  if(!endFightLive()||!document.getElementById("ecDone"))return;
  const t=e&&e.target;if(!t||!t.closest)return;let m;
  if((m=t.closest("[data-ecrow]"))){endFightToggle(m.dataset.ecrow);return;}
  if(t.closest("#ecUndoAmmo")){endFightUndoAmmo();return;}
  if(t.closest("#ecDone")){endFightDone();return;}
}
function endFightWire(){
  const body=document.getElementById("mBody");if(!body||body.dataset.ecWired)return;
  body.dataset.ecWired="1";
  body.addEventListener("click",endFightClick);
}
```

  - `50-modal.css`: append:

```css
/* #105 the End of combat window (87-combat-end.js). It opens wide, so like the
   trade window it fills the fixed-height box: the rows scroll, Done stays. */
.ec-wrap{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;padding-right:14px}
.m-body .ec-time{margin:0 0 8px;font-family:var(--head);font-size:13px;color:var(--ink-soft)}
.ec-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 2px 8px}
.ec-chips{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;padding:0}
.ec-chip{border:1.3px solid var(--hair);border-radius:999px;padding:3px 10px;background:var(--field);color:var(--ink);font-size:14px}
.ec-chip.fell{color:var(--ink-soft)}
.ec-sec{border-top:1px dotted var(--hair)}
.ec-row{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 2px;border:0;background:none;color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.ec-lbl{flex:none;font-family:var(--head);font-weight:700;font-size:14px}
.ec-st{flex:1;min-width:0;text-align:right;color:var(--ink-soft);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ec-body{padding:2px 2px 12px}
.ec-body .tbtn{min-height:44px}
.m-body .ec-line{margin:0 0 6px}
.m-body .ec-done{color:var(--ink-soft);margin:0}
.ec-foot{flex:none;margin-top:0;padding:10px 0 14px;border-top:1px dotted var(--hair)}
.ec-foot .tbtn{min-height:44px}
```

  - Docs, for the `docs` suite:
    - `CLAUDE.md:48`: `38 fragments` → `39 fragments`.
    - `ADR-001-source-split.md:95`: `js/ (38 fragments)` → `js/ (39 fragments)`.
    - `overview.md`: after the `87-trackers.js` row, add
      ``| `87-combat-end.js` | the End of combat window: summary, folded rows, ammunition Undo, XP, loot, after-combat tiles and pages | [Combat view](features/combat-view.md) |``.
    - `combat-view.md`: on the **Code:** line, after `` `moveCombatCard()`, `setCombatOrder()`, `combatHeaderHTML()` in `87-combat.js` · ``,
      insert
      ``**the End of combat window** (#105), in `87-combat-end.js`: `openEndOfCombat()`, `endFightShow()`, `endFightHTML()`, `endFightToggle()`, `endFightUndoAmmo()`, `endFightDone()`; `endCombatNow()` in `87-combat.js` · ``.
    - Task 7 writes their History lines (they need the ledger heading).

- [ ] **Step 4: Run** `sheet.js` and `rules-data.js` (`node src/tests/rules-data.js | grep -E "^FAIL|ALL PASSED"`), then
  `node src/tests/docs.js | grep -E "^FAIL|ALL PASSED"`, then the full suite, and restore the build files. Expected: ALL
  PASSED everywhere. If `docs.js` names another place that quotes the fragment count, update the number there too and
  say so.

- [ ] **Step 5: Commit.**

```bash
git add src/js/87-combat-end.js src/manifest.json src/js/87-combat.js src/css/50-modal.css src/tests/harness.js src/tests/sheet.js src/tests/rules-data.js CLAUDE.md src/docs/ADR-001-source-split.md src/docs/wiki/overview.md src/docs/wiki/features/combat-view.md
git commit -m "feat(#105): End combat asks in the app's window and opens End of combat, with the ammunition and its Undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Experience: the box, the split, Done and the level-up, and the dismiss guard

**Files:**
- Modify: `src/js/87-combat-end.js`:
  - add the XP helpers and section;
  - replace `endFightSection()`, `endFightGuard()`, `endFightClose()`, `endFightClick()` and `endFightWire()`.
- Modify: `src/css/50-modal.css`. Append two rules.
- Test: `src/tests/sheet.js`. Add the async `t105Xp()`, chained after `t105End`.

**Interfaces:**
- Consumes:
  - `xpNumber(v) -> int|null` (`41-chips.js:52`), `xpProgress(c) -> {xp, level, cur, next, ready}|null` (:60) and
    `advancementOf(c)` (:32);
  - `cleanParty(v)` (`87-initiative.js:14`);
  - `doLevelUp(idx?)` (`56-class.js:275`). With no argument it is the level ring's own path (`[data-shlevelup]`,
    `90-boot.js:46`), which asks which class when there are several;
  - `renderLevelBadge()` (`40-sheet.js:564`) and `askConfirm(opts) -> Promise<boolean>` (`80-modal-forms.js:151`);
  - `dismissModal()` (`80-modal-forms.js:97`), which runs `_dismissGuard()`, then `closeModal()`, then `then()`.
- Produces:
  - `endFightN(n) -> "6,350"`, `endFightXpInt(v) -> 0..1000000`;
  - `endFightXpMath(typed, split, party) -> {typed, n, each}`;
  - `endFightPartySize(c) -> int` (roster plus one), `endFightXpBase(c) -> int`;
  - `endFightReadyLevel(c, add) -> int|null`;
  - `endFightXpView(st, c) -> {party, split, m, status, line, ready}|null`, `endFightXpToAdd(st, c) -> int`,
    `endFightXpSection(st, c)`;
  - `endFightSetXp(v)`, `endFightXpPatch(st)`, `endFightSetSplit(on) -> boolean`;
  - hooks `#ecXp`, `#ecSplit`, `#ecXpLine`, `#ecXpReady`.

> **Note (spec §3.4, controller's rulings):** `dismissModal()`'s guard means "return a question; Cancel keeps the
> window open", and it is synchronous. The spec wants Cancel to *close without* the XP, and the app's warnings go
> through `askConfirm()` (#118; #126 converts the rest, so #105 adds no new browser `confirm()`). So, with XP typed,
> the guard **returns `true`** (refuse this dismissal, silently) and starts
> `askConfirm({title:"Add 112 XP?", message:"You typed XP but didn't press Done.", ok:"Add XP", cancel:"Don't add"})`.
> On its answer the window closes either way: **Add XP behaves exactly as Done** (adds the XP, and opens the
> level-up when that XP made it ready); **Don't add** — or Escape on the warning — closes without it. A second ×
> while the warning is open does nothing new (the warning is already the top layer). Nothing typed: no question,
> the window simply closes. The harness drives `askConfirm` through its #118 seam (see how `sheet.js` answers it).

- [ ] **Step 1: Write the failing tests:**

```js
/* ---------- #105 Experience: the box, the split, Done, the level-up, the guard */
async function t105Xp() {
  const keep = {om: ctx.openModal, cm: ctx.closeModal, lu: ctx.doLevelUp, ask: ctx.askConfirm, ch: X.character, conf: state.confirm};
  const levelUps = [];
  let closes = 0;
  try {
    ctx.closeModal = () => { closes++; };
    ctx.doLevelUp = i => { levelUps.push(i); };
    const c = X.blankChar(); X.character = c; c.classes = [{name: 'Fighter', level: 4}]; c.level = 4; c.xp = '6,350';
    const open = () => ctx.openEndOfCombat({rounds: 3, sec: 18, combatants: []});
    open();
    let h = ctx.endFightHTML(X._endFight, c);
    ck('#105 XP: the row reads the progress', /id="ecSt-xp">XP 6,350 \/ 6,500</.test(h), h);
    ck('#105 XP: a whole-number box, 0 to 1,000,000', /id="ecXp" type="number" inputmode="numeric" min="0" max="1000000" step="1"/.test(h));
    ck('#105 XP: no roster, no split', !/id="ecSplit"/.test(h));
    ctx.endFightSetXp('450');
    h = ctx.endFightHTML(X._endFight, c);
    ck('#105 XP: typed, the row reads +450 XP', /id="ecSt-xp">\+450 XP</.test(h), h);
    ck('#105 XP: reaching a level says so', h.includes('Level 5 ready — the level-up opens when you press Done.'));
    c.party = [{id: 'a', name: 'Brindle'}, {id: 'b', name: 'Olvin'}, {id: 'c', name: 'Pip'}];
    h = ctx.endFightHTML(X._endFight, c);
    ck('#105 split: shown with a roster, N is the roster plus you, off by default', /id="ecSplit" role="switch" aria-checked="false"/.test(h) && />Split among 4</.test(h), h);
    ck('#105 split: on is saved on the character', ctx.endFightSetSplit(true) === true && c.xpSplit === true);
    h = ctx.endFightHTML(X._endFight, c);
    ck('#105 split: the line, and the share is what Done adds', /450 ÷ 4 = 112 each/.test(h) && /id="ecSt-xp">\+112 XP</.test(h), h);
    ck('#105 split: 112 does not reach level 5, so no ready line', !/Level 5 ready/.test(h));
    ck('#105 Done adds the share and writes a number', ctx.endFightDone() === true && c.xp === 6462 && closes === 1 && X._endFight === null, c.xp);
    ck('#105 ...no level reached, no level-up', levelUps.length === 0);
    ck('#105 ...and Done again does nothing', ctx.endFightDone() === false && c.xp === 6462 && levelUps.length === 0);
    open(); ctx.endFightSetSplit(false); ctx.endFightSetXp('100'); ctx.endFightDone();
    ck('#105 Done that reaches a level opens the level-up, by the ring\'s path', c.xp === 6562 && levelUps.length === 1 && levelUps[0] === undefined, levelUps);
    open(); ctx.endFightSetXp('10'); ctx.endFightDone();
    ck('#105 ...but not when the level-up was already ready', c.xp === 6572 && levelUps.length === 1);
    open(); ctx.endFightDone();
    ck('#105 Done with nothing typed leaves the XP alone', c.xp === 6572);
    ck('#105 split rounding is down', JSON.stringify(ctx.endFightXpMath('450', true, 4)) === JSON.stringify({typed: 450, n: 4, each: 112}) &&
       ctx.endFightXpMath('7', true, 2).each === 3 && ctx.endFightXpMath('7', false, 2).each === 7);
    ck('#105 the box takes whole numbers 0 to 1,000,000 only',
       ['', 'abc', '-3', '12.9', '1e3', '2000000', null].map(v => ctx.endFightXpInt(v)).join() === '0,0,0,12,1000,1000000,0');
    ck('#105 party size is the roster plus you', ctx.endFightPartySize({party: [{name: 'a'}, {name: 'b'}]}) === 3 && ctx.endFightPartySize({}) === 1 && ctx.endFightPartySize({party: [{name: ''}]}) === 1);
    ck('#105 a split left on with the roster emptied adds the whole', ctx.endFightXpToAdd({xp: '450'}, {advancement: 'xp', xpSplit: true, party: [], classes: [{level: 1}]}) === 450);
    c.xp = 'lots'; open(); ctx.endFightSetXp('50'); ctx.endFightDone();
    ck('#105 XP holding text: Done writes a number', c.xp === 50, c.xp);
    // the dismiss guard: the app's warning window, answered by the test
    ctx.closeModal = keep.cm;
    const asked = []; let answer = false;
    ctx.askConfirm = o => { asked.push(o); return Promise.resolve(answer); };
    const tick = () => new Promise(r => Promise.resolve().then(() => Promise.resolve().then(r)));
    open(); ctx.endFightSetXp('112'); answer = false;
    ctx.dismissModal();
    ck('#105 × with XP typed asks "Add 112 XP?" in the warning window, and the window stays meanwhile',
       asked.length === 1 && asked[0].title === 'Add 112 XP?' && asked[0].ok === 'Add XP' && asked[0].cancel === "Don't add" && X._endFight !== null, asked);
    ctx.dismissModal();
    ck('#105 ...a second × while asking asks nothing new', asked.length === 1);
    await tick();
    ck("#105 ...Don't add closes without it", c.xp === 50 && X._endFight === null);
    c.xp = 6400; open(); ctx.endFightSetXp('200'); answer = true;
    ctx.dismissModal(); await tick();
    ck('#105 ...Add XP adds it and closes, opening the level-up as Done does', c.xp === 6600 && X._endFight === null && levelUps.length === 2, levelUps);
    open(); asked.length = 0; ctx.dismissModal();
    ck('#105 with nothing typed, × simply closes', asked.length === 0 && X._endFight === null);
    c.xp = 162;
    // milestone
    c.advancement = 'milestone'; open();
    h = ctx.endFightHTML(X._endFight, c);
    ck('#105 a milestone character has no Experience row, nothing about XP', !/data-ecrow="xp"/.test(h) && !/XP/.test(h), h);
    ctx.endFightSetXp('500'); ctx.closeModal = () => {}; ctx.endFightDone();
    ck('#105 ...and Done adds nothing', c.xp === 162);
  } catch (err) {
    ck('#105 t105Xp ran without throwing', false, String(err && err.stack || err));
  } finally {
    ctx.openModal = keep.om; ctx.closeModal = keep.cm; ctx.doLevelUp = keep.lu; ctx.askConfirm = keep.ask; state.confirm = keep.conf;
    X.character = keep.ch; X._endFight = null;
  }
}
```

  Chain it: `….then(t105End).then(t105Xp).then(() => ck.done(), …)`.

- [ ] **Step 2: Run and watch it fail.** Expected: FAIL, with `endFightSetXp` undefined.

- [ ] **Step 3: Implement** in `87-combat-end.js`. Add after `endFightAmmoSection()`:

```js
/* ---- Experience (spec §4.3): shown only when the character levels by XP ---- */
function endFightN(n){return Math.max(0,Math.floor(num(n))).toLocaleString("en-US");}
/* The box's number: whole, 0 to 1,000,000; anything else is 0. */
function endFightXpInt(v){
  const s=String(v==null?"":v).trim();if(!s)return 0;
  const n=Math.floor(Number(s));
  return isFinite(n)&&n>0?Math.min(1000000,n):0;
}
/* What Done adds: the typed number, or its share, rounded down. */
function endFightXpMath(typed,split,party){
  const t=endFightXpInt(typed),n=split?Math.max(1,Math.floor(num(party))):1;
  return {typed:t,n,each:Math.floor(t/n)};
}
/* The Party roster (#91) plus this character. */
function endFightPartySize(c){return cleanParty(c&&c.party).length+1;}
/* The XP Done adds to: xpNumber() reads "6,350"; blank or text counts as 0. */
function endFightXpBase(c){const v=xpNumber(c&&c.xp);return v===null?0:v;}
/* The level the XP would make ready — only when the level-up is not ready
   before and is after, the rule Done opens it by. */
function endFightReadyLevel(c,add){
  if(advancementOf(c)!=="xp"||!(add>0))return null;
  const base=endFightXpBase(c),b=xpProgress(Object.assign({},c,{xp:base})),a=xpProgress(Object.assign({},c,{xp:base+add}));
  return a&&a.ready&&!(b&&b.ready)?a.level+1:null;
}
function endFightXpView(st,c){
  if(advancementOf(c)!=="xp")return null;
  const party=endFightPartySize(c),split=!!c&&c.xpSplit===true&&party>1,m=endFightXpMath(st.xp,split,party);
  const p=xpProgress(Object.assign({},c,{xp:endFightXpBase(c)})),lv=endFightReadyLevel(c,m.each);
  const status=m.each>0?`+${endFightN(m.each)} XP`:!p?"XP":p.next===null?`XP ${endFightN(p.xp)}`:`XP ${endFightN(p.xp)} / ${endFightN(p.next)}`;
  return {party,split,m,status,
    line:split&&m.typed>0?`${endFightN(m.typed)} ÷ ${m.n} = ${endFightN(m.each)} each`:"",
    ready:lv?`Level ${lv} ready — the level-up opens when you press Done.`:""};
}
function endFightXpToAdd(st,c){const x=endFightXpView(st,c);return x?x.m.each:0;}
function endFightXpSection(st,c){
  const x=endFightXpView(st,c);if(!x)return null;
  return {status:x.status,body:
    `<div class="field ec-xp"><label class="f" for="ecXp">XP</label><input id="ecXp" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="${esc(st.xp)}" autocomplete="off"></div>`+
    (x.party>1?`<div class="toggle"><div><div class="t-lbl">Split among ${esc(x.party)}</div></div>`+
      `<button type="button" class="switch${x.split?" on":""}" id="ecSplit" role="switch" aria-checked="${x.split?"true":"false"}" aria-label="Split among ${esc(x.party)}"></button></div>`:"")+
    `<p class="hint" id="ecXpLine"${x.line?"":" hidden"}>${esc(x.line)}</p>`+
    `<p class="ec-ready" id="ecXpReady"${x.ready?"":" hidden"}>${esc(x.ready)}</p>`};
}
/* Typing patches the status, the split line and the ready line in place, so
   the box keeps its caret. */
function endFightSetXp(v){
  const st=endFightLive();if(!st)return false;
  st.xp=String(v==null?"":v).slice(0,12);
  endFightXpPatch(st);
  return true;
}
function endFightXpPatch(st){
  const x=endFightXpView(st,character);if(!x)return;
  const s=document.getElementById("ecSt-xp");if(s)s.textContent=x.status;
  const l=document.getElementById("ecXpLine");if(l){l.textContent=x.line;l.hidden=!x.line;}
  const r=document.getElementById("ecXpReady");if(r){r.textContent=x.ready;r.hidden=!x.ready;}
}
/* Split among N: saved on the character at once (xpSplit). */
function endFightSetSplit(on){
  if(!endFightLive())return false;
  character.xpSplit=!!on;scheduleSave();
  endFightRepaintSection("xp","#ecSplit");
  return character.xpSplit;
}
```

  Replace `endFightSection()`:

```js
function endFightSection(k,st,c){
  if(k==="ammo")return endFightAmmoSection(st,c);
  if(k==="xp")return endFightXpSection(st,c);
  return null;
}
```

  Replace `endFightGuard()` and `endFightClose()`:

```js
/* ×/Escape (dismissModal()). With XP typed it refuses this dismissal (true)
   and asks "Add 112 XP?" in the app's warning window; either answer closes the
   window — Add XP exactly as Done (the level-up included), Don't add (or
   Escape) without it. Nothing typed: no question; the hand-on closes it. */
function endFightGuard(){
  const st=endFightLive();if(!st)return null;
  const n=endFightXpToAdd(st,character);if(!(n>0))return null;
  if(st.asking)return true;
  st.asking=true;
  askConfirm({title:`Add ${endFightN(n)} XP?`,message:"You typed XP but didn't press Done.",ok:"Add XP",cancel:"Don't add"})
    .then(yes=>{st.asking=false;if(endFightLive()!==st)return;const add=!!yes;closeModal();endFightClose(add,true);});
  return true;
}
/* The window has closed for good: drop its memory and, when `add`, write the
   XP (character.xp becomes a number). `levelUp` (Done only) opens the level-up
   when this XP made it ready, by the level ring's own path. Returns whether
   XP was added. */
function endFightClose(add,levelUp){
  const st=endFightLive();_endFight=null;
  if(!st||!add)return false;
  const n=endFightXpToAdd(st,character);if(!(n>0))return false;
  const lv=endFightReadyLevel(character,n);
  character.xp=endFightXpBase(character)+n;
  renderLevelBadge();scheduleSave();
  if(lv&&levelUp)doLevelUp();
  return true;
}
```

  Replace `endFightClick()` and `endFightWire()`:

```js
function endFightClick(e){
  if(!endFightLive()||!document.getElementById("ecDone"))return;
  const t=e&&e.target;if(!t||!t.closest)return;let m;
  if((m=t.closest("[data-ecrow]"))){endFightToggle(m.dataset.ecrow);return;}
  if(t.closest("#ecUndoAmmo")){endFightUndoAmmo();return;}
  if(t.closest("#ecSplit")){endFightSetSplit(character.xpSplit!==true);return;}
  if(t.closest("#ecDone")){endFightDone();return;}
}
function endFightWire(){
  const body=document.getElementById("mBody");if(!body||body.dataset.ecWired)return;
  body.dataset.ecWired="1";
  body.addEventListener("click",endFightClick);
  body.addEventListener("input",e=>{if(endFightLive()&&e.target&&e.target.id==="ecXp")endFightSetXp(e.target.value);});
}
```

  Update the comment on `endFightDone()` to say Done adds the XP and may open the level-up. Append to `50-modal.css`:

```css
.ec-xp input{max-width:200px}
.m-body .ec-ready{color:var(--accent-2);font-weight:700;margin:4px 0 0}
```

- [ ] **Step 4: Run** `sheet.js`, then the full suite, and restore the build files. Expected: ALL PASSED. Also run a
  throwaway Node check of the split arithmetic in the scratchpad (spec §9). For typed 0–2000 and N 1–8, `each` must
  equal `Math.floor(typed/N)` and never exceed `typed`.

- [ ] **Step 5: Commit.**

```bash
git add src/js/87-combat-end.js src/css/50-modal.css src/tests/sheet.js
git commit -m "feat(#105): the End of combat window's XP: the box, Split among N, Done into the level-up, and Add N XP? on close

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Loot: `openTrade`'s `onClose`, and the window back after a trade

**Files:**
- Modify: `src/js/67-trade.js`:
  - `let _trade=null,_trPick=false;` (:259);
  - `showTrade()` (:431–434);
  - `openTrade()` (:457), with its `#trCancel` branch (:489) and `#trComplete` branch (:490–496);
  - add `tradeClosed()` after `showTrade()`.
- Modify: `src/js/87-combat-end.js`:
  - add the Loot helpers;
  - replace `endFightSection()` and `endFightClick()`.
- Test: `src/tests/sheet.js`. Add the async `t105Loot()`, chained.

**Interfaces:**
- Consumes:
  - `openTrade(opts)`, `newTradeDraft({with, give, get})` (:260) and `completeTrade(d) -> logEntry|null` (:350,
    whose `title` is `"Traded with "+who`);
  - `endFightShow()` and `endFightLive()` (Task 3), and `combatantDead(r)`.
- Produces:
  - `openTrade({…, onClose?: (done: logEntry|null) => void})`. `onClose` runs once when the trade window closes for
    good: Cancel, Complete Trade, or × / Escape / a backdrop tap after its guard. It never runs for the finder, which
    steps aside and comes back (`tradeFind()`).
  - `tradeClosed(done)`;
  - `endFightLootWith(combatants) -> string`, `endFightLootSection(st, c)`, `endFightOpenLoot() -> boolean`,
    `endFightReopen(done) -> boolean`;
  - the hook `#ecTrade`.

> **Note (spec §4.4, controller's ruling):** `combatantDead()` covers a foe at band 4 and a party member marked dead.
> Loot's other party is who you took it from, so it names **fallen foes only** (`kind==="foe"`); a fallen party
> member is struck through in the summary but never named as the trade's other party. `you` is never listed.

- [ ] **Step 1: Write the failing tests:**

```js
/* ---------- #105 Loot: a trade from the window, and back */
async function t105Loot() {
  const keep = {om: ctx.openModal, ot: ctx.openTrade, ch: X.character, toast: ctx.toast, conf: state.confirm};
  const opened = [], trades = [];
  try {
    ctx.openModal = function (t, h) { opened.push({t, h}); return keep.om.apply(null, arguments); };
    ctx.toast = () => null;
    const c = X.blankChar(); X.character = c; c.classes = [{name: 'Fighter', level: 4}]; c.level = 4;
    const foes = [{id: 'y', kind: 'you', name: 'Tess'}, {id: 'g', kind: 'foe', name: 'Goblin 1', band: 4},
                  {id: 'g2', kind: 'foe', name: 'Goblin 2', band: 1}, {id: 'b', kind: 'foe', name: 'Bugbear', band: 4}];
    ck('#105 Loot: the other party is the fallen, joined with commas', ctx.endFightLootWith(foes) === 'Goblin 1, Bugbear');
    ck('#105 ...a fallen party member is never named', ctx.endFightLootWith(foes.concat([{id: 'p', kind: 'party', name: 'Brindle', dead: true}])) === 'Goblin 1, Bugbear');
    ck('#105 ...or "Combat loot" when none fell or nobody was tracked', ctx.endFightLootWith([foes[0], foes[2]]) === 'Combat loot' && ctx.endFightLootWith([]) === 'Combat loot');
    ctx.openEndOfCombat({rounds: 3, sec: 18, combatants: foes});
    let h = opened[opened.length - 1].h;
    ck('#105 Loot is always shown, reading "Open trade…"', /data-ecrow="loot"/.test(h) && /id="ecSt-loot">Open trade…</.test(h) && /id="ecTrade">Open trade</.test(h) &&
       h.includes("<p>Coins and items from the fight go through a trade, so they're in your inventory log.</p>"), h);
    ctx.endFightSetXp('450'); ctx.endFightToggle('xp'); ctx.endFightToggle('loot');
    ctx.openTrade = o => { trades.push(o); };
    ck('#105 Open trade passes the fallen as the other party, and an onClose', ctx.endFightOpenLoot() === true && trades.length === 1 && trades[0].with === 'Goblin 1, Bugbear' && typeof trades[0].onClose === 'function', trades);
    opened.length = 0; trades[0].onClose(null);
    h = opened.length ? opened[0].h : '';
    ck('#105 a cancelled trade brings the window back, its state intact', opened.length === 1 && opened[0].t === 'End of combat' &&
       /id="ecXp"[^>]*value="450"/.test(h) && /data-ecrow="xp" aria-expanded="true"/.test(h) && /data-ecrow="loot" aria-expanded="true"/.test(h) && /id="ecSt-loot">Open trade…</.test(h), h);
    opened.length = 0; trades[0].onClose({title: 'Traded with Goblin 1, Bugbear'});
    ck('#105 after a completed trade the row reads "Traded with …"', /id="ecSt-loot">Traded with Goblin 1, Bugbear</.test(opened[0].h));
    ck('#105 ...and another trade is allowed', ctx.endFightOpenLoot() === true && trades.length === 2);
    X.character = X.blankChar(); opened.length = 0; trades[1].onClose(null);
    ck('#105 a character change while trading drops the window; nothing reopens', opened.length === 0 && X._endFight === null);
    // the real trade window's onClose
    ctx.openTrade = keep.ot; X.character = c;
    let calls = [];
    ctx.openTrade({with: 'Goblin 1', onClose: d => calls.push(d)});
    ctx.dismissModal();
    ck('#105 × on the trade runs onClose, with null', calls.length === 1 && calls[0] === null, calls);
    ctx.dismissModal();
    ck('#105 ...once', calls.length === 1);
    calls = []; ctx.openTrade({with: 'x', get: {coins: {gp: 5}}, onClose: d => calls.push(d)});
    state.confirm = false; state.lastConfirm = null; ctx.dismissModal();
    ck('#105 declining "Discard this trade?" keeps it open: no onClose', calls.length === 0 && state.lastConfirm === 'Discard this trade?');
    state.confirm = true; ctx.dismissModal();
    ck('#105 ...accepting it hands back', calls.length === 1);
    calls = []; ctx.openTrade({onClose: d => calls.push(d)}); const e = {title: 'Traded with x'};
    ctx.tradeClosed(e); ctx.tradeClosed(null);
    ck('#105 tradeClosed hands the completed line on, once', calls.length === 1 && calls[0] === e);
    ck('#105 a trade with no onClose closes as before', (() => { ctx.openTrade({}); ctx.dismissModal(); return true; })());
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '67-trade.js'), 'utf8');
    ck('#105 Cancel and Complete Trade both hand back through onClose',
       /#trCancel"\)\)\{closeModal\(\);tradeClosed\(null\);return;\}/.test(src) && /const done=completeTrade\(d\);closeModal\(\);\s*if\(done\)toast\([^\n]*\n\s*tradeClosed\(done\);/.test(src));
    // end to end: the real trade over the real window, and back
    ctx.openEndOfCombat({rounds: 1, sec: 6, combatants: foes}); ctx.endFightSetXp('30');
    opened.length = 0; ctx.endFightOpenLoot();
    ck('#105 the trade window replaces this one, with the fallen in its With box', opened.length === 1 && opened[0].t === 'Trade' && /id="trWith" value="Goblin 1, Bugbear"/.test(opened[0].h));
    ctx.dismissModal();
    ck('#105 ...and closing it brings End of combat back, state intact', opened.length === 2 && opened[1].t === 'End of combat' && /id="ecXp"[^>]*value="30"/.test(opened[1].h));
  } catch (err) {
    ck('#105 t105Loot ran without throwing', false, String(err && err.stack || err));
  } finally {
    ctx.openModal = keep.om; ctx.openTrade = keep.ot; ctx.toast = keep.toast; state.confirm = keep.conf;
    X.character = keep.ch; X._endFight = null;
  }
}
```

  Chain it after `t105Xp`. The Loot sentence is a fixed string in the template, with no `${}`, so it reaches the
  markup as written and its `'` is not escaped.

- [ ] **Step 2: Run and watch it fail.** Expected: FAIL, with `endFightLootWith` undefined and `onClose` never called.

- [ ] **Step 3: Implement.**
  - `67-trade.js`: `let _trade=null,_trPick=false,_trOnClose=null;`.
  - Replace `showTrade()` and add `tradeClosed()`:

```js
function showTrade(){
  openModal("Trade",tradeHTML(_trade,character),"",{wide:true});
  /* × / Escape / a backdrop tap: after "Discard this trade?" (when it holds
     something), the dismissal hands on to tradeClosed() (#105) */
  setDismissGuard(()=>_trade&&!tradeEmpty(_trade)?"Discard this trade?":null,()=>tradeClosed(null));
}
/* The trade window has closed for good: Cancel, Complete Trade, or a
   dismissal. Never for the finder, which steps aside and brings it back
   (tradeFind()). Runs the opener's onClose once (#105: the End of combat
   window comes back), with the completed trade's log line or null. */
function tradeClosed(done){
  const f=_trOnClose;_trOnClose=null;_trade=null;
  if(f)f(done||null);
}
```

  - `openTrade()`: its first line becomes two:

```js
  _trOnClose=(opts&&typeof opts.onClose==="function")?opts.onClose:null;   /* #105 */
  _trade=newTradeDraft(opts);_trPick=false;
```

  - The Cancel branch becomes `if(t.closest("#trCancel")){closeModal();tradeClosed(null);return;}`. In the Complete
    branch, `const done=completeTrade(d);_trade=null;closeModal();` becomes `const done=completeTrade(d);closeModal();`,
    and `tradeClosed(done);` goes on its own line after `if(done)toast(…);` and before `return;`.
  - `87-combat-end.js`: add after the XP block:

```js
/* ---- Loot (spec §4.4): always shown; a trade, so it lands in the inventory log ---- */
function endFightLootWith(list){
  const names=(Array.isArray(list)?list:[]).filter(r=>r&&typeof r==="object"&&r.kind==="foe"&&combatantDead(r)).map(r=>String(r.name||"").trim()).filter(Boolean);
  return names.length?names.join(", "):"Combat loot";
}
function endFightLootSection(st){
  return {status:st.traded||"Open trade…",
    body:`<p>Coins and items from the fight go through a trade, so they're in your inventory log.</p>`+
      `<button type="button" class="tbtn" id="ecTrade">Open trade</button>`};
}
/* The trade window replaces this one (the modal has one layer); its onClose
   brings this back from _endFight, as it was. */
function endFightOpenLoot(){
  const st=endFightLive();if(!st)return false;
  openTrade({with:endFightLootWith(st.combatants),onClose:endFightReopen});
  return true;
}
function endFightReopen(done){
  const st=endFightLive();if(!st)return false;
  if(done&&typeof done==="object"&&done.title)st.traded=String(done.title);
  return endFightShow();
}
```

  Then replace `endFightSection()`:

```js
function endFightSection(k,st,c){
  if(k==="ammo")return endFightAmmoSection(st,c);
  if(k==="xp")return endFightXpSection(st,c);
  if(k==="loot")return endFightLootSection(st,c);
  return null;
}
```

  In `endFightClick()`, add `if(t.closest("#ecTrade")){endFightOpenLoot();return;}` before the `#ecDone` line.

- [ ] **Step 4: Run** `sheet.js`, then the full suite, and restore the build files. Expected: ALL PASSED, including
  every existing `#47` trade check. Run a throwaway Node check of `endFightLootWith` in the scratchpad (spec §9).
  Cover hostile names (`<b>` comes back as text, escaped only where it is drawn), blank names, and only "you".

- [ ] **Step 5: Commit.**

```bash
git add src/js/67-trade.js src/js/87-combat-end.js src/tests/sheet.js
git commit -m "feat(#105): Loot opens a trade with the fallen, and the End of combat window comes back after it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: After combat: live tiles, tickable pages, and the hidden-tab rule

**Files:**
- Modify: `src/js/87-trackers.js`:
  - `trackerRowHTML()` (:146) gains `opts`;
  - `trackersHTML()` (:173): `g.items.map(trackerRowHTML)` must become an arrow;
  - `renderTrackers()` (:204);
  - `trkPatchRow()` (:220).
- Modify: `src/js/87-journal.js`: the new `jnlTogglePage()`, and `jnlToggleCheckbox()` (:294) on top of it.
- Modify: `src/js/90-boot.js`, the `[data-ck]` branch (:69).
- Modify: `src/js/87-combat-end.js`:
  - the After combat helpers and section, `endFightTick()`, `endFightPaintTrackers()` and `endFightKey()`;
  - replace `endFightSection()`, `endFightClick()` and `endFightWire()`.
- Modify: `src/css/50-modal.css`.
- Test: `src/tests/sheet.js`. Add the async `t105After()`, chained.

**Interfaces:**
- Consumes:
  - Task 1's `afterCombat` flags;
  - `trkList(c)`, `showTrackers(c)` (`87-trackers.js:25`), `jnlPages(c)`, `jnlSort()`, `jnlTitle()`, `jnlStr()`;
  - `noteHTML(text)` (`87-notes.js:149`), `toggleCheckbox(text,n)` (:110) and `isTabHidden(name,c)`
    (`40-sheet.js:6`).
- Produces:
  - `trackerRowHTML(t, {noEdit?:boolean})`;
  - `trkPatchRow(t)` patches every `[data-trk=id]`, and `renderTrackers()` redraws `#trkList` and `#ecTrkList`;
  - `jnlTogglePage(id, n) -> boolean`;
  - `endFightAfterLists(c) -> {trackers, pages}`, `endFightAfterStatus(l) -> string`, `endFightTrackersHTML(c)`,
    `endFightAfterSection(st, c)`;
  - `endFightPaintTrackers(box)`, `endFightTick(id, n) -> boolean`, `endFightKey(e)`;
  - hooks `#ecTrkList`, `[data-ecpage="<id>"]`.

> **Note (spec §4.5):** the spec says "as their tiles (`trackerRowHTML()`)". The tile carries an edit pen
> (`trkEditHTML()`), and its `openTrackerForm()` would replace the window and lose the typed XP and the Undo
> (Review Focus 2). So the window draws `trackerRowHTML(t, {noEdit:true})`. For the same reason, a rules term or table
> link inside a page's `noteHTML()` does nothing in the window (Review Focus 1).

> **Note (spec §7):** the spec says `trackerRowHTML()`'s re-render patches every copy. `trackersHTML()` passes
> `trackerRowHTML` straight to `map()`, so a second parameter would receive the index. That call becomes
> `g.items.map(t=>trackerRowHTML(t))`.

- [ ] **Step 1: Write the failing tests:**

```js
/* ---------- #105 After combat: flagged trackers and pages, live */
async function t105After() {
  const keep = {om: ctx.openModal, ch: X.character, gid: ctx.document.getElementById, qsa: ctx.document.querySelectorAll, toast: ctx.toast};
  try {
    ctx.toast = () => null;
    const c = X.blankChar(); X.character = c;
    c.trackers = [{id: 't1', name: 'Goblins slain', type: 'counter', tag: 'Kills', value: 3, goal: 0, autoClose: true, afterCombat: true},
                  {id: 't2', name: 'Unflagged', type: 'counter', value: 1},
                  {id: 't3', name: 'Closed one', type: 'counter', value: 5, goal: 5, closed: true, afterCombat: true}];
    c.journal = [{id: 'p1', title: 'Loot list <i>', tag: '', text: '[ ] Search the bodies\n[x] Count the coins', at: 2, editedAt: 2, afterCombat: true},
                 {id: 'p2', title: 'Diary', tag: '', text: 'x', at: 1, editedAt: 1}];
    ctx.openEndOfCombat({rounds: 1, sec: 6, combatants: []});
    ck('#105 ending a fight bumps no tracker and ticks no box', c.trackers[0].value === 3 && c.journal[0].text === '[ ] Search the bodies\n[x] Count the coins');
    let h = ctx.endFightHTML(X._endFight, c);
    ck('#105 After combat: flagged open trackers and flagged pages only', /data-ecrow="after"/.test(h) && /id="ecSt-after">1 tracker · 1 page</.test(h) &&
       h.includes('data-trk="t1"') && !h.includes('data-trk="t2"') && !h.includes('data-trk="t3"') && h.includes('data-ecpage="p1"') && !h.includes('data-ecpage="p2"'), h);
    ck('#105 a tile without its edit pen, + and − live', /data-trkinc="t1"/.test(h) && /data-trkdec="t1"/.test(h) && !/data-trkedit="t1"/.test(h) && /id="ecTrkList"/.test(h));
    ck('#105 a page: its title, escaped, and its rendered, tickable text', h.includes('Loot list &lt;i&gt;') && !h.includes('Loot list <i>') &&
       /aria-checked="false" data-ck="0"/.test(h) && /aria-checked="true" data-ck="1"/.test(h));
    c.showTrackers = false; h = ctx.endFightHTML(X._endFight, c);
    ck('#105 trackers switched off: no tiles, the pages stay', !h.includes('data-trk="t1"') && /id="ecSt-after">1 page</.test(h));
    c.showTrackers = true; c.hiddenTabs = ['journal']; h = ctx.endFightHTML(X._endFight, c);
    ck('#105 a hidden Journal tab: no After combat row', !/data-ecrow="after"/.test(h));
    c.hiddenTabs = [];
    c.trackers.push({id: 't4', name: 'Arrows found', type: 'counter', value: 0, afterCombat: true});
    ck('#105 the status counts plurals', /id="ecSt-after">2 trackers · 1 page</.test(ctx.endFightHTML(X._endFight, c)));
    c.trackers.pop();
    // a tick in the window
    ck('#105 a tick in the window rewrites that page\'s line', ctx.endFightTick('p1', 0) === true && c.journal[0].text === '[x] Search the bodies\n[x] Count the coins' && c.journal[0].editedAt > 2);
    ctx.renderJournal(); ctx.jnlStartEdit('p1', 2, 'jnlText');
    ck('#105 ...not a page the Journal tab is editing', ctx.endFightTick('p1', 0) === false && c.journal[0].text.startsWith('[x] Search'));
    ctx.jnlReset();
    const src105 = n => require('fs').readFileSync(require('path').join(__dirname, '..', 'js', n), 'utf8');
    ck('#105 the checkbox dispatcher sends a tick in the window to its page',
       /ep=m\.closest\("\[data-ecpage\]"\);if\(ep\)endFightTick\(ep\.dataset\.ecpage,n\);else if\(m\.closest\("#jnlBody"\)\)jnlToggleCheckbox\(n\)/.test(src105('90-boot.js')));
    // + in the window: both copies redrawn
    const boxes = {trkList: {innerHTML: '', contains: () => false, querySelector: () => null}, ecTrkList: {innerHTML: '', contains: () => false, querySelector: () => null}};
    ctx.document.getElementById = id => boxes[id] || keep.gid(id);
    ctx.trkAct('t1', (x, now) => X.trkStep(x, 1, now), false);
    ck('#105 + changes the counter and redraws both copies of the tile', c.trackers[0].value === 4 &&
       /data-trkval="t1"[^>]*value="4"/.test(boxes.trkList.innerHTML) && /data-trkval="t1"[^>]*value="4"/.test(boxes.ecTrkList.innerHTML) && !/data-trkedit/.test(boxes.ecTrkList.innerHTML), boxes.ecTrkList.innerHTML);
    ctx.document.getElementById = keep.gid;
    // a typed count patches every copy
    const mkRow = () => { const v = {value: '3'}, fill = {style: {}}, bar = {attrs: {}, setAttribute(k, x) { this.attrs[k] = x; }, querySelector: () => fill};
      return {v, fill, querySelector: s => s === '[data-trkval]' ? v : s === '.trk-bar' ? bar : null, closest: () => null}; };
    const rows = [mkRow(), mkRow()];
    ctx.document.querySelectorAll = sel => sel === '[data-trk="t1"]' ? rows : keep.qsa(sel);
    c.trackers[0].value = 7; c.trackers[0].goal = 10;
    ck('#105 a typed count patches every copy of the tile', ctx.trkPatchRow(c.trackers[0]) === true && rows.every(r => r.v.value === '7' && r.fill.style.width === '70%'));
    ctx.document.querySelectorAll = keep.qsa;
    // chips are inert in the window (Review Focus 1)
    let stopped = 0, prevented = 0;
    const chipEv = key => ({key, target: {closest: s => s === '.ec-page .kw,.ec-page .tblref' ? {} : null}, stopPropagation() { stopped++; }, preventDefault() { prevented++; }});
    ctx.endFightClick(chipEv());
    ctx.endFightKey(chipEv('Enter'));
    ck('#105 chips are inert in the window: a tap or Enter on a rules term or table link stops there', stopped === 2 && prevented === 2);
    ctx.endFightKey(chipEv('Escape'));
    ck('#105 ...Escape still reaches the dialog', stopped === 2);
    ck('#105 the Journal tab\'s own tiles keep their pen', /data-trkedit="t1"/.test(X.trackersHTML(c, false)));
  } catch (err) {
    ck('#105 t105After ran without throwing', false, String(err && err.stack || err));
  } finally {
    ctx.openModal = keep.om; ctx.document.getElementById = keep.gid; ctx.document.querySelectorAll = keep.qsa; ctx.toast = keep.toast;
    ctx.jnlReset(); X.character = keep.ch; X._endFight = null;
  }
}
```

  Chain it after `t105Loot`.

- [ ] **Step 2: Run and watch it fail.** Expected: FAIL, with `endFightTick` undefined and no After combat row.

- [ ] **Step 3: Implement.**
  - `trackerRowHTML(t, opts)`. Change the signature, add `const o=opts||{};` as its first line, and make its last line
    use `${o.noEdit?"":trkEditHTML(t)}` in place of `${trkEditHTML(t)}`. Add to its comment: "`opts.noEdit` (#105):
    no pen, for the End of combat window, where the form would replace the window."
  - `trackersHTML()`: change `${g.items.map(trackerRowHTML).join("")}` to `${g.items.map(t=>trackerRowHTML(t)).join("")}`.
  - `trkPatchRow()`, replaced:

```js
function trkPatchRow(t){
  /* #105: every copy — the Journal tab's tile and the End of combat window's */
  const rows=[...document.querySelectorAll(attrSel("data-trk",t.id))];if(!rows.length)return false;
  const pr=trkProgress(t),g=trkInt(t.goal);
  rows.forEach(row=>{
    const v=row.querySelector("[data-trkval]");if(v)v.value=String(pr.done);
    const bar=row.querySelector(".trk-bar");
    if(bar){bar.setAttribute("aria-valuenow",String(Math.min(pr.done,g)));const f=bar.querySelector("span");if(f)f.style.width=pr.pct+"%";}
    const grp=row.closest&&row.closest(".fgroup"),tot=grp&&grp.querySelector(".trk-total");
    if(tot)tot.textContent="· "+trkGroupTotal(character,tagKey(t.tag));
  });
  return true;
}
```

  - `renderTrackers()`, replaced:

```js
function renderTrackers(){
  const el=document.getElementById("trkList");if(!el)return;
  if(trkWho!==character){trkWho=character;trkCompletedOpen=false;}
  const card=document.getElementById("trackersCard");if(card)card.style.display=showTrackers(character)?"":"none";
  /* #105: the End of combat window may hold the same tiles (#ecTrkList). Both
     are redrawn, and focus goes back inside whichever held it — the same hook
     exists in both, so the search must stay inside its own box. */
  const ec=document.getElementById("ecTrkList"),a=document.activeElement;
  const host=[el,ec].find(b=>b&&a&&b.contains&&b.contains(a))||null,sel=host?openerSelector(a):null;
  el.innerHTML=trackersHTML(character,trkCompletedOpen);
  if(ec)endFightPaintTrackers(ec);
  if(sel){const b=host.querySelector(sel);if(b&&b.focus)b.focus({preventScroll:true});}
  /* Shown or hidden, it may be the only card in an open combat view, whose
     "Add sections…" hint has to follow it. */
  if(combatViewOpen())renderCombatEmpty();
}
```

  - `87-journal.js`: replace `jnlToggleCheckbox()` (keep its comment) with:

```js
/* #105: the n-th checkbox of a page by id — the Journal tab's open page, or a
   page shown in the End of combat window. Refused while that page is in the
   editor: its text is the textarea's then, and the next keystroke
   (jnlInput()) would write the old text back over the tick. */
function jnlTogglePage(id,n){
  if(jnlUI.who===character&&jnlUI.editing&&jnlUI.open===id)return false;
  const p=jnlPages(character).find(x=>x.id===id);if(!p)return false;
  const cur=jnlStr(p.text),t=toggleCheckbox(cur,n);
  if(t===cur)return false;
  p.text=t;p.editedAt=Date.now();
  scheduleSave();renderJournal();
  return true;
}
function jnlToggleCheckbox(n){
  if(!jnlUI.open||jnlUI.editing)return false;
  if(!jnlTogglePage(jnlUI.open,n))return false;
  const b=document.querySelector(`#jnlBody [data-ck="${num(n)}"]`);if(b&&b.focus)b.focus({preventScroll:true});
  return true;
}
```

  - `90-boot.js` :69, the whole `[data-ck]` line, becomes:

```js
    if((m=t.closest("[data-ck]"))){const n=num(m.dataset.ck),rt=m.closest('[id^="rt-"]'),ep=m.closest("[data-ecpage]");if(ep)endFightTick(ep.dataset.ecpage,n);else if(m.closest("#jnlBody"))jnlToggleCheckbox(n);else if(rt)rtToggleCheckbox(rt.id.slice(3),n);else{const ne=m.closest("#notesList .item"),ed=ne&&ne.querySelector("[data-noteedit]");if(ed)noteToggleCheckbox(ed.dataset.noteedit,n);}return;}
```

    Update the comment above it: "…a Story field, a section note (#95), or a page in the End of combat window (#105)…".
  - `87-combat-end.js`: add after the Loot block:

```js
/* ---- After combat (spec §4.5): the open trackers and the pages flagged
   "Show after combat" — none while the Journal tab is hidden (#52), and no
   trackers while the sheet's trackers are switched off. Nothing changes on
   its own: the tiles' + and − and the pages' boxes are the player's. ---- */
function endFightAfterLists(c){
  if(isTabHidden("journal",c))return {trackers:[],pages:[]};
  return {trackers:showTrackers(c)?trkList(c).filter(t=>t.closed!==true&&t.afterCombat===true):[],
    pages:jnlSort(jnlPages(c).filter(p=>p.afterCombat===true))};
}
function endFightAfterStatus(l){
  const n=(k,w)=>k?`${k} ${w}${k===1?"":"s"}`:"";
  return [n(l.trackers.length,"tracker"),n(l.pages.length,"page")].filter(Boolean).join(" · ");
}
function endFightTrackersHTML(c){return endFightAfterLists(c).trackers.map(t=>trackerRowHTML(t,{noEdit:true})).join("");}
function endFightAfterSection(st,c){
  const l=endFightAfterLists(c);if(!l.trackers.length&&!l.pages.length)return null;
  return {status:endFightAfterStatus(l),
    body:(l.trackers.length?`<div class="trk-group ec-trk" id="ecTrkList">${endFightTrackersHTML(c)}</div>`:"")+
      l.pages.map(p=>{const b=noteHTML(jnlStr(p.text));
        return `<div class="ec-page" data-ecpage="${esc(p.id)}"><h4 class="ec-ph">${esc(jnlTitle(p))}</h4>${b?`<div class="n-body">${b}</div>`:""}</div>`;}).join("")};
}
/* renderTrackers() calls this for the window's copy of the tiles. */
function endFightPaintTrackers(box){
  box.innerHTML=endFightTrackersHTML(character);
  const s=document.getElementById("ecSt-after");if(s)s.textContent=endFightAfterStatus(endFightAfterLists(character));
}
/* A tick on a page shown here: that page's line, as on the Journal tab
   (jnlTogglePage(), which also redraws the tab), then this page's body, with
   focus back on the same box. */
function endFightTick(id,n){
  if(!endFightLive())return false;
  if(!jnlTogglePage(id,n))return false;
  const p=jnlPages(character).find(x=>x.id===id),box=document.querySelector(attrSel("data-ecpage",id)+" .n-body");
  if(box&&p){box.innerHTML=noteHTML(jnlStr(p.text));const b=box.querySelector(`[data-ck="${num(n)}"]`);if(b&&b.focus)b.focus({preventScroll:true});}
  return true;
}
/* A rules term or table link in a page here would open its own dialog over
   this one — the modal has one layer — and lose what the window holds. Here
   they are words: the tap or the key stops at the window. */
function endFightKey(e){
  if(!e||!(e.key==="Enter"||e.key===" "))return;
  const t=e.target;if(!t||!t.closest)return;
  if(t.closest(".ec-page .kw,.ec-page .tblref")){e.preventDefault();e.stopPropagation();}
}
```

  Replace `endFightSection()`, `endFightClick()` and `endFightWire()`:

```js
function endFightSection(k,st,c){
  if(k==="ammo")return endFightAmmoSection(st,c);
  if(k==="xp")return endFightXpSection(st,c);
  if(k==="loot")return endFightLootSection(st,c);
  if(k==="after")return endFightAfterSection(st,c);
  return null;
}
function endFightClick(e){
  if(!endFightLive()||!document.getElementById("ecDone"))return;
  const t=e&&e.target;if(!t||!t.closest)return;let m;
  if(t.closest(".ec-page .kw,.ec-page .tblref")){e.preventDefault();e.stopPropagation();return;}
  if((m=t.closest("[data-ecrow]"))){endFightToggle(m.dataset.ecrow);return;}
  if(t.closest("#ecUndoAmmo")){endFightUndoAmmo();return;}
  if(t.closest("#ecSplit")){endFightSetSplit(character.xpSplit!==true);return;}
  if(t.closest("#ecTrade")){endFightOpenLoot();return;}
  if(t.closest("#ecDone")){endFightDone();return;}
}
function endFightWire(){
  const body=document.getElementById("mBody");if(!body||body.dataset.ecWired)return;
  body.dataset.ecWired="1";
  body.addEventListener("click",endFightClick);
  body.addEventListener("input",e=>{if(endFightLive()&&e.target&&e.target.id==="ecXp")endFightSetXp(e.target.value);});
  body.addEventListener("keydown",e=>{if(endFightLive()&&document.getElementById("ecDone"))endFightKey(e);});
}
```

  The `.kw` check in `endFightClick()` comes **first**. The test's fake target answers only that selector, and in the
  page a chip sits inside no other hook. The `#mBody` listeners run before the document dispatcher, since the click
  bubbles from the target up to `document`, so `stopPropagation()` keeps `openGlossView()` and `openTableByName()`
  from running.
  - `50-modal.css`: append:

```css
.ec-trk{padding:4px 0 6px}
.ec-page{border:1px solid var(--hair);border-radius:8px;padding:6px 10px;margin-top:8px;background:var(--field)}
.ec-ph{margin:0 0 4px;font-family:var(--head);font-size:14px}
.ec-page .n-body{max-height:220px;overflow-y:auto;margin-top:0}
.ec-page .kw,.ec-page .tblref{cursor:text}
```

  `47-journal.css` needs no change: `.trk`/`.trk-group` aren't scoped to the Journal card. If a screenshot in Task 7
  shows a tile that needs one, add a tokens-only rule there and say so.

- [ ] **Step 4: Run** `sheet.js`, then the full suite, and restore the build files. Expected: ALL PASSED, including
  the existing tracker and journal checks (`#95`, `#93`).

- [ ] **Step 5: Commit.**

```bash
git add src/js/87-trackers.js src/js/87-journal.js src/js/90-boot.js src/js/87-combat-end.js src/css/50-modal.css src/tests/sheet.js
git commit -m "feat(#105): After combat: flagged trackers and pages in the End of combat window, live

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Browser QA, docs and release notes

**Files:**
- Wiki (spec §10). Each page is rewritten to the new truth, with a History line citing the ledger heading:
  - `src/docs/wiki/features/combat-view.md`: End combat (the warning, `endCombatNow()`) and the window (sections,
    `_endFight`, the reopen). Finish the **Code:** list with every new `endFight*()` name.
  - `src/docs/wiki/features/ammunition.md`: quiet recovery (`applyAmmoRecovery({quiet, logged})`), Undo in the window,
    and `undoRecoveryTap(…, {quiet})`. There is no End combat toast any more.
  - `src/docs/wiki/features/journal.md`: "Show after combat" on trackers and pages; tiles without the pen in the
    window; `jnlTogglePage()`; every copy patched.
  - `src/docs/wiki/features/inventory.md`: `openTrade({onClose})` and `tradeClosed()`.
  - `src/docs/wiki/ui/shell.md`: `askConfirm()` gains two users, End combat and the End of combat window's "Add N
    XP?". That guard is the first dismiss guard to answer through `askConfirm()`: it refuses the dismissal (`true`)
    and closes the window itself on the answer.
  - `src/docs/wiki/architecture/character-model.md`: `xpSplit`, `endCombatOpen`, and `trackers[i]`/`journal[i]`
    `.afterCombat`.
  - `src/docs/wiki/decisions.md`: the four §2 decisions, under Combat view.
  - `src/docs/wiki/roadmap/known-issues.md`:
    - a reload with the window open loses typed XP;
    - the trade's "With" box can exceed its 60-character typing limit with many fallen.
  - `src/docs/wiki/roadmap/1.9.0.md`: #105 built. Its two rows (:149–150) are updated to match §2: the window opens
    after the fight has ended, the summary is what the app knows, XP has the split, and the rows are folded.
  - `src/docs/wiki/overview.md`: the History line for the `87-combat-end.js` code-map row (JS fragment count 38→39).
- **Ledger:** append `## End of combat (#105, <the date you write it, YYYY-MM-DD>)` at the very end of
  `src/docs/_claude/WIRING-LEDGER.md`. It is append-only.
- **Release notes:** `src/docs/UNRELEASED.md`, under `## Pending`.
- **The spec:** append `## As built` to `src/docs/specs/2026-10-29-end-of-combat-design.md`.
- **Screenshots:** `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/in-progress/105-end-of-combat/`.

Only tune CSS here. A JS bug found here goes back to the controller as a finding.

- [ ] **Step 1: Before shots** from main's build,
  `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html` (the main checkout, not the worktree).
  Use the project's Playwright MCP. Seed with `browser_evaluate`:

```js
newCharacter("QA105","dnd");
character.classes=[{name:"Fighter",level:4}];character.level=4;character.xp="6,350";
character.inventory.push({id:"bow",name:"Longbow",qty:1,equipped:true,weapon:{kind:"ranged",ammo:"arrow",dice:"1d8"}},{id:"ar",name:"Arrow",qty:20,ammo:{kind:"arrow"}});
renderAll();scheduleSave();enterCombatTab();startCombatNow();
for(let i=0;i<9;i++)fireWeapon("bow",false);
character.combatRound=5;renderCombatChrome();
```

  Shoot the combat view in a fight (`105-before-combat-1280.png`). Press End combat: the browser's `confirm()` can't be
  shot, so answer it with `browser_handle_dialog`, then shoot the toast (`105-before-ended-1280.png`). Repeat both for
  a `"humblewood"` character at 390 (`105-before-*-390.png`).
- [ ] **Step 2: Build** with `./build.sh --no-zip` in the worktree and open
  `file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/105/dist/fieldbook.html`. Seed as above, then
  add:

```js
character.party=[{id:"a",name:"Brindle"},{id:"b",name:"Olvin"},{id:"c",name:"Pip"}];
character.trackers=[{id:"t1",name:"Goblins slain",type:"counter",tag:"Kills",value:3,goal:0,autoClose:true,afterCombat:true,at:Date.now()}];
character.journal=[{id:"p1",title:"Loot list",tag:"",text:"[ ] Search the bodies\n[ ] Count the coins",at:Date.now(),editedAt:Date.now(),afterCombat:true}];
character.combatants=[{id:"y",kind:"you",name:"QA105",init:15},{id:"g1",kind:"foe",name:"Goblin 1",init:14,band:4,ac:"",track:"",hp:"",maxHp:"",dead:false,partyId:""},
  {id:"b1",kind:"foe",name:"Bugbear",init:9,band:4,ac:"",track:"",hp:"",maxHp:"",dead:false,partyId:""},{id:"g2",kind:"foe",name:"Goblin 2",init:8,band:1,ac:"",track:"",hp:"",maxHp:"",dead:false,partyId:""}];
renderAll();renderCombatChrome();scheduleSave();
```

- [ ] **Step 3: Drive the whole fight end and shoot each step**, saving as `105-after-<what>-<1280|390>.png`.
  - **classic at 1280:**
    1. `warning`: press End combat (`#cvEnd`). The window reads "End combat?" with the recovery sentence.
    2. Press Keep fighting; the fight is still running.
    3. Press End combat, then End combat in the warning. Shoot `folded`: the summary chips with Goblin 1 and Bugbear
       struck through, and four folded rows.
    4. Open Ammunition (`ammo`) and press Undo recovery; it reads "Recovery undone".
    5. Open Experience (`xp`). Type 450 and turn on Split among 4 (`xp-split`: "450 ÷ 4 = 112 each").
    6. Open Loot (`loot`) and press Open trade. The trade's With reads "Goblin 1, Bugbear" (`trade`).
    7. Add 5 gp on You get and Complete Trade. The window is back with "Traded with Goblin 1, Bugbear", 450 still
       typed and the split still on (`back-after-trade`).
    8. Open After combat (`after`). Press + on Goblins slain (it reads 4), then go to the Journal tab later to see
       its tile at 4. Tick "Search the bodies".
    9. Turn the split off and type 200, so the ready line shows "Level 5 ready — …" (`xp-ready`). Press Done; the
       level-up opens (`levelup`).
    10. Afterwards, check the Journal tab: the tile reads 4 and the page's box is ticked (`journal`).
  - **humblewood at 390:** repeat shots 1, 3, 5, 7 and 8. Nothing may scroll sideways, and every row's status must
    ellipsize.
  - **Both skins, dark theme:** shoot `folded` once more.
  - **The guard:** end another fight, type 112 and press ×. The browser asks "Add 112 XP?"; answer with
    `browser_handle_dialog` both ways and check the XP.
  - **Edge cases:** shoot a milestone character's window (`milestone`, no Experience row), and a hidden Journal tab
    (Settings, #52; no After combat row).
  - **Console:** check `browser_console_messages` is clean.
  - **Report:** list what you drove and what you didn't. Touch, real devices and print stay Mike's.
- [ ] **Step 4: Docs.**
  - Ledger entry: what changed, task by task, and the rulings from this plan's Notes. Those are `ammoLogTitle`'s
    "recovered", `fmtCombatTime`'s "sec", the object-tied `_endFight`, `opts.logged`/`opts.quiet`, the pen-less tiles
    and inert chips, the guard answering through `askConfirm()` with Add XP behaving as Done, and Loot naming fallen foes only. Add the tests added and the
    two text checks changed (`rules-data.js` #104, `sheet.js` #104/#47 moved to `endCombatNow()`).
  - Wiki pages as listed above, each with
    `- <date> — <what changed>. → ledger L<line of the new heading>, #105`.
  - `UNRELEASED.md`, under `## Pending` (no angle brackets, no versions):

```
- End combat now asks in Fieldbook's own window, then opens an End of combat window that wraps the fight up:
  the rounds and time, who fell, the ammunition that came back (with Undo recovery), an XP box that can split
  the XP among your party and opens the level-up when it reaches a level, and Open trade for the loot. Each
  section folds away and remembers how you left it.
- Trackers and journal pages have a "Show after combat" switch. Switched on, an open tracker's tile and a page's
  text, checkboxes and all, appear in the End of combat window, so you can count the kills and tick off the loot
  list there.
```

  - The spec's `## As built`: where the code lives (`87-combat-end.js`, `endCombatNow()`, `tradeClosed()`,
    `jnlTogglePage()`), every Note above as a deviation with its reason. Fold in anything from the controller's progress notes (rulings, deferred Minors).
- [ ] **Step 5: Run the full suite**, then restore the build files. Expected: ALL PASSED. `docs.js` checks every
  `name()` a page cites, every fragment cited, and every `L<n>` a heading.
- [ ] **Step 6: Commit** as `docs(#105): the End of combat window — ledger, wiki, release notes, as built`. Commit
  any CSS tuning separately, first, as `style(#105): …`. Both end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never add `dist/fieldbook.html` or
  `docs/CHANGELOG.md`. Then say the branch is ready for review and merge, and stop: no release.
