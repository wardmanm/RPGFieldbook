/* Tables: the renderer, the [Table: X] anchor pass against the glossary
   highlighter, the rules-data category, and migrate() round-tripping.
   Also the section-note markdown renderer, which lives here because it is built
   ON TOP of highlight() and its whole safety argument is about that pipeline. */
const {loadApp, makeCheck} = require('./harness');

const ck = makeCheck();
const {X, bootError, fragments} = loadApp([
  'RULE_CATS','TBL_MARK',
  'findTable','tablesFor','tableHTML','tableChipsHTML','highlight',
  'blankChar','migrate','resetRules','mergeRules','dispName','esc',
  'noteHTML','noteInline','notePreview',
]);
if (bootError) { console.log('LOAD FAIL: ' + bootError.message); process.exit(1); }
console.log('loaded ' + fragments.length + ' fragments\n');

const T = {
  name: 'Wild Magic Surge', cols: ['1d100', 'Effect'], align: ['center', 'left'],
  rows: [['01-02', 'Roll again'], ['03-04', 'You cast Fireball']],
  owner: 'Wild Magic Sorcery', ownerKind: 'subclass',
};

// ---- lookup helpers
X.rules.tables = [T];
ck('findTable exact', X.findTable('Wild Magic Surge') === T);
ck('findTable case/space insensitive', X.findTable('  wild magic SURGE ') === T);
ck('findTable miss -> null', X.findTable('Nope') === null);
ck('findTable empty -> null', X.findTable('') === null);
ck('tablesFor by owner+kind', X.tablesFor('Wild Magic Sorcery', 'subclass').length === 1);
ck('tablesFor wrong kind', X.tablesFor('Wild Magic Sorcery', 'class').length === 0);
ck('tablesFor unknown owner', X.tablesFor('Barbarian', 'class').length === 0);

// ---- renderer: structure + escaping
const h = X.tableHTML(T);
ck('renders a real table', /<table class="rtbl">/.test(h) && /<thead>/.test(h) && /<tbody>/.test(h));
ck('scroll wrapper present', /<div class="tbl-wrap">/.test(h));
ck('align applied', /<th style="text-align:center">1d100<\/th>/.test(h), h.slice(0, 200));
ck('left align emits no style', /<th>Effect<\/th>/.test(h), h.slice(0, 220));
ck('all rows rendered', (h.match(/<tr>/g) || []).length === 3);

const evil = {name: 'X', cols: ['<script>alert(1)</script>'], align: [],
  rows: [['<img src=x onerror=alert(1)>', 'a & b "q" \'s']]};
const eh = X.tableHTML(evil);
ck('header cell escaped', !/<script>/.test(eh) && /&lt;script&gt;/.test(eh), eh.slice(0, 160));
ck('body cell escaped', !/<img/.test(eh) && /&lt;img/.test(eh));
ck('quotes + amp escaped', /a &amp; b &quot;q&quot; &#39;s/.test(eh), eh);
ck('no rows -> hint not table', /class="hint"/.test(X.tableHTML({name: 'e', cols: [], rows: []})));
ck('null table -> hint', /class="hint"/.test(X.tableHTML(null)));
ck('blank cols -> no thead', !/<thead>/.test(X.tableHTML({name: 'x', cols: ['', ''], rows: [['1', '2']]})));

// ---- the [Table: X] anchor pass
X.character = X.blankChar();
X.rules.keywords = [];
let out = X.highlight('The DM chooses the omen from the [Table: Wild Magic Surge].');
ck('anchor -> chip', /<span class="tblref" data-tbl="Wild Magic Surge"/.test(out), out);
ck('chip label is the name', />Wild Magic Surge<\/span>/.test(out), out);
ck('surrounding prose intact', out.startsWith('The DM chooses the omen from the '), out);
ck('no sentinel leaks', out.indexOf('') === -1, out);

// miss -> plain prose, never a dead chip
out = X.highlight('See [Table: Nonexistent] for details.');
ck('unknown table -> plain prose', out === 'See the Nonexistent table for details.', out);
ck('unknown table -> no chip', !/tblref/.test(out));

// the ordering hazard the sentinel exists for: a glossary term inside a table name
X.rules.keywords = [{id: 'g1', term: 'Damage Types', type: 'text', text: 'x'},
                      {id: 'g2', term: 'Prone', type: 'text', text: 'y'}];
X.rules.tables = [T, {name: 'Damage Types', cols: ['Type'], align: [], rows: [['Fire']]}];
out = X.highlight('A Prone creature. See [Table: Damage Types] now.');
ck('glossary term still linked', /<span class="kw" data-gid="g2"[^>]*>Prone<\/span>/.test(out), out);
ck('table name NOT eaten by glossary', /data-tbl="Damage Types"/.test(out), out);
ck('no nested span in chip', !/<span class="tblref"[^>]*><span/.test(out), out);
ck('no stray kw inside tblref attr', !/data-tbl="[^"]*<span/.test(out), out);

