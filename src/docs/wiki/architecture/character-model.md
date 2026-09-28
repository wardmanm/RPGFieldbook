# Character model

A character is one plain JSON object, held in the global `character`. `blankChar()` defines its
complete default shape. `migrate()` turns anything read back from storage or a file into a valid
character **without losing a field**, including fields this build has never heard of. Every save is
`JSON.stringify(character)` and every load is `migrate(JSON.parse(…))`. Backward compatibility
comes from keeping that loop lossless: a sheet saved by any version must still open.

**Code:** `blankChar()`, `statStyle()`, `glossRepair()` in `00-constants.js`; `migrate()`, `migrateWeaponEquip()`,
`exportChar()`, `importChar()`, `finishImport()` in `71-char-io.js`; `newCharacter()`,
`loadCharById()` in `75-home-theme.js`; `charNeedsUpdate()` in `72-char-update.js`;
`markCharChecked()` in `73-char-update-ui.js`; read-time guards `featCol()`, `invCol()`, `atkCol()`
in `20-lists.js`, `hdStyle()` in `65-resources.js`, `encMode()` in `25-origins-items.js`,
`noteMap()` in `87-notes.js`, `combatSectionsOf()` in `87-combat.js` · **Tests:** `char-update.js`
(the stamp is preserved and never advanced; unknown fields survive), `tables.js` (the round trip is
idempotent), `sheet.js` (sub-key defaults arrive through `migrate()`; malformed glossary entries and
junk list items, repaired, idempotent, and rendered) · **See also:**
[Storage](storage.md), [Rules-update tool](../features/rules-update-tool.md),
[Story & notes](../features/story-and-notes.md), [Build & source split](build-and-source-split.md)

## How it works

**The shape.** `blankChar()` returns every field a character can have, with a default:

| Kind | Fields |
|---|---|
| identity | `id` (from `uid()`), `appVersion` `""`, `system` `"humblewood"`, `name` |
| structured objects | `hp` `{cur, max, temp, locked:true}`, `death`, `coins` `{cp…pp}`, `abilities` (10 each), `saves`, `skills` (0/1/2), `slots` `{1…9: {total, used}}` |
| lists | `classes`, `grants`, `features`, `inventory`, `attacks`, `spells`, `activeSpells`, `statuses`, `familiars`, `glossary`, `resources` |
| maps | `featCollapse`, `invCollapse`, `atkCollapse`, `hdUsed`, `grantGold`, `secNotes`, `noteCollapse` |
| origins | `race` (`null` or `{name, subrace}`), `bg` (`null` or `{name, feat, abils}`) |
| per-character settings | `statStyle`, `hdStyle`, `hpColor`, `size`, `encumbrance`, `coinWeight`, `combatSections`, `combatActive`, `combatRound` |
| text | `proficiencies`, and the eight `BIO` fields: `appearance`, `personality`, `ideals`, `bonds`, `flaws`, `backstory`, `allies`, `notes` |

Inputs bound with `data-path` write the raw input string, so numbers on the sheet are often
strings, and code reads them through `num()` (integers) or `fnum()` (weights, coin). `""` is a real
value distinct from 0. In `hp`, for instance, it means "not set yet", and `clampHP()` preserves it.
`level` is derived: `recompute()` rewrites it from `classes` every time.

**`migrate(s)` preserves, then normalizes:**

1. Start from `blankChar()` and copy **every** key of `s` whose value is not `undefined`, so
   unknown and future fields survive.
2. Keep `s.id` (or mint one). Coerce `system` to `"dnd"` or `"humblewood"`, since anything else
   becomes `"humblewood"`. Keep `appVersion` if it is a string, else `""`.
3. `hp`, `death`, `abilities`, `saves`, `skills` and `slots` become `Object.assign(default, saved)`
   when the saved value is a plain object. That fills missing **sub-keys**, which is how every old
   sheet gained `hp.locked:true` with no migration code at all.
4. `coins` maps the legacy Humblewood keys (`km`, `sm`, `em`, `gm`, `pm`) onto `cp`…`pp`.
5. The list fields are forced to arrays **of objects**: `null` (what JSON writes for a hole or an
   `undefined`) and bare strings or numbers are dropped. The map fields are forced to plain
   objects, and `race`/`bg` become `null` unless they are plain objects.
