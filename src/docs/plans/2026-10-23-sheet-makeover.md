# The Sheet Tab Makeover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Sheet becomes one condensed three-column page (a Foundry-style header over a dark
portrait-and-vitals rail, abilities as a strip, Skills beside Defences / Statuses / Resources, Features
full width), with resistances, immunities, senses and languages as chips, a hit-die spend box that
rolls or takes your roll, familiars behind a header icon, an XP / Milestone setting, Attacks moved to
Inventory and Story renamed Bio (#103).

**Architecture:**
- **Data first, layout last.** Tasks 1–3 add the fields, the ruleset fields and the migrations as pure,
  tested code; tasks 4–6 build the pieces (chips, the spend box, the header) on the CURRENT layout so
  each is testable alone; task 7 rearranges the Sheet into the new grid and retires what it replaces.
- **One new fragment, `src/js/41-chips.js`:** the chip data helpers (`chipClean`, `chipList`), the
  advancement and default-language helpers, the chip markup, the chooser, the Defences card and the
  Bio card's chip rows. Everything else lands in the fragment that already owns the area.
- **Existing ids survive moves.** `recompute()`, `renderHP()`, the death saves, the skills and
  abilities paint by id; the new layout moves those elements, never re-creates them with new ids.

**Tech Stack:** Plain ES2020 concatenated into one `<script>`, no modules; plain CSS on the theme
tokens; Node suites through `src/tests/harness.js`; the project's Playwright MCP (`mcp__playwright__*`)
for driven checks and screenshots.

**Spec:** `src/docs/specs/2026-10-23-sheet-makeover-design.md`. Read it first; this plan argues from it.
Mockups: `.superpowers/brainstorm/59468-1792760354/content/layout-v2.html`, `rail-v2.html`,
`widths.html` (open them in a browser; they are the visual target).

**Worktree:** `.claude/worktrees/103`, branch `issue/103-sheet-makeover`, created **after #88 is merged
to main** (Task 1 extends #88's `packMap()` / `normPackMaps()`). From the repo root:
`./scripts/wt.sh add 103 sheet-makeover`; run every command below from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/103`.

## Global Constraints

**The build**
- One shipped file, by concatenation: no `import`/`export`, no `type="module"`, no runtime dependency,
  no network. This branch adds ONE fragment, `src/js/41-chips.js`, listed in `src/manifest.json`
  immediately after `src/js/40-sheet.js`. Its count moves `CLAUDE.md` (`js/*.js  33 fragments`) and
  `src/docs/ADR-001-source-split.md` (`js/ (33 fragments)`) to 34; the overview's code map lists it;
  a wiki topic page cites it (the `docs` suite checks all three).
- **TDZ (ADR-001):** `blankChar()` runs at load (`let character=blankChar()` in `00-constants.js`,
  BEFORE `let rules` at its line ~102), so every new default there is a literal and nothing in it
  reads `rules` or a later fragment's `const`. `SRD_ADVANCEMENT` is a top-level literal in
  `00-constants.js`. Default languages are added at runtime (`migrate()`, `newCharacter()`), never in
  `blankChar()`.
- **Byte hygiene:** LF, final newline, no BOM. The death-save skull stays an entity (`&#9760;&#65038;`).
- **Before `rules-data.js` (or `run.sh`), build:** `./build.sh --no-zip`.

**Git and release**
- Branch commits carry source and docs only; never `git add` `dist/fieldbook.html` or
  `docs/CHANGELOG.md`. Always `git add` explicit paths.
- Never touch `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array. No file under `data/` changes.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Character data** (spec §3)
- New fields, all optional, defaulted in `blankChar()`, shape-guarded in `migrate()`, round-trip
  tested: `resists`, `immunes`, `senses`, `languages` (lists), `showFamiliars` (boolean),
  `advancement` (`"xp"` | `"milestone"`, default `"xp"`).
- Chip lists are read only through `chipList(c, key)`; `advancement` only through `advancementOf(c)`.
- `statStyle` and `hdStyle` stay in saved sheets and are no longer read (Task 5 and Task 7 retire them).
- `migrate()` preserves every field (never a whitelist).

**Ruleset data** (spec §4, §4a)
- Two new optional pack-level fields, merged per pack label exactly like `requires` and `credits`
  (in #88's `packMap()` maps): `defaultLanguages: [string]` and `advancement: [[xp, level], …]`.
- A pack label maps to a character's ruleset with `systemOf({_source: label})` (`52-race.js`).
- No pack declares either field, so no pack and no digest changes; the fallbacks are `["Common"]` and
  `SRD_ADVANCEMENT`.

**Markup safety**
- Every `${…}` inside a quoted HTML attribute value is `esc(…)` of the whole expression, or a ternary
  that can only yield literals (`rules-data.js` scans all `src/js`). A modal's title is plain text.
- `.label` edits never use `label.innerHTML +=` (it destroys `#starBtn`, `#encPill`, `#roundNum`).

**The test harness**
- A suite names what it reads in its `loadApp([...])` list (missing → `LOAD FAIL`); add a name only
  if absent. `ctx.name` reaches an unlisted function; `X.rules`, `X.character` are settable.
- Run one suite: `node src/tests/<suite>.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.

**Settled decisions** — spec §2, rows 1–18. Plan rulings, recorded so a reviewer can check them:
- **Ruling:** a character's ruleset never changes after creation (no code assigns `character.system`
  outside `newCharacter()`), so the spec §4 line "when the character's system changes, `system` chips
  are replaced" needs no code; `ensureDefaultLanguages()` is idempotent and is what keeps them present.
- **Ruling:** the hit-dice **auto / manual** pill and the manual dice field (`[data-hdmode]`,
  `#hitdiceInput`, `[data-hdreset]`) move into the spend box's foot, unchanged — the spec's box did not
  mention them, and dropping them would remove a working feature.
- **Ruling:** the Familiars stat-card modal reuses `renderFamiliars()`'s row markup for one familiar
  (a pure `familiarCardHTML(f)` extracted from it) rather than a new layout, so the two cannot drift.

## Review Focus

1. **An old sheet with notes on `class`, `origin` and `rest`, a "Languages:" line, and `rest` in its
   combat sections** — loads with nothing lost, merges once, and a second load changes nothing (Task 2).
2. **Typing your own hit-die roll** — "0", "9" on a d8, "4.5", "" and "abc" are refused with a reason;
   "8" on a d8 applies (Task 5).
3. **A species that grants a language the player had already typed** — removing the species leaves the
   player's chip (Task 3).
4. **Every id the old Sheet painted by** (`acDisp`, `initDisp`, `speedDisp`, `sizeDisp`, `passDisp`,
   `levelDisp`, `pbDisp`, `hpCur`, `hpMax`, `hpTemp`, `deathSucc`, `deathFail`, `maxNote`, `starBtn`,
   `hdWrap`, `mod-*`, `save-*`, `skill-*`, `statLegend`, `familiarCard`, `addFamiliarLink`) exists
   exactly once after the rewrite (Task 7).
5. **The combat view after the move** — adding Vitals brings the rail; Attacks (now on Inventory) still
   moves in and goes home to Inventory (Task 7, driven in Task 8).

---

## File Structure

| File | Responsibility on this branch |
|---|---|
| `src/js/41-chips.js` (new) | `CHIP_KEYS`, `chipClean`, `chipList`, `advancementOf`, `advancementFor`, `xpProgress`, `defaultLanguagesFor`, `ensureDefaultLanguages`, `langParse`; the chip markup, the chooser, `renderDefences()`, `renderBioChips()` |
| `src/js/00-constants.js` | new `blankChar()` defaults; `SRD_ADVANCEMENT`; the ability strip in `buildAbilities()`; `buildSkills()` without the grouped branch |
| `src/js/89-rules-merge.js` | `defaultLanguages` and `advancement` merged per label; the pool restore carries them; `normPackMaps()`, `resetRules()`, `dropOwnedPackMeta()` cover them |
| `src/js/88-settings.js` | `prunePackMeta()` covers them; retire the Skills and Hit Dice display rows; add Advancement and the familiar icon rows |
| `src/js/71-char-io.js` | `migrate()`: chip guards, `advancement`, `showFamiliars`, the note merges, the Languages lift, `rest`→`vitals`, default languages; print adds the chips |
| `src/js/52-race.js`, `54-background.js` | languages become chips with provenance; removal takes them; info windows gain Change / Remove |
| `src/js/65-resources.js` | the hit-dice bar and the spend box |
| `src/js/50-classrace.js` | the header's class line and its flyout; species · background |
| `src/js/40-sheet.js` | the header's paw, flyout and modal; `familiarCardHTML()`; the header's level, XP and icons |
| `src/js/87-notes.js`, `87-combat.js` | the registry: `portrait` → "Character", `class`/`origin`/`rest` removed, `defences` added, `attacks` → inventory, `NOTE_TABS.story` → "Bio"; `EDIT_CARDS` |
| `src/js/75-home-theme.js` | `newCharacter()` adds default languages |
| `src/js/90-boot.js` | wiring for the chips, the spend box, the header, the paw |
| `src/html/00-sheet.html`, `10-inventory.html`, `30-story.html`, `src/fieldbook.template.html` | the new Sheet; Attacks on Inventory; the Bio card; the tab label |
| `src/css/10-chrome.css`, `30-sheet.css`, `20-cards.css` | the grid, header, rail, strip, chips, spend box, paw |
| `src/tests/sheet.js`, `rules-data.js` | the tests |
| `docs/rules-schema.md` | `defaultLanguages`, `advancement` (ships) |
| docs | the wiki pages in spec §13, the spec's As built, ledger, `UNRELEASED.md` |

---

### Task 1: The fields, the ruleset fields and the pure helpers

**Files:**
- Create: `src/js/41-chips.js`; Modify: `src/manifest.json`, `CLAUDE.md`, `src/docs/ADR-001-source-split.md`,
  `src/docs/wiki/overview.md`, `src/docs/wiki/features/vitals-and-rest.md` (cite the fragment)
- Modify: `src/js/00-constants.js` (`blankChar()`, `SRD_ADVANCEMENT`), `src/js/89-rules-merge.js`,
  `src/js/88-settings.js` (`prunePackMeta()`), `docs/rules-schema.md`
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: #88's `packMap(o)` and `normPackMaps()` (in `89-rules-merge.js` on main).
- Produces: `CHIP_KEYS`; `chipClean(list, key, mint) → [{id,name,(range),(src)}]`;
  `chipList(c, key)`; `advancementOf(c) → "xp"|"milestone"`; `SRD_ADVANCEMENT`;
  `advancementFor(c) → [[xp,level],…]`; `xpNumber(v) → number|null`;
  `xpProgress(c) → {xp, level, next, ready} | null`; `defaultLanguagesFor(c) → [string]`;
  `ensureDefaultLanguages(c)`; `langParse(str) → [string]`. `rules.defaultLanguages`,
  `rules.advancement` (label → value maps).

- [ ] **Step 1: Write the failing tests**

`src/tests/sheet.js` — add to `loadApp`: `'CHIP_KEYS', 'chipClean', 'chipList', 'advancementOf', 'SRD_ADVANCEMENT', 'advancementFor', 'xpNumber', 'xpProgress', 'defaultLanguagesFor', 'ensureDefaultLanguages', 'langParse',`
(only those absent). Then insert before `/* ---- imported files and packs render inert ----`:

```js
/* ---- #103: chips, advancement and default languages (spec §3, §4, §4a) ---- */
{
  const savedRules = X.rules;
  const b = X.blankChar();
  ck('#103 new lists start empty', ['resists', 'immunes', 'senses', 'languages'].every(k => Array.isArray(b[k]) && b[k].length === 0));
  ck('#103 a new character advances by XP', b.advancement === 'xp' && X.advancementOf(b) === 'xp');
  ck('#103 advancement junk reads as xp', ['milestone', 'Milestone', 'lots', null, 7].map(v => X.advancementOf({advancement: v})).join() === 'milestone,xp,xp,xp,xp');
  const dirty = [{id: 'a', name: ' Fire '}, {name: 'fire'}, {name: ''}, 'Cold', null, [], {name: 5}, {id: 'c', name: 'Cold'}];
  const clean = X.chipClean(dirty, 'resists', false);
  ck('#103 chips: trimmed, deduped case-blind, junk dropped', JSON.stringify(clean.map(c => c.name)) === '["Fire","Cold"]', clean);
  ck('#103 a read never invents an id', clean[0].id === 'a' && X.chipClean([{name: 'X'}], 'resists', false)[0].id === '');
  ck('#103 migrate mints ids', typeof X.chipClean([{name: 'X'}], 'resists', true)[0].id === 'string' && X.chipClean([{name: 'X'}], 'resists', true)[0].id.length > 0);
  const sen = X.chipClean([{name: 'Darkvision', range: 60}, {name: 'Tremorsense', range: '30'}, {name: 'Blindsight', range: -5}, {name: 'Truesight', range: 'far'}], 'senses', false);
  ck('#103 a sense range is a whole number of feet or blank', JSON.stringify(sen.map(s => s.range)) === '[60,30,"",""]', sen);
  ck('#103 only languages keep a source', X.chipClean([{name: 'Common', src: 'system'}], 'languages', false)[0].src === 'system' &&
     !('src' in X.chipClean([{name: 'Fire', src: 'race:Elf'}], 'resists', false)[0]) && X.chipClean([{name: 'Elvish'}], 'languages', false)[0].src === '');
  ck('#103 chipList reads through the guard', X.chipList({resists: 'nope'}, 'resists').length === 0 && X.chipList(null, 'senses').length === 0);

  ck('#103 the SRD table: 20 levels from 0', X.SRD_ADVANCEMENT.length === 20 && X.SRD_ADVANCEMENT[0][0] === 0 && X.SRD_ADVANCEMENT[19][0] === 355000 && X.SRD_ADVANCEMENT[15][0] === 195000);
  X.rules = {name: 'T', advancement: Object.create(null), defaultLanguages: Object.create(null)};
  ck('#103 no declaration: the SRD table and Common', X.advancementFor({system: 'dnd'}) === X.SRD_ADVANCEMENT && JSON.stringify(X.defaultLanguagesFor({system: 'dnd'})) === '["Common"]');
  X.rules.advancement.humblewood = [[0, 1], [100, 2], [400, 3]];
  X.rules.defaultLanguages.humblewood = ['Common', 'Birdsong', '', 7];
  ck('#103 a ruleset that declares its own', X.advancementFor({system: 'humblewood'})[1][0] === 100 &&
     JSON.stringify(X.defaultLanguagesFor({system: 'humblewood'})) === '["Common","Birdsong"]');
  ck('#103 ...used only by its own ruleset', X.advancementFor({system: 'dnd'}) === X.SRD_ADVANCEMENT);
  X.rules.advancement.humblewood = [[0, 1], [500, 2], [400, 3]];
  ck('#103 a malformed table falls back', X.advancementFor({system: 'humblewood'}) === X.SRD_ADVANCEMENT);
  X.rules.advancement.humblewood = [[0, 2]];
  ck('#103 a table must start at level 1, xp 0', X.advancementFor({system: 'humblewood'}) === X.SRD_ADVANCEMENT);
  X.rules = savedRules;

  ck('#103 XP reads numbers and digit strings', X.xpNumber(183000) === 183000 && X.xpNumber('183,000') === 183000 && X.xpNumber(' 42 ') === 42 &&
     X.xpNumber('') === null && X.xpNumber('lots') === null && X.xpNumber(-5) === null && X.xpNumber('1.5') === null);
  const lvl = (n, xp) => ({system: 'dnd', xp, classes: [{name: 'Cleric', level: n}]});
  const p = X.xpProgress(lvl(15, '183,000'));
  ck('#103 progress toward the next level', p && p.xp === 183000 && p.level === 15 && p.next === 195000 && p.ready === false, p);
  ck('#103 past the threshold: ready', X.xpProgress(lvl(15, 200000)).ready === true);
  ck('#103 level 20 has no next', X.xpProgress(lvl(20, 400000)).next === null && X.xpProgress(lvl(20, 400000)).ready === false);
  ck('#103 XP not a number: no progress', X.xpProgress(lvl(3, 'a lot')) === null);

  ck('#103 languages parse from a pack string', JSON.stringify(X.langParse('Common, Elvish and one other language of your choice')) === '["Common","Elvish"]' &&
     JSON.stringify(X.langParse('Common and Dwarvish')) === '["Common","Dwarvish"]' && JSON.stringify(X.langParse('Any two languages')) === '[]' &&
     JSON.stringify(X.langParse(7)) === '[]');
  const c = X.blankChar(); c.system = 'dnd'; c.languages = [{id: 'x', name: 'common', src: ''}];
  X.ensureDefaultLanguages(c);
  ck('#103 a default already present is not doubled', c.languages.length === 1);
  const c2 = X.blankChar(); c2.system = 'dnd';
  X.ensureDefaultLanguages(c2); X.ensureDefaultLanguages(c2);
  ck('#103 defaults are added once, stamped system', c2.languages.length === 1 && c2.languages[0].name === 'Common' && c2.languages[0].src === 'system');
}
```

`src/tests/rules-data.js` — add to `loadApp` if absent: `'resetRules', 'mergeRules', 'normPackMaps', 'prunePackMeta',`. Append before the file's final summary:

```js
// ---------- #103: defaultLanguages and advancement are per-label pack fields, like requires
{
  const saved = X.rules;
  X.resetRules();
  X.mergeRules({system: 'humblewood', defaultLanguages: ['Common', 'Birdsong'], advancement: [[0, 1], [100, 2]], races: [{name: 'Mapach'}]}, 'h.json');
  X.mergeRules({system: '__proto__', defaultLanguages: ['Odd'], races: [{name: 'Q'}]}, 'p.json');
  ck('#103 the fields are stored per label', JSON.stringify(X.rules.defaultLanguages.humblewood) === '["Common","Birdsong"]' && X.rules.advancement.humblewood[1][0] === 100);
  ck('#103 ...in prototype-free maps', Object.getPrototypeOf(X.rules.defaultLanguages) === null && JSON.stringify(X.rules.defaultLanguages['__proto__']) === '["Odd"]');
  ck('#103 junk inside a declaration is dropped', (() => { X.mergeRules({system: 'j', defaultLanguages: ['A', 3, '  '], advancement: 'no', races: [{name: 'J'}]}, 'j.json');
    return JSON.stringify(X.rules.defaultLanguages.j) === '["A"]' && !('j' in X.rules.advancement); })());
  const back = JSON.parse(JSON.stringify(X.rules));
  X.resetRules(); Object.assign(X.rules, back); X.normPackMaps();
  ck('#103 a save and load keeps them', JSON.stringify(X.rules.defaultLanguages.humblewood) === '["Common","Birdsong"]' && Object.getPrototypeOf(X.rules.advancement) === null);
  X.rules.races = X.rules.races.filter(r => r._source !== 'humblewood'); X.prunePackMeta();
  ck('#103 removing the pack drops them', !('humblewood' in X.rules.defaultLanguages) && !('humblewood' in X.rules.advancement));
  X.rules = saved;
}
```

- [ ] **Step 2: Run them to make sure they fail**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `LOAD FAIL` naming `CHIP_KEYS`.

- [ ] **Step 3: Implement**

`src/js/00-constants.js`: immediately before `function blankChar(){`, add

```js
/* The SRD's character advancement (XP → level), the fallback when the
   character's ruleset declares no `advancement` of its own (#103). A literal:
   blankChar() and this run at load, before `rules` exists. */
const SRD_ADVANCEMENT=[[0,1],[300,2],[900,3],[2700,4],[6500,5],[14000,6],[23000,7],[34000,8],[48000,9],[64000,10],
  [85000,11],[100000,12],[120000,13],[140000,14],[165000,15],[195000,16],[225000,17],[265000,18],[305000,19],[355000,20]];
```

and in `blankChar()`'s returned object, beside `secNotes:{}, noteCollapse:{},`, add

```js
    /* #103: chips (41-chips.js), read only through chipList(); default
       languages are added at runtime (ensureDefaultLanguages), never here. */
    resists:[], immunes:[], senses:[], languages:[],
    advancement:"xp", showFamiliars:false,
```

Create `src/js/41-chips.js`:

```js
/* ================= chips: defences, senses, languages (#103) =================
   Simple named items the player keeps in a list — resistances, immunities,
   senses (with a range), languages (with a source when a grant or the ruleset
   added them). Read only through chipList(): a list in a saved sheet may hold
   anything someone typed. Also here: the two ruleset-specific helpers #103
   adds, the advancement table and the default languages. */
const CHIP_KEYS=["resists","immunes","senses","languages"];
/* `mint`: migrate() gives an entry with no id one; a read never invents one,
   so reading is pure. */
function chipClean(list,key,mint){
  const out=[],seen=new Set();
  (Array.isArray(list)?list:[]).forEach(x=>{
    if(!x||typeof x!=="object"||Array.isArray(x)||typeof x.name!=="string")return;
    const name=x.name.trim();if(!name)return;
    const k=name.toLowerCase();if(seen.has(k))return;seen.add(k);
    const e={id:(typeof x.id==="string"&&x.id)?x.id:(mint?uid():""),name};
    if(key==="senses"){const r=typeof x.range==="number"?x.range:(typeof x.range==="string"&&/^\s*\d+\s*$/.test(x.range)?parseInt(x.range,10):NaN);e.range=(isFinite(r)&&r>0)?Math.round(r):"";}
    if(key==="languages")e.src=typeof x.src==="string"?x.src:"";
    out.push(e);
  });
  return out;
}
function chipList(c,key){return chipClean(c&&c[key],key,false);}
function advancementOf(c){return c&&c.advancement==="milestone"?"milestone":"xp";}

/* ---- the ruleset-specific helpers ----
   A pack label is matched to a ruleset with systemOf(), the same rule species
   use. Several labels of one ruleset: the first by name, so the result does not
   depend on load order. */
function rulesetDecl(map,c){
  if(!map||typeof map!=="object"||!c)return undefined;
  const hit=Object.keys(map).sort().find(l=>systemOf({_source:l})===c.system);
  return hit===undefined?undefined:map[hit];
}
function advValid(t){
  if(!Array.isArray(t)||!t.length)return false;
  for(let i=0;i<t.length;i++){const r=t[i];
    if(!Array.isArray(r)||r.length!==2||!Number.isInteger(r[0])||!Number.isInteger(r[1]))return false;
    if(i===0&&(r[0]!==0||r[1]!==1))return false;
    if(i>0&&(r[0]<=t[i-1][0]||r[1]!==t[i-1][1]+1))return false;}
  return true;
}
function advancementFor(c){const t=rulesetDecl(rules.advancement,c);return advValid(t)?t:SRD_ADVANCEMENT;}
function xpNumber(v){
  if(typeof v==="number")return (Number.isInteger(v)&&v>=0)?v:null;
  if(typeof v!=="string")return null;
  const s=v.trim().replace(/,/g,"");
  return /^\d+$/.test(s)?parseInt(s,10):null;
}
/* {xp, level (the sheet's total level), next (XP for level+1, or null), ready} */
function xpProgress(c){
  const xp=xpNumber(c&&c.xp);if(xp===null)return null;
  const level=(Array.isArray(c.classes)?c.classes:[]).reduce((a,x)=>a+num(x&&x.level),0)||num(c.level)||1;
  const t=advancementFor(c),row=t.find(r=>r[1]===level+1);
  const next=row?row[0]:null;
  return {xp,level,next,ready:next!==null&&xp>=next};
}
function defaultLanguagesFor(c){
  const d=rulesetDecl(rules.defaultLanguages,c);
  const list=Array.isArray(d)?d.filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim()):[];
  return list.length?list:["Common"];
}
/* Idempotent: adds each default the character lacks (case-blind), stamped
   "system". A language the player already has keeps its own source. */
function ensureDefaultLanguages(c){
  if(!c)return;
  const have=chipClean(c.languages,"languages",true);
  const names=new Set(have.map(x=>x.name.toLowerCase()));
  defaultLanguagesFor(c).forEach(n=>{if(!names.has(n.toLowerCase())){have.push({id:uid(),name:n,src:"system"});names.add(n.toLowerCase());}});
  c.languages=have;
}
/* A pack's `languages` text → names. "Common, Elvish and one other language of
   your choice": the choice is the player's to add, so it is skipped. */
function langParse(str){
  if(typeof str!=="string")return [];
  return str.split(/,|\band\b|;/i).map(s=>s.trim()).filter(s=>s&&!/\b(choice|any|other|one|two|three)\b/i.test(s));
}
```

`src/manifest.json`: add `"src/js/41-chips.js"` immediately after `"src/js/40-sheet.js"`.

`src/js/89-rules-merge.js` (after #88, which added `packMap()` and `normPackMaps()`):
- `resetRules()`: add `defaultLanguages:packMap(), advancement:packMap()` beside `requires`/`credits`.
- `normPackMaps()`: also `rules.defaultLanguages=packMap(rules.defaultLanguages);rules.advancement=packMap(rules.advancement);`.
- `mergeRules()`, beside the `requires` block, using the same `src` label:
  ```js
  if(Array.isArray(obj.defaultLanguages)){
    const l=obj.defaultLanguages.filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim());
    rules.defaultLanguages=packMap(rules.defaultLanguages);if(l.length)rules.defaultLanguages[src]=l;
  }
  if(Array.isArray(obj.advancement)){rules.advancement=packMap(rules.advancement);rules.advancement[src]=obj.advancement;}
  ```
  (stored as declared; `advancementFor()` validates at read).
- `dropOwnedPackMeta()`: also `if(rules.defaultLanguages)delete rules.defaultLanguages[l];if(rules.advancement)delete rules.advancement[l];`.
- The pool restore (the function that rebuilds from a saved pool, where `pack.requires=req[srcLabel(pack)]`):
  read `saved.defaultLanguages` and `saved.advancement` the same way as `saved.requires` and set
  `pack.defaultLanguages` / `pack.advancement` from them for the label, so `mergeRules()` re-stores them.

`src/js/88-settings.js` `prunePackMeta()`: `["requires","credits","defaultLanguages","advancement"].forEach(…)`.

`docs/rules-schema.md`: in §1 (pack-level fields), add `defaultLanguages` ("languages every
character of this ruleset knows; Fieldbook falls back to Common") and `advancement` ("XP thresholds as
`[[0,1],[300,2],…]`, ascending, one row per level from 1; Fieldbook falls back to the SRD's"), each with
a one-line example, in the section's existing style.

Docs for the fragment (keeps the `docs` suite green): `CLAUDE.md` and ADR-001 counts 33 → 34; an
overview code-map row `| \`41-chips.js\` | chips (defences, senses, languages), the advancement table, default languages | [Vitals & rest](features/vitals-and-rest.md) |`
after the `40-sheet.js` row; and in `vitals-and-rest.md`'s **Code:** line add
`` · `chipList()`, `xpProgress()`, `advancementFor()` in `41-chips.js` ``.

- [ ] **Step 4: Run every suite**

`./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/js/41-chips.js src/js/00-constants.js src/js/89-rules-merge.js src/js/88-settings.js src/manifest.json docs/rules-schema.md CLAUDE.md src/docs/ADR-001-source-split.md src/docs/wiki/overview.md src/docs/wiki/features/vitals-and-rest.md src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#103): chip lists, the advancement table, default languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The migrations

**Files:**
- Modify: `src/js/71-char-io.js` (`migrate()`), `src/js/75-home-theme.js` (`newCharacter()`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: Task 1's helpers.
- Produces: `mergeNoteInto(c, from, into, heading)`; `liftLanguages(c)`; `migrateSheet103(c)` (the
  #103 one-time work, called from `migrate()`).

- [ ] **Step 1: Write the failing tests**

`src/tests/sheet.js` — add `'mergeNoteInto', 'liftLanguages', 'migrateSheet103',` to `loadApp`; insert after Task 1's block:

```js
/* ---- #103: an old sheet comes forward (spec §5, §7, §11) ---- */
{
  const old = () => ({abilities: {}, system: 'dnd',
    proficiencies: 'Light armor.\nLanguages: Common, Elvish, Draconic\nTools: Thieves\' tools',
    secNotes: {class: {text: 'Took Life domain.', at: 5, editedAt: 9}, origin: {text: 'From the north.', at: 3, editedAt: 4},
               rest: {text: 'Short rests at noon.', at: 7, editedAt: 8}, portrait: {text: 'Scar on cheek.', at: 6, editedAt: 6}},
    combatSections: ['vitals', 'rest', 'statuses'], familiars: [{id: 'f', name: 'Owl'}]});
  const m = X.migrate(old());
  ck('#103 class and origin notes merge into Character', m.secNotes.portrait.text ===
     'Scar on cheek.\n\n**Class:**\nTook Life domain.\n\n**Ancestry & Background:**\nFrom the north.', m.secNotes.portrait.text);
  ck('#103 ...keeping the earlier start and the later edit', m.secNotes.portrait.at === 3 && m.secNotes.portrait.editedAt === 9);
  ck('#103 the merged notes are gone', !('class' in m.secNotes) && !('origin' in m.secNotes) && !('rest' in m.secNotes));
  ck('#103 the rest note merges into Vitals, created when absent', m.secNotes.vitals.text === '**Rest & Recovery:**\nShort rests at noon.', m.secNotes.vitals);
  ck('#103 the Languages line becomes chips', JSON.stringify(X.chipList(m, 'languages').map(l => l.name)) === '["Common","Elvish","Draconic"]' &&
     X.chipList(m, 'languages').every(l => l.src === ''));
  ck('#103 ...and leaves the rest of the text', m.proficiencies === 'Light armor.\nTools: Thieves\' tools', JSON.stringify(m.proficiencies));
  ck('#103 a migrated Common is not doubled by the default', X.chipList(m, 'languages').filter(l => l.name.toLowerCase() === 'common').length === 1);
  ck('#103 rest in the combat view becomes vitals, once', JSON.stringify(m.combatSections) === '["vitals","statuses"]', m.combatSections);
  ck('#103 a character with a familiar shows the icon', m.showFamiliars === true && X.migrate({abilities: {}}).showFamiliars === false);
  ck('#103 a stored choice is kept', X.migrate({abilities: {}, familiars: [{id: 'f', name: 'Owl'}], showFamiliars: false}).showFamiliars === false);
  const twice = X.migrate(JSON.parse(JSON.stringify(m)));
  ck('#103 migrating twice changes nothing', JSON.stringify(twice) === JSON.stringify(m));
  ck('#103 a sheet from before gets Common', JSON.stringify(X.chipList(X.migrate({abilities: {}, system: 'dnd'}), 'languages').map(l => [l.name, l.src])) === '[["Common","system"]]');
  ck('#103 junk lists are emptied, advancement guarded', (() => { const j = X.migrate({abilities: {}, resists: 'x', senses: [null, {name: 'Darkvision', range: '60'}], advancement: 'lots'});
    return j.resists.length === 0 && j.senses[0].range === 60 && typeof j.senses[0].id === 'string' && j.senses[0].id && j.advancement === 'xp'; })());
  const lift = {proficiencies: 'languages: Gnomish\nLanguages:   \nOther'};
  X.liftLanguages(lift);
  ck('#103 the lift is case-blind and drops an empty line', JSON.stringify(X.chipList(lift, 'languages').map(l => l.name)) === '["Gnomish"]' && lift.proficiencies === 'Other', lift);
  const n = {secNotes: {}};
  X.mergeNoteInto(n, 'class', 'portrait', 'Class');
  ck('#103 nothing to merge: nothing changes', JSON.stringify(n.secNotes) === '{}');
}
```

- [ ] **Step 2: Run to make sure they fail** — `LOAD FAIL` naming `mergeNoteInto`.

- [ ] **Step 3: Implement**

In `src/js/71-char-io.js`, above `function migrate(s){`:

```js
/* ---- #103: the Sheet makeover's one-time work. Every step is idempotent: a
   sheet already migrated has nothing left for it to find. ---- */
/* A removed section's note joins the one that took its place, under a heading
   naming where it came from; the earlier start and the later edit are kept. */
function mergeNoteInto(c,from,into,heading){
  const m=c.secNotes;if(!m||typeof m!=="object")return;
  const f=m[from];if(!f||typeof f!=="object"||Array.isArray(f))return;
  const t=String(f.text||"").trim();
  if(t){
    const to=(m[into]&&typeof m[into]==="object"&&!Array.isArray(m[into]))?m[into]:null;
    const prev=to?String(to.text||"").trim():"";
    const block="**"+heading+":**\n"+t;
    const nums=[to&&to.at,f.at].filter(x=>typeof x==="number");
    const eds=[to&&to.editedAt,f.editedAt].filter(x=>typeof x==="number");
    m[into]=Object.assign({},to||{},{text:prev?prev+"\n\n"+block:block});
    if(nums.length)m[into].at=Math.min(...nums);
    if(eds.length)m[into].editedAt=Math.max(...eds);
  }
  delete m[from];
}
/* "Languages: …" lines in Proficiencies become the player's own chips. */
function liftLanguages(c){
  const p=typeof c.proficiencies==="string"?c.proficiencies:"";
  if(!/^\s*languages\s*:/im.test(p))return;
  const found=[],keep=[];
  p.split("\n").forEach(line=>{const mm=/^\s*languages\s*:(.*)$/i.exec(line);if(mm)found.push(...langParse(mm[1]));else keep.push(line);});
  c.proficiencies=keep.join("\n").replace(/\n{3,}/g,"\n\n").trim();
  const have=chipClean(c.languages,"languages",true),names=new Set(have.map(x=>x.name.toLowerCase()));
  found.forEach(n=>{if(!names.has(n.toLowerCase())){have.push({id:uid(),name:n,src:""});names.add(n.toLowerCase());}});
  c.languages=have;
}
function migrateSheet103(c){
  CHIP_KEYS.forEach(k=>{c[k]=chipClean(c[k],k,true);});
  c.advancement=advancementOf(c);
  mergeNoteInto(c,"class","portrait","Class");
  mergeNoteInto(c,"origin","portrait","Ancestry & Background");
  mergeNoteInto(c,"rest","vitals","Rest & Recovery");
  if(Array.isArray(c.combatSections)){
    const out=[];c.combatSections.forEach(k=>{const v=k==="rest"?"vitals":k;if(!out.includes(v))out.push(v);});
    c.combatSections=out;
  }
  liftLanguages(c);
  ensureDefaultLanguages(c);
}
```

In `migrate(s)`: after the `migrateAmmo(base);` line and before `return base;`, add

```js
  /* #103: showFamiliars is decided from the FILE, so a stored choice wins and a
     sheet from before gets the icon only if it has a familiar. */
  base.showFamiliars=typeof s.showFamiliars==="boolean"?s.showFamiliars:base.familiars.length>0;
  migrateSheet103(base);
```

In `src/js/75-home-theme.js` `newCharacter()`, after `c.glossary=seedGlossary();` on that line, add
`ensureDefaultLanguages(c);` (it runs at runtime; `rules` exists).

- [ ] **Step 4: Run every suite** — all pass. If an existing test compared a whole migrated object to a
  fixed shape and now sees `languages`/`showFamiliars`, update its expectation and say which.

- [ ] **Step 5: Commit**

```bash
git add src/js/71-char-io.js src/js/75-home-theme.js src/tests/sheet.js
git commit -m "feat(#103): an old sheet's notes, languages and combat view come forward once

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Languages from species and backgrounds

**Files:**
- Modify: `src/js/52-race.js` (`grantFrom` inside the race-apply function, `removeRace()`),
  `src/js/54-background.js` (the background apply, `removeBackground()`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `chipClean`, `langParse` (Task 1).
- Produces: `grantLanguages(c, src, str)`; `dropLanguages(c, src)`.

- [ ] **Step 1: Write the failing tests**

Add `'grantLanguages', 'dropLanguages',` to `loadApp`; insert after Task 2's block:

```js
/* ---- #103: a species or background grants languages as chips (spec §5) ---- */
{
  const c = {languages: [{id: 'p', name: 'Elvish', src: ''}, {id: 's', name: 'Common', src: 'system'}]};
  X.grantLanguages(c, 'race:Elf', 'Common, Elvish and Sylvan');
  ck('#103 a grant adds what is missing, stamped with its source', JSON.stringify(c.languages.map(l => [l.name, l.src])) ===
     '[["Elvish",""],["Common","system"],["Sylvan","race:Elf"]]', c.languages);
  X.grantLanguages(c, 'bg:Sage', 'Sylvan, Draconic');
  ck('#103 a second grant does not double one', c.languages.filter(l => l.name === 'Sylvan').length === 1 && c.languages.some(l => l.name === 'Draconic' && l.src === 'bg:Sage'));
  X.dropLanguages(c, 'race:Elf');
  ck('#103 removing the species takes only its own', JSON.stringify(c.languages.map(l => l.name)) === '["Elvish","Common","Draconic"]', c.languages);
  X.grantLanguages(c, 'race:Odd', 42);
  ck('#103 a pack field that is not text grants nothing', c.languages.length === 3);
}
/* the real paths: apply and remove a species with languages */
{
  const savedRules = X.rules, savedChar = X.character;
  X.rules = Object.assign({}, X.rules, {races: [{name: 'Elf', languages: 'Common and Elvish', _source: 'SRD 5.2'}]});
  ctx.recomputeDups();
  X.character = X.migrate({abilities: {}, system: 'dnd'});
  ck('#103 the species apply function exists', typeof ctx.applyRace === 'function');
  ctx.applyRace('Elf');
  ck('#103 picking a species grants its languages as chips', X.chipList(X.character, 'languages').some(l => l.name === 'Elvish' && l.src === 'race:Elf'));
  ck('#103 ...and writes no Languages line', !/Languages:/i.test(X.character.proficiencies || ''));
  ctx.removeRace(false);
  ck('#103 removing it takes them back', !X.chipList(X.character, 'languages').some(l => l.name === 'Elvish'));
  X.rules = savedRules; X.character = savedChar;
}
```

(`applyRace(sel, subrace, opts)` and `applyBackground(sel, opts)` are the apply functions; if an
existing test in this suite passes `sel` differently — an id rather than the name — pass it the same way.)

- [ ] **Step 2: Run to make sure they fail**.

- [ ] **Step 3: Implement**

In `src/js/41-chips.js` append:

```js
/* Grants (#103): a species or background stamps its languages with the grant's
   source id ("race:Elf", "bg:Sage" — the same ids its other grants use), so
   removing it takes exactly those back. A language already present stays as
   it is: the player's own, or an earlier grant's. */
function grantLanguages(c,src,str){
  const have=chipClean(c.languages,"languages",true),names=new Set(have.map(x=>x.name.toLowerCase()));
  langParse(str).forEach(n=>{if(!names.has(n.toLowerCase())){have.push({id:uid(),name:n,src});names.add(n.toLowerCase());}});
  c.languages=have;
}
function dropLanguages(c,src){c.languages=chipClean(c.languages,"languages",true).filter(x=>x.src!==src);}
```

`src/js/52-race.js`, in `grantFrom` (the line beginning `if(obj.proficiencies||obj.languages){`):
replace it with

```js
    if(obj.proficiencies)character.proficiencies=(character.proficiencies?character.proficiencies+"\n":"")+obj.proficiencies;
    if(obj.languages)grantLanguages(character,"race:"+name,obj.languages);
```

(`name` there is the grant name already used for `"race:"+name` above it — for a subrace,
`name+" ("+subrace+")"`; `removeRace()` must drop both: in `removeRace()`, after
`removeGrants(g=>g.sid==="race:"+name);` add
`character.languages=chipClean(character.languages,"languages",true).filter(x=>!(x.src==="race:"+name||x.src.indexOf("race:"+name+" (")===0));`.)

`src/js/54-background.js`: replace `if(d.languages)notes.push("Languages: "+d.languages);` with
`if(d.languages)grantLanguages(character,"bg:"+name,d.languages);`; in `removeBackground()` after the
`removeGrants` line add `dropLanguages(character,"bg:"+name);`.

- [ ] **Step 4: Run every suite.** The rules-update tool (`72-char-update.js`) compares grants by
  source; if a test there now sees languages where it saw a Proficiencies line, update it and say which.

- [ ] **Step 5: Commit**

```bash
git add src/js/41-chips.js src/js/52-race.js src/js/54-background.js src/tests/sheet.js
git commit -m "feat(#103): species and backgrounds grant languages as chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The chip component, the chooser, Defences, the Bio card, print

**Files:**
- Modify: `src/js/41-chips.js`, `src/js/90-boot.js`, `src/js/87-notes.js` (registry, `NOTE_TABS`,
  `EDIT_CARDS`), `src/js/71-char-io.js` (print), `src/html/00-sheet.html` (the Defences card, placed for
  now directly above Statuses), `src/html/30-story.html`, `src/fieldbook.template.html` (the Story tab's
  label), `src/css/20-cards.css`
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: Task 1–3.
- Produces: `CHIP_SUGGEST` (`{resists, immunes, senses}` suggestion lists); `chipsHTML(c, key, opts)`;
  `chipChooserHTML(c, key)`; `openChipChooser(key)`; `addChip(c, key, name, range)`;
  `removeChip(c, key, id)`; `renderDefences()`; `renderBioChips()`.

- [ ] **Step 1: Write the failing tests**

`sheet.js` — add the names above to `loadApp`; insert after Task 3's blocks:

```js
/* ---- #103: the chip component (spec §8) ---- */
{
  const c = {resists: [{id: 'r1', name: 'Fire'}], senses: [{id: 's1', name: 'Darkvision', range: 60}],
             languages: [{id: 'l1', name: 'Common', src: 'system'}, {id: 'l2', name: 'Elvish', src: 'race:Elf'}, {id: 'l3', name: 'Draconic', src: ''}]};
  const r = X.chipsHTML(c, 'resists');
  ck('#103 a chip, in capitals, with an × the pencil hides', r.includes('>FIRE<button type="button" class="chip-x ed" data-chipdel="resists" data-chipid="r1"'), r);
  ck('#103 + Add opens the chooser', r.includes('data-chipadd="resists"'));
  ck('#103 a sense shows its range', X.chipsHTML(c, 'senses').includes('60 ft'));
  const l = X.chipsHTML(c, 'languages');
  ck('#103 a granted language shows its source and has no ×', l.includes('COMMON<span class="chip-src"> · rules</span>') && l.includes('ELVISH<span class="chip-src"> · species</span>') &&
     !l.includes('data-chipid="l1"') && !l.includes('data-chipid="l2"') && l.includes('data-chipid="l3"'), l);
  ck('#103 an empty list says None', X.chipsHTML({immunes: []}, 'immunes').includes('None'));
  ck('#103 names are escaped', X.chipsHTML({resists: [{id: 'x', name: '<b>'}]}, 'resists').includes('>&lt;B&gt;<button') && !X.chipsHTML({resists: [{id: 'x', name: '<b>'}]}, 'resists').includes('<B>'));
  const ch = X.chipChooserHTML({resists: [{id: 'r1', name: 'Fire'}]}, 'resists');
  ck('#103 the chooser offers the damage types, Fire marked added', X.CHIP_SUGGEST.resists.length === 13 && /data-chippick="Fire"[^>]*disabled/.test(ch) && ch.includes('data-chippick="Cold"'));
  ck('#103 immunities also offer conditions', X.CHIP_SUGGEST.immunes.includes('Poisoned') && X.CHIP_SUGGEST.immunes.includes('Poison'));
  ck('#103 senses offer the four, with a range box', JSON.stringify(X.CHIP_SUGGEST.senses) === '["Blindsight","Darkvision","Tremorsense","Truesight"]' && X.chipChooserHTML({}, 'senses').includes('id="chipRange"'));
  const a = {resists: []};
  X.addChip(a, 'resists', ' fire '); X.addChip(a, 'resists', 'FIRE'); X.addChip(a, 'resists', '');
  ck('#103 add trims, refuses blanks and duplicates', a.resists.length === 1 && a.resists[0].name === 'fire');
  X.addChip(a, 'senses', 'Darkvision', '60');
  ck('#103 a sense keeps its range', a.senses[0].range === 60);
  X.removeChip(a, 'resists', a.resists[0].id);
  ck('#103 remove by id', a.resists.length === 0);
  const g = {languages: [{id: 'l2', name: 'Elvish', src: 'race:Elf'}]};
  X.removeChip(g, 'languages', 'l2');
  ck('#103 a granted chip cannot be removed by hand', g.languages.length === 1);
}
```

`rules-data.js` — in the #97 block that pins `EDIT_CARDS`'s exact list (and in `sheet.js`'s
`'#97 the twelve cards'` check), the list gains `defences` and `proficiencies` — update both
expectations to:
`['class','origin','statuses','attacks','resources','features','familiars','spells','inventory','trackers','journal','secnotes','defences','proficiencies']`
(Task 7 removes `class` and `origin`). Add to the template checks:

```js
{
  const t = loadHTML();
  ck('#103 the Defences card is registered and in the template', t.includes('<div class="card" data-note="defences"') && X.noteDef('defences') && X.noteDef('defences').tab === 'sheet');
  ck('#103 the Story tab reads Bio', /data-tab="story"[^>]*>[\s\S]{0,200}Bio/.test(t) && X.NOTE_TABS.story === 'Bio');
  ck('#103 the Bio card holds alignment and the chip rows',
     /data-note="proficiencies"[\s\S]*data-path="character.alignment"[\s\S]*id="bioLanguages"[\s\S]*id="bioSenses"/.test(t));
}
```

and change `ck('the registry has 20 sections', … === 20 …)` to 21 (and the `=== 20` card count beside
it to 21), and the registry title check for `proficiencies` to the new heading
"Proficiencies, Senses & Languages".

- [ ] **Step 2: Run to make sure they fail.**

- [ ] **Step 3: Implement**

`src/js/41-chips.js` append:

```js
/* ---- the component ---- */
const CHIP_SUGGEST={
  resists:["Acid","Bludgeoning","Cold","Fire","Force","Lightning","Necrotic","Piercing","Poison","Psychic","Radiant","Slashing","Thunder"],
  immunes:["Acid","Bludgeoning","Cold","Fire","Force","Lightning","Necrotic","Piercing","Poison","Psychic","Radiant","Slashing","Thunder",
    "Blinded","Charmed","Deafened","Exhaustion","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious"],
  senses:["Blindsight","Darkvision","Tremorsense","Truesight"]
};
const CHIP_SRC={system:"rules",race:"species",bg:"background"};
function chipSrcLabel(src){const k=String(src||"").split(":")[0];return CHIP_SRC[k]||"";}
function chipsHTML(c,key){
  const list=chipList(c,key);
  const chips=list.map(x=>{
    const src=key==="languages"?chipSrcLabel(x.src):"";
    const range=key==="senses"&&x.range!==""?` · ${esc(String(x.range))} ft`:"";
    const del=src?"":`<button type="button" class="chip-x ed" data-chipdel="${esc(key)}" data-chipid="${esc(x.id)}" aria-label="${esc("Remove "+x.name)}">×</button>`;
    return `<span class="chip chip-${esc(key)}">${esc(x.name.toUpperCase())}${range}${src?`<span class="chip-src"> · ${esc(src)}</span>`:""}${del}</span>`;
  }).join("");
  return `<div class="chips">${chips||`<span class="chip-none">None</span>`}<button type="button" class="chip chip-add" data-chipadd="${esc(key)}">+ Add</button></div>`;
}
function chipChooserHTML(c,key){
  const have=new Set(chipList(c,key).map(x=>x.name.toLowerCase()));
  const sug=key==="languages"?chipPackLanguages():(CHIP_SUGGEST[key]||[]);
  const pills=sug.map(n=>{const on=have.has(n.toLowerCase());return `<button type="button" class="fpill${on?" on":""}" data-chippick="${esc(n)}"${on?" disabled":""}>${esc(n)}${on?" ✓":""}</button>`;}).join("");
  return (pills?`<div class="fgrp chip-sug">${pills}</div>`:"")+
    `<div class="field"><label class="f" for="chipName">Or type one</label><input id="chipName" autocomplete="off"></div>`+
    (key==="senses"?`<div class="field"><label class="f" for="chipRange">Range (feet)</label><input id="chipRange" inputmode="numeric" placeholder="60"></div>`:"")+
    `<div class="rowbtns"><button type="button" class="tbtn primary" id="chipOk">Add</button><button type="button" class="tbtn" id="chipCancel">Cancel</button></div>`;
}
/* the languages the loaded packs name, for the chooser's pills */
function chipPackLanguages(){
  const out=new Set();
  ["races","backgrounds"].forEach(k=>(Array.isArray(rules[k])?rules[k]:[]).forEach(e=>{if(e&&typeof e.languages==="string")langParse(e.languages).forEach(n=>out.add(n));}));
  Object.keys(rules.defaultLanguages||{}).forEach(l=>(rules.defaultLanguages[l]||[]).forEach(n=>typeof n==="string"&&out.add(n)));
  return [...out].sort((a,b)=>a.localeCompare(b));
}
function addChip(c,key,name,range){
  const n=String(name==null?"":name).trim();if(!n)return false;
  const list=chipClean(c[key],key,true);
  if(list.some(x=>x.name.toLowerCase()===n.toLowerCase()))return false;
  const e={id:uid(),name:n};
  if(key==="senses"){const r=parseInt(String(range==null?"":range).trim(),10);e.range=(isFinite(r)&&r>0)?r:"";}
  if(key==="languages")e.src="";
  list.push(e);c[key]=list;return true;
}
/* a granted language is the grant's to take back, not the player's */
function removeChip(c,key,id){c[key]=chipClean(c[key],key,true).filter(x=>!(x.id===id&&!(key==="languages"&&x.src)));}
const CHIP_TITLE={resists:"Add a resistance",immunes:"Add an immunity",senses:"Add a sense",languages:"Add a language"};
function openChipChooser(key){
  openModal(CHIP_TITLE[key]||"Add",chipChooserHTML(character,key));
  const done=(name)=>{const rng=document.getElementById("chipRange");if(addChip(character,key,name,rng?rng.value:"")){closeModal();renderChipsAll();scheduleSave();}};
  document.querySelectorAll("[data-chippick]").forEach(b=>b.addEventListener("click",()=>done(b.dataset.chippick)));
  const ok=document.getElementById("chipOk");if(ok)ok.addEventListener("click",()=>{const i=document.getElementById("chipName");done(i?i.value:"");});
  const cn=document.getElementById("chipCancel");if(cn)cn.addEventListener("click",closeModal);
}
function renderDefences(){
  const r=document.getElementById("defResists"),i=document.getElementById("defImmunes");
  if(r)r.innerHTML=chipsHTML(character,"resists");
  if(i)i.innerHTML=chipsHTML(character,"immunes");
}
function renderBioChips(){
  const l=document.getElementById("bioLanguages"),s=document.getElementById("bioSenses");
  if(l)l.innerHTML=chipsHTML(character,"languages");
  if(s)s.innerHTML=chipsHTML(character,"senses");
}
function renderChipsAll(){renderDefences();renderBioChips();}
```

`src/html/00-sheet.html`: directly above the Statuses card, add

```html
        <div class="card" data-note="defences">
          <div class="label">Defences <span class="grow"></span></div>
          <div class="def-h">Resistances</div><div id="defResists"></div>
          <div class="def-h">Immunities</div><div id="defImmunes"></div>
        </div>
```

`src/html/30-story.html`: the `proficiencies` card's heading becomes
`Proficiencies, Senses &amp; Languages`; inside it, before its rich-text field, add the Alignment field
(moved from `00-sheet.html`'s portrait card — delete it there; keep `data-path="character.alignment"`)
and

```html
          <div class="def-h">Languages</div><div id="bioLanguages"></div>
          <div class="def-h">Senses</div><div id="bioSenses"></div>
```

`src/fieldbook.template.html`: the tab button whose `data-tab="story"` keeps that attribute; its visible
label text becomes `Bio` (keep its icon). `src/js/87-notes.js`: `NOTE_TABS.story` → `"Bio"`; add
`{k:"defences", tab:"sheet", title:"Defences"}` to `NOTE_SECTIONS` directly before `statuses`; change
`proficiencies`' title to `"Proficiencies, Senses & Languages"`; `EDIT_CARDS` gains `"defences"` and
`"proficiencies"` (appended).

`renderAll()` (`66-coins-hp.js`): add `renderChipsAll();` after `renderStatuses();`.

`90-boot.js` delegated click, beside the other card handlers:

```js
    if((m=t.closest("[data-chipadd]")))return openChipChooser(m.dataset.chipadd);
    if((m=t.closest("[data-chipdel]"))){removeChip(character,m.dataset.chipdel,m.dataset.chipid);renderChipsAll();scheduleSave();return;}
```

`src/css/20-cards.css`: chips — `.chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}`;
`.chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:5px;font-family:var(--head);font-size:12px;font-weight:700;letter-spacing:.04em;background:var(--accent-2);color:#fff}`;
`.chip-languages,.chip-senses{background:var(--field);color:var(--ink);border:1.5px solid var(--line)}`;
`.chip-src{font-weight:400;opacity:.75;text-transform:none}`;
`.chip-x{background:none;border:0;color:inherit;cursor:pointer;padding:0 0 0 2px;font-size:14px;line-height:1}`;
`.chip-add{background:none;color:var(--ink-soft);border:1.5px dashed var(--line);cursor:pointer}`;
`.chip-none{color:var(--ink-soft);font-size:13px}`;
`.def-h{font-family:var(--head);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft);margin:6px 0 4px;border-bottom:1.5px solid var(--line)}`.
(Theme tokens only; check the names exist in `00-tokens.css` and use the nearest real ones.)

Print (`71-char-io.js`, the print builder): where it prints proficiencies, add lines for Resistances,
Immunities, Senses (with ranges) and Languages from `chipList()`, each only when non-empty, escaped like
the lines around them.

- [ ] **Step 4: Run every suite.** Update any test that pinned the old proficiencies title or the
  Story tab's label, and say which.

- [ ] **Step 5: Commit**

```bash
git add src/js/41-chips.js src/js/90-boot.js src/js/87-notes.js src/js/66-coins-hp.js src/js/71-char-io.js src/html/00-sheet.html src/html/30-story.html src/fieldbook.template.html src/css/20-cards.css src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#103): chips for defences, senses and languages; Story is Bio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The hit-dice bar and the spend box

**Files:**
- Modify: `src/js/65-resources.js` (`renderHitDice()`, `rollHitDie()`; remove `hdStyle()`,
  `hdFullHTML`, `hdCondensedHTML`, `hdDiceHTML`, `hdPips`), `src/js/90-boot.js` (`[data-hdroll]`,
  `[data-hddie]`, `[data-hd]` handlers), `src/js/88-settings.js` (remove the "Hit Dice display" row and
  its `segHdStyle` wiring), `src/css/30-sheet.css`
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Produces: `hdSpendCheck(die, typed) → {ok, roll, why}`; `hdHeal(roll, conMod) → number`;
  `hdBarHTML(pool, conMod)`; `hdSpendHTML(pool, sel, conMod, curHP, maxHP)`; `openHdSpend()`;
  `spendHitDie(die, roll)`; `hdConMod()`.

- [ ] **Step 1: Write the failing tests**

```js
/* ---- #103: spending a hit die (spec §6.3) ---- */
{
  ck('#103 a typed roll must be a whole number from 1 to the die',
     X.hdSpendCheck('d8', '8').ok && X.hdSpendCheck('d8', ' 5 ').roll === 5 &&
     ['0', '9', '4.5', '', 'abc', '-1'].every(v => !X.hdSpendCheck('d8', v).ok && X.hdSpendCheck('d8', v).why));
  ck('#103 the heal is roll + CON, never below 0', X.hdHeal(5, 5) === 10 && X.hdHeal(1, -3) === 0 && X.hdHeal(3, -1) === 2);
  const pool = [{die: 'd8', total: 15, used: 3, cls: 'Cleric'}, {die: 'd10', total: 2, used: 2, cls: 'Fighter'}];
  const bar = X.hdBarHTML(pool, 5);
  ck('#103 the bar: die, left of total, CON', bar.includes('d8') && bar.includes('12 / 15') && bar.includes('CON +5') && bar.includes('data-hdspend'));
  const box = X.hdSpendHTML(pool, 'd8', 5, 88, 153);
  ck('#103 the box: a row per die, used −/+, both ways to spend', box.includes('data-hdpick="d8"') && box.includes('data-hdpick="d10"') &&
     box.includes('data-hdused="d8"') && box.includes('id="hdRollMe"') && box.includes('id="hdTyped"') && box.includes('id="hdApply"'));
  ck('#103 a die type with none left cannot be picked', /data-hdpick="d10"[^>]*disabled/.test(box));
  ck('#103 the box keeps auto / manual', box.includes('data-hdmode'));
}
```

`rules-data.js`: the Settings test that lists the "Cards" rows (search for `segHdStyle`) — assert it is
gone: `ck('#103 the Hit Dice display setting is retired', !/segHdStyle|data-hdstyle/.test(fs.readFileSync(path.join(ROOT,'src/js/88-settings.js'),'utf8')));`.
The template tests that require `#hitdiceInput` and `[data-hdmode]` inside the Rest card: Task 5 keeps
them there for now (Task 7 moves them) — they need no change yet.

- [ ] **Step 2: Run to make sure they fail.**

- [ ] **Step 3: Implement** in `src/js/65-resources.js`:

```js
/* ---- #103: the hit-dice bar and the spend box ----
   One bar per character; tapping it opens the box. The maths is the old
   rollHitDie()'s, shared by both ways of spending. */
function hdConMod(){return Math.floor((abilFinal("con",contributions())-10)/2);}
function hdHeal(roll,conMod){return Math.max(0,roll+conMod);}
function hdSpendCheck(die,typed){
  const n=parseInt(String(die).slice(1),10)||8, s=String(typed==null?"":typed).trim();
  if(!/^\d+$/.test(s))return {ok:false,roll:0,why:"Type the number you rolled."};
  const r=parseInt(s,10);
  if(r<1||r>n)return {ok:false,roll:r,why:`A ${die} rolls 1 to ${n}.`};
  return {ok:true,roll:r,why:""};
}
function hdBarHTML(pool,conMod){
  const left=pool.reduce((a,p)=>a+(p.total-p.used),0),total=pool.reduce((a,p)=>a+p.total,0);
  const dice=pool.map(p=>`${esc(p.die)} · ${esc(String(p.total-p.used))} / ${esc(String(p.total))}`).join(" &nbsp; ");
  const pct=total?Math.round(100*left/total):0;
  return `<div class="hd-lbl">Hit dice <span class="hd-con">CON ${conMod>=0?"+":"−"}${esc(String(Math.abs(conMod)))}</span></div>`+
    `<button type="button" class="hd-bar" data-hdspend aria-label="Spend a hit die"><i style="width:${esc(String(pct))}%"></i><span>${dice}</span></button>`;
}
function hdSpendHTML(pool,sel,conMod,cur,max){
  const rows=pool.map(p=>{const left=p.total-p.used;
    return `<div class="hd-pick${p.die===sel?" on":""}"><button type="button" class="hd-pickbtn" data-hdpick="${esc(p.die)}"${left?"":" disabled"}>`+
      `<b>${esc(p.die)}</b> ${esc(p.cls||"")} · ${esc(String(left))} / ${esc(String(p.total))}</button>`+
      `<span class="hd-used">used <button type="button" class="tbtn" data-hdused="${esc(p.die)}" data-d="-1" aria-label="${esc("Un-spend a "+p.die)}">−</button>`+
      `<button type="button" class="tbtn" data-hdused="${esc(p.die)}" data-d="1" aria-label="${esc("Mark a "+p.die+" spent")}">+</button></span></div>`;}).join("");
  return rows+
    `<div class="hd-how"><button type="button" class="tbtn primary" id="hdRollMe">🎲 Roll for me</button> <span>or</span> `+
    `<label>I rolled <input id="hdTyped" inputmode="numeric" size="3"></label> <button type="button" class="tbtn" id="hdApply" disabled>Apply</button></div>`+
    `<div class="hd-res" id="hdRes" aria-live="polite"></div>`+
    `<div class="hd-foot">Hit dice <button class="hd-mode" data-hdmode title="Toggle auto (from class) vs manual">${character.hdManual?"manual":"auto"}</button> `+
    `<input data-path="character.hitdice" id="hitdiceInput" placeholder="3d10"${character.hdManual?"":" readonly hidden"} aria-label="Hit Dice"></div>`;
}
/* Spend one `die` with this roll: mark it used, heal through adjustHP, report. */
function spendHitDie(die,roll){
  const p=hitDicePool().find(x=>x.die===die);if(!p||p.used>=p.total)return;
  const conMod=hdConMod(),heal=hdHeal(roll,conMod);
  adjustHP(heal);
  if(!character.hdUsed)character.hdUsed={};character.hdUsed[die]=num(character.hdUsed[die])+1;
  renderHP();renderHitDice();recompute();scheduleSave();
  restSummary("Hit die spent — "+die,[`Rolled ${roll} ${conMod>=0?"+":"−"} ${Math.abs(conMod)} CON = ${heal} HP`,`Current HP: ${character.hp.cur}`],"");
}
function rollHitDie(die){const n=parseInt(String(die).slice(1),10)||8;spendHitDie(die,1+Math.floor(Math.random()*n));}
```

(`hitDicePool()` entries: read it; if they lack `cls`, add the class name where it is built — it already
knows each die's class — or render the box without it. `#hitdiceInput` and `[data-hdmode]` now exist
twice until Task 7 removes the Rest card's copies: in this task, REMOVE them from the Rest card in
`00-sheet.html` so each id exists once — the spend box is their only home; the mode pill's existing
handler (`90-boot.js` `[data-hdmode]`) works wherever it is.)

`openHdSpend()`: `openModal("Spend a hit die", hdSpendHTML(pool, sel, hdConMod(), character.hp.cur, effMax))`
with `sel` the first die with any left; wire inside it:
- `[data-hdpick]` → re-open with that die selected;
- `[data-hdused]` → `character.hdUsed[die]` ± 1, clamped 0…total, `renderHitDice()`, re-open (no HP change);
- `#hdTyped` `input` → run `hdSpendCheck(sel, value)`; show `${roll} + CON ${conMod} = ${hdHeal(roll,conMod)} HP → ${cur+heal capped} / ${max}`
  in `#hdRes` when ok, else the `why`; enable `#hdApply` only when ok;
- `#hdApply` → `spendHitDie(sel, roll)`, `closeModal()`; `#hdRollMe` → `rollHitDie(sel)`, `closeModal()`.

`renderHitDice()`: keep the auto-mode `hdString` write; `#hdWrap` gets `hdBarHTML(pool, hdConMod())`
(or the existing "Add a class…" hint when the pool is empty); delete the three style branches.
`90-boot.js`: `[data-hdspend]` → `openHdSpend()`; delete the `[data-hdroll]`, `[data-hddie]` and `[data-hd]`
handlers (their markup is gone). `88-settings.js`: delete the Hit Dice display row and its wiring.
CSS (`30-sheet.css`): `.hd-bar` a full-width button with a fill `i` (width set inline) and the text
over it, matching the HP bar Task 7 adds; `.hd-pick.on` highlighted; the box's rows in a column.

- [ ] **Step 4: Run every suite.** Tests that drove the old pips (`data-hd`, `data-hddie`, `hdStyle`)
  are replaced by the ones above; delete the obsolete ones and list them in your report.

- [ ] **Step 5: Commit**

```bash
git add src/js/65-resources.js src/js/90-boot.js src/js/88-settings.js src/html/00-sheet.html src/css/30-sheet.css src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#103): spend a hit die by rolling or entering your own roll

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The header, its flyouts, and the familiar icon

**Files:**
- Modify: `src/html/00-sheet.html` (a `#sheetHead` band added above `.cols`), `src/js/50-classrace.js`,
  `src/js/52-race.js` / `54-background.js` (Change / Remove in the info windows), `src/js/40-sheet.js`,
  `src/js/88-settings.js` (Advancement and familiar-icon rows), `src/js/90-boot.js`, `src/css/30-sheet.css`
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: `xpProgress`, `advancementOf` (Task 1); `openClassInfo`, `openSubclassInfo`,
  `openRaceInfo`, `openBackgroundInfo` (by name, no `opts`), `doLevelUp`, `doLevelDown`, `openAddClass`,
  `openAddRace`, `openAddBackground`, `removeClass(i)`, `removeRace()`, `removeBackground()`.
- Produces: `sheetHeadHTML(c)`; `classLineHTML(c)`; `classFlyHTML(c, i)`; `levelBadgeHTML(c)`;
  `familiarCardHTML(f)` (extracted from `renderFamiliars()`); `famFlyHTML(c)`; `renderSheetHead()`;
  `openFamiliar(id)`.

**The header's markup** (`#sheetHead`, a `<header class="sheet-head">` inside `#tab-sheet`, above `.cols`):
1. `<input class="sh-name" data-path="character.name" placeholder="Character name" aria-label="Character name">`
   — MOVED from the portrait card (delete it there). The portrait card's **Experience** field and its
   **Level** box are deleted too: XP lives in the header (item 4) and `#levelDisp` is rendered inside
   the header's ring by `levelBadgeHTML()` (so `recompute()`'s write to it still lands).
2. `<div class="sh-sub" id="shSub">` filled by `classLineHTML(c)`: each class as
   `<button type="button" class="sh-cls" data-shcls="${esc(i)}">${esc(name)} ${esc(level)}</button>`
   joined by " · "; with none, `<button … data-shaddcls>+ Class</button>`; then " · " and the species
   (`data-shrace`, or `+ Species` → `openAddRace()`), then the background (`data-shbg`, or `+ Background`).
3. Icons, right: `<button class="sh-ico" id="btnShortRest" title="Short rest">☕</button>`,
   `<button class="sh-ico" id="btnLongRest" title="Long rest">☾</button>` (the same ids, MOVED from the Rest
   card, so the existing `on("btnShortRest")` wiring keeps working), the inspiration
   `<button class="starbtn" id="starBtn" …>` MOVED from the Vitals label (same id and attributes), and,
   when `character.showFamiliars`, `<button class="sh-ico sh-paw${n?"":" faint"}" data-shpaw aria-label="Familiars">🐾</button>`.
4. `<span id="shLevel">` filled by `levelBadgeHTML(c)`: a ring with the total level; in XP mode, an
   `<input class="sh-xp" data-path="character.xp" inputmode="numeric" aria-label="Experience points">` and, when
   `xpProgress(c)` is not null, a bar `<span class="sh-xpbar"><i style="width:${pct}%"></i></span>` with
   `title` "183,000 / 195,000" (numbers with `toLocaleString("en-US")`); `ready` → the ring gets class `ready` and reads "Level up ready"
   (`data-shlevelup`, tapping it opens `doLevelUp()`). Milestone mode: the ring only.
5. The icons sit in a `<div class="label sh-bar"><span class="sh-cap">Character</span><span class="grow"></span>…icons…</div>`:
   a `.label`, so that in Task 7 — when the header takes over the `portrait` section — the note button,
   the combat toggle and the ☰ entry ("Character", from `.sh-cap`, visually hidden) find it the way they
   find every card's heading. In this task the header has no `data-note` yet.

**Flyouts:** `classFlyHTML(c, i)` — a small popover under the tapped class: "About Cleric"
(`<button data-shinfo="${esc(i)}">`, → `openClassInfo(name)`), the subclass (link to `openSubclassInfo`,
or Choose → `chooseSubclass(name)`), "▲ Level up" (`data-shlevel="up"` → `doLevelUp`), "▼ Level down"
(`data-shlevel="down"` → `doLevelDown`), "+ Add class" (`data-shaddcls` → `openAddClass`), "Remove"
(the existing `[data-del-class]` confirm path, `data-del-class="${esc(i)}"`). The flyout uses no ids:
the Class card's `#btnLevelUp` / `#btnLevelDown` stay where they are until Task 7 deletes them. Species and background open their info
windows; add to `openRaceInfo`/`openBackgroundInfo`, when called WITHOUT `{ref:true}` and the character
has that species/background, a foot: `<div class="rowbtns"><button class="tbtn" data-shchange="race">Change</button><button class="tbtn danger" data-del-race="1">Remove</button></div>`
(background: `data-shchange="bg"`, `data-del-bg="1"`; Change opens the Add picker, which replaces).

**Familiars:** extract `familiarCardHTML(f)` — the per-familiar markup `renderFamiliars()` builds today —
and have `renderFamiliars()` use it (no visible change). `famFlyHTML(c)`: one row per familiar
`<button data-shfam="${esc(f.id)}">${esc(f.name||"Familiar")} <span>${f.active?"●":"○"}</span></button>`,
then `<button data-add="familiar">+ Add familiar</button>` (the existing add handler). `openFamiliar(id)`:
`openModal(f.name, familiarCardHTML(f))` — its Summon/Dismiss, Edit and Delete are the existing
`data-toggle-familiar` / `data-edit-familiar` / `data-del-familiar` buttons, handled by the existing
delegated handlers (after a toggle, re-open the modal so its state repaints).

**Settings → This character** (`88-settings.js`, beside Ammo recovery): "Advancement" — a
`seg` with XP / Milestone writing `character.advancement`; "Familiars & companions icon" — a switch
writing `character.showFamiliars`. Both `renderSheetHead()` + `scheduleSave()` on change.

**Wiring** (`90-boot.js` delegated click): `[data-shcls]` → open its flyout; `[data-shaddcls]` →
`openAddClass()`; `[data-shrace]`/`[data-shbg]` → `openRaceInfo(name)` / `openBackgroundInfo(name)`;
`[data-shchange]` → the Add picker; `[data-shinfo]` → `openClassInfo(name)`; `[data-shlevel]` →
`doLevelUp()` / `doLevelDown()`; `[data-shpaw]` → the familiars flyout; `[data-shfam]` →
`openFamiliar(id)`; `[data-shlevelup]` → `doLevelUp()`. A tap outside a flyout closes it (the
popover pattern the ☰ flyout uses). `renderSheetHead()` runs from `renderAll()` and after anything that
changes classes, species, background, XP, advancement or familiars (`renderClassRace()` calls it).

- [ ] **Step 1: Write the failing tests** (`sheet.js`):

```js
/* ---- #103: the header (spec §6.1, §6.6) ---- */
{
  const c = X.migrate({abilities: {}, system: 'dnd', name: 'Hobbs', xp: '183,000', classes: [{name: 'Cleric', level: 15}],
    race: {name: 'Half-Elf'}, bg: {name: 'Acolyte'}, familiars: [{id: 'f1', name: 'A very long owl name', active: true}, {id: 'f2', name: 'Cat'}]});
  const line = X.classLineHTML(c);
  ck('#103 the class line: each class, species, background, tappable', line.includes('data-shcls="0"') && line.includes('Cleric 15') && line.includes('data-shrace') && line.includes('Half-Elf') && line.includes('Acolyte'));
  ck('#103 no class: + Class', X.classLineHTML(X.migrate({abilities: {}})).includes('data-shaddcls'));
  const lv = X.levelBadgeHTML(c);
  ck('#103 XP mode: the XP field and a bar to the next level', lv.includes('data-path="character.xp"') && lv.includes('sh-xpbar') && lv.includes('195,000'));
  ck('#103 ready: the badge offers Level up', X.levelBadgeHTML(Object.assign({}, c, {xp: '200000'})).includes('data-shlevelup'));
  ck('#103 Milestone: the ring only', !X.levelBadgeHTML(Object.assign({}, c, {advancement: 'milestone'})).includes('character.xp'));
  const fly = X.famFlyHTML(c);
  ck('#103 the familiar flyout: name and abbreviated status per familiar, + Add', fly.includes('data-shfam="f1"') && fly.includes('●') && fly.includes('○') && fly.includes('data-add="familiar"'));
  ck('#103 the familiar card markup is shared with the list', X.familiarCardHTML(c.familiars[0]).includes('data-toggle-familiar="f1"'));
  const cf = X.classFlyHTML(c, 0);
  ck('#103 the class flyout: info, level up/down, add, remove', ['data-shinfo="0"', 'data-shlevel="up"', 'data-shlevel="down"', 'data-shaddcls', 'data-del-class="0"'].every(s => cf.includes(s)), cf);
  ck('#103 the XP shows with thousands separators', X.levelBadgeHTML(c).includes('183,000 / 195,000'));
}
```

and in `rules-data.js` a template check that `#sheetHead` holds `data-path="character.name"`,
`id="btnShortRest"`, `id="btnLongRest"`, `id="starBtn"`, `id="shSub"`, `id="shLevel"`, each id exactly
once in the whole template.

- [ ] **Step 2–4:** fail, implement as specified above (theme tokens; the header band uses the accent
  colour family so both skins follow), run every suite. Update the tests that required `#starBtn` in
  the Vitals label row and the rest buttons in the Rest card, to the header, and say which.

- [ ] **Step 5: Commit**

```bash
git add src/html/00-sheet.html src/js/50-classrace.js src/js/52-race.js src/js/54-background.js src/js/40-sheet.js src/js/88-settings.js src/js/90-boot.js src/js/66-coins-hp.js src/css/30-sheet.css src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#103): the sheet header — class, species, rests, inspiration, level and XP, familiars

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The new layout — rail, ability strip, columns; Attacks to Inventory

**Files:**
- Modify: `src/html/00-sheet.html` (rewritten under the header), `src/html/10-inventory.html` (Attacks
  card, top), `src/js/00-constants.js` (`buildAbilities()` as the strip, `buildSkills()` and
  `buildStats()` without the grouped branch, `placeLegend()` to the Skills card only), `src/js/87-notes.js`
  (registry), `src/js/87-combat.js` (anything keyed on the removed cards), `src/js/88-settings.js` (remove
  the Skills display row), `src/js/66-coins-hp.js` (`renderHP()` as a bar), `src/js/40-sheet.js`
  (`renderFamiliars()` card hidden on the Sheet; `jumpToNote('familiars')` opens the paw flyout),
  `src/css/10-chrome.css`, `src/css/30-sheet.css`, `src/css/45-combat.css` (rail cards in the view)
- Test: `src/tests/rules-data.js`, `src/tests/sheet.js`

**The Sheet's markup** (under `#sheetHead`), as the mockups show:

```
<div class="sheet-grid">
  <div class="card rail" data-note="vitals">            ← the rail
    portrait (#portrait, #btnPortrait, #btnPortraitDel, #filePortrait — MOVED from the portrait card)
    AC shield (#acDisp) below the portrait, overlapping its bottom edge
    death saves: #deathSucc ✓ · <span class="dskull">&#9760;&#65038;</span> · #deathFail ✗
    badges: Init (#initDisp) · Speed (#speedDisp, with #encPill where it is today) · Prof (#pbDisp)
    HP: label + the padlock ([data-hplock]); #hpMinus · a bar holding #hpCur / #hpMax inputs + #hpTemp · #hpPlus; #maxNote
    hit dice: #hdWrap (Task 5's bar)
    small line: Size (#sizeDisp, its picker) · Passive Perception (#passDisp)
  </div>
  <div class="card strip" data-note="abilities"><div class="abilities" id="abilities"></div></div>
  <div class="card" data-note="skills" id="skillsCard"> … #skills, #statLegend … </div>
  <div class="col-r">  defences · statuses · resources (existing cards, MOVED) </div>
  <div class="card wide" data-note="features"> … existing … </div>
  <div class="card" data-note="familiars" id="familiarCard" style="display:none"> … existing … </div>
  <button class="mini" id="addFamiliarLink" hidden> … existing … </button>
</div>
```

- The **header becomes the `portrait` section**: it starts `<header class="card sheet-head" data-note="portrait" id="sheetHead">`
  and its `.sh-bar` (Task 6) is the `.label` the note button, the combat toggle and the ☰ read. The
  registry's template tests accept it: the literal-prefix count counts both `<div class="card" data-note="`
  and `<header class="card sheet-head" data-note="`.
- **Delete** the Class, Ancestry & Background and Rest cards (their content now lives in the header and
  the rail), with `#raceBgBox`, `#classBox`, `#craceWord`, `#btnLevelUp`, `#btnLevelDown`. **Delete the two
  boot lines** `document.getElementById("btnLevelUp").addEventListener(…)` and
  `document.getElementById("btnLevelDown").addEventListener(…)` in `90-boot.js` — an unguarded
  `getElementById` on a removed id throws in `wire()` and leaves the sheet inert (the trap in
  [Vitals & rest](../wiki/features/vitals-and-rest.md)); Task 6's `[data-shlevel]` handler replaces them.
  `renderClassRace()` keeps working (its `getElementById` calls are guarded) but now only calls
  `renderSheetHead()`; delete its chip-building body. Then grep `src/js` for every removed id and leave
  no caller.
- **Registry** (`87-notes.js`): remove `origin`, `class`, `rest`; `portrait`'s title → `"Character"`;
  `attacks`' tab → `"inventory"`; `EDIT_CARDS` removes `"class"` and `"origin"`.
- **Attacks** card moved verbatim to the top of `10-inventory.html`'s stack.
- **Ability strip:** `buildAbilities()` builds six boxes (`.ability`): name, `#mod-<k>`, the score input
  (`data-path="character.abilities.<k>"`), and the save row (`data-save` dot + `#save-<k>`), with the
  existing ids; delete `statGroupHTML`, `statGroupsHTML`, the `statStyle()` branches and the Skills
  display Settings row; `buildStats()` no longer hides `#skillsCard`.
- **HP as a bar:** `renderHP()` keeps every write it makes and also sets the bar's fill width from
  cur / effective max and its band class from `hpBand()` (when `character.hpColor!==false`).
- **CSS:** `.sheet-grid` three columns `minmax(220px,260px) minmax(0,1.3fr) minmax(0,1fr)` with the
  rail spanning rows, the strip spanning columns 2–3, `.wide` spanning 2–3; `@media(max-width:1000px)`
  two columns (rail · one column; strip as 3 × 2; `.wide` spans both); `@media(max-width:700px)` one
  column in the spec §6.7 order (use `order:` on the cards, not markup duplication). These media queries
  come AFTER the base rules (the trap in [Sections & layout](../wiki/ui/sections-and-layout.md)). The
  rail is dark (`--rail-bg`/`--rail-ink` tokens added to `00-tokens.css` for both skins and both modes).
  Delete the old `.cols`/`.stack` sheet rules that no other tab uses (the Bio tab still uses `.cols` —
  keep what it needs).
- **Combat view:** cards it moves in are the same elements; check `45-combat.css`'s rules keyed on
  `#cvList [data-note="abilities"]`/`"skills"` still make sense for the strip and the condensed skills,
  and that `#combatView #familiarCard{order:0}` still applies.

- [ ] **Step 1: Write the failing tests** — `rules-data.js`, replacing the old layout block
  ("the left stack is the portrait column", the 320px regex, the Vitals/Rest ownership checks, the
  familiar adjacency check):

```js
// ---------- #103: the new Sheet
{
  const t = loadHTML();
  const at = t.indexOf('id="tab-sheet"'), end = t.indexOf('<section class="tabpanel', at + 1), sheet = t.slice(at, end);
  const once = id => (t.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1;
  const ids = ['acDisp', 'initDisp', 'speedDisp', 'sizeDisp', 'passDisp', 'pbDisp', 'hpCur', 'hpMax', 'hpTemp', 'deathSucc', 'deathFail',
    'maxNote', 'starBtn', 'hdWrap', 'abilities', 'skills', 'statLegend', 'familiarCard', 'addFamiliarLink', 'btnShortRest', 'btnLongRest', 'portrait'];
  const missing = ids.filter(id => !once(id));
  ck('#103 every painted id exists exactly once', missing.length === 0, missing);
  ck('#103 the rail holds the vitals, the portrait and the hit dice', /data-note="vitals"[\s\S]*id="portrait"[\s\S]*id="acDisp"[\s\S]*id="hpCur"[\s\S]*id="hdWrap"/.test(sheet));
  ck('#103 the header is the Character section', /<header class="card sheet-head" data-note="portrait"/.test(sheet));
  ck('#103 no Class, Ancestry or Rest card', !/data-note="(class|origin|rest)"/.test(t));
  ck('#103 Attacks is on Inventory', (() => { const i = t.indexOf('id="tab-inventory"'), e = t.indexOf('<section class="tabpanel', i + 1); return t.slice(i, e).includes('data-note="attacks"'); })());
  ck('#103 the registry agrees', !X.noteDef('class') && !X.noteDef('origin') && !X.noteDef('rest') && X.noteDef('attacks').tab === 'inventory' &&
     X.noteDef('portrait').title === 'Character' && !X.EDIT_CARDS.includes('class') && !X.EDIT_CARDS.includes('origin'));
  const css = ['src/css/10-chrome.css', 'src/css/30-sheet.css'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const base = css.indexOf('.sheet-grid{'), m1 = css.indexOf('@media(max-width:1000px)'), m2 = css.indexOf('@media(max-width:700px)');
  ck('#103 three columns, then two, then one — the queries after the base rule', base >= 0 && m1 > base && m2 > m1);
  ck('#103 the Skills display setting is retired', !/segStatStyle|data-statstyle/.test(fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8')));
}
```

  Update `'the registry has 21 sections'` → 18, the card-prefix count to match, the registry-title
  check (portrait → "Character"), and `sheet.js`'s `EDIT_CARDS` exact-list check to
  `['statuses','attacks','resources','features','familiars','spells','inventory','trackers','journal','secnotes','defences','proficiencies']`.

- [ ] **Step 2–4:** fail; implement; run every suite. Every old test removed or rewritten is listed
  in the report with why.

- [ ] **Step 5: Commit**

```bash
git add src/html/00-sheet.html src/html/10-inventory.html src/js/00-constants.js src/js/87-notes.js src/js/87-combat.js src/js/88-settings.js src/js/66-coins-hp.js src/js/40-sheet.js src/css/00-tokens.css src/css/10-chrome.css src/css/30-sheet.css src/css/45-combat.css src/tests/rules-data.js src/tests/sheet.js
git commit -m "feat(#103): the Sheet in three columns — rail, ability strip, Skills beside Defences

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Browser QA, layout tuning, docs, release note

**Files:** the wiki pages in spec §13, `src/docs/wiki/roadmap/2.0.md` (decision 18),
`src/docs/specs/2026-10-23-sheet-makeover-design.md` (As built), the ledger, `UNRELEASED.md`; CSS files
for tuning only.

- [ ] **Step 1: Before shots** from main's tracked build
  (`file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`), through the project's
  Playwright MCP only: Sheet, Inventory, Story, and the combat view with Vitals and Attacks in it, at
  1280, 900 and 390 wide, both skins, on a character with a class, species, background, two familiars,
  HP below max, hit dice partly spent, notes on Class / Ancestry / Rest, and a "Languages:" line →
  `.claude/qa/103-before-*.png` (main repo path).
- [ ] **Step 2: After shots and driven checks** on the worktree's build, same character, same widths and
  skins → `103-after-*.png`; compare with the mockups and tune spacing and breakpoints in CSS (only CSS;
  any JS change is a bug for the controller). Drive: spend a hit die both ways (and an out-of-range typed
  roll); un-spend one; the paw (flyout, a familiar's modal, Summon / Dismiss, + Add); the class flyout's
  Level up and Level down; species Change and Remove (its language chips swap); add and remove each kind
  of chip; Advancement → Milestone and back (XP kept); the old character's notes merged into Character /
  Vitals; #97's pencil on Defences and the Bio card; the combat view with Vitals (the rail) and Attacks
  (back to Inventory after End). Report every shot and what was and was not driven.
- [ ] **Step 3: Docs** — each page in spec §13 rewritten to the new truth with a History line; the
  2.0 page gains decision 18 (calculation rules from packs and a conflict chooser); the spec's As built;
  the ledger entry `## The Sheet makeover (#103, <date>)`; `UNRELEASED.md` the spec §13 bullet.
- [ ] **Step 4:** `./build.sh --no-zip && PATH=… ./src/tests/run.sh` — all pass.
- [ ] **Step 5: Commit** the docs (and any CSS tuning, in its own commit `style(#103): …`).
