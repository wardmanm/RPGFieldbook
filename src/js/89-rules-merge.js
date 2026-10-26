/* ---- does a pack have everything it references? ----

   A pack can lean on content it doesn't ship: Xanathar's 31 subclasses all
   attach to classes from the D&D 2024 pack, and homebrew leans on whatever its
   author had loaded. Until now that failed SILENTLY and misleadingly — the
   subclasses merge, Settings counts them as loaded, and the subclass picker then
   says "this class has no subclasses in the loaded rules", which is false. They
   are loaded; their parent class isn't.

   Two sources, because one alone is not enough:

   - STRUCTURAL: `subclasses[].class` is a real field the app resolves, so a
     missing parent class is detectable with no authoring at all. This is what
     catches a homebrew pack nobody annotated.
   - DECLARED (`requires`, schema §1): for references the schema cannot model.
     `levels[].spells` is prose, so a subclass's expanded spell list names its
     spells only inside sentences — undetectable structurally, and guessing at
     prose would invent as many references as it found.

   This is a PURE function of `rules`, deliberately: mergeRules never runs at
   boot (90-boot.js restores the merged pool from localStorage), so anything
   computed during merge would be lost on reload. Only the declaration is stored.
   Nothing here ever blocks loading — the pack works, minus what it references. */
function missingRequirements(src){
  const out=[];
  const has=(cat,name)=>!!ruleById(cat,name);
  /* structural: a subclass whose parent class isn't loaded is unreachable */
  const orphan=[];
  (rules.subclasses||[]).forEach(s=>{
    if((s._source||"")!==src||!s.class)return;
    if(!findClassDef(s.class)&&orphan.indexOf(s.class)<0)orphan.push(s.class);
  });
  if(orphan.length)out.push({pack:"",file:"",missing:orphan.map(n=>({cat:"classes",name:n}))});
  /* declared */
  const d=rules.requires&&rules.requires[src];
  const decl=Array.isArray(d)?d:[];
  decl.forEach(grp=>{
    if(!grp||typeof grp!=="object")return;
    const miss=[];
    RULE_CATS.forEach(cat=>{        /* a category we don't know is ignored, not reported */
      (Array.isArray(grp[cat])?grp[cat]:[]).forEach(name=>{
        if(name&&!has(cat,name))miss.push({cat,name:String(name)});
      });
    });
    if(miss.length)out.push({pack:String(grp.pack||""),file:String(grp.file||""),missing:miss});
  });
  return out;
}
/* "Classes" -> "class", not "classe". Spelled out rather than de-pluralised,
   because the display names are not all regular ("Species" is both). */
const CAT_ONE={keywords:"glossary entry",features:"trait",items:"item",spells:"spell",
  races:"species",classes:"class",feats:"feat",backgrounds:"background",
  subclasses:"subclass",tables:"table"};
function requiresStatusHTML(g){
  const groups=missingRequirements(g.source);
  if(!groups.length)return "";
  const n=groups.reduce((a,b)=>a+b.missing.length,0);
  const lines=groups.map(gr=>{
    /* grouped by category, so eight missing classes read as one line and not as
       the same word repeated eight times */
    const byCat={};
    gr.missing.forEach(m=>{(byCat[m.cat]=byCat[m.cat]||[]).push(m.name);});
    const names=Object.keys(byCat).map(c=>{
      const v=byCat[c];
      return v.length+" "+(v.length===1?(CAT_ONE[c]||c):catName(c).toLowerCase())+": "+v.join(", ");
    }).join("; ");
    const from=gr.file?" — import "+gr.file
      :(gr.pack?" — from "+gr.pack
        :" — load the pack that defines them, then these will work");
    return names+from;
  });
  /* "!" because colour alone can't carry this: in the Classic skin --brick and
     --accent are the SAME value, so this chip and the amber "update available"
     one are indistinguishable by colour. */
  return ` <span class="chip bad" title="${esc("This pack refers to "+n+" entr"+(n===1?"y":"ies")+" that aren't loaded. It still works — anything referring to them just won't fill in.\n\n"+lines.join("\n"))}">! ${n} missing</span>`;
}
/* one line for the status area, so this is visible at import and not only if
   someone happens to open the loaded-data list */
function missingSummary(){
  const bad=loadedRulesGroups().filter(g=>missingRequirements(g.source).length);
  if(!bad.length)return "";
  const names=[...new Set(bad.map(g=>g.source||g.label))];
  return " "+names.join(", ")+(names.length===1?" refers":" refer")+" to content that isn't loaded — see its row under Rules data.";
}
/* One line above the loaded-data list when a data release has newer copies of
   packs the player has loaded (#83). Quiet on purpose (R7): a data release is
   optional. The link is pickDataRelease()'s, kept to github.com. */
