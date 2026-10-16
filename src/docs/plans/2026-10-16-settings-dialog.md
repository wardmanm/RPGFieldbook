# Settings dialog redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Settings dialog becomes a sidebar of six categories beside one page at a time, every setting a row with its control in a right-hand column, the sidebar condensing to an icon rail when Icon tabs is on or the screen is narrow.

**Architecture:** A page registry (`SET_PAGES`) and small pure HTML helpers in `88-settings.js` replace the five folding sections. `openSettings()` builds the sidebar and every shown page into the dialog at once and shows one; every control keeps its id and handler. `openModal()` gains a `{wide:true}` option, and the layout is CSS in `50-modal.css`.

**Tech Stack:** Plain ES2020 JavaScript fragments concatenated into one HTML file (no modules), CSS, Node test suites (`src/tests/*.js`, run by `./src/tests/run.sh`), the project's Playwright MCP server for screenshots.

**Spec:** `src/docs/specs/2026-10-16-settings-dialog-design.md` (approved by Mike, 2026-10-16). Read it first; its §-numbers are cited below.

## Global Constraints

- **Work in the worktree** `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/107`, branch `issue/107-settings-dialog-update`. Run every command from there.
- **Never release.** No `./build.sh --release`, no `APP_VERSION`/`DATA_VERSIONS`/`CHANGELOG` edits, no tag, no push.
- **Branch commits carry `src/` only.** Never `git add dist/fieldbook.html` or `docs/CHANGELOG.md`; `git add` explicit paths; never `git stash`.
- Commit messages end with exactly: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- **One shipped file, no modules.** No `import`/`export`, no external URLs. Byte hygiene: LF, no BOM, no CR. Never write a backslash-u escape in any file.
- **Fresh worktree:** run `./src/tests/run.sh` once before running single suites; it bundles the packs `rules-data.js` reads (`dist/*_full.json`). To build for screenshots: `./build.sh --no-zip`.
- **`.m-body p` is `white-space:pre-wrap`:** keep every `<p>` in dialog markup on ONE source line.
- **What does not change (spec §1, §9):** what any setting does, which settings exist, when a change applies (instantly), the home screen's rules setup, the Credits text (word for word: CC BY 3.0 requires it).
- **Every control keeps its id** (`segSkin`, `segTheme`, `swRough`, `swTabIcons`, `swBackdrop`, `setSize`, `swCoinWeight`, `swHpColor`, `swTrackers`, `segStatStyle`, `segHdStyle`, `btnCharUpdate`, `srcList`, `newSrc`, `addSrc`, `btnFetchRules`, `btnImportRules`, `btnRulesTemplate`, `btnClearRules`, `rulesStatus`, `fileRules`, `rulesData`, `swHome`, `btnExportSettings`, `btnImportSettings`, `fileSettings`, `setImpStatus`, `encHint`) except `setEnc`, which becomes `segEnc` (spec §4). The wrapper keeps `id="setSections"`.
- **Values (spec):** sidebar order `appearance, display, carrying, rules, backup, credits`; titles `Appearance`, `Sheet display`, `Carrying`, `Rules data`, `Backup`, `Credits`; the dialog `width:min(820px,100%)`; the rail at `max-width:640px` or `html[data-tabs="icons"]`, 52px wide; `settings.setPage` default `"appearance"`.
- **Screenshots:** the project's `mcp__playwright__*` tools only, never `mcp__plugin_playwright_*`; shots in `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/` as `107-before-*.png` / `107-after-*.png`.

## Review Focus

1. **Arrow keys over a hidden page.** With no character open, ↑/↓ must step over Sheet display and Carrying, never land on a page that is not drawn. Pinned in Task 2 (`setPageStep()` over the shown keys) and Task 3 (the handler passes `pages.map(p=>p.k)`).
2. **A dialog opened from Settings, and back.** Import settings and the rules-update review replace the dialog; they must open at normal width, and returning to Settings must come back wide and on the same page. Pinned in Task 1 (`wide` reset on every open) and Task 3 (`openSettings()` passes `{wide:true}`; `askSettingsImport()` does not).
3. **A hostile or very long character name** in "For *name*": escaped, and wrapping rather than widening the page. Pinned in Task 2 (escaped subtitle) and Task 4 (`overflow-wrap:anywhere` on `.set-psub`, checked at 390px).
4. **A switch's state for a screen reader** after a tap: `aria-checked` must follow the visual state for every switch. Pinned in Task 3 (the wrapper's sync line) and driven in Task 4.
5. **The Rules data badge while another page shows:** an import, fetch or Clear all must update the count and the update dot even when Appearance is the visible page. Pinned in Task 3 (the existing fetch/clear/replace checks moved to the sidebar badge) and driven in Task 4.

---

### Task 1: `openModal()` takes `{wide:true}`

**Files:**
- Modify: `src/js/80-modal-forms.js` (the comment above `openModal`, and `openModal` itself)
- Modify: `src/css/50-modal.css` (after the `.modal{…}` rule)
- Test: `src/tests/rules-data.js` (the dismissal block, after the `...and the flyout still closes on a tap outside` check)

**Interfaces:**
- Produces: `openModal(title, html, icon, opts)`; `opts.wide === true` gives `.modal` the class `wide`; any other call removes it. CSS class `.modal.wide`.

- [ ] **Step 1: Write the failing test.** In `src/tests/rules-data.js`, find the line `  ck('...and the flyout still closes on a tap outside', /if\(t\.closest\("#tocBack"\)\)return closeToc\(\);/.test(js));` and add after it:

```js
  /* #107: Settings opens wide. The class is set or cleared on EVERY open, as the
     emblem slot is, so a dialog opened from Settings never inherits the width. */
  ck('openModal sets or clears the wide class on every open',
     /function openModal\(title,html,icon,opts\)\{[^\n]*\.classList\.toggle\("wide",!!\(opts&&opts\.wide\)\)/.test(js));
  ck('...and the wide dialog has its width',
     /\.modal\.wide\{width:min\(820px,100%\)\}/.test(fs.readFileSync(path.join(ROOT, 'src/css/50-modal.css'), 'utf8')));
```

- [ ] **Step 2: Run it to see it fail.** Run: `node src/tests/rules-data.js 2>&1 | grep -E "^FAIL|ALL PASSED"`. Expected: `FAIL  openModal sets or clears the wide class on every open` and `FAIL  ...and the wide dialog has its width`.

- [ ] **Step 3: Implement.** In `src/js/80-modal-forms.js` replace the line beginning `function openModal(title,html,icon){` with:

```js
function openModal(title,html,icon,opts){_dismissGuard=null;_dismissThen=null;const was=modal.classList.contains("open");document.getElementById("mTitle").textContent=title;const mi=document.getElementById("mIcon");if(mi)mi.innerHTML=icon||"";const box=modal.querySelector(".modal");if(box)box.classList.toggle("wide",!!(opts&&opts.wide));document.getElementById("mBody").innerHTML=html;modal.classList.add("open");modalTakeFocus(was);}
```

and append to the comment block directly above it (before its closing `*/`) the lines:

```
   `opts` is optional: {wide:true} widens the dialog (Settings, #107). Like the
   emblem, the class is set or cleared on EVERY open, so a dialog opened from a
   wide one comes up at the normal width.
```

