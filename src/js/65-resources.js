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
    /* coins have weight, so a purse change moves carried weight and can move
       speed — re-render the inventory totals and recompute, not just the boxes */
    closeModal();renderCoins();renderInventory();recompute();scheduleSave();
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
  character.coins=res;renderCoins();renderInventory();recompute();scheduleSave();
}
const COIN_ALL=[["cp","CP","Copper"],["sp","SP","Silver"],["ep","EP","Electrum"],
                ["gp","GP","Gold"],["pp","PP","Platinum"]];
/* Electrum is a D&D-only oddity; Humblewood doesn't use it. */
function coinKeys(){return (character.system==="dnd")?["cp","sp","ep","gp","pp"]:["cp","sp","gp"];}

/* What a signed-entry box — coins, HP — should become, given what was typed.
     "12"  -> set to 12          "+10" -> add           "-5" -> spend
     ""    -> cleared            anything else -> null (caller puts it back)
   Signed entries are the point of this: during play you know what you SPENT or
   what damage you TOOK, not what the new total is. Never goes below zero — you
   can't owe copper, and you can't have less than no hit points.
   Accepts the unicode minus too, since the on-screen hint shows one.
   There is deliberately no upper bound here: HP has one and coins don't, and it
   isn't a property of the entry syntax anyway — see clampHP(). */
function signedEntry(cur,raw){
  const s=String(raw==null?"":raw).trim().replace(/[−–—]/g,"-");
  if(!s)return "";
  const m=/^([+-])\s*(\S+)$/.exec(s);
  if(m){
    const n=entryDigits(m[2]);
    return n===null?null:Math.max(0,num(cur)+n*(m[1]==="-"?-1:1));
  }
  return entryDigits(s);
}
/* Space is allowed after the sign ("+ 10") but NOT inside the digits: "1 2" is
   a slip, and quietly reading it as 12 is the sort of silent coercion that
   loses someone their gold. Unrecognised entries are rejected instead.
   Shared by signedEntry and signedDelta so the grammar can't drift between the
   two readings of the same typed box. */
function entryDigits(t){return /^\d+$/.test(t)||/^\d{1,3}(,\d{3})+$/.test(t) ? parseInt(t.replace(/,/g,""),10) : null;}
/* The signed half of signedEntry(), for the callers that need the DELTA rather
   than the result: "-7" -> -7, "+4" -> 4, and null for a bare total or anything
   unparseable. Damage has to know it was seven points, not that the box should
   end up reading three, because temporary HP is spent before Current is —
   signedEntry has already folded the delta away (and floored it at 0) by the
   time it returns. */
function signedDelta(raw){
  const m=/^([+-])\s*(\S+)$/.exec(String(raw==null?"":raw).trim().replace(/[−–—]/g,"-"));
  if(!m)return null;
  const n=entryDigits(m[2]);
  return n===null?null:n*(m[1]==="-"?-1:1);
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
  const next=signedEntry(character.coins[k],inp.value);
  if(next===null){inp.value=(character.coins[k]!=null)?character.coins[k]:"";return false;}
  character.coins[k]=next;
  inp.value=next;
  renderInventory();recompute();
  scheduleSave();
  return true;
}
/* Damage comes off TEMPORARY hit points first. Nothing in the app had ever
   spent them — they were stored, displayed and cleared on a long rest, and the
   player did the subtraction by hand. Healing never touches temp: temp HP is
   granted, not restored, so a positive delta goes straight to Current.
   Model + clamp only, no DOM — callers pair it with renderHP(), the same
   contract clampHP() has. It lives HERE rather than in 90-boot.js because the
   test harness drops that fragment: logic in it is untestable by construction,
   so 90-boot keeps the wiring and nothing else. */
function adjustHP(delta){
  let d=num(delta);
  if(d<0){
    const soak=Math.min(num(character.hp.temp),-d);
    if(soak>0){
      character.hp.temp=(num(character.hp.temp)-soak)||"";   /* spent out reads blank, as a long rest leaves it */
      d+=soak;
    }
  }
  if(d)character.hp.cur=num(character.hp.cur)+d;
  clampHP();
}
/* The HP boxes work exactly like the coin boxes and for the same reason: they
   are NOT data-path, because that handler commits on every keystroke and would
   store "-" the instant you typed it, losing the number you were subtracting
   from. They commit on change (blur/Enter), once the entry is finished. */
