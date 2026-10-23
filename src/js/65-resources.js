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
/* Items recover their limited uses on a rest exactly as features do, and carry
   the same {max, per, used} shape so usesMax() and the pips read both without a
   second implementation. `per:"none"` is a charge that no rest brings back (a
   wand recharging at dawn is not a rest) — it is left alone here, and the
   player taps its pips to reset it. */
function resetItemUses(kinds){
  let n=0;(character.inventory||[]).forEach(it=>{if(it.uses&&kinds.includes(it.uses.per||"")){if(it.uses.used){n++;}it.uses.used=0;}});
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
  const itemBack=resetItemUses(["short","long"]);
  const resBack=resetResources(["short","long"]);
  renderHP();
  renderDeath();renderFeatures();renderInventory();recompute();scheduleSave();
  const lines=[
    hadMax?`Current HP restored to ${effMax}`:"HP unchanged — set a Max HP first",
    "Temporary HP cleared",
    slotsBack?`${slotsBack} spell slot${slotsBack===1?"":"s"} recovered`:"Spell slots already full",
    "Death saves cleared"
  ];
  if(hitDicePool().length)lines.push(hdBack?`${hdBack} Hit ${hdBack===1?"Die":"Dice"} recovered (half your total)`:"Hit Dice already full");
  if(featBack)lines.push(`${featBack} feature use tracker${featBack===1?"":"s"} reset`);
  if(itemBack)lines.push(`${itemBack} item use tracker${itemBack===1?"":"s"} reset`);
  if(resBack)lines.push(`${resBack} resource${resBack===1?"":"s"} restored`);
  renderResources();
  restSummary("Long rest complete",lines,"");
}
function shortRest(){
  const wl=warlockLevel();let pactBack=0,pactMsg="";
  if(wl>0){const p=PACT[Math.min(20,wl)];if(p&&character.slots[p[1]]){const before=character.slots[p[1]].used||0;character.slots[p[1]].used=Math.max(0,before-p[0]);pactBack=before-character.slots[p[1]].used;pactMsg=pactBack?`${pactBack} pact slot${pactBack===1?"":"s"} recovered (level ${p[1]})`:"Pact slots already full";}}
  const featBack=resetFeatureUses(["short"]);
  const itemBack=resetItemUses(["short"]);
  const resBack=resetResources(["short"]);
  renderFeatures();renderInventory();renderResources();recompute();scheduleSave();
  const lines=[];if(pactMsg)lines.push(pactMsg);if(featBack)lines.push(`${featBack} short-rest feature tracker${featBack===1?"":"s"} reset`);if(itemBack)lines.push(`${itemBack} short-rest item tracker${itemBack===1?"":"s"} reset`);if(resBack)lines.push(`${resBack} short-rest resource${resBack===1?"":"s"} restored`);
  restSummary("Short rest",lines.length?lines:["No resources auto-recover on a short rest for this character."],"Spend Hit Dice from the Rest & Recovery card to heal. Regular spell slots return on a long rest, not a short one.");
}
/* ---- hit dice pool (derived from class hit die × level) ---- */
function hitDicePool(){
  const totals={},classesByDie={};
  if(character.hdManual){
    const re=/(\d+)\s*(d\d+)/gi;let mm;
    while((mm=re.exec(character.hitdice||""))){const die=mm[2].toLowerCase();totals[die]=(totals[die]||0)+parseInt(mm[1],10);}
  }else{
    /* classesByDie: a multiclass sheet can have two classes sharing one die
       size, so this is every contributing class name, not one — the spend
       box's row joins them with " / " rather than picking just the first. */
    (character.classes||[]).forEach(c=>{const d=findClassDef(c.name);const die=d&&d.hitDie;if(die){totals[die]=(totals[die]||0)+num(c.level);(classesByDie[die]=classesByDie[die]||[]).push(c.name);}});
  }
  const order=["d12","d10","d8","d6","d4","d20"];
  return Object.keys(totals).sort((a,b)=>order.indexOf(a)-order.indexOf(b)).map(die=>({die,total:totals[die],used:Math.min(totals[die],num((character.hdUsed||{})[die])),cls:(classesByDie[die]||[]).join(" / ")}));
}
function hdString(pool){return pool.map(p=>p.total+p.die).join(" + ");}
function renderHitDice(){
  const pool=hitDicePool();
  /* One function for both halves — the auto-mode write and the bar it draws
     into #hdWrap. They can't be split: this write feeds the pool below it, and
     no caller ever wants only one of them. */
  if(!character.hdManual)character.hitdice=hdString(pool);
  /* #hitdiceInput and the mode pill now live inside the spend box (#103),
     rebuilt fresh by hdSpendHTML() each time it opens — but the box can stay
     open across a mode toggle, so this keeps patching whichever copy is
     currently in the document, same as before the box existed. `.hidden` is
     the IDL property, not style.display: a cleared inline style would NOT
     override the markup's own `hidden` attribute, because the UA stylesheet's
     [hidden]{display:none} rule would still apply underneath it. */
  const inp=document.getElementById("hitdiceInput"), modeBtn=document.querySelector("[data-hdmode]");
  if(inp){inp.readOnly=!character.hdManual;inp.hidden=!character.hdManual;if(!character.hdManual)inp.value=character.hitdice||"";}
  if(modeBtn){modeBtn.textContent=character.hdManual?"manual":"auto";modeBtn.classList.toggle("manual",character.hdManual);}
  const el=document.getElementById("hdWrap");if(!el)return;
  const warn=character.hdManual?`<div class="hd-warn">⚠ Manual Hit Dice — they won't follow your class when you level up. <button class="linkbtn" data-hdreset>Reset to class</button></div>`:"";
  if(!pool.length){
    el.innerHTML=warn+`<p class="hint hd-none">${character.hdManual?"Type your dice above, e.g. 2d8 + 1d6.":"Add a class and your Hit Dice appear here. Or switch to manual and type them in."}</p>`;
    return;
  }
  el.innerHTML=warn+hdBarHTML(pool,hdConMod());
}
/* ---- #103: the hit-dice bar and the spend box ----
   One bar per character; tapping it opens the box. The maths is the old
   rollHitDie()'s, shared now by both ways of spending — rolling for you and
   typing your own roll. */
