/* ================= trackers =================
   Counters the player makes up, grouped by a tag of their choosing — kills by
   creature type, pages of a book. (Checklists and tasks live in journal pages
   since #95.) One that can finish can close itself when it does, into a
   Completed list, with an Undo. Design: src/docs/specs/2026-09-29-journal-design.md §6

   NOT the resource trackers on the Sheet (65-resources.js), nor the combat round
   tracker (87-combat.js). Tags are the journal's: tagLabel(), groupByTag() in
   87-journal.js.

   The pure half comes first — no DOM — so src/tests/sheet.js can assert it. */

const TRK_TYPES=[["counter","Counter"]];

/* ---- reading one, whatever a file put there ----
   migrate() keeps only objects in `trackers` and repairs their ids; every
   field inside is read through these. */
function trkList(c){const l=c&&c.trackers;return Array.isArray(l)?l.filter(t=>t&&typeof t==="object"&&!Array.isArray(t)):[];}
/* Every tracker is a counter since #95; a file's "checklist" or "task"
   migrates to a page (migrateTrackerPages()). */
function trkType(t){return "counter";}
/* A whole number, 0 or more; anything else is 0. */
function trkInt(v){const n=Math.floor(Number(v));return isFinite(n)&&n>0?n:0;}
function trkName(t){return jnlStr(t&&t.name).trim()||"Untitled";}
function showTrackers(c){return !c||c.showTrackers!==false;}
/* A typed count: digits only, or null to put the old value back. */
function trkParse(v){const s=jnlStr(v).trim();return /^\d+$/.test(s)?parseInt(s,10):null;}

/* ---- checklists and tasks became journal pages (#95) ----
   Every tracker whose RAW type is checklist or task leaves `trackers` and
   becomes journal text (spec §5). A checklist is one page: its name, its tag,
   one "[ ]"/"[x]" line per item, each item keeping its own tick, and for a
   closed one a final "Closed <date>" (ticking every item would lose the real
   ticks for good). Tasks are one "Tasks" page per tag, a line each, a closed
   one ticked (a task's only state is done) with its date on the line.
   Idempotent by construction: afterwards no tracker has either type, so there
   is no pass counter to keep. No DOM; it mutates `c` and calls uid().
   migrate() (71-char-io.js) calls it after the list guards. Dates are written
   as the locale's date, not fmtWhen()'s relative "3h ago", which would freeze
   wrong on a page; a date no calendar holds writes none. */
function migrateTrackerPages(c,now){
  const all=Array.isArray(c.trackers)?c.trackers:[];
  const gone=all.filter(t=>t&&typeof t==="object"&&!Array.isArray(t)&&(t.type==="checklist"||t.type==="task"));
  if(!gone.length)return 0;
  if(!Array.isArray(c.journal))c.journal=[];
  const day=ts=>{const d=new Date(jnlTime(ts));return jnlTime(ts)&&!isNaN(d.getTime())?d.toLocaleDateString():"";};
  const mark=on=>on?"[x] ":"[ ] ";
  gone.filter(t=>t.type==="checklist").forEach(t=>{
    const closed=t.closed===true,when=day(t.closedAt);
    const items=Array.isArray(t.items)?t.items.filter(i=>i&&typeof i==="object"&&!Array.isArray(i)):[];
    const lines=items.map(i=>mark(i.done===true)+(jnlStr(i.text).trim()||"Untitled"));
    if(closed&&when){if(lines.length)lines.push("");lines.push("Closed "+when);}
    const at=jnlTime(t.at)||now;
    c.journal.push({id:uid(),title:trkName(t),tag:tagLabel(t.tag),text:lines.join("\n"),at,editedAt:jnlTime(t.closedAt)||at});
  });
  groupByTag(gone.filter(t=>t.type==="task"),t=>t.tag).forEach(g=>{
    const items=g.items.slice().sort((a,b)=>jnlTime(a.at)-jnlTime(b.at));
    const lines=items.map(t=>{const closed=t.closed===true,when=day(t.closedAt);return mark(closed||t.done===true)+trkName(t)+(closed&&when?" — closed "+when:"");});
    const ats=items.map(t=>jnlTime(t.at)).filter(Boolean),eds=items.map(t=>jnlTime(t.closedAt)||jnlTime(t.at)).filter(Boolean);
    c.journal.push({id:uid(),title:"Tasks",tag:g.key?g.label:"",text:lines.join("\n"),at:ats.length?Math.min.apply(null,ats):now,editedAt:eds.length?Math.max.apply(null,eds):now});
  });
  c.trackers=all.filter(t=>gone.indexOf(t)<0);
  return gone.length;
}

