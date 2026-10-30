/* Documentation claims that go stale silently.
 *
 * Every number in this suite was wrong at some point and nobody noticed, because
 * prose has no compiler. These assert the handful of claims that are mechanically
 * checkable — counts, filenames, and the two rendering traps in the changelog
 * notebook. Deliberately NOT a prose linter: it checks facts, not wording, so
 * rewriting a paragraph never breaks it.
 */
const fs = require('fs');
const path = require('path');
const {makeCheck} = require('./harness');

const ck = makeCheck();
const ROOT = path.join(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const manifest = JSON.parse(read('src/manifest.json'));
const claude = read('CLAUDE.md');
const readme = read('README.md');
const runsh = read('src/tests/run.sh');

// ---------- fragment counts quoted in the dev docs
const nJs = manifest.js.length, nCss = manifest.css.length, nHtml = manifest.html.length;
const claudeJs = /js\/\*\.js\s+(\d+) fragments/.exec(claude);
const claudeCss = /css\/\*\.css\s+(\d+) fragments/.exec(claude);
const claudeHtml = /html\/\*\.html\s+(\d+) fragments/.exec(claude);
ck('CLAUDE.md states a JS fragment count', !!claudeJs);
ck('CLAUDE.md JS fragment count is right', claudeJs && +claudeJs[1] === nJs,
   claudeJs && claudeJs[1] + ' vs ' + nJs);
ck('CLAUDE.md states a CSS fragment count', !!claudeCss);
ck('CLAUDE.md CSS fragment count is right', claudeCss && +claudeCss[1] === nCss,
   claudeCss && claudeCss[1] + ' vs ' + nCss);
ck('CLAUDE.md states an HTML fragment count', !!claudeHtml);
ck('CLAUDE.md HTML fragment count is right', claudeHtml && +claudeHtml[1] === nHtml,
   claudeHtml && claudeHtml[1] + ' vs ' + nHtml);

const adr = read('src/docs/ADR-001-source-split.md');
const adrJs = /js\/ \((\d+) fragments\)/.exec(adr);
const adrCss = /css\/ \((\d+)\)/.exec(adr);
const adrHtml = /html\/ \((\d+)\)/.exec(adr);
ck('ADR-001 JS fragment count is right', adrJs && +adrJs[1] === nJs, adrJs && adrJs[1]);
ck('ADR-001 CSS fragment count is right', adrCss && +adrCss[1] === nCss, adrCss && adrCss[1]);
ck('ADR-001 HTML fragment count is right', adrHtml && +adrHtml[1] === nHtml, adrHtml && adrHtml[1]);

// One panel per tab, and the manifest is what the build reads — so an html
// fragment that exists but went unlisted ships nothing, silently.
ck('every html fragment holds exactly one tab panel',
   manifest.html.every(p => (read(p).match(/<section class="tabpanel/g) || []).length === 1),
   manifest.html);

// ---------- suite count
const suites = (/SUITES="([^"]+)"/.exec(runsh) || [, ''])[1].trim().split(/\s+/).filter(Boolean);
ck('run.sh declares suites', suites.length > 0, suites);
suites.forEach(s => {
  const js = fs.existsSync(path.join(ROOT, 'src/tests', s + '.js'));
  const py = fs.existsSync(path.join(ROOT, 'src/tests', s + '.py'));
  ck('suite "' + s + '" exists', js || py);
});
const claudeSuites = /across (\w+) suites/.exec(claude);
const WORDS = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12};
ck('CLAUDE.md states a suite count', !!claudeSuites);
ck('CLAUDE.md suite count is right',
   claudeSuites && (WORDS[claudeSuites[1]] || +claudeSuites[1]) === suites.length,
   claudeSuites && claudeSuites[1] + ' vs ' + suites.length);

// every suite file present must actually be registered, or it never runs
fs.readdirSync(path.join(ROOT, 'src/tests'))
  .filter(f => /\.(js|py)$/.test(f) && !/^(harness|run)\b/.test(f))
  .forEach(f => {
    const base = f.replace(/\.(js|py)$/, '');
    ck('suite file "' + f + '" is registered in run.sh', suites.includes(base));
  });

// ---------- no public test reads a private pack (#85, Review Focus 2)
// The 2024, Xanathar's, Tasha's and Humblewood packs live in the private repo,
// and so does Homebrew since #125; CI has none of them. This catches every form
// the suites used to read one by (<pack> is one of the five folder names below):
//   a path                      'data/<pack>/x.json', path.join(ROOT, 'data', '<pack>', f)
//   a bundle name               dist/<pack>_full.json, '<pack>_full.json' anywhere
//   a helper given the folder   pack('<pack>', f), shippedItems('<pack>', f), read('<pack>', f, n)
//   a list of pack folders      ['<pack>', …], […, 'srd52', '<pack>'], or a list of one
//                               (but humblewood's is the excludeSystems value, so not that one)
//   a key, or a path under data '<pack>/items.json Name', {'<pack>': {…}}, <pack>: {…}
// Every .js, .py and .sh file under src/tests, at any depth (fixtures/ holds
// JSON data, not reads). A label in a synthetic fixture is renamed rather than
// excused, so nothing is exempt — except two forms homebrew is spared: it is
// also the everyday word for a pack of one's own, so a bare 'homebrew_full.json'
// or a homebrew: key labels an invented pack (the credit and #102 manifest
// fixtures), never a read. Its folder, in a path (its bundle under dist
// included), a helper call or a list, is caught like the other four (#125).
{
  const NAMES = '5e2024|xanathars|tashas|humblewood', LONE = '(?:5e2024|xanathars|tashas|homebrew)';
  const PK = '(?:' + NAMES + ')', PKD = '(?:' + NAMES + '|homebrew)', Q = '[\'"]';
  const PRIVATE_PACK = new RegExp([
    '(?:data|dist)[\\/\'", ]+' + PKD + '(?:_full\\.json|[\\/\'"])',
    PK + '_full\\.json',
    '\\w\\(\\s*' + Q + PKD + Q + '\\s*[,)]',
    '\\[\\s*' + Q + PKD + Q + '\\s*,',
    '\\[\\s*' + Q + LONE + Q + '\\s*\\]',
    Q + '(?:' + NAMES + '|homebrew|srd52)' + Q + '\\s*,\\s*' + Q + PKD + Q,
    Q + PKD + '/',
    Q + '?\\b' + PK + Q + '?\\s*:\\s*[{\\[]',
  ].join('|'));
  const testFiles = d => fs.readdirSync(path.join(ROOT, 'src/tests', d), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? testFiles(d ? d + '/' + e.name : e.name) : /\.(js|py|sh)$/.test(e.name) ? [d ? d + '/' + e.name : e.name] : []);
  const scanned = testFiles('');
  ck('the private-pack scan covers run.sh and every suite', scanned.includes('run.sh') && suites.every(s =>
    scanned.includes(s + '.js') || scanned.includes(s + '.py')), scanned);
  scanned.forEach(f => {
    const hits = read('src/tests/' + f).split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => PRIVATE_PACK.test(l));
    ck('src/tests/' + f + ' reads no private pack', !hits.length, hits.slice(0, 3).map(([n, l]) => n + ': ' + l.trim().slice(0, 100)));
  });
}

// ---------- the flat data filenames are gone; no doc may still name them
const OLD = /\b(humblewood-(races|spells|feats|classes|subclasses|backgrounds)|(spells|feats|items|classes|races|backgrounds|conditions|glossary)-2024)\.json\b/;
['README.md', 'CLAUDE.md', 'docs/rules-schema.md', 'docs/README-converter.md'].forEach(f => {
  const m = OLD.exec(read(f));
  ck(f + ' does not name a pre-reorganisation data file', !m, m && m[0]);
});

// ---------- the rules data players actually get: one archive (#83)
ck('README names the rules-data archive', readme.includes('fieldbook-data-standalone'));
// spec §13: the app zip's data/ allowlist must match exactly the archive name
// build.sh itself writes (dist/fieldbook-data-standalone-<release>[+dev].zip),
// or a renamed/extra file in data/ would slip past the guard unnoticed.
ck("build.sh's app-zip guard allows exactly data/fieldbook-data-standalone-….zip",
   read('build.sh').includes('fieldbook-data-standalone-[^/]+\\.zip'));

// ---------- the SRD's required attribution, word for word (#84)
ck('README carries the SRD 5.2.1 attribution', readme.includes('This work includes material from the System Reference Document 5.2.1')
   && readme.includes('https://creativecommons.org/licenses/by/4.0/legalcode'));
// README-converter ships too, and documents `srd`: it quotes the statement (the
// registry credit's first two sentences) and names Wizards nowhere else, as
// SRD 5.2.1 p. 1 asks
{
  const conv = read('docs/README-converter.md');
  const srdReg = JSON.parse(read('data/packs.json')).packs.find(p => p.system === 'SRD 5.2') || {};
  const statement = String(srdReg.attribution || '').split(' Changed:')[0];
  ck('README-converter documents `convert.py srd`', /^## The SRD 5\.2 pack: `srd`$/m.test(conv));
  ck('README-converter quotes the SRD 5.2.1 attribution word for word',
     statement.startsWith('This work includes material') && conv.includes(statement));
  ck('README-converter names Wizards only inside that statement', (conv.match(/Wizards/g) || []).length === 1,
     (conv.match(/Wizards/g) || []).length);
}

// ---------- changelog notebook: the traps that reach the public release notes
// Bullets are copied verbatim into the GitHub release body, where <name> is an
// HTML tag and disappears; and a literal version goes stale on the next bump.
// An EMPTY notebook is correct immediately after a release is cut, so this
// checks the bullets that exist rather than demanding some exist. (It first
// asserted `length > 0` and went red the moment a release was cut — a test
// that fails on a legitimate state is worse than no test.)
const pending = read('src/docs/UNRELEASED.md').split(/^## Pending/m)[1] || '';
const bullets = pending.split(/\n(?=- )/).filter(b => b.trim().startsWith('- '));
const angled = bullets.filter(b => /<[A-Za-z/]/.test(b));
ck('no pending bullet contains an angle-bracket tag', angled.length === 0,
   angled.map(b => b.slice(0, 60)));
const versioned = bullets.filter(b => /\bv\d+\.\d+\.\d+\b/.test(b));
ck('no pending bullet hard-codes a version', versioned.length === 0,
   versioned.map(b => b.slice(0, 60)));

// Last line of defence: the notebook empties on release, so once a bad bullet
// is folded in, this is the only place left to catch it before the tag. The
// generated changelog IS the GitHub release body.
const changelogBad = read('docs/CHANGELOG.md').split('\n')
  .filter(l => l.startsWith('- ') && /<[A-Za-z/]/.test(l));
ck('no changelog entry contains an angle-bracket tag', changelogBad.length === 0,
   changelogBad.map(l => l.slice(0, 70)));

// ---------- the player zip allowlist and README section 9 must agree
const build = read('build.sh');
const docsAllowed = /\^docs\\\/\(([^)]+)\)\\\.md\$/.exec(build);
ck('build.sh allowlists docs/ by name', !!docsAllowed, docsAllowed && docsAllowed[1]);
if (docsAllowed) {
  const allowed = docsAllowed[1].split('|');
  const onDisk = fs.readdirSync(path.join(ROOT, 'docs')).filter(f => f.endsWith('.md'))
                   .map(f => f.replace(/\.md$/, ''));
  const wouldBeRejected = onDisk.filter(f => !allowed.includes(f));
  ck('every docs/*.md on disk is allowed into the zip', wouldBeRejected.length === 0,
     wouldBeRejected);
}
ck('build.sh ships LICENSE', /cp LICENSE /.test(build));
// convert.py and its helper files travel in the data kit zip now, not the app
// zip (#85) — the kit's own allowlist still ships srd-corrections.json beside
// convert.py, just flat instead of under scripts/.
ck('the app zip ships no scripts/ (the data kit replaces it)',
   !/mkdir -p[^\n]*\.buildtmp\/scripts/.test(build) && !/cp scripts\/convert\.py \.buildtmp/.test(build));
// ...and a scripts/ that comes back anyway fails the zip's own guard, which
// otherwise bans only named dev files at the top level.
const bannedSrc = /const banned=names\.filter\(n=>\/(.+?)\/\.test\(n\)\);/.exec(build);
let bannedRe = null;
try { bannedRe = bannedSrc && new RegExp(bannedSrc[1]); } catch (e) { /* reported below */ }
ck("build.sh's app-zip guard bans scripts/",
   !!bannedRe && bannedRe.test('scripts/convert.py') && bannedRe.test('scripts/srd-corrections.json'),
   bannedSrc && bannedSrc[1]);
ck('...and still lets the shipped files through',
   !!bannedRe && !['fieldbook.html', 'README.md', 'LICENSE', 'docs/CHANGELOG.md',
                   'data/fieldbook-data-standalone-1.8.0.zip'].some(n => bannedRe.test(n)));
ck('build.sh builds the data kit zip from the kit allowlist',
   /fieldbook-data-kit-/.test(build) && /cp scripts\/srd-corrections\.json/.test(build));
ck('README section 9 names the data kit', /fieldbook-data-kit-/.test(readme));
ck('README section 9 lists LICENSE', /LICENSE\s+←/.test(readme));

// ---------- data/packs.json, the registry of rules packs (#83)
// The one source of truth for which folders are packs and what version each is
// at. DATA_VERSIONS is a SNAPSHOT of it taken at each app release, so every
// system it names must be registered, at that version or a later data release.
const DV_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([1-9]\d*))?$/;
const dvParse = v => { const m = DV_RE.exec(typeof v === 'string' ? v : ''); return m ? [+m[1], +m[2], +m[3], m[4] ? +m[4] : 0] : null; };
const dvCmp = (a, b) => { const pa = dvParse(a), pb = dvParse(b); if (!pa || !pb) return NaN;
  for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return 0; };
let packsReg = null;
try { packsReg = JSON.parse(read('data/packs.json')); } catch (e) { /* reported below */ }
ck('data/packs.json parses and lists packs', !!packsReg && Array.isArray(packsReg.packs) && packsReg.packs.length > 0);
if (packsReg && Array.isArray(packsReg.packs)) {
  ck('data/packs.json release is a data version', !!dvParse(packsReg.release), packsReg.release);
  packsReg.packs.forEach(p => {
    ck('pack ' + p.system + ': data/' + p.dir + '/ exists', fs.existsSync(path.join(ROOT, 'data', String(p.dir))));
    ck('pack ' + p.system + ': version is a data version or null', p.version === null || !!dvParse(p.version), p.version);
  });
  const dvm = /const\s+DATA_VERSIONS\s*=\s*(\{[^}]*\})/.exec(read('src/js/30-version.js'));
  let dv = null;
  try { dv = JSON.parse(dvm[1]); } catch (e) { /* reported below */ }
  ck('DATA_VERSIONS is present and is flat JSON (release.js rewrites it)', !!dv);
  /* #85: these four packs left this registry for the private repo's, and
     Homebrew followed them (#125). The snapshot still names a departed pack until
     the next release retakes it from this registry, so each may be absent here,
     and only these five. */
  const LEFT_FOR_PRIVATE = ['XPHB', 'Humblewood', 'XGE', 'TCE', 'Homebrew'];
  if (dv) Object.entries(dv).forEach(([sys, v]) => {
    const p = packsReg.packs.find(x => x.system === sys);
    if (!p && LEFT_FOR_PRIVATE.includes(sys)) return;
    ck('DATA_VERSIONS.' + sys + ' has a pack in data/packs.json', !!p);
    if (p) ck('data/packs.json ' + sys + ' is at or after DATA_VERSIONS', dvCmp(p.version, v) >= 0, p.version + ' vs ' + v);
  });
}

