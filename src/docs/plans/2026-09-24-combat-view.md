# Combat View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen combat view, opened from a crossed-swords button in the tab bar, holding any of
the 19 sheet sections (the real cards, moved in and back) with a round and in-game time tracker that
drives the existing active-spell timing.

**Architecture:** One new JS fragment, `src/js/87-combat.js`, split into a pure half (section list,
combat state, time text, HTML string builders — asserted in `src/tests/sheet.js`) and a DOM half
(open, close, toggles, drag). Cards are moved into `#cvList` with a hidden `[data-cvhome]` marker left
at home, so every id stays unique and every existing handler keeps working. One new CSS fragment,
`src/css/45-combat.css`, and the view's shell in `src/fieldbook.template.html`.

**Tech Stack:** Plain ES2020 concatenated into one `<script>` (no modules, no dependencies), plain CSS,
Node test suites via `src/tests/harness.js` (VM with a stubbed DOM), Playwright MCP for driven checks
and screenshots.

**Spec:** `src/docs/specs/2026-09-24-combat-view-design.md` — read it first; this plan argues from it.

**Worktree:** `.claude/worktrees/9`, branch `issue/9-combat-view`. Every command below runs from the
worktree root.

## Global Constraints

- The app ships as ONE file, `dist/fieldbook.html`, built by concatenation. No `import`/`export`, no
  `type="module"`, no runtime dependency, no network.
