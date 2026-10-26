/* ================= trade window and inventory log (#47) =================
   Every item and coin change writes ONE line through logInv() (grants through
   logGrant(), which batches a source's grants into one line). Each line keeps
   what reversing it needs, so any line that can still be reversed cleanly
   can be undone. Spec: src/docs/specs/2026-10-25-trade-window-design.md. */
const INV_LOG_SIZES=[100,250,500,1000,2500];
const INV_KINDS=["trade","add","edit","delete","use","coins","grant","ammo"];
const COIN_CP={cp:1,sp:10,ep:50,gp:100,pp:1000};
function coinsToCp(coins){let t=0;Object.keys(COIN_CP).forEach(k=>{t+=Math.round(num((coins||{})[k]))*COIN_CP[k];});return t;}
function cpToGpText(cp){const v=Math.round(num(cp))/100;return `${String(Math.round(v*100)/100)} gp`;}
/* cost is gp and may be fractional (an arrow costs 0.05 gp) — fnum, not num,
   matching inventoryTotal()'s own read of it (25-origins-items.js). */
function itemWorthCp(it,qty){return Math.round(fnum(it&&it.cost)*100*Math.max(0,num(qty)));}
/* " · 2 gp" for a line that names what something cost; nothing when it cost nothing */
function invCostText(cp,pre){return cp>0?pre+cpToGpText(cp)+(pre===" ("?")":""):"";}
function invSnap(it){return it==null?null:JSON.parse(JSON.stringify(it));}
function invNorm(v){return Array.isArray(v)?v.map(invNorm):(v&&typeof v==="object")?Object.keys(v).sort().reduce((o,k)=>{o[k]=invNorm(v[k]);return o;},{}):v;}
function invSame(a,b){return JSON.stringify(invNorm(a))===JSON.stringify(invNorm(b));}
/* A short fingerprint of a value (53-bit cyrb53, key order ignored): an edit line
   keeps one of the row as edited instead of a whole copy of it. */
function invHash(v){
  const str=JSON.stringify(invNorm(v))||"";let h1=0xdeadbeef,h2=0x41c6ce57;
  for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (h2>>>0).toString(36)+"."+(h1>>>0).toString(36);
}
/* An edit line keeps only what changed (Mike, 2026-10-25: two whole copies of
   the item made the log too big for the browser's storage). For each top-level
   field that differs: its value before (`b`) and after (`a`), a side left out
   where the field was absent; and the fingerprint of the whole row as edited,
   so "changed again since" stays exact and Undo rebuilds the row as it was. */
function invEditUndo(before,after){
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k)&&o[k]!==undefined,changed={};
  Object.keys(Object.assign({},before,after)).forEach(k=>{
    const hb=has(before,k),ha=has(after,k);
    if(hb&&ha&&invSame(before[k],after[k]))return;
    const c={};if(hb)c.b=invSnap(before[k]);if(ha)c.a=invSnap(after[k]);changed[k]=c;
  });
  return {id:after.id,changed,hash:invHash(after)};
}
/* a line written before edits kept only their changes: the same, from its two copies */
function invEditU(u){return invIsObj(u.before)&&invIsObj(u.after)&&u.after.id!=null?invEditUndo(u.before,u.after):u;}
/* What each kind's `undo` must look like to be applied (final review M2): an
   imported, hand-edited or future file's undo that doesn't fit is dropped,
   keeping its line, so the Log dialog never reads a field that isn't there. */
function invIsObj(v){return !!v&&typeof v==="object"&&!Array.isArray(v);}
function invUndoShape(kind,u){
  if(!invIsObj(u))return null;
  const copy=v=>v==null||invIsObj(v);
  const rows=a=>Array.isArray(a)&&a.every(p=>invIsObj(p)&&p.id!=null&&copy(p.snap)&&copy(p.atk));
  if(kind==="add"||kind==="give")return rows(u.items)?u:null;
  if(kind==="edit"){const e=invEditU(u);return e.id!=null&&typeof e.hash==="string"&&invIsObj(e.changed)&&Object.keys(e.changed).every(k=>invIsObj(e.changed[k]))?e:null;}
  if(kind==="delete")return invIsObj(u.snap)&&copy(u.atk)?u:null;
  if(kind==="use")return u.id!=null&&copy(u.snap)&&copy(u.atk)?u:null;
  if(kind==="coins")return invIsObj(u.delta)?u:null;
  if(kind==="trade")return Array.isArray(u.parts)&&u.parts.every(p=>invIsObj(p)&&["give","add","coins"].indexOf(p.kind)>=0&&invUndoShape(p.kind,p.u))?u:null;
  return null;   /* grant and ammo have no undo */
}
function cleanInvLog(v,size){
  const n=INV_LOG_SIZES.indexOf(num(size))>=0?num(size):500;
  return (Array.isArray(v)?v:[]).filter(e=>e&&typeof e==="object"&&INV_KINDS.indexOf(e.kind)>=0&&num(e.at)>0)
    .map(e=>({id:String(e.id||uid()),at:num(e.at),kind:e.kind,title:String(e.title||""),
      lines:(Array.isArray(e.lines)?e.lines:[]).filter(l=>l&&typeof l==="object").map(l=>({dir:l.dir==="+"||l.dir==="-"?l.dir:"",text:String(l.text||"")})),
      undo:invUndoShape(e.kind,e.undo),undone:e.undone===true,meta:(e.meta&&typeof e.meta==="object")?e.meta:{}}))
    .slice(0,n);
}
function logInv(entry){
  if(!Array.isArray(character.invLog))character.invLog=[];
  const e={id:uid(),at:Date.now(),kind:entry.kind,title:String(entry.title||""),lines:entry.lines||[],undo:entry.undo||null,undone:false,meta:entry.meta||{}};
  character.invLog.unshift(e);
  const n=INV_LOG_SIZES.indexOf(num(character.invLogSize))>=0?num(character.invLogSize):500;
  if(character.invLog.length>n)character.invLog.length=n;
  return e;
}
/* The log size setting (final review M1). A smaller size trims at once — but
   when that would drop lines it asks first, and declined, the size stays.
   (Spec §2 decision 3 said "at the next write"; trimming at once is the
   deliberate deviation, recorded in As built.) Returns whether it changed. */
