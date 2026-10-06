/* Rules data: species filtered by character system, the Settings loaded-data
   bucketing, safe clear-all, and the bundle round-trip. Also the Settings modal
   itself — its collapsible sections, and the wiring check below that catches a
   control whose markup and handler have drifted apart. */
const fs = require('fs'), path = require('path');
const {loadApp, loadHTML, makeCheck, ROOT} = require('./harness');

const ck = makeCheck();
const {X, ctx, store, state, bootError, fragments} = loadApp([
  'fetchAllRules','K_RULES',
  'RULE_CATS','systemOf','racesForCharacter','raceOptions','findRaceDef',
  'subclassesFor','findClassDef',
  'missingRequirements','requiresStatusHTML','missingSummary',
  'saveRulesCache','rulesCacheWarning','cacheBytes',
  'lzwCompress','lzwDecompress','readRulesCacheString',
  'loadedRulesGroups','rulesBucket','rulesDataHTML','clearAllRules',
  'mergeRules','resetRules','blankChar','migrate','catName',
  'DATA_VERSIONS','dataStatus','dataStatusHTML',
  'SET_SECTIONS','setSecDef','setSecOpen','setSecHTML','rulesEntryCount','settings',
  'NOTE_SECTIONS','NOTE_TABS','noteDef','getNote','noteText','hasNote','saveNote',
  'noteGroupOpen','notesHTML','noteBtnHTML','noteEntryHTML','esc',
  'rulesSecOpen', 'setRulesSecOpen', 'RULES_SECS', 'settings', 'skillKey',
  'openSettings', 'highlight', 'rulesStatusText', 'rulesBadge', 'dispName', 'fxTargets',
  'AMMO_PIECES','AMMO_SINGLE_NAMES','AMMO_BUNDLES','AMMO_LAUNCHERS',
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

// ---------- excludeSystems: a supplement says who it is NOT for
// systemOf() cannot place "TCE", so without this Tasha's Custom Lineage would
// offer itself to Humblewood characters.
X.resetRules();
X.mergeRules({system:'Humblewood',races:[{name:'Strig'}]},'hw.json');
X.mergeRules({system:'TCE',excludeSystems:['humblewood'],races:[{name:'Custom Lineage'}]},'tashas.json');
ck('systemOf cannot place a supplement', X.systemOf({_source:'TCE'})==='');
ck('_excludeSystems stamped by mergeRules',
   (X.rules.races||[]).some(r=>r.name==='Custom Lineage'&&Array.isArray(r._excludeSystems)));
X.character.system='dnd';
ck('dnd char is offered Custom Lineage', X.racesForCharacter().some(r=>r.name==='Custom Lineage'));
X.character.system='humblewood';
ck('hbw char is NOT offered Custom Lineage', !X.racesForCharacter().some(r=>r.name==='Custom Lineage'));
ck('hbw char still sees its own species', X.racesForCharacter().some(r=>r.name==='Strig'));
// same rule as systemOf: the picker filters, the resolver never does
ck('findRaceDef ignores excludeSystems', !!X.findRaceDef('Custom Lineage'));
ck('excludeSystems is case-insensitive', (()=>{
  X.resetRules();
  X.mergeRules({system:'TCE',excludeSystems:['Humblewood'],races:[{name:'CL'}]},'t.json');
  X.character.system='humblewood';
  return !X.racesForCharacter().length;})());

// ---------- missing dependencies: a pack that refers to content it doesn't ship
// Two sources. STRUCTURAL catches a subclass whose parent class isn't loaded —
// which used to fail silently AND misleadingly (the picker claimed the class had
// no subclasses, when they were loaded and merely unreachable). DECLARED covers
// what the schema can't model: levels[].spells is prose, so an expanded spell
// list names its spells only inside sentences.
X.resetRules();
X.mergeRules({system:'XPHB',classes:[{name:'Warlock'}],spells:[{name:'Haste'}]},'5e.json');
X.mergeRules({system:'Homebrew',subclasses:[{class:'Warlock',name:'The Predator'}],
  requires:[{pack:"Xanathar's",file:'xanathars_full.json',spells:['Cause Fear']},
            {pack:'D&D 2024',file:'5e2024_full.json',spells:['Haste']}]},'hb.json');
{
  const m=X.missingRequirements('Homebrew');
  const flat=m.flatMap(g=>g.missing.map(x=>x.name));
  ck('a declared name that IS loaded is not reported', !flat.includes('Haste'), flat);
  ck('a declared name that is missing is reported', flat.includes('Cause Fear'), flat);
  ck('the report names the file that provides it',
     m.some(g=>g.file==='xanathars_full.json'&&g.missing.some(x=>x.name==='Cause Fear')), m);
  ck('a pack with nothing missing reports nothing', X.missingRequirements('XPHB').length===0);
  ck('requires is stored on rules, keyed by source', !!(X.rules.requires||{})['Homebrew']);
}
// case-insensitive, and satisfied by ANY pack — `file` is documentation, not a constraint
X.resetRules();
X.mergeRules({system:'Elsewhere',spells:[{name:'CAUSE FEAR'}]},'other.json');
X.mergeRules({system:'Homebrew',requires:[{file:'xanathars_full.json',spells:['Cause Fear']}]},'hb.json');
ck('matching is case-insensitive and pack-blind', X.missingRequirements('Homebrew').length===0,
   X.missingRequirements('Homebrew'));
// a category the app doesn't know must be ignored, not reported missing
X.resetRules();
X.mergeRules({system:'Homebrew',requires:[{file:'x.json',gizmos:['Whatsit']}]},'hb.json');
ck('an unknown category is ignored, not reported', X.missingRequirements('Homebrew').length===0);
// structural: no declaration at all, parent class absent
X.resetRules();
X.mergeRules({system:'Homebrew',subclasses:[{class:'Warlock',name:'The Predator'}]},'hb.json');
{
  const m=X.missingRequirements('Homebrew');
  ck('a missing parent class is caught with NO declaration',
     m.some(g=>g.missing.some(x=>x.cat==='classes'&&x.name==='Warlock')), m);
  ck('the structural report has no file to point at', m.every(g=>!g.file));
  const h=X.requiresStatusHTML({source:'Homebrew'});
  ck('the chip is rendered', /chip bad/.test(h), h);
  ck('the chip carries a glyph, not just colour', />!\s/.test(h.replace(/^[^>]*>/,'>')), h);
  ck('the chip explains itself in a tooltip', /title="[^"]*Warlock/.test(h), h);
  ck('missingSummary names the pack', /Homebrew/.test(X.missingSummary()), X.missingSummary());
}
// and once the class is loaded, everything goes quiet
X.mergeRules({system:'XPHB',classes:[{name:'Warlock'}]},'5e.json');
ck('loading the missing class clears the report', X.missingRequirements('Homebrew').length===0);
ck('nothing missing renders no chip', X.requiresStatusHTML({source:'Homebrew'})==='');
ck('nothing missing gives an empty summary', X.missingSummary()==='');
// the declaration must survive the localStorage round trip, because mergeRules
// is never called again at boot — 90-boot.js restores the merged pool directly
X.resetRules();
X.mergeRules({system:'Homebrew',subclasses:[{class:'Warlock',name:'P'}],
  requires:[{file:'f.json',spells:['Nope']}]},'hb.json');
{
  const revived=JSON.parse(JSON.stringify(X.rules));
  ck('requires survives a JSON round trip', !!(revived.requires||{})['Homebrew'],
     Object.keys(revived.requires||{}));
  X.rules=revived;
  ck('and still reports after restore', X.missingRequirements('Homebrew').length>0);
}

// ---------- the rules cache must never fail silently
// Five packs merge to ~2.3M characters — ~4.6 MiB as UTF-16, over a 5 MiB
// localStorage quota. saveRulesCache() used to swallow QuotaExceededError with
// an empty catch, so the PREVIOUS value survived: the packs looked loaded all
// session and the next reload restored the older set, with nothing said.
// (No indexedDB in the harness, so this exercises the localStorage fallback —
// which is exactly the path a browser that refuses IDB would take.)
X.resetRules();
X.mergeRules({system:'XPHB',spells:[{name:'Fireball'}]},'5e.json');
state.quotaFull=false;
X.saveRulesCache();
ck('a write that fits reports no error', X.rulesCacheWarning()==='', X.rulesCacheWarning());
ck('and nothing red is rendered', !/status err/.test(X.rulesDataHTML()));
state.quotaFull=true;
X.mergeRules({system:'XGE',spells:[{name:'Cause Fear'}]},'xge.json');
X.saveRulesCache();
{
  const w=X.rulesCacheWarning();
  ck('a refused write is REPORTED, not swallowed', w!=='', w);
  ck('the warning says it will not survive a reload', /next time|reload/i.test(w), w);
  ck('the warning says what to do about it', /unload|re-import/i.test(w), w);
  ck('the warning quotes a size in bytes, not characters', /\d+\s*(KB|MB)/.test(w), w);
  ck('the warning reaches the loaded-data list in red', /status err/.test(X.rulesDataHTML()));
  // the pool itself is untouched — this is a save failure, not a load failure
  ck('the packs stay loaded and usable this session',
     (X.rules.spells||[]).length===2, (X.rules.spells||[]).length);
}
state.quotaFull=false;
X.saveRulesCache();
ck('the warning clears once a write succeeds', X.rulesCacheWarning()==='', X.rulesCacheWarning());
ck('and the red line goes away', !/status err/.test(X.rulesDataHTML()));

// ---------- the compressor behind the localStorage fallback
// Used only when IndexedDB is refused (WebKit on file:// is the case it exists
// for), where the pool must fit ~5 MiB and five packs is ~4.3 MiB uncompressed.
// A broken decompress would be worse than the bug this was written to fix, so
// the round trip is asserted on the shapes that break naive implementations —
// and on the real shipped payload.
{
  const rt = s => X.lzwDecompress(X.lzwCompress(s));
  const same = (n, s) => ck('lzw round-trip: ' + n, rt(s) === s);
  same('empty', '');
  same('single char', 'a');
  same('repeat (the KwKwK case)', 'a'.repeat(40));
  same('alternating', 'ab'.repeat(500));
  same('every byte value', Array.from({length:256},(_,i)=>String.fromCharCode(i)).join(''));
  same('em dash and curly quotes', 'a — b “c” ‘d’ … é ñ ü');
  same('CJK', '龍のダンジョン'.repeat(50));
  same('emoji / surrogate pairs', '🐉🔥'.repeat(50));
  same('escapes', '"\\"\\\\"\n\t');
  // deterministic fuzz — no Math.random, so a failure is reproducible
  let seed = 12345, ok = true;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 25 && ok; i++) {
    let s = '';
    for (let j = 0, n = Math.floor(rnd()*1500); j < n; j++) {
      const r = rnd();
      s += r < 0.7 ? String.fromCharCode(32 + Math.floor(rnd()*95))
         : r < 0.9 ? '{}[]",:'[Math.floor(rnd()*7)]
         : String.fromCharCode(0xC0 + Math.floor(rnd()*200));
    }
    ok = rt(s) === s;
  }
  ck('lzw round-trip: 25 fuzzed strings', ok);

  // the real payload, and the size claim the iOS fallback rests on
  const pool = fs.readFileSync(path.join(ROOT,'dist','5e2024_full.json'), 'utf8');
  const packed = X.lzwCompress(pool);
  ck('lzw round-trips the shipped 5e2024 pack exactly', X.lzwDecompress(packed) === pool);
  ck('lzw gets the pack under a third of its size', packed.length < pool.length/3,
     (100*packed.length/pool.length).toFixed(0) + '%');

  // the tagged wrapper the fallback writes and boot reads
  ck('a tagged value decodes back', X.readRulesCacheString('\u0001LZ'+packed) === pool);
  ck('an untagged value is legacy plain JSON and still reads',
     X.readRulesCacheString('{"a":1}') === '{"a":1}');
  ck('empty reads as empty',
     X.readRulesCacheString('') === '' && X.readRulesCacheString(null) === '');
  // corrupt must degrade to "nothing cached", never throw at boot
  ck('a corrupt payload returns empty rather than throwing',
     X.readRulesCacheString('\u0001LZ￿￿￿') === '');
}

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

// ---------- an entry with no name never reaches the pool, and the import says so (#71)
// mergeRules() dropped a keyword with no `term` (and any entry with no `name`)
// without a word; a non-object keyword threw. A term or name that was a NUMBER
// was kept as a number, and the first `.toLowerCase()` on it stopped the render.
{
  X.resetRules();
  let sk = null, mErr = null;
  try {
    sk = X.mergeRules({system: 'HB',
      keywords: [{name: 'Aliased', description: 'from description'}, {text: 'no term'}, null, {term: 20, text: 'n'}, {term: '  '}],
      spells: [{}, null, 'Fireball', {name: 7}, {name: '  '}, {name: 'Ok'}]}, 'hb.json');
  } catch (e) { mErr = e; }
  ck('#71 mergeRules copes with entries that have no name, or are not objects', !mErr, mErr && String(mErr));
  const kw = (X.rules.keywords || []).map(k => k.term);
  const al = (X.rules.keywords || []).find(k => k.term === 'Aliased');
  ck('#71 a keyword written {name, description} is read as its term and text',
     !!al && al.text === 'from description', X.rules.keywords);
  ck('#71 a numeric term or name is kept, as text',
     kw.includes('20') && (X.rules.spells || []).some(s => s.name === '7'), [kw, X.rules.spells]);
  ck('#71 nothing without a usable name reaches the pool',
     kw.length === 2 && (X.rules.spells || []).map(s => s.name).sort().join() === '7,Ok', [kw, X.rules.spells]);
  ck('#71 mergeRules returns what it skipped, per category',
     !!sk && sk.keywords === 3 && sk.spells === 4 && Object.keys(sk).length === 2, sk);
  const clean = X.mergeRules({system: 'HB', spells: [{name: 'Fine'}]}, 'ok.json');
  ck('#71 ...and nothing for a clean pack', !!clean && Object.keys(clean).length === 0, clean);
  const summ = typeof ctx.skippedSummary === 'function' ? ctx.skippedSummary : () => 'no skippedSummary()';
  ck('#71 the summary names each category, singular and plural',
     /3 glossary entries/.test(summ({keywords: 3, spells: 1})) && /1 spell\b/.test(summ({keywords: 3, spells: 1}))
       && /1 glossary entry\b/.test(summ({keywords: 1})), summ({keywords: 3, spells: 1}));
  ck('#71 ...and is empty when nothing was skipped', summ({}) === '' && summ(null) === '', summ({}));

  /* the file import writes it on the status line the player is reading */
  const status = {textContent: '', className: ''};
  const getById = ctx.document.getElementById;
  const hadFR = 'FileReader' in ctx;
  ctx.document.getElementById = id => id === 'rulesStatus' ? status : getById(id);
  ctx.FileReader = function () { this.readAsText = f => { this.result = f.text; this.onload && this.onload(); }; };
  X.resetRules();
  ctx.importRulesFiles([{name: 'hb.json', text: JSON.stringify({system: 'HB',
    keywords: [{text: 'no term'}, {term: 'Kept'}], spells: [{level: 1}, {name: 'Zap'}]})}]);
  ck('#71 importing a file says what it skipped',
     /skipped/i.test(status.textContent) && /1 glossary entry/.test(status.textContent) && /1 spell/.test(status.textContent),
     status.textContent);
  ck('#71 ...and the rest of it loaded', (X.rules.keywords || []).length === 1 && (X.rules.spells || []).length === 1);
  X.resetRules();
  ctx.importRulesFiles([{name: 'ok.json', text: JSON.stringify({system: 'HB', spells: [{name: 'Zap'}]})}]);
  ck('#71 ...and a clean file says nothing about skipping', !/skipped/i.test(status.textContent) && /\bok\b/.test(status.className),
     [status.textContent, status.className]);
  ctx.document.getElementById = getById;
  if (!hadFR) delete ctx.FileReader;
  X.resetRules();
}

// ---------- bundle round-trip: bundle == importing every file individually
function entrySet(r){
  const o={};
  X.RULE_CATS.forEach(c=>{o[c]=(r[c]||[]).map(e=>String(e.name||e.term||'')).sort();});
  return o;
}
for(const sys of ['5e2024','humblewood','xanathars','tashas','homebrew']){
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

// ---------- the ammunition controls are wired (#6)
// 90-boot.js is not loaded by the harness, so its handlers are checked as text.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const hooks = ['data-ammo-fire', 'data-ammo-pick', 'data-ammo-load', 'data-ammo-recover'];
  ck('every ammunition control has a click handler', hooks.every(h => js.includes('closest("[' + h + ']")')),
     hooks.filter(h => !js.includes('closest("[' + h + ']")')));
  ck('...and every one the handler names is drawn', hooks.every(h => new RegExp(h + '="\\$\\{esc\\(').test(js)));
  ck('deleting an item forgets its spent count', /\[data-del-item\][^\n]*forgetAmmo\(character,it\.id\)/.test(js));
  ck('End combat offers the ammunition back once the fight has ended', /combatEnd\(character\)[\s\S]{0,200}offerAmmoRecovery\(\)/.test(js));
}

// ---------- the app's ammo tables agree with the 2024 data (#6)
// The one-time pass on old sheets runs without a rules pool, from the AMMO_*
// tables in 62-ammo.js; this keeps them in step with what the converter writes.
{
  const items = JSON.parse(fs.readFileSync(path.join('data','5e2024','items.json'),'utf8')).items;
  const bad = [];
  items.forEach(it => {
    const k = it.name.toLowerCase();
    if (it.weapon && it.weapon.ammo && X.AMMO_LAUNCHERS[k] !== it.weapon.ammo) bad.push('launcher ' + it.name);
    if (it.pack) {
      const b = X.AMMO_BUNDLES[k];
      if (!b || b[0] !== it.ammo.kind || b[1] !== it.pack.qty || X.AMMO_PIECES[b[0]].name !== it.pack.item) bad.push('bundle ' + it.name);
    } else if (it.ammo) {
      const p = X.AMMO_PIECES[it.ammo.kind];
      if (X.AMMO_SINGLE_NAMES[k] !== it.ammo.kind) bad.push('single ' + it.name);
      if (!p || p.name !== it.name || p.weight !== it.weight || p.cost !== it.cost) bad.push('piece ' + it.name);
    }
  });
  ck("every ammo launcher, bundle and piece in the 2024 data is in the app's tables, alike", bad.length === 0, bad);
  ck('...and the check found them', items.filter(i => i.pack).length === 5 && items.filter(i => i.weapon && i.weapon.ammo).length === 9);
}

// ---------- timed conditions are wired (#55)
// 90-boot.js is not loaded by the harness, so its handlers are checked as text.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const body = name => (js.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')) || [''])[0];
  ck("a timed row's round buttons have a click handler", js.includes('closest("[data-status-tick]")'));
  ck('...and are drawn with an escaped id', /data-status-tick="\$\{esc\(/.test(js));
  ck('switching a condition back on restarts its clock', /\[data-toggle-status\][^\n]*restartStatus\(s\)/.test(js));
  ck('the round tracker moves timed conditions with the spells', /tickStatuses\(character,dir\*6\)/.test(body('advanceRound')));
}

