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
    <div class="toggle"><div><div class="t-lbl">Colour current HP</div><div class="t-sub">Amber at half your maximum, red at a quarter.</div></div><button class="switch ${character.hpColor!==false?"on":""}" id="swHpColor"></button></div>
    <div class="field"><label class="f">Hit Dice display</label>
      <div class="seg" id="segHdStyle">
        ${[["full","Full"],["condensed","Condensed"],["dice","Dice"]].map(([v,l])=>
          `<button data-hdstyle="${v}" class="${hdStyle()===v?"on":""}">${l}</button>`).join("")}
      </div>
      <p class="hint">Full boxes each die size like a stat; Condensed is one tight line per size; Dice draws every die as a token you tap to spend. Only Full and Condensed let you mark a die spent without healing.</p></div>
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
  {const b=document.getElementById("swHpColor");if(b)b.addEventListener("click",()=>{character.hpColor=(character.hpColor===false);b.classList.toggle("on",character.hpColor!==false);renderHP();scheduleSave();});}
  {const g=document.getElementById("segHdStyle");if(g)g.addEventListener("click",e=>{const b=e.target.closest("[data-hdstyle]");if(!b)return;character.hdStyle=b.dataset.hdstyle;g.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));renderHitDice();scheduleSave();});}
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
function refreshRulesUI(){renderRulesSections();renderGloss();renderFeatures();renderInventory();renderSpells();renderClassRace();renderTables();renderNotes();renderAllRT();}
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
