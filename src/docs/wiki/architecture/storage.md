# Storage

Everything a player keeps lives in the browser, and the app has to work offline from `file://`.
Characters, the character library index and settings go in `localStorage`. The merged rules pool
(every loaded pack) goes in IndexedDB, with a compressed `localStorage` copy as its fallback,
because at five packs it no longer fits in the ~5 MiB a browser gives an origin. The one rule this
page exists for: **a write that does not land must say so.** An empty `catch` around a storage
write is how five loaded packs quietly came back as two.

**Code:** `scheduleSave()`, `libLoad()`, `libSave()`, `libTouch()`, `backupCharacter()`,
`storageWhy()`, `saveSettings()`, `saveRulesCache()`, `idbOpen()`, `idbTx()`, `idbTimeout()`,
`lzwCompress()`, `lzwDecompress()`, `readRulesCacheString()`, `cacheBytes()` in
`70-persistence.js`; `loadRulesCacheAsync()`, `finishImport()` in `71-char-io.js`;
`loadCharById()`, `newCharacter()`, `deleteCharacter()`, `migrateOldChar()` in `75-home-theme.js`;
`rulesCacheWarning()` in `88-settings.js`; `boot()` in `90-boot.js` · **Tests:** `rules-data.js`
(the fallback, the loud path, the LZW round trips), `char-update.js` (backup semantics and the index
read-back) · **See also:** [Character model](character-model.md), [Rules packs](rules-packs.md),
[Home & characters](../features/home-and-characters.md),
[Rules-update tool](../features/rules-update-tool.md)

## How it works

| Where | Key | Holds |
|---|---|---|
| localStorage | `hw-fb-c-<id>`, from `charKey()` | one character, as `JSON.stringify(character)` |
| localStorage | `hw-fb-library` (`K_LIB`) | `{autoload, index:[{id, name, system, appVersion, updated}]}` |
| localStorage | `hw-fb-settings` (`K_SET`) | `settings`: skin, theme, rough, `rulesSources`, `setCollapse`, `rulesCollapse`, `tabIcons` |
| IndexedDB | database `hw-fb-cache`, store `kv`, key `rules` | the rules pool as plain JSON. This copy wins |
| localStorage | `hw-fb-rules` (`K_RULES`) | the rules pool, LZW-compressed. Fallback and migration source only |
| localStorage | `hw-fb-char` (`K_CHAR`) | a pre-library single-character save, moved into the library once by `migrateOldChar()` |

**Characters.** Every edit calls `scheduleSave()`, which debounces 500 ms and then writes the active
character's blob and refreshes its index entry through `libTouch()`. The index exists so the home
screen can draw every card, including the `appVersion` badge, without parsing every blob. The
`#savestate` chip reads "Saving…" and then "Autosaved". If the write throws, `lsOK` goes false and
the chip says **Use Save ↑**, pointing the player at the file export. Every load path runs
`migrate()` over what it read (see [Character model](character-model.md)). The character to open at
boot is `lib.autoload`, set from the home screen.

**Backups** (the rules-update tool takes one before touching a sheet): `backupCharacter()` writes a
deep copy under a new id with `isBackup:true` and a "(backup …)" name, adds it to the index, then
**reads the index back**. `libSave()` swallows its own quota error, so without the read-back a
backup could sit in storage invisible on the home screen, right after the player was told to go and
look for it there. It returns `{id, copy}` or `{error, copy}`. `error` comes from `storageWhy()` in
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
   says what to do. The pool stays loaded and usable for this session.

It returns a promise of the error string. When the promise settles it reports through
`updateRulesStatus()` and re-renders the loaded-data list, where `rulesCacheWarning()` puts the
message in red above the list. The callers have usually drawn their status line already by then,
which is why the report is asynchronous.

**Every IndexedDB call is timed out.** `idbOpen()` and each `idbTx()` go through `idbTimeout()`,
which rejects after `IDB_TIMEOUT` (4000 ms). A missing or throwing IndexedDB rejects at once. A
request that **hangs** and never fires success or error would leave the save unreported and boot
hydration unfinished forever, and that is how flaky WebKit on `file://` misbehaves.

