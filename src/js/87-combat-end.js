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
/* A rules term or table link inside a page shown here (After combat): inert,
   see endFightKey(). One selector for the click and the key; the CSS that
   drops their pointer (50-modal.css) spells the same two out. */
const EC_INERT=".ec-page .kw,.ec-page .tblref";
/* The trade's With box's maxlength (67-trade.js): Loot's seeded name fits it. */
const EC_WITH_MAX=60;
let _endFight=null;
function endFightLive(){if(_endFight&&_endFight.who!==character)_endFight=null;return _endFight;}
function endCombatOpenOf(c){const m=c&&c.endCombatOpen;return (m&&typeof m==="object"&&!Array.isArray(m))?m:{};}
function openEndOfCombat(r){
  const o=r||{},a=(o.ammo&&typeof o.ammo==="object")?o.ammo:{};
  _endFight={who:character,rounds:Math.max(0,num(o.rounds)),sec:Math.max(0,num(o.sec)),
    combatants:Array.isArray(o.combatants)?o.combatants:[],
    ammo:{logged:Array.isArray(a.logged)?a.logged:[],lines:Array.isArray(a.lines)?a.lines:[],undo:typeof a.undo==="function"?a.undo:null,undone:false},
    xp:"",traded:"",asking:false,opener:null,openerSel:null,
    trk:endFightAfterLists(character).trackers.length>0};   /* the After combat list stays for the window's life (endFightTrkList()) */
  endFightShow();
  /* What opened it, for focus to go back to on the final close: the trade's
     round trip reopens the window over whatever the trade left focused. */
  if(_endFight){_endFight.opener=_modalOpener;_endFight.openerSel=_modalOpenerSel;}
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
  const n=endFightXpToAdd(st,character),base=endFightXpBase(character);
  if(!(n>0)||base===null)return false;   /* XP the sheet can't read is never overwritten (Ruling 21) */
  const lv=endFightReadyLevel(character,n);
  character.xp=base+n;
  renderLevelBadge();scheduleSave();
  if(lv&&levelUp)doLevelUp();
  return true;
}
/* Done: adds the XP (its share when split), closes the window, and opens the
   level-up when that XP reached a level. Returns whether it closed. Not while
   the box holds something that isn't a whole number: the row opens if it was
   folded and focus goes to the box, under its "Whole numbers only". */
