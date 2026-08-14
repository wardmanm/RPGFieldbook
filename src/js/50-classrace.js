/* ============ Class & Ancestry (rules-driven) ============ */
function findRaceDef(n){return ruleById("races",n);}
function findClassDef(n){return ruleById("classes",n);}
function findFeatDef(n){return ruleById("feats",n);}
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
  const def=(rules.items||[]).find(i=>String(i.name||"").toLowerCase()===String(name||"").toLowerCase());
  const ex=character.inventory.find(i=>i.grant===sid&&String(i.name||"").toLowerCase()===String(name||"").toLowerCase());
  if(ex){ex.qty=num(ex.qty)+qty;return;}
  const it={id:uid(),name:(def&&def.name)||name,qty,description:(def&&def.description)||"",effects:(def&&Array.isArray(def.effects))?def.effects:[],equipped:false,grant:sid,origin:originFromSid(sid)};
  if(def&&def.weapon)it.weapon=def.weapon;
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
  if(it.weapon)addAttackForItem(it);
}
function addGrantGold(amt,sid){
  amt=num(amt);if(amt<=0)return;
  if(!character.coins||typeof character.coins!=="object")character.coins={};
  const k=goldKey();character.coins[k]=num(character.coins[k])+amt;
  if(!character.grantGold)character.grantGold={};
  character.grantGold[sid]=num(character.grantGold[sid])+amt;
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
/* remove everything a source granted: inventory items + their linked attacks + granted gold */
function revertEquipmentGrants(sid){
  const rmIds=character.inventory.filter(i=>i.grant===sid).map(i=>i.id);
  character.inventory=character.inventory.filter(i=>i.grant!==sid);
  if(rmIds.length)character.attacks=(character.attacks||[]).filter(a=>!rmIds.includes(a.itemId));
  if(character.grantGold&&character.grantGold[sid]){const k=goldKey();character.coins=character.coins||{};character.coins[k]=Math.max(0,num(character.coins[k])-num(character.grantGold[sid]));delete character.grantGold[sid];}
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
/* present a set of pending {ch,sid,label} skill-choices (from race traits or feats) and grant to each sid */
function runExtraChoices(pending){
  const skills=(pending||[]).filter(x=>x&&x.kind!=="equip"&&x.ch&&x.ch.type==="skill"&&(x.ch.from||[]).length);
  const equips=(pending||[]).filter(x=>x&&x.kind==="equip"&&(x.options||[]).length);
  if(!skills.length&&!equips.length)return;
  let body="",ci=0;
  skills.forEach(x=>{body+=`<p class="hint" style="color:var(--accent-2);font-size:13px;margin:6px 0 0">✦ ${esc(x.label||"Choose")}</p>`+choiceFieldHTML(x.ch,ci++,null);});
  equips.forEach((x,ei)=>{
    body+=`<div class="choice" data-ctype="equip" data-eqi="${ei}" style="border-top:1px dotted var(--hair);padding-top:10px;margin-top:10px"><label class="f">${esc(x.label||"Starting equipment")}</label>`+
      x.options.map((o,oi)=>`<label class="opt" style="align-items:flex-start"><input type="radio" name="eq-${ei}" data-eq-opt="${oi}" ${oi===0?"checked":""}><span>${esc(equipOptLabel(o))}</span></label>`).join("")+`</div>`;
  });
  body+=`<div class="m-actions"><button class="tbtn primary" id="xchDone">Done</button></div>`;
  openModal("Choose",body);
  const b=document.getElementById("xchDone");
  if(b)b.addEventListener("click",()=>{
    gatherChoices().forEach(s=>{if(s.type==="skill")s.keys.forEach(k=>grantProf(s.sid,"skill",k,1));});
    document.querySelectorAll('[data-ctype="equip"]').forEach(div=>{
      const ei=num(div.dataset.eqi),sel=div.querySelector('[data-eq-opt]:checked'),x=equips[ei];
      if(x&&sel)applyEquipOption(x.options[num(sel.dataset.eqOpt)],x.sid);
    });
    closeModal();renderInventory();renderAttacks();renderFeatures();renderAllRT();recompute();scheduleSave();
  });
}

function renderClassRace(){
  const rb=document.getElementById("raceBgBox"), cb=document.getElementById("classBox");
  if(rb){
    const parts=[];
    if(character.race&&character.race.name){
      const rn=character.race.name+(character.race.subrace?` · ${character.race.subrace}`:"");
      parts.push(`<div class="cr-chip" data-info-race="${esc(character.race.name)}"><span class="cr-k">${raceTerm()}</span><span class="cr-n">${esc(rn)}</span><button class="icon danger" data-del-race="1" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button></div>`);
    }else{
      parts.push(`<button class="mini" data-add-race style="margin-bottom:8px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add ${raceTerm().toLowerCase()}</button>`);
    }
    if(character.bg&&character.bg.name){
      parts.push(`<div class="cr-chip" data-info-bg="${esc(character.bg.name)}"><span class="cr-k">Background</span><span class="cr-n">${esc(character.bg.name)}</span><button class="icon danger" data-del-bg="1" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button></div>`);
    }else{
      parts.push(`<button class="mini" data-add-bg><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add background</button>`);
    }
    rb.innerHTML=parts.join("");
  }
  if(cb){
    const parts=[];
    (character.classes||[]).forEach((c,idx)=>{
      parts.push(`<div class="cr-chip" data-info-class="${esc(c.name)}"><span class="cr-k">Class</span><span class="cr-n">${esc(c.name)} ${num(c.level)}${c.subclass?` · ${esc(c.subclass)}`:""}</span><button class="icon danger" data-del-class="${idx}" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button></div>`);
    });
    parts.push(`<button class="mini" data-add-class><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add class</button>`);
    if(!(rules.races||[]).length&&!(rules.classes||[]).length)parts.push(`<p class="hint" style="margin-top:8px">Load a rules pack with <b>races</b> and <b>classes</b> (Settings → Rules) to auto-apply traits and stats. Custom names work too, without auto data.</p>`);
    cb.innerHTML=parts.join("");
  }
}

