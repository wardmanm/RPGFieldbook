/* ================= reusable full-screen browse/filter picker ================= */
function closeBrowse(){const h=document.getElementById("browse");if(h)h.classList.remove("show");}
function openBrowse(cfg){
  let host=document.getElementById("browse");
  if(!host){host=document.createElement("div");host.id="browse";host.className="browse";document.body.appendChild(host);}
  const idOf=cfg.id, added=cfg.added||(()=>false);
  const st={q:"",facets:{},sel:new Set(),showFilters:false};
  (cfg.facets||[]).forEach(f=>{st.facets[f.key]=f.type==="toggle"?!!f.default:new Set((f.default||[]).map(String));});
  let lastCount=0;
  function passes(e){
    if(st.q){const s=String(cfg.search?cfg.search(e):"").toLowerCase();if(!s.includes(st.q.toLowerCase()))return false;}
    for(const f of (cfg.facets||[])){const a=st.facets[f.key];if(f.type==="toggle"){if(a&&!f.match(e,true))return false;}else{if(a.size&&!f.match(e,a))return false;}}
    return true;
  }
  function activeChips(){const out=[];(cfg.facets||[]).forEach(f=>{if(f.type==="toggle"){if(st.facets[f.key])out.push({key:f.key,toggle:1,label:f.label});}else{st.facets[f.key].forEach(v=>{const o=(f.options||[]).find(o=>String(o.value)===v);out.push({key:f.key,val:v,label:o?o.label:v});});}});return out;}
  function facetHTML(){return (cfg.facets||[]).map(f=>{
    if(f.type==="toggle")return `<div class="fgrp"><span class="flbl">&nbsp;</span><button class="fpill ${st.facets[f.key]?"on":""}" data-toggle="${f.key}">${esc(f.label)}</button></div>`;
    const a=st.facets[f.key];
    return `<div class="fgrp"><span class="flbl">${esc(f.label)}</span>${f.options.map(o=>`<button class="fpill ${a.has(String(o.value))?"on":""}" data-facet="${f.key}" data-val="${esc(String(o.value))}">${esc(o.label)}</button>`).join("")}</div>`;
  }).join("");}
  function sumHTML(){const ch=activeChips();if(!ch.length)return "";return `<div class="brsum">${ch.map(c=>`<button class="fpill on" data-rm="${esc(c.key)}" data-rmv="${esc(c.val||"")}" data-rmt="${c.toggle?1:0}">${esc(c.label)} ✕</button>`).join("")}<button class="fpill clear" id="brClear">Clear</button></div>`;}
  function rowHTML(e){const id=idOf(e),sel=st.sel.has(id),ad=added(e),r=cfg.row(e);
    return `<div class="brow ${sel?"sel":""}" data-row="${esc(id)}"><span class="brk">${sel?"✓":(ad?"•":"")}</span><span class="brn">${esc(r.title)}${ad?` <span class="badge">added</span>`:""}</span>${r.tag?`<span class="btag">${esc(r.tag)}</span>`:""}<button class="brinfo" data-brinfo="${esc(id)}" aria-label="Preview"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button></div>`;}
  /* Repaint the group headings' badges in place. Called from foot(), which the
     row handler already calls — so the count tracks what you tick WITHOUT
     re-rendering the list. Re-rendering would throw away the scroll position and
     redraw 400+ rows on every tap. */
  function paintGroupBadges(){
    if(!cfg.groupBadge)return;
    const chosen=(cfg.items||[]).filter(x=>st.sel.has(idOf(x)));
    Array.prototype.slice.call(document.querySelectorAll("#brList .brgroup[data-brg]")).forEach(h=>{
      const el=h.querySelector("[data-brgc]");if(!el)return;
      const b=cfg.groupBadge(h.dataset.brg,chosen);
      el.textContent=b?b.text:"";
      el.title=(b&&b.title)||"";
      el.style.display=b?"":"none";
      el.classList.toggle("over",!!(b&&b.over));
    });
  }
  /* cfg.noun1 is the spelled-out singular, not a de-pluralised noun: stripping an
     "s" would turn "feats & traits" into "feats & trait". Kept out of foot() so
     the body stays inside the proximity guard rules-data.js puts on it. */
  function foot(){const n=st.sel.size,b=document.getElementById("brAdd"),c=document.getElementById("brCount");
    if(b){b.disabled=!n;b.textContent=n?`Add ${n} ${(n===1&&cfg.noun1)||cfg.noun||""}`:`Add ${cfg.noun||""}`;}
    if(c)c.textContent=`${lastCount} result${lastCount===1?"":"s"}${n?` · ${n} selected`:""}`;
    paintGroupBadges();}
  function renderList(){
    let list=(cfg.items||[]).filter(passes);if(cfg.sort)list=list.slice().sort(cfg.sort);
    lastCount=list.length;const L=document.getElementById("brList");if(!L)return;
    if(!list.length){L.innerHTML=`<div class="empty">No matches. Adjust filters.</div>`;foot();return;}
    let html="",lg=null;
    /* The badge span is emitted empty and filled by paintGroupBadges — cfg.group
       returns a string that gets escaped, so a count cannot be smuggled through
       it, and the value has to be re-derivable on every tick anyway. */
    list.forEach(e=>{if(cfg.group){const g=cfg.group(e);if(g!==lg){
      const key=cfg.groupKey?cfg.groupKey(e):g;
      html+=`<div class="brgroup"${cfg.groupBadge?` data-brg="${esc(key)}"`:""}>${esc(g)}${cfg.groupBadge?`<span class="brgcount" data-brgc></span>`:""}</div>`;lg=g;}}html+=rowHTML(e);});
    L.innerHTML=html;foot();
  }
  function render(){const fc=activeChips().length;
    host.innerHTML=`<div class="browse-inner">
      <div class="browse-head"><input id="brSearch" placeholder="Search ${esc(cfg.noun||"")}…" value="${esc(st.q)}" autocomplete="off"><button class="tbtn ${st.showFilters?"primary":""}" id="brFilters">Filters${fc?` · ${fc}`:""}</button>${cfg.onCustom?`<button class="tbtn" id="brCustom">+ Custom</button>`:""}<button class="tbtn" id="brClose">Close</button></div>
      ${st.showFilters?`<div class="browse-facets">${facetHTML()}${fc?`<button class="fpill clear" id="brClearF" style="align-self:flex-start">Clear all</button>`:""}</div>`:sumHTML()}
      <div class="browse-count" id="brCount"></div>
      <div class="browse-list" id="brList"></div>
      <div class="browse-foot">${cfg.originSelect?`<select id="brOrigin" class="br-origin" style="min-height:40px;border-radius:10px;border:1px solid var(--hair);background:var(--panel);color:var(--ink);padding:0 8px">${originOptionsHTML(null,cfg.originSelect==="spell")}</select><input id="brOrigDet" class="br-origdet" placeholder="origin detail" style="min-height:40px;border-radius:10px;border:1px solid var(--hair);background:var(--panel);color:var(--ink);padding:0 10px">`:""}${cfg.costInput?`<input id="brCost" class="br-cost" type="number" min="0" step="0.01" placeholder="cost gp" title="Overrides the item's listed price; blank uses the price from the rules data" style="min-height:40px;border-radius:10px;border:1px solid var(--hair);background:var(--panel);color:var(--ink);padding:0 8px">`:""}<button class="tbtn primary" id="brAdd" disabled></button></div>
    </div>`;renderList();}
  function clearAll(){(cfg.facets||[]).forEach(f=>{st.facets[f.key]=f.type==="toggle"?false:new Set();});}
  /* The origin applies to the whole batch, so changing it changes whether the
     picks count — repaint the headings. */
  host.oninput=e=>{if(e.target.id==="brSearch"){st.q=e.target.value;renderList();}
    else if(e.target.id==="brOrigin")paintGroupBadges();};
  host.onchange=e=>{if(e.target.id==="brOrigin")paintGroupBadges();};
  host.onclick=e=>{let m;
    if(e.target.closest("#brClose"))return closeBrowse();
    if(e.target.closest("#brFilters")){st.showFilters=!st.showFilters;render();return;}
    if(e.target.closest("#brCustom")){closeBrowse();if(cfg.onCustom)cfg.onCustom();return;}
    if(e.target.closest("#brClear")||e.target.closest("#brClearF")){clearAll();render();return;}
    if((m=e.target.closest("[data-rm]"))){const k=m.dataset.rm;if(m.dataset.rmt==="1")st.facets[k]=false;else st.facets[k].delete(m.dataset.rmv);render();return;}
    if((m=e.target.closest("[data-brinfo]"))){const e2=(cfg.items||[]).find(x=>idOf(x)===m.dataset.brinfo);if(e2&&cfg.preview)cfg.preview(e2);return;}
    if((m=e.target.closest("[data-facet]"))){const set=st.facets[m.dataset.facet];if(set.has(m.dataset.val))set.delete(m.dataset.val);else set.add(m.dataset.val);render();return;}
    if((m=e.target.closest("[data-toggle]"))){st.facets[m.dataset.toggle]=!st.facets[m.dataset.toggle];render();return;}
    if(e.target.closest("#brAdd")){const chosen=(cfg.items||[]).filter(x=>st.sel.has(idOf(x)));const os=document.getElementById("brOrigin"),od=document.getElementById("brOrigDet"),oc=document.getElementById("brCost");const og=(os&&os.value)?{kind:os.value,detail:(od?od.value.trim():""),at:Date.now()}:null;const costOverride=(oc&&oc.value!=="")?num(oc.value):null;if(chosen.length&&cfg.onAdd)cfg.onAdd(chosen,og,costOverride);closeBrowse();return;}
    if((m=e.target.closest("[data-row]"))){const id=m.dataset.row;if(st.sel.has(id))st.sel.delete(id);else st.sel.add(id);m.classList.toggle("sel",st.sel.has(id));const mk=m.querySelector(".brk");if(mk)mk.textContent=st.sel.has(id)?"✓":(added((cfg.items||[]).find(x=>idOf(x)===id))?"•":"");foot();return;}
  };
  render();host.classList.add("show");const si=document.getElementById("brSearch");if(si)si.focus();
}
function browseItems(){
  const lib=rules.items||[];
  if(!lib.length)return openItemForm();
  const catOf=x=>x.category||"Gear", rarOf=x=>x.rarity||"Mundane";
  const RAR=["Mundane","Common","Uncommon","Rare","Very Rare","Legendary","Artifact"];
  const cats=[...new Set(lib.map(catOf))].sort().map(c=>({value:c.toLowerCase(),label:c}));
  const rars=[...new Set(lib.map(rarOf))].sort((a,b)=>RAR.indexOf(a)-RAR.indexOf(b)).map(r=>({value:r.toLowerCase(),label:r}));
  const meta=itemMetaLine;   /* shared with the update diff — see 25-origins-items.js */
  openBrowse({
    noun:"items", noun1:"item", items:lib, id:x=>x._id||x.name,
    search:x=>`${x.name} ${x.type||""} ${x.category||""} ${x.rarity||""}`,
    row:x=>({title:x.name,tag:(x.rarity&&x.rarity!=="Mundane")?x.rarity:(x.cost||"")}),
    sort:(a,b)=>String(catOf(a)).localeCompare(String(catOf(b)))||String(a.name||"").localeCompare(String(b.name||"")),
    group:x=>catOf(x),
    added:x=>character.inventory.some(i=>String(i.name||"").toLowerCase()===String(x.name||"").toLowerCase()),
    preview:x=>openModal(x.name,`<p class="hint" style="font-family:var(--head);text-transform:uppercase;letter-spacing:.05em">${esc(meta(x))}</p><p>${highlight(x.description||"—")}</p>`),
    onCustom:()=>openItemForm(),
    originSelect:true,
    costInput:true,
    facets:[
      {key:"cat",label:"Category",type:"multi",options:cats,match:(e,a)=>a.has(catOf(e).toLowerCase())},
      {key:"rar",label:"Rarity",type:"multi",options:rars,match:(e,a)=>a.has(rarOf(e).toLowerCase())},
      {key:"attune",label:"Needs attunement",type:"toggle",match:e=>!!e.attune}
    ],
    onAdd:(entries,og,costOverride)=>{entries.forEach(x=>{const ex=character.inventory.find(i=>String(i.name||"").toLowerCase()===String(x.name||"").toLowerCase());if(ex){ex.qty=num(ex.qty)+1;return;}const m=meta(x);const it={id:uid(),name:x.name,qty:1,description:(m?m+"\n":"")+(x.description||""),effects:Array.isArray(x.effects)?x.effects:[],equipped:false};if(og)it.origin=og;const c=(costOverride!=null?costOverride:costToGp(x.cost));if(c!=null)it.cost=c;const wg=fnum(x.weight);if(wg)it.weight=wg;if(x.category)it.category=x.category;if(x.type)it.type=x.type;if(x.weapon)it.weapon=x.weapon;stampSrc(it,x,"item","items","browse");character.inventory.push(it);if(it.weapon)addAttackForItem(it);});renderInventory();renderAttacks();recompute();scheduleSave();}
  });
}
/* create an Attacks & Weapons entry linked to a weapon inventory item */
function addAttackForItem(item){
  if(!item||!item.weapon)return;
  const w=item.weapon;
  const atk={id:uid(),name:item.name,kind:(w.kind==="ranged"?"ranged":"melee"),ability:w.ability||"str",proficient:true,
    atkMisc:(w.atkMisc!=null?String(w.atkMisc):""),damageDice:w.dice||"",damageType:w.damageType||"",
    dmgMisc:(w.dmgMisc!=null?String(w.dmgMisc):""),addAbilityDamage:true,notes:w.notes||"",itemId:item.id};
  character.attacks.push(atk);
  item.attackId=atk.id;
}
function browseSpells(){
  const lib=rules.spells||[];
  if(!lib.length)return openSpellForm();
  const myCl=(character.classes||[]).map(c=>String(c.name||"").toLowerCase());
  const clsOf=x=>x.class?(Array.isArray(x.class)?x.class:[x.class]):[];
  const schoolOf=x=>String(x.meta||"").split("·")[0].trim();
  const levels=[{value:"0",label:"Cantrip"}].concat([1,2,3,4,5,6,7,8,9].map(n=>({value:String(n),label:"Lv "+n})));
  const classOpts=[...new Set(lib.flatMap(clsOf).map(c=>String(c)))].sort((a,b)=>a.localeCompare(b)).map(c=>({value:c.toLowerCase(),label:c}));
  const schoolOpts=[...new Set(lib.map(schoolOf).filter(Boolean))].sort().map(s=>({value:s.toLowerCase(),label:s}));
  const defClasses=myCl.filter(c=>classOpts.some(o=>o.value===c));
  openBrowse({
    noun:"spells", noun1:"spell", items:lib, id:x=>x._id||x.name,
    search:x=>`${x.name} ${x.meta||""} ${clsOf(x).join(" ")}`,
    row:x=>({title:dispName(x,"spells"),tag:schoolOf(x)}),
    sort:(a,b)=>num(a.level)-num(b.level)||String(a.name||"").localeCompare(String(b.name||"")),
    group:x=>num(x.level)===0?"Cantrips":"Level "+num(x.level),
    groupKey:x=>String(num(x.level)),
    /* How many you have at this level against your allotment, INCLUDING what is
       ticked right now — going over is allowed, so the number is only worth
       having at the moment you are about to. Three things it has to respect:
       a spell already on the sheet is skipped by onAdd, so it adds nothing; the
       origin dropdown applies to the whole batch, and a Feat/Background origin
       lands them as `granted`, which never counts; and allot===0 means "no
       allotment known", shown as a bare number rather than "n/0". */
    groupBadge:(key,chosen)=>{
      const lv=num(key), t=spellLevelTally(lv);
      const os=document.getElementById("brOrigin");
      const willGrant=!!(os&&os.value&&grantedFromOrigin(os.value));
      const picking=willGrant?0:chosen.filter(x=>num(x.level)===lv&&
        !character.spells.some(s=>String(s.name||"").toLowerCase()===String(x.name||"").toLowerCase())).length;
      const added=t.added+picking;
      if(!t.allot&&!added)return null;               /* nothing known, nothing allowed: no badge */
      return {text:t.allot>0?`${added}/${t.allot}`:String(added),
              over:t.allot>0&&added>t.allot,
              title:t.allot>0?"On your sheet, including what you have ticked / available":"On your sheet"};
    },
    added:x=>character.spells.some(s=>String(s.name||"").toLowerCase()===String(x.name||"").toLowerCase()),
    preview:x=>openSpellView({name:x.name,level:num(x.level),meta:x.meta,text:x.text}),
    onCustom:()=>openSpellForm(),
    originSelect:"spell",
    facets:[
      {key:"level",label:"Level",type:"multi",options:levels,match:(e,a)=>a.has(String(num(e.level)))},
      {key:"class",label:"Class",type:"multi",options:classOpts,default:defClasses,match:(e,a)=>{const c=clsOf(e);return !c.length||c.some(x=>a.has(String(x).toLowerCase()));}},
      {key:"school",label:"School",type:"multi",options:schoolOpts,match:(e,a)=>a.has(schoolOf(e).toLowerCase())},
      {key:"conc",label:"Concentration",type:"toggle",match:e=>/concentration/i.test(e.meta||"")}
    ],
    onAdd:(entries,og)=>{entries.forEach(x=>{if(character.spells.some(s=>String(s.name||"").toLowerCase()===String(x.name||"").toLowerCase()))return;const sp={id:uid(),name:x.name,level:num(x.level),meta:x.meta||"",text:x.text||"",prepared:false,granted:og?grantedFromOrigin(og.kind):"",origin:og||null};detectSpellAttack(sp);stampSrc(sp,x,"spell","spells");character.spells.push(sp);syncSpellAttack(sp);});renderSpells();renderAttacks();scheduleSave();}
  });
}

