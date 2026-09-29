# Rules-update tool

A character stores **copies** of rules entries — features, spells, items — so as the packs are
updated, a sheet drifts from them. This tool finds the drift and lets the player apply it row by row.
It matches each copy back to its pack entry through a provenance stamp, tells a change in the pack
from an edit by the player, offers traits the rules now grant that the sheet lacks, and applies only
what the player ticks. Three promises hold throughout: it **never deletes**, it **never touches the
player's own numbers**, and it **never updates without a backup first**.

**Code:** `stampSrc()`, `restampSrc()`, `updProject()`, `fpMap()`, `updResolve()`,
`updTraitFromOrigin()`, `updChangedFields()`, `updEdited()`, `updMissingTraits()`,
`diffCharacter()`, `applyUpdateRow()`, `applyUpdates()`, `updResyncAttack()`, `atkGenFp()`,
`stampAtkGen()`, `updAtkEdited()`, `charNeedsUpdate()` in `72-char-update.js`;
`openUpdateReview()`, `commitUpdates()`, `finishUpdates()`, `markCharChecked()`,
`maybePromptUpdate()`, `updRowHTML()` in `73-char-update-ui.js`; `fpHash()`, `fpNorm()` in
`00-constants.js`; `backupCharacter()` in `70-persistence.js`; `migrate()` in `71-char-io.js`;
`itemMetaLine()`, `costToGp()` in `25-origins-items.js` · **Tests:** `char-update.js`, with source
guards in `rules-data.js` · **See also:** [Home & characters](home-and-characters.md) (backups),
[Character model](../architecture/character-model.md), [Attacks & damage](attacks-and-damage.md),
[Features & traits](features-and-traits.md), [Spells](spells.md), [Inventory](inventory.md),
[CLAUDE.md](../../../../CLAUDE.md) §Architecture invariants

## How it works

**The stamp on the character.** `character.appVersion` means "last reconciled against", not "last
saved with". `blankChar()` seeds `""`; `newCharacter()` stamps `APP_VERSION`; `migrate()` preserves
it and **never** advances it. Only `markCharChecked()` advances it — after applying updates, or when
a check finds nothing to offer — and it clears `skipUpdate`. The library index carries the stamp, so
the home cards badge a sheet that is behind.

**When it asks.** `maybePromptUpdate()` runs last in `loadCharById()` and `finishImport()`, with the
sheet already drawn. `charNeedsUpdate()` says no for a backup (`isBackup`), when
`skipUpdate === APP_VERSION`, when the stamp is not behind, and when no packs are loaded. If it is
behind and the diff is empty, the sheet is quietly marked checked; otherwise a modal offers
**Not now**, **Don't ask again for vX** (sets `skipUpdate`, leaves the stamp) and **Review
updates**. Settings → This character → Rules updates is the manual way in, so dismissing is never a
one-way door.

**Stamping a copy.** Each copy site calls `stampSrc(copy, def, kind, cat, shape)`, which records
`copy.src = {cat, pack, kind, shape, name, fp, cfp}`:

- `fp` is `fpMap()` of the def as **projected** by `updProject()` — what a copy made that way should
  look like; `cfp` is `fpMap()` of the copy itself, at copy time. Each is only ever compared with its
  own kind.
- `fpMap()` holds one `fpHash()` per rules-owned field; `fpHash()` is a 32-bit djb2-xor over
  `fpNorm()`, which sorts keys, collapses whitespace and drops empties, so it is stable across key
  order and spacing.
- `UPD_FIELDS` is the allowlist of rules-owned fields: feature `description, effects, uses, cost`;
  spell `level, meta, text`; item `description, effects, cost, weight, weapon`. Everything else is
  the character's.
- `shape` is `"browse"` for an item added through the item finder — `updProject()` then prepends
  `itemMetaLine()` and converts the cost with `costToGp()`, as the finder did — and `"plain"` for
  everything copied verbatim. A plain item's cost is projected to its stored gp number too.
- The copy sites: `addFeatureFromDef()` (category `""`: a trait embedded in a class, race or
  background), `grantFeatDef()` (re-stamped against `feats`), `grantItemByName()`, the item finder,
  the spell finder, `addPickedFeature()`, and `applyUpdateRow()` for a trait it adds.

**Matching** (`updResolve()`):

| The copy | Resolves to |
|---|---|
| stamped, its pack loaded, one entry of that name there | that entry |
| stamped, several of that name in its pack | `ambiguous` |
| stamped, its pack not loaded, a same-named entry elsewhere | that entry, `loose` + `otherPack` |
| a trait with an `origin` and no category | the live class level, subclass level, species, subrace or background, via `updTraitFromOrigin()` |
| unstamped (legacy) | name only — one hit is `loose`, several `ambiguous` ("Feat: " is stripped to find feats) |

**The diff** (`diffCharacter()`) walks features, spells and inventory:

- ambiguous or unmatched → a row that can never be ticked;
- changed fields = `updChangedFields()`: for a stamped copy, the projection *then* (`src.fp`) against
  the projection *now*, only for fields that have a baseline; for a legacy copy, the copy against the
  projection. No changed fields, no row;
- edited = `updEdited()`: `src.cfp` against the copy now, three-valued — `null` with no baseline,
  which counts as edited;
- ticked by default only when not edited, not `loose` and not from another pack;
- plus `updMissingTraits()`: traits the sheet's species, subrace, background, classes and subclasses
  grant at the levels it holds but it does not have, keyed by origin + name. These are ticked.

**Review and commit.** `openUpdateReview()` groups the rows (Features & traits, Spells, Items), tags
them "new", "ambiguous", "not in your packs" or "you edited this", and adds Select all / Select none
with a count when more than one row is actionable — both skip disabled rows. The button reads "Back
up and update N", or "Back up and mark checked" with nothing ticked. `commitUpdates()`:

1. Names the backup `"<name> (backup v<appVersion>)"` **before** anything advances the stamp.
2. `backupCharacter()`. On success → `finishUpdates()`.
3. On failure, nothing has changed yet: a modal says why (`res.error`), names Settings → Rules data →
   Clear all as the way to free space, and offers **Download backup and update** — it downloads
   `res.copy` and carries on, or changes nothing if the download throws.

`finishUpdates()` runs `applyUpdates()`, `markCharChecked()`, `renderAll()` and `renderHome()`, and
shows a receipt naming where the backup is.

**Applying** (`applyUpdateRow()`). An added trait goes through `addFeatureFromDef()` and is stamped.
A changed row writes **only the fields the pack changed**, deep-copied from the projection (a field
the projection lacks is removed from the copy), puts back `uses.used`, and re-baselines both
fingerprints (`restampSrc()`) so the row is not offered again. A weapon then gets
`updResyncAttack()`. `applyUpdates()` re-syncs spell attacks for just the spells it rewrote. This is
how a pack correction reaches a saved sheet, and nothing else does: `migrate()` never rewrites a
copy. #74's `+N` weapons, for one, are offered as "effects changed" and applying it writes
`effects: []` and nothing else, leaving the weapon's `atkMisc` and its attack row as they were;
#76's five items with a conditional AC or saving-throw bonus (Quarterstaff of the Acrobat among
them) reach a sheet the same way, and the staff's AC drops back by 5; so do #77's 28 items that
gain `spell.attack` / `spell.dc`, raising the Spellcasting numbers once applied. #78's 54 items
whose text was a `{#itemEntry …}` tag are offered as "description changed", and applying writes
the book's text, under the finder's meta line for a finder-added copy, and nothing else. #79's Stone
of Good Luck and Ioun Stone of Mastery arrive as "effects changed": `check` +1 and `profBonus` +1.

**Attacks.** An attack generated from a weapon is not a copy of a rules entry and has no `src`; only
its item can rebuild it. Instead it carries `genFp`, one `fpHash()` over `ATK_GEN_FIELDS` — every
field `addAttackForItem()` sets, `proficient` and `addAbilityDamage` included. `stampAtkGen()` runs at
generation and when `syncItemAttack()` rewrites the row after an item edit; the attack form carries
`genFp` across its rebuild. `updAtkEdited()` is `false` (as generated), `true` (edited) or `null` (no
stamp), and `updResyncAttack()` rebuilds **only on `false`**, keeping the row's id so its collapse
state survives. Attack mechanics: [Attacks & damage](attacks-and-damage.md).

## Rules that must hold

- **Never deletes.** Unmatched and ambiguous rows are shown and disabled; nothing in apply removes a
  copy from the sheet.
- **Never touches the player's numbers.** Only `UPD_FIELDS` are written. `qty`, `equipped`,
  `prepared`, `uses.used`, `origin`, `grant`, `fav` and `id` survive untouched — asserted
  explicitly, since this is the promise most worth keeping.
- **Backup first.** `commitUpdates()` reaches `applyUpdates()` only after `backupCharacter()`
  returned an id or the download started.
- **`migrate()` never advances `appVersion`.** It runs on every load, so stamping there would erase
  the mismatch the tool exists to find.
- **`blankChar()` must not reference `APP_VERSION`.** `00-constants.js` calls `blankChar()` at top
  level, before `30-version.js` has run; the reference would throw in the temporal dead zone and
  white-screen the app. `char-update.js` evaluates the real concatenation in manifest order to catch
  it. See [Build & source split](../architecture/build-and-source-split.md).
- **A copy site stamps with the transform it applied**, and `itemMetaLine()` is the one definition
  of the finder's transform.
- **A form that rebuilds a record carries its stamp**: `src` on the feature, item and spell forms,
  `genFp` on the attack form. Each has a source guard in `rules-data.js`.
- **Only fields with a baseline can be "changed".** Adding a field to `UPD_FIELDS` must not flag
  every stamped copy at once; the `then[f] !== undefined` guard makes them baseline on the next
  restamp instead.
