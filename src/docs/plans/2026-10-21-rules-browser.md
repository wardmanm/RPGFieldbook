# The Rules Tab as a Browser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Rules tab becomes a browser over everything the loaded packs hold: a sidebar of
categories with counts and a search across all of them, a sortable, filterable table per category,
and a row that opens the window the sheet already uses for that entry (#99, with #53).

**Architecture:**
- **One generic table, a config per category.** `RB_CATS` in a new fragment, `86-rules-browser.js`,
  lists the eleven categories in order: each names its rows, its columns, its filters and the window
  a row opens. The fragment's pure half (rows, filtering, sorting, markup strings, state) is fully
  testable in the Node harness; its DOM half paints three boxes (`#rbSide`, `#rbMain`, `#rbBody`)
  and nothing else.
- **The pickers and the Rules tab filter alike.** The item, spell and feat pickers' facet lists move
  out of their closures in `85-browse.js` into `itemFacets()`, `spellFacets()`, `featFacets()`; the
  two previews become `openItemInfo()` and `openFeatInfo()`. Both callers use them.
- **The windows learn two things:** to be opened by `_id` (and title themselves with the entry's own
  name), and a reference mode, `{ref:true}`, that shows the rules without the open character's
  level, subclass or choices.

**Tech Stack:** Plain ES2020 concatenated into one `<script>`, no modules; plain CSS on the theme
tokens; Node suites through `src/tests/harness.js`; the project's Playwright MCP (`mcp__playwright__*`)
for driven checks and screenshots.

**Spec:** `src/docs/specs/2026-10-19-rules-browser-design.md`. Read it first; this plan argues from it.
[Rules & tables](../wiki/features/rules-and-tables.md) describes the tab being replaced.

**Worktree:** `.claude/worktrees/99`, branch `issue/99-rules-browser`. Create it from the repo root
before Task 1 with `./scripts/wt.sh add 99 rules-browser`, then run every command below from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/99`.

## Global Constraints

**The build**
- One shipped file, built by concatenation: no `import`/`export`, no `type="module"`, no runtime
  dependency, no network. This branch adds ONE fragment, `src/js/86-rules-browser.js`, listed in
  `src/manifest.json` after `src/js/86-tables.js` and before `src/js/87-notes.js`.
- Adding a fragment moves the JS count quoted in `CLAUDE.md` (`js/*.js  32 fragments`) and in
  `src/docs/ADR-001-source-split.md` (`js/ (32 fragments)`) to 33; the `docs` suite checks both. The
  overview's code map must list the fragment, and some wiki topic page must cite it.
- **Byte hygiene:** LF endings, one final newline, no BOM.
- **TDZ (ADR-001):** top-level `const`s in the new fragment are read only from inside functions;
  nothing that runs at load reads them.
- **Before `rules-data.js` (or `run.sh`), build:** `./build.sh --no-zip`.

**Git and release**
- Branch commits carry source and docs only; never `git add` `dist/fieldbook.html` or
  `docs/CHANGELOG.md`. Always `git add` explicit paths.
- Never touch `APP_VERSION`, `DATA_VERSIONS` or the `CHANGELOG` array.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Data**
- Nothing new on the character. One new setting, `settings.rulesCat` (the category last opened),
  read only through `rulesCatOf()`. `settings.rulesCollapse` is no longer read or exported; a stored
  one is left alone.
- `RULE_CATS` stays the single category list; Conditions is a view over `keywords`.
- The packs and `docs/rules-schema.md` do not change.

**Markup safety**
- Every `${…}` inside a quoted HTML attribute value is `esc(…)` of the whole expression, or a
  ternary that can only yield literals (`rules-data.js` scans all of `src/js`). Tag-position
  ternaries (`${on?` aria-current="true"`:""}`) are fine.
- A modal's title is plain text, never `esc()`'d.
- Pack fields are someone else's file (#71): read every field through `rbStr()`, `glossTerm()`,
  `tableRows()` and the other helpers named here, never raw, so a malformed entry renders blank
  cells rather than stopping the tab.

**The test harness**
- A suite names what it reads as `X.name` in its `loadApp([...])` list; every name must exist (a
  missing one is `LOAD FAIL`). Add a name only if it is not already there. A function reached as
  `ctx.name` needs no entry, and assigning `ctx.name = …` replaces a function for the test (restore
  it after).
- `X.rules = …` and `X.character = …` set the app's globals; `X.settings` is the live settings
  object (rules-data.js lists `settings`; add it to sheet.js's list where a task says so).
- Run one suite: `node src/tests/<suite>.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.

**Settled decisions (spec §2), and the rulings this plan adds**
- Categories, in order: Classes, Subclasses, Species, Backgrounds, Feats, Traits, Spells, Items,
  Conditions, Glossary, Tables. An empty one is not listed.
- **Ruling (plan):** the **Glossary is always listed**, even empty, because its + Add is the only
  way to create the player's own entries. If wrong: an empty "Glossary (0)" row shows.
- **Ruling (plan):** **Subclasses lists what `subclassesFor()` returns for every loaded class**
  (the class's own `subclasses` plus `rules.subclasses`), not `rules.subclasses` alone: the SRD
  pack carries its subclasses inside each class, so the spec's literal source would leave the
  category empty for an SRD-only player. If wrong: a loose subclass whose class is not loaded is not
  listed.
- **Ruling (plan):** **Tables gets a Source column too** (decision 7: "a Source column everywhere"
  outranks §4's shorter column list).
- **Ruling (plan):** the **Pack filter is per category**: added when that category's rows carry
  more than one pack. Equivalent to the spec's rule for every category that has entries from two
  packs.
- **Ruling (plan):** **with no pack loaded, the import prompt shows above the browser**, which then
  lists only the Glossary, so + Add stays reachable (the old tab did the same).
- A row opens its window by `_id`; class, subclass, species and background open with `{ref:true}`.
- Search, filters and sort live in memory for the session; `settings.rulesCat` persists.
- Narrow (≤640px): one pane at a time, the category list then a table with "← Categories".
- Long tables: 300 rows, then "Show N more" (N ≤ 300).
- Cross-category search: names only, up to 8 rows per category, then "N more in <Category> →".

## Review Focus

Inputs the spec implies but no task would otherwise test; each line's test is in the owning task.

1. **Two packs with a same-named entry** (Elf from SRD and from the 2024 pack) — each row opens its
   own entry, titled "Elf", not "r12" (Task 2, Task 3).
2. **A malformed pack** (a keyword with no term, a table whose rows are not a list, a null entry,
   a name that is a number) — the tab renders, the bad entry is skipped or blank (Task 3, Task 4's
   hostile render).
3. **Typing in a category's search box** — the box must not be rebuilt (focus and caret would be
   lost on every keystroke); only `#rbBody` repaints (Task 4: the input handler repaints the body,
   and the driven check types three letters).
4. **A stored `rulesCat` for a category that is now empty or unknown** (a pack removed, a hand-edited
   settings file) — falls back to the first listed category (Task 3).
5. **The glossary's own entries** — Edit and Delete still work from the new table, and + Add still
   creates one (Task 4 wiring; Task 5 drives it).

---

## File Structure

| File | Responsibility on this branch |
|---|---|
| `src/js/85-browse.js` | `ITEM_RARITIES`, `itemCatOf()`, `itemRarOf()`, `itemFacets()`, `spellClassesOf()`, `spellSchoolOf()`, `spellFacets()`, `featFacets()`, `openItemInfo()`, `openFeatInfo()`; the three pickers use them; `openGlossForm()` repaints the browser |
| `src/js/56-class.js`, `52-race.js`, `54-background.js` | the four windows: open by id, titled by the entry's name, `{ref:true}` |
| `src/js/86-rules-browser.js` (new) | `RB_CATS` and the pure half; `renderRulesBrowser()` and the DOM half |
| `src/js/86-tables.js` | the old folding (`RULES_SECS` … `toggleRulesSec()`) and `renderTables()` removed |
| `src/js/60-attacks.js` | `renderGloss()` removed |
| `src/js/66-coins-hp.js`, `88-settings.js` | `renderAll()` and `refreshRulesUI()` call `renderRulesBrowser()`; `SETTINGS_KEYS` |
| `src/js/40-sheet.js` | `buildToc()`'s Rules-tab case |
| `src/js/90-boot.js` | the browser's taps and inputs; the old ids' wiring removed; `data-sub-ref` |
| `src/html/40-rules.html` | the browser's shell |
| `src/css/35-tables.css`, `src/css/20-cards.css` | the browser's CSS; `.rules-head` removed |
| `src/manifest.json`, `CLAUDE.md`, `src/docs/ADR-001-source-split.md` | the fragment and its count |
| `src/tests/sheet.js`, `src/tests/rules-data.js` | the tests |
| docs | `rules-and-tables.md`, `sections-and-layout.md`, `overview.md` (Tasks 3–4 keep the `docs` suite green); `shell.md`, `decisions.md`, the class/species/background/inventory/features pages, the spec's As built, ledger, `UNRELEASED.md`, `1.9.0.md` (Task 5) |

---

### Task 1: Shared filters and the item and feat viewers

**Files:**
- Modify: `src/js/85-browse.js` (`browseItems()`, `browseSpells()`, `browseFeatures()`; new functions
  just above `browseItems()`, and the two viewers just below `browseFeatures()`)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Produces: `ITEM_RARITIES` (array); `itemCatOf(x) → string`; `itemRarOf(x) → string`;
  `itemFacets(lib) → facet[]`; `spellClassesOf(x) → array`; `spellSchoolOf(x) → string`;
  `spellFacets(lib, opts) → facet[]` with `opts.classDefault` `"mine"` (default) or `"all"`;
  `featFacets(list) → facet[]` over `{k, e}` wrappers; `openItemInfo(x)`; `openFeatInfo(w)`.
  A facet is `{key, label, type:"multi"|"toggle", options?, default?, match(subject, set|true)}` —
  exactly what `openBrowse()` takes today.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, add to the `loadApp` list (only names not already there):
`'itemFacets', 'spellFacets', 'featFacets', 'itemCatOf', 'itemRarOf', 'spellClassesOf', 'spellSchoolOf', 'openItemInfo', 'openFeatInfo', 'featPickList', 'ITEM_RARITIES',`.

Then insert, immediately before the block that begins
`/* ---- imported files and packs render inert ----`:

```js
/* ---- #99: the pickers' filters and previews, shared with the Rules tab ---- */
{
  const savedRules = X.rules, savedChar = X.character, savedOB = ctx.openBrowse, savedOM = ctx.openModal;
  let cfg = null, modal = null;
  ctx.openBrowse = c => { cfg = c; };
  ctx.openModal = (title, html) => { modal = {title, html}; };
  const items = [{_id: 'i1', name: 'Rope', category: 'Gear', cost: '1 gp', _source: 'SRD'},
    {_id: 'i2', name: 'Wand', category: 'Wondrous Item', rarity: 'Rare', attune: true, description: 'Zap.', _source: 'SRD'},
    {_id: 'i3', name: 'Ring', rarity: 'Uncommon', _source: 'SRD'}];
  const spells = [{_id: 's1', name: 'Fire Bolt', level: 0, meta: 'Evocation · Action · 120 feet', class: ['Wizard', 'Sorcerer'], _source: 'SRD'},
    {_id: 's2', name: 'Bless', level: 1, meta: 'Enchantment · Action · 30 feet · Concentration, up to 1 minute', class: 'Cleric', _source: 'SRD'},
    {_id: 's3', name: 'Loose', level: 2, meta: '', _source: 'SRD'}];
  const feats = [{_id: 'f1', name: 'Alert', description: 'Origin feat\nYou are alert.', _source: 'SRD'},
    {_id: 'f2', name: 'Grappler', description: 'General feat · Prerequisite: Level 4+, Strength 13+\nGrab.', _source: 'XPHB'}];
  const traits = [{_id: 't1', name: 'Darkvision', source: 'Elf', description: 'See.', _source: 'SRD'}];
  X.rules = {name: 'T', keywords: [], features: traits, items, spells, races: [], classes: [], feats,
             backgrounds: [], subclasses: [], tables: []};
  ctx.recomputeDups();
  X.character = X.blankChar();
  X.character.classes = [{name: 'Cleric', level: 1}];
  const shape = fs => JSON.stringify(fs.map(f => [f.key, f.label, f.type, f.options || null, f.default || null]));

  const fi = X.itemFacets(items);
  ck('#99 itemFacets: category, rarity, attunement', shape(fi) === JSON.stringify([
    ['cat', 'Category', 'multi', [{value: 'gear', label: 'Gear'}, {value: 'wondrous item', label: 'Wondrous Item'}], null],
    ['rar', 'Rarity', 'multi', [{value: 'mundane', label: 'Mundane'}, {value: 'uncommon', label: 'Uncommon'}, {value: 'rare', label: 'Rare'}], null],
    ['attune', 'Needs attunement', 'toggle', null, null]]), shape(fi));
  ck('#99 an item with no category is Gear, with no rarity Mundane',
     X.itemCatOf(items[2]) === 'Gear' && X.itemRarOf(items[0]) === 'Mundane' && X.itemCatOf(null) === 'Gear');
  ck('#99 the item facets match as the picker did',
     fi[0].match(items[2], new Set(['gear'])) && !fi[0].match(items[1], new Set(['gear'])) && fi[2].match(items[1]) && !fi[2].match(items[0]));
  ctx.browseItems();
  ck('#99 the item picker uses itemFacets', !!cfg && shape(cfg.facets) === shape(fi));
  modal = null; cfg.preview(items[1]); const viaPicker = modal;
  modal = null; X.openItemInfo(items[1]);
  ck('#99 openItemInfo is the picker\'s preview', !!modal && !!viaPicker && modal.title === 'Wand' &&
     modal.html === viaPicker.html && modal.html.includes('Zap.') && modal.html.includes(ctx.esc(ctx.itemMetaLine(items[1]))));

  const fs = X.spellFacets(spells), fsAll = X.spellFacets(spells, {classDefault: 'all'});
  ck('#99 spellFacets: level, class, school, concentration', JSON.stringify(fs.map(f => f.key)) === '["level","class","school","conc"]');
  ck('#99 the class filter starts on this character\'s classes in the picker',
     JSON.stringify(fs[1].default) === '["cleric"]');
  ck('#99 ...and on every class for a lookup', JSON.stringify(fsAll[1].default) === '[]');
  ck('#99 schools come from the first part of meta',
     JSON.stringify(fs[2].options.map(o => o.value)) === '["enchantment","evocation"]' && X.spellSchoolOf(spells[0]) === 'Evocation');
  ck('#99 a spell with no class passes any class filter, a string class is one class',
     fs[1].match(spells[2], new Set(['wizard'])) && fs[1].match(spells[1], new Set(['cleric'])) &&
     JSON.stringify(X.spellClassesOf(spells[1])) === '["Cleric"]' && JSON.stringify(X.spellClassesOf(null)) === '[]');
  ck('#99 concentration reads meta', fs[3].match(spells[1]) && !fs[3].match(spells[0]));
  cfg = null; ctx.browseSpells();
  ck('#99 the spell picker uses spellFacets', !!cfg && shape(cfg.facets) === shape(fs));

  const list = X.featPickList(), ff = X.featFacets(list);
  ck('#99 featFacets: type, pack (two packs), no prerequisite', JSON.stringify(ff.map(f => f.key)) === '["kind","pack","noreq"]');
  ck('#99 feat types are the ones present', JSON.stringify(ff[0].options.map(o => o.label)) === '["Origin feat","General feat","Trait"]');
  ck('#99 one pack, no Pack filter', JSON.stringify(X.featFacets(list.filter(w => w.e._source === 'SRD')).map(f => f.key)) === '["kind","noreq"]');
  ck('#99 no prerequisite reads the first line', ff[2].match(list[0]) && !ff[2].match(list[1]));
  cfg = null; ctx.browseFeatures();
  ck('#99 the feat picker uses featFacets', !!cfg && shape(cfg.facets) === shape(ff));
  modal = null; cfg.preview(list[1]); const featPicker = modal;
  modal = null; X.openFeatInfo(list[1]);
  ck('#99 openFeatInfo is the picker\'s preview', !!modal && !!featPicker && modal.title === 'Grappler' &&
     modal.html === featPicker.html && modal.html.includes('General feat · XPHB'));
  modal = null; X.openFeatInfo(list[2]);
  ck('#99 a trait reads its own source', !!modal && modal.html.includes('Elf · SRD'));
  modal = null; X.openFeatInfo(null); X.openItemInfo(null);
  ck('#99 nothing to show opens nothing', modal === null);

  ctx.openBrowse = savedOB; ctx.openModal = savedOM; X.rules = savedRules; X.character = savedChar;
}
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `LOAD FAIL` naming `itemFacets`.

- [ ] **Step 3: Implement**

In `src/js/85-browse.js`, immediately before `function browseItems(){`, insert:

```js
/* ---- the pickers' filters, shared with the Rules tab (#99) ----
   Each returns the facet list openBrowse() takes. The Rules tab's tables filter
   the same entries with the same lists, so the two can never disagree. */
const ITEM_RARITIES=["Mundane","Common","Uncommon","Rare","Very Rare","Legendary","Artifact"];
function itemCatOf(x){return (x&&x.category)||"Gear";}
function itemRarOf(x){return (x&&x.rarity)||"Mundane";}
function itemFacets(lib){
  const cats=[...new Set(lib.map(itemCatOf))].sort().map(c=>({value:String(c).toLowerCase(),label:c}));
  const rars=[...new Set(lib.map(itemRarOf))].sort((a,b)=>ITEM_RARITIES.indexOf(a)-ITEM_RARITIES.indexOf(b)).map(r=>({value:String(r).toLowerCase(),label:r}));
  return [
    {key:"cat",label:"Category",type:"multi",options:cats,match:(e,a)=>a.has(String(itemCatOf(e)).toLowerCase())},
    {key:"rar",label:"Rarity",type:"multi",options:rars,match:(e,a)=>a.has(String(itemRarOf(e)).toLowerCase())},
    {key:"attune",label:"Needs attunement",type:"toggle",match:e=>!!e.attune}
  ];
}
function spellClassesOf(x){return x&&x.class?(Array.isArray(x.class)?x.class:[x.class]):[];}
function spellSchoolOf(x){return String((x&&x.meta)||"").split("·")[0].trim();}
/* `classDefault`: "mine" (the picker starts on this character's classes) or
   "all" (the Rules tab: a lookup, not a choice, so nothing starts filtered). */
function spellFacets(lib,opts){
  const levels=[{value:"0",label:"Cantrip"}].concat([1,2,3,4,5,6,7,8,9].map(n=>({value:String(n),label:"Lv "+n})));
  const classOpts=[...new Set(lib.flatMap(spellClassesOf).map(c=>String(c)))].sort((a,b)=>a.localeCompare(b)).map(c=>({value:c.toLowerCase(),label:c}));
  const schoolOpts=[...new Set(lib.map(spellSchoolOf).filter(Boolean))].sort().map(s=>({value:s.toLowerCase(),label:s}));
  const mine=(character.classes||[]).map(c=>String(c.name||"").toLowerCase());
  const def=(opts&&opts.classDefault==="all")?[]:mine.filter(c=>classOpts.some(o=>o.value===c));
  return [
    {key:"level",label:"Level",type:"multi",options:levels,match:(e,a)=>a.has(String(num(e.level)))},
    {key:"class",label:"Class",type:"multi",options:classOpts,default:def,match:(e,a)=>{const c=spellClassesOf(e);return !c.length||c.some(x=>a.has(String(x).toLowerCase()));}},
    {key:"school",label:"School",type:"multi",options:schoolOpts,match:(e,a)=>a.has(spellSchoolOf(e).toLowerCase())},
    {key:"conc",label:"Concentration",type:"toggle",match:e=>/concentration/i.test(e.meta||"")}
  ];
}
```

Change `browseItems()`:
- Delete its lines `const catOf=x=>x.category||"Gear", rarOf=x=>x.rarity||"Mundane";`,
  `const RAR=[…];`, `const cats=…;` and `const rars=…;`.
- `sort:(a,b)=>String(catOf(a)).localeCompare(String(catOf(b)))||…` uses `itemCatOf` in place of
  `catOf`; `group:x=>catOf(x)` becomes `group:x=>itemCatOf(x)`.
- `preview:x=>openModal(…)` becomes `preview:x=>openItemInfo(x)`.
- The `facets:[ … ]` array becomes `facets:itemFacets(lib)`.
- The `const meta=itemMetaLine;` line and its comment move into `openItemInfo()` (below); delete
  them here.

Change `browseSpells()`:
- Delete `const myCl=…`, `const clsOf=…`, `const schoolOf=…`, `const levels=…`, `const classOpts=…`,
  `const schoolOpts=…` and `const defClasses=…`.
- `search:x=>\`${x.name} ${x.meta||""} ${clsOf(x).join(" ")}\`` uses `spellClassesOf(x)`;
  `row:x=>({title:dispName(x,"spells"),tag:schoolOf(x)})` uses `spellSchoolOf(x)`.
- The `facets:[ … ]` array becomes `facets:spellFacets(lib)`.

Change `browseFeatures()`: replace the lines from `const present=FEAT_KINDS.filter(…)` through
`facets.push({key:"noreq",…});` with `const facets=featFacets(list);`, and replace its
`preview:w=>{const bits=…;openModal(…);},` with `preview:w=>openFeatInfo(w),`.

Immediately before `function browseFeatures(){`, insert:

```js
function featFacets(list){
  const present=FEAT_KINDS.filter(k=>list.some(w=>featPickKind(w)===k.key));
  const srcs=[...new Set(list.map(w=>String(w.e._source||"")).filter(Boolean))].sort();
  const facets=[{key:"kind",label:"Type",type:"multi",
                 options:present.map(k=>({value:k.key,label:k.label})),
                 match:(w,a)=>a.has(featPickKind(w))}];
  /* only worth a row of pills once more than one pack is loaded */
  if(srcs.length>1)facets.push({key:"pack",label:"Pack",type:"multi",
    options:srcs.map(s=>({value:s.toLowerCase(),label:s})),
    match:(w,a)=>a.has(String(w.e._source||"").toLowerCase())});
  facets.push({key:"noreq",label:"No prerequisite",type:"toggle",match:w=>!featPickPrereq(w)});
  return facets;
}
```

Immediately after the closing `}` of `browseFeatures()`, insert:

```js
/* The windows an item and a feat or trait open in: the pickers' previews, lifted
   out so the Rules tab opens the very same one (#99). */
function openItemInfo(x){
  if(!x)return;
  const meta=itemMetaLine;   /* shared with the update diff — see 25-origins-items.js */
  openModal(x.name,`<p class="hint" style="font-family:var(--head);text-transform:uppercase;letter-spacing:.05em">${esc(meta(x))}</p><div class="desc">${richHTML(x.description||"—")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w.e)return;
  const bits=[w.k==="trait"?(String(w.e.source||"").trim()||"Trait"):featKindDef(featPickKind(w)).label,
              w.e._source||""].filter(Boolean);
  openModal(featPickName(w),`<p class="hint" style="font-family:var(--head);text-transform:uppercase;letter-spacing:.05em">${esc(bits.join(" · "))}</p><div class="desc">${descHTML(w.e.description||"—")}</div>`);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `ALL PASSED`. Then `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`: all suites pass (the pickers' existing tests are the proof their behaviour did not change).

- [ ] **Step 5: Commit**

```bash
git add src/js/85-browse.js src/tests/sheet.js
git commit -m "refactor(#99): the pickers' filters and previews as shared functions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The windows open by id, and in reference mode

**Files:**
- Modify: `src/js/56-class.js` (`openSubclassInfo()`, `openClassInfo()`), `src/js/52-race.js`
  (`openRaceInfo()`), `src/js/54-background.js` (`openBackgroundInfo()`), `src/js/90-boot.js`
  (the `[data-sub-info]` click)
- Test: `src/tests/sheet.js`

**Interfaces:**
- Produces: `openClassInfo(idOrName, opts)`, `openSubclassInfo(classIdOrName, subName, opts)`,
  `openRaceInfo(idOrName, opts)`, `openBackgroundInfo(idOrName, opts)`; `opts = {ref:true}` for
  reference mode; no `opts` behaves exactly as today. A subclass link inside a reference-mode class
  window carries `data-sub-ref="1"` and the class's `_id`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sheet.js`, insert after the block Task 1 added:

```js
/* ---- #99: the windows open by id, titled by name, and in reference mode ---- */
{
  const savedRules = X.rules, savedChar = X.character, savedOM = ctx.openModal;
  let modal = null;
  ctx.openModal = (title, html) => { modal = {title, html}; };
  const open = fn => { modal = null; fn(); return modal || {title: '', html: ''}; };
  X.rules = {name: 'T', keywords: [], features: [], items: [], spells: [], feats: [], tables: [], subclasses: [],
    classes: [{_id: 'c1', name: 'Fighter', description: 'First edition.', hitDie: 'd10', _source: 'SRD',
               levels: {'1': {traits: [{name: 'Second Wind'}]}, '3': {traits: [{name: 'Subclass'}]}},
               subclasses: {Champion: {description: 'Crits.', levels: {'3': {traits: [{name: 'Improved Critical'}]}}}}},
              {_id: 'c2', name: 'Fighter', description: 'Second edition.', hitDie: 'd10', _source: 'XPHB'}],
    races: [{_id: 'r1', name: 'Elf', description: 'Old elf.', speed: '30 ft', _source: 'SRD', subraces: [{name: 'High Elf'}]},
            {_id: 'r2', name: 'Elf', description: 'New elf.', speed: '35 ft', _source: 'XPHB', subraces: [{name: 'High Elf'}]}],
    backgrounds: [{_id: 'b1', name: 'Acolyte', description: 'Temple.', feat: 'Magic Initiate', abilityScores: ['int', 'wis', 'cha'], _source: 'SRD'}]};
  ctx.recomputeDups();
  X.character = X.blankChar();
  Object.assign(X.character, {classes: [{name: 'Fighter', level: 3, subclass: 'Champion'}],
    race: {name: 'Elf', subrace: 'High Elf'}, bg: {name: 'Acolyte', feat: 'Magic Initiate', abils: [{target: 'abilities.wis', value: 2}]}});

  const sheetCls = open(() => ctx.openClassInfo('Fighter'));
  ck('#99 from the sheet, the class window is unchanged', sheetCls.title === 'Fighter 3' &&
     sheetCls.html.includes('Level 3 — current') && sheetCls.html.includes('data-sub-info="Fighter|Champion"') && sheetCls.html.includes('data-change-sub'));
  const refCls = open(() => ctx.openClassInfo('c1', {ref: true}));
  ck('#99 by id, titled by its name', refCls.title === 'Fighter');
  ck('#99 reference mode shows nothing of the character',
     !refCls.html.includes('— current') && !refCls.html.includes('data-change-sub') && !refCls.html.includes('data-choose-sub'));
  ck('#99 ...and lists its subclasses as links that stay in reference mode',
     refCls.html.includes('data-sub-info="c1|Champion"') && refCls.html.includes('data-sub-ref="1"'));
  ck('#99 two packs\' Fighters open their own entries',
     refCls.html.includes('First edition.') && open(() => ctx.openClassInfo('c2', {ref: true})).html.includes('Second edition.'));

  ck('#99 from the sheet, the subclass window marks what was gained',
     open(() => ctx.openSubclassInfo('Fighter', 'Champion')).html.includes('Level 3 — gained'));
  const refSub = open(() => ctx.openSubclassInfo('c1', 'Champion', {ref: true}));
  ck('#99 a subclass in reference mode: no gained marks, the class named, not its id',
     refSub.title === 'Champion' && !refSub.html.includes('— gained') && refSub.html.includes('Fighter subclass') && !refSub.html.includes('c1 subclass'));

  ck('#99 from the sheet, the species window marks the chosen lineage',
     open(() => ctx.openRaceInfo('Elf')).html.includes('High Elf — selected'));
  const refRace = open(() => ctx.openRaceInfo('r2', {ref: true}));
  ck('#99 a species by id, in reference mode', refRace.title === 'Elf' && refRace.html.includes('New elf.') &&
     refRace.html.includes('35 ft') && !refRace.html.includes('— selected'));

  ck('#99 from the sheet, the background window shows your choices',
     open(() => ctx.openBackgroundInfo('Acolyte')).html.includes('Your choices'));
  const refBg = open(() => ctx.openBackgroundInfo('b1', {ref: true}));
  ck('#99 a background in reference mode shows its options, not your choices',
     refBg.title === 'Acolyte' && refBg.html.includes('Magic Initiate') && !refBg.html.includes('Your choices'));

  ck('#99 an unknown name still says so', open(() => ctx.openClassInfo('Nobody', {ref: true})).html.includes('No rules data loaded'));

  ctx.openModal = savedOM; X.rules = savedRules; X.character = savedChar;
}
```

In `src/tests/rules-data.js`, in the click-wiring checks (or a new block at the end of the file
before its summary), add:

```js
{
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  ck('#99 a subclass link from a reference window opens in reference mode',
     /data-sub-info[\s\S]{0,200}subRef\?\{ref:true\}/.test(boot));
}
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node src/tests/sheet.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `FAIL` lines for the `#99 by id…`, `reference mode…` and the species/background
reference checks. `./build.sh --no-zip && node src/tests/rules-data.js | grep …`: the `subRef` check fails.

- [ ] **Step 3: Implement**

`src/js/56-class.js`, `openSubclassInfo()` becomes:

```js
/* By the class's id or name; `{ref:true}` is the Rules tab's reference mode,
   which shows the rules without this character's level marks (#99). */
function openSubclassInfo(className,subName,opts){
  const ref=!!(opts&&opts.ref);
  const d=findClassDef(className),sc=subclassesFor(d)[subName];
  if(!sc){openModal(subName,`<p class="hint">No data for this subclass.</p>`);return;}
  const cn=d?String(d.name||className):String(className);
  const entry=ref?null:character.classes.find(c=>c.name===className||c.name===cn);
  let b=`<p class="hint" style="margin-bottom:6px">${esc(cn)} subclass</p><p>${esc(sc.description||"")}</p>`;
```

and the rest of the function is unchanged.

`openClassInfo()` becomes (only the marked lines change; everything between them stays):

```js
/* By id or name. The window speaks the entry's own name, so a Rules-tab row that
   passes an `_id` reads "Fighter", not "r12"; `{ref:true}` leaves the character
   out (#99). */
function openClassInfo(name,opts){
  const ref=!!(opts&&opts.ref);
  const d=findClassDef(name);
  if(!d){openModal(name,`<p class="hint">No rules data loaded for this class — it was added as a custom name.</p>`,iconSVG("classes",name,"lg"));return;}
  const nm=String(d.name||name);
  const entry=ref?null:(character.classes||[]).find(c=>String(c.name||"").toLowerCase()===nm.toLowerCase());
  let b=`<p>${esc(d.description||"")}</p>`;
```

then, in the rest of the function:
- `b+=tableChipsHTML(name,"class");` → `b+=tableChipsHTML(nm,"class");`
- the two `data-sub-info="${esc(name)}|${esc(entry.subclass)}"` / `data-change-sub="${esc(name)}"` /
  `data-choose-sub="${esc(name)}"` keep `name` → change them to `nm`.
- the subclass list line becomes:
  ``else b+=`<p class="hint"><b>Subclasses:</b> ${Object.keys(subMap).map(n=>`<span class="link" data-sub-info="${esc(ref?(d._id||nm):nm)}|${esc(n)}"${ref?` data-sub-ref="1"`:""}>${esc(n)}</span>`).join(", ")}</p>`;``
- the last line becomes `openModal(nm+(entry?\` ${num(entry.level)}\`:""),b,iconSVG("classes",nm,"lg"));`.

`src/js/52-race.js`, `openRaceInfo()`:

```js
/* By id or name; `{ref:true}` leaves the chosen lineage unmarked (#99). */
function openRaceInfo(name,opts){
  const ref=!!(opts&&opts.ref);
  const d=findRaceDef(name);
  if(!d){openModal(name,`<p class="hint">No rules data loaded for this ${raceTerm().toLowerCase()} — it was added as a custom name.</p>`,iconSVG("races",name,"lg"));return;}
  const nm=String(d.name||name);
  const cur=ref?null:(character.race&&character.race.subrace);
```

then `b+=tableChipsHTML(name,"race");` → `b+=tableChipsHTML(nm,"race");` and the last line
`openModal(name,b,iconSVG("races",name,"lg"));` → `openModal(nm,b,iconSVG("races",nm,"lg"));`.

`src/js/54-background.js`, `openBackgroundInfo()`: the signature becomes
`function openBackgroundInfo(name,opts){`, with `const ref=!!(opts&&opts.ref);` as its first line,
and `if(cur&&cur.name===d.name){` becomes `if(!ref&&cur&&cur.name===d.name){`. Add the one-line
comment `/* By id or name; \`{ref:true}\` leaves out your choices (#99). */` above it.

`src/js/90-boot.js`: the line
`if((m=t.closest("[data-sub-info]"))){const p=m.dataset.subInfo.split("|");return openSubclassInfo(p[0],p[1]);}`
becomes
`if((m=t.closest("[data-sub-info]"))){const p=m.dataset.subInfo.split("|");return openSubclassInfo(p[0],p.slice(1).join("|"),m.dataset.subRef?{ref:true}:undefined);}`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`
Expected: all suites pass (char-update.js pins `classChipHTML`'s `data-sub-info`, untouched here).

- [ ] **Step 5: Commit**

```bash
git add src/js/56-class.js src/js/52-race.js src/js/54-background.js src/js/90-boot.js src/tests/sheet.js src/tests/rules-data.js
git commit -m "feat(#99): the class, subclass, species and background windows open by id, and in reference mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The browser's pure half

**Files:**
- Create: `src/js/86-rules-browser.js`
- Modify: `src/manifest.json`, `CLAUDE.md` (`js/*.js  32 fragments` → `33 fragments`),
  `src/docs/ADR-001-source-split.md` (`js/ (32 fragments)` → `js/ (33 fragments)`),
  `src/docs/wiki/overview.md` (one code-map row), `src/docs/wiki/features/rules-and-tables.md`
  (the fragment on its **Code:** line)
- Test: `src/tests/rules-data.js`

**Interfaces:**
- Consumes: `itemFacets`, `spellFacets`, `featFacets`, `itemCatOf`, `itemRarOf`, `ITEM_RARITIES`,
  `spellSchoolOf`, `openItemInfo`, `openFeatInfo` (Task 1); the four windows with `{ref:true}`
  (Task 2); `subclassesFor`, `dispName`, `glossTerm`, `allTables`, `tableRows`, `TBL_KINDS`,
  `featPickKind`, `featKindDef`, `featPickPrereq`, `bgFeatList`, `sizeLabel`, `costToGp`,
  `openSpellView`, `openGlossView`, `openTableView`, `esc`, `num`.
- Produces: `RB_CATS`, `RB_PAGE` (300), `RB_HITS` (8), `rbUI`, `rbCat(k)`, `rbShown() → [{cat, rows}]`,
  `rbFacets(cat, rows)`, `rbState(k)`, `rbFacetVal(st, f)`, `rbPasses(cat, st, facets, r)`,
  `rbSorted(cat, st, rows)`, `rbSortBy(k, key)`, `rbToggleFacet(k, key, val)`, `rbClearFacets(k)`,
  `rbFindRow(k, id)`, `rbOpenRow(k, id)`, `rulesCatOf(s, shown)`, `rbSideHTML(shown, k)`,
  `rbHeadHTML(cat, total, q)`, `rbBodyHTML(cat, rows, st, facets)`, `rbSearchHTML(shown, q)`.
  A row is `{id, name, e, src, subj}` (plus `cls` for a subclass, `own` for the player's glossary
  entry); `subj` is what a shared picker facet matches on.

- [ ] **Step 1: Write the failing tests**

In `src/tests/rules-data.js`, add to its `loadApp` list:
`'RB_CATS', 'RB_PAGE', 'RB_HITS', 'rbUI', 'rbCat', 'rbShown', 'rbFacets', 'rbState', 'rbFacetVal', 'rbPasses', 'rbSorted', 'rbSortBy', 'rbToggleFacet', 'rbClearFacets', 'rbFindRow', 'rbOpenRow', 'rulesCatOf', 'rbSideHTML', 'rbHeadHTML', 'rbBodyHTML', 'rbSearchHTML',`.

Then append this block at the end of the file, before its summary/exit lines:

```js
// ---------- #99: the Rules tab browser, pure half (86-rules-browser.js)
{
  const savedRules = X.rules, savedChar = X.character, savedCat = X.settings.rulesCat, savedOM = ctx.openModal;
  let modal = null;
  ctx.openModal = (title, html) => { modal = {title, html}; };
  const pack = () => ({name: 'T',
    classes: [{_id: 'c1', name: 'Fighter', hitDie: 'd10', _source: 'SRD', subclasses: {Champion: {description: 'Crit.'}}},
              {_id: 'c2', name: 'Wizard', hitDie: 'd6', _source: 'SRD'}],
    subclasses: [{_id: 'sc1', class: 'Fighter', name: 'Battle Master', _source: 'XPHB'}],
    races: [{_id: 'r1', name: 'Elf', size: 'Medium', speed: '30 ft', description: 'Old.', _source: 'SRD'},
            {_id: 'r2', name: 'Elf', size: 'Medium', speed: '35 ft', description: 'New.', _source: 'XPHB'}],
    backgrounds: [{_id: 'b1', name: 'Acolyte', feat: 'Magic Initiate', _source: 'SRD'}],
    feats: [{_id: 'f1', name: 'Alert', description: 'Origin feat\nx', _source: 'SRD'},
            {_id: 'f2', name: 'Grappler', description: 'General feat · Prerequisite: Level 4+\ny', _source: 'XPHB'}],
    features: [{_id: 't1', name: 'Darkvision', source: 'Elf', _source: 'SRD'}],
    spells: [{_id: 's1', name: 'Fire Bolt', level: 0, meta: 'Evocation · Action · 120 feet', class: ['Wizard'], _source: 'SRD'},
             {_id: 's2', name: 'Bless', level: 1, meta: 'Enchantment · Action · 30 feet · Concentration', class: ['Cleric'], _source: 'SRD'},
             {_id: 's3', name: 'Fireball', level: 3, meta: 'Evocation · Action · 150 feet', class: ['Wizard'], _source: 'SRD'}],
    items: [{_id: 'i1', name: 'Rope', cost: '1 gp', _source: 'SRD'}, {_id: 'i2', name: 'Plate', category: 'Armor', cost: '1,500 gp', _source: 'SRD'},
            {_id: 'i3', name: 'Wand', category: 'Wondrous Item', rarity: 'Rare', _source: 'SRD'}, {_id: 'i4', name: 'Torch', cost: '1 cp', _source: 'SRD'}],
    keywords: [{_id: 'k1', term: 'Blinded', text: 'x', cond: true, _source: 'SRD'}, {_id: 'k2', term: 'Advantage', text: 'y', _source: 'SRD'},
               {term: 5}, null, 'Grappled'],
    tables: [{_id: 'tb1', name: 'Fighter Features', owner: 'Fighter', ownerKind: 'class', cols: ['Level'], rows: [['1'], ['2']], _source: 'SRD'},
             {_id: 'tb2', name: 'Trinkets', ownerKind: 'rule', rows: [['1']], _source: 'SRD'},
             {_id: 'tb3', name: 'Odd', rows: 'x', _source: 'SRD'}]});
  const fresh = () => { X.rules = pack(); ctx.recomputeDups(); X.rbUI.per = {}; X.rbUI.q = '';
    X.character = X.blankChar(); X.character.classes = [{name: 'Cleric', level: 1}];
    X.character.glossary = [{id: 'own1', term: 'Hexed', type: 'text', text: 'm'}, {id: 'own0', type: 'text', text: 'no term'}]; };
  fresh();
  const keys = () => X.rbShown().map(x => x.cat.k);
  const rows = k => X.rbShown().find(x => x.cat.k === k).rows;
  const names = rs => JSON.stringify(rs.map(r => r.name));

  ck('#99 the categories, in order', JSON.stringify(keys()) ===
     '["classes","subclasses","races","backgrounds","feats","features","spells","items","conditions","glossary","tables"]', keys());
  ck('#99 every category: Name first, a Source column, a window', X.RB_CATS.every(c =>
     c.cols[0].key === 'name' && c.cols.some(x => x.key === 'src') && typeof c.open === 'function'));
  X.rules.feats = [];
  ck('#99 an empty category is not listed', !keys().includes('feats'));
  X.rules = {name: 'none'}; ctx.recomputeDups(); X.character.glossary = [];
  ck('#99 ...but the Glossary always is, for its + Add', JSON.stringify(keys()) === '["glossary"]', keys());
  fresh();

  ck('#99 subclasses: the class\'s own and the loose ones, by class then name',
     names(X.rbSorted(X.rbCat('subclasses'), X.rbState('subclasses'), rows('subclasses'))) === '["Battle Master","Champion"]');
  ck('#99 same-named species from two packs are two rows', names(rows('races')) === '["Elf (SRD)","Elf (XPHB)"]' &&
     JSON.stringify(rows('races').map(r => r.id)) === '["r1","r2"]');
  ck('#99 Conditions are the glossary terms marked cond', names(rows('conditions')) === '["Blinded"]');
  ck('#99 Glossary: the other pack terms and your own, malformed ones skipped', names(rows('glossary')) === '["Advantage","Hexed",""]' &&
     rows('glossary').filter(r => r.own).length === 2 && rows('glossary')[1].src === 'Yours');
  ck('#99 a table whose rows are not a list counts 0', X.RB_CATS.find(c => c.k === 'tables').cols.find(c => c.key === 'rows').get(rows('tables')[2]) === '0');
  ck('#99 tables sort by kind, then name', names(X.rbSorted(X.rbCat('tables'), X.rbState('tables'), rows('tables'))) === '["Fighter Features","Trinkets","Odd"]');

  const sp = X.rbCat('spells');
  ck('#99 spells sort by level, cantrips first', names(X.rbSorted(sp, X.rbState('spells'), rows('spells'))) === '["Fire Bolt","Bless","Fireball"]');
  const body = X.rbBodyHTML(sp, rows('spells'), X.rbState('spells'), X.rbFacets(sp, rows('spells')));
  ck('#99 the sorted column says so', /<th aria-sort="ascending"><button type="button" class="rb-sort" data-rbsort="lvl">Level ▲/.test(body), body.slice(0, 600));
  X.rbSortBy('spells', 'name');
  ck('#99 tap a header to sort by it', names(X.rbSorted(sp, X.rbState('spells'), rows('spells'))) === '["Bless","Fire Bolt","Fireball"]');
  X.rbSortBy('spells', 'name');
  ck('#99 ...tap again to reverse', names(X.rbSorted(sp, X.rbState('spells'), rows('spells'))) === '["Fireball","Fire Bolt","Bless"]');
  const it = X.rbCat('items');
  X.rbSortBy('items', 'cost');
  ck('#99 cost sorts by gold value, blanks last', names(X.rbSorted(it, X.rbState('items'), rows('items'))) === '["Torch","Rope","Plate","Wand"]');
  X.rbSortBy('items', 'cost');
  ck('#99 ...and blanks stay last reversed', names(X.rbSorted(it, X.rbState('items'), rows('items'))) === '["Plate","Rope","Torch","Wand"]');

  const sf = X.rbFacets(sp, rows('spells'));
  ck('#99 spells filter as the picker does', JSON.stringify(sf.map(f => f.key)) === '["level","class","school","conc"]');
  ck('#99 a lookup starts on every class, not this character\'s', X.rbFacetVal(X.rbState('spells'), sf[1]).size === 0);
  X.rbToggleFacet('spells', 'school', 'evocation');
  const pass = k => { const c = X.rbCat(k), st = X.rbState(k), f = X.rbFacets(c, rows(k)); return rows(k).filter(r => X.rbPasses(c, st, f, r)); };
  ck('#99 a facet narrows the table', names(pass('spells')) === '["Fire Bolt","Fireball"]');
  X.rbToggleFacet('spells', 'school', 'evocation');
  ck('#99 ...and tapping it again clears it', pass('spells').length === 3);
  X.rbToggleFacet('spells', 'conc', null);
  ck('#99 a toggle facet', names(pass('spells')) === '["Bless"]');
  X.rbClearFacets('spells');
  ck('#99 clear empties every facet', pass('spells').length === 3);
  X.rbState('spells').q = 'fire';
  ck('#99 a category\'s own search', names(pass('spells')) === '["Fire Bolt","Fireball"]');
  X.rbState('spells').q = '';

  ck('#99 one pack, no Pack filter', !X.rbFacets(it, rows('items')).some(f => f.key === 'pack'));
  ck('#99 two packs, a Pack filter', X.rbFacets(X.rbCat('races'), rows('races')).some(f => f.key === 'pack'));
  ck('#99 feats keep their own Pack filter, not a second one',
     X.rbFacets(X.rbCat('feats'), rows('feats')).filter(f => f.key === 'pack').length === 1);
  X.rbToggleFacet('glossary', 'own', null);
  ck('#99 Your entries narrows the Glossary to yours', pass('glossary').every(r => r.own) && pass('glossary').length === 2);
  X.rbClearFacets('glossary');

  const gl = X.rbBodyHTML(X.rbCat('glossary'), rows('glossary'), X.rbState('glossary'), X.rbFacets(X.rbCat('glossary'), rows('glossary')));
  ck('#99 your own entries keep Preview, Edit and Delete', /data-view-gloss="own1"/.test(gl) && /data-edit-gloss="own1"/.test(gl) && /data-del-gloss="own0"/.test(gl));
  ck('#99 an entry with no term is listed, to be fixed', /\(no term\)/.test(gl));
  ck('#99 a pack term has no Edit', !/data-edit-gloss="k2"/.test(gl));
  ck('#99 + Add lives on the Glossary\'s header only',
     X.rbHeadHTML(X.rbCat('glossary'), 3, '').includes('id="btnAddGloss"') && !X.rbHeadHTML(sp, 3, '').includes('btnAddGloss'));
  ck('#99 a category\'s search box keeps its text and has a clear button',
     /<div class="searchbox[^"]*"><input id="rbCatSearch"[^>]*value="fi&quot;re"[^>]*><button type="button" class="search-clear"/.test(X.rbHeadHTML(sp, 3, 'fi"re')));

  const many = Array.from({length: 650}, (_, i) => ({_id: 'm' + i, name: 'Item ' + i, _source: 'SRD'}));
  X.rules.items = many;
  const mst = X.rbState('items'); mst.sort = null;
  let mb = X.rbBodyHTML(it, rows('items'), mst, X.rbFacets(it, rows('items')));
  ck('#99 a long table shows 300, then Show 300 more', (mb.match(/<tr data-rbrow=/g) || []).length === 300 && mb.includes('Show 300 more'));
  mst.shown = 600; mb = X.rbBodyHTML(it, rows('items'), mst, X.rbFacets(it, rows('items')));
  ck('#99 ...then Show 50 more', (mb.match(/<tr data-rbrow=/g) || []).length === 600 && mb.includes('Show 50 more'));
  mst.shown = 900; mb = X.rbBodyHTML(it, rows('items'), mst, X.rbFacets(it, rows('items')));
  ck('#99 ...then no button', !mb.includes('data-rbmore'));
  fresh();

  X.rules.spells = Array.from({length: 10}, (_, i) => ({_id: 'b' + i, name: 'Bolt ' + i, level: 1, _source: 'SRD'}));
  const sh = X.rbSearchHTML(X.rbShown(), 'bolt');
  ck('#99 search everything: 8 rows a category, then a link that carries on',
     (sh.match(/data-rbhitcat="spells"/g) || []).length === 8 && sh.includes('data-rbmorein="spells"') && sh.includes('2 more in Spells →'));
  ck('#99 search everything finds names in every category', X.rbSearchHTML(X.rbShown(), 'elf').includes('data-rbhit="r2"'));
  ck('#99 search everything, nothing found', X.rbSearchHTML(X.rbShown(), 'zzz').includes('No matches'));
  fresh();

  const side = X.rbSideHTML(X.rbShown(), 'spells');
  ck('#99 the open category is marked', /class="rb-cat on" data-rbcat="spells" aria-current="true"/.test(side) && !/data-rbcat="items" aria-current/.test(side));
  ck('#99 each category shows its count', /data-rbcat="spells"[^>]*><span class="rb-cn">Spells<\/span><span class="cnt">3<\/span>/.test(side));
  ck('#99 the stored category, or the first listed',
     X.rulesCatOf({rulesCat: 'spells'}, X.rbShown()) === 'spells' && X.rulesCatOf({rulesCat: 'nope'}, X.rbShown()) === 'classes' &&
     X.rulesCatOf({}, X.rbShown()) === 'classes' && X.rulesCatOf({rulesCat: '__proto__'}, X.rbShown()) === 'classes' && X.rulesCatOf(null, X.rbShown()) === 'classes');
  X.rules.feats = [];
  ck('#99 a stored category that is now empty falls back', X.rulesCatOf({rulesCat: 'feats'}, X.rbShown()) === 'classes');
  fresh();

  ck('#99 every row is found again by its id', X.rbShown().every(({cat, rows: rs}) => rs.every(r => X.rbFindRow(cat.k, r.id) && X.rbFindRow(cat.k, r.id).id === r.id)));
  modal = null; X.rbOpenRow('races', 'r2');
  ck('#99 a row opens its own entry', !!modal && modal.title === 'Elf' && modal.html.includes('New.'));
  modal = null; X.rbOpenRow('classes', 'c1');
  ck('#99 a class opens in reference mode', !!modal && modal.title === 'Fighter');
  modal = null; X.rbOpenRow('spells', 'nope');
  ck('#99 an unknown id opens nothing', modal === null);

  ctx.openModal = savedOM; X.rules = savedRules; X.character = savedChar; X.settings.rulesCat = savedCat; X.rbUI.per = {}; X.rbUI.q = '';
}
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `LOAD FAIL` naming `RB_CATS`.

- [ ] **Step 3: Implement**

In `src/manifest.json`'s `js` list, add `"src/js/86-rules-browser.js"` immediately after
`"src/js/86-tables.js"`.

Create `src/js/86-rules-browser.js`:

```js
/* ================= the Rules tab: a browser over the loaded rules (#99, #53) =================
   Every category the packs hold, in one fixed order, each a sortable table with
   its own search and the Add pickers' filters; a row opens the window the sheet
   already uses for that entry. It is for reading: the only writes are the
   glossary's own + Add, Edit and Delete, which the old Glossary card had.

   The pure half (rows, filters, sorting, markup strings, state) comes first, so
   the harness can assert all of it. The DOM half paints #rbSide, #rbMain and
   #rbBody and nothing else. Pack fields are someone else's file (#71): read
   through rbStr() and the named helpers, never raw. */

/* ---- reading a category ---- */
function rbList(kind){return (Array.isArray(rules[kind])?rules[kind]:[]).filter(e=>e&&typeof e==="object"&&!Array.isArray(e));}
function rbStr(v){return typeof v==="string"?v.trim():(typeof v==="number"&&isFinite(v)?String(v):"");}
function rbSrc(e){return rbStr(e&&e._source);}
/* the display name: dispName() adds "(SRC)" only when two packs share a name */
function rbName(e,kind){
  const nm=kind==="keywords"?glossTerm(e):rbStr(e&&e.name);
  return nm?String(dispName({name:nm,term:nm,_source:e._source},kind)):"";
}
function rbRow(e,kind,extra){
  const nm=kind==="keywords"?glossTerm(e):rbStr(e.name);
  return Object.assign({id:String(rbStr(e._id)||nm),name:rbName(e,kind),e,src:rbSrc(e),subj:e},extra||{});
}
function rbNum(v){const n=parseFloat(String(v==null?"":v).replace(/[^0-9.\-]/g,""));return isNaN(n)?null:n;}
function rbTblKind(t){const i=TBL_KINDS.findIndex(([k])=>k===t.ownerKind);return i<0?TBL_KINDS.length:i;}
/* a shared picker facet matches an entry (or a feat's {k,e}); the browser hands
   it the row, so this unwraps */
function rbWrap(facets){return facets.map(f=>Object.assign({},f,{match:(r,a)=>f.match(r.subj,a)}));}

const RB_NAME={key:"name",label:"Name",get:r=>r.name};
const RB_SOURCE={key:"src",label:"Source",get:r=>r.src};
const RB_PAGE=300, RB_HITS=8;
/* The categories, in the order the sidebar lists them. `rows` builds the rows,
   `cols` the columns (`get` is the cell, `sort` the value to sort by when it is
   not the cell), `keys` sort values that are not columns, `order` the default
   sort, `facets` the filters, `open` the window a row opens. */
const RB_CATS=[
  {k:"classes",title:"Classes",
   rows:()=>rbList("classes").map(e=>rbRow(e,"classes")).filter(r=>r.name),
   cols:[RB_NAME,{key:"hd",label:"Hit die",get:r=>rbStr(r.e.hitDie),sort:r=>rbNum(r.e.hitDie)},RB_SOURCE],
   open:r=>openClassInfo(r.e._id||r.e.name,{ref:true})},
  {k:"subclasses",title:"Subclasses",
   /* what subclassesFor() gives each class: its own subclasses and the loose
      ones, keyed as the class window keys them */
   rows:()=>{const out=[];rbList("classes").forEach(d=>{const m=subclassesFor(d);Object.keys(m).forEach(k=>{
     const sc=m[k];if(!sc||typeof sc!=="object"||!k)return;
     out.push({id:"sub:"+(rbStr(d._id)||rbStr(d.name))+"|"+k,name:k,e:sc,cls:d,src:rbSrc(sc)||rbSrc(d),subj:sc});});});return out;},
   cols:[RB_NAME,{key:"cls",label:"Class",get:r=>rbStr(r.cls.name)},RB_SOURCE],
   facets:list=>{const cl=[...new Set(list.map(r=>rbStr(r.cls.name)).filter(Boolean))].sort();
     return [{key:"cls",label:"Class",type:"multi",options:cl.map(c=>({value:c.toLowerCase(),label:c})),match:(r,a)=>a.has(rbStr(r.cls.name).toLowerCase())}];},
   order:{key:"cls",dir:1},
   open:r=>openSubclassInfo(r.cls._id||r.cls.name,r.name,{ref:true})},
  {k:"races",title:"Species",
   rows:()=>rbList("races").map(e=>rbRow(e,"races")).filter(r=>r.name),
   cols:[RB_NAME,{key:"size",label:"Size",get:r=>rbStr(sizeLabel(r.e.size))},{key:"speed",label:"Speed",get:r=>rbStr(r.e.speed),sort:r=>rbNum(r.e.speed)},RB_SOURCE],
   open:r=>openRaceInfo(r.e._id||r.e.name,{ref:true})},
  {k:"backgrounds",title:"Backgrounds",
   rows:()=>rbList("backgrounds").map(e=>rbRow(e,"backgrounds")).filter(r=>r.name),
   cols:[RB_NAME,{key:"feat",label:"Feat",get:r=>bgFeatList(r.e).map(rbStr).filter(Boolean).join(" or ")},RB_SOURCE],
   open:r=>openBackgroundInfo(r.e._id||r.e.name,{ref:true})},
  {k:"feats",title:"Feats",
   rows:()=>rbList("feats").map(e=>rbRow(e,"feats",{subj:{k:"feat",e}})).filter(r=>r.name),
   cols:[RB_NAME,{key:"type",label:"Type",get:r=>featKindDef(featPickKind(r.subj)).label},{key:"pre",label:"Prerequisite",get:r=>featPickPrereq(r.subj)},RB_SOURCE],
   facets:list=>rbWrap(featFacets(list.map(r=>r.subj))),
   open:r=>openFeatInfo(r.subj)},
  {k:"features",title:"Traits",
   rows:()=>rbList("features").map(e=>rbRow(e,"features",{subj:{k:"trait",e}})).filter(r=>r.name),
   cols:[RB_NAME,{key:"from",label:"From",get:r=>rbStr(r.e.source)},RB_SOURCE],
   open:r=>openFeatInfo(r.subj)},
  {k:"spells",title:"Spells",
   rows:()=>rbList("spells").map(e=>rbRow(e,"spells")).filter(r=>r.name),
   cols:[RB_NAME,{key:"lvl",label:"Level",get:r=>num(r.e.level)===0?"Cantrip":String(num(r.e.level)),sort:r=>num(r.e.level)},
         {key:"school",label:"School",get:r=>spellSchoolOf(r.e)},{key:"time",label:"Time",get:r=>rbStr(String(rbStr(r.e.meta)).split("·")[1])},RB_SOURCE],
   facets:list=>rbWrap(spellFacets(list.map(r=>r.e),{classDefault:"all"})),
   order:{key:"lvl",dir:1},
   open:r=>openSpellView({name:rbStr(r.e.name),level:num(r.e.level),meta:rbStr(r.e.meta),text:rbStr(r.e.text)})},
  {k:"items",title:"Items",
   rows:()=>rbList("items").map(e=>rbRow(e,"items")).filter(r=>r.name),
   cols:[RB_NAME,{key:"cat",label:"Category",get:r=>rbStr(itemCatOf(r.e))},
         {key:"rar",label:"Rarity",get:r=>rbStr(itemRarOf(r.e)),sort:r=>{const i=ITEM_RARITIES.indexOf(itemRarOf(r.e));return i<0?ITEM_RARITIES.length:i;}},
         {key:"cost",label:"Cost",get:r=>rbStr(r.e.cost),sort:r=>{const g=costToGp(r.e.cost);return typeof g==="number"&&isFinite(g)?g:null;}},RB_SOURCE],
   facets:list=>rbWrap(itemFacets(list.map(r=>r.e))),
   open:r=>openItemInfo(r.e)},
  {k:"conditions",title:"Conditions",
   rows:()=>rbList("keywords").filter(g=>g.cond===true&&glossTerm(g)).map(g=>rbRow(g,"keywords")),
   cols:[RB_NAME,RB_SOURCE],
   open:r=>openGlossView(r.e)},
  {k:"glossary",title:"Glossary",
   /* the pack's other terms, then the player's own — listed even with no term,
      because Edit is how one gets a term (#71) */
   rows:()=>{
     const pack=rbList("keywords").filter(g=>g.cond!==true&&glossTerm(g)).map(g=>rbRow(g,"keywords"));
     const own=(Array.isArray(character.glossary)?character.glossary:[]).filter(g=>g&&typeof g==="object"&&!Array.isArray(g))
       .map(g=>({id:"own:"+rbStr(g.id),name:glossTerm(g),e:g,src:"Yours",own:true,subj:g}));
     return pack.concat(own);},
   cols:[{key:"name",label:"Term",get:r=>r.name},{key:"type",label:"Type",get:r=>r.e.type==="image"?"Image":"Text"},RB_SOURCE],
   facets:()=>[{key:"own",label:"Your entries",type:"toggle",match:r=>!!r.own}],
   open:r=>openGlossView(r.e)},
  {k:"tables",title:"Tables",
   rows:()=>allTables().filter(t=>t&&typeof t==="object"&&!Array.isArray(t)).map(t=>rbRow(t,"tables")).filter(r=>r.name),
   cols:[RB_NAME,{key:"rows",label:"Rows",get:r=>String(tableRows(r.e).length),sort:r=>tableRows(r.e).length},{key:"from",label:"From",get:r=>rbStr(r.e.owner)},RB_SOURCE],
   keys:[{key:"kind",sort:r=>rbTblKind(r.e)}],
   facets:list=>{
     const opts=TBL_KINDS.filter(([k])=>list.some(r=>r.e.ownerKind===k)).map(([k,l])=>({value:k,label:l}));
     if(list.some(r=>rbTblKind(r.e)===TBL_KINDS.length))opts.push({value:"other",label:"Other"});
     return [{key:"kind",label:"Kind",type:"multi",options:opts,match:(r,a)=>a.has(rbTblKind(r.e)===TBL_KINDS.length?"other":String(r.e.ownerKind))}];},
   order:{key:"kind",dir:1},
   open:r=>openTableView(r.e)}
];
function rbCat(k){return RB_CATS.find(c=>c.k===k)||null;}
/* the categories the sidebar lists, with their rows; the Glossary always, so
   its + Add is always reachable */
function rbShown(){return RB_CATS.map(cat=>({cat,rows:cat.rows()})).filter(x=>x.rows.length||x.cat.k==="glossary");}
/* The last category opened, if it is still listed; else the first. */
function rulesCatOf(s,shown){
  const k=s&&typeof s.rulesCat==="string"?s.rulesCat:"";
  return shown.some(x=>x.cat.k===k)?k:(shown[0]?shown[0].cat.k:"");
}
function rbFindRow(k,id){const c=rbCat(k);return c?(c.rows().find(r=>r.id===id)||null):null;}
function rbOpenRow(k,id){const c=rbCat(k),r=rbFindRow(k,id);if(c&&r)c.open(r);}

/* ---- filters: the category's own, and Pack when its rows span two packs ---- */
function rbFacets(cat,rows){
  const fs=cat.facets?cat.facets(rows):[];
  const srcs=[...new Set(rows.map(r=>r.src).filter(s=>s&&s!=="Yours"))].sort();
  if(srcs.length>1&&!fs.some(f=>f.key==="pack"))fs.push({key:"pack",label:"Pack",type:"multi",
    options:srcs.map(s=>({value:s.toLowerCase(),label:s})),match:(r,a)=>a.has(String(r.src).toLowerCase())});
  return fs;
}

/* ---- state: in memory for the session; only the category is saved ---- */
const rbUI={per:{},q:"",screen:"list"};
function rbState(k){
  if(!rbUI.per[k])rbUI.per[k]={q:"",facets:{},sort:null,shown:RB_PAGE,showFilters:false};
  return rbUI.per[k];
}
/* a facet's value, from its default the first time it is read */
function rbFacetVal(st,f){
  if(!(f.key in st.facets))st.facets[f.key]=f.type==="toggle"?!!f.default:new Set((f.default||[]).map(String));
  return st.facets[f.key];
}
function rbRowText(cat,r){return cat.cols.map(c=>c.get(r)).join(" ");}
function rbPasses(cat,st,facets,r){
  if(st.q){if(!rbRowText(cat,r).toLowerCase().includes(String(st.q).trim().toLowerCase()))return false;}
  for(const f of facets){const v=rbFacetVal(st,f);
    if(f.type==="toggle"){if(v&&!f.match(r,true))return false;}
    else if(v.size&&!f.match(r,v))return false;}
  return true;
}
function rbToggleFacet(k,key,val){
  const cat=rbCat(k);if(!cat)return;
  const f=rbFacets(cat,cat.rows()).find(x=>x.key===key);if(!f)return;
  const st=rbState(k),v=rbFacetVal(st,f);
  if(f.type==="toggle")st.facets[key]=!v;
  else{const s=String(val);if(v.has(s))v.delete(s);else v.add(s);}
  st.shown=RB_PAGE;
}
function rbClearFacets(k){
  const cat=rbCat(k);if(!cat)return;
  const st=rbState(k);
  rbFacets(cat,cat.rows()).forEach(f=>{st.facets[f.key]=f.type==="toggle"?false:new Set();});
  st.shown=RB_PAGE;
}

/* ---- sorting: numbers as numbers, blanks last whichever way, then by name ---- */
function rbSortVal(cat,key,r){
  const c=cat.cols.find(x=>x.key===key)||(cat.keys||[]).find(x=>x.key===key);
  if(!c)return "";
  return c.sort?c.sort(r):c.get(r);
}
function rbCompare(a,b){
  if(typeof a==="number"&&typeof b==="number")return a-b;
  return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:"base"});
}
function rbSortOf(cat,st){return st.sort||cat.order||{key:"name",dir:1};}
function rbSorted(cat,st,rows){
  const s=rbSortOf(cat,st);
  return rows.slice().sort((x,y)=>{
    const va=rbSortVal(cat,s.key,x),vb=rbSortVal(cat,s.key,y);
    const ea=va==null||va==="",eb=vb==null||vb==="";
    if(ea!==eb)return ea?1:-1;
    return (ea?0:s.dir*rbCompare(va,vb))||rbCompare(x.name,y.name);
  });
}
function rbSortBy(k,key){
  const cat=rbCat(k);if(!cat)return;
  const st=rbState(k),cur=rbSortOf(cat,st);
  st.sort=cur.key===key?{key,dir:-cur.dir}:{key,dir:1};
  st.shown=RB_PAGE;
}