In `src/css/50-modal.css`, after the line starting `.modal{background:var(--panel);`, add:

```css
/* Settings' sidebar needs room (#107); openModal() sets or clears it every open */
.modal.wide{width:min(820px,100%)}
```

- [ ] **Step 4: Run the tests.** Run: `node src/tests/rules-data.js 2>&1 | tail -1`, then `node src/tests/char-update.js 2>&1 | tail -1` (it opens modals through `openModal`). Expected: `ALL PASSED (…)` from both.

- [ ] **Step 5: Commit.**

```bash
git add src/js/80-modal-forms.js src/css/50-modal.css src/tests/rules-data.js
git commit -m "feat: openModal takes {wide:true}, reset on every open (#107)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The page registry and its pure helpers

Added **beside** the old `SET_SECTIONS` helpers, which Task 3 removes, so the app works after this task.

**Files:**
- Modify: `src/js/88-settings.js` (insert after the `setSecHTML` function; extend `SETTINGS_KEYS`)
- Modify: `src/js/00-constants.js` (the `settings` literal and the comment above it)
- Test: `src/tests/rules-data.js` (the `loadApp([...])` name list near the top; a new block after the `// ---------- Settings modal: collapsible sections` block, before `X.resetRules();` / `ck('entry count is zero with nothing loaded'`)

**Interfaces:**
- Produces (all in `88-settings.js`):
  - `SET_PAGES`: `[{k, title, scope:"app"|"char", icon}]`, `icon` being the inner SVG markup of a 24×24 stroked icon.
  - `setPageDef(k) → page|null`
  - `setPagesFor(hasChar:boolean) → page[]` (drops `scope:"char"` pages when false)
  - `setPageOf(stored, hasChar) → string` (the stored key if it is among the shown pages, else `"appearance"`)
  - `setPageStep(keys:string[], cur:string, key:string) → string` (`ArrowDown`/`ArrowUp` wrap, `Home`/`End`, anything else returns `cur`)
  - `setNavHTML(pages, active, badges) → string` (`badges` is `{k: innerHTML}`)
  - `setPageHTML(k, body, opts) → string` (`opts.active`, `opts.sub` plain text)
  - `setGroupHTML(title, body) → string` (title plain text)
  - `setRowHTML(name, help, control, inline) → string` (`name`/`help`/`control` are markup the caller has escaped)
  - `rulesNavBadgeHTML() → string`
  - `settings.setPage` (string, default `"appearance"`), `"setPage"` in `SETTINGS_KEYS`.

- [ ] **Step 1: Export the new names to the harness.** In `src/tests/rules-data.js`, in the `loadApp([` list, find `'SET_SECTIONS','setSecDef','setSecOpen','setSecHTML','rulesEntryCount','settings',` and add on the next line:

```js
  'SET_PAGES','setPageDef','setPagesFor','setPageOf','setPageStep','setNavHTML','setPageHTML','setGroupHTML','setRowHTML','rulesNavBadgeHTML','SETTINGS_KEYS',
```

- [ ] **Step 2: Write the failing tests.** In `src/tests/rules-data.js`, immediately before the line `X.resetRules();` that precedes `ck('entry count is zero with nothing loaded'`, insert:

```js
// ---------- Settings modal: the sidebar's pages (#107)
ck('six pages, in the order the sidebar lists them',
   X.SET_PAGES.map(p => p.k).join() === 'appearance,display,carrying,rules,backup,credits');
ck('every page has a title, an icon and a unique key',
   X.SET_PAGES.every(p => p.title && /<(path|circle|rect|ellipse)/.test(p.icon)) && new Set(X.SET_PAGES.map(p => p.k)).size === 6);
ck('only Sheet display and Carrying belong to a character',
   X.SET_PAGES.filter(p => p.scope === 'char').map(p => p.k).join() === 'display,carrying' &&
   X.SET_PAGES.every(p => p.scope === 'char' || p.scope === 'app'));
ck('without a character the character pages are not shown', X.setPagesFor(false).map(p => p.k).join() === 'appearance,rules,backup,credits');
ck('...with one, all six are', X.setPagesFor(true).length === 6);
ck('the remembered page opens', X.setPageOf('rules', false) === 'rules' && X.setPageOf('carrying', true) === 'carrying');
ck('a character page with no character open opens Appearance', X.setPageOf('display', false) === 'appearance');
[undefined, null, '', 'nope', 7, {}, '__proto__', 'constructor'].forEach(bad =>
  ck('a stored page of ' + JSON.stringify(bad) + ' opens Appearance', X.setPageOf(bad, true) === 'appearance'));
ck('setPageDef finds a page, and is null for rubbish', (X.setPageDef('rules') || {}).title === 'Rules data' && X.setPageDef('zzz') === null);
{
  const keys = ['appearance', 'rules', 'backup', 'credits'];
  ck('↓ moves to the next shown page and wraps', X.setPageStep(keys, 'rules', 'ArrowDown') === 'backup' && X.setPageStep(keys, 'credits', 'ArrowDown') === 'appearance');
  ck('↑ moves back and wraps', X.setPageStep(keys, 'rules', 'ArrowUp') === 'appearance' && X.setPageStep(keys, 'appearance', 'ArrowUp') === 'credits');
  ck('Home and End go to the ends', X.setPageStep(keys, 'backup', 'Home') === 'appearance' && X.setPageStep(keys, 'appearance', 'End') === 'credits');
  ck('any other key, or a page not shown, stays put', X.setPageStep(keys, 'rules', 'x') === 'rules' && X.setPageStep(keys, 'display', 'ArrowDown') === 'display');
}
{
  const nav = X.setNavHTML(X.setPagesFor(true), 'carrying', {rules: '<span class="set-cnt">12</span>'});
  ck('the sidebar is a vertical tab list', /role="tablist" aria-orientation="vertical"/.test(nav));
  ck('one tab per page, each tied to its panel',
     (nav.match(/role="tab"/g) || []).length === 6 && /id="setTab-carrying" data-setpage="carrying" aria-controls="setPage-carrying"/.test(nav));
  ck('only the active tab is selected and in the tab order',
     (nav.match(/aria-selected="true"/g) || []).length === 1 && /data-setpage="carrying"[^>]*aria-selected="true" tabindex="0"/.test(nav) &&
     (nav.match(/tabindex="0"/g) || []).length === 1);
  ck('each tab is named, for the icon rail', /aria-label="Sheet display" title="Sheet display"/.test(nav));
  ck('the character pages sit under their caption, set apart from the rest',
     nav.indexOf('data-setpage="appearance"') < nav.indexOf('This character') &&
     nav.indexOf('This character') < nav.indexOf('data-setpage="display"') &&
     /data-setpage="carrying"[\s\S]*?class="set-sep"[\s\S]*?data-setpage="rules"/.test(nav));
  ck('no caption without a character', !/This character|set-sep/.test(X.setNavHTML(X.setPagesFor(false), 'appearance', {})));
  ck('a badge is drawn only where given', /data-setbadge="rules"><span class="set-cnt">12<\/span>/.test(nav) && (nav.match(/data-setbadge/g) || []).length === 1);
}
{
  const page = X.setPageHTML('carrying', '<p>x</p>', {active: true, sub: 'For <b>Pib</b>'});
  ck('a page is the tab panel its tab names',
     /<section class="set-page" role="tabpanel" id="setPage-carrying" aria-labelledby="setTab-carrying" data-setpagebody="carrying">/.test(page), page);
  ck('...titled, with its subtitle escaped', /class="set-ptitle">Carrying</.test(page) && page.includes('For &lt;b&gt;Pib&lt;/b&gt;'));
  const off = X.setPageHTML('rules', '<p>y</p>', {});
  ck('an inactive page is in the dialog, hidden', /data-setpagebody="rules" hidden>/.test(off) && off.includes('<p>y</p>'));
  ck('an unknown page draws nothing', X.setPageHTML('zzz', '<p>x</p>', {active: true}) === '');
}
{
  const row = X.setRowHTML('Colour current HP', 'Amber at half.', '<button class="switch"></button>', true);
  ck('a row is the name and help, then the control',
     row === '<div class="set-row set-inline"><div class="set-row-txt"><div class="t-lbl">Colour current HP</div><div class="t-sub">Amber at half.</div></div><div class="set-row-ctl"><button class="switch"></button></div></div>', row);
  const plain = X.setRowHTML('Skin', '', '<div class="seg"></div>');
  ck('a row without help has no empty help line, and only an inline row is marked so', !/t-sub/.test(plain) && !/set-inline/.test(plain));
  ck('a group has its heading, escaped',
     X.setGroupHTML('Look & feel', '<p>r</p>') === '<div class="set-grp"><div class="set-grp-h">Look &amp; feel</div><p>r</p></div>');
}
ck('setPage is a setting a file is recognised by', X.SETTINGS_KEYS.includes('setPage'));
ck('...defaulting to Appearance',
   /let settings=\{[^\n]*setPage:"appearance"[^\n]*\};/.test(fs.readFileSync(path.join(ROOT, 'src/js/00-constants.js'), 'utf8')));
X.resetRules();
ck('the Rules data badge is empty with nothing loaded', X.rulesNavBadgeHTML() === '');
X.mergeRules({system: 'XPHB', spells: [{name: 'Bless'}, {name: 'Shield'}]}, 'x.json');
ck('...and counts the pool once something is', X.rulesNavBadgeHTML() === '<span class="set-cnt" title="2 entries">2</span>', X.rulesNavBadgeHTML());
```

