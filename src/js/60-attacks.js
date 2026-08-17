/* ============ Attacks ============ */
function attackNumbers(a){
  const c=contributions(), pb=pbValue(c);
  let abil=0, abilName="";
  if(a.ability==="finesse"){const s=Math.floor((abilFinal("str",c)-10)/2), dx=Math.floor((abilFinal("dex",c)-10)/2);abil=Math.max(s,dx);abilName=dx>=s?"DEX":"STR";}
  else if(a.ability&&a.ability!=="none"){abil=Math.floor((abilFinal(a.ability,c)-10)/2);abilName=a.ability.toUpperCase();}
  const kind=a.kind==="ranged"?"ranged":"melee";
  const atkFx=sumFx("attack",c)+sumFx("attack."+kind,c);
  const dmgFx=sumFx("damage",c)+sumFx("damage."+kind,c);
  const toHit=abil+(a.proficient?pb:0)+num(a.atkMisc)+atkFx;
  const dmgBonus=(a.addAbilityDamage?abil:0)+num(a.dmgMisc)+dmgFx;
  return {toHit,dmgBonus,atkFx,dmgFx,abilName,kind,pb,abil};
}
/* ---- damage lines ----
   An attack's damage is one main die expression plus any number of ADDITIONAL
   damage types (`a.extraDamage`, an optional array of {dice,type}) — a sword
   that deals 1d8 slashing and 1d6 poison. The field is optional: an attack
   saved before it existed has no `extraDamage` and formats exactly as before.
   Only the MAIN part takes the computed bonus (ability modifier, manual extra,
   damage effects); an extra type is its own die roll and gets none of it.
   Pure — the sheet, the breakdown modal and the print sheet all read these. */
function extraDamageList(a){
  const l=(a&&Array.isArray(a.extraDamage))?a.extraDamage:[];
  return l.map(d=>({dice:String((d&&d.dice)||"").trim(),type:String((d&&d.type)||"").trim()}))
          .filter(d=>d.dice||d.type);
}
function damagePartStr(dice,type,bonus){
  return (String(dice||"")+(bonus?` ${fmt(bonus)}`:"")+(type?` ${String(type)}`:"")).trim();
}
function attackDamageStr(a,bonus){
  if(!a)return "";
  return [damagePartStr(a.damageDice,a.damageType,bonus)]
    .concat(extraDamageList(a).map(d=>damagePartStr(d.dice,d.type,0)))
    .filter(Boolean).join(" + ");
}
/* ---- what an attack is LINKED to ----
   The attack form rebuilds its record from the boxes, so any field the form does
   not ask about is dropped unless it is carried across — the same trap the item
   and feature editors already guard against, and every one of these is invisible
   when it goes:
     itemId   the inventory item this attack came from. Lose it and the next
              rules-pack update finds no attack for the item, calls
              addAttackForItem() and the player gets a DUPLICATE row.
     spellId  the same link for a spell, and what the Cast button reads.
     source   "spell", which is what makes the row show Cast instead of Edit.
     save     the {ability} block that makes a spell-save row print its DC
              rather than a to-hit number.
   Pure, so the round trip is assertable without a DOM. */
