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
  const effMax=num(character.hp.max)+sumFx("hp.max",c), hadMax=effMax>0;
  if(hadMax)character.hp.cur=effMax;
  character.hp.temp="";
  character.death={succ:0,fail:0};
  let slotsBack=0;for(let lv=1;lv<=9;lv++){if(character.slots[lv]){slotsBack+=character.slots[lv].used||0;character.slots[lv].used=0;}}
  const hdBack=recoverHitDice();
  const featBack=resetFeatureUses(["short","long"]);
  const resBack=resetResources(["short","long"]);
  const ci=document.querySelector('[data-path="character.hp.cur"]');if(ci)ci.value=character.hp.cur;
  const ti=document.querySelector('[data-path="character.hp.temp"]');if(ti)ti.value="";
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
  restSummary("Short rest",lines.length?lines:["No resources auto-recover on a short rest for this character."],"Spend Hit Dice below to heal. Regular spell slots return on a long rest, not a short one.");
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
  // keep the Vitals field in sync with the pool
  if(!character.hdManual)character.hitdice=hdString(pool);
  const inp=document.getElementById("hitdiceInput"), modeBtn=document.querySelector("[data-hdmode]");
  if(inp){inp.readOnly=!character.hdManual;inp.classList.toggle("autoslot",!character.hdManual);if(!character.hdManual)inp.value=character.hitdice||"";}
  if(modeBtn){modeBtn.textContent=character.hdManual?"manual":"auto";modeBtn.classList.toggle("manual",character.hdManual);}
  const el=document.getElementById("hdWrap");if(!el)return;
  const warn=character.hdManual?`<div class="hd-warn">⚠ Manual Hit Dice — they won't follow your class when you level up. <button class="linkbtn" data-hdreset>Reset to class</button></div>`:"";
  if(!pool.length){el.innerHTML=warn;return;}
  el.innerHTML=`<div class="hd-title">Hit Dice</div>`+warn+pool.map(p=>{
    let pips="";for(let i=1;i<=p.total;i++)pips+=`<button class="hd-b ${i<=p.used?"used":""}" data-hd="${p.die}" data-i="${i}" aria-label="Hit die"></button>`;
    return `<div class="hd-row"><span class="hd-die">${p.total}${p.die}</span><span class="hd-pips">${pips}</span><button class="hd-roll" data-hdroll="${p.die}" ${p.used>=p.total?"disabled":""} title="Spend one ${p.die} and heal">🎲</button></div>`;
  }).join("");
}
function rollHitDie(die){
  const p=hitDicePool().find(x=>x.die===die);if(!p||p.used>=p.total)return;
  const n=parseInt(die.slice(1),10)||8, c=contributions();
  const conMod=Math.floor((abilFinal("con",c)-10)/2), roll=1+Math.floor(Math.random()*n), heal=Math.max(0,roll+conMod);
  const effMax=num(character.hp.max)+sumFx("hp.max",c);
  character.hp.cur=Math.min(effMax>0?effMax:1e9, num(character.hp.cur)+heal);
  if(!character.hdUsed)character.hdUsed={};character.hdUsed[die]=num(character.hdUsed[die])+1;
  const ci=document.querySelector('[data-path="character.hp.cur"]');if(ci)ci.value=character.hp.cur;
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

/* portrait */
function renderPortrait(){
  const el=document.getElementById("portrait");
  el.innerHTML=character.portraitImg?`<img src="${character.portraitImg}" alt="Portrait">`:`<div class="ph">No portrait yet</div>`;
}

let _adjWired=false,_adjSync=null;
/* One transaction across several denominations — "that costs 2gp 5sp" is a
   single action here rather than two edits, and it can't leave you halfway
   through if part of it would overdraw. */
function openCoinAdjust(){
  const keys=coinKeys();
  const rows=keys.map(k=>{
    const d=COIN_ALL.find(x=>x[0]===k);
    return `<div class="coin"><label title="${d[2]}">${d[1]}</label>
      <input type="text" inputmode="tel" data-adj="${k}" placeholder="0"
             aria-label="Adjust ${d[2]} — e.g. 10 to gain, -5 to spend"></div>`;
  }).join("");
  openModal("Adjust coins",`
    <p class="hint">How many of each you gained. Use a minus to spend: <b>-5</b>.</p>
    <div class="coins">${rows}</div>
    <p class="hint" id="adjPrev" style="margin-top:10px"></p>
    <div class="m-actions"><button class="tbtn" id="adjCancel" type="button">Cancel</button>
      <button class="tbtn primary" id="adjGo" type="button">Apply</button></div>`);
  const boxes=()=>[...document.querySelectorAll("#mBody [data-adj]")];
  const prev=document.getElementById("adjPrev"), go=document.getElementById("adjGo");
  /* Work out the whole transaction before applying any of it. */
  const plan=()=>{
    const out={},bad=[];let any=false;
    boxes().forEach(b=>{
      const k=b.dataset.adj, raw=String(b.value).replace(/[\s,]/g,"").replace(/[−–—]/g,"-");
      if(!raw)return;
      if(!/^[+-]?\d+$/.test(raw)){bad.push(COIN_ALL.find(x=>x[0]===k)[1]);return;}
      const delta=parseInt(raw,10);
      if(!delta)return;
      any=true;
      const now=num((character.coins||{})[k]);
      out[k]={delta,now,next:now+delta};
    });
    return {out,bad,any};
  };
  const sync=()=>{
    const {out,bad,any}=plan();
    const over=Object.keys(out).filter(k=>out[k].next<0);
    if(bad.length){prev.textContent="Not a number: "+bad.join(", ");go.disabled=true;return;}
    if(over.length){
      prev.textContent="You don't have enough "+
        over.map(k=>`${COIN_ALL.find(x=>x[0]===k)[1]} (have ${out[k].now}, spending ${-out[k].delta})`).join(", ")+
        ". Auto-convert first, or use a bigger coin.";
      go.disabled=true;return;
    }
    go.disabled=!any;
    prev.textContent=any
      ? "After: "+Object.keys(out).map(k=>`${out[k].next} ${COIN_ALL.find(x=>x[0]===k)[1]}`).join(", ")
      : "Enter an amount to see the result.";
  };
  /* #mBody is the shared modal body and outlives this modal — one delegated
     listener installed once, not a new one every time Adjust is opened. Same
     guard as the update review list. */
  _adjSync=sync;
  if(!_adjWired){
    document.getElementById("mBody").addEventListener("input",e=>{
      if(e.target&&e.target.matches&&e.target.matches("[data-adj]")&&_adjSync)_adjSync();
    });
    _adjWired=true;
  }
  sync();
  document.getElementById("adjCancel").addEventListener("click",closeModal);
  go.addEventListener("click",()=>{
    const {out}=plan();
    character.coins=character.coins||{};
    Object.keys(out).forEach(k=>{character.coins[k]=out[k].next;});
    closeModal();renderCoins();scheduleSave();
  });
}
/* push whole character into DOM */
function convertCoins(){
  // value of each coin in copper; electrum counts as input but isn't generated as output
  const VAL={cp:1,sp:10,ep:50,gp:100,pp:1000};
  let total=0;["cp","sp","ep","gp","pp"].forEach(k=>{total+=num((character.coins||{})[k])*VAL[k];});
  const out=(character.system==="dnd")?[["pp",1000],["gp",100],["sp",10],["cp",1]]:[["gp",100],["sp",10],["cp",1]];
  const res={cp:"",sp:"",ep:"",gp:"",pp:""};
  out.forEach(([k,v])=>{const n=Math.floor(total/v);total-=n*v;res[k]=n>0?n:"";});
  character.coins=res;renderCoins();scheduleSave();
}
const COIN_ALL=[["cp","CP","Copper"],["sp","SP","Silver"],["ep","EP","Electrum"],
                ["gp","GP","Gold"],["pp","PP","Platinum"]];
/* Electrum is a D&D-only oddity; Humblewood doesn't use it. */
function coinKeys(){return (character.system==="dnd")?["cp","sp","ep","gp","pp"]:["cp","sp","gp"];}

/* What a coin box should become, given what was typed into it.
     "12"  -> set to 12          "+10" -> add           "-5" -> spend
     ""    -> cleared            anything else -> null (caller puts it back)
   Signed entries are the point of this: during play you know what you SPENT,
   not what the new total is. Never goes below zero — you can't owe copper.
   Accepts the unicode minus too, since the on-screen hint shows one. */
function coinEntry(cur,raw){
  const s=String(raw==null?"":raw).trim().replace(/[−–—]/g,"-");
  if(!s)return "";
  /* Space is allowed after the sign ("+ 10") but NOT inside the digits: "1 2"
     is a slip, and quietly reading it as 12 is the sort of silent coercion
     that loses someone their gold. Unrecognised entries are rejected instead. */
  const digits=t=>/^\d+$/.test(t)||/^\d{1,3}(,\d{3})+$/.test(t) ? parseInt(t.replace(/,/g,""),10) : null;
  const m=/^([+-])\s*(\S+)$/.exec(s);
  if(m){
    const n=digits(m[2]);
    return n===null?null:Math.max(0,num(cur)+n*(m[1]==="-"?-1:1));
  }
  return digits(s);
}
function renderCoins(){
  const el=document.getElementById("coins");if(!el)return;
  /* NOT data-path: that handler writes on every keystroke, which would store
     "+" the moment you typed it and lose the number you were adding to. These
     apply on change (blur/Enter), once the entry is complete. inputmode="tel"
     rather than "numeric" because the numeric keypad on iOS has no sign keys. */
  el.innerHTML=coinKeys().map(k=>{
    const d=COIN_ALL.find(x=>x[0]===k);
    const v=(character.coins&&character.coins[k]!=null)?character.coins[k]:"";
    return `<div class="coin"><label title="${d[2]}">${d[1]}</label>`+
      `<input type="text" inputmode="tel" data-coin="${k}" value="${esc(v)}" placeholder="0" `+
      `aria-label="${d[2]} — type a number, or +10 / -5 to adjust"></div>`;
  }).join("");
}
/* Commit one coin box. Returns false if the entry made no sense. */
function applyCoinInput(inp){
  const k=inp.dataset.coin;if(!k)return true;
  character.coins=character.coins||{};
  const next=coinEntry(character.coins[k],inp.value);
  if(next===null){inp.value=(character.coins[k]!=null)?character.coins[k]:"";return false;}
  character.coins[k]=next;
  inp.value=next;
  scheduleSave();
  return true;
}
function renderAll(){
  renderCoins();
  document.querySelectorAll("[data-path]").forEach(inp=>{const v=get({character},inp.dataset.path);inp.value=(v===null||v===undefined)?"":v});
  renderPortrait();renderClassRace();renderFeatures();renderInventory();renderStatuses();renderFamiliars();ensureSpellAttacks();renderSpells();renderGloss();renderAllRT();recompute();
}

