/* ================= initiative tracker (#91) =================
   The fight's order, saved with the character while combatActive is true
   (cleared by combatEnd()). The array order IS the turn order; initSort()
   re-sorts it, stable, when an initiative changes. Bands: 0 Healthy,
   1 Injured, 2 Bloodied, 3 Near death, 4 Dead, null not set. Spec:
   src/docs/specs/2026-10-25-initiative-tracker-design.md. */
const HB_NAMES=["Healthy","Injured","Bloodied","Near death","Dead"];
const HB_SAYS=['"untouched", "fresh"','"barely hurt", "a few scratches"','"badly hurt", half or less','"almost dead", "barely standing"',"struck out; Next skips it"];
function initInt(v){const s=String(v==null?"":v).trim();return /^-?\d+$/.test(s)?parseInt(s,10):null;}
function initOpt(v){const n=initInt(v);return (n===null||n<0)?"":n;}
/* A missing or repeated id gets a fresh one (final review m4): two rows
   sharing an id would open one dialog for both, and Remove would take both. */
function initFreshId(id,seen){let s=id==null?"":String(id);if(!s||seen.has(s))s=uid();seen.add(s);return s;}
function cleanParty(v){
  const seen=new Set();
  return (Array.isArray(v)?v:[]).filter(p=>p&&typeof p==="object"&&String(p.name||"").trim())
    .map(p=>({id:initFreshId(p.id,seen),name:String(p.name).trim().slice(0,60),ac:initOpt(p.ac),maxHp:initOpt(p.maxHp)}));
}
function cleanCombatants(v,active){
  if(!active)return [];
  let you=false;const out=[],seen=new Set();
  (Array.isArray(v)?v:[]).forEach(r=>{
    if(!r||typeof r!=="object"||["you","party","foe"].indexOf(r.kind)<0)return;
    if(r.kind==="you"){if(you)return;you=true;}
    const party=r.kind==="party",band=(Number.isInteger(r.band)&&r.band>=0&&r.band<=4)?r.band:null,maxHp=party?initOpt(r.maxHp):"";
    /* never a blank chip: your row reads your sheet's name, the rest a fallback */
    const nm=String(r.name==null?"":r.name).trim().slice(0,60)||(r.kind==="foe"?"Unnamed":r.kind==="party"?"Party member":"");
    out.push({id:initFreshId(r.id,seen),kind:r.kind,name:nm,init:initInt(r.init),
      ac:r.kind==="you"?"":initOpt(r.ac),
      track:party?((r.track==="exact"||r.track==="estimate")?r.track:(maxHp!==""?"exact":"estimate")):"",
      band:r.kind==="you"?null:band,hp:party?initOpt(r.hp):"",maxHp,dead:party&&r.dead===true,partyId:party?String(r.partyId||""):""});
  });
  return out;
}
function combatantDead(r){return !!r&&(r.kind==="foe"?r.band===4:(r.kind==="party"?r.dead===true:false));}
function initSort(list){
  return list.map((r,i)=>({r,i})).sort((a,b)=>{
    const x=a.r.init,y=b.r.init;
    if(x===y)return a.i-b.i;if(x===null)return 1;if(y===null)return -1;return y-x;
  }).map(o=>o.r);
}
function initFirstAlive(list){const r=(list||[]).find(x=>!combatantDead(x));return r?r.id:"";}
/* The next living row after turnId. Passing the end is a wrap: the caller
   advances the round once. An unknown actor starts at the top, no wrap. */
function initNextTurn(list,turnId){
  const n=list.length;if(!n)return {turnId:"",wrapped:false};
  const i=list.findIndex(r=>r.id===turnId);
  if(i<0)return {turnId:initFirstAlive(list),wrapped:false};
  for(let j=i+1;j<n;j++)if(!combatantDead(list[j]))return {turnId:list[j].id,wrapped:false};
  for(let j=0;j<=i;j++)if(!combatantDead(list[j]))return {turnId:list[j].id,wrapped:true};
  return {turnId:list[i].id,wrapped:true};
}
function bandOfShare(hp,max){
  const m=num(max),h=num(hp);if(!(m>0))return null;
  if(h>=m)return 0;if(h>m/2)return 1;if(h>m/4)return 2;return 3;
}
/* What a chip's bar shows: a share (you; a party member on Exact with a
   max) coloured by its band, or a band alone, or nothing known (band null). */
