# Extensions and manifest installs: design

**Status:** approved in conversation 2026-10-26, and built on `issue/102-extensions` the same day
(see [As built](#as-built)). It is in wave 3 of [1.9.0](../wiki/roadmap/1.9.0.md).
**Issue:** #102 (Data Pack Manifest Resolution). One branch, `issue/102-extensions`.
**Mockups:** in `.superpowers/brainstorm/23506-1793015387/content/`:
- `rules-data-layout.html`: the first comparison. It is superseded by the Extensions page;
- `extensions-page.html`: layout B, grouped by category;
- `extensions-page-2.html`: the agreed design, with collapsible sections, the details dialog,
  Manual install and the final wording.

**Read first:**
- [Rules packs](../wiki/architecture/rules-packs.md): `mergeRules()`, `importPack()`, `fetchAllRules()`
  and the rules cache.
- [Data archive](../wiki/architecture/data-archive.md): `data/packs.json`, the data zip,
  `fieldbook-data.json`, data releases, and the newer-data notice.
- [Settings & updates](../wiki/features/settings-and-updates.md): the Rules data page, pack badges and
  the update pill.
- [Storage](../wiki/architecture/storage.md): the rules cache (IndexedDB, with LZW localStorage as the
  fallback) and failing loudly.
- [Data kit](../wiki/data/data-kit.md): `fbdata.py pack` and `validate`.

---

## 1. What it is

Fieldbook learns to install and update packs from a **manifest**, in the style of Foundry VTT's module
manifests. A manifest is a small JSON file that lists packs, each with:
- a version and a sha256;
- the oldest Fieldbook that can use it;
- a category;
- a short and a full description;
- where its file is, relative to the manifest.

Fieldbook's own public data, SRD 5.2 and Homebrew, is a **built-in source**. Any public host that
allows cross-origin reads can serve another manifest, which the player adds by URL.

On boot the app quietly checks every source. When a pack has a newer version that this app can run, a
pill in the top bar reads **Extensions · N updates**. Updating is always the player's choice:
- **Update all** updates every pack that has an update;
- **Update** on a pack's row updates just that pack.

Before anything installs, an **install plan** lists what will change. Every download is checked
against its sha256, and one failure installs nothing.

Settings' **Rules data** page becomes **Extensions**, grouped by category. Today the only category is
"Rules data", but the format and the page are built for 2.0's other kinds of extension (ui, lore,
features…).

Manual installs stay. A **Manual install** dialog takes files, a folder or a zip, picked or dropped,
and runs them through the same plan.

This closes "a data update is announced, never installed" in
[Known issues](../wiki/roadmap/known-issues.md).

## 2. Decisions

All made by Mike in conversation on 2026-10-24 and 2026-10-26.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | How packs are fetched | **Each pack file a manifest names, fetched one by one.** The official files come from the release tag on raw.githubusercontent.com; any public host that allows cross-origin reads also works. Paths resolve relative to the manifest, and each file is checked against its sha256 (2026-10-24) | The release zip: a `file://` page can't download GitHub release assets, because they redirect to storage with no CORS header (the spike, 2026-10-23) |
| 2 | Where the official pack files live | **In the release commit:** `releases/data/fieldbook-data.json` and the built pack files, written by the release scripts before the tag | A `data-release` branch CI overwrites: not the per-tag route of decision 1. Building packs in the app from the source fragments: a second bundler and digest in JavaScript would drift |
| 3 | A pack built for a newer app | **Every pack has a minimum app version (`minApp`).** A pack whose `minApp` is newer than this app is listed with "requires Fieldbook X.Y.Z" and is never installed. For the official source, the app picks the newest release this app can run | Installing anyway: a data change can need app code that isn't there |
| 4 | How updates happen | **Always manually.** A notice says updates exist; the player presses **Update all** or updates packs one at a time | Automatic updates: the player loses control of their rules mid-campaign |
| 5 | When sources are checked | **At boot, quietly, for every enabled source**, reading only the manifests, skipped when offline. Manifest update checks join the allowed network calls in CLAUDE.md's constraint 2 | A button only: a third-party update goes unseen. Boot for the official source only: two behaviours to explain |
| 6 | Manual installs | **A Manual install dialog: Choose files, Choose a folder, and a drop zone for files, a zip or a folder**, all through the same plan | A remembered folder (Chrome and Edge only): uneven across browsers, and the app still can't check a folder unprompted |
| 7 | The official source | **Built in and on by default.** It can be switched off but not deleted. On a new install it offers Install for each pack | Off by default: a new player has to find it. A plain URL: once deleted, it has to be retyped |
| 8 | Where the update notice shows | **A pill in the top bar**, "Extensions · N updates", that opens the Extensions page | Settings only: easy to miss. A toast: gone after one look |
| 9 | Clearing a notice | **Its × clears it until a newer version arrives.** The pack's row still offers Update. The app-update pill gets the same × and the same rule | A notice that can't be cleared: it nags a player who has chosen to stay on a version |
| 10 | Architecture | **One install pipeline:** every route builds candidates; one plan, one confirm, one all-or-nothing install | Separate paths: three copies of "is it newer", "can this app run it" and "replace the pack" |
| 11 | Pack identity | **System plus file name**, as `importPack()` already does. The source that installed a pack offers its updates; a pack imported by hand is matched to any enabled source that lists it | File name alone: two systems can share a file name |
| 12 | Older versions | **Never offered** as an update | Offering a downgrade: confusing next to Update |
| 13 | Removing a source | **Its packs stay installed.** Deleting a pack is its own button | Taking its packs with it: deletion behind the player's back |
| 14 | A pack another pack needs | **A `requires` entry may carry a `url`.** A missing requirement shows as a tappable chip, "requires SRD 5.2". The chip opens that pack's details when a source offers it, otherwise the link | A "Get it" link beside it: the chip says it in fewer words |
| 15 | Kinds of extension | **Every pack has a `category`.** The app installs only categories it knows, and today that is `rules`. A pack in an unknown category is listed under **Unsupported** and never installed | No category: 2.0 would need a second format |
| 16 | How the page is organised | **One Extensions page, one section per category, then Sources** (layout B). The source is a line on each pack's row | One card per source: it doesn't scale once there are several categories |
| 17 | Sections | **Every section collapses**, and each section has its own **Remove all** | A "More" section holding Clear all: removed |
| 18 | Descriptions | **A short description, up to 140 characters, shows on the row. A full description, up to 4,000 characters with paragraphs, shows in the details dialog.** Both are plain text | One description: either too long for a row or too short for a dialog |
| 19 | The details dialog | **Tapping a pack's name opens it:** the full description, its requirements, the source's details, and the other extensions from that source | — |
| 20 | Wording | "**requires Fieldbook 1.10.0**" for both a too-new pack and an unsupported category (the latter falls back to "requires a newer Fieldbook" only when its manifest gives no `minApp`); "**requires SRD 5.2**" for a missing pack; "**Unsupported**"; "**Manual install**" | "Not supported yet", "Install by hand", "Get it" |
| 21 | Get templates | **Removed** | — |

## 3. The manifest

The manifest is the data zip's existing `fieldbook-data.json`, extended. The new fields are optional
to read, so a zip from before this change still imports. Older apps ignore the new fields, so a new
zip still imports in an older app.

```json
{
  "_type": "fieldbook-data",
  "format": 2,
  "name": "Fieldbook public data",
  "homepage": "https://github.com/wardmanm/RPGFieldbook",
  "version": "1.9.0",
  "builtFor": "1.9.0",
  "packs": [
    {
      "file": "srd52_full.json",
      "category": "rules",
      "system": "SRD 5.2",
      "title": "SRD 5.2",
      "summary": "The free D&D rules: classes, species, spells, items and more.",
      "description": "Paragraphs of plain text…",
      "version": "1.9.0",
      "minApp": "1.9.0",
      "size": 973157,
      "sha256": "…64 hex…",
      "license": "CC-BY-4.0",
      "attribution": "…",
      "requires": [ { "pack": "SRD 5.2", "file": "srd52_full.json", "url": "https://…" } ]
    }
  ]
}
```

- **`file`** is a path relative to the manifest, never absolute and never with `..`. The pack is
  stored under its base name, as zip import does now.
- **`category`** defaults to `"rules"` when absent. The only category this app installs is `"rules"`.
- **`minApp`** defaults to the manifest's `builtFor`, and with neither, to no minimum.
  A pack is installable when `minApp ≤ APP_VERSION`, compared with the version comparison the update
  check already uses.
- **`summary`** is at most 140 characters and **`description`** at most 4,000. Both are plain text;
  a blank line separates paragraphs. Over-long text is cut at the limit when read, and
  `fbdata.py validate` refuses it.
- **`requires`** lists, for each pack this one needs, its system (`pack`), file and an optional
  `url` (http or https only). The pack's own `requires` is unchanged apart from gaining the same
  optional `url`. `fbdata.py pack` copies it into the manifest, so authors write it once.
- **Caps**, as the zip reader's: at most 64 KiB of manifest, 1,000 packs, and 32 MiB for one pack
  file.

Where it lives:
- **The official source:** `releases/data/fieldbook-data.json` at the release tag, beside the built
  pack files.
- **A third-party host:** at any URL.
- **A downloaded zip or folder:** at its root.

## 4. Sources and checking

`settings.sources` replaces `settings.rulesSources`. It is a device setting, never character data.
Each entry is `{id, kind, url, on, checked, error, manifest}`:

- **`kind: "official"`** is the built-in source; there is always exactly one. It is resolved through
  the GitHub release list:
  1. `pickDataRelease()` picks the newest release this app can run.
  2. The app reads `https://raw.githubusercontent.com/<UPDATE_REPO>/<tag>/releases/data/fieldbook-data.json`.

  A release from before this change has no `releases/data/`, so the official source reports
  "nothing to install from this release" and falls back to today's link to the release page. Its
  URL is not editable.
- **`kind: "manifest"`** is a URL the player added that answered with a manifest.
- **`kind: "plain"`** is an old-style source: a pack file, or an `include` list. It has its own
  **Fetch**, which runs `fetchRulesFrom()` and `applyFetchedSource()` exactly as today. It is never
  checked at boot, because it has no versions.

When the player adds a URL, the app fetches it once and sorts it: a `fieldbook-data` object is a
manifest; anything `fetchRulesFrom()` accepts is plain; anything else is refused with the reason.

`settings.rulesSources` and the legacy `settings.rulesUrl` convert once into `kind:"plain"` entries,
and the official entry is added. The old fields are read on import of an old settings backup, so a
backup from before this change restores its sources.

**`settings.packOrigin`** maps `system|file` to the id of the source that installed it.
**`settings.dismissedUpdates`** maps `system|file`, and `"app"`, to the newest version the player
cleared.

**The check** is `checkSources()`. It runs once at boot, after `checkForDataUpdate()`'s slot, and on
**Check now**. For every enabled manifest source, and the official one, it:
- fetches the manifest with a 10-second timeout and `cache:"no-store"`;
- validates it (§3);
- stores it as the source's `manifest`, with `checked` and any `error`.

Offline (`navigator.onLine===false`), the boot check is skipped. A failed check is quiet at boot, but
the source's row says "couldn't check: <reason>". The pack files are never fetched by a check.

The **available version** of a loaded pack:
1. Take the newest version, newer than the loaded one, among the enabled sources' entries for its
   `system|file`, preferring the source in `packOrigin`.
2. A pack whose `minApp` is too new still shows, as "requires Fieldbook X", but never counts as an
   update.

## 5. The install pipeline

Every route ends in the same five steps: a source's Update or Install, Update all, and Manual install.

1. **Candidates.** Each route produces
   `{category, system, file, title, version, minApp, size, sha256, origin, get()}`, where `get()`
   returns the file's bytes:
   - a manifest source reads from the manifest's URL;
   - a zip reads from `readDataArchive()`;
   - a folder or files read from the picked or dropped `File`s.

   Loose pack files with no manifest become candidates with no sha256. Their system and version
   come from their own `system` and `dataVersion`.
2. **The plan.** `planInstall(candidates)` compares each candidate with the loaded pack of the same
   `system|file`:

   | Outcome | When |
   |---|---|
   | install | it isn't loaded |
   | update | its version is newer |
   | same | its version is equal |
   | older | its version is older; it is never applied |
   | requires Fieldbook X | its `minApp` is newer than this app |
   | unsupported | its category isn't `rules` |

   For a Manual install of a version older than or equal to the loaded one, the plan offers
   **Replace anyway**, unticked. That is how a player rolls back from a file. A ticked candidate
   whose requirement isn't loaded pulls that requirement in as an *install* line when an enabled
   source offers it (§8).
3. **Confirm.** A dialog lists the plan: each pack's outcome, versions, size, and the source it comes
   from. Only *install* and *update* lines are ticked. Installing waits for **Install N**.
4. **Fetch and verify, all before any change.**
   - Each ticked candidate's bytes are fetched (30-second timeout per file) or read.
   - The sha256 is checked when there is one.
   - The JSON is parsed, and its `system` and `dataVersion` must match the candidate's.
   - One failure stops everything. Nothing is merged, and the dialog names the file and the reason.
5. **Install.**
   - Every verified pack goes through `importPack(obj, file)`, so it replaces by file name and system
     exactly as file import does.
   - `packOrigin` records the source.
   - The rules cache is saved once (`saveRulesCache()`, which already reports a failed write).
   - The page and pill re-render, and a toast says "Installed 2 packs".

SHA-256 is a small JavaScript function, `sha256Hex(bytes)`, not `crypto.subtle`. Whether `file://`
counts as a secure context differs by browser, and the harness checks the function against Node's
`crypto`.

## 6. Interface

### 6.1 The top bar

The **Extensions · N updates** pill sits beside the app-update pill. N counts the packs whose
available version is newer than the version the player cleared. Tapping the pill opens Settings →
Extensions. Its **×** writes the current available versions to `dismissedUpdates` and hides the
pill. It shows again when any pack has a version newer than the one cleared.

The app-update pill gets the same × and the same rule, under `dismissedUpdates.app`. At 390px the
pill reads **N updates**.

### 6.2 Settings → Extensions

The sidebar's **Rules data** page is renamed **Extensions**. Its key becomes `extensions`, and a
stored `setPage:"rules"` maps to it. The Settings dot shows while updates are pending.

From the top:
- **The updates banner**, when any are pending: "**2 updates** · SRD 5.2, Homebrew" with
  **Update all**. Update all is never dismissed by the pill's ×.
- **Rules data**, with a count. One row per pack, loaded or offered by an enabled source:
  - the pack's **name**, which is a button that opens the details;
  - its **summary**;
  - "from *source name*", "imported from a file", or "from *host* · not installed";
  - "requires …" chips;
  - installed → available versions;
  - **Update**, **Install**, or neither;
  - a delete button for a loaded pack, as now.

  Today's Loaded data list, with its rulebook grouping, badges and "! N missing" chip, folds into
  these rows. The section header's **Remove all** is today's Clear all, with its confirm.
- **Unsupported**, only when something is in it: packs whose category this app doesn't install,
  with "requires Fieldbook X".
- **Sources**:
  - the built-in source with its switch;
  - manifest sources, each with its name or URL, "checked *time*" or "couldn't check: *reason*", and
    **Remove**;
  - plain sources, each with **Fetch** and **Remove**.

  Below the list sits the row **+ Add a source URL** · **Check now** · **Manual install…**. The
  header's **Remove all** removes every added source and switches the official one off, after a
  confirm; installed packs stay.
- **This sheet**, with a character open: "Check for rules updates", unchanged.

Every section collapses, and the state is remembered in `settings.setCollapse`, as Settings groups
already are.

### 6.3 The details dialog

It opens from a pack's name and shows:
- the title;
- "Rules data · *version* · installed / not installed";
- the full description as paragraphs of escaped text;
- the requirement chips;
- a **Source** box: name, manifest URL, homepage, last checked, licence and attribution;
- **Also from this source**: the other packs, each a button that opens its own details.

The foot holds **Close**, plus **Install** or **Update** when that applies.

A **requires *X*** chip does one of three things:
- when a source offers X, it opens X's details;
- when the requirement has a `url`, it opens that link in a new tab (http or https only);
- otherwise it is a plain label.

### 6.4 Manual install

A dialog opened by **Manual install…** holds:
- one sentence of help;
- **Choose files** (json and zip, multiple);
- **Choose a folder** (`webkitdirectory`, reading every `.json` and `.zip` inside it);
- a drop zone for files, a zip or a folder (`DataTransferItem.webkitGetAsEntry()`).

Whatever it gets goes to the plan (§5). Dropping onto the Extensions page itself does the same.

## 7. Code

- **New fragment `src/js/89-extensions.js`**, after `89-rules-merge.js`. It holds:
  - `sha256Hex()`;
  - `readManifest()`;
  - `checkSources()`;
  - `planInstall()`, `runInstall()`;
  - the candidate builders;
  - `availableFor()`, `updateCount()`;
  - the pill;
  - the Extensions page's rows, the details dialog and the Manual install dialog.

  The manifest's JS fragment count goes to 38, with its code-map row and a wiki citation.
- **`88-settings.js`:** the Extensions page, its sections, Sources, and the settings conversion.
  `downloadRulesTemplates()` and Get templates go.
- **`89-rules-merge.js`:** `renderSrcRows()` and Fetch all give way to per-source Fetch.
  `fetchRulesFrom()`, `applyFetchedSource()` and `importPack()` stay as they are.
- **`30-version.js`:** `checkForDataUpdate()` hands its pick to the official source.
  `dataUpdateHint()` gives way to the banner, and the app pill gets its ×.
- **`90-boot.js`:** the boot check, after the app check.
- **`tools/data-kit/fbdata.py`:**
  - `pack` writes format 2 (`name`, `homepage`, `category`, `title`, `summary`, `description`,
    `minApp`, `size`, `requires`);
  - `validate` checks lengths, paths and caps;
  - a new `release-files` command writes `releases/data/`.
- **`data/packs.json`:** optional `summary`, `description` and `homepage` per pack, written by hand
  like `title`.
- **`scripts/release.js` and `scripts/data-release.js`:** run `fbdata.py release-files` and add
  `releases/data/` to the release commit.
- **The release workflows:** check that `releases/data/fieldbook-data.json` matches the files beside
  it and is public only.
- **`docs/rules-schema.md`**, which ships, gains "Publishing extensions":
  - the format;
  - relative paths;
  - the cross-origin requirement;
  - `category` and `minApp`;
  - the limits.

  Its mention of Get templates goes.

## 8. Edge cases

- A manifest that lists the same `system|file` twice keeps the newest entry.
- Two sources offer the same pack: the source that installed it wins. Otherwise the newest version
  wins, and on a tie the official source.
- A source is switched off: its packs stay, and its offers leave the page.
- An installed pack disappears from its manifest: it stays installed, with no update and no warning.
- The official source on a release from before this change: no offers, the old "Newer rules data is
  out" link, and no error.
- Offline: the boot check is skipped, and **Check now** says "You're offline".
- A plan with nothing to do: the dialog says so, with only Close.
- A pack whose requirement isn't loaded: when an enabled source offers the requirement, the plan
  adds it as its own *install* line, ticked, so one confirm installs both. When no source offers it,
  the pack installs anyway and the chip shows afterwards.
- A hostile manifest:
  - a path with `..` or an absolute URL is refused for that pack;
  - a `url` that isn't http or https becomes a plain label;
  - over-long text is cut;
  - more than the caps is refused whole.
- Storage: a failed cache save after install is reported, as file import does now.

## 9. Testing

- **The `sheet` or `rules-data` suite:**
  - `sha256Hex` against Node's `crypto` on empty, short and 1 MB inputs;
  - `readManifest`: format 1 and 2, defaults, length cuts, path refusals, caps, and a hostile `url`;
  - `planInstall`: install, update, same, older, requires Fieldbook, unsupported, and Replace anyway;
  - `runInstall`: all succeed, and one sha256 wrong (nothing merged, the cache not saved);
  - the plan's system and `dataVersion` checks;
  - `availableFor`, with two sources, `packOrigin`, and off sources;
  - `updateCount` and dismissal: hidden, then shown again by a newer version;
  - the settings conversion from `rulesSources` and `rulesUrl`;
  - escaping of every manifest string in the page and the dialog;
  - fetch stubbed in the harness.
- **The `data-kit` suite:**
  - `pack` writes format 2 with the new fields;
  - `validate` refuses over-long text and bad paths;
  - `release-files` writes the manifest and files, with matching sha256 values.
- **The `docs` suite:** the fragment count, the code map and the citations, as usual.
- **Screenshots**, through the project's Playwright MCP, into
  `.claude/qa/in-progress/102-extensions/`:
  - the Extensions page with updates;
  - a pack that requires a newer Fieldbook;
  - Unsupported;
  - the details dialog;
  - the plan;
  - Manual install;
  - the pill and its ×;
  - both skins, at 1280 and 390.

  A local manifest is served over `file://`, and the official route is stubbed.

## 10. Docs

- **Wiki:**
  - [Data archive](../wiki/architecture/data-archive.md): the manifest format and `releases/data/`;
  - [Rules packs](../wiki/architecture/rules-packs.md): sources and the install pipeline;
  - [Settings & updates](../wiki/features/settings-and-updates.md): the Extensions page, the pill and
    dismissal;
  - [Data kit](../wiki/data/data-kit.md): the new fields and `release-files`;
  - [Known issues](../wiki/roadmap/known-issues.md): "announced, never installed" is closed;
  - [Overview](../wiki/overview.md): the code map;
  - [1.9.0](../wiki/roadmap/1.9.0.md): the row is marked built;
  - [Decisions](../wiki/decisions.md): rows for this spec.
- **RELEASING.md:** the release commit now carries `releases/data/`.
- **CLAUDE.md:**
  - constraint 2 names manifest update checks among the allowed network calls;
  - the JS fragment count becomes 38.
- **UNRELEASED.md:**
  - "Settings → Rules data is now Extensions: install and update rules packs from Fieldbook's own
    data or any manifest URL, with Update all";
  - "Manual install takes files, a folder or a zip";
  - "Update notices can be cleared until a newer version arrives".

## 11. Out of scope

- Private packs through a manifest. raw.githubusercontent.com can't serve a private repo, and no
  token is stored. They stay a Manual install.
- Any category other than `rules`. The format and the page are ready for them; 2.0 builds them.
- Installing a requirement without a confirm. The plan lists it; nothing installs unasked.
- Signed manifests. The sha256 proves the file matches its manifest, not who wrote the manifest.
- Automatic updates.

## As built

Built in seven tasks on `issue/102-extensions` (`3f1047d..`), each reviewed. The code is the truth;
the wiki pages in §10 describe it. This section records where the build differs from the text
above, the rulings made while building, what was deferred, and what is still open.

### Rulings

1. **`planInstall()`'s outcomes test** expects `same`, `older`, `blocked` and `unsupported`: the
   plan's own test omitted the `older` line its input produced.
2. **"requires Fieldbook *X*"** names `minApp` only when it is set and newer than this app; anything
   else reads "requires a newer Fieldbook" (decision 20). One helper, `extTooNewWhy()`, serves the
   row, the dialog and the plan.
3. **`convertSources()` runs on every boot**, a first run with no stored settings included, so the
   official source always exists (`foldLegacySettings()` in `boot()`).
4. **Task 1's test scaffolding** was corrected (the registry path, direct subprocess calls for
   `--registry`, the `minApp` assertion, a public licence on scratch packs). Test wording only.
