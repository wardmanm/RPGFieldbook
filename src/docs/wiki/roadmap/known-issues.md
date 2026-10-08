# Known issues

Everything known to be imperfect, postponed, or blocked on a source we don't hold, checked against the
code at `facbc78`. The last section lists things that look like gaps and are not: each was a
deliberate call, and "fixing" one would break something or contradict a rule. When an item here is
fixed, delete it and add a History line. When a new one is accepted, add it here and link it from the
page it concerns.

**See also:** [Grants & provenance](../architecture/grants-and-provenance.md),
[Computed stats & effects](../architecture/computed-stats-and-effects.md),
[Humblewood](../data/humblewood.md), [Converter](../data/converter.md),
[Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md), [2.0](2.0.md)

## Limitations

Known behaviour that is accepted for now.

- **Level-down only lowers the number.** `doLevelDown()` keeps every trait, proficiency, grant and
  choice from the level it removes. Grants are keyed by source (`class:<Name>`),
  not by level, so there is nothing per-level to revert. Removing the class reverts all of it, and
  race and background choices revert fully. → ledger L2571, and
  [Grants & provenance](../architecture/grants-and-provenance.md)
- **Hit points don't leave with a class above level 1.** Removing a class clears only the level-1
  seed: a first class added at level 3 and then removed keeps its levels 2–3, and removing a
  multiclass class keeps the hit points its levels added — the same as a class levelled up in play.
  → ledger L3886, and [Vitals & rest](../features/vitals-and-rest.md)
- **Multiclass ability prerequisites** (e.g. INT 13 for a Wizard) are neither carried by the pack nor
  enforced. → ledger L3886
- **A fetched source's packs stay until removed by hand** once the source is taken out of the list,
  and a pack fetched before `_url` stamping keeps any entry its source has since dropped (a re-fetch
  replaces the rest by name). Both follow from Fetch all never discarding what it didn't replace.
  → ledger L3797, and [Rules packs](../architecture/rules-packs.md)
- **A class's gold alternative is the average of its dice**, not a roll (`_dice_avg_gold()` in
  `convert.py`). → ledger L42
- **Granted items match the item list by exact name only** (`grantItemByName()`). Anything else is added
  as a plain named item with no description, cost or weapon data. The 2024 and Humblewood classes and
  backgrounds carry 18 such names, for example "Holy Symbol", "Druidic Focus", "a Gaming Set (your
  choice)" and "Traveling Clothes". → ledger L42
- **Missing references degrade quietly.** A feat that isn't loaded becomes an empty feature named
  `Feat: X`, and a missing granted item becomes a bare name. Only subclasses and declared `requires`
  are reported. → ledger L1883
- **Artificer and Mystic are 2014/UA content labelled XPHB** in `data/5e2024/classes.json`, picked up
  by a fallback in `convert_classes`. This was the owner's call: fixing it drops both from the core
  pack, bumps XPHB's data version, and strands anyone playing an Artificer on the core pack alone.
  Tasha's skips the Artificer and its subclasses instead of shipping duplicates. → ledger L1816
- **In the By ability ("grouped") layout a Skills note can't be started.** The Skills card is hidden,
  and the Section Notes card lists only sections that already have a note. Existing Skills notes stay editable.
  Mitigating it means a second note button in the Abilities label, which is worse UI than the gap.
  → ledger L106
- **`**Hit** Points` loses its glossary chip.** The asterisks break the `\b(term)\b` match. This is
  inherent to escaping first and matching second. → ledger L1504
- **The Dice hit-dice style can't mark a die spent without healing,** because tapping is the roll.
  Full and Condensed can, and the Settings hint says so. → ledger L2178
- **A favourited granted feature loses its star when the grant is rebuilt.** Changing subclass,
  removing a class or swapping ancestry runs `removeFeaturesWhere()` and re-adds through
  `addFeatureFromDef()`, which makes a new object. Inventory doesn't have this problem, because
  `grantItemByName()` reuses the item. Levelling up is safe: it only adds. → ledger L2381
- **Multiclass pact slots share one pool.** `autoSlots()` adds the Pact Magic slots onto the
  full-caster table, so a Wizard 3 / Warlock 3 reads L1:4 L2:4. A short rest restores the pact count
  from that shared pool. Real 5e tracks them separately. → ledger L3169