/* ================= feats & traits =================
   One thing to the player, two categories in the data: `rules.feats` holds
   feats, and the traits a pack ships loose sit in `rules.features`. The only
   way in used to be the feature form's "Insert from rules pack" select — every
   trait in one unsearchable dropdown, and not a single FEAT in it, because
   that select reads `rules.features` alone. Both are browsable here.

   Entries are wrapped as {k,e} rather than merged: a feat and a trait can share
   a name (Humblewood's "Glide" is both), and the two are added in different
   shapes, so they must stay distinguishable all the way through the picker.

   A feat is stored the way grantFeatDef stores one — named "Feat: <name>" and
   stamped against the `feats` category — so a feat picked here and a feat your
   background granted are the same kind of record to the rules-update tool. */
const FEAT_KINDS=[
  {key:"origin", label:"Origin feat",         group:"Origin Feats",         re:/^\s*origin\s+feats?\b/i},
  {key:"general",label:"General feat",        group:"General Feats",        re:/^\s*general\s+feats?\b/i},
  {key:"style",  label:"Fighting Style feat", group:"Fighting Style Feats", re:/^\s*fighting\s+style\s+feats?\b/i},
  {key:"boon",   label:"Epic Boon",           group:"Epic Boons",           re:/^\s*epic\s+boons?\b/i},
  {key:"feat",   label:"Feat",                group:"Feats",                re:null},
  {key:"trait",  label:"Trait",               group:"Traits",               re:null}
];
function featKindDef(key){return FEAT_KINDS.find(k=>k.key===key)||FEAT_KINDS[FEAT_KINDS.length-2];}
/* every feat and trait the loaded packs carry, in one pickable list */
function featPickList(){
  const out=[];
  (rules.feats||[]).forEach(e=>{if(e&&e.name)out.push({k:"feat",e,id:"feat:"+(e._id||e.name)});});
  (rules.features||[]).forEach(e=>{if(e&&e.name)out.push({k:"trait",e,id:"trait:"+(e._id||e.name)});});
  return out;
}
/* The category line the converter writes as the FIRST line of a feat's text
   ("Origin feat", "General feat · Prerequisite: Level 4+"). A 2014-era book
   (Xanathar's, Tasha's) has no such line — those feats are simply "Feat". */
