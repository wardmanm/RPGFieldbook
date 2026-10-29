/* ================= the End of combat window (#105) =================
   Opened by endCombatNow() (87-combat.js) once End combat is confirmed and
   the fight has ended. One wide modal: the time, a chip per combatant, then
   folded rows (Ammunition, Experience, Loot, After combat), each a label and
   a one-line status that opens on a tap, remembered per character
   (endCombatOpen). A row with nothing to show is left out. Done closes it.
   Its memory, `_endFight`, is never saved: it belongs to the character OBJECT
   it was opened for (`who`), like every toast Undo here, and is dropped on
   Done, on ×/Escape and when the character changes (endFightLive()).
   After 87-journal.js and 87-trackers.js in the manifest: it draws their tiles
   and pages. Design: src/docs/specs/2026-10-29-end-of-combat-design.md */
const EC_ROWS=["ammo","xp","loot","after"];
const EC_LABEL={ammo:"Ammunition",xp:"Experience",loot:"Loot",after:"After combat"};
let _endFight=null;
function endFightLive(){if(_endFight&&_endFight.who!==character)_endFight=null;return _endFight;}
function endCombatOpenOf(c){const m=c&&c.endCombatOpen;return (m&&typeof m==="object"&&!Array.isArray(m))?m:{};}
function openEndOfCombat(r){
  const o=r||{},a=(o.ammo&&typeof o.ammo==="object")?o.ammo:{};
  _endFight={who:character,rounds:Math.max(0,num(o.rounds)),sec:Math.max(0,num(o.sec)),
    combatants:Array.isArray(o.combatants)?o.combatants:[],
    ammo:{logged:Array.isArray(a.logged)?a.logged:[],lines:Array.isArray(a.lines)?a.lines:[],undo:typeof a.undo==="function"?a.undo:null,undone:false},
    xp:"",traded:"",asking:false};
  endFightShow();
  return _endFight;
}
/* (Re)opens the window from _endFight: first from End combat, again after a
   trade. openModal() clears any guard, so it is set again every time. */
function endFightShow(){
  const st=endFightLive();if(!st)return false;
  openModal("End of combat",endFightHTML(st,character),"",{wide:true});
  setDismissGuard(endFightGuard,()=>endFightClose(false,false));
  endFightWire();
  return true;
}
/* ×/Escape (dismissModal()). With XP typed it refuses this dismissal (true)
   and asks "Add 112 XP?" in the app's warning window; either answer closes the
   window — Add XP exactly as Done (the level-up included), Don't add (or
   Escape) without it. Nothing typed: no question; the hand-on closes it.
   The answer acts only on the window it was asked about: still this state,
   and its Done still in the open dialog (closeModal() wipes #mBody, so the
   Done exists nowhere else). Otherwise it does nothing. */
function endFightGuard(){
  const st=endFightLive();if(!st)return null;
  const n=endFightXpToAdd(st,character);if(!(n>0))return null;
  if(st.asking)return true;
  st.asking=true;
  askConfirm({title:`Add ${endFightN(n)} XP?`,message:"You typed XP but didn't press Done.",ok:"Add XP",cancel:"Don't add"})
    .then(yes=>{
      st.asking=false;
      if(endFightLive()!==st||!document.getElementById("ecDone"))return;
      closeModal();endFightClose(!!yes,true);
    });
  return true;
}
/* The window has closed for good: drop its memory and, when `add`, write the
   XP (character.xp becomes a number). `levelUp` (Done only) opens the level-up
   when this XP made it ready, by the level ring's own path. Returns whether
   XP was added. */
function endFightClose(add,levelUp){
  const st=endFightLive();_endFight=null;
  if(!st||!add)return false;
  const n=endFightXpToAdd(st,character);if(!(n>0))return false;
  const lv=endFightReadyLevel(character,n);
  character.xp=endFightXpBase(character)+n;
  renderLevelBadge();scheduleSave();
  if(lv&&levelUp)doLevelUp();
  return true;
}
/* Done: adds the XP (its share when split), closes the window, and opens the
   level-up when that XP reached a level. Returns whether it closed. */
function endFightDone(){
  if(!endFightLive())return false;
  closeModal();
  endFightClose(true,true);
  return true;
}

/* ---- markup: pure strings over (state, character), so the harness can assert every state ---- */
function endFightSummaryHTML(st){
  const list=(st.combatants||[]).filter(r=>r&&typeof r==="object"&&r.kind!=="you");
  if(!list.length)return "";
  return `<ul class="ec-chips">`+list.map(r=>{const nm=String(r.name||"");
    return combatantDead(r)?`<li class="ec-chip fell"><s>${esc(nm)}</s><span class="sh-vh">, fell</span></li>`:`<li class="ec-chip">${esc(nm)}</li>`;}).join("")+`</ul>`;
}
/* Per kind, the log line's own words (ammoLogTitle()), read from the line's
   meta so an Undo shows at once; under None, what that rule means. */
