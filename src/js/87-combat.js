/* ================= combat view =================
   A full-screen view of the sections the player picked from any tab. They are
   the REAL cards, moved in while the view is open and back to a hidden marker
   at home when it closes: copies would duplicate every id (the #17 bug, where
   the visible copy updates and the hidden one rots), and a purpose-built
   dashboard would re-implement every section's controls. Closing the view never
   ends combat. Design: src/docs/specs/2026-09-24-combat-view-design.md

   The pure half comes first — no DOM — so src/tests/sheet.js can assert it. */

/* Only a real true: a hand-edited file saying "true" is not a fight. */
function inCombat(c){return !!c&&c.combatActive===true;}

/* Not an array means "never chosen" and gets the defaults. An EMPTY array is a
   real choice (the player took everything out) and stays empty. Unknown keys and
   repeats are dropped, so an old or hand-edited file cannot put a card in twice. */
function combatSectionsOf(c){
  const raw=c&&c.combatSections;
  if(!Array.isArray(raw))return COMBAT_DEFAULTS.slice();
  const known=new Set(NOTE_SECTIONS.map(s=>s.k)),out=[];
  raw.forEach(k=>{if(typeof k==="string"&&known.has(k)&&!out.includes(k))out.push(k);});
  return out;
}
function withCombatSection(list,k,on){
  if(on)return list.includes(k)?list.slice():list.concat([k]);
  return list.filter(x=>x!==k);
}
/* Undo's half of withCombatSection: back where it was, not at the end. A stale
   position clamps; a section already there is left alone. */
function insertCombatSection(list,k,at){
  if(list.includes(k))return list.slice();
  const out=list.slice();
  out.splice(Math.max(0,Math.min(out.length,at)),0,k);
  return out;
}
/* ↑/↓: past the next SHOWN section, and any hidden ones between. Skills in By
   ability mode is hidden in the view but keeps its slot, and an arrow press that
   only swapped with it would look like nothing happened. The hidden ones stay
   with the shown neighbour, as they do when dragging. */
function stepCombatSection(list,k,delta,shown){
  const from=list.indexOf(k);if(from<0)return list.slice();
  let i=from+delta;
  while(i>=0&&i<list.length&&!shown(list[i]))i+=delta;
  if(i<0||i>=list.length)return list.slice();
  const out=list.filter(x=>x!==k);
  out.splice(out.indexOf(list[i])+(delta>0?1:0),0,k);
  return out;
}
/* `to` is where the section ends up. Never edits the list it was given. */
function moveCombatSection(list,from,to){
  const out=list.slice();
  if(from<0||from>=out.length)return out;
  const [k]=out.splice(from,1);
  out.splice(Math.max(0,Math.min(out.length,to)),0,k);
  return out;
}

/* Start always means round 1, even over a round the Active Spells card left
   behind. Active spells are not touched: their time moves only when rounds do. */
function combatStart(c){c.combatActive=true;c.combatRound=1;}
/* The summary counts the round being ended as finished (round 7 → 7 rounds,
   42 sec), while the header shows the time at the START of the current round
   (combatElapsedSec: round 7 → 36 sec). Both on purpose — don't "fix" one to
   match the other. */
function combatEnd(c){
  const rounds=Math.max(0,num(c.combatRound));
  c.combatActive=false;c.combatRound=0;
  return {rounds,sec:rounds*6};
}
function combatElapsedSec(c){return Math.max(0,num(c&&c.combatRound)-1)*6;}
function fmtCombatTime(sec){
  sec=Math.max(0,Math.floor(num(sec)));
  if(sec<60)return sec+" sec";
  if(sec<3600){const m=Math.floor(sec/60),s=sec%60;return m+" min"+(s?" "+s+" sec":"");}
  const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);
  return h+" hr"+(m?" "+m+" min":"");
}

/* ---- the tab-bar button ----
   Idle: the crossed swords alone. In combat: highlighted, with the round, so it
   reads from any tab while you look something up. "Rd " is its own span so a
   phone-width tab bar can drop it and keep the number (45-combat.css); the
   aria-label still says "round N". */
