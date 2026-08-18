/* Show a tab. Deliberately does NOT scroll: the tab bar's own handler wants the
   top of the page, but jumping to a note wants that note's card — so the scroll
   is the caller's decision, not this function's. */
function selectTab(name){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  document.querySelectorAll(".tabpanel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+name));
  closeToc();
}
/* Scroll a card to just under the sticky tab bar, whose height is measured live
   rather than assumed. Shared by the table of contents and the notes jump. */
function scrollToCard(el){
  if(!el)return;
  const tb=document.querySelector(".tabbar");
  const off=(tb?tb.getBoundingClientRect().height:48)+10;
  const y=el.getBoundingClientRect().top+window.scrollY-off;
  window.scrollTo({top:Math.max(0,y),behavior:"smooth"});
}
function buildToc(){
  const fly=document.getElementById("tocFly");if(!fly)return;
  const panel=document.querySelector(".tabpanel.active");
  const tabBtn=document.querySelector(".tab.active");const tabName=tabBtn?tabBtn.textContent.trim():"Sections";
  const items=[];
  if(panel)panel.querySelectorAll(".card > .label, .inv-sec-head").forEach(node=>{
    const target=node.classList.contains("inv-sec-head")?node:node.closest(".card");
    /* Skip cards that aren't showing. #familiarCard and #activeSpellCard are
       display:none until they have content, and listing one gives a menu entry
       that scrolls to a zero-height box and lands nowhere. jumpToNote() has
       always made this check; this is the same rule, in the other consumer. */
    if(target&&target.offsetParent===null)return;
    const cl=node.cloneNode(true);cl.querySelectorAll("button,svg,input,select,.grow,.add,.cnt,.enc-pill").forEach(x=>x.remove());
    const t=cl.textContent.trim();if(t&&target)items.push({t,target,sub:node.classList.contains("inv-sec-head")});
  });
  fly.innerHTML=`<h4>${esc(tabName)}</h4>`+(items.length?"":`<p class="hint" style="padding:6px">No sections here.</p>`);
  items.forEach(it=>{const a=document.createElement("a");a.textContent=it.t;if(it.sub)a.style.paddingLeft="20px";a.addEventListener("click",()=>{closeToc();scrollToCard(it.target);});fly.appendChild(a);});
}
function openToc(){buildToc();const tb=document.querySelector(".tabbar");const top=tb?Math.max(0,Math.round(tb.getBoundingClientRect().bottom)):0;const fly=document.getElementById("tocFly"),back=document.getElementById("tocBack");if(fly)fly.style.top=top+"px";if(back)back.style.top=top+"px";if(fly)fly.classList.add("open");if(back)back.classList.add("open");}
function closeToc(){const f=document.getElementById("tocFly"),b=document.getElementById("tocBack");if(f)f.classList.remove("open");if(b)b.classList.remove("open");}
function invSection(it){
  const ov=String(it.sectionOverride||"").trim();
  if(ov&&INV_ORDER.includes(ov))return ov;
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
  let pips="";for(let i=1;i<=mx;i++)pips+=`<button class="use-b ${i<=used?"used":""}" data-iuse="${it.id}" data-i="${i}" aria-label="Use"></button>`;
  return `<div class="use-row"><span class="use-lbl">Uses${(per&&per!=="none")?` · per ${esc(per)} rest`:""}</span><span class="use-pips">${pips}</span></div>`;
}
function invItemHTML(it){
  const ic=!!invCol().items[it.id];
  return `<div class="item fitem"><div class="top">
        <button class="fitoggle" data-invitem="${it.id}" aria-label="Collapse item"><svg class="fcaret ${ic?"c":""}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
        <button class="fav ${it.fav?"on":""}" data-fav-item="${it.id}" aria-label="Favorite" title="Favorite">${it.fav?"★":"☆"}</button>
        <span class="nm">${esc(it.name||"Item")}</span>
        ${it.qty&&num(it.qty)!==1?`<span class="qty">×${num(it.qty)}</span>`:""}
        ${originBadge(itemOrigin(it),"data-orig-item",it.id)}
        ${fnum(it.cost)?`<span class="qty" title="Cost each">${esc(fmtGp(it.cost))}</span>`:""}
        ${itemWeight(it)?`<span class="qty" title="Weight each">${esc(fmtWt(it.weight))}</span>`:""}
        ${itemUsable(it)?`<button class="use-go" data-useitem="${it.id}">Use</button>`:""}
        ${isEquippable(it)?`<span class="equip ${it.equipped?"on":""}" data-toggle-item="${it.id}"><span class="box"></span>${it.equipped?"Equipped":"Equip"}</span>`:""}
        <button class="icon" data-edit-item="${it.id}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger" data-del-item="${it.id}" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
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
  const row=(label,val,cls)=>`<div class="item"><div class="top"><span class="nm">${label}</span><span style="flex:1"></span><b${cls?` class="${cls}"`:""}>${val}</b></div></div>`;
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
  const byName=(a,b)=>String(a.name||"").localeCompare(String(b.name||""));
  const eqThenName=(a,b)=>((b.equipped?1:0)-(a.equipped?1:0))||byName(a,b);
  const favs=character.inventory.filter(it=>it.fav).sort(byName);
  const groups={};character.inventory.filter(it=>!it.fav).forEach(it=>{const s=invSection(it);(groups[s]=groups[s]||[]).push(it);});
  const sc=invCol().sections;
  const renderSec=(title,items,sorter)=>{
    if(!items.length)return;
    const collapsed=!!sc[title];
    const head=document.createElement("div");head.className="inv-sec-head";head.dataset.invsec=title;
    head.innerHTML=`<svg class="fcaret ${collapsed?"c":""}" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>${esc(title)} <span class="cnt">(${items.length})</span>`;
    el.appendChild(head);
    if(!collapsed)items.slice().sort(sorter).forEach(it=>{const w=document.createElement("div");w.innerHTML=invItemHTML(it);el.appendChild(w.firstElementChild);});
  };
  renderSec("★ Favorites",favs,byName);
  INV_ORDER.forEach(s=>renderSec(s,groups[s]||[],eqThenName));
  el.insertAdjacentHTML("beforeend",invTotalsHTML());
}
function statusTitle(name){
  const g=allGlossary().find(x=>x.term.toLowerCase()===(name||"").toLowerCase());
  return g?`<span class="kw" data-gid="${g.id}" role="button" tabindex="0">${esc(name)}</span>`:esc(name||"Status");
}
/* ONE row, two places: the Statuses card on the Sheet, and the Concentrating
   mirror on the Spells tab. The controls are delegated from document, so the
   same buttons work wherever the row is rendered — which is the point of
   sharing the markup rather than writing a second, nearly-identical one that
   drifts. */
function statusRowHTML(s){
  const on=s.active!==false;
  return `<div class="item${on?" on-status":""}"><div class="top">
        <span class="nm">${statusTitle(s.name)}</span>
        <span class="equip ${on?"on":""}" data-toggle-status="${s.id}"><span class="box"></span>${on?"Active":"Cleared"}</span>
        <button class="icon" data-edit-status="${s.id}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger" data-del-status="${s.id}" aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
      </div>
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
function renderFamiliars(){
  const card=document.getElementById("familiarCard");
  const link=document.getElementById("addFamiliarLink");
  const has=character.familiars.length>0;
  card.style.display=has?"":"none";
  link.style.display=has?"none":"";
  if(!has)return;
  const el=document.getElementById("familiarList");el.innerHTML="";
  character.familiars.forEach(f=>{
    const on=!!f.active;
    const stats=[f.ac!==""&&f.ac!=null?`AC ${esc(f.ac)}`:"",(f.hp&&(f.hp.max!==""&&f.hp.max!=null))?`HP ${esc(f.hp.cur||0)}/${esc(f.hp.max)}`:"",f.speed?`Speed ${esc(f.speed)}`:""].filter(Boolean).join(" · ");
    const d=document.createElement("div");d.className="item"+(on?" on-fam":"");
    d.innerHTML=`<div class="top">
        <span class="nm">${esc(f.name||"Familiar")}</span>
        ${f.kind?`<span class="qty">${esc(f.kind)}</span>`:""}
        <span class="fam-state ${on?"on":"off"}" data-toggle-familiar="${f.id}">${on?"● Summoned":"○ Dismissed"}</span>
        <button class="icon" data-edit-familiar="${f.id}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger" data-del-familiar="${f.id}" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
      </div>
      ${stats?`<div class="desc" style="font-family:var(--head);font-size:12px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">${stats}</div>`:""}
      ${f.description?`<div class="desc">${richHTML(f.description)}</div>`:""}
      ${(f.effects&&f.effects.length)?(on?fxChips(f.effects):fxChips(f.effects).replace(/class="chip"/g,'class="chip off"')):""}`;
    el.appendChild(d);
  });
}
