/* ================= the Rules tab: a browser over the loaded rules (#99, #53) =================
   Every category the packs hold, in one fixed order, each a sortable table with
   its own search and the Add pickers' filters; a row opens the window the sheet
   already uses for that entry. It is for reading: the only writes are the
   glossary's own + Add, Edit and Delete, which the old Glossary card had.

   The pure half (rows, filters, sorting, markup strings, state) comes first, so
   the harness can assert all of it. The DOM half paints #rbSide, #rbMain and
   #rbBody and nothing else. Pack fields are someone else's file (#71): read
   through rbStr() and the named helpers, never raw. */

/* ---- reading a category ---- */
function rbList(kind){return (Array.isArray(rules[kind])?rules[kind]:[]).filter(e=>e&&typeof e==="object"&&!Array.isArray(e));}
function rbStr(v){return typeof v==="string"?v.trim():(typeof v==="number"&&isFinite(v)?String(v):"");}
function rbSrc(e){return rbStr(e&&e._source);}
/* the display name: dispName() adds "(SRC)" only when two packs share a name */
function rbName(e,kind){
  const nm=kind==="keywords"?glossTerm(e):rbStr(e&&e.name);
  return nm?String(dispName({name:nm,term:nm,_source:e._source},kind)):"";
}
function rbRow(e,kind,extra){
  const nm=kind==="keywords"?glossTerm(e):rbStr(e.name);
  return Object.assign({id:String(rbStr(e._id)||nm),name:rbName(e,kind),e,src:rbSrc(e),subj:e},extra||{});
}
/* the first number in the text, not every digit joined — "1d10" is 1, not 110;
   for hit dice ("d10", no leading count) that leaves the die size, which is
   the only number there to sort by */
function rbNum(v){const m=String(v==null?"":v).match(/-?\d+(?:\.\d+)?/);return m?parseFloat(m[0]):null;}
function rbTblKind(t){const i=TBL_KINDS.findIndex(([k])=>k===t.ownerKind);return i<0?TBL_KINDS.length:i;}
/* a shared picker facet matches an entry (or a feat's {k,e}); the browser hands
   it the row, so this unwraps */
function rbWrap(facets){return facets.map(f=>Object.assign({},f,{match:(r,a)=>f.match(r.subj,a)}));}

const RB_NAME={key:"name",label:"Name",get:r=>r.name};
const RB_SOURCE={key:"src",label:"Source",get:r=>r.src};
const RB_PAGE=300, RB_HITS=8;
/* The categories, in the order the sidebar lists them. `rows` builds the rows,
   `cols` the columns (`get` is the cell, `sort` the value to sort by when it is
   not the cell), `keys` sort values that are not columns, `order` the default
   sort, `facets` the filters, `open` the window a row opens. */
