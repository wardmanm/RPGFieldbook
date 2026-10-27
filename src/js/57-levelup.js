/* ================= level-up fanfare (#101) =================
   What a level gave. The sheet is snapshotted before the level is applied
   and again after recompute(), and the card lists the difference. Comparing
   the sheet, not reading the class table, is what makes it right for any
   pack, homebrew included, and it can never claim something the sheet did
   not get. Spec: src/docs/specs/2026-10-24-level-up-fanfare-design.md. */
function levelSnapshot(){
  const slots=[];
  for(let lv=1;lv<=9;lv++){const s=character.slots&&character.slots[lv];slots.push(s?num(s.total):0);}
  /* keyed by the resource's own key, so Channel Divinity from a Cleric and from
     a Paladin stay two rows; a player's own resource has none, so its name */
  const res={};
  (character.resources||[]).forEach(r=>{
    if(!r||!r.name)return;
    res[r.key||("own:"+String(r.name).toLowerCase())]={name:String(r.name),max:num(r.max),die:String(r.die||"")};
  });
  return {
    level:totalLevel(),
    feats:(character.features||[]).map(f=>({id:f.id,name:String(f.name||""),desc:String(f.description||""),
      cls:(f.origin&&f.origin.class)||"",sub:(f.origin&&f.origin.subclass)||""})),
    slots,res,pb:pbValue(contributions())
  };
}
const LU_ORD=["","1st","2nd","3rd","4th","5th","6th","7th","8th","9th"];
const LU_CHOICE={asi:["Ability Score Improvement","+2 to one ability, or +1 to two"],feat:["Choose a feat",""],
  subclass:["Choose your subclass",""],skill:["Choose skills",""],option:["Choose an option",""],
  /* #118: level 19's asi choice; with Feats allowed off it is a plain ASI (§5) */
  boon:["Epic Boon","a feat, or an Ability Score Improvement"]};
/* A feature's first sentence as plain text: the card is a summary, and the
   full text stays on the Features card. Escaped where it is rendered. */
function luSummary(s){
  let t=String(s==null?"":s).replace(/\[Table:\s*([^\]]+)\]/g,"$1").replace(/<[^>]*>/g,"")
    .replace(/[*_`#>]/g,"").replace(/\s+/g," ").trim();
  const m=/^.*?[.!?](?=\s|$)/.exec(t);if(m)t=m[0];
  return t.length>160?t.slice(0,157).trimEnd()+"…":t;
}
/* The features the rules say do not add together when a second class grants
   them again (SRD 5.2.1 p.26, Multiclassing): Extra Attack, and Unarmored
   Defense (you use only one way to calculate AC). A same-named feature that is
   not here is left untagged: Spellcasting combines by its own rule, and
   Expertise or Epic Boon are separate picks. */
const LU_NO_STACK=["extra attack","unarmored defense"];
function levelGains(before,after,choices,notes){
  const rows=[],had=new Set(before.feats.map(f=>f.id));
  after.feats.filter(f=>!had.has(f.id)).forEach(f=>{
    const nm=f.name.toLowerCase();
    const twin=LU_NO_STACK.includes(nm)&&before.feats.find(b=>b.cls&&f.cls&&b.cls!==f.cls&&b.name.toLowerCase()===nm);
    rows.push({kind:"feature",text:f.name,detail:luSummary(f.desc),tag:f.sub||"feature",
      warn:twin?`You already have this from ${twin.cls}; they don't stack.`:""});
  });
  (choices||[]).filter(ch=>ch&&ch.type!=="hp").forEach(ch=>{
    const d=(ch.type==="asi"&&ch.boon&&character.featsAllowed!==false)?LU_CHOICE.boon:(LU_CHOICE[ch.type]||["A choice",""]);
    rows.push({kind:"choice",text:String(ch.label||d[0]),detail:d[1],tag:"choose next",warn:""});
  });
  Object.keys(after.res).forEach(k=>{
    const a=after.res[k],b=before.res[k];
    if(!b){rows.push({kind:"resource",text:`${a.name} ×${a.max}`+(a.die?` · ${a.die}`:""),detail:"",tag:"new",warn:""});return;}
    if(a.max>b.max)rows.push({kind:"resource",text:`${a.name} ${b.max} → ${a.max}`,detail:"",tag:"uses",warn:""});
    if(a.die&&b.die&&a.die!==b.die)rows.push({kind:"resource",text:`${a.name} ${b.die} → ${a.die}`,detail:"",tag:"die",warn:""});
  });
  for(let lv=1;lv<=9;lv++){
    const b=num(before.slots[lv-1]),a=num(after.slots[lv-1]);
    if(a>b)rows.push({kind:"slot",text:b?`Spell slots · ${LU_ORD[lv]} level ${b} → ${a}`:`Spell slots · ${LU_ORD[lv]} level ×${a}`,
      detail:"",tag:b?"slots":"new",warn:""});
  }
  if(after.pb>before.pb)rows.push({kind:"pb",text:`Proficiency bonus +${before.pb} → +${after.pb}`,detail:"",tag:"bonus",warn:""});
  (notes||[]).forEach(n=>{const t=choiceNoteText(n).trim();if(t)rows.push({kind:"note",text:t,detail:"",tag:"note",warn:""});});
  return rows;
}
/* The typed value of the HP step: the dice total, n..n×die, as the spend box
   takes 1..die. With no hit die (a custom class) it is the hit points
   themselves, any whole number. */
