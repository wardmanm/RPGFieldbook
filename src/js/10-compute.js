/* ================= recompute derived ================= */
function recompute(){
  const c=contributions();
  character.level=totalLevel();
  const ld=document.getElementById("levelDisp");if(ld)ld.textContent=Math.max(1,num(character.level));
  const pb=pbValue(c);
  const pbEl=document.getElementById("pbDisp");pbEl.textContent=fmt(pb);mark(pbEl,!!sumFx("profBonus",c));
  /* a bonus to every ability check (#79): each skill, initiative and passive
     Perception take it; the modifiers, saves and everything else do not */
  const ckFx=sumFx("check",c);
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
    const t=mods[ab]+(lvl>0?pb:0)+(lvl>1?pb:0)+skFx+ckFx;
    const e=document.getElementById("skill-"+k);if(e){e.textContent=fmt(t);mark(e,!!skFx||!!ckFx||!!grantedProf("skill",k));}
    const d=document.querySelector(`.dot[data-skill="${k}"]`);if(d){d.dataset.lvl=lvl;d.dataset.granted=(!(character.skills[k]||0)&&grantedProf("skill",k))?1:0;}
  });
  const acBase=armorAC(c).base, acFx=sumFx("ac",c);
  const acEl=document.getElementById("acDisp");acEl.textContent=acBase+acFx;mark(acEl,!!acFx);
  const initBase=character.init===""?mods.dex:num(character.init), initFx=sumFx("init",c)+ckFx;
  const initEl=document.getElementById("initDisp");initEl.textContent=fmt(initBase+initFx);mark(initEl,!!initFx);
  const spFx=sumFx("speed",c), spBase=num(character.speed)+spFx;
  /* encumbrance is applied last and outside the effects engine on purpose: two of
     its outcomes replace the speed rather than adjust it, and its third cost
     (disadvantage) isn't numeric at all. See encState() in 25-origins-items.js. */
  const encSt=encState(c), spd=encSpeed(spBase,encSt);
  const spEl=document.getElementById("speedDisp");spEl.textContent=spd;mark(spEl,!!spFx||spd!==spBase);
  /* marked when you have set it yourself rather than taking the ancestry's —
     the same "this isn't the default" signal the other Vitals boxes use */
  const szEl=document.getElementById("sizeDisp");
  if(szEl){szEl.textContent=charSize();mark(szEl,!!character.size);}
  const pv=mods.wis+(effSkill("perception")>0?pb:0)+(effSkill("perception")>1?pb:0)+sumFx("skill.perception",c)+ckFx;
  document.getElementById("passDisp").textContent=10+pv;
  const hpFx=sumFx("hp.max",c);
  const mn=document.getElementById("maxNote");
  if(mn)mn.textContent=hpFx?`Effective Max HP: ${num(character.hp.max)+hpFx} (base ${num(character.hp.max)} ${fmt(hpFx)})`:"Item / feature bonuses to Max HP appear here";
  /* guarded: recompute() is the hottest function in the app, and an unguarded
     lookup here turns a renamed id into a white screen rather than a dead star */
  {const sb=document.getElementById("starBtn");if(sb){sb.classList.toggle("on",!!character.inspiration);sb.setAttribute("aria-pressed",character.inspiration?"true":"false");}}
  /* spellDC()/spellAtkBonus() own the formula, effects included (#77), so the
     card cannot read differently from the cast dialog or a save row */
  const sa=character.spellAbility;
  const dcEl=document.getElementById("dcDisp");dcEl.textContent=sa?String(spellDC(c)):"—";mark(dcEl,!!sa&&!!sumFx("spell.dc",c));
  const satkEl=document.getElementById("satkDisp");satkEl.textContent=sa?fmt(spellAtkBonus(c)):"—";mark(satkEl,!!sa&&!!sumFx("spell.attack",c));
  renderEncPill(encSt);
  renderDeath();autoSlots();renderSlotBubbles();renderHitDice();syncResources();renderResources();
  (character.attacks||[]).forEach(a=>{if(a.source==="spell"&&!a.save)a.ability=character.spellAbility||"none";});
  renderAttacks();renderActiveSpells();
}
function mark(el,on){el.classList.toggle("fx-on",!!on);}

/* ================= keyword highlight ================= */
/* A private-use char used as a placeholder while "[Table: Name]" anchors are
   held aside: it cannot occur in rules text, esc() leaves it alone, and being a
   non-word char the glossary \b...\b pass cannot match across it. One per
   anchor, restored in order - both passes scan left to right. */
