/* ================= reading a zip (#83) =================
   Rules data ships as one zip, fieldbook-data-standalone-<version>.zip, and the
   app opens it itself, offline (spec 2026-10-07-data-archive-design.md §9).
   Pure: bytes in, bytes out — no DOM, no storage — so the suites run it as is.

   A small reader of what every zip tool writes: entries found through the
   central directory, stored or deflated. Everything else is refused by name
   (zipError's code) rather than half-read, and the caps keep a hostile or
   mistaken file from eating a phone's memory. */
const ZIP_MAX_BYTES=64*1048576,ZIP_MAX_ENTRY=32*1048576,ZIP_MAX_TOTAL=128*1048576,ZIP_MAX_ENTRIES=1000;
function zipError(code,detail){const e=new Error(code+(detail?": "+detail:""));e.code=code;return e;}
/* Bytes to text the way a JSON file is read: UTF-8, a leading BOM dropped. */
function utf8Text(bytes){const s=new TextDecoder("utf-8").decode(bytes);return s.charCodeAt(0)===0xFEFF?s.slice(1):s;}
let _crcTable=null;
function crc32(bytes){
  if(!_crcTable){
    _crcTable=new Uint32Array(256);
    for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;_crcTable[n]=c>>>0;}
  }
  let c=0xFFFFFFFF;
  for(let i=0;i<bytes.length;i++)c=_crcTable[(c^bytes[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
/* ---- RFC 1951 inflate, after zlib's puff.c: small and plain rather than fast ---- */
const INF_LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const INF_LEXT=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const INF_DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const INF_DEXT=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
const INF_CLORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
let _infFixed=null;
/* a canonical Huffman code from its code lengths: how many codes of each
   length, and the symbols in code order */
function infTable(lens){
  const count=new Uint16Array(16),offs=new Uint16Array(16),symbol=new Uint16Array(lens.length);
  for(let i=0;i<lens.length;i++)count[lens[i]]++;
  count[0]=0;
  let left=1;
  for(let len=1;len<16;len++){left=left*2-count[len];if(left<0)throw zipError("damaged","an over-subscribed Huffman code");}
  for(let len=1;len<15;len++)offs[len+1]=offs[len]+count[len];
  for(let i=0;i<lens.length;i++)if(lens[i])symbol[offs[lens[i]]++]=i;
  return {count,symbol};
}
/* `size` is the length the zip's directory promises. The output is never
   allowed past it, so a hostile stream can't balloon, and must reach it. */
function inflateRaw(src,size){
  const out=new Uint8Array(size);
  let op=0,ip=0,bitbuf=0,bitcnt=0;
  const bits=need=>{
    let val=bitbuf;
    while(bitcnt<need){
      if(ip>=src.length)throw zipError("damaged","the compressed data ends early");
      val|=src[ip++]<<bitcnt;bitcnt+=8;
    }
    bitbuf=val>>>need;bitcnt-=need;
    return val&((1<<need)-1);
  };
  const decode=h=>{
    let code=0,first=0,index=0;
    for(let len=1;len<16;len++){
      code|=bits(1);
      const n=h.count[len];
      if(code-n<first)return h.symbol[index+(code-first)];
      index+=n;first=(first+n)<<1;code<<=1;
    }
    throw zipError("damaged","a bad Huffman code");
  };
  const room=len=>{if(op+len>size)throw zipError("damaged","longer than the zip says");};
  const codes=(lc,dc)=>{
    for(;;){
      let sym=decode(lc);
      if(sym<256){room(1);out[op++]=sym;continue;}
      if(sym===256)return;
      sym-=257;
      if(sym>=29)throw zipError("damaged","a bad length code");
      const len=INF_LBASE[sym]+bits(INF_LEXT[sym]);
      const ds=decode(dc);
      if(ds>=30)throw zipError("damaged","a bad distance code");
      const dist=INF_DBASE[ds]+bits(INF_DEXT[ds]);
      if(dist>op)throw zipError("damaged","a distance too far back");
      room(len);
      for(let i=0;i<len;i++,op++)out[op]=out[op-dist];
    }
  };
  let last=0;
  do{
    last=bits(1);
    const type=bits(2);
    if(type===0){
      /* stored: the rest of the current byte is padding */
      bitbuf=0;bitcnt=0;
      if(ip+4>src.length)throw zipError("damaged","the compressed data ends early");
      const len=src[ip]|(src[ip+1]<<8),nlen=src[ip+2]|(src[ip+3]<<8);ip+=4;
      if(len!==(~nlen&0xFFFF))throw zipError("damaged","a bad stored block");
      if(ip+len>src.length)throw zipError("damaged","the compressed data ends early");
      room(len);out.set(src.subarray(ip,ip+len),op);op+=len;ip+=len;
    }else if(type===1){
      if(!_infFixed){
        const l=new Uint8Array(288);let i=0;
        for(;i<144;i++)l[i]=8;for(;i<256;i++)l[i]=9;for(;i<280;i++)l[i]=7;for(;i<288;i++)l[i]=8;
        _infFixed=[infTable(l),infTable(new Uint8Array(30).fill(5))];
      }
      codes(_infFixed[0],_infFixed[1]);
    }else if(type===2){
      const nlen=bits(5)+257,ndist=bits(5)+1,ncode=bits(4)+4;
      if(nlen>286||ndist>30)throw zipError("damaged","a bad dynamic block");
      const cl=new Uint8Array(19);
      for(let i=0;i<ncode;i++)cl[INF_CLORDER[i]]=bits(3);
      const clh=infTable(cl),lens=new Uint8Array(nlen+ndist);
      for(let i=0;i<nlen+ndist;){
        const sym=decode(clh);
        if(sym<16){lens[i++]=sym;continue;}
        let val=0,rep;
        if(sym===16){if(!i)throw zipError("damaged","a repeat with nothing before it");val=lens[i-1];rep=3+bits(2);}
        else if(sym===17)rep=3+bits(3);
        else rep=11+bits(7);
        if(i+rep>nlen+ndist)throw zipError("damaged","too many code lengths");
        while(rep--)lens[i++]=val;
      }
      if(!lens[256])throw zipError("damaged","no end-of-block code");
      codes(infTable(lens.subarray(0,nlen)),infTable(lens.subarray(nlen)));
    }else throw zipError("damaged","a bad block type");
  }while(!last);
  if(op!==size)throw zipError("damaged","shorter than the zip says");
  return out;
}
/* ---- the container ---- */
function isZipBytes(b){return !!b&&b.length>=4&&b[0]===0x50&&b[1]===0x4B&&((b[2]===3&&b[3]===4)||(b[2]===5&&b[3]===6));}
function zipEntries(b){
  if(b.length>ZIP_MAX_BYTES)throw zipError("toolarge");
  const u16=o=>b[o]|(b[o+1]<<8),u32=o=>(b[o]|(b[o+1]<<8)|(b[o+2]<<16))+b[o+3]*16777216;
  /* the end record: the last 22 bytes, or up to a 64 KiB comment before them */
  let e=-1;
  for(let i=b.length-22;i>=0&&i>=b.length-22-65535;i--){
    if(b[i]===0x50&&b[i+1]===0x4B&&b[i+2]===5&&b[i+3]===6){e=i;break;}
  }
  if(e<0)throw zipError("notzip");
  const n=u16(e+10),cdSize=u32(e+12),cdOff=u32(e+16);
  if(u16(e+8)===0xFFFF||n===0xFFFF||cdSize===0xFFFFFFFF||cdOff===0xFFFFFFFF)throw zipError("zip64");
  if(e>=20&&u32(e-20)===0x07064B50)throw zipError("zip64");
  if(n>ZIP_MAX_ENTRIES)throw zipError("toomany");
  if(cdOff+cdSize>e)throw zipError("damaged","the directory is out of range");
  const dec=new TextDecoder("utf-8"),out=[];
  let p=cdOff;
  for(let k=0;k<n;k++){
    if(p+46>e||u32(p)!==0x02014B50)throw zipError("damaged","a bad directory entry");
    const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),csize=u32(p+20),usize=u32(p+24);
    const nl=u16(p+28),xl=u16(p+30),cl=u16(p+32),offset=u32(p+42);
    if(csize===0xFFFFFFFF||usize===0xFFFFFFFF||offset===0xFFFFFFFF)throw zipError("zip64");
    if(p+46+nl>e)throw zipError("damaged","a name out of range");
    out.push({name:dec.decode(b.subarray(p+46,p+46+nl)),method,flags,crc,csize,usize,offset});
    p+=46+nl+xl+cl;
  }
  return out;
}
function zipEntryBytes(b,en){
  if((en.flags&1)||en.method===99)throw zipError("encrypted",en.name);
  if(en.method!==0&&en.method!==8)throw zipError("method",String(en.method));
  if(en.usize>ZIP_MAX_ENTRY)throw zipError("toolarge",en.name);
  const o=en.offset;
  if(o+30>b.length||b[o]!==0x50||b[o+1]!==0x4B||b[o+2]!==3||b[o+3]!==4)throw zipError("damaged","a bad local header for "+en.name);
  const start=o+30+(b[o+26]|(b[o+27]<<8))+(b[o+28]|(b[o+29]<<8));
  if(start+en.csize>b.length)throw zipError("damaged",en.name+" runs past the end");
  const raw=b.subarray(start,start+en.csize);
  let data;
  if(en.method===0){if(en.csize!==en.usize)throw zipError("damaged",en.name+"'s sizes disagree");data=raw;}
  else data=inflateRaw(raw,en.usize);
  if(crc32(data)!==en.crc)throw zipError("damaged",en.name+" fails its CRC check");
  return data;
}
/* folders, and what macOS and Finder leave behind */
function zipJunk(name){
  const base=name.split("/").pop();
  return name.endsWith("/")||name.startsWith("__MACOSX/")||base.startsWith("._")||base===".DS_Store";
}
/* A rules zip -> {kind, version, packs:[{name, bytes}]} (spec §9.2), or a
   zipError. In order: an archive (its manifest at the root or one folder
   down); the data kit, refused; an archive one level inside (the app's zip);
   a zip of loose .json files. Every entry it returns is read and checked
   before it returns, so a damaged zip imports nothing at all. */
function readDataArchive(bytes,zipName,nested){
  const all=zipEntries(bytes).filter(en=>!zipJunk(en.name));
  let total=0;
  const read=en=>{total+=en.usize;if(total>ZIP_MAX_TOTAL)throw zipError("toolarge");return zipEntryBytes(bytes,en);};
  const base=n=>n.split("/").pop();
  const byName=(a,b)=>a.name<b.name?-1:a.name>b.name?1:0;
  const man=all.filter(en=>base(en.name)==="fieldbook-data.json"&&en.name.split("/").length<=2)
    .sort((a,b)=>a.name.length-b.name.length)[0];
  if(man){
    let m=null;
    try{m=JSON.parse(utf8Text(read(man)));}catch(e){if(e&&e.code)throw e;}
    if(!m||typeof m!=="object"||m._type!=="fieldbook-data"||!Array.isArray(m.packs))
      throw zipError("damaged","fieldbook-data.json isn't a Fieldbook data manifest");
    const dir=man.name.slice(0,man.name.length-"fieldbook-data.json".length);
    const packs=m.packs.map(p=>{
      const f=p&&typeof p.file==="string"?p.file:"";
      const en=f?all.find(x=>x.name===dir+f):null;
      if(!en)throw zipError("damaged","it lists "+(f||"a pack")+" but doesn't hold it");
      return {name:base(f),bytes:read(en)};
    });
    return {kind:"data",version:typeof m.version==="string"?m.version:"",packs};
  }
  if(all.some(en=>base(en.name)==="fbdata.py"))throw zipError("kit");
  if(!nested){
    const found=[];
    all.filter(en=>/\.zip$/i.test(en.name)).sort(byName).forEach(en=>{
      const inner=read(en);
      if(!isZipBytes(inner))return;
      let r;
      try{r=readDataArchive(inner,base(en.name),true);}
      catch(e){if(e&&(e.code==="notzip"||e.code==="kit"||e.code==="empty"))return;throw e;}
      if(r.kind==="data")found.push(r);
    });
    if(found.length)return {kind:"data",version:found.map(r=>r.version).filter(Boolean).join(", "),
      packs:[].concat(...found.map(r=>r.packs))};
  }
  const json=all.filter(en=>/\.json$/i.test(en.name)).sort(byName);
  if(json.length)return {kind:"loose",version:"",packs:json.map(en=>({name:base(en.name),bytes:read(en)}))};
  throw zipError("empty");
}
