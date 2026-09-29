/* ================= character library + home ================= */
function skinForSystem(sys){return sys==="dnd"?"classic":"humblewood";}
function systemForSkin(skin){return skin==="classic"?"dnd":"humblewood";}
/* Every path that replaces the open character asks leaveCharacterOk() first
   (70-persistence.js), and returns false, changing nothing, when told No. */
function loadCharById(id){
  /* before the read: tapping the open character's own card reads back what the
     flush just wrote */
  if(!leaveCharacterOk())return false;
  let raw;try{raw=localStorage.getItem(charKey(id));}catch(e){}
  if(!raw)return false;
  try{character=migrate(JSON.parse(raw));}catch(e){return false;}
  activeId=character.id||id;
  settings.skin=skinForSystem(character.system);saveSettings();applyTheme();
  renderAll();hideHome();
  /* the sheet on screen is the one in storage, so a warning about the character
     just left (or given up) no longer applies */
  showSaveResult("");
  /* after the sheet is on screen, so the prompt has context behind it */
  maybePromptUpdate();
  return true;
}
function newCharacter(name,system){
  if(!leaveCharacterOk())return false;
  const c=blankChar();c.system=(system==="dnd")?"dnd":"humblewood";c.name=name||"";c.glossary=seedGlossary();
  c.appVersion=APP_VERSION;   // safe here: runtime, long after 30-version.js has run
  character=c;activeId=c.id;
  /* as finishImport(): listed only once stored, and a refusal says so (#81) */
  let why="";try{localStorage.setItem(charKey(c.id),JSON.stringify(c));}catch(e){why=storageWhy(e);}
  if(!why)why=libTouch();
  settings.skin=skinForSystem(c.system);saveSettings();applyTheme();
  renderAll();hideHome();
  showSaveResult(why);
  return true;
}
/* Both return "" or why the library index couldn't be written (#81), and say so
   with alert(): the home screen they run on covers the save strip, and a toast
   fades. The blob goes only once the index stops listing it — the other order
   leaves a card that opens nothing. */
function deleteCharacter(id){
  const lib=libLoad();lib.index=lib.index.filter(x=>x.id!==id);if(lib.autoload===id)lib.autoload=null;
  const why=libSave(lib);
  if(why){alert("That character couldn't be deleted — "+why+". It is still in your library.");renderHome();return why;}
  try{localStorage.removeItem(charKey(id));}catch(e){}
  if(activeId===id)activeId=null;
  renderHome();return "";
}
function setAutoload(id){const lib=libLoad();lib.autoload=(lib.autoload===id)?null:id;const why=libSave(lib);renderHome();if(why)alert("Couldn't change which character opens first — "+why+".");return why;}
/* "" or why the old save could not be moved. The legacy key goes only once the
   copy AND its index entry have landed (#81); it used to go whatever happened,
   taking the only copy with it. */
