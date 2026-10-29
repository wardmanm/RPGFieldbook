# Pre-release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/pre-release <ver>` skill that Mike runs before an app release: five recorded steps (docs filed by
version, loose ends filed, a pre-driven QA checklist, its bugs filed, release notes a player can read), and a gate
in `scripts/release.js`, so `./build.sh --release X.Y.Z` and `/release` refuse until the record is complete for
exactly that version.

**Architecture:**
- **Task 1.** `scripts/move-docs.js`: moves docs and rewrites every reference to them, in the form each was
  written (repo path, docs-rooted path, relative link), fenced blocks included, never adding or removing a line.
  A new suite, `src/tests/pre-release.js`, tests it on a scratch tree.
- **Task 2.** The docs suite's link check (spec §6), built on `move-docs.js`'s own reference finder.
- **Task 3.** `scripts/pre-release-record.js`: the record's parser, the gate's words, the archive move, and a CLI
  for `/release`'s preflight. `release.js` calls it before writing anything and files the record after the cut.
- **Task 4.** `src/docs/qa/smoke.md`, the standing "Still works" list, written from the wiki's feature pages.
- **Task 5.** The `pre-release` skill, and `/release`'s preflight.
- **Task 6.** Docs: RELEASING, CLAUDE.md, `dev.sh`'s checklist, the wiki, the spec's As built, the ledger.

**Tech Stack:** Plain Node (CommonJS, no dependencies) for the scripts and the JS suites, through
`src/tests/harness.js`'s `makeCheck()`; Python 3 for `data-kit.py`, which already tests `release.js` in a scratch
git checkout; markdown for the skills and docs. `gh` (2.97, `project` scope) inside the skill only.

**Spec:** `src/docs/specs/2026-10-29-pre-release-design.md`. Read it first: it is the binding authority, and its
§2 decisions are Mike's. Then `.claude/skills/release/SKILL.md`, `src/docs/RELEASING.md` and
`src/docs/wiki/process/building-and-ci.md`.

**Worktree:** create it with `./scripts/wt.sh add 127 pre-release`. That gives `.claude/worktrees/127`, branch
`issue/127-pre-release`. Run every command from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/127`.

## Global Constraints

- **No backfill, no real move.** Nothing in this branch runs `scripts/move-docs.js` against the checkout or moves a
  spec, plan or wiki page. The first real `/pre-release 1.9.0` does the backfill (spec §8).
- **No release.** Never `./build.sh --release`, never `node scripts/release.js` against the checkout (only in the
  test suites' scratch copies), never touch `APP_VERSION`, `DATA_VERSIONS`, `CHANGELOG`, or `data/packs.json`'s
  `version`/`digest`/`release`.
- **Nothing under `docs/`** (player-facing) is added or changed.
- **Tests never touch the real repo's tags, remote or `src/docs` tree.** Every case runs on a temp copy:
  `fs.mkdtempSync(os.tmpdir() …)` in Node, `checkout()`/`tempfile.mkdtemp` in `data-kit.py`.
- **The ledger is append-only.** Task 6 appends one entry at the very end of
  `src/docs/_claude/WIRING-LEDGER.md` and changes no other line.
- **The record's format is the spec's §3, verbatim:** heading `# Pre-release X.Y.Z`, then
  `Started: YYYY-MM-DD · App was A.B.C`, then the table `| Step | State | Done | Summary |` with rows
  `1. Docs`, `2. Outstanding issues`, `3. QA checklist`, `4. QA bugs`, `5. Release notes`; then
  `## Step 2: outstanding issues` (`| Item | Source | Title | Priority | Decision | Issue |`) and
  `## Step 4: bugs from QA` (`| Line | Title | Priority | Issue | State |`). State is `open` or `done`.
- **The gate's words.** The spec fixes only that the message names the first open step and says to run
  `/pre-release X.Y.Z`; these are the exact strings (`release.js` prints each after `release: `):
  - `no pre-release record for X.Y.Z (src/docs/PRE-RELEASE.md does not exist). Run /pre-release X.Y.Z first.`
  - `src/docs/PRE-RELEASE.md is for A.B.C, not X.Y.Z. Run /pre-release X.Y.Z first.`
  - `src/docs/PRE-RELEASE.md has no "# Pre-release X.Y.Z" heading. Run /pre-release X.Y.Z first.`
  - `src/docs/PRE-RELEASE.md has no row for step N. Name. Run /pre-release X.Y.Z to finish it.`
  - `pre-release X.Y.Z is not finished: step N. Name is open. Run /pre-release X.Y.Z to finish it.`
  - `src/docs/archive/X.Y.Z/PRE-RELEASE.md already exists: X.Y.Z has been cut before.`
- **Commits** follow the spec's §7 step names: `/pre-release` commits `docs: pre-release X.Y.Z — step N`. This
  branch's own commits are `feat(#127): …` for code and `docs(#127): …` for docs, each ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git add` `dist/fieldbook.html` or
  `docs/CHANGELOG.md`.
- **Illustration paths.** Task 2's check fails on any path to a spec, plan or archived doc that does not exist,
  in every file it scans (this plan included). An example path in a doc, a skill or a script comment uses
  `X.Y.Z`, `YYYY` or a file name starting `example-`; a test builds a deliberately dead one by concatenation.
- **Bytes.** LF line endings, a final newline, no BOM, no CR. New scripts start `#!/usr/bin/env node` and
  `"use strict"`, and export their functions with `if (require.main === module)` guarding the CLI.
- **Private text.** No private pack's name in a new test (the docs suite's private-pack scan reads every file
  under `src/tests/`). The fixtures here are invented docs.
- **The harness.**
  - One suite: `node src/tests/pre-release.js | grep -E "^FAIL|^FAILURES|ALL PASSED|Error"`, or
    `python3 src/tests/data-kit.py | grep -E "^FAIL|#127|ALL PASSED|FAILURES"`.
  - Everything: `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`.
    Then restore the build files: `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.
  - A new guard must be seen to fail: break what it guards, watch it go red, put it back.

## Review Focus

1. **A plan that quotes another page's relative link.** Plans copy wiki lines such as `[Journal](features/journal.md)`
   into their steps. From the plan's folder that link resolves nowhere, and a moved plan must leave it exactly as
   written, not "fix" it into something else. → Task 1, "a link that resolves nowhere is left as written" and "a
   quoted link that pointed outside src/docs"; Task 2 counts a relative link only outside fenced blocks and only when
   it names `specs/`, `plans/`, `archive/` or a dated doc.
2. **One doc's name is the start of another's** (`…-design.md` and `…-design-v2.md`). Moving the first must not
   touch references to the second. → Task 1, "a doc whose name only starts the same is untouched".
3. **The same move list run twice** (a rerun after a step was interrupted). The second run must refuse, name the
   missing file, and write nothing. → Task 1, "the same moves again refuse".
4. **`./build.sh --release patch` with a record for another number.** `release.js` resolves `patch` to a version
   first; the gate must check that resolved version, not the word. → Task 3, "a level that resolves to another
   version".
5. **A record that looks complete but isn't**: a state written `Done`, a missing step row, or a Step 4 table row
   that starts like a step row. Only the top table counts, and only exactly `done`. → Task 3, "a state that is not
   exactly done", "a missing step row", and `parseRecord`'s "from the top table only".

---

### Task 1: `scripts/move-docs.js`, and the `pre-release` suite

**Files:**
- Create: `scripts/move-docs.js`.
- Create: `src/tests/pre-release.js`.
- Modify: `src/tests/run.sh:28`, `SUITES`: add `pre-release` after `data-archive`.
- Modify: `src/tests/docs.js:60`, `WORDS`: add `eleven: 11, twelve: 12`.
- Modify: `CLAUDE.md:73`, "(across ten suites)" → "(across eleven suites)".

**Interfaces:**
- Produces (Task 2 and Task 5's skill rely on these):
  - `SCAN: string[]`, the roots searched: `["CLAUDE.md", ".claude/skills", ".github/workflows", "data/packs.json", "scripts", "src", "tools/data-kit"]`;
  - `scanFiles(root) -> string[]`: every text file under `SCAN`, repo-relative, sorted;
  - `findRefs(text, file) -> [{line, index, token, kind: 'repo'|'docs'|'rel', target, prefix, fenced}]`,
    where `target` is the repo path the reference points at;
  - `rewriteText(text, fileOld, fileNew, map, exists) -> {text, count}`;
  - `checkMoves(root, moves) -> string[]`, `planMoves(root, moves) -> {errors, moves, edits}`,
    `applyPlan(root, plan)`;
  - the CLI `node scripts/move-docs.js <moves.json> [--dry-run] [--root DIR]`, where `moves.json` is
    `[{"from": "src/docs/…", "to": "src/docs/…"}, …]`. Output lines are `move  <from> -> <to>`,
    `edit  <file> (<n>)`, and `<n> moved, <m> references rewritten in <k> files`, plus
    ` (dry run: nothing written)` under `--dry-run`. Errors go to stderr as `move-docs: …`, ending with
    `move-docs: nothing was written`, exit 1.
- Consumes: nothing.

Note: spec §4 step 1.3 lists where references are rewritten. Today paths to specs also sit in
`.github/workflows/data-release.yml`, `data/packs.json`'s `_comment`, `scripts/srd-corrections.json`'s `_comment`,
`scripts/srd_text.py`, `scripts/data-release-notes.js`, `tools/data-kit/fbdata.py` and four suites. Decision 2
says "everywhere", so `SCAN` covers them too. A trial backfill of every spec and plan into a version folder, run on a
`git archive` copy while this plan was written, moved 42 docs, rewrote 396 references in 69 files, kept the ledger
at 8068 lines, and left the docs suite green.

- [ ] **Step 1: Write the failing tests, and register the suite.**
  - Create `src/tests/pre-release.js`:

```js
/* Release tooling (#127): scripts/move-docs.js, which files docs by version and
   rewrites every reference to them, and scripts/pre-release-record.js, the
   record release.js checks before it cuts an app release. Every case runs on a
   scratch tree under a temp dir, never on this repo's src/docs. The gate inside
   release.js is tested in data-kit.py, beside the other release.js cases, on a
   scratch git checkout. Spec: src/docs/specs/2026-10-29-pre-release-design.md */
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const {spawnSync} = require('child_process');
const {makeCheck, ROOT} = require('./harness');

const ck = makeCheck();
const MOVE_DOCS = path.join(ROOT, 'scripts', 'move-docs.js');
const RECORD_JS = path.join(ROOT, 'scripts', 'pre-release-record.js');
/* ---------- scripts/move-docs.js (#127, spec §4 step 1.3, §9, §10) */
const md = require(MOVE_DOCS);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* a scratch tree laid out like this repo: every place the script searches,
   one invented doc per kind of reference */
const LEDGER_LINES = ['# Wiring ledger', '', '## Example (#1, 2026-01-01)', '',
  'Spec: `src/docs/specs/example-alpha-design.md`; plan: `src/docs/plans/example-alpha.md`.',
  '1. Spec `specs/example-alpha-design.md`, and its [page](../wiki/example-page.md).',
  'Its [spec](../specs/example-alpha-design.md) again; the other one, `specs/example-alpha-design-v2.md`, stays.', ''];
const FILES = {
  'src/docs/specs/example-alpha-design.md': [
    '# Alpha: design', '', 'Read [the page](../wiki/example-page.md) and [Beta](example-beta-design.md) first.',
    'Plan: [plan](../plans/example-alpha.md).', ''].join('\n'),
  'src/docs/specs/example-beta-design.md': ['# Beta: design', '', 'Follows [Alpha](example-alpha-design.md).', ''].join('\n'),
  'src/docs/specs/example-alpha-design-v2.md': '# Alpha v2\n',
  'src/docs/plans/example-alpha.md': [
    '# Alpha plan', '', '**Spec:** `src/docs/specs/example-alpha-design.md`, also [the spec](../specs/example-alpha-design.md).',
    '', '```bash', 'cat src/docs/specs/example-alpha-design.md', 'echo "[Journal](features/example-journal.md)"', '```',
    'A wiki line quoted for a page: [Alpha](../../specs/example-alpha-design.md).', ''].join('\n'),
  'src/docs/wiki/example-page.md': [
    '# Example page', '', 'Design: [the spec](../specs/example-alpha-design.md), and `src/docs/specs/example-alpha-design.md`.', ''].join('\n'),
  'src/docs/EXAMPLE.md': 'See [Alpha](specs/example-alpha-design.md) and [./ form](./specs/example-alpha-design.md).\n',
  'src/docs/_claude/WIRING-LEDGER.md': LEDGER_LINES.join('\n'),
  'src/js/10-example.js': '/* Design: src/docs/specs/example-alpha-design.md §3; specs/example-alpha-design.md §4 */\nfunction example(){}\n',
  'CLAUDE.md': '# Brief\n\nThe [alpha spec](src/docs/specs/example-alpha-design.md).\n',
  '.claude/skills/example/SKILL.md': 'Read /Users/someone/RPGFieldbook/src/docs/specs/example-alpha-design.md first.\n',
  'scripts/example.py': '"""Spec: src/docs/specs/example-alpha-design.md §2."""\n',
};
const MOVES = [
  {from: 'src/docs/specs/example-alpha-design.md', to: 'src/docs/specs/1.9.0/example-alpha-design.md'},
  {from: 'src/docs/plans/example-alpha.md', to: 'src/docs/plans/1.9.0/example-alpha.md'},
];
const tree = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-move-docs-'));
  for (const [rel, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), {recursive: true});
    fs.writeFileSync(path.join(d, rel), text);
  }
  return d;
};
/* every file under d with a hash of its bytes, so "wrote nothing" is checkable */
const snapshot = d => {
  const out = {};
  const walk = rel => fs.readdirSync(path.join(d, rel), {withFileTypes: true}).forEach(e => {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(r);
    else out[r] = crypto.createHash('sha256').update(fs.readFileSync(path.join(d, r))).digest('hex');
  });
  walk('');
  return out;
};
const runMove = (d, moves, ...flags) => {
  const list = path.join(d, '..', path.basename(d) + '-moves.json');
  fs.writeFileSync(list, JSON.stringify(moves));
  return spawnSync('node', [MOVE_DOCS, list, '--root', d, ...flags], {encoding: 'utf8'});
};
const rd = (d, rel) => fs.readFileSync(path.join(d, rel), 'utf8');

