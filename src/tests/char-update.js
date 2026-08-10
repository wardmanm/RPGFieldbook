/* Character version stamp + the rules-update tool: fingerprints, diff
   classification, apply-preserves-local-state, backups, and the R1-R5
   regressions for bugs the first version of this suite missed. */
const fs = require('fs'), path = require('path');
const {loadApp, makeCheck} = require('./harness');

const ck = makeCheck();
const {X, state, store, bootError, fragments} = loadApp([
  'APP_VERSION','RULE_CATS','cmpVer','blankChar','migrate',
  'fpHash','fpMap','fpNorm','stampSrc','restampSrc',
  'updProject','updEdited','itemMetaLine','costToGp','addAttackForItem','findClassDef',
  'diffCharacter','applyUpdateRow','applyUpdates','charNeedsUpdate','updResolve','updChangedFields',
  'backupCharacter','libLoad','charKey','mergeRules','resetRules','addFeatureFromDef',
  'addClass','removeClass','hitDieMax','totalLevel','num',
]);
/* Evaluating the real concatenation in manifest order IS the guard against a
   top-level TDZ — 00-constants.js calls blankChar() before 30-version.js has
   defined APP_VERSION, so a reference to it there would white-screen the app. */
ck('concatenated fragments evaluate (no TDZ on APP_VERSION)', !bootError, bootError && bootError.message);
if (bootError) process.exit(1);
console.log('loaded ' + fragments.length + ' fragments\n');

// ---------- fingerprint
const A={name:'Alert',description:'You gain  a bonus.',effects:[{target:'init',value:5}]};
const B={effects:[{target:'init',value:5}],description:'You gain a bonus.',name:'Alert'};
ck('fpHash stable across key order + whitespace', X.fpHash(A)===X.fpHash(B));
ck('fpHash changes on content change', X.fpHash(A)!==X.fpHash(Object.assign({},A,{description:'Different.'})));
ck('fpMap is per-field', JSON.stringify(Object.keys(X.fpMap(A,'feature')))==='["description","effects","uses","cost"]', Object.keys(X.fpMap(A,'feature')));
ck('fpMap isolates the changed field', (()=>{const a=X.fpMap(A,'feature'),b=X.fpMap(Object.assign({},A,{description:'x'}),'feature');
  return a.description!==b.description && a.effects===b.effects;})());
ck('fpHash null-safe', typeof X.fpHash(undefined)==='string');

// ---------- version stamp
const fresh=X.blankChar();
ck('blankChar has appVersion ""', fresh.appVersion==='');
const mg=X.migrate({abilities:{},appVersion:'1.0.0',name:'Tess',custom:{deep:[1]}});
ck('migrate preserves appVersion', mg.appVersion==='1.0.0');
ck('migrate does NOT advance appVersion', mg.appVersion!==X.APP_VERSION);
ck('migrate preserves unknown fields', JSON.stringify(mg.custom)===JSON.stringify({deep:[1]}));
ck('migrate absent appVersion -> ""', X.migrate({abilities:{}}).appVersion==='');
ck('migrate non-string appVersion -> ""', X.migrate({abilities:{},appVersion:12}).appVersion==='');
ck('cmpVer detects behind', X.cmpVer('1.0.0',X.APP_VERSION)<0 && X.cmpVer('0.0.0',X.APP_VERSION)<0);

