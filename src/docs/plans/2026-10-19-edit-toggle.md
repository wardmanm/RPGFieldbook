# Hideable Edit Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pencil toggle in the header of every list card that hides that card's edit, delete and
remove buttons, per card and per character, shown by default (#97).

**Architecture:**
- **One field, read through helpers.** `character.editHide` maps a card key to `true` when hidden;
  `editHidden(c,k)` reads it with `=== true`, so junk reads as shown.
- **CSS does the hiding.** Every edit/delete/remove button gains the class `ed`; a hidden card
  carries `ed-off`; `.ed-off .ed{display:none!important}`. No renderer reads the flag except the
  journal page's empty-state line.
- **The toggle mirrors `renderCombatToggles()`**: a pure `editToggleHTML()`, an idempotent
  `renderEditToggles()` that replaces only its own button, and an in-place repaint on tap.

**Tech Stack:** Plain ES2020 concatenated into one `<script>`, no modules; plain CSS on the theme
tokens; Node suites through `src/tests/harness.js`; the project's Playwright MCP (`mcp__playwright__*`)
for driven checks and screenshots.

**Spec:** `src/docs/specs/2026-10-19-edit-toggle-design.md`. Read it first; this plan argues from it.
[Sections & layout](../wiki/ui/sections-and-layout.md) describes the header-button pattern.

**Worktree:** `.claude/worktrees/97`, branch `issue/97-edit-toggle`. Create it from the repo root
before Task 1 with `./scripts/wt.sh add 97 edit-toggle`, then run every command below from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/97`.

## Global Constraints

**The build**
- One shipped file, built by concatenation: no `import`/`export`, no `type="module"`, no runtime
  dependency, no network. This branch adds no fragment.
- **Byte hygiene:** LF endings, one final newline, no BOM.
- **TDZ (ADR-001):** `blankChar()` runs at load in `00-constants.js`, so its default is a literal
  there. `EDIT_CARDS` is a top-level `const` in `87-notes.js`; nothing that runs at load may read it.
- **Before `rules-data.js` (or `run.sh`), build:** `./build.sh --no-zip`.

**Git and release**
- Branch commits carry source and docs only; never `git add` `dist/fieldbook.html` or
  `docs/CHANGELOG.md`. Always `git add` explicit paths.
- Never touch `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Character data**
- One new field, `editHide` (object, key → `true`), default `{}` in `blankChar()`, shape-guarded in
  `migrate()`, read only through `editHidden()` and written only through `setEditHidden()`.
- The keys are exactly `EDIT_CARDS`: `class`, `origin`, `statuses`, `attacks`, `resources`,
  `features`, `familiars`, `spells`, `inventory`, `trackers`, `journal`, `secnotes`.

**Markup safety**
- Every `${…}` inside a quoted HTML attribute value is `esc(…)` of the whole expression, or a
  ternary that can only yield literals (`rules-data.js` scans all of `src/js`).
- The new header button's class is `edbtn` and its attribute `data-edtoggle`. **Not** `editbtn` or
  `data-edit`: those already belong to the Story tab's bio Edit/Done buttons (`buildBio()`,
  `renderRT()`).

**The test harness**
- A suite names what it reads as `X.name` in its `loadApp([...])` list; every name must exist (a
  missing one is `LOAD FAIL`). Add a name only if it is not already in that suite's list.