6. Each glossary entry is repaired, never dropped: `glossRepair()` fills an absent or blank `term`
   from `name` and an absent `text` from `description` (the other categories' field names, kept as
   they were), a numeric term becomes text, and an entry with no id gets one from `uid()` (a numeric
   id becomes text), so the Rules tab's Edit and Delete can find it. One with no term at all stays,
   listed there as "(no term)" and never matched (see [Rich text](rich-text.md)).
7. `migrateWeaponEquip()` runs last. It is a one-time fix, recorded by `wpnEquipInit`, that equips
   every weapon on a sheet saved before weapons could be equipped.

**It is shallow on purpose.** Beyond each list item being an object, and the glossary repair
above, nothing inside a list item or a map value is shape-checked. The code that reads those values
guards them instead (a class, spell or status whose `name` is missing or a number is turned into
text before it is compared or sorted): `noteMap()`, `featCol()`, `invCol()`, `atkCol()` and
`combatSectionsOf()` each accept a missing or wrong-typed value. Resolvers such as `statStyle()`,
`hdStyle()` and `encMode()` fall back to exactly the value `blankChar()` defaults to, so an old
sheet lands on the new-character look and the setting needs no migration of its own.

**The round trip.** Autosave writes `JSON.stringify(character)`. `exportChar()` writes the same
object, indented, as `humblewood-<name>.json`, whatever the system. Every load path runs `migrate()`:
`loadCharById()`, `importChar()` (which accepts a file only if it parses and has `abilities`) and
`migrateOldChar()`. `newCharacter()` builds straight from `blankChar()`.

**The version stamp, `appVersion`,** means "the app version this sheet was last **reconciled**
against", not "last saved with". `blankChar()` seeds `""`, `newCharacter()` stamps `APP_VERSION`,
and `migrate()` preserves the stamp and **never advances it**. Only `markCharChecked()` advances it,
when the player applies or dismisses an update. `libTouch()` copies the stamp into the library
index so a home card can badge it. `charNeedsUpdate()` is true when the stamp is behind
`APP_VERSION`, packs are loaded, the sheet is not a backup (`isBackup`), and the player has not
chosen "don't ask again" for this version (`skipUpdate`).

**`notes` and `secNotes` are different things.** `notes` is the eighth `BIO` string, the Story
tab's "Notes" card, rendered into `#rt-notes`. It predates everything. `secNotes` is the per-section
notes map, keyed by `NOTE_SECTIONS` id (not by heading, which gets reworded). Each value is
`{text, at, editedAt}`, saving an empty note deletes the key, and the Notes tab is `#tab-notes`.

## Rules that must hold

- **`migrate()` preserves every field by default.** Never turn it back into a field whitelist.
- **A new field gets a default in `blankChar()`.** A scalar needs nothing else. An object or array
  field needs either a place in `migrate()`'s normalize lists or a guarding accessor at every read.
- **A setting's resolver falls back to its `blankChar()` default,** so no migration is needed.
- **`blankChar()` reads only what is defined above it in `00-constants.js`.** It runs at load,
  through `let character=blankChar()`. See [Build & source split](build-and-source-split.md).
- **A one-time migration flag is never set in `blankChar()`.** `migrate()` builds its result
  *from* `blankChar()`, so a flag set there arrives on every old sheet already marked done, and the
  migration silently never runs.
- **After `migrate()`, every item of a list field is an object.** A `null` throws on the first
  field read and, in strict mode, a string throws on the first write (`renderSpells()` normalises
  `level`, `detectSpellAttack()` sets `atkType`), and either blanks the sheet.
- **A glossary entry that is an object is never dropped,** whatever its shape: it is the player's.
  Repairs only add (`glossRepair()`), and an id is only given where there is none.
- **`migrate()` never advances `appVersion`.**
- **`migrate()` is idempotent** (asserted): migrating a migrated sheet changes nothing.
- **The character stays plain JSON:** no `Set`, `Map`, function or `undefined` that has to
  survive. It also never stores a rules `_id`, which is reassigned on every boot (see
  [Rules packs](rules-packs.md)).
