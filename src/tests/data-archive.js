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

// ---- add new sections above this line ----
(async () => {
  for (const [name, fn] of SECTIONS) {
    try { await fn(); } catch (e) { ck(name + ' ran to the end', false, String((e && e.stack) || e)); }
  }
})().then(() => ck.done());
