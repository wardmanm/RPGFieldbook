/* ---- level-up choices ---- */
function choiceFieldHTML(ch,ci,d){
  const t=ch.type;let inner="";
  if(t==="skill"){
    const from=ch.from||SKILLS.map(s=>s[1]);
    inner=`<label class="f">Choose ${ch.choose||1} skill(s)</label>`+from.map(nm=>{const key=(SKILLS.find(s=>s[1].toLowerCase()===String(nm).toLowerCase())||[])[0];const have=key&&effSkill(key)>0;return `<label class="opt"><input type="checkbox" data-skill-opt="${esc(key||"")}" ${have?"checked disabled":""}>${esc(nm)}${have?" (already proficient)":""}</label>`;}).join("");
  }else if(t==="subclass"){
    const from=ch.from||(d?Object.keys(subclassesFor(d)):[]);
    inner=`<label class="f">${esc(ch.label||"Choose a subclass")}</label>`+from.map(n=>`<label class="opt"><input type="radio" name="sub-${ci}" data-sub-opt value="${esc(n)}">${esc(n)}</label>`).join("");
  }else if(t==="asi"){
    inner=`<label class="f">Ability Score Improvement</label>
      <div style="display:flex;gap:14px;margin-bottom:6px"><label class="opt" style="margin:0"><input type="radio" name="asimode-${ci}" data-asi-mode value="2" checked>+2 to one</label><label class="opt" style="margin:0"><input type="radio" name="asimode-${ci}" data-asi-mode value="1">+1 to two</label></div>
      <div class="g2"><select data-asi-a>${ABIL.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select><select data-asi-b>${ABIL.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select></div>`;
  }else if(t==="feat"){
    if(ch.from){
      inner=`<label class="f">${esc(ch.label||"Feat")}</label><select data-feat-opt><option value="">— none —</option>${ch.from.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>`;
    }else{
      inner=`<label class="f">${esc(ch.label||"Feat")}</label><select data-feat-opt><option value="">— none —</option>${(rules.feats||[]).map(f=>`<option value="${esc(f._id||f.name)}">${esc(dispName(f,"feats"))}</option>`).join("")}</select>`;
    }
  }else if(t==="option"){
    const from=Array.isArray(ch.from)?ch.from:[];const choose=ch.choose||1;const single=choose===1;
    inner=`<label class="f">${esc(ch.label||("Choose "+choose))}</label>`+from.map((o,i)=>{
      const fx=(o.effects||[]).map(e=>`${FX_LABEL[e.target]||e.target} ${fmt(num(e.value))}`).join(", ");
      return `<label class="opt" style="align-items:flex-start"><input type="${single?"radio":"checkbox"}" ${single?`name="opt-${ci}"`:""} data-opt-i="${i}"><span><b>${esc(o.name||("Option "+(i+1)))}</b>${o.description?` — ${esc(o.description)}`:""}${fx?` <span style="color:var(--accent-2)">(${esc(fx)})</span>`:""}</span></label>`;
    }).join("");
  }else{
    inner=`<p class="hint">${esc(ch.label||ch.note||"A choice is available at your table.")}</p>`;
  }
  return `<div class="choice" data-ci="${ci}" data-ctype="${esc(t||"note")}" data-sid="${esc(ch._sid||"")}" style="border-top:1px dotted var(--hair);padding-top:10px;margin-top:10px">${inner}</div>`;
}
let _activeChoices=[];
let _equipQueue=[];
function sidToOrigin(sid,level){
  const p=String(sid||"").split(":");
  if(p[0]==="class")return {kind:"class",class:p[1],level};
  if(p[0]==="subclass")return {kind:"class",class:p[1],subclass:p[2],level};
  if(p[0]==="race")return {kind:"race",name:p[1]};
  return {kind:"class",class:"",level};
}
function runChoices(className,choices,notes){
  if((!choices||!choices.length)&&(!notes||!notes.length))return;
  _activeChoices=choices||[];
  const d=findClassDef(className);
  let body="";
  (notes||[]).forEach(n=>body+=`<p class="hint" style="color:var(--accent-2);font-size:14px">✦ ${esc(n)}</p>`);
  (choices||[]).forEach((ch,ci)=>body+=choiceFieldHTML(ch,ci,d));
  body+=`<div class="m-actions"><button class="tbtn primary" id="chDone">Done</button></div>`;
  const lvl=(choices&&choices[0]&&choices[0]._level)||(character.classes.find(c=>c.name===className)||{}).level||"";
  openModal(`${esc(className)} — Level ${lvl}`,body);
  document.getElementById("chDone").addEventListener("click",()=>{const sel=gatherChoices();closeModal();commitChoices(className,sel);});
}
function gatherChoices(){
  const out=[];
  document.querySelectorAll(".choice").forEach(div=>{
    const t=div.dataset.ctype;
    if(t==="skill")out.push({type:"skill",sid:div.dataset.sid||"",keys:Array.from(div.querySelectorAll('[data-skill-opt]:checked:not(:disabled)')).map(cb=>cb.dataset.skillOpt).filter(Boolean)});
    else if(t==="subclass"){const r=div.querySelector('[data-sub-opt]:checked');out.push({type:"subclass",name:r?r.value:null});}
    else if(t==="asi"){const mode=(div.querySelector('[data-asi-mode]:checked')||{}).value||"2";out.push({type:"asi",mode,a:div.querySelector('[data-asi-a]').value,b:div.querySelector('[data-asi-b]').value});}
    else if(t==="feat"){const sel=div.querySelector('[data-feat-opt]');out.push({type:"feat",name:sel?sel.value:""});}
    else if(t==="option")out.push({type:"option",ci:num(div.dataset.ci),sid:div.dataset.sid||"",idxs:Array.from(div.querySelectorAll('[data-opt-i]:checked')).map(cb=>num(cb.dataset.optI))});
  });
  return out;
}
function commitChoices(className,selections){
  const entry=character.classes.find(c=>c.name===className);
  let pendingSub=null;const _featPending=[];
  selections.forEach(sel=>{
    if(sel.type==="skill")sel.keys.forEach(k=>grantProf(sel.sid||("class:"+className),"skill",k,1));
    else if(sel.type==="subclass"){if(sel.name)pendingSub=sel.name;}
    else if(sel.type==="asi"){const fx=sel.mode==="2"?[{target:"ability."+sel.a,value:2}]:[{target:"ability."+sel.a,value:1},{target:"ability."+sel.b,value:1}];addFeatureFromDef({name:"Ability Score Improvement",description:"Gained from leveling "+className+".",effects:fx},{kind:"class",class:className,level:entry?entry.level:null});}
    else if(sel.type==="feat"){if(sel.name)grantFeatDef(sel.name,{kind:"class",class:className,level:entry?entry.level:null},_featPending);}
    else if(sel.type==="option"){const ch=_activeChoices[sel.ci];if(ch&&Array.isArray(ch.from))sel.idxs.forEach(i=>{const o=ch.from[i];if(o)addFeatureFromDef({name:o.name,description:o.description||"",effects:o.effects||[],skills:o.skills,saves:o.saves},sidToOrigin(sel.sid,ch._level));});}
  });
  renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
  if(pendingSub)selectSubclass(className,pendingSub);
  const _eq=_equipQueue;_equipQueue=[];
  runExtraChoices(_featPending.concat(_eq));
}

