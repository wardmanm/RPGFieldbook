# Settings & updates

The Settings modal (the cog in the top bar) and the app's two ways of saying what version you are
on: the version button, which opens the in-app changelog, and the **update pill** that takes its place
when GitHub has a newer release. Settings holds the look of the app, the open character's own
options, the rules data — where it comes from, what is loaded, and whether a loaded pack is older than
this build expects — and backup of settings and rules.

**Code:** `SET_SECTIONS`, `setSecOpen()`, `setSecHTML()`, `openSettings()`, `encSettingsHint()`,
`rulesStatusText()`, `updateRulesStatus()`, `refreshRulesUI()`, `loadedRulesGroups()`,
`removeRulesGroup()`, `clearAllRules()`, `dataStatus()`, `dataStatusHTML()`, `rulesCacheWarning()` in
`88-settings.js` · `renderSrcRows()`, `renderRulesData()`, `rulesDataHTML()`, `fetchAllRules()`,
`fetchRulesFrom()`, `importRulesFiles()`, `downloadRulesTemplates()`, `requiresStatusHTML()` in
`89-rules-merge.js` · `APP_VERSION`, `DATA_VERSIONS`, `UPDATE_REPO`, `CHANGELOG`, `cmpVer()`,
`checkForUpdate()`, `showUpdatePill()`, `updBannerHTML()`, `openChangelog()` in `30-version.js` ·
`boot()`, `wire()` in `90-boot.js` · `release.js`, `gen-changelog.js`, `bundle-rules.js` in `scripts/`
· **Tests:** `rules-data.js` (the modal's ids both ways, the fold state, `dataStatus()`),
`char-update.js` (`cmpVer()`, `updBannerHTML()`) · **See also:**
[Rules packs](../architecture/rules-packs.md), [Storage](../architecture/storage.md),
[Rules-update tool](rules-update-tool.md), [Theming & icons](../ui/theming-and-icons.md),
[RELEASING](../../RELEASING.md)

## How it works

**The modal.** `openSettings()` builds five folding groups with `setSecHTML()`, borrowing the feature
list's `.fgroup` / `.fghead` / `.fcaret`:

- **Appearance** — skin, mode (system/light/dark), hand-drawn borders, icon tabs. Changing the skin
  with a character open also sets its `system`.
- **This character** — only when a character is open, badged with its name: size, encumbrance (with a
  live "carrying X of Y" hint), coins count as weight, colour current HP, skills display, Hit Dice
  display, and the rules-update check with the version the sheet was last checked against.
- **Rules data** — badged with the entry count: sources, the loaded-data list, and the status line.
- **Characters & backup** — the character library, and Export / Import settings.
- **Credits & licences** — the game-icons.net attribution CC BY 3.0 requires, in the app because
  `fieldbook.html` travels as a lone file; see [Theming & icons](../ui/theming-and-icons.md).

**Fold state** is a collapse map, `settings.setCollapse` (true = shut); an absent key falls back to
the first-run default in `SET_SECTIONS` — Appearance and This character open, the rest shut. A toggle
flips `display`, the caret and `aria-expanded` in place, so inputs, listeners and scroll survive.
Headers are `role="button"` with Enter/Space. The delegated listener is bound to `#setSections`, which
is rebuilt on every open.

**Rules sources.** `settings.rulesSources` is a list of URLs, edited in place. **Fetch all** runs
`fetchAllRules()`: it resets the pool, fetches each URL in turn (`cache:"no-store"`), follows a
manifest's `include` list relative to its URL (`fetchRulesFrom()`, cycle-guarded), merges, saves the
cache and reports; on an error it keeps what loaded and suggests importing files, since offline or
CORS is the likely cause. Nothing fetches on its own — only this button. **Import files** merges each
chosen file under its file name (`importRulesFiles()`); **Get templates** downloads a manifest and one
example file per category; **Clear all** confirms, says characters are unaffected, and empties the
pool. A legacy `settings.rulesUrl` is folded into the list at boot.

**Loaded data.** `rulesDataHTML()` (also shown in the home screen's setup) groups what is loaded by
file or source under Rulebook, one heading per category, then Mixed. Each row carries a remove button
and two status marks: `dataStatusHTML()` and, from `requiresStatusHTML()`, an "! N missing" chip when
the pack refers to content that is not loaded (see [Rules packs](../architecture/rules-packs.md)).
A red line above the list (`rulesCacheWarning()`) says when the last cache save failed, so a reload
cannot quietly undo an import (see [Storage](../architecture/storage.md)).

**Pack badges.** `dataStatus(g)` compares the pack's `_dataVersion` (its `dataVersion`, stamped at
merge by `mergeRules()`) with `DATA_VERSIONS[source]`: older is **stale** — an amber "update available
· v*X*" chip whose tooltip says to re-import from the latest release; equal or newer is **current**, a
quiet "v*X*"; no stamp or no entry for that system is **unknown** and shows nothing.
`DATA_VERSIONS` records the release in which each system's data last changed, bumped by `release.js`
only when that `data/<dir>/` moved; `bundle-rules.js` stamps each pack.

**Export / Import settings** writes `{_type:"fieldbook-settings", settings, rules}` — appearance *and*
every loaded pack — and reads that or a bare settings object back, re-indexing and re-caching the
rules and re-rendering.

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
otherwise, because it becomes an `<a href>`.

## Rules that must hold

- **Fold state is stored as COLLAPSE, not "open"**, so a first-run default can change later without
  reopening a section somebody shut. The Rules tab's sections copy this idiom.
- **Delegated listeners bind to something rebuilt with the modal**, never to `#mBody`, which outlives
  every modal and would stack one copy per visit.
- **Every id `openSettings()` looks up exists in the markup it builds, and every id it renders is
  wired** — `rules-data.js` parses the function's own source and checks both directions.
- **The update check is optional and silent.** No network, no repo, rate-limited, private repo: no
  pill, no error, nothing else changes.
- **The changelog stays reachable while the pill is up** — the pill replaced the only other way in.
- **`updBannerHTML()` escapes the release tag**; it comes from the network.
- **An unknown data version is not stale.** A false alarm on someone's own content is worse than
  silence.
- **Never hand-edit `APP_VERSION`, `DATA_VERSIONS` or `CHANGELOG`**; `release.js` owns all three, and
  `APP_VERSION` must only ever rise or the update check breaks.
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
- **The badge first needs a release newer than the app**, and an unauthenticated call to a private
  repo 404s, and the `r.ok` guard turns that into a silent no-op. → L527

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How to tame the long Settings modal | Folding groups built from the feature list's section header | A second collapsible: the app should not have two things that look like a section header |
| How fold state is stored | Collapse map; absent = never touched | An "open" map: defaults could never change without reopening sections people shut |
| What a toggle does | Flips display and caret in place | Re-rendering the modal: every listener re-attached, inputs and scroll lost |
| Where the delegated listener lives | `#setSections` | `#mBody`: survives every modal, so listeners stack per visit |
| Version button and update pill | One control: the pill takes the button's slot | Both side by side: they say the same thing, and the spacer pushed the pill away |
| What the pill opens | The changelog, led by a download banner | Linking straight to GitHub: "What's new" would be unreachable while an update is pending |
| The pill's element | A `<button>` | An `<a>` with a live `href` that `preventDefault`s: a lie about what it does |
| Where the changelog lives | Embedded in `30-version.js`, keeping the single-file offline design; `docs/CHANGELOG.md` is generated from it so the two cannot drift | — |
| Where icon credits live | In Settings | Only in the README: the app is routinely shared as a lone file no README follows |
| Where the Download link may point | A `https://github.com/` page from the response, else the releases page | Whatever `html_url` holds: it becomes an `<a href>`, and a `javascript:` there would run on click (L3761) |

## Open

- **Fetch all replaces the whole pool**, packs imported from files included: `fetchAllRules()` calls
  `resetRules()` before fetching, and on a failure saves whatever that run loaded — offline, that is
  nothing. The sources hint's "Fetched when online, cached for offline" also suggests an automatic
  fetch that does not exist. Seen in the code; not checked in a browser.
- The header comment of `30-version.js` still says to bump `APP_VERSION` and add a `CHANGELOG` entry on
  every change; the UPDATE_REPO comment still describes the badge linking to the release page.
- The update check runs once per load.
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
- 2026-09-28 — The pack name in the rules status line is escaped; the Download link only takes a github.com page. → ledger L3761