/* ---- how far along ----
   A counter with no goal (kills) is never complete: there is nothing to
   finish. */
function trkProgress(t){
  const v=trkInt(t.value),g=trkInt(t.goal);
  return {done:v,total:g,pct:g?Math.min(100,Math.round(v*100/g)):0,complete:g>0&&v>=g};
}

/* ---- the close rule, in exactly one place ----
   A row control is applied; if that took the tracker from not done to done, and
   Close when complete is on (the default), it closes. Returns whether it did.
   Nothing else closes a tracker on its own: not the form, not making one, and not
   a tap on one that was already complete — so a tracker reopened at 100% stays
   open until it drops below and comes back. */
function trkApply(t,change,now){
  const was=trkProgress(t).complete;
  change(t);
  if(was||!trkProgress(t).complete||t.autoClose===false||t.closed===true)return false;
  t.closed=true;t.closedAt=now;return true;
}
/* Never below 0; past the goal is fine ("read it twice"). */
function trkStep(t,d,now){return trkApply(t,x=>{x.value=Math.max(0,trkInt(x.value)+d);},now);}
function trkSetValue(t,v,now){return trkApply(t,x=>{x.value=trkInt(v);},now);}
/* By hand, from the form. No Undo: it was deliberate. Reopening leaves the
   progress alone. */
function trkClose(t,now){t.closed=true;t.closedAt=now;}
function trkReopen(t){t.closed=false;delete t.closedAt;}
/* Undo restores the tracker as it was BEFORE the tap: the tick and the close
   together. A copy each way, so neither side can reach the other. */
function trkSnapshot(t){return JSON.parse(JSON.stringify(t));}
function trkRestore(c,snap){
  const l=Array.isArray(c&&c.trackers)?c.trackers:null,i=l?l.findIndex(x=>x&&x.id===snap.id):-1;
  if(i<0)return false;
  l[i]=JSON.parse(JSON.stringify(snap));return true;
}

/* The form's fields onto a tracker. Never closes it, whatever the new goal. */
function trkFromForm(t,f){
  t.name=jnlStr(f.name).trim();
  t.type="counter";
  t.tag=tagLabel(f.tag);
  t.goal=trkInt(f.goal);
  delete t.items;delete t.done;
  t.autoClose=f.autoClose!==false;
  t.value=trkInt(t.value);
  if(f.afterCombat===true)t.afterCombat=true;else delete t.afterCombat;   /* #105 */
  return t;
}

/* ---- the card's layout ----
   Open trackers grouped by tag, in the order they were made; closed ones in one
   flat list, most recently closed first. */
function trkSplit(c){
  const all=trkList(c);
  return {
    open:groupByTag(all.filter(t=>t.closed!==true),t=>t.tag),
    closed:all.filter(t=>t.closed===true).sort((a,b)=>jnlTime(b.closedAt)-jnlTime(a.closedAt))
  };
}
function trkGroupOpen(c,key){const m=c&&c.trackerCollapse;return !(m&&typeof m==="object"&&!Array.isArray(m)&&m[key]);}
/* ---- a group's total (#93) ----
   Every counter with the tag, open OR closed, so completing one never drops
   the total. Shown only where trackerTotals[key] is true (absent is off, the
   collapse-map convention); the key is tagKey(), "" for Untagged. */
function trkTotalOn(c,key){const m=c&&c.trackerTotals;return !!(m&&typeof m==="object"&&!Array.isArray(m)&&m[key]===true);}
function trkGroupTotal(c,key){return trkList(c).filter(t=>tagKey(t.tag)===key).reduce((s,t)=>s+trkInt(t.value),0);}
/* The ids of the open trackers drawn after `id`, in the card's order: the rest
   of its group, then the groups below. A shut group's rows can't take focus, so
   they are left out. Where Tab from a closing tap's Undo goes (trkAct()). */
function trkAfter(c,id){
  const ids=[];let seen=false;
  trkSplit(c).open.forEach(g=>{const o=trkGroupOpen(c,g.key);g.items.forEach(t=>{if(seen&&o)ids.push(t.id);if(t.id===id)seen=true;});});
  return ids;
}

