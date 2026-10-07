# Timed Conditions and Compact Stats in Combat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A condition can last a set time that the round tracker counts down, clearing itself with an Undo when it runs out (#55); the Ability Scores & Saves and Skills cards draw compact and read-only inside the combat view (#62).

**Architecture:**
- **Milestone A (#55).** Pure timed-condition helpers sit beside the status row in `src/js/40-sheet.js` (reading a duration, the row text, a step of the clock), with a thin DOM layer: the toast and its Undo, and the row's − rd / + rd. `advanceRound()` (`60-attacks.js`) ticks conditions with the spells. The status form (`80-modal-forms.js`) gains a "Lasts" row.
- **Milestone B (#62).** One idempotent function, `syncStatLock()` in `87-combat.js`, disables the two cards' score boxes and proficiency dots exactly while they sit in `#cvList`. The compact look is CSS in `45-combat.css`.
- No new fragment, so no fragment counts change.

**Tech Stack:** plain ES2020 concatenated into one `<script>`; plain CSS; Node suites through `src/tests/harness.js`; the project Playwright MCP server.

**Spec:** `src/docs/specs/2026-10-06-timed-conditions-design.md`. Read it first; this plan argues from it.

**Worktree:** `.claude/worktrees/55`, branch `issue/55-timed-conditions`. Every command runs from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/55`.

## Global Constraints

**The build**
- The app ships as ONE file, `dist/fieldbook.html`, built by concatenation. No `import`/`export`, no network.
- **Byte hygiene:** LF only, one final newline, no BOM, no private-use characters. Your editing tool may decode backslash-u escapes; this plan needs none.
- **TDZ (ADR-001):** a top-level `const` (such as `STATUS_UNITS`) is read only inside functions called at runtime.
- **Build before `rules-data.js` or `run.sh`:** `./build.sh --no-zip`. It rewrites the tracked `dist/fieldbook.html` and `docs/CHANGELOG.md`.

**Git and release**
- **Branch commits carry source and docs only.** Never `git add` `dist/fieldbook.html` or `docs/CHANGELOG.md`. Always `git add` explicit paths. Never use `git stash` in any form (the stash stack is shared with other sessions).
- Never touch `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array. No merge, push or tag.
- Commit messages end with exactly: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

**Character data**
- New status fields `durationSec` and `elapsedSec` are optional; no `blankChar()` change (`statuses` already exists). `migrate()` preserves every field. Every reader coerces.
- The Concentrating condition (`concId`) is never timed.

**Markup safety**
- Every `${…}` inside a quoted HTML attribute is `esc(…)` of the whole expression, or a literal-only ternary (`rules-data.js` tokenizes all of `src/js`).
- A selector built from an id goes through `attrSel()`.
- Toasts set `textContent`; their text is never `esc()`'d.

**Settled values (spec)**
- Units: rounds (6 s), minutes (60 s), hours (3600 s).
- Time left: up to 60 s in rounds rounded up; otherwise rounded up to the minute — under an hour "N min", an hour or more "H h" or "H h M min".
- A cleared timed row shows its length: "lasts N round(s)", "lasts N min", "lasts N h".
- Running out: the condition flips to Cleared (row kept, effects stop), one toast per step with an Undo that applies once and only on the character it was shown for. Focus is not moved.
- Reactivating restarts the full duration; changing the length in the form keeps the time already run.

**Tests and screenshots**
- Unit tests go in existing suites only (`sheet.js`, `rules-data.js`).
- **Screenshots:**
  - Use only the project's `mcp__playwright__*` tools (load them with ToolSearch); never `mcp__plugin_playwright_*`, which refuse `file://`.
  - The branch build: `file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/55/dist/fieldbook.html`; `main`'s (before) build: `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`.
  - Shots go under `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/` as `55-before-*.png` / `55-after-*.png`.
  - `newCharacter("QA","dnd")` gets a sheet (`"humblewood"` for the other skin); the tab names are lowercase; the app's `confirm()` dialogs are answered with `browser_handle_dialog`.

## Review Focus

The five conditions the spec implies that no unit test can reach, most likely to bite first. Each
has a driven check in the task that owns the code.

1. **Pressing ▶ from the keyboard as conditions run out.** Focus stays on ▶; a second Enter moves another round and never presses the toast's Undo (Task 4, Step 3, item 3).
2. **Editing a timed condition's notes mid-fight.** Saving the form keeps the time already run (Task 3 tests; Task 4, Step 3, item 7).
3. **A character switch with an Undo toast showing.** The Undo does nothing on the other character (Task 2 tests; Task 4, Step 3, item 8).
4. **A redraw with the combat view open** — a character switch, or changing Settings → Skills display — builds fresh score boxes and dots, which must come out disabled (Task 5, Step 6).
5. **The compact cards are still useful.** A tap on a modifier, save or skill opens its breakdown; Tab skips the disabled controls; the cards are editable again on the Sheet tab (Task 5, Step 6).

---

### Task 1: The timed-condition model (pure)

**Files:**
- Modify: `src/js/40-sheet.js` (a new block after `renderConcCard()`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: nothing new.
- Produces (pure, no DOM):
  - `STATUS_UNITS` = `[["rounds",6],["minutes",60],["hours",3600]]`;
  - `statusDuration(s): number` (whole seconds, 0 = untimed, always 0 with `concId`), `statusElapsed(s): number`, `statusTimed(s): boolean`;
  - `statusUnitFor(sec): [number|"", unitKey]`;
  - `fmtStatusTime(sec): string`, `statusTimeText(s): string`, `statusExpiredText(names): string`;
  - `tickStatuses(c, deltaSec, onlyId?): [{id, name, was}]`, `restartStatus(s)`.

- [ ] **Step 1: Write the failing test**

`src/tests/sheet.js`: add to the `loadApp([...])` names:

```js
  'statusDuration', 'statusElapsed', 'statusTimed', 'statusUnitFor', 'fmtStatusTime', 'statusTimeText',
  'statusExpiredText', 'tickStatuses', 'restartStatus',
```

Insert directly after the block `/* ---- rounds: in combat the floor is round 1 ---- */` (that block
ends just before the line `ck('the combat button has its crossed swords', …)`):

```js
/* ---- timed conditions: reading, wording, the clock (#55) ----
   Design: src/docs/specs/2026-10-06-timed-conditions-design.md §3, §4. */
{
  ck('a duration is whole seconds above 0, else untimed',
     X.statusDuration({durationSec: 18}) === 18 && X.statusDuration({durationSec: '60'}) === 60 &&
     X.statusDuration({durationSec: 0}) === 0 && X.statusDuration({durationSec: -6}) === 0 &&
     X.statusDuration({durationSec: 'x'}) === 0 && X.statusDuration({}) === 0 && X.statusDuration(null) === 0);
  ck('the Concentrating condition is never timed', X.statusDuration({concId: 'a1', durationSec: 60}) === 0 &&
     !X.statusTimed({concId: 'a1', durationSec: 60}) && X.statusTimed({durationSec: 6}));
  ck('elapsed time reads as 0 when junk or negative', X.statusElapsed({elapsedSec: 12}) === 12 &&
     X.statusElapsed({elapsedSec: -5}) === 0 && X.statusElapsed({elapsedSec: 'x'}) === 0 && X.statusElapsed({}) === 0);
  const t = X.fmtStatusTime;
  ck('time left in rounds up to a minute', t(1) === '1 round' && t(6) === '1 round' && t(18) === '3 rounds' && t(60) === '10 rounds');
  ck('...then minutes, rounded up', t(66) === '2 min' && t(120) === '2 min' && t(3540) === '59 min');
  ck('...then hours and minutes', t(3599) === '1 h' && t(3600) === '1 h' && t(5400) === '1 h 30 min');
  ck('a row says the time left while active', X.statusTimeText({active: true, durationSec: 18, elapsedSec: 6}) === '2 rounds left');
  ck('...and its length while cleared', X.statusTimeText({active: false, durationSec: 18}) === 'lasts 3 rounds' &&
     X.statusTimeText({active: false, durationSec: 60}) === 'lasts 1 min' &&
     X.statusTimeText({active: false, durationSec: 3600}) === 'lasts 1 h' &&
     X.statusTimeText({active: false, durationSec: 6}) === 'lasts 1 round');
  ck('...and nothing when untimed', X.statusTimeText({active: true}) === '' && X.statusTimeText({active: true, concId: 'a', durationSec: 60}) === '');
  ck('the form shows a duration in the largest unit that divides it',
     JSON.stringify([X.statusUnitFor(60), X.statusUnitFor(18), X.statusUnitFor(5400), X.statusUnitFor(7200), X.statusUnitFor(0)]) ===
     JSON.stringify([[1, 'minutes'], [3, 'rounds'], [90, 'minutes'], [2, 'hours'], ['', 'rounds']]));
  ck('the toast names what ran out', X.statusExpiredText(['Poisoned']) === 'Poisoned has run out' &&
     X.statusExpiredText(['Poisoned', 'Frightened']) === 'Poisoned and Frightened have run out' &&
     X.statusExpiredText(['A', 'B', 'C', 'D']) === 'A, B and 2 more have run out');

  const c = {statuses: [{id: 'p', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 12},
                        {id: 'u', name: 'Blessed', active: true},
                        {id: 'x', name: 'Prone', active: false, durationSec: 18, elapsedSec: 0}, null, 'junk']};
  const ran = X.tickStatuses(c, 6);
  ck('a step clears a condition that reaches its duration and reports it with its time before the step',
     JSON.stringify(ran) === JSON.stringify([{id: 'p', name: 'Poisoned', was: 12}]) &&
     c.statuses[0].active === false && c.statuses[0].elapsedSec === 18);
  ck('...leaving untimed, cleared and junk entries alone', !('elapsedSec' in c.statuses[1]) && c.statuses[2].elapsedSec === 0);
  const back = {statuses: [{id: 'p', active: true, durationSec: 18, elapsedSec: 18}]};
  ck('a step back never clears anything', X.tickStatuses(back, -6).length === 0 &&
     back.statuses[0].active === true && back.statuses[0].elapsedSec === 12);
  ck('...and stops at 0', (() => { const z = {statuses: [{id: 'z', active: true, durationSec: 18, elapsedSec: 0}]};
     X.tickStatuses(z, -6); return z.statuses[0].elapsedSec === 0; })());
  const one = {statuses: [{id: 'a', active: true, durationSec: 60, elapsedSec: 0}, {id: 'b', active: true, durationSec: 60, elapsedSec: 0}]};
  X.tickStatuses(one, 6, 'b');
  ck('a step for one condition moves only it', one.statuses[0].elapsedSec === 0 && one.statuses[1].elapsedSec === 6);
  ck('a character with no list of statuses steps nothing', X.tickStatuses({statuses: 'junk'}, 6).length === 0 &&
     X.tickStatuses(null, 6).length === 0);
  ck('restarting a timed condition starts its full time again', (() => {
     const s = {durationSec: 18, elapsedSec: 18}; X.restartStatus(s); return s.elapsedSec === 0; })());
  ck('...and leaves an untimed one alone', (() => { const s = {}; X.restartStatus(s); return !('elapsedSec' in s); })());
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|LOAD FAIL|Error" | head`
Expected: a TypeError (`X.statusDuration is not a function`).

- [ ] **Step 3: The helpers**

In `src/js/40-sheet.js`, directly after the closing `}` of `renderConcCard()`, add:

```js

/* ---- timed conditions (#55) ----
   A status may last a set time: `durationSec` (a round is 6) and `elapsedSec`,
   how long it has run since it was last applied. The round tracker moves every
   active timed condition with the active spells (advanceRound()); one that
   reaches its duration clears itself, with an Undo. The Concentrating condition
   is never timed: its spell owns the clock. These helpers are pure, no DOM.
   Design: src/docs/specs/2026-10-06-timed-conditions-design.md */
const STATUS_UNITS=[["rounds",6],["minutes",60],["hours",3600]];
/* the duration in whole seconds; 0 = untimed (junk, 0 or less, or Concentrating) */
function statusDuration(s){
  if(!s||typeof s!=="object"||s.concId)return 0;
  const d=Math.round(Number(s.durationSec));
  return isFinite(d)&&d>0?d:0;
}
function statusElapsed(s){
  const e=Math.round(Number(s&&s.elapsedSec));
  return isFinite(e)&&e>0?e:0;
}
function statusTimed(s){return statusDuration(s)>0;}
/* A duration as the form shows it: the largest unit that divides it exactly.
   [number, unit key], or ["", "rounds"] for untimed. */
function statusUnitFor(sec){
  sec=Math.round(Number(sec));
  if(!isFinite(sec)||sec<=0)return ["","rounds"];
  for(let i=STATUS_UNITS.length-1;i>=0;i--){const [u,f]=STATUS_UNITS[i];if(sec%f===0)return [sec/f,u];}
  return [Math.max(1,Math.round(sec/6)),"rounds"];
}
/* Time as a fight reads it: rounds up to a minute, then rounded up to the
   minute — minutes under an hour, hours and minutes after. */
function fmtStatusTime(sec){
  sec=Math.max(0,Number(sec)||0);
  if(sec<=60){const r=Math.ceil(sec/6);return `${r} round${r===1?"":"s"}`;}
  const t=Math.ceil(sec/60);
  if(t<60)return `${t} min`;
  const h=Math.floor(t/60),m=t%60;
  return m?`${h} h ${m} min`:`${h} h`;
}
/* What a row says: the time left while active, its length while cleared (what
   switching it back on would give), nothing when untimed. */
function statusTimeText(s){
  const d=statusDuration(s);if(!d)return "";
  if(s.active===false){
    const [n,u]=statusUnitFor(d);
    return "lasts "+(u==="hours"?`${n} h`:u==="minutes"?`${n} min`:`${n} round${n===1?"":"s"}`);
  }
  return fmtStatusTime(Math.max(0,d-statusElapsed(s)))+" left";
}
function statusExpiredText(names){
  const n=(Array.isArray(names)?names:[]).map(x=>String(x||"A condition"));
  if(n.length<=1)return `${n[0]||"A condition"} has run out`;
  if(n.length===2)return `${n[0]} and ${n[1]} have run out`;
  return `${n[0]}, ${n[1]} and ${n.length-2} more have run out`;
}
/* Move active timed conditions by deltaSec: every one, or only `onlyId`. One a
   forward step brings to its duration clears itself, as the toggle does, its
   time kept at the duration. Returns those, each with its elapsed time before
   the step: what Undo restores. Cleared and untimed conditions do not move. */
function tickStatuses(c,deltaSec,onlyId){
  const ran=[];
  (Array.isArray(c&&c.statuses)?c.statuses:[]).forEach(s=>{
    if(!s||typeof s!=="object"||s.active===false)return;
    if(onlyId!=null&&s.id!==onlyId)return;
    const d=statusDuration(s);if(!d)return;
    const was=statusElapsed(s), now=Math.max(0,was+deltaSec);
    if(deltaSec>0&&now>=d){s.elapsedSec=d;s.active=false;ran.push({id:s.id,name:s.name,was});}
    else s.elapsedSec=now;
  });
  return ran;
}
/* Switching a timed condition back on starts its full duration again. */
function restartStatus(s){if(statusTimed(s))s.elapsedSec=0;}
```

- [ ] **Step 4: Run the test**

Run: `node src/tests/sheet.js | tail -1`
Expected: `ALL PASSED (…)`.

- [ ] **Step 5: Commit**

```bash
git add src/js/40-sheet.js src/tests/sheet.js
git commit -m "feat: the timed-condition model — durations, time left, the clock (pure) (#55)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The clock on the sheet: the round, the row, running out, Undo

**Files:**
- Modify: `src/js/40-sheet.js` (`statusRowHTML()`; a DOM block after Task 1's helpers)
- Modify: `src/js/60-attacks.js` (`advanceRound()`), `src/js/80-modal-forms.js` (`addStatusByName()`), `src/js/71-char-io.js` (`printSheet()`), `src/js/90-boot.js` (click handlers)
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: Task 1's helpers; `toast(msg, {label, run})` (60-attacks.js); `attrSel()` (87-journal.js); `renderStatuses()`, `recompute()`, `scheduleSave()`.
- Produces:
  - `announceStatusExpiry(ran): rec|null` (rec = `{ran, done}`), `undoStatusExpiry(rec, who): boolean`, `stepStatusTap(id, deltaSec, viaKey)`;
  - row hooks `data-status-tick` (= the status id) with `data-sec` `"-6"` / `"6"`; the row text in `<span class="qty st-time">`.

- [ ] **Step 1: Write the failing tests**

`src/tests/sheet.js`: add `'announceStatusExpiry', 'undoStatusExpiry', 'stepStatusTap',` to the
`loadApp([...])` names, and insert directly after Task 1's block:

```js
/* ---- timed conditions on the sheet: the round, the row, running out (#55) ---- */
{
  const mk = () => {
    const c = X.blankChar(); X.character = c;
    c.statuses = [{id: 'p', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 0, effects: []},
                  {id: 'f', name: 'Frightened', active: true, durationSec: 12, elapsedSec: 6, effects: []},
                  {id: 'u', name: 'Blessed', active: true, effects: []},
                  {id: 'x', name: 'Prone', active: false, durationSec: 18, elapsedSec: 0, effects: []}];
    X.combatStart(c);
    return c;
  };
  let c = mk();
  X.advanceRound(1);
  ck('the next round moves every active timed condition on 6 seconds', c.statuses[0].elapsedSec === 6);
  ck('...one brought to its duration clears itself, its time kept at the duration',
     c.statuses[1].active === false && c.statuses[1].elapsedSec === 12);
  ck('...an untimed one and a cleared one do not move', !('elapsedSec' in c.statuses[2]) && c.statuses[3].elapsedSec === 0);
  c = mk(); c.statuses[0].elapsedSec = 6;
  X.advanceRound(-1);
  ck('at round 1 in combat, the previous round moves no condition', c.combatRound === 1 && c.statuses[0].elapsedSec === 6);
  c = mk(); c.statuses[0].elapsedSec = 12;
  X.advanceRound(1);
  ck('several can run out on one step', c.statuses[0].active === false && c.statuses[1].active === false);

  c = mk();
  const ran = X.tickStatuses(c, 6);
  const rec = X.announceStatusExpiry(ran);
  ck('a step that ran something out puts up a toast with what Undo needs', !!rec && rec.ran.length === 1 && rec.ran[0].id === 'f');
  ck('an Undo shown for another character does nothing', X.undoStatusExpiry(rec, X.blankChar()) === false && c.statuses[1].active === false);
  ck("this character's Undo brings it back, at its time before the step",
     X.undoStatusExpiry(rec, c) === true && c.statuses[1].active === true && c.statuses[1].elapsedSec === 6);
  ck('...once only', X.undoStatusExpiry(rec, c) === false);
  ck('nothing ran out: no toast', X.announceStatusExpiry([]) === null);
  c = mk();
  const rec2 = X.announceStatusExpiry(X.tickStatuses(c, 12));
  c.statuses = c.statuses.filter(s => s.id !== 'f');
  ck('an Undo skips a condition deleted since', X.undoStatusExpiry(rec2, c) === true && c.statuses.every(s => s.id !== 'f'));

  c = mk();
  X.stepStatusTap('p', 6, false);
  ck('+ rd moves only that condition', c.statuses[0].elapsedSec === 6 && c.statuses[1].elapsedSec === 6);
  X.stepStatusTap('p', -6, false); X.stepStatusTap('p', -6, false);
  ck('− rd stops at 0', c.statuses[0].elapsedSec === 0);
  X.stepStatusTap('f', 6, false);
  ck('+ rd to the end clears it', c.statuses[1].active === false);

  c = X.blankChar(); X.character = c;
  c.statuses = [{id: 'q', name: 'Poisoned', active: false, durationSec: 60, elapsedSec: 60, effects: []}];
  ck('an item reactivating a timed condition restarts it', X.addStatusByName('Poisoned') === 'reactivated' && c.statuses[0].elapsedSec === 0);
  c.statuses[0].elapsedSec = 24;
  ck('...one already active keeps running', X.addStatusByName('Poisoned') === 'already' && c.statuses[0].elapsedSec === 24);

  const row = X.statusRowHTML({id: 'p', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 6});
  ck('an active timed row shows its time left and the round buttons',
     /2 rounds left/.test(row) && /data-status-tick="p" data-sec="-6"/.test(row) && /data-status-tick="p" data-sec="6"/.test(row), row);
  const off = X.statusRowHTML({id: 'p', name: 'Poisoned', active: false, durationSec: 60, elapsedSec: 60});
  ck('a cleared one shows its length and no round buttons', /lasts 1 min/.test(off) && !/data-status-tick/.test(off), off);
  const plain = X.statusRowHTML({id: 'b', name: 'Blessed', active: true});
  ck('an untimed row is as it was', !/st-time/.test(plain) && !/data-status-tick/.test(plain));
  ck('the Concentrating row is never timed', !/data-status-tick|st-time/.test(
     X.statusRowHTML({id: 'cc', name: 'Concentrating', active: true, concId: 'a1', durationSec: 60})));

  const saved = Object.assign(X.blankChar(), {statuses: [{id: 'p', name: 'Poisoned', description: '', active: true, durationSec: 18, elapsedSec: 6, effects: []}]});
  const back = X.migrate(JSON.parse(JSON.stringify(saved))).statuses[0] || {};
  ck('a timed condition survives a save and a load', back.durationSec === 18 && back.elapsedSec === 6, back);
  X.character = X.blankChar();
}
```

In the hostile-character block (`// ---- a hostile character, through every renderer`), append to the
hostile `statuses` array:

```js
               {id: 'st3', name: P, description: P, effects: [], active: true, durationSec: 18, elapsedSec: 6},
               {id: 'st4', name: P, effects: [], active: true, durationSec: P, elapsedSec: P}
```

and, directly after the line `run('the print sheet', () => ctx.printSheet());`, add:

```js
  C().statuses.push({id: 'tp', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 6, effects: []});
  ck('#55 the print sheet lists a timed condition with its time left',
     /Poisoned \(2 rounds left\)/.test(capture(() => ctx.printSheet()).html));
  C().statuses = C().statuses.filter(s => s.id !== 'tp');
```

`src/tests/rules-data.js`: insert directly before the line `// ---------- the supplement packs (Xanathar's, Tasha's)`:

```js
// ---------- timed conditions are wired (#55)
// 90-boot.js is not loaded by the harness, so its handlers are checked as text.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const body = name => (js.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')) || [''])[0];
  ck("a timed row's round buttons have a click handler", js.includes('closest("[data-status-tick]")'));
  ck('...and are drawn with an escaped id', /data-status-tick="\$\{esc\(/.test(js));
  ck('switching a condition back on restarts its clock', /\[data-toggle-status\][^\n]*restartStatus\(s\)/.test(js));
  ck('the round tracker moves timed conditions with the spells', /tickStatuses\(character,dir\*6\)/.test(body('advanceRound')));
}
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|Error" | head; ./build.sh --no-zip >/dev/null && node src/tests/rules-data.js | grep -E "^FAIL" | head`
Expected: a TypeError (`X.announceStatusExpiry is not a function`), and FAIL on the four wiring checks.

- [ ] **Step 3: The DOM half**

In `src/js/40-sheet.js`, directly after Task 1's `restartStatus()`, add:

```js
/* One toast for every condition that ran out on a step, with its Undo. Focus is
   left where it is: the ▶ or + rd just pressed is still there, and pressing it
   again must move the clock, never land on Undo. */
function announceStatusExpiry(ran){
  if(!Array.isArray(ran)||!ran.length)return null;
  const rec={ran,done:false}, who=character;
  toast(statusExpiredText(ran.map(r=>r.name)),{label:"Undo",run:()=>undoStatusExpiry(rec,who)});
  return rec;
}
/* The toast's Undo: those conditions active again, each at the time it had
   before the step. Once only, and only on the character it was shown for (the
   object, so an import over the same id is another character). A condition
   deleted since is skipped. */
function undoStatusExpiry(rec,who){
  if(!rec||rec.done||!character||character!==who)return false;
  rec.done=true;
  rec.ran.forEach(r=>{const s=(character.statuses||[]).find(x=>x&&x.id===r.id);if(s){s.active=true;s.elapsedSec=r.was;}});
  renderStatuses();recompute();scheduleSave();
  return true;
}
/* − rd / + rd on one timed condition's row. The save is scheduled before the
   redraw. From the keyboard, focus goes back to the same button, or the row's
   toggle once the condition has run out (its buttons are gone). */
function stepStatusTap(id,deltaSec,viaKey){
  const ran=tickStatuses(character,deltaSec,id);
  scheduleSave();
  renderStatuses();if(ran.length)recompute();
  announceStatusExpiry(ran);
  if(viaKey){
    const sel=attrSel("data-status-tick",id)+(deltaSec>0?'[data-sec="6"]':'[data-sec="-6"]');
    const b=document.querySelector(sel)||document.querySelector(attrSel("data-toggle-status",id));
    if(b&&b.focus)b.focus();
  }
}
```

Replace `statusRowHTML()` with:

```js
function statusRowHTML(s){
  const on=s.active!==false, tt=statusTimeText(s), ticking=on&&statusTimed(s);
  const nm=String(s.name||"condition");
  return `<div class="item${on?" on-status":""}"><div class="top">
        <span class="nm">${statusTitle(s.name)}</span>
        ${tt?`<span class="qty st-time">${esc(tt)}</span>`:""}
        <span class="equip ${on?"on":""}" data-toggle-status="${esc(s.id)}"><span class="box"></span>${on?"Active":"Cleared"}</span>
        <button class="icon" data-edit-status="${esc(s.id)}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger" data-del-status="${esc(s.id)}" aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
      </div>
      ${ticking?`<div class="use-row"><span class="use-lbl">Time</span>
        <button class="tbtn" data-status-tick="${esc(s.id)}" data-sec="-6" aria-label="${esc("One round back: "+nm)}" style="padding:3px 8px;min-height:auto">− rd</button>
        <button class="tbtn" data-status-tick="${esc(s.id)}" data-sec="6" aria-label="${esc("One round on: "+nm)}" style="padding:3px 8px;min-height:auto">+ rd</button>
      </div>`:""}
      ${s.description?`<div class="desc">${richHTML(s.description)}</div>`:""}
      ${on?fxChips(s.effects):fxChips(s.effects).replace(/class="chip"/g,'class="chip off"')}</div>`;
}
```

(Compare with the current function first: the `top` row, description and effect chips are unchanged;
only the `st-time` span and the `use-row` are new.)

- [ ] **Step 4: The round, the toggle, items, print**

`src/js/60-attacks.js`, `advanceRound()`: replace its last two lines

```js
  (character.activeSpells||[]).slice().forEach(a=>bumpActive(a,dir*6));
  renderActiveSpells();renderCombatChrome();scheduleSave();
```

with

```js
  (character.activeSpells||[]).slice().forEach(a=>bumpActive(a,dir*6));
  /* timed conditions move with the spells (#55); one that runs out clears itself */
  const ran=tickStatuses(character,dir*6);
  renderActiveSpells();renderStatuses();renderCombatChrome();
  if(ran.length)recompute();
  scheduleSave();
  announceStatusExpiry(ran);
```

`src/js/90-boot.js`:
- in the `[data-toggle-status]` branch, change `else s.active=s.active===false;` to
  `else{s.active=s.active===false;if(s.active)restartStatus(s);}`;
- directly before that branch, add:

  ```js
    if((m=t.closest("[data-status-tick]"))){stepStatusTap(m.dataset.statusTick,num(m.dataset.sec),e.detail===0);return;}
  ```

`src/js/80-modal-forms.js`, `addStatusByName()`: change
`if(ex){const was=ex.active!==false;ex.active=true;return was?"already":"reactivated";}` to
`if(ex){const was=ex.active!==false;ex.active=true;if(!was)restartStatus(ex);return was?"already":"reactivated";}`.

`src/js/71-char-io.js`, `printSheet()`: replace the line
`const stat=(character.statuses||[]).map(s=>esc(s.name||s.term||"")).filter(Boolean).join(", ");` with

```js
  /* a timed condition prints with its time left (#55) */
  const stat=(character.statuses||[]).map(s=>{const n=esc(s.name||s.term||"");
    return n&&s.active!==false&&statusTimed(s)?`${n} (${esc(statusTimeText(s))})`:n;}).filter(Boolean).join(", ");
```

- [ ] **Step 5: Build and run every suite**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: every suite passes.

- [ ] **Step 6: Commit**

```bash
git add src/js/40-sheet.js src/js/60-attacks.js src/js/80-modal-forms.js src/js/71-char-io.js src/js/90-boot.js \
  src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat: the round tracker counts timed conditions down; they clear themselves, with an Undo (#55)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The status form's "Lasts" row

**Files:**
- Modify: `src/js/80-modal-forms.js` (`openStatusForm()`)
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js` (a window that reads the save handler)

**Interfaces:**
- Consumes: `STATUS_UNITS`, `statusUnitFor()`, `statusDuration()`, `statusElapsed()` (Task 1).
- Produces: the form ids `#stDurN` (number) and `#stDurU` (unit select, values `rounds`/`minutes`/`hours`).

- [ ] **Step 1: Write the failing test**

`src/tests/sheet.js`: directly before the hostile block's closing lines (the
`Object.assign(doc, saved);` followed by `if (!hadFR) delete ctx.FileReader;`, near the end of the
file), add:

```js
  /* ---- the status form's Lasts row (#55), driven through the form ----
     The recorder DOM does not read values back out of the markup, so each box a
     save reads is set by hand. */
  {
    X.character = X.blankChar();
    const why = res => res.err ? String(res.err.stack || res.err).split('\n').slice(0, 3).join(' | ') : undefined;
    let res = capture(() => { ctx.openStatusForm(); el('stName').value = 'Poisoned'; el('stDurN').value = '3'; el('stDurU').value = 'rounds'; fire('stSave', 'click'); });
    const p = X.character.statuses[0] || {};
    ck('#55 the form saves a duration: 3 rounds is 18 seconds', !res.err && p.durationSec === 18 && !('elapsedSec' in p), why(res) || p);
    p.elapsedSec = 6;
    res = capture(() => { ctx.openStatusForm(p); el('stName').value = 'Poisoned'; el('stDesc').value = 'From the needle trap.';
      el('stDurN').value = '3'; el('stDurU').value = 'rounds'; fire('stSave', 'click'); });
    ck('#55 editing the notes mid-fight keeps the time already run', !res.err && X.character.statuses[0].elapsedSec === 6 &&
       X.character.statuses[0].description === 'From the needle trap.', why(res) || X.character.statuses[0]);
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Poisoned'; el('stDurN').value = '2'; el('stDurU').value = 'minutes'; fire('stSave', 'click'); });
    const p2 = X.character.statuses[0] || {};
    ck('#55 changing the length keeps the time already run', !res.err && p2.durationSec === 120 && p2.elapsedSec === 6, why(res) || p2);
    p2.active = false; p2.elapsedSec = 120;
    res = capture(() => { ctx.openStatusForm(p2); el('stName').value = 'Poisoned'; el('stDurN').value = '2'; el('stDurU').value = 'minutes';
      fire('stActive', 'click'); fire('stSave', 'click'); });
    const p3 = X.character.statuses[0] || {};
    ck('#55 switching it on in the form restarts it', !res.err && p3.active === true && p3.durationSec === 120 && !('elapsedSec' in p3), why(res) || p3);
    res = capture(() => { ctx.openStatusForm(p3); el('stName').value = 'Poisoned'; el('stDurN').value = ''; fire('stSave', 'click'); });
    ck('#55 a blank length makes it untimed', !res.err && !('durationSec' in X.character.statuses[0]) && !('elapsedSec' in X.character.statuses[0]),
       why(res) || X.character.statuses[0]);
    X.character.statuses = [{id: 'cc', name: 'Concentrating', active: true, concId: 'a1', effects: []}];
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Concentrating'; el('stDurN').value = '3'; fire('stSave', 'click'); });
    ck('#55 the Concentrating condition never takes a duration', !res.err && !('durationSec' in X.character.statuses[0]), why(res) || X.character.statuses[0]);
    X.character = X.blankChar();
  }
```

In the hostile block, directly after `run('the status editor', () => ctx.openStatusForm(C().statuses[0]));`, add:

```js
  run('the status editor (a timed condition)', () => ctx.openStatusForm(C().statuses.find(s => s.id === 'st3')));
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node src/tests/sheet.js | grep -E "^FAIL" | head`
Expected: FAIL on the `#55 the form saves a duration…` checks.

- [ ] **Step 3: The form**

In `src/js/80-modal-forms.js`, `openStatusForm()`:

(a) Directly after `const dl=statusDatalistHTML("statusTerms");`, add:

```js
  /* how long it lasts (#55); never on the Concentrating condition, whose spell owns the clock */
  const [durN,durU]=statusUnitFor(statusDuration(s));
```

(b) In the markup, directly after the Notes field (the `<div class="field">` holding `#stDesc`), add:

```html
    <div class="field"${s.concId?' style="display:none"':""}><label class="f">Lasts (optional)</label>
      <div class="g2"><input id="stDurN" type="number" min="0" step="1" value="${esc(durN)}" placeholder="Until cleared" aria-label="How long it lasts">
        <select id="stDurU" aria-label="Unit">${STATUS_UNITS.map(([u])=>`<option value="${esc(u)}"${u===durU?" selected":""}>${esc(u)}</option>`).join("")}</select></div>
      <p class="hint">The round tracker counts it down, and it clears itself when the time is up. Leave blank for a condition that lasts until you clear it.</p></div>
```

(c) In the Save handler, directly after `if(s.concId)rec.concId=s.concId;`, add:

```js
    /* How long it lasts (#55). The time already run is kept, so a mistyped
       length can be corrected; switching it on again here restarts it. */
    const dn=Math.trunc(Number(document.getElementById("stDurN").value));
    const du=(STATUS_UNITS.find(([u])=>u===document.getElementById("stDurU").value)||STATUS_UNITS[0])[1];
    if(!rec.concId&&dn>0){
      rec.durationSec=dn*du;
      const restarted=active&&s.active===false;
      if(!restarted&&statusElapsed(s))rec.elapsedSec=statusElapsed(s);
    }
```

(d) `src/tests/rules-data.js` reads the status form's save handler as text, from
`const rec={id:s.id,name:document.getElementById("stName")` to the first `scheduleSave();`, through a
window of at most 1200 characters (`[\s\S]{0,1200}?`, in the `const stSave = …` line). The Lasts
block makes the handler longer than that, so the match comes back empty and the two checks after it
("the status form keeps the link to the spell", "…and unticking Active there ends the spell as well")
fail. Widen that window to `{0,2400}` — only that number on that line.

- [ ] **Step 4: Build and run every suite**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: every suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/js/80-modal-forms.js src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat: the status form sets how long a condition lasts (#55)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Timed conditions — drive it, document it

**Files:**
- Modify: `src/docs/wiki/features/conditions-and-concentration.md`, `features/spells.md`, `features/combat-view.md`, `architecture/character-model.md`, `roadmap/known-issues.md`, `decisions.md`; `src/docs/_claude/WIRING-LEDGER.md`; `src/docs/UNRELEASED.md`; `README.md`

- [ ] **Step 1: Before shots, from `main`'s build**

Navigate to `main`'s build, `newCharacter("QA","dnd")`, add a status "Poisoned" (Statuses &
Conditions → Add), and shoot the sheet's Statuses card at 1280 and at 390
(`55-before-statuses-1280.png`, `55-before-statuses-390.png`) and the status form
(`55-before-status-form.png`).

- [ ] **Step 2: Build the branch**

Run: `./build.sh --no-zip`

- [ ] **Step 3: Drive it (after)** — on the branch's build, `newCharacter("QA","dnd")`:

1. Add "Poisoned" lasting **3 rounds**. The row reads "3 rounds left" with − rd / + rd. Shoot
   `55-after-statuses-1280.png` and `55-after-statuses-390.png`, and the form
   (`55-after-status-form.png`).
2. Open the combat view (the swords), Start combat, press ▶ twice: "1 round left". Press ▶ again:
   Poisoned flips to Cleared, the row reads "lasts 3 rounds", and the toast says "Poisoned has run
   out" with Undo. Shoot `55-after-ran-out.png`. Press Undo: active again, "1 round left".
3. **Review Focus 1.** Tab to ▶ and press Enter until Poisoned runs out, then press Enter once more:
   the round moves on again, and Poisoned stays cleared (the second Enter did not press Undo). Report
   where focus is after each press.
4. − rd / + rd on the row move only that condition; − rd stops at "3 rounds left".
5. Switch it back on with its toggle: "3 rounds left" again (restarted).
6. Add "Frightened" lasting **1 minute** ("10 rounds left") and "Blessed" lasting **2 minutes**
   ("2 min left").
7. **Review Focus 2.** With Poisoned at "2 rounds left", edit it and change only its notes: still
   "2 rounds left" after Save.
8. **Review Focus 3.** Make Poisoned run out (toast showing), switch to another character from the
   home screen, come back if needed, and press the old toast's Undo if it is still on screen: nothing
   changes on either character.
9. **The other skin.** `newCharacter("QA HW","humblewood")`, add a timed condition, shoot the
   Statuses card at 1280 and 390 (`55-after-statuses-hw-1280.png`, `55-after-statuses-hw-390.png`).

**Report:** every shot path, what you drove and saw, and what you did not drive (touch, real phones,
print, Mike's own characters).

- [ ] **Step 4: Docs**

**Ledger.** Append to `src/docs/_claude/WIRING-LEDGER.md`:

```markdown
## Timed conditions (#55, 2026-10-06)

A condition can now last a set time. A status carries an optional `durationSec` (a round is 6) and
`elapsedSec`; the status form's "Lasts" row sets it in rounds, minutes or hours, and blank is
untimed, as every condition was before. `advanceRound()` moves every active timed condition with the
active spells, and each timed row has − rd / + rd. A forward step that brings one to its duration
flips it to Cleared (row kept, effects off); one toast per step names them, with an Undo that
applies once and only on the character it was shown for. Focus is not moved, so a keyboard ▶ cannot
land on Undo. Switching one back on — the toggle, the form, or an item's Use reactivating it —
restarts its full duration; changing its length in the form keeps the time already run. The
Concentrating condition is never timed: its spell owns the clock. The print sheet shows the time
left. Pages: [conditions & concentration](../wiki/features/conditions-and-concentration.md),
[spells](../wiki/features/spells.md), [combat view](../wiki/features/combat-view.md),
[character model](../wiki/architecture/character-model.md).
```

Take its line: `grep -n '^## ' src/docs/_claude/WIRING-LEDGER.md | tail -1` → `L<a>`.

**`conditions-and-concentration.md`:**
- add `statusDuration()`, `statusTimeText()`, `tickStatuses()`, `restartStatus()`,
  `announceStatusExpiry()`, `undoStatusExpiry()`, `stepStatusTap()` (in `40-sheet.js`) and
  `advanceRound()` (in `60-attacks.js`) to **Code:**;
- in **How it works**, add the fields to the status shape, and a paragraph **Timed conditions** saying
  what the ledger entry says, in present tense;
- in **Rules that must hold**, add: "The Concentrating condition is never timed — its spell owns the
  clock" and "The Undo after a condition runs out applies once, and only on its character";
- add **Decisions** rows for spec §2 decisions 1–6 (question, decision, rejected and why);
- in **Open**, add "Rests do not move condition clocks (nor spell clocks)" and "An item's Use applies
  an untimed condition";
- History: `- 2026-10-06 — Timed conditions: a duration in rounds, minutes or hours, counted down by the round tracker, clearing itself with an Undo. → ledger L<a>, #55`.

**`spells.md`:** where it describes `advanceRound()`, say it moves timed conditions too (link
[Conditions & concentration](conditions-and-concentration.md)); same History line.

**`combat-view.md`:** in **The tracker**, ◀ and ▶ move timed conditions as well as spells; update the
**Decisions** row "What a round changes" to "Active spells and timed conditions, through
`advanceRound()`" (keep the old choice as the rejected alternative: "Active spells only — timed
conditions came in #55"); remove "Timed conditions" from **Open**; same History line.

**`character-model.md`:** the status shape gains `durationSec` and `elapsedSec` (optional, coerced on
read); same History line.

**`known-issues.md`:** under **Deferred**, "Rests do not move condition or spell clocks" and "An item's
Use cannot apply a timed condition", each linking [Conditions & concentration](../features/conditions-and-concentration.md).

**`decisions.md`:** one line per new Decisions row, under the Conditions & concentration heading.

**`src/docs/UNRELEASED.md`**, under `## Pending`, spec §10's first bullet exactly:

```markdown
- Conditions can now last a set time: give one a duration in rounds, minutes or hours, and the round
  tracker counts it down beside your active spells. The condition shows the time it has left, clears
  itself when it runs out (with an Undo), and starts its full time again if you switch it back on.
```

**`README.md`:**
- §5's Sheet list: after the bullet that lists **Statuses & Conditions**, add
  `- **Timed conditions.** Give a condition a duration in rounds, minutes or hours: the round tracker counts it down, and it clears itself when the time is up, with an Undo.`
- §5's ⚔️ Combat view, **Keeping track of the fight**: "your active spells' timers move along with
  them" becomes "your active spells and timed conditions move along with them".

- [ ] **Step 5: Run every suite and commit the docs**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: every suite passes, `docs` included.

```bash
git add src/docs/wiki src/docs/_claude/WIRING-LEDGER.md src/docs/UNRELEASED.md README.md
git commit -m "docs: timed conditions — wiki, ledger, release note, README (#55)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Compact, read-only Abilities and Skills in the combat view (#62)

**Files:**
- Modify: `src/js/87-combat.js` (`syncStatLock()`; `fillCombatView()`, `sendCardHome()`), `src/js/00-constants.js` (`buildStats()`), `src/css/45-combat.css`
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`
- Docs: `src/docs/wiki/features/abilities-and-skills.md`, `features/combat-view.md`; ledger; `UNRELEASED.md`; `README.md`

**Interfaces:**
- Produces: `syncStatLock(root?)` — for each `[data-note="abilities"]`/`[data-note="skills"]` card under `root` (default `document`), sets `disabled` on its `input[data-path]` and `button.dot` to `!!card.closest("#cvList")`.

- [ ] **Step 1: Write the failing tests**

`src/tests/sheet.js`: add `'syncStatLock',` to the `loadApp([...])` names, and insert directly after
Task 2's block:

```js
/* ---- compact stats in the combat view are read-only (#62) ---- */
{
  /* two fake cards: closest('#cvList') follows each card's inView flag */
  const card = inView => {
    const c = {inView, ctls: [{disabled: false}, {disabled: false}, {disabled: false}]};
    c.closest = sel => (sel === '#cvList' && c.inView ? {} : null);
    c.querySelectorAll = sel => (sel === 'input[data-path],button.dot' ? c.ctls : []);
    return c;
  };
  const a = card(true), b = card(false);
  const doc = {querySelectorAll: sel => (sel === '[data-note="abilities"],[data-note="skills"]' ? [a, b] : [])};
  X.syncStatLock(doc);
  ck('inside the combat view the score boxes and proficiency dots are disabled', a.ctls.every(x => x.disabled === true));
  ck('...and at home they are not', b.ctls.every(x => x.disabled === false));
  X.syncStatLock(doc);
  ck('...and running it again changes nothing', a.ctls.every(x => x.disabled === true) && b.ctls.every(x => x.disabled === false));
  a.inView = false; b.inView = true;
  X.syncStatLock(doc);
  ck('a card that goes home is editable again, and one that comes in is locked',
     a.ctls.every(x => x.disabled === false) && b.ctls.every(x => x.disabled === true));
  ck('nothing to look in: nothing happens', (() => { try { X.syncStatLock({querySelectorAll: () => []}); return true; } catch (e) { return false; } })());
}
```

`src/tests/rules-data.js`: insert directly before the line `// ---------- the supplement packs (Xanathar's, Tasha's)`:

```js
// ---------- compact stats in the combat view stay in step (#62)
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const css = manifest.css.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const body = name => (js.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')) || [''])[0];
  ck('the view locks the stat controls when it fills', /syncStatLock\(\)/.test(body('fillCombatView')));
  ck('...unlocks them when a card goes home', /syncStatLock\(\)/.test(body('sendCardHome')));
  ck('...and re-applies the lock after the stats are rebuilt', /syncStatLock\(\)/.test(body('buildStats')));
  ck('the compact rules apply only inside the combat view',
     /#cvList \[data-note="abilities"\]/.test(css) && /#cvList \[data-note="skills"\]/.test(css) && /#cvList #statLegend\{display:none\}/.test(css));
}
```

(Check `src/manifest.json` names its CSS list `css`; use the key it has.)

- [ ] **Step 2: Run them to make sure they fail**

Run: `node src/tests/sheet.js | grep -E "^FAIL|Error" | head; ./build.sh --no-zip >/dev/null && node src/tests/rules-data.js | grep -E "^FAIL" | head`
Expected: a TypeError (`X.syncStatLock is not a function`), and FAIL on the four checks.

- [ ] **Step 3: The lock**

`src/js/87-combat.js`, directly after `emptyCombatView()`:

```js
/* The Ability Scores & Saves and Skills cards draw compact and read-only inside
   the view (#62): their score boxes and proficiency dots are disabled exactly
   while the card sits in #cvList, and enabled again at home. Idempotent. Runs
   after the view fills, after a card goes home, and after buildStats() redraws
   — a redraw with the view open builds fresh controls, which must come out
   locked. A value still opens its breakdown: that only reads. */
function syncStatLock(root){
  const d=root||document;
  d.querySelectorAll('[data-note="abilities"],[data-note="skills"]').forEach(card=>{
    const lock=!!(card.closest&&card.closest("#cvList"));
    card.querySelectorAll("input[data-path],button.dot").forEach(el=>{el.disabled=lock;});
  });
}
```

- `fillCombatView()`: directly before its `renderCombatEmpty();`, add `syncStatLock();`.
- `sendCardHome()`: as its last statement, add `syncStatLock();`.

`src/js/00-constants.js`, `buildStats()`: as its last statement, add
`syncStatLock();   /* in the combat view the stat controls are read-only (#62) */`.

- [ ] **Step 4: The look**

Append to `src/css/45-combat.css`:

```css

/* ---- compact stats (#62) ----
   Ability Scores & Saves and Skills, added to the view, draw condensed and
   read-only: syncStatLock() disables their score boxes and dots while they are in
   #cvList, and these rules shrink them and show the disabled score as a number. */
#cvList [data-note="abilities"] .abilities{grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
#cvList [data-note="abilities"] .ability{padding:6px 4px 7px}
#cvList [data-note="abilities"] .ability .n{font-size:9px}
#cvList [data-note="abilities"] .ability .m{font-size:22px;margin:2px 0 1px}
#cvList [data-note="abilities"] input[data-path]{border:0;background:none;box-shadow:none;padding:0;min-height:0;width:100%;
  text-align:center;font-size:12px;font-weight:600;color:var(--ink-soft);-webkit-text-fill-color:var(--ink-soft);opacity:1}
#cvList [data-note="abilities"] .ability .save{margin-top:4px;gap:4px}
#cvList [data-note="abilities"] .dot,#cvList [data-note="skills"] .dot{width:13px;height:13px;border-width:2px;cursor:default}
#cvList [data-note="skills"] .skills{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(6,auto);gap:0 14px}
#cvList [data-note="skills"] .srow{padding:2px 2px;gap:6px}
#cvList [data-note="skills"] .srow .val{font-size:14px;width:26px}
#cvList [data-note="skills"] .srow .lbl{font-size:13px}
#cvList #statLegend{display:none}
#cvList [data-note="abilities"] .agroups{gap:8px 12px}
#cvList [data-note="abilities"] .agroup .ahead{padding:3px 8px}
#cvList [data-note="abilities"] .agroup .ahead .m{font-size:18px}
#cvList [data-note="abilities"] .agroup .ahead input[data-path]{width:auto;flex:none}
#cvList [data-note="abilities"] .agroup .srow{padding:1px 2px}
#cvList [data-note="abilities"] .agroup .srow .val{font-size:13px;width:24px}
#cvList [data-note="abilities"] .agroup .srow .lbl{font-size:12.5px}
@media(max-width:640px){#cvList [data-note="skills"] .skills{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(9,auto)}}
@media(max-width:560px){#cvList [data-note="abilities"] .abilities{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:380px){#cvList [data-note="skills"] .skills{grid-template-columns:minmax(0,1fr);grid-template-rows:none;grid-auto-flow:row}}
```

- [ ] **Step 5: Build and run every suite; commit the code**

Run: `./build.sh --no-zip && ./src/tests/run.sh` — every suite passes.

```bash
git add src/js/87-combat.js src/js/00-constants.js src/css/45-combat.css src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat: Ability Scores and Skills draw compact and read-only in the combat view (#62)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Drive it**

1. **Before** (`main`'s build): `newCharacter("QA","dnd")`, add Ability Scores & Saves and Skills to the
   combat view with their swords buttons, open the view, shoot at 1280 and 390
   (`55-before-cv-stats-1280.png`, `55-before-cv-stats-390.png`).
2. **After** (the branch's build), the same: compact; the scores show as numbers, not boxes; the legend
   is gone. Shoot `55-after-cv-stats-1280.png` and `55-after-cv-stats-390.png`.
3. **Review Focus 5.** Click a score: nothing to type. Click a proficiency dot: it does not change.
   Click a modifier, a save and a skill value: each opens its breakdown. Tab through the cards:
   focus skips the scores and dots. Close the view: on the Sheet tab, type a score and cycle a dot —
   both work.
4. **Review Focus 4.** With the view open, switch Settings → This character → Skills display to
   "By ability": the Abilities card shows grouped and compact, still read-only (try typing and a
   dot), the Skills card is hidden. Shoot `55-after-cv-stats-grouped-1280.png` and `…-390.png`.
   Then switch to another character with the view open: its cards are compact and read-only too.
5. **The other skin:** a Humblewood character, the same two cards in the view, 1280 and 390
   (`55-after-cv-stats-hw-1280.png`, `55-after-cv-stats-hw-390.png`).

**Report:** shot paths, what you drove and saw, what you did not drive.

- [ ] **Step 7: Docs**

**Ledger.** Append:

```markdown
## Compact stats in the combat view (#62, 2026-10-06)

Ability Scores & Saves and Skills, added to the combat view with their own swords buttons, draw
compact and read-only there, as the quick view #62 asked for; the Sheet tab is unchanged.
`syncStatLock()` disables the two cards' score boxes and proficiency dots exactly while they sit in
`#cvList` — after the view fills, after a card goes home, and after `buildStats()` redraws (a redraw
with the view open builds fresh controls). The look is CSS under `#cvList [data-note="abilities"]`
and `#cvList [data-note="skills"]`: six abilities in a row (three on a phone), the score as a plain
number, skills in three columns (two, then one, as the screen narrows), the legend hidden; the
grouped display shrinks the same way. Tapping a value still opens its breakdown. Pages:
[abilities & skills](../wiki/features/abilities-and-skills.md), [combat view](../wiki/features/combat-view.md).
```

Take its line → `L<b>`.

**`abilities-and-skills.md`:** add `syncStatLock()` in `87-combat.js` to **Code:**; a paragraph
**In the combat view** (what the ledger entry says, present tense); a **Decisions** row for spec §2
decisions 7 and 8; History
`- 2026-10-06 — In the combat view the two cards draw compact and read-only. → ledger L<b>, #62`.

**`combat-view.md`:** in **Layout**, one sentence on the compact, read-only Abilities and Skills
cards (link [Abilities & skills](abilities-and-skills.md)); same History line.

**`decisions.md`:** one line per new Decisions row, under the Abilities & skills heading.

**`src/docs/UNRELEASED.md`**, under `## Pending`, after Task 4's bullet, spec §10's second bullet:

```markdown
- Ability Scores & Saves and Skills now draw as a compact, read-only quick view when you add them to
  the combat view, so your bonuses are easy to read mid-fight. Tap any value for its breakdown; edit
  them on the Sheet tab as before.
```

**`README.md`**, §5's ⚔️ Combat view: after the **Choosing sections** bullet, add
`- **Your bonuses at a glance.** Add Ability Scores & Saves and Skills and they show compact and read-only here; tap any value for its breakdown, and edit them on the Sheet tab.`

- [ ] **Step 8: Run every suite and commit the docs**

Run: `./build.sh --no-zip && ./src/tests/run.sh` — every suite passes, `docs` included.

```bash
git add src/docs/wiki src/docs/_claude/WIRING-LEDGER.md src/docs/UNRELEASED.md README.md
git commit -m "docs: compact stats in the combat view — wiki, ledger, release note, README (#62)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The branch check

**Files:**
- Modify: `src/docs/specs/2026-10-06-timed-conditions-design.md` (status line and As built)

- [ ] **Step 1: Every suite**

```bash
./build.sh --no-zip && ./src/tests/run.sh
[ -x .venv/bin/python ] && .venv/bin/python src/tests/humblewood-verbatim.py
```

- [ ] **Step 2: Byte hygiene and the branch's own files**

```bash
git diff --name-only main...HEAD | grep -E '^dist/|^docs/CHANGELOG\.md$' && echo "ARTIFACT COMMITTED — remove it from the branch" || echo "no artifacts"
git diff --name-only main...HEAD | grep -E '\.(js|css|html|md|json|py)$' | python3 -c "
import sys,re
bad=[]
for p in sys.stdin.read().split():
    try: b=open(p,'rb').read()
    except FileNotFoundError: continue
    t=b.decode('utf8')
    if b.startswith(b'\xef\xbb\xbf') or b'\r' in b or re.search('['+chr(0xE000)+'-'+chr(0xF8FF)+']',t) or not b.endswith(b'\n'): bad.append(p)
print('bad:',bad) if bad else print('bytes clean')"
```

Expected: `no artifacts` and `bytes clean`.

- [ ] **Step 3: Wiki lint**

Run `node src/tests/docs.js`. Then `grep -rn -i "timed condition" src/docs/wiki`: every hit states the
current truth (timed conditions exist; the round moves them).

- [ ] **Step 4: As built**

In the spec, change the status line to
`**Status:** implemented on branch \`issue/55-timed-conditions\` · 2026-10-06 — see As built at the end`, and append:

```markdown
## As built (2026-10-06)

Built as designed. Names the spec did not give: `STATUS_UNITS`, `statusDuration()`,
`statusElapsed()`, `statusTimed()`, `statusUnitFor()`, `fmtStatusTime()`, `statusTimeText()`,
`statusExpiredText()`, `tickStatuses()`, `restartStatus()`, `announceStatusExpiry()`,
`undoStatusExpiry()`, `stepStatusTap()` (in `40-sheet.js`), and `syncStatLock()` (in `87-combat.js`).
The timed-condition code lives beside the status row in `40-sheet.js`; no new fragment.
```

(If anything was built differently from the spec, add a numbered list of the differences here.)

- [ ] **Step 5: Commit**

```bash
git add src/docs/specs/2026-10-06-timed-conditions-design.md
git commit -m "docs: the timed-conditions spec as built (#55, #62)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Leave the merge to Mike's choice (WORKTREES §5). The merge message is
"Closes #55, closes #62." No release, and no `APP_VERSION` change.
