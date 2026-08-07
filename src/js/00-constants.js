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
  ABIL.forEach(([k,l])=>g.push([l+" score","ability."+k]));
  ABIL.forEach(([k,l])=>g.push([l+" save","save."+k]));
  SKILLS.forEach(([k,l])=>g.push([l+" skill","skill."+k]));
  return g;
}
const FX_LABEL={};fxTargets().forEach(([l,t])=>FX_LABEL[t]=l);

/* ================= state ================= */
function uid(){return Math.random().toString(36).slice(2,9)}
function blankChar(){
  const c={id:uid(),system:"humblewood",name:"",class:"",ancestry:"",background:"",alignment:"",xp:"",level:1,
    ac:"",init:"",speed:"",hitdice:"",hdManual:false,inspiration:false,
    hp:{cur:"",max:"",temp:""}, death:{succ:0,fail:0},
    coins:{cp:"",sp:"",ep:"",gp:"",pp:""},
    abilities:{},saves:{},skills:{},
    spellAbility:"", slots:{}, spells:[], attacks:[], race:null, bg:null, classes:[], grants:[],
    features:[], inventory:[], statuses:[], familiars:[], glossary:[],
    featCollapse:{groups:{},items:{}}, invCollapse:{items:{}}, atkCollapse:{items:{}}, hdUsed:{}, resources:[],
    activeSpells:[], combatRound:0, grantGold:{},
    proficiencies:"" };
  ABIL.forEach(([k])=>{c.abilities[k]=10;c.saves[k]=false});
  SKILLS.forEach(([k])=>c.skills[k]=0);
  for(let i=1;i<=9;i++)c.slots[i]={total:0,used:0};
  BIO.forEach(([k])=>c[k]="");
  return c;
}
let character=blankChar();
let settings={skin:"humblewood",theme:"light",autoload:true,rough:true,rulesSources:[]};
let rules={name:"",version:0,keywords:[],items:[],features:[],spells:[],races:[],classes:[],feats:[]};

function seedGlossary(){return [];}

/* ================= helpers ================= */
function num(v){const n=parseInt(v,10);return isNaN(n)?0:n}
function modOf(score){return Math.floor((num(score)-10)/2)}
function fmt(n){return (n>=0?"+":"")+n}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escReg(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
function get(o,p){return p.split(".").reduce((a,k)=>a&&a[k],o)}
function setP(o,p,v){const ks=p.split(".");const last=ks.pop();let t=o;ks.forEach(k=>t=t[k]);t[last]=v}
function allGlossary(){return [...(rules.keywords||[]).map(k=>({...k,_locked:true})), ...character.glossary]}

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
function effMaxHP(){return num(character.hp.max)+sumFx("hp.max",contributions());}
function clampCurHP(){const mx=effMaxHP();if(mx>0&&num(character.hp.cur)>mx){character.hp.cur=mx;const ci=document.querySelector('[data-path="character.hp.cur"]');if(ci)ci.value=mx;}}
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
function buildAbilities(){
  const el=document.getElementById("abilities");el.innerHTML="";
  ABIL.forEach(([k,l])=>{
    const d=document.createElement("div");d.className="ability";
    d.innerHTML=`<div class="n">${l}</div>
      <div class="m" data-stat="ability.${k}" id="mod-${k}">+0</div>
      <input type="number" data-path="character.abilities.${k}" data-recompute aria-label="${l} score">
      <div class="save"><button class="dot" data-save="${k}" aria-label="${l} save proficiency"></button><span class="sv" data-stat="save.${k}" id="save-${k}">+0</span><span style="font-family:var(--head);font-size:9px;color:var(--ink-soft)">SAVE</span></div>`;
    el.appendChild(d);
  });
}
function buildSkills(){
  const el=document.getElementById("skills");el.innerHTML="";
  SKILLS.forEach(([k,l,ab])=>{
    const r=document.createElement("div");r.className="srow";
    r.innerHTML=`<button class="dot" data-skill="${k}" aria-label="${l} proficiency"></button><span class="val" data-stat="skill.${k}" id="skill-${k}">+0</span><span class="lbl">${l} <span class="ab">${ab}</span></span>`;
    el.appendChild(r);
  });
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
    s.innerHTML=`<div class="lv">Level ${lv}</div><div class="bub" id="bub-${lv}"></div>
      <div class="cfg">Total <input type="number" min="0" max="12" data-slot="${lv}" aria-label="Level ${lv} total slots"></div>`;
    el.appendChild(s);
  }
}
function buildBio(){
  const host=document.getElementById("bioStack");host.innerHTML="";
  BIO.forEach(([key,title])=>{
    const c=document.createElement("div");c.className="card";
    c.innerHTML=`<div class="label">${title} <span class="grow"></span><button class="editbtn" data-edit="${key}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg><span>Edit</span></button></div><div id="rt-${key}"></div>`;
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
  const n=(c.name||"").toLowerCase();
  if(n==="warlock")return "pact";
  if(CASTER_FULL.has(n))return "full";
  if(CASTER_HALF.has(n))return "half";
  if(c.subclass&&THIRD_SUB.has(String(c.subclass).toLowerCase()))return "third";
  const d=findClassDef(c.name);if(d&&d.spellcasting)return "full"; // homebrew full-caster fallback
  return null;
}
function hasCasterClass(){return (character.classes||[]).some(c=>classCasterKind(c));}
function casterLevel(){let lvl=0;(character.classes||[]).forEach(c=>{const L=num(c.level),k=classCasterKind(c);if(k==="full")lvl+=L;else if(k==="half")lvl+=Math.floor(L/2);else if(k==="third")lvl+=Math.floor(L/3);});return lvl;}
function warlockLevel(){let wl=0;(character.classes||[]).forEach(c=>{if((c.name||"").toLowerCase()==="warlock")wl+=num(c.level);});return wl;}
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

