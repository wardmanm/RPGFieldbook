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
  'crc32', 'inflateRaw', 'isZipBytes', 'zipEntries', 'zipEntryBytes', 'readDataArchive', 'utf8Text', 'zipError',
  'importRulesPayloads', 'importPack', 'importSummary', 'importRulesFiles', 'RULE_CATS',
  'creditOf', 'rulesCreditsHTML', 'removeRulesGroup', 'clearAllRules', 'reindexRules', 'prunePackMeta',
  'pickDataRelease', 'dataUpdateFrom', 'checkForDataUpdate', 'rulesDataHTML', 'rulesBadge', 'APP_VERSION', 'dataUpdateHint',
  'sha256Hex', 'extUrl', 'extRelPath', 'extEntry', 'readManifest', 'extKey', 'extTooNew', 'convertSources',
  'extOffers', 'availableFor', 'extPackRows', 'extUpdateRows', 'extPillCount', 'dismissUpdates',
  'settings', 'EXT_CATS', 'foldLegacySettings',
  'extFetchBytes', 'checkSource', 'checkSources', 'addSource', 'offerCandidate', 'manualCandidates',
  'planInstall', 'runInstall', 'importPack', 'loadedRulesGroups',
  'extSaveErrorText', 'EXT_FILE_MAX', 'EXT_MAN_MAX',
  'extPageHTML', 'extRowHTML', 'extSourcesHTML', 'extDetailsHTML', 'extParas', 'setPageOf', 'SET_PAGES',
  'rulesNavBadgeHTML', 'renderExtUI', 'renderRulesData',
  'extPlanHTML', 'renderExtPill', 'showUpdatePill', 'openInstallPlan', 'manualInstallFiles', 'readDropped',
  'extInstalledText', 'extFocusTargets', 'extReqChip', 'extReqTap', 'extText', 'extSourceName', 'extSourceHost',
  'rulesStatusText', 'extWireDrop', 'extManualPlan', 'extPillFocusBack', 'EXT_DROP_MAX', 'dismissModal',
]);
if (bootError) { console.log('LOAD FAIL: ' + bootError.message); process.exit(1); }
ctx.URL = URL;   // offerCandidate() resolves a pack's path against its source with it (#102)

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
  // Review Focus 1: a pack this build has no baseline for (a private pack, or a
  // v1.7.2 player's old XPHB after 1.8.0 drops it from DATA_VERSIONS) shows its
  // version quietly: no alarm, no notice.
  const other = v => { X.resetRules(); X.mergeRules({system: 'Not In This Build', rulebook: true, dataVersion: v, races: [{name: 'Elf'}]}, 'mine_full.json'); return X.loadedRulesGroups()[0]; };
  ck('a pack with no baseline is "known"', X.dataStatus(other('1.7.2')).state === 'known', X.dataStatus(other('1.7.2')));
  ck('...shown as its version, quietly', /v1\.7\.2/.test(X.dataStatusHTML(other('1.7.2'))) && !/update available/.test(X.dataStatusHTML(other('1.7.2'))),
     X.dataStatusHTML(other('1.7.2')));
  ck('...and it raises no newer-data notice', !/Newer rules data is out/.test(X.rulesDataHTML()) && !/update/.test(X.rulesBadge()));
  ck('a pack with no baseline and no version stays unknown and shows nothing',
     X.dataStatus(other(undefined)).state === 'unknown' && X.dataStatusHTML(other(undefined)) === '');
  X.resetRules();
});

section('Import settings sees an older -N copy', () => {
  X.resetRules();
  X.mergeRules({system: 'XPHB', rulebook: true, dataVersion: '1.8.0-2', races: [{name: 'Elf'}]}, 'rulebook_full.json');
  const saved = {races: [{name: 'Elf', _source: 'XPHB', _file: 'rulebook_full.json', _rulebook: 1, _dataVersion: '1.8.0-1'}]};
  const built = X.poolFromExport(saved);
  const html = X.settingsImportQuestionHTML({pool: built.pool, skipped: 0});
  ck('a file holding 1.8.0-1 while 1.8.0-2 is loaded is an older copy', /puts back an older copy/.test(html), html.slice(0, 300));
  X.resetRules();
});

// ---------- a zip writer for the tests: stored or deflated, an optional data
// descriptor, and every header field the refusal cases need to break
function makeZip(files, opt = {}) {
  const parts = [], central = []; let off = 0;
  files.forEach(f => {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data == null ? '' : f.data, 'utf8');
    const method = f.method == null ? 8 : f.method;
    const comp = f.comp || (method === 8 ? zlib.deflateRawSync(data, {level: f.level == null ? 6 : f.level}) : data);
    const name = Buffer.from(f.name, 'utf8');
    const crc = f.crc == null ? X.crc32(new Uint8Array(data)) : f.crc;
    const flags = (f.flags || 0) | 0x800 | (f.descriptor ? 8 : 0);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8);
    if (!f.descriptor) { lh.writeUInt32LE(crc >>> 0, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); }
    lh.writeUInt16LE(name.length, 26);
    const dd = Buffer.alloc(f.descriptor ? 16 : 0);
    if (f.descriptor) { dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc >>> 0, 4); dd.writeUInt32LE(comp.length, 8); dd.writeUInt32LE(data.length, 12); }
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc >>> 0, 16);
    ch.writeUInt32LE(f.csize == null ? comp.length : f.csize, 20);
    ch.writeUInt32LE(f.usize == null ? data.length : f.usize, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(f.offset == null ? off : f.offset, 42);
    parts.push(lh, name, comp, dd); central.push(ch, name);
    off += 30 + name.length + comp.length + dd.length;
  });
  const cd = Buffer.concat(central), eocd = Buffer.alloc(22);
  const n = opt.count == null ? files.length : opt.count;
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(n, 8); eocd.writeUInt16LE(n, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  const loc = Buffer.alloc(opt.zip64Locator ? 20 : 0);
  if (opt.zip64Locator) loc.writeUInt32LE(0x07064b50, 0);
  return new Uint8Array(Buffer.concat([...parts, cd, loc, eocd]));
}
/* a deterministic incompressible buffer */
const noise = n => { const b = Buffer.alloc(n); let s = 12345; for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; b[i] = s >>> 24; } return b; };
const PACK = (sys, spells) => JSON.stringify({system: sys, spells: spells.map(name => ({name}))});
const MANIFEST = (version, files) => JSON.stringify({_type: 'fieldbook-data', format: 1, version, builtFor: '1.8.0', packs: files.map(file => ({file}))});

section('crc32 and inflate', () => {
  ck('crc32 of nothing is 0', X.crc32(new Uint8Array(0)) === 0);
  ck('crc32 of "123456789" is cbf43926', X.crc32(new Uint8Array(Buffer.from('123456789'))) === 0xcbf43926);
  const text = Buffer.from(JSON.stringify(Array.from({length: 3000}, (_, i) => ({name: 'Spell ' + i, level: i % 10, text: 'Deal 8d6 fire damage.'}))));
  const big = Buffer.concat(Array.from({length: Math.ceil(2097152 / text.length)}, () => text)).subarray(0, 2097152);
  const inputs = {empty: Buffer.alloc(0), tiny: Buffer.from('a'), text, noise: noise(70000)};
  Object.entries(inputs).forEach(([label, buf]) => {
    for (let level = 0; level <= 9; level++) {
      const out = X.inflateRaw(new Uint8Array(zlib.deflateRawSync(buf, {level})), buf.length);
      ck('inflateRaw ' + label + ' at level ' + level, Buffer.from(out).equals(buf));
    }
  });
  [1, 6, 9].forEach(level => {
    const out = X.inflateRaw(new Uint8Array(zlib.deflateRawSync(big, {level})), big.length);
    ck('inflateRaw 2 MB at level ' + level, Buffer.from(out).equals(big));
  });
  const d = new Uint8Array(zlib.deflateRawSync(text));
  ck('a truncated stream is damaged', code(() => X.inflateRaw(d.subarray(0, d.length >> 1), text.length)) === 'damaged');
  ck('a bad block type is damaged', code(() => X.inflateRaw(new Uint8Array([0x07]), 10)) === 'damaged');
  ck('more output than promised is damaged', code(() => X.inflateRaw(d, text.length - 1)) === 'damaged');
  ck('less output than promised is damaged', code(() => X.inflateRaw(d, text.length + 1)) === 'damaged');
});

section('the zip reader refuses by name', () => {
  const ok = [{name: 'a.json', data: PACK('Zed', ['Zap'])}];
  ck('isZipBytes: a zip', X.isZipBytes(makeZip(ok)));
  ck('isZipBytes: JSON is not', !X.isZipBytes(new Uint8Array(Buffer.from('{"a":1}'))));
  ck('no end record: notzip', code(() => X.zipEntries(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0]))) === 'notzip');
  ck('an entry count of 0xFFFF: zip64', code(() => X.zipEntries(makeZip(ok, {count: 0xffff}))) === 'zip64');
  ck('a ZIP64 locator: zip64', code(() => X.zipEntries(makeZip(ok, {zip64Locator: true}))) === 'zip64');
  ck('a size of 0xFFFFFFFF: zip64', code(() => X.zipEntries(makeZip([{name: 'a.json', data: 'x', csize: 0xffffffff}]))) === 'zip64');
  ck('more than 1,000 entries: toomany', code(() => X.zipEntries(makeZip(ok, {count: 1001}))) === 'toomany');
  ck('encrypted (flag bit 0)', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: PACK('Z', ['A']), flags: 1}]), 'e.zip')) === 'encrypted');
  ck('encrypted (method 99, AES)', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: 'x', method: 99, comp: Buffer.from('x')}]), 'e.zip')) === 'encrypted');
  ck('bzip2 (method 12): method', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: 'x', method: 12, comp: Buffer.from('x')}]), 'm.zip')) === 'method');
  ck('a wrong CRC: damaged', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: PACK('Z', ['A']), crc: 1}]), 'c.zip')) === 'damaged');
  ck('an offset past the end: damaged', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: 'x', offset: 99999}]), 'o.zip')) === 'damaged');
  ck('an entry claiming 33 MiB: toolarge', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: 'x', usize: 33 * 1048576}]), 'l.zip')) === 'toolarge');
  ck('a zip over 64 MiB: toolarge', code(() => X.zipEntries(new Uint8Array(64 * 1048576 + 1))) === 'toolarge');
  ck('the data kit: kit', code(() => X.readDataArchive(makeZip([{name: 'kit/fbdata.py', data: 'print()'}, {name: 'kit/README.md', data: '#'}]), 'k.zip')) === 'kit');
  ck('nothing usable: empty', code(() => X.readDataArchive(makeZip([{name: 'readme.txt', data: 'hi'}]), 'r.zip')) === 'empty');
});

section('the zip reader reads', () => {
  const loose = X.readDataArchive(makeZip([
    {name: '__MACOSX/._a.json', data: 'junk'}, {name: '._b.json', data: 'junk'}, {name: 'dir/.DS_Store', data: 'junk'},
    {name: 'dir/', data: '', method: 0}, {name: 'dir/b.json', data: PACK('Z', ['B'])}, {name: 'a.json', data: PACK('Z', ['A'])},
  ]), 'l.zip');
  ck('loose: every .json, in name order, junk ignored', loose.kind === 'loose' && loose.packs.map(p => p.name).join() === 'a.json,b.json', loose.packs.map(p => p.name));
  const bom = X.readDataArchive(makeZip([{name: 'a.json', data: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(PACK('Bom', ['A']))])}]), 'b.zip');
  ck('a BOM on a JSON entry is dropped by utf8Text', JSON.parse(X.utf8Text(bom.packs[0].bytes)).system === 'Bom');
  const desc = X.readDataArchive(makeZip([{name: 'a.json', data: PACK('Dd', ['A']), descriptor: true}]), 'd.zip');
  ck('a data-descriptor (flag bit 3) entry reads', JSON.parse(X.utf8Text(desc.packs[0].bytes)).system === 'Dd');
  const stored = X.readDataArchive(makeZip([{name: 'a.json', data: PACK('St', ['A']), method: 0}]), 's.zip');
  ck('a stored entry reads', JSON.parse(X.utf8Text(stored.packs[0].bytes)).system === 'St');
  const accent = X.readDataArchive(makeZip([{name: 'é.json', data: PACK('E', ['A'])}]), 'n.zip');
  ck('a non-ASCII name decodes', accent.packs[0].name === 'é.json', accent.packs[0].name);

  const archive = [{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['z_full.json', 'y_full.json'])},
                   {name: 'NOTICE.md', data: '# notice'},
                   {name: 'y_full.json', data: PACK('Y', ['B'])}, {name: 'z_full.json', data: PACK('Z', ['A'])}];
  const a = X.readDataArchive(makeZip(archive), 'fieldbook-data-standalone-1.8.0.zip');
  ck('an archive: kind data, its version, packs in manifest order', a.kind === 'data' && a.version === '1.8.0' && a.packs.map(p => p.name).join() === 'z_full.json,y_full.json', a);
  const down = X.readDataArchive(makeZip(archive.map(f => Object.assign({}, f, {name: 'fieldbook-data-standalone-1.8.0/' + f.name}))), 'r.zip');
  ck('an archive one folder down still reads', down.kind === 'data' && down.packs.length === 2, down);
  ck('a manifest listing a missing file: damaged',
     code(() => X.readDataArchive(makeZip([{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['gone.json'])}]), 'g.zip')) === 'damaged');
  ck('a manifest that is not one: damaged',
     code(() => X.readDataArchive(makeZip([{name: 'fieldbook-data.json', data: '{"_type":"other","packs":[]}'}]), 'g.zip')) === 'damaged');

  const app = X.readDataArchive(makeZip([
    {name: 'fieldbook.html', data: '<!doctype html>'}, {name: 'scripts/overlay.json', data: '{"byName":{}}'},
    {name: 'data/fieldbook-data-standalone-1.8.0.zip', data: Buffer.from(makeZip(archive)), method: 0},
  ]), 'fieldbook-v1.8.0.zip');
  ck('the app zip: the archive inside it is read', app.kind === 'data' && app.version === '1.8.0' && app.packs.length === 2, app);
  const notArchive = X.readDataArchive(makeZip([
    {name: 'data/other.zip', data: Buffer.from(makeZip([{name: 'x.json', data: PACK('X', ['A'])}])), method: 0},
    {name: 'a.json', data: PACK('Zed', ['A'])},
  ]), 'o.zip');
  ck('an inner zip that is not an archive is skipped', notArchive.kind === 'loose' && notArchive.packs.map(p => p.name).join() === 'a.json', notArchive);
});

section('the read cap covers the whole import; a junk inner zip is skipped', () => {
  const MiB = 1048576;
  const claims = (n, mib) => Array.from({length: n}, (_, i) => ({name: 'p' + i + '.json', data: 'x', usize: mib * MiB}));
  ck('loose entries totalling over 128 MiB: toolarge, before inflating any',
     code(() => X.readDataArchive(makeZip(claims(5, 30)), 'big.zip')) === 'toolarge');
  /* one real 40 MiB archive, then one claiming 90 MiB: each alone fits, together they don't */
  const zeros = Buffer.alloc(20 * MiB);
  const real = makeZip([{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['a.json', 'b.json'])},
    {name: 'a.json', data: zeros, level: 1}, {name: 'b.json', data: zeros, level: 1}]);
  const claimed = makeZip([{name: 'fieldbook-data.json', data: MANIFEST('1.8.1', ['p0.json', 'p1.json', 'p2.json'])}].concat(claims(3, 30)));
  const nest = makeZip([{name: 'one.zip', data: Buffer.from(real), method: 0}, {name: 'two.zip', data: Buffer.from(claimed), method: 0}]);
  ck('nested archives share one budget: 40 + 90 MiB is toolarge', code(() => X.readDataArchive(nest, 'nest.zip')) === 'toolarge');
  const loose = [{name: 'a.json', data: PACK('Zed', ['A'])}];
  [['a damaged', makeZip([{name: 'x.json', data: PACK('X', ['B']), crc: 1}])],
   ['an encrypted', makeZip([{name: 'x.json', data: PACK('X', ['B']), flags: 1}])],
   ['an unreadable', new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3])]].forEach(([label, z]) => {
    const r = X.readDataArchive(makeZip(loose.concat([{name: 'backup/old.zip', data: Buffer.from(z), method: 0}])), 'o.zip');
    ck(label + ' inner zip that is not an archive is skipped', r.kind === 'loose' && r.packs.map(p => p.name).join() === 'a.json', r);
  });
  const broken = makeZip([{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['z.json'])}, {name: 'z.json', data: PACK('Z', ['A']), crc: 1}]);
  ck('a damaged archive inside the app zip still refuses (it IS an archive)',
     code(() => X.readDataArchive(makeZip([{name: 'data/a.zip', data: Buffer.from(broken), method: 0}]), 'app.zip')) === 'damaged');
});

const B = s => new Uint8Array(Buffer.from(s, 'utf8'));
const names = cat => (X.rules[cat] || []).map(e => e.name);
/* the pool as data, minus the ids the importer hands out */
const poolSnap = () => JSON.stringify([X.RULE_CATS.map(c => (X.rules[c] || []).map(e => {
  const o = Object.assign({}, e); delete o._id; if (c === 'keywords') delete o.id; return o; })),
  X.rules.requires || {}, X.rules.credits || {}]);

