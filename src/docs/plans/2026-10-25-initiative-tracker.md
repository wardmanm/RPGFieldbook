# Initiative Tracker: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an initiative tracker to the combat view (#91):
- a strip of chips under the combat header, with health bars;
- Turns or Rounds mode;
- a Roll initiative window on Start combat;
- a dialog per combatant with big targets;
- a Party card on the Bio tab.

**Architecture:** One new fragment, `src/js/87-initiative.js`, placed after `87-combat.js`.
- **Task 1** builds the pure core: cleaners, sort, next turn, bands, roll arithmetic, building the list, plus the character fields.
- **Task 2** adds the Party card.
- **Task 3** adds the Roll initiative window and the start of a fight.
- **Task 4** adds the strip, Next, the table, and the Turns/Rounds and Show rolls switches.
- **Task 5** adds the combatant dialog, adding mid-fight, removing, and tie order.
- **Task 6** is QA and docs.

The strip is rendered INSIDE `#cvHead`, as the last part of `combatHeaderHTML()`, so it sticks with the header for free. The table panel is a separate `#cvInitTable` below it, and it does not stick.

**Tech Stack:**
- Plain ES2020 concatenated into one `<script>`, with no modules.
- Plain CSS on theme tokens.
- Node suites through `src/tests/harness.js`.
- The project's Playwright MCP for QA.

**Spec:** `src/docs/specs/2026-10-25-initiative-tracker-design.md`. Read it first.
**Mockups:** these files in `.superpowers/brainstorm/8903-1792934547/content/` are the visual target:
- `tracker-layout.html` (C)
- `tracker-details.html`
- `tracker-health.html`
- `tracker-dialog.html`

**Plan-level choice (flag to Mike at handoff):** spec §5.2 lets a table row be dragged within a tie. This plan instead breaks ties from the combatant dialog with **Act earlier / Act later** buttons, shown only when a neighbour has the same initiative. That keeps editing in the dialog, gives 44 px targets, and avoids a drag on a sideways-scrolling strip.

**Worktree:** `.claude/worktrees/91`, branch `issue/91-initiative-tracker`. From the repo root run `./scripts/wt.sh add 91 initiative-tracker`. Run every command below from `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/91`.

## Global Constraints

- **Build:**
  - One shipped file, built by concatenation: no modules, no network.
  - `src/js/87-initiative.js` goes in `src/manifest.json` right after `"src/js/87-combat.js"`.
  - The JS fragment count moves to **36** in `CLAUDE.md` (`js/*.js  35 fragments`) and in `src/docs/ADR-001-source-split.md` (`js/ (35 fragments)`).
  - Add a code-map row in `src/docs/wiki/overview.md`, and cite the fragment from `src/docs/wiki/features/combat-view.md`. The docs suite checks all of these.
- **TDZ:** `blankChar()` runs at load, so its new defaults are literals. Functions in the new fragment run only at runtime.
- **Bytes:** LF line endings, a final newline, no BOM.
- **Git:**
  - Never `git add` `dist/fieldbook.html` or `docs/CHANGELOG.md`; add explicit paths only.
  - Never touch `APP_VERSION`, `DATA_VERSIONS`, `CHANGELOG` or anything under `data/`.
  - End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Character data (spec §3):** `party`, `combatants`, `combatTurn`, `initMode` (`"turns"` default) and `initShowRolls` (`true` default).
  - `migrate()` preserves every field, then cleans these five.
  - `combatants` is always `[]` when `combatActive!==true`.
- **Bands:** `0` Healthy, `1` Injured, `2` Bloodied, `3` Near death, `4` Dead, `null` not set. A foe is dead when `band===4`. A party member is dead when `dead===true`. You are never dead.
- **Markup:**
  - Every `${…}` inside a quoted attribute is `esc(…)`, inline `style` included, or a literal-only ternary.
  - Body text is `esc()`-ed.
  - A modal title is plain text, never `esc()`-ed.
- **Touch:** every dialog target and every strip chip is at least 44 px tall.
- **CSS:**
  - Theme tokens only. The new band tokens go in the `:root{…}` block of `00-tokens.css`: `--hb-healthy`, `--hb-injured`, `--hb-bloodied`, `--hb-near`, `--hb-empty`.
  - Media queries come after their base rules.
- **Test harness:**
  - Names come from `loadApp([...])`; add any that are absent.
  - `ctx.fn = …` replaces a function, so spy that way.
  - `document` is a stub.
  - `state.confirm` answers `confirm()`.
  - Run one suite: `node src/tests/<suite>.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.
  - Run everything: `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`, then `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.
- **Screenshots:** the project's Playwright MCP only (`mcp__playwright__*`), with absolute paths under `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/`.

## Review Focus

1. **Next when everyone but you is dead, or when the actor was just removed.** The marker never lands on a dead or missing row, and each wrap advances the round exactly once. → Task 1 `initNextTurn` tests, Task 5 "remove the actor".
2. **A typed initiative that isn't a clean d20** (` 14 `, `0`, `21`, `-3`, `2.5`, empty). Only 1–20 sets your roll. → Task 1 `initRollCheck`.
3. **Hostile or long names** (`<img onerror>`, 200 characters) on chips, rows and dialogs. They are escaped and cut to 60 characters. → Task 1 cleaners, Task 4 markup test.
4. **An old save, or a hand-edited one,** with `combatActive:true` and no or junk `combatants`. It loads, the strip offers "Roll initiative", and nothing throws. → Task 1 migrate test, Task 4 empty-strip test.
5. **Ties.** Equal initiatives keep their entered order through a re-sort, and Act earlier / Act later swaps only tied neighbours. → Task 1 `initSort`, Task 5 tie test.

---

### Task 1: The fields and the pure core

**Files:**
- Create: `src/js/87-initiative.js`
- Modify:
  - `src/manifest.json`
  - `src/js/00-constants.js` (`blankChar()`)
  - `src/js/71-char-io.js` (`migrate()`, before `migrateSheet103(base);`)
  - `src/js/87-combat.js` (`combatEnd()`)
  - `CLAUDE.md`
  - `src/docs/ADR-001-source-split.md`
  - `src/docs/wiki/overview.md` (code map)
  - `src/docs/wiki/features/combat-view.md` (the **Code:** line cites `87-initiative.js`)
- Test: `src/tests/sheet.js`

**Interfaces (produces):**
- `HB_NAMES`: `["Healthy","Injured","Bloodied","Near death","Dead"]`
- `HB_SAYS`: an array of 5 strings, the DM wording for each band
- `initInt(v)` → integer or `null`
- `initOpt(v)` → whole number ≥0, or `""`
- `cleanParty(v)` → `[{id,name,ac,maxHp}]`
- `cleanCombatants(v, active)` → rows
- `combatantDead(r)` → boolean
- `initSort(list)` → a new array
- `initFirstAlive(list)` → id
- `initNextTurn(list, turnId)` → `{turnId, wrapped}`
- `bandOfShare(hp, max)` → `0..3` or `null`
- `combatantBar(r)` → `{band, share}`
- `initRollCheck(raw)` → `{ok, face, why}`
- `initRollLine(faces, mod)` → string
- `initModOf()` → number
- `youAC()` → number
- `buildCombatants(you, party, foes)` → sorted rows

- [ ] **Step 1: Write the failing tests.** Append the block below to `src/tests/sheet.js`, before `ck.done()`. Add every name listed above to `loadApp` (plus `'combatEnd'`, `'blankChar'` and `'migrate'` if any is absent).