const RB_CATS=[
  {k:"classes",title:"Classes",
   rows:()=>rbList("classes").map(e=>rbRow(e,"classes")).filter(r=>r.name),
   cols:[RB_NAME,{key:"hd",label:"Hit die",get:r=>rbStr(r.e.hitDie),sort:r=>rbNum(r.e.hitDie)},RB_SOURCE],
   open:r=>openClassInfo(r.e._id||r.e.name,{ref:true})},
  {k:"subclasses",title:"Subclasses",
   /* what subclassesFor() gives each class: its own subclasses and the loose
      ones, keyed as the class window keys them */
   rows:()=>{const out=[];rbList("classes").forEach(d=>{const m=subclassesFor(d);Object.keys(m).forEach(k=>{
     const sc=m[k];if(!sc||typeof sc!=="object"||!k)return;
     out.push({id:"sub:"+(rbStr(d._id)||rbStr(d.name))+"|"+k,name:k,e:sc,cls:d,src:rbSrc(sc)||rbSrc(d),subj:sc});});});return out;},
   /* the class's display name, not its plain one — "Fighter" alone is
      ambiguous once two base packs both have one (#99 final review) */
   cols:[RB_NAME,{key:"cls",label:"Class",get:r=>rbName(r.cls,"classes")},RB_SOURCE],
   facets:list=>{const cl=[...new Set(list.map(r=>rbName(r.cls,"classes")).filter(Boolean))].sort();
     return [{key:"cls",label:"Class",type:"multi",options:cl.map(c=>({value:c.toLowerCase(),label:c})),match:(r,a)=>a.has(rbName(r.cls,"classes").toLowerCase())}];},
   order:{key:"cls",dir:1},
   open:r=>openSubclassInfo(r.cls._id||r.cls.name,r.name,{ref:true})},
  {k:"races",title:"Species",
   rows:()=>rbList("races").map(e=>rbRow(e,"races")).filter(r=>r.name),
   cols:[RB_NAME,{key:"size",label:"Size",get:r=>rbStr(sizeLabel(r.e.size))},{key:"speed",label:"Speed",get:r=>rbStr(r.e.speed),sort:r=>rbNum(r.e.speed)},RB_SOURCE],
   open:r=>openRaceInfo(r.e._id||r.e.name,{ref:true})},
  {k:"backgrounds",title:"Backgrounds",
   rows:()=>rbList("backgrounds").map(e=>rbRow(e,"backgrounds")).filter(r=>r.name),
   cols:[RB_NAME,{key:"feat",label:"Feat",get:r=>bgFeatList(r.e).map(rbStr).filter(Boolean).join(" or ")},RB_SOURCE],
   open:r=>openBackgroundInfo(r.e._id||r.e.name,{ref:true})},
  {k:"feats",title:"Feats",
   rows:()=>rbList("feats").map(e=>rbRow(e,"feats",{subj:{k:"feat",e}})).filter(r=>r.name),
   cols:[RB_NAME,{key:"type",label:"Type",get:r=>featKindDef(featPickKind(r.subj)).label},{key:"pre",label:"Prerequisite",get:r=>featPickPrereq(r.subj)},RB_SOURCE],
   facets:list=>rbWrap(featFacets(list.map(r=>r.subj))),
   open:r=>openFeatInfo(r.subj)},
  {k:"features",title:"Traits",
   rows:()=>rbList("features").map(e=>rbRow(e,"features",{subj:{k:"trait",e}})).filter(r=>r.name),
   cols:[RB_NAME,{key:"from",label:"From",get:r=>rbStr(r.e.source)},RB_SOURCE],
   open:r=>openFeatInfo(r.subj)},
  {k:"spells",title:"Spells",
   rows:()=>rbList("spells").map(e=>rbRow(e,"spells")).filter(r=>r.name),
   cols:[RB_NAME,{key:"lvl",label:"Level",get:r=>num(r.e.level)===0?"Cantrip":String(num(r.e.level)),sort:r=>num(r.e.level)},
         {key:"school",label:"School",get:r=>spellSchoolOf(r.e)},{key:"time",label:"Time",get:r=>rbStr(String(rbStr(r.e.meta)).split("·")[1])},RB_SOURCE],
   facets:list=>rbWrap(spellFacets(list.map(r=>r.e),{classDefault:"all"})),
   order:{key:"lvl",dir:1},
   open:r=>openSpellView({name:rbStr(r.e.name),level:num(r.e.level),meta:rbStr(r.e.meta),text:rbStr(r.e.text)})},
  {k:"items",title:"Items",
   rows:()=>rbList("items").map(e=>rbRow(e,"items")).filter(r=>r.name),
   cols:[RB_NAME,{key:"cat",label:"Category",get:r=>rbStr(itemCatOf(r.e))},
         {key:"rar",label:"Rarity",get:r=>rbStr(itemRarOf(r.e)),sort:r=>{const i=ITEM_RARITIES.indexOf(itemRarOf(r.e));return i<0?ITEM_RARITIES.length:i;}},
         {key:"cost",label:"Cost",get:r=>rbStr(r.e.cost),sort:r=>{const g=costToGp(r.e.cost);return typeof g==="number"&&isFinite(g)?g:null;}},RB_SOURCE],
   facets:list=>rbWrap(itemFacets(list.map(r=>r.e))),
   open:r=>openItemInfo(r.e)},
  {k:"conditions",title:"Conditions",
   rows:()=>rbList("keywords").filter(g=>g.cond===true&&glossTerm(g)).map(g=>rbRow(g,"keywords")),
   cols:[RB_NAME,RB_SOURCE],
   open:r=>openGlossView(r.e)},
  {k:"glossary",title:"Glossary",
   /* the pack's other terms, then the player's own — listed even with no term,
      because Edit is how one gets a term (#71) */
   rows:()=>{
     const pack=rbList("keywords").filter(g=>g.cond!==true&&glossTerm(g)).map(g=>rbRow(g,"keywords"));
     const own=(Array.isArray(character.glossary)?character.glossary:[]).filter(g=>g&&typeof g==="object"&&!Array.isArray(g))
       .map(g=>({id:"own:"+rbStr(g.id),name:glossTerm(g),e:g,src:"Yours",own:true,subj:g}));
     return pack.concat(own);},
   cols:[{key:"name",label:"Term",get:r=>r.name},{key:"type",label:"Type",get:r=>r.e.type==="image"?"Image":"Text"},RB_SOURCE],
   facets:()=>[{key:"own",label:"Your entries",type:"toggle",match:r=>!!r.own}],
   open:r=>openGlossView(r.e)},
  {k:"tables",title:"Tables",
   rows:()=>allTables().filter(t=>t&&typeof t==="object"&&!Array.isArray(t)).map(t=>rbRow(t,"tables")).filter(r=>r.name),
   cols:[RB_NAME,{key:"rows",label:"Rows",get:r=>String(tableRows(r.e).length),sort:r=>tableRows(r.e).length},{key:"from",label:"From",get:r=>rbStr(r.e.owner)},RB_SOURCE],
   keys:[{key:"kind",sort:r=>rbTblKind(r.e)}],
   facets:list=>{
     const opts=TBL_KINDS.filter(([k])=>list.some(r=>r.e.ownerKind===k)).map(([k,l])=>({value:k,label:l}));
     if(list.some(r=>rbTblKind(r.e)===TBL_KINDS.length))opts.push({value:"other",label:"Other"});
     return [{key:"kind",label:"Kind",type:"multi",options:opts,match:(r,a)=>a.has(rbTblKind(r.e)===TBL_KINDS.length?"other":String(r.e.ownerKind))}];},
   order:{key:"kind",dir:1},
   open:r=>openTableView(r.e)}
];
function rbCat(k){return RB_CATS.find(c=>c.k===k)||null;}
/* the categories the sidebar lists, with their rows; the Glossary always, so
   its + Add is always reachable */
