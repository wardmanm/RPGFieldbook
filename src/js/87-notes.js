/* ================= section notes =================
   A note pinned to any section of the sheet, plus the Notes tab that gathers
   them. Notes are the player's own words, so they render markdown — and, like
   every other body of text in the app, they run through highlight() so glossary
   terms and [Table: X] references stay live inside them.

   NOT to be confused with `character.notes`, which is the Story tab's bio field
   and predates this. This feature stores `character.secNotes`. */

/* The registry is the single source of truth: it drives the icon injection, the
   Notes tab's grouping and headings, and a test that checks it against the
   template both ways. `k` is a stable id — never derive one from a heading,
   because headings get reworded and the notes would be orphaned. */
const NOTE_SECTIONS=[
  {k:"portrait",     tab:"sheet",     title:"Portrait"},
  {k:"origin",       tab:"sheet",     title:"Ancestry & Background"},
  {k:"class",        tab:"sheet",     title:"Class"},
  {k:"abilities",    tab:"sheet",     title:"Ability Scores & Saves"},
  {k:"skills",       tab:"sheet",     title:"Skills"},
  {k:"vitals",       tab:"sheet",     title:"Vitals"},
  {k:"rest",         tab:"sheet",     title:"Rest & Recovery"},
  {k:"statuses",     tab:"sheet",     title:"Statuses & Conditions"},
  {k:"attacks",      tab:"sheet",     title:"Attacks & Weapons"},
  {k:"resources",    tab:"sheet",     title:"Resources"},
  {k:"features",     tab:"sheet",     title:"Features & Traits"},
  {k:"familiars",    tab:"sheet",     title:"Familiars & Companions"},
  {k:"spellcasting", tab:"spells",    title:"Spellcasting"},
  {k:"slots",        tab:"spells",    title:"Spell Slots"},
  {k:"activespells", tab:"spells",    title:"Active Spells"},
  {k:"spells",       tab:"spells",    title:"Spells & Cantrips"},
  {k:"inventory",    tab:"inventory", title:"Equipment & Inventory"},
  {k:"coins",        tab:"inventory", title:"Coins"},
  {k:"proficiencies",tab:"story",     title:"Proficiencies & Languages"}
];
const NOTE_TABS={sheet:"Sheet",spells:"Spells",inventory:"Inventory",story:"Story"};
function noteDef(k){return NOTE_SECTIONS.find(s=>s.k===k)||null;}
/* The ancestry heading is skin-dependent — "Race" on the classic skin — so the
   Notes tab has to ask rather than quote the registry, or it would disagree with
   the card it links to. */
function noteTitle(def){return (def&&def.k==="origin")?(raceTerm()+" & Background"):(def?def.title:"");}

/* ---- storage, guarded ----
   migrate() shape-guards secNotes at the TOP level only; nothing coerces the
   values inside it. A hand-edited or half-broken file can therefore put a string
   where a note object belongs, so every read goes through here. */
function noteMap(){const m=character&&character.secNotes;return (m&&typeof m==="object"&&!Array.isArray(m))?m:{};}
function getNote(k){const n=noteMap()[k];return (n&&typeof n==="object"&&!Array.isArray(n))?n:null;}
function noteText(k){const n=getNote(k);return n?String(n.text||""):"";}
function hasNote(k){return !!noteText(k).trim();}
function noteCount(tab){return NOTE_SECTIONS.filter(s=>s.tab===tab&&hasNote(s.k)).length;}
/* Blank means no note: saving an empty box DELETES the entry, so "has a note" is
   one truth test and the Notes tab can never list an empty one.
   `at` is set once and survives every edit; `editedAt` only moves when the text
   actually changed, so re-saving without typing doesn't fake activity. */