// ---------- fixture: rules + a character
function setup(){
  X.resetRules();
  X.mergeRules({system:'XPHB',feats:[{name:'Alert',description:'Original alert text.',effects:[{target:'init',value:5}]}],
    spells:[{name:'Bless',level:1,meta:'Abjuration',text:'Original bless text.'}],
    items:[{name:'Rope',description:'Original rope.',cost:'1 gp',category:'Gear',type:'Adventuring Gear',weight:5},
           {name:'Club',description:'Original club.',cost:'1 sp',category:'Weapon',type:'Simple Melee Weapon',weight:2,
            weapon:{kind:'melee',dice:'1d4',damageType:'bludgeoning',ability:'str',notes:''}}],
    classes:[{name:'Bard',levels:{'1':{traits:[{name:'Bardic Inspiration',description:'Original BI.'}]}}}]},'5e.json');
  const c=X.blankChar(); c.appVersion='1.0.0'; c.name='Tess';
  X.character=c; X.activeId=c.id;
  return c;
}
/* Build copies EXACTLY as the app does. The first version of this suite
   assigned copy.description = def.description, which is not what any copy site
   does — and that idealised fixture is precisely why a whole class of bugs
   (browse items false-positiving forever) passed the tests. */
function addBrowseItem(name){
  const def=(X.rules.items||[]).find(x=>x.name===name);
  const m=X.itemMetaLine(def);
  const it={id:'i-'+name,name:def.name,qty:1,
            description:(m?m+"\n":"")+(def.description||""),
            effects:Array.isArray(def.effects)?def.effects:[],equipped:false};
  const c=X.costToGp(def.cost); if(c!=null)it.cost=c;
  if(def.weapon)it.weapon=def.weapon;
  X.stampSrc(it,def,'item','items','browse');
  X.character.inventory.push(it); return it;
}
function addGrantItem(name){                       /* grantItemByName shape */
  const def=(X.rules.items||[]).find(x=>x.name===name);
  const it={id:'g-'+name,name:def.name,qty:1,description:def.description||"",
            effects:def.effects||[],equipped:false,grant:'class:Bard'};
  X.stampSrc(it,def,'item','items');
  X.character.inventory.push(it); return it;
}
function addBrowseSpell(name){                     /* browseSpells shape */
  const def=(X.rules.spells||[]).find(x=>x.name===name);
  const sp={id:'s-'+name,name:def.name,level:def.level,meta:def.meta||"",text:def.text||"",prepared:false};
  X.stampSrc(sp,def,'spell','spells');
  X.character.spells.push(sp); return sp;
}
function addFeat(name){                            /* grantFeatDef shape */
  const fd=(X.rules.feats||[]).find(x=>x.name===name);
  const f={id:'f-'+name,name:'Feat: '+fd.name,description:fd.description||"",effects:fd.effects||[],enabled:true,origin:null};
  X.stampSrc(f,fd,'feature','feats');
  X.character.features.push(f); return f;
}
let c=setup();
const feat=addFeat('Alert');
const spell=addBrowseSpell('Bless'); spell.prepared=true;
const item=addBrowseItem('Rope'); item.qty=7; item.equipped=true;

ck('no drift -> no rows', X.diffCharacter().rows.length===0, X.diffCharacter().rows.map(r=>r.name+':'+r.type));

// ---------- changed detection
X.rules.feats[0].description='UPDATED alert text.';
let rows=X.diffCharacter().rows;
let r=rows.find(x=>x.name==='Feat: Alert');
ck('changed row raised', r&&r.type==='changed', rows.map(x=>x.name+':'+x.type));
ck('changed row names the field', r&&r.fields.join()==='description', r&&r.fields);
ck('changed row ticked by default', r&&r.apply===true);
ck('changed row not flagged edited', r&&r.edited===false);
ck('unchanged siblings not raised', rows.length===1, rows.map(x=>x.name));

// ---------- apply preserves character-local state
X.applyUpdates([r]);
ck('apply rewrites description', feat.description==='UPDATED alert text.', feat.description);
ck('apply preserves id', feat.id==='f-Alert', feat.id);
ck('apply preserves enabled', feat.enabled===true);
ck('apply re-baselines fp -> no repeat row', X.diffCharacter().rows.length===0, X.diffCharacter().rows.map(x=>x.name));

