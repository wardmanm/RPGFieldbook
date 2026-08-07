# Humblewood wiring ledger

Running list of wiring cleanup. Items move to **Done** as they're handled.

Last updated after the app-fix pass (feat uses/cost forwarding, uses.max formula, trait/feat skill-choices).

---

## Done

### Data pass (Tier 1 + 2)
- Luma "Fated", Sera Luma "Songbird", Veret "Sensitive Skin" → `uses {1/long}`.
- Swift Strig / Grove Cervan "Swift" → `speed +5` effects.
- Greno redundant "Ability Score Increases" trait removed; stale subclasses `_note` corrected.

### App pass (fieldbook.html) + data that exercises it
- **Feat `uses`/`cost` now forwarded.** New `grantFeatDef()` helper feeds both feat-grant sites
  (background + ASI/level). `Bandit Cunning`'s `uses {1/long}` is now live (no longer dormant).
- **`uses.max` accepts a formula.** New `usesMax(f)` helper resolves a number, `{byLevel:[…]}`,
  `{formula:"level"}`, or `{formula:"<abbr>[±N]"}` (ability modifier, min 1), and re-resolves
  dynamically so it tracks ability changes. Unit-tested. **Wired:** Night Domain "Ward of Shadows"
  → `uses {max:{formula:"wis"}, per:"long"}`.
- **Skill-choice mechanism for race traits and feats.** New `runExtraChoices()` presents a
  "choose N of these skills" prompt (reusing the existing choice UI) after a race/background/feat
  is added, granting to the correct provenance sid so it reverts cleanly. A `choices` array is now
  read on race/subrace objects, on individual race traits, and on feats.
  **Wired:** Corvum "Learned", Kindled Corvum "Convincing", Cervan "Practical",
  Yantan Capran "Legacy of Learning", Tethera Capran "Friendly Face" (race traits); Woodwise (feat).
- **Scofflaw "Bonus Proficiency"** handled via a subclass **level-3** `choices` entry (that path
  already existed — no app change). Covers the five listed skills; the "or learn Thieves' Cant"
  alternative stays in prose (not a skill grant).

**Needs a browser smoke-test:** the choice prompts were added without an interactive run here.
Verify on-add prompts appear and grants show in the stat breakdown + revert on removing the
race/background/feat. Syntax (node --check) and the `usesMax` logic are tested; the modal UX is not.


## Done — equipment grants (this pass)

Structured starting equipment that links to the loaded item list, supports "this OR that",
and reverts cleanly on swap. **Decisions:** clean revert (provenance-tracked); backgrounds + classes;
XPHB auto-extracted via convert.py.

- **App:** `equipmentGrants` read on backgrounds, classes (once, at first add), and races.
  Fixed blocks apply immediately; `choose` blocks raise a picker (folded into the same post-add
  modal as skill choices). Items match the loaded item list by name (full item + effects + weapon
  attack), or fall back to a plain named item; gold goes to gp. Everything is tagged with its
  source sid so `revertEquipmentGrants()` removes exactly those items + attacks and subtracts the
  granted gold (clamped at 0). Player-owned items are never touched. Grant/revert unit-tested (13 cases).
- **Converter:** `convert.py` backgrounds + classes now emit `equipmentGrants` from 5e-tools
  `startingEquipment` (item refs, specials, currency→gp). Class `goldAlternative` dice → average gp.
  Parser unit-tested on fixtures; **needs a run against real 5e-tools source files** (couldn't run
  here — only the converted app JSONs were on hand).
- **Data:** 3 Humblewood backgrounds authored (fixed sets). 4 XPHB backgrounds authored as
  **testable placeholders** in `backgrounds-2024.json` — these regenerate when you re-run convert.py.
- **Schema:** documented as §6.10 in `rules-schema.md`.

**Needs a browser smoke-test:** add a background (e.g. Soldier → pick A or B), confirm items land in
Inventory with linked attacks, gold updates, and swapping the background removes them and rolls back
the gold.

**Known limitations:**
- **Class starting equipment fires on every `addClass`**, including a multiclass add (2024 RAW gives
  no starting equipment for multiclassing). Gate on "first class" later if wanted.
- Class gold-alternative uses the **average** of the dice, not a roll.
- Ammo/pack names ("Arrows", "Gaming Set") often don't match the item list and add as plain items;
  refine names or item data if you want them linked.


## Done — origin designators & item cost (this pass)

- **Origin designator** on every item and spell: a small clickable badge (letter) showing where it
  came from; tapping it opens "<Kind> — <detail> · added <date/time>". Kinds: Class, Background,
  Ancestry, Feat, Starting equipment, Purchased, Found, Traded, Reward, Gift, Crafted, Scroll/Item,
  Custom.