/* ---- markup: pure strings, so the harness can assert every state ----
   Names and items are the player's plain words: esc() only, no glossary pass. A
   chip inside a checkbox button would be a button in a button, and every −/+
   would pay for a highlight() of the whole card.
   `opts.noEdit` (#105): no pen, for the End of combat window, where the form
   would replace the window. */
const TRK_PEN=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
function trkEditHTML(t){return `<button type="button" class="icon ed" data-trkedit="${esc(t.id)}" aria-label="${esc("Edit "+trkName(t))}" title="Edit">${TRK_PEN}</button>`;}
function trackerRowHTML(t,opts){
  const o=opts||{};
  const pr=trkProgress(t),name=trkName(t),g=trkInt(t.goal);
  const body=`<div class="trk-ctl"><button type="button" class="res-btn" data-trkdec="${esc(t.id)}" aria-label="${esc("One less — "+name)}">−</button>`+
    `<input class="trk-val" data-trkval="${esc(t.id)}" inputmode="numeric" value="${esc(pr.done)}" aria-label="${esc(name+" — count")}">`+
    `<button type="button" class="res-btn" data-trkinc="${esc(t.id)}" aria-label="${esc("One more — "+name)}">+</button>`+
    (g?`<span class="trk-of">of ${esc(g)}</span>`:"")+`</div>`+
    (g?`<div class="trk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${esc(g)}" aria-valuenow="${esc(Math.min(pr.done,g))}" aria-label="${esc(name)}"><span style="width:${esc(pr.pct)}%"></span></div>`:"");
  return `<div class="trk" data-trk="${esc(t.id)}"><div class="trk-top"><span class="trk-name">${esc(name)}</span>${o.noEdit?"":trkEditHTML(t)}</div>${body}</div>`;
}
/* In Completed: what it came to, when it closed, and the way back. */
function trkSummary(t){const pr=trkProgress(t);return trkInt(t.goal)?pr.done+" / "+trkInt(t.goal):String(pr.done);}
function trackerClosedHTML(t){
  const when=jnlTime(t.closedAt)?"Closed "+fmtWhen(jnlTime(t.closedAt)):"";
  return `<div class="trk trk-closed" data-trk="${esc(t.id)}"><div class="trk-top"><span class="trk-name">${esc(trkName(t))}</span>`+
    `<span class="trk-prog">${esc(trkSummary(t))}</span>${when?`<span class="n-when">${esc(when)}</span>`:""}`+
    `<button type="button" class="tbtn" data-trkreopen="${esc(t.id)}" aria-label="${esc("Reopen "+trkName(t))}">Reopen</button>${trkEditHTML(t)}</div></div>`;
}
function trackersHTML(c,completedOpen){
  const s=trkSplit(c);
  if(!s.open.length&&!s.closed.length)return `<div class="empty">No trackers yet. Tap + Tracker to count something — kills, pages read, days on the road.</div>`;
  const caret=o=>`<svg class="fcaret ${o?"":"c"}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>`;
  let h=s.open.length?s.open.map(g=>{
    const o=trkGroupOpen(c,g.key),on=trkTotalOn(c,g.key);
    return `<div class="fgroup"><div class="fghead" data-trkgroup="${esc(g.key)}" role="button" tabindex="0" aria-expanded="${o?"true":"false"}">`+
      caret(o)+`<span class="fgname">${esc(g.label)}</span><span class="cnt">(${g.items.length})</span>`+
      (on?`<span class="trk-total">· ${esc(trkGroupTotal(c,g.key))}</span>`:"")+
      `<button type="button" class="icon trk-sum${on?" on":""}" data-trktotal="${esc(g.key)}" aria-pressed="${on?"true":"false"}" aria-label="${esc("Total for "+g.label)}" title="Total">Σ</button></div>`+
      `<div class="trk-group"${o?"":` style="display:none"`}>${g.items.map(t=>trackerRowHTML(t)).join("")}</div></div>`;
  }).join(""):`<div class="empty">Nothing open — everything here is done.</div>`;
  if(s.closed.length)h+=`<div class="fgroup trk-done"><div class="fghead" data-trkcompleted role="button" tabindex="0" aria-expanded="${completedOpen?"true":"false"}">`+
    caret(completedOpen)+`<span class="fgname">Completed</span><span class="cnt">(${s.closed.length})</span></div>`+
    `<div class="trk-group"${completedOpen?"":` style="display:none"`}>${s.closed.map(trackerClosedHTML).join("")}</div></div>`;
  return h;
}
/* Name and Tag side by side, then Goal; Close when complete only once there is a
   goal to complete. Close now / Reopen and Delete only for one that exists. */