/* ---- markup: pure strings ---- */
const RB_EYE=`<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const RB_PEN=`<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
const RB_BIN=`<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>`;
const RB_NOTERM=`<em title="This entry has no term, so it never shows up in your text. Edit it to give it one.">(no term)</em>`;
function rbSideHTML(shown,active){
  return `<div class="rb-cats">`+shown.map(({cat,rows})=>{const on=cat.k===active;
    return `<button type="button" class="rb-cat${on?" on":""}" data-rbcat="${esc(cat.k)}"${on?` aria-current="true"`:""}><span class="rb-cn">${esc(cat.title)}</span><span class="cnt">${esc(String(rows.length))}</span></button>`;
  }).join("")+`</div>`;
}
/* The pane's fixed top: back, title, + Add, the search box. Built when the
   category changes, never while typing, so the box keeps focus and caret. */
function rbHeadHTML(cat,total,q){
  const gl=cat.k==="glossary";
  return `<div class="rb-head"><button type="button" class="tbtn rb-back" data-rbback>← Categories</button>`+
    `<h3 class="rb-title" id="rbTitle" tabindex="-1">${esc(cat.title)} <span class="cnt">(${esc(String(total))})</span></h3>`+
    (gl?`<button type="button" class="add" id="btnAddGloss"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add</button>`:"")+`</div>`+
    (gl?`<p class="hint">Terms here become tappable ❧ wherever they appear in your notes, features, spells and item descriptions.</p>`:"")+
    `<div class="searchbox rb-catsearch"><input id="rbCatSearch" placeholder="Search ${esc(cat.title.toLowerCase())}…" value="${esc(q||"")}" autocomplete="off" aria-label="Search ${esc(cat.title)}"><button type="button" class="search-clear" aria-label="Clear the search" title="Clear">×</button></div>`+
    `<div id="rbBody"></div>`;
}
function rbFacetsHTML(st,facets){
  return facets.map(f=>{const v=rbFacetVal(st,f);
    if(f.type==="toggle")return `<div class="fgrp"><span class="flbl">&nbsp;</span><button type="button" class="fpill${v?" on":""}" data-rbtoggle="${esc(f.key)}" aria-pressed="${v?"true":"false"}">${esc(f.label)}</button></div>`;
    return `<div class="fgrp"><span class="flbl">${esc(f.label)}</span>`+(f.options||[]).map(o=>{const on=v.has(String(o.value));
      return `<button type="button" class="fpill${on?" on":""}" data-rbfacet="${esc(f.key)}" data-rbval="${esc(String(o.value))}" aria-pressed="${on?"true":"false"}">${esc(o.label)}</button>`;}).join("")+`</div>`;
  }).join("");
}
function rbActiveCount(st,facets){return facets.reduce((n,f)=>{const v=rbFacetVal(st,f);return n+(f.type==="toggle"?(v?1:0):v.size);},0);}
function rbThHTML(cat,st,c){
  const s=rbSortOf(cat,st),on=s.key===c.key,up=s.dir>0;
  return `<th${on?(up?` aria-sort="ascending"`:` aria-sort="descending"`):""}><button type="button" class="rb-sort" data-rbsort="${esc(c.key)}">${esc(c.label)}${on?(up?" ▲":" ▼"):""}</button></th>`;
}
function rbOwnActsHTML(g){
  const id=rbStr(g.id);
  return `<button class="icon" data-view-gloss="${esc(id)}" aria-label="Preview">${RB_EYE}</button>`+
    `<button class="icon" data-edit-gloss="${esc(id)}" aria-label="Edit">${RB_PEN}</button>`+
    `<button class="icon danger" data-del-gloss="${esc(id)}" aria-label="Delete">${RB_BIN}</button>`;
}
function rbRowHTML(cat,r){
  const cells=cat.cols.map((c,i)=>{const v=c.get(r);
    return i===0?`<td><button type="button" class="rb-open">${v?esc(v):RB_NOTERM}</button></td>`:`<td>${esc(v)}</td>`;}).join("");
  const acts=cat.k==="glossary"?`<td class="rb-acts">${r.own?rbOwnActsHTML(r.e):""}</td>`:"";
  return `<tr data-rbrow="${esc(r.id)}">${cells}${acts}</tr>`;
}
/* What repaints on a filter, a sort, a search or Show more. */
function rbBodyHTML(cat,rows,st,facets){
  const list=rbSorted(cat,st,rows.filter(r=>rbPasses(cat,st,facets,r)));
  const shown=list.slice(0,st.shown);
  const n=rbActiveCount(st,facets);
  let h="";
  if(facets.length){
    h+=`<div class="rb-fbar"><button type="button" class="fpill" data-rbfilters aria-expanded="${st.showFilters?"true":"false"}">Filters${n?` (${esc(String(n))})`:""}</button>`+
      (n?`<button type="button" class="fpill clear" data-rbclear>Clear</button>`:"")+`</div>`;
    if(st.showFilters)h+=`<div class="rb-facets">${rbFacetsHTML(st,facets)}</div>`;
  }
  h+=`<div class="rb-count">${esc(String(list.length))} of ${esc(String(rows.length))}</div>`;
  if(!list.length)return h+`<div class="empty">No matches.</div>`;
  h+=`<div class="tbl-wrap rb-tblwrap"><table class="rtbl rb-tbl"><thead><tr>${cat.cols.map(c=>rbThHTML(cat,st,c)).join("")}${cat.k==="glossary"?`<th aria-label="Actions"></th>`:""}</tr></thead>`+
    `<tbody>${shown.map(r=>rbRowHTML(cat,r)).join("")}</tbody></table></div>`;
  if(list.length>shown.length)h+=`<button type="button" class="tbtn rb-more" data-rbmore>Show ${esc(String(Math.min(RB_PAGE,list.length-shown.length)))} more</button>`;
  return h;
}
/* The sidebar while its box has text: every listed category's matching names,
   up to RB_HITS each, then a link into the category with the text carried over. */