- `X.character = c` sets the app's current character.
- Run one suite: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` (same
  for `rules-data.js`).

**Settled decisions (spec §2)**
- Hides edit, delete and remove only; one switch per card per character; shown by default.
- Every card with such buttons, the Rules tab's glossary entries excepted.
- CSS hides them; renderers only add the `ed` class.

## Review Focus

Inputs the spec implies but no task would otherwise test; each line's test is in the owning task.

1. **Junk inside `editHide`** (`"yes"`, `1`, `null` as a value, a key that is not a card) — reads as
   shown, and the unknown key survives a save and load untouched (Task 1).
2. **Switching character** from one with Features hidden to one without — the new character's
   cards must lose `ed-off` (Task 3: `renderEditToggles()` sets the class both ways, and Task 4
   drives it).
3. **A play control mistakenly tagged `ed`** — Use, Fire, Cast, a star, a pin or a −/+ vanishing
   with the edit buttons would break play (Task 2's scan checks them by attribute).
4. **The header's own note button and combat toggle** — must never carry `ed`, or hiding a card's
   edits would hide its note and combat controls (Task 2).
5. **The toggle on a card inside the combat view** — the card and its button move together, so a
   tap there must still find and repaint the one button (Task 4 drives it).

---

## File Structure

| File | Responsibility on this branch |
|---|---|
| `src/js/87-notes.js` | `EDIT_CARDS`, the read/write helpers, the toggle's text and markup, `editCard()`, `renderEditToggles()`, `paintEditToggle()`, `toggleEditCard()`; `noteEntryHTML()` gains `ed` |
| `src/js/00-constants.js` | `editHide:{}` in `blankChar()` |
| `src/js/71-char-io.js` | `editHide` in `migrate()`'s object-shape guard |
| `src/js/20-lists.js`, `40-sheet.js`, `50-classrace.js`, `60-attacks.js`, `65-resources.js`, `87-trackers.js`, `87-journal.js` | `ed` on each edit/delete/remove button; the journal page's empty line |
| `src/js/66-coins-hp.js` | `renderAll()` calls `renderEditToggles()` |
| `src/js/90-boot.js` | the `[data-edtoggle]` click |
| `src/html/60-journal.html` | `id="notesCard"` on the Section Notes card |
| `src/css/20-cards.css` | the toggle and the hiding rule |
| `src/tests/sheet.js`, `src/tests/rules-data.js` | the tests |
| docs | `sections-and-layout.md`, `character-model.md`, `journal.md`, the spec's As built, ledger, `UNRELEASED.md` |

---

### Task 1: The field, its helpers and the toggle's markup

**Files:**
- Modify: `src/js/00-constants.js` (`blankChar()`, beside `secNotes:{}, noteCollapse:{},`)
- Modify: `src/js/71-char-io.js:85` (the object-shape guard list)
- Modify: `src/js/87-notes.js` (a new section right after `renderNoteIcons()`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Produces: `EDIT_CARDS` (array of the 12 keys); `editHidden(c,k) → boolean`;
  `setEditHidden(c,k,hidden)`; `editCardTitle(k) → string`;
  `editToggleText(k,hidden) → {title,label}`; `editToggleHTML(k,hidden) → string`.

- [ ] **Step 1: Add the names to `loadApp`**

In `src/tests/sheet.js`'s `loadApp([...])` list, add
`'EDIT_CARDS', 'editHidden', 'setEditHidden', 'editCardTitle', 'editToggleText', 'editToggleHTML',`
on a line of its own after the line that contains `'combatToggleHTML'`.

- [ ] **Step 2: Write the failing tests**

Insert immediately before the block that begins `/* ---- the per-card toggle, and the view's header ---- */`:

```js
/* ---- hideable edit buttons: the field and the toggle (#97, spec §3, §5) ---- */
{
  ck('#97 a new character shows every card\'s edit buttons',
     JSON.stringify(X.blankChar().editHide) === '{}' && X.EDIT_CARDS.every(k => !X.editHidden(X.blankChar(), k)));
  ck('#97 the twelve cards', JSON.stringify(X.EDIT_CARDS) ===
     JSON.stringify(['class', 'origin', 'statuses', 'attacks', 'resources', 'features', 'familiars', 'spells', 'inventory', 'trackers', 'journal', 'secnotes']));
  ck('#97 a sheet from before, and junk, read as {}',
     JSON.stringify(X.migrate({abilities: {}}).editHide) === '{}' &&
     ['x', [], null, 7].every(v => JSON.stringify(X.migrate({abilities: {}, editHide: v}).editHide) === '{}'));
  const c = X.blankChar();
  X.setEditHidden(c, 'features', true);
  ck('#97 hiding is stored as true, and read back', c.editHide.features === true && X.editHidden(c, 'features') && !X.editHidden(c, 'inventory'));
  X.setEditHidden(c, 'features', false);
  ck('#97 showing again removes the key', !('features' in c.editHide) && !X.editHidden(c, 'features'));
  X.setEditHidden(c, 'portrait', true); X.setEditHidden(c, '__proto__', true);
  ck('#97 a key that is not a card is never written', JSON.stringify(c.editHide) === '{}');
  ck('#97 only a true value hides',
     ['yes', 1, null, {}].every(v => !X.editHidden({editHide: {features: v}}, 'features')) &&
     X.editHidden({editHide: {features: true}}, 'features'));
  ck('#97 a stored key that is not a card does nothing, and junk maps read as shown',
     !X.editHidden({editHide: {portrait: true}}, 'portrait') && !X.editHidden({editHide: 'x'}, 'features') && !X.editHidden(null, 'features'));
  const saved = Object.assign(X.blankChar(), {editHide: {inventory: true, portrait: true}});
  const back = X.migrate(JSON.parse(JSON.stringify(saved)));
  ck('#97 the field survives a save and load, an unknown key untouched',
     back.editHide.inventory === true && back.editHide.portrait === true && X.editHidden(back, 'inventory'));
  ck('#97 each card has a title',
     X.editCardTitle('features') === 'Features & Traits' && X.editCardTitle('journal') === 'Journal' &&
     X.editCardTitle('secnotes') === 'Section Notes' && X.EDIT_CARDS.every(k => X.editCardTitle(k)));
  const shown = X.editToggleHTML('features', false), hidden = X.editToggleHTML('features', true);
  ck('#97 the toggle carries its card and its state',
     shown.includes('data-edtoggle="features"') && shown.includes('aria-pressed="false"') && shown.includes('class="edbtn"') &&
     hidden.includes('aria-pressed="true"') && hidden.includes('class="edbtn on"'));
  ck('#97 it says what it will do, and to which card',
     shown.includes('title="Hide edit buttons"') && shown.includes('aria-label="Hide edit buttons — Features &amp; Traits"') &&
     hidden.includes('title="Show edit buttons"') && hidden.includes('aria-label="Show edit buttons — Features &amp; Traits"'));
  ck('#97 hidden wears a slash, shown does not', hidden.includes('M3 3l18 18') && !shown.includes('M3 3l18 18'));
  const t = X.editToggleText('trackers', true);
  ck('#97 the repaint text matches the markup', t.title === 'Show edit buttons' && t.label === 'Show edit buttons — Trackers');
  ck('#97 the toggle never uses the bio Edit button\'s names', !/editbtn|data-edit=/.test(shown + hidden));
}
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `LOAD FAIL` naming `EDIT_CARDS`.