5. **A loaded pack with no readable `dataVersion`** reads as `update` against any versioned offer:
   unversioned data predates #83, so the offer is the newer copy. Pinned by a test.
6. **The old Rules-data source UI throwing mid-branch** after Task 3 was accepted: Task 5 deleted it,
   and nothing shipped in between.
7. **`runInstall()` is all or nothing through the merge too.** A per-key snapshot of `rules` (arrays
   sliced, null-prototype maps copied into fresh null-prototype maps, never a JSON round trip) and of
   `packOrigin` is restored when any `importPack()` throws.
8. **The file timeout** is 30 s plus 1 s per 100 KB of the declared `size`. The whole fetch and body
   are raced; `AbortController` aborts where it exists; a `Content-Length` over the cap is refused
   early; a declared size over 32 MB is refused before fetching.
9. **A settings save that fails at the boot check** is kept (`extSaveErrorText()`) and shown on the
   Extensions page, quiet at boot but never lost.
10. **Spec conformance fixes** in `89-extensions.js`: Replace anyway for an unversioned manual
    candidate (§5), the newest offer wins a pull-in (§8), and the rest of Task 4's review minors,
    except M10 (deferred, below).
11. **Task 4 re-review follow-ups**, carried into Task 5: an unreadable folder manifest is reported;
    the cross-origin hint only for a network `TypeError`, never a timeout or HTTP status; the save
    error clears on any later successful save; an early `Content-Length` refusal aborts the download;
    the page and plan show `runInstall()`'s `skipped`.