function rbSearchHTML(shown,q){
  const s=String(q||"").trim().toLowerCase();
  let h="";
  shown.forEach(({cat,rows})=>{
    const hits=rows.filter(r=>String(r.name||"").toLowerCase().includes(s)).sort((a,b)=>rbCompare(a.name,b.name));
    if(!hits.length)return;
    h+=`<div class="rb-sgroup"><div class="spell-h">${esc(cat.title)} (${esc(String(hits.length))})</div>`+
      hits.slice(0,RB_HITS).map(r=>`<button type="button" class="rb-hit" data-rbhit="${esc(r.id)}" data-rbhitcat="${esc(cat.k)}">${r.name?esc(r.name):RB_NOTERM}</button>`).join("")+
      (hits.length>RB_HITS?`<button type="button" class="linkbtn rb-morein" data-rbmorein="${esc(cat.k)}">${esc(String(hits.length-RB_HITS))} more in ${esc(cat.title)} →</button>`:"")+`</div>`;
  });
  return h||`<div class="empty">No matches.</div>`;
}
```

Docs (keeps the `docs` suite green):
- `CLAUDE.md`: in the tree under "Where to edit what", `js/*.js                32 fragments` → `33 fragments`
  (keep the alignment).
- `src/docs/ADR-001-source-split.md`: `js/ (32 fragments)` → `js/ (33 fragments)`.
- `src/docs/wiki/overview.md`: after the `86-tables.js` row of the code map, add
  `| \`86-rules-browser.js\` | the Rules tab browser: \`RB_CATS\`, \`rbShown()\` | [Rules & tables](features/rules-and-tables.md) |`
  (Task 4 adds `renderRulesBrowser()` to it once that function exists).
- `src/docs/wiki/features/rules-and-tables.md`: on its **Code:** line, add
  `` · `RB_CATS`, `rbShown()`, `rbBodyHTML()`, `rbSearchHTML()` in `86-rules-browser.js` ``.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `ALL PASSED`. Then `PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`: all suites pass (the `docs` suite checks the counts and coverage).

- [ ] **Step 5: Commit**

```bash
git add src/js/86-rules-browser.js src/manifest.json CLAUDE.md src/docs/ADR-001-source-split.md src/docs/wiki/overview.md src/docs/wiki/features/rules-and-tables.md src/tests/rules-data.js
git commit -m "feat(#99): the Rules browser's categories, filters, sorting and markup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The tab: markup, painting, taps, the flyout, CSS; the old tab removed

**Files:**
- Modify: `src/html/40-rules.html` (whole panel), `src/js/86-rules-browser.js` (the DOM half,
  appended), `src/js/86-tables.js` (remove the folding and `renderTables()`), `src/js/60-attacks.js`
  (remove `renderGloss()`), `src/js/66-coins-hp.js` (`renderAll()`), `src/js/88-settings.js`
  (`refreshRulesUI()`, `SETTINGS_KEYS`), `src/js/85-browse.js` (`openGlossForm()`'s save),
  `src/js/40-sheet.js` (`buildToc()`), `src/js/90-boot.js`, `src/css/35-tables.css`,
  `src/css/20-cards.css` (remove `.rules-head`), `src/docs/wiki/features/rules-and-tables.md`,
  `src/docs/wiki/ui/sections-and-layout.md`, `src/docs/wiki/overview.md`
- Test: `src/tests/rules-data.js`, `src/tests/sheet.js`

**Interfaces:**
- Consumes: everything Task 3 produces.
- Produces: `renderRulesBrowser()`, `rbPaintSide(shown, k)`, `rbRefreshBody()`, `rbCurKey()`,
  `rbOpenCat(k, focus)`, `rbBack()`, `rbMoreIn(k)`.

- [ ] **Step 1: Write the failing tests**

`src/tests/rules-data.js`:
- Remove `'rulesSecOpen', 'setRulesSecOpen', 'RULES_SECS',` from its `loadApp` list (keep the other
  names on that line), and add `'renderRulesBrowser', 'rbCurKey',`.
- Delete the whole block that tests `rulesSecOpen` / `RULES_SECS` / `S.rulesCollapse` (it begins a
  few lines above `S.rulesCollapse = {};` and `ck('both sections start collapsed', …)` and ends after
  the last `S.rulesCollapse = {};`). Replace it with:

```js
// ---------- #99: the Rules tab's shell, and what left with the old cards
{
  const t = loadHTML();
  const at = t.indexOf('id="tab-rules"'), end = t.indexOf('<section class="tabpanel', at + 1);
  const panel = at < 0 ? '' : t.slice(at, end < 0 ? undefined : end);
  ck('#99 the Rules tab holds the browser',
     ['id="rbCard"', 'data-screen="list"', 'id="rbSide"', 'id="rbMain"', 'id="rbEmpty"', 'id="rbSearch"', 'id="rbRulesFiles"']
       .every(s => panel.includes(s)), panel.slice(0, 500));
  ck('#99 the old cards are gone',
     !/id="(glossSearch|tablesSearch|glossList|tablesList|glossRulesFiles|tablesRulesFiles)"|data-rulessec|data-rulesbody/.test(t));
  const js = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8')).js
    .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  ck('#99 nothing calls the old renderers or folds',
     !/\b(renderGloss|renderTables|renderRulesSections|toggleRulesSec|rulesSecOpen|setRulesSecOpen)\s*\(|RULES_SECS|rulesCollapse/.test(js));
  const settingsJs = fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8');
  ck('#99 the category is a setting that exports, the old folds are not',
     /SETTINGS_KEYS=\[[^\]]*"rulesCat"/.test(settingsJs) && !/SETTINGS_KEYS=\[[^\]]*"rulesCollapse"/.test(settingsJs));
  const css = fs.readFileSync(path.join(ROOT, 'src/css/35-tables.css'), 'utf8');
  ck('#99 narrow screens show one pane at a time',
     /@media\(max-width:640px\)\{[\s\S]*#rbCard\[data-screen="list"\] \.rb-main\{display:none\}[\s\S]*#rbCard\[data-screen="table"\] \.rb-side\{display:none\}/.test(css));
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  const at2 = s => boot.indexOf(s);
  ck('#99 the glossary\'s own buttons are matched before the row they sit in',
     at2('[data-edit-gloss]') > 0 && at2('[data-del-gloss]') > 0 && at2('[data-rbrow]') > at2('[data-del-gloss]'));
  ck('#99 every browser tap is wired',
     ['[data-rbcat]', '[data-rbback]', '[data-rbsort]', '[data-rbfacet]', '[data-rbtoggle]', '[data-rbfilters]', '[data-rbclear]',
      '[data-rbmore]', '[data-rbhit]', '[data-rbmorein]', '[data-rbrow]', '#btnAddGloss', '#rbImport'].every(s => boot.includes(s)));
  ck('#99 typing in a category\'s box repaints the body only',
     /rbCatSearch[\s\S]{0,200}rbRefreshBody\(\)/.test(boot) && !/rbCatSearch[\s\S]{0,200}renderRulesBrowser\(\)/.test(boot));
  const sheetJs = fs.readFileSync(path.join(ROOT, 'src/js/40-sheet.js'), 'utf8');
  ck('#99 the ☰ flyout lists the categories on the Rules tab', /tab-rules[\s\S]{0,400}rbShown\(\)[\s\S]{0,300}rbOpenCat\(/.test(sheetJs));
}
```

- In the search-box block, replace the two checks
  `ck('the glossary filter has its clear button', boxed(html, 'glossSearch'));` and
  `ck('the tables filter has its clear button', boxed(html, 'tablesSearch'));` with
  `ck('the Rules search has its clear button', boxed(html, 'rbSearch'));`
  (Task 3 already checks the category box).
- In the render-invariant block (`every renderer refreshRulesUI calls is also called by renderAll`),
  add after that check:
  `ck('#99 renderRulesBrowser is in both', onRulesChange.has('renderRulesBrowser') && calls(fnBody(compute, 'renderAll')).has('renderRulesBrowser'));`
  — use whatever names that block already gives the `renderAll` source and its call-set helper
  (read the block; it builds both).

`src/tests/sheet.js`:
- Add `'settings',` to its `loadApp` list if it is not there.
- `run('the Rules tab glossary', () => ctx.renderGloss());` becomes
  `run('the Rules tab browser, on the Glossary', () => { X.settings.rulesCat = 'glossary'; X.rbUI.per = {}; ctx.renderRulesBrowser(); });`
  (add `'rbUI'` to the `loadApp` list).
- `renders('the Rules tab section counts', () => ctx.renderRulesSections());` — delete the line.
- `const gl = renders('the Rules tab glossary', () => ctx.renderGloss());` becomes
  `const gl = renders('the Rules tab glossary', () => { X.settings.rulesCat = 'glossary'; X.rbUI.per = {}; ctx.renderRulesBrowser(); });`
- `const gl2 = renders('the Rules tab glossary after migrate()', () => ctx.renderGloss());` becomes the
  same with `gl2`.
- `renders('the Reference Tables list (a table with no rows, one with ragged rows)', () => ctx.renderTables());`
  becomes
  `renders('the Rules tab tables (a table with no rows, one with ragged rows)', () => { X.settings.rulesCat = 'tables'; X.rbUI.per = {}; ctx.renderRulesBrowser(); });`
- After that line, add:
  ```js
  RB_EVERY.forEach(k => renders('the Rules tab browser on ' + k + ' over a tidied pool',
    () => { X.settings.rulesCat = k; X.rbUI.per = {}; ctx.renderRulesBrowser(); }));
  ```
  with `const RB_EVERY = ['classes', 'subclasses', 'races', 'backgrounds', 'feats', 'features', 'spells', 'items', 'conditions', 'glossary', 'tables'];`
  declared just above it.

- [ ] **Step 2: Run them to make sure they fail**

Run: `./build.sh --no-zip && node src/tests/rules-data.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`
Expected: `LOAD FAIL` naming `renderRulesBrowser`.

- [ ] **Step 3: Implement**

**`src/html/40-rules.html`** — replace the whole file with:

```html
  <!-- ============ RULES TAB ============ -->
  <!-- A browser over every loaded category (86-rules-browser.js, #99): the
       categories and a search across all of them on the left, the open one's
       table on the right. 640px and under, one pane at a time, by data-screen. -->
  <section class="tabpanel" id="tab-rules">
    <div class="stack">
      <div class="card rb" id="rbCard" data-screen="list">
        <div class="label">Rules <span class="grow"></span></div>
        <input type="file" id="rbRulesFiles" accept="application/json,.json,application/zip,application/x-zip-compressed,.zip" multiple class="hidefile">
        <div id="rbEmpty"></div>
        <div class="rb-wrap">
          <nav class="rb-side" aria-label="Rules categories">
            <div class="searchbox rb-allsearch"><input id="rbSearch" placeholder="Search all rules…" autocomplete="off" aria-label="Search all rules"><button type="button" class="search-clear" aria-label="Clear the search" title="Clear">×</button></div>
            <div id="rbSide"></div>
          </nav>
          <div class="rb-main" id="rbMain"></div>
        </div>
      </div>
    </div>
  </section>
```

**`src/js/86-rules-browser.js`** — append:

```js

/* ================= the DOM half ================= */
function rbCurKey(){return rulesCatOf(settings,rbShown());}
function rbPaintSide(shown,k){
  const side=document.getElementById("rbSide");if(!side)return;
  const q=String(rbUI.q||"").trim();
  side.innerHTML=q?rbSearchHTML(shown,q):rbSideHTML(shown,k);
}
function rbPaintBody(it){
  const b=document.getElementById("rbBody");if(!b)return;
  b.innerHTML=rbBodyHTML(it.cat,it.rows,rbState(it.cat.k),rbFacets(it.cat,it.rows));
}
/* Everything: the import prompt, the sidebar, the pane. Runs from renderAll()
   and refreshRulesUI(), and when the category changes — never on a keystroke in
   a category's own box, which repaints the body alone (rbRefreshBody). */