function rbShown(){return RB_CATS.map(cat=>({cat,rows:cat.rows()})).filter(x=>x.rows.length||x.cat.k==="glossary");}
/* The last category opened, if it is still listed; else the first. */
function rulesCatOf(s,shown){
  const k=s&&typeof s.rulesCat==="string"?s.rulesCat:"";
  return shown.some(x=>x.cat.k===k)?k:(shown[0]?shown[0].cat.k:"");
}
function rbFindRow(k,id){const c=rbCat(k);return c?(c.rows().find(r=>r.id===id)||null):null;}
function rbOpenRow(k,id){const c=rbCat(k),r=rbFindRow(k,id);if(c&&r)c.open(r);}

/* ---- filters: the category's own, and Pack when its rows span two packs ---- */
function rbFacets(cat,rows){
  const fs=cat.facets?cat.facets(rows):[];
  const srcs=[...new Set(rows.map(r=>r.src).filter(s=>s&&s!=="Yours"))].sort();
  if(srcs.length>1&&!fs.some(f=>f.key==="pack"))fs.push({key:"pack",label:"Pack",type:"multi",
    options:srcs.map(s=>({value:s.toLowerCase(),label:s})),match:(r,a)=>a.has(String(r.src).toLowerCase())});
  return fs;
}

/* ---- state: in memory for the session; only the category is saved ---- */
const rbUI={per:{},q:"",screen:"list"};
function rbState(k){
  if(!rbUI.per[k])rbUI.per[k]={q:"",facets:{},sort:null,shown:RB_PAGE,showFilters:false};
  return rbUI.per[k];
}
/* a facet's value, from its default the first time it is read */
function rbFacetVal(st,f){
  if(!(f.key in st.facets))st.facets[f.key]=f.type==="toggle"?!!f.default:new Set((f.default||[]).map(String));
  return st.facets[f.key];
}
function rbRowText(cat,r){return cat.cols.map(c=>c.get(r)).join(" ");}
function rbPasses(cat,st,facets,r){
  if(st.q){if(!rbRowText(cat,r).toLowerCase().includes(String(st.q).trim().toLowerCase()))return false;}
  for(const f of facets){const v=rbFacetVal(st,f);
    if(f.type==="toggle"){if(v&&!f.match(r,true))return false;}
    else if(v.size&&!f.match(r,v))return false;}
  return true;
}
function rbToggleFacet(k,key,val){
  const cat=rbCat(k);if(!cat)return;
  const f=rbFacets(cat,cat.rows()).find(x=>x.key===key);if(!f)return;
  const st=rbState(k),v=rbFacetVal(st,f);
  if(f.type==="toggle")st.facets[key]=!v;
  else{const s=String(val);if(v.has(s))v.delete(s);else v.add(s);}
  st.shown=RB_PAGE;
}
function rbClearFacets(k){
  const cat=rbCat(k);if(!cat)return;
  const st=rbState(k);
  rbFacets(cat,cat.rows()).forEach(f=>{st.facets[f.key]=f.type==="toggle"?false:new Set();});
  st.shown=RB_PAGE;
}

