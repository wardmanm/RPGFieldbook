/* ================= character ↔ rules diff =================
   Characters COPY rules entries, so a sheet drifts from the data over time.
   This finds the drift. Pure functions only — no DOM — so it stays testable and
   so the UI layer below can render whatever it likes from the result.

   Matching is the hard part. A copy stamped by stampSrc() carries its pack, its
   category and per-field hashes, and matches exactly. Anything added before
   stamping existed has only its NAME, which the app itself knows to be ambiguous
   (see recomputeDups/dispName) — those are reported as `ambiguous` and never
   ticked by default. We would rather ask than silently pick the wrong entry.

   A COPY IS NOT ITS DEF. Copy sites transform: browse folds a presentation line
   into an item's description and converts "2 gp" to the number 2. Comparing a
   copy against the raw rules entry therefore reports every browse-added item as
   permanently changed, and "updating" it strips the meta line and puts the
   string back. So the diff compares against a PROJECTION — the same transform
   the copy site applied — recorded per copy as `src.shape`. */

/* Rules-owned fields per kind: what an update is allowed to overwrite. Anything
   NOT listed here is character-local (qty, equipped, prepared, uses.used, id,
   origin, grant, ...) and must survive an update untouched. */
const UPD_FIELDS={
  feature:["description","effects","uses","cost"],
  spell:["level","meta","text"],
  item:["description","effects","cost","weight","weapon"]
};
const UPD_CATS=[["features","feature"],["spells","spell"],["inventory","item"]];

/* What a copy of `def` SHOULD look like, for the shape it was copied in.
   "browse" = added through the item picker (meta line + gp cost);
   "plain"  = copied verbatim (granted items, traits, spells). */
function updProject(def,kind,shape){
  if(!def)return {};
  if(kind==="item"&&shape==="browse"){
    const m=itemMetaLine(def);
    const p={description:(m?m+"\n":"")+(def.description||""),
             effects:Array.isArray(def.effects)?def.effects:[]};
    const c=costToGp(def.cost); if(c!=null)p.cost=c;
    const w=fnum(def.weight); if(w)p.weight=w;
    if(def.weapon)p.weapon=def.weapon;
    return p;
  }
  const p={};
  (UPD_FIELDS[kind]||[]).forEach(f=>{if(def[f]!==undefined)p[f]=def[f];});
  /* Cost is the one field whose pack form differs from its stored form: the
     pack writes "2 gp", the sheet stores 2. Project the STORED form, or the
     projection describes a copy no copy site would ever produce — which is how
     granted items sat with no cost at all and the diff never noticed.
     An unparseable cost ("varies") projects as absent, not as a string. */
  if(kind==="item"&&"cost" in p){const c=costToGp(def.cost);if(c!=null)p.cost=c;else delete p.cost;}
  return p;
}
/* per-field hashes of the projection — so a later diff can say WHICH field the
   pack changed, and leave fields the player deviated on alone */
function fpMap(obj,kind){
  const out={};
  (UPD_FIELDS[kind]||[]).forEach(f=>{out[f]=fpHash(obj?obj[f]:null);});
  return out;
}
/* Tag a fresh copy with where it came from and what both sides looked like.
   `cat` is the RULE_CATS bucket the def lives in ("feats"/"spells"/"items"), or
   "" for a trait embedded inside a class/race/background — those have no
   top-level entry, so the diff re-resolves them through the copy's `origin`. */
function stampSrc(copy,def,kind,cat,shape){
  if(!copy||!def)return copy;
  copy.src={cat:cat||"",pack:def._source||"",kind,shape:shape||"plain",
            name:def.name||copy.name||"",
            fp:fpMap(updProject(def,kind,shape||"plain"),kind),
            cfp:fpMap(copy,kind)};
  return copy;
}
/* after writing rules-owned fields onto a copy, re-baseline both sides */
function restampSrc(copy,def,kind){
  if(!copy||!copy.src)return copy;
  copy.src.fp=fpMap(updProject(def,kind,copy.src.shape),kind);
  copy.src.cfp=fpMap(copy,kind);
  return copy;
}

function updCandidates(cat,name){
  const n=String(name||"").trim().toLowerCase();
  if(!n)return [];
  return (rules[cat]||[]).filter(x=>String(x.name||"").trim().toLowerCase()===n);
}
/* Resolve a copy back to its rules entry.
   -> {def} | {ambiguous:[...]} | {} when nothing matches */
