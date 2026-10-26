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
  'packMap','normPackMaps',
  'saveRulesCache','rulesCacheWarning','cacheBytes',
  'lzwCompress','lzwDecompress','readRulesCacheString',
  'loadedRulesGroups','rulesBucket','rulesDataHTML','clearAllRules',
  'mergeRules','resetRules','blankChar','migrate','catName',
  'DATA_VERSIONS','dataStatus','dataStatusHTML',
  'rulesEntryCount','settings',
  'SET_PAGES','setPageDef','setPagesFor','setPageOf','setPageStep','setNavHTML','setPageHTML','setGroupHTML','setRowHTML','rulesNavBadgeHTML','SETTINGS_KEYS',
  'NOTE_SECTIONS','NOTE_TABS','noteDef','getNote','noteText','hasNote','saveNote',
  'noteGroupOpen','notesHTML','noteBtnHTML','noteEntryHTML','esc',
  'renderRulesBrowser', 'rbCurKey', 'settings', 'skillKey',
  'openSettings', 'highlight', 'rulesStatusText', 'rulesBadge', 'dispName', 'fxTargets',
  'AMMO_PIECES','AMMO_SINGLE_NAMES','AMMO_BUNDLES','AMMO_LAUNCHERS',
  'EDIT_CARDS', 'combatHeaderHTML',
  'RB_CATS', 'RB_PAGE', 'RB_HITS', 'rbUI', 'rbCat', 'rbShown', 'rbFacets', 'rbState', 'rbFacetVal', 'rbPasses', 'rbSorted', 'rbSortBy', 'rbToggleFacet', 'rbClearFacets', 'rbFindRow', 'rbOpenRow', 'rulesCatOf', 'rbSideHTML', 'rbHeadHTML', 'rbBodyHTML', 'rbSearchHTML',
  'rbToList', 'rbOpenCat', 'rbNum', 'K_SET', 'saveSettings',
  'prunePackMeta',
  'toTopShown', 'updateToTop', 'toTopBehavior', 'scrollToTop',
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
X.mergeRules({system:'TCE',excludeSystems:['humblewood'],races:[{name:'Custom Lineage'}]},'supplement.json');
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
  requires:[{pack:'A Supplement',file:'supplement_full.json',spells:['Cause Fear']},
            {pack:'A Rulebook',file:'rulebook_full.json',spells:['Haste']}]},'hb.json');
{
  const m=X.missingRequirements('Homebrew');
  const flat=m.flatMap(g=>g.missing.map(x=>x.name));
  ck('a declared name that IS loaded is not reported', !flat.includes('Haste'), flat);
  ck('a declared name that is missing is reported', flat.includes('Cause Fear'), flat);
  ck('the report names the file that provides it',
     m.some(g=>g.file==='supplement_full.json'&&g.missing.some(x=>x.name==='Cause Fear')), m);
  ck('a pack with nothing missing reports nothing', X.missingRequirements('XPHB').length===0);
  ck('requires is stored on rules, keyed by source', !!(X.rules.requires||{})['Homebrew']);
}
// case-insensitive, and satisfied by ANY pack — `file` is documentation, not a constraint
X.resetRules();
X.mergeRules({system:'Elsewhere',spells:[{name:'CAUSE FEAR'}]},'other.json');
X.mergeRules({system:'Homebrew',requires:[{file:'supplement_full.json',spells:['Cause Fear']}]},'hb.json');
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

// ---------- #88: pack labels as map keys
// `rules.requires` and `rules.credits` are keyed by a pack's own label
// (srcLabel()): a pack labelled "__proto__" set the object's PROTOTYPE
// instead of a key, silently losing the declaration; one labelled
// "constructor" with no `requires` read back the inherited Object
// constructor, and `decl.forEach` threw. packMap() makes both maps
// null-prototype, so any label is an ordinary key.
{
  // 1. packMap() itself
  const m1=X.packMap({a:1});
  ck('packMap copies own keys', m1.a===1, m1);
  ck('packMap has no prototype', Object.getPrototypeOf(m1)===null);
  ck('packMap(null) is an empty null-proto map', Object.keys(X.packMap(null)).length===0 && Object.getPrototypeOf(X.packMap(null))===null);
  ck('packMap([1]) is an empty null-proto map, not a copy of the array', Object.keys(X.packMap([1])).length===0 && Object.getPrototypeOf(X.packMap([1]))===null);
  ck('packMap(\'x\') is an empty null-proto map', Object.keys(X.packMap('x')).length===0 && Object.getPrototypeOf(X.packMap('x'))===null);

  // 2. merging a pack labelled "__proto__" — the real merge path
  X.resetRules();
  X.mergeRules({system:'__proto__',requires:[{feats:['X']}],license:'MIT',attribution:'a',
    feats:[{name:'F'}]},'f.json');
  ck('requires["__proto__"] is the declared array, not the prototype',
     Array.isArray(X.rules.requires['__proto__']) && X.rules.requires['__proto__'][0].feats[0]==='X',
     X.rules.requires['__proto__']);
  ck('Object.keys(requires) includes "__proto__" as an own key',
     Object.keys(X.rules.requires).includes('__proto__'), Object.keys(X.rules.requires));
  ck('credits has a "__proto__" entry', !!X.rules.credits['__proto__'], X.rules.credits);
  ck('Object.prototype gained nothing', ({}).feats===undefined && Object.getPrototypeOf({})===Object.prototype);

  // 3. the declaration survives a save -> load round trip, the way the cache
  //    restore does: Object.assign into a reset pool, then normPackMaps()
  //    (the restore paths already end in reindexRules()/tidyRules(), which
  //    does the same normalisation — see the report for which path does which)
  {
    const saved=JSON.parse(JSON.stringify(X.rules));
    X.resetRules();
    X.rules=Object.assign(X.rules,saved);
    X.normPackMaps();
    ck('the "__proto__" declaration survives the round trip',
       Array.isArray(X.rules.requires['__proto__']), X.rules.requires);
    ck('restored requires is still a null-prototype map', Object.getPrototypeOf(X.rules.requires)===null);
    ck('restored credits is still a null-prototype map', Object.getPrototypeOf(X.rules.credits)===null);
    // and it must still be safe to write a NEW "__proto__" label after a restore
    X.mergeRules({system:'__proto__',requires:[{feats:['Y']}],feats:[{name:'G'}]},'g.json');
    ck('writing to it again after restore is still an ordinary key',
       Array.isArray(X.rules.requires['__proto__']) && X.rules.requires['__proto__'][0].feats[0]==='Y');
  }

  // 4. removing the pack's entries — the real removal path Settings' own
  //    "remove" button uses (removeRulesGroup -> prunePackMeta)
  X.resetRules();
  X.mergeRules({system:'__proto__',requires:[{feats:['X']}],license:'MIT',attribution:'a',
    feats:[{name:'F'}]},'proto.json');
  ck('setup: the pack is loaded under its file', X.loadedRulesGroups().some(g=>g.key==='f:proto.json'));
  ctx.removeRulesGroup('f:proto.json');
  ck('removing the pack drops the "__proto__" requires entry',
     !('__proto__' in X.rules.requires) && X.rules.requires['__proto__']===undefined, X.rules.requires);
  ck('...and the "__proto__" credits entry', !('__proto__' in X.rules.credits) && X.rules.credits['__proto__']===undefined, X.rules.credits);

  // 5. a pack labelled "constructor" or "toString" with NO requires must not
  //    make missingRequirements() throw on an inherited non-array value
  ['constructor','toString'].forEach(label=>{
    X.resetRules();
    X.mergeRules({system:label,classes:[{name:'Warlock'}]},'x.json');
    let threw=null,result=null;
    try{result=X.missingRequirements(label);}catch(e){threw=String(e&&e.message||e);}
    ck('missingRequirements("'+label+'") does not throw', threw===null, threw);
    ck('missingRequirements("'+label+'") reports nothing declared', Array.isArray(result)&&result.length===0, result);
  });

  // 6. rulesCreditsHTML() lists the "__proto__" pack's credit, escaped, and
  //    does not throw
  X.resetRules();
  X.mergeRules({system:'__proto__',license:'MIT',attribution:'<script>bad</script>',
    feats:[{name:'F'}]},'f.json');
  {
    let threw=null,html='';
    try{html=ctx.rulesCreditsHTML();}catch(e){threw=String(e&&e.message||e);}
    ck('rulesCreditsHTML does not throw for a "__proto__" pack', threw===null, threw);
    ck('rulesCreditsHTML lists its credit', /__proto__/.test(html) && /MIT/.test(html), html);
    ck('rulesCreditsHTML escapes the attribution', html.includes('&lt;script&gt;') && !html.includes('<script>bad</script>'), html);
  }
  X.resetRules();
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
  const pool = fs.readFileSync(path.join(ROOT,'dist','srd52_full.json'), 'utf8');
  const packed = X.lzwCompress(pool);
  ck('lzw round-trips the shipped srd52 pack exactly', X.lzwDecompress(packed) === pool);
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
X.mergeRules({system:'XPHB',rulebook:true,spells:[{name:'Bless'}],races:[{name:'Orc'}]},'rulebook_full.json');
const gs=X.loadedRulesGroups();
const bucket=n=>X.rulesBucket(gs.find(g=>g.label===n));
ck('single-category file -> its category', bucket('spells.json')==='spells', bucket('spells.json'));
ck('multi-category file -> mixed', bucket('mixed.json')==='mixed', bucket('mixed.json'));
ck('rulebook flag wins over mixed', bucket('rulebook_full.json')==='rulebook', bucket('rulebook_full.json'));
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

  X.resetRules();
}

