/* ================= ammunition =================
   A bow, crossbow, sling, blowgun or firearm knows the KIND of ammunition it
   fires (weapon.ammo, from the pack); a stack of ammunition knows its kind and
   any +N it adds (item.ammo). The weapon's attack row spends from the stack it
   is loaded with, and recovery gives half back. Bundles ("Arrows (20)") unpack
   into single pieces the moment they reach a sheet, so a stack's qty is its count.
   Design: src/docs/specs/2026-10-02-ammo-design.md

   The pure half comes first — no DOM — so src/tests/sheet.js can assert it. */

/* A kind is the lower-case name of the single piece ("arrow", "sling bullet"),
   compared after trimming and collapsing spaces, so a pack's "Arrow " matches. */
function ammoKindOf(v){return (typeof v==="string"?v:"").replace(/\s+/g," ").trim().toLowerCase();}
const AMMO_KINDS=["arrow","bolt","firearm bullet","needle","sling bullet"];
/* What the one-time pass knows without a rules pool. Every row agrees with
   data/srd52/items.json and with the private repo's 2024 pack: rules-data.js
   checks the first and the private-data suite the second. A cost is written
   as the pack writes it; the Sling Bullet has none. */
const AMMO_PIECES={
  "arrow":         {name:"Arrow",          cost:"5 cp", weight:0.05},
  "bolt":          {name:"Bolt",           cost:"5 cp", weight:0.075},
  "firearm bullet":{name:"Firearm Bullet", cost:"3 sp", weight:0.2},
  "needle":        {name:"Needle",         cost:"2 cp", weight:0.02},
  "sling bullet":  {name:"Sling Bullet",                weight:0.075}
};
/* single pieces by name, the 2014 names mapping to their 2024 kind */
const AMMO_SINGLE_NAMES={"arrow":"arrow","bolt":"bolt","crossbow bolt":"bolt","firearm bullet":"firearm bullet",
  "needle":"needle","blowgun needle":"needle","sling bullet":"sling bullet"};
/* bundles by name: [kind, how many pieces one holds] */
const AMMO_BUNDLES={"arrows (20)":["arrow",20],"bolts (20)":["bolt",20],"crossbow bolts (20)":["bolt",20],
  "firearm bullets (10)":["firearm bullet",10],"needles (50)":["needle",50],"blowgun needles (50)":["needle",50],
  "sling bullets (20)":["sling bullet",20]};
const AMMO_LAUNCHERS={"longbow":"arrow","shortbow":"arrow","light crossbow":"bolt","heavy crossbow":"bolt",
  "hand crossbow":"bolt","sling":"sling bullet","blowgun":"needle","musket":"firearm bullet","pistol":"firearm bullet"};
/* An OWN-property lookup into one of the plain-object tables above. A name of
   "constructor" or "__proto__" finds an inherited property otherwise — an
   object or function, never undefined — so migrateAmmo() read one as a real
   table entry and threw reading .name off it. Not Object.hasOwn: the app
   targets ES2020. */
function ammoTable(T,k){return Object.prototype.hasOwnProperty.call(T,k)?T[k]:undefined;}

/* ---- reading it, whatever a file put there ---- */
function itemAmmo(it){
  const a=it&&it.ammo;
  if(!a||typeof a!=="object"||Array.isArray(a))return null;
  const kind=ammoKindOf(a.kind);if(!kind)return null;
  const b=Math.trunc(Number(a.bonus));
  return {kind,bonus:isFinite(b)?Math.max(-9,Math.min(9,b)):0};
}
function weaponAmmoKind(it){return (it&&it.weapon&&typeof it.weapon==="object")?ammoKindOf(it.weapon.ammo):"";}
/* The stacks a weapon of `kind` can load, in inventory order. A bundle never
   sits on a sheet (it unpacks on arrival); one from an odd file is skipped.
   An empty stack (qty < 1) can't be loaded. */
