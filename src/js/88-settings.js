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
  {k:"backup",    title:"Characters & backup",open:false},
  /* Attribution for the game-icons.net emblems. Folded shut by default — it is
     a legal notice, not a control — but it must be IN THE APP, because
     fieldbook.html is routinely shared as a lone file that no README follows. */
  {k:"credits",   title:"Credits & licences",open:false}
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
  return `<div class="fgroup"><div class="fghead" data-setsec="${esc(k)}" role="button" tabindex="0" aria-expanded="${open?"true":"false"}">`+
    `<svg class="fcaret ${open?"":"c"}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>`+
    `<span class="fgname">${esc(d.title)}</span>${badge?`<span class="fgcount">${esc(badge)}</span>`:""}</div>`+
    `<div class="setsec-body" data-setsecbody="${esc(k)}"${open?"":` style="display:none"`}>${body}</div></div>`;
}
/* ---- the sidebar and its pages (#107) ----
   Six categories beside one page at a time, replacing the folding sections
   (spec src/docs/specs/2026-10-16-settings-dialog-design.md). `scope:"char"`
   pages exist only while a character is open. Icons are line drawings in the
   tab bar's style (24px, stroked), written here, not game-icons artwork, so
   they need no attribution. */
const SET_PAGES=[
  {k:"appearance",title:"Appearance",   scope:"app",
   icon:`<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>`},
  {k:"display",   title:"Sheet display",scope:"char",
   icon:`<path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>`},
  {k:"carrying",  title:"Carrying",     scope:"char",
   icon:`<path d="M12 4v16M7.5 20h9M5 7.5h14"/><path d="M5 7.5l-2.5 6a2.5 2.5 0 0 0 5 0z"/><path d="M19 7.5l-2.5 6a2.5 2.5 0 0 0 5 0z"/>`},
  {k:"rules",     title:"Rules data",   scope:"app",
   icon:`<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6"/><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>`},
  {k:"backup",    title:"Backup",       scope:"app",
   icon:`<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>`},
  {k:"credits",   title:"Credits",      scope:"app",
   icon:`<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.6a3.4 3.4 0 1 0 0 4.8"/>`}
];
function setPageDef(k){return SET_PAGES.find(p=>p.k===k)||null;}
function setPagesFor(hasChar){return SET_PAGES.filter(p=>hasChar||p.scope!=="char");}
/* the page to open: the remembered one while it is shown, else Appearance — so a
   character page remembered from a sheet never opens with no character */
function setPageOf(stored,hasChar){const p=setPagesFor(hasChar).find(x=>x.k===stored);return p?p.k:"appearance";}
/* ↑/↓ wrap, Home/End jump; `keys` are the SHOWN pages, so a hidden character
   page is never stepped onto */
function setPageStep(keys,cur,key){
  const i=keys.indexOf(cur);if(i<0)return cur;
  if(key==="ArrowDown")return keys[(i+1)%keys.length];
  if(key==="ArrowUp")return keys[(i-1+keys.length)%keys.length];
  if(key==="Home")return keys[0];
  if(key==="End")return keys[keys.length-1];
  return cur;
}
function setNavHTML(pages,active,badges){
  const b=badges||{};let n=0;
  return `<div class="set-nav" role="tablist" aria-orientation="vertical" aria-label="Settings">`+pages.map((p,i)=>{
    const on=p.k===active,first=p.scope==="char"&&(n++===0),last=p.scope==="char"&&(!pages[i+1]||pages[i+1].scope!=="char");
    return (first?`<div class="set-cap" aria-hidden="true">This character</div>`:"")+
      `<button type="button" class="set-tab" role="tab" id="setTab-${esc(p.k)}" data-setpage="${esc(p.k)}" aria-controls="setPage-${esc(p.k)}" aria-selected="${on?"true":"false"}" tabindex="${on?"0":"-1"}" aria-label="${esc(p.title)}" title="${esc(p.title)}">`+
      `<svg class="set-ico" viewBox="0 0 24 24" aria-hidden="true">${p.icon}</svg><span class="set-tlbl">${esc(p.title)}</span>`+
      (Object.prototype.hasOwnProperty.call(b,p.k)?`<span class="set-tbadge" data-setbadge="${esc(p.k)}">${b[p.k]}</span>`:"")+`</button>`+
      (last?`<div class="set-sep" aria-hidden="true"></div>`:"");
  }).join("")+`</div>`;
}
function setPageHTML(k,body,opts){
  const d=setPageDef(k);if(!d)return "";const o=opts||{};
  return `<section class="set-page" role="tabpanel" id="setPage-${esc(k)}" aria-labelledby="setTab-${esc(k)}" data-setpagebody="${esc(k)}"${o.active?"":" hidden"}>`+
    `<div class="set-ptitle">${esc(d.title)}</div>${o.sub?`<p class="set-psub">${esc(o.sub)}</p>`:""}${body}</section>`;
}
function setGroupHTML(title,body){return `<div class="set-grp"><div class="set-grp-h">${esc(title)}</div>${body}</div>`;}
/* one row: name and help on the left, the control on the right. `inline` keeps a
   switch beside its name on a narrow page; anything else drops below it there.
   name, help and control are MARKUP: the caller escapes what is dynamic. */