// ---------- bundle round-trip: bundle == importing every file individually
function entrySet(r){
  const o={};
  X.RULE_CATS.forEach(c=>{o[c]=(r[c]||[]).map(e=>String(e.name||e.term||'')).sort();});
  return o;
}
for(const sys of ['homebrew','srd52']){
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
  const races=JSON.parse(fs.readFileSync(path.join('data','srd52','races.json'),'utf8')).races;
  const SIZES=['Tiny','Small','Medium','Large','Huge','Gargantuan'];
  const sized=races.filter(r=>r.size);
  ck('every srd52 species declares a size', sized.length===races.length,
     races.filter(r=>!r.size).map(r=>r.name));
  ck('every declared size is a name the app knows',
     sized.every(r=>(Array.isArray(r.size)?r.size:[r.size]).every(s=>SIZES.includes(s))),
     sized.filter(r=>(Array.isArray(r.size)?r.size:[r.size]).some(s=>!SIZES.includes(s))).map(r=>r.name));
  ['items.json','items-magic.json'].forEach(f=>{
    const items=JSON.parse(fs.readFileSync(path.join('data','srd52',f),'utf8')).items;
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
  const hooks = ['data-ammo-fire', 'data-ammo-pick', 'data-ammo-load', 'data-ammo-recover', 'data-ammo-throw'];
  ck('every ammunition control has a click handler', hooks.every(h => js.includes('closest("[' + h + ']")')),
     hooks.filter(h => !js.includes('closest("[' + h + ']")')));
  ck('...and every one the handler names is drawn', hooks.every(h => new RegExp(h + '="\\$\\{esc\\(').test(js)));
  ck('deleting an item forgets its spent count', /\[data-del-item\][^\n]*forgetAmmo\(character,it\.id\)/.test(js));
  ck('#104 End combat recovers the ammunition once the fight has ended, with an Undo recovery',
     /combatEnd\(character\)[\s\S]{0,200}applyAmmoRecovery\(\)/.test(js) && /label:"Undo recovery",run:\(\)=>undoRecoveryTap\(/.test(js));
  ck('#104 Settings → Sheet display has the Ammo recovery select, wired to the character',
     /id="setAmmoRec"/.test(js) && /getElementById\("setAmmoRec"\)[^\n]*addEventListener\("change"[^\n]*character\.ammoRecovery=/.test(js));
  ck('#104 the item editor has a Recovery select, saved as item.recover',
     /id="iRecover">\$\{recoverOptionsHTML\(it\)\}<\/select>/.test(js) && /rec\.recover=rv/.test(js));
  ck("#104 the item editor's Quantity allows 0, so a thrown weapon at ×0 stays at ×0",
     /id="iQty" type="number" min="0"/.test(js) && !/qty:num\(document\.getElementById\("iQty"\)\.value\)\|\|1/.test(js));
  ck('#47 Settings → Sheet display has the Inventory log size select, wired to the character',
     /Inventory log size/.test(js) && /id="setInvLogSize"/.test(js));
}

// ---------- the app's ammo tables agree with the SRD 5.2 data (#6)
// The one-time pass on old sheets runs without a rules pool, from the AMMO_*
// tables in 62-ammo.js; this keeps them in step with what the converter writes.
{
  const items = JSON.parse(fs.readFileSync(path.join('data','srd52','items.json'),'utf8')).items;
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
  ck("every ammo launcher, bundle and piece in the SRD 5.2 data is in the app's tables, alike", bad.length === 0, bad);
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

// ---------- compact stats in the combat view stay in step (#62)
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const css = manifest.css.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const body = name => (js.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')) || [''])[0];
  ck('the view locks the stat controls when it fills', /syncStatLock\(\)/.test(body('fillCombatView')));
  ck('...unlocks them when a card goes home', /syncStatLock\(\)/.test(body('sendCardHome')));
  ck('...and re-applies the lock after the stats are rebuilt', /syncStatLock\(\)/.test(body('buildStats')));
  ck('the compact rules apply only inside the combat view',
     /#cvList \[data-note="abilities"\]/.test(css) && /#cvList \[data-note="skills"\]/.test(css) && /#cvList #statLegend\{display:none\}/.test(css));
  /* #56 trap, reopened at phone width (final review): a multi-column rule that
     never sets its own grid-auto-flow depends on the base .skills rule, which
     the view's narrower media query can win over, so the grid reads across
     rows instead of down each column. */
  const skillsRules = css.match(/#cvList \[data-note="skills"\] \.skills\{[^}]*\}/g) || [];
  const multiCol = skillsRules.filter(r => /grid-template-columns:repeat\(/.test(r));
  ck('every compact Skills grid of two or more columns sets its own grid-auto-flow:column',
     multiCol.length >= 2 && multiCol.every(r => /grid-auto-flow:column/.test(r)), multiCol);
  /* #103: the four #92 checks on the By ability header in the view went with
     the grouped layout (decision 9); the strip's boxes take the compact rules
     above. */
}

// ---------- the homebrew pack: hand-authored, and the reason `requires` exists
// (The supplement packs' own counts, and every check that read them, moved to
// the private repo's suite with the packs, #85.)
{
  {
    const files=fs.readdirSync(path.join('data','homebrew')).filter(f=>f.endsWith('.json')).sort();
    ck('homebrew ships the expected files',
       JSON.stringify(files)===JSON.stringify(['features.json','subclasses.json','tables.json']), files);
    const reqs=files.map(f=>JSON.parse(fs.readFileSync(path.join('data','homebrew',f),'utf8')));
    ck('every homebrew file declares system Homebrew', reqs.every(o=>o.system==='Homebrew'));
    // fbdata.py bundle compares these with JSON.stringify and fails the build if
    // they differ, so a mismatch must be a red test here first
    const one=JSON.stringify(reqs[0].requires);
    ck('every homebrew file declares the SAME requires', reqs.every(o=>JSON.stringify(o.requires)===one));
    ck('homebrew declares what it needs', Array.isArray(reqs[0].requires)&&reqs[0].requires.length>0);
    const sub=JSON.parse(fs.readFileSync(path.join('data','homebrew','subclasses.json'),'utf8')).subclasses[0];
    ck('the Predator attaches to Warlock', sub.class==='Warlock'&&sub.name==='The Predator');
    ck('the Predator has traits at every declared level',
       Object.values(sub.levels).every(l=>(l.traits||[]).length>0), Object.keys(sub.levels));
  }
  // ---------- homebrew's needs point at public packs (#85, R14)
  ['features', 'subclasses', 'tables'].forEach(f => {
    const req = JSON.parse(fs.readFileSync('data/homebrew/' + f + '.json', 'utf8')).requires || [];
    ck('homebrew/' + f + ': its D&D group needs SRD 5.2, by file', req[0] && req[0].pack === 'SRD 5.2' && req[0].file === 'srd52_full.json', req[0]);
    ck('homebrew/' + f + ": its Xanathar's group names the book, not a file", req[1] && req[1].pack === "Xanathar's Guide to Everything" && !('file' in req[1]), req[1]);
  });
  // and the pack an actual player imports resolves that way: load the two
  // dist bundles a player would (SRD 5.2, the public group's new target, then
  // homebrew), and the only thing still missing is Xanathar's — which was
  // never public to begin with, so it is named by the book, not a file.
  {
    X.resetRules();
    X.mergeRules(JSON.parse(fs.readFileSync(path.join(ROOT,'dist','srd52_full.json'),'utf8')), 'srd52_full.json');
    X.mergeRules(JSON.parse(fs.readFileSync(path.join(ROOT,'dist','homebrew_full.json'),'utf8')), 'homebrew_full.json');
    const missReal=X.missingRequirements('Homebrew');
    const xanGroups=missReal.filter(g=>g.pack==="Xanathar's Guide to Everything");
    const flatReal=xanGroups.flatMap(g=>g.missing.map(x=>x.name));
    ck('importing SRD 5.2 then homebrew leaves only Xanathar\'s content missing',
       missReal.every(g=>g.pack==="Xanathar's Guide to Everything"), missReal);
    ck('...named Cause Fear and Primal Savagery, with no file to point at',
       JSON.stringify(flatReal.slice().sort())===JSON.stringify(['Cause Fear','Primal Savagery'])
       && xanGroups.every(g=>g.file===''), [flatReal, xanGroups]);
    const hReal=X.requiresStatusHTML({source:'Homebrew'});
    ck('requiresStatusHTML for the homebrew group points at the book by name',
       /from Xanathar&#39;s Guide to Everything/.test(hReal), hReal);
    X.resetRules();
  }

  // findTable() looks a table up by NAME across every loaded pack, and a
  // "[Table: X]" anchor carries no pack — so two packs sharing a name means one
  // book's prose opens the other's table. Identical twins are harmless. (The
  // SRD 5.2 / 2024 pairs, which differ in wording on purpose, are pinned in the
  // private repo's suite with the 2024 pack, #85.)
  const seen={};
  ['homebrew','srd52'].forEach(d=>{
    const p=path.join('data',d,'tables.json');
    if(!fs.existsSync(p))return;
    JSON.parse(fs.readFileSync(p,'utf8')).tables.forEach(t=>{
      (seen[t.name]=seen[t.name]||[]).push({d,body:JSON.stringify([t.cols,t.rows,t.footnotes||null])});});
  });
  const differs=v=>v.length>=2&&new Set(v.map(x=>x.body)).size>1;
  const clash=Object.entries(seen).filter(([n,v])=>differs(v));
  ck('no table name is used by two packs, except identical twins', clash.length===0,
     clash.map(([n,v])=>n+' -> '+v.map(x=>x.d).join(', ')));
  // and the anchors must follow the rename, or they resolve to nothing
  ['homebrew','srd52'].forEach(d=>{
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

// ---------- shipped data: every weapon names its properties, and attacks as its base weapon does (#72)
// Only items-base.json defines the 5e-tools property codes, and convert.py once
// read names from the file it was converting, so the magic weapons printed
// "F, L, T" and — "Finesse" never being in the list — attacked with Strength
// where their base weapon uses finesse. A bare code, or a Python dict's repr
// from an object-shaped reference, is how that looks in a pack.
{
  const weapons=[];
  ['homebrew','srd52'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      (JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')).items||[])
        .forEach(it=>{if(it.weapon)weapons.push({where:d+'/'+f,it});});
    }));
  ck('the packs ship weapons to check', weapons.length>=60, weapons.length);
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
  JSON.parse(fs.readFileSync(path.join('data','srd52','items.json'),'utf8')).items
    .forEach(it=>{if(it.weapon)base[it.name.toLowerCase()]=it;});
  const based=weapons.map(x=>Object.assign({b:base[((/Base item: ([^·.]+)/.exec(x.it.description||'')||[])[1]||'')
    .trim().toLowerCase()]},x)).filter(x=>x.b);
  ck('magic weapons name base weapons the core pack has', based.length>=10, based.length);
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
  ['homebrew','srd52'].forEach(d=>
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
  ck('#74 the packs still ship +N weapons (11 in SRD 5.2)',
     plus.filter(x=>x.where.startsWith('srd52/')).length===11,
     plus.map(({where,it})=>where+' '+it.name));
  [['Dagger of Venom',1],['Sun Blade',2],['Dwarven Thrower',3]]
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
    ['srd52','Quarterstaff of the Acrobat','Reaction to twirl the weapon around you, gaining a +5 bonus to your Armor Class against the triggering attack'],
    ['srd52','Arrow-Catching Shield','+2 bonus to Armor Class against ranged attack rolls'],
    ['srd52','Bracers of Defense','+2 bonus to Armor Class if you are wearing no armor and using no Shield'],
    ['srd52','Rod of Alertness','While in that Bright Light, you and your allies gain a +1 bonus to Armor Class and saving throws'],
  ];
  const SIX=['str','dex','con','int','wis','cha'];
  const items=[];
  ['homebrew','srd52'].forEach(d=>
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
// it", the Robe's "each increase by 2"). An item that names the classes whose
// spells it serves still takes an effect: the sheet has one spellcasting
// ability, so the bonus goes on it and the class stays in the text.
{
  const SPELL={
    'srd52':{'+1 Wand of the War Mage':'atk+1','+2 Wand of the War Mage':'atk+2','+3 Wand of the War Mage':'atk+3',
             'Robe of the Archmagi':'atk+2 dc+2','Staff of Power':'atk+2','Staff of the Magi':'atk+2',
             'Staff of the Woodlands':'atk+2','Talisman of Pure Good':'atk+2','Talisman of Ultimate Evil':'atk+2'},
    'homebrew':{},
  };
  const got={};
  ['homebrew','srd52'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      (JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')).items||[]).forEach(it=>{
        const fx=(it.effects||[]).filter(e=>/^spell\./.test(String(e&&e.target)));
        if(fx.length)(got[d]=got[d]||{})[it.name]=fx.map(e=>(e.target==='spell.attack'?'atk':e.target==='spell.dc'?'dc':e.target)+'+'+e.value).join(' ');
      });
    }));
  ['homebrew','srd52'].forEach(d=>{
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
  ['homebrew','srd52'].forEach(d=>
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
  const WANT={'srd52/items-magic.json Stone of Good Luck':'check+1','srd52/items-magic.json Ioun Stone, Mastery':'profBonus+1'};
  const got={};
  const walk=(n,where)=>{
    if(Array.isArray(n))return n.forEach(x=>walk(x,where));
    if(!n||typeof n!=='object')return;
    if(Array.isArray(n.effects))n.effects.forEach(e=>{ if(e&&(e.target==='check'||e.target==='profBonus')){
      const k=where+' '+(n.name||n.term||'?'); got[k]=(got[k]?got[k]+' ':'')+e.target+(e.value>=0?'+':'')+e.value; } });
    Object.keys(n).forEach(k=>walk(n[k],where));
  };
  ['homebrew','srd52'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json'))
      .forEach(f=>walk(JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')),d+'/'+f)));
  const wrong=[...new Set(Object.keys(got).concat(Object.keys(WANT)))].filter(k=>got[k]!==WANT[k]);
  ck('#79 exactly the reviewed items carry an ability-check or proficiency-bonus effect (2)', wrong.length===0,
     wrong.map(k=>k+': want '+(WANT[k]||'none')+', got '+(got[k]||'none')));
  const stone=JSON.parse(fs.readFileSync(path.join('data','srd52','items-magic.json'),'utf8')).items.find(x=>x.name==='Stone of Good Luck');
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
  ['homebrew','srd52'].forEach(d=>
    fs.readdirSync(path.join('data',d)).filter(f=>f.endsWith('.json')).forEach(f=>{
      files++; walk(JSON.parse(fs.readFileSync(path.join('data',d,f),'utf8')),d+'/'+f,'?');
    }));
  ck('#78 the packs have files to scan', files>=14, files);
  ck('#78 no pack carries 5e-tools template text: no {#…}, {{…}}, {=…} or {@…}', bad.length===0,
     bad.length+' strings, e.g. '+JSON.stringify(bad.slice(0,6)));
  // the families that shipped the tag now read the book's words, filled from the item
  const pins=[
    ['srd52','Black Dragon Scale Mail','you have Resistance to Acid damage'],
    ['srd52','Silver Dragon Scale Mail','the closest silver dragon within 30 miles'],
    ['srd52','Ring of Acid Resistance','You have Resistance to Acid damage while wearing this ring. The ring is set with pearl'],
    ['srd52','Potion of Thunder Resistance','When you drink this potion, you have Resistance to Thunder damage for 1 hour'],
    ['srd52','Ioun Stone, Mastery','Roughly marble sized, Ioun Stones are named after Ioun'],
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
/* Two systems this build HAS a baseline for, read from DATA_VERSIONS rather than
   named: the snapshot is retaken from data/packs.json at every release, and the
   packs that left for the private repo (#85) leave it then. */
const [OLD_SYS, CUR_SYS] = Object.keys(X.DATA_VERSIONS);
ck('DATA_VERSIONS has two systems to test staleness with', !!OLD_SYS && !!CUR_SYS, X.DATA_VERSIONS);
X.resetRules();
X.mergeRules({system:OLD_SYS, dataVersion:'1.0.0', rulebook:true,
              races:[{name:'Elf'}]}, 'rulebook_full.json');
X.mergeRules({system:CUR_SYS, dataVersion:X.DATA_VERSIONS[CUR_SYS], rulebook:true,
              races:[{name:'Corvum'}]}, 'campaign_full.json');
/* deliberately a system DATA_VERSIONS has never heard of — "Homebrew" used to
   play this role and is now a real shipped pack, which made the test read as if
   it were asserting something about that pack. */
X.mergeRules({system:'MyOwnStuff', rulebook:true, races:[{name:'Mine'}]}, 'mine.json');

const byLabel = {};
X.loadedRulesGroups().forEach(g => { byLabel[g.source] = g; });

ck('a pack behind DATA_VERSIONS is stale',
   X.dataStatus(byLabel[OLD_SYS]).state === 'stale', X.dataStatus(byLabel[OLD_SYS]));
ck('stale status reports both versions',
   X.dataStatus(byLabel[OLD_SYS]).have === '1.0.0' &&
   X.dataStatus(byLabel[OLD_SYS]).want === X.DATA_VERSIONS[OLD_SYS]);
ck('a pack at DATA_VERSIONS is current',
   X.dataStatus(byLabel[CUR_SYS]).state === 'current');
ck('an unstamped/unknown system is NOT stale',
   X.dataStatus(byLabel['MyOwnStuff']).state === 'unknown');
ck('the loaded dataVersion is recorded on the group',
   byLabel[OLD_SYS].dataVersion === '1.0.0');

// the badge: visible for stale, quiet otherwise
ck('stale renders an update chip', /update available/.test(X.dataStatusHTML(byLabel[OLD_SYS])));
ck('current renders no update chip', !/update available/.test(X.dataStatusHTML(byLabel[CUR_SYS])));
ck('unknown renders nothing at all', X.dataStatusHTML(byLabel['MyOwnStuff']) === '');
ck('the chip reaches the Settings list', /update available/.test(X.rulesDataHTML()));

// a NEWER pack than the app expects is not "stale" either — the player is ahead
X.resetRules();
X.mergeRules({system:OLD_SYS, dataVersion:'99.0.0', rulebook:true, races:[{name:'Elf'}]}, 'f.json');
ck('a pack newer than the app is not flagged stale',
   X.dataStatus(X.loadedRulesGroups()[0]).state === 'current');

// ---------- every shipped pack agrees with data/packs.json (#83)
JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'packs.json'), 'utf8')).packs.forEach(reg => {
  if (!fs.existsSync(path.join(ROOT, 'data', reg.dir))) return;
  const p = path.join(ROOT, 'dist', reg.file);
  if (!fs.existsSync(p)) { ck(reg.file + ' exists', false); return; }
  const pack = JSON.parse(fs.readFileSync(p, 'utf8'));
  ck(reg.file + ' system is the registry system', pack.system === reg.system, pack.system);
  ck(reg.file + ' name is the registry title', pack.name === reg.title, pack.name);
  ck(reg.file + ' dataVersion is the registry version',
     (pack.dataVersion || null) === (reg.version || null), pack.dataVersion + ' vs ' + reg.version);
  ck(reg.file + ' licence and credit match the registry',
     (pack.license || null) === (reg.license || null) && (pack.attribution || null) === (reg.attribution || null));
});
// The bundle is the file players actually import. fbdata.py bundle builds it
// from a fixed key list, so a pack property it doesn't know about is dropped —
// the per-category files would filter correctly and the bundle silently would not.
[['srd52_full.json']].forEach(([f]) => {
  const p = path.join(ROOT, 'dist', f);
  if (!fs.existsSync(p)) return;
  const pack = JSON.parse(fs.readFileSync(p, 'utf8'));
  ck(f + ' carries excludeSystems through bundling',
     JSON.stringify(pack.excludeSystems) === JSON.stringify(['humblewood']), pack.excludeSystems);
});

// ---------- #84: converter fixes, on the public pack (the 2024 pack's own pins
// moved to the private repo's suite with it, #85)
{
  ['srd52'].forEach(d => fs.readdirSync(path.join(ROOT, 'data', d)).filter(f => f.endsWith('.json')).forEach(f => {
    const t = fs.readFileSync(path.join(ROOT, 'data', d, f), 'utf8');
    ck('#84 no Python dict repr in ' + d + '/' + f, !t.includes("{'"), (t.match(/.{30}\{'.{30}/) || [])[0]);
  }));
  const cls = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'srd52', 'classes.json'), 'utf8')).classes;
  const menu = (c, lv) => ((cls.find(x => x.name === c).levels[lv] || {}).choices || [])
    .filter(ch => ch.label === 'Choose a Fighting Style').map(ch => ch.from.map(o => o.name))[0] || [];
  ck('#84 R4 the Paladin may take Blessed Warrior', menu('Paladin', '2').includes('Blessed Warrior'), menu('Paladin', '2'));
  ck('#84 R4 the Ranger may take Druidic Warrior', menu('Ranger', '2').includes('Druidic Warrior'), menu('Ranger', '2'));
  ck('#84 R4 the Fighter\'s menu is unchanged (the four SRD styles)', menu('Fighter', '1').length === 4, menu('Fighter', '1'));
  // {@dice roll|display} with a 5e-tools prompt template as its roll printed the
  // template ("#$prompt_number:title=Enter Strength Score$# × 7.5 lb.") until #84
  const templated = [];
  fs.readdirSync(path.join(ROOT, 'data')).filter(d => fs.statSync(path.join(ROOT, 'data', d)).isDirectory()).forEach(d =>
    fs.readdirSync(path.join(ROOT, 'data', d)).filter(f => f.endsWith('.json')).forEach(f => {
      if (fs.readFileSync(path.join(ROOT, 'data', d, f), 'utf8').includes('#$')) templated.push(d + '/' + f);
    }));
  ck('#84 no file in any data/<pack>/ holds a 5e-tools prompt template ("#$")', templated.length === 0, templated);
  const carry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'srd52', 'tables.json'), 'utf8')).tables
    .find(t => t.name === 'Carrying Capacity');
  const tiny = carry && carry.rows.find(r => r[0] === 'Tiny');
  ck('#84 the SRD 5.2 Carrying Capacity table\'s Tiny row reads "Str. × 7.5 lb."', !!tiny && tiny[1] === 'Str. × 7.5 lb.', tiny);
}

// ---------- #84: the SRD 5.2 pack
{
  const S = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'srd52', f + '.json'), 'utf8'));
  const n = (f, k) => S(f)[k].length;
  [['backgrounds', 'backgrounds', 4], ['feats', 'feats', 17], ['races', 'races', 9], ['spells', 'spells', 339],
   ['classes', 'classes', 12], ['features', 'features', 38], ['items-magic', 'items', 476], ['items', 'items', 94],
   ['conditions', 'keywords', 21], ['glossary', 'keywords', 115]].forEach(([f, k, want]) =>
    ck('#84 SRD 5.2 has ' + want + ' ' + f, n(f, k) === want, n(f, k)));
  ck('#84 SRD 5.2 has its tables', n('tables', 'tables') > 60, n('tables', 'tables'));
  const cls = S('classes').classes;
  ck('#84 every SRD class has exactly one subclass',
     cls.every(c => Object.keys(c.subclasses || {}).length === 1), cls.map(c => c.name + ':' + Object.keys(c.subclasses || {}).length));
  ck('#84 every SRD file is system "SRD 5.2" and excludes Humblewood',
     fs.readdirSync(path.join(ROOT, 'data', 'srd52')).every(f => {
       const o = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'srd52', f), 'utf8'));
       return o.system === 'SRD 5.2' && JSON.stringify(o.excludeSystems) === '["humblewood"]' && !o._note && !o.requires;
     }));
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'tests', 'fixtures', 'srd-excluded-names.json'), 'utf8'));
  const nonsrd = new Set(fx.nonsrd);
  const named = [];
  fs.readdirSync(path.join(ROOT, 'data', 'srd52')).forEach(f => {
    const o = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'srd52', f), 'utf8'));
    Object.values(o).filter(Array.isArray).forEach(arr => arr.forEach(r => {
      if (!r || typeof r !== 'object') return;
      named.push(String(r.name || r.term || ''));
      Object.keys(r.subclasses || {}).forEach(s => named.push(s));
    }));
  });
  const leaked = named.filter(x => nonsrd.has(x.trim().toLowerCase()));
  ck('#84 no record, subclass or table in SRD 5.2 is named as a non-SRD entry', leaked.length === 0, leaked);
  const allText = fs.readdirSync(path.join(ROOT, 'data', 'srd52'))
    .map(f => fs.readFileSync(path.join(ROOT, 'data', 'srd52', f), 'utf8').toLowerCase()).join('\n');
  const olds = Object.keys(fx.renamed).filter(o => allText.includes(o));
  ck('#84 none of the ' + Object.keys(fx.renamed).length + ' renamed originals appears in SRD 5.2', olds.length === 0, olds);
  ck('#84 every renamed entry is there under its SRD name',
     Object.values(fx.renamed).every(nm => allText.includes(String(nm).toLowerCase())),
     Object.values(fx.renamed).filter(nm => !allText.includes(String(nm).toLowerCase())));
  // R7/#85 R14: homebrew's D&D group resolves with SRD 5.2 alone — since #85
  // that group names SRD 5.2 directly (not the 2024 pack's bundle), so match it
  // by its own pack/file rather than the 2024 pack's.
  const pool = {};
  ['spells', 'classes'].forEach(cat => S(cat)[cat].forEach(e => (pool[cat] = pool[cat] || new Set()).add(String(e.name).toLowerCase())));
  const hb = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'homebrew', 'subclasses.json'), 'utf8')).requires;
  const dnd = hb.find(g => g.file === 'srd52_full.json' || g.pack === 'SRD 5.2');
  const missHb = [];
  ['spells', 'classes'].forEach(cat => ((dnd || {})[cat] || []).forEach(nm => {
    if (!pool[cat].has(String(nm).toLowerCase())) missHb.push(cat + ': ' + nm);
  }));
  ck('#84 R7 every name homebrew\'s D&D group requires is in SRD 5.2', !!dnd && missHb.length === 0, missHb);
  ck('#84 R6 systemOf reads "SRD 5.2" as D&D', X.systemOf({_source: 'SRD 5.2'}) === 'dnd');
  // Review focus 1: species by character system
  X.resetRules();
  X.mergeRules(S('races'), 'races.json');
  X.character = X.blankChar(); X.character.system = 'humblewood';
  ck('#84 RF1 a Humblewood character is offered no SRD species', X.racesForCharacter().length === 0,
     X.racesForCharacter().map(r => r.name));
  X.character.system = 'dnd';
  ck('#84 RF1 a D&D character is offered all nine', X.racesForCharacter().length === 9, X.racesForCharacter().map(r => r.name));
  X.resetRules();
  // Review focus 2: every table anchor resolves
  const tnames = new Set(S('tables').tables.map(t => t.name));
  const anchors = [...allText.matchAll(/\[table: ([^\]]+)\]/g)].map(m => m[1]);
  const lowerNames = new Set([...tnames].map(t => t.toLowerCase()));
  const dangling = [...new Set(anchors.filter(a => !lowerNames.has(a)))];
  ck('#84 RF2 every [Table: X] in SRD 5.2 opens a table it ships', anchors.length > 0 && dangling.length === 0, dangling);
  // Review focus 3: overlay effects and resource trackers survive
  const byName = Object.fromEntries(cls.map(c => [c.name, c]));
  ck('#84 RF3 the Barbarian, Monk and Sorcerer carry their trackers',
     ['Barbarian', 'Monk', 'Sorcerer'].every(c => (byName[c].resources || []).length > 0));
  const fsMenu = Object.values(byName.Fighter.levels).flatMap(l => l.choices || []).find(ch => ch.label === 'Choose a Fighting Style');
  const archery = fsMenu && fsMenu.from.find(o => o.name === 'Archery');
  ck('#84 RF3 the SRD Fighting Style menu is the four SRD styles, Archery with its effect',
     !!fsMenu && fsMenu.from.map(o => o.name).join() === 'Archery,Defense,Great Weapon Fighting,Two-Weapon Fighting'
     && (archery.effects || []).length > 0, fsMenu && fsMenu.from.map(o => o.name));
  // Review focus 4: spells' classes
  const sp = S('spells').spells;
  ck('#84 RF4 every SRD spell has a class list, and none names the Artificer',
     sp.every(s => (s.class || []).length > 0 && !(s.class || []).includes('Artificer')),
     sp.filter(s => !(s.class || []).length || (s.class || []).includes('Artificer')).map(s => s.name));
  // Review focus 5 ("the 2024 pack loads first") held while one registry listed
  // both packs. Since #85 the 2024 pack is in the private repo's registry, so no
  // registry orders the two, and nothing here can check it.
}