12. **Task 5 review minors**: focus survives a repaint; the requirement button carries its file; the
    unlisted-extension dialog has Close; chips get a row gap; `#rulesStatus` moves outside
    `#extPage`. Minor 5, the player text still naming the removed UI, was fixed in Task 7
    (`706e885`, and `docs/rules-schema.md`, `docs/README-converter.md`).
13. **Task 6 review minors**: `#fileRules` removed (`importRulesFiles()` kept for the suites); drops
    caught on the whole Manual install dialog; a toast when a drop holds no `.json` or `.zip`; a
    folder read capped at 2,000 files, saying how many weren't read; focus to the version button or
    Home after a pill's ×.
14. **The plan can't be dismissed while it installs.** × and Escape do nothing and the status says
    "Installing… please wait." (`setDismissGuard()` returning `true`): a dismissed install still
    running and toasting later is more confusing than a wait bounded by the file timeout.
15. **The Settings dot shows while any update is pending** (§6.2): `rulesUpdatePending()` reads
    `extUpdateRows()`, not the pill's count, so a pill's × clears the pill and leaves the dot.
16. **A manifest source is named "*name* (*host*)"** wherever it is named: rows, the plan, the
    details' Source box, "Also from *source*" and Sources. Only the official source reads "Fieldbook
    public data". A loaded pack's row and plan line say "update from *name (host)*" when the source
    offering the update didn't install it (by `packOrigin`, a file or "manual" included).