function renderRulesBrowser(){
  const empty=document.getElementById("rbEmpty");
  if(empty)empty.innerHTML=RULE_CATS.some(c=>(rules[c]||[]).length)?"":
    `<div class="empty" style="line-height:1.7">No rules pack loaded yet. <button class="linkbtn" id="rbImport">Import rules files</button> to add classes, spells, feats, items and more, or manage sources in Settings.</div>`;
  const card=document.getElementById("rbCard");if(card&&card.dataset)card.dataset.screen=rbUI.screen;
  const shown=rbShown(),k=rulesCatOf(settings,shown);
  rbPaintSide(shown,k);
  const main=document.getElementById("rbMain");if(!main)return;
  const it=shown.find(x=>x.cat.k===k);
  if(!it){main.innerHTML="";return;}
  main.innerHTML=rbHeadHTML(it.cat,it.rows.length,rbState(k).q);
  rbPaintBody(it);
}
function rbRefreshBody(){const shown=rbShown(),k=rulesCatOf(settings,shown),it=shown.find(x=>x.cat.k===k);if(it)rbPaintBody(it);}
function rbOpenCat(k,focus){
  if(!rbCat(k))return;
  settings.rulesCat=k;saveSettings();
  rbUI.screen="table";
  renderRulesBrowser();
  if(focus){const h=document.getElementById("rbTitle");if(h&&h.focus)h.focus();}
}
/* narrow screens: back to the list, with focus on the category just left */
function rbBack(){
  rbUI.screen="list";
  const card=document.getElementById("rbCard");if(card)card.dataset.screen="list";
  const b=document.querySelector(`[data-rbcat="${rbCurKey()}"]`);if(b&&b.focus)b.focus();
}
/* "N more in Spells →": that category, with the search carried into its own box */
function rbMoreIn(k){
  if(!rbCat(k))return;
  rbState(k).q=String(rbUI.q||"").trim();rbState(k).shown=RB_PAGE;
  rbUI.q="";const s=document.getElementById("rbSearch");if(s)s.value="";
  rbOpenCat(k);
}
```

**`src/js/86-tables.js`** — delete from the comment `/* ---- the two Rules-tab sections collapse, and START collapsed ----`
through the line `function toggleRulesSec(k){…}` (that is `RULES_SECS`, `rulesSecDef`,
`rulesSecOpen`, `setRulesSecOpen`, `renderRulesSections`, `toggleRulesSec` and their comments), and
delete `function renderTables(){ … }` (keep `TBL_KINDS`, which the browser uses, and every other
function). In the comment above `tableRows()`, `renderTables()` → `renderRulesBrowser()`.

**`src/js/60-attacks.js`** — delete `function renderGloss(){ … }` and the blank line after it.

**`src/js/66-coins-hp.js`** — in `renderAll()`, `renderGloss();renderTables();renderRulesSections();`
→ `renderRulesBrowser();`, and the comment beginning `/* renderTables belongs here for the same reason renderGloss does:`
is reworded to name `renderRulesBrowser` (it draws from the rules packs, so a sheet loaded with
cached rules must draw it here as well as in `refreshRulesUI()`).

**`src/js/88-settings.js`**:
- `refreshRulesUI()`: `renderRulesSections();renderGloss();` → `renderRulesBrowser();`, and remove
  `renderTables();` from the same line.
- `SETTINGS_KEYS`: `"rulesCollapse"` → `"rulesCat"`.

**`src/js/85-browse.js`** — in `openGlossForm()`'s save, `closeModal();renderGloss();` →
`closeModal();renderRulesBrowser();`.

**`src/js/40-sheet.js`** — in `buildToc()`, immediately after the line that sets `tabName`, insert:

```js
  /* The Rules tab is one card; its sections are its categories (#99). */
  if(!inView&&panel&&panel.id==="tab-rules"){
    const shown=rbShown();
    fly.innerHTML=`<h4>${esc(tabName)}</h4>`+(shown.length?"":`<p class="hint" style="padding:6px">No sections here.</p>`);
    shown.forEach(({cat})=>{const a=document.createElement("a");a.textContent=cat.title;a.addEventListener("click",()=>{closeToc();rbOpenCat(cat.k);});fly.appendChild(a);});
    return;
  }
