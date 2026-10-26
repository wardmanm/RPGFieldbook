# Settings & updates

The Settings modal (the cog in the top bar) and the app's ways of saying something newer is out: the
version button, which opens the in-app changelog, the **update pill** that takes its place when
GitHub has a newer release, and the **Extensions pill** when a source offers newer packs (#102).
Settings holds the look of the app, the open character's own options, **Extensions** — the rules
packs that are loaded or offered, where they come from, which have updates, and installing them —
backup of settings and rules, and the credits that the icons and the loaded packs require.

**Code:** `SET_PAGES`, `setPageOf()`, `setNavHTML()`, `setPageHTML()`, `setRowHTML()`, `tabsGroupHTML()` (#52), `rulesNavBadgeHTML()`, `openSettings()`, `encSettingsHint()`,
`rulesStatusText()`, `updateRulesStatus()`, `refreshRulesUI()`, `loadedRulesGroups()`,
`removeRulesGroup()`, `clearAllRules()`, `dataStatus()`, `dataUpdateFor()`, `dataStatusHTML()`,
`rulesCacheWarning()`, `rulesBadge()`, `rulesCreditsHTML()`, `SETTINGS_KEYS`, `foldLegacySettings()`, `readSettingsFile()`, `importSettings()`,
`rulesPackSummary()`, `settingsImportQuestionHTML()`, `askSettingsImport()`,
`finishSettingsImport()`, `settingsImportStatus()` in `88-settings.js` ·
`renderRulesData()`, `rulesDataHTML()`, `dataUpdateHint()`, `fetchAllRules()`, `fetchRulesFrom()`,
`applyFetchedSource()`, `importRulesFiles()`, `poolFromExport()`,
`requiresStatusHTML()` in `89-rules-merge.js` · `extPageHTML()`, `extSecHTML()`, `extRowHTML()`, `extChipsHTML()`,
`extReqChip()`, `extReqTap()`, `extSourcesHTML()`, `extDetailsHTML()`, `openExtDetails()`, `renderExtUI()`,
`extFocusTargets()`, `wireExtPage()`, `extUpdateFromRows()`, `extPlanHTML()`, `extPlanRow()`, `openInstallPlan()`,
`extInstalledText()`, `openManualInstall()`, `extManualPlan()`, `extSkippedNote()`, `extWireDrop()`, `extDropZone()`,
`renderExtPill()`, `extPillCount()`, `dismissUpdates()`, `extPillFocusBack()`, `extTooNewWhy()` in
`89-extensions.js` · `rulesUpdatePending()` in `88-settings.js` · `saveSettings()` in `70-persistence.js` · `APP_VERSION`, `DATA_VERSIONS`, `UPDATE_REPO`, `CHANGELOG`, `cmpVer()`,
`cmpDataVer()`, `checkForUpdate()`, `showUpdatePill()`, `updBannerHTML()`, `openChangelog()`,
`pickDataRelease()`, `dataUpdateFrom()`, `checkForDataUpdate()` in `30-version.js` ·
`boot()`, `wire()` in `90-boot.js` · `release.js`, `data-release.js`, `gen-changelog.js` in
`scripts/`; `bundle()` in `tools/data-kit/fbdata.py` · **Data:** `data/packs.json`
· **Tests:** `rules-data.js` (the modal's ids both ways, the pages and their fallbacks, `dataStatus()`, a
plain source's fetch, the sidebar's Extensions badge, the Extensions page's hooks, and Import settings
driven through its real handler), `data-archive.js` (the #102 page, dialog, plan, Manual install and
pill sections against a fake DOM and a stubbed network, every manifest string escaped, the
`update` state, the hint line, the badge's suffix, `pickDataRelease()`, `dataUpdateFrom()`,
`checkForDataUpdate()` against a stubbed network, and the credits list escaping hostile text),
`char-update.js` (`cmpVer()`, `updBannerHTML()`) · **See also:**
[Rules packs](../architecture/rules-packs.md), [Data archive](../architecture/data-archive.md),
[Storage](../architecture/storage.md),
[Rules-update tool](rules-update-tool.md), [Ammunition](ammunition.md),
[Theming & icons](../ui/theming-and-icons.md),
[RELEASING](../../RELEASING.md)

## How it works

**The dialog.** `openSettings()` opens a wide dialog (`openModal(…, {wide:true})`, see
[Shell](../ui/shell.md)): a sidebar of categories beside one page at a time (#107). The sidebar is
`setNavHTML()` over `SET_PAGES`, a vertical tab list; each page is `setPageHTML()`, its tab panel.
Every setting is one row (`setRowHTML()`): its name and one line of help on the left, its control in
a right-hand column, under small group headings (`setGroupHTML()`). The control follows one rule:
on/off is a switch, two or three short choices are segmented buttons, a longer list is a dropdown,
and actions are buttons.

| Page | Groups and settings |
|---|---|
| **Appearance** | *Look:* skin (changing it with a character open also sets its `system`), mode (system/light/dark), hand-drawn borders. *Interface:* icon tabs, "Tap outside to close dialogs" (`settings.backdropClose`, off by default, #106; see [Shell](../ui/shell.md)) |
| **Sheet display** | Only with a character open, titled "For *name*". *Cards:* skills display, Hit Dice display, colour current HP, the Trackers card. *Ammunition* (#104): "Ammo recovery" — Half (rules as written) / All / Hits only / None, writing `character.ammoRecovery`. *Inventory* (#47): "Inventory log size" — 100 / 250 / 500 / 1,000 / 2,500 (`INV_LOG_SIZES`), through `setInvLogSize()`, which writes `character.invLogSize` and trims `character.invLog` at once: a smaller size that would drop lines first asks "Keep the newest 100? This removes 2,400 older lines.", and declined, the size and the select stay as they were (see [Inventory](inventory.md)). *Tabs* (#52): one switch per word tab, writing `character.hiddenTabs` |
| **Carrying** | Only with a character open, titled "For *name*". *Size and weight:* size (a dropdown), encumbrance (segmented: Off, Standard, Variant), coins count as weight, and the live "carrying X of Y" line (`encSettingsHint()`) |
| **Extensions** (Rules data until #102; a stored `setPage:"rules"` opens it) | The updates banner, *Rules data*, *Unsupported* (only when something is in it) and *Sources*, each a folding section (below); then the status line, and *This sheet* (with a character open): the rules-update check, with the version the sheet was last checked against |
| **Backup** | *Characters:* the character library. *Settings file:* Export and Import, and the status line that says what an import did (`#setImpStatus`) |
| **Credits** | The game-icons.net attribution CC BY 3.0 requires, in the app because `fieldbook.html` travels as a lone file (see [Theming & icons](../ui/theming-and-icons.md)); then "Rules data you have loaded" (`rulesCreditsHTML()`): each loaded pack that states a licence or a credit, as its title, its attribution and its licence. `CC-BY-4.0`, `CC-BY-SA-3.0` and `MIT` link to their licence pages; any other id is plain text; everything is escaped. The list is left out when no loaded pack has a credit. The credits come from `rules.credits` (see [Data archive](../architecture/data-archive.md)) |

The sidebar lists Sheet display and Carrying under a "This character" caption, set apart from the
rest. Extensions carries the entry count, and a dot while an update is pending
(`rulesNavBadgeHTML()`, whose count's tooltip is `rulesBadge()`): `rulesUpdatePending()`, a loaded
pack the data check calls `update`, or any update a source offers (`extUpdateRows()`). The pill's ×
clears only the pill: the dot stays until the update is installed (Ruling 15). `renderRulesData()` and `renderExtUI()` redraw it, so it follows
installs, fetches, removals, Remove all and both checks whichever page is showing. When
Icon tabs is on (`html[data-tabs="icons"]`) or the screen is 640px wide or less, the sidebar is a
52px rail of icons, each named for a screen reader and given a tooltip; on a narrow screen a
segmented control or dropdown drops below its name while a switch stays beside it. Every switch is
`role="switch"` with `aria-checked`, kept true by one click listener on the wrapper.

**The Tabs group (#52).** Sheet display's last group, only with a character open: a
`<p class="hint">` ("Hide the tabs this character doesn't use. Sheet always shows.") opens the
group's body, the way the old Sources and Loaded data groups did before #102, above
one `setRowHTML` switch per `HIDEABLE_TABS` entry (`tabsGroupHTML()`), labelled with the tab's own
word — Spells, Inventory, Bio, Journal, Rules — on meaning shown. The Journal row carries its own
help, "Also holds the Section Notes card.", since hiding Journal also hides that card and Trackers
([Journal](journal.md), [Story & notes](story-and-notes.md)) — the other four rows have no help of
their own. The Sheet and the combat swords are not listed; they can't be hidden
([Shell](../ui/shell.md)). Its id is `swTab-<name>`, `data-tabsw="<name>"`, and a per-button click
handler (`88-settings.js:228-232`) calls `setTabHidden()`, which updates `character.hiddenTabs`,
repaints the bar (`applyHiddenTabs()`) and saves — the `swFamiliars` pattern.

**Which page opens.** Every shown page is built when the dialog opens and all but one are
`hidden`, so every control keeps its id and its handler, and the lists keep refreshing behind any
page. A tab click, or ↑/↓ (wrapping, over the shown pages only, `setPageStep()`), Home and End on a
focused tab, shows its page, scrolls the body to the top and stores the key in `settings.setPage`.
The next open shows `setPageOf(settings.setPage, hasChar)`: the stored page while it is shown, else
Appearance — so a character page remembered from a sheet never opens with no character. The
delegated listeners bind to `#setSections`, which is rebuilt on every open. The dialog keeps one
height, 680px or nine-tenths of the screen if that is less, so a short page never shrinks it and
moves the sidebar, and the sidebar and the page each scroll on its own inside it (`.m-body` does
not), so on a landscape phone every tab stays reachable.

**The Extensions page (#102).** `extPageHTML()` draws it, and `renderExtUI()` repaints it in place
after anything changes, keeping a URL being typed and keyboard focus (`extFocusTargets()`: the same
control by id or `data-ext-*` key, else Sources' URL box or the section's toggle). `wireExtPage()`
binds one delegated click listener to each fresh `#extPage`. From the top:

- **Warnings**, in red: a rules cache save that failed (`rulesCacheWarning()`), and a sources save the
  boot check couldn't make ("Couldn't save your sources at the last check: …").
- **The updates banner**, while any row is an update: "**2 updates** · SRD 5.2, Homebrew" and
  **Update all**, which plans every update at once. The pill's × never hides it.
- **Rules data**, with a count: one row per loaded pack (`loadedRulesGroups()`), then one per pack an
  enabled source offers that isn't loaded (`extPackRows()`). A row has the pack's **name**, a button
  that opens its details; the "v*A* · v*B* out" or amber stale chip (only where no source offers the
  pack) and the red "! N missing" chip; its manifest `summary`, or for a pack no manifest describes,
  its contents ("1 spell · 3 classes"); where it is from ("from *source*" when that source installed
  it, "imported from a file · *file*", "fetched from a source URL", or "from *source* · not
  installed"), and on an update offered by a source that didn't install the pack, "· update from
  *source*"; its chips (below); its version, or "*have* → **new**"; **Update** or **Install**; and
  a delete button for a loaded pack, which confirms with the entry count. The header's **Remove
  all** is the old Clear all (`clearAllRules()`), shown while anything is loaded.
- **Unsupported**, only when a source offers a pack of a category this app doesn't install: listed,
  never installable.
- **Sources**, with a count: Fieldbook public data, "built in · checked *time*", with its switch
  (switching it on checks it); each manifest source as "*name* (*host*)", "*host/path* ·
  checked *time*" or, in red, "couldn't check: *reason*", with **Remove**; each plain source with
  **Fetch** and **Remove**. Below: the URL box and **+ Add a source URL**, then **Check now** and
  **Manual install…**. The header's **Remove all** removes every added source and switches the
  official one off, after a confirm; installed packs stay.

**How a source is named.** A manifest names itself, so anyone can publish one called "Fieldbook
public data". `extSourceName()` gives every manifest source as "*name* (*host*)", the host taken from
its URL (`extSourceHost()`), wherever a source is named: the rows, the plan, the details' Source box,
"Also from *source*" and Sources. Only the built-in official source reads the bare "Fieldbook public
data". A plain source is named by its URL. Without signing, that host is the player's only sight of
who is offering a file (#102 final review I2, Ruling 16).

Every section folds from its header (`extSecHTML()`, `aria-expanded`), remembered in
`settings.setCollapse` under `ext:<section>`. The status line, `#rulesStatus`, is a `role="status"`
live region that sits outside `#extPage`, so a repaint never recreates it. It says what Add
("Source added.", or why not), Check now ("Checking your sources…", then "Checked." or "Checked. 1
source couldn't be checked; the row says why.", or offline "You're offline, so nothing was
checked."), Remove and a failed save did.

**Chips.** A blocked or unsupported pack shows "**requires Fieldbook *X***" when its `minApp` is newer
than this app, else "requires a newer Fieldbook" (`extTooNewWhy()`, Ruling 2). A requirement that
isn't loaded is a "**requires *X***" chip (`extReqChip()`): a button that opens *X*'s details when a
source offers it (it carries the requirement's file, so a tap opens that file's offer), a link
opening its `url` in a new tab when the requirement has one, or a dashed plain label. A tappable chip
is small to see and 44px to tap.

**The details dialog** (`openExtDetails()`, from a pack's name): "Rules data · *version* ·
installed / not installed", the full `description` as escaped paragraphs (or the summary, or the
contents line), the chips, a **Source** box (name, manifest, homepage as a link, last checked,
licence and attribution; or "Imported from a file: *file*"), and **Also from *source***, each a
button to its own details, a blocked one with its "requires Fieldbook" note. The foot has **Close**,
back to Settings → Extensions, and **Update** or **Install** when that applies. A pack no longer
listed says so, with Close.

**The plan dialog** (`openInstallPlan()`). Every Update, Install and Update all, and Manual install,
opens it over Settings: one row per line of `planInstall()` (see
[Rules packs](../architecture/rules-packs.md)), each with a checkbox, the title, the versions
("1.0.0 → 1.1.0"), the size, and "New / Update / Replace / Same version / Older than yours", any
"needed by *X*" or "Replace anyway", and where it comes from ("from QA Workshop (qa.example)", "from a file"), or
a blocked line's "requires Fieldbook" chip. An update offered by a source other than the one that
installed the pack (a file, or another source) reads "Update from *name (host)*" instead of
"Update · from …". Only install and update lines start ticked; **Install
N** counts the ticks. With nothing installable it says so and offers only Close. While the install
runs, the ticks, Cancel and Install are disabled and the dialog can't be dismissed: × and Escape do
nothing, and the status says "Installing… please wait." (`setDismissGuard()` returning `true`,
Ruling 14). A failure keeps the dialog, says "Nothing was installed: *file* — *reason*.", and
re-enables it. Success toasts "Installed 2 packs" (with what was skipped, and a save error, which
makes it an error toast that stays) and returns to Settings → Extensions.

**Manual install** (`openManualInstall()`): one sentence of help, **Choose files** (json and zip,
several), **Choose a folder** (`webkitdirectory`), a drop zone, and Close. Files, a zip or whole
folders dropped on the dialog, or on the Extensions page while it shows (`extWireDrop()`, one
listener on `#modal`, active only while a drop zone is on show), go the same way; the zone is
outlined while something is dragged over. Only `.json` and `.zip` files are read, at most 2,000; the
plan then notes, in red, the first five files it couldn't use and why, how many more, and how many
weren't read. A drop holding none toasts "Nothing to install: drop rules packs (.json) or a data
zip." The home screen's import button and the Rules tab's import links open the same plan.

**The Extensions pill (#102).** `#extPill` in the top bar reads "**Extensions · N updates**" ("**N
updates**" at 560px and under), N being `extPillCount()`: the update rows whose offered version is
newer than the one the player cleared. It opens Settings → Extensions. Its **×**
(`dismissUpdates()`) writes each update's offered version to `settings.dismissedUpdates` under
`system|file` and hides it until a newer version arrives; a cleared value that isn't a readable
version never hides anything. The page's rows, banner and Update all are unaffected.
`renderExtPill()` runs at wire time, from the manifests saved at the last check, and after every
repaint. Up to 560px, the notices move after the top bar's buttons, onto a row of their own (see
[Shell](../ui/shell.md)). After either ×, focus goes to the version button if it shows, else Home
(`extPillFocusBack()`), and a save that doesn't land toasts the error.

**Pack badges.** `dataStatus(g)` compares the pack's `_dataVersion` (its `dataVersion`, stamped at
merge by `mergeRules()`) with `cmpDataVer()`, first against `DATA_VERSIONS[source]` and then against
the newer-data check's copy of the same system and file name (`dataUpdateFor()`):

- **stale** — older than `DATA_VERSIONS`: an amber "update available · v*X*" chip whose tooltip says
  to re-import from the latest release.
- **update** — not stale, but a data release has a newer copy: a muted "v*A* · v*B* out", its
  tooltip naming the data release and saying to install it with Manual install. On the home screen
  one hint line above the list, "Newer rules data is out: SRD 5.2 v1.8.0-1. Download it from the
  release page." (`dataUpdateHint()`), links the release. On the Extensions page the chip shows only
  where no source offers the pack, since an offer says the same with an Update button.
- **current** — a quiet "v*X*".
- **known** — a readable version, but no `DATA_VERSIONS` baseline for its system and no data-release
  copy to compare against: a private pack, or an old pack (XPHB, Humblewood, XGE, TCE) a build after
  #85 no longer ships a baseline for. Shown exactly like **current** — a quiet "v*X*" — because there
  is no evidence either way, not nothing: a v1.7.2 player upgrading with an old pack still loaded sees
  its version, never silence and never an alarm.
- **unknown** — no stamp at all, or a stamp that doesn't parse: nothing shown.

`DATA_VERSIONS` is the snapshot of `data/packs.json` that `release.js` took when this build was
released; `fbdata.py bundle` stamps each pack from the registry (see
[Rules packs](../architecture/rules-packs.md)).

**Export settings** writes `{_type:"fieldbook-settings", settings, rules}`: the whole `settings`
object *and* the whole rules pool as it stands, every entry with its provenance stamps. The shape
has not changed since the first commit.

**Import settings** never replaces loaded rules without asking. `readSettingsFile()` takes that
shape, or the older bare settings object. A bare object must carry at least one of `SETTINGS_KEYS`,
so a rules pack or a character chosen by mistake is refused ("Not a valid settings file.") rather
than written into `settings`. The file's pool is rebuilt through `mergeRules()` by
`poolFromExport()` (see [Rules packs](../architecture/rules-packs.md)). It is never assigned as it
came. Then:

- **The file carries no readable rules** (no `rules` key, an empty pool, or nothing in it that
  loads): the settings import, nothing is asked, and the pool and the cache are untouched. The status
  says whether the rules were absent or could not be read.
- **Nothing is loaded yet:** the file's rules load with the settings, unasked, because nothing can be
  lost.
- **Otherwise it asks** (`askSettingsImport()`), in a window with three answers, like the
  character-import clash. **Cancel** changes nothing and returns to Settings, as ✕ and Escape do.
  **Keep my rules** imports the settings only. **Replace my rules** imports both. The window
  (`settingsImportQuestionHTML()`) shows the file's rules and the loaded ones, each as "N packs, M
  entries" with every pack's count and data version. It then says in red what replacing loses:
  each loaded pack the file does not have, and any it would put back an older copy of (by
  `cmpDataVer()`, so `1.8.0-1` is older than `1.8.0-2`). It says
  characters are not affected either way.

`finishSettingsImport()` applies the answer. It runs `foldLegacySettings()` (`convertSources()`, as
at boot: an old file's `rulesSources` and `rulesUrl` join the current sources as plain sources,
while a newer file's `sources` replace them), saves, and redraws what boot redraws after loading the
cache: `refreshRulesUI()`, `renderAll()` and `renderHome()`. Then it reopens Settings, which brings a
fresh rules status line, Extensions badge and Extensions page. What happened is written on the
status line beside the Import button, because the rules status line sits on the Extensions page,
which is usually not the one showing. A refused settings write ("Settings imported for this session only:
…") and a refused cache write both land on that line.

**The version button and changelog.** `#btnVer` reads `v` + `APP_VERSION` and opens
`openChangelog()`: a modal titled with the version, listing every `CHANGELOG` entry. The array is
written only by `release.js` from `src/docs/UNRELEASED.md`, and `docs/CHANGELOG.md` is regenerated from
the built file by `gen-changelog.js` on every build — see [RELEASING](../../RELEASING.md).

**The update check.** The last thing `boot()` does is `checkForUpdate()`. It returns at once when
`UPDATE_REPO` is empty or `navigator.onLine === false`; otherwise it asks
`api.github.com/repos/<repo>/releases/latest`, treats a non-OK answer as nothing, and swallows every
error. A tag newer by `cmpVer()` (a `v` prefix ignored, three numeric parts) sets `updateAvailable`
and `showUpdatePill()` hides `#btnVer` and shows `#updatePill` — "↑ v*X*", with the version you are
on in its tooltip. The pill is a `<button>` that opens the same changelog, which then leads with
`updBannerHTML()`: the new version and a Download link to the release page. The link is the
response's `html_url` only when that is a `https://github.com/` page, and the repo's releases page
otherwise, because it becomes an `<a href>`. The pill has a **×** (`#updatePillX`, #102): it stores
the version in `settings.dismissedUpdates.app`, hides the pill and brings the version button back,
and `showUpdatePill()` stays quiet for that version or an older one until a newer release arrives.

**The source check** (#102), `checkSources({boot:true})`, is the last call in `boot()`: it reads
every enabled source's manifest, quietly, and repaints the page and pill (see
[Rules packs](../architecture/rules-packs.md)).

**The newer-data check.** Right after it, `boot()` calls `checkForDataUpdate()`, which skips under
the same two conditions. A data-only release is never GitHub's "latest", so `checkForUpdate()` never
sees one. This lists `api.github.com/repos/<repo>/releases?per_page=100`, and `pickDataRelease()`
takes the newest by `cmpDataVer()` that is not a draft or pre-release, has a `vX.Y.Z` or
`data-vX.Y.Z-N` tag, is built for this app or an older one (its base no newer than `APP_VERSION`),
and carries its `fieldbook-data-standalone-<version>.zip`. It then reads that tag's `data/packs.json`
from `raw.githubusercontent.com`, and `dataUpdateFrom()` keeps only well-formed packs. The result is
`dataUpdate`, and `renderRulesData()` redraws the rows, the hint and the badge. Packs the player
hasn't loaded are never mentioned. Every failure is silent; the link, like the pill's, is a
`https://github.com/` page or the releases page.

## Rules that must hold

- **Every page is built when the dialog opens; switching only shows one.** A control on a hidden
  page keeps its id and handler, and `renderRulesData()` refreshes the list and the badge behind any
  page. `settings.setPage` is read through `setPageOf()`, never trusted: a stored key that is not a
  shown page opens Appearance, and a stored `rules` opens Extensions. Of `settings.setCollapse`,
  only the Extensions page's `ext:` keys are read.
- **The wide dialog keeps one height, and its two panes scroll apart.** A shorter page otherwise
  shrinks it, it re-centres, and the sidebar moves under the pointer between clicks; a sidebar that
  shares one scroller with the page was cut off on a landscape phone until the page reached its end.
  The page pane keeps 14px of right padding and a stable scrollbar gutter, or its scrollbar (an
  overlay one draws over content) sits on the controls at its right edge.
- **Delegated listeners bind to something rebuilt with the modal**, never to `#mBody`, which outlives
  every modal and would stack one copy per visit.
- **Every id `openSettings()` looks up exists in the markup it builds, and every id it renders is
  wired** — `rules-data.js` parses the function's own source and checks both directions.
- **The update check is optional and silent.** No network, no repo, rate-limited, private repo: no
  pill, no error, nothing else changes. The newer-data check is the same.
- **A newer data release is a quiet notice, never the amber chip.** A data release is optional; a
  pack behind the app it is loaded in is not.
- **The changelog stays reachable while the pill is up** — the pill replaced the only other way in.
- **`updBannerHTML()` escapes the release tag**; it comes from the network.
- **An unknown data version is not stale.** A false alarm on someone's own content is worse than
  silence.
- **Never hand-edit `APP_VERSION`, `DATA_VERSIONS`, `CHANGELOG`, or the versions, digests and
  `release` in `data/packs.json`**; `release.js` owns the first three, `release.js` and
  `data-release.js` the registry's, and `APP_VERSION` must only ever rise or the update check breaks.
- **A plain source's Fetch never loses what is loaded**, and a run where nothing arrives says
  "nothing changed" and writes neither the pool nor the cache. It is offline-first: failing is the
  expected case.
- **Every manifest string is escaped where it is drawn,** and only an http(s) URL becomes a link
  (`rules-data.js` and `data-archive.js` feed hostile text through the page and the dialog).
- **A notice's × hides the notice, never the update.** The banner, the row's Update and Update all
  stay; the notice comes back only for a newer version than the one cleared.
- **The plan can't be dismissed while it installs,** and nothing in it can change.
- **Import settings never replaces loaded rules unasked**, and the rules a settings file carries go
  through `mergeRules()` like every other load. A file with no readable rules never asks and never
  touches the pool or the cache. Dismissing the question changes nothing.
- **Credits paragraphs stay one source line each**: `.m-body p` is `white-space:pre-wrap`, so a wrapped
  line renders its newline and indent.

## Traps

- **A silently dead control.** Moving markup between template literals renamed or dropped an id, the
  handler's `getElementById` returned null, and the control stopped working with no error — hence the
  two-way id test. → L1741
- **The pill looked mispositioned** because `.verbtn` carries `margin-right:auto`, pushing everything
  after it to the far end. It was downstream of the spacer, not misplaced; now it takes the version
  button's slot and the same margin. → L1779
- **Hiding `#btnVer` would have stranded "What's new"**, the changelog's only entry point. → L1779
- **The status line lied.** Offline, Fetch all emptied the pool and then said "Kept what loaded"
  directly above "No rules data loaded", while the section chip still counted 2151 entries. → L3797
- **Import settings emptied the pool without a word** (#70). It ran `rules=p.rules`, so every pack
  imported or fetched since the export went, and a keyword with `name` for `term` went in raw and
  broke every render after. → L4134
- **The phone header ran ragged** (#102). With the pills in the first row, a × pushed the save state
  and Home onto a row apart from their buttons at 481–560px; up to 560px the notices now take a row
  after the buttons. One auto margin, on the save state, keeps the version and pills packed left;
  one per pill floated the Extensions pill mid-bar.
- **A × that reached left took its pill's taps.** The 44px hit area extends right, up and down only,
  since the pill it clears sits 2px to its left.
- **The badge first needs a release newer than the app**, and an unauthenticated call to a private
  repo 404s, and the `r.ok` guard turns that into a silent no-op. → L527

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How to tame the long Settings dialog (#107) | A sidebar of six pages: Appearance, Sheet display, Carrying, Rules data, Backup, Credits | Folding sections (2026-08-11 to #107): one long scroll, "This character" held ten controls of four kinds. The five sections as sidebar entries: that page would stay cluttered. Splitting by scope (General, Character, Data, About): longer pages |
| How a setting looks (#107) | A row: name and help left, control right; on/off a switch, two or three short choices segmented, longer lists a dropdown | Everything a dropdown, as the reference showed: on/off and Light/Dark would take two taps. Grouping by control type: settings that belong together end up apart |
| The icon rail on a phone (#107) | On the left, as on a desktop | An icon strip across the top: more width, but a second layout to learn |
| How the pages are built (#107) | All at open, one shown | Only the visible one: every handler rewritten into per-page binders, for nothing a player sees |
| When a change applies (#107) | Instantly, as before | Save and Cancel, as the reference showed: a new behaviour nobody asked for |
| Which page opens (#107) | The last one viewed, falling back to Appearance | Always Appearance: a player tweaking one page has to find it again every time |
| Where the delegated listener lives | `#setSections` | `#mBody`: survives every modal, so listeners stack per visit |
| Version button and update pill | One control: the pill takes the button's slot | Both side by side: they say the same thing, and the spacer pushed the pill away |
| What the pill opens | The changelog, led by a download banner | Linking straight to GitHub: "What's new" would be unreachable while an update is pending |
| The pill's element | A `<button>` | An `<a>` with a live `href` that `preventDefault`s: a lie about what it does |
| Where the changelog lives | Embedded in `30-version.js`, keeping the single-file offline design; `docs/CHANGELOG.md` is generated from it so the two cannot drift | — |
| Where icon credits live | In Settings | Only in the README: the app is routinely shared as a lone file no README follows |
| Where the Download link may point | A `https://github.com/` page from the response, else the releases page | Whatever `html_url` holds: it becomes an `<a href>`, and a `javascript:` there would run on click (L3940) |
| How Import settings asks about loaded rules | A window with three answers: Cancel, Keep my rules, Replace my rules | `confirm()`: OK/Cancel carries two outcomes, and making Cancel mean "settings only" would have Cancel import something (L4134) |
| When Import settings asks | Only when the file carries readable rules and some are loaded | Always: a question with nothing to lose is noise. Never: the #70 bug (L4134) |
| A settings file with an empty pool | Treated as carrying no rules | Replacing with it: that silently unloads everything, which is Clear all's job and it confirms (L4134) |
| Where an import's outcome is shown | A status line beside the Import button; from the Rules tab, where neither line shows, a toast without the counts, and an error toast that stays until tapped (#87) | The rules status line: it sits in the Rules data section, usually folded shut. A toast that hides on its own: a failed save must not vanish (L4134) |
| How a newer data release is shown | Muted text on the row, one hint line above the list, a dot on the Settings sidebar's Rules data tab | The amber "update available" chip: that says the pack is behind the app it is loaded in, and a data release is optional (L5082) |
| Where the update notice shows (#102) | A pill in the top bar, "Extensions · N updates", that opens Settings → Extensions | Settings only: easy to miss. A toast: gone after one look (L7428) |
| Clearing a notice (#102) | Its × clears it until a newer version arrives; the row still offers Update; the app pill gets the same × | A notice that can't be cleared: it nags a player who has chosen to stay on a version (L7428) |
| How updates happen (#102) | Always by hand: Update all, or Update on a row | Automatic updates: the player loses control of their rules mid-campaign (L7428) |
| When sources are checked (#102) | At boot, quietly, for every enabled source, skipped offline; and on Check now | A button only: a third-party update goes unseen. Boot for the official source only: two behaviours to explain (L7428) |
| Manual installs (#102) | A Manual install dialog: Choose files, Choose a folder, and a drop zone, all through the plan | A remembered folder (Chrome and Edge only): uneven across browsers, and still not checkable unprompted (L7428) |
| The official source (#102) | Built in and on by default; it can be switched off, not removed | Off by default: a new player has to find it. A plain URL: once deleted, it has to be retyped (L7428) |
| How the Extensions page is organised (#102) | One section per category, then Sources; the source is a line on each row | One card per source: doesn't scale past one category (L7428) |
| Sections on the Extensions page (#102) | Every section folds, and each has its own Remove all | A "More" section holding Clear all (L7428) |
| The details dialog (#102) | Opened from a pack's name: full description, requirements, the source, and the other packs from it | — |
| A missing requirement (#102) | A tappable "requires *X*" chip: *X*'s details when offered, else its link | A "Get it" link beside it: more words (L7428) |
| Wording (#102) | "requires Fieldbook 1.10.0", falling back to "requires a newer Fieldbook" with no `minApp`; "requires SRD 5.2"; "Unsupported"; "Manual install" | "Not supported yet", "Install by hand", "Get it" (L7428) |
| Get templates (#102) | Removed | — |
| The plan while it installs (#102, Ruling 14) | Can't be dismissed; × and Escape say to wait | Dismissed but still running, toasting later: more confusing than a wait bounded by the file timeout (L7428) |
| Where a player hides a tab (#52) | Settings → Sheet display gets a Tabs group, one switch per word tab | A long-press on the tab itself to unhide it: invisible, and clashes with the phone's own long-press gesture |

## Open

- **Private packs get no newer-data notice.** The data check reads the public registry, which lists
  only SRD 5.2 and Homebrew since #85, so a private pack's row shows its version quietly (`known`)
  and never "out" (see [Private data](../data/private-data.md)).
- **Removing a source does not unload what it installed or fetched** (#102, by decision). Its packs
  stay until removed from their rows (see [Rules packs](../architecture/rules-packs.md)).
- **The phone notice row is open for Mike** (#102): at 560px and under a showing notice adds a third
  header row; the alternative is one combined "↑ N" pill with a menu. The Task 6 reviewer recommends
  keeping the row.
- The header comment of `30-version.js` still says to bump `APP_VERSION` and add a `CHANGELOG` entry on
  every change; the UPDATE_REPO comment still describes the badge linking to the release page.
- The update check runs once per load.
- **Import settings offers keep or replace, not merge.** Adding the file's packs to what is loaded
  was not built; the player can import the files themselves instead.
- **Import settings replaces `settings.sources` with the file's list** when the file has one, like
  every other setting in it. Sources added since the export are dropped; what they installed stays
  loaded unless the player chooses Replace my rules. An older file's `rulesSources` join the list
  instead.
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — `APP_VERSION` badge and an in-app changelog; `docs/CHANGELOG.md` generated from it. → ledger L302
- 2026-08-07 — In-app GitHub update check replaces a hosting/CD approach; `cmpVer()`. → ledger L331
- 2026-08-10 — `UPDATE_REPO` switched on; the repo must be public. → ledger L527
- 2026-08-10 — Versions are cut on release by `release.js`, not on every edit. → ledger L475
- 2026-08-10 — Per-system `dataVersion` and the stale-pack badge. → ledger L1323
- 2026-08-11 — Settings split into folding sections. → ledger L1741
- 2026-08-11 — The update pill replaces the version button and opens the changelog. → ledger L1779
- 2026-08-14 — The "! N missing" chip for packs whose dependencies are not loaded. → ledger L1883
- 2026-08-18 — Credits & licences section for the icon attribution. → ledger L3289
- 2026-09-28 — Fetch all keeps what is loaded, says when nothing changed, and the Rules data chip follows the pool. → ledger L3797, #65
- 2026-09-28 — The pack name in the rules status line is escaped; the Download link only takes a github.com page. → ledger L3940
- 2026-09-28 — Import settings asks before replacing loaded rules, rebuilds the file's pool through `mergeRules()`, and says what it did. → ledger L4134, #70
- 2026-09-29 — Trackers: counters, checklists and tasks that close themselves when done, with Undo; registered section 20, in the combat view; hideable per character. → ledger L4822, #41
- 2026-10-07 — Import files takes zips and names each failure; the `update` state, its hint line and ` · update` on the count, from `checkForDataUpdate()`; Credits & licences lists each loaded pack's credit. → ledger L5082, #83
- 2026-10-09 — Bundling moves to `bundle()` in `tools/data-kit/fbdata.py` (Python), replacing the Node bundler. → ledger L5342, #85
- 2026-10-09 — `dataStatus()` gains `"known"`: a pack with a version but no baseline to compare it to shows that version quietly, never the amber chip or the newer-data notice. → ledger L5388, #85
- 2026-10-09 — The public registry, which the newer-data check reads, lists only SRD 5.2 and Homebrew; private packs show their version quietly and get no notice. → ledger L5426, #85
- 2026-10-12 — From the Rules tab, the import toast drops the counts and a failure stays until tapped. → ledger L5648, #87
- 2026-10-16 — Appearance gains "Tap outside to close dialogs" (`backdropClose`, off by default, in `SETTINGS_KEYS`). → ledger L5903, #106
- 2026-10-16 — Settings is a sidebar of six pages, every setting a row with its control on the right; an icon rail with Icon tabs or on a narrow screen; the last page is remembered. → ledger L5930, #107
- 2026-10-16 — The page pane keeps its controls clear of its scrollbar. → ledger L5976, #107
- 2026-10-19 — Sheet display gains an Ammunition group: "Ammo recovery" (half/all/hits/none), writing `character.ammoRecovery`. → ledger L6081, #104
- 2026-10-19 — "Ammo recovery"'s first choice reads Half (rules as written), as built. → ledger L6147, #104
- 2026-10-25 — Sheet display gains a Tabs group: one switch per word tab, writing `character.hiddenTabs` via `setTabHidden()`. → ledger L6989, #52
- 2026-10-25 — Final review fixes: the Tabs group's help moved to a `<p class="hint">` above the switches, the Journal row gained its own help, and the `[data-tabsw]` handler is described as per-button, not delegated. → ledger L7064, #52
- 2026-10-25 — Sheet display gains an Inventory group: "Inventory log size", writing `character.invLogSize` and trimming the log at once. → ledger L7291, #47
- 2026-10-25 — Lowering the log size asks first when it would drop lines. → ledger L7339, #47
- 2026-10-26 — Rules data becomes Extensions: sections per category and Sources, the details dialog, the install plan, Manual install, the Extensions pill and a × on both pills; Fetch all, Import files and Get templates go. → ledger L7428, #102
- 2026-10-26 — Final review fixes: the Settings dot stays while any update is pending; a manifest source is named "*name* (*host*)" everywhere, and an update from a source that didn't install the pack says "update from" it. → ledger L7477, #102