- **Origin picker** on the item and spell **forms** (dropdown + contextual detail field, e.g.
  "at (place)", "from (who)") and on the **bulk browsers** (one origin applied to the batch).
- **Auto-origin** on granted equipment: background/class/race grants tag their items automatically
  (B/C/A badge), derived from the provenance sid. Legacy items without an origin synthesize a badge
  from their `grant`/`granted` field.
- **Item cost:** optional per-item Cost (gp) on the item form, shown on the row, with a
  **Total value** line at the bottom of the inventory (Σ cost × qty). System-aware: gp is the gold
  unit in both D&D and Humblewood.
- **Spells:** the old "Granted by" dropdown became the richer **Origin** control. Allotment counting
  is preserved — Class/none counts; Feat/Background/Ancestry/Item and all narrative origins are
  excluded (mapped through `grantedFromOrigin`). Round-trip mapping unit-tested.

Data model (per-character, backward compatible): items gain optional `cost` and `origin
{kind,detail,at}`; spells gain optional `origin`. Old saves render fine (badges synthesize or hide).

**Needs a browser smoke-test:** add an item with a cost + origin and confirm the badge, tooltip,
info modal, and total; bulk-add from the browser with an origin set; add/edit a spell and confirm
the origin badge and that allotment counts still behave.


## Done — spell attacks, casting & active spells (this pass)

**Decisions:** expired active spells → flag + prompt to end; support both attack-roll and save
spells; Active Spells is its own card on the Sheet tab.

- **Spells as attacks.** The spell form gains "This spell is → Attack roll / Saving throw", plus
  attack kind (ranged/melee), damage dice, damage type, and (for saves) the save ability. These
  sync an entry into **Attacks & Weapons** (like weapons do): attack rolls show spellcasting
  to-hit and read "Spell · Ranged"; save spells show "Spell save · DC N ABILITY". Editing/deleting
  the spell keeps the attack in sync; to-hit tracks your spellcasting ability automatically.
- **Collapse in Attacks.** Per-row carets — collapsed shows name + to-hit/DC; expanded adds damage
  and notes (mirrors Inventory).
- **Cast.** A Cast button on each spell (and on its attack row). Casting spends a slot of the
  spell's level — if none are free it offers to upcast to the next available level; cantrips spend
  none. Attack/save spells then pop the attack prompt (to-hit or DC + damage). Concentration or
  timed spells go to Active Spells; starting concentration while already concentrating asks before
  replacing.
- **Active Spells card** (Sheet tab): each shows level, a C badge for concentration, and elapsed /
  duration. Per-spell elapsed controls (− rd / + rd / + sec…) and a global **Round** counter whose
  ± advances every active spell by 6s. Duration is parsed from the spell's meta or the form's
  Duration field. When elapsed reaches duration, the spell is flagged and you're prompted to end it.

Data model (per-character, backward compatible): spells gain `atkType/atkKind/saveAbility/dice/
damageType/conc/duration`; attacks gain `spellId/source/save`; character gains `activeSpells[]`,
`combatRound`, `atkCollapse`. Casting engine unit-tested (duration parse, slot/upcast selection,
concentration conflict, round/elapsed/expiry).

**Needs a browser smoke-test:** mark a spell as an attack and confirm it appears in Attacks with the
right to-hit/DC and collapses; cast a leveled spell and watch the slot decrement + upcast prompt;
cast a concentration spell twice to trigger the replace prompt; advance the round counter and confirm
all active spells tick and the expiry prompt fires.


## Done — spell UX pass (this pass)

- **Tab order** is now Sheet → **Spells** → **Inventory** → Story → Rules.
- **Active Spells** card moved from the Sheet tab to the **Spells** tab (under Spell Slots).
- **Attack cantrips now auto-detect.** Adding a spell from the library (or inserting it in the form)
  infers its attack info from the text — "make a ranged/melee spell attack" → attack + kind; a
  "<Ability> saving throw" → save; and the first "NdN <type> damage" → dice + type — so Ray of Frost,
  Chill Touch, Fire Bolt, Fireball, etc. appear in Attacks automatically. Detection only runs when a
  spell has no explicit setting, so turning a spell to "Not an attack" sticks. A load pass backfills
  spells added before this change. (Tested against the real 2024 spell texts.)