X.rules.items[0].description='UPDATED rope.';
r=X.diffCharacter().rows.find(x=>x.name==='Rope');
X.applyUpdates([r]);
ck('item description updated', /UPDATED rope\./.test(item.description), item.description);
ck('item meta line SURVIVES the update', item.description.startsWith(X.itemMetaLine(X.rules.items[0])), item.description);
ck('item qty preserved', item.qty===7);
ck('item equipped preserved', item.equipped===true);
X.rules.spells[0].text='UPDATED bless.';
r=X.diffCharacter().rows.find(x=>x.name==='Bless');
X.applyUpdates([r]);
ck('spell text updated', spell.text==='UPDATED bless.');
ck('spell prepared preserved', spell.prepared===true);

// ---------- player edits are detected and NOT ticked
feat.description='My own house-ruled wording.';
X.rules.feats[0].description='Yet another rules revision.';
r=X.diffCharacter().rows.find(x=>x.name==='Feat: Alert');
ck('edited copy flagged', r&&r.edited===true, r);
ck('edited copy NOT ticked by default', r&&r.apply===false);
ck('edited copy still offered', r&&r.type==='changed');

// ---------- ambiguity: same name in two packs
c=setup();
X.mergeRules({system:'Homebrew',feats:[{name:'Alert',description:'Homebrew alert.'}]},'hb.json');
const legacy={id:'L1',name:'Alert',description:'stale'};   // no src stamp = legacy
X.character.features.push(legacy);
r=X.diffCharacter().rows.find(x=>x.name==='Alert');
ck('legacy name hitting 2 packs -> ambiguous', r&&r.type==='ambiguous', r&&r.type);
ck('ambiguous never ticked', r&&r.apply===false);
ck('ambiguous explains itself', r&&/packs/.test(r.why), r&&r.why);
// a STAMPED copy disambiguates by pack even when the name collides
c=setup();
X.mergeRules({system:'Homebrew',feats:[{name:'Alert',description:'Homebrew alert.'}]},'hb.json');
const stamped=addFeat('Alert');
ck('stamped copy resolves despite name collision', X.updResolve(stamped,'feature').def!==undefined);

// ---------- unmatched is reported, never deletable
c=setup();
X.character.inventory.push({id:'X1',name:'Grandpa\'s Sword',description:'heirloom'});
r=X.diffCharacter().rows.find(x=>x.name==="Grandpa's Sword");
ck('unmatched reported', r&&r.type==='unmatched');
ck('unmatched never ticked', r&&r.apply===false);
ck('applyUpdateRow refuses unmatched', X.applyUpdateRow(r)===false);

// ---------- newly available class trait
c=setup();
X.character.classes.push({name:'Bard',level:1,subclass:null});
rows=X.diffCharacter().rows.filter(x=>x.type==='added');
ck('new class trait offered', rows.length===1 && rows[0].name==='Bardic Inspiration', rows.map(x=>x.name));
ck('added row ticked by default', rows[0].apply===true);
X.applyUpdates([rows[0]]);
ck('added trait lands on the sheet', X.character.features.some(f=>f.name==='Bardic Inspiration'));
ck('added trait is stamped', !!(X.character.features.find(f=>f.name==='Bardic Inspiration')||{}).src);
ck('added trait not offered twice', X.diffCharacter().rows.filter(x=>x.type==='added').length===0);

// ---------- gating
c=setup();
ck('needs update when behind + rules loaded', X.charNeedsUpdate(X.character)===true);
X.character.appVersion=X.APP_VERSION;
ck('no prompt when current', X.charNeedsUpdate(X.character)===false);
X.character.appVersion='1.0.0'; X.character.skipUpdate=X.APP_VERSION;
ck('no prompt when dismissed for this version', X.charNeedsUpdate(X.character)===false);
X.character.skipUpdate='0.9.0';
ck('prompt returns for a NEW version', X.charNeedsUpdate(X.character)===true);
delete X.character.skipUpdate;
X.character.isBackup=true;
ck('backups never prompt', X.charNeedsUpdate(X.character)===false);
delete X.character.isBackup;
X.resetRules();
ck('no prompt with no rules loaded', X.charNeedsUpdate(X.character)===false);
ck('diff reports anyRules:false', X.diffCharacter().anyRules===false);

