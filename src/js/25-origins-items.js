/* ---- origin designators: where an item/spell came from, + when it was added ---- */
const ORIGIN_KINDS=[
  {k:"class",     ltr:"C", label:"Class",              ph:"class name"},
  {k:"background",ltr:"B", label:"Background",          ph:"background name"},
  {k:"race",      ltr:"A", label:"Ancestry",           ph:"ancestry name"},
  {k:"feat",      ltr:"Ft",label:"Feat",               ph:"feat name"},
  {k:"starting",  ltr:"S", label:"Starting equipment", ph:""},
  {k:"purchased", ltr:"$", label:"Purchased",          ph:"at (place)"},
  {k:"found",     ltr:"F", label:"Found",              ph:"at (place)"},
  {k:"traded",    ltr:"T", label:"Traded",             ph:"from (who)"},
  {k:"reward",    ltr:"R", label:"Reward",             ph:"for (what)"},
  {k:"gift",      ltr:"G", label:"Gift",               ph:"from (who)"},
  {k:"crafted",   ltr:"K", label:"Crafted",            ph:""},
  {k:"item",      ltr:"I", label:"Scroll / Item",      ph:"source"},
  {k:"custom",    ltr:"•", label:"Custom",             ph:"describe"}
];
function originDef(k){return ORIGIN_KINDS.find(x=>x.k===k)||null;}
function originLetter(o){const d=o&&originDef(o.kind);return d?d.ltr:(o?"•":"");}
function originLabel(o){if(!o)return "";const d=originDef(o.kind);const base=d?d.label:(o.kind||"Origin");return o.detail?base+" — "+o.detail:base;}
function originFromSid(sid){if(!sid)return null;const p=String(sid).split(":");const map={bg:"background","class":"class",race:"race"};const k=map[p[0]];return k?{kind:k,detail:p[1]||"",at:Date.now()}:null;}
function originFromGranted(g){if(!g)return null;const m={Feat:"feat",Background:"background",Ancestry:"race",Item:"item",Other:"custom"};return {kind:m[g]||"custom",detail:"",at:null};}
function grantedFromOrigin(k){const m={"class":"",feat:"Feat",background:"Background",race:"Ancestry",item:"Item"};return (k in m)?m[k]:(k?"Other":"");}
function itemOrigin(it){return it.origin||originFromSid(it.grant);}
function spellOrigin(s){return s.origin||originFromGranted(s.granted);}
function originBadge(o,attr,id){if(!o)return "";const t=esc(originLabel(o)+(o.at?" · added "+new Date(o.at).toLocaleDateString():""));return `<button class="orig-b" ${attr}="${id}" title="${t}" aria-label="Origin: ${t}">${esc(originLetter(o))}</button>`;}
function openOriginInfo(o){if(!o){openModal("Origin",`<p class="hint">No origin recorded. Edit this to set where it came from.</p>`);return;}openModal("Origin",`<p><b>${esc(originLabel(o))}</b></p><p class="hint">Added: ${esc(o.at?new Date(o.at).toLocaleString():"—")}</p>`);}
function originOptionsHTML(cur,includeClass){const none=`<option value=""${!cur?" selected":""}>— none —</option>`;return none+ORIGIN_KINDS.map(x=>`<option value="${x.k}"${cur&&cur.kind===x.k?" selected":""}>${esc(x.label)}</option>`).join("");}
/* The presentation line browse folds into an added item's description. Shared,
   not inlined, because the update diff must reproduce the SAME transform — an
   item copy is not field-identical to its rules entry, and comparing a copy
   against the raw entry reports every browse-added item as changed forever. */
function itemMetaLine(x){
  return [x.type,(x.rarity&&x.rarity!=="Mundane")?x.rarity:"",
          x.attune?("Attunement"+(x.attuneNote?" ("+x.attuneNote+")":"")):"",
          x.cost,(x.weight!=null?x.weight+" lb":"")].filter(Boolean).join(" · ");
}
function fmtGp(n){n=fnum(n);return Math.round(n*100)/100+" gp";}
function costToGp(str){if(str==null)return null;const s=String(str).toLowerCase().replace(/,/g,"");const mult={pp:10,gp:1,ep:0.5,sp:0.1,cp:0.01};let gp=0,found=false,m;const re=/(\d+(?:\.\d+)?)\s*(pp|gp|ep|sp|cp)\b/g;while((m=re.exec(s))){gp+=parseFloat(m[1])*mult[m[2]];found=true;}if(!found){const n=parseFloat(s);return isNaN(n)?null:n;}return Math.round(gp*100)/100;}
function inventoryTotal(){return Math.round((character.inventory||[]).reduce((a,it)=>a+fnum(it.cost)*(num(it.qty)||1),0)*100)/100;}

/* ---- carried weight and encumbrance ----
   All pure and DOM-free so they stay testable; the rendering lives in 40-sheet
   (the pill and the totals row), 10-compute (the speed) and 80-modal-forms (the
   breakdown). Weight is measured, not counted, so everything here uses fnum. */
function fmtWt(n){return Math.round(fnum(n)*100)/100+" lb";}
function itemWeight(it){return fnum(it&&it.weight);}            /* per unit */
function itemWeightTotal(it){return itemWeight(it)*(num(it&&it.qty)||1);}
/* 5e: 50 coins weigh a pound. Sums every denomination the sheet holds rather
   than coinKeys(), because an imported character can be carrying electrum the
   current skin doesn't display — it is still in their purse. */
function coinsWeight(){
  if(character.coinWeight===false)return 0;
  const c=character.coins||{};
  return Object.keys(c).reduce((a,k)=>a+num(c[k]),0)/50;
}
/* Rounded to 2dp HERE, before anything compares it to a threshold: 20 arrows at
   0.05 lb is 1.0000000000000002 in binary floating point, which would read as
   "over" against a capacity of exactly 1. */