// ---------- the supplement packs (Xanathar's, Tasha's)
// These counts are the whole defence against the failure this converter keeps
// producing: a source filter that matches nothing writes a valid, empty,
// entirely plausible-looking pack. A wrong number here is a red test; a silent
// zero would be a shipped pack with nothing in it.
{
  const EXPECT={
    xanathars:{system:'XGE',files:{
      'glossary.json':['keywords',22], 'items-magic.json':['items',53],
      'feats.json':['feats',15], 'spells.json':['spells',95],
      'subclasses.json':['subclasses',31], 'features.json':['features',22],
      'tables.json':['tables',74]}},
    // 26 subclasses, not 30: the Artificer's four already reach the player
    // through the 5e2024 pack, so repeating them would sit BESIDE them.
    tashas:{system:'TCE',files:{
      'glossary.json':['keywords',3], 'items-magic.json':['items',84],
      'feats.json':['feats',15], 'races.json':['races',1], 'spells.json':['spells',21],
      'subclasses.json':['subclasses',26], 'features.json':['features',76],
      'tables.json':['tables',37]}},
  };
  Object.entries(EXPECT).forEach(([dir,spec])=>{
    const onDisk=fs.readdirSync(path.join('data',dir)).filter(f=>f.endsWith('.json')).sort();
    ck(dir+' ships exactly the expected files',
       JSON.stringify(onDisk)===JSON.stringify(Object.keys(spec.files).sort()), onDisk);
    Object.entries(spec.files).forEach(([f,[cat,n]])=>{
      const p=path.join('data',dir,f);
      if(!fs.existsSync(p)){ck(dir+'/'+f+' exists',false);return;}
      const o=JSON.parse(fs.readFileSync(p,'utf8'));
      ck(dir+'/'+f+' has '+n+' '+cat, (o[cat]||[]).length===n, (o[cat]||[]).length);
      ck(dir+'/'+f+' declares system '+spec.system, o.system===spec.system, o.system);
      // every file, not just races.json: the bundler treats excludeSystems as a
      // folder-level property and errors if the files disagree.
      ck(dir+'/'+f+' excludes humblewood',
         JSON.stringify(o.excludeSystems)===JSON.stringify(['humblewood']), o.excludeSystems);
      ck(dir+'/'+f+' says it is 2014-era content', /2014/.test(o._note||''), o._note);
    });
    // A subclass with no traits is what shipping the _copy stub looks like:
    // right count, valid JSON, no features.
    const subs=JSON.parse(fs.readFileSync(path.join('data',dir,'subclasses.json'),'utf8')).subclasses;
    const hollow=subs.filter(s=>!s.class||!s.levels||
      !Object.values(s.levels).some(l=>(l.traits||[]).length));
    ck(dir+' every subclass has a class and at least one trait', hollow.length===0,
       hollow.map(s=>s.name));
    // features merge by name within a system — duplicates vanish silently
    const feats=JSON.parse(fs.readFileSync(path.join('data',dir,'features.json'),'utf8')).features;
    ck(dir+' feature names are unique', new Set(feats.map(f=>f.name)).size===feats.length);
    ck(dir+' every feature names its kind', feats.every(f=>f.source&&f.description));
  });
  // Custom Lineage is the one species here, and the reason excludeSystems exists
  const cl=JSON.parse(fs.readFileSync(path.join('data','tashas','races.json'),'utf8')).races[0];
  const SIZES=['Tiny','Small','Medium','Large','Huge','Gargantuan'];
  ck('Custom Lineage declares sizes the app knows',
     (Array.isArray(cl.size)?cl.size:[cl.size]).every(s=>SIZES.includes(s)), cl.size);
  // the class-tag filter feeds the spell browser's "only my class" toggle
  // ---- the homebrew pack: hand-authored, and the reason `requires` exists
  {
    const files=fs.readdirSync(path.join('data','homebrew')).filter(f=>f.endsWith('.json')).sort();
    ck('homebrew ships the expected files',
       JSON.stringify(files)===JSON.stringify(['features.json','subclasses.json','tables.json']), files);
    const reqs=files.map(f=>JSON.parse(fs.readFileSync(path.join('data','homebrew',f),'utf8')));
    ck('every homebrew file declares system Homebrew', reqs.every(o=>o.system==='Homebrew'));
    // bundle-rules.js compares these with JSON.stringify and fails the build if
    // they differ, so a mismatch must be a red test here first
    const one=JSON.stringify(reqs[0].requires);
    ck('every homebrew file declares the SAME requires', reqs.every(o=>JSON.stringify(o.requires)===one));
    ck('homebrew declares what it needs', Array.isArray(reqs[0].requires)&&reqs[0].requires.length>0);
    // The whole demo rests on these resolving once the right pack is imported.
    // A typo here would show as "missing" forever and look like a working feature.
    const pool={};
    ['5e2024','humblewood','xanathars','tashas'].forEach(d=>{
      X.RULE_CATS.forEach(cat=>{
        const p=path.join('data',d,cat==='spells'?'spells.json':(cat==='classes'?'classes.json':'__none'));
        if(!fs.existsSync(p))return;
        (JSON.parse(fs.readFileSync(p,'utf8'))[cat]||[]).forEach(e=>{
          (pool[cat]=pool[cat]||new Set()).add(String(e.name).toLowerCase());});
      });
    });
    const unresolvable=[];
    reqs[0].requires.forEach(g=>X.RULE_CATS.forEach(cat=>{
      (g[cat]||[]).forEach(n=>{ if(!(pool[cat]&&pool[cat].has(String(n).toLowerCase())))
        unresolvable.push(cat+': '+n); });
    }));
    ck('every name homebrew requires exists in a shipped pack', unresolvable.length===0, unresolvable);
    const sub=JSON.parse(fs.readFileSync(path.join('data','homebrew','subclasses.json'),'utf8')).subclasses[0];
    ck('the Predator attaches to Warlock', sub.class==='Warlock'&&sub.name==='The Predator');
    ck('the Predator has traits at every declared level',
       Object.values(sub.levels).every(l=>(l.traits||[]).length>0), Object.keys(sub.levels));
  }
  const xsp=JSON.parse(fs.readFileSync(path.join('data','xanathars','spells.json'),'utf8')).spells;
  ck('every Xanathar\'s spell carries a class list',
     xsp.every(s=>Array.isArray(s.class)&&s.class.length),
     xsp.filter(s=>!(s.class||[]).length).map(s=>s.name));

  // findTable() looks a table up by NAME across every loaded pack, and a
  // "[Table: X]" anchor carries no pack of its own — so two packs sharing a
  // table name means one book's prose opens the other book's table.
  const seen={};
  ['5e2024','humblewood','xanathars','tashas','homebrew'].forEach(d=>{
    const p=path.join('data',d,'tables.json');
    if(!fs.existsSync(p))return;
    JSON.parse(fs.readFileSync(p,'utf8')).tables.forEach(t=>{(seen[t.name]=seen[t.name]||[]).push(d);});
  });
  const clash=Object.entries(seen).filter(([,v])=>v.length>1);
  ck('no table name is used by two packs', clash.length===0,
     clash.map(([n,v])=>n+' -> '+v.join(', ')));
  // and the anchors must follow the rename, or they resolve to nothing
  ['xanathars','tashas','homebrew'].forEach(d=>{
    const names=new Set(JSON.parse(fs.readFileSync(path.join('data',d,'tables.json'),'utf8'))
      .tables.map(t=>t.name));
    const dangling=[];
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      const raw=fs.readFileSync(path.join('data',d,f),'utf8');
      (raw.match(/\[Table: [^\]"]+\]/g)||[]).forEach(m=>{
        const nm=m.slice(8,-1);
        if(!names.has(nm))dangling.push(f+': '+nm);
      });
    });
    ck(d+' every [Table: …] anchor resolves inside its own pack', dangling.length===0, dangling);
  });
}

// ---------- shipped data: text convert.py's flatten() used to drop (#68)
// A 5e-tools node type flatten() had no branch for vanished without a word:
// "your Arcane Shot save DC is calculated as follows:" and then nothing. The
// converter fixtures prove the renderer; these prove the packs players load
// were regenerated with it, one pin per dropped shape.
{
  const pins=[
    ['5e2024','classes.json','classes','Artificer','Spell save DC = 8 + your proficiency bonus + your Intelligence modifier.'],
    ['5e2024','classes.json','classes','Artificer','Spell attack modifier = your proficiency bonus + your Intelligence modifier.'],
    ['5e2024','classes.json','classes','Mystic','Discipline save DC = 8 + your proficiency bonus + your Intelligence modifier.'],
    ['5e2024','classes.json','classes','Rogue','has the following traits: Psychic Blade: Simple Melee Weapon · Damage 1d6 psychic'],
    ['5e2024','conditions.json','keywords','Cackle Fever','Fever: The creature gains 1 Exhaustion level'],
    ['5e2024','conditions.json','keywords','Sewer Plague','Restlessness: While the creature has any Exhaustion levels'],
    ['xanathars','subclasses.json','subclasses','Arcane Archer','Arcane Shot save DC = 8 + your proficiency bonus + your Intelligence modifier.'],
    ['tashas','subclasses.json','subclasses','Path of the Beast','Bite: Your mouth transforms'],
    ['tashas','subclasses.json','subclasses','College of Creation','Saving Throw: Immediately after'],
    ['tashas','subclasses.json','subclasses','Circle of Stars','Weal (even): Whenever a creature'],
    ['tashas','glossary.json','keywords','Customizing Your Origin','Languages: You can speak, read, and write Common'],
    ['tashas','items-magic.json','items',"Luba's Tarokka of Souls",'Woe: The creature has disadvantage'],
  ];
  const cache={};
  pins.forEach(([dir,f,cat,name,needle])=>{
    const k=dir+'/'+f;
    cache[k]=cache[k]||JSON.parse(fs.readFileSync(path.join('data',dir,f),'utf8'))[cat]||[];
    const e=cache[k].find(x=>x.name===name||x.term===name);
    // JSON.stringify: the text sits at different depths per category
    ck(k+' '+name+' carries "'+needle.slice(0,40)+'…"', !!e&&JSON.stringify(e).includes(needle),
       e?'not found in its text':'no entry named '+name);
  });
}

// ---------- shipped data: every weapon names its properties, and attacks as its base weapon does (#72)
// Only items-base.json defines the 5e-tools property codes, and convert.py once
// read names from the file it was converting, so the magic weapons printed
// "F, L, T" and — "Finesse" never being in the list — attacked with Strength
// where their base weapon uses finesse. A bare code, or a Python dict's repr
// from an object-shaped reference, is how that looks in a pack.
{
  const weapons=[];
  ['5e2024','xanathars','tashas','humblewood','homebrew'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      (JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')).items||[])
        .forEach(it=>{if(it.weapon)weapons.push({where:d+'/'+f,it});});
    }));
  ck('the packs ship weapons to check', weapons.length>=70, weapons.length);
  // "Range 20/60 · Versatile 1d10 · Finesse, Light · Mastery: Nick" -> the property names
  const propsOf=notes=>String(notes||'').split(' · ').filter(s=>s&&!/^(Range |Mastery: )/.test(s))
    .flatMap(s=>/^Versatile \S+$/.test(s)?['Versatile']:s.split(', '))
    .map(p=>p.replace(/ \(.*\)$/,''));
  const CODE=/^[A-Z0-9][A-Za-z0-9]{0,2}$/;   // F, L, 2H, AF, RLD, Vst: never a property's name
  const bareCode=w=>propsOf(w.notes).filter(p=>CODE.test(p));
  const descProps=it=>{const m=/Properties: ([^·]*?)(?: · |\. |$)/.exec(it.description||'');
    return m?m[1].split(', ').map(p=>p.replace(/ \(.*\)$/,'')):[];};
  const bad=weapons.filter(({it})=>bareCode(it.weapon).length||descProps(it).some(p=>CODE.test(p))
    ||/[{}]|'uid'/.test(it.weapon.notes||'')||/Mastery: \{/.test(it.description||''));
  ck('no weapon prints a property code or an object\'s repr, in its notes or its description',
     bad.length===0, bad.map(({where,it})=>where+' '+it.name+': '+it.weapon.notes));
  // a weapon that lists Finesse attacks with finesse, melee or ranged: Finesse is
  // the choice of STR or DEX for either (#75 — the Dart shipped "dex")
  const noFinesse=weapons.filter(({it})=>propsOf(it.weapon.notes).includes('Finesse')&&it.weapon.ability!=='finesse');
  ck('every weapon listing Finesse attacks with finesse, melee or ranged', noFinesse.length===0,
     noFinesse.map(({where,it})=>where+' '+it.name+' ('+it.weapon.kind+'): '+it.weapon.ability));
  const rangedNoFinesse=weapons.filter(({it})=>it.weapon.kind==='ranged'&&!propsOf(it.weapon.notes).includes('Finesse')
    &&it.weapon.ability!=='dex');
  ck('#75 a ranged weapon without Finesse still attacks with DEX', rangedNoFinesse.length===0,
     rangedNoFinesse.map(({where,it})=>where+' '+it.name+': '+it.weapon.ability));
  const dart=weapons.find(({it})=>it.name==='Dart');
  ck('#75 the Dart is a ranged weapon that attacks with finesse',
     !!dart&&dart.it.weapon.kind==='ranged'&&dart.it.weapon.ability==='finesse', dart&&dart.it.weapon);
  // a magic weapon against the base weapon its description names ("Base item: Dagger")
  const base={};
  JSON.parse(fs.readFileSync(path.join('data','5e2024','items.json'),'utf8')).items
    .forEach(it=>{if(it.weapon)base[it.name.toLowerCase()]=it;});
  const based=weapons.map(x=>Object.assign({b:base[((/Base item: ([^·.]+)/.exec(x.it.description||'')||[])[1]||'')
    .trim().toLowerCase()]},x)).filter(x=>x.b);
  ck('magic weapons name base weapons the core pack has', based.length>=12, based.length);
  const offBase=based.filter(({it,b})=>(b.weapon.ability==='finesse'&&it.weapon.ability!=='finesse')
    ||it.weapon.dice!==b.weapon.dice||it.weapon.kind!==b.weapon.kind
    ||propsOf(b.weapon.notes).some(p=>!propsOf(it.weapon.notes).includes(p)));
  ck('every magic weapon keeps its base weapon\'s dice, kind, properties and finesse',
     offBase.length===0, offBase.map(({where,it,b})=>where+' '+it.name+' ('+b.name+'): '+it.weapon.ability+' | '
       +it.weapon.notes+'  vs  '+b.weapon.ability+' | '+b.weapon.notes));
  const dov=weapons.find(({it})=>it.name==='Dagger of Venom');
  ck('the Dagger of Venom reads Finesse, Light, Thrown and attacks with finesse',
     !!dov&&dov.it.weapon.notes==='Range 20/60 · Finesse, Light, Thrown · Mastery: Nick'
     &&dov.it.weapon.ability==='finesse', dov&&dov.it.weapon);
}

// ---------- shipped data: a +N weapon's bonus counts once, on its own attack (#74)
// convert.py wrote 5e-tools' bonusWeapon twice: as the weapon's own atkMisc /
// dmgMisc, and as global `attack`/`damage` effects on the item. attackNumbers()
// adds both on the weapon's row (+2N), and an effect applies to EVERY attack
// while the item is equipped, spell rows included. Every bonusWeapon that
// reaches a pack is scoped to one weapon (or bows, or unarmed strikes), and no
// effect target can say that, so no item in any pack carries an attack or damage
// effect. A pack item whose bonus truly reaches every attack would be named
// here deliberately — there is none today.
{
  const ALL_ATTACKS_OK=[];
  const items=[];
  ['5e2024','xanathars','tashas','humblewood','homebrew'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      (JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')).items||[])
        .forEach(it=>items.push({where:d+'/'+f,it}));
    }));
  const atkDmg=it=>(it.effects||[]).filter(e=>/^(attack|damage)(\.|$)/.test(String(e&&e.target)));
  const dbl=items.filter(({it})=>it.weapon&&(it.weapon.atkMisc||it.weapon.dmgMisc)&&atkDmg(it).length);
  ck('#74 no weapon carries its bonus both on the weapon and as an attack/damage effect', dbl.length===0,
     dbl.map(({where,it})=>where+' '+it.name+': '+JSON.stringify(atkDmg(it))));
  const global=items.filter(({it})=>atkDmg(it).length&&!ALL_ATTACKS_OK.includes(it.name));
  ck('#74 no pack item adds to every attack while equipped', global.length===0,
     global.map(({where,it})=>where+' '+it.name+': '+JSON.stringify(atkDmg(it))));
  // the bonus is not lost on the way: it is on the weapon, where attackNumbers() reads it once
  const plus=items.filter(({it})=>it.weapon&&it.weapon.atkMisc);
  ck('#74 the packs still ship +N weapons (11 core, 4 Tasha\'s)',
     plus.filter(x=>x.where.startsWith('5e2024/')).length===11&&plus.filter(x=>x.where.startsWith('tashas/')).length===4,
     plus.map(({where,it})=>where+' '+it.name));
  [['Dagger of Venom',1],['Sun Blade',2],['Dwarven Thrower',3],['+3 Moon Sickle',3],["Baba Yaga's Pestle",3]]
    .forEach(([name,n])=>{
      const w=(items.find(({it})=>it.name===name)||{it:{}}).it.weapon||{};
      ck('#74 '+name+' carries +'+n+' on its own weapon', w.atkMisc===n&&w.dmgMisc===n, w);
    });
}

// ---------- shipped data: only a standing bonus is an AC or saving-throw effect (#76)
// 5e-tools' bonusAc / bonusSavingThrow tag a bonus whether the book gives it all
// the time or only in a moment, and convert.py wrote every one as a standing
// effect: Quarterstaff of the Acrobat's once-per-rest Reaction read AC +5 while
// equipped. The converter now reads the sentence that states the bonus. This is
// the REVIEWED list of its result: every item in every pack allowed an `ac` or
// `save.*` effect, each read by hand ("while you wear…", "while holding…", "on
// your person", "orbits your head", or no condition at all), and the ones kept
// in prose. A dump upgrade that moves either list fails here and gets read again.
{
  const STANDING={
    'Black Dragon Scale Mail':'ac+1','Blue Dragon Scale Mail':'ac+1','Brass Dragon Scale Mail':'ac+1',
    'Bronze Dragon Scale Mail':'ac+1','Copper Dragon Scale Mail':'ac+1','Gold Dragon Scale Mail':'ac+1',
    'Green Dragon Scale Mail':'ac+1','Red Dragon Scale Mail':'ac+1','Silver Dragon Scale Mail':'ac+1',
    'White Dragon Scale Mail':'ac+1',                      /* "While wearing this armor, you gain a +1 bonus to AC" */
    'Cloak of Protection':'ac+1 saves+1','Ring of Protection':'ac+1 saves+1',
    'Glamoured Studded Leather':'ac+1','Ioun Stone, Protection':'ac+1',
    'Scarab of Protection':'ac+1',                         /* its Defense; the charges are Preservation's */
    'Shield of the Cavalier':'ac+2',                       /* on top of its armor line's shield +2 */
    'Staff of Power':'ac+2 saves+2',
    'Robe of Stars':'saves+1','Stone of Good Luck':'saves+1',
  };
  const CONDITIONAL=[
    ['5e2024','Quarterstaff of the Acrobat','Reaction to twirl the weapon around you, gaining a +5 bonus to your Armor Class against the triggering attack'],
    ['5e2024','Arrow-Catching Shield','+2 bonus to Armor Class against ranged attack rolls'],
    ['5e2024','Bracers of Defense','+2 bonus to Armor Class if you are wearing no armor and using no Shield'],
    ['5e2024','Rod of Alertness','While in that Bright Light, you and your allies gain a +1 bonus to Armor Class and saving throws'],
    ['tashas','Teeth of Dahlver-Nar','[Table: Teeth of Dahlver-Nar]'],
  ];
  const SIX=['str','dex','con','int','wis','cha'];
  const items=[];
  ['5e2024','xanathars','tashas','humblewood','homebrew'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      (JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')).items||[])
        .forEach(it=>items.push({dir:d,where:d+'/'+f,it}));
    }));
  const summary=it=>{
    const fx=(it.effects||[]).filter(e=>/^(ac|save\.)/.test(String(e&&e.target)));
    const ac=fx.filter(e=>e.target==='ac'), sv=fx.filter(e=>e.target.startsWith('save.'));
    const out=[];
    if(ac.length)out.push(ac.map(e=>'ac+'+e.value).join(' '));
    if(sv.length)out.push(sv.length===6&&SIX.every(a=>sv.some(e=>e.target==='save.'+a&&e.value===sv[0].value))
      ?'saves+'+sv[0].value:'partial saves '+JSON.stringify(sv));
    return out.join(' ');
  };
  const got={};
  items.forEach(({where,it})=>{const s=summary(it);if(s)got[it.name]=s;});
  const extra=Object.keys(got).filter(n=>STANDING[n]!==got[n]);
  const missing=Object.keys(STANDING).filter(n=>got[n]!==STANDING[n]);
  ck('#76 every AC or saving-throw effect in the packs is a reviewed standing bonus', extra.length===0,
     extra.map(n=>n+': '+got[n]));
  ck('#76 ...and every reviewed standing bonus still ships as one', missing.length===0,
     missing.map(n=>n+': want '+STANDING[n]+', got '+(got[n]||'nothing')));
  CONDITIONAL.forEach(([dir,name,needle])=>{
    const e=(items.find(x=>x.dir===dir&&x.it.name===name)||{}).it;
    ck('#76 '+name+' carries no standing effect', !!e&&(e.effects||[]).length===0, e&&e.effects);
    ck('#76 ...and still states its bonus in its text', !!e&&(e.description||'').includes(needle),
       e?(e.description||'').slice(0,120):'no item named '+name);
  });
}

