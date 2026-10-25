# Trade Window and Inventory Log: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **⇄ Trade** window to the Equipment card: you give items and coins, you get items and coins, the window shows the balance, and Complete Trade commits it in one step. Add an **inventory log** of every item and coin change, opened from a **Log** button, where any line that can still be reversed cleanly can be undone (#47).

**Architecture:** One new fragment, `src/js/67-trade.js`, placed after `66-coins-hp.js`.
- Task 1 builds its core: the fields, `logInv` with trimming and grant batching, the coin maths, item snapshots, and the undo engine.
- Task 2 makes each existing writer call `logInv` exactly once per change.
- Task 3 adds the Log dialog and its button, plus the size setting.
- Task 4 adds the trade window: a draft object, pure HTML builders, the balance, and Complete as one step.
- Task 5 is QA and docs.

**Tech Stack:** Plain ES2020 concatenated into one script, with no modules. CSS on theme tokens. Node suites through `src/tests/harness.js`. The project's Playwright MCP.

**Spec:** `src/docs/specs/2026-10-25-trade-window-design.md`. Read it first.
**Mockups:** `.superpowers/brainstorm/47470-1792949937/content/trade-layout.html` (A wide, B narrow) and `trade-log.html` (the lines; the log is a dialog, not a card).

**Plan-level choice (tell Mike at handoff):** spec §5 makes a `use` line undoable only while the item still exists. The plan stores a copy of the item at Use time, so undoing the use of a last potion puts it back. **`use` is always clean.**

**Worktree:** `.claude/worktrees/47`, branch `issue/47-trade-window`. From the repo root, run `./scripts/wt.sh add 47 trade-window`. Run every command below from `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/47`.

## Global Constraints

- **Build**
  - One shipped file, built by concatenation: no modules, no network.
  - `src/js/67-trade.js` goes in `src/manifest.json` right after `"src/js/66-coins-hp.js"`.
  - The JS fragment count goes to **37** in `CLAUDE.md` (`js/*.js  36 fragments`) and in `src/docs/ADR-001-source-split.md` (`js/ (36 fragments)`).
  - Add a code-map row in `src/docs/wiki/overview.md`, and cite the fragment from `src/docs/wiki/features/inventory.md`.
- **TDZ:** `blankChar()` runs at load, so its new defaults are literals.
- **Bytes:** LF line endings, a final newline, no BOM.
- **Git**
  - Never `git add` `dist/fieldbook.html` or `docs/CHANGELOG.md`. Add explicit paths only.
  - Never touch `APP_VERSION`, `DATA_VERSIONS`, `CHANGELOG` or `data/`.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Data (spec §3)**
  - `invLog` (default `[]`) and `invLogSize` (one of 100, 250, 500, 1000, 2500; default 500).
  - `migrate()` preserves every field, then cleans these two.
- **Log rule:** every path writes **exactly one** line per change, through `logInv()` (or `logGrant()` for grants). No path writes twice. A trade writes one `trade` line and none of the `add` or `delete` lines its parts would otherwise write.
- **Coin values in copper:** cp 1, sp 10, ep 50, gp 100, pp 1000. Display is in gp, up to two decimal places, with trailing zeros dropped ("51 gp", "0.5 gp").
- **Markup:** every `${…}` inside a quoted attribute is `esc(…)`. Body text is `esc()`d. A modal title is plain text.
- **Touch targets** are at least 44 px. The trade window breaks at **700 px**: side by side above it, tabs at or below it, with the media query after its base rules.
- **The harness**
  - Read values through `loadApp([...])` names; add any that are missing.
  - `ctx.fn = …` installs a spy; `document` is a stub.
  - Run one suite: `node src/tests/<suite>.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.
  - Run everything: `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`, then `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.
- **Screenshots:** the project's Playwright MCP only, with absolute paths under `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/in-progress/47-trade-window/`.

## Review Focus

1. **Undo after later changes.**
   - Undoing an add after the item was partly used or sold must refuse, with a reason.
   - Undoing an edit after a second edit must refuse.
   - Undoing coins when the purse no longer holds them must refuse.

   → Task 1, `invUndoCheck`.
2. **A trade that gives away your whole stack of an item and receives a same-named item.** Complete and Undo must both leave the inventory exactly as it was. → Task 4, "trade round trip".
3. **One change, one line.** A finder add, a form save with nothing changed, a coin field commit, Use, a grant batch, End combat ammo: each writes exactly one line (zero for the unchanged save). → Task 2.
4. **Hostile names** in "With", custom items and item names are escaped in the trade window, the log and receipts. → Task 3 and Task 4 markup tests.
5. **The log at its size limit.** Lowering the size trims at the next write. An old save with no log loads with `[]` and 500. → Task 1.

---

### Task 1: Fields, the log core, coin maths and the undo engine

**Files:**
- Create: `src/js/67-trade.js`
- Modify:
  - `src/manifest.json`
  - `src/js/00-constants.js` (`blankChar()`)
  - `src/js/71-char-io.js` (`migrate()`, before `migrateSheet103(base);`)
  - `CLAUDE.md`
  - `src/docs/ADR-001-source-split.md`
  - `src/docs/wiki/overview.md`
  - `src/docs/wiki/features/inventory.md` (its **Code:** line cites `67-trade.js`)
- Test: `src/tests/sheet.js`

**Interfaces (produces):**
- `INV_LOG_SIZES` = `[100,250,500,1000,2500]`
- `COIN_CP` = `{cp:1,sp:10,ep:50,gp:100,pp:1000}`
- `coinsToCp(coins)` → integer copper
- `cpToGpText(cp)` → `"51 gp"`
- `itemWorthCp(it, qty)` → integer
- `invSame(a, b)` → boolean, a key-order-independent deep compare
- `invSnap(it)` → a deep copy
- `cleanInvLog(v, size)` → array
- `logInv(entry)` → the stored entry
- `logGrant(sid, line)` → the entry, merged into the newest `grant` entry when it has the same sid and was written within 5 s
- `invUndoCheck(entry)` → `{ok, why}`
- `invUndo(id)` → `""` on success, or the reason it couldn't
- `invRemoveQty(id, qty)` → `{removed:boolean, snap, atk}`
- `invRestore(snap, atk)` → the id it now has

- [ ] **Step 1: Write the failing tests.** Append to `src/tests/sheet.js`, before `ck.done()`, and add the names above to `loadApp`.