function ammoStacks(c,kind){
  if(!kind)return [];
  return (Array.isArray(c&&c.inventory)?c.inventory:[])
    .filter(i=>i&&typeof i==="object"&&!i.pack&&itemQty(i)>=1&&(itemAmmo(i)||{}).kind===kind);
}
/* The stack a weapon fires from: the one the player chose (ammoStack, kept on
   the item OUTSIDE `weapon`, which the rules-update tool owns) while it exists
   and is of the right kind, else the first of its kind. null when there is none. */
function loadedStack(c,weaponItem){
  const st=ammoStacks(c,weaponAmmoKind(weaponItem));
  return st.find(s=>s.id===(weaponItem&&weaponItem.ammoStack))||st[0]||null;
}
function ammoPlural(kind){const k=ammoKindOf(kind);return k?(/s$/.test(k)?k:k+"s"):"pieces";}
function ammoOne(kind){const k=ammoKindOf(kind)||"piece";return (/^[aeiou]/.test(k)?"an ":"a ")+k;}

/* ---- a bundle unpacks into its single piece ----
   `x` is a pack entry. A bundle (pack:{item, qty}) comes back as the single
   piece to add and how many ONE bundle holds: the pool's own entry for that
   piece when it has one, else a piece made from the bundle itself, cost and
   weight divided. Anything else comes back as it is, one to one. Pure. */
function unpackAmmo(x,pool){
  const p=x&&x.pack;
  const per=(p&&typeof p==="object")?Math.trunc(Number(p.qty)):0;
  const nm=(p&&typeof p.item==="string")?p.item.trim():"";
  if(!(per>=1)||!nm)return {def:x,per:1};
  const def=(Array.isArray(pool)?pool:[]).find(e=>e&&typeof e==="object"&&!e.pack&&String(e.name||"").toLowerCase()===nm.toLowerCase());
  if(def)return {def,per};
  const made={name:nm,description:x.description||"",effects:[]};
  ["category","type","rarity","system","_source"].forEach(k=>{if(x[k]!=null)made[k]=x[k];});
  const gp=costToGp(x.cost), wt=fnum(x.weight);
  if(gp!=null&&gp/per>=0.01)made.cost=fmtGp(gp/per);
  if(wt)made.weight=Math.round(wt/per*1000)/1000;
  const am=itemAmmo(x);if(am)made.ammo=am.bonus?{kind:am.kind,bonus:am.bonus}:{kind:am.kind};
  return {def:made,per};
}

/* ---- the one-time pass on sheets saved before ammunition ----
   Runs once per character (ammoInit, never defaulted in blankChar(), as
   wpnEquipInit isn't), from each item's own data: migrate() runs before a
   rules pool can be relied on. Known bundles unpack into their single piece,
   known pieces learn their kind, known 2024 launchers learn what they fire.
   Anything else is left exactly as it is. */

/* Re-take the rules-update tool's baseline for each field the pass rewrote.
   `before` holds each field's value before the pass; `proj`, where the pass
   knows it, is the pack's own projection of the field (a bundle unpacked into a
   known piece). The copy side (cfp) moves only where the player hadn't edited
   the field, so their edit still reads as theirs. The pack side (fp) takes the
   known projection, or else follows the copy only where the copy matched the
   pack, so an older pack change the player never applied still shows. */
