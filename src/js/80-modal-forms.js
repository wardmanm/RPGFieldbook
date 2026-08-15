/* ================= modal ================= */
const modal=document.getElementById("modal");
/* Closing wipes #mBody, and a "choose 2 skills" prompt cannot be reopened — the
   only recovery is removing and re-adding the class. So a stray Escape silently
   costs the player a level's grants. A modal that stands to lose something
   registers a guard; everything else opens without one, because for an ordinary
   form Escape IS cancel and must stay instant.
   The check cannot live inside closeModal(): every Done handler calls that too,
   and would then have to answer its own prompt. Only the three user-initiated
   dismissals below go through dismissModal(). */
let _dismissGuard=null;
function setDismissGuard(fn){_dismissGuard=fn;}
function openModal(title,html){_dismissGuard=null;document.getElementById("mTitle").textContent=title;document.getElementById("mBody").innerHTML=html;modal.classList.add("open");}
function closeModal(){_dismissGuard=null;modal.classList.remove("open");document.getElementById("mBody").innerHTML="";}
function dismissModal(){
  if(_dismissGuard){const msg=_dismissGuard();if(msg&&!confirm(msg))return;}
  closeModal();
}
document.getElementById("mClose").addEventListener("click",dismissModal);
modal.addEventListener("click",e=>{if(e.target===modal)dismissModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("open"))dismissModal()});
/* Locking a full choice block is a render concern, so it rides the modal rather
   than the global change handler in 90-boot.js — which the test harness drops. */
modal.addEventListener("change",e=>{
  const t=e.target;if(!t||!t.closest)return;
  const div=t.closest(".choice[data-choose]");
  if(div)syncChoiceLimits(div);
});

function openGlossView(g){
  let body= g.type==="image"? (g.image?`<img src="${g.image}" alt="${esc(g.term)}">`:`<p><em>No image attached.</em></p>`) : `<p>${esc(g.text||"—")}</p>`;
  openModal(g.term,body);
}
/* ---- size picker (the Size box in Vitals) ----
   The same control Settings offers, put where the stat is shown. Size is a
   choice, not a derived number, so it gets a chooser rather than the read-only
   breakdown the other Vitals boxes tap through to. */