```js
// ---------- #47 the inventory log: fields, maths, undo
{
  const b = X.blankChar();
  ck('#47 a new character: empty log, size 500', JSON.stringify(b.invLog) === '[]' && b.invLogSize === 500);
  const m = X.migrate({abilities: {}, invLogSize: 7, invLog: [{kind: 'add', at: 5, title: 'A'}, {kind: 'bogus', at: 6}, 'x', {kind: 'coins', title: 'no at'}]});
  ck('#47 migrate: a bad size falls back to 500; unknown kinds, junk and entries with no time are dropped',
     m.invLogSize === 500 && m.invLog.length === 1 && m.invLog[0].kind === 'add' && Array.isArray(m.invLog[0].lines) && m.invLog[0].undone === false, m);
  ck('#47 an old save gets an empty log', JSON.stringify(X.migrate({abilities: {}}).invLog) === '[]');

  ck('#47 coins to copper: every denomination', X.coinsToCp({pp: 1, gp: 2, ep: 1, sp: 3, cp: 4}) === 1000 + 200 + 50 + 30 + 4);
  ck('#47 copper as gp text: whole, fractional, zero', X.cpToGpText(5100) === '51 gp' && X.cpToGpText(50) === '0.5 gp' && X.cpToGpText(1234) === '12.34 gp' && X.cpToGpText(0) === '0 gp');
  ck('#47 an item\'s worth is cost × quantity, no cost is 0', X.itemWorthCp({cost: 2}, 3) === 600 && X.itemWorthCp({}, 5) === 0 && X.itemWorthCp({cost: 0.5}, 1) === 50);
  ck('#47 invSame ignores key order', X.invSame({a: 1, b: {c: 2, d: 3}}, {b: {d: 3, c: 2}, a: 1}) && !X.invSame({a: 1}, {a: 2}));

  const keep = {ch: X.character, now: ctx.Date.now};
  try {
    X.character = X.blankChar(); X.character.invLogSize = 100;
    for (let i = 0; i < 105; i++) X.logInv({kind: 'coins', title: 'c' + i, lines: [], undo: null});
    ck('#47 logInv puts the newest first and trims to the size', X.character.invLog.length === 100 && X.character.invLog[0].title === 'c104' && X.character.invLog[99].title === 'c5');
    ck('#47 ...and stamps id, time and undone', typeof X.character.invLog[0].id === 'string' && X.character.invLog[0].at > 0 && X.character.invLog[0].undone === false);

    /* grant batching */
    X.character.invLog = []; let t = 1000; ctx.Date.now = () => t;
    X.logGrant('class:Fighter', {dir: '+', text: 'Chain Mail'}); t += 1000; X.logGrant('class:Fighter', {dir: '+', text: '10 gp'});
    t += 1000; X.logGrant('bg:Acolyte', {dir: '+', text: 'Holy symbol'});
    ck('#47 grants batch per source within 5 s; a new source starts a new line',
       X.character.invLog.length === 2 && X.character.invLog[1].title === 'Granted by Fighter' && X.character.invLog[1].lines.length === 2 && X.character.invLog[0].title === 'Granted by Acolyte' && X.character.invLog[1].undo === null,
       X.character.invLog.map(e => e.title));
    t += 9000; X.logGrant('bg:Acolyte', {dir: '+', text: 'Prayer book'});
    ck('#47 ...and the same source later starts a new line', X.character.invLog.length === 3);
  } finally { X.character = keep.ch; ctx.Date.now = keep.now; }
}

// ---------- #47 undo, kind by kind (Review Focus 1)
{
  const keep = {ch: X.character, rs: ctx.scheduleSave, ri: ctx.renderInventory, ra: ctx.renderAttacks, rc: ctx.renderCoins, rq: ctx.recompute};
  ctx.scheduleSave = () => {}; ctx.renderInventory = () => {}; ctx.renderAttacks = () => {}; ctx.renderCoins = () => {}; ctx.recompute = () => {};
  const fresh = () => { X.character = X.blankChar(); X.character.inventory = []; X.character.attacks = []; X.character.coins = {gp: 10, sp: 0, cp: 0}; };
  const top = () => X.character.invLog[0];
  try {
    /* add: created, then partly used → blocked */
    fresh(); X.character.inventory.push({id: 'p', name: 'Potion', qty: 3});
    X.logInv({kind: 'add', title: 'Added Potion', lines: [{dir: '+', text: 'Potion ×3'}], undo: {items: [{id: 'p', qty: 3, created: true}]}});
    const addE = top();
    X.character.inventory[0].qty = 2;
    ck('#47 undo add refuses once the item was partly used', X.invUndoCheck(addE).ok === false && X.invUndoCheck(addE).why === 'It has since been used, sold or removed.', X.invUndoCheck(addE));
    X.character.inventory[0].qty = 3;
    ck('#47 undo add removes a created item entirely', X.invUndo(addE.id) === '' && X.character.inventory.length === 0 && addE.undone === true && top().title === 'Undid: Added Potion');
    ck('#47 an undone line cannot be undone again', X.invUndoCheck(addE).ok === false);

    /* add onto an existing stack: removes only the added quantity */
    fresh(); X.character.inventory.push({id: 'a', name: 'Arrow', qty: 25});
    X.logInv({kind: 'add', title: 'Added Arrow', lines: [], undo: {items: [{id: 'a', qty: 20, created: false}]}});
    X.invUndo(top().id);
    ck('#47 undo add onto a stack takes back only what was added', X.character.inventory[0].qty === 5);

    /* edit */
    fresh(); const before = {id: 'b', name: 'Backpack', qty: 1}, after = {id: 'b', name: 'Backpack', qty: 2};
    X.character.inventory.push(JSON.parse(JSON.stringify(after)));
    X.logInv({kind: 'edit', title: 'Edited Backpack', lines: [], undo: {before, after}});
    const ed = top(); X.character.inventory[0].qty = 4;
    ck('#47 undo edit refuses after a second edit', X.invUndoCheck(ed).why === 'It has been changed again since.');
    X.character.inventory[0].qty = 2;
    ck('#47 undo edit puts the item back as it was', X.invUndo(ed.id) === '' && X.character.inventory[0].qty === 1);

    /* delete, with its linked attack */
    fresh();
    X.logInv({kind: 'delete', title: 'Deleted Dagger', lines: [], undo: {snap: {id: 'd', name: 'Dagger', qty: 1, weapon: {dice: '1d4'}}, at: 0, atk: {id: 'k', name: 'Dagger', itemId: 'd'}}});
    ck('#47 undo delete always works and brings its attack back', X.invUndo(top().id) === '' && X.character.inventory[0].name === 'Dagger' && X.character.attacks.some(a => a.itemId === X.character.inventory[0].id));

    /* use (plan-level choice: always clean, even for the last one) */
    fresh();
    X.logInv({kind: 'use', title: 'Used Healing Potion', lines: [], undo: {id: 'h', qty: 1, used: 0, snap: {id: 'h', name: 'Healing Potion', qty: 1}}});
    ck('#47 undo use of the last one puts it back', X.invUndo(top().id) === '' && X.character.inventory.length === 1 && X.character.inventory[0].qty === 1);
    fresh(); X.character.inventory.push({id: 'w', name: 'Wand', qty: 1, uses: {max: 3, used: 2}});
    X.logInv({kind: 'use', title: 'Used Wand', lines: [], undo: {id: 'w', qty: 0, used: 1, snap: null}});
    X.invUndo(top().id);
    ck('#47 undo use gives a use back', X.character.inventory[0].uses.used === 1);

    /* coins */
    fresh();
    X.logInv({kind: 'coins', title: 'Coins adjusted', lines: [], undo: {delta: {gp: 15}}});
    const co = top(); X.character.coins.gp = 10;
    ck('#47 undo coins refuses when the gold has been spent', X.invUndoCheck(co).ok === false && /Not enough GP left to take back\./.test(X.invUndoCheck(co).why), X.invUndoCheck(co));
    X.character.coins.gp = 30;
    ck('#47 undo coins applies the opposite change', X.invUndo(co.id) === '' && X.character.coins.gp === 15);

    /* grant and ammo: never */
    X.logInv({kind: 'grant', title: 'Granted by Fighter', lines: [], undo: null});
    ck('#47 grants have no undo', X.invUndoCheck(top()).ok === false && X.invUndoCheck(top()).why === '');
    ck('#47 an unknown id is refused', X.invUndo('nope') !== '');
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.rs; ctx.renderInventory = keep.ri; ctx.renderAttacks = keep.ra; ctx.renderCoins = keep.rc; ctx.recompute = keep.rq; }
}
```

