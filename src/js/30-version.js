/* ---- app version & changelog (bump APP_VERSION + add a CHANGELOG entry on every fieldbook.html change) ---- */
const APP_VERSION="1.4.0";
/* The release in which each system's RULES DATA last changed, keyed by the
   `system` field its pack carries. Owned by scripts/release.js, which bumps a
   system only when its data/<dir>/ actually changed since the previous tag —
   so the app can tell "you need the new app" from "you also need new data".
   scripts/bundle-rules.js stamps each pack with its own value as `dataVersion`;
   dataStatus() compares what a player loaded against these. Never hand-edit. */
const DATA_VERSIONS={"XPHB":"1.4.0","Humblewood":"1.3.0","XGE":"1.4.0","TCE":"1.4.0","Homebrew":"1.4.0"};
/* Set this to your GitHub "owner/repo" to enable the update badge. Leave "" to disable.
   The badge appears when a GitHub Release with a newer tag (e.g. v1.2.0) exists, and links
   to that release's page (attach fieldbook.html to the release so players can download it). */
const UPDATE_REPO="wardmanm/RPGFieldbook";
function cmpVer(a,b){const pa=String(a||"").replace(/^v/i,"").split(".").map(n=>parseInt(n,10)||0),pb=String(b||"").replace(/^v/i,"").split(".").map(n=>parseInt(n,10)||0);for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return -1;}return 0;}
/* What the update check found, or null. Held so openChangelog() can lead with a
   download link — the pill REPLACES the version button rather than sitting
   beside it, so the changelog has to stay reachable through the pill. */
let updateAvailable=null;
function checkForUpdate(){
  if(!UPDATE_REPO||(navigator.onLine===false))return;
  fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,{headers:{Accept:"application/vnd.github+json"}})
    .then(r=>r.ok?r.json():null)
    .then(rel=>{
      if(!rel||!rel.tag_name||cmpVer(rel.tag_name,APP_VERSION)<=0)return;
      updateAvailable={ver:String(rel.tag_name).replace(/^v/i,""),
                       url:rel.html_url||`https://github.com/${UPDATE_REPO}/releases/latest`};
      showUpdatePill();
    }).catch(()=>{});
}
/* One control, not two. The version button and the update pill say the same
   thing — which build you're looking at — so an update takes over its slot
   instead of crowding in next to it. The version you're ON moves into the
   tooltip and stays in the changelog's title, so it is never lost. */
