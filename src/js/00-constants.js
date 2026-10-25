"use strict";
/* ================= constants ================= */
const ABIL=[["str","STR"],["dex","DEX"],["con","CON"],["int","INT"],["wis","WIS"],["cha","CHA"]];
const SKILLS=[["acrobatics","Acrobatics","dex"],["animal","Animal Handling","wis"],["arcana","Arcana","int"],["athletics","Athletics","str"],["deception","Deception","cha"],["history","History","int"],["insight","Insight","wis"],["intimidation","Intimidation","cha"],["investigation","Investigation","int"],["medicine","Medicine","wis"],["nature","Nature","int"],["perception","Perception","wis"],["performance","Performance","cha"],["persuasion","Persuasion","cha"],["religion","Religion","int"],["sleight","Sleight of Hand","dex"],["stealth","Stealth","dex"],["survival","Survival","wis"]];
const BIO=[["appearance","Appearance"],["personality","Personality Traits"],["ideals","Ideals"],["bonds","Bonds"],["flaws","Flaws"],["backstory","Backstory"],["allies","Allies & Organisations"],["notes","Notes"]];

/* effect targets for the editor */
function fxTargets(){
  const g=[];
  g.push(["Armor Class","ac"],["Initiative","init"],["Speed","speed"],["Max HP","hp.max"],["Proficiency Bonus","profBonus"]);
  g.push(["To-hit (all attacks)","attack"],["To-hit (melee)","attack.melee"],["To-hit (ranged)","attack.ranged"]);
  g.push(["Damage (all attacks)","damage"],["Damage (melee)","damage.melee"],["Damage (ranged)","damage.ranged"]);
  /* the character's spell attack bonus and spell save DC, which spellAtkBonus()
     and spellDC() read: a Staff of Power, a Moon Sickle, a Wand of the War Mage */
  g.push(["Spell attack","spell.attack"],["Spell save DC","spell.dc"]);
  ABIL.forEach(([k,l])=>g.push([l+" score","ability."+k]));
  ABIL.forEach(([k,l])=>g.push([l+" save","save."+k]));
  /* every ability check (a Stone of Good Luck): recompute() adds it to each
     skill, to initiative (a Dexterity check) and to passive Perception, and the
     ability breakdown lists it for a plain check. Never the ability modifier,
     which attacks, saves, AC and spell DCs also read. */
  g.push(["Ability checks","check"]);
  SKILLS.forEach(([k,l])=>g.push([l+" skill","skill."+k]));
  return g;
}
const FX_LABEL={};fxTargets().forEach(([l,t])=>FX_LABEL[t]=l);

/* ================= state ================= */
function uid(){return Math.random().toString(36).slice(2,9)}
/* The combat view's starting sections, in sheet order. Lives HERE rather than in
   87-combat.js because blankChar() runs at load (`let character=blankChar()`
   below), long before a later fragment's const exists — ADR-001's TDZ rule. */
const COMBAT_DEFAULTS=["vitals","statuses","attacks","resources","slots","activespells"];
/* Names no group may have: a journal or tracker tag, a feature's source, an
   item's category (#98). Every name Object.prototype carries, compared
   lower-cased. The collapse maps are plain objects read by key, so a group
   called "constructor" or "toString" read an inherited function and started
   folded, and "__proto__" could never be folded at all. tagLabel() turns one
   into no group, and the group field says so. Lives here for the same TDZ
   reason as COMBAT_DEFAULTS. */
const GROUP_RESERVED=new Set(Object.getOwnPropertyNames(Object.prototype).map(s=>s.toLowerCase()));

/* appVersion is the app version this character was last RECONCILED against — not
   "last saved with". It stays "" here on purpose: this function is called at top
   level on the line below, before 30-version.js has run, so touching APP_VERSION
   from here would be a TDZ ReferenceError and the app would never boot.
   newCharacter() stamps the real version; "" means "never checked". */