function trackerFormHTML(t,tags,isNew){
  const g=trkInt(t.goal),auto=t.autoClose!==false;
  return `<div class="g2"><div class="field"><label class="f" for="tkName">Name</label><input id="tkName" value="${esc(jnlStr(t.name))}" placeholder="e.g. Goblins slain" autocomplete="off"></div>`+
    groupFieldHTML({id:"tkTag",list:"tkTags",label:"Tag",value:t.tag,choices:tags,placeholder:"e.g. Kills"})+`</div>`+
    `<div class="field"><label class="f" for="tkGoal">Goal</label><input id="tkGoal" type="number" min="0" inputmode="numeric" value="${esc(g||"")}" placeholder="None — count forever"></div>`+
    `<div class="toggle" id="tkAutoRow"><div><div class="t-lbl">Close when complete</div><div class="t-sub">Move it to Completed once it's done. You get an Undo.</div></div>`+
      `<button type="button" class="switch ${auto?"on":""}" id="tkAuto" role="switch" aria-checked="${auto?"true":"false"}" aria-label="Close when complete"></button></div>`+
    `<div class="toggle"><div><div class="t-lbl">Show after combat</div></div>`+
      `<button type="button" class="switch ${t.afterCombat===true?"on":""}" id="tkAfter" role="switch" aria-checked="${t.afterCombat===true?"true":"false"}" aria-label="Show after combat"></button></div>`+
    `<div class="m-actions">`+(isNew?"":`<button type="button" class="tbtn danger" id="tkDel" style="margin-right:auto">Delete</button>`+
      `<button type="button" class="tbtn" id="tkCloseNow">${t.closed===true?"Reopen":"Close now"}</button>`)+
    `<button type="button" class="tbtn" id="tkCancel">Cancel</button><button type="button" class="tbtn primary" id="tkSave">${isNew?"Add":"Save"}</button></div>`;
}

/* ================= the DOM layer ================= */
/* Session only: whose trackers these are, and whether Completed is open. Keyed
   on the character OBJECT, not its id: Import → Replace keeps the id and swaps
   the whole sheet, and every switch (loadCharById(), newCharacter(),
   finishImport()) puts a new object in `character`. */
let trkWho=null, trkCompletedOpen=false;
/* The card redraws whole after a tap. Focus goes back to the same control, found
   by its first data-* hook (openerSelector()), so holding Enter on + keeps
   counting — a button repeats on a held Enter; Space clicks once, on key-up.
   Hidden, it stays in the DOM (the section registry's rule). */
function renderTrackers(){
  const el=document.getElementById("trkList");if(!el)return;
  if(trkWho!==character){trkWho=character;trkCompletedOpen=false;}
  const card=document.getElementById("trackersCard");if(card)card.style.display=showTrackers(character)?"":"none";
  /* #105: the End of combat window may hold the same tiles (#ecTrkList). Both
     are redrawn, and focus goes back inside whichever held it — the same hook
     exists in both, so the search must stay inside its own box. */
  const ec=document.getElementById("ecTrkList"),a=document.activeElement;
  const host=[el,ec].find(b=>b&&a&&b.contains&&b.contains(a))||null,sel=host?openerSelector(a):null;
  el.innerHTML=trackersHTML(character,trkCompletedOpen);
  if(ec)endFightPaintTrackers(ec);
  if(sel){const b=host.querySelector(sel);if(b&&b.focus)b.focus({preventScroll:true});}
  /* Shown or hidden, it may be the only card in an open combat view, whose
     "Add sections…" hint has to follow it. */
  if(combatViewOpen())renderCombatEmpty();
}
function trkById(id){return trkList(character).find(t=>t.id===id)||null;}
/* A typed count, written into its row where it stands: the box, the bar's value
   and its width, and the group header's total when it shows one (#93). The
   goal and the "of N" can't change from the row. false when there is no row,
   for the caller to redraw instead. */