function showUpdatePill(){
  if(!updateAvailable)return;
  const el=document.getElementById("updatePill");if(!el)return;
  const ver=document.getElementById("btnVer");if(ver)ver.style.display="none";
  el.textContent="↑ v"+updateAvailable.ver;
  el.title=`Update to version ${updateAvailable.ver} available — you're on ${APP_VERSION}. Tap for what's new and the download.`;
  el.style.display="inline-flex";
}
const CHANGELOG=[
  {v:"1.4.0", date:"2026-08-11", notes:[
    "Items can carry a weight, and the Inventory tab totals up what you're hauling. Gear added from the rules browser brings its weight with it.",
    "New per-character Encumbrance setting, in Settings: off, the standard rules, or the variant Encumbered / Heavily Encumbered tiers. When it's on, a heavy pack really does slow you down — the Speed on your sheet drops, tapping it explains why, and a badge on the Inventory card shows how close to your limit you are.",
    "Coins count toward what you're carrying, at 50 coins to the pound, with a switch to turn that off.",
    "Characters now have a Size, shown in Vitals next to Speed. It comes from your ancestry unless you tap it and pick your own — the picker tells you what each size would let you carry before you commit. Large characters carry twice as much, Tiny half as much, and Size prints on the sheet.",
    "Item costs under 1 gp are no longer rounded down to zero in the item list or the inventory total.",
    "Fixed: editing an item no longer quietly loses its favourite star, or its link back to the rules pack it came from.",
    "Settings is now grouped into collapsible sections — Appearance, This character, Rules data, and Characters & backup — instead of one long scroll. It remembers which ones you left open, and the folded Rules data header still tells you how much is loaded.",
    "The Hit Point boxes now take signed entries, the way the coin boxes do: type -7 to take damage, +4 to heal, or a plain number to set the total. All three boxes work this way, and Current HP won't run past your maximum or below zero.",
    "Short and Long Rest and your Hit Dice have moved into their own Rest & Recovery card, just below Vitals. Hit Dice used to be listed twice in two different places; now it's in one.",
    "Hit Dice are easier to read: one line per die size showing how many you have left in words, and a labelled Roll button. While they're set automatically from your class the text box is hidden, since it only repeated what the dice below it already said — switch to manual and it comes back.",
    "Vitals is tidier: Inspiration is a star in the card's heading rather than a box of its own, and the death saves now read as failures, a skull, then successes, centred under the HP buttons. Both sets fill outward from the skull.",
    "Fixed: the HP minus button could take you below zero.",
    "Every section of your sheet can now hold a note. Tap the little page icon beside any heading on the Sheet, Spells, Inventory or Story tabs and jot down whatever you need — the icon lights up when there's something there, and hovering it shows you what without opening anything.",
    "Notes understand a bit of formatting: bold, italics, code, headings, bullet and numbered lists, quotes and dividers. Rules terms you know stay tappable inside them, same as everywhere else.",
    "New Notes tab: every note you've written, grouped by the tab it came from, each with a link that takes you straight back to the section it belongs to. Notes print with your sheet too.",
    "The tab bar switches from words to icons when the screen gets narrow, and there's a new Icon tabs switch in Settings if you'd rather have icons all the time.",
    "The Inspiration star is bigger and easier to hit.",
    "Fixed: equipment handed to you by a class or background arrived with no gp value, so your inventory total was wildly wrong. It also brings its category across now. For characters you already have, run Check for rules updates in Settings and it will fill the missing values in.",
    "Fixed: items that weren't weapons or armour all piled into Loot instead of Gear, Tools or Consumables. Gear you add from now on files itself properly.",
    "Fixed: the Tables tab was empty when you reopened the app, even with a rules pack loaded — the tables were there, nothing had drawn them, and typing in the filter box made them appear. It also means the tab now tells you how to import tables when you have none, instead of showing nothing.",
    "The update notice now takes the version number's place in the top bar instead of stranding itself at the other end of it. Hover it to see which version is waiting and which one you're on, and tap it for the release notes and the download."
  ]},
  {v:"1.3.1", date:"2026-08-10", notes:[
    "**Fieldbook now tells you when your rules data needs updating — and when it doesn't.** Most updates change the app but not the rules, and re-importing packs you already have is a chore. Each pack now records which release its contents came from, and Settings → Rules data shows it: an **update available** badge if a newer version of that pack exists, and nothing at all if you're current. Release notes say the same thing up front, naming only the packs that actually changed — so if you play D&D and only the Humblewood data moved, you'll be told to skip it."
  ]},
  {v:"1.3.0", date:"2026-08-10", notes:[
    "Character library: the delete button on each character card is now vertically centred instead of sitting at the top of the row, matching the autoload star.",
    "Character library: an **Import** button now sits beside **New character**, so you can load a saved character file straight from the home screen without opening a sheet first. If the file matches a character you already have, you are still asked whether to replace it or import it as a copy.",
    "Update check: the app now looks for new versions on GitHub. When a newer release is published, an **↑ Update** pill appears in the top bar linking to the download page. It only checks when you are online and fails silently otherwise, so the app still works fully offline.",
    "**Tables.** Rules tables now display properly. A new **Tables** tab lists every table in your loaded rules — roll tables, class progressions, and the lookup tables the rules keep referring to — with a filter box. Wherever a spell, item, feat, or class feature mentions one of them, the table's name is highlighted in the text: tap it to open the table right there without leaving what you were reading. Class and subclass views also link to their own level-progression table. Tables come from your rules pack, so import an updated pack to get them; descriptions still read normally if you haven't.",
    "Rules data: the packs now cover the **whole** 2024 Player's Handbook rather than just the free basic-rules subset — **77 feats instead of 17**, 99 base items instead of 78, and 528 magic items instead of 440. Class and subclass features that the rules text referred to but that were missing entirely (such as the Sorcerer's Wild Magic Surge) are now present too. Nothing that was already there has been removed.",
    "**D&D 2024 species are here.** All ten — Aasimar, Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, Tiefling — with their traits, speeds and skill choices. Lineages are proper choosers rather than paragraphs to read: pick Drow, High Elf or Wood Elf for an Elf, one of six giant ancestries for a Goliath, a fiendish legacy for a Tiefling, or a damage type for a Dragonborn.",
    "**One file per game.** The download now contains `5e2024_full.json` and `humblewood_full.json` instead of sixteen separate files — import one and you have everything for that system. They show up under a **Rulebook** heading in Settings so you can tell them from individual packs, and you can still import single category files if you prefer to pick and choose.",
    "The ancestry list now matches the game you're playing: a D&D character is offered D&D species and a Humblewood character is offered Humblewood ones, instead of both lists jumbled together. Your own homebrew ancestries still show up for both, and an existing character keeps whatever ancestry it already has.",
    "Settings → Rules data now groups what you've loaded by what it contains — Spells, Species, Classes and so on — instead of one long undifferentiated list.",
    "**Clear all** now asks before it unloads your rules data, tells you what it's about to remove, and confirms that your characters aren't affected. It also updates the list immediately instead of leaving already-removed packs on screen. There's now a Clear all on the home screen too.",
    "**Characters remember which version of Fieldbook they were last checked against**, shown as a small version badge on each card in your character list. It turns gold when there may be updates waiting.",
    "**Rules updates for existing characters.** When you open a character that predates your current rules data, Fieldbook offers to compare the sheet against your loaded packs and shows exactly what differs — a feat whose wording changed, a spell that was corrected, a class feature that was missing. Tick the ones you want, leave the rest, or just carry on playing as-is. Anything you've hand-edited yourself is flagged and left unticked so an update can't quietly overwrite your own wording, and entries that can't be matched with confidence are shown but never changed. **Nothing is ever deleted**, and your own numbers — quantities, what's equipped or prepared, uses spent, hit points — are never touched.",
    "**Updating always saves a backup first**, as a separate entry in your character list named after the character with \"(backup)\" and the version appended. If you don't like the result, load the backup; when you're happy, delete it from the home screen.",
    "You can run the check any time from **Settings → This character → Check for rules updates**, even if you dismissed the prompt.",
    "**Coins can be added and spent without doing the sums.** Type **+10** or **-5** into any coin box and it adjusts what's already there instead of replacing it; a plain number still just sets the amount. For a purchase across several denominations there's a new **Adjust** button beside Auto-convert — enter what you gained or spent for each coin at once, see the resulting totals before you commit, and it won't let you spend coins you don't have.",
    "**A level 1 character's max HP is filled in for you.** Add your first class at level 1 and Fieldbook sets Max HP to the hit die's maximum — a d8 class starts on 8, at full health. It only ever fills in a blank, so a number you typed yourself is left alone, and it doesn't apply when you multiclass or start above level 1, where the HP you gain is yours to roll.",
    "The updates list now has **Select all** and **Select none** buttons, with a running count of how many are ticked, so you don't have to click through a long list one row at a time. They only touch rows that can actually be applied — greyed-out ones stay as they are.",
    "**A full browser can no longer stop you updating.** If Fieldbook can't keep the backup in the app, it now tells you why and offers to download it as a file instead, then carries on. Previously it just refused and did nothing. It also no longer reports success when the backup saved but didn't make it into your character list — that could send you looking for a backup that wasn't there.",
    "**Humblewood text now matches the book.** Every core species, background, subclass feature and feat has been re-taken from the official 2024 Player Character Options document word for word. The text you were reading before was a paraphrase, and in places it had quietly lost things — a dozen traits were missing entirely, including each species' Lineage trait (Corvum Lineage, Gallus Lineage, and so on), the Raptor's Hunter's Training, and two Mistral Raptor traits.",
    "**Every Humblewood playtest packet is now in your rules data.** Two years of monthly releases, folded in: **ten new species** — Talpo, Vesper, Rhopala, Roden, Porchini, Almare, Arkton, Lunin, Pexian and Mustel — plus new lineages for species you already had, including the **Marshfoot Gallus**. Each comes with its full trait list and lineage choices.",
    "**Six new subclasses**: the Fighter's Workhand, the Bard's College of Courtly Jests, the Warlock's Whispering Wind patron, the Rogue's Burrowskulker, the Barbarian's Path of the Corsair, and the Monk's Way of the Wrangler — each with its features at the right levels.",
    "**Seven new backgrounds**: Ambassador, Underscout, Courtier, Seaborn, Stonesinger, Warrenborn and Wonderstruck. Four of them bring their d8 Personality Trait, Ideal, Bond and Flaw tables with them, so you can roll your character's characteristics in the Tables tab.",
    "**The playtest text now matches the packets word for word.** Every playtest species, subclass, feat and the whole Gadgeteer class had been rewritten in shorter form at some point, and the spells worst of all — most ran barely half the length of the printed text, losing details as they went. All of it has been re-taken from the source. A stray \"(Humblewood 2 Playtest.)\" that had been appended to a dozen descriptions is gone too.",
    "**Humblewood has reference tables too.** 35 of them: Random Height and Weight, Standard Languages, the Community and Night Domain spell lists, and every background's d6/d8 Personality Trait, Ideal, Bond and Flaw table, plus Bandit Specialty, Community Place and Acceptance. They appear in the Tables tab, and each background, species and subclass links to its own from its info panel."
  ]},
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
/* When an update is waiting the changelog is the only route to it — the pill
   took the version button's place — so the modal leads with the download rather
   than burying it under the history. Empty when there is nothing to offer. */
function updBannerHTML(){
  if(!updateAvailable)return "";
  return `<div class="updbanner"><div><b>Version ${esc(updateAvailable.ver)} is available.</b>`+
    `<div class="hint">You're on v${esc(APP_VERSION)}. Your characters and rules data are unaffected — you just replace the file.</div></div>`+
    `<a class="tbtn primary" href="${esc(updateAvailable.url)}" target="_blank" rel="noopener">Download</a></div>`;
}
function openChangelog(){
  const body=updBannerHTML()+`<div style="max-height:60vh;overflow:auto">`+CHANGELOG.map(e=>`<div style="margin-bottom:14px"><div style="font-family:var(--head);font-weight:800"><span style="color:var(--accent)">v${esc(e.v)}</span> <span class="hint" style="font-weight:400">${esc(e.date||"")}</span></div><ul style="margin:6px 0 0;padding-left:18px">${e.notes.map(n=>`<li style="margin:3px 0">${esc(n)}</li>`).join("")}</ul></div>`).join("")+`</div><div class="m-actions"><button class="tbtn primary" id="clOk">Close</button></div>`;
  openModal("Fieldbook v"+APP_VERSION,body);
  const b=document.getElementById("clOk");if(b)b.addEventListener("click",closeModal);
}
