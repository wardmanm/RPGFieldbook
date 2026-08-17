/* ================= persistence ================= */
const K_CHAR="hw-fb-char", K_SET="hw-fb-settings", K_RULES="hw-fb-rules", K_LIB="hw-fb-library";
let saveTimer=null, lsOK=true, activeId=null;
function charKey(id){return "hw-fb-c-"+id;}
function libLoad(){try{const s=localStorage.getItem(K_LIB);if(s)return JSON.parse(s);}catch(e){}return {autoload:null,index:[]};}
function libSave(lib){try{localStorage.setItem(K_LIB,JSON.stringify(lib));}catch(e){}}
function libTouch(){ // update the active character's index entry (name/system/version/updated)
  if(!activeId)return;
  const lib=libLoad();
  /* appVersion rides on the index so the home cards can badge it without
     reading (and parsing) every character blob */
  const meta={id:activeId,name:character.name||"Unnamed",system:character.system||"humblewood",appVersion:character.appVersion||"",updated:Date.now()};
  const i=lib.index.findIndex(x=>x.id===activeId);
  if(i>=0)lib.index[i]=meta;else lib.index.push(meta);
  libSave(lib);
}
/* Why localStorage said no, in words a player can act on. The browser's own
   message ("QuotaExceededError") tells them nothing about what to do. */
function storageWhy(e){
  const n=(e&&e.name)||"", m=(e&&e.message)||"";
  if(/quota|exceed/i.test(n+" "+m))return "your browser's storage is full";
  if(/security|denied/i.test(n+" "+m))return "your browser is blocking storage for this page";
  return "your browser refused to save"+(n?" ("+n+")":"");
}
/* Save a snapshot of a character as a separate library entry, WITHOUT switching
   to it (that's the difference from finishImport).

   Returns {id, copy} on success, or {error, copy} if it could not be stored —
   `copy` is the snapshot either way, so a caller that can't use storage can
   still offer it as a download rather than dead-ending.

   The index write is verified rather than assumed: libSave() swallows its own
   quota error, so without the read-back a backup could sit in storage while
   being invisible on the home screen — and we would have told the player to go
   and look for it there. */
function backupCharacter(ch,tag){
  let copy;
  try{
    copy=JSON.parse(JSON.stringify(ch));
    copy.id=uid();
    copy.name=(ch.name||"Character")+" (backup"+(tag?" "+tag:"")+")";
    copy.isBackup=true;
  }catch(e){return {error:"this character couldn't be copied"};}
  try{
    localStorage.setItem(charKey(copy.id),JSON.stringify(copy));
  }catch(e){return {error:storageWhy(e),copy};}
  const lib=libLoad();
  lib.index.push({id:copy.id,name:copy.name,system:copy.system||"humblewood",appVersion:copy.appVersion||"",updated:Date.now()});
  libSave(lib);
  if(!libLoad().index.some(x=>x.id===copy.id)){
    try{localStorage.removeItem(charKey(copy.id));}catch(e){}   // don't orphan it
    return {error:"your browser's storage is full",copy};
  }
  return {id:copy.id,copy};
}
function scheduleSave(){
  const el=document.getElementById("savestate");if(el){el.textContent="Saving…";el.className="savestate";}
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
    try{
      if(activeId)localStorage.setItem(charKey(activeId),JSON.stringify(character));
      libTouch();
      if(el){el.textContent="Autosaved";el.className="savestate on";}
    }catch(e){lsOK=false;if(el){el.textContent="Use Save ↑";el.className="savestate";}}
  },500);
}
function saveSettings(){try{localStorage.setItem(K_SET,JSON.stringify(settings))}catch(e){}}

/* ================= the rules cache =================
   The rules pool outgrew localStorage. Five packs merge to ~2.3 MILLION
   characters, which a browser stores as UTF-16 — ~4.6 MiB against a 5 MiB
   per-origin quota, before a single character sheet is saved. Worse, there was
   no way to find that out: setItem throws QuotaExceededError, saveRulesCache
   swallowed it with an empty catch, and the PREVIOUS value stayed put. The packs
   looked loaded all session; the next reload silently restored the older set.
   Trimming doesn't help — the regenerable metadata (_id, _dups) is 1.2% of it.

   IndexedDB has no such ceiling (its quota is a share of free disk), needs no
   dependencies, and works from file:// offline. localStorage stays as the
   fallback for anything that refuses IDB, and as the migration source for a
   cache already sitting there. Whatever happens, a write that does not land now
   SAYS SO — see rulesCacheError. */
const IDB_NAME="hw-fb-cache", IDB_STORE="kv", IDB_KEY="rules", IDB_TIMEOUT=4000;
let rulesCacheError="";
function idbReady(){return typeof indexedDB!=="undefined"&&!!indexedDB;}
/* A request that never fires an event is the third way IndexedDB fails, and the
   nastiest: absent and throwing both reject immediately, but a hang leaves the
   promise pending forever — so a failed save would go unreported and the boot
   hydration would never finish. WebKit on file:// is the platform this is aimed
   at. Time out and let the caller fall back to localStorage. */
