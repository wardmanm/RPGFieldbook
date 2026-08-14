/* ================= settings modal =================
   The modal grew a control at a time until it was one long scroll, so it is
   grouped into collapsible sections. They reuse the feature-list idiom
   (.fgroup/.fghead/.fcaret) rather than inventing a second collapsible — one
   less thing to keep looking the same. Open/closed is remembered in `settings`,
   because a setting you visit often shouldn't need reopening every time. */
const SET_SECTIONS=[
  /* `open` is the FIRST-RUN default, not the current state. Appearance and the
     character's own options are what people come here for; the rules-data block
     is the longest and the least often touched, so it starts folded away — with
     its entry count on the header, so "did my rules load?" is still answerable
     without opening it. */
  {k:"appearance",title:"Appearance",       open:true},
  {k:"character", title:"This character",   open:true},
  {k:"rules",     title:"Rules data",       open:false},
  {k:"backup",    title:"Characters & backup",open:false}
];
function setSecDef(k){return SET_SECTIONS.find(s=>s.k===k)||null;}
/* stored as COLLAPSE (true = closed) so an absent key means "first run", and the
   defaults above can change later without rewriting anyone's saved settings */
function setSecOpen(k){
  const c=(settings&&settings.setCollapse&&typeof settings.setCollapse==="object"&&!Array.isArray(settings.setCollapse))?settings.setCollapse:{};
  if(k in c)return !c[k];
  const d=setSecDef(k);return d?d.open:true;
}
function setSecHTML(k,body,badge){
  const d=setSecDef(k);if(!d)return "";
  const open=setSecOpen(k);
  return `<div class="fgroup"><div class="fghead" data-setsec="${k}" role="button" tabindex="0" aria-expanded="${open?"true":"false"}">`+
    `<svg class="fcaret ${open?"":"c"}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>`+
    `<span class="fgname">${esc(d.title)}</span>${badge?`<span class="fgcount">${esc(badge)}</span>`:""}</div>`+
    `<div class="setsec-body" data-setsecbody="${k}"${open?"":` style="display:none"`}>${body}</div></div>`;
}
function rulesEntryCount(){return RULE_CATS.reduce((a,c)=>a+((rules[c]||[]).length),0);}
function openSettings(){
  const secAppearance=`
    <div class="field"><label class="f">Skin</label>
      <div class="seg" id="segSkin">
        <button data-skin="humblewood" class="${(settings.skin||"humblewood")==="humblewood"?"on":""}">Humblewood</button>
        <button data-skin="classic" class="${settings.skin==="classic"?"on":""}">Classic D&amp;D</button>
      </div></div>
    <div class="field"><label class="f">Mode</label>
      <div class="seg" id="segTheme">
        <button data-th="system" class="${settings.theme==="system"?"on":""}">System</button>
        <button data-th="light" class="${settings.theme==="light"?"on":""}">Light</button>
        <button data-th="dark" class="${settings.theme==="dark"?"on":""}">Dark</button>
      </div></div>
    <div class="toggle"><div><div class="t-lbl">Hand-drawn borders</div><div class="t-sub">Inky wobble. Turn off for a cleaner look / low-end devices.</div></div><button class="switch ${settings.rough?"on":""}" id="swRough"></button></div>
    <div class="toggle"><div><div class="t-lbl">Icon tabs</div><div class="t-sub">Show the tab bar as icons instead of words, on every screen size. Narrow screens do this anyway.</div></div><button class="switch ${settings.tabIcons?"on":""}" id="swTabIcons"></button></div>`;
  const secCharacter=activeId?`
    <div class="g2"><div class="field"><label class="f">Size</label>
        <select id="setSize">${sizeOptionsHTML(character.size)}</select></div>
      <div class="field"><label class="f">Encumbrance</label>
        <select id="setEnc">${[["none","Off — show weight only"],["standard","Standard (capacity, push/drag)"],["variant","Variant (encumbered tiers)"]].map(([v,l])=>`<option value="${v}"${encMode()===v?" selected":""}>${esc(l)}</option>`).join("")}</select></div></div>
    <p class="hint" id="encHint">${esc(encSettingsHint())}</p>
    <div class="toggle"><div><div class="t-lbl">Coins count as weight</div><div class="t-sub">50 coins to the pound, the way the rules have it.</div></div><button class="switch ${character.coinWeight!==false?"on":""}" id="swCoinWeight"></button></div>
    <div class="field" style="margin-top:12px"><label class="f">Rules updates</label>
      <p class="hint">Last checked against <b>v${esc(character.appVersion||"—")}</b>; you're on v${esc(APP_VERSION)}. Compare this sheet against your loaded rules and update what you choose. A backup is always saved first.</p>
      <div class="m-actions" style="justify-content:flex-start"><button class="tbtn" id="btnCharUpdate">Check for rules updates</button></div>
    </div>`:"";
  const secRules=`
    <div class="field"><label class="f">Rules sources</label>
      <p class="hint">Load one or more JSON files — split by category (conditions, traits, items, spells), or point to a manifest that <b>include</b>s them. All sources merge; later ones win on name clashes. Fetched when online, cached for offline.</p>
      <div id="srcList"></div>
      <div style="display:flex;gap:7px;margin-top:4px"><input id="newSrc" placeholder="https://…/spells.json"><button class="tbtn" id="addSrc">Add</button></div>
      <div class="m-actions" style="justify-content:flex-start;margin-top:8px">
        <button class="tbtn" id="btnFetchRules">Fetch all</button>
        <button class="tbtn" id="btnImportRules">Import files</button>
        <button class="tbtn" id="btnRulesTemplate">Get templates</button>
        <button class="tbtn danger" id="btnClearRules" style="margin-left:auto">Clear all</button>
      </div>
      <div class="status ${((rules.keywords||[]).length+(rules.features||[]).length+(rules.items||[]).length+(rules.spells||[]).length)?"ok":""}" id="rulesStatus">${rulesStatusText()}</div>
      <input type="file" id="fileRules" accept="application/json,.json" multiple class="hidefile">
    </div>
    <div class="field" style="margin-top:6px"><label class="f">Loaded rules data</label>
      <p class="hint">Everything currently in your rules pool, grouped by file (or source). Remove any piece you no longer want loaded.</p>
      <div id="rulesData"></div>
    </div>`;
  const secBackup=`
    <div class="toggle"><div><div class="t-lbl">Character library</div><div class="t-sub">Switch characters, set autoload, or start a new one.</div></div><button class="tbtn" id="swHome">Open</button></div>
    <div class="m-actions" style="justify-content:flex-start;margin-top:10px">
      <button class="tbtn" id="btnExportSettings">Export settings</button>
      <button class="tbtn" id="btnImportSettings">Import settings</button>
      <input type="file" id="fileSettings" accept="application/json,.json" class="hidefile">
    </div>
    <p class="hint" style="margin-top:6px">Export saves your appearance settings <b>and</b> all loaded rules data to one JSON file; import restores both.</p>`;
  const n=rulesEntryCount();
  openModal("Settings",`<div id="setSections">`+
    setSecHTML("appearance",secAppearance)+
    (secCharacter?setSecHTML("character",secCharacter,character.name||"unnamed"):"")+
    setSecHTML("rules",secRules,n?n+" entries":"none loaded")+
    setSecHTML("backup",secBackup)+
    `</div>`);
  /* Delegated from a wrapper INSIDE the modal body, not from #mBody itself:
     #mBody survives every open, so a listener bound to it would stack up one
     copy per visit. */
  const secs=document.getElementById("setSections");
  const toggleSec=(head)=>{
    const k=head.dataset.setsec;
    if(!settings.setCollapse||typeof settings.setCollapse!=="object"||Array.isArray(settings.setCollapse))settings.setCollapse={};
    const open=!setSecOpen(k);
    settings.setCollapse[k]=!open;
    head.setAttribute("aria-expanded",open?"true":"false");
    const car=head.querySelector(".fcaret");if(car)car.classList.toggle("c",!open);
    const body=secs.querySelector(`[data-setsecbody="${k}"]`);if(body)body.style.display=open?"":"none";
    saveSettings();
  };
  secs.addEventListener("click",e=>{const h=e.target.closest("[data-setsec]");if(h)toggleSec(h);});
  secs.addEventListener("keydown",e=>{
    if(e.key!=="Enter"&&e.key!==" ")return;
    const h=e.target.closest("[data-setsec]");if(!h)return;
    e.preventDefault();toggleSec(h);
  });
  document.getElementById("segSkin").addEventListener("click",e=>{const b=e.target.closest("[data-skin]");if(!b)return;settings.skin=b.dataset.skin;document.querySelectorAll("#segSkin button").forEach(x=>x.classList.toggle("on",x===b));applyTheme();saveSettings();if(activeId){character.system=systemForSkin(settings.skin);renderCoins();libTouch();scheduleSave();}});
  document.getElementById("segTheme").addEventListener("click",e=>{const b=e.target.closest("[data-th]");if(!b)return;settings.theme=b.dataset.th;document.querySelectorAll("#segTheme button").forEach(x=>x.classList.toggle("on",x===b));applyTheme();saveSettings();});
  document.getElementById("swHome").addEventListener("click",()=>{closeModal();showHome();});
  document.getElementById("swRough").addEventListener("click",e=>{settings.rough=!settings.rough;e.currentTarget.classList.toggle("on",settings.rough);applyTheme();saveSettings();});
  document.getElementById("swTabIcons").addEventListener("click",e=>{settings.tabIcons=!settings.tabIcons;e.currentTarget.classList.toggle("on",settings.tabIcons);applyTheme();saveSettings();});
  renderSrcRows();renderRulesData();
  document.getElementById("rulesData").addEventListener("click",e=>{const d=e.target.closest("[data-rd-del]");if(!d)return;const g=loadedRulesGroups().find(x=>x.key===d.dataset.rdDel);if(g&&confirm(`Remove “${g.label}” (${g.count} entr${g.count===1?"y":"ies"}) from your loaded rules?`))removeRulesGroup(d.dataset.rdDel);});
  document.getElementById("srcList").addEventListener("input",e=>{const inp=e.target.closest("[data-src-i]");if(!inp)return;settings.rulesSources[num(inp.dataset.srcI)]=inp.value.trim();saveSettings();});
  document.getElementById("srcList").addEventListener("click",e=>{const d=e.target.closest("[data-src-del]");if(!d)return;settings.rulesSources.splice(num(d.dataset.srcDel),1);saveSettings();renderSrcRows();});
  document.getElementById("addSrc").addEventListener("click",()=>{const i=document.getElementById("newSrc");const v=i.value.trim();if(!v)return;settings.rulesSources.push(v);i.value="";saveSettings();renderSrcRows();});
  document.getElementById("btnFetchRules").addEventListener("click",fetchAllRules);
  document.getElementById("btnClearRules").addEventListener("click",clearAllRules);
  /* the size / encumbrance / coin-weight block only exists when a character is
     open, so every one of these is guarded */
  {const s=document.getElementById("setSize");if(s)s.addEventListener("change",()=>{character.size=s.value;encSettingsChanged();});}
  {const s=document.getElementById("setEnc");if(s)s.addEventListener("change",()=>{character.encumbrance=s.value;encSettingsChanged();});}
  {const b=document.getElementById("swCoinWeight");if(b)b.addEventListener("click",()=>{character.coinWeight=(character.coinWeight===false);b.classList.toggle("on",character.coinWeight!==false);encSettingsChanged();});}
  {const b=document.getElementById("btnCharUpdate");if(b)b.addEventListener("click",()=>{closeModal();openUpdateReview();});}
  document.getElementById("btnRulesTemplate").addEventListener("click",downloadRulesTemplates);
  document.getElementById("btnImportRules").addEventListener("click",()=>document.getElementById("fileRules").click());
  document.getElementById("fileRules").addEventListener("change",e=>{if(e.target.files.length)importRulesFiles(e.target.files);e.target.value="";});
  document.getElementById("btnExportSettings").addEventListener("click",()=>dl(new Blob([JSON.stringify({_type:"fieldbook-settings",settings,rules},null,2)],{type:"application/json"}),"fieldbook-settings.json"));
  document.getElementById("btnImportSettings").addEventListener("click",()=>document.getElementById("fileSettings").click());
  document.getElementById("fileSettings").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);
      if(p&&(p.settings||p.rules)){ if(p.settings)settings=Object.assign(settings,p.settings); if(p.rules&&typeof p.rules==="object"){rules=p.rules;reindexRules();recomputeDups();saveRulesCache();} }
      else { settings=Object.assign(settings,p); }
      applyTheme();saveSettings();refreshRulesUI();renderAll();closeModal();openSettings();
    }catch(err){alert("Not a valid settings file.")}};r.readAsText(f);e.target.value="";});
}
/* One line under the Size/Encumbrance selects: what you're carrying right now,
   against what this character can carry. Answers "what does this setting
   actually do to me" without leaving the modal. */
