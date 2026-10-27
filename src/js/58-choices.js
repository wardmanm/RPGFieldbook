/* ---- level-up choices ----
   `choose` used to reach the label prose and nowhere else, so by the time
   gatherChoices() read the boxes back there was nothing left to check against —
   which is why a Rogue offering "choose 4 of 10" would happily grant all ten.
   It is now emitted as data-choose on the .choice wrapper, and the two helpers
   below are deliberately DOM-free: the test harness stubs querySelectorAll to
   [], so anything that reads the document cannot be tested at all. */

/* How many NEW picks this block should ask for.
   Options already granted elsewhere are not part of the budget — "choose 2"
   with one already granted still means two new picks, not one. But it must not
   ask for more than are left to pick: choose 2 of 3 with two granted leaves a
   single option, and nagging forever for a second the player cannot make is
   worse than asking for what is possible. */
function effectiveChoose(choose,total,granted){
  return Math.max(0,Math.min(num(choose)||1,num(total)-num(granted)));
}
/* The sentence to put in front of someone leaving picks unmade, or "" when
   there is nothing outstanding. Takes {label,picked,target} per block so it can
   serve both modals and be tested without a DOM. */
function choiceShortfall(blocks){
  const short=(blocks||[]).filter(b=>b&&num(b.picked)<num(b.target));
  if(!short.length)return "";
  const lines=short.map(b=>`  • ${b.label||"Choose"}: ${num(b.picked)} of ${num(b.target)}`);
  return "You have picks left to make:\n\n"+lines.join("\n")+"\n\nContinue anyway?";
}
/* Lock a block once it is full. `data-fixed` marks an option granted by another
   source: it is disabled and stays disabled, so the re-enable below must key on
   that attribute and NOT on `checked` — otherwise unticking one of your own
   picks would hand a granted proficiency back to you as an editable box. */
function syncChoiceLimits(div){
  if(!div||!div.dataset||!div.dataset.choose)return;
  const target=num(div.dataset.choose);
  const own=Array.prototype.slice.call(div.querySelectorAll('input[type="checkbox"]:not([data-fixed])'));
  const picked=own.filter(cb=>cb.checked).length;
  own.forEach(cb=>{cb.disabled=(picked>=target&&!cb.checked);});
  const cnt=div.querySelector("[data-chcount]");
  if(cnt)cnt.textContent=picked+" of "+target+" chosen";
  div.dataset.full=(picked>=target)?"1":"0";
}
/* Read every choice block on screen as {label,picked,target} — the shape
   choiceShortfall wants. data-choose is the ONLY place the target lives for the
   race/background modal, which never populates _activeChoices. */
function choiceBlocks(){
  return Array.prototype.slice.call(document.querySelectorAll(".choice[data-choose]")).map(div=>{
    const lab=div.querySelector("label.f");
    return {label:lab?String(lab.textContent).split("—")[0].trim():"Choose",
            target:num(div.dataset.choose),
            picked:choiceBlockPicked(div)};
  });
}
/* A block's own picks: its ticked boxes, or — a species or background feat
   list (#118), which has no boxes — its pressed row. */
function choiceBlockPicked(div){
  return div.querySelectorAll('input[type="checkbox"]:not([data-fixed]):checked').length+
    div.querySelectorAll('[data-ft-pick][aria-pressed="true"]').length;
}
/* True when it is safe to close without asking. */
function choicesSettled(){return choiceShortfall(choiceBlocks())===""}
/* ---- feats at an ASI (#118) ----
   A feat's category and prerequisites are its first description line, written
   by the converter: "General feat · Prerequisite: Level 4+ and Strength 13+ or
   Level 4+ and Dexterity 13+". What can't be read is shown, never counted. */
const FEAT_ABIL={strength:"str",dexterity:"dex",constitution:"con",intelligence:"int",wisdom:"wis",charisma:"cha"};
function featHead(f){return String((f&&f.description)||"").split("\n")[0];}
function featCategory(f){
  const h=featHead(f).toLowerCase();
  if(/^general feat/.test(h))return "general";
  if(/^origin feat/.test(h))return "origin";
  if(/^fighting style feat/.test(h))return "style";
  if(/^epic boon/.test(h))return "boon";
  return "";
}
function featPrereq(f){
  const m=/Prerequisite:\s*(.+)$/i.exec(featHead(f));if(!m)return [];
  return m[1].split(/\s+or\s+(?=Level|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Spellcasting|Fighting)/i).map(alt=>
    alt.split(/\s*,\s*|\s+and\s+/i).map(p=>{
      const s=p.trim();let r;
      if((r=/^Level\s+(\d+)\+$/i.exec(s)))return {kind:"level",n:num(r[1])};
      if((r=/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(\d+)\+$/i.exec(s)))return {kind:"ability",key:FEAT_ABIL[r[1].toLowerCase()],n:num(r[2])};
      if(/^Spellcasting( or Pact Magic)? feature$/i.test(s))return {kind:"spellcasting",pact:/Pact Magic/i.test(s)};
      if(/^Fighting Style feature$/i.test(s))return {kind:"style"};
      return {kind:"unknown",text:s};
    }));
}
function featAbilName(k){const full=Object.keys(FEAT_ABIL).find(x=>FEAT_ABIL[x]===k)||String(k);return full.charAt(0).toUpperCase()+full.slice(1);}
function featHasFeature(re){return (character.features||[]).some(x=>x&&x.enabled!==false&&re.test(String(x.name||"")));}
function featPartUnmet(p){
  if(p.kind==="level")return num(character.level)>=p.n?"":`level ${p.n} or higher (yours is ${num(character.level)})`;
  if(p.kind==="ability"){const v=abilFinal(p.key,contributions());const nm=featAbilName(p.key);return v>=p.n?"":`${nm} ${p.n} or higher (yours is ${v})`;}
  /* classCasterKind() (00-constants.js) is the app's own per-class caster check, and it
     already covers a subclass-only caster (THIRD_SUB: Eldritch Knight, Arcane Trickster) —
     reading findClassDef(c.name).spellcasting here instead missed that, because that field
     lives on the subclass entry, not the base class. But its "pact" kind (Warlock) is a
     caster for "Spellcasting or Pact Magic", not for a PLAIN "Spellcasting feature" — so the
     class check is gated by kind, not just by whether classCasterKind() returned one. */
  if(p.kind==="spellcasting"){
    const hasClass=(character.classes||[]).some(c=>{const k=classCasterKind(c);return p.pact?!!k:(!!k&&k!=="pact");});
    const ok=featHasFeature(p.pact?/Spellcasting|Pact Magic/i:/Spellcasting/i)||hasClass;
    return ok?"":(p.pact?"the Spellcasting or Pact Magic feature":"the Spellcasting feature");
  }
  if(p.kind==="style")return featHasFeature(/Fighting Style/i)?"":"the Fighting Style feature";
  return "";   /* unknown: shown on the row, never unmet */
}
/* The closest alternative's unmet parts; [] when any alternative is fully met. */
function featUnmet(f){
  const alts=featPrereq(f);if(!alts.length)return [];
  let best=null;
  for(const alt of alts){const miss=alt.map(featPartUnmet).filter(Boolean);if(!miss.length)return [];if(!best||miss.length<best.length)best=miss;}
  return best;
}
/* A feat's ability increase: its `ability` field (the converter, #118) or, for
   packs without it, "Increase your A, B, or C score by N" in its text. */