function rebaseAmmo(it,before,proj){
  const s=it&&it.src;
  if(!s||typeof s!=="object")return;
  if(!s.fp||typeof s.fp!=="object"||Array.isArray(s.fp))s.fp={};
  if(!s.cfp||typeof s.cfp!=="object"||Array.isArray(s.cfp))s.cfp={};
  Object.keys(before).forEach(f=>{
    const was=fpHash(before[f]), now=fpHash(it[f]);
    if(s.cfp[f]===undefined||s.cfp[f]===was)s.cfp[f]=now;
    if(proj&&f in proj)s.fp[f]=fpHash(proj[f]);
    else if(s.fp[f]===undefined||s.fp[f]===was)s.fp[f]=now;
  });
}
function migrateAmmo(c){
  if(!c||c.ammoInit)return 0;
  const inv=Array.isArray(c.inventory)?c.inventory:[], unpacked=new Set();
  let n=0;
  inv.forEach(it=>{
    if(!it||typeof it!=="object")return;
    const key=String(it.name||"").trim().toLowerCase();
    const b=ammoTable(AMMO_BUNDLES,key);
    if(b){
      /* "Arrows (20)" ×2 becomes Arrow ×40, each a twentieth of the bundle's
         own price and weight (spec §3.3), so a price the player paid survives */
      const kind=b[0], per=b[1], pc=AMMO_PIECES[kind];
      const before={cost:it.cost,weight:it.weight,ammo:it.ammo,description:it.description};
      const gp=costToGp(it.cost), wt=fnum(it.weight);
      it.name=pc.name;it.qty=itemQty(it)*per;
      if(gp!=null)it.cost=Math.round(gp/per*10000)/10000;
      if(wt)it.weight=Math.round(wt/per*1000)/1000;
      it.ammo={kind};
      /* a finder copy's description opens with the bundle's meta line
         ("Ammunition · 1 gp · 1 lb"); it now opens with the piece's */
      if(it.src&&it.src.shape==="browse"&&typeof it.description==="string"){
        const nl=it.description.indexOf("\n"), head=nl<0?it.description:it.description.slice(0,nl);
        if(/ lb$/.test(head))it.description=itemMetaLine({type:it.type,cost:pc.cost,weight:pc.weight})+(nl<0?"":it.description.slice(nl));
      }
      if(it.src&&typeof it.src==="object")it.src.name=pc.name;
      const g=costToGp(pc.cost);
      rebaseAmmo(it,before,{cost:g==null?undefined:g,weight:pc.weight,ammo:{kind}});
      unpacked.add(it);n++;return;
    }
    const single=ammoTable(AMMO_SINGLE_NAMES,key);
    if(single&&!itemAmmo(it)){
      const before={ammo:it.ammo};it.ammo={kind:single};
      rebaseAmmo(it,before,{ammo:{kind:single}});n++;return;
    }
    const lk=ammoTable(AMMO_LAUNCHERS,key);
    if(lk&&it.weapon&&typeof it.weapon==="object"&&!Array.isArray(it.weapon)&&!it.weapon.ammo){
      const before={weapon:it.weapon};
      it.weapon=Object.assign({},it.weapon,{ammo:lk});
      rebaseAmmo(it,before,null);n++;
    }
  });
  /* An unpacked bundle joins a stack of the same piece, bonus and grant: the
     one the player already had, wherever it sits, else the first bundle
     unpacked here, so two bundles become one stack. Only within one grant, so
     removing a class still takes back exactly what it granted; stacks the
     player kept apart stay apart. */
  const keyOf=it=>{const a=itemAmmo(it);return a?[String(it.name||"").trim().toLowerCase(),a.bonus,it.grant||""].join("|"):null;};
  const home=new Map();
  inv.forEach(it=>{const k=keyOf(it);if(k==null)return;const h=home.get(k);
    if(!h||(unpacked.has(h)&&!unpacked.has(it)))home.set(k,it);});
  c.inventory=inv.filter(it=>{
    const k=keyOf(it),h=k==null?null:home.get(k);
    if(!h||h===it||!unpacked.has(it))return true;
    h.qty=itemQty(h)+itemQty(it);n++;return false;
  });
  c.ammoInit=1;
  return n;
}

/* ---- firing, undoing, recovering ---- */
function ammoSpentMap(c){const m=c&&c.ammoSpent;return (m&&typeof m==="object"&&!Array.isArray(m))?m:{};}
/* One stack's spent record, coerced: how many fired since the last recovery,
   its kind, the copy recovery rebuilds a used-up stack from, and how many of
   those shots End combat has already asked about (#6 final review: a whole
   number, clamped to [0, n], so a later shot always makes `n > asked` true). */