/* ---- sorting: numbers as numbers, blanks last whichever way, then by name ---- */
function rbSortVal(cat,key,r){
  const c=cat.cols.find(x=>x.key===key)||(cat.keys||[]).find(x=>x.key===key);
  if(!c)return "";
  return c.sort?c.sort(r):c.get(r);
}
function rbCompare(a,b){
  if(typeof a==="number"&&typeof b==="number")return a-b;
  return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:"base"});
}
function rbSortOf(cat,st){return st.sort||cat.order||{key:"name",dir:1};}
function rbSorted(cat,st,rows){
  const s=rbSortOf(cat,st);
  return rows.slice().sort((x,y)=>{
    const va=rbSortVal(cat,s.key,x),vb=rbSortVal(cat,s.key,y);
    const ea=va==null||va==="",eb=vb==null||vb==="";
    if(ea!==eb)return ea?1:-1;
    return (ea?0:s.dir*rbCompare(va,vb))||rbCompare(x.name,y.name);
  });
}
function rbSortBy(k,key){
  const cat=rbCat(k);if(!cat)return;
  const st=rbState(k),cur=rbSortOf(cat,st);
  st.sort=cur.key===key?{key,dir:-cur.dir}:{key,dir:1};
  st.shown=RB_PAGE;
}

/* ---- markup: pure strings ---- */
const RB_EYE=`<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const RB_PEN=`<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
const RB_BIN=`<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>`;
const RB_NOTERM=`<em title="This entry has no term, so it never shows up in your text. Edit it to give it one.">(no term)</em>`;
function rbSideHTML(shown,active){
  return `<div class="rb-cats">`+shown.map(({cat,rows})=>{const on=cat.k===active;
    return `<button type="button" class="rb-cat${on?" on":""}" data-rbcat="${esc(cat.k)}"${on?` aria-current="true"`:""}><span class="rb-cn">${esc(cat.title)}</span><span class="cnt">${esc(String(rows.length))}</span></button>`;
  }).join("")+`</div>`;
}
/* The pane's fixed top: back, title, + Add, the search box. Built when the
   category changes, never while typing, so the box keeps focus and caret. */
