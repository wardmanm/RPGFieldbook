function classSummary(d){const bits=[];if(d.hitDie)bits.push("Hit die "+d.hitDie);if(d.spellcasting)bits.push("Spellcasting "+d.spellcasting.toUpperCase());if(d.savingThrows)bits.push("Saves "+d.savingThrows.map(x=>x.toUpperCase()).join("/"));return bits.length?`<p class="hint"><b>${esc(bits.join(" · "))}</b></p>`:"";}
function openAddClass(){
  const list=rules.classes||[];
  openModal("Add class",`
    ${list.length?`<div class="field"><label class="f">Class from rules</label><select id="classSel"><option value="">— choose —</option>${list.map(c=>`<option value="${esc(c._id||c.name)}">${esc(dispName(c,"classes"))}</option>`).join("")}</select></div>`:`<p class="hint">No classes in the loaded rules. Enter a custom name; no traits will be auto-applied.</p>`}
    <div class="field"><label class="f">Or custom name</label><input id="classCustom" placeholder="Ranger"></div>
    <div class="field"><label class="f">Starting level</label><input id="classLvl" type="number" min="1" max="20" value="1"></div>
    <div id="classPrev"></div>
    <div class="m-actions"><button class="tbtn" id="cCancel">Cancel</button><button class="tbtn primary" id="cAdd">Add</button></div>`);
  const sel=document.getElementById("classSel"),prev=document.getElementById("classPrev");
  if(sel)sel.addEventListener("change",()=>{const d=sel.value?findClassDef(sel.value):null;prev.innerHTML=d?`<p class="hint">${esc(d.description||"")}</p>${classSummary(d)}`:"";});
  document.getElementById("cCancel").addEventListener("click",closeModal);
  document.getElementById("cAdd").addEventListener("click",()=>{const raw=(sel&&sel.value)||document.getElementById("classCustom").value.trim();if(!raw){alert("Pick or name a class.");return;}const cd=findClassDef(raw);const name=cd?cd.name:raw;const lvl=Math.max(1,Math.min(20,num(document.getElementById("classLvl").value)||1));closeModal();addClass(name,lvl);});
}
function applyClassLevel(entry,d,L){
  let choices=[],notes=[];
  if(d&&d.levels){
    const lv=d.levels[String(L)]||{};
    (lv.traits||[]).forEach(t=>addFeatureFromDef(t,{kind:"class",class:entry.name,level:L}));
    (Array.isArray(lv.choices)?lv.choices:[]).forEach(ch=>choices.push({...ch,_level:L,_sid:"class:"+entry.name}));
    if(lv.spells){const n=lv.spells.note||(lv.spells.known!=null?`You can now know up to ${lv.spells.known} ${d.name} spell(s). Add them via Spells → Add.`:null);if(n)notes.push(n);}
    const subs=subclassesFor(d);
    if(entry.subclass&&subs[entry.subclass]&&subs[entry.subclass].levels){
      const sl=subs[entry.subclass].levels[String(L)]||{};
      (sl.traits||[]).forEach(t=>addFeatureFromDef(t,{kind:"class",class:entry.name,level:L,subclass:entry.subclass}));
      (Array.isArray(sl.choices)?sl.choices:[]).forEach(ch=>choices.push({...ch,_level:L,_sid:"subclass:"+entry.name+":"+entry.subclass}));
      if(sl.spells){const n=sl.spells.note||(sl.spells.known!=null?`You can know up to ${sl.spells.known} ${entry.subclass} spell(s).`:null);if(n)notes.push(n);}
    }
  }
  return {choices,notes};
}
/* "d8" -> 8. Returns 0 for anything unparseable, so callers can just test it. */
function hitDieMax(d){
  const m=/^\s*d?(\d+)\s*$/i.exec(String((d&&d.hitDie)||""));
  return m?parseInt(m[1],10):0;
}
/* The level-1 maximum, in one place, because three callers have to agree on it
   to the number: seedLevel1HP() writes it, resyncLevel1HP() re-writes it, and
   removeClass() only takes it back out when the box still holds exactly it.
   Floors at 1 — you always gain at least a hit point per level, and a computed
   0 would be indistinguishable from the 0 this returns for an unparseable die,
   which effMaxHP()>0 reads as "no maximum set" in clampHP() and longRest(). */
