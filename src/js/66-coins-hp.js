/* portrait */
function renderPortrait(){
  const el=document.getElementById("portrait");
  el.innerHTML=character.portraitImg?`<img src="${character.portraitImg}" alt="Portrait">`:`<div class="ph">No portrait yet</div>`;
}

let _adjWired=false,_adjSync=null;
/* One transaction across several denominations — "that costs 2gp 5sp" is a
   single action here rather than two edits, and it can't leave you halfway
   through if part of it would overdraw. */
function openCoinAdjust(){
  const keys=coinKeys();
  const rows=keys.map(k=>{
    const d=COIN_ALL.find(x=>x[0]===k);
    return `<div class="coin"><label title="${d[2]}">${d[1]}</label>
      <input type="text" inputmode="tel" data-adj="${k}" placeholder="0"
             aria-label="Adjust ${d[2]} — e.g. 10 to gain, -5 to spend"></div>`;
  }).join("");
  openModal("Adjust coins",`
    <p class="hint">How many of each you gained. Use a minus to spend: <b>-5</b>.</p>
    <div class="coins">${rows}</div>
    <p class="hint" id="adjPrev" style="margin-top:10px"></p>
    <div class="m-actions"><button class="tbtn" id="adjCancel" type="button">Cancel</button>
      <button class="tbtn primary" id="adjGo" type="button">Apply</button></div>`);
  const boxes=()=>[...document.querySelectorAll("#mBody [data-adj]")];
  const prev=document.getElementById("adjPrev"), go=document.getElementById("adjGo");
  /* Work out the whole transaction before applying any of it. */
  const plan=()=>{
    const out={},bad=[];let any=false;
    boxes().forEach(b=>{
      const k=b.dataset.adj, raw=String(b.value).replace(/[\s,]/g,"").replace(/[−–—]/g,"-");
      if(!raw)return;
      if(!/^[+-]?\d+$/.test(raw)){bad.push(COIN_ALL.find(x=>x[0]===k)[1]);return;}
      const delta=parseInt(raw,10);
      if(!delta)return;
      any=true;
      const now=num((character.coins||{})[k]);
      out[k]={delta,now,next:now+delta};
    });
    return {out,bad,any};
  };
  const sync=()=>{
    const {out,bad,any}=plan();
    const over=Object.keys(out).filter(k=>out[k].next<0);
    if(bad.length){prev.textContent="Not a number: "+bad.join(", ");go.disabled=true;return;}
    if(over.length){
      prev.textContent="You don't have enough "+
        over.map(k=>`${COIN_ALL.find(x=>x[0]===k)[1]} (have ${out[k].now}, spending ${-out[k].delta})`).join(", ")+
        ". Auto-convert first, or use a bigger coin.";
      go.disabled=true;return;
    }
    go.disabled=!any;
    prev.textContent=any
      ? "After: "+Object.keys(out).map(k=>`${out[k].next} ${COIN_ALL.find(x=>x[0]===k)[1]}`).join(", ")
      : "Enter an amount to see the result.";
  };
  /* #mBody is the shared modal body and outlives this modal — one delegated
     listener installed once, not a new one every time Adjust is opened. Same
     guard as the update review list. */
  _adjSync=sync;
  if(!_adjWired){
    document.getElementById("mBody").addEventListener("input",e=>{
      if(e.target&&e.target.matches&&e.target.matches("[data-adj]")&&_adjSync)_adjSync();
    });
    _adjWired=true;
  }
  sync();
  document.getElementById("adjCancel").addEventListener("click",closeModal);
  go.addEventListener("click",()=>{
    const {out}=plan();
    character.coins=character.coins||{};
    Object.keys(out).forEach(k=>{character.coins[k]=out[k].next;});
    /* coins have weight, so a purse change moves carried weight and can move
       speed — re-render the inventory totals and recompute, not just the boxes */
    closeModal();renderCoins();renderInventory();recompute();scheduleSave();
  });
}
/* push whole character into DOM */
function convertCoins(){
  // value of each coin in copper; electrum counts as input but isn't generated as output
  const VAL={cp:1,sp:10,ep:50,gp:100,pp:1000};
  let total=0;["cp","sp","ep","gp","pp"].forEach(k=>{total+=num((character.coins||{})[k])*VAL[k];});
  const out=(character.system==="dnd")?[["pp",1000],["gp",100],["sp",10],["cp",1]]:[["gp",100],["sp",10],["cp",1]];
  const res={cp:"",sp:"",ep:"",gp:"",pp:""};
  out.forEach(([k,v])=>{const n=Math.floor(total/v);total-=n*v;res[k]=n>0?n:"";});
  character.coins=res;renderCoins();renderInventory();recompute();scheduleSave();
}
const COIN_ALL=[["cp","CP","Copper"],["sp","SP","Silver"],["ep","EP","Electrum"],
                ["gp","GP","Gold"],["pp","PP","Platinum"]];
