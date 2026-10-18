# Journal Checklists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Checklists and tasks leave the Trackers card for journal pages — a `[ ]`/`[x]` line is a
tickable checkbox in a page's read view and in every section note, the page list shows progress,
existing checklist and task trackers migrate into pages on load — and the counters that remain
show as tiles with an optional group total (#95, then #93, then #94).

**Architecture:**
- **The grammar** is one new block in `noteHTML()` (`87-notes.js`), plus three pure helpers beside
  it (`noteCheckboxes()`, `toggleCheckbox()`, `noteProgress()`), so every surface that renders notes
  gets the box and only two surfaces answer a tap.
- **Write-back** is one delegated click in `wire()` that finds the owner — the open journal page or a
  Section Notes entry — and rewrites one line of its text through `toggleCheckbox()`.
- **Trackers shrink to counters** in `87-trackers.js`; a pure `migrateTrackerPages()` beside them
  turns the old types into pages, called once from `migrate()`.
- **#93 and #94** touch only `87-trackers.js`, `47-journal.css`, `00-constants.js` (one default)
  and `90-boot.js` (one handler).

**Tech Stack:** Plain ES2020 concatenated into one `<script>`, no modules, no dependencies; plain
CSS on the theme tokens; Node suites through `src/tests/harness.js` (the real concatenation in a
VM, DOM stubbed); the project's Playwright MCP (`mcp__playwright__*`) for driven checks and
screenshots.

**Spec:** `src/docs/specs/2026-10-17-journal-checklists-design.md` (#95). The #93 and #94
decisions are the two rows for them in `src/docs/wiki/roadmap/1.9.0.md` ("Decisions made before
the specs"). Read both first; this plan argues from them.

**Worktree:** `.claude/worktrees/95`, branch `issue/95-journal-checklists`. Create it from the
repo root before Task 1 with `./scripts/wt.sh add 95 journal-checklists`, then run every command
below from `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/95`.

## Global Constraints

**The build**
- One shipped file, built by concatenation: no `import`/`export`, no `type="module"`, no runtime
  dependency, no network. Fragment order is `src/manifest.json`'s; this plan adds no fragment.
- **Byte hygiene:** LF endings, one final newline, no BOM, in every file touched. Private-use
  sentinels are written as escapes (`String.fromCharCode(0xE003)`), never literal characters.
- **TDZ (ADR-001):** `blankChar()` runs at load in `00-constants.js`, so a default it sets lives
  there. A later fragment's *functions* may be called from anywhere at runtime (they hoist); a
  top-level statement may not read a later fragment's `const`/`let`.
- **Before `rules-data.js` (or `run.sh`), build:** `./build.sh --no-zip`. One of its checks pins
  the assembled markup to `dist/fieldbook.html`.

**Git and release**
- **Branch commits carry source and docs only.** Never `git add` `dist/fieldbook.html` or
  `docs/CHANGELOG.md`; always `git add` explicit paths.
- Never touch `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

**Character data**
- `migrate()` copies every saved field over `blankChar()`; a new field is optional with a default
  there. **This branch adds one field, `trackerTotals` (#93), and removes two tracker types** (spec
  §3). Nothing else in the save format moves.
- `migrateTrackerPages()` is idempotent by construction (after it, no tracker has either type).

**Markup safety**
- **Every `${…}` inside a quoted HTML attribute value is `esc(…)` of the whole expression, or a
  ternary that can only yield literals.** `rules-data.js` tokenizes all of `src/js` and fails
  otherwise. Constants are escaped too (`${esc(n)}` for a number). A `querySelector` selector
  string is exempt, but a value from the player goes through `attrSel()`.
- A modal's title is plain text, never `esc()`'d.

**The test harness**
- `src/tests/sheet.js` names what it needs in `loadApp([...])`. **Every name there must exist**:
  a removed function left in the list fails the whole suite at load (`LOAD FAIL`), and a new
  function used by a test must be added to it.
- Run one suite with `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.
  `./src/tests/run.sh` runs them all (it rebundles first).

**Settled decisions (spec §2 and the 1.9.0 page)**
- Existing checklists and tasks migrate into pages; closed ones too, ticked, with their date.
- A checkbox is tickable in the read view of a journal page and of a section note.
- The page list shows "done/total" when a page has checkboxes.
- The editor gets Insert checkbox; `[]` is accepted as unchecked. No Enter-continues-the-list.
- Tasks migrate to one "Tasks" page per tag; a closed task's date goes on its line.
- #93: the total counts every counter with the tag, open or closed; the bare total in the header;
  a Σ button on the header; `trackerTotals[tagKey]`.
- #94: open groups become wrapping tiles; Completed stays rows.

## Review Focus

Inputs the spec implies but no task's tests would otherwise exercise; each line's test is added to
the owning task below.

1. **`[ ] **bold` on one checkbox line and `end**` on the next** — the old join-then-split
   rendering would carry a `<strong>` across two items. Each item is rendered on its own
   (Task 1), and a test holds two unbalanced items apart.
2. **A tick while another tab's render runs `renderJournal()` with the editor open** — the editor
   must never be rebuilt, and no `[data-ck]` exists while editing, so the handler must refuse when
   `jnlUI.editing` (Task 2).
3. **A page whose text has `\r\n` from a file** — `toggleCheckbox()` normalises and the
   ordinal still names the right line (Task 1).
4. **A closed checklist closed by hand with unticked items** — decision 3 says every item is
   ticked on migration; the test holds one such (Task 5).
5. **A Σ toggle pressed by keyboard** — the header's own `role="button"` keydown must not also
   fold the group, and the button's native click must not double-fire (Task 6).

---

## File Structure

| File | Responsibility on this branch |
|---|---|
| `src/js/87-notes.js` | `NOTE_CK`, `noteCheckboxes()`, `toggleCheckbox()`, `noteProgress()`; the checkbox block in `noteHTML()`; ☐/☑ in `notePreview()`; `noteToggleCheckbox()` (section notes write-back); Insert checkbox in `openNoteEditor()`; `NOTE_FMT_HINT` |
| `src/js/87-journal.js` | progress in `jnlEntryHTML()` and `journalPageHTML()`; `insertMarker()`, `insertCheckboxInto()`, `insertJournalCheckbox()`; `jnlToggleCheckbox()`; the editor button |
| `src/js/87-trackers.js` | counters only; `migrateTrackerPages()`; `trkTotalOn()`, `trkGroupTotal()`, `toggleTrkTotal()`; the Σ header; the tile markup is the row markup |
| `src/js/71-char-io.js` | `migrate()` calls `migrateTrackerPages()`; drops the `items` repair; guards `trackerTotals` |
| `src/js/00-constants.js` | `trackerTotals:{}` in `blankChar()` |
| `src/js/90-boot.js` | the `[data-ck]`, `[data-jnlck]`, `[data-trktotal]` handlers; the `[data-trkitem]`/`[data-trktask]` lines go; the group-header keydown ignores the Σ |
| `src/css/20-cards.css` | `.n-ck`, `.ck`, `.ck-t` |
| `src/css/47-journal.css` | the tick rules go; `.jnl-prog`; tiles; `.trk-sum`, `.trk-total` |
| `src/tests/sheet.js` | every pure assertion; the `loadApp` list |
| `src/tests/rules-data.js` | source guards: the handlers in `wire()`, the editor buttons, the CSS |
| docs | wiki pages, ledger, `UNRELEASED.md` (Task 8) |

---

### Task 1: The grammar — read, toggle, progress, render

**Files:**
- Modify: `src/js/87-notes.js` (after `NOTE_SENTINELS` on line 85; `noteHTML()` lines 114–159; `notePreview()` lines 199–215)
- Modify: `src/css/20-cards.css` (after line 71, `.n-ul li,.n-ol li{…}`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Produces: `noteCheckboxes(text) → [{line:number, checked:boolean, text:string}]`;
  `toggleCheckbox(text, n) → string`; `noteProgress(text) → {done:number, total:number}`;
  `noteHTML()` emits `<ul class="n-ck"><li><button … class="ck" role="checkbox" aria-checked data-ck="n"></button><span class="ck-t">…</span></li></ul>`.

- [ ] **Step 1: Add the three names to `loadApp`**

In `src/tests/sheet.js`, the line `'richHTML', 'richInline', 'noteHTML',` becomes:

```js
  'richHTML', 'richInline', 'noteHTML', 'noteCheckboxes', 'toggleCheckbox', 'noteProgress', 'notePreview',
```

- [ ] **Step 2: Write the failing tests**

In `src/tests/sheet.js`, insert immediately before the block that begins
`/* ---- the journal: its fields, and what migrate() does to them ----`:

```js
/* ---- checklists in a note: the grammar, the toggle, the count (#95)
   Design: src/docs/specs/2026-10-17-journal-checklists-design.md §4. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const h = X.noteHTML('[ ] find the map\n[x] cross the Mire\n- [] meet Brindle\n   * [X] pay him');
  ck('#95 checkbox lines become one list of four', (h.match(/<li>/g) || []).length === 4 && h.includes('<ul class="n-ck">'), h);
  ck('#95 each box is a checkbox button with its ordinal',
     /<button type="button" class="ck" role="checkbox" aria-checked="false" data-ck="0"/.test(h) &&
     /aria-checked="true" data-ck="1"/.test(h) && /aria-checked="false" data-ck="2"/.test(h) && /aria-checked="true" data-ck="3"/.test(h), h);
  ck('#95 the text follows the box, the bullet dropped', h.includes('<span class="ck-t">meet Brindle</span>') && !h.includes('- meet'));
  ck('#95 an unchecked box is labelled, and a checked one', h.includes('aria-label="Not checked"') && h.includes('aria-label="Checked"'));
  const txt = X.noteHTML('[x]y\nsee [x] mid-line\n[]\n[ ] \n> [ ] quoted');
  ck('#95 a marker glued to its text, mid-line, alone, or inside a quote is text', !txt.includes('n-ck') && !txt.includes('data-ck'), txt);
  const two = X.noteHTML('[ ] a\n[ ] b\n\nplain\n\n[x] c');
  ck('#95 two runs are two lists, ordinals continuing', (two.match(/<ul class="n-ck">/g) || []).length === 2 && two.includes('data-ck="2"'), two);
  const unb = X.noteHTML('[ ] **start\n[ ] end**');
  ck('#95 emphasis cannot span two items (each is rendered alone)', !/<strong>[^<]*<\/span><\/li>/.test(unb) && unb.includes('**start') && unb.includes('end**'), unb);
  const bul = X.noteHTML('- one\n- [ ] two\n- three');
  ck('#95 a checkbox line ends a bullet list and starts its own block', bul.indexOf('</ul>') < bul.indexOf('n-ck') && (bul.match(/<ul/g) || []).length === 3, bul);
  const hostile = X.noteHTML('[x] <script>alert(1)</script> "quoted"');
  ck('#95 the item text is escaped like any block', !hostile.includes('<script>') && hostile.includes('&lt;script&gt;'), hostile);
  ck('#95 no sentinel leaks', !/[-]/.test(h + two + unb));

  const list = X.noteCheckboxes('intro\n[ ] a\n\n- [x] b\n[X] c\nnot [ ] one');
  ck('#95 noteCheckboxes() lists the checkbox lines with their line numbers',
     same(list, [{line: 1, checked: false, text: 'a'}, {line: 3, checked: true, text: 'b'}, {line: 4, checked: true, text: 'c'}]), list);
  ck('#95 noteCheckboxes() and noteHTML() agree on the count', list.length === (X.noteHTML('intro\n[ ] a\n\n- [x] b\n[X] c\nnot [ ] one').match(/data-ck=/g) || []).length);
  const src = 'title\n  - [] a\n[x] b  \nplain **x**\n[X] c';
  ck('#95 toggleCheckbox() flips only the named line, normalising the marker',
     X.toggleCheckbox(src, 0) === 'title\n  - [x] a\n[x] b  \nplain **x**\n[X] c' &&
     X.toggleCheckbox(src, 1) === 'title\n  - [] a\n[ ] b  \nplain **x**\n[X] c' &&
     X.toggleCheckbox(src, 2) === 'title\n  - [] a\n[x] b  \nplain **x**\n[ ] c', X.toggleCheckbox(src, 0));
  ck('#95 ...every other byte stays', X.toggleCheckbox(src, 1).split('\n').filter((l, i) => i !== 2).join('\n') === src.split('\n').filter((l, i) => i !== 2).join('\n'));
  ck('#95 ...out of range returns the text as it was', X.toggleCheckbox(src, 9) === src && X.toggleCheckbox(src, -1) === src && X.toggleCheckbox(null, 0) === '');
  ck('#95 ...twice is the original, its marker normalised', X.toggleCheckbox(X.toggleCheckbox(src, 1), 1) === src &&
     X.toggleCheckbox(X.toggleCheckbox(src, 0), 0) === src.replace('- [] a', '- [ ] a'));
  ck('#95 CRLF text still names the right line, and comes back LF', X.toggleCheckbox('a\r\n[ ] b\r\n[ ] c', 1) === 'a\n[ ] b\n[x] c');
  ck('#95 noteProgress() counts', same(X.noteProgress('[x] a\n[ ] b\n[x] c'), {done: 2, total: 3}) &&
     same(X.noteProgress('no boxes'), {done: 0, total: 0}) && same(X.noteProgress(''), {done: 0, total: 0}));
  const pv = X.notePreview('[ ] find\n[x] found\n- bullet');
  ck('#95 the hover preview shows a box glyph, never a button', pv.includes('☐ find') && pv.includes('☑ found') && pv.includes('• bullet') && !pv.includes('<button'), pv);
}
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `LOAD FAIL` naming `noteCheckboxes` (the names are not defined yet). That is the
failure; the assertions run once Step 4 defines them.

- [ ] **Step 4: The helpers and the block**

In `src/js/87-notes.js`, directly after the line defining `NOTE_SENTINELS` (line 85), add:

```js
/* ---- checklists (#95) ----
   A line that starts `[ ]`, `[]`, `[x]` or `[X]`, a bullet before it allowed,
   with words after it, is a checkbox. One regex serves the renderer and the
   helpers, so they cannot disagree. Design: specs/2026-10-17-journal-checklists-design.md §4 */
const NOTE_CK=/^ {0,3}(?:[-*+] +)?\[( |x|X)?\] +(\S.*)$/;
/* the checkbox lines of a text, in order: their line index, state and words */
function noteCheckboxes(text){
  const lines=String(text==null?"":text).replace(/\r\n?/g,"\n").split("\n"),out=[];
  lines.forEach((l,i)=>{const m=NOTE_CK.exec(l);if(m)out.push({line:i,checked:/x/i.test(m[1]||""),text:m[2]});});
  return out;
}
/* the text with the n-th checkbox flipped — [ ] and [] to [x], [x] and [X] to
   [ ] — and every other byte as it was (CRLF normalised to LF, as noteHTML()
   reads it). Out of range: the text as given. */
function toggleCheckbox(text,n){
  const given=String(text==null?"":text),src=given.replace(/\r\n?/g,"\n"),lines=src.split("\n");
  const ck=noteCheckboxes(src)[n];
  if(!ck)return given;
  lines[ck.line]=lines[ck.line].replace(/\[( |x|X)?\]/,ck.checked?"[ ]":"[x]");
  return lines.join("\n");
}
function noteProgress(text){const l=noteCheckboxes(text);return {done:l.filter(x=>x.checked).length,total:l.length};}
```

In `noteHTML()`, replace the four lines from `const isUl=l=>…` through `const starts=l=>…` with:

```js
  const isCk=l=>NOTE_CK.exec(l);
  const isUl=l=>/^ {0,3}[-*+] +/.test(l);
  const isOl=l=>/^ {0,3}(\d{1,9})[.)] +/.exec(l);
  const isQ=l=>/^ {0,3}> ?/.test(l);
  const starts=l=>isHr(l)||isH(l)||isCk(l)||isUl(l)||isOl(l)||isQ(l);
  let ckN=0;   /* the ordinal of each checkbox in the WHOLE text: the write-back key */
```

and, inside the `while` loop, directly after the `if(h){…}` heading line and before `if(isUl(l)){`, add:

```js
    /* BEFORE bullets: "- [ ] x" begins like one. Each item is rendered on its
       own, not joined with NOTE_LB and split back: an emphasis opened on one
       item and closed on the next would otherwise carry a <strong> across two
       <li>s. Checklists are short, so the extra highlight() calls are cheap. */
    if(isCk(l)){
      const items=[];
      while(i<lines.length&&isCk(lines[i])){const m=isCk(lines[i]);items.push({on:/x/i.test(m[1]||""),t:m[2]});i++;}
      out.push(`<ul class="n-ck">`+items.map(x=>`<li><button type="button" class="ck" role="checkbox" aria-checked="${x.on?"true":"false"}" data-ck="${esc(ckN++)}" aria-label="${x.on?"Checked":"Not checked"}"></button><span class="ck-t">${noteInline(x.t)}</span></li>`).join("")+`</ul>`);
      continue;
    }
```

In `notePreview()`, the `.map(l=>l` chain gains a first replacement, before the heading one:

```js
  const lines=src.split("\n").map(l=>l
    .replace(/^ {0,3}(?:[-*+] +)?\[( |x|X)?\] +(?=\S)/,(m,x)=>(/x/i.test(x||"")?"☑ ":"☐ "))  /* checkbox -> ☐ / ☑ */
    .replace(/^ {0,3}#{1,6} +/,"")                    /* heading: keep the words */
```

(the rest of the chain is unchanged).

- [ ] **Step 5: The CSS**

In `src/css/20-cards.css`, directly after `.n-ul li,.n-ol li{margin:2px 0}` (line 71), add:

```css
/* a checklist in a note (#95): the box is a real button, the text beside it */
.n-ck{list-style:none;margin:0 0 8px;padding:0}
.n-ck li{display:flex;align-items:flex-start;gap:8px;margin:3px 0}
.ck{width:18px;height:18px;flex:none;margin-top:3px;padding:0;border-radius:4px;border:2px solid var(--line);background:var(--field);
  display:inline-grid;place-items:center;line-height:1;cursor:pointer;color:#fff;font:inherit}
.ck[aria-checked="true"]{background:var(--accent-2);border-color:var(--accent-2)}
.ck[aria-checked="true"]::after{content:"✓";font-size:12px;font-weight:700}
.ck:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}
.ck-t{flex:1;min-width:0;overflow-wrap:anywhere}
.ck[aria-checked="true"]+.ck-t{text-decoration:line-through;color:var(--ink-soft)}
```

- [ ] **Step 6: Run the tests**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `ALL PASSED (n)`. If `#95 emphasis cannot span two items` fails, the block is still
joining items — check Step 4's loop renders `noteInline(x.t)` per item.

Then: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"`
Expected: `ALL PASSED`. The attribute scan reads `data-ck="${esc(ckN++)}"` as escaped.

- [ ] **Step 7: Commit**

```bash
git add src/js/87-notes.js src/css/20-cards.css src/tests/sheet.js
git commit -m "feat(#95): checkbox lines in the notes grammar

A line starting [ ], [], [x] or [X] with words after it renders as a
checkbox button and its text; noteCheckboxes(), toggleCheckbox() and
noteProgress() read and flip the same lines. Nothing answers a tap yet.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Journal pages — progress, ticking, Insert checkbox

**Files:**
- Modify: `src/js/87-journal.js` (`jnlEntryHTML()` lines 129–135; `journalPageHTML()` 154–162; `journalEditorHTML()` 165–176; after `insertLine()` line 126; the DOM layer after `insertJournalStamp()` line 268)
- Modify: `src/js/90-boot.js` (the click chain, lines 43–49)
- Modify: `src/css/47-journal.css` (after `.jnl-when`, line 10)
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: `toggleCheckbox()`, `noteProgress()` (Task 1).
- Produces: `insertMarker(text, start, end, marker) → {text, caret}`; `insertCheckboxInto(id)`;
  `insertJournalCheckbox()`; `jnlToggleCheckbox(n) → boolean`; the hooks `data-jnlck` (editor
  button) and `[data-ck]` inside `#jnlBody`.

- [ ] **Step 1: Add the names to `loadApp`**

In `src/tests/sheet.js`, the line beginning `'jnlGroupOpen', 'jnlStampText', 'insertLine',` gains
`'insertMarker',` after `'insertLine',`.

- [ ] **Step 2: Write the failing tests**

In `src/tests/sheet.js`, at the END of the block `/* ---- the journal's markup ---- */` (before its
closing `}`), add:

```js
  // #95: progress on the row and the page, the editor's button
  const cl = {journal: [{id: 'q1', title: 'The lost map', tag: 'Quests', text: '[x] Find the map\n[ ] Cross the Mire\n[ ] Meet Brindle', at: 1, editedAt: 1},
                        {id: 'q2', title: 'No boxes', tag: 'Quests', text: 'prose', at: 2, editedAt: 2}], journalCollapse: {}};
  const lh = X.journalListHTML(cl, '');
  ck('#95 a page with checkboxes shows done/total on its row', /data-jnlopen="q1"><span class="jnl-title">The lost map<\/span><span class="jnl-prog">1\/3<\/span>/.test(lh), lh);
  ck('#95 ...and one without shows nothing new', (lh.match(/jnl-prog/g) || []).length === 1, lh);
  const ph = X.journalPageHTML(cl.journal[0]);
  ck('#95 the page view shows the count in its meta line and real boxes in its body',
     ph.includes('<span class="jnl-prog">1/3</span>') && /aria-checked="true" data-ck="0"/.test(ph) && /aria-checked="false" data-ck="2"/.test(ph), ph);
  ck('#95 the editor has Insert checkbox beside Insert timestamp',
     /data-jnlstamp>Insert timestamp<\/button><button type="button" class="tbtn" data-jnlck>Insert checkbox<\/button>/.test(X.journalEditorHTML({id: 'e', title: '', tag: '', text: ''}, [])));
  ck('#95 the formatting key mentions it', /\[ \]<\/b> checkbox/.test(X.NOTE_FMT_HINT), X.NOTE_FMT_HINT);
  // insertMarker: the caret lands AFTER the marker, on its line
  const M = '[ ] ';
  ck('#95 into an empty page: the marker, caret after it', JSON.stringify(X.insertMarker('', 0, 0, M)) === JSON.stringify({text: '[ ] ', caret: 4}));
  ck('#95 at the end of a line: on a new line', JSON.stringify(X.insertMarker('abc', 3, 3, M)) === JSON.stringify({text: 'abc\n[ ] ', caret: 8}));
  ck('#95 at the start of a line: no extra break', JSON.stringify(X.insertMarker('abc\ndef', 4, 4, M)) === JSON.stringify({text: 'abc\n[ ] def', caret: 8}));
  ck('#95 a selection is replaced', JSON.stringify(X.insertMarker('abcd', 1, 3, M)) === JSON.stringify({text: 'a\n[ ] d', caret: 6}));
```

And a new block for the DOM layer, inserted immediately before the block
`/* ---- trackers through their DOM layer: a tap, the close, the Undo ---- */`:

```js
/* ---- a tick in the page view writes the line back (#95) ---- */
{
  const c = X.blankChar(); X.character = c;
  c.journal = [{id: 'q1', title: 'Map', tag: '', text: '[ ] a\n[x] b', at: 1, editedAt: 1}];
  ctx.jnlOpen('q1');
  ck('#95 a tap flips the line, stamps editedAt and says it did',
     ctx.jnlToggleCheckbox(0) === true && c.journal[0].text === '[x] a\n[x] b' && c.journal[0].editedAt > 1, c.journal[0]);
  ck('#95 ...and back', ctx.jnlToggleCheckbox(0) === true && c.journal[0].text === '[ ] a\n[x] b');
  ck('#95 an ordinal that is not there changes nothing', ctx.jnlToggleCheckbox(7) === false && c.journal[0].text === '[ ] a\n[x] b');
  ctx.jnlEdit('q1');
  ck('#95 while the editor is open a tick is refused', ctx.jnlToggleCheckbox(0) === false && c.journal[0].text === '[ ] a\n[x] b');
  ctx.jnlDone();
  c.journal = [];
  ck('#95 a tick on a page deleted meanwhile changes nothing', ctx.jnlToggleCheckbox(0) === false);
}
```

Add `'jnlOpen', 'jnlEdit', 'jnlDone', 'jnlToggleCheckbox'` are reached through `ctx` (the VM
context), so they need no `loadApp` entry.

In `src/tests/rules-data.js`, find the block holding
`ck('the journal search has its clear button', boxed(html, 'jnlSearch'));` and add directly after it:

```js
  {
    const boot = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '90-boot.js'), 'utf8');
    ck('#95 a tap on a checkbox is wired, and finds its owner before acting',
       /t\.closest\("\[data-ck\]"\)[^\n]*jnlToggleCheckbox\(n\)[^\n]*noteToggleCheckbox\(/.test(boot), 'no [data-ck] handler in wire()');
    ck('#95 Insert checkbox is wired in the journal editor', /t\.closest\("\[data-jnlck\]"\)\)return insertJournalCheckbox\(\);/.test(boot));
  }
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `LOAD FAIL` on `insertMarker`.
Run: `node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"`
Expected: FAIL on both `#95 … wired` checks.

- [ ] **Step 4: The markup**

In `src/js/87-journal.js`, `jnlEntryHTML()` becomes:

```js
function jnlEntryHTML(p,q){
  const snip=q?jnlSnippet(p.text,q):"",pr=noteProgress(jnlStr(p.text));
  return `<button type="button" class="jnl-entry" data-jnlopen="${esc(p.id)}">`+
    `<span class="jnl-title">${esc(jnlTitle(p))}</span>`+
    (pr.total?`<span class="jnl-prog">${esc(pr.done+"/"+pr.total)}</span>`:"")+
    (jnlTime(p.at)?`<span class="jnl-when">${esc(fmtWhen(jnlTime(p.at)))}</span>`:"")+
    (snip?`<span class="jnl-snip">${snip}</span>`:"")+`</button>`;
}
```

`journalPageHTML()` becomes:

```js
function journalPageHTML(p){
  const when=jnlWhen(p),tag=tagLabel(p.tag),body=noteHTML(jnlStr(p.text)),pr=noteProgress(jnlStr(p.text));
  return `<div class="jnl-bar"><button type="button" class="tbtn" data-jnlback>← All pages</button><span class="grow"></span>`+
    `<button type="button" class="tbtn" data-jnledit="${esc(p.id)}">Edit</button>`+
    `<button type="button" class="tbtn danger" data-jnldel="${esc(p.id)}">Delete</button></div>`+
    `<h3 class="jnl-h" id="jnlHead" tabindex="-1">${esc(jnlTitle(p))}</h3>`+
    ((tag||when||pr.total)?`<div class="jnl-meta">${tag?`<span class="jnl-tag">${esc(tag)}</span>`:""}${pr.total?`<span class="jnl-prog">${esc(pr.done+"/"+pr.total)}</span>`:""}${when?`<span class="n-when">${esc(when)}</span>`:""}</div>`:"")+
    (body?`<div class="n-body">${body}</div>`:`<div class="empty">Nothing written yet — tap Edit.</div>`);
}
```

In `journalEditorHTML()`, the tools line becomes:

```js
    `<div class="jnl-tools"><button type="button" class="tbtn" data-jnlstamp>Insert timestamp</button><button type="button" class="tbtn" data-jnlck>Insert checkbox</button></div>`+
```

In `src/js/87-notes.js`, `NOTE_FMT_HINT` becomes:

```js
const NOTE_FMT_HINT=`<p class="hint">Formatting: <b>**bold**</b>, <b>*italic*</b>, <b>\`code\`</b>, <b>#</b> heading, <b>-</b> bullet, <b>1.</b> numbered, <b>[ ]</b> checkbox, <b>&gt;</b> quote, <b>---</b> divider. Rules terms you know stay tappable.</p>`;
```

- [ ] **Step 5: The helpers and the DOM layer**

In `src/js/87-journal.js`, directly after `insertLine()` (line 126), add:

```js
/* `marker` at the START of a line at the selection — the line the caret is on
   if it is at a line start, else a new line — with the caret right after the
   marker, since the next thing typed is the item (#95). insertLine() puts a
   whole line and moves on; this stays. */
function insertMarker(text,start,end,marker){
  const t=jnlStr(text),n=t.length;
  const s=Math.max(0,Math.min(n,num(start))),e=Math.max(s,Math.min(n,num(end)));
  const before=t.slice(0,s),after=t.slice(e);
  const ins=(before&&!before.endsWith("\n")?"\n":"")+marker;
  return {text:before+ins+after,caret:before.length+ins.length};
}
```

And after `insertJournalStamp()` (line 268), add:

```js
/* Insert checkbox, in whichever editor of this grammar (#95): the journal's
   #jnlText, the section-note modal's #noteText. The input event saves it. */
function insertCheckboxInto(id){
  const ta=document.getElementById(id);if(!ta)return;
  const r=insertMarker(ta.value,ta.selectionStart,ta.selectionEnd,"[ ] ");
  ta.value=r.text;ta.focus();ta.setSelectionRange(r.caret,r.caret);
  ta.dispatchEvent(new Event("input",{bubbles:true}));
}
function insertJournalCheckbox(){insertCheckboxInto("jnlText");}
/* A tap on the n-th checkbox of the OPEN page's read view flips that line in
   the text (toggleCheckbox()), stamps editedAt, saves and redraws, with focus
   back on the same box. Refused while editing (the text is in the textarea
   then, and no box is on screen), and when the page is gone. */
function jnlToggleCheckbox(n){
  if(!jnlUI.open||jnlUI.editing)return false;
  const p=jnlPages(character).find(x=>x.id===jnlUI.open);if(!p)return false;
  const cur=jnlStr(p.text),t=toggleCheckbox(cur,n);
  if(t===cur)return false;
  p.text=t;p.editedAt=Date.now();
  scheduleSave();renderJournal();
  const b=document.querySelector(`#jnlBody [data-ck="${num(n)}"]`);if(b&&b.focus)b.focus({preventScroll:true});
  return true;
}
```

- [ ] **Step 6: Wire it**

In `src/js/90-boot.js`, in the click chain, the line
`if(t.closest("[data-jnlstamp]"))return insertJournalStamp();` gains two lines after it:

```js
    if(t.closest("[data-jnlck]"))return insertJournalCheckbox();
    /* a checkbox in a rendered page or section note (#95): only those two
       surfaces answer it — a box drawn in an item description does nothing */
    if((m=t.closest("[data-ck]"))){const n=num(m.dataset.ck);if(m.closest("#jnlBody"))jnlToggleCheckbox(n);else{const ne=m.closest("#notesList .item"),ed=ne&&ne.querySelector("[data-noteedit]");if(ed)noteToggleCheckbox(ed.dataset.noteedit,n);}return;}
```

`noteToggleCheckbox()` arrives in Task 3; until then the section-notes branch calls a function
that does not exist yet, which the harness never reaches (it does not run `wire()`). Task 3 defines
it before anything is built for the browser. No keydown handler is needed: `.ck` is a real
`<button>`, so Enter and Space click it natively (the `.kw` spans needed one because they are spans).

- [ ] **Step 7: The CSS**

In `src/css/47-journal.css`, directly after the `.jnl-when{…}` line, add:

```css
.jnl-prog{font-family:var(--head);font-size:12px;font-weight:700;color:var(--accent-2);font-variant-numeric:tabular-nums;flex:none}
```

- [ ] **Step 8: Run the tests**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `ALL PASSED`.
Run: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"`
Expected: `ALL PASSED`.

- [ ] **Step 9: Commit**

```bash
git add src/js/87-journal.js src/js/87-notes.js src/js/90-boot.js src/css/47-journal.css src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#95): tick a checkbox in a journal page; progress on the list

A tap on a box in the page view rewrites its line and saves; the list row
and the page meta show done/total; the editor gains Insert checkbox.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Section notes — ticking and the editor button

**Files:**
- Modify: `src/js/87-notes.js` (the DOM layer: after `renderNotes()` line 275; `openNoteEditor()` lines 294–309)
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Consumes: `toggleCheckbox()` (Task 1), `insertCheckboxInto()` (Task 2), the `[data-ck]` handler's
  section-notes branch (Task 2) which calls `noteToggleCheckbox(k, n)`.
- Produces: `noteToggleCheckbox(k, n) → boolean`; `#noteCk` in the note editor.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, directly after the block added in Task 2 Step 2 (`/* ---- a tick in the
page view writes the line back (#95) ---- */`), add:

```js
/* ---- a tick in a section note writes back too (#95) ---- */
{
  const c = X.blankChar(); X.character = c;
  c.secNotes = {vitals: {text: '[ ] rest\n[x] eat', at: 1, editedAt: 1}};
  ck('#95 a section note renders its boxes', /aria-checked="false" data-ck="0"/.test(ctx.noteEntryHTML(ctx.noteDef('vitals'))));
  ck('#95 a tap flips the note\'s line and keeps its dates',
     ctx.noteToggleCheckbox('vitals', 0) === true && c.secNotes.vitals.text === '[x] rest\n[x] eat' && c.secNotes.vitals.at === 1 && c.secNotes.vitals.editedAt > 1, c.secNotes.vitals);
  ck('#95 an unknown section or ordinal changes nothing',
     ctx.noteToggleCheckbox('nope', 0) === false && ctx.noteToggleCheckbox('vitals', 5) === false && c.secNotes.vitals.text === '[x] rest\n[x] eat');
}
```

In `src/tests/rules-data.js`, inside the block added in Task 2 Step 2, add:

```js
    const notes = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '87-notes.js'), 'utf8');
    ck('#95 the section-note editor has Insert checkbox, wired to its own textarea',
       /id="noteCk">Insert checkbox<\/button>/.test(notes) && /getElementById\("noteCk"\)[^\n]*insertCheckboxInto\("noteText"\)/.test(notes));
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: FAIL `#95 a tap flips the note's line…` (TypeError: `noteToggleCheckbox` is not a
function, caught by `ck`'s own guard, or a thrown error — either way not `ALL PASSED`).
Run: `node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"`
Expected: FAIL on the editor check.

- [ ] **Step 3: Implement**

In `src/js/87-notes.js`, directly after `function renderNotes(){…}` (line 275), add:

```js
/* A tap on the n-th checkbox of a section note's entry on the Section Notes
   card flips that line (toggleCheckbox()) and saves through saveNote(), which
   keeps `at` and moves `editedAt`; the card and the hover previews redraw, and
   focus goes back to the same box (#95). */
function noteToggleCheckbox(k,n){
  if(!noteDef(k))return false;
  const cur=noteText(k),t=toggleCheckbox(cur,n);
  if(t===cur)return false;
  saveNote(k,t);scheduleSave();renderNotes();renderNoteIcons();
  const ed=document.querySelector(attrSel("data-noteedit",k)),row=ed&&ed.closest&&ed.closest(".item"),b=row&&row.querySelector(`[data-ck="${num(n)}"]`);
  if(b&&b.focus)b.focus({preventScroll:true});
  return true;
}
```

In `openNoteEditor()`, the template's `${NOTE_FMT_HINT}` line is preceded by a tools row, so the
lines read:

```js
      <textarea id="noteText" class="n-edit" placeholder="Anything you want to remember about this section…">${esc(noteText(k))}</textarea></div>
    <div class="jnl-tools"><button type="button" class="tbtn" id="noteCk">Insert checkbox</button></div>
    ${NOTE_FMT_HINT}
```

and after `const ta=document.getElementById("noteText");if(ta)ta.focus();` add:

```js
  document.getElementById("noteCk").addEventListener("click",()=>insertCheckboxInto("noteText"));
```

- [ ] **Step 4: Run the tests**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`.
Run: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"` → `ALL PASSED`.

- [ ] **Step 5: Commit**

```bash
git add src/js/87-notes.js src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#95): tick a checkbox in a section note

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Trackers keep counters only

**Files:**
- Modify: `src/js/87-trackers.js` (lines 13, 18, 22, 32–45, 59–60, 76–97, 122–149, 151–156, 178–194, 303–344)
- Modify: `src/js/90-boot.js` (the two `[data-trkitem]`/`[data-trktask]` lines, 53–54)
- Modify: `src/js/71-char-io.js` (lines 82–85, the `items` repair)
- Modify: `src/css/47-journal.css` (lines 36–46, the tick rules)
- Modify: `src/docs/wiki/features/journal.md` (the **Code** line only — the `docs` suite checks every named function exists)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Produces: `trkType(t) → "counter"` always; `trkProgress()` counter-only; `TRK_TYPES` is
  `[["counter","Counter"]]`; `trackerFormHTML()` has no `tkType`/`tkItems`; `trkFromForm(t, {name, tag, goal, autoClose})`.
  Removed: `trkItems()`, `trkToggleItem()`, `trkToggleTask()`, `mergeChecklist()`, `trkTickHTML()`,
  the hooks `data-trkitem`, `data-trktask`.

- [ ] **Step 1: Prune the `loadApp` list and the old assertions**

In `src/tests/sheet.js`, `loadApp`: remove `'trkItems'` (line 56), `'trkToggleItem', 'trkToggleTask'`
(57), `'mergeChecklist'` (58) and `'trkTickHTML'` (59).

In the block that starts `// reading junk` … `// layout` (lines 2603–2678), delete these assertions:
- `ck('a checklist counts its ticks, only a real true', …)` and the two `ck('...is complete when every item is ticked'…)`, `ck('...and never when it has no items'…)` that follow; and `ck('a task is done or not', …)`.
- From `t = {id: 'c', type: 'checklist', …}` through `ck('ticking a task closes it', …)` (lines 2634–2637).
- `ck('ticking an item that is not there changes nothing', …)` (2639–2640).
- The whole `// the form` run from `const items = [` through `ck('a reworded line loses its tick', …)` (2653–2660), and change the `trkFromForm` call on 2661 to
  `const f = X.trkFromForm({id: 'f', value: 7, closed: false}, {name: ' Read the Codex ', tag: ' Books ', goal: '5', autoClose: true});`
- `ck('an unknown type from the form is a counter', …)` (2664) becomes
  `ck('#95 whatever a form or file says, a tracker is a counter', X.trkFromForm({}, {type: 'x'}).type === 'counter' && X.trkType({type: 'checklist'}) === 'counter' && X.trkType({type: 'task'}) === 'counter');`

In the migrate block above it (lines 2578–2601): on 2588 drop `items: [], done: false,` from `t0`;
delete `ck('only item objects survive, each with an id', …)` and
`ck('an item id is unique across every tracker', …)` (2597–2599), and in `junk` (2591–2593) replace
the two trackers that carry `items` with `{name: 'no id'}, {id: 't'}, {id: 't'}` so the surviving
count is still 3 and the id checks still hold.

In `/* ---- the trackers' markup ---- */` (2680–2737): delete `quest`, `task` and `done`'s
definitions and replace `done` with `const done = {id: 'd1', name: 'Old quest', type: 'counter', value: 5, goal: 5, closed: true, closedAt: 50};`;
delete `r3`, `r4` and their four `ck`s (2697–2703); `ck('every row can be edited', …)` becomes
`[r1, r2].every(…)`; in the `c` fixture (2706) drop `quest, task,`; delete `ck('...and has no controls to change it', …)` (2715); `ck('what a closed tracker came to', …)` (2718–2719) becomes
`X.trkSummary(book) === '150 / 300' && X.trkSummary(kills) === '12' && X.trkSummary(done) === '5 / 5'`;
replace `fEd`'s two lines (2726–2728) with
`const fEd = X.trackerFormHTML(book, [], false);` and
`ck('#95 the form has no Type and no Items', !fEd.includes('id="tkType"') && !fEd.includes('id="tkItems"') && /id="tkGoal"[^>]*value="300"/.test(fEd), fEd);`;
in `evil` (2731) replace `type: 'checklist', … items: [{id: 'a"b', text: '<i>'}],` with `type: 'counter', value: '"><i>',` and in `all` (2732) drop the second `X.trackerRowHTML(Object.assign({}, evil, {type: 'counter'}))` term; the raw-check keeps `!all.includes('x"y')` and drops `&& !all.includes('a"b')`.

In the driven form test near line 4055, `fillForm` becomes
`const fillForm = name => [['tkName', name], ['tkTag', 'Kills'], ['tkGoal', '12']].forEach(([id, v]) => { el(id).value = v; });`

Leave the hostile fixture near line 3912 as it is: its `checklist` and `task` entries now exercise
Task 5's migration against hostile text, and its assertion (nothing raw) must keep holding.

- [ ] **Step 2: Run to see what fails**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `ALL PASSED` still — the list now names only what exists, and the code is unchanged. The
new `#95 the form has no Type and no Items` and `#95 whatever a form…` checks FAIL. That is the
red state.

- [ ] **Step 3: Shrink the model**

In `src/js/87-trackers.js`:

Line 13: `const TRK_TYPES=[["counter","Counter"]];` and the header comment's first sentence becomes
"Counters the player makes up, grouped by a tag of their choosing — kills by creature type, pages
of a book. (Checklists and tasks live in journal pages since #95.)"

Line 18: `function trkType(t){return "counter";}` with the comment `/* Every tracker is a counter since #95; a file's "checklist" or "task" migrates to a page (migrateTrackerPages()). */`

Delete line 22 (`trkItems`).

`trkProgress()` (lines 32–40) becomes:

```js
function trkProgress(t){
  const v=trkInt(t.value),g=trkInt(t.goal);
  return {done:v,total:g,pct:g?Math.min(100,Math.round(v*100/g)):0,complete:g>0&&v>=g};
}
```

Delete `trkToggleItem` and `trkToggleTask` (lines 59–60).

Delete `mergeChecklist()` and its comment (lines 76–86). `trkFromForm()` becomes:

```js
/* The form's fields onto a tracker. Never closes it, whatever the new goal. */
function trkFromForm(t,f){
  t.name=jnlStr(f.name).trim();
  t.type="counter";
  t.tag=tagLabel(f.tag);
  t.goal=trkInt(f.goal);
  delete t.items;delete t.done;
  t.autoClose=f.autoClose!==false;
  t.value=trkInt(t.value);
  return t;
}
```

- [ ] **Step 4: Shrink the markup and the form**

Delete `trkTickHTML()` and its comment (lines 124–130). `trackerRowHTML()` (131–149) becomes:

```js
function trackerRowHTML(t){
  const pr=trkProgress(t),name=trkName(t),g=trkInt(t.goal);
  const body=`<div class="trk-ctl"><button type="button" class="res-btn" data-trkdec="${esc(t.id)}" aria-label="${esc("One less — "+name)}">−</button>`+
    `<input class="trk-val" data-trkval="${esc(t.id)}" inputmode="numeric" value="${esc(pr.done)}" aria-label="${esc(name+" — count")}">`+
    `<button type="button" class="res-btn" data-trkinc="${esc(t.id)}" aria-label="${esc("One more — "+name)}">+</button>`+
    (g?`<span class="trk-of">of ${esc(g)}</span>`:"")+`</div>`+
    (g?`<div class="trk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${esc(g)}" aria-valuenow="${esc(Math.min(pr.done,g))}" aria-label="${esc(name)}"><span style="width:${esc(pr.pct)}%"></span></div>`:"");
  return `<div class="trk" data-trk="${esc(t.id)}"><div class="trk-top"><span class="trk-name">${esc(name)}</span>${trkEditHTML(t)}</div>${body}</div>`;
}
```

`trkSummary()` becomes:

```js
function trkSummary(t){const pr=trkProgress(t);return trkInt(t.goal)?pr.done+" / "+trkInt(t.goal):String(pr.done);}
```

`trackerFormHTML()` (178–194) becomes:

```js
/* Name and Tag side by side, then Goal; Close when complete only once there is a
   goal to complete. Close now / Reopen and Delete only for one that exists. */
function trackerFormHTML(t,tags,isNew){
  const g=trkInt(t.goal),auto=t.autoClose!==false;
  return `<div class="g2"><div class="field"><label class="f" for="tkName">Name</label><input id="tkName" value="${esc(jnlStr(t.name))}" placeholder="e.g. Goblins slain" autocomplete="off"></div>`+
    groupFieldHTML({id:"tkTag",list:"tkTags",label:"Tag",value:t.tag,choices:tags,placeholder:"e.g. Kills"})+`</div>`+
    `<div class="field"><label class="f" for="tkGoal">Goal</label><input id="tkGoal" type="number" min="0" inputmode="numeric" value="${esc(g||"")}" placeholder="None — count forever"></div>`+
    `<div class="toggle" id="tkAutoRow"><div><div class="t-lbl">Close when complete</div><div class="t-sub">Move it to Completed once it's done. You get an Undo.</div></div>`+
      `<button type="button" class="switch ${auto?"on":""}" id="tkAuto" role="switch" aria-checked="${auto?"true":"false"}" aria-label="Close when complete"></button></div>`+
    `<div class="m-actions">`+(isNew?"":`<button type="button" class="tbtn danger" id="tkDel" style="margin-right:auto">Delete</button>`+
      `<button type="button" class="tbtn" id="tkCloseNow">${t.closed===true?"Reopen":"Close now"}</button>`)+
    `<button type="button" class="tbtn" id="tkCancel">Cancel</button><button type="button" class="tbtn primary" id="tkSave">${isNew?"Add":"Save"}</button></div>`;
}
```

In `openTrackerForm()`: line 305's default becomes
`const t=existing||{id:uid(),name:"",type:"counter",tag:"",value:0,goal:0,autoClose:true,at:Date.now()};`;
replace the `sync` block (lines 308–315) with:

```js
  /* Close when complete only for one that can complete: a counter needs a goal. */
  const sync=()=>{$("tkAutoRow").hidden=!trkInt($("tkGoal").value);};
  $("tkGoal").addEventListener("input",sync);sync();
```

and `fields()` (323–324) becomes
`const fields=()=>({name:$("tkName").value,tag:$("tkTag").value,goal:$("tkGoal").value,autoClose:$("tkAuto").classList.contains("on")});`

- [ ] **Step 5: The hooks, the repair, the CSS, the wiki Code line**

`src/js/90-boot.js`: delete the two lines beginning `if((m=t.closest("[data-trkitem]")))` and
`if((m=t.closest("[data-trktask]")))`.

`src/js/71-char-io.js`: delete lines 82–85 (the comment beginning `/* A tick is found by its
item's id` through the `base.trackers.forEach(…items…)` line).

`src/css/47-journal.css`: delete from `.trk-items{…}` through `.trk-top .trk-tick{…}` (lines
36–46, the tick rules and their comments).

`src/docs/wiki/features/journal.md`, the **Code** line: remove `` `trkToggleItem()`, `trkToggleTask()` ``
and `` `mergeChecklist()` ``. (The prose is rewritten in Task 8; this keeps the `docs` suite green
meanwhile.)

- [ ] **Step 6: Run the tests**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`.
Run: `./build.sh --no-zip && ./src/tests/run.sh | tail -4` → every suite passing (private-data may
skip).

- [ ] **Step 7: Commit**

```bash
git add src/js/87-trackers.js src/js/90-boot.js src/js/71-char-io.js src/css/47-journal.css src/docs/wiki/features/journal.md src/tests/sheet.js
git commit -m "feat(#95): trackers keep counters only

Checklists and tasks leave the model, the row markup, the form and the
click chain; the item-id repair in migrate() goes with the field.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Migration — checklists and tasks become pages

**Files:**
- Modify: `src/js/87-trackers.js` (after `trkParse()`, the pure half)
- Modify: `src/js/71-char-io.js` (`migrate()`, after `base.trackers=repairIds(…)`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Consumes: `jnlStr()`, `jnlTime()`, `tagLabel()`, `groupByTag()`, `trkName()`, `uid()`.
- Produces: `migrateTrackerPages(c, now) → number` (how many trackers became pages).

- [ ] **Step 1: Add the name and write the failing tests**

In `src/tests/sheet.js`, `loadApp`: add `'migrateTrackerPages',` after `'trkFromForm',`.

Directly after the tracker migrate block (the one ending `ck('migrate() stays idempotent over trackers', …);` and the `// reading junk` section — i.e. insert a new block right before `/* ---- the trackers' markup ---- */`):

```js
/* ---- checklists and tasks become journal pages on load (#95, spec §5) ---- */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const D = new Date(2026, 9, 1, 12).getTime(), day = d => new Date(d).toLocaleDateString();
  const sheet = () => ({abilities: {}, journal: [{id: 'p0', title: 'Older', tag: '', text: 'x', at: 5, editedAt: 5}], trackers: [
    {id: 'c1', name: 'The lost map', type: 'checklist', tag: 'Quests', at: 100, items: [{id: 'i1', text: 'Find the map', done: true}, {id: 'i2', text: 'Cross the Mire', done: false}]},
    {id: 'c2', name: 'Done by hand', type: 'checklist', tag: 'quests', at: 200, closed: true, closedAt: D, items: [{id: 'i3', text: 'a', done: true}, {id: 'i4', text: 'b', done: false}]},
    {id: 'c3', name: 'Empty', type: 'checklist', tag: '', at: 300, items: []},
    {id: 't1', name: 'Pay Brindle', type: 'task', tag: 'Quests', at: 400},
    {id: 't2', name: 'Buy rope', type: 'task', tag: 'Shopping', at: 500, done: true, closed: true, closedAt: D},
    {id: 't3', name: 'Loose end', type: 'task', at: 600},
    {id: 't4', name: 'Second quest task', type: 'task', tag: 'quests', at: 50},
    {id: 'k1', name: 'Goblins', type: 'counter', tag: 'Kills', value: 3, at: 700}]});
  const m = X.migrate(sheet());
  ck('#95 every checklist and task leaves the trackers; the counter stays', same(m.trackers.map(t => t.id), ['k1']), m.trackers);
  const byTitle = t => m.journal.find(p => p.title === t);
  const map = byTitle('The lost map');
  ck('#95 an open checklist is a page: its name, tag, date and items',
     !!map && map.tag === 'Quests' && map.at === 100 && map.editedAt === 100 && map.text === '[x] Find the map\n[ ] Cross the Mire', map);
  const hand = byTitle('Done by hand');
  ck('#95 a closed checklist has every item ticked and a Closed line',
     !!hand && hand.text === '[x] a\n[x] b\n\nClosed ' + day(D) && hand.editedAt === D, hand);
  ck('#95 an empty checklist is a page with just its title', byTitle('Empty') && byTitle('Empty').text === '' && byTitle('Empty').tag === '');
  const tasks = m.journal.filter(p => p.title === 'Tasks');
  ck('#95 tasks become one Tasks page per tag, the untagged included', tasks.length === 3 && same(tasks.map(p => p.tag).sort(), ['', 'Quests', 'Shopping']), tasks.map(p => p.tag));
  const q = tasks.find(p => p.tag === 'Quests');
  ck('#95 ...one line per task, in the order they were made, dated by the oldest',
     !!q && q.text === '[ ] Second quest task\n[ ] Pay Brindle' && q.at === 50, q);
  const s = tasks.find(p => p.tag === 'Shopping');
  ck('#95 ...a closed task is ticked with its date on its line', !!s && s.text === '[x] Buy rope — closed ' + day(D) && s.editedAt === D, s);
  ck('#95 the pages that were there are untouched', m.journal[0].id === 'p0' && m.journal[0].text === 'x');
  ck('#95 new pages get fresh, unique ids', new Set(m.journal.map(p => p.id)).size === m.journal.length && m.journal.every(p => typeof p.id === 'string' && p.id));
  const again = X.migrate(JSON.parse(JSON.stringify(m)));
  ck('#95 running it again changes nothing', JSON.stringify(again) === JSON.stringify(m));
  ck('#95 a sheet with no such trackers is untouched', (() => { const c = {abilities: {}, trackers: [{id: 'k', type: 'counter', value: 1}], journal: []}; return X.migrateTrackerPages(c, 1) === 0 && c.journal.length === 0 && c.trackers.length === 1; })());
  const junk = X.migrate({abilities: {}, trackers: [{id: 'j', type: 'checklist', items: [null, 'str', {text: 7}, {done: true}], tag: 'constructor'}]});
  ck('#95 junk items are skipped or named, and a reserved tag reads as none',
     junk.trackers.length === 0 && junk.journal.length === 1 && junk.journal[0].text === '[ ] 7\n[x] Untitled' && junk.journal[0].tag === '', junk.journal);
  ck('#95 a sheet whose journal is not a list gets one', (() => { const c = {abilities: {}, journal: 'nope', trackers: [{id: 'x', type: 'task', name: 'a'}]}; X.migrateTrackerPages(c, 9); return Array.isArray(c.journal) && c.journal[0].at === 9; })());
}
```

- [ ] **Step 2: Run to make sure it fails**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `LOAD FAIL` on `migrateTrackerPages`.

- [ ] **Step 3: Implement**

In `src/js/87-trackers.js`, directly after `function trkParse(…)` (the end of the "reading one"
section), add:

```js
/* ---- checklists and tasks became journal pages (#95) ----
   Every tracker whose RAW type is checklist or task leaves `trackers` and
   becomes journal text (spec §5). A checklist is one page: its name, its tag,
   one "[ ]"/"[x]" line per item, and for a closed one every item ticked and a
   final "Closed <date>". Tasks are one "Tasks" page per tag, a line each, a
   closed one ticked with its date on the line. Idempotent by construction:
   afterwards no tracker has either type, so there is no pass counter to keep.
   Pure; migrate() (71-char-io.js) calls it after the list guards. Dates are
   written as the locale's date, not fmtWhen()'s relative "3h ago", which would
   freeze wrong on a page. */
function migrateTrackerPages(c,now){
  const all=Array.isArray(c.trackers)?c.trackers:[];
  const gone=all.filter(t=>t&&typeof t==="object"&&!Array.isArray(t)&&(t.type==="checklist"||t.type==="task"));
  if(!gone.length)return 0;
  if(!Array.isArray(c.journal))c.journal=[];
  const day=ts=>jnlTime(ts)?new Date(jnlTime(ts)).toLocaleDateString():"";
  const mark=on=>on?"[x] ":"[ ] ";
  gone.filter(t=>t.type==="checklist").forEach(t=>{
    const closed=t.closed===true,when=day(t.closedAt);
    const items=Array.isArray(t.items)?t.items.filter(i=>i&&typeof i==="object"&&!Array.isArray(i)):[];
    const lines=items.map(i=>mark(closed||i.done===true)+(jnlStr(i.text).trim()||"Untitled"));
    if(closed&&when){if(lines.length)lines.push("");lines.push("Closed "+when);}
    const at=jnlTime(t.at)||now;
    c.journal.push({id:uid(),title:trkName(t),tag:tagLabel(t.tag),text:lines.join("\n"),at,editedAt:jnlTime(t.closedAt)||at});
  });
  groupByTag(gone.filter(t=>t.type==="task"),t=>t.tag).forEach(g=>{
    const items=g.items.slice().sort((a,b)=>jnlTime(a.at)-jnlTime(b.at));
    const lines=items.map(t=>{const closed=t.closed===true,when=day(t.closedAt);return mark(closed||t.done===true)+trkName(t)+(closed&&when?" — closed "+when:"");});
    const ats=items.map(t=>jnlTime(t.at)).filter(Boolean),eds=items.map(t=>jnlTime(t.closedAt)||jnlTime(t.at)).filter(Boolean);
    c.journal.push({id:uid(),title:"Tasks",tag:g.key?g.label:"",text:lines.join("\n"),at:ats.length?Math.min.apply(null,ats):now,editedAt:eds.length?Math.max.apply(null,eds):now});
  });
  c.trackers=all.filter(t=>gone.indexOf(t)<0);
  return gone.length;
}
```

In `src/js/71-char-io.js`, directly after `base.trackers=repairIds(base.trackers.filter(x=>!Array.isArray(x)));`, add:

```js
  /* AFTER both repairs: checklists and tasks become journal pages (#95). The
     new pages take fresh uid()s, which cannot collide with a repaired one. */
  migrateTrackerPages(base,Date.now());
```

- [ ] **Step 4: Run the tests**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`.
The order-of-tasks check (`'[ ] Second quest task\n[ ] Pay Brindle'`) depends on the sort by `at`
inside each tag group; `groupByTag()` keeps the given order, so the sort in the implementation is
what makes it hold.
Run: `./build.sh --no-zip && ./src/tests/run.sh | tail -4` → all passing.

- [ ] **Step 5: Commit**

```bash
git add src/js/87-trackers.js src/js/71-char-io.js src/tests/sheet.js
git commit -m "feat(#95): existing checklists and tasks become journal pages on load

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: #93 — a group's total

**Files:**
- Modify: `src/js/00-constants.js` (`blankChar()`, line 79: `trackers:[], trackerCollapse:{}, showTrackers:true,`)
- Modify: `src/js/71-char-io.js` (the collapse-map guard list, the line beginning `["featCollapse","invCollapse",…`)
- Modify: `src/js/87-trackers.js` (after `trkGroupOpen()`; `trackersHTML()`; after `toggleTrkGroup()`)
- Modify: `src/js/90-boot.js` (the `[data-trkgroup]` click line, and the keydown line for it)
- Modify: `src/css/47-journal.css`
- Test: `src/tests/sheet.js`, `src/tests/rules-data.js`

**Interfaces:**
- Produces: `character.trackerTotals` (`{[tagKey]: true}`); `trkTotalOn(c, key) → boolean`;
  `trkGroupTotal(c, key) → number`; `toggleTrkTotal(key)`; the hook `data-trktotal` on a `<button>`
  inside the group header.

- [ ] **Step 1: Add the names and write the failing tests**

In `src/tests/sheet.js`, `loadApp`: add `'trkTotalOn', 'trkGroupTotal',` after `'trkGroupOpen',`.

At the END of the migrate block for trackers (before its `// reading junk` comment) add:

```js
  ck('#93 a new character has no totals switched on, and a junk map resets',
     same(X.blankChar().trackerTotals, {}) && same(X.migrate({abilities: {}, trackerTotals: 'yes'}).trackerTotals, {}) &&
     same(X.migrate({abilities: {}, trackerTotals: {kills: true}}).trackerTotals, {kills: true}));
```

At the END of the block ending with `ck('a tracker group nobody shut is open', …)` (the `// layout` section), add:

```js
  // #93 totals
  const T = {trackers: [{id: 'a', tag: 'Kills', value: 10}, {id: 'b', tag: 'kills', value: 5, closed: true, closedAt: 1}, {id: 'c', tag: 'Books', value: 99}, {id: 'd', tag: 'Kills', value: 'x'}], trackerTotals: {kills: true}};
  ck('#93 a total counts every counter with the tag, open or closed, junk as 0', X.trkGroupTotal(T, 'kills') === 15 && X.trkGroupTotal(T, 'books') === 99 && X.trkGroupTotal(T, '') === 0);
  ck('#93 the switch is read from trackerTotals, only a real true', X.trkTotalOn(T, 'kills') && !X.trkTotalOn(T, 'books') && !X.trkTotalOn({trackerTotals: {kills: 'yes'}}, 'kills') && !X.trkTotalOn({trackerTotals: []}, 'kills'));
```

In `/* ---- the trackers' markup ---- */`, after `ck('a shut group hides its trackers, still rendered', …)`, add:

```js
  const ht = X.trackersHTML({trackers: [kills, {id: 'k2', name: 'Orcs', tag: 'kills', value: 30, closed: true, closedAt: 1}], trackerTotals: {kills: true}}, false);
  ck('#93 a group with its total on reads it in the header, after the count',
     /<span class="cnt">\(1\)<\/span><span class="trk-total">· 42<\/span><button type="button" class="icon trk-sum on" data-trktotal="kills" aria-pressed="true"/.test(ht), ht);
  ck('#93 ...off, the header has the switch and no total', /data-trktotal="kills" aria-pressed="false"/.test(h) && !h.includes('trk-total'));
  ck('#93 the switch is named for a screen reader', ht.includes('aria-label="Hide the total for Kills"') && h.includes('aria-label="Show the total for Kills"'));
```

In the DOM-layer block `/* ---- trackers through their DOM layer…` add before its closing `}`:

```js
  ck('#93 toggling a total writes the map and back', (() => { ctx.toggleTrkTotal('kills'); const on = X.character.trackerTotals.kills === true; ctx.toggleTrkTotal('kills'); return on && !('kills' in X.character.trackerTotals); })());
```

In `src/tests/rules-data.js`, inside the `#95` block from Task 2, add:

```js
    ck('#93 the Σ button toggles the total, and the header fold ignores it, by click and by key',
       /t\.closest\("\[data-trktotal\]"\)[^\n]*toggleTrkTotal\(/.test(boot) &&
       /closest\("\[data-trkgroup\]"\)\)&&!t\.closest\("\[data-trktotal\]"\)/.test(boot) &&
       /closest\("\[data-trkgroup\]"\);if\(g&&!e\.target\.closest\("\[data-trktotal\]"\)\)/.test(boot));
```

- [ ] **Step 2: Run to make sure they fail**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `LOAD FAIL` on `trkTotalOn`.
Run: `node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"` → FAIL on `#93 the Σ button…`.

- [ ] **Step 3: The field**

`src/js/00-constants.js`, line 79 becomes:
`    trackers:[], trackerCollapse:{}, trackerTotals:{}, showTrackers:true,`
and the comment above it (lines 76–78) gains: "`trackerTotals` maps a tag key to `true` where the
group shows its total (#93)."

`src/js/71-char-io.js`: in the guard list add `"trackerTotals"` after `"trackerCollapse"`.

- [ ] **Step 4: The model and the header**

In `src/js/87-trackers.js`, directly after `function trkGroupOpen(…)`, add:

```js
/* ---- a group's total (#93) ----
   Every counter with the tag, open OR closed, so completing one never drops
   the total. Shown only where trackerTotals[key] is true (absent is off, the
   collapse-map convention); the key is tagKey(), "" for Untagged. */
function trkTotalOn(c,key){const m=c&&c.trackerTotals;return !!(m&&typeof m==="object"&&!Array.isArray(m)&&m[key]===true);}
function trkGroupTotal(c,key){return trkList(c).filter(t=>tagKey(t.tag)===key).reduce((s,t)=>s+trkInt(t.value),0);}
```

In `trackersHTML()`, the open-group header line
`` caret(o)+`<span class="fgname">${esc(g.label)}</span><span class="cnt">(${g.items.length})</span></div>`+ ``
becomes:

```js
      caret(o)+`<span class="fgname">${esc(g.label)}</span><span class="cnt">(${g.items.length})</span>`+
      (on?`<span class="trk-total">· ${esc(trkGroupTotal(c,g.key))}</span>`:"")+
      `<button type="button" class="icon trk-sum${on?" on":""}" data-trktotal="${esc(g.key)}" aria-pressed="${on?"true":"false"}" aria-label="${esc((on?"Hide":"Show")+" the total for "+g.label)}" title="Total">Σ</button></div>`+
```

with `const o=trkGroupOpen(c,g.key),on=trkTotalOn(c,g.key);` replacing `const o=trkGroupOpen(c,g.key);`.

Directly after `function toggleTrkGroup(key){…}`, add:

```js
function toggleTrkTotal(key){
  if(!character.trackerTotals||typeof character.trackerTotals!=="object"||Array.isArray(character.trackerTotals))character.trackerTotals={};
  if(character.trackerTotals[key]===true)delete character.trackerTotals[key];else character.trackerTotals[key]=true;
  renderTrackers();scheduleSave();
}
```

(`renderTrackers()` puts focus back on the Σ by its first `data-*` hook, as for every control.)

- [ ] **Step 5: Wire it, both ways**

In `src/js/90-boot.js`, the click line
`if((m=t.closest("[data-trkgroup]"))){toggleTrkGroup(m.dataset.trkgroup);return;}` becomes two lines:

```js
    if((m=t.closest("[data-trktotal]"))){toggleTrkTotal(m.dataset.trktotal);return;}
    if((m=t.closest("[data-trkgroup]"))&&!t.closest("[data-trktotal]")){toggleTrkGroup(m.dataset.trkgroup);return;}
```

and the keydown line
`{const g=e.target.closest&&e.target.closest("[data-trkgroup]");if(g){e.preventDefault();toggleTrkGroup(g.dataset.trkgroup);return;}}` becomes:

```js
    /* the Σ inside the header is a real button: Enter and Space click it natively, so the header must not also fold */
    {const g=e.target.closest&&e.target.closest("[data-trkgroup]");if(g&&!e.target.closest("[data-trktotal]")){e.preventDefault();toggleTrkGroup(g.dataset.trkgroup);return;}}
```

- [ ] **Step 6: The CSS**

In `src/css/47-journal.css`, after the trackers comment line (`/* ---- trackers ---- …`), add:

```css
.trk-total{font-family:var(--head);font-size:12px;font-weight:700;color:var(--accent-2);font-variant-numeric:tabular-nums;margin-left:4px}
.trk-sum{margin-left:auto;font-family:var(--head);font-weight:700;font-size:14px;color:var(--ink-soft);width:28px;height:28px}
.trk-sum.on{color:var(--accent-2)}
```

- [ ] **Step 7: Run the tests**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"` → `ALL PASSED`.
Run: `./build.sh --no-zip && ./src/tests/run.sh | tail -4` → all passing.

- [ ] **Step 8: Commit**

```bash
git add src/js/00-constants.js src/js/71-char-io.js src/js/87-trackers.js src/js/90-boot.js src/css/47-journal.css src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#93): a tracker group can show its total

A Σ on the group header switches it (trackerTotals[tagKey]); the total
counts every counter with the tag, open or closed.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: #94 — counters as tiles

**Files:**
- Modify: `src/css/47-journal.css` (the `.trk`, `.trk-group>.trk:last-child`, `.trk-top` rules)
- Test: `src/tests/rules-data.js`

**Interfaces:** none; the markup hooks are unchanged, so focus-restore, the `inPlace` patch and Undo
carry over.

- [ ] **Step 1: Write the failing test**

In `src/tests/rules-data.js`, inside the `#95` block from Task 2, add:

```js
    const jcss = require('fs').readFileSync(require('path').join(__dirname, '..', 'css', '47-journal.css'), 'utf8');
    ck('#94 open tracker groups are wrapping rows of tiles, and Completed stays a list',
       /\.trk-group\{display:flex;flex-wrap:wrap/.test(jcss) && /\.trk\{flex:1 1 150px;max-width:280px/.test(jcss) && /\.trk-done \.trk-group\{display:block\}/.test(jcss));
```

- [ ] **Step 2: Run to make sure it fails**

Run: `node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED"` → FAIL `#94 …`.

- [ ] **Step 3: The CSS**

In `src/css/47-journal.css`, replace the three lines

```css
.trk{padding:8px 2px;border-bottom:1px dotted var(--hair)}
.trk-group>.trk:last-child{border-bottom:0}
.trk-top{display:flex;align-items:center;gap:8px}
```

with:

```css
/* #94: an open group is a wrapping row of tiles — two across on a phone, four
   or five on a desktop; a lone tile never stretches the whole width. Completed
   is a record, not a dashboard, so it stays a list of rows. */
.trk-group{display:flex;flex-wrap:wrap;gap:8px;padding:6px 0 2px}
.trk{flex:1 1 150px;max-width:280px;padding:8px 10px;border:1.5px solid var(--hair);border-radius:10px;background:var(--field)}
.trk-top{display:flex;align-items:center;gap:8px}
.trk-done .trk-group{display:block}
.trk-done .trk{max-width:none;padding:8px 2px;border:0;border-bottom:1px dotted var(--hair);border-radius:0;background:none}
.trk-done .trk-group>.trk:last-child{border-bottom:0}
```

- [ ] **Step 4: Run the tests, build, and look**

Run: `./build.sh --no-zip && ./src/tests/run.sh | tail -4` → all passing.

Then, with the project's Playwright MCP (`mcp__playwright__browser_navigate` to
`file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/95/dist/fieldbook.html`):

1. `browser_evaluate`: `newCharacter("QA tiles","dnd"); character.trackers=[{id:"a",name:"Goblins",type:"counter",tag:"Kills",value:12},{id:"b",name:"Orcs",type:"counter",tag:"Kills",value:3,goal:10},{id:"c",name:"Wolves",type:"counter",tag:"Kills",value:7},{id:"d",name:"Codex",type:"counter",tag:"Books",value:150,goal:300},{id:"e",name:"Old",type:"counter",tag:"Kills",value:5,goal:5,closed:true,closedAt:Date.now()}]; character.trackerTotals={kills:true}; renderTrackers(); selectTab("journal");`
2. `browser_take_screenshot` → `.claude/qa/94-tiles-classic.png`; `browser_resize` to 390×844 and shoot `.claude/qa/94-tiles-phone.png` (expect two tiles per row, the Σ and total legible, the bar inside its tile).
3. Click `[data-trkcompleted]` and shoot `.claude/qa/94-completed.png` (rows, not tiles).
4. Repeat 1–2 with `newCharacter("QA tiles HW","humblewood")` → `.claude/qa/94-tiles-humblewood.png`.

Say in the commit body which of these you shot and what you saw. If a tile's `−`/count/`+` row
wraps at 390px, drop `.trk-val`'s width to 64px in the same commit and say so.

- [ ] **Step 5: Commit**

```bash
git add src/css/47-journal.css src/tests/rules-data.js
git commit -m "feat(#94): counters lay out as tiles in their group

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Browser QA, docs, release notes

**Files:**
- Modify: `src/docs/wiki/features/journal.md`, `src/docs/wiki/architecture/rich-text.md`,
  `src/docs/wiki/features/story-and-notes.md`, `src/docs/wiki/architecture/character-model.md`
  (if it lists `trackerCollapse`: add `trackerTotals` beside it — check with
  `grep -n trackerCollapse src/docs/wiki -r`), `src/docs/wiki/roadmap/known-issues.md`,
  `src/docs/wiki/roadmap/1.9.0.md`, `src/docs/specs/2026-10-17-journal-checklists-design.md`
  (Status line), `src/docs/_claude/WIRING-LEDGER.md`, `src/docs/UNRELEASED.md`
- Test: `node src/tests/docs.js`

- [ ] **Step 1: Drive #95 in the browser**

Navigate as in Task 7. Then:

1. `browser_evaluate`: `newCharacter("QA pages","dnd"); character.journal=[{id:"q1",title:"The lost map",tag:"Quests",text:"[ ] Find the map\n[x] Cross the **Mire**\n- [ ] Meet Brindle",at:Date.now()-86400000,editedAt:Date.now()-86400000}]; character.secNotes={vitals:{text:"[ ] Long rest tonight\n[x] Spent a Hit Die",at:Date.now(),editedAt:Date.now()}}; renderAll(); selectTab("journal");`
2. Shoot the list: `.claude/qa/95-list.png` — expect `1/3` on the row.
3. Click `[data-jnlopen="q1"]`, shoot `.claude/qa/95-page.png` — three boxes, the middle one checked, the bold Mire intact beside it, `1/3` in the meta.
4. Click `[data-ck="0"]`; `browser_evaluate` `character.journal[0].text` → expect it to start `[x] Find the map`; shoot `.claude/qa/95-page-ticked.png`; click `[data-jnlback]` and confirm the row now reads `2/3`.
5. Scroll to the Section Notes card; click its `[data-ck="0"]`; `browser_evaluate` `character.secNotes.vitals.text` → `[x] Long rest tonight\n[x] Spent a Hit Die`; shoot `.claude/qa/95-secnote.png`. Hover the Vitals note button on the Sheet tab (`selectTab("sheet")`, `browser_hover` `[data-notebtn="vitals"]`) and shoot `.claude/qa/95-preview.png` — ☑ glyphs, no buttons.
6. Back on Journal: click `[data-jnledit="q1"]`, click `[data-jnlck]`, `browser_evaluate` `document.getElementById("jnlText").value` → ends with `\n[ ] ` and `selectionStart === value.length`; type `Pay him`; click `[data-jnldone]`; expect a fourth box.
7. Migration: `browser_evaluate` `finishImport(migrate({id:"mig",name:"Migrated",abilities:{},trackers:[{id:"c1",name:"The lost map",type:"checklist",tag:"Quests",at:1,items:[{id:"i1",text:"Find the map",done:true},{id:"i2",text:"Cross the Mire",done:false}]},{id:"t1",name:"Pay Brindle",type:"task",tag:"Quests",at:2},{id:"t2",name:"Buy rope",type:"task",at:3,done:true,closed:true,closedAt:Date.now()}]}))`, `selectTab("journal")`, shoot `.claude/qa/95-migrated.png` — the Quests group holds "The lost map" (1/2) and "Tasks" (0/1); Untagged holds "Tasks" (1/1); the Trackers card is empty.
8. Open `+ Tracker`: shoot `.claude/qa/95-form.png` — Name, Tag, Goal, no Type.
9. Repeat 1–3 with `newCharacter("QA HW","humblewood")` → `.claude/qa/95-page-humblewood.png`; and once with the dark mode (`settings.mode="dark";saveSettings();applyTheme();`) → `.claude/qa/95-page-dark.png`.

Record in the ledger entry (Step 3) exactly which steps were driven and what was seen. Anything
that did not behave as written here is a bug to fix on this branch before Step 2, not a note.

- [ ] **Step 2: The wiki**

`src/docs/wiki/features/journal.md`:
- Intro: pages "can hold checklists"; beside them "**trackers**: counters the player makes up, grouped by tag" (no checklists or tasks).
- **Code** line: add `noteCheckboxes()`, `toggleCheckbox()`, `noteProgress()`, `noteToggleCheckbox()` (87-notes.js); `insertMarker()`, `insertCheckboxInto()`, `insertJournalCheckbox()`, `jnlToggleCheckbox()` (87-journal.js); `migrateTrackerPages()`, `trkTotalOn()`, `trkGroupTotal()`, `toggleTrkTotal()` (87-trackers.js); remove `trkItems()`, `trkTickHTML()`, `trkToggleItem()`, `trkToggleTask()`, `mergeChecklist()`, `trkPatchRow()` stays.
- **How it works → Pages**: a new paragraph **Checklists.** — the grammar (`[ ]`, `[]`, `[x]`, `[X]`, a bullet allowed, words required), the ordinal, the tap that rewrites the line through `toggleCheckbox()` and stamps `editedAt`, the `done/total` on the row and the meta line, Insert checkbox, and that it is refused while editing.
- **Trackers**: the type table becomes one row (counter); the list of fields loses `items` and `done`; add `trackerTotals`. A new paragraph **Tiles and totals (#93, #94).** — the wrapping row, two across on a phone, Completed as rows; the Σ, `trackerTotals[tagKey]`, every counter with the tag open or closed.
- A new paragraph **Sheets from before #95.** — `migrateTrackerPages()`: what a checklist becomes, what tasks become, closed ones, idempotent by construction.
- **Rules that must hold**: add "Only `migrateTrackerPages()` reads a tracker's raw `type`; everything else reads `trkType()`, which is `counter`." and "A tap on a checkbox rewrites one line and nothing else; `toggleCheckbox()` is the only writer." and "The Σ is a button inside the header: both the click and the keydown fold handlers ignore it."
- **Decisions**: a row per decision in spec §2 and the two 1.9.0 rows (#93, #94), in the page's table style.
- **Open**: the deferred line becomes "Trackers have no reset on a rest." (totals exist now); pages still don't print.
- **History** (today's date everywhere this plan writes one): `- <today> — Checklists and tasks leave trackers for journal pages: a [ ]/[x] line is a tickable checkbox in a page and a section note, the list shows progress, existing checklist and task trackers migrate into pages; Trackers keeps counters only (#95). Groups show an optional total (#93) and lay out as tiles (#94). → ledger L<n>, #95, #93, #94` with `L<n>` the heading line of Step 3's entry.

`src/docs/wiki/architecture/rich-text.md`: in §3 "Blocks, and the entry points", after the list of
blocks add the checkbox block (tested before bullets; one `noteInline()` per item, and why); in the
surfaces table, the Section notes and Journal pages rows gain "checkboxes tickable"; the **Code**
line adds `noteCheckboxes()`, `toggleCheckbox()`, `noteProgress()`; **Rules**: "A `[data-ck]` is
emitted wherever the grammar renders; only `#jnlBody` and `#notesList` answer it." History line.

`src/docs/wiki/features/story-and-notes.md`: in the Section Notes card's paragraph, one sentence:
a checkbox in a note is tickable on the card (`noteToggleCheckbox()`), writes back through
`saveNote()`, and the editor has Insert checkbox. History line.

`src/docs/wiki/roadmap/known-issues.md`: the Deferred line "Journal pages and trackers don't print;
trackers have no rest reset and no group totals" becomes "Journal pages and trackers don't print;
trackers have no rest reset". History line.

`src/docs/wiki/roadmap/1.9.0.md`: History line "— #95, #93 and #94 built (wave 1, worktree A)."

`src/docs/specs/2026-10-17-journal-checklists-design.md`: **Status:** "implemented on branch
`issue/95-journal-checklists` · <date>"; add an **As built** section at the end noting the two
departures: one `noteInline()` per item (§4.1's fallback, taken at plan time for the
emphasis-across-items case) and `toLocaleDateString()` rather than `fmtWhen()` for migrated dates
(a relative "3h ago" would freeze wrong on a page); and that no keydown handler was needed since
`.ck` is a `<button>`.

- [ ] **Step 3: The ledger and the release notes**

Append to `src/docs/_claude/WIRING-LEDGER.md` (after the last entry, no blank line before the heading, as the file does):

```markdown
## Journal checklists; trackers as counters, tiles and totals (#95, #93, #94, <today>)

1. Spec: `specs/2026-10-17-journal-checklists-design.md`; plan `plans/2026-10-17-journal-checklists.md`. One worktree, three issues, in that order.
2. The grammar (`87-notes.js`): `NOTE_CK`, a checkbox block in `noteHTML()` before bullets, one `noteInline()` per item; `noteCheckboxes()`, `toggleCheckbox()`, `noteProgress()`; ☐/☑ in the preview. CSS `.n-ck`/`.ck` in `20-cards.css`.
3. Write-back: one `[data-ck]` click in `wire()` → `jnlToggleCheckbox()` (the open page) or `noteToggleCheckbox()` (a Section Notes entry). No keydown: a `<button>` clicks natively. Progress `done/total` on the list row and the page meta. Insert checkbox in both editors (`insertMarker()`, caret after the marker).
4. Trackers keep counters only: types, items, the tick markup, the form's Type and Items, the two hooks, migrate()'s item repair, the tick CSS all gone. `migrateTrackerPages()` turns a file's checklists and tasks into pages (spec §5), dates as `toLocaleDateString()`, idempotent by construction.
5. #93: `trackerTotals[tagKey]`, Σ on the header, `trkGroupTotal()` over every counter with the tag, open or closed; the fold handlers ignore the Σ by click and by key. #94: `.trk-group` a wrapping row of `.trk` tiles; Completed stays rows.
6. Tests: `sheet.js` (grammar, toggle, progress, preview, page and note write-back, migration fixtures, counters-only form, totals), `rules-data.js` (the handlers, the editor buttons, the CSS). Driven in Playwright: <list the Task 8 Step 1 steps actually driven and what was seen>. Screenshots `.claude/qa/95-*`, `.claude/qa/94-*`, both skins, dark, 390px.

Pages: [journal](../wiki/features/journal.md), [rich text](../wiki/architecture/rich-text.md), [story & notes](../wiki/features/story-and-notes.md), [known issues](../wiki/roadmap/known-issues.md), [1.9.0](../wiki/roadmap/1.9.0.md)
```

Note its heading's line number (`grep -n "^## Journal checklists" src/docs/_claude/WIRING-LEDGER.md`) and put it in every History line from Step 2.

In `src/docs/UNRELEASED.md`, replace `_Nothing yet._` under `## Pending` with:

```markdown
- Journal pages can hold checklists: a line starting `[ ]` or `[x]` is a checkbox you can tick in
  the page itself, and the page list shows how many are done. Section notes do the same, and both
  editors have an Insert checkbox button. Checklist and task trackers you already had have moved
  into journal pages, ticks and dates included; Trackers now holds counters only.
- A tracker group can show the total of its counters: tap the Σ on the group's heading.
- Trackers lay out as tiles across the card instead of one long list.
```

- [ ] **Step 4: Run everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh | tail -6` → every suite passing (`docs` included;
it checks each History `L<n>` lands on the heading and every named function exists).

- [ ] **Step 5: Commit**

```bash
git add src/docs/wiki/features/journal.md src/docs/wiki/architecture/rich-text.md src/docs/wiki/features/story-and-notes.md src/docs/wiki/roadmap/known-issues.md src/docs/wiki/roadmap/1.9.0.md src/docs/specs/2026-10-17-journal-checklists-design.md src/docs/_claude/WIRING-LEDGER.md src/docs/UNRELEASED.md
git add src/docs/wiki/architecture/character-model.md 2>/dev/null || true
git commit -m "docs(#95, #93, #94): journal checklists, tiles and totals

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then stop. The branch is ready for Mike's QA and the wave-1 merge (`git merge --no-ff
issue/95-journal-checklists` on `main`, one branch per merge, then `./build.sh`). Do not merge,
build on `main`, or touch the version.
