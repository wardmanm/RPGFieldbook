/* ================= ammunition =================
   A bow, crossbow, sling, blowgun or firearm knows the KIND of ammunition it
   fires (weapon.ammo, from the pack); a stack of ammunition knows its kind and
   any +N it adds (item.ammo). The weapon's attack row spends from the stack it
   is loaded with, and recovery gives half back. Bundles ("Arrows (20)") unpack
   into single pieces the moment they reach a sheet, so a stack's qty is its count.
   Design: src/docs/specs/2026-10-02-ammo-design.md

   The pure half comes first — no DOM — so src/tests/sheet.js can assert it. */

/* A kind is the lower-case name of the single piece ("arrow", "sling bullet"),
   compared after trimming and collapsing spaces, so a pack's "Arrow " matches. */
function ammoKindOf(v){return (typeof v==="string"?v:"").replace(/\s+/g," ").trim().toLowerCase();}
const AMMO_KINDS=["arrow","bolt","firearm bullet","needle","sling bullet"];
/* What the one-time pass knows without a rules pool, and what fills in a pool
   entry from a pack older than ammunition (ammoRepairDef()). Every row agrees with
   data/srd52/items.json and with the private repo's 2024 pack: rules-data.js
   checks the first and the private-data suite the second. A cost is written
   as the pack writes it; the Sling Bullet has none. */
const AMMO_PIECES={
  "arrow":         {name:"Arrow",          cost:"5 cp", weight:0.05},
  "bolt":          {name:"Bolt",           cost:"5 cp", weight:0.075},
  "firearm bullet":{name:"Firearm Bullet", cost:"3 sp", weight:0.2},
  "needle":        {name:"Needle",         cost:"2 cp", weight:0.02},
  "sling bullet":  {name:"Sling Bullet",                weight:0.075}
};
/* single pieces by name, the 2014 names mapping to their 2024 kind. Xanathar's
   Unbreakable Arrow is here too (#96): it is ammunition only in packs made since,
   and the only piece in the older packs the other names miss. */
const AMMO_SINGLE_NAMES={"arrow":"arrow","bolt":"bolt","crossbow bolt":"bolt","firearm bullet":"firearm bullet",
  "needle":"needle","blowgun needle":"needle","sling bullet":"sling bullet","unbreakable arrow":"arrow"};
/* bundles by name: [kind, how many pieces one holds] */
const AMMO_BUNDLES={"arrows (20)":["arrow",20],"bolts (20)":["bolt",20],"crossbow bolts (20)":["bolt",20],
  "firearm bullets (10)":["firearm bullet",10],"needles (50)":["needle",50],"blowgun needles (50)":["needle",50],
  "sling bullets (20)":["sling bullet",20]};
const AMMO_LAUNCHERS={"longbow":"arrow","shortbow":"arrow","light crossbow":"bolt","heavy crossbow":"bolt",
  "hand crossbow":"bolt","sling":"sling bullet","blowgun":"needle","musket":"firearm bullet","pistol":"firearm bullet"};
/* An OWN-property lookup into one of the plain-object tables above. A name of
   "constructor" or "__proto__" finds an inherited property otherwise — an
   object or function, never undefined — so migrateAmmo() read one as a real
   table entry and threw reading .name off it. Not Object.hasOwn: the app
   targets ES2020. */
function ammoTable(T,k){return Object.prototype.hasOwnProperty.call(T,k)?T[k]:undefined;}
/* Fill in the ammunition fields a pool entry lacks, from the tables above
   (#96). The 2024 pack players have (published with 1.7.2) predates them, so its
   launchers, pieces and bundles came with none, and every copy made from them —
   the finder, starting equipment, Insert from pack — was no ammunition at all.
   tidyRule() runs this on every item on every path that loads rules, so the
   pool always reads as the current packs do. It only fills what is missing: a
   pack's own value always wins, and anything not in the tables is left alone.
   The weapon is copied, never edited in place, since the pack object behind it
   may be shared. Returns whether it changed anything. */
function ammoRepairDef(x){
  if(!x||typeof x!=="object"||Array.isArray(x))return false;
  const key=String(x.name||"").trim().toLowerCase();
  let ch=false;
  const b=ammoTable(AMMO_BUNDLES,key);
  if(b){
    if(!itemAmmo(x)){x.ammo={kind:b[0]};ch=true;}
    if(!x.pack){x.pack={item:AMMO_PIECES[b[0]].name,qty:b[1]};ch=true;}
    return ch;
  }
  const single=ammoTable(AMMO_SINGLE_NAMES,key);
  if(single){if(!itemAmmo(x)){x.ammo={kind:single};ch=true;}return ch;}
  const lk=ammoTable(AMMO_LAUNCHERS,key);
  if(lk&&x.weapon&&typeof x.weapon==="object"&&!Array.isArray(x.weapon)&&!x.weapon.ammo){
    x.weapon=Object.assign({},x.weapon,{ammo:lk});ch=true;
  }
  return ch;
}

/* ---- reading it, whatever a file put there ---- */
function itemAmmo(it){
  const a=it&&it.ammo;
  if(!a||typeof a!=="object"||Array.isArray(a))return null;
  const kind=ammoKindOf(a.kind);if(!kind)return null;
  const b=Math.trunc(Number(a.bonus));
  return {kind,bonus:isFinite(b)?Math.max(-9,Math.min(9,b)):0};
}
function weaponAmmoKind(it){return (it&&it.weapon&&typeof it.weapon==="object")?ammoKindOf(it.weapon.ammo):"";}
/* The stacks a weapon of `kind` can load, in inventory order. A bundle never
   sits on a sheet (it unpacks on arrival); one from an odd file is skipped.
   An empty stack (qty < 1) can't be loaded. */