function combatButtonHTML(c){
  return iconSVG("ui","Combat")+(inCombat(c)?`<span class="cv-rd"><span class="cv-rdw">Rd </span>${num(c.combatRound)}</span>`:"");
}
function renderCombatButton(){
  const b=document.getElementById("btnCombat");if(!b)return;
  const on=inCombat(character), l=on?`Combat view — round ${num(character.combatRound)}`:"Combat view";
  b.innerHTML=combatButtonHTML(character);
  b.classList.toggle("on",on);
  b.setAttribute("aria-label",l);b.title=l;
}
/* ================= the DOM layer ================= */
/* Session only, never saved: whether the view is open, where it and the page
   were scrolled, and whose cards those were. A reload starts closed; combat
   itself is saved on the character. */
let cvOpen=false, cvScroll=0, cvPageScroll=0, cvCharId=null;
function combatViewOpen(){return cvOpen;}

/* Found fresh every time, never cached: a card re-rendered while it sat in the
   view must still be the one that goes home. */
function combatCard(k){return document.querySelector(`.card[data-note="${k}"]`);}

/* What the toggle says: the title is the action, the aria-label adds the card. */
function combatToggleText(k,on){
  const l=(on?"Remove from":"Add to")+" combat view";
  return {title:l,label:l+" — "+noteTitle(noteDef(k))};
}
function combatToggleHTML(k,on){
  const t=combatToggleText(k,on);
  return `<button class="cvbtn${on?" on":""}" data-combatbtn="${esc(k)}" aria-pressed="${on?"true":"false"}" aria-label="${esc(t.label)}" title="${t.title}">`+
    iconSVG("ui","Combat","cvicon")+`</button>`;
}
/* A click repaints the one button in place. Replacing it (outerHTML) would drop
   keyboard focus from the button the player just pressed. */
function paintCombatToggle(k,on){
  const b=document.querySelector(`[data-combatbtn="${k}"]`);if(!b)return;
  const t=combatToggleText(k,on);
  b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false");
  b.setAttribute("aria-label",t.label);b.title=t.title;
}
/* Mirrors renderNoteIcons(): idempotent, replaces only its own button, and never
   label.innerHTML += — that re-parses the label and destroys #starBtn, #encPill
   and #roundNum. It goes just before the note button, which parks itself at the
   far right with margin-left:auto. */
function renderCombatToggles(){
  const on=new Set(combatSectionsOf(character));
  NOTE_SECTIONS.forEach(def=>{
    const card=combatCard(def.k);if(!card)return;
    const label=card.querySelector(".label");if(!label)return;
    const html=combatToggleHTML(def.k,on.has(def.k)), old=label.querySelector("[data-combatbtn]");
    if(old){old.outerHTML=html;return;}
    const note=label.querySelector("[data-notebtn]");
    if(note)note.insertAdjacentHTML("beforebegin",html);else label.insertAdjacentHTML("beforeend",html);
  });
}
/* Whether a card in the view actually shows. Computed style, not the inline one:
   the view's CSS overrides #activeSpellCard's inline display:none, but not the
   Skills card's in By ability mode. Not offsetParent either — fillCombatView()
   runs before the view itself is shown. */
function cvCardShown(card){return getComputedStyle(card).display!=="none";}
function renderCombatEmpty(){
  const e=document.getElementById("cvEmpty");if(!e)return;
  e.innerHTML=`Add sections with the ${iconSVG("ui","Combat")} button on any card.`;
  e.hidden=[...document.querySelectorAll("#cvList .card")].some(cvCardShown);
}
/* In: a hidden marker takes each card's place at home and the card goes to the
   end of the list, so cards arrive in the saved order. Cards already in the view
   are skipped, which makes this safe to call again to add one. */
function fillCombatView(){
  const list=document.getElementById("cvList");if(!list)return;
  combatSectionsOf(character).forEach(k=>{
    const card=combatCard(k);if(!card||card.closest("#combatView"))return;
    const home=document.createElement("span");home.hidden=true;home.dataset.cvhome=k;
    card.before(home);list.appendChild(card);addGrip(card,k);
  });
  renderCombatEmpty();
}
/* Out: the grip comes off, so no tab ever shows one, and the card takes its
   marker's place — exactly where it was. */