/* Electrum is a D&D-only oddity; Humblewood doesn't use it. */
function coinKeys(){return (character.system==="dnd")?["cp","sp","ep","gp","pp"]:["cp","sp","gp"];}

/* What a signed-entry box — coins, HP — should become, given what was typed.
     "12"  -> set to 12          "+10" -> add           "-5" -> spend
     ""    -> cleared            anything else -> null (caller puts it back)
   Signed entries are the point of this: during play you know what you SPENT or
   what damage you TOOK, not what the new total is. Never goes below zero — you
   can't owe copper, and you can't have less than no hit points.
   Accepts the unicode minus too, since the on-screen hint shows one.
   There is deliberately no upper bound here: HP has one and coins don't, and it
   isn't a property of the entry syntax anyway — see clampHP(). */
function signedEntry(cur,raw){
  const s=String(raw==null?"":raw).trim().replace(/[−–—]/g,"-");
  if(!s)return "";
  const m=/^([+-])\s*(\S+)$/.exec(s);
  if(m){
    const n=entryDigits(m[2]);
    return n===null?null:Math.max(0,num(cur)+n*(m[1]==="-"?-1:1));
  }
  return entryDigits(s);
}
/* Space is allowed after the sign ("+ 10") but NOT inside the digits: "1 2" is
   a slip, and quietly reading it as 12 is the sort of silent coercion that
   loses someone their gold. Unrecognised entries are rejected instead.
   Shared by signedEntry and signedDelta so the grammar can't drift between the
   two readings of the same typed box. */
function entryDigits(t){return /^\d+$/.test(t)||/^\d{1,3}(,\d{3})+$/.test(t) ? parseInt(t.replace(/,/g,""),10) : null;}
/* The signed half of signedEntry(), for the callers that need the DELTA rather
   than the result: "-7" -> -7, "+4" -> 4, and null for a bare total or anything
   unparseable. Damage has to know it was seven points, not that the box should
   end up reading three, because temporary HP is spent before Current is —
   signedEntry has already folded the delta away (and floored it at 0) by the
   time it returns. */
function signedDelta(raw){
  const m=/^([+-])\s*(\S+)$/.exec(String(raw==null?"":raw).trim().replace(/[−–—]/g,"-"));
  if(!m)return null;
  const n=entryDigits(m[2]);
  return n===null?null:n*(m[1]==="-"?-1:1);
}
function renderCoins(){
  const el=document.getElementById("coins");if(!el)return;
  /* NOT data-path: that handler writes on every keystroke, which would store
     "+" the moment you typed it and lose the number you were adding to. These
     apply on change (blur/Enter), once the entry is complete. inputmode="tel"
     rather than "numeric" because the numeric keypad on iOS has no sign keys. */
  el.innerHTML=coinKeys().map(k=>{
    const d=COIN_ALL.find(x=>x[0]===k);
    const v=(character.coins&&character.coins[k]!=null)?character.coins[k]:"";
    return `<div class="coin"><label title="${d[2]}">${d[1]}</label>`+
      `<input type="text" inputmode="tel" data-coin="${k}" value="${esc(v)}" placeholder="0" `+
      `aria-label="${d[2]} — type a number, or +10 / -5 to adjust"></div>`;
  }).join("");
}
/* Commit one coin box. Returns false if the entry made no sense. */
function applyCoinInput(inp){
  const k=inp.dataset.coin;if(!k)return true;
  character.coins=character.coins||{};
  const next=signedEntry(character.coins[k],inp.value);
  if(next===null){inp.value=(character.coins[k]!=null)?character.coins[k]:"";return false;}
  character.coins[k]=next;
  inp.value=next;
  renderInventory();recompute();
  scheduleSave();
  return true;
}
/* Damage comes off TEMPORARY hit points first. Nothing in the app had ever
   spent them — they were stored, displayed and cleared on a long rest, and the
   player did the subtraction by hand. Healing never touches temp: temp HP is
   granted, not restored, so a positive delta goes straight to Current.
   Model + clamp only, no DOM — callers pair it with renderHP(), the same
   contract clampHP() has. It lives HERE rather than in 90-boot.js because the
   test harness drops that fragment: logic in it is untestable by construction,
   so 90-boot keeps the wiring and nothing else. */
function adjustHP(delta){
  let d=num(delta);
  if(d<0){
    const soak=Math.min(num(character.hp.temp),-d);
    if(soak>0){
      character.hp.temp=(num(character.hp.temp)-soak)||"";   /* spent out reads blank, as a long rest leaves it */
      d+=soak;
    }
  }
  if(d)character.hp.cur=num(character.hp.cur)+d;
  clampHP();
}
/* The HP boxes work exactly like the coin boxes and for the same reason: they
   are NOT data-path, because that handler commits on every keystroke and would
   store "-" the instant you typed it, losing the number you were subtracting
   from. They commit on change (blur/Enter), once the entry is finished. */