section('importing payloads', () => {
  X.resetRules();
  let res = X.importRulesPayloads([{name: 'a.json', bytes: B(PACK('Zed', ['Zap', 'Bolt']))}]);
  ck('a JSON file imports', res.files === 1 && names('spells').join() === 'Zap,Bolt', res);
  X.importRulesPayloads([{name: 'a.json', bytes: B(PACK('Zed', ['Zap']))}]);
  ck('re-importing a file drops what its new copy no longer has (R4)', names('spells').join() === 'Zap', names('spells'));
  X.importRulesPayloads([{name: 'spells.json', bytes: B(PACK('Tasha', ['T1']))}, {name: 'spells.json', bytes: B(PACK('Xan', ['X1']))}]);
  ck('the same file name from another system is left alone', ['Zap', 'T1', 'X1'].every(n => names('spells').includes(n)), names('spells'));
  X.importRulesPayloads([{name: 'spells.json', bytes: B(PACK('Tasha', ['T2']))}]);
  ck('...and re-importing one of them replaces only its own', names('spells').sort().join() === 'T2,X1,Zap', names('spells'));

  /* requires: dropped with the last file that declared it, kept while another file shares the label */
  const HB = (spells, req) => B(JSON.stringify(Object.assign({system: 'HB', spells: spells.map(name => ({name}))},
    req ? {requires: [{spells: ['Nope']}]} : {})));
  X.resetRules();
  X.importRulesPayloads([{name: 'h.json', bytes: HB(['A'], true)}]);
  ck('requires is recorded', !!(X.rules.requires && X.rules.requires.HB));
  X.importRulesPayloads([{name: 'h.json', bytes: HB(['A'], false)}]);
  ck('a re-import that stops declaring requires drops it, when that file alone had the label',
     !(X.rules.requires && X.rules.requires.HB), X.rules.requires);
  X.importRulesPayloads([{name: 'h.json', bytes: HB(['A'], true)}, {name: 'h2.json', bytes: HB(['B'], false)}]);
  X.importRulesPayloads([{name: 'h2.json', bytes: HB(['B'], false)}]);
  ck('a label shared with another file keeps its requires', !!(X.rules.requires && X.rules.requires.HB), X.rules.requires);

  /* failures are named, and nothing half-loads */
  X.resetRules();
  res = X.importRulesPayloads([{name: 'bad.json', bytes: B('{ nope')}, {name: 'list.json', bytes: B('[1,2]')},
    {name: 'gone.json', bytes: null},
    {name: 'locked.zip', bytes: makeZip([{name: 'a.json', data: PACK('Z', ['A']), flags: 1}])},
    {name: 'kit.zip', bytes: makeZip([{name: 'fbdata.py', data: ''}])}]);
  const why = Object.fromEntries(res.failed.map(f => [f.name, f.why]));
  ck('bad JSON: "not valid JSON"', why['bad.json'] === 'not valid JSON', why);
  ck('a JSON list: "not a rules file"', why['list.json'] === 'not a rules file', why);
  ck('an unreadable file: "it couldn\'t be read"', why['gone.json'] === "it couldn't be read", why);
  ck('an encrypted zip: "it\'s password-protected"', why['locked.zip'] === "it's password-protected", why);
  ck('the data kit says it is the kit', /data kit/.test(why['kit.zip'] || ''), why);
  ck('...and nothing was loaded', X.RULE_CATS.every(c => !(X.rules[c] || []).length));

  /* an archive */
  X.resetRules();
  const arc = makeZip([{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['z_full.json', 'y_full.json'])},
    {name: 'y_full.json', data: PACK('Y', ['B'])}, {name: 'z_full.json', data: PACK('Z', ['A'])}]);
  res = X.importRulesPayloads([{name: 'fieldbook-data-standalone-1.8.0.zip', bytes: arc}]);
  ck('an archive imports each pack under its own file name',
     X.loadedRulesGroups().map(g => g.label).sort().join() === 'y_full.json,z_full.json', X.loadedRulesGroups().map(g => g.label));
  ck('...and the summary names the archive, its packs and its version',
     X.importSummary(res) === 'Imported fieldbook-data-standalone-1.8.0.zip: 2 packs, data 1.8.0.', X.importSummary(res));
  const once = poolSnap();
  res = X.importRulesPayloads([{name: 'fieldbook-data-standalone-1.8.0.zip', bytes: arc}]);
  ck('Review focus 2: importing the same archive twice leaves the pool as it was', poolSnap() === once && res.failed.length === 0);
  X.resetRules();
  X.importRulesPayloads([{name: 'z_full.json', bytes: B(PACK('Z', ['A', 'Old']))}]);
  X.importRulesPayloads([{name: 'a.zip', bytes: arc}]);
  ck('the archive replaces the same pack imported loose', names('spells').sort().join() === 'A,B', names('spells'));

  /* Review focus 1: an app zip from 1.7.x */
  X.resetRules();
  const overlay = fs.readFileSync(path.join(ROOT, 'data/overlay.json'));
  const resources = fs.readFileSync(path.join(ROOT, 'data/class-resources.json'));
  res = X.importRulesPayloads([{name: 'fieldbook-v1.7.2.zip', bytes: makeZip([
    {name: 'fieldbook.html', data: '<!doctype html>'}, {name: 'README.md', data: '# Fieldbook'},
    {name: 'scripts/overlay.json', data: overlay}, {name: 'scripts/class-resources.json', data: resources},
    {name: 'data/a_full.json', data: PACK('A', ['One'])}, {name: 'data/b_full.json', data: PACK('B', ['Two'])}])}]);
  ck('Review focus 1: an old app zip loads only its packs, and says so',
     res.failed.length === 0 && X.importSummary(res) === 'Imported fieldbook-v1.7.2.zip: 2 files.' && names('spells').sort().join() === 'One,Two',
     [X.importSummary(res), res.failed]);
  res = X.importRulesPayloads([{name: 'inputs.zip', bytes: makeZip([{name: 'overlay.json', data: overlay}])}]);
  ck('a zip holding no rules pack at all: "there\'s no rules data in it"',
     res.failed.length === 1 && res.failed[0].why === "there's no rules data in it", res.failed);
  X.resetRules();
});

section('Import files: the status lines', async () => {
  const writes = [];
  const el = id => {
    const o = {className: '', _t: ''};
    Object.defineProperty(o, 'textContent', {get() { return o._t; }, set(v) { o._t = v; writes.push(id + ': ' + v); }});
    return o;
  };
  const els = {rulesStatus: el('rulesStatus'), homeRulesStatus: el('homeRulesStatus')};
  const getById = ctx.document.getElementById;
  ctx.document.getElementById = id => els[id] || getById(id);
  const hadFR = 'FileReader' in ctx;
  ctx.FileReader = class {
    readAsArrayBuffer(f) {
      if (f.fail) { if (this.onerror) this.onerror(); return; }
      const b = Buffer.from(f.bytes);
      this.result = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      if (this.onload) this.onload();
    }
  };
  const file = (name, s) => ({name, bytes: Buffer.from(s, 'utf8')});
  try {
    X.resetRules(); writes.length = 0;
    const p = X.importRulesFiles([file('a.json', PACK('Zed', ['Zap']))]);
    ck('Review focus 3: "Reading 1 file…" shows at once, on both lines',
       writes[0] === 'rulesStatus: Reading 1 file…' && writes[1] === 'homeRulesStatus: Reading 1 file…', writes);
    const out = await p;
    ck('a good import says what it merged, as ok', /^Merged 1 file\. Loaded/.test(out.msg) && out.cls === 'ok', out);
    ck('...on the home screen too', els.homeRulesStatus.textContent === out.msg, els.homeRulesStatus.textContent);
    const bad = await X.importRulesFiles([file('broken.json', '{ nope'), {name: 'gone.json', fail: true}]);
    ck('a failure is named with its reason',
       /Couldn't import broken\.json: not valid JSON\./.test(bad.msg) && /Couldn't import gone\.json: it couldn't be read\./.test(bad.msg)
       && bad.cls === 'err', bad);
    /* moved from rules-data.js (#71) */
    X.resetRules();
    const sk = await X.importRulesFiles([file('hb.json', JSON.stringify({system: 'HB',
      keywords: [{text: 'no term'}, {term: 'Kept'}], spells: [{level: 1}, {name: 'Zap'}]}))]);
    ck('#71 importing a file says what it skipped',
       /skipped/i.test(sk.msg) && /1 glossary entry/.test(sk.msg) && /1 spell/.test(sk.msg), sk.msg);
    ck('#71 ...and the rest of it loaded', (X.rules.keywords || []).length === 1 && (X.rules.spells || []).length === 1);
    X.resetRules();
    const clean = await X.importRulesFiles([file('ok.json', PACK('HB', ['Zap']))]);
    ck('#71 ...and a clean file says nothing about skipping', !/skipped/i.test(clean.msg) && clean.cls === 'ok', clean);
    /* the storage rule: a cache write that does not land is said on the same line */
    state.quotaFull = true;
    const full = await X.importRulesFiles([file('q.json', PACK('Q', ['Q1']))]);
    state.quotaFull = false;
    ck('a cache save that fails is reported on both import lines',
       full.cls === 'err' && /wouldn't save/.test(full.msg) && /wouldn't save/.test(els.homeRulesStatus.textContent), full);
  } finally {
    ctx.document.getElementById = getById;
    if (!hadFR) delete ctx.FileReader;
    X.resetRules();
  }
});

section('every rules picker takes a zip', () => {
  const src = ['src/fieldbook.template.html', 'src/html/40-rules.html', 'src/js/88-settings.js']
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  ['homeRulesFiles', 'rbRulesFiles'].forEach(id => {
    const m = new RegExp('id="' + id + '" accept="([^"]*)"').exec(src);
    const acc = m ? m[1].split(',') : [];
    ck('Review focus 4: ' + id + ' accepts .json, .zip, application/zip and application/x-zip-compressed',
       ['.json', '.zip', 'application/zip', 'application/x-zip-compressed'].every(t => acc.includes(t)), m && m[1]);
  });
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  ck('the home import no longer overwrites its own status line on a timer',
     !/homeRulesFiles[^\n]*setTimeout/.test(boot), (/homeRulesFiles[^\n]*/.exec(boot) || [])[0]);
});

section('pack credits', () => {
  const HBC = {system: 'Homebrew', name: 'Homebrew', license: 'CC-BY-SA-3.0',
               attribution: 'The Predator, by someone. Changed: converted.', spells: [{name: 'Zap'}]};
  X.resetRules();
  X.mergeRules(HBC, 'homebrew_full.json');
  ck('a pack\'s licence and credit are kept per source',
     JSON.stringify(X.rules.credits.Homebrew) === JSON.stringify({title: 'Homebrew', license: 'CC-BY-SA-3.0',
       attribution: 'The Predator, by someone. Changed: converted.'}), X.rules.credits);
  X.resetRules();
  X.mergeRules({system: 'Long', license: 'x'.repeat(65), attribution: 'y'.repeat(2500), spells: [{name: 'A'}]}, 'l.json');
  ck('an over-long licence is dropped, and a credit is cut to 2,000',
     X.rules.credits.Long.license === '' && X.rules.credits.Long.attribution.length === 2000, X.rules.credits.Long);
  X.resetRules();
  X.mergeRules({system: 'Plain', spells: [{name: 'A'}]}, 'p.json');
  ck('a pack with neither has no credit', !X.rules.credits || !X.rules.credits.Plain);

  /* lifecycle */
  X.resetRules();
  X.importRulesPayloads([{name: 'h.json', bytes: B(JSON.stringify(HBC))}]);
  X.importRulesPayloads([{name: 'h.json', bytes: B(JSON.stringify({system: 'Homebrew', spells: [{name: 'Zap'}]}))}]);
  ck('a re-import without a credit drops it', !X.rules.credits.Homebrew, X.rules.credits);
  X.importRulesPayloads([{name: 'h.json', bytes: B(JSON.stringify(HBC))}]);
  X.removeRulesGroup(X.loadedRulesGroups().find(g => g.label === 'h.json').key);
  ck('removing the pack prunes its credit', !X.rules.credits.Homebrew, X.rules.credits);
  X.importRulesPayloads([{name: 'h.json', bytes: B(JSON.stringify(HBC))}]);
  state.confirm = true;
  X.clearAllRules();
  ck('clearing everything clears credits', JSON.stringify(X.rules.credits) === '{}', X.rules.credits);

  /* settings files carry them */
  X.resetRules();
  X.mergeRules(HBC, 'homebrew_full.json');
  const saved = JSON.parse(JSON.stringify(X.rules));
  saved.credits.Ghost = {title: 'Gone', license: 'MIT', attribution: 'Nobody'};
  saved.credits.Junk = 'not an object';
  const built = X.poolFromExport(saved);
  ck('a settings file\'s pool keeps the credits of the packs it holds',
     !!built.pool.credits && !!built.pool.credits.Homebrew && built.pool.credits.Homebrew.license === 'CC-BY-SA-3.0', built.pool.credits);
  ck('...and none for labels it doesn\'t hold, or junk', !built.pool.credits.Ghost && !built.pool.credits.Junk, built.pool.credits);

  /* an old or broken cache */
  X.resetRules();
  delete X.rules.credits;
  ck('a pool from before credits renders no credits list', X.rulesCreditsHTML() === '');
  X.prunePackMeta();
  ck('...and prunes without throwing', true);
  X.rules.credits = 'junk';
  X.reindexRules();
  ck('a credits value that isn\'t an object is reset by the tidy', JSON.stringify(X.rules.credits) === '{}', X.rules.credits);

  /* shown escaped */
  X.resetRules();
  X.mergeRules({system: 'Evil', name: '<b>Evil</b>', license: 'CC-BY-4.0', attribution: '<img src=x onerror=alert(1)>', spells: [{name: 'A'}]}, 'e.json');
  X.mergeRules({system: 'Odd', license: 'Custom-1', attribution: 'Ours.', spells: [{name: 'B'}]}, 'o.json');
  const html = X.rulesCreditsHTML();
  ck('credits are escaped, never markup', !/<img/.test(html) && html.includes('&lt;img') && html.includes('&lt;b&gt;Evil'), html);
  ck('a known licence links its deed', html.includes('href="https://creativecommons.org/licenses/by/4.0/"'), html);
  ck('an unknown licence is plain text', html.includes('Licence: Custom-1.') && !/href="[^"]*Custom/.test(html), html);

  /* the shipped Homebrew bundle carries its credit through an import */
  const hb = path.join(ROOT, 'dist', 'homebrew_full.json');
  if (fs.existsSync(hb)) {
    X.resetRules();
    X.importRulesPayloads([{name: 'homebrew_full.json', bytes: new Uint8Array(fs.readFileSync(hb))}]);
    ck('the Homebrew bundle\'s credit reaches Settings',
       /CC-BY-SA-3\.0/.test(X.rulesCreditsHTML()) && /D&amp;D Wiki/.test(X.rulesCreditsHTML()), X.rulesCreditsHTML());
  } else console.log('note: dist/homebrew_full.json missing (run.sh bundles first), its credit check skipped');
  X.resetRules();
});

section('round trip: the built archive imports exactly like the bundles', () => {
  if (!PY) { console.log('note: no python3, round trip skipped'); return; }
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/packs.json'), 'utf8'));
  const present = reg.packs.filter(p => fs.existsSync(path.join(ROOT, 'dist', p.file)));
  ck('the bundles exist (run.sh bundles first)', present.length > 0);
  const dir = tmpDir(), zip = path.join(dir, 'a.zip');
  const r = spawnSync(PY, [path.join(ROOT, 'tools/data-kit/fbdata.py'), 'pack', path.join(ROOT, 'dist'), '-o', zip], {encoding: 'utf8'});
  ck('fbdata.py pack ran', r.status === 0, r.stderr);
  if (r.status === 0) {
    X.resetRules();
    const res = X.importRulesPayloads([{name: 'a.zip', bytes: new Uint8Array(fs.readFileSync(zip))}]);
    ck('the archive imported every pack', res.failed.length === 0 && res.archives[0].count === present.length, res);
    const viaZip = poolSnap();
    X.resetRules();
    present.forEach(p => X.importRulesPayloads([{name: p.file, bytes: new Uint8Array(fs.readFileSync(path.join(ROOT, 'dist', p.file)))}]));
    ck('the pool equals importing the bundles one by one', poolSnap() === viaZip);
  }
  fs.rmSync(dir, {recursive: true, force: true});
  X.resetRules();
});

section('zips from other tools', () => {
  if (!PY) console.log('note: no python3, Python zipfile cases skipped');
  else {
    const dir = tmpDir();
    const script = [
      'import json, sys, zipfile',
      'out, method = sys.argv[1], int(sys.argv[2])',
      'with zipfile.ZipFile(out, "w", compression=method) as z:',
      '    z.writestr("packs/a.json", json.dumps({"system": "Py", "spells": [{"name": "Alpha"}]}))',
      '    z.writestr("packs/b.json", json.dumps({"system": "Py", "feats": [{"name": "Beta"}]}))',
    ].join('\n');
    [[0, 'stored'], [8, 'deflated']].forEach(([m, label]) => {
      const out = path.join(dir, label + '.zip');
      const r = spawnSync(PY, ['-c', script, out, String(m)], {encoding: 'utf8'});
      const arc = r.status === 0 ? X.readDataArchive(new Uint8Array(fs.readFileSync(out)), label + '.zip') : null;
      ck('Python zipfile, ' + label + ': read as loose packs',
         !!arc && arc.kind === 'loose' && arc.packs.map(p => p.name).join() === 'a.json,b.json', r.stderr || arc);
    });
    fs.rmSync(dir, {recursive: true, force: true});
  }
  if (spawnSync('zip', ['-v'], {stdio: 'ignore'}).status !== 0) { console.log('note: no zip tool, the zip -9 case skipped'); return; }
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'in'));
  const body = JSON.stringify({system: 'Zip', spells: Array.from({length: 2000}, (_, i) => ({name: 'Spell ' + i, text: 'Lorem ipsum '.repeat(20)}))});
  fs.writeFileSync(path.join(dir, 'in', 'big.json'), body);
  const r = spawnSync('zip', ['-9', '-q', '-r', 'z.zip', 'in'], {cwd: dir});
  const arc = r.status === 0 ? X.readDataArchive(new Uint8Array(fs.readFileSync(path.join(dir, 'z.zip'))), 'z.zip') : null;
  ck('zip -9: the deflated entry inflates byte for byte', !!arc && Buffer.from(arc.packs[0].bytes).toString('utf8') === body);
  fs.rmSync(dir, {recursive: true, force: true});
});