function saveNote(k,text){
  if(!character.secNotes||typeof character.secNotes!=="object"||Array.isArray(character.secNotes))character.secNotes={};
  const t=String(text==null?"":text);
  const prev=getNote(k);
  if(!t.trim()){delete character.secNotes[k];return null;}
  const now=Date.now();
  const at=(prev&&typeof prev.at==="number"&&prev.at)||now;
  const editedAt=(prev&&prev.text===t&&typeof prev.editedAt==="number")?prev.editedAt:now;
  character.secNotes[k]={text:t,at,editedAt};
  return character.secNotes[k];
}
function noteWhen(n){
  if(!n||typeof n.at!=="number")return "";
  const a=fmtWhen(n.at);
  return "Added "+a+((typeof n.editedAt==="number"&&n.editedAt>n.at)?(" · edited "+fmtWhen(n.editedAt)):"");
}

/* ================= markdown =================
   Why this ordering is safe, since it is the whole security argument:
   highlight() runs esc() over the text, which escapes < and >. So the ONLY
   angle brackets in its output are the <span class="kw"> / <span class="tblref">
   tags it inserted itself — which makes /<[^>]+>/g an EXACT tag matcher here,
   not a heuristic, and lets us hold those tags aside while the markdown regexes
   run. Anything the player typed is already inert text by that point.

   Running markdown BEFORE the glossary pass would be unsafe the other way: a
   glossary term like "strong" would match inside the <strong> we just wrote. */
const NOTE_H0=String.fromCharCode(0xE001), NOTE_H1=String.fromCharCode(0xE002);  /* indexed hold delimiters */
const NOTE_LB=String.fromCharCode(0xE003);  /* one soft line break inside a block */
const NOTE_SENTINELS=new RegExp("["+String.fromCharCode(0xE000)+"-"+String.fromCharCode(0xE00F)+"]","g");
/* Indexed, not a single repeating mark like TBL_MARK: this pass NESTS — a code
   span can swallow an already-held glossary chip — so ordinal restore-in-order
   doesn't hold. */