/* The SRD's character advancement (XP → level), the fallback when the
   character's ruleset declares no `advancement` of its own (#103). A literal:
   blankChar() and this run at load, before `rules` exists. */
const SRD_ADVANCEMENT=[[0,1],[300,2],[900,3],[2700,4],[6500,5],[14000,6],[23000,7],[34000,8],[48000,9],[64000,10],
  [85000,11],[100000,12],[120000,13],[140000,14],[165000,15],[195000,16],[225000,17],[265000,18],[305000,19],[355000,20]];
function blankChar(){
  const c={id:uid(),appVersion:"",system:"humblewood",name:"",class:"",ancestry:"",background:"",alignment:"",xp:"",level:1,
    ac:"",init:"",speed:"",hitdice:"",hdManual:false,inspiration:false,
    /* `locked` guards the Max box, and lives INSIDE hp on purpose: migrate()
       normalizes hp onto blankChar's defaults, so every existing sheet gains it
       with no migration code, and one that deliberately saved false keeps it.
       Locked by default — Max is the one number that barely moves after
       character creation, and a stray digit in it drags Current down through
       clampHP() with no undo. The automatic writers in 56-class.js set the
       model directly and are deliberately not subject to it. */
    hp:{cur:"",max:"",temp:"",locked:true}, death:{succ:0,fail:0},
    coins:{cp:"",sp:"",ep:"",gp:"",pp:""},
    abilities:{},saves:{},skills:{},
    spellAbility:"", slots:{}, spells:[], attacks:[], race:null, bg:null, classes:[], grants:[],
    features:[], inventory:[], statuses:[], familiars:[], glossary:[],
    featCollapse:{groups:{},items:{}}, invCollapse:{items:{}}, atkCollapse:{items:{}}, hdUsed:{}, resources:[],
    /* The combat view (87-combat.js). combatActive is its own flag, NOT
       combatRound>0: the Active Spells card has always moved the round, so plenty
       of sheets carry a round with no fight behind it. */
    activeSpells:[], combatRound:0, combatActive:false, combatSections:COMBAT_DEFAULTS.slice(), grantGold:{},
    /* The initiative tracker (87-initiative.js, #91): the party roster, the
       fight's rows (cleared by combatEnd()), whose turn it is, and the two
       display settings. */
    party:[], combatants:[], combatTurn:"", initMode:"turns", initShowRolls:true,
    invLog:[], invLogSize:500,
    size:"", encumbrance:"none", coinWeight:true, hpColor:true, hdStyle:"full", statStyle:"classic",
    /* Notes pinned to a section of the sheet, keyed by NOTE_SECTIONS id.
       NOT `notes` — that name is taken by the Story tab's bio field (see BIO
       above), and this is a different thing entirely. */
    secNotes:{}, noteCollapse:{},
    /* #103: chips (41-chips.js), read only through chipList(); default
       languages are added at runtime (ensureDefaultLanguages), never here. */
    resists:[], immunes:[], senses:[], languages:[],
    advancement:"xp", showFamiliars:false, hiddenTabs:[],
    /* Cards whose edit/delete buttons the player has hidden (87-notes.js, #97):
       card key -> true. Read only through editHidden(). */
    editHide:{},
    /* The Journal tab's own pages (87-journal.js): [{id,title,tag,text,at,editedAt}],
       and which of its tag groups are shut, keyed by lower-cased tag. */
    journal:[], journalCollapse:{},
    /* The Journal tab's trackers (87-trackers.js), which of their tag groups are
       shut, and whether the card shows at all — read as !==false, so a sheet from
       before it shows it. `trackerTotals` maps a tag key to `true` where the
       group shows its total (#93). */
    trackers:[], trackerCollapse:{}, trackerTotals:{}, showTrackers:true,
    /* Ammunition fired since the last recovery (62-ammo.js): stack or thrown
       weapon id -> {n, hits, misses, kind, snap}. `ammoInit` is NOT defaulted:
       the one-time pass sets it. `ammoRecovery` is the character's rule for what
       comes back (#104): half, all, hits or none; half is the rules as written
       and what every sheet did before. */
    ammoSpent:{}, ammoRecovery:"half",
    proficiencies:"" };
  ABIL.forEach(([k])=>{c.abilities[k]=10;c.saves[k]=false});
  SKILLS.forEach(([k])=>c.skills[k]=0);
  for(let i=1;i<=9;i++)c.slots[i]={total:0,used:0};
  BIO.forEach(([k])=>c[k]="");
  return c;
}
let character=blankChar();
/* setPage: the Settings page last viewed (#107). setCollapse is the fold state
   of the sections that page replaced; it is no longer read, and stays only
   because old settings files carry it. */