function setRowHTML(name,help,control,inline){
  return `<div class="set-row${inline?" set-inline":""}"><div class="set-row-txt"><div class="t-lbl">${name}</div>${help?`<div class="t-sub">${help}</div>`:""}</div><div class="set-row-ctl">${control}</div></div>`;
}
/* the Rules data tab's count, and a dot while a newer copy of a loaded pack is
   out; renderRulesData() keeps it current */
function rulesNavBadgeHTML(){
  const n=rulesEntryCount(),up=loadedRulesGroups().some(g=>dataStatus(g).state==="update");
  return (n?`<span class="set-cnt" title="${esc(rulesBadge())}">${n}</span>`:"")+(up?`<span class="set-dot" title="Newer rules data is out"></span>`:"");
}
function rulesEntryCount(){return RULE_CATS.reduce((a,c)=>a+((rules[c]||[]).length),0);}
/* the "Rules data" header badge; renderRulesData() keeps it current after the modal opens */
function rulesBadge(){
  const n=rulesEntryCount();
  const up=loadedRulesGroups().some(g=>dataStatus(g).state==="update");
  return (n?n+" entries":"none loaded")+(up?" · update":"");
}
/* Settings → Credits & licences: each loaded pack's own terms (#83). A pack
   carries them as `license` (an SPDX id) and `attribution` (plain text). */
