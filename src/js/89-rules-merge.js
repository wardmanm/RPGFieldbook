/* ---- does a pack have everything it references? ----

   A pack can lean on content it doesn't ship: Xanathar's 31 subclasses all
   attach to classes from the D&D 2024 pack, and homebrew leans on whatever its
   author had loaded. Until now that failed SILENTLY and misleadingly — the
   subclasses merge, Settings counts them as loaded, and the subclass picker then
   says "this class has no subclasses in the loaded rules", which is false. They
   are loaded; their parent class isn't.

   Two sources, because one alone is not enough:

   - STRUCTURAL: `subclasses[].class` is a real field the app resolves, so a
     missing parent class is detectable with no authoring at all. This is what
     catches a homebrew pack nobody annotated.
   - DECLARED (`requires`, schema §1): for references the schema cannot model.
     `levels[].spells` is prose, so a subclass's expanded spell list names its
     spells only inside sentences — undetectable structurally, and guessing at
     prose would invent as many references as it found.

   This is a PURE function of `rules`, deliberately: mergeRules never runs at
   boot (90-boot.js restores the merged pool from localStorage), so anything
   computed during merge would be lost on reload. Only the declaration is stored.
   Nothing here ever blocks loading — the pack works, minus what it references. */
function missingRequirements(src){
  const out=[];
  const has=(cat,name)=>!!ruleById(cat,name);
  /* structural: a subclass whose parent class isn't loaded is unreachable */
  const orphan=[];
  (rules.subclasses||[]).forEach(s=>{
    if((s._source||"")!==src||!s.class)return;
    if(!findClassDef(s.class)&&orphan.indexOf(s.class)<0)orphan.push(s.class);
  });
  if(orphan.length)out.push({pack:"",file:"",missing:orphan.map(n=>({cat:"classes",name:n}))});
  /* declared */
  const decl=(rules.requires&&rules.requires[src])||[];
  decl.forEach(grp=>{
    if(!grp||typeof grp!=="object")return;
    const miss=[];
    RULE_CATS.forEach(cat=>{        /* a category we don't know is ignored, not reported */
      (Array.isArray(grp[cat])?grp[cat]:[]).forEach(name=>{
        if(name&&!has(cat,name))miss.push({cat,name:String(name)});
      });
    });
    if(miss.length)out.push({pack:String(grp.pack||""),file:String(grp.file||""),missing:miss});
  });
  return out;
}
/* "Classes" -> "class", not "classe". Spelled out rather than de-pluralised,
   because the display names are not all regular ("Species" is both). */
const CAT_ONE={keywords:"glossary entry",features:"trait",items:"item",spells:"spell",
  races:"species",classes:"class",feats:"feat",backgrounds:"background",
  subclasses:"subclass",tables:"table"};
function requiresStatusHTML(g){
  const groups=missingRequirements(g.source);
  if(!groups.length)return "";
  const n=groups.reduce((a,b)=>a+b.missing.length,0);
  const lines=groups.map(gr=>{
    /* grouped by category, so eight missing classes read as one line and not as
       the same word repeated eight times */
    const byCat={};
    gr.missing.forEach(m=>{(byCat[m.cat]=byCat[m.cat]||[]).push(m.name);});
    const names=Object.keys(byCat).map(c=>{
      const v=byCat[c];
      return v.length+" "+(v.length===1?(CAT_ONE[c]||c):catName(c).toLowerCase())+": "+v.join(", ");
    }).join("; ");
    const from=gr.file?" — import "+gr.file
      :(gr.pack?" — from "+gr.pack
        :" — load the pack that defines them, then these will work");
    return names+from;
  });
  /* "!" because colour alone can't carry this: in the Classic skin --brick and
     --accent are the SAME value, so this chip and the amber "update available"
     one are indistinguishable by colour. */
  return ` <span class="chip bad" title="${esc("This pack refers to "+n+" entr"+(n===1?"y":"ies")+" that aren't loaded. It still works — anything referring to them just won't fill in.\n\n"+lines.join("\n"))}">! ${n} missing</span>`;
}
/* one line for the status area, so this is visible at import and not only if
   someone happens to open the loaded-data list */
