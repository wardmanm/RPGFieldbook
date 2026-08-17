/* death + slots visual */
function renderDeath(){
  document.querySelectorAll('#deathSucc .c').forEach(c=>c.classList.toggle("on",num(c.dataset.i)<=(character.death.succ||0)));
  document.querySelectorAll('#deathFail .c').forEach(c=>c.classList.toggle("on",num(c.dataset.i)<=(character.death.fail||0)));
}
/* ---- rests (derived from HP, spell slots, and caster data) ---- */
function restSummary(title,lines,note){
  const body=(lines.length?`<ul style="margin:2px 0 8px;padding-left:18px;line-height:1.6">${lines.map(l=>`<li>${esc(l)}</li>`).join("")}</ul>`:"")+(note?`<p class="hint">${esc(note)}</p>`:"")+`<div class="m-actions"><button class="tbtn primary" id="restOk">OK</button></div>`;
  openModal(title,body);const b=document.getElementById("restOk");if(b)b.addEventListener("click",closeModal);
}
function resetFeatureUses(kinds){
  let n=0;(character.features||[]).forEach(f=>{if(f.uses&&kinds.includes(f.uses.per||"")){if(f.uses.used){n++;}f.uses.used=0;}});
  return n;
}
function longRest(){
  const c=contributions();
  const effMax=effMaxHP(c), hadMax=effMax>0;
  if(hadMax)character.hp.cur=effMax;
  character.hp.temp="";
  character.death={succ:0,fail:0};
  let slotsBack=0;for(let lv=1;lv<=9;lv++){if(character.slots[lv]){slotsBack+=character.slots[lv].used||0;character.slots[lv].used=0;}}
  const hdBack=recoverHitDice();
  const featBack=resetFeatureUses(["short","long"]);
  const resBack=resetResources(["short","long"]);
  renderHP();
  renderDeath();renderFeatures();recompute();scheduleSave();
  const lines=[
    hadMax?`Current HP restored to ${effMax}`:"HP unchanged — set a Max HP first",
    "Temporary HP cleared",
    slotsBack?`${slotsBack} spell slot${slotsBack===1?"":"s"} recovered`:"Spell slots already full",
    "Death saves cleared"
  ];
  if(hitDicePool().length)lines.push(hdBack?`${hdBack} Hit ${hdBack===1?"Die":"Dice"} recovered (half your total)`:"Hit Dice already full");
  if(featBack)lines.push(`${featBack} feature use tracker${featBack===1?"":"s"} reset`);
  if(resBack)lines.push(`${resBack} resource${resBack===1?"":"s"} restored`);
  renderResources();
  restSummary("Long rest complete",lines,"");
}
function shortRest(){
  const wl=warlockLevel();let pactBack=0,pactMsg="";
  if(wl>0){const p=PACT[Math.min(20,wl)];if(p&&character.slots[p[1]]){const before=character.slots[p[1]].used||0;character.slots[p[1]].used=Math.max(0,before-p[0]);pactBack=before-character.slots[p[1]].used;pactMsg=pactBack?`${pactBack} pact slot${pactBack===1?"":"s"} recovered (level ${p[1]})`:"Pact slots already full";}}
  const featBack=resetFeatureUses(["short"]);
  const resBack=resetResources(["short"]);
  renderFeatures();renderResources();recompute();scheduleSave();
  const lines=[];if(pactMsg)lines.push(pactMsg);if(featBack)lines.push(`${featBack} short-rest feature tracker${featBack===1?"":"s"} reset`);if(resBack)lines.push(`${resBack} short-rest resource${resBack===1?"":"s"} restored`);
  restSummary("Short rest",lines.length?lines:["No resources auto-recover on a short rest for this character."],"Spend Hit Dice from the Rest & Recovery card to heal. Regular spell slots return on a long rest, not a short one.");
}
/* ---- hit dice pool (derived from class hit die × level) ---- */
function hitDicePool(){
  const totals={};
  if(character.hdManual){
    const re=/(\d+)\s*(d\d+)/gi;let mm;
    while((mm=re.exec(character.hitdice||""))){const die=mm[2].toLowerCase();totals[die]=(totals[die]||0)+parseInt(mm[1],10);}
  }else{
    (character.classes||[]).forEach(c=>{const d=findClassDef(c.name);const die=d&&d.hitDie;if(die)totals[die]=(totals[die]||0)+num(c.level);});
  }
  const order=["d12","d10","d8","d6","d4","d20"];
  return Object.keys(totals).sort((a,b)=>order.indexOf(a)-order.indexOf(b)).map(die=>({die,total:totals[die],used:Math.min(totals[die],num((character.hdUsed||{})[die]))}));
}
function hdString(pool){return pool.map(p=>p.total+p.die).join(" + ");}
function renderHitDice(){
  const pool=hitDicePool();
  /* One function for both halves of the Rest & Recovery card — the field and the
     pips. They can't be split: this auto-mode write feeds the pool below it, and
     no caller ever wants only one of them. */
  if(!character.hdManual)character.hitdice=hdString(pool);
  /* In auto mode the text field is a read-only echo of the pool below it —
     the same dice written twice, which is what made this card confusing. So it
     is HIDDEN unless you're editing them by hand; the auto/manual pill is what
     brings it back, and it already focuses it on the way in. */
  const inp=document.getElementById("hitdiceInput"), modeBtn=document.querySelector("[data-hdmode]");
  if(inp){inp.readOnly=!character.hdManual;inp.style.display=character.hdManual?"":"none";if(!character.hdManual)inp.value=character.hitdice||"";}
  if(modeBtn){modeBtn.textContent=character.hdManual?"manual":"auto";modeBtn.classList.toggle("manual",character.hdManual);}
  const el=document.getElementById("hdWrap");if(!el)return;
  const warn=character.hdManual?`<div class="hd-warn">⚠ Manual Hit Dice — they won't follow your class when you level up. <button class="linkbtn" data-hdreset>Reset to class</button></div>`:"";
  if(!pool.length){
    el.innerHTML=warn+`<p class="hint hd-none">${character.hdManual?"Type your dice above, e.g. 2d8 + 1d6.":"Add a class and your Hit Dice appear here. Or switch to manual and type them in."}</p>`;
    return;
  }
  const style=hdStyle();
  el.innerHTML=warn+(style==="condensed"?hdCondensedHTML(pool):style==="dice"?hdDiceHTML(pool):hdFullHTML(pool));
}
/* Which of the three looks this character uses. Anything unrecognised — an
   older sheet, a hand-edited file — falls back to full, which is also
   blankChar's default, so the setting needs no migration of its own and an old
   sheet lands on the same look a new one does. */
