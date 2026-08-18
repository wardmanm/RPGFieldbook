/* ---- the two Rules-tab sections collapse, and START collapsed ----
   Both lists are long — the glossary alone is 132 entries with a pack loaded —
   and Reference Tables sits underneath it, so reaching the tables meant
   scrolling past all of it.

   Stored as a COLLAPSE map in settings, exactly like the Settings sections and
   for the same reason: an absent key means "never touched", so the default can
   be closed today without freezing anyone who has since opened one. It lives in
   SETTINGS rather than on the character because the glossary and tables come
   from the rules packs, which are global — collapsing them on one character and
   finding them open on the next would be the surprising behaviour.

   `open` is the default for a section nobody has touched. */
const RULES_SECS=[{k:"gloss",open:false},{k:"tables",open:false}];
function rulesSecDef(k){return RULES_SECS.find(s=>s.k===k)||null;}
function rulesSecOpen(k){
  const c=(settings&&settings.rulesCollapse&&typeof settings.rulesCollapse==="object"&&!Array.isArray(settings.rulesCollapse))?settings.rulesCollapse:{};
  if(k in c)return !c[k];
  const d=rulesSecDef(k);return d?d.open:true;
}
function setRulesSecOpen(k,open){
  if(!settings.rulesCollapse||typeof settings.rulesCollapse!=="object"||Array.isArray(settings.rulesCollapse))settings.rulesCollapse={};
  settings.rulesCollapse[k]=!open;
  saveSettings();
}
/* Paint both sections from the stored state. Counts go in the heading so a shut
   section still says what is inside it — the reason you would open it. */
function renderRulesSections(){
  const counts={gloss:(allGlossary()||[]).length,tables:(allTables()||[]).length};
  RULES_SECS.forEach(({k})=>{
    const head=document.querySelector(`[data-rulessec="${k}"]`),
          body=document.querySelector(`[data-rulesbody="${k}"]`);
    if(!head||!body)return;
    const open=rulesSecOpen(k);
    body.style.display=open?"":"none";
    head.setAttribute("aria-expanded",open?"true":"false");
    const car=head.querySelector(".fcaret");if(car)car.classList.toggle("c",!open);
    const cnt=document.getElementById(k==="gloss"?"glossCount":"tablesCount");
    if(cnt)cnt.textContent=counts[k]?`(${counts[k]})`:"";
  });
}
function toggleRulesSec(k){setRulesSecOpen(k,!rulesSecOpen(k));renderRulesSections();}
/* ================= rules tables =================
   Tables come from a rules pack as their own category (see rules-schema §6.11).
   The converter lifts each table out of the prose it lived in and leaves a
   "[Table: Name]" anchor behind; highlight() turns that into a tappable chip.
   Everything here is read-only reference material — no character state. */
function allTables(){return rules.tables||[]}
function findTable(name){
  const n=String(name||"").trim().toLowerCase();
  if(!n)return null;
  return allTables().find(t=>String(t.name||"").trim().toLowerCase()===n)||null;
}
/* tables belonging to an entity — lets a class show its progression table even
   though the class blurb has no anchor in it */
function tablesFor(name,kind){
  const n=String(name||"").trim().toLowerCase();
  if(!n)return [];
  return allTables().filter(t=>String(t.owner||"").trim().toLowerCase()===n&&(!kind||t.ownerKind===kind));
}
function tableHTML(t){
  if(!t||!Array.isArray(t.rows)||!t.rows.length)return `<p class="hint">This table has no rows.</p>`;
  const al=t.align||[],a=i=>al[i]==="center"?" style=\"text-align:center\"":(al[i]==="right"?" style=\"text-align:right\"":"");
  const cols=t.cols||[];
  const head=cols.some(c=>c!=="")?`<thead><tr>${cols.map((c,i)=>`<th${a(i)}>${esc(c)}</th>`).join("")}</tr></thead>`:"";
  const body=t.rows.map(r=>`<tr>${r.map((c,i)=>`<td${a(i)}>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<div class="tbl-wrap"><table class="rtbl">${head}<tbody>${body}</tbody></table></div>`;
}
function tableMeta(t){
  const bits=[];
  if(t.owner)bits.push(t.owner+(t.ownerKind?" ("+t.ownerKind+")":""));
  bits.push(t.rows.length+" row"+(t.rows.length===1?"":"s"));
  return bits.join(" · ");
}
function openTableView(t){
  if(!t)return;
  openModal(t.name,`<p class="hint" style="font-family:var(--head);text-transform:uppercase;letter-spacing:.05em">${esc(tableMeta(t))}</p>`+tableHTML(t));
}
function openTableByName(name){
  const t=findTable(name);
  if(t)openTableView(t);
  else openModal(String(name||"Table"),`<p class="hint">That table isn’t in any loaded rules pack. Import a pack that includes tables from Settings.</p>`);
}
const TBL_KINDS=[["class","Class progression"],["subclass","Subclass progression"],["race","Species & lineages"],["spell","Spells"],["item","Items & equipment"],["feat","Feats"],["background","Backgrounds"],["rule","Rules & glossary"]];
function renderTables(){
  const el=document.getElementById("tablesList");if(!el)return;
  const si=document.getElementById("tablesSearch");
  const q=(si?si.value:"").trim().toLowerCase();
  const list=allTables().filter(t=>{
    if(!q)return true;
    return (String(t.name||"")+" "+String(t.owner||"")+" "+(t.cols||[]).join(" ")).toLowerCase().includes(q);
  });
  el.innerHTML="";
  if(!allTables().length){
    el.insertAdjacentHTML("beforeend",`<div class="empty" style="line-height:1.7">No tables loaded yet. Tables come from a rules pack — <button class="linkbtn" id="tablesImport">Import rules files</button> or add a source in Settings.</div>`);
    return;
  }
  if(!list.length){el.insertAdjacentHTML("beforeend",`<div class="empty">No matches.</div>`);return;}
  const seen=new Set();
  const groups=TBL_KINDS.map(([kind,label])=>[label,list.filter(t=>t.ownerKind===kind)]);
  groups.forEach(g=>g[1].forEach(t=>seen.add(t)));
  const rest=list.filter(t=>!seen.has(t));
  if(rest.length)groups.push(["Other",rest]);
  groups.forEach(([label,arr])=>{
    if(!arr.length)return;
    const h=document.createElement("div");h.className="spell-h";h.textContent=`${label} (${arr.length})`;el.appendChild(h);
    arr.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name))).forEach(t=>{
      const d=document.createElement("div");d.className="item";
      d.innerHTML=`<div class="top"><span class="nm">${esc(dispName(t,"tables"))}</span><span class="chip">${esc(String(t.rows.length))} rows</span>
        <button class="icon" data-view-table="${esc(t.name)}" aria-label="View table"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
        ${t.owner?`<div class="desc hint">From ${esc(t.owner)}</div>`:""}`;
      el.appendChild(d);
    });
  });
}
/* a row of chips linking to an entity's tables — used by the class/race views */
function tableChipsHTML(name,kind){
  const ts=tablesFor(name,kind);
  if(!ts.length)return "";
  return `<div class="tblchips">`+ts.map(t=>`<button type="button" class="tblref" data-tbl="${esc(t.name)}">${esc(t.name)}</button>`).join("")+`</div>`;
}