function endFightAmmoLines(st,c){
  const none=ammoRecoveryOf(c)==="none";
  return ((st.ammo&&st.ammo.logged)||[]).filter(l=>l&&l.e&&l.e.meta).map(l=>{
    const fired=Math.max(0,num(l.e.meta.fired)),back=Math.max(0,num(l.e.meta.back));
    if(none&&back===0)return `${ammoKindLabel(ammoPlural(l.kind))}: ${fired} fired, none come back (recovery: None)`;
    return ammoLogTitle(l.kind,fired,back);
  });
}
function endFightAmmoSection(st,c){
  const lines=endFightAmmoLines(st,c);if(!lines.length)return null;
  const a=st.ammo||{},can=typeof a.undo==="function"&&(a.lines||[]).length>0;
  return {status:lines.join(" · "),
    body:lines.map(t=>`<p class="ec-line">${esc(t)}</p>`).join("")+
      (can?(a.undone?`<p class="ec-done">Recovery undone</p>`:`<button type="button" class="tbtn" id="ecUndoAmmo">Undo recovery</button>`):"")};
}
/* ---- Experience (spec §4.3): shown only when the character levels by XP ---- */
function endFightN(n){return Math.max(0,Math.floor(num(n))).toLocaleString("en-US");}
/* The box's number: whole, 0 to 1,000,000; anything else is 0. */
function endFightXpInt(v){
  const s=String(v==null?"":v).trim();if(!s)return 0;
  const n=Math.floor(Number(s));
  return isFinite(n)&&n>0?Math.min(1000000,n):0;
}
/* What Done adds: the typed number, or its share, rounded down. */
function endFightXpMath(typed,split,party){
  const t=endFightXpInt(typed),n=split?Math.max(1,Math.floor(num(party))):1;
  return {typed:t,n,each:Math.floor(t/n)};
}
/* The Party roster (#91) plus this character. */
function endFightPartySize(c){return cleanParty(c&&c.party).length+1;}
/* The XP Done adds to: xpNumber() reads "6,350"; blank or text counts as 0. */
function endFightXpBase(c){const v=xpNumber(c&&c.xp);return v===null?0:v;}
/* The level the XP would make ready — only when the level-up is not ready
   before and is after, the rule Done opens it by. */
function endFightReadyLevel(c,add){
  if(advancementOf(c)!=="xp"||!(add>0))return null;
  const base=endFightXpBase(c),b=xpProgress(Object.assign({},c,{xp:base})),a=xpProgress(Object.assign({},c,{xp:base+add}));
  return a&&a.ready&&!(b&&b.ready)?a.level+1:null;
}
function endFightXpView(st,c){
  if(advancementOf(c)!=="xp")return null;
  const party=endFightPartySize(c),split=!!c&&c.xpSplit===true&&party>1,m=endFightXpMath(st.xp,split,party);
  const p=xpProgress(Object.assign({},c,{xp:endFightXpBase(c)})),lv=endFightReadyLevel(c,m.each);
  const status=m.each>0?`+${endFightN(m.each)} XP`:!p?"XP":p.next===null?`XP ${endFightN(p.xp)}`:`XP ${endFightN(p.xp)} / ${endFightN(p.next)}`;
  return {party,split,m,status,
    line:split&&m.typed>0?`${endFightN(m.typed)} ÷ ${m.n} = ${endFightN(m.each)} each`:"",
    ready:lv?`Level ${lv} ready — the level-up opens when you press Done.`:""};
}
function endFightXpToAdd(st,c){const x=endFightXpView(st,c);return x?x.m.each:0;}
function endFightXpSection(st,c){
  const x=endFightXpView(st,c);if(!x)return null;
  return {status:x.status,body:
    `<div class="field ec-xp"><label class="f" for="ecXp">XP</label><input id="ecXp" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="${esc(st.xp)}" autocomplete="off"></div>`+
    (x.party>1?`<div class="toggle"><div><div class="t-lbl">Split among ${esc(x.party)}</div></div>`+
      `<button type="button" class="switch${x.split?" on":""}" id="ecSplit" role="switch" aria-checked="${x.split?"true":"false"}" aria-label="Split among ${esc(x.party)}"></button></div>`:"")+
    `<p class="hint" id="ecXpLine"${x.line?"":" hidden"}>${esc(x.line)}</p>`+
    `<p class="ec-ready" id="ecXpReady"${x.ready?"":" hidden"}>${esc(x.ready)}</p>`};
}
/* Typing patches the status, the split line and the ready line in place, so
   the box keeps its caret. */
function endFightSetXp(v){
  const st=endFightLive();if(!st)return false;
  st.xp=String(v==null?"":v).slice(0,12);
  endFightXpPatch(st);
  return true;
}
/* A row's one-line status, set in place. The id is built per row, as
   endFightSectionHTML() renders it. */