function combatantBar(r){
  if(r.kind==="you"){const m=effMaxHP(),h=num(character.hp.cur);return {band:bandOfShare(h,m),share:m>0?Math.max(0,Math.min(1,h/m)):null};}
  if(r.kind==="party"&&r.track==="exact")return num(r.maxHp)>0?{band:bandOfShare(r.hp,r.maxHp),share:Math.max(0,Math.min(1,num(r.hp)/num(r.maxHp)))}
    :{band:null,share:null};   /* Exact with no max: no share to draw, and an Estimate band left over would be stale */
  return {band:r.band===4?null:r.band,share:null};
}
/* Your typed d20: the face, 1..20, as the spend box takes 1..die. */
function initRollCheck(raw){
  const s=String(raw==null?"":raw).trim();
  if(!/^\d+$/.test(s))return {ok:false,face:0,why:"Type the number you rolled."};
  const f=parseInt(s,10);
  if(f<1||f>20)return {ok:false,face:f,why:"A d20 rolls 1 to 20."};
  return {ok:true,face:f,why:""};
}
/* "14 + 3 = 17"; with advantage "Rolled 6, 14 → 14 + 3 = 17". */
function initRollLine(faces,mod){
  const hi=Math.max.apply(null,faces),m=num(mod),t=hi+m;
  const w=`${hi} ${m<0?"−":"+"} ${Math.abs(m)} = ${t}`;
  return faces.length>1?`Rolled ${faces.join(", ")} → ${w}`:w;
}
function initModOf(){
  const c=contributions(),dex=Math.floor((abilFinal("dex",c)-10)/2);
  return (character.init===""?dex:num(character.init))+sumFx("init",c)+sumFx("check",c);
}
function youAC(){const c=contributions();return armorAC(c).base+sumFx("ac",c);}
/* you: {name, init}; party: [{id,name,ac,maxHp,init}]; foes: [{name,count,ac,init}] */
function buildCombatants(you,party,foes){
  const rows=[{id:uid(),kind:"you",name:String(you.name||""),init:initInt(you.init),ac:"",track:"",band:null,hp:"",maxHp:"",dead:false,partyId:""}];
  (party||[]).forEach(p=>{const mx=initOpt(p.maxHp);rows.push({id:uid(),kind:"party",name:String(p.name).slice(0,60),init:initInt(p.init),ac:initOpt(p.ac),
    track:mx!==""?"exact":"estimate",band:null,hp:mx,maxHp:mx,dead:false,partyId:String(p.id||"")});});
  (foes||[]).forEach(f=>{
    const name=String(f.name||"").trim().slice(0,56);if(!name)return;
    const n=Math.max(1,Math.min(20,initInt(f.count)||1));
    for(let k=1;k<=n;k++)rows.push({id:uid(),kind:"foe",name:n>1?`${name} ${k}`:name,init:initInt(f.init),ac:initOpt(f.ac),track:"",band:null,hp:"",maxHp:"",dead:false,partyId:""});
  });
  return initSort(rows);
}

/* ---- the Party card (Bio) ---- */
function partyRowsHTML(list){
  if(!list.length)return `<p class="empty">Add the friends who fight beside you. They join every fight you start.</p>`;
  return `<div class="party-list">`+list.map(p=>`<div class="party-row"><span class="party-nm">${esc(p.name)}</span>`+
    (p.ac!==""?`<span class="party-k">AC ${esc(String(p.ac))}</span>`:"")+(p.maxHp!==""?`<span class="party-k">HP ${esc(String(p.maxHp))}</span>`:"")+
    `<button class="icon ed" data-partyedit="${esc(p.id)}" aria-label="${esc("Edit "+p.name)}"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>`+
    `<button class="icon danger ed" data-partydel="${esc(p.id)}" aria-label="${esc("Remove "+p.name)}"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button></div>`).join("")+`</div>`;
}
function renderParty(){const el=document.getElementById("partyList");if(el)el.innerHTML=partyRowsHTML(cleanParty(character.party));}
function savePartyMember(id,name,ac,maxHp){
  const nm=String(name||"").trim().slice(0,60);if(!nm)return "Give them a name.";
  const list=cleanParty(character.party),row={id:id||uid(),name:nm,ac:initOpt(ac),maxHp:initOpt(maxHp)};
  const i=list.findIndex(p=>p.id===id);if(i>=0)list[i]=row;else list.push(row);
  character.party=list;renderParty();scheduleSave();return "";
}
function removePartyMember(id){character.party=cleanParty(character.party).filter(p=>p.id!==id);renderParty();scheduleSave();}
function openPartyForm(id){
  const p=cleanParty(character.party).find(x=>x.id===id)||{id:"",name:"",ac:"",maxHp:""};
  openModal(id?"Edit party member":"Add party member",
    `<div class="field"><label class="f" for="pmName">Name</label><input id="pmName" value="${esc(p.name)}" autocomplete="off"></div>`+
    `<div class="g2"><div class="field"><label class="f" for="pmAC">AC (optional)</label><input id="pmAC" inputmode="numeric" value="${esc(String(p.ac))}"></div>`+
    `<div class="field"><label class="f" for="pmHP">Max HP (optional)</label><input id="pmHP" inputmode="numeric" value="${esc(String(p.maxHp))}"></div></div>`+
    `<p class="hint" id="pmWhy" aria-live="polite"></p><div class="m-actions"><button class="tbtn" id="pmCancel">Cancel</button><button class="tbtn primary" id="pmSave">${id?"Save":"Add"}</button></div>`);
  document.getElementById("pmCancel").addEventListener("click",closeModal);
  document.getElementById("pmSave").addEventListener("click",()=>{
    const why=savePartyMember(id,document.getElementById("pmName").value,document.getElementById("pmAC").value,document.getElementById("pmHP").value);
    if(why){document.getElementById("pmWhy").textContent=why;return;}closeModal();
  });
}