```

**`src/js/90-boot.js`**:
- Delete the two lines `if(t.closest("#glossImport"))…` and `if(t.closest("#tablesImport"))…`.
- Delete the `[data-rulessec]` line and the comment above it that explains the glossary header's
  "+ Add".
- In the `[data-del-gloss]` handler, `renderGloss();` → `renderRulesBrowser();`.
- Immediately after the `[data-del-gloss]` handler line, insert:

```js
    // the Rules tab browser (86-rules-browser.js). After the glossary's own
    // buttons above: they sit inside a row, and the row must not take their tap.
    if(t.closest("#rbImport"))return document.getElementById("rbRulesFiles").click();
    if(t.closest("#btnAddGloss"))return openGlossForm();
    if((m=t.closest("[data-rbcat]")))return rbOpenCat(m.dataset.rbcat,e.detail===0);
    if(t.closest("[data-rbback]"))return rbBack();
    if((m=t.closest("[data-rbsort]"))){rbSortBy(rbCurKey(),m.dataset.rbsort);return rbRefreshBody();}
    if((m=t.closest("[data-rbfacet]"))){rbToggleFacet(rbCurKey(),m.dataset.rbfacet,m.dataset.rbval);return rbRefreshBody();}
    if((m=t.closest("[data-rbtoggle]"))){rbToggleFacet(rbCurKey(),m.dataset.rbtoggle,null);return rbRefreshBody();}
    if(t.closest("[data-rbfilters]")){const st=rbState(rbCurKey());st.showFilters=!st.showFilters;return rbRefreshBody();}
    if(t.closest("[data-rbclear]")){rbClearFacets(rbCurKey());return rbRefreshBody();}
    if(t.closest("[data-rbmore]")){rbState(rbCurKey()).shown+=RB_PAGE;return rbRefreshBody();}
    if((m=t.closest("[data-rbmorein]")))return rbMoreIn(m.dataset.rbmorein);
    if((m=t.closest("[data-rbhit]")))return rbOpenRow(m.dataset.rbhitcat,m.dataset.rbhit);
    if((m=t.closest("[data-rbrow]")))return rbOpenRow(rbCurKey(),m.dataset.rbrow);