function dataUpdateHint(groups){
  const ups=[...new Set(groups.map(g=>({g,st:dataStatus(g)})).filter(x=>x.st.state==="update")
    .map(x=>x.g.source+" v"+x.st.want))];
  if(!ups.length||!dataUpdate)return "";
  return `<p class="hint" style="margin:4px 0 8px">Newer rules data is out: ${esc(ups.join(", "))}. <a href="${esc(dataUpdate.url)}" target="_blank" rel="noopener">Download it from the release page</a>.</p>`;
}
function rulesDataHTML(){
  const groups=loadedRulesGroups();
  const warn=rulesCacheWarning()
    ? `<p class="status err" style="margin:4px 0 8px">${esc(rulesCacheWarning())}</p>` : "";
  if(!groups.length)return warn+`<p class="hint" style="margin:4px 0">No rules data loaded.</p>`;
  const row=(g,withSummary)=>{
    const summary=withSummary?Object.entries(g.cats).map(([c,n])=>`${n} ${catName(c).toLowerCase()}`).join(" · "):"";
    return `<div class="rd-row"><div class="rd-main"><div class="rd-name">${esc(g.label)}${g.isFile&&g.source?` <span class="rd-src">${esc(g.source)}</span>`:""}${dataStatusHTML(g)}${requiresStatusHTML(g)}</div>${summary?`<div class="rd-sub">${esc(summary)}</div>`:""}</div><button class="icon danger" data-rd-del="${esc(g.key)}" title="Remove this data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button></div>`;
  };
  /* whole-system packs first, then one heading per category, Mixed last */
  const order=["rulebook"].concat(RULE_CATS,["mixed"]);
  const label={rulebook:"Rulebook",mixed:"Mixed"};
  let html="";
  order.forEach(b=>{
    const inB=groups.filter(g=>rulesBucket(g)===b);
    if(!inB.length)return;
    html+=`<div class="spell-h">${esc(label[b]||catName(b))} (${inB.length})</div>`;
    /* the heading already names the category on single-category rows */
    html+=inB.map(g=>row(g,b==="rulebook"||b==="mixed")).join("");
  });
  return warn+dataUpdateHint(groups)+html;
}
function renderRulesData(){
  const html=rulesDataHTML();
  ["rulesData","homeRulesData"].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=html;});
  /* The Settings sidebar's Extensions tab (Rules data until #102) counts the pool (#107). It is drawn once by
     openSettings(), so without this it kept the count from when the modal
     opened, whatever an import, fetch, remove or clear did afterwards. Every
     path that changes the pool ends here, which is why the refresh lives here. */
  const badge=document.querySelector('[data-setbadge="extensions"]');
  if(badge)badge.innerHTML=rulesNavBadgeHTML();
  /* the Extensions page's rows are the loaded list now (#102) */
  if(typeof renderExtUI==="function")renderExtUI();
}
/* `rules.requires` and `rules.credits` are keyed by a pack's own LABEL
   (srcLabel()), which a pack author writes freely — nothing stops it being
   "__proto__" or "constructor". A plain object can't hold an "__proto__" key
   safely: `obj["__proto__"]=x` sets the object's PROTOTYPE instead of adding
   a key (the declaration is lost, silently), and `obj["constructor"]` reads
   back the inherited Object constructor when nothing set that key, which
   broke a `.forEach` on it downstream (#88). A null-prototype map has no
   inherited properties at all, so every label — any label — is just an
   ordinary own key. Returns a NEW map; never mutates `o`. */
function packMap(o){
  const m=Object.create(null);
  if(o&&typeof o==="object"&&!Array.isArray(o))Object.keys(o).forEach(k=>{m[k]=o[k];});
  return m;
}
/* Normalise both maps to null-prototype, copying whatever own keys they have
   (plain object or not). For a path that doesn't already run through
   `tidyRules()` (which does the same thing) right after assigning `rules` —
   see the three cache/import restores in rules-packs.md. */
function normPackMaps(){rules.requires=packMap(rules.requires);rules.credits=packMap(rules.credits);rules.defaultLanguages=packMap(rules.defaultLanguages);rules.advancement=packMap(rules.advancement);}
function resetRules(){rules={name:"",version:1,keywords:[],items:[],features:[],spells:[],races:[],classes:[],feats:[],tables:[],requires:packMap(),credits:packMap(),defaultLanguages:packMap(),advancement:packMap()};}
/* An entry's name (a keyword's term) as text, or "" when it has none that can
   be shown: not an object, no name, only spaces, or not text. A number is a
   name written without quotes, so it counts. Every picker, lookup and chip
   reaches an entry by this, so one without it is unreachable, and the first
   `.toLowerCase()` or `x._id=` on it stopped the render (#71). */
function ruleName(x,kind){
  if(!x||typeof x!=="object"||Array.isArray(x))return "";
  const v=kind==="keywords"?x.term:x.name;
  return typeof v==="string"?v.trim():(typeof v==="number"&&Number.isFinite(v)?String(v):"");
}
/* Repair one pool entry in place, or say it cannot be kept. A keyword gets the
   glossary's aliases (glossRepair) and an id if it has none, since its chip
   opens it by id; a numeric name becomes text; an item gets any ammunition
   fields its pack predates (ammoRepairDef()). */
