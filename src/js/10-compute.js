/* ================= recompute derived ================= */
function recompute(){
  const c=contributions();
  character.level=totalLevel();
  const ld=document.getElementById("levelDisp");if(ld)ld.textContent=Math.max(1,num(character.level));
  const pb=pbValue(c);
  document.getElementById("pbDisp").textContent=fmt(pb);
  ABIL.forEach(([k])=>{
    const fin=abilFinal(k,c), m=Math.floor((fin-10)/2), buff=sumFx("ability."+k,c);
    const me=document.getElementById("mod-"+k);
    if(me){me.textContent=fmt(m);mark(me,!!buff);}
    const sv=document.getElementById("save-"+k);
    const saveFx=sumFx("save."+k,c), saveProf=effSaveProf(k);
    if(sv){sv.textContent=fmt(m+(saveProf?pb:0)+saveFx);mark(sv,!!saveFx||!!grantedProf("save",k));}
    const d=document.querySelector(`.dot[data-save="${k}"]`);if(d){d.dataset.lvl=saveProf?1:0;d.dataset.granted=(!character.saves[k]&&grantedProf("save",k))?1:0;}
  });
  const mods={};ABIL.forEach(([k])=>mods[k]=Math.floor((abilFinal(k,c)-10)/2));
  SKILLS.forEach(([k,,ab])=>{
    const lvl=effSkill(k), skFx=sumFx("skill."+k,c);
    const t=mods[ab]+(lvl>0?pb:0)+(lvl>1?pb:0)+skFx;
    const e=document.getElementById("skill-"+k);if(e){e.textContent=fmt(t);mark(e,!!skFx||!!grantedProf("skill",k));}
    const d=document.querySelector(`.dot[data-skill="${k}"]`);if(d){d.dataset.lvl=lvl;d.dataset.granted=(!(character.skills[k]||0)&&grantedProf("skill",k))?1:0;}
  });
  const acBase=armorAC(c).base, acFx=sumFx("ac",c);
  const acEl=document.getElementById("acDisp");acEl.textContent=acBase+acFx;mark(acEl,!!acFx);
  const initBase=character.init===""?mods.dex:num(character.init), initFx=sumFx("init",c);
  const initEl=document.getElementById("initDisp");initEl.textContent=fmt(initBase+initFx);mark(initEl,!!initFx);
  const spFx=sumFx("speed",c);const spEl=document.getElementById("speedDisp");spEl.textContent=num(character.speed)+spFx;mark(spEl,!!spFx);
  const pv=mods.wis+(effSkill("perception")>0?pb:0)+(effSkill("perception")>1?pb:0)+sumFx("skill.perception",c);
  document.getElementById("passDisp").textContent=10+pv;
  const hpFx=sumFx("hp.max",c);
  const mn=document.getElementById("maxNote");
  if(mn)mn.textContent=hpFx?`Effective Max HP: ${num(character.hp.max)+hpFx} (base ${num(character.hp.max)} ${fmt(hpFx)})`:"Item / feature bonuses to Max HP appear here";
  document.getElementById("starBtn").classList.toggle("on",!!character.inspiration);
  const sa=character.spellAbility;
  document.getElementById("dcDisp").textContent=sa?String(8+pb+mods[sa]):"—";
  document.getElementById("satkDisp").textContent=sa?fmt(pb+mods[sa]):"—";
  renderDeath();autoSlots();renderSlotBubbles();renderHitDice();syncResources();renderResources();
  (character.attacks||[]).forEach(a=>{if(a.source==="spell"&&!a.save)a.ability=character.spellAbility||"none";});
  renderAttacks();renderActiveSpells();
}
function mark(el,on){el.classList.toggle("fx-on",!!on);}

/* ================= keyword highlight ================= */
function highlight(text){
  const escd=esc(text||"");
  const terms=allGlossary().map(g=>g.term).filter(Boolean).sort((a,b)=>b.length-a.length);
  if(!terms.length)return escd;
  const pat=terms.map(t=>escReg(esc(t))).join("|");
  const re=new RegExp("\\b("+pat+")\\b","gi");
  return escd.replace(re,m=>{
    const g=allGlossary().find(x=>x.term.toLowerCase()===m.toLowerCase().replace(/&amp;/g,"&"));
    return `<span class="kw" data-gid="${g?g.id:""}" role="button" tabindex="0">${m}</span>`;
  });
}

/* ================= rich text (bio + proficiencies) ================= */
const editing={};
function renderRT(key){
  const host=document.getElementById("rt-"+key);if(!host)return;
  const val=character[key]||"";
  const toggle=document.querySelector(`[data-edit="${key}"] span`);
  if(editing[key]){
    if(toggle)toggle.textContent="Done";
    host.innerHTML=`<textarea data-rt="${key}">${esc(val)}</textarea>`;
    const ta=host.querySelector("textarea");ta.focus();
    ta.addEventListener("input",()=>{character[key]=ta.value;scheduleSave()});
  }else{
    if(toggle)toggle.textContent="Edit";
    host.innerHTML=val.trim()?`<div class="rt-view">${highlight(val)}</div>`:`<div class="rt-view empty">Nothing yet — tap Edit.</div>`;
  }
}
function renderAllRT(){["proficiencies",...BIO.map(b=>b[0])].forEach(renderRT)}