```js
// ---------- #91 initiative: the fields and the pure core
{
  const b = X.blankChar();
  ck('#91 a new character: no party, no fight, Turns, rolls shown',
     JSON.stringify(b.party) === '[]' && JSON.stringify(b.combatants) === '[]' && b.combatTurn === '' && b.initMode === 'turns' && b.initShowRolls === true);
  const P = X.cleanParty([{id: 'p1', name: '  Thorn ', ac: '14', maxHp: 22}, {name: ''}, null, 'x', {name: 'A'.repeat(200), ac: '-2', maxHp: 'lots'}]);
  ck('#91 cleanParty keeps named members, trims, cuts to 60, optional numbers or ""',
     P.length === 2 && P[0].name === 'Thorn' && P[0].ac === 14 && P[0].maxHp === 22 && P[1].name.length === 60 && P[1].ac === '' && P[1].maxHp === '', P);
  /* Review Focus 3 and 4 */
  const C = X.cleanCombatants([{kind: 'you', id: 'y', init: '17'}, {kind: 'you', id: 'y2'}, {kind: 'boss'}, 7,
    {kind: 'foe', id: 'f', name: '<img onerror=1>', init: 19, band: 2, ac: '15'}, {kind: 'party', id: 'p', name: 'Thorn', init: null, maxHp: 22, hp: 9, dead: 'yes'},
    {kind: 'foe', id: 'g', name: 'Wolf', band: 9}], true);
  ck('#91 cleanCombatants: one "you", known kinds only, types forced', C.length === 4 && C.filter(r => r.kind === 'you').length === 1 &&
     C[0].init === 17 && C[1].band === 2 && C[1].ac === 15 && C[1].name === '<img onerror=1>' && C[2].dead === false && C[2].track === 'exact' && C[3].band === null, C);
  ck('#91 ...and out of a fight the list is always empty', X.cleanCombatants([{kind: 'you'}], false).length === 0);
  const m = X.migrate({abilities: {}, combatActive: true, combatants: 'junk', initMode: 'sideways', initShowRolls: 'no', party: [{name: 'Bree'}]});
  ck('#91 migrate cleans the five fields; a fight in progress keeps an empty list',
     JSON.stringify(m.combatants) === '[]' && m.initMode === 'turns' && m.initShowRolls === true && m.party.length === 1 && m.combatTurn === '', m);
  ck('#91 ...a save → load round trip keeps a fight', (() => { const g = X.blankChar(); g.combatActive = true; g.combatRound = 2;
     g.combatants = [{id: 'y', kind: 'you', name: '', init: 12, ac: '', track: '', band: null, hp: '', maxHp: '', dead: false, partyId: ''}]; g.combatTurn = 'y';
     const r = X.migrate(JSON.parse(JSON.stringify(g))); return r.combatants.length === 1 && r.combatTurn === 'y'; })());

  /* sort: stable, unrolled last (Review Focus 5) */
  const S = X.initSort([{id: 'a', init: 10}, {id: 'b', init: null}, {id: 'c', init: 15}, {id: 'd', init: 10}]);
  ck('#91 initSort: highest first, ties keep their order, unrolled last', S.map(r => r.id).join() === 'c,a,d,b', S.map(r => r.id));

  /* next turn (Review Focus 1) */
  const L = [{id: 'f1', kind: 'foe', band: 1}, {id: 'y', kind: 'you'}, {id: 'p', kind: 'party', dead: true}, {id: 'f2', kind: 'foe', band: 4}, {id: 'f3', kind: 'foe', band: null}];
  const nt = (t) => X.initNextTurn(L, t);
  ck('#91 Next skips a dead party member and a dead foe', nt('y').turnId === 'f3' && nt('y').wrapped === false, nt('y'));
  ck('#91 Next wraps past the end, once', nt('f3').turnId === 'f1' && nt('f3').wrapped === true, nt('f3'));
  ck('#91 an unknown actor starts at the first living row without a wrap', nt('gone').turnId === 'f1' && nt('gone').wrapped === false);
  const solo = [{id: 'f', kind: 'foe', band: 4}, {id: 'y', kind: 'you'}];
  ck('#91 everyone else dead: you again, and every Next wraps', X.initNextTurn(solo, 'y').turnId === 'y' && X.initNextTurn(solo, 'y').wrapped === true);
  ck('#91 you are never dead', X.combatantDead({kind: 'you', band: 4, dead: true}) === false);

  /* bands */
  ck('#91 bandOfShare: full Healthy, >½ Injured, ≤½ Bloodied, ≤¼ Near death (0 too), no max → null',
     X.bandOfShare(22, 22) === 0 && X.bandOfShare(12, 22) === 1 && X.bandOfShare(11, 22) === 2 && X.bandOfShare(5, 22) === 3 && X.bandOfShare(0, 22) === 3 && X.bandOfShare(5, '') === null);
  ck('#91 a party member on Exact shows a share; on Estimate their band', (() => {
     const e = X.combatantBar({kind: 'party', track: 'exact', hp: 9, maxHp: 22}); const s = X.combatantBar({kind: 'party', track: 'estimate', band: 1});
     return e.band === 2 && Math.abs(e.share - 9 / 22) < 1e-9 && s.band === 1 && s.share === null; })());

  /* your roll (Review Focus 2) */
  const ok = v => X.initRollCheck(v).ok;
  ck('#91 a typed d20 takes 1..20', ok('1') && ok('20') && ok(' 14 ') && !ok('0') && !ok('21') && !ok('-3') && !ok('2.5') && !ok(''));
  ck('#91 ...saying why', X.initRollCheck('21').why === 'A d20 rolls 1 to 20.' && X.initRollCheck('').why === 'Type the number you rolled.');
  ck('#91 the working: one die, a negative modifier, and advantage',
     X.initRollLine([14], 3) === '14 + 3 = 17' && X.initRollLine([9], -1) === '9 − 1 = 8' && X.initRollLine([6, 14], 3) === 'Rolled 6, 14 → 14 + 3 = 17',
     [X.initRollLine([14], 3), X.initRollLine([9], -1), X.initRollLine([6, 14], 3)]);

  /* building a fight */
  const B = X.buildCombatants({name: 'Mira', init: 17}, [{id: 'p1', name: 'Thorn', ac: 14, maxHp: 22, init: 14}, {id: 'p2', name: 'Bree', ac: '', maxHp: '', init: null}],
    [{name: 'Goblin', count: 2, ac: 13, init: 11}, {name: 'Goblin boss', count: 1, ac: '', init: 19}, {name: '', count: 1, ac: '', init: 5}]);
  ck('#91 buildCombatants: sorted, "× 2" numbered, AC optional, unnamed foes dropped, unrolled last',
     B.map(r => r.name).join('|') === 'Goblin boss|Mira|Thorn|Goblin 1|Goblin 2|Bree' && B[1].kind === 'you' && B[2].track === 'exact' && B[2].hp === 22 && B[5].track === 'estimate' && B[0].ac === '',
     B.map(r => r.name));

  const e = X.blankChar(); e.combatActive = true; e.combatRound = 3; e.combatants = B; e.combatTurn = B[0].id;
  X.combatEnd(e);
  ck('#91 End combat clears the fight', JSON.stringify(e.combatants) === '[]' && e.combatTurn === '');
}
```

- [ ] **Step 2: Run the tests and confirm they fail.**
  Run: `node src/tests/sheet.js | grep -E "^FAIL|LOAD FAIL" | head`
  Expected: `LOAD FAIL`.

- [ ] **Step 3: Implement.**
  - In `blankChar()`, beside `combatSections:COMBAT_DEFAULTS.slice(),`, add `party:[], combatants:[], combatTurn:"", initMode:"turns", initShowRolls:true,`.
  - In `combatEnd(c)`, after `c.combatActive=false;c.combatRound=0;`, add `c.combatants=[];c.combatTurn="";`.
  - In `migrate()`, directly before `migrateSheet103(base);`, add:

```js
  /* #91: the party and the fight; out of a fight there is none */
  base.party=cleanParty(s.party);
  base.combatants=cleanCombatants(s.combatants,base.combatActive===true);
  base.combatTurn=base.combatants.some(r=>r.id===s.combatTurn)?String(s.combatTurn):initFirstAlive(base.combatants);
  base.initMode=s.initMode==="rounds"?"rounds":"turns";
  base.initShowRolls=s.initShowRolls!==false;
```

  Create `src/js/87-initiative.js`:

```js
/* ================= initiative tracker (#91) =================
   The fight's order, saved with the character while combatActive is true
   (cleared by combatEnd()). The array order IS the turn order; initSort()
   re-sorts it, stable, when an initiative changes. Bands: 0 Healthy,
   1 Injured, 2 Bloodied, 3 Near death, 4 Dead, null not set. Spec:
   src/docs/specs/2026-10-25-initiative-tracker-design.md. */
const HB_NAMES=["Healthy","Injured","Bloodied","Near death","Dead"];
const HB_SAYS=['"untouched", "fresh"','"barely hurt", "a few scratches"','"badly hurt", half or less','"almost dead", "barely standing"',"struck out; Next skips it"];
function initInt(v){const s=String(v==null?"":v).trim();return /^-?\d+$/.test(s)?parseInt(s,10):null;}
function initOpt(v){const n=initInt(v);return (n===null||n<0)?"":n;}
function cleanParty(v){
  return (Array.isArray(v)?v:[]).filter(p=>p&&typeof p==="object"&&String(p.name||"").trim())
    .map(p=>({id:String(p.id||uid()),name:String(p.name).trim().slice(0,60),ac:initOpt(p.ac),maxHp:initOpt(p.maxHp)}));
}
function cleanCombatants(v,active){
  if(!active)return [];
  let you=false;const out=[];
  (Array.isArray(v)?v:[]).forEach(r=>{
    if(!r||typeof r!=="object"||["you","party","foe"].indexOf(r.kind)<0)return;
    if(r.kind==="you"){if(you)return;you=true;}
    const party=r.kind==="party",band=(Number.isInteger(r.band)&&r.band>=0&&r.band<=4)?r.band:null,maxHp=party?initOpt(r.maxHp):"";
    out.push({id:String(r.id||uid()),kind:r.kind,name:String(r.name==null?"":r.name).slice(0,60),init:initInt(r.init),
      ac:r.kind==="you"?"":initOpt(r.ac),
      track:party?((r.track==="exact"||r.track==="estimate")?r.track:(maxHp!==""?"exact":"estimate")):"",
      band:r.kind==="you"?null:band,hp:party?initOpt(r.hp):"",maxHp,dead:party&&r.dead===true,partyId:party?String(r.partyId||""):""});
  });
  return out;
}
function combatantDead(r){return !!r&&(r.kind==="foe"?r.band===4:(r.kind==="party"?r.dead===true:false));}
function initSort(list){
  return list.map((r,i)=>({r,i})).sort((a,b)=>{
    const x=a.r.init,y=b.r.init;
    if(x===y)return a.i-b.i;if(x===null)return 1;if(y===null)return -1;return y-x;
  }).map(o=>o.r);
}
function initFirstAlive(list){const r=(list||[]).find(x=>!combatantDead(x));return r?r.id:"";}
/* The next living row after turnId. Passing the end is a wrap: the caller
   advances the round once. An unknown actor starts at the top, no wrap. */
function initNextTurn(list,turnId){
  const n=list.length;if(!n)return {turnId:"",wrapped:false};
  const i=list.findIndex(r=>r.id===turnId);
  if(i<0)return {turnId:initFirstAlive(list),wrapped:false};
  for(let j=i+1;j<n;j++)if(!combatantDead(list[j]))return {turnId:list[j].id,wrapped:false};
  for(let j=0;j<=i;j++)if(!combatantDead(list[j]))return {turnId:list[j].id,wrapped:true};
  return {turnId:list[i].id,wrapped:true};
}
function bandOfShare(hp,max){
  const m=num(max),h=num(hp);if(!(m>0))return null;
  if(h>=m)return 0;if(h>m/2)return 1;if(h>m/4)return 2;return 3;
}
/* What a chip's bar shows: a share (you; a party member on Exact with a
   max) coloured by its band, or a band alone, or nothing known (band null). */
function combatantBar(r){
  if(r.kind==="you"){const m=effMaxHP(),h=num(character.hp.cur);return {band:bandOfShare(h,m),share:m>0?Math.max(0,Math.min(1,h/m)):null};}
  if(r.kind==="party"&&r.track==="exact"&&num(r.maxHp)>0)return {band:bandOfShare(r.hp,r.maxHp),share:Math.max(0,Math.min(1,num(r.hp)/num(r.maxHp)))};
  return {band:r.band===4?null:r.band,share:null};
}
/* Your typed d20: the face, 1..20, as the spend box takes 1..die. */
function initRollCheck(raw){
  const s=String(raw==null?"":raw).trim();
  if(!/^\d+$/.test(s))return {ok:false,face:0,why:"Type the number you rolled."};
  const f=parseInt(s,10);
  if(f<1||f>20)return {ok:false,face:f,why:"A d20 rolls 1 to 20."};
  return {ok:true,face:f,why:""};
}
/* "14 + 3 = 17"; with advantage "Rolled 6, 14 → 14 + 3 = 17". */
function initRollLine(faces,mod){
  const hi=Math.max.apply(null,faces),m=num(mod),t=hi+m;
  const w=`${hi} ${m<0?"−":"+"} ${Math.abs(m)} = ${t}`;
  return faces.length>1?`Rolled ${faces.join(", ")} → ${w}`:w;
}
function initModOf(){
  const c=contributions(),dex=Math.floor((abilFinal("dex",c)-10)/2);
  return (character.init===""?dex:num(character.init))+sumFx("init",c)+sumFx("check",c);
}
function youAC(){const c=contributions();return armorAC(c).base+sumFx("ac",c);}
/* you: {name, init}; party: [{id,name,ac,maxHp,init}]; foes: [{name,count,ac,init}] */
function buildCombatants(you,party,foes){
  const rows=[{id:uid(),kind:"you",name:String(you.name||""),init:initInt(you.init),ac:"",track:"",band:null,hp:"",maxHp:"",dead:false,partyId:""}];
  (party||[]).forEach(p=>{const mx=initOpt(p.maxHp);rows.push({id:uid(),kind:"party",name:String(p.name).slice(0,60),init:initInt(p.init),ac:initOpt(p.ac),
    track:mx!==""?"exact":"estimate",band:null,hp:mx,maxHp:mx,dead:false,partyId:String(p.id||"")});});
  (foes||[]).forEach(f=>{
    const name=String(f.name||"").trim().slice(0,56);if(!name)return;
    const n=Math.max(1,Math.min(20,initInt(f.count)||1));
    for(let k=1;k<=n;k++)rows.push({id:uid(),kind:"foe",name:n>1?`${name} ${k}`:name,init:initInt(f.init),ac:initOpt(f.ac),track:"",band:null,hp:"",maxHp:"",dead:false,partyId:""});
  });
  return initSort(rows);
}
```

  Then:
  - Add the fragment to `src/manifest.json` after `"src/js/87-combat.js"`.
  - Change the counts 35 → 36 in `CLAUDE.md` and ADR-001.
  - Add an overview code-map row after `87-combat.js`: `` | `87-initiative.js` | the initiative tracker: party, combatants, turns, bands, the strip and dialogs | [Combat view](features/combat-view.md), [Story & notes](features/story-and-notes.md) | ``
  - Add `` `cleanCombatants()`, `initNextTurn()`, `buildCombatants()` in `87-initiative.js` `` to combat-view.md's **Code:** line.

- [ ] **Step 4: Run the tests.** Run `node src/tests/sheet.js`, then `./build.sh --no-zip && node src/tests/docs.js`. Both should pass.
- [ ] **Step 5: Run the full suite, then commit.**

```bash
./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh
git checkout -- dist/fieldbook.html docs/CHANGELOG.md 2>/dev/null
git add src/js/87-initiative.js src/manifest.json src/js/00-constants.js src/js/71-char-io.js src/js/87-combat.js CLAUDE.md src/docs/ADR-001-source-split.md src/docs/wiki/overview.md src/docs/wiki/features/combat-view.md src/tests/sheet.js
git commit -m "feat(#91): the initiative tracker's fields and pure core

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The Party card on Bio

**Files:**
- Modify:
  - `src/html/30-story.html`: the card goes in the left `.stack`, after the proficiencies card.
  - `src/js/87-notes.js`: `NOTE_SECTIONS` and `EDIT_CARDS`.
  - `src/js/87-initiative.js`: append to it.
  - `src/js/66-coins-hp.js`: `renderAll()` calls `renderParty()`.
  - `src/js/90-boot.js`: the delegated clicks.
- Test:
  - `src/tests/sheet.js`
  - `src/tests/rules-data.js`: the registry and `data-note` counts go 18 → 19. Find every `18` that counts sections with `grep -n "18" src/tests/rules-data.js src/tests/sheet.js | grep -i "section\|data-note\|registry"`.

**Interfaces:**
- Consumes `cleanParty`, `initOpt`.
- Produces:
  - `partyRowsHTML(list)` → string
  - `renderParty()`
  - `openPartyForm(id?)`
  - `savePartyMember(id, name, ac, maxHp)` → `""` on success, or the reason it refused
  - `removePartyMember(id)`

- [ ] **Step 1: Write the failing tests.** Append to `src/tests/sheet.js`. Add `'partyRowsHTML','savePartyMember','removePartyMember','NOTE_SECTIONS','EDIT_CARDS'` to `loadApp`.

```js
// ---------- #91 the Party card
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rp: ctx.renderParty};
  ctx.scheduleSave = () => {}; ctx.renderParty = () => {};
  try {
    X.character = X.blankChar();
    ck('#91 saving a member needs a name', X.savePartyMember('', '  ', '', '') === 'Give them a name.' && X.character.party.length === 0);
    ck('#91 ...and adds one with optional AC and max HP', X.savePartyMember('', 'Thorn', '14', '') === '' && X.character.party.length === 1 &&
       X.character.party[0].ac === 14 && X.character.party[0].maxHp === '', X.character.party);
    const id = X.character.party[0].id;
    X.savePartyMember(id, 'Thorn the Bold', '', '22');
    ck('#91 ...edits in place by id', X.character.party.length === 1 && X.character.party[0].name === 'Thorn the Bold' && X.character.party[0].ac === '' && X.character.party[0].maxHp === 22);
    const h = X.partyRowsHTML([{id: 'q"1', name: '<b>Bree</b>', ac: '', maxHp: 9}]);
    ck('#91 rows escape, show a blank AC as nothing, and carry #97-hideable edit and remove buttons',
       h.includes('&lt;b&gt;Bree&lt;/b&gt;') && !h.includes('<b>Bree') && !/AC\s*—/.test(h) && /class="icon ed" data-partyedit="q&quot;1"/.test(h) && /class="icon danger ed" data-partydel="q&quot;1"/.test(h), h);
    ck('#91 an empty party says how it works', /Add the friends who fight beside you/.test(X.partyRowsHTML([])));
    X.removePartyMember(id);
    ck('#91 removing takes them off the card', X.character.party.length === 0);
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderParty = keep.rp; }
  ck('#91 the Party card is a registered Bio section that never enters the combat view',
     X.NOTE_SECTIONS.some(s => s.k === 'party' && s.tab === 'story' && s.nocv === true) && X.EDIT_CARDS.indexOf('party') >= 0);
  const html = require('./harness').loadHTML();
  ck('#91 the Bio tab carries the card with its list and add button', /<div class="card" data-note="party">[\s\S]*?id="partyAdd"[\s\S]*?id="partyList"/.test(html));
}
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

  In `30-story.html`, after the proficiencies card's closing `</div>`, inside the same `.stack`:

```html
        <div class="card" data-note="party">
          <div class="label">Party <button class="add" type="button" id="partyAdd"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add</button><span class="grow"></span></div>
          <div id="partyList"></div>
          <p class="hint">Joins every fight you start. AC and max HP are optional.</p>
        </div>
```

  In `87-notes.js`:
  - add `{k:"party", tab:"story", title:"Party", nocv:true},` after the `proficiencies` entry;
  - add `"party"` to `EDIT_CARDS`.

  Append to `87-initiative.js`:

```js
/* ---- the Party card (Bio) ---- */
function partyRowsHTML(list){
  if(!list.length)return `<p class="empty">Add the friends who fight beside you. They join every fight you start.</p>`;
  return `<div class="party-list">`+list.map(p=>`<div class="party-row"><span class="party-nm">${esc(p.name)}</span>`+
    (p.ac!==""?`<span class="party-k">AC ${esc(String(p.ac))}</span>`:"")+(p.maxHp!==""?`<span class="party-k">HP ${esc(String(p.maxHp))}</span>`:"")+
    `<button class="icon ed" data-partyedit="${esc(p.id)}" aria-label="${esc("Edit "+p.name)}"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>`+
    `<button class="icon danger ed" data-partydel="${esc(p.id)}" aria-label="${esc("Remove "+p.name)}"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button></div>`).join("")+`</div>`;
}
function renderParty(){const el=document.getElementById("partyList");if(el)el.innerHTML=partyRowsHTML(cleanParty(character.party));}
function savePartyMember(id,name,ac,maxHp){
  const nm=String(name||"").trim().slice(0,60);if(!nm)return "Give them a name.";
  const list=cleanParty(character.party),row={id:id||uid(),name:nm,ac:initOpt(ac),maxHp:initOpt(maxHp)};
  const i=list.findIndex(p=>p.id===id);if(i>=0)list[i]=row;else list.push(row);
  character.party=list;renderParty();scheduleSave();return "";
}
function removePartyMember(id){character.party=cleanParty(character.party).filter(p=>p.id!==id);renderParty();scheduleSave();}
function openPartyForm(id){
  const p=cleanParty(character.party).find(x=>x.id===id)||{id:"",name:"",ac:"",maxHp:""};
  openModal(id?"Edit party member":"Add party member",
    `<div class="field"><label class="f" for="pmName">Name</label><input id="pmName" value="${esc(p.name)}" autocomplete="off"></div>`+
    `<div class="g2"><div class="field"><label class="f" for="pmAC">AC (optional)</label><input id="pmAC" inputmode="numeric" value="${esc(String(p.ac))}"></div>`+
    `<div class="field"><label class="f" for="pmHP">Max HP (optional)</label><input id="pmHP" inputmode="numeric" value="${esc(String(p.maxHp))}"></div></div>`+
    `<p class="hint" id="pmWhy" aria-live="polite"></p><div class="m-actions"><button class="tbtn" id="pmCancel">Cancel</button><button class="tbtn primary" id="pmSave">${id?"Save":"Add"}</button></div>`);
  document.getElementById("pmCancel").addEventListener("click",closeModal);
  document.getElementById("pmSave").addEventListener("click",()=>{
    const why=savePartyMember(id,document.getElementById("pmName").value,document.getElementById("pmAC").value,document.getElementById("pmHP").value);
    if(why){document.getElementById("pmWhy").textContent=why;return;}closeModal();
  });
}
```

  Then:
  - Add `renderParty();` to `renderAll()`, next to `renderChipsAll();`.
  - In the delegated click handler in `90-boot.js`, next to the other `t.closest(...)` lines, add:

```js
    if(t.closest("#partyAdd"))return openPartyForm("");
    if((m=t.closest("[data-partyedit]")))return openPartyForm(m.dataset.partyedit);
    if((m=t.closest("[data-partydel]"))){if(confirm("Remove this party member? Fights already started keep them."))removePartyMember(m.dataset.partydel);return;}
```

  Check the handler declares `m`; it does for `[data-notejump]`.

  Append minimal CSS to `src/css/30-sheet.css` (Bio shares sheet styles):

```css
/* ---- the Party card (#91) ---- */
.party-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dotted var(--hair)}
.party-nm{flex:1;min-width:0;font-weight:700;overflow-wrap:break-word}
.party-k{font-family:var(--head);font-size:11px;color:var(--ink-soft)}
```

  Update the registry and `data-note` counts (18 → 19) in the tests. Each one carries a comment: `// #91: 18 → 19, the Party card`.

- [ ] **Step 4: Run the tests.** Run `node src/tests/sheet.js` and `./build.sh --no-zip && node src/tests/rules-data.js`. Both should pass.
- [ ] **Step 5: Run the full suite, then commit** as `feat(#91): a Party card on the Bio tab`, with explicit paths and the trailer.

---

### Task 3: Roll initiative, and starting a fight

**Files:**
- Modify:
  - `src/js/87-initiative.js`: append to it.
  - `src/js/90-boot.js`: `#cvStart` opens the window instead of `startCombatNow()`.
  - `src/css/50-modal.css`: the window's rows.
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes the Task 1 core, `cleanParty`, `combatStart`, `rollDiceExpr`, `openModal`, `closeModal`, `renderActiveSpells`, `renderCombatChrome`, `scheduleSave`.
- Produces:
  - `initRollHTML(party, midFight)` → string
  - `openInitRoll()`
  - `irState()` → `{faces:number[], set:boolean, adv:boolean}`
  - `irSetTyped(raw)` → `""` or the reason
  - `irRoll()`
  - `startInitFight(you, party, foes)`, which builds the fight and saves it. `you` is `{name, init}`.

- [ ] **Step 1: Write the failing tests.** Add the names above to `loadApp`.

```js
// ---------- #91 Roll initiative and starting a fight
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rc: ctx.renderCombatChrome, ra: ctx.renderActiveSpells, cm: ctx.closeModal};
  ctx.scheduleSave = () => {}; ctx.renderCombatChrome = () => {}; ctx.renderActiveSpells = () => {}; ctx.closeModal = () => {};
  try {
    X.character = X.blankChar(); X.character.name = 'Mira';
    const h = X.initRollHTML([{id: 'p1', name: 'Thorn', ac: 14, maxHp: 22}], false);
    ck('#91 the window lists you with the roll controls, and the party with typed totals',
       /Mira/.test(h) && /id="irRoll"/.test(h) && /id="irTyped"/.test(h) && /id="irApply"/.test(h) && /id="irAdv"/.test(h) && /data-irparty="p1"/.test(h) && /Thorn/.test(h), h);
    ck('#91 ...a foe row and + Add a monster', /data-irfoe/.test(h) && /id="irAddFoe"/.test(h));
    ck('#91 a typed 21 is refused, a 14 kept', X.irSetTyped('21') === 'A d20 rolls 1 to 20.' && X.irState().set === false && X.irSetTyped('14') === '' && X.irState().faces.join() === '14');
    X.startInitFight({name: 'Mira', init: 17}, [{id: 'p1', name: 'Thorn', ac: 14, maxHp: 22, init: 14}], [{name: 'Goblin', count: 2, ac: '', init: 19}]);
    ck('#91 Start: round 1, combat on, sorted, Turns marker on the first living row',
       X.character.combatActive === true && X.num(X.character.combatRound) === 1 && X.character.combatants.map(r => r.name).join() === 'Goblin 1,Goblin 2,Mira,Thorn' &&
       X.character.combatTurn === X.character.combatants[0].id, X.character.combatants.map(r => r.name));
    X.character.combatRound = 4;
    X.startInitFight({name: 'Mira', init: 10}, [], []);
    ck('#91 rolling for a fight already running keeps its round', X.num(X.character.combatRound) === 4 && X.character.combatants.length === 1);
    X.character.initMode = 'rounds'; X.character.combatActive = false;
    X.startInitFight({name: 'Mira', init: 10}, [], []);
    ck('#91 Rounds mode sets no marker', X.character.combatTurn === '');
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderCombatChrome = keep.rc; ctx.renderActiveSpells = keep.ra; ctx.closeModal = keep.cm; }
  const boot = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '90-boot.js'), 'utf8');
  ck('#91 Start combat opens Roll initiative', /closest\("#cvStart"\)\)return openInitRoll\(\)/.test(boot));
}
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** Append to `87-initiative.js`:

```js
/* ---- Roll initiative ----
   Your row copies the hit-die spend box: Roll for me (d20 + your modifier),
   or the d20 you rolled + Apply; Advantage rolls two, keeps the higher.
   Everyone else's total is typed. Opened by Start combat, and by the strip's
   "Roll initiative" when an old save has a fight but no list (midFight). */
