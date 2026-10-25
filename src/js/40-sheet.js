/* ---- hidden tabs (#52) ----
   Per character: the word tabs a player has switched off in Settings → Sheet
   display. The Sheet and the combat swords can never be hidden. */
const HIDEABLE_TABS=["spells","inventory","story","journal","rules"];
const TAB_LABELS={spells:"Spells",inventory:"Inventory",story:"Bio",journal:"Journal",rules:"Rules"};
function isTabHidden(name,c){
  c=c||character;
  return HIDEABLE_TABS.indexOf(name)>=0&&!!c&&Array.isArray(c.hiddenTabs)&&c.hiddenTabs.indexOf(name)>=0;
}
/* migrate()'s cleaner: only real hideable names, each once, in order */
function cleanHiddenTabs(v){
  const out=[];
  (Array.isArray(v)?v:[]).forEach(t=>{if(HIDEABLE_TABS.indexOf(t)>=0&&out.indexOf(t)<0)out.push(t);});
  return out;
}
function applyHiddenTabs(){
  document.querySelectorAll(".tab[data-tab]").forEach(b=>{b.hidden=isTabHidden(b.dataset.tab);});
  const act=(document.querySelector(".tabpanel.active")||{id:""}).id.replace(/^tab-/,"");
  if(isTabHidden(act))selectTab("sheet");
}
function setTabHidden(name,hide){
  if(HIDEABLE_TABS.indexOf(name)<0)return;
  const list=cleanHiddenTabs(character.hiddenTabs).filter(t=>t!==name);
  if(hide)list.push(name);
  character.hiddenTabs=list;
  applyHiddenTabs();scheduleSave();
}

/* Show a tab. Deliberately does NOT scroll: the tab bar's own handler wants the
   top of the page, but jumping to a note wants that note's card — so the scroll
   is the caller's decision, not this function's. */
function selectTab(name){
  if(isTabHidden(name))name="sheet";   /* #52: a stale caller never opens a hidden panel */
  /* The combat view is a tab whose cards belong to the OTHER tabs. Leaving it
     sends them home first, or a note link would land on a tab with its cards
     missing; entering it remembers where it came from, for the swords. */
  const was=(document.querySelector(".tabpanel.active")||{id:"tab-sheet"}).id.replace(/^tab-/,"");
  /* Entering the Rules tab from elsewhere always opens on its category list
     (spec #7), never the table a previous visit left on. */
  if(name==="rules"&&was!=="rules")rbToList();
  if(name!=="combat")closeCombatView();
  else if(was!=="combat")cvPrevTab=was;
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  document.querySelectorAll(".tabpanel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+name));
  /* its button is the swords in .tab-tools, not a .tab */
  const cb=document.getElementById("btnCombat");if(cb)cb.classList.toggle("active",name==="combat");
  if(name==="combat")openCombatView();
  closeShFly();
}
/* Scroll a card to just under the sticky tab bar, whose height is measured live
   rather than assumed. Used by the notes jump and the journal. */
function scrollToCard(el){
  if(!el)return;
  /* In the combat tab its own header sticks under the tab bar, so clear both. */
  const tb=document.querySelector(".tabbar"),ch=el.closest("#combatView")&&document.getElementById("cvHead");
  const off=(tb?tb.getBoundingClientRect().height:48)+(ch?ch.getBoundingClientRect().height:0)+10;
  const y=el.getBoundingClientRect().top+window.scrollY-off;
  window.scrollTo({top:Math.max(0,y),behavior:"smooth"});
}
/* Back to top (#103): the round button in the bottom corner (#btnToTop). It
   shows once the page has scrolled past one screenful and hides above it;
   hidden, it is visibility:hidden, so neither a tap nor Tab can reach it.
   wire() runs updateToTop() from a passive scroll listener, at most once a
   frame. */
function toTopShown(y,h){return num(y)>Math.max(1,num(h));}
function updateToTop(){
  const b=document.getElementById("btnToTop");if(!b)return;
  b.classList.toggle("show",toTopShown(window.scrollY,window.innerHeight));
}
/* "auto" (an instant jump) for a player who asked the system for less motion. */
function toTopBehavior(){
  const mq=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)");
  return mq&&mq.matches?"auto":"smooth";
}
/* The button hides as the page reaches the top, and a focused element that
   hides drops focus to <body>; so focus goes to the tab showing (the swords in
   the combat view), the first stop at the top of the page. preventScroll: the
   tab bar is sticky, and a focus scroll would cut the smooth one short. */
function scrollToTop(){
  window.scrollTo({top:0,behavior:toTopBehavior()});
  const t=combatViewOpen()?document.getElementById("btnCombat"):document.querySelector(".tab.active");
  if(t&&t.focus)t.focus({preventScroll:true});
}
/* A player's category as the section it names (#98). One of INV_ORDER in any
   case files there ("consumables" is Consumables, so it is still read for its
   healing); anything else is their own section, tidied as a tag is. "" for
   none, and for the favourites heading, which is not a section. */