function ammoSpentEntry(c,id){
  const e=ammoSpentMap(c)[id], ok=e&&typeof e==="object"&&!Array.isArray(e);
  const n=(ok&&Number.isInteger(e.n)&&e.n>0)?e.n:0;
  const asked=(ok&&Number.isInteger(e.asked))?Math.max(0,Math.min(n,e.asked)):0;
  return {n,kind:ok?ammoKindOf(e.kind):"",
          snap:(ok&&e.snap&&typeof e.snap==="object"&&!Array.isArray(e.snap))?e.snap:null,
          asked};
}
/* One shot from the weapon's loaded stack: one piece off it (the last removes
   the stack, as using the last potion does), and one more on its spent count,
   with a copy of the stack for recovery to rebuild it from. Returns what Undo
   needs, or null when there is nothing to fire. */
function fireAmmo(c,weaponItem){
  const st=loadedStack(c,weaponItem);if(!st)return null;
  const am=itemAmmo(st);
  if(!c.ammoSpent||typeof c.ammoSpent!=="object"||Array.isArray(c.ammoSpent))c.ammoSpent={};
  const undo={stack:JSON.parse(JSON.stringify(st)),at:c.inventory.indexOf(st),
              spent:c.ammoSpent[st.id]?JSON.parse(JSON.stringify(c.ammoSpent[st.id])):null};
  const prev=ammoSpentEntry(c,st.id);
  /* the entry is rebuilt from scratch on every shot, so `asked` has to be
     carried across by hand or a later shot would read as never having been
     asked about at all */
  c.ammoSpent[st.id]={n:prev.n+1,kind:am.kind,asked:prev.asked,snap:Object.assign(JSON.parse(JSON.stringify(st)),{qty:1})};
  const left=Math.max(0,itemQty(st)-1);
  if(left<=0)c.inventory=c.inventory.filter(x=>x!==st);else st.qty=left;
  return {stack:st,kind:am.kind,left,removed:left<=0,undo};
}
/* Undo puts back exactly what that shot took: one piece onto its stack, or the
   whole stack at its old place when the shot removed it, and the spent count as
   it was. A stack the player deleted since stays deleted: they chose that. An Undo applies once. */
function undoFire(c,rec){
  if(!c||!rec||!rec.undo||!rec.undo.stack)return false;
  if(rec.undone)return false;
  const u=rec.undo, id=u.stack.id;
  if(!Array.isArray(c.inventory))c.inventory=[];
  const cur=c.inventory.find(x=>x&&x.id===id);
  if(cur)cur.qty=itemQty(cur)+1;
  else if(rec.removed)c.inventory.splice(Math.max(0,Math.min(c.inventory.length,u.at)),0,JSON.parse(JSON.stringify(u.stack)));
  else return false;
  if(!c.ammoSpent||typeof c.ammoSpent!=="object"||Array.isArray(c.ammoSpent))c.ammoSpent={};
  if(u.spent)c.ammoSpent[id]=u.spent;else delete c.ammoSpent[id];
  rec.undone=true;
  return true;
}
/* What recovery would give back, per kind: half of each stack's count, rounded
   down per stack, summed. Kinds with nothing to give back are left out. */
function ammoRecoverable(c){
  const by=new Map();
  Object.keys(ammoSpentMap(c)).forEach(id=>{
    const e=ammoSpentEntry(c,id);if(!e.n||!e.kind)return;
    const r=by.get(e.kind)||{kind:e.kind,fired:0,back:0};
    r.fired+=e.n;r.back+=Math.floor(e.n/2);by.set(e.kind,r);
  });
  return [...by.values()].filter(r=>r.back>0);
}
/* Gives back half of what was fired since the last recovery, for the kinds
   asked (every kind when none are), and clears those counts: the other half is
   lost, as the rules have it. When the old stack is gone, recovery first looks
   for an equivalent one already on the sheet — not a bundle, the same
   lower-cased trimmed name, the same ammo bonus and the same grant as the
   snapshot — and tops that up instead of making a second "+1 Arrow" row; any
   weapon loaded with the old id is repointed to it. Only when there is none
   does the old stack come back from its copy, under its old id. Returns how
   many pieces came back. */
