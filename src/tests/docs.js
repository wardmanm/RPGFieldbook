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
const nJs = manifest.js.length, nCss = manifest.css.length;
const claudeJs = /js\/\*\.js\s+(\d+) fragments/.exec(claude);
const claudeCss = /css\/\*\.css\s+(\d+) fragments/.exec(claude);
ck('CLAUDE.md states a JS fragment count', !!claudeJs);
ck('CLAUDE.md JS fragment count is right', claudeJs && +claudeJs[1] === nJs,
   claudeJs && claudeJs[1] + ' vs ' + nJs);
ck('CLAUDE.md states a CSS fragment count', !!claudeCss);
ck('CLAUDE.md CSS fragment count is right', claudeCss && +claudeCss[1] === nCss,
   claudeCss && claudeCss[1] + ' vs ' + nCss);

const adr = read('src/docs/ADR-001-source-split.md');
const adrJs = /js\/ \((\d+) fragments\)/.exec(adr);
const adrCss = /css\/ \((\d+)\)/.exec(adr);
ck('ADR-001 JS fragment count is right', adrJs && +adrJs[1] === nJs, adrJs && adrJs[1]);
ck('ADR-001 CSS fragment count is right', adrCss && +adrCss[1] === nCss, adrCss && adrCss[1]);

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

ck.done();