17. **The size caps count the body as it streams** and cancel past the cap, so they hold without a
    `Content-Length`; `arrayBuffer()` only where a response has no body stream. `addSource()` is capped.
18. **Folded into the fix wave:** the rules-schema limits (licence 64, `requires` 50), the
    `data-release.js` exit handler's cleanup in try/catch, a plain message for a garbled GitHub
    release list (M8), dotfiles ignored in `releases/data/` (M9), the `setCollapse` comment (M10).

### Where the build differs from the text above

- **The plan has a `replace` outcome** (§5): a loaded pack with no readable version is replaced,
  ticked; a candidate with no readable version is "Replace anyway", unticked.
- **The plan's rows name their source** ("from QA Workshop (qa.example)", "from a file"), as §5 step 3 asks.
- **`checkForDataUpdate()` does not hand its pick to the official source** (§7). The official source
  lists the releases itself (`extOfficialUrl()`), so a boot makes three GitHub API calls (M10).
- **`dataUpdateHint()` stays** (§7), on the home screen's loaded-data list. On the Extensions page
  the "v*A* · v*B* out" chip shows only where no source offers the pack.
- **`addSource()` caps its read at 32 MB, not 64 KB** (Ruling 17 said `EXT_MAN_MAX`). §4 lets a
  plain source be a whole pack file, far over 64 KB; a manifest over 64 KB is still refused, by
  `readManifest()`'s own byte check. Flagged for the controller.