// ---------- game-icons emblems: the hand-authored map vs the generated fragment
// The load-bearing one is key parity. It is what goes red when someone edits
// icons.json and forgets to re-run the fetcher, which is the ONLY drift that can
// actually happen offline.
{
  const iconMap = JSON.parse(read('src/icons/icons.json'));
  const frag = read('src/js/05-icons.js');
  const KINDS = ['classes', 'races', 'backgrounds', 'ui'];
  /* Only these three name things that ship in data/. "ui" is app chrome, so the
     coverage check below must not go looking for a data file for it. */
  const DATA_KINDS = ['classes', 'races', 'backgrounds'];

  ck('05-icons.js is marked generated', /GENERATED, DO NOT EDIT/.test(frag));
  ck('icons.json has no subclasses block (subclasses get no emblem)', !iconMap.subclasses);

  const wanted = new Set();
  KINDS.forEach(k => Object.values(iconMap[k] || {}).forEach(v => wanted.add(v)));
  const got = new Set([...frag.matchAll(/^"([a-z0-9-]+\/[a-z0-9-]+)":"/gm)].map(m => m[1]));
  const missing = [...wanted].filter(s => !got.has(s));
  const extra = [...got].filter(s => !wanted.has(s));
  ck('every icons.json slug is vendored in 05-icons.js — else run: node scripts/fetch-icons.js',
     missing.length === 0, missing.join(', '));
  ck('05-icons.js vendors nothing icons.json no longer asks for — else run: node scripts/fetch-icons.js',
     extra.length === 0, extra.join(', '));

  // Every name reaches ICON_MAP, lower-cased, under its own kind.
  KINDS.forEach(k => {
    const m = new RegExp('"' + k + '":{([^}]*)}').exec(frag);
    ck('05-icons.js has an ICON_MAP.' + k + ' block', !!m);
    if (!m) return;
    Object.keys(iconMap[k] || {}).forEach(name =>
      ck('ICON_MAP.' + k + ' carries "' + name + '"',
         m[1].includes('"' + name.trim().toLowerCase() + '":')));
  });

  // The invariant that licenses interpolating d without esc() in iconSVG().
  const bad = [...frag.matchAll(/^"[a-z0-9-]+\/[a-z0-9-]+":"([^"]*)"/gm)]
    .map(m => m[1]).filter(d => !/^[-0-9.,eE MmLlHhVvCcSsQqTtAaZz]+$/.test(d));
  ck('every vendored glyph is pure SVG path data', bad.length === 0, bad.length + ' bad');
  ck('no vendored glyph is the black background square',
     !/"M0 0h512v512H0z"/.test(frag));

  // Coverage: every class/ancestry/background that actually ships has an emblem.
  // This is the check that fires when a future pack adds a race and nobody
  // notices it renders bare. A data-only change CAN go red here — that is the
  // point, and the fix is one line in src/icons/icons.json.
  const DIRS = ['srd52'];
  const FILES = { classes: 'classes.json', races: 'races.json', backgrounds: 'backgrounds.json' };
  DATA_KINDS.forEach(kind => {
    const have = new Set(Object.keys(iconMap[kind] || {}).map(n => n.trim().toLowerCase()));
    const unmapped = [];
    DIRS.forEach(dir => {
      let parsed;
      try { parsed = JSON.parse(read('data/' + dir + '/' + FILES[kind])); } catch { return; }
      (parsed[kind] || []).forEach(e => {
        if (e && e.name && !have.has(String(e.name).trim().toLowerCase()))
          unmapped.push(dir + '/' + e.name);
      });
    });
    ck('every shipped ' + { classes: 'class', races: 'race', backgrounds: 'background' }[kind] +
       ' has an emblem in icons.json', unmapped.length === 0, unmapped.join(', '));
  });

  // CC BY 3.0: name the artists, name and link the licence, say it was changed.
  ck('README credits game-icons.net', readme.includes('game-icons.net'));
  ck('README names the CC BY 3.0 licence', readme.includes('CC BY 3.0'));
  ck('README links the licence deed', readme.includes('creativecommons.org/licenses/by/3.0'));
  ck('README says the icons were changed', /background square was removed/i.test(readme));
  const settings = read('src/js/88-settings.js');
  ck('the app itself credits the artists', /ICON_ARTISTS/.test(settings));
  ck('the app names the licence', /CC BY 3.0/.test(settings));
  ck('the app says the icons were changed', /background square was removed/i.test(settings));
}

// ---------- the wiki (src/docs/wiki/) — see src/docs/specs/2026-09-28-living-wiki-design.md §7
// Facts only, like everything above: a page is listed, its links resolve, the
// code it names exists, and no JS fragment goes undocumented. Wrong PROSE is
// the wiki skill's lint pass, not this.
{
  const WIKI = 'src/docs/wiki';
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(d + '/' + e.name) : e.name.endsWith('.md') ? [d + '/' + e.name] : []);
  const pages = walk(WIKI).sort();
  const text = Object.fromEntries(pages.map(p => [p, read(p)]));
  // Example links and calls inside code are illustrations, not claims.
  const prose = s => s.replace(/^```[\s\S]*?^```/gm, '');
  const outsideSpans = s => prose(s).replace(/`[^`\n]*`/g, '');
  const spans = s => [...prose(s).matchAll(/`([^`\n]+)`/g)].map(m => m[1]);
  // History records names that have since changed, and Decisions records names
  // that were rejected — neither is a claim that the name exists now.
  const current = s => s.split(/^(?=## )/m).filter(sec => !/^## (History|Decisions)\b/.test(sec)).join('');

  const INDEX = WIKI + '/index.md';
  ck('the wiki has an index', pages.includes(INDEX));
  const linksOf = p => [...outsideSpans(text[p]).matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1])
    .filter(h => !/^[a-z]+:/i.test(h) && !h.startsWith('#'))
    .map(h => path.posix.normalize(path.posix.join(path.posix.dirname(p), h.split('#')[0])));

  if (pages.includes(INDEX)) {
    const listed = new Set(linksOf(INDEX));
    const unlisted = pages.filter(p => p !== INDEX && !listed.has(p));
    ck('every wiki page is listed in index.md', unlisted.length === 0, unlisted);
  }
  pages.forEach(p => {
    const dead = [...new Set(linksOf(p).filter(t => !fs.existsSync(path.join(ROOT, t))))];
    ck('wiki ' + p.slice(WIKI.length + 1) + ': every link resolves', dead.length === 0, dead);
    ck('wiki ' + p.slice(WIKI.length + 1) + ': no [[wikilinks]]', !/\[\[[^\]]+\]\]/.test(outsideSpans(text[p])));
  });

  // Every function the app and its tooling define — `name()` on a page must be one.
  const srcFiles = manifest.js.concat(fs.readdirSync(path.join(ROOT, 'scripts'))
    .filter(f => /\.(js|py)$/.test(f)).map(f => 'scripts/' + f))
    .concat(fs.readdirSync(path.join(ROOT, 'tools/data-kit'))
      .filter(f => /\.py$/.test(f)).map(f => 'tools/data-kit/' + f));
  const defined = new Set();
  srcFiles.forEach(f => {
    const s = read(f);
    for (const m of s.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1]);
    for (const m of s.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)) defined.add(m[1]);
    for (const m of s.matchAll(/^[ \t]*(?:def|class)\s+([A-Za-z_]\w*)/gm)) defined.add(m[1]);
  });
  const fragNames = new Set(['js', 'css', 'html'].flatMap(k => manifest[k]).map(p => path.posix.basename(p)));
  // decisions.md is the register of every page's Decisions rows, so it is
  // exempt for the same reason those sections are. Its links are still checked.
  const REGISTER = WIKI + '/decisions.md';
  pages.filter(p => p !== REGISTER).forEach(p => {
    const cur = spans(current(text[p]));
    const calls = cur.map(s => /^([A-Za-z_$][\w$]*)\([^)]*\)$/.exec(s)).filter(Boolean).map(m => m[1]);
    const missing = [...new Set(calls.filter(n => !defined.has(n)))];
    ck('wiki ' + p.slice(WIKI.length + 1) + ': every name() it cites is defined in src/js or scripts',
       missing.length === 0, missing);
    const frags = cur.flatMap(s => [...s.matchAll(/\b\d\d-[a-z0-9-]+\.(?:js|css|html)\b/g)].map(m => m[0]));
    const gone = [...new Set(frags.filter(f => !fragNames.has(f)))];
    ck('wiki ' + p.slice(WIKI.length + 1) + ': every fragment it cites is in manifest.json',
       gone.length === 0, gone);
  });

  // Pages cite the ledger by heading line ("→ ledger L2893"). That only works
  // while the ledger is append-only: one line inserted near the top would
  // silently re-point every citation below it.
  const ledger = read('src/docs/_claude/WIRING-LEDGER.md').split('\n');
  pages.forEach(p => {
    const off = [...new Set([...text[p].matchAll(/\bL(\d{2,})\b/g)].map(m => +m[1]))]
      .filter(n => !/^#/.test(ledger[n - 1] || ''));
    ck('wiki ' + p.slice(WIKI.length + 1) + ': every ledger L-number is a ledger heading',
       off.length === 0, off.map(n => 'L' + n));
  });

  // Coverage. A topic page must cite every JS fragment — the overview's code
  // map alone would satisfy this trivially, so it doesn't count here; it has its
  // own check that it maps every fragment of every kind.
  const OVERVIEW = WIKI + '/overview.md';
  const topical = pages.filter(p => p !== INDEX && p !== OVERVIEW).map(p => text[p]).join('\n');
  const uncovered = manifest.js.map(p => path.posix.basename(p)).filter(f => !topical.includes(f));
  ck('every JS fragment is cited by some wiki topic page', uncovered.length === 0, uncovered);
  if (pages.includes(OVERVIEW)) {
    const unmapped = [...fragNames].filter(f => !text[OVERVIEW].includes(f));
    ck("overview.md's code map names every fragment in manifest.json", unmapped.length === 0, unmapped);
  }
}

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
  // A folder link (../specs/, trailing slash, no file) is a kind move-docs.js
  // itself recognises (its "a folder" case, line 14/139) — it names the
  // category, not a doc, and never goes stale by itself. isFile() alone flagged
  // src/docs/wiki/index.md's own "[Specs](../specs/) and [plans](../plans/)"
  // links dead; existsSync() accepts the directory too (#127 ruling).
  const onDisk = p => { try { return fs.existsSync(path.join(ROOT, p)); } catch (e) { return false; } };

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

  // _private-data/ is left out: it is one clone shared by every checkout, so a path
  // its allowlist names can be ahead of (or behind) this checkout's tree, and its own
  // leak scan already fails on a stale entry (#127 ruling 24)
  const dead = scanFiles(ROOT).filter(f => !f.startsWith('src/tests/') && !f.startsWith('_private-data/'))
    .flatMap(f => deadDocLinks(f, read(f), onDisk).map(r => f + ':' + r.line + ' ' + r.token));
  ck('every link to a spec, plan or archived doc resolves (a move missed one: scripts/move-docs.js rewrites them)',
     dead.length === 0, dead.slice(0, 10));
}

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
  // Each skill keeps its own open-P0 query, since each must run on its own; the
  // two copies must stay one query (#127 ruling 5). A fenced block is compared
  // with its fence's indent removed, as a list item indents it.
  const fenced = text => {
    const out = []; let cur = null, ind = '';
    for (const line of text.split('\n')) {
      const f = /^([ \t]*)```/.exec(line);
      if (f && !cur) { cur = []; ind = f[1]; continue; }
      if (f && cur) { out.push(cur.join('\n')); cur = null; continue; }
      if (cur) cur.push(line.startsWith(ind) ? line.slice(ind.length) : line);
    }
    return out;
  };
  const p0 = text => fenced(text).filter(b => b.includes('.priority=="P0"'));
  const [a, b] = [p0(pre), p0(rel)];
  ck('#127 both skills hold one open-P0 query, and it is the same query',
     a.length === 1 && b.length === 1 && a[0] === b[0], {pre: a, release: b});
  // spec §7: it runs on main and refuses elsewhere; it never switches branch (#127 ruling 8)
  ck('#127 /pre-release refuses off main and never switches branch',
     pre.includes('git branch --show-current') && !pre.includes('git switch'));
  // #127 ruling 19: the clean-tree check lets through exactly the two files a
  // pre-release keeps between sessions, the record and Mike's marked checklist
  const preflight = fenced(pre.split(/^## 0\. Preflight/m)[1] || '')[0] || '';
  const porcelain = preflight.split('\n').filter(l => l.includes('git status --porcelain'));
  const allowed = porcelain.flatMap(l => [...l.matchAll(/':!([^']+)'/g)].map(m => m[1])).sort();
  ck('#127 /pre-release\'s clean-tree check allows exactly the record and the checklist',
     porcelain.length === 1 && JSON.stringify(allowed) === JSON.stringify(['src/docs/PRE-RELEASE.md', 'src/docs/QA-CHECKLIST.md']), allowed);
  // #127 ruling 22: filing uses the priority Mike confirmed, and a P0 never gets
  // the fix-version label (spec decision 6), in the commands, not just the prose
  const filing = fenced(pre).filter(b => b.includes('gh issue create') || b.includes('single-select-option-id')).join('\n');
  const p0Branch = (/if \[ "\$PRIORITY" = P0 \]; then([\s\S]*?)\nelse\n/.exec(filing) || [])[1];
  ck('#127 the filing commands hard-code no priority, and the P0 path has no fix-version label',
     filing.includes('gh issue create') && !/"P[012]"/.test(filing) && filing.includes('select(.name==\\"$PRIORITY\\")') &&
     p0Branch !== undefined && !p0Branch.includes('$NEXT'));
  // #127 final fix wave: Claude Code keeps no shell variables between Bash calls, so
  // filing and the project fields are ONE block; it checks PRIORITY and looks the
  // project ids up before it creates anything, and its guards really stop
  const fileBlocks = fenced(pre).filter(b => b.includes('gh issue create'));
  const fb = fileBlocks[0] || '';
  ck('#127 filing an issue and setting its project fields is one block',
     fileBlocks.length === 1 && fb.includes('single-select-option-id') && fenced(pre).filter(b => b.includes('single-select-option-id')).length === 1,
     fileBlocks.length);
  ck('#127 ...it checks PRIORITY is exactly P0, P1 or P2 and exits otherwise, before any gh call',
     /case "\$PRIORITY" in P0\|P1\|P2\) ;; \*\)[^\n]*exit 1;; esac/.test(fb) && fb.indexOf('case "$PRIORITY"') < fb.indexOf('gh '), fb);
  ck('#127 ...looks up the Priority option before creating the issue, and stops when it is missing',
     fb.indexOf('PICK=') >= 0 && fb.indexOf('PICK=') < fb.indexOf('gh issue create') && /\[ -n "\$PICK" \][\s\S]{0,200}?exit 1/.test(fb), fb);
  ck('#127 ...and passes the body on stdin, so no body file exists in the repo',
     (fb.match(/URL=\$\(gh issue create/g) || []).length === 2 && (fb.match(/URL=\$\(gh issue create/g) || []).length === (fb.match(/--body-file - <<'BODY'/g) || []).length && !/--body-file (?!-[ `])/.test(pre), fb);
  // the archived roadmap page has one name, the one /release reads
  ck('#127 /pre-release archives the roadmap page under the one name /release reads',
     pre.includes('always becomes `src/docs/archive/X.Y.Z/roadmap-X.Y.Z.md`') && rel.includes('`src/docs/archive/<version>/roadmap-<version>.md`'));
  // #127 ruling 25: a routine status commit is not "main moved"
  const moved = fenced(pre).filter(b => b.includes('--invert-grep'));
  ck('#127 the moved-main check ignores the record, the checklist and the status log',
     moved.length === 1 && [':!src/docs/PRE-RELEASE.md', ':!src/docs/QA-CHECKLIST.md', ':!.claude/status.md'].every(x => moved[0].includes("'" + x + "'")), moved);
  // #127 ruling 24: the private allowlist is committed in step 1, and pushed by /release right after public main
  ck('#127 a moved private allowlist is committed by /pre-release and pushed by /release after public main',
     pre.includes('git -C _private-data commit -m "docs: pre-release X.Y.Z — paths moved"') &&
     /git push --follow-tags`; then[^\n]*`git -C _private-data push`, right after/.test(rel));
  // #127 ruling 20: steps are strictly ordered
  ck('#127 reopening a step reopens every later step', pre.includes('reopens every later step'));
}

ck.done();
