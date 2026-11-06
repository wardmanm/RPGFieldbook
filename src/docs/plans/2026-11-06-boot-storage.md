# Boot & storage (1.9.1 wave 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boot survives a browser that blocks storage and says so (#142); the newest rules cache
wins at boot (#134); a character that autoloads gets the rules-update prompt once the packs are
back (#135); Remove and Remove all say on their status line when the change couldn't be saved
(#143).

**Architecture:** All four are boot and rules-cache plumbing in `70-persistence.js`,
`71-char-io.js`, `73-char-update-ui.js`, `75-home-theme.js`, `88-settings.js` and `boot()` in
`90-boot.js`. The rule for #134 is the one the save path already keeps: a save IndexedDB takes
deletes the `localStorage` copy, so a `localStorage` copy that is there is never older than the
IndexedDB one, and boot keeps it rather than laying IndexedDB over it. #135 then needs only one
hook: when the IndexedDB hydration brings the packs, ask about the open sheet.

**Tech Stack:** plain browser JS fragments concatenated into one file; Node suites with the
`vm` harness (`src/tests/harness.js`).

**Spec:** no design call (1.9.1 roadmap row "Boot & storage"). The issues (#142, #134, #135, #143),
[Storage](../wiki/architecture/storage.md) and the four entries in
[Known issues](../wiki/roadmap/known-issues.md) define the fix.

## Global Constraints

- Constraint 2: a storage write that does not land must say so; never an empty `catch` around a
  write. Every IndexedDB call goes through `idbOpen()`/`idbTx()`.
- Constraint 3: saved characters keep loading; no character field changes.
- Boot reads the `localStorage` rules copy synchronously, before first paint.
- Never save a pool you did not mean to change: boot writes no rules cache.
- `clearAllRules()` keeps returning `true`/`false` (the home handler and `rules-data.js` use it).
- `checkForUpdate();checkForDataUpdate();` stay adjacent in `boot()` (`data-archive.js` guard).
- Edit only `boot()` in `90-boot.js`, never `wire()` (Vitals & HP edits `wire()`'s HP handlers);
  in `71-char-io.js`, nothing near `migrate()`.
- New checks: one new block appended after the last line of `src/tests/sheet.js`. Async checks
  chain onto `ck.done` there, without editing the existing final chain line.
- Player-facing copy, as written here (Mike can reword at QA).

## Review Focus

1. **`indexedDB` itself throws on access** (Firefox with cookies blocked): `idbReady()` must say
   "no IndexedDB", not throw out of `saveRulesCache()` or `loadRulesCacheAsync()`. The harness
   turns a throwing global getter into "not defined", so this is a source guard (Task 1).
2. **An unreadable `localStorage` copy beside an IndexedDB copy** (corrupt LZW, bad JSON): boot
   must fall back to the IndexedDB copy rather than open with no rules (Task 2).
3. **Both stores refused after an earlier IndexedDB save:** the next boot brings back the last
   copy that landed, the IndexedDB one, which is what the warning promised (Task 2).
4. **The home screen or a dialog is in front when the packs arrive:** no prompt lands on it or
   replaces it (Task 3).
5. **A refused save after Remove all:** the line must be true for a removal, not "wouldn't save
   the 0 KB … Remove a pack you're not using" (Task 4).

---

### Task 1: #142 boot survives blocked storage, and says so

**Files:**
- Modify: `src/js/70-persistence.js` (`idbReady()`; new `storageBlockedWhy()` after `storageWhy()`)
- Modify: `src/js/75-home-theme.js` (`renderHome()`, its `noSettings` read)
- Modify: `src/js/90-boot.js` (`boot()`: drop the dead `noSettings` read, add the alert)
- Test: `src/tests/sheet.js` (new block at the end)

**Interfaces:**
- Produces: `storageBlockedWhy() -> string`: `""` when `localStorage` can be read, else why not.
  `!localStorage` → `"your browser has storage switched off for this page"`; a throw →
  `storageWhy(e)`.
- Produces (test helper, in the new block): `bootApp(store, opts) -> app` — a fresh `loadApp()`,
  `store` copied in, `opts.idb` an optional fake IndexedDB (Task 2 adds it), `opts.ls` a
  replacement `localStorage` (`null`, or an object whose methods throw), `alert` and `openModal`
  recorded on `app.alerts`/`app.opened`; then 90-boot.js evaluated minus its last `boot();` and
  `boot()` called, its throw caught onto `app.bootThrew`. `settle()` = one `setImmediate`.

- [ ] **Step 1: Write the failing tests** (block `#142`)
  - for `ls` = `null`, a `{getItem,setItem,removeItem}` that throws a `SecurityError`, and a
    `localStorage` getter that throws: `boot()` does not throw (`app.bootThrew === null`);
  - ...and alerts once, the message containing `storageBlockedWhy()`'s reason and "won't be kept";
    the `SecurityError` case reads "your browser is blocking storage for this page";
  - `renderHome()` called directly with throwing storage does not throw;
  - with working storage, boot raises no alert;
  - source guard: `idbReady()`'s body is a `try`/`catch` returning `false`.
- [ ] **Step 2: Run `node src/tests/sheet.js | grep -E '#142|FAIL|ALL'`.** Expected: the throw
  cases FAIL (`boot()` throws at its first line), the alert cases FAIL.
- [ ] **Step 3: Implement.** `storageBlockedWhy()` in 70-persistence.js; `idbReady()` wrapped in
  `try{…}catch(e){return false;}`; `renderHome()`'s read inside a `try` (`noSettings` stays `true`
  when it throws); in `boot()`, delete `const noSettings=…` (never used) and, after the
  autoload/`showHome()` block, `{const why=storageBlockedWhy();if(why)alert(…);}` with:
  `"Fieldbook can't use this browser's storage — "+why+". Your characters and settings won't be kept when you close it: save each character to a file with Save before you leave, or allow this page to store data and open Fieldbook again."`
- [ ] **Step 4: Run the block.** Expected: all `#142` PASS.
- [ ] **Step 5: Commit** `fix(#142): boot survives a browser that blocks storage, and says so`.

### Task 2: #134 the newest rules cache wins at boot

**Files:**
- Modify: `src/js/71-char-io.js` (new `loadRulesCacheLocal()` above `loadRulesCacheAsync()`;
  `loadRulesCacheAsync(haveLocal)`)
- Modify: `src/js/90-boot.js` (`boot()`: the synchronous read becomes `loadRulesCacheLocal()`)
- Test: `src/tests/sheet.js` (same block)

**Interfaces:**
- Produces: `loadRulesCacheLocal() -> boolean` — reads `K_RULES` through
  `readRulesCacheString()`, `Object.assign`s a parsed object into `rules`, `true` only then;
  any throw or unreadable value is `false`.
- Produces: `loadRulesCacheAsync(haveLocal) -> Promise<boolean>` — resolves `false` at once when
  `haveLocal` (the `localStorage` copy is the newest) or no IndexedDB; otherwise as today, `true`
  when the IndexedDB copy was laid over `rules`.
- Produces (test helper): `fakeIDB(data) -> {api, data, st}` — `api.open()` fires `onsuccess` in a
  microtask; a transaction's `put`/`get` complete in a microtask; `st.failPut` aborts puts.
- Consumes: `bootApp()` from Task 1.

- [ ] **Step 1: Write the failing tests** (block `#134`), each through the real save path
  (`mergeRules()` then `saveRulesCache()`), then a fresh `bootApp()` over the same store and IDB:
  - IndexedDB saves pack A; IndexedDB then refuses, pack B falls back to `localStorage`; the next
    boot has A and B after `settle()` (today: A only);
  - normal path: IndexedDB holds the pool, no `localStorage` copy → hydrated (A and B);
  - migration source: only a `localStorage` copy (plain JSON, as an old build wrote) → kept;
  - an unreadable `localStorage` copy (`LZW_TAG+"￿"`) beside an IndexedDB copy → the
    IndexedDB copy;
  - both refused after an IndexedDB save → the next boot has the IndexedDB copy.
- [ ] **Step 2: Run the block.** Expected: the first case FAILs (A only); the rest pass.
- [ ] **Step 3: Implement** `loadRulesCacheLocal()` and the `haveLocal` gate; in `boot()`,
  `const haveLocal=loadRulesCacheLocal();` replaces the inline read (comment says why it wins),
  and the later call becomes `loadRulesCacheAsync(haveLocal)`.
- [ ] **Step 4: Run the block.** Expected: all `#134` PASS.
- [ ] **Step 5: Commit** `fix(#134): a rules cache saved to localStorage is never overwritten by an older IndexedDB copy at boot`.

### Task 3: #135 the autoloaded sheet is asked once the packs are back

**Files:**
- Modify: `src/js/73-char-update-ui.js` (new `promptAfterRulesRestored()` after `maybePromptUpdate()`)
- Modify: `src/js/90-boot.js` (`boot()`: `.then` on `loadRulesCacheAsync(haveLocal)`)
- Test: `src/tests/sheet.js` (same block)

**Interfaces:**
- Produces: `promptAfterRulesRestored() -> boolean` — `false` and nothing shown when no
  character is open (`activeId` empty), the home screen is up (`#home` `style.display==="flex"`)
  or a dialog is open (`modal.classList.contains("open")`); else `maybePromptUpdate()` and `true`.
- Consumes: `loadRulesCacheAsync(haveLocal)` (Task 2), `bootApp()`, `fakeIDB()`.

- [ ] **Step 1: Write the failing tests** (block `#135`), a character "Tess" stored with
  `appVersion:"1.0.0"`, set to autoload, holding a copy of spell Zap whose text the pool changed:
  - pool only in IndexedDB: no prompt at the autoload, one "Rules updates available" after
    `settle()` (today: none);
  - pool in `localStorage`: one prompt in all, at the autoload, none after;
  - pool only in IndexedDB, no autoload (home screen): no prompt;
  - `promptAfterRulesRestored()` with `#home` shown, and with the modal open: `false`, no prompt.
- [ ] **Step 2: Run the block.** Expected: the first case FAILs.
- [ ] **Step 3: Implement** `promptAfterRulesRestored()` and, in `boot()`,
  `loadRulesCacheAsync(haveLocal).then(got=>{if(got)promptAfterRulesRestored();});`.
- [ ] **Step 4: Run the block.** Expected: all `#135` PASS.
- [ ] **Step 5: Commit** `fix(#135): a character that opens at launch is asked about rules updates once the packs are back`.

### Task 4: #143 Remove and Remove all report a refused save on their line

**Files:**
- Modify: `src/js/70-persistence.js` (`saveRulesCache(change)`)
- Modify: `src/js/88-settings.js` (`removeRulesGroup()`, `clearAllRules()`; new
  `rulesSaveReport()` after `clearAllRules()`)
- Test: `src/tests/sheet.js` (same block)

**Interfaces:**
- Produces: `saveRulesCache(change) -> Promise<string>` — unchanged, except `change==="remove"`
  sets this `rulesCacheError` when both stores refuse:
  `"Your browser wouldn't save that change, so next time you open Fieldbook it will load the rules data it last saved, and what you removed may be back."`
- Produces: `rulesSaveReport(saving, msg) -> Promise<string>` — once `saving` settles with an
  error: `renderRulesData()` and `rulesImportStatus(msg+" "+err,"err")` (Settings' line and the
  home screen's); resolves to the error or `""`.
- `removeRulesGroup(key)` returns `rulesSaveReport(saveRulesCache("remove"), rulesStatusText())`
  after drawing the green line as today; `clearAllRules()` calls
  `rulesSaveReport(saveRulesCache("remove"),"Rules cleared.")` and still returns `true`.

- [ ] **Step 1: Write the failing tests** (block `#143`), recording `#rulesStatus` and
  `#homeRulesStatus`, no IndexedDB, `state.quotaFull`:
  - Remove refused: after `settle()`, `#rulesStatus` has class `err` and ends with the removal
    sentence; `#homeRulesStatus` says it too; `rulesCacheWarning()` is that sentence, with no
    "0 KB" and no "Remove a pack you're not using";
  - Remove all refused: "Rules cleared. Your browser wouldn't save that change…", class `err`;
    `clearAllRules()` still `true`;
  - the same through a fake IndexedDB that refuses (the asynchronous path);
  - a Remove that lands: class `ok`, no warning; an import refused keeps today's sentence.
- [ ] **Step 2: Run the block.** Expected: the refused cases FAIL (class `ok`/blank).
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run the block, then `./src/tests/run.sh`.** Expected: all PASS; `rules-data.js`
  clear-all and cache checks unchanged.
- [ ] **Step 5: Commit** `fix(#143): Remove and Remove all say on their status line when the change couldn't be saved`.

### Task 5: Docs, build, full run

**Files:**
- Modify: `src/docs/_claude/WIRING-LEDGER.md` (append one `##` entry at the end)
- Modify: `src/docs/wiki/architecture/storage.md`, `src/docs/wiki/features/rules-update-tool.md`,
  `src/docs/wiki/features/settings-and-updates.md`, `src/docs/wiki/process/testing.md`,
  `src/docs/wiki/decisions.md`, any other page `grep -rl` finds naming the changed behaviour
- Modify: `src/docs/wiki/roadmap/known-issues.md` (delete the #142, #134, #135, #143 entries only)
- Modify: `src/docs/UNRELEASED.md` (four bullets under `## Pending`)

- [ ] **Step 1:** Append the ledger entry; note its heading line (`grep -n '^## ' … | tail -1`).
- [ ] **Step 2:** Rewrite the pages in present tense (boot order, which copy wins and why, the
  blocked-storage alert, the late prompt, Remove's line, the harness's boot block and fake
  IndexedDB), each with a History line `→ ledger L<n>, #…`; the "which copy wins" decision in
  storage.md's table and `decisions.md`; remove the resolved Open items and known-issues entries.
- [ ] **Step 3:** UNRELEASED bullets, player wording, no tags, no versions.
- [ ] **Step 4:** `./build.sh --no-zip`, then `./src/tests/run.sh`. Expected: every suite passes
  (`private-data` rerun alone if it fails).
- [ ] **Step 5: Commit** `docs(#142, #134, #135, #143): the wiki, ledger and release notes` (plan included).