// ---------- Settings modal: the sidebar's pages (#107)
ck('six pages, in the order the sidebar lists them',
   X.SET_PAGES.map(p => p.k).join() === 'appearance,display,carrying,extensions,backup,credits');
ck('every page has a title, an icon and a unique key',
   X.SET_PAGES.every(p => p.title && /<(path|circle|rect|ellipse)/.test(p.icon)) && new Set(X.SET_PAGES.map(p => p.k)).size === 6);
ck('only Sheet display and Carrying belong to a character',
   X.SET_PAGES.filter(p => p.scope === 'char').map(p => p.k).join() === 'display,carrying' &&
   X.SET_PAGES.every(p => p.scope === 'char' || p.scope === 'app'));
ck('without a character the character pages are not shown', X.setPagesFor(false).map(p => p.k).join() === 'appearance,extensions,backup,credits');
ck('...with one, all six are', X.setPagesFor(true).length === 6);
ck('the remembered page opens', X.setPageOf('extensions', false) === 'extensions' && X.setPageOf('carrying', true) === 'carrying');
ck('#102 a page remembered as "rules" (Rules data, before Extensions) opens Extensions', X.setPageOf('rules', true) === 'extensions');
ck('a character page with no character open opens Appearance', X.setPageOf('display', false) === 'appearance');
[undefined, null, '', 'nope', 7, {}, '__proto__', 'constructor'].forEach(bad =>
  ck('a stored page of ' + JSON.stringify(bad) + ' opens Appearance', X.setPageOf(bad, true) === 'appearance'));
ck('setPageDef finds a page, and is null for rubbish', (X.setPageDef('extensions') || {}).title === 'Extensions' && X.setPageDef('zzz') === null);
{
  const keys = ['appearance', 'extensions', 'backup', 'credits'];
  ck('↓ moves to the next shown page and wraps', X.setPageStep(keys, 'extensions', 'ArrowDown') === 'backup' && X.setPageStep(keys, 'credits', 'ArrowDown') === 'appearance');
  ck('↑ moves back and wraps', X.setPageStep(keys, 'extensions', 'ArrowUp') === 'appearance' && X.setPageStep(keys, 'appearance', 'ArrowUp') === 'credits');
  ck('Home and End go to the ends', X.setPageStep(keys, 'backup', 'Home') === 'appearance' && X.setPageStep(keys, 'appearance', 'End') === 'credits');
  ck('any other key, or a page not shown, stays put', X.setPageStep(keys, 'extensions', 'x') === 'extensions' && X.setPageStep(keys, 'display', 'ArrowDown') === 'display');
}
{
  const nav = X.setNavHTML(X.setPagesFor(true), 'carrying', {extensions: '<span class="set-cnt">12</span>'});
  ck('the sidebar is a vertical tab list', /role="tablist" aria-orientation="vertical"/.test(nav));
  ck('one tab per page, each tied to its panel',
     (nav.match(/role="tab"/g) || []).length === 6 && /id="setTab-carrying" data-setpage="carrying" aria-controls="setPage-carrying"/.test(nav));
  ck('only the active tab is selected and in the tab order',
     (nav.match(/aria-selected="true"/g) || []).length === 1 && /data-setpage="carrying"[^>]*aria-selected="true" tabindex="0"/.test(nav) &&
     (nav.match(/tabindex="0"/g) || []).length === 1);
  ck('each tab is named, for the icon rail', /aria-label="Sheet display" title="Sheet display"/.test(nav));
  ck('the character pages sit under their caption, set apart from the rest',
     nav.indexOf('data-setpage="appearance"') < nav.indexOf('This character') &&
     nav.indexOf('This character') < nav.indexOf('data-setpage="display"') &&
     /data-setpage="carrying"[\s\S]*?class="set-sep"[\s\S]*?data-setpage="extensions"/.test(nav));
  ck('no caption without a character', !/This character|set-sep/.test(X.setNavHTML(X.setPagesFor(false), 'appearance', {})));
  ck('a badge is drawn only where given', /data-setbadge="extensions"><span class="set-cnt">12<\/span>/.test(nav) && (nav.match(/data-setbadge/g) || []).length === 1);
  ck('...and the tab that carries one is described by it, for a screen reader',
     /data-setpage="extensions"[^>]*aria-describedby="setBadgeDesc-extensions"/.test(nav) && (nav.match(/aria-describedby/g) || []).length === 1);
}
{
  const page = X.setPageHTML('carrying', '<p>x</p>', {active: true, sub: 'For <b>Pib</b>'});
  ck('a page is the tab panel its tab names',
     /<section class="set-page" role="tabpanel" id="setPage-carrying" aria-labelledby="setTab-carrying" data-setpagebody="carrying">/.test(page), page);
  ck('...titled, with its subtitle escaped', /class="set-ptitle">Carrying</.test(page) && page.includes('For &lt;b&gt;Pib&lt;/b&gt;'));
  const off = X.setPageHTML('extensions', '<p>y</p>', {});
  ck('an inactive page is in the dialog, hidden', /data-setpagebody="extensions" hidden>/.test(off) && off.includes('<p>y</p>'));
  ck('an unknown page draws nothing', X.setPageHTML('zzz', '<p>x</p>', {active: true}) === '');
}
{
  const row = X.setRowHTML('Colour current HP', 'Amber at half.', '<button class="switch"></button>', true);
  ck('a row is the name and help, then the control',
     row === '<div class="set-row set-inline"><div class="set-row-txt"><div class="t-lbl">Colour current HP</div><div class="t-sub">Amber at half.</div></div><div class="set-row-ctl"><button class="switch"></button></div></div>', row);
  const plain = X.setRowHTML('Skin', '', '<div class="seg"></div>');
  ck('a row without help has no empty help line, and only an inline row is marked so', !/t-sub/.test(plain) && !/set-inline/.test(plain));
  ck('a group has its heading, escaped',
     X.setGroupHTML('Look & feel', '<p>r</p>') === '<div class="set-grp"><div class="set-grp-h">Look &amp; feel</div><p>r</p></div>');
}
ck('setPage is a setting a file is recognised by', X.SETTINGS_KEYS.includes('setPage'));
ck('...defaulting to Appearance',
   /let settings=\{[^\n]*setPage:"appearance"[^\n]*\};/.test(fs.readFileSync(path.join(ROOT, 'src/js/00-constants.js'), 'utf8')));
X.resetRules();
ck('the Extensions badge shows nothing with nothing loaded, and says so to a screen reader',
   X.rulesNavBadgeHTML() === '<span id="setBadgeDesc-extensions" hidden>none loaded</span>', X.rulesNavBadgeHTML());
X.mergeRules({system: 'XPHB', spells: [{name: 'Bless'}, {name: 'Shield'}]}, 'x.json');
ck('...and counts the pool once something is', X.rulesNavBadgeHTML() === '<span class="set-cnt" title="2 entries">2</span><span id="setBadgeDesc-extensions" hidden>2 entries</span>', X.rulesNavBadgeHTML());
X.resetRules();
ck('entry count is zero with nothing loaded', X.rulesEntryCount() === 0);
X.mergeRules({system: 'XPHB', races: [{name: 'Elf'}, {name: 'Orc'}], spells: [{name: 'Bless'}]}, 'x.json');
ck('entry count sums every category', X.rulesEntryCount() === 3, X.rulesEntryCount());

// ---------- #97: the edit/delete buttons a card's pencil hides carry `ed`, and nothing else does
// CSS hides them (`.ed-off .ed`), so the class IS the feature: a button without it
// never hides, and a play control with it vanishes mid-session. Scanned in the
// source because most of these rows are built straight into the DOM.
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const js = manifest.js.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  // the class attribute of the <button> whose opening tag carries `attr`, valued or not
  // (e.g. `data-jnlback` with no `=` at all)
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const classesOf = attr => {
    const out = [];
    const re = new RegExp(escRe(attr) + '(?=[=\\s>])', 'g');
    let m;
    while ((m = re.exec(js))) {
      const at = m.index;
      const open = js.lastIndexOf('<button', at), close = js.indexOf('>', open);
      if (open >= 0 && close > at) {
        const mm = /class="([^"]*)"/.exec(js.slice(open, at));
        out.push(mm ? mm[1] : '');
      }
    }
    return out;
  };
  const hasEd = cls => cls.split(/\s+/).includes('ed');
  const HIDDEN = ['data-edit-feature', 'data-del-feature', 'data-edit-item', 'data-del-item',
    'data-edit-status', 'data-del-status', 'data-edit-familiar', 'data-del-familiar',
    'data-del-class', 'data-del-race', 'data-del-bg', 'data-edit-attack', 'data-del-attack',
    'data-edit-spell', 'data-del-spell', 'data-res-edit', 'data-res-del', 'data-trkedit',
    'data-jnledit', 'data-jnldel', 'data-noteedit'];
  const KEPT = ['data-fav-feature', 'data-fav-item', 'data-fav-attack', 'data-usefeat', 'data-useitem',
    'data-cast-spell', 'data-prep', 'data-res-dec', 'data-res-inc', 'data-res-reset', 'data-trkdec',
    'data-trkinc', 'data-fitem', 'data-invitem', 'data-atkitem', 'data-notebtn', 'data-combatbtn',
    'data-edtoggle', 'data-edit-gloss', 'data-del-gloss', 'data-view-gloss', 'data-jnlback',
    'data-ammo-fire', 'data-ammo-throw', 'data-ammo-recover', 'data-active-end', 'data-trkreopen',
    'data-trktotal', 'data-status-tick'];
  HIDDEN.forEach(a => {
    const cs = classesOf(a);
    ck('#97 every ' + a + ' button carries ed', cs.length > 0 && cs.every(hasEd), cs);
  });
  KEPT.forEach(a => {
    const cs = classesOf(a);
    ck('#97 no ' + a + ' button carries ed', cs.length > 0 && cs.every(c => !hasEd(c)), cs);
  });
}

// ---------- #97: every card key reaches a card, and the CSS hides what it should
{
  const t = loadHTML();
  const reach = k => k === 'journal' ? t.includes('id="journalCard"')
    : k === 'secnotes' ? /<div class="card" id="notesCard">\s*<div class="label">Section Notes/.test(t)
    // #103: a card may carry a layout class (`card wide`) before data-note
    : new RegExp('<div class="card(?: [a-z-]+)?" data-note="' + k + '"').test(t);
  const lost = X.EDIT_CARDS.filter(k => !reach(k));
  ck('#97 every edit-toggle key reaches a card with a header', lost.length === 0, lost);
  const css = fs.readFileSync(path.join(ROOT, 'src/css/20-cards.css'), 'utf8');
  ck('#97 a hidden card hides its ed buttons', /\.ed-off \.ed\{display:none!important\}/.test(css));
  ck('#97 the toggle has its look', /\.label \.edbtn\{/.test(css) && /\.label \.edbtn\.on\{/.test(css));
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  ck('#97 a tap on the toggle is wired', boot.includes('[data-edtoggle]') && boot.includes('toggleEditCard('));
  const all = fs.readFileSync(path.join(ROOT, 'src/js/66-coins-hp.js'), 'utf8');
  ck('#97 renderAll() draws the toggles after the note icons', /renderNoteIcons\(\);renderEditToggles\(\);/.test(all));
}

/* Slice one element and its whole subtree by counting <tag>/</tag> from the
   tag carrying `needle` (a <div> unless `tag` says otherwise: the sheet header
   is a <header>). The guards that use it used to slice "from this literal to
   the next <div class=\"card\"" and "non-greedy to the first </div>", and both
   encoded the current NESTING as well as the current content — so a block
   moving between cards, or a child turning into a <div>, broke them for
   reasons that had nothing to do with what they guard. */
function block(html, needle, tag) {
  tag = tag || 'div';
  const at = html.lastIndexOf('<' + tag, html.indexOf(needle));
  const re = new RegExp('<' + tag + '\\b|</' + tag + '>', 'g'), close = '</' + tag + '>';
  re.lastIndex = at;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0] === close ? -1 : 1;
    if (depth === 0) return html.slice(at, m.index + m[0].length);
  }
  /* Never return the unterminated tail. Every consumer asks "is X inside
     this block?" with .includes(), so a slice running to end-of-document makes
     those assertions trivially TRUE — the block would swallow the rest of the
     app and pass. Now that the markup lives in seven separately-editable files,
     a fragment losing its closing </section> is a real way to get here. */
  throw new Error('block(): unbalanced <' + tag + '> searching from ' + JSON.stringify(needle));
}

