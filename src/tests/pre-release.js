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
/* a binary fixture that is NOT moved: must survive untouched (extension excludes it
   from scanFiles; #127 fix round 1, finding 2's second test) */
const IMG_UNMOVED = crypto.randomBytes(777);
/* a binary fixture that IS moved: must come out byte for byte (finding 2's first test) */
const IMG_MOVED = crypto.randomBytes(4096);
const FILES = {
  'src/docs/specs/example-alpha-design.md': [
    '# Alpha: design', '', 'Read [the page](../wiki/example-page.md) and [Beta](example-beta-design.md) first.',
    'Plan: [plan](../plans/example-alpha.md).',
    'See [plans/](../plans/), [x](../../js/10-example.js#sec) and ![img](../img/example-a.png).', ''].join('\n'),
  'src/docs/specs/example-beta-design.md': ['# Beta: design', '', 'Follows [Alpha](example-alpha-design.md).', ''].join('\n'),
  'src/docs/specs/example-alpha-design-v2.md': '# Alpha v2\n',
  'src/docs/specs/example-img.png': IMG_MOVED,
  'src/docs/img/example-a.png': IMG_UNMOVED,
  'src/docs/plans/example-alpha.md': [
    '# Alpha plan', '', '**Spec:** `src/docs/specs/example-alpha-design.md`, also [the spec](../specs/example-alpha-design.md).',
    '', '```bash', 'cat src/docs/specs/example-alpha-design.md', 'echo "[Journal](features/example-journal.md)"', '```',
    'A wiki line quoted for a page: [Alpha](../../specs/example-alpha-design.md).', ''].join('\n'),
  'src/docs/wiki/example-page.md': [
    '# Example page', '', 'Design: [the spec](../specs/example-alpha-design.md), and `src/docs/specs/example-alpha-design.md`.',
    'Read [x](<../specs/example-alpha-design.md>) end.',
    'Both src/docs/specs/example-alpha-design.md and [again](../specs/example-alpha-design.md) on one line.', ''].join('\n'),
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
  {from: 'src/docs/specs/example-img.png', to: 'src/docs/specs/1.9.0/example-img.png'},
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
/* the moves list lives in its own mkdtempSync dir, well away from the tree
   being moved, and is removed afterwards: nothing is left in os.tmpdir() (#127 ruling 2) */
const runMove = (d, moves, ...flags) => {
  const listDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-move-docs-list-'));
  const list = path.join(listDir, 'moves.json');
  fs.writeFileSync(list, JSON.stringify(moves));
  const r = spawnSync('node', [MOVE_DOCS, list, '--root', d, ...flags], {encoding: 'utf8'});
  fs.rmSync(listDir, {recursive: true, force: true});
  return r;
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
  ck('#127 a moved spec\'s folder link, deep anchored link and image all still resolve (#127 fix round 1, finding 1)',
     spec.includes('[plans/](../../plans/)') && spec.includes('[x](../../../js/10-example.js#sec)') &&
     spec.includes('![img](../../img/example-a.png)'), spec);
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
  ck('#127 an angle-bracket link target resolves correctly, not doubled (#127 fix round 2, finding 1)',
     rd(d, 'src/docs/wiki/example-page.md').includes('Read [x](<../specs/1.9.0/example-alpha-design.md>) end.'));
  ck('#127 a bare path and a link to the same file on one line both rewrite, once each',
     rd(d, 'src/docs/wiki/example-page.md').includes(
       'Both src/docs/specs/1.9.0/example-alpha-design.md and [again](../specs/1.9.0/example-alpha-design.md) on one line.'));
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
  ck('#127 a binary file that is moved keeps its exact bytes and hash (#127 fix round 1, finding 2)',
     !fs.existsSync(path.join(d, MOVES[2].from)) && fs.readFileSync(path.join(d, MOVES[2].to)).equals(IMG_MOVED));
  ck('#127 a binary file under a scanned root that is not moved is left untouched',
     fs.readFileSync(path.join(d, 'src/docs/img/example-a.png')).equals(IMG_UNMOVED));
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
  // a move list that can't be read, and no list at all: both refuse on a temp root,
  // and both say plainly that nothing was written (#127 rulings 3 and 4)
  const d = tree();
  const r = spawnSync('node', [MOVE_DOCS, path.join(d, 'no-such-list.json'), '--root', d], {encoding: 'utf8'});
  ck('#127 move-docs refuses a move list it cannot read',
     r.status === 1 && r.stderr.includes('cannot read') && r.stderr.includes('nothing was written'), r.stderr);
  const u = spawnSync('node', [MOVE_DOCS, '--root', d], {encoding: 'utf8'});
  ck('#127 move-docs with no list prints its usage, and says nothing was written',
     u.status === 1 && u.stderr.includes('usage') && u.stderr.includes('nothing was written'), u.stderr);
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
  /* ruling 15's four roots; ruling 25's status log; ruling 24's private allowlist, and
     nothing else of the private repo (its packs are not ours to rewrite) */
  ck('#127 ...and README.md, build.sh, dev.sh, .githooks, the status log and the private leak allowlist, only that from the private repo',
     ['README.md', 'build.sh', 'dev.sh', '.githooks', '.claude/status.md', '_private-data/tests/leak-allowlist.json'].every(s => md.SCAN.includes(s)) &&
     md.SCAN.filter(s => s.startsWith('_private-data')).length === 1, md.SCAN);
}

{
  // the private repo's leak allowlist (#127 ruling 24): rewritten through the
  // _private-data symlink when it is linked; nothing else of the private repo is
  // searched; the run says the private repo changed
  const d = tree();
  const priv = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-move-docs-private-'));
  const allow = {_comment: ['hashes, never text'], allow: [
    {file: 'src/docs/plans/example-alpha.md', hash: '0123456789abcdef', why: 'example'},
    {file: 'scripts/example.py', hash: 'fedcba9876543210', why: 'example'}]};
  const allowText = JSON.stringify(allow, null, 2) + '\n';
  fs.mkdirSync(path.join(priv, 'tests'), {recursive: true});
  fs.writeFileSync(path.join(priv, 'tests', 'leak-allowlist.json'), allowText);
  const otherText = 'Not ours: src/docs/plans/example-alpha.md\n';
  fs.writeFileSync(path.join(priv, 'tests', 'other.md'), otherText);
  fs.symlinkSync(priv, path.join(d, '_private-data'));
  const dry = runMove(d, MOVES, '--dry-run');
  ck('#127 the dry run lists the private allowlist among its edits',
     dry.status === 0 && /^edit  _private-data\/tests\/leak-allowlist\.json \(1\)$/m.test(dry.stdout), dry.stdout + dry.stderr);
  const r = runMove(d, MOVES);
  const got = fs.readFileSync(path.join(priv, 'tests', 'leak-allowlist.json'), 'utf8');
  ck('#127 the private leak allowlist\'s repo path follows the move, and nothing else in it changes',
     r.status === 0 && got === allowText.replace('src/docs/plans/example-alpha.md', 'src/docs/plans/1.9.0/example-alpha.md'), got + r.stderr);
  ck('#127 ...written through the symlink, which stays a symlink', fs.lstatSync(path.join(d, '_private-data')).isSymbolicLink());
  ck('#127 ...the rest of the private repo is not searched', fs.readFileSync(path.join(priv, 'tests', 'other.md'), 'utf8') === otherText);
  ck('#127 ...and the run says the private repo changed, naming where it really is',
     r.stdout.includes('the private repo changed too (_private-data -> ' + fs.realpathSync(priv) + '): commit it there, and push it right after public main'), r.stdout);
  fs.rmSync(d, {recursive: true, force: true});
  fs.rmSync(priv, {recursive: true, force: true});
  // absent: skipped without a word
  const d2 = tree();
  const r2 = runMove(d2, MOVES);
  ck('#127 with no _private-data linked, the run succeeds and says nothing about it',
     r2.status === 0 && !/private/.test(r2.stdout + r2.stderr), r2.stdout + r2.stderr);
  fs.rmSync(d2, {recursive: true, force: true});
}

/* a read-only folder is refused before anything is written (#127 final fix wave).
   chmod means nothing to root, so these cases are skipped there. */
const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
if (!asRoot) {
  for (const [what, ro, why] of [
      ['a read-only destination folder', 'src/docs/specs/1.9.0', 'src/docs/specs/1.9.0 is not writable (src/docs/specs/1.9.0/example-alpha-design.md is written in it)'],
      ['a read-only source folder', 'src/docs/plans', 'src/docs/plans is not writable (src/docs/plans/1.9.0/example-alpha.md is written in it)'],
      ['a read-only file with a reference to rewrite', 'CLAUDE.md', 'CLAUDE.md is not writable (a reference in it is rewritten)']]) {
    const d = tree();
    fs.mkdirSync(path.join(d, 'src/docs/specs/1.9.0'), {recursive: true});
    fs.chmodSync(path.join(d, ro), fs.statSync(path.join(d, ro)).isDirectory() ? 0o555 : 0o444);
    const before = snapshot(d);
    const r = runMove(d, MOVES);
    ck('#127 move-docs refuses ' + what + ' before writing anything',
       r.status === 1 && r.stderr.includes('move-docs: ' + why) && r.stderr.includes('nothing was written') &&
       !r.stdout.includes('references rewritten') && same(snapshot(d), before), r.stdout + r.stderr);
    ck('#127 ...without a stack trace', !/^\s+at /m.test(r.stderr), r.stderr);
    const dry = runMove(d, MOVES, '--dry-run');
    ck('#127 ...and the dry run refuses it too', dry.status === 1 && dry.stderr.includes(why), dry.stderr);
    fs.chmodSync(path.join(d, ro), 0o755);
    fs.rmSync(d, {recursive: true, force: true});
  }
}

/* a write that fails part way (#127 final fix wave): main() is run in this process
   with fs.writeFileSync (or fs.unlinkSync) failing at the nth call, on a tree under
   git. It must print no success summary and no stack trace, say how far it got,
   keep every source until the end, and print undo commands that, run as printed,
   leave git status clean. */
{
  const gitIn = (d, ...a) => spawnSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@example.com',
    '-c', 'commit.gpgsign=false', ...a], {encoding: 'utf8'});
  const failAt = (fn, n, truncate) => {
    const d = tree();
    gitIn(d, 'init', '-q'); gitIn(d, 'add', '-A'); gitIn(d, 'commit', '-qm', 'start');
    const listDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-move-docs-list-'));
    const list = path.join(listDir, 'moves.json');
    fs.writeFileSync(list, JSON.stringify(MOVES));
    const orig = fs[fn], log = console.log, err = console.error;
    let calls = 0, out = '', errOut = '', rc;
    fs[fn] = function () {
      if (++calls === n) {
        if (truncate) orig.call(fs, arguments[0], ''); // the write got as far as emptying its file
        throw new Error('EIO: injected failure at ' + fn + ' #' + n);
      }
      return orig.apply(fs, arguments);
    };
    console.log = (...a) => { out += a.join(' ') + '\n'; };
    console.error = (...a) => { errOut += a.join(' ') + '\n'; };
    try { rc = md.main(['node', MOVE_DOCS, list, '--root', d]); }
    catch (e) { rc = 'threw: ' + e.stack; }
    finally { fs[fn] = orig; console.log = log; console.error = err; }
    fs.rmSync(listDir, {recursive: true, force: true});
    return {d, rc, out, err: errOut};
  };
  for (const [fn, n, label, truncate] of [['writeFileSync', 3, 'the third write'], ['unlinkSync', 2, 'removing the second source'],
      ['writeFileSync', 1, 'the first write, after it emptied its file', true]]) {
    const {d, rc, out, err} = failAt(fn, n, truncate);
    ck('#127 a failure at ' + label + ': exit 1, no summary, no stack trace',
       rc === 1 && !/references rewritten/.test(out) && !/^\s+at /m.test(err) && /move-docs: failed after \d+ of \d+ writes: EIO: injected/.test(err), {rc, out, err});
    if (truncate) {
      ck('#127 ...the file the failing write emptied is in the undo list', /^  git checkout -- .*\.claude\/skills\/example\/SKILL\.md/m.test(err), err);
    }
    if (fn === 'writeFileSync') {
      ck('#127 ...every source is still in place (sources are removed last)',
         MOVES.every(m => fs.existsSync(path.join(d, m.from))) && err.includes('every source is still where it was'), err);
    } else {
      ck('#127 ...the writes all landed and one source went before the failure',
         MOVES.every(m => fs.existsSync(path.join(d, m.to))) && /removed 1 of 3 sources/.test(err), err);
    }
    const undo = err.split('\n').filter(l => /^  (git |rm )/.test(l)).map(l => l.trim());
    ck('#127 ...prints undo commands naming each file, never the whole tree',
       undo.length >= 1 && err.includes('it has run none of them') && !undo.some(c => / -- \.$| -- \. /.test(c) || /git clean/.test(c)), undo);
    undo.forEach(c => spawnSync('sh', ['-c', c], {cwd: d}));
    const st = gitIn(d, 'status', '--porcelain', '--untracked-files=all').stdout.trim();
    ck('#127 ...and those commands, run as printed, put the tree back as it was', st === '', st);
    fs.rmSync(d, {recursive: true, force: true});
  }
}

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
  /* #127 ruling 18: each step has exactly one row, or the record is invalid (fail closed) */
  const row3 = '| 3. QA checklist | done | 2026-10-30 | ok |\n';
  ck('#127 a duplicated step row, done then open: refused, naming the row',
     rec.recordProblem(record('1.9.0').replace(row3, row3 + '| 3. QA checklist | open | | |\n'), '1.9.0') ===
     'src/docs/PRE-RELEASE.md has 2 rows for step 3. QA checklist. Run /pre-release 1.9.0 to finish it.');
  ck('#127 a duplicated step row, done then done: refused too',
     rec.recordProblem(record('1.9.0').replace(row3, row3 + row3), '1.9.0') ===
     'src/docs/PRE-RELEASE.md has 2 rows for step 3. QA checklist. Run /pre-release 1.9.0 to finish it.');
  ck('#127 a missing row 4: refused, naming it',
     rec.recordProblem(record('1.9.0').replace(/^\| 4\. .*\n/m, ''), '1.9.0') ===
     'src/docs/PRE-RELEASE.md has no row for step 4. QA bugs. Run /pre-release 1.9.0 to finish it.');
  ck('#127 ...an invalid record is refused as invalid even with an earlier step open',
     rec.recordProblem(record('1.9.0', [1]).replace(row3, row3 + row3), '1.9.0').includes('has 2 rows for step 3'));
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
  /* #127 ruling 17: no git here, so the archived copy is untracked and there is no
     tag: an undone cut. It names the command to put it back and moves nothing.
     A tracked copy or a tag ("cut before") is tested end to end in data-kit.py. */
  ck('#127 gateProblem: an untracked archived record with no tag is an undone cut, with the command to put it back',
     rec.gateProblem(d, '1.9.0') === 'src/docs/archive/1.9.0/PRE-RELEASE.md is left from a cut of 1.9.0 that was undone: ' +
     'git does not track it and there is no tag v1.9.0. Put the record back, then run again: ' +
     'mv src/docs/archive/1.9.0/PRE-RELEASE.md src/docs/PRE-RELEASE.md', rec.gateProblem(d, '1.9.0'));
  ck('#127 ...and moves nothing', fs.existsSync(path.join(d, rec.archivePath('1.9.0'))) && fs.existsSync(path.join(d, rec.RECORD)));
  fs.rmSync(d, {recursive: true, force: true});
}