const FEAT_ABIL_KEYS=["str","dex","con","int","wis","cha"];
function featAbilityChoices(f){
  if(f&&Array.isArray(f.ability)&&f.ability.length)return f.ability.map(a=>a&&Array.isArray(a.choose)
    ?Object.assign({choose:a.choose.filter(k=>FEAT_ABIL_KEYS.includes(k)),amount:Math.max(1,num(a.amount)||1)},a.max?{max:num(a.max)}:{})
    :{fixed:Object.fromEntries(Object.entries(a||{}).filter(([k])=>FEAT_ABIL_KEYS.includes(k)).map(([k,v])=>[k,num(v)]))}).filter(x=>x.fixed?Object.keys(x.fixed).length:x.choose.length);
  const m=/Increase your ((?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:,? (?:or )?(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))*) score by (\d)/i.exec(String((f&&f.description)||""));
  if(!m)return [];
  const keys=m[1].split(/,?\s+or\s+|,\s*/).map(w=>FEAT_ABIL[w.trim().toLowerCase()]).filter(Boolean);
  return keys.length===1?[{fixed:{[keys[0]]:num(m[2])}}]:[{choose:keys,amount:num(m[2])}];
}
function featTaken(name){const n=String(name||"").toLowerCase();return (character.features||[]).some(x=>String(x.name||"").toLowerCase()==="feat: "+n);}
function featOfferable(f,opts){
  const o=opts||{};const nm=String((f&&f.name)||"");
  if(!nm||/^ability score improvement$/i.test(nm))return false;
  /* `from`: a fixed menu (a species' feat array, #118) — only its feats, and
     Show all never widens it; the menu IS the qualification. */
  if(Array.isArray(o.from)&&!o.from.some(n=>String(n).toLowerCase()===nm.toLowerCase()))return false;
  /* Show all is the escape hatch to see every feat (Mike, 2026-10-27): it lifts every
     other gate below, including a species/background picker's own `category` filter —
     not just the taken/prerequisite/boon checks. */
  if(o.showAll)return true;
  if(featTaken(nm)&&!/^Repeatable:/im.test(f.description||""))return false;
  if(Array.isArray(o.from))return true;
  const cat=featCategory(f);
  if(o.category)return cat===o.category;
  /* `anyCategory`: a species or background "feat of your choice" with no
     category (Tasha's Custom Lineage) — Origin feats too, since that is what a
     level-1 character qualifies for; Epic Boons only behind Show all. */
  if(o.anyCategory&&cat==="origin")return true;
  if(cat==="origin")return false;
  if(cat==="boon")return !!o.boon&&!o.anyCategory;
  if(cat==="style")return featHasFeature(/Fighting Style/i);
  return featUnmet(f).length===0;
}
/* ---- the ASI-or-feat step (#118) ----
   One list: Ability Score Improvement pinned first, then the feats the
   character qualifies for (featOfferable), a search box and a Show all switch.
   Below it, one panel: today's +2 / +1+1 controls for the ASI, or the picked
   feat's text and its "+1 to:" question. A row's key is the feat's _id when the
   merge gave it one (two packs can share a name), else its name — findFeatDef()
   takes either. Markup only: wireAsiFeats() binds it once the modal is open. */
function asiFeatDef(key){const a=rules.feats||[];return a.find(x=>x&&x._id&&x._id===key)||a.find(x=>x&&x.name===key);}
function asiFeatKey(f){return String(f._id||f.name);}
/* today's +2 / +1+1 controls, unchanged; `label` false drops the heading when
   the list above already names the step */
