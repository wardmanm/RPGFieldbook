# Known issues

Everything known to be imperfect, postponed, or blocked on a source we don't hold, re-checked against
the code at `1614d43` for the 1.9.0 pre-release. The last section lists things that look like gaps and are not: each was a
deliberate call, and "fixing" one would break something or contradict a rule. When an item here is
fixed, delete it and add a History line. When a new one is accepted, add it here and link it from the
page it concerns.

**See also:** [Grants & provenance](../architecture/grants-and-provenance.md),
[Computed stats & effects](../architecture/computed-stats-and-effects.md),
[Private data](../data/private-data.md),
Humblewood (the private repo's `docs/humblewood.md`), [Converter](../data/converter.md),
Humblewood playtests (the private repo's `docs/HUMBLEWOOD-PLAYTESTS.md`), [2.0](2.0.md)

## Limitations

Known behaviour that is accepted for now.

- **On a phone, Tab reaches Skills before Defences and Statuses**, which the phone layout shows above it (since #103). The cards are independent, so it is a small keyboard-order mismatch, not a lost control; tablet and desktop follow the markup since #155.
- **Level down only lowers the number for a level with no record.** A level gained before #118
  has no `levelLog` record, so `doLevelDown()` keeps every trait, proficiency, grant and choice from
  it. Grants are keyed by source (`class:<Name>`), not by level. A level gained since has a record:
  level down removes its ticked HP and features, with the grants traced to one feature, and lists a
  skill pick, the subclass and spells to adjust by hand. Removing the class reverts all of it, and
  race and background choices revert fully. → ledger L2571, L7569, and
  [Character building](../features/character-building.md)
- **A feat's fixed `skills` are not granted.** (#146) `grantFeatDef()` forwards a feat's effects, uses,
  cost and skill *choices*, but not a fixed `skills` list, so such a skill is added by hand. It
  predates #118, and level down deliberately never matches a feat by its rules `skills`. → ledger
  L7569, and [Grants & provenance](../architecture/grants-and-provenance.md)
- **A fixed species or background feat's `ability` increase is not applied.** (#146) `grantFeatDef()`
  applies a feat's `effects` only. The +1 is asked only when the feat is picked from a list
  (`commitAsiPick()`), so for a fixed `feat` the player raises the score by hand. It is dormant for
  shipped data: no shipped species uses a fixed `feat`, and Origin feats carry no `ability`.
  `docs/rules-schema.md` says so. → ledger L7657, and
  [Character building](../features/character-building.md)
- **The ASI's "+1 to two" accepts the same ability twice,** (#146) for +2 to one score. The 2024 rule
  says two different scores. It predates #118. → ledger L7569, and
  [Abilities & skills](../features/abilities-and-skills.md)
- **The choices inside a feat stay by hand.** (#146) The ASI step asks only for a feat's +1. Its spells
  (Magic Initiate, Fey-Touched, Ritual Caster…), tools and instruments (Crafter, Musician), damage
  types (Elemental Adept), Resilient's saving throw and Weapon Master's mastery are the player's to
  add. No shipped pack carries them in structured form. → ledger L7569, and
  [Character building](../features/character-building.md)
- **Hit points don't leave with a class above level 1.** Removing a class clears only the level-1
  seed: a first class added at level 3 and then removed keeps its levels 2–3, and removing a
  multiclass class keeps the hit points its levels added — the same as a class levelled up in play.
  → ledger L3886, and [Vitals & rest](../features/vitals-and-rest.md)
- **Multiclass ability prerequisites** (e.g. INT 13 for a Wizard) are stated, not checked (#146). The Add
  class window's multiclass note says the rule (`MC_PREREQ`, #101), but the packs don't carry each
  class's primary ability, so nothing enforces it. → ledger L3886
- **A source's packs stay until removed by hand** once the source is taken out of the list (#102
  decision 13), and a pack fetched before `_url` stamping keeps any entry its plain source has since
  dropped (a re-fetch replaces the rest by name). Both follow from a fetch never discarding what it
  didn't replace.
  → ledger L3797, and [Rules packs](../architecture/rules-packs.md)
- **A class's gold alternative is the average of its dice**, not a roll (`_dice_avg_gold()` in
  `convert.py`). → ledger L42
- **Granted items match the item list by exact name only** (`grantItemByName()`, #149). Anything else is added
  as a plain named item with no description, cost or weapon data. The 2024 and Humblewood classes and
  backgrounds carry 18 such names, for example "Holy Symbol", "Druidic Focus", "a Gaming Set (your
  choice)" and "Traveling Clothes". → ledger L42
- **Missing references degrade quietly.** (#149) A feat that isn't loaded becomes an empty feature named
  `Feat: X`, and a missing granted item becomes a bare name. Only subclasses and declared `requires`
  are reported. → ledger L1883
- **Artificer and Mystic are 2014/UA content labelled XPHB** in the 2024 pack's `classes.json`
  (in the private repo), picked up
  by a fallback in `convert_classes`. This was the owner's call: fixing it drops both from the core
  pack, bumps XPHB's data version, and strands anyone playing an Artificer on the core pack alone.
  Tasha's skips the Artificer and its subclasses instead of shipping duplicates. → ledger L1816
- **`**Hit** Points` loses its glossary chip.** The asterisks break the `\b(term)\b` match. This is
  inherent to escaping first and matching second. → ledger L1504
- **A favourited granted feature loses its star when the grant is rebuilt.** (#146) Changing subclass,
  removing a class or swapping ancestry runs `removeFeaturesWhere()` and re-adds through
  `addFeatureFromDef()`, which makes a new object. Inventory doesn't have this problem, because
  `grantItemByName()` reuses the item. Levelling up is safe: it only adds. → ledger L2381
- **Multiclass pact slots share one pool.** (#146) `autoSlots()` adds the Pact Magic slots onto the
  full-caster table, so a Wizard 3 / Warlock 3 reads L1:4 L2:4. A short rest restores the pact count
  from that shared pool. Real 5e tracks them separately. → ledger L3169
- **Feats picked from the feature finder get no skill-choice prompt.** (#146) `addPickedFeature()` adds with
  no origin, and `grantFeatDef()` only queues a feat's skill choices when a source id exists.
  → ledger L2776
- **The printed sheet** shows prepared spells as `◆`/`○` with no key (the same gap as the skill and
  save rows), and prints no item uses (#151). → ledger L2345, L2818
- **The item finder has no Escape key of its own.** (#151) `openBrowse()` closes from its Close button only;
  the global Escape handler dismisses the modal and nothing else. → ledger L3397
- **2014-named single ammunition pieces keep their name on a sheet migrated before ammunition
  shipped.** (#145) "Crossbow Bolt" and "Blowgun Needle" learn the 2024 kind and fire, but `migrateAmmo()`
  never renames them, so the rules-update tool lists them as not in any loaded pack. Existing
  copies of the 35 dropped 2014 gear items ("Spell Scroll (1st Level)", "Rations (1 day)"…) show
  the same way. → ledger L4989, and [Ammunition](../features/ammunition.md)
- **Ammunition picker rows can look identical** when two grants each give "Arrow ×20": stacks of
  different grants stay apart by design, and nothing on the row tells them apart (#145). An origin hint
  would. → ledger L4989, and [Ammunition](../features/ammunition.md)
- **A reload with the End of combat window open loses the typed XP** (#105). The fight had already
  ended and saved; the window's state (`_endFight`) is never saved, as any unsaved form isn't. →
  ledger L7921, and [Combat view](../features/combat-view.md)
- **A shot's Undo refuses once End combat has settled it** (#105, by design): its toast is hidden at
  End combat, and a shot fired outside a fight stops undoing once a later End combat sweeps it up.
  A shot fired by mistake is put back by correcting the stack's count by hand: the window's Undo
  recovery takes back only what came back (#170). → ledger L7921, L9155, and
  [Ammunition](../features/ammunition.md)
- **A row's Recover has no Undo** (#170, noticed). Its toast says what came back and offers
  nothing, and End combat's Undo recovery never takes a row's recovery back. → ledger L9155, and
  [Ammunition](../features/ammunition.md)
- **A weapon made in the item editor cannot be Thrown.** (#145) The editor has no weapon-notes field; Save
  carries `weapon.notes` from the pack entry last inserted, so only pack data marks a weapon Thrown.
  → ledger L6147, and [Ammunition](../features/ammunition.md)
- **Xanathar's five Adamantine Ammunition pieces carry rarity "Unknown"** (5e-tools writes
  "unknown"), which sorts first in the item finder's Rarity filter (#149). → ledger L4989, and
  [Ammunition](../features/ammunition.md)
- **Fieldbook before 1.8.0 can't open the rules-data zip.** A player on an older copy unzips it and
  imports the `.json` files inside; the release notes, `NOTICE.md` and README §3a say so. The
  manifest has no rules keys, so an old copy given it as a loose file merges nothing. → ledger
  L5082, and [Data archive](../architecture/data-archive.md)
- **The newer-data notice and the source check need the network** (the GitHub releases list, the
  tag's registry, each source's manifest), and are silent offline or when GitHub refuses, so an
  offline player never learns of a data release. They run once per load, like the app's update
  check; Check now on the Extensions page runs the source check again. → ledger L5082, L7428
- **With the D&D 2024 and SRD 5.2 packs both loaded, import order decides which copy of a shared
  name a lookup finds.** The two packs come from separate archives since #85 (the public one and the
  private one), `findTable()` and the other name lookups take the first match in the pool, and a
  re-import keeps a pack's place. With the 2024 pack imported first, the SRD's own wording of the
  Reincarnate, Deck of Illusions and Object Armor Class tables, corrected to the SRD PDF, is not what
  opens; imported second, the SRD copies win. Both are the same table in two wordings (#84 R5).
  Import the private archive first, or keep existing loads. #84's check that the registry loaded the
  2024 pack first was removed: no registry holds both packs now. → ledger L5148, L5269, L5426, and
  [Private data](../data/private-data.md)
- **Private packs get no newer-data notice.** `checkForDataUpdate()` reads the public registry,
  which lists only SRD 5.2 since #125; a private pack shows its version quietly (`known`), as does
  an old public Homebrew once the next release drops it from `DATA_VERSIONS`.
  → ledger L5426, L7858, and [Settings & updates](../features/settings-and-updates.md)
- **A public player's old Homebrew still names Xanathar's spells "from Xanathar's Guide to
  Everything"**, which no public file provides. The release notes say it moved; re-importing it
  from the private archive replaces it. → ledger L7858, and [Homebrew](../data/homebrew.md)
- **The old releases' copyrighted data stays reachable until 2.0.** (#140) The v1.3.0–v1.7.2 releases still
  carry their pack assets (every `*_full.json`, every `fieldbook-v*.zip`, and v1.3.0's source zip):
  deleting them is pending Mike's decision ([RELEASING §4a](../../RELEASING.md)). Even once they are
  deleted, GitHub's Source code archives of each tag, and public history, keep the data until the
  history purge. → ledger L5426, and [2.0](2.0.md)
- **The trackers' Σ is a button nested in a `role="button"` group header,** (#100) so assistive tech may
  flatten the header and never reach the Σ. Restructuring the header pattern (the journal's and the
  section notes' group headers share it) is likely 2.0's. → ledger L6057, and [Journal](../features/journal.md)
- **A new character made before a cold rules cache has loaded gets Common as its default
  language** (#146), even where a loaded pack would declare other `defaultLanguages`: `newCharacter()`
  reads the packs as they are at that moment, and `migrate()` only adds missing defaults later, so
  the fallback Common stays beside them. Inert today: no pack declares `defaultLanguages`.
  → ledger L6633, and [Character model](../architecture/character-model.md)
- **Changing a sheet's system does not swap its `system` language chips** (#133) for the new ruleset's
  defaults (the #103 spec §4 asked for it; ruled not needed at plan time, as a character's system
  is not meant to change, though Settings → Skin does rewrite the open character's). Inert today:
  every ruleset falls back to Common. → ledger L6633, and [Character model](../architecture/character-model.md)
- **Languages lifted from an old sheet are the player's own**, so they stay after a species or
  background change. #103 turned a sheet's "Languages: …" lines into chips once, with no source,
  because the old race grant wrote them as prose and which grant added which cannot be recovered:
  an old Elf with "Languages: Common, Elvish" keeps Elvish as a Dwarf. Remove the chip by hand. This
  is the spec's choice, not a bug. → ledger L6729, and
  [Grants & provenance](../architecture/grants-and-provenance.md)
- **A private data release publishes on its tag, with no approval step.** The public workflows wait
  for Mike in the `release` environment; GitHub refuses required reviewers on a private repo on the
  current plan (HTTP 422). Claude Code's ask rules and `/release`'s "publish" are its only gates.
  → ledger L6226, and [Private data](../data/private-data.md)
- **A long inventory log of Use, give and delete lines takes real storage** (#47, accepted and
  measured). Each keeps one whole copy of the item so Undo can bring it back, saved with the
  character in localStorage, which the app shares across every character (browsers commonly allow
  about 5 MB a site). Edit lines keep only the fields that changed (500 edits of a magic item,
  117,000 characters). The log is capped per character (100 to 2,500 lines, default 500); the final
  review's estimate for 2,500 one-copy lines was 1.8 to 2.6 million characters, and the default is a
  fifth of that. A save that doesn't land says so. → [Inventory](../features/inventory.md)
- **Existing Bards are not fixed automatically** (#67). The rules-update tool compares traits, not
  choices, so a Bard made before #67 is not offered its missing first-class skills: tick them by
  hand, or remove and re-add the class after re-importing the 2024 pack. → ledger L3985
- **Multiclass characters saved before #66 keep a second class's saves, skills and gear.** Since #66 a
  class added as an extra class no longer grants its first-class ones, but older sheets are not
  changed; removing that class still
  reverts them. → ledger L3886

## Deferred

Wanted, not yet done. Each needs work, not a source.

- **#102's deferred minors.** Three unauthenticated GitHub API calls per boot (the app check asks
  for the latest release; the data check and the official source each list the releases), against
  GitHub's 60 an hour; memoising the list is deferred (M10, #149). A plain source's URL is only checked to be non-empty (old relative
  sources are allowed by design; it reaches only `fetch`). `extVerify()` doesn't compare the bytes'
  length with the manifest's declared `size` (the sha256 covers it when present), and a page with
  no `fetch` at all throws synchronously. Small simplifications (one shared newest-by-key helper, a
  size message keyed on the cap constant) wait for 2.0. The URL, size, `fetch` and simplification
  minors are noted on #100. → ledger L7428, and
  [Rules packs](../architecture/rules-packs.md)
- **#102's release-tooling minors** (#150): `release-files` deletes before it writes;
  `./build.sh --release --no-zip` skips `releases/data/`; `data-kit.py`'s leak test reads the shared
  temp folder. → ledger L7428, and [Data kit](../data/data-kit.md)
- **The private-source install is untested on Mike's devices.** (#182) A real token read a private
  repo from `file://` and the app added it (ledger L9016); installing real packs that way waits on the
  first private release with a pack list (`1.9.0-2`). Pasting a source link is how a private repo's packs reach a player;
  Manual install remains for a file. → [Settings & updates](../features/settings-and-updates.md)
- **Humblewood species have no size.** (#149) They all resolve to Medium (`charSize()`), but Jerbeen, Luma
  and Hedge are Small in the book. The fix belongs in the private repo's Humblewood extractor, which
  has a verbatim suite, so the data must not be hand-edited. A player can set size from the rail
  meanwhile. → ledger L1426
- **Small tables inside features read as flat text.** (#149) Magic Item Hacking's rarity costs and the
  Spell Emulator component's tiers are examples. → ledger L3596
- **Rune Knight runes have no tracker.** (#146) They are per-rune uses, not a pool, so
  `class-resources.json` can't express them. → ledger L3649
- **Two spells' damage isn't read**: Delayed Blast Fireball ("base damage is 12d6") and Glyph of
  Warding ("5d8 Acid, Cold, Fire, Lightning, or Thunder damage"). Each needs its own pattern, and
  neither is worth one that risks false positives. → ledger L2989
- **Using an item can't remove a status** (Elixir of Health, #147). That wants a list and a different UI.
  → ledger L2818
- **Twelve Sep 2024 characteristic tables** (Stonesinger, Warrenborn, Wonderstruck) are not extracted (#149).
  Their pages stack tables both vertically and side by side, which the table reader doesn't handle. Six
  of the twelve came back malformed, so all twelve are dropped: a background gets its four tables or
  none. → ledger L1045, and the private repo's `docs/HUMBLEWOOD-PLAYTESTS.md` §7
- **Lower-value playtest tables not extracted** (#149): the Gadgeteer progression table, Lunin Pedigree, the
  Whispering Wind expanded spells and Deep Roots' two tables. The features that cite them carry their
  full text. → the private repo's `docs/HUMBLEWOOD-PLAYTESTS.md` §7
- **Cervan "Surge of Vigor" has no uses tracker.** (#149) The ledger deferred it for want of the source, but
  the verbatim text now states the limit ([book text: the long-rest reset clause]), so it needs
  `uses {1/long}`, not a book. → ledger L1808, and
  the private repo's `docs/humblewood.md`
- Journal pages and trackers don't print; trackers have no rest reset (#148)
  ([Journal](../features/journal.md)).
- **Firearm reloading and energy cells (XDMG) are not modelled.** (#145) → [Ammunition](../features/ammunition.md)
- **Magic ammunition outside the selection rule is not converted** (#149): BMT, AU and the 2014 DMG
  variants, and generic +N weapons. → [Ammunition](../features/ammunition.md)
- **Quivers and other ammunition containers have no capacity.** (#145) → [Ammunition](../features/ammunition.md)
- **Rests do not move condition or spell clocks.** (#145) → [Conditions & concentration](../features/conditions-and-concentration.md)
- **An item's Use cannot apply a timed condition.** (#147) → [Conditions & concentration](../features/conditions-and-concentration.md)
- **The Hit points window has no Undo** (#175, a toast with Undo), and Coins don't have its "amount,
  then Gain or Spend" shape yet (a 1.9.2 issue). → ledger L9441, and [Vitals & rest](../features/vitals-and-rest.md)
- **What the level-up fanfare's final review left (#101).** None blocks a level-up:
  - A long level card at phone width (a multiclass add with a long note) puts the HP step and Done
    below the fold, so the player scrolls (#146). Pinning them to the card's foot is Mike's call, after his
    phone pass.
  - The page behind the 2.4s scene isn't inert (#146). Tab can move focus behind the layer, and arrow keys
    still reach a focused combat grip. Enter, Space and Esc are swallowed, so nothing activates.
  - `luSummary()` cuts a feature's first sentence at an abbreviation ("e.g.", "p. 3") (#146). It also strips
    every `_`, `*`, `#`, `>` and backtick, so "snake_case" loses its underscore.
  - After a skip, focus lands on the HP step's "I rolled" box (`#luTyped`), not Roll for me (#146). This is
    `openModal()`'s app-wide first-field rule.

  → ledger L6928, and [Character building](../features/character-building.md)

## Waiting on sources

Blocked until someone has the book or PDF.

- **Ten Humblewood spells have no source we hold**: Ambush Prey, Elevated Sight, Feathered Reach,
  Globe of Twilight, Gust Barrier, Invoke the Amaranthine, Shape Plants, Spiny Shield, Stellar Bodies
  and Veil of Dusk. They are Humblewood Vol 1 content. All ten ship with their existing, non-verbatim
  text, untouched. → ledger L1045, and
  the private repo's `docs/HUMBLEWOOD-PLAYTESTS.md` §7

## Found while compiling the wiki — for Mike's triage

Compiling the wiki meant checking every claim in the ledger against the code, and on 2026-09-28 that
turned these up. Some have been fixed since and removed, the last at the 1.9.0 pre-release; the
rest are not fixed yet. They are here so none gets lost; each should be triaged
into a fix, a Limitation above, or a Verified-NOT-gap below, and then removed from this section.

### Likely bugs a player can hit

- **No class carries its first-class armor, weapon or tool training** in any pack (#137):
  `convert_classes()` reads only `skills` from `startingProficiencies`, so a Bard's three Musical
  Instruments or a Fighter's armor training never reach the sheet. → ledger L3985, and
  [Converter](../data/converter.md)
- **A subclass's own window shares the title of the window before it** (#146), so "Fighter — Level 3" can
  appear twice in a row (class choices, then Battle Master's). → ledger L4086, and
  [Character building](../features/character-building.md)
- **The Gadgeteer's level-1 "Proficiencies" trait** (#149) still arrives on a multiclass add and lists saving
  throws as text, so it can read as if it grants them (Humblewood publishes no multiclass rules).
  → ledger L3886
- **Glossary pop-ups show raw table anchors.** (#151) `openGlossView()` renders the entry with `esc()` only, so
  the `[Table: Carrying Capacity]`-style anchors in the 2024, Xanathar's and Tasha's glossaries appear
  as literal text. → [Rich text](../architecture/rich-text.md)
- **Removing a source does not revert everything it seeded** (#131): text appended to `proficiencies`, the
  seeded `speed` and `size`, `spellAbility`, and the legacy `ancestry`/`background` strings. Because
  `applyRace()` fills speed and size only when they are empty, *swapping* ancestry keeps the old ones.
  This goes against the provenance invariant. → [Grants & provenance](../architecture/grants-and-provenance.md)
- **Editing an item freezes a scaling use count.** (#132, the item half) `openItemForm()` saves `itemUsesMax()`
  as a plain number, replacing a by-level or formula maximum; the feature form is fixed, and the item
  form gets the same fix after the Grants redraw branch merges. → [Features & traits](../features/features-and-traits.md)
- **The Size box shows as "set by hand" whenever the ancestry has a size** (#146), because `recompute()`
  highlights it whenever `character.size` is set and `applyRace()` fills that field. This
  contradicts L1711. → [Vitals & rest](../features/vitals-and-rest.md)
- **Deleting a weapon's attack row by hand doesn't stick.** (#145) The next item save (`syncItemAttack()`) or
  rules update (`updResyncAttack()`) recreates it. → [Attacks & damage](../features/attacks-and-damage.md)
- **A Flat AC does not follow the Vitals lock yet.** (#130, phase 2) The Armor Class window's switch and Flat
  box stay editable while Vitals is locked, until the Vitals & HP branch, which adds the lock, merges.
  → [Armor & AC](../features/armor-and-ac.md)
- **"Insert from rules pack" in the item form** (#147) copies no `category`, `type` or `src` stamp, so the item
  is filed by guesswork and the rules-update tool can match it only by name. → [Inventory](../features/inventory.md)
- **Homebrew loaded alone reports "15 missing" for 14 entries** (#149): Warlock is counted by both the
  structural and the declared check. → [Homebrew](../data/homebrew.md)
- **Changing the skin rewrites `character.system`** (#133) (coins, the ancestry list) with no warning, and the
  New-character hint "All loaded rules stay available either way" is false for ancestries, which
  `racesForCharacter()` filters by system. → [Theming & icons](../ui/theming-and-icons.md)
- **Print includes hidden attacks** (#151): `printSheet()` prints the attacks of unequipped weapons.
  → [Attacks & damage](../features/attacks-and-damage.md)

### Keyboard access

- Features group heads and inventory section heads fold on a click but can't be focused at all (#151). The Attacks card's `data-atksec` headings look
  clickable but have no handler. → [Sections & layout](../ui/sections-and-layout.md)

### Breaks of a non-negotiable

- **Silent storage writes (constraint 2), narrowed.** (#141) Every character and library write now reports
  a refused write (#81): autosave (`saveNow()`), `newCharacter()`, `finishImport()`,
  `migrateOldChar()`, `deleteCharacter()` and `setAutoload()`. `saveSettings()` still returns why it
  was refused, but most of its callers ignore that. → [Storage](../architecture/storage.md)

### Latent: no shipped data triggers these yet

- `openClassInfo()` assumes a pack class's `spellcasting` is a string and `savingThrows` a list;
  a hand-written pack with other shapes would break the class info window (#146). → ledger L4206
- `requires` cannot name a subclass (#149): `missingRequirements()` looks it up through `ruleById()`, whose
  subclass key is `class|name`. → [Rules packs](../architecture/rules-packs.md)
- `usesMax()` reads `byLevel` by total character level; `resolveResMax()` uses the class's own level (#146).
  → [Computed stats & effects](../architecture/computed-stats-and-effects.md)
- `settings.autoload` is seeded and never read (#151). `portraitImg` has no default in `blankChar()`.
  `choicesSettled()` is defined and never called. Nothing binds `character.speed`, so base speed only
  ever comes from the ancestry. → [Character model](../architecture/character-model.md)


### Tooling

- **Subclass tables are never read.** (#149) Subclasses carry `subclassTableGroups`, but `_class_tables()`
  reads `classTableGroups`. Nothing is lost today (the shipped subclass tables are spell columns it
  would skip, or already in prose), but a new one would be missed. → ledger L3761
- **A table cell with both `roll` and `entry` prints only the roll** (#149) (the DMG, BMT and LLK deck
  printings — no shipped pack). → ledger L3761
- **`convert.py --resources` doesn't work as documented.** (#149) The `classes` subcommand accepts it and
  ignores it. `supplement` always reads `data/class-resources.json`, and silently gets nothing if the
  file is missing. → [Converter](../data/converter.md)
- **`convert.py` never looks for its helper files beside itself** (#149), although the data kit zip ships
  `overlay.json` and `class-resources.json` next to it. A player running the kit's `convert.py all`
  directly gets a warning and must pass both flags; `fbdata.py convert` and `build` pass them.
  → [Converter](../data/converter.md), [Data kit](../data/data-kit.md)
- **The `SUPPLEMENTS` profiles don't carry `--avoid-table-names`** (#149), so a bare `--book` re-run does not
  reproduce the table names (`dev.sh` passes the flag). → [Supplements](../data/supplements.md)
- **The Humblewood extractor** (in the private repo, #149): `--write-prose` drops a repeated heading missing
  from `HEAD_ERRATA` silently, although ledger L904 calls that a hard error. Its "Th" ligature audit
  checks only core table cells. → the private repo's `docs/humblewood.md`
- **The PDF suites skip locally even with `.venv` and the PDFs present** (#150): `srd-verbatim`, and the
  private repo's Humblewood suite inside `private-data`, use the `python3` on `PATH`, which lacks
  PyMuPDF. With `.venv/bin` on `PATH` they run (the Humblewood one reports 165 passed). `run.sh`'s
  closing "All N suites passed" also counts a skipped suite. → [Testing](../process/testing.md)
- **`docs.js` still tolerates `DATA_VERSIONS` naming XPHB, Humblewood, XGE, TCE and Homebrew** (#150)
  (`LEFT_FOR_PRIVATE`). The next release retakes `DATA_VERSIONS` from the pruned registry, after
  which the tolerance is inert: delete it then. → ledger L5426, and [Testing](../process/testing.md)
- **Tests the ledger says exist but don't** (#150): unit tests for the casting engine's
  `pickSlotLevel()` and `parseDurationSec()` (L179); an explicit assertion of the Defense effect
  (L625); a plain-modal-after-emblem-modal regression check (L3289). `pbValue()` is untested too.
  (`autoSlots()`, `attackNumbers()`, `usesMax()`, Archery's effect and the Rage/Focus/Sorcery trackers
  are tested now.)
  → [Testing](../process/testing.md)
- **Invisible bytes in tracked files** (#150): `src/tests/tables.js` has four literal private-use
  characters. → [Building & CI](../process/building-and-ci.md)

### Stale docs, comments and data notes

- **ADR-001 "As built, part 2"** (#152) says JS fragments are joined with a newline. `build-html.js` uses no
  separator; only the test harness joins with one. It also still describes the Tables-tab fragment,
  which was removed in #32.
- **`docs/rules-schema.md`** (it ships, #152):
  - §6.11 still names a Tables tab, says ragged rows are padded (only the converter pads), and leaves
    `race` out of `ownerKind`.
- **Code comments that no longer match** (#152):
  - The `30-version.js` header says to bump `APP_VERSION` on every change, and the `UPDATE_REPO`
    comment describes the old badge.
  - `20-cards.css` says `.rt-view` is pre-wrap.
  - `build.sh` calls the concatenation "2,600-line".
  - `70-persistence.js` says LZW saves "roughly a third" (measured: 19%).
  - `modalTakeFocus()` and `toast()` still describe the combat view's removed `inert`.
  - `fetch-icons.js` points to a nonexistent `src/icons/README.md`.
  - The `convert.py` USAGE docstring is out of date.
  - `spellDamageFromText()` claims a pattern reads Delayed Blast Fireball.
  - `choiceFieldHTML()` calls its `option` checkbox branch dead code, but maneuvers, metamagic,
    invocations and infusions all use it.
  - `wire()` places `adjustHP()` in `65-resources.js`; it lives in `66-coins-hp.js`.
- **Data `_note`s** in the private repo's Humblewood pack (#152): its `races.json` says skill choices are
  text-only, but five traits have real choosers, and its `subclasses.json` names the old
  `humblewood-spells.json`.
- **Ledger claims now wrong** (#152):
  - L1426 says Humblewood data must not be hand-edited for sizes, but a hand-added `size` or `uses`
    survives re-extraction.
  - L2538's mid-sentence scan skips `spells.json`.
  - L702 says the rules cache is restored before autoload; it no longer is.
  - L3676 says Hit Dice moving back to Rest "reverses 1.7.0", but the move under Hit Points shipped
    in v1.5.0.

### Decisions made while fixing #63–#66

Confirmed by Mike and archived: [known-issues-decisions-63-66](../../archive/1.9.0/known-issues-decisions-63-66.md).

### Decisions made while fixing #67–#73

Confirmed by Mike and archived: [known-issues-decisions-67-73](../../archive/1.9.0/known-issues-decisions-67-73.md).

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
- **Warlock Features keeps its "Spell Slots" and "Slot Level" columns**, although the converter's
  decision is to skip spell-slot columns: Pact Magic is not the slot table that decision was about.
  Decided (Mike, 2026-10-30): the columns stay. → ledger L3761, and [Converter](../data/converter.md)
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
- 2026-10-09 — Fixed and removed: the Node bundler's invisible NUL bytes and its stale `mergeRules()` comment, both gone with the file. → ledger L5342, #85
- 2026-10-09 — The private split: import order decides which of two same-named 2024 and SRD entries wins; private packs get no notice; homebrew's Xanathar's spells cannot resolve publicly; old releases' data reachable until 2.0; homebrew masks the leak scan; `LEFT_FOR_PRIVATE` to delete after the next release. → ledger L5426, #85
- 2026-10-16 — Collapse maps read inherited properties, and a group's fold follows its label's first spelling, both reached by #98's free-text groups. → ledger L5823, #98
- 2026-10-16 — Removed: a group named for an `Object.prototype` property is now refused (fixed); a group reopening after a case edit is kept by decision. → ledger L5872, #98
- 2026-10-17 — Narrowed: trackers now show a group total (#93), so the deferred line drops "and no group totals". → ledger L6047, #95, #93
- 2026-10-17 — Limitation: the Σ nested in the `role="button"` group header. → ledger L6057, #93
- 2026-10-19 — Fixed and removed: thrown weapons now track their own ammunition (#104). Added: the printed sheet shows a ×0 item with no count. → ledger L6081, #104
- 2026-10-19 — Fixed and removed: the printed sheet's ×0 count. Added: Undo recovery dropping a home-joined entry's remainder once the home stack is fired out, `grantSidLive()` checking the source now rather than "revoked since", and editor-made weapons that cannot be Thrown. → ledger L6147, #104
- 2026-10-19 — Added: a private data release has no approval step (plan limit). → ledger L6226, #109
- 2026-10-23 — Removed with #103: the By ability Skills-note gap and the Dice hit-dice style's spend limit (both layouts retired). Added: a cold-cache new character's default language, the unbuilt system-change swap of `system` chips, and Familiars no longer addable to the combat view from the Sheet. → ledger L6633, #103
- 2026-10-23 — Removed with the #103 final review: Familiars not addable to the combat view (the paw's menu has the toggle). Added: lifted languages are the player's own. The system-chip swap's entry now records the plan-time ruling. → ledger L6729, #103
- 2026-10-24 — Removed: the Features Favourites group not being in the ☰ menu, which is retired. → ledger L6804, #103
- 2026-10-24 — Added: what the #101 final review left (a long card at 390, the scene's page not inert, `luSummary()`'s cut, focus after a skip). → ledger L6928, #101
- 2026-10-25 — Added from #47's QA: the Log button's missing glyph, the potion's unchanged save writing a line, and selling reading short. → ledger L7291, #47
- 2026-10-25 — #47's final review fixed the Log button's glyph and the potion's unchanged save; added the log's storage size, measured. → ledger L7339, #47
- 2026-10-25 — Edit lines keep only what changed, so the log's storage entry narrows to one-copy lines; selling no longer reads short. → ledger L7401, #47
- 2026-10-26 — Fixed and removed: a data update announced, never installed (#102 installs and updates packs from a manifest). Added: #102's deferred minors, its release-tooling minors and the ≤560px notice row. → ledger L7428, #102
- 2026-10-26 — Removed: the ≤560px notice row (decided: it stays) and two release-tooling minors fixed in #102's final wave (`release-files`' `isfile` guard, `data-release.js`'s exit cleanup). → ledger L7513, #102
- 2026-10-27 — Narrowed: level down lowers only the number for a level with no record. Fixed and removed: rules-schema §5's "a feat instead", which the app now offers. Added: a feat's fixed `skills` not granted, "+1 to two" accepting one ability twice, and the choices inside feats staying manual. → ledger L7569, #118
- 2026-10-27 — Added: a fixed species or background feat's `ability` increase is not applied (the final review's M4; the player docs now say so). → ledger L7657, #118
- 2026-10-28 — Homebrew is private: its Xanathar's spells resolve in the private archive, and `LEFT_FOR_PRIVATE` names it too. → ledger L7858, #125
- 2026-10-29 — Added: a reload loses the End of combat window's typed XP; a loot trade's With can exceed its typing limit; a shot's Undo refuses once End combat has settled it. Undo recovery's home-joined gap stays unreachable, now because the window keeps the sheet inert. → ledger L7921, #105
- 2026-10-29 — Removed: a loot trade's With can no longer exceed its typing limit; the End of combat window caps it at 60 characters. → ledger L8025, #105
- 2026-10-30 — Corrected: the intro's stamp and the triage intro; multiclass prerequisites are stated, not checked; the old releases' assets are still attached, their deletion pending; the Deferred intro back under its heading, and private packs through a manifest added; the inventory log's size, existing Bards and pre-#66 multiclass sheets moved to Limitations; the Rules-tab keyboard sentence, three fixed stale comments and the now-tested functions dropped. Removed: the phone-width crowding (fixed by #57). The two "for Mike to confirm" decision sections archived to `src/docs/archive/1.9.0/` (pre-release 1.9.0, step 1).
- 2026-10-30 — Issue numbers and Mike's decisions written back (pre-release 1.9.0, step 2).
- 2026-11-02 — The phone layout's keyboard order (Skills before Defences and Statuses) recorded as a limitation, from #155's review.
- 2026-11-05 — Replaced "private packs through a manifest: not built" with the live-token verification still owed: #182 builds the private GitHub source. → ledger L8943, #182
- 2026-11-05 — The live-token probe passed; what is left is an install on Mike's devices. → ledger L9016, #182
- 2026-11-06 — Removed: weapons granted outside the item finder arrive unequipped; #128 fixes it. → ledger L9101, #128
- 2026-11-06 — A settled shot is put back by hand, not by Undo recovery, which now leaves the shots spent; added: a row's Recover has no Undo. → ledger L9155, #170
- 2026-11-06 — Closed: Undo recovery dropping a home-joined entry's remainder, and its grant check reading "live now" rather than "revoked since": the full reversal they described is removed (#145's two entries). → ledger L9196, #170
- 2026-11-06 — Removed: the glossary editor's Save replacing the whole entry; it keeps the fields it doesn't show. → ledger L9219, #136
- 2026-11-06 — Removed four fixed in 1.9.1's Boot & storage branch: boot stopping where storage is blocked, a stale rules cache winning, no prompt for the boot autoload, and Remove's green line over a refused save. → ledger L9281, #142, #134, #135, #143
- 2026-11-06 — Google Fonts in the template (#144) is fixed: the fonts are embedded. → ledger L9357, #144
- 2026-11-06 — The Hit points window's deferrals: no Undo (#175), Coins' version for 1.9.2, the estimated 220px threshold. → ledger L9441, #112, #113
- 2026-11-06 — The estimated 220px threshold went: Temp's place is a measured fit now. → ledger L9501, #113
- 2026-11-06 — #129 and #130 fixed (Include spells; Flat AC, best shield); #132 fixed for the feature form; what waits on phase 2 recorded (the Vitals lock, the item form); `usesMax()` is tested. → ledger L9101, #129, #130, #132
