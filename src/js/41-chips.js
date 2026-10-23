/* ================= chips: defences, senses, languages (#103) =================
   Simple named items the player keeps in a list — resistances, immunities,
   senses (with a range), languages (with a source when a grant or the ruleset
   added them). Read only through chipList(): a list in a saved sheet may hold
   anything someone typed. Also here: the two ruleset-specific helpers #103
   adds, the advancement table and the default languages. */
const CHIP_KEYS=["resists","immunes","senses","languages"];
/* `mint`: migrate() gives an entry with no id one; a read never invents one,
   so reading is pure. */
function chipClean(list,key,mint){
  const out=[],seen=new Set();
  (Array.isArray(list)?list:[]).forEach(x=>{
    if(!x||typeof x!=="object"||Array.isArray(x)||typeof x.name!=="string")return;
    const name=x.name.trim();if(!name)return;
    const k=name.toLowerCase();if(seen.has(k))return;seen.add(k);
    const e={id:(typeof x.id==="string"&&x.id)?x.id:(mint?uid():""),name};
    if(key==="senses"){const r=typeof x.range==="number"?x.range:(typeof x.range==="string"&&/^\s*\d+\s*$/.test(x.range)?parseInt(x.range,10):NaN);e.range=(isFinite(r)&&r>0)?Math.round(r):"";}
    if(key==="languages")e.src=typeof x.src==="string"?x.src:"";
    out.push(e);
  });
  return out;
}
function chipList(c,key){return chipClean(c&&c[key],key,false);}
function advancementOf(c){return c&&c.advancement==="milestone"?"milestone":"xp";}

/* ---- the ruleset-specific helpers ----
   A pack label is matched to a ruleset with systemOf(), the same rule species
   use. Several labels of one ruleset: the first by name, so the result does not
   depend on load order. */
function rulesetDecl(map,c){
  if(!map||typeof map!=="object"||!c)return undefined;
  const hit=Object.keys(map).sort().find(l=>systemOf({_source:l})===c.system);
  return hit===undefined?undefined:map[hit];
}
function advValid(t){
  if(!Array.isArray(t)||!t.length)return false;
  for(let i=0;i<t.length;i++){const r=t[i];
    if(!Array.isArray(r)||r.length!==2||!Number.isInteger(r[0])||!Number.isInteger(r[1]))return false;
    if(i===0&&(r[0]!==0||r[1]!==1))return false;
    if(i>0&&(r[0]<=t[i-1][0]||r[1]!==t[i-1][1]+1))return false;}
  return true;
}
function advancementFor(c){const t=rulesetDecl(rules.advancement,c);return advValid(t)?t:SRD_ADVANCEMENT;}
function xpNumber(v){
  if(typeof v==="number")return (Number.isInteger(v)&&v>=0)?v:null;
  if(typeof v!=="string")return null;
  const s=v.trim().replace(/,/g,"");
  return /^\d+$/.test(s)?parseInt(s,10):null;
}
/* {xp, level (the sheet's total level), next (XP for level+1, or null), ready} */
function xpProgress(c){
  const xp=xpNumber(c&&c.xp);if(xp===null)return null;
  const level=(Array.isArray(c.classes)?c.classes:[]).reduce((a,x)=>a+num(x&&x.level),0)||num(c.level)||1;
  const t=advancementFor(c),row=t.find(r=>r[1]===level+1);
  const next=row?row[0]:null;
  return {xp,level,next,ready:next!==null&&xp>=next};
}
function defaultLanguagesFor(c){
  const d=rulesetDecl(rules.defaultLanguages,c);
  const list=Array.isArray(d)?d.filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim()):[];
  return list.length?list:["Common"];
}
/* Idempotent: adds each default the character lacks (case-blind), stamped
   "system". A language the player already has keeps its own source. */
function ensureDefaultLanguages(c){
  if(!c)return;
  const have=chipClean(c.languages,"languages",true);
  const names=new Set(have.map(x=>x.name.toLowerCase()));
  defaultLanguagesFor(c).forEach(n=>{if(!names.has(n.toLowerCase())){have.push({id:uid(),name:n,src:"system"});names.add(n.toLowerCase());}});
  c.languages=have;
}
/* A pack's `languages` text → names. "Common, Elvish and one other language of
   your choice": the choice is the player's to add, so it is skipped. */
function langParse(str){
  if(typeof str!=="string")return [];
  return str.split(/,|\band\b|;/i).map(s=>s.trim()).filter(s=>s&&!/\b(choice|any|other|one|two|three)\b/i.test(s));
}
/* Grants (#103): a species or background stamps its languages with the grant's
   source id ("race:Elf", "bg:Sage" — the same ids its other grants use), so
   removing it takes exactly those back. A language already present stays as
   it is: the player's own, or an earlier grant's. */
function grantLanguages(c,src,str){
  const have=chipClean(c.languages,"languages",true),names=new Set(have.map(x=>x.name.toLowerCase()));
  langParse(str).forEach(n=>{if(!names.has(n.toLowerCase())){have.push({id:uid(),name:n,src});names.add(n.toLowerCase());}});
  c.languages=have;
}
function dropLanguages(c,src){c.languages=chipClean(c.languages,"languages",true).filter(x=>x.src!==src);}