function tidyRule(x,kind){
  if(kind==="keywords")glossRepair(x);
  const nm=ruleName(x,kind);if(!nm)return false;
  const f=kind==="keywords"?"term":"name";
  if(typeof x[f]!=="string")x[f]=nm;
  if(kind==="keywords"&&(typeof x.id!=="string"||!x.id))x.id=typeof x.id==="number"?String(x.id):uid();
  /* a launcher, piece or bundle from a pack older than ammunition gets the
     fields the current packs carry (#96) */
  if(kind==="items")ammoRepairDef(x);
  return true;
}
/* Make the pool safe to render, whatever put it there (#71). mergeRules()
   screens what it merges, but a settings file restores `rules` wholesale and
   the cache hands back whatever was saved, and neither goes through it. Every
   path that changes the pool ends in reindexRules(), so it runs this first. A
   category that is not a list becomes an empty one, and an entry that
   tidyRule() cannot keep is dropped: nothing could reach it, and it broke
   everything that could. Returns how many entries it dropped, per category. */
function tidyRules(){
  const dropped={};
  rules.requires=packMap(rules.requires);
  rules.credits=packMap(rules.credits);
  rules.defaultLanguages=packMap(rules.defaultLanguages);
  rules.advancement=packMap(rules.advancement);
  RULE_CATS.forEach(kind=>{
    const arr=rules[kind];
    if(arr==null)return;
    if(!Array.isArray(arr)){rules[kind]=[];return;}
    const keep=arr.filter(x=>tidyRule(x,kind));
    if(keep.length!==arr.length){dropped[kind]=arr.length-keep.length;rules[kind]=keep;}
  });
  return dropped;
}
/* The status-line sentence for entries a load could not use, "" for none.
   Said where the player is looking when they import, like missingSummary(). */
const CAT_MANY={keywords:"glossary entries"};
function skippedSummary(sk){
  const cats=RULE_CATS.filter(c=>sk&&sk[c]>0);
  if(!cats.length)return "";
  const n=cats.reduce((a,c)=>a+sk[c],0);
  const parts=cats.map(c=>sk[c]+" "+(sk[c]===1?(CAT_ONE[c]||c):(CAT_MANY[c]||catName(c).toLowerCase())));
  /* a keyword is named by its `term` (rules-schema §6.1), everything else by `name` */
  const what=cats.every(c=>c==="keywords")?"no term":(sk.keywords?"no name or term":"no name");
  return cats.length===1?` Skipped ${parts[0]} with ${what}.`:` Skipped ${n} entries with ${what}: ${parts.join(", ")}.`;
}
function addSkipped(into,sk){Object.keys(sk||{}).forEach(c=>{into[c]=(into[c]||0)+sk[c];});return into;}
function keyOf(x,kind){if(!x||typeof x!=="object")return "";return kind==="subclasses"?(String(x.class||"")+"|"+String(x.name||"")).trim().toLowerCase():String(kind==="keywords"?(x.term||""):(x.name||"")).trim().toLowerCase();}
/* merge one rules file (any subset of keywords / traits|features / items / spells) into the live rules.
   Where it came from is stamped on every entry: `_file` for a file import, `_url`
   (the source URL from Settings, not an include under it) for a fetch. `_url` is
   what lets the next Fetch all replace exactly what that source loaded before. */
function srcLabel(obj){return String(obj.system||obj.name||"Rules").trim();}
/* A pack's licence and credit (#83), kept per source LABEL like `requires`, for
   Settings → Credits & licences: null when it states neither. Plain strings,
   capped, never markup — they are shown through esc(). */