```

  (`e` is the click handler's event and `m` its match variable, as the lines around it use them.)
- Delete `document.getElementById("btnAddGloss").addEventListener("click",()=>openGlossForm());`,
  `document.getElementById("glossSearch").addEventListener(…)` and
  `document.getElementById("tablesSearch").addEventListener(…)`, and in their place add:

```js
  /* The Rules tab: the box over the sidebar repaints the sidebar; a category's
     own box (built by rbHeadHTML, so delegated) repaints only that table's body,
     never the box itself, or typing would lose focus with every letter. */
  document.getElementById("rbSearch").addEventListener("input",e=>{rbUI.q=e.target.value;rbPaintSide(rbShown(),rbCurKey());});
  document.getElementById("rbMain").addEventListener("input",e=>{if(e.target.id!=="rbCatSearch")return;const st=rbState(rbCurKey());st.q=e.target.value;st.shown=RB_PAGE;rbRefreshBody();});
```

- Replace the two `glossRulesFiles` / `tablesRulesFiles` change listeners with one:
  `document.getElementById("rbRulesFiles").addEventListener("change",e=>{if(e.target.files.length)importRulesFiles(e.target.files);e.target.value="";});`

**`src/css/20-cards.css`** — delete the three `.rules-head` rules (`.rules-head{…}`,
`.rules-head .fcaret{…}`, `.rules-head .cnt{…}`) and any comment that introduces only them.

**`src/css/35-tables.css`** — append:

```css

