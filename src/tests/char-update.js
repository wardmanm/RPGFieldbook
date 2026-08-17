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
  'atkGenFp','stampAtkGen','updAtkEdited','ATK_GEN_FIELDS',
  'diffCharacter','applyUpdateRow','applyUpdates','charNeedsUpdate','updResolve','updChangedFields',
  'backupCharacter','libLoad','charKey','mergeRules','resetRules','addFeatureFromDef',
  'addClass','removeClass','doLevelUp','hitDieMax','level1HP','resyncLevel1HP','modOf',
  'totalLevel','num','fnum','UPD_FIELDS','updBannerHTML',
  'grantItemByName',
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

// ---------- the app-update banner
// The update pill REPLACES the version button in the top bar, so the changelog
// is the only remaining route to the download. If this banner ever goes missing
// there is no way left to reach the release.
ck('no banner when there is no update', X.updBannerHTML()==='');
X.updateAvailable={ver:'9.9.9',url:'https://example.test/rel'};
const banner=X.updBannerHTML();
ck('the banner names the new version', banner.includes('9.9.9'), banner);
ck('the banner still shows the version you are on', banner.includes('v'+X.APP_VERSION), banner);
ck('the banner links to the release', banner.includes('https://example.test/rel'), banner);
ck('the banner reassures that characters are unaffected', /unaffected/i.test(banner), banner);
// a release title is attacker-controllable in principle; it must not become markup
X.updateAvailable={ver:'<img src=x>',url:'https://example.test/"onerror="x'};
ck('banner escapes the version', !X.updBannerHTML().includes('<img'), X.updBannerHTML());
ck('banner escapes the url', !/href="[^"]*"on/.test(X.updBannerHTML()), X.updBannerHTML());
X.updateAvailable=null;

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
  const w=X.fnum(def.weight); if(w)it.weight=w;
  if(def.weapon)it.weapon=def.weapon;
  X.stampSrc(it,def,'item','items','browse');
  X.character.inventory.push(it); return it;
}
function addGrantItem(name){                       /* grantItemByName shape */
  const def=(X.rules.items||[]).find(x=>x.name===name);
  const it={id:'g-'+name,name:def.name,qty:1,description:def.description||"",
            effects:def.effects||[],equipped:false,grant:'class:Bard'};
  const w=X.fnum(def.weight); if(w)it.weight=w;
  const c=X.costToGp(def.cost); if(c!=null)it.cost=c;
  if(def.category)it.category=def.category;
  if(def.type)it.type=def.type;
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
const feat=addFeat('Alert'); feat.fav=true;   /* character-local, like an item's star */
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
/* fav is absent from UPD_FIELDS.feature, so applyUpdateRow never names it and
   never writes it — the same guarantee an item's star has. */
ck('...and the favourite star', feat.fav===true);
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

// ---------- an edited spell must keep its stamp
// openSpellForm rebuilds its record from the form boxes, and dropped `src` — so
// editing one word of a spell threw away the only thing that ties the copy to
// the pack it came from. What that costs is asserted here; that the form
// actually carries it is a source guard in rules-data.js.
c=setup();
const eSp=addBrowseSpell('Bless');
eSp.text='My own wording.';                    /* the player edits it */
ck('a stamped spell resolves to the pack it came from',
   X.updResolve(eSp,'spell').def!==undefined && !X.updResolve(eSp,'spell').loose,
   X.updResolve(eSp,'spell'));
ck('...and the edit is DETECTED rather than unknowable', X.updEdited(eSp,'spell')===true);
const lostSp=JSON.parse(JSON.stringify(eSp)); delete lostSp.src;   /* what the bug produced */
ck('a spell that lost its stamp falls back to matching by name',
   X.updResolve(lostSp,'spell').loose===true, X.updResolve(lostSp,'spell'));
ck('...and its edit becomes unknowable', X.updEdited(lostSp,'spell')===null);
// a spell typed in by hand has no stamp to keep, and none is invented for it
c=setup();
const ownSp={id:'own',name:'Tess’s Trick',level:1,meta:'',text:'Mine.',prepared:false};
X.character.spells.push(ownSp);
ck('a hand-made spell carries no src at all', ownSp.src===undefined);
ck('...and is reported as unmatched, not silently adopted',
   (X.diffCharacter().rows.find(x=>x.name===ownSp.name)||{}).type==='unmatched',
   X.diffCharacter().rows.map(x=>x.name+':'+x.type));

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
ck('R2 a generated attack is stamped', typeof X.character.attacks[0].genFp==='string', X.character.attacks[0].genFp);
X.rules.items[1].weapon={kind:'melee',dice:'2d6',damageType:'bludgeoning',ability:'str',notes:''};
X.applyUpdates(X.diffCharacter().rows);
ck('R2 item weapon updated', club.weapon.dice==='2d6', club.weapon);
ck('R2 linked attack re-synced', X.character.attacks[0].damageDice==='2d6', X.character.attacks[0].damageDice);
ck('R2 attack id kept stable', X.character.attacks[0].id===atkId);
ck('R2 no duplicate attack', X.character.attacks.filter(a=>a.itemId===club.id).length===1);

/* R7 — …but a resync must NEVER overwrite an attack the player edited.
   updResyncAttack used to splice the row out and regenerate it from the item, so
   a renamed or re-dieced attack was destroyed with no warning and nothing to undo
   it. The row now carries `genFp`, one hash over the fields addAttackForItem
   generated, and only a row that still matches it may be rebuilt. Of the three
   answers updAtkEdited can give, two mean LEAVE IT. */
function armClub(){                    /* a club, its attack, and a pack change waiting */
  c=setup();
  const cl=addBrowseItem('Club'); cl.equipped=true;
  X.addAttackForItem(cl);
  X.rules.items[1].weapon={kind:'melee',dice:'2d6',damageType:'bludgeoning',ability:'str',notes:''};
  return cl;
}
// (a) the player edited it
let cl=armClub(), atk=X.character.attacks[0];
atk.name="Grandpa's Club"; atk.damageDice='1d6';
ck('R7 an edited attack reads as edited', X.updAtkEdited(atk)===true);
X.applyUpdates(X.diffCharacter().rows);
ck('R7 the item itself still updates', cl.weapon.dice==='2d6', cl.weapon.dice);
ck('R7 the edited attack is left exactly as the player left it',
   atk.damageDice==='1d6' && atk.name==="Grandpa's Club", atk);
ck('R7 and no rebuilt row appears beside it',
   X.character.attacks.filter(a=>a.itemId===cl.id).length===1, X.character.attacks.map(a=>a.name));

// (b) no stamp at all — a row saved before any of this existed
cl=armClub(); atk=X.character.attacks[0]; delete atk.genFp;
ck('R7 an unstamped attack is unknowable, not unedited', X.updAtkEdited(atk)===null);
X.applyUpdates(X.diffCharacter().rows);
ck('R7 an unstamped attack is left alone too', atk.damageDice==='1d4', atk.damageDice);
ck('R7 ...and still leaves no duplicate',
   X.character.attacks.filter(a=>a.itemId===cl.id).length===1, X.character.attacks.map(a=>a.name));

// (c) untouched — the only case that may be rebuilt
cl=armClub();
ck('R7 a freshly generated attack reads as untouched', X.updAtkEdited(X.character.attacks[0])===false);
X.applyUpdates(X.diffCharacter().rows);
ck('R7 an untouched attack is still rebuilt', X.character.attacks[0].damageDice==='2d6',
   X.character.attacks[0].damageDice);
ck('R7 ...and re-stamped, so it stays comparable next time',
   X.updAtkEdited(X.character.attacks[0])===false, X.character.attacks[0]);

// what the fingerprint covers, and what it deliberately does not.
// The two ticks are IN it: unticking proficiency on a weapon you are not
// proficient with is a deliberate edit, and a resync putting it back is exactly
// the override this guard exists to prevent.
cl=armClub(); atk=X.character.attacks[0];
atk.proficient=false;
ck('R7 unticking proficiency counts as an edit', X.updAtkEdited(atk)===true);
cl=armClub(); atk=X.character.attacks[0];
atk.addAbilityDamage=false;
ck('R7 unticking the ability-damage box counts as an edit', X.updAtkEdited(atk)===true);
ck('R7 ...so a resync leaves it alone', (X.applyUpdates(X.diffCharacter().rows),
   X.character.attacks[0].addAbilityDamage===false), X.character.attacks[0]);

// the generator never sets these, so they stay out
cl=armClub(); atk=X.character.attacks[0];
atk.extraDamage=[{dice:'1d6',type:'fire'}];
ck('R7 fields the generator never sets are outside the fingerprint',
   X.updAtkEdited(atk)===false, X.ATK_GEN_FIELDS);
atk.notes='Thrown, range 20/60';
ck('R7 a change to a generated field IS an edit', X.updAtkEdited(atk)===true);
ck('R7 the stamp is optional, so an old save loads untouched',
   X.migrate({abilities:{},attacks:[{id:'a1',name:'Club'}]}).attacks[0].genFp===undefined);
ck('R7 ...and a stamped one round-trips',
   X.migrate({abilities:{},attacks:[{id:'a1',name:'Club',genFp:'abc'}]}).attacks[0].genFp==='abc');

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

// ---------- class/background starting equipment (grantItemByName)
// Tested against the REAL function, not the fixture above: the fixture mirrored
// this copy site faithfully enough to hide a live bug for a whole release —
// granted items arrived with no gp value, because the pack writes cost as a
// display string ("1 gp") and only the browse path parsed it.
c=setup();
X.grantItemByName('Rope', 1, 'class:Bard');
let g = X.character.inventory.find(i => i.name === 'Rope');
ck('a granted item lands in the inventory', !!g);
ck('a granted item carries its cost', g.cost === 1, g.cost);
ck('...as a NUMBER, not the pack string', typeof g.cost === 'number', typeof g.cost);
ck('a granted item carries its weight', g.weight === 5);
// without these invSection() files everything that is not a weapon under Loot
ck('a granted item carries its category', g.category === 'Gear', g.category);
ck('a granted item carries its type', g.type === 'Adventuring Gear', g.type);
ck('a granted item is tagged with what granted it', g.grant === 'class:Bard');
ck('a granted item is stamped for the update tool', !!(g.src && g.src.fp));
ck('a freshly granted item raises no update rows',
   X.diffCharacter().rows.length === 0, X.diffCharacter().rows.map(x => x.name + ':' + x.why));

// granting the same thing twice stacks rather than duplicating
X.grantItemByName('Rope', 2, 'class:Bard');
ck('granting the same item again bumps the quantity',
   X.character.inventory.filter(i => i.name === 'Rope').length === 1 &&
   X.character.inventory.find(i => i.name === 'Rope').qty === 3);

// a grant naming something no loaded pack has must still produce a usable item
c = setup();
X.grantItemByName('Imaginary Trinket', 1, 'bg:Sage');
const un = X.character.inventory.find(i => i.name === 'Imaginary Trinket');
ck('a grant with no matching definition still adds the item', !!un);
ck('...with no cost invented for it', un.cost === undefined);
ck('...and no stamp, since there is nothing to compare against', un.src === undefined);

// a cost the parser cannot read must produce NO cost, not a broken one
c = setup();
X.rules.items.push({name: 'Priceless Thing', description: 'x', cost: 'varies', category: 'Gear'});
X.grantItemByName('Priceless Thing', 1, 'class:Bard');
const pr = X.character.inventory.find(i => i.name === 'Priceless Thing');
ck('an unparseable cost is left off rather than stored badly', pr.cost === undefined, pr.cost);
ck('the projection drops it too, so it never diffs',
   X.updProject(X.rules.items.find(i => i.name === 'Priceless Thing'), 'item', 'plain').cost === undefined);

// ---------- the backfill for characters that already have the bug
// A granted item saved by the old code has no cost and a stamp whose baseline
// says the cost should be the pack's raw string. The diff must notice, say so
// honestly, and applying must write the parsed number.
c = setup();
const old = addGrantItem('Rope');
delete old.cost;                                  // as the old grant path left it
old.src.fp.cost = X.fpHash('1 gp');               // the old raw-string projection
old.src.cfp.cost = X.fpHash(undefined);
const bf = X.diffCharacter().rows.find(r => r.name === 'Rope');
ck('a legacy granted item is flagged', !!bf && bf.fields.indexOf('cost') >= 0, bf && bf.fields);
ck('...and worded as missing, not as a pack change',
   bf && /missing/.test(bf.why) && !/changed/.test(bf.why), bf && bf.why);
ck('...and ticked, since the player never edited it', bf && bf.apply === true);
old.qty = 4; old.equipped = true; old.fav = true;
X.applyUpdateRow(bf);
ck('applying backfills the cost as a number', old.cost === 1, old.cost);
ck('...leaving the quantity alone', old.qty === 4);
ck('...leaving equipped alone', old.equipped === true);
ck('...leaving the favourite star alone', old.fav === true);
ck('and it goes quiet afterwards', X.diffCharacter().rows.length === 0,
   X.diffCharacter().rows.map(x => x.why));

// a real pack change to cost still reads as a change, not as missing
c = setup();
const ci = addGrantItem('Rope');
X.rules.items.find(i => i.name === 'Rope').cost = '9 gp';
const chg = X.diffCharacter().rows.find(r => r.name === 'Rope');
ck('a genuine cost change is still worded as changed',
   chg && /changed/.test(chg.why), chg && chg.why);
X.applyUpdateRow(chg);
ck('...and applies as a number', ci.cost === 9, ci.cost);

// ---------- level-1 max HP seeding
// A single class at level 1 has no roll and no choice, so max HP is the hit
// die's maximum PLUS the Constitution modifier, floored at 1. It must never
// overwrite a number the player typed, and it must not fire when multiclassing
// (the second class gets a rolled/average HP).
// blankChar() starts every ability at 10, so modOf is 0 and the plain-seeding
// assertions below still expect the bare die — that equality is the proof the
// CON term didn't change any existing number. The non-default-CON cases follow.
// These assert the MODEL only. The DOM half (renderHP) is inert here because the
// harness stubs getElementById to a proxy that swallows writes — so a broken HP
// input would still pass this block. That is what src/tests/rules-data.js's
// template guards are for; don't add DOM expectations here.
c=setup();
ck('hitDieMax parses "d8"', X.hitDieMax({hitDie:'d8'})===8);
ck('hitDieMax parses a bare number', X.hitDieMax({hitDie:'10'})===10);
ck('hitDieMax is 0 for junk', X.hitDieMax({hitDie:'big'})===0 && X.hitDieMax({})===0);
ck('hitDieMax is 0 for no def', X.hitDieMax(null)===0);

const hpSetup=(ruleClasses,con)=>{
  c=setup();
  X.resetRules(); X.mergeRules({classes:ruleClasses}, 'test');
  X.character.classes=[]; X.character.level=1;
  X.character.hp.max=''; X.character.hp.cur='';
  X.character.abilities.con=(con==null)?10:con;
};
const CLS=[{name:'Fighter',hitDie:'d10'},{name:'Wizard',hitDie:'d6'},{name:'Rogue',hitDie:'d8'},
           {name:'Peasant',hitDie:'d4'}];

hpSetup(CLS); X.addClass('Rogue',1);
ck('level 1 single class seeds max HP from the die + CON', X.num(X.character.hp.max)===8, X.character.hp.max);
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

// ---------- the CON term
hpSetup(CLS,16);
ck('level1HP adds a positive CON mod', X.level1HP({hitDie:'d8'})===11, X.level1HP({hitDie:'d8'}));
hpSetup(CLS,8);
ck('level1HP subtracts a negative CON mod', X.level1HP({hitDie:'d10'})===9, X.level1HP({hitDie:'d10'}));
ck('level1HP keeps 0 as the no-die sentinel',
   X.level1HP({hitDie:'big'})===0 && X.level1HP(null)===0);
// Floored at 1: a real 0 would be indistinguishable from the sentinel above,
// and effMaxHP()>0 is what clampHP and longRest read as "a maximum is set".
hpSetup(CLS,1);
ck('level1HP floors below zero at 1', X.level1HP({hitDie:'d4'})===1, X.level1HP({hitDie:'d4'}));
ck('level1HP floors at the boundary too', X.level1HP({hitDie:'d6'})===1, X.level1HP({hitDie:'d6'}));

hpSetup(CLS,16); X.addClass('Rogue',1);
ck('seeding at CON 16 gives die + 3', X.num(X.character.hp.max)===11, X.character.hp.max);
ck('...and starts at that full HP', X.num(X.character.hp.cur)===11, X.character.hp.cur);

hpSetup(CLS,16); X.character.hp.max=5; X.addClass('Rogue',1);
ck('a typed max still survives a non-default CON', X.num(X.character.hp.max)===5);

hpSetup(CLS,16); X.addClass('Fighter',1);
ck('Fighter at CON 16 seeds 13', X.num(X.character.hp.max)===13, X.character.hp.max);
X.removeClass(0);
ck('the un-seed recomputes the CON term too', X.character.hp.max==='' && X.character.hp.cur==='',
   X.character.hp.max+'/'+X.character.hp.cur);

// ---------- resyncLevel1HP: the seeded number keeps tracking CON
// Without this, seeding at CON 10 and then editing CON leaves hp.max stale, and
// removeClass's exact match silently stops firing — the clean-revert regression
// that putting CON in the formula would otherwise introduce.
hpSetup(CLS); X.addClass('Fighter',1);
X.character.abilities.con=16; X.resyncLevel1HP(10);
ck('resync follows CON up', X.num(X.character.hp.max)===13, X.character.hp.max);
ck('...and a character at full HP stays at full', X.num(X.character.hp.cur)===13, X.character.hp.cur);
X.removeClass(0);
ck('a resynced seed still un-seeds cleanly', X.character.hp.max==='', X.character.hp.max);

hpSetup(CLS); X.addClass('Fighter',1); X.character.hp.max=20; X.character.hp.cur=20;
X.character.abilities.con=16; X.resyncLevel1HP(10);
ck('resync leaves a max the player edited alone', X.num(X.character.hp.max)===20, X.character.hp.max);

hpSetup(CLS); X.addClass('Fighter',1); X.character.hp.cur=5;
X.character.abilities.con=16; X.resyncLevel1HP(10);
ck('resync moves the max of a damaged character', X.num(X.character.hp.max)===13);
ck('...but not their current HP', X.num(X.character.hp.cur)===5, X.character.hp.cur);

hpSetup(CLS); X.addClass('Fighter',1); X.resyncLevel1HP(10);
ck('resync is a no-op when CON did not change', X.num(X.character.hp.max)===10);

hpSetup(CLS); X.addClass('Fighter',2); X.character.hp.max=12;
X.character.abilities.con=16; X.resyncLevel1HP(10);
ck('resync stops at level 2 — that max is a rolled total', X.num(X.character.hp.max)===12);

hpSetup(CLS); X.addClass('Fighter',1); X.addClass('Wizard',1);
X.character.abilities.con=16; X.resyncLevel1HP(10);
ck('resync does not fire while multiclassed', X.num(X.character.hp.max)===10);

hpSetup(CLS); X.character.abilities.con=16; X.resyncLevel1HP(10);
ck('resync with no class at all is harmless', X.character.hp.max==='');

// Typing "16" into a number box fires per keystroke and passes through 1
// (mod -5). Each step recognises the previous step's own number, so the
// intermediate value is transient rather than sticky.
hpSetup(CLS); X.addClass('Fighter',1);
X.character.abilities.con=1; X.resyncLevel1HP(10);
ck('mid-typing CON 1 clamps a d10 to 5', X.num(X.character.hp.max)===5, X.character.hp.max);
X.character.abilities.con=16; X.resyncLevel1HP(1);
ck('...and the next keystroke recovers the right number', X.num(X.character.hp.max)===13,
   X.character.hp.max);
ck('...with current HP still tracking it', X.num(X.character.hp.cur)===13, X.character.hp.cur);

// ---------- the Max HP lock never gets in the automatic writers' way
// They write character.hp.max directly; only a PLAYER typing into the box goes
// through applyHPInput, which is where the lock lives. If someone ever routes
// them through the box "for consistency", a locked level-1 character silently
// ends up with no hit points at all.
hpSetup(CLS); X.character.hp.locked=true; X.addClass('Rogue',1);
ck('a locked box does not block the level-1 seed', X.num(X.character.hp.max)===8, X.character.hp.max);
ck('...and the lock is still on afterwards', X.character.hp.locked===true);

hpSetup(CLS); X.character.hp.locked=true; X.addClass('Rogue',1);
X.character.abilities.con=16; X.resyncLevel1HP(10);
ck('a locked box does not block the CON re-sync', X.num(X.character.hp.max)===11, X.character.hp.max);

hpSetup(CLS); X.character.hp.locked=true; X.addClass('Rogue',1); X.removeClass(0);
ck('a locked box does not block the clean un-seed', X.character.hp.max==='', X.character.hp.max);

// Levelling is the one moment Max HP legitimately changes and the app cannot
// compute it, so it hands the box back rather than making you fight a padlock.
hpSetup(CLS); X.addClass('Rogue',1); X.character.hp.locked=true; X.doLevelUp();
ck('levelling up unlocks Max HP so the new total can be typed', X.character.hp.locked===false);
ck('...and actually levelled', X.num(X.character.classes[0].level)===2);

// ---------- item weight is rules-owned, like cost
c=setup();
ck('weight is a tracked item field', (X.UPD_FIELDS.item||[]).includes('weight'));
const wRope=addBrowseItem('Rope');   /* pack says 5 lb */
ck('a browse copy carries the numeric weight', wRope.weight===5);
ck('a fresh copy of an unchanged pack reports nothing',
   X.diffCharacter().rows.length===0, X.diffCharacter().rows.map(x=>x.name+':'+x.fields));

X.rules.items.find(x=>x.name==='Rope').weight=10;
let wRows=X.diffCharacter().rows, wRow=wRows.find(x=>x.name==='Rope');
/* the meta line embeds the weight too, so a weight change legitimately moves
   both fields — what matters is that weight is named, not just prose */
ck('a pack weight change is reported', wRow&&wRow.type==='changed', wRows.map(x=>x.name+':'+x.type));
ck('and names the weight field', wRow&&wRow.fields.includes('weight'), wRow&&wRow.fields);
wRope.qty=7; wRope.equipped=true; wRope.fav=true;
X.applyUpdateRow(wRow);
ck('applying writes the new weight', wRope.weight===10, wRope.weight);
ck('the player quantity is untouched', wRope.qty===7);
ck('equipped state is untouched', wRope.equipped===true);
ck('the favourite star is untouched', wRope.fav===true);

/* R6 — the regression this guard exists for. A copy stamped BEFORE weight was
   a tracked field has no weight baseline. "No baseline" is not "the pack
   changed it": without the guard, adding any field to UPD_FIELDS flags every
   previously-stamped item on the sheet at once. */
c=setup();
const oldCopy=addBrowseItem('Rope');
delete oldCopy.src.fp.weight;                    /* as an older app would have left it */
ck('an item stamped before weight was tracked is not flagged',
   X.updChangedFields(oldCopy,X.rules.items.find(x=>x.name==='Rope'),'item').length===0,
   X.updChangedFields(oldCopy,X.rules.items.find(x=>x.name==='Rope'),'item'));
ck('...and so raises no row at all', X.diffCharacter().rows.length===0,
   X.diffCharacter().rows.map(x=>x.name+':'+x.fields));
/* but a field it DID have a baseline for still diffs normally */
X.rules.items.find(x=>x.name==='Rope').description='Changed rope.';
ck('a tracked field still diffs on the same copy',
   X.updChangedFields(oldCopy,X.rules.items.find(x=>x.name==='Rope'),'item').join()==='description');

/* the meta line is deliberately frozen: it is the shape a browse copy was made
   in, and changing it re-flags every browse-added item on every sheet forever */
c=setup();
ck('itemMetaLine still ends with the weight',
   X.itemMetaLine({type:'Adventuring Gear',cost:'1 gp',weight:5})==='Adventuring Gear · 1 gp · 5 lb',
   X.itemMetaLine({type:'Adventuring Gear',cost:'1 gp',weight:5}));

ck.done();