function openSizePicker(){
  const c=contributions();
  const line=(sz)=>{
    const eff=sz||raceDefSize()||"Medium";
    const mult=SIZE_CARRY[eff]||1;
    return `${eff} — carry up to ${fmtWt(capacityFor(eff,c))}`+
      (mult===1?"":` (${mult>1?"double":"half"} a Medium character's)`)+
      (sz?"":" · taken from your ancestry");
  };
  openModal("Size",`
    <div class="field"><label class="f">Creature size</label><select id="szSel">${sizeOptionsHTML(character.size)}</select></div>
    <p class="hint" id="szHint">${esc(line(character.size))}</p>
    <p class="hint">Size sets how much you can carry. It only changes anything on the sheet while Encumbrance is switched on, in Settings.</p>
    <div class="m-actions"><button class="tbtn" id="szCancel">Cancel</button><button class="tbtn primary" id="szSave">Save</button></div>`);
  const sel=document.getElementById("szSel"), hint=document.getElementById("szHint");
  sel.addEventListener("change",()=>{hint.textContent=line(sel.value);});
  document.getElementById("szCancel").addEventListener("click",closeModal);
  document.getElementById("szSave").addEventListener("click",()=>{
    character.size=sel.value;
    closeModal();renderInventory();recompute();scheduleSave();
  });
}
function openStatBreakdown(target){
  const c=contributions();const contr=c.filter(x=>x.target===target);
  let base="", label=FX_LABEL[target]||target, grantLines="";
  const mods={};ABIL.forEach(([k])=>mods[k]=Math.floor((abilFinal(k,c)-10)/2));const pb=pbValue(c);
  if(target.startsWith("ability.")){const k=target.split(".")[1];base=`Base score ${num(character.abilities[k])}`;}
  else if(target.startsWith("save.")){const k=target.split(".")[1];const prof=effSaveProf(k);base=`Ability mod ${fmt(mods[k])}${prof?` + prof ${fmt(pb)}`:""}`;const src=grantSources("save",k);if(src.length)grantLines+=`<div style="display:flex;justify-content:space-between;border-top:1px dotted var(--hair);padding:5px 0"><span>Proficiency from ${esc(src.join(", "))}</span><b>${fmt(pb)}</b></div>`;else if(character.saves[k])grantLines+=`<div style="display:flex;justify-content:space-between;border-top:1px dotted var(--hair);padding:5px 0"><span>Proficiency (manual)</span><b>${fmt(pb)}</b></div>`;}
  else if(target.startsWith("skill.")){const key=target.split(".")[1];const ab=SKILLS.find(s=>s[0]===key)[2];const lvl=effSkill(key);base=`${ab.toUpperCase()} mod ${fmt(mods[ab])}${lvl>0?` + prof ${fmt(pb)}`:""}${lvl>1?` + expertise ${fmt(pb)}`:""}`;const src=grantSources("skill",key);if(src.length)grantLines+=`<div style="display:flex;justify-content:space-between;border-top:1px dotted var(--hair);padding:5px 0"><span>Proficiency from ${esc(src.join(", "))}</span><b>${fmt(pb)}</b></div>`;else if((character.skills[key]||0)>0)grantLines+=`<div style="display:flex;justify-content:space-between;border-top:1px dotted var(--hair);padding:5px 0"><span>Proficiency (manual)</span><b>${fmt(pb)}</b></div>`;}
  else if(target==="ac"){const AB=armorAC(c);let p;if(AB.hasArmor){const cap=(AB.body.dexCap==null)?AB.dex:Math.min(AB.dex,AB.body.dexCap);p=`Armor ${AB.body.base} + DEX ${fmt(cap)}`;}else if(character.ac!=="")p=`Base AC ${num(character.ac)}`;else p=`10 + DEX ${fmt(mods.dex)}`;if(AB.shield)p+=` + Shield ${fmt(AB.shield)}`;base=p;}
  else if(target==="init")base=character.init===""?`DEX mod ${fmt(mods.dex)}`:`Base ${fmt(num(character.init))}`;
  else if(target==="speed")base=`Base ${num(character.speed)}`;
  let rows=`<p style="margin-bottom:6px">${esc(base)}</p>`+grantLines;
  if(contr.length)rows+=contr.map(x=>`<div style="display:flex;justify-content:space-between;border-top:1px dotted var(--hair);padding:5px 0"><span>${esc(x.source)}</span><b>${fmt(x.value)}</b></div>`).join("");
  else if(!grantLines)rows+=`<p style="color:var(--ink-soft);font-style:italic">No item, feature, or grant effects apply.</p>`;
  /* Encumbrance is last because it is applied last — after the numeric effects,
     and sometimes as a replacement rather than a modifier. */
  if(target==="speed"){
    const st=encState(c);
    if(st.mode!=="none"&&st.tier!=="ok"){
      const val=st.floor!=null?(st.floor+" ft"):fmt(st.penalty);
      rows+=`<div style="display:flex;justify-content:space-between;border-top:1px dotted var(--hair);padding:5px 0"><span>${esc(st.label)} (${esc(fmtWt(st.carried))} / ${esc(fmtWt(st.cap))})</span><b>${esc(val)}</b></div>`;
      rows+=`<p class="hint" style="margin-top:6px">${esc(encTierNote(st))}</p>`;
    }
  }
  openModal(label+" breakdown",rows);
}