function rbHeadHTML(cat,total,q){
  const gl=cat.k==="glossary";
  return `<div class="rb-head"><button type="button" class="tbtn rb-back" data-rbback>← Categories</button>`+
    `<h3 class="rb-title" id="rbTitle" tabindex="-1">${esc(cat.title)} <span class="cnt">(${esc(String(total))})</span></h3>`+
    (gl?`<button type="button" class="add" id="btnAddGloss"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add</button>`:"")+`</div>`+
    (gl?`<p class="hint">Terms here become tappable ❧ wherever they appear in your notes, features, spells and item descriptions.</p>`:"")+
    `<div class="searchbox rb-catsearch"><input id="rbCatSearch" placeholder="Search ${esc(cat.title.toLowerCase())}…" value="${esc(q||"")}" autocomplete="off" aria-label="Search ${esc(cat.title)}"><button type="button" class="search-clear" aria-label="Clear the search" title="Clear">×</button></div>`+
    `<div id="rbBody"></div>`;
}
function rbFacetsHTML(st,facets){
  return facets.map(f=>{const v=rbFacetVal(st,f);
    if(f.type==="toggle")return `<div class="fgrp"><span class="flbl">&nbsp;</span><button type="button" class="fpill${v?" on":""}" data-rbtoggle="${esc(f.key)}" aria-pressed="${v?"true":"false"}">${esc(f.label)}</button></div>`;
    return `<div class="fgrp"><span class="flbl">${esc(f.label)}</span>`+(f.options||[]).map(o=>{const on=v.has(String(o.value));
      return `<button type="button" class="fpill${on?" on":""}" data-rbfacet="${esc(f.key)}" data-rbval="${esc(String(o.value))}" aria-pressed="${on?"true":"false"}">${esc(o.label)}</button>`;}).join("")+`</div>`;
  }).join("");
}
function rbActiveCount(st,facets){return facets.reduce((n,f)=>{const v=rbFacetVal(st,f);return n+(f.type==="toggle"?(v?1:0):v.size);},0);}
function rbThHTML(cat,st,c){
  const s=rbSortOf(cat,st),on=s.key===c.key,up=s.dir>0;
  return `<th${on?(up?` aria-sort="ascending"`:` aria-sort="descending"`):""}><button type="button" class="rb-sort" data-rbsort="${esc(c.key)}">${esc(c.label)}${on?(up?" ▲":" ▼"):""}</button></th>`;
}
function rbOwnActsHTML(g){
  const id=rbStr(g.id);
  return `<button class="icon" data-view-gloss="${esc(id)}" aria-label="Preview">${RB_EYE}</button>`+
    `<button class="icon" data-edit-gloss="${esc(id)}" aria-label="Edit">${RB_PEN}</button>`+
    `<button class="icon danger" data-del-gloss="${esc(id)}" aria-label="Delete">${RB_BIN}</button>`;
}
function rbRowHTML(cat,r){
  const cells=cat.cols.map((c,i)=>{const v=c.get(r);
    return i===0?`<td><button type="button" class="rb-open">${v?esc(v):RB_NOTERM}</button></td>`:`<td>${esc(v)}</td>`;}).join("");
  const acts=cat.k==="glossary"?`<td class="rb-acts">${r.own?rbOwnActsHTML(r.e):""}</td>`:"";
  return `<tr data-rbrow="${esc(r.id)}">${cells}${acts}</tr>`;
}
/* What repaints on a filter, a sort, a search or Show more. */
function rbBodyHTML(cat,rows,st,facets){
  const list=rbSorted(cat,st,rows.filter(r=>rbPasses(cat,st,facets,r)));
  const shown=list.slice(0,st.shown);
  const n=rbActiveCount(st,facets);
  let h="";
  if(facets.length){
    h+=`<div class="rb-fbar"><button type="button" class="fpill" data-rbfilters aria-expanded="${st.showFilters?"true":"false"}">Filters${n?` (${esc(String(n))})`:""}</button>`+
      (n?`<button type="button" class="fpill clear" data-rbclear>Clear</button>`:"")+`</div>`;
    if(st.showFilters)h+=`<div class="rb-facets">${rbFacetsHTML(st,facets)}</div>`;
  }
  h+=`<div class="rb-count">${esc(String(list.length))} of ${esc(String(rows.length))}</div>`;
  if(!list.length)return h+`<div class="empty">No matches.</div>`;
  h+=`<div class="tbl-wrap rb-tblwrap"><table class="rtbl rb-tbl"><thead><tr>${cat.cols.map(c=>rbThHTML(cat,st,c)).join("")}${cat.k==="glossary"?`<th aria-label="Actions"></th>`:""}</tr></thead>`+
    `<tbody>${shown.map(r=>rbRowHTML(cat,r)).join("")}</tbody></table></div>`;
  if(list.length>shown.length)h+=`<button type="button" class="tbtn rb-more" data-rbmore>Show ${esc(String(Math.min(RB_PAGE,list.length-shown.length)))} more</button>`;
  return h;
}
/* The sidebar while its box has text: every listed category's matching names,
   up to RB_HITS each, then a link into the category with the text carried over. */