// several anchors keep their order
X.rules.tables = [{name: 'A', cols: ['c'], align: [], rows: [['1']]},
                    {name: 'B', cols: ['c'], align: [], rows: [['2']]}];
out = X.highlight('[Table: A] then [Table: B] then [Table: A]');
ck('multiple anchors ordered', (out.match(/data-tbl="(A|B)"/g) || []).join(',') === 'data-tbl="A",data-tbl="B",data-tbl="A"', out);

// text with no anchors behaves exactly as before
X.rules.keywords = [{id: 'g2', term: 'Prone', type: 'text', text: 'y'}];
ck('no-anchor text unchanged', X.highlight('A Prone creature <b>x</b>') === 'A <span class="kw" data-gid="g2" role="button" tabindex="0">Prone</span> creature &lt;b&gt;x&lt;/b&gt;', X.highlight('A Prone creature <b>x</b>'));
ck('empty input', X.highlight('') === '' && X.highlight(null) === '' && X.highlight(undefined) === '');

// a literal PUA char in source text must not be mistaken for a sentinel
X.rules.tables = [{name: 'A', cols: ['c'], align: [], rows: [['1']]}];
out = X.highlight('weird  char [Table: A]');
ck('stray PUA does not steal the chip', /data-tbl="A"/.test(out), out);

// ---- chips row
X.rules.tables = [{name: 'Barbarian Features', cols: ['Level'], align: [], rows: [['1']], owner: 'Barbarian', ownerKind: 'class'}];
ck('chips for owner', /class="tblref" data-tbl="Barbarian Features"/.test(X.tableChipsHTML('Barbarian', 'class')));
ck('no chips when none', X.tableChipsHTML('Bard', 'class') === '');

// ---- migrate round-trip is untouched by any of this
X.rules.tables = [T];
const c0 = X.blankChar();
c0.name = 'Tess'; c0.customField = {deep: [1, 2]};
const rt = X.migrate(JSON.parse(JSON.stringify(c0)));
ck('migrate keeps name', rt.name === 'Tess');
ck('migrate preserves unknown fields', JSON.stringify(rt.customField) === JSON.stringify({deep: [1, 2]}));
const twice = X.migrate(JSON.parse(JSON.stringify(rt)));
ck('migrate is idempotent', JSON.stringify(twice) === JSON.stringify(rt));
ck('no tables key leaked onto character', !('tables' in rt));

// ---- rules category registration
ck('RULE_CATS has tables', X.RULE_CATS.includes('tables'));
X.resetRules();
ck('resetRules seeds tables', Array.isArray(X.rules.tables));
X.mergeRules({system: 'XPHB', tables: [{name: 'Omens', cols: ['a'], rows: [['b']]}]}, 'tables-2024.json');
ck('mergeRules ingests tables', X.rules.tables.length === 1 && X.rules.tables[0].name === 'Omens', X.rules.tables);
ck('merged table got an _id', !!X.rules.tables[0]._id, X.rules.tables[0]);
ck('merged table tagged with source', X.rules.tables[0]._source === 'XPHB');
// re-merging the same source replaces rather than duplicates
X.mergeRules({system: 'XPHB', tables: [{name: 'Omens', cols: ['a'], rows: [['c']]}]}, 'tables-2024.json');
ck('re-merge replaces, no dupes', X.rules.tables.length === 1 && X.rules.tables[0].rows[0][0] === 'c', X.rules.tables);
ck('dispName works for tables', X.dispName(X.rules.tables[0], 'tables') === 'Omens');

