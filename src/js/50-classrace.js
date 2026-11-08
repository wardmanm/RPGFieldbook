/* ============ Class & Ancestry (rules-driven) ============ */
function findRaceDef(n){return ruleById("races",n);}
function findClassDef(n){return ruleById("classes",n);}
function findFeatDef(n){return ruleById("feats",n);}
/* Emblems (game-icons.net, CC BY 3.0) — the map is src/icons/icons.json, and
   GAME_ICONS/ICON_MAP are generated into 05-icons.js from it.

   Keyed by NAME, not _id, and deliberately so: a character stores its class,
   ancestry and background as plain strings, so the emblem still draws when no
   rules pack is loaded at all. Lower-cased to match keyOf() in 89-rules-merge.

   An unmapped name returns "" — a custom or homebrew class simply gets no
   emblem and the chip renders exactly as it did before. A per-kind fallback was
   considered and rejected: a wrong-but-present emblem on someone's homebrew is
   worse than none.

   `d` cannot carry markup — fetch-icons.js validates every path against the
   SVG path-data charset before writing it, and the name is only ever a lookup
   key — but it is esc()'d all the same: every attribute value is, so the guard
   in rules-data.js can check that without a list of exceptions to maintain. */
function iconSlug(kind,name){return (ICON_MAP[kind]||{})[String(name||"").trim().toLowerCase()]||"";}
function iconSVG(kind,name,cls){
  const d=GAME_ICONS[iconSlug(kind,name)];
  if(!d)return "";
  return `<svg class="gicon${esc(cls?" "+cls:"")}" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="${esc(d)}"/></svg>`;
}
/* subclasses available for a class = the class's own subclasses + any standalone
   entries in the "subclasses" category whose class matches (so add-on packs can
   attach subclasses to an existing class without duplicating the whole class).

   The key is the subclass NAME because that is what `character.classes[].subclass`
   stores — so a same-named entry from a DIFFERENT pack must not take the key, or
   loading a supplement silently rewrites what every existing character already
   chose. The 2024 PHB reprinted seven Xanathar's/Tasha's subclasses (Gloom
   Stalker, Fey Wanderer, Soulknife...) with revised text and different levels, so
   this is a real collision, not a theoretical one. The later arrival is offered
   alongside, tagged with its pack — the player picks the edition. Same pack, same
   name still replaces, which is how re-importing a pack updates it. */
function subclassesFor(d){
  const out={};
  if(d&&d.subclasses)Object.keys(d.subclasses).forEach(n=>{out[n]=Object.assign({_source:d._source},d.subclasses[n]);});
  (rules.subclasses||[]).forEach(s=>{
    if(!(s&&s.class&&d&&String(s.class).toLowerCase()===String(d.name||"").toLowerCase()))return;
    const prev=out[s.name];
    const k=(prev&&(prev._source||"")!==(s._source||""))?s.name+" ("+(s._source||"other")+")":s.name;
    out[k]=s;
  });
  return out;
}
/* The pack tag shown beside a subclass's name, or "" when subclassesFor()
   already put it IN the name — a reprint is keyed "Psi Warrior (TCE)", and
   tagging that again read "Psi Warrior (TCE) (TCE)". */
