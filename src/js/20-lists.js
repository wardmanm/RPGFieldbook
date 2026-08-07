/* ================= structured lists ================= */
function fxChips(effects){
  if(!effects||!effects.length)return "";
  return `<div class="fx">`+effects.map(e=>`<span class="chip">${esc(FX_LABEL[e.target]||e.target)} ${fmt(num(e.value))}</span>`).join("")+`</div>`;
}
function featGroupLabel(f){
  const o=f&&f.origin;
  if(!o)return "Other";
  if(o.kind==="race")return o.name||raceTerm();
  if(o.kind==="background")return o.name||"Background";
  if(o.kind==="class")return o.class||"Class";
  return "Other";
}
function featCol(){if(!character.featCollapse||typeof character.featCollapse!=="object")character.featCollapse={groups:{},items:{}};if(!character.featCollapse.groups)character.featCollapse.groups={};if(!character.featCollapse.items)character.featCollapse.items={};return character.featCollapse;}
function featItemHTML(f){
  const on=f.enabled!==false, ic=!!featCol().items[f.id];
  const hasCost=f.cost&&num(f.cost.amount)>0, hasUses=f.uses&&usesMax(f)>0;
  return `<div class="item fitem">
      <div class="top">
        <button class="fitoggle" data-fitem="${f.id}" aria-label="Collapse item"><svg class="fcaret ${ic?"c":""}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
        <span class="nm">${esc(f.name||"Feature")}</span>
        ${f.source?`<span class="qty">${esc(f.source)}</span>`:""}
        ${(hasCost||hasUses)?`<button class="use-go" data-usefeat="${f.id}">Use</button>`:""}
        <span class="equip ${on?"on":""}" data-toggle-feature="${f.id}"><span class="box"></span>${on?"On":"Off"}</span>
        <button class="icon" data-edit-feature="${f.id}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger" data-del-feature="${f.id}" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
      </div>
      ${ic?"":`${f.description?`<div class="desc">${highlight(f.description)}</div>`:""}${hasCost?`<div class="use-cost">Costs ${num(f.cost.amount)} ${esc(f.cost.resource||"resource")} per use</div>`:""}${hasUses?usesRowHTML(f):""}${on?fxChips(f.effects):fxChips(f.effects).replace(/class="chip"/g,'class="chip off"')}`}
    </div>`;
}
function usesMax(f){
  const m=f&&f.uses?f.uses.max:0;
  if(typeof m==="number")return m;
  if(m&&typeof m==="object"&&Array.isArray(m.byLevel)){const i=Math.max(0,Math.min(totalLevel(),m.byLevel.length)-1);return num(m.byLevel[i]);}
  const fstr=(m&&typeof m==="object"&&m.formula)?m.formula:(typeof m==="string"?m:null);
  if(fstr){
    const s=String(fstr).toLowerCase();
    if(s==="level")return totalLevel();
    const mA=s.match(/^([a-z]{3})([+-]\d+)?$/);
    if(mA&&["str","dex","con","int","wis","cha"].includes(mA[1])){
      const mod=Math.floor((abilFinal(mA[1],contributions())-10)/2)+(mA[2]?parseInt(mA[2],10):0);
      return Math.max(1,mod);
    }
  }
  return num(m);
}
function usesRowHTML(f){
  const u=f.uses,mx=usesMax(f);let pips="";for(let i=1;i<=mx;i++)pips+=`<button class="use-b ${i<=(u.used||0)?"used":""}" data-fuse="${f.id}" data-i="${i}" aria-label="Use"></button>`;
  return `<div class="use-row"><span class="use-lbl">Uses${u.per?` · per ${esc(u.per)} rest`:""}</span><span class="use-pips">${pips}</span></div>`;
}
function useFeature(id){
  const f=(character.features||[]).find(x=>x.id===id);if(!f)return;
  const amt=f.cost?num(f.cost.amount):0;
  let res=null;
  if(amt>0){
    res=(character.resources||[]).find(x=>String(x.name).toLowerCase()===String(f.cost.resource||"").toLowerCase());
    if(!res){alert(`No “${f.cost.resource}” resource to spend from — add it in Resources first.`);return;}
    if(num(res.cur)<amt){alert(`Not enough ${res.name} — need ${amt}, have ${num(res.cur)}.`);return;}
  }
  const umx=usesMax(f), hasUses=f.uses&&umx>0;
  if(hasUses&&num(f.uses.used)>=umx){alert(`No uses of “${f.name}” left — rest to recover.`);return;}
  if(res)res.cur=Math.max(0,num(res.cur)-amt);
  if(hasUses)f.uses.used=Math.min(umx,num(f.uses.used)+1);
  renderFeatures();renderResources();scheduleSave();
}
function renderFeatures(){
  const el=document.getElementById("featureList");
  const list=character.features||[];
  if(!list.length){el.innerHTML=`<div class="empty">No features yet. Add ancestry traits, class features, or feats — attach effects to auto-adjust stats.</div>`;return;}
  const order=[],groups={};
  list.forEach(f=>{const g=featGroupLabel(f);if(!groups[g]){groups[g]=[];order.push(g);}groups[g].push(f);});
  let html="";
  order.forEach(g=>{
    const items=groups[g], gc=!!featCol().groups[g];
    html+=`<div class="fgroup"><div class="fghead" data-fgroup="${esc(g)}"><svg class="fcaret ${gc?"c":""}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg><span class="fgname">${esc(g)}</span><span class="fgcount">${items.length}</span></div>`;
    if(!gc)items.forEach(f=>{html+=featItemHTML(f);});
    html+=`</div>`;
  });
  el.innerHTML=html;
}
function invCol(){if(!character.invCollapse||typeof character.invCollapse!=="object")character.invCollapse={items:{}};if(!character.invCollapse.items)character.invCollapse.items={};if(!character.invCollapse.sections)character.invCollapse.sections={};return character.invCollapse;}
function atkCol(){if(!character.atkCollapse||typeof character.atkCollapse!=="object")character.atkCollapse={items:{}};if(!character.atkCollapse.items)character.atkCollapse.items={};return character.atkCollapse;}
