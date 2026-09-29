/* ================= trackers =================
   Counters, checklists and one-line tasks the player makes up, grouped by a tag
   of their choosing — kills by creature type, pages of a book, the steps of a
   quest. One that can finish can close itself when it does, into a Completed
   list, with an Undo. Design: src/docs/specs/2026-09-29-journal-design.md §6

   NOT the resource trackers on the Sheet (65-resources.js), nor the combat round
   tracker (87-combat.js). Tags are the journal's: tagLabel(), groupByTag() in
   87-journal.js.

   The pure half comes first — no DOM — so src/tests/sheet.js can assert it. */

const TRK_TYPES=[["counter","Counter"],["checklist","Checklist"],["task","Task"]];

/* ---- reading one, whatever a file put there ----
   migrate() keeps only objects in `trackers` (and in each `items`) and repairs
   their ids; every field inside is read through these. */
function trkList(c){const l=c&&c.trackers;return Array.isArray(l)?l.filter(t=>t&&typeof t==="object"&&!Array.isArray(t)):[];}
function trkType(t){const v=t&&t.type;return (v==="checklist"||v==="task")?v:"counter";}
/* A whole number, 0 or more; anything else is 0. */
function trkInt(v){const n=Math.floor(Number(v));return isFinite(n)&&n>0?n:0;}
function trkItems(t){const l=t&&t.items;return Array.isArray(l)?l.filter(x=>x&&typeof x==="object"&&!Array.isArray(x)):[];}
function trkName(t){return jnlStr(t&&t.name).trim()||"Untitled";}
function showTrackers(c){return !c||c.showTrackers!==false;}
/* A typed count: digits only, or null to put the old value back. */
function trkParse(v){const s=jnlStr(v).trim();return /^\d+$/.test(s)?parseInt(s,10):null;}

/* ---- how far along ----
   A counter with no goal (kills) and a checklist with no items are never
   complete: there is nothing to finish. Only a real `true` ticks anything. */
