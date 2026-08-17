/* ================= update UI ================= */
const UPD_LABELS={features:"Features & traits",spells:"Spells",inventory:"Items"};
function updRowHTML(r,i){
  const tag=r.type==="added"?`<span class="chip">new</span>`
    :r.type==="ambiguous"?`<span class="chip">ambiguous</span>`
    :r.type==="unmatched"?`<span class="chip">not in your packs</span>`
    :r.edited?`<span class="chip">you edited this</span>`:"";
  const dis=(r.type==="unmatched"||r.type==="ambiguous")?" disabled":"";
  return `<label class="opt" style="align-items:flex-start">
    <input type="checkbox" data-upd="${i}"${r.apply?" checked":""}${dis}>
    <span><b>${esc(r.name||"—")}</b> ${tag}
      <span class="hint" style="display:block">${esc(r.why)}${r.pack?" · "+esc(r.pack):""}</span></span></label>`;
}
function openUpdateReview(){
  const {rows,anyRules}=diffCharacter();
  if(!anyRules){openModal("Check for updates",`<p class="hint">No rules packs are loaded, so there's nothing to compare against. Import a pack from Settings first.</p>`);return;}
  const actionable=rows.filter(r=>r.type==="changed"||r.type==="added");
  if(!rows.length){
    markCharChecked();
    openModal("Check for updates",`<p>Everything on this sheet already matches your loaded rules.</p><p class="hint">Marked as checked against v${esc(APP_VERSION)}.</p>`);
    return;
  }
  _updRows=rows;
  let body=`<p class="hint">Ticked items will be rewritten from your loaded rules packs. Your own numbers — quantities, what's equipped or prepared, uses spent — are never touched.</p>`;
  /* Only worth offering when there is more than one thing to tick. The buttons
     never touch disabled rows — those can't be applied at all. */
  if(actionable.length>1){
    body+=`<div class="m-actions" style="justify-content:flex-start;gap:8px;margin:2px 0 6px">
      <button class="tbtn" id="updAll" type="button">Select all</button>
      <button class="tbtn" id="updNone" type="button">Select none</button>
      <span class="hint" id="updCount" style="align-self:center"></span></div>`;
  }
  ["features","spells","inventory"].forEach(cat=>{
    const inCat=rows.map((r,i)=>[r,i]).filter(([r])=>r.cat===cat);
    if(!inCat.length)return;
    body+=`<div class="spell-h">${esc(UPD_LABELS[cat]||cat)} (${inCat.length})</div>`;
    body+=inCat.map(([r,i])=>updRowHTML(r,i)).join("");
  });
  const note=rows.some(r=>r.type==="unmatched"||r.type==="ambiguous")
    ? `<p class="hint" style="margin-top:8px">Greyed-out rows can't be updated automatically — either the entry isn't in a loaded pack, or the same name appears in more than one and there's no way to tell which you used. Nothing is ever deleted.</p>`:"";
  body+=note+`<div class="m-actions" style="flex-wrap:wrap;gap:8px">
    <button class="tbtn" id="updCancel">Cancel</button>
    <button class="tbtn primary" id="updGo">Back up and update</button></div>`;
  openModal("Updates for "+(character.name||"this character"),body);
  const go=document.getElementById("updGo");
  const pickable=()=>[...document.querySelectorAll("#mBody [data-upd]:not([disabled])")];
  const sync=()=>{const n=document.querySelectorAll("#mBody [data-upd]:checked").length;
    go.textContent=n?`Back up and update ${n}`:"Back up and mark checked";
    const cnt=document.getElementById("updCount");
    if(cnt)cnt.textContent=`${n} of ${pickable().length} selected`;};
  const setAll=v=>{pickable().forEach(b=>{b.checked=v;});sync();};
  const bAll=document.getElementById("updAll"), bNone=document.getElementById("updNone");
  if(bAll)bAll.addEventListener("click",()=>setAll(true));
  if(bNone)bNone.addEventListener("click",()=>setAll(false));
  /* #mBody is the shared modal body and outlives this modal — one delegated
     listener installed once, not a new one on every review */
  if(!_updWired){document.getElementById("mBody").addEventListener("change",e=>{
    if(e.target&&e.target.matches&&e.target.matches("[data-upd]")&&_updSync)_updSync();});_updWired=true;}
  _updSync=sync;sync();
  document.getElementById("updCancel").addEventListener("click",closeModal);
  go.addEventListener("click",()=>{
    const picked=[...document.querySelectorAll("#mBody [data-upd]:checked")].map(el=>_updRows[num(el.dataset.upd)]).filter(Boolean);
    commitUpdates(picked,actionable.length);
  });
}
let _updRows=[],_updWired=false,_updSync=null;
function markCharChecked(){
  character.appVersion=APP_VERSION;
  if(character.skipUpdate)delete character.skipUpdate;
  libTouch();scheduleSave();
}
/* Finish the update once a backup exists. `where` describes it for the receipt. */
function finishUpdates(picked,offered,where){
  const n=applyUpdates(picked);
  markCharChecked();
  renderAll();renderHome();
  const skipped=Math.max(0,offered-n);
  openModal("Updated",`<p>${n?`Updated <b>${n}</b> item${n===1?"":"s"}`:"Marked as checked"}${skipped?`, left <b>${skipped}</b> alone`:""}.</p>
    <p class="hint">${where}</p>`);
}
function commitUpdates(picked,offered){
  /* Back up FIRST — an update without a backup is exactly what this feature
     promised not to do. But storage being full must not be a dead end: a
     downloaded file is a perfectly good backup, so offer that instead of
     refusing to go on. */
  /* capture the name BEFORE markCharChecked() advances appVersion — otherwise
     the confirmation tells them to look for a backup that isn't called that */
  const tag="v"+(character.appVersion||"?");
  const bakName=(character.name||"Character")+" (backup "+tag+")";
  const res=backupCharacter(character,tag);
  if(res.id){
    finishUpdates(picked,offered,
      `A backup was saved to your character list as “${esc(bakName)}”. Delete it from the home screen when you're happy.`);
    return;
  }
  const fname=bakName.replace(/[^a-z0-9\-_ ]/gi,"").trim()+".json";
  openModal("Save the backup as a file?",`
    <p>Nothing has been changed yet. A backup couldn't be kept in the app because ${esc(res.error)}.</p>
    <p>Fieldbook can download it as a file instead, then carry on with the update.</p>
    <p class="hint">Your rules packs are what usually fills storage. Settings → Rules data → <b>Clear all</b>
      frees the most space; your characters aren't affected and you can re-import the packs afterwards.</p>
    <div class="m-actions" style="flex-wrap:wrap;gap:8px">
      <button class="tbtn" id="bakCancel" type="button">Cancel</button>
      <button class="tbtn primary" id="bakDl" type="button">Download backup and update</button>
    </div>`);
  document.getElementById("bakCancel").addEventListener("click",closeModal);
  document.getElementById("bakDl").addEventListener("click",()=>{
    try{
      dl(new Blob([JSON.stringify(res.copy||character,null,2)],{type:"application/json"}),fname);
    }catch(e){
      openModal("Couldn't back up",`<p>The download didn't start, so nothing was changed.</p>
        <p class="hint">Export this character with <b>Save</b> first, then run the check again.</p>`);
      return;
    }
    finishUpdates(picked,offered,
      `A backup was downloaded as “${esc(fname)}” — keep it until you're happy with the result. It is not in your character list, so import it if you need it back.`);
  });
}
/* the nudge shown on load/import when a sheet is behind */
function maybePromptUpdate(){
  if(!charNeedsUpdate(character))return;
  const {rows}=diffCharacter();
  const n=rows.filter(r=>r.type==="changed"||r.type==="added").length;
  if(!rows.length){markCharChecked();return;}   /* nothing to do — quietly current */
  const was=character.appVersion?"v"+esc(character.appVersion):"an earlier version";
  openModal("Rules updates available",`
    <p><b>${esc(character.name||"This character")}</b> was last checked against ${was}. You're on v${esc(APP_VERSION)}.</p>
    <p>${n?`<b>${n}</b> item${n===1?"":"s"} on this sheet ${n===1?"differs":"differ"} from your loaded rules.`:`Some entries couldn't be matched to your loaded rules.`}</p>
    <p class="hint">Updating always takes a backup first, and never changes your own numbers. You can also just play as-is.</p>
    <div class="m-actions" style="flex-wrap:wrap;gap:8px">
      <button class="tbtn" id="updLater">Not now</button>
      <button class="tbtn" id="updNever">Don't ask again for v${esc(APP_VERSION)}</button>
      <button class="tbtn primary" id="updReview">Review updates</button>
    </div>`);
  document.getElementById("updLater").addEventListener("click",closeModal);
  document.getElementById("updNever").addEventListener("click",()=>{character.skipUpdate=APP_VERSION;scheduleSave();closeModal();});
  document.getElementById("updReview").addEventListener("click",()=>{closeModal();openUpdateReview();});
}