// ---- shipped table data: the two defects that got past every other check
// 16 Humblewood tables shipped with `columns` instead of `cols` and rendered
// with no header row; 19 carried the extractor's internal `_region` page-band
// marker into player data. Both files parse, both look plausible open in an
// editor, and nothing here caught either. These two assertions do.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
['5e2024', 'humblewood'].forEach(sys => {
  const f = path.join(ROOT, 'data', sys, 'tables.json');
  if (!fs.existsSync(f)) { ck(sys + ' tables.json exists', false); return; }
  const tables = JSON.parse(fs.readFileSync(f, 'utf8')).tables;
  ck(sys + ' tables.json has tables', Array.isArray(tables) && tables.length > 0);

  // tableHTML() reads t.cols; anything else renders headerless
  const noCols = tables.filter(t => !Array.isArray(t.cols) || !t.cols.length).map(t => t.name);
  ck(sys + ': every table has a non-empty cols array', noCols.length === 0, noCols.slice(0, 6));

  // no extractor internals in player-facing data
  const internal = [...new Set(tables.flatMap(t => Object.keys(t)).filter(k => k.startsWith('_')))];
  ck(sys + ': no internal underscore keys shipped', internal.length === 0, internal);

  // width consistency — a row longer than the header silently loses cells
  const ragged = tables.filter(t => (t.rows || []).some(r => r.length !== t.cols.length))
                       .map(t => t.name);
  ck(sys + ': every row matches its column count', ragged.length === 0, ragged.slice(0, 6));

  // the app merges tables by name, so duplicates would shadow each other
  const seen = new Set(), dup = [];
  tables.forEach(t => { if (seen.has(t.name)) dup.push(t.name); seen.add(t.name); });
  ck(sys + ': table names are unique', dup.length === 0, dup);

  ck(sys + ': every table declares an owner and kind',
     tables.every(t => t.owner && t.ownerKind), tables.filter(t => !t.owner || !t.ownerKind).map(t => t.name).slice(0, 4));
});

/* ================= section-note markdown =================
   noteHTML() renders the player's own words, so it is the one place in the app
   where markup is built from arbitrary typed input. It composes with
   highlight(): escape first, THEN hold the tags highlight() inserted aside while
   the markdown regexes run. Everything below either guards that composition or
   pins a block rule. */
const md = X.noteHTML;
const PU = c => String.fromCharCode(c);

// ---------- escaping: nothing typed can ever become markup
ck('a typed tag is escaped, not rendered', !md('<img src=x onerror=1>').includes('<img'));
ck('...and is still visible as text', md('<img src=x onerror=1>').includes('&lt;img'));
ck('escaping survives being wrapped in bold',
   md('**<script>**').includes('<strong>&lt;script&gt;</strong>'), md('**<script>**'));
ck('a quote in a note cannot break an attribute', !/="[^"]*"[^>]*onerror/i.test(md('" onerror="x')));
// the placeholders are private-use chars; a player typing one must not be able
// to forge one, and none may ever survive into the output
[0xE000, 0xE001, 0xE002, 0xE003].forEach(c => {
  ck('a literal U+' + c.toString(16).toUpperCase() + ' cannot forge a placeholder',
     !md('a' + PU(c) + '0' + PU(c) + 'b').includes(PU(c)));
});
ck('no sentinel leaks into ordinary output',
   !/[-]/.test(md('# H\n- a\n\n> q\n\n`c` **b** *i*')), md('# H\n- a'));

// ---------- it composes with the glossary, which is the point
X.resetRules();
X.mergeRules({keywords: [{term: 'Prone', text: 'On the floor.'}]}, 'g.json');
X.character = X.blankChar();
ck('a glossary term inside a note is still tappable', md('You are Prone.').includes('class="kw"'));
// the chip is a single held token, so emphasis around it can't split it
ck('a chip survives being wrapped in bold',
   md('**Prone creature**').includes('<strong><span class="kw"'), md('**Prone creature**'));
ck('a chip is not mangled by italics', (md('*Prone*').match(/class="kw"/g) || []).length === 1);

