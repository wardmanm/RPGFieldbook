/* Rules data: species filtered by character system, the Settings loaded-data
   bucketing, safe clear-all, and the bundle round-trip. Also the Settings modal
   itself — its collapsible sections, and the wiring check below that catches a
   control whose markup and handler have drifted apart. */
const fs = require('fs'), path = require('path');
const {loadApp, makeCheck, ROOT} = require('./harness');

const ck = makeCheck();
const {X, state, bootError, fragments} = loadApp([
  'RULE_CATS','systemOf','racesForCharacter','raceOptions','findRaceDef',
  'loadedRulesGroups','rulesBucket','rulesDataHTML','clearAllRules',
  'mergeRules','resetRules','blankChar','migrate','catName',
  'DATA_VERSIONS','dataStatus','dataStatusHTML',
  'SET_SECTIONS','setSecDef','setSecOpen','setSecHTML','rulesEntryCount','settings',
  'NOTE_SECTIONS','NOTE_TABS','noteDef','getNote','noteText','hasNote','saveNote',
  'noteGroupOpen','notesHTML','noteBtnHTML','noteEntryHTML','esc',
]);
if (bootError) { console.log('LOAD FAIL: ' + bootError.message); process.exit(1); }
console.log('loaded ' + fragments.length + ' fragments\n');

// ---------- systemOf
X.character=X.blankChar();
ck('systemOf XPHB', X.systemOf({_source:'XPHB'})==='dnd');
ck('systemOf Humblewood', X.systemOf({_source:'Humblewood'})==='humblewood');
ck('systemOf case-insensitive', X.systemOf({_source:'humblewood'})==='humblewood');
ck('systemOf unknown -> ""', X.systemOf({_source:'MyHomebrew'})==='');
ck('systemOf missing -> ""', X.systemOf({})==='' && X.systemOf(null)==='');

// ---------- race picker filter
X.resetRules();
X.mergeRules({system:'XPHB',races:[{name:'Elf'},{name:'Dwarf'}]},'5e.json');
X.mergeRules({system:'Humblewood',races:[{name:'Strig'},{name:'Mapach'}]},'hw.json');
X.mergeRules({system:'MyHomebrew',races:[{name:'Gribbly'}]},'hb.json');
X.character.system='dnd';
let names=X.racesForCharacter().map(r=>r.name).sort();
ck('dnd char sees XPHB + homebrew', JSON.stringify(names)===JSON.stringify(['Dwarf','Elf','Gribbly']), names);
ck('dnd char sees no Humblewood', !names.includes('Strig'), names);
X.character.system='humblewood';
names=X.racesForCharacter().map(r=>r.name).sort();
ck('hbw char sees Humblewood + homebrew', JSON.stringify(names)===JSON.stringify(['Gribbly','Mapach','Strig']), names);
ck('hbw char sees no XPHB', !names.includes('Elf'), names);
ck('picker options reflect filter', !X.raceOptions().includes('Elf') && X.raceOptions().includes('Strig'));
// the critical one: resolver must NOT filter
ck('findRaceDef still resolves cross-system', !!X.findRaceDef('Elf'), 'Elf unresolvable for a Humblewood character');
X.character.system='dnd';
ck('findRaceDef resolves the other way too', !!X.findRaceDef('Strig'));

// ---------- rules-data bucketing
X.resetRules();
X.mergeRules({system:'XPHB',spells:[{name:'Fireball'}]},'spells.json');
X.mergeRules({system:'XPHB',classes:[{name:'Bard'}],feats:[{name:'Alert'}]},'mixed.json');
X.mergeRules({system:'XPHB',rulebook:true,spells:[{name:'Bless'}],races:[{name:'Orc'}]},'5e2024_full.json');
const gs=X.loadedRulesGroups();
const bucket=n=>X.rulesBucket(gs.find(g=>g.label===n));
ck('single-category file -> its category', bucket('spells.json')==='spells', bucket('spells.json'));
ck('multi-category file -> mixed', bucket('mixed.json')==='mixed', bucket('mixed.json'));
ck('rulebook flag wins over mixed', bucket('5e2024_full.json')==='rulebook', bucket('5e2024_full.json'));
const html=X.rulesDataHTML();
ck('Rulebook heading rendered', html.includes('>Rulebook (1)<'), html.slice(0,200));
ck('Mixed heading rendered', html.includes('>Mixed (1)<'));
ck('category heading uses display name', html.includes('>Spells (1)<'));
ck('Rulebook listed before Mixed', html.indexOf('Rulebook (1)')<html.indexOf('Mixed (1)'));
ck('catName maps features/keywords', X.catName('features')==='Traits' && X.catName('keywords')==='Glossary');
ck('_rulebook stamped on entries', (X.rules.races||[]).some(r=>r._rulebook));
ck('non-rulebook entries unstamped', !(X.rules.classes||[]).some(c=>c._rulebook));

