/* Rules data: species filtered by character system, the Settings loaded-data
   bucketing, safe clear-all, and the bundle round-trip. Also the Settings modal
   itself — its collapsible sections, and the wiring check below that catches a
   control whose markup and handler have drifted apart. */
const fs = require('fs'), path = require('path');
const {loadApp, makeCheck, ROOT} = require('./harness');

const ck = makeCheck();
const {X, state, bootError, fragments} = loadApp([
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

// ---------- the supplement packs (Xanathar's, Tasha's)
// These counts are the whole defence against the failure this converter keeps
// producing: a source filter that matches nothing writes a valid, empty,
// entirely plausible-looking pack. A wrong number here is a red test; a silent
// zero would be a shipped pack with nothing in it.
{
  const EXPECT={
    xanathars:{system:'XGE',files:{
      'glossary.json':['keywords',22], 'items-magic.json':['items',43],
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