function noteInline(raw){
  const hold=[];
  const P=t=>{hold.push(t);return NOTE_H0+(hold.length-1).toString(36)+NOTE_H1;};
  let s=highlight(raw);                                        /* esc + glossary + table chips */
  s=s.replace(/<[^>]+>/g,P);                                   /* exact: esc() ate every user < */
  s=s.replace(/`([^`]+)`/g,(m,c)=>P("<code>"+c+"</code>"));    /* first, so no emphasis inside code */
  s=s.replace(/\*\*([^*]+)\*\*/g,(m,c)=>"<strong>"+c+"</strong>");
  /* the (^|[^*]) guard is what makes an unmatched delimiter inert rather than
     eating the rest of the line */
  s=s.replace(/(^|[^*])\*([^*]+)\*/g,(m,a,c)=>a+"<em>"+c+"</em>");
  s=s.split(NOTE_LB).join("<br>");
  for(let i=0;i<8&&s.indexOf(NOTE_H0)>=0;i++)
    s=s.replace(new RegExp(NOTE_H0+"([0-9a-z]+)"+NOTE_H1,"g"),(m,key)=>hold[parseInt(key,36)]||"");
  return s;
}
/* Block grammar, deliberately small. No links (they point at a network, in an
   offline-first app, and read confusingly beside [Table: X]), no _underscore_
   emphasis (snake_case), no nested lists, no pipe tables. */
function noteHTML(text){
  /* strip our own sentinels AND highlight()'s out of the input first: a player
     typing one must not be able to forge a placeholder */
  const src=String(text==null?"":text).replace(/\r\n?/g,"\n").replace(NOTE_SENTINELS,"");
  if(!src.trim())return "";
  const lines=src.split("\n"), out=[];
  let i=0;
  /* three or more of the same mark, spaces allowed between them: --- , *** ,
     ___ , and the spaced forms. Checked BEFORE bullets so "* * *" is a rule. */
  const isHr=l=>/^ {0,3}([-*_])(?: *\1){2,} *$/.test(l);
  const isH=l=>/^ {0,3}(#{1,6}) +(.*)$/.exec(l);
  const isUl=l=>/^ {0,3}[-*+] +/.test(l);
  const isOl=l=>/^ {0,3}(\d{1,9})[.)] +/.exec(l);
  const isQ=l=>/^ {0,3}> ?/.test(l);
  const starts=l=>isHr(l)||isH(l)||isUl(l)||isOl(l)||isQ(l);
  while(i<lines.length){
    const l=lines[i];
    if(!l.trim()){i++;continue;}
    if(isHr(l)){out.push(`<hr class="n-hr">`);i++;continue;}   /* before bullets: "* * *" is a rule */
    const h=isH(l);
    if(h){const lv=h[1].length;out.push(`<div class="n-h n-h${lv}">${noteInline(h[2])}</div>`);i++;continue;}
    if(isUl(l)){
      const items=[];
      while(i<lines.length&&isUl(lines[i])&&!isHr(lines[i])){items.push(lines[i].replace(/^ {0,3}[-*+] +/,""));i++;}
      out.push(`<ul class="n-ul">`+items.map(t=>`<li>${noteInline(t)}</li>`).join("")+`</ul>`);continue;
    }
    const o=isOl(l);
    if(o){
      const start=parseInt(o[1],10)||1, items=[];
      while(i<lines.length&&isOl(lines[i])){items.push(lines[i].replace(/^ {0,3}\d{1,9}[.)] +/,""));i++;}
      out.push(`<ol class="n-ol"${start!==1?` start="${start}"`:""}>`+items.map(t=>`<li>${noteInline(t)}</li>`).join("")+`</ol>`);continue;
    }
    if(isQ(l)){
      const ls=[];
      while(i<lines.length&&isQ(lines[i])){ls.push(lines[i].replace(/^ {0,3}> ?/,""));i++;}
      out.push(`<blockquote class="n-q">${noteInline(ls.join(NOTE_LB))}</blockquote>`);continue;
    }
    const ls=[];
    while(i<lines.length&&lines[i].trim()&&!starts(lines[i])){ls.push(lines[i]);i++;}
    /* ONE highlight() call per block, not per line: highlight() rebuilds the
       glossary list, sorts it and compiles a fresh RegExp every time, and the
       Notes tab can render nineteen of these at once. */
    out.push(`<p>${noteInline(ls.join(NOTE_LB))}</p>`);
  }
  return out.join("");
}
/* The hover preview is PLAIN TEXT, not noteHTML(): a hover card full of tappable
   chips is a trap — you reach for the chip and the card disappears — and
   interactive elements can't legally nest inside the button it lives in. */
function notePreview(text,max){
  const s=String(text==null?"":text)
    .replace(NOTE_SENTINELS,"")
    .replace(/^ {0,3}(#{1,6} +|[-*+] +|\d{1,9}[.)] +|> ?)/gm,"")
    .replace(/[*`]/g,"")
    .replace(/\s+/g," ").trim();
  const n=max||180;
  return esc(s.length>n?s.slice(0,n).trim()+"…":s);
}

/* ================= the icon on each section heading ================= */
function noteBtnHTML(def){
  const has=hasNote(def.k), t=noteTitle(def);
  return `<button class="notebtn${has?" on":""}" data-notebtn="${def.k}" aria-label="${has?"Edit note":"Add a note"} — ${esc(t)}" title="${has?"Edit note":"Add a note"}">`+
    `<svg class="noteicon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>`+
    (has?`<span class="n-pop">${notePreview(noteText(def.k))}</span>`:"")+
    `</button>`;
}
/* Idempotent, and it replaces only its own button — never label.innerHTML +=,
   which would re-parse the label and destroy #starBtn, #encPill and #roundNum. */
function renderNoteIcons(){
  NOTE_SECTIONS.forEach(def=>{
    const card=document.querySelector(`[data-note="${def.k}"]`);if(!card)return;
    const label=card.querySelector(".label");if(!label)return;
    const old=label.querySelector("[data-notebtn]");
    if(old)old.outerHTML=noteBtnHTML(def);
    else label.insertAdjacentHTML("beforeend",noteBtnHTML(def));
  });
}

