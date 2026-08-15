/* ================= wiring ================= */
function wire(){
  // tabs
  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
    selectTab(t.dataset.tab);window.scrollTo({top:0});
  }));
  // bound inputs
  document.addEventListener("input",e=>{
    const inp=e.target.closest("[data-path]");if(!inp)return;
    /* Grab CON before the write: resyncLevel1HP needs the previous score to
       recognise its own seeded number. Runs before recompute() so maxNote
       repaints against the new base. */
    const prevCon=inp.dataset.path==="character.abilities.con"?character.abilities.con:null;
    setP({character},inp.dataset.path,inp.value);
    if(prevCon!==null)resyncLevel1HP(prevCon);
    if(inp.dataset.path==="character.hitdice")renderHitDice();
    if(inp.hasAttribute("data-recompute"))recompute();
    scheduleSave();
  });
  // slot totals
  document.addEventListener("input",e=>{const s=e.target.closest("[data-slot]");if(!s)return;if(slotsAuto)return;const lv=num(s.dataset.slot);character.slots[lv].total=Math.max(0,num(s.value));if(character.slots[lv].used>character.slots[lv].total)character.slots[lv].used=character.slots[lv].total;renderSlotBubbles();scheduleSave();});
  // clicks
  document.addEventListener("click",e=>{
    const t=e.target;
    let m;
    if((m=t.closest(".dot[data-save]"))){const k=m.dataset.save;character.saves[k]=!character.saves[k];recompute();scheduleSave();return;}
    if((m=t.closest(".dot[data-skill]"))){const k=m.dataset.skill;character.skills[k]=((character.skills[k]||0)+1)%3;recompute();scheduleSave();return;}
    if((m=t.closest("[data-stat]"))){openStatBreakdown(m.dataset.stat);return;}
    if((m=t.closest(".kw"))){const g=allGlossary().find(x=>x.id===m.dataset.gid);if(g)openGlossView(g);return;}
    if((m=t.closest(".tblref"))){openTableByName(m.dataset.tbl);return;}
    if((m=t.closest("[data-view-table]"))){openTableByName(m.dataset.viewTable);return;}
    if((m=t.closest("[data-edit]"))){const k=m.dataset.edit;editing[k]=!editing[k];renderRT(k);if(!editing[k])scheduleSave();return;}
    // section notes
    if((m=t.closest("[data-notebtn]")))return openNoteEditor(m.dataset.notebtn);
    if((m=t.closest("[data-noteedit]")))return openNoteEditor(m.dataset.noteedit);
    if((m=t.closest("[data-notejump]")))return jumpToNote(m.dataset.notejump);
    if((m=t.closest("[data-notegroup]"))){toggleNoteGroup(m.dataset.notegroup);return;}
    // death saves
    if((m=t.closest(".death .c"))){const kind=m.dataset.kind,i=num(m.dataset.i);character.death[kind]=(character.death[kind]===i)?i-1:i;renderDeath();scheduleSave();return;}
    /* Max HP padlock — mirrors [data-hdmode] below, minus the confirm: switching
       to manual hit dice is a mode change with consequences at level-up, while
       this is undone by a second tap. Written as `===false` rather than `!`, so
       an object whose flag is undefined locks explicitly instead of reading the
       absence as unlocked. */
    if(t.closest("[data-hplock]")){
      character.hp.locked=character.hp.locked===false;
      renderHP();
      if(character.hp.locked===false){const i=document.getElementById("hpMax");if(i){i.focus();i.select();}}
      scheduleSave();return;
    }
    // slot bubbles
    if((m=t.closest(".slot .b"))){const lv=num(m.dataset.slot),i=num(m.dataset.i);const s=character.slots[lv];s.used=(s.used===i)?i-1:i;renderSlotBubbles();scheduleSave();return;}
    // features
    if((m=t.closest("[data-add]"))){const w=m.dataset.add;({feature:openFeatureForm,item:browseItems,status:openStatusForm,familiar:openFamiliarForm,attack:openAttackForm,spell:browseSpells}[w]||openSpellForm)();return;}
    if((m=t.closest("[data-atk-info]")))return openAttackBreakdown(m.dataset.atkInfo);
    if((m=t.closest("[data-edit-attack]")))return openAttackForm(character.attacks.find(x=>x.id===m.dataset.editAttack));
    if((m=t.closest("[data-del-attack]"))){const a=character.attacks.find(x=>x.id===m.dataset.delAttack);if(a&&confirm(`Delete “${a.name}”?`)){character.attacks=character.attacks.filter(x=>x.id!==a.id);renderAttacks();scheduleSave();}return;}
    // class & ancestry
    if((m=t.closest("[data-add-race]")))return openAddRace();
    if((m=t.closest("[data-add-class]")))return openAddClass();
    if((m=t.closest("[data-del-race]"))){if(confirm("Remove ancestry and the traits it added?"))removeRace();return;}
    if((m=t.closest("[data-del-class]"))){const i=num(m.dataset.delClass);const c=character.classes[i];if(c&&confirm(`Remove ${c.name} and the traits it added?`))removeClass(i);return;}
    if((m=t.closest("[data-info-race]")))return openRaceInfo(m.dataset.infoRace);
    if((m=t.closest("[data-add-bg]")))return openAddBackground();
    if((m=t.closest("[data-del-bg]"))){if(confirm("Remove background “"+(character.bg&&character.bg.name)+"”?"))removeBackground();return;}
    if((m=t.closest("[data-info-bg]")))return openBackgroundInfo(m.dataset.infoBg);
    if((m=t.closest("[data-choose-sub]")))return chooseSubclass(m.dataset.chooseSub);
    if((m=t.closest("[data-change-sub]")))return chooseSubclass(m.dataset.changeSub);
    if((m=t.closest("[data-sub-info]"))){const p=m.dataset.subInfo.split("|");return openSubclassInfo(p[0],p[1]);}
    if((m=t.closest("[data-info-class]")))return openClassInfo(m.dataset.infoClass);
    // statuses
    if((m=t.closest("[data-edit-status]")))return openStatusForm(character.statuses.find(x=>x.id===m.dataset.editStatus));
    if((m=t.closest("[data-del-status]"))){const s=character.statuses.find(x=>x.id===m.dataset.delStatus);if(s&&confirm(`Remove “${s.name}”?`)){character.statuses=character.statuses.filter(x=>x.id!==s.id);renderStatuses();recompute();scheduleSave();}return;}
    if((m=t.closest("[data-toggle-status]"))){const s=character.statuses.find(x=>x.id===m.dataset.toggleStatus);if(s){s.active=s.active===false;renderStatuses();recompute();scheduleSave();}return;}
    // familiars
    if((m=t.closest("[data-edit-familiar]")))return openFamiliarForm(character.familiars.find(x=>x.id===m.dataset.editFamiliar));
    if((m=t.closest("[data-del-familiar]"))){const f=character.familiars.find(x=>x.id===m.dataset.delFamiliar);if(f&&confirm(`Delete “${f.name}”?`)){character.familiars=character.familiars.filter(x=>x.id!==f.id);renderFamiliars();recompute();scheduleSave();}return;}
    if((m=t.closest("[data-toggle-familiar]"))){const f=character.familiars.find(x=>x.id===m.dataset.toggleFamiliar);if(f){f.active=!f.active;renderFamiliars();recompute();scheduleSave();}return;}
    if((m=t.closest("[data-res-dec]"))){const r=character.resources.find(x=>x.id===m.dataset.resDec);if(r){r.cur=Math.max(0,num(r.cur)-1);renderResources();scheduleSave();}return;}
    if((m=t.closest("[data-res-inc]"))){const r=character.resources.find(x=>x.id===m.dataset.resInc);if(r){r.cur=Math.min(num(r.max),num(r.cur)+1);renderResources();scheduleSave();}return;}
    if((m=t.closest("[data-res-reset]"))){const r=character.resources.find(x=>x.id===m.dataset.resReset);if(r){r.cur=num(r.max);renderResources();scheduleSave();}return;}
    if((m=t.closest("[data-res-edit]")))return openResourceForm(character.resources.find(x=>x.id===m.dataset.resEdit));
    if((m=t.closest("[data-res-del]"))){const r=character.resources.find(x=>x.id===m.dataset.resDel);if(r&&confirm(`Delete resource “${r.name}”?`)){character.resources=character.resources.filter(x=>x.id!==r.id);renderResources();scheduleSave();}return;}
    if((m=t.closest("[data-hdmode]"))){
      if(!character.hdManual){if(!confirm("Switch to manual Hit Dice? They will no longer follow your class rules when you level up."))return;character.hdManual=true;renderHitDice();const i=document.getElementById("hitdiceInput");if(i){i.readOnly=false;i.focus();}}
      else{character.hdManual=false;renderHitDice();}
      scheduleSave();return;
    }
    if(t.closest("[data-hdreset]")){character.hdManual=false;renderHitDice();scheduleSave();return;}
    if((m=t.closest("[data-hdroll]")))return rollHitDie(m.dataset.hdroll);
    /* Dice style: the token IS the control. An unspent die rolls and heals; a
       spent one goes back — exactly ONE, not "everything from here on" the way
       the pips work. Pips are positions on a track, so clicking pip 3 meaning
       "three spent" is natural; tokens are interchangeable, and tapping one to
       get three back would contradict its own tooltip. Putting a die back never
       un-heals you, matching what the pips have always done. */
    if((m=t.closest("[data-hddie]"))){
      const die=m.dataset.hddie,i=num(m.dataset.i),p=hitDicePool().find(x=>x.die===die);
      if(p&&i<=p.used){
        if(!character.hdUsed)character.hdUsed={};
        character.hdUsed[die]=Math.max(0,num(character.hdUsed[die])-1);
        renderHitDice();recompute();scheduleSave();
      }else rollHitDie(die);
      return;
    }
    if((m=t.closest("[data-hd]"))){const die=m.dataset.hd,i=num(m.dataset.i);if(!character.hdUsed)character.hdUsed={};const u=num(character.hdUsed[die]);character.hdUsed[die]=(u===i)?i-1:i;renderHitDice();recompute();scheduleSave();return;}
    if((m=t.closest("[data-fuse]"))){const f=character.features.find(x=>x.id===m.dataset.fuse);if(f&&f.uses){const i=num(m.dataset.i);f.uses.used=(num(f.uses.used)===i)?i-1:i;renderFeatures();scheduleSave();}return;}
    if((m=t.closest("[data-usefeat]")))return useFeature(m.dataset.usefeat);
    if(t.closest("#glossImport"))return document.getElementById("glossRulesFiles").click();
    if(t.closest("#tablesImport"))return document.getElementById("tablesRulesFiles").click();
    if((m=t.closest("[data-invitem]"))){const id=m.dataset.invitem,ic=invCol();ic.items[id]=!ic.items[id];renderInventory();scheduleSave();return;}
    if((m=t.closest("[data-fav-item]"))){const it=character.inventory.find(x=>x.id===m.dataset.favItem);if(it){it.fav=!it.fav;renderInventory();scheduleSave();}return;}
    if((m=t.closest("[data-invsec]"))){const s=invCol().sections;s[m.dataset.invsec]=!s[m.dataset.invsec];renderInventory();scheduleSave();return;}
    if(t.closest("#btnToc"))return openToc();
    if(t.closest("#tocBack"))return closeToc();
    if((m=t.closest("[data-fitem]"))){const id=m.dataset.fitem,fc=featCol();fc.items[id]=!fc.items[id];renderFeatures();scheduleSave();return;}
    /* No recompute(): a star moves a feature between groups and changes nothing
       derived. Same as the inventory star above, and unlike the On/Off toggle
       below, which does change what the effects engine sees. */
    if((m=t.closest("[data-fav-feature]"))){const f=character.features.find(x=>x.id===m.dataset.favFeature);if(f){f.fav=!f.fav;renderFeatures();scheduleSave();}return;}
    if((m=t.closest("[data-fgroup]"))){const g=m.dataset.fgroup,fc=featCol();fc.groups[g]=!fc.groups[g];renderFeatures();scheduleSave();return;}
    if((m=t.closest("[data-edit-feature]")))return openFeatureForm(character.features.find(x=>x.id===m.dataset.editFeature));
    if((m=t.closest("[data-del-feature]"))){const f=character.features.find(x=>x.id===m.dataset.delFeature);if(f&&confirm(`Delete “${f.name}”?`)){character.features=character.features.filter(x=>x.id!==f.id);renderFeatures();recompute();scheduleSave();}return;}
    if((m=t.closest("[data-toggle-feature]"))){const f=character.features.find(x=>x.id===m.dataset.toggleFeature);if(f){f.enabled=f.enabled===false;renderFeatures();recompute();scheduleSave();}return;}
    // items
    if((m=t.closest("[data-orig-item]"))){const it=character.inventory.find(x=>x.id===m.dataset.origItem);if(it)openOriginInfo(itemOrigin(it));return;}
    if((m=t.closest("[data-orig-spell]"))){const sp=character.spells.find(x=>x.id===m.dataset.origSpell);if(sp)openOriginInfo(spellOrigin(sp));return;}
    if((m=t.closest("[data-edit-item]")))return openItemForm(character.inventory.find(x=>x.id===m.dataset.editItem));
    if((m=t.closest("[data-del-item]"))){const it=character.inventory.find(x=>x.id===m.dataset.delItem);if(it){const hasAtk=character.attacks.some(a=>a.itemId===it.id);if(confirm(`Delete “${it.name}”?${hasAtk?" Its linked attack will be removed too.":""}`)){character.inventory=character.inventory.filter(x=>x.id!==it.id);character.attacks=character.attacks.filter(a=>a.itemId!==it.id);renderInventory();renderAttacks();recompute();scheduleSave();}}return;}
    if((m=t.closest("[data-toggle-item]"))){const it=character.inventory.find(x=>x.id===m.dataset.toggleItem);if(it){it.equipped=!it.equipped;renderInventory();recompute();scheduleSave();}return;}
    // spells
    if((m=t.closest("[data-edit-spell]")))return openSpellForm(character.spells.find(x=>x.id===m.dataset.editSpell));
    if((m=t.closest("[data-view-spell]")))return openSpellView(character.spells.find(x=>x.id===m.dataset.viewSpell));
    if((m=t.closest("[data-del-spell]"))){const s=character.spells.find(x=>x.id===m.dataset.delSpell);if(s&&confirm(`Delete “${s.name}”?`)){character.spells=character.spells.filter(x=>x.id!==s.id);character.attacks=character.attacks.filter(a=>a.spellId!==s.id);character.activeSpells=(character.activeSpells||[]).filter(a=>a.spellId!==s.id);renderSpells();renderAttacks();renderActiveSpells();scheduleSave();}return;}
    if((m=t.closest("[data-cast-spell]")))return castSpell(m.dataset.castSpell);
    if((m=t.closest("[data-atkitem]"))){const id=m.dataset.atkitem,ac=atkCol();ac.items[id]=!ac.items[id];renderAttacks();scheduleSave();return;}
    if((m=t.closest("[data-round]")))return advanceRound(num(m.dataset.round));
    if((m=t.closest("[data-active-end]"))){const a=(character.activeSpells||[]).find(x=>x.id===m.dataset.activeEnd);if(a&&confirm(`End ${a.name}?`))endActiveSpell(a.id);return;}
    if((m=t.closest("[data-active-tick]"))){const a=(character.activeSpells||[]).find(x=>x.id===m.dataset.activeTick);if(a){bumpActive(a,num(m.dataset.sec));renderActiveSpells();scheduleSave();}return;}
    if((m=t.closest("[data-active-sec]"))){const a=(character.activeSpells||[]).find(x=>x.id===m.dataset.activeSec);if(a){const v=prompt("Add how many seconds?","6");if(v!=null){bumpActive(a,num(v));renderActiveSpells();scheduleSave();}}return;}
    if((m=t.closest("[data-prep]"))){const s=character.spells.find(x=>x.id===m.dataset.prep);if(s){s.prepared=!s.prepared;renderSpells();scheduleSave();}return;}
    // glossary
    if((m=t.closest("[data-view-gloss]")))return openGlossView(character.glossary.find(x=>x.id===m.dataset.viewGloss));
    if((m=t.closest("[data-view-gloss-rk]")))return openGlossView((rules.keywords||[]).find(x=>(x._id||x.term)===m.dataset.viewGlossRk));
    if((m=t.closest("[data-edit-gloss]")))return openGlossForm(character.glossary.find(x=>x.id===m.dataset.editGloss));
    if((m=t.closest("[data-del-gloss]"))){const g=character.glossary.find(x=>x.id===m.dataset.delGloss);if(g&&confirm(`Delete “${g.term}”?`)){character.glossary=character.glossary.filter(x=>x.id!==g.id);renderGloss();renderFeatures();renderInventory();renderAllRT();scheduleSave();}return;}
  });
  document.addEventListener("keydown",e=>{
    if(!(e.key==="Enter"||e.key===" ")||!e.target.classList)return;
    if(e.target.classList.contains("kw")){e.preventDefault();const g=allGlossary().find(x=>x.id===e.target.dataset.gid);if(g)openGlossView(g);return;}
    if(e.target.classList.contains("tblref")){e.preventDefault();openTableByName(e.target.dataset.tbl);}
    /* the notes-tab group headers are role="button" tabindex="0", so they owe
       the keyboard the same behaviour the Settings sections give it */
    {const g=e.target.closest&&e.target.closest("[data-notegroup]");if(g){e.preventDefault();toggleNoteGroup(g.dataset.notegroup);return;}}
  });
  /* These five are markup that moves around, and wire() has no try/catch: a bare
     getElementById(...).addEventListener on a renamed id throws HERE and every
     listener registered after it — coins, HP, theme, settings, the home screen —
     silently never binds. One dead button is a far better failure than that. */
  const on=(id,ev,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener(ev,fn);};
  // star + hp
  on("starBtn","click",()=>{character.inspiration=!character.inspiration;recompute();scheduleSave();});
  on("hpPlus","click",()=>bumpHP(1));
  on("hpMinus","click",()=>bumpHP(-1));
  on("btnLongRest","click",longRest);
  on("btnShortRest","click",shortRest);
  document.getElementById("addResource").addEventListener("click",()=>openResourceForm());
  /* clampHP owns both bounds and adjustHP owns the temp-HP-first rule. Every
     part a damage path needs lives in 65-resources.js, where the harness can
     reach it; this is the button, and nothing else. */
  function bumpHP(d){adjustHP(d);renderHP();scheduleSave();}
  document.getElementById("restoreSlots").addEventListener("click",()=>{for(let lv=1;lv<=9;lv++)character.slots[lv].used=0;renderSlotBubbles();scheduleSave();});
  // portrait
  document.getElementById("btnPortrait").addEventListener("click",()=>document.getElementById("filePortrait").click());
  document.getElementById("filePortrait").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{character.portraitImg=r.result;renderPortrait();scheduleSave()};r.readAsDataURL(f);e.target.value="";});
  document.getElementById("btnPortraitDel").addEventListener("click",()=>{if(character.portraitImg&&confirm("Remove portrait?")){character.portraitImg=null;renderPortrait();scheduleSave();}});
  // add glossary
  document.getElementById("btnAddGloss").addEventListener("click",()=>openGlossForm());
  document.getElementById("glossSearch").addEventListener("input",()=>renderGloss());
  document.getElementById("tablesSearch").addEventListener("input",()=>renderTables());
  document.getElementById("addFamiliarLink").addEventListener("click",()=>openFamiliarForm());
  document.getElementById("btnLevelUp").addEventListener("click",doLevelUp);
  document.getElementById("btnLevelDown").addEventListener("click",doLevelDown);
  // theme / settings / save / load
  document.getElementById("btnTheme").addEventListener("click",()=>{let t=settings.theme;if(t==="system")t=document.documentElement.dataset.theme;settings.theme=(t==="dark")?"light":"dark";applyTheme();saveSettings();});
  document.getElementById("btnSettings").addEventListener("click",openSettings);
  const _vb=document.getElementById("btnVer");if(_vb){_vb.textContent="v"+APP_VERSION;_vb.addEventListener("click",openChangelog);}
  /* same target as the version button it replaces — the changelog, which carries
     the download link while an update is pending */
  const _up=document.getElementById("updatePill");if(_up)_up.addEventListener("click",openChangelog);
  {const s=document.getElementById("sizeDisp");if(s){s.addEventListener("click",openSizePicker);
    s.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openSizePicker();}});}}
  document.getElementById("btnHome").addEventListener("click",showHome);
  document.getElementById("btnCoinConvert").addEventListener("click",convertCoins);
  document.getElementById("btnCoinAdjust").addEventListener("click",openCoinAdjust);
  /* Coin and HP boxes commit on change, not on input: mid-typing, "+1" is not
     yet the number you meant. Enter commits without leaving the field, and
     reselects so you can type the next delta straight away. */
  function commitBox(t){
    if(!t||!t.closest)return null;
    const c=t.closest("[data-coin]");if(c){applyCoinInput(c);return c;}
    const h=t.closest("[data-hp]");if(h){applyHPInput(h);return h;}
    return null;
  }
  document.addEventListener("change",e=>{commitBox(e.target);});
  document.addEventListener("keydown",e=>{
    if(e.key!=="Enter")return;
    const b=commitBox(e.target);
    if(b){e.preventDefault();b.select();}
  });
  document.getElementById("invCollapseAll").addEventListener("click",()=>{const ic=invCol();const anyOpen=character.inventory.some(it=>!ic.items[it.id]);character.inventory.forEach(it=>{ic.items[it.id]=anyOpen;});renderInventory();scheduleSave();});
  // ---- home screen ----
  document.getElementById("homeCog").addEventListener("click",()=>{homeForceSetup=!homeForceSetup;renderHome();});
  document.getElementById("homeBack").addEventListener("click",()=>{if(activeId)hideHome();});
  document.getElementById("homeNew").addEventListener("click",openNewCharacter);
  document.getElementById("homeLoadChar").addEventListener("click",()=>document.getElementById("fileLoad").click());
  document.getElementById("homeSkin").addEventListener("click",e=>{const b=e.target.closest("[data-skin]");if(!b)return;settings.skin=b.dataset.skin;applyTheme();saveSettings();syncHomeSetupControls();});
  document.getElementById("homeMode").addEventListener("click",e=>{const b=e.target.closest("[data-th]");if(!b)return;settings.theme=b.dataset.th;applyTheme();saveSettings();syncHomeSetupControls();});
  document.getElementById("homeRough").addEventListener("click",()=>{settings.rough=!settings.rough;applyTheme();saveSettings();syncHomeSetupControls();});
  document.getElementById("homeImportBtn").addEventListener("click",()=>document.getElementById("homeRulesFiles").click());
  document.getElementById("homeRulesFiles").addEventListener("change",e=>{if(e.target.files.length)importRulesFiles(e.target.files);e.target.value="";setTimeout(()=>{const s=document.getElementById("homeRulesStatus");if(s)s.textContent=rulesStatusText();},400);});
  document.getElementById("glossRulesFiles").addEventListener("change",e=>{if(e.target.files.length)importRulesFiles(e.target.files);e.target.value="";});
  document.getElementById("tablesRulesFiles").addEventListener("change",e=>{if(e.target.files.length)importRulesFiles(e.target.files);e.target.value="";});
  document.getElementById("homeRulesData").addEventListener("click",e=>{const d=e.target.closest("[data-rd-del]");if(!d)return;const g=loadedRulesGroups().find(x=>x.key===d.dataset.rdDel);if(g&&confirm(`Remove “${g.label}” (${g.count} entr${g.count===1?"y":"ies"}) from your loaded rules?`)){removeRulesGroup(d.dataset.rdDel);const s=document.getElementById("homeRulesStatus");if(s)s.textContent=rulesStatusText();}});
  document.getElementById("homeClearRules").addEventListener("click",()=>{if(clearAllRules()){const s=document.getElementById("homeRulesStatus");if(s)s.textContent=rulesStatusText();}});
  document.getElementById("homeChars").addEventListener("click",e=>{
    let m;
    if((m=e.target.closest("[data-load]")))return loadCharById(m.dataset.load);
    if((m=e.target.closest("[data-autoload]")))return setAutoload(m.dataset.autoload);
    if((m=e.target.closest("[data-delchar]"))){const lib=libLoad(),meta=lib.index.find(x=>x.id===m.dataset.delchar);if(confirm(`Delete “${meta?meta.name:"this character"}”? This can't be undone.`))deleteCharacter(m.dataset.delchar);return;}
  });
  document.getElementById("btnSave").addEventListener("click",exportChar);
  document.getElementById("btnPrint").addEventListener("click",printSheet);
  document.getElementById("btnLoad").addEventListener("click",()=>document.getElementById("fileLoad").click());
  document.getElementById("fileLoad").addEventListener("change",e=>{const f=e.target.files[0];if(f)importChar(f);e.target.value="";});
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{if(settings.theme==="system")applyTheme();});
}