function sendCardHome(k){
  const home=document.querySelector(`[data-cvhome="${k}"]`),card=combatCard(k);
  if(card)removeGrip(card);
  if(home&&card)home.replaceWith(card);else if(home)home.remove();
}
function emptyCombatView(){document.querySelectorAll("[data-cvhome]").forEach(h=>sendCardHome(h.dataset.cvhome));}

/* ✕ · title · tracker · (space) · Start or End · ☰. End sits past the spacer,
   well away from the arrows, so a hurried tap on ▶ cannot hit it. On a phone
   CSS re-flows the same markup into two rows. The time has its own spans so it
   can stack under the round there. No aria-live here: this is repainted, and a
   live region that is replaced is never announced — #cvLive is. */
function combatHeaderHTML(c){
  const close=`<button class="tbtn" id="cvClose" aria-label="Close the combat view — combat keeps going" title="Close (combat keeps going)">✕</button>`;
  const title=`<span class="cv-title">${iconSVG("ui","Combat")}Combat</span>`;
  const toc=`<button class="tbtn" id="cvToc" aria-label="Jump to a section" title="Jump to a section">☰</button>`;
  if(!inCombat(c))return close+title+`<span class="grow"></span><button class="tbtn primary" id="cvStart">Start combat</button>`+toc;
  const r=num(c.combatRound);
  return close+title+
    `<span class="cv-track"><button class="tbtn" id="cvPrev" aria-label="Previous round"${r<=1?" disabled":""}>◀</button>`+
    `<span class="cv-round">Round <b>${r}</b><span class="cv-sep"> · </span><span class="cv-time">${fmtCombatTime(combatElapsedSec(c))}</span></span>`+
    `<button class="tbtn" id="cvNext" aria-label="Next round">▶</button></span>`+
    `<span class="grow"></span><button class="tbtn danger" id="cvEnd">End combat</button>`+toc;
}
/* Repainting replaces every button, so focus is carried across by id. When that
   button is gone or disabled — ◀ at round 1, Start once combat starts, End once
   it ends — focus goes where the next press is most likely. */
function renderCombatHeader(){
  const h=document.getElementById("cvHead");if(!h)return;
  const a=document.activeElement,had=a&&a.id&&h.contains(a)?a.id:"";
  h.innerHTML=combatHeaderHTML(character);
  if(inCombat(character))setCombatLive("Round "+num(character.combatRound));
  const instead={cvPrev:"cvNext",cvStart:"cvNext",cvEnd:"cvStart",cvNext:"cvStart"};
  for(let id=had,i=0;id&&i<4;id=instead[id],i++){
    const b=document.getElementById(id);
    if(b&&!b.disabled){b.focus();break;}
  }
}
/* The one live region, never repainted, so a screen reader hears each change. */
function setCombatLive(t){const l=document.getElementById("cvLive");if(l&&l.textContent!==t)l.textContent=t;}

function openCombatView(){
  if(cvOpen)return;
  const view=document.getElementById("combatView"),body=document.getElementById("cvBody");
  if(!view||!body)return;
  closeToc();
  if(character.id!==cvCharId){cvCharId=character.id;cvScroll=0;}
  cvPageScroll=window.scrollY;
  fillCombatView();
  document.documentElement.classList.add("cv-lock");
  view.classList.add("open");cvOpen=true;
  cvInert(true);
  setCombatLive("");   // no stale "Combat ended…" from another fight or character
  renderCombatHeader();
  body.scrollTop=cvScroll;
  const x=document.getElementById("cvClose");if(x)x.focus();
}
/* Closing NEVER ends combat — End combat is its own button. */
function closeCombatView(){
  if(!cvOpen)return;
  const view=document.getElementById("combatView"),body=document.getElementById("cvBody");
  if(body)cvScroll=body.scrollTop;
  closeToc();
  emptyCombatView();
  if(view)view.classList.remove("open");
  document.documentElement.classList.remove("cv-lock");
  cvOpen=false;cvInert(false);
  window.scrollTo({top:cvPageScroll});
  const b=document.getElementById("btnCombat");if(b)b.focus({preventScroll:true});
}
/* The view is aria-modal, but that alone does not stop Tab: the page behind it
   stays focusable, invisibly. inert takes the top bar, tab bar and page out of
   reach while the view is open. The modal, the item finder, the ☰ flyout and the
   toast all sit OUTSIDE these three, so they keep working over the view. */
