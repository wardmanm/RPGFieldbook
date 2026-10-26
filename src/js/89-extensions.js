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
      /* abort first, so the refusal really stops the download rather than
         leaving the body streaming in behind it (#102 Task 4 follow-up N4) */
      if(len>cap){if(ac)ac.abort();throw new Error(cap===EXT_MAN_MAX?"the manifest is larger than 64 KB":"it's larger than 32 MB");}
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
/* The last "couldn't save your sources" error from a checkSources() save —
   boot stays quiet (spec §4), but a storage failure still has to be reported
   somewhere (constraint 2), not swallowed; the Extensions page shows it as
   "at the last check". Set by checkSources(); cleared by any successful
   settings save in this fragment — checkSources(), addSource() and
   runInstall() — since each one writes the same sources (#102 fix round 1,
   Important 3; Task 4 follow-up N3). */
let extSaveError="";
function extSaveErrorText(){return extSaveError;}
function extSaveOk(err){if(!err)extSaveError="";return err;}
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
    const err=extSaveOk(saveSettings());
    return {ok:true,why:err?"Added, but your settings couldn't be saved: "+err
      :(empty?"Added, but it offers nothing this Fieldbook can install.":"")};
  },e=>{
    const base="It couldn't be reached: "+((e&&e.message)||e)+".";
    /* fetch() rejects with a TypeError ("Failed to fetch") for a network
       failure, which is also what a host with no CORS header produces — hint
       at that, but only then: never on our own timeout or an HTTP status
       (#102 fix round 1, Minor 2; Task 4 follow-up N2). By name, not
       instanceof: the error can come from another realm. */
    return {ok:false,why:(e&&e.name==="TypeError")?base+" It may also be blocking requests from other sites — it must allow cross-origin reads.":base};
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
   One that can't be read is reported in `failed` with why (its packs then
   install without a sha256 check, and the player should know); a readable
   one is never reported, and never as "it isn't a rules pack" (#102 Task 4
   follow-up N1). */
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
    if(!p.bytes||!ArrayBuffer.isView(p.bytes)){failed.push({name:path,why:"its manifest couldn't be read"});return;}
    let obj;try{obj=JSON.parse(utf8Text(p.bytes));}catch(e){failed.push({name:path,why:"its manifest isn't valid JSON"});return;}
    let man;try{man=readManifest(obj,p.bytes.length);}catch(e){failed.push({name:path,why:"its manifest can't be used: "+((e&&e.message)||e)});return;}
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
    const setErr=extSaveOk(saveSettings());
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
/* ---- the Extensions page (spec §6.2) ----
   Settings → Extensions: one section per category (only rules today), then
   Unsupported, then Sources. Every string a manifest supplies is escaped here;
   only http(s) URLs ever become links (extUrl() in readManifest/extEntry). */
function extParas(t){return String(t||"").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean).map(s=>`<p>${esc(s)}</p>`).join("");}
/* "checked 9:02 pm" (today) or "checked 24/10/2026 9:02 pm"; `bare` drops the
   word, for the dialog's "Checked" line */
