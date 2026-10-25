/* ================= initiative tracker (#91) =================
   The fight's order, saved with the character while combatActive is true
   (cleared by combatEnd()). The array order IS the turn order; initSort()
   re-sorts it, stable, when an initiative changes. Bands: 0 Healthy,
   1 Injured, 2 Bloodied, 3 Near death, 4 Dead, null not set. Spec:
   src/docs/specs/2026-10-25-initiative-tracker-design.md. */
const HB_NAMES=["Healthy","Injured","Bloodied","Near death","Dead"];
const HB_SAYS=['"untouched", "fresh"','"barely hurt", "a few scratches"','"badly hurt", half or less','"almost dead", "barely standing"',"struck out; Next skips it"];
function initInt(v){const s=String(v==null?"":v).trim();return /^-?\d+$/.test(s)?parseInt(s,10):null;}
function initOpt(v){const n=initInt(v);return (n===null||n<0)?"":n;}
function cleanParty(v){
  return (Array.isArray(v)?v:[]).filter(p=>p&&typeof p==="object"&&String(p.name||"").trim())
    .map(p=>({id:String(p.id||uid()),name:String(p.name).trim().slice(0,60),ac:initOpt(p.ac),maxHp:initOpt(p.maxHp)}));
}
function cleanCombatants(v,active){
  if(!active)return [];
  let you=false;const out=[];
  (Array.isArray(v)?v:[]).forEach(r=>{
    if(!r||typeof r!=="object"||["you","party","foe"].indexOf(r.kind)<0)return;
    if(r.kind==="you"){if(you)return;you=true;}
    const party=r.kind==="party",band=(Number.isInteger(r.band)&&r.band>=0&&r.band<=4)?r.band:null,maxHp=party?initOpt(r.maxHp):"";
    out.push({id:String(r.id||uid()),kind:r.kind,name:String(r.name==null?"":r.name).slice(0,60),init:initInt(r.init),
      ac:r.kind==="you"?"":initOpt(r.ac),
      track:party?((r.track==="exact"||r.track==="estimate")?r.track:(maxHp!==""?"exact":"estimate")):"",
      band:r.kind==="you"?null:band,hp:party?initOpt(r.hp):"",maxHp,dead:party&&r.dead===true,partyId:party?String(r.partyId||""):""});
  });
  return out;
}
function combatantDead(r){return !!r&&(r.kind==="foe"?r.band===4:(r.kind==="party"?r.dead===true:false));}
function initSort(list){
  return list.map((r,i)=>({r,i})).sort((a,b)=>{
    const x=a.r.init,y=b.r.init;
    if(x===y)return a.i-b.i;if(x===null)return 1;if(y===null)return -1;return y-x;
  }).map(o=>o.r);
}
function initFirstAlive(list){const r=(list||[]).find(x=>!combatantDead(x));return r?r.id:"";}
/* The next living row after turnId. Passing the end is a wrap: the caller
   advances the round once. An unknown actor starts at the top, no wrap. */
function initNextTurn(list,turnId){
  const n=list.length;if(!n)return {turnId:"",wrapped:false};
  const i=list.findIndex(r=>r.id===turnId);
  if(i<0)return {turnId:initFirstAlive(list),wrapped:false};
  for(let j=i+1;j<n;j++)if(!combatantDead(list[j]))return {turnId:list[j].id,wrapped:false};
  for(let j=0;j<=i;j++)if(!combatantDead(list[j]))return {turnId:list[j].id,wrapped:true};
  return {turnId:list[i].id,wrapped:true};
}
function bandOfShare(hp,max){
  const m=num(max),h=num(hp);if(!(m>0))return null;
  if(h>=m)return 0;if(h>m/2)return 1;if(h>m/4)return 2;return 3;
}
/* What a chip's bar shows: a share (you; a party member on Exact with a
   max) coloured by its band, or a band alone, or nothing known (band null). */
function combatantBar(r){
  if(r.kind==="you"){const m=effMaxHP(),h=num(character.hp.cur);return {band:bandOfShare(h,m),share:m>0?Math.max(0,Math.min(1,h/m)):null};}
  if(r.kind==="party"&&r.track==="exact"&&num(r.maxHp)>0)return {band:bandOfShare(r.hp,r.maxHp),share:Math.max(0,Math.min(1,num(r.hp)/num(r.maxHp)))};
  return {band:r.band===4?null:r.band,share:null};
}
/* Your typed d20: the face, 1..20, as the spend box takes 1..die. */
function initRollCheck(raw){
  const s=String(raw==null?"":raw).trim();
  if(!/^\d+$/.test(s))return {ok:false,face:0,why:"Type the number you rolled."};
  const f=parseInt(s,10);
  if(f<1||f>20)return {ok:false,face:f,why:"A d20 rolls 1 to 20."};
  return {ok:true,face:f,why:""};
}
/* "14 + 3 = 17"; with advantage "Rolled 6, 14 → 14 + 3 = 17". */
function initRollLine(faces,mod){
  const hi=Math.max.apply(null,faces),m=num(mod),t=hi+m;
  const w=`${hi} ${m<0?"−":"+"} ${Math.abs(m)} = ${t}`;
  return faces.length>1?`Rolled ${faces.join(", ")} → ${w}`:w;
}
function initModOf(){
  const c=contributions(),dex=Math.floor((abilFinal("dex",c)-10)/2);
  return (character.init===""?dex:num(character.init))+sumFx("init",c)+sumFx("check",c);
}
function youAC(){const c=contributions();return armorAC(c).base+sumFx("ac",c);}
/* you: {name, init}; party: [{id,name,ac,maxHp,init}]; foes: [{name,count,ac,init}] */
function buildCombatants(you,party,foes){
  const rows=[{id:uid(),kind:"you",name:String(you.name||""),init:initInt(you.init),ac:"",track:"",band:null,hp:"",maxHp:"",dead:false,partyId:""}];
  (party||[]).forEach(p=>{const mx=initOpt(p.maxHp);rows.push({id:uid(),kind:"party",name:String(p.name).slice(0,60),init:initInt(p.init),ac:initOpt(p.ac),
    track:mx!==""?"exact":"estimate",band:null,hp:mx,maxHp:mx,dead:false,partyId:String(p.id||"")});});
  (foes||[]).forEach(f=>{
    const name=String(f.name||"").trim().slice(0,56);if(!name)return;
    const n=Math.max(1,Math.min(20,initInt(f.count)||1));
    for(let k=1;k<=n;k++)rows.push({id:uid(),kind:"foe",name:n>1?`${name} ${k}`:name,init:initInt(f.init),ac:initOpt(f.ac),track:"",band:null,hp:"",maxHp:"",dead:false,partyId:""});
  });
  return initSort(rows);
}