- **Origins are never re-applied wholesale.** Remove-then-add replays every level from 1 and destroys
  choices the app keeps no replay record of. Class, race and background *descriptions* re-resolve
  live by name, so they need no updating.
- **A guess is never ticked.** Legacy, loose, cross-pack and edited rows are offered unticked;
  ambiguous ones not at all.
- **`#mBody` outlives the modal**, so the review's delegated `change` listener is installed once.

## Traps

- **"A copy is not its def."** The first suite built copies by hand, which no copy site does, and
  hid five bugs: every finder-added item was a permanent false positive and "updating" it stripped
  the meta line and turned the cost back into a string (R1); a weapon update left its attack stale
  (R2); a Fighter/Barbarian was never offered Barbarian's Extra Attack, because missing traits keyed
  on a flat name set (R3); a copy whose pack was unloaded was silently matched to another pack's
  entry (R4); and the background branch was dead code, since a background has one `feature`, not
  `traits` (R5). The fixtures now build copies exactly as the app does, and each has an `R*` test.
- **The receipt named a backup that didn't exist** — built from `appVersion` after
  `markCharChecked()` had advanced it.
- **The backup dead end.** One `try/catch` returned `null` for every failure, surfacing as the same
  modal with no way forward. And `libSave()` swallowing its quota error could leave a backup that
  exists but never appears on the home screen.
- **Editing a spell threw away its stamp.** `openSpellForm()`'s rebuild dropped `src`, so every
  edited spell resolved `loose` with `updEdited()` `null`, and a same-named spell in a second pack
  made it `ambiguous`.
- **A resync overwrote player-edited attacks**, splicing the row out and regenerating it. The first
  `genFp` then left out `proficient` and `addAbilityDamage`, so unticking either was undone by the
  next resync.
- **The boot autoload gets no nudge.** The rules cache now lives in IndexedDB and
  `loadRulesCacheAsync()` hydrates it *after* the autoload, so `charNeedsUpdate()` sees no packs at
  that moment, and the hydration does not ask again. Loading from the home screen or importing still
  prompts. Traced in the code; the ledger's "cache restored before autoload" predates the IndexedDB
  move.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How a copy finds its entry | A stamp at copy time; resolve by pack + name | Re-syncing by name: `_id` is reassigned on every boot and import, `_source` was never copied, and one name can live in several packs — it would mis-match and destroy edits |
| How many fingerprints | Two: the def's (`fp`) and the copy's (`cfp`) | One: a copy is not field-identical to its def |
| Fingerprint granularity | A per-field map | One whole-object hash: couldn't say which field moved, so an update overwrote deliberate deviations such as a typed cost |
| What the diff compares against | The def projected through the copy's recorded shape | The raw def: every finder-added item read as permanently changed |
| Legacy, loose and ambiguous matches | Offered unticked, or not actionable at all | Guessing: "we would rather ask than guess" |
| The stamped pack is not loaded | Offer the other pack's entry, labelled and unticked | Adopting it silently as a confident match |
| Class, race and background drift | Per feature, spell and item only | Remove-then-add: replays every level and destroys ASI targets, skill picks, the subclass, the background feat and the ability spread |
| Where `appVersion` gets its first value | `""` in `blankChar()`, `APP_VERSION` in `newCharacter()` | `APP_VERSION` inside `blankChar()`: a top-level TDZ throw and a white screen |
| When a backup cannot be stored | Offer the snapshot as a download, then continue | Refusing: a dead end |
| An attack the player has edited | Leave it alone (owner's call) | Rebuilding it from the item: the edit went silently, with nothing to undo it |
| What `genFp` covers | Every field the generator sets, the two ticks included | Omitting `proficient` and `addAbilityDamage`: an untick was put back by the next resync |
| The shape of `genFp` | A single hash | An `fpMap`: nothing needs to know which field moved |

## Open

- The missing nudge on boot autoload, above.
- Attacks resolve only through their item; a hand-made attack is never offered an update.
- See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-10 — the `appVersion` stamp and the tool: copy stamps, fingerprints, graded matching,
  backup before any change. → ledger L702
- 2026-08-10 — five bugs found by probing the finished tool; per-field fingerprints and shape
  projections. → ledger L772
- 2026-08-10 — Select all / none; a failed backup offers a download; the index write is read back.
  → ledger L1116
- 2026-08-17 — the spell form keeps its `src` stamp. → ledger L2927
- 2026-08-17 — a resync leaves a player-edited attack alone (`genFp`). → ledger L2945
- 2026-09-28 — the pack fix for double-counted weapon bonuses reaches sheets as an `effects`-only row. → ledger L4392, #74
- 2026-09-28 — so does the fix for conditional AC and saving-throw bonuses. → ledger L4502, #76
- 2026-09-28 — and items' new spell attack and spell save DC effects. → ledger L4568, #77
- 2026-09-29 — and the 54 item descriptions that were a template tag, as a `description`-only row. → ledger L4634, #78
- 2026-09-29 — and the Stone of Good Luck's and Ioun Stone of Mastery's new effects. → ledger L4689, #79