- **Never merge or rename `notes` and `secNotes` into each other.** Either change breaks the Story
  tab or orphans every saved section note, and nothing throws.

## Traps

- **The whitelist `migrate()`.** It once carried only named fields. Because `migrate()` also runs on
  the autosave restore, recently added fields vanished on a page **refresh**, not only on import.
  Active spells, `grantGold` and `atkCollapse` were being dropped.
- **Where the stamp gets written.** Stamping `APP_VERSION` inside `blankChar()` is a TDZ
  `ReferenceError` at load, a white screen. Stamping it in `migrate()` erases the very mismatch the
  update tool exists to find. Hence `""` by default and a stamp in `newCharacter()`.
- **`wpnEquipInit` in `blankChar()`.** It was first set there ("a new sheet has nothing to
  migrate"), which pre-marked every old sheet and silently skipped the migration. The suite caught
  it, and asserts that `blankChar()` does not set the flag.
- **An object that never went through `migrate()`.** `hp.locked` is read as `!== false`, never as a
  truth test, so a character object with no `locked` key is locked, not silently editable.
- **`system` is not a pack name.** It is `"dnd"` or `"humblewood"`, and `migrate()` enforces that.
  Supplements such as `XGE` and `TCE` are packs, never systems a character is created in.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| What `migrate()` does with fields it does not know | Keep every field, then normalize the known structured ones | A field whitelist: new fields were silently dropped on every load, the autosave restore included (L284) |
| What `appVersion` means | The version last *reconciled* against | "Last saved with": `migrate()` runs on every load, so stamping there erases the mismatch the update tool needs (L702) |
| Where a new character is stamped | `newCharacter()` | `blankChar()`: it runs at top level before `30-version.js` defines `APP_VERSION`, a TDZ white screen (L702) |
| Where the Max HP lock lives | `hp.locked`, inside `hp` | A top-level `hpLocked`: inside `hp`, `migrate()`'s sub-key fill gives every old sheet the default for free (L2105) |
| The section-notes field | `secNotes` | Reusing `notes`: already the Story tab's bio field, so merging breaks that tab silently (L1497) |
| List items that are not objects | Dropped: `null`, strings, numbers | Kept: no screen can show one and each stopped the render. Dropping only `null`: a bare string in `spells` still threw on the first write in strict mode (L3985) |
| A player's glossary entry with no term | Kept, given an id if it lacks one, listed as "(no term)" | Dropped: the player's own data, gone silently. Left without an id: Edit and Delete can't reach it (L3985) |
| A player's glossary entry written `{name, description}` | Read as its term and text, originals kept | Leaving it termless: those are the names every other category uses, so the intent is plain (L3985) |
| Pre-equip-era weapons | Equip them once, recorded by `wpnEquipInit` | Gating attacks on `equipped` with no migration: empties every existing Attacks card. Running it on every load: re-equips a weapon the player unequipped (L3213) |

## Open

- Nothing validates the inside of list items (items, spells, attacks, features). A hand-edited
  file with a wrong-typed field in an item relies on each reader coping.

## History

- 2026-08-07 — `migrate()` is rewritten to preserve every field and then normalize, and `grantGold` joins `blankChar()`. → ledger L284
- 2026-08-10 — The `appVersion` stamp arrives, meaning "reconciled against" and never advanced by `migrate()`. → ledger L702
- 2026-08-11 — `secNotes` is added beside, not instead of, `notes`. → ledger L1497
- 2026-08-11 — `size`, `encumbrance` and `coinWeight` arrive as scalars and need no `migrate()` change. → ledger L1361
- 2026-08-14 — `hp.locked` goes inside `hp`, so the sub-key fill migrates it. → ledger L2105
- 2026-08-18 — `migrateWeaponEquip()` and its flag, which was first set in `blankChar()` by mistake. → ledger L3213
- 2026-09-01 — `statStyle` is added as a per-character setting whose resolver needs no migration. → ledger L106, #17
- 2026-09-28 — `migrate()` keeps only objects in list fields, and repairs glossary entries (aliases, an id) without dropping any. → ledger L3985, #71