/* ---- Roll initiative ----
   Your row copies the hit-die spend box: Roll for me (d20 + your modifier),
   or the d20 you rolled + Apply; Advantage rolls two, keeps the higher.
   Everyone else's total is typed. Opened by Start combat, and by the strip's
   "Roll initiative" when an old save has a fight but no list (midFight). */
let _ir={faces:[],set:false,adv:false};
function irState(){return _ir;}
function irFoeRowHTML(){
  return `<div class="ir-foe" data-irfoe><input data-irf="name" placeholder="Monster" aria-label="Monster name" autocomplete="off">`+
    `<label class="ir-k">× <input data-irf="count" inputmode="numeric" size="2" value="1" aria-label="How many"></label>`+
    `<label class="ir-k">AC <input data-irf="ac" inputmode="numeric" size="2" aria-label="AC guess (optional)"></label>`+
    `<input data-irf="init" inputmode="numeric" size="3" placeholder="Init" aria-label="Initiative"></div>`;
}
function initRollHTML(party,midFight){
  const mod=initModOf();
  return `<p class="hint">${midFight?"Roll for the fight already running.":"Your party and you are in. Add the monsters, then everyone's roll."}</p>`+
    `<div class="ir-you"><b>${esc(character.name||"You")}</b> <span class="ir-k">you · initiative ${esc((mod<0?"−":"+")+Math.abs(mod))}</span>`+
    `<div class="hd-how"><button type="button" class="tbtn primary" id="irRoll">🎲 Roll for me</button> <span>or</span> `+
    `<label>I rolled <input id="irTyped" inputmode="numeric" size="3"></label> <button type="button" class="tbtn" id="irApply">Apply</button> `+
    `<button type="button" class="switch" id="irAdv" role="switch" aria-checked="false" aria-label="Advantage"></button><span class="ir-k">Advantage</span></div>`+
    `<div class="hd-res" id="irRes" aria-live="polite"></div></div>`+
    (party.length?`<div class="ir-party">`+party.map(p=>`<label class="ir-row"><span>${esc(p.name)} <span class="ir-k">party</span></span>`+
      `<input data-irparty="${esc(p.id)}" inputmode="numeric" size="3" placeholder="Init" aria-label="${esc(p.name+"'s initiative")}"></label>`).join("")+`</div>`:"")+
    `<div id="irFoes">${irFoeRowHTML()}</div><button type="button" class="add" id="irAddFoe">+ Add a monster</button>`+
    `<p class="hint">A blank initiative goes last; you can fill it in later.</p>`+
    `<div class="m-actions"><button class="tbtn" id="irCancel">Cancel</button><button class="tbtn primary" id="irStart">Start ▸</button></div>`;
}
function irPaint(why){
  const r=document.getElementById("irRes");if(!r)return;
  r.textContent=why||(_ir.set?initRollLine(_ir.faces,initModOf()):"");
  if(r.classList)r.classList.toggle("bad",!!why);
}
function irSetTyped(raw){
  const c=initRollCheck(raw);if(!c.ok){_ir.set=false;_ir.faces=[];irPaint(c.why);return c.why;}
  _ir.faces=[c.face];_ir.set=true;irPaint("");return "";
}
function irRoll(){
  const d=()=>rollDiceExpr({dice:[{n:1,sides:20,sign:1}],mod:0}).total;
  _ir.faces=_ir.adv?[d(),d()]:[d()];_ir.set=true;
  const box=document.getElementById("irTyped");if(box)box.value=String(Math.max.apply(null,_ir.faces));
  irPaint("");
}
function startInitFight(you,party,foes){
  if(!inCombat(character))combatStart(character);
  character.combatants=buildCombatants(you,party,foes);
  character.combatTurn=character.initMode==="turns"?initFirstAlive(character.combatants):"";
  renderActiveSpells();renderCombatChrome();scheduleSave();
}
function openInitRoll(){
  const mid=inCombat(character),party=cleanParty(character.party);
  _ir={faces:[],set:false,adv:false};
  openModal("Roll initiative",initRollHTML(party,mid),"",{wide:true});
  const on=(id,ev,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener(ev,fn);};
  on("irRoll","click",irRoll);
  on("irApply","click",()=>irSetTyped(document.getElementById("irTyped").value));
  on("irTyped","keydown",e=>{if(e.key==="Enter"){e.preventDefault();irSetTyped(e.target.value);}});
  on("irAdv","click",e=>{_ir.adv=!_ir.adv;e.currentTarget.classList.toggle("on",_ir.adv);e.currentTarget.setAttribute("aria-checked",_ir.adv?"true":"false");});
  on("irAddFoe","click",()=>{const f=document.getElementById("irFoes");if(f)f.insertAdjacentHTML("beforeend",irFoeRowHTML());});
  on("irCancel","click",closeModal);
  on("irStart","click",()=>irStart(party));
}
/* Start ▸ is the commit (final review I3): a roll typed into "I rolled" but
   never Applied is applied here, and a bad one stops Start with irSetTyped()'s
   message in #irRes. A blank box still means unrolled, last. Returns that
   message, or "" once the fight has started. */