**Boot order** (`boot()`): settings first, then the `localStorage` rules copy, read
**synchronously** through `readRulesCacheString()` so the first paint already has rules in hand.
Then `reindexRules()`/`recomputeDups()`, the static builders, `wire()`, `migrateOldChar()` and the
autoload. Only after that paint does `loadRulesCacheAsync()` read the IndexedDB copy,
`Object.assign` it over `rules`, re-index, and re-render every surface that shows rules. Finally,
`checkForUpdate()` runs.

**The compressor** runs only on the fallback path. It is LZW over UTF-8 bytes, and the dictionary
stops growing at 65,536 entries rather than resetting. Codes are packed **15 bits per character,
offset by 32**, so every unit falls in [32, 32799]. That is below the surrogate range, so each one
is a valid lone BMP character that survives a `localStorage` round trip. The stored value starts
with the tag `"\u0001LZ"`. An untagged value is a plain-JSON cache from an older build and still
reads, and a corrupt payload decodes to `""` ("nothing cached") rather than throwing at boot. On the
real packs it measured 4.33 MiB → 0.83 MiB (19%), so all five fit even with no IndexedDB at all.

## Rules that must hold

- **No silent storage writes.** A new write either reports failure on a surface the player sees
  (the save chip, a returned error, the red loaded-data line) or has a recorded reason not to. The
  paths that already comply are autosave, `backupCharacter()` and `saveRulesCache()`.
- **Every IndexedDB request goes through `idbOpen()`/`idbTx()`,** so the timeout covers it.
- **Boot reads the `localStorage` rules copy synchronously, before first paint.** Browsers that
  refuse IndexedDB have no other copy.
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
- **The migrating boot flickers once.** A stale `localStorage` copy paints first and IndexedDB
  replaces it a tick later. It heals itself after the first successful save, which deletes the old
  key.
- **The harness has no `indexedDB`,** so the suite exercises only the fallback and, through its
  `quotaFull` switch, the loud path. The IndexedDB path and the timeout were verified in a browser
  (a stub `indexedDB.open` that never fires settles in 4003 ms and falls back), not by the suite.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where the rules pool lives | IndexedDB, with `localStorage` as fallback and migration source | Staying in `localStorage` and trimming: the pool does not fit, and trimmable metadata is 1.2% of it (L1950) |
| Whether to compress the IndexedDB copy | No, only the fallback | Compressing both: IndexedDB has room, and plain JSON there stays debuggable (code comment) |
| How LZW codes are stored | 15 bits per character, offset by 32 | 16-bit packing: lone surrogates, which some browsers silently mangle (L1993) |
| What happens when the LZW dictionary is full | Stop growing | Resetting: the decoder's dictionary lags one step, a classic off-by-one that shows only on huge inputs (L1993) |
| A hanging IndexedDB request | Time out at 4 s and fall back | — (L1993) |
| What a failed backup returns | `{error, copy}`, so the caller can offer a download | Returning `null`: every failure looked the same and dead-ended the update tool (L1116) |

## Open

- **Some writes still fail silently.** `finishImport()`, `newCharacter()` and `migrateOldChar()`
  wrap their `localStorage.setItem` in an empty `catch`, as do `libSave()` and `saveSettings()`.
  `migrateOldChar()` then deletes the legacy key even if the copy did not land. An import into a
  full store stays active in memory with nothing said, and the failure shows only when the next
  edit's autosave fails.
- **A stale IndexedDB copy can win.** If IndexedDB held the pool once and a later save fails over to
  `localStorage`, the older IndexedDB copy is left in place, and `loadRulesCacheAsync()` lays it
  over the newer fallback copy on the next boot. Found by reading the code, not reproduced.
- `boot()` and `renderHome()` call `localStorage.getItem` outside a `try`. A browser that throws on
  storage access (a blocked origin) would stop boot there. **(unverified)**: no such browser has
  been tested.
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