// ---------- backup
c=setup();
X.character.name='Tess'; X.character.appVersion='1.0.0';
const before=X.libLoad().index.length;
const activeBefore=X.activeId, charBefore=X.character;
const bres=X.backupCharacter(X.character,'v1.0.0');
const bid=bres.id;
ck('backup returns an id', !!bid);
ck('backup returns the snapshot too', !!bres.copy && bres.copy.id===bid);
ck('backup does not switch active character', X.activeId===activeBefore && X.character===charBefore);
ck('backup added to library index', X.libLoad().index.length===before+1);
const bak=JSON.parse(store[X.charKey(bid)]);
ck('backup name is discoverable', /\(backup v1\.0\.0\)$/.test(bak.name), bak.name);
ck('backup flagged isBackup', bak.isBackup===true);
ck('backup has its own id', bak.id!==charBefore.id);
ck('backup survives migrate', X.migrate(bak).name===bak.name);
state.quotaFull=true;
const refused=X.backupCharacter(X.character,'v1');
ck('backup reports an error when storage refuses', !refused.id && !!refused.error, refused.error);
ck('refusal says WHY, in words a player can act on', /storage is full/.test(refused.error), refused.error);
ck('refusal still hands back the snapshot to download', !!refused.copy && refused.copy.isBackup===true);
state.quotaFull=false;

/* The index write is verified, not assumed: libSave() swallows its own quota
   error, so a backup could land in storage while never appearing on the home
   screen — after we had told the player to go and look for it there. */
c=setup();
X.character.name='Orphan';
let blockIndex=true;
const libKey='hw-fb-library';
const savedLib=store[libKey];
Object.defineProperty(store,libKey,{configurable:true,
  get(){return savedLib;},                      // index never changes
  set(v){if(!blockIndex)Object.defineProperty(store,libKey,{value:v,writable:true,configurable:true});}});
const orphan=X.backupCharacter(X.character,'v1');
delete store[libKey]; if(savedLib!==undefined)store[libKey]=savedLib;
ck('backup fails when the index write is silently dropped', !orphan.id && !!orphan.error, orphan.error);
ck('a dropped index write leaves no orphan blob in storage',
   Object.keys(store).every(k=>{ if(!/^hw-fb-c-/.test(k))return true;
     try{return JSON.parse(store[k]).name!=='Orphan (backup v1)';}catch(e){return true;} }));

/* ================= REGRESSIONS =================
   Every one of these is a bug that shipped past the first version of this
   suite because the fixture built copies by hand instead of the way the app
   does. They stay here. */

// R1 — a browse-added item must be SILENT until the pack actually moves, and an
//      update must not eat the meta line or turn the gp cost back into a string.
c=setup();
const bi=addBrowseItem('Rope');
const metaLine=X.itemMetaLine(X.rules.items[0]);
ck('R1 browse item: no phantom row', X.diffCharacter().rows.length===0, X.diffCharacter().rows.map(x=>x.why));
ck('R1 browse item: cost stayed numeric on copy', typeof bi.cost==='number', bi.cost);
X.rules.items[0].description='Rope, revised.';
let rr=X.diffCharacter().rows;
ck('R1 real change raises exactly one row', rr.length===1 && rr[0].fields.join()==='description', rr.map(x=>x.fields));
X.applyUpdates(rr);
ck('R1 meta line survives apply', bi.description.startsWith(metaLine), bi.description.slice(0,50));
ck('R1 cost still numeric after apply', typeof bi.cost==='number', bi.cost);
ck('R1 quiet again afterwards', X.diffCharacter().rows.length===0);

// R1b — a player's typed cost override is neither reported nor overwritten
c=setup();
const ov=addBrowseItem('Rope'); ov.cost=99; X.stampSrc(ov,X.rules.items[0],'item','items','browse');
X.rules.items[0].description='Rope, revised again.';
rr=X.diffCharacter().rows;
ck('R1b override not flagged', rr.length===1 && rr[0].fields.join()==='description', rr.map(x=>x.fields));
X.applyUpdates(rr);
ck('R1b override preserved', ov.cost===99, ov.cost);