function hdStyle(){const s=character.hdStyle;return (s==="condensed"||s==="dice")?s:"full";}
/* A pip is filled when the die is SPENT — the same way the spell slot bubbles
   read. The count beside them says which way round it goes, so nobody has to
   infer it. Shared by the full and condensed styles; the dice style has no
   separate pips, because there the dice ARE the pips. */
function hdPips(p){
  let h="";
  for(let i=1;i<=p.total;i++)h+=`<button class="hd-b ${i<=p.used?"used":""}" data-hd="${p.die}" data-i="${i}" aria-label="${p.die} number ${i}${i<=p.used?" (spent)":""}"></button>`;
  return h;
}
/* CONDENSED — one line per die size. The rows get their own grid container so
   their four columns line up with each other; .hd-row is display:contents and
   hands its cells straight to it, which is the whole mechanism. The warning
   banner stays OUTSIDE that grid: a grid item spanning every column still feeds
   the column sizing, which stretched the Roll buttons to the width of a
   sentence. */
function hdCondensedHTML(pool){
  return `<div class="hd-grid">`+pool.map(p=>{
    const left=p.total-p.used;
    return `<div class="hd-row"><span class="hd-die">${p.die}</span><span class="hd-pips">${hdPips(p)}</span>`+
      `<span class="hd-left${left?"":" out"}" title="${left} of ${p.total} left">${left}/${p.total}</span>`+
      `<button class="hd-roll" data-hdroll="${p.die}" ${left?"":"disabled"} title="Spend one ${p.die} and heal">Roll</button></div>`;
  }).join("")+`</div>`;
}
/* FULL — a boxed cell per die size, speaking the same language as the Vitals
   strip and the Hit Points panel it now sits under. */
function hdFullHTML(pool){
  return `<div class="hd-boxes">`+pool.map(p=>{
    const left=p.total-p.used;
    return `<div class="hd-cell"><div class="hd-cd">${p.die}</div>`+
      `<div class="hd-cv">${left}<small> / ${p.total}</small></div>`+
      `<div class="hd-pips">${hdPips(p)}</div>`+
      `<button class="hd-roll" data-hdroll="${p.die}" ${left?"":"disabled"} title="Spend one ${p.die} and heal">Roll</button></div>`;
  }).join("")+`</div>`;
}
/* DICE — every die is its own token, so the die size, the pip and the count
   stop saying the same thing three times over. Tapping an unspent one rolls it;
   tapping a spent one puts it back, with the same "click pip i" semantics the
   other two styles have. The trade: there is no way to mark a die spent WITHOUT
   healing here. That is what the other two styles keep it for. */