function asiControlsHTML(ci,label){
  return (label===false?"":`<label class="f">Ability Score Improvement</label>`)+`
      <div style="display:flex;gap:14px;margin-bottom:6px"><label class="opt" style="margin:0"><input type="radio" name="asimode-${esc(ci)}" data-asi-mode value="2" checked>+2 to one</label><label class="opt" style="margin:0"><input type="radio" name="asimode-${esc(ci)}" data-asi-mode value="1">+1 to two</label></div>
      <div class="g2"><select data-asi-a aria-label="Ability">${ABIL.map(([k,l])=>`<option value="${esc(k)}">${l}</option>`).join("")}</select><select data-asi-b aria-label="Second ability">${ABIL.map(([k,l])=>`<option value="${esc(k)}">${l}</option>`).join("")}</select></div>`;
}
/* The increases the step still has to add: featAbilityChoices() minus what
   the feat's own `effects` already raise — a pack can carry the +1 there AND
   name it in the text the fallback reads (Humblewood's Arboreal Acrobat), and
   adding it again gave +2. A fixed increase loses the abilities already raised;
   a choose with any of its options already raised counts as made. Each keeps
   `i`, its featAbilityChoices() index, which is what a "+1 to:" chip answers. */
function featPendingIncreases(f){
  const have=new Set(((f&&Array.isArray(f.effects))?f.effects:[]).map(e=>{const m=/^ability\.(\w+)$/.exec(String((e&&e.target)||""));return m&&num(e.value)>0?m[1]:"";}).filter(Boolean));
  return featAbilityChoices(f).map((a,i)=>{
    if(a.fixed){const fixed=Object.fromEntries(Object.entries(a.fixed).filter(([k])=>!have.has(k)));return Object.keys(fixed).length?{fixed,i}:null;}
    return a.choose.some(k=>have.has(k))?null:Object.assign({},a,{i});
  }).filter(Boolean);
}
/* The description below its category line — and all of it when the first
   line is not one: a feat with no header keeps its opening sentence. */
function featBodyLines(f){const l=String((f&&f.description)||"").split("\n");return featCategory(f)?l.slice(1):l;}
/* Search hides a row whose name doesn't hold the text — never the pressed
   one, or Done would commit a pick the player can't see. DOM-free. */
function asiRowHidden(name,q,pressed){q=String(q||"").trim().toLowerCase();return !!q&&!pressed&&String(name||"").toLowerCase().indexOf(q)<0;}
/* A row's short line: its increase ("+1 Str or Dex", or "+1 any" when all six
   abilities are allowed, as an Epic Boon's are) and its first benefit's name,
   read off the first "Name: …" line after the category line. "Repeatable:" and
   "Prerequisite:" lines are rules about the feat, not a benefit (Skilled). */
function asiFeatShort(f){
  const ac=featAbilityChoices(f)[0];const ab=k=>featAbilName(k).slice(0,3);
  const any=ac&&!ac.fixed&&FEAT_ABIL_KEYS.every(k=>ac.choose.includes(k));
  const plus=ac?(ac.fixed?Object.keys(ac.fixed).map(k=>"+"+ac.fixed[k]+" "+ab(k)).join(", "):"+"+ac.amount+" "+(any?"any":ac.choose.map(ab).join(" or "))):"";
  const line=featBodyLines(f).find(l=>/^[^:]{1,40}:/.test(l)&&!/^\s*(Repeatable|Prerequisites?)\s*:/i.test(l))||"";
  return [plus,line.split(":")[0].trim()].filter(Boolean).join(" · ");
}
/* The rows alone, so Show all can repaint them without rebuilding the search
   box the player is typing in. `o.pick` is the pressed row. */
/* A species or background feat choice (#118): no pinned ASI row, nothing
   pressed to start — keyed on the type, so a choice with no category is one too. */
function asiIsFeatChoice(ch){return !!(ch&&(ch.type==="feat"||ch.category));}
/* The list's own options, from the choice: what the first draw and Show all's
   redraw both start from, so the switch can't drop a filter. */
function asiListOpts(ch){
  return {boon:!!ch.boon,category:ch.category||null,anyCategory:ch.type==="feat"&&!ch.category&&!Array.isArray(ch.from),
    from:Array.isArray(ch.from)?ch.from:null};
}
function asiOfferedFeats(o){return (rules.feats||[]).filter(f=>featOfferable(f,o)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));}
/* a fixed menu's names with no loaded feat: still a row, granted by name */
function asiMissingFrom(o){return Array.isArray(o.from)?o.from.filter(n=>!(rules.feats||[]).some(f=>String(f.name||"").toLowerCase()===String(n).toLowerCase())):[];}
function asiFeatRowsHTML(ch,o){
  const feats=asiOfferedFeats(o);
  const catTag={general:"General",origin:"Origin",style:"Fighting Style",boon:"Epic Boon"};
  const row=(key,name,sub,tag,warn)=>`<button type="button" class="ft-row" data-ft-pick="${esc(key)}" aria-pressed="${key===o.pick?"true":"false"}"><span class="ft-nm"><b>${esc(name)}</b>${sub?`<small>${esc(sub)}</small>`:""}</span>${tag?`<span class="ft-tag${warn?" warn":""}">${esc(tag)}</span>`:""}</button>`;
  return (asiIsFeatChoice(ch)?"":row("__asi__","Ability Score Improvement","+2 to one score, or +1 to two","General",false))+
    feats.map(f=>{const un=featUnmet(f);return row(asiFeatKey(f),dispName(f,"feats"),asiFeatShort(f),un.length?"needs "+un[0]:(catTag[featCategory(f)]||""),un.length>0);}).join("")+
    asiMissingFrom(o).map(n=>row(String(n),String(n),"not in the loaded rules","",false)).join("");
}
function asiFeatListHTML(ch,ci,opts){
  const o=Object.assign(asiListOpts(ch),{pick:asiIsFeatChoice(ch)?"":"__asi__"},opts||{});
  return `<label class="f">${esc(ch.label||(ch.boon?"Epic Boon — a feat, or an Ability Score Improvement":asiIsFeatChoice(ch)?"A feat of your choice":"Ability Score Improvement — or a feat instead"))}</label>`+
    `<div class="ft-tools"><input type="search" data-ft-search placeholder="Search feats…" aria-label="Search feats"><label class="ft-all">Show all <button type="button" class="switch${o.showAll?" on":""}" data-ft-all role="switch" aria-checked="${o.showAll?"true":"false"}" aria-label="Show all feats"></button></label></div>`+
    `<div class="ft-list" data-ft-list="${esc(ci)}">${asiFeatRowsHTML(ch,o)}</div>`;
}
function asiPanelHTML(ch,ci,pick){
  if(pick==="__asi__")return asiControlsHTML(ci,false);
  const f=asiFeatDef(pick);if(!f)return "";
  const body=featBodyLines(f).join("\n");
  const plus=featPendingIncreases(f).map(a=>a.fixed
    ?`<p class="hint">${esc(Object.entries(a.fixed).map(([k,v])=>"+"+v+" "+featAbilName(k)).join(", "))}</p>`
    :`<div class="ft-plus" role="group" aria-label="+${esc(String(a.amount))} to">+${esc(String(a.amount))} to: ${a.choose.map((k,j)=>`<button type="button" class="ft-chip${j===0?" on":""}" data-ft-plus="${esc(String(a.i))}" data-k="${esc(k)}" aria-pressed="${j===0?"true":"false"}">${esc(featAbilName(k))}</button>`).join("")}</div>`).join("");
  return `<div class="ft-desc">${body.split(/\n\s*\n|\n/).filter(s=>s.trim()).map(p=>`<p>${esc(p)}</p>`).join("")}</div>${plus}`;
}
/* Binds every ASI step on screen. Delegated to each step's own .choice div,
   which openModal() builds new on every open — so nothing stacks (#mBody
   survives, and is never bound). `list` holds the choices by data-ci. */