{
  // findRefs: the three kinds, and what is not a reference
  const r = md.findRefs('a src/docs/specs/example-x.md b\n[l](../specs/example-y.md) specs/example-z.md\nplain-name.md docs/superpowers/plans/q.md', 'src/docs/wiki/p.md');
  ck('#127 findRefs: a repo path, a relative link, a docs-rooted path',
     same(r.map(x => [x.kind, x.target]), [['repo', 'src/docs/specs/example-x.md'], ['rel', 'src/docs/specs/example-y.md'], ['docs', 'src/docs/specs/example-z.md']]), r);
  const f = md.findRefs('```\nsrc/docs/specs/example-x.md\n```\nsrc/docs/specs/example-x.md', 'CLAUDE.md');
  ck('#127 findRefs: a path in a fenced block is found, and marked fenced', same(f.map(x => x.fenced), [true, false]), f);
  const a = md.findRefs('/abs/repo/src/docs/plans/example-p.md', 'CLAUDE.md')[0];
  ck('#127 findRefs: an absolute path keeps its prefix', a && a.prefix === '/abs/repo/' && a.target === 'src/docs/plans/example-p.md', a);
  ck('#127 findRefs: a relative link that leaves the repo is not one', md.findRefs('[x](../../../../out.md)', 'src/docs/x.md').length === 0);
}

{
  // --dry-run prints the plan and writes nothing
  const d = tree();
  const before = snapshot(d);
  const r = runMove(d, MOVES, '--dry-run');
  ck('#127 move-docs --dry-run exits 0 and lists both moves',
     r.status === 0 && r.stdout.includes('move  src/docs/specs/example-alpha-design.md -> src/docs/specs/1.9.0/example-alpha-design.md') &&
     r.stdout.includes('move  src/docs/plans/example-alpha.md -> src/docs/plans/1.9.0/example-alpha.md'), r.stdout + r.stderr);
  ck('#127 ...names each file it would edit, and says it wrote nothing',
     /^edit  src\/docs\/_claude\/WIRING-LEDGER\.md \(\d+\)$/m.test(r.stdout) && r.stdout.includes('(dry run: nothing written)'), r.stdout);
  ck('#127 ...and wrote nothing', same(snapshot(d), before));
  fs.rmSync(d, {recursive: true, force: true});
}

{
  // the real run
  const d = tree();
  const r = runMove(d, MOVES);
  ck('#127 move-docs exits 0', r.status === 0, r.stderr);
  ck('#127 the files are moved', !fs.existsSync(path.join(d, MOVES[0].from)) && !fs.existsSync(path.join(d, MOVES[1].from)) &&
     fs.existsSync(path.join(d, MOVES[0].to)) && fs.existsSync(path.join(d, MOVES[1].to)));
  const spec = rd(d, MOVES[0].to);
  ck('#127 a moved spec\'s own relative links are recomputed from its new folder',
     spec.includes('[the page](../../wiki/example-page.md)') && spec.includes('[Beta](../example-beta-design.md)') &&
     spec.includes('[plan](../../plans/1.9.0/example-alpha.md)'), spec);
  ck('#127 a sibling that stayed links to the moved one', rd(d, 'src/docs/specs/example-beta-design.md').includes('[Alpha](1.9.0/example-alpha-design.md)'));
  const plan = rd(d, MOVES[1].to);
  ck('#127 a moved plan: repo paths and relative links both follow',
     plan.includes('**Spec:** `src/docs/specs/1.9.0/example-alpha-design.md`') && plan.includes('[the spec](../../specs/1.9.0/example-alpha-design.md)'), plan);
  ck('#127 a path inside a fenced block is rewritten', plan.includes('cat src/docs/specs/1.9.0/example-alpha-design.md'), plan);
  ck('#127 a link that resolves nowhere is left as written', plan.includes('echo "[Journal](features/example-journal.md)"'), plan);
  ck('#127 a quoted link that pointed outside src/docs from the old folder is left as written',
     plan.includes('[Alpha](../../specs/example-alpha-design.md).'), plan);
  ck('#127 the wiki: a relative link and a path in a code span',
     rd(d, 'src/docs/wiki/example-page.md').includes('[the spec](../specs/1.9.0/example-alpha-design.md), and `src/docs/specs/1.9.0/example-alpha-design.md`'));
  ck('#127 src/docs/*.md: a link relative to src/docs, with and without ./',
     rd(d, 'src/docs/EXAMPLE.md') === 'See [Alpha](specs/1.9.0/example-alpha-design.md) and [./ form](./specs/1.9.0/example-alpha-design.md).\n', rd(d, 'src/docs/EXAMPLE.md'));
  ck('#127 a code comment: the repo path and the docs-rooted one',
     rd(d, 'src/js/10-example.js').startsWith('/* Design: src/docs/specs/1.9.0/example-alpha-design.md §3; specs/1.9.0/example-alpha-design.md §4 */'));
  ck('#127 CLAUDE.md, a skill (absolute path) and a script', rd(d, 'CLAUDE.md').includes('(src/docs/specs/1.9.0/example-alpha-design.md)') &&
     rd(d, '.claude/skills/example/SKILL.md').includes('/Users/someone/RPGFieldbook/src/docs/specs/1.9.0/example-alpha-design.md') &&
     rd(d, 'scripts/example.py').includes('src/docs/specs/1.9.0/example-alpha-design.md §2'));
  const led = rd(d, 'src/docs/_claude/WIRING-LEDGER.md').split('\n');
  ck('#127 the ledger keeps its line count', led.length === LEDGER_LINES.length, led.length);
  ck('#127 ...changes only the lines that cite a moved doc, in place',
     led.every((l, i) => (i === 4 || i === 5 || i === 6) ? l !== LEDGER_LINES[i] : l === LEDGER_LINES[i]) &&
     led[4] === 'Spec: `src/docs/specs/1.9.0/example-alpha-design.md`; plan: `src/docs/plans/1.9.0/example-alpha.md`.' &&
     led[5] === '1. Spec `specs/1.9.0/example-alpha-design.md`, and its [page](../wiki/example-page.md).' &&
     led[6] === 'Its [spec](../specs/1.9.0/example-alpha-design.md) again; the other one, `specs/example-alpha-design-v2.md`, stays.', led.slice(4, 7));
  ck('#127 a doc whose name only starts the same is untouched', rd(d, 'src/docs/specs/example-alpha-design-v2.md') === '# Alpha v2\n');
  // run it again with nothing to do: the same moves now refuse, and nothing changes
  const after = snapshot(d);
  const again = runMove(d, MOVES);
  ck('#127 the same moves again refuse (the files are gone) and write nothing',
     again.status === 1 && again.stderr.includes('src/docs/specs/example-alpha-design.md does not exist') &&
     again.stderr.includes('nothing was written') && same(snapshot(d), after), again.stderr);
  fs.rmSync(d, {recursive: true, force: true});
}

{
  // a bad move list writes nothing
  const bad = [
    [[{from: 'src/docs/specs/example-gone.md', to: 'src/docs/specs/1.9.0/example-gone.md'}], 'src/docs/specs/example-gone.md does not exist'],
    [[{from: 'src/docs/specs/example-alpha-design.md', to: 'src/docs/specs/example-beta-design.md'}], 'src/docs/specs/example-beta-design.md already exists'],
    [[{from: 'src/docs/specs/example-alpha-design.md', to: 'src/docs/x/example-a.md'}, {from: 'src/docs/plans/example-alpha.md', to: 'src/docs/x/example-a.md'}], 'src/docs/x/example-a.md is the target of two moves'],
    [[{from: 'src/docs/specs/example-alpha-design.md', to: 'docs/example-alpha-design.md'}], 'docs/example-alpha-design.md is not a plain path under src/docs/'],
    [[{from: 'src/docs/specs/example-alpha-design.md', to: 'src/docs/specs/../../example-escape.md'}], 'is not a plain path under src/docs/'],
    [[{from: 'src/docs/specs/example-alpha-design.md', to: 'src/docs/specs/example-alpha-design.txt'}], 'changes the file type'],
    [[], 'the move list is empty'],
  ];
  for (const [moves, why] of bad) {
    const d = tree();
    const before = snapshot(d);
    const r = runMove(d, moves);
    ck('#127 move-docs refuses: ' + why, r.status === 1 && r.stderr.includes(why) && r.stderr.includes('nothing was written') && same(snapshot(d), before), r.stderr);
    fs.rmSync(d, {recursive: true, force: true});
  }
  const d = tree();
  const r = spawnSync('node', [MOVE_DOCS, path.join(d, 'no-such-list.json'), '--root', d], {encoding: 'utf8'});
  ck('#127 move-docs refuses a move list it cannot read', r.status === 1 && r.stderr.includes('cannot read'), r.stderr);
  const u = spawnSync('node', [MOVE_DOCS], {encoding: 'utf8'});
  ck('#127 move-docs with no list prints its usage', u.status === 1 && u.stderr.includes('usage'), u.stderr);
  fs.rmSync(d, {recursive: true, force: true});
}

{
  // no rewrite can add or remove a line, whatever the text
  const map = new Map([['src/docs/specs/example-a.md', 'src/docs/specs/1.9.0/example-a.md']]);
  const text = 'x src/docs/specs/example-a.md src/docs/specs/example-a.md\n\n```\n[a](../specs/example-a.md)\n```\nspecs/example-a.md\n';
  const r = md.rewriteText(text, 'src/docs/wiki/p.md', 'src/docs/wiki/p.md', map, () => true);
  ck('#127 rewriteText: every occurrence, same line count', r.count === 4 && r.text.split('\n').length === text.split('\n').length &&
     r.text === 'x src/docs/specs/1.9.0/example-a.md src/docs/specs/1.9.0/example-a.md\n\n```\n[a](../specs/1.9.0/example-a.md)\n```\nspecs/1.9.0/example-a.md\n', r);
  ck('#127 the files it searches include the ledger, skills, CLAUDE.md and src/js, and never dist/ or docs/',
     ['CLAUDE.md', '.claude/skills', 'src', 'scripts'].every(s => md.SCAN.includes(s)) && !md.SCAN.some(s => /^(dist|docs)(\/|$)/.test(s)), md.SCAN);
}