const HD_NONE_LEFT="No hit dice left — a long rest restores them.";
function hdConMod(){return Math.floor((abilFinal("con",contributions())-10)/2);}
function hdHeal(roll,conMod){return Math.max(0,roll+conMod);}
function hdSpendCheck(die,typed){
  const n=parseInt(String(die).slice(1),10)||8, s=String(typed==null?"":typed).trim();
  if(!/^\d+$/.test(s))return {ok:false,roll:0,why:"Type the number you rolled."};
  const r=parseInt(s,10);
  if(r<1||r>n)return {ok:false,roll:r,why:`A ${die} rolls 1 to ${n}.`};
  return {ok:true,roll:r,why:""};
}
function hdBarHTML(pool,conMod){
  const left=pool.reduce((a,p)=>a+(p.total-p.used),0),total=pool.reduce((a,p)=>a+p.total,0);
  const dice=pool.map(p=>`${esc(p.die)} · ${esc(String(p.total-p.used))} / ${esc(String(p.total))}`).join(" &nbsp; ");
  const pct=total?Math.round(100*left/total):0;
  return `<div class="hd-lbl">Hit dice <span class="hd-con">CON ${conMod>=0?"+":"−"}${esc(String(Math.abs(conMod)))}</span></div>`+
    `<button type="button" class="hd-bar" data-hdspend aria-label="Spend a hit die"><i style="width:${esc(String(pct))}%"></i><span>${dice}</span></button>`;
}
function hdSpendHTML(pool,sel,conMod,cur,max){
  /* #103 fix round 1 (minor): the fallback in openHdSpend() can leave `sel`
     pointing at an exhausted die (none left at all, anywhere in the pool) —
     Roll for me and the typed box would otherwise sit there clickable and do
     nothing. Disabled, with the reason said up front rather than only after
     a tap goes nowhere. */
  const selP=pool.find(p=>p.die===sel), none=!selP||selP.total<=selP.used;
  const rows=pool.map(p=>{const left=p.total-p.used;
    return `<div class="hd-pick${p.die===sel?" on":""}"><button type="button" class="hd-pickbtn" data-hdpick="${esc(p.die)}"${left?"":" disabled"}>`+
      `<b>${esc(p.die)}</b> ${esc(p.cls||"")} · ${esc(String(left))} / ${esc(String(p.total))}</button>`+
      `<span class="hd-used">used <button type="button" class="tbtn" data-hdused="${esc(p.die)}" data-d="-1" aria-label="${esc("Un-spend a "+p.die)}">−</button>`+
      `<button type="button" class="tbtn" data-hdused="${esc(p.die)}" data-d="1" aria-label="${esc("Mark a "+p.die+" spent")}">+</button></span></div>`;}).join("");
  return rows+
    `<div class="hd-how"><button type="button" class="tbtn primary" id="hdRollMe"${none?" disabled":""}>🎲 Roll for me</button> <span>or</span> `+
    `<label>I rolled <input id="hdTyped" inputmode="numeric" size="3"${none?" disabled":""}></label> <button type="button" class="tbtn" id="hdApply" disabled>Apply</button></div>`+
    `<div class="hd-res" id="hdRes" aria-live="polite">${none?HD_NONE_LEFT:""}</div>`+
    `<div class="hd-foot">Hit dice <button class="hd-mode" data-hdmode title="Toggle auto (from class) vs manual">${character.hdManual?"manual":"auto"}</button> `+
    `<input data-path="character.hitdice" id="hitdiceInput" placeholder="3d10" value="${esc(character.hitdice||"")}"${character.hdManual?"":" readonly hidden"} aria-label="Hit Dice"></div>`;
}
/* Opens the box. `sel` is which die row is picked — kept across a re-open so
   a used +/-, or picking a different die, doesn't lose the player's place.
   Defaults to the first die with any left, so Roll/Apply are reachable
   without a tap first. */
