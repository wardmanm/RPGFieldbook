/* ================= rules tables =================
   Tables come from a rules pack as their own category (see rules-schema §6.11).
   The converter lifts each table out of the prose it lived in and leaves a
   "[Table: Name]" anchor behind; highlight() turns that into a tappable chip.
   Everything here is read-only reference material — no character state. */
function allTables(){return Array.isArray(rules.tables)?rules.tables:[]}
/* A table's rows and columns as lists, whatever the pack wrote. renderRulesBrowser()
   runs in renderAll(), so a table with no `rows` stopped every render, the same
   way a keyword with no term did (#71). A row that is not a list is one cell. */
function tableRows(t){return (t&&Array.isArray(t.rows)?t.rows:[]).map(r=>Array.isArray(r)?r:[r]);}
function tableCols(t){return t&&Array.isArray(t.cols)?t.cols:[];}
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
  const rows=tableRows(t);
  if(!rows.length)return `<p class="hint">This table has no rows.</p>`;
  const al=Array.isArray(t.align)?t.align:[],a=i=>al[i]==="center"?" style=\"text-align:center\"":(al[i]==="right"?" style=\"text-align:right\"":"");
  const cols=tableCols(t);
  const head=cols.some(c=>c!=="")?`<thead><tr>${cols.map((c,i)=>`<th${a(i)}>${esc(c)}</th>`).join("")}</tr></thead>`:"";
  const body=rows.map(r=>`<tr>${r.map((c,i)=>`<td${a(i)}>${esc(c)}</td>`).join("")}</tr>`).join("");
  /* footnotes (schema §6.11, optional): what a "*" in a row or label points at.
     Escaped exactly as a cell is, and set OUTSIDE the scroll box so a wide d100
     table never carries its notes off-screen. None → the markup is unchanged. */
  const notes=(Array.isArray(t.footnotes)?t.footnotes:[]).map(f=>f==null?"":String(f).trim()).filter(Boolean);
  const foot=notes.length?`<div class="tbl-notes">${notes.map(f=>`<p>${esc(f)}</p>`).join("")}</div>`:"";
  return `<div class="tbl-wrap"><table class="rtbl">${head}<tbody>${body}</tbody></table></div>${foot}`;
}
function tableMeta(t){
  const bits=[];
  if(t.owner)bits.push(t.owner+(t.ownerKind?" ("+t.ownerKind+")":""));
  const n=tableRows(t).length;
  bits.push(n+" row"+(n===1?"":"s"));
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
/* a row of chips linking to an entity's tables — used by the class/race views */
function tableChipsHTML(name,kind){
  const ts=tablesFor(name,kind);
  if(!ts.length)return "";
  return `<div class="tblchips">`+ts.map(t=>`<button type="button" class="tblref" data-tbl="${esc(t.name)}">${esc(t.name)}</button>`).join("")+`</div>`;
}