function ammoStacks(c,kind){
  if(!kind)return [];
  return (Array.isArray(c&&c.inventory)?c.inventory:[])
    .filter(i=>i&&typeof i==="object"&&!i.pack&&itemQty(i)>=1&&(itemAmmo(i)||{}).kind===kind);
}
/* The stack a weapon fires from: the one the player chose (ammoStack, kept on
   the item OUTSIDE `weapon`, which the rules-update tool owns) while it exists
   and is of the right kind, else the first of its kind. null when there is none. */
function loadedStack(c,weaponItem){
  const st=ammoStacks(c,weaponAmmoKind(weaponItem));
  return st.find(s=>s.id===(weaponItem&&weaponItem.ammoStack))||st[0]||null;
}
function ammoPlural(kind){const k=ammoKindOf(kind);return k?(/s$/.test(k)?k:k+"s"):"pieces";}
function ammoOne(kind){const k=ammoKindOf(kind)||"piece";return (/^[aeiou]/.test(k)?"an ":"a ")+k;}

/* ---- recovery: the rule, and what comes back (#104) ----
   The character's rule, an item's own override, the app's defaults, and how
   many of one entry's shots come back. Read at recovery, never at the shot,
   so changing the setting reaches shots already fired.
   Design: src/docs/specs/2026-10-18-ammo-recovery-design.md §4 */
const AMMO_RECOVERY=[["half","Half (rules as written)"],["all","All"],["hits","Hits only"],["none","None"]];
function ammoRecoveryOf(c){const v=c&&c.ammoRecovery;return AMMO_RECOVERY.some(r=>r[0]===v)?v:"half";}
/* An item's own override, kept OUTSIDE ammo and weapon (the rules-update tool
   owns those): "always", "never", or "" for the sheet's rule. */
function itemRecover(it){const v=it&&it.recover;return (v==="always"||v==="never")?v:"";}
/* A thrown weapon lists Thrown among the properties in its notes ("Range 20/60
   · Finesse, Light, Thrown · Mastery: Nick"): a whole property, any case. A
   launcher is never thrown. */
function weaponThrown(it){
  const w=it&&it.weapon;
  if(!w||typeof w!=="object"||Array.isArray(w)||ammoKindOf(w.ammo))return false;
  return (typeof w.notes==="string"?w.notes:"").split("·").some(seg=>seg.split(",").some(p=>p.trim().toLowerCase()==="thrown"));
}
/* What a thrown weapon's throws are counted as: its own name, as a kind. */
function ammoThrownKind(it){return ammoKindOf(String(it&&it.name||""))||"thrown weapon";}
/* The app's defaults, so the packs need not say (spec decision 5). */
const AMMO_RECOVER_DEFAULTS={"firearm bullet":"never"};
function ammoDefaultRecover(it){
  const am=itemAmmo(it);
  if(am)return ammoTable(AMMO_RECOVER_DEFAULTS,am.kind)||"";
  return weaponThrown(it)?"always":"";
}
/* The rule for one item: its own override, else the app's default, else the
   character's rule. None does not override an item set to always. */
function ammoRecoverRule(c,it){return itemRecover(it)||ammoDefaultRecover(it)||ammoRecoveryOf(c);}
/* How many of one entry's shots come back under a rule. Hits only: every hit,
   and half of the shots nobody answered for. */
function ammoBack(rule,e){
  if(rule==="always"||rule==="all")return e.n;
  if(rule==="half")return Math.floor(e.n/2);
  if(rule==="hits")return e.hits+Math.floor((e.n-e.hits-e.misses)/2);
  return 0;
}

/* ---- a bundle unpacks into its single piece ----
   `x` is a pack entry. A bundle (pack:{item, qty}) comes back as the single
   piece to add and how many ONE bundle holds: the pool's own entry for that
   piece when it has one, else a piece made from the bundle itself, cost and
   weight divided. Anything else comes back as it is, one to one. Pure. */
function unpackAmmo(x,pool){
  const p=x&&x.pack;
  const per=(p&&typeof p==="object")?Math.trunc(Number(p.qty)):0;
  const nm=(p&&typeof p.item==="string")?p.item.trim():"";
  if(!(per>=1)||!nm)return {def:x,per:1};
  const def=(Array.isArray(pool)?pool:[]).find(e=>e&&typeof e==="object"&&!e.pack&&String(e.name||"").toLowerCase()===nm.toLowerCase());
  if(def)return {def,per};
  const made={name:nm,description:x.description||"",effects:[]};
  ["category","type","rarity","system","_source"].forEach(k=>{if(x[k]!=null)made[k]=x[k];});
  const gp=costToGp(x.cost), wt=fnum(x.weight);
  if(gp!=null&&gp/per>=0.01)made.cost=fmtGp(gp/per);
  if(wt)made.weight=Math.round(wt/per*1000)/1000;
  const am=itemAmmo(x);if(am)made.ammo=am.bonus?{kind:am.kind,bonus:am.bonus}:{kind:am.kind};
  return {def:made,per};
}

/* ---- the one-time pass on sheets saved before ammunition ----
   Runs once per character per AMMO_PASS (ammoInit, never defaulted in
   blankChar(), as wpnEquipInit isn't), from each item's own data: migrate()
   runs before a rules pool can be relied on. Known bundles unpack into their
   single piece, known pieces learn their kind, known 2024 launchers learn what
   they fire. Anything else is left exactly as it is.
   Pass 1 was for sheets saved before ammunition. Pass 2 (#96) runs it once
   more: copies made from the 2024 pack players had arrived with no ammo
   fields after pass 1 had run — and on every sheet made since, which skips the
   pass — so a launcher fired nothing and "Bolts (20)" stayed a bundle. Every
   step touches only an item that is not yet ammunition (a launcher, one with
   no kind), so a second run over a migrated sheet changes nothing it already
   did, and nothing the player marked by hand: a "Bolts (20)" they ticked as
   ammunition and counted down to 17 stays 17 bolts, not 340. */
const AMMO_PASS=2;