// ---------- section notes: the registry IS the contract
// NOTE_SECTIONS drives the icon injection, the Section Notes card's grouping and
// its headings. If it and the template disagree, a section silently loses its
// icon or a note becomes unreachable — with no error either way.
{
  const t = loadHTML();
  const inTemplate = (t.match(/data-note="([a-z]+)"/g) || []).map(s => s.slice(11, -1));

  // #103: 21 → 18 — the Class, Ancestry & Background and Rest cards are gone
  // #91: 18 → 19, the Party card
  ck('the registry has 19 sections', X.NOTE_SECTIONS.length === 19, X.NOTE_SECTIONS.length);
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
  // #103: the sheet header is the `portrait` section, so the literal-prefix
  // count takes its <header> opening as well as the <div> cards; and the
  // rail, the strip and Features carry one layout class after "card" (the
  // brief's `card rail` / `card strip` / `card wide`) — data-note still
  // straight after the class attribute, which is what the count guards
  // #91: 18 → 19, the Party card
  ck('every data-note is on a card element',
     (t.match(/data-note="[a-z]+"/g) || []).length === 19 &&
     (t.match(/<div class="card(?: [a-z-]+)?" data-note="[a-z]+"/g) || []).length +
     (t.match(/<header class="card sheet-head" data-note="[a-z]+"/g) || []).length === 19,
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

  // registry titles must match the headings they claim to describe. (#103: the
  // skin-dependent `origin` heading is gone; the header's heading is the hidden
  // "Character" caption in its .label.sh-bar, so the label may carry a class
  // and the caption's span.) Each card is sliced to its own end, so a card
  // that lost its .label cannot borrow the next card's.
  X.NOTE_SECTIONS.forEach(s => {
    const needle = 'data-note="' + s.k + '"', at = t.indexOf(needle);
    const tag = at < 0 ? '' : (/^<([a-z]+)/.exec(t.slice(t.lastIndexOf('<', at))) || [])[1];
    const own = tag ? block(t, needle, tag) : '';
    const m = /<div class="label(?: [a-z-]+)?">(?:<span class="sh-cap">)?([^<]*)/.exec(own);
    const text = m ? m[1].replace(/&amp;/g, '&').trim() : '';
    ck('the registry title for "' + s.k + '" matches its heading', text === s.title, {text, title: s.title});
  });
}

// ---------- #103: the Defences card, the Bio tab and its chip rows
{
  const t = loadHTML();
  ck('#103 the Defences card is registered and in the template', t.includes('<div class="card" data-note="defences"') && X.noteDef('defences') && X.noteDef('defences').tab === 'sheet');
  // the {0,200} window the brief gave was too tight for the tab's own svg icon
  // (224 chars from the end of the opening tag to the label) — widened, not removed
  ck('#103 the Story tab reads Bio', /data-tab="story"[^>]*>[\s\S]{0,300}Bio/.test(t) && X.NOTE_TABS.story === 'Bio');
  ck('#103 the Bio card holds alignment and the chip rows',
     /data-note="proficiencies"[\s\S]*data-path="character.alignment"[\s\S]*id="bioLanguages"[\s\S]*id="bioSenses"/.test(t));
}

// ---------- #103: the new Sheet
{
  const t = loadHTML();
  const at = t.indexOf('id="tab-sheet"'), end = t.indexOf('<section class="tabpanel', at + 1), sheet = t.slice(at, end);
  const once = id => (t.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1;
  const ids = ['acDisp', 'initDisp', 'speedDisp', 'sizeDisp', 'passDisp', 'pbDisp', 'hpCur', 'hpMax', 'hpTemp', 'deathSucc', 'deathFail',
    'maxNote', 'starBtn', 'hdWrap', 'abilities', 'skills', 'statLegend', 'familiarCard', 'addFamiliarLink', 'btnShortRest', 'btnLongRest', 'portrait'];
  const missing = ids.filter(id => !once(id));
  ck('#103 every painted id exists exactly once', missing.length === 0, missing);
  ck('#103 the rail holds the vitals, the portrait and the hit dice', /data-note="vitals"[\s\S]*id="portrait"[\s\S]*id="acDisp"[\s\S]*id="hpCur"[\s\S]*id="hdWrap"/.test(sheet));
  ck('#103 the header is the Character section', /<header class="card sheet-head" data-note="portrait"/.test(sheet));
  ck('#103 no Class, Ancestry or Rest card', !/data-note="(class|origin|rest)"/.test(t));
  ck('#103 Attacks is on Inventory', (() => { const i = t.indexOf('id="tab-inventory"'), e = t.indexOf('<section class="tabpanel', i + 1); return t.slice(i, e).includes('data-note="attacks"'); })());
  ck('#103 the registry agrees', !X.noteDef('class') && !X.noteDef('origin') && !X.noteDef('rest') && X.noteDef('attacks').tab === 'inventory' &&
     X.noteDef('portrait').title === 'Character' && !X.EDIT_CARDS.includes('class') && !X.EDIT_CARDS.includes('origin'));
  const css = ['src/css/10-chrome.css', 'src/css/30-sheet.css'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const base = css.indexOf('.sheet-grid{'), m1 = css.indexOf('@media(max-width:1000px)'), m2 = css.indexOf('@media(max-width:700px)');
  ck('#103 three columns, then two, then one — the queries after the base rule', base >= 0 && m1 > base && m2 > m1);
  // the wiki's trap — a query above its base rule silently does nothing — holds
  // for 30-sheet.css's own two queries as well as for the grid's
  const sh = fs.readFileSync(path.join(ROOT, 'src/css/30-sheet.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const stripBase = sh.indexOf('.strip .abilities{'), stripQ = sh.search(/@media\(max-width:1000px\)\{\s*\.strip \.abilities\{/);
  const railBase = sh.search(/(^|\n|\})\.rail\{/), railQ = sh.search(/@media\(max-width:700px\)\{\s*\.rail\{/);
  ck('#103 the strip\'s ≤1000px and the rail\'s ≤700px queries come after their base rules',
     stripBase >= 0 && stripQ > stripBase && railBase >= 0 && railQ > railBase, {stripBase, stripQ, railBase, railQ});
  ck('#103 the Skills display setting is retired', !/segStatStyle|data-statstyle/.test(fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8')));
  // beyond the brief's block: what the grid is and where the cards sit in it
  ck('#103 the grid is rail · middle · right', /\.sheet-grid\{[^}]*grid-template-columns:minmax\(220px,260px\) minmax\(0,1\.3fr\) minmax\(0,1fr\)/.test(css));
  // Mike's layout ruling: the middle and right columns are independent stacks,
  // so Features follows Skills instead of waiting under the taller right column
  ck('#103 the Sheet\'s cards run rail, strip, the middle stack (Skills, Features), the right stack (Defences, Statuses, Resources)',
     /data-note="vitals"[\s\S]*data-note="abilities"[\s\S]*<div class="col-m">\s*(?:<!--[\s\S]*?-->\s*)*<div class="card" data-note="skills"[\s\S]*data-note="features"[\s\S]*<div class="col-r">\s*<div class="card" data-note="defences"[\s\S]*data-note="statuses"[\s\S]*data-note="resources"/.test(sheet));
  {
    const colM = block(sheet, '<div class="col-m">'), colR = block(sheet, '<div class="col-r">');
    ck('#103 the middle stack holds exactly Skills, then Features',
       JSON.stringify(colM.match(/data-note="[a-z]+"/g)) === JSON.stringify(['data-note="skills"', 'data-note="features"']), colM.match(/data-note="[a-z]+"/g));
    ck('#103 the right stack holds exactly Defences, Statuses, Resources',
       JSON.stringify(colR.match(/data-note="[a-z]+"/g)) === JSON.stringify(['data-note="defences"', 'data-note="statuses"', 'data-note="resources"']), colR.match(/data-note="[a-z]+"/g));
    ck('#103 Features is no longer full width', !/class="card wide" data-note="features"/.test(t) && !/\.sheet-grid>\.wide/.test(css));
  }
  {
    const g = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const q1 = g.indexOf('@media(max-width:1000px){\n  .sheet-grid{'), q2 = g.indexOf('@media(max-width:700px){\n  .sheet-grid{');
    const in1 = q1 < 0 ? '' : g.slice(q1, g.indexOf('\n}', q1)), in2 = q2 < 0 ? '' : g.slice(q2, g.indexOf('\n}', q2));
    const base = g.slice(g.indexOf('.sheet-grid{'), q1);
    ck('#103 desktop: the strip over both stacks, the stacks side by side, each its own grid',
       /\.sheet-grid>\.strip\{grid-column:2\/4;grid-row:1\}/.test(base) && /\.sheet-grid>\.col-m\{grid-column:2;grid-row:2\}/.test(base) &&
       /\.sheet-grid>\.col-r\{grid-column:3;grid-row:2\}/.test(base) && /\.sheet-grid>\.col-m,\.sheet-grid>\.col-r\{display:grid;[^}]*align-content:start/.test(base), base);
    ck('#103 no stack is flattened on the desktop grid', !/display:contents/.test(base));
    ck('#103 two columns: the middle stack opens so Features goes full width under the rail, the right stack stays whole',
       /\.sheet-grid>\.col-m\{display:contents\}/.test(in1) && !/\.col-r\{display:contents\}/.test(in1) &&
       /\.sheet-grid \[data-note="features"\]\{grid-column:1\/-1;grid-row:5\}/.test(in1), in1);
    ck('#103 one column: both stacks open, in the phone order',
       /\.sheet-grid>\.col-m,\.sheet-grid>\.col-r\{display:contents\}/.test(in2) &&
       ['defences"\]\{order:3', 'statuses"\]\{order:4', 'skillsCard\{order:5', 'resources"\]\{order:6', 'features"\]\{order:7'].every(x => new RegExp(x).test(in2)), in2);
    ck('#103 the stacks are only ever flattened inside .sheet-grid', !/(^|[}\s,])\.col-[mr]\{display:contents/.test(g) && !/\.stack\{display:contents/.test(g));
  }
  // Mike's second pass: narrow stack cards follow their own width (container
  // queries), never break a resource name mid-word, and keep headings on one line
  {
    const sc = fs.readFileSync(path.join(ROOT, 'src/css/30-sheet.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const cards = fs.readFileSync(path.join(ROOT, 'src/css/20-cards.css'), 'utf8');
    const all = ['00-tokens', '10-chrome', '20-cards', '30-sheet', '45-combat', '47-journal', '50-modal'].map(f => { try { return fs.readFileSync(path.join(ROOT, 'src/css/' + f + '.css'), 'utf8'); } catch (e) { return ''; } }).join('\n');
    ck('#103 the stacks\' cards are the only size containers', /\.sheet-grid>\.col-m>\.card,\.sheet-grid>\.col-r>\.card\{container-type:inline-size\}/.test(sc) &&
       (all.match(/container-type:/g) || []).length === 1);
    ck('#103 a narrow resource row puts its controls under the name', /@container \(max-width:420px\)\{\.res\{flex-wrap:wrap;[^}]*\}\.res-main\{flex:1 0 100%\}/.test(sc));
    ck('#103 a wrapped resource row keeps − count + at the left, restore/edit/delete at the right', /@container \(max-width:420px\)\{\.res\{[^}]*justify-content:flex-start[^}]*\}[^@]*\.res \[data-res-reset\]\{margin-left:auto\}/.test(sc));
    ck('#103 a resource name never breaks mid-word', /\.res-name\{[^}]*overflow-wrap:break-word/.test(cards) && !/\.res-name\{[^}]*overflow-wrap:anywhere/.test(cards));
    ck('#103 the Sheet\'s headings stay on one line; narrow ones tighten and drop the words beside them',
       /\.sheet-grid \.card>\.label\{white-space:nowrap\}/.test(sc) && /@container \(max-width:460px\)\{#featCollapseLbl\{display:none\}\}/.test(sc) &&
       /@container \(max-width:380px\)\{\.card>\.label\{[^}]*\}\.card>\.label \.add\{font-size:0;/.test(sc));
    ck('#103 Collapse all keeps a name without its words', /id="featCollapseAll" title="Collapse or expand all"/.test(t));
  }
  // Mike: the rests read "Short rest" / "Long rest" on a desktop; the icons
  // come back with Icon tabs on, or at the width the tab bar turns to icons
  {
    const hd = block(t, 'id="sheetHead"', 'header');
    ck('#103 each rest button carries its icon and its words, ids and names kept',
       /<button type="button" class="sh-ico sh-rest" id="btnShortRest" title="Short rest" aria-label="Short rest"><span class="sh-rico" aria-hidden="true">&#9749;<\/span><span class="sh-rlbl">Short rest<\/span><\/button>/.test(hd) &&
       /<button type="button" class="sh-ico sh-rest" id="btnLongRest" title="Long rest" aria-label="Long rest"><span class="sh-rico" aria-hidden="true">&#9790;<\/span><span class="sh-rlbl">Long rest<\/span><\/button>/.test(hd), hd.slice(0, 900));
    const sc = fs.readFileSync(path.join(ROOT, 'src/css/30-sheet.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const baseR = sc.indexOf('.sh-rest .sh-rico{display:none}'), narrow = sc.search(/@media\(max-width:860px\)\{\.sh-rest \.sh-rlbl\{display:none\}\.sh-rest \.sh-rico\{display:inline\}\}/);
    ck('#103 by default the words show and the icon hides', baseR >= 0 && !/(^|\})\.sh-rest \.sh-rlbl\{display:none/.test(sc));
    ck('#103 with Icon tabs on, the icon shows and the words hide',
       /html\[data-tabs="icons"\] \.sh-rest \.sh-rlbl\{display:none\}/.test(sc) && /html\[data-tabs="icons"\] \.sh-rest \.sh-rico\{display:inline\}/.test(sc));
    ck('#103 ...and at the tab bar\'s own breakpoint, after the base rule', narrow > baseR && /@media\(max-width:860px\)\{\.tab \.tlbl\{display:none\}/.test(fs.readFileSync(path.join(ROOT, 'src/css/10-chrome.css'), 'utf8')));
    // Mike: Short rest, Long rest, the paw, the star, then the level and XP,
    // then the note button (renderNoteIcons appends it to the end of the .label)
    const lbl = block(hd, '<div class="label sh-bar">');
    const pos = ['id="btnShortRest"', 'id="btnLongRest"', 'id="shPaw"', 'id="starBtn"', 'id="shLevel"'].map(x => lbl.indexOf(x));
    ck('#103 the header row runs Short rest, Long rest, paw, star, level', pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), pos);
    ck('#103 ...the level is the .label\'s last child, so the note button (appended) lands after the XP bar',
       /<span class="sh-level" id="shLevel"><\/span>\s*<\/div>$/.test(lbl), lbl.slice(-120));
    const js = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8')).js.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    ck('#103 renderNoteIcons() appends to the end of the .label', /label\.insertAdjacentHTML\("beforeend",noteBtnHTML\(def\)\)/.test(js));
  }
  ck('#103 the Attacks card leads the Inventory tab, above Equipment',
     (() => { const i = t.indexOf('id="tab-inventory"'); return t.indexOf('data-note="attacks"', i) < t.indexOf('data-note="inventory"', i); })());
  ck('#103 the old .cols / .stack layout is gone from the Sheet', !/class="cols"|class="stack"/.test(sheet));
  const tok = fs.readFileSync(path.join(ROOT, 'src/css/00-tokens.css'), 'utf8');
  ck('#103 the rail\'s tokens are in all four palettes', ['--rail-bg:', '--rail-ink:'].every(k => (tok.match(new RegExp(k, 'g')) || []).length === 4));
  ck('#103 the rail is dark by its tokens', /\.rail\{[^}]*--panel:var\(--rail-bg\)/.test(css) && /\.rail\{[^}]*--ink:var\(--rail-ink\)/.test(css));
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  ck('#103 nothing wires the deleted Class card\'s buttons (an unguarded lookup would leave the sheet inert)',
     !/btnLevelUp|btnLevelDown/.test(boot));
  const alljs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8')).js.map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const gone = ['raceBgBox', 'classBox', 'craceWord', 'btnLevelUp', 'btnLevelDown'].filter(id => alljs.includes(id));
  ck('#103 no script names a removed id', gone.length === 0, gone);
  // the controller's ruling: the combat view keeps an inspiration toggle
  ck('#103 the combat header carries the inspiration toggle, in and out of combat',
     /data-inspire/.test(X.combatHeaderHTML({combatActive: false})) && /data-inspire/.test(X.combatHeaderHTML({combatActive: true, combatRound: 2})) &&
     /aria-pressed="true"/.test(X.combatHeaderHTML({inspiration: true})) && !/btnShortRest|btnLongRest/.test(X.combatHeaderHTML({combatActive: true, combatRound: 2})));
  ck('#103 ...wired to the same toggle as the star', /closest\("\[data-inspire\]"\)\)return toggleInspiration\(\)/.test(boot) && /on\("starBtn","click",toggleInspiration\)/.test(boot));
  X.character = X.blankChar(); X.character.inspiration = false;
  ctx.toggleInspiration();
  ck('#103 toggling it flips the inspiration', X.character.inspiration === true);
  ctx.toggleInspiration();
  ck('#103 ...and back', X.character.inspiration === false);
  ck('#103 recompute() paints the view\'s toggle where it paints the star', /querySelectorAll\("#starBtn,\[data-inspire\]"\)/.test(alljs));
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
  // the combat panel's tab is the crossed swords in .tab-tools, not a word tab
  ck('every panel has a tab', panels.every(n => tabs.indexOf(n) >= 0 || (n === 'combat' && /id="btnCombat"/.test(t))),
     panels.filter(n => tabs.indexOf(n) < 0));
  ck('exactly one tab starts active', (t.match(/class="tab active"/g) || []).length === 1);
  ck('every tab carries a glyph and a word',
     (t.match(/class="tabicon"/g) || []).length === 6 && (t.match(/class="tlbl"/g) || []).length === 6);
  // each icon is aria-hidden and its button carries an aria-label, so a <title>
  // inside the icon would add only a stray tooltip over the word
  ck('no tab icon carries a title element', !/<svg class="tabicon"[^>]*>\s*<title/.test(t));
  ck('the icon-tab mode has a default on the root element', /<html[^>]*data-tabs="labels"/.test(t));
}

// ---------- the ☰ section flyout is retired (#103, Mike 2026-10-24)
// The tabs are organised well enough to need no index. Nothing of it may come
// back half-wired: a stray closeToc() call throws, and a stray #btnToc is a
// button that does nothing. Checked in the built page, and in the sources in
// case the build is stale.
{
  const gone = ['btnToc', 'tocBack', 'tocFly', 'buildToc', 'openToc', 'closeToc', 'tab-toc', 'toc-fly', 'toc-back'];
  const built = fs.readFileSync(path.join(ROOT, 'dist/fieldbook.html'), 'utf8');
  ck('#103 the built page has no ☰ flyout: no btnToc, tocFly, buildToc or their kin',
     gone.every(g => !built.includes(g)), gone.filter(g => built.includes(g)));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const src = loadHTML() + [...manifest.js, ...manifest.css].map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  ck('#103 ...nor do the sources', gone.every(g => !src.includes(g)), gone.filter(g => src.includes(g)));
  ck('#103 the tab bar\'s tool group holds the swords alone',
     /<div class="tab-tools">\s*<button class="tab-combat" id="btnCombat"[^>]*><\/button>\s*<\/div>/.test(loadHTML()));
}

// ---------- back to top (#103)
// A round button fixed in the bottom corner, on every tab and the combat view.
// It shows once the page has scrolled past one screenful, and is unreachable
// (visibility:hidden) when it doesn't.
{
  const t = loadHTML();
  const at = t.indexOf('id="btnToTop"');
  ck('#103 the back-to-top button is in the page, named for a screen reader',
     /<button type="button" class="to-top" id="btnToTop" aria-label="Back to top" title="Back to top">/.test(t));
  // outside the panels (it serves every tab and the combat view), a direct
  // child of <body>, so the print rule's body>*:not(#printArea) hides it too
  const pageEnd = t.indexOf('</div>', t.lastIndexOf('</section>'));
  ck('#103 ...outside every tab panel, after the page and before the script',
     at > pageEnd && pageEnd > t.indexOf('<div class="page">') && at < t.indexOf('<script>'), {at, pageEnd});
  ck('#103 ...its arrow is a line icon, hidden from a screen reader',
     /id="btnToTop"[^>]*><svg viewBox="0 0 24 24" aria-hidden="true"><path [^>]*\/><\/svg><\/button>/.test(t));

  // the threshold: past one viewport height shows it; back above hides it
  ck('#103 hidden at the top', X.toTopShown(0, 800) === false);
  ck('#103 ...and at exactly one screenful', X.toTopShown(800, 800) === false);
  ck('#103 shown past one screenful', X.toTopShown(801, 800) === true && X.toTopShown(5000, 800) === true);
  ck('#103 a fractional scroll position counts', X.toTopShown(800.6, 800) === false && X.toTopShown(801.4, 800) === true);
  const real = {gid: ctx.document.getElementById, qs: ctx.document.querySelector, win: ctx.window};
  const cls = new Set();
  const btn = {classList: {toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); return on; }, contains: c => cls.has(c)}};
  ctx.document.getElementById = id => id === 'btnToTop' ? btn : null;
  ctx.window = Object.assign({}, real.win, {innerHeight: 700, scrollY: 0});
  X.updateToTop();
  ck('#103 updateToTop(): at the top the button has no .show', !cls.has('show'));
  ctx.window.scrollY = 701; X.updateToTop();
  ck('#103 ...scrolled past innerHeight it gains .show', cls.has('show'));
  ctx.window.scrollY = 300; X.updateToTop();
  ck('#103 ...and scrolled back above it loses it', !cls.has('show'));
  ctx.window.innerHeight = 200; X.updateToTop();
  ck('#103 ...measured against the live innerHeight (a resize)', cls.has('show'));

  // the reduced-motion branch, and where focus goes
  let scrolled = null, focused = null;
  const tab = {focus: o => { focused = o; }};
  ctx.document.querySelector = q => q === '.tab.active' ? tab : null;
  ctx.window.scrollTo = o => { scrolled = o; };
  ctx.window.matchMedia = q => ({matches: false, media: q});
  ck('#103 the scroll is smooth by default', X.toTopBehavior() === 'smooth');
  X.scrollToTop();
  ck('#103 the button scrolls to the very top, smoothly', scrolled && scrolled.top === 0 && scrolled.behavior === 'smooth', scrolled);
  ck('#103 ...and puts focus on the active tab without a scroll of its own', focused && focused.preventScroll === true, focused);
  let asked = '';
  ctx.window.matchMedia = q => { asked = q; return {matches: true, media: q}; };
  ck('#103 with reduced motion it jumps instead', X.toTopBehavior() === 'auto' && asked === '(prefers-reduced-motion: reduce)', asked);
  X.scrollToTop();
  ck('#103 ...and the button\'s scroll is that jump', scrolled.top === 0 && scrolled.behavior === 'auto', scrolled);
  ctx.document.getElementById = real.gid; ctx.document.querySelector = real.qs; ctx.window = real.win;

  const js = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8')).js.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  ck('#103 wire(): a passive scroll listener, checked at most once a frame',
     /window\.addEventListener\("scroll",toTopTick,\{passive:true\}\)/.test(js) &&
     /const toTopTick=\(\)=>\{if\(!toTopRaf\)toTopRaf=requestAnimationFrame\(\(\)=>\{toTopRaf=0;updateToTop\(\);\}\);\};/.test(js));
  ck('#103 ...a resize re-checks it, and a click runs scrollToTop()',
     /window\.addEventListener\("resize",toTopTick,\{passive:true\}\)/.test(js) && /on\("btnToTop","click",scrollToTop\)/.test(js));
  ck('#103 in the combat view focus goes to the swords',
     /function scrollToTop\(\)\{[\s\S]*?combatViewOpen\(\)\?document\.getElementById\("btnCombat"\):document\.querySelector\("\.tab\.active"\)/.test(js));

  const raw = fs.readFileSync(path.join(ROOT, 'src/css/10-chrome.css'), 'utf8');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const base = (/(^|\n)\.to-top\{([^}]*)\}/.exec(css) || [])[2] || '';
  const z = +((/z-index:(\d+)/.exec(base) || [])[1]);
  ck('#103 fixed in the bottom-right corner, clear of the notch and the home bar',
     /position:fixed/.test(base) && /right:calc\(16px \+ env\(safe-area-inset-right\)\)/.test(base) && /bottom:calc\(16px \+ env\(safe-area-inset-bottom\)\)/.test(base), base);
  ck('#103 a tap target of at least 44px', +((/width:(\d+)px/.exec(base) || [])[1]) >= 44 && +((/height:(\d+)px/.exec(base) || [])[1]) >= 44, base);
  ck('#103 over the cards, under the note popover and combat header (30), the header popover (35/36) and the modal (80)',
     z > 0 && z < 30, z);
  ck('#103 hidden, it can be neither tapped nor tabbed to',
     /visibility:hidden/.test(base) && /pointer-events:none/.test(base) && /opacity:0/.test(base) &&
     /\.to-top\.show\{[^}]*visibility:visible[^}]*pointer-events:auto/.test(css));
  const all = css.match(/[^{}]*\.to-top[^{}]*\{[^}]*\}/g) || [];
  ck('#103 theme tokens only: no colour literal in any of its rules',
     all.length >= 4 && all.every(r => !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(r.slice(r.indexOf('{')))), all.filter(r => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(r.slice(r.indexOf('{')))));
  ck('#103 print hides it', /@media print\{\.to-top\{display:none!important\}\}/.test(css) &&
     /@media print\{\s*body>\*:not\(#printArea\)\{display:none!important\}/.test(fs.readFileSync(path.join(ROOT, 'src/css/50-modal.css'), 'utf8')));
  ck('#103 it rises above the refused-write strip, where the toast goes',
     /body\.saving-failed \.to-top\{bottom:calc\(130px \+ env\(safe-area-inset-bottom\)\)\}/.test(css) && /body\.saving-failed \.toast\{bottom:130px\}/.test(css));
  const mq = css.search(/@media\(max-width:640px\)\{\s*body:has\(#toast\.show\) \.to-top\{bottom:calc\(26px \+ var\(--toast-h,48px\) \+ 12px\)\}/);
  ck('#103 ...and above a toast on a phone, after its base rule', mq > css.indexOf('.to-top{'), mq);
  ck('#103 toast() records its height for that', /bs\.setProperty\("--toast-h",el\.offsetHeight\+"px"\)/.test(js));
  ck('#103 the page leaves room under its last card', /\.page\{max-width:1160px;margin:0 auto;padding:clamp\(12px,2\.4vw,22px\) clamp\(12px,2\.4vw,22px\) calc\(80px \+ env\(safe-area-inset-bottom\)\)\}/.test(css));
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
     .fgcount was the PILL the old Settings section badges used ("12 entries"),
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
  ck('#99 renderRulesBrowser is in both', onRulesChange.has('renderRulesBrowser') && onLoad.has('renderRulesBrowser'));
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
    /* the group field (#98) renders the id it is given, so an id handed to
       groupFieldHTML() is declared there — checked below that it still is */
    const rg = /groupFieldHTML\(\{id:"([A-Za-z][\w-]*)"/g;
    while ((m = rg.exec(s))) declared.add(m[1]);
    const ru = /getElementById\("([A-Za-z][\w-]*)"\)/g;
    while ((m = ru.exec(s))) used.set(m[1], f);
  });
  const missing = [...used.keys()].filter(k => !declared.has(k));
  const formsJs = fs.readFileSync(path.join(ROOT, 'src/js/80-modal-forms.js'), 'utf8');
  ck('...which counts an id passed to groupFieldHTML() only while it renders it',
     /function groupFieldHTML\(o\)\{[\s\S]*?<input id="\$\{esc\(o\.id\)\}"[\s\S]*?<datalist id="\$\{esc\(o\.list\)\}"/.test(formsJs));
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

  /* block() — slicing one element and its subtree — is defined at the top
     level, above the section-notes registry checks, which use it too. */
  // #103: the Vitals card is the rail; Rest & Recovery is gone (its rests
  // went to the header, its hit dice to the rail)
  const vitals = block(t, 'data-note="vitals"');
  const hpbox = block(t, 'class="rail-hp"');

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
  // #103 (spec §6.2, decision 6): ✓ ○○○ ☠ ○○○ ✗ — successes left of the skull,
  // failures right, in the rail above the badges and the HP bar. (Was
  // "failures come before successes", inside the HP panel under the +/- row.)
  ck('#103 successes come before the skull, failures after it',
     deathBlock.indexOf('id="deathSucc"') < deathBlock.indexOf('class="dskull"') &&
     deathBlock.indexOf('class="dskull"') < deathBlock.indexOf('id="deathFail"'));
  ck('#103 a ✓ and a ✗ mark the two ends', /&#10003;[\s\S]*id="deathSucc"[\s\S]*id="deathFail"[\s\S]*&#10007;/.test(deathBlock));
  ck('#103 the death saves sit in the rail, above the HP bar',
     vitals.includes('id="deathSucc"') && vitals.indexOf('class="death"') < vitals.indexOf('id="hpMinus"'));
  ck('#103 the success set is laid out in reverse so it fills outward from the skull',
     /\.death \.set\[data-kind="succ"\]\{[^}]*row-reverse/.test(sheetCss) &&
     !/\.death \.set\[data-kind="fail"\]\{[^}]*row-reverse/.test(sheetCss));
  // a bare U+FE0E is invisible in source and a colour emoji is wrong on the sheet
  ck('the skull is the text-presentation entity pair', t.includes('&#9760;&#65038;'));

  // starBtn is looked up UNGUARDED nowhere any more, but it is still the id both
  // recompute() and wire() reach for, and there must be exactly one
  ck('exactly one starBtn', (t.match(/id="starBtn"/g) || []).length === 1);
  // #103: the star, both rests, the name and the level moved into the sheet
  // header (spec §6.1). Same ids, so recompute() and wire()'s on(...) still find
  // them. (Was "the star sits in the Vitals label row".)
  {
    const at = t.indexOf('id="sheetHead"');
    const head = at < 0 ? '' : t.slice(t.lastIndexOf('<header', at), t.indexOf('</header>', at) + 9);
    const need = ['data-path="character.name"', 'id="btnShortRest"', 'id="btnLongRest"', 'id="starBtn"', 'id="shSub"', 'id="shLevel"'];
    ck('#103 the sheet header holds the name, both rests, the star, the class line and the level',
       need.every(s => head.includes(s)), need.filter(s => !head.includes(s)));
    ck('#103 ...each exactly once in the whole template',
       need.every(s => (t.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 1),
       need.filter(s => (t.split(s).length - 1) !== 1));
    ck('#103 the header sits in the Sheet tab, above the columns',
       at > t.indexOf('id="tab-sheet"') && at < t.indexOf('class="sheet-grid"', t.indexOf('id="tab-sheet"')));
    ck('#103 its icons row is a .label with a hidden "Character" caption, for the note button',
       /<div class="label sh-bar"><span class="sh-cap">Character<\/span><span class="grow"><\/span>/.test(head));
    ck('#103 the star is not in the rail', !vitals.includes('id="starBtn"'));
    ck('#103 the portrait card keeps no name, Experience or Level field',
       !/data-path="character.xp"/.test(t) && !/id="levelDisp"/.test(t) && /id="levelDisp"/.test(js) && /id="pbDisp"/.test(t));
    ck('#103 the header\'s flyout hooks are wired',
       ['[data-shcls]', '[data-shaddcls]', '[data-shrace]', '[data-shbg]', '[data-shchange]', '[data-shinfo]', '[data-shlevel]', '[data-shpaw]', '[data-shfam]', '[data-shlevelup]']
         .every(h => js.includes('closest("' + h + '")')),
       ['[data-shcls]', '[data-shaddcls]', '[data-shrace]', '[data-shbg]', '[data-shchange]', '[data-shinfo]', '[data-shlevel]', '[data-shpaw]', '[data-shfam]', '[data-shlevelup]']
         .filter(h => !js.includes('closest("' + h + '")')));
    ck('#103 renderClassRace() and renderFamiliars() repaint the header',
       /function renderClassRace\(\)\{[\s\S]*?renderSheetHead\(\)/.test(js) && /function renderFamiliars\(\)\{[\s\S]*?renderSheetHead\(\)[\s\S]*?\n\}/.test(js));
    ck('#103 the header band takes theme tokens only', (() => {
      const r = sheetCss.match(/\.sheet-head\{[^}]*\}/); return !!r && !/#[0-9a-f]{3,6}\b/i.test(r[0]) && /var\(--accent\)/.test(r[0]);
    })());
  }

  // #103: the rail owns the hit points, the death saves, the padlock AND the
  // hit-dice bar (spec §6.2). They sat in two cards — Vitals and Rest &
  // Recovery — until the rail; Rest & Recovery is gone, its rest buttons in the
  // header (asserted there). The hit-dice input and the mode pill live in the
  // spend box (hdSpendHTML in 65-resources.js), not the static template.
  const owned = ['data-hp="cur"', 'data-hp="max"', 'data-hp="temp"', 'id="deathFail"', 'data-hplock', 'id="hdWrap"'];
  ck('#103 the rail owns HP, the death saves, the padlock and the hit-dice bar',
     owned.every(s => vitals.includes(s)), owned.filter(s => !vitals.includes(s)));
  ck('#103 ...with the hit dice under the hit points', vitals.indexOf('id="hpCur"') < vitals.indexOf('id="hdWrap"'));
  ck('the hit-dice bar is written once',
     (t.match(/id="hdWrap"/g) || []).length === 1);
  ck('#103 the hit-dice input and mode pill are built by hdSpendHTML, not the static template',
     !/id="hitdiceInput"/.test(t) && !/data-hdmode/.test(t) &&
     /id="hitdiceInput"/.test(js) && /data-hdmode/.test(js));
  // #103: the HP bar and the hit-dice bar read as a pair: one label rule (the
  // hit-dice label is hdBarHTML's .hd-lbl; HP's is the template's .hp-lbl).
  // (Were the .hp-title/.hd-title panel headings and the two rough-skin frames.)
  ck('#103 HP and Hit Dice share one label rule', /\.hp-lbl,\.hd-lbl\{/.test(sheetCss));
  ck('#103 the HP bar carries its label', /<div class="hp-lbl">Hit points/.test(hpbox));
  ck('#103 the auto/manual pill sits in the spend box\'s foot',
     /<div class="hd-foot">Hit dice <button class="hd-mode" data-hdmode/.test(js));
  ck('#103 the old HP and hit-dice panels are gone', !/class="hpwrap"|class="hd-box"|class="hd-title"|class="hp-title"/.test(t));
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
     /function doLevelUp\(idx\)\{[\s\S]*?character\.hp\.locked=false;renderHP\(\)/.test(cls));
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
  // #103: the bands colour the HP bar's fill (spec §6.2); the Current box
  // still carries the class (renderHP keeps every write it made)
  ck('#103 both bands are styled on the HP bar\'s fill',
     /\.hp-fill\.hp-warn\{background:var\(--warn\)\}/.test(sheetCss) &&
     /\.hp-fill\.hp-danger\{background:var\(--brick\)\}/.test(sheetCss));
  ck('renderHP paints the band onto the Current box',
     /function renderHP\(\)\{[\s\S]*?getElementById\("hpCur"\)[\s\S]{0,140}classList\.toggle\("hp-warn"/.test(js));
  ck('#103 ...and the bar\'s fill: its width from cur / effective max, its band class',
     /function renderHP\(\)\{[\s\S]*?getElementById\("hpFill"\)[\s\S]{0,400}effMaxHP\(\)[\s\S]{0,400}style\.width=[\s\S]{0,200}classList\.toggle\("hp-danger"/.test(js));
  ck('#103 the bar holds the three HP boxes between − and +',
     /id="hpMinus"[\s\S]*class="hp-bar"[\s\S]*id="hpFill"[\s\S]*id="hpCur"[\s\S]*id="hpMax"[\s\S]*id="hpTemp"[\s\S]*id="hpPlus"/.test(hpbox));
  ck('the colour switch is on the Sheet display page, per character',
     /id="swHpColor"/.test(js) && /character\.hpColor/.test(js));
  // spec §11 (#41): the Trackers switch is drawn on the Sheet display page and does something
  ck('the Trackers switch is rendered on the Sheet display page',
     /id="swTrackers"/.test((js.match(/const secDisplay=hasChar\?[\s\S]*?:"";/) || [''])[0]) &&
     /showTrackers\(character\)\?"on":""\}" id="swTrackers"/.test(js));
  ck('...and wired: a tap flips showTrackers, redraws the card and saves',
     /getElementById\("swTrackers"\);if\(b\)b\.addEventListener\("click",\(\)=>\{character\.showTrackers=!showTrackers\(character\);[^}]*renderTrackers\(\);scheduleSave\(\);\}\)/.test(js),
     (js.match(/.{0,40}getElementById\("swTrackers"\).{0,200}/) || [''])[0]);

  // ---- #103: the hit-dice bar and the spend box retire the three styles
  ck('#103 the Hit Dice display setting is retired',
     !/segHdStyle|data-hdstyle/.test(fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8')));
  ck('#103 the three style builders are gone',
     !/function hdFullHTML\(/.test(js) && !/function hdCondensedHTML\(/.test(js) && !/function hdDiceHTML\(/.test(js) &&
     !/function hdPips\(/.test(js) && !/function hdStyle\(\)/.test(js));
  ck('#103 renderHitDice draws the one bar instead', (() => {
     const r = (js.match(/function renderHitDice\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return /hdBarHTML\(pool,hdConMod\(\)\)/.test(r) &&
            !/hdFullHTML|hdDiceHTML|hdCondensedHTML/.test(r);
  })());
  ck('#103 the spend box is what the bar opens',
     /closest\("\[data-hdspend\]"\)\)return openHdSpend\(\)/.test(js));

  // ---- #103: the ability strip (spec §6.4) replaces the two layouts
  // Pure markup building, no numbers: recompute() finds every number by id and
  // every dot by attribute. (Were the Classic / By ability tests — the grouped
  // builders statGroupHTML/statGroupsHTML, statStyle(), its picker and its CSS
  // — retired with the "Skills display" setting, decision 9.)
  ck('#103 the grouped layout and statStyle() are gone',
     !/function statGroupHTML\(/.test(js) && !/function statGroupsHTML\(/.test(js) && !/function statStyle\(\)/.test(js) &&
     !/statStyle\(\)/.test(js) && !/\.agroup/.test(sheetCss + css('45-combat.css')));
  ck('#103 buildAbilities builds the six boxes, each with its modifier, score and save', (() => {
     const a = (js.match(/function buildAbilities\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return /className="ability"/.test(a) && /id="mod-\$\{esc\(k\)\}"/.test(a) && /data-path="character\.abilities\.\$\{esc\(k\)\}"/.test(a) &&
            /data-save="\$\{esc\(k\)\}"/.test(a) && /id="save-\$\{esc\(k\)\}"/.test(a);
  })());
  ck('#103 buildStats no longer hides the Skills card', !/getElementById\("skillsCard"\)/.test(js));
  // the layout is per CHARACTER no more, but a rebuild still blanks the six
  // score inputs, so renderAll keeps building first and refilling after
  ck('renderAll rebuilds the stats', (() => {
     const r = (js.match(/function renderAll\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return /buildStats\(\);/.test(r);
  })());
  ck('...before the data-path loop refills the score boxes', (() => {
     const r = (js.match(/function renderAll\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return r.indexOf('buildStats()') >= 0 &&
            r.indexOf('buildStats()') < r.indexOf('querySelectorAll("[data-path]")');
  })());
  ck('the Skills card keeps its id after data-note',
     loadHTML().includes('<div class="card" data-note="skills" id="skillsCard"'));
  // one legend, in the Skills card — a second copy in JS would drift from the
  // template's
  ck('#103 the legend is placed in the Skills card only, never duplicated',
     /function placeLegend\(/.test(js) && !/class="legend"/.test(js) &&
     /function placeLegend\(\)\{[\s\S]*?data-note="skills"/.test(js) && !/abilities/.test((js.match(/function placeLegend\(\)\{[\s\S]*?\n\}/) || [''])[0]));
  ck('the skill rows are .srow', /\.srow\{display:flex/.test(sheetCss));
  // #103: data-hdroll/data-hddie/data-hd are gone with the three styles —
  // the bar's one control is data-hdspend, already asserted above
  ck('#103 the old pip and dice-token handlers are gone',
     !/closest\("\[data-hdroll\]"\)/.test(js) && !/closest\("\[data-hddie\]"\)/.test(js) &&
     !/closest\("\[data-hd\]"\)/.test(js));

  // ---------- #103: familiars open from the header's paw (spec §6.6)
  // The card stays in the DOM, hidden on the Sheet, so the combat view can
  // still take it and its note keeps its key. The card and the old add button
  // are looked up UNGUARDED (renderFamiliars(), wire()) — a missing id throws
  // and takes out every listener registered after it. (Were "familiars moved
  // into the left sidebar", "below Class", the left/right stack checks and the
  // ≤820px flatten-and-sink rules: the stacks are gone.)
  ck('both familiar ids exist exactly once (both are looked up unguarded)',
     ['familiarCard', 'addFamiliarLink', 'familiarList'].every(id =>
       (t.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1));
  ck('the familiars card keeps the attribute order the card count needs',
     /<div class="card" data-note="familiars" id="familiarCard"/.test(t));
  ck('#103 the familiars card starts hidden, and the old add button stays hidden',
     /data-note="familiars" id="familiarCard" style="display:none"/.test(t) && /<button class="mini" id="addFamiliarLink" hidden/.test(t));
  ck('#103 renderFamiliars keeps the card hidden on the Sheet', (() => {
     const r = (js.match(/function renderFamiliars\(\)\{[\s\S]*?\n\}/) || [''])[0];
     return /card\.style\.display="none"/.test(r) && !/card\.style\.display=has/.test(r);
  })());
  ck('#103 a jump to the familiars note opens the paw\'s flyout',
     /function jumpToNote\(k\)\{[\s\S]*?k==="familiars"[\s\S]*?openShFly\("fam"/.test(js));
  ck('#103 the combat view still shows the card, in its saved place',
     /#combatView #activeSpellCard,#combatView #familiarCard\{display:block!important\}/.test(css('45-combat.css')) &&
     /#combatView #familiarCard\{order:0\}/.test(css('45-combat.css')));
  ck('#103 the stacks\' phone flattening is gone with them',
     !/\.stack\{display:contents\}/.test(chromeCss) && !/#familiarCard,#addFamiliarLink\{order:1\}/.test(chromeCss));
  ck('the Bio tab keeps its two columns', /\.cols\{display:grid;[^}]*grid-template-columns:minmax\(0,320px\) minmax\(0,1fr\)/.test(chromeCss) &&
     /class="cols"/.test(t.slice(t.indexOf('id="tab-story"'))));

  // The familiar row may wrap (it is drawn in the familiar's modal too)
  ck('the familiar row may wrap in the narrow column',
     /#familiarList \.item \.top\{flex-wrap:wrap\}/.test(sheetCss));
  ck('...and the fix is scoped, so Statuses is untouched',
     !/^\.item \.top\{[^}]*flex-wrap/m.test(sheetCss));
  ck('the summoned pill does not break inside its own border',
     /#familiarList \.fam-state\{white-space:nowrap\}/.test(sheetCss));
  // A hidden card (familiars, Active Spells) is a zero-height box: a jump to
  // one lands nowhere. jumpToNote checks before it scrolls. (The retired ☰
  // section menu made the same check; this one survives it, #103.)
  ck('a note jump to a card that is not showing goes to the top instead',
     /function jumpToNote\(k\)\{[\s\S]*?if\(!card\|\|card\.offsetParent===null\)\{window\.scrollTo\(\{top:0\}\);return;\}/.test(js));

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
     /if\(e\.target===modal&&both&&settings\.backdropClose===true\)dismissModal\(\)/.test(js) &&
     /Escape"&&modal\.classList\.contains\("open"\)\)dismissModal\(\)/.test(js));
  /* #106: a click outside closes a dialog only when Settings says so, off by
     default — a stray click, or a tap to hide a phone's keyboard, lost the
     form. × and Escape are untouched above. And only a click that began on the
     backdrop, so a selection dragged out of a field doesn't close it. */
  ck('the backdrop closes a dialog only with the setting on, and only for a click pressed and let go on it',
     /modal\.addEventListener\("pointerdown",e=>\{_downOnBackdrop=e\.target===modal;\}\)/.test(js) &&
     /modal\.addEventListener\("pointerup",e=>\{_upOnBackdrop=e\.target===modal;\}\)/.test(js) &&
     /const both=_downOnBackdrop&&_upOnBackdrop;_downOnBackdrop=_upOnBackdrop=false;/.test(js) &&
     (js.match(/e\.target===modal/g) || []).length === 3);
  ck('...the setting is off by default, for a new player and one whose settings predate it',
     /let settings=\{[^\n]*backdropClose:false[^\n]*\};/.test(js) && /settings\.backdropClose===true\)dismissModal/.test(js));
  ck('...Settings has its switch, which saves it, and a settings file carries it',
     /class="switch \$\{settings\.backdropClose===true\?"on":""\}" id="swBackdrop" role="switch" aria-checked="\$\{settings\.backdropClose===true\?"true":"false"\}"/.test(js) &&
     /getElementById\("swBackdrop"\)\.addEventListener\("click",e=>\{settings\.backdropClose=settings\.backdropClose!==true;[^\n]*saveSettings\(\);\}\)/.test(js) &&
     /const SETTINGS_KEYS=\[[^\]]*"backdropClose"/.test(js));
  /* #107: Settings opens wide. The class is set or cleared on EVERY open, as the
     emblem slot is, so a dialog opened from Settings never inherits the width. */
  ck('openModal sets or clears the wide class on every open',
     /function openModal\(title,html,icon,opts\)\{[^\n]*\.classList\.toggle\("wide",!!\(opts&&opts\.wide\)\)/.test(js));
  ck('...and the wide dialog has its width',
     /\.modal\.wide\{width:min\(820px,100%\)[;}]/.test(fs.readFileSync(path.join(ROOT, 'src/css/50-modal.css'), 'utf8')));
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

  // ---------- every shipped class starts with its skills (#67)
  // A class's first-level skills are its fixed `skills` or a level-1 `skill`
  // choice — the one addClass() offers a first class. The converter dropped the
  // 2024 Bard's "any 3", so it shipped with neither and a first-class Bard was
  // offered no skills. Every class in every pack, each name one the sheet knows.
  {
    const dirs = fs.readdirSync(path.join(ROOT, 'data'))
      .filter(d => fs.existsSync(path.join(ROOT, 'data', d, 'classes.json')));
    ck('class packs found', dirs.includes('srd52'), dirs);
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
  // (The Humblewood extractor's and pack's own checks moved to the private repo's
  // suite with them, #85.)
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
  /* #102: the Extensions page is drawn by extPageHTML() in 89-extensions.js
     and wired there by wireExtPage(), delegated from #extPage */
  const ext = fs.readFileSync(path.join(ROOT, 'src/js/89-extensions.js'), 'utf8');
  const extMarkup = ext.slice(ext.indexOf('function extSecHTML('), ext.indexOf('function extRowFor('));
  const extWire = ext.slice(ext.indexOf('function wireExtPage('));
  const extIds = new Set(); { const re = /\bid="([A-Za-z][\w-]*)"/g; let m; while ((m = re.exec(extMarkup))) extIds.add(m[1]); }
  extIds.forEach(k => declared.add(k));
  const missing = [...used].filter(k => !declared.has(k));
  ck('every control openSettings looks up exists in its markup', missing.length === 0, missing);
  // ids the modal renders but never wires are dead weight or a forgotten handler
  const inert = new Set(['rulesStatus', 'extSaveErr', 'encHint', 'setSections', 'extPage']);
  const unwired = [...declared].filter(k => !used.has(k) && !inert.has(k) &&
    !(extIds.has(k) && (extWire.includes('"#' + k + '"') || extWire.includes('getElementById("' + k + '")'))));
  ck('every control it renders is wired up somewhere', unwired.length === 0, unwired);
  ck('#102 the Extensions page draws each of the hooks Task 6 relies on',
    ['extPage', 'extUpdateAll', 'extCheckNow', 'extManual', 'extAddUrl', 'extAddGo', 'extRemoveRules', 'extRemoveSources'].every(k => extIds.has(k)),
    [...extIds]);
  // the status line is a live region: Settings draws it beside the page, never inside the repaint (#102 Task 5 review, minor 6)
  ck('#102 #rulesStatus sits outside #extPage', !extIds.has('rulesStatus') && declared.has('rulesStatus'));
}

// ---------- Settings modal: each control on its page (#107)
{
  const src = fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8');
  const sec = name => (src.match(new RegExp('const ' + name + '=[\\s\\S]*?\\n  const ')) || [''])[0];
  const on = (name, ids) => ids.every(id => sec(name).includes('id="' + id + '"'));
  ck('Appearance holds the look and the interface switches', on('secAppearance', ['segSkin', 'segTheme', 'swRough', 'swTabIcons', 'swBackdrop']));
  ck('Sheet display holds the card choices', on('secDisplay', ['swHpColor', 'swTrackers']));
  ck('#103 ...and the advancement choice and the familiars icon', on('secDisplay', ['segAdv', 'swFamiliars']));
  ck('Carrying holds size, encumbrance, coins and the live line', on('secCarrying', ['setSize', 'segEnc', 'swCoinWeight', 'encHint']));
  ck('#102 Extensions is the extensions page, its status line and the sheet check (no #fileRules)',
     /const secRules=extPageHTML\(\)\+/.test(sec('secRules')) && on('secRules', ['rulesStatus', 'btnCharUpdate']) && !/fileRules/.test(src));
  ck('#102 the old source list, Fetch all, Get templates and Clear all are gone',
     !/srcList|newSrc|addSrc|btnFetchRules|btnImportRules|btnRulesTemplate|btnClearRules|id="rulesData"|renderSrcRows|downloadRulesTemplates/.test(src));
  ck('Backup holds the library and the settings file', on('secBackup', ['swHome', 'btnExportSettings', 'btnImportSettings', 'setImpStatus']));
  ck('encumbrance is a segmented choice now, not a dropdown', !/id="setEnc"/.test(src) &&
     /character\.encumbrance=b\.dataset\.enc;/.test(src) && ['none', 'standard', 'variant'].every(v => sec('secCarrying').includes('["' + v + '",')));
  ck('every switch on the dialog says its state to a screen reader',
     // 8 since #52 added the per-character tabs switch (one literal occurrence in tabsGroupHTML)
     (src.match(/class="switch /g) || []).length === 8 && (src.match(/role="switch" aria-checked=/g) || []).length === 8 &&
     /const s=e\.target\.closest\("\.switch"\);if\(s\)s\.setAttribute\("aria-checked",s\.classList\.contains\("on"\)\?"true":"false"\);/.test(src));
  ck('Settings opens wide, on the remembered page; a dialog opened from it does not',
     /openModal\("Settings",[\s\S]*?\{wide:true\}\);/.test(src) && /setPageOf\(settings\.setPage,hasChar\)/.test(src) &&
     /openModal\("Import settings",settingsImportQuestionHTML\(imp\)\);/.test(src));
  ck('the arrow keys step over the SHOWN pages only', /setPageStep\(pages\.map\(p=>p\.k\),t\.dataset\.setpage,e\.key\)/.test(src));
  ck('switching a page shows it, remembers it and starts it at the top',
     /p\.hidden=p\.dataset\.setpagebody!==k;/.test(src) && /settings\.setPage=k;saveSettings\(\);/.test(src) && /const pg=secs\.querySelector\("\.set-pages"\);if\(pg\)pg\.scrollTop=0;/.test(src));
  /* spec §7: a duplicated id would let getElementById wire one copy and leave the
     other dead; the two-way check above collects ids into a Set, so count here */
  {
    /* #102: with the Extensions page's own markup, which openSettings() draws */
    const extSrc = fs.readFileSync(path.join(ROOT, 'src/js/89-extensions.js'), 'utf8');
    const body = src.slice(src.indexOf('function openSettings()'), src.indexOf('function encSettingsHint(')) +
      extSrc.slice(extSrc.indexOf('function extSecHTML('), extSrc.indexOf('function extRowFor('));
    const counts = {};
    (body.match(/\bid="([A-Za-z][\w-]*)"/g) || []).forEach(m => { const k = m.slice(4, -1); counts[k] = (counts[k] || 0) + 1; });
    const twice = Object.keys(counts).filter(k => counts[k] > 1);
    ck('every control id in the Settings markup appears exactly once', Object.keys(counts).length > 25 && twice.length === 0, twice);
  }
  ck('the old folding sections are gone', !/SET_SECTIONS|setSecHTML|setSecOpen|data-setsec=/.test(src));
  /* review: Encumbrance was a <select>, which announces its value; as buttons it
     must say which is pressed — and so must every segmented choice here */
  ck('every segmented choice on the dialog says which button is pressed',
     // #103: segStatStyle retired with the Skills display setting; segAdv took its place
     ['segSkin', 'segTheme', 'segAdv', 'segEnc'].every(id => /aria-pressed="\$\{/.test((src.match(new RegExp('id="' + id + '"[\\s\\S]{0,700}')) || [''])[0])) &&
     /const g=e\.target\.closest\("\.seg"\);if\(g\)g\.querySelectorAll\("button"\)\.forEach\(b=>b\.setAttribute\("aria-pressed",b\.classList\.contains\("on"\)\?"true":"false"\)\);/.test(src));
  ck('the badge refresh targets the sidebar',
     /querySelector\('\[data-setbadge="extensions"\]'\)[\s\S]{0,40}innerHTML=rulesNavBadgeHTML\(\)/.test(fs.readFileSync(path.join(ROOT, 'src/js/89-rules-merge.js'), 'utf8')));
  const mcss = fs.readFileSync(path.join(ROOT, 'src/css/50-modal.css'), 'utf8');
  /* review: a sticky sidebar inside one scroller was cut off on a landscape phone
     until the page was scrolled to its end; each pane scrolls on its own now */
  ck('the dialog is two panes, each scrolling on its own, so the sidebar stays reachable',
     /\.set-wrap\{display:grid;grid-template-columns:184px minmax\(0,1fr\);grid-template-rows:minmax\(0,1fr\)/.test(mcss) &&
     /\.modal\.wide \.m-body\{overflow:hidden;display:flex;flex-direction:column/.test(mcss) &&
     /\.set-nav\{[^}]*overflow-y:auto/.test(mcss) && /\.set-pages\{[^}]*overflow-y:auto/.test(mcss) && !/\.set-nav\{position:sticky/.test(mcss));
  ck('a hidden page takes no room', /\.set-page\[hidden\]\{display:none\}/.test(mcss));
  /* Mike, after #107: the page pane's scrollbar sat on its controls. The pane is
     the scroller, so its own right padding is what keeps a scrollbar (an overlay
     one draws over content) off Clear all, Add and the delete buttons; the body
     gives that room back so the content's right edge stays 18px from the dialog's */
  ck('the page pane keeps its content clear of its scrollbar',
     /\.set-pages\{[^}]*padding-right:14px/.test(mcss) && /\.set-pages\{[^}]*scrollbar-gutter:stable/.test(mcss) &&
     /\.modal\.wide \.m-body\{[^}]*padding-right:4px/.test(mcss));
  /* a page shorter than the last one used to shrink the dialog, which re-centred
     and moved the sidebar under the pointer between clicks */
  ck('the wide dialog keeps one height, so switching pages never moves the sidebar',
     /\.modal\.wide\{[^}]*height:min\(680px,90dvh\)/.test(mcss));
  ck('the sidebar becomes an icon rail with Icon tabs on, and on a narrow screen',
     /html\[data-tabs="icons"\] \.set-wrap\{grid-template-columns:52px minmax\(0,1fr\)/.test(mcss) &&
     /@media\(max-width:640px\)\{[^@]*\.set-wrap\{grid-template-columns:52px minmax\(0,1fr\)/.test(mcss));
  ck('on a narrow screen a choice drops below its name, a switch stays beside it',
     /@media\(max-width:640px\)\{[^@]*\.set-row:not\(\.set-inline\)\{flex-direction:column/.test(mcss));
  ck('a long name in a page subtitle wraps', /\.m-body p\.set-psub\{[^}]*overflow-wrap:anywhere/.test(mcss));
  ck('the folding-section styles are gone', !/#setSections \.fghead|\.setsec-body/.test(mcss));
}

// ---------- #99: the Rules tab's shell, and what left with the old cards
{
  const t = loadHTML();
  const at = t.indexOf('id="tab-rules"'), end = t.indexOf('<section class="tabpanel', at + 1);
  const panel = at < 0 ? '' : t.slice(at, end < 0 ? undefined : end);
  ck('#99 the Rules tab holds the browser',
     ['id="rbCard"', 'data-screen="list"', 'id="rbSide"', 'id="rbMain"', 'id="rbEmpty"', 'id="rbSearch"', 'id="rbRulesFiles"']
       .every(s => panel.includes(s)), panel.slice(0, 500));
  ck('#99 the old cards are gone',
     !/id="(glossSearch|tablesSearch|glossList|tablesList|glossRulesFiles|tablesRulesFiles)"|data-rulessec|data-rulesbody/.test(t));
  const js = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8')).js
    .map(p => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  ck('#99 nothing calls the old renderers or folds',
     !/\b(renderGloss|renderTables|renderRulesSections|toggleRulesSec|rulesSecOpen|setRulesSecOpen)\s*\(|RULES_SECS|rulesCollapse/.test(js));
  const settingsJs = fs.readFileSync(path.join(ROOT, 'src/js/88-settings.js'), 'utf8');
  ck('#99 the category is a setting that exports, the old folds are not',
     /SETTINGS_KEYS=\[[^\]]*"rulesCat"/.test(settingsJs) && !/SETTINGS_KEYS=\[[^\]]*"rulesCollapse"/.test(settingsJs));
  const css = fs.readFileSync(path.join(ROOT, 'src/css/35-tables.css'), 'utf8');
  ck('#99 narrow screens show one pane at a time',
     /@media\(max-width:640px\)\{[\s\S]*#rbCard\[data-screen="list"\] \.rb-main\{display:none\}[\s\S]*#rbCard\[data-screen="table"\] \.rb-side\{display:none\}/.test(css));
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  const at2 = s => boot.indexOf(s);
  ck('#99 the glossary\'s own buttons are matched before the row they sit in',
     at2('[data-edit-gloss]') > 0 && at2('[data-del-gloss]') > 0 && at2('[data-rbrow]') > at2('[data-del-gloss]'));
  ck('#99 every browser tap is wired',
     ['[data-rbcat]', '[data-rbback]', '[data-rbsort]', '[data-rbfacet]', '[data-rbtoggle]', '[data-rbfilters]', '[data-rbclear]',
      '[data-rbmore]', '[data-rbhit]', '[data-rbmorein]', '[data-rbrow]', '#btnAddGloss', '#rbImport'].every(s => boot.includes(s)));
  ck('#99 typing in a category\'s box repaints the body only',
     /rbCatSearch[\s\S]{0,200}rbRefreshBody\(\)/.test(boot) && !/rbCatSearch[\s\S]{0,200}renderRulesBrowser\(\)/.test(boot));
  const sheetJs = fs.readFileSync(path.join(ROOT, 'src/js/40-sheet.js'), 'utf8');
  // final-review (a): the tab always opens on the category list, never the
  // last table a previous visit left on
  ck('#99 (a) entering the Rules tab from elsewhere resets to the category list',
     /function selectTab\(name\)\{[\s\S]{0,700}if\(name==="rules"&&was!=="rules"\)rbToList\(\)/.test(sheetJs));
}

// ---------- the combat view is a TAB: its icon in the tab bar, its panel in the page
// It was a full-screen overlay; in play that covered the tabs a player wanted to
// glance at, so it became a tab with the same header, cards and arranging.
{
  const t = loadHTML();
  const tools = t.indexOf('<div class="tab-tools">'), combat = t.indexOf('id="btnCombat"'),
        toolsEnd = t.indexOf('</div>', tools), page = t.indexOf('<div class="page">'),
        panel = t.indexOf('id="tab-combat"'), view = t.indexOf('id="combatView"');
  ck('the combat button sits in the pinned tab-bar group',
     tools >= 0 && tools < combat && combat < toolsEnd && toolsEnd < page);
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
  ck('#80 nothing wires a ✕ or a ☰ of the Combat tab\'s own', !/#cvClose|#cvToc/.test(bootJs) && !/cvClose|cvToc/.test(cjs));
  ck('#80 a removal from the view with no neighbour left, and a closing modal, hand focus to the swords',
     /function cvReturnFocus[\s\S]*?getElementById\("btnCombat"\)/.test(cjs) &&
     /combatViewOpen\(\)\)\{const c=document\.getElementById\("btnCombat"\)/.test(fs.readFileSync(path.join(ROOT, 'src/js/80-modal-forms.js'), 'utf8')));
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
  ck('the Rules search has its clear button', boxed(html, 'rbSearch'));
  ck('the journal search has its clear button', boxed(html, 'jnlSearch'));
  {
    const boot = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '90-boot.js'), 'utf8');
    ck('#95 a tap on a checkbox is wired, and finds its owner before acting',
       /t\.closest\("\[data-ck\]"\)[^\n]*jnlToggleCheckbox\(n\)[^\n]*noteToggleCheckbox\(/.test(boot), 'no [data-ck] handler in wire()');
    ck('#95 ...and a Story field is its third owner, found by its #rt- host before the section note',
       /t\.closest\("\[data-ck\]"\)[^\n]*closest\('\[id\^="rt-"\]'\)[^\n]*rtToggleCheckbox\([a-z]+\.id\.slice\(3\),n\)[^\n]*noteToggleCheckbox\(/.test(boot), 'no rt- branch in the [data-ck] handler');
    ck('#95 Insert checkbox is wired in the journal editor', /t\.closest\("\[data-jnlck\]"\)\)return insertJournalCheckbox\(\);/.test(boot));
    const notes = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '87-notes.js'), 'utf8');
    ck('#95 the section-note editor has Insert checkbox, wired to its own textarea',
       /id="noteCk">Insert checkbox<\/button>/.test(notes) && /getElementById\("noteCk"\)[^\n]*insertCheckboxInto\("noteText"\)/.test(notes));
    ck('#93 the Σ button toggles the total, and the header fold ignores it, by click and by key',
       /t\.closest\("\[data-trktotal\]"\)[^\n]*toggleTrkTotal\(/.test(boot) &&
       /closest\("\[data-trkgroup\]"\)\)&&!t\.closest\("\[data-trktotal\]"\)/.test(boot) &&
       /closest\("\[data-trkgroup\]"\);if\(g&&!e\.target\.closest\("\[data-trktotal\]"\)\)/.test(boot));
    const jcss = require('fs').readFileSync(require('path').join(__dirname, '..', 'css', '47-journal.css'), 'utf8');
    ck('#94 open tracker groups are wrapping rows of tiles, and Completed stays a list',
       /\.trk-group\{display:flex;flex-wrap:wrap/.test(jcss) && /\.trk\{flex:1 1 140px;max-width:280px/.test(jcss) && /\.trk-done \.trk-group\{display:block\}/.test(jcss));
    ck('#94 "of N" drops to its own line so it never crowds the −/count/+ row off a two-column phone width, and the buttons stay a comfortable tap target',
       /\.trk-of\{flex-basis:100%/.test(jcss) && /\.trk-ctl \.res-btn\{width:30px;height:30px\}/.test(jcss));
  }
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
     /function openModal\(title,html,icon,opts\)\{[^}]*getElementById\("mTitle"\)\.textContent=title;/.test(
       fs.readFileSync(path.join(ROOT, 'src/js/80-modal-forms.js'), 'utf8')));
}

{
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  ck('#99 a subclass link from a reference window opens in reference mode',
     /data-sub-info[\s\S]{0,200}subRef\?\{ref:true\}/.test(boot));
}

// ---------- #99: the Rules tab browser, pure half (86-rules-browser.js)
{
  const savedRules = X.rules, savedChar = X.character, savedCat = X.settings.rulesCat, savedOM = ctx.openModal;
  let modal = null;
  ctx.openModal = (title, html) => { modal = {title, html}; };
  const pack = () => ({name: 'T',
    classes: [{_id: 'c1', name: 'Fighter', hitDie: 'd10', _source: 'SRD', subclasses: {Champion: {description: 'Crit.'}}},
              {_id: 'c2', name: 'Wizard', hitDie: 'd6', _source: 'SRD'}],
    subclasses: [{_id: 'sc1', class: 'Fighter', name: 'Battle Master', _source: 'XPHB'}],
    races: [{_id: 'r1', name: 'Elf', size: 'Medium', speed: '30 ft', description: 'Old.', _source: 'SRD'},
            {_id: 'r2', name: 'Elf', size: 'Medium', speed: '35 ft', description: 'New.', _source: 'XPHB'}],
    backgrounds: [{_id: 'b1', name: 'Acolyte', feat: 'Magic Initiate', _source: 'SRD'}],
    feats: [{_id: 'f1', name: 'Alert', description: 'Origin feat\nx', _source: 'SRD'},
            {_id: 'f2', name: 'Grappler', description: 'General feat · Prerequisite: Level 4+\ny', _source: 'XPHB'}],
    features: [{_id: 't1', name: 'Darkvision', source: 'Elf', _source: 'SRD'}],
    spells: [{_id: 's1', name: 'Fire Bolt', level: 0, meta: 'Evocation · Action · 120 feet', class: ['Wizard'], _source: 'SRD'},
             {_id: 's2', name: 'Bless', level: 1, meta: 'Enchantment · Action · 30 feet · Concentration', class: ['Cleric'], _source: 'SRD'},
             {_id: 's3', name: 'Fireball', level: 3, meta: 'Evocation · Action · 150 feet', class: ['Wizard'], _source: 'SRD'}],
    items: [{_id: 'i1', name: 'Rope', cost: '1 gp', _source: 'SRD'}, {_id: 'i2', name: 'Plate', category: 'Armor', cost: '1,500 gp', _source: 'SRD'},
            {_id: 'i3', name: 'Wand', category: 'Wondrous Item', rarity: 'Rare', _source: 'SRD'}, {_id: 'i4', name: 'Torch', cost: '1 cp', _source: 'SRD'}],
    keywords: [{_id: 'k1', term: 'Blinded', text: 'x', cond: true, _source: 'SRD'}, {_id: 'k2', term: 'Advantage', text: 'y', _source: 'SRD'},
               {term: 5}, null, 'Grappled'],
    tables: [{_id: 'tb1', name: 'Fighter Features', owner: 'Fighter', ownerKind: 'class', cols: ['Level'], rows: [['1'], ['2']], _source: 'SRD'},
             {_id: 'tb2', name: 'Trinkets', ownerKind: 'rule', rows: [['1']], _source: 'SRD'},
             {_id: 'tb3', name: 'Odd', rows: 'x', _source: 'SRD'}]});
  const fresh = () => { X.rules = pack(); ctx.recomputeDups(); X.rbUI.per = {}; X.rbUI.q = '';
    X.character = X.blankChar(); X.character.classes = [{name: 'Cleric', level: 1}];
    X.character.glossary = [{id: 'own1', term: 'Hexed', type: 'text', text: 'm'}, {id: 'own0', type: 'text', text: 'no term'}]; };
  fresh();
  const keys = () => X.rbShown().map(x => x.cat.k);
  const rows = k => X.rbShown().find(x => x.cat.k === k).rows;
  const names = rs => JSON.stringify(rs.map(r => r.name));

  ck('#99 the categories, in order', JSON.stringify(keys()) ===
     '["classes","subclasses","races","backgrounds","feats","features","spells","items","conditions","glossary","tables"]', keys());
  ck('#99 every category: Name first, a Source column, a window', X.RB_CATS.every(c =>
     c.cols[0].key === 'name' && c.cols.some(x => x.key === 'src') && typeof c.open === 'function'));
  X.rules.feats = [];
  ck('#99 an empty category is not listed', !keys().includes('feats'));
  X.rules = {name: 'none'}; ctx.recomputeDups(); X.character.glossary = [];
  ck('#99 ...but the Glossary always is, for its + Add', JSON.stringify(keys()) === '["glossary"]', keys());
  fresh();

  ck('#99 subclasses: the class\'s own and the loose ones, by class then name',
     names(X.rbSorted(X.rbCat('subclasses'), X.rbState('subclasses'), rows('subclasses'))) === '["Battle Master","Champion"]');
  ck('#99 same-named species from two packs are two rows', names(rows('races')) === '["Elf (SRD)","Elf (XPHB)"]' &&
     JSON.stringify(rows('races').map(r => r.id)) === '["r1","r2"]');
  ck('#99 Conditions are the glossary terms marked cond', names(rows('conditions')) === '["Blinded"]');
  ck('#99 Glossary: the other pack terms and your own, malformed ones skipped', names(rows('glossary')) === '["Advantage","Hexed",""]' &&
     rows('glossary').filter(r => r.own).length === 2 && rows('glossary')[1].src === 'Yours');
  ck('#99 a table whose rows are not a list counts 0', X.RB_CATS.find(c => c.k === 'tables').cols.find(c => c.key === 'rows').get(rows('tables')[2]) === '0');
  ck('#99 tables sort by kind, then name', names(X.rbSorted(X.rbCat('tables'), X.rbState('tables'), rows('tables'))) === '["Fighter Features","Trinkets","Odd"]');

  const sp = X.rbCat('spells');
  ck('#99 spells sort by level, cantrips first', names(X.rbSorted(sp, X.rbState('spells'), rows('spells'))) === '["Fire Bolt","Bless","Fireball"]');
  const body = X.rbBodyHTML(sp, rows('spells'), X.rbState('spells'), X.rbFacets(sp, rows('spells')));
  ck('#99 the sorted column says so', /<th aria-sort="ascending"><button type="button" class="rb-sort" data-rbsort="lvl">Level ▲/.test(body), body.slice(0, 600));
  X.rbSortBy('spells', 'name');
  ck('#99 tap a header to sort by it', names(X.rbSorted(sp, X.rbState('spells'), rows('spells'))) === '["Bless","Fire Bolt","Fireball"]');
  X.rbSortBy('spells', 'name');
  ck('#99 ...tap again to reverse', names(X.rbSorted(sp, X.rbState('spells'), rows('spells'))) === '["Fireball","Fire Bolt","Bless"]');
  const it = X.rbCat('items');
  X.rbSortBy('items', 'cost');
  ck('#99 cost sorts by gold value, blanks last', names(X.rbSorted(it, X.rbState('items'), rows('items'))) === '["Torch","Rope","Plate","Wand"]');
  X.rbSortBy('items', 'cost');
  ck('#99 ...and blanks stay last reversed', names(X.rbSorted(it, X.rbState('items'), rows('items'))) === '["Plate","Rope","Torch","Wand"]');

  const sf = X.rbFacets(sp, rows('spells'));
  ck('#99 spells filter as the picker does', JSON.stringify(sf.map(f => f.key)) === '["level","class","school","conc"]');
  ck('#99 a lookup starts on every class, not this character\'s', X.rbFacetVal(X.rbState('spells'), sf[1]).size === 0);
  X.rbToggleFacet('spells', 'school', 'evocation');
  const pass = k => { const c = X.rbCat(k), st = X.rbState(k), f = X.rbFacets(c, rows(k)); return rows(k).filter(r => X.rbPasses(c, st, f, r)); };
  ck('#99 a facet narrows the table', names(pass('spells')) === '["Fire Bolt","Fireball"]');
  X.rbToggleFacet('spells', 'school', 'evocation');
  ck('#99 ...and tapping it again clears it', pass('spells').length === 3);
  X.rbToggleFacet('spells', 'conc', null);
  ck('#99 a toggle facet', names(pass('spells')) === '["Bless"]');
  X.rbClearFacets('spells');
  ck('#99 clear empties every facet', pass('spells').length === 3);
  X.rbState('spells').q = 'fire';
  ck('#99 a category\'s own search', names(pass('spells')) === '["Fire Bolt","Fireball"]');
  X.rbState('spells').q = '';

  ck('#99 one pack, no Pack filter', !X.rbFacets(it, rows('items')).some(f => f.key === 'pack'));
  ck('#99 two packs, a Pack filter', X.rbFacets(X.rbCat('races'), rows('races')).some(f => f.key === 'pack'));
  ck('#99 feats keep their own Pack filter, not a second one',
     X.rbFacets(X.rbCat('feats'), rows('feats')).filter(f => f.key === 'pack').length === 1);
  X.rbToggleFacet('glossary', 'own', null);
  ck('#99 Your entries narrows the Glossary to yours', pass('glossary').every(r => r.own) && pass('glossary').length === 2);
  X.rbClearFacets('glossary');

  const gl = X.rbBodyHTML(X.rbCat('glossary'), rows('glossary'), X.rbState('glossary'), X.rbFacets(X.rbCat('glossary'), rows('glossary')));
  ck('#99 your own entries keep Preview, Edit and Delete', /data-view-gloss="own1"/.test(gl) && /data-edit-gloss="own1"/.test(gl) && /data-del-gloss="own0"/.test(gl));
  ck('#99 an entry with no term is listed, to be fixed', /\(no term\)/.test(gl));
  ck('#99 a pack term has no Edit', !/data-edit-gloss="k2"/.test(gl));
  ck('#99 + Add lives on the Glossary\'s header only',
     X.rbHeadHTML(X.rbCat('glossary'), 3, '').includes('id="btnAddGloss"') && !X.rbHeadHTML(sp, 3, '').includes('btnAddGloss'));
  ck('#99 a category\'s search box keeps its text and has a clear button',
     /<div class="searchbox[^"]*"><input id="rbCatSearch"[^>]*value="fi&quot;re"[^>]*><button type="button" class="search-clear"/.test(X.rbHeadHTML(sp, 3, 'fi"re')));

  const many = Array.from({length: 650}, (_, i) => ({_id: 'm' + i, name: 'Item ' + i, _source: 'SRD'}));
  X.rules.items = many;
  const mst = X.rbState('items'); mst.sort = null;
  let mb = X.rbBodyHTML(it, rows('items'), mst, X.rbFacets(it, rows('items')));
  ck('#99 a long table shows 300, then Show 300 more', (mb.match(/<tr data-rbrow=/g) || []).length === 300 && mb.includes('Show 300 more'));
  mst.shown = 600; mb = X.rbBodyHTML(it, rows('items'), mst, X.rbFacets(it, rows('items')));
  ck('#99 ...then Show 50 more', (mb.match(/<tr data-rbrow=/g) || []).length === 600 && mb.includes('Show 50 more'));
  mst.shown = 900; mb = X.rbBodyHTML(it, rows('items'), mst, X.rbFacets(it, rows('items')));
  ck('#99 ...then no button', !mb.includes('data-rbmore'));
  fresh();

  X.rules.spells = Array.from({length: 10}, (_, i) => ({_id: 'b' + i, name: 'Bolt ' + i, level: 1, _source: 'SRD'}));
  const sh = X.rbSearchHTML(X.rbShown(), 'bolt');
  ck('#99 search everything: 8 rows a category, then a link that carries on',
     (sh.match(/data-rbhitcat="spells"/g) || []).length === 8 && sh.includes('data-rbmorein="spells"') && sh.includes('2 more in Spells →'));
  ck('#99 search everything finds names in every category', X.rbSearchHTML(X.rbShown(), 'elf').includes('data-rbhit="r2"'));
  ck('#99 search everything, nothing found', X.rbSearchHTML(X.rbShown(), 'zzz').includes('No matches'));
  fresh();

  const side = X.rbSideHTML(X.rbShown(), 'spells');
  ck('#99 the open category is marked', /class="rb-cat on" data-rbcat="spells" aria-current="true"/.test(side) && !/data-rbcat="items" aria-current/.test(side));
  ck('#99 each category shows its count', /data-rbcat="spells"[^>]*><span class="rb-cn">Spells<\/span><span class="cnt">3<\/span>/.test(side));
  ck('#99 the stored category, or the first listed',
     X.rulesCatOf({rulesCat: 'spells'}, X.rbShown()) === 'spells' && X.rulesCatOf({rulesCat: 'nope'}, X.rbShown()) === 'classes' &&
     X.rulesCatOf({}, X.rbShown()) === 'classes' && X.rulesCatOf({rulesCat: '__proto__'}, X.rbShown()) === 'classes' && X.rulesCatOf(null, X.rbShown()) === 'classes');
  X.rules.feats = [];
  ck('#99 a stored category that is now empty falls back', X.rulesCatOf({rulesCat: 'feats'}, X.rbShown()) === 'classes');
  fresh();

  ck('#99 every row is found again by its id', X.rbShown().every(({cat, rows: rs}) => rs.every(r => X.rbFindRow(cat.k, r.id) && X.rbFindRow(cat.k, r.id).id === r.id)));
  modal = null; X.rbOpenRow('races', 'r2');
  ck('#99 a row opens its own entry', !!modal && modal.title === 'Elf' && modal.html.includes('New.'));
  modal = null; X.rbOpenRow('classes', 'c1');
  ck('#99 a class opens in reference mode', !!modal && modal.title === 'Fighter');
  modal = null; X.rbOpenRow('spells', 'nope');
  ck('#99 an unknown id opens nothing', modal === null);

  // final-review (a): rbToList() is the runtime hook selectTab() calls —
  // behavioural half of the source-level check above
  X.rbUI.screen = 'table';
  X.rbToList();
  ck('#99 (a) rbToList() resets the screen to the category list', X.rbUI.screen === 'list');

  // final-review (3): two base packs both naming a class "Fighter" must not
  // collide in the Class column — it reads the display name, not the plain one
  X.rules = {name: 'T', classes: [
    {_id: 'cA', name: 'Fighter', hitDie: 'd10', _source: 'SRD', subclasses: {Samurai: {description: 'x'}}},
    {_id: 'cB', name: 'Fighter', hitDie: 'd10', _source: 'XPHB', subclasses: {Samurai: {description: 'y'}}},
  ]};
  ctx.recomputeDups();
  const subCat = X.rbCat('subclasses'), clsCol = subCat.cols.find(c => c.key === 'cls');
  ck('#99 (3) same-named classes from two packs show distinct Class cells',
     JSON.stringify(subCat.rows().map(r => clsCol.get(r)).sort()) === '["Fighter (SRD)","Fighter (XPHB)"]');
  const clsFacet = subCat.facets(subCat.rows())[0];
  ck('#99 (3) ...and the Class facet options are distinct too',
     JSON.stringify(clsFacet.options.map(o => o.label).sort()) === '["Fighter (SRD)","Fighter (XPHB)"]');
  fresh();

  // final-review (4): rbNum takes the first number, not every digit joined
  ck('#99 (4) rbNum reads the first number, blank is null',
     X.rbNum('30 ft') === 30 && X.rbNum('Walk 30 ft; Fly 60 ft') === 30 && X.rbNum('d12') === 12 && X.rbNum('') === null);

  // final-review (5): opening a category persists it, loudly enough to check
  // against the stored settings blob a reload would read back
  delete store[X.K_SET];
  X.rbOpenCat('spells');
  ck('#99 (5) opening a category persists settings.rulesCat', X.settings.rulesCat === 'spells');
  ck('#99 (5) ...and the stored settings blob holds it too',
     typeof store[X.K_SET] === 'string' && JSON.parse(store[X.K_SET]).rulesCat === 'spells');

  ctx.openModal = savedOM; X.rules = savedRules; X.character = savedChar; X.settings.rulesCat = savedCat; X.rbUI.per = {}; X.rbUI.q = '';
}

// ---------- #103: defaultLanguages and advancement are per-label pack fields, like requires
{
  const saved = X.rules;
  X.resetRules();
  X.mergeRules({system: 'humblewood', defaultLanguages: ['Common', 'Birdsong'], advancement: [[0, 1], [100, 2]], races: [{name: 'Mapach'}]}, 'h.json');
  X.mergeRules({system: '__proto__', defaultLanguages: ['Odd'], races: [{name: 'Q'}]}, 'p.json');
  ck('#103 the fields are stored per label', JSON.stringify(X.rules.defaultLanguages.humblewood) === '["Common","Birdsong"]' && X.rules.advancement.humblewood[1][0] === 100);
  ck('#103 ...in prototype-free maps', Object.getPrototypeOf(X.rules.defaultLanguages) === null && JSON.stringify(X.rules.defaultLanguages['__proto__']) === '["Odd"]');
  ck('#103 junk inside a declaration is dropped', (() => { X.mergeRules({system: 'j', defaultLanguages: ['A', 3, '  '], advancement: 'no', races: [{name: 'J'}]}, 'j.json');
    return JSON.stringify(X.rules.defaultLanguages.j) === '["A"]' && !('j' in X.rules.advancement); })());
  const back = JSON.parse(JSON.stringify(X.rules));
  X.resetRules(); Object.assign(X.rules, back); X.normPackMaps();
  ck('#103 a save and load keeps them', JSON.stringify(X.rules.defaultLanguages.humblewood) === '["Common","Birdsong"]' && Object.getPrototypeOf(X.rules.advancement) === null);
  X.rules.races = X.rules.races.filter(r => r._source !== 'humblewood'); X.prunePackMeta();
  ck('#103 removing the pack drops them', !('humblewood' in X.rules.defaultLanguages) && !('humblewood' in X.rules.advancement));
  X.rules = saved;
}

// ---------- #101 the level-up scene's CSS: z-index, print, reduced motion, tokens
{
  const mc=fs.readFileSync(path.join(__dirname,'..','css','50-modal.css'),'utf8');
  const tk=fs.readFileSync(path.join(__dirname,'..','css','00-tokens.css'),'utf8');
  ck('#101 the scene sits above the page and under the modal (75 < 80)', /\.lu-fx\{[^}]*z-index:75/.test(mc));
  ck('#101 ...is hidden in print', /@media print\{[^@]*\.lu-fx\{display:none!important\}/.test(mc));
  ck('#101 ...and under reduced motion', /@media \(prefers-reduced-motion:reduce\)\{[^@]*\.lu-fx\{display:none\}/.test(mc));
  /* #101: a generic `@media (prefers-reduced-motion:reduce){` already sits early
     in this file (the blanket animation-off rule); indexOf would find THAT one,
     not .lu-fx's own, so this uses lastIndexOf for both media queries, same as
     the print check already does. */
  ck('#101 ...both media queries come after the base rule', mc.indexOf('.lu-fx{position:fixed')>=0&&
     mc.indexOf('.lu-fx{position:fixed')<mc.lastIndexOf('@media (prefers-reduced-motion:reduce){')&&mc.indexOf('.lu-fx{position:fixed')<mc.lastIndexOf('@media print{'));
  const root=tk.slice(tk.indexOf(':root{'),tk.indexOf('}',tk.indexOf(':root{')));
  const classic=tk.slice(tk.indexOf('html[data-skin="classic"]{'),tk.indexOf('}',tk.indexOf('html[data-skin="classic"]{')));
  ['--lu-night','--lu-night-2','--lu-glow','--lu-spark'].forEach(t=>
    ck('#101 '+t+' is defined for Humblewood (:root) and classic', root.indexOf(t+':')>=0&&classic.indexOf(t+':')>=0, t));
}

{
  /* #52: .tab sets display, which beats the browser's [hidden] rule */
  const chrome = fs.readFileSync(path.join(__dirname, '..', 'css', '10-chrome.css'), 'utf8');
  ck('#52 a hidden tab button really leaves the bar', /\.tab\[hidden\]\{display:none!important\}/.test(chrome));
}

// ---------- #91 the strip's band colours are tokens, and chips are tall enough
{
  const cc = fs.readFileSync(path.join(__dirname, '..', 'css', '45-combat.css'), 'utf8');
  const tk = fs.readFileSync(path.join(__dirname, '..', 'css', '00-tokens.css'), 'utf8');
  const root = tk.slice(tk.indexOf(':root{'), tk.indexOf('}', tk.indexOf(':root{')));
  ck('#91 the band colours are tokens', ['--hb-healthy', '--hb-injured', '--hb-bloodied', '--hb-near', '--hb-empty'].every(t => root.includes(t + ':')));
  ck('#91 strip chips are at least 44px tall', /\.ini-chip\{[^}]*min-height:44px/.test(cc));
}

// ---------- #91 the combatant dialog's targets are big enough to tap
{
  const mc = fs.readFileSync(path.join(__dirname, '..', 'css', '50-modal.css'), 'utf8');
  ck('#91 the combatant dialog\'s band buttons are 48px and its steppers 44px', /\.cd-band\{[^}]*min-height:48px/.test(mc) && /\.cd-pm\{[^}]*min-(?:width|height):44px/.test(mc));
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
  // the status line and the Settings sidebar's Rules data badge, readable
  const status = {textContent: '', className: ''};
  const chip = {innerHTML: 'STALE'};
  const getById = ctx.document.getElementById;
  ctx.document.getElementById = id => id === 'rulesStatus' ? status : getById(id);
  ctx.document.querySelector = sel => /data-setbadge="extensions"/.test(sel) ? chip : null;
  // drain every microtask the fetch chain queues, whether or not it returns a promise
  const run = async () => { calls = []; await X.fetchAllRules(); await new Promise(r => setImmediate(r)); };
  const cache = () => store[X.K_RULES];
  const cached = () => JSON.parse(X.readRulesCacheString(cache()) || '{}');
  const names = (r, cat, src) => { const a = (r || X.rules)[cat]; return (Array.isArray(a) ? a : []).filter(e => e && (!src || e._source === src)).map(e => e.name).sort(); };
  const badge = () => X.rulesNavBadgeHTML();
  // a file-imported rulebook, cached the way an import leaves it
  const seedFilePack = () => {
    X.character = X.blankChar();
    X.resetRules();
    X.mergeRules({system: 'XPHB', rulebook: true, classes: [{name: 'Wizard'}],
                  spells: [{name: 'Fireball'}, {name: 'Shield'}]}, 'rulebook_full.json');
    state.quotaFull = false;
    X.saveRulesCache();
  };
  const HB = 'https://example.test/homebrew.json', OFF = 'http://127.0.0.1:9/offline-pack.json';
  // #102: a plain source, the old-style shape fetchAllRules() reads from settings.sources now
  const plain = urls => urls.map((url, i) => ({id: 'p' + i, kind: 'plain', url, on: true, checked: 0, error: '', manifest: null, base: ''}));

  // ---- (b) offline: a run where nothing arrives changes nothing
  seedFilePack();
  X.settings.sources = plain([OFF]);
  routes = {};
  const poolBefore = JSON.stringify(X.rules), cacheBefore = cache();
  chip.innerHTML = 'STALE';
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
  ck('fetch-all offline: the Rules data badge counts what is loaded', chip.innerHTML === badge(), [chip.innerHTML, badge()]);
  ck('fetch-all offline: one request, uncached', calls.length === 1 && calls[0].cache === 'no-store', calls);

  // ---- (a) a file-imported pack survives a successful fetch of another source
  seedFilePack();
  X.settings.sources = plain([HB]);
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap', text: 'v1'}, {name: 'Fizzle'}]}};
  chip.innerHTML = 'STALE';
  await run();
  ck('fetch-all: the fetched pack is merged', names(null, 'spells', 'Homebrew').join() === 'Fizzle,Zap',
     names(null, 'spells', 'Homebrew'));
  ck('fetch-all: a pack imported from a FILE survives it',
     names(null, 'spells', 'XPHB').join() === 'Fireball,Shield' && names(null, 'classes').join() === 'Wizard',
     names(null, 'spells'));
  ck('fetch-all: ...still listed under its file in Loaded data',
     X.loadedRulesGroups().some(g => g.isFile && g.label === 'rulebook_full.json'));
  ck('fetch-all: the cache holds both the file pack and the fetched one',
     names(cached(), 'spells').join() === 'Fireball,Fizzle,Shield,Zap', names(cached(), 'spells'));
  ck('fetch-all: the status line reports success', /^Fetched/.test(status.textContent) && /\bok\b/.test(status.className),
     [status.textContent, status.className]);
  ck('fetch-all: the Rules data badge counts the new pool', chip.innerHTML === badge() && X.rulesEntryCount() === 5,
     [chip.innerHTML, badge()]);

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
  X.settings.sources = plain([HB, EX]);
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
  X.settings.sources = plain([HB, HB + ' ']);
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]}};
  await run();
  ck('a source listed twice is fetched once', calls.length === 1, calls);

  // ---- a manifest is one source: its includes arrive together or not at all
  const MAN = 'https://example.test/pack/manifest.json', A = 'https://example.test/pack/a.json', B = 'https://example.test/pack/b.json';
  seedFilePack();
  X.settings.sources = plain([MAN]);
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
  X.settings.sources = plain([HB]);
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
  X.settings.sources = plain([HB]);
  routes = {[HB]: {system: 'Homebrew', include: ['http://[bad']}};
  await run();
  ck('an unresolvable include fails the source, naming the file',
     /homebrew\.json/.test(status.textContent) && /nothing changed/i.test(status.textContent), status.textContent);

  // ---- provenance is the merge's to stamp: a stray _url in a FILE never lets a fetch delete it
  seedFilePack();
  X.mergeRules({system: 'Homebrew', spells: [{name: 'Hex', _url: HB}]}, 'mine.json');
  X.settings.sources = plain([HB]);
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]}};
  await run();
  ck('a file entry carrying a stray _url survives a fetch of that URL', names(null, 'spells').includes('Hex'), names(null, 'spells'));

  // ---- `requires` follows the source's fresh copy, unless a file shares its label
  seedFilePack();
  X.settings.sources = plain([HB]);
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
  X.settings.sources = plain([HB]);
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
  X.settings.sources = plain([HB]);
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}, {text: 'no name'}], keywords: [{text: 'no term'}]}};
  await run();
  ck('#71 fetch-all: the usable entries arrive', names(null, 'spells', 'Homebrew').join() === 'Zap', names(null, 'spells'));
  ck('#71 fetch-all: the status line says what was skipped',
     /skipped/i.test(status.textContent) && /1 glossary entry/.test(status.textContent) && /1 spell/.test(status.textContent),
     status.textContent);

  // ---- #102 fix round 1 (Minor 11): fetchAllRules(urls) takes an explicit
  // list, bypassing settings.sources entirely — even with no plain source
  // configured at all
  seedFilePack();
  X.settings.sources = [];
  routes = {[HB]: {system: 'Homebrew', spells: [{name: 'Zap'}]}};
  calls = [];
  await X.fetchAllRules([HB]);
  await new Promise(r => setImmediate(r));
  ck('#102 fetchAllRules(urls): an explicit list is fetched with no plain source configured',
     names(null, 'spells', 'Homebrew').join() === 'Zap' && calls.length === 1, [names(null, 'spells'), calls]);
  routes = {}; calls = [];
  await X.fetchAllRules();
  await new Promise(r => setImmediate(r));
  ck('#102 fetchAllRules(): with no argument and no plain source, there is nothing to fetch',
     /no plain source/i.test(status.textContent) && calls.length === 0, status.textContent);

  // ---- the Rules data badge follows every change to the pool, not only Fetch all
  chip.innerHTML = 'STALE';
  state.confirm = true;
  X.clearAllRules();
  ck('the Rules data badge follows Clear all', chip.innerHTML === badge() && !/set-cnt/.test(chip.innerHTML) && /none loaded/.test(chip.innerHTML), chip.innerHTML);

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
                  spells: [{name: 'Fireball'}], keywords: [{term: 'Blinded', text: 'Cannot see.'}]}, 'rulebook_full.json');
    X.mergeRules({system: 'Homebrew', spells: [{name: 'Zap'}]}, null, HB);
    const OLD = JSON.parse(JSON.stringify(X.rules));   // what Export settings wrote: the pool, stamps and all
    const OLD_N = X.rulesEntryCount();
    // ...and since then: a newer rulebook, and a homebrew file the settings file has never seen
    const seedNow = () => {
      X.character = X.blankChar();
      Object.assign(X.settings, {skin: 'humblewood', theme: 'light', rough: true});
      X.resetRules();
      X.mergeRules({system: 'XPHB', rulebook: true, dataVersion: '1.1.0', classes: [{name: 'Wizard'}],
                    spells: [{name: 'Fireball'}, {name: 'Shield'}, {name: 'Mage Armor'}]}, 'rulebook_full.json');
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
      ck('...and says replacing puts back an older copy of a pack in both', /older copy of rulebook_full\.json/.test(q), q);
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
      chip.innerHTML = 'STALE';
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
       X.loadedRulesGroups().some(g => g.isFile && g.label === 'rulebook_full.json' && g.rulebook && g.dataVersion === '1.0.0'),
       X.loadedRulesGroups());
    ck('replace: ...and the fetched pack keeps its URL, so Fetch all still replaces it',
       (X.rules.spells || []).filter(e => e.name === 'Zap').every(e => e._url === HB) && names(null, 'spells', 'Homebrew').join() === 'Zap');
    ck('replace: the cache holds the new pool', names(cached(), 'spells').join() === 'Fireball,Zap' && names(cached(), 'feats').join() === '',
       names(cached(), 'spells'));
    ck('replace: the settings are imported too', X.settings.skin === 'classic');
    ck('replace: the status line says the rules were replaced, with the new count',
       /replaced/i.test(impStatus.textContent) && impStatus.textContent.includes(X.rulesEntryCount() + ' entries'), impStatus.textContent);
    ck('replace: the Rules data badge follows the new pool', chip.innerHTML === badge(), [chip.innerHTML, badge()]);
    ck('replace: the loaded-data list is redrawn', /rulebook_full\.json/.test(rulesDataEl.innerHTML) && !/my-homebrew\.json/.test(rulesDataEl.innerHTML));
    ck('replace: Settings reopens on the new pool', writes.length > 0 && writes[writes.length - 1].includes(X.rulesStatusText()) &&
       writes[writes.length - 1].includes(X.rulesNavBadgeHTML()));

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
                  requires: [{file: 'x.json', spells: ['Nope']}]}, 'supplement.json');
    X.mergeRules({system: 'Homebrew', spells: [{name: 'Zap'}]}, null, HB);
    X.mergeRules({system: 'XPHB', rulebook: true, dataVersion: '1.1.0', spells: [{name: 'Bless'}]}, 'rulebook_full.json');   // appended after Zap
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