- **Feats picked from the feature finder get no skill-choice prompt.** `addPickedFeature()` adds with
  no origin, and `grantFeatDef()` only queues a feat's skill choices when a source id exists.
  → ledger L2776
- **The printed sheet** shows prepared spells as `◆`/`○` with no key (the same gap as the skill and
  save rows), and prints no item uses. → ledger L2345, L2818
- **The item finder has no Escape key of its own.** `openBrowse()` closes from its Close button only;
  the global Escape handler dismisses the modal and nothing else. → ledger L3397
- **At phone width** an attack row's name runs into its type label behind the to-hit pill, and a
  feature row's name crowds its source tag **(unverified)**: not re-checked in a browser since it was
  reported. → ledger L3525
- **2014-named single ammunition pieces keep their name on a sheet migrated before ammunition
  shipped.** "Crossbow Bolt" and "Blowgun Needle" learn the 2024 kind and fire, but `migrateAmmo()`
  never renames them, so the rules-update tool lists them as not in any loaded pack. Existing
  copies of the 35 dropped 2014 gear items ("Spell Scroll (1st Level)", "Rations (1 day)"…) show
  the same way. → ledger L4989, and [Ammunition](../features/ammunition.md)
- **Ammunition picker rows can look identical** when two grants each give "Arrow ×20": stacks of
  different grants stay apart by design, and nothing on the row tells them apart. An origin hint
  would. → ledger L4989, and [Ammunition](../features/ammunition.md)
- **Xanathar's five Adamantine Ammunition pieces carry rarity "Unknown"** (5e-tools writes
  "unknown"), which sorts first in the item finder's Rarity filter. → ledger L4989, and
  [Ammunition](../features/ammunition.md)
- **Fieldbook before 1.8.0 can't open the rules-data zip.** A player on an older copy unzips it and
  imports the `.json` files inside; the release notes, `NOTICE.md` and README §3a say so. The
  manifest has no rules keys, so an old copy given it as a loose file merges nothing. → ledger
  L5082, and [Data archive](../architecture/data-archive.md)
- **A data update is announced, never installed.** The notice links the release; the player
  downloads the zip and imports it. → ledger L5082, and
  [Settings & updates](../features/settings-and-updates.md)
