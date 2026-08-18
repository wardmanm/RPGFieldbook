/* ---- ancestry / race ---- */
function raceTerm(){return (settings.skin==="classic")?"Race":"Ancestry";}
/* Which system a rules entry belongs to, or "" when we can't tell.
   Species are the one category the two systems don't share — a Humblewood
   character is never an elf — unlike classes/spells, where Humblewood content
   supplements the D&D core rather than replacing it. */
function systemOf(entry){
  const s=String((entry&&entry._source)||"").trim().toLowerCase();
  if(!s)return "";
  if(s==="humblewood")return "humblewood";
  if(s==="xphb"||s==="phb"||s==="dnd"||s.indexOf("d&d")>=0)return "dnd";
  return "";
}
/* Species offered to THIS character. Filters the picker only — never
   findRaceDef(). A character who already has a cross-system ancestry (an
   imported sheet, a switched system) must keep resolving it, or their traits
   silently vanish. Unknown sources (homebrew) show for both systems: never hide
   someone's own content.

   A pack may also name systems it is NOT for (`excludeSystems`). That is how a
   D&D supplement whose source string systemOf() can't place — Xanathar's,
   Tasha's — keeps Tasha's Custom Lineage out of a Humblewood character's
   ancestry list while its spells, feats and subclasses stay available to
   everyone. An explicit exclusion beats the name-based guess. */
