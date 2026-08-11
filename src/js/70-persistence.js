/* ================= persistence ================= */
const K_CHAR="hw-fb-char", K_SET="hw-fb-settings", K_RULES="hw-fb-rules", K_LIB="hw-fb-library";
let saveTimer=null, lsOK=true, activeId=null;
function charKey(id){return "hw-fb-c-"+id;}
function libLoad(){try{const s=localStorage.getItem(K_LIB);if(s)return JSON.parse(s);}catch(e){}return {autoload:null,index:[]};}
function libSave(lib){try{localStorage.setItem(K_LIB,JSON.stringify(lib));}catch(e){}}
function libTouch(){ // update the active character's index entry (name/system/version/updated)
  if(!activeId)return;
  const lib=libLoad();
  /* appVersion rides on the index so the home cards can badge it without
     reading (and parsing) every character blob */
  const meta={id:activeId,name:character.name||"Unnamed",system:character.system||"humblewood",appVersion:character.appVersion||"",updated:Date.now()};
  const i=lib.index.findIndex(x=>x.id===activeId);
  if(i>=0)lib.index[i]=meta;else lib.index.push(meta);
  libSave(lib);
}
/* Why localStorage said no, in words a player can act on. The browser's own
   message ("QuotaExceededError") tells them nothing about what to do. */
function storageWhy(e){
  const n=(e&&e.name)||"", m=(e&&e.message)||"";
  if(/quota|exceed/i.test(n+" "+m))return "your browser's storage is full";
  if(/security|denied/i.test(n+" "+m))return "your browser is blocking storage for this page";
  return "your browser refused to save"+(n?" ("+n+")":"");
}
/* Save a snapshot of a character as a separate library entry, WITHOUT switching
   to it (that's the difference from finishImport).

   Returns {id, copy} on success, or {error, copy} if it could not be stored —
   `copy` is the snapshot either way, so a caller that can't use storage can
   still offer it as a download rather than dead-ending.

   The index write is verified rather than assumed: libSave() swallows its own
   quota error, so without the read-back a backup could sit in storage while
   being invisible on the home screen — and we would have told the player to go
   and look for it there. */