/* ================= the Rules tab browser (#99) =================
   Wide: the categories on the left, the open one's table on the right. 640px and
   under (Settings' breakpoint): one pane at a time, by #rbCard[data-screen] — the
   category list, or a table with ← Categories. */
.rb-wrap{display:grid;grid-template-columns:210px minmax(0,1fr);gap:0 18px;align-items:start}
.rb-allsearch{margin-bottom:8px}
.rb-cats{display:flex;flex-direction:column;gap:2px}
.rb-cat{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;text-align:left;
  background:none;border:0;border-radius:8px;padding:8px 10px;min-height:38px;cursor:pointer;
  font-family:var(--head);font-size:14px;font-weight:600;color:var(--ink)}
.rb-cat:hover,.rb-cat:focus-visible{background:color-mix(in srgb,var(--accent) 12%,transparent)}
.rb-cat.on{background:color-mix(in srgb,var(--accent) 24%,transparent)}
.rb-cat .cnt,.rb-title .cnt{font-family:var(--head);font-size:12px;font-weight:600;color:var(--ink-soft)}
.rb-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.rb-title{margin:0;flex:1;font-family:var(--head);font-size:18px}
.rb-back{display:none}
.rb-catsearch{margin-bottom:8px}
.rb-fbar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.rb-facets{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.rb-count{font-family:var(--head);font-size:12px;color:var(--ink-soft);margin:4px 0 6px}
.rb-sort{background:none;border:0;padding:0;cursor:pointer;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit}
.rb-open{background:none;border:0;padding:0;cursor:pointer;font:inherit;color:var(--ink);text-align:left}
.rb-tbl tbody tr{cursor:pointer}
.rb-tbl tbody tr:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}
.rb-acts{white-space:nowrap;text-align:right}
.rb-more{margin-top:8px}
.rb-sgroup{margin-bottom:8px}
.rb-hit{display:block;width:100%;text-align:left;background:none;border:0;border-radius:6px;padding:7px 10px;cursor:pointer;font:inherit;color:var(--ink)}
.rb-hit:hover,.rb-hit:focus-visible{background:color-mix(in srgb,var(--accent) 12%,transparent)}
@media(max-width:640px){
  .rb-wrap{grid-template-columns:minmax(0,1fr)}
  #rbCard[data-screen="list"] .rb-main{display:none}
  #rbCard[data-screen="table"] .rb-side{display:none}
  .rb-back{display:inline-flex}
}
```

**Docs, so the `docs` suite stays green** (Task 5 rewrites these pages fully):
- `src/docs/wiki/features/rules-and-tables.md`: remove `renderGloss()` (and its fragment), `RULES_SECS`,
  `rulesSecOpen()`, `setRulesSecOpen()`, `renderRulesSections()`, `toggleRulesSec()` and
  `renderTables()` from the **Code:** line and add `renderRulesBrowser()`; rewrite the paragraphs
  that describe the folding, the Glossary card's list and the Reference Tables list (they name
  `settings.rulesCollapse`, `RULES_SECS`, `renderRulesSections()`, `renderGloss()`, `renderTables()`)
  as one short present-tense section on the browser (categories, rows open windows, the Glossary's
  + Add and your entries, Tables). A paragraph under a "went wrong"/history heading that names
  `renderTables()` may keep the name only inside a `## History` section; otherwise reword it to
  "the tables renderer".