function updResolve(copy,kind){
  const src=copy&&copy.src;
  if(src&&src.cat){
    const hits=updCandidates(src.cat,src.name||copy.name);
    if(src.pack){
      const exact=hits.filter(x=>(x._source||"")===src.pack);
      if(exact.length===1)return {def:exact[0]};
      if(exact.length>1)return {ambiguous:exact};
      /* The pack this was copied from isn't loaded. A same-named entry from a
         DIFFERENT pack is not the same content — adopting it silently is the
         exact guess this design refuses to make. Offer it, labelled, unticked. */
      if(hits.length)return {def:hits[0],loose:true,otherPack:src.pack};
      return {};
    }
    if(hits.length===1)return {def:hits[0]};
    if(hits.length>1)return {ambiguous:hits};
    return {};
  }
  /* embedded class/race/background trait — re-resolve through the origin */
  if(kind==="feature"&&copy.origin)return updTraitFromOrigin(copy);
  /* unstamped legacy copy: name-only, across the plausible categories */
  const cats=kind==="spell"?["spells"]:kind==="item"?["items"]:["feats"];
  let hits=[];
  cats.forEach(c=>{hits=hits.concat(updCandidates(c,copy.name));});
  if(kind==="feature"&&!hits.length){
    /* feats are stored as "Feat: Alert" */
    const m=String(copy.name||"").match(/^Feat:\s*(.+)$/i);
    if(m)hits=updCandidates("feats",m[1]);
  }
  if(hits.length===1)return {def:hits[0],loose:true};
  if(hits.length>1)return {ambiguous:hits,loose:true};
  return {};
}
/* Find the trait a granted feature came from, inside its class/race/background
   definition. Those traits have no top-level rules entry to look up. */
function updTraitFromOrigin(copy){
  const o=copy.origin||{},nm=String(copy.name||"").trim().toLowerCase();
  const from=list=>(list||[]).find(t=>String(t.name||"").trim().toLowerCase()===nm);
  if(o.kind==="race"){
    const d=findRaceDef(o.name);if(!d)return {};
    let t=from(d.traits);
    if(!t&&character.race&&character.race.subrace){
      const s=(d.subraces||[]).find(x=>x.name===character.race.subrace);
      if(s)t=from(s.traits);
    }
    return t?{def:t}:{};
  }
  if(o.kind==="background"){
    const d=findBackgroundDef(o.name);if(!d)return {};
    const single=(d.feature&&String(d.feature.name||"").trim().toLowerCase()===nm)?d.feature:null;
    const t=single||from(d.traits);
    return t?{def:t}:{};
  }
  if(o.kind==="class"){
    const d=findClassDef(o.class);if(!d)return {};
    const lv=(d.levels||{})[String(o.level)]||{};
    let t=from(lv.traits);
    if(!t&&o.subclass){
      const sc=subclassesFor(d)[o.subclass];
      if(sc)t=from(((sc.levels||{})[String(o.level)]||{}).traits);
    }
    return t?{def:t}:{};
  }
  return {};
}
/* Which rules-owned fields the PACK changed since this copy was made.
   Compared projection-then vs projection-now, not copy vs projection: a player
   who overrode an item's cost at add time hasn't been changed by anything, and
   must not be nagged about it — or have it silently overwritten. */
function updChangedFields(copy,def,kind){
  const shape=(copy.src&&copy.src.shape)||"plain";
  const now=fpMap(updProject(def,kind,shape),kind);
  const then=copy.src&&copy.src.fp;
  /* A field this app didn't track when the copy was stamped has no baseline in
     `then`, and "no baseline" is not "the pack changed it" — without this guard,
     adding a field to UPD_FIELDS flags every previously-stamped copy at once.
     Those fields baseline on the next restamp instead. */
  if(then&&typeof then==="object")
    return (UPD_FIELDS[kind]||[]).filter(f=>then[f]!==undefined&&now[f]!==then[f]);
  /* unstamped legacy copy — no baseline, so fall back to copy vs projection */
  const proj=updProject(def,kind,shape);
  return (UPD_FIELDS[kind]||[]).filter(f=>fpHash(copy[f])!==fpHash(proj[f]));
}
/* has the player hand-edited this copy since it was added? */
function updEdited(copy,kind){
  const then=copy.src&&copy.src.cfp;
  if(!then||typeof then!=="object")return null;   /* unknowable */
  const now=fpMap(copy,kind);
  return (UPD_FIELDS[kind]||[]).some(f=>now[f]!==then[f]);
}
/* ---- the same question for an attack row ----
   An attack derived from a weapon is not a copy of a rules entry, so it has no
   `src`: nothing resolves it back to a pack, and only the ITEM it came from can
   rebuild it. What it needs is the other half of stampSrc's answer — was this
   row left exactly as we generated it, or did the player make it theirs?

   `genFp` is one hash over the fields addAttackForItem() derives from the item.
   Everything else on the row is the player's either way: `proficient` and
   `addAbilityDamage`, the extras they added, its id, and the links back to the
   item or spell. Optional and additive — an attack saved before this existed has
   no genFp, which reads as *unknowable*, and updResyncAttack leaves those alone.

   Deliberately a single hash, not an fpMap: nothing needs to know WHICH field
   moved, only whether any did. */