function trkPatchRow(t){
  /* #105: every copy — the Journal tab's tile and the End of combat window's */
  const rows=[...document.querySelectorAll(attrSel("data-trk",t.id))];if(!rows.length)return false;
  const pr=trkProgress(t),g=trkInt(t.goal);
  rows.forEach(row=>{
    const v=row.querySelector("[data-trkval]");if(v)v.value=String(pr.done);
    const bar=row.querySelector(".trk-bar");
    if(bar){bar.setAttribute("aria-valuenow",String(Math.min(pr.done,g)));const f=bar.querySelector("span");if(f)f.style.width=pr.pct+"%";}
    const grp=row.closest&&row.closest(".fgroup"),tot=grp&&grp.querySelector(".trk-total");
    if(tot)tot.textContent="· "+trkGroupTotal(character,tagKey(t.tag));
  });
  return true;
}
/* One tap on a row. When it finishes a tracker set to close, the toast offers an
   Undo of the whole tap; from the keyboard (Enter/Space, event.detail 0) focus
   goes to that Undo, since the row it was on just left for Completed, and Tab or
   Esc from the Undo goes on to the next tracker (trkAfter(), taken before the
   tap, while this one still has its place).
   `inPlace` is the count box's `change` path, which fires as the box loses
   focus: at the mousedown on +, or at a Tab. A redraw there replaced the + under
   the pointer, so its click never arrived, and dropped a Tab's focus to the
   page. So unless the tap closed the tracker (its row has to leave), the row is
   patched instead (trkPatchRow()).
   The save is scheduled before the redraw, so nothing a redraw throws can cost
   the player the tap. */
function trkAct(id,fn,viaKey,inPlace){
  const t=trkById(id);if(!t||t.closed===true)return false;
  const snap=trkSnapshot(t),who=character,next=trkAfter(character,id);
  const closed=fn(t,Date.now());
  scheduleSave();
  if(closed||!inPlace||!trkPatchRow(t))renderTrackers();
  if(!closed)return false;
  const undo=toast(`“${trkName(t)}” complete`,{label:"Undo",
    run:e=>undoTrackerChange(snap,who,!!e&&e.detail===0),
    back:()=>trkNextControl(next)});
  if(viaKey&&undo)undo.focus();
  return true;
}
/* #105: while the End of combat window is open, its list (#ecTrkList) is
   where a tracker's focus belongs — the Journal tab's copy sits under the
   modal, inert, or on a hidden tab. null when the window isn't open. */
function trkFocusScope(){
  if(typeof endFightLive!=="function"||!endFightLive()||!document.getElementById("ecDone"))return null;
  return document.getElementById("ecTrkList")||null;
}
/* The first control of the first of `ids` still open and on screen — the rows
   may have moved on since the toast went up — or else + Tracker. Inside the
   End of combat window: only its own tiles, or else its first control left,
   or else Done. */
function trkNextControl(ids){
  const sc=trkFocusScope(),root=sc||document;
  for(const id of ids){
    const row=root.querySelector(".trk:not(.trk-closed)"+attrSel("data-trk",id)),f=row&&row.querySelector("button,input");
    if(f&&f.getClientRects().length)return f;
  }
  if(sc)return sc.querySelector("button,input")||document.getElementById("ecDone");
  return document.getElementById("addTracker");
}
/* `who` is the character object the toast was shown for: its Undo belongs to
   that sheet, not to one loaded since, nor to one imported over it under the
   same id. */
function undoTrackerChange(snap,who,viaKey){
  if(!character||character!==who)return false;
  if(!trkRestore(character,snap))return false;
  renderTrackers();scheduleSave();
  toast(`“${trkName(snap)}” is back`);
  if(viaKey){
    /* the window's tiles have no pen: there, the tile's + */
    const sc=trkFocusScope();
    const b=sc?(sc.querySelector(attrSel("data-trkinc",snap.id))||document.getElementById("ecDone")):document.querySelector(attrSel("data-trkedit",snap.id));
    if(b&&b.focus)b.focus();
  }
  return true;
}
/* The count box commits on change or Enter, like the coin and HP boxes
   (commitBox() in 90-boot.js). Anything but digits puts the old count back.
   Returns the box, for Enter to select.
   - A change patches the row in place (trkAct()'s `inPlace`), and a count that
     isn't one is simply put back, in place too.
   - Enter redraws. If it completes the tracker, its row leaves for Completed
     and trkAct() moves focus to the toast's Undo instead.
   The box returned is found inside the list the typed one sat in, taken
   before the redraw replaces it: the same tile can be both on the Journal tab
   and in the End of combat window (#105), and the tab's copy comes first in
   the page. */
