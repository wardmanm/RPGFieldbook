# Glossary Editor Keeps Unshown Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The glossary editor's Save changes only the fields its form shows (term, type, text,
image) and keeps every other field the entry carries, so editing an entry never loses data (#136).

**Architecture:** One handler changes: the `#gSave` click in `openGlossForm()` (`src/js/85-browse.js`).
Instead of building a fresh `{id, term, type, text, image}` and putting it in the entry's place, it
copies the entry **as stored at Save time** (found by id in `character.glossary`, falling back to the
object the form opened on, which for Add is the new blank) and overwrites only the four form fields.
That is the tracker form's rule (`openTrackerForm()`'s `cur()`, `87-trackers.js`): merge onto the
stored copy, so an Undo that swapped the character while the form was open is not undone by Save.

**Tech Stack:** plain browser JS (concatenated fragments, no modules); the Node harness
(`src/tests/harness.js`) with a recorder DOM, as `sheet.js`'s hostile-file block uses.

**Spec:** none; the bug is issue #136 and the brief for wave 1 of the
[1.9.1 roadmap](../wiki/roadmap/1.9.1.md) ("Glossary editor", no design call). Background:
ledger L4206 ("Noticed, not changed"), [Rules & tables](../wiki/features/rules-and-tables.md),
[Rich text](../wiki/architecture/rich-text.md), [rules-schema §6.1](../../../docs/rules-schema.md).

**Branch:** `issue/136-glossary-editor` in `.claude/worktrees/136`. Commit `src/` only, never
`dist/fieldbook.html` or `docs/CHANGELOG.md`.

## What an entry can carry (the findings this plan rests on)

- **Only the character's own entries are editable.** The Rules tab's Glossary rows give Edit only to
  "Yours" rows (`data-edit-gloss`, `86-rules-browser.js`), and `90-boot.js` looks the id up in
  `character.glossary` alone. A pack keyword is read-only (`allGlossary()` marks its copy `_locked`),
  and there is no override or library copy: Save writes into `character.glossary`, which saves with
  the character.
- **Fields an own entry can hold:** the form's `id`, `term`, `type`, `text`, `image`; the schema's
  `cond` (rules-schema §6.1), which `statusTermList()` (`80-modal-forms.js`) reads to offer the term
  in the Status editor; the aliases `name` and `description`, which `glossRepair()` copies into
  `term`/`text` on load and keeps; and anything else a character file brought, kept by `migrate()`
  (it preserves every field by default). An entry copied from a pack carries pack stamps too
  (`_source`, `_rulebook`, `_dataVersion`). The shipped packs' keywords carry `term`, `type`, `text`
  and `cond` only.
- **The aliases stay as they are.** After an edit they are inert: `glossRepair()` fills `term` from
  `name` only when `term` is blank, and `text` from `description` only when `text` is absent, and
  Save always writes a non-blank `term` and a string `text`.

## Global Constraints

- Backward-compatible data: no field leaves an entry because it was edited; a save→load round trip
  (`migrate(JSON.parse(JSON.stringify(character)))`) keeps every field.
- The form's own behaviour is unchanged: a blank term refuses Save with "Give the entry a term." and
  writes nothing; the term is trimmed; `text` and `image` are both kept whichever type is chosen.
- New checks go in **their own new block at the end of `src/tests/sheet.js`** (other branches append
  there too). They are synchronous, so they run before the file's closing promise chain resolves.
- No browser: the screenshot and drive list goes in the report, not here.

## Review Focus

1. **A player-made condition** (`cond: true`) edited for its wording must still be offered in the
   Status editor's suggestions. → test in Task 1 (`statusTermList()` after Save).
2. **Switching an entry's type** text → image and back keeps its other fields and its text.
   → test in Task 1.
3. **An entry imported as `{name, description}`** keeps the edited term and text after a reload: the
   kept aliases must not win back. → test in Task 1 (round trip through `migrate()`).
4. **Undo swapping the character while the form is open** (the toast sits outside the modal's
   inert): Save merges onto the entry as now stored, not the stale copy it opened on. → test in Task 1.
5. **A refused Save** (blank term) leaves the stored entry exactly as it was. → test in Task 1.

---

### Task 1: Save keeps every field the form does not show

**Files:**
- Modify: `src/js/85-browse.js` (`openGlossForm()`, the `#gSave` handler)
- Test: `src/tests/sheet.js` (new block at the end, after the `t118EndToEnd()…` chain line)

**Interfaces:**
- Consumes: `openGlossForm(existing)`, `statusTermList()`, `migrate(s)`, `blankChar()`, `uid()`,
  all reachable as `ctx.<name>` (function declarations are context properties); `X.character`.
- Produces: no new function. Save's contract: for an entry with id `g.id`,
  `character.glossary[i] = Object.assign({}, stored, {term, type, text, image})`, where `stored` is
  `character.glossary.find(x => x && x.id === g.id)` at Save time, else the opened object. `id` is
  never changed. A new entry is pushed as `{id, term, type, text, image}`.

- [ ] **Step 1: Reproduce (systematic-debugging, phase 1)**

A throwaway Node script in the scratchpad loads the app with `loadApp`, swaps in a recorder DOM,
opens `openGlossForm()` on `{id:'h1', term:'Soaked', type:'text', text:'Wet.', image:null, cond:true,
source:'House rules', tags:['weather']}`, fills `gText`, fires `gSave`'s click, and prints the stored
entry. Expected before the fix: `cond`, `source` and `tags` are gone. This confirms the cause is the
handler's `rec={id:g.id,term,type,text,image}` replacing the entry, and nothing upstream.