function cvInert(on){
  document.querySelectorAll(".topbar,.tabbar,.page").forEach(el=>{if(on)el.setAttribute("inert","");else el.removeAttribute("inert");});
}
/* viaKey: the click came from Enter/Space (event.detail 0), not a pointer. */
function toggleCombatSection(k,viaKey){
  const def=noteDef(k);if(!def)return;
  const cur=combatSectionsOf(character), on=!cur.includes(k), at=cur.indexOf(k), who=character.id;
  const fromView=!on&&cvOpen&&!!document.querySelector(`#cvList [data-combatbtn="${k}"]`);
  character.combatSections=withCombatSection(cur,k,on);
  if(cvOpen){if(on)fillCombatView();else{sendCardHome(k);renderCombatEmpty();}}
  paintCombatToggle(k,on);scheduleSave();
  if(on){toast("Added "+noteTitle(def)+" to the combat view");return;}
  /* Removing is one tap, and Active Spells and Familiars hide themselves on their
     tab when empty — so their toggle cannot bring them back. The Undo can. */
  const undo=toast("Removed "+noteTitle(def)+" from the combat view",{label:"Undo",
    run:e=>undoCombatRemove(k,at,who,!!e&&e.detail===0),
    back:fromView?()=>(cvOpen?cvFocusAfter(at):null):null});
  /* The pressed toggle just went home with its card, and keyboard focus with it.
     Inside the view, land the keyboard on the Undo instead: Enter puts the card
     back, and Tab or Esc returns to the card that took its place. */
  if(viaKey&&fromView&&undo)undo.focus();
}
/* Where the keyboard goes after a removal from the view: the grip of the card
   that now fills the gap, else the last card's, else ✕. */
function cvFocusAfter(at){
  const cards=[...document.querySelectorAll("#cvList > .card")].filter(cvCardShown);
  const c=cards[Math.min(at,cards.length-1)];
  return (c&&c.querySelector("[data-cvgrip]"))||document.getElementById("cvClose");
}
/* Back in the place it was taken from. `who` guards a toast that outlived a
   character switch: its Undo belongs to the character it was shown for. After a
   keyboard Undo, focus goes to the restored card's own toggle. */
function undoCombatRemove(k,at,who,viaKey){
  if(!character||character.id!==who)return;
  const cur=combatSectionsOf(character);if(cur.includes(k))return;
  const list=insertCombatSection(cur,k,at);
  character.combatSections=list;
  /* fill appends the card at the end; the re-lay puts it back in its place */
  if(cvOpen){fillCombatView();setCombatOrder(list);}else scheduleSave();
  paintCombatToggle(k,true);
  toast(noteTitle(noteDef(k))+" is back in the combat view");
  if(viaKey){const b=document.querySelector(`[data-combatbtn="${k}"]`);if(b)b.focus();}
}

/* Everything that shows combat state repaints through here. The round moves from
   three places — the view's arrows, the Active Spells card's own buttons, and
   Start/End — so none of them can disagree. */
function renderCombatChrome(){renderCombatButton();if(cvOpen)renderCombatHeader();}
/* The last thing renderAll() does — and every character switch ends in
   renderAll(). An open view re-lays itself from THIS character's list, keeping
   its scroll for the same character; another character's remembered scroll is
   dropped, since it belonged to other cards. */
function syncCombatView(){
  const switched=character.id!==cvCharId;
  if(switched){cvCharId=character.id;cvScroll=0;}
  if(cvOpen){
    const body=document.getElementById("cvBody"),keep=(!switched&&body)?body.scrollTop:0;
    emptyCombatView();fillCombatView();
    if(body)body.scrollTop=keep;
  }
  renderCombatToggles();renderCombatChrome();
}

/* ---- the tracker ---- */
function startCombatNow(){combatStart(character);renderActiveSpells();renderCombatChrome();scheduleSave();}
/* Asked first: the round count is the one thing here a stray tap would lose. */
function endCombatAsk(){
  const r=num(character.combatRound);
  if(!confirm(`End combat at round ${r}?`))return false;
  const s=combatEnd(character);
  renderActiveSpells();renderCombatChrome();scheduleSave();
  const msg=`Combat ended after ${s.rounds} round${s.rounds===1?"":"s"} (${fmtCombatTime(s.sec)})`;
  toast(msg);setCombatLive(msg);
  return true;
}

