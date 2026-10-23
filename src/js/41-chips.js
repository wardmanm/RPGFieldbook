/* ================= chips: defences, senses, languages (#103) =================
   Simple named items the player keeps in a list — resistances, immunities,
   senses (with a range), languages (with a source when a grant or the ruleset
   added them). Read only through chipList(): a list in a saved sheet may hold
   anything someone typed. Also here: the two ruleset-specific helpers #103
   adds, the advancement table and the default languages. */
const CHIP_KEYS=["resists","immunes","senses","languages"];
/* `mint`: migrate() gives an entry with no id one; a read never invents one,
   so reading is pure. */
function chipClean(list,key,mint){
  const out=[],seen=new Set();
  (Array.isArray(list)?list:[]).forEach(x=>{
    if(!x||typeof x!=="object"||Array.isArray(x)||typeof x.name!=="string")return;
    const name=x.name.trim();if(!name)return;
    const k=name.toLowerCase();if(seen.has(k))return;seen.add(k);
    const e={id:(typeof x.id==="string"&&x.id)?x.id:(mint?uid():""),name};
    if(key==="senses"){const r=typeof x.range==="number"?x.range:(typeof x.range==="string"&&/^\s*\d+\s*$/.test(x.range)?parseInt(x.range,10):NaN);e.range=(isFinite(r)&&r>0)?Math.round(r):"";}
    if(key==="languages")e.src=typeof x.src==="string"?x.src:"";
    out.push(e);
  });
  return out;
}
function chipList(c,key){return chipClean(c&&c[key],key,false);}
function advancementOf(c){return c&&c.advancement==="milestone"?"milestone":"xp";}

/* ---- the ruleset-specific helpers ----
   A pack label is matched to a ruleset with systemOf(), the same rule species
   use. Several labels of one ruleset: the first by name, so the result does not
   depend on load order. */
function rulesetDecl(map,c){
  if(!map||typeof map!=="object"||!c)return undefined;
  const hit=Object.keys(map).sort().find(l=>systemOf({_source:l})===c.system);
  return hit===undefined?undefined:map[hit];
}
function advValid(t){
  if(!Array.isArray(t)||!t.length)return false;
  for(let i=0;i<t.length;i++){const r=t[i];
    if(!Array.isArray(r)||r.length!==2||!Number.isInteger(r[0])||!Number.isInteger(r[1]))return false;
    if(i===0&&(r[0]!==0||r[1]!==1))return false;
    if(i>0&&(r[0]<=t[i-1][0]||r[1]!==t[i-1][1]+1))return false;}
  return true;
}
function advancementFor(c){const t=rulesetDecl(rules.advancement,c);return advValid(t)?t:SRD_ADVANCEMENT;}
function xpNumber(v){
  if(typeof v==="number")return (Number.isInteger(v)&&v>=0)?v:null;
  if(typeof v!=="string")return null;
  const s=v.trim().replace(/,/g,"");
  return /^\d+$/.test(s)?parseInt(s,10):null;
}
/* {xp, level (the sheet's total level), next (XP for level+1, or null), ready} */
function xpProgress(c){
  const xp=xpNumber(c&&c.xp);if(xp===null)return null;
  const level=(Array.isArray(c.classes)?c.classes:[]).reduce((a,x)=>a+num(x&&x.level),0)||num(c.level)||1;
  const t=advancementFor(c),row=t.find(r=>r[1]===level+1);
  const next=row?row[0]:null;
  return {xp,level,next,ready:next!==null&&xp>=next};
}
function defaultLanguagesFor(c){
  const d=rulesetDecl(rules.defaultLanguages,c);
  const list=Array.isArray(d)?d.filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim()):[];
  return list.length?list:["Common"];
}
/* Idempotent: adds each default the character lacks (case-blind), stamped
   "system". A language the player already has keeps its own source. */
function ensureDefaultLanguages(c){
  if(!c)return;
  const have=chipClean(c.languages,"languages",true);
  const names=new Set(have.map(x=>x.name.toLowerCase()));
  defaultLanguagesFor(c).forEach(n=>{if(!names.has(n.toLowerCase())){have.push({id:uid(),name:n,src:"system"});names.add(n.toLowerCase());}});
  c.languages=have;
}
/* A pack's `languages` text → names. "Common, Elvish and one other language of
   your choice": the choice is the player's to add, so it is skipped. */
function langParse(str){
  if(typeof str!=="string")return [];
  return str.split(/,|\band\b|;/i).map(s=>s.trim()).filter(s=>s&&!/\b(choice|any|other|one|two|three)\b/i.test(s));
}