- `src/docs/wiki/ui/sections-and-layout.md`: in the code line, `rulesSecOpen()`, `renderRulesSections()` in
  `86-tables.js` → `rulesCatOf()` in `86-rules-browser.js`; the `rulesCollapse` row of the state
  table → `| \`rulesCat\` | settings | the category last opened | \`rulesCatOf()\` |`; the sentence about
  `RULES_SECS[].open` shutting both Rules cards is deleted.
- `src/docs/wiki/overview.md`: the `86-tables.js` row's "Rules-tab folding, " is deleted; the
  `86-rules-browser.js` row gains `renderRulesBrowser()`.

- [ ] **Step 4: Run every suite and make sure they pass**

Run: `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`
Expected: all suites pass. If an existing test still names an id or function this task removed,
update it to the new markup and say which in your report.

Then a quick smoke check in the project's Playwright MCP (`mcp__playwright__*`): open
`file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/99/dist/fieldbook.html`,
`newCharacter('QA','srd52')`, select the rules tab, and confirm the console has no errors and the
sidebar lists categories. (Full QA is Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/html/40-rules.html src/js/86-rules-browser.js src/js/86-tables.js src/js/60-attacks.js src/js/66-coins-hp.js src/js/88-settings.js src/js/85-browse.js src/js/40-sheet.js src/js/90-boot.js src/css/35-tables.css src/css/20-cards.css src/docs/wiki/features/rules-and-tables.md src/docs/wiki/ui/sections-and-layout.md src/docs/wiki/overview.md src/tests/rules-data.js src/tests/sheet.js
git commit -m "feat(#99): the Rules tab is a browser over every loaded category

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Browser QA, docs, release note

**Files:**
- Modify: `src/docs/wiki/features/rules-and-tables.md`, `src/docs/wiki/ui/shell.md`,
  `src/docs/wiki/ui/sections-and-layout.md`, `src/docs/wiki/decisions.md`,
  `src/docs/wiki/features/character-building.md`, `src/docs/wiki/features/inventory.md`,
  `src/docs/wiki/features/features-and-traits.md`, `src/docs/wiki/roadmap/1.9.0.md`,
  `src/docs/specs/2026-10-19-rules-browser-design.md` (an "As built" section),
  `src/docs/_claude/WIRING-LEDGER.md` (append), `src/docs/UNRELEASED.md`
- Screenshots: `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/99-*.png` (git-ignored)

- [ ] **Step 1: Before shots**

Main's tracked build is the "before": `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`.
Through the project's Playwright MCP (`mcp__playwright__*`, never a plugin one), with
`newCharacter('QA','srd52')` and the SRD pack loaded the way `src/docs/wiki/process/screenshot-qa.md`
describes: the Rules tab at 1280×900 and 390×844, both skins → `99-before-<width>-<skin>.png`.
Also the item picker's and feat picker's preview of one entry → `99-before-preview-<item|feat>.png`.

- [ ] **Step 2: After shots and driven checks**

`./build.sh --no-zip`, then open the worktree's `dist/fieldbook.html` and, on the same character:
1. The Rules tab at 1280 and 390, both skins: sidebar with counts (wide); category list (narrow).
   → `99-after-<width>-<skin>.png`
2. Wide: open Spells, tap the Level header (▲ then ▼), open Filters, tap School: Evocation; the
   count and table change. → `99-spells-filtered.png`
3. Type three letters in the Spells box: the box keeps focus and every letter (Review Focus 3).
4. Open a row of each kind and shoot the window: a class (reference mode: no "current", subclass
   links), a subclass from that class window, a species, a background, a feat, an item, a spell, a
   condition, a table. → `99-window-<kind>.png`
5. Narrow: tap Items → its table with "← Categories"; tap back → the list. → `99-narrow-table.png`
6. Search all rules for "fire": grouped results; tap "N more in Spells →" → Spells with "fire" in
   its box. → `99-search.png`, `99-more-in.png`
7. Glossary: + Add creates an entry that appears with "Yours"; Edit renames it; Delete removes it
   (Review Focus 5). → `99-glossary.png`
8. The ☰ flyout on the Rules tab lists the categories; tapping one opens it. → `99-toc.png`
9. Reload: the last category opened is the one shown.
10. The item and feat pickers' previews look as in the before shots. → `99-after-preview-<item|feat>.png`
11. A `[Table: …]` chip elsewhere (a class feature) still opens its table.

Report every shot's path, and say plainly what was driven and what was not.

- [ ] **Step 3: Docs**

- `rules-and-tables.md`: rewritten for the browser: the categories and their columns/filters,
  how a row opens its window (by `_id`, reference mode), the Glossary's + Add and your entries,
  Tables, the cross-category search, Show more, state (`settings.rulesCat`, the rest in memory),
  the narrow layout, and the rulings from this plan's Global Constraints. Keep the "what went wrong"
  items that still apply. History line.
- `shell.md`: the ☰ flyout's Rules-tab case. History line.
- `sections-and-layout.md`: `rulesCat` replaces `rulesCollapse`. History line.
- `decisions.md`: the spec's decisions table, one line each, linking the spec.
- `character-building.md` (the class, species and background windows: `{ref:true}`, open by id),
  `inventory.md` and `features-and-traits.md` (the pickers' previews are `openItemInfo()` /
  `openFeatInfo()`, their filters `itemFacets()` / `featFacets()` / `spellFacets()`): a sentence each
  where the page describes them, and a History line.
- `1.9.0.md`: #99/#53 merged state is set at merge; here only note in the wave table that D is built.
- The spec: "As built" — every difference from §1–§11 (the plan's rulings: Glossary always listed,
  Subclasses from `subclassesFor()`, Tables' Source column, per-category Pack filter, the import
  prompt above the browser; the Filters button that folds the pills), or "as specified".
- Ledger: append `## The Rules tab as a browser (#99, #53, <date>)` — what, why, the decisions and
  rulings, the files, the tests, what was driven — ending with a `Pages:` line. Point each History
  line at that heading's line (`grep -n '^## The Rules tab as a browser' src/docs/_claude/WIRING-LEDGER.md`).
- `UNRELEASED.md`, under `## Pending`, one bullet:
  `- The Rules tab is now a browser: every class, species, background, feat, spell, item, condition, glossary term and table from your rules packs, in sortable tables with filters and a search across all of them. Tap a row to read it.`

- [ ] **Step 4: Run every suite**

Run: `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/docs/wiki/features/rules-and-tables.md src/docs/wiki/ui/shell.md src/docs/wiki/ui/sections-and-layout.md src/docs/wiki/decisions.md src/docs/wiki/features/character-building.md src/docs/wiki/features/inventory.md src/docs/wiki/features/features-and-traits.md src/docs/wiki/roadmap/1.9.0.md src/docs/specs/2026-10-19-rules-browser-design.md src/docs/_claude/WIRING-LEDGER.md src/docs/UNRELEASED.md
git commit -m "docs(#99): the Rules tab as a browser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