function idbTimeout(p){
  return new Promise((res,rej)=>{
    let done=false;
    const t=setTimeout(()=>{if(!done){done=true;rej(new Error("IndexedDB timed out"));}},IDB_TIMEOUT);
    p.then(v=>{if(!done){done=true;clearTimeout(t);res(v);}},
           e=>{if(!done){done=true;clearTimeout(t);rej(e);}});
  });
}
function idbOpen(){
  return idbTimeout(new Promise((res,rej)=>{
    if(!idbReady())return rej(new Error("no IndexedDB"));
    let rq;
    try{rq=indexedDB.open(IDB_NAME,1);}catch(e){return rej(e);}
    rq.onupgradeneeded=()=>{const db=rq.result;if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE);};
    rq.onsuccess=()=>res(rq.result);
    rq.onerror=rq.onblocked=()=>rej(rq.error||new Error("IndexedDB unavailable"));
  }));
}
function idbTx(mode,fn){
  return idbOpen().then(db=>idbTimeout(new Promise((res,rej)=>{
    let tx;
    try{tx=db.transaction(IDB_STORE,mode);}catch(e){db.close();return rej(e);}
    let out;
    try{out=fn(tx.objectStore(IDB_STORE));}catch(e){db.close();return rej(e);}
    tx.oncomplete=()=>{db.close();res(out&&out.result!==undefined?out.result:undefined);};
    tx.onabort=tx.onerror=()=>{db.close();rej(tx.error||new Error("IndexedDB write failed"));};
  })));
}
/* ---- compression, for the localStorage fallback only ----
   If IndexedDB is refused — WebKit on file:// is the case this exists for — the
   pool has to fit in ~5 MiB, and five packs is ~4.4 MiB before characters. LZW
   over UTF-8 bytes takes this JSON to roughly a third, which fits comfortably.

   Only the FALLBACK path compresses. IndexedDB has room to spare, and storing
   plain JSON there keeps the common path debuggable.

   15 bits per character, offset by 32: the codes land in [32, 32799], entirely
   below the surrogate range at 55296, so every character is a valid lone BMP
   unit that survives a localStorage round trip. 16-bit packing would emit lone
   surrogates, which some browsers silently mangle. */
const LZW_MAX=65536, LZW_TAG="\u0001LZ";
/* Read a rules cache written either way. The tag is a control character no JSON
   document starts with, so an untagged value is a plain-JSON cache from an
   older build and still loads. */