section('the newer-data notice', async () => {
  const rel = (tag, extra = {}) => Object.assign({tag_name: tag, draft: false, prerelease: false,
    html_url: 'https://github.com/x/y/releases/tag/' + tag,
    assets: [{name: 'fieldbook-data-standalone-' + X.dataVerOfTag(tag) + '.zip'}]}, extra);
  const P = list => X.pickDataRelease(list, '1.8.0');
  ck('picks the newest data release for this app', (P([rel('v1.8.0'), rel('data-v1.8.0-1'), rel('data-v1.8.0-2')]) || {}).version === '1.8.0-2');
  ck('-10 beats -9', (P([rel('data-v1.8.0-9'), rel('data-v1.8.0-10')]) || {}).version === '1.8.0-10');
  ck('an app release carrying the archive counts', (P([rel('v1.8.0')]) || {}).tag === 'v1.8.0');
  ck('data built for a newer app is skipped', (P([rel('data-v1.8.0-1'), rel('data-v1.9.0-1'), rel('v1.9.0')]) || {}).version === '1.8.0-1');
  ck('drafts and pre-releases are skipped', P([rel('data-v1.8.0-1', {draft: true}), rel('data-v1.8.0-2', {prerelease: true})]) === null);
  ck('a release without the archive is skipped', P([rel('v1.7.2', {assets: [{name: 'fieldbook.html'}]})]) === null);
  ck('junk tags are skipped', P([rel('nightly'), rel('data-v1.8.0'), {tag_name: 7}, null]) === null);
  ck('not a list (a rate-limit reply): null', X.pickDataRelease({message: 'API rate limit exceeded'}, '1.8.0') === null && X.pickDataRelease(null, '1.8.0') === null);
  ck('a page off github.com falls back to the releases page',
     /^https:\/\/github\.com\/.+\/releases$/.test(P([rel('data-v1.8.0-1', {html_url: 'https://evil.example/x'})]).url));

  const pick = {tag: 'data-v1.8.0-1', version: '1.8.0-1', url: 'https://github.com/x/y/releases/tag/data-v1.8.0-1'};
  const up = X.dataUpdateFrom({release: '1.8.0-1', packs: [
    {system: 'XPHB', file: 'rulebook_full.json', version: '1.8.0-1'}, {system: 'Bad', file: '../evil.json', version: '1.8.0-1'},
    {system: 'Bad2', file: 'x.json', version: 'v9'}, {system: '', file: 'y.json', version: '1.8.0'}, null]}, pick);
  ck('dataUpdateFrom keeps only well-formed packs', !!up && up.packs.length === 1 && up.packs[0].system === 'XPHB' && up.release === '1.8.0-1', up);
  ck('dataUpdateFrom: no packs, no registry or no pick is null',
     X.dataUpdateFrom({packs: []}, pick) === null && X.dataUpdateFrom(null, pick) === null
     && X.dataUpdateFrom({packs: [{system: 'A', file: 'a.json', version: '1.8.0'}]}, null) === null);

  /* the row, the hint and the badge, on a system this build has a baseline
     for, read from DATA_VERSIONS rather than named: each release retakes it */
  const sys = Object.keys(X.DATA_VERSIONS)[0], base = X.DATA_VERSIONS[sys];
  const g = () => X.loadedRulesGroups()[0];
  const load = (v, file) => { X.resetRules(); X.mergeRules({system: sys, rulebook: true, dataVersion: v, races: [{name: 'Elf'}]}, file || 'rulebook_full.json'); };
  load(base);
  X.dataUpdate = {release: base + '-1', url: 'https://github.com/x/y/releases/tag/data-v' + base + '-1',
                  packs: [{system: sys, file: 'rulebook_full.json', version: base + '-1'}]};
  ck('a newer data release makes the row "update"', X.dataStatus(g()).state === 'update', X.dataStatus(g()));
  const chip = X.dataStatusHTML(g());
  ck('...shown muted, naming both versions', /class="rd-src"/.test(chip) && chip.includes('v' + base + '-1 out') && !/update available/.test(chip), chip);
  const list = X.rulesDataHTML();
  ck('...a hint above the list links the release',
     list.includes('Newer rules data is out: ' + sys + ' v' + base + '-1.') && list.includes('href="https://github.com/x/y/releases/tag/data-v'), list.slice(0, 400));
  ck('...and the Settings count says so', / · update$/.test(X.rulesBadge()), X.rulesBadge());
  load(base, 'my-phb.json');
  ck('a pack loaded under another file name gets no notice', X.dataStatus(g()).state === 'current');
  load('1.0.0');
  ck('a pack behind the app is still "stale", amber', X.dataStatus(g()).state === 'stale' && /update available/.test(X.dataStatusHTML(g())));
  load(base);
  X.importRulesPayloads([{name: 'rulebook_full.json', bytes: B(JSON.stringify({system: sys, rulebook: true, dataVersion: base + '-1', races: [{name: 'Elf'}]}))}]);
  ck('Review focus 5: importing the newer copy flips the row to current and drops the hint and badge',
     X.dataStatus(g()).state === 'current' && !/Newer rules data is out/.test(X.rulesDataHTML()) && !/update/.test(X.rulesBadge()),
     [X.dataStatus(g()), X.rulesBadge()]);

  /* the network: the releases list, then that tag's registry; silent on failure */
  const calls = [];
  const reply = body => Promise.resolve({ok: true, json: () => Promise.resolve(body)});
  const savedFetch = ctx.fetch, savedOnline = ctx.navigator.onLine;
  try {
    ctx.navigator.onLine = true;
    X.dataUpdate = null;
    ctx.fetch = url => { calls.push(url); return url.includes('api.github.com')
      ? reply([rel('data-v' + X.APP_VERSION + '-1')])
      : reply({release: X.APP_VERSION + '-1', packs: [{system: sys, file: 'rulebook_full.json', version: X.APP_VERSION + '-1'}]}); };
    const got = await X.checkForDataUpdate();
    ck('checkForDataUpdate lists releases, then reads that tag\'s registry',
       calls.length === 2 && /api\.github\.com\/repos\/.+\/releases\?per_page=100$/.test(calls[0])
       && /^https:\/\/raw\.githubusercontent\.com\/.+\/data-v[\d.]+-1\/data\/packs\.json$/.test(calls[1]), calls);
    ck('...and sets dataUpdate', !!got && !!X.dataUpdate && X.dataUpdate.release === X.APP_VERSION + '-1', X.dataUpdate);
    X.dataUpdate = null;
    ctx.fetch = () => Promise.reject(new Error('offline'));
    const none = await X.checkForDataUpdate();
    ck('a failed check is silent and changes nothing', none === null && X.dataUpdate === null);
    ctx.navigator.onLine = false; calls.length = 0;
    ctx.fetch = url => { calls.push(url); return reply([]); };
    await X.checkForDataUpdate();
    ck('offline, it doesn\'t try', calls.length === 0);
  } finally {
    ctx.fetch = savedFetch; ctx.navigator.onLine = savedOnline;
    X.dataUpdate = null; X.resetRules();
  }
  ck('boot runs the data check after the app check',
     /checkForUpdate\(\);\s*checkForDataUpdate\(\);/.test(fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8')));
});

section('final review 1: a silent import also toasts, from the Rules tab', async () => {
  const getById = ctx.document.getElementById;
  const savedToast = ctx.toast;
  const toasts = [], toastOpts = [];
  ctx.toast = (msg, action, opts) => { toasts.push(msg); toastOpts.push(opts || {}); };
  const hadFR = 'FileReader' in ctx;
  ctx.FileReader = class {
    readAsArrayBuffer(f) {
      const b = Buffer.from(f.bytes);
      this.result = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      if (this.onload) this.onload();
    }
  };
  const file = (name, s) => ({name, bytes: Buffer.from(s, 'utf8')});
  const hiddenHome = {offsetParent: null, _t: ''};
  Object.defineProperty(hiddenHome, 'textContent', {get() { return hiddenHome._t; }, set(v) { hiddenHome._t = v; }});
  try {
    /* the Rules tab's own import links: Settings isn't open (no #rulesStatus)
       and the home screen is behind the sheet (#homeRulesStatus hidden) */
    ctx.document.getElementById = id => id === 'homeRulesStatus' ? hiddenHome : (id === 'rulesStatus' ? null : getById(id));
    X.resetRules(); toasts.length = 0; toastOpts.length = 0;
    const out = await X.importRulesFiles([file('a.json', PACK('Zed', ['Zap']))]);
    ck('an import with neither status line on screen raises one toast', toasts.length === 1, toasts);
    /* #87: the toast says what happened, never the counts — those are on the
       status lines and the Rules tab, and they filled a phone's toast */
    ck('#87 a clean import toasts one short line, without the counts',
       toasts[0] === 'Merged 1 file.' && !toastOpts[0].err && /Loaded/.test(out.msg), [toasts[0], out.msg]);

    X.resetRules(); toasts.length = 0; toastOpts.length = 0;
    await X.importRulesFiles([file('good.json', PACK('Zed', ['Zap'])), file('bad.json', '{nope')]);
    ck('#87 a failed file toasts its failure, without the counts, as an error that stays',
       /Couldn't import bad\.json/.test(toasts[0]) && !/Loaded|spells ·|races/.test(toasts[0]) && toastOpts[0].err === true,
       [toasts[0], toastOpts[0]]);

    X.resetRules(); toasts.length = 0; toastOpts.length = 0;
    await X.importRulesFiles([file('needs.json', JSON.stringify({system: 'Needy', spells: [{name: 'Zap'}],
      requires: [{pack: 'Elsewhere', spells: ['Not Loaded']}]}))]);
    ck('#87 a notice (content it refers to isn\'t loaded) toasts for longer, but is not an error',
       /refers to content that isn't loaded/.test(toasts[0]) && !toastOpts[0].err && toastOpts[0].long === true,
       [toasts[0], toastOpts[0]]);

    X.resetRules(); toasts.length = 0; toastOpts.length = 0;
    state.quotaFull = true;
    await X.importRulesFiles([file('q.json', PACK('Q', ['Q1']))]);
    state.quotaFull = false;
    const last = toasts.length - 1;
    ck('#87 a save that does not land toasts as an error that stays, still without the counts (the storage rule)',
       /wouldn't save/.test(toasts[last]) && !/Loaded:|races ·/.test(toasts[last]) && toastOpts[last].err === true,
       [toasts, toastOpts]);

    const shownRules = {offsetParent: {}, _t: ''};
    Object.defineProperty(shownRules, 'textContent', {get() { return shownRules._t; }, set(v) { shownRules._t = v; }});
    ctx.document.getElementById = id => id === 'rulesStatus' ? shownRules : (id === 'homeRulesStatus' ? null : getById(id));
    X.resetRules(); toasts.length = 0;
    await X.importRulesFiles([file('b.json', PACK('Zed', ['Zap']))]);
    ck('...but not when #rulesStatus (Settings) is present', toasts.length === 0, toasts);
  } finally {
    ctx.document.getElementById = getById;
    ctx.toast = savedToast;
    if (!hadFR) delete ctx.FileReader;
    X.resetRules();
  }
});

section('#87 toast(): an error stays until it is tapped; every other toast is unchanged', () => {
  const getById = ctx.document.getElementById, mk = ctx.document.createElement, savedST = ctx.setTimeout;
  const fakeEl = () => {
    const cls = new Set(), attrs = {}, kids = [], ls = {};
    return {cls, attrs, kids, ls, textContent: '', onclick: null,
      classList: {add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, f) => (f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c),
                  contains: c => cls.has(c)},
      setAttribute: (k, v) => { attrs[k] = v; }, append: (...a) => kids.push(...a),
      addEventListener: (t, f) => { ls[t] = f; }, matches: () => false, contains: () => false};
  };
  const el = fakeEl();
  const timers = [];
  try {
    ctx.document.getElementById = id => id === 'toast' ? el : getById(id);
    ctx.document.createElement = () => fakeEl();
    ctx.setTimeout = (f, ms) => { timers.push(ms); return 1; };
    ctx.toast("Couldn't import bad.json: not valid JSON.", null, {err: true});
    ck('an error toast shows in the error style, as an alert', el.cls.has('show') && el.cls.has('err') && el.attrs.role === 'alert', [...el.cls, el.attrs]);
    ck('...schedules no auto-hide', timers.length === 0, timers);
    ck('...and can be dismissed: a Dismiss button, and a tap anywhere on it',
       el.kids.some(k => k && k.textContent === 'Dismiss') && typeof el.onclick === 'function', el.kids.map(k => k && k.textContent));
    el.onclick();
    ck('...a tap hides it', !el.cls.has('show'));
    timers.length = 0; el.kids.length = 0;
    ctx.toast('Cast Fireball');
    ck('a plain toast after it loses the error style and hides after 1.9 s as before',
       !el.cls.has('err') && el.attrs.role === 'status' && el.onclick === null && timers[0] === 1900, [...el.cls, el.attrs, timers]);
    timers.length = 0;
    ctx.toast('Imported x.zip: 2 packs. Homebrew refers to content that isn\'t loaded.', null, {long: true});
    ck('a long notice stays 6 s, like a toast with an action', timers[0] === 6000 && !el.cls.has('err'), timers);
  } finally {
    ctx.document.getElementById = getById; ctx.document.createElement = mk; ctx.setTimeout = savedST;
  }
});

section('final review 5: a pack that throws during merge is named, not fatal', () => {
  const savedMerge = ctx.mergeRules;
  X.resetRules();
  ctx.mergeRules = function (obj, fileName, url) {
    if (fileName === 'bad.json' || fileName === 'z.json') throw new Error('boom');
    return savedMerge(obj, fileName, url);
  };
  try {
    const res = X.importRulesPayloads([
      {name: 'ok.json', bytes: B(PACK('Zed', ['Zap']))},
      {name: 'bad.json', bytes: B(PACK('Boom', ['X']))},
    ]);
    ck('the other file still imports and the failure is named "not a rules file"',
       res.failed.length === 1 && res.failed[0].name === 'bad.json' && res.failed[0].why === 'not a rules file'
       && res.files === 1 && names('spells').join() === 'Zap', res);

    X.resetRules();
    const arcBad = makeZip([{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['z.json'])}, {name: 'z.json', data: PACK('Boom', ['A'])}]);
    const res2 = X.importRulesPayloads([{name: 'arc.zip', bytes: arcBad}]);
    ck('a throwing pack inside an archive is named "<pack> in <zip>"',
       res2.failed.length === 1 && res2.failed[0].name === 'z.json in arc.zip' && res2.failed[0].why === 'not a rules file', res2);
  } finally {
    ctx.mergeRules = savedMerge;
    X.resetRules();
  }
});

section('final review 5b: an exception after import still ends the status line', async () => {
  const hadFR = 'FileReader' in ctx;
  ctx.FileReader = class {
    readAsArrayBuffer(f) {
      const b = Buffer.from(f.bytes);
      this.result = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      if (this.onload) this.onload();
    }
  };
  const savedRefresh = ctx.refreshRulesUI;
  ctx.refreshRulesUI = () => { throw new Error('boom after import'); };
  X.resetRules();
  const file = (name, s) => ({name, bytes: Buffer.from(s, 'utf8')});
  try {
    const out = await X.importRulesFiles([file('a.json', PACK('Zed', ['Zap']))]);
    ck('a throw downstream of importRulesPayloads() still resolves, with a red status line',
       out.cls === 'err' && /^Import failed: boom after import/.test(out.msg), out);
  } finally {
    ctx.refreshRulesUI = savedRefresh;
    if (!hadFR) delete ctx.FileReader;
    X.resetRules();
  }
});

section('final review 9: a manifest listing too many files is refused', () => {
  const manifest = MANIFEST('1.8.0', Array.from({length: 1001}, (_, i) => 'p' + i + '.json'));
  ck('a manifest claiming 1,001 files: toomany',
     code(() => X.readDataArchive(makeZip([{name: 'fieldbook-data.json', data: manifest}]), 'big.zip')) === 'toomany');
});

// ---------- #102: sha256Hex
section('#102 sha256Hex', () => {
  const crypto = require('crypto');
  const hex = b => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
  const big = new Uint8Array(1024 * 1024); for (let i = 0; i < big.length; i++) big[i] = (i * 31 + 7) & 255;
  [[], [0x61, 0x62, 0x63], Array.from({length: 55}, () => 0x61), Array.from({length: 56}, () => 0x61), Array.from({length: 64}, () => 0x62)]
    .forEach(a => ck('#102 sha256Hex of ' + a.length + ' bytes matches Node', X.sha256Hex(new Uint8Array(a)) === hex(a)));
  ck('#102 sha256Hex of 1 MB matches Node', X.sha256Hex(big) === hex(big));
  ck('#102 sha256Hex reads a view at an offset', X.sha256Hex(new Uint8Array(big.buffer, 10, 100)) === hex(big.subarray(10, 110)));
});

