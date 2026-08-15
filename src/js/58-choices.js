/* ---- level-up choices ----
   `choose` used to reach the label prose and nowhere else, so by the time
   gatherChoices() read the boxes back there was nothing left to check against —
   which is why a Rogue offering "choose 4 of 10" would happily grant all ten.
   It is now emitted as data-choose on the .choice wrapper, and the two helpers
   below are deliberately DOM-free: the test harness stubs querySelectorAll to
   [], so anything that reads the document cannot be tested at all. */

/* How many NEW picks this block should ask for.
   Options already granted elsewhere are not part of the budget — "choose 2"
   with one already granted still means two new picks, not one. But it must not
   ask for more than are left to pick: choose 2 of 3 with two granted leaves a
   single option, and nagging forever for a second the player cannot make is
   worse than asking for what is possible. */
function effectiveChoose(choose,total,granted){
  return Math.max(0,Math.min(num(choose)||1,num(total)-num(granted)));
}
/* The sentence to put in front of someone leaving picks unmade, or "" when
   there is nothing outstanding. Takes {label,picked,target} per block so it can
   serve both modals and be tested without a DOM. */
function choiceShortfall(blocks){
  const short=(blocks||[]).filter(b=>b&&num(b.picked)<num(b.target));
  if(!short.length)return "";
  const lines=short.map(b=>`  • ${b.label||"Choose"}: ${num(b.picked)} of ${num(b.target)}`);
  return "You have picks left to make:\n\n"+lines.join("\n")+"\n\nContinue anyway?";
}
/* Lock a block once it is full. `data-fixed` marks an option granted by another
   source: it is disabled and stays disabled, so the re-enable below must key on
   that attribute and NOT on `checked` — otherwise unticking one of your own
   picks would hand a granted proficiency back to you as an editable box. */
function syncChoiceLimits(div){
  if(!div||!div.dataset||!div.dataset.choose)return;
  const target=num(div.dataset.choose);
  const own=Array.prototype.slice.call(div.querySelectorAll('input[type="checkbox"]:not([data-fixed])'));
  const picked=own.filter(cb=>cb.checked).length;
  own.forEach(cb=>{cb.disabled=(picked>=target&&!cb.checked);});
  const cnt=div.querySelector("[data-chcount]");
  if(cnt)cnt.textContent=picked+" of "+target+" chosen";
  div.dataset.full=(picked>=target)?"1":"0";
}
/* Read every choice block on screen as {label,picked,target} — the shape
   choiceShortfall wants. data-choose is the ONLY place the target lives for the
   race/background modal, which never populates _activeChoices. */
function choiceBlocks(){
  return Array.prototype.slice.call(document.querySelectorAll(".choice[data-choose]")).map(div=>{
    const lab=div.querySelector("label.f");
    return {label:lab?String(lab.textContent).split("—")[0].trim():"Choose",
            target:num(div.dataset.choose),
            picked:div.querySelectorAll('input[type="checkbox"]:not([data-fixed]):checked').length};
  });
}
/* True when it is safe to close without asking. */
function choicesSettled(){return choiceShortfall(choiceBlocks())===""}
function choiceFieldHTML(ch,ci,d){
  const t=ch.type;let inner="",chooseAttr="";
  if(t==="skill"){
    const from=ch.from||SKILLS.map(s=>s[1]);
    /* Two passes: the options have to be counted before the heading can say how
       many are still owed. `have` is effSkill()>0, so it covers a proficiency
       granted by an ancestry AND one the player toggled on the dot themselves —
       either way it is not theirs to spend here. grantSources names the source
       when there is one, because "already proficient" never said from where. */
    const opts=from.map(nm=>{
      const key=(SKILLS.find(s=>s[1].toLowerCase()===String(nm).toLowerCase())||[])[0];
      return {nm,key,have:!!(key&&effSkill(key)>0)};
    });
    const granted=opts.filter(o=>o.have).length;
    const target=effectiveChoose(ch.choose,opts.length,granted);
    chooseAttr=` data-choose="${target}"`;
    inner=`<label class="f">Choose ${target} skill(s)`+
      (granted?` <span style="color:var(--ink-soft);font-weight:400">(${granted} already yours)</span>`:"")+
      ` — <span data-chcount>0 of ${target} chosen</span></label>`+
      opts.map(o=>{
        const src=o.have&&o.key?grantSources("skill",o.key):[];
        const why=o.have?(src.length?" (from "+src.join(", ")+")":" (already proficient)"):"";
        return `<label class="opt"><input type="checkbox" data-skill-opt="${esc(o.key||"")}" ${o.have?"checked disabled data-fixed":""}>${esc(o.nm)}${esc(why)}</label>`;
      }).join("");
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
    /* choose===1 is structurally capped by being radios. Everything shipped is
       choose:1 today, so the checkbox half is dead code — but it is the same
       uncapped bug the moment a choose:2 option ships, so it gets the same
       treatment rather than waiting to be rediscovered. */
    if(!single)chooseAttr=` data-choose="${effectiveChoose(choose,from.length,0)}"`;
    inner=`<label class="f">${esc(ch.label||("Choose "+choose))}`+
      (single?"":` — <span data-chcount>0 of ${effectiveChoose(choose,from.length,0)} chosen</span>`)+
      `</label>`+from.map((o,i)=>{
      const fx=(o.effects||[]).map(e=>`${FX_LABEL[e.target]||e.target} ${fmt(num(e.value))}`).join(", ");
      return `<label class="opt" style="align-items:flex-start"><input type="${single?"radio":"checkbox"}" ${single?`name="opt-${ci}"`:""} data-opt-i="${i}"><span><b>${esc(o.name||("Option "+(i+1)))}</b>${o.description?` — ${esc(o.description)}`:""}${fx?` <span style="color:var(--accent-2)">(${esc(fx)})</span>`:""}</span></label>`;
    }).join("");
  }else{
    inner=`<p class="hint">${esc(ch.label||ch.note||"A choice is available at your table.")}</p>`;
  }
  return `<div class="choice" data-ci="${ci}" data-ctype="${esc(t||"note")}" data-sid="${esc(ch._sid||"")}"${chooseAttr} style="border-top:1px dotted var(--hair);padding-top:10px;margin-top:10px">${inner}</div>`;
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
  /* Guard the dismissals too. A Done-only warning would make Escape — which
     discards EVERY pick with no way to reopen the chooser — the easiest way
     past it, which is the opposite of the point. Registered after openModal,
     because openModal clears the guard on every open. */
  armChoiceDismissGuard();
  document.getElementById("chDone").addEventListener("click",()=>{
    const warn=choiceShortfall(choiceBlocks());
    if(warn&&!confirm(warn))return;
    const sel=gatherChoices();closeModal();commitChoices(className,sel);
  });
}
/* Shared by both choice modals. The message differs from Done's: here the picks
   are about to be thrown away, not merely left short. */
function armChoiceDismissGuard(){
  setDismissGuard(()=>{
    const blocks=choiceBlocks();
    const picked=blocks.reduce((a,b)=>a+num(b.picked),0);
    const short=choiceShortfall(blocks);
    if(!short&&!picked)return "";                 /* nothing to lose */
    return (picked?"Closing will discard the picks you have made.":"You have not made your picks yet.")+
      "\n\nThere is no way to reopen this later — you would have to remove and re-add it.\n\nClose anyway?";
  });
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