- **A garbled release list** (not a JSON list) is "GitHub's release list couldn't be read" on the
  official row; a JSON object that isn't a list counts as garbled too.
- **The top bar has one auto margin**, on the save state, so the version and both pills pack left.
  **Up to 560px** the notices take a row after the buttons, and the Extensions pill reads "N
  updates" there (§6.1 said 390px).
- **Manual install** reads only `.json` and `.zip`, at most 2,000 files; its dialog has Close, and
  the home screen's and Rules tab's pickers open the same plan. A dropped item with no entry is read
  with `getAsFile()`.
- **Requirement chips** follow §6.3 exactly in one helper: a button when offered, a link with a
  `url`, else a dashed label. A row shows the "v… out"/stale chip only with no offer, and a pack no
  manifest describes shows its contents ("1 spell · 3 classes").
- **The status line** (`#rulesStatus`, a live region) sits outside `#extPage`; Add doesn't re-check
  every source (it has already read the new manifest).
- **The official source's switch repaints at once**, and switching it on checks it.

### Deferred minors

- **M10:** three unauthenticated GitHub API calls per boot, against a limit of 60 an hour; memoise
  the release list.
- **N5:** simplifications (a shared newest-by-key helper; a size message keyed on the cap constant; a
  redundant `p&&`; an unneeded `_dups` copy); `extVerify()` doesn't compare the byte length with the
  declared `size`; a page with no `fetch` throws synchronously.