function extAgo(t,bare){
  if(!t)return bare?"not yet":"not checked yet";
  const d=new Date(t);
  return (bare?"":"checked ")+(new Date().toDateString()===d.toDateString()?"today, ":d.toLocaleDateString()+" ")+d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
}
function extSourceName(src){
  if(src.kind==="official")return "Fieldbook public data";
  return (src.manifest&&src.manifest.name)||String(src.url||"").replace(/^https?:\/\//i,"");
}
/* a loaded pack's contents, "12 spells · 3 classes": what the old Loaded data
   list showed, kept for a pack no manifest describes */
function extCatsLine(g){return g?Object.entries(g.cats).map(([c,n])=>`${n} ${n===1?(CAT_ONE[c]||c):catName(c).toLowerCase()}`).join(" · "):"";}
/* A requirement chip (spec decision 14): a button that opens the pack's details
   when a source offers it; otherwise a link when the requirement carries an
   http(s) url; otherwise a plain label. One helper for rows and the dialog. */
function extReqOffer(r){return extOffers().find(o=>o.entry.system===r.pack&&(!r.file||o.entry.file===r.file))||null;}
function extReqChip(r){
  const lbl=`requires ${esc(r.pack)}`,u=extUrl(r.url);
  /* the button carries the requirement's FILE too, so a tap opens the same
     offer this check found, not another file of the same pack (#102 Task 5
     review, minor 2) */
  if(extReqOffer(r))return `<button type="button" class="chip ext-req" data-ext-req="${esc(r.pack)}" data-ext-req-file="${esc(r.file||"")}">${lbl}</button>`;
  if(u)return `<a class="chip ext-req" data-ext-req="${esc(r.pack)}" href="${esc(u)}" target="_blank" rel="noopener">${lbl}</a>`;
  return `<span class="chip ext-req ext-plain" data-ext-req="${esc(r.pack)}">${lbl}</span>`;
}
function extMissingReqs(entry){
  return (entry&&entry.requires||[]).filter(r=>!loadedRulesGroups().some(g=>g.source===r.pack));
}
/* the "requires Fieldbook …" chips of an entry: Ruling 2's wording, from
   extTooNewWhy(), the same helper the install plan uses */
function extChipsHTML(r){
  const e=r.offer&&r.offer.entry,chips=[];
  if(e&&(r.state==="blocked"||r.state==="unsupported"))chips.push(`<span class="chip ext-app">${esc(extTooNewWhy(e))}</span>`);
  if(e)extMissingReqs(e).forEach(rq=>chips.push(extReqChip(rq)));
  return chips.length?`<div class="ext-chips">${chips.join("")}</div>`:"";
}
function extSecHTML(key,title,count,body,action){
  const shut=!!(settings.setCollapse||{})["ext:"+key];
  return `<section class="ext-sec">`+
    `<div class="ext-sec-h"><button type="button" class="ext-fold" data-ext-sec="${esc(key)}" aria-expanded="${shut?"false":"true"}"><span class="ext-car" aria-hidden="true">${shut?"▸":"▾"}</span>${esc(title)}${count!=null?` <span class="ext-n">${esc(String(count))}</span>`:""}</button>${action||""}</div>`+
    `<div class="ext-sec-b"${shut?" hidden":""}>${body}</div></section>`;
}
function extRowTitle(r){
  const g=r.group,o=r.offer;
  return o?o.entry.title:(g?(g.isFile&&g.source?g.source:g.label):r.key);
}
function extRowHTML(r){
  const g=r.group,o=r.offer,e=o&&o.entry,title=extRowTitle(r);
  const from=g
    ?(o&&(settings.packOrigin||{})[r.key]===o.source.id?"from "+extSourceName(o.source)
      :(g.isFile?"imported from a file · "+g.label:"fetched from a source URL"))
    :(o?"from "+extSourceName(o.source)+" · not installed":"");
  const have=g&&parseDataVer(g.dataVersion)?g.dataVersion:"";
  let ver="",act="";
  if(r.state==="update"){ver=`${esc(have||"—")} → <b class="ext-up">${esc(e.version)}</b>`;act=`<button type="button" class="tbtn ext-act" data-ext-update="${esc(r.key)}">Update</button>`;}
  else if(r.state==="install"){ver=`<b>${esc(e.version)}</b>`;act=`<button type="button" class="tbtn ext-act" data-ext-install="${esc(r.key)}">Install</button>`;}
  else if(have)ver=esc(have);
  else if(e)ver=esc(e.version);
  /* the boot check's "update available" chips only where no source offers the
     pack (an offer says the same with an Update button); the plain version
     chip never, since the version column shows it */
  const st=g&&!o?dataStatus(g).state:"";
  const status=g?((st==="stale"||st==="update")?dataStatusHTML(g):"")+requiresStatusHTML(g):"";
  const sum=(e&&e.summary)||extCatsLine(g);
  const del=g?`<button type="button" class="icon danger ext-del" data-rd-del="${esc(g.key)}" aria-label="${esc("Remove "+title)}" title="Remove this data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>`:"";
  return `<div class="ext-row"><div class="ext-main"><button type="button" class="ext-name" data-ext-open="${esc(r.key)}">${esc(title)}</button>${status}`+
    (sum?`<div class="ext-sum">${esc(sum)}</div>`:"")+
    (from?`<div class="ext-from">${esc(from)}</div>`:"")+
    extChipsHTML(r)+
    `</div>${ver||act||del?`<div class="ext-side">${ver?`<span class="ext-ver">${ver}</span>`:""}${act}${del}</div>`:""}</div>`;
}
function extSourcesHTML(){
  const rows=(settings.sources||[]).map(s=>{
    const name=extSourceName(s),note=s.kind==="plain"?"plain file":(s.error?"couldn't check: "+s.error:extAgo(s.checked));
    const sub=s.kind==="official"?"built in · "+note:(s.kind==="manifest"?String(s.url).replace(/^https?:\/\//i,"")+" · "+note:note);
    const ctl=s.kind==="official"
      ?`<button type="button" class="switch ${s.on?"on":""}" data-ext-src-on="${esc(s.id)}" role="switch" aria-checked="${s.on?"true":"false"}" aria-label="Use Fieldbook public data"></button>`
      :(s.kind==="plain"?`<button type="button" class="tbtn ext-act" data-ext-src-fetch="${esc(s.id)}">Fetch</button>`:"")+`<button type="button" class="tbtn ext-act" data-ext-src-del="${esc(s.id)}">Remove</button>`;
    return `<div class="ext-src"><div class="ext-main"><b>${esc(name)}</b><div class="ext-from${s.error?" ext-err":""}">${esc(sub)}</div></div>${ctl}</div>`;
  }).join("");
  return (rows?`<div class="ext-list">${rows}</div>`:"")+
    `<div class="ext-add"><input id="extAddUrl" type="url" inputmode="url" placeholder="https://…/fieldbook-data.json" aria-label="Source URL"><button type="button" class="tbtn ext-act" id="extAddGo">+ Add a source URL</button></div>`+
    `<div class="ext-acts"><button type="button" class="tbtn ext-act" id="extCheckNow">Check now</button><button type="button" class="tbtn ext-act" id="extManual">Manual install…</button></div>`;
}
function extPageHTML(){
  const rows=extPackRows(),rules=rows.filter(r=>r.state!=="unsupported"),uns=rows.filter(r=>r.state==="unsupported");
  const ups=rows.filter(r=>r.state==="update");
  const warn=rulesCacheWarning()?`<p class="status err">${esc(rulesCacheWarning())}</p>`:"";
  /* a settings save that failed at the last source check (boot is quiet, so
     this is where it is said: constraint 2) */
  const saveErr=extSaveErrorText()?`<p class="status err" id="extSaveErr">${esc("Couldn't save your sources at the last check: "+extSaveErrorText())}</p>`:"";
  const banner=ups.length?`<div class="ext-banner"><span class="ext-grow"><b>${ups.length} update${ups.length===1?"":"s"}</b> · ${esc(ups.map(r=>r.offer.entry.title).join(", "))}</span><button type="button" class="tbtn primary ext-act" id="extUpdateAll">Update all</button></div>`:"";
  const rulesBody=rules.length?`<div class="ext-list">${rules.map(extRowHTML).join("")}</div>`:`<p class="hint">No rules data yet. Install it from a source below, or use Manual install.</p>`;
  return `<div id="extPage">`+warn+saveErr+banner+
    extSecHTML("rules","Rules data",rules.length,rulesBody,rules.some(r=>r.group)?`<button type="button" class="tbtn danger ext-secbtn" id="extRemoveRules">Remove all</button>`:"")+
    (uns.length?extSecHTML("unsupported","Unsupported",uns.length,`<div class="ext-list">${uns.map(extRowHTML).join("")}</div>`,""):"")+
    extSecHTML("sources","Sources",(settings.sources||[]).length,extSourcesHTML(),
      (settings.sources||[]).some(s=>s.kind!=="official")?`<button type="button" class="tbtn danger ext-secbtn" id="extRemoveSources">Remove all</button>`:"")+
    `</div>`;
}
/* ---- the details dialog (spec §6.3) ---- */
function extRowFor(key){return extPackRows().find(r=>r.key===key)||null;}
function extDetailsHTML(key){
  const foot=act=>`<div class="m-actions"><button type="button" class="tbtn" id="extDlgClose">Close</button>${act||""}</div>`;
  const r=extRowFor(key);if(!r)return `<div class="ext-dlg"><p class="hint">That extension isn't listed any more.</p>${foot()}</div>`;
  const e=r.offer&&r.offer.entry,src=r.offer&&r.offer.source,g=r.group;
  const cat=e?(e.category==="rules"?"Rules data":e.category):"Rules data";
  const ver=(g&&parseDataVer(g.dataVersion)?g.dataVersion:"")||(e?e.version:"");
  const others=src?extPackRows().filter(x=>x.key!==key&&x.offer&&x.offer.source.id===src.id):[];
  const kv=(k,v)=>v?`<div><span class="ext-k">${esc(k)}</span>${v}</div>`:"";
  const home=src&&src.manifest&&extUrl(src.manifest.homepage);
  const box=src?`<div class="ext-box"><b>Source</b>`+
    kv("Name",esc(extSourceName(src)))+
    kv("Manifest",esc(src.kind==="official"?"the Fieldbook release":String(src.base||src.url).replace(/^https?:\/\//i,"")))+
    kv("Homepage",home?`<a href="${esc(home)}" target="_blank" rel="noopener">${esc(home.replace(/^https?:\/\//i,""))}</a>`:"")+
    kv("Checked",esc(extAgo(src.checked,true)))+
    kv("Licence",esc([e&&e.license,e&&e.attribution].filter(Boolean).join(" · ")))+`</div>`:
    `<div class="ext-box"><b>Source</b><div>${esc(g&&g.isFile?"Imported from a file: "+g.label:"Fetched from a source URL")}</div></div>`;
  const alsoBox=others.length?`<div class="ext-box"><b>Also from this source</b>${others.map(x=>`<div><button type="button" class="ext-name" data-ext-open="${esc(x.key)}">${esc(x.offer.entry.title)}</button>${x.state==="blocked"||x.state==="unsupported"?` · ${esc(extTooNewWhy(x.offer.entry))}`:""}</div>`).join("")}</div>`:"";
  const act=r.state==="update"?`<button type="button" class="tbtn primary" data-ext-update="${esc(key)}">Update</button>`
    :(r.state==="install"?`<button type="button" class="tbtn primary" data-ext-install="${esc(key)}">Install</button>`:"");
  const desc=e&&e.description?extParas(e.description):(e&&e.summary?extParas(e.summary):"");
  return `<div class="ext-dlg"><div class="ext-meta">${esc(cat)}${ver?" · "+esc(ver):""} · ${g?"installed":"not installed"}</div>`+
    (desc||(g?`<p class="hint">${esc(extCatsLine(g))}</p>`:`<p class="hint">No description.</p>`))+
    extChipsHTML(r)+box+alsoBox+
    foot(act)+`</div>`;
}
function openExtDetails(key){
  const r=extRowFor(key);
  openModal(r?extRowTitle(r):"Extension",extDetailsHTML(key),"",{});
  const body=document.getElementById("mBody");
  const close=document.getElementById("extDlgClose");
  if(close)close.addEventListener("click",()=>{closeModal();settings.setPage="extensions";openSettings();});
  body.querySelectorAll("[data-ext-open]").forEach(b=>b.addEventListener("click",()=>openExtDetails(b.dataset.extOpen)));
  body.querySelectorAll("[data-ext-update],[data-ext-install]").forEach(b=>b.addEventListener("click",()=>extUpdateFromRows([extRowFor(b.dataset.extUpdate||b.dataset.extInstall)])));
  body.querySelectorAll("button[data-ext-req]").forEach(b=>b.addEventListener("click",()=>extReqTap(b)));
}
/* a requirement button: only drawn when a source offers the pack */
function extReqTap(b){
  const o=extReqOffer({pack:b.dataset.extReq,file:b.dataset.extReqFile||""});
  if(o)openExtDetails(extKey(o.entry.system,o.entry.file));
}
function extUpdateFromRows(rows){
  const cands=(rows||[]).filter(r=>r&&r.offer&&(r.state==="update"||r.state==="install")).map(r=>offerCandidate(r.offer));
  if(!cands.length)return;
  /* the plan dialog is Task 6's (#102); until it exists this does nothing */
  if(typeof openInstallPlan==="function")openInstallPlan(planInstall(cands),{back:"settings"});
}
/* A selector that finds the same control again after a repaint: its id, or
   its data-ext-* (or data-rd-*) key; then, for a control whose row the repaint
   removed, Sources' URL box or the toggle of the section it was in (#102 Task 5
   review, minor 1). Values go through CSS.escape where it exists. */
function extCssEsc(v){return typeof CSS!=="undefined"&&CSS&&typeof CSS.escape==="function"?CSS.escape(String(v)):String(v).replace(/["\\]/g,"\\$&");}
function extFocusTargets(a){
  if(!a)return [];
  const out=[];
  if(a.id)out.push("#"+extCssEsc(a.id));
  else{
    const ds=a.dataset||{},k=Object.keys(ds).find(x=>/^(ext|rd)[A-Z]/.test(x));
    if(k)out.push(`[data-${k.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())}="${extCssEsc(ds[k])}"]`);
  }
  const sec=typeof a.closest==="function"?a.closest(".ext-sec"):null;
  const tog=sec&&sec.querySelector("[data-ext-sec]"),key=tog&&tog.dataset?tog.dataset.extSec:"";
  if(key==="sources")out.push("#extAddUrl");
  else if(key)out.push(`[data-ext-sec="${extCssEsc(key)}"]`);
  return out.filter((x,i)=>out.indexOf(x)===i);
}
/* Repaint the page in place. What the player is in the middle of survives it:
   a URL being typed, and keyboard focus (extFocusTargets()). The status line,
   #rulesStatus, sits outside the page, so a repaint never touches it. */
function renderExtUI(){
  const host=document.getElementById("extPage");
  if(host){
    const inp=host.querySelector("#extAddUrl"),url=inp?inp.value:"";
    const a=document.activeElement;
    const focus=a&&typeof host.contains==="function"&&host.contains(a)?extFocusTargets(a):[];
    host.outerHTML=extPageHTML();
    const fresh=document.getElementById("extPage");
    if(fresh){
      const inp2=fresh.querySelector("#extAddUrl");
      if(inp2&&url)inp2.value=url;
      for(const sel of focus){
        let f=null;try{f=fresh.querySelector(sel);}catch(e){/* a selector this browser can't parse: try the next one */}
        if(f&&typeof f.focus==="function"){f.focus();break;}
      }
      wireExtPage(fresh);
    }
  }
  if(typeof renderExtPill==="function")renderExtPill();
  const badge=document.querySelector('[data-setbadge="extensions"]');if(badge)badge.innerHTML=rulesNavBadgeHTML();
}
/* a settings save from the page: said on the status line when it fails
   (constraint 2), and clearing the recorded check error when it lands */
function extSaveSources(what){const err=extSaveOk(saveSettings());if(err)updateRulesStatus("Couldn't save "+(what||"your sources")+": "+err,"err");return err;}
/* bound to the fresh #extPage each time it is drawn, so listeners never stack */
function wireExtPage(root){
  root.addEventListener("click",e=>{
    const t=e.target;let b;
    if(!t||typeof t.closest!=="function")return;
    if((b=t.closest("[data-ext-sec]"))){
      const k="ext:"+b.dataset.extSec;
      if(!settings.setCollapse||typeof settings.setCollapse!=="object")settings.setCollapse={};
      settings.setCollapse[k]=!settings.setCollapse[k];extSaveSources("which sections are folded");return renderExtUI();}
    if((b=t.closest("[data-ext-open]")))return openExtDetails(b.dataset.extOpen);
    if((b=t.closest("[data-ext-update],[data-ext-install]")))return extUpdateFromRows([extRowFor(b.dataset.extUpdate||b.dataset.extInstall)]);
    if(t.closest("#extUpdateAll"))return extUpdateFromRows(extUpdateRows());
    if((b=t.closest("button[data-ext-req]")))return extReqTap(b);
    if((b=t.closest("[data-rd-del]"))){const g=loadedRulesGroups().find(x=>x.key===b.dataset.rdDel);if(g&&confirm(`Remove “${g.label}” (${g.count} entr${g.count===1?"y":"ies"}) from your loaded rules?`))removeRulesGroup(b.dataset.rdDel);return;}
    if(t.closest("#extRemoveRules"))return clearAllRules();
    if(t.closest("#extRemoveSources")){
      if(!confirm("Remove every source you added, and switch off Fieldbook public data?\n\nPacks you've installed stay installed."))return;
      settings.sources=(settings.sources||[]).filter(s=>s.kind==="official");settings.sources.forEach(s=>{s.on=false;});
      const err=extSaveSources();renderExtUI();if(!err)updateRulesStatus("Sources removed. Your installed packs stay.","ok");return;}
    if((b=t.closest("[data-ext-src-on]"))){
      const s=(settings.sources||[]).find(x=>x.id===b.dataset.extSrcOn);if(!s)return;
      s.on=!s.on;extSaveSources();renderExtUI();
      if(s.on)checkSources({});
      return;}
    if((b=t.closest("[data-ext-src-del]"))){
      settings.sources=(settings.sources||[]).filter(x=>x.id!==b.dataset.extSrcDel);
      const err=extSaveSources();renderExtUI();if(!err)updateRulesStatus("Source removed. Its packs stay installed.","ok");return;}
    if((b=t.closest("[data-ext-src-fetch]"))){const s=(settings.sources||[]).find(x=>x.id===b.dataset.extSrcFetch);if(s)fetchAllRules([s.url]);return;}
    if(t.closest("#extCheckNow")){
      if(navigator.onLine===false)return updateRulesStatus("You're offline, so nothing was checked.","err");
      updateRulesStatus("Checking your sources…","");
      return checkSources({}).then(()=>{
        if(extSaveErrorText())return;   /* checkSources() already said so */
        const bad=(settings.sources||[]).filter(s=>s.on&&s.kind!=="plain"&&s.error).length;
        updateRulesStatus(bad?`Checked. ${bad} source${bad===1?"":"s"} couldn't be checked; the row says why.`:"Checked.",bad?"err":"ok");
      });}
    if(t.closest("#extAddGo")){
      const i=document.getElementById("extAddUrl");const v=i?i.value:"";
      updateRulesStatus("Reading that source…","");
      return addSource(v).then(r=>{
        if(!r.ok)return updateRulesStatus(r.why,"err");
        const s=(settings.sources||[])[(settings.sources||[]).length-1];
        const okMsg=s&&s.kind==="plain"?"Source added. Press Fetch on its row to load its rules.":"Source added.";
        const inp=document.getElementById("extAddUrl");if(inp)inp.value="";
        renderExtUI();
        updateRulesStatus(r.why||okMsg,r.why?"err":"ok");
      });}
    /* Task 6 (#102) defines the Manual install dialog */
    if(t.closest("#extManual")&&typeof openManualInstall==="function")return openManualInstall();
  });
  /* a drop onto the page is a Manual install (spec §6.4; Task 6 defines it) */
  if(typeof extWireDrop==="function")extWireDrop(root);
}
/* ---- the plan dialog (spec §5 step 3): each pack's outcome, versions, size
   and source; only install and update lines start ticked; nothing happens
   until Install N ---- */
function extSize(n){n=num(n);return n>=1048576?(Math.round(n/104857.6)/10)+" MB":Math.max(1,Math.round(n/1024))+" KB";}
const EXT_OUTCOME={install:"New",update:"Update",replace:"Replace",same:"Same version",older:"Older than yours",blocked:"",unsupported:""};
/* where a plan line comes from: a file the player chose, or a source's name */
function extPlanFrom(c){
  if(c.manual)return "from a file";
  const src=(settings.sources||[]).find(s=>s.id===c.origin);
  return src?"from "+extSourceName(src):"";
}
function extPlanHTML(lines){
  const ticked=lines.filter(l=>l.ticked&&l.canTick).length;
  if(!lines.some(l=>l.canTick))return `<p class="hint">Nothing to install: ${lines.length?"you already have these, or they need a newer Fieldbook.":"no rules packs found."}</p>`+
    (lines.length?`<div class="ext-list">${lines.map((l,i)=>extPlanRow(l,i)).join("")}</div>`:"")+
    `<div class="m-actions"><button type="button" class="tbtn" id="planClose">Close</button></div>`;
  return `<p class="hint">Nothing changes until you press Install. Every file is checked before any is installed.</p>`+
    `<div class="ext-list">${lines.map((l,i)=>extPlanRow(l,i)).join("")}</div>`+
    `<div class="status" id="planStatus" role="status"></div>`+
    `<div class="m-actions"><button type="button" class="tbtn" id="planClose">Cancel</button><button type="button" class="tbtn primary" id="planGo"${ticked?"":" disabled"}>Install ${ticked}</button></div>`;
}
function extPlanRow(l,i){
  const c=l.cand;
  const ver=l.have&&(l.outcome==="update"||l.outcome==="replace"||l.outcome==="same"||l.outcome==="older")?`${esc(l.have)} → ${esc(c.version||"?")}`:esc(c.version||"");
  const from=extPlanFrom(c);
  const tag=l.outcome==="blocked"||l.outcome==="unsupported"?`<span class="chip ext-app">${esc(l.why)}</span>`
    :`<span class="ext-from">${esc([EXT_OUTCOME[l.outcome]||"",l.why,from].filter(Boolean).join(" · "))}</span>`;
  return `<label class="ext-row ext-plan"><input type="checkbox" data-plan-i="${esc(String(i))}"${l.ticked&&l.canTick?" checked":""}${l.canTick?"":" disabled"}>`+
    `<span class="ext-main"><b>${esc(c.title)}</b><span class="ext-ver"> ${ver}</span><br>${tag}</span><span class="ext-ver">${c.size?esc(extSize(c.size)):""}</span></label>`;
}
/* the toast after an install: the count, then what importPack() skipped (as
   a file import says it, skippedSummary()), then a save that didn't land —
   which makes it an error that stays (constraint 2) */
function extInstalledText(r){
  const n=(r.installed||[]).length,sk=skippedSummary(r.skipped||{}),err=r.saveErr||"";
  const text=`Installed ${n} pack${n===1?"":"s"}`+(sk||err?"."+sk+(err?" "+err:""):"");
  return {text,opts:{err:!!err,long:!!sk}};
}
function openInstallPlan(lines,opts){
  const o=opts||{};
  openModal("Install",extPlanHTML(lines),"",{});
  const back=()=>{closeModal();if(o.back==="settings"){settings.setPage="extensions";openSettings();}};
  const close=document.getElementById("planClose");if(close)close.addEventListener("click",back);
  const go=document.getElementById("planGo");if(!go)return;
  /* the dialog may have been closed, or replaced, while the files downloaded */
  const live=()=>document.getElementById("planGo")===go;
  const count=()=>{const n=lines.filter(l=>l.ticked&&l.canTick).length;go.textContent="Install "+n;go.disabled=!n;};
  document.querySelectorAll("[data-plan-i]").forEach(cb=>cb.addEventListener("change",()=>{const l=lines[num(cb.dataset.planI)];if(l)l.ticked=!!cb.checked;count();}));
  go.addEventListener("click",()=>{
    go.disabled=true;
    const st=document.getElementById("planStatus");if(st){st.className="status";st.textContent="Downloading and checking…";}
    return runInstall(lines).then(r=>{
      if(!r.ok){
        const msg=`Nothing was installed: ${r.error.file} — ${r.error.why}.`;
        if(live()&&st){st.className="status err";st.textContent=msg;count();}
        else toast(msg,null,{err:true});
        return;
      }
      const t=extInstalledText(r);
      toast(t.text,null,t.opts);
      if(live())back();
    });
  });
}
/* ---- Manual install (spec §6.4): files, a folder or a drop, all to the plan ---- */
function extReadFile(f){
  return new Promise(res=>{const r=new FileReader();
    r.onload=()=>res({name:f.webkitRelativePath||f.name,bytes:new Uint8Array(r.result)});
    r.onerror=()=>res({name:f.webkitRelativePath||f.name,bytes:null});r.readAsArrayBuffer(f);});
}
/* only .json and .zip are ever read: a chosen or dropped folder can hold
   anything, and an image would be read into memory just to be ignored */
const extWanted=f=>/\.(json|zip)$/i.test(String((f&&(f.webkitRelativePath||f.name))||""));
function manualInstallFiles(files,opts){
  const list=Array.from(files||[]).filter(extWanted);
  return Promise.all(list.map(extReadFile)).then(payloads=>extManualPlan(payloads,opts));
}
function extManualPlan(payloads,opts){
  const {cands,failed}=manualCandidates(payloads);
  openInstallPlan(planInstall(cands),opts||{});
  if(failed.length){
    const st=document.getElementById("planStatus")||document.querySelector("#mBody .hint");
    if(st)st.insertAdjacentHTML("afterend",`<p class="status err">${esc(failed.map(f=>`Skipped ${f.name}: ${f.why}.`).join(" "))}</p>`);
  }
}
/* a drop: files, a zip, or whole folders (webkitGetAsEntry), read recursively */
function readDropped(dt){
  const out=[];
  const walk=(entry,prefix)=>new Promise(res=>{
    if(!entry)return res();
    if(entry.isFile){
      if(!extWanted(entry))return res();
      return entry.file(f=>extReadFile(f).then(p=>{p.name=prefix+entry.name;out.push(p);res();}),()=>res());
    }
    if(entry.isDirectory){
      /* readEntries() hands a directory over in batches, until an empty one */
      const rd=entry.createReader(),all=[];
      const more=()=>rd.readEntries(es=>{
        if(!es.length)return Promise.all(all.map(x=>walk(x,prefix+entry.name+"/"))).then(()=>res());
        all.push(...es);more();
      },()=>res());
      return more();
    }
    res();
  });
  const items=dt&&dt.items?Array.from(dt.items).filter(it=>it&&it.kind==="file"):[];
  const readFile=f=>f&&extWanted(f)?extReadFile(f).then(p=>{out.push(p);}):Promise.resolve();
  /* an item with no entry (a browser without the entries API for it) is
     still a file: read it as one */
  const jobs=items.length&&typeof items[0].webkitGetAsEntry==="function"
    ?items.map(it=>{const en=it.webkitGetAsEntry();return en?walk(en,""):readFile(typeof it.getAsFile==="function"?it.getAsFile():null);})
    :Array.from((dt&&dt.files)||[]).map(readFile);
  return Promise.all(jobs).then(()=>out);
}
function openManualInstall(){
  openModal("Manual install",
    `<p class="hint">Downloaded a data zip or pack files? Choose them or drop them here. You'll see what changes before anything installs.</p>`+
    `<div class="ext-acts"><button type="button" class="tbtn" id="miFiles">Choose files</button><button type="button" class="tbtn" id="miFolder">Choose a folder</button></div>`+
    `<div class="ext-drop" id="miDrop">Drop files, a zip or a folder here</div>`+
    `<input type="file" id="miFileIn" multiple accept="application/json,.json,application/zip,application/x-zip-compressed,.zip" class="hidefile">`+
    `<input type="file" id="miDirIn" webkitdirectory multiple class="hidefile">`+
    `<div class="m-actions"><button type="button" class="tbtn" id="miClose">Close</button></div>`,"",{});
  const fi=document.getElementById("miFileIn"),di=document.getElementById("miDirIn"),drop=document.getElementById("miDrop");
  document.getElementById("miFiles").addEventListener("click",()=>fi.click());
  document.getElementById("miFolder").addEventListener("click",()=>di.click());
  document.getElementById("miClose").addEventListener("click",()=>{closeModal();settings.setPage="extensions";openSettings();});
  [fi,di].forEach(inp=>inp.addEventListener("change",()=>{if(inp.files.length)manualInstallFiles(inp.files,{back:"settings"});inp.value="";}));
  extWireDrop(drop);
}
/* files, a zip or a folder dropped on the Manual install box or the Extensions page */
function extWireDrop(el){
  if(!el)return;
  el.addEventListener("dragover",e=>{e.preventDefault();el.classList.add("ext-dropping");});
  /* leaving for a child element is not leaving the drop zone */
  el.addEventListener("dragleave",e=>{if(!e.relatedTarget||!el.contains(e.relatedTarget))el.classList.remove("ext-dropping");});
  el.addEventListener("drop",e=>{e.preventDefault();el.classList.remove("ext-dropping");
    readDropped(e.dataTransfer).then(p=>{if(p.length)extManualPlan(p,{back:"settings"});});});
}
/* ---- the pills (spec §6.1): "Extensions · N updates", "N updates" at 390px ---- */
function renderExtPill(){
  const wrap=document.getElementById("extPill"),go=document.getElementById("extPillGo");if(!wrap||!go)return;
  const n=extPillCount();
  wrap.hidden=!n;
  if(n){go.innerHTML=`<span class="extpill-long">Extensions · </span>${esc(String(n))} update${n===1?"":"s"}`;
    go.title=`${n} extension update${n===1?"":"s"}: open Settings → Extensions`;}
}