- [ ] **Step 2: Write the failing tests**

A block headed `/* #136: the glossary editor's Save keeps what it does not show … */`, with its own
recorder DOM (`getElementById` → recorder with `value`, `_on` listeners; `fire(id, 'click')`;
restore in `finally`). Helper `edit(entry, {term, type, text})`: put `entry` in
`X.character.glossary`, `openGlossForm(entry)`, set the three boxes, fire `gSave`, return the stored
entry by id. Checks, each named `#136 …`:

```js
// a pack-shaped entry (copied from a pack into the character file)
const pk = {id:'p1', term:'Soaked', type:'text', text:'Wet.', image:null, cond:true,
            _source:'Homebrew', _rulebook:'HB', _dataVersion:'1.0.0-1'};
const p = edit(pk, {text:'Drenched through.'});
ck('#136 a pack-shaped entry keeps cond and its pack stamps', p.cond===true && p._source==='Homebrew' && p._rulebook==='HB' && p._dataVersion==='1.0.0-1');
ck('#136 ...and takes the edit', p.text==='Drenched through.' && p.term==='Soaked' && p.id==='p1');
ck('#136 ...and is still offered as a status', ctx.statusTermList().includes('Soaked'));
// a hand-made (homebrew) entry with fields this app has never heard of
const hb = {id:'h1', term:'Flanking', type:'text', text:'Old.', image:null,
            source:'House rules', tags:['combat'], meta:{page:12, by:'DM'}};
const h = edit(hb, {term:'  Flanked  ', text:'New.'});
ck('#136 a homebrew entry keeps every field the form does not show', deepEqual(minus(h,['term','text']), minus(hb,['term','text'])));
ck('#136 ...takes the trimmed term and the text', h.term==='Flanked' && h.text==='New.');
ck('#136 ...in the same place, with no second entry', X.character.glossary.length===n && X.character.glossary[k]===h);
// type switch keeps text and the other fields
// alias entry {name, description} migrated, edited, then round-tripped: term/text stay the edits, aliases kept
// save→load round trip keeps cond, source, tags, meta (migrate(JSON.parse(JSON.stringify(c))))
// Undo swap: replace X.character with a JSON copy while the form is open, Save → merged onto the copy
// refused Save: blank term → alert, stored entry unchanged (deepEqual to before), nothing pushed
// Add: openGlossForm() with no entry → pushed {id, term, type, text, image} only, others untouched
```

(`deepEqual` is `JSON.stringify` of key-sorted copies; `minus(o, keys)` drops keys.)

- [ ] **Step 3: Run the suite to see them fail**

Run: `node src/tests/sheet.js | grep -E "^(FAIL|ALL|FAILURES).*" | grep "#136\|ALL\|FAILURES"`
Expected: the "keeps" checks FAIL (`cond`, `source`, `tags`, `meta`, pack stamps dropped; status not
offered; Undo copy's fields lost); the Add, trimmed-term and refused-Save checks already PASS (they
guard what must not change).

- [ ] **Step 4: Change the `#gSave` handler in `openGlossForm()`**

Look the entry up by id at Save time; `rec = Object.assign({}, stored || g, {term, type: type.value,
text: gText.value, image: img})`; replace at its index or push. Comment why (#136), naming the
fields kept. Drop the `id:g.id` from the overwrite: the stored entry's id is the id it was found by.

- [ ] **Step 5: Run the suite to see them pass**

Run: `node src/tests/sheet.js | tail -1`
Expected: `ALL PASSED (n)`.

- [ ] **Step 6: Commit**

```bash
git add src/js/85-browse.js src/tests/sheet.js src/docs/plans/2026-11-06-glossary-editor.md
git commit -m "fix(glossary): the editor's Save keeps fields it does not show (#136)"
```

### Task 2: Docs, notes and the full check

**Files:**
- Modify: `src/docs/_claude/WIRING-LEDGER.md` (append at the end)
- Modify: `src/docs/wiki/features/rules-and-tables.md` (the glossary paragraph, a Trap, History)
- Modify: `src/docs/wiki/roadmap/known-issues.md` (remove the #136 entry only)
- Modify: `src/docs/UNRELEASED.md` (one bullet under `## Pending`)

- [ ] **Step 1: Ledger entry** — `## The glossary editor keeps what it doesn't show (#136, 2026-11-06)`:
  the bug, what an own entry can carry, the fix and why it merges onto the stored copy, the tests,
  and the other editors with the same rebuild-from-the-form pattern (listed, not changed).
- [ ] **Step 2: Wiki** — `rules-and-tables.md`: the glossary paragraph says Save changes only term,
  type, text and image and keeps the rest (`cond` named, since the Status editor reads it); a Trap
  line for the old replace; a History line citing the new ledger heading as `L<n>`.
- [ ] **Step 3: Known issues** — delete the two-line "The glossary editor's Save replaces the whole
  entry" bullet; nothing else.
- [ ] **Step 4: UNRELEASED** — one player-worded bullet: editing your own glossary entry no longer
  loses details the form doesn't show, such as an entry marked as a condition.
- [ ] **Step 5: Build and run everything**

Run: `./build.sh --no-zip && PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh`
Expected: the last line reports every suite passed (rerun `./src/tests/run.sh private-data` alone if
only that suite fails, since other worktrees share its clone).

- [ ] **Step 6: Commit**

```bash
git add src/docs/_claude/WIRING-LEDGER.md src/docs/wiki/features/rules-and-tables.md \
        src/docs/wiki/roadmap/known-issues.md src/docs/UNRELEASED.md
git commit -m "docs: the glossary editor keeps unshown fields (#136)"
```