/* Re-take the rules-update tool's baseline for each field the pass rewrote.
   `before` holds each field's value before the pass; `proj`, where the pass
   knows it, is the pack's own projection of the field (a bundle unpacked into a
   known piece). The copy side (cfp) moves only where the player hadn't edited
   the field, so their edit still reads as theirs. The pack side (fp) takes the
   known projection, or else follows the copy only where the copy matched the
   pack, so an older pack change the player never applied still shows. */
function rebaseAmmo(it,before,proj){
  const s=it&&it.src;
  if(!s||typeof s!=="object")return;
  if(!s.fp||typeof s.fp!=="object"||Array.isArray(s.fp))s.fp={};
  if(!s.cfp||typeof s.cfp!=="object"||Array.isArray(s.cfp))s.cfp={};
  Object.keys(before).forEach(f=>{
    const was=fpHash(before[f]), now=fpHash(it[f]);
    if(s.cfp[f]===undefined||s.cfp[f]===was)s.cfp[f]=now;
    if(proj&&f in proj)s.fp[f]=fpHash(proj[f]);
    else if(s.fp[f]===undefined||s.fp[f]===was)s.fp[f]=now;
  });
}
function migrateAmmo(c){
  if(!c||num(c.ammoInit)>=AMMO_PASS)return 0;
  const inv=Array.isArray(c.inventory)?c.inventory:[], unpacked=new Set();
  let n=0;
  inv.forEach(it=>{
    if(!it||typeof it!=="object")return;
    const key=String(it.name||"").trim().toLowerCase();
    const b=ammoTable(AMMO_BUNDLES,key);
    if(b&&!itemAmmo(it)){
      /* "Arrows (20)" ×2 becomes Arrow ×40, each a twentieth of the bundle's
         own price and weight (spec §3.3), so a price the player paid survives */
      const kind=b[0], per=b[1], pc=AMMO_PIECES[kind];
      const before={cost:it.cost,weight:it.weight,ammo:it.ammo,description:it.description};
      const gp=costToGp(it.cost), wt=fnum(it.weight);
      it.name=pc.name;it.qty=itemQty(it)*per;
      if(gp!=null)it.cost=Math.round(gp/per*10000)/10000;
      if(wt)it.weight=Math.round(wt/per*1000)/1000;
      it.ammo={kind};
      /* a finder copy's description opens with the bundle's meta line
         ("Ammunition · 1 gp · 1 lb"); it now opens with the piece's */
      if(it.src&&it.src.shape==="browse"&&typeof it.description==="string"){
        const nl=it.description.indexOf("\n"), head=nl<0?it.description:it.description.slice(0,nl);
        if(/ lb$/.test(head))it.description=itemMetaLine({type:it.type,cost:pc.cost,weight:pc.weight})+(nl<0?"":it.description.slice(nl));
      }
      if(it.src&&typeof it.src==="object")it.src.name=pc.name;
      const g=costToGp(pc.cost);
      rebaseAmmo(it,before,{cost:g==null?undefined:g,weight:pc.weight,ammo:{kind}});
      unpacked.add(it);n++;return;
    }
    const single=ammoTable(AMMO_SINGLE_NAMES,key);
    if(single&&!itemAmmo(it)){
      const before={ammo:it.ammo};it.ammo={kind:single};
      rebaseAmmo(it,before,{ammo:{kind:single}});n++;return;
    }
    const lk=ammoTable(AMMO_LAUNCHERS,key);
    if(lk&&it.weapon&&typeof it.weapon==="object"&&!Array.isArray(it.weapon)&&!it.weapon.ammo){
      const before={weapon:it.weapon};
      it.weapon=Object.assign({},it.weapon,{ammo:lk});
      rebaseAmmo(it,before,null);n++;
    }
  });
  /* An unpacked bundle joins a stack of the same piece, bonus and grant: the
     one the player already had, wherever it sits, else the first bundle
     unpacked here, so two bundles become one stack. Only within one grant, so
     removing a class still takes back exactly what it granted; stacks the
     player kept apart stay apart. */
  const keyOf=it=>{const a=itemAmmo(it);return a?[String(it.name||"").trim().toLowerCase(),a.bonus,it.grant||""].join("|"):null;};
  const home=new Map();
  inv.forEach(it=>{const k=keyOf(it);if(k==null)return;const h=home.get(k);
    if(!h||(unpacked.has(h)&&!unpacked.has(it)))home.set(k,it);});
  c.inventory=inv.filter(it=>{
    const k=keyOf(it),h=k==null?null:home.get(k);
    if(!h||h===it||!unpacked.has(it))return true;
    h.qty=itemQty(h)+itemQty(it);n++;return false;
  });
  c.ammoInit=AMMO_PASS;
  return n;
}

/* ---- firing, undoing, recovering ---- */
function ammoSpentMap(c){const m=c&&c.ammoSpent;return (m&&typeof m==="object"&&!Array.isArray(m))?m:{};}
/* One stack's spent record, coerced: how many fired since the last recovery,
   how many of those were answered Hit and Miss (#104: each clamped so that
   hits + misses never passes n), its kind, and the copy recovery rebuilds a
   used-up stack from. */
function ammoSpentEntry(c,id){
  const e=ammoSpentMap(c)[id], ok=!!e&&typeof e==="object"&&!Array.isArray(e);
  const n=(ok&&Number.isInteger(e.n)&&e.n>0)?e.n:0;
  const cnt=v=>(ok&&Number.isInteger(v))?Math.max(0,Math.min(n,v)):0;
  const hits=cnt(ok?e.hits:0), misses=Math.min(n-hits,cnt(ok?e.misses:0));
  return {n,hits,misses,kind:ok?ammoKindOf(e.kind):"",
          snap:(ok&&e.snap&&typeof e.snap==="object"&&!Array.isArray(e.snap))?e.snap:null};
}
/* One shot onto `st`'s spent entry: one more on its count, one more Hit or
   Miss when the question was answered (#104), and a one-piece copy of the item
   for recovery to rebuild from. The entry is rebuilt every shot, so the
   tallies are carried across by hand. Returns what Undo needs to
   put it back. Shared by Fire and Throw, so both count the same way. */