- **Cast feedback:** casting now shows a brief **toast** ("Cast Ray of Frost · cantrip", "Cast Bless ·
  level 1 slot · active") in addition to the slot decrement and the attack prompt.

**Smoke-test:** add Ray of Frost from the browser and confirm it lands in Attacks; cast something and
watch for the toast; confirm the Active Spells card and round counter now live on the Spells tab.


## Done — item find-screen cost & origin (this pass)

The item browser ("find" screen) only had an origin *kind* dropdown. Added:
- **Origin detail** input and a **cost (gp)** input in the browser footer (applied to the batch you add).
- **Auto-cost from item data:** each added item's cost now defaults to its listed price, parsed from
  the rules data ("15 gp" → 15, "2 sp" → 0.2, etc.). The footer cost field overrides it; blank uses
  the listed price. Same auto-fill added when inserting an item via the form's "Insert from rules pack".
`costToGp` parser unit-tested against the real price strings.


## Done — armor equipping & AC (this pass)

Armor items had empty `effects`, so no Equip toggle showed and they never affected AC (armor sets a
base, not a bonus). Now:
- **Equip toggle appears** for anything that reads as armor (category Armor / type Armor|Shield / an
  "AC …" description line), not just effect-carrying items.
- **AC computes from equipped armor:** base + Dex capped by armor type (light uncapped, medium +2,
  heavy none), plus shields (+2), plus any `ac` effects (magic armor, Defense style, Ring of
  Protection). Falls back to manual AC or 10+Dex when nothing's worn. The AC breakdown shows the
  armor/shield/Dex sources. Parsed from the item description (a structured `armor` field is also
  supported). Unit-tested across light/medium/heavy/shield/unarmored/manual (11 cases).

Note: magic armor's numeric bonus still needs an `ac` effect on the item; the base comes from the
armor line. (A converter enhancement to emit a structured `armor` field for items is a possible
future cleanup — description parsing covers the current data.)


## Done — UX pass: sticky tabs, inventory sections, favorites, ToC (this pass)

- **Sticky tabs, collapsing header.** The tab bar now stays pinned at the top; the title/toolbar
  scrolls away as you go down (and returns at the top). No more scrolling up to change tabs.
- **Inventory sections.** Items are grouped into collapsible sections — Weapons, Armor, Consumables,
  Magic Items, Tools, Gear, Loot — derived from each item's category/type. Within a section, equipped
  items sort first, then alphabetical. Section headers collapse like the item cards (state saved).
- **Favorites.** A ★ on each item pins it to a Favorites section at the very top, alphabetized,
  regardless of its category. (Favorited items live only in Favorites to avoid duplication.)
- **Table of contents.** A ☰ button in the sticky tab bar flies out a per-tab list of that tab's
  sections (built live from the visible cards / inventory sections); tapping one smooth-scrolls to it,
  offset for the sticky bar. Closes on tab switch or backdrop tap.

Data model: items gain an optional `fav` flag; `invCollapse.sections` stores per-section collapse.
Section mapping + sort order unit-tested.

**Smoke-test:** scroll a long tab and confirm tabs stay put; open the ☰ flyout and jump to a section;
favorite an item and watch it hop to the top; collapse a section; equip an item and see it sort first.


## Done — custom item category (this pass)

The item form now has a **Category** dropdown so custom items land in the right inventory section
instead of always "Loot". It offers Automatic (shows the section it would fall into) plus the seven
sections. Stored as `sectionOverride` so it never clobbers a library item's own category; `invSection`
honors a valid override first. Editing preserves a library item's category/type. Unit-tested.


## Done — export/import completeness (this pass)

Export was already whole-object (`JSON.stringify(character)`), but **import** ran through a
whitelist `migrate()` that only carried named fields — so recently-added fields were silently
dropped on load. Since `migrate()` also runs on the autosave restore, active spells (etc.) would
vanish on a page refresh, not just on file import.

Rewrote `migrate()` to **preserve every field by default**, then normalize the structured ones
(hp/abilities/saves/skills/slots/coins) onto complete defaults and guarantee list/map fields have
the right type. Recovered fields that were being dropped: **activeSpells, grantGold, atkCollapse**
(combatRound was already carried as a scalar; invCollapse.sections rode inside invCollapse). Item,
spell, and attack sub-fields were already safe (whole arrays copied). Added `grantGold` to
`blankChar`. Now future fields survive automatically — no more per-field maintenance in migrate.

Round-trip unit-tested (16 cases): every new field survives export→import, unknown fields survive
(future-proof), and null/minimal input falls back to safe defaults.


## Done — app version & changelog (this pass)

- **`APP_VERSION`** constant (now **1.0.0**) shown as a badge in the top bar; tapping it opens an
  in-app changelog. The changelog data is embedded in `fieldbook.html` (keeps the single-file,
  offline design), and `docs/CHANGELOG.md` is generated from that same data so they never drift.
- **Process for every future `fieldbook.html` change:** bump `APP_VERSION`, add a `CHANGELOG` entry
  (version, date, notes) at the top of the array, and regenerate `CHANGELOG.md` when rebuilding the
  bundle. The v1.0.0 entry captures the whole recent feature run as the baseline.


## Done — import conflict handling (v1.1.0)

Character import now detects when a file's internal `id` matches a character you already have and
prompts: **Replace** (overwrite the saved copy), **Import as copy** (fresh id + "(copy)" name, keeps
both), or **Cancel**. A brand-new or genuinely different character still imports directly with no
prompt. Refactored the shared write path into `finishImport()`.


## Done — full 2024 spell list (data)

The spell converter had the same `basicRules2024`-only filter as backgrounds, so we only had the 339
free-rules spells — missing 52 full-PHB spells (smites, summons, Armor of Agathys, Hunger of Hadar,
Witch Bolt, Toll the Dead, Thorn Whip, etc.). Changed the filter to `source == "XPHB"` and regenerated
`spells-2024.json` — now all **391** XPHB spells. Existing 339 are byte-identical (class tags preserved
by name merge). With `sources.json` now provided, regenerated with `--sources`: **all 391 spells carry authoritative
class tags** (0 untagged), and the existing 339 tags were reproduced unchanged. Not a version bump
(no fieldbook.html change).


## Done — GitHub update badge (v1.2.0)

Dropped the hosting/CD approach (removed the Actions workflow, manifest, version.json, HOSTING.md).
Instead: an in-app update check. On load (when online and `UPDATE_REPO` is set to "owner/repo"),
the app queries the GitHub Releases API; if the latest release's tag is newer than `APP_VERSION`, an
"↑ Update" pill shows in the top bar linking to that release's page. Fails silently when offline,
rate-limited, or unconfigured. `cmpVer` handles v-prefixes and numeric ordering (unit-tested).
To publish: set `UPDATE_REPO` once, then cut a GitHub Release tagged `vX.Y.Z` (attach fieldbook.html).


## Done — Claude Code handoff (repo scaffolding)

Moving ongoing work to Claude Code (runs locally against the git repo, commits under the owner's own
credentials — no token sharing from chat). Added to the repo:
- **CLAUDE.md** — project brief Claude Code reads automatically: single-file/offline constraints,
  the validate workflow, the version-bump-and-changelog rule, migrate/effects/provenance/armor/spell
  invariants, and the converter `basicRules2024` lesson.
- **build.sh** — one command: node --check the app JS, JSON-validate all data, regenerate
  docs/CHANGELOG.md from the in-app array, build fieldbook-bundle.zip. Tested green.
- **.gitignore** — build artifacts, scratch files, node/python/editor noise.
The zip is now a ready-to-init repo (root files + data/ + docs/ + scripts/).


## Added — source-split plan (docs only, not implemented)

Owner wants to split the JS/CSS into `src/` modules but keep shipping one concatenated
`fieldbook.html` (no server, works from file:// everywhere). Wrote the brief so Claude Code can
execute it later on request — no code split done, app/build unchanged:
- **docs/ADR-001-source-split.md** — decision, file:// rationale (ES modules + fetch blocked on
  file://, so concatenate rather than multi-file), suggested `src/` layout + ordering rules
  (cut don't reorder; boot() last), and the acceptance test (built output === pre-split, whitespace
  only).
- **CLAUDE.md** — a "Planned" section: rules that take effect once the split is done (src/ is source,
  never hand-edit the built file, concatenation-only).
- **build.sh** — a commented, inert concatenation stub showing exactly where the src/-to-html step
  plugs in (uses fieldbook.template.html markers <!--@@CSS@@--> and //@@JS@@).

---

## Deferred — needs the source book

### Cervan "Surge of Vigor" — frequency unknown
Extracted prose ends with "(see book)" and gives no explicit per-rest limit, so no `uses` tracker
can be assigned yet. Resolve when the Humblewood 1 core race page is on hand.

---

## Known minor limitations (not blocking)

- **Class-level feat skill-choices** grant to sid `class:<Name>`, so they revert when the class is
  removed but **not** on an individual level-down (the grant model doesn't key by level). Race and
  background choices revert fully. Matches how feat features/grants already behaved.
- **Feat + subclass at the same level:** if one level ever both grants a feat-with-skill-choice and
  a subclass pick, the two prompts can race (last modal wins). No current Humblewood entry does this.

---

## Verified NOT gaps (do not "fix")

- Flat skill grants are already wired at the **container** (race/subrace) top level, not the trait.
- Expertise cases stay prose (Gallus "Communal", Sun Touched "Intimidation").
- Non-numeric effects stay prose: advantage/disadvantage, resistances/immunities, Darkvision,
  climb/swim/burrow/fly speeds (only walking `speed` is a target), natural weapons, "you know X".
- Player-choice ability boosts on feats (Sun Touched, Moonlit) stay by-hand — no feat-level
  ability-choice mechanism (could mirror the new skill-choice path later if wanted).
