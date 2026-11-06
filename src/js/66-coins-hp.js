/* portrait */
function renderPortrait(){
  const el=document.getElementById("portrait");
  /* the portrait comes from the character file, so it goes through imgHTML():
     escaped, and data: URLs only. Anything refused shows the placeholder. */
  el.innerHTML=imgHTML(character.portraitImg,"Portrait")||`<div class="ph">No portrait yet</div>`;
}

let _adjWired=false,_adjSync=null;
/* One transaction across several denominations — "that costs 2gp 5sp" is a
   single action here rather than two edits, and it can't leave you halfway
   through if part of it would overdraw. */
function openCoinAdjust(){
  const keys=coinKeys();
  const rows=keys.map(k=>{
    const d=COIN_ALL.find(x=>x[0]===k);
    return `<div class="coin"><label title="${esc(d[2])}">${d[1]}</label>
      <input type="text" inputmode="tel" data-adj="${esc(k)}" placeholder="0"
             aria-label="Adjust ${esc(d[2])} — e.g. 10 to gain, -5 to spend"></div>`;
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
    logCoins("Coins adjusted",Object.fromEntries(Object.keys(out).map(k=>[k,out[k].delta])));
    /* coins have weight, so a purse change moves carried weight and can move
       speed — re-render the inventory totals and recompute, not just the boxes */
    closeModal();renderCoins();renderInventory();recompute();scheduleSave();
  });
}
/* push whole character into DOM */
function convertCoins(){
  // value of each coin in copper; electrum counts as input but isn't generated as output
  const VAL={cp:1,sp:10,ep:50,gp:100,pp:1000};
  const was=Object.assign({},character.coins);
  let total=0;["cp","sp","ep","gp","pp"].forEach(k=>{total+=num((character.coins||{})[k])*VAL[k];});
  const out=(character.system==="dnd")?[["pp",1000],["gp",100],["sp",10],["cp",1]]:[["gp",100],["sp",10],["cp",1]];
  const res={cp:"",sp:"",ep:"",gp:"",pp:""};
  out.forEach(([k,v])=>{const n=Math.floor(total/v);total-=n*v;res[k]=n>0?n:"";});
  character.coins=res;
  logCoins("Converted coins",Object.fromEntries(["pp","gp","ep","sp","cp"].map(k=>[k,num(res[k])-num(was[k])])));
  renderCoins();renderInventory();recompute();scheduleSave();
}
const COIN_ALL=[["cp","CP","Copper"],["sp","SP","Silver"],["ep","EP","Electrum"],
                ["gp","GP","Gold"],["pp","PP","Platinum"]];
/* The DISPLAY order — the Coins card and the Adjust coins window — high to low,
   the way a purse is read and the printout already runs (issue #48). The coin
   maths keeps its own lists, so order here is presentation only. Electrum is a
   D&D-only oddity; Humblewood doesn't use it. */