// ---------- and with table anchors
X.resetRules();
X.mergeRules({tables: [T]}, 't.json');
X.character = X.blankChar();
const tbl = md('See [Table: Wild Magic Surge] now.');
ck('a table anchor inside a note still renders a chip', tbl.includes('class="tblref"'), tbl);
ck('the table name in the attribute is intact', tbl.includes('data-tbl="Wild Magic Surge"'), tbl);
ck('a bold block does not corrupt the table attribute',
   md('**[Table: Wild Magic Surge]**').includes('data-tbl="Wild Magic Surge"'));
ck('an anchor to a table that is not loaded reads as prose',
   !md('[Table: No Such Thing]').includes('tblref'));
X.resetRules();
X.character = X.blankChar();

// ---------- blocks
ck('# is a heading', md('# Title').includes('n-h1'));
ck('###### is a level-6 heading', md('###### Deep').includes('n-h6'));
ck('a lone # with no text is not a heading', !md('#nospace').includes('n-h'));
ck('- makes a bullet list', md('- a\n- b').includes('<ul class="n-ul"><li>a</li><li>b</li></ul>'), md('- a\n- b'));
ck('+ and * also make bullets', md('+ a').includes('<li>') && md('* a').includes('<li>'));
ck('1. makes an ordered list', md('1. a\n2. b').includes('<ol class="n-ol"><li>a</li><li>b</li></ol>'), md('1. a\n2. b'));
ck('an ordered list keeps where it started', md('3. c').includes('start="3"'));
ck('1) works as well as 1.', md('1) a').includes('<ol'));
ck('> makes a quote', md('> hush').includes('<blockquote class="n-q">hush</blockquote>'), md('> hush'));
ck('consecutive quote lines are one block', (md('> a\n> b').match(/blockquote/g) || []).length === 2);
ck('--- makes a rule', md('---').includes('<hr class="n-hr">'));
// this ordering is the whole reason hr is checked before bullets
ck('* * * is a rule, not a bullet list', md('* * *').includes('n-hr') && !md('* * *').includes('<li>'));
ck('an italic line is not mistaken for a bullet',
   md('*italic*').includes('<em>') && !md('*italic*').includes('<li>'), md('*italic*'));
ck('a blank line splits paragraphs', (md('a\n\nb').match(/<p>/g) || []).length === 2);
ck('a single newline is a soft break inside one paragraph',
   (md('a\nb').match(/<p>/g) || []).length === 1 && md('a\nb').includes('<br>'));
ck('a block starter ends the paragraph above it',
   md('text\n- item').includes('</p><ul'), md('text\n- item'));

// ---------- inline
ck('**bold**', md('**b**').includes('<strong>b</strong>'));
ck('*italic*', md('*i*').includes('<em>i</em>'));
ck('`code`', md('`c`').includes('<code>c</code>'));
ck('code wins over emphasis inside it',
   md('`**x**`').includes('<code>**x**</code>') && !md('`**x**`').includes('<strong>'), md('`**x**`'));
// unmatched delimiters must be inert, not eat the rest of the line
ck('an unmatched * is literal', md('*foo').includes('*foo') && !md('*foo').includes('<em>'));
ck('**foo* is literal', !md('**foo*').includes('<strong>') && !md('**foo*').includes('<em>'), md('**foo*'));
ck('a lone asterisk between words is literal', md('a * b').includes('a * b'), md('a * b'));
ck('an unmatched backtick is literal', md('`foo').includes('`foo'));

// ---------- nothing in, nothing out
[null, undefined, '', '   ', '\n\n', ' \n \t \n'].forEach(v => {
  ck('a note of ' + JSON.stringify(v) + ' renders nothing', md(v) === '');
});

// ---------- the hover preview is plain text, deliberately
const pv = X.notePreview;
ck('the preview strips block markers', pv('# Title\n- one\n- two') === 'Title one two', pv('# Title\n- one\n- two'));
ck('the preview strips inline markers', pv('**b** and `c`') === 'b and c');
ck('the preview collapses whitespace', pv('a\n\n\n   b') === 'a b');
ck('the preview escapes, since it goes in an attribute-adjacent span',
   pv('<img>') === '&lt;img&gt;');
ck('the preview is capped and ellipsised', pv('x'.repeat(400)).length < 220 && pv('x'.repeat(400)).endsWith('…'));
ck('a short preview is not ellipsised', !pv('short').endsWith('…'));
ck('the preview of nothing is empty', pv('') === '' && pv(null) === '');

ck.done();