let settings={skin:"humblewood",theme:"light",autoload:true,rough:true,rulesSources:[],setCollapse:{},tabIcons:false,backdropClose:false,setPage:"appearance"};
let rules={name:"",version:0,keywords:[],items:[],features:[],spells:[],races:[],classes:[],feats:[],tables:[]};

function seedGlossary(){return [];}

/* ================= helpers ================= */
function num(v){const n=parseInt(v,10);return isNaN(n)?0:n}
/* num() is parseInt, which is right for counts and scores but wrong for pounds
   and coin: an arrow weighs 0.05 lb and a candle costs 0.01 gp, and parseInt
   turns both into 0. Anything measured rather than counted uses fnum. */
function fnum(v){const n=parseFloat(v);return isNaN(n)?0:n}
/* creature sizes, smallest first — the order IS the comparison (a race offering
   a choice of sizes seeds the largest), and the multiplier is carrying capacity:
   halved below Small, doubled above Medium. */
const SIZES=["Tiny","Small","Medium","Large","Huge","Gargantuan"];
const SIZE_CARRY={Tiny:0.5,Small:1,Medium:1,Large:2,Huge:2,Gargantuan:2};
function modOf(score){return Math.floor((num(score)-10)/2)}
function fmt(n){return (n>=0?"+":"")+n}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
/* The only image source the app will load: a data: URL. Portraits and glossary
   images are written by FileReader.readAsDataURL, and a pack's keyword `image`
   is documented as a data URL (rules-schema §6.1), so nothing real is refused.
   Refused: javascript:, a relative path, and any web address — an image from the
   network is a request the player never made, and the rules fetch and the update
   check are meant to be the app's only network calls. Any media type passes,
   because FileReader labels an untyped file application/octet-stream and an <img>
   runs no script whatever it holds. This decides WHAT may load; esc() at the
   attribute still decides that it stays inside its quotes. */
