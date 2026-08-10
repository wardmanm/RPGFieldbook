/* ---- app version & changelog (bump APP_VERSION + add a CHANGELOG entry on every fieldbook.html change) ---- */
const APP_VERSION="1.2.1";
/* Set this to your GitHub "owner/repo" to enable the update badge. Leave "" to disable.
   The badge appears when a GitHub Release with a newer tag (e.g. v1.2.0) exists, and links
   to that release's page (attach fieldbook.html to the release so players can download it). */
const UPDATE_REPO="wardmanm/RPGFieldbook";
function cmpVer(a,b){const pa=String(a||"").replace(/^v/i,"").split(".").map(n=>parseInt(n,10)||0),pb=String(b||"").replace(/^v/i,"").split(".").map(n=>parseInt(n,10)||0);for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return -1;}return 0;}
function checkForUpdate(){
  if(!UPDATE_REPO||(navigator.onLine===false))return;
  fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,{headers:{Accept:"application/vnd.github+json"}})
    .then(r=>r.ok?r.json():null)
    .then(rel=>{
      if(!rel||!rel.tag_name||cmpVer(rel.tag_name,APP_VERSION)<=0)return;
      const el=document.getElementById("updatePill");if(!el)return;
      const ver=String(rel.tag_name).replace(/^v/i,"");
      el.href=rel.html_url||`https://github.com/${UPDATE_REPO}/releases/latest`;
      el.textContent="↑ Update "+ver;
      el.title=`Version ${ver} is available on GitHub — tap to open the download page (you have ${APP_VERSION}).`;
      el.style.display="inline-flex";
    }).catch(()=>{});
}
const CHANGELOG=[
  {v:"1.2.1", date:"2026-08-07", notes:[
    "Top-bar layout fixes: the version badge now sits next to the Humblewood title, the table-of-contents (☰) button is pinned to the far right of the tab bar, and the ToC flyout opens below the top bars instead of overlapping them."
  ]},
  {v:"1.2.0", date:"2026-08-07", notes:[
    "Update badge: when a newer GitHub Release exists, an '↑ Update' pill appears in the top bar linking to the release's download page. Set UPDATE_REPO to your 'owner/repo' to enable it (blank = off); publish updates as a GitHub Release tagged with the version, e.g. v1.2.0."
  ]},
  {v:"1.1.0", date:"2026-08-07", notes:[
    "Importing a character file that matches one you already have now asks before overwriting, and offers 'Import as copy' to keep both (the copy gets a fresh identity and a '(copy)' name).",
    "Importing a brand-new or different character still adds it directly."
  ]},
  {v:"1.0.0", date:"2026-08-06", notes:[
    "Equipment grants: backgrounds, classes, and races add their starting gear — linked to the loaded item list, with 'this OR that' pickers and clean revert when you swap.",
    "All 16 D&D 2024 (XPHB) backgrounds included.",
    "Origin designators on items and spells (tap the badge for source + date); origin picker and optional cost on the add screens, with a running inventory Total value.",
    "Spellcasting: a Cast button that spends the right slot (and offers an upcast); attack and save spells appear in Attacks & Weapons; new Active Spells card with per-spell elapsed time and a global round counter; concentration handling.",
    "Attack cantrips (Ray of Frost, Chill Touch, …) are auto-detected into Attacks; a toast confirms each cast.",
    "Armor is equippable and drives AC (base + Dex capped by armor type, plus shields).",
    "Inventory grouped into collapsible sections with a Favorites section, equipped-first sorting, and a Category option for custom items.",
    "Sticky section tabs with a collapsing header, and a per-tab table-of-contents flyout (☰).",
    "More reliable character export/import — nothing is dropped on load.",
    "Added this version number and changelog."
  ]}
];
function openChangelog(){
  const body=`<div style="max-height:60vh;overflow:auto">`+CHANGELOG.map(e=>`<div style="margin-bottom:14px"><div style="font-family:var(--head);font-weight:800"><span style="color:var(--accent)">v${esc(e.v)}</span> <span class="hint" style="font-weight:400">${esc(e.date||"")}</span></div><ul style="margin:6px 0 0;padding-left:18px">${e.notes.map(n=>`<li style="margin:3px 0">${esc(n)}</li>`).join("")}</ul></div>`).join("")+`</div><div class="m-actions"><button class="tbtn primary" id="clOk">Close</button></div>`;
  openModal("Fieldbook v"+APP_VERSION,body);
  const b=document.getElementById("clOk");if(b)b.addEventListener("click",closeModal);
}
