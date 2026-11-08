/* ================= chips: defences, senses, languages, tools (#103, #121) =================
   Simple named items the player keeps in a list — resistances, immunities,
   senses (with a range), languages and tools (with a source when a grant or
   the ruleset added them). Read only through chipList(): a list in a saved
   sheet may hold anything someone typed. Also here: the two ruleset-specific
   helpers #103 adds, the advancement table and the default languages. */
const CHIP_KEYS=["resists","immunes","senses","languages","tools"];
/* the lists whose entries keep a source (`src`): a grant can stamp them */
const CHIP_SOURCED=["languages","tools"];
/* A language's source: "system" (the ruleset's default), "race:<Name>" or
   "bg:<Name>" (a grant's sid), or "" (the player's). Looked up as an OWN key:
   "constructor" or "__proto__:x" in a hand-edited file would otherwise find
   Object.prototype's members. Anything unknown is the player's (chipClean), so
   its chip has the × and removeChip() agrees to take it. */
const CHIP_SRC={system:"rules",race:"species",bg:"background"};
function chipSrcKey(src){const k=String(src||"").split(":")[0];return Object.prototype.hasOwnProperty.call(CHIP_SRC,k)?k:"";}
function chipSrcLabel(src){const k=chipSrcKey(src);return k?CHIP_SRC[k]:"";}
/* `mint`: migrate() gives an entry with no id one; a read never invents one,
   so reading is pure.
   A tool may be a PLACEHOLDER (#121): a choice not yet named, "Gaming Set",
   carrying the pack's wording in `ask` (a non-empty string, else it is an
   ordinary chip). Duplicates are dropped by name among named chips only, so
   "two Artisan's Tools of your choice" can hold two placeholders. */