function featPickHead(w){return String((w&&w.e&&w.e.description)||"").split("\n")[0];}
function featPickKind(w){
  if(!w)return "feat";
  if(w.k!=="feat")return "trait";
  const h=featPickHead(w), hit=FEAT_KINDS.find(k=>k.re&&k.re.test(h));
  return hit?hit.key:"feat";
}
/* Read only the first line: the body of a feat is full of the word
   "prerequisite" in prose, and this is a filter, not a rules engine. */
function featPickPrereq(w){
  const m=featPickHead(w).match(/prerequisites?:\s*([^\n]+)/i);
  return m?m[1].trim().replace(/[)\s.]+$/,""):"";
}
/* The heading a row sits under. Feats group by category; a loose trait groups
   by its own `source`, because that is what those packs actually are — 76 of
   Tasha's traits are Eldritch Invocations, Battle Master Maneuvers and
   Artificer Infusions, and one flat "Traits" bucket would bury the lot. */
function featPickGroup(w){
  const k=featPickKind(w);
  return k==="trait"?(String(w.e.source||"").trim()||"Traits"):featKindDef(k).group;
}
function featPickName(w){return dispName(w.e,w.k==="feat"?"feats":"features");}
/* what the sheet calls it once added — the "Feat: X" wrapper grantFeatDef uses */
function featPickStoredName(w){return w.k==="feat"?("Feat: "+(w.e.name||"Feat")):(w.e.name||"Trait");}
function featPickHas(nm){return (character.features||[]).some(f=>String(f.name||"").trim().toLowerCase()===String(nm||"").trim().toLowerCase());}
/* Add one picked entry. Returns the record, or null if the sheet already has
   it — picking something you have is a misclick far more often than it is a
   deliberate second copy, which is also why the row shows an "added" badge. */