- [ ] **Step 4: Implement**

In `src/js/00-constants.js`, `blankChar()`: the line `    secNotes:{}, noteCollapse:{},` becomes

```js
    secNotes:{}, noteCollapse:{},
    /* Cards whose edit/delete buttons the player has hidden (87-notes.js, #97):
       card key -> true. Read only through editHidden(). */
    editHide:{},
```

In `src/js/71-char-io.js` line 85, add `"editHide"` to the array, after `"noteCollapse"`:
`["featCollapse","invCollapse","atkCollapse","grantGold","hdUsed","secNotes","noteCollapse","editHide","journalCollapse","trackerCollapse","trackerTotals","ammoSpent"]`.

In `src/js/87-notes.js`, immediately after the closing `}` of `renderNoteIcons()`, insert:

```js

/* ================= hideable edit buttons (#97) =================
   A pencil in a list card's header hides that card's edit, delete and remove
   buttons. CSS does the hiding: each such button carries the class `ed`, a
   hidden card carries `ed-off`, and `.ed-off .ed` is display:none. So the
   renderers never read the flag and a card that rebuilds its rows stays hidden.
   Keys are NOTE_SECTIONS ids, plus the two cards outside that registry. */
const EDIT_CARDS=["class","origin","statuses","attacks","resources","features","familiars","spells","inventory","trackers","journal","secnotes"];
function editHideMap(c){const m=c&&c.editHide;return (m&&typeof m==="object"&&!Array.isArray(m))?m:{};}
/* `=== true`, so anything else a hand-edited file holds reads as shown. */
function editHidden(c,k){return EDIT_CARDS.includes(k)&&editHideMap(c)[k]===true;}
function setEditHidden(c,k,hidden){
  if(!c||!EDIT_CARDS.includes(k))return;
  if(!c.editHide||typeof c.editHide!=="object"||Array.isArray(c.editHide))c.editHide={};
  if(hidden)c.editHide[k]=true;else delete c.editHide[k];
}
function editCardTitle(k){return k==="journal"?"Journal":k==="secnotes"?"Section Notes":noteTitle(noteDef(k));}
/* The title is the action; the aria-label adds the card, as the combat toggle's does. */
function editToggleText(k,hidden){const title=hidden?"Show edit buttons":"Hide edit buttons";return {title,label:title+" — "+editCardTitle(k)};}
function editToggleSVG(hidden){
  return `<svg class="edicon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`+
    (hidden?`<path d="M3 3l18 18"/>`:"")+`</svg>`;
}
function editToggleHTML(k,hidden){
  const t=editToggleText(k,hidden);
  return `<button type="button" class="edbtn${hidden?" on":""}" data-edtoggle="${esc(k)}" aria-pressed="${hidden?"true":"false"}" aria-label="${esc(t.label)}" title="${esc(t.title)}">`+
    editToggleSVG(hidden)+`</button>`;
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `ALL PASSED`.

- [ ] **Step 6: Commit**

```bash
git add src/js/00-constants.js src/js/71-char-io.js src/js/87-notes.js src/tests/sheet.js
git commit -m "feat(#97): editHide, its helpers and the toggle's markup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The `ed` class on every edit, delete and remove button

**Files:**
- Modify: `src/js/20-lists.js` (`featItemHTML()`), `src/js/40-sheet.js` (`invItemHTML()`,
  `statusRowHTML()`, `renderFamiliars()`), `src/js/50-classrace.js` (`classChipHTML()`,
  `renderClassRace()`), `src/js/60-attacks.js` (`renderAttacks()`, `renderSpells()`),
  `src/js/65-resources.js` (the resource row), `src/js/87-trackers.js` (`trkEditHTML()`),
  `src/js/87-journal.js` (`journalPageHTML()`), `src/js/87-notes.js` (`noteEntryHTML()`)
- Test: `src/tests/rules-data.js`, `src/tests/sheet.js`

**Interfaces:**
- Consumes: `editHidden(c,k)` (Task 1), for the journal page's empty line.
- Produces: the class `ed` on exactly the buttons in the table below.

- [ ] **Step 1: Write the failing tests**

In `src/tests/rules-data.js`, insert immediately before the line
`// ---------- section notes: the registry IS the contract`:

```js
// ---------- #97: the edit/delete buttons a card's pencil hides carry `ed`, and nothing else does
// CSS hides them (`.ed-off .ed`), so the class IS the feature: a button without it
// never hides, and a play control with it vanishes mid-session. Scanned in the
// source because most of these rows are built straight into the DOM.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  // the class attribute of the <button> whose opening tag carries `attr=`
  const classesOf = attr => {
    const out = []; let at = js.indexOf(attr + '=');
    while (at >= 0) {
      const open = js.lastIndexOf('<button', at), close = js.indexOf('>', open);
      if (open >= 0 && close > at) {
        const m = /class="([^"]*)"/.exec(js.slice(open, at));
        out.push(m ? m[1] : '');
      }
      at = js.indexOf(attr + '=', at + 1);
    }
    return out;
  };
  const hasEd = cls => cls.split(/\s+/).includes('ed');
  const HIDDEN = ['data-edit-feature', 'data-del-feature', 'data-edit-item', 'data-del-item',
    'data-edit-status', 'data-del-status', 'data-edit-familiar', 'data-del-familiar',
    'data-del-class', 'data-del-race', 'data-del-bg', 'data-edit-attack', 'data-del-attack',
    'data-edit-spell', 'data-del-spell', 'data-res-edit', 'data-res-del', 'data-trkedit',
    'data-jnledit', 'data-jnldel', 'data-noteedit'];
  const KEPT = ['data-fav-feature', 'data-fav-item', 'data-fav-attack', 'data-usefeat', 'data-useitem',
    'data-cast-spell', 'data-prep', 'data-res-dec', 'data-res-inc', 'data-res-reset', 'data-trkdec',
    'data-trkinc', 'data-fitem', 'data-invitem', 'data-atkitem', 'data-notebtn', 'data-combatbtn',
    'data-edtoggle', 'data-edit-gloss', 'data-del-gloss', 'data-view-gloss', 'data-jnlback'];
  HIDDEN.forEach(a => {
    const cs = classesOf(a);
    ck('#97 every ' + a + ' button carries ed', cs.length > 0 && cs.every(hasEd), cs);
  });
  KEPT.forEach(a => {
    const cs = classesOf(a);
    ck('#97 no ' + a + ' button carries ed', cs.every(c => !hasEd(c)), cs);
  });
}
```

In `src/tests/sheet.js`, add `'noteEntryHTML'` and `'classChipHTML'` to the `loadApp` list if they are
not already there, and insert after the block added in Task 1:

```js
/* ---- hideable edit buttons: the rows (#97, spec §4, §6) ---- */
{
  const ed = (h, attr) => new RegExp('<button[^>]*class="[^"]*\\bed\\b[^"]*"[^>]*' + attr + '=').test(h);
  ck('#97 a feature row\'s edit and delete carry ed', ed(X.featItemHTML({id: 'f', name: 'Rage'}), 'data-edit-feature') && ed(X.featItemHTML({id: 'f', name: 'Rage'}), 'data-del-feature'));
  ck('#97 an item row\'s edit and delete carry ed', ed(X.invItemHTML({id: 'i', name: 'Rope'}), 'data-edit-item') && ed(X.invItemHTML({id: 'i', name: 'Rope'}), 'data-del-item'));
  ck('#97 a status row\'s edit and remove carry ed', ed(X.statusRowHTML({id: 's', name: 'poisoned'}), 'data-edit-status') && ed(X.statusRowHTML({id: 's', name: 'poisoned'}), 'data-del-status'));
  ck('#97 a class chip\'s Remove carries ed', ed(X.classChipHTML({name: 'Fighter', level: 3, subclass: null}, 0), 'data-del-class'));
  ck('#97 a tracker\'s pencil carries ed', ed(X.trkEditHTML({id: 't', name: 'Kills'}), 'data-trkedit'));
  ck('#97 a section note\'s pencil carries ed', ed(X.noteEntryHTML(X.noteDef('features')), 'data-noteedit'));
  const page = {id: 'p', title: 'x', text: ''};
  X.character = X.blankChar();
  ck('#97 a page\'s Edit and Delete carry ed', ed(X.journalPageHTML(page), 'data-jnledit') && ed(X.journalPageHTML(page), 'data-jnldel'));
  ck('#97 a blank page says tap Edit while Edit shows', X.journalPageHTML(page).includes('Nothing written yet — tap Edit.'));
  X.setEditHidden(X.character, 'journal', true);
  ck('#97 and only "Nothing written yet." while it is hidden',
     X.journalPageHTML(page).includes('Nothing written yet.') && !X.journalPageHTML(page).includes('tap Edit'));
  X.character = X.blankChar();
}
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `FAIL` lines for every `#97 every … carries ed`.
Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `FAIL` lines for the `#97 … carry ed` checks and the hidden page line.

- [ ] **Step 3: Implement**

Add the word `ed` to the end of the `class` attribute of each button below. Change nothing else
on these buttons.

| File | Function | Button (by attribute) | Class before → after |
|---|---|---|---|
| `20-lists.js` | `featItemHTML()` | `data-edit-feature` | `icon` → `icon ed` |
| `20-lists.js` | `featItemHTML()` | `data-del-feature` | `icon danger` → `icon danger ed` |
| `40-sheet.js` | `invItemHTML()` | `data-edit-item` | `icon` → `icon ed` |
| `40-sheet.js` | `invItemHTML()` | `data-del-item` | `icon danger` → `icon danger ed` |
| `40-sheet.js` | `statusRowHTML()` | `data-edit-status` | `icon` → `icon ed` |
| `40-sheet.js` | `statusRowHTML()` | `data-del-status` | `icon danger` → `icon danger ed` |
| `40-sheet.js` | `renderFamiliars()` | `data-edit-familiar` | `icon` → `icon ed` |
| `40-sheet.js` | `renderFamiliars()` | `data-del-familiar` | `icon danger` → `icon danger ed` |
| `50-classrace.js` | `classChipHTML()` | `data-del-class` | `icon danger` → `icon danger ed` |
| `50-classrace.js` | `renderClassRace()` | `data-del-race` | `icon danger` → `icon danger ed` |
| `50-classrace.js` | `renderClassRace()` | `data-del-bg` | `icon danger` → `icon danger ed` |
| `60-attacks.js` | `renderAttacks()` | `data-edit-attack` | `icon` → `icon ed` |
| `60-attacks.js` | `renderAttacks()` | `data-del-attack` | `icon danger` → `icon danger ed` |
| `60-attacks.js` | `renderSpells()` | `data-edit-spell` | `icon` → `icon ed` |
| `60-attacks.js` | `renderSpells()` | `data-del-spell` | `icon danger` → `icon danger ed` |
| `65-resources.js` | `renderResources()` | `data-res-edit` | `icon` → `icon ed` |
| `65-resources.js` | `renderResources()` | `data-res-del` | `icon danger` → `icon danger ed` |
| `87-trackers.js` | `trkEditHTML()` | `data-trkedit` | `icon` → `icon ed` |
| `87-journal.js` | `journalPageHTML()` | `data-jnledit` | `tbtn` → `tbtn ed` |
| `87-journal.js` | `journalPageHTML()` | `data-jnldel` | `tbtn danger` → `tbtn danger ed` |
| `87-notes.js` | `noteEntryHTML()` | `data-noteedit` | `icon` → `icon ed` |

`renderAttacks()`'s spell rows show Cast (`data-cast-spell`) where other rows show Edit; Cast keeps
its class. `60-attacks.js`'s `renderGloss()` (`data-edit-gloss`, `data-del-gloss`) is the Rules
tab's app-wide glossary and does **not** change (spec decision 4).

In `src/js/87-journal.js`, `journalPageHTML()`, the empty-state expression
`` `<div class="empty">Nothing written yet — tap Edit.</div>` `` becomes
`` `<div class="empty">${editHidden(character,"journal")?"Nothing written yet.":"Nothing written yet — tap Edit."}</div>` ``.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `ALL PASSED`.
Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `ALL PASSED`. If an existing test matched a button's exact old class string
(`class="icon" data-edit-…`), update that test's expected string to the new class, and say so in
your report.

- [ ] **Step 5: Commit**

```bash
git add src/js/20-lists.js src/js/40-sheet.js src/js/50-classrace.js src/js/60-attacks.js src/js/65-resources.js src/js/87-trackers.js src/js/87-journal.js src/js/87-notes.js src/tests/rules-data.js src/tests/sheet.js
git commit -m "feat(#97): the ed class on every edit, delete and remove button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The toggle in the header, the hiding rule, the tap

**Files:**
- Modify: `src/js/87-notes.js` (after Task 1's block)
- Modify: `src/js/66-coins-hp.js:266` (`renderAll()`)
- Modify: `src/js/90-boot.js` (the click handler, beside `[data-combatbtn]`)
- Modify: `src/html/60-journal.html` (the Section Notes card)
- Modify: `src/css/20-cards.css` (after the `.notebtn` rules)
- Test: `src/tests/rules-data.js`

**Interfaces:**
- Consumes: `EDIT_CARDS`, `editHidden`, `setEditHidden`, `editToggleHTML`, `editToggleText`,
  `editToggleSVG` (Task 1).
- Produces: `editCard(k) → Element|null`; `renderEditToggles()`; `paintEditToggle(k,hidden)`;
  `toggleEditCard(k)`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/rules-data.js`, add `'EDIT_CARDS'` to the `loadApp` list if it is not there, and
insert immediately after the block Task 2 added:

```js
// ---------- #97: every card key reaches a card, and the CSS hides what it should
{
  const t = loadHTML();
  const reach = k => k === 'journal' ? t.includes('id="journalCard"')
    : k === 'secnotes' ? /<div class="card" id="notesCard">\s*<div class="label">Section Notes/.test(t)
    : t.includes('<div class="card" data-note="' + k + '"');
  const lost = X.EDIT_CARDS.filter(k => !reach(k));
  ck('#97 every edit-toggle key reaches a card with a header', lost.length === 0, lost);
  const css = fs.readFileSync(path.join(ROOT, 'src/css/20-cards.css'), 'utf8');
  ck('#97 a hidden card hides its ed buttons', /\.ed-off \.ed\{display:none!important\}/.test(css));
  ck('#97 the toggle has its look', /\.label \.edbtn\{/.test(css) && /\.label \.edbtn\.on\{/.test(css));
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  ck('#97 a tap on the toggle is wired', boot.includes('[data-edtoggle]') && boot.includes('toggleEditCard('));
  const all = fs.readFileSync(path.join(ROOT, 'src/js/66-coins-hp.js'), 'utf8');
  ck('#97 renderAll() draws the toggles after the note icons', /renderNoteIcons\(\);renderEditToggles\(\);/.test(all));
}
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `FAIL` lines for the five `#97` checks above (`secnotes` named in the first).

- [ ] **Step 3: Implement**

In `src/html/60-journal.html`, the Section Notes card's opening `<div class="card">` (the one whose
label is `Section Notes`) becomes `<div class="card" id="notesCard">`.