function creditOf(title,license,attribution){
  const lic=typeof license==="string"?license.trim():"";
  const att=typeof attribution==="string"?attribution.trim().slice(0,2000):"";
  const l=lic.length<=64?lic:"";
  if(!l&&!att)return null;
  return {title:String(title||"").trim(),license:l,attribution:att};
}
function mergeRules(obj,fileName,url){
  if(obj.name&&!rules.name)rules.name=obj.name;
  const src=srcLabel(obj);
  const traitArr=Array.isArray(obj.features)?obj.features:(Array.isArray(obj.traits)?obj.traits:null);
  /* Character systems this pack's species must NOT be offered to. A supplement
     (Xanathar's, Tasha's) is D&D content the app can't infer a system for, so it
     says who it is NOT for rather than who it is for — see rules-schema §1. */
  const excl=Array.isArray(obj.excludeSystems)
    ? obj.excludeSystems.map(x=>String(x).trim().toLowerCase()).filter(Boolean) : null;
  /* What this pack refers to but doesn't ship (schema §1). Kept per SOURCE on
     `rules`, not stamped per entry: it's pack-level and can be long. It lives in
     `rules` because that whole object is what saveRulesCache() persists and what
     boot restores — mergeRules never runs again. Must stay plain arrays and
     strings for that round trip; rules._dups uses Sets and serialises to {}. */
  if(Array.isArray(obj.requires)){
    /* a restored map that isn't already null-prototype (a settings file's
       plain JSON, say) is fixed here, before the write below — the first
       write of a never-before-seen "__proto__" key is the dangerous one */
    if(!rules.requires||typeof rules.requires!=="object"||Array.isArray(rules.requires)||Object.getPrototypeOf(rules.requires)!==null)
      rules.requires=packMap(rules.requires);
    rules.requires[srcLabel(obj)]=obj.requires;
  }
  if(Array.isArray(obj.defaultLanguages)){
    const l=obj.defaultLanguages.filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim());
    rules.defaultLanguages=packMap(rules.defaultLanguages);if(l.length)rules.defaultLanguages[src]=l;
  }
  if(Array.isArray(obj.advancement)){rules.advancement=packMap(rules.advancement);rules.advancement[src]=obj.advancement;}
  const credit=creditOf(obj.name||src,obj.license,obj.attribution);
  if(credit){
    if(!rules.credits||typeof rules.credits!=="object"||Array.isArray(rules.credits)||Object.getPrototypeOf(rules.credits)!==null)
      rules.credits=packMap(rules.credits);
    rules.credits[src]=credit;
  }
  const cats={keywords:obj.keywords,features:traitArr,items:obj.items,spells:obj.spells,races:obj.races,classes:obj.classes,feats:obj.feats,backgrounds:obj.backgrounds,subclasses:obj.subclasses,tables:obj.tables};
  /* What this pack had that nothing could reach (#71): counted, returned, and
     said on the status line by the importer, rather than dropped in silence. */
  const skipped={};
  Object.keys(cats).forEach(kind=>{
    const arr=cats[kind];if(!Array.isArray(arr))return;
    /* key by SOURCE + name: re-loading the same source replaces its own entries,
       but a same-named entry from a different source is kept (both shown, annotated). */
    const map=new Map((rules[kind]||[]).map(x=>[(x._source||"")+"\u0000"+keyOf(x,kind),x]));
    arr.forEach(raw=>{
      const kw=kind==="keywords"&&raw&&typeof raw==="object"?glossRepair(Object.assign({},raw)):null;
      if(!ruleName(kw||raw,kind)){skipped[kind]=(skipped[kind]||0)+1;return;}
      const base=kw?{id:uid(),term:ruleName(kw,kind),type:kw.type==="image"?"image":"text",text:kw.text||"",image:kw.image||null,cond:!!kw.cond}:Object.assign({},raw);
      if(typeof base.name==="number")base.name=String(base.name);
      /* provenance is the merge's to record, never the pack's: a stray `_url` in
         a file would let some later fetch delete it */
      delete base._file;delete base._url;
      base._source=src;if(fileName)base._file=fileName;if(url)base._url=url;if(obj.rulebook)base._rulebook=1;
      if(obj.dataVersion)base._dataVersion=obj.dataVersion;
      if(excl&&excl.length)base._excludeSystems=excl;
      const nm=keyOf(base,kind);if(!nm){skipped[kind]=(skipped[kind]||0)+1;return;}
      map.set(src+"\u0000"+nm,base);
    });
    rules[kind]=Array.from(map.values());
  });
  reindexRules();
  recomputeDups();
  return skipped;
}
/* Rebuild a pool that was saved whole (a settings file's `rules`: the merged
   pool as it stood the day Export settings ran) through mergeRules(), the path
   every other load takes. Import settings used to assign it to `rules` as it
   came (#70), so nothing checked it: a keyword with `name` for `term` went in
   and broke every render, and a category that wasn't an array broke the next
   re-index.

   Each run of consecutive entries that share their provenance is merged as one
   pack, with that provenance handed back in the fields mergeRules reads
   (`system`, `rulebook`, `dataVersion`, `excludeSystems`, `requires`, the file
   name or URL). So the loaded-data list, the version badges and Fetch all's
   `_url` replacement come back as they were, and so does the order within each
   category, which name lookups take the first match from.

   What survives is mergeRules' decision, not this function's: only a
   non-object is dropped here, since no pack can hold one and a null keyword
   would throw. So when mergeRules learns to read something new, settings
   files get it too.

   It builds on a scratch pool. The live one is swapped out only for this
   synchronous call and put back even if a merge throws. Returns {pool, used,
   skipped}: how many entries survived, and how many of those offered did not
   (not an object, no name, or a repeat of one already in it). */