/* ---- effect editor markup ---- */
function fxEditorRows(effects){
  return (effects||[]).map(e=>fxRow(e)).join("");
}
function fxRow(e){
  const opts=fxTargets().map(([l,t])=>`<option value="${t}"${e&&e.target===t?" selected":""}>${l}</option>`).join("");
  return `<div class="fxrow"><select class="fx-t">${opts}</select><input class="fx-v" type="number" value="${e?num(e.value):1}"><button class="icon danger fx-del" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
}
function collectFx(scope){
  return Array.from(scope.querySelectorAll(".fxrow")).map(r=>({target:r.querySelector(".fx-t").value,value:num(r.querySelector(".fx-v").value)})).filter(e=>e.value!==0);
}

/* ---- feature editor ---- */
function openFeatureForm(existing){
  const f=existing||{id:uid(),name:"",source:"",description:"",effects:[],enabled:true};
  const lib=(rules.features||[]);
  openModal(existing?"Edit feature":"New feature",`
    ${lib.length?`<div class="field"><label class="f">Insert from rules pack</label><select id="fLib"><option value="">—</option>${lib.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join("")}</select></div>`:""}
    <div class="field"><label class="f">Name</label><input id="fName" value="${esc(f.name)}"></div>
    <div class="field"><label class="f">Source (optional)</label><input id="fSrc" value="${esc(f.source||"")}" placeholder="Ancestry, Class, Feat…"></div>
    <div class="field"><label class="f">Description</label><textarea id="fDesc">${esc(f.description||"")}</textarea></div>
    <div class="field"><label class="f">Effects on stats</label><div id="fFx">${fxEditorRows(f.effects)}</div><button class="fx-add" id="fAddFx">+ Add effect</button></div>
    <div class="g2"><div class="field"><label class="f">Limited uses (0 = none)</label><input id="fUses" type="number" min="0" value="${num(f.uses&&usesMax(f))||""}" placeholder="0"></div>
      <div class="field"><label class="f">Resets on</label><select id="fUsesPer"><option value="long"${(f.uses&&f.uses.per)!=="short"?" selected":""}>Long rest</option><option value="short"${(f.uses&&f.uses.per)==="short"?" selected":""}>Short rest</option></select></div></div>
    <div class="g2"><div class="field"><label class="f">Cost per use (0 = none)</label><input id="fCost" type="number" min="0" value="${num(f.cost&&f.cost.amount)||""}" placeholder="0"></div>
      <div class="field"><label class="f">From resource</label><input id="fCostRes" list="resNamesDL" value="${esc(f.cost&&f.cost.resource||"")}" placeholder="e.g. Scrap" autocomplete="off"></div></div>
    <datalist id="resNamesDL">${(character.resources||[]).map(r=>`<option value="${esc(r.name)}"></option>`).join("")}</datalist>
    <div class="m-actions"><button class="tbtn" id="fCancel">Cancel</button><button class="tbtn primary" id="fSave">${existing?"Save":"Add"}</button></div>`);
  const fxWrap=document.getElementById("fFx");
  document.getElementById("fAddFx").addEventListener("click",()=>fxWrap.insertAdjacentHTML("beforeend",fxRow(null)));
  fxWrap.addEventListener("click",e=>{const d=e.target.closest(".fx-del");if(d)d.closest(".fxrow").remove();});
  const libSel=document.getElementById("fLib");
  if(libSel)libSel.addEventListener("change",()=>{const x=lib[libSel.value];if(!x)return;document.getElementById("fName").value=x.name||"";document.getElementById("fSrc").value=x.source||"";document.getElementById("fDesc").value=x.description||"";fxWrap.innerHTML=fxEditorRows(x.effects);});
  document.getElementById("fCancel").addEventListener("click",closeModal);
  document.getElementById("fSave").addEventListener("click",()=>{
    const rec={id:f.id,name:document.getElementById("fName").value.trim()||"Feature",source:document.getElementById("fSrc").value.trim(),description:document.getElementById("fDesc").value,effects:collectFx(fxWrap),enabled:f.enabled!==false};
    const um=Math.max(0,num(document.getElementById("fUses").value));
    if(um>0)rec.uses={max:um,per:document.getElementById("fUsesPer").value,used:Math.min(num(f.uses&&f.uses.used),um)};
    const cAmt=Math.max(0,num(document.getElementById("fCost").value)), cRes=document.getElementById("fCostRes").value.trim();
    if(cAmt>0&&cRes)rec.cost={resource:cRes,amount:cAmt};
    /* rec is rebuilt from the form, so anything the form doesn't ask about has to
       be carried across explicitly or an edit silently discards it — the same
       trap the item editor already guards against. All three are invisible when
       lost: the favourite star, the origin that files this under its class
       rather than "Other", and the src stamp the rules-update tool needs to tell
       "the pack changed" from "the player edited this". */
    if(f.fav)rec.fav=f.fav;
    if(f.origin)rec.origin=f.origin;
    if(f.src)rec.src=f.src;
    const i=character.features.findIndex(x=>x.id===f.id);if(i>=0)character.features[i]=rec;else character.features.push(rec);
    closeModal();renderFeatures();recompute();scheduleSave();
  });
}
/* ---- item editor ---- */
function openItemForm(existing){
  const it=existing||{id:uid(),name:"",qty:1,description:"",effects:[],equipped:false};
  const lib=(rules.items||[]);
  const w=it.weapon||{};
  const abilOpts=[["str","Strength"],["dex","Dexterity"],["con","Constitution"],["int","Intelligence"],["wis","Wisdom"],["cha","Charisma"],["finesse","Finesse (best of STR/DEX)"],["none","None"]];
  openModal(existing?"Edit item":"New item",`
    ${lib.length?`<div class="field"><label class="f">Insert from rules pack</label><select id="iLib"><option value="">—</option>${lib.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join("")}</select></div>`:""}
    <div class="g2"><div class="field"><label class="f">Name</label><input id="iName" value="${esc(it.name)}"></div>
      <div class="field"><label class="f">Quantity</label><input id="iQty" type="number" min="1" value="${num(it.qty)||1}"></div></div>
    <div class="field"><label class="f">Description</label><textarea id="iDesc">${esc(it.description||"")}</textarea></div>
    <div class="field"><label class="f">Category</label><select id="iCategory"><option value=""${!it.sectionOverride?" selected":""}>Automatic (${esc(invSection(it))})</option>${INV_ORDER.map(sname=>`<option value="${sname}"${it.sectionOverride===sname?" selected":""}>${sname}</option>`).join("")}</select></div>
    <div class="g2"><div class="field"><label class="f">Cost (gp, optional)</label><input id="iCost" type="number" min="0" step="0.01" value="${it.cost!=null&&it.cost!==""?fnum(it.cost):""}" placeholder="0"></div>
      <div class="field"><label class="f">Weight each (lb, optional)</label><input id="iWeight" type="number" min="0" step="0.01" value="${it.weight!=null&&it.weight!==""?fnum(it.weight):""}" placeholder="0"></div></div>
    <div class="field"><label class="f">Origin</label><select id="iOrigin">${originOptionsHTML(it.origin,false)}</select></div>
    <div class="field" id="iOrigDetWrap" style="${it.origin?"":"display:none"}"><label class="f">Origin detail</label><input id="iOrigDet" value="${esc((it.origin&&it.origin.detail)||"")}" placeholder="${esc((it.origin&&originDef(it.origin.kind)&&originDef(it.origin.kind).ph)||"place, who, etc.")}"></div>
    <div class="field"><label class="f">Effects while equipped</label><div id="iFx">${fxEditorRows(it.effects)}</div><button class="fx-add" id="iAddFx">+ Add effect</button></div>
    <label class="equip ${it.equipped?"on":""}" id="iEquip" style="font-size:12px"><span class="box"></span>Equipped (apply effects now)</label>
    <label class="equip ${it.weapon?"on":""}" id="iIsWeapon" style="font-size:12px;margin-top:8px"><span class="box"></span>Weapon (create a linked attack)</label>
    <div id="iWeaponFields" style="${it.weapon?"":"display:none"}">
      <div class="g2"><div class="field"><label class="f">Type</label><select id="iWKind"><option value="melee"${w.kind!=="ranged"?" selected":""}>Melee</option><option value="ranged"${w.kind==="ranged"?" selected":""}>Ranged</option></select></div>
        <div class="field"><label class="f">Ability</label><select id="iWAbil">${abilOpts.map(([v,l])=>`<option value="${v}"${(w.ability||"str")===v?" selected":""}>${l}</option>`).join("")}</select></div></div>
      <div class="g2"><div class="field"><label class="f">Damage dice</label><input id="iWDice" value="${esc(w.dice||"")}" placeholder="1d8"></div>
        <div class="field"><label class="f">Damage type</label><input id="iWType" value="${esc(w.damageType||"")}" placeholder="slashing"></div></div>
    </div>
    <div class="m-actions"><button class="tbtn" id="iCancel">Cancel</button><button class="tbtn primary" id="iSave">${existing?"Save":"Add"}</button></div>`);
  let equipped=!!it.equipped;
  const eq=document.getElementById("iEquip");eq.addEventListener("click",()=>{equipped=!equipped;eq.classList.toggle("on",equipped)});
  let isWeapon=!!it.weapon;
  const wtog=document.getElementById("iIsWeapon"), wfields=document.getElementById("iWeaponFields");
  wtog.addEventListener("click",()=>{isWeapon=!isWeapon;wtog.classList.toggle("on",isWeapon);wfields.style.display=isWeapon?"":"none";});
  const fxWrap=document.getElementById("iFx");
  document.getElementById("iAddFx").addEventListener("click",()=>fxWrap.insertAdjacentHTML("beforeend",fxRow(null)));
  fxWrap.addEventListener("click",e=>{const d=e.target.closest(".fx-del");if(d)d.closest(".fxrow").remove()});
  const libSel=document.getElementById("iLib");
  if(libSel)libSel.addEventListener("change",()=>{const x=lib[libSel.value];if(!x)return;document.getElementById("iName").value=x.name||"";document.getElementById("iDesc").value=x.description||"";const cg=costToGp(x.cost);if(cg!=null)document.getElementById("iCost").value=cg;const wg=fnum(x.weight);if(wg)document.getElementById("iWeight").value=wg;fxWrap.innerHTML=fxEditorRows(x.effects);
    if(x.weapon){isWeapon=true;wtog.classList.add("on");wfields.style.display="";document.getElementById("iWKind").value=x.weapon.kind==="ranged"?"ranged":"melee";document.getElementById("iWAbil").value=x.weapon.ability||"str";document.getElementById("iWDice").value=x.weapon.dice||"";document.getElementById("iWType").value=x.weapon.damageType||"";}});
  document.getElementById("iCancel").addEventListener("click",closeModal);
  const iOrig=document.getElementById("iOrigin"),iOrigW=document.getElementById("iOrigDetWrap"),iOrigD=document.getElementById("iOrigDet");
  if(iOrig)iOrig.addEventListener("change",()=>{const d=originDef(iOrig.value);iOrigW.style.display=iOrig.value?"":"none";if(d&&iOrigD)iOrigD.placeholder=d.ph||"place, who, etc.";});
  document.getElementById("iSave").addEventListener("click",()=>{
    const rec={id:it.id,name:document.getElementById("iName").value.trim()||"Item",qty:num(document.getElementById("iQty").value)||1,description:document.getElementById("iDesc").value,effects:collectFx(fxWrap),equipped};
    const so=document.getElementById("iCategory").value;if(so)rec.sectionOverride=so;
    if(it.category)rec.category=it.category;if(it.type)rec.type=it.type;
    const cv=document.getElementById("iCost").value;if(cv!==""&&fnum(cv)>=0)rec.cost=fnum(cv);
    const wv=document.getElementById("iWeight").value;if(wv!==""&&fnum(wv)>0)rec.weight=fnum(wv);
    const ok=document.getElementById("iOrigin").value;if(ok)rec.origin={kind:ok,detail:document.getElementById("iOrigDet").value.trim(),at:(it.origin&&it.origin.at)||Date.now()};
    if(it.grant)rec.grant=it.grant;
    if(it.attackId)rec.attackId=it.attackId;
    /* rec is rebuilt from the form, so anything the form doesn't ask about has to
       be carried across explicitly or an edit silently discards it: the favourite
       star, and — worse, because it is invisible — the src stamp the rules-update
       tool needs to tell "the pack changed" from "the player edited this". */
    if(it.fav)rec.fav=it.fav;
    if(it.src)rec.src=it.src;
    const dice=document.getElementById("iWDice").value.trim();
    if(isWeapon&&dice){rec.weapon={kind:document.getElementById("iWKind").value,ability:document.getElementById("iWAbil").value,dice,damageType:document.getElementById("iWType").value.trim(),notes:(it.weapon&&it.weapon.notes)||""};if(it.weapon&&it.weapon.atkMisc!=null)rec.weapon.atkMisc=it.weapon.atkMisc;if(it.weapon&&it.weapon.dmgMisc!=null)rec.weapon.dmgMisc=it.weapon.dmgMisc;}
    const i=character.inventory.findIndex(x=>x.id===it.id);if(i>=0)character.inventory[i]=rec;else character.inventory.push(rec);
    syncItemAttack(rec);
    closeModal();renderInventory();renderAttacks();recompute();scheduleSave();
  });
}
/* reconcile a weapon item with its linked Attacks & Weapons entry */
function syncItemAttack(item){
  const existing=character.attacks.find(a=>a.itemId===item.id);
  if(item.weapon&&item.weapon.dice){
    const w=item.weapon;
    if(existing){
      existing.name=item.name;existing.kind=w.kind==="ranged"?"ranged":"melee";existing.ability=w.ability||"str";
      existing.damageDice=w.dice||"";existing.damageType=w.damageType||"";existing.notes=w.notes||existing.notes||"";
      if(w.atkMisc!=null)existing.atkMisc=String(w.atkMisc);if(w.dmgMisc!=null)existing.dmgMisc=String(w.dmgMisc);
      item.attackId=existing.id;
    }else addAttackForItem(item);
  }else if(existing){
    character.attacks=character.attacks.filter(a=>a.itemId!==item.id);
    delete item.attackId;
  }
}
/* ---- spell editor ---- */
function openStatusForm(existing){
  const s=existing||{id:uid(),name:"",description:"",effects:[],active:true};
  const CONDSET=new Set(["blinded","charmed","deafened","exhaustion","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious","bloodied","concentration","surprised"]);
  const terms=[...new Set(allGlossary().filter(g=>g.cond||CONDSET.has(String(g.term||"").trim().toLowerCase())).map(g=>g.term).filter(Boolean))];
  const dl=terms.length?`<datalist id="statusTerms">${terms.map(t=>`<option value="${esc(t)}">`).join("")}</datalist>`:"";
  openModal(existing?"Edit status":"New status",`
    <div class="field"><label class="f">Condition / status</label><input id="stName" list="statusTerms" value="${esc(s.name)}" placeholder="Poisoned, Grappled, Blessed…">${dl}
      <p class="hint">If the name matches a glossary or rules entry, it becomes tappable to show the rule.</p></div>
    <div class="field"><label class="f">Notes (optional)</label><textarea id="stDesc">${esc(s.description||"")}</textarea></div>
    <div class="field"><label class="f">Effects while active (optional)</label><div id="stFx">${fxEditorRows(s.effects)}</div><button class="fx-add" id="stAddFx">+ Add effect</button>
      <p class="hint">Use for numeric changes (e.g. AC −2). Non-numeric effects like “disadvantage” are best kept as notes / a glossary entry.</p></div>
    <label class="equip ${s.active!==false?"on":""}" id="stActive" style="font-size:12px"><span class="box"></span>Active now (apply effects)</label>
    <div class="m-actions"><button class="tbtn" id="stCancel">Cancel</button><button class="tbtn primary" id="stSave">${existing?"Save":"Add"}</button></div>`);
  let active=s.active!==false;
  const act=document.getElementById("stActive");act.addEventListener("click",()=>{active=!active;act.classList.toggle("on",active)});
  const fxWrap=document.getElementById("stFx");
  document.getElementById("stAddFx").addEventListener("click",()=>fxWrap.insertAdjacentHTML("beforeend",fxRow(null)));
  fxWrap.addEventListener("click",e=>{const d=e.target.closest(".fx-del");if(d)d.closest(".fxrow").remove()});
  document.getElementById("stCancel").addEventListener("click",closeModal);
  document.getElementById("stSave").addEventListener("click",()=>{
    const rec={id:s.id,name:document.getElementById("stName").value.trim()||"Status",description:document.getElementById("stDesc").value,effects:collectFx(fxWrap),active};
    const i=character.statuses.findIndex(x=>x.id===s.id);if(i>=0)character.statuses[i]=rec;else character.statuses.push(rec);
    closeModal();renderStatuses();recompute();scheduleSave();
  });
}
function openFamiliarForm(existing){
  const f=existing||{id:uid(),name:"",kind:"",ac:"",hp:{cur:"",max:""},speed:"",description:"",effects:[],active:false};
  openModal(existing?"Edit familiar":"New familiar",`
    <div class="g2"><div class="field"><label class="f">Name</label><input id="faName" value="${esc(f.name)}" placeholder="Sprocket"></div>
      <div class="field"><label class="f">Type</label><input id="faKind" value="${esc(f.kind||"")}" placeholder="Owl, Sprite…"></div></div>
    <div class="g3"><div class="field"><label class="f">AC</label><input id="faAc" type="number" value="${esc(f.ac)}"></div>
      <div class="field"><label class="f">HP now</label><input id="faHpCur" type="number" value="${esc(f.hp&&f.hp.cur)}"></div>
      <div class="field"><label class="f">HP max</label><input id="faHpMax" type="number" value="${esc(f.hp&&f.hp.max)}"></div></div>
    <div class="field"><label class="f">Speed</label><input id="faSpeed" value="${esc(f.speed||"")}" placeholder="30 ft, fly 60 ft"></div>
    <div class="field"><label class="f">Description / abilities</label><textarea id="faDesc">${esc(f.description||"")}</textarea></div>
    <div class="field"><label class="f">Effects on you while summoned (optional)</label><div id="faFx">${fxEditorRows(f.effects)}</div><button class="fx-add" id="faAddFx">+ Add effect</button></div>
    <label class="equip ${f.active?"on":""}" id="faActive" style="font-size:12px"><span class="box"></span>Summoned (active)</label>
    <div class="m-actions"><button class="tbtn" id="faCancel">Cancel</button><button class="tbtn primary" id="faSave">${existing?"Save":"Add"}</button></div>`);
  let active=!!f.active;
  const act=document.getElementById("faActive");act.addEventListener("click",()=>{active=!active;act.classList.toggle("on",active)});
  const fxWrap=document.getElementById("faFx");
  document.getElementById("faAddFx").addEventListener("click",()=>fxWrap.insertAdjacentHTML("beforeend",fxRow(null)));
  fxWrap.addEventListener("click",e=>{const d=e.target.closest(".fx-del");if(d)d.closest(".fxrow").remove()});
  document.getElementById("faCancel").addEventListener("click",closeModal);
  document.getElementById("faSave").addEventListener("click",()=>{
    const rec={id:f.id,name:document.getElementById("faName").value.trim()||"Familiar",kind:document.getElementById("faKind").value.trim(),ac:document.getElementById("faAc").value,hp:{cur:document.getElementById("faHpCur").value,max:document.getElementById("faHpMax").value},speed:document.getElementById("faSpeed").value.trim(),description:document.getElementById("faDesc").value,effects:collectFx(fxWrap),active};
    const i=character.familiars.findIndex(x=>x.id===f.id);if(i>=0)character.familiars[i]=rec;else character.familiars.push(rec);
    closeModal();renderFamiliars();recompute();scheduleSave();
  });
}
function openSpellForm(existing){
  const s=existing||{id:uid(),name:"",level:0,prepared:false,meta:"",text:""};
  const lib=(rules.spells||[]);
  const myCl=(character.classes||[]).map(c=>(c.name||"").toLowerCase());
  const clsOf=x=>x.class?(Array.isArray(x.class)?x.class:[x.class]):[];
  const matches=x=>{const c=clsOf(x);return !c.length||c.some(n=>myCl.includes(String(n).toLowerCase()));};
  const libOpts=lib.slice().sort((a,b)=>num(a.level)-num(b.level)||(a.name||"").localeCompare(b.name||"")).map(x=>`<option value="${esc(x._id||x.name)}" data-lv="${num(x.level)}" data-cls="${esc(clsOf(x).join("|").toLowerCase())}" data-mine="${matches(x)?1:0}">${esc(dispName(x,"spells"))} (${num(x.level)===0?"cantrip":"lv "+num(x.level)})${clsOf(x).length?" · "+esc(clsOf(x).join("/")):""}</option>`).join("");
  const caster=hasCasterClass(), mx=maxCastableLevel();
  openModal(existing?"Edit spell":"New spell",`
    ${lib.length?`<div class="field"><label class="f">Insert from rules pack</label><select id="sLib"><option value="">—</option>${libOpts}</select>
      ${myCl.length?`<label class="opt" style="margin-top:8px"><input type="checkbox" id="sOnlyClass" ${caster?"checked":""}>Only my class's castable spells${caster&&mx?` (up to level ${mx})`:""}</label>`:""}
      <p class="hint">Filtered to spells your class can cast at your level. Untick to browse everything — picking outside your class is allowed.</p></div>`:""}
    <div class="g2"><div class="field"><label class="f">Name</label><input id="sName" value="${esc(s.name)}"></div>
      <div class="field"><label class="f">Level</label><select id="sLevel">${[0,1,2,3,4,5,6,7,8,9].map(n=>`<option value="${n}"${num(s.level)===n?" selected":""}>${n===0?"Cantrip":"Level "+n}</option>`).join("")}</select></div></div>
    <div class="field"><label class="f">Meta (casting time, components…)</label><input id="sMeta" value="${esc(s.meta||"")}" placeholder="1 action · V,S · 60 ft"></div>
    <div class="field"><label class="f">Description</label><textarea id="sText">${esc(s.text||"")}</textarea></div>
    <div class="g2"><div class="field"><label class="f">Origin</label><select id="sOrigin">${originOptionsHTML(s.origin||originFromGranted(s.granted)||{kind:"class"},true)}</select></div>
      <div class="field"><label class="f">Origin detail</label><input id="sOrigDet" value="${esc((s.origin&&s.origin.detail)||"")}" placeholder="place, who, etc."></div></div>
    <p class="hint">Class/none counts toward your allotment; every other origin is treated as granted and excluded.</p>
    <div class="field"><label class="f">This spell is</label>
      <select id="sAtkType"><option value=""${!s.atkType?" selected":""}>Not an attack</option><option value="attack"${s.atkType==="attack"?" selected":""}>An attack roll</option><option value="save"${s.atkType==="save"?" selected":""}>A saving throw</option></select></div>
    <div id="sAtkFields" style="${s.atkType?"":"display:none"}">
      <div class="g2">
        <div class="field" id="sKindWrap" style="${s.atkType==="save"?"display:none":""}"><label class="f">Attack kind</label><select id="sAtkKind"><option value="ranged"${s.atkKind!=="melee"?" selected":""}>Ranged spell attack</option><option value="melee"${s.atkKind==="melee"?" selected":""}>Melee spell attack</option></select></div>
        <div class="field" id="sSaveWrap" style="${s.atkType==="save"?"":"display:none"}"><label class="f">Saving throw</label><select id="sSaveAbil">${ABIL.map(([k,l])=>`<option value="${k}"${(s.saveAbility||"dex")===k?" selected":""}>${l}</option>`).join("")}</select></div>
      </div>
      <div class="g2"><div class="field"><label class="f">Damage dice</label><input id="sDice" value="${esc(s.dice||"")}" placeholder="8d6"></div>
        <div class="field"><label class="f">Damage type</label><input id="sDmgType" value="${esc(s.damageType||"")}" placeholder="fire"></div></div>
    </div>
    <div class="g2"><label class="equip ${(s.conc!=null?s.conc:/concentration/i.test(s.meta||""))?"on":""}" id="sConc" style="font-size:12px;align-self:end"><span class="box"></span>Concentration</label>
      <div class="field"><label class="f">Duration</label><input id="sDur" value="${esc(s.duration||metaDuration(s.meta)||"")}" placeholder="1 minute / 10 rounds / Instantaneous"></div></div>
    <label class="equip ${s.prepared?"on":""}" id="sPrep" style="font-size:12px"><span class="box"></span>Prepared</label>
    <div class="m-actions"><button class="tbtn" id="sCancel">Cancel</button><button class="tbtn primary" id="sSave">${existing?"Save":"Add"}</button></div>`);
  let prep=!!s.prepared;const p=document.getElementById("sPrep");p.addEventListener("click",()=>{prep=!prep;p.classList.toggle("on",prep)});
  let conc=(s.conc!=null?!!s.conc:/concentration/i.test(s.meta||""));const cc=document.getElementById("sConc");if(cc)cc.addEventListener("click",()=>{conc=!conc;cc.classList.toggle("on",conc)});
  const sAtk=document.getElementById("sAtkType");
  if(sAtk)sAtk.addEventListener("change",()=>{const v=sAtk.value;document.getElementById("sAtkFields").style.display=v?"":"none";document.getElementById("sKindWrap").style.display=v==="save"?"none":"";document.getElementById("sSaveWrap").style.display=v==="save"?"":"none";});
  const libSel=document.getElementById("sLib"),only=document.getElementById("sOnlyClass");
  function applyClassFilter(){if(!libSel||!only)return;const cap=maxCastableLevel();Array.from(libSel.options).forEach(o=>{if(!o.value)return;const lv=num(o.dataset.lv),okCls=o.dataset.mine==="1",okLv=(lv===0)||(cap===0)||(lv<=cap);o.hidden=only.checked&&!(okCls&&okLv);});if(libSel.selectedOptions[0]&&libSel.selectedOptions[0].hidden)libSel.value="";}
  if(only){only.addEventListener("change",applyClassFilter);applyClassFilter();}
  if(libSel)libSel.addEventListener("change",()=>{const x=lib.find(y=>(y._id||y.name)===libSel.value);if(!x)return;document.getElementById("sName").value=x.name||"";document.getElementById("sMeta").value=x.meta||"";document.getElementById("sText").value=x.text||"";document.getElementById("sLevel").value=String(num(x.level));
    const tmp={text:x.text||"",meta:x.meta||""};detectSpellAttack(tmp);
    const at=document.getElementById("sAtkType");if(at){at.value=tmp.atkType||"";at.dispatchEvent(new Event("change"));}
    if(tmp.atkKind)document.getElementById("sAtkKind").value=tmp.atkKind;
    if(tmp.saveAbility)document.getElementById("sSaveAbil").value=tmp.saveAbility;
    if(tmp.dice)document.getElementById("sDice").value=tmp.dice;
    if(tmp.damageType)document.getElementById("sDmgType").value=tmp.damageType;
    document.getElementById("sDur").value=x.duration||metaDuration(x.meta)||"";});
  document.getElementById("sCancel").addEventListener("click",closeModal);
  document.getElementById("sSave").addEventListener("click",()=>{
    const ok=document.getElementById("sOrigin").value,det=document.getElementById("sOrigDet").value.trim();
    const origin=ok?{kind:ok,detail:det,at:(s.origin&&s.origin.at)||Date.now()}:null;
    const atkType=document.getElementById("sAtkType").value;
    const rec={id:s.id,name:document.getElementById("sName").value.trim()||"Spell",level:num(document.getElementById("sLevel").value),meta:document.getElementById("sMeta").value.trim(),text:document.getElementById("sText").value,prepared:prep,granted:grantedFromOrigin(ok),origin:origin,
      atkType:atkType,atkKind:document.getElementById("sAtkKind").value,saveAbility:document.getElementById("sSaveAbil").value,dice:document.getElementById("sDice").value.trim(),damageType:document.getElementById("sDmgType").value.trim(),conc:conc,duration:document.getElementById("sDur").value.trim()};
    const i=character.spells.findIndex(x=>x.id===s.id);if(i>=0)character.spells[i]=rec;else character.spells.push(rec);
    syncSpellAttack(rec);
    closeModal();renderSpells();renderAttacks();scheduleSave();
  });
}
function openSpellView(s){openModal(s.name,`${s.meta?`<p style="font-family:var(--head);font-size:12px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">${esc((s.level===0?"Cantrip":"Level "+s.level))} · ${esc(s.meta)}</p>`:""}<p>${highlight(s.text||"—")}</p>`);}