// ---- add new cases above this line ----
ck.done();
```

  - `src/tests/run.sh:28` becomes
    `SUITES="converter tables rules-data sheet char-update docs data-kit data-archive pre-release srd-verbatim private-data"`.
  - `src/tests/docs.js:60` becomes
    `const WORDS = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12};`.
  - `CLAUDE.md:73`: "(across ten suites)" → "(across eleven suites)". `docs.js` checks this count against `SUITES`.

- [ ] **Step 2: Run and watch it fail.** Run `node src/tests/pre-release.js | tail -3`.
  Expected: `Error: Cannot find module '…/scripts/move-docs.js'`. Run `node src/tests/docs.js | tail -1`:
  `ALL PASSED`, since the suite is registered and counted.

- [ ] **Step 3: Implement.** Create `scripts/move-docs.js`:

```js
#!/usr/bin/env node
/*
 * Move dev docs and rewrite every reference to them (#127, the pre-release
 * spec, src/docs/specs/2026-10-29-pre-release-design.md §4 step 1.3).
 *
 *   node scripts/move-docs.js <moves.json> [--dry-run] [--root DIR]
 *
 * moves.json is [{"from": "src/docs/specs/example-a.md", "to": "src/docs/specs/1.9.0/example-a.md"}, ...],
 * repo-relative. Every file under SCAN is searched; a reference is rewritten in
 * the form it was written in:
 *   repo-rooted  src/docs/specs/example-a.md, also after a prefix (/abs/repo/src/docs/…)
 *   docs-rooted  specs/example-a.md — relative to src/docs/, as code comments write it
 *   relative     ../specs/example-a.md, or any markdown link target — recomputed from
 *                the file's own folder, and from its new folder if it moved
 * Fenced code blocks included. A path never holds a newline, so no file gains or
 * loses a line: the ledger's L<n> citations stay valid, and this is asserted
 * before anything is written. Everything is worked out in memory first; a bad
 * move list writes nothing. --dry-run prints the plan and writes nothing.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const P = path.posix;

const SCAN = ["CLAUDE.md", ".claude/skills", ".github/workflows", "data/packs.json", "scripts", "src", "tools/data-kit"];
const TEXT = /\.(md|js|py|sh|ya?ml|json|html|css|txt)$/;
const SKIP_DIRS = new Set(["node_modules", "__pycache__", ".git"]);
const DOCS_DIRS = ["specs", "plans", "archive", "wiki", "qa", "_claude"];
const TOKEN = /[A-Za-z0-9_.\/-]+\.(?:md|html)(?![A-Za-z0-9_-])/g;
const FENCE = /^\s*(```|~~~)/;

/* every text file under SCAN that exists, repo-relative, sorted */
function scanFiles(root) {
  const out = [];
  const walk = rel => {
    const abs = path.join(root, rel);
    let st;
    try { st = fs.statSync(abs); } catch (e) { return; }
    if (st.isFile()) { if (TEXT.test(rel)) out.push(rel); return; }
    if (!st.isDirectory()) return;
    for (const name of fs.readdirSync(abs)) if (!SKIP_DIRS.has(name)) walk(P.join(rel, name));
  };
  SCAN.forEach(walk);
  return [...new Set(out)].sort();
}

/* the references to a doc in `text`, which lives at repo path `file`:
   [{line (1-based), index, token, kind: 'repo'|'docs'|'rel', target, prefix, fenced}] */
function findRefs(text, file) {
  const refs = [];
  let fenced = false;
  text.split("\n").forEach((line, i) => {
    if (FENCE.test(line)) { fenced = !fenced; return; }
    for (const m of line.matchAll(TOKEN)) {
      const token = m[0];
      const before = line.slice(0, m.index);
      const repo = /^(.*\/)?(src\/docs\/.+)$/.exec(token);
      let kind, target, prefix = "";
      if (repo) { kind = "repo"; prefix = repo[1] || ""; target = repo[2]; }
      else if (/^\.\.?\//.test(token) || /\]\($/.test(before)) {
        kind = "rel";
        target = P.normalize(P.join(P.dirname(file), token));
        if (target.startsWith("../")) continue;
      } else if (DOCS_DIRS.includes(token.split("/")[0]) && token.includes("/")) {
        kind = "docs"; target = "src/docs/" + token;
      } else continue;
      refs.push({ line: i + 1, index: m.index, token, kind, target, prefix, fenced });
    }
  });
  return refs;
}

/* `text` from `fileOld`, rewritten for its home `fileNew` and the moves in `map`
   (old repo path -> new); exists(p) says whether repo path p is a file.
   Returns {text, count}. */
function rewriteText(text, fileOld, fileNew, map, exists) {
  const moved = fileOld !== fileNew;
  const lines = text.split("\n");
  let count = 0;
  const byLine = new Map();
  for (const r of findRefs(text, fileOld)) {
    let next = null;
    if (r.kind === "repo" && map.has(r.target)) next = r.prefix + map.get(r.target);
    else if (r.kind === "docs" && map.has(r.target)) next = map.get(r.target).slice("src/docs/".length);
    else if (r.kind === "rel" && (map.has(r.target) || (moved && exists(r.target)))) {
      const to = map.get(r.target) || r.target;
      next = P.relative(P.dirname(fileNew), to);
      if (r.token.startsWith("./") && !next.startsWith("../")) next = "./" + next;
    }
    if (next === null || next === r.token) continue;
    if (!byLine.has(r.line)) byLine.set(r.line, []);
    byLine.get(r.line).push([r.index, r.token.length, next]);
  }
  for (const [n, edits] of byLine) {
    let s = lines[n - 1];
    edits.sort((a, b) => b[0] - a[0]).forEach(([at, len, rep]) => { s = s.slice(0, at) + rep + s.slice(at + len); count++; });
    lines[n - 1] = s;
  }
  return { text: lines.join("\n"), count };
}

/* check a move list against the tree at root; returns a list of problems */
function checkMoves(root, moves) {
  const errs = [];
  if (!Array.isArray(moves) || !moves.length) return ["the move list is empty or not a list"];
  const froms = new Set(), tos = new Set();
  for (const mv of moves) {
    const from = mv && mv.from, to = mv && mv.to;
    if (typeof from !== "string" || typeof to !== "string") { errs.push("a move needs a from and a to: " + JSON.stringify(mv)); continue; }
    for (const p of [from, to]) {
      if (!p.startsWith("src/docs/") || P.normalize(p) !== p || p.includes("..")) errs.push(p + " is not a plain path under src/docs/");
    }
    if (P.extname(from) !== P.extname(to)) errs.push(from + " -> " + to + " changes the file type");
    if (!fs.existsSync(path.join(root, from)) || !fs.statSync(path.join(root, from)).isFile()) errs.push(from + " does not exist");
    if (fs.existsSync(path.join(root, to))) errs.push(to + " already exists");
    if (froms.has(from)) errs.push(from + " is moved twice");
    if (tos.has(to)) errs.push(to + " is the target of two moves");
    froms.add(from); tos.add(to);
  }
  for (const t of tos) if (froms.has(t)) errs.push(t + " is both moved and a target");
  return errs;
}

/* work out every write; nothing touches the disk.
   Returns {errors, moves, edits: [{from, to, text, count}]} where from === to for a file that stays */
function planMoves(root, moves) {
  const errors = checkMoves(root, moves);
  if (errors.length) return { errors, moves, edits: [] };
  const map = new Map(moves.map(m => [m.from, m.to]));
  const exists = p => { try { return fs.statSync(path.join(root, p)).isFile(); } catch (e) { return false; } };
  const edits = [];
  const files = new Set(scanFiles(root));
  moves.forEach(m => files.add(m.from));
  for (const f of [...files].sort()) {
    const before = fs.readFileSync(path.join(root, f), "utf8");
    const to = map.get(f) || f;
    const r = rewriteText(before, f, to, map, exists);
    if (r.text.split("\n").length !== before.split("\n").length) {
      errors.push(f + ": a rewrite changed the number of lines");
      continue;
    }
    if (r.count || to !== f) edits.push({ from: f, to, text: r.text, count: r.count });
  }
  return { errors, moves, edits };
}

function applyPlan(root, plan) {
  for (const e of plan.edits) {
    const dest = path.join(root, e.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, e.text);
    if (e.to !== e.from) fs.unlinkSync(path.join(root, e.from));
  }
}

function main(argv) {
  const args = argv.slice(2);
  const dry = args.includes("--dry-run");
  const ri = args.indexOf("--root");
  const root = ri >= 0 ? path.resolve(args[ri + 1] || "") : path.resolve(__dirname, "..");
  const list = args.filter((a, i) => !a.startsWith("--") && (ri < 0 || i !== ri + 1))[0];
  if (!list) { console.error("move-docs: usage: node scripts/move-docs.js <moves.json> [--dry-run] [--root DIR]"); return 1; }
  let moves;
  try { moves = JSON.parse(fs.readFileSync(list, "utf8")); }
  catch (e) { console.error("move-docs: cannot read " + list + ": " + e.message); return 1; }
  const plan = planMoves(root, moves);
  if (plan.errors.length) { plan.errors.forEach(e => console.error("move-docs: " + e)); console.error("move-docs: nothing was written"); return 1; }
  for (const m of moves) console.log("move  " + m.from + " -> " + m.to);
  let refs = 0, files = 0;
  for (const e of plan.edits) if (e.count) { console.log("edit  " + e.to + " (" + e.count + ")"); refs += e.count; files++; }
  console.log(moves.length + " moved, " + refs + " references rewritten in " + files + " files" + (dry ? " (dry run: nothing written)" : ""));
  if (!dry) applyPlan(root, plan);
  return 0;
}

module.exports = { SCAN, scanFiles, findRefs, rewriteText, checkMoves, planMoves, applyPlan };
if (require.main === module) process.exit(main(process.argv));
```

- [ ] **Step 4: Run the suite, then everything.** Run
  `node src/tests/pre-release.js | grep -E "^FAIL|ALL PASSED|FAILURES"`. Expected: `ALL PASSED (34)`.
  Then run the full suite and restore the build files (Global Constraints). Expected: every suite passes
  (`srd-verbatim` and `private-data` may skip), and `pre-release` shows 34 checks.

- [ ] **Step 5: Commit.**

```bash
git add scripts/move-docs.js src/tests/pre-release.js src/tests/run.sh src/tests/docs.js CLAUDE.md
git commit -m "feat(#127): move-docs.js moves docs and rewrites every reference" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The docs suite's link check (spec §6)

**Files:**
- Modify: `src/tests/docs.js`, a new block just above the last line, `ck.done();` (:400).

**Interfaces:**
- Consumes: `scanFiles(root)` and `findRefs(text, file)` from Task 1.
- Produces: the check `every link to a spec, plan or archived doc resolves …`, which step 1 of `/pre-release`
  relies on to catch a missed rewrite.

Note: spec §6 names the places to check. This uses `move-docs.js`'s own list (Task 1's Note), minus `src/tests/`,
whose fixtures name invented docs. Two refinements keep it to real claims, both found by running a prototype on
the repo: 23 false alarms came from plans quoting other pages' relative links, inside fenced blocks and in prose.
So a relative link counts only outside fenced blocks, and only when it names `specs/`, `plans/` or `archive/` or a
dated doc (`YYYY-MM-DD-…`). Repo paths and docs-rooted paths count everywhere, fenced blocks included. `X.Y.Z`,
`YYYY` and `example-` names are illustrations.

- [ ] **Step 1: Write the check.** Add this block just above `ck.done();`:

```js
// ---------- links to specs, plans and the archive resolve (#127, pre-release spec §6)
// /pre-release files specs and plans by version and archives finished docs, and
// scripts/move-docs.js rewrites every reference. This is the net under it: every
// path or link that names src/docs/specs/, plans/ or archive/ must exist. The
// files are move-docs.js's own list (scanFiles()) minus src/tests/, whose
// fixtures name invented docs. A relative link counts when it names one of the
// three folders or a dated doc, and not inside a fenced block: plans quote other
// pages' links there, which are relative to those pages. X.Y.Z, YYYY and an
// example- file name mark an illustration, not a claim.
{
  const {scanFiles, findRefs} = require('../../scripts/move-docs.js');
  const DOC_TARGET = /^src\/docs\/(specs|plans|archive)\//;
  const ILLUSTRATION = /X\.Y\.Z|YYYY|(^|\/)example-[^/]*$/;
  const counts = r => r.kind !== 'rel' || (!r.fenced &&
    (/(^|\/)(specs|plans|archive)\//.test(r.token) || /^\d{4}-\d{2}-\d{2}-/.test(path.posix.basename(r.token))));
  const deadDocLinks = (file, text, exists) => findRefs(text, file)
    .filter(r => DOC_TARGET.test(r.target) && !ILLUSTRATION.test(r.token) && counts(r) && !exists(r.target));
  const onDisk = p => { try { return fs.statSync(path.join(ROOT, p)).isFile(); } catch (e) { return false; } };

  // seen to fail first, on invented paths against a stand-in disk that holds one
  // doc: a dead reference of each kind, and one that resolves
  const kept = 'src/docs/specs/' + '2026-01-01-kept-design.md', gone = '2026-01-01-gone-design.md';
  const only = p => p === kept;
  ck('#127 the doc-link check catches a dead repo path',
     deadDocLinks('CLAUDE.md', 'See src/docs/specs/' + gone + '.', only).length === 1);
  ck('#127 ...a dead relative link from the wiki',
     deadDocLinks('src/docs/wiki/process/x.md', '[spec](../../specs/' + gone + ')', only).length === 1);
  ck('#127 ...and a dead docs-rooted path in a code comment',
     deadDocLinks('src/js/x.js', '/* Design: specs/' + gone + ' */', only).length === 1);
  ck('#127 ...but passes a link that resolves, and an illustration',
     deadDocLinks('src/docs/wiki/x.md', '[spec](../specs/' + '2026-01-01-kept-design.md) and src/docs/archive/X.Y.Z/PRE-RELEASE.md', only).length === 0);

  const dead = scanFiles(ROOT).filter(f => !f.startsWith('src/tests/'))
    .flatMap(f => deadDocLinks(f, read(f), onDisk).map(r => f + ':' + r.line + ' ' + r.token));
  ck('every link to a spec, plan or archived doc resolves (a move missed one: scripts/move-docs.js rewrites them)',
     dead.length === 0, dead.slice(0, 10));
}
```