/* ================= boot ================= */
function boot(){
  const noSettings=!localStorage.getItem(K_SET);
  try{const s=localStorage.getItem(K_SET);if(s)settings=Object.assign(settings,JSON.parse(s));}catch(e){}
  if(!Array.isArray(settings.rulesSources))settings.rulesSources=[];
  if(settings.rulesUrl){if(!settings.rulesSources.includes(settings.rulesUrl))settings.rulesSources.push(settings.rulesUrl);delete settings.rulesUrl;saveSettings();}
  /* localStorage first and synchronously, so the sheet draws with rules already
     in hand. It is now only the FALLBACK store and the migration source — the
     IndexedDB copy is authoritative and is hydrated over the top a tick later
     (see loadRulesCacheAsync), because five packs no longer fit in localStorage
     at all. */
  try{const rr=readRulesCacheString(localStorage.getItem(K_RULES));if(rr)rules=Object.assign(rules,JSON.parse(rr));}catch(e){}
  reindexRules();recomputeDups();
  buildAbilities();buildSkills();buildDeath();buildSlots();buildBio();
  wire();applyTheme();
  migrateOldChar();
  const lib=libLoad();
  let opened=false;
  if(lib.autoload && lib.index.some(x=>x.id===lib.autoload)){opened=loadCharById(lib.autoload);}
  if(!opened){
    // nothing auto-opened — seed a working character in memory so the sheet is valid behind the home screen
    character.glossary=seedGlossary();renderAll();
    showHome();
  }
  if(!lsOK){const ss=document.getElementById("savestate");if(ss)ss.textContent="Use Save ↑";}
  /* After the first paint, not before it: the rules cache lives in IndexedDB now
     and reading it is async. Everything above already drew with whatever
     localStorage had (usually nothing, once migrated), and this replaces it. */
  loadRulesCacheAsync();
  checkForUpdate();
}
boot();