- [ ] **Step 3: Run them to see them fail.** Run: `node src/tests/rules-data.js 2>&1 | grep -c "^FAIL"`. Expected: a non-zero count (the new names are undefined, so the harness may report `LOAD FAIL` or each check fails).

- [ ] **Step 4: Implement the registry and helpers.** In `src/js/88-settings.js`, directly after the closing `}` of `function setSecHTML(k,body,badge){…}`, insert:

```js
/* ---- the sidebar and its pages (#107) ----
   Six categories beside one page at a time, replacing the folding sections
   (spec src/docs/specs/2026-10-16-settings-dialog-design.md). `scope:"char"`
   pages exist only while a character is open. Icons are line drawings in the
   tab bar's style (24px, stroked), written here, not game-icons artwork, so
   they need no attribution. */
const SET_PAGES=[
  {k:"appearance",title:"Appearance",   scope:"app",
   icon:`<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>`},
  {k:"display",   title:"Sheet display",scope:"char",
   icon:`<path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>`},
  {k:"carrying",  title:"Carrying",     scope:"char",
   icon:`<path d="M12 4v16M7.5 20h9M5 7.5h14"/><path d="M5 7.5l-2.5 6a2.5 2.5 0 0 0 5 0z"/><path d="M19 7.5l-2.5 6a2.5 2.5 0 0 0 5 0z"/>`},
  {k:"rules",     title:"Rules data",   scope:"app",
   icon:`<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6"/><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>`},
  {k:"backup",    title:"Backup",       scope:"app",
   icon:`<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>`},
  {k:"credits",   title:"Credits",      scope:"app",
   icon:`<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.6a3.4 3.4 0 1 0 0 4.8"/>`}
];
function setPageDef(k){return SET_PAGES.find(p=>p.k===k)||null;}
function setPagesFor(hasChar){return SET_PAGES.filter(p=>hasChar||p.scope!=="char");}
/* the page to open: the remembered one while it is shown, else Appearance — so a
   character page remembered from a sheet never opens with no character */
function setPageOf(stored,hasChar){const p=setPagesFor(hasChar).find(x=>x.k===stored);return p?p.k:"appearance";}
/* ↑/↓ wrap, Home/End jump; `keys` are the SHOWN pages, so a hidden character
   page is never stepped onto */
function setPageStep(keys,cur,key){
  const i=keys.indexOf(cur);if(i<0)return cur;
  if(key==="ArrowDown")return keys[(i+1)%keys.length];
  if(key==="ArrowUp")return keys[(i-1+keys.length)%keys.length];
  if(key==="Home")return keys[0];
  if(key==="End")return keys[keys.length-1];
  return cur;
}
function setNavHTML(pages,active,badges){
  const b=badges||{};let n=0;
  return `<div class="set-nav" role="tablist" aria-orientation="vertical" aria-label="Settings">`+pages.map((p,i)=>{
    const on=p.k===active,first=p.scope==="char"&&(n++===0),last=p.scope==="char"&&(!pages[i+1]||pages[i+1].scope!=="char");
    return (first?`<div class="set-cap" aria-hidden="true">This character</div>`:"")+
      `<button type="button" class="set-tab" role="tab" id="setTab-${esc(p.k)}" data-setpage="${esc(p.k)}" aria-controls="setPage-${esc(p.k)}" aria-selected="${on?"true":"false"}" tabindex="${on?"0":"-1"}" aria-label="${esc(p.title)}" title="${esc(p.title)}">`+
      `<svg class="set-ico" viewBox="0 0 24 24" aria-hidden="true">${p.icon}</svg><span class="set-tlbl">${esc(p.title)}</span>`+
      (Object.prototype.hasOwnProperty.call(b,p.k)?`<span class="set-tbadge" data-setbadge="${esc(p.k)}">${b[p.k]}</span>`:"")+`</button>`+
      (last?`<div class="set-sep" aria-hidden="true"></div>`:"");
  }).join("")+`</div>`;
}
function setPageHTML(k,body,opts){
  const d=setPageDef(k);if(!d)return "";const o=opts||{};
  return `<section class="set-page" role="tabpanel" id="setPage-${esc(k)}" aria-labelledby="setTab-${esc(k)}" data-setpagebody="${esc(k)}"${o.active?"":" hidden"}>`+
    `<div class="set-ptitle">${esc(d.title)}</div>${o.sub?`<p class="set-psub">${esc(o.sub)}</p>`:""}${body}</section>`;
}
function setGroupHTML(title,body){return `<div class="set-grp"><div class="set-grp-h">${esc(title)}</div>${body}</div>`;}
/* one row: name and help on the left, the control on the right. `inline` keeps a
   switch beside its name on a narrow page; anything else drops below it there.
   name, help and control are MARKUP: the caller escapes what is dynamic. */