function invSectionName(v){
  const l=tagLabel(v);if(!l)return "";
  const k=l.toLowerCase();
  if(k===INV_FAV.toLowerCase())return "";
  return INV_ORDER.find(s=>s.toLowerCase()===k)||l;
}
function invSection(it){
  const ov=invSectionName(it.sectionOverride);
  if(ov)return ov;
  const c=String(it.category||it.type||"").toLowerCase();
  if(it.weapon||c.includes("weapon"))return "Weapons";
  if(itemArmor(it)||c.includes("armor")||c.includes("shield"))return "Armor";
  /* Word boundaries are load-bearing, not tidiness: without them "ring" matches
     inside "Adventu-RING Gear" and every rope and bedroll files as a magic item,
     and "staff" matches inside "Quarterstaff". These only started mattering when
     items began carrying a real category. */
  if(/\b(potion|scroll|consumable|ammunition)\b/.test(c))return "Consumables";
  if(/\b(wand|rod|staff|ring|wondrous|focus)\b/.test(c))return "Magic Items";
  if(/\b(tool|tools|kit|instrument|supplies|utensils)\b/.test(c))return "Tools";
  if(/gear/.test(c))return "Gear";
  return "Loot";
}
const INV_ORDER=["Weapons","Armor","Consumables","Magic Items","Tools","Gear","Loot"];
/* the pinned section's title, and its collapse key — the label FEAT_FAV and
   ATK_FAV share */
const INV_FAV="★ Favorites";
/* The sections the inventory draws, in order, each {title, items} sorted as
   shown: ★ Favorites by name, then the seven built-in sections, then the
   player's own (#98) A to Z, each with equipped items first and then by name.
   A player's sections group by tagKey(), labelled by the first spelling met.
   Empty sections are left out. Pure, so the order can be asserted:
   renderInventory() only draws it. */
function invGroups(list){
  const all=Array.isArray(list)?list.filter(it=>it&&typeof it==="object"):[];
  const byName=(a,b)=>String(a.name||"").localeCompare(String(b.name||""));
  const eqThenName=(a,b)=>((b.equipped?1:0)-(a.equipped?1:0))||byName(a,b);
  const by=new Map();
  all.filter(it=>!it.fav).forEach(it=>{const t=invSection(it),k=tagKey(t);if(!by.has(k))by.set(k,{title:t,items:[]});by.get(k).items.push(it);});
  const own=[...by.keys()].filter(k=>!INV_ORDER.some(s=>s.toLowerCase()===k)).sort((a,b)=>a.localeCompare(b));
  const out=[];
  const favs=all.filter(it=>it.fav);
  if(favs.length)out.push({title:INV_FAV,items:favs.sort(byName)});
  INV_ORDER.map(s=>s.toLowerCase()).concat(own).forEach(k=>{const g=by.get(k);if(g)out.push({title:g.title,items:g.items.sort(eqThenName)});});
  return out;
}
/* ---- using an item ----
   What drinking, reading or activating this item does. An explicit `use` block
   the player configured wins; failing that a consumable is READ from its own
   text, which is the same "auto-infer unless the player said otherwise" rule
   detectSpellAttack follows for spells — and it is what makes a potion added
   through the item browser usable without anyone editing it first. `off` is how
   "no, this one is not usable" is recorded against a detected default, so
   clearing the boxes sticks. */
function itemUse(it){
  const u=it&&it.use;
  if(u&&u.off)return null;
  if(u&&(u.heal||u.status||u.consume))return u;
  return detectItemUse(it);
}
/* Deliberately narrow. Only consumables are read, and only the one phrase every
   healing potion in the 2024 data uses ("regains 2d4 + 2 Hit Points"), so a
   wand that "regains 1d3 expended charges" is not mistaken for a heal. */