function subSourceTag(n,sc){const s=sc&&sc._source;return s&&!String(n).endsWith("("+s+")")?s:"";}
function totalLevel(){return (character.classes||[]).reduce((a,c)=>a+num(c.level),0)||num(character.level)||1;}
function addFeatureFromDef(t,origin){
  const feat={id:uid(),name:t.name||"Trait",source:t.source||(origin&&(origin.class||origin.name))||"",description:t.description||"",effects:Array.isArray(t.effects)?t.effects:[],enabled:true,origin:origin||null};
  if(t.uses&&t.uses.max!=null&&(typeof t.uses.max!=="number"||num(t.uses.max)>0))feat.uses={max:t.uses.max,per:t.uses.per||"long",used:0};
  if(t.cost&&num(t.cost.amount)>0)feat.cost={resource:t.cost.resource||"",amount:num(t.cost.amount)};
  stampSrc(feat,t,"feature");
  character.features.push(feat);
  const sid=originSid(origin);
  if(sid){(t.skills||[]).forEach(nm=>{const k=skillKey(nm);if(k)grantProf(sid,"skill",k,1);});(t.saves||[]).forEach(ab=>{if(character.saves[String(ab).toLowerCase()]!==undefined)grantProf(sid,"save",String(ab).toLowerCase(),1);});}
}
function removeFeaturesWhere(pred){character.features=character.features.filter(f=>!pred(f));}
/* grant a feat by name: forwards its uses/cost, and queues any skill-choices it carries */
/* ---- equipment grants (backgrounds/classes/races): link to loaded item list + track provenance ---- */
function goldKey(){return "gp";}
function grantItemByName(name,qty,sid){
  qty=Math.max(1,num(qty)||1);
  let def=(rules.items||[]).find(i=>String(i.name||"").toLowerCase()===String(name||"").toLowerCase());
  /* a granted bundle arrives as its single piece too (#6): "Arrows (20)" is 20 Arrows */
  if(def){const u=unpackAmmo(def,rules.items);if(u.per>1){def=u.def;qty*=u.per;name=def.name;}}
  const ex=character.inventory.find(i=>i.grant===sid&&String(i.name||"").toLowerCase()===String(name||"").toLowerCase());
  if(ex){ex.qty=num(ex.qty)+qty;logGrant(sid,{dir:"+",text:`${name} ×${qty}`});return;}
  const it={id:uid(),name:(def&&def.name)||name,qty,description:(def&&def.description)||"",effects:(def&&Array.isArray(def.effects))?def.effects:[],equipped:false,grant:sid,origin:originFromSid(sid)};
  if(def&&def.weapon)it.weapon=def.weapon;
  {const am=def&&itemAmmo(def);if(am)it.ammo=am.bonus?{kind:am.kind,bonus:am.bonus}:{kind:am.kind};}
  if(def){
    const wg=fnum(def.weight);if(wg)it.weight=wg;
    /* Cost is a DISPLAY STRING in the pack ("2 gp", "5 cp") and a gp number on
       the sheet, so it has to be parsed — copying it raw renders no badge at
       all and quietly breaks the inventory total. Weight needs no such care,
       which is exactly why weight worked here and cost didn't. */
    const cg=costToGp(def.cost);if(cg!=null)it.cost=cg;
    /* invSection() files by these; without them everything that isn't a weapon
       or armour lands in Loot. */
    if(def.category)it.category=def.category;
    if(def.type)it.type=def.type;
  }
  if(def)stampSrc(it,def,"item","items");   /* no def = a named grant with no matching item entry */
  character.inventory.push(it);
  equipNewWeapon(it);   /* as the finder's: equipped, with its attack row (#128) */
  logGrant(sid,{dir:"+",text:`${name} ×${qty}`});
}
function addGrantGold(amt,sid){
  amt=num(amt);if(amt<=0)return;
  if(!character.coins||typeof character.coins!=="object")character.coins={};
  const k=goldKey();character.coins[k]=num(character.coins[k])+amt;
  if(!character.grantGold)character.grantGold={};
  character.grantGold[sid]=num(character.grantGold[sid])+amt;
  const e=logGrant(sid,{dir:"+",text:`${amt} ${goldKey().toUpperCase()}`});if(e)e.meta.gold=true;
}
function applyEquipOption(o,sid){
  if(!o)return;
  (o.items||[]).forEach(e=>{if(e&&e.name)grantItemByName(e.name,e.qty,sid);});
  if(num(o.gold)>0)addGrantGold(num(o.gold),sid);
}
function equipOptLabel(o){
  const parts=(o.items||[]).map(e=>(num(e.qty)>1?num(e.qty)+"× ":"")+e.name);
  if(num(o.gold)>0)parts.push(num(o.gold)+" gp");
  return (o.label?o.label+" — ":"")+(parts.join(", ")||"nothing");
}
/* apply an equipmentGrants array: fixed blocks immediately, choose-blocks queued to pending for a picker */
function applyEquipGrants(grants,sid,pending){
  (grants||[]).forEach(block=>{
    if(block&&Array.isArray(block.choose))(pending||[]).push({kind:"equip",sid,label:block.label||"Starting equipment",options:block.choose});
    else if(block)applyEquipOption(block,sid);
  });
}
/* remove everything a source granted: inventory items + their linked attacks + granted gold.
   #47 (final review I2): what left is logged as ONE line, "Removed with <source>",
   with no Undo — granting again belongs to the source, not to the log. */
