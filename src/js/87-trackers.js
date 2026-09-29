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