function level1HP(d){
  const die=hitDieMax(d);
  return die?Math.max(1,die+modOf(character.abilities.con)):0;
}
/* Level 1 with a single class has no roll and no choice: max HP is the hit
   die's maximum plus your Constitution modifier. Filled in on the player's
   behalf, but ONLY over a blank — a number they typed is theirs, and this must
   never overwrite it.
   CON is read from the SCORE, not abilFinal(): contributions() folds in
   equipped items, active statuses and summoned familiars, and this number has
   to be re-derivable unchanged minutes later by removeClass(). An effect that
   should raise max HP has its own target ("hp.max") and layers on top. */
function seedLevel1HP(d){
  const hp=level1HP(d);
  if(!hp||character.classes.length!==1||totalLevel()!==1)return;
  if(num(character.hp.max))return;
  character.hp.max=hp;
  if(!num(character.hp.cur))character.hp.cur=hp;
  renderHP();
}
/* Entering CON after picking the class is the normal order for a lot of
   players, and the seeded number would otherwise be stale forever — worse, it
   would stop matching what removeClass() recomputes, so the clean revert below
   would silently stop firing. Stateless on purpose: the caller hands over the
   PREVIOUS score, so "is this still ours?" is answered by recomputing what we
   would have written then and matching it exactly — the same test removeClass()
   has always used, and the same thing it trades away (a player who typed, by
   coincidence, exactly the seeded number).
   Deliberately stops at level 2: from there hp.max is a rolled total the app
   never computed and must not touch. Safe to call on every keystroke. */