function revertEquipmentGrants(sid){
  const gone=character.inventory.filter(i=>i.grant===sid).map(i=>({dir:"-",text:`${String(i.name||"Item")} ×${itemQty(i)}`}));
  const rmIds=character.inventory.filter(i=>i.grant===sid).map(i=>i.id);
  /* a granted stack's spent count goes with it, or Recover would bring it back —
     by id for a stack still here, and by the snapshot's own grant for one
     already fired down to nothing and removed before the source was */
  rmIds.forEach(id=>forgetAmmo(character,id));
  forgetGrantAmmo(character,sid);
  character.inventory=character.inventory.filter(i=>i.grant!==sid);
  if(rmIds.length)character.attacks=(character.attacks||[]).filter(a=>!rmIds.includes(a.itemId));
  let gold=false;
  if(character.grantGold&&character.grantGold[sid]){const k=goldKey();character.coins=character.coins||{};
    const was=num(character.coins[k]);character.coins[k]=Math.max(0,was-num(character.grantGold[sid]));delete character.grantGold[sid];
    if(was-character.coins[k]>0){gone.push({dir:"-",text:`${was-character.coins[k]} ${k.toUpperCase()}`});gold=true;}}
  if(gone.length)logInv({kind:"grant",title:"Removed with "+grantSourceName(sid),lines:gone,undo:null,meta:gold?{sid,revert:true,gold:true}:{sid,revert:true}});
}
function grantFeatDef(featName,origin,pending){
  const fd=findFeatDef(featName)||{name:featName,description:"",effects:[]};
  addFeatureFromDef({name:"Feat: "+fd.name,description:fd.description||"",effects:fd.effects||[],uses:fd.uses,cost:fd.cost},origin);
  /* re-stamp against the real feat entry: addFeatureFromDef only saw the
     "Feat: X" wrapper built above, which has no pack and the wrong name */
  const added=character.features[character.features.length-1];
  if(added)stampSrc(added,fd,"feature","feats");
  const sid=originSid(origin);
  if(pending&&sid)(fd.choices||[]).forEach(ch=>{if(ch&&ch.type==="skill")pending.push({ch:Object.assign({},ch,{_sid:sid}),sid,label:"Feat: "+fd.name});});
}
/* present a set of pending {ch,sid,label} choices — skill choices (from race
   traits or feats), feat choices (a species' or background's, #118), a
   background's tool choices (#121) and equipment pickers — and grant each to
   its sid */
function runExtraChoices(pending){
  const skills=(pending||[]).filter(x=>x&&x.kind!=="equip"&&x.ch&&x.ch.type==="skill"&&(x.ch.from||[]).length);
  const feats=(pending||[]).filter(x=>x&&x.kind!=="equip"&&x.ch&&x.ch.type==="feat");
  const tools=(pending||[]).filter(x=>x&&x.kind!=="equip"&&x.ch&&x.ch.type==="tool"&&(x.ch.kinds||[]).length);
  const equips=(pending||[]).filter(x=>x&&x.kind==="equip"&&(x.options||[]).length);
  if(!skills.length&&!feats.length&&!tools.length&&!equips.length)return;
  let body="",ci=0;const list=[];
  skills.forEach(x=>{list[ci]=x.ch;body+=`<p class="hint" style="color:var(--accent-2);font-size:13px;margin:6px 0 0">✦ ${esc(x.label||"Choose")}</p>`+choiceFieldHTML(x.ch,ci++,null);});
  /* the sid rides on the block's data-sid (choiceFieldHTML reads ch._sid) */
  feats.forEach(x=>{const ch=Object.assign({},x.ch,{_sid:x.sid});list[ci]=ch;body+=choiceFieldHTML(ch,ci++,null);});
  /* the pick names the placeholders the grant made: their ids ride on the
     block's data-chipids */
  tools.forEach(x=>{const ch=Object.assign({},x.ch,{_sid:x.sid});list[ci]=ch;body+=choiceFieldHTML(ch,ci++,null);});
  equips.forEach((x,ei)=>{
    body+=`<div class="choice" data-ctype="equip" data-eqi="${esc(ei)}" style="border-top:1px dotted var(--hair);padding-top:10px;margin-top:10px"><label class="f">${esc(x.label||"Starting equipment")}</label>`+
      x.options.map((o,oi)=>`<label class="opt" style="align-items:flex-start"><input type="radio" name="eq-${esc(ei)}" data-eq-opt="${esc(oi)}" ${oi===0?"checked":""}><span>${esc(equipOptLabel(o))}</span></label>`).join("")+`</div>`;
  });
  body+=`<div class="m-actions"><button class="tbtn primary" id="xchDone">Done</button></div>`;
  openModal("Choose",body);
  /* Same guard as the class chooser — after openModal, which clears it. This
     modal never populates _activeChoices, so data-choose on the wrapper is the
     only place the target exists here; choiceBlocks() reads it from the DOM,
     which is exactly why it was put there. */
  armChoiceDismissGuard();
  wireAsiFeats(list);
  const b=document.getElementById("xchDone");
  /* The warnings first (choiceDoneHandler, 58-choices.js), with the window
     open; the picks are read after them */
  if(b)b.addEventListener("click",choiceDoneHandler(b,()=>{
    const next=[];
    commitExtraChoices(gatherChoices(),next);
    document.querySelectorAll('[data-ctype="equip"]').forEach(div=>{
      const ei=num(div.dataset.eqi),sel=div.querySelector('[data-eq-opt]:checked'),x=equips[ei];
      if(x&&sel)applyEquipOption(x.options[num(sel.dataset.eqOpt)],x.sid);
    });
    /* the picks can grant gold and items: through the one redraw (#153) */
    closeModal();renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
    /* a picked feat's own skill choices: the next window, one at a time (#63) */
    if(next.length)runExtraChoices(next);
  }));
}