function rbSearchHTML(shown,q){
  const s=String(q||"").trim().toLowerCase();
  let h="";
  shown.forEach(({cat,rows})=>{
    const hits=rows.filter(r=>String(r.name||"").toLowerCase().includes(s)).sort((a,b)=>rbCompare(a.name,b.name));
    if(!hits.length)return;
    h+=`<div class="rb-sgroup"><div class="spell-h">${esc(cat.title)} (${esc(String(hits.length))})</div>`+
      hits.slice(0,RB_HITS).map(r=>`<button type="button" class="rb-hit" data-rbhit="${esc(r.id)}" data-rbhitcat="${esc(cat.k)}">${r.name?esc(r.name):RB_NOTERM}</button>`).join("")+
      (hits.length>RB_HITS?`<button type="button" class="linkbtn rb-morein" data-rbmorein="${esc(cat.k)}">${esc(String(hits.length-RB_HITS))} more in ${esc(cat.title)} →</button>`:"")+`</div>`;
  });
  return h||`<div class="empty">No matches.</div>`;
}

/* ================= the DOM half ================= */
function rbCurKey(){return rulesCatOf(settings,rbShown());}
/* Entering the Rules tab from another tab: forget whatever table was open and
   open on the category list (spec §7). selectTab() calls this; it never runs
   during boot, so the TDZ that orders every other fragment doesn't apply. */
function rbToList(){
  rbUI.screen="list";
  const c=document.getElementById("rbCard");if(c&&c.dataset)c.dataset.screen="list";
}
function rbPaintSide(shown,k){
  const side=document.getElementById("rbSide");if(!side)return;
  const q=String(rbUI.q||"").trim();
  side.innerHTML=q?rbSearchHTML(shown,q):rbSideHTML(shown,k);
}
function rbPaintBody(it){
  const b=document.getElementById("rbBody");if(!b)return;
  b.innerHTML=rbBodyHTML(it.cat,it.rows,rbState(it.cat.k),rbFacets(it.cat,it.rows));
}
/* Everything: the import prompt, the sidebar, the pane. Runs from renderAll()
   and refreshRulesUI(), and when the category changes — never on a keystroke in
   a category's own box, which repaints the body alone (rbRefreshBody). */
function renderRulesBrowser(){
  const empty=document.getElementById("rbEmpty");
  if(empty)empty.innerHTML=RULE_CATS.some(c=>(rules[c]||[]).length)?"":
    `<div class="empty" style="line-height:1.7">No rules pack loaded yet. <button class="linkbtn" id="rbImport">Import rules files</button> to add classes, spells, feats, items and more, or manage sources in Settings.</div>`;
  const card=document.getElementById("rbCard");if(card&&card.dataset)card.dataset.screen=rbUI.screen;
  const shown=rbShown(),k=rulesCatOf(settings,shown);
  rbPaintSide(shown,k);
  const main=document.getElementById("rbMain");if(!main)return;
  const it=shown.find(x=>x.cat.k===k);
  if(!it){main.innerHTML="";return;}
  main.innerHTML=rbHeadHTML(it.cat,it.rows.length,rbState(k).q);
  rbPaintBody(it);
}
function rbRefreshBody(){const shown=rbShown(),k=rulesCatOf(settings,shown),it=shown.find(x=>x.cat.k===k);if(it)rbPaintBody(it);}
function rbOpenCat(k,focus){
  if(!rbCat(k))return;
  settings.rulesCat=k;saveSettings();
  rbUI.screen="table";
  renderRulesBrowser();
  if(focus){const h=document.getElementById("rbTitle");if(h&&h.focus)h.focus();}
}
/* narrow screens: back to the list, with focus on the category just left */
function rbBack(){
  rbUI.screen="list";
  const card=document.getElementById("rbCard");if(card)card.dataset.screen="list";
  const b=document.querySelector(`[data-rbcat="${rbCurKey()}"]`);if(b&&b.focus)b.focus();
}
/* "N more in Spells →": that category, with the search carried into its own box */
function rbMoreIn(k){
  if(!rbCat(k))return;
  rbState(k).q=String(rbUI.q||"").trim();rbState(k).shown=RB_PAGE;
  rbUI.q="";const s=document.getElementById("rbSearch");if(s)s.value="";
  rbOpenCat(k);
}