- [ ] **Step 2: Run the tests and confirm they fail.** Expect `LOAD FAIL`.

- [ ] **Step 3: Implement.**
  - In `blankChar()`, add `invLog:[], invLogSize:500,` beside `party:[]`.
  - In `migrate()`, directly before `migrateSheet103(base);`, add:

```js
  /* #47: the inventory log */
  base.invLogSize=INV_LOG_SIZES.indexOf(num(s.invLogSize))>=0?num(s.invLogSize):500;
  base.invLog=cleanInvLog(s.invLog,base.invLogSize);
```

  Create `src/js/67-trade.js`:

```js
/* ================= trade window and inventory log (#47) =================
   Every item and coin change writes ONE line through logInv() (grants through
   logGrant(), which batches a source's grants into one line). Each line keeps
   what reversing it needs, so any line that can still be reversed cleanly
   can be undone. Spec: src/docs/specs/2026-10-25-trade-window-design.md. */
const INV_LOG_SIZES=[100,250,500,1000,2500];
const INV_KINDS=["trade","add","edit","delete","use","coins","grant","ammo"];
const COIN_CP={cp:1,sp:10,ep:50,gp:100,pp:1000};
function coinsToCp(coins){let t=0;Object.keys(COIN_CP).forEach(k=>{t+=Math.round(num((coins||{})[k]))*COIN_CP[k];});return t;}
function cpToGpText(cp){const v=Math.round(num(cp))/100;return `${String(Math.round(v*100)/100)} gp`;}
function itemWorthCp(it,qty){return Math.round(num(it&&it.cost)*100)*Math.max(0,num(qty));}
function invSnap(it){return it==null?null:JSON.parse(JSON.stringify(it));}
function invSame(a,b){
  const norm=v=>Array.isArray(v)?v.map(norm):(v&&typeof v==="object")?Object.keys(v).sort().reduce((o,k)=>{o[k]=norm(v[k]);return o;},{}):v;
  return JSON.stringify(norm(a))===JSON.stringify(norm(b));
}
function cleanInvLog(v,size){
  const n=INV_LOG_SIZES.indexOf(num(size))>=0?num(size):500;
  return (Array.isArray(v)?v:[]).filter(e=>e&&typeof e==="object"&&INV_KINDS.indexOf(e.kind)>=0&&num(e.at)>0)
    .map(e=>({id:String(e.id||uid()),at:num(e.at),kind:e.kind,title:String(e.title||""),
      lines:(Array.isArray(e.lines)?e.lines:[]).filter(l=>l&&typeof l==="object").map(l=>({dir:l.dir==="+"||l.dir==="-"?l.dir:"",text:String(l.text||"")})),
      undo:(e.undo&&typeof e.undo==="object")?e.undo:null,undone:e.undone===true,meta:(e.meta&&typeof e.meta==="object")?e.meta:{}}))
    .slice(0,n);
}
function logInv(entry){
  if(!Array.isArray(character.invLog))character.invLog=[];
  const e={id:uid(),at:Date.now(),kind:entry.kind,title:String(entry.title||""),lines:entry.lines||[],undo:entry.undo||null,undone:false,meta:entry.meta||{}};
  character.invLog.unshift(e);
  const n=INV_LOG_SIZES.indexOf(num(character.invLogSize))>=0?num(character.invLogSize):500;
  if(character.invLog.length>n)character.invLog.length=n;
  return e;
}
function grantSourceName(sid){const s=String(sid||"");return s.slice(s.indexOf(":")+1)||s;}
/* One line per source: a class's starting gear arrives as several calls in a row. */
function logGrant(sid,line){
  const top=(character.invLog||[])[0];
  if(top&&top.kind==="grant"&&top.meta&&top.meta.sid===sid&&Date.now()-num(top.at)<5000){top.lines.push(line);return top;}
  return logInv({kind:"grant",title:"Granted by "+grantSourceName(sid),lines:[line],undo:null,meta:{sid}});
}
/* ---- item helpers for undo (and the trade) ---- */
function invRemoveQty(id,qty){
  const it=(character.inventory||[]).find(x=>x.id===id);if(!it)return {removed:false,snap:null,atk:null};
  const left=itemQty(it)-num(qty);
  if(left<=0){
    const snap=invSnap(it),atk=invSnap((character.attacks||[]).find(a=>a.itemId===id)||null);
    character.inventory=character.inventory.filter(x=>x.id!==id);
    character.attacks=(character.attacks||[]).filter(a=>a.itemId!==id);
    forgetAmmo(character,id);
    return {removed:true,snap,atk};
  }
  it.qty=left;return {removed:false,snap:null,atk:null};
}
function invRestore(snap,atk){
  const it=invSnap(snap);if((character.inventory||[]).some(x=>x.id===it.id))it.id=uid();
  character.inventory.push(it);
  if(atk){const a=invSnap(atk);a.itemId=it.id;if((character.attacks||[]).some(x=>x.id===a.id))a.id=uid();character.attacks.push(a);it.attackId=a.id;}
  return it.id;
}
/* ---- undo ---- */
const INV_WHY={add:"It has since been used, sold or removed.",edit:"It has been changed again since.",gone:"It is no longer in your inventory."};
function invCheckPart(kind,u){
  if(kind==="add"){for(const p of (u.items||[])){const it=(character.inventory||[]).find(x=>x.id===p.id);if(!it||itemQty(it)<num(p.qty))return INV_WHY.add;}return "";}
  if(kind==="edit"){const it=(character.inventory||[]).find(x=>x.id===u.after.id);return (it&&invSame(it,u.after))?"":INV_WHY.edit;}
  if(kind==="coins"){
    for(const k of Object.keys(u.delta||{})){const d=num(u.delta[k]);if(d>0&&num((character.coins||{})[k])<d){const c=COIN_ALL.find(x=>x[0]===k);return `Not enough ${c?c[1]:k.toUpperCase()} left to take back.`;}}
    return "";
  }
  return "";   /* delete and use are always clean */
}
function invUndoCheck(e){
  if(!e||e.undone)return {ok:false,why:e&&e.undone?"Already undone.":""};
  if(!e.undo||e.kind==="grant"||e.kind==="ammo")return {ok:false,why:""};
  if(e.kind==="trade"){for(const p of (e.undo.parts||[])){const w=invCheckPart(p.kind,p.u);if(w)return {ok:false,why:w};}return {ok:true,why:""};}
  const w=invCheckPart(e.kind,e.undo);return {ok:!w,why:w};
}
function invApplyPart(kind,u){
  if(kind==="add")(u.items||[]).forEach(p=>{const it=character.inventory.find(x=>x.id===p.id);if(!it)return;if(p.created&&itemQty(it)<=num(p.qty))invRemoveQty(p.id,itemQty(it));else invRemoveQty(p.id,p.qty);});
  else if(kind==="edit"){const i=character.inventory.findIndex(x=>x.id===u.after.id);if(i>=0){character.inventory[i]=invSnap(u.before);syncItemAttack(character.inventory[i]);}}
  else if(kind==="delete")invRestore(u.snap,u.atk);
  else if(kind==="use"){
    const it=(character.inventory||[]).find(x=>x.id===u.id);
    if(it){if(num(u.qty))it.qty=itemQty(it)+num(u.qty);if(num(u.used)&&it.uses)it.uses.used=Math.max(0,num(it.uses.used)-num(u.used));}
    else if(u.snap)invRestore(u.snap,u.atk||null);
  }
  else if(kind==="coins"){character.coins=character.coins||{};Object.keys(u.delta||{}).forEach(k=>{character.coins[k]=num(character.coins[k])-num(u.delta[k]);});}
  else if(kind==="give")(u.items||[]).forEach(p=>{const it=character.inventory.find(x=>x.id===p.id);if(it)it.qty=itemQty(it)+num(p.qty);else if(p.snap)invRestore(p.snap,p.atk);});
}
function invUndo(id){
  const e=(character.invLog||[]).find(x=>x.id===id);if(!e)return "That line is no longer in the log.";
  const c=invUndoCheck(e);if(!c.ok)return c.why||"This line can't be undone.";
  if(e.kind==="trade")(e.undo.parts||[]).forEach(p=>invApplyPart(p.kind,p.u));else invApplyPart(e.kind,e.undo);
  e.undone=true;
  logInv({kind:e.kind,title:"Undid: "+e.title,lines:[],undo:null});
  renderInventory();renderAttacks();renderCoins();recompute();scheduleSave();
  return "";
}
```

  The trade's `undo` is `{parts:[{kind:"give",u:{items:[{id,qty,snap,atk}]}},{kind:"add",u:{items:[…]}},{kind:"coins",u:{delta}}]}`. A `give` part puts back what you gave: `invCheckPart` treats it as always clean, and `invApplyPart` above re-adds it. Task 4 builds these parts.

  Then:
  - add the manifest entry;
  - set the counts to 37;
  - add the overview row: `` | `67-trade.js` | the trade window and the inventory log: one line per change, undo | [Inventory](features/inventory.md) | ``;
  - add `` `logInv()`, `invUndo()` in `67-trade.js` `` to inventory.md's **Code:** line.

