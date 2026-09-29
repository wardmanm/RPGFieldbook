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
   and an id from a file a newline; either makes querySelector throw. A quote or
   backslash takes a backslash; a newline, return or form feed, which a CSS
   string can't hold even escaped that way, becomes its hex code and a space. */
function attrSel(name,v){return `[${name}="${String(v).replace(/["\\]/g,"\\$&").replace(/[\n\r\f]/g,c=>"\\"+c.charCodeAt(0).toString(16)+" ")}"]`;}

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

/* ---- markup: pure strings, so the harness can assert every state ---- */
function jnlEntryHTML(p,q){
  const snip=q?jnlSnippet(p.text,q):"";
  return `<button type="button" class="jnl-entry" data-jnlopen="${esc(p.id)}">`+
    `<span class="jnl-title">${esc(jnlTitle(p))}</span>`+
    (jnlTime(p.at)?`<span class="jnl-when">${esc(fmtWhen(jnlTime(p.at)))}</span>`:"")+
    (snip?`<span class="jnl-snip">${snip}</span>`:"")+`</button>`;
}
/* The list: groups by tag, newest first inside each. While searching, every
   group is open and its header is plain text — a toggle the search is holding
   open would look like a dead button. */
function journalListHTML(c,q){
  const all=jnlPages(c);
  if(!all.length)return `<div class="empty">No pages yet — tap + Page to start one: a session, someone you met, a quest.</div>`;
  const hits=all.filter(p=>jnlMatch(p,q));
  if(!hits.length)return `<div class="empty">No pages match “${esc(q)}”.</div>`;
  return groupByTag(jnlSort(hits),p=>p.tag).map(g=>{
    const open=jnlGroupOpen(c,g.key,!!q),name=`<span class="fgname">${esc(g.label)}</span><span class="cnt">(${g.items.length})</span>`;
    const head=q?`<div class="fghead jnl-static">${name}</div>`:
      `<div class="fghead" data-jnlgroup="${esc(g.key)}" role="button" tabindex="0" aria-expanded="${open?"true":"false"}">`+
      `<svg class="fcaret ${open?"":"c"}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>${name}</div>`;
    return `<div class="fgroup">${head}<div class="jnl-group"${open?"":` style="display:none"`}>`+
      g.items.map(p=>jnlEntryHTML(p,q)).join("")+`</div></div>`;
  }).join("");
}
function jnlWhen(p){return jnlTime(p.at)?noteWhen({at:jnlTime(p.at),editedAt:jnlTime(p.editedAt)}):"";}
function journalPageHTML(p){
  const when=jnlWhen(p),tag=tagLabel(p.tag),body=noteHTML(jnlStr(p.text));
  return `<div class="jnl-bar"><button type="button" class="tbtn" data-jnlback>← All pages</button><span class="grow"></span>`+
    `<button type="button" class="tbtn" data-jnledit="${esc(p.id)}">Edit</button>`+
    `<button type="button" class="tbtn danger" data-jnldel="${esc(p.id)}">Delete</button></div>`+
    `<h3 class="jnl-h" id="jnlHead" tabindex="-1">${esc(jnlTitle(p))}</h3>`+
    ((tag||when)?`<div class="jnl-meta">${tag?`<span class="jnl-tag">${esc(tag)}</span>`:""}${when?`<span class="n-when">${esc(when)}</span>`:""}</div>`:"")+
    (body?`<div class="n-body">${body}</div>`:`<div class="empty">Nothing written yet — tap Edit.</div>`);
}
/* Built ONCE per edit (renderJournal() leaves it alone after), so it can keep
   the player's caret. Everything typed is written straight to the page. */
function journalEditorHTML(p,tags){
  const when=jnlWhen(p);
  return `<div class="jnl-bar"><span class="jnl-edlbl">Editing</span><span class="grow"></span>`+
    `<button type="button" class="tbtn primary" data-jnldone="${esc(p.id)}">Done</button></div>`+
    `<div class="g2"><div class="field"><label class="f" for="jnlTitle">Title</label>`+
    `<input id="jnlTitle" data-jnlfield="title" value="${esc(jnlStr(p.title))}" placeholder="e.g. Session 3 — into the Mire" autocomplete="off"></div>`+
    `<div class="field"><label class="f" for="jnlTag">Tag</label>`+
    `<input id="jnlTag" data-jnlfield="tag" value="${esc(tagLabel(p.tag))}" list="jnlTags" placeholder="e.g. Sessions" autocomplete="off">`+
    `<datalist id="jnlTags">${tags.map(t=>`<option value="${esc(t)}">`).join("")}</datalist></div></div>`+
    `<div class="field"><label class="f" for="jnlText">Page</label>`+
    `<textarea id="jnlText" data-jnlfield="text" class="n-edit" placeholder="What happened, who you met, what to remember…">${esc(jnlStr(p.text))}</textarea></div>`+
    `<div class="jnl-tools"><button type="button" class="tbtn" data-jnlstamp>Insert timestamp</button></div>`+
    NOTE_FMT_HINT+(when?`<p class="hint">${esc(when)}</p>`:"");
}

/* ================= the DOM layer ================= */
/* Session only, never saved: which page is open, whether it is being edited,
   and the draft being edited ({id, at}; see jnlSavePage()). Keyed on the
   character OBJECT, so a switch starts again at the list — Import → Replace
   included, which keeps the id but swaps the sheet: keyed on the id, an editor
   open at the time survived it, and its next keystroke wrote the old text over
   the imported page. */
