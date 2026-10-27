/* Boot reads localStorage synchronously (below), so the IDB copy — which is the
   authoritative one once it exists — is hydrated straight after and replaces it. */
function loadRulesCacheAsync(){
  if(!idbReady())return Promise.resolve(false);
  return idbTx("readonly",st=>st.get(IDB_KEY)).then(json=>{
    if(!json)return false;
    const parsed=JSON.parse(json);
    if(!parsed||typeof parsed!=="object")return false;
    rules=Object.assign(rules,parsed);
    reindexRules();recomputeDups();
    if(typeof refreshRulesUI==="function")refreshRulesUI();
    if(typeof renderRulesData==="function")renderRulesData();
    if(typeof renderAll==="function")renderAll();
    if(typeof updateRulesStatus==="function")updateRulesStatus(rulesStatusText(),"ok");
    if(typeof renderHome==="function")renderHome();
    return true;
  }).catch(()=>false);
}
/* Weapons only became equippable in this version. Every weapon on every sheet
   written before it is stored equipped:false — not as a decision, but because
   there was no control to make one — so gating attacks on that flag would empty
   the Attacks card of every character in existence.
   Equip them once, and record that it happened. The FLAG is what makes this
   safe to run on every load: without it, a weapon the player deliberately
   unequips would be re-equipped on the next open, forever. */
function migrateWeaponEquip(c){
  if(!c||c.wpnEquipInit)return 0;
  let n=0;
  (c.inventory||[]).forEach(it=>{ if(it&&it.weapon&&!it.equipped){it.equipped=true;n++;} });
  c.wpnEquipInit=1;
  return n;
}
/* A row the page finds by id (Edit, Delete, a tick) needs one, and only one:
   a number becomes text, a missing or repeated id gets a fresh uid(). Pass the
   same `seen` to keep ids unique across several lists. Safe to run again. */
function repairIds(list,seen){
  const s=seen||new Set();
  list.forEach(x=>{
    if(typeof x.id==="number")x.id=String(x.id);
    if(typeof x.id!=="string"||!x.id||s.has(x.id))x.id=uid();
    s.add(x.id);
  });
  return list;
}
/* ---- #103: the Sheet makeover's one-time work. Every step is idempotent: a
   sheet already migrated has nothing left for it to find. ---- */
/* A removed section's note joins the one that took its place, under a heading
   naming where it came from; the earlier start and the later edit are kept.
   A note stored as a plain string (no at/editedAt) merges its text too; any
   other junk under the key (an array, a number, ...) has no text to keep, so
   it is just dropped — either way the removed key always goes. */
