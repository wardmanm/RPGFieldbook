/* ---- background ---- */
function findBackgroundDef(n){return ruleById("backgrounds",n);}
function bgFeatList(d){return Array.isArray(d.feat)?d.feat:(d.feat?[d.feat]:[]);}
function openAddBackground(){
  const list=rules.backgrounds||[];
  openModal("Add background",`
    ${list.length?`<div class="field"><label class="f">Background from rules</label><select id="bgSel"><option value="">— choose —</option>${list.map(b=>`<option value="${esc(b._id||b.name)}">${esc(dispName(b,"backgrounds"))}</option>`).join("")}</select></div>`:`<p class="hint">No backgrounds in the loaded rules. Enter a custom name; nothing will be auto-applied.</p>`}
    <div class="field"><label class="f">Or custom name</label><input id="bgCustom" placeholder="e.g. Sage"></div>
    <div id="bgPrev"></div>
    <div class="m-actions"><button class="tbtn" id="bgCancel">Cancel</button><button class="tbtn primary" id="bgAdd">Add</button></div>`);
  const sel=document.getElementById("bgSel"),prev=document.getElementById("bgPrev");
  function drawPrev(){
    const d=sel&&sel.value?findBackgroundDef(sel.value):null;
    if(!d){prev.innerHTML="";return;}
    const abils=(d.abilityScores||[]).map(a=>a.toUpperCase());
    const feats=bgFeatList(d);
    prev.innerHTML=`<p class="hint">${esc(d.description||"")}</p>
      <div class="field"><label class="f">Ability scores (${esc(abils.join(", "))})</label>
        <div class="seg" id="bgMode"><button type="button" data-m="2-1" class="on">+2 / +1</button><button type="button" data-m="1-1-1">+1 / +1 / +1</button></div></div>
      <div class="g2" id="bg21">
        <div class="field"><label class="f">+2 to</label><select id="bgA2">${(d.abilityScores||[]).map(a=>`<option value="${a}">${a.toUpperCase()}</option>`).join("")}</select></div>
        <div class="field"><label class="f">+1 to</label><select id="bgA1">${(d.abilityScores||[]).map(a=>`<option value="${a}">${a.toUpperCase()}</option>`).join("")}</select></div>
      </div>
      ${feats.length>1?`<div class="field"><label class="f">Feat</label><select id="bgFeat">${feats.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("")}</select></div>`:(feats.length?`<p class="hint">Feat: <b>${esc(feats[0])}</b></p>`:"")}
      <p class="hint">Also grants: ${esc((d.skills||[]).join(", "))}${d.tools?" · "+esc(d.tools):""}${d.languages?" · "+esc(d.languages):""}</p>`;
    const modeSeg=document.getElementById("bgMode"),bg21=document.getElementById("bg21");
    modeSeg.addEventListener("click",e=>{const b=e.target.closest("[data-m]");if(!b)return;modeSeg.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));bg21.style.display=b.dataset.m==="2-1"?"":"none";});
  }
  if(sel)sel.addEventListener("change",drawPrev);
  document.getElementById("bgCancel").addEventListener("click",closeModal);
  document.getElementById("bgAdd").addEventListener("click",()=>{
    const raw=(sel&&sel.value)||document.getElementById("bgCustom").value.trim();
    if(!raw){alert("Pick or name a background.");return;}
    const d=findBackgroundDef(raw);
    let opts={};
    if(d){
      const mode=(document.querySelector("#bgMode .on")||{}).dataset?document.querySelector("#bgMode .on").dataset.m:"2-1";
      const a2=document.getElementById("bgA2"),a1=document.getElementById("bgA1"),ft=document.getElementById("bgFeat");
      if(mode==="2-1"&&a2&&a1&&a2.value===a1.value){alert("Choose two different abilities for +2 and +1.");return;}
      opts={mode, a2:a2?a2.value:null, a1:a1?a1.value:null, feat:ft?ft.value:(bgFeatList(d)[0]||null)};
    }
    const _bp=applyBackground(raw,opts);closeModal();runExtraChoices(_bp);
  });
}
function applyBackground(sel,opts){
  if(character.bg)removeBackground(false);
  const d=findBackgroundDef(sel);
  const name=d?d.name:sel;
  character.bg={name, feat:(opts&&opts.feat)||null, abils:null};
  character.background=name;
  const _bgPending=[];
  const ai=document.querySelector('[data-path="character.background"]');if(ai)ai.value=name;
  if(d){
    // ability scores
    let fx=[];
    if(opts&&opts.mode==="1-1-1"){fx=(d.abilityScores||[]).map(a=>({target:"ability."+a,value:1}));}
    else if(opts&&opts.a2){fx=[{target:"ability."+opts.a2,value:2},{target:"ability."+opts.a1,value:1}];}
    if(fx.length){character.bg.abils=fx;addFeatureFromDef({name:name+" — Ability Scores",description:"Background ability score increase.",effects:fx},{kind:"background",name});}
    // skills
    (d.skills||[]).forEach(nm=>{const k=skillKey(nm);if(k)grantProf("bg:"+name,"skill",k,1);});
    // feat
    const featName=(opts&&opts.feat)||bgFeatList(d)[0];
    if(featName)grantFeatDef(featName,{kind:"background",name},_bgPending);
    // background feature
    if(d.feature&&d.feature.name)addFeatureFromDef({name:d.feature.name,description:d.feature.description||""},{kind:"background",name});
    applyEquipGrants(d.equipmentGrants,"bg:"+name,_bgPending);
    // tools / languages / equipment → proficiencies notes
    const notes=[];
    if(d.tools)notes.push("Tools: "+d.tools);
    if(d.languages)notes.push("Languages: "+d.languages);
    if(notes.length)character.proficiencies=(character.proficiencies?character.proficiencies+"\n":"")+notes.join("\n");
  }
  renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
  return _bgPending;
}
function removeBackground(doRender){
  const name=character.bg&&character.bg.name;
  removeFeaturesWhere(f=>f.origin&&f.origin.kind==="background"&&f.origin.name===name);
  removeGrants(g=>g.sid==="bg:"+name);
  revertEquipmentGrants("bg:"+name);
  character.bg=null;
  if(doRender!==false){renderClassRace();renderFeatures();recompute();scheduleSave();}
}
function openBackgroundInfo(name){
  const d=findBackgroundDef(name);
  if(!d){openModal(name,`<p class="hint">No rules data loaded for this background — it was added as a custom name.</p>`);return;}
  let b=`<p>${esc(d.description||"")}</p>`;
  b+=`<p><b>Ability Scores:</b> ${(d.abilityScores||[]).map(a=>a.toUpperCase()).join(", ")}</p>`;
  b+=`<p><b>Feat:</b> ${esc(bgFeatList(d).join(" or "))}</p>`;
  if(d.skills)b+=`<p><b>Skill Proficiencies:</b> ${esc(d.skills.join(", "))}</p>`;
  if(d.tools)b+=`<p><b>Tool Proficiencies:</b> ${esc(d.tools)}</p>`;
  if(d.languages)b+=`<p><b>Languages:</b> ${esc(d.languages)}</p>`;
  if(d.equipment)b+=`<p><b>Equipment:</b> ${esc(d.equipment)}</p>`;
  if(d.feature&&d.feature.name)b+=`<p style="border-top:1px dotted var(--hair);padding-top:8px"><b>${esc(d.feature.name)}.</b> ${highlight(d.feature.description||"")}</p>`;
  /* Suggested-characteristic and specialty tables are owned by the background,
     so they link from here rather than needing an anchor in the prose. */
  b+=tableChipsHTML(d.name,"background");
  const cur=character.bg;
  if(cur&&cur.name===d.name){const bits=[];if(cur.feat)bits.push("Feat: "+cur.feat);if(cur.abils)bits.push(cur.abils.map(e=>e.target.split(".")[1].toUpperCase()+" "+fmt(e.value)).join(", "));if(bits.length)b+=`<p class="hint" style="border-top:2px solid var(--line);margin-top:8px;padding-top:8px">Your choices — ${esc(bits.join(" · "))}</p>`;}
  openModal(d.name,b);
}