function endFightSetStatus(k,text){const s=document.getElementById("ecSt-"+k);if(s)s.textContent=text;}
function endFightXpPatch(st){
  const x=endFightXpView(st,character);if(!x)return;
  endFightSetStatus("xp",x.status);
  const l=document.getElementById("ecXpLine");if(l){l.textContent=x.line;l.hidden=!x.line;}
  const r=document.getElementById("ecXpReady");if(r){r.textContent=x.ready;r.hidden=!x.ready;}
}
/* Split among N: saved on the character at once (xpSplit). */
function endFightSetSplit(on){
  if(!endFightLive())return false;
  character.xpSplit=!!on;scheduleSave();
  endFightRepaintSection("xp","#ecSplit");
  return character.xpSplit;
}
/* One row's {status, body}, or null to leave it out. */
function endFightSection(k,st,c){
  if(k==="ammo")return endFightAmmoSection(st,c);
  if(k==="xp")return endFightXpSection(st,c);
  return null;
}
/* Every attribute interpolates esc(k) whole: rules-data.js's attribute scan
   accepts nothing pre-escaped. */
function endFightSectionHTML(k,st,c){
  const s=endFightSection(k,st,c);if(!s)return "";
  const open=endCombatOpenOf(c)[k]===true;
  return `<section class="ec-sec" id="ecSec-${esc(k)}">`+
    `<button type="button" class="ec-row" data-ecrow="${esc(k)}" aria-expanded="${open?"true":"false"}" aria-controls="ecBody-${esc(k)}">`+
    `<svg class="fcaret${open?"":" c"}" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`+
    `<span class="ec-lbl">${esc(EC_LABEL[k]||k)}</span><span class="ec-st" id="ecSt-${esc(k)}">${esc(s.status)}</span></button>`+
    `<div class="ec-body" id="ecBody-${esc(k)}"${open?"":" hidden"}>${s.body}</div></section>`;
}
function endFightHTML(st,c){
  return `<div class="ec-wrap"><p class="ec-time">${esc(`Round ${st.rounds} · ${fmtCombatTime(st.sec)}`)}</p>`+
    `<div class="ec-scroll">${endFightSummaryHTML(st)}${EC_ROWS.map(k=>endFightSectionHTML(k,st,c)).join("")}</div>`+
    `<div class="m-actions ec-foot"><button type="button" class="tbtn primary" id="ecDone">Done</button></div></div>`;
}

/* ---- the DOM layer ---- */
/* A row opens or folds in place (never a rebuild: the XP box keeps its caret),
   remembered on the character. Returns whether it is now open. */
function endFightToggle(k){
  if(EC_ROWS.indexOf(k)<0||!endFightLive())return false;
  if(!character.endCombatOpen||typeof character.endCombatOpen!=="object"||Array.isArray(character.endCombatOpen))character.endCombatOpen={};
  const m=character.endCombatOpen;
  if(m[k]===true)delete m[k];else m[k]=true;
  const on=m[k]===true;
  scheduleSave();
  const b=document.querySelector(attrSel("data-ecrow",k)),body=document.getElementById("ecBody-"+k);
  if(b){b.setAttribute("aria-expanded",on?"true":"false");const cr=b.querySelector(".fcaret");if(cr)cr.classList.toggle("c",!on);}
  if(body)body.hidden=!on;
  return on;
}
/* One section redrawn from the state, focus put back by selector. */
function endFightRepaintSection(k,focusSel){
  const st=endFightLive(),el=document.getElementById("ecSec-"+k);if(!st||!el)return;
  el.outerHTML=endFightSectionHTML(k,st,character);
  if(focusSel){const f=document.querySelector(focusSel);if(f&&f.focus)f.focus({preventScroll:true});}
}
/* The toast's Undo recovery (undoRecoveryTap(), via applyAmmoRecovery's
   undo), offered only while this window is open; once. */
function endFightUndoAmmo(){
  const st=endFightLive(),a=st&&st.ammo;
  if(!a||a.undone||typeof a.undo!=="function")return false;
  if(!a.undo())return false;
  a.undone=true;
  endFightRepaintSection("ammo",attrSel("data-ecrow","ammo"));
  return true;
}
/* Wired once on #mBody, like the trade window's listener (67-trade.js), and
   idle unless this window is the one open. */
function endFightClick(e){
  if(!endFightLive()||!document.getElementById("ecDone"))return;
  const t=e&&e.target;if(!t||!t.closest)return;let m;
  if((m=t.closest("[data-ecrow]"))){endFightToggle(m.dataset.ecrow);return;}
  if(t.closest("#ecUndoAmmo")){endFightUndoAmmo();return;}
  if(t.closest("#ecSplit")){endFightSetSplit(character.xpSplit!==true);return;}
  if(t.closest("#ecDone")){endFightDone();return;}
}
function endFightWire(){
  const body=document.getElementById("mBody");if(!body||body.dataset.ecWired)return;
  body.dataset.ecWired="1";
  body.addEventListener("click",endFightClick);
  body.addEventListener("input",e=>{if(endFightLive()&&e.target&&e.target.id==="ecXp")endFightSetXp(e.target.value);});
}