function luHPCheck(ch,raw){
  const die=num(ch&&ch.die),n=Math.max(1,num(ch&&ch.levels)||1),s=String(raw==null?"":raw).trim();
  if(!/^\d+$/.test(s))return {ok:false,why:die?"Type the number you rolled.":"Type the hit points you gained."};
  const r=parseInt(s,10);
  if(die&&(r<n||r>n*die))return {ok:false,why:n>1?`${n}d${die} rolls ${n} to ${n*die}.`:`A d${die} rolls 1 to ${die}.`};
  return {ok:true,why:""};
}
/* ---- the level card ----
   One open level-up at a time; the card is a modal. Done or Continue commits
   the HP through commitHPChoice() and hands on to runChoices(), which with
   nothing to choose falls through to runExtraChoices(pending) as before. */
let _lu=null;
function luState(){return _lu;}
const LU_HP_CLOSE="Close without adding this level's hit points?\n\nMax HP is unlocked, so you can type the new total yourself.";
const LU_ICON={feature:"✦",choice:"✧",resource:"◆",slot:"◇",pb:"↑",note:"✎"};
/* A level-up's notes are all one class's. A second class added above level 1
   brings every level's spell note, and each later one supersedes the one
   before ("Prepared Spells: 4", then "5"), so only the highest level's are
   kept. A plain string (the multiclass note) has no level and always stays. */
function luLatestNotes(notes){
  const L=n=>(n&&typeof n==="object")?num(n._level):0;
  const top=(notes||[]).reduce((m,n)=>Math.max(m,L(n)),0);
  return (notes||[]).filter(n=>L(n)<1||L(n)===top);
}
/* `id` is the character the level-up belongs to. Every way on (the scene's
   end, Done, closing) checks it, and one whose character has changed is
   dropped: no card, no HP, no choices on someone else's sheet. */
function openLevelUp(info){
  _lu={id:activeId,cls:info.cls,from:num(info.from),to:num(info.to),charLevel:num(info.charLevel),fromLevel:num(info.before&&info.before.level),
    hp:info.hp,choices:(info.choices||[]).filter(ch=>ch&&ch.type!=="hp"),pending:info.pending||null,
    gains:levelGains(info.before,info.after,info.choices||[],luLatestNotes(info.notes)),raw:null,set:false,note:""};
  playLevelUpFx(_lu.fromLevel||(_lu.charLevel-(_lu.to-_lu.from)),_lu.charLevel,showLevelUpCard);
}
function luRowHTML(r){
  return `<li class="lu-row lu-${esc(r.kind)}"><i aria-hidden="true">${LU_ICON[r.kind]||"•"}</i><span>${esc(r.text)}`+
    (r.detail?`<span class="lu-d">${esc(r.detail)}</span>`:"")+(r.warn?`<span class="lu-warn">${esc(r.warn)}</span>`:"")+
    `</span>${r.tag?`<small>${esc(r.tag)}</small>`:""}</li>`;
}
function levelUpHPHTML(ch){
  const die=num(ch&&ch.die),n=Math.max(1,num(ch&&ch.levels)||1),con=conModNow();
  const res=`<div class="hd-res" id="luRes" aria-live="polite"></div>`;
  if(!die)return `<div class="lu-hp"><h5>Hit points</h5><div class="hd-how"><label>HP gained <input id="luTyped" inputmode="numeric" size="3"></label> `+
    `<button type="button" class="tbtn" id="luApply">Apply</button></div>${res}</div>`;
  const conTxt=(n>1?n+"×":"")+"CON "+(con<0?"−"+Math.abs(con):con);
  return `<div class="lu-hp"><h5>Hit points · ${esc((n>1?n:"")+"d"+die)} + ${esc(conTxt)}</h5><div class="hd-how">`+
    `<button type="button" class="tbtn primary" id="luRoll">🎲 Roll for me</button> <span>or</span> `+
    `<label>I rolled <input id="luTyped" inputmode="numeric" size="3"></label> <button type="button" class="tbtn" id="luApply">Apply</button> `+
    `<button type="button" class="lu-avg" id="luAvg">Take the average (${esc(String(n*hpFixed(die)))})</button></div>${res}</div>`;
}
function levelUpCardHTML(lu){
  const rows=lu.gains.length?lu.gains.map(luRowHTML).join(""):`<li class="lu-none">Nothing new from the rules at this level.</li>`;
  return `<div class="lu-card"><div class="lu-bn">LEVEL ${esc(String(lu.charLevel))}</div>`+
    `<p class="lu-k">You reached</p><p class="lu-cls">${esc(lu.cls)} ${esc(String(lu.from))} → ${esc(String(lu.to))} · character level ${esc(String(lu.charLevel))}</p>`+
    `<ul class="lu-list">${rows}</ul>`+levelUpHPHTML(lu.hp)+
    `<div class="m-actions"><button type="button" class="tbtn primary" id="luGo" disabled>${(lu.choices||[]).length?"Continue to your choice ▸":"Done"}</button></div></div>`;
}
/* true, and the level-up dropped, when the open character is not the one it
   started on */