function ammoRecordShot(c,st,kind,outcome){
  if(!c.ammoSpent||typeof c.ammoSpent!=="object"||Array.isArray(c.ammoSpent))c.ammoSpent={};
  const undo={stack:JSON.parse(JSON.stringify(st)),at:c.inventory.indexOf(st),
              spent:c.ammoSpent[st.id]?JSON.parse(JSON.stringify(c.ammoSpent[st.id])):null};
  const p=ammoSpentEntry(c,st.id);
  c.ammoSpent[st.id]={n:p.n+1,hits:p.hits+(outcome==="hit"?1:0),misses:p.misses+(outcome==="miss"?1:0),
    kind,snap:Object.assign(JSON.parse(JSON.stringify(st)),{qty:1})};
  return undo;
}
/* One shot from the weapon's loaded stack: one piece off it (the last removes
   the stack, as using the last potion does), counted with its answer. Returns
   what Undo needs, or null when there is nothing to fire. */
function fireAmmo(c,weaponItem,outcome){
  const st=loadedStack(c,weaponItem);if(!st)return null;
  const am=itemAmmo(st), undo=ammoRecordShot(c,st,am.kind,outcome);
  const left=Math.max(0,itemQty(st)-1);
  if(left<=0)c.inventory=c.inventory.filter(x=>x!==st);else st.qty=left;
  return {stack:st,kind:am.kind,left,removed:left<=0,undo,outcome:(outcome==="hit"||outcome==="miss")?outcome:""};
}
/* One throw of a thrown weapon (#104): one off the weapon item's own count.
   At ×0 the item STAYS (spec decision 8): its attack row must not vanish
   mid-fight, and recovery adds back onto it. Returns the same record as
   fireAmmo(), so undoFire() puts it back; null when it is not a thrown weapon
   on this sheet or none is left. */
function throwAmmo(c,weaponItem,outcome){
  if(!weaponThrown(weaponItem)||!Array.isArray(c&&c.inventory)||c.inventory.indexOf(weaponItem)<0||itemQty(weaponItem)<1)return null;
  const kind=ammoThrownKind(weaponItem), undo=ammoRecordShot(c,weaponItem,kind,outcome);
  const left=Math.max(0,itemQty(weaponItem)-1);
  weaponItem.qty=left;
  return {stack:weaponItem,kind,left,removed:false,undo,outcome:(outcome==="hit"||outcome==="miss")?outcome:""};
}
/* Undo puts back exactly what that shot took: one piece onto its stack, or the
   whole stack at its old place when the shot removed it, and the spent count as
   it was. A stack the player deleted since stays deleted: they chose that. An Undo applies once. */
function undoFire(c,rec){
  if(!c||!rec||!rec.undo||!rec.undo.stack)return false;
  if(rec.undone)return false;
  const u=rec.undo, id=u.stack.id;
  if(!Array.isArray(c.inventory))c.inventory=[];
  const cur=c.inventory.find(x=>x&&x.id===id);
  if(cur)cur.qty=itemQty(cur)+1;
  else if(rec.removed)c.inventory.splice(Math.max(0,Math.min(c.inventory.length,u.at)),0,JSON.parse(JSON.stringify(u.stack)));
  else return false;
  if(!c.ammoSpent||typeof c.ammoSpent!=="object"||Array.isArray(c.ammoSpent))c.ammoSpent={};
  if(u.spent)c.ammoSpent[id]=u.spent;else delete c.ammoSpent[id];
  rec.undone=true;
  return true;
}
/* The item an entry's rule is read from: the live one while it is on the
   sheet (its override may have changed since the shot), else the entry's copy. */
function ammoEntryItem(c,id,e){
  const inv=Array.isArray(c&&c.inventory)?c.inventory:[];
  return inv.find(x=>x&&x.id===id)||e.snap;
}
/* What recovery would give back, per kind, under each entry's rule (#104):
   summed per kind. Kinds with nothing to give back are left out. */
function ammoRecoverable(c){
  const by=new Map();
  Object.keys(ammoSpentMap(c)).forEach(id=>{
    const e=ammoSpentEntry(c,id);if(!e.n||!e.kind)return;
    const r=by.get(e.kind)||{kind:e.kind,fired:0,back:0};
    r.fired+=e.n;r.back+=ammoBack(ammoRecoverRule(c,ammoEntryItem(c,id,e)),e);by.set(e.kind,r);
  });
  return [...by.values()].filter(r=>r.back>0);
}
/* Gives back what each entry's rule allows (#104), for the kinds asked
   (every kind when none are) — or, when `ids` is given, for those ammoSpent
   entries only (a thrown weapon's row recovers its own entry: final review,
   item 2) — and clears those entries: the rest is lost. When
   the old stack is gone, recovery first looks for an equivalent one already on
   the sheet — not a bundle, the same lower-cased trimmed name, the same ammo
   bonus and the same grant as the snapshot — and tops that up instead of
   making a second "+1 Arrow" row; any weapon loaded with the old id is
   repointed to it (its target id kept as `to`, so undoRecovery() only unpoints
   a weapon the player hasn't re-loaded since). Only when there is none does
   the old stack come back from its copy, under its old id. A thrown weapon is
   still on the sheet at ×0, so its throws go back onto it.
   Every `added`/`made` record carries `from`: the ammoSpent id it answers for
   (its own id, except a home-join's, which is the home stack's id) — this is
   what undoRecovery() uses to tell a cleared entry that DEPENDED on a stack
   (present for the full top-up, even one giving 0 back; joined into a home
   stack; or rebuilt) from one whose stack was already gone with nothing given
   back (review finding 1: that distinction is what Undo must not restore
   blindly). When `rec` is an object it is filled with what was done, for
   undoRecovery(). Returns how many pieces came back. */
