# Storage

Everything a player keeps lives in the browser, and the app has to work offline from `file://`.
Characters, the character library index and settings go in `localStorage`. The merged rules pool
(every loaded pack) goes in IndexedDB, with a compressed `localStorage` copy as its fallback,
because at five packs it no longer fits in the ~5 MiB a browser gives an origin. The one rule this
page exists for: **a write that does not land must say so.** An empty `catch` around a storage
write is how five loaded packs quietly came back as two.

**Code:** `scheduleSave()`, `saveNow()`, `showSaveResult()`, `retrySave()`, `leaveCharacterOk()`,
`libLoad()`, `libSave()`, `libTouch()`, `backupCharacter()`, `storageWhy()`, `storageBlockedWhy()`, `saveSettings()`, `saveSettingsSaid()`, `saveRulesCache()`, `idbReady()`, `idbOpen()`, `idbTx()`, `idbTimeout()`,
`lzwCompress()`, `lzwDecompress()`, `readRulesCacheString()`, `cacheBytes()` in
`70-persistence.js`; `loadRulesCacheLocal()`, `loadRulesCacheAsync()`, `finishImport()` in `71-char-io.js`;
`promptAfterRulesRestored()` in `73-char-update-ui.js`;
`loadCharById()`, `newCharacter()`, `deleteCharacter()`, `setAutoload()`, `migrateOldChar()`, `renderHome()` in
`75-home-theme.js`;
`rulesCacheWarning()`, `removeRulesGroup()`, `clearAllRules()`, `rulesSaveReport()`, `finishSettingsImport()` in `88-settings.js`; `convertSources()`, `extSaveErrorText()`, `runInstall()` in `89-extensions.js`; `boot()` in `90-boot.js` · **Tests:** `rules-data.js`
(the fallback, the loud path, the LZW round trips), `char-update.js` (backup semantics, the index
read-back, the refused-write paths and leaving a character), `sheet.js`'s boot & storage block (the
real `boot()` with storage blocked, which cache copy boot keeps, the boot autoload's prompt, a
refused removal; and #141's block at its end: a refused settings save said once, re-armed, quiet
after boot's blocked-storage alert but said when storage is blocked later, the boot fold kept and
cleared), `rules-data.js` again (every `saveSettings()` answer used, each
silent caller through `saveSettingsSaid()`) · **See also:** [Character model](character-model.md), [Rules packs](rules-packs.md),
[Home & characters](../features/home-and-characters.md),
[Rules-update tool](../features/rules-update-tool.md)

## How it works