const ATK_GEN_FIELDS=["name","kind","ability","atkMisc","damageDice","damageType","dmgMisc","notes"];
function atkGenFp(atk){
  const o={};(ATK_GEN_FIELDS).forEach(f=>{o[f]=atk?atk[f]:undefined;});
  return fpHash(o);
}
/* stamp a freshly generated (or freshly re-generated) attack as untouched */
function stampAtkGen(atk){ if(atk)atk.genFp=atkGenFp(atk); return atk; }
/* has the player hand-edited this attack? null = no stamp, so unknowable */
function updAtkEdited(atk){
  if(!atk||typeof atk.genFp!=="string")return null;
  return atkGenFp(atk)!==atk.genFp;
}
/* Traits the rules now grant that the sheet doesn't have. Only ever ADDITIVE —
   a level already held gaining a trait is the case that matters. */
function updMissingTraits(){
  /* Keyed by ORIGIN + name, not name alone: a Fighter/Barbarian legitimately has
     two different "Extra Attack" traits, and a flat name set would hide the
     second one forever. */
  const key=(o,nm)=>[o&&o.kind,o&&(o.class||o.name),o&&o.subclass,o&&o.level,
                     String(nm||"").trim().toLowerCase()].join("|");
  const have=new Set((character.features||[]).map(f=>key(f.origin,f.name)));
  const untagged=new Set((character.features||[]).filter(f=>!f.origin).map(f=>String(f.name||"").trim().toLowerCase()));
  const out=[];
  const want=(t,origin,label)=>{
    if(!t||!t.name)return;
    if(have.has(key(origin,t.name)))return;
    /* An UNTAGGED feature of the same name is probably this trait from before
       origins were recorded — don't offer a duplicate of something they have. */
    if(untagged.has(String(t.name).trim().toLowerCase()))return;
    out.push({cat:"features",kind:"feature",type:"added",name:t.name,def:t,origin,
              pack:label,why:"new in "+label,edited:false,fields:["description"]});
  };
  if(character.race&&character.race.name){
    const d=findRaceDef(character.race.name);
    if(d){
      (d.traits||[]).forEach(t=>want(t,{kind:"race",name:d.name},d.name));
      const s=(d.subraces||[]).find(x=>x.name===character.race.subrace);
      if(s)(s.traits||[]).forEach(t=>want(t,{kind:"race",name:d.name},d.name+" ("+s.name+")"));
    }
  }
  if(character.bg&&character.bg.name){
    const d=findBackgroundDef(character.bg.name);
    /* a background grants ONE `feature` object, not a `traits` array */
    if(d&&d.feature&&d.feature.name)want(d.feature,{kind:"background",name:d.name},d.name);
    if(d)(d.traits||[]).forEach(t=>want(t,{kind:"background",name:d.name},d.name));
  }
  (character.classes||[]).forEach(c=>{
    const d=findClassDef(c.name);if(!d)return;
    const lvl=num(c.level);
    for(let L=1;L<=lvl;L++){
      const lv=(d.levels||{})[String(L)]||{};
      (lv.traits||[]).forEach(t=>want(t,{kind:"class",class:c.name,level:L},c.name+" "+L));
      if(c.subclass){
        const sc=subclassesFor(d)[c.subclass];
        if(sc)(((sc.levels||{})[String(L)]||{}).traits||[]).forEach(t=>
          want(t,{kind:"class",class:c.name,level:L,subclass:c.subclass},c.subclass+" "+L));
      }
    }
  });
  return out;
}
/* The whole diff. Rows are UI-agnostic; `apply` marks the default tick state. */
function diffCharacter(){
  const rows=[];
  const anyRules=RULE_CATS.some(c=>(rules[c]||[]).length);
  if(!anyRules)return {rows,anyRules:false};
  UPD_CATS.forEach(([cat,kind])=>{
    (character[cat]||[]).forEach(copy=>{
      const r=updResolve(copy,kind);
      if(r.ambiguous){
        rows.push({cat,kind,type:"ambiguous",id:copy.id,name:copy.name,copy,
                   pack:r.ambiguous.map(x=>x._source||"?").join(" / "),
                   why:"same name in "+r.ambiguous.length+" packs — can't tell which",
                   edited:false,fields:[],apply:false});
        return;
      }
      if(!r.def){
        rows.push({cat,kind,type:"unmatched",id:copy.id,name:copy.name,copy,pack:"",
                   why:"not in any loaded pack",edited:false,fields:[],apply:false});
        return;
      }
      const fields=updChangedFields(copy,r.def,kind);
      if(!fields.length)return;
      /* Edited by the player? Only knowable when a copy-time baseline exists;
         without one (legacy, or a loose match) treat it as possibly-edited. */
      const ed=updEdited(copy,kind);
      const edited=ed===null?true:ed;
      /* "changed" would be a lie for a field the copy never had — that reads as
         "the pack was edited" when really the app failed to copy it in the
         first place, which is how granted items ended up with no cost. */
      const absent=fields.filter(f=>copy[f]===undefined);
      const why=r.otherPack
        ? `“${r.otherPack}” isn't loaded — this is the ${r.def._source||"other"} version`
        : (absent.length===fields.length
            ? fields.join(", ")+" missing from this copy"
            : fields.join(", ")+" changed")+(r.loose?" (matched by name only)":"");
      rows.push({cat,kind,type:"changed",id:copy.id,name:copy.name,copy,def:r.def,
                 pack:r.def._source||"",
                 why,edited,fields,
                 apply:!edited&&!r.loose&&!r.otherPack});
    });
  });
  updMissingTraits().forEach(r=>rows.push(Object.assign({apply:true},r)));
  return {rows,anyRules:true};
}
/* Write the rules-owned fields of one row onto the character. Everything not in
   UPD_FIELDS is character-local and is deliberately left alone. */