- [ ] **Step 2: Run it.** Run `node src/tests/docs.js | grep -E "#127|every link to a spec|ALL PASSED|FAILURES"`.
  Expected: the four `#127` self-tests and the repo-wide check all PASS; today's repo resolves.
- [ ] **Step 3: See it fail.** In `src/js/87-notes.js:95`, add an `X` before `.md` in the comment's
  `specs/2026-10-17-journal-checklists-design.md` (a docs-rooted path in a code comment, which the wiki's own link
  check never reads). Run the suite. Expected: `FAIL  every link to a spec, plan or archived doc resolves …`, naming
  `src/js/87-notes.js:95` and the broken path. Put the line back with `git checkout -- src/js/87-notes.js`, and run
  it again: PASS.
- [ ] **Step 4: Run everything,** then restore the build files. Expected: every suite passes (`srd-verbatim` and `private-data` may skip).
- [ ] **Step 5: Commit.**

```bash
git add src/tests/docs.js
git commit -m "feat(#127): the docs suite checks every link to a spec, plan or archived doc" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The record, and the gate in `release.js` (spec §3, §5)

**Files:**
- Create: `scripts/pre-release-record.js`.
- Modify: `scripts/release.js`:
  - the header comment (:2–:14);
  - the gate, after the "must be higher" check (:86) and before the `DATA_VERSIONS` lookup (:119), so a refusal
    writes nothing;
  - the archive move, after the notebook is emptied (:147).
- Modify: `src/tests/pre-release.js`, a new block above `// ---- add new cases above this line ----`.
- Modify: `src/tests/data-kit.py`:
  - `checkout()` (:321) copies the new script;
  - a `prerelease()` helper after `checkout()` (:342);
  - new refusal cases before the release.js case (:391);
  - that case (:391–:402) writes a complete record first and checks the move.

**Interfaces:**
- Produces:
  - `RECORD = "src/docs/PRE-RELEASE.md"`;
  - `STEPS = ["Docs", "Outstanding issues", "QA checklist", "QA bugs", "Release notes"]`;
  - `archivePath(version) -> string`;
  - `readRecord(root) -> string | null`;
  - `parseRecord(text) -> {version: string | null, steps: [{n, name, state}]}`;
  - `recordProblem(text, version) -> string | null`;
  - `gateProblem(root, version) -> string | null`;
  - `archiveRecord(root, version) -> string` (the archive path);
  - the CLI `node scripts/pre-release-record.js [X.Y.Z] [--root DIR]`: `pre-release X.Y.Z: complete` on stdout,
    exit 0; else `pre-release: <problem>` on stderr, exit 1. With no version it checks the record's own.
- Consumes: nothing from Tasks 1–2.

Note: the spec speaks of `./build.sh --release X.Y.Z`, but `release.js` also takes `patch|minor|major`. The gate
checks the version those resolve to (`next`), so `--release patch` needs a record for that patch number.
`data-kit.py` is the suite that already runs `release.js` (in a scratch git checkout, `checkout()`), so the gate's
end-to-end cases go there. Its existing case "release.js bumps the changed pack" now needs a record. The gate also
refuses when the archive already holds a record for that version: the spec doesn't say so, but cutting a version
twice is already refused, and this keeps a stray record from overwriting a released one.

- [ ] **Step 1: Write the failing tests.**
  - Add to `src/tests/pre-release.js`, above `// ---- add new cases above this line ----`:

```js
/* ---------- scripts/pre-release-record.js (#127, spec §3, §5) */
const rec = require(RECORD_JS);
/* a record in the spec's format; `open` lists the steps still open */
const record = (ver, open = []) => [
  '# Pre-release ' + ver, 'Started: 2026-10-30 · App was 1.8.1', '',
  '| Step | State | Done | Summary |', '|---|---|---|---|',
  ...rec.STEPS.map((s, i) => open.includes(i + 1) ? `| ${i + 1}. ${s} | open | | |` : `| ${i + 1}. ${s} | done | 2026-10-30 | ok |`),
  '', '## Step 2: outstanding issues', '| Item | Source | Title | Priority | Decision | Issue |', '|---|---|---|---|---|---|', '',
  '## Step 4: bugs from QA', '| Line | Title | Priority | Issue | State |', '|---|---|---|---|---|',
  '| 1. Sheet | HP box | P2 | #140 | open |', ''].join('\n');

{
  const p = rec.parseRecord(record('1.9.0', [4]));
  ck('#127 parseRecord: the version and five steps, from the top table only',
     p.version === '1.9.0' && p.steps.length === 5 && p.steps[3].state === 'open' && p.steps[0].state === 'done', p);
  ck('#127 the steps are the spec\'s five, in order', same(rec.STEPS, ['Docs', 'Outstanding issues', 'QA checklist', 'QA bugs', 'Release notes']));
  ck('#127 a complete record for exactly that version passes', rec.recordProblem(record('1.9.0'), '1.9.0') === null);
  ck('#127 no record: refused, naming /pre-release',
     rec.recordProblem(null, '1.9.0') === 'no pre-release record for 1.9.0 (src/docs/PRE-RELEASE.md does not exist). Run /pre-release 1.9.0 first.');
  ck('#127 a record for another version: refused, naming both',
     rec.recordProblem(record('1.9.1'), '1.9.0') === 'src/docs/PRE-RELEASE.md is for 1.9.1, not 1.9.0. Run /pre-release 1.9.0 first.');
  ck('#127 ...1.9.0 is not 1.9.00', rec.recordProblem(record('1.9.00'), '1.9.0') !== null);
  ck('#127 an open step: refused, naming the first open one',
     rec.recordProblem(record('1.9.0', [5, 3]), '1.9.0') === 'pre-release 1.9.0 is not finished: step 3. QA checklist is open. Run /pre-release 1.9.0 to finish it.');
  ck('#127 a state that is not exactly "done" is open', rec.recordProblem(record('1.9.0').replace('| 2. Outstanding issues | done', '| 2. Outstanding issues | Done'), '1.9.0')
     .includes('step 2. Outstanding issues is open'));
  ck('#127 a missing step row: refused', rec.recordProblem(record('1.9.0').replace(/^\| 5\. .*\n/m, ''), '1.9.0') ===
     'src/docs/PRE-RELEASE.md has no row for step 5. Release notes. Run /pre-release 1.9.0 to finish it.');
  ck('#127 no heading: refused', rec.recordProblem('just text\n', '1.9.0').includes('has no "# Pre-release X.Y.Z" heading'));
  ck('#127 the archive path', rec.archivePath('1.9.0') === ['src', 'docs', 'archive', '1.9.0', 'PRE-RELEASE.md'].join('/'));
}

{
  // the CLI, and gateProblem/archiveRecord on a scratch tree
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-record-'));
  const cli = (...a) => spawnSync('node', [RECORD_JS, ...a, '--root', d], {encoding: 'utf8'});
  let r = cli('1.9.0');
  ck('#127 the CLI with no record exits 1 with the gate\'s words', r.status === 1 && r.stderr.includes('Run /pre-release 1.9.0 first'), r.stderr);
  r = cli();
  ck('#127 ...and with no version either', r.status === 1 && r.stderr.includes('Run /pre-release X.Y.Z first'), r.stderr);
  fs.mkdirSync(path.join(d, 'src/docs'), {recursive: true});
  fs.writeFileSync(path.join(d, rec.RECORD), record('1.9.0', [4]));
  r = cli();
  ck('#127 the CLI with no version checks the record\'s own', r.status === 1 && r.stderr.includes('step 4. QA bugs is open'), r.stderr);
  fs.writeFileSync(path.join(d, rec.RECORD), record('1.9.0'));
  r = cli('1.9.0');
  ck('#127 the CLI passes a complete record', r.status === 0 && r.stdout.trim() === 'pre-release 1.9.0: complete', r.stdout + r.stderr);
  const text = fs.readFileSync(path.join(d, rec.RECORD), 'utf8');
  ck('#127 archiveRecord moves it, bytes intact', rec.archiveRecord(d, '1.9.0') === rec.archivePath('1.9.0') &&
     !fs.existsSync(path.join(d, rec.RECORD)) && fs.readFileSync(path.join(d, rec.archivePath('1.9.0')), 'utf8') === text);
  fs.writeFileSync(path.join(d, rec.RECORD), record('1.9.0'));
  ck('#127 gateProblem refuses a version already archived', rec.gateProblem(d, '1.9.0') ===
     rec.archivePath('1.9.0') + ' already exists: 1.9.0 has been cut before.');
  fs.rmSync(d, {recursive: true, force: true});
}
```

  - `src/tests/data-kit.py`, `checkout()`, the copy loop (:325) becomes:

```python
    for rel in ("scripts/data-release.js", "scripts/data-release-notes.js", "scripts/release.js",
                "scripts/pre-release-record.js", "tools/data-kit/fbdata.py"):
```

  - Right after `checkout()`'s `return d` (:342), add:

```python


PRE_RELEASE_STEPS = ["Docs", "Outstanding issues", "QA checklist", "QA bugs", "Release notes"]


def prerelease(d, ver, open_steps=()):
    """a pre-release record in the spec's format (#127, spec §3): every step done but open_steps"""
    rows = ["| %d. %s | %s |" % (i + 1, s, "open | |" if i + 1 in open_steps else "done | 2026-10-30 | ok")
            for i, s in enumerate(PRE_RELEASE_STEPS)]
    write(d, "src/docs/PRE-RELEASE.md", raw="# Pre-release %s\nStarted: 2026-10-30 · App was 1.8.0\n\n"
          "| Step | State | Done | Summary |\n|---|---|---|---|\n%s\n" % (ver, "\n".join(rows)))
```

  - Replace the first three lines of the release.js case (:391–:393: `d = checkout()`, the `write(...)` of
    `data/alpha/spells.json` with level 6, and `r = node(d, "scripts/release.js", "1.9.0")`) with:

```python
# ---------- #127: release.js refuses without a complete pre-release record (spec §5)
d = checkout()
rec_path = os.path.join(d, "src/docs/PRE-RELEASE.md")
for name, rec, level, msg in [
        ("no record", None, "1.9.0",
         "no pre-release record for 1.9.0 (src/docs/PRE-RELEASE.md does not exist). Run /pre-release 1.9.0 first."),
        ("a record for another version", ("1.9.1", ()), "1.9.0",
         "src/docs/PRE-RELEASE.md is for 1.9.1, not 1.9.0. Run /pre-release 1.9.0 first."),
        ("an open step, naming the first", ("1.9.0", (3, 5)), "1.9.0",
         "pre-release 1.9.0 is not finished: step 3. QA checklist is open. Run /pre-release 1.9.0 to finish it."),
        ("a level that resolves to another version", ("1.9.0", ()), "patch",
         "src/docs/PRE-RELEASE.md is for 1.9.0, not 1.8.1. Run /pre-release 1.8.1 first.")]:
    if os.path.exists(rec_path):
        os.remove(rec_path)
    if rec:
        prerelease(d, *rec)
    r = node(d, "scripts/release.js", level)
    ck("#127 release.js refuses %s" % name, r.returncode == 1 and ("release: " + msg) in r.stderr, r.stderr)
    ck("#127 ...and writes nothing (%s)" % name,
       git(d, "diff", "--stat").stdout.strip() == "" and os.path.exists(rec_path) == bool(rec), git(d, "diff", "--stat").stdout)
prerelease(d, "1.9.0")
write(d, os.path.join("src/docs/archive", "1.9.0", "PRE-RELEASE.md"), raw="# Pre-release 1.9.0\n")
r = node(d, "scripts/release.js", "1.9.0")
ck("#127 release.js refuses a version whose record is already archived",
   r.returncode == 1 and "already exists: 1.9.0 has been cut before." in r.stderr and git(d, "diff", "--stat").stdout.strip() == "", r.stderr)
shutil.rmtree(d)
d = checkout()
write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 6}]})
prerelease(d, "1.9.0")
with open(os.path.join(d, "src/docs/PRE-RELEASE.md"), encoding="utf-8") as f:
    record_text = f.read()
r = node(d, "scripts/release.js", "1.9.0")
```

  - After `ck("...and still bumps APP_VERSION", 'APP_VERSION="1.9.0"' in v)` (:401), add:

```python
archived = os.path.join(d, "src/docs/archive", "1.9.0", "PRE-RELEASE.md")
ck("#127 ...files the pre-release record under src/docs/archive/<version>/, bytes intact",
   not os.path.exists(os.path.join(d, "src/docs/PRE-RELEASE.md")) and os.path.exists(archived)
   and open(archived, encoding="utf-8").read() == record_text, r.stderr)
ck("#127 ...and commits and tags nothing",
   git(d, "rev-list", "--count", "HEAD").stdout.strip() == "1" and git(d, "tag", "-l").stdout.strip() == "")
```

- [ ] **Step 2: Run and watch them fail.**
  - `node src/tests/pre-release.js | tail -2`: Expected
    `Error: Cannot find module '…/scripts/pre-release-record.js'`.
  - `python3 src/tests/data-kit.py | grep -E "^FAIL" | head`: Expected FAIL on the `#127` refusals (`release.js`
    cuts without a record) and on "files the pre-release record".

- [ ] **Step 3: Implement.**
  - Create `scripts/pre-release-record.js`:

```js
#!/usr/bin/env node
/*
 * The pre-release record, src/docs/PRE-RELEASE.md (#127; spec
 * 2026-10-29-pre-release-design.md §3, §5). `/pre-release X.Y.Z` writes it;
 * scripts/release.js refuses to cut X.Y.Z until it names exactly X.Y.Z with all
 * five steps done, and files it under src/docs/archive/X.Y.Z/ after the cut.
 * Offline by design: the open-P0 check against GitHub is the release skill's.
 *
 *   node scripts/pre-release-record.js [X.Y.Z] [--root DIR]
 *
 * prints "pre-release X.Y.Z: complete" and exits 0, or prints what release.js
 * would refuse with and exits 1. With no version it checks the record's own.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const RECORD = "src/docs/PRE-RELEASE.md";
const STEPS = ["Docs", "Outstanding issues", "QA checklist", "QA bugs", "Release notes"];

function archivePath(version) {
  return "src/docs/archive/" + version + "/PRE-RELEASE.md";
}

/* the record's text, or null when there is none */
function readRecord(root) {
  try { return fs.readFileSync(path.join(root, RECORD), "utf8"); } catch (e) { return null; }
}

/* {version, steps: [{n, name, state}]} from the part above the first "## " */
function parseRecord(text) {
  const top = String(text).split(/^## /m)[0];
  const head = /^# Pre-release (\S+)[ \t]*$/m.exec(top);
  const steps = [];
  for (const m of top.matchAll(/^\|\s*(\d+)\.\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/gm)) {
    steps.push({ n: +m[1], name: m[2], state: m[3] });
  }
  return { version: head ? head[1] : null, steps };
}

/* null when `text` is a complete record for exactly `version`, else why not */
function recordProblem(text, version) {
  const run = "Run /pre-release " + version;
  if (text == null) return "no pre-release record for " + version + " (" + RECORD + " does not exist). " + run + " first.";
  const rec = parseRecord(text);
  if (!rec.version) return RECORD + ' has no "# Pre-release X.Y.Z" heading. ' + run + " first.";
  if (rec.version !== version) return RECORD + " is for " + rec.version + ", not " + version + ". " + run + " first.";
  for (let i = 0; i < STEPS.length; i++) {
    const step = (i + 1) + ". " + STEPS[i];
    const row = rec.steps.find(s => s.n === i + 1);
    if (!row) return RECORD + " has no row for step " + step + ". " + run + " to finish it.";
    if (row.state !== "done") return "pre-release " + version + " is not finished: step " + step + " is open. " + run + " to finish it.";
  }
  return null;
}

/* what release.js refuses with for `version` in the tree at root, or null */
function gateProblem(root, version) {
  const p = recordProblem(readRecord(root), version);
  if (p) return p;
  if (fs.existsSync(path.join(root, archivePath(version)))) {
    return archivePath(version) + " already exists: " + version + " has been cut before.";
  }
  return null;
}

/* move the record to src/docs/archive/<version>/; returns that path */
function archiveRecord(root, version) {
  const dest = path.join(root, archivePath(version));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(path.join(root, RECORD), dest);
  return archivePath(version);
}

function main(argv) {
  const args = argv.slice(2);
  const ri = args.indexOf("--root");
  const root = ri >= 0 ? path.resolve(args[ri + 1] || ".") : path.resolve(__dirname, "..");
  const rest = args.filter((a, i) => ri < 0 || (i !== ri && i !== ri + 1));
  let version = rest[0];
  if (!version) {
    const text = readRecord(root);
    if (text == null) { console.error("pre-release: no record (" + RECORD + " does not exist). Run /pre-release X.Y.Z first."); return 1; }
    version = parseRecord(text).version || "X.Y.Z";
  }
  const p = gateProblem(root, version);
  if (p) { console.error("pre-release: " + p); return 1; }
  console.log("pre-release " + version + ": complete");
  return 0;
}

module.exports = { RECORD, STEPS, archivePath, readRecord, parseRecord, recordProblem, gateProblem, archiveRecord };
if (require.main === module) process.exit(main(process.argv));
```

  - `scripts/release.js`, the header comment: replace its last paragraph (:12–:13, "Deliberately does nothing
    else — no git commit, no tag, no push. Cutting the GitHub Release stays a human step (see CLAUDE.md
    "Publishing / updates").") with:

```js
 * An app release needs `/pre-release <version>` finished first (#127): it
 * refuses unless src/docs/PRE-RELEASE.md names exactly the new version with
 * every step done, and after the cut it files that record under
 * src/docs/archive/<version>/ (scripts/pre-release-record.js).
 *
 * Deliberately does nothing else — no git commit, no tag, no push. Cutting the
 * GitHub Release stays a human step (see CLAUDE.md "Publishing / updates").
```

  - After `if (cmp(next, cur) <= 0) die(…);` (:86), add:

```js

/* ---------------- the pre-release record (#127) ----------------
   An app release needs `/pre-release <next>` finished first: the record
   src/docs/PRE-RELEASE.md naming exactly `next`, every step done (spec
   2026-10-29-pre-release-design.md §5). Checked here, after `next` is known and
   before anything is written. Offline on purpose: the open-P0 check against
   GitHub is the release skill's, not this script's. */
const preRelease = require("./pre-release-record.js");
const gate = preRelease.gateProblem(ROOT, next);
if (gate) die(gate);
```

  - After `fs.writeFileSync(NOTEBOOK, keep + "\n## Pending\n\n_Nothing yet._\n");` (:147), add:

```js

/* ---------------- file the pre-release record (#127, spec §3) ----------------
   Last, so a refusal above leaves it where /pre-release can resume it. */
console.error(`    pre-release record filed as ${preRelease.archiveRecord(ROOT, next)}`);
```

- [ ] **Step 4: Run the suites, then everything.**
  - `node src/tests/pre-release.js | grep -E "^FAIL|ALL PASSED|FAILURES"`: Expected `ALL PASSED (51)`.
  - `python3 src/tests/data-kit.py | grep -E "^FAIL|#127|ALL PASSED|FAILURES"`: the eleven `#127` lines PASS and
    `ALL PASSED (206)`.
  - The full suite, then restore the build files. Expected: every suite passes (`srd-verbatim` and `private-data` may skip).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pre-release-record.js scripts/release.js src/tests/pre-release.js src/tests/data-kit.py
git commit -m "feat(#127): release.js refuses an app release without a complete pre-release record" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The standing QA list, `src/docs/qa/smoke.md`

**Files:**
- Create: `src/docs/qa/smoke.md`.
- Modify: `src/tests/docs.js`, a new block just above `ck.done();`.

**Interfaces:**
- Produces: the ten `## ` area headings, in tab order: `Home`, `Sheet`, `Combat`, `Spells`, `Inventory`, `Bio`,
  `Journal`, `Rules`, `Settings`, `Extensions and updates`. Each area holds `- ` lines, one thing to do and what
  you should see. Task 5's skill copies them, word for word.
- Consumes: nothing.

Note: this comes before the skill (the order suggested had it after) because Task 5's check reads these headings.
The lines are written from the wiki's feature pages (home-and-characters, abilities-and-skills, character-building,
vitals-and-rest, conditions-and-concentration, features-and-traits, class-resources, combat-view, ammunition,
spells, inventory, armor-and-ac, attacks-and-damage, story-and-notes, journal, rules-and-tables,
settings-and-updates) and have not been driven. Mike edits the file from here on; the skill never does.

- [ ] **Step 1: Write the failing check.** Add just above `ck.done();` in `src/tests/docs.js`:

```js
// ---------- the standing QA list (#127, pre-release spec §4 step 3)
// /pre-release copies each area's lines from it into the release's checklist,
// area by area, so its headings are the app's areas in tab order.
{
  const AREAS = ['Home', 'Sheet', 'Combat', 'Spells', 'Inventory', 'Bio', 'Journal', 'Rules', 'Settings', 'Extensions and updates'];
  const smoke = read('src/docs/qa/smoke.md');
  const heads = [...smoke.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
  ck('#127 qa/smoke.md has one section per app area, in tab order', JSON.stringify(heads) === JSON.stringify(AREAS), heads);
  const empty = smoke.split(/^## /m).slice(1).filter(s => !/^- \S/m.test(s)).map(s => s.split('\n')[0]);
  ck('#127 ...and every section has at least one line', empty.length === 0, empty);
}
```

- [ ] **Step 2: Run and watch it fail.** `node src/tests/docs.js | tail -3`. Expected:
  `Error: ENOENT: no such file or directory, open '…/src/docs/qa/smoke.md'`.
- [ ] **Step 3: Write `src/docs/qa/smoke.md`:**

```markdown
# Smoke list: still works

The standing "Still works" lines for each release's QA checklist. `/pre-release` copies each area's
lines, word for word, into `src/docs/QA-CHECKLIST.md` under that area, and never edits this file:
Mike does, as the app grows. One line is one thing to do and what you should see. The areas are the
app's, in tab order; keep the `## ` headings as they are, because the skill and the docs suite read
them. The first version was written from the wiki's feature pages (#127).

## Home
- Open the app with no characters: the home screen offers New character and Import.
- Make a new character, then go back Home: its card shows its name and emblem.
- Star a character as autoload and reload the page: that character opens by itself.
- Save a character to a `.json` file, delete it, then Import the file: it comes back whole.
- Import a file whose character you already have: the app offers Replace, Import as copy, or Cancel.
- Delete a character: the app asks first, then the card goes.

## Sheet
- Type each ability score: its modifier, its saving throw and the skills under it all follow.
- Tap a skill's proficiency dot: its bonus gains the proficiency bonus.
- Add an ancestry, a background and a class from the Sheet header: each choice window opens, and what it grants lands on the sheet.
- Remove that ancestry: everything it granted goes with it.
- Level up: the hit points step and any choices open; Undo level-up puts the sheet back as it was.
- Hit points: − and + change Current; a signed number typed into Current (−7, +4) applies; Temp HP takes damage first; the Max padlock stops Max from moving.
- Short Rest offers Hit Dice to spend; Long Rest restores hit points, spell slots and uses.
- Death saves: tick successes and failures; healing above 0 clears them.
- Add a condition in Statuses & Conditions: it shows with its notes, and removing it takes its effects away.
- Features & Traits: Add searches every feat and trait; a feature with uses counts down and refills on its rest.
- Resources: −, + and restore work, and a class's pool refills on the right rest.

## Combat
- The crossed swords open the combat view with the cards chosen for it; picking a word tab sends them home.
- Start combat opens Roll initiative; starting the fight puts the round at 1.
- Turns move through the initiative order, and the round counts up.
- Fire a ranged weapon: its ammunition count drops, and Undo puts the shot back.
- End combat asks first, then the End of combat window opens with its folded sections.
- Leaving the combat tab during a fight does not end it.

## Spells
- Add a spell from the browser: it appears under its level.
- Mark a spell prepared, then unprepare it.
- Cast a levelled spell: a slot of its level is spent; with that level empty, the app offers to upcast.
- Cast a concentration spell while concentrating on another: the clash is handled, and one Concentrating condition remains.
- A spell with a duration appears in Active Spells and counts down with the rounds.
- A spell with an attack roll or a save shows its line in Attacks & Weapons.

## Inventory
- Add an item through the finder: it lands in its section with its weight and cost.
- Type an item in by hand and edit it: the edits are still there after a reload.
- Equip armor: AC in the Sheet's rail changes; add a shield: AC gains its bonus.
- A weapon has a row in Attacks & Weapons with its to-hit and damage worked out.
- An item with uses: Use counts down, and the uses come back on their rest.
- Coins: a signed amount typed into a coin box applies, and the total follows.
- Open the trade window, give and get coins and an item, then Complete Trade: both sides land, and the inventory log records the trade with Undo.
- The encumbrance pill follows the weight carried.