function irStart(party){
  if(!_ir.set){
    const b=document.getElementById("irTyped"),typed=b?String(b.value==null?"":b.value).trim():"";
    if(typed){const why=irSetTyped(typed);if(why)return why;}
  }
  const you={name:character.name||"You",init:_ir.set?Math.max.apply(null,_ir.faces)+initModOf():null};
  const party2=party.map(p=>{const i=document.querySelector(`[data-irparty="${CSS.escape(p.id)}"]`);return Object.assign({},p,{init:i?i.value:""});});
  const foes=Array.from(document.querySelectorAll("[data-irfoe]")).map(row=>{const v=k=>{const i=row.querySelector(`[data-irf="${k}"]`);return i?i.value:"";};
    return {name:v("name"),count:v("count"),ac:v("ac"),init:v("init")};});
  closeModal();startInitFight(you,party2,foes);return "";
}

/* ---- the strip (in #cvHead, so it sticks with it) and the table ----
   Whether the ▾ table is open is session state, like cvOpen: never saved, one
   source of truth here rather than a dataset flag on #cvInitTable, which
   combatHeaderHTML()'s full repaint of #cvHead (the ▾/▴ button lives in the
   strip, inside the header) cannot see or keep in step with. */
let _iniTableOpen=false;
function hbBarHTML(bar){
  if(bar.share!==null)return `<span class="hb-share" aria-hidden="true"><b class="hb-${esc(String(bar.band===null?0:bar.band))}" style="width:${esc(String(Math.round(bar.share*100)))}%"></b></span>`;
  if(bar.band===null)return `<span class="hb hb-q" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  return `<span class="hb hb-${esc(String(bar.band))}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
}
function combatantHealthText(r){
  const bar=combatantBar(r);
  if(combatantDead(r))return "Dead";
  if(r.kind==="you")return `HP ${num(character.hp.cur)} / ${effMaxHP()}`;
  if(r.kind==="party"&&r.track==="exact"&&num(r.maxHp)>0)return `HP ${num(r.hp)} / ${num(r.maxHp)}`;
  if(r.kind==="party"&&r.track==="exact"&&r.hp!=="")return `HP ${num(r.hp)}`;   /* no max known: just the number */
  return bar.band===null?"Health not set":HB_NAMES[bar.band];
}
function initStripHTML(ch){
  const list=ch.combatants||[];
  if(!list.length)return `<div class="cv-init"><span class="hint">No initiative yet.</span><span class="grow"></span><button type="button" class="tbtn primary" id="iniRollNow">Roll initiative</button></div>`;
  const turns=ch.initMode==="turns";
  return `<div class="cv-init"><div class="ini-chips">`+list.map(r=>initChipHTML(r,ch)).join("")+`</div>`+(turns?`<button type="button" class="tbtn primary" id="cvTurn" aria-label="Next turn">Next ▸</button>`:"")+
    `<button type="button" class="tbtn" id="cvInitMore" aria-expanded="${_iniTableOpen?"true":"false"}" aria-controls="cvInitTable" aria-label="Show the initiative table">${_iniTableOpen?"▴":"▾"}</button></div>`;
}
function initChipHTML(r,ch){
  const turns=ch.initMode==="turns",show=ch.initShowRolls!==false;
  const now=turns&&r.id===ch.combatTurn,dead=combatantDead(r),name=r.kind==="you"?(ch.name||"You"):r.name;
  const lbl=`${name}${r.init!==null?", initiative "+r.init:""}, ${combatantHealthText(r)}${now?", acting":""}`;
  return `<button type="button" class="ini-chip${now?" now":""}${dead?" dead":""}" data-inichip="${esc(r.id)}" aria-label="${esc(lbl)}">`+
    `<span class="ini-top">${show?`<span class="ini-n">${esc(r.init===null?"—":String(r.init))}</span>`:""}<span class="ini-nm">${esc(name)}</span></span>${hbBarHTML(dead?{band:null,share:null}:combatantBar(r))}</button>`;
}
function initRowHTML(r,ch){
  const name=r.kind==="you"?(ch.name||"You"):r.name,ac=r.kind==="you"?youAC():r.ac;
  return `<button type="button" class="ini-row${combatantDead(r)?" dead":""}" data-inirow="${esc(r.id)}"><span class="ini-n">${esc(r.init===null?"—":String(r.init))}</span>`+
    `<span class="ini-nm">${esc(name)} <span class="ini-kind">${r.kind==="you"?"you":r.kind==="party"?"party":""}</span></span>`+
    `<span class="ini-hp">${esc(combatantHealthText(r))}</span>${ac!==""?`<span class="ini-ac">AC ${esc(String(ac))}</span>`:""}</button>`;
}
function initTableHTML(ch){
  const list=ch.combatants||[],mode=ch.initMode==="rounds"?"rounds":"turns";
  return `<div class="ini-table">`+list.map(r=>initRowHTML(r,ch)).join("")+`</div><div class="ini-foot"><button type="button" class="add" id="iniAdd">+ Add combatant</button><span class="grow"></span>`+
    `<span class="seg">${[["turns","Turns"],["rounds","Rounds"]].map(([v,l])=>`<button type="button" data-inimode="${esc(v)}" class="${mode===v?"on":""}" aria-pressed="${mode===v?"true":"false"}">${esc(l)}</button>`).join("")}</span>`+
    `<button type="button" class="switch ${ch.initShowRolls!==false?"on":""}" id="iniRolls" role="switch" aria-checked="${ch.initShowRolls!==false?"true":"false"}" aria-label="Show rolls"></button><span class="ini-kind">Show rolls</span></div>`;
}
/* Where the chip row should be scrolled so the acting chip shows (final
   review I2): `sl` is its scrollLeft now, `box` and `chip` client rects
   ({left,right}). A chip already in view, or no actor, keeps `sl` — the
   player's own sideways scroll survives a repaint. Pure, for the tests. */