function chipClean(list,key,mint){
  const out=[],seen=new Set(),sourced=CHIP_SOURCED.indexOf(key)>=0;
  (Array.isArray(list)?list:[]).forEach(x=>{
    if(!x||typeof x!=="object"||Array.isArray(x)||typeof x.name!=="string")return;
    const name=x.name.trim();if(!name)return;
    const ask=key==="tools"&&typeof x.ask==="string"&&x.ask.trim()?x.ask.trim():"";
    if(!ask){const k=name.toLowerCase();if(seen.has(k))return;seen.add(k);}
    const e={id:(typeof x.id==="string"&&x.id)?x.id:(mint?uid():""),name};
    if(key==="senses"){const r=typeof x.range==="number"?x.range:(typeof x.range==="string"&&/^\s*\d+\s*$/.test(x.range)?parseInt(x.range,10):NaN);e.range=(isFinite(r)&&r>0)?Math.round(r):"";}
    if(sourced)e.src=typeof x.src==="string"&&chipSrcKey(x.src)?x.src:"";
    if(ask)e.ask=ask;
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
/* {xp, level (the sheet's total level), cur (XP for that level, 0 past the
   table), next (XP for level+1, or null), ready} — the bar fills cur → next. */
function xpProgress(c){
  const xp=xpNumber(c&&c.xp);if(xp===null)return null;
  const level=(Array.isArray(c.classes)?c.classes:[]).reduce((a,x)=>a+num(x&&x.level),0)||num(c.level)||1;
  const t=advancementFor(c),row=t.find(r=>r[1]===level+1),here=t.find(r=>r[1]===level);
  const next=row?row[0]:null,cur=here?here[0]:0;
  return {xp,level,cur,next,ready:next!==null&&xp>=next};
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
/* What a source granted leaves with it: every chip in that list stamped with
   its sid, a tool's placeholders included. */
function dropChips(c,key,src){c[key]=chipClean(c[key],key,true).filter(x=>x.src!==src);}
function dropLanguages(c,src){dropChips(c,"languages",src);}

/* ---- tools (#121) ----
   The kinds a background's choice can name, and what fills each when the
   loaded packs don't: the SRD has only artisan's tools and instruments, and
   Humblewood no tools at all, so a gaming set would have no pick without these. */
const TOOL_KINDS=[
  ["Artisan's Tools",["Alchemist's Supplies","Brewer's Supplies","Calligrapher's Supplies","Carpenter's Tools","Cartographer's Tools","Cobbler's Tools","Cook's Utensils","Glassblower's Tools","Jeweler's Tools","Leatherworker's Tools","Mason's Tools","Painter's Supplies","Potter's Tools","Smith's Tools","Tinker's Tools","Weaver's Tools","Woodcarver's Tools"]],
  ["Gaming Set",["Dice Set","Dragonchess Set","Playing Cards","Three-Dragon Ante Set"]],
  ["Musical Instrument",["Bagpipes","Drum","Dulcimer","Flute","Horn","Lute","Lyre","Pan Flute","Shawm","Viol"]],
  ["Other",["Disguise Kit","Forgery Kit","Herbalism Kit","Navigator's Tools","Poisoner's Kit","Thieves' Tools"]]
];
const TOOL_KIND_HEAD={"Artisan's Tools":"Artisan's Tools","Gaming Set":"Gaming Sets","Musical Instrument":"Musical Instruments","Other":"Other"};
/* A pack's `tools` text → {fixed:[names], choices:[{kinds, count, ask, name}]}.
   Split as langParse() splits. A fragment naming a choice ("Choose one kind of
   Gaming Set", "one type of wind Musical Instrument") is a choice: the kinds it
   names, how many, its own wording (`ask`), and the placeholder's name — the
   kinds, or "Tool of your choice" when it names none (chipClean() drops a chip
   with no name). Anything else is a tool by name. */
function toolParse(str){
  const out={fixed:[],choices:[]};
  if(typeof str!=="string")return out;
  str.split(/,|\band\b|;/i).map(s=>s.trim()).filter(Boolean).forEach(s=>{
    if(!/\b(choose|choice|any|one|two|three|kind|type)\b/i.test(s)){out.fixed.push(s);return;}
    const kinds=[];
    if(/artisan['’]s tools/i.test(s))kinds.push("Artisan's Tools");
    if(/gaming set/i.test(s))kinds.push("Gaming Set");
    if(/instrument/i.test(s))kinds.push("Musical Instrument");
    const count=/\btwo\b/i.test(s)?2:(/\bthree\b/i.test(s)?3:1);
    out.choices.push({kinds,count,ask:s,name:kinds.length?kinds.join(" or "):"Tool of your choice"});
  });
  return out;
}
/* [[kind, names]] in TOOL_KINDS order: the loaded packs' Tool items filed by
   their type, then the built-in names they lack (case-blind, so the pack's
   spelling wins and nothing shows twice), each kind sorted. `kinds` limits it. */
function toolSuggestions(kinds){
  const want=Array.isArray(kinds)&&kinds.length?kinds:null;
  const by={};TOOL_KINDS.forEach(([k])=>{by[k]=[];});
  const kindOf=t=>{const s=String(t||"").trim().toLowerCase();
    return s==="artisan's tools"?"Artisan's Tools":(s==="instrument"||s==="musical instrument")?"Musical Instrument":s==="gaming set"?"Gaming Set":"Other";};
  const seen=new Set();
  (Array.isArray(rules.items)?rules.items:[]).forEach(i=>{
    if(!i||i.category!=="Tool"||typeof i.name!=="string")return;
    const n=i.name.trim(),l=n.toLowerCase();if(!n||seen.has(l))return;
    seen.add(l);by[kindOf(i.type)].push(n);
  });
  TOOL_KINDS.forEach(([k,names])=>names.forEach(n=>{const l=n.toLowerCase();if(!seen.has(l)){seen.add(l);by[k].push(n);}}));
  return TOOL_KINDS.map(([k])=>k).filter(k=>!want||want.indexOf(k)>=0).map(k=>[k,by[k].sort((a,b)=>a.localeCompare(b))]);
}
/* A background's tools (#121), stamped with its sid as its languages are. A
   named tool the sheet already has keeps its own source. Each choice adds its
   placeholders and, when it names a kind to pick from, queues a `tool` step
   for runExtraChoices() carrying their ids, so the pick names exactly them. */
function grantTools(c,src,str,pending){
  const p=toolParse(str);if(!p.fixed.length&&!p.choices.length)return;
  const have=chipClean(c.tools,"tools",true),names=new Set(have.filter(x=>!x.ask).map(x=>x.name.toLowerCase()));
  p.fixed.forEach(n=>{if(!names.has(n.toLowerCase())){have.push({id:uid(),name:n,src});names.add(n.toLowerCase());}});
  p.choices.forEach(ch=>{
    const ids=[];
    for(let i=0;i<ch.count;i++){const id=uid();ids.push(id);have.push({id,name:ch.name,src,ask:ch.ask});}
    if(ch.kinds.length&&Array.isArray(pending))pending.push({ch:{type:"tool",kinds:ch.kinds.slice(),choose:ch.count,label:ch.ask,chipIds:ids,_sid:src},sid:src,label:ch.ask});
  });
  c.tools=have;
}

/* ---- the component ---- */
const CHIP_SUGGEST={
  resists:["Acid","Bludgeoning","Cold","Fire","Force","Lightning","Necrotic","Piercing","Poison","Psychic","Radiant","Slashing","Thunder"],
  immunes:["Acid","Bludgeoning","Cold","Fire","Force","Lightning","Necrotic","Piercing","Poison","Psychic","Radiant","Slashing","Thunder",
    "Blinded","Charmed","Deafened","Exhaustion","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious"],
  senses:["Blindsight","Darkvision","Tremorsense","Truesight"]
};
function chipsHTML(c,key){
  const list=chipList(c,key),sourced=CHIP_SOURCED.indexOf(key)>=0;
  const chips=list.map(x=>{
    const src=sourced?chipSrcLabel(x.src):"";
    const range=key==="senses"&&x.range!==""?` · ${esc(String(x.range))} ft`:"";
    const del=src?"":`<button type="button" class="chip-x ed" data-chipdel="${esc(key)}" data-chipid="${esc(x.id)}" aria-label="${esc("Remove "+x.name)}">×</button>`;
    const srcH=src?`<span class="chip-src"> · ${esc(src)}</span>`:"";
    /* a placeholder (#121) is a button that names it — never hidden by the
       pencil, which hides removal, not play; its × sits beside it, since a
       button may not hold another */
    if(key==="tools"&&x.ask)return `<span class="chip chip-tools chip-ask"><button type="button" class="chip-name" data-chipask="${esc(x.id)}" title="${esc(x.ask)}" aria-label="${esc("Name this tool: "+x.ask)}">${esc(x.name.toUpperCase())} · choose</button>${srcH}${del}</span>`;
    return `<span class="chip chip-${esc(key)}">${esc(x.name.toUpperCase())}${range}${srcH}${del}</span>`;
  }).join("");
  return `<div class="chips">${chips||`<span class="chip-none">None</span>`}<button type="button" class="chip chip-add" data-chipadd="${esc(key)}">+ Add</button></div>`;
}
/* The lists whose Add window takes several at once (#119): a pill toggles,
   and Add takes every pressed one plus the typed name. Senses stay one at a
   time, since each carries its own range. */
const CHIP_MULTI=["resists","immunes","languages","tools"];
function chipAddLabel(n){return num(n)>1?"Add "+num(n):"Add";}
/* `opts.single` (the tool namer, #121): instant pills, of `opts.kinds` only
   (every kind when none), and a #chipMsg line for a refusal. Tools are grouped
   by kind under a heading each. A pill already on the sheet is disabled ✓; a
   placeholder isn't a tool yet, so it holds no pill. */
function chipChooserHTML(c,key,opts){
  const o=opts||{},single=!!o.single,multi=!single&&CHIP_MULTI.indexOf(key)>=0;
  const have=new Set(chipList(c,key).filter(x=>!x.ask).map(x=>x.name.toLowerCase()));
  const pill=n=>{const on=have.has(n.toLowerCase());
    return `<button type="button" class="fpill${on?" on":""}" data-chippick="${esc(n)}"${on?" disabled":(multi?` aria-pressed="false"`:"")}>${esc(n)}${on?" ✓":""}</button>`;};
  let sug="";
  if(key==="tools")sug=toolSuggestions(single?o.kinds:null).map(([k,names])=>`<div class="chip-sug-h">${esc(TOOL_KIND_HEAD[k]||k)}</div><div class="fgrp chip-sug">${names.map(pill).join("")}</div>`).join("");
  else{const pills=(key==="languages"?chipPackLanguages():(CHIP_SUGGEST[key]||[])).map(pill).join("");if(pills)sug=`<div class="fgrp chip-sug">${pills}</div>`;}
  return sug+
    `<div class="field chip-type"><label class="f" for="chipName">Or type one</label><input id="chipName" autocomplete="off"></div>`+
    (key==="senses"?`<div class="field"><label class="f" for="chipRange">Range (feet)</label><input id="chipRange" inputmode="numeric" placeholder="60"></div>`:"")+
    (single?`<p class="hint" id="chipMsg" role="status"></p>`:"")+
    `<div class="rowbtns"><button type="button" class="tbtn primary" id="chipOk">${chipAddLabel(0)}</button><button type="button" class="tbtn" id="chipCancel">Cancel</button></div>`;
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
  /* a placeholder isn't a tool yet: "Gaming Set" can still be typed beside one */
  if(list.some(x=>!x.ask&&x.name.toLowerCase()===n.toLowerCase()))return false;
  const e={id:uid(),name:n};
  if(key==="senses"){const r=parseInt(String(range==null?"":range).trim(),10);e.range=(isFinite(r)&&r>0)?r:"";}
  if(CHIP_SOURCED.indexOf(key)>=0)e.src="";
  list.push(e);c[key]=list;return true;
}
/* Several names at once (#119): blanks and case-blind duplicates skipped —
   of the sheet's named chips and within `names` — and the count added. */
function addChips(c,key,names){
  const list=chipClean(c[key],key,true),have=new Set(list.filter(x=>!x.ask).map(x=>x.name.toLowerCase()));let n=0;
  (Array.isArray(names)?names:[]).forEach(raw=>{
    const nm=String(raw==null?"":raw).trim();if(!nm||have.has(nm.toLowerCase()))return;
    const e={id:uid(),name:nm};if(CHIP_SOURCED.indexOf(key)>=0)e.src="";
    list.push(e);have.add(nm.toLowerCase());n++;
  });
  if(n)c[key]=list;
  return n;
}
/* a granted language or tool is the grant's to take back, not the player's */
function removeChip(c,key,id){c[key]=chipClean(c[key],key,true).filter(x=>!(x.id===id&&!(CHIP_SOURCED.indexOf(key)>=0&&x.src)));}
const CHIP_TITLE={resists:"Add resistances",immunes:"Add immunities",senses:"Add a sense",languages:"Add languages",tools:"Add tools"};
function openChipChooser(key){
  openModal(CHIP_TITLE[key]||"Add",chipChooserHTML(character,key));
  const ok=document.getElementById("chipOk"),inp=document.getElementById("chipName"),cn=document.getElementById("chipCancel");
  if(cn)cn.addEventListener("click",closeModal);
  const finish=()=>{closeModal();renderChipsAll();scheduleSave();};
  if(CHIP_MULTI.indexOf(key)<0){
    /* senses: a pill adds at once, with the Range box's value */
    const done=(name)=>{const rng=document.getElementById("chipRange");if(addChip(character,key,name,rng?rng.value:""))finish();};
    document.querySelectorAll("[data-chippick]").forEach(b=>b.addEventListener("click",()=>done(b.dataset.chippick)));
    if(ok)ok.addEventListener("click",()=>done(inp?inp.value:""));
    return;
  }
  /* #119: pills toggle; the button counts what Add will take */
  const picked=[];
  const typed=()=>String(inp?inp.value:"").trim();
  const relabel=()=>{if(ok)ok.textContent=chipAddLabel(picked.length+(typed()?1:0));};
  document.querySelectorAll("[data-chippick]").forEach(b=>b.addEventListener("click",()=>{
    if(b.disabled)return;
    const n=b.dataset.chippick,i=picked.indexOf(n);
    if(i>=0)picked.splice(i,1);else picked.push(n);
    b.classList.toggle("on",i<0);b.setAttribute("aria-pressed",i<0?"true":"false");relabel();
  }));
  if(inp)inp.addEventListener("input",relabel);
  if(ok)ok.addEventListener("click",()=>{
    const names=picked.slice();if(typed())names.push(typed());
    if(names.length&&addChips(character,key,names))finish();
  });
}
/* A tap on a placeholder tool (#121): the Add window in single-pick mode,
   offering the kinds its wording names, and Or type one. A name the sheet
   already has is refused in the window, which stays open. */
function openToolNamer(id){
  const ph=chipList(character,"tools").find(x=>x.id===id&&x.ask);if(!ph)return;
  const kinds=((toolParse(ph.ask).choices[0])||{}).kinds||[];
  openModal("Name this tool",`<p class="hint">${esc(ph.ask)}</p>`+chipChooserHTML(character,"tools",{single:true,kinds}));
  const ok=document.getElementById("chipOk"),inp=document.getElementById("chipName"),cn=document.getElementById("chipCancel"),msg=document.getElementById("chipMsg");
  const done=name=>{const why=nameToolChip(character,id,name);if(!why){closeModal();renderChipsAll();scheduleSave();}else if(msg)msg.textContent=why;};
  document.querySelectorAll("[data-chippick]").forEach(b=>b.addEventListener("click",()=>done(b.dataset.chippick)));
  if(ok)ok.addEventListener("click",()=>done(inp?inp.value:""));
  if(cn)cn.addEventListener("click",closeModal);
}
/* Name a placeholder tool (#121): the choices window's pick, or the namer's.
   "" when it took the name — its source stays, its `ask` goes — else why not.
   A name the sheet already has is refused, so a tool is never held twice. */
function nameToolChip(c,id,name){
  const n=String(name==null?"":name).trim();
  const list=chipClean(c.tools,"tools",true),ph=list.find(x=>x.id===id&&x.ask);
  if(!ph)return "No such tool chip.";
  if(!n)return "Pick a tool or type one.";
  const dup=list.find(x=>!x.ask&&x.name.toLowerCase()===n.toLowerCase());
  if(dup)return "You already have "+dup.name+".";
  ph.name=n;delete ph.ask;c.tools=list;return "";
}
function renderDefences(){
  const r=document.getElementById("defResists"),i=document.getElementById("defImmunes");
  if(r)r.innerHTML=chipsHTML(character,"resists");
  if(i)i.innerHTML=chipsHTML(character,"immunes");
}
function renderBioChips(){
  const l=document.getElementById("bioLanguages"),s=document.getElementById("bioSenses"),t=document.getElementById("bioTools");
  if(l)l.innerHTML=chipsHTML(character,"languages");
  if(s)s.innerHTML=chipsHTML(character,"senses");
  if(t)t.innerHTML=chipsHTML(character,"tools");
}
function renderChipsAll(){renderDefences();renderBioChips();}