let _ir={faces:[],set:false,adv:false};
function irState(){return _ir;}
function irFoeRowHTML(){
  return `<div class="ir-foe" data-irfoe><input data-irf="name" placeholder="Monster" aria-label="Monster name" autocomplete="off">`+
    `<label class="ir-k">× <input data-irf="count" inputmode="numeric" size="2" value="1" aria-label="How many"></label>`+
    `<label class="ir-k">AC <input data-irf="ac" inputmode="numeric" size="2" aria-label="AC guess (optional)"></label>`+
    `<input data-irf="init" inputmode="numeric" size="3" placeholder="Init" aria-label="Initiative"></div>`;
}
function initRollHTML(party,midFight){
  const mod=initModOf();
  return `<p class="hint">${midFight?"Roll for the fight already running.":"Your party and you are in. Add the monsters, then everyone's roll."}</p>`+
    `<div class="ir-you"><b>${esc(character.name||"You")}</b> <span class="ir-k">you · initiative ${esc((mod<0?"−":"+")+Math.abs(mod))}</span>`+
    `<div class="hd-how"><button type="button" class="tbtn primary" id="irRoll">🎲 Roll for me</button> <span>or</span> `+
    `<label>I rolled <input id="irTyped" inputmode="numeric" size="3"></label> <button type="button" class="tbtn" id="irApply">Apply</button> `+
    `<button type="button" class="switch" id="irAdv" role="switch" aria-checked="false" aria-label="Advantage"></button><span class="ir-k">Advantage</span></div>`+
    `<div class="hd-res" id="irRes" aria-live="polite"></div></div>`+
    (party.length?`<div class="ir-party">`+party.map(p=>`<label class="ir-row"><span>${esc(p.name)} <span class="ir-k">party</span></span>`+
      `<input data-irparty="${esc(p.id)}" inputmode="numeric" size="3" aria-label="${esc(p.name+"'s initiative")}"></label>`).join("")+`</div>`:"")+
    `<div id="irFoes">${irFoeRowHTML()}</div><button type="button" class="add" id="irAddFoe">+ Add a monster</button>`+
    `<p class="hint">A blank initiative goes last; you can fill it in later.</p>`+
    `<div class="m-actions"><button class="tbtn" id="irCancel">Cancel</button><button class="tbtn primary" id="irStart">Start ▸</button></div>`;
}
function irPaint(why){
  const r=document.getElementById("irRes");if(!r)return;
  r.textContent=why||(_ir.set?initRollLine(_ir.faces,initModOf()):"");
  if(r.classList)r.classList.toggle("bad",!!why);
}
function irSetTyped(raw){
  const c=initRollCheck(raw);if(!c.ok){_ir.set=false;_ir.faces=[];irPaint(c.why);return c.why;}
  _ir.faces=[c.face];_ir.set=true;irPaint("");return "";
}
function irRoll(){
  const d=()=>rollDiceExpr({dice:[{n:1,sides:20,sign:1}],mod:0}).total;
  _ir.faces=_ir.adv?[d(),d()]:[d()];_ir.set=true;
  const box=document.getElementById("irTyped");if(box)box.value=String(Math.max.apply(null,_ir.faces));
  irPaint("");
}
function startInitFight(you,party,foes){
  if(!inCombat(character))combatStart(character);
  character.combatants=buildCombatants(you,party,foes);
  character.combatTurn=character.initMode==="turns"?initFirstAlive(character.combatants):"";
  renderActiveSpells();renderCombatChrome();scheduleSave();
}
function openInitRoll(){
  const mid=inCombat(character),party=cleanParty(character.party);
  _ir={faces:[],set:false,adv:false};
  openModal("Roll initiative",initRollHTML(party,mid),"",{wide:true});
  const on=(id,ev,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener(ev,fn);};
  on("irRoll","click",irRoll);
  on("irApply","click",()=>irSetTyped(document.getElementById("irTyped").value));
  on("irTyped","keydown",e=>{if(e.key==="Enter"){e.preventDefault();irSetTyped(e.target.value);}});
  on("irAdv","click",e=>{_ir.adv=!_ir.adv;e.currentTarget.classList.toggle("on",_ir.adv);e.currentTarget.setAttribute("aria-checked",_ir.adv?"true":"false");});
  on("irAddFoe","click",()=>{const f=document.getElementById("irFoes");if(f)f.insertAdjacentHTML("beforeend",irFoeRowHTML());});
  on("irCancel","click",closeModal);
  on("irStart","click",()=>{
    const you={name:character.name||"You",init:_ir.set?Math.max.apply(null,_ir.faces)+initModOf():null};
    const party2=party.map(p=>{const i=document.querySelector(`[data-irparty="${CSS.escape(p.id)}"]`);return Object.assign({},p,{init:i?i.value:""});});
    const foes=Array.from(document.querySelectorAll("[data-irfoe]")).map(row=>{const v=k=>{const i=row.querySelector(`[data-irf="${k}"]`);return i?i.value:"";};
      return {name:v("name"),count:v("count"),ac:v("ac"),init:v("init")};});
    closeModal();startInitFight(you,party2,foes);
  });
}
```

  In `90-boot.js`, change `if(t.closest("#cvStart"))return startCombatNow();` to `if(t.closest("#cvStart"))return openInitRoll();`.
  - Keep `startCombatNow` itself, and grep for other callers.
  - If anything still calls it, leave that call alone; it starts a fight with no list.
  - Check for `CSS.escape` in the harness stub. The `document` stub returns `null` for `querySelector`, so `irStart` isn't exercised in tests; the test goes through `startInitFight` directly.

  CSS in `50-modal.css`:

```css
/* ---- Roll initiative (#91) ---- */
.ir-you{padding:8px 0;border-bottom:1px dotted var(--hair)}
.ir-row,.ir-foe{display:flex;align-items:center;gap:8px;min-height:44px;border-bottom:1px dotted var(--hair);flex-wrap:wrap}
.ir-row>span{flex:1;min-width:0}
.ir-foe input[data-irf="name"]{flex:1;min-width:120px}
.ir-k{font-family:var(--head);font-size:11px;color:var(--ink-soft)}
.hd-res.bad{color:var(--brick)}
```

- [ ] **Step 4: Run the tests.** All should pass.
- [ ] **Step 5: Run the full suite, then commit** as `feat(#91): Roll initiative when combat starts`, with the trailer.

---

### Task 4: The strip, Next, the table, and the two switches

**Files:**
- Modify:
  - `src/js/87-initiative.js`: append to it.
  - `src/js/87-combat.js`: `combatHeaderHTML()` appends the strip while in combat.
  - `src/html/70-combat.html`: `#cvInitTable` after `#cvLive`.
  - `src/js/90-boot.js`: the delegated clicks.
  - `src/css/45-combat.css` and `src/css/00-tokens.css`.
- Test:
  - `src/tests/sheet.js`
  - `src/tests/rules-data.js` (CSS)

**Interfaces:**
- Consumes the Task 1 core.
- Produces:
  - `hbBarHTML(bar)` → string
  - `initStripHTML(ch)` → string
  - `initTableHTML(ch)` → string
  - `initNext()`
  - `setInitMode(mode)`
  - `toggleInitRolls()`
  - `renderInitTable()`

- [ ] **Step 1: Write the failing tests.** Add these names to `loadApp`.

```js
// ---------- #91 the strip, Next and the table
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rc: ctx.renderCombatChrome, ar: ctx.advanceRound, live: ctx.setCombatLive, rt: ctx.renderInitTable};
  let rounds = 0, live = '';
  ctx.scheduleSave = () => {}; ctx.renderCombatChrome = () => {}; ctx.renderInitTable = () => {};
  ctx.advanceRound = d => { rounds += d; }; ctx.setCombatLive = t => { live = t; };
  try {
    X.character = X.blankChar(); X.character.name = 'Mira'; X.character.combatActive = true; X.character.combatRound = 1; X.character.hp.max = 30; X.character.hp.cur = 30;
    X.character.combatants = X.buildCombatants({name: 'Mira', init: 17}, [], [{name: '<img onerror=1>', count: 1, ac: 15, init: 19}, {name: 'Wolf', count: 1, ac: '', init: 8}]);
    X.character.combatants[2].band = 4;
    X.character.combatTurn = X.character.combatants[0].id;
    const s = X.initStripHTML(X.character);
    ck('#91 the strip escapes names and marks the actor', s.includes('&lt;img onerror=1&gt;') && !s.includes('<img onerror') && /class="ini-chip now"/.test(s), s);
    ck('#91 ...strikes the dead and shows rolls', /class="ini-chip dead"/.test(s) && />19</.test(s));
    ck('#91 ...a not-set band is a "?" bar; yours is a share', /hb-q/.test(s) && /hb-share/.test(s));
    ck('#91 ...Next and ▾ in Turns mode', /id="cvTurn"/.test(s) && /id="cvInitMore"/.test(s));
    X.character.initShowRolls = false;
    ck('#91 Show rolls off hides the numbers', !/class="ini-n"/.test(X.initStripHTML(X.character)));
    X.character.initShowRolls = true;
    X.initNext();
    ck('#91 Next moves to Mira and announces it', X.character.combatTurn === X.character.combatants[1].id && live === "Mira's turn" && rounds === 0, live);
    X.initNext();
    ck('#91 Next past the end (the Wolf is dead) wraps and advances the round once', X.character.combatTurn === X.character.combatants[0].id && rounds === 1, rounds);
    X.setInitMode('rounds');
    ck('#91 Rounds mode: no marker, no Next', X.character.initMode === 'rounds' && X.character.combatTurn === '' && !/id="cvTurn"/.test(X.initStripHTML(X.character)));
    X.setInitMode('turns');
    ck('#91 back to Turns: the marker on the first living row', X.character.combatTurn === X.character.combatants[0].id);
    const t = X.initTableHTML(X.character);
    ck('#91 the table: a row per combatant, + Add, the mode switch, Show rolls', (t.match(/data-inirow=/g) || []).length === 3 && /id="iniAdd"/.test(t) && /data-inimode="rounds"/.test(t) && /id="iniRolls"/.test(t), t);
    /* Review Focus 4: a fight with no list */
    X.character.combatants = []; X.character.combatTurn = '';
    ck('#91 a fight with no list offers Roll initiative', /id="iniRollNow"/.test(X.initStripHTML(X.character)));
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderCombatChrome = keep.rc; ctx.advanceRound = keep.ar; ctx.setCombatLive = keep.live; ctx.renderInitTable = keep.rt; }
}
```

  In `src/tests/rules-data.js`, add a check on `45-combat.css` and `00-tokens.css`:

```js
{
  const cc = fs.readFileSync(path.join(__dirname, '..', 'css', '45-combat.css'), 'utf8');
  const tk = fs.readFileSync(path.join(__dirname, '..', 'css', '00-tokens.css'), 'utf8');
  const root = tk.slice(tk.indexOf(':root{'), tk.indexOf('}', tk.indexOf(':root{')));
  ck('#91 the band colours are tokens', ['--hb-healthy', '--hb-injured', '--hb-bloodied', '--hb-near', '--hb-empty'].every(t => root.includes(t + ':')));
  ck('#91 strip chips are at least 44px tall', /\.ini-chip\{[^}]*min-height:44px/.test(cc));
}
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** Append to `87-initiative.js`:

```js
/* ---- the strip (in #cvHead, so it sticks with it) and the table ---- */
function hbBarHTML(bar){
  if(bar.share!==null)return `<span class="hb-share" aria-hidden="true"><b class="hb-${esc(String(bar.band===null?0:bar.band))}" style="width:${esc(String(Math.round(bar.share*100)))}%"></b></span>`;
  if(bar.band===null)return `<span class="hb hb-q" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  return `<span class="hb hb-${esc(String(bar.band))}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
}
function combatantHealthText(r){
  const bar=combatantBar(r);
  if(combatantDead(r))return "Dead";
  if(r.kind==="you")return `HP ${num(character.hp.cur)} / ${effMaxHP()}`;
  if(r.kind==="party"&&r.track==="exact"&&num(r.maxHp)>0)return `HP ${num(r.hp)} / ${num(r.maxHp)}`;
  return bar.band===null?"Health not set":HB_NAMES[bar.band];
}
function initStripHTML(ch){
  const list=ch.combatants||[];
  if(!list.length)return `<div class="cv-init"><span class="hint">No initiative yet.</span><span class="grow"></span><button type="button" class="tbtn primary" id="iniRollNow">Roll initiative</button></div>`;
  const turns=ch.initMode==="turns",show=ch.initShowRolls!==false;
  return `<div class="cv-init"><div class="ini-chips">`+list.map(r=>{
    const now=turns&&r.id===ch.combatTurn,dead=combatantDead(r),name=r.kind==="you"?(ch.name||"You"):r.name;
    const lbl=`${name}${r.init!==null?", initiative "+r.init:""}, ${combatantHealthText(r)}${now?", acting":""}`;
    return `<button type="button" class="ini-chip${now?" now":""}${dead?" dead":""}" data-inichip="${esc(r.id)}" aria-label="${esc(lbl)}">`+
      `<span class="ini-top">${show?`<span class="ini-n">${esc(r.init===null?"—":String(r.init))}</span>`:""}<span class="ini-nm">${esc(name)}</span></span>${hbBarHTML(dead?{band:null,share:null}:combatantBar(r))}</button>`;
  }).join("")+`</div>`+(turns?`<button type="button" class="tbtn primary" id="cvTurn" aria-label="Next turn">Next ▸</button>`:"")+
    `<button type="button" class="tbtn" id="cvInitMore" aria-expanded="false" aria-controls="cvInitTable" aria-label="Show the initiative table">▾</button></div>`;
}
function initTableHTML(ch){
  const list=ch.combatants||[],mode=ch.initMode==="rounds"?"rounds":"turns";
  return `<div class="ini-table">`+list.map(r=>{
    const name=r.kind==="you"?(ch.name||"You"):r.name,ac=r.kind==="you"?youAC():r.ac;
    return `<button type="button" class="ini-row${combatantDead(r)?" dead":""}" data-inirow="${esc(r.id)}"><span class="ini-n">${esc(r.init===null?"—":String(r.init))}</span>`+
      `<span class="ini-nm">${esc(name)} <span class="ini-kind">${r.kind==="you"?"you":r.kind==="party"?"party":""}</span></span>`+
      `<span class="ini-hp">${esc(combatantHealthText(r))}</span>${ac!==""?`<span class="ini-ac">AC ${esc(String(ac))}</span>`:""}</button>`;
  }).join("")+`</div><div class="ini-foot"><button type="button" class="add" id="iniAdd">+ Add combatant</button><span class="grow"></span>`+
    `<span class="seg">${[["turns","Turns"],["rounds","Rounds"]].map(([v,l])=>`<button type="button" data-inimode="${esc(v)}" class="${mode===v?"on":""}" aria-pressed="${mode===v?"true":"false"}">${esc(l)}</button>`).join("")}</span>`+
    `<button type="button" class="switch ${ch.initShowRolls!==false?"on":""}" id="iniRolls" role="switch" aria-checked="${ch.initShowRolls!==false?"true":"false"}" aria-label="Show rolls"></button><span class="ini-kind">Show rolls</span></div>`;
}
function renderInitTable(){
  const el=document.getElementById("cvInitTable");if(!el)return;
  const open=el.dataset.open==="1"&&inCombat(character)&&(character.combatants||[]).length>0;
  el.hidden=!open;el.innerHTML=open?initTableHTML(character):"";
}
function initNext(){
  const r=initNextTurn(character.combatants||[],character.combatTurn);
  character.combatTurn=r.turnId;
  if(r.wrapped)advanceRound(1);
  renderCombatChrome();renderInitTable();scheduleSave();
  /* AFTER the repaint: renderCombatHeader() writes "Round N" into the same
     live region, and the turn is the news */
  const a=(character.combatants||[]).find(x=>x.id===r.turnId);
  if(a)setCombatLive(`${a.kind==="you"?(character.name||"You"):a.name}'s turn`);
}
function setInitMode(mode){
  character.initMode=mode==="rounds"?"rounds":"turns";
  character.combatTurn=character.initMode==="turns"?(((character.combatants||[]).some(r=>r.id===character.combatTurn)&&character.combatTurn)||initFirstAlive(character.combatants||[])):"";
  renderCombatChrome();renderInitTable();scheduleSave();
}
function toggleInitRolls(){character.initShowRolls=character.initShowRolls===false;renderCombatChrome();renderInitTable();scheduleSave();}
```

  In `87-combat.js` `combatHeaderHTML(c)`, inside the in-combat return, append `+initStripHTML(c)` as the last part of the string, after the End button. In `45-combat.css`, the `.cv-init` is `flex:0 0 100%`, so it wraps under the row.

  Make sure `renderCombatHeader()` keeps focus by id. Next has id `cvTurn`, so focus stays on it after a repaint. Add `cvTurn:"cvNext"` to its `instead` map.

  In `70-combat.html`, after `<p class="cv-live" …></p>`, add `<div class="cv-init-table" id="cvInitTable" hidden></div>`.

  In `90-boot.js`'s delegated click handler, add:

```js
    if(t.closest("#cvTurn"))return initNext();
    if(t.closest("#iniRollNow"))return openInitRoll();
    if(t.closest("#cvInitMore")){const el=document.getElementById("cvInitTable"),b=t.closest("#cvInitMore");el.dataset.open=el.dataset.open==="1"?"0":"1";
      b.setAttribute("aria-expanded",el.dataset.open==="1"?"true":"false");b.textContent=el.dataset.open==="1"?"▴":"▾";renderInitTable();return;}
    if((m=t.closest("[data-inimode]")))return setInitMode(m.dataset.inimode);
    if(t.closest("#iniRolls"))return toggleInitRolls();
```

  `renderCombatChrome()` should also call `renderInitTable()`, so the table stays current after any change.

  Tokens go in the `:root{…}` block of `00-tokens.css`:
  `--hb-healthy:#2f8a3a; --hb-injured:#c99a15; --hb-bloodied:#d0651e; --hb-near:#b3261e; --hb-empty:color-mix(in srgb,var(--ink-soft) 25%,transparent);`
  If `color-mix` isn't used elsewhere in the file, use `rgba(128,120,100,.28)`.

  CSS in `45-combat.css`, after the `.cv-head` rules:

```css
/* ---- the initiative strip and table (#91) ---- */
.cv-init{flex:0 0 100%;display:flex;align-items:center;gap:6px;margin-top:6px;min-width:0}
.ini-chips{flex:1;min-width:0;display:flex;gap:5px;overflow-x:auto;scrollbar-width:thin;padding-bottom:2px}
.ini-chip{flex:0 0 auto;min-height:44px;min-width:64px;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:4px 8px;
  border:1.5px solid var(--line);border-radius:8px;background:var(--field);color:var(--ink);font-family:var(--head);font-size:12px;font-weight:700;cursor:pointer}
.ini-chip.now{background:var(--accent);border-color:var(--accent);color:var(--paper)}
.ini-chip.dead{opacity:.5}.ini-chip.dead .ini-nm{text-decoration:line-through}
.ini-top{display:flex;gap:5px;align-items:baseline;white-space:nowrap}
.ini-n{font-size:11px;color:var(--ink-soft)}.ini-chip.now .ini-n{color:inherit;opacity:.8}
.hb{display:flex;gap:2px;height:5px}
.hb i{flex:1;border-radius:2px;background:var(--hb-empty)}
.hb-0 i{background:var(--hb-healthy)}
.hb-1 i:nth-child(-n+3){background:var(--hb-injured)}
.hb-2 i:nth-child(-n+2){background:var(--hb-bloodied)}
.hb-3 i:nth-child(1){background:var(--hb-near)}
.hb-q{position:relative}
.hb-share{display:block;height:5px;border-radius:2px;background:var(--hb-empty);overflow:hidden}
.hb-share b{display:block;height:100%}
.hb-share .hb-0{background:var(--hb-healthy)}.hb-share .hb-1{background:var(--hb-injured)}.hb-share .hb-2{background:var(--hb-bloodied)}.hb-share .hb-3{background:var(--hb-near)}
.cv-init-table{background:var(--panel);border:1.5px solid var(--line);border-radius:8px;padding:6px 8px;margin:0 0 8px}
.ini-table{display:flex;flex-direction:column}
.ini-row{display:flex;align-items:center;gap:8px;min-height:44px;padding:4px 2px;border:0;border-bottom:1px dotted var(--hair);background:none;color:var(--ink);text-align:left;font:inherit;cursor:pointer}
.ini-row .ini-nm{flex:1;min-width:0;font-weight:700}
.ini-row.dead .ini-nm{text-decoration:line-through;color:var(--ink-soft)}
.ini-kind,.ini-ac,.ini-hp{font-family:var(--head);font-size:11px;color:var(--ink-soft)}
.ini-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:6px}
```

- [ ] **Step 4: Run the tests.** All should pass.
- [ ] **Step 5: Drive it once and take a screenshot.**
  - Build, then open the worktree's `dist/fieldbook.html` with the project's Playwright MCP.
  - Call `newCharacter('QA','dnd')`, open the combat view (the swords), press Start combat, and fill the Roll initiative window: Roll for me, plus a Goblin × 2 at 12.
  - Press Start, then press Next three times.
  - Save one screenshot at 1280 to `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/91-t4-strip.png`.
  - Check the console.
- [ ] **Step 6: Run the full suite, then commit** as `feat(#91): the initiative strip, Next, and the table`, with the trailer.

---

### Task 5: The combatant dialog, adding mid-fight, removing, ties

**Files:**
- Modify:
  - `src/js/87-initiative.js`: append to it.
  - `src/js/90-boot.js`: chips and rows open the dialog; `#iniAdd` opens the add form.
  - `src/css/50-modal.css`: the dialog.
- Test:
  - `src/tests/sheet.js`
  - `src/tests/rules-data.js` (the 44px CSS check)

**Interfaces:**
- Consumes the Tasks 1 and 4 functions.
- Produces:
  - `combatantDialogHTML(r, ch)` → string
  - `openCombatant(id)`
  - `setCombatant(id, patch)`, which applies a patch, re-sorts when `init` changed, and keeps the actor
  - `removeCombatant(id)`
  - `moveCombatant(id, dir)` → boolean, which swaps only with a tied neighbour
  - `addCombatant(name, init, ac)` → `""` or the reason it refused
  - `openAddCombatant()`

- [ ] **Step 1: Write the failing tests.** Add these names to `loadApp`.

```js
// ---------- #91 the combatant dialog and editing
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rc: ctx.renderCombatChrome, rt: ctx.renderInitTable, cm: ctx.closeModal};
  ctx.scheduleSave = () => {}; ctx.renderCombatChrome = () => {}; ctx.renderInitTable = () => {}; ctx.closeModal = () => {};
  try {
    X.character = X.blankChar(); X.character.combatActive = true; X.character.combatRound = 1;
    X.character.combatants = X.buildCombatants({name: 'Mira', init: 12}, [{id: 'p1', name: 'Thorn', ac: '', maxHp: 22, init: 12}], [{name: 'Goblin', count: 1, ac: '', init: 15}]);
    const [gob, mira, thorn] = X.character.combatants;
    X.character.combatTurn = gob.id;
    const foeD = X.combatantDialogHTML(gob, X.character);
    ck('#91 a foe\'s dialog: five band buttons with the DM\'s words, initiative, optional AC, Remove',
       (foeD.match(/data-cband="[0-4]"/g) || []).length === 5 && /barely hurt/.test(foeD) && /id="cdInit"/.test(foeD) && /id="cdAC"/.test(foeD) && /id="cdRemove"/.test(foeD), foeD);
    const pD = X.combatantDialogHTML(thorn, X.character);
    ck('#91 a party member\'s dialog: Exact/Estimate, the HP stepper on Exact, Dead, Remove',
       /data-ctrack="exact"/.test(pD) && /data-ctrack="estimate"/.test(pD) && /id="cdHp"/.test(pD) && /id="cdDead"/.test(pD) && /id="cdRemove"/.test(pD) && !/data-cband/.test(pD), pD);
    const yD = X.combatantDialogHTML(mira, X.character);
    ck('#91 your dialog: initiative only, no Remove, no Dead', /id="cdInit"/.test(yD) && !/id="cdRemove"/.test(yD) && !/id="cdDead"/.test(yD) && /Vitals card/.test(yD));
    ck('#91 a tie shows Act earlier / Act later', /data-cmove="-1"/.test(X.combatantDialogHTML(X.character.combatants[2], X.character)) || /data-cmove="1"/.test(X.combatantDialogHTML(mira, X.character)));

    X.setCombatant(gob.id, {band: 2});
    ck('#91 setting a band', X.character.combatants.find(r => r.id === gob.id).band === 2);
    X.setCombatant(thorn.id, {track: 'estimate'});
    ck('#91 flipping a party member to Estimate', X.character.combatants.find(r => r.id === thorn.id).track === 'estimate');
    X.setCombatant(thorn.id, {hp: 30});
    ck('#91 an exact HP is clamped to 0..max', X.character.combatants.find(r => r.id === thorn.id).hp === 22);

    /* Review Focus 5: ties */
    const order = () => X.character.combatants.map(r => r.name || 'Mira').join();
    ck('#91 test setup: Mira and Thorn tied at 12', order() === 'Goblin,Mira,Thorn', order());
    ck('#91 Act later swaps tied neighbours', X.moveCombatant(mira.id, 1) === true && order() === 'Goblin,Thorn,Mira', order());
    ck('#91 ...but never past a different roll', X.moveCombatant(X.character.combatants[1].id, -1) === false && order() === 'Goblin,Thorn,Mira', order());
    X.setCombatant(gob.id, {init: 5});
    ck('#91 a changed initiative re-sorts and keeps the actor', order() === 'Thorn,Mira,Goblin' && X.character.combatTurn === gob.id, order());

    /* Review Focus 1: remove the actor */
    X.removeCombatant(gob.id);
    ck('#91 removing the actor moves the marker to the next living row', X.character.combatants.length === 2 && X.character.combatTurn === X.character.combatants[0].id);
    ck('#91 you cannot be removed', (X.removeCombatant(mira.id), X.character.combatants.some(r => r.kind === 'you')));

    ck('#91 adding mid-fight needs a name', X.addCombatant('', '10', '') === 'Give it a name.');
    X.addCombatant('Ogre', '20', '11');
    ck('#91 ...and slots it in by initiative', X.character.combatants[0].name === 'Ogre' && X.character.combatants[0].ac === 11 && X.character.combatants[0].kind === 'foe', order());
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderCombatChrome = keep.rc; ctx.renderInitTable = keep.rt; ctx.closeModal = keep.cm; }
}
```

  In `rules-data.js`:

```js
{
  const mc = fs.readFileSync(path.join(__dirname, '..', 'css', '50-modal.css'), 'utf8');
  ck('#91 the combatant dialog\'s band buttons are 48px and its steppers 44px', /\.cd-band\{[^}]*min-height:48px/.test(mc) && /\.cd-pm\{[^}]*min-(?:width|height):44px/.test(mc));
}
```

- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** Append to `87-initiative.js`:

```js
/* ---- one combatant's dialog: big targets (Mike: bands are too small to tap
   on a phone). Foe: band buttons. Party: Exact HP / Estimate, Dead. You:
   initiative only. Ties break here with Act earlier / Act later. */
function initTie(list,i,dir){const j=i+dir;return j>=0&&j<list.length&&list[j].init===list[i].init;}
function combatantDialogHTML(r,ch){
  const list=ch.combatants||[],i=list.findIndex(x=>x.id===r.id);
  const bands=n=>`<div class="cd-lbl">How hurt?</div>`+[0,1,2,3,4].slice(0,n).map(b=>`<button type="button" class="cd-band${r.band===b?" on":""}" data-cband="${esc(String(b))}">`+
    `${hbBarHTML({band:b===4?null:b,share:null})}<span>${esc(HB_NAMES[b])}<small>${esc(HB_SAYS[b])}</small></span></button>`).join("");
  const fields=`<div class="cd-two"><label class="cd-fld"><span class="cd-k">Initiative</span><input id="cdInit" inputmode="numeric" value="${esc(r.init===null?"":String(r.init))}"></label>`+
    (r.kind==="you"?"":`<label class="cd-fld"><span class="cd-k">${r.kind==="foe"?"AC guess":"AC"} (optional)</span><input id="cdAC" inputmode="numeric" value="${esc(String(r.ac))}"></label>`)+`</div>`;
  const ties=(initTie(list,i,-1)?`<button type="button" class="tbtn" data-cmove="-1">Act earlier</button>`:"")+(initTie(list,i,1)?`<button type="button" class="tbtn" data-cmove="1">Act later</button>`:"");
  let body="";
  if(r.kind==="foe")body=bands(5);
  else if(r.kind==="party"){
    const ex=r.track==="exact";
    body=`<div class="seg cd-track">${[["exact","Exact HP"],["estimate","Estimate"]].map(([v,l])=>`<button type="button" data-ctrack="${esc(v)}" class="${r.track===v?"on":""}" aria-pressed="${r.track===v?"true":"false"}">${esc(l)}</button>`).join("")}</div>`+
      (ex?`<div class="cd-lbl">Hit points</div><div class="cd-step"><button type="button" class="cd-pm" data-chp="-1" aria-label="One less">−</button>`+
        `<input id="cdHp" inputmode="numeric" value="${esc(String(r.hp))}" aria-label="Current HP"><span class="cd-k">/ ${esc(r.maxHp===""?"?":String(r.maxHp))}</span>`+
        `<button type="button" class="cd-pm" data-chp="1" aria-label="One more">+</button></div>`:bands(4))+
      `<button type="button" class="cd-toggle" id="cdDead" role="switch" aria-checked="${r.dead?"true":"false"}"><span>Dead</span><span class="switch ${r.dead?"on":""}"></span></button>`;
  }
  else body=`<p class="hint">HP ${esc(String(num(character.hp.cur)))} / ${esc(String(effMaxHP()))} and AC ${esc(String(youAC()))}, from your sheet. Your HP changes on the Vitals card.</p>`;
  return `<div class="cd">${body}${fields}${ties?`<div class="cd-ties">${ties}</div>`:""}`+
    `<div class="m-actions">${r.kind==="you"?"":`<button type="button" class="tbtn danger" id="cdRemove">Remove</button>`}<span class="grow"></span><button type="button" class="tbtn primary" id="cdDone">Done</button></div></div>`;
}
function setCombatant(id,patch){
  const list=character.combatants||[],r=list.find(x=>x.id===id);if(!r)return;
  if("band" in patch)r.band=(Number.isInteger(patch.band)&&patch.band>=0&&patch.band<=4)?patch.band:null;
  if("track" in patch&&r.kind==="party")r.track=patch.track==="estimate"?"estimate":"exact";
  if("hp" in patch&&r.kind==="party"){const h=initOpt(patch.hp);r.hp=h===""?"":(num(r.maxHp)>0?Math.min(h,num(r.maxHp)):h);}
  if("dead" in patch&&r.kind==="party")r.dead=patch.dead===true;
  if("ac" in patch&&r.kind!=="you")r.ac=initOpt(patch.ac);
  if("init" in patch){r.init=initInt(patch.init);character.combatants=initSort(list);}
  if(character.initMode==="turns"&&!(character.combatants||[]).some(x=>x.id===character.combatTurn&&!combatantDead(x)))
    character.combatTurn=initNextTurn(character.combatants,character.combatTurn).turnId||initFirstAlive(character.combatants);
  renderCombatChrome();renderInitTable();scheduleSave();
}
function removeCombatant(id){
  const list=character.combatants||[],r=list.find(x=>x.id===id);if(!r||r.kind==="you")return;
  if(character.combatTurn===id)character.combatTurn=initNextTurn(list,id).turnId;
  character.combatants=list.filter(x=>x.id!==id);
  if(character.combatTurn===id)character.combatTurn=initFirstAlive(character.combatants);
  renderCombatChrome();renderInitTable();scheduleSave();
}
function moveCombatant(id,dir){
  const list=character.combatants||[],i=list.findIndex(x=>x.id===id);
  if(i<0||!initTie(list,i,dir))return false;
  const j=i+dir;[list[i],list[j]]=[list[j],list[i]];
  renderCombatChrome();renderInitTable();scheduleSave();return true;
}
function addCombatant(name,init,ac){
  const nm=String(name||"").trim().slice(0,60);if(!nm)return "Give it a name.";
  const row=buildCombatants({name:""},[],[{name:nm,count:1,ac,init}]).find(r=>r.kind==="foe");
  character.combatants=initSort((character.combatants||[]).concat([row]));
  if(character.initMode==="turns"&&!character.combatTurn)character.combatTurn=initFirstAlive(character.combatants);
  renderCombatChrome();renderInitTable();scheduleSave();return "";
}
function openCombatant(id){
  const r=(character.combatants||[]).find(x=>x.id===id);if(!r)return;
  openModal(r.kind==="you"?(character.name||"You"):r.name,combatantDialogHTML(r,character));
  const body=document.getElementById("mBody");if(!body)return;
  const reopen=()=>openCombatant(id);
  body.addEventListener("click",e=>{
    const t=e.target;let m;
    if((m=t.closest("[data-cband]"))){setCombatant(id,{band:num(m.dataset.cband)});closeModal();return;}
    if((m=t.closest("[data-ctrack]"))){setCombatant(id,{track:m.dataset.ctrack});reopen();return;}
    if((m=t.closest("[data-chp]"))){const x=(character.combatants||[]).find(z=>z.id===id);setCombatant(id,{hp:Math.max(0,num(x&&x.hp)+num(m.dataset.chp))});reopen();return;}
    if(t.closest("#cdDead")){const x=(character.combatants||[]).find(z=>z.id===id);setCombatant(id,{dead:!(x&&x.dead)});reopen();return;}
    if((m=t.closest("[data-cmove]"))){moveCombatant(id,num(m.dataset.cmove));reopen();return;}
    if(t.closest("#cdRemove")){if(confirm("Remove them from this fight?")){removeCombatant(id);closeModal();}return;}
    if(t.closest("#cdDone")){closeModal();return;}
  });
  const ch=(elId,key)=>{const el=document.getElementById(elId);if(el)el.addEventListener("change",()=>setCombatant(id,{[key]:el.value}));};
  ch("cdInit","init");ch("cdAC","ac");ch("cdHp","hp");
}
function openAddCombatant(){
  openModal("Add combatant",`<div class="field"><label class="f" for="acName">Name</label><input id="acName" autocomplete="off"></div>`+
    `<div class="g2"><div class="field"><label class="f" for="acInit">Initiative</label><input id="acInit" inputmode="numeric"></div>`+
    `<div class="field"><label class="f" for="acAC">AC (optional)</label><input id="acAC" inputmode="numeric"></div></div>`+
    `<p class="hint" id="acWhy" aria-live="polite"></p><div class="m-actions"><button class="tbtn" id="acCancel">Cancel</button><button class="tbtn primary" id="acSave">Add</button></div>`);
  document.getElementById("acCancel").addEventListener("click",closeModal);
  document.getElementById("acSave").addEventListener("click",()=>{
    const why=addCombatant(document.getElementById("acName").value,document.getElementById("acInit").value,document.getElementById("acAC").value);
    if(why){document.getElementById("acWhy").textContent=why;return;}closeModal();
  });
}
```

  In the `90-boot.js` delegated handler, add:

```js
    if((m=t.closest("[data-inichip]")))return openCombatant(m.dataset.inichip);
    if((m=t.closest("[data-inirow]")))return openCombatant(m.dataset.inirow);
    if(t.closest("#iniAdd"))return openAddCombatant();
```

  The combatant dialog's own clicks are handled on `#mBody` inside `openCombatant`. The global handler must not double-handle them, and none of the dialog's attributes (`data-cband`, `data-ctrack`, `data-chp`, `data-cmove`, `cdDead`, `cdRemove`, `cdDone`) match anything in the global handler.

  CSS in `50-modal.css`:

```css
/* ---- the combatant dialog (#91): every target ≥44px ---- */
.cd-lbl{font-family:var(--head);font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-soft);margin:10px 0 6px}
.cd-band{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:0 12px;margin-bottom:6px;border:1.5px solid var(--line);border-radius:8px;
  background:var(--field);color:var(--ink);text-align:left;font:inherit;font-weight:700;cursor:pointer}
.cd-band.on{border:2.5px solid var(--accent)}
.cd-band .hb{width:52px;flex:0 0 52px;height:8px}
.cd-band small{display:block;font-weight:400;font-size:12px;color:var(--ink-soft)}
.cd-step{display:flex;align-items:center;gap:8px}
.cd-step input{width:64px;text-align:center;font-size:18px;font-weight:700}
.cd-pm{min-width:44px;min-height:44px;border:1.5px solid var(--line);border-radius:8px;background:var(--field);color:var(--ink);font-size:20px;font-weight:700;cursor:pointer}
.cd-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:48px;margin-top:8px;padding:0 12px;border:1.5px solid var(--line);
  border-radius:8px;background:var(--field);color:var(--ink);font:inherit;font-weight:700;cursor:pointer}
.cd-two{display:flex;gap:8px;margin-top:10px}
.cd-fld{flex:1;display:flex;flex-direction:column;gap:2px}
.cd-fld input{min-height:44px;font-size:16px}
.cd-k{font-family:var(--head);font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-soft)}
.cd-track{margin:4px 0}
.cd-ties{display:flex;gap:8px;margin-top:8px}
.cd-ties .tbtn,.cd .m-actions .tbtn{min-height:44px}
```

- [ ] **Step 4: Run the tests.** All should pass.
- [ ] **Step 5: Drive it once and take a screenshot.**
  - Tap a foe chip, set Bloodied, and check that its bar changes.
  - Open a party member's dialog, flip Estimate, then flip back to Exact.
  - Use − and + on the HP.
  - Mark the party member Dead and check that Next skips them.
  - Add an Ogre mid-fight.
  - Remove the actor.
  - Take one screenshot of a foe's dialog at 390 wide to `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/91-t5-dialog.png`.
- [ ] **Step 6: Run the full suite, then commit** as `feat(#91): a dialog per combatant; add, remove and ties`, with the trailer.

---

### Task 6: Browser QA, docs, release notes

**Files:**
- The wiki pages in spec §9.
- `src/docs/_claude/WIRING-LEDGER.md`
- `src/docs/UNRELEASED.md`
- The spec's As built.
- The #91 row in `src/docs/wiki/roadmap/1.9.0.md`.

CSS changes here are for tuning only. A JS bug found here is a finding for the controller, not something to fix in this task.

- [ ] **Step 1: Before shots** from main's build, `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`: the combat view in a fight at 1280 and at 390, and the Bio tab. Save them as `.claude/qa/91-before-*.png`.
- [ ] **Step 2: After shots and driven checks** on the worktree's build, saved as `91-after-*.png`. Drive each of these:
  - (a) Add two party members on Bio, one with a max HP and one without.
  - (b) Start combat:
    - Roll for me, with Advantage on and off;
    - a typed 21 (refused, with its message) and a typed 14 + Apply;
    - a Goblin × 2 and a Goblin boss with no AC.
  - (c) The strip at 1280 and at 390, scrolling sideways, with the bars and with Show rolls off.
  - (d) Next through a wrap: the round advances once and an active spell ticks.
  - (e) The foe dialog: set each band. The party dialog: Exact ↔ Estimate, HP − and +, a typed HP over max (clamped), and Dead.
  - (f) Turns ↔ Rounds.
  - (g) Add an Ogre mid-fight; remove the actor.
  - (h) Reload mid-fight: everything restores.
  - (i) End combat: the strip is gone.
  - (j) Both skins at 1280, and dark mode once.
  - (k) The console is clean.

  Report every shot, and say what was driven and what was not.
- [ ] **Step 3: Docs.**
  - Append `## Initiative tracker (#91, <today>)` to the ledger. It is append-only.
  - Rewrite the spec §9 pages, each with a History line citing that L-number:
    - combat-view
    - story-and-notes
    - character-model
    - sections-and-layout
    - theming-and-icons
    - overview
  - Add Decisions rows for spec §2 on the pages that own them, plus their register lines in `wiki/decisions.md`.
  - Write the spec's As built. It records every `Ruling:` and `minor (deferred)` line in the controller's progress.md, and the plan-level tie choice (Act earlier / later in the dialog, not a drag).
  - Mark the 1.9.0 row built.
  - Add the two spec §9 bullets to `UNRELEASED.md` under `## Pending`.
- [ ] **Step 4: Run the full suite.** It must pass. Then restore `dist/fieldbook.html` and `docs/CHANGELOG.md`.
- [ ] **Step 5: Commit** the docs as `docs(#91): …` and any CSS tuning as `style(#91): …`, each with the trailer.
