/* ================= combat view =================
   A full-screen view of the sections the player picked from any tab. They are
   the REAL cards, moved in while the view is open and back to a hidden marker
   at home when it closes: copies would duplicate every id (the #17 bug, where
   the visible copy updates and the hidden one rots), and a purpose-built
   dashboard would re-implement every section's controls. Closing the view never
   ends combat. Design: src/docs/specs/2026-09-24-combat-view-design.md

   The pure half comes first — no DOM — so src/tests/sheet.js can assert it. */

/* Only a real true: a hand-edited file saying "true" is not a fight. */
function inCombat(c){return !!c&&c.combatActive===true;}

/* Not an array means "never chosen" and gets the defaults. An EMPTY array is a
   real choice (the player took everything out) and stays empty. Unknown keys and
   repeats are dropped, so an old or hand-edited file cannot put a card in twice. */
function combatSectionsOf(c){
  const raw=c&&c.combatSections;
  if(!Array.isArray(raw))return COMBAT_DEFAULTS.slice();
  const known=new Set(NOTE_SECTIONS.map(s=>s.k)),out=[];
  raw.forEach(k=>{if(typeof k==="string"&&known.has(k)&&!out.includes(k))out.push(k);});
  return out;
}
function withCombatSection(list,k,on){
  if(on)return list.includes(k)?list.slice():list.concat([k]);
  return list.filter(x=>x!==k);
}
/* `to` is where the section ends up. Never edits the list it was given. */
function moveCombatSection(list,from,to){
  const out=list.slice();
  if(from<0||from>=out.length)return out;
  const [k]=out.splice(from,1);
  out.splice(Math.max(0,Math.min(out.length,to)),0,k);
  return out;
}

/* Start always means round 1, even over a round the Active Spells card left
   behind. Active spells are not touched: their time moves only when rounds do. */
function combatStart(c){c.combatActive=true;c.combatRound=1;}
/* The summary counts the round being ended as finished (round 7 → 7 rounds,
   42 sec), while the header shows the time at the START of the current round
   (combatElapsedSec: round 7 → 36 sec). Both on purpose — don't "fix" one to
   match the other. */
function combatEnd(c){
  const rounds=Math.max(0,num(c.combatRound));
  c.combatActive=false;c.combatRound=0;
  return {rounds,sec:rounds*6};
}
function combatElapsedSec(c){return Math.max(0,num(c&&c.combatRound)-1)*6;}
function fmtCombatTime(sec){
  sec=Math.max(0,Math.floor(num(sec)));
  if(sec<60)return sec+" sec";
  if(sec<3600){const m=Math.floor(sec/60),s=sec%60;return m+" min"+(s?" "+s+" sec":"");}
  const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);
  return h+" hr"+(m?" "+m+" min":"");
}

/* ---- the tab-bar button ----
   Idle: the crossed swords alone. In combat: highlighted, with the round, so it
   reads from any tab while you look something up. */
function combatButtonHTML(c){
  return iconSVG("ui","Combat")+(inCombat(c)?`<span class="cv-rd">Rd ${num(c.combatRound)}</span>`:"");
}
function renderCombatButton(){
  const b=document.getElementById("btnCombat");if(!b)return;
  const on=inCombat(character), l=on?`Combat view — round ${num(character.combatRound)}`:"Combat view";
  b.innerHTML=combatButtonHTML(character);
  b.classList.toggle("on",on);
  b.setAttribute("aria-label",l);b.title=l;
}
/* Everything that shows combat state repaints through here. The round moves from
   three places — the view's arrows, the Active Spells card's own buttons, and
   Start/End — so none of them can disagree. */
function renderCombatChrome(){renderCombatButton();}
/* The last thing renderAll() does. */
function syncCombatView(){renderCombatChrome();}
