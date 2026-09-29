/* ================= the journal =================
   The Journal tab's own pages: a running record of the campaign — sessions,
   the people met, quests — each with an optional tag that groups it, the dates
   it was written and edited, and the same markdown grammar as the section notes
   (noteHTML()). Design: src/docs/specs/2026-09-29-journal-design.md

   The pure half comes first — no DOM — so src/tests/sheet.js can assert it. */

/* A file can put anything in a field, so every read goes through one of these. */
function jnlStr(v){return typeof v==="string"?v:(typeof v==="number"&&isFinite(v)?String(v):"");}
function jnlTime(v){return typeof v==="number"&&isFinite(v)?v:0;}

/* ---- tags, shared with the trackers (87-trackers.js) ----
   A tag is the player's own word, so it is only tidied: trimmed, runs of spaces
   collapsed. It groups by its lower-cased form, so "Quests" and "quests" are one
   group. Untagged is the key "", which no real tag can produce. */
function tagLabel(v){return jnlStr(v).replace(/\s+/g," ").trim();}
function tagKey(v){return tagLabel(v).toLowerCase();}
/* [{key, label, items}], A to Z, Untagged last. A group is labelled by the first
   spelling met, and keeps the order it was given. */
function groupByTag(list,tagOf){
  const by=new Map();
  list.forEach(x=>{
    const l=tagLabel(tagOf(x)),k=l.toLowerCase();
    if(!by.has(k))by.set(k,{key:k,label:l||"Untagged",items:[]});
    by.get(k).items.push(x);
  });
  return [...by.values()].sort((a,b)=>(a.key==="")-(b.key==="")||a.key.localeCompare(b.key));
}
/* A CSS attribute selector for a value from the player. A tag can hold a quote,
   which would make querySelector throw. */
function attrSel(name,v){return `[${name}="${String(v).replace(/["\\]/g,"\\$&")}"]`;}

/* ---- the pages ----
   migrate() keeps only objects in `journal` and repairs their ids (repairIds());
   the fields inside are read through jnlStr()/jnlTime(), whatever a file put
   there. These are the REAL page objects, not copies: the editor writes to them. */
function jnlPages(c){const l=c&&c.journal;return Array.isArray(l)?l.filter(p=>p&&typeof p==="object"&&!Array.isArray(p)):[];}
function jnlTitle(p){return jnlStr(p&&p.title).trim()||"Untitled";}
/* Newest CREATED first, not edited: tidying an old page must not move it to the
   top of its group. sort() is stable, so equal times keep their saved order. */
function jnlSort(pages){return pages.slice().sort((a,b)=>jnlTime(b.at)-jnlTime(a.at));}

/* ---- search ----
   Case-blind, found with an "i" RegExp rather than by lower-casing: lower-casing
   can change a string's LENGTH ("İ" becomes two code units), which would put the
   highlight in the wrong place. Runs of whitespace count as one space, in the
   query (jnlQuery()) and in the text (jnlFlat()) alike. */
function jnlQuery(v){return jnlStr(v).replace(/\s+/g," ").trim();}
function jnlFind(s,q){if(!q)return -1;const m=new RegExp(escReg(q),"i").exec(s);return m?m.index:-1;}
function jnlFlat(v){return jnlStr(v).replace(NOTE_SENTINELS,"").replace(/\s+/g," ");}
function jnlMatch(p,q){return !q||[p.title,p.tag,p.text].some(v=>jnlFind(jnlFlat(v),q)>=0);}
/* An escaped excerpt of the text around the first match, the match in <mark>;
   "" when only the title or the tag matched. */
function jnlSnippet(text,q,r){
  const s=jnlFlat(text).trim(),i=jnlFind(s,q);
  if(i<0)return "";
  const R=r||60,a=Math.max(0,i-R),b=Math.min(s.length,i+q.length+R);
  return (a>0?"…":"")+esc(s.slice(a,i))+"<mark>"+esc(s.slice(i,i+q.length))+"</mark>"+esc(s.slice(i+q.length,b))+(b<s.length?"…":"");
}

/* ---- the rule a page lives by ----
   A page exists only while its title or its text has something in it — the
   section notes' rule (saveNote()). New page makes an in-memory draft {id, at}
   and saves nothing; the first real keystroke adds the page, and clearing both
   fields removes it again. So a blank page is never saved, however the player
   leaves it: Back, another tab, another character, a reload.
   `at` is set once, when the page is first added, and the draft keeps it, so a
   page cleared and typed again keeps its date. `editedAt` moves only when the
   title, tag or text actually changed. A tag on its own is not content. */
function jnlSavePage(c,draft,fields,now){
  if(!Array.isArray(c.journal))c.journal=[];
  const f=fields||{},title=jnlStr(f.title).trim(),tag=tagLabel(f.tag),text=jnlStr(f.text);
  const i=c.journal.findIndex(p=>p&&p.id===draft.id);
  if(!title&&!text.trim()){if(i>=0)c.journal.splice(i,1);return null;}
  if(i<0){
    if(!draft.at)draft.at=now;
    const p={id:draft.id,title,tag,text,at:draft.at,editedAt:now};
    c.journal.push(p);return p;
  }
  const p=c.journal[i];
  if(jnlStr(p.title)!==title||jnlStr(p.tag)!==tag||jnlStr(p.text)!==text){p.title=title;p.tag=tag;p.text=text;p.editedAt=now;}
  if(!jnlTime(p.at))p.at=draft.at||now;
  return p;
}
function jnlDeletePage(c,id){
  const l=Array.isArray(c.journal)?c.journal:[],n=l.length;
  c.journal=l.filter(p=>!(p&&p.id===id));
  return c.journal.length<n;
}
/* Every tag in use, on pages and trackers together, so a "Quests" typed on one
   is offered on the other. One spelling per group, A to Z. */
function jnlTagList(c){
  const tr=Array.isArray(c&&c.trackers)?c.trackers.filter(t=>t&&typeof t==="object"&&!Array.isArray(t)):[];
  return groupByTag(jnlPages(c).concat(tr),x=>x.tag).filter(g=>g.key).map(g=>g.label);
}
/* Stored as COLLAPSE, so an absent key means open. A search opens every group:
   a shut one would hide its matches. */
function jnlGroupOpen(c,key,searching){
  if(searching)return true;
  const m=c&&c.journalCollapse;
  return !(m&&typeof m==="object"&&!Array.isArray(m)&&m[key]);
}
/* The date and time in the player's own format, bold. toLocaleString never
   writes an asterisk, so the bold cannot break. */
function jnlStampText(d){
  return "**"+d.toLocaleString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"})+"**";
}
/* `line` on a line of its own at the selection (replacing it), with the caret at
   the start of the line after. Starting an edit puts the caret at the end of the
   text, so a stamp before the player has clicked into the page lands at the end
   rather than at 0, where a textarea's caret otherwise starts. */
function insertLine(text,start,end,line){
  const t=jnlStr(text),n=t.length;
  const s=Math.max(0,Math.min(n,num(start))),e=Math.max(s,Math.min(n,num(end)));
  const before=t.slice(0,s),after=t.slice(e);
  const ins=(before&&!before.endsWith("\n")?"\n":"")+line+"\n";
  return {text:before+ins+after,caret:before.length+ins.length};
}