const LICENSE_URLS={"CC-BY-4.0":"https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-3.0":"https://creativecommons.org/licenses/by-sa/3.0/","MIT":"https://opensource.org/license/mit"};
function rulesCreditsHTML(){
  const cr=(rules.credits&&typeof rules.credits==="object"&&!Array.isArray(rules.credits))?rules.credits:{};
  const str=v=>typeof v==="string"?v:"";
  const rows=Object.keys(cr).sort().map(l=>{
    const c=cr[l]&&typeof cr[l]==="object"?cr[l]:{};
    const lic=str(c.license),url=LICENSE_URLS[lic];
    const licHTML=lic?(url?` Licence: <a href="${esc(url)}" target="_blank" rel="noopener">${esc(lic)}</a>.`:` Licence: ${esc(lic)}.`):"";
    return `<p class="hint"><b>${esc(str(c.title)||l)}</b>${str(c.attribution)?" — "+esc(str(c.attribution)):""}${licHTML}</p>`;
  });
  return rows.length?`<div class="field"><label class="f">Rules data you have loaded</label>${rows.join("")}</div>`:"";
}
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
    <div class="toggle"><div><div class="t-lbl">Icon tabs</div><div class="t-sub">Show the tab bar as icons instead of words, on every screen size. Narrow screens do this anyway.</div></div><button class="switch ${settings.tabIcons?"on":""}" id="swTabIcons"></button></div>
    <div class="toggle"><div><div class="t-lbl">Tap outside to close dialogs</div><div class="t-sub">Leave this off so a stray click, or a tap to hide your phone's keyboard, can't close a dialog and lose what you typed. ×, Cancel and Esc always close.</div></div><button class="switch ${settings.backdropClose===true?"on":""}" id="swBackdrop" role="switch" aria-checked="${settings.backdropClose===true?"true":"false"}" aria-label="Tap outside to close dialogs"></button></div>`;
  const secCharacter=activeId?`
    <div class="g2"><div class="field"><label class="f">Size</label>
        <select id="setSize">${sizeOptionsHTML(character.size)}</select></div>
      <div class="field"><label class="f">Encumbrance</label>
        <select id="setEnc">${[["none","Off — show weight only"],["standard","Standard (capacity, push/drag)"],["variant","Variant (encumbered tiers)"]].map(([v,l])=>`<option value="${esc(v)}"${encMode()===v?" selected":""}>${esc(l)}</option>`).join("")}</select></div></div>
    <p class="hint" id="encHint">${esc(encSettingsHint())}</p>
    <div class="toggle"><div><div class="t-lbl">Coins count as weight</div><div class="t-sub">50 coins to the pound, the way the rules have it.</div></div><button class="switch ${character.coinWeight!==false?"on":""}" id="swCoinWeight"></button></div>
    <div class="toggle"><div><div class="t-lbl">Colour current HP</div><div class="t-sub">Amber at half your maximum, red at a quarter.</div></div><button class="switch ${character.hpColor!==false?"on":""}" id="swHpColor"></button></div>
    <div class="toggle"><div><div class="t-lbl">Trackers</div><div class="t-sub">Show the Trackers card on the Journal tab. Hiding it keeps everything you've counted.</div></div><button class="switch ${showTrackers(character)?"on":""}" id="swTrackers"></button></div>
    <div class="field"><label class="f">Skills display</label>
      <div class="seg" id="segStatStyle">
        ${[["classic","Classic"],["grouped","By ability"]].map(([v,l])=>
          `<button data-statstyle="${esc(v)}" class="${statStyle()===v?"on":""}">${l}</button>`).join("")}
      </div>
      <p class="hint">Classic keeps Ability Scores and Skills as two cards, skills listed A to Z. By ability stacks each ability with its saving throw and the skills it governs, and folds the Skills card away. Display only — every number means the same thing either way.</p></div>
    <div class="field"><label class="f">Hit Dice display</label>
      <div class="seg" id="segHdStyle">
        ${[["full","Full"],["condensed","Condensed"],["dice","Dice"]].map(([v,l])=>
          `<button data-hdstyle="${esc(v)}" class="${hdStyle()===v?"on":""}">${l}</button>`).join("")}
      </div>
      <p class="hint">Full boxes each die size like a stat; Condensed is one tight line per size; Dice draws every die as a token you tap to spend. Only Full and Condensed let you mark a die spent without healing.</p></div>
    <div class="field" style="margin-top:12px"><label class="f">Rules updates</label>
      <p class="hint">Last checked against <b>v${esc(character.appVersion||"—")}</b>; you're on v${esc(APP_VERSION)}. Compare this sheet against your loaded rules and update what you choose. A backup is always saved first.</p>
      <div class="m-actions" style="justify-content:flex-start"><button class="tbtn" id="btnCharUpdate">Check for rules updates</button></div>
    </div>`:"";
  const secRules=`
    <div class="field"><label class="f">Rules sources</label>
      <p class="hint">Import the rules data zip, or one or more JSON files — split by category (conditions, traits, items, spells), or point to a manifest that <b>include</b>s them. All sources merge; later ones win on name clashes. <b>Fetch all</b> needs a connection: each source it reaches replaces what it loaded last time, anything it can't reach keeps what it had, and files you imported are never touched. What is loaded stays saved for offline use.</p>
      <div id="srcList"></div>
      <div style="display:flex;gap:7px;margin-top:4px"><input id="newSrc" placeholder="https://…/spells.json"><button class="tbtn" id="addSrc">Add</button></div>
      <div class="m-actions" style="justify-content:flex-start;margin-top:8px">
        <button class="tbtn" id="btnFetchRules">Fetch all</button>
        <button class="tbtn" id="btnImportRules">Import files</button>
        <button class="tbtn" id="btnRulesTemplate">Get templates</button>
        <button class="tbtn danger" id="btnClearRules" style="margin-left:auto">Clear all</button>
      </div>
      <div class="status ${((rules.keywords||[]).length+(rules.features||[]).length+(rules.items||[]).length+(rules.spells||[]).length)?"ok":""}" id="rulesStatus">${esc(rulesStatusText())}</div>
      <input type="file" id="fileRules" accept="application/json,.json,application/zip,application/x-zip-compressed,.zip" multiple class="hidefile">
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
    <div class="status" id="setImpStatus"></div>
    <p class="hint" style="margin-top:6px">Export saves your appearance settings <b>and</b> all loaded rules data to one JSON file. Import restores the settings, and asks before it replaces the rules you have loaded.</p>`;
  /* CC BY 3.0 obliges us to name the artists, name and link the licence, and say
     that the work was changed — hence the last sentence, which is not decorative.
     ICON_ARTISTS is generated from the icons actually vendored (05-icons.js), so
     this list cannot drift from what ships. The links are dead offline; the
     artists' names and the licence name are plain text on purpose. */
  /* Each <p> is ONE line on purpose: .m-body p is white-space:pre-wrap, so a
     wrapped source line renders its newline and indentation literally. */
  const secCredits=`
    <p class="hint">Fieldbook itself is MIT-licensed. It includes one third-party work:</p>
    <div class="field"><label class="f">Icons</label>
      <p class="hint">The emblems beside each class, ${raceTerm().toLowerCase()} and background, and the crossed swords on the combat button, are from <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>, by ${ICON_ARTISTS.map(esc).join(", ")}. Used under <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. Each icon has been changed: its background square was removed and its colour now follows your theme.</p></div>
    ${rulesCreditsHTML()}
    <div class="field"><label class="f">Rules content</label>
      <p class="hint">Rules data comes separately from the app, as the rules data zip or files you supply. Each pack keeps its own terms; the ones you have loaded are listed above.</p></div>`;
  openModal("Settings",`<div id="setSections">`+
    setSecHTML("appearance",secAppearance)+
    (secCharacter?setSecHTML("character",secCharacter,character.name||"unnamed"):"")+
    setSecHTML("rules",secRules,rulesBadge())+
    setSecHTML("backup",secBackup)+
    setSecHTML("credits",secCredits)+
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
  /* #106: app-wide, off by default — read by the backdrop listener in 80-modal-forms.js */
  document.getElementById("swBackdrop").addEventListener("click",e=>{settings.backdropClose=settings.backdropClose!==true;const on=settings.backdropClose;e.currentTarget.classList.toggle("on",on);e.currentTarget.setAttribute("aria-checked",on?"true":"false");saveSettings();});
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
  {const b=document.getElementById("swTrackers");if(b)b.addEventListener("click",()=>{character.showTrackers=!showTrackers(character);b.classList.toggle("on",character.showTrackers);renderTrackers();scheduleSave();});}
  /* renderAll(), not buildStats(): the rebuild blanks the six score inputs, and
     only renderAll refills them from [data-path] and then repaints through
     recompute(). Calling the builder alone leaves blank boxes and a wall of +0. */
  {const g=document.getElementById("segStatStyle");if(g)g.addEventListener("click",e=>{const b=e.target.closest("[data-statstyle]");if(!b)return;character.statStyle=b.dataset.statstyle;g.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));renderAll();scheduleSave();});}
  {const g=document.getElementById("segHdStyle");if(g)g.addEventListener("click",e=>{const b=e.target.closest("[data-hdstyle]");if(!b)return;character.hdStyle=b.dataset.hdstyle;g.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));renderHitDice();scheduleSave();});}
  {const b=document.getElementById("btnCharUpdate");if(b)b.addEventListener("click",()=>{closeModal();openUpdateReview();});}
  document.getElementById("btnRulesTemplate").addEventListener("click",downloadRulesTemplates);
  document.getElementById("btnImportRules").addEventListener("click",()=>document.getElementById("fileRules").click());
  document.getElementById("fileRules").addEventListener("change",e=>{if(e.target.files.length)importRulesFiles(e.target.files);e.target.value="";});
  document.getElementById("btnExportSettings").addEventListener("click",()=>dl(new Blob([JSON.stringify({_type:"fieldbook-settings",settings,rules},null,2)],{type:"application/json"}),"fieldbook-settings.json"));
  document.getElementById("btnImportSettings").addEventListener("click",()=>document.getElementById("fileSettings").click());
  document.getElementById("fileSettings").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let p=null;try{p=JSON.parse(r.result);}catch(err){}importSettings(p);};r.readAsText(f);e.target.value="";});
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
/* ================= Import settings (#70) =================
   Export settings has always written {_type:"fieldbook-settings", settings,
   rules}: the appearance settings AND the whole rules pool as it stood that
   day. A settings file from before the wrapper is the bare settings object, and
   that still imports.

   Import used to assign the file's `rules` wholesale, unasked and unvalidated,
   so every pack imported or fetched since the export vanished without a word.
   Now the file's pool is rebuilt through mergeRules() (poolFromExport), and
   replacing what is loaded is the player's call. There are three answers, so
   it is a window like the character-import clash, not a confirm(): OK/Cancel
   cannot say "import the settings but keep my rules" without making Cancel
   import something. Nothing is lost, so nothing is asked, when the file brings
   no rules or none are loaded yet. */
const SETTINGS_KEYS=["skin","theme","autoload","rough","rulesSources","rulesUrl","setCollapse","rulesCollapse","tabIcons","backdropClose","setPage"];
/* What boot does to settings from an older build, shared with Import settings
   so an old file arrives in the same shape: the first builds' single `rulesUrl`
   joins the sources list. True when that changed something worth saving. */
function foldLegacySettings(){
  if(!Array.isArray(settings.rulesSources))settings.rulesSources=[];
  if(!settings.rulesUrl)return false;
  if(!settings.rulesSources.includes(settings.rulesUrl))settings.rulesSources.push(settings.rulesUrl);
  delete settings.rulesUrl;
  return true;
}
/* The parsed file -> {settings, pool, used, skipped}, or null when it is not a
   settings file at all. A bare object must carry some setting, or a rules pack
   or character picked by mistake would be written into settings key by key. */
function readSettingsFile(p){
  const isObj=o=>!!o&&typeof o==="object"&&!Array.isArray(o);
  if(!isObj(p))return null;
  const wrapped=p._type==="fieldbook-settings"||!!p.settings||!!p.rules;
  if(!wrapped&&!SETTINGS_KEYS.some(k=>k in p))return null;
  const set=wrapped?(isObj(p.settings)?p.settings:null):p;
  const built=(wrapped&&p.rules)?poolFromExport(p.rules):{pool:null,used:0,skipped:0};
  if(!set&&!built.used)return null;
  return {settings:set,pool:built.used?built.pool:null,used:built.used,skipped:built.skipped};
}
function importSettings(p){
  let imp=null;try{imp=readSettingsFile(p);}catch(e){}
  if(!imp){alert("Not a valid settings file.");return;}
  if(!imp.pool||!rulesEntryCount()){finishSettingsImport(imp,!!imp.pool);return;}
  askSettingsImport(imp);
}
function rulesPackSummary(groups){
  const n=groups.reduce((a,g)=>a+g.count,0);
  return `${groups.length} pack${groups.length===1?"":"s"}, ${n} entr${n===1?"y":"ies"}`;
}
/* The question names both sides, each pack with its count and data version,
   then what replacing would lose: every loaded pack the file does not have, and
   any it would put back an older copy of. Each <p> is one source line, because
   .m-body p is white-space:pre-wrap. */
function settingsImportQuestionHTML(imp){
  const file=loadedRulesGroups(imp.pool),now=loadedRulesGroups();
  const inFile={};file.forEach(g=>{inFile[g.key]=g;});
  const list=gs=>gs.map(g=>g.label+" ("+g.count+(g.dataVersion?", v"+g.dataVersion:"")+")").join(" · ");
  const lost=now.filter(g=>!inFile[g.key]);
  const older=now.filter(g=>{const f=inFile[g.key];return f&&f.dataVersion&&g.dataVersion&&cmpDataVer(f.dataVersion,g.dataVersion)<0;});
  const loss=[];
  if(lost.length)loss.push(`unloads ${lost.length===1?"1 pack":lost.length+" packs"} the file doesn't have: ${lost.map(g=>g.label).join(", ")}`);
  if(older.length)loss.push(`puts back an older copy of ${older.map(g=>g.label+" (v"+inFile[g.key].dataVersion+"; v"+g.dataVersion+" is loaded)").join(", ")}`);
  const skipped=imp.skipped?` ${imp.skipped} entr${imp.skipped===1?"y":"ies"} in it couldn't be loaded and would be left out.`:"";
  return `<p>This settings file also carries rules data, saved when it was exported. Import the settings and keep the rules you have loaded now, or replace them with the file's copy.</p>`+
    `<div class="field"><label class="f">In the file</label><p class="hint"><b>${esc(rulesPackSummary(file))}</b>: ${esc(list(file))}.${esc(skipped)}</p></div>`+
    `<div class="field"><label class="f">Loaded now</label><p class="hint"><b>${esc(rulesPackSummary(now))}</b>: ${esc(list(now))}.</p></div>`+
    (loss.length?`<p class="status err">Replacing ${esc(loss.join(", and "))}.</p>`:"")+
    `<p class="hint">Your characters are not affected either way.</p>`+
    `<div class="m-actions" style="flex-wrap:wrap;gap:8px"><button class="tbtn" id="setImpCancel">Cancel</button><button class="tbtn primary" id="setImpKeep">Keep my rules</button><button class="tbtn danger" id="setImpReplace">Replace my rules</button></div>`;
}
function askSettingsImport(imp){
  openModal("Import settings",settingsImportQuestionHTML(imp));
  const back=()=>{openSettings();settingsImportStatus("Import cancelled. Nothing changed.","");};
  /* ✕, Escape and (when Settings allows it, #106) a click outside go back to
     Settings too, having changed nothing */
  setDismissGuard(null,back);
  document.getElementById("setImpCancel").addEventListener("click",()=>{closeModal();back();});
  document.getElementById("setImpKeep").addEventListener("click",()=>finishSettingsImport(imp,false));
  document.getElementById("setImpReplace").addEventListener("click",()=>finishSettingsImport(imp,true));
}
/* Apply the answer, redraw everything that shows settings or rules, and say
   what happened beside the Import button: the rules status line sits in the
   Rules data section, which is usually folded shut. Both writes report a
   refusal there (storage rule); the cache's arrives asynchronously. */