- [ ] **Step 4: Run** sheet.js, then `./build.sh --no-zip && node src/tests/docs.js`. Both must pass.
- [ ] **Step 5: Run the full suite, then commit** as `feat(#47): the inventory log core and its undo engine`, with explicit paths and the trailer.

---

### Task 2: Every writer logs once

**Files:**
- Modify:
  - `src/js/85-browse.js`: `addLibraryItems` returns what it did; `browseItems`'s `onAdd` logs.
  - `src/js/80-modal-forms.js`: the item form's save, and `applyItemUse`.
  - `src/js/90-boot.js`: the row delete.
  - `src/js/66-coins-hp.js`: Adjust, `applyCoinInput`, `convertCoins`.
  - `src/js/50-classrace.js`: `grantItemByName`, and the gold grant at line ~95.
  - `src/js/87-combat.js`: `endCombatAsk`.
  - `src/js/62-ammo.js`: a helper `ammoFightSummary(c)`.
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes Task 1.
- Produces:
  - `addLibraryItems(...)` → `[{id, qty, created}]`
  - `ammoFightSummary(c)` → `[{kind, fired, back}]` for every kind fired, including ones that came back 0

- [ ] **Step 1: Write the failing tests** (Review Focus 3). Add `addLibraryItems`, `applyItemUse`, `applyCoinInput`, `convertCoins`, `grantItemByName` and `ammoFightSummary` to `loadApp` if they are absent.

```js
// ---------- #47 one change, one line
{
  const keep = {ch: X.character, rules: X.rules, rs: ctx.scheduleSave, ri: ctx.renderInventory, ra: ctx.renderAttacks, rc: ctx.renderCoins, rq: ctx.recompute, rsum: ctx.restSummary, rst: ctx.renderStatuses};
  ['scheduleSave', 'renderInventory', 'renderAttacks', 'renderCoins', 'recompute', 'restSummary', 'renderStatuses'].forEach(n => ctx[n] = () => {});
  try {
    X.character = X.blankChar(); X.character.inventory = []; X.character.attacks = [];
    X.rules = Object.assign({}, X.rules, {items: [{name: 'Rope', cost: '1 gp'}, {name: 'Healing Potion', cost: '50 gp'}]});
    const did = X.addLibraryItems([{name: 'Rope', cost: '1 gp'}], null, null, 2);
    ck('#47 addLibraryItems says what it did', did.length === 1 && did[0].qty === 2 && did[0].created === true, did);
    const did2 = X.addLibraryItems([{name: 'Rope', cost: '1 gp'}], null, null, 1);
    ck('#47 ...stacking reports created:false', did2[0].created === false && did2[0].id === did[0].id);
    ck('#47 addLibraryItems itself writes no line (its caller does)', X.character.invLog.length === 0);

    const src = n => require('fs').readFileSync(require('path').join(__dirname, '..', 'js', n), 'utf8');
    ck('#47 the finder\'s onAdd logs one add line', /onAdd:\(entries,og,costOverride,qty\)=>\{const did=addLibraryItems\([^)]*\);logFinderAdd\(did/.test(src('85-browse.js')));
    ck('#47 the item form logs add or edit, and nothing for an unchanged save', /logItemSave\(/.test(src('80-modal-forms.js')));
    ck('#47 the row delete logs one delete line', /data-del-item[\s\S]{0,1400}logInv\(\{kind:"delete"/.test(src('90-boot.js')));

    /* Use */
    X.character.inventory = [{id: 'h', name: 'Healing Potion', qty: 1, use: {consume: true}}];
    X.applyItemUse(X.character.inventory[0], {consume: true}, 0, '');
    ck('#47 Use writes one line, keeping a copy of the last one', X.character.invLog.length === 1 && X.character.invLog[0].kind === 'use' && X.character.invLog[0].undo.snap.name === 'Healing Potion');

    /* coins */
    X.character.invLog = []; X.character.coins = {gp: 5};
    const inp = {dataset: {coin: 'gp'}, value: '+10'}; X.applyCoinInput(inp);
    ck('#47 a coin field commit writes one coins line with the change', X.character.invLog.length === 1 && X.character.invLog[0].undo.delta.gp === 10);
    inp.value = '15'; X.applyCoinInput(inp);
    ck('#47 ...an unchanged commit writes nothing', X.character.invLog.length === 1);
    X.character.coins = {gp: 0, sp: 25, cp: 0}; X.character.system = 'humblewood'; X.convertCoins();
    ck('#47 Convert writes one re-denomination line', X.character.invLog[0].kind === 'coins' && /Converted/.test(X.character.invLog[0].title) && X.character.invLog[0].undo.delta.gp === 2 && X.character.invLog[0].undo.delta.sp === -20);

    /* grants: one line per source */
    X.character.invLog = [];
    X.grantItemByName('Rope', 1, 'class:Fighter'); X.grantItemByName('Healing Potion', 1, 'class:Fighter');
    ck('#47 a source\'s grants share one line', X.character.invLog.length === 1 && X.character.invLog[0].lines.length === 2 && X.character.invLog[0].title === 'Granted by Fighter');

    /* ammo per fight */
    X.character.ammoSpent = {s1: {n: 12, kind: 'arrow', snap: {id: 's1', name: 'Arrow'}}};
    const sum = X.ammoFightSummary(X.character);
    ck('#47 ammoFightSummary totals what was fired per kind', sum.length === 1 && sum[0].kind === 'arrow' && sum[0].fired === 12, sum);
    ck('#47 End combat logs one ammo line per kind fired', /ammoFightSummary\(character\)[\s\S]{0,400}logInv\(\{kind:"ammo"/.test(src('87-combat.js')));
  } finally { Object.assign(ctx, {scheduleSave: keep.rs, renderInventory: keep.ri, renderAttacks: keep.ra, renderCoins: keep.rc, recompute: keep.rq, restSummary: keep.rsum, renderStatuses: keep.rst}); X.character = keep.ch; X.rules = keep.rules; }
}
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**

  **`85-browse.js`.** `addLibraryItems` collects `const out=[]`. In the stacking branch, before returning, it does `out.push({id:ex.id,qty:add,created:false})`. After `push(it)`, it does `out.push({id:it.id,qty:add,created:true})`. At the end it returns `out`. `browseItems`'s `onAdd` becomes:

```js
    onAdd:(entries,og,costOverride,qty)=>{const did=addLibraryItems(entries,og,costOverride,qty);logFinderAdd(did);renderInventory();renderAttacks();recompute();scheduleSave();}