/* Every class, species and background change ends here: adding, changing or
   removing one, a level up or down, a subclass, and the Done of each choice
   window they open (commitChoices(), runExtraChoices()). The Class and
   Ancestry & Background cards it once drew are gone (#103): their controls
   live in the sheet header — the class line, its flyout and the species and
   background windows — so it repaints the header. And what a change grants or
   takes back lands beyond the header, so it repaints that too, or it shows
   only after a reload (#153, #154): items in the inventory, gold in the coin
   boxes, languages as Bio chips. The caller's renderFeatures() and
   recompute() do the features, the numbers, the attack rows and the
   resources. renderAll(), applyTheme() and refreshRulesUI(), which want the
   header alone, call renderSheetHead(). */
function renderClassRace(){
  renderSheetHead();
  renderInventory();renderCoins();renderChipsAll();
}


/* ---- seeds (#131) ----
   A species seeds speed, size and a line of Proficiencies text; a class or
   subclass seeds the spellcasting ability. Each is written only into an EMPTY
   field, so a player's own value always wins, and `character.seeds` records
   what each source put there: one {sid, field, value} per sid and field, the
   value exactly as the source gave it (a Humblewood speed is 30, an SRD one
   "30 ft"), or null when the field was already full and it wrote nothing.
   The revert then takes back only what still equals that record. A field
   with no entry at all for the sid means a source applied before the record,
   and falls back to what its loaded definition would have seeded. The sid
   "player" marks a speed or size the player set in its window: no seed writes
   over it, and no revert touches it.
   Read only through seedsOf(): a hand-edited file's junk entries are kept, so
   they round-trip, but never read. */
const SEED_FIELDS=["speed","size","spellAbility","proficiencies"];
function seedOk(e){return !!e&&typeof e==="object"&&!Array.isArray(e)&&typeof e.sid==="string"&&!!e.sid&&SEED_FIELDS.indexOf(e.field)>=0&&
  (e.value===null||typeof e.value==="string"||(typeof e.value==="number"&&isFinite(e.value)));}
function seedsOf(c){return (c&&Array.isArray(c.seeds)?c.seeds:[]).filter(seedOk).map(e=>({sid:e.sid,field:e.field,value:e.value}));}
function seedEntry(c,sid,field){return seedsOf(c).find(e=>e.sid===sid&&e.field===field)||null;}
/* replaces this sid's entry for the field; junk entries stay where they are */
function seedSet(c,sid,field,value){
  c.seeds=(Array.isArray(c.seeds)?c.seeds:[]).filter(e=>!(seedOk(e)&&e.sid===sid&&e.field===field)).concat([{sid,field,value}]);
}
function seedDrop(c,pred){if(Array.isArray(c.seeds))c.seeds=c.seeds.filter(e=>!(seedOk(e)&&pred(e)));}
function playerOwns(c,field){return !!seedEntry(c,"player",field);}
const seedBlank=v=>v===""||v===null||v===undefined;   /* 0 is a value: a speed of 0 is full */
/* `value` undefined, null or "" means the source doesn't carry the field, and
   nothing is recorded; neither is a value no field could hold (NaN, an object).
   A species then its subrace seed under one sid: a second, later seed that
   finds the field full keeps the first's record rather than nulling it, and
   their proficiencies lines are recorded as the one text they make together. */