function detectItemUse(it){
  if(!it||invSection(it)!=="Consumables")return null;
  const m=/\bregains?\s+(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s+(?:hit points|hp)\b/i.exec(String(it.description||""));
  if(!m)return null;
  return {heal:m[1].replace(/\s+/g,""),consume:true};
}
function itemUsesMax(it){return (it&&it.uses)?usesMax(it):0;}
function itemUsable(it){return !!(itemUse(it)||itemUsesMax(it)>0);}
/* One line saying what Use will do, so nothing about it is hidden behind the
   button. Prose, not effect chips — none of it is a numeric modifier. */
function itemUseLine(it){
  const u=itemUse(it);if(!u)return "";
  const bits=[];
  if(u.heal)bits.push(`Heals ${u.heal}`);
  if(u.status)bits.push(`Applies ${u.status}`);
  if(u.consume)bits.push("uses one up");
  return bits.length?`<div class="use-cost">${esc(bits.join(" · "))}</div>`:"";
}
function itemUsesRowHTML(it){
  const mx=itemUsesMax(it);if(!mx)return "";
  const used=num(it.uses.used),per=it.uses.per;
  let pips="";for(let i=1;i<=mx;i++)pips+=`<button class="use-b ${i<=used?"used":""}" data-iuse="${esc(it.id)}" data-i="${esc(i)}" aria-label="Use"></button>`;
  return `<div class="use-row"><span class="use-lbl">Uses${(per&&per!=="none")?` · per ${esc(per)} rest`:""}</span><span class="use-pips">${pips}</span></div>`;
}
function invItemHTML(it){
  const ic=!!invCol().items[it.id];
  return `<div class="item fitem"><div class="top split">
        <button class="fitoggle" data-invitem="${esc(it.id)}" aria-label="Collapse item"><svg class="fcaret ${ic?"c":""}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
        <button class="fav ${it.fav?"on":""}" data-fav-item="${esc(it.id)}" aria-label="Favorite" title="Favorite">${it.fav?"★":"☆"}</button>
        <span class="nm">${esc(it.name||"Item")}</span>
        <span class="row-meta">
        ${itemQty(it)!==1?`<span class="qty">×${itemQty(it)}</span>`:""}
        ${originBadge(itemOrigin(it),"data-orig-item",it.id)}
        ${fnum(it.cost)?`<span class="qty" title="Cost each">${esc(fmtGp(it.cost))}</span>`:""}
        ${itemWeight(it)?`<span class="qty" title="Weight each">${esc(fmtWt(it.weight))}</span>`:""}
        ${itemUsable(it)?`<button class="use-go" data-useitem="${esc(it.id)}">Use</button>`:""}
        ${isEquippable(it)?`<span class="equip ${it.equipped?"on":""}" data-toggle-item="${esc(it.id)}"><span class="box"></span>${it.equipped?"Equipped":"Equip"}</span>`:""}
        <button class="icon ed" data-edit-item="${esc(it.id)}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger ed" data-del-item="${esc(it.id)}" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
        </span>
      </div>
      ${ic?"":`${it.description?`<div class="desc">${richHTML(it.description)}</div>`:""}${itemUseLine(it)}${itemUsesRowHTML(it)}${it.equipped?fxChips(it.effects):fxChips(it.effects).replace(/class="chip"/g,'class="chip off"')}`}</div>`;
}
/* The carried-weight badge in the Inventory card header. Hidden entirely when
   encumbrance is off — the weight itself still shows in the totals row, so an
   always-visible pill would just be noise for tables that don't track it. */
function renderEncPill(st){
  const el=document.getElementById("encPill");if(!el)return;
  st=st||encState(contributions());
  if(st.mode==="none"){el.style.display="none";el.textContent="";return;}
  const bad=(st.tier==="over"||st.tier==="max");
  el.className="chip enc-pill"+(bad?" bad":(st.tier==="ok"?"":" warn"));
  el.textContent=(st.tier==="ok"?"":st.label+" · ")+fmtWt(st.carried)+" / "+fmtWt(st.cap);
  el.title=st.label;
  el.style.display="";
}
/* The footer rows under the item list: value, carried weight, and — when
   encumbrance is on — capacity and what the current tier costs you. Built as a
   string so the empty-inventory branch can show it too: a character carrying
   nothing but 900 gold coins is still carrying 18 lb. */
function invTotalsHTML(){
  const row=(label,val,cls)=>`<div class="item"><div class="top"><span class="nm">${label}</span><span style="flex:1"></span><b${cls?` class="${esc(cls)}"`:""}>${val}</b></div></div>`;
  let h="";
  const total=inventoryTotal();
  if(total>0)h+=row("Total value",esc(fmtGp(total)));
  const st=encState(contributions());
  const wt=st.carried;
  if(!wt&&st.mode==="none")return h;
  h+=row("Carried weight",esc(fmtWt(wt)));
  if(st.mode!=="none"){
    const mult=SIZE_CARRY[st.size]||1;
    const capNote=`STR ${st.str} × 15${mult!==1?` × ${mult} (${esc(st.size)})`:""}`;
    h+=`<div class="item"><div class="top"><span class="nm" style="font-weight:400">Capacity</span><span style="flex:1"></span><span class="qty">${esc(capNote)}</span><b>${esc(fmtWt(st.cap))}</b></div>
      <div class="desc">${esc(encTierNote(st))}</div></div>`;
  }
  return h;
}
/* One sentence per tier, in the player's terms. The disadvantage clause is prose
   rather than an effect because effects are numeric-only. */
function encTierNote(st){
  if(st.tier==="max")return `Carrying more than ${fmtWt(st.max)} — you cannot move or hold this much.`;
  if(st.tier==="over")return `Over capacity: you can only push, drag or lift this, and your speed drops to 5 ft. Hard limit ${fmtWt(st.max)}.`;
  if(st.tier==="heavy")return "Heavily Encumbered: speed −20 ft, and disadvantage on ability checks, attack rolls and saving throws using Strength, Dexterity or Constitution.";
  if(st.tier==="encumbered")return "Encumbered: speed −10 ft.";
  return `Unencumbered — ${fmtWt(Math.max(0,Math.round((st.cap-st.carried)*100)/100))} to spare.`;
}
function renderInventory(){
  const el=document.getElementById("inventoryList");if(!el)return;el.innerHTML="";
  const caBtn=document.getElementById("invCollapseAll"), caLbl=document.getElementById("invCollapseLbl");
  if(caBtn)caBtn.style.display=character.inventory.length?"inline-flex":"none";
  if(!character.inventory.length){el.innerHTML=`<div class="empty">No items yet. Equip gear that grants effects (e.g. +1 AC) and your stats update automatically.</div>`+invTotalsHTML();return;}
  if(caLbl)caLbl.textContent=character.inventory.some(it=>!invCol().items[it.id])?"Collapse all":"Expand all";
  const sc=invCol().sections;
  const renderSec=(title,items)=>{
    const collapsed=!!sc[title];
    /* The caret is drawn pointing right, like the Features one: the shared .fcaret
       turns it down when open. A down-drawn path turned 90° more pointed LEFT (#51). */
    const head=document.createElement("div");head.className="inv-sec-head";head.dataset.invsec=title;
    head.innerHTML=`<svg class="fcaret ${collapsed?"c":""}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>${esc(title)} <span class="cnt">(${items.length})</span>`;
    el.appendChild(head);
    if(!collapsed)items.forEach(it=>{const w=document.createElement("div");w.innerHTML=invItemHTML(it);el.appendChild(w.firstElementChild);});
  };
  invGroups(character.inventory).forEach(g=>renderSec(g.title,g.items));
  el.insertAdjacentHTML("beforeend",invTotalsHTML());
}
function statusTitle(name){
  /* a status name is from the file too: 7, or nothing, must not throw (#71) */
  const k=String(name??"").trim().toLowerCase();
  const g=k?allGlossary().find(x=>glossTerm(x).toLowerCase()===k):null;
  return g?`<span class="kw" data-gid="${esc(g.id)}" role="button" tabindex="0">${esc(name)}</span>`:esc(name||"Status");
}
/* ONE row, two places: the Statuses card on the Sheet, and the Concentrating
   mirror on the Spells tab. The controls are delegated from document, so the
   same buttons work wherever the row is rendered — which is the point of
   sharing the markup rather than writing a second, nearly-identical one that
   drifts. */
function statusRowHTML(s){
  const on=s.active!==false, tt=statusTimeText(s), ticking=on&&statusTimed(s);
  const nm=String(s.name||"condition");
  return `<div class="item${on?" on-status":""}"><div class="top split">
        <span class="nm">${statusTitle(s.name)}</span>
        <span class="row-meta">
        <span class="equip ${on?"on":""}" data-toggle-status="${esc(s.id)}"><span class="box"></span>${on?"Active":"Cleared"}</span>
        <button class="icon ed" data-edit-status="${esc(s.id)}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger ed" data-del-status="${esc(s.id)}" aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
        </span>
      </div>
      ${tt?`<div class="use-row st-row"><span class="use-lbl st-time">${esc(tt)}</span>${ticking?`
        <button class="tbtn" data-status-tick="${esc(s.id)}" data-sec="-6" aria-label="${esc("One round back: "+nm)}" style="padding:3px 8px;min-height:auto">− rd</button>
        <button class="tbtn" data-status-tick="${esc(s.id)}" data-sec="6" aria-label="${esc("One round on: "+nm)}" style="padding:3px 8px;min-height:auto">+ rd</button>`:""}
      </div>`:""}
      ${s.description?`<div class="desc">${richHTML(s.description)}</div>`:""}
      ${on?fxChips(s.effects):fxChips(s.effects).replace(/class="chip"/g,'class="chip off"')}</div>`;
}
function renderStatuses(){
  /* The Spells-tab mirror redraws from HERE rather than from its own callers:
     it is a view of the same statuses, so tying it to this render is what stops
     the two showing different things. */
  renderConcCard();
  const el=document.getElementById("statusList");el.innerHTML="";
  if(!character.statuses.length){el.innerHTML=`<div class="empty">No active statuses. Add conditions like Poisoned or Grappled — active ones can adjust your stats and link to their rules.</div>`;return;}
  el.innerHTML=character.statuses.map(statusRowHTML).join("");
}
/* The Concentrating condition, mirrored onto the Spells tab above Active Spells
   — that is where you are looking when you cast the next one, and it is the
   card that tells you what you would be dropping. Hidden entirely when nothing
   is being concentrated on. */
function renderConcCard(){
  const card=document.getElementById("concCard"), el=document.getElementById("concList");
  if(!card||!el)return;
  const row=concStatusRow();
  card.style.display=row?"":"none";
  el.innerHTML=row?statusRowHTML(row):"";
}

/* ---- timed conditions (#55) ----
   A status may last a set time: `durationSec` (a round is 6) and `elapsedSec`,
   how long it has run since it was last applied. The round tracker moves every
   active timed condition with the active spells (advanceRound()); one that
   reaches its duration clears itself, with an Undo. The Concentrating condition
   is never timed: its spell owns the clock. These helpers are pure, no DOM.
   Design: src/docs/specs/2026-10-06-timed-conditions-design.md */
const STATUS_UNITS=[["rounds",6],["minutes",60],["hours",3600]];
/* the duration in whole seconds; 0 = untimed (junk, 0 or less, or Concentrating) */
function statusDuration(s){
  if(!s||typeof s!=="object"||s.concId)return 0;
  const d=Math.round(Number(s.durationSec));
  return isFinite(d)&&d>0?d:0;
}
function statusElapsed(s){
  const e=Math.round(Number(s&&s.elapsedSec));
  return isFinite(e)&&e>0?e:0;
}
function statusTimed(s){return statusDuration(s)>0;}
/* A duration as the form shows it: the largest unit that divides it exactly.
   [number, unit key], or ["", "rounds"] for untimed. */
function statusUnitFor(sec){
  sec=Math.round(Number(sec));
  if(!isFinite(sec)||sec<=0)return ["","rounds"];
  for(let i=STATUS_UNITS.length-1;i>=0;i--){const [u,f]=STATUS_UNITS[i];if(sec%f===0)return [sec/f,u];}
  return [Math.max(1,Math.round(sec/6)),"rounds"];
}
/* Time as a fight reads it: rounds up to a minute, then rounded up to the
   minute — minutes under an hour, hours and minutes after. */
function fmtStatusTime(sec){
  sec=Math.max(0,Number(sec)||0);
  if(sec<=60){const r=Math.ceil(sec/6);return `${r} round${r===1?"":"s"}`;}
  const t=Math.ceil(sec/60);
  if(t<60)return `${t} min`;
  const h=Math.floor(t/60),m=t%60;
  return m?`${h} h ${m} min`:`${h} h`;
}
/* What a row says: the time left while active, its length while cleared (what
   switching it back on would give), nothing when untimed. */
function statusTimeText(s){
  const d=statusDuration(s);if(!d)return "";
  if(s.active===false){
    const [n,u]=statusUnitFor(d);
    return "lasts "+(u==="hours"?`${n} h`:u==="minutes"?`${n} min`:`${n} round${n===1?"":"s"}`);
  }
  return fmtStatusTime(Math.max(0,d-statusElapsed(s)))+" left";
}
function statusExpiredText(names){
  const n=(Array.isArray(names)?names:[]).map(x=>String(x||"A condition"));
  if(n.length<=1)return `${n[0]||"A condition"} has run out`;
  if(n.length===2)return `${n[0]} and ${n[1]} have run out`;
  return `${n[0]}, ${n[1]} and ${n.length-2} more have run out`;
}
/* The Undo's own confirmation (final review, #55), the same shape as
   statusExpiredText() and the ammo/tracker Undos ("Shot undone", "… is
   back"). Only the conditions actually restored — undoStatusExpiry() skips
   one deleted since. */
function statusBackText(names){
  const n=(Array.isArray(names)?names:[]).map(x=>String(x||"A condition"));
  if(n.length<=1)return `${n[0]||"A condition"} is back`;
  if(n.length===2)return `${n[0]} and ${n[1]} are back`;
  return `${n[0]}, ${n[1]} and ${n.length-2} more are back`;
}
/* Move active timed conditions by deltaSec: every one, or only `onlyId`. One a
   forward step brings to its duration clears itself, as the toggle does, its
   time kept at the duration. Returns those, each with its elapsed time before
   the step: what Undo restores. Cleared and untimed conditions do not move. */
function tickStatuses(c,deltaSec,onlyId){
  const ran=[];
  (Array.isArray(c&&c.statuses)?c.statuses:[]).forEach(s=>{
    if(!s||typeof s!=="object"||s.active===false)return;
    if(onlyId!=null&&s.id!==onlyId)return;
    const d=statusDuration(s);if(!d)return;
    const was=statusElapsed(s), now=Math.max(0,was+deltaSec);
    if(deltaSec>0&&now>=d){s.elapsedSec=d;s.active=false;ran.push({id:s.id,name:s.name,was});}
    else s.elapsedSec=now;
  });
  return ran;
}
/* Switching a timed condition back on starts its full duration again. */
function restartStatus(s){if(statusTimed(s))s.elapsedSec=0;}
/* One toast for every condition that ran out on a step, with its Undo. Focus is
   left where it is: the ▶ or + rd just pressed is still there, and pressing it
   again must move the clock, never land on Undo. */
function announceStatusExpiry(ran){
  if(!Array.isArray(ran)||!ran.length)return null;
  const rec={ran,done:false}, who=character;
  toast(statusExpiredText(ran.map(r=>r.name)),{label:"Undo",run:()=>undoStatusExpiry(rec,who)});
  return rec;
}
/* The toast's Undo: those conditions active again, each at the time it had
   before the step. Once only, and only on the character it was shown for (the
   object, so an import over the same id is another character). A condition
   deleted since is skipped — and so is its name in the confirmation toast;
   nothing toasts when nothing was restored. */
function undoStatusExpiry(rec,who){
  if(!rec||rec.done||!character||character!==who)return false;
  rec.done=true;
  const back=[];
  rec.ran.forEach(r=>{const s=(character.statuses||[]).find(x=>x&&x.id===r.id);if(s){s.active=true;s.elapsedSec=r.was;back.push(s.name);}});
  renderStatuses();recompute();scheduleSave();
  if(back.length)toast(statusBackText(back));
  return true;
}
/* − rd / + rd on one timed condition's row. The save is scheduled before the
   redraw. From the keyboard, focus goes back to the same button, or the row's
   Edit button once the condition has run out (its round buttons are gone). */
function stepStatusTap(id,deltaSec,viaKey){
  const ran=tickStatuses(character,deltaSec,id);
  scheduleSave();
  renderStatuses();if(ran.length)recompute();
  announceStatusExpiry(ran);
  if(viaKey){
    const sel=attrSel("data-status-tick",id)+(deltaSec>0?'[data-sec="6"]':'[data-sec="-6"]');
    const b=document.querySelector(sel)||document.querySelector(attrSel("data-edit-status",id));
    if(b&&b.focus)b.focus();
  }
}

/* One familiar's row: the Familiars card's list and the header's familiar
   modal (openFamiliar) draw the same markup, so their Summon / Edit / Delete
   are the same delegated buttons (90-boot.js). Edit and Delete keep `ed` for
   #97's guard, inert now that familiars is off EDIT_CARDS (final review I-3).
   Summon / Dismiss is a button, so the keyboard reaches it and can be put
   back on it after the modal repaints (M-14). */
function familiarCardHTML(f){
  const on=!!f.active;
  const stats=[f.ac!==""&&f.ac!=null?`AC ${esc(f.ac)}`:"",(f.hp&&(f.hp.max!==""&&f.hp.max!=null))?`HP ${esc(f.hp.cur||0)}/${esc(f.hp.max)}`:"",f.speed?`Speed ${esc(f.speed)}`:""].filter(Boolean).join(" · ");
  return `<div class="item${on?" on-fam":""}"><div class="top">
        <span class="nm">${esc(f.name||"Familiar")}</span>
        ${f.kind?`<span class="qty">${esc(f.kind)}</span>`:""}
        <button type="button" class="fam-state ${on?"on":"off"}" data-toggle-familiar="${esc(f.id)}" aria-pressed="${on?"true":"false"}">${on?"● Summoned":"○ Dismissed"}</button>
        <button class="icon ed" data-edit-familiar="${esc(f.id)}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger ed" data-del-familiar="${esc(f.id)}" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
      </div>
      ${stats?`<div class="desc" style="font-family:var(--head);font-size:12px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">${stats}</div>`:""}
      ${f.description?`<div class="desc">${richHTML(f.description)}</div>`:""}
      ${(f.effects&&f.effects.length)?(on?fxChips(f.effects):fxChips(f.effects).replace(/class="chip"/g,'class="chip off"')):""}</div>`;
}
function renderFamiliars(){
  const card=document.getElementById("familiarCard");
  const link=document.getElementById("addFamiliarLink");
  const has=character.familiars.length>0;
  /* #103: hidden on the Sheet whatever it holds — familiars open from the
     header's paw (spec §6.6). The combat view shows it (45-combat.css), and the
     old add button stays hidden: the paw's flyout offers + Add familiar. */
  card.style.display="none";
  link.hidden=true;
  /* Cleared BEFORE the early return: the combat view shows this card even when it
     is empty, and a list still holding the last familiar removed would show it. */
  const el=document.getElementById("familiarList");el.innerHTML="";
  /* the header's paw is faint with none (#103), so it follows the count */
  renderSheetHead();
  if(!has)return;
  el.innerHTML=character.familiars.map(f=>familiarCardHTML(f)).join("");
}

/* ================= the sheet header (#103, spec §6.1, §6.6) =================
   The name, both rests and the star are static markup in 00-sheet.html (their
   ids are wired once at boot); these draw the parts that follow the character:
   the class line (#shSub), the paw (#shPaw) and the level badge (#shLevel). */
function headLevel(c){
  const t=(Array.isArray(c&&c.classes)?c.classes:[]).reduce((a,x)=>a+num(x&&x.level),0);
  return Math.max(1,t||num(c&&c.level)||1);
}
/* "Cleric 12 · Fighter 3 · Half-Elf · Acolyte", each part a button. A part not
   chosen yet is its add button: "+ Class" here, and the existing data-add-race
   / data-add-bg pickers for the other two. */
function classLineHTML(c){
  const cls=(Array.isArray(c&&c.classes)?c.classes:[]).map((x,i)=>({x,i})).filter(o=>o.x&&o.x.name);
  const parts=[cls.length
    ?cls.map(({x,i})=>`<button type="button" class="sh-cls" data-shcls="${esc(i)}" aria-haspopup="menu" aria-expanded="false">${esc(x.name)} ${esc(num(x.level))}</button>`).join(" · ")
    :`<button type="button" class="sh-cls sh-add" data-shaddcls>+ Class</button>`];
  const r=c&&c.race&&c.race.name,b=c&&c.bg&&c.bg.name;
  /* the subrace or lineage follows the species, as the Origin chip had it */
  const sr=r&&typeof c.race.subrace==="string"&&c.race.subrace.trim()?" · "+esc(c.race.subrace.trim()):"";
  parts.push(r?`<button type="button" class="sh-org" data-shrace="${esc(r)}">${esc(r)}${sr}</button>`
              :`<button type="button" class="sh-org sh-add" data-add-race>+ ${esc(raceTerm())}</button>`);
  parts.push(b?`<button type="button" class="sh-org" data-shbg="${esc(b)}">${esc(b)}</button>`
              :`<button type="button" class="sh-org sh-add" data-add-bg>+ Background</button>`);
  return parts.join(" · ");
}
/* The menu under one class: the Class card's controls, moved. Its buttons are
   the existing hooks where one exists (subclass, Remove, + Add class), so they
   run exactly what the card ran. No ids: [data-shlevel] is delegated, and
   the Class card and its two level buttons are gone (#103). Level up / down
   carry this class's index (data-shidx), so they act on this class. Remove's `ed` is
   inert here: the flyout sits in the header, which is not an EDIT_CARDS card,
   so no ✎ toggle hides it. It is kept so every data-del-* button carries ed
   (the #97 guard in rules-data.js), and a Remove that ever lands in a card
   hides with it. */
function classFlyHTML(c,i){
  const x=(Array.isArray(c&&c.classes)?c.classes:[])[i];
  if(!x||!x.name)return "";
  const sub=x.subclass
    ?`<button type="button" role="menuitem" data-sub-info="${esc(x.name)}|${esc(x.subclass)}">Subclass: ${esc(x.subclass)}</button>`
    :`<button type="button" role="menuitem" data-choose-sub="${esc(x.name)}">Choose subclass</button>`;
  return `<div class="sh-flyhd">${esc(x.name)} ${esc(num(x.level))}</div>`+
    `<button type="button" role="menuitem" data-shinfo="${esc(i)}">About ${esc(x.name)}</button>`+sub+
    `<button type="button" role="menuitem" data-shlevel="up" data-shidx="${esc(i)}">▲ Level up</button>`+
    `<button type="button" role="menuitem" data-shlevel="down" data-shidx="${esc(i)}">▼ Level down</button>`+
    `<button type="button" role="menuitem" data-shaddcls>+ Add class</button>`+
    `<button type="button" role="menuitem" class="danger ed" data-del-class="${esc(i)}">Remove</button>`;
}
/* The ring holds #levelDisp, so recompute()'s write to it lands. In XP mode,
   once the XP reaches the next threshold it is a button: "Level up ready". */
function levelRingHTML(c){
  const lvl=esc(String(headLevel(c)));
  const p=advancementOf(c)==="xp"?xpProgress(c):null;
  return (p&&p.ready)
    ?`<button type="button" class="sh-ring ready" data-shlevelup title="Level up ready"><b id="levelDisp">${lvl}</b><small>Level up ready</small></button>`
    :`<span class="sh-ring" title="Level"><span class="sh-vh">Level </span><b id="levelDisp">${lvl}</b></span>`;
}
/* XP through the current level: empty at this level's threshold, full at the
   next one's (Mike's ruling on the final review's M-9), clamped, so XP below
   the level's own threshold reads empty. Full at the top of the table. Nothing
   when the XP is not a number (it shows as typed). */
function xpBarHTML(c){
  const p=advancementOf(c)==="xp"?xpProgress(c):null;if(!p)return "";
  const fmtN=n=>n.toLocaleString("en-US");
  const f=p.next===null||p.ready?1:Math.max(0,Math.min(1,(p.xp-p.cur)/((p.next-p.cur)||1)));
  const pct=f===1?100:Math.min(99,Math.round(f*100));
  const tip=p.next===null?fmtN(p.xp)+" XP":fmtN(p.xp)+" / "+fmtN(p.next);
  return `<span class="sh-xpbar" title="${esc(tip)}" role="img" aria-label="${esc(tip+" XP")}"><i style="width:${esc(String(pct))}%"></i></span>`;
}
/* Milestone mode is the ring only; the XP stays in the data, so switching back
   restores it. */
function levelBadgeHTML(c){
  if(advancementOf(c)!=="xp")return `<span class="sh-ringslot">${levelRingHTML(c)}</span>`;
  const v=c&&c.xp!=null?String(c.xp):"";
  return `<span class="sh-ringslot">${levelRingHTML(c)}</span><span class="sh-xpwrap">`+
    `<input class="sh-xp" data-path="character.xp" inputmode="numeric" aria-label="Experience points" placeholder="XP" value="${esc(v)}">`+
    `<span class="sh-barslot">${xpBarHTML(c)}</span></span>`;
}
/* The header's conditional icon: the paw, while the character's
   showFamiliars is on — faint with no familiar, its menu then offering + Add. */
function pawHTML(c){
  if(!(c&&c.showFamiliars===true))return "";
  const n=Array.isArray(c.familiars)?c.familiars.length:0;
  return `<button type="button" class="sh-ico sh-paw${n?"":" faint"}" data-shpaw aria-label="Familiars" title="Familiars &amp; companions" aria-haspopup="menu" aria-expanded="false">🐾</button>`;
}
/* The paw's menu also carries what the hidden Familiars card's heading did
   (final review I-3): its combat-view toggle and its section note. Both are the
   existing delegated hooks — [data-combatbtn] and [data-notebtn] — run after
   the menu closes, so they act exactly as the card's buttons did. */
function famFlyHTML(c){
  const fs=(Array.isArray(c&&c.familiars)?c.familiars:[]).filter(f=>f&&typeof f==="object");
  const cv=combatSectionsOf(c).includes("familiars"),cvt=combatToggleText("familiars",cv),nt=hasNote("familiars");
  return `<div class="sh-flyhd">Familiars &amp; companions</div>`+
    fs.map(f=>`<button type="button" role="menuitem" data-shfam="${esc(f.id)}" aria-label="${esc(String(f.name||"Familiar")+(f.active?", summoned":", dismissed"))}">${esc(f.name||"Familiar")} <span class="sh-st">${f.active?"●":"○"}</span></button>`).join("")+
    `<button type="button" role="menuitem" class="sh-add" data-add="familiar">+ Add familiar</button>`+
    `<div class="sh-flysep" role="separator"></div>`+
    `<button type="button" role="menuitemcheckbox" class="sh-flyopt" data-combatbtn="familiars" aria-checked="${cv?"true":"false"}" title="${esc(cvt.title)}">${iconSVG("ui","Combat","cvicon")} Combat view <span class="sh-st">${cv?"on":"off"}</span></button>`+
    `<button type="button" role="menuitem" class="sh-flyopt" data-notebtn="familiars">${nt?"Edit note":"Add a note"}</button>`;
}
/* The ring and the bar, without touching the XP box: typing in it repaints
   these live, and a full rebuild would take the caret out of it. */
function renderLevelBadge(){
  const lv=document.getElementById("shLevel");if(!lv)return;
  const inp=lv.querySelector(".sh-xp");
  if(inp&&document.activeElement===inp&&advancementOf(character)==="xp"){
    const r=lv.querySelector(".sh-ringslot"),b=lv.querySelector(".sh-barslot");
    if(r)r.innerHTML=levelRingHTML(character);
    if(b)b.innerHTML=xpBarHTML(character);
    return;
  }
  lv.innerHTML=levelBadgeHTML(character);
}
function renderSheetHead(){
  closeShFly();
  const sub=document.getElementById("shSub");if(sub)sub.innerHTML=classLineHTML(character);
  const paw=document.getElementById("shPaw");if(paw)paw.innerHTML=pawHTML(character);
  renderLevelBadge();
}
/* The class and familiar menus: one popover (#shFly) hung under the button
   that opened it, inside the header so it scrolls with the page, over a
   transparent layer (#shBack) that a tap outside lands on and closes it. Any
   button in it closes it before its own action runs (90-boot.js). */
let _shFly=null;
function openShFly(kind,i,anchor){
  const fly=document.getElementById("shFly"),back=document.getElementById("shBack");if(!fly)return;
  const html=kind==="fam"?famFlyHTML(character):classFlyHTML(character,i);
  closeShFly();
  if(!html)return;
  fly.innerHTML=html;
  fly.classList.add("open");if(back)back.classList.add("open");
  _shFly={kind,i,anchor:anchor||null};
  const head=document.getElementById("sheetHead");
  if(anchor&&head){
    const hr=head.getBoundingClientRect(),ar=anchor.getBoundingClientRect();
    const w=fly.offsetWidth||0;
    fly.style.top=Math.round(ar.bottom-hr.top+4)+"px";
    fly.style.left=Math.round(Math.max(6,Math.min(ar.left-hr.left,hr.width-w-6)))+"px";
    /* only a menu button says it is expanded: the .sh-bar fallback is not one */
    if(anchor.hasAttribute&&anchor.hasAttribute("aria-haspopup"))anchor.setAttribute("aria-expanded","true");
  }
  const first=fly.querySelector("button");if(first&&first.focus)first.focus({preventScroll:true});
}
function closeShFly(){
  const fly=document.getElementById("shFly"),back=document.getElementById("shBack");
  if(fly){fly.classList.remove("open");fly.innerHTML="";}
  if(back)back.classList.remove("open");
  if(_shFly&&_shFly.anchor&&_shFly.anchor.hasAttribute&&_shFly.anchor.hasAttribute("aria-haspopup"))_shFly.anchor.setAttribute("aria-expanded","false");
  _shFly=null;
}
/* A familiar's stat card in the modal, from the paw's menu. Summon / Dismiss,
   Edit and Delete are the list's own buttons; the toggle re-opens this so the
   modal repaints. */
function openFamiliar(id){
  const f=(Array.isArray(character.familiars)?character.familiars:[]).find(x=>x&&x.id===id);if(!f)return;
  openModal(String(f.name||"Familiar"),`<div class="fam-modal">${familiarCardHTML(f)}</div>`);
}