// ---------- shipped data: an item's spell attack and spell save DC bonus is an effect (#77)
// 5e-tools' bonusSpellAttack / bonusSpellSaveDc were never read, and the app had
// no target for either. The REVIEWED list of every pack item carrying one, each
// read by hand: every one is standing ("while holding…", "while you wear or hold
// it", the Robe's "each increase by 2"). Tasha's focuses and Moon Sickles name a
// class ("of your druid and ranger spells"); the sheet has one spellcasting
// ability, so the bonus goes on it and the class stays in the text.
{
  const SPELL={
    '5e2024':{'+1 Wand of the War Mage':'atk+1','+2 Wand of the War Mage':'atk+2','+3 Wand of the War Mage':'atk+3',
              'Robe of the Archmagi':'atk+2 dc+2','Staff of Power':'atk+2','Staff of the Magi':'atk+2',
              'Staff of the Woodlands':'atk+2','Talisman of Pure Good':'atk+2','Talisman of Ultimate Evil':'atk+2'},
    'tashas':{"Reveler's Concertina":'dc+2'},
    'xanathars':{},
  };
  ['All-Purpose Tool','Amulet of the Devout','Arcane Grimoire','Bloodwell Vial','Moon Sickle',"Rhythm-Maker's Drum"]
    .forEach(n=>[1,2,3].forEach(k=>{SPELL.tashas['+'+k+' '+n]='atk+'+k+' dc+'+k;}));
  const got={};
  ['5e2024','xanathars','tashas','humblewood','homebrew'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      (JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')).items||[]).forEach(it=>{
        const fx=(it.effects||[]).filter(e=>/^spell\./.test(String(e&&e.target)));
        if(fx.length)(got[d]=got[d]||{})[it.name]=fx.map(e=>(e.target==='spell.attack'?'atk':e.target==='spell.dc'?'dc':e.target)+'+'+e.value).join(' ');
      });
    }));
  ['5e2024','xanathars','tashas','humblewood','homebrew'].forEach(d=>{
    const want=SPELL[d]||{}, have=got[d]||{};
    const wrong=Object.keys(have).filter(n=>want[n]!==have[n]).concat(Object.keys(want).filter(n=>have[n]!==want[n]));
    ck('#77 '+d+': exactly the reviewed items carry a spell attack or spell save DC bonus ('+Object.keys(want).length+')',
       wrong.length===0, [...new Set(wrong)].map(n=>n+': want '+(want[n]||'none')+', got '+(have[n]||'none')));
  });
}