/* Which band Current HP falls in, as a class name — "" for none. Measured
   against the EFFECTIVE max, so an item that raises your maximum moves the
   thresholds with it. Temp is excluded: it sits ABOVE your maximum, so folding
   it in could read as healthy while your real pool is empty.
   No maximum set means no band at all — a blank new character must not open
   painted red. Pure, so the bands are testable without a DOM. */
function hpBand(){
  if(character.hpColor===false)return "";
  const mx=effMaxHP();if(mx<=0)return "";
  const pct=num(character.hp.cur)/mx*100;
  return (pct<=25)?"hp-danger":(pct<=50)?"hp-warn":"";
}
function renderHP(){
  ["cur","max","temp"].forEach(k=>{
    const el=document.getElementById("hp"+k[0].toUpperCase()+k.slice(1));
    if(el){const v=character.hp[k];el.value=(v===null||v===undefined)?"":v;}
  });
  const cur=document.getElementById("hpCur"),band=hpBand();
  if(cur){cur.classList.toggle("hp-warn",band==="hp-warn");cur.classList.toggle("hp-danger",band==="hp-danger");}
  /* Two layers, the same shape the auto spell-slot fields use: readOnly so the
     browser refuses the edit, AND a refusal in applyHPInput, because readOnly
     is only a hint — paste, autofill and any programmatic caller go straight
     past it. `!==false` rather than a truth test, so an object that never went
     through migrate() reads as locked rather than silently editable. */
  const locked=character.hp.locked!==false;
  const mx=document.getElementById("hpMax");if(mx)mx.readOnly=locked;
  const lk=document.querySelector("[data-hplock]");
  if(lk){
    lk.classList.toggle("open",!locked);
    lk.setAttribute("aria-pressed",locked?"true":"false");
    lk.title=locked?"Max HP is locked — tap to edit it":"Max HP is unlocked — tap to lock it";
  }
}
/* Commit one HP box. Returns false if the entry was refused. */
function applyHPInput(inp){
  const k=inp.dataset.hp;
  /* An explicit list, not `k in character.hp`: `locked` is a key on that object
     now, and a data-hp hook must never be able to write a boolean field. */
  if(k!=="cur"&&k!=="max"&&k!=="temp")return true;
  /* Max is locked by default, and the padlock is the only way a PLAYER changes
     it. renderHP has already made the box readOnly; this is the second layer,
     because readOnly does not stop a paste. The automatic writers
     (seedLevel1HP, resyncLevel1HP, removeClass's un-seed — all 56-class.js) go
     to the model directly and BYPASS this on purpose: routing them through here
     would leave a locked level-1 character with no hit points at all. */
  if(k==="max"&&character.hp.locked!==false){renderHP();return false;}
  /* A negative typed into Current OR Temp IS damage, and goes through the one
     damage path: temp first, then the overflow into current. Typing -5 against
     3 temp has to leave you 2 down on current, not throw the extra away, and it
     must mean the same thing whichever of the two boxes you happened to type it
     in. Everything else — a heal, a bare total, anything in the Max box, where
     a negative is you lowering your maximum — stays a plain edit to the box you
     typed in. Junk like "+ab" reads as null and is rejected below. */
  const dmg=(k==="cur"||k==="temp")?signedDelta(inp.value):null;
  if(dmg!==null&&dmg<0){adjustHP(dmg);renderHP();scheduleSave();return true;}
  const next=signedEntry(character.hp[k],inp.value);
  if(next===null){renderHP();return false;}   /* reject: put the model's value back */
  character.hp[k]=next;
  clampHP();renderHP();
  if(k==="max")recompute();   /* what data-recompute did; nothing is derived from cur/temp */
  scheduleSave();
  return true;
}
function renderAll(){
  renderCoins();renderHP();   /* neither is data-path, so neither is in the loop below */
  document.querySelectorAll("[data-path]").forEach(inp=>{const v=get({character},inp.dataset.path);inp.value=(v===null||v===undefined)?"":v});
  /* renderTables belongs here for the same reason renderGloss does: both draw
     from the rules pool, not the character, so loading a sheet with rules
     already cached has to draw them. Leaving it out meant the Tables tab was
     blank after a refresh until you typed in its filter box. */
  /* Before anything draws: the Concentrating condition mirrors the active spell,
     and a sheet saved before that existed — or one whose spell was ended in some
     way the mirror never saw — reconciles on load rather than showing a
     condition for a spell that isn't running. */
  syncConcStatus();
  renderPortrait();renderClassRace();renderFeatures();renderInventory();renderStatuses();renderFamiliars();ensureSpellAttacks();renderSpells();renderGloss();renderTables();renderNoteIcons();renderNotes();renderAllRT();recompute();
}