In `src/js/87-notes.js`, after Task 1's `editToggleHTML()`:

```js
function editCard(k){
  return k==="journal"?document.getElementById("journalCard")
    :k==="secnotes"?document.getElementById("notesCard")
    :document.querySelector(`.card[data-note="${k}"]`);
}
/* Mirrors renderCombatToggles(): idempotent, replaces only its own button, and
   never label.innerHTML += (that re-parses the label and destroys #starBtn,
   #encPill and #roundNum). It sits before the combat toggle, or the note button
   when there is none, so the note keeps the far right. It also sets ed-off BOTH
   ways, so switching to a character who hides nothing clears the last one's. */
function renderEditToggles(){
  EDIT_CARDS.forEach(k=>{
    const card=editCard(k);if(!card)return;
    const hidden=editHidden(character,k);
    card.classList.toggle("ed-off",hidden);
    const label=card.querySelector(".label");if(!label)return;
    const html=editToggleHTML(k,hidden), old=label.querySelector("[data-edtoggle]");
    if(old){old.outerHTML=html;return;}
    const next=label.querySelector("[data-combatbtn]")||label.querySelector("[data-notebtn]");
    if(next)next.insertAdjacentHTML("beforebegin",html);else label.insertAdjacentHTML("beforeend",html);
  });
}
/* A tap repaints the one button in place; replacing it would drop keyboard focus
   from the button just pressed. */
function paintEditToggle(k,hidden){
  const b=document.querySelector(`[data-edtoggle="${k}"]`);if(!b)return;
  const t=editToggleText(k,hidden);
  b.classList.toggle("on",hidden);b.setAttribute("aria-pressed",hidden?"true":"false");
  b.setAttribute("aria-label",t.label);b.title=t.title;b.innerHTML=editToggleSVG(hidden);
}
function toggleEditCard(k){
  if(!EDIT_CARDS.includes(k))return;
  const hidden=!editHidden(character,k);
  setEditHidden(character,k,hidden);
  const card=editCard(k);if(card)card.classList.toggle("ed-off",hidden);
  paintEditToggle(k,hidden);
  if(k==="journal")renderJournal();   // a blank page's line names the Edit button
  scheduleSave();
}
```