function initChipScroll(sl,box,chip){
  if(!chip||!box)return sl;
  const pad=8;
  if(chip.left<box.left)return Math.max(0,Math.round(sl-(box.left-chip.left)-pad));
  if(chip.right>box.right)return Math.round(sl+Math.min(chip.right-box.right+pad,chip.left-box.left));
  return sl;
}
/* After every repaint of the strip, which builds a fresh .ini-chips at
   scrollLeft 0: put back where it was (`sl`), then bring the actor in. Sets
   scrollLeft directly rather than scrollIntoView(), which may also scroll the
   page. */
function initKeepActorInView(sl){
  const row=document.querySelector("#cvHead .ini-chips");if(!row)return;
  row.scrollLeft=num(sl);
  const n=row.querySelector(".ini-chip.now");if(!n)return;
  const to=initChipScroll(row.scrollLeft,row.getBoundingClientRect(),n.getBoundingClientRect());
  if(to!==row.scrollLeft)row.scrollLeft=to;
}
/* Your chip and table row read your HP live (spec §4), so renderHP() calls
   this (final review I1). It patches YOUR chip and row in place, never the
   whole strip and never through renderCombatHeader() (which would re-announce
   the round and move focus): the HP box commits on `change`, which a blur
   fires on the mousedown of the next tap, and a Next ▸ replaced between that
   mousedown and its mouseup never gets the click — driven: a tap on Next
   right after typing an HP did nothing. Patched in place, every other button
   stays the same element, and the scroll and focus stay put. Cheap when
   there is no fight or the view is closed; a node that would come out the
   same is not touched. */