function openHdSpend(sel){
  const pool=hitDicePool();
  if(!pool.some(p=>p.die===sel))sel=(pool.find(p=>p.total>p.used)||pool[0]||{}).die;
  openModal("Spend a hit die",hdSpendHTML(pool,sel,hdConMod(),character.hp.cur,effMaxHP()));
  const body=document.getElementById("mBody");if(!body)return;
  body.querySelectorAll("[data-hdpick]").forEach(b=>b.addEventListener("click",()=>openHdSpend(b.dataset.hdpick)));
  /* Marking a die used/unused here never heals — that's what Roll/Apply are
     for. Clamped 0..total so a stray extra tap can't go negative or past the
     pool's own size. */
  body.querySelectorAll("[data-hdused]").forEach(b=>b.addEventListener("click",()=>{
    const die=b.dataset.hdused,p=hitDicePool().find(x=>x.die===die);if(!p)return;
    if(!character.hdUsed)character.hdUsed={};
    character.hdUsed[die]=Math.max(0,Math.min(p.total,num(character.hdUsed[die])+num(b.dataset.d)));
    renderHitDice();scheduleSave();openHdSpend(sel);
  }));
  const typed=document.getElementById("hdTyped"),res=document.getElementById("hdRes"),apply=document.getElementById("hdApply");
  /* Belt and braces alongside hdSpendHTML's disabled Roll-for-me/typed box:
     #hdTyped is disabled when `sel` has none left, so this branch is normally
     unreachable from a real click — but Apply must never be talked into
     enabling itself for a die with nothing left, from here or anywhere else. */
  const check=()=>{
    const p=hitDicePool().find(x=>x.die===sel);
    if(!p||p.total<=p.used){if(apply)apply.disabled=true;if(res)res.textContent=HD_NONE_LEFT;return {ok:false,roll:0,why:HD_NONE_LEFT};}
    const r=hdSpendCheck(sel,typed.value);
    if(apply)apply.disabled=!r.ok;
    if(res){
      if(r.ok){
        const conMod=hdConMod(),heal=hdHeal(r.roll,conMod),mx=effMaxHP(),cr=num(character.hp.cur);
        const capped=mx>0?Math.min(cr+heal,mx):cr+heal;
        res.textContent=`${r.roll} + CON ${conMod} = ${heal} HP → ${capped} / ${mx}`;
      }else res.textContent=r.why;
    }
    return r;
  };
  if(typed)typed.addEventListener("input",check);
  /* No closeModal() here: spendHitDie() (which rollHitDie() also calls) ends in
     restSummary(), which OPENS the "Hit die spent" modal in this one's place —
     closing right after would close THAT one before the player ever saw it. */
  if(apply)apply.addEventListener("click",()=>{const r=check();if(r.ok)spendHitDie(sel,r.roll);});
  const rollMe=document.getElementById("hdRollMe");if(rollMe)rollMe.addEventListener("click",()=>rollHitDie(sel));
}
/* Spend one `die` with this roll: mark it used, heal through adjustHP, report. */
function spendHitDie(die,roll){
  const p=hitDicePool().find(x=>x.die===die);if(!p||p.used>=p.total)return;
  const conMod=hdConMod(),heal=hdHeal(roll,conMod);
  adjustHP(heal);
  if(!character.hdUsed)character.hdUsed={};character.hdUsed[die]=num(character.hdUsed[die])+1;
  renderHP();renderHitDice();recompute();scheduleSave();
  restSummary("Hit die spent — "+die,[`Rolled ${roll} ${conMod>=0?"+":"−"} ${Math.abs(conMod)} CON = ${heal} HP`,`Current HP: ${character.hp.cur}`],"");
}
function rollHitDie(die){const n=parseInt(String(die).slice(1),10)||8;spendHitDie(die,1+Math.floor(Math.random()*n));}
/* ---- dice expressions (item healing) ----
   Parsing is kept apart from rolling on purpose: parseDiceExpr is pure and
   total, so every accepted and rejected spelling can be asserted, and
   rollDiceExpr is the only part that touches Math.random.
   Accepts what a player would actually type — "2d4+2", "1d8", "d6", "10",
   "1d4 + 1d6" — and returns null for anything else rather than guessing. A
   mis-read expression would hand out the wrong hit points silently, so the item
   editor refuses to save one instead. */