In `src/js/66-coins-hp.js` line 266 (`renderAll()`), `renderNoteIcons();renderNotes();` becomes
`renderNoteIcons();renderEditToggles();renderNotes();`.

In `src/js/90-boot.js`, immediately before the line
`if((m=t.closest("[data-combatbtn]")))return toggleCombatSection(m.dataset.combatbtn,e.detail===0);`
insert:

```js
    if((m=t.closest("[data-edtoggle]")))return toggleEditCard(m.dataset.edtoggle);
```

In `src/css/20-cards.css`, immediately after the line
`.notebtn .noteicon{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2}` insert:

```css
/* ---- the edit-buttons toggle (#97) ----
   The .notebtn / .cvbtn state language: faint while the card's edit buttons show,
   accent while they are hidden, so a locked card is the one that stands out. It
   takes the margin-left:auto that parks the header's buttons at the far right;
   the combat toggle or note button after it then sits flush. */
.label .edbtn{background:none;border:0;cursor:pointer;padding:3px 4px;color:var(--hair);
  display:inline-flex;align-items:center;flex:none;margin-left:auto}
.label .edbtn.on{color:var(--accent)}
.label .edbtn:hover,.label .edbtn:focus-visible{color:var(--accent-2)}
.label .edbtn + .cvbtn,.label .edbtn + .notebtn{margin-left:0}
.edbtn .edicon{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2}
.ed-off .ed{display:none!important}
```