function backupCharacter(ch,tag){
  let copy;
  try{
    copy=JSON.parse(JSON.stringify(ch));
    copy.id=uid();
    copy.name=(ch.name||"Character")+" (backup"+(tag?" "+tag:"")+")";
    copy.isBackup=true;
  }catch(e){return {error:"this character couldn't be copied"};}
  try{
    localStorage.setItem(charKey(copy.id),JSON.stringify(copy));
  }catch(e){return {error:storageWhy(e),copy};}
  const lib=libLoad();
  lib.index.push({id:copy.id,name:copy.name,system:copy.system||"humblewood",appVersion:copy.appVersion||"",updated:Date.now()});
  libSave(lib);
  if(!libLoad().index.some(x=>x.id===copy.id)){
    try{localStorage.removeItem(charKey(copy.id));}catch(e){}   // don't orphan it
    return {error:"your browser's storage is full",copy};
  }
  return {id:copy.id,copy};
}
function scheduleSave(){
  const el=document.getElementById("savestate");if(el){el.textContent="Saving…";el.className="savestate";}
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
    try{
      if(activeId)localStorage.setItem(charKey(activeId),JSON.stringify(character));
      libTouch();
      if(el){el.textContent="Autosaved";el.className="savestate on";}
    }catch(e){lsOK=false;if(el){el.textContent="Use Save ↑";el.className="savestate";}}
  },500);
}
function saveSettings(){try{localStorage.setItem(K_SET,JSON.stringify(settings))}catch(e){}}
function saveRulesCache(){try{localStorage.setItem(K_RULES,JSON.stringify(rules))}catch(e){}}
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
  ["features","inventory","statuses","familiars","spells","attacks","activeSpells","glossary","classes","grants","resources"].forEach(k=>{ if(!Array.isArray(base[k]))base[k]=[]; });
  ["featCollapse","invCollapse","atkCollapse","grantGold","hdUsed","secNotes","noteCollapse"].forEach(k=>{ if(!base[k]||typeof base[k]!=="object"||Array.isArray(base[k]))base[k]=blank[k]; });
  if(base.race!==null&&(typeof base.race!=="object"||Array.isArray(base.race)))base.race=null;
  if(base.bg!==null&&(typeof base.bg!=="object"||Array.isArray(base.bg)))base.bg=null;
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
  const atkRows=(character.attacks||[]).map(a=>{const n=attackNumbers(a);const save=a.save;const dmg=printStrip(((a.damageDice||"")+((!save&&n.dmgBonus)?` ${fmt(n.dmgBonus)}`:"")+(a.damageType?` ${a.damageType}`:"")).trim());const typ=save?"Spell save":(a.source==="spell"?("Spell "+(n.kind==="ranged"?"Ranged":"Melee")):(n.kind==="ranged"?"Ranged":"Melee"));const hit=save?("DC "+(spellDC()!=null?spellDC():"—")+" "+String(save.ability||"").toUpperCase()):fmt(n.toHit);return `<tr><td>${esc(a.name||"Attack")}</td><td>${esc(typ)}</td><td>${esc(hit)}</td><td>${esc(dmg)||"—"}</td><td>${esc(printStrip(a.notes||""))}</td></tr>`;}).join("");
  const attacks=atkRows?`<table class="p-t"><tr><th>Attack</th><th>Type</th><th>To Hit</th><th>Damage</th><th>Notes</th></tr>${atkRows}</table>`:"";
  const res=(character.resources||[]).map(r=>`<span class="p-stat">${esc(r.name)}: <b>${num(r.cur)}/${num(r.max)}</b></span>`).join("");
  const stat=(character.statuses||[]).map(s=>esc(s.name||s.term||"")).filter(Boolean).join(", ");
  const feats=(character.features||[]).filter(f=>f.enabled!==false).map(f=>`<div class="p-item"><b>${esc(f.name)}</b>${f.source?`<span class="p-src">${esc(f.source)}</span>`:""}${f.uses&&usesMax(f)?` <span class="p-stat">(${usesMax(f)}/${esc(f.uses.per||"long")})</span>`:""}${f.description?`<div>${esc(printStrip(f.description))}</div>`:""}</div>`).join("");
  const byLv={};(character.spells||[]).forEach(s=>{(byLv[num(s.level)]=byLv[num(s.level)]||[]).push(s);});
  const spellBlocks=Object.keys(byLv).map(Number).sort((a,b)=>a-b).map(L=>{
    const items=byLv[L].sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(s=>`<span class="p-line">${s.prepared?"◆":"○"} ${esc(s.name)}${s.granted?` (${esc(s.granted)})`:""}</span>`).join("");
    return `<div class="p-item"><b>${L===0?"Cantrips":"Level "+L}</b><div class="p-grid">${items}</div></div>`;
  }).join("");
  const slotSummary=[];for(let i=1;i<=9;i++){const s=character.slots[i];if(s&&s.total)slotSummary.push(`L${i}: ${s.total-(s.used||0)}/${s.total}`);}
  const inv=(character.inventory||[]).map(it=>`<div class="p-item"><b>${esc(it.name)}</b>${num(it.qty)>1?` ×${num(it.qty)}`:""}${it.equipped?" (equipped)":""}${it.description?`<div>${esc(printStrip(it.description)).replace(/\n/g,"<br>")}</div>`:""}</div>`).join("");
  const coins=["pp","gp","ep","sp","cp"].map(k=>num(character.coins[k])?`${num(character.coins[k])} ${k.toUpperCase()}`:"").filter(Boolean).join(" · ");
  const bio=BIO.map(([k,lbl])=>character[k]?`<div class="p-item"><b>${lbl}</b><div>${esc(printStrip(character[k])).replace(/\n/g,"<br>")}</div></div>`:"").join("");
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
    <div class="p-sec">Saving Throws</div><div class="p-grid">${saves}</div>
    <div class="p-sec">Skills</div><div class="p-grid">${skills}</div>
    ${attacks?`<div class="p-sec">Attacks &amp; Weapons</div>${attacks}`:""}
    ${(spellBlocks||slotSummary.length)?`<div class="p-sec">Spells${slotSummary.length?` — Slots: ${slotSummary.join(" · ")}`:""}</div>${spellBlocks}`:""}
    ${feats?`<div class="p-sec">Features &amp; Traits</div><div class="p-two">${feats}</div>`:""}
    ${(inv||coins)?`<div class="p-sec">Inventory${coins?` — ${coins}`:""}</div><div class="p-two">${inv}</div>`:""}
    ${bio?`<div class="p-sec">Character</div>${bio}`:""}
    ${secn?`<div class="p-sec">Notes</div>${secn}`:""}
  `;
  document.getElementById("printArea").innerHTML=html;
  window.print();
}
function finishImport(ch){
  character=ch;activeId=ch.id;
  try{localStorage.setItem(charKey(ch.id),JSON.stringify(ch));}catch(e){}
  libTouch();settings.skin=skinForSystem(ch.system);saveSettings();applyTheme();renderAll();hideHome();
  /* last, so it stacks after the Replace/Copy clash modal rather than under it */
  maybePromptUpdate();
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