{
  // the CLI's arguments and words (#127 final fix wave)
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-record-'));
  const cli = (...a) => spawnSync('node', [RECORD_JS, ...a, '--root', d], {encoding: 'utf8'});
  fs.mkdirSync(path.join(d, 'src/docs'), {recursive: true});
  fs.writeFileSync(path.join(d, rec.RECORD), record('1.9.0'));
  for (const flag of ['--help', '-h']) {
    const r = cli(flag);
    ck('#127 the CLI\'s ' + flag + ' prints the usage and exits 0', r.status === 0 && r.stdout.startsWith('usage: node scripts/pre-release-record.js') && r.stderr === '', r);
  }
  let r = cli('--bogus');
  ck('#127 an unknown flag exits 2 with the usage', r.status === 2 && r.stderr.includes('unknown option --bogus') && r.stderr.includes('usage:'), r.stderr);
  r = cli('v1.9.0');
  ck('#127 a version that is not X.Y.Z exits 2 with the usage', r.status === 2 && r.stderr.includes('v1.9.0 is not a version X.Y.Z') && r.stderr.includes('usage:'), r.stderr);
  r = cli('1.9.0', '1.9.1');
  ck('#127 two versions exit 2', r.status === 2 && r.stderr.includes('usage:'), r.stderr);
  r = spawnSync('node', [RECORD_JS, '1.9.0', '--root'], {encoding: 'utf8'});
  ck('#127 --root with no folder exits 2', r.status === 2 && r.stderr.includes('--root needs a folder'), r.stderr);
  // with no version, the same exact-heading rule release.js applies
  fs.writeFileSync(path.join(d, rec.RECORD), record('v1.9.0'));
  r = cli();
  ck('#127 the CLI with no version refuses a heading that is not X.Y.Z, as release.js does',
     r.status === 1 && !r.stdout.includes('complete') &&
     r.stderr.trim() === "pre-release: src/docs/PRE-RELEASE.md's heading names v1.9.0, which is not a version X.Y.Z: release.js refuses it. Run /pre-release X.Y.Z first.", r.stdout + r.stderr);
  fs.writeFileSync(path.join(d, rec.RECORD), 'just text\n');
  r = cli();
  ck('#127 ...and a record with no heading', r.status === 1 && r.stderr.includes('has no "# Pre-release X.Y.Z" heading'), r.stderr);
  // each refusal reads "pre-release" once
  fs.writeFileSync(path.join(d, rec.RECORD), record('1.9.0', [2]));
  r = cli('1.9.0');
  ck('#127 a refusal that names the step reads "pre-release" once',
     r.status === 1 && r.stderr.trim() === 'pre-release 1.9.0 is not finished: step 2. Outstanding issues is open. Run /pre-release 1.9.0 to finish it.', r.stderr);
  fs.writeFileSync(path.join(d, rec.RECORD), record('1.9.1'));
  r = cli('1.9.0');
  ck('#127 ...and any other refusal is prefixed "pre-release: " once',
     r.status === 1 && r.stderr.trim() === 'pre-release: src/docs/PRE-RELEASE.md is for 1.9.1, not 1.9.0. Run /pre-release 1.9.0 first.', r.stderr);
  fs.rmSync(d, {recursive: true, force: true});
}