| Where | Key | Holds |
|---|---|---|
| localStorage | `hw-fb-c-<id>`, from `charKey()` | one character, as `JSON.stringify(character)` |
| localStorage | `hw-fb-library` (`K_LIB`) | `{autoload, index:[{id, name, system, appVersion, updated}]}` |
| localStorage | `hw-fb-settings` (`K_SET`) | `settings`: skin, theme, rough, `sources` (the extension sources and their last-read manifests, #102; a `github` source's `token` lives here and nowhere else, #182: never in a character, never in the Settings file export), `packOrigin` (which source installed each pack), `dismissedUpdates` (the newest version of each pack, and `app`, whose notice the player cleared), `setPage` (the Settings page last viewed, #107), `setCollapse` (only its `ext:<section>` keys, the Extensions page's folds, are read now), `rulesCat` (the Rules tab's category last opened, #99), `tabIcons`, `backdropClose`; `rulesSources` and `rulesUrl` convert into `sources` at boot and are deleted, and `rulesCollapse`, the old Rules-tab fold state, is no longer read but stays in older saves |
| IndexedDB | database `hw-fb-cache`, store `kv`, key `rules` | the rules pool as plain JSON. This copy wins |
| localStorage | `hw-fb-rules` (`K_RULES`) | the rules pool, LZW-compressed. Fallback and migration source only |
| localStorage | `hw-fb-char` (`K_CHAR`) | a pre-library single-character save, moved into the library once by `migrateOldChar()` |

**Characters.** Every edit calls `scheduleSave()`, which debounces 500 ms and then writes the active
character's blob and refreshes its index entry through `libTouch()`. The index exists so the home
screen can draw every card, including the `appVersion` badge, without parsing every blob.
`scheduleSave()` calls `saveNow()` after the debounce, which writes the blob, then the index
(`libTouch()`), and returns "" or why a write failed (`storageWhy()`). `showSaveResult()` shows
the answer. The `#savestate` chip reads "Saving…" and then "Autosaved", or "Not saved". A
failure also raises `#saveWarn`, a strip fixed to the foot of the window on every tab. It gives
the reason and offers **Save to file** (`exportChar()`) and **Try again** (`retrySave()`), and
it stays up until a write lands. `newCharacter()` and `finishImport()` store the character first
and list it only once it is stored, then report through the same strip. So a character that
could not be stored is open to play and to save to a file, but has no home-screen card that
opens nothing.

**Leaving a character.** `loadCharById()`, `newCharacter()` and `finishImport()` each replace the
open character, and each calls `leaveCharacterOk()` first. If an edit is still waiting on the
debounce (`saveDue`, set by `scheduleSave()`), or the last write failed, it writes now, to the
character the edit belongs to. If that write still can't land, it asks: "“A”'s changes aren't saved
— <why>. Leave and lose them? Cancel, then use Save to file." No returns false and changes nothing.
It also hides the home screen, so the strip's Save to file is in view. A switch that goes ahead
calls `showSaveResult("")`, because the sheet on screen now matches storage. Before this, the strip
went on saying "Not saved" about the next character. And the switch it invited (Home, delete an old
character to make room, tap the first one's card) reloaded that first character from storage,
dropping the edits it had never written. With nothing waiting, nothing is written, so a switch
alone never moves a card up the home screen's `updated` order. Every load path runs
`migrate()` over what it read (see [Character model](character-model.md)). The character to open at
boot is `lib.autoload`, set from the home screen.

**Backups** (the rules-update tool takes one before touching a sheet): `backupCharacter()` writes a
deep copy under a new id with `isBackup:true` and a "(backup …)" name, adds it to the index, then
**reads the index back** rather than trusting `libSave()`'s answer. Without the read-back, a
backup could sit in storage invisible on the home screen, right after the player was told to go
and look for it there. It returns `{id, copy}` or `{error, copy}`. `error` comes from `storageWhy()` in
words a player can act on, and `copy` is always the snapshot, so a caller that cannot store it can
offer it as a download. A dropped index write removes the orphaned blob.

**The rules cache.** `saveRulesCache()` stringifies the whole `rules` object and:

1. with no `indexedDB`, goes straight to the fallback;
2. otherwise `put`s the JSON into IndexedDB. On success it clears `rulesCacheError` and **deletes
   `hw-fb-rules`**, which frees the megabytes that were also starving character autosave and
   backups;
3. on any IndexedDB failure (reject, throw or timeout) it falls back: LZW-compress, prefix the tag,
   and write to `localStorage`;
4. if that throws too, it sets `rulesCacheError` to a sentence that gives the size in **bytes**
   (`cacheBytes()`: UTF-16, two per character), says the packs will not be there next time, and
   says what to do. The pool stays loaded and usable for this session. After a removal
   (`saveRulesCache("remove")`, from Remove and Remove all) that sentence would be false, since the
   next boot loads the copy that last landed, which may hold what was removed, so it says that
   instead: "Your browser wouldn't save that change, so next time you open Fieldbook it will load
   the rules data it last saved, and what you removed may be back."

It returns a promise of the error string. On the IndexedDB path, when the promise settles it
reports through `updateRulesStatus()` and re-renders the loaded-data list, where
`rulesCacheWarning()` puts the message in red above the list (on the Extensions page, above its
sections). The callers have usually drawn their status line already by then, which is why the
report is asynchronous. With no IndexedDB the fallback runs at once, so `rulesCacheError` is set
when the call returns and the caller's own render shows the red line.
`fetchAllRules()` waits for that promise and writes the error into its own status line,
`finishSettingsImport()` does the same on the Import settings line, `runInstall()` puts it in
the install's toast, which then stays as an error, and Remove and Remove all hand it to
`rulesSaveReport()`, which writes their line plus the error on Settings' status line, in red, and
on the home screen's, as plain hint text like every message there (#143). A fetch that brought nothing does not save at all: the pool did not
change, so the cache already matches it, and overwriting it is how an offline Fetch all used to
leave the next launch with no rules (see [Rules packs](rules-packs.md)). An install that fails
changes nothing, so it saves nothing either.

**Settings** are one `localStorage` key, written whole by `saveSettings()` after every change.
It returns `""`, or why the write was refused (`storageWhy()`), and every caller uses that answer
(#141). A caller with a line of its own reports there: Import settings ("Settings imported for this
session only: …"), the Extensions page (#102: a source added, removed, switched or folded says
"Couldn't save …" on its status line, and an install puts it in its toast). Every other save goes
through **`saveSettingsSaid(what)`**: the Appearance controls (Skin, Mode, borders, Icon tabs, Tap
outside), the top bar's theme button, a Settings page switch, a Rules category tap, the home
screen's Skin, Mode and borders, and the two pills' ×. On a refusal it toasts an error that stays
until tapped (#87) and shows over Settings and the home screen: "Couldn't save your settings: *why*.
Changes to settings last until you close Fieldbook.", or with `what` "Couldn't save *what*: *why*."
(the pills: "that you cleared the notice"). Each sentence is said **once a session**: a page switch
and a category tap save too, so a full disk would otherwise toast at every ordinary tap. A save that
lands forgets what was said, so the next refusal is said again; the memory is a module `Set` in
`70-persistence.js`, never saved. It stays quiet once boot's alert has said storage is blocked and
nothing will be kept (`storageBlockedSaid`, set where `boot()` alerts); storage that worked at boot
and is blocked later had no alert, so its first refused save toasts why. The boot source check stays quiet too, so a save
refused there is kept (`extSaveErrorText()`) and the page shows it as "Couldn't save your sources
at the last check: …" until a later save lands; boot's own fold of old sources
(`foldLegacySettings()`) keeps a refused save the same way. Any settings save that lands clears
it, a source save or one through `saveSettingsSaid()`, which then repaints the page.

**Every IndexedDB call is timed out.** `idbOpen()` and each `idbTx()` go through `idbTimeout()`,
which rejects after `IDB_TIMEOUT` (4000 ms). A missing or throwing IndexedDB rejects at once. A
request that **hangs** and never fires success or error would leave the save unreported and boot
hydration unfinished forever, and that is how flaky WebKit on `file://` misbehaves.

**Boot order** (`boot()`): settings first, then the `localStorage` rules copy, read
**synchronously** through `loadRulesCacheLocal()` (which uses `readRulesCacheString()`) so the
first paint already has rules in hand. Then `reindexRules()`/`recomputeDups()`, the static
builders, `wire()`, `migrateOldChar()`, the autoload or the home screen, and the blocked-storage
check (below). Only after that paint does `loadRulesCacheAsync(haveLocal)` read the IndexedDB copy,
`Object.assign` it over `rules`, re-index, and re-render every surface that shows rules, and then
only when boot found no `localStorage` copy. When it restores the packs, `boot()` calls
`promptAfterRulesRestored()`, so a sheet the autoload opened with no packs yet is asked about
rules updates then (see [Rules-update tool](../features/rules-update-tool.md)). Finally, the network
checks run, `checkForUpdate()` first.

**Which rules copy boot keeps (#134).** The newest. A save IndexedDB takes deletes the
`localStorage` copy, so a `localStorage` copy that exists is the last save that landed (a fallback
save, or an old build's), never older than what IndexedDB holds. So when `loadRulesCacheLocal()`
read one, IndexedDB is not read at all; when there is none, or it can't be read (corrupt, not
JSON), the IndexedDB copy is used. A stale IndexedDB copy left behind by a fallback save stays on
disk unread until the next save IndexedDB takes overwrites it.

**Storage the browser blocks (#142).** A browser that blocks storage for the page (cookies blocked
for the site) throws at the first touch of `localStorage`, a read included; one with storage
switched off has no `localStorage` at all; and some throw at the mention of `indexedDB`. Every
read is in a `try`: `libLoad()`, `renderHome()`'s first-run test (a throw counts as a first run),
`loadRulesCacheLocal()`, `idbReady()` (false). So boot runs to the end as a first run, and then,
with the home screen up, says so once, with an alert like `migrateOldChar()`'s:
"Fieldbook can't use this browser's storage — *why*. Your characters and settings won't be kept
when you close it: save each character to a file with Save before you leave, or allow this page to
store data and open Fieldbook again." *Why* is `storageBlockedWhy()`: `""` when `localStorage` can
be read, "your browser has storage switched off for this page" when it is missing, else
`storageWhy()` of the throw ("your browser is blocking storage for this page" for a
`SecurityError`). From there each write reports itself as usual: a new character raises the save
strip.

`migrateOldChar()` returns "" or why the move failed (`storageWhy()`); the legacy `K_CHAR` key goes
only once the copy **and** its index entry have landed, so a refusal keeps the only copy where it
was rather than losing it. No character is open yet at that point for the save-warning strip to be
about, so `boot()` reports a failure with an alert instead, and says the old save is still there
and Fieldbook will try again next launch.

**The compressor** runs only on the fallback path. It is LZW over UTF-8 bytes, and the dictionary
stops growing at 65,536 entries rather than resetting. Codes are packed **15 bits per character,
offset by 32**, so every unit falls in [32, 32799]. That is below the surrogate range, so each one
is a valid lone BMP character that survives a `localStorage` round trip. The stored value starts
with the tag `"\u0001LZ"`. An untagged value is a plain-JSON cache from an older build and still
reads, and a corrupt payload decodes to `""` ("nothing cached") rather than throwing at boot. On the
real packs it measured 4.33 MiB → 0.83 MiB (19%), so all five fit even with no IndexedDB at all.

## Rules that must hold

- **No silent storage writes.** A new write either reports failure on a surface the player sees
  (the save chip, a returned error, the red loaded-data line, a status line) or has a recorded
  reason not to. The paths that comply are autosave, a new character and an import (`saveNow()`,
  `showSaveResult()`), leaving a character (`leaveCharacterOk()`), moving a pre-library save
  (`migrateOldChar()`), deleting a character and changing the autoload star (`deleteCharacter()`,
  `setAutoload()`, which alert, since the home screen covers the strip), `backupCharacter()`,
  `saveRulesCache()`, Remove and Remove all (`rulesSaveReport()`), Import settings for both of
  its writes, and every settings save (#141: `saveSettingsSaid()`, or the caller's own line). A
  bare `saveSettings();` whose answer is thrown away is a break of constraint 2, and
  `rules-data.js` fails on one.
- **A storage read can throw too.** Every `localStorage` and `indexedDB` touch on the boot path is
  in a `try`; a browser that blocks storage throws on `getItem`, and once that stopped boot at its
  first line (#142). Where storage can't be used at all, boot says so (`storageBlockedWhy()`).
- **Nothing replaces the open character without `leaveCharacterOk()`.** A new path that sets
  `character` must call it first and stop when it says no, or an unsaved edit is lost without a
  word.
- **A character is listed only once it is stored, and unlisted before it is removed.** An index
  entry for a blob that never landed is a card that opens nothing. So `deleteCharacter()` removes
  the blob only after the index write lands.
- **Never save a pool you did not mean to change.** A failed network call leaves the cache alone, and
  so does Import settings unless the player chooses to replace the rules.
- **Every IndexedDB request goes through `idbOpen()`/`idbTx()`,** so the timeout covers it.
- **Boot reads the `localStorage` rules copy synchronously, before first paint.** Browsers that
  refuse IndexedDB have no other copy.
- **A save IndexedDB takes deletes the `localStorage` copy, and boot keeps a `localStorage` copy
  over IndexedDB's.** The two go together: the first is what makes a `localStorage` copy the newest
  whenever it exists, and the second relies on it. Weakening either lets an older pool win at boot
  (#134).
- **`rules` must stay plain JSON.** It is persisted whole. `rules._dups` holds `Set`s, which
  serialise to `{}`, so `recomputeDups()` rebuilds it after every restore. `rules.requires` is kept
  as plain arrays for exactly this round trip. `_id` is reassigned by `reindexRules()` on every
  boot and import, so a character must never store one (see [Rules packs](rules-packs.md)).
- **15-bit packing, never 16.** 16-bit packing emits lone surrogates, which some browsers silently
  mangle, and that would be data loss dressed up as a fix.
- **Only the fallback compresses.** IndexedDB has room, and plain JSON there stays debuggable.
- **A backup is verified by reading it back,** not assumed from a write that did not throw.

## Traps

- **Five packs became two.** `saveRulesCache()` was one `localStorage` key and an empty `catch`. A
  refused write left the *previous* value in place, so the packs looked loaded all session and the
  next boot restored the older set. The pool is ~2.29 M characters but ~4.37 MiB as UTF-16, against
  a ~5 MiB quota shared with everything else. Quoting the character count is what made it look
  survivable. Trimming could not save it, since the regenerable metadata (`_id`, `_dups`) is 1.2%.
- **Two wrong diagnoses came first,** and both were tested before anything shipped. Quota could not
  be reproduced in Chromium at `http://127.0.0.1`, and the home-screen import path turned out to
  call the same `importRulesFiles()`. What settled it was proving the *read* side correct: write
  five packs, reload, and get the reporter's exact status line.
- **The fallback first existed but could not hold the data.** Uncompressed, five packs do not fit
  in `localStorage`, so "fall back to localStorage" was a promise it could not keep until the
  compressor went in.
- **A stale IndexedDB copy won (#134).** Boot used to treat IndexedDB as always authoritative and
  lay it over whatever `localStorage` had painted. After a save fell back to `localStorage`, that put
  the older pool back a moment after the first paint, the "five packs became two" bug by another
  road. It was found by reading the code and reproduced only once the real `boot()` ran under test.
- **Boot stopped at a dead read (#142).** `boot()` opened with `!localStorage.getItem(K_SET)`, outside
  a `try`, into a constant nothing used; `renderHome()` had the same read. A browser that throws on
  storage access stopped there, before anything was wired.
- **The harness's own `indexedDB` is `undefined`,** so most suites exercise only the fallback and,
  through its `quotaFull` switch, the loud path. `sheet.js`'s boot & storage block adds a small fake
  (open, put, get, each event a microtask later, and a switch that aborts every put) and runs the
  real `boot()` over it. The timeout is still verified only in a browser (a stub `indexedDB.open`
  that never fires settles in 4003 ms and falls back): the harness's `setTimeout` does nothing. A
  throwing `indexedDB` getter can't be reproduced in the harness at all (the vm reports a throwing
  global getter as "not defined"), so `idbReady()`'s `try` has a source guard instead.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where the rules pool lives | IndexedDB, with `localStorage` as fallback and migration source | Staying in `localStorage` and trimming: the pool does not fit, and trimmable metadata is 1.2% of it (L1950) |
| Whether to compress the IndexedDB copy | No, only the fallback | Compressing both: IndexedDB has room, and plain JSON there stays debuggable (code comment) |
| How LZW codes are stored | 15 bits per character, offset by 32 | 16-bit packing: lone surrogates, which some browsers silently mangle (L1993) |
| What happens when the LZW dictionary is full | Stop growing | Resetting: the decoder's dictionary lags one step, a classic off-by-one that shows only on huge inputs (L1993) |
| A hanging IndexedDB request | Time out at 4 s and fall back | — (L1993) |
| What a failed backup returns | `{error, copy}`, so the caller can offer a download | Returning `null`: every failure looked the same and dead-ended the update tool (L1116) |
| Which rules copy boot keeps (#134) | The `localStorage` copy whenever there is a readable one, since a save IndexedDB takes deletes it; IndexedDB's only otherwise | A saved-at stamp on both copies: both stored formats change, and the `localStorage` stamp can't be written atomically with its copy. Deleting the IndexedDB copy when a save falls back: a delete whose open is slow can land after a later save and remove the newest copy (L9281) |
| How boot reports storage it can't use (#142) | One alert once the home screen is up, as `migrateOldChar()`'s failure does | The save strip: no character is open for it to be about, and the home screen covers it (L9281) |
| How a refused settings save is reported (#141) | An error toast, through one helper beside `saveSettings()`; callers that already report keep their own line | A status line on each Settings page: three pages and the home screen would each need one. The character save strip: it is about the open character, and its button saves the character to a file (L9760) |
| How often it is said (#141) | Once per sentence a session, re-armed by a save that lands; quiet once boot's alert has said storage is blocked | On every refused save: a page switch and a category tap each save, so a full disk would toast on every tap (L9760) |
| The boot fold's refused save (#141) | Kept in `extSaveError`, so Settings → Extensions shows it, as the boot source check's is | A toast at boot: it would sit over the first paint about a conversion the player never asked for (L9760) |

## Open

- **Blocked storage is verified in the harness, not yet in a browser.** The three shapes (no
  `localStorage`, every call throwing `SecurityError`, the property throwing) run the real `boot()`;
  no browser with cookies blocked for the page has been opened.
- **iOS is untested.** Every iOS browser is WebKit, which has historically refused IndexedDB on
  `file://`. The compressed fallback is what makes that case safe, but no iOS device has been
  tried.
- `settings.autoload` is seeded in the default settings but never read. Autoload lives on the
  library object.

See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-10 — `backupCharacter()` arrives with the rules-update tool, and an update without a backup is refused. → ledger L702
- 2026-08-10 — Backups return `{id, copy}` / `{error, copy}`, and the index write is verified by reading it back. → ledger L1116
- 2026-08-14 — The rules cache moves to IndexedDB after five loaded packs reload as two, and a refused save now says so. → ledger L1950
- 2026-08-14 — Every IndexedDB call gets a 4 s timeout, and the `localStorage` fallback gains LZW compression. → ledger L1993
- 2026-09-28 — Fetch all saves only a pool it changed, and reports a refused save on its status line. → ledger L3797, #65
- 2026-09-28 — `saveSettings()` returns why a write was refused; Import settings reports that and a refused cache write beside its button, and writes the cache only when the player replaces the rules. → ledger L4134, #70
- 2026-09-29 — A refused character write raises a warning strip that stays until a save lands; new, imported and migrated characters report it too. → ledger L4771, #81
- 2026-09-29 — Leaving a character flushes its pending save and asks before dropping one that can't land; delete and the autoload star report a refused index write. → ledger L4856, #81
- 2026-10-16 — `settings.setPage` replaces the Settings fold state (`setCollapse`, no longer read). → ledger L5930, #107
- 2026-10-26 — `settings.sources`, `packOrigin` and `dismissedUpdates` replace `rulesSources`; the Extensions page's folds are `setCollapse` `ext:` keys; a source save refused at the boot check is kept and shown on the page. → ledger L7428, #102
- 2026-11-05 — `settings.sources` holds a private GitHub source's token, on this device only; `extSettingsForExport()` blanks it in the Settings export and `extKeepTokens()` keeps the device's own on import. → ledger L8943, #182
- 2026-11-06 — A storage read can no longer stop boot, and storage the browser blocks is said at boot; boot keeps the newest rules copy, not IndexedDB's always; Remove and Remove all report a refused save on their line, in words true for a removal. → ledger L9281, #142, #134, #143
- 2026-11-07 — Every settings save reports a refusal: `saveSettingsSaid()` toasts once a session, quiet when storage is blocked; boot's fold keeps its refusal for the Extensions page. → ledger L9760, #141