function recoverAmmo(c,kinds){
  const want=Array.isArray(kinds)?new Set(kinds.map(ammoKindOf)):null;
  const m=ammoSpentMap(c);
  if(!Array.isArray(c.inventory))c.inventory=[];
  let back=0;
  Object.keys(m).forEach(id=>{
    const e=ammoSpentEntry(c,id);
    if(want&&!want.has(e.kind))return;
    const n=Math.floor(e.n/2);
    if(n>0){
      const st=c.inventory.find(x=>x&&x.id===id);
      if(st){st.qty=itemQty(st)+n;back+=n;}
      else if(e.snap){
        const snapAm=itemAmmo(e.snap), snapName=String(e.snap.name||"").trim().toLowerCase(),
              snapGrant=e.snap.grant||"";
        const home=c.inventory.find(x=>x&&typeof x==="object"&&!x.pack&&
          String(x.name||"").trim().toLowerCase()===snapName&&
          (itemAmmo(x)||{}).bonus===(snapAm?snapAm.bonus:0)&&(x.grant||"")===snapGrant);
        if(home){
          home.qty=itemQty(home)+n;
          c.inventory.forEach(x=>{if(x&&x.ammoStack===id)x.ammoStack=home.id;});
        }else c.inventory.push(Object.assign(JSON.parse(JSON.stringify(e.snap)),{id,qty:n}));
        back+=n;
      }
    }
    delete m[id];
  });
  return back;
}
/* True when End combat still owes a prompt: some kinded entry has fired more
   than it was last asked about (#6 final review — "No" must not ask again
   about the very same shots). */
function ammoAskDue(c){
  const m=ammoSpentMap(c);
  return Object.keys(m).some(id=>{const e=ammoSpentEntry(c,id);return !!e.kind&&e.n>e.asked;});
}
/* After a "No": every kinded entry's `asked` catches up to its `n`, so a
   fight with no new shots asks nothing next time. `n` itself, and so Recover
   N, are untouched. */
function markAmmoAsked(c){
  const m=ammoSpentMap(c);
  Object.keys(m).forEach(id=>{const e=ammoSpentEntry(c,id);if(e.kind)m[id].asked=e.n;});
}
function ammoSummaryText(list){return list.map(r=>`${r.back} of ${r.fired} ${ammoPlural(r.kind)}`).join(", ");}
/* A deleted stack's count goes with it: there is nothing to recover into, and
   the player chose to delete it. */
function forgetAmmo(c,id){const m=ammoSpentMap(c);if(id in m)delete m[id];}
/* Removing a class or background forgets every spent count it granted, even
   one whose stack is already gone — fired down to nothing, which removes the
   stack the way the last potion does, well before the source itself is
   removed. Without this, revertEquipmentGrants()'s own id-based forgetAmmo()
   only reaches a granted stack still in the inventory, and Recover brings the
   revoked grant's arrows back. */
function forgetGrantAmmo(c,sid){
  const m=ammoSpentMap(c);
  Object.keys(m).forEach(id=>{
    const e=m[id];
    if(e&&typeof e==="object"&&!Array.isArray(e)&&e.snap&&typeof e.snap==="object"&&!Array.isArray(e.snap)&&e.snap.grant===sid)delete m[id];
  });
}
/* The +N a weapon row gets from the stack its item is loaded with, and that
   stack's name for the breakdown. Nothing for a row with no item. */
function attackAmmo(a){
  const inv=Array.isArray(character&&character.inventory)?character.inventory:[];
  const it=a&&a.itemId?inv.find(i=>i&&i.id===a.itemId):null;
  if(!it||!weaponAmmoKind(it))return {bonus:0,name:""};
  const st=loadedStack(character,it), am=st&&itemAmmo(st);
  return {bonus:am?am.bonus:0,name:st?String(st.name||""):""};
}

/* ---- the item editor's kind lists (#8) ----
   The five 2024 kinds, then any other kind this sheet already uses (on an
   ammunition item or a weapon), then `also` (the kinds the form opened with),
   so an item's own kind is always on its list. */