/* ---- the component ---- */
const CHIP_SUGGEST={
  resists:["Acid","Bludgeoning","Cold","Fire","Force","Lightning","Necrotic","Piercing","Poison","Psychic","Radiant","Slashing","Thunder"],
  immunes:["Acid","Bludgeoning","Cold","Fire","Force","Lightning","Necrotic","Piercing","Poison","Psychic","Radiant","Slashing","Thunder",
    "Blinded","Charmed","Deafened","Exhaustion","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious"],
  senses:["Blindsight","Darkvision","Tremorsense","Truesight"]
};
const CHIP_SRC={system:"rules",race:"species",bg:"background"};
function chipSrcLabel(src){const k=String(src||"").split(":")[0];return CHIP_SRC[k]||"";}
function chipsHTML(c,key){
  const list=chipList(c,key);
  const chips=list.map(x=>{
    const src=key==="languages"?chipSrcLabel(x.src):"";
    const range=key==="senses"&&x.range!==""?` · ${esc(String(x.range))} ft`:"";
    const del=src?"":`<button type="button" class="chip-x ed" data-chipdel="${esc(key)}" data-chipid="${esc(x.id)}" aria-label="${esc("Remove "+x.name)}">×</button>`;
    return `<span class="chip chip-${esc(key)}">${esc(x.name.toUpperCase())}${range}${src?`<span class="chip-src"> · ${esc(src)}</span>`:""}${del}</span>`;
  }).join("");
  return `<div class="chips">${chips||`<span class="chip-none">None</span>`}<button type="button" class="chip chip-add" data-chipadd="${esc(key)}">+ Add</button></div>`;
}
function chipChooserHTML(c,key){
  const have=new Set(chipList(c,key).map(x=>x.name.toLowerCase()));
  const sug=key==="languages"?chipPackLanguages():(CHIP_SUGGEST[key]||[]);
  const pills=sug.map(n=>{const on=have.has(n.toLowerCase());return `<button type="button" class="fpill${on?" on":""}" data-chippick="${esc(n)}"${on?" disabled":""}>${esc(n)}${on?" ✓":""}</button>`;}).join("");
  return (pills?`<div class="fgrp chip-sug">${pills}</div>`:"")+
    `<div class="field"><label class="f" for="chipName">Or type one</label><input id="chipName" autocomplete="off"></div>`+
    (key==="senses"?`<div class="field"><label class="f" for="chipRange">Range (feet)</label><input id="chipRange" inputmode="numeric" placeholder="60"></div>`:"")+
    `<div class="rowbtns"><button type="button" class="tbtn primary" id="chipOk">Add</button><button type="button" class="tbtn" id="chipCancel">Cancel</button></div>`;
}
/* the languages the loaded packs name, for the chooser's pills */
function chipPackLanguages(){
  const out=new Set();
  ["races","backgrounds"].forEach(k=>(Array.isArray(rules[k])?rules[k]:[]).forEach(e=>{if(e&&typeof e.languages==="string")langParse(e.languages).forEach(n=>out.add(n));}));
  Object.keys(rules.defaultLanguages||{}).forEach(l=>(rules.defaultLanguages[l]||[]).forEach(n=>typeof n==="string"&&out.add(n)));
  return [...out].sort((a,b)=>a.localeCompare(b));
}
function addChip(c,key,name,range){
  const n=String(name==null?"":name).trim();if(!n)return false;
  const list=chipClean(c[key],key,true);
  if(list.some(x=>x.name.toLowerCase()===n.toLowerCase()))return false;
  const e={id:uid(),name:n};
  if(key==="senses"){const r=parseInt(String(range==null?"":range).trim(),10);e.range=(isFinite(r)&&r>0)?r:"";}
  if(key==="languages")e.src="";
  list.push(e);c[key]=list;return true;
}
/* a granted language is the grant's to take back, not the player's */
function removeChip(c,key,id){c[key]=chipClean(c[key],key,true).filter(x=>!(x.id===id&&!(key==="languages"&&x.src)));}
const CHIP_TITLE={resists:"Add a resistance",immunes:"Add an immunity",senses:"Add a sense",languages:"Add a language"};
function openChipChooser(key){
  openModal(CHIP_TITLE[key]||"Add",chipChooserHTML(character,key));
  const done=(name)=>{const rng=document.getElementById("chipRange");if(addChip(character,key,name,rng?rng.value:"")){closeModal();renderChipsAll();scheduleSave();}};
  document.querySelectorAll("[data-chippick]").forEach(b=>b.addEventListener("click",()=>done(b.dataset.chippick)));
  const ok=document.getElementById("chipOk");if(ok)ok.addEventListener("click",()=>{const i=document.getElementById("chipName");done(i?i.value:"");});
  const cn=document.getElementById("chipCancel");if(cn)cn.addEventListener("click",closeModal);
}
function renderDefences(){
  const r=document.getElementById("defResists"),i=document.getElementById("defImmunes");
  if(r)r.innerHTML=chipsHTML(character,"resists");
  if(i)i.innerHTML=chipsHTML(character,"immunes");
}
function renderBioChips(){
  const l=document.getElementById("bioLanguages"),s=document.getElementById("bioSenses");
  if(l)l.innerHTML=chipsHTML(character,"languages");
  if(s)s.innerHTML=chipsHTML(character,"senses");
}
function renderChipsAll(){renderDefences();renderBioChips();}