function hdDiceHTML(pool){
  return `<div class="hd-dice">`+pool.map(p=>
    `<div class="hd-drow">`+Array.from({length:p.total},(_,i)=>{
      const spent=i<p.used;
      return `<button class="hd-d${spent?" spent":""}" data-hddie="${p.die}" data-i="${i+1}"`+
        ` title="${spent?"Spent — tap to put it back":"Tap to spend this "+p.die+" and heal"}"`+
        ` aria-label="${p.die}${spent?", spent":""}">${p.die.slice(1)}</button>`;
    }).join("")+`</div>`).join("")+
    `</div><p class="hint hd-foot">Tap a die to spend it and heal</p>`;
}
function rollHitDie(die){
  const p=hitDicePool().find(x=>x.die===die);if(!p||p.used>=p.total)return;
  const n=parseInt(die.slice(1),10)||8, c=contributions();
  /* abilFinal here, unlike level1HP's modOf: this value is consumed in the
     instant it is computed and never re-derived, so transient contributions are
     exactly what should count. Don't "harmonise" the two. */
  const conMod=Math.floor((abilFinal("con",c)-10)/2), roll=1+Math.floor(Math.random()*n), heal=Math.max(0,roll+conMod);
  adjustHP(heal);   /* positive: never touches temp, and clampHP caps it at the effective max */
  if(!character.hdUsed)character.hdUsed={};character.hdUsed[die]=num(character.hdUsed[die])+1;
  renderHP();
  renderHitDice();recompute();scheduleSave();
  restSummary("Hit die spent — "+die,[`Rolled ${roll} ${conMod>=0?"+":"−"} ${Math.abs(conMod)} CON = ${heal} HP`,`Current HP: ${character.hp.cur}`],"");
}
function recoverHitDice(){
  const pool=hitDicePool(), totalHD=pool.reduce((a,p)=>a+p.total,0);
  if(!totalHD)return 0;
  let recover=Math.min(pool.reduce((a,p)=>a+p.used,0), Math.max(1,Math.floor(totalHD/2))), got=0;
  for(const p of pool){if(recover<=0)break;const r=Math.min(p.used,recover);if(!character.hdUsed)character.hdUsed={};character.hdUsed[p.die]=Math.max(0,num(character.hdUsed[p.die])-r);recover-=r;got+=r;}
  return got;
}
/* ---- resources (Scrap, Rage, Ki, Sorcery Points, custom pools) ---- */
function resolveResMax(rd, level, c){
  const m=rd.max;
  if(typeof m==="number")return m;
  if(m&&Array.isArray(m.byLevel)){const i=Math.max(0,Math.min(level,m.byLevel.length)-1);return num(m.byLevel[i]);}
  if(m&&m.formula){
    const f=String(m.formula).toLowerCase();
    if(f==="level")return level;
    const mAbil=f.match(/^([a-z]{3})([+-]\d+)?$/);
    if(mAbil&&["str","dex","con","int","wis","cha"].includes(mAbil[1])){
      const mod=Math.floor((abilFinal(mAbil[1],c||contributions())-10)/2)+(mAbil[2]?parseInt(mAbil[2],10):0);
      return Math.max(1,mod);
    }
  }
  return 0;
}
function syncResources(){
  if(!Array.isArray(character.resources))character.resources=[];
  const c=contributions(), seen=new Set();
  function apply(defs, level, srcKind, srcName){
    (defs||[]).forEach(rd=>{
      if(!rd||!rd.name)return;
      const key=srcKind+":"+srcName+":"+String(rd.name).toLowerCase();
      const max=resolveResMax(rd, level, c);
      let r=character.resources.find(x=>x.key===key);
      if(max<=0){if(r)character.resources=character.resources.filter(x=>x!==r);return;}
      seen.add(key);
      if(!r){character.resources.push({id:uid(),key,name:rd.name,max,cur:max,per:rd.per||"long",auto:true,source:srcName});}
      else{r.name=rd.name;r.max=max;r.per=rd.per||"long";r.auto=true;r.source=srcName;if(num(r.cur)>max)r.cur=max;}
    });
  }
  (character.classes||[]).forEach(cl=>{
    const d=findClassDef(cl.name), lv=num(cl.level);
    if(d)apply(d.resources, lv, "class", cl.name);
    if(cl.subclass){const sc=subclassesFor(d)[cl.subclass];if(sc)apply(sc.resources, lv, "subclass", cl.name+":"+cl.subclass);}
  });
  character.resources=character.resources.filter(x=>!x.auto||seen.has(x.key));
}
function renderResources(){
  const el=document.getElementById("resList");if(!el)return;
  const list=character.resources||[];
  if(!list.length){el.innerHTML=`<div class="empty">No resources yet. Add pools like Rage, Ki, Sorcery Points, or Scrap — class resources appear here automatically.</div>`;return;}
  el.innerHTML=list.map(r=>{
    const cur=num(r.cur),max=num(r.max);
    return `<div class="res">
      <div class="res-main"><div class="res-name">${esc(r.name||"Resource")}${r.auto?`<span class="res-auto" title="Managed by ${esc(r.source||"class")}">auto</span>`:""}</div><div class="res-sub">${r.per&&r.per!=="none"?`resets on ${esc(r.per)} rest`:"manual reset"}</div></div>
      <button class="res-btn" data-res-dec="${r.id}" aria-label="Spend one">−</button>
      <div class="res-val"><b>${cur}</b><span>/${max}</span></div>
      <button class="res-btn" data-res-inc="${r.id}" aria-label="Gain one">+</button>
      <button class="icon" data-res-reset="${r.id}" title="Restore to full"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"/></svg></button>
      ${r.auto?"":`<button class="icon" data-res-edit="${r.id}" aria-label="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button><button class="icon danger" data-res-del="${r.id}" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>`}
    </div>`;
  }).join("");
}
function openResourceForm(existing){
  const r=existing||{id:uid(),name:"",max:1,cur:1,per:"long",auto:false};
  openModal(existing?"Edit resource":"New resource",`
    <div class="field"><label class="f">Name</label><input id="rName" value="${esc(r.name||"")}" placeholder="e.g. Sorcery Points" autocomplete="off"></div>
    <div class="g2"><div class="field"><label class="f">Max</label><input id="rMax" type="number" min="0" value="${num(r.max)||""}" placeholder="0"></div>
      <div class="field"><label class="f">Resets on</label><select id="rPer"><option value="long"${r.per==="long"?" selected":""}>Long rest</option><option value="short"${r.per==="short"?" selected":""}>Short rest</option><option value="none"${r.per==="none"?" selected":""}>Manual only</option></select></div></div>
    <div class="m-actions"><button class="tbtn" id="rCancel">Cancel</button><button class="tbtn primary" id="rSave">${existing?"Save":"Add"}</button></div>`);
  document.getElementById("rCancel").addEventListener("click",closeModal);
  document.getElementById("rSave").addEventListener("click",()=>{
    const max=Math.max(0,num(document.getElementById("rMax").value));
    const rec={id:r.id,name:document.getElementById("rName").value.trim()||"Resource",max,cur:existing?Math.min(num(r.cur),max):max,per:document.getElementById("rPer").value,auto:false};
    const i=character.resources.findIndex(x=>x.id===r.id);if(i>=0)character.resources[i]=rec;else character.resources.push(rec);
    closeModal();renderResources();scheduleSave();
  });
}
function resetResources(kinds){let n=0;(character.resources||[]).forEach(r=>{if(kinds.includes(r.per||"")){if(num(r.cur)<num(r.max))n++;r.cur=num(r.max);}});return n;}
function renderSlotBubbles(){
  const note=document.getElementById("slotAutoNote");
  if(note)note.textContent=slotsAuto?"Slots are set automatically from your caster level — level up or down to change them.":"";
  for(let lv=1;lv<=9;lv++){
    const s=character.slots[lv]||{total:0,used:0};
    const bub=document.getElementById("bub-"+lv);if(!bub)continue;bub.innerHTML="";
    const inp=document.querySelector(`[data-slot="${lv}"]`);if(inp){inp.readOnly=slotsAuto;inp.classList.toggle("autoslot",slotsAuto);inp.title=slotsAuto?"Set automatically from your caster level":"";if(document.activeElement!==inp)inp.value=s.total||"";}
    for(let i=1;i<=(s.total||0);i++){const b=document.createElement("button");b.className="b"+(i<=(s.used||0)?" used":"");b.dataset.slot=lv;b.dataset.i=i;bub.appendChild(b);}
    if(!s.total)bub.innerHTML=`<span style="font-family:var(--head);font-size:10px;color:var(--ink-soft)">—</span>`;
  }
}