function recoverAmmo(c,kinds,rec,ids){
  const want=Array.isArray(kinds)?new Set(kinds.map(ammoKindOf)):null;
  const only=Array.isArray(ids)?new Set(ids):null;
  const m=ammoSpentMap(c);
  if(!Array.isArray(c.inventory))c.inventory=[];
  const log=(rec&&typeof rec==="object")?Object.assign(rec,{added:[],made:[],repointed:[],cleared:{}}):null;
  let back=0;
  Object.keys(m).forEach(id=>{
    const e=ammoSpentEntry(c,id);
    if(want&&!want.has(e.kind))return;
    if(only&&!only.has(id))return;
    const n=ammoBack(ammoRecoverRule(c,ammoEntryItem(c,id,e)),e);
    const st=c.inventory.find(x=>x&&x.id===id);
    if(st){
      /* Present at recovery, whatever the rule gave it — even 0 — still ties
         this cleared entry to that stack (finding 1): deleting the stack
         afterwards must drop the entry's history with it. */
      if(log)log.added.push({id,n,from:id});
      if(n>0){st.qty=itemQty(st)+n;back+=n;}
    }else if(n>0&&e.snap){
      const snapAm=itemAmmo(e.snap), snapName=String(e.snap.name||"").trim().toLowerCase(),
            snapGrant=e.snap.grant||"";
      const home=c.inventory.find(x=>x&&typeof x==="object"&&!x.pack&&
        String(x.name||"").trim().toLowerCase()===snapName&&
        (itemAmmo(x)||{}).bonus===(snapAm?snapAm.bonus:0)&&(x.grant||"")===snapGrant);
      if(home){
        home.qty=itemQty(home)+n;if(log)log.added.push({id:home.id,n,from:id});
        c.inventory.forEach(x=>{if(x&&x.ammoStack===id){x.ammoStack=home.id;if(log)log.repointed.push({id:x.id,from:id,to:home.id});}});
      }else{
        c.inventory.push(Object.assign(JSON.parse(JSON.stringify(e.snap)),{id,qty:n}));
        if(log)log.made.push({id,n,from:id});
      }
      back+=n;
    }
    if(log)log.cleared[id]=JSON.parse(JSON.stringify(m[id]));
    delete m[id];
  });
  return back;
}
/* Whether the character still holds a record of granting source `sid`
   (#104 review finding 1) — used only for a cleared entry whose stack was
   ALREADY gone at recovery (recoverAmmo() logged no `from` for it), to decide
   whether Undo should still bring its history back. Mirrors the sid shapes
   originSid() builds (race:name, bg:name, class:name, subclass:class:subclass)
   against the character's own race/background/classes, the same fields
   removeRace()/removeBackground()/removeClass() check before ever calling
   revertEquipmentGrants() (src/js/50-classrace.js, 52-race.js, 54-background.js,
   56-class.js). An unrecognised sid shape reads as still live: Undo defaults
   to restoring rather than guessing, per the ruling. */
function grantSidLive(c,sid){
  if(!c||!sid)return true;
  const i=String(sid).indexOf(":");if(i<0)return true;
  const kind=sid.slice(0,i), rest=sid.slice(i+1);
  if(kind==="race")return !!(c.race&&c.race.name===rest);
  if(kind==="bg")return !!(c.bg&&c.bg.name===rest);
  if(kind==="class")return (Array.isArray(c.classes)?c.classes:[]).some(cl=>cl&&cl.name===rest);
  if(kind==="subclass"){
    const j=rest.indexOf(":");if(j<0)return true;
    return (Array.isArray(c.classes)?c.classes:[]).some(cl=>cl&&cl.name===rest.slice(0,j)&&cl.subclass===rest.slice(j+1));
  }
  return true;
}
/* Undo recovery (#104, spec §6; review findings 1–3): takes back exactly what
   that recovery gave, no more. A stack it rebuilt goes while it holds no more
   than it was given; a quantity it added comes off (any ammunition stack left
   with nothing goes, as the last shot removes it — that is unchanged by this
   review: it's removed everywhere else in the app too; a thrown weapon stays
   on the sheet at ×0 instead). Either `take()` can come up short of the
   amount it was asked to remove — a shot fired since has already used some
   or all of it — and that shortfall comes off the cleared entry's own `n`
   before it is restored, so those shots are not counted twice (finding 2). A
   weapon it repointed points back only if it still points where recovery left
   it — not wherever the player has since loaded it (finding 3). A cleared
   entry comes back ADDED to any entry a shot fired since has started under
   the same id, so that shot stays fired; one with no dependency at all — its
   stack was already gone when it was cleared — comes back as before UNLESS
   its snapshot names a granting source that has since been revoked (finding
   1); one that DID depend on a stack (present, joined, or rebuilt) comes back
   only if that stack is still on the sheet, or a new entry has already taken
   its id (the shot-since case above). Once only. */