function mergeNoteInto(c,from,into,heading){
  const m=c.secNotes;if(!m||typeof m!=="object")return;
  if(!(from in m))return;
  const f=m[from];
  let t="",at,ed;
  if(f&&typeof f==="object"&&!Array.isArray(f)){t=String(f.text||"").trim();at=f.at;ed=f.editedAt;}
  else if(typeof f==="string")t=f.trim();
  if(t){
    const to=(m[into]&&typeof m[into]==="object"&&!Array.isArray(m[into]))?m[into]:null;
    const prev=to?String(to.text||"").trim():"";
    const block="**"+heading+":**\n"+t;
    const nums=[to&&to.at,at].filter(x=>typeof x==="number");
    const eds=[to&&to.editedAt,ed].filter(x=>typeof x==="number");
    m[into]=Object.assign({},to||{},{text:prev?prev+"\n\n"+block:block});
    if(nums.length)m[into].at=Math.min(...nums);
    if(eds.length)m[into].editedAt=Math.max(...eds);
  }
  delete m[from];
}
/* "Languages: …" lines in Proficiencies become the player's own chips. */
function liftLanguages(c){
  const p=typeof c.proficiencies==="string"?c.proficiencies:"";
  if(!/^\s*languages\s*:/im.test(p))return;
  const found=[],keep=[];
  p.split("\n").forEach(line=>{const mm=/^\s*languages\s*:(.*)$/i.exec(line);if(mm)found.push(...langParse(mm[1]));else keep.push(line);});
  c.proficiencies=keep.join("\n").replace(/\n{3,}/g,"\n\n").trim();
  const have=chipClean(c.languages,"languages",true),names=new Set(have.map(x=>x.name.toLowerCase()));
  found.forEach(n=>{if(!names.has(n.toLowerCase())){have.push({id:uid(),name:n,src:""});names.add(n.toLowerCase());}});
  c.languages=have;
}
function migrateSheet103(c){
  CHIP_KEYS.forEach(k=>{c[k]=chipClean(c[k],k,true);});
  c.advancement=advancementOf(c);
  mergeNoteInto(c,"class","portrait","Class");
  mergeNoteInto(c,"origin","portrait","Ancestry & Background");
  mergeNoteInto(c,"rest","vitals","Rest & Recovery");
  if(Array.isArray(c.combatSections)){
    /* rest's hit dice went to the rail; the header (portrait) is not
       combat-addable, and its portrait now rides in with Vitals */
    const out=[];c.combatSections.forEach(k=>{const v=k==="rest"||k==="portrait"?"vitals":k;if(!out.includes(v))out.push(v);});
    c.combatSections=out;
  }
  /* liftLanguages runs once, same pattern as ammoInit: never defaulted in
     blankChar(), so an old sheet's undefined flag lifts once on its first
     migration, after which a player's own "Languages:" line in Proficiencies
     stays theirs to type. */
  if(c.langLifted!==true){liftLanguages(c);c.langLifted=true;}
  ensureDefaultLanguages(c);
}
function migrate(s){
  s=s||{};
  const base=blankChar(), blank=blankChar();
  // Carry over every field the file has, so newly-added fields are never silently dropped.
  Object.keys(s).forEach(k=>{ if(s[k]!==undefined) base[k]=s[k]; });
  // Identity & system guard.
  base.id=s.id||base.id||uid();
  base.system=(s.system==="dnd"||s.system==="humblewood")?s.system:blank.system;
  /* Preserve the stamp, NEVER advance it. migrate() runs on every load, so
     stamping APP_VERSION here would erase the very mismatch the update tool
     exists to find. Only applying or dismissing an update may advance it. */
  base.appVersion=(typeof s.appVersion==="string")?s.appVersion:"";
  // Normalize structured objects onto full defaults so missing sub-keys are filled in.
  ["hp","death","abilities","saves","skills","slots"].forEach(k=>{ base[k]=Object.assign({},blank[k],(s[k]&&typeof s[k]==="object"&&!Array.isArray(s[k]))?s[k]:{}); });
  // Coins: map legacy keys onto a full coin object.
  base.coins=Object.assign({},blank.coins);
  if(s.coins&&typeof s.coins==="object"){const map={cp:"cp",sp:"sp",ep:"ep",gp:"gp",pp:"pp",km:"cp",sm:"sp",em:"ep",gm:"gp",pm:"pp"};Object.keys(s.coins).forEach(k=>{if(map[k]&&s.coins[k]!==undefined&&s.coins[k]!=="")base.coins[map[k]]=s.coins[k];});}
  // Guarantee list fields are arrays and map fields are plain objects.
  /* Every list holds entry objects, and only objects are kept (#71). `null` is
     what JSON writes for a hole or an undefined; a bare string or number has no
     field an entry is made of, so nothing any screen could show is lost. Kept,
     either one stopped the render: the first read of a field on null throws,
     and in strict mode so does the first write to a string (renderSpells()
     normalises `level`, detectSpellAttack() sets `atkType`). */
  ["features","inventory","statuses","familiars","spells","attacks","activeSpells","glossary","classes","grants","resources","journal","trackers"].forEach(k=>{ base[k]=Array.isArray(base[k])?base[k].filter(x=>x!==null&&typeof x==="object"):[]; });
  /* The player's own glossary entries are theirs, so none is dropped for its
     shape (#71). Each gets what makes it reachable: the other categories' field
     names read as the glossary's (glossRepair), and an id, without which the
     Rules tab's Edit and Delete cannot find it. One with no term is kept and
     listed there as "(no term)"; glossTerm() skips it for matching. */
  base.glossary.forEach(g=>{ if(!g||typeof g!=="object"||Array.isArray(g))return; glossRepair(g);
    if(typeof g.id==="number")g.id=String(g.id); else if(typeof g.id!=="string"||!g.id)g.id=uid(); });
  /* A page is found by its id. The list guard above lets an ARRAY through (it
     is an object), and JSON would drop an id set on one, so each load would
     give it a new id and migrate() would stop being idempotent. Arrays go. */
  base.journal=repairIds(base.journal.filter(x=>!Array.isArray(x)));
  base.trackers=repairIds(base.trackers.filter(x=>!Array.isArray(x)));
  /* AFTER both repairs: checklists and tasks become journal pages (#95). The
     new pages take fresh uid()s, which cannot collide with a repaired one. */
  migrateTrackerPages(base,Date.now());
  ["featCollapse","invCollapse","atkCollapse","grantGold","hdUsed","secNotes","noteCollapse","editHide","journalCollapse","trackerCollapse","trackerTotals","ammoSpent","ammoFight"].forEach(k=>{ if(!base[k]||typeof base[k]!=="object"||Array.isArray(base[k]))base[k]=blank[k]; });
  if(base.race!==null&&(typeof base.race!=="object"||Array.isArray(base.race)))base.race=null;
  if(base.bg!==null&&(typeof base.bg!=="object"||Array.isArray(base.bg)))base.bg=null;
  /* AFTER the list guards above, so it can rely on inventory being an array. */
  migrateWeaponEquip(base);
  /* AFTER the list guards, for the same reason: bundles unpack, pieces and
     launchers learn their ammunition kind, once per character (#6). */
  migrateAmmo(base);
  /* #103: showFamiliars is decided from the FILE, so a stored choice wins and a
     sheet from before gets the icon only if it has a familiar. */
  base.showFamiliars=typeof s.showFamiliars==="boolean"?s.showFamiliars:base.familiars.length>0;
  base.hiddenTabs=cleanHiddenTabs(s.hiddenTabs);   /* #52 */
  base.featsAllowed=typeof s.featsAllowed==="boolean"?s.featsAllowed:true;   /* #118 */
  /* #118: well-formed level records only; the rest are dropped */
  base.levelLog=(Array.isArray(s.levelLog)?s.levelLog:[]).filter(r=>r&&typeof r==="object"&&!Array.isArray(r)&&typeof r.class==="string"&&num(r.level)>0&&Array.isArray(r.features));
  /* #91: the party and the fight; out of a fight there is none */
  base.party=cleanParty(s.party);
  base.combatants=cleanCombatants(s.combatants,base.combatActive===true);
  base.initMode=s.initMode==="rounds"?"rounds":"turns";
  /* a marker only in Turns mode, and never on a dead row (final review m1) */
  base.combatTurn=base.initMode!=="turns"?"":base.combatants.some(r=>r.id===s.combatTurn&&!combatantDead(r))?String(s.combatTurn):initFirstAlive(base.combatants);
  base.initShowRolls=s.initShowRolls!==false;
  /* #47: the inventory log */
  base.invLogSize=INV_LOG_SIZES.indexOf(num(s.invLogSize))>=0?num(s.invLogSize):500;
  base.invLog=cleanInvLog(s.invLog,base.invLogSize);
  migrateSheet103(base);
  return base;
}
function exportChar(){
  const blob=new Blob([JSON.stringify(character,null,2)],{type:"application/json"});
  const name=(character.name||"character").replace(/[^a-z0-9\-_ ]/gi,"").trim()||"character";
  dl(blob,`humblewood-${name}.json`);
}
function dl(blob,fname){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),800);}
function printStrip(s){return String(s||"").replace(/\{@\w+\s+([^|}]+)[^}]*\}/g,"$1");}
function printSheet(){
  recompute();
  const c=contributions(), pb=pbValue(c);
  const g=id=>{const e=document.getElementById(id);return e?e.textContent.trim():"";};
  const classLine=(character.classes||[]).map(x=>`${esc(x.name)} ${num(x.level)}${x.subclass?` (${esc(x.subclass)})`:""}`).join(" / ")||"—";
  const raceName=esc((character.race&&character.race.name)||character.ancestry||"—");
  const bgName=esc((character.bg&&character.bg.name)||character.background||"—");
  const align=esc(character.alignment||""), lvl=g("levelDisp")||String(character.level||1);
  const abils=ABIL.map(([k,lbl])=>{const sc=abilFinal(k,c),md=modOf(sc);return `<div class="p-abil"><div class="p-ab-l">${lbl}</div><div class="p-ab-s">${sc}</div><div class="p-ab-m">${fmt(md)}</div></div>`;}).join("");
  const hp=`${num(character.hp.cur)} / ${effMaxHP()}${num(character.hp.temp)?` (+${num(character.hp.temp)} temp)`:""}`;
  const hdp=hitDicePool(), hd=hdp.length?hdString(hdp):(character.hitdice||"—");
  const vit=[["AC",g("acDisp")],["Initiative",g("initDisp")],["Speed",g("speedDisp")],["Size",charSize()],["Prof. Bonus",fmt(pb)],["Passive Perc.",g("passDisp")],["HP",hp],["Hit Dice",hd]].map(([l,v])=>`<span class="p-stat">${l}: <b>${esc(v)||"—"}</b></span>`).join("");
  const saves=ABIL.map(([k,lbl])=>`<span class="p-line">${effSaveProf(k)>0?"●":"○"} ${lbl} <span class="p-mark">${esc(g("save-"+k))}</span></span>`).join("");
  const skills=SKILLS.map(([k,lbl,ab])=>{const l=effSkill(k),mk=l>=2?"◆":(l>=1?"●":"○");return `<span class="p-line">${mk} ${lbl} (${ab.toUpperCase()}) <span class="p-mark">${esc(g("skill-"+k))}</span></span>`;}).join("");
  const atkRows=(character.attacks||[]).map(a=>{const n=attackNumbers(a);const save=a.save;const dmg=printStrip(attackDamageStr(a,save?0:n.dmgBonus));const typ=save?"Spell save":(a.source==="spell"?("Spell "+(n.kind==="ranged"?"Ranged":"Melee")):(n.kind==="ranged"?"Ranged":"Melee"));const hit=save?("DC "+(spellDC()!=null?spellDC():"—")+" "+String(save.ability||"").toUpperCase()):fmt(n.toHit);return `<tr><td>${esc(a.name||"Attack")}</td><td>${esc(typ)}</td><td>${esc(hit)}</td><td>${esc(dmg)||"—"}</td><td>${esc(printStrip(a.notes||""))}</td></tr>`;}).join("");
  const attacks=atkRows?`<table class="p-t"><tr><th>Attack</th><th>Type</th><th>To Hit</th><th>Damage</th><th>Notes</th></tr>${atkRows}</table>`:"";
  const res=(character.resources||[]).map(r=>`<span class="p-stat">${esc(r.name)}${r.die?" ("+esc(r.die)+")":""}: <b>${num(r.cur)}/${num(r.max)}</b></span>`).join("");
  /* a timed condition prints with its time left (#55) */
  const stat=(character.statuses||[]).map(s=>{const n=esc(s.name||s.term||"");
    return n&&s.active!==false&&statusTimed(s)?`${n} (${esc(statusTimeText(s))})`:n;}).filter(Boolean).join(", ");
  const feats=(character.features||[]).filter(f=>f.enabled!==false).map(f=>`<div class="p-item"><b>${esc(f.name)}</b>${f.source?`<span class="p-src">${esc(f.source)}</span>`:""}${f.uses&&usesMax(f)?` <span class="p-stat">(${usesMax(f)}/${esc(f.uses.per||"long")})</span>`:""}${f.description?`<div>${esc(printStrip(f.description))}</div>`:""}</div>`).join("");
  const byLv={};(character.spells||[]).forEach(s=>{(byLv[num(s.level)]=byLv[num(s.level)]||[]).push(s);});
  const spellBlocks=Object.keys(byLv).map(Number).sort((a,b)=>a-b).map(L=>{
    const items=byLv[L].sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(s=>`<span class="p-line">${s.prepared?"◆":"○"} ${esc(s.name)}${s.granted?` (${esc(s.granted)})`:""}</span>`).join("");
    return `<div class="p-item"><b>${L===0?"Cantrips":"Level "+L}</b><div class="p-grid">${items}</div></div>`;
  }).join("");
  const slotSummary=[];for(let i=1;i<=9;i++){const s=character.slots[i];if(s&&num(s.total))slotSummary.push(`L${i}: ${num(s.total)-num(s.used)}/${num(s.total)}`);}
  const inv=(character.inventory||[]).map(it=>`<div class="p-item"><b>${esc(it.name)}</b>${itemQty(it)!==1?` ×${itemQty(it)}`:""}${it.equipped?" (equipped)":""}${it.description?`<div>${esc(printStrip(it.description)).replace(/\n/g,"<br>")}</div>`:""}</div>`).join("");
  const coins=["pp","gp","ep","sp","cp"].map(k=>num(character.coins[k])?`${num(character.coins[k])} ${k.toUpperCase()}`:"").filter(Boolean).join(" · ");
  const bio=BIO.map(([k,lbl])=>character[k]?`<div class="p-item"><b>${lbl}</b><div>${esc(printStrip(character[k])).replace(/\n/g,"<br>")}</div></div>`:"").join("");
  /* Defences, Senses and Languages (#103): one line per list, each only when
     non-empty, escaped like the vitals/resources lines beside it. */
  const chipLine=(label,key,withRange)=>{
    const l=chipList(character,key);if(!l.length)return"";
    const names=l.map(x=>esc(x.name.toUpperCase())+(withRange&&x.range!==""?` (${esc(String(x.range))} ft)`:"")).join(", ");
    return `<span class="p-stat">${label}: <b>${names}</b></span>`;
  };
  const defLines=[chipLine("Resistances","resists"),chipLine("Immunities","immunes"),chipLine("Senses","senses",true),chipLine("Languages","languages")].filter(Boolean).join(" ");
  /* Section notes print as PLAIN TEXT — the markdown markers stay visible rather
     than being rendered. Print escapes everything (see the bio line above); it
     is not the place to start emitting markup from user input. */
  const secn=NOTE_SECTIONS.filter(s=>hasNote(s.k)).map(s=>`<div class="p-item"><b>${esc(noteTitle(s))}</b><div>${esc(printStrip(noteText(s.k))).replace(/\n/g,"<br>")}</div></div>`).join("");
  const html=`
    <div class="p-h1">${esc(character.name||"Unnamed Character")}</div>
    <div class="p-sub">${classLine} · Level ${esc(lvl)} · ${raceName} · ${bgName}${align?` · ${align}`:""}</div>
    <div class="p-abils">${abils}</div>
    <div class="p-box" style="margin-top:6px">${vit}</div>
    ${(res||stat)?`<div class="p-box">${res}${stat?` <span class="p-stat">Statuses: <b>${stat}</b></span>`:""}</div>`:""}
    ${defLines?`<div class="p-box">${defLines}</div>`:""}
    <div class="p-sec">Saving Throws</div><div class="p-grid">${saves}</div>
    <div class="p-sec">Skills</div><div class="p-grid">${skills}</div>
    ${attacks?`<div class="p-sec">Attacks &amp; Weapons</div>${attacks}`:""}
    ${(spellBlocks||slotSummary.length)?`<div class="p-sec">Spells${slotSummary.length?` — Slots: ${slotSummary.join(" · ")}`:""}</div>${spellBlocks}`:""}
    ${feats?`<div class="p-sec">Features &amp; Traits</div><div class="p-two">${feats}</div>`:""}
    ${(inv||coins)?`<div class="p-sec">Inventory${coins?` — ${coins}`:""}</div><div class="p-two">${inv}</div>`:""}
    ${bio?`<div class="p-sec">Character</div>${bio}`:""}
    ${secn?`<div class="p-sec">Section notes</div>${secn}`:""}
  `;
  document.getElementById("printArea").innerHTML=html;
  window.print();
}
/* false, with nothing touched, when the player won't leave a character whose
   changes couldn't be saved (leaveCharacterOk()); the file is still there to
   import again. */