function encSettingsHint(){
  const st=encState(contributions());
  const carried=`Carrying ${fmtWt(st.carried)}`;
  if(st.mode==="none")return carried+`. Capacity would be ${fmtWt(st.cap)} (STR ${st.str} × 15, ${charSize()}); turn encumbrance on to apply it.`;
  return `${carried} of ${fmtWt(st.cap)} (STR ${st.str} × 15, ${charSize()}). ${encTierNote(st)}`;
}
function encSettingsChanged(){
  const h=document.getElementById("encHint");if(h)h.textContent=encSettingsHint();
  const s=document.getElementById("setSize");
  if(s&&s.options.length)s.options[0].textContent="From ancestry ("+(raceDefSize()||"Medium")+")";
  renderInventory();recompute();scheduleSave();
}
/* A pack that is loaded but could not be SAVED is the one state the loaded-data
   list can't show on a row: the entry is there, it just won't come back. Say it
   above the list, in red, rather than letting a reload quietly undo the import. */
function rulesCacheWarning(){return rulesCacheError||"";}
function rulesStatusText(){
  const k=(rules.keywords||[]).length,f=(rules.features||[]).length,i=(rules.items||[]).length,s=(rules.spells||[]).length,r=(rules.races||[]).length,c=(rules.classes||[]).length,t=(rules.tables||[]).length;
  return (k+f+i+s+r+c+t)?`Loaded${rules.name?" “"+rules.name+"”":""}: ${r} races · ${c} classes · ${k} keywords · ${f} traits · ${i} items · ${s} spells${t?" · "+t+" tables":""}.`:"No rules loaded.";
}
function updateRulesStatus(msg,cls){const el=document.getElementById("rulesStatus");if(el){el.textContent=msg||rulesStatusText();el.className="status "+(cls||"");}}
/* renderNotes is here because notes run through highlight() too — editing the
   glossary changes how every note reads. */