function undoRecovery(c,rec){
  if(!c||!rec||typeof rec!=="object"||rec.undone||!Array.isArray(rec.added)||!Array.isArray(rec.made)||
     !Array.isArray(rec.repointed)||!rec.cleared||typeof rec.cleared!=="object")return false;
  if(!Array.isArray(c.inventory))c.inventory=[];
  /* Who was on the sheet before Undo's OWN take() below removes a stack it
     rebuilt or emptied back out — that removal is Undo doing its job, not
     evidence the player deleted anything, so the "is its stack gone" check
     for restoring a cleared entry (below) reads this snapshot, taken first. */
  const livePre=new Set(c.inventory.filter(x=>x&&x.id!=null).map(x=>x.id));
  const short={};
  const take=(id,n,rebuilt)=>{
    /* #104 review (folded in): n===0 means this entry's rule gave the stack
       nothing — present at recovery (added, from recoverAmmo()'s `n` even at
       0) only to tie the cleared entry to it (finding 1 there). A stack
       already sitting at ×0 then reads have<=n as "take the lot" and removed
       it, though Undo took nothing from it. A true no-op: look nothing up,
       touch nothing, owe nothing back. */
    if(n<=0)return 0;
    const it=c.inventory.find(x=>x&&x.id===id);
    if(!it)return n;
    const have=itemQty(it);
    if(have<=n&&(rebuilt||!weaponThrown(it)))c.inventory=c.inventory.filter(x=>x!==it);
    else it.qty=Math.max(0,have-n);
    return Math.max(0,n-have);
  };
  rec.made.forEach(x=>{short[x.from]=(short[x.from]||0)+take(x.id,x.n,true);});
  rec.added.forEach(x=>{short[x.from]=(short[x.from]||0)+take(x.id,x.n,false);});
  rec.repointed.forEach(x=>{const it=c.inventory.find(y=>y&&y.id===x.id);if(it&&it.ammoStack===x.to)it.ammoStack=x.from;});
  if(!c.ammoSpent||typeof c.ammoSpent!=="object"||Array.isArray(c.ammoSpent))c.ammoSpent={};
  /* The item the entry depended on (its own id while present, or what it was
     joined into / rebuilt as), when recoverAmmo() recorded one. */
  const target=id=>{const m=rec.made.find(x=>x.from===id);if(m)return m.id;const a=rec.added.find(x=>x.from===id);return a?a.id:null;};
  Object.keys(rec.cleared).forEach(id=>{
    const raw=rec.cleared[id];
    const t=target(id), already=id in c.ammoSpent;
    if(t){
      if(!already&&!livePre.has(t))return;      /* its stack was already gone, and nothing has refired it */
    }else{
      const g=raw&&raw.snap&&raw.snap.grant;
      if(g&&!grantSidLive(c,g))return;                            /* it was already used up, and its source is gone too */
    }
    const sh=short[id]||0;
    /* No shots since: put the entry back exactly as it was raw, with no
       hits/misses added to a pre-#104 shape that never had them. */
    if(!already&&sh<=0){c.ammoSpent[id]=raw;return;}
    const o=ammoSpentEntry({ammoSpent:{x:raw}},"x");
    const n=Math.max(0,o.n-sh), hits=Math.min(o.hits,n), misses=Math.min(Math.max(0,n-hits),o.misses);
    if(!already){c.ammoSpent[id]=Object.assign({},raw,{n,hits,misses});return;}
    const k=ammoSpentEntry(c,id);
    c.ammoSpent[id]=Object.assign({},c.ammoSpent[id],{n:n+k.n,hits:hits+k.hits,misses:misses+k.misses});
  });
  rec.undone=true;
  return true;
}
function ammoSummaryText(list){return list.map(r=>`${r.back} of ${r.fired} ${ammoPlural(r.kind)}`).join(", ");}
/* A deleted stack's count goes with it: there is nothing to recover into, and
   the player chose to delete it. */
function forgetAmmo(c,id){const m=ammoSpentMap(c);if(id in m)delete m[id];}
/* Removing a class or background forgets every spent count it granted, even
   one whose stack is already gone — fired down to nothing, which removes the
   stack the way the last potion does, well before the source itself is
   removed. Without this, revertEquipmentGrants()'s own id-based forgetAmmo()
   only reaches a granted stack still in the inventory, and Recover brings the
   revoked grant's arrows back. */
function forgetGrantAmmo(c,sid){
  const m=ammoSpentMap(c);
  Object.keys(m).forEach(id=>{
    const e=m[id];
    if(e&&typeof e==="object"&&!Array.isArray(e)&&e.snap&&typeof e.snap==="object"&&!Array.isArray(e.snap)&&e.snap.grant===sid)delete m[id];
  });
}
/* The +N a weapon row gets from the stack its item is loaded with, and that
   stack's name for the breakdown. Nothing for a row with no item. */
function attackAmmo(a){
  const inv=Array.isArray(character&&character.inventory)?character.inventory:[];
  const it=a&&a.itemId?inv.find(i=>i&&i.id===a.itemId):null;
  if(!it||!weaponAmmoKind(it))return {bonus:0,name:""};
  const st=loadedStack(character,it), am=st&&itemAmmo(st);
  return {bonus:am?am.bonus:0,name:st?String(st.name||""):""};
}

/* ---- the item editor's kind lists (#8) ----
   The five 2024 kinds, then any other kind this sheet already uses (on an
   ammunition item or a weapon), then `also` (the kinds the form opened with),
   so an item's own kind is always on its list. */
function ammoKindChoices(c,also){
  const seen=new Set(AMMO_KINDS), extra=[];
  const add=k=>{k=ammoKindOf(k);if(k&&!seen.has(k)){seen.add(k);extra.push(k);}};
  (Array.isArray(c&&c.inventory)?c.inventory:[]).forEach(i=>{const a=itemAmmo(i);if(a)add(a.kind);add(weaponAmmoKind(i));});
  (Array.isArray(also)?also:[]).forEach(add);
  return AMMO_KINDS.concat(extra);
}
function ammoKindLabel(k){k=String(k||"");return k.charAt(0).toUpperCase()+k.slice(1);}
/* <option>s for a kind <select>: None first when `noneLabel` is given, each
   kind, then "Other…" (value "__other"), which opens a box for a new kind. */
function ammoKindOptionsHTML(kinds,selected,noneLabel){
  const sel=ammoKindOf(selected);
  return (noneLabel?`<option value=""${sel?"":" selected"}>${esc(noneLabel)}</option>`:"")+
    kinds.map(k=>`<option value="${esc(k)}"${k===sel?" selected":""}>${esc(ammoKindLabel(k))}</option>`).join("")+
    `<option value="__other">Other…</option>`;
}
/* The item editor's Recovery <option>s (#104): the default (named when the
   app has one for this item), Always, Never; the item's own choice selected. */
function recoverOptionsHTML(it){
  const cur=itemRecover(it), d=ammoDefaultRecover(it);
  const first=d==="never"?"Default (never comes back)":d==="always"?"Default (always comes back)":"Sheet's rule";
  return [["",first],["always","Always comes back"],["never","Never comes back"]]
    .map(([v,l])=>`<option value="${esc(v)}"${cur===v?" selected":""}>${esc(l)}</option>`).join("");
}