function luStale(){if(_lu&&_lu.id!==activeId){_lu=null;return true;}return false;}
/* Loading, importing or starting a character, or going Home: the level-up
   is dropped first, then a playing scene ends (its done() finds no _lu and
   opens nothing) and an open card closes, so neither stays over another sheet. */
function luAbandon(){
  const had=!!_lu;_lu=null;
  luSkip();
  if(had&&document.querySelector&&document.querySelector("#mBody .lu-card"))closeModal();
}
function showLevelUpCard(){
  if(!_lu||luStale())return;
  openModal("Level up",levelUpCardHTML(_lu));
  /* after openModal, which clears the guard on every open */
  setDismissGuard(()=>(_lu&&!_lu.set&&_lu.id===activeId)?LU_HP_CLOSE:"",luDismissed);
  const on=(id,ev,fn)=>{const el=document.getElementById(id);if(el&&el.addEventListener)el.addEventListener(ev,fn);};
  const typed=()=>{const el=document.getElementById("luTyped");return el?el.value:"";};
  const apply=()=>luSetHP(typed());
  on("luRoll","click",luRoll);
  on("luApply","click",apply);
  on("luTyped","keydown",e=>{if(e.key==="Enter"){e.preventDefault();apply();}});
  on("luAvg","click",()=>luSetHP(null));
  on("luGo","click",luFinish);
}
function luSay(text,bad){const el=document.getElementById("luRes");if(!el)return;el.textContent=text;if(el.classList)el.classList.toggle("bad",!!bad);}
/* raw===null takes the average (half the die + 1). Otherwise raw is checked
   by luHPCheck. Nothing is committed until Done, so a roll can be redone.
   A value that fails takes back any earlier one and disables Done: the card
   must never commit a number it no longer shows, and closing asks again. */
function luSetHP(raw,note){
  if(!_lu)return "No level-up is open.";
  const ch=_lu.hp||{};
  const fail=why=>{
    _lu.set=false;_lu.raw=null;_lu.note="";
    const go=document.getElementById("luGo");if(go)go.disabled=true;
    luSay(why,true);return why;
  };
  if(raw===null){if(!num(ch.die))return fail("Type the hit points you gained.");_lu.raw="";}
  else{const c=luHPCheck(ch,raw);if(!c.ok)return fail(c.why);_lu.raw=String(raw).trim();}
  _lu.set=true;_lu.note=note||"";
  luSay(luHPLine(),false);
  const go=document.getElementById("luGo");if(go)go.disabled=false;
  return "";
}
function luHPLine(){
  const ch=_lu.hp||{},m=num(character.hp.max);
  if(!num(ch.die)){const g=Math.max(0,num(_lu.raw));return `${g} HP · Max HP ${m} → ${m+g}`;}
  return hpGainText(ch,_lu.raw,conModNow(),m,_lu.note);
}
function luRoll(){
  if(!_lu)return;
  const ch=_lu.hp||{},die=num(ch.die),n=Math.max(1,num(ch.levels)||1);if(!die)return;
  const r=rollDiceExpr({dice:[{n,sides:die,sign:1}],mod:0});
  const box=document.getElementById("luTyped");if(box)box.value=String(r.total);
  luSetHP(String(r.total),"Rolled "+r.faces.join(", "));
}
function luFinish(){
  if(luStale()){closeModal();return false;}
  if(!_lu||!_lu.set)return false;
  const lu=_lu;_lu=null;
  closeModal();
  commitHPChoice(lu.hp,lu.raw);scheduleSave();
  runChoices(lu.cls,lu.choices,[],lu.pending);
  return true;
}
/* Esc, × or the backdrop. The guard has already asked when HP was not set.
   HP that was set is kept; the choices open either way, because a choice the
   player never saw must not vanish with the card. */