function applyUpdateRow(row){
  if(row.type==="added"){
    addFeatureFromDef(row.def,row.origin);
    const added=character.features[character.features.length-1];
    if(added)stampSrc(added,row.def,"feature","");
    return true;
  }
  if(row.type!=="changed"||!row.copy||!row.def)return false;
  const shape=(row.copy.src&&row.copy.src.shape)||"plain";
  const proj=updProject(row.def,row.kind,shape);
  const spent=(row.copy.uses||{}).used;
  /* Only write the fields the PACK actually changed. Writing all of them would
     clobber deliberate deviations (a custom cost typed in at add time). */
  (row.fields||[]).forEach(f=>{
    if(proj[f]===undefined){delete row.copy[f];return;}
    row.copy[f]=JSON.parse(JSON.stringify(proj[f]));
  });
  /* uses.max may have moved; the player's spent count must survive it */
  if(row.copy.uses)row.copy.uses.used=num(spent);
  if(!row.copy.src)stampSrc(row.copy,row.def,row.kind,row.cat==="inventory"?"items":row.cat,shape);
  else restampSrc(row.copy,row.def,row.kind);
  /* a weapon's dice/type may have changed — the linked attack row is derived
     from the item and does not update itself */
  if(row.kind==="item"&&row.copy.weapon)updResyncAttack(row.copy);
  return true;
}
/* Rebuild the attack derived from an inventory item — but only when the player
   has not made it theirs. An attack the player edited is left ALONE: they did
   that for a reason, and this used to splice the row out and regenerate it, so
   the edit went with no warning and nothing to undo it.
   `updAtkEdited` is three-valued, and only one of the three may be rebuilt:
     false -> still exactly as generated  -> rebuild, keeping the id
     true  -> the player edited it        -> leave it
     null  -> no stamp: from before this  -> unknowable, so leave it
   Erring toward the player's work is the point; the pack change is still
   visible on the item itself. */
function updResyncAttack(it){
  const i=(character.attacks||[]).findIndex(a=>a.itemId===it.id);
  if(i<0){if(typeof addAttackForItem==="function")addAttackForItem(it);return;}
  if(updAtkEdited(character.attacks[i])!==false)return;
  const keepId=character.attacks[i].id;
  character.attacks.splice(i,1);
  if(typeof addAttackForItem==="function")addAttackForItem(it);
  const now=(character.attacks||[]).find(a=>a.itemId===it.id);
  /* keep the id stable so collapse state survives; addAttackForItem re-stamps,
     so the rebuilt row is comparable again next time */
  if(now)now.id=keepId;
}
function applyUpdates(rows){
  let n=0;
  const touched=[];
  (rows||[]).forEach(r=>{if(applyUpdateRow(r)){n++;if(r.kind==="spell"&&r.copy)touched.push(r.copy);}});
  /* only the spells we actually rewrote — resyncing every spell would rebuild
     attack rows the player never asked us to touch */
  if(typeof syncSpellAttack==="function")touched.forEach(sp=>syncSpellAttack(sp));
  if(n)recompute();
  return n;
}
/* has this character fallen behind, and is there anything to say about it? */
function charNeedsUpdate(ch){
  ch=ch||character;
  if(!ch)return false;
  if(ch.isBackup)return false;
  if(ch.skipUpdate&&ch.skipUpdate===APP_VERSION)return false;
  if(cmpVer(ch.appVersion||"0.0.0",APP_VERSION)>=0)return false;
  return RULE_CATS.some(c=>(rules[c]||[]).length);
}