## Bio
- Type into each bio card and reload: the text is kept.
- Add a language and a sense under Proficiencies, Senses & Languages.
- Add someone to the Party card: they appear in the initiative tracker's party.

## Journal
- Make a page with a title, a tag and text: it saves and groups under its tag.
- Search finds a page by a word in its text.
- A line starting `[ ]` is a checkbox: tick it from the page.
- Make a tracker: + and − count, and one that reaches its goal closes itself, with Undo.
- Write a section note from a card's heading: it shows in the Section Notes card.

## Rules
- Browse each rules category; search narrows the list.
- Open a glossary term, then add a glossary entry of your own.
- Open a table; a `[Table: Name]` chip in rules text opens that table in place.
- A glossary term inside a feature's text is a chip that opens its entry.

## Settings
- The cog opens Settings, and every page in its sidebar opens.
- Switch light and dark, then the skin: the whole app follows.
- Hide a tab for this character: it leaves the tab bar, and comes back when shown again.
- Back up: export the settings file, then import it; the status line says what the import did.
- Credits name the icon artists and every loaded pack's credit.

## Extensions and updates
- Settings → Extensions lists the loaded packs and the official source.
- Check now with a network: the official source answers, or says it can't be reached, and nothing breaks.
- Manual install of a pack file (`dist/srd52_full.json`): the pack loads and its rules appear.
- With no network at all: the app opens and works, and no update check shows an error.
- The version button opens the changelog, newest release first.
```

- [ ] **Step 4: Run it, then everything.** `node src/tests/docs.js | grep -E "#127|ALL PASSED|FAILURES"`: both smoke
  checks PASS. Then the full suite, and restore the build files.
- [ ] **Step 5: Commit.**

```bash
git add src/docs/qa/smoke.md src/tests/docs.js
git commit -m "docs(#127): the standing QA smoke list, by app area" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The `pre-release` skill, and `/release`'s preflight

**Files:**
- Create: `.claude/skills/pre-release/SKILL.md`.
- Modify: `.claude/skills/release/SKILL.md`:
  - §1's app row (:28);
  - §2's preflight block (:36–:42) and a new bullet after it;
  - §3, Gate 1 (:52–:56);
  - §4, Cut (:60);
  - Red flags (:96–:104).
- Modify: `src/tests/docs.js`, a new block just above `ck.done();`.

**Interfaces:**
- Consumes:
  - from Task 1: the CLI `node scripts/move-docs.js <moves.json> [--dry-run]`;
  - from Task 3: `STEPS`, the CLI `node scripts/pre-release-record.js [X.Y.Z]`, and the archive path
    `src/docs/archive/X.Y.Z/PRE-RELEASE.md`;
  - from Task 4: `src/docs/qa/smoke.md`'s headings.
- Produces: `/pre-release <X.Y.Z>`, which creates and keeps `src/docs/PRE-RELEASE.md`, writes
  `src/docs/QA-CHECKLIST.md`, and runs the GitHub writes.

Note:
- **GitHub, checked read-only while this plan was written.** Project #3 (owner `wardmanm`) has the single-select
  fields Status (Backlog, Ready, In progress, In review, Done) and Priority (P0, P1, P2).
  `gh project item-list --format json` gives each item `.priority` and `.milestone.title`. The milestones are titled
  `v1.9.0`, `v2.0.0`; the fix-version labels `1.7.1`…`1.9.1` (colour `aaaaaa`); the type labels `bug` and `task`. The
  token has the `project` scope. No write was tried; the skill looks the ids up by name every time.
- **Two things the spec leaves open, decided here.** A `✗ Claude` line counts as dismissed when Mike ticks it
  `- [x]`. Step 5 also flags markdown, since `openChangelog()` prints notes as plain text.
- **Step 1 rebuilds `dist/fieldbook.html`.** It rewrites code comments in `src/js/`, so the artifact goes stale. The
  skill rebuilds it with `--no-zip` and commits it with step 1, because main carries the artifact and its CI fails on
  a stale one. The spec doesn't say this.

- [ ] **Step 1: Write the failing checks.** Add just above `ck.done();` in `src/tests/docs.js`:

```js
// ---------- the pre-release and release skills agree with the gate (#127, spec §5)
// release.js reads the record's step rows; the skill writes them. And /release's
// preflight must run the same check before Mike is asked for a number.
{
  const pre = read('.claude/skills/pre-release/SKILL.md');
  const rel = read('.claude/skills/release/SKILL.md');
  const {STEPS} = require('../../scripts/pre-release-record.js');
  ck('#127 /pre-release is Mike\'s to start', /^---\nname: pre-release\n/.test(pre) &&
     /^disable-model-invocation: true$/m.test(pre) && /^argument-hint: /m.test(pre));
  const rows = STEPS.map((s, i) => '| ' + (i + 1) + '. ' + s + ' | open | | |');
  ck('#127 its record template has the five step rows release.js reads', rows.every(r => pre.includes(r)), rows.filter(r => !pre.includes(r)));
  const areas = [...read('src/docs/qa/smoke.md').matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
  ck('#127 its checklist names the smoke list\'s areas, in order', pre.includes(areas.join(', ')), areas.join(', '));
  ck('#127 /release\'s preflight runs the record check and the open-P0 check',
     rel.includes('node scripts/pre-release-record.js') && rel.includes('.priority=="P0"'));
}
```

- [ ] **Step 2: Run and watch them fail.** `node src/tests/docs.js | tail -3`. Expected:
  `Error: ENOENT … .claude/skills/pre-release/SKILL.md`.
- [ ] **Step 3: Write `.claude/skills/pre-release/SKILL.md`:**

````markdown
---
name: pre-release
description: Use when Mike types /pre-release <version> to get an app release ready before it is cut — specs and plans filed by version, out-of-date docs archived or corrected, loose ends filed as issues, a QA checklist pre-driven in the browser, its bugs filed, and release notes a player can read. /release and ./build.sh --release refuse an app release until this is complete for that exact version.
argument-hint: <version X.Y.Z>
disable-model-invocation: true
---

# Pre-release

Arguments: `$ARGUMENTS` — the version being prepared, `X.Y.Z`. It is required: ask for it if missing.

The design, which binds this procedure: `src/docs/specs/2026-10-29-pre-release-design.md`. The
record this skill keeps is what `scripts/release.js` checks: `./build.sh --release X.Y.Z` refuses
until `src/docs/PRE-RELEASE.md` names exactly `X.Y.Z` with all five steps `done`. Run
`node scripts/pre-release-record.js X.Y.Z` to see what it would say.

## Who decides what

Mike typing `/pre-release` is his instruction to prepare the release. **He decides; you propose and
then carry out what he confirmed.** He confirms:

- the move list, and archive, correct or keep for each out-of-date doc (step 1);
- file, skip or merge with #N for each loose end, and its priority (step 2);
- the title and priority of each bug (step 4);
- each release-note rewrite, and the final yes (step 5).

Nothing is written to GitHub (issues, labels, project fields, comments) before his confirmation.
You commit each step on main. **You never push, and you never cut the release:** that is `/release`.
"Skip the checks" never skips a step: say so in one line and keep going.

## 0. Preflight, every run

```bash
git switch main && git fetch -q && git status -sb     # on main, not behind origin
git status --porcelain                                # must print nothing
git worktree list; git branch --no-merged main        # an open issue branch: say so and ask
grep -o 'APP_VERSION="[^"]*"' src/js/30-version.js    # the current version
```

- Refuse on another branch or with a dirty tree, the way `/release` does. With an open worktree
  branch, name it and ask whether its work belongs in this release before going on.
- `X.Y.Z` must be three numbers and higher than `APP_VERSION`. If not, stop and say so.
- **The record.** No `src/docs/PRE-RELEASE.md`: create it (below), with today's date and the current
  `APP_VERSION`, and start at step 1. A record for `X.Y.Z`: resume at its first `open` step. A record
  for another version: stop and ask, **replace** (start over for `X.Y.Z`) or **keep** (stop here).
- **On a resume after step 3 is done**, compare main with the commit the checklist names:
  `git log --format='%h %s' <that commit>..HEAD` minus the `docs: pre-release X.Y.Z — step N`
  commits. Anything left means more work merged since the checklist was built: say so, and offer to
  rebuild step 3, which reopens steps 3 and 4.

## The record

Created by the first run, rewritten as each step finishes, committed with each step:

```markdown
# Pre-release X.Y.Z
Started: YYYY-MM-DD · App was A.B.C

| Step | State | Done | Summary |
|---|---|---|---|
| 1. Docs | open | | |
| 2. Outstanding issues | open | | |
| 3. QA checklist | open | | |
| 4. QA bugs | open | | |
| 5. Release notes | open | | |

## Step 2: outstanding issues
| Item | Source | Title | Priority | Decision | Issue |
|---|---|---|---|---|---|

## Step 4: bugs from QA
| Line | Title | Priority | Issue | State |
|---|---|---|---|---|
```

- **State** is `open` or `done`, nothing else. A step becomes `done` only when its own "Done when"
  holds; **Done** is the date it did. Steps run in order: never mark a step done while an earlier one
  is open.
- **Summary** is one line with counts, e.g. "21 specs and 20 plans filed; 3 archived; 112 links
  rewritten". No `|` in a cell, and no relative links anywhere in the record: `release.js` moves it
  to `src/docs/archive/X.Y.Z/` at the cut.
- An issue whose Priority could not be set (scope, network) is written "#N (priority not set)", and
  its step is not done until it is set.

**Each step's commit.** Update the record, then:

```bash
git add -A
git commit -m "docs: pre-release X.Y.Z — step N" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The tree was clean at preflight, so `git add -A` takes only this step's work. Never push.

## Step 1 — Documentation

1. **File specs and plans by version.** For every `src/docs/specs/*.md` and `src/docs/plans/*.md`
   at the top level (never one already in a version folder):
   - its issue: the spec's `**Issue:**` line, or the plan's `wt.sh add <n>` line, else the first
     `#<n>` in the file;
   - the merge that shipped it: the oldest of
     `git log main --merges --format='%H %s' | grep -E "issue/<n>-"`, else the file's last commit,
     `git log -1 --format=%H -- <file>`;
   - its version: `git tag --contains <sha> --sort=v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1`
     without the `v`; no tag but merged into main (`git merge-base --is-ancestor <sha> main`) means
     `X.Y.Z`; not merged means it stays where it is.

   The destination is `src/docs/specs/<ver>/<same name>` or `src/docs/plans/<ver>/<same name>`. A
   spec split across releases files by its first merge. A plan with no matching spec, or a doc with
   no merge found, is listed for Mike to place by hand. The first run backfills every existing
   document; on later runs only this release's are left at the top level. Show the whole list, each
   line with its evidence (merge, tag), and wait for Mike to confirm or change it.
2. **Find out-of-date docs** and list each candidate with why:
   - wiki lines naming a function that no longer exists, or contradicting the code:
     `./src/tests/run.sh docs`, plus a grep for each `name()` the wiki cites;
   - `src/docs/wiki/roadmap/known-issues.md` entries whose issue is closed
     (`gh issue view <n> --json state -q .state`) or whose fix has merged;
   - the released version's roadmap page, `src/docs/wiki/roadmap/X.Y.Z.md`, which becomes a record;
   - one-time sections that are done (e.g. RELEASING §4a);
   - specs superseded by a later spec.

   Mike marks each **archive**, **correct** or **keep**:
   - **archive** a whole doc: add it to the move list, to `src/docs/archive/X.Y.Z/<name>.md`
     (prefix the folder when names would collide: a wiki roadmap page becomes `roadmap-X.Y.Z.md`). An
     archived wiki page leaves the index's topic list; its index line moves under "Elsewhere",
     pointing at the archive.
   - **archive** a section: cut it into `src/docs/archive/X.Y.Z/<doc>-<section>.md`, headed with one
     line naming where it came from, and leave a one-line pointer in its place.
   - **correct**: show the diff first, then apply it.
   - Nothing is deleted.
3. **Rewrite links.** Write the confirmed moves to the scratchpad as JSON,
   `[{"from": "src/docs/…", "to": "src/docs/…"}, …]`, then:

   ```bash
   node scripts/move-docs.js <moves.json> --dry-run    # the plan: every move, every file it edits
   node scripts/move-docs.js <moves.json>              # moves the files, rewrites every reference
   ```

   It searches CLAUDE.md, `.claude/skills/`, `.github/workflows/`, `data/packs.json`, `scripts/`,
   `src/` (the wiki, specs, plans, archive, `src/docs/*.md`, the ledger, code comments) and
   `tools/data-kit/`; relative links are recomputed from each file's own folder, fenced blocks
   included, and no file gains or loses a line, so every ledger `L<n>` citation stays valid. A bad
   move list writes nothing.
4. **If any `src/js/` file changed**, run `./build.sh --no-zip` and commit `dist/fieldbook.html`
   with this step: main carries the built artifact, and its CI fails on a stale one.
5. Run the full suite, `PATH="$PWD/.venv/bin:$PATH" ./src/tests/run.sh`. The docs suite's link
   check fails on any path to a spec, plan or archived doc that a move missed. Then commit.

**Done when** the confirmed moves and archive/correct decisions are applied, every link resolves,
and the suite is green.

## Step 2 — Outstanding issues

1. **Gather** non-blocking loose ends from: the `## As built` of this release's specs (now in
   `src/docs/specs/X.Y.Z/`: deferred minors, "Open for Mike"); `known-issues.md` entries with no
   issue number; and `.claude/status.md`'s Loose ends and Pending decisions.
2. **De-duplicate** against open issues:
   `gh issue list --state open -L 500 --json number,title,labels,milestone`. A match by title or key
   words is shown as "already #N".
3. **Table** them in the record's "Step 2" table: item, source (file and section), proposed title,
   proposed priority. Mike marks each row **file**, **skip** or **merge with #N**, and confirms or
   changes its priority. Nothing is created until every row is marked.
4. **File** the "file" rows. The milestone is `vX.Y.Z`; the label is the **next fix version**, the
   patch plus one (`1.9.0` → `1.9.1`, `1.9.1` → `1.9.2`); type is the label `bug` or `task`. See
   "Filing an issue" below. "Merge with #N" is `gh issue comment <N> --body "<the item>, from <source>
   (pre-release X.Y.Z)"`.
5. **Write each number back**: into the table's Issue column, and into its source line (a
   known-issues entry gains "(#131)"; so does an As built line or a status loose end).

**Done when** every row is marked and every "file" row has an issue with its priority set.

### Priorities

- **P2**: a minor bug, a visual problem, a tweak.
- **P1**: a medium bug; functionality is affected, a workaround exists, no data is at risk.
- **P0**: a blocker. Only a P0 blocks the release (step 4). A loose end is never P0: if Mike says one
  is, it is a step 4 bug.

### Filing an issue

```bash
NEXT=<the next fix version>
gh label list --search "$NEXT" --json name -q '.[].name' | grep -qx "$NEXT" \
  || gh label create "$NEXT" --color aaaaaa
URL=$(gh issue create --title "<title>" --body-file <body.md> --milestone "vX.Y.Z" \
        --label <bug|task> --label "$NEXT")
```

The body cites its source (file and section, or the checklist line) and says it came from the
X.Y.Z pre-release. A **P0** has no `--label "$NEXT"`: it stays in the milestone.

Then add it to project #3, "RPGFieldbook", with Status **Backlog** and the confirmed Priority. Look
the ids up by name every time; never hard-code them:

```bash
PROJ=$(gh project view 3 --owner wardmanm --format json --jq .id)
F() { gh project field-list 3 --owner wardmanm --format json --jq "$1"; }
STATUS=$(F '.fields[]|select(.name=="Status")|.id')
BACKLOG=$(F '.fields[]|select(.name=="Status")|.options[]|select(.name=="Backlog")|.id')
PRIO=$(F '.fields[]|select(.name=="Priority")|.id')
PICK=$(F '.fields[]|select(.name=="Priority")|.options[]|select(.name=="P1")|.id')   # P0, P1 or P2
ITEM=$(gh project item-add 3 --owner wardmanm --url "$URL" --format json --jq .id)
gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$STATUS" --single-select-option-id "$BACKLOG"
gh project item-edit --id "$ITEM" --project-id "$PROJ" --field-id "$PRIO" --single-select-option-id "$PICK"
```

If a project write fails (a missing `project` scope: `gh auth refresh -s project`; or the network),
the issue is still filed: record it as "#N (priority not set)" and come back to it.

## Step 3 — The QA checklist

1. **Build** the release candidate: `./build.sh --no-zip`. Restore it after, as always:
   `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.
2. **Write `src/docs/QA-CHECKLIST.md` from scratch**, every run:
   - Top: `# QA checklist X.Y.Z`, then "Generated against `<short sha>` (<subject>) on YYYY-MM-DD",
     the sha being `git rev-parse --short HEAD` now, then Mike's marks: `- [x]` when a line passes,
     `FAIL: <what happened>` appended to a line that fails.
   - One `## ` section per app area, in tab order: Home, Sheet, Combat, Spells, Inventory, Bio, Journal, Rules, Settings, Extensions and updates.
     Each has **New in this release** (lines written from this version's `UNRELEASED.md` bullets,
     the milestone's closed issues, `gh issue list --milestone vX.Y.Z --state closed -L 500 --json number,title`,
     and the testing section of each spec in `src/docs/specs/X.Y.Z/`, each line ending with its
     source, e.g. "(#105)"), then **Still works**: that area's lines from `src/docs/qa/smoke.md`,
     word for word. Never edit `smoke.md`: Mike owns it.
   - Last, `## Device pass`: touch, print, Safari and Firefox, real phones, his own characters, and
     every specific device item in `.claude/status.md`'s Loose ends.
   - Every line is a checkbox, `- [ ] <what to do>: <what you should see>`.
3. **Pre-drive** every line you can, in the project's Playwright MCP (`mcp__playwright__*`, never a
   plugin's: it refuses `file://`), at 1280 and 390 wide (`browser_resize`), in both skins: a
   `newCharacter("QA", "dnd")` sheet is classic, a `newCharacter("QA", "humblewood")` sheet is
   humblewood. Open `file://<repo>/dist/fieldbook.html`. A line that needs rules data: install
   `dist/srd52_full.json` through Settings → Extensions → Manual install (`browser_file_upload`).
   - a pass: `- [x] <line> ✓ Claude, Chrome 1280/390`;
   - a failure: `- [ ] <line> ✗ Claude: <what happened>`, listed back to Mike as a probable bug, with
     a screenshot in `.claude/qa/pre-release-X.Y.Z/`;
   - a line you can't drive (touch, print, another browser, a real phone, his characters):
     `- [ ] <line> (not driven: <why>)`.
4. Commit, and tell Mike the checklist is ready for his pass: how many lines, how many you drove,
   the probable bugs.

**Done when** the checklist is written and the pre-drive has run over every line.

## Step 4 — Bugs from QA

1. Mike tests from the checklist (his device pass, and every line not driven) and marks it.
2. Read every line with `FAIL:` and every `✗ Claude` line he has not dismissed (ticking it `- [x]`
   dismisses it). For each, propose a title and a priority, and wait for his confirmation.
3. **P2 and P1** are filed as in step 2 (milestone, next fix version label, project, Backlog,
   Priority). **P0** is filed in the milestone with Priority P0 and no fix version label. Each goes in
   the record's "Step 4" table with its checklist line and its state.
4. **An open P0 holds this step open.** Mike fixes it through the normal worktree flow. Each rerun
   re-checks: an issue number in both lists is an open P0.

   ```bash
   gh issue list --milestone "vX.Y.Z" --state open -L 500 --json number --jq '.[].number'
   gh project item-list 3 --owner wardmanm --format json -L 2000 \
     --jq '.items[]|select(.content.type=="Issue" and .milestone.title=="vX.Y.Z" and .priority=="P0")|.content.number'
   ```
5. Commit.

**Done when** Mike says the checklist is finished, every failure has an issue with its priority
set, and no P0 in the milestone is open.

## Step 5 — Release notes

1. Read every bullet under `## Pending` in `src/docs/UNRELEASED.md` as a player would, and flag:
   internal words (function, file or field names, "migrate", issue numbers, "As built", "ledger");
   markdown the app shows as typed (backticks, `**`: `openChangelog()` prints notes as plain text);
   vague or over-long bullets; and two bullets about one change.
2. Show each flagged bullet with a suggested rewrite. Mike accepts, edits or keeps each; write the
   accepted ones into `UNRELEASED.md`. No angle brackets and no version numbers (the docs suite
   refuses both).
3. Show the whole set the way the app's "What's new" will show it: under `vX.Y.Z` and today's date,
   one item per bullet, a wrapped bullet joined into one line. Ask for a final yes.
4. Commit.

**Done when** Mike gives the final yes. Then say: "Pre-release X.Y.Z is complete. `/release` can
cut it." Stop there.

## Red flags — stop

| Thought | Reality |
|---|---|
| "The move list is obvious, I'll just run it" | Mike confirms the list first; the dry run shows it |
| "This loose end is clearly P1, I'll file it" | Nothing reaches GitHub before he marks the row |
| "I'll fix the ledger link by hand" | `move-docs.js` rewrites it in place; a hand edit can shift a line and break every `L<n>` below |
| "A P1 bug is bad, I'll hold the release" | Only an open P0 blocks |
| "I couldn't drive that line, I'll tick it" | It stays `- [ ]` with `(not driven: <why>)` |
| "Main moved, but the checklist is close enough" | Offer to rebuild step 3; it reopens 3 and 4 |
| "Every step is done, I'll run /release" | Stop. `/release` is Mike's to type |
| "I'll push the step commits" | Never: they go up with the release |
````

- [ ] **Step 4: Change `.claude/skills/release/SKILL.md`.** Five edits:
  1. §1, the app row:

```markdown
| bullets under `## Pending` in `src/docs/UNRELEASED.md` | **app** (`./build.sh --release`), which carries changed public data too; it needs `/pre-release X.Y.Z` complete first |
```

  2. §2: add a last line to the preflight block, after `git -C _private-data status -sb …`:

```bash
node scripts/pre-release-record.js                            # app only: the /pre-release record is complete
```

  and add this bullet first in the list under the block:

````markdown
- **The pre-release record (app releases only, #127).** `node scripts/pre-release-record.js`
  checks `src/docs/PRE-RELEASE.md`, the record `/pre-release` keeps; the version it names is the
  one you propose at Gate 1. Then check that no issue in that milestone with Priority P0 is open:
  a number printed by both of these is an open P0.

  ```bash
  gh issue list --milestone "vX.Y.Z" --state open -L 500 --json number --jq '.[].number'
  gh project item-list 3 --owner wardmanm --format json -L 2000 \
    --jq '.items[]|select(.content.type=="Issue" and .milestone.title=="vX.Y.Z" and .priority=="P0")|.content.number'
  ```

  An incomplete record, a missing one, or an open P0: stop, say which, and send Mike to
  `/pre-release X.Y.Z`. Do not propose a version. Data and private releases skip both checks.
````

  3. §3, replace "Propose it: patch / minor / major from `APP_VERSION` in `src/js/30-version.js`, or the data
     script's `X.Y.Z-N`." with:

```markdown
Propose it: for an app release, the version the pre-release record names; for data, the data
script's `X.Y.Z-N`.
```

  and replace its last sentence, `"Minor" once meant 1.7.1, so always ask: "Cut **vX.Y.Z**?" — then wait.`, with:

```markdown
"Minor" once meant 1.7.1, so always ask: "Cut **vX.Y.Z**?" — then wait. If Mike answers with an
app version the record doesn't name, stop: that number needs its own `/pre-release` (`release.js`
would refuse it anyway).
```

  4. §4, after the **app:** line, add:

```markdown
  `release.js` refuses without a complete record for exactly `X.Y.Z`, and after the cut files it
  under `src/docs/archive/X.Y.Z/`; `git add -A` takes that move.
```

  5. Red flags: add two rows after `| "Pushed, done" | … |`:

```markdown
| "The pre-release is nearly done, cut anyway" | `release.js` refuses; send Mike to `/pre-release` |
| "A P1 is open in the milestone, stop" | Only an open P0 blocks; P1s carry the next fix version's label |
```

- [ ] **Step 5: Run it, then everything.** `node src/tests/docs.js | grep -E "#127|ALL PASSED|FAILURES"`: the four
  skill checks PASS, and the link check still passes over both skills. Then the full suite, and restore the build
  files.
- [ ] **Step 6: Commit.**

```bash
git add .claude/skills/pre-release/SKILL.md .claude/skills/release/SKILL.md src/tests/docs.js
git commit -m "feat(#127): the /pre-release skill, and /release's preflight checks its record" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs (spec §11)

**Files:**
- Modify: `src/docs/RELEASING.md`:
  - a new §0 before §1 (:15);
  - §1's steps (:30–:33) and its manual path (:83–:91);
  - "What `--release` does for you" (:93–:122).
- Modify: `CLAUDE.md`:
  - the `docs/` line of the tree (:52);
  - the release rule (:85–:89);
  - the status log's exception sentence (:189).
- Modify: `dev.sh`, the release checklist (:424–:425).
- Modify the wiki:
  - `src/docs/wiki/process/building-and-ci.md`;
  - `src/docs/wiki/process/testing.md`;
  - `src/docs/wiki/overview.md`;
  - `src/docs/wiki/decisions.md`;
  - `src/docs/wiki/index.md`.
- Modify: `src/docs/specs/2026-10-29-pre-release-design.md`, append `## As built`.
- Ledger: append `## Pre-release (#127, <the date you write it, YYYY-MM-DD>)` at the very end of
  `src/docs/_claude/WIRING-LEDGER.md`.
- No `UNRELEASED.md` bullet: a player sees nothing (spec §11).

**Interfaces:**
- Consumes: every name above. The wiki's `name()` check needs each cited function to exist:
  `findRefs()`, `rewriteText()`, `planMoves()`, `scanFiles()`, `recordProblem()`, `gateProblem()`,
  `archiveRecord()`.
- Produces: nothing code uses.

Note: two edits the spec's §8 doesn't list. `dev.sh`'s checklist would otherwise send Mike straight to "Cut a
release", which `release.js` now refuses. And CLAUDE.md's "the one exception to working on a branch" would be wrong
once `/pre-release` commits on main (spec §7).

- [ ] **Step 1: RELEASING.**
  - Insert before `## 1. The happy path — \`./dev.sh\``, after the `---` (:15):

```markdown
## 0. Before you cut: `/pre-release`

An app release starts with **`/pre-release X.Y.Z`** in Claude Code (#127; the `pre-release` skill,
`.claude/skills/pre-release/`). It works through five steps, each confirmed by Mike and committed
on main as `docs: pre-release X.Y.Z — step N`, never pushed, and records them in
`src/docs/PRE-RELEASE.md`:

1. **Docs.** Shipped specs and plans move into `specs/<ver>/` and `plans/<ver>/`; out-of-date docs
   are archived to `archive/<ver>/` or corrected in place; `scripts/move-docs.js` rewrites every
   link, the ledger line for line.
2. **Outstanding issues.** Loose ends from the release's specs, known issues and the status log are
   filed (milestone `vX.Y.Z`, the next fix version's label, project #3 with Status Backlog and a
   Priority), merged into an existing issue, or skipped.
3. **QA checklist.** `src/docs/QA-CHECKLIST.md`, rebuilt from this release's notes, issues and
   specs plus the standing list `src/docs/qa/smoke.md`, and pre-driven by Claude in the browser.
4. **QA bugs.** Mike's pass; every failure filed. An open P0 in the milestone holds this step open.
5. **Release notes.** The pending bullets, read as a player would, rewritten where Mike agrees.

**The gate.** `./build.sh --release` (in `scripts/release.js`) refuses unless the record names
exactly the version being cut and all five steps are `done`; the message names the first open step.
It works offline, so it does not ask GitHub about P0s: `/release`'s preflight does.
`node scripts/pre-release-record.js X.Y.Z` prints what the gate would say. After the cut,
`release.js` moves the record to `src/docs/archive/X.Y.Z/PRE-RELEASE.md`, and the release commit's
`git add -A` takes the move. Data and private data releases are not gated.

---

```

  - §1, "The steps": before **1. Write the notes as you work.**, add
    `**0. \`/pre-release X.Y.Z\`** (§0). \`--release\` refuses until it is complete.`
  - "Doing it without the menu": add `node scripts/pre-release-record.js 1.3.1   # §0: the record is complete`
    as the block's first line.
  - "What `--release` does for you": add these two bullets first in the list:

```markdown
- refuses unless the pre-release record is complete for exactly the new version (§0), before it
  writes anything,
```

    and, after the `- empties the notebook,` bullet:

```markdown
- moves the record to `src/docs/archive/<version>/PRE-RELEASE.md`,
```

  - Its "It refuses to release with an empty notebook, …" paragraph: after "with an empty notebook," add
    "without a complete pre-release record for that version,".
- [ ] **Step 2: CLAUDE.md.**
  - The tree's `docs/` line (:52) becomes two lines:

```
  docs/                  dev docs (never ship): wiki/, specs/ and plans/ (filed into specs/<ver>/
                         and plans/<ver>/ once shipped), archive/<ver>/, qa/, UNRELEASED.md, …
```

  - The release rule (:85–:89): after "Procedure: [RELEASING](src/docs/RELEASING.md).", add:

```markdown
  **An app release needs `/pre-release <ver>` first** (`.claude/skills/pre-release/`, Mike types
  it): docs filed by version, loose ends and QA bugs filed as issues, release notes checked, each
  step recorded in `src/docs/PRE-RELEASE.md`. `./build.sh --release` refuses until that record is
  complete for exactly that version.
```

  - The status log's sentence (:189), "It's the one exception to working on a branch (Mike, 2026-10-19).",
    becomes "It's the one exception to working on a branch (Mike, 2026-10-19), besides release preparation:
    `/pre-release` commits its steps on main, and `/release` its release commit."
- [ ] **Step 3: `dev.sh`.** In `checklist()`, before `    1. Every player-visible change has a bullet in src/docs/UNRELEASED.md`
  (:425), add `    0. /pre-release X.Y.Z in Claude Code — every step done (release.js refuses otherwise)`. Then
  run `bash -n dev.sh`.
- [ ] **Step 4: The wiki.** Each page is rewritten to the new truth, in the present tense, with a History line
  `- <date> — <what changed>. → ledger L<line of the new heading>, #127`. Find the heading's line after Step 5 with
  `grep -n '^## Pre-release (#127' src/docs/_claude/WIRING-LEDGER.md`, and do Step 5 first if you prefer.
  - `process/building-and-ci.md`:
    - **Code:** (:11–:16) add `scripts/move-docs.js` (`findRefs()`, `rewriteText()`, `planMoves()`, `scanFiles()`)
      and `scripts/pre-release-record.js` (`recordProblem()`, `gateProblem()`, `archiveRecord()`).
    - **Tests:** (:17–:21) add `pre-release.js` (`move-docs.js` on a scratch tree, the record) and the `data-kit.py`
      gate cases; `docs.js` gains the spec/plan/archive link check, the smoke list's areas, and the skills against
      the gate.
    - "`./build.sh`, in order", step 1 (:30): `release.js` refuses an app release without a complete pre-release
      record for exactly the new version (`gateProblem()`), before writing anything, and files it with
      `archiveRecord()` after the cut.
    - The section "`/release` and `/status`" (:242) becomes "`/pre-release`, `/release` and `/status`", opening
      with a paragraph on `/pre-release`. Cover its five steps, the record, the commits on main, never pushing, the
      GitHub writes only after Mike confirms, and `/release`'s preflight running
      `node scripts/pre-release-record.js` plus the open-P0 query.
    - Rules that must hold (:257): add **No app release without a complete pre-release record.** `release.js`
      checks it offline; `/release`'s preflight adds the open-P0 check; data releases are not gated.
    - Decisions (:319): add the spec's seven §2 rows, as written there, each citing the new ledger line.
  - `process/testing.md`:
    - "runs ten suites" (:3) → "eleven suites"; **Tests:** (:13) adds `pre-release.js`.
    - The suites table: a `pre-release.js` row after `data-archive.js`:
      `move-docs.js` on a scratch tree (each reference kind, fenced blocks, moved files' own links, the ledger's line
      count, `--dry-run`, refusals) and `pre-release-record.js` (parsing, each refusal, the CLI, the archive move).
    - The `data-kit.py` row: `release.js` also refuses without a complete pre-release record, writes nothing when
      it does, and files the record after the cut (#127).
    - "The docs suite" list (:96–:127) gains three bullets:
      - every path to a spec, plan or archived doc resolves, with the illustration and fenced-quote rules;
      - `qa/smoke.md`'s areas;
      - the two skills against the gate.
  - `overview.md`, the repo layout:
    - Under `docs/`, replace the `specs/  plans/` line (:68) with:

```
    specs/  plans/          one design spec per feature, and the plans that execute them;
                            filed into specs/<ver>/ and plans/<ver>/ once shipped (/pre-release)
    archive/<ver>/          finished docs, and each release's pre-release record
    qa/smoke.md             the standing "Still works" list each QA checklist copies
    PRE-RELEASE.md          while a release is being prepared: /pre-release's record
    QA-CHECKLIST.md         that release's QA checklist, rebuilt by each run
```

    - Under `scripts/`, after `release.js` (:100):

```
  pre-release-record.js   the /pre-release record: the gate release.js checks, and its CLI (dev)
  move-docs.js            moves dev docs and rewrites every reference to them (dev)
```

    - The `.claude/skills/wiki/` line (:112) becomes
      `.claude/skills/           the project skills: wiki, status, release, pre-release (tracked; never ship)`.
  - `decisions.md`, under `### [Building & CI](process/building-and-ci.md)` (before `### [Testing]`, :685): one
    line per §2 decision, e.g. `- **How hard the pre-release block is (#127)** — A committed record,
    \`src/docs/PRE-RELEASE.md\`, checked by \`/release\` and \`./build.sh --release\``.
  - `index.md`, "Elsewhere" (:78): add
    `- [Smoke list](../qa/smoke.md) — the standing "Still works" lines each release's QA checklist copies`.
- [ ] **Step 5: The ledger.** Append at the very end, changing no other line:
  - What changed, task by task: `move-docs.js` (the three reference kinds, `SCAN` and why it is wider than
    §4.3, the line-count guard, the trial backfill's numbers); the link check (its scope and the two
    refinements); `pre-release-record.js` and the gate (the resolved version, the archive refusal, the words);
    `smoke.md`; the two skills.
  - The rulings from this plan's Notes:
    - `✗ Claude` dismissed by a tick;
    - step 5 flags markdown;
    - step 1 rebuilds and commits the artifact;
    - the order of Tasks 4 and 5;
    - the extra file `pre-release-record.js` and the new suite;
    - `dev.sh`'s checklist and CLAUDE.md's exception sentence.
  - Tests added (`pre-release.js`, the `data-kit.py` cases, the `docs.js` blocks), and the existing
    `data-kit.py` release.js case that now writes a record.
  - `Pages:` with links to each wiki page changed (`../wiki/…`).
- [ ] **Step 6: The spec's As built.** Append `## As built` to `src/docs/specs/2026-10-29-pre-release-design.md`:
  where the code lives (`scripts/move-docs.js`, `scripts/pre-release-record.js`, the gate in `release.js`, the
  skill, `src/docs/qa/smoke.md`), then every Note above as a deviation with its reason, and "Not yet run: the
  first `/pre-release 1.9.0` is the backfill and the skill's first exercise (§8, §10)".
- [ ] **Step 7: Run the full suite,** then restore the build files. Expected: every suite passes (`srd-verbatim` and `private-data` may skip). `docs.js`
  checks every `name()` a page cites, every `L<n>` a heading, every wiki link, and every link to a spec, plan or
  archived doc, this plan's included.
- [ ] **Step 8: Commit.**

```bash
git add src/docs/RELEASING.md CLAUDE.md dev.sh src/docs/wiki src/docs/specs/2026-10-29-pre-release-design.md src/docs/_claude/WIRING-LEDGER.md
git commit -m "docs(#127): pre-release — RELEASING, CLAUDE.md, the wiki, the ledger, as built" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

  Then say the branch is ready for review and merge, and stop. No release, and no `/pre-release` run: the first
  one is Mike's, on main, after the merge.

---

## Self-review

- **Spec coverage.**
  - §1 → Tasks 3 and 5.
  - §2's seven decisions → Task 5's skill (filing, P0 only, the checklist), Task 3 (the committed record), Task 1
    (links rewritten everywhere, the ledger in place) and Task 6 (the decision rows).
  - §3, the record → Task 3 (parser, archive move) and Task 5 (the template).
  - §4's five steps → Task 5; the step 1.3 script → Task 1.
  - §5, the gate → Task 3 (offline) and Task 5 (`/release`'s preflight with the P0 query).
  - §6 → Task 2.
  - §7 → Task 5: main only, a commit per step, never a push, GitHub writes after confirmation.
  - §8's files → Tasks 1–6, plus the two noted additions.
  - §9's edge cases → Tasks 1 (fenced paths) and 5 (split features, unplaced docs, an untagged merge, a failed
    project write, a rerun after main moved, no record).
  - §10 → Tasks 1–3. §11 → Task 6. §12 → nothing added: no CI check, no data gate, no checklist history.
- **Placeholders.** None, except the dates and the ledger's `L<n>`, which only exist once written. Task 6 says how to
  find each.
- **Names across tasks.**
  - `findRefs`/`scanFiles` (Tasks 1, 2).
  - `STEPS`, `gateProblem`, `archiveRecord`, `archivePath` (Tasks 3, 5).
  - The record rows `| N. Name | open | | |` (Tasks 3, 5).
  - The smoke headings (Tasks 4, 5).
  - The CLI `node scripts/pre-release-record.js` (Tasks 3, 5, 6).
- **Verified while writing.**
  - Every code block in Tasks 1–5 was run on a `git archive` copy of main with the edits applied: all 11 suites
    passed (5813 checks).
  - Task 2's check ran clean over the real repo and over the trial backfill.
  - The `gh --jq` queries in Task 5 ran read-only against project #3.