- [ ] **Step 4: Run every suite and make sure they pass**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: all suites pass. The `docs` suite needs the functions a wiki page names to exist; Task 4
names them, so it passes now and after.

- [ ] **Step 5: Commit**

```bash
git add src/js/87-notes.js src/js/66-coins-hp.js src/js/90-boot.js src/html/60-journal.html src/css/20-cards.css src/tests/rules-data.js
git commit -m "feat(#97): the pencil in each list card's header hides its edit buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Browser QA, docs, release note

**Files:**
- Modify: `src/docs/wiki/ui/sections-and-layout.md`, `src/docs/wiki/architecture/character-model.md`,
  `src/docs/wiki/features/journal.md`, `src/docs/specs/2026-10-19-edit-toggle-design.md` (an
  "As built" section), `src/docs/_claude/WIRING-LEDGER.md` (append), `src/docs/UNRELEASED.md`
- Screenshots: `.claude/qa/97-*.png` (ignored by git)

- [ ] **Step 1: Before shots**

Before shots need the code without this branch: build `main` into a scratch copy, as
`src/docs/wiki/process/screenshot-qa.md` describes for before/after, or use the screenshots of
`main` taken before Task 1 if the controller already made them. Shoot the Sheet, Spells, Inventory
and Journal tabs at 1280×900 on the default skin and the classic skin, on a character with a class,
a species, a background, two features, two items, a status, a familiar, a resource of the player's
own, a spell, a tracker, a journal page and a section note
(`newCharacter('QA', 'srd52')` then add them through the UI or `character` in `browser_evaluate`).

- [ ] **Step 2: After shots and driven checks**

With `./build.sh --no-zip` done in the worktree, open `dist/fieldbook.html` through the project's
Playwright MCP (`mcp__playwright__*`, never a plugin one) and:
1. The same four tabs, both skins: every card in spec §4 shows the pencil before its combat
   toggle/note icon. → `97-after-<tab>-<skin>.png`
2. Tap Features' pencil: its edit and delete vanish; stars, folds, Use, On/Off stay; the pencil
   turns accent with a slash. Tap again: they return. → `97-features-hidden.png`
3. Same for Inventory, Class (the chip's Remove), Trackers. → `97-<card>-hidden.png`
4. Hide Features, reload the page: still hidden. Open a second character with nothing hidden: its
   Features shows its buttons (Review Focus 2). → `97-switch.png`
5. Add Attacks to the combat view, enter it, tap Attacks' pencil there: the card's buttons hide and
   the pencil repaints (Review Focus 5). → `97-combat.png`
6. Hide Journal and open a blank page: "Nothing written yet." with no Edit/Delete. → `97-journal.png`
7. Keyboard: Tab to a pencil, press Enter: it toggles and focus stays on it.

Report every shot's path, and say plainly what was driven and what was not.

- [ ] **Step 3: Docs**

- `sections-and-layout.md`: a section "Hideable edit buttons (#97)": the pencil, `EDIT_CARDS` and
  its two non-registry keys, `editHide`, the `ed` / `ed-off` CSS rule, why CSS (spec decision 6),
  the header order (pencil, combat, note), the `edbtn`/`data-edtoggle` names and why not
  `editbtn`. History line citing the new ledger heading.
- `character-model.md`: `editHide` in the field list, default `{}`, guarded in `migrate()`. History
  line.
- `journal.md`: a blank page's line with the Journal's buttons hidden. History line.
- The spec: an "As built" section listing anything that differs from §1–§9, or "as specified".
- Ledger: append `## Hideable edit buttons (#97, <date>)` — what, why, the decisions, the files, the
  tests, what was driven — ending with a `Pages:` line linking the three pages. Then point each
  History line at that heading's line number (`grep -n '^## Hideable edit buttons' src/docs/_claude/WIRING-LEDGER.md`).
- `UNRELEASED.md`, under `## Pending`, one bullet: `- Every list card has a pencil in its header
  that hides its edit and delete buttons, so they stay out of the way in play.`

- [ ] **Step 4: Run every suite**

Run: `./build.sh --no-zip && PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh`
Expected: all suites pass (the `docs` suite checks every link, named function and ledger citation).

- [ ] **Step 5: Commit**

```bash
git add src/docs/wiki/ui/sections-and-layout.md src/docs/wiki/architecture/character-model.md src/docs/wiki/features/journal.md src/docs/specs/2026-10-19-edit-toggle-design.md src/docs/_claude/WIRING-LEDGER.md src/docs/UNRELEASED.md
git commit -m "docs(#97): hideable edit buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