// ---------- shipped data: every effect a pack carries is one the app adds up (#77)
// An effect is summed only by a reader that asks for its target by name. A target
// fxTargets() does not list is summed by nothing, and nothing says so: the item
// shows a chip and changes no number. Every `effects` array, at any depth.
{
  const known=new Set(X.fxTargets().map(([l,t])=>t));
  const bad=[];
  const walk=(n,where)=>{
    if(Array.isArray(n))return n.forEach(x=>walk(x,where));
    if(!n||typeof n!=='object')return;
    if(Array.isArray(n.effects))n.effects.forEach(e=>{if(!e||!known.has(e.target))bad.push(where+' '+(n.name||n.term||'?')+': '+JSON.stringify(e));});
    Object.keys(n).forEach(k=>walk(n[k],where));
  };
  ['5e2024','xanathars','tashas','humblewood','homebrew'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json'))
      .forEach(f=>walk(JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')),d+'/'+f)));
  ck('#77 every effect target in every pack is one fxTargets() lists', bad.length===0, bad.slice(0,10));
  ck('#77 ...and the spell targets are among them', known.has('spell.attack')&&known.has('spell.dc'), [...known].slice(-4));
  ck('#79 ...and so is `check`, every ability check', known.has('check'), [...known].filter(t=>!/^(ability|save|skill)\./.test(t)));
}

// ---------- shipped data: a standing bonus to ability checks or proficiency is an effect (#79)
// 5e-tools' bonusAbilityCheck and bonusProficiencyBonus were never read: the Stone
// of Good Luck's +1 to ability checks and the Ioun Stone of Mastery's +1
// proficiency bonus changed no number. The REVIEWED list of every `check` and
// `profBonus` effect in any file of any pack, each read by hand: "while this
// polished agate is on your person", "while this pale green prism orbits your
// head". A dump upgrade that moves it fails here and gets read again.
{
  const WANT={'5e2024/items-magic.json Stone of Good Luck':'check+1','5e2024/items-magic.json Ioun Stone, Mastery':'profBonus+1'};
  const got={};
  const walk=(n,where)=>{
    if(Array.isArray(n))return n.forEach(x=>walk(x,where));
    if(!n||typeof n!=='object')return;
    if(Array.isArray(n.effects))n.effects.forEach(e=>{ if(e&&(e.target==='check'||e.target==='profBonus')){
      const k=where+' '+(n.name||n.term||'?'); got[k]=(got[k]?got[k]+' ':'')+e.target+(e.value>=0?'+':'')+e.value; } });
    Object.keys(n).forEach(k=>walk(n[k],where));
  };
  ['5e2024','xanathars','tashas','humblewood','homebrew'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json'))
      .forEach(f=>walk(JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')),d+'/'+f)));
  const wrong=[...new Set(Object.keys(got).concat(Object.keys(WANT)))].filter(k=>got[k]!==WANT[k]);
  ck('#79 exactly the reviewed items carry an ability-check or proficiency-bonus effect (2)', wrong.length===0,
     wrong.map(k=>k+': want '+(WANT[k]||'none')+', got '+(got[k]||'none')));
  const stone=JSON.parse(fs.readFileSync(path.join('data','5e2024','items-magic.json'),'utf8')).items.find(x=>x.name==='Stone of Good Luck');
  ck('#79 the Stone of Good Luck keeps its +1 to all six saves beside it',
     !!stone&&['str','dex','con','int','wis','cha'].every(a=>stone.effects.some(e=>e.target==='save.'+a&&e.value===1)), stone&&stone.effects);
}

// ---------- shipped data: no 5e-tools template or tag reaches a player (#78)
// 5e-tools writes shared item text as "{#itemEntry Name|SRC}" and fills
// "{{item.resist}}" from the item; its inline tags are "{@tag …}" and magic
// variants use "{=prop}". convert.py passed the first through as text, so 54
// items read the tag where the book's words belong. Every string, at any depth,
// in every file of every pack — a new shape would reach players the same way.
{
  const TPL=/\{#[^{}]*\}|\{\{[^{}]*\}\}|\{=[^{}]*\}|\{@[^{}]*\}/;
  const bad=[];
  const walk=(n,where,name)=>{
    if(typeof n==='string'){const m=TPL.exec(n);if(m)bad.push(where+' '+name+': '+m[0]);return;}
    if(Array.isArray(n))return n.forEach(x=>walk(x,where,name));
    if(!n||typeof n!=='object')return;
    const nm=n.name||n.term||name;
    Object.keys(n).forEach(k=>walk(n[k],where,nm));
  };
  let files=0;
  ['5e2024','xanathars','tashas','humblewood','homebrew'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      files++; walk(JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')),d+'/'+f,'?');
    }));
  ck('#78 the packs have files to scan', files>=30, files);
  ck('#78 no pack carries 5e-tools template text: no {#…}, {{…}}, {=…} or {@…}', bad.length===0,
     bad.length+' strings, e.g. '+JSON.stringify(bad.slice(0,6)));
  // the families that shipped the tag now read the book's words, filled from the item
  const pins=[
    ['5e2024','Black Dragon Scale Mail','you have Resistance to Acid damage'],
    ['5e2024','Silver Dragon Scale Mail','the closest silver dragon within 30 miles'],
    ['5e2024','Ring of Acid Resistance','You have Resistance to Acid damage while wearing this ring. The ring is set with pearl'],
    ['5e2024','Potion of Thunder Resistance','When you drink this potion, you have Resistance to Thunder damage for 1 hour'],
    ['5e2024','Ioun Stone, Mastery','Roughly marble sized, Ioun Stones are named after Ioun'],
    ['tashas','Radiant Absorbing Tattoo','emphasize one color (gold).'],
    ['tashas','Radiant Absorbing Tattoo','Damage Absorption: When you take radiant damage'],
  ];
  const magic={};
  pins.forEach(([d,name,needle])=>{
    magic[d]=magic[d]||JSON.parse(fs.readFileSync(path.join('data',d,'items-magic.json'),'utf8')).items;
    const e=magic[d].find(x=>x.name===name);
    ck('#78 '+d+' '+name+' reads "'+needle.slice(0,48)+'…"', !!e&&(e.description||'').includes(needle),
       e?(e.description||'').slice(0,160):'no item named '+name);
  });
}

// ---------- the Spellcasting card's numbers open their breakdown, as AC does (#77)
{
  const t=loadHTML();
  ck('#77 the spell save DC is tappable: data-stat="spell.dc"', /<div class="big" data-stat="spell\.dc" id="dcDisp">/.test(t),
     (/[^\n]*id="dcDisp"[^\n]*/.exec(t)||[''])[0].trim());
  ck('#77 the spell attack is tappable: data-stat="spell.attack"', /<div class="big" data-stat="spell\.attack" id="satkDisp">/.test(t),
     (/[^\n]*id="satkDisp"[^\n]*/.exec(t)||[''])[0].trim());
  // an item can raise the proficiency bonus now (the Ioun Stone of Mastery), so it says where from (#79)
  ck('#79 the proficiency bonus is tappable: data-stat="profBonus"', /<div class="big" data-stat="profBonus" id="pbDisp">/.test(t),
     (/[^\n]*id="pbDisp"[^\n]*/.exec(t)||[''])[0].trim());
}

// ---------- subclassesFor: a supplement must not overwrite a 2024 subclass
// The map is keyed by NAME because that is what character.classes[].subclass
// stores. The 2024 PHB reprinted seven XGE/TCE subclasses, so a bare last-wins
// merge would silently swap a 2024 character's Gloom Stalker for the 2014 one.
X.resetRules();
X.mergeRules({system:'XPHB',classes:[{name:'Ranger',subclasses:{'Gloom Stalker':{description:'2024'}}}]},'5e.json');
X.mergeRules({system:'XGE',subclasses:[{class:'Ranger',name:'Gloom Stalker',description:'2014'}]},'xge.json');
{
  const m=X.subclassesFor(X.findClassDef('Ranger'));
  ck('the 2024 subclass keeps its bare name', m['Gloom Stalker'] && m['Gloom Stalker'].description==='2024',
     m['Gloom Stalker']);
  ck('the supplement version is offered too, tagged with its pack',
     !!m['Gloom Stalker (XGE)'] && m['Gloom Stalker (XGE)'].description==='2014', Object.keys(m));
}
// a standalone subclass with no nested rival still uses its plain name
X.resetRules();
X.mergeRules({system:'XPHB',classes:[{name:'Ranger'}]},'5e.json');
X.mergeRules({system:'XGE',subclasses:[{class:'Ranger',name:'Horizon Walker'}]},'xge.json');
ck('an uncontested subclass is not renamed',
   !!X.subclassesFor(X.findClassDef('Ranger'))['Horizon Walker']);
// re-importing the SAME pack must still replace, not accumulate
X.mergeRules({system:'XGE',subclasses:[{class:'Ranger',name:'Horizon Walker',description:'v2'}]},'xge.json');
{
  const m=X.subclassesFor(X.findClassDef('Ranger'));
  ck('re-importing a pack replaces its own subclass',
     Object.keys(m).length===1 && m['Horizon Walker'].description==='v2', Object.keys(m));
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
/* deliberately a system DATA_VERSIONS has never heard of — "Homebrew" used to
   play this role and is now a real shipped pack, which made the test read as if
   it were asserting something about that pack. */
X.mergeRules({system:'MyOwnStuff', rulebook:true, races:[{name:'Mine'}]}, 'mine.json');

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
   X.dataStatus(byLabel['MyOwnStuff']).state === 'unknown');
ck('the loaded dataVersion is recorded on the group',
   byLabel['XPHB'].dataVersion === '1.0.0');

// the badge: visible for stale, quiet otherwise
ck('stale renders an update chip', /update available/.test(X.dataStatusHTML(byLabel['XPHB'])));
ck('current renders no update chip', !/update available/.test(X.dataStatusHTML(byLabel['Humblewood'])));
ck('unknown renders nothing at all', X.dataStatusHTML(byLabel['MyOwnStuff']) === '');
ck('the chip reaches the Settings list', /update available/.test(X.rulesDataHTML()));

// a NEWER pack than the app expects is not "stale" either — the player is ahead
X.resetRules();
X.mergeRules({system:'XPHB', dataVersion:'99.0.0', rulebook:true, races:[{name:'Elf'}]}, 'f.json');
ck('a pack newer than the app is not flagged stale',
   X.dataStatus(X.loadedRulesGroups()[0]).state === 'current');

// ---------- every shipped pack agrees with DATA_VERSIONS
[['5e2024_full.json','XPHB'], ['humblewood_full.json','Humblewood'],
 ['xanathars_full.json','XGE'], ['tashas_full.json','TCE'],
 ['homebrew_full.json','Homebrew']].forEach(([f, sysName]) => {
  const p = path.join(ROOT, 'dist', f);
  if (!fs.existsSync(p)) { ck(f + ' exists', false); return; }
  const pack = JSON.parse(fs.readFileSync(p, 'utf8'));
  ck(f + ' declares a dataVersion', !!pack.dataVersion, pack.dataVersion);
  ck(f + ' dataVersion matches DATA_VERSIONS.' + sysName,
     pack.dataVersion === X.DATA_VERSIONS[sysName],
     pack.dataVersion + ' vs ' + X.DATA_VERSIONS[sysName]);
  ck(f + " system is the DATA_VERSIONS key", pack.system === sysName, pack.system);
});
// The bundle is the file players actually import. bundle-rules.js builds it from
// a fixed key list, so a pack property it doesn't know about is dropped — the
// per-category files would filter correctly and the bundle silently would not.
[['xanathars_full.json'], ['tashas_full.json']].forEach(([f]) => {
  const p = path.join(ROOT, 'dist', f);
  if (!fs.existsSync(p)) return;
  const pack = JSON.parse(fs.readFileSync(p, 'utf8'));
  ck(f + ' carries excludeSystems through bundling',
     JSON.stringify(pack.excludeSystems) === JSON.stringify(['humblewood']), pack.excludeSystems);
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
// NOTE_SECTIONS drives the icon injection, the Section Notes card's grouping and
// its headings. If it and the template disagree, a section silently loses its
// icon or a note becomes unreachable — with no error either way.
{
  const t = loadHTML();
  const inTemplate = (t.match(/data-note="([a-z]+)"/g) || []).map(s => s.slice(11, -1));

  ck('the registry has 20 sections', X.NOTE_SECTIONS.length === 20, X.NOTE_SECTIONS.length);
  ck('every section id is unique',
     new Set(X.NOTE_SECTIONS.map(s => s.k)).size === X.NOTE_SECTIONS.length);
  ck('every section names a tab the Section Notes card can group under',
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
     (t.match(/<div class="card" data-note="[a-z]+"/g) || []).length === 20,
     (t.match(/<div class="card"[^>]*data-note[^>]*>/g) || []).length);
  /* The Journal panel, sliced to the next panel so a card on a LATER tab can
     neither satisfy nor break these. The regex this replaced ran on to the end
     of the page, and would have passed vacuously once the id changed. */
  const jAt = t.indexOf('id="tab-journal"'), jEnd = t.indexOf('<section class="tabpanel', jAt + 1);
  const jPanel = jAt < 0 ? '' : t.slice(jAt, jEnd < 0 ? undefined : jEnd);
  ck('the Journal tab exists', jAt >= 0);
  ck('the only card on the Journal tab that takes a note is Trackers',
     JSON.stringify(jPanel.match(/data-note="[a-z]+"/g) || []) === JSON.stringify(['data-note="trackers"']),
     jPanel.match(/data-note="[a-z]+"/g));
  ck('the Journal tab runs Journal, Trackers, Section Notes',
     jPanel.indexOf('id="journalCard"') >= 0 &&
     jPanel.indexOf('id="journalCard"') < jPanel.indexOf('data-note="trackers"') &&
     jPanel.indexOf('data-note="trackers"') < jPanel.indexOf('id="notesList"'));
  ck('the Journal tab has the list the notes renderer targets', jPanel.includes('id="notesList"'));
  ck('nothing still calls it the Notes tab', !/id="tab-notes"|data-tab="notes"/.test(t));

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
  const t = loadHTML();
  const tabs = (t.match(/class="tab(?: active)?" data-tab="([a-z]+)"/g) || [])
    .map(s => /data-tab="([a-z]+)"/.exec(s)[1]);
  const panels = (t.match(/class="tabpanel(?: active)?" id="tab-([a-z]+)"/g) || [])
    .map(s => /id="tab-([a-z]+)"/.exec(s)[1]);
  ck('there are six tabs', tabs.length === 6, tabs);
  ck('every tab has a panel', tabs.every(n => panels.indexOf(n) >= 0), tabs.filter(n => panels.indexOf(n) < 0));
  // the combat panel's tab is the crossed swords beside ☰, not a word tab
  ck('every panel has a tab', panels.every(n => tabs.indexOf(n) >= 0 || (n === 'combat' && /id="btnCombat"/.test(t))),
     panels.filter(n => tabs.indexOf(n) < 0));
  ck('exactly one tab starts active', (t.match(/class="tab active"/g) || []).length === 1);
  ck('every tab carries a glyph and a word',
     (t.match(/class="tabicon"/g) || []).length === 6 && (t.match(/class="tlbl"/g) || []).length === 6);
  // buildToc() reads the tab button's textContent for its heading, so a <title>
  // inside the icon would end up in the flyout
  ck('no tab icon carries a title element', !/<svg class="tabicon"[^>]*>\s*<title/.test(t));
  ck('the icon-tab mode has a default on the root element', /<html[^>]*data-tabs="labels"/.test(t));
}

// ---------- loadHTML() agrees with what the build actually shipped
// harness.loadHTML() re-implements build-html.js's splice rather than calling it
// (that script builds and process.exit()s at require time), so the two can drift.
// Every other markup guard here is shape-based and would sail past a stray
// separator — a join("\n") instead of join("") inserts six blank lines and
// changes nothing any of them measure. This is the only check that notices.
//
// It does mean this suite needs dist/fieldbook.html to be current. If it fails,
// run ./build.sh (or node scripts/build-html.js) before believing the diagnosis.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const blob = manifest.html.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('');
  const built = fs.readFileSync(path.join(ROOT, 'dist/fieldbook.html'), 'utf8');
  ck('the assembled markup is byte-for-byte what the build shipped', built.includes(blob),
     'dist/fieldbook.html is stale, or loadHTML() no longer splices the way build-html.js does');
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

  // blank means gone — otherwise the Section Notes card lists empty entries forever
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
  /* Counts read like the inventory section heads now — parenthesised, plain.
     .fgcount is still the PILL, kept for the Settings badges ("12 entries"),
     which are text and would read wrongly in brackets. */
  ck('the group count is the number of notes in it', h.includes('<span class="cnt">(2)</span>'), h.slice(0, 160));
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
  const res = fs.readFileSync(path.join(ROOT, 'src/js/66-coins-hp.js'), 'utf8');
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
  // markup lives in the shell AND in src/html now — both declare ids
  const files = ['src/fieldbook.template.html'].concat(manifest.html, manifest.js);
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
  /* Comments are stripped before anything else looks at the template. block()
     counts <div>/</div> to find an element's extent, so a `<div` written inside
     a comment — describing the markup, which is exactly the kind of comment this
     file attracts — throws the depth off and silently stretches a slice past the
     element it was meant to bound. Counting guards would drift the same way.
     Cheaper to remove comments once than to keep "don't write <div in a comment"
     true by hand forever.

     Order matters: loadHTML() splices FIRST, we strip SECOND. The build's marker
     <!--@@HTML@@--> is itself an HTML comment, so stripping the raw template
     first would delete it and the splice would find nothing to replace. Don't
     "tidy" the strip into the helper. */
  const t = loadHTML().replace(/<!--[\s\S]*?-->/g, '');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  /* CSS comments go the same way as the HTML ones, and for the same reason: a
     comment explaining a rule quotes that rule, so counting guards see it twice.
     `display:contents` tripped exactly that within minutes of being written. */
  const css = f => fs.readFileSync(path.join(ROOT, 'src/css/' + f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const cardsCss = css('20-cards.css');
  const sheetCss = css('30-sheet.css');
  const chromeCss = css('10-chrome.css');

  /* Slice one element and its whole subtree by counting <div>/</div> from the
     tag carrying `needle`. The guards below used to slice "from this literal to
     the next <div class=\"card\"" and "non-greedy to the first </div>", and both
     encoded the current NESTING as well as the current content — so a block
     moving between cards, or a child turning into a <div>, broke them for
     reasons that had nothing to do with what they guard. */
  function block(html, needle) {
    const at = html.lastIndexOf('<div', html.indexOf(needle));
    const re = /<div\b|<\/div>/g;
    re.lastIndex = at;
    let depth = 0, m;
    while ((m = re.exec(html))) {
      depth += m[0] === '</div>' ? -1 : 1;
      if (depth === 0) return html.slice(at, m.index + m[0].length);
    }
    /* Never return the unterminated tail. Every consumer below asks "is X inside
       this block?" with .includes(), so a slice running to end-of-document makes
       those assertions trivially TRUE — the block would swallow the rest of the
       app and pass. Now that the markup lives in seven separately-editable files,
       a fragment losing its closing </section> is a real way to get here. */
    throw new Error('block(): unbalanced <div> searching from ' + JSON.stringify(needle));
  }
  const vitals = block(t, 'data-note="vitals"');
  const rest = block(t, 'data-note="rest"');
  const hpwrap = block(t, 'class="hpwrap"');

  // The whole point of the HP rework: data-path commits on every keystroke, so
  // typing "-3" would store "-" at the first character.
  ck('no HP box is bound with data-path', !/data-path="character\.hp\./.test(t + js));
  ck('each HP box has exactly one data-hp hook',
     ['cur', 'max', 'temp'].every(k => (t.match(new RegExp('data-hp="' + k + '"', 'g')) || []).length === 1));
  ck('HP boxes are text, not number (number strips a leading +)',
     !/data-hp="[a-z]+"[^>]*type="number"/.test(t) && (t.match(/inputmode="tel" data-hp=/g) || []).length === 3,
     t.match(/<input[^>]*data-hp[^>]*>/g));

  // 90-boot.js is dropped from the test bundle (harness.js), so its call sites
  // are unreachable and regex-on-source is the only check there is. Brittle, but
  // the alternative is no coverage at all on wiring that fails quietly.
  const bumpHP = (js.match(/function bumpHP\([^)]*\)\{[^\n]*\}/) || [''])[0];
  ck('the − button delegates to adjustHP', /adjustHP\(/.test(bumpHP), bumpHP);
  ck('...and no longer writes current HP itself', !/character\.hp\.cur\s*=/.test(bumpHP), bumpHP);
  ck('editing CON re-syncs a level-1 seeded max HP',
     /character\.abilities\.con/.test(js) && /resyncLevel1HP\(prevCon\)/.test(js));

  // the death-save click handler is `.death .c` — the circles must stay inside it
  const deathBlock = block(t, 'class="death"');
  ck('both death-save sets are inside .death',
     deathBlock.includes('id="deathSucc"') && deathBlock.includes('id="deathFail"'), deathBlock);
  // failures read first, beside the skull's own colour; successes on the right
  ck('failures come before successes',
     deathBlock.indexOf('id="deathFail"') < deathBlock.indexOf('id="deathSucc"'));
  ck('the death saves stay inside the HP panel, under the +/- row',
     hpwrap.includes('id="deathFail"') && hpwrap.indexOf('id="hpMinus"') < hpwrap.indexOf('id="deathFail"'));
  ck('the failure set is laid out in reverse so it fills outward from the skull',
     /\.death \.set\[data-kind="fail"\]\{[^}]*row-reverse/.test(sheetCss));
  // a bare U+FE0E is invisible in source and a colour emoji is wrong on the sheet
  ck('the skull is the text-presentation entity pair', t.includes('&#9760;&#65038;'));

  // starBtn is looked up UNGUARDED nowhere any more, but it is still the id both
  // recompute() and wire() reach for, and there must be exactly one
  ck('exactly one starBtn', (t.match(/id="starBtn"/g) || []).length === 1);
  // was a one-physical-line regex, which pinned the label's formatting as well
  // as the fact that it holds the star
  ck('the star sits in the Vitals label row',
     ((vitals.match(/<div class="label">[\s\S]*?<\/div>/) || [''])[0]).includes('id="starBtn"'));

  // Hit Dice live in Rest & Recovery, under the rest buttons: they are spent on
  // a short rest and come back on a long one. They sat in Vitals for one release
  // (1.7.0), which put them in the combat view by default, between the player
  // and the hit points they were watching. Vitals keeps exactly the hit points.
  const hd = ['hitdiceInput', 'data-hdmode', 'hdWrap'];
  const owned = ['data-hp="cur"', 'data-hp="max"', 'data-hp="temp"', 'id="deathFail"', 'data-hplock'];
  ck('Vitals owns HP, the death saves and the padlock',
     owned.every(s => vitals.includes(s)), owned.filter(s => !vitals.includes(s)));
  ck('...and no hit dice', !hd.some(s => vitals.includes(s)), hd.filter(s => vitals.includes(s)));
  ck('Rest & Recovery keeps both rest buttons',
     rest.includes('id="btnShortRest"') && rest.includes('id="btnLongRest"'));
  ck('...and owns all of hit dice', hd.every(s => rest.includes(s)), hd.filter(s => !rest.includes(s)));
  ck('...under the rest buttons', rest.indexOf('id="hdWrap"') > rest.indexOf('id="btnLongRest"'));
  ck('...and no hit points', !/data-hp=/.test(rest), rest);
  ck('hit dice is written once, not in two cards',
     (t.match(/id="hitdiceInput"/g) || []).length === 1 &&
     (t.match(/id="hdWrap"/g) || []).length === 1);

  // .hd-row is display:contents feeding .hd-grid's repeat(4,max-content): the
  // row hands its four cells straight to that grid, which is the only reason a
  // multiclass pool lines its die/pips/count/Roll up across rows. Anything
  // nested between them breaks the alignment with no error at all — and only on
  // a multiclass sheet, which is why it needs a guard rather than an eyeball.
  ck('.hd-row is display:contents', /\.hd-row\{[^}]*display:contents/.test(cardsCss));
  ck('.hd-grid is the four-column max-content grid it feeds',
     /\.hd-grid\{[^}]*grid-template-columns:repeat\(4,max-content\)/.test(cardsCss));
  ck('renderHitDice puts .hd-row directly inside .hd-grid',
     /class="hd-grid">`\s*\+\s*pool\.map/.test(js) &&
     /return `<div class="hd-row">/.test(js));

  // the two panels are a pair: one heading rule, one frame treatment, one colour
  // apart. The rough skin is why the frame matters — a real CSS border takes no
  // filter, so it stops matching .hpwrap the moment the two become neighbours.
  ck('Hit Points and Hit Dice share one heading rule', /\.hp-title,\.hd-title\{/.test(sheetCss));
  // the rule existing is not the same as the panel wearing it
  ck('both panels actually carry a heading',
     /<div class="hp-title">Hit Points<\/div>/.test(hpwrap) &&
     /<div class="hd-title">Hit Dice[\s\S]{0,200}?<\/div>/.test(rest));
  // the auto/manual pill rides ON the heading — alone on its own line it read as
  // an orphaned control and cost a whole row of the panel's height
  ck('the auto/manual pill sits on the Hit Dice heading',
     /<div class="hd-title">Hit Dice <button class="hd-mode" data-hdmode/.test(rest));
  // anchored at a line start so it matches the STANDALONE rule, not the shared
  // `.hp-title,.hd-title{...}` one, whose body has no colour at all
  ck('the hit-dice heading is not brick (that is the HP panel\'s colour)',
     /\n\.hd-title\{[^}]*color:var\(--(?!brick\))[a-z0-9-]+\)/.test(sheetCss),
     (sheetCss.match(/\n\.hd-title\{[^}]*\}/) || [''])[0]);
  ck('the hit-dice panel takes the rough skin like the HP panel does',
     /html\[data-rough="on"\] \.hd-box::before/.test(cardsCss) &&
     /html\[data-rough="on"\] \.hpwrap::before/.test(sheetCss));

  // ---- the Max HP lock
  ck('exactly one padlock, and it is beside the Max label',
     (t.match(/data-hplock/g) || []).length === 1 && /Max <button class="hp-lock" data-hplock/.test(t),
     (t.match(/<div class="n">Max[\s\S]{0,60}/) || [''])[0]);
  // U+1F512 has no text-presentation variant, so the &#65038; trick that tames
  // the skull does not exist for it — it would render as a colour emoji
  ck('the padlock is an icon button, not an emoji',
     /data-hplock[\s\S]{0,200}<svg/.test(t) && !/🔒|&#128274;/.test(t));
  ck('the padlock announces its state to a screen reader',
     /data-hplock[\s\S]{0,160}aria-pressed=/.test(t));
  ck('the padlock shares the hit-dice pill', /\.hd-mode,\.hp-lock\{/.test(cardsCss));
  // two layers: readOnly is only a hint, so applyHPInput refuses it a second time
  ck('renderHP drives the Max box readOnly from the lock',
     /function renderHP\(\)\{[\s\S]*?getElementById\("hpMax"\)[\s\S]{0,60}readOnly=/.test(js));
  ck('...and repaints the padlock itself', /function renderHP\(\)\{[\s\S]*?data-hplock/.test(js));
  ck('applyHPInput refuses a locked Max before it writes anything',
     /k==="max"&&character\.hp\.locked!==false\)\{renderHP\(\);return false;\}/.test(js));
  ck('the data-hp guard no longer admits the new non-numeric key',
     !/inp\.dataset\.hp;if\(!k\|\|!\(k in character\.hp\)\)/.test(js));
  ck('the padlock is wired and toggles the lock',
     /closest\("\[data-hplock\]"\)/.test(js) && /character\.hp\.locked=character\.hp\.locked===false/.test(js));
  ck('unlocking focuses the Max box',
     /data-hplock[\s\S]{0,340}getElementById\("hpMax"\)[\s\S]{0,90}focus\(\)/.test(js));
  ck('the padlock does not ask for confirmation', !/data-hplock[\s\S]{0,340}confirm\(/.test(js));
  // the automatic writers go to the model, not through the box, and never touch
  // the flag. Gaining levels clears it (the fallback for a dismissed HP step);
  // the HP step alone may set it again, and only to restore what it found (#58).
  const cls = fs.readFileSync(path.join(ROOT, 'src/js/56-class.js'), 'utf8');
  const fnBody = n => (cls.match(new RegExp('function ' + n + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')) || [''])[0];
  ck('the seed, re-sync and un-seed never touch the lock',
     ['seedLevel1HP', 'resyncLevel1HP', 'removeClass'].every(n => fnBody(n) && !/hp\.locked/.test(fnBody(n))));
  ck('doLevelUp clears the lock',
     /function doLevelUp\(\)\{[\s\S]*?character\.hp\.locked=false;renderHP\(\)/.test(cls));
  ck('...and reads it for the HP step BEFORE clearing it',
     /const hp=hpChoice\([^)]*\);[\s\S]{0,800}character\.hp\.locked=false/.test(fnBody('doLevelUp')));
  ck('the only re-lock is the HP step restoring what it found',
     (cls.match(/hp\.locked=true/g) || []).length === 1 && /if\(ch\._wasLocked\)character\.hp\.locked=true/.test(fnBody('commitHPChoice')));
  ck('the seed and the un-seed still write hp.max directly (they bypass the lock)',
     /character\.hp\.max=hp;/.test(cls) && /character\.hp\.max=now;/.test(cls) && /character\.hp\.max="";/.test(cls));

  // ---- current-HP colour bands
  ck('the warn colour is its own token, not --accent',
     // on the classic skin --accent IS --brick, so reusing it would make the
     // amber and the red bands identical
     /--warn:/.test(fs.readFileSync(path.join(ROOT, 'src/css/00-tokens.css'), 'utf8')));
  ck('--warn is defined in every palette that defines --brick', (() => {
    const tok = fs.readFileSync(path.join(ROOT, 'src/css/00-tokens.css'), 'utf8');
    return (tok.match(/--warn:/g) || []).length === (tok.match(/--brick:/g) || []).length;
  })());
  ck('both bands are styled on the HP box',
     /\.hpcol input\.hp-warn\{color:var\(--warn\)\}/.test(sheetCss) &&
     /\.hpcol input\.hp-danger\{color:var\(--brick\)\}/.test(sheetCss));
  ck('renderHP paints the band onto the Current box',
     /function renderHP\(\)\{[\s\S]*?getElementById\("hpCur"\)[\s\S]{0,140}classList\.toggle\("hp-warn"/.test(js));
  ck('the colour switch is in the "This character" settings section, per character',
     /id="swHpColor"/.test(js) && /character\.hpColor/.test(js));
  // spec §11 (#41): the Trackers switch is drawn in This character and does something
  ck('the Trackers switch is rendered in the "This character" settings section',
     /id="swTrackers"/.test((js.match(/const secCharacter=activeId\?`[\s\S]*?`:"";/) || [''])[0]) &&
     /showTrackers\(character\)\?"on":""\}" id="swTrackers"/.test(js));
  ck('...and wired: a tap flips showTrackers, redraws the card and saves',
     /getElementById\("swTrackers"\);if\(b\)b\.addEventListener\("click",\(\)=>\{character\.showTrackers=!showTrackers\(character\);[^}]*renderTrackers\(\);scheduleSave\(\);\}\)/.test(js),
     (js.match(/.{0,40}getElementById\("swTrackers"\).{0,200}/) || [''])[0]);

  // ---- the three hit-dice styles
  // Each is a separate builder, so a broken one is a broken LOOK, not an error.
  ck('all three hit-dice styles have a builder',
     /function hdFullHTML\(/.test(js) && /function hdCondensedHTML\(/.test(js) && /function hdDiceHTML\(/.test(js));
  ck('renderHitDice picks between all three', (() => {
     const r = (js.match(/function renderHitDice\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return /hdFullHTML/.test(r) && /hdDiceHTML/.test(r) && /hdCondensedHTML/.test(r);
  })());
  // an unknown or absent value must land on full — the same value blankChar
  // defaults to, which is what saves the setting from needing a migration and
  // stops an old sheet showing something a new character would not
  ck('an unrecognised style falls back to full',
     /function hdStyle\(\)\{[\s\S]{0,160}?:"full"/.test(js),
     (js.match(/function hdStyle\(\)\{[\s\S]{0,160}/) || [''])[0]);
  ck('...and blankChar defaults to the same thing', /hdStyle:"full"/.test(js));
  ck('the style picker is per character, in the settings modal',
     /id="segHdStyle"/.test(js) && /character\.hdStyle=b\.dataset\.hdstyle/.test(js));
  ck('all three styles are offered by name', (() => {
     const seg = (js.match(/id="segHdStyle"[\s\S]{0,400}/) || [''])[0];
     return ['full', 'condensed', 'dice'].every(v => seg.includes(`"${v}"`));
  })());

  // ---- the two ability/skill layouts
  // Pure string builders, not DOM building: the harness has no DOM, so this is
  // the only way the id contract can be asserted at all (see sheet.js).
  ck('the grouped layout has its own pure builders',
     /function statGroupHTML\(/.test(js) && /function statGroupsHTML\(/.test(js));
  ck('both builders pick on the style', (() => {
     const a = (js.match(/function buildAbilities\(\)\{[\s\S]*?\n\}/) || [''])[0];
     const k = (js.match(/function buildSkills\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return /statStyle\(\)/.test(a) && /statGroupsHTML/.test(a) && /statStyle\(\)/.test(k);
  })());
  // the grouped path must EMPTY #skills and return, or #skill-perception exists
  // twice; getElementById takes the first and the hidden copy silently rots
  ck('the grouped path clears the classic skill list',
     /const el=document\.getElementById\("skills"\);el\.innerHTML="";[\s\S]{0,420}?if\(statStyle\(\)==="grouped"\)return;/.test(js));
  ck('an unrecognised layout falls back to classic',
     /function statStyle\(\)\{[\s\S]{0,160}?:"classic"/.test(js));
  ck('...and blankChar defaults to the same thing', /statStyle:"classic"/.test(js));
  ck('the layout picker is per character, in the settings modal',
     /id="segStatStyle"/.test(js) && /character\.statStyle=b\.dataset\.statstyle/.test(js));
  ck('both layouts are offered by name', (() => {
     const seg = (js.match(/id="segStatStyle"[\s\S]{0,400}/) || [''])[0];
     return ['classic', 'grouped'].every(v => seg.includes(`"${v}"`));
  })());
  // the layout is per CHARACTER, so LOADING one has to rebuild it. Building only
  // at boot left a grouped sheet drawing classic after a character swap.
  ck('renderAll rebuilds the layout', (() => {
     const r = (js.match(/function renderAll\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return /buildStats\(\);/.test(r);
  })());
  // ...and FIRST: the rebuild blanks the six score inputs, and the [data-path]
  // loop below it is what refills them
  ck('...before the data-path loop refills the score boxes', (() => {
     const r = (js.match(/function renderAll\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return r.indexOf('buildStats()') >= 0 &&
            r.indexOf('buildStats()') < r.indexOf('querySelectorAll("[data-path]")');
  })());
  // the Skills card is HIDDEN, never removed: the note registry, the 19-card
  // template guard and the label guard all need it to stay in the document
  ck('the Skills card is hidden by id, and the id sits after data-note',
     /getElementById\("skillsCard"\)/.test(js) &&
     loadHTML().includes('<div class="card" data-note="skills" id="skillsCard"'));
  // one legend, moved between the cards — a second copy in JS would drift from
  // the template's
  ck('the legend is moved, not duplicated',
     /function placeLegend\(/.test(js) && !/class="legend"/.test(js));
  // expertise is marked straight off the dot's data-lvl, which recompute already
  // writes — that is what keeps this a display change with no rules code touched
  ck('expertise is marked from the dot, not from JS',
     /\.agroup \.dot\[data-lvl="2"\]~\.exp\{display:/.test(sheetCss));
  ck('the grouped rows reuse .srow rather than restating it',
     /\.agroup \.srow\{/.test(sheetCss) && /\.srow\{display:flex/.test(sheetCss));
  // the dice style's token is the control: unspent rolls, spent goes back
  ck('the dice tokens are wired', /closest\("\[data-hddie\]"\)/.test(js));
  ck('...and tapping an unspent die rolls it',
     /data-hddie[\s\S]{0,400}rollHitDie\(die\)/.test(js));
  ck('the full and condensed styles keep the pips and the Roll button',
     /function hdPips\(/.test(js) &&
     ['hdFullHTML', 'hdCondensedHTML'].every(f =>
       new RegExp('function ' + f + '\\([\\s\\S]*?data-hdroll').test(js)));

  // ---------- Familiars live in the LEFT sidebar
  // You reach for a familiar mid-fight, and it used to be the last card on the
  // sheet. The card and the button are a mutually-exclusive pair that
  // renderFamiliars() looks up UNGUARDED — a missing id throws and takes out
  // every listener registered after it.
  const left = block(t, 'class="stack"');                       // the first stack is the left one
  const right = block(t.slice(t.indexOf('class="stack"') + 8), 'class="stack"');
  ck('the left stack is the portrait column', left.includes('id="portrait"') && !left.includes('id="hpCur"'));
  ck('the right stack is the main column', right.includes('id="hpCur"') && !right.includes('id="portrait"'));
  ck('familiars moved into the left sidebar',
     left.includes('data-note="familiars"') && left.includes('id="addFamiliarLink"'));
  ck('...and nothing is left behind in the right column',
     !right.includes('data-note="familiars"') && !right.includes('id="addFamiliarLink"'));
  ck('the card and its add button stay adjacent — they are one control',
     /id="familiarList"><\/div>\s*<\/div>\s*<button class="mini" id="addFamiliarLink"/.test(t));
  ck('both familiar ids exist exactly once (both are looked up unguarded)',
     ['familiarCard', 'addFamiliarLink', 'familiarList'].every(id =>
       (t.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1));
  ck('the familiars card keeps the attribute order the card count needs',
     /<div class="card" data-note="familiars" id="familiarCard"/.test(t));
  ck('it sits below Class, so the identity cards stay together',
     left.indexOf('data-note="familiars"') > left.indexOf('data-note="class"'));

  // On a phone the columns collapse and the sidebar renders FIRST, which would
  // put familiars above HP and Skills. order alone cannot fix that — order only
  // reorders siblings — so the stacks are flattened inside the media query and
  // the pair is sunk. Both halves must be inside the query: display:contents at
  // top level would destroy the two-column desktop layout outright.
  const mq = (chromeCss.match(/@media\(max-width:820px\)\{[\s\S]*?\n\}/) || [''])[0];
  ck('the phone layout flattens the stacks', /\.stack\{display:contents\}/.test(mq), mq);
  ck('...and sinks familiars below the main stack',
     /#familiarCard,#addFamiliarLink\{order:1\}/.test(mq), mq);
  ck('neither rule escapes the media query (they would break the desktop layout)',
     !/^\.stack\{display:contents\}/m.test(chromeCss) &&
     (chromeCss.match(/display:contents/g) || []).length === 1);
  /* Existing is not the same as WINNING. `.stack{display:grid}` and the query's
     `.stack{display:contents}` have identical specificity, so whichever comes
     last applies — and with the query written above the base rule the phone
     layout silently did nothing at all. Only a browser shows that; here, assert
     the order that makes it work. */
  ck('the media query comes after the .stack rule it overrides',
     chromeCss.indexOf('@media(max-width:820px)') > chromeCss.indexOf('.stack{display:grid'),
     {query: chromeCss.indexOf('@media(max-width:820px)'), base: chromeCss.indexOf('.stack{display:grid')});
  ck('the desktop layout is still two columns',
     /\.cols\{display:grid;[^}]*grid-template-columns:minmax\(0,320px\) minmax\(0,1fr\)/.test(chromeCss));

  // 320px leaves ~266px inside an .item, and .item .top has no wrap: the pill,
  // two icons and the gaps eat ~200px before the name is drawn.
  ck('the familiar row may wrap in the narrow column',
     /#familiarList \.item \.top\{flex-wrap:wrap\}/.test(sheetCss));
  ck('...and the fix is scoped, so Statuses in the wide column is untouched',
     !/^\.item \.top\{[^}]*flex-wrap/m.test(sheetCss));
  ck('the summoned pill does not break inside its own border',
     /#familiarList \.fam-state\{white-space:nowrap\}/.test(sheetCss));

  // buildToc listed every card label with no visibility filter, so a hidden
  // card gave a menu entry that scrolled to a zero-height box. jumpToNote has
  // always made this check; the two now agree.
  ck('the section menu skips cards that are not showing',
     /function buildToc\(\)\{[\s\S]*?offsetParent===null\)return;/.test(js));

  // ---------- "choose N" pickers actually enforce N
  // choiceFieldHTML is pure and covered properly in sheet.js. What lives here is
  // the DOM wiring the harness cannot reach: it fails SILENTLY — the boxes just
  // never lock and Done never asks.
  ck('the modal locks a full choice block on change',
     /modal\.addEventListener\("change"[\s\S]{0,200}syncChoiceLimits\(div\)/.test(js));
  ck('the lock keys on data-fixed, so a granted option is never handed back',
     /function syncChoiceLimits\([\s\S]*?:not\(\[data-fixed\]\)/.test(js));
  ck('...and only unchecked options are disabled, so your own picks stay undoable',
     /function syncChoiceLimits\([\s\S]*?disabled=\(picked>=target&&!cb\.checked\)/.test(js));
  // both Done buttons, not just the class one: the race/background modal never
  // populates _activeChoices, so data-choose on the wrapper is its only target
  ck('the class chooser warns before committing too few',
     /chDone[\s\S]{0,240}choiceShortfall\(choiceBlocks\(\)\)[\s\S]{0,120}confirm\(warn\)\)return;/.test(js));
  ck('the race/background chooser warns as well',
     /xchDone[\s\S]{0,260}choiceShortfall\(choiceBlocks\(\)\)[\s\S]{0,120}confirm\(warn\)\)return;/.test(js));
  ck('choiceBlocks reads the target from the DOM, not from _activeChoices',
     /function choiceBlocks\(\)\{[\s\S]*?\.choice\[data-choose\]/.test(js));

  // Escape/×/backdrop used to discard every pick silently, with no way to reopen
  // a chooser — which would make dismissing the easiest way past the new warning.
  ck('the three dismissals go through dismissModal, not closeModal',
     /getElementById\("mClose"\)\.addEventListener\("click",dismissModal\)/.test(js) &&
     /if\(e\.target===modal\)dismissModal\(\)/.test(js) &&
     /Escape"&&modal\.classList\.contains\("open"\)\)dismissModal\(\)/.test(js));
  ck('...and dismissModal asks the guard before closing',
     /function dismissModal\(\)\{[\s\S]{0,160}_dismissGuard\(\)[\s\S]{0,80}confirm\(msg\)\)return;/.test(js));
  // the guard must not leak between modals: an ordinary form's Escape is cancel
  ck('opening any modal clears the guard', /function openModal\([^)]*\)\{_dismissGuard=null;/.test(js));
  ck('closing clears it too', /function closeModal\(\)\{_dismissGuard=null;/.test(js));
  ck('both choosers arm the guard after opening',
     (js.match(/armChoiceDismissGuard\(\w*\);/g) || []).length === 2);

  // ---------- the spell "prepared" box
  // It is a <button>, so it takes UA padding (1px 6px) and inherits no font. On
  // an 18px border-box square that padding leaves a TWO pixel content area, and
  // place-items:center then centres the tick on that rather than on the box —
  // which is what put the ✓ low and right. All four of these matter.
  const spellCss = css('40-spells-coins.css');
  const pin = (spellCss.match(/\.spell \.pin\{[^}]*\}/) || [''])[0];
  ck('the prepared box kills the UA button padding', /padding:0/.test(pin), pin);
  ck('...and pins the line height, so the glyph centres not the line box',
     /line-height:1/.test(pin), pin);
  ck('...and sets a font, because a button inherits none',
     /font-family:var\(--[a-z-]+\)/.test(pin), pin);
  ck('...and drops the grey UA button face', /background:transparent/.test(pin), pin);
  // 900 has no real face in the sheet's fonts, so it was synthetically emboldened
  // — which widens to the right and re-introduced the very offset being fixed
  ck('the tick is not asking for a weight the font lacks',
     /\.spell \.pin\.on::after\{[^}]*font-weight:700/.test(spellCss),
     (spellCss.match(/\.spell \.pin\.on::after\{[^}]*\}/) || [''])[0]);
  // the same tick is drawn by .equip .box for Equipped, Concentration and the
  // spell modal's own Prepared control — fixing one and not the other drifts
  ck('the other tick control got the same treatment',
     /\.equip \.box\{[^}]*line-height:1/.test(sheetCss) &&
     /\.equip\.on \.box::after\{[^}]*line-height:1/.test(sheetCss));

  // The box had no visible meaning at all — only an aria-label, which a player
  // on a phone never sees.
  ck('each spell level header captions the column',
     /class="prep-cap"[^>]*>Prep</.test(js));
  ck('...and the caption is styled as a caption, not as heading text',
     /\.spell-h \.prep-cap\{[^}]*color:var\(--ink-soft\)/.test(spellCss));
  ck('the box reports its state to a screen reader, not just a name',
     /class="pin [^"]*"[\s\S]{0,160}aria-pressed="\$\{s\.prepared\?"true":"false"\}/.test(js));
  ck('...and says what tapping it will do', /title="\$\{s\.prepared\?"Prepared/.test(js));

  // ---------- favourites on Features & Traits
  // The grouping is covered properly in sheet.js (featGroups is pure). These are
  // the wiring bits the stub DOM cannot reach.
  ck('the feature star is wired',
     /closest\("\[data-fav-feature\]"\)/.test(js) && /f\.fav=!f\.fav;renderFeatures\(\)/.test(js));
  // a star moves a row between groups and changes nothing derived — calling
  // recompute here would be a pointless full re-render on every tap, and it is
  // deliberately absent from the inventory star too
  ck('...and does not recompute, matching the inventory star', (() => {
    const h = (js.match(/closest\("\[data-fav-feature\]"\)+\{[^}]*\}[^}]*\}/) || [''])[0];
    return !!h && !/recompute\(\)/.test(h);
  })());
  // The edit form rebuilds the record from the form fields, so anything it does
  // not ask about is dropped. All three are invisible when lost, and each fails
  // differently: no star, the row jumps to "Other", the update tool stops
  // recognising it. One guard each.
  const featSave = (js.match(/const rec=\{id:f\.id,name:document\.getElementById\("fName"\)[\s\S]{0,2000}?character\.features\[i\]=rec/) || [''])[0];
  ck('editing a feature keeps its favourite star', /if\(f\.fav\)rec\.fav=f\.fav;/.test(featSave), featSave.slice(-300));
  ck('...keeps its origin, so it stays in its class group', /if\(f\.origin\)rec\.origin=f\.origin;/.test(featSave));
  ck('...and keeps the src stamp the update tool reads', /if\(f\.src\)rec\.src=f\.src;/.test(featSave));
  // fav must stay OUT of the rules-owned list, or an update would clobber it
  ck('fav is not a rules-owned field on either kind',
     /feature:\["description","effects","uses","cost"\]/.test(js) &&
     /item:\["description","effects","cost","weight","weapon","ammo"\]/.test(js));
  // The attack form has the same shape and lost the same way: it rebuilt the
  // record from its boxes and dropped itemId, so an edited weapon attack came
  // unlinked from its inventory item and the next pack update added a duplicate
  // row beside it. The carry itself is asserted in sheet.js; this is the wiring.
  const atkSave = (js.match(/const rec=\{id:a\.id,name:document\.getElementById\("aName"\)[\s\S]{0,2000}?character\.attacks\[i\]=rec/) || [''])[0];
  ck('the attack form carries the links its boxes never show',
     /carryAttackLinks\(a,rec\);/.test(atkSave), atkSave.slice(-300));
  // …and the generated-fields fingerprint with them. Drop it and every edited
  // attack becomes "unknowable" instead of "edited" — same outcome for the
  // resync, but a save that changed nothing would never resync again.
  ck('...and the fingerprint that says whether it was ever edited',
     /if\(a\.genFp\)rec\.genFp=a\.genFp;/.test(atkSave), atkSave.slice(-300));
  // The two places that WRITE an attack from an item must (re-)baseline it, or
  // the row looks hand-edited and the update tool stops resyncing it forever.
  ck('a generated attack is stamped where it is generated',
     /stampAtkGen\(atk\);\s*character\.attacks\.push\(atk\);/.test(js));
  ck('...and re-stamped when editing the item rewrites it in place',
     /stampAtkGen\(existing\);/.test(js));
  // A spell's attack row is rebuilt from the spell, so extra damage types have to
  // be asked for on the SPELL — offered by the same shared control the attack
  // form uses, and read back into the record it saves.
  ck('the spell form offers the additional damage types list',
     /xDmgFieldHTML\("sXDmg",s,/.test(js) && /wireXDmgField\("sXDmg"\)/.test(js));
  ck('...and both forms build that list from one function',
     /xDmgFieldHTML\("aXDmg",a,/.test(js) && /wireXDmgField\("aXDmg"\)/.test(js));
  const spellSave = (js.match(/const rec=\{id:s\.id,name:document\.getElementById\("sName"\)[\s\S]{0,2000}?character\.spells\[i\]=rec/) || [''])[0];
  ck('a saved spell keeps the extras that were typed into it',
     /readXDmg\("sXDmg"\);if\(sxd\.length\)rec\.extraDamage=sxd;/.test(spellSave), spellSave.slice(-300));
  // spell is the third kind in UPD_FIELDS and its form lost the stamp the same
  // way the feature and item forms did. Conditional, so a hand-typed spell still
  // carries no src at all rather than an undefined one.
  ck('editing a spell keeps the src stamp the update tool reads',
     /if\(s\.src\)rec\.src=s\.src;/.test(spellSave), spellSave.slice(-300));

  // ---------- the Concentrating condition, on the side the stub DOM cannot click
  // The reconcile itself is asserted in sheet.js. These are the three handlers
  // that make the link work in the OTHER direction — clear the condition and the
  // spell must end — plus the load-time reconcile, without which a sheet saved
  // mid-concentration shows a condition for a spell that is not running.
  const delStatus = (js.match(/data-del-status[\s\S]{0,600}?return;\}/) || [''])[0];
  ck('removing a concentration condition ends the spell',
     /if\(s\.concId\)endConcentration\(\);/.test(delStatus), delStatus.slice(0, 300));
  ck('...and the prompt says the spell ends', /ends too\./.test(delStatus));
  const togStatus = (js.match(/data-toggle-status[\s\S]{0,600}?return;\}/) || [''])[0];
  ck('clearing it on the sheet ends the spell too, after asking',
     /if\(s\.concId&&s\.active!==false\)\{if\(!endConcFromStatus\(\)\)return;\}/.test(togStatus), togStatus.slice(0, 300));
  const stSave = (js.match(/const rec=\{id:s\.id,name:document\.getElementById\("stName"\)[\s\S]{0,2400}?scheduleSave\(\);/) || [''])[0];
  ck('the status form keeps the link to the spell', /if\(s\.concId\)rec\.concId=s\.concId;/.test(stSave), stSave.slice(-300));
  ck('...and unticking Active there ends the spell as well',
     /if\(rec\.concId&&!active\)endConcentration\(\);/.test(stSave));
  ck('a spell deleted outright takes its condition with it',
     /activeSpells\|\|\[\]\)\.filter\(a=>a\.spellId!==s\.id\);syncConcStatus\(\);/.test(js));
  ck('the mirror is reconciled on load, before anything draws',
     /syncConcStatus\(\);\s*renderPortrait\(\)/.test(js));

  // ---------- the browse footer, and the per-level count
  // The Add button was laid out PAST the right edge of the screen with no way to
  // reach it: .browse is position:fixed with no scroll container, so the overflow
  // left the viewport. The origin select had flex:0 0 auto, whose basis resolves
  // from `width` — which the global input,select,textarea rule sets to 100%.
  ck('the browse footer wraps rather than pushing controls off the edge',
     /\.browse-foot\{[^}]*flex-wrap:wrap/.test(cardsCss),
     (cardsCss.match(/\.browse-foot\{[^}]*\}/) || [''])[0]);
  // The select is now wrapped in a labelled .br-f cell, so width:auto has to land
  // on the SELECT itself — the wrapper is a flex item and would size fine either
  // way. This is still the same fix for the same global width:100%.
  ck('the origin select overrides the global width:100%',
     /\.br-origin select\{[^}]*width:auto/.test(cardsCss),
     (cardsCss.match(/\.br-origin select\{[^}]*\}/) || [''])[0]);
  ck('...and can shrink, which flex-shrink:0 prevented',
     /\.br-origin\{[^}]*flex:1 1 /.test(cardsCss));
  ck('the global rule this fights is still there (the fix depends on it)',
     /input,select,textarea\{width:100%/.test(cardsCss));
  // the class moved to the wrapper when the controls gained labels; what matters
  // is unchanged — the flex behaviour is in the stylesheet, not inline on the tag
  ck('the footer controls carry classes, not the inline flex that caused it',
     !/id="brOrigin"[^>]*style="flex:/.test(js) && /class="br-f br-origin"/.test(js));
  // the inline style block these carried set a 10px radius and a 1px border,
  // fighting the global 6px/1.5px and making the footer a different shape from
  // every other field in the app
  ck('...and no longer restate the global input styling inline',
     !/id="brOrigin"[^>]*style="/.test(js) && !/id="brOrigDet"[^>]*style="/.test(js) &&
     !/id="brCost"[^>]*style="/.test(js));
  // a detail typed with the kind left at "— none —" was silently dropped on Add,
  // because the origin object is only built when there IS a kind
  ck('the detail box starts disabled and follows the chosen kind',
     /id="brOrigDet"[^>]*disabled/.test(js) &&
     /function syncOrigDet\(\)\{[\s\S]{0,320}?od\.disabled=!os\.value/.test(js));
  ck('every footer control is labelled',
     /for="brOrigin"/.test(js) && /for="brOrigDet"/.test(js) && /for="brCost"/.test(js));
  ck('the Add button can share a row or drop to its own',
     /\.browse-foot \.tbtn\{flex:1 1 /.test(cardsCss));

  // The count must track what you tick. The row handler deliberately updates the
  // DOM in place and calls foot() rather than re-rendering 400+ rows, so foot()
  // is what has to repaint the headings.
  ck('group headings carry a key the badge painter can find',
     /class="brgroup"\$\{cfg\.groupBadge\?` data-brg=/.test(js));
  ck('the badges repaint from foot(), which is what makes the count live',
     /function foot\(\)\{[\s\S]{0,400}?paintGroupBadges\(\);\}/.test(js));
  // still true, just no longer the only statement in the branch — the same
  // handler now also enables/disables the detail box
  ck('changing the origin repaints too — it decides whether picks count',
     /brOrigin"\)\{syncOrigDet\(\);paintGroupBadges\(\);\}/.test(js));
  ck('the badge shares the Spells tab pill rather than inventing a second look',
     /\.spell-count,\.brgcount\{/.test(css('40-spells-coins.css')));
  ck('the group heading is flex, so the pill can sit right',
     /\.brgroup\{[^}]*display:flex/.test(cardsCss));
  // one tally, so the browser cannot promise a number the sheet disagrees with.
  // Sliced to renderSpells' own body: an unbounded [\s\S]*? runs straight past
  // it and finds browseSpells' call instead, which makes the guard vacuous.
  const renderSpellsBody = (js.match(/function renderSpells\(\)\{[\s\S]*?\n\}/) || [''])[0];
  ck('the Spells tab reads its counts from the shared tally',
     /spellLevelTally\(lv\)/.test(renderSpellsBody) &&
     !/items\.filter\(s=>!s\.granted\)/.test(renderSpellsBody), renderSpellsBody.slice(0, 400));
  ck('...and the browser reads the same one',
     /groupBadge:\(key,chosen\)=>\{[\s\S]{0,200}spellLevelTally\(lv\)/.test(js));

  // ---------- Gadgeteer prose keeps the shape the PDF carries
  // The frame and component lists were one 3,000-character paragraph because
  // pt_all_subs appended head/trait/label spans as flat text. The extractor now
  // keeps them; these assert the DATA, so they fail if a re-extraction ever
  // drops it again — the reason the fix went in the extractor and not by hand.
  {
    const hw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/humblewood/classes.json'), 'utf8'));
    const gad = (hw.classes || []).find(c => c.name === 'Gadgeteer');
    const tr = n => ((((gad || {}).levels || {})['1'] || {}).traits || []).find(t => t.name === n);
    const frames = tr('Frames'), comps = tr('Components');
    ck('the Gadgeteer still has its Frames and Components traits', !!frames && !!comps);
    ['Frames', 'Components'].forEach(n => {
      const t = tr(n);
      ck(n + ' is broken into lines', (t.description.match(/\n/g) || []).length > 5,
         (t.description.match(/\n/g) || []).length);
      ck('...and its type names are bold', /\*\*[^*]+\*\*/.test(t.description));
    });
    // the whole point: layout only. Strip the markup and the words must be there.
    const bare = s => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    [['Frames', 'You can build gadgets using the following frames. Autonomous Frame This convenient gadget can act semi-independently. Scrap Cost: 3'],
     ['Frames', 'Handheld Frame This versatile gadget requires two hands to wield.']].forEach(([n, phrase]) => {
      ck('the wording of ' + n + ' is unchanged: "' + phrase.slice(0, 34) + '…"',
         bare(tr(n).description).indexOf(phrase) > -1);
    });
    ck('a frame name starts its own line',
       /\n\*\*Autonomous Frame\*\*\n/.test(frames.description));
    ck('a run-in heading keeps its prose beside it',
       /\n\*\*Remote Control\.\*\* Your gadget moves/.test(frames.description));
  }
  // ---------- Gadgeteer paths: nothing bleeds across a feature (#59)
  // Page 10 of the packet is two layouts stacked, and page 11 starts a path
  // mid-column; read as plain columns, the tail of Magic Item Hacking became the
  // Engineer's Crafty Components, its two components went to Masterpiece, and
  // Make More With Less swallowed the Fizzar introduction. Art captions cut in
  // half by the column clip ended three more features.
  {
    const hw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/humblewood/classes.json'), 'utf8'));
    const all = [];
    (hw.classes || []).concat(hw.subclasses || []).forEach(o => Object.entries(o.levels || {}).forEach(([L, lv]) =>
      (lv.traits || []).forEach(t => all.push({owner: o.name, L, name: t.name, d: t.description || ''}))));
    const t = (owner, n) => (all.find(x => x.owner === owner && x.name === n) || {}).d || '';
    ck('Magic Item Hacking keeps its whole text', /end your Magic Item hacking on it/.test(t('Gadgeteer', 'Magic Item Hacking')));
    ck("the Engineer's Crafty Components are its two components",
       /\*\*Quick Shield\*\*/.test(t('Engineer', 'Crafty Components')) && /\*\*Multitool\*\*/.test(t('Engineer', 'Crafty Components')));
    ck('...and not Magic Item Hacking', !/attune/.test(t('Engineer', 'Crafty Components')));
    ck('Masterpiece ends at Masterpiece', !/Quick Shield|Multitool/.test(t('Gadgeteer', 'Masterpiece')));
    ck('no feature carries a path heading',
       all.every(x => !/\*\*(ENGINEER|FIZZAR)\*\*/.test(x.d)), all.filter(x => /\*\*(ENGINEER|FIZZAR)\*\*/.test(x.d)).map(x => x.name));
    ck('no feature ends in an art caption',
       all.every(x => !/(A Fiz|Enhan|Gauntlets|Concept Art|Grabber)"?$/.test(x.d.trim())),
       all.filter(x => /(A Fiz|Enhan|Gauntlets|Concept Art|Grabber)$/.test(x.d.trim())).map(x => x.name));
    ck('the Gadgeteer description is whole', /studying the world around them for inspiration\.$/.test(
       ((hw.classes || []).find(c => c.name === 'Gadgeteer') || {}).description || ''));
    ck('each path has its own introduction',
       (hw.subclasses || []).every(s => (s.description || '').length > 150), (hw.subclasses || []).map(s => s.name + ':' + (s.description || '').length));
  }
  // ---------- every shipped class starts with its skills (#67)
  // A class's first-level skills are its fixed `skills` or a level-1 `skill`
  // choice — the one addClass() offers a first class. The converter dropped the
  // 2024 Bard's "any 3", so it shipped with neither and a first-class Bard was
  // offered no skills. Every class in every pack, each name one the sheet knows.
  {
    const dirs = fs.readdirSync(path.join(ROOT, 'data'))
      .filter(d => fs.existsSync(path.join(ROOT, 'data', d, 'classes.json')));
    ck('class packs found', dirs.includes('5e2024') && dirs.includes('humblewood'), dirs);
    dirs.forEach(dir => {
      const cls = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', dir, 'classes.json'), 'utf8')).classes || [];
      const l1 = c => ((((c.levels || {})['1'] || {}).choices) || []).filter(x => x.type === 'skill');
      const bare = cls.filter(c => !(c.skills || []).length && !l1(c).length);
      ck(dir + ': every class starts with skills, fixed or chosen', bare.length === 0, bare.map(c => c.name));
      const unknown = [];
      cls.forEach(c => (c.skills || []).concat(...l1(c).map(x => x.from || []))
        .forEach(n => { if (!X.skillKey(n)) unknown.push(c.name + ': ' + n); }));
      ck(dir + ': ...and every one is a skill the sheet knows', unknown.length === 0, unknown);
    });
  }
  // A lineage packet must not claim the species description — Feb 2025's Webpaw
  // section was overwriting the mustel intro, which made the extractor
  // non-idempotent and would have churned this file on every run.
  {
    const py = fs.readFileSync(path.join(ROOT, 'scripts/extract-humblewood.py'), 'utf8');
    ck('the Webpaw packet does not claim the species description',
       /title="Mustel, Webpaw"[\s\S]{0,220}no_description=True/.test(py));
    ck('...and the extractor honours that flag',
       /if not spec\.get\("no_description"\):\s*\n\s*take\(cur, "description"/.test(py));
    ck('the extractor keeps head/trait/label spans distinct',
       /if style == "head":[\s\S]{0,220}\\n\\n\*\*%s\*\*/.test(py) &&
       /elif style in \("trait", "label"\):[\s\S]{0,120}\\n\*\*%s\*\*/.test(py));
    // A tagline is POSITIONAL, never stylistic. `prereq` only means italic, and
    // the book also italicises inline spell names — keying on the style alone
    // produced "you had cast the\nidentify spell" and split "divert power*"
    // across two lines. Both parsers must test position.
    ck('a class tagline is only an italic run directly under a type name',
       /elif style == "prereq" and prev == "head":/.test(py));
    ck('an entity tagline is only the FIRST italic run, before any prose',
       /if \(style == "prereq" and tagline and not desc and not cur_name\):/.test(py));
    ck('...and prose turns the tagline flag off', /tagline = False\s*# prose has started/.test(py));
  }
  // The data itself: taglines broken out, and NOTHING broken mid-sentence.
  {
    const hwFile = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/humblewood/' + f), 'utf8'));
    const allDescs = doc => {
      const out = [];
      (function rec(o, trail) {
        if (Array.isArray(o)) return o.forEach(x => rec(x, trail));
        if (!o || typeof o !== 'object') return;
        const t = o.name ? trail.concat(o.name) : trail;
        if (typeof o.description === 'string') out.push([t.join(' > '), o.description]);
        Object.keys(o).forEach(k => { if (k !== 'description') rec(o[k], t); });
      })(doc, []);
      return out;
    };
    const sc = hwFile('subclasses.json'), ft = hwFile('feats.json');
    const road = allDescs(sc).find(([n]) => /College of the Road/.test(n));
    ck('a subclass tagline sits on its own line',
       !!road && /^Learn from People You Meet on Your Travels\n/.test(road[1]), road && road[1].slice(0, 60));
    const feat = allDescs(ft).find(([n]) => /Bandit Cunning/.test(n));
    ck('a feat type line does too',
       !!feat && /^Origin Feat\n/.test(feat[1]), feat && feat[1].slice(0, 40));
    // the regression this exists to prevent, asserted across every Humblewood file
    const walls = [];
    ['classes.json', 'races.json', 'feats.json', 'backgrounds.json', 'subclasses.json'].forEach(f => {
      allDescs(hwFile(f)).forEach(([n, d]) => {
        if (/[a-z,]\s*\n[a-z]/.test(d)) walls.push(f + ' :: ' + n);
      });
    });
    ck('no description is broken mid-sentence', walls.length === 0, walls.slice(0, 4));
  }
  /* One grammar for every field. descHTML is kept as the name the description
     call sites use, but it delegates — a field cannot quietly support less
     formatting than the field beside it. */
  ck('descHTML delegates rather than carrying its own grammar',
     /function descHTML\(text\)\{ return richHTML\(text\); \}/.test(js));
  ck('richHTML unwraps a lone paragraph, so .desc spacing is unchanged',
     /function richHTML\(text\)\{[\s\S]{0,200}\^<p>/.test(js));
  ck('emphasis cannot OPEN on an asterisk followed by a space',
     /\\\*\(\[\^\\s\*\]/.test(js));
  ck('noteInline still holds highlight\'s own chips aside before markup runs',
     /function noteInline\(raw\)\{[\s\S]{0,300}<\[\^>\]\+>\/g/.test(js));

  /* Run-in headings ("<b>Trait.</b> text…") sit INSIDE a <p>. A block element
     there nests illegally and the parser closes the paragraph early, so the
     species, background and class panes take the inline-only renderer. */
  ck('the block surfaces use richHTML',
     /class="desc">\$\{richHTML\(it\.description\)\}/.test(js) &&
     /class="desc">\$\{richHTML\(f\.description\)\}/.test(js) &&
     /class="rt-view">\$\{richHTML\(val\)\}/.test(js));
  ck('the run-in panes use richInline, never a block renderer',
     (js.match(/\$\{richInline\(t\.description\|\|""\)\}<\/p>/g) || []).length === 3 &&
     /\$\{richInline\(d\.feature\.description\|\|""\)\}<\/p>/.test(js));
  ck('no run-in pane is left calling a block renderer',
     !/<b>\$\{esc\(t\.name\)\}\.<\/b> \$\{(richHTML|descHTML|noteHTML)\(/.test(js));
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

/* ================= the Rules tab sections start collapsed ====================
   Both lists are long and Reference Tables sits under the glossary, so reaching
   the tables meant scrolling past 132 entries. Stored as a COLLAPSE map in
   settings — like the Settings sections — so an absent key means "never
   touched" and the default can be closed without freezing a later choice. */
{
  const S = X.settings;
  S.rulesCollapse = {};
  ck('both sections start collapsed', !X.rulesSecOpen('gloss') && !X.rulesSecOpen('tables'));
  ck('every declared section defaults closed', X.RULES_SECS.every(d => d.open === false), X.RULES_SECS);

  X.setRulesSecOpen('gloss', true);
  ck('opening one is remembered', X.rulesSecOpen('gloss') === true);
  ck('...and does not open the other', X.rulesSecOpen('tables') === false);
  ck('...stored as a COLLAPSE flag, so the key means "touched"',
     S.rulesCollapse.gloss === false, JSON.stringify(S.rulesCollapse));

  X.setRulesSecOpen('gloss', false);
  ck('shutting it again is remembered too',
     X.rulesSecOpen('gloss') === false && S.rulesCollapse.gloss === true);

  /* the reason for the collapse-map shape: a player who has opened a section
     must not have it slammed shut by a later change of default */
  S.rulesCollapse = {gloss: false};
  ck('an explicit choice survives, whatever the default says', X.rulesSecOpen('gloss') === true);
  ck('...while an untouched section still follows the default', X.rulesSecOpen('tables') === false);

  // junk in settings must not throw or wedge the tab shut
  S.rulesCollapse = null;
  ck('a missing map falls back to the defaults', X.rulesSecOpen('gloss') === false);
  S.rulesCollapse = ['not', 'a', 'map'];
  ck('an array is ignored rather than trusted', X.rulesSecOpen('tables') === false);
  S.rulesCollapse = {};
}

// ---------- the combat view is a TAB: its icon in the tab bar, its panel in the page
// It was a full-screen overlay; in play that covered the tabs a player wanted to
// glance at, so it became a tab with the same header, cards and arranging.
{
  const t = loadHTML();
  const tools = t.indexOf('<div class="tab-tools">'), combat = t.indexOf('id="btnCombat"'),
        toc = t.indexOf('id="btnToc"'), page = t.indexOf('<div class="page">'),
        panel = t.indexOf('id="tab-combat"'), view = t.indexOf('id="combatView"');
  ck('the combat button sits in the pinned tab-bar group, before ☰',
     tools >= 0 && tools < combat && combat < toc);
  ck('the combat view is a tab panel inside the page', page >= 0 && page < panel && panel < view,
     {page, panel, view});
  ck('...and no longer a modal dialog over it',
     !/id="combatView"[^>]*(aria-modal|role="dialog")/.test(t) && !/class="cview[^"]*"[^>]*aria-modal/.test(t));
  ck('the view has its header, its body, its empty hint and its list',
     ['id="cvHead"', 'id="cvBody"', 'id="cvEmpty"', 'id="cvList"'].every(s => t.includes(s)));
  const panelEnd = t.indexOf('</section>', panel);
  ck('the view ships holding no cards — they are moved in at runtime',
     !/class="card"/.test(t.slice(panel, panelEnd)));
  // #cvHead is repainted whole, and a replaced live region is never announced.
  const live = t.indexOf('id="cvLive"'), head = t.indexOf('id="cvHead"');
  ck('the round\'s live region is in the view but outside its repainted header',
     live > view && live < panelEnd && !/id="cvLive"/.test(t.slice(head, t.indexOf('</div>', head))) &&
     /<p [^>]*id="cvLive" aria-live="polite"/.test(t));

  const cjs = fs.readFileSync(path.join(ROOT, 'src/js/87-combat.js'), 'utf8');
  const sheetJs = fs.readFileSync(path.join(ROOT, 'src/js/40-sheet.js'), 'utf8');
  const bootJs = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  const combatCss = fs.readFileSync(path.join(ROOT, 'src/css/45-combat.css'), 'utf8');
  ck('selecting the combat tab fills the view', /function selectTab\(name\)\{[\s\S]*?if\(name==="combat"\)openCombatView\(\)/.test(sheetJs));
  ck('...and any other tab sends the cards home first',
     /function selectTab\(name\)\{[\s\S]*?if\(name!=="combat"\)closeCombatView\(\)/.test(sheetJs));
  ck('the swords button opens the tab, and leaves it from inside',
     /closest\("#btnCombat"\)\)return combatViewOpen\(\)\?leaveCombatTab\(\):enterCombatTab\(\)/.test(bootJs) &&
     /function enterCombatTab\(\)\{[\s\S]*?selectTab\("combat"\)/.test(cjs));
  ck('✕ leaves the tab too, back where it came from', /closest\("#cvClose"\)\)return leaveCombatTab\(\)/.test(bootJs));
  // the overlay's machinery: a tab must leave the tab bar and the page usable
  ck('nothing makes the tab bar or page inert for the combat view',
     !/cvInert/.test(cjs + bootJs + fs.readFileSync(path.join(ROOT, 'src/js/80-modal-forms.js'), 'utf8')));
  ck('no scroll lock and no fixed full-screen layer',
     !/cv-lock/.test(cjs + combatCss) && !/\.cview\{[^}]*position:fixed/.test(combatCss));
  ck('no Esc that closes a tab', !/Escape"\|\|!combatViewOpen\(\)/.test(bootJs));
  ck('the header sticks under the tab bar', /\.cv-head\{[^}]*position:sticky/.test(combatCss));
  ck('the swords button shows when its tab is the one open',
     /btnCombat[\s\S]{0,120}classList\.toggle\("active",name==="combat"\)/.test(sheetJs) && /\.tab-combat\.active/.test(combatCss));
}

// ---------- the general modal can take focus, and is named by its title
{
  const t = loadHTML();
  const m = /<div class="modal"[^>]*>/.exec(t);
  ck('the modal dialog is focusable (tabindex -1) so openModal can move focus into it',
     !!m && /\btabindex="-1"/.test(m[0]) && /role="dialog"/.test(m[0]));
  ck('the modal dialog is named by its title', !!m && /aria-labelledby="mTitle"/.test(m[0]) && t.includes('id="mTitle"'));
  // A live region created and filled in the same moment is not announced; this one exists from load.
  ck('the toast live region ships in the page, empty', /<div id="toast" class="toast" role="status"><\/div>/.test(t));
}

// ---------- a finder redraw keeps what the player set in its footer
// Filters, a facet chip and Clear all re-render the whole finder, footer included.
// Origin, its detail, Qty and Cost must come through that — but only within one
// session: `st` is per openBrowse(), so a reopened finder still starts clean.
{
  const js = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8')).js
    .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  ck('a redraw reads the footer before rebuilding it, but only after the first draw',
     /function render\(\)\{const keep=st\.drawn\?readFoot\(\):null;/.test(js));
  ck('...and puts it back straight after', /host\.innerHTML=[\s\S]{0,4000}?if\(keep\)writeFoot\(keep\);st\.drawn=true;renderList\(\);\}/.test(js));
  ck('the footer it carries is Origin, its detail, Qty and Cost',
     ['brOrigin', 'brOrigDet', 'brQty', 'brCost'].every(id => new RegExp('function readFoot\\(\\)[^\\n]*"' + id + '"').test(js)));
  ck('restoring Origin re-syncs the detail box before its text goes back',
     /function writeFoot\(k\)\{[^\n]*put\("brOrigin",k\.origin\);syncOrigDet\(\);if\(k\.origin\)put\("brOrigDet",k\.det\);/.test(js));
}

// ---------- Classic skills read DOWN each column, then across (issue #56)
// A two-column grid fills row by row, so the alphabet ran left-right-left-right.
// Column flow with half the skills (rounded up) per column reads Acrobatics …
// Investigation down the left and Medicine … Survival down the right.
{
  const css = fs.readFileSync(path.join(ROOT, 'src/css/30-sheet.css'), 'utf8');
  const cjs = fs.readFileSync(path.join(ROOT, 'src/js/00-constants.js'), 'utf8');
  ck('the Classic skills grid fills down each column',
     /\.skills\{[^}]*grid-auto-flow:column/.test(css) && /\.skills\{[^}]*grid-template-rows:repeat\(var\(--skill-rows,9\),auto\)/.test(css));
  ck('...with half the skills, rounded up, per column',
     /function buildSkills\(\)\{[\s\S]*?--skill-rows",Math\.ceil\(SKILLS\.length\/2\)[\s\S]*?\n\}/.test(cjs));
  ck('a phone keeps one column, in the same order',
     /@media\(max-width:600px\)\{\.skills\{[^}]*grid-template-columns:1fr;[^}]*grid-auto-flow:row/.test(css));
}

// ---------- one section heading for Inventory, Attacks and Features (issue #51)
// Inventory sections (and the Attacks card's split) had a faint 1px rule with the
// first item flush against it, and a caret drawn pointing DOWN that the shared
// .fcaret rule then turned another 90° — open sections pointed left. They now
// share the Features & Traits head: same line, same gap, same caret.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const css = manifest.css.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const shared = /\.fghead,\.inv-sec-head\{([^}]*)\}/.exec(css);
  ck('inventory section heads share the Features group-head rule', !!shared);
  ck('...a solid 1.5px line, with a gap before the first item',
     !!shared && /border-bottom:1\.5px solid var\(--line\)/.test(shared[1]) && /margin:0 0 8px/.test(shared[1]));
  ck('no inventory-only caret rotation is left to fight the shared one',
     !/\.inv-sec-head \.fcaret/.test(css));
  const featCaret = (/class="fghead"[^`]*?<svg class="fcaret[^>]*><path d="([^"]+)"/.exec(js) || [])[1];
  const invCaret = (/head\.className="inv-sec-head"[\s\S]{0,200}?<svg class="fcaret[^>]*><path d="([^"]+)"/.exec(js) || [])[1];
  ck('the inventory caret is drawn like the Features one', !!featCaret && invCaret === featCaret, [featCaret, invCaret]);
}

// ---------- every search / filter box has a clear button (issue #49)
// One component: a .searchbox wrapping the input and a .search-clear button,
// shown only while there is text (pure CSS, off :placeholder-shown), which empties
// the box and re-runs its filter through the same input event typing sends.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const css = manifest.css.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const html = loadHTML();
  const boxed = (src, id) => new RegExp('<div class="searchbox[^"]*"[^>]*>\\s*<input id="' + id + '"[^>]*placeholder="[^"]+"[^>]*>\\s*<button type="button" class="search-clear" aria-label="[^"]+"').test(src);
  ck('the glossary filter has its clear button', boxed(html, 'glossSearch'));
  ck('the tables filter has its clear button', boxed(html, 'tablesSearch'));
  ck('the journal search has its clear button', boxed(html, 'jnlSearch'));
  ck('the finder search (items, spells, features) has its clear button', boxed(js, 'brSearch'));
  ck('the × shows only while there is text', /\.searchbox input:placeholder-shown ?\+ ?\.search-clear\{display:none\}/.test(css));
  ck('the × empties the box and re-runs its filter the way typing does',
     /closest\("\.search-clear"\)[\s\S]{0,200}?value="";[\s\S]{0,80}?dispatchEvent\(new Event\("input",\{bubbles:true\}\)\)/.test(js));
}

// ---------- every value interpolated into an HTML attribute is esc()'d
// A character file, a rules pack and the settings file all reach the page
// through template literals assigned to innerHTML. An unescaped value inside
// an attribute can close the quote and add an event handler — script in the
// app's origin, where every character lives. Three image sources were exactly
// that. The rule is deliberately total rather than "only untrusted values",
// because which values are untrusted is not something a regex can see: a list
// item's `id` looks like app data and comes straight from an imported file.
//
// So: every ${…} that sits inside a quoted attribute value must be esc(…) of
// the whole expression, or a ternary whose two results are literals (the
// condition can be anything; only a literal ever reaches the markup). A
// CSS attribute selector — `[data-x="${k}"]`, for querySelector — is not
// markup and is skipped. An unquoted `attr=${…}` is never allowed. Every image
// source must also pass safeImgSrc(), which refuses anything but a data: URL.
//
// NOT covered, by design: a ${…} in TAG position that emits raw markup on
// purpose (`<option${sel?" selected":""}>`, `${chooseAttr}`), and text between
// tags. The behavioural tests in sheet.js render a hostile character and pack
// through every renderer for those.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  /* A small JS scanner: strings, comments, regex literals, and template
     literals nested to any depth. For every ${…} it yields the expression and
     the static text of its own template before it, with earlier ${…} replaced
     by \u0000 so their contents cannot fake or hide a quote. A regex over the
     raw source cannot do this — `class="a ${x?"b":"c"} ${y}"` defeats it —
     and a template in 87-notes.js holds a regex containing backticks. */
  function templateInterps(src) {
    const out = []; let i = 0; const n = src.length;
    const KW = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'void', 'delete',
                        'new', 'throw', 'instanceof', 'yield', 'await']);
    const quoted = q => { i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; };
    const regex = () => {
      const s = i; i++; let cls = false;
      while (i < n) {
        const c = src[i];
        if (c === '\\') { i += 2; continue; }
        if (c === '\n') { i = s + 1; return; }
        if (c === '[') cls = true; else if (c === ']') cls = false;
        else if (c === '/' && !cls) { i++; while (/[a-z]/i.test(src[i] || '')) i++; return; }
        i++;
      }
    };
    function code(untilBrace) {
      let depth = 0, prev = '', word = '';
      while (i < n) {
        const c = src[i];
        if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
        if (c === '"' || c === "'") { quoted(c); prev = 'a'; word = ''; continue; }
        if (c === '`') { template(); prev = 'a'; word = ''; continue; }
        if (/[A-Za-z_$]/.test(c)) { const s = i; while (i < n && /[\w$]/.test(src[i])) i++; word = src.slice(s, i); prev = 'a'; continue; }
        if (/[0-9]/.test(c)) { while (i < n && /[\w.]/.test(src[i])) i++; prev = 'a'; word = ''; continue; }
        if (c === '/' && (prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || KW.has(word))) { regex(); prev = 'a'; word = ''; continue; }
        if (c === '{') depth++;
        if (c === '}') { if (untilBrace && depth === 0) return; depth--; }
        if (!/\s/.test(c)) { prev = c; word = ''; }
        i++;
      }
    }
    function template() {
      i++; let text = '';
      while (i < n) {
        const c = src[i];
        if (c === '\\') { text += src[i] + src[i + 1]; i += 2; continue; }
        if (c === '`') { i++; return; }
        if (c === '$' && src[i + 1] === '{') {
          i += 2; const s = i; code(true);
          out.push({expr: src.slice(s, i).trim(), before: text, at: s});
          i++; text += '\u0000'; continue;
        }
        text += c; i++;
      }
    }
    code(false);
    return out;
  }
  /* Inside a quoted attribute value: the last `="` (or `='`) with no closing
     quote of the same kind after it. Returns null outside one. */
  function attrOf(before) {
    const m = /([^\s=]*)\s*=\s*(["'])((?:(?!\2)[^])*)$/.exec(before);
    if (!m) return null;
    /* `[data-x="…"]` and `[${name}="…"]` are selectors for querySelector */
    const selector = /\[[\w\u0000-]*$/.test(before.slice(0, m.index + m[1].length));
    return {name: m[1].replace(/^[<\u0000]+/, ''), selector};
  }
  const wholeCall = (e, fn) => {
    if (!e.startsWith(fn + '(')) return false;
    let d = 0;
    for (let j = fn.length; j < e.length; j++) {
      if (e[j] === '(') d++;
      else if (e[j] === ')') { d--; if (d === 0) return j === e.length - 1; }
    }
    return false;
  };
  /* cond ? literal : literal, where cond has no top-level ? or : of its own —
     `a ? b : c ? "x" : "y"` can yield b, so a ternary in the condition is only
     accepted inside parentheses. */
  const LIT = String.raw`(?:"[^"]*"|'[^']*'|-?\d+)`;
  const litTernary = e => {
    const m = new RegExp(String.raw`^([\s\S]+?)\?\s*` + LIT + String.raw`\s*:\s*` + LIT + '$').exec(e);
    if (!m) return false;
    let c = m[1].replace(/"[^"]*"|'[^']*'/g, '""');
    while (/\([^()]*\)/.test(c)) c = c.replace(/\([^()]*\)/g, '0');
    return !/[?:]/.test(c);
  };
  let seen = 0; const raw = [], badSrc = [], unquoted = [];
  manifest.js.forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    templateInterps(src).forEach(p => {
      const where = f.replace(/^src\/js\//, '') + ':' + src.slice(0, p.at).split('\n').length;
      if (/[\w-]=$/.test(p.before) && !/\[[\w-]*=$/.test(p.before)) unquoted.push(where + ' ' + p.expr);
      const a = attrOf(p.before);
      if (!a || a.selector) return;
      seen++;
      if (!wholeCall(p.expr, 'esc') && !litTernary(p.expr)) raw.push(where + ' ' + a.name + '=${' + p.expr + '}');
      if (/^src$/i.test(a.name) && !/^esc\(safeImgSrc\(/.test(p.expr)) badSrc.push(where + ' ' + p.expr);
    });
  });
  ck('the attribute scan is looking at something', seen > 300, seen);
  ck('every value interpolated into an HTML attribute is esc()\'d (or a literal-only ternary)',
     raw.length === 0, raw.slice(0, 40).concat(raw.length > 40 ? ['…and ' + (raw.length - 40) + ' more'] : []));
  ck('every image src passes through esc(safeImgSrc(…))', badSrc.length === 0, badSrc);
  ck('no attribute value is interpolated unquoted', unquoted.length === 0, unquoted);
  // the scanner itself, on the shapes that defeat a plain regex
  const probe = templateInterps('const s=x.replace(/`[^`]*`/g,"");const t=`<b class="a ${c?"x":"y"} ${id}" title=\'${esc(t)}\'>${y}</b>`;');
  ck('scanner: a regex holding backticks is not a template', probe.length === 4, probe.map(p => p.expr));
  ck('scanner: a value after an earlier ${…} in the same attribute is still in it',
     !!probe[1] && !!attrOf(probe[1].before) && attrOf(probe[1].before).name === 'class');
  ck('scanner: text between tags is not an attribute', !!probe[3] && attrOf(probe[3].before) === null);
  ck('scanner: a CSS attribute selector is recognised as one, its name interpolated or not',
     attrOf(templateInterps('q(`.dot[data-save="${k}"]`)')[0].before).selector === true &&
     attrOf(templateInterps('q(`[${a.name}="${v}"]`)')[1].before).selector === true);
  ck('literal ternary: accepted only when nothing but a literal can come out',
     litTernary('a?"on":""') && litTernary('(s.conc!=null?s.conc:/x/i.test(m))?"on":""') &&
     !litTernary('a?b:c?"x":"y"') && !litTernary('a?"x":b'));
}

// ---------- a modal title is plain text, never esc()'d (#69)
// openModal() sets its title as textContent — it holds class, spell and pack
// names, so it is never parsed as markup. An esc()'d title therefore shows its
// entities: runChoices() titled a class "Tom &amp; Jerry&#39;s". The body is the
// HTML half and callers escape it; the title is passed exactly as written. The
// behavioural half (what reaches #mTitle) is in char-update.js.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  /* The text of a call's FIRST argument: up to the first comma or closing
     bracket at depth 0, with strings and templates (and their ${…}) skipped
     whole, so a comma inside one does not end it. */
  function firstArg(src, i) {
    const s = i, n = src.length;
    const quoted = q => { i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; };
    const template = () => {
      i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          i += 2; let d = 1;
          while (i < n && d) {
            const c = src[i];
            if (c === '"' || c === "'") { quoted(c); continue; }
            if (c === '`') { template(); continue; }
            if (c === '{') d++; else if (c === '}') d--;
            i++;
          }
          continue;
        }
        i++;
      }
      i++;
    };
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '"' || c === "'") { quoted(c); continue; }
      if (c === '`') { template(); continue; }
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) { if (!depth) break; depth--; }
      else if (c === ',' && !depth) break;
      i++;
    }
    return src.slice(s, i).trim();
  }
  const calls = [], escaped = [];
  manifest.js.forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /(^|[^\w$.])openModal\(/g; let m;
    while ((m = re.exec(src))) {
      if (/function\s*$/.test(src.slice(Math.max(0, m.index - 12), m.index + m[1].length))) continue;
      const t = firstArg(src, m.index + m[0].length);
      if (!t) continue;                                   // "openModal()" in a comment
      const where = f.replace(/^src\/js\//, '') + ':' + src.slice(0, m.index).split('\n').length;
      calls.push(where + ' ' + t);
      if (/\besc\(|&(amp|lt|gt|quot|#39);/.test(t)) escaped.push(where + ' ' + t);
    }
  });
  ck('the title scan is looking at something', calls.length >= 45, calls.length);
  ck('no openModal() title is esc()\'d — the title is text, set as textContent', escaped.length === 0, escaped);
  const probe = 'openModal(`${a}, ${esc(b)} — x`,`<p>${esc(c)}</p>`)';
  ck('title scan: a comma inside a template does not end the title',
     firstArg(probe, 'openModal('.length) === '`${a}, ${esc(b)} — x`', firstArg(probe, 'openModal('.length));
  ck('openModal() writes the title as textContent (the contract the scan rests on)',
     /function openModal\(title,html,icon\)\{[^}]*getElementById\("mTitle"\)\.textContent=title;/.test(
       fs.readFileSync(path.join(ROOT, 'src/js/80-modal-forms.js'), 'utf8')));
}

/* ================= Fetch all never loses what is loaded (issue #65) ===========
   fetchAllRules() used to call resetRules() BEFORE fetching, so every pack
   imported from a file was discarded, and when the fetch then failed (offline,
   CORS) it saved whatever that run had loaded — nothing — over the cache. The
   next launch had no rules, and the status line said "Kept what loaded".

   The contract now: a source that arrives whole replaces the packs IT loaded
   last time (and only those); a source that fails leaves its previous packs in
   place; a run where nothing arrives changes neither the pool nor the cache, and
   says so. Asynchronous, so it runs last and calls ck.done() itself.

   The harness's fetch rejects (offline); these checks swap in one that answers
   from `routes` and records every request. */
(async () => {
  ctx.URL = URL;                                    // fetchRulesFrom resolves includes with it
  let routes = {}, calls = [];
  ctx.fetch = (url, opts) => {
    calls.push({url, cache: opts && opts.cache});
    if (!(url in routes)) return Promise.reject(new TypeError('Failed to fetch'));
    const r = routes[url];
    if (r && r.__status) return Promise.resolve({ok: false, status: r.__status, json: () => Promise.reject(new Error('no body'))});
    return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(r)))});
  };
  // the status line and the Settings "Rules data" header chip, readable
  const status = {textContent: '', className: ''};
  const chip = {textContent: 'STALE'};
  const getById = ctx.document.getElementById;
  ctx.document.getElementById = id => id === 'rulesStatus' ? status : getById(id);
  ctx.document.querySelector = sel => /data-setsec="rules"/.test(sel) && /fgcount/.test(sel) ? chip : null;
  // drain every microtask the fetch chain queues, whether or not it returns a promise
  const run = async () => { calls = []; await X.fetchAllRules(); await new Promise(r => setImmediate(r)); };
  const cache = () => store[X.K_RULES];
  const cached = () => JSON.parse(X.readRulesCacheString(cache()) || '{}');
  const names = (r, cat, src) => { const a = (r || X.rules)[cat]; return (Array.isArray(a) ? a : []).filter(e => e && (!src || e._source === src)).map(e => e.name).sort(); };
  const badge = () => { const n = X.rulesEntryCount(); return n ? n + ' entries' : 'none loaded'; };
  // a file-imported rulebook, cached the way an import leaves it
  const seedFilePack = () => {
    X.character = X.blankChar();
    X.resetRules();
    X.mergeRules({system: 'XPHB', rulebook: true, classes: [{name: 'Wizard'}],
                  spells: [{name: 'Fireball'}, {name: 'Shield'}]}, '5e2024_full.json');
    state.quotaFull = false;
    X.saveRulesCache();
  };
  const HB = 'https://example.test/homebrew.json', OFF = 'http://127.0.0.1:9/offline-pack.json';

  // ---- (b) offline: a run where nothing arrives changes nothing
  seedFilePack();
  X.settings.rulesSources = [OFF];
  routes = {};
  const poolBefore = JSON.stringify(X.rules), cacheBefore = cache();
  chip.textContent = 'STALE';
  await run();
  ck('fetch-all offline: the pool is exactly as it was', JSON.stringify(X.rules) === poolBefore,
     names(null, 'spells'));
  ck('fetch-all offline: the file-imported pack is still loaded',
     names(null, 'spells').join() === 'Fireball,Shield' && names(null, 'classes').join() === 'Wizard');
  ck('fetch-all offline: the cache is exactly as it was', cache() === cacheBefore);
  ck('fetch-all offline: the status line says nothing changed', /nothing changed/i.test(status.textContent), status.textContent);
  ck('fetch-all offline: ...and no longer claims it "kept what loaded"', !/kept what loaded/i.test(status.textContent), status.textContent);
  ck('fetch-all offline: ...names the source that failed', /offline-pack\.json/.test(status.textContent), status.textContent);
  ck('fetch-all offline: ...points at importing files instead', /import/i.test(status.textContent), status.textContent);
  ck('fetch-all offline: ...in red', /\berr\b/.test(status.className), status.className);
  ck('fetch-all offline: the Rules data chip counts what is loaded', chip.textContent === badge(), [chip.textContent, badge()]);
  ck('fetch-all offline: one request, uncached', calls.length === 1 && calls[0].cache === 'no-store', calls);

  // ---- (a) a file-imported pack survives a successful fetch of another source
  seedFilePack();
  X.settings.rulesSources = [HB];
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap', text: 'v1'}, {name: 'Fizzle'}]}};
  chip.textContent = 'STALE';
  await run();
  ck('fetch-all: the fetched pack is merged', names(null, 'spells', 'Homebrew').join() === 'Fizzle,Zap',
     names(null, 'spells', 'Homebrew'));
  ck('fetch-all: a pack imported from a FILE survives it',
     names(null, 'spells', 'XPHB').join() === 'Fireball,Shield' && names(null, 'classes').join() === 'Wizard',
     names(null, 'spells'));
  ck('fetch-all: ...still listed under its file in Loaded data',
     X.loadedRulesGroups().some(g => g.isFile && g.label === '5e2024_full.json'));
  ck('fetch-all: the cache holds both the file pack and the fetched one',
     names(cached(), 'spells').join() === 'Fireball,Fizzle,Shield,Zap', names(cached(), 'spells'));
  ck('fetch-all: the status line reports success', /^Fetched/.test(status.textContent) && /\bok\b/.test(status.className),
     [status.textContent, status.className]);
  ck('fetch-all: the Rules data chip counts the new pool', chip.textContent === badge() && badge() === '5 entries',
     [chip.textContent, badge()]);

  // ---- (c) re-fetching a source replaces its own packs, without duplicates
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap', text: 'v2'}, {name: 'Bolt'}]}};
  await run();
  const zaps = (X.rules.spells || []).filter(e => e.name === 'Zap');
  ck('re-fetch: an entry it still serves is replaced, not doubled', zaps.length === 1 && zaps[0].text === 'v2', zaps);
  ck('re-fetch: an entry it no longer serves is gone', !names(null, 'spells').includes('Fizzle'), names(null, 'spells'));
  ck('re-fetch: a new entry arrives', names(null, 'spells', 'Homebrew').join() === 'Bolt,Zap', names(null, 'spells', 'Homebrew'));
  ck('re-fetch: the file pack is untouched', names(null, 'spells', 'XPHB').join() === 'Fireball,Shield');
  ck('re-fetch: the pool has exactly 4 spells', (X.rules.spells || []).length === 4, names(null, 'spells'));
  ck('re-fetch: the cache agrees', names(cached(), 'spells').join() === 'Bolt,Fireball,Shield,Zap', names(cached(), 'spells'));
  // a pack fetched before this fix carries no mark of its URL; same names still replace in place
  X.mergeRules({system: 'Homebrew', spells: [{name: 'Bolt', text: 'old'}]});
  await run();
  ck('re-fetch: an older fetched copy is replaced by name, not doubled',
     (X.rules.spells || []).filter(e => e.name === 'Bolt').length === 1);

  // ---- a source that fails keeps what it loaded last time; the others refresh
  const EX = 'https://example.test/extras.json';
  seedFilePack();
  X.settings.rulesSources = [HB, EX];
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]},
            [EX]: {system: 'Extras', items: [{name: 'Rope of Doom'}]}};
  await run();
  ck('two sources: both arrive', names(null, 'items').join() === 'Rope of Doom' && names(null, 'spells', 'Homebrew').join() === 'Zap');
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}, {name: 'Bolt'}]}};   // extras.json is now unreachable
  await run();
  ck('one fails: the one that arrived is refreshed', names(null, 'spells', 'Homebrew').join() === 'Bolt,Zap');
  ck('one fails: the one that failed keeps its previous pack', names(null, 'items').join() === 'Rope of Doom', names(null, 'items'));
  ck('one fails: the file pack is untouched', names(null, 'spells', 'XPHB').join() === 'Fireball,Shield');
  ck('one fails: the cache keeps the failed source\'s pack', names(cached(), 'items').join() === 'Rope of Doom');
  ck('one fails: the status line names it and says it was kept',
     /extras\.json/.test(status.textContent) && /kept/i.test(status.textContent) && /\berr\b/.test(status.className),
     [status.textContent, status.className]);
  // same name from two sources under one label: the later source still wins
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap', text: 'first'}]},
            [EX]: {system: 'Homebrew', spells: [{name: 'Zap', text: 'second'}]}};
  await run();
  ck('later sources still win on name clashes',
     (X.rules.spells || []).filter(e => e.name === 'Zap').map(e => e.text).join() === 'second');
  X.settings.rulesSources = [HB, HB + ' '];
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]}};
  await run();
  ck('a source listed twice is fetched once', calls.length === 1, calls);

  // ---- a manifest is one source: its includes arrive together or not at all
  const MAN = 'https://example.test/pack/manifest.json', A = 'https://example.test/pack/a.json', B = 'https://example.test/pack/b.json';
  seedFilePack();
  X.settings.rulesSources = [MAN];
  routes = {[MAN]: {name: 'Pack', include: ['a.json', 'b.json']},
            [A]: {system: 'Pack', spells: [{name: 'Alpha'}], include: ['manifest.json']},   // a loop
            [B]: {system: 'Pack', feats: [{name: 'Beta'}]}};
  await run();
  ck('manifest: its includes are followed relative to it', names(null, 'spells', 'Pack').join() === 'Alpha' && names(null, 'feats').join() === 'Beta');
  ck('manifest: a loop is fetched once per URL', calls.length === 3, calls.map(c => c.url));
  routes[B] = {__status: 404};
  await run();
  ck('manifest: one include failing keeps the whole pack as it was',
     names(null, 'feats').join() === 'Beta' && names(null, 'spells', 'Pack').join() === 'Alpha', [names(null, 'feats'), names(null, 'spells')]);
  ck('manifest: ...and says which file failed', /b\.json/.test(status.textContent) && /404/.test(status.textContent), status.textContent);
  routes = {[MAN]: {name: 'Pack', include: ['a.json']}, [A]: {system: 'Pack', spells: [{name: 'Alpha'}]}};
  await run();
  ck('manifest: an include it drops is dropped on the next fetch', names(null, 'feats').join() === '', names(null, 'feats'));
  ck('manifest: the file pack is untouched throughout', names(null, 'spells', 'XPHB').join() === 'Fireball,Shield');

  // ---- a response that is not a rules file fails the source; it is not half-merged
  seedFilePack();
  X.settings.rulesSources = [HB];
  routes = {[HB]: null};
  const before2 = JSON.stringify(X.rules), cache2 = cache();
  await run();
  ck('a null body changes nothing', JSON.stringify(X.rules) === before2 && cache() === cache2);
  ck('...and is reported', /homebrew\.json/.test(status.textContent) && /\berr\b/.test(status.className), status.textContent);
  // a 200 with no rules in it is a failure too, not "this source now serves nothing"
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]}};
  await run();
  routes = {[HB]: {message: 'Not Found'}};
  await run();
  ck('an answer with no rules in it keeps what the source loaded', names(null, 'spells', 'Homebrew').join() === 'Zap',
     names(null, 'spells'));
  ck('...and says why', /no rules in it/.test(status.textContent), status.textContent);

  // ---- an include that cannot even be turned into a URL names its file too
  X.settings.rulesSources = [HB];
  routes = {[HB]: {system: 'Homebrew', include: ['http://[bad']}};
  await run();
  ck('an unresolvable include fails the source, naming the file',
     /homebrew\.json/.test(status.textContent) && /nothing changed/i.test(status.textContent), status.textContent);

  // ---- provenance is the merge's to stamp: a stray _url in a FILE never lets a fetch delete it
  seedFilePack();
  X.mergeRules({system: 'Homebrew', spells: [{name: 'Hex', _url: HB}]}, 'mine.json');
  X.settings.rulesSources = [HB];
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]}};
  await run();
  ck('a file entry carrying a stray _url survives a fetch of that URL', names(null, 'spells').includes('Hex'), names(null, 'spells'));

  // ---- `requires` follows the source's fresh copy, unless a file shares its label
  seedFilePack();
  X.settings.rulesSources = [HB];
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}], requires: [{file: 'x.json', spells: ['Nope']}]}};
  await run();
  ck('requires: a fetched declaration is stored', !!(X.rules.requires || {}).Homebrew);
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]}};
  await run();
  ck('requires: a source that stops declaring it loses it (no false "missing" chip)',
     !(X.rules.requires || {}).Homebrew && X.missingRequirements('Homebrew').length === 0, X.rules.requires);
  X.mergeRules({system: 'Homebrew', spells: [{name: 'Hex'}], requires: [{file: 'x.json', spells: ['Nope']}]}, 'mine.json');
  await run();
  ck('requires: a declaration a file import shares is kept', !!(X.rules.requires || {}).Homebrew, X.rules.requires);

  // ---- the cache write reflects the new pool, and a refused one says so
  seedFilePack();
  X.settings.rulesSources = [HB];
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]}};
  state.quotaFull = true;
  await run();
  state.quotaFull = false;
  ck('a refused cache write is reported on the status line',
     X.rulesCacheWarning() !== '' && status.textContent.includes(X.rulesCacheWarning()) && /\berr\b/.test(status.className),
     [status.textContent, X.rulesCacheWarning()]);
  ck('...while the fetched pack stays loaded for this session', names(null, 'spells', 'Homebrew').join() === 'Zap');
  X.saveRulesCache();

  // ---- #71: a fetched pack's unusable entries are reported, not silently dropped
  seedFilePack();
  X.settings.rulesSources = [HB];
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}, {text: 'no name'}], keywords: [{text: 'no term'}]}};
  await run();
  ck('#71 fetch-all: the usable entries arrive', names(null, 'spells', 'Homebrew').join() === 'Zap', names(null, 'spells'));
  ck('#71 fetch-all: the status line says what was skipped',
     /skipped/i.test(status.textContent) && /1 glossary entry/.test(status.textContent) && /1 spell/.test(status.textContent),
     status.textContent);

  // ---- the Rules data chip follows every change to the pool, not only Fetch all
  chip.textContent = 'STALE';
  state.confirm = true;
  X.clearAllRules();
  ck('the Rules data chip follows Clear all', chip.textContent === 'none loaded', chip.textContent);

  /* ================= Import settings asks before replacing loaded rules (#70) ==========
     Export settings writes {_type:"fieldbook-settings", settings, rules}: the WHOLE pool as
     it stood that day. Import settings assigned that `rules` wholesale — no question, no
     validation — so every pack imported or fetched since the export vanished without a
     word, and a malformed one (a keyword with `name` for `term`) broke every render after.

     Driven through the real Settings → Import settings handler: the file input's change
     listener, a FileReader that answers at once, and the question's buttons clicked. */
  {
    const writes = [];                               // every modal body the app drew, in order
    const mBody = {set innerHTML(v) { writes.push(String(v)); }, get innerHTML() { return writes[writes.length - 1] || ''; }};
    const impStatus = {textContent: '', className: ''};
    const rulesDataEl = {innerHTML: '', addEventListener() {}};
    let hooks = {};                                  // id -> {event: handler}
    const hookEl = id => ({value: '', click() {}, addEventListener: (t, f) => { (hooks[id] = hooks[id] || {})[t] = f; }});
    const HOOKED = new Set(['fileSettings', 'setImpKeep', 'setImpReplace', 'setImpCancel']);
    const getById2 = ctx.document.getElementById;
    ctx.document.getElementById = id => id === 'mBody' ? mBody : id === 'setImpStatus' ? impStatus
      : id === 'rulesData' ? rulesDataEl : HOOKED.has(id) ? hookEl(id) : getById2(id);
    ctx.FileReader = class { readAsText(f) { this.result = f.text; if (this.onload) this.onload(); } };
    const alerts = [];
    ctx.alert = m => { alerts.push(m); };
    const settle = () => new Promise(r => setImmediate(r));
    const importFile = async obj => {
      hooks = {}; writes.length = 0; impStatus.textContent = ''; impStatus.className = '';
      X.openSettings();
      const h = hooks.fileSettings && hooks.fileSettings.change;
      if (!h) throw new Error('Import settings has no change handler on #fileSettings');
      h({target: {files: [{name: 'fieldbook-settings.json', text: typeof obj === 'string' ? obj : JSON.stringify(obj)}], value: ''}});
      await settle();
    };
    const click = async id => { const h = hooks[id] && hooks[id].click; if (h) h({}); await settle(); return !!h; };
    const question = () => writes.find(w => /id="setImpReplace"/.test(w)) || '';
    const asked = () => !!question();
    const settingsFile = (rules, s) => ({_type: 'fieldbook-settings', settings: s || {skin: 'classic'}, rules});

    // the day of the export: an older copy of the 2024 rulebook from a file, plus a fetched pack
    X.resetRules();
    X.mergeRules({system: 'XPHB', rulebook: true, dataVersion: '1.0.0', classes: [{name: 'Wizard'}],
                  spells: [{name: 'Fireball'}], keywords: [{term: 'Blinded', text: 'Cannot see.'}]}, '5e2024_full.json');
    X.mergeRules({system: 'Homebrew', spells: [{name: 'Zap'}]}, null, HB);
    const OLD = JSON.parse(JSON.stringify(X.rules));   // what Export settings wrote: the pool, stamps and all
    const OLD_N = X.rulesEntryCount();
    // ...and since then: a newer rulebook, and a homebrew file the settings file has never seen
    const seedNow = () => {
      X.character = X.blankChar();
      Object.assign(X.settings, {skin: 'humblewood', theme: 'light', rough: true});
      X.resetRules();
      X.mergeRules({system: 'XPHB', rulebook: true, dataVersion: '1.1.0', classes: [{name: 'Wizard'}],
                    spells: [{name: 'Fireball'}, {name: 'Shield'}, {name: 'Mage Armor'}]}, '5e2024_full.json');
      X.mergeRules({system: 'Mine', feats: [{name: 'Lucky Break'}]}, 'my-homebrew.json');
      state.quotaFull = false;
      X.saveRulesCache();
    };

    // ---- (a) declining keeps every loaded pack; only the settings come in
    seedNow();
    const poolA = JSON.stringify(X.rules), cacheA = cache();
    await importFile(settingsFile(OLD));
    ck('import settings: a file carrying rules asks before touching them', asked(), writes.length);
    ck('import settings: nothing is replaced while the question is open', JSON.stringify(X.rules) === poolA, names(null, 'spells'));
    await click('setImpKeep');
    ck('keep: a pack imported after the export survives', names(null, 'feats').join() === 'Lucky Break', names(null, 'feats'));
    ck('keep: the loaded pool is exactly as it was', JSON.stringify(X.rules) === poolA, names(null, 'spells'));
    ck('keep: the cache is exactly as it was', cache() === cacheA);
    ck('keep: the settings ARE imported', X.settings.skin === 'classic', X.settings.skin);
    ck('keep: the status line says the rules were kept', /unchanged/i.test(impStatus.textContent) && /\bok\b/.test(impStatus.className),
       [impStatus.textContent, impStatus.className]);

    // ---- (c) the question says what the file carries, what is loaded, and what replacing loses
    {
      const q = question();
      ck('the question names the pack replacing would unload', /my-homebrew\.json/.test(q) && /unload/i.test(q), q);
      ck('...counts what the file carries', new RegExp('\\b' + OLD_N + ' entries').test(q) && /\bHomebrew\b/.test(q), q);
      ck('...and what is loaded now', new RegExp('\\b' + X.rulesEntryCount() + ' entries').test(q), q);
      ck('...shows each copy\'s data version, so a downgrade is visible', /v1\.0\.0/.test(q) && /v1\.1\.0/.test(q), q);
      ck('...and says replacing puts back an older copy of a pack in both', /older copy of 5e2024_full\.json/.test(q), q);
      ck('...offers keeping the rules as well as replacing them, and cancelling',
         /id="setImpKeep"/.test(q) && /id="setImpCancel"/.test(q) && /Keep my rules/.test(q) && /Replace my rules/.test(q), q);
      ck('...says characters are not affected', /characters are not affected/i.test(q), q);
    }

    // ---- (b) accepting replaces the pool — normalised through the merge path, cached, and shown
    seedNow();
    {
      const dirty = JSON.parse(JSON.stringify(OLD));
      dirty.keywords[0].id = 'kw-from-the-file';
      dirty.spells.push(Object.assign({}, dirty.spells[0], {_id: 'r999', text: 'a second copy'}));   // same source + name twice
      await importFile(settingsFile(dirty));
      chip.textContent = 'STALE';
      await click('setImpReplace');
    }
    ck('replace: the pool is the file\'s', names(null, 'spells').join() === 'Fireball,Zap' && names(null, 'feats').join() === '',
       [names(null, 'spells'), names(null, 'feats')]);
    ck('replace: normalised — a same source + name pair is one entry, as a file import leaves it',
       (X.rules.spells || []).filter(e => e.name === 'Fireball').length === 1, (X.rules.spells || []).map(e => e.name));
    ck('replace: normalised — keyword ids are the app\'s, not the file\'s',
       (X.rules.keywords || []).length === 1 && X.rules.keywords[0].id !== 'kw-from-the-file', X.rules.keywords);
    {
      const ids = X.RULE_CATS.flatMap(c => (X.rules[c] || []).map(e => e._id));
      ck('replace: normalised — every entry re-indexed', ids.every((id, i) => id === 'r' + i), ids);
    }
    ck('replace: provenance survives — the rulebook is still listed under its file, with its version',
       X.loadedRulesGroups().some(g => g.isFile && g.label === '5e2024_full.json' && g.rulebook && g.dataVersion === '1.0.0'),
       X.loadedRulesGroups());
    ck('replace: ...and the fetched pack keeps its URL, so Fetch all still replaces it',
       (X.rules.spells || []).filter(e => e.name === 'Zap').every(e => e._url === HB) && names(null, 'spells', 'Homebrew').join() === 'Zap');
    ck('replace: the cache holds the new pool', names(cached(), 'spells').join() === 'Fireball,Zap' && names(cached(), 'feats').join() === '',
       names(cached(), 'spells'));
    ck('replace: the settings are imported too', X.settings.skin === 'classic');
    ck('replace: the status line says the rules were replaced, with the new count',
       /replaced/i.test(impStatus.textContent) && impStatus.textContent.includes(X.rulesEntryCount() + ' entries'), impStatus.textContent);
    ck('replace: the Rules data chip follows the new pool', chip.textContent === badge(), [chip.textContent, badge()]);
    ck('replace: the loaded-data list is redrawn', /5e2024_full\.json/.test(rulesDataEl.innerHTML) && !/my-homebrew\.json/.test(rulesDataEl.innerHTML));
    ck('replace: Settings reopens on the new pool', writes.length > 0 && writes[writes.length - 1].includes(X.rulesStatusText()) &&
       writes[writes.length - 1].includes('>' + X.rulesBadge() + '<'));

    // ---- (d) a settings file with no rules never asks and never touches the pool
    for (const [what, file] of [
      ['no rules key', {_type: 'fieldbook-settings', settings: {skin: 'classic'}}],
      ['exported with nothing loaded', settingsFile({name: '', version: 1, keywords: [], items: [], features: [], spells: [], races: [],
        classes: [], feats: [], tables: [], requires: {}, _dups: {}})],
      ['the oldest shape, a bare settings object', {skin: 'classic', theme: 'dark', rough: false}],
    ]) {
      seedNow();
      const pool = JSON.stringify(X.rules), c0 = cache();
      await importFile(file);
      ck('no rules (' + what + '): never asks', !asked());
      ck('no rules (' + what + '): never touches the pool or the cache', JSON.stringify(X.rules) === pool && cache() === c0,
         names(null, 'spells'));
      ck('no rules (' + what + '): the settings are imported', X.settings.skin === 'classic', X.settings.skin);
      ck('no rules (' + what + '): the status line says so', /imported/i.test(impStatus.textContent), impStatus.textContent);
    }

    // ---- the reported repro: a keyword with `name` for `term` replaced the 2024 pack, then broke
    // every render. Since #71 that shape is read as a term (`name` is how every other category is
    // written), so it is READABLE rules — and readable rules over a loaded pool must be asked about.
    seedNow();
    {
      const pool = JSON.stringify(X.rules), c0 = cache();
      await importFile(settingsFile({keywords: [{name: 'Settings-file term', desc: '…'}]}));
      ck('the reported repro: its keyword is read as a term, so it asks before replacing', asked(), question());
      await click('setImpCancel');
      ck('the reported repro: Cancel leaves the pool and the cache untouched', JSON.stringify(X.rules) === pool && cache() === c0);
    }
    // ---- rules with nothing readable in them: a keyword with neither term nor name
    seedNow();
    {
      const pool = JSON.stringify(X.rules), c0 = cache();
      await importFile(settingsFile({keywords: [{text: 'An entry with no term at all'}]}));
      ck('unreadable rules: nothing in them loads, so there is nothing to ask', !asked());
      ck('unreadable rules: the pool and the cache are untouched', JSON.stringify(X.rules) === pool && cache() === c0,
         [names(null, 'spells'), X.rules.keywords]);
      ck('unreadable rules: the settings are still imported', X.settings.skin === 'classic');
      ck('unreadable rules: the status line says the rules could not be read', /couldn't be read/i.test(impStatus.textContent),
         impStatus.textContent);
    }

    // ---- malformed rules: whatever loads must leave `rules` in a shape every renderer can take
    seedNow();
    await importFile(settingsFile({
      name: {not: 'a string'}, requires: 'junk', _dups: 7,
      keywords: [{text: 'no term, no name'}, null, 'a string', 42, {term: 'Real Term', text: 'ok'}],
      spells: 'oops', classes: {not: 'an array'}, races: null,
      items: [null, 5, ['nested'], {name: 'Rope', _source: 'Kit'}],
      tables: [{name: 'Odd Table', cols: ['a'], rows: [['1']]}],
    }));
    ck('malformed: it asks, since part of it is readable', asked());
    ck('malformed: ...and the question says some of it could not be loaded', /7 entries in it couldn(?:'|&#39;|&#x27;)t be loaded/i.test(question()), question());
    await click('setImpReplace');
    ck('malformed: every category is an array of objects',
       X.RULE_CATS.every(c => X.rules[c] === undefined || (Array.isArray(X.rules[c]) &&
         X.rules[c].every(e => e && typeof e === 'object' && !Array.isArray(e)))),
       X.RULE_CATS.map(c => [c, Array.isArray(X.rules[c]) ? X.rules[c].length : typeof X.rules[c]]));
    ck('malformed: a keyword with no term is dropped, not loaded to break every render',
       Array.isArray(X.rules.keywords) && X.rules.keywords.map(k => k && k.term).join() === 'Real Term', X.rules.keywords);
    ck('malformed: what could be read is loaded', names(null, 'items').join() === 'Rope' && names(null, 'tables').join() === 'Odd Table');
    ck('malformed: the pool\'s name and requires keep their types',
       typeof X.rules.name === 'string' && X.rules.requires && typeof X.rules.requires === 'object' && !Array.isArray(X.rules.requires),
       [X.rules.name, X.rules.requires]);
    {
      let threw = null;
      try { X.highlight('Real Term and a Rope'); X.rulesDataHTML(); X.rulesStatusText(); X.missingSummary(); X.dispName(X.rules.items[0], 'items'); }
      catch (e) { threw = String(e && e.message || e); }
      ck('malformed: rendering still works afterwards', threw === null, threw);
    }

    // ---- nothing loaded: nothing to lose, so the file's rules load without a question
    X.resetRules(); X.saveRulesCache();
    await importFile(settingsFile(OLD));
    ck('nothing loaded: the file\'s rules load without asking', !asked() && names(null, 'spells').join() === 'Fireball,Zap',
       names(null, 'spells'));
    ck('nothing loaded: ...and are cached', names(cached(), 'spells').join() === 'Fireball,Zap');
    ck('nothing loaded: ...and the status line says what came in',
       /rules/i.test(impStatus.textContent) && impStatus.textContent.includes(OLD_N + ' entries'), impStatus.textContent);

    // ---- Cancel imports nothing at all
    seedNow();
    {
      const pool = JSON.stringify(X.rules);
      await importFile(settingsFile(OLD));
      await click('setImpCancel');
      ck('cancel: neither the settings nor the rules change', JSON.stringify(X.rules) === pool && X.settings.skin === 'humblewood',
         X.settings.skin);
    }

    // ---- a refused cache write says so on the line the player is reading
    seedNow();
    await importFile(settingsFile(OLD));
    state.quotaFull = true;
    await click('setImpReplace');
    state.quotaFull = false;
    ck('a refused cache write is reported beside Import settings',
       X.rulesCacheWarning() !== '' && impStatus.textContent.includes(X.rulesCacheWarning()) && /\berr\b/.test(impStatus.className),
       [impStatus.textContent, impStatus.className]);
    ck('...and so is the refused settings write', /settings imported for this session only/i.test(impStatus.textContent),
       impStatus.textContent);
    ck('...while the file\'s rules stay loaded for this session', names(null, 'spells').join() === 'Fireball,Zap');
    X.saveRulesCache();

    // ---- a refused settings write is reported on its own, too (Keep writes no cache)
    seedNow();
    await importFile(settingsFile(OLD));
    state.quotaFull = true;
    await click('setImpKeep');
    state.quotaFull = false;
    ck('keep: a refused settings write is reported, and in red',
       /for this session only/i.test(impStatus.textContent) && /storage is full/i.test(impStatus.textContent) &&
       /\berr\b/.test(impStatus.className), [impStatus.textContent, impStatus.className]);

    // ---- export → import round trip: every pack comes back as it was
    seedNow();
    X.mergeRules({system: 'TCE', excludeSystems: ['humblewood'], races: [{name: 'Custom Lineage'}],
                  requires: [{file: 'x.json', spells: ['Nope']}]}, 'tashas.json');
    X.mergeRules({system: 'Homebrew', spells: [{name: 'Zap'}]}, null, HB);
    X.mergeRules({system: 'XPHB', rulebook: true, dataVersion: '1.1.0', spells: [{name: 'Bless'}]}, '5e2024_full.json');   // appended after Zap
    {
      const exported = JSON.parse(JSON.stringify({_type: 'fieldbook-settings', settings: X.settings, rules: X.rules}));
      const groups = JSON.stringify(X.loadedRulesGroups());
      const order = () => X.RULE_CATS.map(c => (X.rules[c] || []).map(e => (e._source || '') + ':' + (e.name || e.term)).join('|')).join('/');
      const orderBefore = order(), reqBefore = JSON.stringify(X.rules.requires);
      X.mergeRules({system: 'Late', spells: [{name: 'Late Spell'}]}, 'late.json');
      await importFile(exported);
      await click('setImpReplace');
      ck('round trip: every pack comes back under its heading, with its count and version',
         JSON.stringify(X.loadedRulesGroups()) === groups, X.loadedRulesGroups().map(g => g.label + ':' + g.count));
      ck('round trip: the order within every category is kept', order() === orderBefore, [order(), orderBefore]);
      ck('round trip: excludeSystems survives', (X.rules.races || []).some(r => r.name === 'Custom Lineage' &&
         JSON.stringify(r._excludeSystems) === '["humblewood"]'));
      ck('round trip: requires survives', JSON.stringify(X.rules.requires) === reqBefore, [X.rules.requires, reqBefore]);
    }

    // ---- not a settings file: refused, and nothing changes
    seedNow();
    {
      const pool = JSON.stringify(X.rules), set0 = JSON.stringify(X.settings);
      alerts.length = 0;
      await importFile('{ not json');
      ck('not JSON: refused with a message', alerts.length === 1 && JSON.stringify(X.rules) === pool && JSON.stringify(X.settings) === set0, alerts);
      await importFile({system: 'XPHB', spells: [{name: 'Oops'}]});
      ck('a rules pack picked by mistake: refused, not written into settings',
         alerts.length === 2 && !('spells' in X.settings) && JSON.stringify(X.settings) === set0 && JSON.stringify(X.rules) === pool,
         [alerts, Object.keys(X.settings)]);
    }
    ctx.document.getElementById = getById2;
  }
})().then(() => ck.done(), e => { ck('the Fetch all checks ran to the end', false, String(e && e.stack || e)); ck.done(); });