function safeImgSrc(u){const s=typeof u==="string"?u.trim():"";return /^data:/i.test(s)?s:"";}
/* Every <img> the app builds from data comes from here, "" when refused. */
function imgHTML(u,alt){
  if(!safeImgSrc(u))return "";
  return `<img src="${esc(safeImgSrc(u))}"`+(alt==null?"":` alt="${esc(alt)}"`)+`>`;
}
function escReg(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
function get(o,p){return p.split(".").reduce((a,k)=>a&&a[k],o)}
function setP(o,p,v){const ks=p.split(".");const last=ks.pop();let t=o;ks.forEach(k=>t=t[k]);t[last]=v}
/* Glossary entries all come from files: a pack's keywords, a settings file
   (which restores `rules` wholesale, never through mergeRules), the player's
   own glossary in an imported character. So an entry can arrive with no term,
   a term that is not text, or not be an object at all. highlight() once read
   `x.term.toLowerCase()`, and one such entry threw on every render (#71).
   Every reader asks glossTerm() instead of touching `.term`; "" means "nothing
   to match on", and such an entry is never a chip or a condition. */
function glossTerm(g){return g&&typeof g==="object"&&typeof g.term==="string"?g.term.trim():"";}
/* The boundary repair, shared by mergeRules(), the pool's tidyRules() and
   migrate(). Every other category names an entry `name` and describes it in
   `description`, so a keyword written that way is plainly a term and its text:
   read them as such, keeping the originals. A numeric term becomes text. It
   fills only an absent or blank term and an absent text, never replaces one;
   changes the entry in place and returns it. */
function glossRepair(g){
  if(!g||typeof g!=="object"||Array.isArray(g))return g;
  const txt=v=>typeof v==="string"?v:(typeof v==="number"&&Number.isFinite(v)?String(v):"");
  if((g.term==null||(typeof g.term==="string"&&!g.term.trim()))&&txt(g.name).trim())g.term=txt(g.name);
  else if(typeof g.term==="number"&&Number.isFinite(g.term))g.term=String(g.term);
  if(g.text==null&&typeof g.description==="string")g.text=g.description;
  return g;
}
/* Pack keywords first, then the player's own. Objects only; an entry with no
   term is still returned (the Rules tab lists the player's so it can be fixed,
   and counts it), so a caller that matches on terms must go through glossTerm(). */
function allGlossary(){
  const obj=g=>g&&typeof g==="object"&&!Array.isArray(g);
  const rk=Array.isArray(rules.keywords)?rules.keywords:[], mine=Array.isArray(character.glossary)?character.glossary:[];
  return [...rk.filter(obj).map(k=>({...k,_locked:true})), ...mine.filter(obj)];
}

/* ================= fingerprints =================
   Value hashes used by the character/rules update tool (72-char-update.js) to
   tell "the pack changed" from "the player edited this". Kept here because they
   are generic; the field lists and the copy-shape projections live with the
   diff, which is what defines them. */
function fpNorm(v){
  if(v===null||v===undefined||v==="")return null;
  if(Array.isArray(v))return v.map(fpNorm);
  if(typeof v==="object"){
    const o={};Object.keys(v).sort().forEach(k=>{const n=fpNorm(v[k]);if(n!==null)o[k]=n;});
    return Object.keys(o).length?o:null;
  }
  if(typeof v==="string"){const s=v.replace(/\s+/g," ").trim();return s||null;}
  return v;
}
function fpHash(v){
  const s=JSON.stringify(fpNorm(v));
  let h=5381;
  for(let i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;   /* djb2-xor, 32-bit */
  return h.toString(36);
}

/* ================= effects engine ================= */
function contributions(){
  const list=[];
  (character.features||[]).forEach(f=>{ if(f.enabled!==false)(f.effects||[]).forEach(e=>list.push({source:f.name||"Feature",target:e.target,value:num(e.value)})); });
  (character.inventory||[]).forEach(it=>{ if(it.equipped)(it.effects||[]).forEach(e=>list.push({source:it.name||"Item",target:e.target,value:num(e.value)})); });
  (character.statuses||[]).forEach(s=>{ if(s.active!==false)(s.effects||[]).forEach(e=>list.push({source:s.name||"Status",target:e.target,value:num(e.value)})); });
  (character.familiars||[]).forEach(f=>{ if(f.active)(f.effects||[]).forEach(e=>list.push({source:(f.name||"Familiar")+" (summoned)",target:e.target,value:num(e.value)})); });
  return list;
}
function sumFx(target,contribs){return contribs.filter(c=>c.target===target).reduce((a,c)=>a+c.value,0)}
/* Is any ONE contribution to these targets below zero? Asked of each, not of the
   sum, so a bonus that outweighs a penalty or cancels it out still shows it: the
   player wants to deal with the penalty first (#89). */
function fxNeg(contribs,...targets){return contribs.some(c=>c.value<0&&targets.includes(c.target))}
/* `c` is optional: pass the contributions you already computed to avoid a second
   pass, omit it and one is taken. This expression used to be written out in
   three places, which is two chances for them to disagree. */
function effMaxHP(c){return num(character.hp.max)+sumFx("hp.max",c||contributions());}
/* The HP bounds, in one place. Every path that changes HP — a typed entry, the
   +/- buttons, spending a hit die, a long rest, or lowering Max under Current —
   ends here, so the rule cannot be enforced in one of them and not another.
   Model only, no DOM: callers pair it with renderHP().
   "" must survive as "": it means "not set yet", which is not the same as zero,
   and removeClass() distinguishes them when it un-seeds a level-1 character. */
function clampHP(){
  ["cur","max","temp"].forEach(k=>{if(character.hp[k]!==""&&num(character.hp[k])<0)character.hp[k]=0;});
  const mx=effMaxHP();
  if(mx>0&&num(character.hp.cur)>mx)character.hp.cur=mx;
}
function abilFinal(k,contribs){return num(character.abilities[k])+sumFx("ability."+k,contribs)}
function pbValue(contribs){const l=Math.max(1,Math.min(20,num(character.level)||1));return 2+Math.floor((l-1)/4)+sumFx("profBonus",contribs)}
/* ---- proficiency grants (provenance) ---- */
function skillKey(nm){const s=SKILLS.find(x=>x[1].toLowerCase()===String(nm).toLowerCase()||x[0]===String(nm).toLowerCase());return s?s[0]:null;}
function originSid(o){if(!o)return null;if(o.kind==="race")return "race:"+o.name;if(o.kind==="background")return "bg:"+o.name;if(o.kind==="class")return o.subclass?("subclass:"+o.class+":"+o.subclass):("class:"+o.class);return null;}
function grantProf(sid,type,key,level){if(!sid||!key)return;character.grants=(character.grants||[]).filter(g=>!(g.sid===sid&&g.type===type&&g.key===key));character.grants.push({sid,type,key,level:level||1});}
function removeGrants(pred){character.grants=(character.grants||[]).filter(g=>!pred(g));}
function grantedProf(type,key){let lvl=0;(character.grants||[]).forEach(g=>{if(g.type===type&&g.key===key)lvl=Math.max(lvl,g.level||1);});return lvl;}
function grantSources(type,key){return (character.grants||[]).filter(g=>g.type===type&&g.key===key).map(g=>sidLabel(g.sid));}
function sidLabel(sid){const p=String(sid).split(":");if(p[0]==="race")return p[1]+" (ancestry)";if(p[0]==="class")return p[1];if(p[0]==="subclass")return p[2]+" ("+p[1]+")";return sid;}
function effSkill(key){return Math.max(character.skills[key]||0, grantedProf("skill",key));}
function effSaveProf(key){return (character.saves[key]?1:0) || grantedProf("save",key);}

/* ================= build static bits ================= */

/* ---- the ability strip and the Skills card (#103, spec §6.4–6.5) ----
   One layout: six ability boxes, each with its save beneath, and the skills in
   their own card. (The "By ability" layout and its setting, statStyle, were
   retired with #103 — decision 9; a saved value stays in an old sheet, unread.)
   Markup only, no numbers: recompute() finds every number by id (#mod-x,
   #save-x, #skill-x) and every dot by attribute, so change an id here and that
   number silently stops updating. */
function buildAbilities(){
  const el=document.getElementById("abilities");el.innerHTML="";
  ABIL.forEach(([k,l])=>{
    const d=document.createElement("div");d.className="ability";
    d.innerHTML=`<div class="n">${l}</div>
      <div class="m" data-stat="ability.${esc(k)}" id="mod-${esc(k)}">+0</div>
      <input type="number" data-path="character.abilities.${esc(k)}" data-recompute aria-label="${esc(l)} score">
      <div class="save"><button class="dot" data-save="${esc(k)}" aria-label="${esc(l)} save proficiency"></button><span class="sv" data-stat="save.${esc(k)}" id="save-${esc(k)}">+0</span><span class="svl">Save</span></div>`;
    el.appendChild(d);
  });
}
function buildSkills(){
  const el=document.getElementById("skills");el.innerHTML="";
  SKILLS.forEach(([k,l,ab])=>{
    const r=document.createElement("div");r.className="srow";
    r.innerHTML=`<button class="dot" data-skill="${esc(k)}" aria-label="${esc(l)} proficiency"></button><span class="val" data-stat="skill.${esc(k)}" id="skill-${esc(k)}">+0</span><span class="lbl">${l} <span class="ab">${ab}</span></span>`;
    el.appendChild(r);
  });
  /* The grid fills down each column; this many rows per column (see .skills). */
  if(el.style&&el.style.setProperty)el.style.setProperty("--skill-rows",Math.ceil(SKILLS.length/2));
}
/* The one legend lives in the Skills card's markup. It is appended to the CARD,
   never to #skills, because buildSkills() clears that container and would
   delete the node outright. Kept as a function so a legend left anywhere else
   (an old DOM) comes home. */
function placeLegend(){
  const lg=document.getElementById("statLegend");if(!lg)return;
  const host=document.querySelector('[data-note="skills"]');
  if(host&&lg.parentNode!==host)host.appendChild(lg);
}

/* The single entry point. Markup only — no numbers: renderAll() calls this
   FIRST, then refills the score boxes from [data-path] and repaints everything
   through recompute(). */
function buildStats(){
  buildAbilities();buildSkills();placeLegend();
  syncStatLock();   /* in the combat view the stat controls are read-only (#62) */
}
function buildDeath(){
  ["succ","fail"].forEach(kind=>{
    const el=document.getElementById(kind==="succ"?"deathSucc":"deathFail");el.innerHTML="";
    for(let i=1;i<=3;i++){const c=document.createElement("button");c.className="c "+kind;c.dataset.kind=kind;c.dataset.i=i;el.appendChild(c);}
  });
}
function buildSlots(){
  const el=document.getElementById("slotGrid");el.innerHTML="";
  for(let lv=1;lv<=9;lv++){
    const s=document.createElement("div");s.className="slot";
    s.innerHTML=`<div class="lv">Level ${lv}</div><div class="bub" id="bub-${esc(lv)}"></div>
      <div class="cfg">Total <input type="number" min="0" max="12" data-slot="${esc(lv)}" aria-label="Level ${esc(lv)} total slots"></div>`;
    el.appendChild(s);
  }
}
function buildBio(){
  const host=document.getElementById("bioStack");host.innerHTML="";
  BIO.forEach(([key,title])=>{
    const c=document.createElement("div");c.className="card";
    c.innerHTML=`<div class="label">${title} <span class="grow"></span><button class="editbtn" data-edit="${esc(key)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg><span>Edit</span></button></div><div id="rt-${esc(key)}"></div>`;
    host.appendChild(c);
  });
}

/* ================= spell slots by caster level ================= */
const SLOTS_FULL={
 1:[2,0,0,0,0,0,0,0,0],2:[3,0,0,0,0,0,0,0,0],3:[4,2,0,0,0,0,0,0,0],4:[4,3,0,0,0,0,0,0,0],
 5:[4,3,2,0,0,0,0,0,0],6:[4,3,3,0,0,0,0,0,0],7:[4,3,3,1,0,0,0,0,0],8:[4,3,3,2,0,0,0,0,0],
 9:[4,3,3,3,1,0,0,0,0],10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
 13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],16:[4,3,3,3,2,1,1,1,0],
 17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]};