function readRulesCacheString(raw){
  if(!raw)return "";
  if(raw.slice(0,LZW_TAG.length)!==LZW_TAG)return raw;
  const out=lzwDecompress(raw.slice(LZW_TAG.length));
  return out===null?"":out;
}
function _toUtf8(s){
  const out=[];
  for(let i=0;i<s.length;i++){
    let c=s.charCodeAt(i);
    if(c<0x80)out.push(c);
    else if(c<0x800)out.push(0xC0|c>>6,0x80|c&63);
    else if(c>=0xD800&&c<=0xDBFF&&i+1<s.length&&s.charCodeAt(i+1)>=0xDC00&&s.charCodeAt(i+1)<=0xDFFF){
      const cp=0x10000+((c-0xD800)<<10)+(s.charCodeAt(++i)-0xDC00);
      out.push(0xF0|cp>>18,0x80|(cp>>12&63),0x80|(cp>>6&63),0x80|cp&63);
    }
    else out.push(0xE0|c>>12,0x80|(c>>6&63),0x80|c&63);
  }
  return out;
}
function _fromUtf8(b){
  let s="",i=0;const n=b.length,parts=[];
  while(i<n){
    const c=b[i++];
    let cp;
    if(c<0x80)cp=c;
    else if((c&0xE0)===0xC0)cp=((c&31)<<6)|(b[i++]&63);
    else if((c&0xF0)===0xE0)cp=((c&15)<<12)|((b[i++]&63)<<6)|(b[i++]&63);
    else cp=((c&7)<<18)|((b[i++]&63)<<12)|((b[i++]&63)<<6)|(b[i++]&63);
    if(cp>0xFFFF){cp-=0x10000;s+=String.fromCharCode(0xD800+(cp>>10),0xDC00+(cp&1023));}
    else s+=String.fromCharCode(cp);
    if(s.length>32768){parts.push(s);s="";}      /* keep the rope short */
  }
  parts.push(s);
  return parts.join("");
}
function _chars(codes){
  /* fromCharCode.apply blows the argument limit on a payload this size */
  const parts=[];
  for(let i=0;i<codes.length;i+=8192)
    parts.push(String.fromCharCode.apply(null,codes.slice(i,i+8192)));
  return parts.join("");
}
function lzwCompress(str){
  const b=_toUtf8(str);
  const dict=new Map();
  let next=256,w=-1;
  const codes=[];
  for(let i=0;i<b.length;i++){
    const c=b[i];
    if(w<0){w=c;continue;}
    const key=w*256+c, hit=dict.get(key);
    if(hit!==undefined){w=hit;continue;}
    codes.push(w);
    /* full -> stop growing rather than reset: a reset has to be mirrored exactly
       by the decoder, whose dictionary lags one step, and that is a classic
       place to get an off-by-one that only shows on huge inputs. */
    if(next<LZW_MAX)dict.set(key,next++);
    w=c;
  }
  if(w>=0)codes.push(w);
  const out=[];let acc=0,bits=0;
  for(let i=0;i<codes.length;i++){
    acc=(acc*65536)+codes[i];bits+=16;
    while(bits>=15){bits-=15;out.push(32+(Math.floor(acc/Math.pow(2,bits))&0x7FFF));}
    acc=acc%Math.pow(2,bits);
  }
  if(bits)out.push(32+((acc*Math.pow(2,15-bits))&0x7FFF));
  return _chars(out);
}
function lzwDecompress(s){
  if(!s)return "";
  /* unpack 15-bit chars back into 16-bit codes */
  const codes=[];let acc=0,bits=0;
  for(let i=0;i<s.length;i++){
    acc=acc*32768+(s.charCodeAt(i)-32);bits+=15;
    while(bits>=16){bits-=16;codes.push(Math.floor(acc/Math.pow(2,bits))&0xFFFF);}
    acc=acc%Math.pow(2,bits);
  }
  if(!codes.length)return "";
  /* entries as (prefix, byte) so expansion never concatenates arrays */
  const pre=new Int32Array(LZW_MAX), byt=new Uint8Array(LZW_MAX);
  for(let i=0;i<256;i++){pre[i]=-1;byt[i]=i;}
  let next=256;
  /* a growable byte buffer, not a plain array: the output here is megabytes, and
     a JS array of that many numbers is the kind of thing that falls over on a
     phone — which is the platform this whole path exists for. */
  let out=new Uint8Array(Math.max(1024,codes.length*3)),len=0;
  const put=v=>{
    if(len===out.length){const bigger=new Uint8Array(out.length*2);bigger.set(out);out=bigger;}
    out[len++]=v;
  };
  const stack=[];
  const expand=code=>{
    stack.length=0;
    for(let c=code;c>=0;c=pre[c])stack.push(byt[c]);
    for(let i=stack.length-1;i>=0;i--)put(stack[i]);
    return stack[stack.length-1];          /* first byte of the entry */
  };
  let prev=codes[0];
  if(prev>=next)return null;
  let firstOfPrev=expand(prev);
  for(let i=1;i<codes.length;i++){
    const c=codes[i];
    let first;
    if(c<next)first=expand(c);
    /* the KwKwK case: the code names the entry we are about to define, which is
       always the previous entry plus its own first byte */
    else if(c===next){first=firstOfPrev;expand(prev);put(firstOfPrev);}
    else return null;                      /* corrupt — caller falls back */
    if(next<LZW_MAX){pre[next]=prev;byt[next]=first;next++;}
    prev=c;firstOfPrev=first;
  }
  return _fromUtf8(out.subarray(0,len));
}

/* Bytes a browser actually spends on a string: UTF-16, so two per character.
   Quoting the character count instead is what made this look survivable. */
function cacheBytes(n){
  const mb=n*2/1048576;
  return (mb>=1?mb.toFixed(1)+" MB":Math.round(n*2/1024)+" KB");
}
function saveRulesCache(){
  const json=JSON.stringify(rules);
  const toLocal=()=>{
    try{
      /* Compressed, because this path exists for the browsers that gave us no
         room: plain JSON is ~4.4 MiB at five packs and will not fit. Prefixed so
         a cache written by an older build still reads back as plain JSON. */
      let packed;
      try{packed=LZW_TAG+lzwCompress(json);}catch(e){packed=json;}
      localStorage.setItem(K_RULES,packed);
      rulesCacheError="";
    }catch(e){
      /* Both stores refused. The pool is still loaded and usable THIS session —
         it just won't survive a reload, which is precisely the failure that
         used to be invisible. */
      rulesCacheError="Your browser wouldn't save the "+cacheBytes(json.length)+
        " of rules data you have loaded, so it won't be there next time you open Fieldbook. "+
        "Unload a pack you're not using under Loaded data, or re-import them after each reload.";
    }
    return rulesCacheError;
  };
  if(!idbReady()){toLocal();return Promise.resolve(rulesCacheError);}
  return idbTx("readwrite",st=>st.put(json,IDB_KEY))
    .then(()=>{
      rulesCacheError="";
      /* Migrated: free the megabytes the old key was holding, which is also what
         was starving character autosave and the update-tool backups. */
      try{localStorage.removeItem(K_RULES);}catch(e){}
      return "";
    })
    .catch(()=>toLocal())
    .then(err=>{
      /* Report asynchronously: the callers have already drawn their status line
         by the time a rejected write comes back. */
      if(err&&typeof updateRulesStatus==="function")updateRulesStatus(err,"err");
      if(typeof renderRulesData==="function")renderRulesData();
      return err;
    });
}