// R1c — a granted (verbatim) item uses the plain shape, not the browse one
c=setup();
const gi=addGrantItem('Rope');
ck('R1c granted item: no phantom row', X.diffCharacter().rows.length===0, X.diffCharacter().rows.map(x=>x.why));
X.rules.items[0].description='Rope, third revision.';
X.applyUpdates(X.diffCharacter().rows);
ck('R1c granted item has NO meta line', gi.description==='Rope, third revision.', gi.description);
ck('R1c grant tag preserved', gi.grant==='class:Bard');

// R2 — updating a weapon must re-sync the attack derived from it
c=setup();
const club=addBrowseItem('Club');
club.equipped=true;
X.addAttackForItem(club);
const atkId=X.character.attacks[0].id;
ck('R2 attack created', X.character.attacks[0].damageDice==='1d4', X.character.attacks[0]);
X.rules.items[1].weapon={kind:'melee',dice:'2d6',damageType:'bludgeoning',ability:'str',notes:''};
X.applyUpdates(X.diffCharacter().rows);
ck('R2 item weapon updated', club.weapon.dice==='2d6', club.weapon);
ck('R2 linked attack re-synced', X.character.attacks[0].damageDice==='2d6', X.character.attacks[0].damageDice);
ck('R2 attack id kept stable', X.character.attacks[0].id===atkId);
ck('R2 no duplicate attack', X.character.attacks.filter(a=>a.itemId===club.id).length===1);

// R3 — multiclass: two classes granting a same-named trait
c=setup();
X.mergeRules({system:'XPHB',classes:[
  {name:'Fighter',levels:{'5':{traits:[{name:'Extra Attack',description:'Fighter version.'}]}}},
  {name:'Barbarian',levels:{'5':{traits:[{name:'Extra Attack',description:'Barbarian version.'}]}}}]},'cls.json');
X.character.classes.push({name:'Fighter',level:5,subclass:null},{name:'Barbarian',level:5,subclass:null});
X.character.features.push({id:'ff',name:'Extra Attack',description:'Fighter version.',
  origin:{kind:'class',class:'Fighter',level:5}});
let added=X.diffCharacter().rows.filter(x=>x.type==='added');
ck('R3 Barbarian copy offered despite name clash',
   added.some(x=>x.name==='Extra Attack'&&x.origin.class==='Barbarian'), added.map(x=>x.name+'/'+(x.origin&&x.origin.class)));
ck('R3 Fighter copy NOT re-offered',
   !added.some(x=>x.name==='Extra Attack'&&x.origin.class==='Fighter'), added.map(x=>x.origin&&x.origin.class));

// R3b — an untagged legacy feature of the same name is not duplicated
c=setup();
X.character.classes.push({name:'Bard',level:1,subclass:null});
X.character.features.push({id:'u1',name:'Bardic Inspiration',description:'added long ago'});  // no origin
ck('R3b untagged legacy not duplicated',
   X.diffCharacter().rows.filter(x=>x.type==='added'&&x.name==='Bardic Inspiration').length===0);