function poolFromExport(saved){
  const isObj=o=>!!o&&typeof o==="object"&&!Array.isArray(o);
  const STAMPS=["_id","_source","_file","_url","_rulebook","_dataVersion","_excludeSystems"];
  const live=rules;
  let offered=0;
  resetRules();
  try{
    if(isObj(saved)){
      if(typeof saved.name==="string")rules.name=saved.name;
      const req=isObj(saved.requires)?saved.requires:{};
      const defLang=isObj(saved.defaultLanguages)?saved.defaultLanguages:{};
      const adv=isObj(saved.advancement)?saved.advancement:{};
      RULE_CATS.forEach(cat=>{
        /* the same features-or-traits choice mergeRules makes */
        const arr=(cat==="features"&&!Array.isArray(saved.features))?saved.traits:saved[cat];
        if(!Array.isArray(arr))return;
        offered+=arr.length;
        let run=null;
        const flush=()=>{if(run)mergeRules(run.pack,run.file,run.url);run=null;};
        arr.forEach(e=>{
          if(!isObj(e))return;
          const file=(typeof e._file==="string"&&e._file)||null;
          const url=(typeof e._url==="string"&&e._url)||null;
          const pack={system:typeof e._source==="string"?e._source:""};
          if(e._rulebook)pack.rulebook=true;
          if(e._dataVersion)pack.dataVersion=e._dataVersion;
          if(Array.isArray(e._excludeSystems))pack.excludeSystems=e._excludeSystems;
          const key=JSON.stringify([pack.system,file,url,!!pack.rulebook,pack.dataVersion||"",pack.excludeSystems||null]);
          if(!run||run.key!==key){
            flush();
            if(Array.isArray(req[srcLabel(pack)]))pack.requires=req[srcLabel(pack)];
            if(Array.isArray(defLang[srcLabel(pack)]))pack.defaultLanguages=defLang[srcLabel(pack)];
            if(Array.isArray(adv[srcLabel(pack)]))pack.advancement=adv[srcLabel(pack)];
            pack[cat]=[];
            run={key,file,url,pack};
          }
          /* the pack fields above carry these; mergeRules stamps them afresh */
          const c=Object.assign({},e);STAMPS.forEach(k=>{delete c[k];});
          run.pack[cat].push(c);
        });
        flush();
      });
      /* credits ride along per label, like `requires`, for the labels that came back */
      if(isObj(saved.credits))Object.keys(saved.credits).forEach(l=>{
        const c=saved.credits[l];
        if(!isObj(c)||!RULE_CATS.some(k=>(rules[k]||[]).some(e=>e._source===l)))return;
        const cr=creditOf(c.title||l,c.license,c.attribution);
        if(cr){rules.credits=packMap(rules.credits);rules.credits[l]=cr;}
      });
    }
    const used=RULE_CATS.reduce((a,c)=>a+((rules[c]||[]).length),0);
    return {pool:rules,used,skipped:Math.max(0,offered-used)};
  }finally{rules=live;}
}
/* assign an HTML-safe unique id to every rule entry (used as <option> values and
   for lookups). Must NOT contain characters the HTML parser mangles — notably a
   null byte, which the parser turns into U+FFFD inside attribute values.
   Every path that changes the pool ends here — a merge, a fetch, a removal, a
   settings file, the cache at boot — which is why the pool is tidied here first
   (#71). Returns what the tidy dropped, per category, for a caller to report. */
let _ruleSeq=0;
function reindexRules(){
  const dropped=tidyRules();
  _ruleSeq=0;
  RULE_CATS.forEach(kind=>{
    (rules[kind]||[]).forEach(x=>{x._id="r"+(_ruleSeq++);});
  });
  return dropped;
}
/* names that appear in more than one source within a category → shown annotated */
function recomputeDups(){
  rules._dups={};
  RULE_CATS.forEach(kind=>{
    const seen={},dup=new Set();
    (rules[kind]||[]).forEach(x=>{const n=keyOf(x,kind);if(!n)return;if(seen[n])dup.add(n);seen[n]=1;});
    rules._dups[kind]=dup;
  });
}
function dispName(entry,kind){
  const nm=(kind==="keywords"?entry.term:entry.name)||"";
  if(!rules._dups)recomputeDups();
  const dset=rules._dups[kind]||new Set();
  return dset.has(String(nm).trim().toLowerCase())?`${nm} (${entry._source||"?"})`:nm;
}
function ruleById(kind,idOrName){
  const arr=Array.isArray(rules[kind])?rules[kind]:[];
  return arr.find(x=>x&&x._id===idOrName)||arr.find(x=>keyOf(x,kind)===String(idOrName||"").trim().toLowerCase());
}
/* Fetch a URL and follow any "include":[...] (a manifest) relative to it,
   collecting every pack into `out` in order. Nothing is merged here: the caller
   merges a source only once ALL of it has arrived. `seen` stops a loop within
   one source; `memo` holds each URL's request for the whole run, so a file two
   sources both include is still fetched once. Every error names its file. */