/* ================= the DOM half =================
   The ammunition line under a launcher's attack row, the stack picker, and
   recovery at End combat. The combat view holds the same Attacks card, so all
   of it works there too. */

/* What a launcher's attack row shows under it: the stack it is loaded with (a
   button that opens the picker when there is a choice), Fire, and Recover N
   when a recovery would give something back. Empty for a row whose item fires
   nothing. Takes the character, so the hostile-data test can call it. */
function ammoLineHTML(c,a){
  const inv=Array.isArray(c&&c.inventory)?c.inventory:[];
  const it=a&&a.itemId?inv.find(i=>i&&i.id===a.itemId):null;
  const kind=weaponAmmoKind(it);
  if(!kind)return weaponThrown(it)?thrownLineHTML(c,it):"";
  const st=loadedStack(c,it), many=ammoStacks(c,kind).length>1;
  const label=st?`${String(st.name||"")} ×${itemQty(st)}`:`No ${ammoPlural(kind)}`;
  const back=(ammoRecoverable(c).find(r=>r.kind===kind)||{}).back||0;
  return `<div class="ammo-line">`+
    (many?`<button type="button" class="ammo-load" data-ammo-pick="${esc(it.id)}" aria-label="${esc("Loaded: "+label+". Choose what it fires")}">${esc(label)}</button>`
         :`<span class="ammo-load">${esc(label)}</span>`)+
    `<button type="button" class="tbtn ammo-fire" data-ammo-fire="${esc(it.id)}"${st?"":" disabled"} aria-label="${esc("Fire "+ammoOne(kind)+" from "+String(it.name||"this weapon"))}">Fire</button>`+
    (back>0?`<button type="button" class="tbtn ammo-recover" data-ammo-recover="${esc(it.id)}" aria-label="${esc("Recover "+back+" "+ammoPlural(kind))}">Recover ${back}</button>`:"")+
    `</div>`;
}
/* Under a thrown weapon's row (#104): its own count (no picker — it throws
   itself), Throw (disabled at ×0, when every one is out there), and Recover N.
   N is read from this weapon's OWN entry, under its id, not from its kind: the
   kind is the name it had when thrown, so a rename since would hide what End
   combat still recovers, and a second weapon of the same name would add its
   throws to this row (final review, item 2). */
function thrownLineHTML(c,it){
  const kind=ammoThrownKind(it), q=itemQty(it), name=String(it.name||"");
  const back=ammoThrownBack(c,it);
  return `<div class="ammo-line"><span class="ammo-load">${esc(name+" ×"+q)}</span>`+
    `<button type="button" class="tbtn ammo-fire" data-ammo-throw="${esc(it.id)}"${q>=1?"":" disabled"} aria-label="${esc("Throw "+(/^[aeiou]/i.test(name)?"an ":"a ")+name)}">Throw</button>`+
    (back>0?`<button type="button" class="tbtn ammo-recover" data-ammo-recover="${esc(it.id)}" aria-label="${esc("Recover "+back+" "+ammoPlural(kind))}">Recover ${back}</button>`:"")+
    `</div>`;
}
/* What a thrown weapon's own entry gives back under its rule: the row's
   Recover N, and exactly what its tap recovers. */
function ammoThrownBack(c,it){
  const e=ammoSpentEntry(c,it&&it.id);
  return (e.n&&e.kind)?ammoBack(ammoRecoverRule(c,it),e):0;
}
/* Fire and Throw ask Hit or miss first only when this item comes back by
   the Hits-only rule (spec §5.4): an item set to always or never, a thrown
   weapon on its default, and every other rule fire at once. */
function ammoAsks(c,it){return !!it&&ammoRecoverRule(c,it)==="hits";}
/* The question. Closing it (✕, Escape) fires nothing. Focus starts on Hit. */
function askAmmoOutcome(title,go){
  openModal(title,`<p class="hint">Hits come back after the fight; misses are lost.</p>`+
    `<div class="m-actions"><button type="button" class="tbtn" id="ammoMiss">Miss</button><button type="button" class="tbtn primary" id="ammoHit">Hit</button></div>`);
  const h=document.getElementById("ammoHit"), m=document.getElementById("ammoMiss");
  if(h)h.addEventListener("click",()=>{closeModal();go("hit");});
  if(m)m.addEventListener("click",()=>{closeModal();go("miss");});
  if(h&&h.focus)h.focus();
}
/* The row's Fire button for a weapon item, while it is on screen and live. */
function ammoFireBtn(itemId){
  const b=document.querySelector(attrSel("data-ammo-fire",itemId))||document.querySelector(attrSel("data-ammo-throw",itemId));
  return b&&!b.disabled&&b.getClientRects().length?b:null;
}
/* One Fire tap. Under Hits only it asks first, and fires once answered.
   `who` is the character the toast was shown for. Returns the shot, or null
   when there was nothing to fire, or while the question is still open. */
function fireWeapon(itemId,viaKey,outcome){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  if(!it)return null;
  const st=loadedStack(character,it);
  if(outcome===undefined&&st&&ammoAsks(character,st)){
    askAmmoOutcome(`${String(it.name||"Fire")}: hit or miss?`,o=>fireWeapon(itemId,viaKey,o));
    return null;
  }
  const r=fireAmmo(character,it,outcome);
  if(!r)return null;
  shotDone(r,itemId,viaKey,r.removed?`Fired your last ${String(r.stack.name||r.kind)}${r.outcome?" · "+r.outcome:""}`
    :`Fired ${ammoOne(r.kind)}${r.outcome?" · "+r.outcome:""} · ${r.left} left`);
  return r;
}
/* One Throw tap (#104): as Fire, from the weapon's own count. */
function throwWeaponTap(itemId,viaKey,outcome){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  if(!it||!weaponThrown(it))return null;
  if(outcome===undefined&&itemQty(it)>=1&&ammoAsks(character,it)){
    askAmmoOutcome(`${String(it.name||"Throw")}: hit or miss?`,o=>throwWeaponTap(itemId,viaKey,o));
    return null;
  }
  const r=throwAmmo(character,it,outcome);
  if(!r)return null;
  const name=String(it.name||"");
  shotDone(r,itemId,viaKey,`Threw ${/^[aeiou]/i.test(name)?"an":"a"} ${name}${r.outcome?" · "+r.outcome:""} · ${r.left} left`);
  return r;
}
/* After Fire or Throw: save, redraw, and the toast with its Undo. The save is
   scheduled before the redraw, so nothing a redraw throws can cost the player
   the shot. From the keyboard focus stays on the button while there is more,
   else it moves to the toast's Undo; a held Enter's auto-repeat must not then
   press Undo, so the Undo ignores repeated keys. */