// R4 — the stamped pack is gone: offer the other pack's entry, but say so and don't tick it
c=setup();
const pf=addFeat('Alert');
X.resetRules();
X.mergeRules({system:'OtherPack',feats:[{name:'Alert',description:'A different Alert entirely.'}]},'o.json');
X.character.features=[pf];
const res=X.updResolve(pf,'feature');
ck('R4 flagged as a loose cross-pack match', res.loose===true&&res.otherPack==='XPHB', {loose:res.loose,other:res.otherPack});
const r4=X.diffCharacter().rows[0];
ck('R4 not ticked by default', r4&&r4.apply===false, r4&&r4.apply);
ck('R4 names the missing pack', r4&&/XPHB/.test(r4.why)&&/isn't loaded/.test(r4.why), r4&&r4.why);

// R5 — a background grants a single `feature` object, not a `traits` array
c=setup();
X.mergeRules({system:'XPHB',backgrounds:[{name:'Sage',feature:{name:'Researcher',description:'You know where to look.'}}]},'bg.json');
X.character.bg={name:'Sage'};
added=X.diffCharacter().rows.filter(x=>x.type==='added');
ck('R5 background feature offered', added.some(x=>x.name==='Researcher'), added.map(x=>x.name));
X.applyUpdates(added.filter(x=>x.name==='Researcher'));
ck('R5 background feature applied', X.character.features.some(f=>f.name==='Researcher'));
ck('R5 not offered twice', X.diffCharacter().rows.filter(x=>x.type==='added'&&x.name==='Researcher').length===0);
ck('R5 resolves back through origin afterwards',
   X.updResolve(X.character.features.find(f=>f.name==='Researcher'),'feature').def!==undefined);

// ---------- level-1 max HP seeding
// A single class at level 1 has no roll and no choice, so max HP is simply the
// hit die's maximum. It must never overwrite a number the player typed, and it
// must not fire when multiclassing (the second class gets a rolled/average HP).
c=setup();
ck('hitDieMax parses "d8"', X.hitDieMax({hitDie:'d8'})===8);
ck('hitDieMax parses a bare number', X.hitDieMax({hitDie:'10'})===10);
ck('hitDieMax is 0 for junk', X.hitDieMax({hitDie:'big'})===0 && X.hitDieMax({})===0);
ck('hitDieMax is 0 for no def', X.hitDieMax(null)===0);

const hpSetup=(ruleClasses)=>{
  c=setup();
  X.resetRules(); X.mergeRules({classes:ruleClasses}, 'test');
  X.character.classes=[]; X.character.level=1;
  X.character.hp.max=''; X.character.hp.cur='';
};
const CLS=[{name:'Fighter',hitDie:'d10'},{name:'Wizard',hitDie:'d6'},{name:'Rogue',hitDie:'d8'}];

hpSetup(CLS); X.addClass('Rogue',1);
ck('level 1 single class seeds max HP from the die', X.num(X.character.hp.max)===8, X.character.hp.max);
ck('level 1 also starts at full HP', X.num(X.character.hp.cur)===8, X.character.hp.cur);

hpSetup(CLS); X.character.hp.max=5; X.addClass('Rogue',1);
ck('a number the player typed is never overwritten', X.num(X.character.hp.max)===5);

hpSetup(CLS); X.addClass('Fighter',3);
ck('starting above level 1 does not seed HP', !X.num(X.character.hp.max), X.character.hp.max);

hpSetup(CLS); X.addClass('Fighter',1); X.addClass('Wizard',1);
ck('multiclassing does not re-seed from the second die', X.num(X.character.hp.max)===10,
   X.character.hp.max);
ck('multiclass total level is 2', X.totalLevel()===2);

// swapping class at level 1: the seeded number must not survive the old class
hpSetup(CLS); X.addClass('Fighter',1);
ck('Fighter seeds 10', X.num(X.character.hp.max)===10);
X.removeClass(0);
ck('removing the only level-1 class takes the seeded HP back out', X.character.hp.max==='',
   X.character.hp.max);
X.addClass('Wizard',1);
ck('re-adding seeds the NEW die, not the old one', X.num(X.character.hp.max)===6,
   X.character.hp.max);

hpSetup(CLS); X.addClass('Fighter',1); X.character.hp.max=42;
X.removeClass(0);
ck('an HP the player edited survives class removal', X.num(X.character.hp.max)===42);

hpSetup(CLS); X.addClass('Fighter',1); X.addClass('Wizard',1); X.removeClass(1);
ck('removing a multiclass level does not clear HP', X.num(X.character.hp.max)===10);

ck.done();