function coinKeys(){return (character.system==="dnd")?["pp","gp","ep","sp","cp"]:["gp","sp","cp"];}

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
    return `<div class="coin"><label title="${esc(d[2])}">${d[1]}</label>`+
      `<input type="text" inputmode="tel" data-coin="${esc(k)}" value="${esc(v)}" placeholder="0" `+
      `aria-label="${esc(d[2])} — type a number, or +10 / -5 to adjust"></div>`;
  }).join("");
}
/* Commit one coin box. Returns false if the entry made no sense. */
function applyCoinInput(inp){
  const k=inp.dataset.coin;if(!k)return true;
  character.coins=character.coins||{};
  const was=num(character.coins[k]);
  const next=signedEntry(character.coins[k],inp.value);
  if(next===null){inp.value=(character.coins[k]!=null)?character.coins[k]:"";return false;}
  character.coins[k]=next;
  inp.value=next;
  logCoins("Coins changed",{[k]:num(next)-was});
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
/* #113: a box as wide as what it holds, in `ch` (the width of a digit in its
   own font), so "26 / 38" is as wide as its digits and the bar can centre
   it. Blank, a box fits its placeholder ("0", or Temp's "temp"). */
function hpBoxWidth(k,v){
  const s=(v===null||v===undefined)?"":String(v);
  return s===""?(k==="temp"?"4.6ch":"1.2ch"):(s.length+0.2)+"ch";
}
/* ...and as it is typed (wired in 90-boot.js), so "+12" never scrolls. */
function hpFitBox(el){if(el&&el.style&&el.dataset){el.style.width=hpBoxWidth(el.dataset.hp,el.value);hpPlaceTemp();}}
/* #113: where Temp goes. The bar's two outer columns are identical, so the
   numbers are always exactly centred; Temp sits at the right of the third only
   if it fits there with its margin and a clear gap before the numbers, and
   otherwise moves beside the "Hit points" label (.rail-hp.hp-out). What has to
   fit is measured — fonts, skins, digits and a blank Temp's "+temp" all vary —
   rather than guessed from the rail's width: a fixed 220px threshold missed
   the combat view at 375px (221px) by a pixel. HP_TMP_EDGE is .hp-tmp's
   margin-right in 30-sheet.css. */
const HP_TMP_EDGE=6;
const HP_TMP_GAP=6;
/* The bar's inner width, the numbers' width, Temp's width ("+" and its box,
   which are the same in both places): true if Temp fits beside the centred
   numbers, null for a bar that isn't laid out (a hidden tab). Pure. */
function hpTempFits(barW,numW,tmpW){
  if(!(barW>0))return null;
  return (barW-numW)/2-tmpW-HP_TMP_EDGE>=HP_TMP_GAP;
}
/* Run by renderHP(), hpFitBox(), and from 90-boot.js when the bar or the
   numbers change size, when the fonts arrive, and when Temp loses focus. A
   Temp box being typed in moves OUT the moment it stops fitting (it must never
   touch the numbers) but is not pulled back IN under the caret; that waits for
   the blur. The measurements don't depend on where Temp is, so the class can't
   flip back and forth. */
function hpPlaceTemp(){
  const wrap=document.querySelector(".rail-hp");if(!wrap)return;
  const bar=wrap.querySelector(".hp-bar"),num=wrap.querySelector(".hp-num"),plus=wrap.querySelector(".hp-tplus"),inp=document.getElementById("hpTemp");
  if(!bar||!num||!plus||!inp||!inp.getBoundingClientRect)return;
  const fits=hpTempFits(bar.clientWidth,num.getBoundingClientRect().width,plus.getBoundingClientRect().width+inp.getBoundingClientRect().width);
  if(fits===null)return;
  const out=wrap.classList.contains("hp-out"),next=!fits||(out&&document.activeElement===inp);
  if(next!==out)wrap.classList.toggle("hp-out",next);
}
function renderHP(){
  /* #112: on a touchscreen the bar is one button that opens the Hit points
     window, so its boxes take no typing at all: readOnly, no keyboard, out of
     the tab order. With a mouse they type exactly as before. */
  const touch=hpTouch();
  ["cur","max","temp"].forEach(k=>{
    const el=document.getElementById("hp"+k[0].toUpperCase()+k.slice(1));
    if(el){const v=character.hp[k];el.value=(v===null||v===undefined)?"":v;
      el.style.width=hpBoxWidth(k,el.value);   /* #113: sized to what it holds, so the group centres */
      el.inputMode=touch?"none":"tel";el.tabIndex=touch?-1:0;if(k!=="max")el.readOnly=touch;}
  });
  const bar=document.querySelector(".hp-bar");
  if(bar){
    if(touch){bar.setAttribute("role","button");bar.setAttribute("tabindex","0");bar.setAttribute("aria-label",hpBarLabel(character.hp,effMaxHP()));}
    else ["role","tabindex","aria-label"].forEach(a=>bar.removeAttribute(a));
  }
  const cur=document.getElementById("hpCur"),band=hpBand();
  if(cur){cur.classList.toggle("hp-warn",band==="hp-warn");cur.classList.toggle("hp-danger",band==="hp-danger");}
  /* #103: the rail's HP bar. Its fill is cur over the EFFECTIVE max (as
     hpBand() measures it), 0 with no max, and it wears the band — "" when
     Colour current HP is off, so the bar stays the plain colour. */
  const fill=document.getElementById("hpFill");
  if(fill){
    const emx=effMaxHP(),pct=emx>0?Math.max(0,Math.min(100,Math.round(num(character.hp.cur)/emx*100))):0;
    fill.style.width=pct+"%";
    fill.classList.toggle("hp-warn",band==="hp-warn");fill.classList.toggle("hp-danger",band==="hp-danger");
  }
  /* Two layers, the same shape the auto spell-slot fields use: readOnly so the
     browser refuses the edit, AND a refusal in applyHPInput, because readOnly
     is only a hint — paste, autofill and any programmatic caller go straight
     past it. The lock is the Vitals pencil (#115), read by vitalsLocked(). */
  const mx=document.getElementById("hpMax");if(mx)mx.readOnly=touch||vitalsLocked(character);
  hpPlaceTemp();   /* #113: the values (and so the widths) may have changed */
  /* #91: your chip and row in the initiative tracker read this HP live */
  renderInitStrip();
}
/* Commit one HP box. Returns false if the entry was refused. */
function applyHPInput(inp){
  const k=inp.dataset.hp;
  /* An explicit list, not `k in character.hp`: a sheet saved before #115 still
     carries the old `locked` key on that object, and a data-hp hook must never
     be able to write a boolean field. */
  if(k!=="cur"&&k!=="max"&&k!=="temp")return true;
  /* While Vitals is locked (its pencil, #115) a PLAYER can't change Max.
     renderHP has already made the box readOnly; this is the second layer,
     because readOnly does not stop a paste. The automatic writers
     (seedLevel1HP, resyncLevel1HP, removeClass's un-seed — all 56-class.js) go
     to the model directly and BYPASS this on purpose: routing them through here
     would leave a locked level-1 character with no hit points at all. */
  if(k==="max"&&vitalsLocked(character)){renderHP();return false;}
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
/* ================= the Hit points window (#112) =================
   On a touchscreen a tap on the HP bar opens it: type an amount, then Damage,
   Heal or Temp. A phone's keypad hides the minus sign behind other keyboards,
   so nothing here needs one; Set exactly, folded underneath, types the numbers
   straight in. The logic is here, pure where it can be, because the harness
   drops 90-boot.js, which only wires the tap. adjustHP() stays the one damage
   path: the preview (hpQuick) works out what each tap would leave, and the tap
   itself goes through adjustHP/clampHP, the suite holding the two equal. */
/* "Touchscreen" is the device's PRIMARY pointer (spec decision 8): phones and
   tablets, not a narrowed laptop window, and a touchscreen laptop counts as
   desktop. Read at tap time. */
function hpTouch(){return !!(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches);}
/* A whole number from 1, or null. Spaces and commas are stripped, as Adjust
   coins does; a sign, a fraction or anything else is refused. */
function hpAmount(raw){
  const s=String(raw==null?"":raw).replace(/[\s,]/g,"");
  if(!/^\d+$/.test(s))return null;
  const n=parseInt(s,10);return n>=1?n:null;
}
/* What each tap would leave, as the model would store it — adjustHP's rules
   and clampHP's bounds, mirrored. Pure. */
function hpQuick(hp,effMax,n){
  const mx=num(effMax),t0=num(hp.temp),cap=v=>(mx>0&&num(v)>mx)?mx:v;
  const soak=Math.min(t0,n),over=n-soak;
  return {
    damage:{cur:cap(over?Math.max(0,num(hp.cur)-over):hp.cur),temp:soak>0?((t0-soak)||""):hp.temp},
    heal:{cur:cap(num(hp.cur)+n)},
    temp:{temp:n}
  };
}
/* The line under each button. Damage says what Current becomes, and what is
   left of temp ("→ 22, no temp"), or just the temp when it soaks the lot and
   Current doesn't move ("temp 3 → 1"). */
function hpQuickText(hp,effMax,n){
  const q=hpQuick(hp,effMax,n),t0=num(hp.temp),t1=num(q.damage.temp);
  const damage=(num(q.damage.cur)===num(hp.cur)&&t0>0)?`temp ${t0} → ${t1}`
    :`→ ${num(q.damage.cur)}`+(t0>0?(t1>0?`, temp ${t1}`:", no temp"):"");
  return {damage,heal:`→ ${num(q.heal.cur)}`,temp:t0>0?`${t0} → ${n}`:`→ ${n}`};
}
/* The window's header: Current / the EFFECTIVE maximum (#maxNote explains it
   when an effect applies) · temp. */
function hpNowText(hp,effMax){
  const t=num(hp.temp);
  return `${num(hp.cur)} / ${num(effMax)>0?num(effMax):"—"}`+(t>0?` · temp ${t}`:"");
}
/* The bar's accessible name while it is a button (touch). */
function hpBarLabel(hp,effMax){
  const t=num(hp.temp);
  return `Hit points ${num(hp.cur)}`+(num(effMax)>0?` of ${num(effMax)}`:"")+(t>0?`, temp ${t}`:"")+" — change";
}
/* One tap, on the model. Temp REPLACES what is there (decision 11): temp HP
   don't stack, and the one you keep is your choice. Callers repaint and save. */
function hpQuickApply(kind,n){
  const a=hpAmount(n);if(a===null)return false;
  if(kind==="damage")adjustHP(-a);
  else if(kind==="heal")adjustHP(a);
  else if(kind==="temp"){character.hp.temp=a;clampHP();}
  else return false;
  return true;
}
/* Set exactly's boxes: plain whole numbers from 0 (one grammar per box: the
   bar's signed entry on desktop, this one on touch), blank meaning "not set",
   and a Temp of 0 meaning none. Max only while Vitals is unlocked. */
function hpSetParse(vals,withMax){
  const bad=[],one=(raw,label)=>{
    const s=String(raw==null?"":raw).replace(/[\s,]/g,"");
    if(s==="")return "";
    if(!/^\d+$/.test(s)){bad.push(label);return null;}
    return parseInt(s,10);
  };
  const hp={cur:one(vals.cur,"Current")};
  if(withMax)hp.max=one(vals.max,"Max");
  hp.temp=one(vals.temp,"Temp");if(hp.temp===0)hp.temp="";
  return {hp,bad};
}
/* Writes what Set exactly parsed, then clampHP(). Returns whether Max moved,
   so the caller knows to recompute(). A Max is refused while Vitals is locked
   even when one is passed: the same second layer applyHPInput() keeps. */
function hpSetApply(hp){
  if(["cur","max","temp"].some(k=>hp[k]===null))return false;
  let moved=false;
  if("max" in hp&&!vitalsLocked(character)){moved=String(hp.max)!==String(character.hp.max);character.hp.max=hp.max;}
  character.hp.cur=hp.cur;character.hp.temp=hp.temp;
  clampHP();
  return moved;
}
function hpDialogHTML(hp,effMax,withMax){
  const v=x=>(x===null||x===undefined)?"":String(x);
  /* The header shows the EFFECTIVE maximum; Set exactly's box holds the base,
     so when an effect makes them differ the box says so (typing the header's
     number would count the effect twice). */
  const fx=num(effMax)!==num(hp.max);
  const box=(id,label,val,ph)=>`<label>${esc(label)}<input type="text" inputmode="numeric" id="${esc(id)}" value="${esc(val)}"${ph?` placeholder="${esc(ph)}"`:""} autocomplete="off"></label>`;
  const btn=(id,cls,verb)=>`<button type="button" class="tbtn hpq-btn ${esc(cls)}" id="${esc(id)}" disabled><b>${esc(verb)}</b><span class="hpq-res" id="${esc(id+"Res")}"></span></button>`;
  return `<div class="hpq">
    <p class="hpq-now">${esc(hpNowText(hp,effMax))}</p>
    <input type="text" inputmode="numeric" class="hpq-amt" id="hpqAmt" placeholder="How much?" aria-label="How much?" autocomplete="off" enterkeyhint="done">
    <div class="hpq-acts">${btn("hpqDmg","hpq-dmg","Damage")}${btn("hpqHeal","hpq-heal","Heal")}${btn("hpqTemp","hpq-temp","Temp")}</div>
    <details class="hpq-set" id="hpqSet"><summary>Set exactly</summary>
      <div class="hpq-grid">${box("hpqCur","Current",v(hp.cur))}${withMax?box("hpqMax",fx?"Base max":"Max",v(hp.max)):""}${box("hpqTmp","Temp",num(hp.temp)>0?v(hp.temp):"","none")}</div>
      ${!withMax?`<p class="hint">Max HP is locked. Unlock Vitals with its pencil to change it.</p>`
        :fx?`<p class="hint">Your maximum is ${esc(num(effMax))} with effects; this box is the base.</p>`:""}
      <p class="hint hpq-msg" id="hpqMsg" role="status"></p>
      <div class="m-actions"><button class="tbtn" id="hpqCancel" type="button">Cancel</button><button class="tbtn primary" id="hpqApply" type="button">Apply</button></div>
    </details>
  </div>`;
}
/* Its listeners bind to elements in its own HTML, which die with it (never to
   #mBody, which outlives every window). */
function openHPDialog(){
  const withMax=!vitalsLocked(character);
  openModal("Hit points",hpDialogHTML(character.hp,effMaxHP(),withMax));
  const $=id=>document.getElementById(id),val=id=>{const e=$(id);return e?e.value:"";};
  const amt=$("hpqAmt"),kinds={damage:"hpqDmg",heal:"hpqHeal",temp:"hpqTemp"};
  const sync=()=>{
    const n=hpAmount(amt&&amt.value),txt=n===null?null:hpQuickText(character.hp,effMaxHP(),n);
    Object.keys(kinds).forEach(k=>{const b=$(kinds[k]),r=$(kinds[k]+"Res");if(b)b.disabled=n===null;if(r)r.textContent=txt?txt[k]:"";});
  };
  if(amt){amt.addEventListener("input",sync);
    /* the keypad's Done is an Enter: put the keypad away so the three buttons
       show, and apply nothing (which one is the player's tap) */
    amt.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();amt.blur();}});}
  Object.keys(kinds).forEach(k=>{const b=$(kinds[k]);if(b)b.addEventListener("click",()=>{
    if(!hpQuickApply(k,amt&&amt.value))return;
    renderHP();scheduleSave();closeModal();   /* no toast: the bar shows the result */
  });});
  const set=$("hpqSet"),sum=set&&set.querySelector("summary"),msg=$("hpqMsg"),go=$("hpqApply");
  const check=()=>{
    const p=hpSetParse({cur:val("hpqCur"),max:val("hpqMax"),temp:val("hpqTmp")},withMax);
    if(go)go.disabled=p.bad.length>0;
    if(msg)msg.textContent=p.bad.length?"Not a whole number: "+p.bad.join(", "):"";
    return p;
  };
  ["hpqCur","hpqMax","hpqTmp"].forEach(id=>{const e=$(id);if(!e)return;
    e.addEventListener("input",check);
    e.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();if(go&&!go.disabled)go.click();}});});
  /* Opened by hand, inside the tap, so focusing Current can still bring up the
     keypad (a focus after the <details> toggles itself is outside the gesture). */
  if(sum)sum.addEventListener("click",e=>{e.preventDefault();set.open=!set.open;
    if(set.open){const c=$("hpqCur");if(c){c.focus();c.select();}}});
  const cancel=$("hpqCancel");if(cancel)cancel.addEventListener("click",closeModal);
  if(go)go.addEventListener("click",()=>{
    const p=check();if(p.bad.length)return;
    const moved=hpSetApply(p.hp);
    renderHP();if(moved)recompute();scheduleSave();closeModal();
  });
  sync();check();
  /* On touch modalTakeFocus() focuses the dialog box; the amount box is what
     the player came to type in, and focusing it inside the tap brings up the
     digits-only keypad. */
  if(amt)amt.focus();
}
function renderAll(){
  /* FIRST, before the [data-path] loop below: rebuilding blanks the six score
     inputs that the loop refills, and recompute() at the end repaints every
     number. */
  buildStats();
  renderCoins();renderHP();   /* neither is data-path, so neither is in the loop below */
  document.querySelectorAll("[data-path]").forEach(inp=>{const v=get({character},inp.dataset.path);inp.value=(v===null||v===undefined)?"":v});
  /* renderRulesBrowser belongs here as well as in refreshRulesUI(): it draws
     from the rules pool, not the character, so loading a sheet with rules
     already cached has to draw it. Leaving the tables out once meant the Tables
     list was blank after a refresh until you typed in its filter box. */
  /* Before anything draws: the Concentrating condition mirrors the active spell,
     and a sheet saved before that existed — or one whose spell was ended in some
     way the mirror never saw — reconciles on load rather than showing a
     condition for a spell that isn't running. */
  syncConcStatus();
  renderPortrait();renderClassRace();renderFeatures();renderInventory();renderStatuses();renderChipsAll();renderParty();renderFamiliars();ensureSpellAttacks();renderSpells();renderRulesBrowser();renderNoteIcons();renderEditToggles();renderNotes();renderJournal();renderTrackers();renderAllRT();recompute();applyHiddenTabs();
  /* LAST: the combat toggles sit beside the note buttons drawn above, and an open
     combat view refills from THIS character — every character switch ends here. */
  syncCombatView();
}