function seedField(c,field,value,sid){
  if(!c||!sid||SEED_FIELDS.indexOf(field)<0||seedBlank(value))return;
  if(typeof value!=="string"&&!(typeof value==="number"&&isFinite(value)))return;
  const prev=seedEntry(c,sid,field);
  if(field==="proficiencies"){
    c.proficiencies=(c.proficiencies?c.proficiencies+"\n":"")+value;
    seedSet(c,sid,field,prev&&prev.value!==null?String(prev.value)+"\n"+value:value);
    return;
  }
  if(seedBlank(c[field])&&!playerOwns(c,field)){c[field]=value;seedSet(c,sid,field,value);}
  else if(!(prev&&prev.value!==null))seedSet(c,sid,field,null);
}
/* Take `t` out of the text where it still stands as its own line(s), with the
   newline that joined it, and tidy as the lifts do. Edited text stays. */
function unseedText(p,t){
  p=typeof p==="string"?p:"";t=String(t==null?"":t);if(!t)return p;
  for(let i=p.lastIndexOf(t);i>=0;i=i>0?p.lastIndexOf(t,i-1):-1){
    if(!(i===0||p[i-1]==="\n")||!(i+t.length===p.length||p[i+t.length]==="\n"))continue;
    const s=i>0?i-1:i,e=i>0?i+t.length:Math.min(p.length,i+t.length+1);
    return (p.slice(0,s)+p.slice(e)).replace(/\n{3,}/g,"\n\n").trim();
  }
  return p;
}
/* `would`: what the outgoing source's loaded definition seeds,
   {speed, size, spellAbility, proficiencies:[texts]}, or null when it isn't
   loaded — read only for a field with no entry at all (decision 11). */
function unseedSource(c,sid,would){
  if(!c||!sid)return;
  const w=would&&typeof would==="object"?would:null;
  SEED_FIELDS.forEach(field=>{
    if(playerOwns(c,field))return;
    const e=seedEntry(c,sid,field);
    if(field==="proficiencies"){
      const texts=e?(e.value===null?[]:[String(e.value)]):(w&&Array.isArray(w.proficiencies)?w.proficiencies.filter(x=>typeof x==="string"&&x):[]);
      texts.forEach(t=>{c.proficiencies=unseedText(c.proficiencies,t);});
      return;
    }
    const was=e?e.value:(w?w[field]:null);
    if(!seedBlank(was)&&!seedBlank(c[field])&&String(c[field])===String(was))c[field]="";
  });
  seedDrop(c,e=>e.sid===sid);
}
/* Decision 12: an empty spellcasting ability goes to the first class still on
   the sheet that casts, or that class's subclass, under that one's sid — as
   saving throws pass to the new first class (#66). */
function handOnSpellAbility(c){
  if(!c||!seedBlank(c.spellAbility))return;
  for(const cl of (Array.isArray(c.classes)?c.classes:[])){
    const d=findClassDef(cl&&cl.name);if(!d)continue;
    if(d.spellcasting){seedField(c,"spellAbility",d.spellcasting,"class:"+cl.name);return;}
    const sc=cl.subclass?subclassesFor(d)[cl.subclass]:null;
    if(sc&&sc.spellcasting){seedField(c,"spellAbility",sc.spellcasting,"subclass:"+cl.name+":"+cl.subclass);return;}
  }
}
/* A speed or size the player sets in its window (or Settings → Carrying):
   theirs, marked by a "player" entry that both helpers above respect. The
   sources' own entries stay, so their reverts still know what they seeded.
   "" gives it back: Size then reads the species' size live (charSize()), and
   Speed, which has no live fallback, is seeded again from the current species. */
function setPlayerField(c,field,value){
  if(!c||(field!=="speed"&&field!=="size"))return;
  if(seedBlank(value)){
    seedDrop(c,e=>e.sid==="player"&&e.field===field);
    c[field]="";
    if(field==="speed"&&c.race&&c.race.name){const w=raceWould(c);if(w)seedField(c,"speed",w.speed,"race:"+c.race.name);}
    return;
  }
  c[field]=value;seedSet(c,"player",field,value);
}