function finishSettingsImport(imp,replace){
  const had=rulesEntryCount();
  const swap=!!(replace&&imp.pool);
  const what=imp.pool?rulesPackSummary(loadedRulesGroups(imp.pool)):"";
  if(imp.settings){Object.assign(settings,imp.settings);foldLegacySettings();}
  const setErr=imp.settings?saveSettings():"";
  let saving=Promise.resolve("");
  if(swap){rules=imp.pool;reindexRules();recomputeDups();saving=saveRulesCache();}
  applyTheme();refreshRulesUI();renderAll();renderHome();
  closeModal();openSettings();
  const miss=swap?missingSummary():"";
  let msg=!imp.settings?"This file carries no settings.":
    setErr?`Settings imported for this session only: ${setErr}, so they won't be there next time you open Fieldbook.`:"Settings imported.";
  if(swap)msg+=(had?" Your rules were replaced with the file's: ":" Loaded the rules data it carries: ")+what+"."+
    (imp.skipped?` ${imp.skipped} entr${imp.skipped===1?"y":"ies"} in it couldn't be loaded and were left out.`:"")+miss;
  else if(imp.pool)msg+=` Your loaded rules are unchanged; the file's copy (${what}) was not loaded.`;
  else if(imp.skipped)msg+=" The rules data in it couldn't be read, so your loaded rules are unchanged.";
  else msg+=" It carries no rules data, so your loaded rules are unchanged.";
  const cls=(setErr||(swap&&(imp.skipped||miss))||(!imp.pool&&imp.skipped))?"err":"ok";
  settingsImportStatus(msg,cls);
  return saving.then(err=>{if(err){renderRulesData();settingsImportStatus(msg+" "+err,"err");}return err;});
}
function settingsImportStatus(msg,cls){const el=document.getElementById("setImpStatus");if(el){el.textContent=msg;el.className="status "+(cls||"");}}
/* A pack that is loaded but could not be SAVED is the one state the loaded-data
   list can't show on a row: the entry is there, it just won't come back. Say it
   above the list, in red, rather than letting a reload quietly undo the import. */