const PACT={1:[1,1],2:[2,1],3:[2,2],4:[2,2],5:[2,3],6:[2,3],7:[2,4],8:[2,4],9:[2,5],10:[2,5],11:[3,5],12:[3,5],13:[3,5],14:[3,5],15:[3,5],16:[3,5],17:[4,5],18:[4,5],19:[4,5],20:[4,5]};
const CASTER_FULL=new Set(["bard","cleric","druid","sorcerer","wizard"]);
const CASTER_HALF=new Set(["paladin","ranger","artificer"]);
const THIRD_SUB=new Set(["eldritch knight","arcane trickster"]);
function classCasterKind(c){
  const n=String(c.name||"").toLowerCase();
  if(n==="warlock")return "pact";
  if(CASTER_FULL.has(n))return "full";
  if(CASTER_HALF.has(n))return "half";
  if(c.subclass&&THIRD_SUB.has(String(c.subclass).toLowerCase()))return "third";
  const d=findClassDef(c.name);if(d&&d.spellcasting)return "full"; // homebrew full-caster fallback
  return null;
}
function hasCasterClass(){return (character.classes||[]).some(c=>classCasterKind(c));}
function casterLevel(){let lvl=0;(character.classes||[]).forEach(c=>{const L=num(c.level),k=classCasterKind(c);if(k==="full")lvl+=L;else if(k==="half")lvl+=Math.ceil(L/2);   /* 2024 / SRD 5.2.1: "half your levels (round up)", every ruleset (#101) */ else if(k==="third")lvl+=Math.floor(L/3);});return lvl;}
function warlockLevel(){let wl=0;(character.classes||[]).forEach(c=>{if(String(c.name||"").toLowerCase()==="warlock")wl+=num(c.level);});return wl;}
let slotsAuto=false;
function autoSlots(){
  if(!hasCasterClass()){
    slotsAuto=false;
    if(!character.spellAbility){ // not a caster by class or ability — clear any leftover slots
      for(let lv=1;lv<=9;lv++){if(character.slots[lv]){character.slots[lv].total=0;character.slots[lv].used=0;}}
    }
    return false;
  }
  slotsAuto=true;
  const cl=casterLevel(), wl=warlockLevel();
  const base=(cl>=1&&SLOTS_FULL[Math.min(20,cl)])?SLOTS_FULL[Math.min(20,cl)]:[0,0,0,0,0,0,0,0,0];
  for(let lv=1;lv<=9;lv++){if(!character.slots[lv])character.slots[lv]={total:0,used:0};character.slots[lv].total=base[lv-1]||0;}
  if(wl>0){const p=PACT[Math.min(20,wl)];if(p&&p[1]>=1&&p[1]<=9)character.slots[p[1]].total=(character.slots[p[1]].total||0)+p[0];}
  for(let lv=1;lv<=9;lv++){if((character.slots[lv].used||0)>character.slots[lv].total)character.slots[lv].used=character.slots[lv].total;}
  return true;
}
function maxCastableLevel(){for(let lv=9;lv>=1;lv--){if(character.slots[lv]&&character.slots[lv].total>0)return lv;}return 0;}
/* cantrips known per class at a given class level (2024 breakpoints at 1/4/10) */
const CANTRIPS={bard:[[1,2],[4,3],[10,4]],cleric:[[1,3],[4,4],[10,5]],druid:[[1,2],[4,3],[10,4]],sorcerer:[[1,4],[4,5],[10,6]],warlock:[[1,2],[4,3],[10,4]],wizard:[[1,3],[4,4],[10,5]]};
function cantripsFor(name,L){const t=CANTRIPS[String(name||"").toLowerCase()];if(!t)return 0;let v=0;t.forEach(([lvl,c])=>{if(L>=lvl)v=c;});return v;}
function cantripsKnown(){let c=0;(character.classes||[]).forEach(cl=>c+=cantripsFor(cl.name,num(cl.level)));return c;}
/* per spell-level allotment: cantrips-known for level 0, spell slots for 1-9 */
function spellAllotment(lv){return lv===0?cantripsKnown():((character.slots[lv]&&character.slots[lv].total)||0);}
/* What one spell level looks like right now: how many you ADDED (those count
   against the allotment), how many were GRANTED by a feat/background/ancestry
   (those don't), and the allotment itself. allot===0 means "no allotment known",
   which callers show as a bare count rather than "n/0".
   The single source of truth for both the Spells tab heading and the browser's,
   so the two cannot drift apart. Pure — no DOM. */
function spellLevelTally(lv){
  const at=(character.spells||[]).filter(s=>num(s.level)===num(lv));
  const added=at.filter(s=>!s.granted).length;
  return {added,granted:at.length-added,allot:spellAllotment(lv)};
}

