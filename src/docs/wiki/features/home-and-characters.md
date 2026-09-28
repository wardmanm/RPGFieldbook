# Home & characters

The home screen is the character library: every saved character as a card, with New character,
Import, an autoload star and a delete button, plus a setup panel for appearance and rules packs on
first run. Behind it sit one localStorage blob per character and a small library index, the Save and
Load buttons that export and import a character as a `.json` file (with a prompt when the file's id
is one you already have), and the snapshot backups the rules-update tool takes before it changes a
sheet.

**Code:** `renderHome()`, `loadCharById()`, `newCharacter()`, `deleteCharacter()`, `setAutoload()`,
`migrateOldChar()`, `openNewCharacter()` in `75-home-theme.js`; `libLoad()`, `libSave()`,
`libTouch()`, `backupCharacter()`, `storageWhy()`, `scheduleSave()` in `70-persistence.js`;
`importChar()`, `finishImport()`, `exportChar()`, `migrate()` in `71-char-io.js`; the home wiring in
`90-boot.js` · **Tests:** `char-update.js` (backups), `sheet.js` (`migrate()` round trips) ·
**See also:** [Storage](../architecture/storage.md), [Character model](../architecture/character-model.md),
[Rules-update tool](rules-update-tool.md), [Settings & updates](settings-and-updates.md)

## How it works

**The library.** Each character is one localStorage key, `charKey(id)` = `hw-fb-c-<id>`, holding the
whole object as JSON. The index lives under `K_LIB` (`hw-fb-library`) as
`{autoload, index:[{id, name, system, appVersion, updated}]}`; `libLoad()` returns an empty library
on any read or parse failure. `libTouch()` rewrites the active character's index entry, and runs on
every autosave: `scheduleSave()` debounces 500 ms, writes the blob, touches the index, and sets the
top-bar `#savestate` to "Autosaved" — or "Use Save ↑" if the blob write throws. `appVersion` is on
the index so a card can badge it without parsing every blob.

**The screen.** `#home` is a fixed overlay in the template shell, not a tab. `showHome()` opens it
from the top bar's house button (`#btnHome`) and from Settings → Characters & backup → Open;
`hideHome()` closes it. `renderHome()` draws:

- **Cards**, newest `updated` first: name, a system badge (D&D / Humblewood), a version badge and a
  relative time from `fmtWhen()`. The badge (`.verbadge`) gains `.old` and an ↑ when
  `cmpVer(appVersion, APP_VERSION)` is negative; a sheet never stamped (`""`) counts as behind.
- **The star** (`data-autoload`) makes that character open at boot. One at a time; tapping the lit
  star clears it.
- **Delete** (`data-delchar`) confirms, then `deleteCharacter()` drops the index entry and the blob,
  clears autoload if it pointed there, and nulls `activeId` if that character was open.
- **The setup panel** (`#homeSetup`: skin, mode, hand-drawn borders, bulk rules import, loaded data,
  Clear all) shows on first run — no saved settings, or no characters — or when the cog toggles
  `homeForceSetup`. The cog is hidden on first run; "Back to sheet" shows only when a character is
  active.

**New character.** `openNewCharacter()` asks for a name and a system (Humblewood preselected) and
calls `newCharacter(name, system)`: `blankChar()`, the system, `seedGlossary()`, the `appVersion`
stamp, a blob write, `libTouch()`, the skin switched to match the system, `renderAll()`,
`hideHome()`. The system picks the skin and wordmark, filters the ancestry picker's species (see
[Character building](character-building.md)) and sets which coins show; classes, spells, feats and
items from every loaded pack stay available either way.

**Opening one.** A card calls `loadCharById()`: `migrate(JSON.parse(raw))`, skin from system,
`renderAll()`, `hideHome()`, then `maybePromptUpdate()` with the sheet already behind it.

**Boot.** `boot()` runs `migrateOldChar()` — which moves a pre-library single character (`K_CHAR`,
`hw-fb-char`) into the library, only when the index is empty — then opens the autoload character if
its id is still indexed. Otherwise it renders an in-memory blank (glossary seeded) behind the home
screen so the sheet underneath is valid.

**Export.** Save (`#btnSave`) is `exportChar()`: the whole `character`, pretty-printed, downloaded
by `dl()` as `humblewood-<name>.json`. The prefix is the same for a D&D character.

**Import.** Load (`#btnLoad`) and the home screen's Import (`#homeLoadChar`) both click the one
hidden `#fileLoad`, whose change handler calls `importChar(file)`:

1. Parse, and refuse anything without `abilities` ("That doesn't look like a Fieldbook character
   file.").
2. `migrate()` it.
3. Clash check: the index has this id, **or** a blob already sits at `charKey(id)`.
4. No clash → `finishImport()`. Clash → a modal: **Cancel**, **Import as copy** (a fresh `uid()`,
   name + " (copy)"), or **Replace <name>**.

`finishImport()` makes it the active character, writes the blob, touches the index, switches the
skin, renders, hides home, and calls `maybePromptUpdate()` last.

**Backups.** `backupCharacter(ch, tag)` deep-copies the character under a new id, names it
"<name> (backup <tag>)", sets `isBackup:true`, and writes the blob and an index entry **without**
switching to it. It returns `{id, copy}`, or `{error, copy}` where `error` is a phrase from
`storageWhy()` ("your browser's storage is full", "…is blocking storage for this page"). The index
write is read back; if it did not land, the orphan blob is removed and an error returned. The only
caller is the rules-update tool, with tag `v<appVersion>`. A backup is an ordinary card on the home
screen; `isBackup` only stops it being offered updates itself. Settings → Characters & backup also
exports and imports *settings and rules data* — not characters (see
[Settings & updates](settings-and-updates.md)).

## Rules that must hold

- **`migrate()` sits on every load path** — card, autoload, import, `migrateOldChar()` — and
  preserves every field. A whitelist there drops new fields on every page refresh, not only on
  import. Mechanism: [Character model](../architecture/character-model.md).
- **Every route that makes a character active ends in `renderAll()`.** The ability layout, the HP
  and coin boxes (not `data-path`) and the combat view all refill there; a new route that skips it
  shows the previous character's markup.
- **`maybePromptUpdate()` runs after the sheet is drawn**, and in `finishImport()` after the clash
  modal, so it stacks over it rather than under it.
- **One import path.** Both buttons feed `#fileLoad` → `importChar()`, so the parse guard,
  `migrate()`, the clash prompt and the skin switch exist once. A hidden file input answers a
  programmatic `.click()` even with the home overlay over it **(unverified)**.
- **The home Import button is `#homeLoadChar`.** `#homeImportBtn` is the bulk *rules* import on the
  same screen.
- **The modal must layer above home**: `.backdrop` is `z-index:80`, `.home` is `60`. The clash
  prompt and the update nudge both open over the home screen.
- **A backup never switches the active character**, verifies its index entry, and hands back the
  snapshot on failure — the update tool's "backup first" promise depends on all three.

## Traps

- **`libSave()` swallows its own quota error.** Anything that needs to know its index write landed
  must read it back, as `backupCharacter()` does. Autosave does not: "Autosaved" reflects the blob
  write only, so a full quota can leave the index (and the home card) stale.
- **`newCharacter()` and `finishImport()` write the blob inside an empty `catch`.** If that first
  write fails, nothing says so until the next edit's autosave reports "Use Save ↑". This falls short
  of the "a write that does not land must say so" constraint in [CLAUDE.md](../../../../CLAUDE.md).
- **The clash check reads storage as well as the index**, so a blob whose index entry was lost
  still prompts rather than being silently overwritten.
- **A backup looks like any other card.** The index entry does not carry `isBackup`; only the
  "(backup vX)" name tells them apart, and nothing deletes them automatically.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| What `migrate()` carries across | Every field by default, then normalizes the structured ones | A field whitelist: recently added fields vanished on import and on every autosave restore |
| A file whose id you already have | Ask: Replace, Import as copy, or Cancel; a new id imports with no prompt | — |
| Where the home Import button gets its logic | It clicks the existing hidden `#fileLoad` | A second input and handler: the parse guard, clash prompt and skin switch would be duplicated |
| How a card knows a sheet is behind | `appVersion` rides on the library index | Reading and parsing every character blob to draw the list |
| What a failed backup returns | `{error, copy}`, so the caller can offer the snapshot as a download | Returning `null`: every cause became the same dead-end modal, with no way on and no clue which it was |

## Open

- The empty-`catch` blob writes in `newCharacter()`, `finishImport()` and `migrateOldChar()`, and
  the unchecked index write behind autosave, delete and the autoload star, can each fail silently.
  See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — `migrate()` preserves every field; active spells, granted gold and attack collapse
  state stopped vanishing on import and refresh. → ledger L284
- 2026-08-07 — import detects an id clash and offers Replace / Import as copy / Cancel. → ledger L312
- 2026-08-07 — the card's delete button centred (`.hcard>.icon{align-self:center}`). → ledger L497
- 2026-08-07 — Import on the home screen, reusing `#fileLoad` rather than a second path. → ledger L505
- 2026-08-10 — `appVersion` on the library index and the card's version badge; `backupCharacter()`
  added for the update tool. → ledger L702
- 2026-08-10 — backups return the snapshot on failure and verify the index write. → ledger L1116
