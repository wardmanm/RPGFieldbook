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
  /* Comments are stripped before anything else looks at the template. block()
     counts <div>/</div> to find an element's extent, so a `<div` written inside
     a comment — describing the markup, which is exactly the kind of comment this
     file attracts — throws the depth off and silently stretches a slice past the
     element it was meant to bound. Counting guards would drift the same way.
     Cheaper to remove comments once than to keep "don't write <div in a comment"
     true by hand forever. */
  const t = fs.readFileSync(path.join(ROOT, 'src/fieldbook.template.html'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
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
    return html.slice(at);
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

  // Vitals owns Hit Points AND Hit Dice, stacked, so the two read as one pair —
  // spending a hit die writes straight into the box above it. Rest & Recovery
  // keeps only the rests, and keeps existing because it is a data-note anchor.
  const hd = ['hitdiceInput', 'data-hdmode', 'hdWrap'];
  const owned = ['data-hp="cur"', 'data-hp="max"', 'data-hp="temp"', 'id="deathFail"', 'data-hplock'].concat(hd);
  ck('Vitals owns HP, the death saves, the padlock and all of hit dice',
     owned.every(s => vitals.includes(s)), owned.filter(s => !vitals.includes(s)));
  ck('Rest & Recovery keeps both rest buttons',
     rest.includes('id="btnShortRest"') && rest.includes('id="btnLongRest"'));
  ck('...and no hit dice is left behind in it',
     !hd.some(s => rest.includes(s)) && !/data-hp=/.test(rest), rest);
  ck('hit dice is written once, not in two cards',
     (t.match(/id="hitdiceInput"/g) || []).length === 1 &&
     (t.match(/id="hdWrap"/g) || []).length === 1);
  ck('the hit-dice panel sits BELOW the HP panel, not inside it',
     vitals.indexOf('id="hdWrap"') > vitals.indexOf('id="maxNote"') && !hpwrap.includes('id="hdWrap"'));

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
     /<div class="hd-title">Hit Dice[\s\S]{0,200}?<\/div>/.test(vitals));
  // the auto/manual pill rides ON the heading — alone on its own line it read as
  // an orphaned control and cost a whole row of the panel's height
  ck('the auto/manual pill sits on the Hit Dice heading',
     /<div class="hd-title">Hit Dice <button class="hd-mode" data-hdmode/.test(vitals));
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
  // the automatic writers go to the model, not through the box: only doLevelUp
  // may touch the flag, and only to clear it
  const cls = fs.readFileSync(path.join(ROOT, 'src/js/56-class.js'), 'utf8');
  ck('56-class.js touches the lock exactly once', (cls.match(/hp\.locked/g) || []).length === 1);
  ck('...in doLevelUp, and only to clear it',
     /function doLevelUp\(\)\{[\s\S]*?character\.hp\.locked=false;renderHP\(\)/.test(cls));
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
     (js.match(/armChoiceDismissGuard\(\);/g) || []).length === 2);

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
     /item:\["description","effects","cost","weight","weapon"\]/.test(js));

  // ---------- the browse footer, and the per-level count
  // The Add button was laid out PAST the right edge of the screen with no way to
  // reach it: .browse is position:fixed with no scroll container, so the overflow
  // left the viewport. The origin select had flex:0 0 auto, whose basis resolves
  // from `width` — which the global input,select,textarea rule sets to 100%.
  ck('the browse footer wraps rather than pushing controls off the edge',
     /\.browse-foot\{[^}]*flex-wrap:wrap/.test(cardsCss),
     (cardsCss.match(/\.browse-foot\{[^}]*\}/) || [''])[0]);
  ck('the origin select overrides the global width:100%',
     /\.br-origin\{[^}]*width:auto/.test(cardsCss), (cardsCss.match(/\.br-origin\{[^}]*\}/) || [''])[0]);
  ck('...and can shrink, which flex-shrink:0 prevented',
     /\.br-origin\{[^}]*flex:1 1 /.test(cardsCss));
  ck('the global rule this fights is still there (the fix depends on it)',
     /input,select,textarea\{width:100%/.test(cardsCss));
  ck('the footer controls carry classes, not the inline flex that caused it',
     !/id="brOrigin"[^>]*style="flex:/.test(js) && /id="brOrigin" class="br-origin"/.test(js));
  ck('the Add button can share a row or drop to its own',
     /\.browse-foot \.tbtn\{flex:1 1 /.test(cardsCss));

  // The count must track what you tick. The row handler deliberately updates the
  // DOM in place and calls foot() rather than re-rendering 400+ rows, so foot()
  // is what has to repaint the headings.
  ck('group headings carry a key the badge painter can find',
     /class="brgroup"\$\{cfg\.groupBadge\?` data-brg=/.test(js));
  ck('the badges repaint from foot(), which is what makes the count live',
     /function foot\(\)\{[\s\S]{0,400}?paintGroupBadges\(\);\}/.test(js));
  ck('changing the origin repaints too — it decides whether picks count',
     /brOrigin"\)paintGroupBadges\(\)/.test(js));
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
  }
  // bold is rendered by descHTML, not highlight — and only where it is needed
  ck('descHTML is bold-only, so lone footnote asterisks stay literal',
     /function descHTML\(text\)\{[\s\S]{0,400}\\\*\\\*\(\[\^\*\]\+\)\\\*\\\*/.test(js) &&
     !/function descHTML\(text\)\{[\s\S]{0,400}<em>/.test(js));
  ck('...and holds highlight\'s own chips aside while it runs',
     /function descHTML\(text\)\{[\s\S]{0,300}<\[\^>\]\+>\/g/.test(js));
  ck('the feature card and class info panes use it',
     /class="desc">\$\{descHTML\(f\.description\)\}/.test(js) &&
     (js.match(/\$\{descHTML\(t\.description\|\|""\)\}/g) || []).length === 2);
  ck('the sentinels are written as escapes, not invisible bytes',
     /const DESC_H0="\\uE00A", DESC_H1="\\uE00B"/.test(js));
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