function fetchRulesFrom(url,seen,out,memo){
  if(seen.has(url))return Promise.resolve(out);
  seen.add(url);
  const file=url.split("/").pop()||url;
  if(!memo.has(url)){
    memo.set(url,fetch(url,{cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
      .then(obj=>{if(!obj||typeof obj!=="object"||Array.isArray(obj))throw new Error("not a rules file");return obj;})
      .catch(e=>{throw new Error(file+": "+((e&&e.message)||e));}));
  }
  return memo.get(url).then(obj=>{
    out.push(obj);
    const inc=Array.isArray(obj.include)?obj.include:[];
    return inc.reduce((p,ref)=>p.then(()=>{
      let next;try{next=new URL(ref,url).href;}catch(e){throw new Error(file+": can't resolve include "+ref);}
      return fetchRulesFrom(next,seen,out,memo);
    }),Promise.resolve());
  }).then(()=>out);
}
/* Swap in what one source just delivered for what it delivered last time.
   Merge first, then drop that source's old entries the merge did not replace:
   an entry it still serves is replaced in place (mergeRules keys on source +
   name), one it no longer serves goes, and nothing it did not load is touched.
   Synchronous, so a file import or a removal made while the fetch was in flight
   is seen here rather than overwritten. */
function applyFetchedSource(url,packs){
  const old=new Set();
  RULE_CATS.forEach(c=>(rules[c]||[]).forEach(e=>{if(e._url===url)old.add(e);}));
  /* If this source alone owns a label, its fresh copy decides the label's
     `requires` (and credits), so a pack that stopped declaring one doesn't
     keep a false "missing" chip. A label shared with a file import keeps it. */
  dropOwnedPackMeta(new Set(packs.map(srcLabel)),old);
  const skipped={};
  packs.forEach(p=>addSkipped(skipped,mergeRules(p,null,url)));
  RULE_CATS.forEach(c=>{if(rules[c])rules[c]=rules[c].filter(e=>!old.has(e));});
  prunePackMeta();reindexRules();recomputeDups();
  return skipped;
}
/* Settings → Fetch all. Fetching NEVER loses what is loaded (#65): this used to
   resetRules() first, which discarded every pack imported from a file, and when
   the fetch then failed it cached the empty pool over the good one.

   Every source is fetched in full before anything is merged. A source that
   arrives whole replaces the packs it loaded last time; one that fails in any
   part keeps them; a run where nothing arrives changes neither the pool nor the
   cache, and says so. Offline is the expected case, not an edge. Returns a
   promise for the tests; the button ignores it. */
function fetchAllRules(urls){
  /* the plain sources (#102): old-style pack and include URLs, which have no
     versions; a manifest source installs through the plan instead */
  const from=Array.isArray(urls)?urls:(settings.sources||[]).filter(s=>s.kind==="plain"&&s.on).map(s=>s.url);
  const srcs=[...new Set(from.map(s=>String(s||"").trim()).filter(Boolean))];
  if(!srcs.length){updateRulesStatus("There's no plain source to fetch.","err");return Promise.resolve();}
  updateRulesStatus(`Fetching ${srcs.length} source${srcs.length>1?"s":""}…`,"");
  const memo=new Map(),results=[];
  /* a 200 with no rules in it ({} or an error object) is a failure, not "this
     source now serves nothing" — otherwise it would wipe what the source loaded */
  const cats=["keywords","features","traits","items","spells","races","classes","feats","backgrounds","subclasses","tables"];
  const hasRules=o=>cats.some(c=>Array.isArray(o[c])&&o[c].length);
  return srcs.reduce((p,u)=>p.then(()=>fetchRulesFrom(u,new Set(),[],memo)
      .then(packs=>{if(!packs.some(hasRules))throw new Error((u.split("/").pop()||u)+": no rules in it");return packs;})
      .then(packs=>{results.push({url:u,packs});},err=>{results.push({url:u,err:(err&&err.message)||String(err)});})),
    Promise.resolve())
    .then(()=>{
      const ok=results.filter(r=>!r.err),bad=results.filter(r=>r.err);
      const why=bad.map(r=>r.err).join("; ");
      const tail=" If you're offline or the site blocks it (CORS), import the files instead.";
      if(!ok.length){
        /* nothing to save: the pool is untouched, so the cache already matches it */
        renderRulesData();
        updateRulesStatus(`Couldn't fetch ${why}, so nothing changed. ${rulesStatusText()}${tail}`,"err");
        return;
      }
      const skipped={};
      ok.forEach(r=>addSkipped(skipped,applyFetchedSource(r.url,r.packs)));
      const sk=skippedSummary(skipped);
      const saving=saveRulesCache();
      refreshRulesUI();renderRulesData();
      const head=bad.length
        ? `Fetched ${ok.length} of ${results.length} sources. Couldn't fetch ${why}, so what ${bad.length>1?"they":"it"} loaded before is kept. `
        : "Fetched. ";
      const m=missingSummary();
      updateRulesStatus(head+rulesStatusText()+m+sk+(bad.length?tail:""),(bad.length||m||sk)?"err":"ok");
      /* the cache write is reported HERE, on the line the player is reading, not
         only in the red line above the list (storage rule: a write that does not
         land says so) */
      return saving.then(err=>{if(err){renderRulesData();updateRulesStatus(head+err,"err");}});
    });
}
/* ---- importing files (#83) ----
   Why a zip couldn't be imported, in the player's words. */
const ZIP_WHY={
  notzip:"it isn't a zip Fieldbook can read",
  encrypted:"it's password-protected",
  zip64:"it's a ZIP64 archive",
  method:"it uses a compression Fieldbook can't read; re-zip it normally or import the .json files",
  damaged:"it's damaged — download it again",
  toolarge:"it's too large to be rules data",
  toomany:"it has too many files to be rules data",
  kit:"that's the Fieldbook data kit, a tool for building rules data — import a fieldbook-data-standalone zip instead",
  empty:"there's no rules data in it"
};
/* Holds at least one rules category: what tells a pack from the converter's
   own inputs (overlay.json, class-resources.json) inside an old app zip. */
function isRulesPack(o){return RULE_CATS.concat(["traits"]).some(c=>Array.isArray(o[c]));}
/* A label's `requires` and `credits` are kept once per LABEL, and mergeRules
   only ever sets them. When the entries about to be replaced are everything
   that label has, the fresh copy decides: drop them first, so a pack that
   stopped declaring one doesn't keep it. A label another file shares keeps it. */
function dropOwnedPackMeta(labels,old){
  labels.forEach(l=>{
    if(!RULE_CATS.every(c=>(rules[c]||[]).every(e=>(e._source||"")!==l||old.has(e))))return;
    if(rules.requires)delete rules.requires[l];
    if(rules.credits)delete rules.credits[l];
    if(rules.defaultLanguages)delete rules.defaultLanguages[l];
    if(rules.advancement)delete rules.advancement[l];
  });
}
/* One pack from a file, replacing what that same file loaded before (R4).
   mergeRules() alone only adds and replaces, so an entry the new copy dropped
   lingered forever. Keyed on file name AND source, so spells.json from one
   pack never unloads spells.json from another — applyFetchedSource()'s
   pattern, for files. */
function importPack(obj,file){
  const src=srcLabel(obj),old=new Set();
  RULE_CATS.forEach(c=>(rules[c]||[]).forEach(e=>{if(e&&e._file===file&&(e._source||"")===src)old.add(e);}));
  dropOwnedPackMeta([src],old);
  const skipped=mergeRules(obj,file);
  RULE_CATS.forEach(c=>{if(rules[c])rules[c]=rules[c].filter(e=>!old.has(e));});
  prunePackMeta();reindexRules();recomputeDups();
  return skipped;
}
/* Rules files as bytes -> merged into the pool. Pure — no DOM, no storage —
   so the suites drive it directly; importRulesFiles() reads and reports.
   A zip (known by its first bytes, whatever its name) goes through
   readDataArchive(), and each pack inside is imported under its OWN file
   name: the loaded-data rows and version chips stay per pack, and the zip
   replaces the same packs imported loose. A zip is read whole before any of
   it merges, so a damaged one changes nothing. Anything else is one JSON pack.
   Returns {files, archives:[{name,kind,version,count}], failed:[{name,why}],
   skipped}. */
function importRulesPayloads(payloads){
  const res={files:0,archives:[],failed:[],skipped:{}};
  const parse=(name,bytes)=>{
    let obj;
    try{obj=JSON.parse(utf8Text(bytes));}catch(e){res.failed.push({name,why:"not valid JSON"});return null;}
    if(!obj||typeof obj!=="object"||Array.isArray(obj)){res.failed.push({name,why:"not a rules file"});return null;}
    return obj;
  };
  (Array.isArray(payloads)?payloads:[]).forEach(p=>{
    const name=String((p&&p.name)||"file"),raw=p&&p.bytes;
    if(!raw||!ArrayBuffer.isView(raw)){res.failed.push({name,why:"it couldn't be read"});return;}
    const bytes=new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength);
    if(!isZipBytes(bytes)){
      const obj=parse(name,bytes);
      /* importPack/mergeRules are given whatever a pack's JSON claims; a shape
         that parses but breaks something downstream (a bad `requires`, a
         malformed subclass) must not take the other files in this import down
         with it — it is named and skipped like any other bad pack. */
      if(obj){
        try{addSkipped(res.skipped,importPack(obj,name));res.files++;}
        catch(e){res.failed.push({name,why:"not a rules file"});}
      }
      return;
    }
    let arc;
    try{arc=readDataArchive(bytes,name);}
    catch(e){res.failed.push({name,why:ZIP_WHY[e&&e.code]||"it couldn't be read"});return;}
    const before=res.failed.length;let count=0;
    arc.packs.forEach(pk=>{
      const obj=parse(pk.name+" in "+name,pk.bytes);
      if(!obj||(arc.kind==="loose"&&!isRulesPack(obj)))return;
      try{addSkipped(res.skipped,importPack(obj,pk.name));count++;}
      catch(e){res.failed.push({name:pk.name+" in "+name,why:"not a rules file"});}
    });
    if(!count&&arc.kind==="loose"&&res.failed.length===before){res.failed.push({name,why:ZIP_WHY.empty});return;}
    res.archives.push({name,kind:arc.kind,version:arc.version,count});
  });
  return res;
}
/* the first sentences of the status line: each zip, the loose files, each failure */
function importSummary(res){
  const s=[];
  res.archives.forEach(a=>s.push(`Imported ${a.name}: ${a.count} ${a.kind==="loose"?"file":"pack"}${a.count===1?"":"s"}${a.version?", data "+a.version:""}.`));
  if(res.files)s.push(`Merged ${res.files} file${res.files===1?"":"s"}.`);
  res.failed.forEach(f=>s.push(`Couldn't import ${f.name}: ${f.why}.`));
  return s.join(" ");
}
/* Both status lines, Settings' and the home screen's, whichever is on show.
   The home one used to be overwritten with the bare count 400 ms after an
   import, which hid every failure there.

   Neither line is reachable from the Rules tab's own "Import rules files"
   links: #rulesStatus lives in the Settings modal, which isn't open, and
   #homeRulesStatus is on the home screen, hidden behind the sheet. A locked
   or damaged zip imported from there used to show nothing at all. `opts.toast`
   (passed only for the FINAL message, never "Reading…") also raises a toast
   when neither line is on screen to read: no #rulesStatus, and #homeRulesStatus
   is absent or hidden (`offsetParent===null`). It is the toast's own text — the
   status line without its counts (#87) — or `true` for msg itself; `opts.err`
   makes it an error that stays until tapped, `opts.long` gives a notice 6 s.
   toast() sets text itself — never esc() before handing it there. */
function rulesImportStatus(msg,cls,opts){
  updateRulesStatus(msg,cls);
  const h=document.getElementById("homeRulesStatus");if(h)h.textContent=msg;
  const t=opts&&opts.toast;
  if(t&&!document.getElementById("rulesStatus")&&!(h&&h.offsetParent!==null))
    toast(typeof t==="string"?t:msg,null,{err:!!opts.err,long:!!opts.long});
}
/* Settings → Import files, the home screen's import and the Rules tab's two:
   read every file as bytes, import, save the cache, and say what happened.
   A save that does not land is said on the same line (the storage rule).
   Resolves to {msg, cls} once the save has landed or failed, for the suites. */
function importRulesFiles(files){
  const list=Array.from(files||[]);
  rulesImportStatus(`Reading ${list.length} file${list.length===1?"":"s"}…`,"");
  const readOne=f=>new Promise(resolve=>{
    const r=new FileReader();
    r.onload=()=>resolve({name:f.name,bytes:new Uint8Array(r.result)});
    r.onerror=()=>resolve({name:f.name,bytes:null});
    r.readAsArrayBuffer(f);
  });
  return Promise.all(list.map(readOne)).then(payloads=>{
    const res=importRulesPayloads(payloads);
    const saving=saveRulesCache();
    refreshRulesUI();renderRulesData();
    const m=missingSummary(),sk=skippedSummary(res.skipped);
    const msg=(importSummary(res)+" "+rulesStatusText()+m+sk).trim();
    const cls=(res.failed.length||m||sk)?"err":"ok";
    /* The toast says what happened and what went wrong, never the counts: they
       are on the status lines and the Rules tab itself, and on a phone they made
       a 13-line toast that hid after 1.9 s (#87). A file that failed is an error
       that stays; a notice (missing content, skipped entries) is not — importing
       the public zip always notes homebrew's Xanathar's spells — so it gets 6 s. */
    const brief=(importSummary(res)+m+sk).trim()||"Rules imported.";
    rulesImportStatus(msg,cls,{toast:brief,err:res.failed.length>0,long:!!(m||sk)});
    return saving.then(err=>{
      if(!err)return {msg,cls};
      renderRulesData();rulesImportStatus(msg+" "+err,"err",{toast:brief+" "+err,err:true});
      return {msg:msg+" "+err,cls:"err"};
    });
  }).catch(e=>{
    /* importRulesPayloads() itself names each bad pack and never throws, but
       nothing downstream (a storage call, a render) is guaranteed not to — and
       without this, that exception strands "Reading N file(s)…" on screen
       forever and skips the cache save entirely (#83 final review). */
    const msg="Import failed: "+((e&&e.message)||String(e));
    rulesImportStatus(msg,"err",{toast:true,err:true});
    return {msg,cls:"err"};
  });
}

