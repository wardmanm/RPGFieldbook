# Character model

A character is one plain JSON object, held in the global `character`. `blankChar()` defines its
complete default shape. `migrate()` turns anything read back from storage or a file into a valid
character **without losing a field**, including fields this build has never heard of. Every save is
`JSON.stringify(character)` and every load is `migrate(JSON.parse(…))`. Backward compatibility
comes from keeping that loop lossless: a sheet saved by any version must still open.

**Code:** `blankChar()`, `glossRepair()` in `00-constants.js`; `migrate()`, `migrateWeaponEquip()`,
`exportChar()`, `importChar()`, `finishImport()` in `71-char-io.js`; `migrateAmmo()`,
`ammoSpentMap()`, `ammoRecoveryOf()` in `62-ammo.js`; `newCharacter()`,
`loadCharById()` in `75-home-theme.js`; `charNeedsUpdate()` in `72-char-update.js`;
`markCharChecked()` in `73-char-update-ui.js`; read-time guards `featCol()`, `invCol()`, `atkCol()`
in `20-lists.js`, `encMode()` in `25-origins-items.js`,
`noteMap()` in `87-notes.js`, `combatSectionsOf()` in `87-combat.js`,
`cleanParty()`, `cleanCombatants()` (#91, in `migrate()`'s own cleaning block) in `87-initiative.js`, `cleanInvLog()`, `INV_LOG_SIZES` (#47) in `67-trade.js`, `chipList()`,
`advancementOf()` in `41-chips.js`; the #103 pass `migrateSheet103()`, `mergeNoteInto()`,
`liftLanguages()` in `71-char-io.js`, `ensureDefaultLanguages()` in `41-chips.js` · **Tests:** `char-update.js`
(the stamp is preserved and never advanced; unknown fields survive), `tables.js` (the round trip is
idempotent), `sheet.js` (sub-key defaults arrive through `migrate()`; malformed glossary entries and
junk list items, repaired, idempotent, and rendered) · **See also:**
[Storage](storage.md), [Rules-update tool](../features/rules-update-tool.md),
[Story & notes](../features/story-and-notes.md), [Ammunition](../features/ammunition.md),
[Build & source split](build-and-source-split.md)

## How it works

**The shape.** `blankChar()` returns every field a character can have, with a default:

| Kind | Fields |
|---|---|
| identity | `id` (from `uid()`), `appVersion` `""`, `system` `"humblewood"`, `name` |
| structured objects | `hp` `{cur, max, temp, locked:true}`, `death`, `coins` `{cp…pp}`, `abilities` (10 each), `saves`, `skills` (0/1/2), `slots` `{1…9: {total, used}}` |
| lists | `classes`, `grants`, `features`, `inventory`, `attacks`, `spells`, `activeSpells`, `statuses`, `familiars`, `glossary`, `resources`, `journal`, `trackers`, `party` `[{id, name, ac, maxHp}]` (#91, the Bio-tab roster), `combatants` `[{id, kind, name, init, ac, track, band, hp, maxHp, dead, partyId}]` (#91, always `[]` out of combat), `invLog` `[{id, at, kind, title, lines, undo, undone, meta}]` (#47, the inventory log, newest first), `levelLog` `[{at, class, level, hp, features:[{id, name, grants}], abilities, subclass, grants, slots}]` (#118, one record per level-up for level down, oldest first, at most 200; `migrate()` keeps a record only when it is an object with a string `class`, a `level` above 0 and a `features` array) |
| chip lists (#103) | `resists` `[{id, name}]`, `immunes` `[{id, name}]`, `senses` `[{id, name, range}]` (`range` whole feet or `""`), `languages` `[{id, name, src}]` (`src` `""` the player's, `race:…` / `bg:…` a grant, `system` a ruleset default) — all `[]` in `blankChar()` |
| maps | `featCollapse`, `invCollapse`, `atkCollapse`, `hdUsed`, `grantGold`, `secNotes`, `noteCollapse`, `editHide` (card key → `true` for a hidden card's edit/delete/remove buttons, #97), `journalCollapse`, `trackerCollapse`, `trackerTotals` (tag key → `true` for a shown total, #93), `ammoSpent` (stack or thrown-weapon id → `{n, hits, misses, kind, snap}`, #104; an entry from before #104 has neither `hits` nor `misses`, read as 0), `ammoFight` (ammunition kind → `{fired, back}`: what a row's Recover gave back during the current fight, for End combat's log line; `{}` default, emptied at the start and end of a fight, #47) |
| origins | `race` (`null` or `{name, subrace}`), `bg` (`null` or `{name, feat, abils}`) |
| per-character settings | `hpColor`, `showTrackers` (read as `!== false`), `size`, `encumbrance`, `coinWeight`, `combatSections`, `combatActive`, `combatRound`, `combatTurn` (the acting combatant's id, `""` default, #91), `initMode` (`"turns"` or `"rounds"`, `"turns"` default, #91), `initShowRolls` (boolean, `true` default, #91), `ammoRecovery` (`"half"` default, #104), `advancement` (`"xp"` or `"milestone"`, `"xp"` default, read through `advancementOf()`, #103), `showFamiliars` (the header's paw, `false` in `blankChar()`, #103), `hiddenTabs` (word tabs this character has switched off, `[]` default, cleaned by `migrate()`, #52), `invLogSize` (how many log lines to keep: 100, 250, 500, 1000 or 2500, `500` default, #47), `featsAllowed` (offer a feat at an ASI, `true` default; `migrate()` keeps a boolean and sets anything else to `true`, #118) |
| retired, kept for old sheets | `hdStyle` (the three hit-dice looks) and `statStyle` (the By ability layout), both gone with #103; `migrate()` still carries them so an old save round-trips, nothing reads them |
| text | `alignment` (on Bio since #103), `xp` (a number or digits with commas; anything else shows as typed), `proficiencies`, and the eight `BIO` fields: `appearance`, `personality`, `ideals`, `bonds`, `flaws`, `backstory`, `allies`, `notes` |

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
   objects, and `race`/`bg` become `null` unless they are plain objects. `editHide` defaults to
   `{}` in `blankChar()` and sits in `71-char-io.js`'s object-shape guard beside `noteCollapse` and
   `trackerTotals`: a non-object, an array or `null` becomes `{}` (#97). Its values are read
   `=== true`, so junk left inside the map reads as shown rather than needing its own coercion.
6. Each glossary entry is repaired, never dropped: `glossRepair()` fills an absent or blank `term`
   from `name` and an absent `text` from `description` (the other categories' field names, kept as
   they were), a numeric term becomes text, and an entry with no id gets one from `uid()` (a numeric
   id becomes text), so the Rules tab's Edit and Delete can find it. One with no term at all stays,
   listed there as "(no term)" and never matched (see [Rich text](rich-text.md)).
7. `migrateWeaponEquip()` runs next. It is a one-time fix, recorded by `wpnEquipInit`, that equips
   every weapon on a sheet saved before weapons could be equipped.
8. `migrateAmmo()` runs after it: a one-time pass, recorded by `ammoInit` (never defaulted in
   `blankChar()`, as `wpnEquipInit` isn't), that unpacks known ammunition bundles and gives a kind to
   known pieces and launchers. It runs while `ammoInit` is below `AMMO_PASS` (2): pass 1 for sheets
   saved before ammunition, pass 2 for copies made since from a pack older than it.
   `newCharacter()` sets `ammoInit` to `AMMO_PASS` directly on the character it creates, so the pass
   never runs on a brand-new sheet, which has nothing for it to migrate. An item's own `ammo` and `ammoStack` need no default — see
   [Ammunition](../features/ammunition.md).
9. `hiddenTabs` is cleaned next, right before `migrateSheet103()`: `cleanHiddenTabs()` forces a
   non-array to `[]`, drops any name not in `HIDEABLE_TABS`, and drops a repeat, keeping first-seen
   order (#52, see [Shell](../ui/shell.md)).
   Alongside it, `party` and `combatants` go through `cleanParty()`/`cleanCombatants()` (#91,
   `87-initiative.js`): `party` drops any entry with no name and forces `ac`/`maxHp` to a whole
   number or `""`; `combatants` reads `[]` outright when `combatActive!==true`, otherwise drops an
   unknown `kind` and any second `kind:"you"` row and forces every other field's type, names a
   blank foe "Unnamed" and a blank party row "Party member". Both give a missing or repeated id a
   fresh one (`initFreshId()`). `combatTurn` is `""` in Rounds mode; in Turns mode it keeps its id
   only if that row exists and is alive, else the first living row.
   Then the inventory log (#47): `invLogSize` keeps one of `INV_LOG_SIZES` or becomes `500`, and
   `invLog` goes through `cleanInvLog()`, which drops a line that is not an object, has an unknown
   `kind` or no `at`, forces each field's type (`lines` to `{dir, text}` with `dir` `+`, `-` or
   `""`; `undo` to `null` unless its shape fits its kind — `invUndoShape()` — and `meta` to an
   object or `{}`; `undone` to `true` only when it was), and keeps the newest `invLogSize` lines. A save from before #47 arrives with `[]` and `500`: nothing earlier
   is logged. See [Inventory](../features/inventory.md).
10. `migrateSheet103()` (#103) runs last. Each step is a no-op on a sheet that does not need it, so
   it is safe on every load:
   - the four chip lists go through `chipClean()` (a non-array reads `[]`, an entry that is not an
     object or has no string `name` is dropped, names trimmed, duplicates by name dropped case-blind,
     an entry with no id given one; a sense's `range` becomes whole feet or `""`); `advancement`
     through `advancementOf()`;
   - the retired cards' notes merge (`mergeNoteInto()`): `class` and `origin` into `portrait`,
     `rest` into `vitals`, each under a bold heading, keeping the earlier `at` and the later
     `editedAt` ([Story & notes](../features/story-and-notes.md));
   - in `combatSections`, `rest` and `portrait` become `vitals`, deduped;
   - "Languages: …" lines in `proficiencies` become the player's chips and leave the text
     (`liftLanguages()`), **once**: recorded by `langLifted`, which `newCharacter()` sets and
     `blankChar()` never does, so a line the player types later stays text;
   - `ensureDefaultLanguages()` adds the ruleset's default languages the sheet lacks (case-blind), as
     `system` chips — Common unless a pack declares `defaultLanguages`.

   `showFamiliars` is decided from the file before that: a stored boolean wins, else it is whether
   the sheet has a familiar.

**It is shallow on purpose.** Beyond each list item being an object, and the glossary repair
above, nothing inside a list item or a map value is shape-checked. The code that reads those values
guards them instead (a class, spell or status whose `name` is missing or a number is turned into
text before it is compared or sorted): `noteMap()`, `featCol()`, `invCol()`, `atkCol()` and
`combatSectionsOf()` each accept a missing or wrong-typed value. Resolvers such as
`encMode()` and `ammoRecoveryOf()` fall back to exactly the value `blankChar()`
defaults to, so an old sheet lands on the new-character look and the setting needs no migration of
its own — `ammoRecoveryOf()`'s fallback of `"half"` matches `blankChar()`'s own default (#104), so a
sheet saved before the field existed reads exactly as one that has it set to `"half"`. A status gains
its optional timed-condition fields the same way: `durationSec` and `elapsedSec` need no entry in
`blankChar()` or `migrate()`, since every reader coerces them (`statusDuration()`, `statusElapsed()`
in [Conditions & concentration](../features/conditions-and-concentration.md)).

**The round trip.** Autosave writes `JSON.stringify(character)`. `exportChar()` writes the same
object, indented, as `humblewood-<name>.json`, whatever the system. Every load path runs `migrate()`:
`loadCharById()`, `importChar()` (which accepts a file only if it parses and has `abilities`) and
`migrateOldChar()`. `newCharacter()` builds straight from `blankChar()`, then adds the default
languages and marks `ammoInit` and `langLifted` done.

**The version stamp, `appVersion`,** means "the app version this sheet was last **reconciled**
against", not "last saved with". `blankChar()` seeds `""`, `newCharacter()` stamps `APP_VERSION`,
and `migrate()` preserves the stamp and **never advances it**. Only `markCharChecked()` advances it,
when the player applies or dismisses an update. `libTouch()` copies the stamp into the library
index so a home card can badge it. `charNeedsUpdate()` is true when the stamp is behind
`APP_VERSION`, packs are loaded, the sheet is not a backup (`isBackup`), and the player has not
chosen "don't ask again" for this version (`skipUpdate`).

**`notes` and `secNotes` are different things.** `notes` is the eighth `BIO` string, the Bio
tab's "Notes" card, rendered into `#rt-notes`. It predates everything. `secNotes` is the per-section
notes map, keyed by `NOTE_SECTIONS` id (not by heading, which gets reworded). Each value is
`{text, at, editedAt}`, saving an empty note deletes the key, and they are gathered on the Journal tab (`#tab-journal`).
`journal` is a third thing: the Journal tab's own pages, `[{id, title, tag, text, at, editedAt}]`,
with ids repaired by `repairIds()` in `migrate()` ([Journal](../features/journal.md)).

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
- **Never merge or rename `notes` and `secNotes` into each other.** Either change breaks the Bio
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
| The chip lists (#103) | Their own fields, read through one guard, `chipList()` | Prose in `proficiencies`: a grant can't be taken back cleanly, and the Defences card needs a list |
| How often the Languages lift runs (#103) | Once, flagged by `langLifted` (never in `blankChar()`) | Every load: a "Languages:" line the player types later would be lifted too |
| List items that are not objects | Dropped: `null`, strings, numbers | Kept: no screen can show one and each stopped the render. Dropping only `null`: a bare string in `spells` still threw on the first write in strict mode (L4206) |
| A player's glossary entry with no term | Kept, given an id if it lacks one, listed as "(no term)" | Dropped: the player's own data, gone silently. Left without an id: Edit and Delete can't reach it (L4206) |
| A player's glossary entry written `{name, description}` | Read as its term and text, originals kept | Leaving it termless: those are the names every other category uses, so the intent is plain (L4206) |
| Pre-equip-era weapons | Equip them once, recorded by `wpnEquipInit` | Gating attacks on `equipped` with no migration: empties every existing Attacks card. Running it on every load: re-equips a weapon the player unequipped (L3213) |
| Where hidden tabs are scoped (#52) | Per character, saved on `character.hiddenTabs`; a new character shows every tab | Per device: a Fighter and a Wizard on one device want different tabs hidden |

## Open

- Nothing validates the inside of list items (items, spells, attacks, features). A hand-edited
  file with a wrong-typed field in an item relies on each reader coping.
- `newCharacter()` reads the default languages from the loaded packs; a sheet made before a cold
  rules cache has loaded gets the fallback Common even where a pack would declare others. Inert
  today: no pack declares `defaultLanguages` ([Known issues](../roadmap/known-issues.md)).
- Changing a sheet's system (Settings → Skin) does not swap its `system` chips for the new
  ruleset's (spec §4 asked for it). Inert today for the same reason.

## History

- 2026-08-07 — `migrate()` is rewritten to preserve every field and then normalize, and `grantGold` joins `blankChar()`. → ledger L284
- 2026-08-10 — The `appVersion` stamp arrives, meaning "reconciled against" and never advanced by `migrate()`. → ledger L702
- 2026-08-11 — `secNotes` is added beside, not instead of, `notes`. → ledger L1497
- 2026-08-11 — `size`, `encumbrance` and `coinWeight` arrive as scalars and need no `migrate()` change. → ledger L1361
- 2026-08-14 — `hp.locked` goes inside `hp`, so the sub-key fill migrates it. → ledger L2105
- 2026-08-18 — `migrateWeaponEquip()` and its flag, which was first set in `blankChar()` by mistake. → ledger L3213
- 2026-09-01 — `statStyle` is added as a per-character setting whose resolver needs no migration. → ledger L106, #17
- 2026-09-28 — `migrate()` keeps only objects in list fields, and repairs glossary entries (aliases, an id) without dropping any. → ledger L4206, #71
- 2026-09-29 — Journal pages: tags, search, timestamps, the page rule; the card and its editor. → ledger L4793, #40
- 2026-09-29 — Trackers: counters, checklists and tasks that close themselves when done, with Undo; registered section 20, in the combat view; hideable per character. → ledger L4822, #41
- 2026-10-02 — Ammunition: launchers fire from a loaded stack with Undo, bundles unpack on arrival, recovery at End combat and on the row, the loaded +N. → ledger L4952, #6
- 2026-10-02 — The final review's fixes: a hostile item name no longer stops a sheet loading; removing a class forgets its spent arrows; End combat asks only about new shots; recovery joins an equivalent stack; the picker shows +N. → ledger L4989, #6
- 2026-10-06 — Timed conditions: a duration in rounds, minutes or hours, counted down by the round
  tracker, clearing itself with an Undo. → ledger L5031, #55
- 2026-10-16 — `migrateAmmo()` runs once more on every sheet (`AMMO_PASS` 2); a new sheet starts at that pass. → ledger L5780, #96
- 2026-10-17 — `trackerTotals` joins the collapse-style maps, a per-tag switch for a tracker group's total (#93); `trackers[].type` loses `checklist` and `task`, migrated into journal pages by `migrateTrackerPages()` (#95). → ledger L6047, #95, #93
- 2026-10-19 — `ammoRecovery` joins the per-character settings, defaulted `"half"` in `blankChar()`; `ammoSpent` entries gain `hits`/`misses`. → ledger L6081, #104
- 2026-10-19 — `editHide` joins the collapse-style maps, defaulted `{}` in `blankChar()` and guarded the same way: a card key → `true` for a hidden card's edit, delete and remove buttons. → ledger L6248, #97
- 2026-10-23 — The Sheet makeover: `resists`, `immunes`, `senses`, `languages`, `advancement`, `showFamiliars`; `statStyle` and `hdStyle` retired, kept; `migrateSheet103()` merges the retired cards' notes, maps `rest`/`portrait` in the combat view to `vitals`, lifts "Languages:" lines once and adds the default languages. → ledger L6633, #103
- 2026-10-25 — `hiddenTabs` joins the per-character settings, `[]` in `blankChar()`, cleaned by `cleanHiddenTabs()` in `migrate()` right before `migrateSheet103()`: per character, so a new character shows every tab. → ledger L6989, #52
- 2026-10-25 — `party`, `combatants`, `combatTurn`, `initMode` and `initShowRolls` join `blankChar()` for the initiative tracker; `migrate()` cleans the first two through `cleanParty()`/`cleanCombatants()` right before `migrateSheet103()`. → ledger L7097, #91
- 2026-10-25 — Cleaning the fight dedupes ids, names blank rows, and sets `combatTurn` only in Turns mode and never to a dead row. → ledger L7212, #91
- 2026-10-25 — `invLog` and `invLogSize` join `blankChar()` for the inventory log; `migrate()` cleans them through `cleanInvLog()` after the fight's fields. → ledger L7291, #47
- 2026-10-25 — `ammoFight` joins `blankChar()` (`{}`, coerced to an object by `migrate()`); `cleanInvLog()` drops an `undo` whose shape doesn't fit its kind. → ledger L7339, #47
- 2026-10-27 — `featsAllowed` (`true`) and `levelLog` (`[]`) join `blankChar()`; `migrate()` keeps a boolean and the well-formed records. Undo level-up's copy is a module variable, never a field, so it is never saved. → ledger L7569, #118