// ---------- clear all
X.character=X.blankChar(); X.character.name='Tess'; X.character.inventory=[{name:'Rope'}];
state.confirm=false;
ck('clear-all cancelled leaves rules', X.clearAllRules()===false && (X.rules.spells||[]).length>0);
ck('confirm text names the packs', /pack/i.test(state.lastConfirm||''), state.lastConfirm);
ck('confirm text reassures about characters', /characters are NOT affected/i.test(state.lastConfirm||''), state.lastConfirm);
state.confirm=true;
ck('clear-all confirmed empties rules', X.clearAllRules()===true && (X.rules.spells||[]).length===0);
ck('clear-all leaves character intact', X.character.name==='Tess' && X.character.inventory.length===1);
ck('clear-all on empty pool is a no-op', X.clearAllRules()===false);

// ---------- bundle round-trip: bundle == importing every file individually
function entrySet(r){
  const o={};
  X.RULE_CATS.forEach(c=>{o[c]=(r[c]||[]).map(e=>String(e.name||e.term||'')).sort();});
  return o;
}
for(const sys of ['5e2024','humblewood']){
  const dir=path.join('data',sys);
  const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort();
  X.resetRules();
  files.forEach(f=>X.mergeRules(JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')),f));
  const individually=entrySet(X.rules);
  X.resetRules();
  X.mergeRules(JSON.parse(fs.readFileSync(path.join('dist',sys+'_full.json'),'utf8')),sys+'_full.json');
  const bundled=entrySet(X.rules);
  ck(sys+' bundle == sum of its files', JSON.stringify(individually)===JSON.stringify(bundled),
     X.RULE_CATS.filter(c=>JSON.stringify(individually[c])!==JSON.stringify(bundled[c]))
       .map(c=>c+': '+individually[c].length+' vs '+bundled[c].length));
  const tot=Object.values(bundled).reduce((a,b)=>a+b.length,0);
  ck(sys+' bundle is non-empty', tot>0, tot);
  console.log('      '+sys+': '+tot+' entries across '+files.length+' files');
}
// ---------- shipped data: the fields the sheet does arithmetic on
// Weight and size are read as numbers and as size names respectively. A string
// where a number belongs reads as 0 lb, silently and with no error anywhere.
{
  const races=JSON.parse(fs.readFileSync(path.join('data','5e2024','races.json'),'utf8')).races;
  const SIZES=['Tiny','Small','Medium','Large','Huge','Gargantuan'];
  const sized=races.filter(r=>r.size);
  ck('every 5e2024 species declares a size', sized.length===races.length,
     races.filter(r=>!r.size).map(r=>r.name));
  ck('every declared size is a name the app knows',
     sized.every(r=>(Array.isArray(r.size)?r.size:[r.size]).every(s=>SIZES.includes(s))),
     sized.filter(r=>(Array.isArray(r.size)?r.size:[r.size]).some(s=>!SIZES.includes(s))).map(r=>r.name));
  ['items.json','items-magic.json'].forEach(f=>{
    const items=JSON.parse(fs.readFileSync(path.join('data','5e2024',f),'utf8')).items;
    const bad=items.filter(i=>i.weight!==undefined&&typeof i.weight!=='number');
    ck(f+' weights are numbers, not strings', bad.length===0, bad.map(i=>i.name+':'+JSON.stringify(i.weight)));
    ck(f+' actually carries weights', items.some(i=>typeof i.weight==='number'));
  });
}

// ---------- rules-data staleness ("do I need to re-download the packs?")
// DATA_VERSIONS records the release each system's DATA last changed in, so a
// system whose data didn't move keeps its old version and its holders are not
// nagged. The three states have to be distinguishable, and "unknown" must never
// be reported as stale — a false alarm on someone's homebrew is worse than
// staying quiet.
X.resetRules();
X.mergeRules({system:'XPHB', dataVersion:'1.0.0', rulebook:true,
              races:[{name:'Elf'}]}, '5e2024_full.json');
X.mergeRules({system:'Humblewood', dataVersion:X.DATA_VERSIONS['Humblewood'], rulebook:true,
              races:[{name:'Corvum'}]}, 'humblewood_full.json');
X.mergeRules({system:'Homebrew', rulebook:true, races:[{name:'Mine'}]}, 'mine.json');

const byLabel = {};
X.loadedRulesGroups().forEach(g => { byLabel[g.source] = g; });

ck('a pack behind DATA_VERSIONS is stale',
   X.dataStatus(byLabel['XPHB']).state === 'stale', X.dataStatus(byLabel['XPHB']));
ck('stale status reports both versions',
   X.dataStatus(byLabel['XPHB']).have === '1.0.0' &&
   X.dataStatus(byLabel['XPHB']).want === X.DATA_VERSIONS['XPHB']);
ck('a pack at DATA_VERSIONS is current',
   X.dataStatus(byLabel['Humblewood']).state === 'current');
ck('an unstamped/unknown system is NOT stale',
   X.dataStatus(byLabel['Homebrew']).state === 'unknown');
ck('the loaded dataVersion is recorded on the group',
   byLabel['XPHB'].dataVersion === '1.0.0');

// the badge: visible for stale, quiet otherwise
ck('stale renders an update chip', /update available/.test(X.dataStatusHTML(byLabel['XPHB'])));
ck('current renders no update chip', !/update available/.test(X.dataStatusHTML(byLabel['Humblewood'])));
ck('unknown renders nothing at all', X.dataStatusHTML(byLabel['Homebrew']) === '');
ck('the chip reaches the Settings list', /update available/.test(X.rulesDataHTML()));

// a NEWER pack than the app expects is not "stale" either — the player is ahead
X.resetRules();
X.mergeRules({system:'XPHB', dataVersion:'99.0.0', rulebook:true, races:[{name:'Elf'}]}, 'f.json');
ck('a pack newer than the app is not flagged stale',
   X.dataStatus(X.loadedRulesGroups()[0]).state === 'current');

// ---------- every shipped pack agrees with DATA_VERSIONS
[['5e2024_full.json','XPHB'], ['humblewood_full.json','Humblewood']].forEach(([f, sysName]) => {
  const p = path.join(ROOT, 'dist', f);
  if (!fs.existsSync(p)) { ck(f + ' exists', false); return; }
  const pack = JSON.parse(fs.readFileSync(p, 'utf8'));
  ck(f + ' declares a dataVersion', !!pack.dataVersion, pack.dataVersion);
  ck(f + ' dataVersion matches DATA_VERSIONS.' + sysName,
     pack.dataVersion === X.DATA_VERSIONS[sysName],
     pack.dataVersion + ' vs ' + X.DATA_VERSIONS[sysName]);
  ck(f + " system is the DATA_VERSIONS key", pack.system === sysName, pack.system);
});

// ---------- Settings modal: collapsible sections
// The state is stored as COLLAPSE, so an untouched section falls through to the
// first-run default. That is what lets those defaults be changed later without
// silently reopening sections someone deliberately shut.
X.settings.setCollapse = {};
X.SET_SECTIONS.forEach(s => {
  ck('section "' + s.k + '" starts at its declared default', X.setSecOpen(s.k) === s.open);
});
ck('an unknown section id defaults to open', X.setSecOpen('no-such-section') === true);
X.settings.setCollapse = {appearance: true, rules: false};
ck('a stored collapse closes the section', X.setSecOpen('appearance') === false);
ck('a stored false opens one that defaults shut', X.setSecOpen('rules') === true);
ck('sections nobody touched keep their default', X.setSecOpen('backup') === false);
// settings arrive from a JSON file a user can hand-edit or an old version wrote
[null, undefined, [], 'nope', 7].forEach(bad => {
  X.settings.setCollapse = bad;
  ck('a ' + JSON.stringify(bad) + ' setCollapse falls back to defaults', X.setSecOpen('appearance') === true);
});
X.settings.setCollapse = {};

ck('every section id is unique', new Set(X.SET_SECTIONS.map(s => s.k)).size === X.SET_SECTIONS.length);
ck('setSecDef finds a real section', (X.setSecDef('rules') || {}).title === 'Rules data');
ck('setSecDef on rubbish is null, not a throw', X.setSecDef('zzz') === null);
ck('markup for an unknown section is empty, not broken', X.setSecHTML('zzz', '<p>x</p>') === '');

const open = X.setSecHTML('appearance', '<p>body</p>');
ck('an open section carries no collapsed caret', !/fcaret c"/.test(open), open);
ck('an open section is not display:none', !/display:none/.test(open), open);
ck('the section body is tagged for the toggle', open.includes('data-setsecbody="appearance"'));
ck('the header is tagged for the toggle', open.includes('data-setsec="appearance"'));
ck('the header announces its state to screen readers', open.includes('aria-expanded="true"'));
X.settings.setCollapse = {appearance: true};
const shut = X.setSecHTML('appearance', '<p>body</p>');
ck('a closed section hides its body', shut.includes('display:none'), shut);
ck('a closed section turns the caret', shut.includes('fcaret c"'), shut);
ck('a closed section says so to screen readers', shut.includes('aria-expanded="false"'));
ck('a closed section still renders its body (it is hidden, not dropped)', shut.includes('<p>body</p>'));
X.settings.setCollapse = {};
// the badge is the reason a folded section is still informative
ck('a badge is rendered when given', X.setSecHTML('rules', '', '12 entries').includes('>12 entries<'));
ck('no badge element when there is none', !X.setSecHTML('rules', '').includes('fgcount'));
ck('badge text is escaped', X.setSecHTML('rules', '', '<img>').includes('&lt;img&gt;'));

X.resetRules();
ck('entry count is zero with nothing loaded', X.rulesEntryCount() === 0);
X.mergeRules({system: 'XPHB', races: [{name: 'Elf'}, {name: 'Orc'}], spells: [{name: 'Bless'}]}, 'x.json');
ck('entry count sums every category', X.rulesEntryCount() === 3, X.rulesEntryCount());

// ---------- section notes: the registry IS the contract
// NOTE_SECTIONS drives the icon injection, the Notes tab's grouping and its
// headings. If it and the template disagree, a section silently loses its icon
// or a note becomes unreachable — with no error either way.
{
  const t = fs.readFileSync(path.join(ROOT, 'src/fieldbook.template.html'), 'utf8');
  const inTemplate = (t.match(/data-note="([a-z]+)"/g) || []).map(s => s.slice(11, -1));

  ck('the registry has 19 sections', X.NOTE_SECTIONS.length === 19, X.NOTE_SECTIONS.length);
  ck('every section id is unique',
     new Set(X.NOTE_SECTIONS.map(s => s.k)).size === X.NOTE_SECTIONS.length);
  ck('every section names a tab the Notes tab can group under',
     X.NOTE_SECTIONS.every(s => s.tab in X.NOTE_TABS),
     X.NOTE_SECTIONS.filter(s => !(s.tab in X.NOTE_TABS)).map(s => s.k));
  // both directions — a registry entry with no card, and a card with no entry
  const missing = X.NOTE_SECTIONS.map(s => s.k).filter(k => inTemplate.indexOf(k) < 0);
  ck('every registry section exists in the template', missing.length === 0, missing);
  const orphan = inTemplate.filter(k => !X.noteDef(k));
  ck('every tagged card is in the registry', orphan.length === 0, orphan);
  ck('no card is tagged twice', new Set(inTemplate).size === inTemplate.length);
  // the attribute has to be ON the card, because renderNoteIcons looks for the
  // .label inside it
  ck('every data-note is on a card element',
     (t.match(/data-note="[a-z]+"/g) || []).every((_, i) => true) &&
     (t.match(/<div class="card" data-note="[a-z]+"/g) || []).length === 19,
     (t.match(/<div class="card"[^>]*data-note[^>]*>/g) || []).length);
  ck('the Notes tab itself takes no note', !/id="tab-notes"[\s\S]*?data-note=/.test(t));
  ck('the Notes tab has the list the renderer targets', t.includes('id="notesList"'));

  // registry titles must match the headings they claim to describe. `origin` is
  // excluded on purpose: that heading is skin-dependent (Race vs Ancestry), which
  // is exactly why noteTitle() asks the app instead of quoting the registry.
  X.NOTE_SECTIONS.filter(s => s.k !== 'origin').forEach(s => {
    const at = t.indexOf('data-note="' + s.k + '"');
    const lab = t.slice(at, t.indexOf('</div>', at));
    const m = /<div class="label">([^<]*)/.exec(lab);
    const text = m ? m[1].replace(/&amp;/g, '&').trim() : '';
    ck('the registry title for "' + s.k + '" matches its heading', text === s.title, {text, title: s.title});
  });
}

// ---------- the tab bar
{
  const t = fs.readFileSync(path.join(ROOT, 'src/fieldbook.template.html'), 'utf8');
  const tabs = (t.match(/class="tab(?: active)?" data-tab="([a-z]+)"/g) || [])
    .map(s => /data-tab="([a-z]+)"/.exec(s)[1]);
  const panels = (t.match(/class="tabpanel(?: active)?" id="tab-([a-z]+)"/g) || [])
    .map(s => /id="tab-([a-z]+)"/.exec(s)[1]);
  ck('there are seven tabs', tabs.length === 7, tabs);
  ck('every tab has a panel', tabs.every(n => panels.indexOf(n) >= 0), tabs.filter(n => panels.indexOf(n) < 0));
  ck('every panel has a tab', panels.every(n => tabs.indexOf(n) >= 0), panels.filter(n => tabs.indexOf(n) < 0));
  ck('exactly one tab starts active', (t.match(/class="tab active"/g) || []).length === 1);
  ck('every tab carries a glyph and a word',
     (t.match(/class="tabicon"/g) || []).length === 7 && (t.match(/class="tlbl"/g) || []).length === 7);
  // buildToc() reads the tab button's textContent for its heading, so a <title>
  // inside the icon would end up in the flyout
  ck('no tab icon carries a title element', !/<svg class="tabicon"[^>]*>\s*<title/.test(t));
  ck('the icon-tab mode has a default on the root element', /<html[^>]*data-tabs="labels"/.test(t));
}

// ---------- notes: storage guards and the pure renderers
{
  const ch = X.blankChar();
  X.character = ch;
  ck('a fresh character has no notes', X.notesHTML().includes('No notes yet'));
  ck('hasNote is false for everything on a blank sheet',
     X.NOTE_SECTIONS.every(s => !X.hasNote(s.k)));

  X.saveNote('vitals', 'Watch the **poison** rules here.');
  ck('a saved note reads back', X.noteText('vitals').includes('poison'));
  ck('saving stamps a created time', typeof X.getNote('vitals').at === 'number');
  ck('created and edited match on the first save',
     X.getNote('vitals').at === X.getNote('vitals').editedAt);
  const at0 = X.getNote('vitals').at;
  X.saveNote('vitals', 'Watch the **poison** rules here.');
  ck('re-saving identical text does not fake an edit',
     X.getNote('vitals').at === at0 && X.getNote('vitals').editedAt === at0);
  X.saveNote('vitals', 'Changed.');
  ck('an edit keeps the original created time', X.getNote('vitals').at === at0);

  // blank means gone — otherwise the Notes tab lists empty entries forever
  X.saveNote('vitals', '   \n  ');
  ck('saving whitespace deletes the note', X.getNote('vitals') === null && !X.hasNote('vitals'));

  // migrate guards secNotes at the top level only, so the read path must cope
  // with anything a hand-edited file puts inside it
  ['a string', 42, ['a'], null].forEach(bad => {
    X.character.secNotes = {vitals: bad};
    ck('a ' + JSON.stringify(bad) + ' where a note belongs reads as no note',
       X.getNote('vitals') === null && X.noteText('vitals') === '' && !X.hasNote('vitals'));
  });
  X.character.secNotes = {};

  // grouping, order and counts
  X.saveNote('vitals', 'a'); X.saveNote('skills', 'b'); X.saveNote('coins', 'c');
  const h = X.notesHTML();
  ck('groups appear in registry-tab order',
     h.indexOf('>Sheet<') < h.indexOf('>Inventory<'), h.replace(/<[^>]+>/g, '|').slice(0, 200));
  ck('a tab with no notes gets no group', !h.includes('>Spells<'));
  ck('the group count is the number of notes in it', h.includes('<span class="fgcount">2</span>'));
  ck('each note renders its body', h.includes('<p>a</p>') && h.includes('<p>c</p>'));
  ck('each note offers a jump back to its section', h.includes('data-notejump="vitals"'));

  // collapse is stored as COLLAPSE, so an absent key means "never touched"
  ck('a group nobody touched is open', X.noteGroupOpen('sheet') === true);
  X.character.noteCollapse = {sheet: true};
  ck('a stored collapse closes it', X.noteGroupOpen('sheet') === false);
  const shut = X.notesHTML();
  ck('a closed group hides its body', shut.includes('style="display:none"'));
  ck('a closed group still renders its notes (hidden, not dropped)', shut.includes('data-notejump="vitals"'));
  ck('a closed group says so to screen readers', shut.includes('aria-expanded="false"'));
  [null, 'nope', [], 7].forEach(bad => {
    X.character.noteCollapse = bad;
    ck('a ' + JSON.stringify(bad) + ' noteCollapse falls back to open', X.noteGroupOpen('sheet') === true);
  });
  X.character.noteCollapse = {};

  // the icon
  const off = X.noteBtnHTML(X.noteDef('attacks'));
  ck('an empty section gets a plain icon', !off.includes('notebtn on'), off);
  ck('...with no preview attached', !off.includes('n-pop'));
  ck('...and an aria-label that says Add', off.includes('Add a note'));
  X.saveNote('attacks', 'Remember <b>flanking</b> is a house rule');
  const on = X.noteBtnHTML(X.noteDef('attacks'));
  ck('a section with a note gets the lit icon', on.includes('notebtn on'));
  ck('...a preview', on.includes('n-pop'));
  ck('...an aria-label that says Edit', on.includes('Edit note'));
  ck('the preview is escaped — it sits in markup', on.includes('&lt;b&gt;') && !on.includes('<b>'));
  X.character = X.blankChar();
}

// ---------- anything refreshed when rules change must also render on load
// The bug this encodes: renderTables() was in refreshRulesUI() but not in
// renderAll(), so tables imported in one session were invisible on the Tables
// tab after a refresh — the rules were loaded, nothing had drawn them. Typing in
// the filter box called renderTables() and they appeared, which is what made it
// look like a data problem when it was a missing call.
// If a surface needs redrawing when the rules pool changes, it needs drawing
// when the app starts with a rules pool already in place. Same list, both ways.
{
  const fnBody = (src, name) => {
    const i = src.indexOf('function ' + name + '(');
    if (i < 0) return '';
    const from = src.slice(i);
    return from.slice(0, from.indexOf('\n}') + 2);
  };
  const settings = fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8');
  const res = fs.readFileSync(path.join(ROOT, 'src/js/65-resources.js'), 'utf8');
  const calls = (body) => new Set((body.match(/\brender[A-Za-z]+\(/g) || []).map(s => s.slice(0, -1)));
  const onRulesChange = calls(fnBody(settings, 'refreshRulesUI'));
  const onLoad = calls(fnBody(res, 'renderAll'));
  onRulesChange.delete('refreshRulesUI');
  onLoad.delete('renderAll');
  ck('the two renderer lists were actually found', onRulesChange.size > 3 && onLoad.size > 3,
     {onRulesChange: [...onRulesChange], onLoad: [...onLoad]});
  const missing = [...onRulesChange].filter(f => !onLoad.has(f));
  ck('every renderer refreshRulesUI calls is also called by renderAll', missing.length === 0, missing);
}

// ---------- every getElementById target exists, app-wide
// The failure mode is silent: rename or drop an id and the lookup returns null,
// the control stops working, and nothing anywhere reports it. Ids built by
// concatenation ("mod-"+k) don't match the pattern and are left alone.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const files = ['src/fieldbook.template.html'].concat(manifest.js);
  const declared = new Set(), used = new Map();
  files.forEach(f => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    let m;
    const rd = /\bid="([A-Za-z][\w-]*)"/g;
    while ((m = rd.exec(s))) declared.add(m[1]);
    const ru = /getElementById\("([A-Za-z][\w-]*)"\)/g;
    while ((m = ru.exec(s))) used.set(m[1], f);
  });
  const missing = [...used.keys()].filter(k => !declared.has(k));
  ck('every id the app looks up is one it renders', missing.length === 0,
     missing.map(k => k + ' (' + used.get(k) + ')'));
  ck('the check is actually looking at something', used.size > 100 && declared.size > 100,
     {used: used.size, declared: declared.size});
}

// ---------- the Vitals / Rest & Recovery structure
// All of this is markup a delegated handler or a CSS rule depends on, and all of
// it fails SILENTLY: no error, just a control that stops doing anything.
{
  const t = fs.readFileSync(path.join(ROOT, 'src/fieldbook.template.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');

  // The whole point of the HP rework: data-path commits on every keystroke, so
  // typing "-3" would store "-" at the first character.
  ck('no HP box is bound with data-path', !/data-path="character\.hp\./.test(t + js));
  ck('each HP box has exactly one data-hp hook',
     ['cur', 'max', 'temp'].every(k => (t.match(new RegExp('data-hp="' + k + '"', 'g')) || []).length === 1));
  ck('HP boxes are text, not number (number strips a leading +)',
     !/data-hp="[a-z]+"[^>]*type="number"/.test(t) && (t.match(/inputmode="tel" data-hp=/g) || []).length === 3,
     t.match(/<input[^>]*data-hp[^>]*>/g));

  // the death-save click handler is `.death .c` — the circles must stay inside it
  const deathBlock = (t.match(/<div class="death"[\s\S]*?<\/div>\s*\n/) || [''])[0];
  ck('both death-save sets are inside .death',
     deathBlock.includes('id="deathSucc"') && deathBlock.includes('id="deathFail"'), deathBlock);
  // failures read first, beside the skull's own colour; successes on the right
  ck('failures come before successes',
     deathBlock.indexOf('id="deathFail"') < deathBlock.indexOf('id="deathSucc"'));
  ck('the failure set is laid out in reverse so it fills outward from the skull',
     /\.death \.set\[data-kind="fail"\]\{[^}]*row-reverse/.test(
       fs.readFileSync(path.join(ROOT, 'src/css/30-sheet.css'), 'utf8')));
  // a bare U+FE0E is invisible in source and a colour emoji is wrong on the sheet
  ck('the skull is the text-presentation entity pair', t.includes('&#9760;&#65038;'));

  // starBtn is looked up UNGUARDED nowhere any more, but it is still the id both
  // recompute() and wire() reach for, and there must be exactly one
  ck('exactly one starBtn', (t.match(/id="starBtn"/g) || []).length === 1);
  ck('the star sits in the Vitals label row', /<div class="label">Vitals[^\n]*id="starBtn"/.test(t));

  // Rest & Recovery owns the rests AND all three hit-dice pieces — the whole
  // point was that hit dice stopped being in two places
  const rr = t.slice(t.indexOf('Rest &amp; Recovery'));
  const card = rr.slice(0, rr.indexOf('<div class="card"'));
  ck('Rest & Recovery owns both rests and all of hit dice',
     ['btnShortRest', 'btnLongRest', 'hitdiceInput', 'data-hdmode', 'hdWrap'].every(s => card.includes(s)),
     ['btnShortRest', 'btnLongRest', 'hitdiceInput', 'data-hdmode', 'hdWrap'].filter(s => !card.includes(s)));
  ck('hit dice is not still up in Vitals', (t.match(/id="hitdiceInput"/g) || []).length === 1);
}

// ---------- Settings modal: every control is still wired
// Sections meant moving markup between template literals, so also check the
// reverse direction for this one modal: nothing it renders is left unwired.
{
  const src = fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8');
  const body = src.slice(src.indexOf('function openSettings()'));
  const ids = (re) => { const out = new Set(); let m; while ((m = re.exec(body))) out.add(m[1]); return out; };
  const declared = ids(/\bid="([A-Za-z][\w-]*)"/g);
  const used = ids(/getElementById\("([A-Za-z][\w-]*)"\)/g);
  // #setSections is built by openSettings itself, outside the section markup
  declared.add('setSections');
  const missing = [...used].filter(k => !declared.has(k));
  ck('every control openSettings looks up exists in its markup', missing.length === 0, missing);
  // ids the modal renders but never wires are dead weight or a forgotten handler
  const inert = new Set(['srcList', 'rulesData', 'rulesStatus', 'encHint', 'setSections']);
  const unwired = [...declared].filter(k => !used.has(k) && !inert.has(k));
  ck('every control it renders is wired up somewhere', unwired.length === 0, unwired);
}

ck.done();