function setRowHTML(name,help,control,inline){
  return `<div class="set-row${inline?" set-inline":""}"><div class="set-row-txt"><div class="t-lbl">${name}</div>${help?`<div class="t-sub">${help}</div>`:""}</div><div class="set-row-ctl">${control}</div></div>`;
}
/* the Rules data tab's count, and a dot while a newer copy of a loaded pack is
   out; renderRulesData() keeps it current */
function rulesNavBadgeHTML(){
  const n=rulesEntryCount(),up=loadedRulesGroups().some(g=>dataStatus(g).state==="update");
  return (n?`<span class="set-cnt" title="${esc(rulesBadge())}">${n}</span>`:"")+(up?`<span class="set-dot" title="Newer rules data is out"></span>`:"");
}
```

In the same file, change the `SETTINGS_KEYS` line to:

```js
const SETTINGS_KEYS=["skin","theme","autoload","rough","rulesSources","rulesUrl","setCollapse","rulesCollapse","tabIcons","backdropClose","setPage"];
```

In `src/js/00-constants.js`, change the `let settings=` line to:

```js
let settings={skin:"humblewood",theme:"light",autoload:true,rough:true,rulesSources:[],setCollapse:{},tabIcons:false,backdropClose:false,setPage:"appearance"};
```

and in the comment directly above it, replace the sentence that begins `/* setCollapse: which Settings sections are folded shut` by reading the comment first and rewriting it to say: `setPage: the Settings page last viewed (#107). setCollapse is the fold state of the sections that page replaced; it is no longer read, and stays only because old settings files carry it.`

- [ ] **Step 5: Run the tests.** Run: `node src/tests/rules-data.js 2>&1 | grep -E "^FAIL|ALL PASSED"`. Expected: `ALL PASSED (…)`.

- [ ] **Step 6: Commit.**

```bash
git add src/js/88-settings.js src/js/00-constants.js src/tests/rules-data.js
git commit -m "feat: the Settings page registry and its pure helpers (#107)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `openSettings()` builds the sidebar and the pages

**Files:**
- Modify: `src/js/88-settings.js` (delete `SET_SECTIONS`, `setSecDef`, `setSecOpen`, `setSecHTML` and their header comment; rewrite the markup half of `openSettings()` and its section toggle; replace the `setEnc` handler)
- Modify: `src/js/89-rules-merge.js` (`renderRulesData()`'s badge refresh)
- Modify: `src/tests/rules-data.js` (remove the old section tests and names; update four existing checks; add the page-placement checks)
- Modify: `src/docs/wiki/features/settings-and-updates.md`, `src/docs/wiki/ui/sections-and-layout.md` (only the mentions of the removed functions, so the `docs` suite stays green; Task 5 rewrites the prose)

**Interfaces:**
- Consumes: everything Task 2 produces; `openModal(title, html, icon, {wide:true})` from Task 1.
- Produces: the DOM contract Task 4 styles — `#setSections.set-wrap` > `.set-nav[role=tablist]` (`.set-cap`, `.set-tab` > `.set-ico` + `.set-tlbl` + `.set-tbadge` > `.set-cnt`/`.set-dot`, `.set-sep`) and `.set-pages` > `section.set-page` > `.set-ptitle`, `p.set-psub`, `.set-grp` > `.set-grp-h` + `.set-row` (> `.set-row-txt` + `.set-row-ctl`), `.set-addsrc`, `.set-actions`, `.set-btns`, `p.set-note`.

- [ ] **Step 1: Write the failing tests.** In `src/tests/rules-data.js`:

(a) Delete the whole block that starts with the comment `// ---------- Settings modal: collapsible sections` and ends with the line `ck('badge text is escaped', X.setSecHTML('rules', '', '<img>').includes('&lt;img&gt;'));`, and in the `loadApp([` list delete `'SET_SECTIONS','setSecDef','setSecOpen','setSecHTML',` (keep `'rulesEntryCount','settings',`).

(b) Replace the check

```js
  ck('the Trackers switch is rendered in the "This character" settings section',
     /id="swTrackers"/.test((js.match(/const secCharacter=activeId\?`[\s\S]*?`:"";/) || [''])[0]) &&
```

with

```js
  ck('the Trackers switch is rendered on the Sheet display page',
     /id="swTrackers"/.test((js.match(/const secDisplay=hasChar\?[\s\S]*?:"";/) || [''])[0]) &&
```

and in the check just above it change the label `'the colour switch is in the "This character" settings section, per character'` to `'the colour switch is on the Sheet display page, per character'`.

(c) Replace the check that begins `  ck('...Settings has its switch, which saves it, and a settings file carries it',` (three regex lines) with:

```js
  ck('...Settings has its switch, which saves it, and a settings file carries it',
     /class="switch \$\{settings\.backdropClose===true\?"on":""\}" id="swBackdrop" role="switch" aria-checked="\$\{settings\.backdropClose===true\?"true":"false"\}"/.test(js) &&
     /getElementById\("swBackdrop"\)\.addEventListener\("click",e=>\{settings\.backdropClose=settings\.backdropClose!==true;[^\n]*saveSettings\(\);\}\)/.test(js) &&
     /const SETTINGS_KEYS=\[[^\]]*"backdropClose"/.test(js));
```

(d) In the fetch/clear/replace block (search for `const chip = {textContent: 'STALE'};`), make these exact edits:
- `const chip = {textContent: 'STALE'};` → `const chip = {innerHTML: 'STALE'};`
- `ctx.document.querySelector = sel => /data-setsec="rules"/.test(sel) && /fgcount/.test(sel) ? chip : null;` → `ctx.document.querySelector = sel => /data-setbadge="rules"/.test(sel) ? chip : null;`
- `const badge = () => { const n = X.rulesEntryCount(); return n ? n + ' entries' : 'none loaded'; };` → `const badge = () => X.rulesNavBadgeHTML();`
- every `chip.textContent = 'STALE';` → `chip.innerHTML = 'STALE';` (four places)
- `ck('fetch-all offline: the Rules data chip counts what is loaded', chip.textContent === badge(), [chip.textContent, badge()]);` → `ck('fetch-all offline: the Rules data badge counts what is loaded', chip.innerHTML === badge(), [chip.innerHTML, badge()]);`
- `ck('fetch-all: the Rules data chip counts the new pool', chip.textContent === badge() && badge() === '5 entries',` → `ck('fetch-all: the Rules data badge counts the new pool', chip.innerHTML === badge() && X.rulesEntryCount() === 5,` and on its next line `[chip.textContent, badge()]);` → `[chip.innerHTML, badge()]);`
- `ck('the Rules data chip follows Clear all', chip.textContent === 'none loaded', chip.textContent);` → `ck('the Rules data badge follows Clear all', chip.innerHTML === '', chip.innerHTML);`
- `ck('replace: the Rules data chip follows the new pool', chip.textContent === badge(), [chip.textContent, badge()]);` → `ck('replace: the Rules data badge follows the new pool', chip.innerHTML === badge(), [chip.innerHTML, badge()]);`

(e) After the block that ends `ck('every control it renders is wired up somewhere', unwired.length === 0, unwired);` and its closing `}`, add:

```js
// ---------- Settings modal: each control on its page (#107)
{
  const src = fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8');
  const sec = name => (src.match(new RegExp('const ' + name + '=[\\s\\S]*?\\n  const ')) || [''])[0];
  const on = (name, ids) => ids.every(id => sec(name).includes('id="' + id + '"'));
  ck('Appearance holds the look and the interface switches', on('secAppearance', ['segSkin', 'segTheme', 'swRough', 'swTabIcons', 'swBackdrop']));
  ck('Sheet display holds the card choices', on('secDisplay', ['segStatStyle', 'segHdStyle', 'swHpColor', 'swTrackers']));
  ck('Carrying holds size, encumbrance, coins and the live line', on('secCarrying', ['setSize', 'segEnc', 'swCoinWeight', 'encHint']));
  ck('Rules data holds the sources, the list and the sheet check', on('secRules', ['srcList', 'newSrc', 'btnFetchRules', 'btnClearRules', 'rulesData', 'btnCharUpdate']));
  ck('Backup holds the library and the settings file', on('secBackup', ['swHome', 'btnExportSettings', 'btnImportSettings', 'setImpStatus']));
  ck('encumbrance is a segmented choice now, not a dropdown', !/id="setEnc"/.test(src) &&
     /character\.encumbrance=b\.dataset\.enc;/.test(src) && ['none', 'standard', 'variant'].every(v => sec('secCarrying').includes('["' + v + '",')));
  ck('every switch on the dialog says its state to a screen reader',
     (src.match(/class="switch /g) || []).length === 6 && (src.match(/role="switch" aria-checked=/g) || []).length === 6 &&
     /const s=e\.target\.closest\("\.switch"\);if\(s\)s\.setAttribute\("aria-checked",s\.classList\.contains\("on"\)\?"true":"false"\);/.test(src));
  ck('Settings opens wide, on the remembered page; a dialog opened from it does not',
     /openModal\("Settings",[\s\S]*?\{wide:true\}\);/.test(src) && /setPageOf\(settings\.setPage,hasChar\)/.test(src) &&
     /openModal\("Import settings",settingsImportQuestionHTML\(imp\)\);/.test(src));
  ck('the arrow keys step over the SHOWN pages only', /setPageStep\(pages\.map\(p=>p\.k\),t\.dataset\.setpage,e\.key\)/.test(src));
  ck('switching a page shows it, remembers it and starts it at the top',
     /p\.hidden=p\.dataset\.setpagebody!==k;/.test(src) && /settings\.setPage=k;saveSettings\(\);/.test(src) && /mb\.scrollTop=0/.test(src));
  ck('the old folding sections are gone', !/SET_SECTIONS|setSecHTML|setSecOpen|data-setsec=/.test(src));
  ck('the badge refresh targets the sidebar',
     /querySelector\('\[data-setbadge="rules"\]'\)[\s\S]{0,40}innerHTML=rulesNavBadgeHTML\(\)/.test(fs.readFileSync(path.join(ROOT, 'src/js/89-rules-merge.js'), 'utf8')));
}
```

- [ ] **Step 2: Run them to see them fail.** Run: `node src/tests/rules-data.js 2>&1 | grep "^FAIL" | head -20`. Expected: the new page-placement checks fail (no `secDisplay`, no `segEnc`, no `{wide:true}`), the badge checks fail (`renderRulesData` still writes the old chip), and the Trackers and backdrop checks fail.

- [ ] **Step 3: Delete the old sections.** In `src/js/88-settings.js` delete from the line `/* ================= settings modal =================` through the closing `}` of `function setSecHTML(k,body,badge){…}` (the header comment, `SET_SECTIONS`, `setSecDef`, `setSecOpen`, `setSecHTML`), and put this header in its place, directly above Task 2's `/* ---- the sidebar and its pages (#107) ----`:

```js
/* ================= settings modal =================
   A sidebar of categories beside one page at a time (#107). It replaced five
   folding sections that had grown, a control at a time, into one long scroll.
   The page last viewed is remembered in `settings.setPage`. */
