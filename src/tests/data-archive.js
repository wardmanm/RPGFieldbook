/* Rules data as an archive (#83): data versions, the zip reader, importing an
   archive, pack credits, and the newer-data notice. Sections run in order (some
   are async), then ck.done(). Later tasks add sections above the marker line
   and names to the loadApp() list. Spec:
   src/docs/specs/2026-10-07-data-archive-design.md */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os');
const {spawnSync} = require('child_process');
const {loadApp, makeCheck, ROOT} = require('./harness');

const ck = makeCheck();
const {X, ctx, state, bootError} = loadApp([
  'parseDataVer', 'cmpDataVer', 'dataVerOfTag', 'dataVerBase',
  'mergeRules', 'resetRules', 'loadedRulesGroups', 'dataStatus', 'dataStatusHTML', 'DATA_VERSIONS',
  'poolFromExport', 'settingsImportQuestionHTML',
]);
if (bootError) { console.log('LOAD FAIL: ' + bootError.message); process.exit(1); }

const SECTIONS = [];
const section = (name, fn) => SECTIONS.push([name, fn]);
/* the interpreter run.sh would pick, or null: python3, then python */
const PY = ['python3', 'python'].find(p => spawnSync(p, ['-c', ''], {stdio: 'ignore'}).status === 0) || null;
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fb-archive-'));
/* the code of the error fn throws, 'none' if it doesn't */
const code = fn => { try { fn(); return 'none'; } catch (e) { return (e && e.code) || String(e); } };

// ---------- data versions (spec §3)
section('data versions', () => {
  ck('parseDataVer reads X.Y.Z', JSON.stringify(X.parseDataVer('1.8.0')) === '[1,8,0,0]', X.parseDataVer('1.8.0'));
  ck('parseDataVer reads X.Y.Z-N', JSON.stringify(X.parseDataVer('1.8.0-12')) === '[1,8,0,12]', X.parseDataVer('1.8.0-12'));
  ['', 'v1.8.0', '1.8', '1.8.0-0', '1.8.0-01', '01.8.0', '1.8.0+dev', '1.8.0-1-2', ' 1.8.0', '1.8.0-', null, 7]
    .forEach(s => ck('parseDataVer refuses ' + JSON.stringify(s), X.parseDataVer(s) === null));
  const order = ['1.7.2', '1.8.0', '1.8.0-1', '1.8.0-2', '1.8.0-9', '1.8.0-10', '1.8.1', '1.10.0', '2.0.0'];
  const sorted = order.slice().reverse().sort((a, b) => X.cmpDataVer(a, b));
  ck('cmpDataVer: 1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1', JSON.stringify(sorted) === JSON.stringify(order), sorted);
  ck('cmpDataVer: equal is 0', X.cmpDataVer('1.8.0-3', '1.8.0-3') === 0);
  ck('cmpDataVer: invalid on either side is 0', X.cmpDataVer('junk', '1.8.0') === 0 && X.cmpDataVer('1.8.0', undefined) === 0);
  [['v1.8.0', '1.8.0'], ['data-v1.8.0-2', '1.8.0-2'], ['data-v1.8.0', ''], ['v1.8.0-1', ''], ['1.8.0', ''],
   ['data-v1.8', ''], ['', ''], [null, '']].forEach(([t, want]) =>
    ck('dataVerOfTag ' + JSON.stringify(t) + ' -> ' + JSON.stringify(want), X.dataVerOfTag(t) === want, X.dataVerOfTag(t)));
  [['1.8.0-2', '1.8.0'], ['1.8.0', '1.8.0'], ['nope', '']].forEach(([v, want]) =>
    ck('dataVerBase ' + v + ' -> ' + JSON.stringify(want), X.dataVerBase(v) === want, X.dataVerBase(v)));
});

section('dataStatus reads data versions', () => {
  const sys = Object.keys(X.DATA_VERSIONS)[0], want = X.DATA_VERSIONS[sys];
  const at = v => { X.resetRules(); X.mergeRules({system: sys, rulebook: true, dataVersion: v, races: [{name: 'Elf'}]}, 'p.json'); return X.dataStatus(X.loadedRulesGroups()[0]); };
  ck('a data release after the baseline is current', at(want + '-1').state === 'current', at(want + '-1'));
  ck('the baseline itself is current', at(want).state === 'current');
  ck('a pack older than the baseline is stale', at('1.0.0').state === 'stale');
  ck('an unreadable version is unknown, never stale or current', at('1.0').state === 'unknown', at('1.0'));
  X.resetRules();
});

section('Import settings sees an older -N copy', () => {
  X.resetRules();
  X.mergeRules({system: 'XPHB', rulebook: true, dataVersion: '1.8.0-2', races: [{name: 'Elf'}]}, '5e2024_full.json');
  const saved = {races: [{name: 'Elf', _source: 'XPHB', _file: '5e2024_full.json', _rulebook: 1, _dataVersion: '1.8.0-1'}]};
  const built = X.poolFromExport(saved);
  const html = X.settingsImportQuestionHTML({pool: built.pool, skipped: 0});
  ck('a file holding 1.8.0-1 while 1.8.0-2 is loaded is an older copy', /puts back an older copy/.test(html), html.slice(0, 300));
  X.resetRules();
});

// ---- add new sections above this line ----
(async () => {
  for (const [name, fn] of SECTIONS) {
    try { await fn(); } catch (e) { ck(name + ' ran to the end', false, String((e && e.stack) || e)); }
  }
})().then(() => ck.done());