function shotDone(r,itemId,viaKey,msg){
  const who=character;
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  const undo=toast(msg,{label:"Undo",
    run:e=>undoFireTap(r,who,!!e&&e.detail===0,itemId),
    back:()=>ammoFireBtn(itemId)});
  if(undo)undo.addEventListener("keydown",e=>{if(e.repeat)e.preventDefault();});
  if(viaKey){const b=ammoFireBtn(itemId);if(b)b.focus();else if(undo)undo.focus();}
}
/* The toast's Undo: only for the character it was shown for. */
function undoFireTap(rec,who,viaKey,itemId){
  if(!character||character!==who)return false;
  if(!undoFire(character,rec))return false;
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  const st=(character.inventory||[]).find(i=>i&&i.id===rec.undo.stack.id);
  toast(st?`Shot undone · ${String(st.name||"")} ×${itemQty(st)}`:"Shot undone");
  if(viaKey){const b=ammoFireBtn(itemId);if(b)b.focus();}
  return true;
}
/* One row of the stack picker (spec §6): name, ×qty, and the stack's +N when
   it has one — "· +1", "· -1" — so a plain and a magic stack of the same
   piece read apart. `cur` is the stack the weapon is loaded with now. */
function ammoChoiceHTML(s,cur){
  const am=itemAmmo(s), bonus=am&&am.bonus?(am.bonus>0?"+"+am.bonus:String(am.bonus)):"";
  const hint="×"+String(itemQty(s))+(bonus?" · "+bonus:"");
  return `<button type="button" class="ammo-choice${s===cur?" on":""}" data-ammo-load="${esc(s.id)}" aria-pressed="${s===cur?"true":"false"}"><span>${esc(String(s.name||""))}</span><span class="hint">${esc(hint)}</span></button>`;
}
/* The stack picker: every stack the weapon can load, the loaded one marked. */
function openAmmoPicker(itemId){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  const kind=weaponAmmoKind(it);if(!kind)return;
  const cur=loadedStack(character,it);
  const list=ammoStacks(character,kind).map(s=>ammoChoiceHTML(s,cur)).join("");
  openModal("Load "+String(it.name||"weapon"),
    `<p class="hint">What ${esc(String(it.name||"it"))} fires next. It keeps firing from this stack while the stack lasts.</p><div class="ammo-picks" data-ammo-weapon="${esc(it.id)}">${list}</div>`);
}
/* A stack chosen in the picker, kept on the weapon item OUTSIDE `weapon`. The
   modal hands focus back to the row's picker button once the row is redrawn. */
function loadAmmo(itemId,stackId){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  const st=it&&ammoStacks(character,weaponAmmoKind(it)).find(s=>s.id===stackId);
  if(!st)return false;
  it.ammoStack=st.id;
  closeModal();scheduleSave();renderAttacks();
  return true;
}
/* Recover N on a row: what this kind's rule gives back of what it fired
   since the last recovery (#104). A thrown weapon's row recovers its own
   entry only, by its id, so the tap gives back exactly the N its row shows. */
function recoverWeaponAmmo(itemId,viaKey){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  const thrown=!weaponAmmoKind(it)&&weaponThrown(it);
  const kind=weaponAmmoKind(it)||(thrown?ammoThrownKind(it):"");if(!kind)return 0;
  const e=thrown?ammoSpentEntry(character,it.id):null;
  const list=thrown?(e.n&&e.kind?[{kind:e.kind,fired:e.n,back:ammoThrownBack(character,it)}]:[])
                   :ammoRecoverable(character).filter(r=>r.kind===kind);
  const back=thrown?recoverAmmo(character,null,undefined,[it.id]):recoverAmmo(character,[kind]);
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  toast(back?`Recovered ${ammoSummaryText(list)}`:`No ${ammoPlural(kind)} to recover`);
  if(viaKey){const b=ammoFireBtn(itemId);if(b)b.focus();}
  return back;
}
/* After End combat (#104, spec §6): the fight is over, so every outstanding
   count is settled — each entry gives back what its rule allows and is
   cleared, and the rest is spent (spec §4.3). A count on None or Never is
   retired too, not kept: kept, it piled up fight after fight and came back in
   full the day the rule changed (final review, item 1). When something came
   back, the words for the End combat toast come back with the record its Undo
   needs — that Undo restores every entry it cleared, the ones that gave
   nothing included. When nothing came back the counts are cleared quietly and
   this returns null: no toast words, no Undo. Shots fired outside a tracked
   fight are swept up too, as the row's Recover does. */
function applyAmmoRecovery(){
  if(!Object.keys(ammoSpentMap(character)).length)return null;
  const list=ammoRecoverable(character), rec={};
  recoverAmmo(character,null,rec);
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  return list.length?{text:`recovered ${ammoSummaryText(list)}`,rec}:null;
}
/* The End combat toast's Undo recovery: only for the character it was shown for. */
function undoRecoveryTap(rec,who){
  if(!character||character!==who)return false;
  if(!undoRecovery(character,rec))return false;
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  toast("Recovery undone");
  return true;
}