function renderInitStrip(){
  if(!combatViewOpen()||!inCombat(character))return;
  const you=(character.combatants||[]).find(r=>r.kind==="you");if(!you)return;
  const patch=(sel,key,html)=>{
    const el=[...document.querySelectorAll(sel)].find(x=>x.dataset&&x.dataset[key]===you.id);if(!el)return;
    const t=document.createElement("template");t.innerHTML=html;
    const nu=t.content&&t.content.firstElementChild;if(!nu||(el.isEqualNode&&el.isEqualNode(nu)))return;
    el.className=nu.className;el.setAttribute("aria-label",nu.getAttribute("aria-label")||"");
    if(!nu.hasAttribute("aria-label"))el.removeAttribute("aria-label");
    el.innerHTML=nu.innerHTML;
  };
  patch("#cvHead [data-inichip]","inichip",initChipHTML(you,character));
  patch("#cvInitTable [data-inirow]","inirow",initRowHTML(you,character));
}
function renderInitTable(){
  const el=document.getElementById("cvInitTable");if(!el)return;
  /* A fight with no rows, or no fight at all, closes it: the flag resets here
     rather than only hiding the panel, so a later fight starts collapsed. */
  if(!inCombat(character)||!(character.combatants||[]).length)_iniTableOpen=false;
  const open=_iniTableOpen&&inCombat(character)&&(character.combatants||[]).length>0;
  el.hidden=!open;el.innerHTML=open?initTableHTML(character):"";
}
/* The one place the flag flips: the strip's ▾/▴ and the panel both repaint
   from it, so they can never disagree the way a dataset flag on the panel
   (invisible to the header's own repaint) did. */
function toggleInitTable(){_iniTableOpen=!_iniTableOpen;renderCombatChrome();renderInitTable();}
function initNext(){
  const r=initNextTurn(character.combatants||[],character.combatTurn);
  character.combatTurn=r.turnId;
  if(r.wrapped)advanceRound(1);
  renderCombatChrome();renderInitTable();scheduleSave();
  /* AFTER the repaint, which may have written "Round N" into the same live
     region. A screen reader speaks only the last write of a task, so a wrap
     says both in one message (final review m2). */
  const a=(character.combatants||[]).find(x=>x.id===r.turnId);
  if(!a)return;
  const who=`${a.kind==="you"?(character.name||"You"):a.name}'s turn`;
  if(r.wrapped){cvLiveRound=num(character.combatRound);setCombatLive(`Round ${cvLiveRound} — ${who}`);}
  else setCombatLive(who);
}
function setInitMode(mode){
  character.initMode=mode==="rounds"?"rounds":"turns";
  /* a stored actor is kept only while alive (final review m1) */
  character.combatTurn=character.initMode==="turns"?(((character.combatants||[]).some(r=>r.id===character.combatTurn&&!combatantDead(r))&&character.combatTurn)||initFirstAlive(character.combatants||[])):"";
  renderCombatChrome();renderInitTable();scheduleSave();
}
function toggleInitRolls(){character.initShowRolls=character.initShowRolls===false;renderCombatChrome();renderInitTable();scheduleSave();}

/* ---- one combatant's dialog: big targets (Mike: bands are too small to tap
   on a phone). Foe: band buttons. Party: Exact HP / Estimate, Dead. You:
   initiative only. Ties break here with Act earlier / Act later. */
