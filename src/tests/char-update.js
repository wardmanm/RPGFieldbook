/* Character version stamp + the rules-update tool: fingerprints, diff
   classification, apply-preserves-local-state, backups, and the R1-R5
   regressions for bugs the first version of this suite missed. */
const fs = require('fs'), path = require('path');
const {loadApp, makeCheck} = require('./harness');

const ck = makeCheck();
const {X, ctx, state, store, bootError, fragments} = loadApp([
  'APP_VERSION','RULE_CATS','cmpVer','blankChar','migrate',
  'fpHash','fpMap','fpNorm','stampSrc','restampSrc',
  'updProject','updEdited','itemMetaLine','costToGp','addAttackForItem','findClassDef',
  'atkGenFp','stampAtkGen','updAtkEdited','ATK_GEN_FIELDS',
  'diffCharacter','applyUpdateRow','applyUpdates','charNeedsUpdate','updResolve','updChangedFields',
  'backupCharacter','libLoad','charKey','mergeRules','resetRules','addFeatureFromDef',
  'addClass','removeClass','doLevelUp','hitDieMax','level1HP','resyncLevel1HP','modOf',
  'totalLevel','num','fnum','UPD_FIELDS','updBannerHTML',
  'grantItemByName',
  'hpFixed','hpGain','hpGainText','choiceFieldHTML','commitChoices','classChipHTML','subSourceTag','runChoices',
  'syncResources','resolveResDie','openModal','dismissModal','skillKey','multiclassNote',
  'attackNumbers','addLibraryItems',
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

/* #74 — a pack weapon whose bonus used to count twice. The old packs wrote a
   +N weapon's bonus as weapon.atkMisc/dmgMisc AND as global attack/damage
   effects; the fixed pack drops the effects. A sheet holds a COPY, so it keeps
   the effects until the rules-update tool rewrites them — never on load. What it
   must offer: exactly `effects`, ticked for an untouched copy, and applying it
   must leave the weapon, the attack row and the player's numbers alone. The
   "new" entry is read from the shipped pack, so this fails until the pack is
   fixed; the "old" one is that entry with the effects it used to carry. */
{
  const shipped=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','data','5e2024','items-magic.json'),'utf8'))
    .items.find(x=>x.name==='Dagger of Venom');
  const clubDef={name:'Club',description:'A club.',cost:'1 sp',category:'Weapon',type:'Simple Melee Weapon',weight:2,
                 weapon:{kind:'melee',dice:'1d4',damageType:'bludgeoning',ability:'str',notes:''}};
  const oldDef=Object.assign(JSON.parse(JSON.stringify(shipped)),
                             {effects:[{target:'attack',value:1},{target:'damage',value:1}]});
  const oldSheet=()=>{
    X.resetRules(); X.mergeRules({system:'XPHB',items:[JSON.parse(JSON.stringify(oldDef)),clubDef]},'5e.json');
    const ch=X.blankChar(); ch.appVersion='1.0.0'; ch.name='Vex';
    ch.abilities.str=10; ch.abilities.dex=16; ch.level=1;
    X.character=ch; X.activeId=ch.id;
    X.addLibraryItems(X.rules.items.slice(),null,null,1);         /* the item finder, both equipped */
    return ch;
  };
  const fixPack=()=>{ X.resetRules(); X.mergeRules({system:'XPHB',items:[JSON.parse(JSON.stringify(shipped)),clubDef]},'5e.json'); };
  const dagOf=ch=>ch.inventory.find(i=>i.name==='Dagger of Venom');
  const rowOf=(ch,nm)=>ch.attacks.find(a=>a.name===nm);

  let ch=oldSheet(), dag=dagOf(ch);
  ck('#74 an old sheet shows the bug: the dagger +7, the Club +3',
     X.attackNumbers(rowOf(ch,'Dagger of Venom')).toHit===7&&X.attackNumbers(rowOf(ch,'Club')).toHit===3,
     [X.attackNumbers(rowOf(ch,'Dagger of Venom')),X.attackNumbers(rowOf(ch,'Club'))]);
  ch.inventory.forEach(i=>{i.qty=2;i.fav=true;});                  /* the player's own numbers */
  const atkId=rowOf(ch,'Dagger of Venom').id;
  fixPack();
  let rows=X.diffCharacter().rows, row=rows.find(r=>r.name==='Dagger of Venom');
  ck('#74 the fixed pack is offered as one changed row: effects, and nothing else',
     !!row&&row.type==='changed'&&row.fields.join()==='effects', rows.map(r=>r.name+':'+r.type+':'+r.fields));
  ck('#74 ...ticked, since nobody edited the copy', !!row&&row.apply===true&&row.edited===false, row&&[row.apply,row.edited]);
  ck('#74 ...and the Club is not offered at all', !rows.some(r=>r.name==='Club'), rows.map(r=>r.name));
  X.applyUpdates(row?[row]:[]);
  ck('#74 applying it removes the double-counted effects', Array.isArray(dag.effects)&&dag.effects.length===0, dag.effects);
  ck('#74 ...keeps the weapon\'s own +1', dag.weapon.atkMisc===1&&dag.weapon.dmgMisc===1, dag.weapon);
  ck('#74 ...touches none of the player\'s numbers', dag.equipped===true&&dag.qty===2&&dag.fav===true, dag);
  ck('#74 ...keeps the attack row (same id, one row)',
     ch.attacks.filter(a=>a.itemId===dag.id).length===1&&rowOf(ch,'Dagger of Venom').id===atkId);
  ck('#74 ...and the sheet now reads the dagger +6 and the Club +2',
     X.attackNumbers(rowOf(ch,'Dagger of Venom')).toHit===6&&X.attackNumbers(rowOf(ch,'Club')).toHit===2,
     [X.attackNumbers(rowOf(ch,'Dagger of Venom')),X.attackNumbers(rowOf(ch,'Club'))]);
  ck('#74 ...and nothing is offered again', !X.diffCharacter().rows.some(r=>r.name==='Dagger of Venom'),
     X.diffCharacter().rows.map(r=>r.name+':'+r.fields));

  /* a copy the player edited is offered, but not ticked: an update never guesses */
  ch=oldSheet(); dag=dagOf(ch); dag.description+=' Mine now.';
  fixPack();
  row=X.diffCharacter().rows.find(r=>r.name==='Dagger of Venom');
  ck('#74 an edited copy is offered unticked, flagged as edited', !!row&&row.apply===false&&row.edited===true,
     row&&[row.apply,row.edited,row.fields]);
  X.applyUpdates(row?[row]:[]);                                    /* the player ticks it anyway */
  ck('#74 ...and ticking it writes only the effects, keeping their wording',
     dag.effects.length===0&&/ Mine now\.$/.test(dag.description), [dag.effects,dag.description.slice(-20)]);

  /* nothing touches a saved character on load */
  ch=oldSheet();
  const m=X.migrate(JSON.parse(JSON.stringify(ch)));
  ck('#74 migrate() leaves the old effects on a saved copy', dagOf(m).effects.length===2, dagOf(m).effects);
  X.resetRules();
}

/* #75 — the Dart shipped ability "dex": the converter gave every ranged weapon
   DEX and ignored Finesse. An existing sheet's Dart is a copy, so the fix
   reaches it only through the tool: the item's `weapon` changed, and its
   untouched attack row is rebuilt with "finesse"; a row the player edited
   keeps what they set. The "new" Dart is the shipped one, so this fails until
   the pack is fixed. */
{
  const dartNew=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','data','5e2024','items.json'),'utf8'))
    .items.find(x=>x.name==='Dart');
  const dartOld=JSON.parse(JSON.stringify(dartNew)); dartOld.weapon.ability='dex';
  const sheetWith=def=>{
    X.resetRules(); X.mergeRules({system:'XPHB',items:[JSON.parse(JSON.stringify(def))]},'5e.json');
    const ch=X.blankChar(); ch.appVersion='1.0.0'; ch.abilities.str=18; ch.abilities.dex=12; ch.level=1;
    X.character=ch; X.activeId=ch.id;
    X.addLibraryItems(X.rules.items.slice(),null,null,10);
    return ch;
  };
  const fix=()=>{ X.resetRules(); X.mergeRules({system:'XPHB',items:[JSON.parse(JSON.stringify(dartNew))]},'5e.json'); };
  let ch=sheetWith(dartOld), row0=ch.attacks[0];
  ck('#75 an old sheet\'s Dart uses DEX even for a strong thrower', X.attackNumbers(row0).abilName==='DEX'
     &&X.attackNumbers(row0).toHit===3, X.attackNumbers(row0));
  const id0=row0.id; ch.inventory[0].qty=7;
  fix();
  let row=X.diffCharacter().rows.find(r=>r.name==='Dart');
  ck('#75 the fixed Dart is offered as its weapon changing, ticked', !!row&&row.fields.join()==='weapon'&&row.apply===true,
     X.diffCharacter().rows.map(r=>r.name+':'+r.fields+':'+r.apply));
  X.applyUpdates(row?[row]:[]);
  ck('#75 applying it gives the item finesse', ch.inventory[0].weapon.ability==='finesse'&&ch.inventory[0].qty===7, ch.inventory[0]);
  ck('#75 ...and rebuilds its untouched attack with finesse, same id, still ranged',
     ch.attacks.length===1&&ch.attacks[0].id===id0&&ch.attacks[0].ability==='finesse'&&ch.attacks[0].kind==='ranged', ch.attacks);
  ck('#75 ...so the strong thrower now uses STR: +6', X.attackNumbers(ch.attacks[0]).toHit===6, X.attackNumbers(ch.attacks[0]));
  /* an attack the player already fixed by hand, or otherwise tuned, is theirs */
  ch=sheetWith(dartOld); ch.attacks[0].ability='str';
  fix();
  row=X.diffCharacter().rows.find(r=>r.name==='Dart');
  X.applyUpdates(row?[row]:[]);
  ck('#75 an attack the player edited is left as they set it', ch.attacks.length===1&&ch.attacks[0].ability==='str',
     ch.attacks);
  X.resetRules();
}

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

/* A first class that starts above level 1 used to get no hit points at all:
   the seed only fired at total level 1, and the levels above it asked nothing.
   Level 1 is still the full die + CON; levels 2..N ride the level's own HP step
   (#66, found alongside it). The step itself is asserted in the #66 block. */
hpSetup(CLS); X.addClass('Fighter',3);
ck('starting above level 1 still seeds level 1', X.num(X.character.hp.max)===10, X.character.hp.max);

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

// ---------- the hit-point step on every level-up (#58)
// There was never an HP prompt: levelling only unlocked the box, so the choice
// modal a subclass level opens was all the player saw and the hit points were
// forgotten. Every level-up now carries a synthesized {type:"hp"} choice that
// rides the same modal and commit as the level's other picks.
ck('fixed HP is half the die plus one', X.hpFixed(6)===4 && X.hpFixed(8)===5 && X.hpFixed(10)===6 && X.hpFixed(12)===7);
ck('fixed HP is 0 with no die', X.hpFixed(0)===0);
ck('blank dice take the fixed value, plus CON', X.hpGain(10,1,null,2)===8 && X.hpGain(10,1,'',2)===8);
ck('a typed roll replaces the fixed value', X.hpGain(10,1,'3',2)===5);
ck('never less than 1 hit point a level', X.hpGain(6,1,'1',-3)===1 && X.hpGain(6,2,'2',-3)===2);
ck('several levels add CON once per level', X.hpGain(6,3,null,1)===15);

ck('the average reads as working, not a bare number',
   X.hpGainText({die:10,levels:1},'',2,20,'')==='Average 6 + 2 CON = 8 HP · Max HP 20 → 28',
   X.hpGainText({die:10,levels:1},'',2,20,''));
ck('a negative CON reads as a minus',
   X.hpGainText({die:8,levels:1},'4',-1,9,'')==='4 − 1 CON = 3 HP · Max HP 9 → 12',
   X.hpGainText({die:8,levels:1},'4',-1,9,''));
ck('a roll says it was rolled',
   X.hpGainText({die:8,levels:1},'4',0,9,'Rolled 4').indexOf('Rolled 4 — 4 + 0 CON = 4 HP')===0,
   X.hpGainText({die:8,levels:1},'4',0,9,'Rolled 4'));
ck('several levels show CON per level',
   X.hpGainText({die:6,levels:3},'',1,10,'')==='Average 12 + 3×1 CON = 15 HP · Max HP 10 → 25',
   X.hpGainText({die:6,levels:3},'',1,10,''));

{
  const h=X.choiceFieldHTML({type:'hp',die:10,levels:1,cls:'Fighter',_level:4},0,null);
  ck('the HP block is a .choice the gatherer reads', /data-ctype="hp"/.test(h) && /data-hp-dice/.test(h), h);
  ck('...names the die to pick up', /1d10/.test(h), h);
  ck('...and offers the average as the default', /placeholder="6 \(average\)"/.test(h), h);
  const n=X.choiceFieldHTML({type:'hp',die:0,levels:1,cls:'Homebrewer',_level:2},0,null);
  ck('a class with no hit die still asks, with no average to offer',
     /data-hp-dice/.test(n) && !/average/.test(n), n);
}

// Taking the average: max AND current go up, and the lock is put back the way
// the player had it — the unlock is only the fallback for a dismissed prompt.
hpSetup(CLS); X.addClass('Fighter',1); X.character.hp.locked=true; X.doLevelUp();
X.commitChoices('Fighter',[{type:'hp',ci:0,dice:''}]);
ck('the average lands on max HP', X.num(X.character.hp.max)===16, X.character.hp.max);
ck('...and on current HP', X.num(X.character.hp.cur)===16, X.character.hp.cur);
ck('...and the box is locked again, as it was before levelling', X.character.hp.locked===true);

hpSetup(CLS,14); X.addClass('Fighter',1); X.doLevelUp();
X.commitChoices('Fighter',[{type:'hp',ci:0,dice:'3'}]);
ck('a typed roll adds CON once', X.num(X.character.hp.max)===12+5, X.character.hp.max);

hpSetup(CLS); X.addClass('Fighter',1); X.character.hp.locked=false; X.doLevelUp();
X.commitChoices('Fighter',[{type:'hp',ci:0,dice:''}]);
ck('a box the player had unlocked stays unlocked', X.character.hp.locked===false);

hpSetup(CLS); X.addClass('Fighter',1); X.character.hp.cur=3; X.doLevelUp();
X.commitChoices('Fighter',[{type:'hp',ci:0,dice:''}]);
ck('a hurt character gains the same hit points on top', X.num(X.character.hp.cur)===9, X.character.hp.cur);

// A custom class has no die: blank means "I'll type it", a number is the total.
hpSetup(CLS); X.addClass('Homebrewer',1); X.character.hp.max=12; X.character.hp.cur=12;
X.character.hp.locked=true; X.doLevelUp();
X.commitChoices('Homebrewer',[{type:'hp',ci:0,dice:''}]);
ck('no die and nothing typed changes nothing', X.num(X.character.hp.max)===12, X.character.hp.max);
ck('...and leaves the box unlocked to type into', X.character.hp.locked===false);
X.doLevelUp(); X.commitChoices('Homebrewer',[{type:'hp',ci:0,dice:'7'}]);
ck('no die and a number typed adds exactly that', X.num(X.character.hp.max)===19, X.character.hp.max);

// THE #58 regression: the subclass level. HP must land even though the same
// Done also picks a subclass, which opens a second modal of its own.
{
  const F=[{name:'Fighter',hitDie:'d10',levels:{'3':{choices:[{type:'subclass',label:'Fighter Subclass'}]}},
            subclasses:{'Battle Master':{description:'Students of war.',levels:{'3':{traits:[{name:'Combat Superiority'}]}}}}}];
  hpSetup(F); X.addClass('Fighter',2); X.character.hp.max=20; X.character.hp.cur=20; X.doLevelUp();
  X.commitChoices('Fighter',[{type:'hp',ci:0,dice:''},{type:'subclass',name:'Battle Master'}]);
  ck('a subclass level still gains its hit points', X.num(X.character.hp.max)===26, X.character.hp.max);
  ck('...and still takes the subclass', X.character.classes[0].subclass==='Battle Master');
  ck('...with its features', X.character.features.some(f=>f.name==='Combat Superiority'));
  const s=X.choiceFieldHTML({type:'subclass',label:'Fighter Subclass'},1,X.findClassDef('Fighter'));
  ck('the level-up subclass picker shows each description (#59)', /Students of war\./.test(s), s);
}

// ---------- option pickers that come back (#60)
// Maneuvers, invocations and metamagic are offered again at every later level
// from the same list, so what the sheet already has must not be offered twice.
{
  hpSetup(CLS); X.addClass('Fighter',1);
  X.character.features.push({id:'m1',name:'Parry',description:'',effects:[]});
  const man={type:'option',label:'Maneuvers: choose 2 more',choose:2,
             from:[{name:'Parry'},{name:'Riposte'},{name:'Rally'},{name:'Agonizing Blast',repeatable:true}]};
  const h=X.choiceFieldHTML(man,0,null);
  const row=n=>(h.match(new RegExp('<input[^>]*>[^<]*<span><b>'+n+'</b>'))||[''])[0];
  ck('an option already on the sheet is ticked and fixed', /checked disabled data-fixed/.test(row('Parry')), row('Parry'));
  ck('...and says so', /Parry<\/b>[^<]*\(already yours\)/.test(h), h);
  ck('a new option is open', !/disabled/.test(row('Riposte')), row('Riposte'));
  ck('the count still asks for the full rise', /data-choose="2"/.test(h), h);
  X.character.features.push({id:'m2',name:'Agonizing Blast',description:'',effects:[]});
  ck('a repeatable option stays open once taken',
     !/disabled/.test((X.choiceFieldHTML(man,0,null).match(/<input[^>]*>[^<]*<span><b>Agonizing Blast<\/b>/)||[''])[0]));
  const one=X.choiceFieldHTML({type:'option',label:'Eldritch Invocations: choose 1 more',choose:1,from:[{name:'Parry'},{name:'Rally'}]},0,null);
  ck('a single-pick list disables an owned option without ticking it',
     /type="radio"[^>]*disabled/.test((one.match(/<input[^>]*>[^<]*<span><b>Parry<\/b>/)||[''])[0])
     && !/checked/.test((one.match(/<input[^>]*>[^<]*<span><b>Parry<\/b>/)||[''])[0]), one);
}
ck('gatherChoices never re-grants a fixed option',
   /t==="option"[^\n]*\[data-opt-i\]:checked:not\(:disabled\)/.test(fs.readFileSync(path.join(__dirname,'../js/58-choices.js'),'utf8')));

ck('a reprint keyed with its pack is not tagged twice', X.subSourceTag('Psi Warrior (TCE)',{_source:'TCE'})==='');
ck('...but an ordinary subclass still shows its pack', X.subSourceTag('Battle Master',{_source:'XPHB'})==='XPHB');
ck('...and one with no pack shows nothing', X.subSourceTag('Engineer',{})==='');

// A picked maneuver spends a Superiority Die: its cost must reach the sheet, or
// the feature has no Use button and the tracker is never touched.
{
  hpSetup(CLS); X.addClass('Fighter',3);
  X.runChoices('Fighter',[{type:'option',label:'Maneuvers: choose 3',choose:3,_level:3,_sid:'subclass:Fighter:Battle Master',
    from:[{name:'Parry',description:'Reduce the damage.',cost:{resource:'Superiority Dice',amount:1}},{name:'Rally',description:'Temp HP.'}]}],[]);
  X.commitChoices('Fighter',[{type:'option',ci:0,sid:'subclass:Fighter:Battle Master',idxs:[0,1]}]);
  const parry=X.character.features.find(f=>f.name==='Parry'), rally=X.character.features.find(f=>f.name==='Rally');
  ck('a picked option keeps what it spends', parry&&parry.cost&&parry.cost.resource==='Superiority Dice'&&parry.cost.amount===1, parry);
  ck('...and one that spends nothing has no cost', rally&&!rally.cost, rally);
  ck('...and both belong to the subclass, so they revert with it', parry&&parry.origin&&parry.origin.subclass==='Battle Master');
}

// The starting-equipment picker belongs to the Add class window that queued it.
// It used to sit in a module global, so closing that window without Done left it
// queued, and it popped up after the NEXT level-up's Done instead.
{
  const EQ=[{name:'Fighter',hitDie:'d10',
    equipmentGrants:[{label:'Starting equipment',choose:[{items:[{name:'Rope'}]},{gold:10}]}],
    levels:{'1':{choices:[{type:'skill',choose:1,from:['Athletics','History']}]}}}];
  hpSetup(EQ);
  const real=ctx.runExtraChoices; let got=null;
  ctx.runExtraChoices=p=>{got=p;};
  try{
    X.addClass('Fighter',1);                 /* opens the class window (skills), queues equipment */
    /* ...which the player closes without Done. Then they level up and press Done: */
    X.doLevelUp(); got=null;
    X.commitChoices('Fighter',[{type:'hp',ci:0,dice:''}]);
    ck('a dismissed window does not leak its equipment picker into the next level-up',
       !(got||[]).some(x=>x&&x.kind==='equip'), got);
    /* and a window that IS completed still hands its own picker on */
    hpSetup(EQ); got=null;
    X.commitChoices('Fighter',[],[{kind:'equip',sid:'class:Fighter',label:'Starting equipment',options:[{gold:10}]}]);
    ck('...while a completed window still hands its picker on', (got||[]).some(x=>x&&x.kind==='equip'), got);
  }finally{ctx.runExtraChoices=real;}
}
ck('no module-level equipment queue is left to leak',
   !/_equipQueue/.test(fragments.map(f=>fs.readFileSync(path.join(__dirname,'../..',f),'utf8')).join('\n')));
ck("the class window's Done hands its own queue to commitChoices",
   /function runChoices\(className,choices,notes,pending\)[\s\S]*?commitChoices\(className,sel,pending\)/.test(
     fs.readFileSync(path.join(__dirname,'../js/58-choices.js'),'utf8')));

// ---------- #63: every choice window is shown, one after another
// Add a Fighter at level 3 and pick Battle Master: the subclass's own window
// (Maneuvers, Student of War) opened and was at once replaced by the
// starting-equipment picker, because commitChoices() opened both and there is
// only one modal. Driven with the REAL 2024 Fighter and the real flow: addClass,
// runChoices, commitChoices, selectSubclass, runExtraChoices, dismissModal. The
// DOM is stubbed, so the only doubles are the ones it forces — the player's
// picks (gatherChoices) and the Done buttons, captured so the test can press
// them. openModal is only recorded; it still runs.
{
  const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../../data/5e2024/classes.json'),'utf8'));
  const real={open:ctx.openModal,gather:ctx.gatherChoices,byId:ctx.document.getElementById};
  let shown=[],done={},picks=[];
  ctx.openModal=(t,h,i)=>{shown.push({title:t,html:String(h)});return real.open(t,h,i);};
  ctx.gatherChoices=()=>picks;
  ctx.document.getElementById=id=>(id==='chDone'||id==='xchDone')
    ?{addEventListener:(ev,fn)=>{done[id]=fn;}}:real.byId(id);
  /* Press a window's Done with these picks: whatever it opens is what came next. */
  const press=(id,sel)=>{picks=sel;const fn=done[id];done[id]=null;const from=shown.length;if(fn)fn();return shown.slice(from);};
  const fresh=classes=>{
    hpSetup(classes);shown=[];done={};picks=[];
    X.mergeRules({feats:[{name:'Skilled',description:'Three skills.',
      choices:[{type:'skill',choose:3,from:['Arcana','History','Nature','Religion']}]}]},'test-feats');
  };
  const equip=w=>!!w&&/data-ctype="equip"/.test(w.html);
  const maneuvers=w=>!!w&&/Maneuvers: choose 3/.test(w.html)&&/Student of War/.test(w.html);
  try{
    fresh(pack.classes);
    X.addClass('Fighter',3);
    ck('#63 adding a Fighter at 3 opens the class window first', shown.length===1&&/Fighter Subclass/.test(shown[0].html),
       shown.map(w=>w.title));
    let next=press('chDone',[{type:'subclass',name:'Battle Master'}]);
    ck('#63 picking Battle Master opens its own window next: Maneuvers and Student of War',
       next.length>=1&&maneuvers(next[0]), next.map(w=>w.title));
    ck('#63 ...and nothing replaces it: the equipment picker waits behind it',
       next.length===1&&!equip(next[next.length-1]), next.map(w=>w.title));
    const bm='subclass:Fighter:Battle Master',ath=X.skillKey('Athletics');
    next=press('chDone',[{type:'option',ci:0,sid:bm,idxs:[0,1,2]},{type:'skill',sid:bm,keys:[ath]},
                         {type:'option',ci:2,sid:bm,idxs:[0]}]);
    const mine=n=>X.character.features.find(f=>f.name===n&&f.origin&&f.origin.subclass==='Battle Master');
    ck('#63 the maneuvers picked in that window are on the sheet, as Battle Master\'s',
       !!(mine('Ambush')&&mine('Bait and Switch')&&mine("Commander's Strike")),
       X.character.features.map(f=>f.name));
    ck('#63 ...and Student of War\'s skill and tool too',
       X.character.grants.some(g=>g.sid===bm&&g.type==='skill'&&g.key===ath)&&!!mine("Alchemist's Supplies"),
       X.character.grants);
    ck('#63 then the starting-equipment picker, last', next.length===1&&equip(next[0]), next.map(w=>w.title));
    ck('#63 ...and its Done opens nothing more', press('xchDone',[]).length===0);

    // A subclass with nothing to choose at that level hands the queue straight on.
    fresh(pack.classes); X.addClass('Fighter',3);
    next=press('chDone',[{type:'subclass',name:'Champion'}]);
    ck('#63 a subclass with no picks goes straight to the equipment picker',
       next.length===1&&equip(next[0]), next.map(w=>w.title));

    // Dismissing the subclass window costs its own picks (the guard says so), not
    // the class's starting equipment: the class is already on the sheet.
    fresh(pack.classes); X.addClass('Fighter',3);
    press('chDone',[{type:'subclass',name:'Battle Master'}]);
    let from=shown.length; X.dismissModal();
    ck('#63 dismissing the subclass window still offers the starting equipment',
       shown.length===from+1&&equip(shown[from]), shown.slice(from).map(w=>w.title));
    from=shown.length; X.dismissModal();
    ck('#63 ...and dismissing that opens nothing more', shown.length===from);

    // What waits behind a window belongs to THAT window: another window taking
    // the modal drops it, so it cannot fire after some later dismissal (the
    // _equipQueue leak, through the new route).
    fresh(pack.classes); X.addClass('Fighter',3);
    press('chDone',[{type:'subclass',name:'Battle Master'}]);
    X.openModal('Something else','<p>unrelated</p>');
    from=shown.length; X.dismissModal();
    ck('#63 a window replaced by another does not leak its queue into that one\'s dismissal',
       shown.length===from, shown.slice(from).map(w=>w.title));

    // L2571: a feat with a skill choice and a subclass at the same level raced
    // the same way. The feat's skills and the equipment come after the subclass.
    fresh([{name:'Tester',hitDie:'d8',
      equipmentGrants:[{label:'Starting equipment',choose:[{gold:10},{items:[{name:'Rope'}]}]}],
      levels:{'1':{choices:[{type:'feat',label:'Origin feat',from:['Skilled']},{type:'subclass',label:'Tester Subclass'}]}},
      subclasses:{'Path of Tests':{description:'x',levels:{'1':{choices:[{type:'option',label:'Pick a knack',choose:1,
        from:[{name:'Knack',description:'A knack.'}]}]}}}}}]);
    X.addClass('Tester',1);
    next=press('chDone',[{type:'feat',name:'Skilled'},{type:'subclass',name:'Path of Tests'}]);
    ck('#63 feat + subclass at one level: the subclass window comes first, alone',
       next.length===1&&/Pick a knack/.test(next[0].html), next.map(w=>w.title));
    next=press('chDone',[{type:'option',ci:0,sid:'subclass:Tester:Path of Tests',idxs:[0]}]);
    ck('#63 ...then one window with the feat\'s skills and the equipment',
       next.length===1&&/Feat: Skilled/.test(next[0].html)&&/data-skill-opt/.test(next[0].html)&&equip(next[0]),
       next.map(w=>w.title));
    ck('#63 ...and the knack was kept', X.character.features.some(f=>f.name==='Knack'));
  }finally{ctx.openModal=real.open;ctx.gatherChoices=real.gather;ctx.document.getElementById=real.byId;}
}

// ---------- #69: a choice window's title names the levels it holds, as written
// runChoices() titled every window "<class> — Level <first choice's level>", so a
// Fighter added at 3 opened as "Level 3" (or "Level 1") over picks that ran from
// level 1 to the level-3 subclass. And it passed the class name through esc()
// into a title openModal() sets as TEXT, so "&" and "'" showed as entities. What
// is checked is what reaches the title element: openModal() runs for real and
// #mTitle is a recorder. The real 2024 pack, through the real flow.
{
  const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../../data/5e2024/classes.json'),'utf8'));
  const real={byId:ctx.document.getElementById,gather:ctx.gatherChoices};
  let writes=[],done={},picks=[];
  const mTitle={set textContent(v){writes.push({text:String(v)});},get textContent(){return '';},
                set innerHTML(v){writes.push({html:String(v)});},get innerHTML(){return '';}};
  /* What the player reads in the header: text as written, or markup the way a
     browser would show it — so a contract change cannot pass by accident. */
  const decode=h=>h.replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
  const shown=()=>writes.map(w=>'text' in w?w.text:decode(w.html));
  ctx.gatherChoices=()=>picks;
  ctx.document.getElementById=id=>id==='mTitle'?mTitle
    :(id==='chDone'||id==='xchDone')?{addEventListener:(ev,fn)=>{done[id]=fn;}}:real.byId(id);
  const press=(id,sel)=>{picks=sel;const fn=done[id];done[id]=null;const from=writes.length;if(fn)fn();return shown().slice(from);};
  const fresh=extra=>{hpSetup(pack.classes);if(extra)X.mergeRules({classes:extra},'test-69');writes=[];done={};picks=[];};
  const at=(name,level,subclass)=>{X.character.classes=[{name,level,subclass:subclass||null}];X.character.level=level;writes=[];};
  try{
    fresh(); X.addClass('Fighter',3);
    ck('#69 a Fighter added at 3: its window names the levels it holds', shown()[0]==='Fighter — Levels 1–3', shown());
    let next=press('chDone',[{type:'subclass',name:'Battle Master'}]);
    ck('#69 ...the Battle Master window after it holds level 3 alone', next[0]==='Fighter — Level 3', next);

    fresh(); at('Fighter',3); X.doLevelUp();
    ck('#69 a single-level level-up says "Level N"', shown()[0]==='Fighter — Level 4', shown());
    fresh(); at('Fighter',2); X.doLevelUp();
    ck('#69 ...including the level that brings the subclass', shown()[0]==='Fighter — Level 3', shown());

    fresh(); at('Fighter',10,'Champion'); ctx.selectSubclass('Fighter','Battle Master');
    ck('#69 changing subclass at 10: its own window spans the subclass levels it re-asks',
       shown()[0]==='Fighter — Levels 3–10', shown());

    fresh(); X.addClass('Fighter',1);
    ck('#69 a first class at level 1 says "Level 1"', shown()[0]==='Fighter — Level 1', shown());
    writes=[]; X.addClass('Wizard',3);
    ck('#69 a multiclass added at 3: its HP step covers 1-3, and the title says so',
       shown()[0]==='Wizard — Levels 1–3', shown());
    fresh(); X.addClass('Fighter',1); writes=[]; X.addClass('Wizard',1);
    ck('#69 ...and a multiclass added at 1 says "Level 1"', shown()[0]==='Wizard — Level 1', shown());

    /* The 2024 Bard has no level-1 choice (known issue), so at 3 its only
       level-1 content is the Spellcasting note — which counts: the window shows it. */
    fresh(); X.addClass('Bard',3);
    ck('#69 a Bard added at 3: the level-1 spell note counts as held', shown()[0]==='Bard — Levels 1–3', shown());
    fresh(); X.addClass('Bard',1);
    ck('#69 ...and a notes-only window at level 1 says "Level 1"', shown()[0]==='Bard — Level 1', shown());

    const odd="Tom & Jerry's <Brawler>";
    fresh([{name:odd,hitDie:'d8',levels:{'1':{choices:[{type:'skill',choose:1,from:['Athletics','History']}]}}}]);
    X.addClass(odd,1);
    ck('#69 a class name with & \' and < shows as written, not as entities', shown()[0]===odd+' — Level 1', shown());
    ck('#69 ...because the title is written as text, never markup', writes.length>0&&writes.every(w=>'text' in w), writes);
  }finally{ctx.gatherChoices=real.gather;ctx.document.getElementById=real.byId;}
}
/* The rule itself, without the flow: a window spans the levels its choices and
   notes carry; an HP step covers `levels` levels ending at its own. */
{
  const T=(n,c,notes)=>typeof ctx.choiceWindowTitle==='function'?ctx.choiceWindowTitle(n,c,notes):'(no choiceWindowTitle)';
  ck('#69 title: one level', T('Rogue',[{type:'asi',_level:4},{type:'hp',levels:1,_level:4}])==='Rogue — Level 4',
     T('Rogue',[{type:'asi',_level:4},{type:'hp',levels:1,_level:4}]));
  ck('#69 title: the HP step\'s own span counts', T('Rogue',[{type:'hp',levels:3,_level:3}])==='Rogue — Levels 1–3',
     T('Rogue',[{type:'hp',levels:3,_level:3}]));
  ck('#69 title: whichever choice comes first', T('Rogue',[{type:'subclass',_level:3},{type:'skill',_level:1}])==='Rogue — Levels 1–3',
     T('Rogue',[{type:'subclass',_level:3},{type:'skill',_level:1}]));
  ck('#69 title: a note with a level counts', T('Rogue',[{type:'subclass',_level:3}],[{text:'x',_level:2}])==='Rogue — Levels 2–3',
     T('Rogue',[{type:'subclass',_level:3}],[{text:'x',_level:2}]));
  ck('#69 title: nothing with a level names no level', T('Rogue',[],['A plain note.'])==='Rogue',
     T('Rogue',[],['A plain note.']));
  ck('#69 title: the name is not escaped', T("A&B's",[{type:'asi',_level:4}])==="A&B's — Level 4",
     T("A&B's",[{type:'asi',_level:4}]));
}

// ---------- the die a pool's points are (Superiority Dice d8 -> d10 -> d12)
ck('a pool with no die has none', X.resolveResDie({name:'Rage'},5)==='');
ck('a die by level', X.resolveResDie({die:{byLevel:[0,0,8,8,8,8,8,8,8,10]}},10)==='d10');
ck('...absent below the level it starts', X.resolveResDie({die:{byLevel:[0,0,8]}},2)==='');
ck('...and the last entry holds past the end', X.resolveResDie({die:{byLevel:[0,0,8,12]}},20)==='d12');
ck('a fixed die, written either way', X.resolveResDie({die:8},1)==='d8' && X.resolveResDie({die:'d6'},1)==='d6');
{
  const BM=[{name:'Fighter',hitDie:'d10',subclasses:{'Battle Master':{description:'x',levels:{},
    resources:[{name:'Superiority Dice',per:'short',max:{byLevel:[0,0,4,4,4,4,5,5,5,5,5,5,5,5,6,6,6,6,6,6]},
               die:{byLevel:[0,0,8,8,8,8,8,8,8,10,10,10,10,10,10,10,10,12,12,12]}}]}}}];
  hpSetup(BM); X.character.classes=[{name:'Fighter',level:3,subclass:'Battle Master'}];
  X.syncResources();
  const sd=()=>X.character.resources.find(r=>r.name==='Superiority Dice');
  ck('the tracker knows its die: d8 at 3', sd()&&sd().die==='d8'&&sd().max===4, sd());
  X.character.classes[0].level=10; X.syncResources();
  ck('...d10 at 10, and the count moves separately', sd().die==='d10'&&sd().max===5, sd());
  X.character.classes[0].level=18; X.syncResources();
  ck('...d12 at 18', sd().die==='d12'&&sd().max===6, sd());
  sd().cur=2; X.syncResources();
  ck('re-syncing never refills what the player spent', sd().cur===2);
}

// Multiclassing into a new class is gaining a level too, with the NEW die.
hpSetup(CLS); X.addClass('Fighter',1); X.addClass('Wizard',1);
X.commitChoices('Wizard',[{type:'hp',ci:0,dice:''}]);
ck('multiclassing asks for the new class\'s hit points', X.num(X.character.hp.max)===14, X.character.hp.max);

// ---------- multiclassing grants a subset (#66)
// Only the FIRST class is character creation. A class added beside another
// grants no saving throws and no starting equipment or gold, and only the
// proficiencies the 2024 multiclassing table lists (Rogue: one skill; Wizard:
// none). Its level-1 FEATURES still arrive, and its levels gain hit points like
// any later level. Run against the real 2024 pack, not a fixture: the bug was
// in what a real class's data turned into on the sheet.
{
  const PACK=JSON.parse(fs.readFileSync(path.join(__dirname,'../../data/5e2024/classes.json'),'utf8'));
  const mcSetup=(con,extra)=>{
    c=setup(); X.resetRules(); X.mergeRules(PACK,'5e2024_full.json');
    if(extra)X.mergeRules({classes:extra},'test');
    X.character.classes=[]; X.character.level=1; X.character.hp.max=''; X.character.hp.cur='';
    X.character.abilities.con=(con==null)?10:con;
  };
  /* Spy on both windows the add can open, and still run the real ones —
     commitChoices() reads the _activeChoices the real runChoices() sets. */
  const realRC=ctx.runChoices, realRX=ctx.runExtraChoices;
  let rc=[], rx=[];
  ctx.runChoices=function(){rc.push(Array.prototype.slice.call(arguments));return realRC.apply(null,arguments);};
  ctx.runExtraChoices=function(){rx.push(Array.prototype.slice.call(arguments));return realRX.apply(null,arguments);};
  const reset=()=>{rc=[];rx=[];};
  const win=()=>rc[rc.length-1]||[];                       /* [className, choices, notes, eq] */
  const choicesOf=()=>win()[1]||[];
  const notesOf=()=>(win()[2]||[]).map(n=>typeof n==='string'?n:(n&&n.text)||'').join(' ');   /* a note is text, or {text,_level} */
  const saves=sid=>(X.character.grants||[]).filter(g=>g.sid===sid&&g.type==='save').map(g=>g.key).sort().join(',');
  const eqQueued=sid=>rc.concat(rx).some(call=>call.some(a=>Array.isArray(a)&&a.some(x=>x&&x.kind==='equip'&&x.sid===sid)));
  const skillCh=()=>choicesOf().filter(x=>x.type==='skill');
  try{
    /* ---- the first class: unchanged */
    mcSetup(); reset(); X.addClass('Fighter',1);
    ck('#66 the first class grants its saving throws', saves('class:Fighter')==='con,str', saves('class:Fighter'));
    ck('#66 ...queues its starting-equipment picker', eqQueued('class:Fighter'), rc.concat(rx));
    ck('#66 ...offers its full level-1 skill choice', skillCh().length===1&&skillCh()[0].choose===2, skillCh());
    ck('#66 ...seeds level-1 hit points and asks for none', X.num(X.character.hp.max)===10&&!choicesOf().some(x=>x.type==='hp'),
       [X.character.hp.max,choicesOf().map(x=>x.type)]);

    /* ---- a second class */
    reset(); X.addClass('Wizard',1);
    ck('#66 a second class grants NO saving throws', saves('class:Wizard')==='', saves('class:Wizard'));
    ck('#66 ...the first class keeps its own', saves('class:Fighter')==='con,str', saves('class:Fighter'));
    ck('#66 ...queues NO starting equipment', !eqQueued('class:Wizard'), rc.concat(rx));
    ck('#66 ...grants no gold', !(X.character.grantGold||{})['class:Wizard'], X.character.grantGold);
    ck('#66 ...offers no Wizard skills (multiclassing into Wizard grants none)', skillCh().length===0, skillCh());
    ck('#66 ...does not re-seed Max HP from the new die', X.num(X.character.hp.max)===10, X.character.hp.max);
    ck('#66 ...asks for its hit points like a level-up', choicesOf()[0]&&choicesOf()[0].type==='hp'&&choicesOf()[0].die===6&&choicesOf()[0].levels===1,
       choicesOf()[0]);
    ck('#66 ...still gets its level-1 features', X.character.features.some(f=>f.name==='Arcane Recovery'&&f.origin&&f.origin.class==='Wizard'));
    ck('#66 ...and says why there are no saves or equipment', /saving throws/i.test(notesOf())&&/equipment/i.test(notesOf()), notesOf());
    X.commitChoices('Wizard',[{type:'hp',ci:0,dice:''}]);
    ck('#66 ...its hit points average like any later level', X.num(X.character.hp.max)===14, X.character.hp.max);

    /* ---- removing the second class reverts only what it added */
    X.removeClass(1);
    ck('#66 removing the second class keeps the first class\'s saves', saves('class:Fighter')==='con,str');
    ck('#66 ...takes its features', !X.character.features.some(f=>f.origin&&f.origin.class==='Wizard'));
    ck('#66 ...and leaves no Wizard grant behind', !X.character.grants.some(g=>g.sid.indexOf('Wizard')>=0), X.character.grants);

    /* ---- the multiclass skill subset, from the pack's multiclass data */
    mcSetup(); X.addClass('Fighter',1); reset(); X.addClass('Rogue',1);
    ck('#66 a multiclass Rogue offers ONE skill, not four', skillCh().length===1&&skillCh()[0].choose===1, skillCh());
    ck('#66 ...from the Rogue\'s own list', skillCh()[0]&&skillCh()[0].from.indexOf('Stealth')>=0&&skillCh()[0].from.indexOf('Arcana')<0,
       skillCh()[0]);
    ck('#66 ...granted to the class, so it reverts with it', skillCh()[0]&&skillCh()[0]._sid==='class:Rogue', skillCh()[0]);
    ck('#66 ...and names what else it trains', /Thieves' Tools/i.test(notesOf())&&/Light armor/i.test(notesOf()), notesOf());
    ck('#66 ...still no saves', saves('class:Rogue')==='');
    mcSetup(); X.addClass('Fighter',1); reset(); X.addClass('Bard',1);
    ck('#66 a multiclass Bard offers one skill of any', skillCh().length===1&&skillCh()[0].choose===1&&skillCh()[0].from.length===18, skillCh());
    ck('#67 ...and not its first-class three as well', !skillCh().some(x=>x.choose===3), skillCh());

    /* ---- #67: the Bard as a FIRST class. The 2024 data says "any 3", which the
       converter used to drop, so this window offered no skills at all. */
    mcSetup(); reset(); X.addClass('Bard',1);
    const bsk=skillCh()[0]||{};
    ck('#67 a first-class Bard offers a level-1 skill choice', skillCh().length===1, choicesOf().map(x=>x.type));
    ck('#67 ...of three', bsk.choose===3, bsk);
    ck('#67 ...from all 18 skills, every one a skill the sheet knows',
       Array.isArray(bsk.from)&&bsk.from.length===18&&new Set(bsk.from.map(X.skillKey).filter(Boolean)).size===18, bsk.from);
    ck('#67 ...granted to the class, so it reverts with it', bsk._sid==='class:Bard', bsk);
    ck('#67 ...and the window says choose 3', /data-choose="3"/.test(X.choiceFieldHTML(bsk,0,null)), X.choiceFieldHTML(bsk,0,null).slice(0,200));
    const bkeys=['Arcana','Deception','Survival'].map(X.skillKey);
    X.commitChoices('Bard',[{type:'skill',sid:'class:Bard',keys:bkeys}]);
    ck('#67 ...the three picked are the Bard\'s',
       bkeys.every(k=>X.character.grants.some(g=>g.sid==='class:Bard'&&g.type==='skill'&&g.key===k)), X.character.grants);
    X.removeClass(0);
    ck('#67 ...and leave with it', !X.character.grants.some(g=>g.sid==='class:Bard'&&g.type==='skill'), X.character.grants);
    mcSetup(); X.addClass('Wizard',1); reset(); X.addClass('Fighter',1);
    ck('#66 a multiclass Fighter keeps its level-1 Fighting Style', choicesOf().some(x=>x.type==='option'&&/Fighting Style/.test(x.label||'')),
       choicesOf().map(x=>x.type+':'+(x.label||'')));
    ck('#66 ...but offers no skills', skillCh().length===0, skillCh());

    /* ---- a pack that says nothing about multiclassing: no invented table */
    mcSetup(null,[{name:'Tinker',hitDie:'d8',savingThrows:['int','con'],
      equipmentGrants:[{items:[{name:'Rope'}],gold:10}],
      levels:{'1':{traits:[{name:'Gizmo'}],choices:[{type:'skill',choose:2,from:['Arcana','History','Nature']}]}}}]);
    X.addClass('Fighter',1); reset(); X.addClass('Tinker',1);
    ck('#66 a class with no multiclass data offers no class skills', skillCh().length===0, skillCh());
    ck('#66 ...and says the pack does not list them', /does(n't| not) list/i.test(notesOf()), notesOf());
    ck('#66 ...a FIXED equipment block is not applied either', !X.character.inventory.some(i=>i.grant==='class:Tinker')&&!(X.character.grantGold||{})['class:Tinker'],
       [X.character.inventory.map(i=>i.name+'/'+i.grant),X.character.grantGold]);
    ck('#66 ...nor its saves', saves('class:Tinker')==='');
    ck('#66 ...but its features arrive', X.character.features.some(f=>f.name==='Gizmo'));
    mcSetup(null,[{name:'Tinker',hitDie:'d8',savingThrows:['int','con'],equipmentGrants:[{items:[{name:'Rope'}],gold:10}],levels:{}}]);
    X.addClass('Tinker',1);
    ck('#66 ...while as a FIRST class the same fixed block still lands', X.character.inventory.some(i=>i.grant==='class:Tinker')&&X.num(X.character.grantGold['class:Tinker'])===10,
       [X.character.inventory.map(i=>i.name+'/'+i.grant),X.character.grantGold]);

    /* ---- removing the FIRST class while another remains: the remaining class
       is now the first, so it takes that class's saving throws — tagged to it,
       so they revert with it. Its skills and equipment are not re-offered. */
    mcSetup(); X.addClass('Fighter',1); X.addClass('Wizard',1);
    X.removeClass(0);
    ck('#66 removing the first class drops its saves', saves('class:Fighter')==='', saves('class:Fighter'));
    ck('#66 ...and the remaining class takes its own', saves('class:Wizard')==='int,wis', saves('class:Wizard'));
    ck('#66 ...and nothing else of the removed class stays', !X.character.grants.some(g=>g.sid.indexOf('Fighter')>=0)&&!X.character.features.some(f=>f.origin&&f.origin.class==='Fighter'));
    X.removeClass(0);
    ck('#66 ...which then revert with it', !X.character.grants.some(g=>g.type==='save'), X.character.grants);

    /* ---- the first class above level 1 gets every level's hit points */
    mcSetup(); reset(); X.character.hp.locked=true; X.addClass('Fighter',3);
    const hp=choicesOf()[0]||{};
    ck('#66 a first class at level 3 seeds level 1', X.num(X.character.hp.max)===10, X.character.hp.max);
    ck('#66 ...and asks for levels 2-3 in its window', hp.type==='hp'&&hp.die===10&&hp.levels===2, hp);
    ck('#66 ...with the level shown as 3', win()[1]&&win()[1][0]._level===3);
    X.commitChoices('Fighter',[{type:'hp',ci:0,dice:''}]);
    ck('#66 ...taking the average: 10 + 2×6 = 22', X.num(X.character.hp.max)===22&&X.num(X.character.hp.cur)===22,
       X.character.hp.max+'/'+X.character.hp.cur);
    ck('#66 ...and the box is locked again, as it was', X.character.hp.locked===true);
    mcSetup(14); reset(); X.addClass('Fighter',3); X.commitChoices('Fighter',[{type:'hp',ci:0,dice:'9'}]);
    ck('#66 ...a typed roll adds CON per level: 12 + 9 + 2×2 = 25', X.num(X.character.hp.max)===25, X.character.hp.max);
    mcSetup(); X.character.hp.max=30; reset(); X.addClass('Fighter',3);
    ck('#66 ...and the step says level 1 is already counted', /Level 1 is already in Max HP/.test(hp.hint||'')&&
       X.choiceFieldHTML(hp,0,null).indexOf('Level 1 is already in Max HP')>0, hp.hint);
    ck('#66 a class the table says gains nothing says so', /no other proficiencies/.test(X.multiclassNote(X.findClassDef('Wizard'))),
       X.multiclassNote(X.findClassDef('Wizard')));
    ck('#66 ...and a custom class has no note to give', X.multiclassNote(null)==='');
    ck('#66 ...a Max the player typed first is theirs: no seed, no step',
       X.num(X.character.hp.max)===30&&!choicesOf().some(x=>x.type==='hp'), [X.character.hp.max,choicesOf().map(x=>x.type)]);
  }finally{ctx.runChoices=realRC;ctx.runExtraChoices=realRX;}
}

// #61: the subclass on the class chip is its own way into the subclass window
ck('the class chip links its subclass',
   /data-sub-info="Fighter\|Battle Master"/.test(X.classChipHTML({name:'Fighter',level:3,subclass:'Battle Master'},0)),
   X.classChipHTML({name:'Fighter',level:3,subclass:'Battle Master'},0));
ck('...and a chip with no subclass has no link',
   !/data-sub-info/.test(X.classChipHTML({name:'Fighter',level:2,subclass:null},0)));

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