function racesForCharacter(){
  const sys=(character&&character.system==="dnd")?"dnd":"humblewood";
  return (rules.races||[]).filter(r=>{
    const ex=r&&r._excludeSystems;
    if(Array.isArray(ex)&&ex.indexOf(sys)>=0)return false;
    const s=systemOf(r);return !s||s===sys;});
}
function raceOptions(){
  const list=racesForCharacter();
  const cats={};const flat=[];
  list.forEach(r=>{ if(r.category){(cats[r.category]=cats[r.category]||[]).push(r);} else flat.push(r); });
  const opt=r=>`<option value="${esc(r._id||r.name)}">${esc(dispName(r,"races"))}</option>`;
  let html="";
  Object.keys(cats).sort().forEach(cat=>{
    html+=`<optgroup label="${esc(cat)}">`+cats[cat].map(opt).join("")+`</optgroup>`;
  });
  html+=flat.map(opt).join("");
  return html;
}
function raceSummary(d){const bits=[];if(d.abilityScores)bits.push(Object.entries(d.abilityScores).map(([k,v])=>`${k.toUpperCase()} ${fmt(num(v))}`).join(", "));if(d.size)bits.push(sizeLabel(d.size));if(d.speed)bits.push("Speed "+d.speed);if((d.traits||[]).length)bits.push(d.traits.length+" trait(s)");if((d.subraces||[]).length)bits.push(d.subraces.length+" subraces");return bits.length?`<p class="hint"><b>${esc(bits.join(" · "))}</b></p>`:"";}
function openAddRace(){
  const term=raceTerm(), list=racesForCharacter();
  openModal("Add "+term.toLowerCase(),`
    ${list.length?`<div class="field"><label class="f">${esc(term)} from rules</label><select id="raceSel"><option value="">— choose —</option>${raceOptions()}</select></div>`:`<p class="hint">No ${term.toLowerCase()} entries in the loaded rules. Enter a custom name; no traits will be auto-applied.</p>`}
    <div class="field" id="subWrap" style="display:none"><label class="f">Subrace</label><select id="subSel"></select></div>
    <div class="field"><label class="f">Or custom name</label><input id="raceCustom" placeholder="e.g. ${(settings.skin==="classic")?"Elf":"Strig"}"></div>
    <div id="racePrev"></div>
    <div id="raceAbil"></div>
    <div class="m-actions"><button class="tbtn" id="rCancel">Cancel</button><button class="tbtn primary" id="rAdd">Add</button></div>`);
  const sel=document.getElementById("raceSel"),prev=document.getElementById("racePrev"),subWrap=document.getElementById("subWrap"),subSel=document.getElementById("subSel"),abilBox=document.getElementById("raceAbil");
  function raceAbilCfg(){const d=sel&&sel.value?findRaceDef(sel.value):null;if(!d)return null;const sub=(d.subraces||[]).find(s=>s.name===(subSel&&subSel.value));return (sub&&sub.abilityChoice)||d.abilityChoice||null;}
  function abilOpts(cfg){const elig=(cfg&&cfg.eligible&&cfg.eligible.length)?cfg.eligible:ABIL.map(([k])=>k);return elig.map(k=>`<option value="${k}">${k.toUpperCase()}</option>`).join("");}
  function drawRaceAbil(){
    if(!abilBox)return;const cfg=raceAbilCfg();
    if(!cfg){abilBox.innerHTML="";return;}
    const modes=(cfg.modes&&cfg.modes.length)?cfg.modes:["2-1"], opts=abilOpts(cfg), first=modes[0];
    abilBox.innerHTML=`<div class="field"><label class="f">Ability Score Increase${cfg.hint?` — ${esc(cfg.hint)}`:""}</label>
      <div class="seg" id="raMode">${modes.includes("2-1")?`<button type="button" data-m="2-1"${first==="2-1"?" class=\"on\"":""}>+2 / +1</button>`:""}${modes.includes("1-1-1")?`<button type="button" data-m="1-1-1"${first==="1-1-1"?" class=\"on\"":""}>+1 / +1 / +1</button>`:""}<button type="button" data-m="none">None</button></div></div>
      <div class="g2" id="ra21" style="${first==="2-1"?"":"display:none"}"><div class="field"><label class="f">+2 to</label><select id="raA2">${opts}</select></div><div class="field"><label class="f">+1 to</label><select id="raA1">${opts}</select></div></div>
      <div id="ra111" style="${first==="1-1-1"?"":"display:none"}"><div class="g2"><div class="field"><label class="f">+1 to</label><select id="raB1">${opts}</select></div><div class="field"><label class="f">+1 to</label><select id="raB2">${opts}</select></div></div><div class="field"><label class="f">+1 to</label><select id="raB3">${opts}</select></div></div>
      <p class="hint" id="raNone" style="${first==="none"?"":"display:none"}">In the 2024 ruleset, ability score increases come from your <b>background</b>, not your species. Choose <b>None</b> to follow that convention and avoid stacking two increases.</p>`;
    const seg=document.getElementById("raMode");
    seg.addEventListener("click",e=>{const b=e.target.closest("[data-m]");if(!b)return;seg.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));const m=b.dataset.m,g21=document.getElementById("ra21"),g111=document.getElementById("ra111"),non=document.getElementById("raNone");if(g21)g21.style.display=m==="2-1"?"":"none";if(g111)g111.style.display=m==="1-1-1"?"":"none";if(non)non.style.display=m==="none"?"":"none";});
  }
  if(sel)sel.addEventListener("change",()=>{
    const d=sel.value?findRaceDef(sel.value):null;
    prev.innerHTML=d?`<p class="hint">${esc(d.description||"")}</p>${raceSummary(d)}`:"";
    const subs=(d&&d.subraces)||[];
    if(subs.length){subWrap.style.display="";subSel.innerHTML=`<option value="">— choose subrace —</option>`+subs.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("");}
    else{subWrap.style.display="none";subSel.innerHTML="";}
    drawRaceAbil();
  });
  if(subSel)subSel.addEventListener("change",drawRaceAbil);
  document.getElementById("rCancel").addEventListener("click",closeModal);
  document.getElementById("rAdd").addEventListener("click",()=>{
    const raw=(sel&&sel.value)||document.getElementById("raceCustom").value.trim();
    if(!raw){alert("Pick or name a "+term.toLowerCase()+".");return;}
    const d=findRaceDef(raw);
    if(d&&(d.subraces||[]).length&&!subSel.value){alert("This "+term.toLowerCase()+" has subraces — pick one.");return;}
    let opts={};const cfg=raceAbilCfg();
    if(cfg){
      const on=document.querySelector("#raMode .on"), mode=on?on.dataset.m:(cfg.modes&&cfg.modes[0])||"2-1";
      if(mode==="2-1"){const a2=document.getElementById("raA2").value,a1=document.getElementById("raA1").value;if(a2===a1){alert("Choose two different abilities for +2 and +1.");return;}opts.abilFx=[{target:"ability."+a2,value:2},{target:"ability."+a1,value:1}];}
      else if(mode==="1-1-1"){const b=[document.getElementById("raB1").value,document.getElementById("raB2").value,document.getElementById("raB3").value];if(new Set(b).size!==3){alert("Choose three different abilities for +1 each.");return;}opts.abilFx=b.map(k=>({target:"ability."+k,value:1}));}
      else opts.abilFx=[];
    }
    const _rp=applyRace(raw, subSel?subSel.value:null, opts);closeModal();runExtraChoices(_rp);
  });
}
function applyRace(sel, subrace, opts){
  if(character.race)removeRace(false);
  const d=findRaceDef(sel);
  const name=d?d.name:sel;
  character.race={name, subrace:subrace||null};character.ancestry=name;
  const pending=[];
  const grantFrom=(obj,label)=>{
    if(!obj)return;
    if(obj.abilityScores){const fx=Object.entries(obj.abilityScores).map(([k,v])=>({target:"ability."+k,value:num(v)}));addFeatureFromDef({name:label+" — Ability Bonus",description:"Ability score increase.",effects:fx},{kind:"race",name});}
    (obj.skills||[]).forEach(nm=>{const k=skillKey(nm);if(k)grantProf("race:"+name,"skill",k,1);});
    (obj.saves||[]).forEach(ab=>{if(character.saves[String(ab).toLowerCase()]!==undefined)grantProf("race:"+name,"save",String(ab).toLowerCase(),1);});
    (obj.traits||[]).forEach(t=>{addFeatureFromDef(t,{kind:"race",name});(t.choices||[]).forEach(ch=>{if(ch&&ch.type==="skill")pending.push({ch:Object.assign({},ch,{_sid:"race:"+name}),sid:"race:"+name,label:(t.name||label)});});});
    (obj.choices||[]).forEach(ch=>{if(ch&&ch.type==="skill")pending.push({ch:Object.assign({},ch,{_sid:"race:"+name}),sid:"race:"+name,label:label});});
    applyEquipGrants(obj.equipmentGrants,"race:"+name,pending);
    if(obj.speed&&(character.speed===""||character.speed==null))character.speed=obj.speed;
    /* Seeded like speed — only when empty, so a subrace never overrides the base
       species and a player's own choice always wins. Leaving it "" is also fine:
       charSize() falls back to the ancestry's own size at read time. */
    if(obj.size&&(character.size===""||character.size==null))character.size=sizeName(obj.size);
    if(obj.proficiencies||obj.languages){const add=[obj.proficiencies,obj.languages?("Languages: "+obj.languages):""].filter(Boolean).join("\n");character.proficiencies=(character.proficiencies?character.proficiencies+"\n":"")+add;}
  };
  if(d){
    grantFrom(d,name);
    const sd=(d.subraces||[]).find(s=>s.name===subrace);
    if(sd)grantFrom(sd, name+" ("+subrace+")");
  }
  if(opts&&opts.abilFx&&opts.abilFx.length){addFeatureFromDef({name:name+" — Ability Bonus",description:"Ability score increase (your choice).",effects:opts.abilFx},{kind:"race",name});}
  const si=document.querySelector('[data-path="character.speed"]');if(si)si.value=character.speed;
  renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
  return pending;
}
function removeRace(doRender){
  const name=character.race&&character.race.name;
  removeFeaturesWhere(f=>f.origin&&f.origin.kind==="race"&&f.origin.name===name);
  removeGrants(g=>g.sid==="race:"+name);
  revertEquipmentGrants("race:"+name);
  character.race=null;
  if(doRender!==false){renderClassRace();renderFeatures();recompute();scheduleSave();}
}
function openRaceInfo(name){
  const d=findRaceDef(name);
  if(!d){openModal(name,`<p class="hint">No rules data loaded for this ${raceTerm().toLowerCase()} — it was added as a custom name.</p>`);return;}
  const cur=character.race&&character.race.subrace;
  const sect=(obj)=>{
    let s="";
    if(obj.abilityScores)s+=`<p><b>Ability increase:</b> ${Object.entries(obj.abilityScores).map(([k,v])=>`${k.toUpperCase()} ${fmt(num(v))}`).join(", ")}</p>`;
    if(obj.size)s+=`<p><b>Size:</b> ${esc(sizeLabel(obj.size))}</p>`;
    if(obj.speed)s+=`<p><b>Speed:</b> ${esc(obj.speed)}</p>`;
    if(obj.proficiencies)s+=`<p><b>Proficiencies:</b> ${esc(obj.proficiencies)}</p>`;
    if(obj.languages)s+=`<p><b>Languages:</b> ${esc(obj.languages)}</p>`;
    (obj.traits||[]).forEach(t=>s+=`<p style="border-top:1px dotted var(--hair);padding-top:8px"><b>${esc(t.name)}.</b> ${richInline(t.description||"")}</p>`);
    return s;
  };
  let b=`<p>${esc(d.description||"")}</p>`+(d.category?`<p class="hint">${esc(d.category)}</p>`:"")+sect(d);
  /* species-owned tables link from here; owner-based, so no prose anchor needed */
  b+=tableChipsHTML(name,"race");
  (d.subraces||[]).forEach(sd=>{
    b+=`<div style="border-top:2px solid var(--line);margin-top:10px;padding-top:8px"><b style="${cur===sd.name?"color:var(--accent)":""}">${esc(sd.name)}${cur===sd.name?" — selected":""}</b>${sd.description?`<p class="hint" style="margin:4px 0">${esc(sd.description)}</p>`:""}${sect(sd)}</div>`;
  });
  openModal(name,b);
}