function refreshRulesUI(){renderGloss();renderFeatures();renderInventory();renderSpells();renderClassRace();renderTables();renderNotes();renderAllRT();}
const RULE_CATS=["keywords","features","items","spells","races","classes","feats","backgrounds","subclasses","tables"];
/* display names for a category — one map, used by both the group summary and
   the headings in the loaded-data list */
const CAT_NAMES={keywords:"Glossary",features:"Traits",items:"Items",spells:"Spells",races:"Species",classes:"Classes",feats:"Feats",backgrounds:"Backgrounds",subclasses:"Subclasses",tables:"Tables"};
function catName(c){return CAT_NAMES[c]||c;}
function loadedRulesGroups(){
  const groups={};
  RULE_CATS.forEach(cat=>(rules[cat]||[]).forEach(e=>{
    const isFile=!!e._file, label=e._file||(e._source||"Unknown");
    const key=(isFile?"f:":"s:")+label;
    if(!groups[key])groups[key]={key,label,isFile,source:e._source||"",rulebook:!!e._rulebook,dataVersion:e._dataVersion||"",count:0,cats:{}};
    groups[key].count++;groups[key].cats[cat]=(groups[key].cats[cat]||0)+1;
    if(e._rulebook)groups[key].rulebook=true;
    if(e._dataVersion)groups[key].dataVersion=e._dataVersion;
  }));
  return Object.values(groups).sort((a,b)=>a.label.localeCompare(b.label));
}
/* which heading a pack files under: a whole-system rulebook, its single
   category, or Mixed when it spans several */