function carriedWeight(){
  const items=(character.inventory||[]).reduce((a,it)=>a+itemWeightTotal(it),0);
  return Math.round((items+coinsWeight())*100)/100;
}
/* Size is derived, not stored twice: an explicit choice wins, else the ancestry's
   own size, else Medium. A species offering a choice ("Small or Medium") lists
   both and we take the largest — the more permissive default. */
function raceDefSize(){
  const d=findRaceDef(character.race&&character.race.name);
  return sizeName(d&&d.size);
}
function sizeName(sz){
  if(!sz)return "";
  const list=(Array.isArray(sz)?sz:[sz]).map(s=>String(s).trim()).filter(s=>SIZES.includes(s));
  if(!list.length)return "";
  return list.sort((a,b)=>SIZES.indexOf(b)-SIZES.indexOf(a))[0];
}
/* What the species DECLARES, for display — "Small or Medium" stays a choice on
   the page even though sizeName() has to settle on one for the maths. */
function sizeLabel(sz){return (Array.isArray(sz)?sz:[sz]).filter(Boolean).join(" or ");}
function charSize(){return character.size||raceDefSize()||"Medium";}
/* One list of size options, shared by the Vitals picker and Settings, so the two
   can't drift. "" is the from-ancestry default, and it names what that resolves
   to rather than leaving you to guess. */
function sizeOptionsHTML(cur){
  return `<option value=""${!cur?" selected":""}>From ancestry (${esc(raceDefSize()||"Medium")})</option>`+
    SIZES.map(s=>`<option value="${s}"${cur===s?" selected":""}>${s}</option>`).join("");
}
/* split from carryCapacity so the size picker can PREVIEW what a size would give
   you before you commit to it */
function capacityFor(size,contribs){return abilFinal("str",contribs)*15*(SIZE_CARRY[size]||1);}
function carryCapacity(contribs){return capacityFor(charSize(),contribs);}
function encMode(){return ["none","standard","variant"].includes(character.encumbrance)?character.encumbrance:"none";}
/* The one function every consumer reads. Tiers, in both modes, are fractions of
   the same capacity, so the size multiplier applies all the way up:
     standard  ok <= cap        | over <= cap*2 | max above
     variant   ok <= cap/3      | encumbered <= cap*2/3 | heavy <= cap
               then the standard hard limits take over (over, then max).
   "over" is the push/drag/lift band: speed becomes 5, not speed minus 5.
   "max" is the hard limit: you cannot move or hold it at all. */
function encState(contribs){
  const mode=encMode(), carried=carriedWeight(), size=charSize();
  const str=abilFinal("str",contribs), cap=carryCapacity(contribs), max=cap*2;
  const st={mode,size,str,carried,cap,max,tier:"none",label:"",penalty:0,floor:null};
  if(mode==="none")return st;
  if(carried>max){st.tier="max";st.label="Over your hard limit";st.floor=0;return st;}
  if(carried>cap){st.tier="over";st.label="Over capacity";st.floor=5;return st;}
  if(mode==="variant"){
    if(carried>cap*2/3){st.tier="heavy";st.label="Heavily Encumbered";st.penalty=-20;return st;}
    if(carried>cap/3){st.tier="encumbered";st.label="Encumbered";st.penalty=-10;return st;}
  }
  st.tier="ok";st.label="Unencumbered";return st;
}
/* Applied AFTER the numeric speed effects, because two of the three outcomes are
   not additive: over capacity your speed BECOMES 5, and at the hard limit you do
   not move. Never below zero. */
function encSpeed(base,st){
  if(!st||st.mode==="none")return base;
  if(st.floor!=null)return Math.min(base,st.floor);
  return Math.max(0,base+st.penalty);
}
/* parse an inventory item into an armor descriptor (structured field, or from category/type/description) */
function itemArmor(it){
  if(!it)return null;
  if(it.armor&&typeof it.armor==="object")return it.armor;
  const cat=String(it.category||""),typ=String(it.type||""),nm=String(it.name||""),desc=String(it.description||"");
  if(!(/armor/i.test(cat)||/armor|shield/i.test(typ)||/\bAC\b/i.test(desc)))return null;
  if(/shield/i.test(typ)||/shield/i.test(nm)){const m=desc.match(/AC\s*\+\s*(\d+)/i);return {kind:"shield",bonus:m?num(m[1]):2};}
  const m=desc.match(/AC\s*(\d+)/i);if(!m)return null;
  let dexCap=0; // heavy: no Dex
  if(/\+\s*dex/i.test(desc)){const cap=desc.match(/max\s*(\d+)/i);dexCap=cap?num(cap[1]):null;} // null = uncapped (light)
  return {kind:"body",base:num(m[1]),dexCap};
}
function isEquippable(it){return !!((it.effects&&it.effects.length)||itemArmor(it));}
/* AC base from equipped armor (base + capped Dex) + shields; falls back to manual or 10+Dex */
function armorAC(c){
  const dex=Math.floor((abilFinal("dex",c)-10)/2);
  const worn=(character.inventory||[]).filter(i=>i.equipped).map(itemArmor).filter(Boolean);
  const body=worn.filter(a=>a.kind==="body").sort((a,b)=>b.base-a.base)[0];
  let base;
  if(body)base=body.base+((body.dexCap==null)?dex:Math.min(dex,body.dexCap));
  else if(character.ac!==""&&character.ac!=null)base=num(character.ac);
  else base=10+dex;
  const shield=worn.filter(a=>a.kind==="shield").reduce((s,a)=>s+num(a.bonus||2),0);
  return {base:base+shield, hasArmor:!!body, shield, body, dex};
}