if (!asRoot) {
  // archiveRecord() failing (#127 final fix wave): it throws, the record stays where
  // it was, and the folder it made is removed, so no later gate misreads the tree
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-record-'));
  fs.mkdirSync(path.join(d, 'src/docs/archive'), {recursive: true});
  fs.writeFileSync(path.join(d, rec.RECORD), record('1.9.0'));
  fs.chmodSync(path.join(d, 'src/docs'), 0o555); // the record cannot leave src/docs
  let threw = null;
  try { rec.archiveRecord(d, '1.9.0'); } catch (e) { threw = e; }
  fs.chmodSync(path.join(d, 'src/docs'), 0o755);
  ck('#127 a failed archiveRecord throws, leaves the record in place and no empty archive folder',
     threw !== null && fs.existsSync(path.join(d, rec.RECORD)) && !fs.existsSync(path.join(d, 'src/docs/archive/1.9.0')), threw && threw.message);
  ck('#127 ...and the command to file it by hand (no git here: plain mv)',
     rec.archiveByHand(d, '1.9.0') === 'mkdir -p src/docs/archive/1.9.0 && mv src/docs/PRE-RELEASE.md src/docs/archive/1.9.0/PRE-RELEASE.md');
  fs.rmSync(d, {recursive: true, force: true});
}

// ---- add new cases above this line ----
ck.done();