// ---------- #102: reading a manifest
section('#102 readManifest', () => {
  const pk = o => Object.assign({file: 'srd52_full.json', system: 'SRD 5.2', version: '1.9.0', sha256: 'a'.repeat(64)}, o);
  const m = X.readManifest({_type: 'fieldbook-data', format: 2, name: 'N', homepage: 'https://x.org', version: '1.9.0', builtFor: '1.9.0',
    packs: [pk({title: 'SRD', summary: 's'.repeat(500), description: 'd'.repeat(9000), requires: [{pack: 'X', url: 'javascript:alert(1)'}, {pack: 'Y', url: 'https://y.org'}]})]}, 900);
  const e = m.packs[0];
  ck('#102 a format-2 manifest reads', m.name === 'N' && m.homepage === 'https://x.org' && e.system === 'SRD 5.2' && e.file === 'srd52_full.json', m);
  ck('#102 category defaults to rules, minApp to builtFor', e.category === 'rules' && e.minApp === '1.9.0');
  ck('#102 summary is cut to 140 and description to 4,000', e.summary.length === 140 && e.description.length === 4000);
  ck('#102 a requires url that isn\'t http(s) becomes ""', e.requires[0].url === '' && e.requires[1].url === 'https://y.org', e.requires);
  const m1 = X.readManifest({_type: 'fieldbook-data', format: 1, version: '1.8.1', builtFor: '1.8.1', packs: [{file: 'a_full.json', system: 'A', version: '1.8.0', sha256: 'b'.repeat(64)}]}, 200);
  ck('#102 a format-1 manifest (today\'s zip) reads with defaults', m1.packs[0].title === 'A' && m1.packs[0].minApp === '1.8.1' && m1.packs[0].summary === '');
  ck('#102 a homepage that isn\'t http(s) becomes ""', X.readManifest({_type: 'fieldbook-data', homepage: 'javascript:x', packs: []}, 50).homepage === '');
  ['../x_full.json', '/abs_full.json', 'https://evil.org/x_full.json', 'a\\b_full.json', 'dir/../x_full.json', 'x.txt', '',
   '%2e%2e/x_full.json', 'a/%2E%2E/x_full.json', './x_full.json', 'a//x_full.json',
   'a/.\t./x_full.json', '.\n./x_full.json', 'a/.\r./x_full.json', 'a b/x_full.json', 'a/x_full.json?q=1', 'a/x_full.json#f']
    .forEach(f => ck('#102 an unsafe or non-json path is dropped: ' + JSON.stringify(f),
      X.readManifest({_type: 'fieldbook-data', packs: [pk({file: f})]}, 100).packs.length === 0));
  ck('#102 a path in a folder keeps its base name as the file',
    X.readManifest({_type: 'fieldbook-data', packs: [pk({file: 'packs/srd52_full.json'})]}, 100).packs[0].file === 'srd52_full.json');
  ck('#102 a pack with no version is dropped', X.readManifest({_type: 'fieldbook-data', packs: [pk({version: 'x'})]}, 100).packs.length === 0);
  const dup = X.readManifest({_type: 'fieldbook-data', packs: [pk({version: '1.8.0'}), pk({version: '1.9.0'}), pk({version: '1.8.5'})]}, 100);
  ck('#102 the same system|file twice keeps the newest', dup.packs.length === 1 && dup.packs[0].version === '1.9.0');
  const thrown = (o, n) => { try { X.readManifest(o, n); return ''; } catch (e) { return e.message; } };
  ck('#102 not a manifest throws', /isn't a Fieldbook manifest/.test(thrown({packs: []}, 10)));
  ck('#102 over 64 KB throws', /larger than 64 KB/.test(thrown({_type: 'fieldbook-data', packs: []}, 65537)));
  ck('#102 over 1,000 packs throws', /more than 1,000/.test(thrown({_type: 'fieldbook-data', packs: Array.from({length: 1001}, () => pk({}))}, 100)));
  ck('#102 extUrl keeps http(s) only', X.extUrl('https://a') === 'https://a' && X.extUrl('HTTP://a') === 'HTTP://a' && X.extUrl('javascript:x') === '' && X.extUrl(7) === '');
});

// ---------- #102: settings conversion
section('#102 convertSources', () => {
  const s = {rulesSources: ['https://a.org/x.json', ' https://b.org/y.json '], rulesUrl: 'https://c.org/z.json'};
  ck('#102 the first conversion reports a change', X.convertSources(s) === true);
  ck('#102 the official source exists once, first, on', s.sources.filter(x => x.kind === 'official').length === 1 && s.sources[0].id === 'official' && s.sources[0].on === true, s.sources);
  ck('#102 rulesSources and rulesUrl become plain sources, trimmed',
    JSON.stringify(s.sources.filter(x => x.kind === 'plain').map(x => x.url)) === JSON.stringify(['https://a.org/x.json', 'https://b.org/y.json', 'https://c.org/z.json']));
  ck('#102 the old fields are gone', !('rulesSources' in s) && !('rulesUrl' in s));
  ck('#102 packOrigin and dismissedUpdates default to {}', JSON.stringify(s.packOrigin) === '{}' && JSON.stringify(s.dismissedUpdates) === '{}');
  const before = JSON.stringify(s);
  ck('#102 a second conversion changes nothing', X.convertSources(s) === false && JSON.stringify(s) === before);
  const junk = {sources: [null, {kind: 'weird'}, {kind: 'manifest', url: 'javascript:x'}, {kind: 'official'}, {kind: 'official'}]};
  X.convertSources(junk);
  ck('#102 malformed sources are dropped, and two officials become one', junk.sources.length === 1 && junk.sources[0].kind === 'official', junk.sources);
});

// ---------- #102: offers, row states, the pill count and dismissal
section('#102 offers and rows', () => {
  X.resetRules();
  const loadPack = (system, file, ver) => X.importPack({system, dataVersion: ver, spells: [{name: system + ' Spell', level: 1}]}, file);
  loadPack('SRD 5.2', 'srd52_full.json', '1.8.1');
  loadPack('Homebrew', 'homebrew_full.json', '1.2.0');
  const man = (packs, extra) => X.readManifest(Object.assign({_type: 'fieldbook-data', builtFor: '1.0.0', packs}, extra || {}), 100);
  const e = (system, file, version, o) => Object.assign({file, system, version, sha256: 'c'.repeat(64)}, o || {});
  X.settings.sources = [
    {id: 'official', kind: 'official', url: '', on: true, checked: 1, error: '', base: 'https://raw.example/fieldbook-data.json',
      manifest: man([e('SRD 5.2', 'srd52_full.json', '1.9.0'), e('Homebrew', 'homebrew_full.json', '1.2.0')])},
    {id: 's2', kind: 'manifest', url: 'https://ember.example/m.json', on: true, checked: 1, error: '', base: 'https://ember.example/m.json',
      manifest: man([e('Ember', 'ember_full.json', '2.1.0', {minApp: '99.0.0'}), e('Ember Theme', 'ember_ui.json', '1.0.0', {category: 'ui'}),
                     e('SRD 5.2', 'srd52_full.json', '1.9.5')])},
    {id: 's3', kind: 'manifest', url: 'https://off.example/m.json', on: false, checked: 1, error: '', base: 'https://off.example/m.json',
      manifest: man([e('Off', 'off_full.json', '1.0.0')])}];
  X.settings.packOrigin = {'SRD 5.2|srd52_full.json': 'official'};
  X.settings.dismissedUpdates = {};
  ck('#102 offers come from enabled sources only', !X.extOffers().some(o => o.entry.system === 'Off'));
  ck('#102 the installing source wins over a newer offer elsewhere', X.availableFor('SRD 5.2', 'srd52_full.json').source.id === 'official');
  X.settings.packOrigin = {};
  ck('#102 with no installing source, the newest offer wins', X.availableFor('SRD 5.2', 'srd52_full.json').entry.version === '1.9.5');
  X.settings.packOrigin = {'SRD 5.2|srd52_full.json': 'official'};
  const rows = X.extPackRows(), by = k => rows.find(r => r.key === k);
  ck('#102 a newer offer is an update', by('SRD 5.2|srd52_full.json').state === 'update');
  ck('#102 the same version is current', by('Homebrew|homebrew_full.json').state === 'current');
  ck('#102 an offer too new for this app is blocked', by('Ember|ember_full.json').state === 'blocked' && X.extTooNew(by('Ember|ember_full.json').offer.entry));
  ck('#102 an unknown category is unsupported', by('Ember Theme|ember_ui.json').state === 'unsupported');
  ck('#102 the pill counts updates', X.extPillCount() === 1 && X.extUpdateRows().length === 1);
  X.dismissUpdates();
  ck('#102 dismissal: the pill hides, the update stays on the row', X.extPillCount() === 0 && X.extUpdateRows().length === 1);
  X.settings.sources[0].manifest = man([e('SRD 5.2', 'srd52_full.json', '1.9.0')]);
  ck('#102 dismissal: the same version never brings it back', X.extPillCount() === 0);
  X.settings.sources[0].manifest = man([e('SRD 5.2', 'srd52_full.json', '1.9.1')]);
  ck('#102 dismissal: a newer version brings it back', X.extPillCount() === 1);
  // #102 fix round 1: unversioned loaded data (predates versioning, #83) reads as an update
  // against a versioned offer, rather than never matching "current" and getting stuck
  loadPack('Legacy', 'legacy_full.json', undefined);
  X.settings.sources.push({id: 's4', kind: 'manifest', url: 'https://legacy.example/m.json', on: true, checked: 1, error: '',
    base: 'https://legacy.example/m.json', manifest: man([e('Legacy', 'legacy_full.json', '1.0.0')])});
  ck('#102 an unversioned loaded pack is an update against a versioned offer',
    X.extPackRows().find(r => r.key === 'Legacy|legacy_full.json').state === 'update');
  // #102 fix round 1: a dismissal that isn't a parseable version never suppresses the pill
  // (cmpDataVer reads an unparseable side as equal, which would wrongly read as "not newer")
  const beforeMalformed = X.extPillCount();
  X.settings.dismissedUpdates['Legacy|legacy_full.json'] = {};
  ck('#102 a malformed dismissal does not suppress the pill', X.extPillCount() === beforeMalformed);
  X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {}; X.settings.dismissedUpdates = {};
});

// ---------- #102: the network and the pipeline (fetch stubbed)
const extRoutes = {};
const extFetch = (url) => {
  if (!(url in extRoutes)) return Promise.reject(new TypeError('Failed to fetch'));
  const r = extRoutes[url];
  if (r === 'hang') return new Promise(() => {});
  const body = typeof r === 'number' ? '' : (typeof r === 'string' ? r : JSON.stringify(r));
  const bytes = new TextEncoder().encode(body);
  return Promise.resolve({ok: typeof r !== 'number', status: typeof r === 'number' ? r : 200,
    arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))});
};
const packJSON = (system, ver, name) => JSON.stringify({system, dataVersion: ver, spells: [{name: name || (system + ' Spell'), level: 1}]});
const shaOf = s => require('crypto').createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
section('#102 checkSources failures', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  const good = {_type: 'fieldbook-data', format: 2, builtFor: '1.0.0', packs: [{file: 'a_full.json', system: 'A', version: '1.0.0', sha256: 'd'.repeat(64)}]};
  extRoutes['https://m.example/ok.json'] = good;
  const src = {id: 'm1', kind: 'manifest', url: 'https://m.example/ok.json', on: true, checked: 0, error: '', manifest: null, base: ''};
  await X.checkSource(src);
  ck('#102 a good manifest is stored with its base URL', src.manifest && src.manifest.packs.length === 1 && src.base === 'https://m.example/ok.json' && src.error === '', src);
  extRoutes['https://m.example/ok.json'] = 'not json{';
  await X.checkSource(src);
  ck('#102 garbage keeps the last good manifest and says why', src.manifest.packs.length === 1 && /JSON/.test(src.error), src.error);
  extRoutes['https://m.example/ok.json'] = 500;
  await X.checkSource(src);
  ck('#102 an HTTP error keeps the last good manifest', src.manifest.packs.length === 1 && /500/.test(src.error));
  delete extRoutes['https://m.example/ok.json'];
  await X.checkSource(src);
  ck('#102 a network failure keeps the last good manifest', src.manifest.packs.length === 1 && src.error !== '');
  // the official source on a release from before #102: a 404 is no error
  extRoutes['https://api.github.com/repos/wardmanm/RPGFieldbook/releases?per_page=100'] =
    [{tag_name: 'v1.0.0', draft: false, prerelease: false, html_url: 'https://github.com/x', assets: [{name: 'fieldbook-data-standalone-1.0.0.zip'}]}];
  extRoutes['https://raw.githubusercontent.com/wardmanm/RPGFieldbook/v1.0.0/releases/data/fieldbook-data.json'] = 404;
  const off = {id: 'official', kind: 'official', url: '', on: true, checked: 0, error: '', manifest: null, base: ''};
  await X.checkSource(off);
  ck('#102 official on an old release: no manifest and no error', off.manifest === null && off.error === '', off);
  extRoutes['https://raw.githubusercontent.com/wardmanm/RPGFieldbook/v1.0.0/releases/data/fieldbook-data.json'] = good;
  await X.checkSource(off);
  ck('#102 official reads the manifest at the picked tag', off.manifest && off.base.endsWith('/v1.0.0/releases/data/fieldbook-data.json'));
  const realOnline = ctx.navigator.onLine; ctx.navigator.onLine = false;
  let fetched = 0; ctx.fetch = u => { fetched++; return extFetch(u); };
  const r = await X.checkSources({boot: true});
  ck('#102 offline at boot: nothing is fetched', r === false && fetched === 0);
  ctx.navigator.onLine = realOnline; ctx.fetch = extFetch;
});

section('#102 runInstall all or nothing', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  X.resetRules();
  X.importPack(JSON.parse(packJSON('A', '1.0.0')), 'a_full.json');
  const a2 = packJSON('A', '1.1.0', 'A New'), b1 = packJSON('B', '1.0.0');
  extRoutes['https://m.example/a_full.json'] = a2;
  extRoutes['https://m.example/b_full.json'] = b1;
  const src = {id: 'm1', kind: 'manifest', url: 'https://m.example/m.json', on: true, checked: 1, error: '', base: 'https://m.example/m.json',
    manifest: X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [
      {file: 'a_full.json', system: 'A', version: '1.1.0', sha256: shaOf(a2)},
      {file: 'b_full.json', system: 'B', version: '1.0.0', sha256: 'e'.repeat(64)}]}, 100)};
  X.settings.sources = [src];
  let saves = 0; const realSave = ctx.saveRulesCache; ctx.saveRulesCache = () => { saves++; return Promise.resolve(''); };
  const lines = X.planInstall(src.manifest.packs.map(entry => X.offerCandidate({entry, source: src})));
  ck('#102 the plan: A is an update, B an install, both ticked',
    lines.map(l => l.outcome + ':' + l.ticked).join() === 'update:true,install:true', lines.map(l => l.outcome));
  const before = JSON.stringify(X.loadedRulesGroups());
  const r1 = await X.runInstall(lines);
  ck('#102 one wrong sha256: nothing installs and the file is named',
    r1.ok === false && r1.error.file === 'b_full.json' && /sha256/.test(r1.error.why) && JSON.stringify(X.loadedRulesGroups()) === before && saves === 0, r1);
  src.manifest = X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [
    {file: 'a_full.json', system: 'A', version: '1.1.0', sha256: shaOf(a2)}, {file: 'b_full.json', system: 'B', version: '1.0.0', sha256: shaOf(b1)}]}, 100);
  extRoutes['https://m.example/b_full.json'] = 404;
  const r2 = await X.runInstall(X.planInstall(src.manifest.packs.map(entry => X.offerCandidate({entry, source: src}))));
  ck('#102 a 404: nothing installs', r2.ok === false && r2.error.file === 'b_full.json' && saves === 0, r2);
  extRoutes['https://m.example/b_full.json'] = packJSON('Imposter', '1.0.0');
  src.manifest.packs[1].sha256 = shaOf(extRoutes['https://m.example/b_full.json']);
  const r3 = await X.runInstall(X.planInstall(src.manifest.packs.map(entry => X.offerCandidate({entry, source: src}))));
  ck('#102 the wrong system: nothing installs', r3.ok === false && /Imposter/.test(r3.error.why), r3.error);
  extRoutes['https://m.example/b_full.json'] = b1; src.manifest.packs[1].sha256 = shaOf(b1);
  const r4 = await X.runInstall(X.planInstall(src.manifest.packs.map(entry => X.offerCandidate({entry, source: src}))));
  const g = X.loadedRulesGroups();
  ck('#102 all verified: both install, the cache saves once, origins are recorded',
    r4.ok === true && saves === 1 && g.find(x => x.label === 'a_full.json').dataVersion === '1.1.0' && g.some(x => x.label === 'b_full.json') &&
    X.settings.packOrigin['A|a_full.json'] === 'm1', r4);
  ctx.saveRulesCache = realSave; X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {};
});

section('#102 planInstall outcomes and manual candidates', () => {
  X.resetRules();
  X.importPack(JSON.parse(packJSON('A', '1.1.0')), 'a_full.json');
  const cand = (system, file, version, o) => Object.assign({key: system + '|' + file, category: 'rules', system, file, title: system, version,
    minApp: '', sha256: '', size: 0, requires: [], origin: 'm1', manual: false, get: () => Promise.resolve(new Uint8Array())}, o || {});
  const lines1 = X.planInstall([cand('A', 'a_full.json', '1.1.0'), cand('A', 'a_full.json', '1.0.0', {key: 'x'}), cand('N', 'n_full.json', '1.0.0', {minApp: '99.0.0'}),
    cand('U', 'u.json', '1.0.0', {category: 'ui'})]);
  const out = lines1.map(l => l.outcome + ':' + l.ticked + ':' + l.canTick);
  // the loaded pack's own key offers "same"; a second candidate under a
  // DIFFERENT key for the same system+file is matched by system/file (not by
  // key) against that loaded pack too, and reads "older" — the brief this
  // test comes from only exercised three outcomes and omitted the "older"
  // line its own input produces
  ck('#102 same, older, too new and unsupported are never ticked or tickable from a source',
    out.join() === 'same:false:false,older:false:false,blocked:false:false,unsupported:false:false', out);
  // an unsupported candidate (wrong category) with no minApp is not "too new"
  // for any particular version, so it says it needs a newer Fieldbook in
  // general rather than naming a version that was never checked
  ck('#102 an unsupported candidate with no minApp says it needs a newer Fieldbook',
    lines1[3].outcome === 'unsupported' && lines1[3].why === 'requires a newer Fieldbook', lines1[3]);
  const man = X.planInstall([cand('A', 'a_full.json', '1.0.0', {manual: true})])[0];
  ck('#102 a manual older copy offers Replace anyway, unticked', man.outcome === 'older' && man.ticked === false && man.canTick === true);
  // a requirement pulled in from a source
  X.settings.sources = [{id: 'official', kind: 'official', url: '', on: true, checked: 1, error: '', base: 'https://r.example/m.json',
    manifest: X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [{file: 'srd_full.json', system: 'SRD 5.2', version: '1.0.0', sha256: 'f'.repeat(64)}]}, 100)}];
  const req = X.planInstall([cand('H', 'h_full.json', '1.0.0', {requires: [{pack: 'SRD 5.2', file: 'srd_full.json', url: ''}]})]);
  ck('#102 a missing requirement a source offers joins the plan, ticked',
    req.length === 2 && req[1].cand.system === 'SRD 5.2' && req[1].outcome === 'install' && req[1].ticked === true && /H/.test(req[1].why), req.map(l => l.cand.system));
  // manual candidates: a loose pack, a non-pack, and a zip carrying its manifest
  const enc = s => new TextEncoder().encode(s);
  const mc = X.manualCandidates([{name: 'a_full.json', bytes: enc(packJSON('A', '1.2.0'))}, {name: 'notes.json', bytes: enc('{"hello":1}')}]);
  ck('#102 a loose pack is a candidate named by srcLabel and file', mc.cands.length === 1 && mc.cands[0].system === 'A' && mc.cands[0].version === '1.2.0' && mc.cands[0].manual === true);
  ck('#102 a file that isn\'t a rules pack is named and skipped', mc.failed.length === 1 && mc.failed[0].name === 'notes.json', mc.failed);
  const folder = X.manualCandidates([
    {name: 'fieldbook-data.json', bytes: enc(JSON.stringify({_type: 'fieldbook-data', builtFor: '9.9.9', packs: [{file: 'a_full.json', system: 'A', version: '1.2.0', sha256: 'a'.repeat(64)}]}))},
    {name: 'a_full.json', bytes: enc(packJSON('A', '1.2.0'))}]);
  ck('#102 a folder with its manifest: the manifest\'s sha256 and minApp apply', folder.cands.length === 1 && folder.cands[0].sha256 === 'a'.repeat(64) && folder.cands[0].minApp === '9.9.9');
  X.resetRules(); X.settings.sources = [];
});

// ---------- #102 fix round 1: opus review (task-4-review.md)
section('#102 fix round 1: a throw mid-import reverts everything, not just the pool', async () => {
  X.resetRules(); X.settings.packOrigin = {};
  const savedMerge = ctx.mergeRules;
  ctx.mergeRules = function (obj, fileName, url) { if (fileName === 'b_full.json') throw new Error('boom'); return savedMerge(obj, fileName, url); };
  let saves = 0; const realSave = ctx.saveRulesCache; ctx.saveRulesCache = () => { saves++; return Promise.resolve(''); };
  const mk = (sys, file) => ({cand: {key: sys + '|' + file, category: 'rules', system: sys, file, title: sys, version: '1.0.0', minApp: '', sha256: '', size: 0, requires: [], origin: 'm1', manual: false,
    get: () => Promise.resolve(new TextEncoder().encode(packJSON(sys, '1.0.0')))}, outcome: 'install', ticked: true, canTick: true});
  const before = JSON.stringify(X.loadedRulesGroups()), beforeOrigin = JSON.stringify(X.settings.packOrigin);
  const r = await X.runInstall([mk('A', 'a_full.json'), mk('B', 'b_full.json')]);
  ck('#102 fix round 1: a throw mid-import is {ok:false}, not a rejection', r.ok === false && r.error.file === 'b_full.json' && /boom/.test(r.error.why), r);
  ck('#102 fix round 1: nothing is left half-installed: the pool, packOrigin and the cache are all untouched',
    JSON.stringify(X.loadedRulesGroups()) === before && JSON.stringify(X.settings.packOrigin) === beforeOrigin && saves === 0,
    [X.loadedRulesGroups(), X.settings.packOrigin, saves]);
  ctx.mergeRules = savedMerge; ctx.saveRulesCache = realSave; X.resetRules(); X.settings.packOrigin = {};
});