function resyncLevel1HP(prevCon){
  if(character.classes.length!==1||totalLevel()!==1)return;
  const d=findClassDef(character.classes[0].name),die=hitDieMax(d);
  if(!die)return;
  const was=Math.max(1,die+modOf(prevCon)),now=level1HP(d);
  if(was===now||num(character.hp.max)!==was)return;
  const full=num(character.hp.cur)===was;
  character.hp.max=now;
  if(full)character.hp.cur=now;
  clampHP();renderHP();
}
function addClass(name,lvl){
  const d=findClassDef(name);
  const entry={name,level:0,subclass:null};
  character.classes.push(entry);
  if(d){
    if(Array.isArray(d.savingThrows))d.savingThrows.forEach(k=>{if(character.saves[k]!==undefined)grantProf("class:"+name,"save",k,1);});
    (d.skills||[]).forEach(nm=>{const k=skillKey(nm);if(k)grantProf("class:"+name,"skill",k,1);});
    if(d.spellcasting&&!character.spellAbility)character.spellAbility=d.spellcasting;
  }
  let choices=[],notes=[];const _eq=[];
  if(d)applyEquipGrants(d.equipmentGrants,"class:"+name,_eq);
  for(let L=1;L<=lvl;L++){const res=applyClassLevel(entry,d,L);choices=choices.concat(res.choices);notes=notes.concat(res.notes);}
  entry.level=lvl;
  character.level=totalLevel();
  seedLevel1HP(d);
  const li=document.querySelector('[data-path="character.level"]');if(li)li.value=character.level;
  const spi=document.querySelector('[data-path="character.spellAbility"]');if(spi)spi.value=character.spellAbility;
  renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
  if(choices.length||notes.length){_equipQueue=_eq;runChoices(name,choices,notes);}
  else runExtraChoices(_eq);
}
function removeClass(idx){
  const c=character.classes[idx];if(!c)return;
  /* Clean revert, same rule as the other class grants: if the only thing in
     Max HP is the number seedLevel1HP() put there, take it back out so
     swapping a d10 class for a d6 one doesn't silently keep 10. Anything else
     in that box is the player's and is left alone. It has to recompute the
     WHOLE formula, CON modifier included — which is why resyncLevel1HP() keeps
     the box tracking CON, so this match still lands after a stat is edited. */
  const seeded=level1HP(findClassDef(c.name));
  if(seeded&&character.classes.length===1&&num(c.level)===1&&num(character.hp.max)===seeded){
    character.hp.max="";
    if(num(character.hp.cur)===seeded)character.hp.cur="";
    renderHP();
  }
  removeFeaturesWhere(f=>f.origin&&f.origin.kind==="class"&&f.origin.class===c.name);
  removeGrants(g=>g.sid==="class:"+c.name||g.sid.indexOf("subclass:"+c.name+":")===0);
  revertEquipmentGrants("class:"+c.name);
  character.classes.splice(idx,1);
  character.level=totalLevel();const li=document.querySelector('[data-path="character.level"]');if(li)li.value=character.level;
  renderClassRace();renderFeatures();recompute();scheduleSave();
}
function doLevelUp(){
  if(!character.classes.length){alert("Add a class first (Add class), then you can level it up.");return;}
  const proceed=idx=>{
    const entry=character.classes[idx],d=findClassDef(entry.name);
    const newL=num(entry.level)+1;if(newL>20){alert(entry.name+" is already level 20.");return;}
    entry.level=newL;
    const res=applyClassLevel(entry,d,newL);
    /* Levelling is the one moment Max HP legitimately changes and the app
       cannot compute it — from level 2 on it is a roll (or the average) only
       the player knows. Hand the box back rather than making them fight a
       padlock, and leave it open: re-locking mid-edit would be worse.
       renderHP explicitly, because recompute() does not call it. */
    character.hp.locked=false;renderHP();
    character.level=totalLevel();const li=document.querySelector('[data-path="character.level"]');if(li)li.value=character.level;
    renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
    runChoices(entry.name,res.choices,res.notes);
  };
  if(character.classes.length===1){proceed(0);return;}
  openModal("Level up — which class?",character.classes.map((c,i)=>`<button class="tbtn" style="width:100%;margin-bottom:8px" data-lvlclass="${i}">${esc(c.name)} ${num(c.level)} → ${num(c.level)+1}</button>`).join("")+`<div class="m-actions"><button class="tbtn" id="luCancel">Cancel</button></div>`);
  document.getElementById("luCancel").addEventListener("click",closeModal);
  document.querySelectorAll("[data-lvlclass]").forEach(b=>b.addEventListener("click",()=>{const i=num(b.dataset.lvlclass);closeModal();proceed(i);}));
}
function doLevelDown(){
  if(!character.classes.length){alert("No classes to reduce.");return;}
  const proceed=idx=>{
    const entry=character.classes[idx],d=findClassDef(entry.name);
    const newL=num(entry.level)-1;
    if(newL<1){alert(entry.name+" is already at level 1. To remove it entirely, use the ✕ on the class.");return;}
    entry.level=newL;                       // only lower the number; keep all traits, grants, and choices
    character.level=totalLevel();
    renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
  };
  const eligible=character.classes.map((c,i)=>({c,i})).filter(o=>num(o.c.level)>1);
  if(!eligible.length){alert("All classes are at level 1. To remove one, use the ✕ on the class.");return;}
  if(eligible.length===1){proceed(eligible[0].i);return;}
  openModal("Level down — which class?",eligible.map(o=>`<button class="tbtn" style="width:100%;margin-bottom:8px" data-lvldown="${o.i}">${esc(o.c.name)} ${num(o.c.level)} → ${num(o.c.level)-1}</button>`).join("")+`<p class="hint">This only reduces the class's level. Traits, proficiencies, and choices you've already gained are kept.</p><div class="m-actions"><button class="tbtn" id="ldCancel">Cancel</button></div>`);
  document.getElementById("ldCancel").addEventListener("click",closeModal);
  document.querySelectorAll("[data-lvldown]").forEach(b=>b.addEventListener("click",()=>{const i=num(b.dataset.lvldown);closeModal();proceed(i);}));
}
/* ---- subclasses ---- */
function selectSubclass(className,subName){
  const entry=character.classes.find(c=>c.name===className);if(!entry)return;
  const d=findClassDef(className);
  const oldSub=entry.subclass;
  removeFeaturesWhere(f=>f.origin&&f.origin.kind==="class"&&f.origin.class===className&&f.origin.subclass);
  if(oldSub)removeGrants(g=>g.sid==="subclass:"+className+":"+oldSub);
  entry.subclass=subName;
  const sc=subclassesFor(d)[subName];
  let choices=[],notes=[];
  if(sc){
    if(sc.spellcasting&&!character.spellAbility){character.spellAbility=sc.spellcasting;const spi=document.querySelector('[data-path="character.spellAbility"]');if(spi)spi.value=character.spellAbility;}
    if(sc.levels)Object.keys(sc.levels).map(Number).filter(L=>L<=num(entry.level)).sort((a,b)=>a-b).forEach(L=>{
      const lv=sc.levels[String(L)];
      (lv.traits||[]).forEach(t=>addFeatureFromDef(t,{kind:"class",class:className,level:L,subclass:subName}));
      (Array.isArray(lv.choices)?lv.choices:[]).forEach(ch=>choices.push({...ch,_level:L,_sid:"subclass:"+className+":"+subName}));
      if(lv.spells){const n=lv.spells.note||(lv.spells.known!=null?`You can know up to ${lv.spells.known} ${subName} spell(s).`:null);if(n)notes.push(n);}
    });
  }
  renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
  runChoices(className,choices,notes);
}
function chooseSubclass(className){
  const d=findClassDef(className);const subMap=subclassesFor(d);const subs=Object.keys(subMap);
  const entry=character.classes.find(c=>c.name===className);
  if(!subs.length){openModal("Subclass",`<p class="hint">This class has no subclasses in the loaded rules. Add them under "subclasses" in the class JSON, or load a pack that adds them.</p><div class="m-actions"><button class="tbtn" id="scC">Close</button></div>`);const x=document.getElementById("scC");if(x)x.addEventListener("click",closeModal);return;}
  openModal((entry&&entry.subclass?"Change":"Choose")+" subclass — "+className,
    subs.map(n=>{const sc=subMap[n]||{};const src=sc._source&&rules._dups&&rules._dups.classes?"":"";return `<div class="cr-chip" data-pick-sub="${esc(className)}|${esc(n)}" style="align-items:flex-start"><div style="flex:1"><div class="cr-n">${esc(n)}${sc._source?` <span class="hint" style="font-weight:400">(${esc(sc._source)})</span>`:""}${entry&&entry.subclass===n?" — current":""}</div>${sc.description?`<div class="hint" style="margin:4px 0 0">${esc(sc.description)}</div>`:""}</div></div>`;}).join("")
    +`<div class="m-actions"><button class="tbtn" id="scCancel">Cancel</button></div>`);
  document.getElementById("scCancel").addEventListener("click",closeModal);
  document.querySelectorAll("[data-pick-sub]").forEach(el=>el.addEventListener("click",()=>{const p=el.dataset.pickSub.split("|");closeModal();selectSubclass(p[0],p[1]);}));
}
function openSubclassInfo(className,subName){
  const d=findClassDef(className),sc=subclassesFor(d)[subName];
  if(!sc){openModal(subName,`<p class="hint">No data for this subclass.</p>`);return;}
  const entry=character.classes.find(c=>c.name===className);
  let b=`<p class="hint" style="margin-bottom:6px">${esc(className)} subclass</p><p>${esc(sc.description||"")}</p>`;
  if(sc.spellcasting)b+=`<p class="hint"><b>Grants spellcasting (${esc(sc.spellcasting.toUpperCase())})</b></p>`;
  b+=tableChipsHTML(subName,"subclass");
  if(sc.levels)Object.keys(sc.levels).map(Number).sort((a,b)=>a-b).forEach(L=>{
    const lv=sc.levels[String(L)],here=entry&&num(entry.level)>=L;
    b+=`<div style="border-top:1px dotted var(--hair);padding-top:8px;margin-top:8px"><b style="${here?"color:var(--accent)":""}">Level ${L}${here?" — gained":""}</b>`;
    (lv.traits||[]).forEach(t=>b+=`<p style="margin:4px 0"><b>${esc(t.name)}.</b> ${highlight(t.description||"")}</p>`);
    (lv.choices||[]).forEach(ch=>b+=`<p class="hint" style="margin:3px 0">▸ Choose: ${esc(ch.label||ch.type)}</p>`);
    b+=`</div>`;
  });
  openModal(subName,b);
}
function openClassInfo(name){
  const d=findClassDef(name),entry=(character.classes||[]).find(c=>c.name.toLowerCase()===name.toLowerCase());
  if(!d){openModal(name,`<p class="hint">No rules data loaded for this class — it was added as a custom name.</p>`);return;}
  let b=`<p>${esc(d.description||"")}</p>`;
  const meta=[d.hitDie?("Hit die "+d.hitDie):"",d.spellcasting?("Spellcasting "+d.spellcasting.toUpperCase()):"",d.savingThrows?("Saves "+d.savingThrows.map(x=>x.toUpperCase()).join("/")):""].filter(Boolean).join(" · ");
  if(meta)b+=`<p class="hint"><b>${esc(meta)}</b></p>`;
  b+=tableChipsHTML(name,"class");
  const subMap=subclassesFor(d);
  if(Object.keys(subMap).length){
    b+=`<div style="border-top:1px dotted var(--hair);padding-top:8px;margin-top:8px">`;
    if(entry&&entry.subclass)b+=`<p><b>Subclass:</b> <span class="link" data-sub-info="${esc(name)}|${esc(entry.subclass)}">${esc(entry.subclass)}</span> &nbsp;<button class="tbtn" data-change-sub="${esc(name)}" style="padding:4px 9px;min-height:auto">Change</button></p>`;
    else if(entry)b+=`<p><b>Subclass:</b> not chosen yet &nbsp;<button class="tbtn primary" data-choose-sub="${esc(name)}" style="padding:4px 9px;min-height:auto">Choose</button></p>`;
    else b+=`<p class="hint"><b>Subclasses:</b> ${Object.keys(subMap).map(n=>`<span class="link" data-sub-info="${esc(name)}|${esc(n)}">${esc(n)}</span>`).join(", ")}</p>`;
    b+=`</div>`;
  }
  if(d.levels)Object.keys(d.levels).map(Number).sort((x,y)=>x-y).forEach(L=>{
    const lv=d.levels[String(L)],here=entry&&num(entry.level)===L;
    b+=`<div style="border-top:1px dotted var(--hair);padding-top:8px;margin-top:8px"><b style="${here?"color:var(--accent)":""}">Level ${L}${here?" — current":""}</b>`;
    (lv.traits||[]).forEach(t=>b+=`<p style="margin:4px 0"><b>${esc(t.name)}.</b> ${highlight(t.description||"")}</p>`);
    (lv.choices||[]).forEach(ch=>b+=`<p class="hint" style="margin:3px 0">▸ Choose: ${esc(ch.label||ch.type)}</p>`);
    if(lv.spells)b+=`<p class="hint" style="margin:3px 0;color:var(--accent-2)">✦ Spells: ${esc(lv.spells.note||("up to "+lv.spells.known+" known"))}</p>`;
    b+=`</div>`;
  });
  openModal(name+(entry?` ${num(entry.level)}`:""),b);
}