function parseDiceExpr(str){
  const s=String(str==null?"":str).toLowerCase().replace(/[−–—]/g,"-").replace(/\s+/g,"");
  if(!s||!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(s))return null;
  const parts=s.match(/[+-]?(?:\d*d\d+|\d+)/g)||[];
  const dice=[];let mod=0;
  for(const p of parts){
    const sign=p.charAt(0)==="-"?-1:1, body=p.replace(/^[+-]/,""), m=/^(\d*)d(\d+)$/.exec(body);
    if(m){
      const n=(m[1]===""?1:parseInt(m[1],10)), sides=parseInt(m[2],10);
      /* A typo like 999d999 is not a heal anyone meant; refusing is better than
         rolling for a second and returning a number nobody can check. */
      if(n<1||n>100||sides<2||sides>1000)return null;
      dice.push({n,sides,sign});
    }else mod+=sign*parseInt(body,10);
  }
  return {dice,mod};
}
/* Just the dice half, written back out — the label on the "what did you roll"
   box, so the player is told which dice to pick up. */
function diceExprDice(p){
  if(!p||!p.dice.length)return "";
  return p.dice.map((d,i)=>(i?(d.sign<0?" - ":" + "):(d.sign<0?"-":""))+d.n+"d"+d.sides).join("");
}
function diceExprText(p){
  if(!p)return "";
  const d=diceExprDice(p);
  if(!d)return String(p.mod);
  return d+(p.mod?(p.mod<0?" - "+Math.abs(p.mod):" + "+p.mod):"");
}
/* Roll every group, keeping the individual faces so the summary can show its
   working — "rolled 3, 4 + 2 = 9" is checkable at the table; a bare 9 is not. */