function trkProgress(t){
  const ty=trkType(t);
  if(ty==="task"){const d=t.done===true;return {done:d?1:0,total:1,pct:d?100:0,complete:d};}
  if(ty==="checklist"){
    const it=trkItems(t),n=it.filter(x=>x.done===true).length;
    return {done:n,total:it.length,pct:it.length?Math.round(n*100/it.length):0,complete:it.length>0&&n===it.length};
  }
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
function trkToggleItem(t,itemId,now){return trkApply(t,x=>{const it=trkItems(x).find(i=>i.id===itemId);if(it)it.done=it.done!==true;},now);}
function trkToggleTask(t,now){return trkApply(t,x=>{x.done=x.done!==true;},now);}
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

/* ---- the form's lines back into items ----
   One line, one item. Each line takes the first unused old item with exactly its
   text, keeping that item's id and tick, so reordering keeps every tick; a new or
   reworded line is a new item, unticked. A leading bullet ("- ", "* ", "• ") is
   typing habit, not part of the item. */
function mergeChecklist(items,text){
  const old=Array.isArray(items)?items.filter(x=>x&&typeof x==="object"):[],used=new Set();
  return jnlStr(text).replace(/\r\n?/g,"\n").split("\n").map(l=>l.replace(/^\s*[-*+\u2022]\s+/,"").trim()).filter(Boolean).map(l=>{
    const hit=old.find(x=>!used.has(x)&&jnlStr(x.text).trim()===l);
    if(!hit)return {id:uid(),text:l,done:false};
    used.add(hit);
    return {id:(typeof hit.id==="string"&&hit.id)?hit.id:uid(),text:l,done:hit.done===true};
  });
}
/* The form's fields onto a tracker. Never closes it, whatever the new goal. */
function trkFromForm(t,f){
  t.name=jnlStr(f.name).trim();
  t.type=trkType({type:f.type});
  t.tag=tagLabel(f.tag);
  t.goal=trkInt(f.goal);
  t.items=mergeChecklist(trkItems(t),f.items);
  t.autoClose=f.autoClose!==false;
  t.value=trkInt(t.value);
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

/* ---- markup: pure strings, so the harness can assert every state ----
   Names and items are the player's plain words: esc() only, no glossary pass. A
   chip inside a checkbox button would be a button in a button, and every −/+
   would pay for a highlight() of the whole card. */
const TRK_PEN=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
function trkEditHTML(t){return `<button type="button" class="icon" data-trkedit="${esc(t.id)}" aria-label="${esc("Edit "+trkName(t))}" title="Edit">${TRK_PEN}</button>`;}
/* A tick is a <button role="checkbox">: a native checkbox inside a <label> fires
   the page's click handler twice, and the sheet's .equip spans can't be reached
   by keyboard. `attr` is its hook, already escaped, and comes after role and
   aria-checked so it is the button's FIRST data-* — the one focus is put back by. */
function trkTickHTML(attr,on,label){
  return `<button type="button" class="trk-tick" role="checkbox" aria-checked="${on?"true":"false"}" ${attr}><span class="box" aria-hidden="true"></span><span class="trk-it">${esc(label)}</span></button>`;
}
function trackerRowHTML(t){
  const ty=trkType(t),pr=trkProgress(t),name=trkName(t);
  if(ty==="task")return `<div class="trk" data-trk="${esc(t.id)}"><div class="trk-top">${trkTickHTML(`data-trktask="${esc(t.id)}"`,pr.complete,name)}${trkEditHTML(t)}</div></div>`;
  let prog="",body="";
  if(ty==="checklist"){
    const it=trkItems(t);
    prog=`<span class="trk-prog">${pr.done} / ${pr.total}</span>`;
    body=it.length?`<div class="trk-items">${it.map(i=>trkTickHTML(`data-trkitem="${esc(i.id)}"`,i.done===true,jnlStr(i.text))).join("")}</div>`:
      `<div class="empty">No items yet — tap the pencil to add some.</div>`;
  }else{
    const g=trkInt(t.goal);
    body=`<div class="trk-ctl"><button type="button" class="res-btn" data-trkdec="${esc(t.id)}" aria-label="${esc("One less — "+name)}">−</button>`+
      `<input class="trk-val" data-trkval="${esc(t.id)}" inputmode="numeric" value="${esc(pr.done)}" aria-label="${esc(name+" — count")}">`+
      `<button type="button" class="res-btn" data-trkinc="${esc(t.id)}" aria-label="${esc("One more — "+name)}">+</button>`+
      (g?`<span class="trk-of">of ${esc(g)}</span>`:"")+`</div>`+
      (g?`<div class="trk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${esc(g)}" aria-valuenow="${esc(Math.min(pr.done,g))}" aria-label="${esc(name)}"><span style="width:${esc(pr.pct)}%"></span></div>`:"");
  }
  return `<div class="trk" data-trk="${esc(t.id)}"><div class="trk-top"><span class="trk-name">${esc(name)}</span>${prog}${trkEditHTML(t)}</div>${body}</div>`;
}
/* In Completed: what it came to, when it closed, and the way back. */
function trkSummary(t){
  const ty=trkType(t),pr=trkProgress(t);
  if(ty==="task")return "Done";
  if(ty==="checklist")return pr.done+" / "+pr.total;
  return trkInt(t.goal)?pr.done+" / "+trkInt(t.goal):String(pr.done);
}
function trackerClosedHTML(t){
  const when=jnlTime(t.closedAt)?"Closed "+fmtWhen(jnlTime(t.closedAt)):"";
  return `<div class="trk trk-closed" data-trk="${esc(t.id)}"><div class="trk-top"><span class="trk-name">${esc(trkName(t))}</span>`+
    `<span class="trk-prog">${esc(trkSummary(t))}</span>${when?`<span class="n-when">${esc(when)}</span>`:""}`+
    `<button type="button" class="tbtn" data-trkreopen="${esc(t.id)}" aria-label="${esc("Reopen "+trkName(t))}">Reopen</button>${trkEditHTML(t)}</div></div>`;
}
function trackersHTML(c,completedOpen){
  const s=trkSplit(c);
  if(!s.open.length&&!s.closed.length)return `<div class="empty">No trackers yet. Tap + Tracker to count something — kills, pages read, the steps of a quest.</div>`;
  const caret=o=>`<svg class="fcaret ${o?"":"c"}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>`;
  let h=s.open.length?s.open.map(g=>{
    const o=trkGroupOpen(c,g.key);
    return `<div class="fgroup"><div class="fghead" data-trkgroup="${esc(g.key)}" role="button" tabindex="0" aria-expanded="${o?"true":"false"}">`+
      caret(o)+`<span class="fgname">${esc(g.label)}</span><span class="cnt">(${g.items.length})</span></div>`+
      `<div class="trk-group"${o?"":` style="display:none"`}>${g.items.map(trackerRowHTML).join("")}</div></div>`;
  }).join(""):`<div class="empty">Nothing open — everything here is done.</div>`;
  if(s.closed.length)h+=`<div class="fgroup trk-done"><div class="fghead" data-trkcompleted role="button" tabindex="0" aria-expanded="${completedOpen?"true":"false"}">`+
    caret(completedOpen)+`<span class="fgname">Completed</span><span class="cnt">(${s.closed.length})</span></div>`+
    `<div class="trk-group"${completedOpen?"":` style="display:none"`}>${s.closed.map(trackerClosedHTML).join("")}</div></div>`;
  return h;
}
/* Goal belongs to counters and Items to checklists; openTrackerForm() shows the
   one the chosen type needs. Close now / Reopen and Delete only for one that
   exists. */
function trackerFormHTML(t,tags,isNew){
  const ty=trkType(t),g=trkInt(t.goal),auto=t.autoClose!==false,lines=trkItems(t).map(i=>jnlStr(i.text)).join("\n");
  return `<div class="field"><label class="f" for="tkName">Name</label><input id="tkName" value="${esc(jnlStr(t.name))}" placeholder="e.g. Goblins slain" autocomplete="off"></div>`+
    `<div class="g2"><div class="field"><label class="f" for="tkType">Type</label><select id="tkType">`+
      TRK_TYPES.map(([v,l])=>`<option value="${esc(v)}"${ty===v?" selected":""}>${esc(l)}</option>`).join("")+`</select></div>`+
    `<div class="field"><label class="f" for="tkTag">Tag</label><input id="tkTag" value="${esc(tagLabel(t.tag))}" list="tkTags" placeholder="e.g. Kills" autocomplete="off">`+
      `<datalist id="tkTags">${tags.map(x=>`<option value="${esc(x)}">`).join("")}</datalist></div></div>`+
    `<div class="field" data-tkfor="counter"><label class="f" for="tkGoal">Goal</label><input id="tkGoal" type="number" min="0" inputmode="numeric" value="${esc(g||"")}" placeholder="None — count forever"></div>`+
    `<div class="field" data-tkfor="checklist"><label class="f" for="tkItems">Items, one per line</label><textarea id="tkItems" placeholder="Find the map&#10;Cross the Mire&#10;Meet Brindle">${esc(lines)}</textarea></div>`+
    `<div class="toggle" id="tkAutoRow"><div><div class="t-lbl">Close when complete</div><div class="t-sub">Move it to Completed once it's done. You get an Undo.</div></div>`+
      `<button type="button" class="switch ${auto?"on":""}" id="tkAuto" role="switch" aria-checked="${auto?"true":"false"}" aria-label="Close when complete"></button></div>`+
    `<div class="m-actions">`+(isNew?"":`<button type="button" class="tbtn danger" id="tkDel" style="margin-right:auto">Delete</button>`+
      `<button type="button" class="tbtn" id="tkCloseNow">${t.closed===true?"Reopen":"Close now"}</button>`)+
    `<button type="button" class="tbtn" id="tkCancel">Cancel</button><button type="button" class="tbtn primary" id="tkSave">${isNew?"Add":"Save"}</button></div>`;
}