function addPickedFeature(w){
  if(!w||!w.e)return null;
  const e=w.e, nm=featPickStoredName(w);
  if(featPickHas(nm))return null;
  addFeatureFromDef({name:nm,description:e.description||"",effects:Array.isArray(e.effects)?e.effects:[],
                     uses:e.uses,cost:e.cost,source:e.source||""},null);
  const added=character.features[character.features.length-1];
  /* re-stamp against the real entry: addFeatureFromDef only saw the object
     built above, which has no pack and — for a feat — the wrong name */
  if(added)stampSrc(added,e,"feature",w.k==="feat"?"feats":"features");
  return added||null;
}
function browseFeatures(){
  const list=featPickList();
  if(!list.length)return openFeatureForm();
  const present=FEAT_KINDS.filter(k=>list.some(w=>featPickKind(w)===k.key));
  const srcs=[...new Set(list.map(w=>String(w.e._source||"")).filter(Boolean))].sort();
  const facets=[{key:"kind",label:"Type",type:"multi",
                 options:present.map(k=>({value:k.key,label:k.label})),
                 match:(w,a)=>a.has(featPickKind(w))}];
  /* only worth a row of pills once more than one pack is loaded */
  if(srcs.length>1)facets.push({key:"pack",label:"Pack",type:"multi",
    options:srcs.map(s=>({value:s.toLowerCase(),label:s})),
    match:(w,a)=>a.has(String(w.e._source||"").toLowerCase())});
  facets.push({key:"noreq",label:"No prerequisite",type:"toggle",match:w=>!featPickPrereq(w)});
  openBrowse({
    noun:"feats & traits", noun1:"feat or trait", items:list, id:w=>w.id,
    /* the description too: "which feat gives me advantage on saves" is the
       question this browser exists to answer, and the list is small enough */
    search:w=>`${w.e.name} ${w.e.source||""} ${w.e.description||""}`,
    row:w=>{const p=featPickPrereq(w);
      return {title:featPickName(w),tag:p?(p.length>30?p.slice(0,29)+"…":p):(w.e._source||"")};},
    /* group order first, then the heading, then the name — the list is rendered
       in this order and a heading is emitted whenever it changes, so anything
       sharing a heading has to be adjacent */
    sort:(a,b)=>FEAT_KINDS.findIndex(k=>k.key===featPickKind(a))-FEAT_KINDS.findIndex(k=>k.key===featPickKind(b))
      ||featPickGroup(a).localeCompare(featPickGroup(b))
      ||String(a.e.name||"").localeCompare(String(b.e.name||"")),
    group:featPickGroup,
    added:w=>featPickHas(featPickStoredName(w)),
    preview:w=>{const bits=[w.k==="trait"?(String(w.e.source||"").trim()||"Trait"):featKindDef(featPickKind(w)).label,
                            w.e._source||""].filter(Boolean);
      openModal(featPickName(w),`<p class="hint" style="font-family:var(--head);text-transform:uppercase;letter-spacing:.05em">${esc(bits.join(" · "))}</p><div class="desc">${descHTML(w.e.description||"—")}</div>`);},
    onCustom:()=>openFeatureForm(),
    facets,
    onAdd:entries=>{entries.forEach(addPickedFeature);renderFeatures();recompute();scheduleSave();}
  });
}

