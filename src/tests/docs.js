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
const WORDS = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8};
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

// ---------- the two data files players actually get
['5e2024_full.json', 'humblewood_full.json'].forEach(n => {
  ck('README names ' + n, readme.includes(n));
});

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
ck('README section 9 lists LICENSE', /LICENSE\s+←/.test(readme));

// ---------- DATA_VERSIONS must cover every system bundle-rules.js emits
// A system with no entry makes bundle-rules.js fail the build, which is the
// right behaviour — but catching it here says why, before the build does.
const bundle = read('scripts/bundle-rules.js');
const version = read('src/js/30-version.js');
const dvm = /const\s+DATA_VERSIONS\s*=\s*(\{[^}]*\})/.exec(version);
ck('DATA_VERSIONS is present and parseable', !!dvm);
if (dvm) {
  let parsed = null;
  try { parsed = JSON.parse(dvm[1]); } catch (e) { /* reported below */ }
  ck('DATA_VERSIONS is valid JSON (bundle-rules.js parses it with JSON.parse)', !!parsed, dvm[1]);
  if (parsed) {
    Object.entries(parsed).forEach(([sys, v]) =>
      ck('DATA_VERSIONS.' + sys + ' is an X.Y.Z version', /^\d+\.\d+\.\d+$/.test(v), v));
    // every system folder bundle-rules knows about needs a mapping in release.js
    const dirs = [...bundle.matchAll(/\{\s*dir:\s*"([^"]+)"/g)].map(m => m[1]);
    const relMap = /const\s+SYSTEM_DIRS\s*=\s*\{([^}]*)\}/.exec(read('scripts/release.js'));
    ck('release.js maps systems to data dirs', !!relMap);
    if (relMap) {
      const mapped = [...relMap[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)];
      const mappedDirs = mapped.map(m => m[2]);
      const mappedSys = mapped.map(m => m[1]);
      dirs.forEach(d => ck('data dir "' + d + '" has a SYSTEM_DIRS mapping', mappedDirs.includes(d)));
      Object.keys(parsed).forEach(sys =>
        ck('DATA_VERSIONS system "' + sys + '" is mapped to a dir', mappedSys.includes(sys)));
    }
  }
}

// ---------- game-icons emblems: the hand-authored map vs the generated fragment
// The load-bearing one is key parity. It is what goes red when someone edits
// icons.json and forgets to re-run the fetcher, which is the ONLY drift that can
// actually happen offline.
{
  const iconMap = JSON.parse(read('src/icons/icons.json'));
  const frag = read('src/js/05-icons.js');
  const KINDS = ['classes', 'races', 'backgrounds'];

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
  KINDS.forEach(kind => {
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

ck.done();