section('#102 fix round 1: the timeout covers the whole response, not just the headers', async () => {
  // the harness stubs setTimeout as a no-op (nothing else here needs a real
  // timer firing) — this test is the one exception, so it borrows Node's own
  // setTimeout/clearTimeout for just this check
  const realFetch = ctx.fetch, realST = ctx.setTimeout, realCT = ctx.clearTimeout;
  ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;
  ctx.fetch = () => Promise.resolve({ok: true, status: 200, arrayBuffer: () => new Promise(() => {})});
  const t0 = Date.now();
  let msg = '', threw = false;
  try { await X.extFetchBytes('https://x/y', 50); } catch (e) { threw = true; msg = e.message; }
  ck('#102 fix round 1: a response whose body never arrives still times out',
    threw && /took too long/.test(msg) && Date.now() - t0 < 2000, msg);
  ctx.fetch = realFetch; ctx.setTimeout = realST; ctx.clearTimeout = realCT;
});

section('#102 fix round 1: a declared Content-Length over the cap is refused before the body is read', async () => {
  const realFetch = ctx.fetch;
  let readBody = false;
  ctx.fetch = () => Promise.resolve({ok: true, status: 200,
    headers: {get: k => k === 'content-length' ? String(X.EXT_FILE_MAX + 1) : null},
    arrayBuffer: () => { readBody = true; return Promise.resolve(new ArrayBuffer(0)); }});
  let msg = '';
  try { await X.extFetchBytes('https://x/y', 1000, X.EXT_FILE_MAX); } catch (e) { msg = e.message; }
  ck('#102 fix round 1: an over-cap Content-Length is refused, and the body is never read',
    msg !== '' && !readBody, [msg, readBody]);
  ctx.fetch = realFetch;
});

section('#102 fix round 1: offerCandidate refuses an oversized declared size without ever fetching', async () => {
  const realFetch = ctx.fetch;
  let fetched = 0;
  ctx.fetch = (u) => { fetched++; return extFetch(u); };
  const entry = {path: 'big_full.json', system: 'Big', file: 'big_full.json', title: 'Big', version: '1.0.0', minApp: '', sha256: '', size: X.EXT_FILE_MAX + 1, requires: []};
  const cand = X.offerCandidate({entry, source: {id: 'm1', base: 'https://m.example/m.json', url: 'https://m.example/m.json'}});
  let msg = '';
  try { await cand.get(); } catch (e) { msg = e.message; }
  ck('#102 fix round 1: a declared size over 32 MB is refused with no fetch at all',
    /32 MB/.test(msg) && fetched === 0, [msg, fetched]);
  ctx.fetch = realFetch;
});

section('#102 fix round 1: a failed save at boot is recorded, not swallowed', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  const realOnline = ctx.navigator.onLine; ctx.navigator.onLine = true;
  X.settings.sources = [];
  const realSave = ctx.saveSettings; ctx.saveSettings = () => 'disk full';
  const r = await X.checkSources({boot: true});
  ck('#102 fix round 1: checkSources still resolves true at boot even when the save fails', r === true);
  ck('#102 fix round 1: the save error is recorded for later, not shown now', X.extSaveErrorText() === 'disk full');
  ctx.saveSettings = () => '';
  await X.checkSources({boot: false});
  ck('#102 fix round 1: a later successful save clears it', X.extSaveErrorText() === '');
  ctx.saveSettings = realSave; ctx.navigator.onLine = realOnline;
});

section('#102 fix round 1: a 404 from the releases list itself is a real error, not "an old release"', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  extRoutes['https://api.github.com/repos/wardmanm/RPGFieldbook/releases?per_page=100'] = 404;
  const off = {id: 'official', kind: 'official', url: '', on: true, checked: 0, error: '', manifest: null, base: ''};
  await X.checkSource(off);
  ck('#102 fix round 1: a 404 on the releases list is reported, not swallowed as "no releases yet"',
    off.error !== '' && /404/.test(off.error), off);
});

section('#102 fix round 1: addSource', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  X.settings.sources = [];
  const r0 = await X.addSource('ftp://x/y.json');
  ck('#102 fix round 1: a non-http URL is refused before any fetch', r0.ok === false, r0);
  const manifestURL = 'https://add.example/m.json';
  extRoutes[manifestURL] = {_type: 'fieldbook-data', builtFor: '1.0.0', packs: [{file: 'a_full.json', system: 'A', version: '1.0.0', sha256: 'a'.repeat(64)}]};
  const r1 = await X.addSource(manifestURL);
  ck('#102 fix round 1: a manifest URL is added as kind "manifest"',
    r1.ok === true && X.settings.sources.some(s => s.url === manifestURL && s.kind === 'manifest'), [r1, X.settings.sources]);
  const r1dup = await X.addSource(manifestURL);
  ck('#102 fix round 1: an exact duplicate is refused', r1dup.ok === false && /already/.test(r1dup.why), r1dup);
  const r1dupCase = await X.addSource('HTTPS://add.example/m.json');
  ck('#102 fix round 1: a duplicate differing only in scheme case is caught too', r1dupCase.ok === false && /already/.test(r1dupCase.why), r1dupCase);
  const plainURL = 'https://add.example/p.json';
  extRoutes[plainURL] = {system: 'Plain', dataVersion: '1.0.0', spells: [{name: 'P'}]};
  const r2 = await X.addSource(plainURL);
  ck('#102 fix round 1: a plain rules file is added as kind "plain"',
    r2.ok === true && X.settings.sources.some(s => s.url === plainURL && s.kind === 'plain'), r2);
  const badURL = 'https://add.example/bad.json';
  extRoutes[badURL] = 'not json{';
  const r3 = await X.addSource(badURL);
  ck('#102 fix round 1: a non-JSON response is refused', r3.ok === false && /JSON/.test(r3.why), r3);
  const emptyURL = 'https://add.example/empty.json';
  extRoutes[emptyURL] = {_type: 'fieldbook-data', builtFor: '1.0.0', packs: []};
  const r4 = await X.addSource(emptyURL);
  ck('#102 fix round 1: an empty manifest is added but says it offers nothing',
    r4.ok === true && r4.why === 'Added, but it offers nothing this Fieldbook can install.', r4);
  delete X.settings.sources;
  const freshURL = 'https://add.example/fresh.json';
  extRoutes[freshURL] = {system: 'Fresh', dataVersion: '1.0.0', spells: [{name: 'F'}]};
  const r5 = await X.addSource(freshURL);
  ck('#102 fix round 1: addSource never throws when settings.sources is missing', r5.ok === true && Array.isArray(X.settings.sources), r5);
  X.settings.sources = [];
});

section('#102 fix round 1: a folder manifest only covers its own directory', () => {
  const enc = s => new TextEncoder().encode(s);
  const man = {_type: 'fieldbook-data', builtFor: '1.0.0', packs: [{file: 'one/x_full.json', system: 'A', version: '1.0.0', sha256: 'a'.repeat(64)}]};
  const mc = X.manualCandidates([
    {name: 'root/fieldbook-data.json', bytes: enc(JSON.stringify(man))},
    {name: 'root/one/x_full.json', bytes: enc(packJSON('A', '1.0.0'))},
    {name: 'root/two/x_full.json', bytes: enc(packJSON('A', '1.0.0', 'Other'))},
    {name: 'root/two/fieldbook-data.json', bytes: enc(JSON.stringify(man))},
    {name: 'root/readme.txt', bytes: enc('hi')},
  ]);
  ck('#102 fix round 1: a manifest matches only a payload resolved under its own directory',
    mc.cands.length === 2 && mc.cands[0].sha256 === 'a'.repeat(64) && mc.cands[1].sha256 === '',
    mc.cands.map(c => c.key + ':' + c.sha256));
  ck('#102 fix round 1: a second manifest elsewhere, and a non-JSON file, are never reported as failures',
    mc.failed.length === 0, mc.failed);
});

section("#102 fix round 1: a loose zip's non-pack JSON is skipped silently, like importRulesPayloads", () => {
  const zip = makeZip([{name: 'a_full.json', data: PACK('A', ['Ok'])}, {name: 'overlay.json', data: JSON.stringify({notes: 'not a pack'})}]);
  const mc = X.manualCandidates([{name: 'drop.zip', bytes: zip}]);
  ck('#102 fix round 1: the pack inside the zip becomes a candidate', mc.cands.length === 1 && mc.cands[0].system === 'A', mc.cands);
  ck('#102 fix round 1: the non-pack JSON beside it is not reported as failed', mc.failed.length === 0, mc.failed);
});

section('#102 fix round 1: replace outcomes depend on which side has no version (spec §5)', () => {
  const cand = (system, file, version, o) => Object.assign({key: system + '|' + file, category: 'rules', system, file, title: system, version,
    minApp: '', sha256: '', size: 0, requires: [], origin: 'm1', manual: false, get: () => Promise.resolve(new Uint8Array())}, o || {});
  X.resetRules();
  X.importPack({system: 'A', dataVersion: '2.0.0', spells: [{name: 'New'}]}, 'a_full.json');
  const noVer = X.planInstall([cand('A', 'a_full.json', '')])[0];
  ck('#102 fix round 1: an unversioned candidate over a versioned pack is an unticked Replace anyway',
    noVer.outcome === 'replace' && noVer.ticked === false && noVer.canTick === true && noVer.why === 'Replace anyway', noVer);
  X.resetRules();
  X.importPack({system: 'A', spells: [{name: 'Old'}]}, 'a_full.json');
  const haveNoVer = X.planInstall([cand('A', 'a_full.json', '1.0.0')])[0];
  ck('#102 fix round 1: a versioned candidate over unversioned loaded data is a ticked replace',
    haveNoVer.outcome === 'replace' && haveNoVer.ticked === true, haveNoVer);
  X.resetRules();
});

section('#102 fix round 1: the pull-in picks the best offer, not the first source in settings order', () => {
  X.resetRules();
  X.settings.sources = [
    {id: 'official', kind: 'official', url: '', on: true, checked: 1, error: '', base: 'https://o.example/m.json',
     manifest: X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [{file: 'srd_full.json', system: 'SRD', version: '1.0.0', sha256: 'c'.repeat(64)}]}, 100)},
    {id: 'm2', kind: 'manifest', url: 'https://t.example/m.json', on: true, checked: 1, error: '', base: 'https://t.example/m.json',
     manifest: X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [{file: 'srd_full.json', system: 'SRD', version: '2.0.0', sha256: 'd'.repeat(64)}]}, 100)}];
  const cand = {key: 'H|h_full.json', category: 'rules', system: 'H', file: 'h_full.json', title: 'H', version: '1.0.0', minApp: '', sha256: '', size: 0,
    requires: [{pack: 'SRD', file: '', url: ''}], origin: 'manual', manual: true, get: () => Promise.resolve(new Uint8Array())};
  const pl = X.planInstall([cand]);
  ck('#102 fix round 1: the newest offer wins the pull-in, not the first source in settings order',
    pl.length === 2 && pl[1].cand.version === '2.0.0' && pl[1].cand.origin === 'm2', pl.map(l => l.cand.version + ' from ' + l.cand.origin));
  X.resetRules(); X.settings.sources = [];
});

section('#102 fix round 1: runInstall de-duplicates its lines by key, keeping the newest', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  X.resetRules(); X.settings.packOrigin = {};
  const mk = ver => ({cand: {key: 'A|a_full.json', category: 'rules', system: 'A', file: 'a_full.json', title: 'A', version: ver, minApp: '', sha256: '', size: 0, requires: [], origin: 'm1', manual: false,
    get: () => Promise.resolve(new TextEncoder().encode(packJSON('A', ver)))}, outcome: 'install', ticked: true, canTick: true});
  const r = await X.runInstall([mk('2.0.0'), mk('1.0.0')]);
  ck('#102 fix round 1: only one copy of a duplicated key installs', r.ok === true && r.installed.length === 1, r);
  ck('#102 fix round 1: ...and it is the newest one', X.loadedRulesGroups().find(g => g.label === 'a_full.json').dataVersion === '2.0.0',
    X.loadedRulesGroups());
  X.resetRules(); X.settings.packOrigin = {};
});

section('#102 fix round 1: runInstall reports what importPack skipped, like fetchAllRules', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  X.resetRules(); X.settings.packOrigin = {};
  const body = JSON.stringify({system: 'A', dataVersion: '1.0.0', spells: [{name: 'Ok'}, {text: 'no name'}]});
  const cand = {key: 'A|a_full.json', category: 'rules', system: 'A', file: 'a_full.json', title: 'A', version: '1.0.0', minApp: '', sha256: '', size: 0, requires: [], origin: 'm1', manual: false,
    get: () => Promise.resolve(new TextEncoder().encode(body))};
  const r = await X.runInstall([{cand, outcome: 'install', ticked: true, canTick: true}]);
  ck('#102 fix round 1: runInstall returns a skipped summary', r.ok === true && r.skipped && r.skipped.spells === 1, r);
  X.resetRules(); X.settings.packOrigin = {};
});