function commitTrackerValue(inp,viaKey){
  const id=inp.dataset.trkval,n=trkParse(inp.value);
  const host=(inp.closest&&inp.closest("#ecTrkList,#trkList"))||document;
  if(n!==null)trkAct(id,(t,now)=>trkSetValue(t,n,now),!!viaKey,!viaKey);
  else if(viaKey)renderTrackers();
  else{const t=trkById(id);if(t)inp.value=String(trkProgress(t).done);else renderTrackers();}
  return host.querySelector(attrSel("data-trkval",id));
}
function toggleTrkGroup(key){
  if(!character.trackerCollapse||typeof character.trackerCollapse!=="object"||Array.isArray(character.trackerCollapse))character.trackerCollapse={};
  character.trackerCollapse[key]=!character.trackerCollapse[key];
  renderTrackers();scheduleSave();
}
function toggleTrkTotal(key){
  if(!character.trackerTotals||typeof character.trackerTotals!=="object"||Array.isArray(character.trackerTotals))character.trackerTotals={};
  if(character.trackerTotals[key]===true)delete character.trackerTotals[key];else character.trackerTotals[key]=true;
  renderTrackers();scheduleSave();
}
function toggleTrkCompleted(){trkCompletedOpen=!trkCompletedOpen;renderTrackers();}
/* Reopening moves the row from trackerClosedHTML() (data-trkreopen) back into
   trackerRowHTML() (no such hook), so renderTrackers()'s own focus-restore has
   nothing to find. From the keyboard, land on the tracker's edit button
   instead — the one hook both row forms carry. */
function reopenTracker(id,viaKey){
  const t=trkById(id);if(!t)return;
  trkReopen(t);renderTrackers();scheduleSave();toast(`“${trkName(t)}” reopened`);
  if(viaKey){const b=document.querySelector(attrSel("data-trkedit",id));if(b&&b.focus)b.focus();}
}
function openTrackerForm(existing){
  const isNew=!existing;
  const t=existing||{id:uid(),name:"",type:"counter",tag:"",value:0,goal:0,autoClose:true,at:Date.now()};
  openModal(isNew?"New tracker":"Edit tracker",trackerFormHTML(t,jnlTagList(character),isNew));
  const $=id=>document.getElementById(id);
  /* Close when complete only for one that can complete: a counter needs a goal. */
  const sync=()=>{$("tkAutoRow").hidden=!trkInt($("tkGoal").value);};
  $("tkGoal").addEventListener("input",sync);sync();
  $("tkAuto").addEventListener("click",e=>{const b=e.currentTarget,on=!b.classList.contains("on");b.classList.toggle("on",on);b.setAttribute("aria-checked",on?"true":"false");});
  $("tkAfter").addEventListener("click",e=>{const b=e.currentTarget,on=!b.classList.contains("on");b.classList.toggle("on",on);b.setAttribute("aria-checked",on?"true":"false");});
  $("tkCancel").addEventListener("click",closeModal);
  /* The tracker as stored NOW. The toast sits outside the modal's inert, so its
     Undo can land while this form is open and swap the stored object for its
     snapshot — `t` would then be a copy no longer in the list. A new tracker
     has no stored copy: Save adds `t` itself. */
  const cur=()=>isNew?t:trkById(t.id);
  const fields=()=>({name:$("tkName").value,tag:$("tkTag").value,goal:$("tkGoal").value,autoClose:$("tkAuto").classList.contains("on"),afterCombat:$("tkAfter").classList.contains("on")});
  const done=()=>{closeModal();renderTrackers();scheduleSave();};
  {const d=$("tkDel");if(d)d.addEventListener("click",()=>{
    if(!confirm(`Delete the tracker “${trkName(cur()||t)}”?`))return;
    character.trackers=trkList(character).filter(x=>x.id!==t.id);done();});}
  /* Close now / Reopen keeps what was typed. The button does what it SAID when
     the form opened, so an Undo in between can't turn Reopen into a close. */
  {const b=$("tkCloseNow"),closing=t.closed!==true;if(b)b.addEventListener("click",()=>{
    if(groupFieldBlocked("tkTag"))return;
    const x=cur();if(!x){closeModal();renderTrackers();return;}
    trkFromForm(x,fields());
    if(closing)trkClose(x,Date.now());else trkReopen(x);
    done();});}
  $("tkSave").addEventListener("click",()=>{
    if(groupFieldBlocked("tkTag"))return;
    const x=cur();if(!x){closeModal();renderTrackers();return;}
    trkFromForm(x,fields());
    if(isNew){if(!Array.isArray(character.trackers))character.trackers=[];character.trackers.push(x);}
    done();
  });
}