function wireAsiFeats(list){
  const chs=list||_activeChoices;
  document.querySelectorAll('.choice[data-ctype="asi"]').forEach(div=>{
    const ci=div.dataset.ci,ch=chs[num(ci)]||{type:"asi"};
    const rows=div.querySelector("[data-ft-list]"),panel=div.querySelector("[data-ft-panel]"),
          search=div.querySelector("[data-ft-search]"),sw=div.querySelector("[data-ft-all]");
    if(!rows||!panel)return;
    const pressed=()=>{const b=rows.querySelector('[data-ft-pick][aria-pressed="true"]');return b?b.dataset.ftPick:"";};
    const pick=key=>{
      rows.querySelectorAll("[data-ft-pick]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.ftPick===key?"true":"false"));
      panel.innerHTML=key?asiPanelHTML(ch,ci,key):"";
      filter();
    };
    /* the name only: a tag's "Fighting Style" is not a match for "st" */
    function filter(){const q=search?search.value:"";
      rows.querySelectorAll("[data-ft-pick]").forEach(b=>{const nm=b.querySelector(".ft-nm b");b.hidden=asiRowHidden(nm?nm.textContent:"",q,b.getAttribute("aria-pressed")==="true");});}
    div.addEventListener("click",e=>{
      const r=e.target.closest("[data-ft-pick]");
      if(r&&div.contains(r)){if(r.getAttribute("aria-pressed")!=="true")pick(r.dataset.ftPick);return;}
      const c=e.target.closest("[data-ft-plus]");
      if(c&&div.contains(c)){const g=c.closest(".ft-plus");if(g)g.querySelectorAll("[data-ft-plus]").forEach(x=>{const on=x===c;x.classList.toggle("on",on);x.setAttribute("aria-pressed",on?"true":"false");});return;}
      if(sw&&e.target.closest("[data-ft-all]")===sw){
        const on=!sw.classList.contains("on");sw.classList.toggle("on",on);sw.setAttribute("aria-checked",on?"true":"false");
        const was=pressed();
        rows.innerHTML=asiFeatRowsHTML(ch,Object.assign(asiListOpts(ch),{showAll:on,pick:was}));
        /* a pick Show all no longer lists falls back to the ASI (or to nothing) */
        if(was&&!rows.querySelector('[data-ft-pick][aria-pressed="true"]'))pick(asiIsFeatChoice(ch)?"":"__asi__");
        filter();
      }
    });
    if(search)search.addEventListener("input",filter);
  });
}
/* Every feat pressed in the open window — what the warning below is asked about. */
function asiScreenPicks(){
  return Array.from(document.querySelectorAll('.choice[data-ctype="asi"] [data-ft-pick][aria-pressed="true"]')).map(b=>b.dataset.ftPick);
}
/* The unmet-prerequisite sentence for each pressed feat that needs one, in
   order — DOM-free, so the wording is testable on its own. */
function asiPickWarnings(picks){
  const out=[];
  for(const key of picks||[]){
    if(!key||key==="__asi__")continue;
    const f=asiFeatDef(key);const un=f?featUnmet(f):[];
    if(un.length)out.push(`${f.name} needs ${un.join(" and ")}. Take it anyway?`);
  }
  return out;
}
/* The two warnings at a choice window's Done, in the app's own warning window
   (askConfirm), in turn: the picks still to make, then each feat whose
   prerequisites aren't met (#118), one at a time. Resolves false at the first
   "no" — Go back, Choose another, Escape — so the window stays open with every
   pick. */
async function choiceWarningsConfirmed(shortfall,featWarnings){
  if(shortfall&&!await askConfirm({title:"Picks left",message:shortfall,cancel:"Go back",ok:"Continue anyway"}))return false;
  for(const message of featWarnings||[]){
    if(!await askConfirm({title:"Prerequisite not met",message,cancel:"Choose another",ok:"Take it anyway"}))return false;
  }
  return true;
}
/* Both choice windows' Done (runChoices, runExtraChoices) is this handler
   around their own `commit`, which reads the picks — so the picks are read
   AFTER the warnings, with the window still open, as before.
   - Nothing to ask: commit at once, in the same task, exactly as Done always
     did (the level-up's settle and every flow behind the window keep their
     timing).
   - Something to ask: wait for the answers. Done pressed again meanwhile does
     nothing, so a double press can never commit twice; and if the window went
     while asking (the button is out of the page), nothing commits. */
function choiceDoneHandler(btn,commit){
  let busy=false;
  return ()=>{
    if(busy)return;
    const short=choiceShortfall(choiceBlocks()),feats=asiPickWarnings(asiScreenPicks());
    if(!short&&!feats.length){commit();return;}
    busy=true;
    choiceWarningsConfirmed(short,feats).finally(()=>{busy=false;})
      .then(ok=>{if(ok&&btn.isConnected!==false)commit();});
  };
}
/* One pick at an ASI (#118): the ASI as today, or a feat with its +1 stored on
   the feat, granted with `origin` so it reverts with whatever gave it — a class
   level here, a species or background (Task 4) through the same path. */
function commitAsiPick(sel,origin,pending){
  if(sel.pick==null||sel.pick==="")return;   /* no row pressed (a category list): nothing to grant */
  if(sel.pick==="__asi__"){
    /* never an `ability.undefined` effect */
    if(!FEAT_ABIL_KEYS.includes(sel.a)||(sel.mode==="1"&&!FEAT_ABIL_KEYS.includes(sel.b)))return;
    const fx=sel.mode==="1"?[{target:"ability."+sel.a,value:1},{target:"ability."+sel.b,value:1}]:[{target:"ability."+sel.a,value:2}];
    addFeatureFromDef({name:"Ability Score Improvement",description:"Gained from leveling "+((origin&&origin.class)||"")+".",effects:fx},origin);return;
  }
  const f=asiFeatDef(sel.pick);
  grantFeatDef(f?asiFeatKey(f):sel.pick,origin,pending);
  const fd=f||findFeatDef(sel.pick);
  const ft=(character.features||[]).slice().reverse().find(x=>x.name==="Feat: "+(fd?fd.name:sel.pick));
  if(!ft)return;
  const fx=[];
  featPendingIncreases(fd).forEach(a=>{
    if(a.fixed)Object.entries(a.fixed).forEach(([k,v])=>fx.push({target:"ability."+k,value:v}));
    else{const k=(sel.plus||[])[a.i];const key=a.choose.includes(k)?k:a.choose[0];if(key)fx.push({target:"ability."+key,value:a.amount});}
  });
  /* a new array: the feature's effects may still be the rules entry's own */
  if(fx.length)ft.effects=(Array.isArray(ft.effects)?ft.effects:[]).concat(fx);
}
function choiceFieldHTML(ch,ci,d){
  const t=ch.type;let inner="",chooseAttr="",ctype=t;
  if(t==="skill"){
    const from=ch.from||SKILLS.map(s=>s[1]);
    /* Two passes: the options have to be counted before the heading can say how
       many are still owed. `have` is effSkill()>0, so it covers a proficiency
       granted by an ancestry AND one the player toggled on the dot themselves —
       either way it is not theirs to spend here. grantSources names the source
       when there is one, because "already proficient" never said from where. */
    const opts=from.map(nm=>{
      const key=(SKILLS.find(s=>s[1].toLowerCase()===String(nm).toLowerCase())||[])[0];
      return {nm,key,have:!!(key&&effSkill(key)>0)};
    });
    const granted=opts.filter(o=>o.have).length;
    const target=effectiveChoose(ch.choose,opts.length,granted);
    chooseAttr=` data-choose="${esc(target)}"`;
    inner=`<label class="f">Choose ${target} skill(s)`+
      (granted?` <span style="color:var(--ink-soft);font-weight:400">(${granted} already yours)</span>`:"")+
      ` — <span data-chcount>0 of ${target} chosen</span></label>`+
      opts.map(o=>{
        const src=o.have&&o.key?grantSources("skill",o.key):[];
        const why=o.have?(src.length?" (from "+src.join(", ")+")":" (already proficient)"):"";
        return `<label class="opt"><input type="checkbox" data-skill-opt="${esc(o.key||"")}" ${o.have?"checked disabled data-fixed":""}>${esc(o.nm)}${esc(why)}</label>`;
      }).join("");
  }else if(t==="subclass"){
    /* Each with its pack and description, as the Change-subclass chooser shows
       them: a bare list of names asked the player to pick blind (#59). */
    const subMap=d?subclassesFor(d):{},from=ch.from||Object.keys(subMap);
    inner=`<label class="f">${esc(ch.label||"Choose a subclass")}</label>`+from.map(n=>{
      const sc=subMap[n]||{};
      return `<label class="opt" style="align-items:flex-start"><input type="radio" name="sub-${esc(ci)}" data-sub-opt value="${esc(n)}"><span><b>${esc(n)}</b>`+
        `${subSourceTag(n,sc)?` <span class="hint">(${esc(subSourceTag(n,sc))})</span>`:""}`+
        `${sc.description?`<span class="hint" style="display:block;margin:2px 0 0">${esc(sc.description)}</span>`:""}</span></label>`;
    }).join("");
  }else if(t==="hp"){
    /* The box holds the DICE total only; CON is added once, in hpGain(), so a
       roll and a typed number can't disagree about whether it is already in.
       Blank takes the average, so a player who rolls at the table types, and
       one who doesn't just presses Done. */
    const die=num(ch.die),n=Math.max(1,num(ch.levels)||1),dice=n+"d"+die;
    /* `hint`: a first class added above level 1 asks for levels 2..N only —
       level 1 was seeded — and "roll 2d10" for a level-3 Fighter needs saying why. */
    inner=die
      ?`<label class="f">Hit points — roll ${dice}, or take the average</label>`+
        (ch.hint?`<p class="hint" style="margin:0 0 6px">${esc(ch.hint)}</p>`:"")+
        `<div style="display:flex;gap:8px;align-items:center"><input type="number" min="0" inputmode="numeric" data-hp-dice placeholder="${esc(n*hpFixed(die))} (average)" aria-label="What the ${esc(dice)} came up — blank takes the average" style="flex:1">`+
        `<button class="tbtn" type="button" data-hp-roll>Roll for me</button></div><p class="hint" data-hp-prev style="margin:6px 0 0"></p>`
      :`<label class="f">Hit points gained</label><input type="number" min="0" inputmode="numeric" data-hp-dice placeholder="hit points gained" aria-label="Hit points gained">`+
        `<p class="hint" style="margin:6px 0 0">${esc(ch.cls||"This class")} has no hit die in the loaded rules — type what you gained, or leave it blank and set Max yourself.</p>`;
  }else if(t==="asi"){
    /* Feats allowed off (#118): exactly today's controls, no list */
    inner=character.featsAllowed===false?asiControlsHTML(ci):asiFeatListHTML(ch,ci,{showAll:false})+`<div class="ft-panel" data-ft-panel="${esc(ci)}">${asiPanelHTML(ch,ci,"__asi__")}</div>`;
  }else if(t==="feat"&&((ch.category&&!ch.from)||/^(race|bg):/.test(String(ch._sid||"")))){
    /* #118 §4.1: a species or background feat choice is the ASI step's list —
       filtered to its category ("an Origin feat of your choice"), to its
       `from` menu (a species' feat array), or, with neither, to what the
       character qualifies for (Custom Lineage). No ASI row, nothing pressed,
       and Feats allowed off does not hide it (it is the species' own feat, not
       the optional rule). It reads back as an asi selection; data-choose makes
       Done ask for the one pick — only when there is a row to pick. A class
       level's feat choice keeps its select below. */
    ctype="asi";
    const o=asiListOpts(ch);
    if(asiOfferedFeats(o).length+asiMissingFrom(o).length)chooseAttr=` data-choose="1"`;
    inner=asiFeatListHTML(ch,ci,{})+`<div class="ft-panel" data-ft-panel="${esc(ci)}"></div>`;
  }else if(t==="feat"){
    if(ch.from){
      inner=`<label class="f">${esc(ch.label||"Feat")}</label><select data-feat-opt><option value="">— none —</option>${ch.from.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>`;
    }else{
      inner=`<label class="f">${esc(ch.label||"Feat")}</label><select data-feat-opt><option value="">— none —</option>${(rules.feats||[]).map(f=>`<option value="${esc(f._id||f.name)}">${esc(dispName(f,"feats"))}</option>`).join("")}</select>`;
    }
  }else if(t==="option"){
    const from=Array.isArray(ch.from)?ch.from:[];const choose=ch.choose||1;const single=choose===1;
    /* choose===1 is structurally capped by being radios. Everything shipped is
       choose:1 today, so the checkbox half is dead code — but it is the same
       uncapped bug the moment a choose:2 option ships, so it gets the same
       treatment rather than waiting to be rediscovered. */
    /* Maneuvers, invocations and metamagic come back at later levels from the
       same list (#60), so an option already on the sheet is shown as yours and
       not offered twice — ticked and data-fixed like a granted skill, or just
       disabled in a radio group, where a tick would read as this level's pick.
       Matched by name, the only thing a sheet feature shares with its option.
       `repeatable` (four 2024 invocations) stays open. */
    const owned=from.map(o=>!o.repeatable&&(character.features||[]).some(f=>String(f.name||"").toLowerCase()===String(o.name||"").toLowerCase()));
    const have=owned.filter(Boolean).length,target=effectiveChoose(choose,from.length,have);
    if(!single)chooseAttr=` data-choose="${esc(target)}"`;
    inner=`<label class="f">${esc(ch.label||("Choose "+choose))}`+
      (have?` <span style="color:var(--ink-soft);font-weight:400">(${have} already yours)</span>`:"")+
      (single?"":` — <span data-chcount>0 of ${target} chosen</span>`)+
      `</label>`+from.map((o,i)=>{
      const fx=(o.effects||[]).map(e=>`${FX_LABEL[e.target]||e.target} ${fmt(num(e.value))}`).join(", ");
      const fixed=owned[i]?(single?" disabled":" checked disabled data-fixed"):"";
      return `<label class="opt" style="align-items:flex-start"><input type="${single?"radio":"checkbox"}" ${single?`name="opt-${esc(ci)}"`:""} data-opt-i="${esc(i)}"${fixed}><span><b>${esc(o.name||("Option "+(i+1)))}</b>${owned[i]?" (already yours)":""}${o.description?` — ${esc(o.description)}`:""}${fx?` <span style="color:var(--accent-2)">(${esc(fx)})</span>`:""}</span></label>`;
    }).join("");
  }else{
    inner=`<p class="hint">${esc(ch.label||ch.note||"A choice is available at your table.")}</p>`;
  }
  return `<div class="choice" data-ci="${esc(ci)}" data-ctype="${esc(ctype||"note")}" data-sid="${esc(ch._sid||"")}"${chooseAttr} style="border-top:1px dotted var(--hair);padding-top:10px;margin-top:10px">${inner}</div>`;
}
let _activeChoices=[];
/* ---- a choice window's title (#69) ----
   One window can hold several levels: a class added at 3 asks for its level-1
   skills, the hit points for levels 2-3 and the level-3 subclass together. So
   the title names the span of what is IN the window, read off the choices and
   notes themselves — "Fighter — Level 4", "Fighter — Levels 1–3". Each carries
   the `_level` it was collected at; an HP step covers `levels` levels ending at
   its own (2..N for a first class above level 1, 1..N for a multiclass). It
   used to be the FIRST choice's level, i.e. whichever block happened to lead.
   Nothing with a level (a plain-text note): no level is named, not guessed.
   A note is a string, or {text,_level} when a class or subclass level wrote it.
   Plain text throughout: openModal() sets the title as textContent, so the class
   name goes in as written — esc() here once showed "Tom &amp; Jerry". DOM-free. */
function choiceNoteText(n){return (n&&typeof n==="object")?String(n.text??""):String(n??"");}
function choiceLevelSpan(choices,notes){
  let lo=0,hi=0;
  (choices||[]).concat(notes||[]).forEach(x=>{
    const L=num(x&&x._level);if(L<1)return;
    const from=x.type==="hp"?Math.max(1,L-Math.max(1,num(x.levels))+1):L;
    if(!lo||from<lo)lo=from;
    if(L>hi)hi=L;
  });
  return hi?{lo,hi}:null;
}
function choiceWindowTitle(className,choices,notes){
  const s=choiceLevelSpan(choices,notes),name=String(className??"");
  return s?name+" — "+(s.lo===s.hi?"Level "+s.hi:"Levels "+s.lo+"–"+s.hi):name;
}
function sidToOrigin(sid,level){
  const s=String(sid||""),p=s.split(":"),rest=s.slice(s.indexOf(":")+1);
  if(p[0]==="class")return {kind:"class",class:p[1],level};
  if(p[0]==="subclass")return {kind:"class",class:p[1],subclass:p[2],level};
  /* the whole rest: a species or background name may hold a colon */
  if(p[0]==="race")return {kind:"race",name:rest};
  if(p[0]==="bg")return {kind:"background",name:rest};
  return {kind:"class",class:"",level};
}
/* `pending` is what waits behind this window, in runExtraChoices()'s shape: a
   new class's starting-equipment picker, and the skill choices of feats picked
   in an earlier window. There is ONE modal, so a window may only open once the
   one before it is finished — opening two at once is how Battle Master's
   maneuvers were replaced by the equipment picker before anyone saw them (#63).
   So the queue travels with the window: to its Done (commitChoices), or, if the
   player dismisses it, on to the next window (setDismissGuard's `then`) —
   dismissing costs this window's own picks, which the guard warns about, not
   the gear of a class that is already on the sheet. It used to wait in a module
   global instead, which outlived a dismissed window and popped up after the
   NEXT level-up. With nothing to show, it goes straight on. */
function runChoices(className,choices,notes,pending){
  if((!choices||!choices.length)&&(!notes||!notes.length)){runExtraChoices(pending);return;}
  _activeChoices=choices||[];
  const d=findClassDef(className);
  let body="";
  (notes||[]).forEach(n=>body+=`<p class="hint" style="color:var(--accent-2);font-size:14px">✦ ${esc(choiceNoteText(n))}</p>`);
  (choices||[]).forEach((ch,ci)=>body+=choiceFieldHTML(ch,ci,d));
  body+=`<div class="m-actions"><button class="tbtn primary" id="chDone">Done</button></div>`;
  openModal(choiceWindowTitle(className,choices,notes),body);
  /* Guard the dismissals too. A Done-only warning would make Escape — which
     discards EVERY pick with no way to reopen the chooser — the easiest way
     past it, which is the opposite of the point. Registered after openModal,
     because openModal clears the guard on every open. */
  armChoiceDismissGuard(pending);
  wireHPChoice();
  wireAsiFeats(_activeChoices);
  /* The warnings first, with the window open; the picks are read after them */
  const done=document.getElementById("chDone");
  done.addEventListener("click",choiceDoneHandler(done,()=>{
    const sel=gatherChoices();closeModal();commitChoices(className,sel,pending);
  }));
}
/* The HP block's live working and its Roll button. */
function wireHPChoice(){
  document.querySelectorAll('.choice[data-ctype="hp"]').forEach(div=>{
    const ch=_activeChoices[num(div.dataset.ci)],box=div.querySelector("[data-hp-dice]"),
          prev=div.querySelector("[data-hp-prev]"),btn=div.querySelector("[data-hp-roll]");
    if(!ch||!box||!prev)return;
    let note="";
    const sync=()=>{prev.textContent=hpGainText(ch,box.value,conModNow(),character.hp.max,note);};
    box.addEventListener("input",()=>{note="";sync();});
    if(btn)btn.addEventListener("click",()=>{
      const r=rollDiceExpr({dice:[{n:Math.max(1,num(ch.levels)||1),sides:num(ch.die),sign:1}],mod:0});
      box.value=r.total;note="Rolled "+r.faces.join(", ");sync();
    });
    sync();
  });
}
/* Would dismissing throw away hit points? Only when there is something to add:
   a die to take the average of, or a number typed for a class without one. */
function hpPending(){
  const div=document.querySelector('.choice[data-ctype="hp"]');if(!div)return false;
  const box=div.querySelector("[data-hp-dice]");
  return !!(div.querySelector("[data-hp-roll]")||(box&&String(box.value).trim()!==""));
}
/* Shared by both choice modals. The message differs from Done's: here the picks
   are about to be thrown away, not merely left short. `pending` — the windows
   queued behind this one — still opens after a dismissal (see runChoices). */
function armChoiceDismissGuard(pending){
  const then=(pending&&pending.length)?()=>runExtraChoices(pending):null;
  setDismissGuard(()=>{
    const blocks=choiceBlocks();
    const picked=blocks.reduce((a,b)=>a+num(b.picked),0);
    const short=choiceShortfall(blocks);
    const hp=hpPending();
    /* Hit points alone are not lost for good — addClass() left Max unlocked
       (this block is creation's: a first class added above level 1; a
       level-up's HP is on the level card, #101) — so they get their own,
       milder question rather than "no way to reopen". */
    if(!short&&!picked)return hp?LU_HP_CLOSE:"";
    return (picked?"Closing will discard the picks you have made.":"You have not made your picks yet.")+
      "\n\nThere is no way to reopen this later — you would have to remove and re-add it."+
      (hp?"\n\nThis level's hit points will not be added either.":"")+"\n\nClose anyway?";
  },then);
}
function gatherChoices(){
  const out=[];
  document.querySelectorAll(".choice").forEach(div=>{
    const t=div.dataset.ctype;
    if(t==="skill")out.push({type:"skill",sid:div.dataset.sid||"",keys:Array.from(div.querySelectorAll('[data-skill-opt]:checked:not(:disabled)')).map(cb=>cb.dataset.skillOpt).filter(Boolean)});
    else if(t==="subclass"){const r=div.querySelector('[data-sub-opt]:checked');out.push({type:"subclass",name:r?r.value:null});}
    else if(t==="asi"){
      /* #118: the pressed row — with no rows drawn (Feats allowed off) the ASI,
         with rows but none pressed (a category list) null, no pick — the
         ASI's controls when it is the pick, and each "+1 to:" answer at the index
         of its featAbilityChoices() entry — a fixed increase draws no group, so
         reading the groups in order would shift the ones after it. */
      const pk=div.querySelector('[data-ft-pick][aria-pressed="true"]');const pick=pk?pk.dataset.ftPick:(div.querySelector("[data-ft-pick]")?null:"__asi__");
      const mode=(div.querySelector('[data-asi-mode]:checked')||{}).value||"2";
      const plus=[];div.querySelectorAll('[data-ft-plus][aria-pressed="true"]').forEach(c=>{plus[num(c.dataset.ftPlus)]=c.dataset.k;});
      out.push({type:"asi",pick,mode,a:(div.querySelector('[data-asi-a]')||{}).value,b:(div.querySelector('[data-asi-b]')||{}).value,plus,sid:div.dataset.sid||""});}
    else if(t==="feat"){const sel=div.querySelector('[data-feat-opt]');out.push({type:"feat",name:sel?sel.value:"",sid:div.dataset.sid||""});}
    else if(t==="option")out.push({type:"option",ci:num(div.dataset.ci),sid:div.dataset.sid||"",idxs:Array.from(div.querySelectorAll('[data-opt-i]:checked:not(:disabled)')).map(cb=>num(cb.dataset.optI))});
    else if(t==="hp"){const b=div.querySelector('[data-hp-dice]');out.push({type:"hp",ci:num(div.dataset.ci),dice:b?String(b.value).trim():""});}
  });
  return out;
}
/* `pending` is the queue this window's Done was handed (see runChoices). */
function commitChoices(className,selections,pending){
  const entry=character.classes.find(c=>c.name===className);
  let pendingSub=null;const _featPending=[];
  selections.forEach(sel=>{
    if(sel.type==="skill")sel.keys.forEach(k=>grantProf(sel.sid||("class:"+className),"skill",k,1));
    else if(sel.type==="subclass"){if(sel.name)pendingSub=sel.name;}
    else if(sel.type==="asi")commitAsiPick(sel,{kind:"class",class:className,level:entry?entry.level:null},_featPending);
    else if(sel.type==="feat"){if(sel.name)grantFeatDef(sel.name,{kind:"class",class:className,level:entry?entry.level:null},_featPending);}
    else if(sel.type==="hp"){const ch=_activeChoices[sel.ci];if(ch&&ch.type==="hp")commitHPChoice(ch,sel.dice);}
    else if(sel.type==="option"){const ch=_activeChoices[sel.ci];if(ch&&Array.isArray(ch.from))sel.idxs.forEach(i=>{const o=ch.from[i];if(o)addFeatureFromDef({name:o.name,description:o.description||"",effects:o.effects||[],skills:o.skills,saves:o.saves,cost:o.cost},sidToOrigin(sel.sid,ch._level));});}
  });
  renderClassRace();renderFeatures();renderAllRT();recompute();scheduleSave();
  /* One window at a time (#63). A picked subclass opens its own level choices,
     so everything still waiting — the queue this window was handed, plus the
     skill choices of any feat just picked — goes behind THAT window instead of
     opening now and replacing it. A feat and a subclass at one level raced the
     same way (ledger L2571). */
  const next=(pending||[]).concat(_featPending);
  if(pendingSub)selectSubclass(className,pendingSub,next);
  else runExtraChoices(next);
}
/* runExtraChoices()'s Done for the picks that grant (#118): skills to their
   source, and each feat — the category list or a feat select — with the origin
   its sid names, so removing that species or background takes it back out.
   A feat's own skill choices go on `pending`, for the next window. */
function commitExtraChoices(selections,pending){
  (selections||[]).forEach(s=>{
    if(s.type==="skill")s.keys.forEach(k=>grantProf(s.sid,"skill",k,1));
    else if(s.type==="asi"&&s.sid)commitAsiPick(s,sidToOrigin(s.sid),pending);
    else if(s.type==="feat"&&s.sid&&s.name)grantFeatDef(s.name,sidToOrigin(s.sid),pending);
  });
}