section('#102 the Extensions page markup', () => {
  X.resetRules();
  X.importPack({system: 'SRD 5.2', dataVersion: '1.8.1', spells: [{name: 'Bless', level: 1}]}, 'srd52_full.json');
  X.importPack({system: '2024 Rules', dataVersion: '1.8.0', spells: [{name: 'Haste', level: 3}]}, 'xphb_full.json');
  const evil = '<img src=x onerror=alert(1)>';
  X.settings.sources = [
    {id: 'official', kind: 'official', url: '', on: true, checked: Date.now(), error: '', base: 'https://raw.example/m.json',
      manifest: X.readManifest({_type: 'fieldbook-data', name: 'Fieldbook public data', builtFor: '1.0.0', packs: [
        {file: 'srd52_full.json', system: 'SRD 5.2', version: '1.9.0', sha256: 'a'.repeat(64), title: 'SRD 5.2', summary: 'Free rules.'}]}, 100)},
    {id: 's2', kind: 'manifest', url: 'https://ember.example/m.json', on: true, checked: Date.now(), error: 'HTTP 500', base: 'https://ember.example/m.json',
      manifest: X.readManifest({_type: 'fieldbook-data', name: evil, homepage: 'javascript:alert(1)', builtFor: '1.0.0', packs: [
        {file: 'ember_full.json', system: 'Ember', version: '2.1.0', sha256: 'b'.repeat(64), title: evil, summary: evil, description: evil + '\n\nSecond para.',
          minApp: '99.0.0', requires: [{pack: 'SRD 5.2', url: 'javascript:alert(1)'}, {pack: 'Mystery', url: 'https://m.example'}]},
        {file: 'ember_ui.json', system: 'Ember Theme', version: '1.0.0', category: 'ui', sha256: 'c'.repeat(64), minApp: '2.0.0'}]}, 100)},
    {id: 'p1', kind: 'plain', url: 'https://plain.example/spells.json', on: true, checked: 0, error: '', manifest: null, base: ''}];
  X.settings.packOrigin = {'SRD 5.2|srd52_full.json': 'official'}; X.settings.dismissedUpdates = {}; X.settings.setCollapse = {};
  const h = X.extPageHTML();
  ck('#102 the banner offers Update all for one update', /id="extUpdateAll"/.test(h) && /1 update/.test(h) && /SRD 5\.2/.test(h));
  ck('#102 sections: Rules data, Unsupported, Sources, each foldable',
    /data-ext-sec="rules"/.test(h) && /data-ext-sec="unsupported"/.test(h) && /data-ext-sec="sources"/.test(h) && /aria-expanded="true"/.test(h));
  ck('#102 the update row shows 1.8.1 → 1.9.0 and Update', /1\.8\.1/.test(h) && /1\.9\.0/.test(h) && /data-ext-update="SRD 5\.2\|srd52_full\.json"/.test(h));
  ck('#102 a hand-imported pack reads "imported from a file"', /imported from a file/.test(h));
  ck('#102 a too-new pack reads "requires Fieldbook 99.0.0" and has no live Install',
    /requires Fieldbook 99\.0\.0/.test(h) && !/data-ext-install="Ember\|ember_full\.json"/.test(h));
  ck('#102 an unsupported category reads "requires Fieldbook 2.0.0" under Unsupported', /Unsupported/.test(h) && /requires Fieldbook 2\.0\.0/.test(h));
  ck('#102 a missing requirement is a chip "requires Mystery"', /data-ext-req="Mystery"[^>]*>requires Mystery</.test(h));
  ck('#102 hostile manifest text is escaped everywhere', !h.includes('<img src=x') && h.includes('&lt;img src=x'));
  // esc() writes an apostrophe as &#39; (brief's /couldn.t/ assumed a literal one)
  ck('#102 a source that failed says why', /couldn(?:'|&#39;)t check: HTTP 500/.test(h));
  ck('#102 the plain source has Fetch and Remove', /data-ext-src-fetch="p1"/.test(h) && /data-ext-src-del="p1"/.test(h));
  ck('#102 the built-in source has a switch, not Remove', /data-ext-src-on="official"/.test(h) && !/data-ext-src-del="official"/.test(h));
  ck('#102 the row of actions: Add, Check now, Manual install', /id="extAddUrl"/.test(h) && /id="extCheckNow"/.test(h) && /id="extManual"[^>]*>Manual install/.test(h));
  ck('#102 no Get templates and no Fetch all', !/Get templates/.test(h) && !/Fetch all/.test(h));
  X.settings.setCollapse = {'ext:rules': true};
  ck('#102 a folded section stays folded', /data-ext-sec="rules"[^>]*aria-expanded="false"/.test(X.extPageHTML()));
  const d = X.extDetailsHTML('Ember|ember_full.json');
  ck('#102 details: the full description as escaped paragraphs', (d.match(/<p>/g) || []).length >= 2 && !d.includes('<img src=x'));
  ck('#102 details: a javascript: homepage and requires url never become links', !/href="javascript/i.test(d));
  ck('#102 details: the source box and the other extensions from that source', /Source/.test(d) && /ember\.example\/m\.json/.test(d) && /data-ext-open="Ember Theme\|ember_ui\.json"/.test(d));
  ck('#102 a requirement with an https url links out', /href="https:\/\/m\.example"[^>]*target="_blank"[^>]*rel="noopener"/.test(d));
  ck('#102 extParas splits on blank lines and escapes', X.extParas('a<b\n\nc') === '<p>a&lt;b</p><p>c</p>');
  ck('#102 the Settings page is Extensions, and a stored "rules" opens it',
    X.SET_PAGES.some(p => p.k === 'extensions' && p.title === 'Extensions') && X.setPageOf('rules', false) === 'extensions');
  X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {}; X.settings.setCollapse = {};
});

section('#102 the Extensions page: wording, chips, the save error and the badge', () => {
  X.resetRules();
  X.importPack({system: 'SRD 5.2', dataVersion: '1.8.1', spells: [{name: 'Bless', level: 1}]}, 'srd52_full.json');
  const man = packs => X.readManifest({_type: 'fieldbook-data', name: 'M', builtFor: '1.0.0', packs}, 100);
  X.settings.sources = [
    {id: 'official', kind: 'official', url: '', on: true, checked: 0, error: '', base: 'https://raw.example/m.json',
      manifest: man([{file: 'srd52_full.json', system: 'SRD 5.2', version: '1.9.0', sha256: 'a'.repeat(64)},
        {file: 'needed_full.json', system: 'Needed', version: '1.0.0', sha256: 'd'.repeat(64)}])},
    {id: 'm2', kind: 'manifest', url: 'https://m2.example/m.json', on: true, checked: 0, error: '', base: 'https://m2.example/m.json',
      manifest: man([{file: 'odd_full.json', system: 'Odd', version: '1.0.0', category: 'ui', sha256: 'e'.repeat(64)},
        {file: 'kid_full.json', system: 'Kid', version: '1.0.0', sha256: 'f'.repeat(64),
          requires: [{pack: 'Needed', url: 'https://needed.example'}, {pack: 'Nowhere'}]}])}];
  X.settings.packOrigin = {}; X.settings.dismissedUpdates = {}; X.settings.setCollapse = {};
  const h = X.extPageHTML();
  ck('#102 Ruling 2: an unsupported category whose minApp is not newer reads "requires a newer Fieldbook"',
    /requires a newer Fieldbook/.test(h) && !/requires Fieldbook 1\.0\.0/.test(h), h);
  ck('#102 a requirement a source offers is a button (opens its details), even when it has a url',
    /<button[^>]*data-ext-req="Needed"[^>]*>requires Needed</.test(h) && !/href="https:\/\/needed\.example"/.test(h));
  ck('#102 a requirement nothing answers is a plain label, not a button or a link',
    /<span[^>]*data-ext-req="Nowhere"[^>]*>requires Nowhere</.test(h) && !/<(button|a)[^>]*data-ext-req="Nowhere"/.test(h));
  ck('#102 the badge dot shows while an update is pending, under the extensions key',
    /set-dot/.test(X.rulesNavBadgeHTML()) && /id="setBadgeDesc-extensions"/.test(X.rulesNavBadgeHTML()));
  X.settings.dismissedUpdates = {'SRD 5.2|srd52_full.json': '1.9.0'};
  /* Ruling 15: the dot follows spec §6.2 ("shows while updates are pending"),
     extUpdateRows(), not the pill's count: clearing the pill leaves it */
  ck('#102 Ruling 15: the dot stays once the pill has cleared the update', X.extPillCount() === 0 && /set-dot/.test(X.rulesNavBadgeHTML()), X.rulesNavBadgeHTML());
  ck('#102 Ruling 15: ...and the description still says "update"', / · update$/.test(X.rulesBadge()), X.rulesBadge());
  X.importPack({system: 'SRD 5.2', dataVersion: '1.9.0', spells: [{name: 'Bless', level: 1}]}, 'srd52_full.json');
  ck('#102 Ruling 15: ...and goes once the update is installed', X.extUpdateRows().length === 0 && !/set-dot/.test(X.rulesNavBadgeHTML()), X.rulesNavBadgeHTML());
  X.resetRules();
  X.importPack({system: 'SRD 5.2', dataVersion: '1.8.1', spells: [{name: 'Bless', level: 1}]}, 'srd52_full.json');
  ck('#102 no save error, no save-error line', !/at the last check/.test(h));
  const realSave = ctx.saveSettings; ctx.saveSettings = () => 'disk full';
  ctx.navigator.onLine = true;
  return X.checkSources({boot: true}).then(() => {
    ctx.navigator.onLine = false; ctx.saveSettings = realSave;
    ck('#102 a failed save at the last check shows on the page, as an error',
      /class="status err"[^>]*>Couldn(?:'|&#39;)t save your sources at the last check: disk full/.test(X.extPageHTML()));
    X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {}; X.settings.dismissedUpdates = {};
  });
});

section('#102 renderRulesData repaints the Extensions page and the extensions badge', () => {
  const writes = {badge: '', page: 0};
  const badge = {set innerHTML(v) { writes.badge = v; }, get innerHTML() { return writes.badge; }};
  const page = {set outerHTML(v) { writes.page++; }, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}};
  const realQ = ctx.document.querySelector, realG = ctx.document.getElementById;
  ctx.document.querySelector = sel => /data-setbadge="extensions"/.test(sel) ? badge : null;
  ctx.document.getElementById = id => id === 'extPage' ? page : realG(id);
  X.renderRulesData();
  ck('#102 renderRulesData refreshes the extensions badge', writes.badge === X.rulesNavBadgeHTML() && writes.badge !== '', writes.badge);
  ck('#102 ...and repaints the Extensions page', writes.page === 1, writes.page);
  ctx.document.querySelector = realQ; ctx.document.getElementById = realG;
});

section('#102 Task 4 follow-up N1: an unreadable folder manifest is reported, not dropped', () => {
  const enc = s => new TextEncoder().encode(s);
  const good = {_type: 'fieldbook-data', builtFor: '1.0.0', packs: [{file: 'x_full.json', system: 'A', version: '1.0.0', sha256: 'a'.repeat(64)}]};
  const mc = X.manualCandidates([
    {name: 'root/fieldbook-data.json', bytes: enc(JSON.stringify({_type: 'fieldbook-data', packs: 'nope'}))},
    {name: 'root/x_full.json', bytes: enc(packJSON('A', '1.0.0'))},
    {name: 'other/fieldbook-data.json', bytes: enc('not json{')},
    {name: 'third/fieldbook-data.json', bytes: enc(JSON.stringify(good))},
  ]);
  ck('#102 N1: a manifest readManifest rejects is in failed, with why',
    mc.failed.some(f => f.name === 'root/fieldbook-data.json' && /manifest/.test(f.why)), mc.failed);
  ck('#102 N1: a manifest that is not JSON is in failed too',
    mc.failed.some(f => f.name === 'other/fieldbook-data.json' && /JSON/.test(f.why)), mc.failed);
  ck('#102 N1: a readable second manifest stays quiet', !mc.failed.some(f => f.name === 'third/fieldbook-data.json') && mc.failed.length === 2, mc.failed);
  ck('#102 N1: the pack beside the broken manifest is still a candidate, with no sha256', mc.cands.length === 1 && mc.cands[0].sha256 === '', mc.cands);
});

section('#102 Task 4 follow-up N2: the cross-origin hint is for a network failure only', async () => {
  const realFetch = ctx.fetch;
  X.settings.sources = [];
  ctx.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  const r1 = await X.addSource('https://n2.example/a.json');
  ck('#102 N2: a TypeError (network or CORS) carries the cross-origin hint', r1.ok === false && /cross-origin/.test(r1.why), r1);
  ctx.fetch = () => Promise.reject(new Error('it took too long to answer'));
  const r2 = await X.addSource('https://n2.example/b.json');
  ck('#102 N2: a timeout does not', r2.ok === false && /took too long/.test(r2.why) && !/cross-origin/.test(r2.why), r2);
  ctx.fetch = realFetch; X.settings.sources = [];
});

section('#102 Task 4 follow-up N3: any successful sources save clears the recorded save error', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  const realSave = ctx.saveSettings, realOnline = ctx.navigator.onLine;
  ctx.navigator.onLine = true; X.settings.sources = [];
  const fail = async () => { ctx.saveSettings = () => 'disk full'; await X.checkSources({boot: true}); ctx.saveSettings = () => ''; };
  await fail();
  ck('#102 N3: (set up) the error is recorded', X.extSaveErrorText() === 'disk full');
  extRoutes['https://n3.example/p.json'] = {system: 'N3', dataVersion: '1.0.0', spells: [{name: 'N'}]};
  const r = await X.addSource('https://n3.example/p.json');
  ck('#102 N3: a successful addSource save clears it', r.ok === true && X.extSaveErrorText() === '', [r, X.extSaveErrorText()]);
  await fail();
  const cand = {key: 'N3b|n3b_full.json', category: 'rules', system: 'N3b', file: 'n3b_full.json', title: 'N3b', version: '1.0.0', minApp: '', sha256: '',
    size: 0, requires: [], origin: 'manual', manual: true, get: () => Promise.resolve(new TextEncoder().encode(packJSON('N3b', '1.0.0')))};
  const ri = await X.runInstall([{cand, ticked: true, canTick: true}]);
  ck('#102 N3: a successful runInstall save clears it', ri.ok === true && X.extSaveErrorText() === '', [ri, X.extSaveErrorText()]);
  ctx.saveSettings = realSave; ctx.navigator.onLine = realOnline;
  X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {};
});

section('#102 Task 4 follow-up N4: an early Content-Length refusal aborts the request', async () => {
  const realFetch = ctx.fetch, realAC = ctx.AbortController;
  ctx.AbortController = AbortController;
  let signal = null;
  ctx.fetch = (u, opts) => { signal = opts && opts.signal; return Promise.resolve({ok: true, status: 200,
    headers: {get: k => k === 'content-length' ? String(X.EXT_MAN_MAX + 1) : null}, arrayBuffer: () => new Promise(() => {})}); };
  let msg = '';
  try { await X.extFetchBytes('https://n4.example/m.json', 1000, X.EXT_MAN_MAX); } catch (e) { msg = e.message; }
  ck('#102 N4: the refusal aborts the controller', /64 KB/.test(msg) && signal && signal.aborted === true, [msg, signal && signal.aborted]);
  ctx.fetch = realFetch; ctx.AbortController = realAC;
});

section('#102 the plan dialog and the pills', () => {
  X.resetRules();
  X.importPack({system: 'A', dataVersion: '1.0.0', spells: [{name: 'A1', level: 1}]}, 'a_full.json');
  const cand = (system, file, version, o) => Object.assign({key: system + '|' + file, category: 'rules', system, file, title: '<b>' + system + '</b>', version,
    minApp: '', sha256: '', size: 2048, requires: [], origin: 'm1', manual: false, get: () => Promise.resolve(new Uint8Array())}, o || {});
  const lines = X.planInstall([cand('A', 'a_full.json', '1.1.0'), cand('N', 'n_full.json', '1.0.0', {minApp: '99.0.0'}), cand('A2', 'a2_full.json', '1.0.0', {manual: true})]);
  const h = X.extPlanHTML(lines);
  ck('#102 the plan lists each pack with its outcome and versions', /1\.0\.0 → 1\.1\.0/.test(h) && /requires Fieldbook 99\.0\.0/.test(h) && /New/.test(h));
  ck('#102 ticked lines are checked; the blocked one is disabled', /data-plan-i="0"[^>]*checked/.test(h) && /data-plan-i="1"[^>]*disabled/.test(h));
  ck('#102 the confirm button counts the ticked lines', /id="planGo"[^>]*>Install 2</.test(h));
  ck('#102 plan titles are escaped', !h.includes('<b>A</b>') && h.includes('&lt;b&gt;A&lt;/b&gt;'));
  ck('#102 sizes read in KB', /2 KB/.test(h));
  const none = X.extPlanHTML(X.planInstall([cand('A', 'a_full.json', '1.0.0')]));
  ck('#102 a plan with nothing to do says so, with only Close', /Nothing to install/.test(none) && !/id="planGo"/.test(none));
  // the app pill respects dismissal
  const pill = {textContent: '', title: '', style: {}}, ver = {style: {}}, x = {hidden: true};
  const realGet = ctx.document.getElementById;
  ctx.document.getElementById = id => id === 'updatePill' ? pill : id === 'btnVer' ? ver : id === 'updatePillX' ? x : realGet(id);
  X.updateAvailable = {ver: '9.9.9', url: 'https://github.com/x'};
  X.settings.dismissedUpdates = {app: '9.9.9'};
  pill.style.display = 'none'; X.showUpdatePill();
  ck('#102 a cleared app update stays hidden', pill.style.display === 'none');
  X.updateAvailable = {ver: '9.9.10', url: 'https://github.com/x'};
  X.showUpdatePill();
  ck('#102 a newer app update shows again, with its ×', pill.style.display === 'inline-flex' && x.hidden === false);
  ctx.document.getElementById = realGet; X.updateAvailable = null; X.settings.dismissedUpdates = {};
  X.resetRules();
});

/* a tiny element: records its listeners, so a suite can fire them */
const fakeEl = props => {
  const h = {};
  return Object.assign({addEventListener: (t, f) => { (h[t] = h[t] || []).push(f); }, fire: (t, e) => (h[t] || []).map(f => f(e || {})),
    textContent: '', className: '', disabled: false, hidden: false, innerHTML: '', title: '', dataset: {}, style: {}, inserted: [],
    insertAdjacentHTML(pos, html) { this.inserted.push(html); }, focus() {}}, props || {});
};
section('#102 the plan dialog: ticks, Install N, a failure names the file, success toasts', async () => {
  X.resetRules();
  const c = (system, o) => Object.assign({key: system + '|' + system.toLowerCase() + '_full.json', category: 'rules', system, file: system.toLowerCase() + '_full.json',
    title: system, version: '1.0.0', minApp: '', sha256: '', size: 10, requires: [], origin: 'm1', manual: false, get: () => Promise.resolve(new Uint8Array())}, o || {});
  const lines = X.planInstall([c('P'), c('Q')]);
  const go = fakeEl(), close = fakeEl(), status = fakeEl();
  const boxes = lines.map((l, i) => fakeEl({checked: true, dataset: {planI: String(i)}}));
  const realGet = ctx.document.getElementById, realQSA = ctx.document.querySelectorAll;
  const realRun = ctx.runInstall, realToast = ctx.toast, realOpen = ctx.openSettings;
  const toasts = [], opened = [];
  ctx.document.getElementById = id => ({planGo: go, planClose: close, planStatus: status})[id] || realGet(id);
  ctx.document.querySelectorAll = sel => sel === '[data-plan-i]' ? boxes : realQSA(sel);
  ctx.toast = (msg, action, opts) => toasts.push([msg, opts || {}]);
  ctx.openSettings = () => opened.push(1);
  try {
    X.openInstallPlan(lines, {back: 'settings'});
    boxes[0].checked = false; boxes[0].fire('change');
    ck('#102 unticking a line recounts Install N', go.textContent === 'Install 1' && go.disabled === false && lines[0].ticked === false, go.textContent);
    boxes[1].checked = false; boxes[1].fire('change');
    ck('#102 nothing ticked disables Install', go.textContent === 'Install 0' && go.disabled === true);
    boxes[1].checked = true; boxes[1].fire('change');
    ctx.runInstall = () => Promise.resolve({ok: false, installed: [], error: {file: 'q_full.json', why: "its sha256 doesn't match the manifest"}, saveErr: '', skipped: {}});
    await Promise.all(go.fire('click'));
    await new Promise(r => setImmediate(r));
    ck('#102 a failed install changes nothing and names the file and why',
      /Nothing was installed/.test(status.textContent) && /q_full\.json/.test(status.textContent) && /sha256/.test(status.textContent) &&
      /err/.test(status.className) && go.disabled === false && toasts.length === 0 && opened.length === 0, status.textContent);
    ctx.runInstall = () => Promise.resolve({ok: true, installed: ['Q'], error: null, saveErr: '', skipped: {spells: 2}});
    go.fire('click');
    await new Promise(r => setImmediate(r));
    ck('#102 a good install toasts the count and what was skipped, then goes back to Settings',
      toasts.length === 1 && /^Installed 1 pack\. Skipped 2 spells/.test(toasts[0][0]) && toasts[0][1].long === true && opened.length === 1, toasts);
  } finally {
    ctx.document.getElementById = realGet; ctx.document.querySelectorAll = realQSA;
    ctx.runInstall = realRun; ctx.toast = realToast; ctx.openSettings = realOpen;
  }
  const t = X.extInstalledText({ok: true, installed: ['A', 'B'], saveErr: '', skipped: {}});
  ck('#102 the toast for a clean install is just the count', t.text === 'Installed 2 packs' && !t.opts.err && !t.opts.long, t);
  const t2 = X.extInstalledText({ok: true, installed: ['A'], saveErr: 'Storage is full.', skipped: {spells: 1}});
  ck('#102 a save error is in the toast, and makes it an error', /^Installed 1 pack\. Skipped 1 spell with no name\. Storage is full\.$/.test(t2.text) && t2.opts.err === true, t2);
  X.resetRules();
});

section('#102 Manual install: files, folders and drops reach the plan', async () => {
  X.resetRules();
  const realFR = ctx.FileReader, realPlan = ctx.openInstallPlan, realGet = ctx.document.getElementById;
  let reads = 0; const planned = []; const hint = fakeEl();
  ctx.FileReader = class { readAsArrayBuffer(f) { reads++; const b = Buffer.from(f.bytes); this.result = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); this.onload(); } };
  ctx.openInstallPlan = (lines, opts) => planned.push({lines, opts});
  ctx.document.getElementById = id => id === 'planStatus' ? hint : realGet(id);
  try {
    await X.manualInstallFiles([{name: 'z_full.json', bytes: packJSON('Z', '1.0.0')}, {name: 'bad.json', bytes: 'nope{'},
      {name: 'photo.png', bytes: 'xxxx'}, {name: 'y_full.json', webkitRelativePath: 'dir/sub/y_full.json', bytes: packJSON('Y', '2.0.0')}], {back: 'settings'});
    const p = planned[0];
    ck('#102 chosen files and a folder\'s files become plan lines', p && p.lines.map(l => l.cand.system + ':' + l.outcome).sort().join() === 'Y:install,Z:install' && p.opts.back === 'settings', p && p.lines);
    ck('#102 only .json and .zip files are read', reads === 3, reads);
    ck('#102 a file that can\'t be used is named in the dialog', hint.inserted.some(x => /Skipped bad\.json: it isn(?:'|&#39;)t valid JSON\./.test(x)), hint.inserted);
    // a drop: a folder entry holding a pack and a sub-folder, read recursively; a dragged string is ignored
    const fileEntry = (name, bytes) => ({isFile: true, isDirectory: false, name, file: cb => cb({name, bytes})});
    const dirEntry = (name, kids) => ({isFile: false, isDirectory: true, name, createReader: () => { let done = false; return {readEntries: cb => { const out = done ? [] : kids; done = true; cb(out); }}; }});
    const dt = {items: [
      {kind: 'file', webkitGetAsEntry: () => dirEntry('pack', [fileEntry('w_full.json', packJSON('W', '1.0.0')), dirEntry('more', [fileEntry('v_full.json', packJSON('V', '1.0.0'))])])},
      {kind: 'string', webkitGetAsEntry: () => null},
      {kind: 'file', webkitGetAsEntry: () => fileEntry('u_full.json', packJSON('U', '1.0.0'))}], files: []};
    const got = await X.readDropped(dt);
    ck('#102 a dropped folder is read recursively, with its paths', got.map(g => g.name).sort().join() === 'pack/more/v_full.json,pack/w_full.json,u_full.json', got.map(g => g.name));
    const plain = await X.readDropped({items: [], files: [{name: 'z_full.json', bytes: packJSON('Z', '1.0.0')}]});
    ck('#102 a drop without entries falls back to its files', plain.length === 1 && plain[0].name === 'z_full.json');
    const noEntry = await X.readDropped({items: [{kind: 'file', webkitGetAsEntry: () => null, getAsFile: () => ({name: 't_full.json', bytes: packJSON('T', '1.0.0')})},
      {kind: 'file', webkitGetAsEntry: () => null, getAsFile: () => ({name: 'pic.png', bytes: 'x'})}], files: []});
    ck('#102 a file item with no entry is read as a file; a non-pack is not', noEntry.map(g => g.name).join() === 't_full.json', noEntry.map(g => g.name));
  } finally {
    ctx.FileReader = realFR; ctx.openInstallPlan = realPlan; ctx.document.getElementById = realGet;
  }
  X.resetRules();
});

section('#102 the Extensions pill', () => {
  X.resetRules();
  X.importPack({system: 'A', dataVersion: '1.0.0', spells: [{name: 'A1', level: 1}]}, 'a_full.json');
  X.settings.sources = [{id: 'm1', kind: 'manifest', url: 'https://m.example/m.json', on: true, checked: 1, error: '', base: 'https://m.example/m.json',
    manifest: X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [{file: 'a_full.json', system: 'A', version: '1.1.0', sha256: 'a'.repeat(64)}]}, 100)}];
  X.settings.dismissedUpdates = {};
  const wrap = fakeEl({hidden: true}), go = fakeEl(), realGet = ctx.document.getElementById;
  ctx.document.getElementById = id => id === 'extPill' ? wrap : id === 'extPillGo' ? go : realGet(id);
  try {
    X.renderExtPill();
    ck('#102 the pill shows "Extensions · 1 update", the long part droppable at 390px',
      wrap.hidden === false && /<span class="extpill-long">Extensions · <\/span>1 update$/.test(go.innerHTML) && /Settings → Extensions/.test(go.title), go.innerHTML);
    X.dismissUpdates(); X.renderExtPill();
    ck('#102 its × clears it until a newer version', wrap.hidden === true);
  } finally { ctx.document.getElementById = realGet; }
  X.resetRules(); X.settings.sources = []; X.settings.dismissedUpdates = {};
});

section('#102 Task 5 review minors', () => {
  // 1: focus survives a repaint by its data-ext-* key, and a removed row falls back
  const sec = key => ({querySelector: () => ({dataset: {extSec: key}})});
  const el = (ds, key) => ({id: '', dataset: ds, closest: s => s === '.ext-sec' ? sec(key) : null});
  ck('#102 m1: a keyed control is found again by its key',
    X.extFocusTargets(el({extSrcOn: 'official'}, 'sources')).join('|') === '[data-ext-src-on="official"]|#extAddUrl', X.extFocusTargets(el({extSrcOn: 'official'}, 'sources')));
  ck('#102 m1: a rules row falls back to its section toggle',
    X.extFocusTargets(el({extOpen: 'A|a.json'}, 'rules')).join('|') === '[data-ext-open="A|a.json"]|[data-ext-sec="rules"]');
  ck('#102 m1: a hostile key is escaped', X.extFocusTargets(el({extOpen: 'a"]b\\'}, 'rules'))[0] === '[data-ext-open="a\\"]b\\\\"]');
  const realCSS = ctx.CSS; ctx.CSS = {escape: s => 'E(' + s + ')'};
  ck('#102 m1: CSS.escape is used where it exists', X.extFocusTargets(el({extSrcDel: 'p1'}, 'sources'))[0] === '[data-ext-src-del="E(p1)"]');
  ck('#102 m1: an id is kept by id', X.extFocusTargets({id: 'extAddGo', dataset: {}, closest: () => null})[0] === '#E(extAddGo)');
  ctx.CSS = realCSS;
  // 2: a requirement button carries its file, and opens that file's offer
  X.resetRules();
  X.settings.sources = [{id: 'm1', kind: 'manifest', url: 'https://m.example/m.json', on: true, checked: 1, error: '', base: 'https://m.example/m.json',
    manifest: X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [
      {file: 'other_full.json', system: 'S', version: '1.0.0', sha256: 'a'.repeat(64)},
      {file: 's_full.json', system: 'S', version: '1.0.0', sha256: 'b'.repeat(64)}]}, 100)}];
  const chip = X.extReqChip({pack: 'S', file: 's_full.json', url: ''});
  ck('#102 m2: the requirement button carries its file', /<button[^>]*data-ext-req="S"[^>]*data-ext-req-file="s_full\.json"/.test(chip), chip);
  const realOpen = ctx.openExtDetails, seen = []; ctx.openExtDetails = k => seen.push(k);
  X.extReqTap({dataset: {extReq: 'S', extReqFile: 's_full.json'}});
  X.extReqTap({dataset: {extReq: 'S'}});
  ctx.openExtDetails = realOpen;
  ck('#102 m2: tapping it opens that file, not the first file of the pack', seen[0] === 'S|s_full.json' && seen[1] === 'S|other_full.json', seen);
  // 3: the "isn't listed any more" dialog has a Close back to Settings
  const gone = X.extDetailsHTML('Nope|nope.json');
  ck("#102 m3: the \"isn't listed\" dialog has the Close foot", /isn(?:'|&#39;)t listed any more/.test(gone) && /id="extDlgClose"/.test(gone), gone);
  X.settings.sources = [];
  // 4: wrapped chips' 44px hit areas don't overlap the next row
  const css = fs.readFileSync(path.join(ROOT, 'src/css/50-modal.css'), 'utf8');
  ck('#102 m4: .ext-chips rows are 12px apart', /\.ext-chips\{[^}]*row-gap:12px/.test(css), (/\.ext-chips\{[^}]*\}/.exec(css) || [])[0]);
  // 6: the live region sits outside #extPage, so a repaint never recreates it
  const setSrc = fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8');
  const extSrc = fs.readFileSync(path.join(ROOT, 'src/js/89-extensions.js'), 'utf8');
  const render = extSrc.slice(extSrc.indexOf('function renderExtUI('), extSrc.indexOf('function extSaveSources('));
  ck('#102 m6: #rulesStatus is not part of the repainted page', !/rulesStatus/.test(X.extPageHTML()));
  ck('#102 m6: Settings draws #rulesStatus beside the page, as a live region',
    /const secRules=extPageHTML\(\)\+[\s\S]*?id="rulesStatus" role="status"[\s\S]*?\n  const /.test(setSrc));
  ck('#102 m6: renderExtUI no longer keeps the status line itself', render.length > 0 && !/rulesStatus/.test(render), render.slice(0, 200));
});

section('#102 every rules file input goes through Manual install', () => {
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  const setSrc = fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8');
  const tpl = fs.readFileSync(path.join(ROOT, 'src/fieldbook.template.html'), 'utf8');
  ['homeRulesFiles', 'rbRulesFiles'].forEach(id => ck('#102 ' + id + ' opens the plan through manualInstallFiles',
    new RegExp('getElementById\\("' + id + '"\\)\\.addEventListener\\("change",[^\\n]*manualInstallFiles\\(e\\.target\\.files\\)').test(boot)));
  ck('#102 fix 5: #fileRules is gone (Manual install has its own inputs)', !/fileRules/.test(setSrc));
  ck('#102 no file input imports straight past the plan', !/importRulesFiles\(e\.target\.files\)/.test(boot + setSrc));
  ck('#102 the top bar has the Extensions pill and both ×s',
    ['extPill', 'extPillGo', 'extPillX', 'updatePillX'].every(id => tpl.includes('id="' + id + '"')));
  ck('#102 the pills are wired', ['updatePillX', 'extPillGo', 'extPillX'].every(id => boot.includes('getElementById("' + id + '")')));
});

section('#102 Task 6 fix round 1', async () => {
  const tick = () => new Promise(r => setImmediate(r));
  const realGet = ctx.document.getElementById, realQSA = ctx.document.querySelectorAll;
  const realRun = ctx.runInstall, realToast = ctx.toast, realPlan = ctx.openInstallPlan, realFR = ctx.FileReader, realSave = ctx.saveRulesCache;
  const toasts = []; ctx.toast = (msg, a, o) => toasts.push(msg);
  const cls = () => { const set = new Set(); return {add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c)}; };
  try {
    // 1: no second install while one runs
    X.resetRules();
    const c = system => ({key: system + '|' + system + '.json', category: 'rules', system, file: system + '.json', title: system, version: '1.0.0',
      minApp: '', sha256: '', size: 10, requires: [], origin: 'm1', manual: false, get: () => Promise.resolve(new Uint8Array())});
    const lines = X.planInstall([c('P'), c('Q')]);
    const go = fakeEl(), close = fakeEl(), status = fakeEl();
    const boxes = lines.map((l, i) => fakeEl({checked: true, dataset: {planI: String(i)}}));
    ctx.document.getElementById = id => ({planGo: go, planClose: close, planStatus: status})[id] || realGet(id);
    ctx.document.querySelectorAll = sel => sel === '[data-plan-i]' ? boxes : realQSA(sel);
    let release, runs = 0; ctx.runInstall = () => { runs++; return new Promise(r => { release = r; }); };
    X.openInstallPlan(lines, {});
    go.fire('click');
    boxes[0].checked = false; boxes[0].fire('change');
    ck('#102 fix 1: a checkbox change mid-install leaves Install disabled', go.disabled === true && lines[0].ticked === true && boxes[0].checked === true, [go.disabled, lines[0].ticked]);
    ck('#102 fix 1: the ticks and Cancel are disabled while it runs', boxes.every(b => b.disabled === true) && close.disabled === true);
    go.fire('click');
    ck('#102 fix 1: a second press does not start a second install', runs === 1, runs);
    release({ok: false, installed: [], error: {file: 'q.json', why: 'boom'}, saveErr: '', skipped: {}});
    await tick();
    ck('#102 fix 1: after a failure the ticks, Cancel and Install come back', go.disabled === false && close.disabled === false && boxes.every(b => b.disabled === false) && /q\.json/.test(status.textContent));
    ctx.document.getElementById = realGet; ctx.document.querySelectorAll = realQSA; ctx.runInstall = realRun;
    // 2: the home status line follows an install
    const home = fakeEl({textContent: 'No rules loaded.'});
    ctx.document.getElementById = id => id === 'homeRulesStatus' ? home : realGet(id);
    ctx.saveRulesCache = () => Promise.resolve('');
    const body = packJSON('Home', '1.0.0');
    const r = await X.runInstall([{cand: {key: 'Home|home_full.json', category: 'rules', system: 'Home', file: 'home_full.json', title: 'Home', version: '1.0.0',
      minApp: '', sha256: '', size: 1, requires: [], origin: 'manual', manual: true, get: () => Promise.resolve(new TextEncoder().encode(body))}, outcome: 'install', ticked: true, canTick: true}]);
    ck('#102 fix 2: #homeRulesStatus says what is loaded after an install', r.ok && home.textContent === X.rulesStatusText() && /Home|1 spell/.test(home.textContent), home.textContent);
    ctx.document.getElementById = realGet; ctx.saveRulesCache = realSave; X.resetRules(); X.settings.packOrigin = {};
    // 6 + 7: the whole dialog takes a drop, wired once; a drop with nothing usable says so
    const modal = fakeEl(), zone = fakeEl({classList: cls()});
    ctx.document.getElementById = id => id === 'modal' ? modal : id === 'miDrop' ? zone : id === 'extPage' ? null : realGet(id);
    X.extWireDrop(zone); X.extWireDrop(zone);
    let prevented = 0; const ev = o => Object.assign({preventDefault: () => prevented++, target: {}}, o || {});
    const n = modal.fire('dragover', ev()).length;
    ck('#102 fix 6: the dialog catches a drag anywhere in it, wired once', n === 1 && prevented === 1 && zone.classList.contains('ext-dropping'), [n, prevented]);
    toasts.length = 0;
    modal.fire('drop', ev({dataTransfer: {items: [], files: [{name: 'photo.png', bytes: 'x'}]}}));
    await tick(); await tick();
    ck('#102 fix 6: a drop outside the box is still caught', prevented === 2 && !zone.classList.contains('ext-dropping'));
    ck('#102 fix 7: a drop with no .json or .zip says so', toasts.includes('Nothing to install: drop rules packs (.json) or a data zip.'), toasts);
    ctx.document.getElementById = id => id === 'modal' ? modal : (id === 'miDrop' || id === 'extPage') ? null : realGet(id);
    prevented = 0; modal.fire('dragover', ev());
    ck('#102 fix 6: with no drop zone open, a drag is left alone', prevented === 0);
    ctx.document.getElementById = realGet;
    // 7: a pick with nothing usable says so, and opens no plan
    const planned = []; ctx.openInstallPlan = (l, o) => planned.push(l);
    ctx.FileReader = class { readAsArrayBuffer(f) { const b = Buffer.from(f.bytes); this.result = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); this.onload(); } };
    toasts.length = 0;
    await X.manualInstallFiles([{name: 'photo.png', bytes: 'x'}, {name: 'notes.txt', bytes: 'y'}]);
    ck('#102 fix 7: a pick with no .json or .zip says so', planned.length === 0 && toasts.includes('Nothing to install: drop rules packs (.json) or a data zip.'), toasts);
    // 8: a folder read stops at 2,000 files, and the plan says what it skipped
    const files = []; for (let i = 0; i < X.EXT_DROP_MAX + 3; i++) files.push({name: 'p' + i + '.json', bytes: '{'});
    const fileEntry = f => ({isFile: true, isDirectory: false, name: f.name, file: cb => cb(f)});
    const dir = {isFile: false, isDirectory: true, name: 'big', createReader: () => { let done = false; return {readEntries: cb => { const out = done ? [] : files.map(fileEntry).concat([fileEntry({name: 'a.png', bytes: 'x'})]); done = true; cb(out); }}; }};
    const got = await X.readDropped({items: [{kind: 'file', webkitGetAsEntry: () => dir}], files: []});
    ck('#102 fix 8: a folder read stops at 2,000 files', X.EXT_DROP_MAX === 2000 && got.length === 2000 && got.extra && got.extra.capped === 3 && got.extra.ignored === 1, [got.length, got.extra]);
    const note = fakeEl();
    ctx.document.getElementById = id => id === 'planStatus' ? note : realGet(id);
    X.extManualPlan(got, {}, got.extra);
    const said = note.inserted.join(' ');
    ck('#102 fix 8: the plan says how many were skipped, not 2,000 sentences',
      /Skipped big\/p0\.json: it isn(?:'|&#39;)t valid JSON\./.test(said) && /and 1,995 more couldn(?:'|&#39;)t be used/.test(said) &&
      /1 file that isn(?:'|&#39;)t \.json or \.zip/.test(said) && /stopped at 2,000 files/i.test(said) && /3 more weren(?:'|&#39;)t read/.test(said), said);
    ctx.document.getElementById = realGet;
    // 9: focus after a pill's × goes to the version button, or Home
    const ver = fakeEl({offsetParent: null}), homeBtn = fakeEl(); let focused = '';
    ver.focus = () => { focused = 'ver'; }; homeBtn.focus = () => { focused = 'home'; };
    ctx.document.getElementById = id => id === 'btnVer' ? ver : id === 'btnHome' ? homeBtn : realGet(id);
    X.extPillFocusBack();
    ck('#102 fix 9: with the version button hidden, focus goes Home', focused === 'home');
    ver.offsetParent = {}; X.extPillFocusBack();
    ck('#102 fix 9: with it showing, focus goes to the version button', focused === 'ver');
  } finally {
    ctx.document.getElementById = realGet; ctx.document.querySelectorAll = realQSA; ctx.runInstall = realRun; ctx.toast = realToast;
    ctx.openInstallPlan = realPlan; ctx.FileReader = realFR; ctx.saveRulesCache = realSave;
  }
  // 3 + 4: the ×'s hit area, and the notice row up to 560px
  const css = fs.readFileSync(path.join(ROOT, 'src/css/10-chrome.css'), 'utf8');
  // fix round 2: the hit area grows up, down and right, never left into the pill it clears (38 + 6 = 44 wide, 32 + 12 = 44 tall)
  ck('#102 fix 3: the pill × has a 44px hit area that stays off its pill',
    /\.updpill-x\{[^}]*position:relative/.test(css) && /\.updpill-x::after\{[^}]*inset:-6px -6px -6px 0[;}]/.test(css) &&
    /\.updpill-x\{[^}]*min-width:38px[^}]*min-height:32px/.test(css) && /\.updpill-x\{[^}]*margin-left:-8px/.test(css), (/\.updpill-x(::after)?\{[^}]*\}/g.exec(css) || [])[0]);
  ck('#102 fix 4: the notices take their own row up to 560px', /@media \(max-width:560px\)\{\.extpill-long\{display:none\}#updatePill,#updatePillX,\.extpill\{order:5\}\}/.test(css));
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  ck('#102 fix 9: both ×s hand focus back', (boot.match(/extPillFocusBack\(\)/g) || []).length === 2);
  X.resetRules();
});

section('#102 Task 6 fix round 2: the plan cannot be dismissed while it installs', async () => {
  const tick = () => new Promise(r => setImmediate(r));
  const realGet = ctx.document.getElementById, realQSA = ctx.document.querySelectorAll, realRun = ctx.runInstall, realClose = ctx.closeModal, realToast = ctx.toast;
  let closes = 0; ctx.closeModal = () => { closes++; realClose(); };
  ctx.toast = () => {};
  try {
    X.resetRules();
    const c = system => ({key: system + '|' + system + '.json', category: 'rules', system, file: system + '.json', title: system, version: '1.0.0',
      minApp: '', sha256: '', size: 10, requires: [], origin: 'm1', manual: false, get: () => Promise.resolve(new Uint8Array())});
    const lines = X.planInstall([c('P')]);
    const go = fakeEl(), close = fakeEl(), status = fakeEl(), boxes = [fakeEl({checked: true, dataset: {planI: '0'}})];
    ctx.document.getElementById = id => ({planGo: go, planClose: close, planStatus: status})[id] || realGet(id);
    ctx.document.querySelectorAll = sel => sel === '[data-plan-i]' ? boxes : realQSA(sel);
    let release; ctx.runInstall = () => new Promise(r => { release = r; });
    X.openInstallPlan(lines, {});
    X.dismissModal();
    ck('#102 fix2 I1: before Install, × and Escape close the plan as usual', closes === 1, closes);
    X.openInstallPlan(lines, {});
    closes = 0; state.lastConfirm = null;
    go.fire('click');
    X.dismissModal(); X.dismissModal();
    ck('#102 fix2 I1: while it installs, × and Escape leave the dialog open, with no prompt', closes === 0 && state.lastConfirm === null, [closes, state.lastConfirm]);
    ck('#102 fix2 I1: ...and the status line says to wait', status.textContent === 'Installing… please wait.', status.textContent);
    release({ok: false, installed: [], error: {file: 'p.json', why: 'boom'}, saveErr: '', skipped: {}});
    await tick();
    X.dismissModal();
    ck('#102 fix2 I1: after a failure the guard is gone and × closes it', closes === 1 && /p\.json/.test(status.textContent), [closes, status.textContent]);
    // after a success: back() closes, and no guard is left for the next dialog
    X.openInstallPlan(lines, {});
    go.fire('click');
    release({ok: true, installed: ['P'], error: null, saveErr: '', skipped: {}});
    await tick();
    closes = 0;
    X.dismissModal();
    ck('#102 fix2 I1: after a success no guard is left behind for later dialogs', closes === 1, closes);
  } finally {
    ctx.document.getElementById = realGet; ctx.document.querySelectorAll = realQSA; ctx.runInstall = realRun; ctx.closeModal = realClose; ctx.toast = realToast;
  }
  X.resetRules();
});

section('#102 Ruling 16: a manifest source is named with its host, and a stranger\'s update says who offers it', () => {
  /* the final review's live repro (I2): SRD 5.2 imported by hand (every
     pre-#102 player's state), plus a manifest at evil.example that calls
     itself "Fieldbook public data" and offers SRD 5.2|srd52_full.json */
  X.resetRules();
  X.importPack({system: 'SRD 5.2', dataVersion: '1.8.0', spells: [{name: 'Bless', level: 1}]}, 'srd52_full.json');
  const man = (name, packs) => X.readManifest({_type: 'fieldbook-data', name, builtFor: '1.0.0', packs}, 100);
  const srd = v => ({file: 'srd52_full.json', system: 'SRD 5.2', version: v, sha256: 'a'.repeat(64), title: 'SRD 5.2 — System Reference Document'});
  const official = (packs) => ({id: 'official', kind: 'official', url: '', on: true, checked: 0, error: '', base: 'https://raw.example/fieldbook-data.json', manifest: packs ? man('Fieldbook public data', packs) : null});
  const evil = {id: 'evil', kind: 'manifest', url: 'https://evil.example/fieldbook-data.json', on: true, checked: 0, error: '',
    base: 'https://evil.example/fieldbook-data.json', manifest: man('Fieldbook public data', [srd('1.8.1')])};
  X.settings.sources = [official(null), evil];
  X.settings.packOrigin = {}; X.settings.dismissedUpdates = {}; X.settings.setCollapse = {};
  const KEY = 'SRD 5.2|srd52_full.json';
  /* "Fieldbook public data" NOT followed by the host: what only the official source may read */
  const bare = /Fieldbook public data(?! \(evil\.example\))/;
  const row = () => X.extRowHTML(X.extPackRows().find(r => r.key === KEY));
  let h = row();
  ck('#102 I2: the hand-imported row says who offers the update, by name and host',
    /update from Fieldbook public data \(evil\.example\)/.test(h) && /1\.8\.0 → <b class="ext-up">1\.8\.1/.test(h), h);
  ck('#102 I2: ...and nothing on the row reads as the official source', !bare.test(h), h);
  const plan = () => X.extPlanHTML(X.planInstall([X.offerCandidate(X.extPackRows().find(r => r.key === KEY).offer)]));
  let p = plan();
  ck('#102 I2: the plan line says "update from" the stranger, with its host',
    /update from Fieldbook public data \(evil\.example\)/i.test(p) && !bare.test(p), p);
  const d = X.extDetailsHTML(KEY);
  ck('#102 I2: the details\' Source box names it with its host', /Name<\/span>Fieldbook public data \(evil\.example\)/.test(d) && !bare.test(d), d);
  const srcs = X.extSourcesHTML();
  ck('#102 I2: the Sources list names it with its host', /<b>Fieldbook public data \(evil\.example\)<\/b>/.test(srcs), srcs);
  // installed by hand (packOrigin "manual") is the same: not the offering source
  X.settings.packOrigin = {[KEY]: 'manual'};
  ck('#102 I2: a pack whose origin is "manual" also says who offers the update', /update from Fieldbook public data \(evil\.example\)/.test(row()), row());
  // a name with markup is escaped, and still carries the host
  evil.manifest = man('<b>Fieldbook public data</b>', [srd('1.8.1')]);
  h = row();
  ck('#102 I2: an escaped name still carries its host', /update from &lt;b&gt;Fieldbook public data&lt;\/b&gt; \(evil\.example\)/.test(h) && !h.includes('<b>Fieldbook'), h);
  evil.manifest = man('Fieldbook public data', [srd('1.8.1')]);
  // the "Also from" box names the source too
  evil.manifest = man('Fieldbook public data', [srd('1.8.1'), {file: 'x_full.json', system: 'X', version: '1.0.0', sha256: 'b'.repeat(64)}]);
  ck('#102 I2: "Also from" names the source with its host', /Also from Fieldbook public data \(evil\.example\)/.test(X.extDetailsHTML(KEY)), X.extDetailsHTML(KEY));
  // the official source: the bare name, and the pack it installed reads "from", not "update from"
  X.settings.sources = [official([srd('1.9.0')]), evil];
  X.settings.packOrigin = {[KEY]: 'official'};
  h = row(); p = plan();
  ck('#102 I2: the official source alone reads "Fieldbook public data", with no host',
    /from Fieldbook public data</.test(h) && !/update from/.test(h) && !/\(raw\.example\)/.test(h), h);
  ck('#102 I2: ...and its own update\'s plan line is a plain "from"', /Update · from Fieldbook public data</.test(p) && !/update from/.test(p), p);
  // the stranger's own install: once it installed the pack, its row reads plain "from", with the host
  X.settings.sources = [official(null), evil];
  X.settings.packOrigin = {[KEY]: 'evil'};
  h = row();
  ck('#102 I2: the installing source reads "from name (host)", not "update from"',
    /from Fieldbook public data \(evil\.example\)/.test(h) && !/update from/.test(h), h);
  X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {}; X.settings.dismissedUpdates = {};
});

section('#102 Ruling 17: the size caps hold without a Content-Length, by counting the stream', async () => {
  /* the final review's live repro (I3): a chunked answer with no
     Content-Length used to be buffered whole (80 MB against a 64 KB cap)
     before anything refused it */
  const realFetch = ctx.fetch, realAC = ctx.AbortController;
  ctx.AbortController = AbortController;
  /* a body that yields `chunk`-byte pieces, `max` of them (Infinity: forever) */
  const streamed = (chunk, max, opts) => {
    const o = opts || {}, log = {reads: 0, cancelled: false, arrayBuffer: false, signal: null};
    const res = {ok: true, status: 200, headers: {get: () => null},
      body: {getReader: () => ({
        read: () => {
          if (o.stallAfter != null && log.reads >= o.stallAfter) { log.reads++; return new Promise(() => {}); }
          if (log.cancelled || log.reads >= max) return Promise.resolve({done: true, value: undefined});
          log.reads++;
          return Promise.resolve({done: false, value: new Uint8Array(chunk).fill(log.reads % 251)});
        },
        cancel: () => { log.cancelled = true; return Promise.resolve(); },
        releaseLock() {}})},
      arrayBuffer: () => { log.arrayBuffer = true; return Promise.resolve(new ArrayBuffer(chunk * Math.min(max, 4))); }};
    return {res, log};
  };
  try {
    // a manifest check: 16 KB chunks with no end, against the 64 KB cap
    let s = streamed(16384, Infinity);
    ctx.fetch = (u, opts) => { s.log.signal = opts && opts.signal; return Promise.resolve(s.res); };
    let msg = '';
    try { await X.extFetchBytes('https://flood.example/m.json', 1000, X.EXT_MAN_MAX); } catch (e) { msg = e.message; }
    ck('#102 I3: a stream past the 64 KB cap is refused with the cap message', msg === 'the manifest is larger than 64 KB', msg);
    ck('#102 I3: ...after reading just past the cap, never the whole body', s.log.reads === 5 && !s.log.arrayBuffer, s.log);
    ck('#102 I3: ...and the reader is cancelled and the request aborted', s.log.cancelled && s.log.signal && s.log.signal.aborted === true, s.log);
    // a pack file: the 32 MB cap, the same way (1 MB chunks)
    s = streamed(1048576, Infinity);
    ctx.fetch = (u, opts) => { s.log.signal = opts && opts.signal; return Promise.resolve(s.res); };
    msg = '';
    try { await X.extFetchBytes('https://flood.example/p.json', 1000, X.EXT_FILE_MAX); } catch (e) { msg = e.message; }
    ck('#102 I3: a pack stream past 32 MB is refused with the cap message', msg === "it's larger than 32 MB" && s.log.reads === 33 && s.log.cancelled, [msg, s.log.reads]);
    // under the cap: the exact bytes, in order
    s = streamed(1000, 3);
    ctx.fetch = () => Promise.resolve(s.res);
    const got = await X.extFetchBytes('https://ok.example/m.json', 1000, X.EXT_MAN_MAX);
    const want = Buffer.concat([1, 2, 3].map(i => Buffer.alloc(1000, i % 251)));
    ck('#102 I3: a stream under the cap returns exactly its bytes', got.length === 3000 && Buffer.from(got).equals(want) && !s.log.arrayBuffer, got.length);
    // exactly at the cap is allowed
    s = streamed(16384, 4);
    ctx.fetch = () => Promise.resolve(s.res);
    const at = await X.extFetchBytes('https://ok.example/m.json', 1000, X.EXT_MAN_MAX);
    ck('#102 I3: exactly 64 KB is not over the cap', at.length === X.EXT_MAN_MAX, at.length);
    // no body stream: arrayBuffer, and the cap is still checked after
    const noBody = n => ({ok: true, status: 200, headers: {get: () => null}, arrayBuffer: () => Promise.resolve(new ArrayBuffer(n))});
    ctx.fetch = () => Promise.resolve(noBody(X.EXT_MAN_MAX + 1));
    msg = '';
    try { await X.extFetchBytes('https://old.example/m.json', 1000, X.EXT_MAN_MAX); } catch (e) { msg = e.message; }
    ck('#102 I3: with no body stream, arrayBuffer is the fallback and the cap still holds', msg === 'the manifest is larger than 64 KB', msg);
    ctx.fetch = () => Promise.resolve(noBody(10));
    ck('#102 I3: ...and a small body still reads', (await X.extFetchBytes('https://old.example/m.json', 1000, X.EXT_MAN_MAX)).length === 10);
    // the timeout covers the whole stream: a body that stalls after one chunk
    const realST = ctx.setTimeout, realCT = ctx.clearTimeout;
    ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;
    s = streamed(100, Infinity, {stallAfter: 1});
    ctx.fetch = (u, opts) => { s.log.signal = opts && opts.signal; return Promise.resolve(s.res); };
    msg = '';
    const t0 = Date.now();
    try { await X.extFetchBytes('https://slow.example/m.json', 50, X.EXT_MAN_MAX); } catch (e) { msg = e.message; }
    ctx.setTimeout = realST; ctx.clearTimeout = realCT;
    ck('#102 I3: a stream that stalls mid-body still times out, and is stopped', /took too long/.test(msg) && Date.now() - t0 < 2000 && s.log.signal.aborted && s.log.cancelled, [msg, s.log]);
    // a boot check against a flooding manifest source: refused, the error on its row
    s = streamed(16384, Infinity);
    ctx.fetch = () => Promise.resolve(s.res);
    const src = {id: 'f', kind: 'manifest', url: 'https://flood.example/m.json', on: true, checked: 0, error: '', manifest: null, base: ''};
    await X.checkSource(src);
    ck('#102 I3: checkSource refuses a flooding manifest and says why', /larger than 64 KB/.test(src.error) && s.log.reads === 5, [src.error, s.log.reads]);
    // addSource is capped too: it used to pass no cap at all
    X.settings.sources = [];
    s = streamed(1048576, Infinity);
    ctx.fetch = () => Promise.resolve(s.res);
    const r = await X.addSource('https://flood.example/add.json');
    ck('#102 I3: addSource stops a body with no end at the 32 MB cap', r.ok === false && /larger than 32 MB/.test(r.why) && s.log.reads === 33 && s.log.cancelled, [r, s.log.reads]);
    ck('#102 N2: ...and says the answer was too large, not that the host couldn\'t be reached',
      r.why === 'Its answer is larger than 32 MB.' && !/couldn't be reached/.test(r.why), r.why);
    // ...a manifest over 64 KB is still refused (readManifest's own check)...
    const bigMan = JSON.stringify({_type: 'fieldbook-data', builtFor: '1.0.0', pad: 'x'.repeat(X.EXT_MAN_MAX), packs: []});
    ctx.fetch = () => Promise.resolve(noBody(0)).then(res => Object.assign(res, {arrayBuffer: () => Promise.resolve(new TextEncoder().encode(bigMan).buffer)}));
    const r2 = await X.addSource('https://big.example/m.json');
    ck('#102 I3: addSource still refuses a manifest over 64 KB', r2.ok === false && /larger than 64 KB/.test(r2.why), r2);
    // ...while a plain rules file over 64 KB, which spec §4 allows as a source, still adds
    const bigPlain = JSON.stringify({system: 'Big', dataVersion: '1.0.0', spells: [{name: 'B', text: 'y'.repeat(200000)}]});
    ctx.fetch = () => Promise.resolve(noBody(0)).then(res => Object.assign(res, {arrayBuffer: () => Promise.resolve(new TextEncoder().encode(bigPlain).buffer)}));
    const r3 = await X.addSource('https://big.example/plain.json');
    ck('#102 I3: a plain rules file over 64 KB still adds as a source', r3.ok === true && X.settings.sources.some(x => x.kind === 'plain' && x.url === 'https://big.example/plain.json'), r3);
  } finally {
    ctx.fetch = realFetch; ctx.AbortController = realAC; X.settings.sources = [];
  }
});

section("#102 Ruling 18 (M8): a garbled release list reads as GitHub's, not a parser message", async () => {
  const realFetch = ctx.fetch;
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  const LIST = 'https://api.github.com/repos/wardmanm/RPGFieldbook/releases?per_page=100';
  const off = () => ({id: 'official', kind: 'official', url: '', on: true, checked: 0, error: '', manifest: null, base: ''});
  try {
    extRoutes[LIST] = '<html>rate limited</html>';
    let src = off();
    await X.checkSource(src);
    ck("#102 M8: an answer that isn't JSON says GitHub's release list couldn't be read", src.error === "GitHub's release list couldn't be read", src.error);
    extRoutes[LIST] = {message: 'Moved'};
    src = off();
    await X.checkSource(src);
    ck('#102 M8: ...and so does JSON that is not a list', src.error === "GitHub's release list couldn't be read", src.error);
    extRoutes[LIST] = [];
    src = off();
    await X.checkSource(src);
    ck('#102 M8: an empty list is still "nothing to offer", not an error', src.error === '' && src.manifest === null, src);
  } finally { ctx.fetch = realFetch; }
});

section('#102 N1: invisible format characters are stripped, so a bidi override cannot reverse the host', () => {
  const RLO = '‮';
  // extText strips every \p{Cf} before the cap, and keeps everything else
  ck('#102 N1: extText strips U+200B, U+FEFF, U+2066 and U+202E',
    X.extText('a​b﻿c⁦d‮e⁩f‎‏؜g', 200) === 'abcdefg', JSON.stringify(X.extText('a​b﻿c⁦d‮e', 200)));
  ck('#102 N1: ...before the cap, so stripped characters never use up the length',
    X.extText('‮‮‮abcdef', 3) === 'abc', X.extText('‮‮‮abcdef', 3));
  const kept = 'Café Élan — naïve façade 🐉 ✨ 日本語 עברית';
  ck('#102 N1: accented, emoji, CJK and right-to-left letters are kept', X.extText(kept, 200) === kept, X.extText(kept, 200));
  // every manifest string goes through it
  const m = X.readManifest({_type: 'fieldbook-data', name: 'N' + RLO, builtFor: '1.0.0', packs: [
    {file: 'a_full.json', system: 'A', version: '1.0.0', sha256: 'a'.repeat(64), title: 'T' + RLO, summary: 'S​', description: 'D﻿',
      license: 'L⁦', attribution: 'At‮', requires: [{pack: 'R‮'}]},
    {file: 'b_full.json', system: 'B' + RLO, version: '1.0.0', sha256: 'b'.repeat(64)}]}, 100);
  const e = m.packs[0];
  ck('#102 N1: name, title, summary, description, licence, attribution and requires.pack are all stripped',
    m.name === 'N' && e.title === 'T' && e.summary === 'S' && e.description === 'D' && e.license === 'L' && e.attribution === 'At' && e.requires[0].pack === 'R',
    JSON.stringify([m.name, e.title, e.summary, e.description, e.license, e.attribution, e.requires[0].pack]));
  ck('#102 N1: a title that falls back to the system is stripped too', m.packs[1].title === 'B', JSON.stringify(m.packs[1].title));
  // the reviewer's exact repro: the host must read forwards in the row, the plan line and the Sources title
  X.resetRules();
  X.importPack({system: 'SRD 5.2', dataVersion: '1.8.0', spells: [{name: 'Bless', level: 1}]}, 'srd52_full.json');
  const spoof = {id: 'sp', kind: 'manifest', url: 'https://moc.buhtig.ws/m.json', on: true, checked: 0, error: '', base: 'https://moc.buhtig.ws/m.json',
    manifest: X.readManifest({_type: 'fieldbook-data', name: 'Fieldbook public data ' + RLO, builtFor: '1.0.0', packs: [
      {file: 'srd52_full.json', system: 'SRD 5.2', version: '1.8.1', sha256: 'a'.repeat(64), title: 'SRD 5.2'}]}, 100)};
  X.settings.sources = [{id: 'official', kind: 'official', url: '', on: true, checked: 0, error: '', manifest: null, base: ''}, spoof];
  X.settings.packOrigin = {}; X.settings.dismissedUpdates = {};
  const KEY = 'SRD 5.2|srd52_full.json';
  const row = X.extRowHTML(X.extPackRows().find(r => r.key === KEY));
  const plan = X.extPlanHTML(X.planInstall([X.offerCandidate(X.extPackRows().find(r => r.key === KEY).offer)]));
  const srcs = X.extSourcesHTML();
  [['row', row], ['plan line', plan], ['Sources title', srcs]].forEach(([what, h]) =>
    ck('#102 N1: the ' + what + ' shows "moc.buhtig.ws" and no U+202E', h.includes('(moc.buhtig.ws)') && !h.includes(RLO), h));
  // even a source stored before this fix (its manifest name unstripped) is named without it
  spoof.manifest.name = 'Fieldbook public data ' + RLO;
  ck('#102 N1: extSourceName strips a stored name that predates the fix', !X.extSourceName(spoof).includes(RLO) && X.extSourceName(spoof).endsWith('(moc.buhtig.ws)'), X.extSourceName(spoof));
  ck('#102 N1: the host is punycode and clean (an IDN host)', X.extSourceHost({url: 'https://bücher.example/m.json'}) === 'xn--bcher-kva.example', X.extSourceHost({url: 'https://bücher.example/m.json'}));
  X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {};
});

// ---- add new sections above this line ----
(async () => {
  for (const [name, fn] of SECTIONS) {
    try { await fn(); } catch (e) { ck(name + ' ran to the end', false, String((e && e.stack) || e)); }
  }
})().then(() => ck.done());