function rulesBucket(g){
  if(g.rulebook)return "rulebook";
  const ks=Object.keys(g.cats);
  return ks.length===1?ks[0]:"mixed";
}
function removeRulesGroup(key){
  const g=loadedRulesGroups().find(x=>x.key===key);if(!g)return;
  RULE_CATS.forEach(cat=>{if(!rules[cat])return;rules[cat]=rules[cat].filter(e=> g.isFile ? e._file!==g.label : (e._file?true:(e._source||"Unknown")!==g.label));});
  /* drop a source's `requires` once none of its entries are left, so the
     persisted object doesn't accumulate declarations for packs that are gone */
  if(rules.requires)Object.keys(rules.requires).forEach(src=>{
    if(!RULE_CATS.some(c=>(rules[c]||[]).some(e=>(e._source||"")===src)))delete rules.requires[src];
  });
  reindexRules();recomputeDups();saveRulesCache();refreshRulesUI();renderAll();renderRulesData();updateRulesStatus(rulesStatusText(),"ok");
}
/* Unload every rules pack. Destructive and irreversible without re-importing,
   so it always confirms — and it says characters are safe, because "clear data"
   reads like it might delete them. It doesn't: resetRules() only touches the
   shared rules pool, never `character`. */
function clearAllRules(){
  const packs=loadedRulesGroups().length;
  if(!packs){updateRulesStatus("Nothing loaded to clear.","");return false;}
  const what=RULE_CATS.map(c=>{const n=(rules[c]||[]).length;return n?`${n} ${catName(c).toLowerCase()}`:null;}).filter(Boolean).join(", ");
  if(!confirm(`Unload all rules data?\n\nThis removes ${packs} pack${packs===1?"":"s"} — ${what}.\n\nYour characters are NOT affected, but anything they reference from these packs will stop auto-filling until you import again.`))return false;
  resetRules();saveRulesCache();refreshRulesUI();renderRulesData();renderAll();
  updateRulesStatus("Rules cleared.","");
  return true;
}
/* Is a loaded pack's content older than the build expects?

   DATA_VERSIONS records the release in which each system's data last changed,
   so this answers the question players actually have after updating the app:
   "do I need to re-download the rules too?" A system whose data did NOT change
   keeps its old version, so nobody is nagged to re-import a pack that is still
   correct.

   Unknown (an old pack from before stamping, or homebrew) is NOT stale — we
   have no evidence either way, and a false alarm on someone's own content is
   worse than staying quiet. */
function dataStatus(g){
  const want=(typeof DATA_VERSIONS!=="undefined"&&DATA_VERSIONS[g.source])||"";
  if(!want||!g.dataVersion)return {state:"unknown"};
  const c=cmpVer(g.dataVersion,want);
  if(c<0)return {state:"stale",have:g.dataVersion,want};
  return {state:"current",have:g.dataVersion};
}
function dataStatusHTML(g){
  const st=dataStatus(g);
  if(st.state==="stale")
    return ` <span class="chip warn" title="This pack is from v${esc(st.have)}; this version of Fieldbook ships v${esc(st.want)}. Re-import it from the latest release.">update available · v${esc(st.have)}</span>`;
  if(st.state==="current")return ` <span class="rd-src" title="Up to date with this version of Fieldbook.">v${esc(st.have)}</span>`;
  return "";
}
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

