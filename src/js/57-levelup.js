/* ================= level-up fanfare (#101) =================
   What a level gave. The sheet is snapshotted before the level is applied
   and again after recompute(), and the card lists the difference. Comparing
   the sheet, not reading the class table, is what makes it right for any
   pack, homebrew included, and it can never claim something the sheet did
   not get. Spec: src/docs/specs/2026-10-24-level-up-fanfare-design.md. */
function levelSnapshot(){
  const slots=[];
  for(let lv=1;lv<=9;lv++){const s=character.slots&&character.slots[lv];slots.push(s?num(s.total):0);}
  /* keyed by the resource's own key, so Channel Divinity from a Cleric and from
     a Paladin stay two rows; a player's own resource has none, so its name */
  const res={};
  (character.resources||[]).forEach(r=>{
    if(!r||!r.name)return;
    res[r.key||("own:"+String(r.name).toLowerCase())]={name:String(r.name),max:num(r.max),die:String(r.die||"")};
  });
  return {
    level:totalLevel(),
    feats:(character.features||[]).map(f=>({id:f.id,name:String(f.name||""),desc:String(f.description||""),
      cls:(f.origin&&f.origin.class)||"",sub:(f.origin&&f.origin.subclass)||""})),
    slots,res,pb:pbValue(contributions())
  };
}
const LU_ORD=["","1st","2nd","3rd","4th","5th","6th","7th","8th","9th"];
const LU_CHOICE={asi:["Ability Score Improvement","+2 to one ability, or +1 to two"],feat:["Choose a feat",""],
  subclass:["Choose your subclass",""],skill:["Choose skills",""],option:["Choose an option",""]};
/* A feature's first sentence as plain text: the card is a summary, and the
   full text stays on the Features card. Escaped where it is rendered. */
function luSummary(s){
  let t=String(s==null?"":s).replace(/\[Table:\s*([^\]]+)\]/g,"$1").replace(/<[^>]*>/g,"")
    .replace(/[*_`#>]/g,"").replace(/\s+/g," ").trim();
  const m=/^.*?[.!?](?=\s|$)/.exec(t);if(m)t=m[0];
  return t.length>160?t.slice(0,157).trimEnd()+"…":t;
}
function levelGains(before,after,choices,notes){
  const rows=[],had=new Set(before.feats.map(f=>f.id));
  after.feats.filter(f=>!had.has(f.id)).forEach(f=>{
    const twin=before.feats.find(b=>b.cls&&f.cls&&b.cls!==f.cls&&b.name.toLowerCase()===f.name.toLowerCase());
    rows.push({kind:"feature",text:f.name,detail:luSummary(f.desc),tag:f.sub||"feature",
      warn:twin?`You already have this from ${twin.cls}; they don't stack.`:""});
  });
  (choices||[]).filter(ch=>ch&&ch.type!=="hp").forEach(ch=>{
    const d=LU_CHOICE[ch.type]||["A choice",""];
    rows.push({kind:"choice",text:String(ch.label||d[0]),detail:d[1],tag:"choose next",warn:""});
  });
  Object.keys(after.res).forEach(k=>{
    const a=after.res[k],b=before.res[k];
    if(!b){rows.push({kind:"resource",text:`${a.name} ×${a.max}`+(a.die?` · ${a.die}`:""),detail:"",tag:"new",warn:""});return;}
    if(a.max>b.max)rows.push({kind:"resource",text:`${a.name} ${b.max} → ${a.max}`,detail:"",tag:"uses",warn:""});
    if(a.die&&b.die&&a.die!==b.die)rows.push({kind:"resource",text:`${a.name} ${b.die} → ${a.die}`,detail:"",tag:"die",warn:""});
  });
  for(let lv=1;lv<=9;lv++){
    const b=num(before.slots[lv-1]),a=num(after.slots[lv-1]);
    if(a>b)rows.push({kind:"slot",text:b?`Spell slots · ${LU_ORD[lv]} level ${b} → ${a}`:`Spell slots · ${LU_ORD[lv]} level ×${a}`,
      detail:"",tag:b?"slots":"new",warn:""});
  }
  if(after.pb>before.pb)rows.push({kind:"pb",text:`Proficiency bonus +${before.pb} → +${after.pb}`,detail:"",tag:"bonus",warn:""});
  (notes||[]).forEach(n=>{const t=choiceNoteText(n).trim();if(t)rows.push({kind:"note",text:t,detail:"",tag:"note",warn:""});});
  return rows;
}
/* The typed value of the HP step: the dice total, n..n×die, as the spend box
   takes 1..die. With no hit die (a custom class) it is the hit points
   themselves, any whole number. */
function luHPCheck(ch,raw){
  const die=num(ch&&ch.die),n=Math.max(1,num(ch&&ch.levels)||1),s=String(raw==null?"":raw).trim();
  if(!/^\d+$/.test(s))return {ok:false,why:die?"Type the number you rolled.":"Type the hit points you gained."};
  const r=parseInt(s,10);
  if(die&&(r<n||r>n*die))return {ok:false,why:n>1?`${n}d${die} rolls ${n} to ${n*die}.`:`A d${die} rolls 1 to ${die}.`};
  return {ok:true,why:""};
}