function ammoKindChoices(c,also){
  const seen=new Set(AMMO_KINDS), extra=[];
  const add=k=>{k=ammoKindOf(k);if(k&&!seen.has(k)){seen.add(k);extra.push(k);}};
  (Array.isArray(c&&c.inventory)?c.inventory:[]).forEach(i=>{const a=itemAmmo(i);if(a)add(a.kind);add(weaponAmmoKind(i));});
  (Array.isArray(also)?also:[]).forEach(add);
  return AMMO_KINDS.concat(extra);
}
function ammoKindLabel(k){k=String(k||"");return k.charAt(0).toUpperCase()+k.slice(1);}
/* <option>s for a kind <select>: None first when `noneLabel` is given, each
   kind, then "Other…" (value "__other"), which opens a box for a new kind. */
function ammoKindOptionsHTML(kinds,selected,noneLabel){
  const sel=ammoKindOf(selected);
  return (noneLabel?`<option value=""${sel?"":" selected"}>${esc(noneLabel)}</option>`:"")+
    kinds.map(k=>`<option value="${esc(k)}"${k===sel?" selected":""}>${esc(ammoKindLabel(k))}</option>`).join("")+
    `<option value="__other">Other…</option>`;
}

/* ================= the DOM half =================
   The ammunition line under a launcher's attack row, the stack picker, and
   recovery at End combat. The combat view holds the same Attacks card, so all
   of it works there too. */

/* What a launcher's attack row shows under it: the stack it is loaded with (a
   button that opens the picker when there is a choice), Fire, and Recover N
   when a recovery would give something back. Empty for a row whose item fires
   nothing. Takes the character, so the hostile-data test can call it. */
function ammoLineHTML(c,a){
  const inv=Array.isArray(c&&c.inventory)?c.inventory:[];
  const it=a&&a.itemId?inv.find(i=>i&&i.id===a.itemId):null;
  const kind=weaponAmmoKind(it);
  if(!kind)return "";
  const st=loadedStack(c,it), many=ammoStacks(c,kind).length>1;
  const label=st?`${String(st.name||"")} ×${itemQty(st)}`:`No ${ammoPlural(kind)}`;
  const back=(ammoRecoverable(c).find(r=>r.kind===kind)||{}).back||0;
  return `<div class="ammo-line">`+
    (many?`<button type="button" class="ammo-load" data-ammo-pick="${esc(it.id)}" aria-label="${esc("Loaded: "+label+". Choose what it fires")}">${esc(label)}</button>`
         :`<span class="ammo-load">${esc(label)}</span>`)+
    `<button type="button" class="tbtn ammo-fire" data-ammo-fire="${esc(it.id)}"${st?"":" disabled"} aria-label="${esc("Fire "+ammoOne(kind)+" from "+String(it.name||"this weapon"))}">Fire</button>`+
    (back>0?`<button type="button" class="tbtn ammo-recover" data-ammo-recover="${esc(it.id)}" aria-label="${esc("Recover "+back+" "+ammoPlural(kind))}">Recover ${back}</button>`:"")+
    `</div>`;
}
/* The row's Fire button for a weapon item, while it is on screen and live. */
function ammoFireBtn(itemId){
  const b=document.querySelector(attrSel("data-ammo-fire",itemId));
  return b&&!b.disabled&&b.getClientRects().length?b:null;
}
/* One Fire tap. The save is scheduled before the redraw, so nothing a redraw
   throws can cost the player the shot. From the keyboard (event.detail 0)
   focus stays on Fire while there is more to fire, else it moves to the
   toast's Undo; a held Enter's auto-repeat must not then press Undo, so the
   Undo ignores repeated keys. `who` is the character the toast was shown for.
   Returns the shot, or null when there was nothing to fire. */