function migrateOldChar(){
  const lib=libLoad();if(lib.index.length)return "";
  let old=null;try{const c=localStorage.getItem(K_CHAR);if(c)old=JSON.parse(c);}catch(e){}
  if(!old||!old.abilities)return "";
  const ch=migrate(old);if(!ch.id)ch.id=uid();ch.system=ch.system||"humblewood";if(!ch.name)ch.name="My Character";
  try{localStorage.setItem(charKey(ch.id),JSON.stringify(ch));}catch(e){return storageWhy(e);}
  lib.index.push({id:ch.id,name:ch.name,system:ch.system,updated:Date.now()});
  const why=libSave(lib);
  if(why){try{localStorage.removeItem(charKey(ch.id));}catch(e){}return why;}
  try{localStorage.removeItem(K_CHAR);}catch(e){}
  return "";
}
let homeForceSetup=false;
function showHome(){renderHome();document.getElementById("home").style.display="flex";}
function hideHome(){const h=document.getElementById("home");if(h)h.style.display="none";}
function fmtWhen(ts){if(!ts)return "";const d=new Date(ts),now=Date.now(),diff=(now-ts)/1000;if(diff<60)return "just now";if(diff<3600)return Math.floor(diff/60)+"m ago";if(diff<86400)return Math.floor(diff/3600)+"h ago";return d.toLocaleDateString();}
function renderHome(){
  const lib=libLoad();
  const noSettings=!localStorage.getItem(K_SET);
  const firstRun=noSettings||!lib.index.length;
  const showSetup=firstRun||homeForceSetup;
  // setup controls reflect current settings
  const setup=document.getElementById("homeSetup");
  setup.style.display=showSetup?"block":"none";
  document.getElementById("homeCog").style.display=firstRun?"none":"inline-flex";
  const back=document.getElementById("homeBack");if(back)back.style.display=activeId?"inline-flex":"none";
  const rs=document.getElementById("homeRulesStatus");if(rs)rs.textContent=(typeof rulesStatusText==="function")?rulesStatusText():"";
  if(typeof renderRulesData==="function")renderRulesData();
  syncHomeSetupControls();
  // character list
  const wrap=document.getElementById("homeChars");
  const items=lib.index.slice().sort((a,b)=>(b.updated||0)-(a.updated||0));
  if(!items.length){
    wrap.innerHTML=`<p class="hint" style="text-align:center;padding:10px 0">No characters yet. Create your first one below.</p>`;
  }else{
    wrap.innerHTML=items.map(m=>{
      const badge=m.system==="dnd"?"D&amp;D":"Humblewood";
      const auto=lib.autoload===m.id;
      /* behind = made before this app version, so the update tool has something
         to offer. "" (never stamped) counts as behind. */
      const behind=cmpVer(m.appVersion||"0.0.0",APP_VERSION)<0;
      const ver=`<span class="verbadge${behind?" old":""}" title="${esc(behind?"Last checked against v"+(m.appVersion||"an earlier version")+" — updates may be available":"Up to date with v"+APP_VERSION)}">v${esc(m.appVersion||"?")}</span>`;
      return `<div class="hcard">
        <button class="hcard-load" data-load="${esc(m.id)}"><span class="hcard-name">${esc(m.name||"Unnamed")}</span><span class="hcard-meta"><span class="sysbadge ${m.system==="dnd"?"dnd":"hbw"}">${badge}</span> ${ver} ${esc(fmtWhen(m.updated))}</span></button>
        <button class="hcard-star ${auto?"on":""}" data-autoload="${esc(m.id)}" title="${auto?"Autoload on":"Set as autoload"}">${auto?"★":"☆"}</button>
        <button class="icon danger" data-delchar="${esc(m.id)}" title="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>
      </div>`;
    }).join("");
  }
}
function syncHomeSetupControls(){
  document.querySelectorAll("#homeSkin button").forEach(b=>b.classList.toggle("on",b.dataset.skin===(settings.skin||"humblewood")));
  document.querySelectorAll("#homeMode button").forEach(b=>b.classList.toggle("on",b.dataset.th===settings.theme));
  const rt=document.getElementById("homeRough");if(rt)rt.classList.toggle("on",!!settings.rough);
}
function openNewCharacter(){
  openModal("New character",`
    <div class="field"><label class="f">Name</label><input id="ncName" placeholder="Character name" autocomplete="off"></div>
    <div class="field"><label class="f">System</label>
      <div class="seg" id="ncSys"><button type="button" data-sys="humblewood" class="on">Humblewood</button><button type="button" data-sys="dnd">D&amp;D</button></div>
      <p class="hint">Sets the sheet's look and wordmark — you can change it later in Settings. All loaded rules stay available either way.</p></div>
    <div class="m-actions"><button class="tbtn" id="ncCancel">Cancel</button><button class="tbtn primary" id="ncCreate">Create</button></div>`);
  let sys="humblewood";
  document.querySelectorAll("#ncSys button").forEach(b=>b.addEventListener("click",()=>{sys=b.dataset.sys;document.querySelectorAll("#ncSys button").forEach(x=>x.classList.toggle("on",x===b));}));
  document.getElementById("ncCancel").addEventListener("click",closeModal);
  document.getElementById("ncCreate").addEventListener("click",()=>{const nm=document.getElementById("ncName").value.trim();closeModal();newCharacter(nm,sys);});
}

/* ================= theme ================= */
function applyTheme(){
  let t=settings.theme;
  if(t==="system")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  document.documentElement.dataset.theme=t;
  document.documentElement.dataset.skin=settings.skin||"humblewood";
  document.documentElement.dataset.rough=settings.rough?"on":"off";
  /* "icons" forces glyph tabs at any width; "labels" leaves it to the viewport,
     which switches on its own when seven words stop fitting. */
  document.documentElement.dataset.tabs=settings.tabIcons?"icons":"labels";
  const wm=(settings.skin==="classic")?{main:"D&D",sub:"Character Sheet",title:"D&D Character Sheet"}
                                       :{main:"Humblewood",sub:"The Fieldbook",title:"Fieldbook — Humblewood"};
  const wmM=document.getElementById("wmMain"),wmS=document.getElementById("wmSub");
  if(wmM)wmM.textContent=wm.main; if(wmS)wmS.textContent=wm.sub;
  document.title=wm.title;
  const cw=document.getElementById("craceWord");if(cw)cw.textContent=raceTerm();
  if(document.getElementById("classBox"))renderClassRace();
  const on=t==="dark";
  document.getElementById("themeIcon").innerHTML=on
    ?'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>'
    :'<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';
}