function luDismissed(){
  const lu=_lu;_lu=null;if(!lu||lu.id!==activeId)return;
  if(lu.set){commitHPChoice(lu.hp,lu.raw);scheduleSave();}
  runChoices(lu.cls,lu.choices,[],lu.pending);
}
/* ---- the scene (panel F of the mockup) ----
   A layer over the page and under the modal (z-index 75 < 80): a rune circle
   draws itself, the level ring glows and ticks old → new, a flash, the
   banner and its sparks. CSS keyframes only; the runes are drawn paths, so
   no font is needed. A click, a tap or Esc/Enter/Space skips to the card;
   reduced motion never builds it. Nothing here is saved. */
const LU_FX_MS=2400;
const LU_STAR="M125 31L165.8 209.7L51.5 66.4L216.6 145.9L33.4 145.9L198.5 66.4L84.2 209.7Z";
const LU_RUNES=["M2 0V16M2 4L8 1M2 9L8 6","M2 16V0L8 5V16","M2 0V16M2 4L7 8L2 12","M2 0V16M2 2L8 6M2 7L8 11",
  "M2 16V0L7 4L2 8L8 16","M7 2L2 8L7 14","M1 1L9 15M9 1L1 15","M2 16V0L7 4L2 8","M2 0V16M8 0V16M2 5L8 11",
  "M5 0V16M1 6L9 10","M5 0V16","M5 0V16M1 5L5 0L9 5"];
const LU_SPARKS=[[18,0],[33,.15],[48,.05],[63,.2],[80,.1],[26,.3],[72,.35]];
const LU_MOTES=[[6,.1],[14,.7],[22,.3],[30,1],[38,.2],[46,.8],[54,.4],[62,1.1],[70,.15],[78,.6],[86,.9],[94,.35],[10,1.2],[50,.55],[66,.05],[90,.75]];
let _luFx=null;
function luBusy(){return !!_luFx;}
function luReducedMotion(){try{return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);}catch(e){return false;}}
function luFxHTML(from,to){
  let runes="";
  for(let i=0;i<24;i++)runes+=`<path transform="rotate(${esc(String(i*15))} 125 125) translate(120 9)" d="${esc(LU_RUNES[i%LU_RUNES.length])}"/>`;
  return `<svg class="lu-sigil" viewBox="0 0 250 250" aria-hidden="true"><circle class="lu-c1" cx="125" cy="125" r="118"/>`+
    `<circle class="lu-c2" cx="125" cy="125" r="94"/><path class="lu-star" d="${esc(LU_STAR)}"/><g class="lu-runes">${runes}</g></svg>`+
    `<div class="lu-ring"><b class="lu-old">${esc(String(from))}</b><b class="lu-new">${esc(String(to))}</b></div>`+
    `<div class="lu-flash"></div><div class="lu-banner">LEVEL ${esc(String(to))}</div>`+
    LU_SPARKS.map(([x,d])=>`<i class="lu-spark" style="left:${esc(String(x))}%;animation-delay:${esc(String(1.6+d))}s"></i>`).join("")+
    LU_MOTES.map(([x,d])=>`<i class="lu-mote" style="left:${esc(String(x))}%;animation-delay:${esc(String(d))}s"></i>`).join("");
}
function playLevelUpFx(from,to,done){
  if(luReducedMotion()){done();return;}
  const el=document.createElement("div");
  el.id="luFx";el.className="lu-fx";el.setAttribute("aria-hidden","true");
  el.innerHTML=luFxHTML(from,to);
  const fx={el,done,timer:null,key:null};_luFx=fx;
  fx.key=e=>{if(e.key==="Escape"||e.key==="Enter"||e.key===" "){if(e.preventDefault)e.preventDefault();luSkip();}};
  el.addEventListener("click",luSkip);
  document.addEventListener("keydown",fx.key);
  document.body.appendChild(el);
  fx.timer=setTimeout(luSkip,LU_FX_MS);
}
function luSkip(){
  const fx=_luFx;if(!fx)return;_luFx=null;
  clearTimeout(fx.timer);
  if(document.removeEventListener)document.removeEventListener("keydown",fx.key);
  if(fx.el&&typeof fx.el.remove==="function")fx.el.remove();
  fx.done();
}