function setInvLogSize(n){
  if(INV_LOG_SIZES.indexOf(num(n))<0)return false;
  const len=(character.invLog||[]).length,drop=len-num(n);
  if(drop>0&&!confirm(`Keep the newest ${num(n).toLocaleString("en-US")}? This removes ${drop.toLocaleString("en-US")} older line${drop===1?"":"s"}.`))return false;
  character.invLogSize=num(n);
  character.invLog=cleanInvLog(character.invLog,character.invLogSize);
  scheduleSave();
  return true;
}
function grantSourceName(sid){const s=String(sid||"");return s.slice(s.indexOf(":")+1)||s;}
/* One line per source: a class's starting gear arrives as several calls in a row. */
function logGrant(sid,line){
  const top=(character.invLog||[])[0];
  if(top&&top.kind==="grant"&&top.meta&&top.meta.sid===sid&&!top.meta.revert&&Date.now()-num(top.at)<5000){top.lines.push(line);return top;}
  return logInv({kind:"grant",title:"Granted by "+grantSourceName(sid),lines:[line],undo:null,meta:{sid}});
}
/* ---- every writer logs exactly once (#47 Task 2) ---- */
function invName(id){const it=(character.inventory||[]).find(x=>x.id===id);return it?String(it.name||"Item"):"Item";}
function logFinderAdd(did){
  if(!did||!did.length)return;
  const lines=did.map(d=>{const it=(character.inventory||[]).find(x=>x.id===d.id);return {dir:"+",text:`${invName(d.id)} ×${d.qty}${invCostText(itemWorthCp(it,d.qty)," · ")}`};});
  logInv({kind:"add",title:did.length===1?"Added "+invName(did[0].id):`Added ${did.length} items`,lines,undo:{items:did}});
}
/* The item form: a new item is an add; an edit is logged only if something changed. */
function logItemSave(before,after){
  if(!before){const q=itemQty(after);logInv({kind:"add",title:"Added "+(after.name||"Item"),lines:[{dir:"+",text:`${after.name||"Item"} ×${q}${invCostText(itemWorthCp(after,q)," · ")}`}],undo:{items:[{id:after.id,qty:q,created:true}]}});return;}
  if(invSame(before,after))return;
  const lines=[];
  if(itemQty(before)!==itemQty(after))lines.push({dir:"",text:`Quantity ${itemQty(before)} → ${itemQty(after)}`});
  if(before.name!==after.name)lines.push({dir:"",text:`Name ${before.name} → ${after.name}`});
  if(!lines.length)lines.push({dir:"",text:"Details changed"});
  logInv({kind:"edit",title:"Edited "+(after.name||"Item"),lines,undo:invEditUndo(before,after)});
}
/* Coins: one line per commit, folding every denomination that actually moved. */
function logCoins(title,delta){
  const d={};Object.keys(delta||{}).forEach(k=>{const v=Math.round(num(delta[k]));if(v)d[k]=v;});
  if(!Object.keys(d).length)return null;
  const lines=Object.keys(d).map(k=>{const c=COIN_ALL.find(x=>x[0]===k);return {dir:d[k]>0?"+":"-",text:`${d[k]>0?"+":"−"}${Math.abs(d[k])} ${c?c[1]:k}`};});
  return logInv({kind:"coins",title,lines,undo:{delta:d}});
}
/* ---- item helpers for undo (and the trade) ---- */
/* Takes `qty` off a row, removing it (and its attack) at 0. It ALWAYS returns
   a copy of the row, its attack and where both stood, taken before the change
   (final review K1): an undo can then bring the row back even when it has
   gone since for some other reason — fired, sold, deleted. */
function invRemoveQty(id,qty){
  const it=(character.inventory||[]).find(x=>x.id===id);if(!it)return {removed:false,snap:null,atk:null,at:null,atkAt:null};
  const left=itemQty(it)-num(qty),at=character.inventory.indexOf(it),snap=invSnap(it);
  const a0=(character.attacks||[]).find(a=>a.itemId===id)||null,atk=invSnap(a0),atkAt=a0?character.attacks.indexOf(a0):null;
  if(left<=0){
    character.inventory=character.inventory.filter(x=>x.id!==id);
    character.attacks=(character.attacks||[]).filter(a=>a.itemId!==id);
    forgetAmmo(character,id);
    return {removed:true,snap,atk,at,atkAt};
  }
  it.qty=left;return {removed:false,snap,atk,at,atkAt};
}
/* `at` is where the row stood and `atkAt` where its attack stood: each goes
   back there, clamped to its list, as the ammo undo does (62-ammo.js
   undoFire). An old line with no index appends. `qty`, when given, is how many
   come back (a copy taken before a partial Use or give holds the whole stack).
   A granted item whose source has since been removed comes back as an
   ordinary item (final review M3): nothing could ever revert that grant. */