let jnlUI={who:null,open:null,editing:false,draft:null};
function jnlReset(){jnlUI={who:character,open:null,editing:false,draft:null};}
function jnlSearchText(){const s=document.getElementById("jnlSearch");return jnlQuery(s?s.value:"");}
function renderJournal(){
  const box=document.getElementById("jnlBody");if(!box)return;
  if(jnlUI.who!==character){jnlReset();const s=document.getElementById("jnlSearch");if(s)s.value="";}
  const pages=jnlPages(character);
  /* a page deleted, or gone with a reload of the rules or an import */
  if(!jnlUI.editing&&jnlUI.open&&!pages.some(p=>p.id===jnlUI.open))jnlUI.open=null;
  const bar=document.getElementById("jnlListBar");if(bar)bar.hidden=!!jnlUI.open;
  if(jnlUI.editing){
    /* Built once, when Edit is pressed, and never again while it is open:
       renderAll() and refreshRulesUI() can run while the player types (a rules
       fetch landing, a change in Settings), and a rebuild would take the text
       they are typing, the caret and the focus with it. */
    if(box.querySelector("[data-jnlfield]"))return;
    const p=pages.find(x=>x.id===jnlUI.open)||{id:jnlUI.open,title:"",tag:"",text:""};
    box.innerHTML=journalEditorHTML(p,jnlTagList(character));
    return;
  }
  const p=jnlUI.open&&pages.find(x=>x.id===jnlUI.open);
  box.innerHTML=p?journalPageHTML(p):journalListHTML(character,jnlSearchText());
}
function jnlFocus(id,atEnd){
  const e=document.getElementById(id);if(!e||!e.focus)return;
  e.focus({preventScroll:true});
  if(atEnd&&typeof e.setSelectionRange==="function"){const n=String(e.value||"").length;e.setSelectionRange(n,n);}
}
/* A page opens where the card starts, whatever point of a long list it was
   picked from. */
function jnlShowCard(){
  const c=document.getElementById("journalCard"),r=c&&c.getBoundingClientRect&&c.getBoundingClientRect();
  if(r&&r.top<0)scrollToCard(c);
}
function jnlOpen(id){jnlUI.open=id;jnlUI.editing=false;jnlUI.draft=null;renderJournal();jnlShowCard();jnlFocus("jnlHead");}
/* Back to the list, focus on the page's own entry (which scrolls it into view). */
function jnlBack(){
  const id=jnlUI.open;jnlUI.open=null;jnlUI.editing=false;jnlUI.draft=null;renderJournal();
  const b=id&&document.querySelector(attrSel("data-jnlopen",id));
  if(b&&b.focus)b.focus();else jnlShowCard();
}
/* Editing starts from an empty box, so renderJournal() builds a fresh editor
   instead of keeping the one it finds. The caret goes to the END of the text:
   that is where a timestamp lands before the player clicks into the page. */
function jnlStartEdit(id,at,focusId){
  jnlUI.open=id;jnlUI.editing=true;jnlUI.draft={id,at};
  const box=document.getElementById("jnlBody");if(box)box.innerHTML="";
  renderJournal();jnlShowCard();
  jnlFocus(focusId,true);
}
function jnlNewPage(){jnlStartEdit(uid(),null,"jnlTitle");}
function jnlEdit(id){const p=jnlPages(character).find(x=>x.id===id);if(p)jnlStartEdit(id,jnlTime(p.at)||null,"jnlText");}
/* Done shows the page — or the list, when it was left blank and so never saved. */
function jnlDone(){
  const id=jnlUI.open;jnlUI.editing=false;jnlUI.draft=null;
  const saved=jnlPages(character).some(p=>p.id===id);
  jnlUI.open=saved?id:null;
  renderJournal();
  if(saved)jnlFocus("jnlHead");else jnlFocus("jnlNew");
}
/* Every keystroke in the editor; the page rule does the rest (jnlSavePage()). */
function jnlInput(){
  if(!jnlUI.editing||!jnlUI.draft)return;
  const v=id=>{const e=document.getElementById(id);return e?e.value:"";};
  jnlSavePage(character,jnlUI.draft,{title:v("jnlTitle"),tag:v("jnlTag"),text:v("jnlText")},Date.now());
  scheduleSave();
}
function jnlDelete(id){
  const p=jnlPages(character).find(x=>x.id===id);if(!p)return false;
  if(!confirm(`Delete the page “${jnlTitle(p)}”? This can't be undone.`))return false;
  jnlDeletePage(character,id);jnlUI.open=null;jnlUI.editing=false;jnlUI.draft=null;
  renderJournal();scheduleSave();jnlFocus("jnlNew");
  return true;
}
/* At the caret. The input event is what saves it, as typing does. */
function insertJournalStamp(){
  const ta=document.getElementById("jnlText");if(!ta)return;
  const r=insertLine(ta.value,ta.selectionStart,ta.selectionEnd,jnlStampText(new Date()));
  ta.value=r.text;ta.focus();ta.setSelectionRange(r.caret,r.caret);
  ta.dispatchEvent(new Event("input",{bubbles:true}));
}
function toggleJnlGroup(key){
  if(!character.journalCollapse||typeof character.journalCollapse!=="object"||Array.isArray(character.journalCollapse))character.journalCollapse={};
  character.journalCollapse[key]=!character.journalCollapse[key];
  renderJournal();scheduleSave();
  const h=document.querySelector(attrSel("data-jnlgroup",key));if(h&&h.focus)h.focus();
}