/* ================= the Notes tab ================= */
function noteGroupOpen(tab){
  const c=(character&&character.noteCollapse&&typeof character.noteCollapse==="object"&&!Array.isArray(character.noteCollapse))?character.noteCollapse:{};
  return !c[tab];
}
function toggleNoteGroup(tab){
  if(!character.noteCollapse||typeof character.noteCollapse!=="object"||Array.isArray(character.noteCollapse))character.noteCollapse={};
  character.noteCollapse[tab]=!character.noteCollapse[tab];
  renderNotes();scheduleSave();
}
function noteEntryHTML(def){
  const n=getNote(def.k), when=noteWhen(n);
  return `<div class="item"><div class="top">`+
    `<button class="linkbtn n-jump" data-notejump="${def.k}">${esc(noteTitle(def))}</button>`+
    `<span style="flex:1"></span>`+
    (when?`<span class="n-when">${esc(when)}</span>`:"")+
    `<button class="icon" data-noteedit="${def.k}" aria-label="Edit note"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>`+
    `</div><div class="n-body">${noteHTML(noteText(def.k))}</div></div>`;
}
/* Pure, so the group order, counts, collapse state and empty state are all
   assertable in the test harness — which can't see the DOM at all. */
function notesHTML(){
  const tabs=[];
  NOTE_SECTIONS.forEach(s=>{if(tabs.indexOf(s.tab)<0)tabs.push(s.tab);});
  let html="", any=false;
  tabs.forEach(tab=>{
    const defs=NOTE_SECTIONS.filter(s=>s.tab===tab&&hasNote(s.k));
    if(!defs.length)return;
    any=true;
    const open=noteGroupOpen(tab);
    html+=`<div class="fgroup"><div class="fghead" data-notegroup="${tab}" role="button" tabindex="0" aria-expanded="${open?"true":"false"}">`+
      `<svg class="fcaret ${open?"":"c"}" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>`+
      `<span class="fgname">${esc(NOTE_TABS[tab]||tab)}</span><span class="fgcount">${defs.length}</span></div>`+
      `<div class="notesec-body" data-notegroupbody="${tab}"${open?"":` style="display:none"`}>`+
      defs.map(noteEntryHTML).join("")+`</div></div>`;
  });
  return any?html:`<div class="empty">No notes yet. Tap the note icon beside any section heading to jot something down — it will show up here.</div>`;
}
function renderNotes(){const el=document.getElementById("notesList");if(el)el.innerHTML=notesHTML();}

/* ---- jump to the section a note belongs to ---- */
function jumpToNote(k){
  const def=noteDef(k);if(!def)return;
  selectTab(def.tab);
  const card=document.querySelector(`[data-note="${def.k}"]`);
  /* Familiars and Active Spells are display:none until they have content, and
     scrolling to a hidden element lands nowhere. */
  if(!card||card.offsetParent===null){window.scrollTo({top:0});return;}
  scrollToCard(card);
  card.classList.add("n-flash");setTimeout(()=>card.classList.remove("n-flash"),1200);
}

/* ---- editor ---- */
function openNoteEditor(k){
  const def=noteDef(k);if(!def)return;
  const n=getNote(k), when=noteWhen(n);
  openModal("Note — "+noteTitle(def),`
    <div class="field"><label class="f">Your note</label>
      <textarea id="noteText" class="n-edit" placeholder="Anything you want to remember about this section…">${esc(noteText(k))}</textarea></div>
    <p class="hint">Formatting: <b>**bold**</b>, <b>*italic*</b>, <b>\`code\`</b>, <b>#</b> heading, <b>-</b> bullet, <b>1.</b> numbered, <b>&gt;</b> quote, <b>---</b> divider. Rules terms you know stay tappable.</p>
    ${when?`<p class="hint">${esc(when)}</p>`:""}
    <div class="m-actions">${n?`<button class="tbtn danger" id="noteDel" style="margin-right:auto">Delete</button>`:""}<button class="tbtn" id="noteCancel">Cancel</button><button class="tbtn primary" id="noteSave">Save</button></div>`);
  const ta=document.getElementById("noteText");if(ta)ta.focus();
  document.getElementById("noteCancel").addEventListener("click",closeModal);
  {const d=document.getElementById("noteDel");if(d)d.addEventListener("click",()=>{saveNote(k,"");closeModal();renderNoteIcons();renderNotes();scheduleSave();});}
  document.getElementById("noteSave").addEventListener("click",()=>{
    saveNote(k,document.getElementById("noteText").value);
    closeModal();renderNoteIcons();renderNotes();scheduleSave();
  });
}