/* ---- glossary editor ---- */
function openGlossForm(existing){
  const g=existing||{id:uid(),term:"",type:"text",text:"",image:null};
  openModal(existing?"Edit entry":"New glossary entry",`
    <div class="field"><label class="f">Term</label><input id="gTerm" value="${esc(g.term)}" placeholder="Frightened, Fireball, House rule…"></div>
    <div class="field"><label class="f">Type</label><select id="gType"><option value="text"${g.type==="text"?" selected":""}>Text</option><option value="image"${g.type==="image"?" selected":""}>Rules image</option></select></div>
    <div class="field" id="gTextWrap"><label class="f">Explanation</label><textarea id="gText">${esc(g.text||"")}</textarea></div>
    <div class="field" id="gImgWrap" style="display:none"><label class="f">Rules image</label>
      <div class="drop" id="gDrop"><span>Tap to choose a screenshot or photo</span>${g.image?`<img src="${g.image}">`:""}<input type="file" id="gFile" accept="image/*" class="hidefile"></div></div>
    <div class="m-actions"><button class="tbtn" id="gCancel">Cancel</button><button class="tbtn primary" id="gSave">${existing?"Save":"Add"}</button></div>`);
  let img=g.image||null;
  const type=document.getElementById("gType"),tw=document.getElementById("gTextWrap"),iw=document.getElementById("gImgWrap");
  function sync(){tw.style.display=type.value==="text"?"":"none";iw.style.display=type.value==="image"?"":"none"}
  type.addEventListener("change",sync);sync();
  const drop=document.getElementById("gDrop"),file=document.getElementById("gFile");
  drop.addEventListener("click",e=>{if(e.target!==file)file.click()});
  file.addEventListener("change",()=>{const f=file.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{img=r.result;drop.innerHTML=`<span>Image ready — tap to replace</span><img src="${img}">`;drop.appendChild(file)};r.readAsDataURL(f)});
  document.getElementById("gCancel").addEventListener("click",closeModal);
  document.getElementById("gSave").addEventListener("click",()=>{
    const term=document.getElementById("gTerm").value.trim();if(!term){alert("Give the entry a term.");return;}
    const rec={id:g.id,term,type:type.value,text:document.getElementById("gText").value,image:img};
    const i=character.glossary.findIndex(x=>x.id===g.id);if(i>=0)character.glossary[i]=rec;else character.glossary.push(rec);
    closeModal();renderGloss();renderFeatures();renderInventory();renderAllRT();scheduleSave();
  });
}