const TBL_MARK="\uE000";
function highlight(text){
  /* Lift the anchors out BEFORE escaping (so names stay raw for the lookup) and
     before the glossary pass, which would otherwise chew through a table name
     like "Damage Types" and corrupt the markup we build from it. */
  const tbls=[];
  const src=String(text||"").replace(/\[Table:\s*([^\]]+)\]/g,(m,nm)=>{tbls.push(nm.trim());return TBL_MARK;});
  let escd=esc(src);
  /* Keyed by the ESCAPED term, lower-cased: the pass runs over escaped text, so
     a match is looked up in the same form it was found in. Comparing it with the
     raw term instead (unescaping only &amp;) left "Hunter's Mark" a chip with
     no id. The first entry per key wins: pack keywords, then the player's own.
     glossTerm(), never `.term`: an entry with no term threw here (#71). */
  const byKey=new Map();
  allGlossary().forEach(g=>{const t=glossTerm(g);if(!t)return;const k=esc(t).toLowerCase();if(!byKey.has(k))byKey.set(k,g);});
  if(byKey.size){
    const pat=[...byKey.keys()].sort((a,b)=>b.length-a.length).map(escReg).join("|");
    const re=new RegExp("\\b("+pat+")\\b","gi");
    escd=escd.replace(re,m=>{
      const g=byKey.get(m.toLowerCase());
      return `<span class="kw" data-gid="${esc(g?g.id:"")}" role="button" tabindex="0">${m}</span>`;
    });
  }
  if(!tbls.length)return escd;
  let i=0;
  return escd.replace(new RegExp(TBL_MARK,"g"),()=>{
    const nm=tbls[i++];
    /* no tables pack loaded -> read as plain prose, not a dead chip */
    if(!findTable(nm))return esc("the "+nm+" table");
    return `<span class="tblref" data-tbl="${esc(nm)}" role="button" tabindex="0">${esc(nm)}</span>`;
  });
}
/* highlight() plus ONE thing: **bold**. Rules prose carries run-in headings the
   source sets in bold — the Gadgeteer's frame and component lists are a
   3,000-character paragraph without them — and the extractor now preserves them
   as ** markers. Newlines already render; every surface this reaches is
   white-space:pre-wrap.

   Ordering is the security argument, borrowed wholesale from noteInline():
   highlight() runs esc() first, so the only angle brackets left in its output
   are the <span> chips it inserted itself. That makes /<[^>]+>/g an EXACT tag
   matcher rather than a heuristic, and lets those chips be held aside while the
   bold regex runs. Doing markup before the glossary pass would be unsafe the
   other way — a term like "strong" would match inside a tag we had just written.

   Bold ONLY, deliberately not noteInline itself: its single-asterisk emphasis
   rule would pair up the unpaired footnote markers already in the Humblewood
   data ("divert power*", "cymatic sight*", "Spells marked with an asterisk (*)")
   and italicise everything between them. `**` cannot match a lone `*`. */
/* Kept as the name every description call site already uses; the grammar now
   lives in ONE place (richHTML, src/js/87-notes.js) so a field cannot quietly
   support less formatting than the field beside it. The single-asterisk hazard
   the note above describes is handled in the rule itself: emphasis can no longer
   OPEN on an asterisk followed by a space, so the Humblewood footnote markers
   stay literal. */
function descHTML(text){ return richHTML(text); }

/* ================= rich text (bio + proficiencies) ================= */
const editing={};
function renderRT(key){
  const host=document.getElementById("rt-"+key);if(!host)return;
  const val=character[key]||"";
  const toggle=document.querySelector(`[data-edit="${key}"] span`);
  if(editing[key]){
    if(toggle)toggle.textContent="Done";
    host.innerHTML=`<textarea data-rt="${esc(key)}">${esc(val)}</textarea>`;
    const ta=host.querySelector("textarea");ta.focus();
    ta.addEventListener("input",()=>{character[key]=ta.value;scheduleSave()});
  }else{
    if(toggle)toggle.textContent="Edit";
    host.innerHTML=val.trim()?`<div class="rt-view">${richHTML(val)}</div>`:`<div class="rt-view empty">Nothing yet — tap Edit.</div>`;
  }
}
function renderAllRT(){["proficiencies",...BIO.map(b=>b[0])].forEach(renderRT)}