function rulesCacheWarning(){return rulesCacheError||"";}
function rulesStatusText(){
  const k=(rules.keywords||[]).length,f=(rules.features||[]).length,i=(rules.items||[]).length,s=(rules.spells||[]).length,r=(rules.races||[]).length,c=(rules.classes||[]).length,t=(rules.tables||[]).length;
  return (k+f+i+s+r+c+t)?`Loaded${rules.name?" “"+rules.name+"”":""}: ${r} races · ${c} classes · ${k} keywords · ${f} traits · ${i} items · ${s} spells${t?" · "+t+" tables":""}.`:"No rules loaded.";
}
function updateRulesStatus(msg,cls){const el=document.getElementById("rulesStatus");if(el){el.textContent=msg||rulesStatusText();el.className="status "+(cls||"");}}
/* renderNotes and renderJournal are here because notes and journal pages run
   through highlight() too — editing the glossary changes how every one reads.
   An open journal editor is left alone (renderJournal()). */
function refreshRulesUI(){renderRulesSections();renderGloss();renderFeatures();renderInventory();renderSpells();renderClassRace();renderTables();renderNotes();renderJournal();renderAllRT();}
const RULE_CATS=["keywords","features","items","spells","races","classes","feats","backgrounds","subclasses","tables"];
/* display names for a category — one map, used by both the group summary and
   the headings in the loaded-data list */