/* ---- arranging ----
   Inside the view only, each card heading gets a grip. The grip is a real
   <button>: focused, ↑ and ↓ move its card one place — the path for anyone
   without a mouse or touch. */
function combatGripHTML(k){
  const t=noteTitle(noteDef(k));
  return `<button class="cv-grip" data-cvgrip="${esc(k)}" aria-label="Move ${esc(t)} — ↑ and ↓ move it one place" title="Drag to move">`+
    `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>`;
}
function addGrip(card,k){const l=card.querySelector(".label");if(l&&!l.querySelector("[data-cvgrip]"))l.insertAdjacentHTML("afterbegin",combatGripHTML(k));}
function removeGrip(card){const g=card.querySelector("[data-cvgrip]");if(g)g.remove();}
/* The saved order is the truth; the view is re-laid from it. */
function setCombatOrder(list){
  character.combatSections=list;
  const box=document.getElementById("cvList");
  if(box)list.forEach(k=>{const c=combatCard(k);if(c&&c.parentNode===box)box.appendChild(c);});
  scheduleSave();
}
function moveCombatCard(k,delta){
  const list=combatSectionsOf(character);
  /* A card is skipped only when it sits in the view and does not show there. */
  const next=stepCombatSection(list,k,delta,x=>{const c=combatCard(x);return !c||!c.closest("#combatView")||cvCardShown(c);});
  if(next.join()===list.join())return;
  setCombatOrder(next);
  const g=document.querySelector(`[data-cvgrip="${k}"]`);if(g)g.focus();
}
/* Pointer events, not HTML5 drag-and-drop, which is unreliable on phones. The
   dragged card is NEVER moved itself — moving an element can drop its pointer
   capture mid-drag — so its NEIGHBOURS hop over it instead. A hidden card (Skills
   in By ability mode) has no height to pass, so it is never the neighbour: it
   hops along with the next shown one. Near the view's top or bottom edge the
   view scrolls. The order is read back off the DOM on release. */
function startCombatDrag(e,grip){
  const card=grip.closest(".card"),list=document.getElementById("cvList"),body=document.getElementById("cvBody");
  if(!card||!list||!body||card.parentNode!==list)return;
  e.preventDefault();
  try{grip.setPointerCapture(e.pointerId);}catch(err){}
  card.classList.add("cv-dragging");
  const mid=el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;};
  const shownSib=(el,dir)=>{do el=el[dir];while(el&&!cvCardShown(el));return el;};
  const run=(a,b)=>{const out=[];for(let x=a;x;x=x.nextElementSibling){out.push(x);if(x===b)break;}return out;};
  const move=ev=>{
    const y=ev.clientY,prev=shownSib(card,"previousElementSibling"),next=shownSib(card,"nextElementSibling");
    if(prev&&y<mid(prev))card.after(...run(prev,card.previousElementSibling));
    else if(next&&y>mid(next))card.before(...run(card.nextElementSibling,next));
    const b=body.getBoundingClientRect();
    if(y<b.top+48)body.scrollTop-=14;else if(y>b.bottom-48)body.scrollTop+=14;
  };
  /* lostpointercapture ends it too. If the grip is detached mid-drag (a
     re-render), pointerup never reaches it and the browser fires this at the
     DOCUMENT, so it is heard there. It also follows every pointerup, hence `over`. */
  let over=false;
  const lost=ev=>{if(ev.pointerId===e.pointerId)done();};
  const done=()=>{
    if(over)return;over=true;
    grip.removeEventListener("pointermove",move);grip.removeEventListener("pointerup",done);grip.removeEventListener("pointercancel",done);
    document.removeEventListener("lostpointercapture",lost);
    card.classList.remove("cv-dragging");
    const shown=[...list.querySelectorAll(":scope > .card[data-note]")].map(c=>c.dataset.note);
    setCombatOrder(shown.concat(combatSectionsOf(character).filter(k=>!shown.includes(k))));
  };
  grip.addEventListener("pointermove",move);grip.addEventListener("pointerup",done);grip.addEventListener("pointercancel",done);
  document.addEventListener("lostpointercapture",lost);
}