/* Which band Current HP falls in, as a class name — "" for none. Measured
   against the EFFECTIVE max, so an item that raises your maximum moves the
   thresholds with it. Temp is excluded: it sits ABOVE your maximum, so folding
   it in could read as healthy while your real pool is empty.
   No maximum set means no band at all — a blank new character must not open
   painted red. Pure, so the bands are testable without a DOM. */
function hpBand(){
  if(character.hpColor===false)return "";
  const mx=effMaxHP();if(mx<=0)return "";
  const pct=num(character.hp.cur)/mx*100;
  return (pct<=25)?"hp-danger":(pct<=50)?"hp-warn":"";
}
function renderHP(){
  ["cur","max","temp"].forEach(k=>{
    const el=document.getElementById("hp"+k[0].toUpperCase()+k.slice(1));
    if(el){const v=character.hp[k];el.value=(v===null||v===undefined)?"":v;}
  });
  const cur=document.getElementById("hpCur"),band=hpBand();
  if(cur){cur.classList.toggle("hp-warn",band==="hp-warn");cur.classList.toggle("hp-danger",band==="hp-danger");}
  /* Two layers, the same shape the auto spell-slot fields use: readOnly so the
     browser refuses the edit, AND a refusal in applyHPInput, because readOnly
     is only a hint — paste, autofill and any programmatic caller go straight
     past it. `!==false` rather than a truth test, so an object that never went
     through migrate() reads as locked rather than silently editable. */
  const locked=character.hp.locked!==false;
  const mx=document.getElementById("hpMax");if(mx)mx.readOnly=locked;
  const lk=document.querySelector("[data-hplock]");
  if(lk){
    lk.classList.toggle("open",!locked);
    lk.setAttribute("aria-pressed",locked?"true":"false");
    lk.title=locked?"Max HP is locked — tap to edit it":"Max HP is unlocked — tap to lock it";
  }
}
/* Commit one HP box. Returns false if the entry was refused. */
function applyHPInput(inp){
  const k=inp.dataset.hp;
  /* An explicit list, not `k in character.hp`: `locked` is a key on that object
     now, and a data-hp hook must never be able to write a boolean field. */
  if(k!=="cur"&&k!=="max"&&k!=="temp")return true;
  /* Max is locked by default, and the padlock is the only way a PLAYER changes
     it. renderHP has already made the box readOnly; this is the second layer,
     because readOnly does not stop a paste. The automatic writers
     (seedLevel1HP, resyncLevel1HP, removeClass's un-seed — all 56-class.js) go
     to the model directly and BYPASS this on purpose: routing them through here
     would leave a locked level-1 character with no hit points at all. */
  if(k==="max"&&character.hp.locked!==false){renderHP();return false;}
  /* A negative typed into Current OR Temp IS damage, and goes through the one
     damage path: temp first, then the overflow into current. Typing -5 against
     3 temp has to leave you 2 down on current, not throw the extra away, and it
     must mean the same thing whichever of the two boxes you happened to type it
     in. Everything else — a heal, a bare total, anything in the Max box, where
     a negative is you lowering your maximum — stays a plain edit to the box you
     typed in. Junk like "+ab" reads as null and is rejected below. */
  const dmg=(k==="cur"||k==="temp")?signedDelta(inp.value):null;
  if(dmg!==null&&dmg<0){adjustHP(dmg);renderHP();scheduleSave();return true;}
  const next=signedEntry(character.hp[k],inp.value);
  if(next===null){renderHP();return false;}   /* reject: put the model's value back */
  character.hp[k]=next;
  clampHP();renderHP();
  if(k==="max")recompute();   /* what data-recompute did; nothing is derived from cur/temp */
  scheduleSave();
  return true;
}
function renderAll(){
  renderCoins();renderHP();   /* neither is data-path, so neither is in the loop below */
  document.querySelectorAll("[data-path]").forEach(inp=>{const v=get({character},inp.dataset.path);inp.value=(v===null||v===undefined)?"":v});
  /* renderTables belongs here for the same reason renderGloss does: both draw
     from the rules pool, not the character, so loading a sheet with rules
     already cached has to draw them. Leaving it out meant the Tables tab was
     blank after a refresh until you typed in its filter box. */
  renderPortrait();renderClassRace();renderFeatures();renderInventory();renderStatuses();renderFamiliars();ensureSpellAttacks();renderSpells();renderGloss();renderTables();renderNoteIcons();renderNotes();renderAllRT();recompute();
}