const CAT_NAMES={keywords:"Glossary",features:"Traits",items:"Items",spells:"Spells",races:"Species",classes:"Classes",feats:"Feats",backgrounds:"Backgrounds",subclasses:"Subclasses",tables:"Tables"};
function catName(c){return CAT_NAMES[c]||c;}
/* `pool` defaults to the loaded one; Import settings passes a settings file's */
function loadedRulesGroups(pool){
  const p=pool||rules,groups={};
  RULE_CATS.forEach(cat=>(p[cat]||[]).forEach(e=>{
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
  prunePackMeta();
  reindexRules();recomputeDups();saveRulesCache();refreshRulesUI();renderAll();renderRulesData();updateRulesStatus(rulesStatusText(),"ok");
}
/* drop a source's `requires` and credits once none of its entries are left,
   so the persisted pool doesn't accumulate them for packs that are gone */
function prunePackMeta(){
  ["requires","credits"].forEach(k=>{
    const m=rules[k];if(!m||typeof m!=="object")return;
    Object.keys(m).forEach(src=>{if(!RULE_CATS.some(c=>(rules[c]||[]).some(e=>(e._source||"")===src)))delete m[src];});
  });
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

   Unknown (a pack with no stamped version at all, or one that doesn't parse)
   is NOT stale — we have no evidence either way, and a false alarm on someone's
   own content is worse than staying quiet. A pack WITH a version but no baseline
   to compare it to — a private pack, or an old pack a build after #85 no longer
   ships a baseline for — is "known": its version, shown quietly, no alarm either
   way.

   A pack the app is happy with can still be behind a data-only release (#83):
   that is "update", quiet, because a data release is optional. */
function dataStatus(g){
  const have=g.dataVersion||"";
  const want=(typeof DATA_VERSIONS!=="undefined"&&DATA_VERSIONS[g.source])||"";
  const upd=dataUpdateFor(g);
  if(!have||!parseDataVer(have))return {state:"unknown"};
  /* no baseline in this build and no newer copy known: a private pack, or a pack
     an older Fieldbook shipped (#85). Its version, and no claim either way. */
  if(!want&&!upd)return {state:"known",have};
  if(want&&cmpDataVer(have,want)<0)return {state:"stale",have,want};
  if(upd&&cmpDataVer(have,upd.version)<0)return {state:"update",have,want:upd.version,release:dataUpdate.release};
  return {state:"current",have};
}
/* the newer copy the data-release check found for a pack loaded from a file of
   the same system and file name, or null */
function dataUpdateFor(g){
  if(!dataUpdate||!g||!g.isFile)return null;
  return (dataUpdate.packs||[]).find(p=>p.system===g.source&&p.file===g.label)||null;
}
function dataStatusHTML(g){
  const st=dataStatus(g);
  if(st.state==="stale")
    return ` <span class="chip warn" title="This pack is from v${esc(st.have)}; this version of Fieldbook ships v${esc(st.want)}. Re-import it from the latest release.">update available · v${esc(st.have)}</span>`;
  if(st.state==="update")
    return ` <span class="rd-src" title="${esc("Rules data "+st.release+" has a newer copy of this pack, v"+st.want+". Download it from the release page and import it.")}">v${esc(st.have)} · v${esc(st.want)} out</span>`;
  if(st.state==="known")return ` <span class="rd-src" title="This pack's version.">v${esc(st.have)}</span>`;
  if(st.state==="current")return ` <span class="rd-src" title="Up to date with this version of Fieldbook.">v${esc(st.have)}</span>`;
  return "";
}
