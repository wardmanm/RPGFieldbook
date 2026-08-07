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
function fmtGp(n){n=num(n);return (Number.isInteger(n)?n:Math.round(n*100)/100)+" gp";}
function costToGp(str){if(str==null)return null;const s=String(str).toLowerCase().replace(/,/g,"");const mult={pp:10,gp:1,ep:0.5,sp:0.1,cp:0.01};let gp=0,found=false,m;const re=/(\d+(?:\.\d+)?)\s*(pp|gp|ep|sp|cp)\b/g;while((m=re.exec(s))){gp+=parseFloat(m[1])*mult[m[2]];found=true;}if(!found){const n=parseFloat(s);return isNaN(n)?null:n;}return Math.round(gp*100)/100;}
function inventoryTotal(){return (character.inventory||[]).reduce((a,it)=>a+num(it.cost)*(num(it.qty)||1),0);}
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
