/* ================= character library + home ================= */
/* Every path that replaces the open character asks leaveCharacterOk() first
   (70-persistence.js), and returns false, changing nothing, when told No. */
function loadCharById(id){
  /* before the read: tapping the open character's own card reads back what the
     flush just wrote */
  if(!leaveCharacterOk())return false;
  let raw;try{raw=localStorage.getItem(charKey(id));}catch(e){}
  if(!raw)return false;
  try{character=migrate(JSON.parse(raw));}catch(e){return false;}
  luAbandon();   /* #101: a level-up belongs to the sheet it started on */
  activeId=character.id||id;
  /* the skin is the player's, never the character's (#133); applyTheme() still
     runs, for the wordmark, the title and the header's + Race / + Ancestry */
  applyTheme();
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
  const c=blankChar();c.system=(system==="dnd")?"dnd":"humblewood";c.name=name||"";c.glossary=seedGlossary();ensureDefaultLanguages(c);
  c.appVersion=APP_VERSION;   // safe here: runtime, long after 30-version.js has run
  c.ammoInit=AMMO_PASS;   // a new sheet has nothing for the one-time ammo pass to migrate (never in blankChar — see wpnEquipInit)
  c.langLifted=true;   // a new sheet has no "Languages:" line in Proficiencies to lift (never in blankChar — see ammoInit above)
  c.toolsLifted=true;   // ...nor a "Tools:" line (#121), for the same reason
  c.wpnEquipInit=1;   // its weapons arrive equipped (#128), so the one-time pass has none to equip; unset, the first reload re-equipped one the player had unequipped
  luAbandon();   /* #101: a level-up belongs to the sheet it started on */
  character=c;activeId=c.id;
  /* as finishImport(): listed only once stored, and a refusal says so (#81) */
  let why="";try{localStorage.setItem(charKey(c.id),JSON.stringify(c));}catch(e){why=storageWhy(e);}
  if(!why)why=libTouch();
  applyTheme();   /* the skin stays as chosen (#133): only the words follow the system */
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
  /* no character open now, so the title and wordmark follow the skin again (#133) */
  if(activeId===id){activeId=null;applyTheme();}
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
function showHome(){luAbandon();renderHome();document.getElementById("home").style.display="flex";}
function hideHome(){const h=document.getElementById("home");if(h)h.style.display="none";}
function fmtWhen(ts){if(!ts)return "";const d=new Date(ts),now=Date.now(),diff=(now-ts)/1000;if(diff<60)return "just now";if(diff<3600)return Math.floor(diff/60)+"m ago";if(diff<86400)return Math.floor(diff/3600)+"h ago";return d.toLocaleDateString();}
function renderHome(){
  const lib=libLoad();
  /* a read can throw too, where the browser blocks storage (#142): that is a first run */
  let noSettings=true;try{noSettings=!localStorage.getItem(K_SET);}catch(e){}
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
      <p class="hint">The game this character is for. It sets the coins, the ancestries you're offered and your starting languages. Classes, spells, feats and items from every loaded pack are offered either way. You can change it later in Settings → Sheet display.</p></div>
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
  /* The wordmark and the page title read like the game, so they follow the open
     character's system, not the skin (#133). With no character open there is no
     system to follow, and they follow the skin. */
  const dnd=activeId?character.system==="dnd":settings.skin==="classic";
  const wm=dnd?{main:"D&D",sub:"Character Sheet",title:"D&D Character Sheet"}
              :{main:"Humblewood",sub:"The Fieldbook",title:"Fieldbook — Humblewood"};
  const wmM=document.getElementById("wmMain"),wmS=document.getElementById("wmSub");
  if(wmM)wmM.textContent=wm.main; if(wmS)wmS.textContent=wm.sub;
  document.title=wm.title;
  /* the header's "+ Race" / "+ Ancestry" follows the character's system (raceTerm()) */
  if(document.getElementById("sheetHead"))renderSheetHead();
  const on=t==="dark";
  document.getElementById("themeIcon").innerHTML=on
    ?'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>'
    :'<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';
}

/* ================= a character's game system (#133) =================
   Changed from the Game system row on Settings → Sheet display, never by the
   skin. A tap on the other system first works out everything the change would
   do (systemChangePlan, pure: it writes nothing), the warning says it
   (systemChangeLines, which reads only the plan), and Yes applies that same
   plan (changeSystem), so the warning and the change can't disagree. Nothing
   converts coins and nothing is logged: platinum and electrum stay in the
   purse, and a Humblewood sheet shows them while it holds some (coinKeys()). */
function systemChangePlan(c,sys){
  const from=(c&&c.system==="dnd")?"dnd":"humblewood",to=sys==="dnd"?"dnd":"humblewood";
  const langs=swapDefaultLanguages({system:from,languages:JSON.parse(JSON.stringify((c&&c.languages)||[]))},to);
  let coins=null;
  if(to==="dnd")coins={gain:true};
  else{const held=k=>Math.max(0,num(c&&c.coins&&c.coins[k]));const pp=held("pp"),ep=held("ep");if(pp>0||ep>0)coins={pp,ep};}
  /* an ancestry the new system's + Race / + Ancestry list leaves out (the
     picker's own rule, raceOfferedTo()) stays on the sheet, and the warning says so */
  const rn=c&&c.race&&typeof c.race.name==="string"?c.race.name.trim():"";
  const def=rn?findRaceDef(rn):null;
  const ancestryStays=(def&&!raceOfferedTo(def,to))?rn:"";
  const advDiffers=JSON.stringify(advancementFor({system:from}))!==JSON.stringify(advancementFor({system:to}));
  return {from,to,langs,coins,ancestryStays,advDiffers,
    term:to==="dnd"?"Race":"Ancestry",wordmark:to==="dnd"?"D&D Character Sheet":"Humblewood"};
}
/* The warning's sentences, each only when it applies, in a fixed order: coins,
   the ancestry list, an ancestry that stays, languages, the XP table, the
   words, and always the last two. Plain text: askConfirm() sets textContent. */
function systemChangeLines(p){
  const game=s=>s==="dnd"?"D&D":"Humblewood";
  const list=a=>a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1];
  const out=[],L=p.langs||{drop:[],add:[],keep:[]};
  if(p.coins&&p.coins.gain)out.push("Coins gain platinum and electrum.");
  else if(p.coins){
    const held=[["pp","PP"],["ep","EP"]].filter(([k])=>p.coins[k]>0).map(([k,l])=>p.coins[k]+" "+l);
    const one=held.length===1&&(p.coins.pp===1||p.coins.ep===1);
    if(held.length)out.push("Your "+list(held)+(one?" stays":" stay")+" on the Coins card until you spend or convert them.");
  }
  out.push(p.to==="dnd"?"The + Race list offers D&D species.":"The + Ancestry list offers Humblewood ancestries.");
  if(p.ancestryStays)out.push(p.ancestryStays+" stays on the sheet.");
  if(L.drop.length)out.push(list(L.drop)+(L.drop.length===1?" (a "+game(p.from)+" default) goes":" ("+game(p.from)+" defaults) go")+
    (L.keep.length?"; "+list(L.keep)+(L.keep.length===1?" stays":" stay"):"")+".");
  if(L.add.length)out.push(list(L.add)+(L.add.length===1?" is added.":" are added."));
  if(p.advDiffers)out.push("The XP bar uses "+game(p.to)+"'s table.");
  out.push("The sheet says "+p.term+", and the top bar reads "+p.wordmark+".");
  out.push("Classes, spells, feats and items from every loaded pack stay available. The look doesn't change: that's Skin, on Appearance.");
  return out;
}
/* Applies a plan to c alone: the system, then the plan's own language swap,
   exactly as the warning said it. It does not ask the rules again: a pack
   installed or removed while the question was open must not change what Yes
   does. Drops the planned "system" chips, adds the planned names the sheet
   lacks (case-blind), and never touches the player's or a grant's chips.
   Returns what it did. The coins are not touched and nothing is logged (spec
   decision 10); the caller redraws and saves. */
function changeSystem(c,plan){
  const out={drop:[],add:[],keep:[]};
  if(!c||!plan)return out;
  const L=plan.langs||{},list=a=>(Array.isArray(a)?a:[]).filter(n=>typeof n==="string"&&n.trim());
  const drop=new Set(list(L.drop).map(n=>n.trim().toLowerCase()));
  c.system=plan.to;
  const have=chipClean(c.languages,"languages",true).filter(x=>{
    if(x.src==="system"&&drop.has(x.name.toLowerCase())){out.drop.push(x.name);return false;}
    return true;});
  const names=new Set(have.map(x=>x.name.toLowerCase()));
  list(L.add).forEach(n=>{const k=n.trim().toLowerCase();if(!names.has(k)){have.push({id:uid(),name:n.trim(),src:"system"});names.add(k);out.add.push(n.trim());}});
  out.keep=list(L.keep);
  c.languages=have;
  return out;
}