```

- [ ] **Step 4: Rewrite the markup half of `openSettings()`.** Replace everything from `function openSettings(){` down to (not including) the line `  const secCredits=` with:

```js
function openSettings(){
  const hasChar=!!activeId,who=character.name||"unnamed";
  const secAppearance=
    setGroupHTML("Look",
      setRowHTML("Skin","The app's look. It also sets the open character's game system.",
        `<div class="seg" id="segSkin"><button type="button" data-skin="humblewood" class="${(settings.skin||"humblewood")==="humblewood"?"on":""}">Humblewood</button><button type="button" data-skin="classic" class="${settings.skin==="classic"?"on":""}">Classic D&amp;D</button></div>`)+
      setRowHTML("Mode","Light, dark, or follow your device.",
        `<div class="seg" id="segTheme"><button type="button" data-th="system" class="${settings.theme==="system"?"on":""}">System</button><button type="button" data-th="light" class="${settings.theme==="light"?"on":""}">Light</button><button type="button" data-th="dark" class="${settings.theme==="dark"?"on":""}">Dark</button></div>`)+
      setRowHTML("Hand-drawn borders","Inky wobble. Turn off for a cleaner look or a slow device.",
        `<button type="button" class="switch ${settings.rough?"on":""}" id="swRough" role="switch" aria-checked="${settings.rough?"true":"false"}" aria-label="Hand-drawn borders"></button>`,true))+
    setGroupHTML("Interface",
      setRowHTML("Icon tabs","Show the tab bar as icons at every width. Narrow screens always do.",
        `<button type="button" class="switch ${settings.tabIcons?"on":""}" id="swTabIcons" role="switch" aria-checked="${settings.tabIcons?"true":"false"}" aria-label="Icon tabs"></button>`,true)+
      setRowHTML("Tap outside to close dialogs","Leave off so a stray tap, or hiding your phone's keyboard, can't lose what you typed. ×, Cancel and Esc always close.",
        `<button type="button" class="switch ${settings.backdropClose===true?"on":""}" id="swBackdrop" role="switch" aria-checked="${settings.backdropClose===true?"true":"false"}" aria-label="Tap outside to close dialogs"></button>`,true));
  const secDisplay=hasChar?setGroupHTML("Cards",
      setRowHTML("Skills display","Skills listed A to Z, or under each ability.",
        `<div class="seg" id="segStatStyle">${[["classic","Classic"],["grouped","By ability"]].map(([v,l])=>`<button type="button" data-statstyle="${esc(v)}" class="${statStyle()===v?"on":""}">${l}</button>`).join("")}</div>`)+
      setRowHTML("Hit Dice display","Boxes, one line per size, or dice you tap.<br>Only Full and Condensed can mark a die spent without healing.",
        `<div class="seg" id="segHdStyle">${[["full","Full"],["condensed","Condensed"],["dice","Dice"]].map(([v,l])=>`<button type="button" data-hdstyle="${esc(v)}" class="${hdStyle()===v?"on":""}">${l}</button>`).join("")}</div>`)+
      setRowHTML("Colour current HP","Amber at half your maximum, red at a quarter.",
        `<button type="button" class="switch ${character.hpColor!==false?"on":""}" id="swHpColor" role="switch" aria-checked="${character.hpColor!==false?"true":"false"}" aria-label="Colour current HP"></button>`,true)+
      setRowHTML("Trackers card","Show it on the Journal tab. Hiding it keeps what you've counted.",
        `<button type="button" class="switch ${showTrackers(character)?"on":""}" id="swTrackers" role="switch" aria-checked="${showTrackers(character)?"true":"false"}" aria-label="Trackers card"></button>`,true)):"";
  const secCarrying=hasChar?setGroupHTML("Size and weight",
      setRowHTML("Size","From your ancestry unless you choose one. It sets your carrying capacity.",
        `<select id="setSize" aria-label="Size">${sizeOptionsHTML(character.size)}</select>`)+
      setRowHTML("Encumbrance","Off shows weight only. Standard limits you at capacity; Variant slows you in tiers before that.",
        `<div class="seg" id="segEnc">${[["none","Off"],["standard","Standard"],["variant","Variant"]].map(([v,l])=>`<button type="button" data-enc="${esc(v)}" class="${encMode()===v?"on":""}">${l}</button>`).join("")}</div>`)+
      setRowHTML("Coins count as weight","50 coins to the pound, the way the rules have it.",
        `<button type="button" class="switch ${character.coinWeight!==false?"on":""}" id="swCoinWeight" role="switch" aria-checked="${character.coinWeight!==false?"true":"false"}" aria-label="Coins count as weight"></button>`,true)+
      `<p class="hint set-note" id="encHint">${esc(encSettingsHint())}</p>`):"";
  const secRules=setGroupHTML("Sources",
      `<p class="hint">Import the rules data zip or JSON files, or add a URL and Fetch all (needs a connection). What is loaded stays saved for offline use.</p>`+
      `<div id="srcList"></div>`+
      `<div class="set-addsrc"><input id="newSrc" placeholder="https://…/spells.json" aria-label="Rules source URL" title="A URL can point to one file, or to a manifest that includes others. All sources merge; later ones win on name clashes."><button type="button" class="tbtn" id="addSrc">Add</button></div>`+
      `<div class="m-actions set-actions"><button type="button" class="tbtn" id="btnFetchRules" title="Each source it reaches replaces what it loaded last time; one it can't reach keeps what it had. Files you imported are never touched.">Fetch all</button><button type="button" class="tbtn" id="btnImportRules" title="The rules data zip, or JSON files split by category.">Import files</button><button type="button" class="tbtn" id="btnRulesTemplate">Get templates</button><button type="button" class="tbtn danger" id="btnClearRules">Clear all</button></div>`+
      `<div class="status ${((rules.keywords||[]).length+(rules.features||[]).length+(rules.items||[]).length+(rules.spells||[]).length)?"ok":""}" id="rulesStatus">${esc(rulesStatusText())}</div>`+
      `<input type="file" id="fileRules" accept="application/json,.json,application/zip,application/x-zip-compressed,.zip" multiple class="hidefile">`)+
    setGroupHTML("Loaded data",
      `<p class="hint">Everything in your rules pool, by file or source. Remove what you no longer want.</p><div id="rulesData"></div>`)+
    (hasChar?setGroupHTML("This sheet",
      setRowHTML("Rules updates",`Last checked against <b>v${esc(character.appVersion||"—")}</b>; you're on v${esc(APP_VERSION)}. Compares this sheet with your loaded rules; a backup is saved first.`,
        `<button type="button" class="tbtn" id="btnCharUpdate">Check for rules updates</button>`)):"");
  const secBackup=setGroupHTML("Characters",
      setRowHTML("Character library","Switch characters, set autoload, or start a new one.",
        `<button type="button" class="tbtn" id="swHome">Open</button>`))+
    setGroupHTML("Settings file",
      setRowHTML("Settings and rules data","Export saves your settings and all loaded rules data to one JSON file. Import asks before it replaces the rules you have loaded.",
        `<div class="set-btns"><button type="button" class="tbtn" id="btnExportSettings">Export</button><button type="button" class="tbtn" id="btnImportSettings">Import</button></div>`)+
      `<input type="file" id="fileSettings" accept="application/json,.json" class="hidefile">`+
      `<div class="status" id="setImpStatus"></div>`);
```

Leave the two comments and the `const secCredits=…` template exactly as they are.

- [ ] **Step 5: Replace the dialog assembly and the section toggle.** Replace everything from the line `  openModal("Settings",\`<div id="setSections">\`+` down to and including the line `  });` that closes `secs.addEventListener("keydown",…)` (the old fold toggle) with:

```js
  const pages=setPagesFor(hasChar),active=setPageOf(settings.setPage,hasChar);
  const body={appearance:secAppearance,display:secDisplay,carrying:secCarrying,rules:secRules,backup:secBackup,credits:secCredits};
  const sub={display:"For "+who,carrying:"For "+who};
  openModal("Settings",`<div class="set-wrap" id="setSections">`+
    setNavHTML(pages,active,{rules:rulesNavBadgeHTML()})+
    `<div class="set-pages">`+pages.map(p=>setPageHTML(p.k,body[p.k],{active:p.k===active,sub:sub[p.k]})).join("")+`</div></div>`,"",{wide:true});
  /* Delegated from a wrapper INSIDE the modal body, not from #mBody itself:
     #mBody survives every open, so a listener bound to it would stack up one
     copy per visit. Every page is built; switching shows one and remembers it. */
  const secs=document.getElementById("setSections");
  const showPage=(k,focus)=>{
    secs.querySelectorAll("[data-setpage]").forEach(t=>{const on=t.dataset.setpage===k;t.setAttribute("aria-selected",on?"true":"false");t.tabIndex=on?0:-1;if(on&&focus)t.focus();});
    secs.querySelectorAll("[data-setpagebody]").forEach(p=>{p.hidden=p.dataset.setpagebody!==k;});
    const mb=secs.closest(".m-body");if(mb)mb.scrollTop=0;
    settings.setPage=k;saveSettings();
  };
  /* A switch's own handler (bound on the button) runs first and flips its `on`
     class; this then says the new state to a screen reader, for every switch. */
  secs.addEventListener("click",e=>{
    const t=e.target.closest("[data-setpage]");if(t){showPage(t.dataset.setpage,false);return;}
    const s=e.target.closest(".switch");if(s)s.setAttribute("aria-checked",s.classList.contains("on")?"true":"false");
  });
  secs.addEventListener("keydown",e=>{
    const t=e.target.closest("[data-setpage]");if(!t)return;
    const next=setPageStep(pages.map(p=>p.k),t.dataset.setpage,e.key);
    if(next===t.dataset.setpage)return;
    e.preventDefault();showPage(next,true);
  });
```

- [ ] **Step 6: Replace the encumbrance handler.** Replace the line

```js
  {const s=document.getElementById("setEnc");if(s)s.addEventListener("change",()=>{character.encumbrance=s.value;encSettingsChanged();});}
```

with

```js
  {const g=document.getElementById("segEnc");if(g)g.addEventListener("click",e=>{const b=e.target.closest("[data-enc]");if(!b)return;character.encumbrance=b.dataset.enc;g.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));encSettingsChanged();});}
```

- [ ] **Step 7: Point the badge refresh at the sidebar.** In `src/js/89-rules-merge.js`, in `renderRulesData()`, replace

```js
  const chip=document.querySelector('[data-setsec="rules"] .fgcount');
  if(chip)chip.textContent=rulesBadge();
```

with

```js
  const badge=document.querySelector('[data-setbadge="rules"]');
  if(badge)badge.innerHTML=rulesNavBadgeHTML();
```

and change the comment above it from `The Settings "Rules data" header counts the pool.` to `The Settings sidebar's Rules data tab counts the pool (#107).`

- [ ] **Step 8: Keep the `docs` suite green.** The wiki may only name functions that exist.
- In `src/docs/wiki/features/settings-and-updates.md`, on the **Code:** line replace `` `SET_SECTIONS`, `setSecOpen()`, `setSecHTML()`, `` with `` `SET_PAGES`, `setPageOf()`, `setNavHTML()`, `setPageHTML()`, `setRowHTML()`, `rulesNavBadgeHTML()`, ``; in the paragraph beginning `**The modal.** \`openSettings()\` builds five folding groups with \`setSecHTML()\``, replace `with \`setSecHTML()\`` by `(replaced by a sidebar in #107, rewritten in Task 5)`.
- In `src/docs/wiki/ui/sections-and-layout.md`, on the **Code:** line replace `` `setSecOpen()`,`` + newline + `` `setSecHTML()` in `88-settings.js` `` with `` `setPageOf()` in `88-settings.js` ``, and in the collapse-state table delete the row starting `| \`setCollapse\` | settings |`.
- Run: `grep -rn "setSecOpen()\|setSecHTML()\|setSecDef()" src/docs/wiki/` — expected: no output.

- [ ] **Step 9: Run every suite.** Run: `PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh 2>&1 | tail -14`. Expected: `All 10 suites passed`. If `docs` fails on a function name, fix that page's mention the same way as Step 8.

- [ ] **Step 10: Commit.**

```bash
git add src/js/88-settings.js src/js/89-rules-merge.js src/tests/rules-data.js src/docs/wiki/features/settings-and-updates.md src/docs/wiki/ui/sections-and-layout.md
git commit -m "feat: Settings is a sidebar of six pages, one row per setting (#107)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The layout, and screenshots

**Files:**
- Modify: `src/css/50-modal.css` (replace the `/* Settings sections. …` comment and its four `#setSections`/`.setsec-body` rules)
- Test: `src/tests/rules-data.js` (append to the Task 3 block)

**Interfaces:**
- Consumes: the DOM contract from Task 3.

- [ ] **Step 1: Take the before screenshots** (from `main`'s artifact, before building this branch). Navigate the Playwright MCP to `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`; `newCharacter("QA107","humblewood")`; `openSettings()`; full-page shot `107-before-settings-desktop.png`; resize to 390×844, shot `107-before-settings-phone.png`; resize back to 1280×900.

- [ ] **Step 2: Write the failing test.** Inside the Task 3 block (before its closing `}`), add:

```js
  const mcss = fs.readFileSync(path.join(ROOT, 'src/css/50-modal.css'), 'utf8');
  ck('the dialog is two panes, the sidebar staying put while the page scrolls',
     /\.set-wrap\{display:grid;grid-template-columns:184px minmax\(0,1fr\)/.test(mcss) && /\.set-nav\{position:sticky;top:0/.test(mcss));
  ck('a hidden page takes no room', /\.set-page\[hidden\]\{display:none\}/.test(mcss));
  ck('the sidebar becomes an icon rail with Icon tabs on, and on a narrow screen',
     /html\[data-tabs="icons"\] \.set-wrap\{grid-template-columns:52px minmax\(0,1fr\)/.test(mcss) &&
     /@media\(max-width:640px\)\{[^@]*\.set-wrap\{grid-template-columns:52px minmax\(0,1fr\)/.test(mcss));
  ck('on a narrow screen a choice drops below its name, a switch stays beside it',
     /@media\(max-width:640px\)\{[^@]*\.set-row:not\(\.set-inline\)\{flex-direction:column/.test(mcss));
  ck('a long name in a page subtitle wraps', /\.m-body p\.set-psub\{[^}]*overflow-wrap:anywhere/.test(mcss));
  ck('the folding-section styles are gone', !/#setSections \.fghead|\.setsec-body/.test(mcss));
```

- [ ] **Step 3: Run it to see it fail.** Run: `node src/tests/rules-data.js 2>&1 | grep "^FAIL"`. Expected: the six new checks fail.

- [ ] **Step 4: Write the CSS.** In `src/css/50-modal.css`, replace the comment that starts `/* Settings sections. The group itself is the shared .fgroup/.fghead idiom;` and the four rules after it (`#setSections .fghead{…}`, `#setSections .fgroup:last-child{…}`, `#setSections .fgroup:last-child .setsec-body>*:last-child{…}`, `.setsec-body{…}`) with:

```css
/* ---- the Settings dialog (#107): a sidebar of categories beside one page ----
   The body (.m-body) is the scroller; the sidebar is sticky inside it, so the
   page scrolls while the categories stay put. */
.set-wrap{display:grid;grid-template-columns:184px minmax(0,1fr);gap:0 18px;align-items:start}
.set-nav{position:sticky;top:0;display:flex;flex-direction:column;gap:2px;padding:2px 12px 2px 0;border-right:1.5px solid var(--hair);background:var(--panel);z-index:1}
.set-cap{font-family:var(--head);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin:10px 0 2px 10px}
.set-sep{border-top:1px dotted var(--hair);margin:6px 0}
.set-tab{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:8px 10px;border:0;border-radius:8px;background:none;color:var(--ink);font:inherit;font-size:15px;text-align:left;cursor:pointer;position:relative}
.set-tab:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}
.set-tab[aria-selected="true"]{background:color-mix(in srgb,var(--accent) 18%,transparent);font-weight:600}
.set-tab[aria-selected="true"]::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:2px;background:var(--accent)}
.set-tab:focus-visible{outline:2px solid var(--accent-2);outline-offset:1px}
.set-ico{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.set-tlbl{flex:1 1 auto;min-width:0}
.set-tbadge{display:inline-flex;align-items:center;gap:5px;flex:none}
.set-cnt{font-family:var(--head);font-size:10px;color:var(--ink-soft)}
.set-dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
.set-pages{min-width:0}
.set-page[hidden]{display:none}
.set-ptitle{font-family:var(--head);font-weight:800;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:6px 0 2px}
.m-body p.set-psub{font-size:13px;color:var(--ink-soft);margin:0 0 6px;overflow-wrap:anywhere}
.set-grp{margin:0 0 14px}
.set-grp-h{font-family:var(--head);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);padding:10px 0 4px;border-bottom:1.5px solid var(--line)}
.set-row{display:flex;align-items:center;gap:16px;padding:11px 0;border-bottom:1px dotted var(--hair)}
.set-row-txt{flex:1 1 auto;min-width:0}
.set-row-txt .t-lbl{font-size:15px}
.set-row-txt .t-sub{font-family:var(--body);font-size:12px;color:var(--ink-soft);margin-top:2px}
.set-row-ctl{flex:none;display:flex;justify-content:flex-end}
.set-row-ctl .seg{min-width:250px}
.set-row-ctl select{width:250px}
.set-btns{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.set-addsrc{display:flex;gap:7px;margin:4px 0}
.set-actions{justify-content:flex-start;margin-top:8px;flex-wrap:wrap}
.set-actions #btnClearRules{margin-left:auto}
.m-body p.set-note{margin:8px 0 0}
/* the icon rail: Icon tabs on (applyTheme() sets html[data-tabs]), or a narrow screen */
html[data-tabs="icons"] .set-wrap{grid-template-columns:52px minmax(0,1fr);gap:0 14px}
html[data-tabs="icons"] .set-tlbl,html[data-tabs="icons"] .set-cap,html[data-tabs="icons"] .set-cnt{display:none}
html[data-tabs="icons"] .set-tab{justify-content:center;padding:10px 0}
html[data-tabs="icons"] .set-nav{padding-right:8px}
html[data-tabs="icons"] .set-tbadge{position:absolute;top:6px;right:6px}
@media(max-width:640px){
  .set-wrap{grid-template-columns:52px minmax(0,1fr);gap:0 12px}
  .set-tlbl,.set-cap,.set-cnt{display:none}
  .set-tab{justify-content:center;padding:10px 0}
  .set-nav{padding-right:8px}
  .set-tbadge{position:absolute;top:6px;right:6px}
  .set-row:not(.set-inline){flex-direction:column;align-items:stretch;gap:8px}
  .set-row-ctl .seg,.set-row-ctl select{min-width:0;width:100%}
  .set-btns{justify-content:flex-start}
}
```

- [ ] **Step 5: Run the tests.** Run: `node src/tests/rules-data.js 2>&1 | grep -E "^FAIL|ALL PASSED"`. Expected: `ALL PASSED (…)`.

- [ ] **Step 6: Build and take the after screenshots.** Run `./build.sh --no-zip`. Navigate to `file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/107/dist/fieldbook.html`. For each skin (`newCharacter("QA107","humblewood")`, then `newCharacter("QA107","dnd")`), and in light and dark (`document.documentElement.dataset.theme="dark"`), open Settings and click each sidebar tab in turn, shooting `#mBody`'s dialog as `107-after-<skin>-<theme>-<page>.png`. Then: resize to 390×844 and shoot every page (`107-after-phone-<page>.png`); at 1280×900 turn Icon tabs on from the Appearance page and shoot (`107-after-icontabs.png`); at 700×900 shoot Appearance and Carrying (`107-after-700-<page>.png`). Read each shot; fix any overlap, clipping or misalignment in the CSS and re-shoot.

- [ ] **Step 7: Drive it.** With the built artifact, check and record each result:
  - Click each tab: the page changes, `aria-selected` moves, the body scrolls to the top.
  - Focus a tab and press ↓, ↑, Home and End: focus and page move together; with no character open (`showHome()`, then `openSettings()` from the cog), ↓ from Appearance lands on Rules data.
  - Toggle Colour current HP: the switch's `aria-checked` flips, the HP colour follows. Pick Standard encumbrance: the carrying line changes. Pick a size: the line changes.
  - Close and reopen Settings: it opens on the last page.
  - With Appearance showing, load a pack the way every import ends (`mergeRules({system:"QA",spells:[{name:"QA Spell"}]},"qa.json");renderRulesData();`) and confirm the Rules data tab's count rose by one while Appearance stayed on screen; then Clear all from the Rules data page and confirm the count is gone.
  - Turn Icon tabs on from inside Settings: the sidebar becomes the rail at once.
  - Open Import settings from Backup with a file, then Cancel: Settings returns wide, on Backup.

- [ ] **Step 8: Run every suite.** Run: `PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh 2>&1 | tail -3`. Expected: `All 10 suites passed`.

- [ ] **Step 9: Commit.**

```bash
git add src/css/50-modal.css src/tests/rules-data.js
git commit -m "feat: the Settings sidebar, rows and icon rail are laid out (#107)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Docs

**Files:**
- Modify: `src/docs/_claude/WIRING-LEDGER.md` (append), `src/docs/wiki/features/settings-and-updates.md`, `src/docs/wiki/ui/shell.md`, `src/docs/wiki/ui/sections-and-layout.md`, `src/docs/wiki/architecture/storage.md`, `src/docs/wiki/decisions.md`, `src/docs/UNRELEASED.md`

- [ ] **Step 1: Append the ledger entry.** Append to `src/docs/_claude/WIRING-LEDGER.md` an entry headed `## Settings is a sidebar of six pages (#107, 2026-10-16)` that records: Mike's request (cluttered, hard to parse; sidebar categories, consistent controls, icon rail); the six pages and what moved where (Rules updates to Rules data; encumbrance became segmented); the row and type rule; the rail's two triggers; `settings.setPage` and that `setCollapse` is no longer read; `openModal`'s `wide`; the `aria-checked` sync for every switch; what was tested and driven; the screenshots `.claude/qa/107-*`; and the pages touched. Note its heading's line number: `grep -n '^## ' src/docs/_claude/WIRING-LEDGER.md | tail -1`.

- [ ] **Step 2: Rewrite the wiki pages to the new truth** (present tense, each with a History line citing that `L<n>` and `#107`):
  - `features/settings-and-updates.md`: rewrite **The modal** as the six pages and their rows (the table in spec §4), replace **Fold state** with **Which page opens** (`setPageOf()`, `settings.setPage`), and describe the sidebar badge (`rulesNavBadgeHTML()`); add the Decisions from spec §2 to its Decisions table.
  - `ui/shell.md`: `openModal()` takes `opts` (`{wide:true}`), set or cleared on every open; add a Rules-that-must-hold line saying so.
  - `ui/sections-and-layout.md`: the Settings collapsible is gone — rewrite the sentences naming `SET_SECTIONS[].open` and the Settings sections among the `.fgroup` users; in the Decisions table change the row `| A collapsible in Settings | Reuse .fgroup / .fghead / .fcaret | …` so the sidebar is the decision and the shared collapsible is the rejected alternative; say `setCollapse` is no longer read.
  - `architecture/storage.md`: in the `hw-fb-settings` row, list `setPage` and note `setCollapse` is no longer read.
  - `decisions.md`: one line per new decision under Settings & updates and Sections & layout.

- [ ] **Step 3: Add the player note.** Append to `src/docs/UNRELEASED.md` under `## Pending`:

```
- Settings is easier to find your way around: a sidebar of categories (Appearance, Sheet display,
  Carrying, Rules data, Backup, Credits) beside one page at a time, every setting on its own row.
  With icon tabs on, or on a phone, the sidebar shrinks to icons. Encumbrance is now three buttons.
```

- [ ] **Step 4: Run every suite.** Run: `PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh 2>&1 | tail -3`. Expected: `All 10 suites passed` (the `docs` suite checks every name and link).

- [ ] **Step 5: Commit.**

```bash
git add src/docs/_claude/WIRING-LEDGER.md src/docs/wiki/features/settings-and-updates.md src/docs/wiki/ui/shell.md src/docs/wiki/ui/sections-and-layout.md src/docs/wiki/architecture/storage.md src/docs/wiki/decisions.md src/docs/UNRELEASED.md
git commit -m "docs: the Settings sidebar in the ledger, wiki and notebook (#107)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