- **The newer-data notice needs the network** (the GitHub releases list and the tag's registry), and
  is silent offline or when GitHub refuses, so an offline player never learns of a data release.
  It runs once per load, like the app's update check. → ledger L5082
- **With the D&D 2024 and SRD 5.2 packs both loaded, a shared table opens the 2024 copy.**
  `findTable()` takes the first match in load order and the archive loads the 2024 pack first, so
  the SRD's own wording of the Reincarnate, Deck of Illusions and Object Armor Class tables,
  corrected to the SRD PDF, is not what opens then. Both are the same table in two wordings (R5).
  → ledger L5148, L5269, and [SRD 5.2](../data/srd.md)

## Deferred

Wanted, not yet done. Each needs work, not a source.

- **Humblewood species have no size.** They all resolve to Medium (`charSize()`), but Jerbeen, Luma
  and Hedge are Small in the book. The fix belongs in `extract-humblewood.py`, which has a verbatim
  suite, so the data must not be hand-edited. A player can set size in Vitals meanwhile. → ledger L1426
- **Small tables inside features read as flat text.** Magic Item Hacking's rarity costs and the
  Spell Emulator component's tiers are examples. → ledger L3596
- **Rune Knight runes have no tracker.** They are per-rune uses, not a pool, so
  `class-resources.json` can't express them. → ledger L3649
- **Two spells' damage isn't read**: Delayed Blast Fireball ("base damage is 12d6") and Glyph of
  Warding ("5d8 Acid, Cold, Fire, Lightning, or Thunder damage"). Each needs its own pattern, and
  neither is worth one that risks false positives. → ledger L2989
- **Using an item can't remove a status** (Elixir of Health). That wants a list and a different UI.
  → ledger L2818
- **Twelve Sep 2024 characteristic tables** (Stonesinger, Warrenborn, Wonderstruck) are not extracted.
  Their pages stack tables both vertically and side by side, which the table reader doesn't handle. Six
  of the twelve came back malformed, so all twelve are dropped: a background gets its four tables or
  none. → ledger L1045, and [Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md) §7
- **Lower-value playtest tables not extracted:** the Gadgeteer progression table, Lunin Pedigree, the
  Whispering Wind expanded spells and Deep Roots' two tables. The features that cite them carry their
  full text. → [Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md) §7
- **Cervan "Surge of Vigor" has no uses tracker.** The ledger deferred it for want of the source, but
  the verbatim text now states the limit ("can't use this feature again until you have completed a
  Long Rest"), so it needs `uses {1/long}`, not a book. → ledger L1808, and
  [Humblewood](../data/humblewood.md)
- Journal pages and trackers don't print; trackers have no rest reset and no group totals
  ([Journal](../features/journal.md)).
- **Thrown weapons track no ammunition of their own** (Dart, Javelin, Dagger).
  → [Ammunition](../features/ammunition.md)
- **Firearm reloading and energy cells (XDMG) are not modelled.** → [Ammunition](../features/ammunition.md)
- **Magic ammunition outside the selection rule is not converted**: BMT, AU and the 2014 DMG
  variants, and generic +N weapons. → [Ammunition](../features/ammunition.md)
- **Quivers and other ammunition containers have no capacity.** → [Ammunition](../features/ammunition.md)
- **Rests do not move condition or spell clocks.** → [Conditions & concentration](../features/conditions-and-concentration.md)
- **An item's Use cannot apply a timed condition.** → [Conditions & concentration](../features/conditions-and-concentration.md)

## Waiting on sources

Blocked until someone has the book or PDF.

- **Ten Humblewood spells have no source we hold**: Ambush Prey, Elevated Sight, Feathered Reach,
  Globe of Twilight, Gust Barrier, Invoke the Amaranthine, Shape Plants, Spiny Shield, Stellar Bodies
  and Veil of Dusk. They are Humblewood Vol 1 content. All ten ship with their existing, non-verbatim
  text, untouched. → ledger L1045, and
  [Humblewood playtests](../../_claude/HUMBLEWOOD-PLAYTESTS.md) §7

## Found while compiling the wiki — for Mike's triage

Compiling the wiki meant checking every claim in the ledger against the code, and on 2026-09-28 that
turned these up. None is fixed yet. They are here so none gets lost; each should be triaged into a
fix, a Limitation above, or a Verified-NOT-gap below, and then removed from this section.

### Likely bugs a player can hit

- **No class carries its first-class armor, weapon or tool training** in any pack:
  `convert_classes()` reads only `skills` from `startingProficiencies`, so a Bard's three Musical
  Instruments or a Fighter's armor training never reach the sheet. → ledger L3985, and
  [Converter](../data/converter.md)
- **A subclass's own window shares the title of the window before it**, so "Fighter — Level 3" can
  appear twice in a row (class choices, then Battle Master's). → ledger L4086, and
  [Character building](../features/character-building.md)
- **The glossary editor's Save replaces the whole entry**, so fields it doesn't show are dropped when
  a player edits an entry that has them. → ledger L4206
- **The Gadgeteer's level-1 "Proficiencies" trait** still arrives on a multiclass add and lists saving
  throws as text, so it can read as if it grants them (Humblewood publishes no multiclass rules).
  → ledger L3886
- **Glossary pop-ups show raw table anchors.** `openGlossView()` renders the entry with `esc()` only, so
  the `[Table: Carrying Capacity]`-style anchors in the 2024, Xanathar's and Tasha's glossaries appear
  as literal text. → [Rich text](../architecture/rich-text.md)
- **Removing a source does not revert everything it seeded**: text appended to `proficiencies`, the
  seeded `speed` and `size`, `spellAbility`, and the legacy `ancestry`/`background` strings. Because
  `applyRace()` fills speed and size only when they are empty, *swapping* ancestry keeps the old ones.
  This goes against the provenance invariant. → [Grants & provenance](../architecture/grants-and-provenance.md)
- **No rules-update prompt for a character that autoloads at boot.** Since the IndexedDB move,
  `boot()` autoloads the character before `loadRulesCacheAsync()` has restored the packs, so
  `charNeedsUpdate()` sees none, and nothing asks again when they arrive. Ledger L702 describes the old
  order. → [Rules-update tool](../features/rules-update-tool.md)
- **Editing a feature freezes a scaling use count.** `openFeatureForm()` saves `usesMax()` as a plain
  number, replacing a by-level or formula maximum. → [Features & traits](../features/features-and-traits.md)
- **The Size box shows as "set by hand" whenever the ancestry has a size**, because `recompute()`
  highlights it whenever `character.size` is set and `applyRace()` fills that field. This
  contradicts L1711. → [Vitals & rest](../features/vitals-and-rest.md)
- **Weapons granted outside the item finder arrive unequipped**, so their attack row is hidden.
  `grantItemByName()` and a new item from `openItemForm()` start with `equipped:false`. A brand-new
  character's starting weapons get equipped only on its first reload, by `migrateWeaponEquip()`,
  because `newCharacter()` skips `migrate()`. → [Attacks & damage](../features/attacks-and-damage.md)
- **A spell attack row can disagree with the cast dialog.** `attackNumbers()` adds `attack`/`damage`
  effects to spell rows, but the Spellcasting card and `promptSpellAttack()` don't. → [Attacks & damage](../features/attacks-and-damage.md)
- **Deleting a weapon's attack row by hand doesn't stick.** The next item save (`syncItemAttack()`) or
  rules update (`updResyncAttack()`) recreates it. → [Attacks & damage](../features/attacks-and-damage.md)
- **Manual AC has no control.** Nothing sets `character.ac`, although ledger L239 describes a manual
  fallback. `armorAC()` adds shields on top of a manual AC and lets several shields stack, and the
  breakdown shows "Base AC 0" when the value is `null`. → [Armor & AC](../features/armor-and-ac.md)
- **"Insert from rules pack" in the item form** copies no `category`, `type` or `src` stamp, so the item
  is filed by guesswork and the rules-update tool can match it only by name. → [Inventory](../features/inventory.md)
- **Homebrew loaded alone reports "15 missing" for 14 entries**: Warlock is counted by both the
  structural and the declared check. → [Homebrew](../data/homebrew.md)
- **Changing the skin rewrites `character.system`** (coins, the ancestry list) with no warning, and the
  New-character hint "All loaded rules stay available either way" is false for ancestries, which
  `racesForCharacter()` filters by system. → [Theming & icons](../ui/theming-and-icons.md)
- **Print includes hidden attacks**: `printSheet()` prints the attacks of unequipped weapons.
  → [Attacks & damage](../features/attacks-and-damage.md)

### Keyboard access

- The Rules tab's two section headings are `role="button"` with `tabindex="0"`, but nothing in
  `wire()` handles Enter or Space, so they take focus and do nothing. Features group heads and
  inventory section heads can't be focused at all. The Attacks card's `data-atksec` headings look
  clickable but have no handler. → [Sections & layout](../ui/sections-and-layout.md)

### Breaks of a non-negotiable

- **Silent storage writes (constraint 2), narrowed.** Every character and library write now reports
  a refused write (#81): autosave (`saveNow()`), `newCharacter()`, `finishImport()`,
  `migrateOldChar()`, `deleteCharacter()` and `setAutoload()`. `saveSettings()` still returns why it
  was refused, but most of its callers ignore that. → [Storage](../architecture/storage.md)
- **A stale rules cache can win.** If a save falls back to localStorage after IndexedDB once held the
  pool, the old IndexedDB copy is never cleared, and `loadRulesCacheAsync()` lays it over the newer
  copy on the next boot. → [Storage](../architecture/storage.md)
- **Google Fonts in the template (constraint 1).** `src/fieldbook.template.html` links
  `fonts.googleapis.com`. It has been there since the first commit, with no recorded decision. Offline,
  the font stacks fall back to local serifs. → [Theming & icons](../ui/theming-and-icons.md)
- `boot()` and `renderHome()` call `localStorage.getItem` outside a `try`, so a browser that throws on
  storage access would stop boot **(unverified)**. → [Storage](../architecture/storage.md)
- **Import, remove and Clear all still write a green status line synchronously.** When the rules
  cache can't be saved (no IndexedDB, quota), the refusal shows only in the red line above the pack
  list, not on the status line — Fetch all now reports it in both. → ledger L3797, and
  [Storage](../architecture/storage.md)

### Latent: no shipped data triggers these yet

- `openClassInfo()` assumes a pack class's `spellcasting` is a string and `savingThrows` a list;
  a hand-written pack with other shapes would break the class info window. → ledger L4206
- `requires` cannot name a subclass: `missingRequirements()` looks it up through `ruleById()`, whose
  subclass key is `class|name`. → [Rules packs](../architecture/rules-packs.md)
- `usesMax()` reads `byLevel` by total character level; `resolveResMax()` uses the class's own level.
  → [Computed stats & effects](../architecture/computed-stats-and-effects.md)
- `settings.autoload` is seeded and never read. `portraitImg` has no default in `blankChar()`.
  `choicesSettled()` is defined and never called. Nothing binds `character.speed`, so base speed only
  ever comes from the ancestry. → [Character model](../architecture/character-model.md)

### Tooling

- **Subclass tables are never read.** Subclasses carry `subclassTableGroups`, but `_class_tables()`
  reads `classTableGroups`. Nothing is lost today (the shipped subclass tables are spell columns it
  would skip, or already in prose), but a new one would be missed. → ledger L3761
- **A table cell with both `roll` and `entry` prints only the roll** (the DMG, BMT and LLK deck
  printings — no shipped pack). → ledger L3761
- **Warlock Features keeps its "Spell Slots" and "Slot Level" columns**, although the converter's
  decision is to skip spell-slot columns. Needs a call: Pact Magic is not the slot table the decision
  was about. → ledger L3761, and [Converter](../data/converter.md)
- **`convert.py --resources` doesn't work as documented.** The `classes` subcommand accepts it and
  ignores it. `supplement` always reads `data/class-resources.json`, and silently gets nothing if the
  file is missing. → [Converter](../data/converter.md)
- **`convert.py` never looks for its helper files beside itself**, although `build.sh` ships
  `overlay.json` and `class-resources.json` next to it in the zip's `scripts/`. A player running the
  zip's `all` gets a warning and must pass both flags. → [Converter](../data/converter.md)
- **The `SUPPLEMENTS` profiles don't carry `--avoid-table-names`**, so a bare `--book` re-run does not
  reproduce the table names (`dev.sh` passes the flag). → [Supplements](../data/supplements.md)
- **`extract-humblewood.py`:** `--write-prose` drops a repeated heading missing from `HEAD_ERRATA`
  silently, although ledger L904 calls that a hard error. `audit_th()` checks only core table cells.
  → [Humblewood](../data/humblewood.md)
- **`humblewood-verbatim` is skipped locally even with `.venv` and the PDFs present**, because
  `run.sh` uses the `python3` on `PATH`, which lacks PyMuPDF. Run with `.venv/bin/python` it reports
  165 passed. `run.sh`'s closing "All N suites passed" also counts a skipped suite.
  → [Testing](../process/testing.md)
- **Tests the ledger says exist but don't:** unit tests for `usesMax()` and for the casting engine
  (`pickSlotLevel()`, `parseDurationSec()`, `autoSlots()`) (L16, L179); explicit assertions of the
  Archery/Defense effects and the Rage/Focus/Sorcery trackers (L625); a plain-modal-after-emblem-modal
  regression check (L3289). `attackNumbers()` and `pbValue()` are untested too.
  → [Testing](../process/testing.md)
- **Invisible bytes in tracked files:** `scripts/bundle-rules.js` has two literal NUL bytes inside
  `e.join(…)`, which make grep treat it as binary, and `src/tests/tables.js` has four literal
  private-use characters. → [Building & CI](../process/building-and-ci.md)

### Stale docs, comments and data notes

- **ADR-001 "As built, part 2"** says JS fragments are joined with a newline. `build-html.js` uses no
  separator; only the test harness joins with one. It also still describes the Tables-tab fragment,
  which was removed in #32.
- **`docs/rules-schema.md`** (it ships):
  - §6.11 still names a Tables tab, says ragged rows are padded (only the converter pads), and leaves
    `race` out of `ownerKind`.
  - §5 says an `asi` choice offers "a feat instead", but the app's `asi` branch has no feat option.
- **Code comments that no longer match:**
  - The `30-version.js` header says to bump `APP_VERSION` on every change, and the `UPDATE_REPO`
    comment describes the old badge.
  - The bold-only block above `descHTML()` is out of date.
  - `20-cards.css` says `.rt-view` is pre-wrap.
  - `build.sh` calls the concatenation "2,600-line".
  - `70-persistence.js` says LZW saves "roughly a third" (measured: 19%).
  - `openModal()` says "~30 call sites"; there are about 50.
  - `modalTakeFocus()` and `toast()` still describe the combat view's removed `inert`.
  - `fetch-icons.js` points to a nonexistent `src/icons/README.md`.
  - `bundle-rules.js` places `mergeRules()` in `88-settings.js`.
  - The `convert.py` USAGE docstring is out of date.
  - `spellDamageFromText()` claims a pattern reads Delayed Blast Fireball.
  - `release.yml`'s header still shows `git commit -am`.
  - `choiceFieldHTML()` calls its `option` checkbox branch dead code, but maneuvers, metamagic,
    invocations and infusions all use it.
  - The comment above `hdDiceHTML()` describes pip semantics.
  - `wire()` places `adjustHP()` in `65-resources.js`; it lives in `66-coins-hp.js`.
- **Data `_note`s:** `data/humblewood/races.json` says skill choices are text-only, but five traits have
  real choosers. `data/humblewood/subclasses.json` names the old `humblewood-spells.json`.
- **Ledger claims now wrong:**
  - L1426 says Humblewood data must not be hand-edited for sizes, but a hand-added `size` or `uses`
    survives re-extraction.
  - L2538's mid-sentence scan skips `spells.json`.
  - L702 says the rules cache is restored before autoload; it no longer is.
  - L3676 says Hit Dice moving back to Rest "reverses 1.7.0", but the move under Hit Points shipped
    in v1.5.0.

### Decisions made while fixing #63–#66 — for Mike to confirm

Each is recorded, with its reason, in the page's Decisions table; each is easy to reverse.

- **Dismissing a choice window still opens the windows queued behind it** — including the starting
  equipment after dismissing the first Add-class window, which used to open nothing. Chosen because
  the alternative loses things silently. → ledger L3847, [Character building](../features/character-building.md)
- **Removing the first class while another remains hands saving throws to the new first class**
  (tagged to it, with a toast); its starting skills and equipment are not re-offered. → ledger L3886,
  [Grants & provenance](../architecture/grants-and-provenance.md)
- **Multiclass characters saved before #66 are not changed** — they keep a second class's saves,
  skills and gear; removing that class still reverts them. → ledger L3886
- **Fetch all adds no confirmation dialog**, since nothing is lost unless a fresh copy replaces it; a
  fetched pack with the same system and entry names as a file import replaces those entries, as
  re-importing the file would. → ledger L3797, [Rules packs](../architecture/rules-packs.md)

### Decisions made while fixing #67–#73 — for Mike to confirm

Each is recorded, with its reason, in the page's Decisions table; each is easy to reverse.

- **Existing Bards are not fixed automatically.** The rules-update tool compares traits, not
  choices, so a Bard made before #67 is not offered its missing skills: tick them by hand, or remove
  and re-add the class after re-importing the 2024 pack. → ledger L3985
- **Import settings asks in a window with three buttons** (Cancel · Keep my rules · Replace my rules,
  Keep as the default), rather than the browser's OK/Cancel dialog, because there are three outcomes. There is no
  "merge" option; a file with an empty pool counts as carrying no rules; the sources list is still
  replaced wholesale; and a bare settings object with no known key is refused as "not a settings
  file". → ledger L4134, [Settings & updates](../features/settings-and-updates.md)
- **`migrate()` drops non-object values from a character's lists** (a `null`, a bare string or
  number), silently, because they can't be shown and can crash a render; glossary objects are never
  dropped. → ledger L4206, [Character model](../architecture/character-model.md)
- **A keyword written `{name, description}` loads as its term and text** (`desc` is not an alias);
  pack entries with no usable name are skipped and counted on the status line, not shown as a chip
  in Loaded data, and a settings file's unusable entries are dropped without a message. → ledger
  L4206, [Rules packs](../architecture/rules-packs.md)
- **Magic weapons take their names from the base weapon data, not a copy of the base weapon's
  fields** — the dump's magic weapons already carry every base field. → ledger L4327,
  [Converter](../data/converter.md)
- **A weapon bonus on a non-weapon item lives only in its description** (#74). Bracers of Archery,
  Oil of Sharpness, the Rod of Lordly Might, the Eldritch Claw Tattoo and Baba Yaga's Mortar and
  Pestle no longer add an automatic bonus: the old global effect reached every attack, and no effect
  target can say "bows only". The player types it on the weapon's extra-damage box instead.
  → ledger L4392, [Attacks & damage](../features/attacks-and-damage.md)
- **Conditional AC and save bonuses stay in the description** (#76), decided by a text rule over the
  sentence that states each bonus plus a reviewed list pinned in the tests. Bracers of Defense is one
  of the five: its +2 needs no armor and no shield, so an unarmored monk loses the automatic +2 once
  the update is applied. The Quarterstaff's once-per-rest Reaction is description, not a tracked use.
  → ledger L4502, [Armor & AC](../features/armor-and-ac.md)
- **A spell bonus limited to one class's spells applies to the character's single spellcasting**
  (#77) — exact for a single-class caster; a multiclass caster's other class gets it too. → ledger
  L4568, [Spells](../features/spells.md)
- **"+1 to ability checks" is one `check` effect** (#79) that reaches every skill, initiative and
  passive Perception — not 18 skill effects plus initiative. A plain ability check shows the bonus
  only in that ability's breakdown; the modifier box stays the modifier. The Proficiency Bonus box is
  now marked when an effect changes it, and tappable. Items that set or cap a score (Belts of Giant
  Strength, the +2-to-a-maximum Ioun Stones) or change speed stay prose. → ledger L4689,
  [Computed stats & effects](../architecture/computed-stats-and-effects.md)

## Verified NOT gaps (do not fix)

These look like missing features. Each was checked and is right as it stands.

- **Flat skill grants live on the container** (race or subrace, `obj.skills`), not on the trait. That
  is where they are wired. → ledger L2581
- **Expertise stays prose** (Gallus "Communal", Sun Touched "Intimidation"). → ledger L2581
- **Non-numeric effects stay prose**: advantage and disadvantage, resistances and immunities,
  Darkvision, climb/swim/burrow/fly speeds (only walking `speed` is an effect target), natural weapons,
  "you know X". Effects are numeric-only by design. → ledger L2581, and
  [Computed stats & effects](../architecture/computed-stats-and-effects.md)
- **Player-choice ability boosts on feats stay by hand** (Sun Touched, Moonlit). There is no
  feat-level ability-choice mechanism; `abilityChoice` exists for ancestries only. It could mirror the
  skill-choice path if it is ever wanted. → ledger L2581
- **A Warlock losing its lower-level slots on level-up is the rule.** Pact Magic slots are all of the
  highest unlocked level. Every row matches the PHB table. → ledger L3169
- **The March 2024 Fizzar packet is excluded on purpose.** Nov 2024 supersedes it in full, and taking
  it would add a dead class. Do not add it. → ledger L1045
- **A pack with no `dataVersion` gets no badge,** and neither does one newer than the app expects.
  Unknown is not stale: a false alarm on someone's own content is worse than silence. → ledger L1323
- **Unmapped names get no emblem, and subclasses get none at all.** A wrong-but-present emblem on
  someone's homebrew is worse than none, and a subclass is the second half of a class chip.
  → ledger L3289
- **Item charges are not auto-detected** ("this wand has 7 charges"). The phrasing varies too much, and
  a wrong guess is worse than a blank box. → ledger L2818
- **Note markdown deliberately omits** links (they point at a network, in an offline app),
  `_underscore_` emphasis (`snake_case`), nested lists and pipe tables. → ledger L1504
- **The Features Favourites group is not in the ☰ menu.** Listing it would mean listing every feature
  group. → ledger L2381
- **Xanathar's encounter, trap and name tables and Tasha's sidekick classes are not converted.** They
  are DM content the sheet cannot act on, in shapes that would each need their own parser. → ledger L1816

## History

- 2026-08-07 — Equipment-grant limitations recorded: multiclass starting equipment, average gold, unmatched item names. → ledger L42
- 2026-08-07 — Cervan "Surge of Vigor" deferred until the source book is on hand. → ledger L1808
- 2026-08-07 — The level-keyed grant limitation and the feat/subclass modal race recorded. → ledger L2571
- 2026-08-07 — The "Verified NOT gaps" list started. → ledger L2581
- 2026-08-10 — Ten Humblewood spells without a source, and twelve Sep 2024 tables, deferred. → ledger L1045
- 2026-08-11 — Humblewood species sizes deferred to the extractor. → ledger L1426
- 2026-08-14 — The Artificer/Mystic mislabel accepted; Tasha's skips the Artificer. → ledger L1816
- 2026-08-17 — Editing an attack no longer unlinks it from its item or spell (found in #30, fixed the same day). → ledger L2742, L2850
- 2026-08-17 — Editing a spell keeps its rules-update stamp. → ledger L2863, L2927
- 2026-09-24 — Combat-view Undo removes the "can't put Active Spells back" gap. → ledger L3397, L3454
- 2026-09-25 — #58 and #61 fixed; #60 and the #59 data wait on `_conversion-data/` and `.venv`. → ledger L3548, #58, #59, #60, #61
- 2026-09-25 — #60 option pickers and the #59 Gadgeteer, Scofflaw and Psi Warrior text fixed. → ledger L3596, #59, #60
- 2026-09-25 — Superiority Dice tracker, Student of War picker, the 2024 options library, and the `_equipQueue` leak fixed. → ledger L3649
- 2026-09-25 — Superiority Die size on the tracker; the 5e-tools v2.36.1 move done. → ledger L3676
- 2026-09-28 — Fixed and removed: class tables' dice and bonus cells (#64), Fetch all discarding packs (#65), subclass choices replaced by the equipment picker (#63), multiclass saves and starting equipment (#66) — and a first class above level 1 now gets its hit points. New items from that work added. → ledger L3761, L3797, L3847, L3886
- 2026-09-28 — Fixed and removed: image sources and every other attribute value from a file are escaped, images load only from data: URLs, and a guard test enforces it. → ledger L3940
- 2026-09-28 — Fixed and removed: first-class Bard skills (#67), dropped formula text (#68), the choice-window title's level and double escape (#69), Import settings replacing rules silently (#70); also fixed and never listed here: a glossary entry without a term breaking the sheet (#71), magic weapon property names and finesse (#72), table footnotes (#73). New items from that work added. → ledger L3985, L4025, L4086, L4134, L4206, L4273, L4327
- 2026-09-28 — A +N weapon's bonus counted twice (#74) and ranged finesse weapons couldn't use STR (#75): both fixed, never listed here. Quarterstaff of the Acrobat's AC (#76) and items' spell-attack bonuses (#77) added. → ledger L4392, L4466
- 2026-09-28 — Fixed and removed: the Quarterstaff of the Acrobat's standing +5 AC (#76) and items' unread spell-attack bonuses (#77). Added #78 (raw item-entry tags) and #79 (unread Stone of Good Luck / Ioun Stone of Mastery bonuses). → ledger L4502, L4568
- 2026-09-29 — Fixed and removed: raw item-entry template tags in 54 descriptions (#78) and the unread Stone of Good Luck / Ioun Stone of Mastery bonuses (#79). → ledger L4634, L4689
- 2026-09-29 — Narrowed: a refused autosave, new character, import or old-save move now reports itself (#81); `deleteCharacter()`, `setAutoload()` and most `saveSettings()` callers still don't. → ledger L4771
- 2026-09-29 — Trackers: counters, checklists and tasks that close themselves when done, with Undo; registered section 20, in the combat view; hideable per character. → ledger L4822, #41
- 2026-09-29 — Narrowed again: `deleteCharacter()` and `setAutoload()` now report a refused index write; only most `saveSettings()` callers still don't. → ledger L4856, #81
- 2026-10-02 — Deferred: thrown weapons as their own ammunition, firearm reloading and energy cells, magic ammunition variants outside the selection rule, and quiver capacity. → ledger L4952, #6
- 2026-10-02 — The final review's fixes: a hostile item name no longer stops a sheet loading; removing a class forgets its spent arrows; End combat asks only about new shots; recovery joins an equivalent stack; the picker shows +N. Recorded: 2014-named ammunition pieces and dropped gear reading as unmatched on old sheets, same-named grants looking identical in the picker, and Adamantine Ammunition's "Unknown" rarity. → ledger L4989, #6
- 2026-10-07 — The rules-data archive: older copies can't open the zip, a data update is announced and never installed, and the notice needs the network. Removed: `release.js`'s stale no-tags comment, gone with that code. → ledger L5082, #83
- 2026-10-08 — The SRD 5.2 pack: with both D&D packs loaded the 2024 copy of a shared table opens, and a player's own `convert.py srd` run has no corrections file. → ledger L5148, #84
- 2026-10-08 — Fixed and removed: a player's own `convert.py srd` run applying no corrections (a missing file is now an error, and the app zip ships it). The shadowed-table list loses Carrying Capacity, now an identical twin. → ledger L5269, #84
