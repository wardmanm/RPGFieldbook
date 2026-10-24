# Level-up Fanfare: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levelling up plays a short animation: a rune circle, the level ring ticking up, a flash and
a LEVEL N banner. Then a card lists everything the level gave, with the hit-point roll on the card.
Along the way, Paladin and Ranger spell slots move to the 2024 rounding rule (#101).

**Architecture:**
- **One new fragment, `src/js/57-levelup.js`**, between `56-class.js` and `58-choices.js`. It holds:
  - the snapshot and the gains (pure, Task 2);
  - the card, its HP step and the flow (Task 3);
  - the animation (Task 4).
- **The level is applied exactly as today.** `doLevelUp()` and `addClass()` (second class only)
  snapshot the sheet before and after, then call `openLevelUp(info)` instead of `runChoices()`. The
  card's Done or Continue commits the HP through the existing `commitHPChoice()`, then calls the
  existing `runChoices(cls, choices, [], pending)`, which with nothing to choose falls through to
  `runExtraChoices(pending)` as it always has.
- **Character creation keeps the choice window's `{type:"hp"}` block.** That is the first class,
  added above level 1. Only level-ups and second classes stop sending one.

**Tech Stack:**
- Plain ES2020 concatenated into one `<script>`, with no modules.
- CSS keyframes and inline SVG, with no library.
- Node suites through `src/tests/harness.js`.
- The project's Playwright MCP (`mcp__playwright__*`) for driven checks.

**Spec:** `src/docs/specs/2026-10-24-level-up-fanfare-design.md`. Read it first; this plan argues
from it.
**Mockups:** `.superpowers/brainstorm/96071-1792852951/content/`. The animation is panel F of
`levelup-anim-v5.html`; the card is panel A of `levelup-card.html`. Open them in a browser; they
are the visual target.

**Worktree:** `.claude/worktrees/101`, branch `issue/101-level-up-fanfare`. From the repo root, run
`./scripts/wt.sh add 101 level-up-fanfare`, then run every command below from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/101`.

## Global Constraints

**The build**
- One shipped file, built by concatenation: no `import`/`export`, no `type="module"`, no runtime
  dependency, no network.
- This branch adds ONE fragment, `src/js/57-levelup.js`, listed in `src/manifest.json` immediately
  after `"src/js/56-class.js"`. That moves the counts in `CLAUDE.md` (`js/*.js  34 fragments`) and
  `src/docs/ADR-001-source-split.md` (`js/ (34 fragments)`) to **35**. The overview's code map lists
  the fragment, and a wiki topic page cites it. The `docs` suite checks all three.
- Top-level `const`s in `57-levelup.js` are literals. Functions in it may call `58-choices.js`
  functions (`choiceNoteText`, `runChoices`) at runtime, never at load.
- **Byte hygiene:** LF line endings, a final newline, no BOM.
- **Before `rules-data.js` (or `run.sh`), build:** `./build.sh --no-zip`.

**Git and release**
- Branch commits carry source and docs only; never `git add` `dist/fieldbook.html` or
  `docs/CHANGELOG.md`. Always `git add` explicit paths.
- Never touch `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array. No file under `data/` changes.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Character data**
- No new character field. `_lu` (the open level-up) and `_luFx` (the playing animation) are module
  state and are never saved.

**Markup safety**
- Every `${…}` inside a quoted HTML attribute value is `esc(…)` of the whole expression, or a ternary
  that can only yield literals. `rules-data.js` scans all of `src/js`, inline `style="…"` included.
- A modal's title is plain text, never `esc()`'d (80-modal-forms.js sets it as textContent).
- Text in the card body (feature names, descriptions, class names, notes) is `esc()`'d where it is
  rendered.

**CSS**
- Theme tokens only. The new tokens `--lu-night`, `--lu-night-2`, `--lu-glow` and `--lu-spark` go in
  `src/css/00-tokens.css`. The Humblewood values go in the `:root` block (Humblewood is the default
  skin), and the classic values in `html[data-skin="classic"]{…}`. Light and dark share them, because
  the animation is a night scene, not a surface.
- Media queries come after their base rules. The animation layer's z-index is **75**: above the save
  warning (60) and the tab bar (40), below the modal (80).

**The test harness**
- A suite names what it reads in its `loadApp([...])` list; a missing name gives `LOAD FAIL`. Add a
  name only if it is absent.
- `ctx.name` reaches an unlisted function, and assigning `ctx.name=` replaces one (a spy).
- Top-level `let` state is NOT readable through `X`, so read `_lu` through `luState()`.
- `window.matchMedia` returns `{matches:false}`, and `setTimeout` is a no-op, so the animation never
  ends on its own in a test. Call `luSkip()`.
- `state.confirm` answers `confirm()`, and `state.lastConfirm` holds the message.
- Run one suite with `node src/tests/<suite>.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.
- Run everything with
  `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`.
- Afterwards, `git checkout -- dist/fieldbook.html docs/CHANGELOG.md` if they show as modified.

**Screenshots** go through the project's Playwright MCP only (`mcp__playwright__*`, loaded via
ToolSearch). Never use the plugin's. Pass ABSOLUTE filenames under
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/`.

## Review Focus

Five inputs the spec implies but no happy-path test exercises. Each line names the test that pins it,
in the task that owns the code.

1. **Closing the card on a level that has a choice.** The choice window must still open, so a choice
   the player never saw does not vanish. → Task 3, "closing early still opens the choices".
2. **Pressing Level up again while the animation plays** (a double tap on "Level up ready"). The
   class must level once, not twice. → Task 4, "a second level-up while the scene plays does
   nothing".
3. **A typed HP that isn't a clean roll** (` 7 `, `07`, `-3`, `3.5`, `0`, `11` on a d10, empty).
   Only the in-range whole numbers set HP, and nothing is applied otherwise. → Task 2, the
   `luHPCheck` table.
4. **Hostile or messy feature text** (`<img onerror>`, `[Table: X]`, `**bold**`, a 400-character
   first sentence, no full stop at all). It shows as escaped plain text, cut to 160 characters.
   → Task 2 (`luSummary`) and Task 3 (the card's escaping).
5. **Two classes granting the same resource name** (Channel Divinity from Cleric AND Paladin). These
   are two rows keyed by the resource's own `key`, never merged into one count. → Task 2, "two
   classes' Channel Divinity stay apart".

---

### Task 1: Multiclassing: half-casters round up, and the prerequisite note

**Files:**
- Modify: `src/js/00-constants.js` (`casterLevel()`, around line 334)
- Modify: `src/js/56-class.js` (`multiclassNote()`, around line 177)
- Test: `src/tests/char-update.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `casterLevel()` (half-casters `Math.ceil(L/2)`); `multiclassNote(d)`, whose text ends
  with the sentence `Multiclassing needs a score of 13 or more in the primary ability of your
  current class and the new one.` whenever `d` is truthy.

- [ ] **Step 1: Write the failing tests.** Append this block to `src/tests/char-update.js`, before its
  final `ck.done()`. Add `'casterLevel'` and `'autoSlots'` to its `loadApp([...])` list if absent.

```js
// ---------- #101 multiclassing: half-casters round UP (SRD 5.2.1 p.26), for every ruleset
{
  const cl=list=>{X.character.classes=list;X.character.level=list.reduce((a,c)=>a+c.level,0);return X.casterLevel();};
  ck('#101 a Paladin 1 counts as caster level 1 (2024: two 1st-level slots)', cl([{name:'Paladin',level:1}])===1, cl([{name:'Paladin',level:1}]));
  ck('#101 a Ranger 3 counts as 2', cl([{name:'Ranger',level:3}])===2, cl([{name:'Ranger',level:3}]));
  ck('#101 a Wizard 3 / Paladin 3 counts as 5', cl([{name:'Wizard',level:3},{name:'Paladin',level:3}])===5,
     cl([{name:'Wizard',level:3},{name:'Paladin',level:3}]));
  ck('#101 a Ranger 1 / Paladin 1 counts as 2 (each class rounds up)', cl([{name:'Ranger',level:1},{name:'Paladin',level:1}])===2,
     cl([{name:'Ranger',level:1},{name:'Paladin',level:1}]));
  ck('#101 an Eldritch Knight 3 still counts a third, rounded down', cl([{name:'Fighter',level:3,subclass:'Eldritch Knight'}])===1,
     cl([{name:'Fighter',level:3,subclass:'Eldritch Knight'}]));
  ck('#101 an Eldritch Knight 5 is still 1', cl([{name:'Fighter',level:5,subclass:'Eldritch Knight'}])===1);
  X.character.classes=[{name:'Paladin',level:1}];X.character.level=1;X.autoSlots();
  ck('#101 ...so a Paladin 1 gets its two 1st-level slots', X.num(X.character.slots[1].total)===2, X.character.slots[1]);
  X.character.classes=[{name:'Warlock',level:3}];X.character.level=3;X.autoSlots();
  ck('#101 Warlock pact slots are untouched (two 2nd-level slots at 3)', X.num(X.character.slots[2].total)===2&&X.num(X.character.slots[1].total)===0,
     [X.character.slots[1],X.character.slots[2]]);
  const note=X.multiclassNote({name:'Druid',multiclass:{}});
  ck('#101 the multiclass note states the 13+ prerequisite', /13 or more in the primary ability of your current class and the new one\./.test(note), note);
  ck('#101 ...and a custom class (no definition) still has no note', X.multiclassNote(null)==='');
}
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node src/tests/char-update.js | grep -E "^FAIL|LOAD FAIL"`
  Expected: FAIL on "a Paladin 1 counts as caster level 1", "a Ranger 3 counts as 2", "Wizard 3 /
  Paladin 3", "Ranger 1 / Paladin 1", "two 1st-level slots" and "states the 13+ prerequisite".

- [ ] **Step 3: Implement.** In `src/js/00-constants.js`, `casterLevel()`, replace
  `else if(k==="half")lvl+=Math.floor(L/2);` with:

```js
else if(k==="half")lvl+=Math.ceil(L/2);   /* 2024 / SRD 5.2.1: "half your levels (round up)", every ruleset (#101) */
```

  In `src/js/56-class.js`, `multiclassNote(d)`: keep the early `if(!d)return "";`. Append the
  sentence to EVERY non-empty return. The function has two returns after the guard. Make both end
  with `+" "+MC_PREREQ`, and add this constant directly above the function:

```js
/* SRD 5.2.1 p.25. Said, never checked: the packs don't carry each class's
   primary ability, and blocking needs that data (#101, out of scope). */
const MC_PREREQ="Multiclassing needs a score of 13 or more in the primary ability of your current class and the new one.";
```

- [ ] **Step 4: Run the tests to verify they pass.**
  Run: `node src/tests/char-update.js | grep -E "^FAIL|ALL PASSED|LOAD FAIL"`
  Expected: `ALL PASSED`. If an older test pinned `multiclassNote`'s exact full text (grep for
  `multiclassNote` in `src/tests`), update its expected string to end with the new sentence, and
  never loosen it to a partial match.

- [ ] **Step 5: Run the full suite, then commit.**

```bash
./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh
git checkout -- dist/fieldbook.html docs/CHANGELOG.md 2>/dev/null
git add src/js/00-constants.js src/js/56-class.js src/tests/char-update.js
git commit -m "fix(#101): half-casters round up for spell slots; the multiclass note states the 13+ prerequisite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: What a level gave: the snapshot, the gains, and the HP check (pure)

**Files:**
- Create: `src/js/57-levelup.js`
- Modify: `src/manifest.json` (add `"src/js/57-levelup.js"` right after `"src/js/56-class.js"`)
- Modify: `CLAUDE.md` (`34 fragments` → `35 fragments`), `src/docs/ADR-001-source-split.md`
  (`js/ (34 fragments)` → `js/ (35 fragments)`)
- Modify: `src/docs/wiki/overview.md`: a code-map row after the `56-class.js` row:
  ``| `57-levelup.js` | the level-up fanfare: what a level gave (`levelSnapshot()`, `levelGains()`), the level card and its HP step, the animation | [Character building](features/character-building.md) |``
- Modify: `src/docs/wiki/features/character-building.md`: in its code list (the paragraph naming
  `grantLanguages()`, `dropLanguages()` in `41-chips.js`), add ``· `levelSnapshot()`,
  `levelGains()`, `luHPCheck()` in `57-levelup.js` ``
- Test: `src/tests/char-update.js`

**Interfaces:**
- Consumes: `character`, `num`, `totalLevel()` (50-classrace.js), `pbValue(contributions())`
  (00-constants.js), `choiceNoteText(n)` (58-choices.js, at runtime).
- Produces:
  - `levelSnapshot()` → `{level:number, feats:[{id,name,desc,cls,sub}], slots:number[9], res:{[key]:{name,max:number,die:string}}, pb:number}`
  - `levelGains(before, after, choices, notes)` → `[{kind:"feature"|"choice"|"resource"|"slot"|"pb"|"note", text:string, detail:string, tag:string, warn:string}]`
  - `luSummary(s)` → string (the first sentence, plain, ≤160 chars)
  - `luHPCheck(ch, raw)` → `{ok:boolean, why:string}`, where `ch` is an `hpChoice()` object `{die, levels}`

- [ ] **Step 1: Write the failing tests.** Append to `src/tests/char-update.js` before `ck.done()`.
  Add `'levelSnapshot','levelGains','luSummary','luHPCheck'` to its `loadApp` list.

```js
// ---------- #101 what a level gave: levelGains() over two snapshots
{
  const S=o=>Object.assign({level:4,feats:[],slots:[0,0,0,0,0,0,0,0,0],res:{},pb:2},o);
  const F=(id,name,o)=>Object.assign({id,name,desc:'',cls:'Cleric',sub:''},o);
  const CD='class:Cleric:channel divinity';
  const b=S({feats:[F('a','Spellcasting')],slots:[4,3,0,0,0,0,0,0,0],res:{[CD]:{name:'Channel Divinity',max:2,die:''}},pb:2});
  const a=S({level:5,feats:[F('a','Spellcasting'),F('b','Sear Undead',{desc:'Whenever you use Turn Undead, you can roll d8s. Each Undead that fails takes damage.'})],
    slots:[4,3,2,0,0,0,0,0,0],res:{[CD]:{name:'Channel Divinity',max:3,die:''}},pb:3});
  const g=X.levelGains(b,a,[{type:'asi',label:'Ability Score Improvement'},{type:'hp',die:8,levels:1}],[{text:'You can now have Prepared Spells: 9.',_level:5}]);
  ck('#101 gains come in the spec order', g.map(r=>r.kind).join(',')==='feature,choice,resource,slot,pb,note', g.map(r=>r.kind));
  ck('#101 a new feature carries its first sentence', g[0].text==='Sear Undead'&&g[0].detail==='Whenever you use Turn Undead, you can roll d8s.'&&g[0].tag==='feature', g[0]);
  ck('#101 the hp choice is never listed as a choice', g.filter(r=>r.kind==='choice').length===1&&g[1].text==='Ability Score Improvement'&&g[1].tag==='choose next', g);
  ck('#101 a resource that grows reads old → new', g.some(r=>r.kind==='resource'&&r.text==='Channel Divinity 2 → 3'&&r.tag==='uses'), g);
  ck('#101 a new slot level reads ×n, tagged new', g.some(r=>r.kind==='slot'&&r.text==='Spell slots · 3rd level ×2'&&r.tag==='new'), g);
  ck('#101 the proficiency bonus shows when it rises', g.some(r=>r.kind==='pb'&&r.text==='Proficiency bonus +2 → +3'), g);
  ck('#101 the pack note is listed', g.some(r=>r.kind==='note'&&r.text==='You can now have Prepared Spells: 9.'), g);

  const g2=X.levelGains(S({slots:[2,0,0,0,0,0,0,0,0],res:{}}),
    S({slots:[3,0,0,0,0,0,0,0,0],res:{'subclass:Fighter:Battle Master:superiority dice':{name:'Superiority Dice',max:4,die:'d8'}}}),[],[]);
  ck('#101 a new resource reads ×n · die, tagged new', g2.some(r=>r.text==='Superiority Dice ×4 · d8'&&r.tag==='new'), g2);
  ck('#101 a slot level that grows reads old → new', g2.some(r=>r.text==='Spell slots · 1st level 2 → 3'&&r.tag==='slots'), g2);
  ck('#101 an unchanged proficiency bonus is not listed', !g2.some(r=>r.kind==='pb'), g2);
  const SD='k:sd';
  const g3=X.levelGains(S({res:{[SD]:{name:'Superiority Dice',max:5,die:'d8'}}}),S({res:{[SD]:{name:'Superiority Dice',max:5,die:'d10'}}}),[],[]);
  ck('#101 a bigger die reads d8 → d10, tagged die', g3.length===1&&g3[0].text==='Superiority Dice d8 → d10'&&g3[0].tag==='die', g3);
  ck('#101 a level that changed nothing lists nothing', X.levelGains(S({}),S({}),[],[]).length===0);

  /* Review Focus 5: two classes' Channel Divinity stay apart */
  const two={'class:Cleric:channel divinity':{name:'Channel Divinity',max:2,die:''},'class:Paladin:channel divinity':{name:'Channel Divinity',max:1,die:''}};
  const g4=X.levelGains(S({res:two}),S({res:Object.assign({},two,{'class:Paladin:channel divinity':{name:'Channel Divinity',max:2,die:''}})}),[],[]);
  ck('#101 two classes\' Channel Divinity stay apart: only the Paladin\'s grows', g4.length===1&&g4[0].text==='Channel Divinity 1 → 2', g4);

  /* decision 11: a feature you already have from another class */
  const g5=X.levelGains(S({feats:[F('x','Extra Attack',{cls:'Fighter'})]}),S({feats:[F('x','Extra Attack',{cls:'Fighter'}),F('y','Extra Attack',{cls:'Paladin'})]}),[],[]);
  ck('#101 a feature you already have from another class says they don\'t stack',
     g5.length===1&&g5[0].warn==="You already have this from Fighter; they don't stack.", g5);
  const g6=X.levelGains(S({}),S({feats:[F('z','Combat Superiority',{cls:'Fighter',sub:'Battle Master'})]}),[],[]);
  ck('#101 a subclass feature is tagged with its subclass', g6[0].tag==='Battle Master'&&g6[0].warn==='', g6);
  ck('#101 a subclass choice is listed to choose next',
     X.levelGains(S({}),S({}),[{type:'subclass',label:'Fighter Subclass'}],[])[0].text==='Fighter Subclass');
  ck('#101 a choice with no label gets a plain one', X.levelGains(S({}),S({}),[{type:'feat'}],[])[0].text==='Choose a feat');

  /* Review Focus 4: messy feature text */
  ck('#101 luSummary drops markup, keeping the words', X.luSummary('<img src=x onerror=alert(1)>Roll **twice** on [Table: Wild Magic]. Then more.')==='Roll twice on Wild Magic.',
     X.luSummary('<img src=x onerror=alert(1)>Roll **twice** on [Table: Wild Magic]. Then more.'));
  ck('#101 ...a sentence with no full stop is kept whole', X.luSummary('You gain a fly speed')==='You gain a fly speed');
  const long='A'.repeat(400)+'.';
  ck('#101 ...and a long one is cut to 160 with an ellipsis', X.luSummary(long).length===158&&/…$/.test(X.luSummary(long)), X.luSummary(long).length);
  ck('#101 ...and nothing reads as nothing', X.luSummary(null)===''&&X.luSummary('')==='');

  /* a live snapshot reads the real sheet */
  c=setup(); X.character.features=[{id:'f1',name:'Rage',description:'Fury.',effects:[],enabled:true,origin:{kind:'class',class:'Barbarian',level:1}}];
  X.character.slots[1]={total:2,used:0}; X.character.resources=[{id:'r1',key:'class:Barbarian:rage',name:'Rage',max:2,cur:2,die:''}];
  X.character.level=1;
  const s=X.levelSnapshot();
  ck('#101 levelSnapshot reads features, slots, resources and the proficiency bonus',
     s.feats[0].id==='f1'&&s.feats[0].cls==='Barbarian'&&s.slots[0]===2&&s.res['class:Barbarian:rage'].max===2&&s.pb===2&&s.level===1, s);
  X.character.resources=[{id:'r2',name:'Luck',max:3,cur:3}];
  ck('#101 ...a resource of the player\'s own is keyed by its name', X.levelSnapshot().res['own:luck'].max===3, X.levelSnapshot().res);
}

// ---------- #101 the HP step's typed value (Review Focus 3)
{
  const d10={die:10,levels:1}, two={die:6,levels:2}, none={die:0,levels:1};
  const ok=(ch,v)=>X.luHPCheck(ch,v).ok;
  ck('#101 a d10 takes 1..10', ok(d10,'1')&&ok(d10,'10')&&ok(d10,' 7 ')&&ok(d10,'07'));
  ck('#101 ...and refuses 0, 11, -3, 3.5, empty and words', !ok(d10,'0')&&!ok(d10,'11')&&!ok(d10,'-3')&&!ok(d10,'3.5')&&!ok(d10,'')&&!ok(d10,'seven'));
  ck('#101 ...saying the range', X.luHPCheck(d10,'11').why==='A d10 rolls 1 to 10.'&&X.luHPCheck(d10,'').why==='Type the number you rolled.', [X.luHPCheck(d10,'11'),X.luHPCheck(d10,'')]);
  ck('#101 two dice take their total, 2..12', ok(two,'2')&&ok(two,'12')&&!ok(two,'1')&&!ok(two,'13')&&X.luHPCheck(two,'13').why==='2d6 rolls 2 to 12.');
  ck('#101 no die takes any whole number, 0 included', ok(none,'0')&&ok(none,'25')&&!ok(none,'-1')&&X.luHPCheck(none,'').why==='Type the hit points you gained.');
}
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node src/tests/char-update.js | grep -E "^FAIL|LOAD FAIL" | head`
  Expected: `LOAD FAIL` (the names don't exist yet).

- [ ] **Step 3: Implement.** Create `src/js/57-levelup.js`:

```js
/* ================= level-up fanfare (#101) =================
   What a level gave. The sheet is snapshotted before the level is applied
   and again after recompute(), and the card lists the difference. Comparing
   the sheet, not reading the class table, is what makes it right for any
   pack, homebrew included, and it can never claim something the sheet did
   not get. Spec: src/docs/specs/2026-10-24-level-up-fanfare-design.md. */
function levelSnapshot(){
  const slots=[];
  for(let lv=1;lv<=9;lv++){const s=character.slots&&character.slots[lv];slots.push(s?num(s.total):0);}
  /* keyed by the resource's own key, so Channel Divinity from a Cleric and from
     a Paladin stay two rows; a player's own resource has none, so its name */
  const res={};
  (character.resources||[]).forEach(r=>{
    if(!r||!r.name)return;
    res[r.key||("own:"+String(r.name).toLowerCase())]={name:String(r.name),max:num(r.max),die:String(r.die||"")};
  });
  return {
    level:totalLevel(),
    feats:(character.features||[]).map(f=>({id:f.id,name:String(f.name||""),desc:String(f.description||""),
      cls:(f.origin&&f.origin.class)||"",sub:(f.origin&&f.origin.subclass)||""})),
    slots,res,pb:pbValue(contributions())
  };
}
const LU_ORD=["","1st","2nd","3rd","4th","5th","6th","7th","8th","9th"];
const LU_CHOICE={asi:["Ability Score Improvement","+2 to one ability, or +1 to two"],feat:["Choose a feat",""],
  subclass:["Choose your subclass",""],skill:["Choose skills",""],option:["Choose an option",""]};
/* A feature's first sentence as plain text: the card is a summary, and the
   full text stays on the Features card. Escaped where it is rendered. */
function luSummary(s){
  let t=String(s==null?"":s).replace(/\[Table:\s*([^\]]+)\]/g,"$1").replace(/<[^>]*>/g,"")
    .replace(/[*_`#>]/g,"").replace(/\s+/g," ").trim();
  const m=/^.*?[.!?](?=\s|$)/.exec(t);if(m)t=m[0];
  return t.length>160?t.slice(0,157).trimEnd()+"…":t;
}
function levelGains(before,after,choices,notes){
  const rows=[],had=new Set(before.feats.map(f=>f.id));
  after.feats.filter(f=>!had.has(f.id)).forEach(f=>{
    const twin=before.feats.find(b=>b.cls&&f.cls&&b.cls!==f.cls&&b.name.toLowerCase()===f.name.toLowerCase());
    rows.push({kind:"feature",text:f.name,detail:luSummary(f.desc),tag:f.sub||"feature",
      warn:twin?`You already have this from ${twin.cls}; they don't stack.`:""});
  });
  (choices||[]).filter(ch=>ch&&ch.type!=="hp").forEach(ch=>{
    const d=LU_CHOICE[ch.type]||["A choice",""];
    rows.push({kind:"choice",text:String(ch.label||d[0]),detail:d[1],tag:"choose next",warn:""});
  });
  Object.keys(after.res).forEach(k=>{
    const a=after.res[k],b=before.res[k];
    if(!b){rows.push({kind:"resource",text:`${a.name} ×${a.max}`+(a.die?` · ${a.die}`:""),detail:"",tag:"new",warn:""});return;}
    if(a.max>b.max)rows.push({kind:"resource",text:`${a.name} ${b.max} → ${a.max}`,detail:"",tag:"uses",warn:""});
    if(a.die&&b.die&&a.die!==b.die)rows.push({kind:"resource",text:`${a.name} ${b.die} → ${a.die}`,detail:"",tag:"die",warn:""});
  });
  for(let lv=1;lv<=9;lv++){
    const b=num(before.slots[lv-1]),a=num(after.slots[lv-1]);
    if(a>b)rows.push({kind:"slot",text:b?`Spell slots · ${LU_ORD[lv]} level ${b} → ${a}`:`Spell slots · ${LU_ORD[lv]} level ×${a}`,
      detail:"",tag:b?"slots":"new",warn:""});
  }
  if(after.pb>before.pb)rows.push({kind:"pb",text:`Proficiency bonus +${before.pb} → +${after.pb}`,detail:"",tag:"bonus",warn:""});
  (notes||[]).forEach(n=>{const t=choiceNoteText(n).trim();if(t)rows.push({kind:"note",text:t,detail:"",tag:"note",warn:""});});
  return rows;
}
/* The typed value of the HP step: the dice total, n..n×die, as the spend box
   takes 1..die. With no hit die (a custom class) it is the hit points
   themselves, any whole number. */
function luHPCheck(ch,raw){
  const die=num(ch&&ch.die),n=Math.max(1,num(ch&&ch.levels)||1),s=String(raw==null?"":raw).trim();
  if(!/^\d+$/.test(s))return {ok:false,why:die?"Type the number you rolled.":"Type the hit points you gained."};
  const r=parseInt(s,10);
  if(die&&(r<n||r>n*die))return {ok:false,why:n>1?`${n}d${die} rolls ${n} to ${n*die}.`:`A d${die} rolls 1 to ${die}.`};
  return {ok:true,why:""};
}
```

  Add the manifest entry and make the four doc edits listed under **Files**.

- [ ] **Step 4: Run the tests to verify they pass.**
  Run `node src/tests/char-update.js | grep -E "^FAIL|ALL PASSED|LOAD FAIL"`, then
  `./build.sh --no-zip && node src/tests/docs.js | grep -E "^FAIL|ALL PASSED"`.
  Expected: both `ALL PASSED`. The docs suite checks the 35 count, the code map, and that a topic
  page cites the fragment.

- [ ] **Step 5: Run the full suite, then commit.**

```bash
./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh
git checkout -- dist/fieldbook.html docs/CHANGELOG.md 2>/dev/null
git add src/js/57-levelup.js src/manifest.json CLAUDE.md src/docs/ADR-001-source-split.md src/docs/wiki/overview.md src/docs/wiki/features/character-building.md src/tests/char-update.js
git commit -m "feat(#101): what a level gave: levelSnapshot(), levelGains(), the HP step's check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The level card, its HP step, and the flow

**Files:**
- Modify: `src/js/57-levelup.js` (append)
- Modify: `src/js/56-class.js`: `doLevelUp()` (around line 258) and `addClass()` (around line 188)
- Modify: `src/js/58-choices.js`: `armChoiceDismissGuard()` uses `LU_HP_CLOSE` for its HP-only
  question (the same words; one string)
- Modify: `src/css/50-modal.css` (append the card's rules)
- Test: `src/tests/char-update.js` (new tests, plus the rewrites listed in Step 6)

**Interfaces:**
- Consumes: Task 2's `levelSnapshot`, `levelGains`, `luHPCheck`; `hpChoice`, `commitHPChoice`,
  `hpGainText`, `hpFixed`, `conModNow` (56-class.js); `rollDiceExpr` (65-resources.js); `openModal`,
  `closeModal`, `setDismissGuard` (80-modal-forms.js); `runChoices` (58-choices.js); `scheduleSave`;
  `esc`.
- Produces:
  - `openLevelUp(info)`, where `info = {cls, from, to, charLevel, before, after, hp, choices, notes, pending}`;
  - `luState()` → the open level-up `{cls, from, to, charLevel, fromLevel, hp, choices, pending, gains, raw, set, note}` or `null`;
  - `luSetHP(raw, note)` → `""` when set, otherwise the reason. `raw===null` means take the average;
  - `luRoll()`;
  - `luFinish()` → `true` if it closed;
  - `showLevelUpCard()`;
  - `levelUpCardHTML(lu)`;
  - `levelUpHPHTML(ch)`;
  - `const LU_HP_CLOSE`.

  Task 4 wraps `openLevelUp`'s final `showLevelUpCard()` call in the animation.

- [ ] **Step 1: Write the failing tests.** Append to `src/tests/char-update.js` before `ck.done()`.
  Add `'openLevelUp','luState','luSetHP','luRoll','luFinish','levelUpCardHTML','levelUpHPHTML','LU_HP_CLOSE','dismissModal'`
  to `loadApp` if absent.

```js
// ---------- #101 the level card: Done or Continue, the HP step, closing early
{
  const realRC=ctx.runChoices, realOM=ctx.openModal; let rc=[], om=[];
  ctx.runChoices=function(){rc.push(Array.prototype.slice.call(arguments));return realRC.apply(null,arguments);};
  ctx.openModal=function(t,h){om.push({t,h:String(h)});return realOM.apply(null,arguments);};
  const reset=()=>{rc=[];om=[];};
  const card=()=>om.filter(o=>/class="lu-card"/.test(o.h)).pop();
  try{
    /* a quiet level: no choices */
    hpSetup(CLS); X.addClass('Fighter',1); X.character.hp.locked=true; reset(); X.doLevelUp();
    ck('#101 a level-up opens the level card, not the choice window', card()&&rc.length===0, [om.map(o=>o.t),rc.length]);
    ck('#101 ...titled "Level up", with a LEVEL N banner', card().t==='Level up'&&/LEVEL 2/.test(card().h), card()&&card().t);
    ck('#101 ...says what was reached', /Fighter 1 → 2 · character level 2/.test(card().h), card().h);
    ck('#101 ...ends on Done, disabled until HP is set', /id="luGo" disabled>Done</.test(card().h), card().h);
    ck('#101 ...the open level-up is held', X.luState()&&X.luState().cls==='Fighter'&&X.luState().set===false);
    ck('#101 Done does nothing before HP is set', X.luFinish()===false&&X.luState()!==null);
    ck('#101 a bad typed value sets nothing and says why', X.luSetHP('11')==='A d10 rolls 1 to 10.'&&X.luState().set===false);
    ck('#101 a good one is accepted', X.luSetHP('7')===''&&X.luState().set===true&&X.luState().raw==='7');
    ck('#101 Done closes, applies 7 + CON 0, and relocks', X.luFinish()===true&&X.num(X.character.hp.max)===17&&X.character.hp.locked===true&&X.luState()===null,
       [X.character.hp.max,X.character.hp.locked]);
    ck('#101 ...and a level with nothing to choose opens no choice window', rc.length===1&&rc[0][1].length===0, rc);

    /* the average, and Roll for me */
    hpSetup(CLS); X.addClass('Fighter',1); reset(); X.doLevelUp(); X.luSetHP(null); X.luFinish();
    ck('#101 the average (null) takes half the die + 1', X.num(X.character.hp.max)===16, X.character.hp.max);
    hpSetup(CLS); X.addClass('Fighter',1); reset(); X.doLevelUp(); X.luRoll();
    const r=X.num(X.luState().raw);
    ck('#101 Roll for me sets a roll in range and says it was rolled', X.luState().set&&r>=1&&r<=10&&/^Rolled /.test(X.luState().note), X.luState());

    /* a level with a choice */
    const F=[{name:'Fighter',hitDie:'d10',levels:{'2':{choices:[{type:'asi',label:'Ability Score Improvement'}]}}}];
    hpSetup(F); X.addClass('Fighter',1); reset(); X.doLevelUp();
    ck('#101 a level with a choice says Continue to your choice', /id="luGo" disabled>Continue to your choice ▸</.test(card().h), card().h);
    ck('#101 ...and lists the choice', /Ability Score Improvement/.test(card().h)&&/choose next/.test(card().h));
    X.luSetHP(null); X.luFinish();
    ck('#101 Continue opens the choice window, without an hp block and without notes', rc.length===1&&rc[0][0]==='Fighter'&&
       rc[0][1].length===1&&rc[0][1][0].type==='asi'&&rc[0][2].length===0, rc);

    /* Review Focus 1: closing early still opens the choices */
    hpSetup(F); X.addClass('Fighter',1); reset(); X.doLevelUp();
    state.confirm=false; X.dismissModal();
    ck('#101 closing early asks first, in the HP words', state.lastConfirm===X.LU_HP_CLOSE&&X.luState()!==null, state.lastConfirm);
    state.confirm=true; X.dismissModal();
    ck('#101 closing early still opens the choices', rc.length===1&&rc[0][1][0].type==='asi', rc);
    ck('#101 ...applies no HP and leaves Max unlocked', X.num(X.character.hp.max)===10&&X.character.hp.locked===false, [X.character.hp.max,X.character.hp.locked]);
    hpSetup(CLS); X.addClass('Fighter',1); reset(); X.doLevelUp(); X.luSetHP('5'); state.lastConfirm=null; X.dismissModal();
    ck('#101 closing after setting HP keeps it, without asking', state.lastConfirm===null&&X.num(X.character.hp.max)===15, X.character.hp.max);

    /* a second class: n dice, notes on the card */
    hpSetup(CLS); X.addClass('Fighter',2); reset(); X.addClass('Wizard',2);
    ck('#101 a second class opens the card too', card()&&/Wizard 0 → 2 · character level 4/.test(card().h), card()&&card().h);
    ck('#101 ...its HP step is 2d6', X.luState().hp.die===6&&X.luState().hp.levels===2&&/2d6/.test(card().h), X.luState().hp);
    ck('#101 ...the multiclass note is on the card', /13 or more in the primary ability/.test(card().h), card().h);
    ck('#101 ...2d6 takes 2..12', X.luSetHP('13')==='2d6 rolls 2 to 12.'&&X.luSetHP('9')==='');
    X.luFinish();
    /* the Fighter 2's creation window (levels 2..2) was never committed, so Max is its seed, 10 */
    ck('#101 ...and adds 9 + 2×CON 0', X.num(X.character.hp.max)===10+9, X.character.hp.max);

    /* creation is unchanged */
    hpSetup(CLS); reset(); X.addClass('Fighter',3);
    ck('#101 a first class above level 1 gets no card; its window keeps the hp block', !card()&&rc.length===1&&rc[0][1][0].type==='hp', [om.map(o=>o.t),rc]);

    /* escaping and the no-die step */
    const html=X.levelUpCardHTML({cls:'Tom & <b>',from:1,to:2,charLevel:2,hp:{die:8,levels:1},choices:[],
      gains:[{kind:'feature',text:'<img src=x onerror=1>',detail:'a & b',tag:'feature',warn:''}]});
    ck('#101 the card escapes names and gains', /Tom &amp; &lt;b&gt;/.test(html)&&/&lt;img src=x onerror=1&gt;/.test(html)&&!/<img/.test(html), html);
    ck('#101 an empty gains list says nothing new', /Nothing new from the rules at this level\./.test(X.levelUpCardHTML({cls:'X',from:1,to:2,charLevel:2,hp:{die:8,levels:1},choices:[],gains:[]})));
    const hp8=X.levelUpHPHTML({die:8,levels:1}), hp0=X.levelUpHPHTML({die:0,levels:1});
    ck('#101 the HP step offers Roll, I rolled + Apply, and the average', /id="luRoll"/.test(hp8)&&/I rolled/.test(hp8)&&/id="luApply"/.test(hp8)&&/Take the average \(5\)/.test(hp8), hp8);
    ck('#101 ...with no die, one HP-gained box and nothing to roll', /HP gained/.test(hp0)&&!/luRoll/.test(hp0)&&!/average/.test(hp0), hp0);
  }finally{ctx.runChoices=realRC;ctx.openModal=realOM;state.confirm=true;}
}
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node src/tests/char-update.js | grep -E "^FAIL|LOAD FAIL" | head`
  Expected: `LOAD FAIL`.

- [ ] **Step 3: Implement the card.** Append to `src/js/57-levelup.js`:

```js
/* ---- the level card ----
   One open level-up at a time; the card is a modal. Done or Continue commits
   the HP through commitHPChoice() and hands on to runChoices(), which with
   nothing to choose falls through to runExtraChoices(pending) as before. */
let _lu=null;
function luState(){return _lu;}
const LU_HP_CLOSE="Close without adding this level's hit points?\n\nMax HP is unlocked, so you can type the new total yourself.";
const LU_ICON={feature:"✦",choice:"✧",resource:"◆",slot:"◇",pb:"↑",note:"✎"};
function openLevelUp(info){
  _lu={cls:info.cls,from:num(info.from),to:num(info.to),charLevel:num(info.charLevel),fromLevel:num(info.before&&info.before.level),
    hp:info.hp,choices:(info.choices||[]).filter(ch=>ch&&ch.type!=="hp"),pending:info.pending||null,
    gains:levelGains(info.before,info.after,info.choices||[],info.notes||[]),raw:null,set:false,note:""};
  showLevelUpCard();
}
function luRowHTML(r){
  return `<li class="lu-row lu-${esc(r.kind)}"><i aria-hidden="true">${LU_ICON[r.kind]||"•"}</i><span>${esc(r.text)}`+
    (r.detail?`<span class="lu-d">${esc(r.detail)}</span>`:"")+(r.warn?`<span class="lu-warn">${esc(r.warn)}</span>`:"")+
    `</span>${r.tag?`<small>${esc(r.tag)}</small>`:""}</li>`;
}
function levelUpHPHTML(ch){
  const die=num(ch&&ch.die),n=Math.max(1,num(ch&&ch.levels)||1),con=conModNow();
  const res=`<div class="hd-res" id="luRes" aria-live="polite"></div>`;
  if(!die)return `<div class="lu-hp"><h5>Hit points</h5><div class="hd-how"><label>HP gained <input id="luTyped" inputmode="numeric" size="3"></label> `+
    `<button type="button" class="tbtn" id="luApply">Apply</button></div>${res}</div>`;
  const conTxt=(n>1?n+"×":"")+"CON "+(con<0?"−"+Math.abs(con):con);
  return `<div class="lu-hp"><h5>Hit points · ${esc((n>1?n:"")+"d"+die)} + ${esc(conTxt)}</h5><div class="hd-how">`+
    `<button type="button" class="tbtn primary" id="luRoll">🎲 Roll for me</button> <span>or</span> `+
    `<label>I rolled <input id="luTyped" inputmode="numeric" size="3"></label> <button type="button" class="tbtn" id="luApply">Apply</button> `+
    `<button type="button" class="lu-avg" id="luAvg">Take the average (${esc(String(n*hpFixed(die)))})</button></div>${res}</div>`;
}
function levelUpCardHTML(lu){
  const rows=lu.gains.length?lu.gains.map(luRowHTML).join(""):`<li class="lu-none">Nothing new from the rules at this level.</li>`;
  return `<div class="lu-card"><div class="lu-bn">LEVEL ${esc(String(lu.charLevel))}</div>`+
    `<p class="lu-k">You reached</p><p class="lu-cls">${esc(lu.cls)} ${esc(String(lu.from))} → ${esc(String(lu.to))} · character level ${esc(String(lu.charLevel))}</p>`+
    `<ul class="lu-list">${rows}</ul>`+levelUpHPHTML(lu.hp)+
    `<div class="m-actions"><button type="button" class="tbtn primary" id="luGo" disabled>${(lu.choices||[]).length?"Continue to your choice ▸":"Done"}</button></div></div>`;
}
function showLevelUpCard(){
  if(!_lu)return;
  openModal("Level up",levelUpCardHTML(_lu));
  /* after openModal, which clears the guard on every open */
  setDismissGuard(()=>(_lu&&!_lu.set)?LU_HP_CLOSE:"",luDismissed);
  const on=(id,ev,fn)=>{const el=document.getElementById(id);if(el&&el.addEventListener)el.addEventListener(ev,fn);};
  const typed=()=>{const el=document.getElementById("luTyped");return el?el.value:"";};
  const apply=()=>{const why=luSetHP(typed());if(why)luSay(why,true);};
  on("luRoll","click",luRoll);
  on("luApply","click",apply);
  on("luTyped","keydown",e=>{if(e.key==="Enter"){e.preventDefault();apply();}});
  on("luAvg","click",()=>luSetHP(null));
  on("luGo","click",luFinish);
}
function luSay(text,bad){const el=document.getElementById("luRes");if(!el)return;el.textContent=text;if(el.classList)el.classList.toggle("bad",!!bad);}
/* raw===null takes the average (half the die + 1). Otherwise raw is checked
   by luHPCheck. Nothing is committed until Done, so a roll can be redone. */
function luSetHP(raw,note){
  if(!_lu)return "No level-up is open.";
  const ch=_lu.hp||{};
  if(raw===null){if(!num(ch.die))return "Type the hit points you gained.";_lu.raw="";}
  else{const c=luHPCheck(ch,raw);if(!c.ok)return c.why;_lu.raw=String(raw).trim();}
  _lu.set=true;_lu.note=note||"";
  luSay(luHPLine(),false);
  const go=document.getElementById("luGo");if(go)go.disabled=false;
  return "";
}
function luHPLine(){
  const ch=_lu.hp||{},m=num(character.hp.max);
  if(!num(ch.die)){const g=Math.max(0,num(_lu.raw));return `${g} HP · Max HP ${m} → ${m+g}`;}
  return hpGainText(ch,_lu.raw,conModNow(),m,_lu.note);
}
function luRoll(){
  if(!_lu)return;
  const ch=_lu.hp||{},die=num(ch.die),n=Math.max(1,num(ch.levels)||1);if(!die)return;
  const r=rollDiceExpr({dice:[{n,sides:die,sign:1}],mod:0});
  const box=document.getElementById("luTyped");if(box)box.value=String(r.total);
  luSetHP(String(r.total),"Rolled "+r.faces.join(", "));
}
function luFinish(){
  if(!_lu||!_lu.set)return false;
  const lu=_lu;_lu=null;
  closeModal();
  commitHPChoice(lu.hp,lu.raw);scheduleSave();
  runChoices(lu.cls,lu.choices,[],lu.pending);
  return true;
}
/* Esc, × or the backdrop. The guard has already asked when HP was not set.
   HP that was set is kept; the choices open either way, because a choice the
   player never saw must not vanish with the card. */
function luDismissed(){
  const lu=_lu;_lu=null;if(!lu)return;
  if(lu.set){commitHPChoice(lu.hp,lu.raw);scheduleSave();}
  runChoices(lu.cls,lu.choices,[],lu.pending);
}
```

  If `rollDiceExpr`'s result has no `faces` (check `65-resources.js` around line 283; the HP block
  in `58-choices.js` `wireHPChoice()` uses `r.faces` and `r.total`), match whatever `wireHPChoice()`
  reads.

- [ ] **Step 4: Rewire `doLevelUp()` and `addClass()`** in `src/js/56-class.js`.

  In `doLevelUp`'s `proceed`, take the snapshot first and open the card last:

```js
  const proceed=idx=>{
    const entry=character.classes[idx],d=findClassDef(entry.name);
    const newL=num(entry.level)+1;if(newL>20){alert(entry.name+" is already level 20.");return;}
    const before=levelSnapshot();   /* #101: what the card compares against */
    entry.level=newL;
    const res=applyClassLevel(entry,d,newL);
    const hp=hpChoice(d,1,newL,entry.name);   /* before the unlock below: it remembers the lock */
    /* …the existing comment and the unlock, the level write and the renders stay exactly as they are… */
    character.hp.locked=false;renderHP();
    character.level=totalLevel();const li=document.querySelector('[data-path="character.level"]');if(li)li.value=character.level;
    renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
    openLevelUp({cls:entry.name,from:newL-1,to:newL,charLevel:character.level,before,after:levelSnapshot(),
      hp,choices:res.choices,notes:res.notes,pending:null});
  };
```

  In `addClass(name,lvl)`, take the snapshot at the top for a second class only:

```js
  const first=!character.classes.length,sid="class:"+name;
  const before=first?null:levelSnapshot();   /* #101: a second class is a level up */
```

  Replace the line
  `if(!first){choices=[hpChoice(d,lvl,lvl,name)].concat(choices);character.hp.locked=false;renderHP();}`
  with:

```js
  let hp=null;
  if(!first){hp=hpChoice(d,lvl,lvl,name);character.hp.locked=false;renderHP();}
```

  Replace the final `runChoices(name,choices,notes,_eq);` with:

```js
  if(!first){openLevelUp({cls:name,from:0,to:lvl,charLevel:character.level,before,after:levelSnapshot(),
    hp,choices,notes,pending:_eq});return;}
  runChoices(name,choices,notes,_eq);   /* with nothing to show, it opens the equipment picker itself */
```

  Keep the creation branch (`else if(seedLevel1HP(d)&&lvl>1){…}`) exactly as it is.

  In `src/js/58-choices.js` `armChoiceDismissGuard`, replace the literal
  `"Close without adding this level's hit points?\n\nMax HP is unlocked, so you can type the new total yourself."`
  with `LU_HP_CLOSE`.

- [ ] **Step 5: The card's CSS.** Append to `src/css/50-modal.css`:

```css
/* ---- the level card (#101) ---- */
.lu-card .lu-bn{margin:0 0 10px;padding:6px;text-align:center;background:var(--accent);color:var(--paper);font:900 22px/1.1 var(--display);letter-spacing:.06em;border-radius:6px}
.lu-k{margin:0;font:700 11px var(--head);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.lu-cls{margin:0 0 6px;font-family:var(--head);font-weight:700}
.lu-list{list-style:none;margin:0;padding:0}
.lu-row{display:flex;gap:8px;align-items:baseline;padding:6px 0;border-bottom:1px dotted var(--hair)}
.lu-row>i{font-style:normal;flex:0 0 16px;text-align:center;color:var(--accent)}
.lu-row>span{flex:1;min-width:0}
.lu-row small{flex:0 0 auto;font:700 10px var(--head);text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft)}
.lu-d{display:block;font-size:13px;color:var(--ink-soft)}
.lu-warn{display:block;font-size:13px;color:var(--brick)}
.lu-none{padding:8px 0;color:var(--ink-soft);font-style:italic}
.lu-hp{margin-top:12px;padding:8px 10px;border:1.5px solid var(--line);border-radius:6px;background:var(--field)}
.lu-hp h5{margin:0;font:700 11px var(--head);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
.lu-avg{background:none;border:0;padding:4px 2px;color:var(--accent-2);text-decoration:underline;cursor:pointer;font:inherit}
.lu-hp .hd-res.bad{color:var(--brick)}
```

- [ ] **Step 6: Rewrite the tests that drove the old level-up window.** Each of these drove
  `doLevelUp()` or a second `addClass()` and then committed HP through
  `X.commitChoices(cls,[{type:'hp',ci:0,dice:…}])`. Rewrite each one to drive the card, keeping
  every assertion's meaning and number. Never delete an assertion about behaviour that still exists.
  In `src/tests/char-update.js`:
  - **The #58 HP block (the lines after `// ---------- the hit-point step on every level-up (#58)`):**
    - `X.commitChoices('Fighter',[{type:'hp',ci:0,dice:''}])` → `X.luSetHP(null); X.luFinish();`
    - `dice:'3'` → `X.luSetHP('3'); X.luFinish();`
    - The Homebrewer (no die) pair:
      - "no die and nothing typed changes nothing" becomes `state.confirm=true; X.dismissModal();`.
        Assert HP unchanged and still unlocked, as before.
      - `dice:'7'` → `X.luSetHP('7'); X.luFinish();`
    - The #58 subclass regression → `X.luSetHP(null); X.luFinish(); X.commitChoices('Fighter',[{type:'subclass',name:'Battle Master'}]);`.
      `luFinish` has just opened the real choice window with the subclass choice, so `commitChoices`
      sees it.
    - The `choiceFieldHTML` hp block tests stay: creation still uses that block.
  - **"a dismissed window does not leak its equipment picker into the next level-up" (#63):**
    `X.doLevelUp(); got=null; X.luSetHP(null); X.luFinish();`, with the same assertion.
  - **The #69 window-title tests** (`at('Marshal',3); X.doLevelUp();` and `at('Marshal',2)`): add
    `X.luSetHP(null); X.luFinish();` after `doLevelUp()`, then assert the title as before. If the
    fixture's Marshal level has no choices, no window opens. In that case assert that instead, and
    say so in your report.
  - **The #66 second-class block** (`X.addClass('Wizard',1)` after a Fighter):
    - "...asks for its hit points like a level-up" → `X.luState().hp.die===6&&X.luState().hp.levels===1`.
    - "...and says why there are no saves or equipment" → assert the words appear in
      `X.luState().gains` rows of kind `note`. Do this BEFORE `luFinish()`, because `luState()` is
      null afterwards.
    - `X.commitChoices('Wizard',[{type:'hp',ci:0,dice:''}])` → `X.luSetHP(null); X.luFinish();`
    - Every other second-class assertion (saves, equipment, skills, features) stays.
  - **The #103 I-2 block** stubs `openModal` to record titles. The card's title is "Level up", which
    is not "Level up — which class?", so its assertions hold unchanged.

  Then `grep -n "type:'hp',ci:0" src/tests/*.js`. Every remaining hit must be a creation-path test
  (a first class added above level 1). Name each one in your report.

- [ ] **Step 7: Run the tests, then the full suite.**
  Run: `node src/tests/char-update.js | grep -E "^FAIL|ALL PASSED|LOAD FAIL"`
  Expected: `ALL PASSED`. Then run the full suite. `rules-data.js` pins
  `const hp=hpChoice(...)` followed by `character.hp.locked=false` in `doLevelUp`; that order is kept.

- [ ] **Step 8: Commit.**

```bash
git checkout -- dist/fieldbook.html docs/CHANGELOG.md 2>/dev/null
git add src/js/57-levelup.js src/js/56-class.js src/js/58-choices.js src/css/50-modal.css src/tests/char-update.js
git commit -m "feat(#101): the level card: what you gained and your hit points, then your choices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The animation: sigil, ring and banner

**Files:**
- Modify: `src/js/57-levelup.js` (append; change `openLevelUp`'s last line)
- Modify: `src/js/56-class.js`: `doLevelUp()` and `addClass()` return early while the scene plays
- Modify: `src/css/00-tokens.css` (the `--lu-*` tokens), `src/css/50-modal.css` (the scene)
- Test: `src/tests/char-update.js`, `src/tests/rules-data.js` (CSS and markup)

**Interfaces:**
- Consumes: Task 3's `openLevelUp`, `showLevelUpCard`, `_lu`.
- Produces:
  - `luFxHTML(from, to)` → string;
  - `playLevelUpFx(from, to, done)`;
  - `luSkip()`;
  - `luBusy()` → boolean;
  - `luReducedMotion()` → boolean;
  - `const LU_FX_MS = 2400`.

- [ ] **Step 1: Write the failing tests.** First, give the suite reduced motion by default. The
  harness's `setTimeout` is a no-op, so a scene started by any older test would never end, and
  `luBusy()` would then block every later `doLevelUp()` in the file. Directly after the
  `const {X, ctx, …} = loadApp([...]);` statement at the top of `src/tests/char-update.js`, add:

```js
/* #101: level-ups in this suite skip the scene (reduced motion), as the
   harness's setTimeout never fires; the scene's own block turns it back on. */
ctx.window.matchMedia=()=>({matches:true,addEventListener(){}});
```

  Then append to `src/tests/char-update.js` before `ck.done()`. Add
  `'luFxHTML','playLevelUpFx','luSkip','luBusy','luReducedMotion'` to `loadApp`.

```js
// ---------- #101 the scene: plays first, skips, honours reduced motion
{
  const realOM=ctx.openModal, realMM=ctx.window.matchMedia; let om=[];
  ctx.openModal=function(t,h){om.push(t);return realOM.apply(null,arguments);};
  ctx.window.matchMedia=()=>({matches:false,addEventListener(){}});   /* motion allowed: the scene plays */
  try{
    const fx=X.luFxHTML(4,5);
    ck('#101 the scene draws a sigil: two circles and a seven-point star', /<svg class="lu-sigil"/.test(fx)&&(fx.match(/<circle /g)||[]).length===2&&
       /M125 31L165\.8 209\.7L51\.5 66\.4L216\.6 145\.9L33\.4 145\.9L198\.5 66\.4L84\.2 209\.7Z/.test(fx), fx.slice(0,300));
    ck('#101 ...with 24 runes drawn as paths, not a font', (fx.match(/<path transform="rotate\(/g)||[]).length===24&&!/<text/.test(fx));
    ck('#101 ...the ring ticks 4 → 5 and the banner says LEVEL 5', /class="lu-old">4</.test(fx)&&/class="lu-new">5</.test(fx)&&/class="lu-banner">LEVEL 5</.test(fx));
    ck('#101 ...with sparks and motes', (fx.match(/class="lu-spark"/g)||[]).length===7&&(fx.match(/class="lu-mote"/g)||[]).length===16);

    hpSetup(CLS); X.addClass('Fighter',1); om=[]; X.doLevelUp();
    ck('#101 a level-up plays the scene before the card', X.luBusy()&&om.length===0, om);
    X.doLevelUp();
    ck('#101 a second level-up while the scene plays does nothing', X.character.classes[0].level===2, X.character.classes[0].level);
    X.luSkip();
    ck('#101 skipping ends the scene and opens the card', !X.luBusy()&&om.length===1&&om[0]==='Level up', om);
    X.luSkip();
    ck('#101 ...and a second skip opens nothing more', om.length===1, om);
    X.luSetHP(null); X.luFinish();

    ctx.window.matchMedia=()=>({matches:true,addEventListener(){}});
    ck('#101 reduced motion is read from the device', X.luReducedMotion()===true);
    hpSetup(CLS); X.addClass('Fighter',1); om=[]; X.doLevelUp();
    ck('#101 with reduced motion there is no scene: the card opens at once', !X.luBusy()&&om.length===1, om);
    X.luSetHP(null); X.luFinish();
  }finally{ctx.openModal=realOM;ctx.window.matchMedia=realMM;}
}
```

  Append to `src/tests/rules-data.js`, in the CSS checks area. Use its existing `css` (the built
  page's style text) or read the source files the way neighbouring CSS checks do:

```js
{
  const mc=fs.readFileSync(path.join(__dirname,'..','css','50-modal.css'),'utf8');
  const tk=fs.readFileSync(path.join(__dirname,'..','css','00-tokens.css'),'utf8');
  ck('#101 the scene sits above the page and under the modal (75 < 80)', /\.lu-fx\{[^}]*z-index:75/.test(mc));
  ck('#101 ...is hidden in print', /@media print\{[^@]*\.lu-fx\{display:none!important\}/.test(mc));
  ck('#101 ...and under reduced motion', /@media \(prefers-reduced-motion:reduce\)\{[^@]*\.lu-fx\{display:none\}/.test(mc));
  ck('#101 ...both media queries come after the base rule', mc.indexOf('.lu-fx{position:fixed')>=0&&
     mc.indexOf('.lu-fx{position:fixed')<mc.indexOf('@media (prefers-reduced-motion:reduce){')&&mc.indexOf('.lu-fx{position:fixed')<mc.lastIndexOf('@media print{'));
  const root=tk.slice(tk.indexOf(':root{'),tk.indexOf('}',tk.indexOf(':root{')));
  const classic=tk.slice(tk.indexOf('html[data-skin="classic"]{'),tk.indexOf('}',tk.indexOf('html[data-skin="classic"]{')));
  ['--lu-night','--lu-night-2','--lu-glow','--lu-spark'].forEach(t=>
    ck('#101 '+t+' is defined for Humblewood (:root) and classic', root.indexOf(t+':')>=0&&classic.indexOf(t+':')>=0, t));
}
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run `node src/tests/char-update.js | grep -E "^FAIL|LOAD FAIL" | head`, then
  `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|LOAD FAIL" | head`.
  Expected: `LOAD FAIL` in char-update; FAILs on the `#101` CSS checks in rules-data.

- [ ] **Step 3: Implement the scene.** Append to `src/js/57-levelup.js`:

```js
/* ---- the scene (panel F of the mockup) ----
   A layer over the page and under the modal (z-index 75 < 80): a rune circle
   draws itself, the level ring glows and ticks old → new, a flash, the
   banner and its sparks. CSS keyframes only; the runes are drawn paths, so
   no font is needed. A click, a tap or Esc/Enter/Space skips to the card;
   reduced motion never builds it. Nothing here is saved. */
const LU_FX_MS=2400;
const LU_STAR="M125 31L165.8 209.7L51.5 66.4L216.6 145.9L33.4 145.9L198.5 66.4L84.2 209.7Z";
const LU_RUNES=["M2 0V16M2 4L8 1M2 9L8 6","M2 16V0L8 5V16","M2 0V16M2 4L7 8L2 12","M2 0V16M2 2L8 6M2 7L8 11",
  "M2 16V0L7 4L2 8L8 16","M7 2L2 8L7 14","M1 1L9 15M9 1L1 15","M2 16V0L7 4L2 8","M2 0V16M8 0V16M2 5L8 11",
  "M5 0V16M1 6L9 10","M5 0V16","M5 0V16M1 5L5 0L9 5"];
const LU_SPARKS=[[18,0],[33,.15],[48,.05],[63,.2],[80,.1],[26,.3],[72,.35]];
const LU_MOTES=[[6,.1],[14,.7],[22,.3],[30,1],[38,.2],[46,.8],[54,.4],[62,1.1],[70,.15],[78,.6],[86,.9],[94,.35],[10,1.2],[50,.55],[66,.05],[90,.75]];
let _luFx=null;
function luBusy(){return !!_luFx;}
function luReducedMotion(){try{return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);}catch(e){return false;}}
function luFxHTML(from,to){
  let runes="";
  for(let i=0;i<24;i++)runes+=`<path transform="rotate(${esc(String(i*15))} 125 125) translate(120 9)" d="${esc(LU_RUNES[i%LU_RUNES.length])}"/>`;
  return `<svg class="lu-sigil" viewBox="0 0 250 250" aria-hidden="true"><circle class="lu-c1" cx="125" cy="125" r="118"/>`+
    `<circle class="lu-c2" cx="125" cy="125" r="94"/><path class="lu-star" d="${esc(LU_STAR)}"/><g class="lu-runes">${runes}</g></svg>`+
    `<div class="lu-ring"><b class="lu-old">${esc(String(from))}</b><b class="lu-new">${esc(String(to))}</b></div>`+
    `<div class="lu-flash"></div><div class="lu-banner">LEVEL ${esc(String(to))}</div>`+
    LU_SPARKS.map(([x,d])=>`<i class="lu-spark" style="left:${esc(String(x))}%;animation-delay:${esc(String(1.6+d))}s"></i>`).join("")+
    LU_MOTES.map(([x,d])=>`<i class="lu-mote" style="left:${esc(String(x))}%;animation-delay:${esc(String(d))}s"></i>`).join("");
}
function playLevelUpFx(from,to,done){
  if(luReducedMotion()){done();return;}
  const el=document.createElement("div");
  el.id="luFx";el.className="lu-fx";el.setAttribute("aria-hidden","true");
  el.innerHTML=luFxHTML(from,to);
  const fx={el,done,timer:null,key:null};_luFx=fx;
  fx.key=e=>{if(e.key==="Escape"||e.key==="Enter"||e.key===" "){if(e.preventDefault)e.preventDefault();luSkip();}};
  el.addEventListener("click",luSkip);
  document.addEventListener("keydown",fx.key);
  document.body.appendChild(el);
  fx.timer=setTimeout(luSkip,LU_FX_MS);
}
function luSkip(){
  const fx=_luFx;if(!fx)return;_luFx=null;
  clearTimeout(fx.timer);
  if(document.removeEventListener)document.removeEventListener("keydown",fx.key);
  if(fx.el&&typeof fx.el.remove==="function")fx.el.remove();
  fx.done();
}
```

  Change `openLevelUp`'s last line from `showLevelUpCard();` to:

```js
  playLevelUpFx(_lu.fromLevel||(_lu.charLevel-(_lu.to-_lu.from)),_lu.charLevel,showLevelUpCard);
```

  In `src/js/56-class.js`, make the first line of both `doLevelUp(idx)` and `addClass(name,lvl)`:

```js
  if(luBusy())return;   /* #101: the scene is playing; one level-up at a time */
```

- [ ] **Step 4: Tokens and CSS.**
  - In `src/css/00-tokens.css`, add inside the `:root{…}` block (Humblewood: a forest night):
    `--lu-night:#0d1a12; --lu-night-2:#2a4433; --lu-glow:#e6d98a; --lu-spark:#e2b44c;`
  - Change the one-line classic block to:

```css
html[data-skin="classic"]{ --display:"Cinzel", Georgia, "Times New Roman", serif;
  --lu-night:#1d1826; --lu-night-2:#3a2f4a; --lu-glow:#9fd4ff; --lu-spark:#e2b44c; }
```

  Append to `src/css/50-modal.css`:

```css
/* ---- the level-up scene (#101): over the page, under the modal (80) ---- */
.lu-fx{position:fixed;inset:0;z-index:75;overflow:hidden;cursor:pointer;
  background:radial-gradient(circle at 50% 42%,var(--lu-night-2) 0,var(--lu-night) 70%);animation:luScene 2.4s ease forwards}
.lu-sigil{position:absolute;left:50%;top:42%;width:min(70vw,300px);height:min(70vw,300px);transform:translate(-50%,-50%);opacity:0;animation:luSigil 2.1s ease-out forwards}
.lu-sigil circle,.lu-sigil path{fill:none;stroke:var(--lu-glow);stroke-width:2;stroke-linecap:round;filter:drop-shadow(0 0 4px var(--lu-glow))}
.lu-c1{stroke-dasharray:760;stroke-dashoffset:760;animation:luDraw .8s .05s ease-out forwards}
.lu-c2{stroke-dasharray:600;stroke-dashoffset:600;animation:luDraw .8s .25s ease-out forwards}
.lu-star{stroke-dasharray:1400;stroke-dashoffset:1400;animation:luDraw .9s .4s ease-out forwards}
.lu-runes{transform-origin:125px 125px;animation:luSpin 2.1s linear forwards}
.lu-runes path{stroke-width:1.6}
.lu-ring{position:absolute;left:50%;top:42%;width:84px;height:84px;box-sizing:border-box;margin:-42px 0 0 -42px;border:4px solid var(--accent);border-radius:50%;
  background:var(--paper);color:var(--accent);display:grid;place-items:center;font:900 40px/1 var(--head);font-variant-numeric:lining-nums;opacity:0;animation:luRing 1.9s ease-out forwards}
.lu-ring b{grid-area:1/1}
.lu-old{animation:luOut .2s .8s forwards}
.lu-new{opacity:0;animation:luIn .2s .8s forwards}
.lu-flash{position:absolute;inset:0;opacity:0;background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.95),transparent 55%);animation:luFlash .6s 1.1s ease-out forwards}
.lu-banner{position:absolute;left:50%;top:16%;transform:translateX(-50%);min-width:min(80vw,320px);padding:10px 24px;box-sizing:border-box;text-align:center;
  background:var(--accent);color:var(--paper);font:900 30px/1 var(--display);letter-spacing:.06em;clip-path:inset(0 50% 0 50%);animation:luUnfurl .6s 1.5s ease-out forwards}
.lu-spark{position:absolute;top:20%;width:7px;height:7px;border-radius:50%;background:var(--lu-spark);opacity:0;animation:luSparkFall 1.2s ease-out forwards}
.lu-mote{position:absolute;bottom:-10px;width:5px;height:5px;border-radius:50%;background:var(--lu-glow);box-shadow:0 0 8px 2px var(--lu-glow);opacity:0;animation:luMote 2s ease-out forwards}
@keyframes luScene{0%{opacity:0}8%{opacity:1}88%{opacity:1}100%{opacity:0}}
@keyframes luDraw{to{stroke-dashoffset:0}}
@keyframes luSpin{to{transform:rotate(120deg)}}
@keyframes luSigil{0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}15%{opacity:1}75%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}
@keyframes luRing{0%{opacity:0;transform:scale(.2)}25%{opacity:1;transform:scale(1)}55%{transform:scale(1.25);box-shadow:0 0 30px 8px var(--lu-glow)}85%{opacity:1;transform:scale(1.1)}100%{opacity:0;transform:scale(.5) translateY(-160px)}}
@keyframes luOut{to{opacity:0}}
@keyframes luIn{to{opacity:1}}
@keyframes luFlash{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
@keyframes luUnfurl{to{clip-path:inset(0 0 0 0)}}
@keyframes luSparkFall{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(40vh) scale(.4)}}
@keyframes luMote{0%{opacity:0;transform:translateY(0)}20%{opacity:1}100%{opacity:0;transform:translateY(-70vh)}}
@media (prefers-reduced-motion:reduce){.lu-fx{display:none}}
@media print{.lu-fx{display:none!important}}
```

  If `50-modal.css` already has a `@media print{…}` block AFTER this point, put the `.lu-fx` print
  rule into a new `@media print{.lu-fx{display:none!important}}` at the very end of the file, so the
  test's `lastIndexOf('@media print{')` finds it after the base rule.

- [ ] **Step 5: Run the tests.** Run `node src/tests/char-update.js`, then build and run
  `rules-data.js`, then the full suite. Expected: all pass.

- [ ] **Step 6: Drive it once in the browser** (Task 5 does the full QA). Run `./build.sh --no-zip`
  and open `file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/101/dist/fieldbook.html`.
  Make a character with `newCharacter('QA','dnd')`, load the SRD classes (Settings → Rules, or the
  way `screenshot-qa.md` describes), and add a Fighter 1. Press Level up from the class menu.
  - At about 1.0s, take a screenshot of the scene:
    `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/101-t4-scene.png`. Pause the animations
    first, the way the mockup check did: `el.getAnimations().forEach(a=>a.pause())` on every
    descendant of `#luFx`.
  - Then screenshot the card: `101-t4-card.png`.
  - Check that the ring's 5 sits centred in its circle and the circle sits centred on the sigil.
    Measure both centres with `getBoundingClientRect()`; they must match to within 1px.
  - Check that the console is clean.

- [ ] **Step 7: Commit.**

```bash
git checkout -- dist/fieldbook.html docs/CHANGELOG.md 2>/dev/null
git add src/js/57-levelup.js src/js/56-class.js src/css/00-tokens.css src/css/50-modal.css src/tests/char-update.js src/tests/rules-data.js
git commit -m "feat(#101): the level-up scene: a rune circle, the ring ticking up, the banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Browser QA, docs, release notes

**Files:** the wiki pages named below, `src/docs/_claude/WIRING-LEDGER.md`,
`src/docs/UNRELEASED.md`, the spec's As built section, `src/docs/wiki/roadmap/1.9.0.md` (row #101),
and CSS for tuning only. Any JS change you find you need is a finding for the controller, not
something to make here.

- [ ] **Step 1: Before shots** from main's tracked build,
  `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`: today's level-up window
  (Fighter 1 → 2) at 1280 and 390, in classic light. Save them as
  `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/101-before-*.png`.

- [ ] **Step 2: After shots and driven checks** on the worktree's build, as
  `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/101-after-*.png`. Load the SRD 5.2 pack.
  For the mid-animation frames, pause the animations.
  - (a) Fighter 1 → 2: a quiet level. Shoot the scene mid-way and the card. Then Roll for me, a typed
    11 (rejected, with its message), a typed 7 with Apply, and Done. Max HP rises and the lock comes
    back.
  - (b) Fighter 3 → 4, or any level with an ASI: the card says *choose next*, then Continue opens the
    choice window without an HP block.
  - (c) Cleric 4 → 5: a feature, 3rd-level slots ×2, proficiency bonus +2 → +3, and the prepared
    spells note.
  - (d) Adding Wizard at level 2 to a Fighter: 2d6, the multiclass note including the 13+ sentence,
    and no starting-equipment window.
  - (e) A Paladin 1 has two 1st-level slots.
  - (f) Esc during the scene skips to the card. Esc on the card asks; Cancel keeps the card; OK
    closes without HP and Max stays unlocked.
  - (g) Reduced motion, emulated through the MCP if it can (otherwise say it wasn't driven): no
    scene, the card at once.
  - (h) Both skins in light and dark at 1280, and classic light at 390.
  - (i) The console is clean throughout.

  Tune spacing in CSS against the mockups if needed. Report every shot, and everything driven and
  not driven.

- [ ] **Step 3: Docs.**
  - Append the ledger entry `## Level-up fanfare (#101, <today's date>)` to the end of
    `src/docs/_claude/WIRING-LEDGER.md` (append only). Note its line number with
    `grep -n "^## Level-up fanfare" src/docs/_claude/WIRING-LEDGER.md`.
  - Rewrite these wiki pages to the new truth, each with a History line citing that L-number:
    - `features/character-building.md`: the **Level up** paragraph (the card, the scene, Done or
      Continue, closing early, a second class gets the card, creation does not) and the
      `| hp |` row of the choice-modal table (creation only now);
    - `features/spells.md`: half-casters round up (SRD 5.2.1 p.26), every ruleset;
    - `features/vitals-and-rest.md`: the level-up HP step shares the spend box's controls;
    - `ui/theming-and-icons.md`: the `--lu-*` tokens;
    - `architecture/build-and-source-split.md` if it lists fragments.
  - In `roadmap/1.9.0.md`, mark #101's row as built, and update its decision row, which said
    "Continue into the existing choice window unchanged". It is now the card with HP on it, then the
    choice window only when there is a choice, and that decision cites the spec.
  - Write the spec's **As built** section: deviations, rulings, and what Mike checks on his devices
    (touch, print, real characters, real reduced motion).
  - In `src/docs/UNRELEASED.md`, under `## Pending`, add the two bullets from spec §11 verbatim, with
    no tags and no versions.

- [ ] **Step 4: Run the full suite.**
  `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`
  must pass. Then `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.

- [ ] **Step 5: Commit** the docs as `docs(#101): …`, and any CSS tuning in its own `style(#101): …`
  commit, each with the trailer.