function initTie(list,i,dir){const j=i+dir;return j>=0&&j<list.length&&list[j].init===list[i].init;}
function combatantDialogHTML(r,ch){
  const list=ch.combatants||[],i=list.findIndex(x=>x.id===r.id);
  const bands=n=>`<div class="cd-lbl">How hurt?</div>`+[0,1,2,3,4].slice(0,n).map(b=>`<button type="button" class="cd-band${r.band===b?" on":""}" data-cband="${esc(String(b))}">`+
    `${hbBarHTML({band:b===4?null:b,share:null})}<span>${esc(HB_NAMES[b])}<small>${esc(HB_SAYS[b])}</small></span></button>`).join("");
  const fields=`<div class="cd-two"><label class="cd-fld"><span class="cd-k">Initiative</span><input id="cdInit" inputmode="numeric" value="${esc(r.init===null?"":String(r.init))}"></label>`+
    (r.kind==="you"?"":`<label class="cd-fld"><span class="cd-k">${r.kind==="foe"?"AC guess":"AC"} (optional)</span><input id="cdAC" inputmode="numeric" value="${esc(String(r.ac))}"></label>`)+`</div>`;
  const ties=(initTie(list,i,-1)?`<button type="button" class="tbtn" data-cmove="-1">Act earlier</button>`:"")+(initTie(list,i,1)?`<button type="button" class="tbtn" data-cmove="1">Act later</button>`:"");
  let body="";
  if(r.kind==="foe")body=bands(5);
  else if(r.kind==="party"){
    const ex=r.track==="exact";
    body=`<div class="seg cd-track">${[["exact","Exact HP"],["estimate","Estimate"]].map(([v,l])=>`<button type="button" data-ctrack="${esc(v)}" class="${r.track===v?"on":""}" aria-pressed="${r.track===v?"true":"false"}">${esc(l)}</button>`).join("")}</div>`+
      (ex?`<div class="cd-lbl">Hit points</div><div class="cd-step"><button type="button" class="cd-pm" data-chp="-1" aria-label="One less">−</button>`+
        `<input id="cdHp" inputmode="numeric" value="${esc(String(r.hp))}" aria-label="Current HP">${r.maxHp===""?"":`<span class="cd-k">/ ${esc(String(r.maxHp))}</span>`}`+
        `<button type="button" class="cd-pm" data-chp="1" aria-label="One more">+</button></div>`:bands(4))+
      `<button type="button" class="cd-toggle" id="cdDead" role="switch" aria-checked="${r.dead?"true":"false"}"><span>Dead</span><span class="switch ${r.dead?"on":""}"></span></button>`;
  }
  else body=`<p class="hint">HP ${esc(String(num(character.hp.cur)))} / ${esc(String(effMaxHP()))} and AC ${esc(String(youAC()))}, from your sheet. Your HP changes on the Vitals card.</p>`;
  return `<div class="cd">${body}${fields}${ties?`<div class="cd-ties">${ties}</div>`:""}`+
    `<div class="m-actions">${r.kind==="you"?"":`<button type="button" class="tbtn danger" id="cdRemove">Remove</button>`}<span class="grow"></span><button type="button" class="tbtn primary" id="cdDone">Done</button></div></div>`;
}
function setCombatant(id,patch){
  const list=character.combatants||[],r=list.find(x=>x.id===id);if(!r)return;
  if("band" in patch)r.band=(Number.isInteger(patch.band)&&patch.band>=0&&patch.band<=4)?patch.band:null;
  if("track" in patch&&r.kind==="party")r.track=patch.track==="estimate"?"estimate":"exact";
  if("hp" in patch&&r.kind==="party"){const n=initInt(patch.hp),h=n===null?"":Math.max(0,n);r.hp=h===""?"":(num(r.maxHp)>0?Math.min(h,num(r.maxHp)):h);}
  if("dead" in patch&&r.kind==="party")r.dead=patch.dead===true;
  if("ac" in patch&&r.kind!=="you")r.ac=initOpt(patch.ac);
  if("init" in patch){r.init=initInt(patch.init);character.combatants=initSort(list);}
  let wrapped=false;
  if(character.initMode==="turns"&&!(character.combatants||[]).some(x=>x.id===character.combatTurn&&!combatantDead(x))){
    const n=initNextTurn(character.combatants,character.combatTurn);
    character.combatTurn=n.turnId||initFirstAlive(character.combatants);
    wrapped=initTurnWrapped(n);
  }
  if(wrapped)advanceRound(1);
  renderCombatChrome();renderInitTable();scheduleSave();
}
/* Moving the marker off a dead or removed actor past the end of the order
   is a wrap, exactly as Next's is (ruling T5-M2): the round advances once.
   Not when the marker lands back on a dead row (nobody living at all). */
function initTurnWrapped(n){
  if(!n||!n.wrapped||!n.turnId)return false;
  const r=(character.combatants||[]).find(x=>x.id===n.turnId);
  return !!r&&!combatantDead(r);
}
function removeCombatant(id){
  const list=character.combatants||[],r=list.find(x=>x.id===id);if(!r||r.kind==="you")return;
  let n=null;
  if(character.combatTurn===id){n=initNextTurn(list,id);character.combatTurn=n.turnId;}
  character.combatants=list.filter(x=>x.id!==id);
  if(character.combatTurn===id)character.combatTurn=initFirstAlive(character.combatants);
  if(initTurnWrapped(n))advanceRound(1);   /* T5-M2 */
  renderCombatChrome();renderInitTable();scheduleSave();
}
function moveCombatant(id,dir){
  const list=character.combatants||[],i=list.findIndex(x=>x.id===id);
  if(i<0||!initTie(list,i,dir))return false;
  const j=i+dir;[list[i],list[j]]=[list[j],list[i]];
  renderCombatChrome();renderInitTable();scheduleSave();return true;
}
function addCombatant(name,init,ac){
  const nm=String(name||"").trim().slice(0,60);if(!nm)return "Give it a name.";
  const row=buildCombatants({name:""},[],[{name:nm,count:1,ac,init}]).find(r=>r.kind==="foe");
  row.name=nm;   /* the 60 a name may have: buildCombatants() keeps 56 for a "× N" number, and one row has none (m9) */
  character.combatants=initSort((character.combatants||[]).concat([row]));
  if(character.initMode==="turns"&&!character.combatTurn)character.combatTurn=initFirstAlive(character.combatants);
  renderCombatChrome();renderInitTable();scheduleSave();return "";
}
/* The dialog wires its own clicks on #mBody, delegated, rather than one
   listener per open: openModal() keeps the same #mBody element across every
   open/close (only innerHTML changes), and openCombatant() re-opens itself
   after most changes, so a fresh listener per open would stack one more
   every time. Bound once (guarded by a dataset flag on the element itself,
   which survives the innerHTML swap), reading which combatant is current
   from _cdId rather than a captured id. */
