/* ================= extensions: manifests, sources, the install pipeline (#102) =================
   A manifest is the data zip's own fieldbook-data.json, extended (format 2):
   packs with a version, sha256, category, minimum app and descriptions, at
   paths relative to the manifest. Sources are where manifests come from: the
   built-in official source (the release tag on raw.githubusercontent.com),
   manifest URLs, and old-style plain URLs (fetchAllRules()). Every way of
   installing builds candidates, then one plan, one confirm, one all-or-nothing
   install. Spec: src/docs/specs/2026-10-26-extensions-manifest-design.md */
const EXT_CATS=["rules"];
const EXT_SUMMARY_MAX=140,EXT_DESC_MAX=4000,EXT_MAN_MAX=65536,EXT_PACKS_MAX=1000,EXT_FILE_MAX=33554432;
const EXT_CHECK_MS=10000,EXT_FILE_MS=30000;
/* ---- SHA-256, in JavaScript: whether a file:// page may use crypto.subtle
   differs by browser, and the suites check this against Node's crypto ---- */
const SHA256_K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256Hex(bytes){
  /* ArrayBuffer.isView, not instanceof Uint8Array: the harness (and any other
     cross-realm caller) hands in a typed array made by a different realm's
     Uint8Array constructor, which instanceof would reject (#102) */
  const view=ArrayBuffer.isView(bytes)?bytes:null;
  const src=view?new Uint8Array(view.buffer,view.byteOffset,view.byteLength):new Uint8Array(0),len=src.length;
  const total=((len+9+63)>>6)<<6,m=new Uint8Array(total);
  m.set(src);m[len]=0x80;
  const dv=new DataView(m.buffer);
  dv.setUint32(total-8,Math.floor(len/0x20000000));dv.setUint32(total-4,(len*8)>>>0);
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const W=new Uint32Array(64),rot=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let off=0;off<total;off+=64){
    for(let i=0;i<16;i++)W[i]=dv.getUint32(off+i*4);
    for(let i=16;i<64;i++){
      const s0=rot(W[i-15],7)^rot(W[i-15],18)^(W[i-15]>>>3),s1=rot(W[i-2],17)^rot(W[i-2],19)^(W[i-2]>>>10);
      W[i]=(W[i-16]+s0+W[i-7]+s1)>>>0;
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(let i=0;i<64;i++){
      const t1=(h+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+SHA256_K[i]+W[i])>>>0;
      const t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  return H.map(x=>x.toString(16).padStart(8,"0")).join("");
}
/* ---- reading a manifest ---- */
function extUrl(u){return typeof u==="string"&&/^https?:\/\//i.test(u)?u:"";}
function extText(s,max){return typeof s==="string"?s.slice(0,max):"";}
/* a path relative to the manifest: an ALLOW-list, not a blacklist of
   "dangerous" characters. new URL() rewrites its whole input before it
   collapses ../ dot-segments — it decodes %2e, and it strips every ASCII tab
   and newline (WHATWG URL spec) wherever they fall, not just at the ends — so
   a blacklist chases one bypass at a time (round 1 caught "%2e%2e" but not
   "."+TAB+"." reassembling into ".." post-parse). Every "/"-separated segment
   must instead be ONLY letters, digits, "." "_" "-", and not "." or ".." on
   its own; nothing in that class survives URL rewriting into something new,
   and nothing outside it (no "%", "\", ":", control character, space, "?",
   "#", empty segment) is ever a legitimate pack path (#102 fix round 2) */
function extRelPath(p){
  const s=typeof p==="string"?p:"";
  if(!s)return "";
  const segs=s.split("/");
  return segs.every(x=>/^[A-Za-z0-9._-]+$/.test(x)&&x!=="."&&x!=="..")?s:"";
}
function extKey(system,file){return String(system)+"|"+String(file);}
/* one pack of a manifest, normalised, or null when it can't be installed from */
function extEntry(p,builtFor){
  if(!p||typeof p!=="object")return null;
  const path=extRelPath(p.file),file=path.split("/").pop(),system=typeof p.system==="string"?p.system.trim():"";
  if(!path||!system||!/^[A-Za-z0-9._-]+\.json$/.test(file)||!parseDataVer(p.version))return null;
  const app=v=>typeof v==="string"&&/^\d+\.\d+\.\d+$/.test(v)?v:"";
  return {path,file,system,
    category:typeof p.category==="string"&&p.category.trim()?p.category.trim():"rules",
    title:extText(p.title,200)||system,summary:extText(p.summary,EXT_SUMMARY_MAX),description:extText(p.description,EXT_DESC_MAX),
    version:p.version,minApp:app(p.minApp)||app(builtFor),
    sha256:/^[0-9a-f]{64}$/.test(String(p.sha256||""))?p.sha256:"",size:Math.max(0,num(p.size)),
    license:extText(p.license,64),attribution:extText(p.attribution,2000),
    requires:(Array.isArray(p.requires)?p.requires:[]).filter(r=>r&&typeof r==="object"&&typeof r.pack==="string"&&r.pack.trim())
      .slice(0,50).map(r=>({pack:extText(r.pack.trim(),200),file:extText(typeof r.file==="string"?r.file:"",200),url:extUrl(r.url)}))};
}
function readManifest(obj,byteLength){
  if(num(byteLength)>EXT_MAN_MAX)throw new Error("the manifest is larger than 64 KB");
  if(!obj||typeof obj!=="object"||Array.isArray(obj)||obj._type!=="fieldbook-data"||!Array.isArray(obj.packs))
    throw new Error("it isn't a Fieldbook manifest");
  if(obj.packs.length>EXT_PACKS_MAX)throw new Error("it lists more than 1,000 packs");
  const builtFor=typeof obj.builtFor==="string"?obj.builtFor:"",byKey=new Map();
  obj.packs.forEach(p=>{
    const e=extEntry(p,builtFor);if(!e)return;
    const k=extKey(e.system,e.file),ex=byKey.get(k);
    if(!ex||cmpDataVer(e.version,ex.version)>0)byKey.set(k,e);
  });
  return {name:extText(obj.name,120),homepage:extUrl(obj.homepage),version:typeof obj.version==="string"?obj.version:"",builtFor,packs:[...byKey.values()]};
}
/* a pack this app is too old for (spec decision 3) */
function extTooNew(e){return !!(e&&e.minApp)&&cmpDataVer(e.minApp,APP_VERSION)>0;}
/* ---- sources (spec §4) ---- */
function extOfficial(){return {id:"official",kind:"official",url:"",on:true,checked:0,error:"",manifest:null,base:""};}
/* settings.rulesSources and the legacy rulesUrl -> settings.sources, once; the
   official source exactly once. True when anything changed. */
function convertSources(s){
  const before=JSON.stringify([s.sources,s.packOrigin,s.dismissedUpdates,s.rulesSources,s.rulesUrl]);
  const isObj=o=>!!o&&typeof o==="object"&&!Array.isArray(o);
  let list=(Array.isArray(s.sources)?s.sources:[]).filter(x=>isObj(x)&&(
    x.kind==="official"||(x.kind==="manifest"&&extUrl(x.url))||(x.kind==="plain"&&typeof x.url==="string"&&x.url.trim())));
  let off=list.find(x=>x.kind==="official");
  list=list.filter(x=>x.kind!=="official");
  off=Object.assign(extOfficial(),off||{},{id:"official",kind:"official",url:""});
  const old=[].concat(Array.isArray(s.rulesSources)?s.rulesSources:[],s.rulesUrl?[s.rulesUrl]:[])
    .map(u=>String(u||"").trim()).filter(Boolean);
  old.forEach(u=>{if(!list.some(x=>x.url===u))list.push({id:uid(),kind:"plain",url:u,on:true,checked:0,error:"",manifest:null,base:""});});
  s.sources=[off].concat(list);
  delete s.rulesSources;delete s.rulesUrl;
  if(!isObj(s.packOrigin))s.packOrigin={};
  if(!isObj(s.dismissedUpdates))s.dismissedUpdates={};
  return JSON.stringify([s.sources,s.packOrigin,s.dismissedUpdates,s.rulesSources,s.rulesUrl])!==before;
}
/* ---- offers and rows ---- */
function extOffers(){
  const out=[];
  (settings.sources||[]).forEach(src=>{
    if(!src.on||!src.manifest||!Array.isArray(src.manifest.packs))return;
    src.manifest.packs.forEach(entry=>out.push({entry,source:src}));
  });
  return out;
}
/* the offer for one pack: the source that installed it, if it still offers it;
   otherwise the newest; on a tie, the official source */
function availableFor(system,file){
  const all=extOffers().filter(o=>o.entry.system===system&&o.entry.file===file);
  if(!all.length)return null;
  const origin=(settings.packOrigin||{})[extKey(system,file)];
  const own=all.find(o=>o.source.id===origin);if(own)return own;
  return all.slice().sort((a,b)=>cmpDataVer(b.entry.version,a.entry.version)||((b.source.kind==="official")-(a.source.kind==="official")))[0];
}
function extRowState(group,offer){
  if(offer&&EXT_CATS.indexOf(offer.entry.category)<0)return "unsupported";
  if(!group)return offer?(extTooNew(offer.entry)?"blocked":"install"):"none";
  if(!offer)return "none";
  /* a loaded pack with no parseable dataVersion (unversioned data predates
     versioning, #83) can never read as "current" against a versioned offer,
     so it falls through to "update" rather than getting stuck unmatched */
  const have=group.dataVersion;
  if(parseDataVer(have)&&cmpDataVer(offer.entry.version,have)<=0)return "current";
  return extTooNew(offer.entry)?"blocked":"update";
}
/* one row per loaded pack, then one per offered pack that isn't loaded */
function extPackRows(){
  const rows=[],seen=new Set();
  loadedRulesGroups().forEach(g=>{
    const key=g.isFile?extKey(g.source,g.label):g.key;seen.add(key);
    const offer=g.isFile?availableFor(g.source,g.label):null;
    rows.push({key,group:g,offer,state:extRowState(g,offer)});
  });
  extOffers().forEach(o=>{
    const key=extKey(o.entry.system,o.entry.file);if(seen.has(key))return;seen.add(key);
    const offer=availableFor(o.entry.system,o.entry.file);
    rows.push({key,group:null,offer,state:extRowState(null,offer)});
  });
  return rows;
}
function extUpdateRows(){return extPackRows().filter(r=>r.state==="update");}
/* the pill's count: updates newer than the version the player cleared (spec decision 9) */
function extPillCount(){
  const d=settings.dismissedUpdates||{};
  /* a dismissal that isn't a parseable version (corrupt settings, a stray {})
     never suppresses the pill, rather than reading as "always newer, never
     dismissed" via cmpDataVer's 0-on-invalid default (#102 fix round 1) */
  return extUpdateRows().filter(r=>!d[r.key]||!parseDataVer(d[r.key])||cmpDataVer(r.offer.entry.version,d[r.key])>0).length;
}
function dismissUpdates(){
  if(!settings.dismissedUpdates||typeof settings.dismissedUpdates!=="object")settings.dismissedUpdates={};
  extUpdateRows().forEach(r=>{settings.dismissedUpdates[r.key]=r.offer.entry.version;});
}
/* ---- the network: every call has a timeout (constraint 2) ---- */
/* The WHOLE response is raced against the timer, not just the wait for
   headers: a host that answers promptly and then stalls the body must still
   time out (#102 fix round 1, Important 2 — Promise.race used to cover only
   fetch(), leaving r.arrayBuffer() free to hang forever). AbortController,
   where it exists, actually stops the download on a timeout instead of
   leaving it running in the background. `cap`, when given, refuses a
   Content-Length above it before the body is ever read — EXT_MAN_MAX for a
   manifest check, EXT_FILE_MAX for a pack file — so a hostile or mistaken
   host can't make the tab buffer a huge response just to have it thrown
   away afterwards. */
function extFetchBytes(url,ms,cap){
  const ac=typeof AbortController==="function"?new AbortController():null;
  let timer;
  const timeout=new Promise((_,rej)=>{timer=setTimeout(()=>{if(ac)ac.abort();rej(new Error("it took too long to answer"));},ms);});
  const opts=ac?{cache:"no-store",signal:ac.signal}:{cache:"no-store"};
  const run=fetch(url,opts).then(r=>{
    if(!r||!r.ok){const e=new Error("HTTP "+(r?r.status:"error"));e.status=r?r.status:0;throw e;}
    if(cap){
      const len=r.headers&&typeof r.headers.get==="function"?num(r.headers.get("content-length")):0;
      if(len>cap)throw new Error(cap===EXT_MAN_MAX?"the manifest is larger than 64 KB":"it's larger than 32 MB");
    }
    return r.arrayBuffer();
  });
  return Promise.race([run,timeout]).then(b=>new Uint8Array(b)).finally(()=>clearTimeout(timer));
}
/* the official source's manifest URL: the newest release this app can run
   (pickDataRelease(), as the boot data check), at its tag, on raw — which
   answers a file:// page. "" when there is no such release. */
function extOfficialUrl(){
  if(!UPDATE_REPO)return Promise.resolve("");
  return extFetchBytes(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=100`,EXT_CHECK_MS).then(b=>{
    const pick=pickDataRelease(JSON.parse(utf8Text(b)),APP_VERSION);
    return pick?`https://raw.githubusercontent.com/${UPDATE_REPO}/${encodeURIComponent(pick.tag)}/releases/data/fieldbook-data.json`:"";
  });
}
/* One source's manifest. A failure keeps the last good manifest and says why
   on the source's row; the official source on a release from before #102 (no
   releases/data/, a 404) is simply nothing to offer, not an error. */
function checkSource(src){
  const at=Date.now();
  return (src.kind==="official"?extOfficialUrl():Promise.resolve(src.url)).then(url=>{
    if(!url){src.manifest=null;src.base="";return;}
    return extFetchBytes(url,EXT_CHECK_MS,EXT_MAN_MAX).then(bytes=>{
      let obj;try{obj=JSON.parse(utf8Text(bytes));}catch(e){throw new Error("it isn't valid JSON");}
      src.manifest=readManifest(obj,bytes.length);src.base=url;
    },e=>{
      /* only a 404 on THIS fetch — the manifest at the release
         extOfficialUrl() picked — means "a release from before #102,
         nothing to offer"; a 404 from extOfficialUrl()'s OWN fetch (the
         releases list, e.g. a renamed repo) is a real error and must never
         take this branch (#102 fix round 1, Minor 9) */
      if(src.kind==="official"&&e&&e.status===404)e.officialOld=true;
      throw e;
    });
  }).then(()=>{src.checked=at;src.error="";},e=>{
    src.checked=at;
    if(e&&e.officialOld){src.manifest=null;src.base="";src.error="";return;}
    src.error=String((e&&e.message)||e||"it couldn't be reached");
  });
}
/* The last "couldn't save your sources" error from a boot-time checkSources()
   — boot stays quiet (spec §4), but a storage failure still has to be
   reported somewhere (constraint 2), not swallowed; Task 5's Extensions page
   reads this to show it. Cleared the next time any save lands, boot or not
   (#102 fix round 1, Important 3). */
let extSaveError="";
function extSaveErrorText(){return extSaveError;}
/* Every enabled manifest source, and the official one: at boot (quiet, never
   offline) and on Check now. Reads manifests only, never pack files. */
function checkSources(opts){
  const o=opts||{};
  if(navigator.onLine===false)return Promise.resolve(false);
  const list=(settings.sources||[]).filter(s=>s.on&&(s.kind==="official"||s.kind==="manifest"));
  return Promise.all(list.map(checkSource)).then(()=>{
    const err=saveSettings();
    extSaveError=err||"";
    if(err&&!o.boot&&typeof updateRulesStatus==="function")updateRulesStatus("Couldn't save your sources: "+err,"err");
    if(typeof renderExtUI==="function")renderExtUI();
    return true;
  });
}
/* + Add a source URL: fetched once and sorted (spec §4) */
function addSource(url){
  const u=String(url||"").trim();
  if(!extUrl(u))return Promise.resolve({ok:false,why:"That isn't a web address (it must start with http:// or https://)."});
  /* de-duplicate on the NORMALISED url: "HTTPS://Host/m.json" and
     "https://host/m.json" are the same source, differing only in case or a
     default port (#102 fix round 1, Minor 2) */
  let norm=u;try{norm=new URL(u).href;}catch(e){/* keep norm=u; extUrl() already refused anything new URL() can't parse at all */}
  const dup=(settings.sources||[]).some(s=>{let sn=s.url;try{sn=new URL(s.url).href;}catch(e){}return sn===norm;});
  if(dup)return Promise.resolve({ok:false,why:"That source is already in the list."});
  return extFetchBytes(u,EXT_CHECK_MS).then(bytes=>{
    let obj;try{obj=JSON.parse(utf8Text(bytes));}catch(e){return {ok:false,why:"It didn't answer with JSON."};}
    const src={id:uid(),kind:"plain",url:u,on:true,checked:Date.now(),error:"",manifest:null,base:""};
    let empty=false;
    if(obj&&obj._type==="fieldbook-data"){
      try{src.manifest=readManifest(obj,bytes.length);}catch(e){return {ok:false,why:"Its manifest can't be used: "+e.message+"."};}
      src.kind="manifest";src.base=u;empty=!src.manifest.packs.length;
    }else if(!(obj&&typeof obj==="object"&&(isRulesPack(obj)||Array.isArray(obj.include)))){
      return {ok:false,why:"It isn't a Fieldbook manifest or rules file."};
    }
    /* settings.sources is foldLegacySettings()'s job to create — addSource()
       must not assume it ran first (#102 fix round 1, Minor 1: this used to
       throw inside the SAME .then() whose sibling onRejected could never
       catch it, the exact trap the implementer had already fixed in
       runInstall) */
    if(!Array.isArray(settings.sources))settings.sources=[];
    settings.sources.push(src);
    const err=saveSettings();
    return {ok:true,why:err?"Added, but your settings couldn't be saved: "+err
      :(empty?"Added, but it offers nothing this Fieldbook can install.":"")};
  },e=>{
    const base="It couldn't be reached: "+((e&&e.message)||e)+".";
    /* "Failed to fetch" (no e.status) is also what a host with no CORS
       header produces — hint at that too (#102 fix round 1, Minor 2) */
    return {ok:false,why:(e&&e.status)?base:base+" It may also be blocking requests from other sites — it must allow cross-origin reads."};
  });
}
/* ---- candidates (spec §5 step 1) ---- */
function offerCandidate(o){
  const e=o.entry,url=new URL(e.path,o.source.base||o.source.url).href;
  /* a declared size scales the file timeout — EXT_FILE_MS plus a second per
     100 KB claimed — and an entry over the hard cap is refused outright, no
     fetch at all, since it could never pass extVerify's own size check
     anyway (#102 fix round 1, Important 2) */
  const ms=EXT_FILE_MS+Math.ceil((e.size||0)/102400)*1000;
  return {key:extKey(e.system,e.file),category:e.category,system:e.system,file:e.file,title:e.title,version:e.version,
    minApp:e.minApp,sha256:e.sha256,size:e.size,requires:e.requires,origin:o.source.id,manual:false,
    get:()=>e.size>EXT_FILE_MAX?Promise.reject(new Error("it's larger than 32 MB")):extFetchBytes(url,ms,EXT_FILE_MAX)};
}
/* Files, a folder or a dropped set, as {name, bytes, path?}. A zip goes
   through readDataArchive() and keeps its manifest's entries; a loose pack is
   named by its own system and dataVersion.

   Every fieldbook-data.json in the drop is its own folder's manifest, read
   for the directory it sits in — resolved the way readDataArchive() resolves
   a zip's manifest, dir+entry.path, not by matching a bare file name across
   folders (#102 fix round 1, Minor 3: "root/one/x_full.json" and
   "root/two/x_full.json" used to both match the first manifest found,
   anywhere in the drop, because only their shared BASE name was compared).
   One that can't be read is skipped quietly: it is a manifest file, never a
   rules pack, so it is never reported as "it isn't a rules pack". */
function manualCandidates(payloads){
  const cands=[],failed=[],list=Array.isArray(payloads)?payloads:[];
  const fromBytes=(name,bytes,entry,kind)=>{
    let obj;
    try{obj=JSON.parse(utf8Text(bytes));}catch(e){failed.push({name,why:"it isn't valid JSON"});return;}
    if(!obj||typeof obj!=="object"||Array.isArray(obj)){failed.push({name,why:"it isn't a rules pack"});return;}
    if(!isRulesPack(obj)){
      /* a loose zip's non-pack JSON (an app zip's overlay.json or
         class-resources.json) is skipped silently, as importRulesPayloads
         already does for exactly the same files — never a reported failure
         (#102 fix round 1, Minor 4) */
      if(kind!=="loose")failed.push({name,why:"it isn't a rules pack"});
      return;
    }
    const file=String(name).split("/").pop(),system=srcLabel(obj);
    const e=entry&&entry.system===system?entry:null;
    cands.push({key:extKey(system,file),category:e?e.category:"rules",system,file,title:e?e.title:system,
      version:e?e.version:(typeof obj.dataVersion==="string"?obj.dataVersion:""),minApp:e?e.minApp:"",
      sha256:e?e.sha256:"",size:bytes.length,requires:e?e.requires:[],origin:"manual",manual:true,
      get:()=>Promise.resolve(bytes)});
  };
  const manFiles=new Set(),metaByPath=new Map();
  list.forEach(p=>{
    if(!p)return;
    const path=String((p&&(p.path||p.name))||"");
    if(path.split("/").pop()!=="fieldbook-data.json")return;
    manFiles.add(p);
    if(!p.bytes||!ArrayBuffer.isView(p.bytes))return;
    let man;try{man=readManifest(JSON.parse(utf8Text(p.bytes)),p.bytes.length);}catch(e){return;}
    const dir=path.slice(0,path.length-"fieldbook-data.json".length);
    man.packs.forEach(entry=>{metaByPath.set(dir+entry.path,entry);});
  });
  list.forEach(p=>{
    if(!p||manFiles.has(p))return;
    const path=String((p&&(p.path||p.name))||"file"),bytes=p.bytes;
    if(!bytes||!ArrayBuffer.isView(bytes)){failed.push({name:path,why:"it couldn't be read"});return;}
    if(isZipBytes(bytes)){
      let arc;
      try{arc=readDataArchive(bytes,path);}catch(e){failed.push({name:path,why:ZIP_WHY[e&&e.code]||"it couldn't be read"});return;}
      arc.packs.forEach(pk=>fromBytes(pk.name,pk.bytes,pk.meta?extEntry(pk.meta,pk.builtFor):null,arc.kind));
      return;
    }
    if(!/\.json$/i.test(path))return;
    fromBytes(path,bytes,metaByPath.get(path)||null);
  });
  return {cands,failed};
}
/* ---- the plan (spec §5 step 2) ---- */
function extLoadedGroup(system,file){return loadedRulesGroups().find(g=>g.isFile&&g.label===file&&g.source===system)||null;}
/* why a candidate can't be installed because of the app's own version: the
   exact minimum only when it's what blocked it (spec decision 3 + rulebook
   fix #2 — "requires Fieldbook newer" is not a version a player can act on) */
function extTooNewWhy(c){return (c.minApp&&extTooNew(c))?"requires Fieldbook "+c.minApp:"requires a newer Fieldbook";}
function planInstall(cands){
  const byKey=new Map();
  (cands||[]).forEach(c=>{const ex=byKey.get(c.key);if(!ex||cmpDataVer(c.version,ex.version)>0)byKey.set(c.key,c);});
  const line=c=>{
    if(EXT_CATS.indexOf(c.category)<0)return {cand:c,outcome:"unsupported",have:"",ticked:false,canTick:false,why:extTooNewWhy(c)};
    if(extTooNew(c))return {cand:c,outcome:"blocked",have:"",ticked:false,canTick:false,why:extTooNewWhy(c)};
    const g=extLoadedGroup(c.system,c.file),have=g?g.dataVersion:"";
    if(!g)return {cand:c,outcome:"install",have,ticked:true,canTick:true,why:""};
    /* spec §5 has the final say on an unparseable version on either side
       (#102 fix round 1, Minor 5): the CANDIDATE having no version is the
       risky direction — it could be a downgrade — so it is an unticked
       "Replace anyway"; only the LOADED side having no version (unversioned
       data predating #83) is safe to tick by default */
    if(!parseDataVer(c.version))return {cand:c,outcome:"replace",have,ticked:false,canTick:true,why:"Replace anyway"};
    if(!parseDataVer(have))return {cand:c,outcome:"replace",have,ticked:true,canTick:true,why:""};
    const d=cmpDataVer(c.version,have);
    if(d>0)return {cand:c,outcome:"update",have,ticked:true,canTick:true,why:""};
    return {cand:c,outcome:d===0?"same":"older",have,ticked:false,canTick:!!c.manual,why:c.manual?"Replace anyway":""};
  };
  const lines=[...byKey.values()].map(line);
  /* a ticked pack's missing requirement, offered by an enabled source, joins
     the plan as its own install line (spec §8) — bounded, never a loop */
  for(let pass=0;pass<10;pass++){
    let added=false;
    lines.filter(l=>l.ticked).forEach(l=>(l.cand.requires||[]).forEach(r=>{
      if(loadedRulesGroups().some(g=>g.source===r.pack))return;
      if(lines.some(x=>x.cand.system===r.pack))return;
      /* the BEST offer, not the first source in settings order (#102 fix
         round 1, Minor 6): the official source sorts first in settings.sources
         (convertSources()), so .find() always returned it even when a
         third-party source offered a newer copy — sorted the same way
         availableFor() picks: newest version wins, a tie goes official */
      const matches=extOffers().filter(x=>x.entry.system===r.pack&&(!r.file||x.entry.file===r.file)&&EXT_CATS.indexOf(x.entry.category)>=0&&!extTooNew(x.entry));
      const o=matches.sort((a,b)=>cmpDataVer(b.entry.version,a.entry.version)||((b.source.kind==="official")-(a.source.kind==="official")))[0];
      if(!o)return;
      lines.push({cand:offerCandidate(o),outcome:"install",have:"",ticked:true,canTick:true,why:"needed by "+l.cand.title});added=true;
    }));
    if(!added)break;
  }
  return lines;
}
/* ---- the install (spec §5 steps 4 and 5): everything fetched and verified
   first; one failure changes nothing ---- */
function extVerify(c,bytes){
  if(bytes.length>EXT_FILE_MAX)throw new Error("it's larger than 32 MB");
  if(c.sha256&&sha256Hex(bytes)!==c.sha256)throw new Error("its sha256 doesn't match the manifest");
  let obj;try{obj=JSON.parse(utf8Text(bytes));}catch(e){throw new Error("it isn't valid JSON");}
  if(!obj||typeof obj!=="object"||Array.isArray(obj)||!isRulesPack(obj))throw new Error("it isn't a rules pack");
  if(srcLabel(obj)!==c.system)throw new Error(`it says it is ${srcLabel(obj)}, not ${c.system}`);
  if(c.version&&obj.dataVersion!==c.version)throw new Error(`it is version ${obj.dataVersion||"(none)"}, the manifest says ${c.version}`);
  return obj;
}
/* Copy `rules` key by key: every array sliced, every non-array object copied
   into a fresh one with the SAME prototype (never a JSON round trip — that
   would turn `requires`/`credits`/`defaultLanguages`/`advancement`'s
   null-prototype maps, packMap()'s whole reason to exist, back into plain
   objects a hostile label like "__proto__" could poison again). Primitives
   copy as themselves. Restoring is just `rules=snapshot` — `rules` is a
   plain reassignable top-level `let`, the same thing resetRules() does. */
function extSnapshotRules(){
  const snap={};
  Object.keys(rules).forEach(k=>{
    const v=rules[k];
    if(Array.isArray(v)){snap[k]=v.slice();return;}
    if(v&&typeof v==="object"){
      const copy=Object.create(Object.getPrototypeOf(v));
      Object.assign(copy,v);
      snap[k]=copy;return;
    }
    snap[k]=v;
  });
  return snap;
}
function runInstall(lines){
  /* de-duplicate by key, keeping the newest (#102 fix round 1, Minor 7):
     planInstall() already guarantees unique keys for every route today, but
     runInstall() must not trust a caller that skips it */
  const byKey=new Map();
  (lines||[]).filter(l=>l.ticked&&l.canTick!==false).forEach(l=>{
    const ex=byKey.get(l.cand.key);
    if(!ex||cmpDataVer(l.cand.version,ex.cand.version)>0)byKey.set(l.cand.key,l);
  });
  const todo=[...byKey.values()];
  const got=[];
  const step=i=>{
    if(i>=todo.length)return Promise.resolve(null);
    const c=todo[i].cand;
    /* extVerify() in its OWN .then: a throw from the fetch and a throw from
       verifying the bytes it returned both need to land on the error branch
       below, and a throw inside an onFulfilled handler is never caught by an
       onRejected passed to that SAME .then() call — only a rejection of the
       promise .then() was called on is */
    return Promise.resolve().then(()=>c.get()).then(bytes=>extVerify(c,bytes))
      .then(obj=>{got.push({c,obj});return step(i+1);},
        e=>({file:c.file,why:String((e&&e.message)||e)}));
  };
  return step(0).then(error=>{
    if(error)return {ok:false,installed:[],error,saveErr:"",skipped:{}};
    if(!got.length)return {ok:true,installed:[],error:null,saveErr:"",skipped:{}};
    if(!settings.packOrigin||typeof settings.packOrigin!=="object")settings.packOrigin={};
    /* all or nothing covers IMPORTING too, not only fetching and verifying
       (#102 fix round 1, Important 1): a pack that passes extVerify (valid
       JSON, right system, right sha256) can still fail inside mergeRules()
       on malformed CONTENT — a bad `requires`, a feature with the wrong
       shape — exactly what importRulesPayloads() already catches per file
       for. One install run must not leave some packs merged and others not,
       so a throw here restores the snapshot taken before any of them ran. */
    const rulesSnap=extSnapshotRules(),originSnap=Object.assign({},settings.packOrigin);
    const installed=[],skipped={};
    let failFile=null;
    try{
      got.forEach(({c,obj})=>{
        failFile=c.file;
        addSkipped(skipped,importPack(obj,c.file));
        settings.packOrigin[c.key]=c.origin;
        installed.push(c.title);
      });
    }catch(e){
      rules=rulesSnap;settings.packOrigin=originSnap;
      reindexRules();recomputeDups();
      return {ok:false,installed:[],error:{file:failFile,why:"it couldn't be merged: "+String((e&&e.message)||e)},saveErr:"",skipped:{}};
    }
    const setErr=saveSettings();
    /* a saveRulesCache() rejection (it never does today — every failure it
       hits is caught and falls back to localStorage — but must not be
       trusted to stay that way) becomes `saveErr` too, instead of leaving
       runInstall's own promise rejected after the pool has already changed
       and skipping the UI refresh below (#102 fix round 1, Important 1) */
    return saveRulesCache().catch(e=>String((e&&e.message)||e)).then(cacheErr=>{
      if(typeof refreshRulesUI==="function")refreshRulesUI();
      renderRulesData();
      return {ok:true,installed,error:null,saveErr:[cacheErr,setErr].filter(Boolean).join(" "),skipped};
    });
  });
}
