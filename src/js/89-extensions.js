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
