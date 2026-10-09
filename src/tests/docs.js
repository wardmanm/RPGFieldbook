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
const WORDS = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10};
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
  if (dv) Object.entries(dv).forEach(([sys, v]) => {
    const p = packsReg.packs.find(x => x.system === sys);
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
  const DIRS = ['5e2024', 'humblewood', 'xanathars', 'tashas', 'homebrew'];
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

ck.done();