const ATTACK_LINK_FIELDS=["itemId","spellId","source","save"];
function carryAttackLinks(prev,rec){
  if(prev&&rec)ATTACK_LINK_FIELDS.forEach(k=>{if(prev[k]!==undefined&&prev[k]!==null)rec[k]=prev[k];});
  return rec;
}
/* ---- spell casting, attacks, and active spells ---- */
function spellDC(){const c=contributions();const sa=character.spellAbility;if(!sa)return null;return 8+pbValue(c)+Math.floor((abilFinal(sa,c)-10)/2);}
function spellAtkBonus(){const c=contributions();const sa=character.spellAbility;if(!sa)return null;return pbValue(c)+Math.floor((abilFinal(sa,c)-10)/2);}
function parseDurationSec(str){
  if(!str)return null;const s=String(str).toLowerCase();let m;
  if(/instant/.test(s))return 0;
  if((m=s.match(/(\d+)\s*round/)))return num(m[1])*6;
  if((m=s.match(/(\d+)\s*hour/)))return num(m[1])*3600;
  if((m=s.match(/(\d+)\s*min/)))return num(m[1])*60;
  if((m=s.match(/(\d+)\s*day/)))return num(m[1])*86400;
  if((m=s.match(/(\d+)\s*sec/)))return num(m[1]);
  return null;
}
function metaDuration(meta){if(!meta)return "";return (String(meta).split("·").map(x=>x.trim()).find(x=>/(round|minute|hour|day|instant|second|concentration)/i.test(x)))||"";}
function spellIsConc(s){if(s.conc!=null)return !!s.conc;return /concentration/i.test((s.meta||"")+" "+(s.duration||""));}
function spellDurationStr(s){return s.duration||metaDuration(s.meta)||"";}
function spellDurationSec(s){return parseDurationSec(spellDurationStr(s));}
function freeSlots(L){const s=character.slots[L];return s?Math.max(0,num(s.total)-num(s.used)):0;}
function pickSlotLevel(lvl){if(lvl<=0)return {level:0,upcast:false};if(freeSlots(lvl)>0)return {level:lvl,upcast:false};for(let L=lvl+1;L<=9;L++)if(freeSlots(L)>0)return {level:L,upcast:true};return null;}
function fmtElapsed(sec){sec=num(sec);const r=Math.round(sec/6);if(sec<60)return `${r} rd (${sec}s)`;if(sec<3600){const m=Math.floor(sec/60),s=sec%60;return `${m}m${s?` ${s}s`:""}`;}const h=Math.floor(sec/3600);return `${h}h ${Math.floor((sec%3600)/60)}m`;}
/* keep spell-attack entries in sync with a spell's attack fields */
const _ABIL_NAME={strength:"str",dexterity:"dex",constitution:"con",intelligence:"int",wisdom:"wis",charisma:"cha"};
/* infer attack/save + damage from a library spell's text when not explicitly set */
function detectSpellAttack(sp){
  if(sp.atkType!==undefined)return;
  const txt=(sp.text||"")+" "+(sp.meta||"");
  let m=txt.match(/make a (ranged|melee) spell attack/i);
  if(m){sp.atkType="attack";sp.atkKind=m[1].toLowerCase();}
  else{const s=txt.match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i);sp.atkType=s?"save":"";if(s)sp.saveAbility=_ABIL_NAME[s[1].toLowerCase()];}
  if(sp.atkType){const d=txt.match(/(\d+d\d+)\s+(\w+)\s+damage/i);if(d){if(!sp.dice)sp.dice=d[1];if(!sp.damageType)sp.damageType=d[2].toLowerCase();}}
}
function ensureSpellAttacks(){(character.spells||[]).forEach(sp=>{if(sp.atkType===undefined){detectSpellAttack(sp);syncSpellAttack(sp);}});}
let _toastT=null;
function toast(msg){let el=document.getElementById("toast");if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.appendChild(el);}el.textContent=msg;el.classList.add("show");clearTimeout(_toastT);_toastT=setTimeout(()=>el.classList.remove("show"),1900);}
function syncSpellAttack(sp){
  character.attacks=(character.attacks||[]).filter(a=>a.spellId!==sp.id);
  if(sp.atkType==="attack"){
    character.attacks.push({id:uid(),spellId:sp.id,source:"spell",name:sp.name,kind:(sp.atkKind==="melee"?"melee":"ranged"),ability:character.spellAbility||"none",proficient:true,addAbilityDamage:false,atkMisc:"",damageDice:sp.dice||"",damageType:sp.damageType||"",dmgMisc:"",notes:sp.atkNote||""});
  }else if(sp.atkType==="save"){
    character.attacks.push({id:uid(),spellId:sp.id,source:"spell",name:sp.name,save:{ability:sp.saveAbility||"dex"},damageDice:sp.dice||"",damageType:sp.damageType||"",notes:sp.atkNote||""});
  }
}
function promptSpellAttack(sp,atLevel){
  let body="";
  if(sp.atkType==="attack"){const b=spellAtkBonus();body=`<p><b>Spell attack:</b> ${b!=null?fmt(b):"—"} to hit (${sp.atkKind==="melee"?"melee":"ranged"})</p>`;}
  else if(sp.atkType==="save"){const dc=spellDC();body=`<p><b>Save DC:</b> ${dc!=null?dc:"—"} ${esc((sp.saveAbility||"").toUpperCase())}</p>`;}
  if(sp.dice)body+=`<p><b>Damage:</b> ${esc(sp.dice)}${sp.damageType?` ${esc(sp.damageType)}`:""}</p>`;
  body+=`<p class="hint">Cast at level ${atLevel||sp.level}. Roll the dice at your table.</p><div class="m-actions"><button class="tbtn primary" id="okAtk">OK</button></div>`;
  openModal("Cast "+sp.name,body);const b=document.getElementById("okAtk");if(b)b.addEventListener("click",closeModal);
}
function castSpell(spellId){
  const sp=(character.spells||[]).find(x=>x.id===spellId);if(!sp)return;
  const lvl=num(sp.level), pick=pickSlotLevel(lvl);
  if(lvl>0&&!pick){alert(`No spell slots available for ${sp.name} (level ${lvl} or higher).`);return;}
  if(pick&&pick.upcast&&!confirm(`No level ${lvl} slots left. Cast ${sp.name} with a level ${pick.level} slot?`))return;
  const conc=spellIsConc(sp);
  if(conc){const cur=(character.activeSpells||[]).find(a=>a.conc);
    if(cur&&!confirm(`You're concentrating on ${cur.name}. End it and concentrate on ${sp.name} instead?`))return;
    if(cur)character.activeSpells=character.activeSpells.filter(a=>a.id!==cur.id);}
  if(pick&&pick.level>0){const S=character.slots[pick.level];S.used=Math.min(num(S.total),num(S.used)+1);}
  const durSec=spellDurationSec(sp), timed=conc||(durSec!=null&&durSec>0);
  if(timed){if(!character.activeSpells)character.activeSpells=[];character.activeSpells.push({id:uid(),spellId:sp.id,name:sp.name,level:(pick?pick.level:lvl),conc:conc,durationSec:(durSec!=null?durSec:null),elapsedSec:0,castAt:Date.now()});}
  renderSlotBubbles();renderActiveSpells();scheduleSave();
  toast(`Cast ${sp.name}`+((pick&&pick.level>0)?` · level ${pick.level} slot`:(lvl===0?" · cantrip":""))+(timed?" · active":""));
  if(sp.atkType==="attack"||sp.atkType==="save")promptSpellAttack(sp,pick?pick.level:lvl);
}
function endActiveSpell(id){character.activeSpells=(character.activeSpells||[]).filter(a=>a.id!==id);renderActiveSpells();scheduleSave();}
function bumpActive(a,deltaSec){a.elapsedSec=Math.max(0,num(a.elapsedSec)+deltaSec);maybeExpire(a);}
function maybeExpire(a){
  if(a.durationSec!=null&&a.durationSec>0&&a.elapsedSec>=a.durationSec&&!a.expiredPrompted){
    a.expiredPrompted=true;
    if(confirm(`${a.name} has reached its duration (${fmtElapsed(a.durationSec)}). End it?`))character.activeSpells=character.activeSpells.filter(x=>x.id!==a.id);
  }
  if(a.durationSec!=null&&a.elapsedSec<a.durationSec)a.expiredPrompted=false;
}
function advanceRound(dir){
  character.combatRound=Math.max(0,num(character.combatRound)+dir);
  (character.activeSpells||[]).slice().forEach(a=>bumpActive(a,dir*6));
  renderActiveSpells();scheduleSave();
}
function renderActiveSpells(){
  const card=document.getElementById("activeSpellCard"),el=document.getElementById("activeSpellList");
  if(!card||!el)return;
  const list=character.activeSpells||[];
  card.style.display=list.length?"":"none";
  const rn=document.getElementById("roundNum");if(rn)rn.textContent=num(character.combatRound);
  el.innerHTML=list.map(a=>{
    const exp=(a.durationSec!=null&&a.durationSec>0&&a.elapsedSec>=a.durationSec);
    const timeTxt=fmtElapsed(a.elapsedSec)+((a.durationSec!=null&&a.durationSec>0)?` / ${fmtElapsed(a.durationSec)}`:"");
    return `<div class="item${exp?" on-status":""}"><div class="top">
        <span class="nm">${esc(a.name)}</span>
        ${a.level?`<span class="qty">Lv ${a.level}</span>`:""}
        ${a.conc?`<span class="orig-b" title="Concentration">C</span>`:""}
        <span class="qty" title="Elapsed / duration">${esc(timeTxt)}</span>
        ${exp?`<span class="qty" style="color:var(--danger,#c0392b)">expired</span>`:""}
        <span style="flex:1"></span>
        <button class="icon danger" data-active-end="${a.id}" aria-label="End">✕</button>
      </div>
      <div class="use-row"><span class="use-lbl">Elapsed time</span>
        <button class="tbtn" data-active-tick="${a.id}" data-sec="-6" style="padding:3px 8px;min-height:auto">− rd</button>
        <button class="tbtn" data-active-tick="${a.id}" data-sec="6" style="padding:3px 8px;min-height:auto">+ rd</button>
        <button class="tbtn" data-active-sec="${a.id}" style="padding:3px 8px;min-height:auto">+ sec…</button>
      </div></div>`;
  }).join("");
}
function renderAttacks(){
  const el=document.getElementById("attackList");if(!el)return;
  if(!character.attacks.length){el.innerHTML=`<div class="empty">No attacks yet. Add a weapon or unarmed strike — to-hit and damage are computed from ability, proficiency, and any effects (e.g. the Archery feat adds to ranged attacks). Tap a to-hit to see the breakdown.</div>`;return;}
  el.innerHTML="";
  character.attacks.forEach(a=>{
    const ic=!!atkCol().items[a.id], isSpell=a.source==="spell", save=a.save;
    const n=attackNumbers(a);
    const dmg=attackDamageStr(a,save?0:n.dmgBonus);
    const typeLabel=save?"Spell save":(isSpell?`Spell · ${n.kind==="ranged"?"Ranged":"Melee"}`:(n.kind==="ranged"?"Ranged":"Melee"));
    const dc=spellDC();
    const hitCell=save?`<span class="atk-hit">DC ${dc!=null?dc:"—"} ${esc((save.ability||"").toUpperCase())}</span>`
                       :`<span class="atk-hit ${n.atkFx?"fx-on":""}" data-atk-info="${a.id}">${fmt(n.toHit)} to hit</span>`;
    const d=document.createElement("div");d.className="item fitem";
    d.innerHTML=`<div class="top">
        <button class="fitoggle" data-atkitem="${a.id}" aria-label="Collapse"><svg class="fcaret ${ic?"c":""}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
        <span class="nm">${esc(a.name||"Attack")}</span>
        <span class="qty">${typeLabel}</span>
        ${hitCell}
        ${isSpell?`<button class="tbtn" data-cast-spell="${a.spellId}" style="padding:3px 8px;min-height:auto">Cast</button>`:`<button class="icon" data-edit-attack="${a.id}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>`}
        <button class="icon danger" data-del-attack="${a.id}" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
      </div>
      ${ic?"":`<div class="desc" style="font-family:var(--head);font-size:13px;letter-spacing:.02em;color:var(--ink-soft)">Damage <b class="${!save&&n.dmgFx?"fx-on":""}" style="${!save&&n.dmgFx?"":"color:var(--ink)"}">${esc(dmg)||"—"}</b>${a.notes?` · ${esc(a.notes)}`:""}</div>`}`;
    el.appendChild(d);
  });
}
/* one editable {dice,type} row in the attack form's "Additional damage types" list */
function attackXDmgRowHTML(d){
  return `<div class="xdmg-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input class="xdDice" value="${esc((d&&d.dice)||"")}" placeholder="1d6" style="flex:0 0 34%" aria-label="Extra damage dice">
      <input class="xdType" value="${esc((d&&d.type)||"")}" placeholder="poison" style="flex:1" aria-label="Extra damage type">
      <button type="button" class="icon danger xdDel" aria-label="Remove damage type"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
    </div>`;
}
function readAttackXDmg(){
  const wrap=document.getElementById("aXDmg");if(!wrap)return [];
  return Array.prototype.map.call(wrap.querySelectorAll(".xdmg-row"),r=>({
    dice:(r.querySelector(".xdDice").value||"").trim(),
    type:(r.querySelector(".xdType").value||"").trim()
  })).filter(d=>d.dice||d.type);
}
function openAttackForm(existing){
  const a=existing||{id:uid(),name:"",kind:"melee",ability:"str",proficient:true,atkMisc:"",damageDice:"",addAbilityDamage:true,dmgMisc:"",damageType:"",notes:""};
  const abilOpts=[["str","Strength"],["dex","Dexterity"],["con","Constitution"],["int","Intelligence"],["wis","Wisdom"],["cha","Charisma"],["finesse","Finesse (best of STR/DEX)"],["none","None"]];
  openModal(existing?"Edit attack":"New attack",`
    <div class="g2"><div class="field"><label class="f">Name</label><input id="aName" value="${esc(a.name)}" placeholder="Shortbow"></div>
      <div class="field"><label class="f">Type</label><select id="aKind"><option value="melee"${a.kind!=="ranged"?" selected":""}>Melee</option><option value="ranged"${a.kind==="ranged"?" selected":""}>Ranged</option></select></div></div>
    <div class="g2"><div class="field"><label class="f">Ability</label><select id="aAbil">${abilOpts.map(([v,l])=>`<option value="${v}"${a.ability===v?" selected":""}>${l}</option>`).join("")}</select></div>
      <div class="field"><label class="f">Extra to-hit</label><input id="aAtkMisc" type="number" value="${esc(a.atkMisc)}" placeholder="0"></div></div>
    <label class="opt" id="aProf"><input type="checkbox" ${a.proficient?"checked":""}>Proficient (add proficiency bonus)</label>
    <div class="g2"><div class="field"><label class="f">Damage dice</label><input id="aDice" value="${esc(a.damageDice)}" placeholder="1d8"></div>
      <div class="field"><label class="f">Damage type</label><input id="aType" value="${esc(a.damageType)}" placeholder="piercing"></div></div>
    <div class="field"><label class="f">Additional damage types</label>
      <div id="aXDmg">${extraDamageList(a).map(attackXDmgRowHTML).join("")}</div>
      <button type="button" class="tbtn" id="aXAdd" style="padding:4px 10px;min-height:auto">+ Add damage type</button>
      <p class="hint" style="margin:6px 0 0">A second die rolled with this attack — 1d6 poison on a sword. Extras roll on their own; the ability modifier and any bonuses below stay on the main damage.</p></div>
    <div class="field"><label class="f">Extra damage</label><input id="aDmgMisc" type="number" value="${esc(a.dmgMisc)}" placeholder="0"></div>
    <label class="opt" id="aAddAbil"><input type="checkbox" ${a.addAbilityDamage?"checked":""}>Add ability modifier to damage</label>
    <div class="field"><label class="f">Notes</label><input id="aNotes" value="${esc(a.notes||"")}" placeholder="Range 80/320, versatile…"></div>
    <div class="m-actions"><button class="tbtn" id="aCancel">Cancel</button><button class="tbtn primary" id="aSave">${existing?"Save":"Add"}</button></div>`);
  document.getElementById("aCancel").addEventListener("click",closeModal);
  const xw=document.getElementById("aXDmg"),xa=document.getElementById("aXAdd");
  if(xa)xa.addEventListener("click",()=>{xw.insertAdjacentHTML("beforeend",attackXDmgRowHTML({}));});
  if(xw)xw.addEventListener("click",ev=>{const b=ev.target.closest(".xdDel");if(b&&b.parentNode)b.parentNode.remove();});
  document.getElementById("aSave").addEventListener("click",()=>{
    const rec={id:a.id,name:document.getElementById("aName").value.trim()||"Attack",kind:document.getElementById("aKind").value,ability:document.getElementById("aAbil").value,proficient:document.querySelector("#aProf input").checked,atkMisc:document.getElementById("aAtkMisc").value,damageDice:document.getElementById("aDice").value.trim(),damageType:document.getElementById("aType").value.trim(),dmgMisc:document.getElementById("aDmgMisc").value,addAbilityDamage:document.querySelector("#aAddAbil input").checked,notes:document.getElementById("aNotes").value.trim()};
    /* omitted when empty, so an attack that has no extras carries no field —
       the shape an older save already has, and what migrate round-trips */
    const xd=readAttackXDmg();if(xd.length)rec.extraDamage=xd;
    carryAttackLinks(a,rec);
    const i=character.attacks.findIndex(x=>x.id===a.id);if(i>=0)character.attacks[i]=rec;else character.attacks.push(rec);
    closeModal();renderAttacks();scheduleSave();
  });
}
function openAttackBreakdown(id){
  const a=character.attacks.find(x=>x.id===id);if(!a)return;
  const c=contributions(),pb=pbValue(c),n=attackNumbers(a);
  const row=(l,v)=>`<div style="display:flex;justify-content:space-between;border-top:1px dotted var(--hair);padding:5px 0"><span>${esc(l)}</span><b>${fmt(v)}</b></div>`;
  let b=`<p style="margin-bottom:4px;font-family:var(--head);text-transform:uppercase;letter-spacing:.05em;font-size:12px;color:var(--ink-soft)">${n.kind==="ranged"?"Ranged":"Melee"} attack</p>`;
  b+=row((n.abilName||"No ability")+" modifier",n.abil);
  if(a.proficient)b+=row("Proficiency bonus",pb);
  if(num(a.atkMisc))b+=row("Extra to-hit (manual)",num(a.atkMisc));
  c.filter(x=>x.target==="attack"||x.target==="attack."+n.kind).forEach(x=>b+=row(x.source,x.value));
  b+=`<div style="display:flex;justify-content:space-between;border-top:2px solid var(--line);margin-top:6px;padding-top:6px"><b>To hit</b><b>${fmt(n.toHit)}</b></div>`;
  b+=`<p style="margin:12px 0 4px"><b>Damage:</b> ${esc(attackDamageStr(a,n.dmgBonus)||"—")}</p>`;
  const dc=c.filter(x=>x.target==="damage"||x.target==="damage."+n.kind);
  if(a.addAbilityDamage&&n.abilName)b+=row(n.abilName+" modifier",n.abil);
  if(num(a.dmgMisc))b+=row("Extra damage (manual)",num(a.dmgMisc));
  dc.forEach(x=>b+=row(x.source,x.value));
  /* extras are their own dice and take none of the bonuses above — say so */
  const xd=extraDamageList(a);
  if(xd.length)b+=`<p class="hint" style="margin:8px 0 0">Rolled separately, with no modifiers: ${esc(xd.map(d=>damagePartStr(d.dice,d.type,0)).join(", "))}</p>`;
  openModal(a.name||"Attack",b);
}
function renderSpells(){
  const el=document.getElementById("spellList");el.innerHTML="";
  if(!character.spells.length){el.innerHTML=`<div class="empty">No spells yet. Add cantrips and spells; tap a name to read it. Keywords in the text stay tappable.</div>`;return;}
  const byLv={};character.spells.forEach(s=>{(byLv[s.level=num(s.level)]=byLv[s.level]||[]).push(s)});
  Object.keys(byLv).map(Number).sort((a,b)=>a-b).forEach(lv=>{
    const items=byLv[lv];
    /* Shared with the spell browser's heading, so the number you see while
       picking is the number you get. */
    const {added,granted,allot}=spellLevelTally(lv);
    const over=allot>0&&added>allot;
    const countTxt=(allot>0?`${added}/${allot}`:`${added}`)+(granted?` <span class="gr">+${granted}</span>`:"");
    const h=document.createElement("div");h.className="spell-h";
    /* "Prep" sits first, over the tick column, because the box itself carried no
       visible meaning — only an aria-label, which a player on a phone never
       sees. It is a marker you keep yourself: nothing in the app reads it, and
       casting deliberately does not check it. */
    h.innerHTML=`<span class="prep-cap" title="The box on each row marks a spell you have prepared">Prep</span><span>${lv===0?"Cantrips":"Level "+lv}</span><span class="spell-count ${over?"over":""}" title="${allot>0?"Added / available":"Added"}${granted?" · +granted (feat/background), not counted":""}">${countTxt}</span>`;
    el.appendChild(h);
    items.sort((a,b)=>(a.name||"").localeCompare(b.name||"")).forEach(s=>{
      const r=document.createElement("div");r.className="spell";
      r.innerHTML=`<button class="pin ${s.prepared?"on":""}" data-prep="${s.id}" aria-label="Prepared" aria-pressed="${s.prepared?"true":"false"}" title="${s.prepared?"Prepared — tap to unprepare":"Not prepared — tap to prepare"}"></button>
        <span class="nm" data-view-spell="${s.id}">${esc(s.name||"Spell")}</span>
        ${(s.origin||s.granted)?originBadge(spellOrigin(s),"data-orig-spell",s.id):""}
        ${s.meta?`<span class="meta">${esc(s.meta)}</span>`:""}
        <button class="tbtn" data-cast-spell="${s.id}" style="padding:3px 8px;min-height:auto">Cast</button>
        <button class="icon" data-edit-spell="${s.id}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon danger" data-del-spell="${s.id}" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>`;
      el.appendChild(r);
    });
  });
}
function renderGloss(){
  const el=document.getElementById("glossList");el.innerHTML="";
  const si=document.getElementById("glossSearch");
  const q=(si?si.value:"").trim().toLowerCase();
  const match=t=>!q||String(t).toLowerCase().includes(q);
  const CAP=150;
  const allrk=rules.keywords||[];
  const anyRules=RULE_CATS.some(c=>(rules[c]||[]).length);
  if(!anyRules){
    el.insertAdjacentHTML("beforeend",`<div class="empty" style="line-height:1.7">No rules pack loaded yet. <button class="linkbtn" id="glossImport">Import rules files</button> to add conditions, spells, feats, backgrounds, and more — or manage sources in Settings.</div>`);
  }
  const rk=allrk.filter(g=>match(g.term));
  if(allrk.length){
    const h=document.createElement("div");h.className="spell-h";
    /* NO esc() here: textContent assigns a literal string, so escaping first
       double-encodes — a pack called "D&D 2024" rendered as "D&amp;D 2024".
       textContent is already safe; esc() belongs with innerHTML, not this. */
    h.textContent=`From rules pack${rules.name?" · "+rules.name:""} (${rk.length})`;el.appendChild(h);
    if(!rk.length)el.insertAdjacentHTML("beforeend",`<div class="empty">No matches.</div>`);
    rk.slice(0,CAP).forEach(g=>{
      const d=document.createElement("div");d.className="item";
      d.innerHTML=`<div class="top"><span class="nm">${esc(dispName(g,"keywords"))}</span><span class="chip">${g.type==="image"?"Image":"Text"}</span>
        <button class="icon" data-view-gloss-rk="${esc(g._id||g.term)}" aria-label="Preview"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button></div>`;
      el.appendChild(d);
    });
    if(rk.length>CAP)el.insertAdjacentHTML("beforeend",`<div class="empty">…and ${rk.length-CAP} more — type to filter.</div>`);
  }
  const mine=character.glossary.filter(g=>match(g.term)).sort((a,b)=>a.term.localeCompare(b.term));
  const h2=document.createElement("div");h2.className="spell-h";h2.textContent=`Your entries (${mine.length})`;el.appendChild(h2);
  if(!character.glossary.length){el.insertAdjacentHTML("beforeend",`<div class="empty">None yet — add campaign-specific terms or house rules here.</div>`);return;}
  if(!mine.length){el.insertAdjacentHTML("beforeend",`<div class="empty">No matches.</div>`);return;}
  mine.forEach(g=>{
    const d=document.createElement("div");d.className="item";
    d.innerHTML=`<div class="top"><span class="nm">${esc(g.term)}</span><span class="chip">${g.type==="image"?"Image":"Text"}</span>
      <button class="icon" data-view-gloss="${g.id}" aria-label="Preview"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
      <button class="icon" data-edit-gloss="${g.id}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
      <button class="icon danger" data-del-gloss="${g.id}" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button></div>`;
    el.appendChild(d);
  });
}

