# Ammunition Recovery Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-character ammunition recovery rule (half, all, hits only, none), a per-item
always/never override with app-side defaults (firearm bullets never, thrown weapons always), a
Hit-or-miss question in Hits-only mode, a Throw button for thrown weapons, and End combat that
recovers on its own with an Undo (#104).

**Architecture:**
- **One path for every shot.** A launcher's Fire and a thrown weapon's Throw both record into the
  existing `ammoSpent` map through one helper, `ammoRecordShot()`, which now also tallies hits and
  misses. A thrown weapon's entry is keyed by the weapon item's own id.
- **The rule is read at recovery.** `ammoRecoverRule(c, item)` resolves item override → app
  default → sheet rule, and `ammoBack(rule, entry)` says how many come back. `ammoRecoverable()` and
  `recoverAmmo()` use both. `recoverAmmo()` can fill a **record** that `undoRecovery()` reverses
  precisely.
- **The DOM half** (`62-ammo.js`'s second half, `87-combat.js`, `88-settings.js`, `80-modal-forms.js`,
  `90-boot.js`) only asks, draws and wires.

**Tech Stack:** Plain ES2020 concatenated into one `<script>`, no modules; plain CSS on the theme
tokens; Node suites through `src/tests/harness.js`; the project's Playwright MCP (`mcp__playwright__*`)
for driven checks and screenshots.

**Spec:** `src/docs/specs/2026-10-18-ammo-recovery-design.md`. Read it first; this plan argues from
it. The ammunition page `src/docs/wiki/features/ammunition.md` describes the code being extended.

**Worktree:** `.claude/worktrees/104`, branch `issue/104-ammo-recovery`. Create it from the repo
root before Task 1 with `./scripts/wt.sh add 104 ammo-recovery`, then run every command below from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/104`.

## Global Constraints

**The build**
- One shipped file, built by concatenation: no `import`/`export`, no `type="module"`, no runtime
  dependency, no network. This branch adds no fragment.
- **Byte hygiene:** LF endings, one final newline, no BOM. Private-use characters only as escapes.
- **TDZ (ADR-001):** `blankChar()` runs at load in `00-constants.js`, so its defaults are literals
  there. Functions hoist across fragments; a top-level statement may not read a later fragment's
  `const`/`let`.
- **Before `rules-data.js` (or `run.sh`), build:** `./build.sh --no-zip`.

**Git and release**
- Branch commits carry source and docs only; never `git add` `dist/fieldbook.html` or
  `docs/CHANGELOG.md`. Always `git add` explicit paths.
- Never touch `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Character data**
- One new character field, `ammoRecovery` (`"half"` | `"all"` | `"hits"` | `"none"`), default
  `"half"` in `blankChar()`; read only through `ammoRecoveryOf()`, which reads anything else as
  `"half"`.
- One new optional item field, `recover` (`"always"` | `"never"`), top-level, never inside `ammo`
  or `weapon`, read only through `itemRecover()`.
- `ammoSpent[id]` gains `hits` and `misses`, read only through `ammoSpentEntry()`, clamped to
  `0 ≤ hits`, `0 ≤ misses`, `hits + misses ≤ n`. Task 5 drops `asked`.
- The packs and `docs/rules-schema.md` do not change.

**Markup safety**
- Every `${…}` inside a quoted HTML attribute value is `esc(…)` of the whole expression, or a
  ternary that can only yield literals (`rules-data.js` scans all of `src/js`). Tag-position
  ternaries (`${q>=1?"":" disabled"}`) are fine.
- A modal's title is plain text, never `esc()`'d.

**The test harness**
- `src/tests/sheet.js` names what it reads as `X.name` in `loadApp([...])`; every name there must
  exist (a missing one is `LOAD FAIL`). A function reached as `ctx.name` needs no entry.
- Run one suite: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.

**Settled decisions (spec §2)**
- The rule lives per character in Settings → Sheet display. Hits-only asks Hit or miss at Fire/Throw.
- Every hit comes back; an unanswered shot comes back at half; the rule is read at recovery.
- An item's own `recover` wins over the sheet's rule, None included. Defaults: firearm bullet
  never, a Thrown weapon always.
- A thrown weapon throws itself, and stays on the sheet at ×0 with Throw disabled.
- End combat recovers on its own when anything is recoverable, with **Undo recovery** on the toast.

## Review Focus

Inputs the spec implies but no task would otherwise test; each line's test is in the owning task.

1. **Editing a thrown weapon at ×0 in the item editor** — its Quantity box defaults `num(qty)||1`
   and saves `num(v)||1`, so a save would quietly make it ×1. Task 6 allows 0 and keeps it.
2. **Undo recovery after the player fires again** from a stack the recovery topped up — the Undo
   must take back only what it gave and keep the new shot (Task 3).
3. **A recovery that rebuilt a used-up stack, then Undo** — the rebuilt stack must go, not linger at
   ×0 (Task 3).
4. **"Thrown" inside another word, or a launcher whose notes say Thrown** — neither is a thrown
   weapon (Task 1).
5. **Hits-only with an item set to Always** — no question (Task 4).

---

## File Structure

| File | Responsibility on this branch |
|---|---|
| `src/js/62-ammo.js` | the rule helpers, shot recording, throwing, recovery and its record, undo; the thrown row, the question, the taps, `applyAmmoRecovery()`, `undoRecoveryTap()`, `recoverOptionsHTML()` |
| `src/js/00-constants.js` | `ammoRecovery:"half"` in `blankChar()` |
| `src/js/87-combat.js` | `endCombatAsk()` uses `applyAmmoRecovery()` and offers Undo recovery |
| `src/js/88-settings.js` | the Sheet display "Ammunition" group and its select |
| `src/js/80-modal-forms.js` | the item editor's Recovery select; Quantity allows 0 |
| `src/js/90-boot.js` | the `[data-ammo-throw]` click |
| `src/tests/sheet.js`, `src/tests/rules-data.js` | the tests |
| docs | `ammunition.md`, `combat-view.md` (Task 5 keeps their names valid; Task 7 rewrites), `inventory.md`, `settings-and-updates.md`, `character-model.md`, `known-issues.md`, `1.9.0.md`, the spec's As built, ledger, `UNRELEASED.md` |

---

### Task 1: The rule — who gets what back

**Files:**
- Modify: `src/js/62-ammo.js` (after `ammoOne()`, the end of the "reading it" section; and `ammoSpentEntry()`)
- Modify: `src/js/00-constants.js` (`blankChar()`, beside `ammoSpent:{}`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Produces: `AMMO_RECOVERY` (`[[value,label],…]`); `ammoRecoveryOf(c) → "half"|"all"|"hits"|"none"`;
  `itemRecover(it) → "always"|"never"|""`; `weaponThrown(it) → boolean`;
  `ammoThrownKind(it) → string`; `AMMO_RECOVER_DEFAULTS`; `ammoDefaultRecover(it) → "always"|"never"|""`;
  `ammoRecoverRule(c, it) → "always"|"never"|"half"|"all"|"hits"|"none"`;
  `ammoBack(rule, e) → number` for `e = {n, hits, misses}`;
  `ammoSpentEntry(c, id) → {n, hits, misses, kind, snap, asked}`.

- [ ] **Step 1: Add the names to `loadApp`**

In `src/tests/sheet.js`, the line beginning `'ammoSpentEntry', 'fireAmmo', 'undoFire',` gets, at its
start, `'AMMO_RECOVERY', 'ammoRecoveryOf', 'itemRecover', 'weaponThrown', 'ammoThrownKind', 'AMMO_RECOVER_DEFAULTS', 'ammoDefaultRecover', 'ammoRecoverRule', 'ammoBack',`.

- [ ] **Step 2: Write the failing tests**

Insert immediately before the block that begins `/* ---- firing, Undo, recovery and the +N (#6) ---- */`:

```js
/* ---- the recovery rule: who gets what back (#104, spec §4) ---- */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ck('#104 a new character recovers half', X.blankChar().ammoRecovery === 'half' && X.ammoRecoveryOf(X.blankChar()) === 'half');
  ck('#104 a sheet from before reads as half, and so does junk',
     X.ammoRecoveryOf(X.migrate({abilities: {}})) === 'half' && X.ammoRecoveryOf({ammoRecovery: 'lots'}) === 'half' &&
     X.ammoRecoveryOf({ammoRecovery: 'constructor'}) === 'half' && X.ammoRecoveryOf(null) === 'half');
  ck('#104 each rule reads as itself', ['half', 'all', 'hits', 'none'].every(r => X.ammoRecoveryOf({ammoRecovery: r}) === r));
  ck('#104 the rule survives a save and load',
     X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {ammoRecovery: 'hits'})))).ammoRecovery === 'hits');
  ck('#104 an item override is always, never, or nothing',
     X.itemRecover({recover: 'always'}) === 'always' && X.itemRecover({recover: 'never'}) === 'never' &&
     X.itemRecover({recover: 'sometimes'}) === '' && X.itemRecover({recover: '__proto__'}) === '' && X.itemRecover(null) === '');
  const w = n => ({name: 'Dagger', weapon: {kind: 'melee', dice: '1d4', notes: n}});
  ck('#104 the SRD thrown weapons read as thrown',
     ['Range 20/60 · Finesse, Light, Thrown · Mastery: Nick', 'Range 30/120 · Thrown · Mastery: Slow',
      'Range 20/60 · Versatile 1d8 · Thrown · Mastery: Sap'].every(n => X.weaponThrown(w(n))));
  ck('#104 Thrown must be a whole property, in any case',
     X.weaponThrown(w('Light, THROWN')) && !X.weaponThrown(w('Unthrown, Light')) && !X.weaponThrown(w('Finesse, Light')) && !X.weaponThrown(w('')));
  ck('#104 a launcher is never thrown, and junk is not thrown',
     !X.weaponThrown({weapon: {ammo: 'arrow', notes: 'Thrown'}}) && !X.weaponThrown({weapon: {notes: 7}}) &&
     !X.weaponThrown({weapon: []}) && !X.weaponThrown({weapon: 'Thrown'}) && !X.weaponThrown(null));
  ck("#104 a thrown weapon's kind is its own name", X.ammoThrownKind({name: ' +1  Dagger '}) === '+1 dagger' && X.ammoThrownKind({name: ''}) === 'thrown weapon');
  const bullet = {ammo: {kind: 'firearm bullet'}}, arrow = {ammo: {kind: 'arrow'}}, dagger = w('Finesse, Light, Thrown');
  ck('#104 defaults: bullets never, thrown weapons always, arrows none',
     X.ammoDefaultRecover(bullet) === 'never' && X.ammoDefaultRecover(dagger) === 'always' && X.ammoDefaultRecover(arrow) === '' &&
     X.ammoDefaultRecover({ammo: {kind: 'constructor'}}) === '' && X.ammoDefaultRecover(null) === '');
  const none = {ammoRecovery: 'none'};
  ck('#104 the rule: the item, then its default, then the sheet',
     X.ammoRecoverRule(none, Object.assign({recover: 'never'}, dagger)) === 'never' && X.ammoRecoverRule(none, dagger) === 'always' &&
     X.ammoRecoverRule({ammoRecovery: 'all'}, bullet) === 'never' && X.ammoRecoverRule(none, arrow) === 'none' &&
     X.ammoRecoverRule(none, Object.assign({recover: 'always'}, arrow)) === 'always' && X.ammoRecoverRule({}, null) === 'half');
  const e = {n: 7, hits: 3, misses: 2};
  ck('#104 how many come back under each rule',
     X.ammoBack('always', e) === 7 && X.ammoBack('all', e) === 7 && X.ammoBack('half', e) === 3 &&
     X.ammoBack('hits', e) === 4 && X.ammoBack('never', e) === 0 && X.ammoBack('none', e) === 0);
  ck('#104 hits only, with no shot answered, is half', X.ammoBack('hits', {n: 5, hits: 0, misses: 0}) === 2);
  const E = v => X.ammoSpentEntry({ammoSpent: {a: v}}, 'a');
  ck('#104 an entry reads its tallies', same([E({n: 5, kind: 'arrow', hits: 2, misses: 1}).hits, E({n: 5, kind: 'arrow', hits: 2, misses: 1}).misses], [2, 1]));
  ck('#104 tallies are clamped: never below 0, never past n together',
     E({n: 5, kind: 'arrow', hits: 9, misses: 9}).hits === 5 && E({n: 5, kind: 'arrow', hits: 9, misses: 9}).misses === 0 &&
     E({n: 5, kind: 'arrow', hits: -1, misses: 'x'}).hits === 0 && E({n: 5, kind: 'arrow', hits: 3, misses: 4}).misses === 2);
  ck('#104 an entry from before #104 has no answers', E({n: 5, kind: 'arrow'}).hits === 0 && E({n: 5, kind: 'arrow'}).misses === 0);
}
```

In the same file, the existing assertion `ck('junk spent entries read as nothing',` compares
`X.ammoSpentEntry({ammoSpent: {x: 'junk'}}, 'x')` with `{n: 0, kind: '', snap: null, asked: 0}`;
change that object to `{n: 0, hits: 0, misses: 0, kind: '', snap: null, asked: 0}`.

- [ ] **Step 3: Run it to make sure it fails**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `LOAD FAIL` naming `AMMO_RECOVERY`.

- [ ] **Step 4: Implement**

In `src/js/00-constants.js`, `blankChar()`: the comment and line

```js
    /* Ammunition fired since the last recovery (62-ammo.js): stack id ->
       {n, kind, snap}. `ammoInit` is NOT defaulted: the one-time pass sets it. */
    ammoSpent:{},
```

become

```js
    /* Ammunition fired since the last recovery (62-ammo.js): stack or thrown
       weapon id -> {n, hits, misses, kind, snap}. `ammoInit` is NOT defaulted:
       the one-time pass sets it. `ammoRecovery` is the character's rule for what
       comes back (#104): half, all, hits or none; half is the rules as written
       and what every sheet did before. */
    ammoSpent:{}, ammoRecovery:"half",
```

In `src/js/62-ammo.js`, directly after `function ammoOne(kind){…}`, add:

```js
/* ---- recovery: the rule, and what comes back (#104) ----
   The character's rule, an item's own override, the app's defaults, and how
   many of one entry's shots come back. Read at recovery, never at the shot,
   so changing the setting reaches shots already fired.
   Design: src/docs/specs/2026-10-18-ammo-recovery-design.md §4 */
const AMMO_RECOVERY=[["half","Half (rules as written)"],["all","All"],["hits","Hits only"],["none","None"]];
function ammoRecoveryOf(c){const v=c&&c.ammoRecovery;return AMMO_RECOVERY.some(r=>r[0]===v)?v:"half";}
/* An item's own override, kept OUTSIDE ammo and weapon (the rules-update tool
   owns those): "always", "never", or "" for the sheet's rule. */
function itemRecover(it){const v=it&&it.recover;return (v==="always"||v==="never")?v:"";}
/* A thrown weapon lists Thrown among the properties in its notes ("Range 20/60
   · Finesse, Light, Thrown · Mastery: Nick"): a whole property, any case. A
   launcher is never thrown. */
function weaponThrown(it){
  const w=it&&it.weapon;
  if(!w||typeof w!=="object"||Array.isArray(w)||ammoKindOf(w.ammo))return false;
  return (typeof w.notes==="string"?w.notes:"").split("·").some(seg=>seg.split(",").some(p=>p.trim().toLowerCase()==="thrown"));
}
/* What a thrown weapon's throws are counted as: its own name, as a kind. */
function ammoThrownKind(it){return ammoKindOf(String(it&&it.name||""))||"thrown weapon";}
/* The app's defaults, so the packs need not say (spec decision 5). */
const AMMO_RECOVER_DEFAULTS={"firearm bullet":"never"};
function ammoDefaultRecover(it){
  const am=itemAmmo(it);
  if(am)return ammoTable(AMMO_RECOVER_DEFAULTS,am.kind)||"";
  return weaponThrown(it)?"always":"";
}
/* The rule for one item: its own override, else the app's default, else the
   character's rule. None does not override an item set to always. */
function ammoRecoverRule(c,it){return itemRecover(it)||ammoDefaultRecover(it)||ammoRecoveryOf(c);}
/* How many of one entry's shots come back under a rule. Hits only: every hit,
   and half of the shots nobody answered for. */
function ammoBack(rule,e){
  if(rule==="always"||rule==="all")return e.n;
  if(rule==="half")return Math.floor(e.n/2);
  if(rule==="hits")return e.hits+Math.floor((e.n-e.hits-e.misses)/2);
  return 0;
}
```

Replace `ammoSpentEntry()` (and its comment) with:

```js
/* One stack's spent record, coerced: how many fired since the last recovery,
   how many of those were answered Hit and Miss (#104: each clamped so that
   hits + misses never passes n), its kind, the copy recovery rebuilds a
   used-up stack from, and how many of those shots End combat has already asked
   about (#6 final review: clamped to [0, n]). */
function ammoSpentEntry(c,id){
  const e=ammoSpentMap(c)[id], ok=!!e&&typeof e==="object"&&!Array.isArray(e);
  const n=(ok&&Number.isInteger(e.n)&&e.n>0)?e.n:0;
  const cnt=v=>(ok&&Number.isInteger(v))?Math.max(0,Math.min(n,v)):0;
  const hits=cnt(ok?e.hits:0), misses=Math.min(n-hits,cnt(ok?e.misses:0));
  return {n,hits,misses,kind:ok?ammoKindOf(e.kind):"",
          snap:(ok&&e.snap&&typeof e.snap==="object"&&!Array.isArray(e.snap))?e.snap:null,
          asked:cnt(ok?e.asked:0)};
}
```

- [ ] **Step 5: Run the tests**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`.
Run: `./build.sh --no-zip && ./src/tests/run.sh | tail -3` → every suite passing.

- [ ] **Step 6: Commit**

```bash
git add src/js/62-ammo.js src/js/00-constants.js src/tests/sheet.js
git commit -m "feat(#104): the ammunition recovery rule

A character's rule (half by default), an item's own always/never, the
app's defaults for firearm bullets and thrown weapons, and how many of an
entry's shots come back under each; spent entries tally hits and misses.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: A shot's answer, and throwing

**Files:**
- Modify: `src/js/62-ammo.js` (`fireAmmo()` and a new `ammoRecordShot()` and `throwAmmo()` beside it)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `ammoSpentEntry()`, `weaponThrown()`, `ammoThrownKind()` (Task 1).
- Produces: `ammoRecordShot(c, item, kind, outcome) → undo`; `fireAmmo(c, weaponItem, outcome) → {stack, kind, left, removed, undo, outcome} | null`;
  `throwAmmo(c, weaponItem, outcome) → same shape | null` (the item stays at ×0; `removed` is always false).
  `outcome` is `"hit"`, `"miss"`, or anything else for none. `undoFire()` is unchanged and undoes either.

- [ ] **Step 1: Add the name to `loadApp`**

In `src/tests/sheet.js`, the `loadApp` line holding `'fireAmmo', 'undoFire',` gains `'throwAmmo', 'ammoRecordShot',` after `'undoFire',`.

- [ ] **Step 2: Write the failing tests**

Insert immediately after the block added in Task 1:

```js
/* ---- a shot's answer, and throwing (#104, spec §5) ---- */
{
  const DAGGER = 'Range 20/60 · Finesse, Light, Thrown · Mastery: Nick';
  const mk = () => {
    const c = X.blankChar();
    c.inventory = [{id: 'w1', name: 'Longbow', qty: 1, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
                   {id: 's1', name: 'Arrow', qty: 5, ammo: {kind: 'arrow'}},
                   {id: 'd1', name: 'Dagger', qty: 2, equipped: true, weapon: {kind: 'melee', dice: '1d4', notes: DAGGER}}];
    return c;
  };
  let c = mk(); const bow = c.inventory[0];
  X.fireAmmo(c, bow, 'hit'); X.fireAmmo(c, bow, 'miss'); X.fireAmmo(c, bow); const last = X.fireAmmo(c, bow, 'hit');
  let e = X.ammoSpentEntry(c, 's1');
  ck('#104 a shot records its answer, and an unanswered one records none', e.n === 4 && e.hits === 2 && e.misses === 1, e);
  ck('#104 ...and the shot says which', last.outcome === 'hit');
  ck('#104 Undo takes the answer back with the shot', X.undoFire(c, last) && X.ammoSpentEntry(c, 's1').hits === 1 && X.ammoSpentEntry(c, 's1').n === 3);
  ck('#104 an answer that is neither counts as none',
     (() => { const k = mk(); X.fireAmmo(k, k.inventory[0], 'graze'); const x = X.ammoSpentEntry(k, 's1'); return x.n === 1 && x.hits === 0 && x.misses === 0; })());
  c = mk(); const dag = c.inventory[2];
  const t = X.throwAmmo(c, dag);
  ck('#104 a throw takes one from the weapon itself', !!t && dag.qty === 1 && t.left === 1 && !t.removed && t.kind === 'dagger');
  ck('#104 ...and counts it under the weapon, with a one-piece copy',
     X.ammoSpentEntry(c, 'd1').n === 1 && X.ammoSpentEntry(c, 'd1').snap.name === 'Dagger' && X.ammoSpentEntry(c, 'd1').snap.qty === 1);
  const t2 = X.throwAmmo(c, dag, 'miss');
  ck('#104 the last throw leaves the weapon on the sheet at ×0, in its place',
     dag.qty === 0 && c.inventory.indexOf(dag) === 2 && !t2.removed && X.ammoSpentEntry(c, 'd1').misses === 1);
  ck('#104 at ×0 there is nothing to throw', X.throwAmmo(c, dag) === null && dag.qty === 0 && X.ammoSpentEntry(c, 'd1').n === 2);
  ck('#104 Undo of a throw puts the weapon back to ×1', X.undoFire(c, t2) && dag.qty === 1 && X.ammoSpentEntry(c, 'd1').n === 1);
  ck('#104 only a thrown weapon on this sheet is thrown',
     X.throwAmmo(c, c.inventory[0]) === null && X.throwAmmo(c, {id: 'x', name: 'Dagger', qty: 3, weapon: {notes: 'Thrown'}}) === null);
}
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `LOAD FAIL` naming `throwAmmo`.

- [ ] **Step 4: Implement**

In `src/js/62-ammo.js`, replace `fireAmmo()` (with its comment) by:

```js
/* One shot onto `st`'s spent entry: one more on its count, one more Hit or
   Miss when the question was answered (#104), and a one-piece copy of the item
   for recovery to rebuild from. The entry is rebuilt every shot, so the
   tallies and `asked` are carried across by hand. Returns what Undo needs to
   put it back. Shared by Fire and Throw, so both count the same way. */
function ammoRecordShot(c,st,kind,outcome){
  if(!c.ammoSpent||typeof c.ammoSpent!=="object"||Array.isArray(c.ammoSpent))c.ammoSpent={};
  const undo={stack:JSON.parse(JSON.stringify(st)),at:c.inventory.indexOf(st),
              spent:c.ammoSpent[st.id]?JSON.parse(JSON.stringify(c.ammoSpent[st.id])):null};
  const p=ammoSpentEntry(c,st.id);
  c.ammoSpent[st.id]={n:p.n+1,hits:p.hits+(outcome==="hit"?1:0),misses:p.misses+(outcome==="miss"?1:0),
    kind,asked:p.asked,snap:Object.assign(JSON.parse(JSON.stringify(st)),{qty:1})};
  return undo;
}
/* One shot from the weapon's loaded stack: one piece off it (the last removes
   the stack, as using the last potion does), counted with its answer. Returns
   what Undo needs, or null when there is nothing to fire. */
function fireAmmo(c,weaponItem,outcome){
  const st=loadedStack(c,weaponItem);if(!st)return null;
  const am=itemAmmo(st), undo=ammoRecordShot(c,st,am.kind,outcome);
  const left=Math.max(0,itemQty(st)-1);
  if(left<=0)c.inventory=c.inventory.filter(x=>x!==st);else st.qty=left;
  return {stack:st,kind:am.kind,left,removed:left<=0,undo,outcome:(outcome==="hit"||outcome==="miss")?outcome:""};
}
/* One throw of a thrown weapon (#104): one off the weapon item's own count.
   At ×0 the item STAYS (spec decision 8): its attack row must not vanish
   mid-fight, and recovery adds back onto it. Returns the same record as
   fireAmmo(), so undoFire() puts it back; null when it is not a thrown weapon
   on this sheet or none is left. */
function throwAmmo(c,weaponItem,outcome){
  if(!weaponThrown(weaponItem)||!Array.isArray(c&&c.inventory)||c.inventory.indexOf(weaponItem)<0||itemQty(weaponItem)<1)return null;
  const kind=ammoThrownKind(weaponItem), undo=ammoRecordShot(c,weaponItem,kind,outcome);
  const left=Math.max(0,itemQty(weaponItem)-1);
  weaponItem.qty=left;
  return {stack:weaponItem,kind,left,removed:false,undo,outcome:(outcome==="hit"||outcome==="miss")?outcome:""};
}
```

`undoFire()` is unchanged: it finds the weapon still on the sheet and puts one back, and restores
the entry as it was.

- [ ] **Step 5: Run the tests**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`.
`./build.sh --no-zip && ./src/tests/run.sh | tail -3` → every suite passing.

- [ ] **Step 6: Commit**

```bash
git add src/js/62-ammo.js src/tests/sheet.js
git commit -m "feat(#104): a shot records its answer; a thrown weapon throws itself

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Recovery under the rule, with a record and its Undo

**Files:**
- Modify: `src/js/62-ammo.js` (`ammoRecoverable()`, `recoverAmmo()`; add `ammoEntryItem()`, `undoRecovery()`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `ammoRecoverRule()`, `ammoBack()`, `ammoSpentEntry()`, `weaponThrown()` (Task 1); `fireAmmo()` (Task 2).
- Produces: `ammoEntryItem(c, id, e) → item | snap`; `ammoRecoverable(c) → [{kind, fired, back}]`
  under the rule; `recoverAmmo(c, kinds, rec) → number` — when `rec` is an object it is filled with
  `{added:[{id,n}], made:[{id,n}], repointed:[{id,from}], cleared:{[id]:entry}}`;
  `undoRecovery(c, rec) → boolean`.

- [ ] **Step 1: Add the names to `loadApp`**

`'ammoEntryItem', 'undoRecovery',` after `'recoverAmmo',` in the `loadApp` list.

- [ ] **Step 2: Write the failing tests**

Insert immediately after the block added in Task 2:

```js
/* ---- recovery under each rule, its record and its Undo (#104, spec §4.3, §6) ---- */
{
  const norm = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  const mk = rule => {
    const c = X.blankChar(); c.ammoRecovery = rule;
    c.inventory = [{id: 's1', name: 'Arrow', qty: 2, ammo: {kind: 'arrow'}},
                   {id: 'b1', name: 'Firearm Bullet', qty: 3, ammo: {kind: 'firearm bullet'}},
                   {id: 'd1', name: 'Dagger', qty: 0, weapon: {kind: 'melee', dice: '1d4', notes: 'Finesse, Light, Thrown'}}];
    c.ammoSpent = {s1: {n: 6, hits: 3, misses: 1, kind: 'arrow'}, b1: {n: 4, kind: 'firearm bullet'}, d1: {n: 2, kind: 'dagger'}};
    return c;
  };
  const backOf = (c, k) => (X.ammoRecoverable(c).find(r => r.kind === k) || {}).back || 0;
  ck('#104 half: 3 of 6 arrows, no bullets, both daggers',
     backOf(mk('half'), 'arrow') === 3 && backOf(mk('half'), 'firearm bullet') === 0 && backOf(mk('half'), 'dagger') === 2);
  ck('#104 all: every arrow', backOf(mk('all'), 'arrow') === 6);
  ck('#104 hits only: the 3 hits and half the 2 unanswered', backOf(mk('hits'), 'arrow') === 4);
  ck('#104 none: no arrows, but the daggers still come back', backOf(mk('none'), 'arrow') === 0 && backOf(mk('none'), 'dagger') === 2);
  ck('#104 a stack set to always wins over None', (() => { const c = mk('none'); c.inventory[0].recover = 'always'; return backOf(c, 'arrow') === 6; })());
  ck('#104 a stack set to never wins over All', (() => { const c = mk('all'); c.inventory[0].recover = 'never'; return backOf(c, 'arrow') === 0; })());
  ck("#104 a stack that is gone is read from its copy",
     (() => { const c = mk('all'); c.inventory.splice(0, 1); c.ammoSpent.s1.snap = {id: 's1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}, recover: 'never'}; return backOf(c, 'arrow') === 0; })());

  let c = mk('none');
  ck('#104 under None, recovering the daggers puts them back on the weapon at ×0', X.recoverAmmo(c, ['dagger'], {}) === 2 && c.inventory[2].qty === 2);
  ck('#104 ...and the arrows stay on record, for a later change of rule', 's1' in c.ammoSpent && !('d1' in c.ammoSpent));

  c = mk('all'); const r2 = {};
  const inv0 = JSON.stringify(c.inventory), spent0 = norm(c.ammoSpent);
  X.recoverAmmo(c, ['arrow', 'dagger'], r2);
  ck('#104 recovery records what it gave and what it cleared',
     r2.added.length === 2 && r2.made.length === 0 && Object.keys(r2.cleared).sort().join() === 'd1,s1', r2);
  ck('#104 Undo recovery puts everything back as it was',
     X.undoRecovery(c, r2) && JSON.stringify(c.inventory) === inv0 && norm(c.ammoSpent) === spent0, [c.inventory, c.ammoSpent]);
  ck('#104 ...once', X.undoRecovery(c, r2) === false);

  c = mk('all'); const r3 = {};
  X.recoverAmmo(c, ['arrow'], r3);                                           // arrows 2 -> 8; s1 cleared
  X.fireAmmo(c, {id: 'w', name: 'Bow', weapon: {ammo: 'arrow'}}, 'hit');      // 8 -> 7; a new s1 entry n 1, hits 1
  X.undoRecovery(c, r3);
  ck('#104 Undo recovery after a later shot takes back only what it gave, and keeps the shot',
     c.inventory[0].qty === 1 && c.ammoSpent.s1.n === 7 && c.ammoSpent.s1.hits === 4, [c.inventory[0], c.ammoSpent.s1]);

  c = mk('all'); c.inventory.splice(0, 1); c.ammoSpent.s1.snap = {id: 's1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}}; const r4 = {};
  X.recoverAmmo(c, ['arrow'], r4);
  ck('#104 a stack rebuilt by recovery is removed by its Undo',
     r4.made.length === 1 && X.undoRecovery(c, r4) && !c.inventory.some(i => i.id === 's1') && c.ammoSpent.s1.n === 6, c.inventory);
  ck('#104 a call with no record still returns the count', X.recoverAmmo(mk('half'), ['arrow']) === 3);
  ck('#104 Undo with no record, or a junk one, does nothing', X.undoRecovery(mk('half'), null) === false && X.undoRecovery(mk('half'), {}) === false);
}
```

- [ ] **Step 3: Run it to make sure it fails**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `LOAD FAIL` naming `ammoEntryItem`.

- [ ] **Step 4: Implement**

In `src/js/62-ammo.js`, replace `ammoRecoverable()` (with its comment) by:

```js
/* The item an entry's rule is read from: the live one while it is on the
   sheet (its override may have changed since the shot), else the entry's copy. */
function ammoEntryItem(c,id,e){
  const inv=Array.isArray(c&&c.inventory)?c.inventory:[];
  return inv.find(x=>x&&x.id===id)||e.snap;
}
/* What recovery would give back, per kind, under each entry's rule (#104):
   summed per kind. Kinds with nothing to give back are left out. */
function ammoRecoverable(c){
  const by=new Map();
  Object.keys(ammoSpentMap(c)).forEach(id=>{
    const e=ammoSpentEntry(c,id);if(!e.n||!e.kind)return;
    const r=by.get(e.kind)||{kind:e.kind,fired:0,back:0};
    r.fired+=e.n;r.back+=ammoBack(ammoRecoverRule(c,ammoEntryItem(c,id,e)),e);by.set(e.kind,r);
  });
  return [...by.values()].filter(r=>r.back>0);
}
```

Replace `recoverAmmo()` (with its comment) by:

```js
/* Gives back what each entry's rule allows (#104), for the kinds asked
   (every kind when none are), and clears those entries: the rest is lost. When
   the old stack is gone, recovery first looks for an equivalent one already on
   the sheet — not a bundle, the same lower-cased trimmed name, the same ammo
   bonus and the same grant as the snapshot — and tops that up instead of
   making a second "+1 Arrow" row; any weapon loaded with the old id is
   repointed to it. Only when there is none does the old stack come back from
   its copy, under its old id. A thrown weapon is still on the sheet at ×0, so
   its throws go back onto it. When `rec` is an object it is filled with what
   was done, for undoRecovery(). Returns how many pieces came back. */
function recoverAmmo(c,kinds,rec){
  const want=Array.isArray(kinds)?new Set(kinds.map(ammoKindOf)):null;
  const m=ammoSpentMap(c);
  if(!Array.isArray(c.inventory))c.inventory=[];
  const log=(rec&&typeof rec==="object")?Object.assign(rec,{added:[],made:[],repointed:[],cleared:{}}):null;
  let back=0;
  Object.keys(m).forEach(id=>{
    const e=ammoSpentEntry(c,id);
    if(want&&!want.has(e.kind))return;
    const n=ammoBack(ammoRecoverRule(c,ammoEntryItem(c,id,e)),e);
    if(n>0){
      const st=c.inventory.find(x=>x&&x.id===id);
      if(st){st.qty=itemQty(st)+n;back+=n;if(log)log.added.push({id,n});}
      else if(e.snap){
        const snapAm=itemAmmo(e.snap), snapName=String(e.snap.name||"").trim().toLowerCase(),
              snapGrant=e.snap.grant||"";
        const home=c.inventory.find(x=>x&&typeof x==="object"&&!x.pack&&
          String(x.name||"").trim().toLowerCase()===snapName&&
          (itemAmmo(x)||{}).bonus===(snapAm?snapAm.bonus:0)&&(x.grant||"")===snapGrant);
        if(home){
          home.qty=itemQty(home)+n;if(log)log.added.push({id:home.id,n});
          c.inventory.forEach(x=>{if(x&&x.ammoStack===id){x.ammoStack=home.id;if(log)log.repointed.push({id:x.id,from:id});}});
        }else{
          c.inventory.push(Object.assign(JSON.parse(JSON.stringify(e.snap)),{id,qty:n}));
          if(log)log.made.push({id,n});
        }
        back+=n;
      }
    }
    if(log)log.cleared[id]=JSON.parse(JSON.stringify(m[id]));
    delete m[id];
  });
  return back;
}
/* Undo recovery (#104, spec §6): takes back exactly what that recovery gave.
   A stack it rebuilt goes while it holds no more than it was given; a quantity
   it added comes off (a stack of ammunition left with nothing goes, as the
   last shot removes it; a thrown weapon stays at ×0); a weapon it repointed
   points back; an entry it cleared comes back, ADDED to any entry a shot
   fired since has started, so that shot stays fired. Once only. */
function undoRecovery(c,rec){
  if(!c||!rec||typeof rec!=="object"||rec.undone||!Array.isArray(rec.added)||!Array.isArray(rec.made)||
     !Array.isArray(rec.repointed)||!rec.cleared||typeof rec.cleared!=="object")return false;
  if(!Array.isArray(c.inventory))c.inventory=[];
  const take=(id,n,rebuilt)=>{
    const it=c.inventory.find(x=>x&&x.id===id);if(!it)return;
    if(itemQty(it)<=n&&(rebuilt||!weaponThrown(it)))c.inventory=c.inventory.filter(x=>x!==it);
    else it.qty=Math.max(0,itemQty(it)-n);
  };
  rec.made.forEach(x=>take(x.id,x.n,true));
  rec.added.forEach(x=>take(x.id,x.n,false));
  rec.repointed.forEach(x=>{const it=c.inventory.find(y=>y&&y.id===x.id);if(it)it.ammoStack=x.from;});
  if(!c.ammoSpent||typeof c.ammoSpent!=="object"||Array.isArray(c.ammoSpent))c.ammoSpent={};
  Object.keys(rec.cleared).forEach(id=>{
    const old=rec.cleared[id];
    if(!(id in c.ammoSpent)){c.ammoSpent[id]=old;return;}
    const o=ammoSpentEntry({ammoSpent:{x:old}},"x"), k=ammoSpentEntry(c,id);
    c.ammoSpent[id]=Object.assign({},c.ammoSpent[id],{n:o.n+k.n,hits:o.hits+k.hits,misses:o.misses+k.misses});
  });
  rec.undone=true;
  return true;
}
```

Note on `take` for an added quantity: a stack that held arrows before recovery and was topped up
keeps its original count (it holds more than `n`), so only a stack recovery itself brought from 0
can be removed by the "≤ n" branch.

- [ ] **Step 5: Run the tests**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`. The
existing #6 recovery tests (half by default) must still pass unchanged.
`./build.sh --no-zip && ./src/tests/run.sh | tail -3` → every suite passing.

- [ ] **Step 6: Commit**

```bash
git add src/js/62-ammo.js src/tests/sheet.js
git commit -m "feat(#104): recovery follows the rule, and can be undone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The thrown row, the question, the taps

**Files:**
- Modify: `src/js/62-ammo.js` (the DOM half: `ammoLineHTML()`, `ammoFireBtn()`, `fireWeapon()`, `recoverWeaponAmmo()`; add `thrownLineHTML()`, `ammoAsks()`, `askAmmoOutcome()`, `throwWeaponTap()`)
- Modify: `src/js/90-boot.js` (the click chain's ammunition lines, ~83–87)
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `thrownLineHTML(c, it) → string`; `ammoAsks(c, it) → boolean`;
  `askAmmoOutcome(title, go)` (opens the dialog; `go("hit"|"miss")`);
  `fireWeapon(itemId, viaKey, outcome)`; `throwWeaponTap(itemId, viaKey, outcome)`; the hook
  `data-ammo-throw`.

- [ ] **Step 1: Add the names to `loadApp`**

`'thrownLineHTML', 'ammoAsks', 'throwWeaponTap',` after `'ammoLineHTML',` in the `loadApp` list.

- [ ] **Step 2: Write the failing tests**

In `src/tests/sheet.js`, insert immediately after the block added in Task 3:

```js
/* ---- the thrown weapon's row, and when Fire asks (#104, spec §5.2, §5.4) ---- */
{
  const DAGGER = 'Range 20/60 · Finesse, Light, Thrown · Mastery: Nick';
  const c = X.blankChar();
  c.inventory = [{id: 'd1', name: 'Dagger', qty: 2, equipped: true, weapon: {kind: 'melee', dice: '1d4', notes: DAGGER}},
                 {id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
                 {id: 's1', name: 'Arrow', qty: 4, ammo: {kind: 'arrow'}},
                 {id: 'm1', name: 'Mace', qty: 1, equipped: true, weapon: {kind: 'melee', dice: '1d6', notes: ''}}];
  const h = X.ammoLineHTML(c, {itemId: 'd1'});
  ck("#104 a thrown weapon's row shows its count and Throw, and no picker or Fire",
     h.includes('>Dagger ×2<') && /data-ammo-throw="d1"[^>]*>Throw</.test(h) && !h.includes('data-ammo-fire') && !h.includes('data-ammo-pick'), h);
  c.inventory[0].qty = 0;
  ck('#104 ...Throw is disabled at ×0', /data-ammo-throw="d1" disabled/.test(X.ammoLineHTML(c, {itemId: 'd1'})), X.ammoLineHTML(c, {itemId: 'd1'}));
  c.ammoSpent = {d1: {n: 2, kind: 'dagger'}};
  ck('#104 ...and offers Recover 2 for the two thrown', /data-ammo-recover="d1"[^>]*>Recover 2</.test(X.ammoLineHTML(c, {itemId: 'd1'})));
  ck('#104 a weapon that neither fires nor is thrown draws no line', X.ammoLineHTML(c, {itemId: 'm1'}) === '');
  ck("#104 a launcher's row is as it was", /data-ammo-fire="w1"/.test(X.ammoLineHTML(c, {itemId: 'w1'})));
  const hh = X.ammoLineHTML({inventory: [{id: 'x"y', name: '<i>Dagger', qty: 1, weapon: {notes: 'Thrown'}}]}, {itemId: 'x"y'});
  ck('#104 the thrown row escapes what a file put in the item', !hh.includes('<i>') && !hh.includes('x"y') && hh.includes('&lt;i&gt;Dagger'), hh);
  ck('#104 Fire asks only under Hits only, for an item on the sheet rule',
     X.ammoAsks({ammoRecovery: 'hits'}, {ammo: {kind: 'arrow'}}) && !X.ammoAsks({ammoRecovery: 'half'}, {ammo: {kind: 'arrow'}}) &&
     !X.ammoAsks({ammoRecovery: 'hits'}, {ammo: {kind: 'arrow'}, recover: 'always'}) &&
     !X.ammoAsks({ammoRecovery: 'hits'}, {weapon: {notes: 'Thrown'}}) && !X.ammoAsks({ammoRecovery: 'hits'}, null));
  /* through the taps: under Hits only Fire asks first and fires nothing; with an answer it fires */
  const t = X.blankChar(); X.character = t; t.ammoRecovery = 'hits';
  t.inventory = JSON.parse(JSON.stringify(c.inventory)); t.inventory[0].qty = 2; t.ammoSpent = {};
  ck('#104 under Hits only, Fire asks and fires nothing yet', X.fireWeapon('w1', false) === null && t.inventory.find(i => i.id === 's1').qty === 4);
  ck('#104 ...the answer fires, with its tally', !!X.fireWeapon('w1', false, 'hit') && X.ammoSpentEntry(t, 's1').hits === 1 && t.inventory.find(i => i.id === 's1').qty === 3);
  ck('#104 a thrown weapon never asks: Throw throws at once', !!X.throwWeaponTap('d1', false) && t.inventory[0].qty === 1 && X.ammoSpentEntry(t, 'd1').n === 1);
  ck('#104 Recover on the thrown row brings it back', X.recoverWeaponAmmo('d1', false) === 1 && t.inventory[0].qty === 2);
}
```

In `src/tests/rules-data.js`, in the block `// ---------- the ammunition controls are wired (#6)`, the
`hooks` list becomes `['data-ammo-fire', 'data-ammo-pick', 'data-ammo-load', 'data-ammo-recover', 'data-ammo-throw'];`.

- [ ] **Step 3: Run them to make sure they fail**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `LOAD FAIL` naming `thrownLineHTML`.
`./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"` → FAIL on `every ammunition control has a click handler`.

- [ ] **Step 4: Implement the markup and the question**

In `src/js/62-ammo.js`, in `ammoLineHTML()`, the line `if(!kind)return "";` becomes:

```js
  if(!kind)return weaponThrown(it)?thrownLineHTML(c,it):"";
```

Directly after `ammoLineHTML()`, add:

```js
/* Under a thrown weapon's row (#104): its own count (no picker — it throws
   itself), Throw (disabled at ×0, when every one is out there), and Recover N. */
function thrownLineHTML(c,it){
  const kind=ammoThrownKind(it), q=itemQty(it), name=String(it.name||"");
  const back=(ammoRecoverable(c).find(r=>r.kind===kind)||{}).back||0;
  return `<div class="ammo-line"><span class="ammo-load">${esc(name+" ×"+q)}</span>`+
    `<button type="button" class="tbtn ammo-fire" data-ammo-throw="${esc(it.id)}"${q>=1?"":" disabled"} aria-label="${esc("Throw "+(/^[aeiou]/i.test(name)?"an ":"a ")+name)}">Throw</button>`+
    (back>0?`<button type="button" class="tbtn ammo-recover" data-ammo-recover="${esc(it.id)}" aria-label="${esc("Recover "+back+" "+ammoPlural(kind))}">Recover ${back}</button>`:"")+
    `</div>`;
}
/* Fire and Throw ask Hit or miss first only when this item comes back by
   the Hits-only rule (spec §5.4): an item set to always or never, a thrown
   weapon on its default, and every other rule fire at once. */
function ammoAsks(c,it){return !!it&&ammoRecoverRule(c,it)==="hits";}
/* The question. Closing it (✕, Escape) fires nothing. Focus starts on Hit. */
function askAmmoOutcome(title,go){
  openModal(title,`<p class="hint">Hits come back after the fight; misses are lost.</p>`+
    `<div class="m-actions"><button type="button" class="tbtn" id="ammoMiss">Miss</button><button type="button" class="tbtn primary" id="ammoHit">Hit</button></div>`);
  const h=document.getElementById("ammoHit"), m=document.getElementById("ammoMiss");
  if(h)h.addEventListener("click",()=>{closeModal();go("hit");});
  if(m)m.addEventListener("click",()=>{closeModal();go("miss");});
  if(h&&h.focus)h.focus();
}
```

`ammoFireBtn()` becomes (so focus finds Throw as well as Fire):

```js
function ammoFireBtn(itemId){
  const b=document.querySelector(attrSel("data-ammo-fire",itemId))||document.querySelector(attrSel("data-ammo-throw",itemId));
  return b&&!b.disabled&&b.getClientRects().length?b:null;
}
```

- [ ] **Step 5: Implement the taps**

Replace `fireWeapon()` (keep its comment, adding one sentence: "Under Hits only it asks first,
and fires once answered.") by:

```js
function fireWeapon(itemId,viaKey,outcome){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  if(!it)return null;
  const st=loadedStack(character,it);
  if(outcome===undefined&&st&&ammoAsks(character,st)){
    askAmmoOutcome(`${String(it.name||"Fire")}: hit or miss?`,o=>fireWeapon(itemId,viaKey,o));
    return null;
  }
  const r=fireAmmo(character,it,outcome);
  if(!r)return null;
  shotDone(r,itemId,viaKey,r.removed?`Fired your last ${String(r.stack.name||r.kind)}${r.outcome?" · "+r.outcome:""}`
    :`Fired ${ammoOne(r.kind)}${r.outcome?" · "+r.outcome:""} · ${r.left} left`);
  return r;
}
/* One Throw tap (#104): as Fire, from the weapon's own count. */
function throwWeaponTap(itemId,viaKey,outcome){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  if(!it||!weaponThrown(it))return null;
  if(outcome===undefined&&itemQty(it)>=1&&ammoAsks(character,it)){
    askAmmoOutcome(`${String(it.name||"Throw")}: hit or miss?`,o=>throwWeaponTap(itemId,viaKey,o));
    return null;
  }
  const r=throwAmmo(character,it,outcome);
  if(!r)return null;
  const name=String(it.name||"");
  shotDone(r,itemId,viaKey,`Threw ${/^[aeiou]/i.test(name)?"an":"a"} ${name}${r.outcome?" · "+r.outcome:""} · ${r.left} left`);
  return r;
}
/* After Fire or Throw: save, redraw, and the toast with its Undo. The save is
   scheduled before the redraw, so nothing a redraw throws can cost the player
   the shot. From the keyboard focus stays on the button while there is more,
   else it moves to the toast's Undo; a held Enter's auto-repeat must not then
   press Undo, so the Undo ignores repeated keys. */
function shotDone(r,itemId,viaKey,msg){
  const who=character;
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  const undo=toast(msg,{label:"Undo",
    run:e=>undoFireTap(r,who,!!e&&e.detail===0,itemId),
    back:()=>ammoFireBtn(itemId)});
  if(undo)undo.addEventListener("keydown",e=>{if(e.repeat)e.preventDefault();});
  if(viaKey){const b=ammoFireBtn(itemId);if(b)b.focus();else if(undo)undo.focus();}
}
```

(The body of the old `fireWeapon()` from `const who=character;` to the end is what `shotDone()`
now holds; delete it from `fireWeapon()`.)

In `recoverWeaponAmmo()`, the line `const kind=weaponAmmoKind(it);if(!kind)return 0;` becomes:

```js
  const kind=weaponAmmoKind(it)||(weaponThrown(it)?ammoThrownKind(it):"");if(!kind)return 0;
```

and its comment's first line becomes `/* Recover N on a row: what this kind's rule gives back of
what it fired since the last recovery (#104). */`.

In `src/js/90-boot.js`, directly after the line beginning `if((m=t.closest("[data-ammo-fire]")))`, add:

```js
    if((m=t.closest("[data-ammo-throw]"))){throwWeaponTap(m.dataset.ammoThrow,e.detail===0);return;}
```

- [ ] **Step 6: Run the tests**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED` (the
existing #6 `fireWeapon`/`undoFireTap` tests must still pass).
`./build.sh --no-zip && ./src/tests/run.sh | tail -3` → every suite passing.

- [ ] **Step 7: Commit**

```bash
git add src/js/62-ammo.js src/js/90-boot.js src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#104): Throw on a thrown weapon's row; Hits only asks hit or miss

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: End combat recovers on its own, with an Undo

**Files:**
- Modify: `src/js/62-ammo.js` (remove `offerAmmoRecovery()`, `ammoAskDue()`, `markAmmoAsked()`, the `asked` field; add `applyAmmoRecovery()`, `undoRecoveryTap()`)
- Modify: `src/js/87-combat.js` (`endCombatAsk()`)
- Modify: `src/docs/wiki/features/ammunition.md`, `src/docs/wiki/features/combat-view.md` (only the names the `docs` suite would find dangling)
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: `ammoRecoverable()`, `recoverAmmo(c, kinds, rec)`, `undoRecovery()` (Task 3).
- Produces: `applyAmmoRecovery() → {text, rec} | null`; `undoRecoveryTap(rec, who) → boolean`;
  `ammoSpentEntry()` returns `{n, hits, misses, kind, snap}` (no `asked`).

- [ ] **Step 1: Update `loadApp` and the old tests**

In `src/tests/sheet.js`:
- `loadApp`: remove `'ammoAskDue', 'markAmmoAsked',` and `'offerAmmoRecovery',`; add `'applyAmmoRecovery', 'undoRecoveryTap',` after `'recoverWeaponAmmo',`.
- `ck('junk spent entries read as nothing',`: its object becomes `{n: 0, hits: 0, misses: 0, kind: '', snap: null}`.
- Delete the whole block `/* ---- End combat offers the ammunition back (#6) ---- */` and the whole
  block `/* ---- ammoAskDue() and markAmmoAsked() (#6 final review, item 3) ---- */` (which ends
  with the `fireAmmo() carries the previous entry's asked forward` assertion).

- [ ] **Step 2: Write the failing tests**

Where the deleted End combat block stood, insert:

```js
/* ---- End combat recovers on its own, with an Undo (#104, spec §6) ---- */
{
  const mk = () => {
    const c = X.blankChar(); X.character = c;
    c.inventory = [{id: 's1', name: 'Arrow', qty: 7, ammo: {kind: 'arrow'}}];
    c.ammoSpent = {s1: {n: 13, kind: 'arrow'},
                   s2: {n: 4, kind: 'bolt', snap: {id: 's2', name: 'Bolt', qty: 1, ammo: {kind: 'bolt'}}},
                   s3: {n: 1, kind: 'needle'}};
    X.startCombatNow();
    return c;
  };
  let c = mk(); state.confirm = true; state.lastConfirm = null;
  ck('#104 End combat asks only about ending, then recovers half of each kind',
     X.endCombatAsk() === true && state.lastConfirm === 'End combat at round 1?' &&
     c.inventory.find(i => i.id === 's1').qty === 13 && (c.inventory.find(i => i.id === 's2') || {}).qty === 2, [state.lastConfirm, c.inventory]);
  ck('#104 ...and the lone needle, which gives nothing back, stays on record', JSON.stringify(Object.keys(c.ammoSpent)) === '["s3"]', c.ammoSpent);
  c = mk(); const rec = {}; X.recoverAmmo(c, ['arrow', 'bolt'], rec);
  ck("#104 the toast's Undo recovery puts it all back",
     ctx.undoRecoveryTap(rec, c) === true && c.inventory.find(i => i.id === 's1').qty === 7 && !c.inventory.some(i => i.id === 's2') && c.ammoSpent.s1.n === 13);
  ck('#104 ...but not on another sheet',
     (() => { const k = mk(), r = {}; X.recoverAmmo(k, ['arrow'], r); X.character = X.blankChar(); return ctx.undoRecoveryTap(r, k) === false && k.inventory[0].qty === 13; })());
  c = mk(); c.ammoRecovery = 'none';
  ck('#104 with nothing recoverable, End combat recovers nothing and keeps the counts', X.endCombatAsk() === true && c.inventory[0].qty === 7 && c.ammoSpent.s1.n === 13);
  ck('#104 applyAmmoRecovery says nothing when there is nothing', (() => { X.character = X.blankChar(); return ctx.applyAmmoRecovery() === null; })());
  ck('#104 a spent entry no longer carries asked', !('asked' in X.ammoSpentEntry({ammoSpent: {a: {n: 2, kind: 'arrow', asked: 1}}}, 'a')));
}
```

In `src/tests/rules-data.js`, the assertion
`ck('End combat offers the ammunition back once the fight has ended', /combatEnd\(character\)[\s\S]{0,200}offerAmmoRecovery\(\)/.test(js));`
becomes:

```js
  ck('#104 End combat recovers the ammunition once the fight has ended, with an Undo recovery',
     /combatEnd\(character\)[\s\S]{0,200}applyAmmoRecovery\(\)/.test(js) && /label:"Undo recovery",run:\(\)=>undoRecoveryTap\(/.test(js));
```

- [ ] **Step 3: Run them to make sure they fail**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `LOAD FAIL` naming `applyAmmoRecovery`.

- [ ] **Step 4: Implement**

In `src/js/62-ammo.js`:
- `ammoSpentEntry()`: drop `asked` from the return and from the comment (the return ends `snap:…}`).
- `ammoRecordShot()`: drop `asked:p.asked,` from the entry it builds, and "and `asked`" from its comment.
- Delete `ammoAskDue()`, `markAmmoAsked()` and `offerAmmoRecovery()`, with their comments.
- Add, where `offerAmmoRecovery()` was:

```js
/* After End combat (#104, spec §6): when anything is recoverable under the
   rules, it is recovered — the kinds with something to give back, so a kind on
   None or Never stays on record for a later change of rule — and the words for
   the End combat toast come back with the record its Undo needs. null when
   there was nothing. Shots fired outside a tracked fight are swept up too, as
   the row's Recover does. */
function applyAmmoRecovery(){
  const list=ammoRecoverable(character);
  if(!list.length)return null;
  const rec={};
  recoverAmmo(character,list.map(r=>r.kind),rec);
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  return {text:`recovered ${ammoSummaryText(list)}`,rec};
}
/* The End combat toast's Undo recovery: only for the character it was shown for. */
function undoRecoveryTap(rec,who){
  if(!character||character!==who)return false;
  if(!undoRecovery(character,rec))return false;
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  toast("Recovery undone");
  return true;
}
```

In `src/js/87-combat.js`, `endCombatAsk()`'s last lines

```js
  /* then the ammunition (#6): asked once, after the fight is over */
  const got=offerAmmoRecovery();
  const msg=`Combat ended after ${s.rounds} round${s.rounds===1?"":"s"} (${fmtCombatTime(s.sec)})`+(got?` · ${got}`:"");
  toast(msg);setCombatLive(msg);
  return true;
```

become

```js
  /* then the ammunition (#104): recovered by the character's rule, with an
     Undo recovery on the toast for the character it was shown for */
  const got=applyAmmoRecovery(), who=character;
  const msg=`Combat ended after ${s.rounds} round${s.rounds===1?"":"s"} (${fmtCombatTime(s.sec)})`+(got?` · ${got.text}`:"");
  toast(msg,got?{label:"Undo recovery",run:()=>undoRecoveryTap(got.rec,who)}:undefined);setCombatLive(msg);
  return true;
```

- [ ] **Step 5: Keep the wiki's names valid**

The `docs` suite fails when a wiki page names a function that does not exist. Minimal edits now;
Task 7 rewrites these pages:
- `src/docs/wiki/features/ammunition.md`, **Code** line: replace `` `ammoAskDue()`, `markAmmoAsked()`, `` with nothing and `` `offerAmmoRecovery()`, `` with `` `applyAmmoRecovery()`, `undoRecoveryTap()`, ``. In the **Recovery** paragraph, replace the sentences from "`offerAmmoRecovery()` asks after End combat…" through "…`asked` or not." with: "End combat recovers on its own (`applyAmmoRecovery()`), with an Undo recovery (#104)."
- `src/docs/wiki/features/combat-view.md`: replace the sentence beginning "Once the fight is over, `offerAmmoRecovery()` asks once more" up to its end ("…appended to the toast.") with: "Once the fight is over, `applyAmmoRecovery()` recovers what the character's rule gives back and adds it to the toast, with an Undo recovery ([Ammunition](ammunition.md))."

Run `node src/tests/docs.js | tail -1` → `ALL PASSED`.

- [ ] **Step 6: Run the tests**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`.
`./build.sh --no-zip && ./src/tests/run.sh | tail -3` → every suite passing.

- [ ] **Step 7: Commit**

```bash
git add src/js/62-ammo.js src/js/87-combat.js src/tests/sheet.js src/tests/rules-data.js src/docs/wiki/features/ammunition.md src/docs/wiki/features/combat-view.md
git commit -m "feat(#104): End combat recovers ammunition on its own, with an Undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The Settings row, the item editor's Recovery, and quantity 0

**Files:**
- Modify: `src/js/62-ammo.js` (add `recoverOptionsHTML()` to the pure half, after `ammoKindOptionsHTML()`)
- Modify: `src/js/88-settings.js` (`secDisplay`, ~110–118; the wiring block, ~207–211)
- Modify: `src/js/80-modal-forms.js` (`openItemForm()`: the Quantity box ~329, the markup after `iAmmoFields` ~353, the ammo toggle listener ~395, the save ~458 and ~500)
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: `AMMO_RECOVERY`, `ammoRecoveryOf()`, `itemRecover()`, `ammoDefaultRecover()`, `weaponThrown()` (Task 1).
- Produces: `recoverOptionsHTML(it) → string`; ids `setAmmoRec`, `iRecoverWrap`, `iRecover`.

- [ ] **Step 1: Add the name and write the failing tests**

`'recoverOptionsHTML',` after `'ammoKindOptionsHTML',` in `loadApp`. In `src/tests/sheet.js`, in
the block `/* ---- the item editor's kind lists (#8) ---- */`, before its closing `}`, add:

```js
  // #104: the Recovery select
  const sel = h2 => (h2.match(/<option value="([a-z]*)" selected>/) || [])[1];
  const ro = X.recoverOptionsHTML({ammo: {kind: 'firearm bullet'}});
  ck('#104 Recovery offers the default, Always and Never, naming the default when there is one',
     /<option value="" selected>Default \(never comes back\)<\/option><option value="always">Always comes back<\/option><option value="never">Never comes back<\/option>/.test(ro), ro);
  ck("#104 ...a thrown weapon's default is always", X.recoverOptionsHTML({weapon: {notes: 'Thrown'}}).includes('>Default (always comes back)<'));
  ck("#104 ...an arrow's is the sheet's rule (the apostrophe escaped, as esc() writes it)", X.recoverOptionsHTML({ammo: {kind: 'arrow'}}).includes('>Sheet&#39;s rule<'));
  ck("#104 ...and the item's own choice is selected", sel(X.recoverOptionsHTML({ammo: {kind: 'arrow'}, recover: 'never'})) === 'never' && sel(X.recoverOptionsHTML({recover: 'junk'})) === '');
```

In `src/tests/rules-data.js`, inside the block `// ---------- the ammunition controls are wired (#6)`, before its closing `}`, add:

```js
  ck('#104 Settings → Sheet display has the Ammo recovery select, wired to the character',
     /id="setAmmoRec"/.test(js) && /getElementById\("setAmmoRec"\)[^\n]*addEventListener\("change"[^\n]*character\.ammoRecovery=/.test(js));
  ck('#104 the item editor has a Recovery select, saved as item.recover',
     /id="iRecover">\$\{recoverOptionsHTML\(it\)\}<\/select>/.test(js) && /rec\.recover=rv/.test(js));
  ck("#104 the item editor's Quantity allows 0, so a thrown weapon at ×0 stays at ×0",
     /id="iQty" type="number" min="0"/.test(js) && !/qty:num\(document\.getElementById\("iQty"\)\.value\)\|\|1/.test(js));
```

- [ ] **Step 2: Run them to make sure they fail**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `LOAD FAIL` naming `recoverOptionsHTML`.
`./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"` → FAIL on the three `#104` checks.

- [ ] **Step 3: The options**

In `src/js/62-ammo.js`, directly after `ammoKindOptionsHTML()`, add:

```js
/* The item editor's Recovery <option>s (#104): the default (named when the
   app has one for this item), Always, Never; the item's own choice selected. */
function recoverOptionsHTML(it){
  const cur=itemRecover(it), d=ammoDefaultRecover(it);
  const first=d==="never"?"Default (never comes back)":d==="always"?"Default (always comes back)":"Sheet's rule";
  return [["",first],["always","Always comes back"],["never","Never comes back"]]
    .map(([v,l])=>`<option value="${esc(v)}"${cur===v?" selected":""}>${esc(l)}</option>`).join("");
}
```

- [ ] **Step 4: The Settings row**

In `src/js/88-settings.js`, `secDisplay` ends with the Trackers row: `…aria-label="Trackers card"></button>`,true)):"";`.
Change that ending to:

```js
        `<button type="button" class="switch ${showTrackers(character)?"on":""}" id="swTrackers" role="switch" aria-checked="${showTrackers(character)?"true":"false"}" aria-label="Trackers card"></button>`,true))+
    setGroupHTML("Ammunition",
      setRowHTML("Ammo recovery","What comes back after a fight. Thrown weapons and items set to Always come back anyway; firearm bullets never do.",
        `<select id="setAmmoRec" aria-label="Ammo recovery">${AMMO_RECOVERY.map(([v,l])=>`<option value="${esc(v)}"${ammoRecoveryOf(character)===v?" selected":""}>${esc(l)}</option>`).join("")}</select>`)):"";
```

(Keep the `hasChar?setGroupHTML("Cards",` head as it is: the new group is concatenated inside the
same `hasChar?…:""`.)

After the line `{const b=document.getElementById("swTrackers");…}`, add:

```js
  {const s=document.getElementById("setAmmoRec");if(s)s.addEventListener("change",()=>{character.ammoRecovery=ammoRecoveryOf({ammoRecovery:s.value});scheduleSave();renderAttacks();});}
```

- [ ] **Step 5: The item editor**

In `src/js/80-modal-forms.js`, `openItemForm()`:

1. The Quantity box:
   `<input id="iQty" type="number" min="1" value="${esc(num(it.qty)||1)}">` becomes
   `<input id="iQty" type="number" min="0" value="${esc(it.qty===0||it.qty==="0"?0:(num(it.qty)||1))}">`.
2. Directly after the closing `</div>` of `<div id="iAmmoFields" …>` (the line after
   `iAmmoKindOtherWrap`), add:

```js
    <div class="field" id="iRecoverWrap" style="${(am||weaponThrown(it))?"":"display:none"}"><label class="f" for="iRecover">After a fight</label><select id="iRecover">${recoverOptionsHTML(it)}</select></div>
```

3. The ammo toggle's listener line
   `amtog.addEventListener("click",()=>{isAmmo=!isAmmo;amtog.classList.toggle("on",isAmmo);amfields.style.display=isAmmo?"":"none";});`
   becomes
   `amtog.addEventListener("click",()=>{isAmmo=!isAmmo;amtog.classList.toggle("on",isAmmo);amfields.style.display=isAmmo?"":"none";const rw=document.getElementById("iRecoverWrap");if(rw)rw.style.display=(isAmmo||weaponThrown(it))?"":"none";});`
4. In the save handler, `qty:num(document.getElementById("iQty").value)||1` becomes
   `qty:(v=>v===""?1:Math.max(0,num(v)))(document.getElementById("iQty").value.trim())`.
5. Directly after `if(it.pack)rec.pack=it.pack;`, add:

```js
    /* #104: what comes back after a fight, for ammunition and thrown weapons;
       the default is no field at all */
    {const rv=(document.getElementById("iRecover")||{}).value;if((isAmmo||weaponThrown(rec))&&(rv==="always"||rv==="never"))rec.recover=rv;}
```

- [ ] **Step 6: Run the tests**

`node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`.
`./build.sh --no-zip && ./src/tests/run.sh | tail -3` → every suite passing (the Settings id test
in `rules-data.js` checks `setAmmoRec` is both drawn and wired).

- [ ] **Step 7: Commit**

```bash
git add src/js/62-ammo.js src/js/88-settings.js src/js/80-modal-forms.js src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#104): the Ammo recovery setting and the item editor's Recovery

Quantity also allows 0, so editing a thrown weapon at ×0 keeps it there.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Browser QA, docs, release notes

**Files:**
- Modify: `src/docs/wiki/features/ammunition.md`, `src/docs/wiki/features/combat-view.md`,
  `src/docs/wiki/features/inventory.md`, `src/docs/wiki/features/settings-and-updates.md`,
  `src/docs/wiki/architecture/character-model.md`, `src/docs/wiki/roadmap/known-issues.md`,
  `src/docs/wiki/roadmap/1.9.0.md`, `src/docs/specs/2026-10-18-ammo-recovery-design.md` (Status, As built),
  `src/docs/_claude/WIRING-LEDGER.md`, `src/docs/UNRELEASED.md`
- Test: `node src/tests/docs.js`, `./src/tests/run.sh`

- [ ] **Step 1: Drive it in the browser**

Use the project's Playwright MCP (`mcp__playwright__*`; never `mcp__plugin_playwright_*`). Build
(`./build.sh --no-zip`), navigate to
`file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/104/dist/fieldbook.html`.
Screenshots go to `.claude/qa/104-*.png` in the worktree (pass a `filename`, then copy the file
there). Fixture, in `browser_evaluate`:

```js
() => {
  newCharacter("QA ammo", "dnd");
  character.inventory.push(
    {id:"w1",name:"Longbow",qty:1,equipped:true,weapon:{kind:"ranged",ammo:"arrow",dice:"1d8",damageType:"piercing",ability:"dex"}},
    {id:"s1",name:"Arrow",qty:10,ammo:{kind:"arrow"}},
    {id:"d1",name:"Dagger",qty:2,equipped:true,weapon:{kind:"melee",dice:"1d4",damageType:"piercing",ability:"finesse",notes:"Range 20/60 · Finesse, Light, Thrown · Mastery: Nick"}});
  character.attacks.push(
    {id:"a1",name:"Longbow",kind:"ranged",ability:"dex",proficient:true,damageDice:"1d8",damageType:"piercing",itemId:"w1",addAbilityDamage:true},
    {id:"a2",name:"Dagger",kind:"melee",ability:"finesse",proficient:true,damageDice:"1d4",damageType:"piercing",itemId:"d1",addAbilityDamage:true});
  character.ammoRecovery = "hits";
  renderAll(); selectTab("sheet"); return "ok";
}
```

1. Shoot the Attacks card → `104-rows.png`: the Longbow row with Arrow ×10 · Fire; the Dagger row with Dagger ×2 · Throw.
2. Click `[data-ammo-fire="w1"]`: the "Longbow: hit or miss?" dialog → `104-question.png`. Click Hit; check `character.ammoSpent.s1` is `{n:1, hits:1, …}` and the toast reads "· hit". Fire again, click Miss. Fire a third time and press Escape: nothing fired (`ammoSpent.s1.n` still 2).
3. Click `[data-ammo-throw="d1"]` twice: no question; the Dagger row reads Dagger ×0 and Throw is disabled → `104-thrown-zero.png`.
4. `browser_evaluate`: `startCombatNow()`, then `endCombatAsk()` with the confirm accepted (`window.confirm=()=>true` first). The toast reads "… · recovered 1 of 2 arrows, 2 of 2 daggers" with **Undo recovery** → `104-end-combat.png`. Check Arrow ×9 and Dagger ×2. Click Undo recovery: Arrow ×8, Dagger ×0, and the counts are back.
5. Settings → Sheet display: the Ammunition group's "Ammo recovery" select → `104-settings.png`; choose None and check `character.ammoRecovery === "none"`.
6. Edit the Dagger (its edit button on the Inventory tab): the "After a fight" select reads "Default (always comes back)" → `104-item-editor.png`; Save without changes and check it is still ×0 (the quantity fix).
7. Repeat steps 1 and 3 on `newCharacter("QA ammo HW","humblewood")` with the same items → `104-rows-humblewood.png`, and once at 390×844 → `104-rows-phone.png`.

Record exactly which steps you drove and what you saw. Anything that does not behave as written
here is a bug: report it (status DONE_WITH_CONCERNS or BLOCKED with specifics); do not change
product code in this task.

- [ ] **Step 2: The wiki**

Read `.claude/skills/wiki/SKILL.md` first (the page template, ingest, and the `docs` contract).
- `ammunition.md`: rewrite **Recovery** to the new truth (the rule and its source order, the
  defaults, `ammoBack()`'s table, Hits only and unanswered shots, `recoverAmmo()`'s record and
  `undoRecovery()`), add **Thrown weapons** (`weaponThrown()`, `ammoThrownKind()`, Throw, ×0,
  `throwAmmo()`, `thrownLineHTML()`), **The question** (`ammoAsks()`, `askAmmoOutcome()`), and the
  **Code** line's new names (`AMMO_RECOVERY`, `ammoRecoveryOf()`, `itemRecover()`,
  `AMMO_RECOVER_DEFAULTS`, `ammoDefaultRecover()`, `ammoRecoverRule()`, `ammoBack()`,
  `ammoRecordShot()`, `ammoEntryItem()`, `undoRecovery()`, `shotDone()`, `throwWeaponTap()`,
  `recoverOptionsHTML()`); add the spec's decisions to **Decisions** (the old "Recovery" row's
  "Asked at End combat" becomes the rejected alternative); close the **Open** item "Thrown weapons
  as their own ammunition".
- `combat-view.md`: the End combat paragraph (recovers on its own, Undo recovery).
- `inventory.md`: `recover` in the item shape, "After a fight" in the editor, Quantity allows 0.
- `settings-and-updates.md`: the Sheet display page gains the Ammunition group's "Ammo recovery".
- `character-model.md`: `ammoRecovery` beside `ammoSpent`.
- `known-issues.md`: delete the Deferred line "Thrown weapons track no ammunition of their own".
- `1.9.0.md`: History "— #104 built (wave 1)".
- The spec: **Status** "implemented on branch `issue/104-ammo-recovery` · <today>"; an **As built**
  section noting: the DOM throw tap is `throwWeaponTap()` and the pure one `throwAmmo()` (the spec
  §5.3 said `throwWeapon()`); `shotDone()` shared by Fire and Throw; the item editor's Quantity now
  allows 0 (found while planning: an edit made a thrown weapon at ×0 into ×1); a thrown weapon's
  row shows only while the weapon is equipped, like every weapon's row (the spec §5.2 said
  otherwise); and anything Step 1 changed.
Each page gets a History line citing the ledger entry below.

- [ ] **Step 3: The ledger and the release note**

Append one entry to `src/docs/_claude/WIRING-LEDGER.md`:
"## Ammunition recovery options and thrown weapons (#104, <today>)" — what changed (the rule, the
override and defaults, the tallies, Throw, recovery's record and Undo, End combat, the Settings row,
the editor), the tests, and which QA steps were driven and what was seen; a `Pages:` line. Note its
heading's line number and use it in every History line.

In `src/docs/UNRELEASED.md`, under `## Pending`, add the spec §12 bullet verbatim:

```markdown
- Choose how ammunition comes back after a fight in Settings → Sheet display: half (the rules as
  written), all, only the shots that hit, or none. Firearm bullets never come back, and any item can
  be set to always or never. Thrown weapons such as daggers and javelins now have a Throw button
  that counts them, and they come back after the fight. Ending combat recovers ammunition on its own,
  with an Undo.
```

- [ ] **Step 4: Run everything**

`./build.sh --no-zip && ./src/tests/run.sh | tail -6` → every suite passing.

- [ ] **Step 5: Commit**

```bash
git add src/docs/wiki/features/ammunition.md src/docs/wiki/features/combat-view.md src/docs/wiki/features/inventory.md src/docs/wiki/features/settings-and-updates.md src/docs/wiki/architecture/character-model.md src/docs/wiki/roadmap/known-issues.md src/docs/wiki/roadmap/1.9.0.md src/docs/specs/2026-10-18-ammo-recovery-design.md src/docs/_claude/WIRING-LEDGER.md src/docs/UNRELEASED.md
git commit -m "docs(#104): ammunition recovery options and thrown weapons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then stop: no merge, no build on main, no version change.