```

  Add these to `67-trade.js`:

```js
function invName(id){const it=(character.inventory||[]).find(x=>x.id===id);return it?String(it.name||"Item"):"Item";}
function logFinderAdd(did){
  if(!did||!did.length)return;
  const lines=did.map(d=>({dir:"+",text:`${invName(d.id)} ×${d.qty}`}));
  logInv({kind:"add",title:did.length===1?"Added "+invName(did[0].id):`Added ${did.length} items`,lines,undo:{items:did}});
}
/* The item form: a new item is an add; an edit is logged only if something changed. */
function logItemSave(before,after){
  if(!before){logInv({kind:"add",title:"Added "+(after.name||"Item"),lines:[{dir:"+",text:`${after.name||"Item"} ×${itemQty(after)}`}],undo:{items:[{id:after.id,qty:itemQty(after),created:true}]}});return;}
  if(invSame(before,after))return;
  const lines=[];
  if(itemQty(before)!==itemQty(after))lines.push({dir:"",text:`Quantity ${itemQty(before)} → ${itemQty(after)}`});
  if(before.name!==after.name)lines.push({dir:"",text:`Name ${before.name} → ${after.name}`});
  if(!lines.length)lines.push({dir:"",text:"Details changed"});
  logInv({kind:"edit",title:"Edited "+(after.name||"Item"),lines,undo:{before:invSnap(before),after:invSnap(after)}});
}
```

  **`80-modal-forms.js`, item form save.** Just before the line `const i=character.inventory.findIndex(x=>x.id===it.id);…`, capture `const was=invSnap(character.inventory.find(x=>x.id===it.id)||null);`. After `syncItemAttack(rec);`, call `logItemSave(was,invSnap(character.inventory.find(x=>x.id===rec.id)));`.

  **`applyItemUse`.** At the start of the function, capture `const snap0=invSnap(it),atk0=invSnap((character.attacks||[]).find(a=>a.itemId===it.id)||null);`. Before `renderInventory()…`, log:

```js
  logInv({kind:"use",title:"Used "+(it.name||"item"),lines:[{dir:"-",text:u.consume?"−1":"1 use"}],
    undo:{id:it.id,qty:u.consume?1:0,used:mx>0?1:0,snap:u.consume&&itemQty(snap0)<=1?snap0:null,atk:u.consume&&itemQty(snap0)<=1?atk0:null}});
```

  **`90-boot.js`, row delete.** Inside the `confirm(...)` branch, before the inventory filter, add `const atk0=invSnap(character.attacks.find(a=>a.itemId===it.id)||null),at0=character.inventory.indexOf(it);`. After the filters, add `logInv({kind:"delete",title:"Deleted "+(it.name||"item"),lines:[{dir:"-",text:`${it.name||"item"} ×${itemQty(it)}`}],undo:{snap:invSnap(it),at:at0,atk:atk0}});`.

  **`66-coins-hp.js`.** Add a helper to `67-trade.js`:

```js
function logCoins(title,delta){
  const d={};Object.keys(delta||{}).forEach(k=>{const v=Math.round(num(delta[k]));if(v)d[k]=v;});
  if(!Object.keys(d).length)return null;
  const lines=Object.keys(d).map(k=>{const c=COIN_ALL.find(x=>x[0]===k);return {dir:d[k]>0?"+":"-",text:`${d[k]>0?"+":"−"}${Math.abs(d[k])} ${c?c[1]:k}`};});
  return logInv({kind:"coins",title,lines,undo:{delta:d}});
}
```

  - **Adjust.** In the Apply click handler, after the coins are written, call `logCoins("Coins adjusted",Object.fromEntries(Object.keys(out).map(k=>[k,out[k].delta])));`.
  - **`applyCoinInput`.** Capture `const was=num(character.coins[k]);` before the write. After it, call `logCoins("Coins changed",{[k]:num(next)-was});`.
  - **`convertCoins`.** Capture `const was=Object.assign({},character.coins);` first. After `character.coins=res;`, call `logCoins("Converted coins",Object.fromEntries(["pp","gp","ep","sp","cp"].map(k=>[k,num(res[k])-num(was[k])])));`.

  **`50-classrace.js`.**
  - At the end of `grantItemByName`, when an item was added or stacked, call `logGrant(sid,{dir:"+",text:`${name} ×${qty}`});`. Read the function first: log only when it actually added something.
  - In the gold grant (around line 95, after `character.coins[k]+=amt`), call `logGrant(sid,{dir:"+",text:`${amt} ${goldKey().toUpperCase()}`});`.

  **`62-ammo.js`.** Add:

```js
/* Every kind fired this fight, with what its rules give back, including 0 (#47's log line). */
function ammoFightSummary(c){
  const by=new Map();
  Object.keys(ammoSpentMap(c)).forEach(id=>{
    const e=ammoSpentEntry(c,id);if(!e.n||!e.kind)return;
    const r=by.get(e.kind)||{kind:e.kind,fired:0,back:0};
    r.fired+=e.n;r.back+=ammoBack(ammoRecoverRule(c,ammoEntryItem(c,id,e)),e);by.set(e.kind,r);
  });
  return [...by.values()];
}
```

  **`87-combat.js` `endCombatAsk`.** Before `const got=applyAmmoRecovery()…`, add:

```js
  ammoFightSummary(character).forEach(r=>{const nm=ammoPlural(r.kind);
    logInv({kind:"ammo",title:`${nm.charAt(0).toUpperCase()+nm.slice(1)}: ${r.fired} fired, ${r.back} recovered`,lines:[],undo:null,meta:{rounds:s.rounds}});});