function endFightDone(){
  const st=endFightLive();if(!st)return false;
  const x=endFightXpView(st,character);
  if(x&&x.bad){
    if(endCombatOpenOf(character).xp!==true)endFightToggle("xp");
    const b=document.getElementById("ecXp");if(b&&b.focus)b.focus({preventScroll:true});
    return false;
  }
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
/* The box's number. A text box, not type=number: Safari's number box lets
   letters in and then reports them as blank, which dropped the XP silently.
   So the parse is strict: digits, or digits in thousands groups ("6,350"),
   and nothing else. Blank is 0; above 1,000,000 is 1,000,000; anything else
   is null — not a number, and the window says so. */
function endFightXpInt(v){
  const s=String(v==null?"":v).trim();if(!s)return 0;
  if(!/^(\d+|\d{1,3}(,\d{3})+)$/.test(s))return null;
  return Math.min(1000000,parseInt(s.replace(/,/g,""),10));
}
/* What Done adds: the typed number, or its share, rounded down. */
function endFightXpMath(typed,split,party){
  const t=endFightXpInt(typed)||0,n=split?Math.max(1,Math.floor(num(party))):1;
  return {typed:t,n,each:Math.floor(t/n)};
}
/* The Party roster (#91) plus this character. */
function endFightPartySize(c){return cleanParty(c&&c.party).length+1;}
/* The XP Done adds to, read by the sheet's own xpNumber() so the window and
   the sheet agree (Ruling 21): "6,350" is 6350 and blank is 0. Text it can't
   read ("6350 xp", "lots") is null: Done never overwrites it. */
function endFightXpBase(c){
  const v=c&&c.xp;
  if(v==null||(typeof v==="string"&&!v.trim()))return 0;
  return xpNumber(v);
}
/* The level the XP would make ready — only when the level-up is not ready
   before and is after, the rule Done opens it by. */
function endFightReadyLevel(c,add){
  if(advancementOf(c)!=="xp"||!(add>0))return null;
  const base=endFightXpBase(c);if(base===null)return null;
  const b=xpProgress(Object.assign({},c,{xp:base})),a=xpProgress(Object.assign({},c,{xp:base+add}));
  return a&&a.ready&&!(b&&b.ready)?a.level+1:null;
}
/* The Experience row's view. `unread`: the sheet's XP is text xpNumber()
   can't read, so there is no box and nothing to add. `bad`: the box holds
   something that isn't a whole number — "Whole numbers only" under it, the
   status as if nothing were typed, and Done refuses until it is fixed. */
function endFightXpView(st,c){
  if(advancementOf(c)!=="xp")return null;
  const party=endFightPartySize(c),split=!!c&&c.xpSplit===true&&party>1;
  if(endFightXpBase(c)===null)return {party,split,m:{typed:0,n:1,each:0},status:"XP",err:"",line:"",ready:"",bad:false,unread:true};
  const bad=endFightXpInt(st.xp)===null,m=endFightXpMath(bad?"":st.xp,split,party);
  const p=xpProgress(Object.assign({},c,{xp:endFightXpBase(c)})),lv=endFightReadyLevel(c,m.each);
  const status=m.each>0?`+${endFightN(m.each)} XP`:!p?"XP":p.next===null?`XP ${endFightN(p.xp)}`:`XP ${endFightN(p.xp)} / ${endFightN(p.next)}`;
  return {party,split,m,status,bad,unread:false,
    err:bad?"Whole numbers only":"",
    line:split&&m.typed>0?`${endFightN(m.typed)} ÷ ${m.n} = ${endFightN(m.each)} each`:"",
    ready:lv?`Level ${lv} ready — the level-up opens when you press Done.`:""};
}
function endFightXpToAdd(st,c){const x=endFightXpView(st,c);return x?x.m.each:0;}
function endFightXpSection(st,c){
  const x=endFightXpView(st,c);if(!x)return null;
  if(x.unread)return {status:x.status,body:`<p class="hint" id="ecXpUnread">Your XP on the sheet isn't a number, so it can't be added to here.</p>`};
  return {status:x.status,body:
    `<div class="field ec-xp"><label class="f" for="ecXp">XP</label><input id="ecXp" type="text" inputmode="numeric" maxlength="12" value="${esc(st.xp)}" autocomplete="off" aria-describedby="ecXpErr"${x.bad?` aria-invalid="true"`:""}></div>`+
    `<p class="hint ec-err" id="ecXpErr"${x.err?"":" hidden"}>${esc(x.err)}</p>`+
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
  const er=document.getElementById("ecXpErr");if(er){er.textContent=x.err;er.hidden=!x.err;}
  const b=document.getElementById("ecXp");if(b&&b.setAttribute){if(x.bad)b.setAttribute("aria-invalid","true");else if(b.removeAttribute)b.removeAttribute("aria-invalid");}
  const r=document.getElementById("ecXpReady");if(r){r.textContent=x.ready;r.hidden=!x.ready;}
}
/* Split among N: saved on the character at once (xpSplit). */
function endFightSetSplit(on){
  if(!endFightLive())return false;
  character.xpSplit=!!on;scheduleSave();
  endFightRepaintSection("xp","#ecSplit");
  return character.xpSplit;
}
/* ---- Loot (spec §4.4): always shown; a trade, so it lands in the inventory log ---- */
/* The trade's other party: the fallen FOES, by name (a fallen party member is
   struck through in the summary but never named: the loot came from the
   foes), or "Combat loot". Raw text: the trade window escapes it where drawn. */
function endFightLootWith(list){
  const names=(Array.isArray(list)?list:[]).filter(r=>r&&typeof r==="object"&&r.kind==="foe"&&combatantDead(r)).map(r=>String(r.name||"").trim()).filter(Boolean);
  return names.length?endFightNamesCap(names,EC_WITH_MAX):"Combat loot";
}
/* The trade's With box holds 60 characters (maxlength, 67-trade.js), and a
   seeded value would get past it. So the names are cut at a name, with the
   rest counted: "Goblin 1, Goblin 2, … and 3 more". A first name too long on
   its own is cut inside it ("…"). Cut by characters, never mid-surrogate. */
function endFightNamesCap(names,max){
  const all=names.join(", ");if(all.length<=max)return all;
  for(let k=names.length-1;k>=1;k--){const s=names.slice(0,k).join(", ")+`, … and ${names.length-k} more`;if(s.length<=max)return s;}
  const tail=names.length>1?` and ${names.length-1} more`:"",cs=Array.from(names[0]);
  let cut="";for(const ch of cs){if((cut+ch).length+1+tail.length>max)break;cut+=ch;}
  return cut+"…"+tail;
}
function endFightLootSection(st){
  return {status:st.traded||"Open trade…",
    body:`<p>Coins and items from the fight go through a trade, so they're in your inventory log.</p>`+
      `<button type="button" class="tbtn" id="ecTrade">Open trade</button>`};
}
/* The trade window replaces this one (the modal has one layer); its onClose
   brings this back from _endFight, as it was. */
function endFightOpenLoot(){
  const st=endFightLive();if(!st)return false;
  openTrade({with:endFightLootWith(st.combatants),onClose:endFightReopen});
  return true;
}
/* The trade's onClose (tradeClosed() runs it once, however the trade closed).
   Back only for the character it was opened for (endFightLive()), and only
   onto a free modal, or onto this window itself: if something else has taken
   the modal meanwhile, the window is not drawn over it and its state goes, as
   on ×. endFightShow() sets the dismiss guard again. */
function endFightReopen(done){
  const st=endFightLive();if(!st)return false;
  const m=document.getElementById("modal");
  if(m&&m.classList&&m.classList.contains("open")&&!document.getElementById("ecDone")){_endFight=null;return false;}
  if(done&&typeof done==="object"&&done.title)st.traded=String(done.title);
  if(!endFightShow())return false;
  /* openModal() took whatever the trade left focused as this window's opener;
     put back the one it had, and the player back on Open trade. */
  _modalOpener=st.opener;_modalOpenerSel=st.openerSel;
  const b=document.getElementById("ecTrade");if(b&&b.focus)b.focus({preventScroll:true});
  return true;
}
/* ---- After combat (spec §4.5): the open trackers and the pages flagged
   "Show after combat" — none while the Journal tab is hidden (#52), and no
   trackers while the sheet's trackers are switched off. Nothing changes on
   its own: the tiles' + and − and the pages' boxes are the player's. ---- */
function endFightAfterLists(c){
  if(isTabHidden("journal",c))return {trackers:[],pages:[]};
  return {trackers:showTrackers(c)?trkList(c).filter(t=>t.closed!==true&&t.afterCombat===true):[],
    pages:jnlSort(jnlPages(c).filter(p=>p.afterCombat===true))};
}
function endFightAfterStatus(l){
  const n=(k,w)=>k?`${k} ${w}${k===1?"":"s"}`:"";
  return [n(l.trackers.length,"tracker"),n(l.pages.length,"page")].filter(Boolean).join(" · ");
}
/* The tracker list's content. Once the window opened with trackers, the list
   stays for its life (st.trk), so the toast's Undo can paint a closed tile
   back into it — across a trade's round trip too. With none left open it reads
   "Nothing here is still open." (the row "All done"), or, with pages below
   it, simply hides. */
function endFightTrkList(l){
  if(l.trackers.length)return {html:l.trackers.map(t=>trackerRowHTML(t,{noEdit:true})).join(""),hidden:false};
  return l.pages.length?{html:"",hidden:true}:{html:`<p class="hint">Nothing here is still open.</p>`,hidden:false};
}
function endFightAfterSection(st,c){
  if(isTabHidden("journal",c))return null;
  const l=endFightAfterLists(c),keep=l.trackers.length>0||(!!(st&&st.trk)&&showTrackers(c));
  if(!keep&&!l.pages.length)return null;
  const t=endFightTrkList(l);
  return {status:endFightAfterStatus(l)||"All done",
    body:(keep?`<div class="trk-group ec-trk" id="ecTrkList"${t.hidden?" hidden":""}>${t.html}</div>`:"")+
      l.pages.map(p=>{const b=noteHTML(jnlStr(p.text));
        return `<div class="ec-page" data-ecpage="${esc(p.id)}"><h4 class="ec-ph">${esc(jnlTitle(p))}</h4>${b?`<div class="n-body">${b}</div>`:""}</div>`;}).join("")};
}
/* renderTrackers() calls this for the window's copy of the tiles. */
function endFightPaintTrackers(box){
  const l=endFightAfterLists(character),t=endFightTrkList(l);
  box.innerHTML=t.html;box.hidden=t.hidden;
  endFightSetStatus("after",endFightAfterStatus(l)||"All done");
}
/* A tick on a page shown here: that page's line, as on the Journal tab
   (jnlTogglePage(), which also redraws the tab), then this page's body, with
   focus back on the same box. */
function endFightTick(id,n){
  if(!endFightLive())return false;
  if(!jnlTogglePage(id,n))return false;
  const p=jnlPages(character).find(x=>x.id===id),box=document.querySelector(attrSel("data-ecpage",id)+" .n-body");
  if(box&&p){box.innerHTML=noteHTML(jnlStr(p.text));const b=box.querySelector(`[data-ck="${num(n)}"]`);if(b&&b.focus)b.focus({preventScroll:true});}
  return true;
}
/* A rules term or table link in a page here would open its own dialog over
   this one — the modal has one layer — and lose what the window holds. Here
   they are words: the tap or the key stops at the window (#mBody's listeners
   run before the document's dispatchers, so stopPropagation() is enough).
   And Enter in the XP box is Done, as in any one-field form — once per press
   (a held key repeats), never while an input method is composing. */
function endFightKey(e){
  if(!e||!(e.key==="Enter"||e.key===" "))return;
  const t=e.target;if(!t)return;
  if(e.key==="Enter"&&t.id==="ecXp"){if(e.isComposing)return;e.preventDefault();if(!e.repeat)endFightDone();return;}
  if(!t.closest)return;
  if(t.closest(EC_INERT)){e.preventDefault();e.stopPropagation();}
}
/* One row's {status, body}, or null to leave it out. */
function endFightSection(k,st,c){
  if(k==="ammo")return endFightAmmoSection(st,c);
  if(k==="xp")return endFightXpSection(st,c);
  if(k==="loot")return endFightLootSection(st,c);
  if(k==="after")return endFightAfterSection(st,c);
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
  if(t.closest(EC_INERT)){e.preventDefault();e.stopPropagation();return;}
  if((m=t.closest("[data-ecrow]"))){endFightToggle(m.dataset.ecrow);return;}
  if(t.closest("#ecUndoAmmo")){endFightUndoAmmo();return;}
  if(t.closest("#ecSplit")){endFightSetSplit(character.xpSplit!==true);return;}
  if(t.closest("#ecTrade")){endFightOpenLoot();return;}
  if(t.closest("#ecDone")){endFightDone();return;}
}
function endFightWire(){
  const body=document.getElementById("mBody");if(!body||body.dataset.ecWired)return;
  body.dataset.ecWired="1";
  body.addEventListener("click",endFightClick);
  body.addEventListener("input",e=>{if(endFightLive()&&e.target&&e.target.id==="ecXp")endFightSetXp(e.target.value);});
  body.addEventListener("keydown",e=>{if(endFightLive()&&document.getElementById("ecDone"))endFightKey(e);});
}