function finishImport(ch){
  if(!leaveCharacterOk())return false;
  luAbandon();   /* #101: a level-up belongs to the sheet it started on */
  character=ch;activeId=ch.id;
  /* Stored first, and listed only once it is (#81): an index entry for a blob
     that never landed is a home-screen card that opens nothing. */
  let why="";try{localStorage.setItem(charKey(ch.id),JSON.stringify(ch));}catch(e){why=storageWhy(e);}
  if(!why)why=libTouch();
  settings.skin=skinForSystem(ch.system);saveSettings();applyTheme();renderAll();hideHome();
  showSaveResult(why);
  /* last, so it stacks after the Replace/Copy clash modal rather than under it */
  maybePromptUpdate();
  return true;
}
function importChar(file){
  const r=new FileReader();
  r.onload=()=>{
    let p;try{p=JSON.parse(r.result);if(!p||!p.abilities)throw 0;}catch(e){alert("That doesn't look like a Fieldbook character file.");return;}
    const ch=migrate(p);
    let clash=false;try{clash=libLoad().index.some(x=>x.id===ch.id)||!!localStorage.getItem(charKey(ch.id));}catch(e){}
    if(!clash){ if(!ch.id)ch.id=uid(); finishImport(ch); return; }
    const nm=ch.name||"this character";
    openModal("Import character",`
      <p>You already have a saved character with this file's ID${ch.name?` — <b>${esc(ch.name)}</b>`:""}.</p>
      <p class="hint"><b>Replace</b> overwrites your saved copy (any changes you've made to it since this file was exported are lost). <b>Import as copy</b> keeps both, adding a separate character.</p>
      <div class="m-actions" style="flex-wrap:wrap;gap:8px">
        <button class="tbtn" id="impCancel">Cancel</button>
        <button class="tbtn" id="impCopy">Import as copy</button>
        <button class="tbtn primary" id="impReplace">Replace ${esc(nm)}</button>
      </div>`);
    document.getElementById("impCancel").addEventListener("click",closeModal);
    document.getElementById("impReplace").addEventListener("click",()=>{closeModal();finishImport(ch);});
    document.getElementById("impCopy").addEventListener("click",()=>{closeModal();ch.id=uid();if(ch.name)ch.name=ch.name+" (copy)";finishImport(ch);});
  };
  r.readAsText(file);
}