function missingSummary(){
  const bad=loadedRulesGroups().filter(g=>missingRequirements(g.source).length);
  if(!bad.length)return "";
  const names=[...new Set(bad.map(g=>g.source||g.label))];
  return " "+names.join(", ")+(names.length===1?" refers":" refer")+" to content that isn't loaded — see Loaded data below.";
}
function rulesDataHTML(){
  const groups=loadedRulesGroups();
  const warn=rulesCacheWarning()
    ? `<p class="status err" style="margin:4px 0 8px">${esc(rulesCacheWarning())}</p>` : "";
  if(!groups.length)return warn+`<p class="hint" style="margin:4px 0">No rules data loaded.</p>`;
  const row=(g,withSummary)=>{
    const summary=withSummary?Object.entries(g.cats).map(([c,n])=>`${n} ${catName(c).toLowerCase()}`).join(" · "):"";
    return `<div class="rd-row"><div class="rd-main"><div class="rd-name">${esc(g.label)}${g.isFile&&g.source?` <span class="rd-src">${esc(g.source)}</span>`:""}${dataStatusHTML(g)}${requiresStatusHTML(g)}</div>${summary?`<div class="rd-sub">${esc(summary)}</div>`:""}</div><button class="icon danger" data-rd-del="${esc(g.key)}" title="Remove this data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button></div>`;
  };
  /* whole-system packs first, then one heading per category, Mixed last */
  const order=["rulebook"].concat(RULE_CATS,["mixed"]);
  const label={rulebook:"Rulebook",mixed:"Mixed"};
  let html="";
  order.forEach(b=>{
    const inB=groups.filter(g=>rulesBucket(g)===b);
    if(!inB.length)return;
    html+=`<div class="spell-h">${esc(label[b]||catName(b))} (${inB.length})</div>`;
    /* the heading already names the category on single-category rows */
    html+=inB.map(g=>row(g,b==="rulebook"||b==="mixed")).join("");
  });
  return warn+html;
}
function renderRulesData(){
  const html=rulesDataHTML();
  ["rulesData","homeRulesData"].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=html;});
}
function renderSrcRows(){
  const host=document.getElementById("srcList");if(!host)return;
  const srcs=settings.rulesSources||[];
  host.innerHTML=srcs.length?srcs.map((u,i)=>`<div style="display:flex;gap:7px;margin-bottom:6px"><input value="${esc(u)}" data-src-i="${i}"><button class="icon danger" data-src-del="${i}" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join(""):`<p class="hint" style="margin:0 0 6px">No sources yet — add a URL below or use Import files.</p>`;
}
function resetRules(){rules={name:"",version:1,keywords:[],items:[],features:[],spells:[],races:[],classes:[],feats:[],tables:[],requires:{}};}
function keyOf(x,kind){return kind==="subclasses"?(String(x.class||"")+"|"+String(x.name||"")).trim().toLowerCase():String(kind==="keywords"?(x.term||""):(x.name||"")).trim().toLowerCase();}
/* merge one rules file (any subset of keywords / traits|features / items / spells) into the live rules */
function srcLabel(obj){return String(obj.system||obj.name||"Rules").trim();}
function mergeRules(obj,fileName){
  if(obj.name&&!rules.name)rules.name=obj.name;
  const src=srcLabel(obj);
  const traitArr=Array.isArray(obj.features)?obj.features:(Array.isArray(obj.traits)?obj.traits:null);
  /* Character systems this pack's species must NOT be offered to. A supplement
     (Xanathar's, Tasha's) is D&D content the app can't infer a system for, so it
     says who it is NOT for rather than who it is for — see rules-schema §1. */
  const excl=Array.isArray(obj.excludeSystems)
    ? obj.excludeSystems.map(x=>String(x).trim().toLowerCase()).filter(Boolean) : null;
  /* What this pack refers to but doesn't ship (schema §1). Kept per SOURCE on
     `rules`, not stamped per entry: it's pack-level and can be long. It lives in
     `rules` because that whole object is what saveRulesCache() persists and what
     boot restores — mergeRules never runs again. Must stay plain arrays and
     strings for that round trip; rules._dups uses Sets and serialises to {}. */
  if(Array.isArray(obj.requires)){
    if(!rules.requires||typeof rules.requires!=="object")rules.requires={};
    rules.requires[srcLabel(obj)]=obj.requires;
  }
  const cats={keywords:obj.keywords,features:traitArr,items:obj.items,spells:obj.spells,races:obj.races,classes:obj.classes,feats:obj.feats,backgrounds:obj.backgrounds,subclasses:obj.subclasses,tables:obj.tables};
  Object.keys(cats).forEach(kind=>{
    const arr=cats[kind];if(!Array.isArray(arr))return;
    /* key by SOURCE + name: re-loading the same source replaces its own entries,
       but a same-named entry from a different source is kept (both shown, annotated). */
    const map=new Map((rules[kind]||[]).map(x=>[(x._source||"")+"\u0000"+keyOf(x,kind),x]));
    arr.forEach(raw=>{
      const base=(kind==="keywords")?{id:uid(),term:raw.term||"",type:raw.type==="image"?"image":"text",text:raw.text||"",image:raw.image||null,cond:!!raw.cond}:Object.assign({},raw);
      base._source=src;if(fileName)base._file=fileName;if(obj.rulebook)base._rulebook=1;
      if(obj.dataVersion)base._dataVersion=obj.dataVersion;
      if(excl&&excl.length)base._excludeSystems=excl;
      const nm=keyOf(base,kind);if(!nm)return;
      map.set(src+"\u0000"+nm,base);
    });
    rules[kind]=Array.from(map.values());
  });
  reindexRules();
  recomputeDups();
}
/* assign an HTML-safe unique id to every rule entry (used as <option> values and
   for lookups). Must NOT contain characters the HTML parser mangles — notably a
   null byte, which the parser turns into U+FFFD inside attribute values. */
let _ruleSeq=0;
function reindexRules(){
  _ruleSeq=0;
  RULE_CATS.forEach(kind=>{
    (rules[kind]||[]).forEach(x=>{x._id="r"+(_ruleSeq++);});
  });
}
/* names that appear in more than one source within a category → shown annotated */
function recomputeDups(){
  rules._dups={};
  RULE_CATS.forEach(kind=>{
    const seen={},dup=new Set();
    (rules[kind]||[]).forEach(x=>{const n=keyOf(x,kind);if(!n)return;if(seen[n])dup.add(n);seen[n]=1;});
    rules._dups[kind]=dup;
  });
}
function dispName(entry,kind){
  const nm=(kind==="keywords"?entry.term:entry.name)||"";
  if(!rules._dups)recomputeDups();
  const dset=rules._dups[kind]||new Set();
  return dset.has(String(nm).trim().toLowerCase())?`${nm} (${entry._source||"?"})`:nm;
}
function ruleById(kind,idOrName){
  const arr=rules[kind]||[];
  return arr.find(x=>x._id===idOrName)||arr.find(x=>keyOf(x,kind)===String(idOrName||"").trim().toLowerCase());
}
/* fetch a URL, merge it, and follow any "include":[...] references (a manifest) relative to that URL */
function fetchRulesFrom(url,seen){
  if(seen.has(url))return Promise.resolve();
  seen.add(url);
  return fetch(url,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error((url.split("/").pop()||url)+" → "+r.status);return r.json();})
    .then(obj=>{
      mergeRules(obj);
      const inc=Array.isArray(obj.include)?obj.include:[];
      return inc.reduce((p,ref)=>p.then(()=>fetchRulesFrom(new URL(ref,url).href,seen)),Promise.resolve());
    });
}
function fetchAllRules(){
  const srcs=(settings.rulesSources||[]).map(s=>s.trim()).filter(Boolean);
  if(!srcs.length){updateRulesStatus("Add at least one source URL first.","err");return;}
  updateRulesStatus(`Fetching ${srcs.length} source${srcs.length>1?"s":""}…`,"");
  resetRules();const seen=new Set();
  srcs.reduce((p,u)=>p.then(()=>fetchRulesFrom(u,seen)),Promise.resolve())
    /* renderRulesData() was missing here: a fetch refreshed the sheet but left the
       loaded-data list — and now its missing-content chips — showing the old state. */
    .then(()=>{const m=missingSummary();saveRulesCache();refreshRulesUI();renderRulesData();updateRulesStatus("Fetched. "+rulesStatusText()+m,m?"err":"ok");})
    .catch(err=>{saveRulesCache();refreshRulesUI();renderRulesData();updateRulesStatus("Couldn't finish ("+err.message+"). Kept what loaded; if offline or CORS-blocked, import files instead.","err");});
}
/* import one or many files; each is merged so you can load traits.json, spells.json, … separately */
function importRulesFiles(files){
  const list=Array.from(files);let ok=0,bad=0;
  (function next(i){
    if(i>=list.length){const m=missingSummary();saveRulesCache();refreshRulesUI();renderRulesData();updateRulesStatus(`Merged ${ok} file(s)${bad?", "+bad+" failed":""}. `+rulesStatusText()+m,(bad||m)?"err":"ok");return;}
    const r=new FileReader();
    r.onload=()=>{try{mergeRules(JSON.parse(r.result),list[i].name);ok++;}catch(e){bad++;}next(i+1);};
    r.onerror=()=>{bad++;next(i+1);};
    r.readAsText(list[i]);
  })(0);
}
/* download a split example set: a manifest plus one file per category */
function downloadRulesTemplates(){
  const files=[
    ["humblewood.rules.json",{name:"Humblewood Rules",version:1,include:["conditions.json","races.json","classes.json","traits.json","items.json","spells.json","feats.json"]}],
    ["conditions.json",{keywords:[
      {term:"Frightened",type:"text",text:"Disadvantage on ability checks and attack rolls while the source of fear is in line of sight; can't willingly move closer to it."},
      {term:"Poisoned",type:"text",text:"Disadvantage on attack rolls and ability checks."}]}],
    ["races.json",{races:[
      {name:"Strig",description:"Owlfolk of the Humblewood — patient nocturnal hunters.",abilityScores:{wis:2,dex:1},speed:25,skills:["Perception"],languages:"Birdfolk, Common",
       traits:[{name:"Silent Feathers",description:"You have proficiency in the Stealth skill.",skills:["Stealth"]},{name:"Nocturnal",description:"You can see in dim light within 60 feet as if it were bright light."}]}]}],
    ["classes.json",{classes:[
      {name:"Bard",description:"An inspiring magician whose power echoes the music of creation.",hitDie:"d8",spellcasting:"cha",savingThrows:["dex","cha"],
       levels:{
         "1":{traits:[{name:"Bardic Inspiration",description:"Bonus action: give an ally a d6 inspiration die."}],choices:[{type:"skill",choose:3,from:["Acrobatics","Deception","History","Insight","Performance","Persuasion","Stealth"]}],spells:{known:4,note:"You know 4 cantrips/spells to start."}},
         "2":{traits:[{name:"Jack of All Trades",description:"Add half proficiency to checks that lack it."}]},
         "3":{traits:[{name:"Expertise",description:"Double proficiency for two chosen skills."}],choices:[{type:"subclass",label:"Choose a Bard College"}]},
         "4":{choices:[{type:"asi"}]}
       },
       subclasses:{
         "College of Lore":{description:"Bards who collect knowledge and secrets from every source.",levels:{
            "3":{traits:[{name:"Cutting Words",description:"Reaction + inspiration die to subtract from a foe's roll."}],choices:[{type:"skill",choose:3,from:["Arcana","History","Investigation","Nature","Religion","Medicine"]}]}}},
         "College of Valor":{description:"Skalds whose tales embolden warriors in battle.",levels:{
            "3":{traits:[{name:"Bonus Proficiencies",description:"Medium armor, shields, and martial weapons."}]}}}
       }},
      {name:"Fighter",description:"A master of martial combat.",hitDie:"d10",savingThrows:["str","con"],
       levels:{
         "1":{traits:[{name:"Second Wind",description:"Bonus action: regain 1d10 + level HP, once per rest."}],choices:[
            {type:"option",label:"Choose a Fighting Style",choose:1,from:[
               {name:"Archery",description:"+2 to ranged weapon attack rolls.",effects:[{target:"attack.ranged",value:2}]},
               {name:"Defense",description:"+1 AC while wearing armor.",effects:[{target:"ac",value:1}]},
               {name:"Great Weapon Fighting",description:"Treat 1s and 2s on two-handed melee damage dice as 3s."},
               {name:"Two-Weapon Fighting",description:"Add your ability modifier to the off-hand attack's damage."}]},
            {type:"skill",choose:2,from:["Acrobatics","Athletics","History","Insight","Intimidation","Perception","Survival"]}]},
         "3":{choices:[{type:"subclass",label:"Choose a Martial Archetype"}]},
         "4":{choices:[{type:"asi"}]}
       },
       subclasses:{
         "Champion":{description:"Hones raw physical prowess to perfection.",levels:{"3":{traits:[{name:"Improved Critical",description:"Crit on a 19 or 20."}]}}},
         "Arcane Archer":{description:"Weaves magic into bow attacks.",spellcasting:"int",levels:{
            "3":{traits:[{name:"Arcane Shot",description:"Unleash magical effects through your bow."}],choices:[{type:"skill",choose:1,from:["Arcana","Nature"]}],spells:{note:"Learn two Arcane Shot options."}}}}
       }}]}],
    ["traits.json",{traits:[
      {name:"Keen Senses",source:"Ancestry",description:"You have proficiency in the Perception skill.",skills:["Perception"]}]}],
    ["items.json",{items:[
      {name:"Cloak of Protection",description:"+1 AC and saving throws while worn.",effects:[{target:"ac",value:1},{target:"save.str",value:1},{target:"save.dex",value:1},{target:"save.con",value:1},{target:"save.int",value:1},{target:"save.wis",value:1},{target:"save.cha",value:1}]},
      {name:"Gauntlets of Might",description:"Example item using the attack effect targets: +1 to melee attack and damage rolls while equipped.",effects:[{target:"attack.melee",value:1},{target:"damage.melee",value:1}]}]}],
    ["spells.json",{spells:[
      {name:"Cure Wounds",level:1,class:["Ranger","Cleric","Druid"],meta:"1 action · Touch · V,S",text:"A creature you touch regains hit points equal to 1d8 + your spellcasting modifier."},
      {name:"Hunter's Mark",level:1,class:"Ranger",meta:"1 bonus action · 90 ft · V · Concentration",text:"Mark a creature; deal extra 1d6 damage to it with weapon attacks and gain tracking benefits."},
      {name:"Guidance",level:0,class:["Cleric","Druid"],meta:"1 action · Touch · V,S · Concentration",text:"The target can add 1d4 to one ability check of its choice before the spell ends."}]}],
    ["feats.json",{feats:[
      {name:"Alert",description:"+5 to initiative; you can't be surprised while conscious.",effects:[{target:"init",value:5}]},
      {name:"Tough",description:"Your hit point maximum increases by twice your level.",effects:[]}]}]
  ];
  files.forEach(([n,o],i)=>setTimeout(()=>dl(new Blob([JSON.stringify(o,null,2)],{type:"application/json"}),n),i*300));
}

