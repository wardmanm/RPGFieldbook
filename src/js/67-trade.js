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
function itemWorthCp(it,qty){return Math.round(fnum(it&&it.cost)*100)*Math.max(0,num(qty));}
function invSnap(it){return it==null?null:JSON.parse(JSON.stringify(it));}
function invSame(a,b){
  const norm=v=>Array.isArray(v)?v.map(norm):(v&&typeof v==="object")?Object.keys(v).sort().reduce((o,k)=>{o[k]=norm(v[k]);return o;},{}):v;
  return JSON.stringify(norm(a))===JSON.stringify(norm(b));
}
function cleanInvLog(v,size){
  const n=INV_LOG_SIZES.indexOf(num(size))>=0?num(size):500;
  return (Array.isArray(v)?v:[]).filter(e=>e&&typeof e==="object"&&INV_KINDS.indexOf(e.kind)>=0&&num(e.at)>0)
    .map(e=>({id:String(e.id||uid()),at:num(e.at),kind:e.kind,title:String(e.title||""),
      lines:(Array.isArray(e.lines)?e.lines:[]).filter(l=>l&&typeof l==="object").map(l=>({dir:l.dir==="+"||l.dir==="-"?l.dir:"",text:String(l.text||"")})),
      undo:(e.undo&&typeof e.undo==="object")?e.undo:null,undone:e.undone===true,meta:(e.meta&&typeof e.meta==="object")?e.meta:{}}))
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
function grantSourceName(sid){const s=String(sid||"");return s.slice(s.indexOf(":")+1)||s;}
/* One line per source: a class's starting gear arrives as several calls in a row. */
function logGrant(sid,line){
  const top=(character.invLog||[])[0];
  if(top&&top.kind==="grant"&&top.meta&&top.meta.sid===sid&&Date.now()-num(top.at)<5000){top.lines.push(line);return top;}
  return logInv({kind:"grant",title:"Granted by "+grantSourceName(sid),lines:[line],undo:null,meta:{sid}});
}
/* ---- item helpers for undo (and the trade) ---- */
function invRemoveQty(id,qty){
  const it=(character.inventory||[]).find(x=>x.id===id);if(!it)return {removed:false,snap:null,atk:null};
  const left=itemQty(it)-num(qty);
  if(left<=0){
    const snap=invSnap(it),atk=invSnap((character.attacks||[]).find(a=>a.itemId===id)||null);
    character.inventory=character.inventory.filter(x=>x.id!==id);
    character.attacks=(character.attacks||[]).filter(a=>a.itemId!==id);
    forgetAmmo(character,id);
    return {removed:true,snap,atk};
  }
  it.qty=left;return {removed:false,snap:null,atk:null};
}
function invRestore(snap,atk){
  const it=invSnap(snap);if((character.inventory||[]).some(x=>x.id===it.id))it.id=uid();
  character.inventory.push(it);
  if(atk){const a=invSnap(atk);a.itemId=it.id;if((character.attacks||[]).some(x=>x.id===a.id))a.id=uid();character.attacks.push(a);it.attackId=a.id;}
  return it.id;
}
/* ---- undo ---- */
const INV_WHY={add:"It has since been used, sold or removed.",edit:"It has been changed again since.",gone:"It is no longer in your inventory."};
function invCheckPart(kind,u){
  if(kind==="add"){for(const p of (u.items||[])){const it=(character.inventory||[]).find(x=>x.id===p.id);if(!it||itemQty(it)<num(p.qty))return INV_WHY.add;}return "";}
  if(kind==="edit"){const it=(character.inventory||[]).find(x=>x.id===u.after.id);return (it&&invSame(it,u.after))?"":INV_WHY.edit;}
  if(kind==="coins"){
    for(const k of Object.keys(u.delta||{})){const d=num(u.delta[k]);if(d>0&&num((character.coins||{})[k])<d){const c=COIN_ALL.find(x=>x[0]===k);return `Not enough ${c?c[1]:k.toUpperCase()} left to take back.`;}}
    return "";
  }
  return "";   /* delete and use are always clean */
}
function invUndoCheck(e){
  if(!e||e.undone)return {ok:false,why:e&&e.undone?"Already undone.":""};
  if(!e.undo||e.kind==="grant"||e.kind==="ammo")return {ok:false,why:""};
  if(e.kind==="trade"){for(const p of (e.undo.parts||[])){const w=invCheckPart(p.kind,p.u);if(w)return {ok:false,why:w};}return {ok:true,why:""};}
  const w=invCheckPart(e.kind,e.undo);return {ok:!w,why:w};
}
function invApplyPart(kind,u){
  if(kind==="add")(u.items||[]).forEach(p=>{const it=character.inventory.find(x=>x.id===p.id);if(!it)return;if(p.created&&itemQty(it)<=num(p.qty))invRemoveQty(p.id,itemQty(it));else invRemoveQty(p.id,p.qty);});
  else if(kind==="edit"){const i=character.inventory.findIndex(x=>x.id===u.after.id);if(i>=0){character.inventory[i]=invSnap(u.before);syncItemAttack(character.inventory[i]);}}
  else if(kind==="delete")invRestore(u.snap,u.atk);
  else if(kind==="use"){
    const it=(character.inventory||[]).find(x=>x.id===u.id);
    if(it){if(num(u.qty))it.qty=itemQty(it)+num(u.qty);if(num(u.used)&&it.uses)it.uses.used=Math.max(0,num(it.uses.used)-num(u.used));}
    else if(u.snap)invRestore(u.snap,u.atk||null);
  }
  else if(kind==="coins"){character.coins=character.coins||{};Object.keys(u.delta||{}).forEach(k=>{character.coins[k]=num(character.coins[k])-num(u.delta[k]);});}
  else if(kind==="give")(u.items||[]).forEach(p=>{const it=character.inventory.find(x=>x.id===p.id);if(it)it.qty=itemQty(it)+num(p.qty);else if(p.snap)invRestore(p.snap,p.atk);});
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