function invRestore(snap,atk,at,atkAt,qty){
  const it=invSnap(snap);if((character.inventory||[]).some(x=>x.id===it.id))it.id=uid();
  if(qty!=null)it.qty=num(qty);
  if(it.grant&&!grantSidLive(character,it.grant)){if(!it.origin)it.origin=originFromSid(it.grant);delete it.grant;}
  const put=(list,x,i)=>{if(Number.isInteger(i)&&i>=0)list.splice(Math.min(list.length,i),0,x);else list.push(x);};
  put(character.inventory,it,at);
  if(atk){const a=invSnap(atk);a.itemId=it.id;if(!Array.isArray(character.attacks))character.attacks=[];if(character.attacks.some(x=>x.id===a.id))a.id=uid();put(character.attacks,a,atkAt);it.attackId=a.id;}
  return it.id;
}
/* ---- undo ---- */
/* The check is exactly what the apply step can do (final review K1): a line
   passes only when its undo will put something back. Inside a trade (`named`)
   a reason names the item, since one trade moves several. */
const INV_WHY={add:"It has since been used, sold or removed.",edit:"It has been changed again since.",gone:"It is no longer in your inventory.",broken:"This line can't be undone."};
function invRow(id){return (character.inventory||[]).find(x=>x.id===id)||null;}
function invCheckPart(kind,u,named){
  /* records that stacked onto one row are summed: the row must still hold them all */
  if(kind==="add"){const need={};for(const p of u.items)need[p.id]=(need[p.id]||0)+num(p.qty);for(const p of u.items){const it=invRow(p.id);if(!it||itemQty(it)<need[p.id]){const nm=String(p.name||(it&&it.name)||"");return named&&nm?`The ${nm} you got has since been used, sold or removed.`:INV_WHY.add;}}return "";}
  if(kind==="give"){for(const p of u.items){if(!invRow(p.id)&&!p.snap){const nm=String(p.name||"");return nm?`The ${nm} you gave can't come back: this line kept no copy of it.`:INV_WHY.gone;}}return "";}
  if(kind==="edit"){const e=invEditU(u),it=invRow(e.id);return (it&&invHash(it)===e.hash)?"":INV_WHY.edit;}
  if(kind==="coins"){
    for(const k of Object.keys(u.delta)){const d=num(u.delta[k]);if(d>0&&num((character.coins||{})[k])<d){const c=COIN_ALL.find(x=>x[0]===k);return `Not enough ${c?c[1]:k.toUpperCase()} left to take back.`;}}
    return "";
  }
  if(kind==="use"){
    /* the row gives back the quantity or the use; a copy brings back what was used up */
    const it=invRow(u.id);
    if(it)return num(u.qty)>0||(num(u.used)>0&&it.uses)?"":INV_WHY.edit;
    return u.snap&&num(u.qty)>0?"":INV_WHY.gone;
  }
  if(kind==="delete")return "";   /* its shape guarantees the copy */
  return INV_WHY.broken;
}
function invUndoCheck(e){
  if(!e||e.undone)return {ok:false,why:e&&e.undone?"Already undone.":""};
  if(!e.undo||e.kind==="grant"||e.kind==="ammo")return {ok:false,why:""};
  /* never throws: a shape cleanInvLog() didn't see (or a future one) is refused */
  try{
    if(!invUndoShape(e.kind,e.undo))return {ok:false,why:INV_WHY.broken};
    if(e.kind==="trade"){for(const p of e.undo.parts){const w=invCheckPart(p.kind,p.u,true);if(w)return {ok:false,why:w};}return {ok:true,why:""};}
    const w=invCheckPart(e.kind,e.undo,false);return {ok:!w,why:w};
  }catch(err){return {ok:false,why:INV_WHY.broken};}
}
function invApplyPart(kind,u){
  if(kind==="add")(u.items||[]).forEach(p=>{const it=character.inventory.find(x=>x.id===p.id);if(!it)return;if(p.created&&itemQty(it)<=num(p.qty))invRemoveQty(p.id,itemQty(it));else invRemoveQty(p.id,p.qty);});
  else if(kind==="edit"){const e=invEditU(u),i=character.inventory.findIndex(x=>x.id===e.id);if(i>=0){
    const r=invSnap(character.inventory[i]);Object.keys(e.changed).forEach(k=>{const c=e.changed[k];if(Object.prototype.hasOwnProperty.call(c,"b"))r[k]=invSnap(c.b);else delete r[k];});
    character.inventory[i]=r;syncItemAttack(r);}}
  else if(kind==="delete")invRestore(u.snap,u.atk,u.at,u.atkAt);
  else if(kind==="use"){
    /* the row still here: add back; gone: its copy, with the quantity used */
    const it=invRow(u.id);
    if(it){if(num(u.qty))it.qty=itemQty(it)+num(u.qty);if(num(u.used)&&it.uses)it.uses.used=Math.max(0,num(it.uses.used)-num(u.used));}
    else if(u.snap)invRestore(u.snap,u.atk||null,u.at,u.atkAt,num(u.qty));
  }
  else if(kind==="coins"){character.coins=character.coins||{};Object.keys(u.delta||{}).forEach(k=>{character.coins[k]=num(character.coins[k])-num(u.delta[k]);});}
  /* newest removal first: each `at` was read with the earlier removals already
     gone. The row still here: add back; gone: its copy, with the quantity given. */
  else if(kind==="give")(u.items||[]).slice().reverse().forEach(p=>{const it=invRow(p.id);if(it)it.qty=itemQty(it)+num(p.qty);else if(p.snap)invRestore(p.snap,p.atk,p.at,p.atkAt,num(p.qty));});
}
function invUndo(id){
  const e=(character.invLog||[]).find(x=>x.id===id);if(!e)return "That line is no longer in the log.";
  const c=invUndoCheck(e);if(!c.ok)return c.why||"This line can't be undone.";
  if(e.kind==="trade")(e.undo.parts||[]).forEach(p=>invApplyPart(p.kind,p.u));else invApplyPart(e.kind,e.undo);
  e.undone=true;
  logInv({kind:e.kind,title:"Undid: "+e.title,lines:[],undo:null});
  renderInventory();renderAttacks();renderCoins();recompute();scheduleSave();
  return "";
}
/* ---- the Log dialog (#47 Task 3) ---- */
const INV_FILTERS={all:null,trades:["trade"],items:["add","edit","delete","use","grant"],coins:["coins"],ammo:["ammo"]};
const INV_ICON={trade:"⇄",add:"+",edit:"✎",delete:"🗑",use:"✦",coins:"¤",grant:"⚑",ammo:"➶"};
let _invLogFilter="all";
/* a grant or "Removed with" line that moved gold also files under Coins */
function invInFilter(e,filter){const kinds=INV_FILTERS[filter]||null;return !kinds||kinds.indexOf(e.kind)>=0||(filter==="coins"&&e.kind==="grant"&&!!(e.meta&&e.meta.gold));}
function invDayLabel(at){
  const d=new Date(at),t=new Date();const day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
  const diff=(day(t)-day(d))/86400000;return diff===0?"Today":diff===1?"Yesterday":d.toLocaleDateString();
}
function invLogHTML(list,filter,size){
  const rows=(list||[]).filter(e=>invInFilter(e,filter));
  let day="",out=`<div class="il-filters">`+Object.keys(INV_FILTERS).map(f=>`<button type="button" class="il-f${f===filter?" on":""}" data-ilfilter="${esc(f)}" aria-pressed="${f===filter?"true":"false"}">${esc(f[0].toUpperCase()+f.slice(1))}</button>`).join("")+`</div>`;
  /* one scroller for the rows (final review C5), as the trade's .tr-sides is:
     the filters and the foot stay put above and below it */
  out+=`<div class="il-scroll">`;
  if(!rows.length)out+=`<p class="empty">Nothing logged yet.</p>`;
  rows.forEach(e=>{
    const dl=invDayLabel(e.at);if(dl!==day){day=dl;out+=`<div class="il-day">${esc(dl)}</div>`;}
    const c=invUndoCheck(e),time=new Date(e.at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
    const undo=e.undone||!e.undo||e.kind==="grant"||e.kind==="ammo"?"":
      (c.ok?`<button type="button" class="tbtn il-undo" data-invundo="${esc(e.id)}">Undo</button>`
           :`<button type="button" class="tbtn il-undo" data-invundo="${esc(e.id)}" disabled title="${esc(c.why)}">Undo</button><small class="il-why">${esc(c.why)}</small>`);
    const lines=(e.lines||[]).map(l=>`<div class="il-l ${esc(l.dir==="+"?"in":l.dir==="-"?"out":"")}">${esc(l.text)}</div>`).join("");
    out+=`<div class="il-e${e.undone?" undone":""}" data-ilid="${esc(e.id)}"><span class="il-ic" aria-hidden="true">${INV_ICON[e.kind]||"•"}</span>`+
      `<div class="il-tx"><b>${esc(e.title)}</b>${e.kind==="trade"&&lines?`<details><summary>Receipt</summary>${lines}</details>`:lines}</div>`+
      `<div class="il-side"><span class="il-t">${esc(time)}</span>${undo}</div></div>`;
  });
  return out+`</div><div class="il-foot"><span>Keeps the newest ${esc(String(size))}.</span><button type="button" class="tbtn danger" id="invLogClear">Clear log</button></div>`;
}
function openInvLog(){
  const paint=()=>{const b=document.getElementById("mBody");if(b)b.innerHTML=invLogHTML(character.invLog||[],_invLogFilter,character.invLogSize||500);};
  openModal("Inventory log","","",{wide:true});paint();
  const body=document.getElementById("mBody");if(!body||body.dataset.ilWired)return;
  body.dataset.ilWired="1";
  body.addEventListener("click",e=>{
    if(!document.getElementById("invLogClear"))return;   /* only while the log is the open dialog */
    const t=e.target;let m;
    if((m=t.closest("[data-ilfilter]"))){_invLogFilter=m.dataset.ilfilter;paint();return;}
    if((m=t.closest("[data-invundo]"))){const why=invUndo(m.dataset.invundo);if(why)toast(why);paint();return;}
    if(t.closest("#invLogClear")){if(confirm("Clear the whole inventory log? Undo will no longer be possible for any of it.")){character.invLog=[];scheduleSave();paint();}return;}
  });
}
/* ---- the trade window (#47 Task 4) ----
   A draft holds the trade until Complete applies it as one step, logged as one
   `trade` line whose undo has three parts: give (always clean), add (what you
   got must still be there) and coins (the net change). Spec §6.2 and §8. */
let _trade=null,_trPick=false;
function newTradeDraft(opts){
  const o=opts||{},arr=a=>Array.isArray(a)?a:[],coins=c=>Object.assign({},(c&&typeof c==="object")?c:{});
  const give=o.give||{},get=o.get||{};
  const d={with:String(o.with||""),
    give:{items:arr(give.items).filter(x=>x&&x.id!=null).map(x=>({id:String(x.id),qty:Math.max(1,num(x.qty)||1)})),coins:coins(give.coins)},
    get:{items:arr(get.items).filter(x=>x&&typeof x==="object").map(x=>({key:String(x.key||uid()),name:String(x.name||(x.def&&x.def.name)||""),qty:Math.max(1,num(x.qty)||1),
      cost:x.cost!=null?Math.max(0,fnum(x.cost)):(x.def?(costToGp(x.def.cost)||0):0),def:x.def||null,custom:!!x.custom||!x.def})),coins:coins(get.coins)},
    applyGive:true,applyGet:true,tab:"give"};
  return tradeClamp(d,character);
}
/* What you give is capped at what you hold: whole coins, owned items. Run on
   a seeded draft (#105) and again at Complete, so the balance, the receipt and
   meta.giveCp all describe exactly what is applied. */
function tradeClamp(d,ch){
  const inv=(ch&&ch.inventory)||[],held=(ch&&ch.coins)||{},seen=new Set();
  d.give.items=d.give.items.filter(g=>{const it=inv.find(x=>x.id===g.id);if(!it||seen.has(g.id))return false;seen.add(g.id);g.qty=Math.min(Math.max(0,num(g.qty)),itemQty(it));return g.qty>0;});
  Object.keys(d.give.coins).forEach(k=>{d.give.coins[k]=Math.min(Math.max(0,num(d.give.coins[k])),Math.max(0,num(held[k])));});
  Object.keys(d.get.coins).forEach(k=>{d.get.coins[k]=Math.max(0,num(d.get.coins[k]));});
  return d;
}
function tradeEmpty(d){return !d.give.items.length&&!d.get.items.length&&!coinsToCp(d.give.coins)&&!coinsToCp(d.get.coins);}
/* cost is gp of ONE and may be fractional: fnum, as itemWorthCp() reads it */
function tradeGetCp(g){return Math.round(fnum(g.cost)*100*Math.max(0,num(g.qty)));}
function tradeBalance(d,ch){
  const inv=(ch&&ch.inventory)||[];
  let giveCp=coinsToCp(d.give.coins),getItemsCp=0;
  if(d.applyGive)d.give.items.forEach(g=>{const it=inv.find(x=>x.id===g.id);if(it)giveCp+=itemWorthCp(it,g.qty);});
  if(d.applyGet)d.get.items.forEach(g=>{getItemsCp+=tradeGetCp(g);});
  const getCp=getItemsCp+coinsToCp(d.get.coins);
  /* Coins you receive never make it red (Mike, 2026-10-25): selling above an
     item's worth is a good deal, not a shortfall. Short is only when the items
     you get are worth more than everything you give. */
  return {giveCp,getCp,diff:giveCp-getCp,short:getItemsCp>giveCp};
}
/* "n is the number of lines": each item, and each coin that moves */
function tradeCount(side){return side.items.length+Object.keys(side.coins||{}).filter(k=>num(side.coins[k])>0).length;}
function tradeTabsInner(d){
  return ["give","get"].map(s=>`<button type="button" class="tr-tab" role="tab" id="${esc(s==="get"?"trTabGet":"trTabGive")}" aria-controls="${esc(s==="get"?"trSideGet":"trSideGive")}" data-trtab="${esc(s)}" aria-selected="${d.tab===s?"true":"false"}">You ${s} · ${tradeCount(d[s])}</button>`).join("");
}
function tradeBalHTML(d,ch){
  const b=tradeBalance(d,ch),n=cpToGpText(Math.abs(b.diff));
  const net=b.short?`${esc(n)} short`:b.diff<0?`${esc(n)} in your favour`:b.diff>0?`${esc(n)} over`:"Even";
  return `<div class="tr-bal${b.short?" short":""}">You give <b>${esc(cpToGpText(b.giveCp))}</b> · you get <b>${esc(cpToGpText(b.getCp))}</b> · <span class="tr-net">${net}</span></div>`;
}
function tradeCoinsHTML(side,coins,held){
  return `<div class="tr-coins">`+coinKeys().map(k=>{const c=COIN_ALL.find(x=>x[0]===k),lbl=c?c[1]:k.toUpperCase(),v=num((coins||{})[k]);
    const cap=held?` max="${esc(String(num(held[k])))}"`:"";
    return `<label class="tr-coin"><span>${esc(lbl)}</span><input type="number" inputmode="numeric" data-trcoin="${esc(side+":"+k)}" min="0"${cap} step="1" value="${esc(v?String(v):"")}" placeholder="0" aria-label="${esc((side==="give"?"Give ":"Get ")+(c?c[2]:k))}"></label>`;}).join("")+`</div>`;
}
function tradeSwitchHTML(id,on){
  return `<button type="button" class="tr-apply" id="${esc(id)}" role="switch" aria-checked="${on?"true":"false"}"><span>Apply item value</span><span class="switch${on?" on":""}" aria-hidden="true"></span></button>`;
}
function tradeStepHTML(attr,key,qty,max,name){
  const mx=max!=null?` data-max="${esc(String(max))}"`:"";
  return `<span class="tr-q"><button type="button" class="tr-pm" ${attr}="${esc(key)}" data-d="-1"${mx} aria-label="${esc((qty<=1?"Remove ":"One fewer ")+name)}">−</button>`+
    `<b>${esc(String(qty))}</b><button type="button" class="tr-pm" ${attr}="${esc(key)}" data-d="1"${mx} aria-label="${esc("One more "+name)}"${max!=null&&qty>=max?" disabled":""}>+</button></span>`;
}
function tradeHTML(d,ch){
  const inv=(ch&&ch.inventory)||[],held=(ch&&ch.coins)||{};
  const sugg=[];
  cleanParty(ch&&ch.party).map(p=>p.name).concat(((ch&&ch.invLog)||[]).map(e=>e&&e.meta&&e.meta.with))
    .forEach(n=>{n=String(n||"").trim();if(n&&sugg.indexOf(n)<0&&sugg.length<8)sugg.push(n);});
  let give="";
  d.give.items.forEach(g=>{const it=inv.find(x=>x.id===g.id);if(!it)return;const nm=String(it.name||"Item");
    give+=`<div class="tr-it"><span class="tr-nm">${esc(nm)}</span>${tradeStepHTML("data-trgive",g.id,g.qty,itemQty(it),nm)}<span class="tr-worth">${esc(cpToGpText(itemWorthCp(it,g.qty)))}</span></div>`;});
  if(!give)give=`<p class="tr-none">Nothing yet.</p>`;
  const left=inv.filter(it=>itemQty(it)>0&&!d.give.items.some(g=>g.id===it.id));
  const pick=_trPick?`<div class="tr-pick">`+(left.length?left.map(it=>`<button type="button" class="tr-pickrow" data-traddgive="${esc(it.id)}"><span>${esc(String(it.name||"Item"))} ×${esc(String(itemQty(it)))}</span><span class="tr-worth">${esc(cpToGpText(itemWorthCp(it,1)))} each</span></button>`).join(""):`<p class="tr-none">Everything you carry is already in the trade.</p>`)+`</div>`:"";
  let get="";
  d.get.items.forEach(g=>{const nm=String(g.name||"")||"Custom item";
    const name=g.custom?`<input type="text" class="tr-name" data-trname="${esc(g.key)}" value="${esc(g.name)}" placeholder="Item name" aria-label="Custom item name" maxlength="80">`:esc(nm);
    get+=`<div class="tr-it${g.custom?" tr-custom":""}"><span class="tr-nm">${name}</span>${tradeStepHTML("data-trget",g.key,g.qty,999,nm)}`+
      `<label class="tr-cost"><input type="number" inputmode="decimal" data-trcost="${esc(g.key)}" min="0" step="0.01" value="${esc(String(fnum(g.cost)))}" aria-label="${esc("Cost of one "+nm+", in gp")}"><span>gp</span></label></div>`;});
  if(!get)get=`<p class="tr-none">Nothing yet.</p>`;
  return `<div class="tr-wrap tr-on-${d.tab==="get"?"get":"give"}">`+
    `<div class="tr-with"><label class="f" for="trWith">With</label><input type="text" id="trWith" value="${esc(d.with)}" placeholder="Who you're trading with (optional)" autocomplete="off" maxlength="60">`+
    (sugg.length?`<div class="tr-chips">${sugg.map(n=>`<button type="button" class="tr-chip" data-trwith="${esc(n)}">${esc(n)}</button>`).join("")}</div>`:"")+`</div>`+
    `<div class="tr-tabs" role="tablist">${tradeTabsInner(d)}</div>`+
    `<div class="tr-sides">`+
      `<section class="tr-side" data-side="give" id="trSideGive" role="tabpanel" aria-labelledby="trTabGive"><h5>You give</h5>${give}`+
        `<button type="button" class="tr-add" id="trPickGive" aria-expanded="${_trPick?"true":"false"}">+ From your inventory</button>${pick}`+
        `${tradeCoinsHTML("give",d.give.coins,held)}${tradeSwitchHTML("trApplyGive",d.applyGive)}</section>`+
      `<section class="tr-side" data-side="get" id="trSideGet" role="tabpanel" aria-labelledby="trTabGet"><h5>You get</h5>${get}`+
        `<div class="tr-adds"><button type="button" class="tr-add" id="trFind">+ Find an item</button><button type="button" class="tr-add" id="trCustom">+ Custom item</button></div>`+
        `${tradeCoinsHTML("get",d.get.coins,null)}${tradeSwitchHTML("trApplyGet",d.applyGet)}</section>`+
    `</div>`+
    `<div class="tr-foot">${tradeBalHTML(d,ch)}<div class="tr-acts"><button type="button" class="tbtn" id="trCancel">Cancel</button>`+
      `<button type="button" class="tbtn primary" id="trComplete" aria-label="Complete trade" title="Complete trade"${tradeEmpty(d)?" disabled":""}><span class="tr-done-ic" aria-hidden="true">✓</span><span class="tr-done-lbl">Complete Trade</span></button></div></div>`+
  `</div>`;
}
function completeTrade(d){
  if(!d)return null;
  tradeClamp(d,character);
  if(tradeEmpty(d))return null;
  const who=String(d.with||"").trim(),b=tradeBalance(d,character),lines=[],giveRecs=[],gotRecs=[];
  /* 1. what you give: capped at what you own, as the window caps it */
  d.give.items.forEach(g=>{
    const it=(character.inventory||[]).find(x=>x.id===g.id);if(!it)return;
    const q=Math.min(Math.max(0,num(g.qty)),itemQty(it)),nm=String(it.name||"Item");if(q<=0)return;
    const worth=itemWorthCp(it,q),r=invRemoveQty(g.id,q);
    /* a copy every time (final review K1): undo restores it if the row has gone since */
    giveRecs.push({id:g.id,qty:q,name:nm,snap:r.snap,atk:r.atk,at:r.at,atkAt:r.atkAt});
    lines.push({dir:"-",text:`${nm} ×${q}${invCostText(worth," (")}`});
  });
  /* 2. coins: the net change per denomination, giving capped at what you hold;
     the receipt lists them high to low, as the coin card does (pp → cp) */
  character.coins=character.coins||{};
  const delta={},cl=k=>{const c=COIN_ALL.find(x=>x[0]===k);return c?c[1]:k.toUpperCase();};
  Object.keys(COIN_CP).reverse().forEach(k=>{
    const gv=Math.min(Math.max(0,Math.round(num(d.give.coins[k]))),Math.max(0,num(character.coins[k]))),gt=Math.max(0,Math.round(num(d.get.coins[k])));
    if(gv)lines.push({dir:"-",text:`${gv} ${cl(k)}`});
    if(gt)lines.push({dir:"+",text:`${gt} ${cl(k)}`});
    const v=gt-gv;if(v){delta[k]=v;character.coins[k]=num(character.coins[k])+v;}
  });
  /* 3. what you get: library items through the finder's own path (so they stack
     as the finder stacks them); custom items with origin `custom` (spec §6.2) */
  d.get.items.forEach(g=>{
    const q=Math.min(999,Math.max(1,num(g.qty))),cost=Math.max(0,fnum(g.cost));
    if(g.custom||!g.def){
      const name=String(g.name||"").trim()||"Custom item";
      /* the fields every other way of making an item gives it (final review I1) */
      const it={id:uid(),name,qty:q,description:"",effects:[],equipped:false,cost,origin:{kind:"custom",detail:who?"traded from "+who:"traded",at:Date.now()}};
      character.inventory.push(it);gotRecs.push({id:it.id,qty:q,created:true,name});
      lines.push({dir:"+",text:`${name} ×${q}${invCostText(Math.round(cost*100*q)," (")}`});
    }else{
      const nm=String(g.name||g.def.name||"Item");
      addLibraryItems([g.def],{kind:"traded",detail:who,at:Date.now()},cost,q).forEach(r=>gotRecs.push(Object.assign(r,{name:nm})));
      lines.push({dir:"+",text:`${nm} ×${q}${invCostText(Math.round(cost*100*q)," (")}`});
    }
  });
  lines.push({dir:"",text:`You gave ${cpToGpText(b.giveCp)} · you got ${cpToGpText(b.getCp)}`});
  lines.push({dir:"",text:`Item value: ${d.applyGive?"counted":"not counted"} on what you gave, ${d.applyGet?"counted":"not counted"} on what you got`});
  /* 4. one line */
  const e=logInv({kind:"trade",title:who?"Traded with "+who:"Traded",lines,
    meta:{with:who,applyGive:!!d.applyGive,applyGet:!!d.applyGet,giveCp:b.giveCp,getCp:b.getCp},
    undo:{parts:[{kind:"give",u:{items:giveRecs}},{kind:"add",u:{items:gotRecs}},{kind:"coins",u:{delta}}]}});
  /* 5. */
  renderInventory();renderAttacks();renderCoins();recompute();scheduleSave();
  return e;
}
/* Where focus was, as a selector that finds the same control after a repaint:
   its id, else its trade hook (+ the stepper's direction). */
function tradeFocusSel(el){
  if(!el||el===document.body||!el.closest||!el.closest("#mBody"))return null;
  if(el.id)return attrSel("id",el.id);
  for(const k of ["data-trgive","data-trget","data-trcost","data-trname","data-trcoin","data-trtab","data-traddgive","data-trwith"]){
    if(el.hasAttribute(k))return attrSel(k,el.getAttribute(k))+(el.hasAttribute("data-d")?attrSel("data-d",el.getAttribute("data-d")):"");
  }
  return null;
}
function tradePaint(sel){
  const body=document.getElementById("mBody");if(!body||!_trade)return;
  const sc=body.querySelector(".tr-sides"),top=sc?sc.scrollTop:0;
  if(sel===undefined)sel=tradeFocusSel(document.activeElement);
  body.innerHTML=tradeHTML(_trade,character);
  const sc2=body.querySelector(".tr-sides");if(sc2)sc2.scrollTop=top;
  if(!sel)return;
  let el=body.querySelector(sel);
  /* a + at its cap is disabled: stay on the same row's − */
  if(el&&el.disabled)el=body.querySelector(sel.replace('[data-d="1"]','[data-d="-1"]'));
  if(!el||el.disabled){const box=document.querySelector("#modal .modal");if(box)box.focus({preventScroll:true});return;}
  el.focus({preventScroll:true});
}
/* Typing changes the totals, not the rows: refresh those in place, so the box
   being typed in is never replaced under the caret. */
function tradeRefresh(){
  const body=document.getElementById("mBody");if(!body||!_trade)return;
  const bal=body.querySelector(".tr-bal");if(bal)bal.outerHTML=tradeBalHTML(_trade,character);
  const tabs=body.querySelector(".tr-tabs");if(tabs)tabs.innerHTML=tradeTabsInner(_trade);
  const done=document.getElementById("trComplete");if(done)done.disabled=tradeEmpty(_trade);
}
function showTrade(){
  openModal("Trade",tradeHTML(_trade,character),"",{wide:true});
  setDismissGuard(()=>_trade&&!tradeEmpty(_trade)?"Discard this trade?":null);
}
/* The finder is its own full-screen layer UNDER the modal, so the trade window
   steps aside while it is up and comes back from the draft either way. */
function tradeFind(){
  const lib=rules.items||[];
  if(!lib.length){toast("No rules items are loaded. Add a custom item instead.");return;}
  const back=()=>{const bt=document.getElementById("btnTrade");if(bt&&bt.getClientRects().length)bt.focus({preventScroll:true});if(_trade)showTrade();};
  closeModal();
  openBrowse(Object.assign(itemBrowseCfg(lib),{
    added:x=>!!_trade&&_trade.get.items.some(g=>!g.custom&&String(g.name).toLowerCase()===String(x.name||"").toLowerCase()),
    onCustom:()=>{if(_trade){_trade.get.items.push({key:uid(),name:"",qty:1,cost:0,def:null,custom:true});_trade.tab="get";}back();},
    onAdd:(entries,og,costOverride,qty)=>{
      if(!_trade)return;
      entries.forEach(x=>{
        const ex=_trade.get.items.find(g=>!g.custom&&String(g.name).toLowerCase()===String(x.name||"").toLowerCase());
        if(ex){ex.qty=Math.min(999,ex.qty+finderQty(qty));if(costOverride!=null)ex.cost=costOverride;return;}
        _trade.get.items.push({key:uid(),name:String(x.name||""),qty:finderQty(qty),cost:costOverride??costToGp(x.cost)??0,def:x,custom:false});
      });
      _trade.tab="get";closeBrowse();back();
    },
    onClose:back
  }));
}
function openTrade(opts){
  _trade=newTradeDraft(opts);_trPick=false;
  showTrade();
  const body=document.getElementById("mBody");if(!body||body.dataset.trWired)return;
  body.dataset.trWired="1";
  const open=()=>!!_trade&&!!document.getElementById("trComplete");   /* only while the trade is the open dialog */
  body.addEventListener("click",e=>{
    if(!open())return;
    const t=e.target,d=_trade,inv=character.inventory||[];let m;
    if((m=t.closest("[data-trtab]"))){d.tab=m.dataset.trtab==="get"?"get":"give";return tradePaint();}
    if((m=t.closest("[data-trwith]"))){d.with=m.dataset.trwith;return tradePaint();}
    if(t.closest("#trApplyGive")){d.applyGive=!d.applyGive;return tradePaint();}
    if(t.closest("#trApplyGet")){d.applyGet=!d.applyGet;return tradePaint();}
    if(t.closest("#trPickGive")){_trPick=!_trPick;return tradePaint();}
    if((m=t.closest("[data-traddgive]"))){
      const it=inv.find(x=>x.id===m.dataset.traddgive);
      if(it&&itemQty(it)>0&&!d.give.items.some(g=>g.id===it.id))d.give.items.push({id:it.id,qty:1});
      if(!inv.some(x=>itemQty(x)>0&&!d.give.items.some(g=>g.id===x.id)))_trPick=false;
      return tradePaint(it?attrSel("data-trgive",it.id)+'[data-d="1"]':null);
    }
    if((m=t.closest("[data-trgive]"))){
      const g=d.give.items.find(x=>x.id===m.dataset.trgive),it=inv.find(x=>x.id===m.dataset.trgive);
      if(g){g.qty=Math.min(it?itemQty(it):0,g.qty+num(m.dataset.d));if(g.qty<=0)d.give.items=d.give.items.filter(x=>x!==g);}
      return tradePaint();
    }
    if((m=t.closest("[data-trget]"))){
      const g=d.get.items.find(x=>x.key===m.dataset.trget);
      if(g){g.qty=Math.min(999,g.qty+num(m.dataset.d));if(g.qty<=0)d.get.items=d.get.items.filter(x=>x!==g);}
      return tradePaint();
    }
    if(t.closest("#trCustom")){const k=uid();d.get.items.push({key:k,name:"",qty:1,cost:0,def:null,custom:true});d.tab="get";return tradePaint(attrSel("data-trname",k));}
    if(t.closest("#trFind"))return tradeFind();
    if(t.closest("#trCancel")){_trade=null;closeModal();return;}
    if(t.closest("#trComplete")){
      if(tradeEmpty(d))return;
      const b=tradeBalance(d,character);
      if(b.short&&!confirm(`You're ${cpToGpText(-b.diff)} short. Complete the trade anyway?`))return;
      const done=completeTrade(d);_trade=null;closeModal();
      if(done)toast(done.title+". It's in the log.");
      return;
    }
  });
  body.addEventListener("input",e=>{
    if(!open())return;
    const t=e.target,d=_trade;
    if(t.id==="trWith"){d.with=t.value;return;}
    if(t.dataset.trcoin){
      const [side,k]=t.dataset.trcoin.split(":"),s=d[side==="get"?"get":"give"];let v=Math.max(0,num(t.value));
      if(side==="give")v=Math.min(v,Math.max(0,num((character.coins||{})[k])));
      /* coins are whole: the box shows what the draft holds (2.5 → 2, −3 → 0, over the cap → the cap) */
      if(t.value!==""&&t.value!==String(v))t.value=String(v);
      s.coins[k]=v;return tradeRefresh();
    }
    if(t.dataset.trcost){const g=d.get.items.find(x=>x.key===t.dataset.trcost);if(g)g.cost=Math.max(0,fnum(t.value));return tradeRefresh();}
    if(t.dataset.trname){const g=d.get.items.find(x=>x.key===t.dataset.trname);if(g)g.name=t.value;return;}
  });
}