```

- [ ] **Step 4: Run** sheet.js and the full suite. Existing tests that count the inventory or coins may need the log ignored; never loosen them.
- [ ] **Step 5: Commit** as `feat(#47): every item and coin change writes one log line`, with the trailer.

---

### Task 3: The Log dialog, its button, and the size setting

**Files:**
- Modify:
  - `src/js/67-trade.js`
  - `src/html/10-inventory.html`: add the Log button, and the Trade button that Task 4 wires up, to the Equipment card heading after `+ Add`.
  - `src/js/90-boot.js`
  - `src/js/88-settings.js`: Sheet display gets "Inventory log size".
  - `src/css/50-modal.css`
- Tests: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Produces:
  - `invLogHTML(list, filter, size)` → string
  - `openInvLog()`
  - `INV_FILTERS` = `{all:null, trades:["trade"], items:["add","edit","delete","use","grant"], coins:["coins"], ammo:["ammo"]}`

- [ ] **Step 1: Write the failing tests.**

```js
// ---------- #47 the Log dialog
{
  const L = [
    {id: 'a', at: Date.now(), kind: 'trade', title: 'Traded with <b>Olvin</b>', lines: [{dir: '-', text: 'Dagger ×1'}, {dir: '+', text: 'Rope ×1'}], undo: {parts: []}, undone: false, meta: {with: '<b>Olvin</b>'}},
    {id: 'b', at: Date.now() - 1000, kind: 'grant', title: 'Granted by Fighter', lines: [{dir: '+', text: 'Chain Mail ×1'}], undo: null, undone: false, meta: {}},
    {id: 'c', at: Date.now() - 2000, kind: 'coins', title: 'Coins adjusted', lines: [{dir: '+', text: '+15 GP'}], undo: {delta: {gp: 15}}, undone: true, meta: {}}
  ];
  const keep = X.character; X.character = X.blankChar(); X.character.invLog = L; X.character.coins = {gp: 100};
  try {
    const h = X.invLogHTML(L, 'all', 500);
    ck('#47 the log escapes titles and receipts', h.includes('Traded with &lt;b&gt;Olvin&lt;/b&gt;') && !h.includes('<b>Olvin'));
    ck('#47 ...offers Undo only where allowed; a grant has none', /data-invundo="a"/.test(h) && !/data-invundo="b"/.test(h));
    ck('#47 ...strikes an undone line and offers it no Undo', /class="il-e undone"[^>]*data-ilid="c"/.test(h) && !/data-invundo="c"/.test(h));
    ck('#47 ...groups by day with Today first', /Today/.test(h));
    ck('#47 ...shows the size and Clear log', /Keeps the newest 500/.test(h) && /id="invLogClear"/.test(h));
    ck('#47 ...a filter narrows it', !/Coins adjusted/.test(X.invLogHTML(L, 'trades', 500)) && /Traded with/.test(X.invLogHTML(L, 'trades', 500)));
    X.character.coins = {gp: 0}; L[2].undone = false;
    const h2 = X.invLogHTML(L, 'all', 500);
    ck('#47 a blocked Undo is disabled with its reason', /data-invundo="c" disabled title="Not enough GP left to take back\."/.test(h2), h2);
  } finally { X.character = keep; }
  const html = require('./harness').loadHTML();
  ck('#47 the Equipment card has Trade and Log beside Add', /data-add="item"[\s\S]{0,400}id="btnTrade"[\s\S]{0,400}id="btnInvLog"/.test(html));
}
```

  In `rules-data.js`, check that `settings` source contains `"Inventory log size"` and an `id="setInvLogSize"` select.

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement** in `67-trade.js`:

```js
const INV_FILTERS={all:null,trades:["trade"],items:["add","edit","delete","use","grant"],coins:["coins"],ammo:["ammo"]};
const INV_ICON={trade:"⇄",add:"+",edit:"✎",delete:"🗑",use:"✦",coins:"¤",grant:"⚑",ammo:"➶"};
let _invLogFilter="all";
function invDayLabel(at){
  const d=new Date(at),t=new Date();const day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
  const diff=(day(t)-day(d))/86400000;return diff===0?"Today":diff===1?"Yesterday":d.toLocaleDateString();
}
function invLogHTML(list,filter,size){
  const kinds=INV_FILTERS[filter]||null,rows=(list||[]).filter(e=>!kinds||kinds.indexOf(e.kind)>=0);
  let day="",out=`<div class="il-filters">`+Object.keys(INV_FILTERS).map(f=>`<button type="button" class="il-f${f===filter?" on":""}" data-ilfilter="${esc(f)}" aria-pressed="${f===filter?"true":"false"}">${esc(f[0].toUpperCase()+f.slice(1))}</button>`).join("")+`</div>`;
  if(!rows.length)out+=`<p class="empty">Nothing logged yet.</p>`;
  rows.forEach(e=>{
    const dl=invDayLabel(e.at);if(dl!==day){day=dl;out+=`<div class="il-day">${esc(dl)}</div>`;}
    const c=invUndoCheck(e),time=new Date(e.at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
    const undo=e.undone||!e.undo||e.kind==="grant"||e.kind==="ammo"?"":
      (c.ok?`<button type="button" class="tbtn il-undo" data-invundo="${esc(e.id)}">Undo</button>`
           :`<button type="button" class="tbtn il-undo" data-invundo="${esc(e.id)}" disabled title="${esc(c.why)}">Undo</button><small class="il-why">${esc(c.why)}</small>`);
    const lines=(e.lines||[]).map(l=>`<div class="il-l ${l.dir==="+"?"in":l.dir==="-"?"out":""}">${esc(l.text)}</div>`).join("");
    out+=`<div class="il-e${e.undone?" undone":""}" data-ilid="${esc(e.id)}"><span class="il-ic" aria-hidden="true">${INV_ICON[e.kind]||"•"}</span>`+
      `<div class="il-tx"><b>${esc(e.title)}</b>${e.kind==="trade"?`<details><summary>Receipt</summary>${lines}</details>`:lines}</div>`+
      `<div class="il-side"><span class="il-t">${esc(time)}</span>${undo}</div></div>`;
  });
  return out+`<div class="il-foot"><span>Keeps the newest ${esc(String(size))}.</span><button type="button" class="tbtn danger" id="invLogClear">Clear log</button></div>`;
}
function openInvLog(){
  const paint=()=>{const b=document.getElementById("mBody");if(b)b.innerHTML=invLogHTML(character.invLog||[],_invLogFilter,character.invLogSize||500);};
  openModal("Inventory log","","",{wide:true});paint();
  const body=document.getElementById("mBody");if(!body||body.dataset.ilWired)return;
  body.dataset.ilWired="1";
  body.addEventListener("click",e=>{
    if(!document.getElementById("invLogClear"))return;   /* only while the log is the open dialog */
    const t=e.target;let m;
    if((m=t.closest("[data-ilfilter]"))){_invLogFilter=m.dataset.ilfilter;paint();return;}
    if((m=t.closest("[data-invundo]"))){const why=invUndo(m.dataset.invundo);if(why)toast(why);paint();return;}
    if(t.closest("#invLogClear")){if(confirm("Clear the whole inventory log? Undo will no longer be possible for any of it.")){character.invLog=[];scheduleSave();paint();}return;}
  });
}
```

  - **Markup.** In `10-inventory.html`, after the Equipment card's `+ Add` button, add `<button class="add" id="btnTrade" type="button">⇄ Trade</button><button class="add" id="btnInvLog" type="button" aria-label="Inventory log">🕮 <span class="il-word">Log</span></button>`.
  - **Wiring.** In `90-boot.js`, add `if(t.closest("#btnInvLog"))return openInvLog();`. Task 4 wires `#btnTrade`; until then it does nothing.
  - **Settings.** Add an Inventory log size select (`#setInvLogSize`) with the five values to the Sheet display page. Its change sets `character.invLogSize`, trims the log through `cleanInvLog`, and saves.
  - **CSS** in `50-modal.css`:
    - `.il-*` rules: rows with a 44 px minimum height, green for `.in` and red for `.out` using `--hb-healthy`/`--brick` (or the inventory's own tokens), and a struck-through, faded `.undone`;
    - `.il-word{}`, and a container or media query that hides `.il-word` on narrow cards.
- [ ] **Step 4: Run** the tests and the full suite.
- [ ] **Step 5: Drive it with the project's Playwright MCP.**
  1. Add an item.
  2. Use it.
  3. Adjust coins.
  4. Open Log.
  5. Undo the coins.
  6. Undo the add, which is blocked after the use, with its reason shown.
  7. Clear the log.

  Take a screenshot at 1280 and at 390 to `.claude/qa/in-progress/47-trade-window/47-t3-log-*.png`.
- [ ] **Step 6: Commit** as `feat(#47): the inventory log dialog, its button and size setting`, with the trailer.

---

### Task 4: The trade window

**Files:**
- Modify:
  - `src/js/67-trade.js`
  - `src/js/90-boot.js` (`#btnTrade`)
  - `src/js/85-browse.js`: `openBrowse` gains an optional `cfg.onClose`, called when the picker closes without adding. Read `closeBrowse` and openBrowse's close button first.
  - `src/css/50-modal.css`
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes Tasks 1–3.
- Produces:
  - `newTradeDraft(opts)` → the draft object
  - `tradeBalance(d, ch)` → `{giveCp, getCp, diff}`
  - `tradeHTML(d, ch)` → string
  - `openTrade(opts)`
  - `completeTrade(d)` → the log entry

The draft has this shape:

```
{with:"",
 give:{items:[{id,qty}],coins:{}},
 get:{items:[{key,name,qty,cost,def,custom}],coins:{}},
 applyGive:true,
 applyGet:true,
 tab:"give"}
```

- [ ] **Step 1: Write the failing tests** (Review Focus 2 and 4).

```js
// ---------- #47 the trade window
{
  const keep = {ch: X.character, rules: X.rules, rs: ctx.scheduleSave, ri: ctx.renderInventory, ra: ctx.renderAttacks, rc: ctx.renderCoins, rq: ctx.recompute};
  ['scheduleSave', 'renderInventory', 'renderAttacks', 'renderCoins', 'recompute'].forEach(n => ctx[n] = () => {});
  try {
    X.character = X.blankChar(); X.character.system = 'dnd'; X.character.attacks = [];
    X.character.inventory = [{id: 'dg', name: 'Dagger', qty: 1, cost: 2, weapon: {dice: '1d4'}}, {id: 'ro', name: 'Rope', qty: 2, cost: 1}];
    X.character.coins = {gp: 40, sp: 0, cp: 0};
    const d = X.newTradeDraft({with: 'Olvin <i>'});
    d.give.items = [{id: 'dg', qty: 1}]; d.give.coins = {gp: 30};
    d.get.items = [{key: 'k1', name: 'Healing Potion', qty: 1, cost: 50, def: {name: 'Healing Potion', cost: '50 gp'}, custom: false},
      {key: 'k2', name: 'Rope', qty: 1, cost: 1, def: {name: 'Rope', cost: '1 gp'}, custom: false}, {key: 'k3', name: 'Lucky coin', qty: 1, cost: 0, def: null, custom: true}];
    let b = X.tradeBalance(d, X.character);
    ck('#47 balance: coins plus item value on both sides', b.giveCp === 3200 && b.getCp === 5100 && b.diff === -1900, b);
    d.applyGive = false; b = X.tradeBalance(d, X.character);
    ck('#47 ...the give switch off drops the Dagger\'s 2 gp', b.giveCp === 3000 && b.diff === -2100);
    d.applyGet = false; b = X.tradeBalance(d, X.character);
    ck('#47 ...the get switch off drops the items\' cost (a gift)', b.getCp === 0 && b.diff === 3000);
    d.applyGive = true; d.applyGet = true;
    const h = X.tradeHTML(d, X.character);
    ck('#47 the window escapes "With" and shows the shortfall in red', h.includes('Olvin &lt;i&gt;') && /class="tr-bal short"/.test(h) && /19 gp short/.test(h), h);
    ck('#47 ...both switches, the tabs, and a ✓ button labelled for screen readers',
       /id="trApplyGive"[^>]*aria-checked="true"/.test(h) && /id="trApplyGet"/.test(h) && /data-trtab="give"/.test(h) && /id="trComplete"[^>]*aria-label="Complete trade"/.test(h) && /class="tr-done-lbl">Complete Trade</.test(h));
    ck('#47 ...giving is capped at what you own', /data-trgive="dg"[^>]*data-max="1"/.test(h) && /data-trcoin="give:gp"[^>]*max="40"/.test(h));
    /* complete, then undo (Review Focus 2) */
    const before = JSON.stringify({inv: X.character.inventory, coins: X.character.coins});
    const e = X.completeTrade(d);
    ck('#47 Complete: the Dagger and 30 gp leave; the Potion, a Rope (stacking on yours) and a custom Lucky coin arrive',
       !X.character.inventory.some(i => i.id === 'dg') && X.character.coins.gp === 10 && X.character.inventory.some(i => i.name === 'Healing Potion') &&
       X.character.inventory.find(i => i.name === 'Rope').qty === 3 && X.character.inventory.find(i => i.name === 'Lucky coin').origin.kind === 'traded', X.character.inventory);
    ck('#47 ...one trade line, nothing else', X.character.invLog.length === 1 && X.character.invLog[0].kind === 'trade' && X.character.invLog[0].meta.with === 'Olvin <i>' && X.character.invLog[0].meta.applyGive === true);
    ck('#47 undo the trade: everything back as it was', X.invUndo(e.id) === '' &&
       JSON.stringify({inv: X.character.inventory.map(i => ({n: i.name, q: i.qty})).sort((a, b) => a.n < b.n ? -1 : 1), coins: X.character.coins.gp}) ===
       JSON.stringify({inv: JSON.parse(before).inv.map(i => ({n: i.name, q: i.qty})).sort((a, b) => a.n < b.n ? -1 : 1), coins: 40}), X.character.inventory);
    ck('#47 an empty trade cannot complete', X.completeTrade(X.newTradeDraft({})) === null);
  } finally { Object.assign(ctx, {scheduleSave: keep.rs, renderInventory: keep.ri, renderAttacks: keep.ra, renderCoins: keep.rc, recompute: keep.rq}); X.character = keep.ch; X.rules = keep.rules; }
}
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement** in `67-trade.js`:
  - **`newTradeDraft(opts)`** returns the draft shape above. `opts.with`, `opts.give` and `opts.get` seed it, for #105.
  - **`tradeBalance(d, ch)`:**
    - `giveCp = coinsToCp(d.give.coins) + (d.applyGive ? Σ itemWorthCp(inv item, qty) : 0)`
    - `getCp = coinsToCp(d.get.coins) + (d.applyGet ? Σ round(cost × 100) × qty : 0)`
    - `diff = giveCp − getCp`
  - **`tradeHTML(d, ch)`** builds:
    - **"With":** an input `#trWith` with the value escaped. Suggestion chips (`data-trwith`) come from `cleanParty(ch.party)` names plus `meta.with` values in the log, unique, up to 8.
    - **Tabs:** `<div class="tr-tabs">` with buttons `data-trtab="give"` and `data-trtab="get"`, each with its count. CSS hides them above 700 px.
    - **Two sides:** `<section class="tr-side" data-side="give">` and `data-side="get"`. The wrapper gets the class `tr-on-give` or `tr-on-get` from `d.tab`, and at 700 px and below only the active side shows.
    - **Give rows:** name, worth, and a stepper `<button data-trgive="<id>" data-d="-1">` / `+1` with `data-max="<owned>"`. "+ From your inventory" (`#trPickGive`) toggles an inline list of your items, each a button `data-traddgive="<id>"`, not yet added. Coin inputs `data-trcoin="give:<k>"` with `max` set to what you hold, for `coinKeys()`.
    - **Get rows:** name, a quantity stepper `data-trget="<key>"`, and a cost input `data-trcost="<key>"`. "+ Find an item" is `#trFind`; "+ Custom item" (`#trCustom`) adds a row with a name input `data-trname="<key>"`. Coin inputs `data-trcoin="get:<k>"`.
    - **Switches:** `#trApplyGive` and `#trApplyGet`, each `role="switch"` with `aria-checked`.
    - **Balance:** `<div class="tr-bal${d<0?" short":""}">You give X · you get Y · N short|N over|Even</div>`.
    - **Foot:** Cancel (`#trCancel`) and `<button class="tbtn primary" id="trComplete" aria-label="Complete trade"><span class="tr-done-ic" aria-hidden="true">✓</span><span class="tr-done-lbl">Complete Trade</span></button>`.
  - **`openTrade(opts)`:**
    - It keeps the draft in a module `let _trade`, opens a wide modal titled "Trade" with `tradeHTML`, and binds one delegated listener on `#mBody` that is active only while `#trComplete` exists, guarded by a dataset flag, as `openInvLog` does.
    - Each control updates `_trade` and repaints the body, keeping focus by id or data attribute.
    - **`#trFind`:**
      1. `closeModal()`, then open the item picker with the same config as `browseItems`.
      2. Its `onAdd` pushes each picked entry into `_trade.get.items`, with the quantity, `cost: costOverride ?? costToGp(entry.cost) ?? 0` and `def: entry`, then closes the picker and reopens the trade window from `_trade`.
      3. Its `onClose` also reopens the trade window from `_trade`.
    - **`#trComplete`:** if the diff is negative, `confirm("You're N short. Complete the trade anyway?")` first, then `completeTrade(_trade)` and `closeModal()`.
  - **`completeTrade(d)`** returns `null` if both sides are empty (no items and no coins). Otherwise it does one step:
    1. For each give item, call `invRemoveQty(id, qty)`. Record `{id, qty, snap, atk}` in a `give` part. When the whole item went, `snap`/`atk` come back from `invRemoveQty`. When it didn't, re-adding the qty is enough, so store `snap: null`.
    2. Coin delta: `get.coins − give.coins` per key, applied to `character.coins`.
    3. Get items: a library item goes through `addLibraryItems([def], {kind:"traded", detail:d.with, at:Date.now()}, cost, qty)` (`traded` is an existing `ORIGIN_KINDS` entry, "Traded · from (who)"), keeping what it returns. A custom item is pushed as `{id:uid(), name, qty, cost, origin:{kind:"traded", detail:d.with, at:Date.now()}}` and recorded as `{id, qty, created:true}`.
    4. Log one entry: `kind:"trade"`, title `"Traded with "+d.with` or `"Traded"`, a receipt in `lines`, `meta:{with, applyGive, applyGet, giveCp, getCp}`, and `undo:{parts:[{kind:"give",u:{items:giveRecs}},{kind:"add",u:{items:gotRecs}},{kind:"coins",u:{delta}}]}`.
    5. Re-render and save.

    The `give` part is always clean. Undoing the `add` part takes the received items back. Undoing the `coins` part reverses the delta.
  - **`90-boot.js`:** add `if(t.closest("#btnTrade"))return openTrade({});`.
  - **CSS** in `50-modal.css`:
    - **Above 700 px:** `.tr-sides` is a two-column grid, `.tr-tabs` is hidden, and `.tr-done-ic` is hidden.
    - **At 700 px and below:** one column, with only the active side showing; `.tr-tabs` is shown, `.tr-done-lbl` is hidden, and `.tr-done-ic` is shown.
    - **Always:** steppers and buttons are at least 44 px, and `.tr-bal.short` uses `--brick`.
    - The media query comes after the base rules.

- [ ] **Step 4: Run** the tests and the full suite.
- [ ] **Step 5: Drive it.**
  1. Make a trade at 1280 (side by side) and at 390 (tabs, the ✓ button).
  2. Set a shortfall, check the confirm, then Complete.
  3. Flip both switches.
  4. Add from the finder and a custom item.
  5. Open Log, expand the receipt, and Undo it.

  Take screenshots to `.claude/qa/in-progress/47-trade-window/47-t4-*.png` and check the console.
- [ ] **Step 6: Commit** as `feat(#47): the trade window`, with the trailer.

---

### Task 5: Browser QA, docs, release notes

**Files:**
- The pages in spec §10: inventory, ammunition, grants-and-provenance, character-model, settings-and-updates, and the overview.
- `src/docs/_claude/WIRING-LEDGER.md`
- `src/docs/UNRELEASED.md`
- The spec's As built.
- The 1.9.0 row.

CSS changes here are for tuning only. A JS bug found here is a finding for the controller, not something to fix in this task.

- [ ] **Step 1: Before shots** from main's build, `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`: the Inventory tab at 1280 and at 390. Save them to `.claude/qa/in-progress/47-trade-window/47-before-*.png`.
- [ ] **Step 2: After shots and driven checks,** saved as `47-after-*.png`:
  - a full trade at 1280 and at 390, short and over;
  - the switches;
  - "With" chips from the Party card and from earlier trades;
  - finder and custom items;
  - every writer making exactly one line: add, edit, an unchanged save (no line), delete, Use, Adjust, a coin field, Convert, a class grant, and End combat ammo;
  - the Log dialog: filters, a receipt, Undo clean and blocked with its reason, an undone line struck through, Clear log;
  - the size setting trimming the log;
  - both skins, and dark mode;
  - the console stays clean.

  Report what you drove and what you didn't.
- [ ] **Step 3: Docs.**
  - Append `## Trade window and inventory log (#47, <today>)` to the ledger. It is append-only.
  - Rewrite the spec §10 pages, each with a History line citing that L-number.
  - Add Decisions rows plus their register lines.
  - Write As built: every Ruling and deferred minor from the controller's progress.md, and the plan-level `use` choice.
  - Add the two `UNRELEASED.md` bullets from spec §10.
  - Mark the 1.9.0 row built.
- [ ] **Step 4: Run the full suite.** It must pass. Then restore the build files.
- [ ] **Step 5: Commit** as `docs(#47): …`, and any CSS tuning separately as `style(#47): …`.