- **Task 3:** a plain source's URL is only checked to be non-empty (old relative sources by design;
  it reaches only `fetch()`).
- **Task 1:** `release-files` deletes then writes, not atomically as `pack` does. (Its stale loop's
  missing `isfile` guard was fixed with M9.)
- **Task 2:** `./build.sh --release --no-zip` skips `releases/data/` (the release skill always builds
  the zips, and CI catches a missing folder); `data-kit.py`'s leak test snapshots the shared temp
  folder, a narrow flake when two worktrees run the suite at once. (The exit handler's unguarded
  `fs.rmSync` was fixed under Ruling 18.)
- **Final review M2–M7:** stored manifests aren't re-read through `extEntry()` on load (M2); every
  source's manifest lives in the settings key (M3); render cost grows with a manifest's size (M4);
  Manual install reads a chosen file whole before its size check (M5); the home screen doesn't point
  at Extensions (M6); switching the official source on checks every source (M7).
- **Task 6, minor 10:** needs no fix.

### Open for Mike

- **The ≤560px update-notice row.** While a notice shows, a phone's header has a third row (the
  pills after the buttons). The alternative is one combined "↑ N" pill with a menu. The Task 6
  reviewer recommends keeping the row; see `.claude/qa/in-progress/102-extensions/`
  (`102-t6-fix2-pills-390.png`, `102-after-pills-390-*.png`).