let _cdId="";
function openCombatant(id){
  const r=(character.combatants||[]).find(x=>x.id===id);if(!r)return;
  _cdId=id;
  openModal(r.kind==="you"?(character.name||"You"):r.name,combatantDialogHTML(r,character));
  const body=document.getElementById("mBody");if(!body)return;
  if(!body.dataset.cdWired){
    body.dataset.cdWired="1";
    body.addEventListener("click",e=>{
      const t=e.target,cid=_cdId;let m;
      if((m=t.closest("[data-cband]"))){setCombatant(cid,{band:num(m.dataset.cband)});closeModal();return;}
      if((m=t.closest("[data-ctrack]"))){const v=m.dataset.ctrack;setCombatant(cid,{track:v});openCombatant(cid);cdRefocus(`[data-ctrack="${v==="estimate"?"estimate":"exact"}"]`);return;}
      if((m=t.closest("[data-chp]"))){const d=num(m.dataset.chp),x=(character.combatants||[]).find(z=>z.id===cid);setCombatant(cid,{hp:Math.max(0,num(x&&x.hp)+d)});openCombatant(cid);cdRefocus(`[data-chp="${d<0?-1:1}"]`);return;}
      if(t.closest("#cdDead")){const x=(character.combatants||[]).find(z=>z.id===cid);setCombatant(cid,{dead:!(x&&x.dead)});openCombatant(cid);cdRefocus("#cdDead");return;}
      if((m=t.closest("[data-cmove]"))){const d=num(m.dataset.cmove)<0?-1:1;moveCombatant(cid,d);openCombatant(cid);
        /* past the end of the tie the pressed button is gone: the other one, else Done */
        cdRefocus(`[data-cmove="${d}"]`,`[data-cmove="${-d}"]`,"#cdDone");return;}
      if(t.closest("#cdRemove")){if(confirm("Remove them from this fight?")){removeCombatant(cid);closeModal();}return;}
      if(t.closest("#cdDone")){closeModal();return;}
    });
  }
  /* A typed value is stored cleaned (an over-max HP clamped, a negative 0), so
     the box is rewritten from the row: it must never show what was not kept. */
  const ch=(elId,key)=>{const el=document.getElementById(elId);if(el)el.addEventListener("change",()=>{
    setCombatant(_cdId,{[key]:el.value});
    const x=(character.combatants||[]).find(z=>z.id===_cdId);
    if(x)el.value=key==="init"?(x.init===null?"":String(x.init)):String(x[key]);
  });};
  ch("cdInit","init");ch("cdAC","ac");ch("cdHp","hp");
}
/* After a reopen, the keyboard goes back to the control that was pressed
   (openModal() would leave it on the first field): the first of these
   selectors that is in the dialog. */
function cdRefocus(...sels){
  for(const q of sels){const b=document.querySelector("#mBody "+q);if(b){b.focus();return;}}
}
function openAddCombatant(){
  openModal("Add combatant",`<div class="field"><label class="f" for="acName">Name</label><input id="acName" autocomplete="off"></div>`+
    `<div class="g2"><div class="field"><label class="f" for="acInit">Initiative</label><input id="acInit" inputmode="numeric"></div>`+
    `<div class="field"><label class="f" for="acAC">AC (optional)</label><input id="acAC" inputmode="numeric"></div></div>`+
    `<p class="hint" id="acWhy" aria-live="polite"></p><div class="m-actions"><button class="tbtn" id="acCancel">Cancel</button><button class="tbtn primary" id="acSave">Add</button></div>`);
  document.getElementById("acCancel").addEventListener("click",closeModal);
  document.getElementById("acSave").addEventListener("click",()=>{
    const why=addCombatant(document.getElementById("acName").value,document.getElementById("acInit").value,document.getElementById("acAC").value);
    if(why){document.getElementById("acWhy").textContent=why;return;}closeModal();
  });
}