- **Branch commits carry `src/` changes only. Never commit `dist/fieldbook.html`.** Build to verify.
- Never touch `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array. Player-visible changes get one
  bullet in `src/docs/UNRELEASED.md`.
- Byte hygiene: LF line endings, a single final newline, no BOM, in every file touched.
- A new fragment must be listed in `src/manifest.json`; the fragment counts quoted in `CLAUDE.md` and
  `src/docs/ADR-001-source-split.md` must match (the `docs` suite asserts them).
- **TDZ (ADR-001):** no top-level statement may read a `const`/`let` declared in a LATER fragment.
  `blankChar()` runs at load (`let character=blankChar()` in `00-constants.js`).
- New character fields are optional and get a default in `blankChar()`; `migrate()` already builds on
  `blankChar()` and copies saved fields over it.
- Defaults, in this order: `vitals`, `statuses`, `attacks`, `resources`, `slots`, `activespells`.
- Time is in-game only: header = `(round − 1) × 6` s; End summary = `round × 6` s.
- `fmtCombatTime`: `<60` → `N sec`; `<3600` → `M min` or `M min S sec`; else `H hr` or `H hr M min`.
- Stacking: the view is `z-index:50` — above the tab bar (40), below the ☰ flyout (55/60), the item
  finder (70), modals (80) and toasts (9999).
- Screenshots: Playwright MCP only (the project server in `.mcp.json`). Tab names are lowercase.
  `newCharacter(name, "dnd" | "humblewood")`. A **relative** screenshot `filename` writes relative to the
  CWD — always pass an absolute path.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

**Deliberate deviations from the spec** (each is small; each has a reason):

1. `COMBAT_DEFAULTS` lives in `00-constants.js`, not `87-combat.js` — `blankChar()` reads it at load, and
   a later fragment's `const` is still in its TDZ then.
2. The item finder has no Esc handling of its own. With the finder open over the view, Esc leaves both
   open rather than closing the finder; adding Esc to the finder is out of scope.
3. The `.tab-tools` rules go in `10-chrome.css` beside the other tab-bar rules, not in `45-combat.css`.

## Review Focus

The five conditions the spec implies that no unit test can reach, most likely to bite first. Each has
a driven check in the task that owns the code.

1. **Reload mid-combat** — the button must read ⚔ Rd N straight after boot, the view closed, the round
   intact. (Task 6, step 7)
2. **Combat on one character, then switch** — the other character's button is plain; switching back
   shows Rd N. With the view OPEN during a switch: no duplicate ids, every marker's card in the view.
   (Task 5 step 9; Task 6 step 7)
3. **Every section removed** — the empty hint shows with the icon; Start combat still works and the
   tab-bar button still shows the round. (Task 5 step 8; Task 6 step 7)
4. **Skills pinned while By ability is on** — no empty Skills card appears in the view. (Task 5 step 8)
5. **A card re-rendered while in the view** (a condition added, a slot spent) — it stays in the view,
   keeps working, and goes home to exactly its old position on close. (Task 5 step 7)

---

### Task 1: Combat data and pure logic

**Files:**
- Modify: `src/js/00-constants.js` (above `function blankChar(){`, and its object literal)
- Create: `src/js/87-combat.js`
- Modify: `src/manifest.json` (after `"src/js/87-notes.js",`)
- Modify: `CLAUDE.md` (JS fragment count), `src/docs/ADR-001-source-split.md` (JS fragment count)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `NOTE_SECTIONS` (`87-notes.js`, `[{k, tab, title}]`), `num(x)`.
- Produces: `COMBAT_DEFAULTS: string[]`; `inCombat(c) → boolean`; `combatSectionsOf(c) → string[]`
  (a fresh array); `withCombatSection(list, k, on) → string[]`; `moveCombatSection(list, from, to) →
  string[]` (`to` is the final index); `combatStart(c)`; `combatEnd(c) → {rounds, sec}`;
  `combatElapsedSec(c) → number`; `fmtCombatTime(sec) → string`. Character fields `combatSections`,
  `combatActive`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, add names to the `loadApp([...])` list — replace

```js
  'syncConcStatus', 'endConcentration', 'endConcFromStatus', 'concActiveSpell', 'concStatusRow',
]);
```

with

```js
  'syncConcStatus', 'endConcentration', 'endConcFromStatus', 'concActiveSpell', 'concStatusRow',
  'COMBAT_DEFAULTS', 'inCombat', 'combatSectionsOf', 'withCombatSection', 'moveCombatSection',
  'combatStart', 'combatEnd', 'combatElapsedSec', 'fmtCombatTime',
]);
```

Then insert immediately above the final `ck.done();`:

```js
/* ---- combat view: which sections, in what order, and combat state ----
   Design: src/docs/specs/2026-09-24-combat-view-design.md §3. */
{
  const D = ['vitals', 'statuses', 'attacks', 'resources', 'slots', 'activespells'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  ck('the defaults are the six sheet-order sections', same(X.COMBAT_DEFAULTS, D));
  ck('a new character gets the defaults', same(X.blankChar().combatSections, D));
  ck('...as its own copy, so editing one character cannot edit the defaults', (() => {
    X.blankChar().combatSections.push('coins'); return same(X.blankChar().combatSections, D);
  })());
  ck('a new character is not in combat',
     X.blankChar().combatActive === false && X.blankChar().combatRound === 0);

  ck('a missing list resolves to the defaults', same(X.combatSectionsOf({}), D));
  ck('null and a string resolve to the defaults too',
     same(X.combatSectionsOf({combatSections: null}), D) &&
     same(X.combatSectionsOf({combatSections: 'attacks'}), D));
  ck('unknown keys, non-strings and repeats are dropped; order is kept',
     same(X.combatSectionsOf({combatSections: ['attacks', 'nope', 7, 'vitals', 'attacks']}),
          ['attacks', 'vitals']));
  ck('an EMPTY list is a real choice and stays empty', same(X.combatSectionsOf({combatSections: []}), []));
  ck('the resolver never hands back the stored array itself', (() => {
    const c = {combatSections: ['coins']}; return X.combatSectionsOf(c) !== c.combatSections;
  })());

  ck('adding appends at the end', same(X.withCombatSection(['vitals'], 'coins', true), ['vitals', 'coins']));
  ck('adding one already there changes nothing', same(X.withCombatSection(['vitals'], 'vitals', true), ['vitals']));
  ck('removing keeps the rest in order',
     same(X.withCombatSection(['vitals', 'coins', 'attacks'], 'coins', false), ['vitals', 'attacks']));
  ck('removing one that is not there changes nothing',
     same(X.withCombatSection(['vitals'], 'coins', false), ['vitals']));

  ck('first to last', same(X.moveCombatSection(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']));
  ck('last to first', same(X.moveCombatSection(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']));
  ck('a target past the end lands last', same(X.moveCombatSection(['a', 'b', 'c'], 0, 9), ['b', 'c', 'a']));
  ck('a source out of range changes nothing', same(X.moveCombatSection(['a', 'b'], 5, 0), ['a', 'b']));
  ck('a one-item list is left alone', same(X.moveCombatSection(['a'], 0, 0), ['a']));
  ck('moving never edits the list it was given', (() => {
    const l = ['a', 'b']; X.moveCombatSection(l, 0, 1); return same(l, ['a', 'b']);
  })());

  ck('only a real true means in combat',
     X.inCombat({combatActive: true}) && !X.inCombat({combatActive: 'true'}) &&
     !X.inCombat({}) && !X.inCombat(null));
  const c = X.blankChar(); c.combatRound = 5;
  c.activeSpells = [{id: 'h', name: 'Haste', conc: true, durationSec: 60, elapsedSec: 30}];
  X.combatStart(c);
  ck('Start combat begins at round 1 whatever the old counter said',
     c.combatActive === true && c.combatRound === 1);
  c.combatRound = 7;
  const r = X.combatEnd(c);
  ck('End combat stops it and resets the round', c.combatActive === false && c.combatRound === 0);
  ck('...counting the round being ended as finished', r.rounds === 7 && r.sec === 42);
  ck('...and leaves active spells running', c.activeSpells.length === 1 && c.activeSpells[0].elapsedSec === 30);

  ck('in-game time counts from the start of round 1',
     X.combatElapsedSec({combatRound: 1}) === 0 && X.combatElapsedSec({combatRound: 3}) === 12 &&
     X.combatElapsedSec({combatRound: 0}) === 0);
  [[0, '0 sec'], [12, '12 sec'], [60, '1 min'], [66, '1 min 6 sec'], [3600, '1 hr'], [3840, '1 hr 4 min']]
    .forEach(([s, want]) => ck(`${s} s reads "${want}"`, X.fmtCombatTime(s) === want, X.fmtCombatTime(s)));

  const saved = X.migrate(JSON.parse(JSON.stringify(X.migrate(
    {id: 'cv1', combatSections: ['coins', 'attacks'], combatActive: true, combatRound: 4}))));
  ck('a save → load round trip keeps the list, its order and the combat state',
     same(saved.combatSections, ['coins', 'attacks']) && saved.combatActive === true && saved.combatRound === 4);
  const old = X.migrate({id: 'cv-old'});
  ck('a sheet saved before the combat view is not in combat and gets the defaults',
     !X.inCombat(old) && same(X.combatSectionsOf(old), D));
}
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `node src/tests/sheet.js | tail -3`
Expected: `LOAD FAIL: COMBAT_DEFAULTS is not defined`

- [ ] **Step 3: Add the defaults and the new character fields**

In `src/js/00-constants.js`, directly above `function blankChar(){`, insert:

```js
/* The combat view's starting sections, in sheet order. Lives HERE rather than in
   87-combat.js because blankChar() runs at load (`let character=blankChar()`
   below), long before a later fragment's const exists — ADR-001's TDZ rule. */
const COMBAT_DEFAULTS=["vitals","statuses","attacks","resources","slots","activespells"];
```

In the same file, replace

```js
    activeSpells:[], combatRound:0, grantGold:{},
```

with

```js
    /* The combat view (87-combat.js). combatActive is its own flag, NOT
       combatRound>0: the Active Spells card has always moved the round, so plenty
       of sheets carry a round with no fight behind it. */
    activeSpells:[], combatRound:0, combatActive:false, combatSections:COMBAT_DEFAULTS.slice(), grantGold:{},
```

- [ ] **Step 4: Create `src/js/87-combat.js` with the pure half**

```js
/* ================= combat view =================
   A full-screen view of the sections the player picked from any tab. They are
   the REAL cards, moved in while the view is open and back to a hidden marker
   at home when it closes: copies would duplicate every id (the #17 bug, where
   the visible copy updates and the hidden one rots), and a purpose-built
   dashboard would re-implement every section's controls. Closing the view never
   ends combat. Design: src/docs/specs/2026-09-24-combat-view-design.md

   The pure half comes first — no DOM — so src/tests/sheet.js can assert it. */

/* Only a real true: a hand-edited file saying "true" is not a fight. */
function inCombat(c){return !!c&&c.combatActive===true;}

/* Not an array means "never chosen" and gets the defaults. An EMPTY array is a
   real choice (the player took everything out) and stays empty. Unknown keys and
   repeats are dropped, so an old or hand-edited file cannot put a card in twice. */
function combatSectionsOf(c){
  const raw=c&&c.combatSections;
  if(!Array.isArray(raw))return COMBAT_DEFAULTS.slice();
  const known=new Set(NOTE_SECTIONS.map(s=>s.k)),out=[];
  raw.forEach(k=>{if(typeof k==="string"&&known.has(k)&&!out.includes(k))out.push(k);});
  return out;
}
function withCombatSection(list,k,on){
  if(on)return list.includes(k)?list.slice():list.concat([k]);
  return list.filter(x=>x!==k);
}
/* `to` is where the section ends up. Never edits the list it was given. */
function moveCombatSection(list,from,to){
  const out=list.slice();
  if(from<0||from>=out.length)return out;
  const [k]=out.splice(from,1);
  out.splice(Math.max(0,Math.min(out.length,to)),0,k);
  return out;
}

/* Start always means round 1, even over a round the Active Spells card left
   behind. Active spells are not touched: their time moves only when rounds do. */
function combatStart(c){c.combatActive=true;c.combatRound=1;}
/* The summary counts the round being ended as finished (round 7 → 7 rounds,
   42 sec), while the header shows the time at the START of the current round
   (combatElapsedSec: round 7 → 36 sec). Both on purpose — don't "fix" one to
   match the other. */
function combatEnd(c){
  const rounds=Math.max(0,num(c.combatRound));
  c.combatActive=false;c.combatRound=0;
  return {rounds,sec:rounds*6};
}
function combatElapsedSec(c){return Math.max(0,num(c&&c.combatRound)-1)*6;}
function fmtCombatTime(sec){
  sec=Math.max(0,Math.floor(num(sec)));
  if(sec<60)return sec+" sec";
  if(sec<3600){const m=Math.floor(sec/60),s=sec%60;return m+" min"+(s?" "+s+" sec":"");}
  const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);
  return h+" hr"+(m?" "+m+" min":"");
}
```

- [ ] **Step 5: List the fragment and update the counts**

In `src/manifest.json`, replace `    "src/js/87-notes.js",` with

```json
    "src/js/87-notes.js",
    "src/js/87-combat.js",
```

In `CLAUDE.md`, replace `  js/*.js               27 fragments, concatenated into the single <script>` with
`  js/*.js               28 fragments, concatenated into the single <script>`.

In `src/docs/ADR-001-source-split.md`, replace `js/ (27 fragments)` with `js/ (28 fragments)`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node src/tests/sheet.js | tail -3` → Expected: `ALL PASSED (…)`
Run: `./src/tests/run.sh 2>&1 | tail -2` → Expected: `All 7 suites passed — … checks.`

- [ ] **Step 7: Commit**

```bash
git add src/js/00-constants.js src/js/87-combat.js src/manifest.json CLAUDE.md src/docs/ADR-001-source-split.md src/tests/sheet.js
git commit -m "task: combat view data and its pure logic

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: In combat, the round floor is 1

**Files:**
- Modify: `src/js/60-attacks.js` (`advanceRound`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `inCombat(c)`, `combatStart(c)` (Task 1); existing `bumpActive`, `renderActiveSpells`.
- Produces: `advanceRound(dir)` — unchanged signature; in combat, a step below round 1 is a no-op.

- [ ] **Step 1: Write the failing test**

Add `'advanceRound',` to the end of the `loadApp([...])` names you added in Task 1 (after
`'fmtCombatTime',`). Insert above the final `ck.done();`:

```js
/* ---- rounds: in combat the floor is round 1 ---- */
{
  const bless = () => ({id: 'b', name: 'Bless', level: 1, conc: true, durationSec: 60, elapsedSec: 0});
  const c = X.blankChar(); c.activeSpells = [bless()]; X.character = c; X.combatStart(c);
  X.advanceRound(1);
  ck('next round moves the round on', c.combatRound === 2);
  ck('...and every active spell gains 6 seconds', c.activeSpells[0].elapsedSec === 6);
  X.advanceRound(-1);
  ck('previous round takes them back off', c.combatRound === 1 && c.activeSpells[0].elapsedSec === 0);
  c.activeSpells[0].elapsedSec = 12;
  X.advanceRound(-1);
  ck('in combat, previous at round 1 moves nothing — not the round, not the spells',
     c.combatRound === 1 && c.activeSpells[0].elapsedSec === 12);

  const o = X.blankChar(); o.activeSpells = [bless()]; o.activeSpells[0].elapsedSec = 12; X.character = o;
  X.advanceRound(-1);
  ck('out of combat nothing changes: the round floors at 0 and spells still step back',
     o.combatRound === 0 && o.activeSpells[0].elapsedSec === 6);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/tests/sheet.js | grep -E '^FAIL'`
Expected: `FAIL  in combat, previous at round 1 moves nothing — not the round, not the spells`

- [ ] **Step 3: Implement**

In `src/js/60-attacks.js`, replace

```js
function advanceRound(dir){
  character.combatRound=Math.max(0,num(character.combatRound)+dir);
  (character.activeSpells||[]).slice().forEach(a=>bumpActive(a,dir*6));
  renderActiveSpells();scheduleSave();
}
```

with

```js
function advanceRound(dir){
  /* In combat the floor is round 1, Start combat's round. A step that cannot move
     the round must not move the spells either, or ◀ at round 1 would quietly take
     6 seconds off every active spell. Out of combat, exactly as before. */
  const cur=num(character.combatRound);
  if(inCombat(character)&&cur+dir<1)return;
  character.combatRound=Math.max(0,cur+dir);
  (character.activeSpells||[]).slice().forEach(a=>bumpActive(a,dir*6));
  renderActiveSpells();scheduleSave();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node src/tests/sheet.js | tail -3` → Expected: `ALL PASSED (…)`

- [ ] **Step 5: Commit**

```bash
git add src/js/60-attacks.js src/tests/sheet.js
git commit -m "task: in combat the round cannot step below 1

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The crossed-swords icon

**Files:**
- Modify: `src/icons/icons.json`, `scripts/fetch-icons.js`
- Regenerate: `src/js/05-icons.js` (by running the fetcher — never hand-edit)
- Modify: `src/tests/docs.js`, `src/js/88-settings.js` (credits), `README.md` (§10 credits)
- Test: `src/tests/sheet.js`, `src/tests/docs.js`

**Interfaces:**
- Produces: `iconSVG("ui", "Combat", cls?) → '<svg class="gicon …">…</svg>'` (a 512-unit glyph, `fill`
  via `currentColor`).

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, insert above the final `ck.done();`:

```js
ck('the combat button has its crossed swords', X.iconSVG('ui', 'Combat').includes('<path d="M'));
```

In `src/tests/docs.js`, replace

```js
  const KINDS = ['classes', 'races', 'backgrounds'];
```

with

```js
  const KINDS = ['classes', 'races', 'backgrounds', 'ui'];
  /* Only these three name things that ship in data/. "ui" is app chrome, so the
     coverage check below must not go looking for a data file for it. */
  const DATA_KINDS = ['classes', 'races', 'backgrounds'];
```

and, in the coverage block further down, replace

```js
  KINDS.forEach(kind => {
    const have = new Set(
```

with

```js
  DATA_KINDS.forEach(kind => {
    const have = new Set(
```

- [ ] **Step 2: Run to verify they fail**

Run: `node src/tests/sheet.js | grep -E '^FAIL'` → Expected: `FAIL  the combat button has its crossed swords`
Run: `node src/tests/docs.js | grep -E '^FAIL'` → Expected: `FAIL  05-icons.js has an ICON_MAP.ui block`

- [ ] **Step 3: Add the `ui` kind to the map and the fetcher**

In `src/icons/icons.json`, replace the end of the file

```json
    "Wonderstruck": "lorc/star-swirl"
  }
}
```

with

```json
    "Wonderstruck": "lorc/star-swirl"
  },

  "ui": {
    "Combat": "lorc/crossed-swords"
  }
}
```

and in its `"_readme"` string, replace `Subclasses deliberately have no emblem.",` with
`Subclasses deliberately have no emblem. The \"ui\" block is app chrome, not a rules entity: \"Combat\" is the combat view's button.",`

In `scripts/fetch-icons.js`, replace

```js
/* The three kinds that get emblems. Subclasses deliberately do NOT — they are
   the second line of a class chip, and an emblem there would compete with the
   class's own. Keep this in step with the `kind` argument of iconSVG(). */
const KINDS = ["classes", "races", "backgrounds"];
```

with

```js
/* The kinds that get emblems, plus "ui" for app chrome (the combat view's
   button). Subclasses deliberately do NOT — they are the second line of a class
   chip, and an emblem there would compete with the class's own. Keep this in
   step with the `kind` argument of iconSVG(), and with KINDS in src/tests/docs.js. */
const KINDS = ["classes", "races", "backgrounds", "ui"];
```

- [ ] **Step 4: Regenerate the vendored icons (needs network; dev-only, run by hand)**

Run: `node scripts/fetch-icons.js`
Expected: it reports writing `src/js/05-icons.js`. Then:
Run: `grep -c 'crossed-swords' src/js/05-icons.js` → Expected: `2` (the glyph and the `ICON_MAP.ui` entry)
Run: `grep -o 'const ICON_ARTISTS=.*' src/js/05-icons.js` → Expected: unchanged —
`["Caro Asercion","DarkZaitzev","Delapouite","Lorc","Skoll"]` (Lorc is already credited).

- [ ] **Step 5: Say where the icon is used, in both credits**

In `src/js/88-settings.js`, replace
`<p class="hint">The emblems beside each class, ${raceTerm().toLowerCase()} and background are from`
with
`<p class="hint">The emblems beside each class, ${raceTerm().toLowerCase()} and background, and the crossed swords on the combat button, are from`

In `README.md`, replace

```
**Icons.** The emblems beside each class, ancestry and background come from
```

with

```
**Icons.** The emblems beside each class, ancestry and background, and the crossed swords on the
combat button, come from
```

- [ ] **Step 6: Run to verify they pass**

Run: `./src/tests/run.sh 2>&1 | tail -2` → Expected: `All 7 suites passed — … checks.`

- [ ] **Step 7: Commit**

```bash
git add src/icons/icons.json scripts/fetch-icons.js src/js/05-icons.js src/tests/docs.js src/tests/sheet.js src/js/88-settings.js README.md
git commit -m "task: a crossed-swords icon for the combat button

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The tab-bar button and the view's shell

**Files:**
- Modify: `src/fieldbook.template.html` (tab bar; the view shell)
- Modify: `src/css/10-chrome.css` (`.tab-tools`, `.tab-toc`)
- Create: `src/css/45-combat.css`
- Modify: `src/manifest.json` (after `"src/css/40-spells-coins.css",`)
- Modify: `CLAUDE.md`, `src/docs/ADR-001-source-split.md` (CSS count 7 → 8)
- Modify: `src/js/87-combat.js` (button + chrome + sync), `src/js/66-coins-hp.js` (`renderAll`),
  `src/js/60-attacks.js` (`advanceRound`)
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: `iconSVG` (Task 3), `inCombat`, `num`.
- Produces: `combatButtonHTML(c) → string`; `renderCombatButton()`; `renderCombatChrome()` (repaints
  everything that shows combat state — Task 5 extends it); `syncCombatView()` (called last by
  `renderAll()` — Task 5 extends it). DOM ids: `#btnCombat`, `#combatView`, `#cvHead`, `#cvBody`,
  `#cvEmpty`, `#cvList`. Classes: `.tab-tools`, `.tab-combat` (`.on` in combat), `.cview` (`.open`),
  `html.cv-lock`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, add `'combatButtonHTML',` to the combat names in `loadApp([...])`, then insert
above the final `ck.done();`:

```js
/* ---- the tab-bar button ---- */
{
  const idle = X.combatButtonHTML({combatActive: false, combatRound: 4});
  ck('idle, the button is the crossed swords alone', idle.includes('<svg') && !/Rd/.test(idle));
  const on = X.combatButtonHTML({combatActive: true, combatRound: 3});
  ck('in combat it carries the round', on.includes('<svg') && on.includes('Rd 3'));
}
```

In `src/tests/rules-data.js`, insert above the final `ck.done();`:

```js
// ---------- the combat view's shell: a tab-bar button, and a view outside every tab
{
  const t = loadHTML();
  const tools = t.indexOf('<div class="tab-tools">'), combat = t.indexOf('id="btnCombat"'),
        toc = t.indexOf('id="btnToc"'), page = t.indexOf('<div class="page">'),
        view = t.indexOf('id="combatView"');
  ck('the combat button sits in the pinned tab-bar group, before ☰',
     tools >= 0 && tools < combat && combat < toc);
  ck('the combat view is outside the page, so no tab panel owns it', view >= 0 && view < page);
  ck('the view has its header, its scroller, its empty hint and its list',
     ['id="cvHead"', 'id="cvBody"', 'id="cvEmpty"', 'id="cvList"'].every(s => t.includes(s)));
  ck('the view ships holding no cards — they are moved in at runtime',
     !/class="card"/.test(t.slice(view, page)));
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `node src/tests/sheet.js | tail -3` → Expected: `LOAD FAIL: combatButtonHTML is not defined`
Run: `node src/tests/rules-data.js | grep -E '^FAIL'` → Expected: the four combat-view-shell checks FAIL

- [ ] **Step 3: Add the markup**

In `src/fieldbook.template.html`, replace

```html
  <button class="tab-toc" id="btnToc" title="Jump to a section" aria-label="Table of contents">☰</button>
</div>
<div class="toc-back" id="tocBack"></div>
<nav class="toc-fly" id="tocFly" aria-label="Sections"></nav>
```

with

```html
  <!-- One pinned group: below 400px the bar scrolls sideways (10-chrome.css), and
       both of these must stay on screen. #btnCombat is painted by
       renderCombatButton() in 87-combat.js — empty until the first render. -->
  <div class="tab-tools">
    <button class="tab-combat" id="btnCombat" title="Combat view" aria-label="Combat view"></button>
    <button class="tab-toc" id="btnToc" title="Jump to a section" aria-label="Table of contents">☰</button>
  </div>
</div>
<div class="toc-back" id="tocBack"></div>
<nav class="toc-fly" id="tocFly" aria-label="Sections"></nav>
<!-- The combat view (87-combat.js). It owns only its header: the cards in #cvList
     are MOVED here from their tabs while it is open. A direct child of <body>, so
     the print CSS's body>*:not(#printArea) already hides it. -->
<div class="cview" id="combatView" role="dialog" aria-modal="true" aria-label="Combat view">
  <div class="cv-head" id="cvHead"></div>
  <div class="cv-body" id="cvBody">
    <p class="hint cv-empty" id="cvEmpty" hidden></p>
    <div class="cv-list" id="cvList"></div>
  </div>
</div>
```

- [ ] **Step 4: Pin the group in the tab bar**

In `src/css/10-chrome.css`, replace

```css
/* Very narrow: let the bar scroll rather than crushing the glyphs. .tab-toc's
   margin-left:auto collapses to nothing in a scroll container, so it has to be
   pinned instead or it scrolls off the end. */
@media(max-width:400px){
  .tabbar{overflow-x:auto;scrollbar-width:none}
  .tabbar::-webkit-scrollbar{display:none}
  .tab{flex:0 0 auto;min-width:46px}
  .tab-toc{position:sticky;right:0;background:var(--paper-2)}
}
```

with

```css
/* Very narrow: let the bar scroll rather than crushing the glyphs. .tab-tools'
   margin-left:auto collapses to nothing in a scroll container, so the group — the
   combat button and ☰ — is pinned instead, or it scrolls off the end. */
@media(max-width:400px){
  .tabbar{overflow-x:auto;scrollbar-width:none}
  .tabbar::-webkit-scrollbar{display:none}
  .tab{flex:0 0 auto;min-width:46px}
  .tab-tools{position:sticky;right:0;background:var(--paper-2)}
}
```

and replace

```css
.tab-toc{flex:0 0 auto;margin-left:auto;background:none;border:0;
```

with

```css
.tab-tools{flex:0 0 auto;margin-left:auto;display:flex;align-items:center}
.tab-toc{flex:0 0 auto;background:none;border:0;
```

- [ ] **Step 5: Create `src/css/45-combat.css`**

```css
/* ================= Combat view =================
   The tab-bar button and the full-screen view. The cards inside keep their own
   styles — they are the real cards, moved here by 87-combat.js. */
.tab-combat{flex:0 0 auto;background:none;border:0;color:var(--ink-soft);cursor:pointer;padding:0 8px;min-height:48px;
  display:inline-flex;align-items:center;gap:5px;font-family:var(--head);font-weight:700;font-size:12px;
  letter-spacing:.06em;text-transform:uppercase}
.tab-combat .gicon{width:20px;height:20px;color:currentColor}
.tab-combat:hover{color:var(--accent)}
/* In combat: a filled pill, readable from any tab while you look something up. */
.tab-combat.on{color:var(--paper);background:var(--accent);border-radius:8px;min-height:32px;margin:0 2px;padding:0 9px}
.tab-combat.on:hover{color:var(--paper);filter:brightness(1.08)}

/* Above the tab bar (40), below the ☰ flyout (55/60), the item finder (70),
   modals (80) and toasts — so Cast, Use and Edit open over it as anywhere else. */
.cview{position:fixed;inset:0;z-index:50;background:var(--paper);display:none;flex-direction:column}
.cview.open{display:flex}
html.cv-lock,html.cv-lock body{overflow:hidden}
.cv-head{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px clamp(10px,2vw,18px);
  background:var(--paper-2);border-bottom:2px solid var(--line)}
.cv-head .grow{flex:1}
/* The view scrolls itself; the page behind it stays put. */
.cv-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:clamp(12px,2.4vw,22px)}
/* One column as wide as the sheet's main column: drag order IS reading order. */
.cv-list{max-width:780px;margin:0 auto;display:flex;flex-direction:column;gap:clamp(12px,2vw,18px)}
.cv-empty{max-width:780px;margin:24px auto;text-align:center}
.cv-empty .gicon{display:inline-block;width:16px;height:16px;vertical-align:-3px;color:var(--accent)}
```

In `src/manifest.json`, replace `    "src/css/40-spells-coins.css",` with

```json
    "src/css/40-spells-coins.css",
    "src/css/45-combat.css",
```

In `CLAUDE.md`, replace `  css/*.css             7 fragments, concatenated into the single <style>` with
`  css/*.css             8 fragments, concatenated into the single <style>`. In
`src/docs/ADR-001-source-split.md`, replace `css/ (7)` with `css/ (8)`.

- [ ] **Step 6: Paint the button, and hook it in**

Append to `src/js/87-combat.js`:

```js

/* ---- the tab-bar button ----
   Idle: the crossed swords alone. In combat: highlighted, with the round, so it
   reads from any tab while you look something up. */
function combatButtonHTML(c){
  return iconSVG("ui","Combat")+(inCombat(c)?`<span class="cv-rd">Rd ${num(c.combatRound)}</span>`:"");
}
function renderCombatButton(){
  const b=document.getElementById("btnCombat");if(!b)return;
  const on=inCombat(character), l=on?`Combat view — round ${num(character.combatRound)}`:"Combat view";
  b.innerHTML=combatButtonHTML(character);
  b.classList.toggle("on",on);
  b.setAttribute("aria-label",l);b.title=l;
}
/* Everything that shows combat state repaints through here. The round moves from
   three places — the view's arrows, the Active Spells card's own buttons, and
   Start/End — so none of them can disagree. */
function renderCombatChrome(){renderCombatButton();}
/* The last thing renderAll() does. */
function syncCombatView(){renderCombatChrome();}
```

In `src/js/66-coins-hp.js`, replace
`renderRulesSections();renderNoteIcons();renderNotes();renderAllRT();recompute();`
with

```js
renderRulesSections();renderNoteIcons();renderNotes();renderAllRT();recompute();
  /* LAST: the combat toggles sit beside the note buttons drawn above, and an open
     combat view refills from THIS character — every character switch ends here. */
  syncCombatView();
```

In `src/js/60-attacks.js`, inside `advanceRound`, replace the line `  renderActiveSpells();scheduleSave();`
**that follows** `  (character.activeSpells||[]).slice().forEach(a=>bumpActive(a,dir*6));` with
`  renderActiveSpells();renderCombatChrome();scheduleSave();` (edit the whole function body so the
match is unique).

- [ ] **Step 7: Run to verify they pass**

Run: `./src/tests/run.sh 2>&1 | tail -2` → Expected: `All 7 suites passed — … checks.`

- [ ] **Step 8: Build and look at it**

Run: `node scripts/build-html.js` → Expected: `build-html: wrote dist/fieldbook.html …`

With the Playwright MCP: `browser_navigate` to
`file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/9/dist/fieldbook.html`, then
`browser_evaluate`:

```js
() => { newCharacter("Tess", "dnd"); selectTab("sheet");
  const b = document.getElementById("btnCombat"), t = document.getElementById("btnToc");
  return { hasIcon: !!b.querySelector("svg"), onScreen: b.getBoundingClientRect().right <= innerWidth,
           tocOnScreen: t.getBoundingClientRect().right <= innerWidth }; }
```

Expected: all three `true`. Screenshot the top of the page (absolute `filename`). Then set
`character.combatActive=true;character.combatRound=3;renderCombatButton();` and screenshot again:
the button is an accent pill reading "Rd 3". `browser_resize` to 400×800 and repeat both: the
combat button and ☰ stay pinned at the right while the tabs scroll.

- [ ] **Step 9: Commit (src only — never dist)**

```bash
git add src/fieldbook.template.html src/css/10-chrome.css src/css/45-combat.css src/manifest.json CLAUDE.md src/docs/ADR-001-source-split.md src/js/87-combat.js src/js/66-coins-hp.js src/js/60-attacks.js src/tests/sheet.js src/tests/rules-data.js
git commit -m "task: the combat button in the tab bar, and the view's shell

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Opening, closing and choosing sections

**Files:**
- Modify: `src/js/87-combat.js` (the DOM layer), `src/js/40-sheet.js` (`selectTab`, `scrollToCard`,
  `buildToc`, `openToc`, `renderFamiliars`), `src/js/90-boot.js` (clicks, Esc)
- Modify: `src/css/45-combat.css` (toggle, title, empty-card rules)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: Tasks 1–4; `NOTE_SECTIONS`, `noteDef(k)`, `noteTitle(def)`, `esc`, `toast`, `scheduleSave`,
  `closeToc`, `modal` (the `#modal` backdrop element, `80-modal-forms.js`).
- Produces: `combatViewOpen() → boolean`; `combatCard(k) → Element|null`; `combatToggleHTML(k, on) →
  string`; `renderCombatToggles()`; `renderCombatEmpty()`; `fillCombatView()`; `sendCardHome(k)`;
  `emptyCombatView()`; `combatHeaderHTML(c) → string` (Task 6 replaces it); `renderCombatHeader()`;
  `openCombatView()`; `closeCombatView()`; `toggleCombatSection(k)`; `renderCombatChrome()` and
  `syncCombatView()` in their final form. Markers: `<span hidden data-cvhome="<k>">`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, add `'combatToggleHTML', 'combatHeaderHTML',` to the combat names, then insert
above the final `ck.done();`:

```js
/* ---- the per-card toggle, and the view's header ---- */
{
  const off = X.combatToggleHTML('attacks', false), on = X.combatToggleHTML('attacks', true);
  ck('the toggle carries its section and its state',
     off.includes('data-combatbtn="attacks"') && off.includes('aria-pressed="false"') &&
     on.includes('aria-pressed="true"') && on.includes('class="cvbtn on"') && off.includes('class="cvbtn"'));
  ck('it says what it will do, and to which card',
     off.includes('Add to combat view — Attacks &amp; Weapons') &&
     on.includes('Remove from combat view — Attacks &amp; Weapons'));
  ck('it wears the crossed swords', off.includes('class="gicon cvicon"'));
  const h = X.combatHeaderHTML({combatActive: false, combatRound: 0});
  ck('the header can always close, and says combat keeps going',
     h.includes('id="cvClose"') && /combat keeps going/.test(h));
  ck('the header has its own ☰', h.includes('id="cvToc"'));
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/tests/sheet.js | tail -3` → Expected: `LOAD FAIL: combatToggleHTML is not defined`

- [ ] **Step 3: Write the DOM layer**

In `src/js/87-combat.js`, replace

```js
/* Everything that shows combat state repaints through here. The round moves from
   three places — the view's arrows, the Active Spells card's own buttons, and
   Start/End — so none of them can disagree. */
function renderCombatChrome(){renderCombatButton();}
/* The last thing renderAll() does. */
function syncCombatView(){renderCombatChrome();}
```

with

```js
/* ================= the DOM layer ================= */
/* Session only, never saved: whether the view is open, where it and the page
   were scrolled, and whose cards those were. A reload starts closed; combat
   itself is saved on the character. */
let cvOpen=false, cvScroll=0, cvPageScroll=0, cvCharId=null;
function combatViewOpen(){return cvOpen;}

/* Found fresh every time, never cached: a card re-rendered while it sat in the
   view must still be the one that goes home. */
function combatCard(k){return document.querySelector(`.card[data-note="${k}"]`);}

function combatToggleHTML(k,on){
  const t=noteTitle(noteDef(k)), l=(on?"Remove from":"Add to")+" combat view";
  return `<button class="cvbtn${on?" on":""}" data-combatbtn="${esc(k)}" aria-pressed="${on?"true":"false"}" aria-label="${l} — ${esc(t)}" title="${l}">`+
    iconSVG("ui","Combat","cvicon")+`</button>`;
}
/* Mirrors renderNoteIcons(): idempotent, replaces only its own button, and never
   label.innerHTML += — that re-parses the label and destroys #starBtn, #encPill
   and #roundNum. It goes just before the note button, which parks itself at the
   far right with margin-left:auto. */
function renderCombatToggles(){
  const on=new Set(combatSectionsOf(character));
  NOTE_SECTIONS.forEach(def=>{
    const card=combatCard(def.k);if(!card)return;
    const label=card.querySelector(".label");if(!label)return;
    const html=combatToggleHTML(def.k,on.has(def.k)), old=label.querySelector("[data-combatbtn]");
    if(old){old.outerHTML=html;return;}
    const note=label.querySelector("[data-notebtn]");
    if(note)note.insertAdjacentHTML("beforebegin",html);else label.insertAdjacentHTML("beforeend",html);
  });
}
function renderCombatEmpty(){
  const e=document.getElementById("cvEmpty");if(!e)return;
  e.innerHTML=`Add sections with the ${iconSVG("ui","Combat")} button on any card.`;
  e.hidden=!!document.querySelector("#cvList .card");
}
/* In: a hidden marker takes each card's place at home and the card goes to the
   end of the list, so cards arrive in the saved order. Cards already in the view
   are skipped, which makes this safe to call again to add one. */
function fillCombatView(){
  const list=document.getElementById("cvList");if(!list)return;
  combatSectionsOf(character).forEach(k=>{
    const card=combatCard(k);if(!card||card.closest("#combatView"))return;
    const home=document.createElement("span");home.hidden=true;home.dataset.cvhome=k;
    card.before(home);list.appendChild(card);
  });
  renderCombatEmpty();
}
function sendCardHome(k){
  const home=document.querySelector(`[data-cvhome="${k}"]`),card=combatCard(k);
  if(home&&card)home.replaceWith(card);else if(home)home.remove();
}
function emptyCombatView(){document.querySelectorAll("[data-cvhome]").forEach(h=>sendCardHome(h.dataset.cvhome));}

/* ✕ · title · ☰ — Task 6 adds the tracker. */
function combatHeaderHTML(c){
  return `<button class="tbtn" id="cvClose" aria-label="Close the combat view — combat keeps going" title="Close (combat keeps going)">✕</button>`+
    `<span class="cv-title">${iconSVG("ui","Combat")}Combat</span>`+
    `<span class="grow"></span>`+
    `<button class="tbtn" id="cvToc" aria-label="Jump to a section" title="Jump to a section">☰</button>`;
}
function renderCombatHeader(){const h=document.getElementById("cvHead");if(h)h.innerHTML=combatHeaderHTML(character);}

function openCombatView(){
  if(cvOpen)return;
  const view=document.getElementById("combatView"),body=document.getElementById("cvBody");
  if(!view||!body)return;
  closeToc();
  if(character.id!==cvCharId){cvCharId=character.id;cvScroll=0;}
  cvPageScroll=window.scrollY;
  fillCombatView();
  document.documentElement.classList.add("cv-lock");
  view.classList.add("open");cvOpen=true;
  renderCombatHeader();
  body.scrollTop=cvScroll;
}
/* Closing NEVER ends combat — End combat is its own button. */
function closeCombatView(){
  if(!cvOpen)return;
  const view=document.getElementById("combatView"),body=document.getElementById("cvBody");
  if(body)cvScroll=body.scrollTop;
  closeToc();
  emptyCombatView();
  if(view)view.classList.remove("open");
  document.documentElement.classList.remove("cv-lock");
  cvOpen=false;
  window.scrollTo({top:cvPageScroll});
}
function toggleCombatSection(k){
  const def=noteDef(k);if(!def)return;
  const cur=combatSectionsOf(character), on=!cur.includes(k);
  character.combatSections=withCombatSection(cur,k,on);
  if(cvOpen){if(on)fillCombatView();else{sendCardHome(k);renderCombatEmpty();}}
  renderCombatToggles();scheduleSave();
  toast((on?"Added ":"Removed ")+noteTitle(def)+(on?" to":" from")+" the combat view");
}

/* Everything that shows combat state repaints through here. The round moves from
   three places — the view's arrows, the Active Spells card's own buttons, and
   Start/End — so none of them can disagree. */
function renderCombatChrome(){renderCombatButton();if(cvOpen)renderCombatHeader();}
/* The last thing renderAll() does — and every character switch ends in
   renderAll(). An open view re-lays itself from THIS character's list, keeping
   its scroll for the same character; another character's remembered scroll is
   dropped, since it belonged to other cards. */
function syncCombatView(){
  const switched=character.id!==cvCharId;
  if(switched){cvCharId=character.id;cvScroll=0;}
  if(cvOpen){
    const body=document.getElementById("cvBody"),keep=(!switched&&body)?body.scrollTop:0;
    emptyCombatView();fillCombatView();
    if(body)body.scrollTop=keep;
  }
  renderCombatToggles();renderCombatChrome();
}
```

- [ ] **Step 4: Tab switches, the ☰ flyout, and the Familiars list**

In `src/js/40-sheet.js`, replace

```js
function selectTab(name){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
```

with

```js
function selectTab(name){
  /* Leaving for a tab means leaving the combat view first: it sends the cards
     home, or a note link would land on a tab with its cards missing. */
  closeCombatView();
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
```

replace

```js
function scrollToCard(el){
  if(!el)return;
  const tb=document.querySelector(".tabbar");
```

with

```js
function scrollToCard(el){
  if(!el)return;
  /* In the combat view the card sits in #cvBody, which scrolls on its own under a
     header that is not the tab bar. */
  const box=el.closest("#cvBody");
  if(box){box.scrollTo({top:Math.max(0,el.getBoundingClientRect().top-box.getBoundingClientRect().top+box.scrollTop-10),behavior:"smooth"});return;}
  const tb=document.querySelector(".tabbar");
```

replace

```js
  const panel=document.querySelector(".tabpanel.active");
  const tabBtn=document.querySelector(".tab.active");const tabName=tabBtn?tabBtn.textContent.trim():"Sections";
```

with

```js
  /* With the combat view open, ☰ lists the view's cards, not the tab behind it. */
  const inView=combatViewOpen();
  const panel=inView?document.getElementById("cvList"):document.querySelector(".tabpanel.active");
  const tabBtn=document.querySelector(".tab.active");const tabName=inView?"Combat":(tabBtn?tabBtn.textContent.trim():"Sections");
```

replace the whole `openToc` line, which begins
`function openToc(){buildToc();const tb=document.querySelector(".tabbar");`, with

```js
/* In the combat view the flyout hangs under the view's header, not the tab bar
   the view covers. */
function openToc(){buildToc();const tb=combatViewOpen()?document.getElementById("cvHead"):document.querySelector(".tabbar");const top=tb?Math.max(0,Math.round(tb.getBoundingClientRect().bottom)):0;const fly=document.getElementById("tocFly"),back=document.getElementById("tocBack");if(fly)fly.style.top=top+"px";if(back)back.style.top=top+"px";if(fly)fly.classList.add("open");if(back)back.classList.add("open");}
```

and, in `renderFamiliars`, replace

```js
  if(!has)return;
  const el=document.getElementById("familiarList");el.innerHTML="";
```

with

```js
  /* Cleared BEFORE the early return: the combat view shows this card even when it
     is empty, and a list still holding the last familiar removed would show it. */
  const el=document.getElementById("familiarList");el.innerHTML="";
  if(!has)return;
```

- [ ] **Step 5: Wire the clicks and Esc**

In `src/js/90-boot.js`, replace `    if(t.closest("#btnToc"))return openToc();` with

```js
    if(t.closest("#btnCombat"))return combatViewOpen()?closeCombatView():openCombatView();
    if(t.closest("#cvClose"))return closeCombatView();
    if(t.closest("#cvToc"))return openToc();
    if((m=t.closest("[data-combatbtn]")))return toggleCombatSection(m.dataset.combatbtn);
    if(t.closest("#btnToc"))return openToc();
```

and replace

```js
    {const g=e.target.closest&&e.target.closest("[data-notegroup]");if(g){e.preventDefault();toggleNoteGroup(g.dataset.notegroup);return;}}
  });
```

with

```js
    {const g=e.target.closest&&e.target.closest("[data-notegroup]");if(g){e.preventDefault();toggleNoteGroup(g.dataset.notegroup);return;}}
  });
  /* Esc closes the combat view only when it is the top layer. CAPTURE phase, so
     this runs BEFORE the modal's own Esc handler (80-modal-forms.js) shuts the
     modal — otherwise one Esc would close the modal and the view behind it. The
     item finder has no Esc of its own, so over the view Esc leaves both open. */
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape"||!combatViewOpen())return;
    if(modal.classList.contains("open"))return;
    const br=document.getElementById("browse");if(br&&br.classList.contains("show"))return;
    const fly=document.getElementById("tocFly");if(fly&&fly.classList.contains("open")){closeToc();return;}
    closeCombatView();
  },true);
```

- [ ] **Step 6: Style the toggle, the title and the empty cards**

Append to `src/css/45-combat.css`:

```css

/* ---- the header title ---- */
.cv-title{display:inline-flex;align-items:center;gap:7px;font-family:var(--head);font-weight:700;
  text-transform:uppercase;letter-spacing:.12em;font-size:14px;color:var(--ink)}
.cv-title .gicon{width:20px;height:20px;color:var(--accent)}

/* ---- the per-card toggle, beside the note button ----
   The .notebtn state language: faint when off, accent when on. It takes the
   margin-left:auto that parks the pair at the far right; the note button then
   sits flush beside it. */
.label .cvbtn{background:none;border:0;cursor:pointer;padding:3px 4px;color:var(--hair);
  display:inline-flex;align-items:center;flex:none;margin-left:auto}
.label .cvbtn.on{color:var(--accent)}
.label .cvbtn:hover,.label .cvbtn:focus-visible{color:var(--accent-2)}
.label .cvbtn + .notebtn{margin-left:0}
.cvbtn .cvicon{width:16px;height:16px;color:currentColor}

/* ---- cards that hide themselves when empty ----
   Active Spells and Familiars vanish from their tab when they have nothing to
   show. In the view a vanished card reads as a bug, so here they show, with a
   line saying so; !important beats the inline display:none their renderers
   write. NOT #skillsCard — in By ability mode its rows live in the Abilities
   card, and an empty Skills card here would be the bug. */
#combatView #activeSpellCard,#combatView #familiarCard{display:block!important}
#combatView #activeSpellList:empty::before,#combatView #familiarList:empty::before{
  content:"None right now.";display:block;font-style:italic;color:var(--ink-soft);font-size:14px}
```

- [ ] **Step 7: Run the tests, build, and drive it**

Run: `./src/tests/run.sh 2>&1 | tail -2` → Expected: `All 7 suites passed — … checks.`
Run: `node scripts/build-html.js` → Expected: `build-html: wrote dist/fieldbook.html …`

With the Playwright MCP, `browser_navigate` to the worktree's `dist/fieldbook.html`, then
`browser_evaluate` each of these in turn and check the result:

(a) Open with the defaults, recording where every card lives first:

```js
() => { newCharacter("Tess", "dnd");
  character.hp.max = 20; character.hp.cur = 20; character.slots[1] = {total: 2, used: 0}; renderAll();
  window.__home = [...document.querySelectorAll(".card[data-note]")].map(c =>
    c.dataset.note + "|" + c.closest(".tabpanel").id + "|" + [...c.parentElement.children].indexOf(c));
  document.getElementById("btnCombat").click();
  const ids = [...document.querySelectorAll("[id]")].map(e => e.id);
  return { open: document.getElementById("combatView").classList.contains("open"),
    order: [...document.querySelectorAll("#cvList > .card")].map(c => c.dataset.note),
    dupIds: ids.filter((x, i) => ids.indexOf(x) !== i),
    locked: document.documentElement.classList.contains("cv-lock") }; }
```

Expected: `open: true`, `order: ["vitals","statuses","attacks","resources","slots","activespells"]`,
`dupIds: []`, `locked: true`.

(b) Cards work in the view, and a re-rendered card stays (Review Focus 5):

```js
() => { const hp = document.getElementById("hpCur"); hp.value = "-3";
  hp.dispatchEvent(new Event("change", {bubbles: true}));
  document.querySelector("#cvList #bub-1 .b").click();
  addStatusByName("Prone"); renderStatuses();
  return { hp: character.hp.cur, slotUsed: character.slots[1].used,
    statusesInView: !!document.querySelector('#cvList > .card[data-note="statuses"]'),
    prone: (character.statuses || []).some(s => s.name === "Prone") }; }
```

Expected: `hp: 17` (a number or `"17"`), `slotUsed: 1`, `statusesInView: true`, `prone: true`.

(c) Close — every card back exactly where it was, nothing duplicated:

```js
() => { document.getElementById("cvClose").click();
  const now = [...document.querySelectorAll(".card[data-note]")].map(c =>
    c.dataset.note + "|" + c.closest(".tabpanel").id + "|" + [...c.parentElement.children].indexOf(c));
  const ids = [...document.querySelectorAll("[id]")].map(e => e.id);
  return { same: JSON.stringify(now) === JSON.stringify(window.__home),
    markers: document.querySelectorAll("[data-cvhome]").length,
    dupIds: ids.filter((x, i) => ids.indexOf(x) !== i),
    open: document.getElementById("combatView").classList.contains("open"),
    locked: document.documentElement.classList.contains("cv-lock") }; }
```

Expected: `same: true`, `markers: 0`, `dupIds: []`, `open: false`, `locked: false`.

- [ ] **Step 8: Drive the toggles, the empty states and Skills (Review Focus 3, 4)**

```js
() => { selectTab("inventory");
  document.querySelector('[data-combatbtn="coins"]').click();
  const added = character.combatSections.slice(-1)[0];
  document.getElementById("btnCombat").click();
  const coinsLast = document.querySelector("#cvList > .card:last-child").dataset.note;
  document.querySelector('#cvList [data-combatbtn="coins"]').click();
  const coinsHome = !!document.querySelector('#tab-inventory .card[data-note="coins"]');
  const as = document.getElementById("activeSpellCard");
  const empty = { shown: getComputedStyle(as).display !== "none",
    says: getComputedStyle(document.getElementById("activeSpellList"), "::before").content };
  character.statStyle = "grouped"; character.combatSections.push("skills"); renderAll();
  const skillsHidden = getComputedStyle(document.getElementById("skillsCard")).display === "none";
  character.combatSections = []; renderAll();
  const hint = document.getElementById("cvEmpty");
  return { added, coinsLast, coinsHome, empty, skillsHidden,
    hintShown: !hint.hidden, hintIcon: !!hint.querySelector("svg") }; }
```

Expected: `added: "coins"`, `coinsLast: "coins"`, `coinsHome: true`, `empty.shown: true`,
`empty.says: "\"None right now.\""`, `skillsHidden: true`, `hintShown: true`, `hintIcon: true`.

- [ ] **Step 9: Drive Esc, the ☰ flyout, tab switches and a character switch (Review Focus 2)**

```js
() => { character.combatSections = ["vitals", "attacks", "statuses"]; renderAll();
  const esc = () => document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
  openModal("Test", "<p>x</p>");
  esc();
  const afterOne = { modal: modal.classList.contains("open"), view: combatViewOpen() };
  document.getElementById("cvToc").click();
  const toc = [...document.querySelectorAll("#tocFly a")].map(a => a.textContent.trim());
  esc();
  const afterToc = { fly: document.getElementById("tocFly").classList.contains("open"), view: combatViewOpen() };
  esc();
  const afterTwo = combatViewOpen();
  document.getElementById("btnCombat").click();
  jumpToNote("abilities");
  const jumped = { view: combatViewOpen(), tab: document.querySelector(".tabpanel.active").id };
  document.getElementById("btnCombat").click();
  newCharacter("Pip", "humblewood");
  const ids = [...document.querySelectorAll("[id]")].map(e => e.id);
  const strays = [...document.querySelectorAll("[data-cvhome]")].filter(h =>
    !document.querySelector(`#cvList > .card[data-note="${h.dataset.cvhome}"]`)).length;
  return { afterOne, toc, afterToc, afterTwo, jumped,
    switched: { dupIds: ids.filter((x, i) => ids.indexOf(x) !== i), strays } }; }
```

Expected: `afterOne: {modal:false, view:true}`; `toc` lists the three cards' titles;
`afterToc: {fly:false, view:true}`; `afterTwo: false`; `jumped: {view:false, tab:"tab-sheet"}`;
`switched: {dupIds:[], strays:0}`.

Screenshot the open view (absolute `filename`) and one Sheet tab card heading showing both the
toggle and the note button.

- [ ] **Step 10: Commit (src only)**

```bash
git add src/js/87-combat.js src/js/40-sheet.js src/js/90-boot.js src/css/45-combat.css src/tests/sheet.js
git commit -m "task: open and close the combat view, and choose its sections

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The combat tracker

**Files:**
- Modify: `src/js/87-combat.js` (`combatHeaderHTML`; `startCombatNow`, `endCombatAsk`)
- Modify: `src/js/90-boot.js` (header clicks)
- Modify: `src/css/45-combat.css` (tracker)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `combatStart`, `combatEnd`, `combatElapsedSec`, `fmtCombatTime`, `advanceRound`,
  `renderCombatChrome`, `renderActiveSpells`, `toast`, `confirm`.
- Produces: `combatHeaderHTML(c)` final form; `startCombatNow()`; `endCombatAsk() → boolean`.
  Header ids: `#cvStart`, `#cvPrev`, `#cvNext`, `#cvEnd`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, add `'startCombatNow', 'endCombatAsk',` to the combat names, then insert above
the final `ck.done();`:

```js
/* ---- the tracker in the view's header ---- */
{
  const idle = X.combatHeaderHTML({combatActive: false, combatRound: 5});
  ck('out of combat the header offers Start combat, and no arrows or End',
     idle.includes('id="cvStart"') && !idle.includes('id="cvNext"') && !idle.includes('id="cvEnd"'));
  const r3 = X.combatHeaderHTML({combatActive: true, combatRound: 3});
  ck('in combat: round, in-game time, both arrows and End — and no Start',
     /Round <b>3<\/b> · 12 sec/.test(r3) && r3.includes('id="cvPrev"') && r3.includes('id="cvNext"') &&
     r3.includes('id="cvEnd"') && !r3.includes('id="cvStart"'));
  ck('◀ is live after round 1', !/id="cvPrev"[^>]*disabled/.test(r3));
  ck('◀ is disabled at round 1',
     /id="cvPrev"[^>]*disabled/.test(X.combatHeaderHTML({combatActive: true, combatRound: 1})));
  ck('End sits apart from the arrows',
     r3.indexOf('id="cvNext"') < r3.indexOf('class="grow"') && r3.indexOf('class="grow"') < r3.indexOf('id="cvEnd"'));
  ck('the header can still close and still has ☰', r3.includes('id="cvClose"') && r3.includes('id="cvToc"'));

  const c = X.blankChar(); c.combatRound = 4; X.character = c;
  X.startCombatNow();
  ck('Start combat, from the header, begins at round 1', X.inCombat(c) && c.combatRound === 1);
  c.combatRound = 7; state.confirm = false;
  ck('End combat asks first, naming the round',
     X.endCombatAsk() === false && state.lastConfirm === 'End combat at round 7?');
  ck('...and saying no leaves the fight running', X.inCombat(c) && c.combatRound === 7);
  state.confirm = true;
  ck('saying yes ends it', X.endCombatAsk() === true && !X.inCombat(c) && c.combatRound === 0);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/tests/sheet.js | tail -3` → Expected: `LOAD FAIL: startCombatNow is not defined`

- [ ] **Step 3: Implement the header and the two actions**

In `src/js/87-combat.js`, replace the whole Task 5 `combatHeaderHTML` (from
`/* ✕ · title · ☰ — Task 6 adds the tracker. */` through its closing `}`) with

```js
/* ✕ · title · tracker · (space) · Start or End · ☰. End sits past the spacer,
   well away from the arrows, so a hurried tap on ▶ cannot hit it. */
function combatHeaderHTML(c){
  const close=`<button class="tbtn" id="cvClose" aria-label="Close the combat view — combat keeps going" title="Close (combat keeps going)">✕</button>`;
  const title=`<span class="cv-title">${iconSVG("ui","Combat")}Combat</span>`;
  const toc=`<button class="tbtn" id="cvToc" aria-label="Jump to a section" title="Jump to a section">☰</button>`;
  if(!inCombat(c))return close+title+`<span class="grow"></span><button class="tbtn primary" id="cvStart">Start combat</button>`+toc;
  const r=num(c.combatRound);
  return close+title+
    `<span class="cv-track"><button class="tbtn" id="cvPrev" aria-label="Previous round"${r<=1?" disabled":""}>◀</button>`+
    `<span class="cv-round" aria-live="polite">Round <b>${r}</b> · ${fmtCombatTime(combatElapsedSec(c))}</span>`+
    `<button class="tbtn" id="cvNext" aria-label="Next round">▶</button></span>`+
    `<span class="grow"></span><button class="tbtn danger" id="cvEnd">End combat</button>`+toc;
}
```

Then append to the end of `src/js/87-combat.js`:

```js

/* ---- the tracker ---- */
function startCombatNow(){combatStart(character);renderActiveSpells();renderCombatChrome();scheduleSave();}
/* Asked first: the round count is the one thing here a stray tap would lose. */
function endCombatAsk(){
  const r=num(character.combatRound);
  if(!confirm(`End combat at round ${r}?`))return false;
  const s=combatEnd(character);
  renderActiveSpells();renderCombatChrome();scheduleSave();
  toast(`Combat ended after ${s.rounds} round${s.rounds===1?"":"s"} (${fmtCombatTime(s.sec)})`);
  return true;
}
```

In `src/js/90-boot.js`, replace `    if(t.closest("#cvToc"))return openToc();` with

```js
    if(t.closest("#cvToc"))return openToc();
    if(t.closest("#cvStart"))return startCombatNow();
    if(t.closest("#cvPrev"))return advanceRound(-1);
    if(t.closest("#cvNext"))return advanceRound(1);
    if(t.closest("#cvEnd"))return endCombatAsk();
```

- [ ] **Step 4: Style the tracker**

Append to `src/css/45-combat.css`:

```css

/* ---- the tracker ---- */
.cv-track{display:inline-flex;align-items:center;gap:6px}
.cv-round{font-family:var(--head);font-size:14px;min-width:9.5em;text-align:center;color:var(--ink)}
.cv-round b{font-size:18px}
.cv-head .tbtn[disabled]{opacity:.4;cursor:default}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `./src/tests/run.sh 2>&1 | tail -2` → Expected: `All 7 suites passed — … checks.`

- [ ] **Step 6: Build and drive a fight**

Run: `node scripts/build-html.js`. With the Playwright MCP, load the worktree's `dist/fieldbook.html`,
then `browser_evaluate`:

```js
() => { newCharacter("Tess", "dnd");
  character.activeSpells = [{id: "b1", name: "Bless", level: 1, conc: true, durationSec: 60, elapsedSec: 0}];
  renderAll();
  document.getElementById("btnCombat").click();
  document.getElementById("cvStart").click();
  document.getElementById("cvNext").click(); document.getElementById("cvNext").click();
  document.getElementById("cvBody").scrollTop = 200;
  const inView = { head: document.querySelector(".cv-round").textContent,
    blessSec: character.activeSpells[0].elapsedSec };
  document.getElementById("cvClose").click();
  selectTab("spells");
  const outside = { btn: document.getElementById("btnCombat").textContent.trim(),
    btnOn: document.getElementById("btnCombat").classList.contains("on"),
    cardRound: document.getElementById("roundNum").textContent };
  document.getElementById("btnCombat").click();
  return { inView, outside, back: { round: character.combatRound,
    scroll: document.getElementById("cvBody").scrollTop } }; }
```

Expected: `inView.head` is `Round 3 · 12 sec`; `inView.blessSec: 12`; `outside: {btn:"Rd 3",
btnOn:true, cardRound:"3"}`; `back.round: 3`; `back.scroll` is 200 (or the view's maximum scroll if
shorter). Screenshot the view in combat.

Then click `#cvEnd`, accept the dialog with `browser_handle_dialog` (`accept: true`), and check:
`character.combatActive === false`, `character.combatRound === 0`, `character.activeSpells.length === 1`,
the toast reads `Combat ended after 3 rounds (18 sec)`, and `#btnCombat` has no `on` class.

- [ ] **Step 7: Drive reload, character switch and an empty view (Review Focus 1, 2, 3)**

```js
() => { character.combatSections = []; renderAll();
  document.getElementById("btnCombat").click();
  document.getElementById("cvStart").click(); document.getElementById("cvNext").click();
  window.__tess = character.id;
  return { emptyStillFights: character.combatRound === 2 && !document.getElementById("cvEmpty").hidden,
    btn: document.getElementById("btnCombat").textContent.trim() }; }
```

Expected: `{emptyStillFights:true, btn:"Rd 2"}`. Now `browser_navigate` to the same URL again (a
reload), and evaluate:

```js
() => ({ id: character.id, round: character.combatRound, active: character.combatActive,
  btn: document.getElementById("btnCombat").textContent.trim(),
  open: document.getElementById("combatView").classList.contains("open") })
```

Expected: the same character, `round: 2`, `active: true`, `btn: "Rd 2"`, `open: false`. Then:

```js
() => { const tess = character.id; newCharacter("Pip", "humblewood");
  const pip = document.getElementById("btnCombat").textContent.trim();
  loadCharById(tess);
  return { pip, backOnTess: document.getElementById("btnCombat").textContent.trim() }; }
```

Expected: `{pip:"", backOnTess:"Rd 2"}`.

- [ ] **Step 8: Commit (src only)**

```bash
git add src/js/87-combat.js src/js/90-boot.js src/css/45-combat.css src/tests/sheet.js
git commit -m "task: the combat tracker — start, rounds, in-game time, end

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Arranging by drag and by keyboard

**Files:**
- Modify: `src/js/87-combat.js` (grips; `setCombatOrder`, `moveCombatCard`, `startCombatDrag`;
  `fillCombatView` and `sendCardHome` gain the grip)
- Modify: `src/js/90-boot.js` (pointerdown, arrow keys)
- Modify: `src/css/45-combat.css` (grip, drag state)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `moveCombatSection`, `combatSectionsOf`, `combatCard`, `scheduleSave`.
- Produces: `combatGripHTML(k) → string`; `setCombatOrder(list)`; `moveCombatCard(k, delta)`;
  `startCombatDrag(e, grip)`. Grip attribute: `data-cvgrip="<k>"`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, add `'combatGripHTML', 'moveCombatCard',` to the combat names, then insert
above the final `ck.done();`:

```js
/* ---- arranging ---- */
{
  const g = X.combatGripHTML('vitals');
  ck('the grip is a real button, named for its card and its keys',
     g.startsWith('<button') && g.includes('data-cvgrip="vitals"') && /Move Vitals — ↑ and ↓/.test(g));
  const c = X.blankChar(); X.character = c;
  X.moveCombatCard('vitals', 1);
  ck('↓ moves a section one place later', JSON.stringify(c.combatSections.slice(0, 2)) === '["statuses","vitals"]');
  X.moveCombatCard('vitals', -1);
  ck('↑ moves it back', c.combatSections[0] === 'vitals');
  X.moveCombatCard('vitals', -1);
  ck('↑ at the top does nothing', c.combatSections[0] === 'vitals' && c.combatSections.length === 6);
  X.moveCombatCard('coins', 1);
  ck('a section not in the view cannot be moved', c.combatSections.indexOf('coins') < 0);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/tests/sheet.js | tail -3` → Expected: `LOAD FAIL: combatGripHTML is not defined`

- [ ] **Step 3: Add the grips to the way in and out**

In `src/js/87-combat.js`, replace

```js
    const home=document.createElement("span");home.hidden=true;home.dataset.cvhome=k;
    card.before(home);list.appendChild(card);
```

with

```js
    const home=document.createElement("span");home.hidden=true;home.dataset.cvhome=k;
    card.before(home);list.appendChild(card);addGrip(card,k);
```

and replace

```js
function sendCardHome(k){
  const home=document.querySelector(`[data-cvhome="${k}"]`),card=combatCard(k);
  if(home&&card)home.replaceWith(card);else if(home)home.remove();
}
```

with

```js
/* Out: the grip comes off, so no tab ever shows one, and the card takes its
   marker's place — exactly where it was. */
function sendCardHome(k){
  const home=document.querySelector(`[data-cvhome="${k}"]`),card=combatCard(k);
  if(card)removeGrip(card);
  if(home&&card)home.replaceWith(card);else if(home)home.remove();
}
```

Then append to the end of `src/js/87-combat.js`:

```js

/* ---- arranging ----
   Inside the view only, each card heading gets a grip. The grip is a real
   <button>: focused, ↑ and ↓ move its card one place — the path for anyone
   without a mouse or touch. */
function combatGripHTML(k){
  const t=noteTitle(noteDef(k));
  return `<button class="cv-grip" data-cvgrip="${esc(k)}" aria-label="Move ${esc(t)} — ↑ and ↓ move it one place" title="Drag to move">`+
    `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>`;
}
function addGrip(card,k){const l=card.querySelector(".label");if(l&&!l.querySelector("[data-cvgrip]"))l.insertAdjacentHTML("afterbegin",combatGripHTML(k));}
function removeGrip(card){const g=card.querySelector("[data-cvgrip]");if(g)g.remove();}
/* The saved order is the truth; the view is re-laid from it. */
function setCombatOrder(list){
  character.combatSections=list;
  const box=document.getElementById("cvList");
  if(box)list.forEach(k=>{const c=combatCard(k);if(c&&c.parentNode===box)box.appendChild(c);});
  scheduleSave();
}
function moveCombatCard(k,delta){
  const list=combatSectionsOf(character),from=list.indexOf(k),to=from+delta;
  if(from<0||to<0||to>=list.length)return;
  setCombatOrder(moveCombatSection(list,from,to));
  const g=document.querySelector(`[data-cvgrip="${k}"]`);if(g)g.focus();
}
/* Pointer events, not HTML5 drag-and-drop, which is unreliable on phones. The
   dragged card is NEVER moved itself — moving an element can drop its pointer
   capture mid-drag — so its NEIGHBOURS hop over it instead. Near the view's top
   or bottom edge the view scrolls. The order is read back off the DOM on release. */
function startCombatDrag(e,grip){
  const card=grip.closest(".card"),list=document.getElementById("cvList"),body=document.getElementById("cvBody");
  if(!card||!list||!body||card.parentNode!==list)return;
  e.preventDefault();
  try{grip.setPointerCapture(e.pointerId);}catch(err){}
  card.classList.add("cv-dragging");
  const mid=el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;};
  const move=ev=>{
    const y=ev.clientY,prev=card.previousElementSibling,next=card.nextElementSibling;
    if(prev&&y<mid(prev))list.insertBefore(prev,card.nextSibling);
    else if(next&&y>mid(next))list.insertBefore(next,card);
    const b=body.getBoundingClientRect();
    if(y<b.top+48)body.scrollTop-=14;else if(y>b.bottom-48)body.scrollTop+=14;
  };
  const done=()=>{
    grip.removeEventListener("pointermove",move);grip.removeEventListener("pointerup",done);grip.removeEventListener("pointercancel",done);
    card.classList.remove("cv-dragging");
    const shown=[...list.querySelectorAll(":scope > .card[data-note]")].map(c=>c.dataset.note);
    setCombatOrder(shown.concat(combatSectionsOf(character).filter(k=>!shown.includes(k))));
  };
  grip.addEventListener("pointermove",move);grip.addEventListener("pointerup",done);grip.addEventListener("pointercancel",done);
}
```

- [ ] **Step 4: Wire the pointer and the arrow keys**

In `src/js/90-boot.js`, directly after the Esc listener added in Task 5 (the block ending `},true);`),
insert:

```js
  /* Arranging the combat view: the grip is the only drag handle. */
  document.addEventListener("pointerdown",e=>{
    const g=e.target.closest&&e.target.closest("[data-cvgrip]");
    if(g&&e.button===0)startCombatDrag(e,g);
  });
  document.addEventListener("keydown",e=>{
    const g=e.target.closest&&e.target.closest("[data-cvgrip]");
    if(!g||(e.key!=="ArrowUp"&&e.key!=="ArrowDown"))return;
    e.preventDefault();moveCombatCard(g.dataset.cvgrip,e.key==="ArrowUp"?-1:1);
  });
```

- [ ] **Step 5: Style the grip**

Append to `src/css/45-combat.css`:

```css

/* ---- arranging ----
   Only the grip starts a drag, so touch-action:none sits on the grip ALONE — a
   finger anywhere else on a card still scrolls the view. */
.cv-grip{flex:none;background:none;border:0;padding:4px 2px;margin:-4px 0 -4px -6px;cursor:grab;
  color:var(--ink-soft);touch-action:none;display:inline-flex;align-items:center}
.cv-grip svg{width:16px;height:16px;fill:currentColor}
.cv-grip:hover,.cv-grip:focus-visible{color:var(--accent-2)}
.cv-grip:active{cursor:grabbing}
.cv-dragging{box-shadow:0 16px 36px rgba(0,0,0,.30);outline:2px dashed var(--accent);outline-offset:3px}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `./src/tests/run.sh 2>&1 | tail -2` → Expected: `All 7 suites passed — … checks.`

- [ ] **Step 7: Build and drive a real drag, the keys, and a reload**

Run: `node scripts/build-html.js`. Load the worktree's `dist/fieldbook.html`; `browser_evaluate`
`() => { newCharacter("Tess","dnd"); document.getElementById("btnCombat").click(); return true; }`. Then
`browser_run_code_unsafe`:

```js
async (page) => {
  const grip = page.locator('#cvList > .card[data-note="vitals"] [data-cvgrip]');
  const target = page.locator('#cvList > .card[data-note="attacks"]');
  const g = await grip.boundingBox(), t = await target.boundingBox();
  const x = g.x + g.width / 2, y0 = g.y + g.height / 2, y1 = t.y + t.height * 0.75;
  await page.mouse.move(x, y0); await page.mouse.down();
  for (let i = 1; i <= 16; i++) await page.mouse.move(x, y0 + (y1 - y0) * i / 16);
  await page.mouse.up();
  return await page.evaluate(() => ({
    saved: character.combatSections,
    shown: [...document.querySelectorAll('#cvList > .card')].map(c => c.dataset.note),
    grips: document.querySelectorAll('[data-cvgrip]').length }));
}
```

Expected: `saved` equals `shown`; `vitals` is no longer first; `grips: 6`. Then
`browser_evaluate` `() => { document.querySelector('[data-cvgrip="attacks"]').focus(); return true; }`,
`browser_press_key` `ArrowDown`, and evaluate
`() => ({ order: character.combatSections, focused: document.activeElement.dataset.cvgrip })` —
`attacks` moved one place later and `focused: "attacks"`. Reload (`browser_navigate` to the same URL)
and confirm `character.combatSections` kept the new order. Close the view and confirm
`document.querySelectorAll('[data-cvgrip]').length === 0`.

- [ ] **Step 8: Commit (src only)**

```bash
git add src/js/87-combat.js src/js/90-boot.js src/css/45-combat.css src/tests/sheet.js
git commit -m "task: arrange the combat view by dragging or with the arrow keys

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Release note, ledger, full build and the screenshot pass

**Files:**
- Modify: `src/docs/UNRELEASED.md`, `src/docs/_claude/WIRING-LEDGER.md`, `CLAUDE.md` (layout)

- [ ] **Step 1: Add the release note**

Append to the end of the `## Pending` list in `src/docs/UNRELEASED.md`:

```markdown
- New **combat view**. Tap the crossed swords in the tab bar to open a full-screen view of just the
  sections you need in a fight — any card from any tab, added with the crossed-swords button in its
  heading and arranged by dragging. Everything works there exactly as it does on its own tab.
  **Start combat** counts rounds and in-game time and moves your active spells along each round.
  Close the view to look something up and combat keeps going — the button shows the round, and one
  tap brings you back. **End combat** is its own button.
```

- [ ] **Step 2: Record where the specs and plans live**

In `CLAUDE.md`, replace
`    ADR-001-source-split.md  why the source is split and how the build works` with

```
    ADR-001-source-split.md  why the source is split and how the build works
    specs/              one design spec per feature, written and approved before any plan
    plans/              the implementation plans that execute those specs
```

- [ ] **Step 3: Append the ledger entry**

Append to `src/docs/_claude/WIRING-LEDGER.md` (keep the blank line before the heading):

```markdown

## Done — the combat view (issues #9, #10, #11)

A full-screen view, opened from crossed swords in the tab bar, holding any of the 19 sections — the
REAL cards, moved into `#cvList` with a hidden `[data-cvhome]` marker left at home, and moved back on
close. Copies would duplicate every id (the #17 `#skill-perception` bug). A tracker in its header
(Start, ◀ ▶, End) drives the existing `advanceRound()`. Closing the view never ends combat.
Spec: `src/docs/specs/2026-09-24-combat-view-design.md`; plan: `src/docs/plans/2026-09-24-combat-view.md`.

Things that are not obvious and would be easy to undo by accident:

- **`COMBAT_DEFAULTS` lives in `00-constants.js`**, not `87-combat.js`: `blankChar()` reads it at load,
  when a later fragment's `const` is still in its TDZ.
- **`combatActive` is its own flag.** The Active Spells card has always moved `combatRound`, so
  deriving "in combat" from `round > 0` would drop old sheets into a fight on update.
- **The Esc listener is registered in the CAPTURE phase.** The modal's Esc handler runs first
  otherwise, shuts the modal, and the same keypress then closes the view behind it.
- **A drag never moves the dragged card** — moving an element can drop its pointer capture — so its
  neighbours hop over it instead, and the order is read back off the DOM on release.
- **`renderFamiliars()` now clears its list before its early return**: the view shows that card even
  when empty, and the stale last familiar would have shown with it.
- **`src/tests/docs.js` has two icon lists**: `KINDS` (everything vendored, now including `ui`) and
  `DATA_KINDS` (the three whose names ship in `data/`, for the coverage check).
- `selectTab()` closes the view first, so a note link never lands on a tab with its cards missing.

Known and accepted: Active Spells, Familiars and Skills (in By ability mode) are hidden on their own
tab when empty, so their toggle can only be reached once they have content — or from inside the view.
The item finder has no Esc of its own, so with the finder open over the view Esc leaves both open.
```

- [ ] **Step 4: Full build and tests**

Run: `./build.sh --no-zip 2>&1 | tail -6` → Expected: it finishes with `Done` and no error.
Run: `./src/tests/run.sh 2>&1 | tail -2` → Expected: `All 7 suites passed — … checks.`

- [ ] **Step 5: The screenshot matrix**

Save every file under
`/private/tmp/claude-501/-Users-mwardman-Documents-Repos-RPGFieldbook/e0071fe0-1215-43bb-a518-cd5a417aaefe/scratchpad/combat-shots/`
(create it first with `mkdir -p`). Always pass the absolute path as `filename`.

For each skin (`newCharacter("Tess","dnd")` → D&D; `newCharacter("Pip","humblewood")` → Humblewood)
× each theme (`settings.theme="light"` or `"dark"`, then `applyTheme()`), at 1280×900 and at 400×800
(`browser_resize`), with an active spell seeded so the Active Spells card has content:

- `cv-<skin>-<theme>-<width>-idle.png` — the view open, out of combat, `fullPage: true`
- `cv-<skin>-<theme>-<width>-fight.png` — Start, ▶ twice: the header reads `Round 3 · 12 sec`

Plus, D&D light at 1280:

- `btn-idle.png` and `btn-rd3.png` — the tab bar, idle and in combat
- `heading-after.png` — the Vitals card heading on the Sheet tab, with the toggle beside the note button
- `heading-before.png` — the same heading from `main`'s build,
  `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`

Read every PNG back and look at it before claiming it shows what it should. Check in particular: the
crossed swords' weight beside ☰; the header wrapping cleanly at 400 wide; the toggle and note button
sitting together at the right of each heading; "None right now." on an empty Active Spells card.

- [ ] **Step 6: Commit (src only — `git status` should show `dist/fieldbook.html` modified and uncommitted)**

```bash
git add src/docs/UNRELEASED.md src/docs/_claude/WIRING-LEDGER.md CLAUDE.md
git commit -m "task: combat view release note and ledger entry

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Report**

Tell Mike: what was driven (every check above, with its result), what was not (touch-dragging on a
real phone, browsers other than Chrome, his own saved characters), where the screenshots are, and that
the branch is ready for his QA. Do not push, open a PR, merge or release without his say-so.