function rollDiceExpr(p){
  if(!p)return null;
  const rolls=[];let total=p.mod;
  p.dice.forEach(d=>{
    const values=[];
    for(let i=0;i<d.n;i++){const v=1+Math.floor(Math.random()*d.sides);values.push(v);total+=v*d.sign;}
    rolls.push({n:d.n,sides:d.sides,sign:d.sign,values});
  });
  return {rolls,total,faces:rolls.reduce((a,r)=>a.concat(r.values),[])};
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
/* The die a pool's points ARE, when they are dice: Superiority Dice are d8,
   d10 from level 10 and d12 from 18 while their COUNT follows its own table, so
   the two cannot share `max`. Same shapes as max — a byLevel array of sides, or
   a fixed die written 8 or "d8" — and "" for a pool that is just points. */
function resolveResDie(rd, level){
  const d=rd&&rd.die;if(d==null)return "";
  let n=0;
  if(typeof d==="number"||typeof d==="string")n=num(String(d).replace(/^d/i,""));
  else if(Array.isArray(d.byLevel)){const i=Math.max(0,Math.min(level,d.byLevel.length)-1);n=num(d.byLevel[i]);}
  return n>0?"d"+n:"";
}
function syncResources(){
  if(!Array.isArray(character.resources))character.resources=[];
  const c=contributions(), seen=new Set();
  function apply(defs, level, srcKind, srcName){
    (defs||[]).forEach(rd=>{
      if(!rd||!rd.name)return;
      const key=srcKind+":"+srcName+":"+String(rd.name).toLowerCase();
      const max=resolveResMax(rd, level, c), die=resolveResDie(rd, level);
      let r=character.resources.find(x=>x.key===key);
      if(max<=0){if(r)character.resources=character.resources.filter(x=>x!==r);return;}
      seen.add(key);
      if(!r){r={id:uid(),key,name:rd.name,max,cur:max,per:rd.per||"long",auto:true,source:srcName};character.resources.push(r);}
      else{r.name=rd.name;r.max=max;r.per=rd.per||"long";r.auto=true;r.source=srcName;if(num(r.cur)>max)r.cur=max;}
      if(die)r.die=die;else delete r.die;
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
      <div class="res-main"><div class="res-name">${esc(r.name||"Resource")}${r.die?`<span class="res-die" title="Each is a ${esc(r.die)}">${esc(r.die)}</span>`:""}${r.auto?`<span class="res-auto" title="Managed by ${esc(r.source||"class")}">auto</span>`:""}</div><div class="res-sub">${r.per&&r.per!=="none"?`resets on ${esc(r.per)} rest`:"manual reset"}</div></div>
      <button class="res-btn" data-res-dec="${esc(r.id)}" aria-label="Spend one">−</button>
      <div class="res-val"><b>${cur}</b><span>/${max}</span></div>
      <button class="res-btn" data-res-inc="${esc(r.id)}" aria-label="Gain one">+</button>
      <button class="icon" data-res-reset="${esc(r.id)}" title="Restore to full"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"/></svg></button>
      ${r.auto?"":`<button class="icon ed" data-res-edit="${esc(r.id)}" aria-label="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button><button class="icon danger ed" data-res-del="${esc(r.id)}" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>`}
    </div>`;
  }).join("");
}
function openResourceForm(existing){
  const r=existing||{id:uid(),name:"",max:1,cur:1,per:"long",auto:false};
  openModal(existing?"Edit resource":"New resource",`
    <div class="field"><label class="f">Name</label><input id="rName" value="${esc(r.name||"")}" placeholder="e.g. Sorcery Points" autocomplete="off"></div>
    <div class="g2"><div class="field"><label class="f">Max</label><input id="rMax" type="number" min="0" value="${esc(num(r.max)||"")}" placeholder="0"></div>
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