function fireWeapon(itemId,viaKey){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  const r=it?fireAmmo(character,it):null;
  if(!r)return null;
  const who=character;
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  const msg=r.removed?`Fired your last ${String(r.stack.name||r.kind)}`:`Fired ${ammoOne(r.kind)} · ${r.left} left`;
  const undo=toast(msg,{label:"Undo",
    run:e=>undoFireTap(r,who,!!e&&e.detail===0,itemId),
    back:()=>ammoFireBtn(itemId)});
  if(undo)undo.addEventListener("keydown",e=>{if(e.repeat)e.preventDefault();});
  if(viaKey){const b=ammoFireBtn(itemId);if(b)b.focus();else if(undo)undo.focus();}
  return r;
}
/* The toast's Undo: only for the character it was shown for. */
function undoFireTap(rec,who,viaKey,itemId){
  if(!character||character!==who)return false;
  if(!undoFire(character,rec))return false;
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  const st=(character.inventory||[]).find(i=>i&&i.id===rec.undo.stack.id);
  toast(st?`Shot undone · ${String(st.name||"")} ×${itemQty(st)}`:"Shot undone");
  if(viaKey){const b=ammoFireBtn(itemId);if(b)b.focus();}
  return true;
}
/* One row of the stack picker (spec §6): name, ×qty, and the stack's +N when
   it has one — "· +1", "· -1" — so a plain and a magic stack of the same
   piece read apart. `cur` is the stack the weapon is loaded with now. */
function ammoChoiceHTML(s,cur){
  const am=itemAmmo(s), bonus=am&&am.bonus?(am.bonus>0?"+"+am.bonus:String(am.bonus)):"";
  const hint="×"+String(itemQty(s))+(bonus?" · "+bonus:"");
  return `<button type="button" class="ammo-choice${s===cur?" on":""}" data-ammo-load="${esc(s.id)}" aria-pressed="${s===cur?"true":"false"}"><span>${esc(String(s.name||""))}</span><span class="hint">${esc(hint)}</span></button>`;
}
/* The stack picker: every stack the weapon can load, the loaded one marked. */
function openAmmoPicker(itemId){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  const kind=weaponAmmoKind(it);if(!kind)return;
  const cur=loadedStack(character,it);
  const list=ammoStacks(character,kind).map(s=>ammoChoiceHTML(s,cur)).join("");
  openModal("Load "+String(it.name||"weapon"),
    `<p class="hint">What ${esc(String(it.name||"it"))} fires next. It keeps firing from this stack while the stack lasts.</p><div class="ammo-picks" data-ammo-weapon="${esc(it.id)}">${list}</div>`);
}
/* A stack chosen in the picker, kept on the weapon item OUTSIDE `weapon`. The
   modal hands focus back to the row's picker button once the row is redrawn. */
function loadAmmo(itemId,stackId){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  const st=it&&ammoStacks(character,weaponAmmoKind(it)).find(s=>s.id===stackId);
  if(!st)return false;
  it.ammoStack=st.id;
  closeModal();scheduleSave();renderAttacks();
  return true;
}
/* Recover N on a row: half of what this kind fired since the last recovery. */
function recoverWeaponAmmo(itemId,viaKey){
  const it=(character.inventory||[]).find(i=>i&&i.id===itemId);
  const kind=weaponAmmoKind(it);if(!kind)return 0;
  const list=ammoRecoverable(character).filter(r=>r.kind===kind);
  const back=recoverAmmo(character,[kind]);
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  toast(back?`Recovered ${ammoSummaryText(list)}`:`No ${ammoPlural(kind)} to recover`);
  if(viaKey){const b=ammoFireBtn(itemId);if(b)b.focus();}
  return back;
}
/* Asked once, after End combat, and only when a shot has been fired since the
   last time this asked (#6 final review — "No" must not ask again about the
   same shots next fight): half of what was fired since the last recovery,
   listed per kind. Yes recovers it all and clears every count (a lone shot
   rounds down to nothing, and is lost); No marks every count asked about —
   Recover N on the row still shows and recovers the full count. Returns words
   for the End combat toast, else "". */
function offerAmmoRecovery(){
  const list=ammoRecoverable(character);
  if(!list.length||!ammoAskDue(character))return "";
  if(!confirm(`Recover ammunition? ${ammoSummaryText(list)}`)){
    markAmmoAsked(character);scheduleSave();
    return "";
  }
  const back=recoverAmmo(character);
  scheduleSave();
  renderInventory();renderAttacks();recompute();
  return back?`recovered ${ammoSummaryText(list)}`:"";
}
