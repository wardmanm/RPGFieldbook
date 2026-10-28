# Humblewood wiring ledger

Running list of wiring cleanup. Items move to **Done** as they're handled.

**Since 2026-09-28 this is the log, not the reference:** how each part works now lives in the wiki, [src/docs/wiki/](../wiki/index.md), checked against the code. Append only — the wiki cites this file by line number.

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

**Superseded in part** — see "choose N pickers actually enforce N" near the end of this file. The
choosers have since had a real interactive run, `choiceFieldHTML`'s markup is asserted in `sheet.js`,
and the wiring is regex-guarded in `rules-data.js`. Grant revert on removal is still browser-only.


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


## Done — item origin UX pass (issue #14)

A polish pass on the origin controls added in the two entries below, plus the two defects that were
sitting in the same code.

- **The browse footer stopped restating the global input styling inline.** Each of the three controls
  carried `border-radius:10px; border:1px solid var(--hair); min-height:40px`, which fought
  `input,select,textarea` (6px / 1.5px / 42px) in `20-cards.css` — so the footer was visibly a
  different shape and border weight from every other field in the app. They are now labelled `.br-f`
  cells (Origin / Detail / Cost (gp)) inheriting the global rule. `width:auto` had to move from the
  wrapper to `.br-origin select`, which is where it actually does its job now.
- **A typed origin detail with no kind chosen was silently discarded.** `og` is only built when
  `os.value` is truthy, and the detail input was always enabled, so the text just vanished on Add.
  It now starts `disabled` and `syncOrigDet()` enables it, clears stale text and sets a per-kind
  placeholder — the same behaviour the item form has.
- **`originOptionsHTML`'s `includeClass` parameter was dead and is gone.** The item form passed
  `false` meaning "hide Class". Implementing that as written would have been a bug: class grants tag
  their items `kind:"class"` via `originFromSid`, so hiding the option makes a class-granted item's
  own origin unselectable — and unrenderable — the moment you edit it. Deleted rather than honoured.
- **The item form's Origin pair now matches the spell form**: a `.g2` row with a `hint` under it. The
  detail box is DISABLED rather than hidden when there is no kind — hiding it re-flowed the lower
  half of an already long form on every dropdown change.

`origin` stays out of `UPD_FIELDS` (character-local, must survive a rules update). Verified by
driving the browser: add with origin+cost applies both and paints the badge; an edit round-trip
preserves `category`, `type`, `cost`, `origin` (including its `at`) and the `src` provenance stamp;
at 380px the footer wraps and the Add button stays fully on screen.

The origin helpers had **no unit coverage at all**, which is how both defects survived —
`ORIGIN_KINDS`, `originLabel`, `originFromSid`, `itemOrigin`, `originOptionsHTML` now have it.


## Done — the ability/skill layout choice (issue #17)

Two looks over ONE set of ids, chosen per character (`character.statStyle`, "classic" | "grouped"),
mirroring the `hdStyle` pattern beat for beat: `blankChar` default, a resolver whose fallback agrees
with that default (so no migration), pure string builders, a `.seg` control in Settings → This
character. Grouped lays the six abilities out three across and two down, each a compact header over
its saving throw and the skills it governs; the Skills card is HIDDEN, not removed.

**The first cut was a single vertical column and it was rejected on sight — worth remembering why.**
Every row stretched the full width of the card with a two-word label in it, so the block read as
mostly air, and the ability sat in a tall box to the LEFT of a list that for STR is one row. Fixed by
(a) three across, two down — the same rhythm the classic `.abilities` grid already uses, (b) turning
the ability into a compact header ROW over its skills (name, modifier, score on one line) instead of
a column beside them, and (c) tightening the row padding and moving the dotted rule to
`.srow + .srow`, so it separates rows rather than boxing each one. Card height went from taller than
the viewport to 448px. None of this was visible in the DOM assertions — only in a screenshot.

**Three things that are not obvious and cost real time:**

- **The hook is `renderAll()`, not the settings handler.** `buildAbilities`/`buildSkills` only ever
  ran at boot, but the setting is per character and every swap path — `loadCharById`, `newCharacter`,
  import, settings-import — ends in `renderAll()`. Building only on toggle meant loading a grouped
  sheet over a classic one kept the classic markup forever. `buildStats()` is now `renderAll()`'s
  FIRST statement: it must precede the `[data-path]` loop, because the rebuild blanks the six score
  inputs that the loop refills, and `recompute()` at the end repaints every number.
- **`buildSkills()` must clear `#skills` and return in grouped mode**, not merely let the card be
  hidden. Leaving the classic rows puts a second `#skill-perception` in the document;
  `getElementById` takes the first in document order, so the visible copy keeps updating while the
  hidden one rots — and print reads by id too. Guarded by a test asserting each skill id appears
  exactly once.
- **`.agroups` needs `grid-column:1/-1`.** `#abilities` is itself `repeat(3,1fr)`, so the grouped
  block rendered into one third of the card with every skill label wrapped. Caught by a screenshot,
  not by any test — the suite has no DOM and no layout.

The Skills card keeps `data-note="skills"` with `id` placed AFTER it, because `rules-data.js` counts
the literal `<div class="card" data-note="` prefix to assert 19 cards. The legend is one node MOVED
between the cards, appended to the card (never to `#abilities`, which gets cleared). Expertise is
marked by CSS off the dot's `data-lvl`, which `recompute()` already writes — no JS, which is what
keeps the whole feature display-only.

**Known gap, shipped deliberately:** in grouped mode the Skills card is hidden, so its note button is
invisible, and the Notes tab only lists sections that already HAVE a note. A player who never wrote a
Skills note cannot start one while in grouped mode. Existing notes stay listed and editable, and
`jumpToNote` degrades to scroll-to-top. Mitigating it means hosting a second note button in the
Abilities label, which is worse UI than the gap.


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

## Done — source split executed (ADR-001), no app change

The split from the previous entry is now implemented. **`APP_VERSION` was deliberately NOT bumped:
the shipped file is byte-for-byte unchanged.**

- **Acceptance:** the first build reproduced the committed app exactly.
  `sha256 adef1ec39ec6c08c7a2d6cf42d72d5f954bab21c28a25c29ca235dffaf2ad466`, 280,473 bytes, for both
  `git show HEAD:fieldbook.html` and the freshly built `dist/fieldbook.html`. Git records the
  relocation as a pure rename (`0 0 fieldbook.html => dist/fieldbook.html`). This clears a stronger
  bar than ADR-001 asked for (it wanted whitespace-normalized equality), so there is **no functional
  delta and nothing to smoke-test for this change**.
- **Layout:** `src/` (template + manifest + 19 js + 6 css fragments) is the source; `dist/` holds the
  built app (tracked) and the bundle zip (ignored). The zip's *internal* layout is unchanged, so the
  player-facing download and README section 9 are untouched.
- **Fragments are positional slices** cut at the file's own banner comments — rule 1 forbids
  regrouping by concern. Consequence worth remembering: **`APP_VERSION`/`CHANGELOG` live in
  `src/js/30-version.js`**, not `00-constants.js` as ADR-001 sketched.
- **`src/manifest.json` is the authoritative order**, not filename prefixes and not a glob. The build
  hard-fails on drift both ways. A glob would have silently swallowed a stray `*.OLD.js` — this repo
  makes those.
- **scripts/build-html.js** — Buffer-based splice builder with `--check` (stale gate for a hook/CI)
  and `--force`. Guards, all tested: BOM, CR bytes, missing final newline, `boot();`-last invariant,
  fragment-order drift, and a clobber guard that refuses to overwrite a hand-edited artifact.
- **scripts/gen-changelog.js** — extracted from build.sh (see the bug below).
- **Added** `.gitattributes` (`eol=lf`) and `.editorconfig`. These are load-bearing now: the build is
  byte-exact, so a CRLF checkout on Windows would silently add ~3,100 bytes to the shipped app.

### Bug found and fixed in passing: build.sh was zsh-only

The committed pre-split `build.sh` parsed under **zsh** but not under **bash** — which is the
interpreter its own `#!/usr/bin/env bash` shebang selects. The apostrophe in `app's`, inside a
`<<'NODE'` heredoc nested in a `$(…)` command substitution, opens a quote that bash never closes;
zsh parses the same text fine. Verified on this machine: `bash -n` (3.2.57) and `sh -n` both fail;
`zsh -n` passes.

Consequences, measured by running the pre-split script from a clean `git archive` of HEAD:

- Run as `./build.sh` (bash, the documented way): the JS `node --check` and the `data/*.json`
  validation **both ran and passed**, then it died at the changelog step with
  `line 55: unexpected EOF`, exit 2. `docs/CHANGELOG.md` was never regenerated and
  `fieldbook-bundle.zip` was never produced. Loud failure, not a silent one.
- Run as `zsh build.sh`: full pipeline succeeds, exit 0, and the regenerated `docs/CHANGELOG.md` is
  byte-identical to the committed one. So earlier "tested green" ledger entries were almost
  certainly true — via zsh — and nothing in the repo is wrong as a result.

Fixed by moving that block to `scripts/gen-changelog.js`; `build.sh` now passes `bash -n` and runs
end to end under bash. This was a portability bug, not a correctness one.

### Follow-up: docs split by audience, bundle trimmed to player-facing

The zip had been shipping the whole repo — `CLAUDE.md`, `build.sh`, dotfiles, and (after the split)
`src/`. Owner's call: the bundle is for players, so development material stays out of it.

- **`src/docs/`** now holds the dev docs: this ledger and `ADR-001-source-split.md`. They live under
  `src/` precisely because `src/` never goes in the zip. `docs/` is now player-facing only
  (rules schema, converter notes, CHANGELOG).
- **The zip is an allowlist**, not a snapshot: `fieldbook.html`, `README.md`, `data/`, `docs/`,
  `scripts/convert.py`. Exactly what README section 9 advertises — which it hadn't matched before.
  Dropped: `CLAUDE.md`, `build.sh`, the dotfiles, `src/`, `build-html.js`, `gen-changelog.js`.
  384 KB → 357 KB, 22 files.
- **`build.sh` verifies the bundle after zipping** and **deletes it** if anything development-shaped
  got in (`src/`, `CLAUDE.md`, `build.sh`, dotfiles, the ledger, an ADR, or a build script). An
  allowlist that is not enforced drifts; a bad bundle must not be publishable. Tested by planting a
  copy of this ledger in `docs/` — build exits 1 and removes the zip.
- **`docs/CHANGELOG.md`'s header was reworded for players.** It used to say "Bump `APP_VERSION` and
  add an entry here" — maintainer instructions in a file that ships to players. That guidance lives
  in CLAUDE.md; the generated file now just explains what the list is.
- README section 9 updated to list what is actually in the download.

**If you add a dev-only doc or tool, put it under `src/` or at the repo root — never in `docs/`.**

### Follow-up: a second zip, `dist/fieldbook-source.zip`

**SUPERSEDED — the source zip was removed on 2026-08-10; see the entry at the end of this file.**

The player bundle deliberately drops the sources, so the build now also emits a full-repo zip for
archiving and handoff. Two zips, two audiences.

- **Membership is `git ls-files --cached --others --exclude-standard`** — tracked files *plus*
  untracked-but-not-ignored ones. Chosen over `git archive HEAD` so uncommitted work in progress is
  captured, and over a `find`-based copy so `.gitignore` keeps the artifacts out for free. `.git/`,
  both zips, `.buildstamp` and `.DS_Store` are excluded; `dist/fieldbook.html` is tracked so it
  rides along and can be checked against its own rebuild.
- **The step skips (does not fail) when there is no `.git`.** That matters: someone who unzips the
  source zip has no git checkout, and `./build.sh` must still work for them. Verified — a fresh
  unzip elsewhere rebuilds `dist/fieldbook.html` **byte-identically**, printing
  `skipped — not a git checkout` for the source-zip step.
- `.gitignore` now uses `dist/*.zip` rather than naming each one, so a new zip can't accidentally
  become a tracked file *or* get swept into the source zip by `--others`.
- Sizes: player bundle 357 KB / 22 files, source 478 KB / 59 files.

README is untouched — it documents the player download, and the source zip is not player-facing.

### Follow-up: zips are named for the version

`fieldbook-bundle.zip` → **`fieldbook-v<APP_VERSION>.zip`**, and the source zip likewise
(`fieldbook-v1.2.1-source.zip`). The `v` prefix matches the `vX.Y.Z` release tag the in-app update
check compares against, so a release asset needs no renaming.

- `build.sh` **validates `$VER` against `X.Y.Z` before using it in a filename** — otherwise a failed
  version parse would silently produce `fieldbook-v.zip` and ship an unidentifiable bundle.
- **`rm -f dist/*.zip` runs before both zip steps**, so `dist/` never accumulates stale versions and
  a failed build cannot leave the previous version's bundle sitting there looking current.
- `.gitignore` uses `dist/*.zip` (not per-name entries) so this keeps working as versions change.

## Done — versions are cut on release, not on every edit

Owner's call: stop bumping `APP_VERSION` per change. Keep a running notebook instead and version it
when a release is expressly kicked off. `./build.sh` is run constantly for validation, so it had to
stop being the thing that bumps.

- **`src/docs/UNRELEASED.md`** is the notebook — `- ` bullets under a `## Pending` heading, written
  in player-facing language. It is a dev doc under `src/`, so it never ships.
- **`./build.sh --release patch|minor|major|X.Y.Z`** cuts a version: `scripts/release.js` folds every
  pending bullet into a new `CHANGELOG` entry in `src/js/30-version.js`, bumps `APP_VERSION`, empties
  the notebook, and *then* the normal build runs so the artifact carries the new version. A bare
  `./build.sh` never touches either file — verified by hashing them across repeated builds.
- **`APP_VERSION` now means "last released version"**, not "version of the working tree".
- Guards, all tested: empty notebook → exit 1 (nothing to release); unknown level → exit 1; an
  explicit version that isn't higher than the current one → exit 1 (it would break the in-app update
  check, which compares the newest release tag against `APP_VERSION`). A failed release leaves the
  version untouched.
- A plain build prints the pending-note count so work in progress can't be quietly forgotten.
- `release.js` deliberately does **no** git work — no commit, no tag, no push. Cutting the GitHub
  Release stays a human step.
- The header comment in `src/js/30-version.js` now says both constants are machine-written.

### First change through the new pipeline: character-card delete button

`.icon` sets a fixed `height:30px`, so `.hcard`'s `align-items:stretch` left the delete button at the
top of the row; `.hcard-star` looked right only because it already set `align-self:center`. Added
`.hcard>.icon{align-self:center}` in `src/css/30-sheet.css`. **Unreleased** — it is the first bullet
in the notebook. Confirmed the built `dist/fieldbook.html` diff contained exactly that one CSS rule
and nothing else. **Not yet visually confirmed in a browser — owner QA.**

### Import character from the home screen

The home library header now carries an **Import** button beside **New character**
(`#homeLoadChar` in `src/fieldbook.template.html`, wired in `src/js/90-boot.js`).

Deliberately **no new import code**. The button just clicks the existing hidden `#fileLoad` input,
whose change handler already routes to `importChar()` — so the parse guard, `migrate()`, the
ID-clash Replace / Import-as-copy prompt, and skin-switching on load are shared with the top-bar
**Load** button rather than duplicated. A hidden file input responds to a programmatic `.click()`
regardless of the home overlay covering it, so no second input was needed. Landing on the sheet
after import is `finishImport`'s existing `hideHome()`, unchanged, which also matches what **New
character** does.

Styling is one new modifier in `src/css/20-cards.css`: `.label .add.sub` recolours the existing
low-key `.add` pill to `--ink-soft` so Import reads as secondary to New character. Note the id is
`homeLoadChar`, **not** `homeImport` — `#homeImportBtn` is already the "Import rules files (bulk)"
button in the home setup panel, and both live on the same screen.

Verified: modal is `z-index:80` against `.home`'s `60`, so the clash prompt layers above the home
screen. `--ink-soft` (not `--muted`, which does not exist) is defined in all four theme blocks.
**Interactive behaviour is not confirmed here — owner QA.**

### GitHub update badge switched on
`UPDATE_REPO` in `src/js/30-version.js` set to `wardmanm/RPGFieldbook` (was `""` = disabled). The
badge only appears when a release tag compares **newer** than `APP_VERSION`, so the first release
that triggers it must be ≥ v1.2.2. The repo must also be public — the unauthenticated
`api.github.com` call 404s otherwise and `r.ok?r.json():null` silently no-ops.

### Tables — converter, `tables` category, Tables tab

**Root cause first: this was a converter data-loss bug, not a missing feature.** `flatten()` in
`scripts/convert.py` had `elif t in ('table','tableGroup','image','gallery'): pass` — every
5e-tools table was silently discarded while the prose around it was kept. Confirmed by grep: zero
`"type":"table"` / `colLabels` / `rows` / pipe-tables anywhere in `data/*.json`, while the shipped
data is littered with dangling references (Augury→Omens, Teleport→Teleportation Outcome, Deck of
Illusions, 8 staves with "the following table", the whole d100 **Wild Magic Surge** table — cited
by three later Sorcerer features that survived, Barbarian Rage Damage / Weapon Mastery, Bardic Die,
Carrying Capacity, Damage Types, Object AC/HP). 66 "table" mentions in `classes-2024.json` alone.

**Converter.** A table sink (`_SINK`) plus a `table_ctx(sink, name, kind)` context manager; each
`convert_*` wraps its per-entity `flatten()` call so tables inherit an `owner`/`ownerKind`.
`_norm_table` normalizes to `{name, cols, align, rows, owner, ownerKind}`; `_cell_text` handles the
three 5e-tools cell shapes (string/number, `{roll:{min,max,pad}}` → `"01-02"`, `{entry|entries}`);
`_register` dedupes identical tables and uniquifies name collisions — **names are the app's merge
key**, so this is load-bearing. `tableGroup` recurses. Each lifted table leaves a `[Table: Name]`
anchor in the prose at the exact spot it came from.

Deliberate: **when no sink is active the old drop behaviour is kept** rather than emitting an
anchor. An anchor with no table behind it would be worse than the silent drop it replaced.

`_class_tables()` converts `classTableGroups` into a Level-indexed `"{Class} Features"` table,
recovering every column — this is the fix for Rage Damage / Weapon Mastery / Bardic Die. Spell-slot
groups are skipped (the app derives slots by level; a 10-column grid would swamp a phone).
`_spell_notes()` is **left exactly as-is** — it feeds the per-level "you can now have N cantrips"
notes; the overlap with the new table is intentional. Output is `tables-2024.json` via `all`, or
`--tables PATH` on any single subcommand.

Also fixed in passing: `_write()`'s entry-count `or` chain omitted items/backgrounds/races/
subclasses, so those files always printed "0 entries" — cosmetic, but it hides real counts on the
run that matters.

**Two further data-loss bugs found while verifying against the real 5e-tools tree** (`_conversion-data/5etools-v2.33.2`, which is on disk — the conversion was actually run, not just reasoned about):

1. **`refSubclassFeature` / `refClassFeature` nodes were dropped too.** A feature's entries can
   *reference* a sibling feature instead of containing it; `flatten()` fell through those silently,
   losing the entire referenced feature. 558 such nodes across the dataset. This — not the table
   drop — is why **Wild Magic Surge** was missing: the feature holding the table was never inlined,
   while Controlled Chaos and Tamed Surge survived and kept citing it. Fixed with a `ref_ctx`
   resolver hook mirroring the table sink, wired to `convert_classes`' existing `cfidx`/`sfidx`,
   with a `_REFSEEN` cycle guard so a self-referencing feature can't loop.
2. **The `basicRules2024` trim, again — this time in feats and items** (owner asked for full XPHB).
   `pick_2024_preferred()` filtered on the `basicRules2024` flag, which selects only the *free*
   rules subset. Now it takes everything with `source == "XPHB"` and backfills basic-rules entries
   whose names XPHB doesn't cover. `convert_items` used the same flag inline and now routes through
   the same helper. Backgrounds and spells already filtered on source and are unchanged.

Measured against the real data, versus the shipped `data/*.json`, **nothing was lost anywhere**:
feats 17 → **77** (+60: Actor, Athlete, the Fighting Styles, all the Boons), base items 78 → **99**
(+21 ammunition), magic items 440 → **528** (+88). conditions 18, glossary 114, backgrounds 16,
spells 391, classes 14 — all unchanged. Tables recovered: **97 unique, 897 rows** (13 class, 38
subclass, 28 item, 13 spell, 4 rule, 1 feat), 86 prose anchors, **0 dangling, 0 unresolved `{@`
tags**. Wild Magic Surge 25 rows, Deck of Illusions 33, Barbarian Features 20 with the Rage Damage
and Weapon Mastery columns present.

Caveat for the next run: `all` globs `items-base*.json`, so magic items are still a separate
invocation — give it its own `--tables` path. The two table packs merged cleanly here (97/97 unique
names), but names are the merge key, so a collision between the two files would silently replace.
Worth re-checking whenever the source data is updated.

**App.** New rules category `tables` registered in four places (`00-constants.js` initializer,
`RULE_CATS`, `mergeRules` cats map, `resetRules`). `reindexRules()` and `recomputeDups()` each
carried their own hardcoded copy of the nine-category list — both now use `RULE_CATS`. That
duplication was exactly the trap that would have left tables without an `_id`; four copies of one
list is a bug generator, not a style nit.

New `src/js/86-tables.js` (`findTable`, `tablesFor`, `tableHTML`, `openTableView`, `renderTables`,
`tableChipsHTML`) and `src/css/35-tables.css`; both added to `src/manifest.json`. Tables tab +
panel in the template; ToC picks it up for free via the existing `.card > .label` scan. Reuses
`openModal` as-is — no new modal plumbing.

`highlight()` in `10-compute.js` renders the anchors. **Ordering is load-bearing**: anchors are
lifted out *before* `esc()` (so names stay raw for lookup) and *before* the glossary pass, which
would otherwise match a glossary term inside a table name ("Damage Types") and corrupt the markup
built from it. Placeholder is `\ue000` — private-use, so it cannot occur in rules text, `esc()`
leaves it alone, and being a non-word char the glossary `\b…\b` pass cannot match across it. One
mark per anchor, restored in order. **An unresolved anchor degrades to the plain sentence "the X
table", never a dead chip** — the tables pack is a separate optional download.

Tested (scratchpad, throwaway): 36 Python checks on the converter (roll padding, tag stripping,
ragged-row padding, dedupe/uniquify, tableGroup recursion, no-sink drop, class-table column
recovery, `_spell_notes` unchanged) and 45 Node checks on the app (cell escaping incl. `<script>`
and quotes, the glossary-term-inside-a-table-name hazard, multi-anchor ordering, a stray PUA char
in source text, unresolved-anchor fallback, `migrate` round-trip and idempotence, `mergeRules`
ingest/replace). Plus an end-to-end `convert.py all` on a synthetic 5e-tools tree: every emitted
anchor resolved, names unique, no `{@` residue.

**Not verified here:** anything interactive. Owner QA — the tab, the chips, the modal-from-modal
case (the modal is a singleton, so opening a table from inside a spell preview replaces it), phone
width scrolling, and both skins × both themes.

### Full re-conversion, data reorganized by system, bundled packs, species

**`convert.py all` was broken against the real 5e-tools tree, silently.** Verified with `glob.glob`
against `_conversion-data/5etools-v2.33.2`: `spells*.json` and `class-*.json` matched nothing
because `spells/` and `class/` are *subdirectories*, so a plain `all` produced **no spells and no
classes** — the `if X:` guards just skipped the writes. `sources.json` (in `spells/`) was likewise
unfound, so spells got no class tags. `items-base*.json` matched first, so `items.json` (magic) was
never reached. `class-sidekick.json` has `hd: null` and killed all 14 classes with a TypeError.

**Worst of it: the overlay and class-resources were being dropped.** `all` looked for
`overlay.json`/`class-resources.json` in the *input* dir; both live in `data/`. And `all` had no
`--resources` flag at all, so there was no way to supply them. My earlier "nothing lost" check
compared entry *names* only — at content level that run lost **Archery +2 ranged / Defense +1 AC**
(feats *and* fighting-style options) and the **Rage / Focus Points / Sorcery Points** trackers.
Both are now asserted explicitly in the test suite; a name-level diff is not sufficient here.

Fixes: search `d` + `d/spells` + `d/class`; convert both item files into one table sink; look for
the helper files in the input dir then fall back to the repo's `data/`, printing which was used;
`--overlay`/`--resources` on `all`; skip a class with no `hd` and note it; and a `WARNING:` line
plus an end-of-run summary for every missing input. Silent skipping was the root cause of every bug
in this whole task — the converter now refuses to be quiet about it.

One command, no staging, everything found: 18 conditions · 114 glossary · 99 items · 528 magic
items · 16 backgrounds · **77 feats** · **10 species** · 391 spells · 14 classes · **100 tables**.

**`convert_races()`** (new). 2024 lineages live in `_versions` (`"Elf; Drow Lineage"` → subrace
`Drow`), whose `_mod.entries` is sometimes a dict and sometimes a list — both handled. Covers Elf 3,
Gnome 2, Goliath 6, Tiefling 3. Dragonborn's `_versions` is an unnamed `_abstract` template, so its
10 ancestries come from the Draconic Ancestry table's first column instead — a real chooser rather
than prose, per CLAUDE.md. Aasimar/Dwarf/Halfling/Human/Orc correctly have none. Skill blocks become
`choices` (Elf: 1 of 3; Human: any 1) rather than a bogus fixed `skills` list — the app already
supports race-level skill choosers (52-race.js:77). No `abilityScores`: 2024 puts those on
backgrounds.

**`data/` reorganized** into `data/5e2024/` and `data/humblewood/`, filenames unprefixed since the
folder names the system. `overlay.json` and `class-resources.json` stay at the `data/` root
**deliberately** — they are converter inputs, not loadable packs, and the bundler globs the system
folders, so anything inside would be swept into a pack.

**`scripts/bundle-rules.js`** rolls each folder into `dist/<system>_full.json` (gitignored artifacts,
attachable to a release), and the player zip's `data/` now carries only those two. The bundler
**mirrors `mergeRules` exactly** — keyed by name, last wins, replaced in place — because the whole
promise of a bundle is that importing it equals importing the files individually. That equality is
asserted for both systems in the test suite. It found one real duplicate: `Net` appears in both
`items.json` and `items-magic.json` (5e-tools' magic item file carries 200 mundane items). Deduping
it silently would have been wrong, so it is reported on every build. Hard failure is reserved for a
folder whose files disagree on `system`.

Side effect handled: the zip used to ship `overlay.json`/`class-resources.json` inertly in `data/`.
They now travel in `scripts/` next to `convert.py`, which needs them — without that an advanced
player regenerating data would hit the exact silent loss described above. `build.sh` validates
`data/**/*.json` recursively now, and the post-zip allowlist asserts `data/` holds *only* the two
bundles (and that bundling ran at all).

**App.** New `rulebook: true` pack flag, stamped onto entries as `_rulebook` by `mergeRules` beside
`_source`/`_file`; the loaded-data list buckets by rulebook → single category → Mixed, with a shared
`CAT_NAMES` display map replacing the inline `features?"traits"` ternary. **Clear all already
existed and was dangerous** — no confirmation at all, and it never called `renderRulesData()`, so
the list kept showing packs that were already gone. Now confirms with counts, states plainly that
characters are unaffected (`resetRules()` only touches the rules pool), refreshes, and is styled
`.tbtn.danger`; a matching button was added to the home panel.

**Species are filtered by system** in `raceOptions()` via a new `racesForCharacter()` +
`systemOf()`. Races only: Humblewood is a 5e *setting*, so its 1 class / 2 subclasses / 44 spells
supplement the D&D core and filtering those would break it — species are the one exclusive
category. `findRaceDef()` is deliberately **not** filtered: a character with a cross-system ancestry
(imported sheet, switched system) must keep resolving it or its traits vanish silently. Unknown
`_source` values show in both systems so homebrew is never hidden. `openAddRace` was also switched
to the filtered list, otherwise its `list.length` check would render an empty dropdown instead of
the "no entries — enter a custom name" hint.

Tested: 66 Python + 33 Node checks, all green, on top of the existing suites. Includes the two
content-level regressions above, the bundle round-trip for both systems, `findRaceDef` still
resolving cross-system, and Clear-all leaving `character` intact.

**Not verified here:** anything interactive — owner QA.

### Character version stamp + rules-update tool

**`appVersion` means "last reconciled against", not "last saved with".** `migrate()` deliberately
**preserves and never advances it** — migrate runs on every load, so stamping there would erase the
mismatch the tool exists to find. It advances only when the player applies updates or dismisses.
`blankChar()` seeds `""`; `newCharacter()` stamps `APP_VERSION`; `libTouch()` carries it into the
index so the home cards can badge it without parsing every character blob.

**TDZ trap, avoided deliberately.** `00-constants.js:44` runs `let character=blankChar()` at TOP
LEVEL, and `30-version.js` is concatenated after it. Referencing `APP_VERSION` from inside
`blankChar()` would throw a ReferenceError before any UI exists — a white screen, not a degraded
one. That is why the default is `""` and the real stamp happens in `newCharacter()`. The test suite
evaluates the whole concatenation in manifest order specifically to catch a regression here. Do not
"tidy" this by moving `APP_VERSION` — ADR-001 forbids reordering.

**The blocker this feature had to solve first: copies had no link home.** Characters denormalize —
`addFeatureFromDef`, `grantItemByName`, both `85-browse.js` `onAdd` handlers copy rules entries onto
the sheet. But rules `_id` is a positional counter reassigned by `reindexRules()` on every boot and
every import, `_source` was never copied onto the character, and `recomputeDups`/`dispName` exist
precisely because the same name can live in several packs. There was also no way to tell a
hand-edited copy from a pristine one. So a naive "re-sync by name" would have silently mis-matched
entries and destroyed player edits.

Fix: `stampSrc(copy,def,kind,cat)` records `{cat,pack,name,fp,cfp}` at copy time. **Two**
fingerprints, not one, and this is the subtle part — a copy is not field-identical to its def
(`browseItems` folds a meta line into `description`), so `fp` (the def at copy time) and `cfp` (the
copy at copy time) are each only ever compared against their own kind:

- current def fp ≠ `src.fp`  → the pack changed
- current copy fp ≠ `src.cfp` → **the player edited it** → shown, but never ticked by default

`grantFeatDef` needed a re-stamp: `addFeatureFromDef` only ever sees the synthesized
`{name:"Feat: X"}` wrapper, which carries no pack and the wrong name.

**Matching, honestly graded.** Stamped copies resolve by pack + name. Unstamped legacy copies have
only a name; where that hits one entry it is matched but marked `loose` (and therefore treated as
possibly-edited, unticked); where it hits several it is reported `ambiguous` and never actioned. We
would rather ask than guess. Embedded class/race/background traits have no top-level rules entry at
all, so `updTraitFromOrigin` re-resolves them through the copy's `origin` (kind/name/class/level/
subclass) into the live definition.

**Origins are never re-applied wholesale, on purpose.** `removeRace`/`removeClass`/
`removeBackground` do revert cleanly, so remove-then-add is tempting — but it replays every level
from 1 and destroys choices the app keeps **no replay record of**: ASI targets, skill picks,
subclass selection, background feat, the race ability spread. Those survive only as baked effects.
So the tool works per feature/spell/item, which covers the actual drift and touches none of it.
Class/race/background descriptions already re-resolve live by name through `ruleById`, so they need
no updating at all.

`UPD_FIELDS` is the allowlist of rules-owned fields. Everything absent from it is character-local
(`id`, `qty`, `equipped`, `prepared`, `uses.used`, `origin`, `grant`) and survives an update
untouched — asserted explicitly in the tests, since this is the promise most worth keeping.

**Backup before mutation.** `backupCharacter()` is `finishImport` minus the tail that switches the
active character — it writes a new keyed blob and a library entry and returns the new id, or `null`
if storage refuses. `commitUpdates` treats `null` as fatal and changes nothing: an update without a
backup is exactly what this feature promised not to do. Backups carry `isBackup:true` so they never
prompt for updates themselves.

Hooks: `loadCharById` after `renderAll()/hideHome()` (so the sheet is behind the prompt) and
`finishImport` last (so it stacks after the Replace/Copy clash modal, not under it). Boot autoload
is safe — `90-boot.js` restores the rules cache at :176 before autoloading at :183. Suppressed when
no packs are loaded, when `skipUpdate === APP_VERSION`, and for backups. Manual entry point in
Settings → This character, so dismissing is not a one-way door.

Tested: 86 Node checks — fingerprint stability/sensitivity, migrate never advancing the stamp,
changed/added/ambiguous/unmatched classification, edited-copy detection, character-local state
surviving apply, re-baselining so a row isn't offered twice, every gating rule, backup semantics
including the quota-refusal path, the boot-order regression, and the five regressions below.

#### Five bugs found by probing the finished tool — and why the tests missed them

The first suite built copies by hand (`copy.description = def.description`). **No copy site in the
app does that.** That single idealisation hid a whole class of bugs; the fixtures now construct
copies exactly as `browseItems`, `grantItemByName`, `browseSpells` and `grantFeatDef` do, and every
finding below has a permanent `R*` regression test.

1. **Every browse-added item was a permanent false positive, and "updating" it did damage.**
   `browseItems` folds a presentation line into `description` and converts `"2 gp"` to the number
   `2`. Comparing a copy against the raw entry therefore always differed — and applying stripped the
   meta line and wrote the string back, breaking `inventoryTotal()` for sub-gp costs. Root cause: a
   copy is not its def. Fixed with `updProject(def,kind,shape)` — the diff now compares against the
   *same transform the copy site applied*, with `src.shape` (`"browse"` / `"plain"`) recorded per
   copy, and `itemMetaLine()` hoisted out of the `browseItems` closure so there is one definition of
   the transform rather than two.
2. **Weapon updates left the derived attack stale** — item said `2d8`, the attack row still said
   `1d8`. `updResyncAttack()` rebuilds it, keeping the attack's id so collapse state survives.
3. **Multiclass lost same-named traits.** The missing-trait check keyed on a flat name Set, so a
   Fighter/Barbarian was never offered Barbarian's Extra Attack. Now keyed on origin + name, with a
   separate guard so an *untagged* legacy feature of the same name isn't duplicated.
4. **Silent cross-pack adoption.** If the pack a copy was stamped from was no longer loaded, a
   same-named entry from a different pack was matched and presented as confident — exactly the guess
   this design exists to refuse. Now returns `loose` + `otherPack`, is never ticked, and the row
   says which pack is missing.
5. **The background branch was dead code** — backgrounds carry a single `feature` object, not a
   `traits` array, so background content was never offered.

Also fixed while in there: the success message named the backup using `appVersion` *after*
`markCharChecked()` had advanced it (so it pointed at a file that didn't exist); `#mBody` gained a
new `change` listener on every review open; and `applyUpdates` re-ran `syncSpellAttack` over every
spell rather than the ones it touched.

Changing the fingerprint from one whole-object hash to a **per-field map** was what made the
per-field fix possible, and it bought something better than parity: an update now writes only the
fields the pack actually moved, so a player's typed cost override survives a description update
instead of being clobbered.

**Not verified here:** anything interactive — owner QA.

### Release automation (GitHub Actions)

`.github/workflows/release.yml` publishes on a `v*.*.*` tag push; `ci.yml` runs the mechanical
checks on every push and PR.

**Tag-triggered, not dispatch-triggered.** The alternative — a `workflow_dispatch` that runs
`./build.sh --release <level>` in CI — would have to commit the version bump and the rebuilt
`dist/fieldbook.html` back to `main` from a bot, and the changelog would go public before anyone
read it. Keeping the cut local leaves the version decision and the release wording where CLAUDE.md
already puts them (owner's call) and reduces CI to a publisher. `workflow_dispatch` is still wired,
but only to *re-publish an existing tag* after a failed upload.

**The guard that earns the workflow its keep:** after building from a clean checkout of the tag it
runs `git diff --exit-code -- dist/fieldbook.html`. Since the artifact is tracked, a clean rebuild
must reproduce it byte for byte — so every release is provably the thing the committed source
produces. It also asserts the tag equals `APP_VERSION` (tagging without cutting is the easy mistake)
and that `docs/CHANGELOG.md` is current.

**Tags, not release branches** — the owner asked about cutting a branch per release for rollback.
A tag is already immutable (it points at a content-addressed commit); a branch is a *mutable*
pointer, so a branch-per-release is both weaker for the stated purpose and permanent clutter.
Release branches earn their place only when an old line must be *maintained*, which is a decision
to make when it happens: `git switch -c release/1.2.x v1.2.1`.

No third-party actions beyond first-party `actions/checkout`/`setup-node`/`setup-python` — releases
are published with the runner's preinstalled `gh`, so there is nothing extra to pin or audit on the
path that ships code to players.

`scripts/release-notes.js <version>` slices one section out of the generated `docs/CHANGELOG.md`
(not the in-app array) so the release body and the shipped changelog are provably the same text; it
exits non-zero rather than publishing an empty body.

The zip allowlist verifier and `bundle-rules.js` both run in CI, so the "only the two full packs
ship in `data/`" rule is machine-checked on every push rather than only at release time.

### `src/tests/` and `./dev.sh`

**The suites were throwaway.** Every logic check written during the tables / data-reorg /
character-update work lived in a scratchpad and would have vanished with it; CI covered syntax,
JSON validity and staleness but no logic at all. They now live in `src/tests/` — under `src/`
because that is the audience boundary, which means `^src\/` in the zip's banned-pattern regex
already excludes them from the player bundle, while the source zip (`git ls-files`) includes them.

Safe because `validateOrder` (build-html.js) is invoked only for `src/js` and `src/css` and reads
them non-recursively, so `.js` under `src/tests/` is outside the unlisted-fragment guard. There is a
verification step for exactly this, since it is the one real hazard of the location.

`harness.js` removes ~25 lines of duplicated vm/DOM bootstrap per suite. It deliberately still
evaluates **the real concatenation in manifest order** — that *is* the boot-order TDZ guard, so it
must not become per-fragment `require`s.

**Counts corrected: 227, not 231.** The earlier figure came from `grep -c PASS`, which also matched
each suite's own `ALL PASSED` summary line — one phantom check per suite. The suites now print their
own totals and `run.sh` sums them, so the number can't drift from reality again. Per suite:
converter 65, tables 45, rules-data 32, char-update 85.

Verified the runner actually fails: breaking `fpNorm`'s whitespace collapse turned char-update red
and exited 1. A green runner that cannot go red is worth nothing.

**`./dev.sh`** is a menu, not a build system — every item shells out to `build.sh` / `scripts/*` and
prints the command first, so there is one implementation of each task and the menu teaches the CLI
rather than hiding it. Bash 3.2 only (macOS still ships 3.2.57): no associative arrays, no
`mapfile`, no `${v,,}`. Git Bash on Windows works because `.gitattributes` already pins `eol=lf`;
browser-open picks `open`/`start`/`xdg-open` off `uname -s`, and the converter item checks for both
python and `_conversion-data/` before offering itself. If stdin isn't a TTY it prints the menu and
exits 0 rather than looping forever on `read` — otherwise a stray `./dev.sh` would hang a CI job.

### `--no-zip` and `+dev` zip naming

`./build.sh` always built the zips — plain builds included — so a dev build produced
`fieldbook-v1.2.1.zip` whose contents were *not* v1.2.1. Harmless on your own disk, genuinely
misleading the moment you hand it to a playtester. Two additions:

- **`--no-zip`** stops after the artifact, the rules packs and all validation. It also skips the
  `rm -f dist/*.zip` wipe, so it can't destroy a zip you meant to keep.
- **`+dev` suffix** when a *non-release* build has pending notes in `UNRELEASED.md`. Semver build
  metadata, deliberately: `1.2.1+dev` means "1.2.1 plus extra", whereas `-dev` would denote a
  *pre*-release of 1.2.1 — the opposite of the truth.

The condition is "no `--release` **and** pending > 0", not merely "no `--release`". That matters
beyond taste: the release workflow runs a plain `./build.sh` at the tag, where `release.js` has
already emptied the notebook, so it still gets plain filenames and its asset check passes.

Consequence handled: a tag carrying pending notes would now produce `+dev` zips and fail the asset
check with a confusing "missing asset" message. Since such a tag is broken anyway — the bullets are
absent from the changelog, so the release notes would be incomplete — the workflow's pending-notes
step was promoted from a warning to an explicit early failure that names the real cause and prints
the offending bullets.

A shared `finish()` helper prints the closing line and the notebook nudge, so the `--no-zip` early
exit doesn't duplicate them, and the notebook is counted once and reused for both the naming
decision and that nudge.

### Humblewood: verbatim core prose + 19 tables (condensed 2024 doc only)

**The core prose was a paraphrase, and it had lost content.** Measured before the change:
`verbatim: 0 / 45`, longest verbatim run typically 15-30%. Not drift — wholesale rewriting. It had
also silently dropped a dozen traits, including every species' Lineage trait. Whoever built the
original data condensed by hand and lost things doing it.

Fixed to **130/134 verbatim**. The four exceptions are ours, not the book's — see "kept" below.

`scripts/extract-humblewood.py` is DEV-ONLY: it needs pdfplumber/pymupdf from `.venv`, so it stays
out of the stdlib-only `convert.py` that ships. Its *output* is what gets committed.

**Style is structure in this PDF**, which is what made it tractable: `P22Aragon` 36 = entity title,
`AGaramondPro-Bold` 14 = section, `AGaramondPro-BoldItalic` 10 = trait run-in name,
`AGaramondPro-Regular` 14 = narrative subsection (skipped, per the like-for-like rule).

Six extraction problems, each fixed structurally rather than by heuristic:

1. **Small-caps headings arrive letter-split.** "LEVEL 3: BONUS PROFICIENCIES" is six alternating
   12pt/8.4pt fragments. Both bbox top AND bottom shift with font size, so neither groups them;
   `origin_y` (the text baseline) is identical across all six (118.40) and does.
2. **Table rows landed in prose** — table cells are body-styled. `table_at` now reports the band it
   consumed and prose skips it.
3. **Drop caps** — Luma's title extracts as "uma". Matching headings against EXPECTED names fixed it
   and also rejected a pull-quote posing as a fourth background.
4. **Subraces are styled identically to narrative sections** (both Regular 14pt). Resolved by
   matching against the subrace names already in races.json.
5. **Background features were captured then wiped** by the following "Suggested Characteristics"
   heading.
6. **Page furniture** — the running footer, and separately the bare page number, which is set in the
   BODY face so only its position gives it away (always the bottom 35pt). Woodwise ended
   "...by magical means. 38".

**Two source defects, corrected explicitly rather than propagated:**

- `HEAD_ERRATA` — p35 prints "LEVEL 3: NIGHT DOMAIN SPELLS" **twice**; the second sits above the
  Ward of Shadows text. Taken literally it overwrote the real spells feature. Any *undocumented*
  repeated heading is now a hard error, not a silent overwrite.
- `TEXT_ERRATA` — p15 prints "**Stig** Lineage. There are two main lineages of **Srig**". Verified at
  5x zoom: the book's typo, not ours. Applied inside `normalise()` so the verbatim check sees the
  same corrected text on both sides and stays meaningful.

**Merge preserves structure.** Only `description` / `feature.description` / `traits[].description`
are replaced; `abilityScores`, `skills`, `equipmentGrants`, `effects`, `feat`, `levels` structure and
the rest are ours and untouched — same split as the character-update tool. Playtest content
(Gadgeteer, Deep Roots, 44 spells, 6 races, 3 feats) verified byte-identical to HEAD.

Result: **113 reworded, 11 added, 1 renamed, 4 kept.**

- *renamed*: Huden Gallus had "One With the Land" AND "One With the Wood", identical text — the
  source renamed it and both survived. `RENAMED` map drops ours.
- *kept*: Raptor "Size & Speed", Mistral Raptor "Diving Strike", Hedge "Burrow", Mapach "Climber" —
  real content absent from the condensed doc, so almost certainly playtest. **Owner's call: keep**;
  dropping rules someone may be using is the harder error to undo. Confirm each in the playtest pass.

**Tables: 19** (was 23). The four subclass "Features" tables were dropped — they duplicate
`subclasses.json` `levels` and carry the source's un-renumbered 2014 levels (the table says
1st/2nd/6th while the headings on the same page say LEVEL 3/6/17). Every spec must now declare
`rows`; a spec without one is unverifiable, which is exactly how four broken tables passed as "no
problems". De-hyphenation added (103 line-break hyphens, all syllable breaks).

**Cross-linking** is owner-based plus two inline anchors. The source names a table in three places;
two land in fields we hold (`[Table: Community Domain Spells]`, `[Table: Night Domain Spells]`) and
are rewritten in place so the sentence still reads as printed. The Bandit Specialty reference sits in
a narrative section the like-for-like rule skips, and the other three references are unnamed ("roll
on the table below") — inserting a name there would be editorialising. Owner chips cover all of them;
`tableChipsHTML` is now wired into all four entity views (race, background, class, subclass).

#### Two measurement bugs — a green check is not proof

Twice the *checker* was wrong and would have sent me fixing correct code:

- it built its reference with plain `get_text()`, interleaving the two columns, so anything crossing
  a column break looked non-verbatim (9 cases), and it left page furniture and table rows in the
  reference (12 more). The reference must be assembled exactly as the extractor reads the page.
- the page-number bug was **invisible to it**: both sides contained "38", so they agreed. Only
  reading the rendered output against the page caught it.

`src/tests/humblewood-verbatim.py` locks this in (129 checks). It SKIPS cleanly when the PDF or
`.venv` is absent, so CI stays green without them: 227 checks in CI, 356 locally.

`run.sh` now **always** rebundles — it previously only rebuilt when `dist/*_full.json` was missing,
so a stale bundle silently passed the round-trip test after `data/` gained the tables category.

---

## Humblewood playtest survey → `src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md`

Catalogued all 27 playtest PDFs (23 unique documents; 4 exact-duplicate pairs) ahead of extracting
them. Documentation only — no code or data changed. The map is dev-only under `src/`, so the
existing `^src\/` rule in build.sh's allowlist check keeps it out of the player zip with no change
to the build.

**The playtest data has the same paraphrase defect the core prose did, and worse.** Measured field
by field against the packet PDFs: **27 of 172 prose fields verbatim (16%)**. Spells are **0/44** and
are not merely reworded but *summarised* — the paraphrases run to a median **72% of the real
length**, worst 44% (Cymatic Sight 295 ch vs 667; Mind Marble 873 vs 1800), with two that had text
*added* instead. Gadgeteer is 1/27, Engineer and Fizzar 0/7 each. Ten descriptions also carry an
invented `(Humblewood 2 Playtest.)` suffix that appears in no source. So "we already have it" does
not mean done, and the map records three states — verbatim / paraphrased / absent — rather than two.

*(This entry first read "median 59% of source, worst 31%, Entomb 372 ch vs 1208". That measured
against a crude PDF slice which swallowed each spell's stat block and ran into the next spell's
heading — Entomb's real body is 460 ch. The figures above compare the old text to the verbatim text
that replaced it. The 0/44 verbatim count was never affected.)*

**Fizzar → Gadgeteer.** March 2024 shipped Fizzar as a standalone class with its own technology
system; November 2024 reissued it as "The Gadgeteer Class 2.1" with Fizzar demoted to a Path.
Word counts in Nov 2024: Fizzar 7, Engineer 2, **Scroungecrafter 0** — the March specialization was
dropped outright, along with technology tiers, schematics, the workbook and the Fizzcraft Kit.
**March 2024 is excluded from extraction**; taking it verbatim would add a dead class. Our
`classes.json` already follows Nov 2024.

Other supersessions worth not rediscovering: Mustel is **one** race across Sep 2024 + Feb 2025
(Brightfang, Longdance, then Webpaw); Marshfoot Gallus / Arma Hedge / Rockburrow Jerbeen are
lineages on **core** species and each packet reprints the shared core traits, so a careless merge
would overwrite verbatim core prose with paraphrased reprints; Nov 2024 p3 reprints Seeta as a
recap; Spectral Stampede is printed in both Jul 2024 and Aug 2024.

Two source defects in Spells Vol 2: it prints **"Etheral Claws"** (we hold *Ethereal Claws*) and
indexes **"Hearth"** for *Hearth & Home*. Neither is a missing spell — Vol 2 is complete by name.

Two extraction traps recorded for the next pass: **Jan 2025 (Pexian)** sets trait names in plain
bold, not bold-italic, so they classify as `label` and vanish from a normal run; and **Spells Vol 2**
is a Times New Roman document from a different template that needs its own parser.

#### A third measurement bug — same lesson as the last two

The first two passes at the verbatim measurement both reported clean-looking numbers that were
wrong, for the same reason as the earlier checker bugs: the checker didn't look where the data was.

- Walking only `description` **silently skipped all 44 spells**, which store prose in `text`.
- Assuming `levels` is a list skipped every class and subclass feature — `levels` is
  `{"1": {"traits": [...]}}`. That hid 88 of 172 fields and made the defect look half its real size
  (the first figure was "25/84").

Use a shape-agnostic recursive walker collecting every `description`/`text` in the subtree. A
measurement that finds fewer problems than expected is a reason to check the measurement.

---

## Humblewood playtests extracted — 23 packets folded in

`scripts/extract-humblewood.py` gained a playtest mode: a `PACKETS` registry plus `--playtests`
(preview, writes nothing) and `--write-playtests`. The core-book path is untouched and its 129/133
suite still passes; core race prose and traits are byte-identical to before (checked explicitly).

**What landed.** Races 16 → **26**, lineages 21 → **35**, backgrounds 3 → **10**, subclasses 5 →
**11**, tables 19 → **35**. Prose across every Humblewood file is now **450/472 verbatim**, up from
27/172 on the playtest content; the extractor self-checks at **350/350** before writing.

**Mechanics are derived, not invented.** `speed`, `languages` and `abilityChoice` come from the
stat rows; anything unparseable is reported rather than guessed. Lunin states no speed anywhere in
its packet, so `speed=30` is declared on its spec where it can be seen, not silently defaulted.

**Declare-what-you-expect, everywhere.** Extending the table specs' `rows` rule: every race spec
declares its trait count, every subclass its feature list. That is what makes the boundaries
tractable — neither a heading nor a title reliably ends an entity in these packets.

**Six layout facts that each broke a first attempt**, all now handled:

- **Drop caps.** Absent from the core book, present in every packet. A drop cap is its own span in
  the display face, so it classified as a `title` (ending the entity being parsed) and, being three
  lines tall, sorted by baseline into the *middle* of its own paragraph. Every description was
  losing its first letter. `dropcap_repair()` reattaches it to the line it visually starts.
- **Full-width headings** are cut in half by the column clip, so "New Background: Ambassador"
  arrives as two fragments a whole column apart — and the second repeats the drop-cap letter, so
  rejoining needs a one-character overlap allowance.
- **Trait lists resume across a foreign section.** Roden's traits run ASI/Speed/Age, then "Lurker's
  Landing", then Size/Bite/... An intervening heading or title now suspends collection rather than
  ending it; the declared count is what makes that safe.
- **Roll tables shred into the prose.** They are full width, so their rows land between the columns.
  A background feature had grown to 1750 characters ending "...I bleed tree sap." A bare `d6`/`d8`
  label now marks a table start; for backgrounds it *suspends*, because Ambassador, Underscout and
  Courtier keep their Feature block on the far side of the table.
- **Italic cross-reference callouts** ("Humblewood Campaign Setting") are set in the same
  bold-italic as run-in trait names and were landing at the top of trait lists.
- **One unbolded run-in**: the publisher failed to bold Pexian's "Ability Score Increases.", so it
  arrived as body text. Named on the spec rather than pattern-guessed.

**Spells Vol 2 has its own reader.** Times New Roman, single column, 12pt bold headings — the shared
style classifier reads its spell names as body text. A line set *entirely* in bold is a name; a
run-in like "Cut. You can make a surgical cut..." mixes bold with regular and is body. Two source
defects handled like `TEXT_ERRATA`: it prints "Etheral Claws" (we hold *Ethereal Claws*) and a
"d4 Effect" table header in name styling.

**Deferred, with reasons:**

- **10 spells have no source we hold** — Ambush Prey, Elevated Sight, Feathered Reach, Globe of
  Twilight, Gust Barrier, Invoke the Amaranthine, Shape Plants, Spiny Shield, Stellar Bodies, Veil
  of Dusk. Humblewood Vol 1 content; the condensed doc lists some in domain spell tables but prints
  no descriptions. Their text is untouched. This one needs a PDF we do not have.
- **Sep 2024's 12 characteristic tables** (Stonesinger, Warrenborn, Wonderstruck). Those three
  backgrounds share pages in a layout the table reader does not handle — stacked *and* side by side,
  headings interleaving once columns are flattened. 6 of 12 came back malformed, so all 12 are
  dropped: it is four tables per background or none, since a Flaw table with no Ideal table reads as
  "the book has no Ideals". The other four backgrounds' 16 tables are in.
- **March 2024 (Fizzar) is excluded on purpose** — superseded in full by Nov 2024. Do not add it.

#### A table can be the right size and still be the wrong pixels

Row counts are not sufficient. Two characteristic tables came back with exactly six rows numbered
1–6 and were still wrong, having absorbed words from the column beside them ("...rural bumpkin,
d10 Experience so I judge"). The builder now also requires the die faces to read 1..n in order and
rejects any cell carrying text bled in from a neighbour. Same lesson as the earlier checker bugs:
a clean-looking count is not proof, and the only way to know is to read the output.

`src/tests/humblewood-verbatim.py` now derives its playtest exclusions from `eh.PACKETS` instead of
a hardcoded pair, so adding a packet can never silently turn the core suite red.

---

## Character update tool — select all/none, and the backup dead end

**Select all / Select none** on the review list, with a live "n of m selected" count. Shown only
when there is more than one actionable row, and they skip disabled rows — unmatched and ambiguous
entries can't be applied at all, so "select all" must not appear to tick them.

**The backup could dead-end the whole feature.** `backupCharacter()` wrapped everything in one
`try/catch` returning `null`, so every failure — quota, a blocked origin, an unserialisable
character — surfaced as the same "your browser wouldn't save" modal, with no way to proceed and no
clue which it was. It now returns `{id, copy}` or `{error, copy}`, where `error` is a phrase a
player can act on and `copy` is the snapshot, so the caller can offer it as a **download** instead
of refusing. The guarantee ("never update without a backup first") is kept; the dead end is gone.

**It could also report success when the backup was invisible.** `libSave()` swallows its own quota
error, so the character blob could land in storage while the index write was dropped — leaving a
backup that exists but never appears on the home screen, right after we told the player to go and
look for it there. The index write is now verified by reading it back, and a dropped write removes
the orphaned blob rather than leaving it to consume the storage that was already short.

Likely trigger, unconfirmed without a browser: the rules cache is a single localStorage key holding
every loaded pack. `5e2024_full.json` alone is 1.1 MB of JSON, and browsers store strings as UTF-16,
so the cache can occupy ~2.7 MB of a typical 5 MB origin quota before any characters exist. The new
modal names Settings → Rules data → Clear all as the way to free the most space.

Five new checks in `src/tests/char-update.js` (85 → 90), including one that blocks the index write
specifically to prove the read-back catches it.

#### Coins: inline +/- entry, and an Adjust transaction

Both forms, because each covers the other's weakness.

**Inline.** `coinEntry(cur, raw)` in `65-resources.js` is the whole feature: `"+10"` adds, `"-5"`
spends, a plain number sets, empty clears, and **anything else returns null** so the caller puts the
old value back. Rejecting rather than coercing is the important part — reading a slip like `"1 2"`
as 12 would quietly rewrite someone's gold. Floors at zero; you can't owe copper.

Three wiring consequences:

- The boxes **dropped `data-path`**. That handler writes on every keystroke, so it would store `"+"`
  the instant it was typed and lose the number being added to. They commit on `change` (blur or
  Enter) via a `data-coin` handler instead. `renderCoins()` already rebuilt them from the model, so
  nothing else needed to change.
- `type="text" inputmode="tel"`, not `number`. `type=number` rejects a leading `+` outright (the
  HTML valid-floating-point grammar has no `+`), and iOS's `inputmode="numeric"` keypad has no sign
  keys at all — the telephone pad does.
- An on-screen hint under the row, because an input that silently understands `+10` is otherwise
  undiscoverable.

**Adjust** (`openCoinAdjust`) handles "that costs 2gp 5sp" as one action: an amount per
denomination, a preview of the resulting totals, and the whole transaction is planned before any of
it is applied, so a shortfall in one coin can't leave the others half-spent. Apply is disabled while
the entry is invalid or would overdraw, and the message says which coin is short. It reuses the
update tool's `#mBody` guard — that node outlives the modal, so the delegated listener is installed
once rather than on every open.

28 checks in a new `src/tests/sheet.js` (registered in `run.sh`), for pure sheet functions. Total
247 → 275.

#### Level-1 max HP seeded from the hit die

`seedLevel1HP()` in `56-class.js`: adding a class when the result is **one class at total level 1**
sets `hp.max` (and `hp.cur`) to `hitDieMax(def)` — d8 → 8. There is no roll and no choice at level
1, so the number is deterministic. `hp.max` is a plain player-entered figure with effects summed on
top and **no automatic CON**, so the die maximum is the whole value; nothing else needed changing.

Three constraints it respects, each with a test:

- **Only over a blank.** A number the player typed is theirs and is never overwritten.
- **Not on multiclass, not above level 1** — those levels give a rolled or averaged amount that is
  the player's call, so the seed is limited to the one case with a single right answer.
- **Clean revert**, matching how the other class grants behave: `removeClass()` clears `hp.max`
  again *only if it still equals the number that was seeded*, so swapping a d10 class for a d6 one
  at level 1 doesn't silently keep 10 — while an edited value survives untouched.

15 checks (90 → 105).

---

## Pre-release sanity pass

Three audits over the whole repo before cutting the first release since v1.2.1. Two real defects,
one release-blocking discovery, and a lot of doc drift.

#### The release would have failed, silently

`release.yml` checks out the **tag** into a clean runner, so anything untracked is simply absent.
Fourteen paths were untracked, including `.github/` itself — and because GitHub loads workflow files
from the pushed ref, a tag with no `release.yml` queues **no run at all**: no release, no error,
nothing in Actions. Every other blocker fails loudly; that one doesn't.

Proved rather than argued, by exporting the two file sets and building each:

- `git ls-files --cached` → 60 files → dies immediately on `FRAGMENT ORDER DRIFT in src/css`.
- tracked + untracked-not-ignored → 83 files → builds clean, correct pack counts.

Worse than the loud failures was the quiet one: `bundle-rules.js` treats a missing system directory
as a *successful skip*, so an untracked `data/5e2024/races.json` would have shipped a pack with no
`races` key at all — an empty species picker, while the changelog announced "All ten".

`RELEASING.md` §1 documented `git commit -am`, which stages tracked modifications only and therefore
**cannot** pick up a new fragment, data file or workflow. The documented happy path was the cause.
It now opens with a `git status --porcelain` gate and uses `git add -A`.

#### Two defects in shipped data, both from the playtest table work

- **16 of 35 Humblewood tables rendered headerless.** `build_pt_tables()` emitted `columns`; the
  schema and `86-tables.js` both read `cols`. The JSON looks perfectly correct either way, which is
  the whole problem.
- **`_region` shipped** on 19 tables — the extractor's page-band marker, meaningless to players. It
  has to exist in memory (`write_prose()` uses it to keep table rows out of prose), so it is now
  stripped at the write boundary, along with any other underscore-prefixed key.

Neither was visible to any test. `src/tests/tables.js` now asserts, for both systems: every table
has a non-empty `cols`, no underscore keys ship, every row matches its column count, names are
unique, and every table declares an owner.

#### Doc claims are now assertions, not prose

The counts in CLAUDE.md had been wrong for a while (19/6 fragments when there were 21/7; "227 checks
across four suites" when there were six) because prose has no compiler. New `src/tests/docs.js`
(36 checks) asserts fragment counts against `manifest.json`, suite counts against `run.sh`, that
every suite file on disk is registered, that no doc names a pre-reorganisation data filename, and
that `build.sh` and README §9 agree about the zip. It caught its own addition — adding the suite made
CLAUDE.md's "six" wrong and the suite went red.

It also guards the two changelog traps found here: `UNRELEASED.md` bullets are copied **verbatim**
into the GitHub release body, where `<name>` is parsed as an HTML tag and vanishes, and a hard-coded
`v1.2.1` goes stale on the next bump. Both existed; both are now impossible to reintroduce silently.

#### Packaging

- **LICENSE now ships.** The app is MIT and the zip didn't contain its licence.
- **The docs guard is an allowlist.** It listed dev-doc names to *ban*, which leaves a hole the size
  of the next doc written — `HUMBLEWOOD-PLAYTESTS.md` was not on the list and would have shipped if
  it ever landed in `docs/`. Now only CHANGELOG, README-converter and rules-schema may be there.
  Verified both ways: a clean build produces an 11-file bundle; planting a dev doc in `docs/` deletes
  the zip.
- `.gitignore` gained `.claude/` (previously ignored only by Mike's global config, so on any other
  clone it rode into the source zip) and the scratch patterns are root-anchored.
- CI compiles `scripts/*.py`, not just `convert.py` — the 108 KB extractor was never syntax-checked.
- **`release.yml` now runs the tests.** `ci.yml` triggers only on pushes to `main`, so a tag skipped
  every check except reproducibility — which proves the artifact matches the source, not that the
  source works.
- `convert.py` writes a trailing newline; the ten 5e2024 data files it had produced violated the
  repo's own `.editorconfig`.

#### Renamed one fragment, and declined to rename another

`72-charupdate.js` → **`72-char-update.js`**: every other multi-word fragment hyphenates, and its
test is `char-update.js`, so the pair didn't grep as a unit.

The audit also proposed `50-classrace.js` → `50-rules-lookup.js`, calling it a pure lookup layer.
**Rejected** — it also owns `renderClassRace()` and all the shared grant machinery
(`applyEquipGrants`, `revertEquipmentGrants`, `grantFeatDef`, `addFeatureFromDef`). The proposed name
described it less accurately than the current one.

Tests 287 → **323** across seven suites.

---

## Source zip removed — GitHub already provides one

`./build.sh` emitted `fieldbook-v<V>-source.zip` from `git ls-files --cached --others
--exclude-standard`, and `release.yml` attached it. Both are gone.

GitHub attaches **Source code (zip)** and **(tar.gz)** to every release automatically, built from the
tag. `.gitattributes` sets no `export-ignore`, so that archive is the tracked files at the tag — and
on a clean runner checkout our zip was built from exactly the same 84 files. It was a byte-for-byte
duplicate of an asset we get for free.

It was also **the only asset that differed between a local build and the runner's**: ours swept in
untracked-but-not-ignored files, so a locally built `-source.zip` and the published one could carry
different contents under an identical name, with nothing verifying either. The earlier pre-release
audit flagged that as a should-fix; deleting the thing resolves it rather than papering over it.

Releases now carry 4 of our assets (`fieldbook.html`, the player zip, the two rules packs) plus
GitHub's 2 automatic archives. For a local snapshot: `git archive HEAD -o snapshot.zip`.

Knock-on: `release.yml`'s `fetch-depth: 0` was justified in a comment by "the source zip is built
from `git ls-files`", which is no longer true. The two remaining git users — `build-html.js`'s
clobber guard (`git show HEAD:…`) and the reproducibility `git diff` — both work at depth 1, so full
history is no longer required. Left in place (seconds on a repo this size, and the pipeline had just
gone green) with the comment corrected to say so.

---

## Dev docs split by reader: `src/docs/_claude/`

`src/docs/` mixed two audiences. Split so a human opening the folder sees only what is theirs:

| Stays in `src/docs/` (Mike's) | Moved to `src/docs/_claude/` (agent context) |
|---|---|
| `UNRELEASED.md` — he writes the bullets | `WIRING-LEDGER.md` — working memory, read at the start of a task |
| `RELEASING.md` — he follows it to publish | `HUMBLEWOOD-PLAYTESTS.md` — extraction reference |
| `ADR-001-source-split.md` | |

**ADR-001 deliberately stayed.** It is a decision record, not working notes: it explains why the
`src/` split exists and is cross-referenced from CLAUDE.md rule 1 and from the build scripts. Any
future maintainer needs it, so it belongs with the human docs even though it is dense.

`git mv`, so history follows. Six references updated (`dev.sh`, CLAUDE.md ×2, the extractor ×2, and
one inside the ledger), plus a markdown link inside HUMBLEWOOD-PLAYTESTS.md that was a directory
level short after the move. No packaging risk either way: the zip guard's `^src\/` rule already
covers anything under `src/`, `_claude/` included.

---

## "Do I need the new data too?" — per-system dataVersion

Most releases change the app but not the rules packs, and re-importing packs is the tedious part.
Nothing told a player which kind of release they were looking at, so the safe assumption was always
"re-download everything".

**One source of truth.** `DATA_VERSIONS` in `src/js/30-version.js` records, per system, the release
in which that system's data last changed:

- `scripts/release.js` bumps a system **only if `git diff <last tag> -- data/<dir>` says it moved**,
  working tree included (that is what the release will contain). Prints which systems bumped, or
  "rules data unchanged — players need only the app".
- `scripts/bundle-rules.js` reads it — never duplicates it — and stamps each pack as `dataVersion`.
  A system with no `DATA_VERSIONS` entry fails the build rather than shipping unstamped.
- `mergeRules()` records the loaded pack's value per entry as `_dataVersion`, alongside the existing
  `_source`/`_rulebook` stamps, so it survives the localStorage cache and the remove-group filter
  for free. `dataStatus()` compares it and Settings → Rules data badges the pack.
- `release.yml` runs the same per-system diff and writes the answer into the release body.

**Per system, deliberately.** A global flag would tell a D&D-only player to re-import Humblewood
because Humblewood changed. The diff is per directory, so it costs nothing to be precise.

**Unknown is not stale.** A pack with no `dataVersion` — homebrew, or anything predating this — is
reported `unknown` and badged with nothing. A false alarm on someone's own content is worse than
silence. A pack *newer* than the build expects is also not flagged; the player is simply ahead.

Four release-note cases, each exercised before committing: first release (take everything), data
unchanged (app only, names the previous tag), one system changed, both changed. The first attempt
formatted the pack list with a clever `sed` that produced mismatched backticks — replaced with a
plain shell accumulator and tested, rather than trusted.

16 checks in `rules-data.js` (the three states, the badge, and that both shipped packs agree with
`DATA_VERSIONS`), plus wiring guards in `docs.js`: `DATA_VERSIONS` must be `JSON.parse`-able because
`bundle-rules.js` parses it, every value must be X.Y.Z, and every system must map to a data dir in
`release.js`. Tests 323 → 348.

---

## Done — item weight, encumbrance, and character size

Weight was already in the packs (98 of 99 mundane items, 271 of 528 magic ones) and already being
thrown away: `itemMetaLine()` folded it into the copied item's *description prose* and no numeric
field survived. This makes it a real per-item field, totals it, and hangs three rules variants off
the total. Character `size` had to come with it, because carrying capacity depends on it.

**New character fields, all scalars:** `size:""`, `encumbrance:"none"`, `coinWeight:true`. Scalars
mean `migrate()` needed no change at all — its allow-all-then-normalize pass carries them, and the
`blankChar()` defaults fill old saves. Only object/array fields have to join the normalize lists.

**`fnum()` (00-constants.js), next to `num()`.** `num()` is `parseInt`, which is right for counts
and scores and catastrophic for pounds and copper: an arrow weighs 0.05 lb and a candle costs
0.01 gp, and both became 0. Anything *measured* rather than *counted* now uses `fnum`. That also
fixed a live bug nobody had reported — a 1 sp item displayed "0 gp" and contributed nothing to
inventory value.

**The maths lives in 25-origins-items.js**, beside `costToGp`/`armorAC` — pure, DOM-free, testable.
`carriedWeight()` rounds to 2dp *before* anything compares it to a threshold: 20 arrows at 0.05 lb
is 1.0000000000000002 in binary floating point, which reads as "over" against a capacity of exactly
1. `encState(contribs)` is the single function every consumer reads; `encSpeed(base, st)` turns it
into a number.

### Design calls, and why

- **`itemMetaLine()` was NOT touched.** It is deliberately shared with `updProject()` — it is the
  *shape* a browse copy was made in. Changing it flips the description fingerprint of every
  browse-added item on every sheet, flagging them all as changed forever. `cost` already set the
  precedent: folded into the meta line *and* carried as a numeric field. Zero blast radius was
  available for free, so we took it. A test now pins the meta line's exact output.
- **Encumbrance is not an effect, and must not become one.** Effects are numeric-only and
  player-authored. A synthetic contribution would render as an editable fx chip, would need
  `abilFinal("str")` before `contributions()` had finished, and — decisively — cannot express two of
  the three outcomes: over capacity your speed *becomes* 5 (not −5), and Heavily Encumbered's
  disadvantage isn't a number at all. It is applied in `recompute()` after the effects, and the
  disadvantage stays prose in the breakdown modal.
- **Size is derived-with-override, not copied:** `character.size` → the ancestry's `size` →
  `"Medium"`. Also seeded on `applyRace` when empty, mirroring the speed seed, so it survives the
  pack being unloaded. A species offering `["Small","Medium"]` displays the choice and settles on
  the largest for the maths.
- **Capacity multipliers** are table-driven (`SIZE_CARRY`): Tiny ×½, Small/Medium ×1, Large and up
  ×2. RAW's ×4/×8 for Huge/Gargantuan is a two-value edit if a PC ever gets there.
- **Variant above capacity falls through to the standard hard limits.** Its tiers are `cap/3`,
  `2cap/3`, `cap`, then `cap*2` — all fractions of the same capacity, so the size multiplier applies
  the whole way up and no new constants exist.
- **Default is `"none"`.** `blankChar()`'s default *is* the default for every existing save. Shipping
  `"standard"` would drop a loot-hoarding character's speed to 5 ft on upgrade with no warning. Owner
  call, and a test pins it.
- **Nothing is ever blocked.** Past the hard limit the app says so; it never refuses to add an item.

### The one guard that matters

`updChangedFields` compared `now[f] !== then[f]`. A copy stamped before `weight` joined
`UPD_FIELDS.item` has no `weight` in `then` — so adding *any* field to `UPD_FIELDS` would have
flagged every previously-stamped item on every sheet at once. It now filters on
`then[f] !== undefined && now[f] !== then[f]`: no baseline is not "the pack changed it". Those fields
baseline on the next restamp. This makes every future field addition non-breaking, and it is
regression-tested (R6).

### Also fixed while in there

The item form rebuilds `rec` from scratch on save, so anything the form doesn't ask about was
silently discarded. `fav` (visible: your star vanished) and `src` (invisible and worse: the update
tool lost its provenance and fell back to the unstamped-legacy path) are now carried across.

### Converter and data

`_race_size()` maps 5e-tools' `T/S/M/L/H/G` to names, keeps a multi-size choice as a list, and drops
`V` (Varies) rather than guessing. Item weight needed **no** converter change — `convert_items` was
already emitting it. Verified by regenerating the whole of `data/5e2024/` and diffing: nine of ten
files reproduced byte-for-byte, and `races.json` differed only by 19 added lines of `size`.

**Deferred:** Humblewood species have no size in the PDFs, so they all read Medium. Jerbeen, Luma and
Hedge are genuinely Small in the book — fixing that means teaching `extract-humblewood.py`, which has
a verbatim suite, so the data must not be hand-edited.

Tests 348 → 453: 79 in `sheet.js` (fnum, formatting, per-item and coin weight, size resolution,
capacity, every tier boundary in both modes, speed, and the migrate round-trip including a
pre-feature save), 13 in `char-update.js` (weight as a rules-owned field, R6, the frozen meta line),
7 in `converter.py`, 6 data guards in `rules-data.js`.

---

## Done — granted equipment had no cost, and everything filed as Loot

Reported with a screenshot: a Wizard's starting kit showed weights but no gp, and Total value read
2 gp for a pack worth ~95. Only the browse-added Dagger had a price.

**Root cause:** `grantItemByName` (50-classrace.js) copied `description`/`effects`/`weight`/`weapon`
off the definition and **never read `def.cost`**. The tell is *why weight worked and cost didn't*:
**the pack stores weight as a number but cost as a display string** (`"2 gp"`, `"5 cp"`), and the
sheet stores a gp number. So weight copied straight across while cost needed `costToGp()` — which
only the browse path called. Copying it raw would have been worse than nothing: `fnum("1 gp")` is 0,
so the badge would vanish *and* the inventory total would be silently wrong.

**Why existing characters could be healed.** `updProject`'s `"plain"` branch did a blind
`p[f]=def[f]`, projecting cost as the raw pack string — a value no copy site ever writes. That is
why the update tool couldn't see the gap: projection-then and projection-now were both `"1 gp"`.
Parsing it there makes `then`(hash of `"1 gp"`) differ from `now`(hash of `1`), which raises a row
that `applyUpdateRow` fills in with the number. The R6 "no baseline is not a change" guard correctly
does *not* suppress it, because cost has always had a baseline.

The row's wording had to change with it: `fields.join(", ")+" changed"` is a lie when the copy never
had the field. It now reads "cost missing from this copy" when every flagged field is absent, and
keeps "changed" otherwise — both cases tested.

### The bug the new tests caught before it shipped

Copying `category`/`type` (the second half of the report — Robe and Spellbook filing as Loot) sent
them straight into `invSection`, whose alternations were **unanchored substrings**. `"Adventuring
Gear"` contains `ring`, so the fix as first written filed every rope and bedroll under **Magic
Items** — worse than the Loot it replaced. `\b` boundaries on the Consumables / Magic Items / Tools
alternations fix it, and incidentally stop `"Quarterstaff"` matching `staff`.

`invSection` had **no tests at all**, which is how the original mis-filing shipped; it has 18 now.
`grantItemByName` had none either — the char-update fixture `addGrantItem` mirrored the buggy shape
faithfully enough to hide the bug for a release, so the new tests call the **real function** and the
fixture was updated in lockstep.

`category`/`type` were deliberately **kept out of `UPD_FIELDS.item`**: they'd hit the
`then[f]===undefined` guard and be silently baselined rather than backfilled, buying nothing and
adding two fields to every item fingerprint. Consequence, stated in the release note: items already
on a sheet keep their filing; the Category dropdown in the item editor re-files them.

Tests 659 → 704. Verified in a browser against the built file by reproducing the report exactly —
import the 5e pack, add Wizard, take equipment option A: Total value 95.2 gp, and Robe / Scholar's
Pack / Spellbook under Gear.

---

## Done — section notes, the Notes tab, and icon tabs

A note on any section of the Sheet / Spells / Inventory tabs, plus Proficiencies on Story — 19 in
all. The eight Story bio cards are deliberately excluded: they are already free-text, and a note
attached to your Backstory box is a note about a note.

### The name collision, first, because it is the trap

**`character.notes` already existed** — one of the eight `BIO` strings, rendering the Story tab's
"Notes" card into `#rt-notes`. This feature is **`character.secNotes`**, and the tab is `#tab-notes`.
Merging or renaming either into the other breaks the Story tab silently. Recorded in CLAUDE.md's
invariants as well, because it will bite whoever comes next.

### Markdown on top of highlight(), and why that order is the safety argument

`highlight()` runs `esc()` first, so the **only** angle brackets in its output are the
`<span class="kw">` / `<span class="tblref">` tags it inserted itself. That makes `/<[^>]+>/g` an
**exact tag matcher, not a heuristic** — which is what licenses holding those tags aside while the
markdown regexes run over the rest. Anything the player typed is already inert text by then.

Both alternatives are worse: running markdown *before* the glossary pass lets a term like "strong"
match inside a `<strong>` we just wrote; running it *after* without protection lets a `*` inside a
`data-tbl` attribute get eaten.

Three further decisions worth keeping:

- **Indexed placeholders**, not the single repeating `TBL_MARK` idiom. This pass *nests* — a code
  span can swallow an already-held glossary chip — so ordinal restore-in-order doesn't hold.
- **One `highlight()` call per block, not per line.** `highlight()` rebuilds the glossary array,
  sorts every term and compiles a fresh RegExp on each call; the Notes tab can render nineteen notes
  at once, so per-line would be ~10³ regex compilations in one synchronous render. Lines inside a
  block join on a sentinel and become `<br>` after the inline pass — which also lets `**bold**` span
  a soft line break, the nicer outcome.
- **Sentinels are `String.fromCharCode(0xE001…)`, not literal characters.** The first draft embedded
  real private-use bytes; invisible bytes in source are one whitespace cleanup away from silently
  changing behaviour, and the build is byte-exact. (`\ue000` was already taken by `TBL_MARK`.)
  `noteHTML` also strips `\ue000-\ue00f` from its input, so a player typing one can't forge a
  placeholder — which incidentally hardens `highlight()`'s marker too.

Deliberately unsupported: markdown links (they point at a network, in an offline-first app, and read
confusingly beside `[Table: X]`), `_underscore_` emphasis (`snake_case`), nested lists, pipe tables.
**Known limitation:** `**Hit** Points` loses the *Hit Points* chip — the asterisks break `\b(term)\b`.
Inherent to escaping-then-matching.

### Structure

`NOTE_SECTIONS` is the single source of truth (id ≠ heading — headings get reworded, and a note
keyed to one would be orphaned); `data-note="k"` marks the card; a test asserts the two agree **both
ways**. `noteTitle()` special-cases `origin` because that heading is skin-dependent (Race vs
Ancestry) and a static title would make the Notes tab disagree with the card it links to.

- The icon **must be a `<button>`** and its hover preview **must be a `<span>` inside it** —
  `buildToc()` clones each `.label` and strips `button,svg,…` before reading text, so a sibling
  preview would leak into the ToC entry. Verified in the browser: the ToC still reads "Portrait",
  "Ancestry & Background".
- The preview is **escaped plain text**, not `noteHTML()`. A hover card full of tappable chips is a
  trap — you reach for the chip and the card vanishes — and interactive elements can't nest in a
  button.
- `selectTab()` was extracted **without** the `window.scrollTo({top:0})`; that stays in the tab
  click handler. Otherwise a note jump would fight its own tab switch. `scrollToCard()` came out of
  `buildToc` alongside it. `jumpToNote` guards `offsetParent===null`, because `#familiarCard` and
  `#activeSpellCard` are `display:none` until they have content.
- Everything that builds markup is a **pure string function** (`notesHTML`, `noteEntryHTML`,
  `noteBtnHTML`, `notePreview`), because the harness stubs the DOM — that moved group order, counts,
  collapse state, escaping and the empty state out of browser QA and into assertions.

### Icon tabs

Seven tabs don't fit a phone, so each carries a glyph and a word and CSS picks: icons under
`@media(max-width:860px)` or `html[data-tabs="icons"]`, the flag set in `applyTheme()` beside
`data-theme`/`data-rough`. Under 400px the bar scrolls — and `.tab-toc` has to become
`position:sticky;right:0`, because its `margin-left:auto` collapses to nothing in a scroll container
and the ☰ would scroll off the end. **No `<title>` in the tab SVGs**: `buildToc()` reads the button's
`textContent` for its heading.

The Inventory glyph started as a backpack and read as a *padlock* at 19px — the handle arc sat inside
the domed body. Swapped for a 3D box after seeing it rendered.

Tests 539 → 659. `tables.js` owns the markdown surface (it already owned `highlight`): escaping,
sentinel forgery, chips surviving emphasis, every block rule including `* * *` being a rule and not
a list, inert unmatched delimiters. `rules-data.js` owns the structure: registry ↔ template both
ways, title agreement, seven tabs ↔ seven panels, the storage guards against a hand-edited
`secNotes`, and the pure renderers.

Verified in a browser against the built file: a note using every markdown feature renders correctly,
the jump link lands on Vitals, the icon lights, the ToC is clean, icons appear at 390px, and the
Icon tabs setting survives a reload.

---

## Done — Tables tab was blank on load (root cause: renderAll never drew it)

Reported: load a rules pack with tables, reopen the app, go to Tables — nothing listed. Typing in
the filter box made them all appear.

That last detail is the whole diagnosis. The data was never the problem: `boot()` restores `rules`
from the localStorage cache *before* rendering. The Tables tab has exactly two call sites for
`renderTables()` — `refreshRulesUI()` (which runs when you import) and the filter box's `input`
listener. **`renderAll()` never called it.** So a session that imported tables saw them; a session
that merely *loaded* them from cache did not, until a keystroke in the filter forced a render.

`renderTables()` was the ONLY member of `refreshRulesUI()` missing from `renderAll()`. The glossary
is the exact analogue — rules-derived, own tab, own search box with an identical listener — and
`renderGloss()` was in `renderAll()`, which is why the Rules tab always worked and this one didn't.
Long-standing: `git log -S renderTables -- src/js/65-resources.js` returns nothing, so it was never
there.

Fix is one call. The test is the interesting part: rather than pinning `renderTables` by name, it
asserts the **invariant** — every renderer `refreshRulesUI()` calls must also be called by
`renderAll()`. If a surface needs redrawing when the rules pool changes, it needs drawing when the
app starts with a pool already in place. That catches this bug and the next one of its shape.
Written first, watched it fail naming `["renderTables"]`, then fixed.

Side benefit: with `renderTables()` running on load, a character with no tables now gets the tab's
empty state and its "Import rules files" button. Before, `#tablesList` was untouched markup — a
blank tab with no way in.

Reproduced and re-verified in a browser against the built file, by the reported steps: import
`5e2024_full.json`, hard refresh, reopen the character, Tables tab — 100 tables listed with no
keystroke. Tests 537 → 539.

---

## Done — Vitals restructure: signed HP entry, death row, Rest & Recovery

Reported from a screenshot: Inspiration had a full-width box for something used a few times a
campaign, the death row was a label plus two unrelated clusters of circles, Hit Dice was listed
**twice** in two different cards, and rests were crammed inside the Hit Points box.

Vitals now holds five stats (AC / Initiative / Speed, then Size / Passive Perc.) plus HP. Rests and
everything hit-dice moved to a new **Rest & Recovery** card below it. Inspiration is a star in the
Vitals `.label` row. Death row is `○○○ – ☠ – ○○○`, centred under the +/− buttons.

**No `migrate()` or `blankChar()` change.** `hp.{cur,max,temp}` keep their `number | ""` types;
`death`, `hdUsed`, `hdManual`, `inspiration` untouched. Presentation and input handling only — every
saved character round-trips unchanged. Recorded here so it isn't re-audited later.

### The interesting decisions

- **`coinEntry` → `signedEntry`.** The parser was never coin-specific. Body unchanged, contract
  unchanged (`number | "" | null`), so all 30 coin assertions carry over untouched by asserting
  through a local alias.
- **The ceiling did NOT go in the parser.** Adding a `max` argument was the obvious move and it is
  wrong: coins have no max, so the parameter would be optional and the contract conditional; and the
  bound must equally hold for the +/− buttons, spending a hit die, a long rest, and lowering Max
  below Current. It lives in **`clampHP()`** — model-only, no DOM, therefore testable — which every
  HP-changing path now ends in. One rule, one place.
- **`data-path` had to come off the HP inputs.** That handler commits on *every keystroke*, so
  typing `-3` stores `"-3"` at the first character. It is exactly the failure the coin comment has
  documented since coins were built. Also `type="number"` sanitizes a leading `+` to empty, so the
  boxes are `type="text" inputmode="tel"` like coins (`tel`, because the iOS numeric pad has no sign
  keys). Consequence: they leave `renderAll()`'s `[data-path]` loop, so **`renderHP()` had to join
  `renderCoins()` there** — that is the character-load path, and missing it would leave the boxes
  blank over a correct model, with the first blur then writing `""` over real HP.
- **Eight `[data-path="character.hp.*"]` querySelectors retired**, replaced by `renderHP()`.
  `syncHPInputs()` in 56-class.js is gone entirely. `effMaxHP(c)` took an optional arg, which
  retired the two hand-inlined copies of its expression in `longRest` and `rollHitDie`.
- **`renderHitDice()` was kept whole**, deliberately. Both halves now live in one card, which is the
  argument *for* not splitting it: the auto-mode `character.hitdice=hdString(pool)` write must run
  before the field renders and it feeds the pool, and no caller ever wants one half.
- The skull is written `&#9760;&#65038;` as **numeric entities**. U+FE0E (text presentation, so it
  renders as ink rather than a colour emoji) is an invisible byte a whitespace cleanup would eat, and
  the release gate requires a byte-exact rebuild.
- `.vitals>.vbox` is scoped to the grid: `.vbox` is reused for Level, Proficiency Bonus and Spell
  save DC, where a `grid-column` means nothing. Deleted `.vbox.span2`, `.vbox input` and `.inspire`
  (the last was already dead — `.vbox.span2` at 0,2,0 outranked it, which is why the earlier
  paragraph in this ledger about the 7-box layout is now stale).

### Two live bugs fixed on the way

- **`bumpHP` had no floor at zero** — holding the − button took you to −7 HP. `clampHP()` gives it
  the floor it never had.
- The item form's `rec` rebuild was already known to drop fields; separately, `bumpHP`'s
  `querySelector(...).value` was **unguarded** and would have thrown the moment the input moved.

### The hazard that shaped the code

`wire()` had **five consecutive unguarded** `getElementById(...).addEventListener(...)` —
`starBtn`, `hpPlus`, `hpMinus`, `btnLongRest`, `btnShortRest` — and all five are markup this change
moved. `wire()` has no try/catch, so one bad id throws and *every listener after it never binds*:
coins, HP, theme, settings, the home screen. The sheet renders and is inert, with nothing in the
console naming the cause. All five now go through a local `on(id,ev,fn)` helper, and the `starBtn`
lookup inside `recompute()` — the hottest function in the app, where an unguarded miss is a white
screen — is guarded too.

### Follow-up, same session: the two things that still read badly

- **Death saves were the wrong way round.** Failures now sit left, successes right, and — the part
  that matters — **both sets fill outward from the skull**: the left group is
  `flex-direction:row-reverse` so its first mark is its *rightmost* circle. Done in CSS keyed off
  the existing `data-kind="fail"` (previously decorative, now load-bearing) rather than having
  `buildDeath()` count backwards, so the click handler and `.on` toggling are untouched.
- **Hit Dice was mostly duplication.** In auto mode the text field was a read-only echo of the pool
  directly beneath it — the same dice written twice — so it is now **hidden unless you're in manual
  mode**, where it is the actual source of truth. The pill already focuses it on the way in.
  Rows became `d10 · pips · "2 of 3 left" · [Roll]`: the count in words removes the filled-means-spent
  ambiguity without changing the convention (which the spell slots share), and the bare 🎲 became a
  labelled button, since it rolls *and* heals and an emoji doesn't say that. Added an empty state —
  with no class and no manual entry the box used to be a greyed dashed field echoing nothing.

One test had to be loosened: the `.death` guard pinned success-before-failure via a positional
regex. It fired correctly on this change, but it was over-specified — it now asserts *containment*
(what the `.death .c` click delegation actually needs) plus a separate, deliberate assertion of the
new order and the row-reverse rule. Tests 535 → 537.

Verified in a browser against the built file: death row renders `○●● – ☠ – ●○○` with red left and
teal right, both filling from the centre; manual mode shows the field and two die rows; auto mode
with no class shows the empty state and no field.

Tests 510 → 535. `sheet.js` gained the `clampHP` bounds (including that `""` stays `""`, which
`removeClass` depends on), the effective-max ceiling, and signed entry composed as `applyHPInput`
composes it. `rules-data.js` gained template guards for everything here that fails silently: no HP
box carries `data-path`, all three have a `data-hp` hook and are `type="text"`, the death circles are
still inside `.death`, the skull keeps its text-presentation selector, there is exactly one
`starBtn` and it is in the Vitals label row, and Rest & Recovery owns both rests plus all three
hit-dice pieces. Verified they fail by reintroducing `data-path` and by stripping the variation
selector.

---

## Done — Size on the sheet, in Vitals

Size was only reachable through Settings, which is the wrong home for something that is now a real
stat. It sits in Vitals after Speed — the stat it interacts with, since encumbrance is what connects
them.

- Vitals is a 3-column grid that held exactly 6 boxes. A 7th would leave a hole, so Inspiration
  gained `.span2` and fills the trailing two columns. `.big.txt` drops the display font to 15px:
  "Gargantuan" at 26px does not fit a third of the row.
- **Tapping opens a picker, not a breakdown.** The other Vitals boxes tap through to
  `openStatBreakdown`, which explains a derived number. Size is a *choice*, so it gets a chooser
  (`openSizePicker` in 80-modal-forms.js) — matching the project's standing preference for a real
  chooser over a buried setting. Keyboard-operable, like the Settings headers.
- `sizeOptionsHTML()` is shared by the picker and Settings so the two option lists cannot drift, and
  `capacityFor(size, contribs)` was split out of `carryCapacity()` so the picker can **preview** what
  a size would let you carry before you commit to it. `carryCapacity()` is now just
  `capacityFor(charSize(), …)`.
- `recompute()` marks the box `fx-on` when the size was set by hand rather than taken from the
  ancestry — the same "this isn't the default" signal the other boxes use.
- Added to the print sheet's vitals line; it is a sheet stat now.

**The id-wiring check went app-wide.** The settings-only version was already there; a trial run over
`fieldbook.template.html` plus every `src/js` fragment found 311 declared ids and 286 looked up, with
**zero** violations — so it is enforceable as a standing assertion rather than a one-off. Ids built
by concatenation (`"mod-"+k`) don't match the pattern and are left alone. Verified it fails by
renaming `sizeDisp` in the template: it named both the id and the file that would have broken.
Tests 498 → 510.

---

## Done — Settings split into collapsible sections

The modal had grown a control at a time into one long scroll. Now four groups:
**Appearance** (skin, mode, hand-drawn borders), **This character** (size, encumbrance, coin weight,
the rules-update check), **Rules data** (sources + loaded data), **Characters & backup** (the library
button, export/import settings). The character group renders only when one is open.

Reused `.fgroup`/`.fghead`/`.fgname`/`.fcaret` from the feature list rather than inventing a second
collapsible — the app should not have two things that look like a section header. CSS in
`50-modal.css` only adapts it for a modal: the header is `position:sticky` inside the scrolling body,
and the last group drops its trailing margin.

- **State is stored as COLLAPSE, not "open"** (`settings.setCollapse`, keyed by section id). An
  absent key means "never touched", so `SET_SECTIONS`' first-run defaults can be changed later
  without reopening a section someone deliberately shut. `setSecOpen()` also defends against a
  non-object — settings come from a file a user can hand-edit.
- **Defaults:** Appearance and This character open; Rules data and Backup shut. Rules data is the
  longest block and the least often touched, so its header carries the entry count — "did my rules
  load?" stays answerable while it is folded away. The character group's badge is the character's
  name, since those settings are per-character and that is the thing worth confirming.
- **Toggling does not re-render the modal.** It flips `display` and the caret class in place, so
  every listener, input value and the scroll position survive. Re-rendering would have meant
  re-attaching everything.
- **The delegated listener binds to `#setSections`, not `#mBody`.** `#mBody` outlives every modal, so
  a listener on it would stack one copy per visit — which is why the rest of this file binds to
  elements inside the body that get replaced each time. Same trap, worth not falling into.
- Headers are `role="button" tabindex="0"` with Enter/Space handling and `aria-expanded`. The
  feature-list headers this borrows from are mouse-only; no reason to repeat that here.

The real risk in this refactor was silent: moving markup between template literals renames or drops
an id, the handler's `getElementById` returns null, and the control just stops working with no error
anywhere. So `rules-data.js` now parses `openSettings()`'s own source and asserts **both** directions
— every id it looks up exists in the markup it builds, and every id it renders is wired to something
(bar a short inert list of render targets). Verified it fails by breaking an id deliberately: both
checks fired, naming the id in each direction. 33 checks added, tests 465 → 498.

---

## Done — the update pill replaces the version button

Reported as "the notification sits awkwardly to the right with the current version where it should
be". Cause: `.verbtn` carries `margin-right:auto`, so *everything after it* — including
`#updatePill` — was pushed to the far end of the top bar. The pill was never mispositioned; it was
downstream of the spacer.

Fixed by making it one control rather than two. They say the same thing (which build you're looking
at), so `showUpdatePill()` hides `#btnVer` and the pill inherits the same `margin-right:auto`, landing
exactly where the version was. The version you're *on* moves into the tooltip
("Update to version X available — you're on Y") and stays in the changelog's title, so it is never
lost, which was the owner's condition.

The consequence that needed handling: `openChangelog` was reachable **only** from `#btnVer`, so
hiding it would have stranded "What's new". The pill therefore opens the changelog rather than
linking straight to GitHub, and the changelog leads with a download banner while an update is
pending. `updateAvailable` (a module-level `let` in 30-version.js) is what both read.

`#updatePill` became a `<button>` — it no longer navigates, and an `<a>` with a live `href` that
`preventDefault`s is a lie about what it does.

7 checks in `char-update.js` over `updBannerHTML()`, which was split out of `openChangelog` precisely
so it could be asserted: present/absent, both version numbers, the link, and that a release tag is
escaped rather than injected as markup. Tests 458 → 465.

---

---

## Deferred — needs the source book

### Cervan "Surge of Vigor" — frequency unknown
Extracted prose ends with "(see book)" and gives no explicit per-rest limit, so no `uses` tracker
can be assigned yet. Resolve when the Humblewood 1 core race page is on hand.

---

## Xanathar's + Tasha's as supplement packs (`data/xanathars`, `data/tashas`)

Two new systems, `XGE` and `TCE`, converted from the same 5e-tools dump. **Supplements, not games**:
a character is never created "in" them. Counts — XGE 22 keywords · 43 items · 15 feats · 95 spells ·
31 subclasses · 22 features · 74 tables. TCE 3 · 84 · 15 · 1 race · 21 spells · 26 subclasses ·
76 features · 37 tables.

**`convert.py` was XPHB in twelve string literals and five filters.** Now a `Book` carries the
source codes, the `system` stamp, per-stem pack names, `_note` and `excludeSystems`; `pick_sources`
dispatches to the untouched `pick_2024_preferred` when no codes are given, and `_pack` builds the
header in the original key order. **The default Book reproduces `data/5e2024/` byte for byte** —
checked before the refactor (the converter already was reproducible), after it, and again at the
end. That equality is the gate: if the 5e2024 folder moves, `release.js` bumps XPHB's data version
and every player is told to re-download 1.1 MB that didn't change.

**Four things looked right and were wrong.** All four were found by measuring, not by reading:

1. **`_copy` stubs.** 5e-tools ships every XGE/TCE subclass twice: 122 records, 61 real. The plan
   said "dedupe by (className, name), prefer the newer classSource". That is backwards — the
   duplicate IS the newer one, a `_copy` stub, and **35 of 57 carry no `subclassFeatures` at all**.
   Preferring it would have shipped 26 subclasses of 61, each with `"levels": {}` — right-looking
   JSON, correct entry count in the build log, no features. The filter is `'_copy' not in sc`.
2. **Spell class tags.** `sources.json` files a 2014 book's spells under `classVariant`, not
   `class`, and under PHB/TCE sources. The existing reader gave **XGE 0 of 95 tags**: a complete
   pack whose "only my class" filter hides everything in it. Widened, gated on the book so the 2024
   run cannot move. Now 95/95 and 21/21, all naming 2024 classes.
3. **`subclassesFor()` clobbered by name.** The map key is what `character.classes[].subclass`
   stores, and the 2024 PHB reprinted **seven** XGE/TCE subclasses (Gloom Stalker, Fey Wanderer,
   Soulknife, Psi Warrior, Oath of Glory, Path of the Zealot, College of Glamour). Loading a
   supplement would have silently swapped every existing 2024 character's subclass for the 2014
   one. Now a same-named entry from a different pack is offered *beside* it as `Gloom Stalker (XGE)`;
   same-pack re-import still replaces, so updating a pack still works.
4. **Table names are a global lookup.** `findTable` matches on name and `[Table: …]` anchors carry
   no pack, so eight names the 2024 PHB reuses would have opened the wrong table.
   `--avoid-table-names data/5e2024/tables.json` suffixes just those eight; the anchors follow for
   free because `_register` returns the final name and `flatten()` uses exactly that. Asserted:
   zero cross-pack collisions, zero dangling anchors.

**`excludeSystems`** (schema §1) is the mechanism for the species filter, chosen over extending
`systemOf()`: a pack whose `system` the app can't place says who it is **not** for. Stamped per
entry by `mergeRules`, honoured in `racesForCharacter` only — `findRaceDef` stays unfiltered, same
rule as `systemOf`. `bundle-rules.js` had to learn it too: the bundle is built from a fixed key
list, so without that the per-category files would filter and the file players actually import
would not.

**Not shipped, deliberately:** the Artificer. It is **already in `data/5e2024/classes.json`,
stamped `XPHB`** — `convert_classes`' `cls[0]` fallback picks up its TCE printing (same for the UA
Mystic). Owner's call: leave the mislabel alone rather than move `data/5e2024/` and make everyone
re-download; Tasha's therefore skips the Artificer class *and* its four subclasses (`--skip-classes`)
rather than shipping duplicates beside them. **Known issue: Artificer and Mystic are 2014/UA content
labelled XPHB.** Fixing it means dropping both from the core pack, a data version bump, and anyone
playing an Artificer on the core pack alone losing the class unless they also import Tasha's.

Book profiles (pack names, the 2014-era `_note`, the Artificer skip) live in `SUPPLEMENTS` in
`convert.py`, not in `dev.sh` — prose duplicated into a menu is how a re-run quietly stops
reproducing the committed packs. `dev.sh` now offers core / XGE / TCE / all three.

Also out of scope: XGE's 11 encounter tables, 12 traps and 8 name tables (bespoke 5e-tools shapes
needing their own parsers, for DM content the sheet cannot act on), and the 3 TCE sidekick classes
(`hd: null`, already skipped by the existing guard).

851 checks green across 7 suites, including the four count tables, "no empty category", "every
subclass has ≥1 trait", "feature names unique", and the cross-pack table-name and anchor checks.
**Not verified here:** anything interactive — owner QA.

---

## Homebrew pack + missing-dependency reporting

A fifth pack, `data/homebrew/` (`system: "Homebrew"`), and the machinery it forced into the open.

**The bug was already shipping.** `subclassesFor()` guards on the parent class def being truthy, so
a subclass whose class isn't loaded returns `{}` from the whole standalone loop. Humblewood's 11
subclasses, Xanathar's 31 and Tasha's 26 all attach to `data/5e2024/classes.json`. Load any of them
alone and the subclasses merge, Settings counts them as loaded, and they are unreachable — while the
picker says *"This class has no subclasses in the loaded rules"*, which is **false**. No warning at
import, none at boot. Every other unresolved reference in the app degrades just as quietly (a
missing feat becomes an empty feature named `Feat: X`; a missing granted item becomes a bare name).

**Two detectors, because one can't cover it.**

- **Structural** — `subclasses[].class` is a field the app actually resolves, so a missing parent is
  detectable with **no authoring at all**. This is what catches homebrew nobody annotated, and it is
  why the other three packs needed no data change: their `dataVersion` doesn't move and nobody is
  told to re-download.
- **Declared** (`requires`, schema §1) — for what the schema can't model. `levels[].spells` is prose
  (`{note}`), so a subclass's expanded spell list names its spells **only inside sentences**.
  Scanning prose would invent as many references as it found. The Predator's 13 spells are exactly
  this case: 11 from XPHB, **Cause Fear and Primal Savagery from XGE**.

`requires` groups by providing pack and carries a `file`, so the message is actionable — *"2 spells:
Cause Fear, Primal Savagery — import xanathars_full.json"* rather than just naming the absence.
Matching is case-insensitive and **pack-blind**: `pack`/`file` are documentation, not a constraint,
so having the spell from somewhere else is not an error. An unknown category key is ignored, so
adding a category later can never turn old packs red.

**Where the state lives, and why it's split.** `mergeRules` never runs at boot —
`90-boot.js:209-210` restores the merged pool from localStorage and rebuilds only the derived
structures. So the *declaration* is stored (`rules.requires`, keyed by source; `saveRulesCache()`
stringifies all of `rules`, so plain JSON persists free — `_dups` uses `Set`s and serialises to
`{}`, which is the trap to avoid) and the *verdict* is not: `missingRequirements()` is a pure
function of `rules`, called at render time. Nothing to persist, nothing to invalidate, and testable
in the vm harness, which cannot run `boot()`. `removeRulesGroup` prunes a source's declaration once
none of its entries remain.

**The chip reuses `.chip.bad`** — already the documented "this IS a problem" state, against
`--brick`, as opposed to `.chip.warn`'s deliberate "nothing is broken, just not newest". But
**colour alone cannot carry it**: in the Classic skin `--accent` and `--brick` are the same value,
so a red chip and the amber "update available" chip are identical there. Hence the `!` glyph, the
same trick as `.verbadge.old::after{content:"↑"}`. Tooltip is a plain `title=`, the app's only
tooltip mechanism outside the note preview. Tooltip lines group by category, so eight missing
classes read as one line rather than "(class)" eight times — and `CAT_ONE` spells the singulars out,
because `replace(/s$/,"")` turned "Classes" into "classe".

Two supporting fixes: `importRulesFiles`/`fetchAllRules` now add a one-line summary through
`updateRulesStatus`, and **`fetchAllRules` never called `renderRulesData()`** — pre-existing, and it
would have left the new chip stale after a URL fetch.

**The data is hand-authored, and stays that way.** Homebrew sources are PDFs, HTML and JSON; each
piece needs judgement about which features are traits vs invocations and what levels they land on.
The Predator came from a D&D Wiki page. Its 6 invocations and pact boon ship as `features` (the
XGE/TCE convention) — note the app cannot auto-attach those, `rules.features` is a manual picker
library, which is true of every invocation we ship. A throwaway generator built the three files only
so the `requires` block is byte-identical across them: `bundle-rules.js` compares them with
`JSON.stringify` and fails the build if they disagree, exactly as it does for `system` and
`excludeSystems`.

Verified end-to-end against the real bundles: homebrew + 5e2024 without Xanathar's names the two
spells and the file; all five packs is silent; humblewood alone and xanathars alone now report their
missing classes structurally. A test asserts every name in `requires` resolves against a shipped
pack, so the demo case can only ever be "not imported", never "misspelled".

**Not verified here:** anything interactive — owner QA. Especially the Classic-skin colour case.

### The rules cache outgrew localStorage — caught in play, fixed to IndexedDB

Reported the same day: import all five packs, reload, and only 5e2024 and Humblewood come back.

**The ledger called this shot** when there were two packs: *"the rules cache is a single localStorage
key holding every loaded pack… ~2.7 MB of a typical 5 MB origin quota before any characters exist."*
Adding XGE, TCE and Homebrew took it over.

**Measured, not assumed** (real browser, five packs merged): the pool serialises to **2,292,912
characters — 4.37 MiB as UTF-16**, against Chrome's 5 MiB per-origin cap, shared with characters,
library and settings. Quoting the *character* count is what made this look survivable. Only **1.2%**
is regenerable metadata (`_id`, `_dups`), so trimming was never going to save it.

**Two wrong turns worth recording, because both were tested rather than shipped.** First hypothesis
was quota, which I could not reproduce — Chromium at `http://127.0.0.1` swallowed 2.29M chars
happily. Second was the home-screen import path, which turns out to call the same
`importRulesFiles`. What settled it was proving the *read* side correct: writing all five, reloading,
and getting a status line identical to the reporter's first screenshot. Merge and boot restore are
fine; the **write** was the only failure point.

**Root cause:** `saveRulesCache(){try{localStorage.setItem(...)}catch(e){}}` — one key for the whole
pool, and an empty catch. A rejected write left the **previous** value in place, so the packs looked
loaded all session and the next boot faithfully restored the older set. Silent by construction.

**Fix.** The pool moved to **IndexedDB** (quota is a share of free disk, no dependencies, works from
`file://` offline). localStorage stays as the fallback for anything that refuses IDB and as the
migration source; the first successful IDB write **deletes the old key**, returning ~3 MB that was
also starving character autosave and the update-tool backups (`libSave` swallows its own quota error
— see above, same family of bug). Boot still reads localStorage synchronously so the first paint has
rules in hand, then `loadRulesCacheAsync()` hydrates the authoritative IDB copy over the top.

**And it can no longer fail quietly.** `saveRulesCache()` returns a promise resolving to an error
string; `rulesCacheError` renders as a red line above the loaded-data list, naming the size **in
bytes rather than characters** and saying what to do. Verified in a browser across all three paths:
IDB available (migrates, survives reload, five groups back); IDB refused (falls back to localStorage,
silent success); both refused (red line, pool still usable this session). The harness has no
`indexedDB`, so the existing suite exercises the fallback branch and its `quotaFull` switch reaches
the loud path — 10 new checks.

**Watch for:** the transient where a stale localStorage cache paints first and IDB replaces it a tick
later. It self-heals after the first save (the old key is removed) and only shows on the migrating
boot.

#### Follow-up: mobile, and the third way IndexedDB fails

Asked whether IndexedDB holds up on mobile. Android is Chromium — the engine already tested. **iOS is
the risk and could not be tested here** (no WebKit build on the machine, and the MCP browser refuses
`file://`): every iOS browser is WebKit, *including the Edge the README tells iPhone users to
install*, and WebKit has historically refused IndexedDB on `file://` origins. Rather than assert
either way, the unknown was made safe.

**The question found a real gap.** Absent and throwing both reject immediately, but a request that
**hangs** — never firing success or error — leaves the promise pending forever, so a failed save
goes unreported and the boot hydration never completes: the original bug, restored. That is exactly
how flaky WebKit misbehaves. `idbTimeout()` now bounds every IDB call at 4s. Verified with a stub
`indexedDB.open` that returns a request firing nothing: settles in 4003 ms and falls back.

**The localStorage fallback now compresses**, because the fallback existed but could not actually
hold the data — five packs is ~4.37 MiB against ~5 MiB, so "fall back to localStorage" was a
promise it could not keep. LZW over UTF-8 bytes, codes packed **15 bits per character offset by
32**: the output lands in [32, 32799], entirely below the surrogate range at 55296, so every unit is
a valid lone BMP character that survives a localStorage round trip. 16-bit packing emits lone
surrogates, which some browsers silently mangle — that would be data loss disguised as a fix.

Measured on the real bundles: **4.33 MiB → 0.83 MiB (19%)**, a 5.2x reduction, so all five packs fit
with room to spare even with no IndexedDB at all. Verified end-to-end with `indexedDB` set to
`undefined`: five packs saved compressed, reload, five groups back.

Only the fallback path compresses — IndexedDB has room and plain JSON there stays debuggable. The
stored value is tagged `LZ`; an untagged value is a plain-JSON cache from an older build and
still reads, and a corrupt payload returns `""` (treated as "nothing cached") rather than throwing
at boot.

Implementation notes worth keeping: the dictionary **stops growing** at 65536 rather than resetting —
a reset must be mirrored by a decoder whose dictionary lags one step, which is a classic off-by-one
that only shows on huge inputs. The decoder expands via `(prefix, byte)` pairs and a growable
`Uint8Array`, never `Array.concat`, because the output is megabytes on a phone. 22 new checks cover
the shapes that break naive LZW (the KwKwK case, every byte value, surrogate pairs, CJK) plus
deterministic fuzz and the real shipped pack.

**Still unverified:** iOS itself. If it turns out IndexedDB *is* available there, the compressed
fallback simply never runs.

---

## Done — CON in the level-1 HP seed, and damage that spends temp HP

Two bugs Mike caught in play: level-1 max HP ignored Constitution, and nothing in the app had ever
spent temporary HP — it was stored, rendered, cleared on a long rest and printed, and the player did
the subtraction by hand.

**`level1HP(d)` in `56-class.js` is the one formula**, `hitDieMax + modOf(con)`, because three sites
have to agree on it *to the number*: `seedLevel1HP()` writes it, `resyncLevel1HP()` re-writes it, and
`removeClass()` only un-seeds when the box still holds exactly it.

**CON is read with `modOf()`, not `abilFinal()`.** `contributions()` folds in equipped items, active
statuses and summoned familiars, so an effects-aware seed would be un-seedable minutes later —
un-equip a cloak between adding and removing a class and the clean revert stops firing *silently*.
Effects already have their own route into this number (the `hp.max` target), which is where a CON
buff that should raise HP belongs; baked into the base it would also be invisible to `maxNote` and
would never come back off. `rollHitDie()` keeps `abilFinal` and is right to — that value is consumed
in the instant it is computed and never re-derived. There is a comment on both saying so; don't
"harmonise" them.

**Floored at 1, not 0.** `effMaxHP()>0` is the "a maximum is set" sentinel in both `clampHP()` and
`longRest()`, so a computed 0 would quietly disable the Current-HP ceiling and make a long rest claim
no maximum was set. `level1HP()` also returns 0 to mean "no parseable die", so a real 0 would be
indistinguishable from the sentinel. It bites at `d4`+CON 1, and transiently every time someone types
a CON score digit by digit.

**`resyncLevel1HP(prevCon)` is not a nicety — without it, adding CON to the formula is a
regression.** Seed at CON 10, type CON 16, and `hp.max` no longer equals what `removeClass()`
recomputes, so the clean revert silently stops working and a d10's HP survives onto a d6 class. It
also closes the ordering hazard: pick the class before entering stats (the common order) and the seed
would otherwise be die+0 forever. Stateless — the boot `input` handler passes the *previous* score,
and the guard is "does the box still hold what we would have written then?", the same heuristic and
the same trade-off `removeClass` has always used. No new character field, no `blankChar` default, no
migrate surface: a pre-change sheet holds `die`, which is exactly what `modOf(10)` reproduces, so it
upgrades itself the first time CON is edited. It deliberately stops at level 2, where `hp.max` is a
rolled total the app never computed. Per-keystroke jitter is transient: each step recognises the
previous step's own number, and a character at full HP stays at full through the whole sequence.

**`adjustHP(delta)` in `65-resources.js` is now the one HP-delta path** — the − button, a typed
negative in the Current box, and a spent hit die all go through it. Damage soaks into `hp.temp`
first; healing never touches temp (temp HP is granted, not restored); exhausted temp reads back as
`""` rather than 0, matching what `longRest()` leaves behind. Model + clamp only, no DOM, the same
contract `clampHP()` has.

**It lives in `65-resources.js` because `harness.js` drops `90-boot.js` from the test bundle** —
logic in that fragment is untestable by construction, so 90-boot keeps the wiring and nothing else.
Its two call sites are covered by regex-on-source guards in `rules-data.js`, beside the existing
template guards, which is brittle but is the only coverage available there.

**Typed damage needed `signedDelta()`.** `signedEntry()` returns an *absolute* result and floors at
0, so the delta (and any overkill) is gone by the time `applyHPInput` sees it, and `min(temp,
damage)` needs the raw number. Rather than duplicate the digit grammar, it was lifted out of
`signedEntry` into `entryDigits()` and both now share it.

**Current AND Temp both read a negative as damage** — the second half of that was a follow-up from
play: `-5` against 3 temp used to floor the Temp box at 0 and throw the extra 2 away, leaving the
character two hit points better off than they should be. Both boxes now route the delta through
`adjustHP`, so a hit means the same thing whichever one you type it in, and the overflow spills.
`+7` in Temp is still a plain grant, and Max keeps plain-edit semantics because a negative there is
you *lowering your maximum*, not taking damage — `sheet.js` asserts that a `-20` in Max still drags
Current down without touching Temp.

**Needs a browser smoke-test:** add a class on a fresh character at CON 16 and check Max/Current;
add the class first, then type a CON score digit by digit and confirm the numbers track without
sticking on an intermediate value; type your own Max and confirm CON edits leave it alone; swap a d10
class for a d6 one at a non-default CON and confirm the old maximum does not survive; press − with
Temp set and confirm Temp drains before Current; type -5 into Current with Temp 2, and again into
Temp with Temp 3, and confirm the spill both ways; confirm + never touches Temp.

---

## Done — Max HP lock, Hit Dice under Hit Points, current-HP colour bands

Three changes to the same corner of the Sheet tab, all owner decisions. Recorded so they are not
re-litigated.

### A. `character.hp.locked`

**The new field lives INSIDE `hp`, and that is the whole migration story.** `migrate()` already does
`Object.assign({},blank.hp,s.hp)` over the structured keys, so every existing sheet gains
`locked:true` with no new code, and one that deliberately saved `locked:false` keeps it. Chosen over
a top-level `hpLocked` for exactly that. Tested both directions, plus the no-`hp`-at-all branch (a
separate code path) and a second round-trip.

**Two layers, the shape the auto spell-slot fields already use.** `renderHP()` sets `hpMax.readOnly`
and repaints the pill; `applyHPInput()` refuses `k==="max"` again and returns `false`. `readOnly` is
only a hint — paste, autofill and any programmatic caller walk straight past it, which is why
`90-boot.js`'s slot handler has always carried `if(slotsAuto)return` beside `65-resources.js`'s
`inp.readOnly=slotsAuto`. Read as `!==false`, never a truth test, so an object that never went
through `migrate()` is locked rather than silently editable.

**The automatic writers BYPASS the lock, on purpose.** `seedLevel1HP`, `resyncLevel1HP` and
`removeClass`'s un-seed all write `character.hp.max` directly and never went through the box. Routing
them through `applyHPInput` "for consistency" would leave a locked level-1 character with no hit
points at all. `char-update.js` asserts all three under a locked box; `rules-data.js` asserts
`56-class.js` names `hp.locked` exactly once.

**`doLevelUp()` clears the lock and calls `renderHP()` itself** — `recompute()` does not call it, and
a model that says unlocked while the DOM is still `readOnly` fails silently. Levelling is the one
moment Max HP legitimately changes and the app cannot compute the new value, so it hands the box
back. It stays open until the player closes it; re-locking mid-edit would be worse. `doLevelDown`
deliberately does nothing here.

**No confirm dialog**, unlike `[data-hdmode]`: switching to manual hit dice is a mode change with
consequences at level-up, while this is undone by a second tap.

**One latent bug fell out of it.** `applyHPInput` guarded with `!(k in character.hp)`, which `locked`
now satisfies — a `data-hp="locked"` hook could have written a boolean field. Now an explicit
`cur`/`max`/`temp` list, with a test.

**The pill is an inline SVG, not an emoji.** U+1F512 has no text-presentation variant, so the
`&#65038;` trick that keeps the death-save skull as ink does not exist for it and it would render as
a colour emoji. Both shackle paths ship in the template and CSS toggles them off `.hp-lock.open`, so
`renderHP()` only does `classList.toggle` — the same thing `renderHitDice()` does for
`.hd-mode.manual`. Icon-only, so the Max label stays narrower than the 66px input and the three HP
columns keep their widths.

### B. Hit Dice under Hit Points

From a reference screenshot: HIT POINTS over HIT DICE as one panel pair. The whole `.hd-box` moved
out of Rest & Recovery into Vitals, below the death saves, as a **sibling** of `.hpwrap` — nesting it
would put it inside the brick `::before` overlay and make one frame enclose both. HP box order is
unchanged (Current, Max, Temp — the screenshot's Max-first was deliberately not adopted, because
Current is the number that actually moves) and the death row is unchanged.

**Both cards survive**, because both are `data-note` anchors (`vitals` and `rest` in `NOTE_SECTIONS`).
Deleting Rest & Recovery would orphan any note pinned to it.

**The nesting is load-bearing.** `.hd-row{display:contents}` hands its four cells straight to
`.hd-grid`'s `repeat(4,max-content)`, which is the only reason a multiclass pool lines its
die/pips/count/Roll up across rows. Nothing new sits between `#hdWrap` and `.hd-grid` or inside it,
and `.hd-box>*{position:relative}` reaches only the three direct children. Guarded in CSS *and* in
`renderHitDice`'s source, because it breaks silently — and only on a multiclass sheet.

**`.hd-box` gave up its real border for `.hpwrap`'s inset `::before`.** The old comment said a real
border was fine because nothing nested inside needed lifting above an overlay — true, and beside the
point once the two boxes became neighbours. A real border takes no `filter`, so on the rough skin
`.hpwrap` wobbled and `.hd-box` did not; and a border sits outside the padding box while the inset
sits 1px inside, leaving the frames 1px out at the corners. Now 2.5px verdigris, matching `.hd-title`.

`.hp-title`/`.hd-title` share one rule with the colour split out; `.hd-mode`/`.hp-lock` share the
pill (its `margin-left` moved onto `.hp-lock`, or it would push the centred `.hd-head` off by 2px).
`<span class="n">Hit Dice</span>` came out of `.hd-head`, which made `.hd-head .n` dead CSS — deleted.

### B2. Three hit-dice looks, chosen per character

The moved panel still looked rough in play, so it was redesigned. Three options were built as live
variants in the real app and screenshotted for the owner to choose from; he took all three as a
setting rather than one.

`character.hdStyle` is `"full"` | `"condensed"` | `"dice"`, **defaulting to full** (owner's call — it
speaks the same language as the Vitals strip and the HP panel directly above it, and is the most
self-explanatory of the three; the cost is height, in a card that already carries the stat strip, HP
and the death row). **`hdStyle()` resolves anything unrecognised to the same value**, so an older
sheet with no field lands on exactly what a new character gets and the setting needs no migration of
its own. A test asserts the fallback and the `blankChar` default agree — split them and old sheets
silently render something new ones never would.

`renderHitDice()` now picks between `hdFullHTML` / `hdCondensedHTML` / `hdDiceHTML`, with `hdPips()`
shared by the first two. Condensed keeps `.hd-grid` + `.hd-row{display:contents}` — the multiclass
column alignment is unchanged and still guarded.

**The actual cause of "rough" was the auto/manual pill.** Alone on its own centred line it read as an
orphaned control and cost a whole row of the panel's height. It now rides on the `.hd-title` heading,
which is why that became a flex row. `.hd-head` keeps only the manual text field and is zero-height
in auto mode, the common case. `"3 of 5 left"` also became `"3/5"` (the long form is the `title`) —
the words cost a grid column in a 320px panel.

**In the dice style the token IS the control**, so the die size, the pip and the count stop saying the
same thing three times. Tapping an unspent die rolls and heals; tapping a spent one puts back exactly
**one** — deliberately *not* the pips' "click position i means i are spent" semantics. Pips are
positions on a track, so that reading is natural there; tokens are interchangeable, and tapping one
to get three back contradicts its own tooltip. (It was built the pip way first and caught in a live
click-through.) Putting a die back never un-heals you, matching what the pips have always done.

**Known limitation, deliberate:** the dice style has no way to mark a die spent *without* healing,
because tapping is the roll. Full and Condensed keep the pips for that, and the settings hint says so.

### C. Current-HP colour bands

`hpBand()` is pure and returns a class name: amber at or below 50%, brick at or below 25%. Measured
against `effMaxHP()`, so an item that raises your maximum moves the thresholds. **Temp is excluded** —
it sits above your maximum, and folding it in could read as healthy while the real pool is empty.
`effMaxHP()<=0` returns no band at all, so a blank new character does not open painted red.

**`--warn` is a new token rather than `--accent`.** On the classic skin `--accent` and `--brick` are
the same value (`#8f2318`), so reusing it would have made the two bands identical there. Defined in
all four palettes; a test asserts `--warn` appears as often as `--brick` so a future palette cannot
be added with one and not the other.

**`character.hpColor` follows `coinWeight` exactly** — top-level, default true, read as `!==false`,
with its switch in the Settings modal's "This character" section. Per character, as asked.

### The test guards had to be rebuilt

`rules-data.js`'s Vitals block sliced "from this literal to the next `<div class="card"`" and
"non-greedy to the first `</div>`". Both encoded the current *nesting* as well as the content, so
moving a block between cards broke them for reasons unrelated to what they guarded. Replaced with one
`block(html, needle)` helper that counts `<div>`/`</div>`. Every new guard was mutation-tested — the
thing it guards was reverted and the guard confirmed to fire — which caught one that only checked the
`.hd-title` CSS rule existed and not that the panel wore it.

**Needs a browser smoke-test:** the padlock in both states, all four skin/theme combinations, the
rough skin (both panels must wobble by the same amount), a multiclass pool's column alignment, the
three colour bands, and the narrow-phone width.

---

## Done — Familiars moved to the left sidebar

Familiars were the last card in the right column, below Vitals, Statuses, Attacks, Resources and
Features. You reach for a familiar mid-fight, so that was the wrong end of the page. The card and
`#addFamiliarLink` moved together into the left `.stack`, under Class — the three identity cards stay
grouped, and the card is `display:none` until it has content, so it costs nothing when empty.

**The card and the button are one control.** `renderFamiliars()` shows exactly one of them and looks
both up **unguarded**, so they move together and neither id may be renamed — a missing id throws
inside `wire()`, which has no try/catch, and takes out every listener registered after it. A guard
asserts they stay adjacent and that all three ids appear exactly once.

**`order` could not do the phone fix, and that is the interesting part.** At ≤820px the columns
collapse and the sidebar renders first, which would put familiars above HP and Skills. `order` only
reorders *siblings*, and inside `.stack` the card can never move past the other column's cards. So
the media query sets `.stack{display:contents}` — every card becomes a direct grid item of `.cols` —
and then one `order:1` sinks the pair below everything else. This is free rather than a refactor
because `.stack` carries exactly one rule and its `gap` is byte-identical to `.cols`'s, so nothing
moves. Both halves must stay INSIDE the query: `display:contents` at top level would destroy the
two-column desktop layout, and there is a guard for that.

**And the query MUST sit below the `.stack` rule it overrides.** Written above it — where the old
one-line query lived — `.stack{display:grid}` wins on source order at equal specificity and the
entire phone fix does nothing: no error, no warning, `display` just computes to `grid`. It was built
that way first and only the browser showed it; the guard asserting the rule *existed* passed happily.
A regex cannot see the cascade, so the test now asserts the ORDER of the two rules as well.

**The wrap fix needed `flex-basis:100%`, not just `flex-wrap`.** `.item .nm` is `flex:1 1 0` with
`min-width:0`, so it can shrink to nothing — which means flex always finds "room" on line one and
never wraps the controls down. The result was a name box 12px wide with 110px of text running
straight across the type beside it. Giving the name the whole first line is what actually wraps the
pill and icons. Also caught in the browser: the assertions all passed, because nothing overflowed the
*item* — only the name's own box.

**The 320px column needed the row to wrap.** ~266px inside an `.item`, and the Summoned pill, two
icon buttons and the gaps eat ~200px of it before the name is drawn; `.item .top` had no wrap and
`.qty` no `min-width:0`, so a real name plus a type like "Pseudodragon" pushed the row through the
item's own border. Fixed **scoped to `#familiarList`**, because Statuses uses the same `.item` markup
but still lives in the wide column where the single row is right. A guard asserts the scoping, since
an unscoped `.item .top{flex-wrap:wrap}` would silently restyle Statuses.

**A pre-existing bug the move exposed.** `buildToc()` listed every `.card > .label` with no
visibility filter, and `scrollToCard()` has no `offsetParent` guard — so the ☰ menu already showed
"Familiars & Companions" when the card was hidden, and picking it scrolled to a zero-height box.
Harmless-looking while it was last in the list; fourth from the top it would get hit. `buildToc` now
makes the same `offsetParent===null` check `jumpToNote()` has always made, so the two consumers agree.
This fixes `#activeSpellCard` for free.

**The test slicer now strips HTML comments first.** `block()` finds an element's extent by counting
`<div>`/`</div>`, and its comment used to claim safety "because no `<div` appears inside a comment" —
a condition kept true by hand. The comment written for this very move broke it within minutes
(it quoted the markup it was describing). Comments are stripped once, up front; the invariant is now
enforced rather than remembered.

---

## Done — "choose N" pickers actually enforce N

A Rogue's "choose 4 of 10" would grant all ten, and ticking none was equally accepted. There was **no
count validation anywhere in the app** — `Done` always closed and always committed whatever was
ticked.

**The root cause was smaller than the symptom: `choose` never reached the DOM.** `choiceFieldHTML`
rendered it into the label prose and dropped it, so by the time `gatherChoices()` read the boxes back
there was nothing to check against. The fix is mostly *carrying the number through* — it is now
`data-choose` on the `.choice` wrapper. That also happens to be the only place the target exists for
the race/background modal, which never populates `_activeChoices`; `choiceBlocks()` reads the DOM for
exactly that reason.

**`data-fixed`, not `checked`, drives the re-enable.** Both a granted option and one shut off by the
block being full are `disabled`; only the attribute separates them. Keying the unlock on `checked`
would hand a granted proficiency back as an editable box the first time someone unticked one of their
own picks. Only *unchecked* options are ever disabled, which is what keeps your own picks undoable.

**Granted options do not spend the budget, but they do cap it.** "Choose 2" with one already granted
still means two new picks. `effectiveChoose()` only lowers the target when there are not enough
options left to reach it — choose 2 of 3 with two granted asks for the one that remains, because
nagging forever for a second the player cannot make is worse than asking for what is possible.

**The dismiss guard could not live inside `closeModal()`.** Every Done handler calls that too, and
would have to answer its own prompt. `dismissModal()` sits in front of the three user-initiated
dismissals only; `openModal` clears the guard so an ordinary form's Escape stays instant cancel, and
a chained modal opening over the top resets cleanly. Without this, Escape — which discards every pick
with no way to reopen the chooser — would have been the easiest way past the new warning.

**Two pure helpers carry the logic** (`effectiveChoose`, `choiceShortfall`) because the harness stubs
`querySelectorAll` to `[]`. The bigger win: **`choiceFieldHTML` is itself pure** — it reads character
state but no DOM — so the emitted markup is asserted directly in `sheet.js` with no new
infrastructure. The live locking and the confirms are regex-guarded in `rules-data.js`, all six
mutation-tested.

The `option` type's checkbox branch got the same treatment. Every shipped `option` is `choose:1` and
renders as radios, so it is dead code today — but it was the identical uncapped bug waiting for the
first `choose:2`.

**Verified interactively** (the choosers had never had a browser run — the ledger used to say so):
locking at 4 of 10 and unlocking on untick, the under-picked confirm keeping picks on Cancel, a
pre-granted Perception that cannot be unticked and is not re-granted under the class sid, the
exhausted-pool heading asking for 1, Escape warning then discarding, an ordinary modal still closing
instantly, and the race path behaving identically.

---

## Done — the spell "prepared" box: centring, and saying what it is

Two things at once: the ✓ sat low and right inside its box, and nothing anywhere said what the box
meant.

**The centring had four causes, all from it being a `<button>`.** Measured in the browser rather than
guessed: computed `padding: 1px 6px` (UA default), `line-height: normal`, `font-family: Arial` — a
button inherits neither padding nor font — and `font-weight: 900`. With `box-sizing:border-box` on an
18px square, that padding leaves a **2px-wide content box**, and `place-items:center` dutifully
centred the glyph on *that* rather than on the button. Arial then supplied a ✓ with different metrics
from anything else on the sheet, and 900 has no real face in the sheet's fonts so it was
synthetically emboldened — which widens to the right, re-adding the offset.

Fixed with `padding:0` + `background:transparent` (what `.hd-b`, `.dot` and `.slot .b` all already
set), `line-height:1` (the house fix, as on `.death .dskull`), an explicit `font-family`, and weight
700. Verified by screenshotting the rows at 4× zoom before and after — a computed-style check alone
would not have shown the glyph's ink position.

**`.equip .box` had the same defect** and is the same tick, used for Equipped, Concentration and the
spell modal's own Prepared control. Fixing one and not the other would have left the row pin and the
modal box visibly different. It is a `<span>` so it does inherit the font, but it still had no
`line-height`.

**What the box means: `prepared`, and it is a marker only.** `castSpell()` never consults it,
`pickSlotLevel` never consults it, and the `x/y` pill in each level header is `added/allotment` —
nothing to do with it. It had `aria-label="Prepared"` and no visible text, no `title`, no
`aria-pressed`, so on a phone there was no way to find out. Now: a `Prep` caption at the head of each
level group (the idiom the hit-dice and feature-use pip rows already use, whose CSS comment says the
words are what "stop filled being ambiguous"), plus `aria-pressed` and a title that says what a tap
will do.

Not changed: the print sheet still emits `◆`/`○` for prepared with no key — same gap as before, and
the same one the skills/saves rows have.

---

## Done — favourites on Features & Traits

A mirror of the inventory star rather than a second idiom: tap it and the feature **moves** to a
pinned `★ Favorites` group (not copied — the origin groups are built from non-favourites only, the
same partition `renderInventory` does).

**Most of it came for free, and that is the point of mirroring.** `.fav` in `10-chrome.css` is a
generic class with no `.item`/`.inv` scoping, so a feature star inherits it with no new CSS.
`migrate()` copies arrays wholesale, so a per-feature `fav` survives save/load with no migration.
`featCollapse.groups` is keyed by label string, so `"★ Favorites"` is a collapse key alongside `Elf`
and `Fighter` — exactly how `invCollapse.sections` holds the same string. And `fav` is absent from
`UPD_FIELDS.feature`, so `applyUpdateRow` never writes it and `updEdited` never mistakes it for a
player edit.

**`featGroups(list)` was extracted as a pure function.** `renderFeatures` writes through `innerHTML`
on an element the harness stubs, so none of the grouping was reachable by a test. Pulling the
partition, ordering and sort out means the interesting half is asserted directly, and `featItemHTML`
turned out to be pure already (it reads character state but no DOM), so the star markup is assertable
too. Inventory keeps its partition inline — the two behave identically but differ in shape; worth
knowing before assuming they share code.

**Sorting differs from the rest of the list, on purpose.** The Favourites group sorts by name,
matching inventory's Favorites section. The origin groups keep grant order, which for a class is
level order — that is existing behaviour and was left alone.

**A pre-existing bug fixed on the way.** `openFeatureForm`'s save rebuilds the record from the form,
so it dropped everything the form does not ask about. `fav` would have been the third casualty:
`origin` and `src` were already being lost, meaning an edited class feature jumped to the "Other"
group and stopped being recognised by the rules-update tool. All three are now carried across, the
same guard the item form has had since the identical bug was fixed there (changelog, `30-version.js`).
There is a source guard per field, because each fails differently and all three fail silently.

**Known limitation:** a favourited **granted** feature loses its star if the grant is rebuilt —
changing subclass, removing a class or swapping ancestry runs `removeFeaturesWhere` and re-adds via
`addFeatureFromDef`, which creates a new object with a new id. Inventory does not have this because
`grantItemByName` matches and reuses the existing item. Levelling up is safe: it only *adds*
features. Left as-is because in most of those paths the feature genuinely changes.

Also unlike inventory: `buildToc` collects `.inv-sec-head` but not `.fghead`, so the feature
Favourites group does not appear in the ☰ menu. Adding it would put every feature group in there.

**Verified interactively:** starring moves the row and drops the origin group's count, unstarring
returns it, two stars sort by name, the group collapse persists, a feature's own collapsed body
survives the hop between groups (it is keyed by id), Use still works from the Favourites group, and
an edit keeps star, origin and pack link.

---

## Done — spell browser: per-level counts, and the Add button that was off-screen

### The overflow, which was not a near-miss

The Add button was laid out **past the right edge of the viewport**, and `.browse` is
`position:fixed;inset:0` with no scroll container — so there was no way to reach it at all. Three
things combined:

1. `#brOrigin` carried an inline `flex:0 0 auto`;
2. `flex-basis:auto` resolves from the item's `width`, and the global
   `input,select,textarea{width:100%}` sets that to 100% **of the footer**;
3. `flex-shrink:0` meant it could never give any of it back.

So the select claimed the entire row and everything after it was pushed out. Fixed on
`.browse-foot` rather than in the spell config, because the item browser shares that footer and was
worse (it has a cost input too). `width:auto` on `.br-origin` is the actual fix — `flex-wrap` alone
would just have given every screen size a full-width select with the button beneath it. The inline
styles moved to classes; leaving them inline is what hid the bug in the first place.

Deliberately **not** patched with `overflow-x:hidden` on `.browse`: that hides a recurrence instead
of preventing one. A guard asserts the global `width:100%` rule still exists, because the fix is an
override and is meaningless without it.

### The count

**`spellLevelTally(lv)` is now the single source** for both the Spells tab heading and the browser's,
so the number you see while picking is the number you get. `renderSpells` was refactored onto it
rather than keeping its own copy of the arithmetic.

**Two new generic hooks on `openBrowse`** — `cfg.groupKey` (stamped as `data-brg`) and
`cfg.groupBadge(key, chosen)`. `cfg.group` returns a string that gets `esc()`'d, so a count cannot be
smuggled through it, and it would be stale anyway.

**The badges repaint from `foot()`, not by re-rendering.** The row handler deliberately updates the
clicked row in place and calls `foot()`; re-rendering would discard the scroll position and redraw
400+ rows on every tap. `paintGroupBadges()` touches only the headings, which keeps that property.

**Three things the projection has to respect**, all verified in the browser: a spell already on the
sheet is skipped by `onAdd` so it adds nothing; the origin dropdown applies to the whole batch, and a
Feat/Background origin lands the picks as `granted`, which never counts — so changing the dropdown
repaints; and `allot===0` means "no allotment known", which shows a bare number, or no badge at all
when there is also nothing known (a level with no slots stays clean rather than reading "0").

**Verified:** at 360px the Add button is fully on screen with no horizontal overflow, on both the
spell and item browsers, while a desktop width still lays the footer out as one row. 3/4 → 4/4 → 5/4
red as two cantrips are ticked; a duplicate does not move it; origin=Feat drops it back to 3/4; and
after adding, the Spells tab shows exactly what the browser predicted.

**One test lesson worth keeping:** the first guard for "the tab uses the shared tally" was vacuous —
`/function renderSpells\(\)\{[\s\S]*?spellLevelTally\(lv\)/` ran straight past `renderSpells` and
matched `browseSpells`' call instead, so it passed with the mutation applied. Slice the function body
first, then assert inside it.

---

## Done — Gadgeteer prose keeps the shape the PDF gives it

The Frames (3,300 chars) and Components (5,600 chars) traits read as unbroken paragraphs. **The
layout information was in the PDF the whole time and the extractor was throwing it away**:
`classify()` already tags "Autonomous Frame" as `head`, "Remote Control." as `trait`, "Scrap Cost:"
as `label` and the tagline as `prereq`, and `pt_all_subs` appended all of them as flat text.
`flush()` folds `" *\n *"` to a newline, so emitting `\n` and `**` markers there survives the join —
the same mechanism the `\n• ` bullets have always used. Nothing is reworded; a test strips the markup
and compares.

**The fix had to be in the extractor, not the data.** `set_prose` rewrites descriptions wholesale
with no preserve check, and the November 2024 PDF is in the repo — a hand edit would have been
reverted on the next run and logged only as "reworded".

**A blank line goes BEFORE a type name, not after it.** First attempt put it between the name and its
tagline, which separated the wrong things; it now separates one frame from the last.

### The extractor was not idempotent, and that had to be fixed first

Running it unchanged rewrote the **Mustel** species description with **Webpaw** lineage text. Cause:
`PACKETS` runs newest-first and `fresh()` is first-writer-wins — which is right for the shared traits
a lineage packet reprints, but the Feb 2025 "Mustel, Webpaw" packet also reached
`take(cur,"description")` and claimed the species intro that belongs to the Sep 2024 packet. The
creation path was never involved: `by_race` is built from the existing data, so Mustel already
existed.

Fixed with a `no_description` spec flag on that one packet — narrower than `merge_into_core`, which
would also have stopped its traits merging. **The verification is a zero diff**: the extractor now
reproduces the committed data exactly, which is what makes any future re-extraction safe. Anyone who
had run `--write-playtests` before this would have silently shipped Webpaw text as the species intro.

**Keep the idempotency check as the first step of any extractor work.** Run it unchanged, confirm
`git diff data/` is empty, and only then change anything — otherwise a formatting change arrives
mixed with unrelated churn.

### descHTML: highlight() plus **bold**, and nothing else

`highlight()` escapes and supports no markup. `descHTML` adds one `**…**` → `<strong>` pass, holding
highlight's own chips aside first — the ordering is the security argument lifted from `noteInline`:
`esc()` having eaten every user `<` is what makes `/<[^>]+>/g` an exact tag matcher rather than a
heuristic.

**Bold only, deliberately not `noteInline` itself.** Its single-asterisk emphasis rule would pair up
the unpaired footnote markers already in the Humblewood data ("divert power\*", "cymatic sight\*",
"Spells marked with an asterisk (\*)") and italicise everything between them. There are tests using
those exact strings.

Used at the two surfaces Gadgeteer prose reaches — the features card and the class/subclass info
panes. Items, spells and familiars keep `highlight()`; no shipped pack uses `**` there.

**Sentinels are written as `"\ue00a"` escapes, not literal characters.** A first pass put the real
private-use bytes in the source, which is exactly the invisible-byte hazard `.editorconfig` and the
byte-exact build exist to guard against. There is a test asserting the escape form.

### Extending it — and the trap that nearly came with it

Asked whether the Gadgeteer fix should apply to every Humblewood extract, the answer turned out to be
**mostly no, with one real exception**. Worth recording because the intuition is reasonable and the
evidence is not obvious:

**`parse_entity` does not have the problem.** It treats a `trait` span as STRUCTURE — each run-in
heading becomes its own named trait with its own body — and `head`/`title` end the entity. That is
exactly why races, feats, backgrounds and core subclasses already read well, and why only the
Gadgeteer was broken: `pt_all_subs` deliberately keeps a whole section as one blob.

**A blanket `prereq` rule is actively harmful.** `prereq` only means *italic*, and the core book also
italicises **inline spell names**. Prototyped across all files, it produced [book text: a racial
trait's spell sentence, split before the spell's name] in three races. The prototype was reverted.

**And the same trap was already live in what had just shipped.** The `prereq` rule in `pt_all_subs`
was breaking Gadgeteer path features mid-sentence — [book text: a clause split before a spell name], and
`"divert power*"` split across two lines. Caught only by scanning the data for `[a-z,]\n[a-z]`, not
by any test that existed. **That scan is now a test**, across every Humblewood file.

**The rule is POSITIONAL in both parsers, never stylistic.** In `pt_all_subs`, an italic run is a
tagline only when it directly follows a `head`. In `parse_entity`, only the first italic run, before
any prose or trait. That correctly picks up the genuine shared case — subclass taglines ([book text:
a path's one-line italic motto]) and feat type lines ("Origin Feat (Prerequisite: Glide trait)"),
11 entries — while leaving inline spell names alone.

**`humblewood-verbatim` still passes 129/133** — it never reads `classes.json`, and its `norm()`
strips `*` and collapses whitespace regardless. Note it is SKIPPED by `./src/tests/run.sh` because
that uses system python; run it with `.venv/bin/python src/tests/humblewood-verbatim.py` after any
extractor change.

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

---

## Markup split + four JS fragment cuts (2026-08-17)

**Why:** several GitHub issues are now worked in parallel, one git worktree each. Branches carry
src-only diffs (they build to verify but never commit `dist/fieldbook.html`), so builds were already
untethered — what remained was *source-file* coupling. `src/fieldbook.template.html` held the whole
`<body>` in 358 lines, its `tab-sheet` panel alone 156 of them, so every UI change landed in one file.

**What moved.** The seven `<section class="tabpanel">` blocks left the template for `src/html/`, one
per tab, spliced back inside `<div class="page">` at a new `<!--@@HTML@@-->` marker. The template is
now the page SHELL (100 lines): top bar, tab bar, ToC flyout, home screen, generic modal. Four
oversized JS fragments were cut at their own banner comments:

| was | now | new fragment |
|---|---|---|
| `88-settings.js` 524 | 250 | `89-rules-merge.js` 274 |
| `65-resources.js` 490 | 238 | `66-coins-hp.js` 252 |
| `72-char-update.js` 466 | 328 | `73-char-update-ui.js` 138 |
| `70-persistence.js` 423 | 294 | `71-char-io.js` 129 |

`72-char-update.js` was cut at its own `/* ===== update UI ===== */` banner specifically to make
CLAUDE.md's "pure — no DOM — so it stays testable" claim true again; lines 329–466 were the DOM half.
`70-persistence.js` has no clean seam — `71-char-io.js` carries cache hydration, `migrate` and
export/print/import, which its name only half describes. Taken for size, flagged here as the weak one.

**Acceptance was byte-for-byte identity**, twice over: `dist/fieldbook.html` stayed at 473,556 bytes,
sha256 `92779c24…`, after the markup split and again after the JS cuts. Because every cut is a
contiguous slice in the original order, that identity is a *complete* correctness proof — reordering
is the only thing that can break a top-level TDZ, and slicing cannot reorder. No `APP_VERSION` bump,
no changelog bullet, no browser QA owed.

**Two asymmetries are preserved inside the fragment files, not regenerated:** `50-tables.html` has no
banner comment (every other panel does) and `60-notes.html` carries two. A joiner emitting banners per
panel would have needed to special-case both. Related: `html` fragments concatenate with **no**
separator, unlike `js` which joins on `\n` — each panel file already carries its trailing blank line.

**`harness.js` gained `loadHTML()`.** `rules-data.js` read the template as the whole body in ~30
assertions. It now calls one shared assembler, mirroring what `loadApp()` is for JS. It **splices**
rather than concatenates: appending the panels would put them outside `.page`, which silently turns
`block()`'s depth walk and the "nothing after the Notes panel takes a note" guard into tautologies.
It re-implements the builder's splice rather than calling it, because `build-html.js` builds and
`process.exit()`s at require time — and a test using the builder's own splice could never catch the
builder splicing wrongly. One assertion pins them together against `dist/fieldbook.html`; verified it
fails on the `join("\n")`-instead-of-`join("")` mistake, which every shape-based guard sails past.

**Also hardened:** `block()` in `rules-data.js` used to `return html.slice(at)` on unbalanced markup.
Every consumer asks "is X inside this block?" with `.includes()`, so that made those assertions
trivially true. It throws now — a fragment losing its `</section>` is a real way to get there.

**Two earlier ledger entries are now stale** (left as written, since they are dated log entries):
the 2026-08-07 test-placement entry says `validateOrder` "is invoked only for `src/js` and `src/css`"
— it is invoked for `src/html` too now, though the conclusion it supports (`src/tests/` is outside the
unlisted-fragment guard) still holds. And the id-wiring entry quotes 311 declared / 286 used; measured
today it is 323 / 292.

**CI needed two edits or the new directory would have been invisible:** the manifest-parity step
enumerates directories literally, and so does the byte-hygiene loop. An unlisted `src/html/*.html`
ships nothing while CI stays green. The zip allowlist needed none — `build.sh`'s dev-material regex
already starts `^src\/`.

## Local git hooks (2026-08-17)

`.githooks/` + `core.hooksPath`, installed from `dev.sh` menu `h`. Tracked, so they survive a clone
and get reviewed like code; `.git/hooks` would have done neither.

**They cover worktrees for free.** Measured: from inside a worktree `git rev-parse --git-path hooks`
resolves to the MAIN repo's `.git/hooks`, and a relative `core.hooksPath` resolves against whichever
working tree the hook runs in. One install covers every parallel-agent worktree.

**The split is not arbitrary.** `pre-commit` deliberately excludes `build-html.js --check` AND
`./src/tests/run.sh`. Both need a current `dist/fieldbook.html` — the second only since the byte-pin
guard was added — and a stale `dist/` is the *expected* state on a feature branch, which the parallel
worktree flow depends on (src-only diffs, artifact never committed on a branch). Putting either in
`pre-commit` would block every agent commit. They live in `pre-push`, which in that flow only ever
fires for the owner, at the moment work reaches CI.

**The check worth having** is `check_manifest_tracked`: every path in `src/manifest.json` must be
tracked or staged. It is the only one that reads the index rather than the working tree, because
"written, listed, built, tested — and never `git add`ed" passes every other check and then produces a
broken app on a clean checkout. Verified against the real case: it named all 11 untracked fragments
from the markup split with a `git add` line for each.

Everything else reads the working tree, not staged blobs — so `git add -p` could validate bytes that
are not being committed. Accepted: reading staged content means temp files and rewritten error paths,
and this repo commits whole files.

`pre-push` will not rebuild for you. A hook that silently changes what you are about to push is the
wrong shape for a byte-exact artifact. It prints the command and refuses.

Not in CI, on purpose: validating `ci.yml` from inside `ci.yml` is tautological — GitHub must parse
the workflow to start the job, so a malformed one never runs. And `build.sh` is executed by CI and
`release.yml`, so an `npx` call there would put a network dependency into a script that otherwise
needs only node, python3 and bash. The YAML check skips cleanly with no npx and no network.

## Worktree bootstrap (2026-08-17)

`scripts/wt.sh add|list|rm`, worktrees in `.claude/worktrees/<issue>/`. Branch `issue/<n>-<slug>`,
slug pulled from the issue title via `gh` when available. Symlinks `.venv` and `_conversion-data`
in (102 MB and 461 MB — copying them per worktree is not an option) and copies
`settings.local.json` so agents do not re-trigger answered permission prompts.

**`.gitattributes` gained `merge=union`** on `src/docs/UNRELEASED.md` and `WIRING-LEDGER.md`. Verified
in a scratch repo: two branches each appending a bullet merge with both bullets and no conflict.
Without it every merge after the first conflicts on lines that do not disagree. `dist/fieldbook.html`
gets `merge=ours` as a dead-man's switch (branches are src-only, so it should never fire); the driver
itself is `git config merge.ours.driver true`, which `wt.sh` sets idempotently — `ours` is not one of
git's built-in attribute drivers, unlike `union` and `binary`.

**Bug found by testing, not by reading:** `.gitignore` had `.venv/` and `/_conversion-data/` WITH
trailing slashes. A trailing slash matches a directory, and `wt.sh` creates SYMLINKS, which git sees
as files — so both came out untracked rather than ignored, and an agent running `git add -A` in a
worktree would have committed two broken symlinks into the repo. Fixed by dropping the slashes;
proved in a scratch repo that the old patterns leave them untracked and the new ones ignore them.

**Second bug from the same test:** `wt.sh rm` could never remove its own worktree, because the
symlinks and copied settings that `add` creates are exactly the "modified or untracked files" that
`git worktree remove` refuses on. `rm` now deletes what `add` created first. Genuine uncommitted work
still blocks removal, which is the behaviour worth keeping.

Verified end to end in a throwaway worktree: full suite passes inside it (1213 checks), the hooks are
inherited (`core.hooksPath` is shared config and a relative path resolves per working tree), and a
build there produced its own `dist/fieldbook.html` without touching main's.

## Done — Tables folded into the Rules tab (issue #32)

Seven tabs became six. The Reference Tables card moved verbatim out of `src/html/50-tables.html`
into `src/html/40-rules.html`, below Glossary & Rules, and the fragment was deleted along with its
`src/manifest.json` entry and the `data-tab="tables"` button in `src/fieldbook.template.html`.

**No JS changed.** Every id the renderer and the boot wiring reach for (`tablesList`,
`tablesSearch`, `tablesRulesFiles`, `tablesImport`) came along with the card, so `renderTables()`,
the filter listener, the file input and the import link are untouched. `selectTab()` and
`buildToc()` are generic over `data-tab` / `.tabpanel`, so neither needed a change either — the ToC
flyout now lists both Rules cards, which is what replaces the lost tab as a way in.

**`NOTE_SECTIONS` was never involved:** there was no `tables` note id, so no saved `secNotes` key
can be orphaned. The registry is still 19 sections and the 19 `data-note` cards are all elsewhere.

Test assertions changed, and why:
- `rules-data.js` `'there are seven tabs' / tabs.length === 7` → `'there are six tabs' / === 6`.
  The count IS the thing the issue changes; the name was reworded so it can't lie.
- the same block's glyph-and-word check, `tabicon`/`tlbl` counts 7 → 6, for the same reason.
The two-way tab↔panel checks were left alone and are what actually prove the removal is complete:
a leftover panel or a leftover button would fail one of them.

`docs.js` reads the html count from the manifest, so `CLAUDE.md` (`html/*.html  6 fragments`) and
ADR-001 (`html/ (6)`) were updated with it. `README.md`'s Tables section was folded into Rules;
`docs/rules-schema.md` and `docs/README-converter.md` no longer name a Tables tab.

Fragment prefixes were NOT renumbered — `60-notes.html` keeps its name. The manifest is the
authoritative order, the prefixes are only a reading aid, and renaming would have been pure churn.
## Additional damage types on attacks (#30, 2026-08-17)

An attack may now carry `extraDamage`: an optional array of `{dice,type}` on the attack record. A
sword that deals 1d8 slashing *and* 1d6 poison is one attack row, not two. The field is **omitted
when empty**, so an attack saved before this exists is byte-identical to one saved after with no
extras — nothing to migrate, and `migrate` already passes `character.attacks` through untouched.

Three formatting helpers in `60-attacks.js`, all pure and all unit-tested in `src/tests/sheet.js`
(320 checks there now): `extraDamageList(a)` normalises and drops empty rows, `damagePartStr()`
builds one `dice bonus type` fragment, `attackDamageStr(a,bonus)` joins the main part and the extras
with `" + "`. **The bonus goes on the main part only** — an extra die is its own roll and takes no
ability modifier, no manual extra, no `damage` effect. That is the rule the tests pin hardest,
because getting it wrong is invisible in the JSON and wrong at the table.

One helper, three call sites, on purpose: `renderAttacks()`, `openAttackBreakdown()` and the print
sheet in `71-char-io.js` each had their own copy of the same inline expression, and the print one had
already drifted. The breakdown modal also spells out that extras roll separately, since its whole job
is explaining where the numbers come from.

Form UI is a repeatable row list (`#aXDmg` + `attackXDmgRowHTML()` + a delegated click for the
remove button), read back by `readAttackXDmg()`. Class-based hooks, not `data-*`, so nothing collides
with the app's global delegated handlers.

**Not done, deliberately.** Spell-sourced attacks cannot get extras: `syncSpellAttack` rebuilds them
from the spell's own fields, and the spell form lives in `80-modal-forms.js`, owned by another issue
in this batch. `syncSpellAttack` is untouched and simply produces no `extraDamage`, which the
formatter handles as "none".

**Pre-existing bug found while reading, NOT fixed here** (out of scope, and it wants its own issue):
`openAttackForm()` builds a fresh `rec` and drops `itemId`/`spellId`/`source`/`save`. So editing a
weapon attack silently unlinks it from its inventory item — and `updResyncAttack()` in
`72-char-update.js` then finds nothing by `itemId` on the next pack update and calls
`addAttackForItem()`, producing a DUPLICATE attack row. Fixing it means deciding whether a resync may
overwrite a player-edited attack, which is a real design call, not a one-liner.
## Feats and traits are searchable — issue #31 (2026-08-17)

`browseFeatures()` in `src/js/85-browse.js`, wired to `data-add="feature"` in `90-boot.js` (one map
entry: `feature:openFeatureForm` → `feature:browseFeatures`). It is `openBrowse()` with the same
config shape as `browseItems`/`browseSpells`, so no new UI pattern and no new CSS.

**What was actually missing.** The only chooser was the feature form's "Insert from rules pack"
select, and it reads `rules.features` alone — so it offered the loose traits and **not one feat**.
117 feats across XPHB/Humblewood/XGE/TCE were reachable only by typing them out. Loose traits are not
a rump either: 105 of them (Tasha's 76, Xanathar's 22, homebrew 7).

**Two categories, one picker.** Entries are wrapped `{k:"feat"|"trait", e:def, id}` rather than
concatenated: Humblewood ships `Glide` as both a feat and a trait, they add in different shapes, and
`_id` alone would not say which list a row came from.

- A feat is stored the way `grantFeatDef` stores one — `"Feat: <name>"`, stamped
  `stampSrc(copy, def, "feature", "feats")` — so a picked feat and a granted feat are the same record
  to `72-char-update.js`. A trait keeps its own name and stamps against `"features"`, which is a
  category `updCandidates` can resolve; `addFeatureFromDef`'s own stamp leaves `cat:""` and would
  fall through to the name-only legacy path.
- **No origin select.** Items use it for provenance, but `feature.origin` is structural: it drives
  `featGroupLabel` and, more to the point, `removeFeaturesWhere(f=>f.origin.kind==="race" && ...)`.
  Browse origins carry `detail`, not `name`, so they would never match those predicates — but the
  field is load-bearing for clean revert and is not worth borrowing for a label. Picked entries get
  `origin:null` and land in "Other", exactly as the feature form has always left them. Asserted.
- Duplicates are refused by stored name (browseSpells' behaviour), and the row already carries the
  "added" badge. Repeatable-feat ASI comes through the level-up choice path, not this browser.
- Feats carry no category field; the converter writes it as the FIRST LINE ("Origin feat",
  "General feat · Prerequisite: Level 4+"). `featPickKind` reads that line only — 2014-era books
  have no such line and classify as plain "Feat" (35 of 117). `featPickPrereq` likewise reads only
  the first line, or the body's prose would gate half the list.
- Traits group by their own `source`, not into one bucket: 30 contiguous headings over 222 entries
  (Eldritch Invocation 28, Artificer Infusion 16, Battle Master Maneuver 7…). `sort` therefore keys
  kind → group → name, since `openBrowse` emits a heading whenever the group string changes.

Facets: Type (the six kinds present), Pack (only when more than one source is loaded), and a
"No prerequisite" toggle. Search covers the description text, which is the question this browser
exists to answer.

47 checks in `src/tests/sheet.js`, including a `updResolve` round trip both ways. Full suite 1247.
Deliberately not done: no skill-choice prompt for feats that carry one (`grantFeatDef` only offers
those when an origin sid exists, and picked feats have no origin).
## Item uses (issue #25, 2026-08-17)

Items gained the same limited-use machinery features have, plus a Use button that can heal, apply a
status and consume a charge or a unit.

**One shape, not a second one.** `it.uses = {max, per, used}` is byte-for-byte the feature shape, so
`usesMax()` reads both and `72-char-update.js` already preserves `uses.used` across a pack update
(`uses` is not in `UPD_FIELDS.item`, so a pack can never write it either). `resetItemUses(kinds)` in
`65-resources.js` mirrors `resetFeatureUses` and is called from `longRest` (short+long) and
`shortRest` (short); `per:"none"` is a charge no rest returns, and the pips are how it is reset.

**What Use does is `it.use = {heal, status, consume}` — and it is INFERRED when absent.**
`detectItemUse()` reads "regains 2d4 + 2 Hit Points" out of a Consumables-section item, which is how a
potion added through the item browser (`85-browse.js`, owned by another issue and untouched) is usable
with no setup. Precedence copies `detectSpellAttack`: explicit wins, and `use:{off:true}` is written
when the player clears the boxes against a use that would otherwise be re-read from the description —
without that flag, clearing it could never stick. Detection is deliberately narrow: it requires the
Consumables section AND "hit points", so "regains 1d3 expended charges" is not mistaken for a heal.

**Dice.** `parseDiceExpr` is pure and total, `rollDiceExpr` is the only thing touching `Math.random` —
that split is what makes the accepted/rejected spellings assertable (26 checks). The item editor
refuses to save an expression the parser rejects rather than storing a heal that silently does
nothing. The prompt holds the DICE total in its box and adds the flat bonus once, so "I rolled it" and
"roll it for me" cannot disagree about whether the +2 is already in.

**Not done, on purpose:** no auto-detection of charges ("this wand has 7 charges") — the phrasing
varies far more than the healing line and a wrong guess is worse than a blank box; no status REMOVAL
on use (Elixir of Health cures conditions), which wants a list and a different UI; no use info on the
printed sheet.

Sheet suite is +76 checks (1280 total). CSS gained `.tbtn:disabled`, which also fixes the coin
adjuster's Apply button looking enabled while it was not.
## Editing an attack kept its links (2026-08-17)

`openAttackForm()` rebuilt its record from the form boxes and dropped everything the form does not
ask about. `carryAttackLinks(prev,rec)` in `src/js/60-attacks.js` copies the four across —
`itemId`, `spellId`, `source`, `save` — and the save handler calls it. Pure, so the round trip is
asserted without a DOM (7 checks in `src/tests/sheet.js`), with one source guard in
`rules-data.js` that the form actually calls it, next to the identical guards on the feature form.

The visible damage was the duplicate: `updResyncAttack()` looks an attack up by `itemId`, found
none on an edited weapon, and called `addAttackForItem()` — so a pack update grew a second row.
**Deliberately NOT answered here:** whether a resync may overwrite a player-edited attack.
`72-char-update.js` is untouched; it still rebuilds the row wholesale from the item, which is now
reachable again for edited attacks. That is the open design call the previous ledger entry flagged.
## Spells carry their own additional damage types (2026-08-17)

#30 gave attacks `extraDamage`, but a spell's attack row is REBUILT from the spell by
`syncSpellAttack()` every time and has no Edit button, so a spell that deals two damage types had
nowhere to say so. The field therefore belongs to the SPELL, in the identical `{dice,type}` shape:
`sp.extraDamage` → copied onto the row it builds, absent when empty.

One control, two forms. `xDmgFieldHTML(id,rec,hint)` / `wireXDmgField(id)` / `readXDmg(id)` /
`clearXDmgField(id)` in `60-attacks.js` are the attack form's row list, generalised on its element
id (`readAttackXDmg()` is gone; nothing else called it). `id` is a parameter for the reason
`statusDatalistHTML` takes one — two elements sharing an id is a silent no-op for the second. The
spell form's list sits inside `#sAtkFields`, so it appears only once the spell IS an attack or a
save, and the pack-insert handler clears it: every other box then describes the spell just picked.

- **No auto-detection.** `detectSpellAttack` still reads only one `NdN <type> damage` phrase and is
  untouched; "explicit setting wins" is unchanged. A second type is phrased far too many ways for a
  guess to be better than a blank box.
- `promptSpellAttack` now formats its Damage line through `attackDamageStr`, so the cast dialog and
  the sheet row cannot promise different damage.
- `UPD_FIELDS.spell` is `level/meta/text`, so a pack update can never clobber the player's extras.
- **`getElementById("literal")` in a form is checked by rules-data.js** against ids the app renders.
  A generated id (`id="${id}"`) is not "declared", so the one literal lookup left — clearing the
  list on pack-insert — had to become `clearXDmgField(id)`. That guard is worth keeping honest.

20 checks in `src/tests/sheet.js` (first coverage `syncSpellAttack` has had), 3 wiring guards in
`rules-data.js`. Suite 1363.

**Seen, not fixed:** `openSpellForm`'s save drops `s.src`, the same family as the attack-form bug
above — an edited spell stops being recognisable to `72-char-update.js` and falls back to matching
by name. Out of scope here; wants its own issue.
## The Concentrating condition — issue #37 (2026-08-17)

Casting a concentration spell adds a **Concentrating** status; clearing or removing that status ends
the spell. Machinery in `src/js/60-attacks.js`: `syncConcStatus()`, `endConcentration()`,
`endConcFromStatus()`, `concActiveSpell()`, `concStatusRow()`, `CONC_STATUS_NAME`.

**One fact, one store.** Concentration lives on the active spell (`a.conc`, already there); the
status is a MIRROR carrying `s.concId` = that active spell's id. Nothing is matched by name, so a
"Concentrating" a player typed themselves is never mistaken for this one — and nothing has to be
kept in agreement between two records that can both claim to be true.

**A reconcile, not add/remove.** `syncConcStatus()` makes the statuses match whatever concentration
spell is running: re-point and re-describe if there is one, delete the linked row if there is not.
That is what stops the condition being STRANDED when the spell ends by a route the adding code never
saw — a second concentration spell replacing it (`castSpell`), the duration elapsing (`maybeExpire`,
which now redraws statuses itself so every `bumpActive` caller is covered), the spell being deleted
(`90-boot.js`), or an older sheet that was mid-concentration before any of this existed
(`renderAll()` calls it before anything draws).

**The other direction** is three handlers: `data-del-status` (prompt names the spell that ends),
`data-toggle-status` (asks via `endConcFromStatus`, because a lost concentration spell cannot be
given back), and the status form's save — which also had to carry `concId` across, since it rebuilds
its record from the boxes, and treats unticking "Active now" as ending it.

- **No effects.** Concentration's rules are prose — a Constitution save when you take damage, one at
  a time. Effects are numeric-only, so the row carries `effects: []`.
- `concId` is optional and additive: `migrate` preserves it with no code, `blankChar` needs nothing,
  and a status saved before it loads untouched. Asserted both ways.
- A hand-typed "Concentrating" is ADOPTED rather than duplicated (addStatusByName's precedent), and
  keeps the note the player wrote — only a row this code created is re-described.

29 checks in `src/tests/sheet.js` (the first coverage `castSpell` has had) and 7 wiring guards in
`rules-data.js` for the handlers the stub DOM cannot click. Suite 1399.

## Editing a spell kept its rules-update stamp (2026-08-17)

`openSpellForm()`'s save handler rebuilds `rec` from the boxes and assigned it over the spell, so
`s.src` went with everything else the form does not ask about. Spell is the third kind in
`UPD_FIELDS`, and its two siblings already guarded this — feature (`if(f.src)rec.src=f.src;`) and
item (`if(it.src)rec.src=it.src;`) — so the fix is the same one line, `if(s.src)rec.src=s.src;`,
placed beside the extra-damage carry.

What it cost while it was missing: `updResolve()` fell through to the name-only path, so every
edited spell matched `loose`, `updEdited()` returned `null` (unknowable) and the row came back
`edited:true` and unticked — and a same-named spell in a second loaded pack made it `ambiguous`
instead of resolving by pack.

Six checks in `src/tests/char-update.js` against the real `updResolve`/`updEdited` (stamped resolves
exactly and its edit is detected; stamp deleted → loose + `null`; a hand-typed spell has no `src` and
reports `unmatched`), plus one source guard in `rules-data.js` on the existing `spellSave` slice,
next to the identical feature/item guards. Suite 1406.

## A resync no longer overwrites a player-edited attack (2026-08-17)

This is the open design call the previous two entries flagged, and the owner's answer is: **if the
player has edited the attack, do not override it. They did that for a reason.**

`updResyncAttack()` spliced the row out and rebuilt it from the item, so any edit went silently and
with nothing to undo it. Attacks carry no `src` — nothing resolves them back to a pack, only the ITEM
can regenerate them — so the missing half was "was this row left exactly as we generated it?".

`genFp` (72-char-update.js) is ONE `fpHash` over `ATK_GEN_FIELDS` — name, kind, ability, atkMisc,
damageDice, damageType, dmgMisc, notes: the fields `addAttackForItem()` derives from the item. A
single hash, not an `fpMap`: nothing needs to know which field moved. `updAtkEdited()` is
three-valued and mirrors `updEdited()` exactly — `null` when there is no stamp — and only `false`
may be rebuilt:

- `false` still as generated → rebuild, keeping the id so collapse state survives
- `true`  player edited it   → leave it
- `null`  no stamp (pre-1.5) → unknowable → leave it

Three places touch the stamp: `addAttackForItem()` stamps at generation; `syncItemAttack()`
re-stamps when editing the ITEM rewrites the row in place (without this, editing a weapon makes its
own attack look hand-edited and it would never resync again); and `openAttackForm()`'s save carries
`a.genFp` across, so a save that changed nothing is still comparable and a real edit reads as an
edit rather than as unknowable.

**The fingerprint covers every field the generator sets, `proficient` and `addAbilityDamage`
included.** They were left out first, on the reasoning that they are "the player's either way" — but
`addAttackForItem` hardcodes both to `true`, so a player who ONLY unticked one (a weapon they are not
proficient with, a thrown weapon that adds no modifier) was classed untouched and had the tick put
back by the next resync. That is the override this guard exists to prevent.

The worry about widening it — that the row would freeze against all future pack changes — does not
survive contact: a row nobody has touched still matches its stamp and still rebuilds, and a row the
player HAS touched is precisely the one to leave alone. Widening only makes the "edited" test
complete.

**Still outside, correctly:** `extraDamage`, the id, and the links back to the item or spell. The
generator never sets those, so they cannot indicate an edit either way.

`genFp` is optional and additive: `migrate` preserves it with no code, old saves have none and land
in the `null` branch. 18 checks in `src/tests/char-update.js` (R7 covers all three branches, the
no-duplicate guarantee on both leave-alone paths, the re-stamp on rebuild, and the migrate round
trip) plus 4 wiring guards in `rules-data.js`. Suite 1424.

## Spell rows in Attacks need damage, and the damage detector was under-reading (2026-08-18)

**Why:** 270 spell rows across the five packs, **104 of them with no damage** — Cause Fear, Charm
Person, Command. A save row with no damage repeats the Spell Save DC already on the Spellcasting
card, so it was a name in a list you scan mid-combat for numbers.

**The rule is per atkType, not blanket.** `syncSpellAttack` now returns early for a `save` spell with
no damage (`spellHasDamage`: main dice or extras). An **attack** spell always keeps its row — the
to-hit is the number and nothing else on the sheet shows it. Measured: 270 rows → 178, 92 dropped.
Only 5 attack rows had no damage and every one of them was either a detection miss (Chromatic Orb)
or a spell that makes a weapon you roll separately (Flame Blade, Mordenkainen's Sword, Magic Stone).

**The detector was the more interesting half.** `(\d+d\d+)\s+(\w+)\s+damage` cannot read
`10d6 + 40 force damage` — it tries to read `+` as the damage type — so Disintegrate and Finger of
Death carried a bare DC. Widened to allow the flat bonus inside the dice group, plus a **type-less
fallback** for `3d6 damage of the chosen type`, where the type is the player's to pick (Dragon's
Breath, Conjure Elemental, Illusory Dragon, Chromatic Orb): fill the dice, leave the type blank
rather than invent one.

**What stops the fallback over-reaching:** `damage` must follow the dice IMMEDIATELY. That is what
rejects Ray of Enfeeblement's *"subtracts 1d8 from all its damage rolls"* — a penalty applied to
someone else's damage, which a looser pattern would have shown as this spell's own. Checked all 12
spells the fallback newly matches: 6 get no row at all (Elemental Weapon, Absorb Elements and other
"an extra Nd_ damage" riders), so filling their dice is invisible; of the 6 that do get a row, 5 are
unambiguously the spell's own damage.

**Existing sheets needed a nudge.** A stored spell already has `atkType`, so `detectSpellAttack`
returns early and never revisits it — Disintegrate would have lost its row to the new rule rather
than gained its damage. `spellDamageBackfill()` runs from `ensureSpellAttacks()` and re-runs the
extraction ALONE for spells with a type but no dice. Additive by construction: it cannot change
`atkType` and cannot overwrite a value the player typed.

**Deferred:** Delayed Blast Fireball (*"base damage is 12d6"*) and Glyph of Warding (*"5d8 Acid,
Cold, Fire, Lightning, or Thunder damage"*) are still unread — both need their own shape, and
neither is worth a pattern that risks the false positives above.

**The rule alone was not enough for existing sheets, and only browser QA showed it.** The unit tests
all passed and a fresh character behaved perfectly, but a sheet saved before the change kept its
damage-free rows: `syncSpellAttack` is what applies the rule, and for a spell you never edit it never
runs again. `spellDamageBackfill` only re-synced the spells it FILLED, so Disintegrate healed itself
while Cause Fear sat there with `Damage —`. `dropDamagelessSpellRows()` sweeps them once from
`ensureSpellAttacks()`. Targeted, not a blanket re-sync: rebuilding every row would hand each one a
new uid and throw away the collapse state on rows that were already correct. It leaves orphan rows
(a `spellId` with no spell) alone — those are not this rule's to judge.


## One rich-text grammar for every field (2026-08-18)

**The bug behind the request:** three renderers, three capabilities. `highlight()` for the Story/bio
fields — no markup at all, and no line breaks either. `descHTML()` for every description — `**bold**`
only. `noteHTML()` for section notes — the whole grammar. So the field literally called **Notes** on
the Story tab was the one that formatted nothing, while the *section* notes formatted everything.
68% of pack descriptions contain newlines that `descHTML` rendered as a run-on blob.

**Now:** `richHTML()` and `richInline()` sit beside `noteHTML()` in `87-notes.js`; `descHTML()` is
kept as the name the call sites use and delegates. One grammar, one escape-first ordering.

**`richHTML` unwraps a LONE paragraph.** Hundreds of `.desc` slots receive bare inline text today,
and a `<p>` outside `.n-body` picks up the browser's 1em margins — wrapping them would have spaced
out every item, status and feature in the app to gain nothing. Blocks appear only when the player
actually types a list, heading or quote.

**`richInline` exists for run-in headings.** `<p><b>Trait.</b> description…</p>` in the class, species
and background panes: a block element there nests inside that `<p>`, the parser closes it early and
the layout comes apart. Those four sites take the inline-only renderer. A guard asserts no run-in
pane is left calling a block renderer.

**The hazard the old comment warned about was real, and is now fixed at the root.** `descHTML` was
bold-only *because* single-asterisk emphasis paired the footnote markers in the Humblewood data
("divert power*", "cymatic sight*"). Verified still live: 415 asterisks in that pack, and exactly one
string italicised a whole sentence between two lone markers. Rather than keep italics out of
descriptions forever, the rule now requires the emphasis content to START and END with a non-space —
so an asterisk followed by a space cannot OPEN emphasis, and a footnote marker can only ever be a
closing delimiter. Two closers never pair. Re-checked over **19,156 strings across all five packs:
zero spurious italics, zero spurious blocks.**

**CSS had to move with it.** `.item .desc` and `.rt-view` dropped `white-space:pre-wrap` — keeping it
alongside real `<br>` elements would have doubled every line break. `.m-body p` KEEPS its pre-wrap
and is fine: the renderer consumes newlines into `<br>`, so no raw newline survives for pre-wrap to
render twice (verified in the browser, not assumed). `.n-body p` margins and the `code` style were
un-scoped so they reach every rich surface; `code` is styled on the element because it only ever
enters the DOM from our own renderer.

**Removed:** `DESC_H0`/`DESC_H1`, dead once `descHTML` stopped holding chips itself.

**Follow-up the same day: the hover preview.** The note CARD was rendering correctly all along — what
was being looked at was `notePreview()`, the popup inside the note button, which deliberately stripped
every marker and flattened to one line. A note reading `**bold**` / `- bullet` previewed as
"bold bulleted", with no sign either marker had done anything.

The old comment gave two reasons, and only one survives scrutiny — but a third, harder one replaces
it. A `<button>`'s content model is PHRASING content, so `<p>`, `<ul>` and `<li>` are illegal inside
it however inert they are; that rules out block markup regardless of the chip question. The chips are
separately illegal (`role="button"` inside a button) and are a genuine trap on a hover card — you
reach for one and the card is gone.

So the preview now renders what IS phrasing — `<strong>`, `<em>`, `<code>`, `<br>` — and REPRESENTS
the block markers rather than dropping them: a bullet becomes "• ", a heading loses its hashes, a
divider becomes an em dash. Chips are unwrapped to their own words after rendering. Truncation is
applied to the SOURCE, never the rendered HTML, which would cut tags in half. Tests assert the two
invariants directly: no block element and nothing interactive can reach the preview, for several
inputs.

## Armor is a field now, not an incantation (2026-08-18)

**What was actually happening:** `itemArmor()` prefers a structured `it.armor` object, but **not one
of the 31 armor items in any pack carries one** — every single one states its AC in the DESCRIPTION
("AC 15 + Dex modifier (max 2)") and is parsed. So armor worked, invisibly, on prose.

Three consequences, in increasing severity:
- A custom item COULD be armor, but only by typing the exact incantation. Verified: `AC 12 + Dex
  modifier` → light, `(max 2)` → medium, `AC 16` → heavy, `AC +2 (Shield)` → shield. Nothing in the
  UI said so.
- The shield branch keys off TYPE or NAME containing "shield", so a `Buckler` described as `AC +2`
  returned null — no AC, and `isEquippable` false, so it could not even be worn.
- The item form did not carry `it.armor` across a save. Latent only because nothing wrote it, and the
  same family as the attack `itemId` and spell `src` drops.

**Now:** an Armor toggle beside the Weapon one — kind (light/medium/heavy/shield), base AC, and a Max
Dex box that follows the kind unless overridden. Writes the structured field, carries an existing one
when the toggle is off, and prefills from `itemArmor(it)` so a pack item opens showing `Medium ·
AC 15 · Max Dex 2`. Inserting from the rules pack fills it the same way, so the prose becomes fields
at the moment of insertion.

**The consequence to remember:** once an item has the structured field, it beats the description. An
item saved through this form stops caring what its description says about AC. That is deliberate —
explicit over prose, the same way `weapon` already behaves — but it means editing "AC 11" to "AC 14"
in the text of such an item does nothing.

`ARMOR_KINDS`, `ARMOR_DEXCAP` and `armorKindOf()` live in `25-origins-items.js` beside the other item
helpers. Shield swaps which boxes exist rather than showing a base and a Dex cap that mean nothing to
it. Browser-verified: Half Plate opened prefilled, saved to a structured field, AC 14 → 17 on equip
(15 + min(Dex 4, cap 2)), and a hand-made Buckler as a Shield kind took it to 19.

## Consistency pass: favorites, collapse-all, group headings (2026-08-18)

Four asks, all "make it look like Inventory".

**Attacks can be favorited.** They had no `fav` and no sections at all — one flat list. Now a star per
row, `ATK_FAV` sharing FEAT_FAV's exact label so the two read as one idea, and a `★ Favorites`
heading. The headings appear ONLY when something is starred: a lone "Favorites" over the whole list,
or a bare "Attacks" heading when nothing is starred, is noise. Favorites are left in insertion order
rather than sorted — the list is short and hand-built, so the row stays where it was put.

**Collapse-all on Attacks and Features.** Three lists carry collapse state (`invCol`, `atkCol`,
`featCol`); only Inventory had the control. Same markup, same derived label — "Collapse all" while
anything is open, "Expand all" once everything is shut — and the button hides itself on an empty
list. Spells and Statuses have no collapse state, so they were left alone rather than given one.

**Group headings.** `.fgname` was `var(--ink)`; Inventory and Spells use `var(--accent)`. Changed at
the shared rule, so Features, the Notes groups and the Settings sections all match — the owner chose
consistency over scoping it to Features.

**Two things the blanket change would have got wrong:**
- `.fgcount` is not always a count. Settings passes a BADGE through it — "12 entries", "unnamed" —
  which would read absurdly in brackets. So counts moved to `.cnt` (the inventory class, plain and
  parenthesised) and `.fgcount` kept its pill for badges.
- `.fgname` was `flex:1`, which stretched the title across the header and shoved the count to the far
  right — not "next to the heading like inventory" at all. Now `flex:0 1 auto` so the count sits
  beside it (measured: 8px gap), and `.fgcount` gained `margin-left:auto` so the Settings badge stays
  right-aligned where it reads correctly.

## Concentrating, mirrored onto the Spells tab (2026-08-18)

A `#concCard` above Active Spells — that is where you are looking when you cast the next spell, and
it is the card that tells you what you would be dropping.

**One row markup, two places.** `statusRowHTML(s)` was extracted out of `renderStatuses` and is used
by both. The controls are delegated from `document`, so the toggle, edit and delete work unchanged
from the Spells tab; verified by deleting from the new card and watching the condition, the Active
Spells row and the Sheet's Statuses card all clear together. Writing a second, nearly-identical row
would have been the obvious shortcut and the obvious thing to drift.

**The mirror redraws from inside `renderStatuses()`**, not from its own callers. It is a view of the
same statuses, so tying it to that render is what stops the two showing different things — no caller
has to remember to update both.

It finds its row with `concStatusRow()`, which matches on `concId`, never on the name — so a status
a player typed "Concentrating" themselves is not mistaken for the real one. Asserted.

## Spell slots on level-up: reported as a bug, is the rule (2026-08-18)

Reported: casters gain new slots but lose the old ones — a Warlock reaching level 3 loses its level 1
slots. Measured across the progression instead of patching:

    Warlock  1 L1:1 · 2 L1:2 · 3 L2:2 · 5 L3:2 · 7 L4:2 · 9 L5:2 · 11 L5:3
    Wizard   1 L1:2 · 2 L1:3 · 3 L1:4 L2:2 · 5 L1:4 L2:3 L3:2

That is Pact Magic: the Warlock table gives a fixed number of slots that are ALL the same level, and
that level is the highest unlocked — a level 3 Warlock genuinely has two 2nd-level slots and no
1st-level ones. Every row matches the PHB table, including the step to 3 slots at 11. Full, half and
third casters keep every lower level, so there is no general "replace instead of add" fault.

`autoSlots()` is written to match: the SLOTS_FULL table is assigned by level, then PACT is ADDED on
top (`+=`), because `casterLevel()` deliberately does not count warlock levels. Left alone.

Worth knowing if it comes up again: multiclass merges pact slots into the same pool (Wizard 3 /
Warlock 3 reads L1:4 L2:4). Real 5e tracks them separately because pact slots return on a short rest.
That IS a simplification, and a different question from the one asked.

## The two Rules-tab sections fold, and start folded (2026-08-18)

Glossary & Rules is 154 entries with packs loaded and Reference Tables sits underneath it, so reaching
a table meant scrolling past all of it. Both headings are toggles now and both default to shut; the
whole tab fits on one screen.

**Stored as a COLLAPSE map in `settings`, deliberately copying the Settings-sections idiom** — an
absent key means "never touched", so shut-by-default today does not freeze a player who opens one
tomorrow. Verified across a reload: the opened section came back open, the untouched one came back
shut, and only the touched key was written (`{tables:false}`).

**In settings, NOT on the character.** The glossary and tables come from the rules packs, which are
global — folding them on one character and finding them open on the next would be the surprising
behaviour.

**The trap that needed a guard:** the glossary heading contains its own "+ Add" button, so a bare
`closest("[data-rulessec]")` toggled the section every time you reached for it. The handler now
ignores clicks that land on anything interactive inside the heading. Verified: Add opens its dialog
and leaves the section exactly as it was.

Counts sit in the headings (`(154)`, `(174)`) so a shut section still says what is inside — the
reason you would open it — matching the inventory count style. Repainted from `refreshRulesUI()` so a
pack load updates them, and from `renderAll()` so loading a sheet with cached rules draws them at all.

## Weapons equip, and their attacks follow (2026-08-18)

`isEquippable` was `effects || armor`, so **52 of the 64 pack weapons had no Equip control at all** —
only the 12 magic ones with effects did. A weapon is now equippable on its own, and `attackVisible()`
gates a row on the equipped state of the item it came from.

**Hidden, never removed.** Unequipping must not throw away an attack the player has tuned. Verified
in the browser: an attack renamed "Club of Smiting" with edited dice vanished on unequip and came
back byte-identical on re-equip.

**Only item-derived rows follow the flag.** A hand-made attack has no item to equip; a spell's row is
governed by the spell. An ORPHAN — an `itemId` whose item was deleted — keeps showing, because there
is no Equip control left anywhere that could bring it back, so hiding it would bury the row for good.
Same reasoning `dropDamagelessSpellRows` uses for its orphans.

**The migration is the whole risk, and it needed a flag.** Every weapon on every pre-existing sheet is
stored `equipped:false` — not a decision, but because no control existed to make one. Gating on that
would have emptied the Attacks card of every character in existence. `migrateWeaponEquip()` equips
them once and records `wpnEquipInit`. The flag is load-bearing: without it, a weapon the player
deliberately unequips would be re-equipped on the very next load, forever.

**A trap the test caught before it shipped:** the flag was first set in `blankChar()`, which felt
right — a new sheet has nothing to migrate. But `migrate()` BUILDS its result from `blankChar()`, so
every old sheet arrived already carrying the flag and the migration was skipped silently. blankChar
no longer sets it; a new character gets it on its first save→load with an empty inventory, which is a
no-op. There is now an explicit assertion that blankChar does NOT pre-mark it.

**Newly added weapons arrive equipped** (`equipped:!!x.weapon` in the browse onAdd). Adding a sword
and seeing no attack appear would be the obvious next complaint.

The empty state says which of the two situations you are in: "Nothing equipped" when rows exist but
none are shown, the original "No attacks yet" when there are genuinely none.

## Screenshot validation for UI changes, and a Windows test-runner fix

**Screenshots are now producible here**, which CLAUDE.md previously said outright they were not.
Headless Chrome driven over the DevTools Protocol renders `dist/fieldbook.html` from `file://` with
no npm dependencies at all — Node 26 ships `fetch` and `WebSocket`, and Chrome is installed. Spawn
with `--headless=new --remote-debugging-port`, attach a flat session, navigate, seed state through
`Runtime.evaluate`, capture with `captureBeyondViewport`. This matters because the repo has no
`package.json`, and pulling in Playwright to take a picture would have been the wrong trade.

Mike asked that **every PR and every merge affecting the UI carry screenshot validation of each
update** — before and after for changes to existing UI. Check 4 in CLAUDE.md now says so, and the old
"you cannot click the UI here" wording is gone. Interactive QA is still his: a screenshot proves a
render, not a behavior.

**Two traps, both found by taking a screenshot that looked wrong.** Tab names are lowercase —
`selectTab("Sheet")` throws nothing, matches no panel, deactivates all of them, and produces an
intact top bar over a completely empty body. That is precisely the failure class the whole test suite
cannot see. And `newCharacter(name, system)` takes `"dnd"`/`"humblewood"`, deriving the skin, so
themed CSS work wants both.

**`src/tests/run.sh` was silently failing both Python suites on Windows.** It probed with
`command -v python3`, which succeeds — resolving to the Microsoft Store alias stub in WindowsApps that
prints "Python was not found" and exits non-zero. The fallback to `python` therefore never fired on a
machine with a working Python 3.12. It now probes by running `"$PY" -c ""`. converter went from
FAILED to 105 checks; the full suite is 7/7, 1524 checks, with humblewood-verbatim skipping cleanly
for want of `.venv`.

**Superseded within the hour: the mechanism is the Playwright MCP server, not hand-rolled CDP.**
Mike asked for the MCP specifically, so `.mcp.json` now registers `@playwright/mcp` at project scope
and CLAUDE.md check 4 points at `browser_navigate` / `browser_evaluate` /
`browser_take_screenshot`. Three bits of that config are load-bearing rather than decorative:
`--allow-unrestricted-file-access`, because the server blocks `file://` navigation by default and
this entire app is a `file://` URL; `cmd /c npx`, because stdio servers are spawned without a shell
on Windows where npx is `npx.cmd`; and `--browser chrome`, which reuses installed Chrome instead of
downloading Chromium. The version is pinned deliberately — `@latest` would re-resolve on every
session start, which is both a network dependency and an unannounced upgrade.

Verified end to end before being written down: driving the server over raw stdio JSON-RPC navigated
to the artifact, ran `newCharacter`, and captured a 1280x2008 full-page PNG of the Sheet tab. Worth
knowing for next time: a relative `filename` writes the PNG relative to CWD, not `--output-dir`.
Check 5 changed too — Playwright clicks, hovers and drags, so interactive changes should now be
*driven* here, with the owner's pass reserved for real browsers, sizes, touch and print.

## Emblems for classes, ancestries and backgrounds

78 icons from game-icons.net, one per class, ancestry/race and background across all five packs.
Subclasses deliberately get none — they are the second half of a class chip, and a second emblem
there competes with the first.

**The icon map ships in the app, not in `data/`, and that was the whole architectural question.**
Three independent reasons, any one of which is sufficient: `data/5e2024`, `data/xanathars` and
`data/tashas` are converter OUTPUT and `convert.py` `_write()` overwrites whole files with no merge;
byte-for-byte reproduction of `data/5e2024/` is the gate on converter changes; and `release.js`
bumps a system dataVersion from `git diff -- data/<dir>`, so a cosmetic feature would have told every
player to re-download five rules packs. Instead `src/icons/icons.json` is hand-authored and
`scripts/fetch-icons.js` generates `src/js/05-icons.js` from it.

**The generated fragment IS the vendored artwork** — no `.svg` files are kept. Committing 78 SVGs
plus a second offline generator buys nothing, because the only drift that can actually happen is
"someone edited the map and forgot to re-fetch", and that is detectable from the fragment alone: the
slug set in `icons.json` must equal the keys of `GAME_ICONS`. The docs suite asserts exactly that,
and its failure message names the command to run. Verified it fails when it should before trusting
it.

**Generation is NOT wired into `build.sh`.** CI asserts the build changes no tracked file; a
build-time fetch would turn that into a network-dependent byte-equality check against GitHub.

**Emblems are keyed by NAME, never `_id`** — a character stores its class/ancestry/background as a
plain string, so the emblem resolves with no rules pack loaded at all. The class-info screenshot was
taken on exactly that path. An unmapped name yields `""`; a per-kind fallback was considered and
rejected, because a wrong-but-present emblem on someone's homebrew is worse than none.

**Two things the screenshots caught that nothing else would have.** The Settings credits paragraphs
rendered as a stair-step, because `.m-body p` is `white-space:pre-wrap` and a wrapped source line
keeps its newline and indentation — every existing hint in that file is one long line for this exact
reason. And `selectTab` takes lowercase names, so an early probe produced an intact top bar over a
completely empty body while throwing nothing.

**`openModal` gained an optional third argument** and assigns `mIcon.innerHTML=icon||""`
UNCONDITIONALLY. Guarding it behind `if(icon)` would leak a class emblem into the next spell modal;
there is now an explicit regression check that opens a plain modal straight after an emblem one.

CC BY 3.0 needs the artists named, the licence named and linked, AND a statement that the work was
changed (we strip the background square and drop the fill). All three are in Settings and in README
section 10. In-app matters because `fieldbook.html` is shared as a lone file that no README follows.
`ICON_ARTISTS` is generated from what is actually vendored, so the credit cannot drift.

The artifact went 533,207 -> 681,252 bytes, +27.8%. There is no size gate; coordinate rounding was
considered and rejected (~15% saving, and arc-flag digits are position-sensitive).

Also widened `.githooks/checks.sh` `check_json` from `^(data/.*|src/manifest)\.json$` to `src/.*`,
which previously left `src/icons/icons.json` validated by nothing until the fetcher ran.

## CI builds a src-only PR instead of failing it

The worktree flow says branches never commit `dist/fieldbook.html`, and `ci.yml` said every PR's
committed artifact must be fresh. Both were true, so every worktree PR (#44, #45) failed at
`build-html.js --check` — and because that step fails the job, **tests, byte hygiene and the full
build were skipped**. A src-only PR got syntax checks and nothing else.

Skipping the check on PRs would not have been enough: `rules-data.js` asserts the assembled markup
appears byte-for-byte in `dist/fieldbook.html`, so any PR touching `src/html/` would then fail the
tests against the stale committed artifact instead. The fix BUILDS the artifact on a PR whose diff
does not touch it (checkout `fetch-depth: 2`; a PR is a merge commit whose first parent is the base,
so `git diff HEAD^1 HEAD -- dist/fieldbook.html` is exactly "did this PR commit it"). The final "build
changed no tracked file" step excludes the artifact on those PRs only, so generated docs are still
held to it. A PR that commits the artifact, and every push to `main`, keeps the strict `--check`.

`build-html.js` will overwrite in CI because its hand-edit guard accepts an artifact equal to HEAD's.
Merging a src-only PR with GitHub's button still leaves `main` stale, and `main`'s CI then says so —
the right alarm; WORKTREES.md §5's local merge-then-build remains the way in.

A PR's CI runs the workflow from its merge commit, so existing PRs pick this up only on a new run
against the updated base (push, or close and reopen), not from "Re-run jobs".

## Fixed — the screenshot MCP never connected after the cross-platform launcher

PR #42 moved `.mcp.json` from `cmd /c npx` to `node ${CLAUDE_PROJECT_DIR}/scripts/playwright-mcp.js`.
**The launcher was right; the path to it never resolved.** `CLAUDE_PROJECT_DIR` is a hook variable
and is not in the environment when `.mcp.json` is read, so node received the literal text and
failed with `Cannot find module '…/RPGFieldbook/${CLAUDE_PROJECT_DIR}/scripts/playwright-mcp.js'` —
every session from 2 Sep on. It passed review because it was verified by running the launcher by
hand, which never exercises the variable. The arg is now plain `scripts/playwright-mcp.js`: the
same log proves stdio servers start with the project root as their CWD.

**Where the real error lives:** `/mcp` only ever says "Connection closed". The server's stderr is in
`~/Library/Caches/claude-cli-nodejs/<project-path>/mcp-logs-playwright/*.jsonl`. Read that first.

Worktrees branched before PR #42 still carry the old `cmd /c` config and no launcher, so a session
rooted in one of them cannot take screenshots until the branch is rebased onto main.

## WORKTREES.md: integrate one branch per merge

Integrating #44/#45 with the documented `git merge --no-ff A B` stopped with conflict markers in
both `UNRELEASED.md` and this ledger, despite `merge=union`. An octopus merge merges each file with a
plain 3-way merge and never reads the attribute; a two-way `git merge` and `git rebase` do.
Reproduced in a scratch repo on git 2.50 before writing it down. GitHub ignores the attribute too, so
once `main` moves, every PR that appended to these files reports a conflict — and gets no CI run —
until `main` is merged into the branch locally.

WORKTREES.md sections 1 and 5 now merge one branch per command, section 4 says which merges honour
union and which don't, section 5 has the PR route (push, merge `main` in locally on a conflict,
still integrate locally), and section 8 no longer claims a conflict can only mean a missing
`.gitattributes`. Also corrected: section 1 showed `wt.sh rm 41 43`, but `rm` takes ONE issue number
and would have silently removed only the first.

Deliberately NOT added: a docs-suite check for a heading with no blank line above it. Union merges
do drop that line where two appended sections meet (twice during this integration), but an ATX
heading interrupts a paragraph in CommonMark and renders correctly, so it is cosmetic — and the
docs suite is explicitly not a prose linter. Six such headings already exist in this file.

## Done — the combat view (issues #9, #10, #11)

A full-screen view, opened from crossed swords in the tab bar, holding any of the 19 sections — the
REAL cards, moved into `#cvList` with a hidden `[data-cvhome]` marker left at home, and moved back on
close. Copies would duplicate every id (the #17 `#skill-perception` bug). A tracker in its header
(Start, ◀ ▶, End) drives the existing `advanceRound()`. Closing the view never ends combat.
Spec: `src/docs/specs/2026-09-24-combat-view-design.md`; plan: `src/docs/plans/2026-09-24-combat-view.md`.

Things that are not obvious and would be easy to undo by accident:

- **`COMBAT_DEFAULTS` lives in `00-constants.js`**, not `87-combat.js`: `blankChar()` reads it at load,
  when a later fragment's `const` is still in its TDZ.
- **`combatActive` is its own flag.** The Active Spells card has always moved `combatRound`, so
  deriving "in combat" from `round > 0` would drop old sheets into a fight on update.
- **The Esc listener is registered in the CAPTURE phase.** The modal's Esc handler runs first
  otherwise, shuts the modal, and the same keypress then closes the view behind it.
- **A drag never moves the dragged card** — moving an element can drop its pointer capture — so its
  neighbours hop over it instead, and the order is read back off the DOM on release.
- **`renderFamiliars()` now clears its list before its early return**: the view shows that card even
  when empty, and the stale last familiar would have shown with it.
- **`src/tests/docs.js` has two icon lists**: `KINDS` (everything vendored, now including `ui`) and
  `DATA_KINDS` (the three whose names ship in `data/`, for the coverage check).
- `selectTab()` closes the view first, so a note link never lands on a tab with its cards missing.

Known and accepted: Active Spells, Familiars and Skills (in By ability mode) are hidden on their own
tab when empty, so their toggle can only be reached once they have content. Inside the view that
toggle can only REMOVE a card — so once Active Spells is taken out of the view it cannot be put back
until a spell is running. Open question for Mike: a toast Undo, or an add-list in the view's ☰.
The item finder has no Esc of its own, so with the finder open over the view Esc leaves both open.

Final-review fixes, where the reason is not obvious from the code:

- **`inert` on `.topbar`, `.tabbar` and `.page` while the view is open** (`cvInert`): `aria-modal` does
  not stop Tab, which reached invisible controls behind the view. The modal, the item finder, the ☰
  flyout and the toast must stay OUTSIDE those three or they go dead over the view.
- **`renderCombatHeader()` captures the focused button's id before repainting** and refocuses it after,
  falling back when it is gone or disabled (◀ at round 1 → ▶, Start → ▶, End → Start). The repaint
  replaces every button, so without this ▶ lost focus on each press.
- **A toggle click repaints that one button in place** (`paintCombatToggle`); `outerHTML` dropped its
  focus. `renderCombatToggles()` stays the path for `renderAll()`.
- **`#combatView #familiarCard{order:0}`**: 10-chrome.css's ≤820px `order:1` is not scoped to the
  sheet, and in the view's flex column it pinned Familiars last whatever the saved order.
- **The round is announced from `#cvLive` in the template**, outside `#cvHead`: a live region that is
  replaced on every repaint is never announced.
- **Phone widths**: ≤400px the pill shows swords + number only and tabs are 42px, so the pinned group
  fits beside six tabs at 360px; ≤480px the header's spacer becomes a full-width row break, giving
  two rows with End at the far right of row 2.
- **"Is this card showing?" is `cvCardShown()`, computed style** — not the inline style (the view's
  CSS overrides `#activeSpellCard`'s inline `display:none`) and not `offsetParent` (`fillCombatView()`
  runs before the view is shown). The empty hint and the drag both use it; a drag hops a hidden card
  along with the next shown one, since its zero height can never be passed.
- **A drag also ends on `lostpointercapture`, heard on the DOCUMENT**: if the grip is detached
  mid-drag the browser fires it there, not at the grip, and pointerup never arrives. It follows every
  normal pointerup too, so `done` is guarded against running twice.
- **The grip's hit box is 40×40** from padding cancelled by negative margins, so the glyph and the
  heading height do not move; its left edge sits exactly on the card's edge.

## Combat view: Undo on removal

Closes the gap the combat-view entry left open: Active Spells and Familiars hide themselves on their
tab when empty, so once removed from the view their toggle was unreachable until they had content.
Removing any section now toasts an **Undo** that reinserts it at its old index
(`insertCombatSection`, pure and tested) and, with the view open, re-lays the cards in that order.

- **`toast(msg, action)` gained an optional `{label, run}`.** The other three callers are unchanged.
  With an action the toast stays 6 s, and re-arms a second at a time while it is hovered or its button
  has focus — `hideToast(true)` is the only immediate close.
- **A hidden toast is `visibility:hidden`, flipped only after the fade** (`visibility 0s .18s`). Before,
  hidden meant `opacity:0` alone, which left an Undo button tabbable and clickable while invisible.
  The toast itself stays `pointer-events:none`; only its button takes the pointer.
- **`role="status"` on the toast**, so screen readers announce every toast now — they never did.
- **The Undo carries the character id** it was shown for and does nothing after a character switch.

## Combat view follow-ups, and focus for the general modal

The four items parked after the combat view merged, all fixed on `feat/combat-view-undo`:

- **↑/↓ past hidden sections.** `stepCombatSection(list, k, delta, shown)` (pure, tested) moves past
  the next shown section and any hidden ones between, which is the order dragging already produced.
  `moveCombatCard` treats a card as hidden only when it sits in the view and computes `display:none`.
- **Header breakpoint 480 → 640px.** Measured, not guessed: the one-row header needs ~610px in combat
  (60px tall from 641px up), and from 481 to 600 it wrapped wherever it ran out of room. The rule that
  stacks the time under the round stays at 480.
- **Keyboard removal lands on the Undo.** `toggleCombatSection(k, viaKey)` — `viaKey` is the click's
  `event.detail === 0` (Enter/Space) — focuses the toast's Undo when the removed card was in the view.
  `toast()` returns that button and takes `action.back()`: Tab or Esc from the Undo hides the toast and
  goes to the grip of the next SHOWN card, recorded before the removal (`cvNeighbours`,
  pure and tested — the saved order can hold a hidden Skills card), else the one before, else ✕. The combat view's
  capture-phase Esc yields while focus is in the toast. A keyboard Undo focuses the restored toggle.
- **The general modal takes focus.** `modalTakeFocus(wasOpen)` / `modalGiveBackFocus()` in
  80-modal-forms.js: on open every other `<body>` child goes inert (the toast stays reachable).
  Focus goes to the first TEXT field on the first screenful with `(pointer:fine)`, else to the dialog
  itself — always the dialog on touch, where a field would raise the on-screen keyboard.
  **`MODAL_FOCUS_FIELDS` must never include `select`** (a test guards it): the item, feature and spell
  forms open on a rules-pack picker, and type-ahead on a focused picker rewrote the whole form with one
  keystroke — "t" turned an edited "My Sword" into a Torch, effects and all. Caught in review.
  On close only the elements the modal inerted are released, and `cvInert(true)` is re-applied if the
  combat view is open; `cvInert(false)` while a dialog is open hands the page to the dialog instead of
  releasing it. Focus returns to the opener if it is still usable; because a Save usually re-renders
  the opener's list right after closing, a `setTimeout 0` looks again by `openerSelector` (its id, else
  its first data-* hook — used only if it matches exactly one element), else ✕ in the combat view.
  `openModal` called while open (a content swap) keeps the original opener. `openModal` must still
  START with `_dismissGuard=null;` — rules-data.js asserts the literal prefix.
- **The toast is in the template** (`<div id="toast" role="status">`), empty from load: a live region
  created and filled in the same moment is not announced. The Undo's focus ring is a real outline.

## Done — a quantity in the item finder (issue #50)

The item form always had a Quantity box; the gap was the rules-pack **item finder**, which added one of
each ticked item. It now has a **Qty** cell in its footer (`#brQty`, between Detail and Cost, item
finder only via `cfg.qtyInput`) that applies to every ticked item, like Origin and Cost do.

- **`addLibraryItems(entries, og, costOverride, qty)`** is the old inline `onAdd` body, lifted out of
  `browseItems()` so the suite can call it. It stacks by name exactly as before, with N for 1: a new
  item is one stack of N, one already carried gains N. The cost stays per item (`inventoryTotal()`
  multiplies by qty), and a weapon still gets ONE linked attack however many are added.
- **`finderQty(v)`**: blank, 0, negative or text → 1; decimals floor; cap 999.
- The Add button reads "Add 2 items ×3" when Qty is above 1; `oninput` on `#brQty` repaints it.
- `foot()`'s comment sits ABOVE the function: rules-data.js asserts `paintGroupBadges();` within 400
  characters of `function foot(){`.
- **A finder redraw keeps the footer.** Filters, a facet chip and Clear all re-render the whole finder;
  `render()` now reads Origin, its detail, Qty and Cost first (`readFoot`) and puts them back after
  (`writeFoot`, which re-runs `syncOrigDet()` before restoring the detail). Only after the first draw —
  `st.drawn` lives in the per-`openBrowse()` state — so a reopened finder still starts clean. Origin
  and Cost had always reset on a redraw; Qty only made it noticeable.
- Ammunition is sold in bundles ("Arrows (20)"), so Qty 2 is two bundles. Unpacking bundles belongs to
  the ammo issues (#6–#8), not here.

## Four small fixes: coins, skills, section heads, search boxes (#48, #56, #51, #49)

- **#48 coins high to low.** `coinKeys()` is display order only (the Coins card and the Adjust coins
  window); `convertCoins()` and the weight maths keep their own lists, and the printout already ran
  PP → CP. It now returns PP GP EP SP CP (D&D) / GP SP CP (Humblewood).
- **#56 Classic skills read down each column.** A two-column grid fills row by row. `.skills` now uses
  `grid-auto-flow:column` with `grid-template-rows:repeat(var(--skill-rows,9),auto)`, and
  `buildSkills()` sets `--skill-rows` to half the list rounded up (guarded, the harness's stub has no
  `style.setProperty`). DOM order is unchanged, so Tab still walks A→Z; under 600px it is one column.
- **#51 one section heading.** `.fghead,.inv-sec-head` share one rule in 20-cards.css — a solid 1.5px
  `var(--line)` rule and an 8px gap — covering Features & Traits, the inventory sections and the
  Attacks card's Favorites/Attacks split. The inventory caret was drawn pointing DOWN, then turned 90°
  more by the shared `.fcaret`, so open sections pointed left; it is now drawn like the Features caret
  and the inventory-only rotation override is gone. `.inv-sec-head` keeps its name: `buildToc()` and
  the `[data-invsec]`/`[data-atksec]` handlers depend on it.
- **#49 a clear button in every search box.** `.searchbox` wraps the input and a `.search-clear`
  button: the Rules tab's glossary and tables filters, and `#brSearch`, which the item, spell and
  feature finders all share. The × shows only while there is text — `:placeholder-shown`, so every box
  using the component must keep a placeholder. The click empties the box and dispatches the same
  `input` event typing sends, so each box's own listener re-runs its filter unchanged.
- Seen while checking, not fixed: at phone width an attack row's name runs into its type label
  behind the to-hit pill, and a feature row's name crowds its source tag. Pre-existing.

## Subclass bugs from 1.7.0 (#58, #59, #60, #61) — app half done, data half waiting on sources

**#58 hit points on level-up.** There was never an HP prompt at any level — `doLevelUp()` only
unlocked the Max box. The report ("the subclass level doesn't prompt") read the subclass modal as
the thing that hid it. Every level-up now carries a synthesized `{type:"hp"}` choice, prepended to
the level's own choices, so it rides the same modal, `gatherChoices()` and `commitChoices()` — which
is what keeps it from being lost when `selectSubclass()` opens a modal of its own. Pure helpers in
56-class.js: `hpFixed` (die/2+1), `hpGain` (dice + CON per level, floor 1 per level), `hpGainText`
(the working shown under the box). The box holds the DICE total only; blank = the fixed value.

- **The lock.** `hpChoice()` records `_wasLocked` BEFORE `doLevelUp()` clears it; the commit puts it
  back only if it was locked. The clear stays as the fallback for a dismissed modal. rules-data.js's
  old "56-class.js touches the lock exactly once" guard now states what it was protecting: seed,
  re-sync and un-seed never touch it, and the only re-lock is the HP step restoring what it found.
- **CON is `abilFinal`, not `modOf(score)`** (`conModNow()`): an ASI lives in an effect, and this
  number is spent once, never re-derived — the `rollHitDie()` argument, not `level1HP()`'s.
- **Multiclassing** (`addClass` when a class already exists) asks for `lvl` levels of the new die.
  The first class at level > 1 is character creation and still asks nothing (unchanged).
- A class with no hit die in the rules gets a bare "hit points gained" box; blank there applies
  nothing and leaves the box unlocked.
- Dismissing with only HP at stake asks a milder question than the picks guard (`hpPending()`),
  because Max is unlocked — the "no way to reopen" wording would be false.

**#59 (app half)** the level-up subclass radios now carry pack + description, as `chooseSubclass()`
already did. **#61** `classChipHTML()` (50-classrace.js) makes the subclass a `linkbtn link` button
with `data-sub-info`, which the click handler matches before `data-info-class`.

**Still open — needs `_conversion-data/` and `.venv` on this machine (Mike is copying them over):**
- **#60 is systemic.** `flatten()` drops `refOptionalfeature` nodes (the `options` block recurses,
  each ref has no `entries` and vanishes), and the `all` (2024) path never reads
  `optionalfeatures.json`. Battle Master maneuvers, Sorcerer Metamagic options and Warlock Eldritch
  Invocation options all end at "…presented in alphabetical order." with nothing after. Agreed fix:
  all three as real "choose N" option choices at their levels (maneuvers 3/7/10/15, metamagic
  2/10/17, invocations per the Warlock table). Changes `data/5e2024/`, so XPHB's `DATA_VERSIONS`
  bump is legitimate this time.
- **#59 data.** Magic Item Hacking (Gadgeteer L14) stops at its table; the rest of it is inside
  Engineer's "Crafty Components", whose real text (the two special components) is missing.
  "Make More With Less" carries the FIZZAR path intro; Fizzar's Arcane Specialization / Elemental
  Overload end in sidebar fragments ("A Fiz Enhan", "zzar's Wearable nced Gauntlets"). The
  Gadgeteer class description is cut off mid-sentence ("Another might build a").
- Seen once the picker showed descriptions: **Scofflaw**'s description ends with its feature table
  run into the prose ("Intimi3rd dating Banter 7th Misdirection…"); **Psi Warrior**'s is only its
  tagline.

**Found while testing, not fixed:** dismissing the choices modal after Add class leaves
`_equipQueue` populated, so the class's starting-equipment picker pops up after the NEXT level-up's
Done. Pre-existing, independent of #58.

## #60 option pickers, and the #59 data half — done

**#60, converter.** `flatten()` dropped every `refOptionalfeature`, and `all` never read
`optionalfeatures.json`. Now `_optfeat_choices()` turns each `optionalfeatureProgression` (a running
TOTAL per level, as a map or a 20-long list) into an `option` choice at every rise, asking for the
rise, from options whose level prerequisite that level meets. Seven places, not three: Battle
Master, Sorcerer, Warlock, Artificer (2024 pack); Arcane Archer, College of Swords (XGE); Rune Knight
(TCE). Decisions that would be easy to undo:

- **Options are INLINED in every choice**, ~150 KB across the packs (classes.json 385 → 552 KB,
  pretty-printed). A shared reference would be ~5× smaller but needs app code and cross-pack
  filtering; inline needs none, and an older app gets the pickers from the re-downloaded pack alone.
- **One printing only** (`_pick_optfeats`): 5e-tools files every edition's maneuvers under MV:B, so
  a 2024 Battle Master would otherwise be offered the 2014 Parry too. A 2014 book with no printing
  of its own falls back to the PHB's (College of Swords' Dueling / Two-Weapon Fighting).
- **`repeatable`** is derived from a "Repeatable" subsection (5e-tools has no flag): four 2024
  invocations. The app's option picker marks anything already on the sheet (matched by feature
  name) as "already yours" — ticked + `data-fixed` for checkboxes, just disabled for radios, where
  a tick would read as this level's pick — except repeatables. `gatherChoices()` now skips
  `:disabled` options, the same as skills.
- The Artificer's Replicate Magic Item infusion brought four tables into the 2024 pack; the TCE
  pack, regenerated with `--avoid-table-names`, now suffixes its copies " (TCE)".
- `_sub_blurb()` skips a `{@i …}` tagline: at 41+ characters eight 2024 taglines passed the >40
  floor and shipped as the whole subclass description.
- **Source dump is 5e-tools v2.36.1** (`_conversion-data/5eTools/`, not `5etools-v2.33.2`). Every
  file written here reproduced byte for byte from it before the change; `glossary`, `items-magic`
  and `spells` (2024) and `spells` (XGE) do NOT (upstream: +Reach, −Cloak of Invisibility, 11 magic
  items, 3 spells), so they were left as shipped. Moving to 2.36.1 is a separate call. dev.sh globs
  `_conversion-data/5etools-*` and will not find `5eTools`.

**#59, extractor.** Nov 2024 packet pages 5 and 10 are BANDED — one section ends part-way down both
columns and the next starts underneath — so column-first reading poured Magic Item Hacking's tail
into Crafty Components and the Engineer's components into Masterpiece. `pt_clips()` reads a page in
`bands` as stacked bands, each left then right, and `pt_reference()` reads through it too (p5 has
three: editorial, class intro, table). Also: a path heading closes a block (Make More With Less had
swallowed the Fizzar intro); Trattatello ≤10pt is furniture (art captions — it also cleaned
Brightfang, Pexian and Corsair text; the core book uses the face at 14–18pt, left alone); the
paths' descriptions are now the packet's own; the core book's four subclass descriptions stop at
their features table (`FEATURES_TABLE_HEADS`, description only — domain-spell tables inside features
share the header); `pt_reference()` drops titles (a split title's second half sat mid-paragraph).
Gate before the change: all three write modes reproduced `data/humblewood/` exactly; after it, the
core verbatim suite is unchanged (129) and every Gadgeteer field is verbatim (36/36, new check).
The master PDF sits flat in `Rulebooks/`; a symlink at `Rulebooks/HumblewoodMaster-V1.04/` gives the
extractor and its test the path they expect.

`subSourceTag()`: a reprint keyed "Psi Warrior (TCE)" was tagged again, "(TCE) (TCE)", in both
subclass pickers.

Still open: Battle Master's Superiority Dice have no tracker and Student of War no picker; a
maneuver can't be swapped from the library, because the 2024 pack ships no `features.json`. Small
in-feature tables (Magic Item Hacking's rarity costs, Spell Emulator's tiers) still read as flat
text.

## Battle Master follow-ups: dice, Student of War, a 2024 options library, the equipment leak

- **Option costs.** 5e-tools `consumes` becomes `cost` on every option (`_optfeat_cost`), in the
  pickers and in the library alike. The singular source name is mapped to the tracker's
  (`_CONSUMES_AS`: Superiority Die → Superiority Dice, Sorcery Point → Sorcery Points), because
  `useFeature()` spends from a resource matched by NAME. `commitChoices()` now passes `cost` into
  `addFeatureFromDef()`; before, a picked option's cost was dropped.
- **Subclass trackers** come from `class-resources.json` keys `"Class/Subclass"` (Battle Master
  Superiority Dice 4/5/6, Arcane Archer's Arcane Shot 2), in both the 2024 converter and
  `supplement`, which now always loads that file. The app always supported `resources` on a
  subclass; nothing had ever supplied them.
- **Student of War** is `_prose_choices()`, keyed (class, subclass, source) and hand-listed like
  FIGHTING_STYLES, because the source carries no data for it: a `skill` choice from the class's
  own level-1 list (read at conversion time) and an `option` over the 17 XPHB artisan's tools.
  The tool lands as a feature, not in the free-text Proficiencies box, so it reverts with the
  subclass.
- **`data/5e2024/features.json`** is new: the 58 XPHB options as library entries, named "D&D 2024
  Options". XPHB only — `pick_2024_preferred` would have backfilled 2014-only invocations. The
  finder shows "Ambush (XPHB)" beside "Ambush (TCE)".
- **`_equipQueue` is gone.** The starting-equipment picker is passed to `runChoices(…, eq)` and on
  to its own Done → `commitChoices(…, eq)`. As a module global it outlived a dismissed Add class
  window and fired after the next level-up's Done. char-update.js spies on `runExtraChoices`
  through the vm context (`ctx`) to prove it.

Remaining: the Superiority Die SIZE (d8 → d10 → d12) is prose, not on the tracker; Rune Knight
runes are per-rune uses, not a pool, and have no tracker.

## 5e-tools v2.36.1, Superiority Die size, Hit Dice back to Rest, the combat view as a tab

**v2.36.1.** `_conversion-data/5etools-v2.36.1` (renamed from `5eTools` so dev.sh's
`5etools-*` glob finds it); CLAUDE.md's gate and README-converter now name it, and the gate passes.
Upstream moved the 2024 **Cloak of Invisibility** from `basicRules2024` to `srd52` alone, so
`pick_2024_preferred` now backfills on EITHER flag. Measured before committing to it: across the
whole 2024 pack that adds only more of the free 2024 subset — 14 XDMG magic items (poisons, Amulet
of the Planes, Mace of Terror), 3 diseases (Cackle Fever, Sewer Plague, Sight Rot), 1 table — and
removes nothing. The rest of the move is upstream correction: +Reach (glossary); 11 magic items
(Horn of Valhalla errata, Crystal Ball reworded, whitespace); Sorcerous Burst, Gust of Wind,
Transport via Plants; XGE Power Word Pain gains Bard. Classes, options, feats, backgrounds, species
and both supplements' subclasses were byte-identical.

**Die size.** A resource may carry `die` (`{byLevel:[sides…]}` or a fixed `8`/`"d8"`), resolved
per level by `resolveResDie()` in syncResources and shown as a badge beside the name (body font —
the heading face set it in small caps, "D10"). Battle Master's comes from class-resources.json.

**Hit Dice → Rest & Recovery** (owner's call, reversing 1.7.0): in Vitals they rode into the
combat view by default, between the player and the hit points. `.hd-box` moved whole, under the
rest buttons; its markup rules (nothing between #hdWrap and .hd-grid) are unchanged.

**Combat view → a tab** (owner's call, after play: the overlay covered the tabs). `#tab-combat` is
`src/html/70-combat.html` (manifest, CLAUDE.md and ADR counts now 7) holding the same `#combatView`,
so every `#combatView …` rule and `closest("#combatView")` still resolves. `selectTab("combat")`
fills it, any other tab empties it first; `enterCombatTab()`/`leaveCombatTab()` carry the scroll
(selectTab itself never scrolls, on purpose) and ✕ / a second tap on the swords return to the tab
it came from (`cvPrevTab`). Removed with the overlay: position:fixed, `html.cv-lock`, `cvInert` and
the modal's re-inert hand-off, `aria-modal`, and the capture-phase Esc — Esc is not how you leave
a tab. The header is sticky at `--cv-top`, the tab bar's MEASURED height (cvStickyTop, on open and
resize); a drag now scrolls the window near the header's bottom edge or the window's. The swords
button takes `.active` (underline, or a ring when it is already the in-combat pill).
The overlay's spec (src/docs/specs/2026-09-24-combat-view-design.md) is historical now.

## The wiki: the reference compiled out of this ledger (2026-09-28)

**This file is now the log; the reference is [src/docs/wiki/](../wiki/index.md).** 38 topic pages
(architecture, features, ui, data, process, roadmap) say how Fieldbook works *now*, each with the
invariants a refactor must keep, the traps that already bit, a Decisions table, and a History whose
lines point back here by L-number. Spec: `src/docs/specs/2026-09-28-living-wiki-design.md`.
Every `##`/`###` section above is cited by at least one page. New entries here get shorter: what
changed and why, and a link to the page that now describes it.

- **Compiled by checking the code, not by trusting this file.** Six agents, one per page group, each
  told the code wins where the ledger disagrees. Later entries supersede earlier ones often enough
  that replaying this log was the problem the wiki exists to fix.
- **It found things.** ~40 discrepancies, triaged into
  [known-issues](../wiki/roadmap/known-issues.md) §"Found while compiling the wiki". The ones that
  matter most: a subclass's level choices are replaced by the starting-equipment picker (Fighter 3 +
  Battle Master never offers maneuvers — reproduced in the harness); class progression tables
  lose their dice/bonus cells (`_cell_text()`), so Barbarian's Rage Damage is blank and Bard/Rogue
  have no Features table; `fetchAllRules()` resets the pool first, discarding file imports; three
  image `src` attributes skip `esc()`; five `setItem` calls still sit in empty `catch`es; the
  template loads Google Fonts. None fixed here — the wiki records them, Mike triages.
- **Mechanical drift check.** `src/tests/docs.js` gained a wiki section: every page listed in
  `index.md`, every link resolves, every `name()` a page cites is defined in `src/js`/`scripts`, every
  fragment it cites is in `manifest.json`, every JS fragment is cited by a topic page, and the
  overview's code map names every fragment. History and Decisions sections (and `decisions.md`) are
  exempt from the existence checks — they legitimately name things that were renamed or rejected.
  Proved by planting a probe page with each defect: all five checks fired. A sixth check: every
  `L<n>` a page cites must be a heading line in this file — so inserting a line near the top of the
  ledger (tried: all 38 pages go red) can't silently re-point every citation. `docs` suite 157 → 349.
- **The `wiki` skill** (`.claude/skills/wiki/SKILL.md`): ingest / query / lint, the page template,
  and the contract the test enforces. **`.gitignore` was `.claude/`, which made a tracked skill
  impossible** — the trailing-slash form stops git descending, so no `!` rule can re-include
  anything. Now `.claude/*` + `!.claude/skills/`; worktrees, `qa/` and `settings.local.json` stay
  ignored (checked with `git check-ignore`), and `build.sh`'s `^\.` ban keeps it out of the zip.
- **CLAUDE.md 422 → ~155 lines.** Rules and conventions only; the reference moved to pages, and it
  imports the index with `@src/docs/wiki/index.md`. Every paragraph that left was checked to exist on
  a page first (one gap found and filled: Humblewood content folds into the consolidated files). The
  stale claims it carried (two zips, four packs, `git commit -am`, "humblewood-verbatim adds 129")
  went with it. RELEASING.md's "both zips" and two-pack attachment table fixed.
- `index.md` is `merge=union` like this file; pages are not — two branches rewriting one paragraph
  must conflict. **Consequence for worktrees:** a union merge appends a branch's entry here after
  whatever `main` added meanwhile, so its heading moves and that branch's History citations go
  stale. The L-number check fails on it; re-point in the merge commit (skill, CLAUDE.md, WORKTREES §4).
- **Skill test** (writing-skills' RED/GREEN, one scenario, two fresh subagents): wrap up "starred
  items now show in Favorites *and* their own section, #71" without touching the repo. With only the
  new CLAUDE.md, the agent already found all three affected pages, flipped the Decisions row and
  the register, and wrote the ledger entry and UNRELEASED bullet — the CLAUDE.md rule plus
  self-describing pages do most of the work. With the skill it also caught two stale code comments
  and one History line the baseline missed. Both hit the same real flaw: the skill said "ledger
  entry last", but History cites its line number, so it has to come first. Fixed in the skill,
  CLAUDE.md and the index header.
- Dev docs only: no app change, no UNRELEASED bullet, no rebuild.

## Class progression tables keep their dice and bonus cells (#64, 2026-09-28)

**Root cause.** 5e-tools writes some `classTableGroups` cells as typed objects, and `_cell_text()`
rendered strings, numbers, `roll` and `entry`/`entries` only; anything else came back `''`,
silently. Scanned from the v2.36.1 dump, every table the converter reads uses exactly three such
shapes, all in class tables: `{"type":"bonus"}` (Rage Damage), `{"type":"bonusSpeed"}` (Unarmored
Movement, `0` at Monk level 1) and `{"type":"dice","toRoll":[{number,faces}]}` (Martial Arts,
Bardic Die, Sneak Attack). **Bard and Rogue were dropped, not blanked**: once the spell columns are
skipped, a dice column is all they have, so `_class_tables()`'s guard against a Level-only table
suppressed them. `converter.py` passed because its synthetic Barbarian wrote Rage Damage as `'+2'`.
Wrong since tables first shipped (888c4be).

**Fix.** `_cell_text()` renders them the way the book prints them: `+2`, `1d6`/`10d6`
(`_dice_text()`), `+10 ft.`, and `—` for a speed bonus of 0. A dict cell it still cannot read is
counted in `_CELL_MISSES` and reported as a `WARNING` by `all`, `supplement` and `--tables`
(`_cell_miss_warnings()`), so the next new shape cannot hide the same way.

**Data.** `data/5e2024/tables.json` only: 105 → 107 tables (+Bard Features, +Rogue Features, 20 rows
each) and 60 blank cells filled (Barbarian Rage Damage, Monk Martial Arts and Unarmored Movement,
20 each). No non-blank cell and no other table moved; every other 5e2024 file, and Xanathar's and
Tasha's in full, regenerate byte for byte (they convert no class progression table). A data
change, so no UNRELEASED bullet; the release bumps 5e2024's `DATA_VERSIONS` itself.

**Guards.** `converter.py` now builds Barbarian, Monk, Bard and Rogue tables from cells copied out
of the dump. `tables.js` asserts, for every pack, that no column is blank in every row (only these
two tables ever were), and pins the 2024 values: eleven Features tables (Wizard has none), Rage
Damage +2/+3/+4, Martial Arts 1d6…1d12, Unarmored Movement —/+10 ft.…+30 ft., Bardic Die, Sneak
Attack 1d6…10d6. Pages: [converter](../wiki/data/converter.md),
[rules & tables](../wiki/features/rules-and-tables.md).

**Seen, not fixed** (separate causes): subclasses carry `subclassTableGroups`, not
`classTableGroups`, so `_class_tables()` on a subclass is a no-op — harmless today (the XPHB groups
are spell columns it would skip, or Psi Warrior/Soulknife die data their prose "Energy Dice" tables
already carry), but it would not pick up a new one. And `flatten()` drops
`abilityDc`/`abilityAttackMod` prose nodes, so Xanathar's "your Arcane Shot save DC is calculated
as follows:" ends with nothing.
## Fetch all no longer discards imported packs or empties the cache (#65, 2026-09-28)

**Root cause.** `fetchAllRules()` called `resetRules()` *before* fetching, with no confirmation, so
every pack imported from a file was gone the moment the button was pressed; its `catch` then ran
`saveRulesCache()` on whatever that run had loaded. Reproduced in a browser on main: the 5e2024
pack imported from a file (15 classes, 551 spells, 251 tables), one unreachable source URL, Fetch
all → 0 classes, 0 spells, 0 tables, the empty pool cached for the next launch, and the status line
reading "Couldn't finish (Failed to fetch). Kept what loaded…" directly above "No rules data
loaded." The Settings "Rules data" header still said 2151 entries: `openSettings()` draws that chip
once and nothing refreshed it.

**The contract now** ([Rules packs](../wiki/architecture/rules-packs.md),
[Settings & updates](../wiki/features/settings-and-updates.md)):

- **Fetching never loses what is loaded.** Every source is fetched in full (its `include`s too)
  before anything merges. `fetchRulesFrom()` now collects packs instead of merging them.
- **Where an entry came from is stamped on it.** `mergeRules(obj, fileName, url)` adds `_url` (the
  source URL from Settings, not an include under it) the way it adds `_file`, and clears any stray
  `_file`/`_url` the pack itself carried, so a file can never be deleted by some later fetch.
- **A source that arrives whole replaces what it loaded last time** (`applyFetchedSource()`): merge
  first, so an entry it still serves is replaced in place and never doubled, then drop that source's
  old entries the merge did not replace, so one it stopped serving goes. Nothing else is touched.
  Its `requires` declaration follows its fresh copy unless a file import shares the label.
- **A source that fails in any part keeps its previous packs.** A manifest is one source: one 404
  include keeps the whole pack as it was. An answer with no rules in it (`{}`, an error object)
  counts as a failure, not as "this source now serves nothing".
- **A run where nothing arrives changes neither the pool nor the cache**, and the status line says
  "…so nothing changed", names each failed file, and suggests importing files.
- **The cache write is reported on the status line** when it is refused, not only in the red line
  above the list. A fully failed run does not write at all, since the pool did not change.
- **The Rules data chip follows the pool**: `renderRulesData()`, which every path that changes the
  pool already calls, now refreshes it through `rulesBadge()`.
- No new network behaviour: still only on the button, still `cache:"no-store"`, still in order; a
  source listed twice, or a file two sources both include, is still fetched once.

Other changes on the way: `pruneRequires()` is shared by `removeRulesGroup()` and the fetch; every
fetch error names its file ("b.json: HTTP 404", "offline-pack.json: Failed to fetch", "not a rules
file" for a `null` or array body, which used to throw inside `mergeRules()`); the sources hint no
longer claims rules are "Fetched when online", which suggested a fetch nobody makes.

**Behaviour change to know about:** removing a URL from the sources list no longer unloads its
packs at the next Fetch all (the reset used to). Unload them in Loaded data. A fetched pack whose
`system` and entry names match a file-imported one replaces those entries, as re-importing the file
would — same source and name is the same entry.

Tests: `rules-data.js` gained a Fetch all block, the suite's first asynchronous one (it runs last and
calls `ck.done()` itself): 49 checks, 29 of which failed before the fix, and each new guard was
mutation-checked (removing it turns a check red). Entries fetched before this change carry no
`_url`; a re-fetch still replaces them by name, and only an entry the source has since dropped
lingers, removable from Loaded data.
## Choice windows open one at a time: a subclass's picks before the equipment picker (#63, 2026-09-28)

**The bug.** Add a Fighter at level 3 and pick Battle Master: Maneuvers and Student of War were never
offered. The class window's Done ran `commitChoices()`, which opened the subclass's own window
(`selectSubclass()` → `runChoices()`) and then, in the same step, `runExtraChoices()` for feat skill
choices and the starting-equipment picker. There is one modal, so `openModal()` replaced the subclass
window and cleared its guard. Every 2024 class has an equipment choice, so any class added at or
above its subclass level with a choice-bearing subclass lost those picks. The feat-plus-subclass
race recorded under "Known minor limitations" was the same bug.

**Root cause: sequencing.** Two windows opened at once. Removing `_equipQueue` handed the equipment
picker to the class window's Done, and that Done then opened both.

**Fix: one window at a time. What waits behind a window travels with it.** `pending` (the shape
`runExtraChoices()` takes: equipment pickers and feat skill choices) goes `runChoices(…, pending)` →
its Done → `commitChoices(…, pending)` → if a subclass was picked, `selectSubclass(…, next)` →
`runChoices(…, next)`, else `runExtraChoices(next)`. `runChoices()` with nothing to show passes the
queue straight on (Champion at 3), so `addClass()` lost its own `else`.

**Dismissing.** `setDismissGuard(fn, then)`: `then` is what a dismissed window hands on, and
`dismissModal()` runs it after `closeModal()`. Every `openModal()`/`closeModal()` clears it with the
guard, so it lives exactly as long as its window, and no module global comes back. Decision: a
dismissed choice window still hands its queue on. That costs the window's own picks (the guard says
so), not the gear of a class that is already on the sheet. Rejected: dropping the queue with the
window, as the L3649 comment said. A notes-only subclass window arms no warning, so Escape would have
cost the class its equipment without a word. Dismissing the Add-class window now also still offers
the equipment picker.

**Tests.** `char-update.js` drives the real 2024 Fighter through the real flow. The only doubles are
the ones the stubbed DOM forces: the picks (`gatherChoices`) and the Done buttons. `openModal` is
recorded and still runs. The checks cover the window order, the subclass picks landing as Battle
Master's, a subclass with no picks going straight on, dismissal handing on, a replaced window not
leaking its queue, and a feat and a subclass at one level. 5 failed before the fix, and each part of
the fix was mutation-tested. `rules-data.js`'s arm-count regex now allows the argument.

Pages: [character building](../wiki/features/character-building.md),
[grants & provenance](../wiki/architecture/grants-and-provenance.md), [shell](../wiki/ui/shell.md),
[2.0](../wiki/roadmap/2.0.md), [testing](../wiki/process/testing.md); `decisions.md`. Known issues are reconciled
at merge.
## A second class grants no saving throws or starting equipment (#66, 2026-09-28)

- **Root cause.** `addClass()` treated every add as character creation: it granted the class's
  `savingThrows`, applied its `equipmentGrants` (items and gold) and offered its full level-1 skill
  choice whether or not a class was already on the sheet. The 2024 multiclassing rules give a second
  class none of those — only the subset in the PHB's multiclass table. The HP path already told the
  two apart (`seedLevel1HP()` needed exactly one class; a second class got the #58 HP step), so the
  level-1 seed was never re-applied from the second die.
- **The rule now.** The first class is the add made while `character.classes` is empty. Only it
  grants saving throws (`grantClassSaves()`), fixed class `skills`, and starting equipment and gold.
  A multiclass add still gets every level-1 feature, spell note and non-skill choice (a Fighter's
  Fighting Style, a Warlock's invocation), but its class-level-1 `skill` choice is replaced by the
  pack's `multiclass.choices` (`multiclassChoices()`), and the window opens with a note
  (`multiclassNote()`): no saves or equipment, and what it gains — the `multiclass.proficiencies`
  text plus the skill count. The Add class preview shows the same note once a class is on the sheet.
  A class with no `multiclass` block is not guessed at: no class skills, and the note says the pack
  does not list them.
- **The data exists.** Every 5e-tools XPHB class carries `multiclassing.proficienciesGained` (Monk,
  Sorcerer and Wizard as `{}`). `convert.py` `_multiclass()` turns it into an optional per-class
  `multiclass` block — skills as a §5 skill choice, armor/weapon/tool training as one display string
  — documented in rules-schema §6.3 and README-converter. Byte gate: the HEAD converter reproduces
  `data/5e2024/` exactly; the new one differs only in `classes.json`, only by that key (checked key by
  key, key order of everything else unchanged). Bard, Ranger, Rogue: one skill; Monk, Sorcerer,
  Wizard: `{}`. The pack's Artificer is the TCE printing, so it carries TCE's 2014 row (Thieves' and
  Tinker's tools, no skill); the UA Mystic has none. XPHB's `DATA_VERSIONS` will move at the next
  release, correctly: an old pack degrades to the "does not list" note.
- **Humblewood.** The Gadgeteer has no `multiclass` block, and none of the 30 Humblewood PDFs in
  `_conversion-data/Rulebooks` mentions multiclassing (searched with PyMuPDF). A multiclass Gadgeteer
  therefore gets no class skills and the note. Its level-1 "Proficiencies" trait still lists its
  saving throws as prose, as it does for a first-class Gadgeteer.
- **Removing the first class while another remains.** The class now first takes its own saving
  throws, tagged to its sid so they leave with it, and a toast says so; its first-class skills and
  starting equipment are not re-offered. Without this, a Fighter/Wizard who dropped Fighter had no
  save proficiencies at all. An owner call: the alternative is to leave the saves off and only say so.
- **Separately — not a multiclass bug: a first class added above level 1 got no hit points.** Found
  by the coordinator in a browser (Add Fighter at starting level 3 → Max and Current blank).
  `seedLevel1HP()` stopped at total level 1, and nothing asked for levels 2..N. The seed now fires
  for the first class at any starting level (still only over a blank Max), and the window opens with
  the #58 HP step for levels 2..N — average by default, a typed roll, or Roll for me — carrying a
  `hint` that level 1 is already counted. A Max the player typed before adding gets neither.
  `removeClass()`'s un-seed is unchanged (level 1 only), so a first class added at level 3 and then
  removed keeps its Max — as a levelled-up one always has.
- **Existing saves are untouched.** `migrate()` is not changed: a multiclass character saved before
  this keeps the saving throws, skills and equipment its second class granted, and removing that
  class still reverts them (they carry its sid). The fix changes what a NEW add does.
- Tests: `char-update.js` 260 → 305, run against the real `data/5e2024/classes.json` (Fighter then
  Wizard, Rogue, Bard; Wizard then Fighter; a fixture class with no `multiclass` and a fixed
  equipment block; first-class removal; a first class at level 3 at CON 10 and 14, and over a typed
  Max). The old "starting above level 1 does not seed HP" check asserted the HP bug and was
  inverted. `converter.py` 143 → 148.
- Pages: [character building](../wiki/features/character-building.md),
  [grants & provenance](../wiki/architecture/grants-and-provenance.md),
  [vitals & rest](../wiki/features/vitals-and-rest.md), [converter](../wiki/data/converter.md),
  [decisions](../wiki/decisions.md).
## Escaping image sources and every attribute value that comes from a file (2026-09-28)

**The report.** Three `<img src>` values went into innerHTML unescaped: `character.portraitImg`
(`renderPortrait()`), a keyword's `image` (`openGlossView()`), and the glossary form's preview,
both for a stored image and just after a file is picked (`openGlossForm()`). A character file or a
rules pack could close the attribute and add a handler. Page: [Rich text](../wiki/architecture/rich-text.md).

**The audit** covered every `${…}` in every `src/js` template literal and every innerHTML /
outerHTML / insertAdjacentHTML sink, asking where each value comes from: a character file, a rules
pack, a settings file (Settings → Import assigns `rules` wholesale, keyword ids included), the
network, or app constants. 353 interpolations sit inside quoted attribute values, 175 of them raw.
The ones fed from outside, all fixed:
- character file: list-item ids in `data-*` hooks (features, items, statuses, familiars, attacks and
  their `spellId`, spells, active spells, resources, glossary); a glossary id in `data-gid`
  (`highlight()`, `statusTitle()`); an item's structured `armor.dexCap` in the item editor; an
  active spell's `level`; a cantrip's `level` in `promptSpellAttack()` (not reachable once
  `renderSpells()` has rewritten `s.level` to a number, fixed anyway); slot totals on the print
  sheet (they survive `autoSlots()` only with a spellcasting ability and no caster class).
- rules pack: `abilityChoice.eligible` and `abilityScores` keys (Add ancestry, the ancestry window),
  a background's `abilityScores` (Add background, the background window), a class's `hitDie` (all
  three Hit Dice styles, attributes and text), the pack `name` in the Settings status line.
- network: the update link was already escaped; it now takes only a `https://github.com/` page.

**Image scheme.** `safeImgSrc()` (00-constants.js) passes data: URLs only, and `imgHTML()` is the one
place an `<img>` is built from data. Nothing legitimate is refused: portraits and glossary images are
only ever written by `FileReader.readAsDataURL`, rules-schema §6.1 documents `image` as a data URL,
and no shipped pack has an image at all. A web address is refused too, because it would be a network
request beyond the rules fetch and the update check. Any media type passes (FileReader writes
`application/octet-stream` for an untyped file). A refused portrait shows the placeholder; a refused
glossary image says it isn't stored in the file.

**The guard.** `rules-data.js` scans `src/js` with a small tokenizer (strings, comments, regex
literals, nested templates) and requires every `${…}` inside a quoted attribute value to be `esc(…)`
of the whole expression or a ternary whose results are literals; CSS attribute selectors are skipped,
unquoted interpolation is refused, and every `src` must be `esc(safeImgSrc(…))`. The rule is total on
purpose: which values are untrusted is not visible to a regex. 167 sites were wrapped mechanically;
most are constants, where `esc()` is the identity. `sheet.js` covers what the scan cannot see (text
between tags, markup emitted in tag position): getElementById/createElement return recorders that
log every HTML write, and a hostile character, pack and keyword id go through 40 renderers and
editors, each asserted to run, to show the payload escaped, and never to emit it raw. 43 of those
checks failed before the fix; each of the 11 text-content fixes was reverted in turn and caught.

Noticed, not changed: `runChoices()` still double-escapes its modal title (known issue); a portrait
is still stored at full size.

## A first-class Bard chooses its three skills (#67, 2026-09-28)

- **Root cause.** The 2024 Bard's `startingProficiencies.skills` is `[{"any": 3}]`: three skills of
  the player's choice from all 18. `convert_classes()` read that list itself and knew only
  `{"choose": …}` and bare names, so it dropped the entry without a word. `data/5e2024/classes.json`
  shipped the Bard with no level-1 `skill` choice and no fixed `skills`, and `addClass()` had nothing
  to offer a first-class Bard. The app was never wrong: it offers whatever level-1 choices a class
  carries. Found while compiling the wiki (known-issues, citing L3886).
- **One reader.** `_skill_profs()` in `convert.py` now reads every 5e-tools skill-proficiency list:
  a bare name or `{"perception": true}` is fixed, `choose` picks `count` from its list, `any` picks N
  from all 18 skills (alphabetical, as the species' "any" always was), and anything else comes back
  for the caller to warn about. The species reader (`_race_skills()`, which already understood `any`)
  is now a wrapper over it; the class's starting skills and `_multiclass()` call it too, so a shape
  understood in one place is understood in all three. An unread starting-skill entry is now a
  `note:` line; a multiclass one already was, and still is for a fixed skill, which that block
  cannot carry.
- **Every "any" entry.** The v2.36.1 dump's class files hold 30 class entries, 27 with starting
  skills (the three TCE sidekicks have none). Only the Bard uses `any` (PHB and XPHB, both
  `{"any": 3}`); the other 25 are a `choose`, and all 7 `multiclassing` skill entries are too. The core pack takes the XPHB Bard. Neither supplement emits
  classes: Xanathar's prints none and Tasha's skips the Artificer. Humblewood's Gadgeteer (choose 4
  of 8) is extracted, not converted.
- **Byte gate.** HEAD's converter reproduces `data/5e2024/` exactly; the new one differs only in
  `classes.json`, by one hunk: the Bard's `levels["1"].choices`, a `skill` choice of 3 from the 18.
  `data/xanathars/` and `data/tashas/` regenerate byte for byte (Tasha's `races.json` goes through
  the shared reader unchanged). XPHB's `DATA_VERSIONS` will move at the next release, correctly: a
  player on the old pack keeps a Bard with no skill picks until they re-download it.
- **Multiclassing is unchanged.** A Bard added beside another class still gets its `multiclass`
  choice (one of 18) in place of the new level-1 three, because `addClass()` drops a class's own
  level-1 `skill` choice on a multiclass add.
- **Not changed, noticed.** No class in the pack carries its first-class armor, weapon or tool
  training (the Bard's three Musical Instruments, a Fighter's heavy armor): `convert_classes()` reads
  only `skills` from `startingProficiencies`, and nothing else writes it. Character building and
  grants & provenance say the first class's training "is only in its data"; it is in no data at all.
- Tests: `converter.py` 165 → 173 (the real Bard shape; the species and multiclass readings agree;
  an unknown entry is a note), `char-update.js` 319 → 327 (the real pack: a first-class Bard offers
  choose 3 of 18, grants them to `class:Bard` and reverts them; a multiclass Bard still one),
  `rules-data.js` 594 → 599 (every class in every pack starts with skills, fixed or chosen, each a
  skill the sheet knows). Eleven failed before the fix. Data-only for players: no UNRELEASED note.
- Pages: [converter](../wiki/data/converter.md),
  [character building](../wiki/features/character-building.md), [decisions](../wiki/decisions.md).
## Formula lines, one-entry list items and embedded stat blocks kept in rules text (#68, 2026-09-28)

**Root cause.** `flatten()` had a branch for each 5e-tools node type it knew and fell through
anything else with no output and no word. Instrumented over all three runs (core `all`, XGE and
TCE `supplement`), four types reached it and were dropped, 28 nodes in all:

- `abilityDc` (3) and `abilityAttackMod` (2): the core pack's Artificer (its TCE printing) lost its
  spell save DC and spell attack modifier, the UA Mystic its discipline DC and attack modifier, and
  Xanathar's Arcane Archer read "your Arcane Shot save DC is calculated as follows:" and stopped.
- `item` with a singular `entry` in place of `entries` (22): the core pack's Cackle Fever and Sewer
  Plague symptoms; in Tasha's, Customizing Your Origin's seven traits, Luba's Tarokka of Souls'
  Weal and Woe, Path of the Beast's Bite, Claws and Tail, College of Creation's three mote
  effects, and Circle of Stars' Weal (even) and Woe (odd).
- `statblock` (1): the 2024 Soulknife's Psychic Blades says "The magic blade has the following
  traits:", and the traits are an item embedded by reference.

`image` (3, Xanathar's) is skipped on purpose and stays skipped: it carries no rules text.

**Fix.** Formula lines are worded as 5e-tools' renderer words them (`_formula_text()`,
`_attr_choose()`): [book text: the Spellcasting save-DC formula line],
"Maneuver save DC = … your Strength or Dexterity modifier (your choice)", with `abilityGeneric`
alongside. Checked against its current `render.js` and `parser.js` (fetched): `_renderAbilityDc`
has two wordings picked by the reader's style switcher, the "classic" one above and "8 +
Intelligence modifier + Proficiency Bonus". Every source that uses these nodes in the files the
converter reads is PHB, XGE, TCE or UA, never XPHB, and those books print the classic wording.
Each formula ends with a full stop, because a named subsection's blocks join with spaces and the
Artificer's two lines otherwise ran together. An `entry` reads as `entries: [entry]`, the same
"Name: text" as its `entries` twin. An item `statblock` resolves through `load_item_index()` over
`items-base.json` and `items.json`, which `all` and `supplement` find themselves, and renders as
[book text: the Psychic Blade statblock, rendered as a base-weapon stat line], the wording
`convert_items()` gives a base weapon. An unresolved one
keeps its name and is counted. Any other node type is counted in `_ENTRY_MISSES`, and
`_entry_miss_warnings()` reports it at the end of `all`, `supplement` and every single subcommand,
since prose is flattened with or without `--tables`. A single `classes` run has no item files, so
it warns once for the Soulknife's statblock. Page: [converter](../wiki/data/converter.md).

**Data.** Pure insertions, checked string by string: identical structure, and every changed string
differs from the committed one only by inserted text. Core `classes.json` (Artificer, Mystic,
Rogue → Soulknife) and `conditions.json` (Cackle Fever, Sewer Plague); Xanathar's
`subclasses.json` (Arcane Archer); Tasha's `glossary.json` (Customizing Your Origin),
`items-magic.json` (Luba's Tarokka of Souls) and `subclasses.json` (Path of the Beast, College of
Creation, Circle of Stars). Every other file of the three packs regenerates byte for byte, and no
run prints a WARNING. A data-only change, so no UNRELEASED bullet. The 5e2024, XGE and TCE
`DATA_VERSIONS` all move at the next release, correctly.

**Guards.** `converter.py` 165 → 191: node shapes copied from the dump (Arcane Shot, the Artificer's
Spellcasting Ability, the Battle Master's two attributes, Cackle Fever, the Psychic Blade node,
item and properties), `abilityGeneric` from `book-xdmg.json` and `renderdemo.json`, an unknown type
counted and warned, and the WARNING printed by a single subcommand, `all` and `supplement` run on a
two-file dump. `rules-data.js` 594 → 606: one pin per dropped shape in the shipped packs.

**Seen, not fixed** (separate causes):

- `convert_items()` reads property names from the file it converts, and only `items-base.json`
  has the `itemProperty` table. So 28 magic weapons (20 core, 5 Tasha's, 3 Xanathar's) print
  abbreviations ("Properties: F, L, T" on the Dagger of Venom). Since "Finesse" is then never in
  the list, a finesse magic weapon gets `weapon.ability: "str"` where its base weapon has
  `"finesse"`. The shipped Psychic Blade item also prints its `{uid, note}` mastery as
  "{'uid': 'Vex".
- `_norm_table()` drops a table's `footnotes`: 17 Xanathar's downtime tables whose rows carry a
  `*` pointing at "Might involve a rival" or "Halved for a consumable item".
## Choice windows name the levels they hold, and titles show names as written (#69, 2026-09-28)

**The bug, two halves.** (1) `runChoices()` titled every choice window `<class> — Level <n>` with
`n` the FIRST choice's `_level`, falling back to the class's level. One window can hold several
levels, so the title named whichever block happened to lead: a Fighter added at 3 opened as "Level 3"
(the #66 HP step leads, and carries level 3) over picks running from the level-1 skills to the
level-3 subclass, and as "Level 1" whenever a level-1 choice led. A multiclass Wizard added at 3 said
"Level 3" over an HP step for levels 1–3; Change subclass at 10 said "Level 3" over maneuvers from
3, 7 and 10. (2) It passed the class name through `esc()`, but `openModal()` sets the title as
`textContent`, so `&` and `'` showed as `&amp;` and `&#39;`.

**Root causes.** (1) The title came from one element, not from the window's contents, and spell notes
carried no level at all. (2) A contract mismatch: `openModal()` has always written the title as text
(its comment said so), and this one caller escaped as if it were markup. The audit found it was the
only one: all 52 `openModal()` calls were read; 51 pass plain text (names included: `name`, `d.name`,
`subName`, `sp.name`, `g.term`, `t.name`, `featPickName()`, `noteTitle()`, …), which is right.

**Fix.** `choiceWindowTitle(className, choices, notes)` in `58-choices.js`, pure: the span of the
`_level`s its choices and notes carry, an HP step covering `levels` levels ending at its own (2..N for
a first class above level 1, 1..N for a multiclass). One level → "Fighter — Level 4"; several →
"Fighter — Levels 1–3" (en dash). Nothing with a level → the class name alone, rather than a guessed
level. `applyClassLevel()` and `selectSubclass()` now push spell notes as `{text, _level}`
(`choiceNoteText()` reads either shape; `multiclassNote()` stays a plain string, since it is about the
class, not a level). The title is passed unescaped. So every caller gets a correct title from the same
rule: `addClass()` at 1 and above, `doLevelUp()`, `selectSubclass()`'s own window, multiclass adds.

**The contract, settled: modal titles are plain text.** `openModal()`'s comment now says so: the title
is `textContent`, callers pass names as written and never `esc()` them; `html` is the markup half and
callers escape it. Rejected: switching the title to `innerHTML` with callers escaping. It would mean
escaping 51 correct call sites for a header that never needs markup, and any one that forgot would
be an injection point. The attribute-escaping guard is untouched: titles are not attributes.

**Tests.** `char-update.js` +18: the real 2024 pack through the real flow with `#mTitle` replaced by a
recorder (what the player reads, decoded if it were ever markup): Fighter at 3 → "Levels 1–3", then
Battle Master's window → "Level 3"; level-ups 3→4 and 2→3; Change subclass to Battle Master at 10 →
"Levels 3–10"; multiclass Wizard at 3 and at 1; Bard at 3 (its level-1 spell note counts) and at 1
(notes only); a class named `Tom & Jerry's <Brawler>` shown as written and written as text; six on
the pure helper. 11 failed before the fix. `rules-data.js` +4: a scanner reads every `openModal()`
call's first argument (strings and templates skipped whole) and refuses `esc(` or an entity in it,
and pins the `textContent` assignment; it failed on `58-choices.js` before the fix. Mutation-checked:
untagged notes fail the Bard pair; re-adding `esc()` fails both suites.

Noticed, not changed: the subclass's own window carries the class name ("Fighter — Level 3") like the
class window before it, so two windows in a row can share a title. Naming the subclass there would
need a display name separate from the `className` the flow keys on.

Pages: [character building](../wiki/features/character-building.md), [shell](../wiki/ui/shell.md),
[rich text](../wiki/architecture/rich-text.md); `decisions.md`. Known issues are reconciled at merge.
## Import settings asks before replacing loaded rules (#70, 2026-09-28)

**Root cause.** Settings → Characters & backup → Import settings read the file and ran
`rules=p.rules` whenever the file had a `rules` object. It asked nothing and checked nothing, so every
pack imported or fetched since the export vanished without a word, and the empty or older pool was
cached for the next launch. Reproduced in a browser on main: with the 2024 pack loaded (15 classes,
391 spells, 136 keywords), importing `{"_type":"fieldbook-settings","settings":{"skin":"classic"},
"rules":{"keywords":[{"name":"Settings-file term","desc":"…"}]}}` left 0 classes, 0 spells and 1
keyword, with no dialog. That keyword has `name` where `term` belongs, and it went in raw, so
`highlight()` threw on every render after (the term-less keyword itself is #71, fixed separately).
Pages: [Settings & updates](../wiki/features/settings-and-updates.md),
[Rules packs](../wiki/architecture/rules-packs.md), [Storage](../wiki/architecture/storage.md).

**What a settings file carries.** Export settings has always written `{_type:"fieldbook-settings",
settings, rules}` (unchanged since the first commit): the whole `settings` object and the whole
merged pool as it stood that day, every entry stamped with `_id`, `_source`, `_file` or `_url`,
`_rulebook`, `_dataVersion` and `_excludeSystems`, plus `name`, `version`, `requires`, and `_dups`,
whose Sets serialise to `{}`. Older pools lack `_url`, `requires`, `tables`, `backgrounds` and
`subclasses`. Before the wrapper a settings file was the bare settings object, which may still
carry the first builds' single `rulesUrl`.

**The flow now.**
- `readSettingsFile()` sorts the file into settings and rules. A bare object must carry at least
  one known settings key (`SETTINGS_KEYS`), so a rules pack or character chosen by mistake is
  refused instead of being written into `settings` key by key. JSON that won't parse, and a file
  with neither usable settings nor usable rules, get "Not a valid settings file."
- **The rules go through `mergeRules()`**: `poolFromExport()` (89-rules-merge.js) rebuilds the
  saved pool on a scratch pool, one run of consecutive same-provenance entries at a time, handing
  each entry's stamps back in as the pack fields `mergeRules()` reads. Keywords get fresh ids,
  duplicates collapse, `_id`/`_dups` are rebuilt, and non-arrays and entries with no name are dropped.
  Provenance, `requires` and the order within each category come back exactly: all five shipped
  packs (2162 entries) round-trip entry for entry, in 14 ms. Only non-objects are filtered before the
  merge, so whatever `mergeRules()` learns to read (#71), settings files get too. The live pool is
  swapped out only for that synchronous call and put back in a `finally`.
- **The question** (`askSettingsImport()`), only when the file carries readable rules *and* some are
  loaded. It is a window with three answers, like the character-import clash: **Cancel** (nothing
  changes, back to Settings; ✕ and Escape do the same), **Keep my rules** (settings only, primary),
  **Replace my rules** (danger). It shows both sides as "N packs, M entries" with each pack's count
  and data version, then in red what replacing loses: every loaded pack the file does not have, and
  any it would put back an older copy of (`cmpVer()`). It says characters are not affected.
- No rules in the file (no key, an empty pool, or nothing readable): the settings import, the pool
  and the cache are untouched, and nothing is asked. Nothing loaded yet: the file's rules load
  without a question, since nothing can be lost.
- `finishSettingsImport()` applies the answer, saves, and redraws what loading the cache at boot
  redraws (`refreshRulesUI()`, `renderAll()`, `renderHome()`), then reopens Settings. That brings a
  fresh rules status line, the Rules data chip and the loaded-data list. It writes what happened on a
  new status line beside the Import button (`#setImpStatus`), because the rules status line lives in
  the Rules data section, which is usually folded shut.
- **Both writes report a refusal there.** `saveSettings()` now returns `storageWhy()` (callers that
  ignore it are unchanged), giving "Settings imported for this session only: your browser's storage
  is full…". The cache write's error is appended when `saveRulesCache()` settles.
- `foldLegacySettings()` holds what boot did inline (`rulesSources` forced to an array, `rulesUrl`
  folded into it), so an imported old file arrives in the same shape. `boot()` calls it.

**Why a window, not `confirm()`.** There are three outcomes. OK/Cancel can only carry two, and
making Cancel mean "import the settings but keep my rules" would have Cancel import something.
Dismissal is the safe answer either way: nothing changes.

Tests: `rules-data.js` drives the real handler (the `#fileSettings` change listener, a FileReader
stub, and the question's buttons), 63 checks. On the unfixed code 38 of them fail, including the
reported repro ("Cannot read properties of undefined (reading 'toLowerCase')" from `highlight()`).
Sixteen mutations were each caught (no question, raw pool, dropped `_url`/`dataVersion`/
`excludeSystems`/`requires`, run order lost, live pool not restored, no cache save, unreported cache
or settings failure, lost/older packs unnamed, Settings not reopened, non-objects not filtered, no
key check on a bare object). The `try` around `readSettingsFile()` is defensive: no JSON input can
reach it once non-objects are filtered.

Noticed, not changed: a keyword whose `term` is a non-string (a number, an object) still passes
`mergeRules()` and would break `highlight()` from any load path; that is #71's to settle.
Importing settings still replaces `settings.rulesSources` wholesale with the file's list, which is
what importing settings means. A third answer, merging the file's packs into what is loaded, was
not built; whether it is wanted is Mike's call.
## A glossary entry without a term no longer breaks the sheet (#71, 2026-09-28)

**The bug.** `highlight()` looked each chip up with `allGlossary().find(x=>x.term.toLowerCase()…)`,
and `allGlossary()` is the pack's keywords plus `character.glossary`. One entry with no `term` (or a
`null`, or a number) threw a TypeError, and because nearly every render runs text through
`highlight()`, every render after it stopped: features, the Add class window, the lot. It only
threw when the bad entry came *before* the term being matched, since `find()` stops at the first
hit. `mergeRules()` already dropped a keyword with no term (silently), so the reachable paths were a
settings file (Settings → Import assigns `rules` wholesale), the cache restoring such a pool, a
keyword whose term was a number (kept as a number by the merge), and an imported character's own
glossary. Pages: [Rich text](../wiki/architecture/rich-text.md),
[Rules packs](../wiki/architecture/rules-packs.md),
[Character model](../wiki/architecture/character-model.md),
[Rules & tables](../wiki/features/rules-and-tables.md).

**Readers.** `glossTerm(g)` (00-constants.js) is the only way a term is read: a trimmed string, or
"" for anything else. `allGlossary()` returns objects only. `highlight()` builds one map keyed by
the escaped, lower-cased term and looks each match up in it, which also fixes a second bug: the old
lookup unescaped only `&amp;`, so a term with an apostrophe ("Hunter's Mark") was a chip with an
empty `data-gid` that opened nothing. `statusTitle()` (a status name of 7 or none threw too),
`statusTermList()`, `renderGloss()`, `openGlossView()` (and a stale id passing it nothing),
`openGlossForm()` and the view/edit/delete handlers in `90-boot.js` all go through it. A term of
only spaces used to become `\b( )\b` and chip every space; trimmed, it matches nothing. The
player's own entry with no term is listed on the Rules tab as "(no term)" with Edit and Delete.

**Boundaries.**
- *Packs:* `mergeRules()` skips any entry that is not an object or has no usable name
  (`ruleName()`: a non-blank string, or a number, which becomes text), counts it per category, and
  returns the counts. `importRulesFiles()` and `fetchAllRules()` (via `applyFetchedSource()`) add
  `skippedSummary()` to the status line ("Skipped 2 glossary entries with no term."), in red. A
  keyword written `{name, description}`, as every other category is, is read as its term and text
  (`glossRepair()`), keeping the originals; `bundle-rules.js` keys it the same way and now reports
  entries with no name, like duplicates.
- *The pool:* `reindexRules()` runs `tidyRules()` first. Every path that changes the pool ends in
  it (merge, fetch, removal, a settings file, both cache restores), so a wholesale pool is repaired
  or pruned the same way without touching the Settings import handler (#70 is rewriting it):
  non-list categories become empty, unusable entries go, numeric names become text, keywords get
  the aliases and an id. It returns what it dropped, for a caller to report; nothing does yet.
- *Characters:* `migrate()` keeps only objects in the eleven list fields: `null` (JSON's hole or
  undefined) and bare strings or numbers carry no field of an entry and threw on the first read or,
  in strict mode, the first write (`detectSpellAttack()` sets `atkType`). Glossary entries that are
  objects are never dropped: `glossRepair()` fills an absent term/text from name/description, and an
  entry with no id gets one (a numeric id becomes text), so Edit and Delete can reach it.

**Same failure class, other categories** (audited by running every renderer and picker over a
wholesale pool with junk in each category, a character with junk in each list, and named-but-bare
entries): a table with no `rows` stopped `renderTables()`, which `renderAll()` calls — `tableRows()`
and `tableCols()` now read rows, a non-list row and cols safely; a class on the character with no
name or a numeric one threw in `classCasterKind()`, `warlockLevel()`, `openClassInfo()` and
`openSpellForm()`; a numeric spell name in `renderSpells()`' sort; `keyOf()` and `ruleById()` on a
`null`. All fixed.

**Tests.** `sheet.js` 861 → 909: the readers with an untidied pool and an unmigrated character
(malformed entries first), the renderers and editors through the recorder DOM, `migrate()`'s
repair and idempotence, a sheet whose every list holds junk through `renderAll()`, and a junk pool
through `reindexRules()`, Settings, every picker and the tables. `rules-data.js` 594 → 607:
`mergeRules()`'s skips, aliases and counts, the summary's wording, and the status line after a file
import and after Fetch all. Against the unfixed source all 48 new `sheet.js` checks failed, most
with the reported TypeError, and 10 of the 13 in `rules-data.js` (the other three guard what must
not change). The five merged shipped packs are identical before and after (ids aside), and the
bundles are byte-identical.

Noticed, not changed: `openClassInfo()` still assumes a pack class's `spellcasting` is a string and
`savingThrows` a list; the glossary editor's Save still replaces the whole entry, so fields other
than term/type/text/image are dropped when a player edits one (the aliases' content survives,
having been copied into term/text).

## Tables keep their footnotes (#73, 2026-09-28)

**The bug.** 17 Xanathar's downtime tables mark entries with `*`, and the notes the marks point at
never reached the pack: [book text: the Crime-Complications-style footnote] under 14 complication
tables, and [book text: the Magic Item Price footnote] under Magic Item Price, Magic Item Base Prices and Magic
Item Crafting Time and Cost (whose price column's label carries the mark). Seen during #68.

**Root cause.** 5e-tools carries a table's footnotes on the table node itself, as `footnotes`, an
array of entries (in the v2.36.1 dump, 35 nodes, every one a plain string with its `*`).
`_norm_table()` read `rows`, `colLabels`, `colStyles` and `caption` and nothing else, and the
schema had no field for them, so the app had nothing to show.

**Where footnotes occur** in the files the converter reads: the XGE downtime rules (17 tables, all
shipped), AI's franchise rules (11), DMG's Selling Magic Items (1), the DMG and BMT decks (2), EFA's
Artificer plan tables (3) and FRHoF's Knowledge Domain Spells (1). No pack selects those last 18
printings (the core Artificer is TCE's, whose plan tables have none; the decks are XDMG's), so the
core and Tasha's packs gain none. `classTableGroups` never carry them. **Humblewood** needs nothing:
its one starred table, Night Domain Spells, explains the mark in a line the book prints after the
table ([book text: the Night Domain Spells footnote line]), which the extractor
already keeps verbatim in the feature prose beside the table's anchor, where the verbatim suite
holds it. The extractor was not changed.

**Fix.** Converter: `_norm_table()` renders each footnote through `_cell_text()`, the cells' own
path (a string de-tagged, an `entries` object flattened), keeps the `*`, drops blank ones, and
writes `footnotes` after `rows` only when any remain. `_register()`'s identical-table reuse now
compares footnotes too, so a footnoted table cannot be folded into an unfootnoted twin and lose
them (no such pair exists in the three packs today). App: `tableHTML()` writes each footnote as a
`<p>` in a `.tbl-notes` block after the table's scroll box, so a wide table cannot scroll its notes
out of view, each through `esc()` exactly as a cell is. With no footnotes the markup is byte for
byte what it was. CSS in `35-tables.css`. Schema §6.11 documents the optional field;
README-converter says tables carry it.

**Data.** `data/xanathars/tables.json` +51 lines, none removed: 17 `footnotes` arrays. Checked
table by table with the key taken out: same 74 names in the same order, identical content and key
order, same wrapper. Every other file of the three packs regenerates byte for byte, `data/5e2024/`
included, and no run prints a WARNING. XGE's `DATA_VERSIONS` moves at the next release, correctly:
Xanathar's players re-download that pack to see the notes.

**Tests.** `converter.py` 199 → 210: the real Crime Complications and Magic Item Price nodes from
the dump, key order, no key when there are none or the list is empty, tags and an `entries`
footnote rendered as cells are, the reuse rule both ways, and `convert_glossary()` end to end. 7
failed before the fix. `tables.js` 157 → 182: a table without footnotes renders exactly the
pre-change string (pinned), footnotes follow the scroll box escaped, the shipped XGE packs carry 17
(Crime Complications, Magic Item Price and the three carousing tables pinned) and the shipped Crime
Complications renders its note; for every pack, `footnotes` is a non-empty list of strings and no
table has a `*` without one (Night Domain Spells exempt, with the reason). 9 failed before the fix.
Mutation-checked: an unescaped footnote fails `tables.js` (the attribute guard in `rules-data.js`
cannot see it, as it is not an attribute); dropping the footnote comparison from `_register()`
fails `converter.py`.

Pages: [rules & tables](../wiki/features/rules-and-tables.md),
[converter](../wiki/data/converter.md), [supplements](../wiki/data/supplements.md),
[humblewood](../wiki/data/humblewood.md); `decisions.md`. Known issues are reconciled at merge.

## Magic weapons take their base weapon's property names and attack ability (#72, 2026-09-28)

**Root cause.** `convert_items()` named weapon properties from the `itemProperty` list of the file it
was converting, and masteries by chopping `"Nick|XPHB"` at the bar. Only `items-base.json` defines
properties (`itemProperty`, 27) and masteries (`itemMastery`, 8); `items.json` copies each base
weapon's codes onto its magic weapons and defines none. So every magic weapon printed its codes
("Properties: F, L, T"), and because `ability` is `"finesse"` only when "Finesse" is in the named
list, a finesse magic weapon attacked with Strength. Two object-shaped references printed Python's
repr: the Psychic Blade's mastery `{uid: "Vex|XPHB", note}` ("{'uid': 'Vex") and, in the *base*
pack, the Lance's `{uid: "2H|XPHB", note: "unless mounted"}`. The 2014 `S` property is the one
definition with no `entries`, only a top-level `name: "special"`, so the base Net printed "S" too.
Checked first: the dump's magic weapons already inline every base field (dice, damage type, range,
`dmg2`, category), and the only differences from their base weapon are deliberate (Sun Blade adds
Finesse and radiant damage; Dwarven Thrower and Quarterstaff of the Acrobat add Thrown and a
range). Naming was the whole bug; nothing needed merging from the base weapon.

**Fix.** `_weapon_defs()` reads both lists from one file (a property by its first entry's name,
else its top-level `name`, first letter capitalised); `load_item_index()` now returns
`(items, props, masteries)`. `convert_items()` starts from that index (set by `all` and
`supplement`, which already loaded it for #68's statblocks) and adds its own file's definitions.
One resolver, `_weapon_refs()`, serves `convert_items()` and `_item_traits()`: it takes `"F"`,
`"F|XPHB"` or `{uid, note}`, names a property by abbreviation and a mastery by name, and renders a
note as "Two-Handed (unless mounted)". A code nothing defines is printed as it stands and recorded
in `_WEAPON_MISSES` with the items carrying it; `_weapon_miss_warnings()` reports each as a
`WARNING` at the end of `all`, `supplement` and every single subcommand. The single `items`
subcommand indexes the `items-base.json` beside its input, so `items items.json` now names what
`all` names. Every code in the v2.36.1 dump resolves; no run warns.

**Data.** Only `description` (its Properties and Mastery segments) and `weapon` (`notes`, and
`ability` on four) of weapon items moved; checked field by field against the committed files. 30
items: core `items-magic.json` 21 (Dagger of Venom, Psychic Blade, Scimitar of Speed and Sun Blade
`str` → `finesse`; Dwarven Thrower, Javelin of Lightning, Quarterstaff of the Acrobat, Thunderous
Greatclub, Trident of Fish Command and 12 staves renamed only), core `items.json` 2 (Lance, Net),
Xanathar's 3 staves, Tasha's 4 (three Moon Sickles, Baba Yaga's Pestle; Devotee's Censer has no
properties and did not move). A versatile weapon's notes also lose the stray code: "Versatile 1d8 ·
V" becomes "Versatile 1d8", as the base Quarterstaff reads. Every other file of the three packs
regenerates byte for byte, `classes.json` included (the Soulknife statblock reads as before). A
data-only change, so no UNRELEASED bullet; the 5e2024, XGE and TCE `DATA_VERSIONS` move at the
next release, correctly.

**In the app.** Nothing parses weapon notes: `addAttackForItem()` copies `notes` into the attack row
and `ability` drives `attackNumbers()`. Existing characters keep their copies until the
rules-update tool runs: `weapon` and `description` are in `UPD_FIELDS.item`, so a stamped copy
shows "description, weapon changed", ticked unless the player edited the item. Applying it rewrites
both and `updResyncAttack()` rebuilds the linked attack with `finesse` only if the player never
touched it; an edited attack keeps `str`. Driven in a scratch harness with the old and new Dagger
of Venom (STR 8, DEX 18: to-hit 3 → 8). Nothing changes a saved character on load.

**Guards.** `converter.py` 199 → 225: real shapes from the dump (Dagger of Venom against the base
Dagger, Dwarven Thrower, Sun Blade, Staff of Power, the Psychic Blade's mastery object, Tasha's bare
`"L"`, the Lance's property object, the Net's `S`), an unknown code printed and warned, a
definition-less run reporting every code, and the WARNING from `items`, `all` and `supplement` on a
two-file dump; 24 of the 26 failed before the fix. `rules-data.js` 615 → 621 over every pack: no
bare code or repr in any weapon's notes or description, every melee weapon listing Finesse attacks
with finesse, and every magic weapon keeps its named base weapon's dice, kind, properties and
finesse; three failed before. Mutation-checked: setting two abilities back to `str` fails both
finesse guards. Pages: [converter](../wiki/data/converter.md),
[supplements](../wiki/data/supplements.md), [attacks & damage](../wiki/features/attacks-and-damage.md).

**Seen, not fixed** (separate cause): a `+N` magic weapon's bonus counts twice. `_item_effects()`
turns `bonusWeapon` into global `attack` and `damage` effects, and `convert_items()` also writes it
as `weapon.atkMisc`/`dmgMisc`. `attackNumbers()` adds both on the weapon's own row, and the effects
add +N to every other attack while it is equipped. 15 weapons: 11 core (Dagger of Venom, Sun Blade,
Staff of Power, …) and 4 Tasha's. Seen in the scratch harness above.

## A +N weapon's bonus counts once, on its own attack (#74, 2026-09-28)

**Root cause.** `convert_items()` writes a weapon's 5e-tools `bonusWeapon` (or `bonusWeaponAttack` /
`bonusWeaponDamage`) onto the weapon as `atkMisc`/`dmgMisc`, and `_item_effects()` *also* turned it
into `attack`/`damage` effects on the item. `attackNumbers()` adds a row's `atkMisc` and every live
`attack`/`attack.<kind>` effect, and an equipped item's effects are live for every row. So a +1
Dagger of Venom read +2 on its own row (STR 10, DEX 16, level 1: +7 to hit, +5 damage for +6/+4),
and every other attack, spell rows included, gained +1 while it was equipped. `attackNumbers()` did
the arithmetic right; the data said the bonus twice.

**The one representation.** Every `bonusWeapon*` that reaches a pack is scoped to one weapon: the
item itself (the 15 weapons), the Rod of Lordly Might's own mace form, the one weapon Oil of
Sharpness coats, the bows Bracers of Archery name, the Eldritch Claw Tattoo's unarmed strikes, and
the pestle of Baba Yaga's Mortar and Pestle. Of the 274 dump entries carrying it, the broadest are
Deck of Wonder's Champion card (weapon attacks only) and Banner of the Krig Rune (inside its area);
none reaches every attack, and no effect target can say "only this weapon" (`attack`, `.melee`,
`.ranged` are the only scopes). So
`_item_effects()` never emits it: a weapon carries it as `atkMisc`/`dmgMisc`, where the attack row
reads it once, and anything else keeps it in its prose, as the numeric-only rule keeps every other
conditional. `bonusAc` and `bonusSavingThrow` stay effects; they are global. The Archery fighting
style's `attack.ranged` (from `overlay.json`) is untouched.

**Data.** Only `effects` moved, on 20 items. Core `items-magic.json` 14: the 11 weapons (Dagger of
Venom, Dwarven Thrower, Mace of Smiting, Quarterstaff of the Acrobat, Scimitar of Speed, Staff of
Power, Staff of Striking, Staff of the Magi, Staff of the Woodlands, Staff of Thunder and
Lightning, Sun Blade) and Bracers of Archery (`damage` +2), Oil of Sharpness and Rod of Lordly
Might (+3). Tasha's `items-magic.json` 6: the three Moon Sickles and Baba Yaga's Pestle, and Baba
Yaga's Mortar and Pestle and the Eldritch Claw Tattoo. Quarterstaff of the Acrobat keeps `ac` +5
and Staff of Power `ac` and six `save.*` +2. Checked field by field; every other file of the three
packs regenerates byte for byte; Xanathar's has none and did not move. The 15 weapons keep their
`atkMisc`/`dmgMisc` unchanged.

**App.** The item form's *Insert from rules pack* filled kind, ability, dice and type and carried
`atkMisc`, `dmgMisc` and `notes` only from the item being edited, so an inserted +N weapon got no
bonus on the weapon. That hid while the pack also wrote the bonus as an effect (which the insert
copies); with the effect gone the inserted dagger would have had no bonus at all. `openItemForm()`
now carries them from `wFrom`, the pack weapon last inserted, else the edited item's own, so the
inserted weapon also gets its range and properties notes. One UNRELEASED bullet.

**`attackNumbers()` is not changed.** Skipping the owning item's own effects on its row would fix
only half of an old sheet (the +1 on every other attack stays), and would make an effect the player
typed on a weapon mean one thing on its row and another everywhere else. An effect on an equipped
item is global by definition; the data now says so.

**Existing characters** hold copies with the effects. `effects` is in `UPD_FIELDS.item`, so the
rules-update tool shows a stamped copy as "effects changed", ticked unless the player edited the
item; applying it writes `effects: []` and nothing else, the weapon keeps its `atkMisc`, the attack
row keeps its id, and qty/equipped/fav are untouched. An edited copy is offered unticked; a legacy
or form-inserted copy (no `src`) is offered unticked by name, and there `weapon` differs too, so
applying it also gives the weapon its `atkMisc` and rebuilds an untouched row. `migrate()` changes
nothing. The prompt appears when a sheet's `appVersion` is behind, so the next release nudges; until
then Settings → This character → Rules updates offers it.

**Guards.** `converter.py` 236 → 259: the real Dagger of Venom, Dwarven Thrower, Sun Blade, Staff of
Power and +1 Moon Sickle carry the bonus on the weapon and no effect; the five non-weapon shapes
from the dump carry no effect and keep their prose; a Ring of Protection keeps AC and saves; a
split attack/damage bonus lands in each box; 12 failed first. `rules-data.js` +8 over every pack:
no weapon carries its bonus both ways, no pack item carries any `attack`/`damage` effect (an
explicit allowlist, empty, for one that truly reaches every attack), 11 + 4 +N weapons still ship,
five pinned bonuses; two failed first. `sheet.js` +14: the shipped Dagger of Venom added through
the finder reads +6/+4 and a Club and a Fire Bolt row beside it +2 (seven failed first, reproducing
+7/+5 and +3), Tasha's +3 Moon Sickle, and the item form driven through Insert and Save keeping the
+1 and notes (four failed first). `char-update.js` +13: an old sheet reproduces the bug, the fixed
shipped entry is offered as exactly `effects`, ticked, and applying it gives +6 and +2; an edited
copy is unticked; `migrate()` leaves the effects (six failed first). Pages:
[converter](../wiki/data/converter.md), [attacks & damage](../wiki/features/attacks-and-damage.md),
[computed stats & effects](../wiki/architecture/computed-stats-and-effects.md),
[rules-update tool](../wiki/features/rules-update-tool.md), [inventory](../wiki/features/inventory.md),
[supplements](../wiki/data/supplements.md).

**Seen, not fixed.** Quarterstaff of the Acrobat's `ac` +5 is `bonusAc`, and in the book it is a
Reaction against one attack, once per rest, so an equipped staff reads AC +5 all the time. The Moon
Sickles' and Staff of Power's spell-attack bonus (`bonusSpellAttack`) is not read at all.

## Finesse ranged weapons can use STR or DEX (#75, 2026-09-28)

**Root cause.** `convert_items()` chose `weapon.ability` by asking "ranged?" first: `'dex' if kind ==
'ranged' else ('finesse' if finesse else 'str')`. Finesse is the choice of STR or DEX for a melee
*or* a ranged attack, so the Dart (Finesse, Thrown; a ranged weapon in 2024) shipped `"dex"`, and a
STR 18 / DEX 12 thrower's Dart read +3 where the rules give +6. Now Finesse is asked first:
`finesse`, else `dex` for a ranged weapon, else `str`.

**Scope.** The Dart is the only ranged Finesse weapon in any pack. In the whole v2.36.1 dump the
others are the 2014 Dart (not converted), IDRotF's Iron Ball and PotA's Seeker Dart (adventure
books, never converted). No magic weapon is ranged, and Tasha's and Xanathar's weapons are all
melee, so the supplements do not move.

**Data.** One line: `data/5e2024/items.json`, the Dart's `weapon.ability` `"dex"` → `"finesse"`.
Its description, notes and kind are unchanged, and every other file of the three packs
regenerates byte for byte.

**In the app, nothing to change.** `attackNumbers()` reads `finesse` the same way whatever the
row's `kind` (the better of STR and DEX, DEX on a tie), and `kind` stays `ranged`, so
`attack.ranged` effects (Archery) still reach it; the attack form, the item form, the breakdown
and the print sheet treat the two fields independently. An existing sheet's Dart is a copy: the
rules-update tool offers "weapon changed", ticked when the item is unedited, and applying it gives
the item `finesse` and rebuilds its attack row, same id, only if the player never touched it; a
row they edited keeps its ability. `migrate()` changes nothing.

**Guards.** `converter.py` 259 → 264: the real XPHB Dart attacks with `finesse` and stays ranged
with its notes; a Net (ranged, no Finesse) keeps `dex`; a Dagger keeps `finesse`; a Warhammer
`str`; one failed first. `rules-data.js`: #72's "every melee weapon listing Finesse attacks with
finesse" now covers every weapon, melee or ranged, plus "a ranged weapon without Finesse attacks
with DEX" and a Dart pin (709 checks; two failed first). `sheet.js` +4: the shipped Dart through the
finder uses STR for STR 18 / DEX 12 (+6) and DEX for DEX 16 (+5), stays ranged and takes Archery's
+2 (one failed first). `char-update.js` +6: an old sheet's Dart is offered as "weapon" changed,
ticked; applying it rebuilds the untouched row with `finesse` (+6); an edited row is left alone
(four failed first). Pages: [converter](../wiki/data/converter.md),
[attacks & damage](../wiki/features/attacks-and-damage.md).

## Conditional AC and saving-throw bonuses on items are not standing effects (#76, 2026-09-28)

**Root cause.** `_item_effects()` wrote every 5e-tools `bonusAc` as an `ac` effect and every
`bonusSavingThrow` as the six `save.*`. Those fields are search-filter tags: 5e-tools sets them
whether the book gives the bonus all the time or only in a moment. An effect applies whenever the
item is equipped, so Quarterstaff of the Acrobat's Attack Deflection (a Reaction, +5 AC against the
triggering attack, once per Short or Long Rest) read AC +5 at all times: DEX 14, level 1, AC 12
became 17 on equipping it.

**No data rule exists.** 102 dump entries carry one field or both. The only keys the five
conditional pack items have that no standing XDMG one does are `light`, `range` and
`modifySpeed`, each incidental; the conditional Arrow-Catching Shield and the standing Shield of the
Cavalier both carry `"ac": 2, "bonusAc": "+2"`; `charges` marks neither (Staff of Power has 20 and a
standing +2, Scarab of Protection 12 and a standing +1). So the converter reads the text. `_bonus_reading()` finds the sentence stating the bonus ("+N bonus to … Armor Class/AC",
"+N bonus to … saving throws" as a list or alone, never one named save), takes it up to the end of
the bonus's own clause (a later ", you have Advantage on saving throws against …" is another
benefit), sets aside the conditions an equipped item always meets ("while wearing / holding /
wielding / carrying", "while … is on your person", "while … orbits your head"), and calls it
conditional if any of reaction, when, whenever, if, unless, until, against, while, as long as, for
every, allies, creature(s), once, each time remains. No sentence at all (a table row, another
wording) is not an effect either. Every bonus kept out of the effects is recorded and printed as a
`note:` at the end of `all`, `supplement` and `items`, with the words that decided it.
`_item_bonus_text()` expands `{#itemEntry …}` for this reading only, through the item index, which
now also carries `items-base.json`'s `itemEntry` templates: the ten Dragon Scale Mails state their
+1 nowhere else. Their descriptions still print the tag (seen, not fixed: 54 pack items do, the
Dragon Scale Mails, Ioun Stones, Potions and Rings of Resistance, and Tasha's Absorbing Tattoos).

**The reviewed list.** Standing, and unchanged: the ten Dragon Scale Mails (+1), Cloak of Protection
and Ring of Protection (+1 AC and saves), Glamoured Studded Leather, Ioun Stone of Protection and
Scarab of Protection (+1), Shield of the Cavalier (+2, on top of its shield +2), Staff of Power (+2
AC and saves), Robe of Stars and Stone of Good Luck (+1 saves). Conditional, now prose only:
Quarterstaff of the Acrobat (+5: "When", "Reaction", "against"), Arrow-Catching Shield (+2 "against
ranged attack rolls"; its shield +2 still comes from its armor line), Bracers of Defense (+2 "if you
are wearing no armor and using no Shield"), Rod of Alertness (+1 AC and saves "While in that Bright
Light, you and your allies", an aura planted once per dawn), and Tasha's Teeth of Dahlver-Nar (+2
from one implanted tooth, a table row; no sentence). Xanathar's has none.

**Data.** Only `effects` moved, on those five items: `data/5e2024/items-magic.json` four, and
`data/tashas/items-magic.json` one. Checked field by field; every other file of the three packs
regenerates byte for byte.

**The Reaction is not a tracked use.** No pack item carries `uses` and 5e-tools has no field for a
per-rest property; one would mean a special case for this staff or a text rule reaching every
"can't be used again until the next dawn" in the dump, and one `uses` pool per item cannot hold the
staff's several properties. It stays in the description; a player can add uses by hand.

**Existing characters** hold copies. `effects` is in `UPD_FIELDS.item`, so the rules-update tool
offers a stamped copy of each as "effects changed", ticked when unedited; applying it writes
`effects: []` and nothing else (the staff keeps its weapon, `atkMisc` 2 and its attack row; qty,
equipped and fav untouched), and AC returns to 12. `migrate()` changes nothing.

**Guards.** `converter.py` 264 → 304: the five conditional shapes and nine standing ones, real from
the dump, through `convert_items()`; the reader on the phrasings it must not misread (a later
clause's "against", one named save, "until the start of your next turn", no sentence); the
recorded list and its notes; `items`, `all` and `supplement` runs each print the note and read the
Dragon Scale Mail through its template. 20 failed first. `rules-data.js` +12: every `ac`/`save.*`
effect in any pack is on the reviewed standing list, every listed one still ships, and the five
conditional items carry none and still state their bonus; six failed first. `sheet.js` +9, read off
the ids `recompute()` paints: the shipped staff leaves AC 12, the Arrow-Catching Shield adds only
its shield +2, Bracers and Rod add nothing, a Cloak still adds +1 AC and saves; four failed first.
`char-update.js` +7: an old sheet reads 17, the fix is offered as exactly `effects`, ticked, and
applying it gives 12; `migrate()` leaves it; three failed first. Pages:
[converter](../wiki/data/converter.md), [armor & AC](../wiki/features/armor-and-ac.md),
[computed stats & effects](../wiki/architecture/computed-stats-and-effects.md),
[rules-update tool](../wiki/features/rules-update-tool.md).

## Items' spell attack and spell save DC bonuses apply (#77, 2026-09-28)

**Root cause, two halves.** The converter never read 5e-tools' `bonusSpellAttack` or
`bonusSpellSaveDc`, so 28 pack items carried no effect for them; and the app had no effect target
a spell bonus could use. `spellDC()` and `spellAtkBonus()` summed no effects at all, and
`recompute()` painted the Spellcasting card from its own copy of the same two formulas. An equipped
Staff of Power, Moon Sickle or Wand of the War Mage changed nothing a caster looks at.

**Two numeric targets.** `spell.attack` and `spell.dc` join `fxTargets()` ("Spell attack", "Spell
save DC"), so the effect editor offers them and `FX_LABEL` names their chips. They stay inside
"effects are numeric-only": each is a flat bonus to one number. `spellDC(c)` and `spellAtkBonus(c)`
now take the contributions optionally, as `effMaxHP()` does, and add them, and every place that
shows either number reads those two: `recompute()` paints the card through them (and marks each
with `.fx-on` when an effect applies), `promptSpellAttack()` (the cast window), the save rows in
`renderAttacks()` (their DC cell marked too) and `printSheet()`. A spell attack row reads its to-hit
through `attackNumbers()`, which adds `spell.attack` for `source: "spell"` rows only, so a weapon's
row, the staff's or the sickle's own included, never takes it; `openAttackBreakdown()` lists it by
source on those rows. The card's two numbers carry `data-stat="spell.dc"` / `"spell.attack"`, so a
tap opens `openStatBreakdown()`: "8 + prof +2 + INT mod +3" (or "No spellcasting ability chosen")
and each contribution by name, as the AC box does. `attack` was not reused: it reaches every weapon
row, and a Wand of the War Mage does not make a sword more accurate.

**The converter** reads the two fields through #76's sentence reader, with phrases for "+N bonus
to … spell attack rolls", "+N bonus to … saving throw DC(s)" / "spell save DC", and the Robe of the
Archmagi's "Your spell save DC and spell attack bonus each increase by 2". Every one of the 28 is
standing ("while holding…", "while you wear or hold it"), and the run notes none. Core, 9:
+1/+2/+3 Wand of the War Mage (attack), Robe of the Archmagi (attack and DC +2), Staff of Power
(attack +2, beside its AC and saves), Staff of the Magi, Staff of the Woodlands, Talisman of Pure
Good and Talisman of Ultimate Evil (attack +2). Tasha's, 19: the +1/+2/+3 All-Purpose Tool, Amulet
of the Devout, Arcane Grimoire, Bloodwell Vial, Moon Sickle and Rhythm-Maker's Drum (attack and DC),
and Reveler's Concertina (DC +2). Xanathar's has none.

**A bonus limited to one class's spells** (the Moon Sickle's "your druid and ranger spells", the
Arcane Grimoire's "your wizard spells", and the rest of Tasha's focuses) is applied to the
character's spellcasting. The sheet has one spellcasting ability, one DC and one attack bonus, and
the item's attunement already requires that class, so for a single-class caster it is exact; only
a multiclass one differs (a Druid/Wizard's Wizard spells would read the sickle's bonus too). The
class stays in the description. Leaving these as prose would have left all 18 Tasha's focuses and sickles
doing nothing for the casters they were made for. Owner's call to revisit.

**Data.** Only `effects` moved, on the 28 items: `data/5e2024/items-magic.json` nine, and
`data/tashas/items-magic.json` 19. Checked field by field; every other file of the three packs
regenerates byte for byte.

**Existing characters** hold copies. `effects` is in `UPD_FIELDS.item`, so the rules-update tool
offers each stamped copy as "effects changed", ticked when unedited; applying writes the new
`effects` and nothing else. A druid (WIS 16, level 1) with a Staff of Power and a +1 Moon Sickle
goes from spell attack +5 / DC 13 to +8 / 14, the staff keeps its AC and saves, both weapons keep
their rows and to-hit, and equipped and fav are untouched. `migrate()` changes nothing. An older
app given the new packs sums neither target and shows the chip as its raw name.

**Guards.** `converter.py` 304 → 318: eight real shapes (the +2 Moon Sickle, a Wand of the War
Mage, the Robe's other wording, the Staff of the Magi's attack only, a Talisman, Reveler's DC only,
two Tasha's focuses) and Staff of Power's three bonuses; the 2014 Talisman's "If you are a good
cleric" read as conditional; a weapon's "+2 bonus to attack rolls" not read as a spell bonus; 11
failed first. `sheet.js` +21, through `recompute()`, the cast window, both breakdowns and a rendered
save row: the shipped staff gives +7 and leaves DC 13 and its own row +4, the +3 Moon Sickle DC 16
and +8 while its row stays +5, Reveler's Concertina DC 15 only, no spellcasting ability still "—";
13 failed first. `char-update.js` +8: the fix is offered as exactly `effects`, ticked, and applying
it gives +8 / 14; three failed first. `rules-data.js` +9: the reviewed list of spell bonuses per
pack, every effect target any pack ships is one `fxTargets()` lists (a target the app does not know
is summed by nothing, silently), and the two card numbers are tappable; five failed first. Pages:
[computed stats & effects](../wiki/architecture/computed-stats-and-effects.md),
[spells](../wiki/features/spells.md), [attacks & damage](../wiki/features/attacks-and-damage.md),
[converter](../wiki/data/converter.md), [rules-update tool](../wiki/features/rules-update-tool.md).

## Items' shared text templates are written out (#78, 2026-09-29)

**Root cause.** 5e-tools shares one text among a family of items. The item's entries carry
`{#itemEntry Name|SRC}`, `items-base.json`'s `itemEntry` list holds the template, and its
`{{item.resist}}`, `{{getFullImmRes item.resist}}` and `{{item.detail1}}` are filled from the item's
own fields. `flatten()` had no branch for the tag and `strip_tags()` reads only `{@…}`, so it
passed through as text: 54 pack items read "{#itemEntry Ring of Resistance|XDMG}" where the book's
text belongs. #76 had already put the templates in the item index, but read them for the bonus only.

**The fix.** Before `flatten()`, `_expand_item_entries()` replaces every entry that is the tag with
the template's entries, looked up by name and source (no source means the DMG's, as in 5e-tools),
and `_fill_template()` fills every string in them from the item: `{{item.resist}}` and
`{{item.detail1}}` as the item has them ("acid", "pearl"), `{{getFullImmRes item.resist}}`
title-cased the way the 2024 templates call it ("Acid"). A template's named entries (Tasha's
"Tattoo Attunement", "Damage Resistance", "Damage Absorption") read "Name: text" like any other.
An embedded item statblock (`_item_traits()`) takes the same path. `_item_bonus_text()` and its
helper are gone: `_bonus_reading()` reads the description as written, which now holds the template
text, and the ten Dragon Scale Mails' +1 AC is read from it unchanged.

**Never quiet.** A tag the index has no template for, a placeholder the item has no value for, and
any template text `flatten()` still prints (a tag inside a sentence) are printed as they stand,
recorded in `_TEMPLATE_MISSES` with their items, and `_template_miss_warnings()` reports each as a
`WARNING` at the end of `all`, `supplement` and every single subcommand. `_write()` now counts `{#`
and `{{` left in a file among its "unresolved tags", as it did `{@`. The v2.36.1 dump reports none.

**Other template syntax, enumerated.** Across every dump file the converter reads, the only other
`{{…}}` are the Dragonborn `_versions` in `races.json` (`{{color}}`, `{{damageType}}`, which
`_version_subraces()` already fills), `{{spellcasting_mod}}` in a `spells-tce.json` scaling field
the converter does not read, and `items-base.json`'s property display templates, likewise unread.
`{=…}` lives in `magicvariants.json` and `recipes.json`, neither converted. Before the fix the 54
tags were the only template text in any pack; now there is none.

**Data.** Only `description` moved, on exactly those 54 items: `data/5e2024/items-magic.json` 44
(ten Dragon Scale Mails, 14 Ioun Stones, ten Potions and ten Rings of Resistance) and
`data/tashas/items-magic.json` 10 (the Absorbing Tattoos). Names, order, key order, effects and
every other field unchanged, checked item by item; every other file of the three packs regenerates
byte for byte; Xanathar's has none. No UNRELEASED bullet: converter and data only.

**Existing characters** hold copies. `description` is in `UPD_FIELDS.item`, so the rules-update tool
offers each stamped copy as "description changed", ticked when unedited; applying writes the
book's text (under the finder's meta line, for a copy added through the finder) and nothing else.
Effects, equipped, qty and fav are untouched, so a Dragon Scale Mail keeps its AC. `migrate()`
changes nothing; an edited copy is offered unticked.

**Guards.** `converter.py` 318 → 341: real shapes from the dump (a Ring of Acid Resistance in both
printings, a Potion of Fire Resistance, the Acid Absorbing Tattoo, the Ioun Stone of Mastery, the
Black Dragon Scale Mail) read their templates exactly, an item statblock too, nothing warns; a
missing template, a missing value and a tag mid-sentence are printed, counted and reported, and
`items`, `all` and `supplement` each warn and write the text; 22 failed first. `rules-data.js` +9:
no `{#…}`, `{{…}}`, `{=…}` or `{@…}` in any string of any file of any pack, and seven pinned
texts; eight failed first. `char-update.js` +8: an old sheet's ring and mail are offered as
`description` only, ticked, and applying gives the book's text under the meta line with AC
unchanged; `migrate()` leaves the tag; four failed first. Pages:
[converter](../wiki/data/converter.md), [rules-update tool](../wiki/features/rules-update-tool.md).

## Stone of Good Luck and Ioun Stone of Mastery bonuses apply (#79, 2026-09-29)

**Root cause, two halves.** The converter never read 5e-tools' `bonusAbilityCheck` or
`bonusProficiencyBonus`, so the Stone of Good Luck carried only its saving-throw half (six `save.*`
+1) and the Ioun Stone of Mastery no effect at all; and the app had no target for "every ability
check", only one `skill.<k>` per skill. `profBonus` already existed and `pbValue()` already fed every
consumer (saves, skills, attacks, spell DC and attack, passive Perception, print).

**Enumerated.** In the three packs `bonusAbilityCheck` is on the Stone of Good Luck alone and
`bonusProficiencyBonus` on the Ioun Stone of Mastery alone (the dump's others are the 2014 printings
and the Stone of Ill Luck's −2, none converted). Both read standing through #76's sentence reader:
"While this polished agate is on your person, you gain a +1 bonus to ability checks and saving
throws"; "Your Proficiency Bonus increases by 1 while this pale green prism orbits your head". The
reader gains two phrases: "+N bonus to … ability checks" alone or in a list, never one named check
("Wisdom (Perception) checks") and never checks narrowed to a tool or use ("… made with thieves'
tools"); and "Proficiency Bonus … increases by N". Other fields the converter ignores, seen and left:
`bonusSavingThrowConcentration` (no pack item); `ability`, on 29 core items, is either `static`
(Belts of Giant Strength, Gauntlets of Ogre Power, Headband of Intellect, Amulet of Health, the
Giant Strength potions: the score *becomes* N, not an addition), a +2 "to a maximum of 20" (six
Ioun Stones, Belt of Dwarvenkind: a cap no flat effect can hold), a permanent +2 to score and
maximum (the Manuals and Tomes: read once, typed into the base score), or a choice (Deck of Many
Things); `modifySpeed`, on 11 core items and Tasha's Teeth of Dahlver-Nar, multiplies, sets or
copies walking speed or grants another mode (Boots of Speed, Boots of Striding and Springing, Winged
Boots…), none a flat walking bonus. All stay prose, as before.

**A `check` target.** `fxTargets()` gains "Ability checks" (`check`). `recompute()` adds it to every
skill total and marks each, to initiative (a Dexterity check, typed or derived) and to passive
Perception (10 + the Perception check); not to an ability modifier, which attacks, saves, AC and
spell DCs also read, and not to saves, which the stone raises through its own `save.*`.
`openStatBreakdown()` lists it by source, "Stone of Good Luck (ability checks)", on a skill and on
initiative, and on an ability as what a plain check with that score alone adds, apart from the
score. Print reads the painted numbers, so it follows. Expressing the stone as 18 `skill.*` and an
`init` effect instead was rejected: 25 chips on one item, no way to name a plain ability check, and
nothing a player could add for "+1 to all checks" in one row.

**The proficiency bonus box** is marked `.fx-on` when a `profBonus` effect applies, like every other
effect-touched number, and carries `data-stat="profBonus"`, so a tap opens its breakdown: "Level N:
+2" and each contribution by source. Until now no pack item raised it.

**Data.** Only `effects` moved, on two items in `data/5e2024/items-magic.json`: the Stone of Good
Luck gains `check` +1 after its six saves, the Ioun Stone of Mastery `[]` → `profBonus` +1. Every
other file of the three packs regenerates byte for byte. `data/overlay.json`'s `_comment` lists
the effect targets again in full (it had missed `spell.attack`/`spell.dc` since #77); it is not in a
system folder, so no pack's data version moves.

**Existing characters** hold copies. `effects` is in `UPD_FIELDS.item`, so the rules-update tool
offers each as "effects changed", ticked when unedited; applying writes the new `effects` and
nothing else: a WIS 16 level-1 caster wearing both goes from no check bonus, PB +2 and DC 13 to +1
on every check, PB +3 and DC 14, the stone keeps its six saves, and equipped, qty and fav are
untouched. `migrate()` changes nothing. An older app given the new pack sums no `check` and shows
the chip as its raw name. One UNRELEASED bullet.

**Guards.** `converter.py` 341 → 352: the real Stone of Good Luck and Ioun Stone of Mastery, the
reader on both wordings and on one named check, a tool-narrowed check and two "until"s, and the
Stone of Ill Luck's penalty kept in prose and noted; nine failed first (one the #76 check whose
expected effects the stone now extends). `sheet.js` +22, off the ids `recompute()` paints: the
shipped stone worn raises all 18 skills, initiative (typed or not) and passive Perception by 1 and
marks them, each save by 1 (not 2), and moves no modifier, PB, AC, spell number or attack; the
three breakdowns name it; the Ioun Stone makes PB +3, marked, and everything proficient follows
while nothing else does; 11 failed first. `rules-data.js` +4: the reviewed list of `check` and
`profBonus` effects over every file of every pack, `check` among `fxTargets()`, and the PB box
tappable; three failed first. `char-update.js` +7: the fix is offered as exactly `effects`,
ticked, applying gives check +1 and PB +3; three failed first. Pages:
[computed stats & effects](../wiki/architecture/computed-stats-and-effects.md),
[abilities & skills](../wiki/features/abilities-and-skills.md), [converter](../wiki/data/converter.md),
[rules-update tool](../wiki/features/rules-update-tool.md).

## The Notes tab is the Journal tab (#39, 2026-09-29)

The first step of #39. The tab that gathers section notes is renamed, id and all: `tab-journal`,
`data-tab="journal"`, `src/html/60-journal.html`. Its icon is now a ringed notebook, because the
old page glyph is the section-note button's own. Nothing is saved under a tab's name (the active
tab is never persisted), so no character changes. The Section Notes card works as it did. Its
printed heading reads "Section notes" now, since the Story tab has a card called Notes too.

**Guard.** `rules-data.js`'s "the Notes tab takes no note" regex ran from the panel to the end of
the page, and would have passed vacuously once the id changed. It now slices the Journal panel up
to the next panel, and refuses a leftover `tab-notes` or `data-tab="notes"`; three failed first.

Pages: [shell](../wiki/ui/shell.md), [sections & layout](../wiki/ui/sections-and-layout.md),
[story & notes](../wiki/features/story-and-notes.md), [screenshot QA](../wiki/process/screenshot-qa.md).

## A refused character write says so, and keeps saying so (#81, 2026-09-29)

A failed autosave only changed the `#savestate` label, in a title bar that scrolls away. The
journal (#40) is the first unlimited long-form text a character carries, so an hour of notes could
go unsaved with nothing else said. `scheduleSave()`'s write is now `saveNow()`, reachable from the
tests, returning "" or `storageWhy()`'s reason. `showSaveResult()` raises `#saveWarn` with that
reason, Save to file and Try again, and keeps it up until a write lands. The strip is fixed to the
foot of the window, not under the tab bar as the spec said: there it would sit on the combat tab's
own sticky header.

**The other writes.** `libSave()` returns its reason instead of swallowing it. `newCharacter()` and
`finishImport()` store first, list only once stored, and report through the strip. So a refused
character stays playable and exportable with no home-screen card that opens nothing.
`migrateOldChar()` kept deleting the legacy key whether or not its copy landed; it now deletes it
only after both writes land, returns why otherwise, and `boot()` alerts. The dead `lsOK` check at
boot is gone.

**Guards.** `char-update.js`: saveNow and libSave under the full-quota switch; the warning set,
kept by a failing Try again and cleared by a landing one; a new character, an import and an old
save under a full store. Pages: [storage](../wiki/architecture/storage.md),
[home & characters](../wiki/features/home-and-characters.md).

## Journal pages (#40, 2026-09-29)

The Journal tab's first card: the player's own pages, `character.journal`
(`[{id, title, tag, text, at, editedAt}]`) with `journalCollapse`. `migrate()` guards both and
`repairIds()` gives every page a unique string id. New fragments `87-journal.js` (pure half, then
DOM half) and `47-journal.css`.

**The rules.** A page exists only while it has a title or text (`jnlSavePage()`, the `saveNote()`
rule), so a blank page is never saved however it is left, and nothing cleans up. Tags are trimmed,
grouped case-blind, A to Z, Untagged last, labelled by the first spelling met, and shared with
trackers for suggestions. Order is newest created first. Search is case-blind through an `i` RegExp,
never by lower-casing, which can change a string's length and misplace the `<mark>`. The stamp is
the locale's date and time in bold, on its own line at the caret, and an edit starts with the caret
at the end.

**The card.** Three views in one card (list, page, editor), in a session-only state keyed on the
character. The editor is built once per edit, because `renderAll()`/`refreshRulesUI()` can run
mid-typing; `renderJournal()` is in both. `NOTE_FMT_HINT` is now shared with the section-note
editor.

**Guards.** `sheet.js`: the fields, migrate and ids; tags, order, search (escaping, the Unicode
alignment), the page rule, the stamp and `insertLine()`; the three builders, including hostile
values; a hostile page through the list, a search, the page and the editor; New → type → Done, a
blank page never saved, Delete asking, and a character switch resetting. `rules-data.js`: the
search box's clear button, the card order. Pages: [journal](../wiki/features/journal.md),
[story & notes](../wiki/features/story-and-notes.md), [rich text](../wiki/architecture/rich-text.md),
[character model](../wiki/architecture/character-model.md),
[sections & layout](../wiki/ui/sections-and-layout.md).

## Trackers (#41, #39, 2026-09-29)

The Journal tab's second card, and the end of #39. `character.trackers`
(`[{id, name, type, tag, value, goal, items, done, autoClose, closed, closedAt, at}]`), with
`trackerCollapse` and `showTrackers` (read as `!== false`). `migrate()` guards them and repairs
tracker ids, and item ids from one pool across every tracker. New fragment `87-trackers.js`; its
styles join `47-journal.css`.

**The rules.** Three types: a counter with an optional goal (none, as for kills, is never
complete), a checklist, and a task. Counts are whole, never below 0, and may pass the goal. The
close rule is in `trkApply()` alone. It closes only on the step from not done to done, only with
Close when complete on (the default), and never from the form or on creation, so a reopened
tracker at 100% stays open. Undo restores a snapshot from before the tap: the tick and the close
together, guarded by the character id. Checklist lines keep their ids and ticks through an edit
(`mergeChecklist()`). Tracker text is plain: a glossary chip inside a checkbox button would be a
button in a button.

**The card.** Groups by tag, Completed shut at the bottom, focus put back by the pressed control's
first `data-*` so Space held on + keeps counting. A keyboard completion lands on the toast's Undo.
Trackers is registered section 20 (tab `journal`), so it takes a note and joins the combat view; the
registry tests went 19 → 20, and the Journal-panel guard now expects exactly that one note card.
Hidden (Settings → This character) means `display:none`, kept in the DOM.

**Guards.** `sheet.js`: fields, migrate and ids; progress for each type with junk; the close
rule's six cases; Undo; `mergeChecklist()`; the form never closing; layout; the builders with
hostile values; hostile trackers through the card and the form; a tap, a closed tracker refusing
taps, a stale Undo, a typed count, Reopen, and the combat view accepting the card.
`rules-data.js`: 20 sections, the tab's card order, the switch wired. Pages:
[journal](../wiki/features/journal.md), [combat view](../wiki/features/combat-view.md),
[story & notes](../wiki/features/story-and-notes.md),
[sections & layout](../wiki/ui/sections-and-layout.md),
[settings & updates](../wiki/features/settings-and-updates.md),
[character model](../wiki/architecture/character-model.md).

## The journal branch's final-review fixes (#39, #40, #41, #81, 2026-09-29)

A whole-branch review of `issue/39-journal` found three real bugs and seven smaller ones. All fixed
in one pass, each with a test first where the harness can see it, and driven in Chrome where it
can't.

**Leaving a character (#81, I-2).** `loadCharById()` never called `showSaveResult()`, so after a
switch the strip still said "Not saved", now about a character whose stored copy was current. Worse,
the switch it invited (Home, delete an old character to make room, tap the first one's card)
reloaded that character from storage and dropped the edits it had never written. Now
`loadCharById()`, `newCharacter()` and `finishImport()` all call `leaveCharacterOk()` first
(`70-persistence.js`). It writes the edit still waiting on the debounce, retries a write that
failed, and, if that still can't land, asks: "“A”'s changes aren't saved — <why>. Leave and lose
them? Cancel, then use Save to file." No changes nothing and hides the home screen, so the strip's
Save to file is in view. A switch that goes ahead calls `showSaveResult("")`. A new `saveDue` flag
means a switch with nothing waiting writes nothing, so it never moves a card up the home screen's
`updated` order. Side effect: an edit made less than 500 ms before a switch is no longer lost.

**Delete and star (#81, I-3).** `deleteCharacter()` and `setAutoload()` return `libSave()`'s answer
and `alert()` it (the home overlay covers the strip). A delete whose index write fails keeps the
blob, so the card still opens the character.

**A typed count (#41, I-1).** The count box's `change` fires as it loses focus, which happens at the
mousedown on + or on a Tab. `trkAct()` redrew the card there, replacing the + under the pointer, so
the click never arrived: 5, type 9, click + gave 9. It also dropped a Tab's focus to `<body>`. The
change path now patches the row in place (`trkPatchRow()`: the box, the bar's `aria-valuenow` and
width), and a non-number is put back in place. Enter, and a change that closes the tracker, still
redraw.

**The minors.**
- M-1: Tab or Esc from a closing tap's Undo goes to the next open tracker's first control
  (`trkAfter()`, taken before the tap; `trkNextControl()`), or to + Tracker when none is left.
- M-2: `attrSel()` and `openerSelector()` escape newline, return and form feed as CSS hex escapes. A
  raw one made `querySelector` throw, and in `trkAct()` that throw came before the save. The save
  is now scheduled first.
- M-3: `jnlUI.who`, `trkWho` and the Undo's `who` key on the character object, not its id.
  Import → Replace keeps the id and swaps the sheet, so an open editor survived it and wrote the
  old text over the imported page, and an old Undo could restore into it.
- M-4: the tracker form's Save, Close now and Delete re-resolve the tracker by id, since a toast's
  Undo can swap it while the form is open. Close now and Reopen keep what was typed and do what the
  button said when the form opened.
- M-5: `rules-data.js` checks that `#swTrackers` is drawn in This character and wired.
- M-6: `renderTrackers()` calls `renderCombatEmpty()` with the combat view open, so hiding Trackers
  when it is the only card there brings back the "Add sections…" hint.
- M-7 and D-1: docs. Holding Enter on + keeps counting, but Space doesn't: a button clicks once on
  Space's key-up. The README's "red bar" is paper edged in red. The journal page now states the
  Enter handler's `preventDefault()`-before-`commitBox()` rule.

**Guards.** `sheet.js`: the change path patches in place (a counting fake DOM), a non-number is
put back, and Enter and a completing change redraw; `trkAfter()`; an Undo across Import → Replace;
the editor and Completed reset on a same-id replace; the form's Close now, Reopen and Save after an
Undo; `attrSel()`/`openerSelector()` with newlines. `char-update.js`: the flush before a switch, No
on each of the three paths, Yes clearing the warning, and delete and star under a full quota.
`rules-data.js`: the Trackers switch. Pages: [journal](../wiki/features/journal.md),
[storage](../wiki/architecture/storage.md),
[home & characters](../wiki/features/home-and-characters.md),
[combat view](../wiki/features/combat-view.md), [known issues](../wiki/roadmap/known-issues.md).

## One closing keyword per issue in a merge message (process, 2026-10-01)

The `issue/39-journal` merge said "Closes #39, #40, #41, #81". On push GitHub closed #39 only: a
closing keyword applies to the issue number straight after it, not to a list. #40, #41 and #81
were closed by hand, each with a comment naming the merge commit and why it hadn't closed itself.
[WORKTREES](../WORKTREES.md) §5 now shows the form (`Closes #39, closes #40, closes #41`), the
check after pushing (`gh issue view <n> --json state`), and the comment to leave on a manual
close. CLAUDE.md's worktree rule carries the one-line version.

## Ammunition in the packs (#7, 2026-10-02)

The converter kept nothing 5e-tools says about ammunition. Now:
- launchers carry `weapon.ammo` (from `ammoType`); a launcher's kind is its piece's kind, 2014
  names included;
- ammunition carries `ammo: {kind}` (from its family flag, or its name for XGE's Unbreakable Arrow);
- bundles carry `pack: {item, qty}` (from `packContents`).

`pick_2024_preferred()` takes, for items, the set of everything the 2024 pack ships from both item
files, and leaves out a 2014 entry reprinted as one of them. That drops 40 renamed duplicates: the
2014 Crossbow Bolt, Blowgun Needle, their bundles and the Net from `items.json` (the 2024 Net is gear
in the other file), and 35 gear items such as "Acid (vial)" and "Spell Scroll (1st Level)" from
`items-magic.json`. Mike chose both files; no grant names an old one.

`convert_ammo_variants()` reads `magicvariants.json` for ammunition variants only, selected as items
are:
- the 2024 pack gets XDMG +1/+2/+3 Ammunition and Ammunition of Slaying;
- Xanathar's gets Walloping and Adamantine.

Each is expanded onto every single 2024 piece ("+1 Arrow"), never a bundle, its `{=bonusWeapon}`
written out. Its text is flattened once under the variant's name, so Slaying's creature table is one
table, "Ammunition of Slaying Table".

**Counts:** 5e2024 items 99 → 94, magic 542 → 527, tables 107 → 108; XGE items 43 → 53. Every other
item is byte-identical but for the new fields, checked by script before the files were copied.
`release.js` will bump XPHB's and XGE's data versions.

Pages: [converter](../wiki/data/converter.md), [supplements](../wiki/data/supplements.md).

## Ammunition on the sheet (#6, 2026-10-02)

A launcher's attack row now carries its ammunition: the loaded stack, **Fire**, and **Recover N**.
New fragment `62-ammo.js`: a pure half (kinds, stacks, unpacking, the one-time pass, firing, Undo,
recovery, the +N) and a DOM half (the line, the picker, End combat).

- **Bundles unpack on arrival.** The finder, starting equipment and the one-time pass on old sheets
  all turn "Arrows (20)" into Arrow ×20, each piece a twentieth of the bundle's own price and weight.
  The pass runs once per character (`ammoInit`). It re-baselines the update tool only for fields it
  wrote and only where the player hadn't edited them, so it reads as the pack's change.
- **Firing.** One piece off the loaded stack, which is the chosen stack (`ammoStack`, outside
  `weapon`) else the first of the kind. The last piece removes the stack. A spent count
  (`ammoSpent`) keeps a copy so recovery can rebuild it with its old id. Undo reverses one shot,
  only on the character it was shown for, and a held key cannot press it.
- **Recovery.** Half of each stack's count, rounded down per stack. It is offered once after End
  combat, and Recover N on a row does the same any time. Recover shows only when N > 0. Deleting a
  stack, or removing the class that granted it, forgets its count.
- **The +N.** A loaded +1 stack adds 1 to the row's attack and damage, and the breakdown names it.

Pages: [ammunition](../wiki/features/ammunition.md),
[attacks & damage](../wiki/features/attacks-and-damage.md),
[combat view](../wiki/features/combat-view.md), [inventory](../wiki/features/inventory.md),
[character model](../wiki/architecture/character-model.md),
[grants & provenance](../wiki/architecture/grants-and-provenance.md),
[rules-update tool](../wiki/features/rules-update-tool.md).

## Ammunition in the item editor (#8, 2026-10-02)

The item editor learned the ammunition fields, so a homebrew bow or arrow works like a pack one:
- a weapon's **Ammunition it fires** (None, the five 2024 kinds, any kind already on the sheet, or
  Other… for a new one) saves as `weapon.ammo`;
- **Ammunition**, with a kind and a bonus from +0 to +3, saves as `ammo`;
- Insert from pack unpacks a bundle into its piece, quantity included;
- Save carries `ammoStack` and `pack`, which the form doesn't show.

Other… left blank refuses to save, saying why. Page: [ammunition](../wiki/features/ammunition.md).

## Ammunition: the final review's fixes (#6, #8, 2026-10-02)

The whole-branch review of #6/#7/#8 found nine problems before merge; all nine are fixed in one wave.

1. `migrateAmmo()` looked names up in `AMMO_BUNDLES`/`AMMO_SINGLE_NAMES`/`AMMO_LAUNCHERS` with plain
   indexing, so an item named "Constructor" or "__proto__" found an inherited property instead of
   `undefined` and threw reading `.name` off it — a character with such an item silently failed to
   open. `ammoTable()` is an own-property lookup used for all three.
2. `revertEquipmentGrants(sid)` forgot a spent count only by the removed item's id, so a granted
   stack already fired down to nothing (and so already gone from the inventory) kept its count, and
   Recover could bring back arrows from a class the player no longer has. `forgetGrantAmmo(c,sid)`
   deletes every `ammoSpent` entry whose `snap.grant` matches, and runs alongside the id-based
   `forgetAmmo()`.
3. A "No" at End combat didn't remember being asked, so the next fight with no new shots asked
   again about the same old ones. Each `ammoSpent` entry now carries `asked` (carried forward by
   `fireAmmo()`, since the entry is rebuilt every shot); `ammoAskDue()` is true while any kind has
   fired more than it was asked about, and `markAmmoAsked()` catches every entry up on a "No".
   `offerAmmoRecovery()` asks only when due. Recover N on the row is unaffected either way.
4. `recoverAmmo()` always recreated a used-up stack from its snapshot under the old id, even when an
   equivalent stack (same name, bonus and grant) already existed — firing the last of one and then
   picking up more of the same left two identical rows. It now tops up the equivalent stack instead,
   and repoints any weapon whose `ammoStack` named the old id.
5. The stack picker's row showed only `×qty`, never the magic bonus the spec called for.
   `ammoChoiceHTML(s,cur)` factors the row and adds `· +N`/`· -N` when the stack carries one;
   `openAmmoPicker()` uses it.
6. Documented, not fixed: 2014-named single pieces and the 35 dropped 2014 gear items read as "not
   in any loaded pack" on sheets migrated before this branch; two grants of "Arrow ×20" look
   identical in the picker; Xanathar's five Adamantine Ammunition pieces carry rarity "Unknown".
7. `newCharacter()` sets `ammoInit=1` on the character it creates, so the one-time pass never runs on
   a brand-new sheet (never in `blankChar()`, as `wpnEquipInit` isn't either).
8. Insert from pack left the quantity box at a bundle's count after the next pick was not a bundle,
   so picking "Arrows (20)" then Longbow saved 20 Longbows. `openItemForm()`'s `#iLib` handler now
   remembers when the quantity came from a bundle and resets it to 1 the moment the next pick isn't
   one.
9. The release note's magic-ammunition list read as if Walloping and Adamantine ship with the core
   pack; reworded to name Xanathar's Guide.

Pages: [ammunition](../wiki/features/ammunition.md),
[character model](../wiki/architecture/character-model.md),
[grants & provenance](../wiki/architecture/grants-and-provenance.md),
[combat view](../wiki/features/combat-view.md), [known issues](../wiki/roadmap/known-issues.md).

## Timed conditions (#55, 2026-10-06)

A condition can now last a set time. A status carries an optional `durationSec` (a round is 6) and
`elapsedSec`; the status form's "Lasts" row sets it in rounds, minutes or hours, and blank is
untimed, as every condition was before. `advanceRound()` moves every active timed condition with the
active spells, and each timed row has − rd / + rd. A forward step that brings one to its duration
flips it to Cleared (row kept, effects off); one toast per step names them, with an Undo that
applies once and only on the character it was shown for. Focus is not moved, so a keyboard ▶ cannot
land on Undo. Switching one back on — the toggle, the form, or an item's Use reactivating it —
restarts its full duration; changing its length in the form keeps the time already run. The
Concentrating condition is never timed: its spell owns the clock. The print sheet shows the time
left. Pages: [conditions & concentration](../wiki/features/conditions-and-concentration.md),
[spells](../wiki/features/spells.md), [combat view](../wiki/features/combat-view.md),
[character model](../wiki/architecture/character-model.md).

## Compact stats in the combat view (#62, 2026-10-06)

Ability Scores & Saves and Skills, added to the combat view with their own swords buttons, draw
compact and read-only there, as the quick view #62 asked for; the Sheet tab is unchanged.
`syncStatLock()` disables the two cards' score boxes and proficiency dots exactly while they sit in
`#cvList` — after the view fills, after a card goes home, and after `buildStats()` redraws (a redraw
with the view open builds fresh controls). The look is CSS under `#cvList [data-note="abilities"]`
and `#cvList [data-note="skills"]`: six abilities in a row (three on a phone), the score as a plain
number, skills in three columns (two, then one, as the screen narrows), the legend hidden; the
grouped display shrinks the same way. Tapping a value still opens its breakdown. Pages:
[abilities & skills](../wiki/features/abilities-and-skills.md), [combat view](../wiki/features/combat-view.md).

## Timed conditions and compact stats: the final review's fixes (#55, #62, 2026-10-07)

1. The compact Skills grid in the combat view now sets `grid-auto-flow:column` on its own three- and
   two-column rules, so neither depends on the base `.skills` rule the view's narrower media query
   could win over; at phone width the left column reads Acrobatics through Investigation, the right
   Medicine through Survival.
2. `stepStatusTap()` now falls back keyboard focus to the row's Edit button
   (`attrSel("data-edit-status",id)`) once a condition has run out, instead of the un-focusable
   `data-toggle-status` span.
3. `openStatusForm()`'s save now rounds `number × unit` to the second before truncating, so "1.5
   hours" saves 5400 seconds instead of being truncated to an untimed condition.
4. Shortening an active timed condition's length to no more than the time already run now saves it
   Cleared (`active=false`, `elapsedSec=durationSec`) — the spec was silent on this case; restarting
   (switching it on in the form) still starts at 0.
5. `undoStatusExpiry()` now toasts what actually came back, via a new pure helper `statusBackText()`
   beside `statusExpiredText()` ("Poisoned is back", "Poisoned and Frightened are back", "A, B and 2
   more are back"); nothing toasts when everything restored was deleted since.
6. `advanceRound()` now calls `scheduleSave()` right after the tick, before the redraw, so a redraw
   that throws cannot lose the round step — matching every other round-mover.

Pages: [conditions & concentration](../wiki/features/conditions-and-concentration.md),
[abilities & skills](../wiki/features/abilities-and-skills.md),
[combat view](../wiki/features/combat-view.md).

## Data archive, per-pack versions and data-only releases (#83, 2026-10-07)

Part 1 of #82. Rules data ships as one zip that Fieldbook opens itself, every pack has its own
version, and data can be released without the app.

1. `data/packs.json` registers every pack (system, dir, file, title, version, digest, optional
   licence and credit). `tools/data-kit/fbdata.py` (Python 3.8+, stdlib) is the only code that
   computes digests — canonical JSON of the registry fields and the folder's files — and the only
   writer of versions. The first digests were seeded from the v1.7.2 tree.
2. `bundle-rules.js` reads the registry; `release.js` bumps changed packs to the app version through
   `fbdata.py` and snapshots `DATA_VERSIONS`. The git-diff-since-last-tag logic is gone.
3. Data versions are `X.Y.Z` / `X.Y.Z-N` (not semver); `cmpDataVer()` compares them. `dataStatus()`
   and the settings-import older-copy check use it; an unreadable version is unknown (a plan
   ruling: never stale, never current).
4. `89-zip.js`: a pure zip reader with a puff.c-style inflate; refuses encrypted, ZIP64, unknown
   methods, damage and oversize by code. `readDataArchive()` reads an archive, the app zip's nested
   archive, or loose JSON, and refuses the data kit. The review fix (5f570b1) gave it one read
   budget per import: the 128 MiB cap covers every entry read, nested archives included, and is
   reserved before anything inflates; an inner zip is read as an archive or skipped, never as loose
   JSON.
5. `importRulesPayloads()` imports bytes; each pack in a zip keeps its own file name. `importPack()`
   replaces what the same file name and system loaded before (R4). In a loose zip, JSON with no
   rules category is skipped (an old app zip's converter inputs) — a plan ruling. Both status lines
   show "Reading…", then every failure by name; a failed cache save is reported there. The four
   rules pickers accept `.zip`, `application/zip` and `application/x-zip-compressed` (a plan ruling:
   Windows and some Android pickers label zips with the last).
6. Pack `license`/`attribution` → `rules.credits` → Settings → Credits & licences and `NOTICE.md`.
   Homebrew's CC BY-SA 3.0 credit to D&D Wiki ships for the first time.
7. The archive `fieldbook-data-standalone-<release>.zip` (`fbdata.py pack`, validated by
   `fbdata.py validate`); the app zip carries it. `build.sh --data` builds only it; the zips need
   python3, `--no-zip` doesn't.
8. Data-only releases: `scripts/data-release.js` (dev.sh `d`) and `data-release.yml`, published with
   `--latest=false` and checked afterwards; app releases attach the archive and get their data notes
   from `scripts/data-release-notes.js`.
9. `checkForDataUpdate()` finds the newest data release for this app, reads its registry, and marks
   older loaded packs "update" — quietly (R7).
10. A release freeze holds until 1.8.0 (#83, #84, #85) is complete; the history purge is logged for 2.0.

Pages: [data archive](../wiki/architecture/data-archive.md), [rules packs](../wiki/architecture/rules-packs.md),
[settings & updates](../wiki/features/settings-and-updates.md), [building & CI](../wiki/process/building-and-ci.md),
[testing](../wiki/process/testing.md).

## Data archive: the final review's fixes (#83, 2026-10-07)

1. An import from the Rules tab (or anywhere no status line is on screen) now also shows its result
   as a toast, so a refused zip or bad JSON is never silent; "Reading…" never toasts.
2. A pack whose merge throws is named "not a rules file" and the rest still import; any other throw
   in an import writes a red "Import failed: …" line instead of stranding "Reading…".
3. `data-release.yml`'s "latest" check fails with an `::error::` when it can't read the latest
   release, and prints its explanation before attempting the repair. `release.yml` gains the
   "digests current" guard. `release.js` looks up `DATA_VERSIONS` before `fbdata.py` writes.
   `data-release.js` refuses an APP_VERSION below 1.8.0 (no older app opens the zip).
4. App-release notes say "if you already have those versions loaded" (a player who skipped a data
   release has older copies). Settings → Credits' "Rules content" line now says rules data comes
   separately and each pack keeps its own terms.
5. A manifest listing more than 1,000 files is refused (`toomany`). CI compiles `tools/data-kit/*.py`.
   `docs.js` checks the app-zip allowlist names the archive. The data-kit suite's scratch repos
   turn commit signing off.
6. `scripts/bundle-rules.js` no longer carries a literal NUL byte (its excludeSystems comparison
   uses `JSON.stringify`); git had been treating the file as binary. Bundle output unchanged.

Deferred to a follow-up: a pack's content digest does not cover the bundler, so a bundler change
that alters bundle bytes moves no version (#85 rewrites the bundler).

Pages: [data archive](../wiki/architecture/data-archive.md).

## The SRD 5.2 pack (#84, 2026-10-08)

Part 2 of #82. A new rules pack, **SRD 5.2**: only the D&D content Wizards of the Coast publishes
under CC-BY-4.0 in the System Reference Document, converted from the same 5e-tools dump as the 2024
pack, matched to the SRD 5.2.1 PDF, and credited as the licence asks. In #85 it becomes the D&D
content every player gets. Spec: `src/docs/specs/2026-10-08-srd-pack-design.md`.

1. **The pack.** `data/srd52/`, eleven files, each `system: "SRD 5.2"` with
   `excludeSystems: ["humblewood"]`, no `_note` and no `requires`; the pack names are "SRD 5.2
   Items", "SRD 5.2 Backgrounds", "SRD 5.2 Classes", "SRD 5.2 Species", "SRD 5.2 Tables" and "SRD
   5.2 Options". It holds 4 backgrounds, 17 feats, 9 species, 339 spells, 12 classes with 1
   subclass each, 38 options (28 Eldritch Invocations, 10 Metamagic), 476 magic items, 94 base
   items, 21 conditions, 115 glossary terms and 71 tables. `rules-data.js` asserts the counts.
2. **How it is built.** `python3 scripts/convert.py srd <dump> -o data/srd52`. `srd_view()` writes
   an SRD-only copy of the dump into a temp dir: flagged entries only (`srd52` true, or a string,
   which is a rename; a magic variant carries it on `inherits`), each marked `srd52: true` so the
   2024 pipeline's own checks keep it; the lookup data (item properties, types, masteries,
   `itemEntry` templates) copied whole; `sources.json` keyed by SRD names, with the Artificer (EFA)
   class tags dropped. `_run_core()` is `all`'s body, extracted so `all` and `srd` share it (`all` is
   otherwise unchanged); `_run_srd()` runs it over the view with `srd_book()`, the SRD `Book`:
   system "SRD 5.2", `SRD_NAMES`, `excludeSystems` humblewood, mode `"srd"` and no source codes, so
   every 2024 behaviour (`is_default`) stays on, and a Fighting Style menu limited to the Fighting
   Style feats the view has. Then it corrects, scans and writes; any error writes nothing. **The
   free-rules trap, reversed:** everywhere else the flags only backfill; here the flag *is* the
   filter, and `basicRules2024` (not an open licence) is never read.
3. **Renames, three layers.** For an entry whose `srd52` is a string (33 of them: Bigby's Hand →
   Arcane Hand, Leomund's Tiny Hut → Tiny Hut, Heward's Handy Haversack → Handy Haversack…):
   `{@spell X}` and `{@item X}` tags anywhere in the view follow it, case-insensitively, a display
   text equal to the old name too (`_srd_tag_renamer()`); the old name in the entry's own prose and
   table captions becomes the new one, before tables are built, so `[Table: …]` anchors and table
   names agree; and `sources.json` is re-keyed. Anything else, where the SRD rewrote a passage
   rather than renaming it, is a correction (point 5). **Referenced feats:** a kept class feature
   that embeds a feat by reference (`refFeat`: the Paladin's Blessed Warrior, the Ranger's Druidic
   Warrior) needs that feat's text, though the feat is not among the SRD's feats; the view carries
   it in `srd-ref-feats.json`, which `_run_core()` reads into `_FEAT_INDEX`.
4. **The leak scan.** `_srd_leaks()`, after the corrections: a record, class or subclass named as a
   non-SRD entry (every XPHB or XDMG entry the view dropped), or a renamed entry's old name anywhere
   in the text, fails the run. Record names are matched whole, so "Aura of Protection" never trips
   on the feat Protection. The real dump: 0 leaks, 502 non-SRD names, 33 renames. `--excluded-out`
   writes that list; it is committed as `src/tests/fixtures/srd-excluded-names.json`, because the
   data tests need it and CI has no dump.
5. **Corrections and `srd-verbatim`.** `scripts/srd-corrections.json`, hand-authored beside
   `overlay.json`: `remove`, `global` whole-word swaps, `corrections` (`entry`, `find`, `replace`,
   `page`, `why`), `accepted` spans with a reason, and `aliases` (an entry the SRD titles
   differently). `_srd_apply_corrections()` applies them in that order; a removal, swap or `find`
   that matches nothing, or an entry nothing is named, is an error, because the source moved under
   it. Final numbers: 1 global (DM → GM), 1 removal (the Iron Flask Table), 125 corrections, 93
   accepted, 158 aliases; every correction cites its PDF page. `scripts/srd_text.py` is the pure
   half (`norm()`, `records()`, `compare()`, `check()`); `src/tests/srd-verbatim.py` reads
   `_conversion-data/srd52/SRD_CC_v5.2.1.pdf` with PyMuPDF, skips without either, and fails on any
   span of pack text that appears nowhere in the SRD and is not accepted.
   `.venv/bin/python src/tests/srd-verbatim.py` → ALL PASSED (1561 records). It walks each entry's
   text, plus subraces ("Species/Subrace", "Subrace/Trait"), subclass descriptions (by subclass
   name) and choice-option descriptions ("Owner/Option"); `levels.N.spells.note` is deliberately not
   walked: converter-generated counts, not book prose. The triage took 440 findings to 0, then the
   67 the subrace, subclass and option walk found to 0. Telekinesis ends at "such as manipulating a
   simple tool," because SRD 5.2.1 itself breaks off there (p. 168): verified, not a truncation bug.
   `run.sh` runs ten suites.
6. **Three fixes in both packs** (spec decision 1 and R4); `data/5e2024` regenerated by these alone,
   and its gate re-established. `pick_2024_preferred()`, `_shipped_2024()` and `_variant_selected()`
   read `srd52` as truthy, not `is True`, so the 2024 pack gains Carrion Crawler Mucus and Lolth's
   Sting, which a rename flag had dropped. `_render_optfeat_prereq()` renders a dict-shaped spell
   prerequisite by its `entry` text: Agonizing Blast, Eldritch Spear and Repelling Blast read "Level
   2 Warlock and a Warlock Cantrip That Deals Damage" instead of a Python dict (24 occurrences). The
   Paladin's and Ranger's Fighting Style choice adds Blessed Warrior or Druidic Warrior, from the
   class feature's `refFeat`: the 2024 menus are ten styles plus that option, the SRD's four.
7. **The registry entry and its credit.** `data/packs.json` lists SRD 5.2 after XPHB, so the archive
   and the app load it second and existing characters keep resolving to the 2024 pack. `version:
   null` until 1.8.0; `license: "CC-BY-4.0"`; and the attribution, whose first two sentences are SRD
   5.2.1's required statement, verbatim (PDF p. 1), and whose third is the change note CC-BY-4.0
   asks for:

   > This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Changed: converted to Fieldbook's rules format, with renamed entries' references updated.

   The SRD asks for no other attribution to Wizards, so the pack, Settings and README add none. It
   reaches Settings → Credits & licences and `NOTICE.md`; README §10 carries the statement, and
   `docs.js` checks it there. Its digest is left absent (point 9).
8. **`systemOf()`** reads a source label starting `srd` as `"dnd"` (R6), so a D&D character is
   offered the nine SRD species. `excludeSystems` keeps them from Humblewood characters, older apps
   (which don't know the label) included.
9. **Plan rulings beyond the spec:**
   - The view is written to a temporary directory and deleted after the run; "in memory" meant it
     never touches the dump.
   - The referenced feats travel as `srd-ref-feats.json`: a name matching `feats*.json` would be
     picked up as the feats file.
   - Corrections apply to the converted pack text, after the pipeline and before the leak scan, so
     they are written against what players read (spec §3 listed them inside the view).
   - No seeding: the SRD pack's digest is left absent. `fbdata.py versions --seed` rewrites every
     pack's digest, and a missing digest already means "changed", so 1.8.0 gives SRD 5.2 its first
     version. `data-kit.py`'s "every real pack has a digest" check is narrowed to released packs
     (version not null): an unreleased pack gets its digest at its first release.
   - The converter tests build their mini dump in a temp dir (the existing `converter.py` pattern),
     not in `src/tests/fixtures/5etools-mini/`.
   - The Warlock prerequisite renders the dump's own `entry` text verbatim, in 5e-tools' title case
     ("a Warlock Cantrip That Deals Damage"); the spec said lower case.
   - PDF findings are spans of pack text that appear nowhere in the SRD. Text the SRD has elsewhere
     (the Ammunition rules on an arrow) is SRD text and passes.
   - The PDF check walks subraces, subclass descriptions and choice options (the spec's "every
     difference corrected or recorded"); `spells.note` stays out.
   - R5, refined: `rules-data.js`'s "no table name used by two packs" check exempts byte-identical
     twins **and** any SRD/2024 pair, because the SRD's corrections reword shared tables. Of the 68
     tables the two packs share, 58 are identical and 10 differ in the SRD's wording (GM for DM,
     renamed spells, four corrections).

**Judgment calls for review (Mike):**
- 5e-tools ammunition and holy-symbol glosses removed from the SRD pack;
- the 12 class blurbs (`CLASS_BLURB`, 2014 PHB text) are empty in the SRD pack;
- "3rd"/"5th" ordinals accepted, not corrected (form, not content);
- a span passes if it appears anywhere in the SRD, so a pure reordering of SRD words is not caught;
- Goliath subraces open with the SRD's own "Choose one of the following benefits—…" framing;
- 5e-tools table-row restatements are handled unevenly (Holy Symbol rows removed; Horn of Valhalla,
  Carpet, Potion and Ring rows accepted; Horn of Valhalla's row says "Berserkers" beside the
  corrected "spirits"; Spell Scroll states its DC two ways);
- with both packs loaded, `findTable()` returns the 2024 twin, so the 4 corrected SRD tables
  (Reincarnate, Deck of Illusions, Object Armor Class, Carrying Capacity) are shadowed.

Pages: [SRD 5.2](../wiki/data/srd.md), [converter](../wiki/data/converter.md),
[homebrew](../wiki/data/homebrew.md), [rules packs](../wiki/architecture/rules-packs.md),
[data archive](../wiki/architecture/data-archive.md), [testing](../wiki/process/testing.md),
[overview](../wiki/overview.md), [decisions](../wiki/decisions.md).

## The SRD 5.2 pack — final review fixes (#84, 2026-10-08)

The final whole-branch review of the SRD 5.2 pack (L5148) passed "with fixes". This applies every
fix ruled in.

1. **A dice roll holding a 5e-tools prompt template.** `strip_tags()` read `{@dice roll|display}`
   through the default `name|source|display` family, so a two-field tag printed its roll. For
   `variantrules.json`'s Carrying Capacity that roll is a prompt template,
   `#$prompt_number:title=Enter Strength Score$# × 7.5`, and it shipped in 10 cells of
   `data/5e2024/tables.json` (and in the SRD pack until a correction covered it). A dice-family tag
   (`dice`, `autodice`, `damage`, `d20`, `hit`) whose roll holds `#$` and that has display text now
   prints the display text, "Str. × 7.5 lb.". No other dice text moves: `{@dice 1d6|one die}` still
   prints `1d6`, and `scaledice`/`scaledamage` keep their own grammar. `_write()` counts a leftover
   `#$` as unresolved, so a template with no display text is loud. Of every file the converter
   reads, only `variantrules.json` holds `#$`, in those 10 tags. `data/5e2024` regenerated:
   `tables.json`, the 10 cells, nothing else. The SRD's `table:Carrying Capacity` correction went
   stale and is deleted (124 corrections now); `data/srd52` is byte-identical. Carrying Capacity is
   now an identical twin, so 59 of the 68 tables the two packs share are word for word, and with
   both packs loaded three corrected SRD tables are shadowed: Reincarnate, Deck of Illusions,
   Object Armor Class.
2. **The SRD pack is built with its corrections, or not at all.** A missing corrections file, the
   default (`srd-corrections.json` beside `convert.py`) or an explicit `--corrections`, meant no
   corrections: the run succeeded with 5e-tools' wording, the Iron Flask Table and "DM" included.
   The app zip shipped `convert.py` without the file, so a player's own `srd` run did exactly that.
   `_srd_apply_corrections()` now makes a missing file an error (exit 1, nothing written, the path
   named) and unreadable JSON an error line, not a traceback; a run that succeeds prints
   `corrections: <path> (1 removal, 1 global, 124 corrections)`. `build.sh` copies
   `scripts/srd-corrections.json` into the app zip's `scripts/`, and README §9 lists three helper
   files. Tests: the mini-dump runs pass a real `{}` file from their own temp dir (the old `NOCORR`
   depended on a path in the system temp dir not existing); a missing file and broken JSON are
   errors; an explicit missing path, and a `convert.py` copied alone with nothing beside it, each
   fail, name the path and write nothing; `docs.js` checks `build.sh`'s copy. And a pure check, which
   CI runs without the dump or the PDF, that the committed `data/srd52` carries its corrections:
   every section of the file has its shape, every correction's entry resolves through
   `_srd_targets()`, each `find` is gone and each `replace` there, no removed entry is present, and
   no global word is left. Run against a pack built with an empty corrections file, it fails three
   ways.
3. **README-converter documents `srd`:** what it keeps, renames and corrects; that it fails and
   writes nothing rather than ship the wrong text; the command from the app zip, with `--overlay`
   and `--resources`; its flags; that the pack in the rules-data zip is the one to use; and, for
   anyone sharing the output, the SRD 5.2.1 attribution statement, quoted word for word. The file
   ships, so it names Wizards nowhere else, as SRD 5.2.1 p. 1 asks. `docs.js` checks both.
4. **Stale acceptances and aliases fail `srd-verbatim`,** as a stale correction fails the run.
   `srd_text.check()` also reports each `accepted` (entry, text) that matched no finding, and each
   `aliases` key that names no record from `records()`. An alias whose entry is found without it is
   not stale: 14 of them still pick the right heading where the bare name also occurs (Elf/Drow,
   the Goliath ancestries, the Tiefling legacies). Both counts are 0 on the real data.
5. **Minors.**
   - `classes` takes `--feats PATH` and fills `_FEAT_INDEX` through `feat_ctx()`, as `_run_core()`
     does for `all` and `srd`; without it the Paladin's and Ranger's own Fighting Style option was
     left off the menu without a word. A class feature's `refFeat` the index lacks is now a
     `WARNING` on every command (`_feat_miss_warnings()`). `all` and `srd` print none.
   - A rename's new name and a global swap's replacement are text, never a regex template:
     `re.sub` is given a function at both places. The self-rename skips an entry with no name rather
     than raise a `KeyError`.
   - `Book.mode` stays, documented as informational: nothing reads it, and the SRD run's changes
     ride on the `Book`'s other fields.
   - `rules-data.js` checks `srd52_full.json` keeps `excludeSystems` through bundling, and pins the
     nine same-named SRD/2024 tables that may differ: Bag of Beans Table, Cube of Force Faces, Deck of
     Illusions, Hat of Many Spells Table, Object Armor Class, Prismatic Layers, Prismatic Rays,
     Reincarnate Table, Wand of Wonder Effects. A new difference fails until it is added on purpose.
6. **Plan defects, for the record.** The plan mandated "no corrections file is no corrections" (its
   brief's test), which point 2 reverses. Its file map omitted `build.sh` and README-converter, so the
   app zip and the player doc fell outside every task. And it widened spec R5 from "a same-named
   table with different content fails" to "any SRD/2024 pair may differ", now pinned (point 5).

Both gates are clean with 0 warnings, and the Xanathar's and Tasha's packs reproduce.

Pages: [converter](../wiki/data/converter.md), [SRD 5.2](../wiki/data/srd.md),
[known issues](../wiki/roadmap/known-issues.md), [rules packs](../wiki/architecture/rules-packs.md),
[testing](../wiki/process/testing.md), [building & CI](../wiki/process/building-and-ci.md),
[decisions](../wiki/decisions.md).

## The bundler moves to Python (#85, 2026-10-09)

1. `fbdata.py bundle` replaces `scripts/bundle-rules.js` (spec 2026-10-09 R11): kit users have
   Python, not Node. It reproduced every real pack byte for byte before the switch (the parity test
   ran over all six packs and 13 synthetic cases, then was replaced by golden checks when the Node
   bundler was removed). `build.sh`, `run.sh`, CI and `dev.sh` call it; every build now needs python3.

Pages: [rules packs](../wiki/architecture/rules-packs.md), [building & CI](../wiki/process/building-and-ci.md),
[converter](../wiki/data/converter.md), [testing](../wiki/process/testing.md)

## The data kit zip, the app zip without scripts/, and public-only releases (#85, 2026-10-09)

1. `build.sh` gains `pack_kit()` (spec 2026-10-09 R12/R13): a new allowlisted zip,
   `dist/fieldbook-data-kit-<version>.zip`, carries `fbdata.py`, `convert.py` and its three
   hand-authored inputs (`overlay.json`, `class-resources.json`, `srd-corrections.json`), the two
   player-facing docs `README-converter.md` and `rules-schema.md`, `LICENSE`, the kit's own
   `README.md`, and `example-pack/example-pack.json` — flat, so `python fbdata.py build …` works
   wherever the zip is unpacked, with no repo around it. A wrong file set deletes the zip and fails
   the build, the same discipline as the player zip's own guard. `.buildkit/` (its scratch folder) is
   gitignored beside `.buildtmp/`.
2. The player zip drops `scripts/` and its three converter inputs entirely: an advanced player who
   wants to regenerate rules data now gets the kit zip, every release, in place of digging
   `convert.py` out of the app zip. README §9 and `docs.js` were updated to match; `docs.js`'s old
   check for `scripts/srd-corrections.json` in the app zip is now two checks, one proving scripts/
   is gone from the app zip and one proving the kit's own allowlist still carries it (flat, not under
   `scripts/`).
3. `tools/data-kit/example-pack/example-pack.json`: one invented pack covering every category in
   `docs/rules-schema.md` (keywords, features, items, spells, races, classes, feats, backgrounds,
   subclasses, tables), `license: "MIT"` so it passes `validate --public`. It gives a kit user
   something to build with no 5e-tools dump required, and gives `data-kit.py` the same (Review
   Focus 3: a kit user with only the kit zip, unzipped anywhere, gets an archive the app opens).
4. R13: a public release must never carry a pack whose licence isn't one of
   `CC-BY-4.0`/`CC-BY-SA-3.0`/`MIT` (`PUBLIC_LICENCES`, `validate_archive(path, public=True)` — Task
   2a), and never an asset named for the private repo. `release.yml` gains a "Public assets only"
   step: `fbdata.py validate --public` on the rules-data archive, a `*private*` name check on every
   asset, and a check that the app zip names nothing private; `data-release.yml`'s "Validate the
   archive" step runs the same `--public` validation and name check for the data-only path. Both
   workflows already publish the data kit as a GitHub asset.
5. `scripts/data-release-notes.js --app` now also points players at the kit zip, right after the
   rules-data line.
6. `docs/README-converter.md`'s own "from the app zip, `convert.py` sits in `scripts/`" instructions
   were stale the moment the app zip dropped `scripts/` — updated to describe the kit zip's flat
   layout instead, since that doc still ships inside both zips.

Pages: [building & CI](../wiki/process/building-and-ci.md), [data archive](../wiki/architecture/data-archive.md)

## A quiet version chip for packs with no baseline, and homebrew needs public packs (#85, 2026-10-09)

1. `dataStatus(g)` (`src/js/88-settings.js`) gains a fourth state, `"known"`: a pack that carries a
   readable `dataVersion` but has neither a `DATA_VERSIONS` baseline for its system nor a data-release
   notice for it — a private pack, or an old pack (XPHB, Humblewood, XGE, TCE) that a v1.7.2 player
   still has loaded after a later build drops it from `DATA_VERSIONS` — used to fall into `"unknown"`
   and show nothing. It now reports its own version with no claim either way (Review Focus 1, spec
   2026-10-09): `dataStatusHTML()` renders it the same muted way as `"current"`,
   `<span class="rd-src" title="This pack's version.">v<have></span>`, never the amber "update
   available" chip or the newer-data notice (`dataUpdateHint`/`rulesBadge` only ever key off
   `state==="update"`, so `"known"` is invisible to both by construction).
2. `data/homebrew/features.json`, `subclasses.json` and `tables.json` — the three files whose
   `requires` must stay byte-identical for the bundler — rename their first group's target from
   `{"pack": "D&D 2024", "file": "5e2024_full.json"}` to `{"pack": "SRD 5.2", "file":
   "srd52_full.json"}` (Warlock and the 11 spells the Predator leans on all resolve from the free SRD
   52 pack alone — verified against `data/srd52/spells.json`/`classes.json`) and drop `file` from the
   second group (Xanathar's Guide to Everything), which was never going to be public. A group with no
   `file` already rendered "— from `<pack>`" (`requiresStatusHTML`, `src/js/89-rules-merge.js`), so no
   app code changed for that half. Neither pack nor file drives whether a name resolves —
   `missingRequirements` matches case-insensitively against anything loaded, pack-blind — so this is
   purely which pack the chip's tooltip tells a player to go get. This is prep for later tasks in
   #85 that remove the D&D 2024 and Xanathar's packs from the public repo; it is not itself a content
   change.
3. Verified end to end: merging `dist/srd52_full.json` then `dist/homebrew_full.json` leaves only
   Cause Fear and Primal Savagery missing, both reported under "Xanathar's Guide to Everything" with
   no file to point at.
4. Tests: `src/tests/data-archive.js`'s `'dataStatus reads data versions'` section gains the Review
   Focus 1 checks (a pack with a version and no baseline is `"known"`, shown quietly, raises no
   newer-data notice; a pack with neither version nor baseline stays `"unknown"` and renders nothing).
   `src/tests/rules-data.js` gains a check that all three homebrew files declare the new `requires`
   values, and a real-bundle merge check (srd52 + homebrew) proving the resolution above. The existing
   `#84 R7` check that resolves homebrew's D&D group against the SRD vocabulary matched it by
   `/5e2024/.test(file)` or `/2024/.test(pack)` — true of "D&D 2024"/"5e2024_full.json", false of
   "SRD 5.2"/"srd52_full.json" — so it would have silently stopped finding the group and failed;
   updated to match `file==="srd52_full.json"` or `pack==="SRD 5.2"`.

Pages: [settings & updates](../wiki/features/settings-and-updates.md), [homebrew](../wiki/data/homebrew.md)

## The private data split and the data kit (#85, 2026-10-09)

Spec `src/docs/specs/2026-10-09-private-split-design.md`, plan `src/docs/plans/2026-10-09-private-split.md`,
commits `f5e491a..c043f2f` and this entry's. Part 3 of #82, which closes with it. The three #85
entries above record steps of this one; this entry records the whole and every ruling made on the way.

1. **What is public and what is private.** The public repo and its releases carry only rules data
   that may be shared: SRD 5.2 (`data/srd52/`, CC-BY-4.0) and homebrew (`data/homebrew/`,
   CC-BY-SA-3.0). The full 2024 pack (XPHB), Xanathar's (XGE), Tasha's (TCE) and Humblewood moved to
   the private repo `wardmanm/RPGFieldbookPrivate`, with the Humblewood extractor, its PDF suite
   (`humblewood-verbatim`), the playtest notes and the Humblewood wiki page (now its
   `docs/humblewood.md`). One removal commit, `c043f2f`, deleted those 37 files and dropped the four
   entries from `data/packs.json`, after `diff -r` proved the private copies identical. What stays
   public: `scripts/convert.py` with its `all` and `supplement` code (the converter is ours, and its
   prose is now too), `data/overlay.json`, `data/class-resources.json`, the icon map, `data/srd52/`,
   `data/homebrew/`, `scripts/srd-corrections.json`, `scripts/srd_text.py` and the kit. Packs a player
   has already loaded keep working: nothing in the app changed for them except the quiet chip
   (point 6).
2. **The private repo** mirrors the public paths: `data/<dir>/`, its own `data/packs.json` (the four
   entries, with versions and digests carried over unedited), `scripts/extract-humblewood.py`,
   `tests/`, `docs/`, a README and two workflows. It was made by `git filter-repo` over the moving
   paths, on a fresh clone of this branch, so the data keeps its history and blame (40 filtered
   commits, no tags, `origin` set and never pushed by an agent). Its `tests/run.sh` takes a public checkout as
   `$FIELDBOOK`, bundles the private packs with the public kit and runs five suites:
   `leak-scan-self-test`, `private-data` (the four packs' content checks, moved out of the public
   suites, on the public harness), `leak-scan`, `2024-gate` (the byte gate, when the dump is there)
   and `humblewood-verbatim` (when PyMuPDF and the PDFs are). Its CI checks out public `main` beside
   it, builds it and runs `tests/run.sh`, on every push and nightly, so a leak that lands on public
   `main` is caught within a day even when the private repo is idle. **Private data releases** are
   data-only releases in the existing scheme: `node scripts/data-release.js --registry
   <P>/data/packs.json --data-root <P>/data` bumps the changed private packs to `<APP_VERSION>-N` and
   prints the commit and `data-vX.Y.Z-N` tag commands for the private repo; its `data-release.yml`
   builds the public app at `vX.Y.Z`, runs the private suites, and publishes
   `fieldbook-data-private-X.Y.Z-N.zip` on the private repo only, validated without `--public`.
   XPHB and XGE have changed since 1.7.2, so the first private release is `1.8.0-1`, after app
   1.8.0. **The private CI fails until #85 is on public `main`**: it builds public `main`, whose kit
   has no `bundle` before this merge.
3. **`_private-data` and `wt.sh`.** The private clone is reached through a gitignored symlink,
   `_private-data`, with no trailing slash in `.gitignore` because git treats a symlink as a file.
   `scripts/wt.sh` links it into each new worktree beside `.venv` and `_conversion-data`, and removes
   the link on `rm`. `dev.sh`'s converter menu (item 6) writes SRD 5.2 to `data/srd52` and the 2024,
   Xanathar's and Tasha's packs to `_private-data/data/…`, and refuses those three, with a message,
   when `_private-data` is not linked. Humblewood extraction runs in the private repo.
4. **The kit.** `fbdata.py bundle` replaced `scripts/bundle-rules.js` once a parity test had shown
   all six real packs and 13 synthetic cases byte-identical under both bundlers (L5342); golden checks
   replaced the parity test when the Node bundler was removed, and every build now needs python3.
   `fbdata.py convert` runs `convert.py` with the kit's overlay, resources and (for `srd`)
   corrections filled in, which also fixes the converter's helper lookup in the zip layout.
   `fbdata.py build <src> [--srd | --full | --book CODE] -o OUT.zip` takes a 5e-tools dump (and
   converts it), a data folder with its `packs.json`, or loose packs, then bundles, packs and
   validates in one command; it never publishes. `fbdata.py validate --public` refuses a pack whose
   licence is missing or not in `PUBLIC_LICENCES`. The kit zip, `fieldbook-data-kit-<ver>.zip`, is
   flat and allowlisted (`pack_kit` in `build.sh`, its guard sorted in byte order so a runner's
   locale cannot fail it), and the app zip no longer carries `scripts/` (L5352).
5. **The release guards.** `release.yml`'s "Public assets only" step and `data-release.yml`'s
   validation run `fbdata.py validate --public` on the rules-data archive and refuse any asset whose
   name contains `private`; `release.yml` also refuses an app zip with such an entry. A local build
   checks neither: only a publish has a public or private to refuse.
6. **The quiet chip.** `dataStatus()` gains `known`: a pack with a readable version and no
   baseline shows `vX` with the title "This pack's version.", never the amber chip or the newer-data
   notice (L5388). This is what a v1.7.2 player with the old XPHB, Humblewood, XGE or TCE packs
   loaded sees after upgrading. A ruling made while checking it: the pack row's chips wrap whole at
   390 px (`.rd-name .chip, .rd-name .rd-src` are `nowrap` and `inline-block`), since every public
   player now sees homebrew's needs chip.
7. **Homebrew `requires`.** The D&D group names `SRD 5.2` / `srd52_full.json`; the Xanathar's group
   keeps its pack name and drops `file`, so its chip reads "from Xanathar's Guide to Everything"
   (L5388).
8. **The class one-liners.** `CLASS_BLURB` in `convert.py` is rewritten in Fieldbook's own words
   (decision 1); the 2024 pack's `classes.json` descriptions were the only data that moved, and the
   SRD pack writes no blurb, so the 12 corrections that blanked the old lines are gone (124 corrections
   to 112) and `data/srd52` stayed byte-identical.
9. **The text clean-up.** Shipped text lost its book quotes: the Bard sample in
   `downloadRulesTemplates()`, README-converter's spell-save line and rules-schema's Wild Magic row
   are now invented examples. `srd-corrections.json`'s `find` strings stay, allowlisted: the one
   place public files quote the 2024 book on purpose, for Mike to confirm. Dev files were redacted in
   place (decision 2): the ammunition plan's 19 pasted entries became `[5e-tools entry: <name>]`, and
   short quotes in this ledger and the wiki became paraphrases or `[book text: …]` placeholders, the
   ledger keeping its 5424 lines and every heading's line (a one-time exception to append-only). The
   shipped changelog's 10-word footnote stays (decision 3). `src/tests/converter.py`'s book-prose
   inputs became invented text of the same shape, with the same assertions (466 checks before and
   after, mutation sweeps at parity); the review found two input shapes the rewrite had stopped
   exercising, the "while wearing" clause and a bare-comma list of saves, and both were restored.
   `_sub_blurb()`'s docstring example is invented too.
10. **The test split.** Public suites test the public packs and invented fixtures, and pass with no
    private data present. `rules-data.js` went from 839 checks to 677 and `tables.js` from 191 to 148;
    `sheet.js` and `char-update.js` kept their counts, each check repointed at the SRD entry (Staff of
    Power, Dragon Scale Mail, the core classes) or at an invented fixture (a Moon Sickle, a class with
    two subclasses). The four packs' assertions moved to the private `tests/private-data.js` (712
    checks through the public suite today). `humblewood-verbatim` left `run.sh` and the new
    `private-data` suite took its slot, so the count stays ten: it runs `_private-data/tests/run.sh`
    against this checkout, prints `SKIP - no _private-data` without the link, and fails unless the
    runner exits 0 with `ALL PASSED (n)` as its last line. `docs.js` gains a scan that fails on any
    public test reading a private pack, in every form a suite used to (a path, a bundle name, a helper
    given the folder, a list of folders, a key), and its emblem check walks `homebrew` and `srd52`.
11. **The leak scan.** The private `tests/leak-scan.py` reads every string of the four private packs
    and of `data/srd52/` and `data/homebrew/`, then every file git tracks in the public checkout plus
    `dist/fieldbook.html`, and finds runs of words a file shares with the private text and not with
    the free text. All three are normalised by one function (escapes undone, tags and anchors
    stripped, lower-cased, an apostrophe counted only inside a word), so text in a single-quoted or
    escaped string is seen whole: the first tokeniser glued quote marks to words and missed a
    planted 40-word passage split across quoted lines, and was fixed before the scan was trusted.
    A run of 14 words or more fails, a run of 10 to 13 is reported, a missing pack folder fails, and
    an allowlist entry that matches nothing fails, so an entry goes when its run does. An entry is
    `{file, hash, why}` (the first 16 hex of the sha256 of the run's words), never the text, added
    by review one run at a time, and its `why` must be one of four reasons, exactly: (a) a span an SRD
    correction must find (R8); (b) the changelog footnote (decision 3), listed in case it ever grows
    past 10 words; (c) Fieldbook's own text that `convert.py` writes into the packs
    (`FIGHTING_STYLES`, `CLASS_BLURB`, the edition notes, `overlay.json` prose, wherever quoted); (d)
    the SRD's own text, which the SRD can split across two strings that a private pack keeps in one.
    Today: 46 entries covering 61 runs, (a) 30, (c) 15, (d) 1; 0 failing, 0 stale, 33 reported.
12. **The spec's decisions and rulings, as executed.**
    - Decision 1: the class one-liners are rewritten (point 8). Decision 2: public dev files are
      redacted in place (point 9). Decision 3: the changelog footnote stays. Decision 4: no release
      of any kind until Mike says; 1.8.0 holds more issues.
    - R1: the private repo holds the data before public `main` loses it, and the removal is one
      commit carrying everything that depended on the data. The private repo is still unpushed, so
      its first push comes before the merge; old release assets are deleted last.
    - R2: the private repo mirrors the public paths. R3: the public registry drops the four packs in
      the removal commit, so no installed app is told of an update it can never get.
    - R4: private releases are data-only releases, `X.Y.Z-N`, asset
      `fieldbook-data-private-<ver>.zip`. R5: the quiet chip. R6: `CLASS_BLURB` rewritten, SRD mode
      writes none, the blanking corrections removed. R7: shipped text uses invented examples. R8:
      the SRD correction spans stay, allowlisted (for Mike to confirm).
    - R9: the leak scan lives in the private repo. R10: public tests keep their logic and lose
      their book content. R11: the bundler moved to Python behind a parity test. R12: the kit is one
      flat zip, and the app zip drops `scripts/`. R13: public releases carry only allowlisted
      licences and no `private` asset. R14: homebrew's `requires`. R15: the private repo was made
      by `git filter-repo`. R16: `_private-data`, linked by `wt.sh`.
    - **Ruling, import order (#84 RF5 removed).** RF5's check that the registry lists SRD 5.2 after
      XPHB is gone: the two packs now come from two archives, so neither registry can order them.
      Which same-named entry or table wins is now the order the player imported them in, since a
      lookup takes the first match and a re-import keeps its place in the pool. Mike should import
      the private archive first on a fresh install, or keep his existing loads. A fresh install that
      imports public then private resolves same-named tables to the SRD copy.
    - **Ruling, `LEFT_FOR_PRIVATE`.** `docs.js` lets `DATA_VERSIONS` name XPHB, Humblewood, XGE and
      TCE with no pack in the public registry, until the next release retakes `DATA_VERSIONS` from the
      pruned registry; then the tolerance goes inert, and should be deleted. A tripwire that failed
      once it was inert was rejected: it would fail CI at the release itself.
    - **Ruling, the filter-repo history.** `git filter-repo`'s rewrite of the #73 merge (`1c3aa49`)
      took the private repo's `data/xanathars/tables.json` from the merge's first parent, so that
      file lacks its 17 footnotes across `1c3aa49..e8f8582`; `c0b0e64` restores them, and the tip is
      exact. Left as it is and documented in the private README; a rebuild before the first push is
      cheap if Mike wants exact blame on that file.
    - **Ruling, homebrew masking.** The scan's free corpus includes homebrew, as R9 says, so text
      homebrew shares with a private pack is never flagged (The Predator's stock expanded-spell
      sentence is one such run). Left as R9 has it; Mike's call.
    - **Ruling, the main checkout's link.** Only this worktree is linked. The main checkout's
      `/Users/mwardman/Documents/Repos/RPGFieldbook/_private-data` is made at the finish, after the
      merge brings the `.gitignore` line; before that it would show as untracked there.
    - Smaller rulings: CLAUDE.md and the docs say every build needs python3 (the plan had missed
      CLAUDE.md); the bundler's `_same()` normalises integers as the rest does; homebrew's
      Xanathar's-group cross-check, deleted in the test split, was re-homed in the private suite;
      two pre-fix screenshots were deleted rather than re-shot.
    - Still for Mike: the default system for new characters is `"humblewood"` (`blankChar()`), with
      no public Humblewood data (spec §13); and R8's allowlisted correction spans.

Pages: [private data](../wiki/data/private-data.md), [data kit](../wiki/data/data-kit.md),
[overview](../wiki/overview.md), [decisions](../wiki/decisions.md), [converter](../wiki/data/converter.md),
[supplements](../wiki/data/supplements.md), [homebrew](../wiki/data/homebrew.md), [SRD 5.2](../wiki/data/srd.md),
[rules packs](../wiki/architecture/rules-packs.md), [data archive](../wiki/architecture/data-archive.md),
[rich text](../wiki/architecture/rich-text.md), [settings & updates](../wiki/features/settings-and-updates.md),
[ammunition](../wiki/features/ammunition.md), [character building](../wiki/features/character-building.md),
[theming & icons](../wiki/ui/theming-and-icons.md), [building & CI](../wiki/process/building-and-ci.md),
[testing](../wiki/process/testing.md), [known issues](../wiki/roadmap/known-issues.md),
[2.0](../wiki/roadmap/2.0.md), [RELEASING](../RELEASING.md).

## The private split's final review fixes (#85, 2026-10-09)

The whole-branch review passed "with fixes"; these are the fixes ruled in.

1. **The finish order.** The private CI checks out public `main`, which has no `fbdata.py bundle`
   until #85 merges. So the finish pushes the private repo first (its push-triggered run is
   expected to fail), merges and pushes public `main`, then runs the private CI by hand and
   confirms it green. R1 still holds: the private repo has the data before public `main` loses it.
   The spec's §11 list is corrected, and says so; the plan, the private-data page and RELEASING
   agree.
2. **CI runs the kit-zip checks.** `data-kit.py` tests the built kit zip (unzipped, it builds the
   example pack and finds its own `convert.py`) only when one exists, and `ci.yml` and `release.yml`
   both test before they build. Each now re-runs `data-kit.py` after the full build, and fails
   unless those checks ran and passed.
3. **The app zip's guard bans `scripts/`**, since the kit carries the converter; `docs.js` checks
   that the guard's pattern bans it and still lets the shipped files through.
4. **`fbdata.py convert` keeps a caller's `--overlay=PATH`** (and `--resources=`, `--corrections=`):
   it tested only for the bare flag, appended the kit's after it, and argparse keeps the last.
5. **`fbdata.py build` at a 5e-tools checkout's root** now says to point it at the `data/` folder,
   instead of "not a rules pack".
6. **The leak scan reads new untracked files too** (`git ls-files --cached --others
   --exclude-standard`), so a local run sees a file before it is committed. Ignored paths stay
   out, and CI's fresh checkout scans the same set as before.
7. **Less book text below the scanner's threshold.** A `sheet.js` fixture's near-quote is invented
   text now, and three short Humblewood fragments in this ledger (lines 2550 to 2561) are
   `[book text: …]` markers, edited in place with the line count and every heading's line unchanged
   (decision 2's one-time exception).
8. Docs: the quiet-chip player note no longer promises a version for a pack of your own (a
   kit-built pack carries none); the private README says `private-data` is one of the ten suites;
   the private repo's moved Humblewood pages link within that repo and run from it.

Pages: [private data](../wiki/data/private-data.md), [data kit](../wiki/data/data-kit.md),
[building & CI](../wiki/process/building-and-ci.md), [testing](../wiki/process/testing.md),
[RELEASING](../RELEASING.md).

## The digest covers the bundle format (#86, 2026-10-12)

1. A pack's content digest (`pack_digest()` in `tools/data-kit/fbdata.py`) covered its registry fields
   and its files, but not the bundler. A bundler change that altered a bundle's bytes moved no version:
   `data-release.js` refused with "nothing to release", `--release` bumped no pack, and the next archive
   shipped different bytes under the same `dataVersion`. Found in #83's final review; timed with #85,
   which moved bundling into `fbdata.py`.
2. `BUNDLE_FORMAT` (now 1) joins the digest's meta as `bundleFormat`. Bump it with any change to
   `bundle()`/`bundle_text()` output. `data-kit.py` pins each format's output: it bundles one pack that
   exercises every bundling rule and compares the result's sha256 with `BUNDLE_FINGERPRINTS[format]`, so
   changing the output without a bump, or bumping without recording a fingerprint, fails the suite with
   the instruction. A simulated one-character output change was shown to fail it.
3. Adding the format moved every digest once. Publicly that costs nothing at 1.8.0: SRD 5.2 (no digest
   yet) and Homebrew (changed since 1.5.0) bump anyway. Privately, Humblewood and TCE now also bump at
   the first private release, beside XPHB and XGE, which had changed already. No escape hatch
   (`--force SYSTEM`): the format number is the one way a bundler change reaches the versions.
4. The old releases' asset deletion was deferred by Mike on 2026-10-12; data-archive.md's Open list
   says so.

Pages: [data archive](../wiki/architecture/data-archive.md), [data kit](../wiki/data/data-kit.md),
[private data](../wiki/data/private-data.md)
## The import toast says only what happened, and an error stays (#87, 2026-10-12)

1. From the Rules tab (Settings closed, the home screen behind the sheet) an import's outcome is a
   toast (#83). It carried the whole status line, failures first and then every count — about 13
   lines on a phone — and hid after 1.9 s, so only the first sentence could be read.
2. `importRulesFiles()` hands the toast its own text: `importSummary()` plus the missing-content and
   skipped-entry notices, without `rulesStatusText()`'s counts, which stay on both status lines and are
   on the Rules tab already. A clean import toasts one short line ("Merged 1 file.", "Imported x.zip: 2
   packs, data 1.8.0."). `rulesImportStatus()`'s `opts.toast` is now that text (or `true` for msg).
3. `toast(msg, action, opts)`: `opts.err` shows in the danger colour (`.toast.err`), as `role="alert"`,
   with a Dismiss button and a tap anywhere hiding it, and schedules no auto-hide; `opts.long` gives a
   notice the 6 s an action gets. Every existing caller passes neither and is unchanged.
4. Only real failures are errors: a file that failed, a cache save that did not land (the storage
   rule), an exception. Missing content and skipped entries are notices (`long`): importing the public
   zip always notes homebrew's two Xanathar's spells, and a sticky red toast on every normal import
   would be wrong.

Pages: [shell](../wiki/ui/shell.md), [data archive](../wiki/architecture/data-archive.md),
[settings & updates](../wiki/features/settings-and-updates.md)
## List rows keep their labels readable on a phone (#57, 2026-10-12)

1. At phone width, attack and feature rows squeezed their name into the labels beside it: "Longsword"
   ran over "Melee" behind the to-hit pill, and a feature's name crowded its source tag. `.item .nm` is
   `flex:1 1 0` with `min-width:0`, so its box shrank to nothing while its text ran on over the next
   item (the familiar row's old trap, fixed there by `flex-basis:100%`, which would orphan the fold
   button and star these rows put before the name).
2. Attack, feature, item and condition rows (`renderAttacks()`, `featItemHTML()`, `invItemHTML()`,
   `statusRowHTML()`) now hold everything after the name in one `.row-meta` group, and their `.top`
   is `.split`. A split row may wrap; its name asks for 6em; the group is right-aligned and may wrap
   inside itself. Too tight, and the group drops to its own line whole, with the name keeping the line
   above. On a wide screen every row is one line, as before. 6em, not 8em: at 8em an item like
   "Longsword 15 gp 3 lb" split into two lines on a phone for no reason.
3. Other `.item` rows (inventory totals, notes, Active Spells, familiars) are not split and do not
   change: the layout is opt-in by the `split` class.

Pages: [sections & layout](../wiki/ui/sections-and-layout.md)
## The Combat tab acts like every other tab (#80, 2026-10-12)

1. When the combat view became a tab, its header kept the overlay's ✕ and its own ☰ beside the tab
   bar's ☰ — two ways to open the same flyout and a close button no other tab has.
2. `combatHeaderHTML()` draws title · Start combat out of combat, and title · ◀ Round N · time ▶ ·
   (gap) · End combat in it. The tab bar's ☰ (`#btnToc`) serves the Combat tab like every tab:
   `buildToc()`/`openToc()` already listed `#cvList`'s cards and opened below `#cvHead`. The swords
   still enter, and pressing them again still returns to the tab they were pressed from
   (`leaveCombatTab()`); any other tab leaves too, as before.
3. The two places that focused ✕ as a last resort — `cvReturnFocus()` after a keyboard removal with no
   neighbouring card, and `modalGiveBackFocus()` when a modal closes over the view — focus the swords
   (`#btnCombat`) instead.
4. The phone header's two-row layout now applies only in combat: `renderCombatHeader()` sets
   `.fighting`, and out of combat the header is one row (title, Start combat).

Pages: [combat view](../wiki/features/combat-view.md), [shell](../wiki/ui/shell.md)
## A penalty shows its number in red (#89, 2026-10-13)

1. `.fx-on` marked a number an effect or a grant changed, whichever way. It read the SUM, so a −4 CON
   status looked like a +2 DEX item, and a +2 and a −2 on one number cancelled and marked nothing.
2. `fxNeg(contribs, ...targets)` (`00-constants.js`) asks each contribution, not the sum: is any one
   below zero? `mark(el, on, neg)` sets `.fx-on` when either is true and `.fx-neg` with `neg`, so a
   penalty is marked even when a bonus outweighs or cancels it. Mike: the player wants to deal with
   the penalty first.
3. `recompute()` passes it at every mark: the proficiency bonus, each ability modifier, save and
   skill (with `check`), AC, initiative (with `check`), spell DC and spell attack. Speed is red on a
   `speed` penalty or when encumbrance lowers it. Size has no penalty: it marks "you set this".
   `attackNumbers()` returns `atkNeg`/`dmgNeg`; `renderAttacks()` adds `fx-neg` to the to-hit, the
   damage and a save row's DC.
4. Derived numbers keep the marker's old rule (Mike, 2026-10-13): −4 CON marks the CON modifier, not
   the CON save or CON skills, as a +2 CON item never marked them.
5. CSS: `.fx-on.fx-neg` is `--brick` (every skin and mode has one) with ▼ in place of ●, so the two
   read apart without colour. `.bd-neg` reddens a penalty's line in `openStatBreakdown()` (and the
   encumbrance line on speed) and in `openAttackBreakdown()`, where only effect lines can be red.
6. Tests: `sheet.js` #89 (`fxNeg`, `mark`, the painted numbers through `recompute()`, the attack row
   markup, both breakdowns, the CSS). Screenshots `.claude/qa/89-*`, both skins, light and dark.

Pages: [computed stats & effects](../wiki/architecture/computed-stats-and-effects.md),
[abilities & skills](../wiki/features/abilities-and-skills.md),
[attacks & damage](../wiki/features/attacks-and-damage.md)
## The private packs move with this repo (#90, 2026-10-13)

1. The 2024, Xanathar's and Tasha's packs in RPGFieldbookPrivate are `convert.py`'s output, but only
   the 2024 pack had a byte gate (`gate-2024.py`), and `dev.sh` held the three commands in a second
   copy. Nothing caught a public change that moved Xanathar's or Tasha's, and nothing reminded us to
   commit the private side. (Both reproduced exactly on 2026-10-13.) Mike: changes here that might
   affect those files must keep them up to date there as well.
2. `scripts/sync-private.py` (dev-only) is now the one home of the three commands. `--check` (the
   default) converts into a scratch folder and compares byte for byte, ending `ALL PASSED (n)`,
   `FAILURES: …` (naming each pack and the fix) or `SKIP - no 5e-tools dump`. `--write` converts all
   first and touches the private packs only if every conversion succeeds, then adds, updates and
   removes files to match. `--status` prints `NOTE` lines while the private repo has uncommitted or
   unpushed work, and nothing otherwise. A supplement avoids the 2024 tables as they will be after
   the run: the scratch copy when 2024 is converted too, the private one when it is not.
3. `dev.sh` item 6 writes the private packs through `sync-private.py --write`. The private runner's
   `2024-gate` becomes `converter-gate`, which runs `$FIELDBOOK/scripts/sync-private.py`, so the gate
   checks with the commands the menu writes with; `gate-2024.py` is gone.
4. The reminders: the public `private-data` suite relays `--status`'s NOTE lines, and `run.sh` now
   shows a passing suite's `NOTE` lines and, on a failure, indented `FAIL` lines too (the private
   runner indents its suites' details, which hid the fix). `wt.sh rm` prints the same NOTEs.
5. The rule (CLAUDE.md, WORKTREES): a change that moves a private pack regenerates it in the same
   change and commits it in the private repo naming the issue; at the finish, push public `main`
   first, then the private repo. Every worktree links the one private clone, so one branch at a time
   changes private packs, and `main`'s own run fails the gate until that branch merges.
6. Tests: `data-kit.py` #90, with a fake converter (the commands pinned, check and write, a moved
   pack, a removed file, a failing converter, no dump, no private repo, `--status` in a scratch git
   repo with a bare remote, the suite's and `run.sh`'s relaying, `dev.sh`). The fixture names its
   pack folders from the script's `PACKS`, as `docs.js` keeps private pack names out of tests.
   Driven: moving Tasha's on purpose fails `./src/tests/run.sh` with the fix on screen.

Pages: [private data](../wiki/data/private-data.md), [converter](../wiki/data/converter.md),
[testing](../wiki/process/testing.md), [building & CI](../wiki/process/building-and-ci.md)
## The By ability header reads at a glance in the combat view (#92, 2026-10-16)

1. With Skills display set to By ability, the Ability Scores & Saves card in the combat view showed
   each ability's name at 9px in soft ink and its score as a faint 12px number floating in the middle
   of the header, while the "Saving Throws" label under it was 12.5px — the save outweighed the
   ability it belongs to. Mike: hard to see attribute names and values in combat.
2. Cause: the #62 compact rules in `45-combat.css` were written for the six tall Classic boxes
   (`#cvList [data-note="abilities"] .ability .n`, `… input[data-path]`), and the grouped header keeps
   the `.ability` skin, so they reached it too. The disabled score input kept an input's own width
   (about twenty characters) under `width:auto`, which centred the number mid-header. And the
   combat view's `.agroup .srow .lbl` outranks the Sheet tab's `.agroup .svrow .lbl`, so the save
   label lost its small capitals.
3. Fix, CSS only and scoped to `#cvList`: in the grouped header the name is 13px in full ink, the
   modifier 24px, the score 16px bold in full ink in a 2.4em box at the right edge with no spin
   button, and the save row's label is 10px again. A disabled number input still keeps about 15px
   for its spin button in Chromium: that clipped two digits at `3ch` and held the score off the
   edge, so the spinner is hidden (`appearance:textfield`, the WebKit spin-button pseudos). The
   Sheet tab and the Classic display in the view are unchanged. (Reason corrected in review: the
   first draft blamed the font's digit width, which measures exactly 1ch.)
4. Screenshots `.claude/qa/92-*`: before and after in the view, classic skin, Humblewood light and
   dark, and a phone width; the Sheet tab copy checked unchanged after the card goes home.

Pages: [abilities & skills](../wiki/features/abilities-and-skills.md),
[combat view](../wiki/features/combat-view.md)
## A pack older than ammunition still gives a launcher its ammunition (#96, 2026-10-16)

1. Mike: a Light Crossbow is not ammo-enabled by default, and ammunition does not mark itself as
   ammunition. Reproduced with the 2024 pack players actually have: its last release is 1.7.2
   (2026-09-29), and ammunition reached the data on 2026-10-02 (private `1cdfb3f`), so its nine
   launchers carry no `weapon.ammo`, its pieces no `ammo` and its bundles no `pack`.
   `fbdata.py digest --registry _private-data/data/packs.json --data-root _private-data/data`
   reads CHANGED for all four private packs. Driven in the released build: the finder's Light
   Crossbow had no ammunition line, and "Crossbow Bolts (20)" stayed one bundle.
2. `migrateAmmo()` had repaired copies already on a sheet, once, from the built-in tables. Every
   copy made after that from the bare pool — the finder, starting equipment, Insert from pack, and
   every sheet made in 1.8.0, where `newCharacter()` marks the pass done — arrived bare.
3. The pool: `ammoRepairDef()` (`62-ammo.js`) fills a launcher's `weapon.ammo`, a piece's `ammo`,
   and a bundle's `ammo` and `pack` from the same tables, only where missing; a pack's own value
   wins, the weapon is copied rather than edited in place, and nothing outside the tables is
   touched. `tidyRule()` calls it for every item, so every path that loads rules repairs the pool:
   a merge, a fetch, Settings → Import, and both cache restores at boot. `fpNorm()` sorts keys, so a
   repaired entry fingerprints exactly as the current pack's will.
4. The sheets: `AMMO_PASS` is 2 and `migrateAmmo()` runs while `ammoInit` is below it, so a sheet
   the first pass ran on (or one made since) gets the pass once more. Every step touches only an
   item that is not yet ammunition — the bundle step now skips one already marked as ammunition
   (review: the obvious workaround for this bug was ticking Ammunition on "Bolts (20)" and typing
   the bolts left, which pass 2 would have multiplied by twenty) — so a second run changes nothing
   it already did. `newCharacter()` sets `ammoInit` to `AMMO_PASS`. Xanathar's Unbreakable Arrow
   joins `AMMO_SINGLE_NAMES`: the one piece in the older packs the other names missed.
   Like the first pass, it gives a known launcher its kind even if the player had set "None": in
   the two days the item editor has had that select, it is far likelier to be the bug.
5. Repaired copies and the repaired pool agree in the update tool (no change, no edit), except that
   an unpacked bundle's copy keeps the bundle's own text, so the pack's piece description reads as
   an update — the first pass behaves the same, and a fresh finder copy takes the piece's text.
6. Tests: `sheet.js` #96 (the repair per entry, a pack's own value winning, junk and hostile names,
   the merge and a restored pool, the finder and starting equipment, the second pass with the
   update tool's view, a sheet already at the pass). Each half fails alone without its fix.
   Driven: the v1.7.2 2024 items imported through Setup → Import rules files into the released
   build and then the fixed one; the cached pool came back repaired, an existing sheet holding the
   bare crossbow and bundle was repaired on open, Fire spent a bolt, and a fresh finder add was
   right. Screenshots `.claude/qa/96-*`.
7. Not done here, and Mike's to cut: a data release of the private packs, so the 2024 pack players
   download carries the ammunition data itself.

Pages: [ammunition](../wiki/features/ammunition.md), [rules packs](../wiki/architecture/rules-packs.md),
[character model](../wiki/architecture/character-model.md),
[rules-update tool](../wiki/features/rules-update-tool.md)
## A feature files under its source; one group field for tags, sources and categories (#98, 2026-10-16)

1. Mike: editing a feature's source changes its label but leaves it in its original group ("Mapach"
   edited to "Background" stays under Mapach). Editing should move it, and the box should offer the
   groups that already exist, exactly as the journal's tags do — one pattern everywhere a source or
   category is set (Sheet, Inventory, Spells).
2. Cause: `featGroups()` grouped by `featGroupLabel()`, which read only the structural `origin`;
   the row's tag is the free-text `source`. Granted features take their source from the same
   origin (`addFeatureFromDef()`), so the two agreed until the player edited one.
3. Features: `featGroupLabel()` is the source when there is one, else `featOriginLabel()` (the old
   origin rule). Groups key on `tagKey()`, labelled by the first spelling met. The groups features
   came from list in grant order whether or not anything is still filed in them, and a group named
   only by a source lists right after the group its first feature came from, so a feature moving
   never reorders the list. (Ordering by first member pulled the target group up — caught by a
   test; the next attempt, each feature placing its origin and then its own group, still put
   Wanderer above Fighter when the first Mapach trait moved — caught in review.) A source reading
   as "★ Favorites" files by origin. `.inv-sec-head` wraps a long one-word section name.
   `origin` is untouched, so removing an ancestry still takes its traits back wherever they are
   filed. What moves on existing sheets: only features whose source differs from their origin —
   hand-typed sources, and picked options whose pack gives a source (Eldritch Invocation, Battle
   Master Maneuver, Metamagic), which leave "Other" for a group of that name.
4. The group field: `groupFieldHTML()` and `groupChoices()` in `80-modal-forms.js` — a labelled box
   with a datalist of the groups in use, deduped by `tagKey()` and sorted A to Z. The journal page's
   tag, the tracker's tag, the feature form's Source and the item form's Category all use it; the
   journal and tracker markup is unchanged (their tracker form screenshots are byte-identical).
5. Inventory: Category was a select of the seven sections. It is now the group field, and
   `invSectionName()` reads what is typed: one of `INV_ORDER` in any case files there (so a typed
   "consumables" is still read for healing), anything else is the player's own section, and
   "★ Favorites" is not a section. `invGroups()` (pure) orders favourites, the seven, then the
   player's sections A to Z. `sectionOverride` still never touches `category`. The placeholder
   names the automatic section worked out without the override (the old select's "Automatic"
   repeated the override when one was set). A file with an unknown `sectionOverride` — only
   possible by hand-editing before this — now shows it as its own section.
6. Spells: nothing to change. They group by level, and their Origin is a fixed list of kinds that
   says which spells count against the allotment, not a free-text category.
7. `rules-data.js`'s "every id the app looks up is one it renders" counts an id passed to
   `groupFieldHTML({id:…})`, guarded by a check that the helper still renders it.
8. Tests: `sheet.js` #98 (the custom category, `invSectionName()`, `invGroups()`' order and
   grouping, a feature moving with its source, group order, case, the favourites guard, a picked
   trait's group, `groupChoices()`, `groupFieldHTML()` and its escaping, the journal and tracker
   tags, the two forms as text). The grouping tests fail on the old `20-lists.js`.
   Driven: Mike's case on the released build (Climber edited to the background's group stays under
   Mapach), the same sheet regrouped on open in the fixed build, a new "Senses" group made from the
   form, "Spell Components" made from the item form (filed after the seven, offered next time,
   folds, listed in ☰), and "tools" saved as Tools. Screenshots `.claude/qa/98-*`.

Pages: [features & traits](../wiki/features/features-and-traits.md),
[inventory](../wiki/features/inventory.md), [journal](../wiki/features/journal.md),
[sections & layout](../wiki/ui/sections-and-layout.md)
## No group may be named constructor or __proto__ (#98, 2026-10-16)

1. Mike, on the #98 known issues: make sure a group cannot be called constructor or proto; and a
   folded group reopening after a case edit of its first member is fine — not an issue.
2. The cause: the collapse maps (`featCollapse.groups`, `invCollapse.sections`, `journalCollapse`,
   `trackerCollapse`) are plain objects read by key, so a group named for an `Object.prototype`
   property read an inherited value — "constructor" or "toString" started folded, "__proto__" could
   never fold. Journal and tracker tags already had it; #98's free-text sources and categories
   reached two more maps.
3. `GROUP_RESERVED` (`00-constants.js`, beside `COMBAT_DEFAULTS` for the TDZ) is every
   `Object.prototype` name, lower-cased. `tagLabel()` turns one into no group, whatever its case or
   spacing; every grouping reads `tagLabel()` (journal pages, trackers, `featGroupLabel()`,
   `invSectionName()`, `groupChoices()`, the box's value), so a name from a file is caught too:
   a page tagged "constructor" reads as Untagged, a feature with that source files by origin.
   `tagTidy()` is the tidy alone, for the message.
4. The group field says so: `groupFieldHTML()` adds `data-groupfield`, `aria-describedby` and an
   empty `.grp-msg`; one input listener in `90-boot.js` runs `syncGroupFieldMsg()`, which names the
   word (`groupNameProblem()`) and marks the box `aria-invalid`. `groupFieldBlocked()` stops the
   feature form's Save, the item form's Save, the tracker form's Save and Close now, and the
   journal's Done, focusing the box. Refused rather than made safe in the maps: Mike asked that the
   names not be usable, and one rule at the label covers every map at once.
5. The fold-by-first-spelling note leaves Known issues and becomes a decision.
6. Tests: `sheet.js` (the reserved set, `tagLabel()` in any case, file tags as Untagged, the feature
   and item fallbacks, choices and the box's value, the message and `aria-invalid`, a blocked and an
   allowed save, every save path and the input listener as text). They fail without the
   `tagLabel()` guard. Driven: "constructor" in the tracker form (refused, tag unchanged; then
   "constructors" saved), "__proto__" in the feature form (refused), "toString" in the journal
   editor (Done stays, the page holds no tag). Screenshots `.claude/qa/98-after-reserved-*`.

Pages: [sections & layout](../wiki/ui/sections-and-layout.md), [journal](../wiki/features/journal.md),
[known issues](../wiki/roadmap/known-issues.md)
## Clicking outside a dialog no longer closes it, unless Settings says so (#106, 2026-10-16)

1. Mike: clicking outside any dialog closes it without saving — hard on a phone, where a tap beside
   a field puts the keyboard away, and on desktop with a stray click. Wanted: a global setting for
   close-on-click-outside, off by default; flyouts unaffected.
2. The one path: the backdrop listener in `80-modal-forms.js` sent every click on `#modal` itself to
   `dismissModal()`. The ☰ flyout's backdrop is its own element (`#tocBack`, handled in `wire()`),
   and the browse picker is full-screen with its own Close, so neither is touched.
3. `settings.backdropClose`, app-wide, `false` in the `settings` literal, so a player whose saved
   settings predate it starts with it off too; read as `=== true`, so a junk value from a file is
   off. It is in `SETTINGS_KEYS`, and Export/Import settings carry it. Settings → Appearance has
   the switch ("Tap outside to close dialogs", `#swBackdrop`, `role="switch"` and `aria-checked`),
   which saves at once.
4. With it on, only a click pressed and let go on the backdrop closes (`_downOnBackdrop` and
   `_upOnBackdrop`, set on `pointerdown` and `pointerup`, spent by every click): a press and a
   release on different elements deliver their click to the backdrop, so a text selection dragged
   out of a field, or (caught in review) a press outside slid onto the dialog, would close it.
   A touch release lands where its press began, so a tap works. × and Escape close as before,
   through `dismissModal()`, so the choice pickers' guard still asks.
5. Tests: `rules-data.js` (the gated handler, the pointerdown guard, the default, the switch and
   its save, `SETTINGS_KEYS`, the flyout's own close); they fail against the old code. Driven with
   real mouse input: released build, a backdrop click closed a half-typed feature form; fixed
   build, it stays with the text, × and Esc close, the flyout closes on an outside tap, the switch
   saves the setting, then a drag out of the field keeps the form and a backdrop click closes it.
   Screenshots `.claude/qa/106-*`. Not driven: touch on a real phone.

Pages: [shell](../wiki/ui/shell.md), [settings & updates](../wiki/features/settings-and-updates.md)
## Settings is a sidebar of six pages (#107, 2026-10-16)

1. Mike: the Settings dialog is cluttered and its one long scroll of five folding sections is hard
   to parse. Wanted: sidebar categories, consistent control types lined up as in a reference
   Preferences dialog, and the sidebar condensed to icons when Icon tabs is on or the screen is
   cramped. Designed with him first: spec `src/docs/specs/2026-10-16-settings-dialog-design.md`,
   plan `src/docs/plans/2026-10-16-settings-dialog.md`.
2. Six pages: Appearance (Look; Interface), Sheet display and Carrying (only with a character open,
   under a "This character" caption, each "For *name*"), Rules data (Sources; Loaded data; This
   sheet — the rules-update check moved here from the old character section), Backup (Characters;
   Settings file) and Credits (text unchanged). `SET_PAGES` and pure helpers (`setPagesFor()`,
   `setPageOf()`, `setPageStep()`, `setNavHTML()`, `setPageHTML()`, `setGroupHTML()`,
   `setRowHTML()`, `rulesNavBadgeHTML()`) replace `SET_SECTIONS`, `setSecOpen()` and `setSecHTML()`.
3. Every setting is a row: name and one help line left, control right. The type rule: on/off is a
   switch, two or three short choices are segmented buttons, a longer list is a dropdown, actions
   are buttons. So Encumbrance became segmented (`segEnc`, Off / Standard / Variant; `setEnc` is
   gone). Help paragraphs were cut to one line each, a second where a fact needed it; the Rules
   sources detail moved into tooltips. Every switch is `role="switch"` with `aria-checked` (only
   `swBackdrop` had them, since #106), kept true by one click listener on the wrapper.
4. Every page is built when the dialog opens and one is shown, so every control kept its id and
   handler, and `renderRulesData()` keeps the sidebar's count and update dot live behind any page.
   The sidebar is a vertical tab list: ↑/↓ wrap over the shown pages only, Home/End jump. The page
   last viewed is `settings.setPage` (default "appearance", in `SETTINGS_KEYS`); a character page
   with no character open, or a value that isn't a shown page, opens Appearance. `setCollapse` is
   no longer read; old files keep it, harmlessly.
5. `openModal(title, html, icon, opts)`: `{wide:true}` sets the dialog's `wide` class, cleared on
   every other open, so Import settings and the rules-update review open at normal width and
   Settings comes back wide. The wide dialog is `min(820px,100%)` by `min(680px,90dvh)`: a fixed
   height, because a shorter page shrank the dialog, which re-centred and moved the sidebar under
   the pointer (seen in the first screenshots). The sidebar and the page each scroll on their own
   (`.m-body` does not): a sticky sidebar in one scroller was cut off on an 800×360 landscape phone
   until the page reached its end, and End focused a tab below the visible area (final review).
6. The rail: 52px of icons, by `html[data-tabs="icons"]` or `max-width:640px`; on a narrow screen a
   segmented control or dropdown drops below its name and a switch stays beside it. The icons are
   stroked line drawings written into `SET_PAGES`, so they need no attribution.
7. Tests: `rules-data.js` (the registry, the fallbacks, the arrow-key steps, the nav and page
   markup, rows and groups, each control on its page, the switches' state, the wide dialog and its
   reset, the badge refresh, the CSS); the #69 title guard and the #70 reopen check updated to the
   new signature and badge. Driven with real input: tabs, ↓/↑/Home/End with and without a
   character, a switch's `aria-checked`, encumbrance and size, reopening on the last page, the
   badge behind Appearance, Clear all, Import settings and Cancel, Icon tabs from inside Settings;
   the sidebar's position constant over 24 page switches; no overflow at 390px. Screenshots
   `.claude/qa/107-*`: both skins, light and dark, every page, phone, 700px, Icon tabs.

Pages: [settings & updates](../wiki/features/settings-and-updates.md), [shell](../wiki/ui/shell.md),
[sections & layout](../wiki/ui/sections-and-layout.md), [storage](../wiki/architecture/storage.md)
## The Settings page pane keeps its controls clear of its scrollbar (#107, 2026-10-16)

1. Mike, on the pushed #107: the scrollbar overlaps the controls (Rules data: Add, Clear all, each
   pack's delete button).
2. Cause: #107's review fix made the page pane (`.set-pages`) the scroller, and it had no right
   padding; before, the dialog body scrolled and its 18px padding kept the bar clear. Measured: the
   controls ended exactly at the pane's edge (gap 0), so an overlay scrollbar drew on them.
3. Fix, CSS only: `.set-pages` takes `padding-right:14px` and `scrollbar-gutter:stable`, and the
   wide dialog's body gives back its right padding (`padding-right:4px`). Measured after: a 14px gap
   between the controls and the scrollbar, overlay or visible; no sideways overflow at 390px. Where
   a scrollbar takes space, the reserved gutter keeps pages that scroll and pages that don't the
   same width. `rules-data.js` checks the three declarations; it failed before the change.

Pages: [settings & updates](../wiki/features/settings-and-updates.md)
## The first private data release, 1.8.1-1 (2026-10-16)

1. After app 1.8.1, Mike asked for the private packs to go out too. `data-release.js --registry
   _private-data/data/packs.json --data-root _private-data/data` bumped all four (2024, Xanathar's,
   Tasha's, Humblewood) to `1.8.1-1`; committed and tagged `data-v1.8.1-1` in RPGFieldbookPrivate,
   pushed. Its `data-release.yml` and CI passed and published `fieldbook-data-private-1.8.1-1.zip`
   on the private repo only. Checked in the downloaded zip: `dataVersion` `1.8.1-1`, the Light
   Crossbow fires `bolt`, Bolts (20) is a pack of 20 Bolt (#96).
2. Running copies do not announce it: the newer-data notice reads the public repo's releases.
3. RELEASING §1c and the private-data page said the first private release would be `1.8.0-1`;
   both now name `1.8.1-1`. RELEASING also drops its 1.8.0 release-freeze note.

Pages: [private data](../wiki/data/private-data.md)
## The 1.9.0 integration plan (#100, 2026-10-16)

1. Mike: plan 1.9.0, the last feature release before the 2.0 rewrite; no development yet. The
   fifteen open issues on the v1.9.0 milestone were read with the wiki pages for every area they
   touch, mapped to the fragments each is expected to edit and the character or settings state each
   adds, and scheduled into five waves by disjoint files (WORKTREES §3): #88 alone; then
   #95→#93→#94 (one worktree), #104, #97 and #99 (with #53) in parallel; then #103 with #101 and a
   CORS spike for #102; then #91, #47, #52, #102; then #105, the capstone that needs #104, #91,
   #47 and #95.
2. Decisions, Mike's: #103 sits in the middle (not first: nothing else was ready to run beside
   it; not last: #91 and #47 would be built against the old layout). Waves run as parallel
   worktrees. #102 covers public packs only, installing the latest public data release from a
   manifest source, with a spike first on whether GitHub release assets answer `file://` with
   CORS; private packs stay file imports. Specs are written per wave, just in time, against merged
   code.
3. The rule the page states: 2.0 begins as a 1:1 port, so every field 1.9.0 adds is a save format
   2.0 must load, and each spec puts its data model first.
4. New page `wiki/roadmap/1.9.0.md`, indexed under Roadmap. Nothing in `src/` outside docs changed.

Pages: [1.9.0](../wiki/roadmap/1.9.0.md), [2.0](../wiki/roadmap/2.0.md)
## The 1.9.0 plan's open questions answered (#100, 2026-10-17)

1. Mike went through the "what each spec has to settle" list on the 1.9.0 page, one item at a
   time. Twenty decisions, now a table on the page ("Decisions made before the specs"), each with
   what was rejected and why. The specs take them as given; one found wrong is revisited in the
   spec, not quietly changed.
2. The one that moves the plan: #104 grows from M to L. Hits, not misses, are the recoverable
   shots in Hit/Miss mode; ammunition carries its own recoverability (`ammo.recover`: never for
   firearm bullets, always for thrown weapons, absent for the character's rule), set in the item
   editor and allowed in pack data; and a Thrown weapon fires itself from its own stack, which
   closes the deferred "thrown weapons track no ammunition" item once built. The recovery rule is
   per character under Sheet display, and End combat applies it with a toast and Undo in place of
   the Yes/No prompt.
3. The rest, in brief: #95 migrates checklists and tasks into tickable journal pages; #93/#94 are
   tiles in a wrapping row with the total in the group header; #97 hides edit and delete only, per
   section; #99 lists every loaded category and opens the existing info windows; #103 moves
   Attacks to Inventory and the bio fields to Story, one layout, no setting; #101 is a "Level N!"
   screen before the choice window; #91 saves combatants with the fight and seeds them from a
   party roster on Story; #47 logs every item and coin change and warns on a shortfall without
   blocking; #52 hides tabs from Sheet display, never Sheet or Combat, and a jump unhides; #102's
   source is a per-release manifest JSON and install goes through the zip importer; #105 is one
   screen whose loot opens the trade window, with flagged trackers and pages shown live.

Pages: [1.9.0](../wiki/roadmap/1.9.0.md)
## Journal checklists; trackers as counters, tiles and totals (#95, #93, #94, 2026-10-17)

1. Spec: `specs/2026-10-17-journal-checklists-design.md`; plan `plans/2026-10-17-journal-checklists.md`. One worktree, three issues, in that order.
2. The grammar (`87-notes.js`): `NOTE_CK`, a checkbox block in `noteHTML()` before bullets, one `noteInline()` per item; `noteCheckboxes()`, `toggleCheckbox()`, `noteProgress()`; ☐/☑ in the preview. CSS `.n-ck`/`.ck` in `20-cards.css`.
3. Write-back: one `[data-ck]` click in `wire()` → `jnlToggleCheckbox()` (the open page) or `noteToggleCheckbox()` (a Section Notes entry). No keydown: a `<button>` clicks natively. Progress `done/total` on the list row and the page meta. Insert checkbox in both editors (`insertMarker()`, caret after the marker).
4. Trackers keep counters only: types, items, the tick markup, the form's Type and Items, the two hooks, migrate()'s item repair, the tick CSS all gone. `migrateTrackerPages()` turns a file's checklists and tasks into pages (spec §5), dates as `toLocaleDateString()`, idempotent by construction.
5. #93: `trackerTotals[tagKey]`, Σ on the header, `trkGroupTotal()` over every counter with the tag, open or closed; the fold handlers ignore the Σ by click and by key. #94: `.trk-group` a wrapping row of `.trk` tiles; Completed stays rows.
6. Tests: `sheet.js` (grammar, toggle, progress, preview, page and note write-back, migration fixtures, counters-only form, totals), `rules-data.js` (the handlers, the editor buttons, the CSS). Driven in Playwright (Task 8, all of the brief's steps 1–9, plus the two #94 shots the #94 review couldn't verify): a three-box page ticked and un-ticked through the UI, confirming `character.journal[0].text`, the row's `1/3`→`2/3`, and the bold mid-item markup surviving (`<strong>Mire</strong>` beside the checked box); the Section Notes card's own checkbox ticked, `character.secNotes.vitals.text` confirmed, and its hover preview showing ☑/☐ glyphs with no buttons; Insert checkbox landing the caret after the marker in the journal editor (read `#jnlText`'s value and `selectionStart===value.length`), then typed into and Done, confirming a fourth box; a live `migrate()`/`finishImport()` of a checklist and two tasks (one tagged, one not) landing as three pages with the right progress (Quests: "The lost map" 1/2, "Tasks" 0/1; Untagged: "Tasks" 1/1) and an empty Trackers card; the tracker form showing Name/Tag/Goal with no Type; the same three-box page shot again on the Humblewood skin and in explicit light and dark theme. One correction made mid-run: the brief's dark-mode step reads `settings.mode="dark"`, but the field is `settings.theme` (`00-constants.js`, `applyTheme()` in `75-home-theme.js`) — `settings.mode` doesn't exist, so that line was a no-op, and since this browser profile's `localStorage` already carried `theme:"dark"` from an earlier session, both shots would have come out dark regardless of the bug. Re-shot with `settings.theme` instead, giving genuinely distinct light and dark captures. The #94 tile fixture (Goblins/Orcs goal 10/Wolves/Codex goal 300/a closed Old, `trackerTotals={kills:true}`) at 360×800: two tiles per row, nothing clipped, the Kills total reading 27 (every counter with the tag, open and the closed Old, 12+3+7+5); the same fixture with Trackers added to the Combat tab at 390px: the tiles sit inside the combat column, nothing clipped. Screenshots: `.claude/qa/95-list.png`, `95-page.png`, `95-page-ticked.png`, `95-secnote.png`, `95-preview.png`, `95-migrated.png`, `95-form.png`, `95-page-humblewood.png`, `95-page-dark.png`, `94-tiles-360.png`, `94-combat.png`.

Pages: [journal](../wiki/features/journal.md), [rich text](../wiki/architecture/rich-text.md), [story & notes](../wiki/features/story-and-notes.md), [known issues](../wiki/roadmap/known-issues.md), [1.9.0](../wiki/roadmap/1.9.0.md)
## Final review fixes: Story fields tick, totals follow a typed count, closed checklists keep their ticks (#95, #93, 2026-10-17)

1. #93: a typed count (the count box's `change`, patched in place by `trkPatchRow()`) left the group header's `.trk-total` on the old sum until the next redraw. `trkPatchRow()` now updates it too, from `trkGroupTotal()`, when the row's `.fgroup` shows one. The Σ's name is constant, "Total for <tag>"; `aria-pressed` alone carries whether the total shows.
2. #95: a `.ck` box's `aria-label` was its state ("Checked"/"Not checked"), which overrode its name. It is now the item in plain words (`noteCkLabel()`: `*` and backtick marks dropped), escaped; `aria-checked` carries the state.
3. #95: the Story tab's rich-text fields (Proficiencies and the bio cards, `character.notes` among them; `renderRT()` draws them through `richHTML()`) drew boxes that ignored taps. They are the third tickable surface: `rtToggleCheckbox(key,n)` in `10-compute.js` (beside `renderRT()`, with `rtKeys()` now the one list `renderAllRT()` also reads) refuses an unknown key, a field being edited and a no-op, else writes the field, redraws it, saves and puts focus back on the box. `wire()`'s `[data-ck]` branch finds it by its `#rt-<key>` host before the section-note owner. Pack, item and feature descriptions stay inert.
4. #95, decision 3 changed: `migrateTrackerPages()` gave a closed checklist every item ticked, which loses the real ticks for good. Each item now keeps its own tick, and the "Closed <date>" line stays. Tasks are unchanged (a task's only state is done, and a closed one is done). A `closedAt` no calendar holds (`1e20`) wrote "Invalid Date"; its `day()` now writes no date.
5. #95: `noteCheckboxes()` matched lines without stripping the sentinel characters that `noteHTML()` strips first, so a line starting with one drew a box that wasn't counted, and a tap flipped the wrong line. It now matches on the stripped line, keeping the text's own line indices.
6. The empty Trackers hint no longer offers "the steps of a quest" (a journal checklist now); `migrateTrackerPages()`'s comment no longer calls it pure.
7. Tests: `sheet.js` (the in-place total through a hand-built row/group DOM, as the #41 in-place tests do; the box's label, plain and escaped; the Story write-back, refused while editing and for an unknown key; the closed-checklist fixture, now `[x] a\n[ ] b\n\nClosed <date>`; the sentinel line; the junk date; the Σ's constant name; the hint), `rules-data.js` (the `[data-ck]` branch's `#rt-` owner). Driven in Playwright: a Story Notes field with `[ ] buy rope\n[x] sharpen sword`, its first box clicked, `character.notes` read back as `[x] buy rope…` with focus on the same box (`.claude/qa/95-story-tick.png`); a Kills group with its total on (5 + 2 → "· 7"), 12 typed into Goblins' box and a click elsewhere, the header reading "· 14" with no redraw (`.claude/qa/93-total-after-typing.png`).

Pages: [journal](../wiki/features/journal.md), [rich text](../wiki/architecture/rich-text.md), [story & notes](../wiki/features/story-and-notes.md), [known issues](../wiki/roadmap/known-issues.md), [decisions](../wiki/decisions.md)
## The #104 spec: ammunition recovery options and thrown weapons (#104, 2026-10-18)

1. Brainstormed with Mike: spec `specs/2026-10-18-ammo-recovery-design.md`. A per-character rule
   (`character.ammoRecovery`: half, all, hits, none; default half, so every sheet keeps today's
   behaviour), an item's own `recover` (always, never) that wins over it, None included; app-side
   defaults (firearm bullets never, Thrown weapons always); every hit comes back in Hits-only;
   thrown weapons get Throw and stay on the sheet at ×0; End combat recovers on its own with an
   Undo recovery; the rule is read at recovery, and an unanswered shot comes back at half.
2. One decision recorded on the 1.9.0 page changed: the override is a top-level item field set in
   the item editor, not `ammo.recover` in pack data, so no pack digest moves and no data release is
   needed.

Pages: [1.9.0](../wiki/roadmap/1.9.0.md)
## Ammunition recovery options and thrown weapons (#104, 2026-10-19)

1. Built on `issue/104-ammo-recovery`: spec `specs/2026-10-18-ammo-recovery-design.md`, plan
   `plans/2026-10-19-ammo-recovery.md`. Seven feat/fix commits plus this docs task.
2. The rule: `character.ammoRecovery` (`AMMO_RECOVERY`: half/all/hits/none), default `"half"`, read
   through `ammoRecoveryOf()`. The override: a top-level `item.recover` (`"always"`/`"never"`),
   outside `ammo` and `weapon`, read through `itemRecover()`; the app's own defaults
   (`AMMO_RECOVER_DEFAULTS`, `ammoDefaultRecover()`) make a firearm bullet never and a Thrown weapon
   always. `ammoRecoverRule()` chains item override → app default → sheet rule; None never overrides
   an item set to Always. `ammoBack()` is the per-entry table (half/all/hits/none).
3. The tallies: `ammoSpentEntry()` adds `hits`/`misses` to each entry, clamped so
   `hits + misses ≤ n`; `ammoRecordShot()` (new, shared by Fire and Throw) rebuilds the entry every
   shot. `ammoAsks()`/`askAmmoOutcome()` ask Hit or Miss first, only under the Hits-only rule;
   closing the dialog fires nothing.
4. Throw: `weaponThrown()` reads the Thrown property out of `weapon.notes`; `ammoThrownKind()` is
   the weapon's own lower-cased name; `throwAmmo()` spends one off the weapon item's own count,
   never below 0, the item staying on the sheet at ×0 so its row and Throw don't vanish mid-fight;
   `throwWeaponTap()` is the DOM tap, sharing `shotDone()` with `fireWeapon()`. `ammoLineHTML()`
   draws `thrownLineHTML()` under a thrown weapon's row instead of a launcher's line, only while
   equipped.
5. Recovery's record and Undo: `recoverAmmo(c, kinds, rec)` now takes an optional `rec`, filled with
   `added`/`made`/`repointed` (each carrying `from`, the `ammoSpent` id it answers for) and
   `cleared`. `undoRecovery(c, rec)` reverses exactly that recovery once: a shortfall from a shot
   fired since comes off the restored entry first (never double-counted); a cleared entry with no
   stack dependency at recovery is restored unless its granting source has since been revoked
   (`grantSidLive()`, mirroring the race/bg/class/subclass sid shapes the three `remove*()`
   functions check). Review round 1 (commit `3cbc6a5`) folded in three findings on this path before
   it shipped; review round 2 (commit `554f6e3`) fixed three more after the rest of the feature
   landed: re-syncing the item editor's Recovery field on Insert from pack (`recoverShows()`);
   `inventoryTotal()`/`itemWeightTotal()` reading quantity through `itemQty()` so a ×0 item adds
   nothing and its row badge shows `×0` instead of looking like `×1`; and `undoRecovery()`'s
   `take()` being a true no-op at `n===0`, so Undo no longer deletes a ×0 stack it gave nothing to.
6. End combat: `applyAmmoRecovery()` replaces `offerAmmoRecovery()`'s Yes/No question — it recovers
   on its own whenever anything is recoverable, and its summary and record join the End combat toast
   with an **Undo recovery** action (`undoRecoveryTap()`), scoped to the character it was shown for.
7. Settings → Sheet display gained an *Ammunition* group with the "Ammo recovery" dropdown
   (`setAmmoRec`, four choices with a help line). The item editor gained an "After a fight" select
   (`recoverOptionsHTML()`) for ammunition and Thrown weapons, shown by one shared rule
   (`recoverShows()`) so the initial render, the Ammunition toggle and Insert from pack can't drift.
8. Tests: `sheet.js` — `ammoRecoveryOf()`/its default, `ammoRecoverRule()` for every source,
   `ammoBack()` across the table including Hits-only with unanswered shots, `ammoSpentEntry()`
   clamping, `weaponThrown()` over the SRD weapons' notes and a junk/substring case, `fireAmmo()`
   with each outcome and `undoFire()`, `throwAmmo()` down to ×0 and back through Undo,
   `recoverAmmo()` under each rule (None with an item set to Always, onto a thrown weapon at ×0) and
   its record, the recovery Undo after a later shot, the `ammoRecovery`/`recover`/tallies round trip,
   a hostile `recover` value, and (round 1) the `inventoryTotal()`/badge/Undo-no-op fixes. `rules-data.js`
   — the Throw/Hit/Miss hooks wired, the Settings row and the item editor's select both wired, and
   (round 1) the Insert-from-pack resync.
9. QA driven in Playwright (Task 7, this entry): all seven of the brief's steps — the Longbow/Dagger
   rows (Fire, Throw), the Hits-only question (Hit, Miss, Escape firing nothing, `ammoSpent.s1`
   checked after each), Throw twice to ×0 with Throw disabled, `startCombatNow()`/`endCombatAsk()`
   with the confirm stubbed (the toast read "Combat ended after 1 round (6 sec) · recovered 1 of 2
   arrows, 2 of 2 daggers", Arrow ×9/Dagger ×2, then Undo recovery back to Arrow ×8/Dagger ×0 with
   `ammoSpent` restored), the Settings dropdown (read "Hits only", set to `"none"` and confirmed on
   `character.ammoRecovery`), the item editor's "After a fight" showing "Default (always comes
   back)" for the Dagger and Save-with-no-change leaving it at ×0, and the same rows and Throw
   repeated on a Humblewood character and at 390×844. Nothing driven disagreed with the spec or the
   code; no bug found. Screenshots: `.claude/qa/104-rows.png`, `104-question.png`,
   `104-thrown-zero.png`, `104-end-combat.png`, `104-settings.png`, `104-item-editor.png`,
   `104-rows-humblewood.png`, `104-rows-phone.png`.

Pages: [ammunition](../wiki/features/ammunition.md), [combat view](../wiki/features/combat-view.md),
[inventory](../wiki/features/inventory.md), [settings & updates](../wiki/features/settings-and-updates.md),
[character model](../wiki/architecture/character-model.md), [known issues](../wiki/roadmap/known-issues.md),
[1.9.0](../wiki/roadmap/1.9.0.md)

## Final review fixes (#104, 2026-10-19)

1. **End combat retires every outstanding count** (controller ruling, reversing the plan's
   narrowing). `applyAmmoRecovery()` used to recover only the kinds with something to give back,
   so under None, Never or the firearm-bullet default the counts were never cleared: they piled up
   fight after fight and came back in full when the rule later changed (three None fights of 10
   arrows, then All → 30 back), and a Never stack's count was cleared or kept depending on whether
   another stack of its kind gave anything. It now calls `recoverAmmo(character, null, rec)`
   whenever any entry is outstanding: each gives back what its rule allows and is cleared, the rest
   spent (spec §4.3). Something back → `{text, rec}` as before, and Undo recovery restores every
   entry it cleared, zero-back ones included. Nothing back → the counts clear quietly and it
   returns `null` (no toast words, no Undo). A direct `recoverAmmo(c, kinds)` that names kinds
   still leaves other kinds alone — the row's Recover is unchanged.
2. **A thrown weapon's row reads its own entry.** `thrownLineHTML()` looked Recover N up by
   `ammoThrownKind(it)` — the weapon's current name — so renaming "Dagger" to "Silvered Dagger"
   after a throw hid Recover N though End combat still recovered it, and two weapons of the same
   name shared one N. The row's N is now `ammoThrownBack()` — `ammoBack()` of the rule over the
   entry under `it.id` — and `recoverWeaponAmmo()` recovers that one entry by id
   (`recoverAmmo()` gains an optional fourth `ids` filter), so the row's N and what its tap gives
   back agree.
3. **The print sheet counts a ×0 item.** `printSheet()` added "×N" only when `num(it.qty)>1`, so a
   thrown weapon spent to ×0 printed as if ×1. It now shows the count whenever `itemQty(it)!==1`,
   as the inventory badge does; the known-issues Limitation is removed.
4. **The item editor's "After a fight" field follows the form.** The Ammunition toggle re-checked
   visibility against the weapon the item *opened* with, so after Insert from pack of a Dagger,
   ticking Ammunition on and off hid the field though Save still kept the Dagger's choice.
   `syncRecover()` in `openItemForm()` now reads the weapon Save would build — Weapon ticked, its
   notes carried from the entry last inserted, what it fires from the select — and runs on the
   Weapon and Ammunition toggles, the fired-kind select and Insert from pack.
5. Docs: the spec's As built corrects the §5.2 note (the equipped-only rule is the universal one,
   not an override for thrown weapons), records the editor's labels as built, that only pack data
   marks a weapon Thrown (the editor has no notes field — §5.1's "typing the property" is wrong),
   that a count declined under the old Yes/No question is recovered at the first End combat after
   upgrading, and this entry's End combat reversal. Two Limitations join known issues: Undo
   recovery drops a home-joined entry's unrecovered remainder once the home stack is fired out,
   and `grantSidLive()` checks the source now, not "revoked since".
6. Tests (`sheet.js`): End combat clears the zero-back needle and, under None, clears every count
   quietly (no "recovered", no Undo); three None fights then All recovers nothing; Undo recovery
   after an End combat that also cleared a zero-back entry restores it; throw, rename, the row
   still shows Recover 1 and the tap recovers it; two same-named daggers each show and recover
   their own; the print sheet shows ×0 and ×3 and leaves ×1 plain; the item editor's field stays
   shown through Ammunition on/off after Insert of a Dagger, hides with Weapon off and for a
   weapon that fires ammunition, and Save keeps the choice.
7. QA driven in Playwright: (a) the keyboard path — Tab from the Longbow row's Delete onto Fire,
   Enter opened "Longbow: hit or miss?" with focus on Hit and nothing fired, Enter fired a hit
   (`ammoSpent.s1` `{n:1, hits:1}`, Arrow ×9, toast "Fired an arrow · hit · 9 left"), focus back on
   Fire → `.claude/qa/104-keyboard.png`; (b) under None, three shots then End combat: toast
   "Combat ended after 1 round (6 sec)" with no recovery words and no Undo, `ammoSpent` `{}`,
   Arrow count unchanged → `104-none-end.png`; (c) Throw on the Dagger, renamed to "Silvered
   Dagger" in the item editor and saved: the row reads "Silvered Dagger ×1 · Throw · Recover 1"
   → `104-renamed.png`; tapping Recover 1 gave it back (×2, `ammoSpent` `{}`). Not driven in the
   browser: item 4 (no rules pack loaded in the QA page; the harness drives it through the form).

Pages: [ammunition](../wiki/features/ammunition.md), [combat view](../wiki/features/combat-view.md),
[inventory](../wiki/features/inventory.md), [settings & updates](../wiki/features/settings-and-updates.md),
[known issues](../wiki/roadmap/known-issues.md), [decisions](../wiki/decisions.md)
## /status and /release: the session status log and a release skill (#108, #109, 2026-10-19)

1. Mike added "Session status log" to CLAUDE.md: `.claude/status.md` kept current for his daily
   update. `.claude/*` is git-ignored, so `.gitignore` gains `!.claude/status.md`. With parallel
   worktrees, every branch rewriting one summary file would conflict on every merge, so (Mike's
   call) it is written on main only: worktree branches never touch it, and WORKTREES §5 refreshes it
   after the merges. CLAUDE.md's section says so.
2. Two project skills, slash commands (Mike's ask): `/status` (`.claude/skills/status/`) and
   `/release [app|data|private] [version]` (`.claude/skills/release/`, `disable-model-invocation:
   true`, so only Mike starts one). CLAUDE.md's "never cut a release on your own" names `/release`
   as the exception: it cuts only after Mike confirms the exact version and publishes only after he
   says "publish". RELEASING.md stays the reference; the skill links it.
3. Written test-first (writing-skills): five baseline scenarios without the skills, then with them.
   Baselines: every release scenario refused to cut or publish even when Mike asked ("never on your
   own" read as "never"), one let an uncommitted modified file into a release, only one checked the
   result after publishing; the status baseline misstated two items and missed the milestone,
   release readiness and worktrees. With the skills all five passed; two loopholes closed after the
   runs (no version proposed while `??`/` M` questions are open; known issues are not loose ends).
4. Memory: the "never release" note now says "only via /release"; a stale index line for a deleted
   1.8.0-freeze note removed.

Pages: [building & CI](../wiki/process/building-and-ci.md)

## Releases wait for Mike's approval (#109, 2026-10-19)

1. Mike asked whether a release needs his approval as its last step. It did not: pushing a `v…` or
   `data-v…` tag published at once, and nothing but instructions kept Claude from pushing one.
2. `release.yml` and `data-release.yml` are each split in two. `verify` (`contents: read`) runs
   every existing check, builds, writes the notes to `dist/release-notes.md` and uploads the assets
   as a workflow artifact; `publish` (`needs: verify`, `environment: release`, `contents: write`)
   downloads them and runs the same `gh release` commands. The public repo's `release` environment
   has Mike as required reviewer, so `publish` waits for him in the run page; a manual re-publish
   waits too. `data-release.yml`'s publish job checks out the tag (full history) for the git tag
   lookup and the "app release still latest" step.
3. `.claude/settings.json`, now tracked (`.gitignore` exception), sets Claude Code `ask` rules on
   `git tag`, `git push --follow-tags|--tags`, pushing `v…`/`data-v…` tags, `gh release
   create|edit|delete`, `gh workflow run`, and the `_private-data` tag and push commands.
4. The private repo cannot have the environment: GitHub answers 422 (required reviewers on a
   private repo need a paid plan). The empty environment the attempt left was deleted. Recorded in
   known issues.
5. The `/release` skill's §6 says the run waits for Mike's approval and that Claude never approves.

Pages: [building & CI](../wiki/process/building-and-ci.md), [private data](../wiki/data/private-data.md),
[known issues](../wiki/roadmap/known-issues.md)

## Hideable edit buttons (#97, 2026-10-19)

1. Every list card gains a pencil in its header, beside the combat toggle and the note button. A
   tap hides that card's edit, delete and remove buttons — the riskiest ones, a mis-tap from losing
   a feature, an item or a class — and keeps every play control (stars, folds, Use, Fire, Throw,
   Cast, equip, On/Off, prepared pins, resource −/+/reset, the familiar's Summoned switch, + Add).
   One switch per card, per character, default shown, so no existing sheet changes. Design:
   [the spec](../specs/2026-10-19-edit-toggle-design.md).
2. Decisions (settled with Mike, recorded in the spec): edit/delete/remove only, never a play
   control; one switch per card, not one sheet-wide switch; every card with such a button, including
   the class and ancestry/background chips' Remove and Section Notes, not just the plan's original
   seven; the Rules tab's glossary stays out (app-wide data, not a character); shown by default; CSS
   does the hiding (`.ed` on each button, `.ed-off .ed{display:none!important}` on a hidden card),
   so no renderer reads the flag and a rebuilt row stays hidden for free.
3. Data (`71-char-io.js`, `00-constants.js`): `character.editHide`, a card key → `true` when hidden;
   `blankChar()` defaults `{}`; `migrate()`'s object-shape guard (beside `noteCollapse` and
   `trackerTotals`) turns a non-object, an array or null back into `{}`. Values read `=== true`, so
   junk in the map reads as shown.
4. The registry (`87-notes.js`): `EDIT_CARDS`, the twelve keys — `class`, `origin`, `statuses`,
   `attacks`, `resources`, `features`, `familiars`, `spells`, `inventory`, `trackers`, `journal`,
   `secnotes`. The first ten are `NOTE_SECTIONS` ids; `journal` and `secnotes` are the two cards
   outside that registry, found by id (`#journalCard`, `#notesCard` — the Section Notes card gained
   the latter). `editHidden()`, `setEditHidden()`, `editCardTitle()`, `editToggleText()`,
   `editToggleSVG()`, `editToggleHTML()` (pure), `editCard()`, `renderEditToggles()`,
   `paintEditToggle()`, `toggleEditCard()`. `renderEditToggles()` mirrors `renderCombatToggles()`:
   idempotent, replaces only its own button (never `label.innerHTML +=`), sits before the combat
   toggle or the note button so the note keeps the far right, and sets `ed-off` both ways so
   switching to a character who hides nothing clears the last one's. A tap flips the map,
   `classList.toggle("ed-off")`s the card, repaints the one button in place (so a keyboard Enter
   keeps focus on it) and `scheduleSave()`s — no list re-renders. `toggleEditCard("journal")` also
   calls `renderJournal()`, since a blank page's empty-state line names the Edit button.
5. The `ed` class landed on all 21 edit/delete/remove buttons across `20-lists.js`, `40-sheet.js`
   (items, statuses, familiars), `50-classrace.js` (the class, race and background chips' Remove),
   `60-attacks.js` (attacks, spells), `65-resources.js`, `87-trackers.js` (a counter's pencil — its
   only way into the form, so hiding Trackers hides delete too, by decision), `87-journal.js` (a
   page's Edit/Delete) and `87-notes.js` (a section note's edit pencil). `20-cards.css` gained the
   `.edbtn`/`.edicon` look (shown: a faint plain pencil; hidden: the pencil with a slash, in accent,
   `aria-pressed="true"`) and the one hiding rule. `60-journal.html`'s blank-page line now reads
   "Nothing written yet." with no "— tap Edit" when the Journal's buttons are hidden
   (`87-journal.js`). `renderAll()` (`66-coins-hp.js`) calls `renderEditToggles()` right after
   `renderNoteIcons()`; `90-boot.js` wires `[data-edtoggle]` to `toggleEditCard()`.
6. Tests: `sheet.js` — the default `{}` and every card starts shown; `blankChar()` never sets a key
   it shouldn't; `migrate()` repairs a string/array/null/missing `editHide` to `{}` and round-trips
   a real one; hiding/showing writes and clears the key; a non-card key is refused;
   `editHidden()` reads only a literal `true` and copes with a missing or wrong-typed map, a
   non-card key, and a null character; `editCardTitle()` for all twelve; `editToggleHTML()` in both
   states (classes, `aria-pressed`, title, label, the slash). `rules-data.js` — a play-control scan
   (new, `test(#97)`) asserts every edit/delete/remove button in every renderer's sample markup
   carries `ed` and every play-control button (`.fav`, `.fitoggle`, `.equip`, `.use-go`,
   `data-prep`, `data-cast-spell`, resource `.res-btn`, the familiar's Summoned switch, `+ Add`
   variants) does not, so a future renderer that forgets the class fails the suite instead of
   shipping silently; the `EDIT_CARDS` registry reaches a real card for every key; the CSS rule
   exists; the boot wiring exists.
7. QA driven in Playwright, both skins, four tabs (Sheet, Spells, Inventory, Journal), a character
   with a class, a species, a background, two features, two items, a status, a familiar, a player
   resource, a spell, an attack, a tracker, a journal page and a section note, built directly on
   `character` via `browser_evaluate` (not through rules-pack lookups, so `system` landed on
   `"humblewood"` per `newCharacter('QA','srd52')`'s literal call — content was hand-built either
   way): all twelve cards show the pencil in header order (pencil, combat, note) on both skins;
   Features' pencil hides its edit/delete while stars, folds, On/Off and Use stay, turns accent with
   a slash (`aria-pressed="true"`), and a second tap restores them; the same for Inventory, Class
   (the chip's Remove) and Trackers; hiding Features and reloading reads the flag back from storage
   (the app does not autoload without a starred character, so the check loaded the sheet explicitly
   — `editHide` was already `{true}` in its stored JSON before the load ran); a second, untouched
   character's Features shows its buttons; adding an Attack (already a default combat section) and
   entering combat, its pencil there hides the card's edit button and repaints, matching the Sheet
   tab's state (the same card node, moved); hiding Journal and opening a page with a title but no
   text shows "Nothing written yet." with Edit/Delete in the markup but `display:none`; a pencil
   focused directly and activated by a real `Enter` keypress toggles `aria-pressed`, `editHide` and
   keeps focus on the button. Not driven: tabbing from a cold page through the full tab order to
   reach a pencil (the button was focused by script, then Enter was a real keyboard event); real
   devices, touch and print, Mike's own characters, as every screenshot QA leaves to him.
   → `.claude/qa/97-before-<tab>-<skin>.png`, `97-after-<tab>-<skin>.png`, `97-features-hidden.png`,
   `97-class-hidden.png`, `97-inventory-hidden.png`, `97-trackers-hidden.png`, `97-switch.png`,
   `97-combat.png`, `97-journal.png`.

Pages: [sections & layout](../wiki/ui/sections-and-layout.md),
[character model](../wiki/architecture/character-model.md), [journal](../wiki/features/journal.md)

## The Rules tab as a browser (#99, #53, 2026-10-22)

1. The Rules tab becomes a browser over everything the loaded packs hold, replacing the old
   Glossary-and-Tables cards: a sidebar of eleven categories (Classes, Subclasses, Species,
   Backgrounds, Feats, Traits, Spells, Items, Conditions, Glossary, Tables) with counts and a search
   across all of them; a category opens a sortable table with its own search and the Add pickers'
   filters; a row opens the window the sheet already uses for that entry. It is read-only — nothing
   here adds to the character (#53's scope). Why: a rules question mid-session meant leaving the
   sheet or guessing which Add picker held the answer; the tab held only the glossary and reference
   tables. Design: [the spec](../specs/2026-10-19-rules-browser-design.md),
   [the plan](../plans/2026-10-21-rules-browser.md).
2. Decisions (spec §2, settled with Mike 2026-10-16/19): every loaded category plus Glossary and
   Tables, fixed order, an empty one hidden; a row opens the existing info windows, unified, rather
   than a second rendering; the class, subclass, species and background windows gain a reference
   mode (`{ref:true}`) for this use, showing the rules without this character's level, subclass or
   choices; narrow screens get a list-then-table screen with "← Categories", not a chip row or a
   dropdown; one search box above the sidebar plus each table's own; one generic table driven by a
   config per category, in a new fragment; a Source column everywhere, and a Pack filter only when
   more than one pack is loaded; Conditions is its own category, over the glossary terms marked
   `cond`, not left inside the Glossary.
3. Rulings the plan added beyond the spec's literal wording (`src/docs/plans/2026-10-21-rules-browser.md`,
   Global Constraints): the **Glossary is always listed, even empty**, so its + Add stays reachable;
   **Subclasses lists `subclassesFor()` of every loaded class** (its own inline subclasses plus any
   loose `rules.subclasses` entry), not `rules.subclasses` alone, because the SRD pack carries
   subclasses inside each class and the literal source would leave the category empty for an
   SRD-only player; **Tables gets a Source column too**, since decision 7 outranks its shorter §4
   column list; **the Pack filter is per category**, added when that category's own rows span more
   than one pack; **with no pack loaded, the import prompt shows above the browser**, which then
   lists only the Glossary.
4. Shared builders, moved out of the pickers' closures into named functions both the pickers and the
   Rules tab call (`85-browse.js`): `ITEM_RARITIES`, `itemCatOf()`, `itemRarOf()`, `itemFacets()`,
   `spellClassesOf()`, `spellSchoolOf()`, `spellFacets(lib,opts)` (`opts.classDefault`: `"mine"` for
   the pickers, `"all"` for the Rules tab's lookup), `featFacets()`; and two viewers lifted out of
   the item and feat pickers' previews, so the Rules tab opens the very same one: `openItemInfo(x)`,
   `openFeatInfo(w)`. The pickers' own tests keep passing unchanged — the proof the lift did not
   change their behaviour.
5. The four windows learn to open by `_id` and in reference mode (`56-class.js`, `52-race.js`,
   `54-background.js`): `openClassInfo(idOrName,opts)`, `openSubclassInfo(classIdOrName,subName,opts)`,
   `openRaceInfo(idOrName,opts)`, `openBackgroundInfo(idOrName,opts)`. Without `opts` every sheet
   call is unchanged; `{ref:true}` drops the character entirely (no "current", no subclass marker,
   no "your choices") and a class window's subclass links carry `data-sub-ref="1"` so they stay in
   reference mode too (`90-boot.js`'s `[data-sub-info]` handler reads it). Two packs' same-named
   entries (two "Fighter"s, two "Elf"s) now open their own, since `_id` resolves before name.
6. The browser itself, `src/js/86-rules-browser.js` (new, 33rd JS fragment, after `86-tables.js`):
   `RB_CATS`'s eleven configs (rows, columns, filters, default sort, the window a row opens);
   `rbShown()`, `rbCat()`, `rulesCatOf()`, `rbFacets()` (the per-category Pack filter), `rbState()`,
   `rbPasses()`, `rbSorted()`/`rbSortBy()` (numeric, cost-by-gold-value, level-cantrips-first,
   reversing, blanks last), `rbToggleFacet()`/`rbClearFacets()`, `rbFindRow()`/`rbOpenRow()`; the
   markup strings `rbSideHTML()`, `rbHeadHTML()`, `rbFacetsHTML()`, `rbBodyHTML()` (the 300-row cap
   and "Show N more"), `rbSearchHTML()` (the cross-category grouping, 8-row cap, "N more in
   Category →"); the DOM half `renderRulesBrowser()`, `rbPaintSide()`, `rbRefreshBody()` (typing in a
   category's own box repaints only this, never the box itself — Review Focus 3), `rbOpenCat()`,
   `rbBack()`, `rbMoreIn()`, `rbCurKey()`. Every field is read through `rbStr()` and the named
   helpers (`glossTerm()`, `tableRows()`, `featPickKind()`, …), never raw, so a malformed pack entry
   (a keyword with no term, a table whose rows are not a list, a null entry, a numeric name) renders
   blank or is skipped rather than stopping the tab (#71).
7. The old tab is gone: `src/html/40-rules.html` is one card (`#rbCard`, `data-screen="list"|"table"`);
   `renderGloss()`, `renderTables()`, `RULES_SECS`, `rulesSecOpen()`, `setRulesSecOpen()`,
   `renderRulesSections()`, `toggleRulesSec()` are deleted; `SETTINGS_KEYS`'s `"rulesCollapse"`
   becomes `"rulesCat"` (the old key is left alone in a stored settings file — harmless unknown
   data); `buildToc()` gains the Rules tab's case, listing `rbShown()`'s categories and opening one
   through `rbOpenCat()`. CSS for the sidebar, the sortable headers and the narrow one-pane-at-a-time
   layout lands in `35-tables.css`; `.rules-head` is removed from `20-cards.css`.
8. Tests: `sheet.js` pins the lifted builders and viewers match the pickers' own, the four windows'
   id/reference-mode behaviour (including an unknown name, and two packs' same-named entries each
   opening their own), and the browser rendering over every category without throwing on a tidied,
   partly malformed pool. `rules-data.js` pins `RB_CATS`'s shape (Name first, a Source column, a
   window per category), the category order, subclasses via `subclassesFor()`, sorting (numeric,
   cost, level, reversing, blanks last), the Pack filter's one-per-category rule, the Glossary's
   always-listed rule and its own entries' Preview/Edit/Delete, the 300-row cap and "Show more", the
   cross-category search's grouping and 8-row cap, `rulesCatOf()`'s fallback (including a now-empty
   stored category), the markup (the browser's ids, the old ids and renderers gone, the narrow CSS,
   the boot wiring, the delegated typing-repaints-body-only rule), and the render invariant
   (`renderRulesBrowser()` in both `renderAll()` and `refreshRulesUI()`). `./src/tests/run.sh` green
   across every suite, including `docs` (fragment count 33, the new fragment named in the overview
   and on this page's own `Code:` line) and the `private-data`/`srd-verbatim` suites where available.
9. QA driven in the project's Playwright MCP, both skins, 1280×900 and 390×844, the real SRD 5.2 pack
   (570 items, 339 spells, 12 classes, 9 races, 4 backgrounds, 17 feats, 71 tables, 136 keywords)
   fed in through the hidden `#rbRulesFiles` input (`importRulesFiles()`), not fabricated fixtures:
   the sidebar with counts (wide) and the category list (narrow) before and after, both skins; Spells
   sorted by Level (▲ then ▼ on a second tap) and filtered to School: Evocation (339 → 54, the table
   and count both changing); typing three letters into a category's own search box keeps focus and
   the caret and every letter lands, confirmed by reading `document.activeElement` and the input's
   value after typing with real keystrokes (Review Focus 3); a row of all nine window kinds opened
   (a class in reference mode — no "current", its subclass link carrying `data-sub-ref`; that
   subclass from the class window; a species; a background; a feat; an item; a spell; a condition; a
   table); narrow Items → table with "← Categories" → tap back → the list, with focus landing back on
   the Items button; a cross-category search for "fire" (Spells 7, Items 16 with "8 more in Items →",
   Tables 1) and following the "more in" link into Items with "fire" carried into its own box; the
   Glossary's + Add creating an entry that shows "Yours", Edit renaming it, Delete removing it
   (Review Focus 5); the ☰ flyout listing all eleven categories and opening one on tap; a full page
   reload keeping the last-opened category (`settings.rulesCat` surviving the round trip, backed by
   the rules cache restoring the pack too); the item and feat pickers' previews unchanged after the
   lift (same titles, same body); a literal `[Table: Beast Shapes]` anchor inside the Druid's Wild
   Shape feature prose still resolving to a `.tblref` chip and opening the table, alongside the
   class's own `tableChipsHTML()` row.
10. **Two findings from the brief's narrow-screen and ☰-flyout checks, not fixed here (QA only, no
    product code touched):**
    - **(a) Leaving the Rules tab and coming back does not return to the category list.**
      Spec §7 says "The tab opens on the category list." `rbUI.screen` is a module-level flag that
      `selectTab()` never resets, so a tab switch away and back (at any width, confirmed narrow)
      shows the last table, not the list. `rbBack()` is the only path that sets it to `"list"`.
    - **(c) The ☰ flyout, picked from deep in a long table on a wide screen, can leave the pane
      off-screen.** `rbOpenCat()` (called from `buildToc()`'s Rules-tab entries) repaints the pane
      but never scrolls, unlike every other tab's flyout entries, which call `scrollToCard()`.
      Scrolled to y=3000 inside Items (570 rows) then picking Spells from the flyout left the
      viewport at y=3000 while the now-shorter Spells pane's top sat at y=-2868 — an empty-looking
      screen until the player scrolls up by hand. Screenshots: `.claude/qa/99-tabswitch-table-not-list.png`,
      `.claude/qa/99-toc-offscreen-bug.png`.
    - (b) and (d), also asked for by the brief, hold as specified: narrow's "← Categories" returns
      keyboard focus to the category button just left; at 360–390px the Spells table scrolls
      sideways inside its own box while the page's `document.documentElement.scrollWidth` stays
      equal to its `clientWidth` (no page-level sideways scroll).
11. Screenshots: `.claude/qa/99-before-<1280|390>-<classic|humblewood>.png`,
    `99-after-<1280|390>-<classic|humblewood>.png`, `99-before-preview-<item|feat>.png`,
    `99-after-preview-<item|feat>.png`, `99-spells-filtered.png`,
    `99-window-<class|subclass|species|background|feat|item|spell|condition|table>.png`,
    `99-narrow-table.png`, `99-search.png`, `99-more-in.png`, `99-glossary.png`, `99-toc.png`,
    `99-table-anchor-chip.png`, and the two bug shots above. Not driven: real devices, touch, print,
    and Mike's own characters, as every screenshot QA leaves to him; the task's "more in Spells"
    example — the real pack's "fire" search had only 7 Spells hits (under the 8-row cap), so the
    "more in" link that actually appeared was Items', and that is the one followed and shot.

Pages: [rules & tables](../wiki/features/rules-and-tables.md), [shell](../wiki/ui/shell.md),
[sections & layout](../wiki/ui/sections-and-layout.md), [decisions](../wiki/decisions.md),
[character building](../wiki/features/character-building.md), [inventory](../wiki/features/inventory.md),
[features & traits](../wiki/features/features-and-traits.md), [1.9.0](../wiki/roadmap/1.9.0.md)

## The Rules browser: final-review fixes (#99, 2026-10-22)

Fixes for the two findings L6327 §10 left open, plus three more caught in the same final-review
pass over `src/js/86-rules-browser.js`. This entry supersedes L6327 §10's (a) and (c), and its
"Open" wiki rows — both are fixed now, not still open.

1. **(a) The tab now always opens on the category list on re-entry.** `rbUI.screen` was a
   module-level flag `selectTab()` never touched, so leaving the Rules tab for another and coming
   back showed whatever table was last open, at any width — the spec (§7) says "the tab opens on
   the category list." New function `rbToList()` (`86-rules-browser.js`) sets `rbUI.screen="list"`
   and `#rbCard`'s `data-screen` to match; `selectTab()` (`40-sheet.js`) calls it when `name==="rules"`
   and the tab being left (`was`) is not already `"rules"`. A runtime-only call — no TDZ risk, since
   function declarations hoist across the whole concatenated script regardless of fragment order.
2. **(c) The ☰ flyout's Rules-tab entries now scroll the pane into view.** `buildToc()`'s Rules
   case called `rbOpenCat()` to repaint but never scrolled, unlike every other tab's entries
   (`scrollToCard()`), so picking a shorter category from deep in a long table's scroll position
   could leave the newly painted pane off-screen. The entry's click handler now also calls
   `scrollToCard(document.getElementById("rbCard"))` after `rbOpenCat()`. While there: each entry's
   text gains its category's row count ("Spells (339)"), matching the sidebar; and the dead
   "No sections here." branch is deleted — the Glossary is always listed (its own + Add needs to
   stay reachable), so this pane is never empty.
3. **Subclasses' Class column and facet now read the display name, not the plain one.** With two
   base packs both naming a class "Fighter" (plausible once a second 2024-era or homebrew pack
   loads alongside SRD), the Class column and its filter options showed "Fighter" twice with no way
   to tell them apart. Both now call `rbName(r.cls,"classes")` — already used for the Name column,
   it runs the class entry through `dispName()`, which appends " (SRC)" only when two packs share a
   name — instead of the plain `rbStr(r.cls.name)`.
4. **`rbNum()` took every digit, not the first number.** `"1d10".replace(/[^0-9.-]/g,"")` reads
   "110", which sorted a 1d10 hit die (or any "NdM" text) nowhere near where its size belongs.
   `rbNum()` now matches the first run of digits (`/-?\d+(?:\.\d+)?/`) and parses that, so "30 ft"
   is 30, "d12" is 12, and "" is `null`, matching the old behaviour for every value that was never
   ambiguous in the first place.
5. **Persisting the opened category gained a test.** `rbOpenCat()` already wrote `settings.rulesCat`
   and called `saveSettings()` — nothing in the product changed — but nothing asserted it survived
   into the stored settings blob a reload reads back. `rules-data.js` now opens a category and
   checks both `settings.rulesCat` and the parsed `localStorage` entry under `K_SET`.
6. **The stale fold-state decisions are rewritten.** The Rules tab's old two-section fold
   (`settings.rulesCollapse`, gone since L6327) left three rows describing it as current: "Where
   the fold state lives" and "Default fold state" (`decisions.md`, `rules-and-tables.md`'s Decisions
   table) and "Where Rules-tab folding is stored" (`decisions.md`, `sections-and-layout.md`'s own
   row at `## History` is untouched — that one is already historical). All three are rewritten to
   the current truth: where the Rules tab remembers its place is `settings.rulesCat`, app-wide, not
   on the character; which category opens when none is stored or the stored one has emptied out is
   the first one listed (`rulesCatOf()`'s fallback); and where tables are browsed is as one of the
   browser's own categories, not a card under the glossary. Each row keeps a meaningful rejected
   alternative rather than carrying the old one forward unchanged. The roadmap's 1.9.0 #99 row's
   "fold state in `settings`" cell becomes "`settings.rulesCat`".
7. Tests: `rules-data.js` gains source-level checks that `selectTab()` calls `rbToList()` entering
   the Rules tab from elsewhere, and that `buildToc()`'s Rules case calls `scrollToCard()` and no
   longer contains the dead branch, plus a behavioural check that `rbToList()` sets `rbUI.screen`
   to `"list"`; a fixture with two classes named "Fighter" from two packs, each with a subclass,
   checks the Class column and facet read "Fighter (SRD)" / "Fighter (XPHB)"; `rbNum()` is pinned
   directly against four inputs; and `rbOpenCat('spells')` is checked against both
   `settings.rulesCat` and the stored `K_SET` blob. `./src/tests/run.sh` green across all ten
   suites.
8. Re-driven in the project's Playwright MCP: (a) at 390px, Spells open → sheet tab → back to Rules
   shows the category list, not the Spells table; (c) at 1280×900, Items scrolled deep, ☰ → Conditions
   lands the pane in view with no manual scrolling. Screenshots: `.claude/qa/99-fix-a.png`,
   `.claude/qa/99-fix-c.png`.

Pages: [rules & tables](../wiki/features/rules-and-tables.md), [shell](../wiki/ui/shell.md),
[sections & layout](../wiki/ui/sections-and-layout.md), [decisions](../wiki/decisions.md),
[roadmap/1.9.0](../wiki/roadmap/1.9.0.md)

## Pack-label maps without a prototype (#88, 2026-10-23)

**What.** `rules.requires[label]` and `rules.credits[label]` (89-rules-merge.js) are keyed by a
pack's own `srcLabel()` — its `system` or `name`, written freely by whoever authors the pack. Both
were plain objects. Two failure modes: (1) a pack labelled `__proto__` made
`rules.requires["__proto__"]=x` set the object's PROTOTYPE instead of adding a key — the
declaration silently vanished and never persisted; (2) a pack labelled `constructor` (or
`toString`, `hasOwnProperty`, …) that declared no `requires` made `rules.requires["constructor"]`
read back the inherited `Object` function (truthy, not an array), so `missingRequirements()`'s old
`const decl=(rules.requires&&rules.requires[src])||[];decl.forEach(...)` threw. Nothing global was
polluted — only the object's own prototype changed, never `Object.prototype` — but both were real
bugs: a lost declaration, and a thrown exception on an ordinary (if oddly named) pack.

**Why.** Any string a pack author writes becomes an object key here, with no allow-list and no
escaping. A null-prototype object has no inherited properties at all, so every label is just an
ordinary own key — the fix moves the invariant from "labels must avoid `Object.prototype`'s names"
(unenforceable) to "these two maps are never plain objects".

**Design.** One helper, `packMap(o)` (89-rules-merge.js, next to `resetRules()`): returns a NEW
`Object.create(null)` map holding `o`'s own enumerable keys when `o` is a plain non-array object,
else an empty null-prototype map — never mutates `o`. A second helper, `normPackMaps()`, sets
`rules.requires=packMap(rules.requires);rules.credits=packMap(rules.credits);` for a path that does
not already run through `tidyRules()` right after assigning `rules`.

Applied at:
- `resetRules()` — `requires:packMap(),credits:packMap()`.
- `mergeRules()`'s lazy-init lines for both maps — now rebuild via `packMap(existing)` whenever the
  current value isn't already a null-prototype object (covers a restored plain object from an older
  cache, a settings file, or a first merge), before the `[srcLabel(obj)]=` write.
- `tidyRules()` — unconditionally `rules.requires=packMap(rules.requires);rules.credits=packMap(rules.credits);`,
  replacing the old credits-only non-array guard. Every path that changes the pool ends in
  `reindexRules()`, which calls `tidyRules()` first — so this one change normalises every restore.
- `poolFromExport()`'s credits-restore line — `rules.credits={}` → `rules.credits=packMap();`.
- The declared-requirements read in `missingRequirements()` (~L35) — was
  `const decl=(rules.requires&&rules.requires[src])||[];`, now
  `const d=rules.requires&&rules.requires[src];const decl=Array.isArray(d)?d:[];`, so a truthy
  non-array (the old `constructor` bug, or anything else unexpected) reads as "nothing declared"
  instead of throwing on `.forEach`.

**The three restore paths all already run through `tidyRules()` immediately after assigning
`rules`,** so none needed an explicit `normPackMaps()` call — `tidyRules()`'s fix covers them for
free: `loadRulesCacheAsync()` (71-char-io.js) does `rules=Object.assign(rules,parsed);reindexRules();`;
`boot()` (90-boot.js) does `rules=Object.assign(rules,JSON.parse(rr));reindexRules();`; Import
settings' swap (88-settings.js, `finishSettingsImport()`) does `rules=imp.pool;reindexRules();`.
`normPackMaps()` is defined for a future path that skips `tidyRules()`, and used directly by the
round-trip test below (`JSON.parse(JSON.stringify(rules))` restored the way a cache restore does:
`Object.assign` into a reset pool, then `normPackMaps()`).

**Tests** (`rules-data.js`, "#88: pack labels as map keys"): `packMap()` on a plain object, `null`,
an array and a string; merging a pack labelled `__proto__` (`requires`, `license`, `attribution`,
one feat) through the real `mergeRules()` path — the declaration lands as an ordinary own key in
both maps, and `Object.prototype` gains nothing; the declaration surviving
`JSON.parse(JSON.stringify(rules))` restored via `Object.assign`+`normPackMaps()`, including a
second write to the same label afterwards; removing that pack through the real Settings removal
path (`removeRulesGroup()` → `prunePackMeta()`) drops the `__proto__` entry from both maps; a pack
labelled `constructor` or `toString` with no `requires` — `missingRequirements()` neither throws nor
reports a false declaration; `rulesCreditsHTML()` lists the `__proto__` pack's (escaped) credit
without throwing. Full suite: all ten green, data unchanged.

Pages: [rules packs](../wiki/architecture/rules-packs.md)

## The hit-dice bar and the spend box (#103, 2026-10-23)

**What.** Spending a hit die used to be a per-style click: a pip in Full/Condensed, a token in
Dice — each one a bare `rollHitDie(die)` that auto-rolled and healed with no chance to type a
roll made at the table. Task 5 of the #103 sheet makeover replaces all three looks with one bar
(`hdBarHTML()`, under the rest buttons, same place Hit Dice have always lived) that shows every
die's `left / total` and the CON modifier; tapping it opens a "Spend a hit die" box
(`hdSpendHTML()` in a modal via `openHdSpend()`) with one row per die size (pick it, nudge `used`
±1 with no healing), and two ways to spend the pick: "🎲 Roll for me" (`rollHitDie()`, now a thin
wrapper over the shared maths) or type a roll ("I rolled [ ] → Apply"), which live-validates
through `hdSpendCheck()` and previews "5 + CON 5 = 10 HP → 98 / 153" before `spendHitDie()` applies
it. `hdConMod()` and `hdHeal()` are the maths `rollHitDie()` always had, pulled out so both paths
share one answer.

**Retired:** the "Hit Dice display" Settings row and its three builders, `hdFullHTML()`,
`hdCondensedHTML()`, `hdDiceHTML()`, plus `hdPips()` and the style resolver `hdStyle()`. The
`character.hdStyle` field stays in `blankChar()`/`migrate()` as inert data — an old sheet carries a
`full`/`condensed`/`dice` value nothing reads any more, which is cheaper than a migration step and
never surfaces.

**Where the auto/manual pill and the manual-dice field went.** They used to sit on the Rest &
Recovery card's own heading (`[data-hdmode]`, `#hitdiceInput`). Both ids now live only inside the
spend box's foot, rendered fresh by `hdSpendHTML()` every time it opens — `00-sheet.html`'s Rest
card keeps just `<div class="hd-title">Hit Dice</div>` and `#hdWrap`. `#hitdiceInput` now carries
`value="${esc(character.hitdice||"")}"` (a modal is never refilled by `renderAll()`'s `[data-path]`
loop, since that loop runs once at character load, not on every modal open) and a literal
`hidden` attribute computed at render time instead of the old `inp.style.display` toggle — the
toggle alone would not have overridden the attribute's own `[hidden]{display:none}` rule.
`renderHitDice()` keeps patching whichever copy of `#hitdiceInput`/`[data-hdmode]` is currently in
the document (now via the `.hidden` IDL property, not `style.display`, for the reason above) so the
existing `[data-hdmode]` click handler in `90-boot.js` needed no change at all — it still just calls
`renderHitDice()` and pokes `#hitdiceInput` directly, and that now finds the modal's copy when the
box is open across a mode toggle.

**`hitDicePool()` grows a `cls` field** — the class name(s) contributing to each die size, joined
with " / " for the (rare) case of two classes sharing one die. Previously nothing needed per-die
provenance; the spend box's rows do (`<b>d8</b> Cleric · 12 / 15`).

**Tests.** `sheet.js`: the brief's six `#103` checks for `hdSpendCheck()`, `hdHeal()`,
`hdBarHTML()` and `hdSpendHTML()` (a typed roll's range, the heal floor, the bar's contents, the
box's rows/disabled-die/both spend paths); the retired hit-dice-style block (9 checks on
`hdStyle()`/`blankChar().hdStyle` as a resolved VALUE) is deleted — the field surviving a round
trip is no longer interesting once nothing reads it back as a style. The hostile-character render
pass drops its three-style loop for one `renderHitDice()` call plus a new `openHdSpend()` call,
still exercising `esc(p.die)` against a hostile `hitDie` string. `rules-data.js`: the Rest-card
template guard now asserts `#hitdiceInput`/`data-hdmode` are OUT of the static template and INTO
`hdSpendHTML()`'s source instead of IN the Rest card; the Settings-row retirement check
(`!/segHdStyle|data-hdstyle/`); the three-builder and dice-token-handler checks are replaced with
checks that they're gone and that `renderHitDice()` calls `hdBarHTML()` only. Full suite green
(`./build.sh --no-zip` then all ten suites).

Pages: [vitals & rest](../wiki/features/vitals-and-rest.md)

## The Sheet makeover (#103, 2026-10-23)

**What.** The Sheet tab becomes one condensed page after Foundry VTT's sheet (spec
`src/docs/specs/2026-10-23-sheet-makeover-design.md`, wave 2 of 1.9.0). Eight tasks on
`issue/103-sheet-makeover`; the hit-dice bar and spend box (Task 5) have their own entry above.

- **The header** (`<header class="card sheet-head" data-note="portrait">`, `00-sheet.html`): the
  name, the class line (`classLineHTML()`: each class a button opening `classFlyHTML()` with About,
  the subclass, ▲ Level up, ▼ Level down, + Add class and Remove; species and background open their
  info windows, which gain Change and Remove through `raceInfoFoot()` / `bgInfoFoot()`), the rest
  icons, the inspiration star, the paw (`sheetHeadHTML()`, `famFlyHTML()`, `openFamiliar()`), and
  the level ring with XP and its bar (`levelBadgeHTML()`, `xpBarHTML()`, `xpProgress()`, the
  ruleset's `advancement` table or `SRD_ADVANCEMENT`). `renderSheetHead()` draws the parts that
  follow the character; `openShFly()` / `closeShFly()` hang the one popover `#shFly`.
  Settings → Sheet display gains "Levels and companions": Advancement XP / Milestone
  (`character.advancement`, read through `advancementOf()`) and the paw switch
  (`character.showFamiliars`).
- **The grid** (`.sheet-grid`, `10-chrome.css`): a dark rail (`card rail`, the `vitals` section:
  portrait, AC shield, ✓○○○☠○○○✗, Init/Speed/Prof, the HP bar with `#hpFill`, `#hdWrap`, Size ·
  Passive Perception), the ability strip (`card strip`, six boxes with their saves from
  `buildAbilities()`), Skills, a right column (`.col-r`: the new Defences card, Statuses,
  Resources), Features full width. Three columns above 1000px, two to 700px, one below in the
  spec §6.7 order (`order`, `.col-r{display:contents}`). The rail re-points the everyday tokens to
  `--rail-*` (all four palettes, `00-tokens.css`).
- **Retired:** the Class, Ancestry & Background and Rest & Recovery cards (and `#classBox`,
  `#raceBgBox`, `#craceWord`, `#btnLevelUp`, `#btnLevelDown`, `classChipHTML()`), the By ability
  layout (`statStyle()`, `statGroupHTML()`, `statGroupsHTML()`, the Skills display row), the left and
  right `.stack`s and their ≤820px flatten. `statStyle`, `hdStyle` stay in saved sheets, unread.
- **Moved:** Attacks & Weapons to the top of Inventory (verbatim); alignment into Bio's
  "Proficiencies, Senses & Languages" card; `#starBtn` from the Vitals label to the header (the
  combat view gets its own `data-inspire` toggle, `toggleInspiration()`); the rests to the header.
- **Chips** (`41-chips.js`): `resists`, `immunes`, `senses`, `languages` (`CHIP_KEYS`), read through
  `chipList()` / `chipClean()`, drawn by `chipsHTML()`, added through `openChipChooser()`
  (`chipChooserHTML()`: suggestions from `CHIP_SUGGEST`, or the languages the packs name, plus
  free text and a sense range), removed by `removeChip()`. A granted or `system` language carries
  its source ("· species", "· background", "· rules") and no ×. Species and backgrounds grant
  languages through `grantLanguages()` / `dropLanguages()` (source `race:…` / `bg:…`) instead of
  appending "Languages: …" to Proficiencies. A pack may declare `defaultLanguages` and `advancement`
  (`docs/rules-schema.md`); `defaultLanguagesFor()` falls back to Common, `ensureDefaultLanguages()`
  adds them as `system` chips. Print gains the four lists.
- **The registry**: 21 → 18 sections. `portrait` is titled "Character"; `class`, `origin`, `rest`
  are gone; `attacks` is on Inventory; `defences` is new. `EDIT_CARDS` drops `class`/`origin`, gains
  `defences`/`proficiencies`. The Story tab reads **Bio** (its id stays `story`).
- **An old sheet comes forward once** (`migrateSheet103()` in `migrate()`): the `class` and `origin`
  notes merge into `portrait` under "**Class:**" / "**Ancestry & Background:**", `rest` into `vitals`
  (`mergeNoteInto()`); a saved `rest` or `portrait` in `combatSections` becomes `vitals`, deduped;
  "Languages: …" lines in Proficiencies become the player's chips once (`liftLanguages()`, flag
  `langLifted`); `showFamiliars` defaults to whether it has a familiar.

**Task 8 rulings (controller).**
1. *The header is not combat-addable.* The registry marks `portrait` `nocv`; `combatAddable()`
   gates `renderCombatToggles()`, `toggleCombatSection()` and `combatSectionsOf()`. The rest
   buttons are not a fight action, and the portrait rides in with Vitals.
2. *`jumpToNote('familiars')` with the paw hidden* hangs the flyout from `#sheetHead .sh-bar`;
   only a menu button (one with `aria-haspopup`) is marked `aria-expanded`.
3. *The no-packs hint is back*, in the Class card's words, in the Add class window
   (`NO_RULES_HINT`, `openAddClass()`), the way into a sheet with no class.
4. *Tighter tests:* the registry-title check slices each card to its own end (`block()` in
   `rules-data.js`, hoisted and taught other tags, so the `<header>` slices too); the 30-sheet.css
   strip ≤1000px and rail ≤700px queries are pinned after their base rules.
5. *The `ed` on the header flyout's and info windows' Remove* is inert (no `[data-note]` card in
   `EDIT_CARDS` holds them) and kept, commented, so every `data-del-*` carries `ed` (#97's guard).
6. *Dark rail:* tinted, not darker (the ground is already near-black): Humblewood `#1c2925` with a
   gold edge, Classic slate `#27303a`. Light unchanged.
7. *Header at 390px:* ≤480px tightens the gaps and the XP box (96px), so the icons and the level
   badge share one row under the name. "Level up ready" still wraps.
8. *3-digit HP:* "88/153" measures 28px in a 35px box (Classic, Cinzel) at 390 and 1280; no change.
9. *The phone shield* still overlaps the portrait's edge; Mike's device pass.
10. *Sense casing:* the chip renders "TREMORSENSE · 60 FT" (the chip is uppercase), as spec §8.

**Deviations from the spec** (recorded in its As built): spec §4's "a system change replaces the
`system` chips" is not built (inert: every ruleset defaults to Common today); the empty header
reads "+ Race" / "+ Ancestry" by skin, not "+ Species"; `#maxNote` shows only when an effect moves
Max HP; the rail and strip keep a small `.label`; removing `.stack{display:contents}` restores the
12px gap between cards on Spells, Journal and Inventory at ≤820px (they touched before).

**Tests.** All ten suites, 6843 checks. `sheet.js`: the chips, advancement, default languages,
migration (twice, idempotent), grants, the spend box, the header markup, and Task 8's combat,
jump and hint checks. `rules-data.js`: the registry against the template (18), the grid and its
queries, the rail, the removed ids.

**QA.** Before and after shots of Sheet, Inventory, Bio and the combat view at 1280, 900 and 390,
both skins, plus dark Sheet and Spells/Journal/Rules at 390 (`.claude/qa/103-*`). Driven: both
spends and an out-of-range roll, un-spend, the paw (flyout, modal, Summon/Dismiss, + Add), Level up
and down, species Change and Remove (a hand-injected species with `languages`, since SRD 5.2
species carry none), every chip kind, Milestone and back, #97's pencil on Defences and Bio, the
combat view (Start, End, Attacks home on Inventory), the paw-less note jump and the no-rules hint.

Pages: [sections & layout](../wiki/ui/sections-and-layout.md),
[vitals & rest](../wiki/features/vitals-and-rest.md),
[abilities & skills](../wiki/features/abilities-and-skills.md),
[story & notes](../wiki/features/story-and-notes.md), [combat view](../wiki/features/combat-view.md),
[character model](../wiki/architecture/character-model.md),
[grants & provenance](../wiki/architecture/grants-and-provenance.md), [shell](../wiki/ui/shell.md),
[rules packs](../wiki/architecture/rules-packs.md), [2.0](../wiki/roadmap/2.0.md)

## The Sheet makeover: final review fixes (#103, 2026-10-23)

The whole-branch review found three player-facing gaps and a set of minors. Fixed:

1. *I-1, no hit-dice pool.* A custom class (or no pack) had no bar, so no spend box, so no
   auto/manual pill and no `#hitdiceInput`: no hit dice at all. `renderHitDice()` now draws the pill
   and field inline under the hint (`hdFootHTML()`, shared with the box's foot) whenever the pool is
   empty and the box is closed. One copy at a time: `openHdSpend()` removes the inline foot first,
   and the inline copy is left out while the box is open. Typing in the inline field redraws only
   `.hd-main` above it, so the caret stays and dice that parse mid-word don't take the field away.
2. *I-2, per-class levels.* The class menu's ▲/▼ carry `data-shidx`, and `doLevelUp(idx)` /
   `doLevelDown(idx)` act on that class. With no index (Level up ready, older callers) they ask as
   before. The alerts say "Remove in the class's menu", not the gone ✕.
3. *I-3, the hidden Familiars card's heading.* The paw's menu (`famFlyHTML()`) now holds a
   Combat view item (`data-combatbtn="familiars"`, `role="menuitemcheckbox"`, on/off) and a Note
   item (`data-notebtn="familiars"`), both the existing delegated hooks. `familiars` leaves
   `EDIT_CARDS` (eleven now): its pencil was unreachable, and dropping it was smaller and sounder
   than teaching the modal the hide state, which only the combat view could then toggle. Driven:
   the toggle adds Familiars, the view shows `#combatView #familiarCard`, End combat keeps it there,
   leaving the view sends it home hidden.
4. *M-1:* the short rest's note points at the hit-dice bar, and the summary offers "Spend a hit die"
   (`restSummary(…, {hd})` → `openHdSpend()`) while any are left.
5. *M-3:* `chipSrcLabel()` looks up own keys only (`chipSrcKey()`), and `chipClean()` turns an
   unknown language `src` into `""`, the player's, so its × and `removeChip()` agree.
6. *M-7:* the header's species button appends "· subrace", escaped.
7. *M-8:* the pill (`toggleHdMode()`) and a dice edit (`hdDiceEdited()`) redraw an open spend box
   from the new pool, keeping the picked die, then put the keyboard back (caret kept); with nothing
   left to spend from, the box closes and the inline field takes over.
8. *M-9 (Mike's ruling):* the XP bar fills within the level, `(xp − cur) / (next − cur)`, clamped
   0..1; `xpProgress()` returns `cur`.
9. *M-10:* `sheetHeadHTML()` is `pawHTML()`. *M-11:* the dead `.cr-k` rule is gone. *M-14:* Summon /
   Dismiss is a `<button>` with `aria-pressed`, and the modal's repaint puts focus back on it.

Docs: the release note names the paw menu and its switch, the XP bar and setting, language chips
and the lifted "Languages:" lines, and the removed display settings (M-2); known issues says lifted
languages are the player's (M-4); rules-schema says which pack's `defaultLanguages` /
`advancement` is read (M-6); the spec's As built marks the system-chip swap "not needed".

Tests: `sheet.js` (I-1, I-3, M-1, M-3, M-7, M-8, M-9, M-11, M-14, and the menu's `data-shidx`),
`char-update.js` (I-2 on both indexes, the no-index paths, the reworded alert).

Pages: [vitals & rest](../wiki/features/vitals-and-rest.md),
[character building](../wiki/features/character-building.md),
[combat view](../wiki/features/combat-view.md), [sections & layout](../wiki/ui/sections-and-layout.md),
[grants & provenance](../wiki/architecture/grants-and-provenance.md),
[known issues](../wiki/roadmap/known-issues.md)

## The Sheet makeover: Mike's header and column changes (#103, 2026-10-23)

Mike's feedback on the Task 7 screenshots, four changes:

1. *Rest chips.* `#btnShortRest` / `#btnLongRest` hold an icon (`.sh-rico`) and words
   (`.sh-rlbl`). The words show by default; the icon shows instead with Icon tabs on
   (`html[data-tabs="icons"]`, set by `applyTheme()`) or at ≤860px, the tab bar's own breakpoint.
   Ids, titles and aria-labels unchanged.
2. *The note button last.* `#shLevel` moved into the header's `.label.sh-bar` as its last child, so
   the note button `renderNoteIcons()` appends lands after the XP bar. The ☰ strips `.sh-level`
   with the buttons, so its entry still reads "Character". The header has no combat toggle
   (`portrait` is `nocv`), so the note button is the only control that moved.
3. *Order:* Short rest, Long rest, the paw, the star, the level badge and XP, the note button.
4. *Independent stacks.* Under the strip, `.col-m` (Skills, Features) and `.col-r` (Defences,
   Statuses, Resources) are two grids side by side, so Features follows Skills instead of waiting
   for the right column's row (the gap Mike circled); Features is no longer full width at desktop.
   At ≤1000px `.col-m` opens (`display:contents`) so the two-column layout stays widths.html's
   (Features full width under the rail); at ≤700px both open and `order` gives the phone order.
   Both flattenings are scoped to `.sheet-grid` and sit inside their queries.

The ☰ now lists Skills and Features before Defences (DOM order). Tests: `rules-data.js` (the
stacks and their CSS, the rest chips, the header's DOM order, the ☰ strip), `sheet.js` (the real
Sheet markup parsed into a node tree: the combat view takes every card and returns each to its own
stack and place). Shots `.claude/qa/103-mike-*`.

Pages: [sections & layout](../wiki/ui/sections-and-layout.md),
[vitals & rest](../wiki/features/vitals-and-rest.md), [shell](../wiki/ui/shell.md)

## The ☰ flyout retired; a back-to-top button (#103, 2026-10-24)

Mike, 2026-10-24: the tabs are organised well enough to need no index, so the ☰ section flyout
goes. `#btnToc`, `#tocBack`, `#tocFly`, `buildToc()`, `openToc()`, `closeToc()`, the `.tab-toc` /
`.toc-fly` / `.toc-back` CSS, the boot handlers and the two `closeToc()` calls in the combat view
are deleted; `selectTab()` now closes only the Sheet header's popover. The tab bar's `.tab-tools`
holds the swords alone (still pinned below 400px). `scrollToCard()` stays for the note jump and
the journal. Nothing reads a card `.label`'s text any more; the `.label` stays where the note
button, the #97 pencil and the combat toggle go.

In its place, a back-to-top button: `#btnToTop`, a round 48px ↑ fixed bottom-right (16px plus the
safe areas), in the template outside the panels, so it serves every tab and the combat view.
`updateToTop()` adds `.show` once `scrollY` passes `innerHeight` (`toTopShown()`), run from a
passive scroll and resize listener at most once a frame; hidden it is `visibility:hidden`, so no
tap or Tab reaches it. `scrollToTop()` scrolls to 0, smooth or (reduced motion, `toTopBehavior()`)
instant, and focuses the active tab, or the swords in the combat view, with `preventScroll`.
Theme tokens only; layer 25 (over cards, under the note popover and the combat header at 30, the
header popover, the tab bar, home, finder and modal); hidden in print. Bottom collisions: the
refused-write strip (`body.saving-failed`) lifts it to 130px like the toast; below 640px a showing
toast lifts it above the toast (`body:has(#toast.show)`, with `toast()` writing `--toast-h`); the
update pill is in the top bar and the combat view has no footer. `.page` gains 80px of bottom
padding so the last card's controls can scroll clear of it.

Tests: `rules-data.js` loses the flyout-only checks (the ☰ entry's strip list, the Rules-tab
category entries, the backdrop close), the hidden-card check now guards `jumpToNote()`, the
combat-button placement is checked inside the tool group, and a guard keeps every trace of the
flyout out of the built page and the sources. New: the button's markup, threshold, reduced-motion
branch, focus, wiring, CSS layer, hidden state, print, and its lifts. Shots `.claude/qa/103-totop-*`.

Pages: [shell](../wiki/ui/shell.md), [sections & layout](../wiki/ui/sections-and-layout.md),
[overview](../wiki/overview.md), [combat view](../wiki/features/combat-view.md),
[inventory](../wiki/features/inventory.md), [journal](../wiki/features/journal.md),
[story & notes](../wiki/features/story-and-notes.md), [rules & tables](../wiki/features/rules-and-tables.md),
[attacks & damage](../wiki/features/attacks-and-damage.md), [features & traits](../wiki/features/features-and-traits.md),
[known issues](../wiki/roadmap/known-issues.md), [build & source split](../wiki/architecture/build-and-source-split.md)

## Level-up fanfare (#101, 2026-10-24)

Levelling up (and adding a second class) now plays a short animation and opens a card showing
everything the level gave, with the hit-point roll on the card itself; a level with nothing to
choose ends there, one with a choice continues into the existing choice window minus its old `hp`
block. Two multiclassing rules were fixed along the way (Mike, in the brainstorm): half-casters
round up for spell slots, and the add-class note states the 13+ primary-ability prerequisite.

**The fixes (`00-constants.js`, `56-class.js`).** `casterLevel()` changes `Math.floor(L/2)` to
`Math.ceil(L/2)` for half casters (Paladin, Ranger, Artificer), for every ruleset — SRD 5.2.1
pp.25-26 say "half your levels, round up" — and a Paladin 1 now gets its two 1st-level slots.
`multiclassNote()` gains one sentence, `MC_PREREQ`, appended to both its returns.

**What a level gave (`57-levelup.js`, new fragment, 35 JS fragments now).** `levelSnapshot()`
records feature ids, spell-slot totals 1-9 (pact included), each resource's max and die, and the
proficiency bonus, taken before and after the level is applied. `levelGains(before,after,choices,
notes)` is pure and DOM-free: new features (tagged with the subclass, and with a no-stacking
warning when the name matches one from a different class), choices still to make, new or changed
resources, new or bigger spell slots, a rising proficiency bonus, then the pack's own notes for
that level — in that order. `luHPCheck()` is the HP step's range check, shared with `luSetHP()`.

**The card and its flow.** `doLevelUp()` and `addClass()` (for a second class) take a snapshot
before applying the level, then call `openLevelUp(info)` instead of `runChoices()`. The card
(`levelUpCardHTML()`) lists the gains, then the HP step (`levelUpHPHTML()`) — Roll for me, "I
rolled" + Apply (live-checked by `luHPCheck()`), or Take the average, the same controls and
wording as the hit-dice spend box (#103). Done or Continue stays disabled until HP is set
(`luSetHP()`); Done closes with nothing left to choose, Continue (`luFinish()`) commits the HP
(`commitHPChoice()`) and calls `runChoices(cls, choices, [], pending)` — no `notes`, since the card
already showed them, and no `hp` block, since the card already asked for it. Closing early
(`luDismissed()`, wired through `armChoiceDismissGuard()`'s existing guard with the new
`LU_HP_CLOSE` string) asks first when HP isn't set yet; either way the choices and any pending
window still open, because a choice the player never saw must not vanish with the card. Creation
(a first class starting above level 1) is unchanged: its `{type:"hp"}` block stays inside the
choice window, because creation gets no fanfare.

**The scene (`#luFx`, `playLevelUpFx()`).** A full-page layer under the modal: an SVG sigil (two
circles, a seven-point star, 24 rune paths) draws itself, the level ring glows and ticks old → new,
a flash, the LEVEL N banner unfurls with sparks and rising motes — CSS keyframes only, about 2.4s
total with a timer backstop. A click, tap or Esc/Enter/Space (`luSkip()`) skips straight to the
card; `prefers-reduced-motion:reduce` never builds the layer at all. New tokens `--lu-night`,
`--lu-night-2`, `--lu-glow`, `--lu-spark` in `00-tokens.css` for both skins — classic is a violet
night with pale arcane blue, Humblewood a deep forest green with a warm gold-green glow — light and
dark share the night backdrop on purpose (it's a scene, not a surface).

**Task 5 (browser QA, CSS tuning, docs).** Drove a quiet level-up and one with a choice (Done vs
Continue, HP typed out of range then in range), a multiclass add (2d6, the 13+ note, no starting-
equipment window), Paladin 1's two 1st-level slots, Esc mid-scene (skips to the card) and Esc on
the card (Cancel keeps it, OK closes with no HP applied and Max still unlocked), and reduced
motion. The project's Playwright MCP server (`@playwright/mcp@0.0.79`) has no
`browser_emulate_media` tool, so reduced motion was driven by monkey-patching `window.matchMedia`
in the live page and re-running `doLevelUp()` rather than true OS-level emulation; the unit suite's
own mocked `matchMedia` already covers the branch. Console stayed clean throughout. Screenshots:
`.claude/qa/101-before-*`, `101-after-*`, `101-scene-*`, `101-css-wrap-*`, `101-digit-test-*`. The
Humblewood forest-night scene — missed by Task 4, whose two scene shots both turned out to be
classic — is shot for the first time here (`101-scene-humblewood-light-1280.png`,
`101-scene-humblewood-light-390.png`, `101-scene-humblewood-dark-1280.png`), the skin and the
`--lu-night` token (`#0d1a12` Humblewood, `#1d1826` classic) confirmed before each shot.

Two cosmetic fixes, CSS only (`50-modal.css`): at phone width the card's class line ("Fighter 1 →
2 · character level 2") wrapped onto an orphan last line holding just the trailing number; the
same digit was also the other half of the bug. `--head`/`--display` (Cinzel on the classic skin)
draw a "1" with no serif, reading as a capital "I" in both the class line and the LEVEL N banner —
confirmed by testing `font-variant-numeric:lining-nums` first, which changed nothing (Cinzel has no
alternate numeral set for the property to select), then by switching `.lu-cls` and `.lu-bn` to
`var(--body)` (EB Garamond), whose figures are unambiguous and which, as a side effect, fits every
realistic class line on one line down to 320px wide, so no separate wrap fix was needed. Confirmed
in both skins, before and after (`101-digit-test-banner-{classic,hw}-{default,after}.png`,
`101-css-wrap-before*.png`, `101-css-wrap-after*.png`).

Deferred (`progress.md`, left for the controller, not fixed here): Continue passes `[]` for notes
rather than the level's own notes — matches the spec's "notes alone count as nothing to choose",
but means the choice window never repeats them; a bad Apply after a good roll shows the error
while Done still commits the earlier value; the card's own DOM wiring has no unit coverage;
`LU_ICON` is a plain-object lookup; after a skip, focus lands on the HP step's first `<input>`
(`#luTyped`) rather than the card's first element in DOM order (`#luRoll`) —
`openModal()`'s existing first-focusable-input behaviour, not new to #101, noted here for the
record rather than as a bug.

Tests: `char-update.js` (#101 blocks across Tasks 1-4: the multiclass fixes, `levelGains()`, the
HP step, the card's flow, the scene, reduced motion), `rules-data.js` (the scene's CSS: z-index
under the modal, the reduced-motion and print rules after their base rules).

Pages: [character building](../wiki/features/character-building.md),
[spells](../wiki/features/spells.md), [vitals & rest](../wiki/features/vitals-and-rest.md),
[theming & icons](../wiki/ui/theming-and-icons.md),
[build & source split](../wiki/architecture/build-and-source-split.md),
[1.9.0](../wiki/roadmap/1.9.0.md).

## Level-up fanfare: final review fixes (#101, 2026-10-24)

The whole-branch review of #101 found two Important issues and nine minor ones. This entry fixes
I1, I2, M1 and M4, corrects the docs (M6, M7, M8) and records the rest. Everything is in
`57-levelup.js` unless named.

**I1: the no-stacking tag is an allowlist.** `levelGains()` tagged any new feature whose name
matched one from another class, so a Wizard taking a Cleric level read "Spellcasting — they don't
stack". That is false: Spellcasting combines by the multiclass slot table. Expertise and Epic Boon
are separate picks, too. The tag now fires only for `LU_NO_STACK`, `["extra attack","unarmored
defense"]`, the two features SRD 5.2.1 p.26 names: Extra Attack doesn't stack, and you use only one
way to calculate AC. This refines spec decision 11 (controller ruling). Cost if wrong: another
non-stacking feature goes untagged.

**I2: a failed Apply takes the earlier value back.** A good roll followed by a bad "I rolled" +
Apply showed the error, but left `_lu.set` true. Done, or ×, then committed a number the card no
longer showed. `luSetHP()`'s failure path now clears `_lu.set`, `_lu.raw` and `_lu.note`, disables
`#luGo` and shows the error itself. So Done does nothing, and closing asks `LU_HP_CLOSE` again.

**M1: a level-up belongs to its character.** `_lu.id` is `activeId` at `openLevelUp()`.
`showLevelUpCard()` (the scene's end), `luFinish()` and `luDismissed()` drop a level-up whose
character has changed, through `luStale()`: no card, no HP, no choices. `loadCharById()`,
`newCharacter()` (`75-home-theme.js`), `finishImport()` (`71-char-io.js`) and `showHome()` call
`luAbandon()`. It clears `_lu`, ends a playing scene through `luSkip()` (whose `done()` then opens
nothing) and closes an open card. None of this was reachable through the UI, because the layer
covers every control. It is hardening.

**M4: one spell note per class.** A second class added above level 1 listed every level's spell
note ("Prepared Spells: 4", then "5"). `luLatestNotes()` keeps only the highest `_level`'s notes.
A plain-string note, the multiclass note, has no level and always stays.

**Comments.** `char-update.js`'s #58 header and `58-choices.js`'s `armChoiceDismissGuard()` comment
now say the `{type:"hp"}` block is creation's.

**A correction to the entry above (L6840).** Closing the card early is wired through
`setDismissGuard()` directly in `showLevelUpCard()`, not through `armChoiceDismissGuard()`. That
function only shares the `LU_HP_CLOSE` string. The 2.4s timer is the scene's only end, not a
backstop.

**Left, and recorded.** In [known issues](../wiki/roadmap/known-issues.md):
- M3: a long card at 390 puts HP and Done below the fold, for Mike's phone pass.
- M5: the page behind the scene isn't inert for its 2.4s.
- M9: `luSummary()` cuts at abbreviations and strips `_*#>` and backticks.
- Focus after a skip lands on `#luTyped`.

M2 is a new rule in [character building](../wiki/features/character-building.md): nothing may
`openModal()` over the level card.

Tests: `char-update.js` covers each fix: Spellcasting, Expertise and Epic Boon untagged and
Unarmored Defense tagged; a bad Apply after a good one; Done and closing on a changed character; a
scene ending on another character; Home mid-scene; the Wizard-at-2 note and `luLatestNotes()`.
Browser (project Playwright MCP, 390 wide, SRD pack): Wizard 3 + Cleric 1 showed no tag. A Roll
of 2, then 99 + Apply, cleared it and disabled Done, and × asked. Then 5 + Enter and Done added 5.
Monk 2 + Barbarian 1 was tagged. Home mid-scene left no layer and no card. The console was clean.
Shot: `.claude/qa/101-fix-apply.png`.

Pages: [character building](../wiki/features/character-building.md),
[spells](../wiki/features/spells.md), [vitals & rest](../wiki/features/vitals-and-rest.md),
[theming & icons](../wiki/ui/theming-and-icons.md),
[known issues](../wiki/roadmap/known-issues.md), [decisions](../wiki/decisions.md).

## Hide tabs (#52, 2026-10-25)

A player can hide the tabs a character doesn't use (Spells for a Fighter, Rules for a player who
never opens it), per character, from Settings → Sheet display → Tabs. The Sheet and the combat
swords can never be hidden.

**Data.** `character.hiddenTabs` (`00-constants.js`, `blankChar()`): `[]` by default. `migrate()`
(`71-char-io.js`) runs it through `cleanHiddenTabs()` right before `migrateSheet103()`: non-array
becomes `[]`, only names in `HIDEABLE_TABS` survive, repeats collapse to one, order kept.

**The tab bar** (`40-sheet.js`). `HIDEABLE_TABS=["spells","inventory","story","journal","rules"]`
and `TAB_LABELS` (the player-facing name per key, `story`→"Bio") sit above `selectTab()`.
`isTabHidden(name,c)` is false for `sheet`/`combat` and any name not in `HIDEABLE_TABS`.
`applyHiddenTabs()` sets `.tab[data-tab]`'s `hidden` attribute from `isTabHidden()`, and sends the
active tab to `sheet` if it is now hidden; it runs from `renderAll()` (`66-coins-hp.js`, right
after `recompute()`), so load, a character switch and a Settings flip all repaint it.
`selectTab(name)` opens `"sheet"` in place of a hidden name — a guard against a stale caller, not
the only way in. `setTabHidden(name,hide)` refuses a name outside `HIDEABLE_TABS` (so Sheet and
Combat are structurally unreachable, not just unlisted), rewrites `hiddenTabs` from the cleaned
list, then calls `applyHiddenTabs()` and `scheduleSave()`. CSS: `.tab[hidden]{display:none!
important}` in `10-chrome.css`, placed after `.tab:hover` — `.tab` sets its own `display`, so the
`!important` is load-bearing, not decorative.

**Settings** (`88-settings.js`). `tabsGroupHTML(c)` draws one `setRowHTML` switch per
`HIDEABLE_TABS` entry — id `swTab-<name>`, `data-tabsw="<name>"`, `aria-checked` from "shown" (on
means shown), `aria-label="Show the <Label> tab"` — under a new **Tabs** group, appended after
Ammunition in the Sheet display page's `hasChar` branch. The first row's help text reads "Hide the
tabs this character doesn't use. Sheet always shows." A delegated `[data-tabsw]` click handler
calls `setTabHidden()` and flips the button's own `on` class and `aria-checked` (the dialog's
generic `.switch` listener does the same sync a second time — redundant, harmless, matches the
existing `swFamiliars` pattern).

**Ways in.** `jumpToNote()` (`87-notes.js`): if the note's tab is hidden, it unhides it
(`setTabHidden(tab,false)`) and toasts `"<Label> tab shown again; hide it in Settings → Sheet
display."` before calling `selectTab()`, using the tab's own label (Bio, not story) — verified live:
`setTabHidden('story',true)` then `jumpToNote('proficiencies')` landed on `tab-story` with
`hiddenTabs` dropping `"story"` and the toast reading exactly that line.
`leaveCombatTab()` (`87-combat.js`): `back` is `(cvPrevTab&&!isTabHidden(cvPrevTab))?cvPrevTab:
"sheet"` — driven live from Spells: opened the combat view (`cvPrevTab="spells"`), hid Spells from
Settings while the view stayed open (hiding never ends or interrupts combat), then pressed the
swords and landed on the Sheet, not Spells. Combat cards from a hidden tab are untouched by design
(decision 6): hiding a tab is a tab-bar fact, not a combat-layout one.

**Deferred, from progress.md (code review, not fixed here):**
- `rules-data.js:182`'s `#99` regex window was widened `{0,500}`→`{0,700}` with no comment
  explaining why (Task 1): the new `selectTab()` guard line pushed the existing check past its old
  budget.
- `HIDEABLE_TABS.indexOf(name)>=0` is repeated three times in `40-sheet.js` (Task 1, plan verbatim).
- `88-settings.js:140-144`'s `[data-tabsw]` handler repeats the dialog's generic `.switch` →
  `aria-checked` sync by hand (Task 2); harmless (idempotent), a comment would help.
- **Controller observation, confirmed in this task's screenshot
  (`.claude/qa/52-after-settings-tabs-off.png`):** the Tabs group's help text sits under the first
  row, **Spells**, so it reads as Spells' own help rather than the group's. `setGroupHTML()` takes
  only a title, not a help line, so `tabsGroupHTML()` reused the row-help slot of its first switch
  (the `i===0?...:""` in its map) instead. Left for a future fix wave: moving it would mean either
  giving `setGroupHTML()` an optional help line (touching every other group that doesn't have one)
  or a non-`setRowHTML()` help row above the switches.

**Browser QA** (project Playwright MCP, worktree build vs. main's `dist/fieldbook.html`): turning
off Spells and Rules together removed both from the bar in one repaint; turning Spells back on
restored it; hiding the active tab (Journal) and closing Settings landed on the Sheet; two
characters with different `hiddenTabs` each showed their own bar on switching, both directions;
icon tabs on kept the same tabs hidden at 1280 and 390; a note jump into a hidden Bio tab unhid it
with the toast (screenshot above, `clearTimeout(_toastT)` used only to freeze the toast for the
capture, not to change its real 1.9s life); leaving the combat view after hiding its origin tab
landed on the Sheet; both skins at 1280 showed the same gapless bar; the console stayed empty
(`browser_console_messages`, `all:true`) across the whole session. Full suite
(`./build.sh --no-zip && ./src/tests/run.sh`) green before commit.

Pages: [Shell](../wiki/ui/shell.md), [Settings & updates](../wiki/features/settings-and-updates.md),
[Character model](../wiki/architecture/character-model.md), [Combat view](../wiki/features/combat-view.md),
[Story & notes](../wiki/features/story-and-notes.md), [decisions](../wiki/decisions.md),
[1.9.0](../wiki/roadmap/1.9.0.md), the spec's As built
(`src/docs/specs/2026-10-24-hide-tabs-design.md`).

## Hide tabs: final review fixes (#52, 2026-10-25)

Three fixes from the final whole-branch review of `issue/52-hide-tabs` (`final-review.md`), landed
before #52 merged to main.

**I1 — the Tabs group's help.** `tabsGroupHTML()` (`88-settings.js`) now opens the group's body
with `<p class="hint">Hide the tabs this character doesn't use. Sheet always shows.</p>`, the same
pattern the Sources and Loaded data groups use (`88-settings.js:144, :150`), instead of reusing the
first switch's (Spells') own row help. The Spells row now carries no help of its own.

**M7 — the Journal row.** The Section Notes card (`src/html/60-journal.html:20`) and the Trackers
card both live on the Journal tab; hiding Journal takes both away. The Journal switch's row now
says "Also holds the Section Notes card." so a player isn't surprised.

**M1 — the scroll position after a redirect.** `applyHiddenTabs()` (`40-sheet.js`) follows its own
`selectTab("sheet")` with `window.scrollTo({top:0})` when the active tab became hidden, so the
player lands at the top of the Sheet rather than at the hidden tab's old scroll position.

**Wording and citations (M2–M6).** [Shell](../wiki/ui/shell.md) and
[Settings & updates](../wiki/features/settings-and-updates.md) corrected: a Settings flip calls
`setTabHidden()` → `applyHiddenTabs()` directly, not through `renderAll()`; the `[data-tabsw]`
click handler is a per-button listener (`88-settings.js:228-232`), not delegated; the shell's guard
rationale names "a leftover `cvPrevTab`, or a future caller", not a deep link Fieldbook doesn't
have. The spec's As built (`src/docs/specs/2026-10-24-hide-tabs-design.md`) now cites
`rules-data.js:2398` and `88-settings.js:228-232` in place of the stale `rules-data.js:182` and
`88-settings.js:140-144`, and its I1 bullet records the fix made instead of the deferral reason.

Tests: `src/tests/sheet.js` (`#52` suites) — the group-help placement, the Spells row's missing
help, the Journal row's help appearing once, and `window.scrollTo` firing only on the
hidden-active-tab redirect.

Pages: [Shell](../wiki/ui/shell.md), [Settings & updates](../wiki/features/settings-and-updates.md).

## Initiative tracker (#91, 2026-10-25)

An initiative tracker on the combat view: roll initiative when combat starts, a strip of chips
under the combat header, a ▾ table, a dialog per combatant, and a Party card on Bio so companions
join every fight automatically. Built in six tasks against
`src/docs/specs/2026-10-25-initiative-tracker-design.md`; the full task-by-task account, every
`Ruling:`/`minor (deferred)` line and the reviews are in
`.superpowers/sdd/2026-10-25-initiative-tracker/progress.md` and the task reports beside it.

**Data** (`00-constants.js` `blankChar()`: `party:[]`, `combatants:[]`, `combatTurn:""`,
`initMode:"turns"`, `initShowRolls:true`; `71-char-io.js` `migrate()` cleans all five, immediately
before `migrateSheet103()`; `combatEnd()` (`87-combat.js`) also clears `combatants`/`combatTurn`).
`party` is `[{id,name,ac,maxHp}]`. `combatants` is `[{id,kind,name,init,ac,track,band,hp,maxHp,
dead,partyId}]`, `kind` one of `you`/`party`/`foe`, at most one `you` row; the array order **is**
the turn order.

**A new fragment, `src/js/87-initiative.js`**, after `87-combat.js` in `src/manifest.json` (JS
fragment count 35→36 in CLAUDE.md and ADR-001). Pure core: `HB_NAMES`, `HB_SAYS`, `initInt`,
`initOpt`, `cleanParty`, `cleanCombatants`, `combatantDead`, `initSort`, `initFirstAlive`,
`initNextTurn`, `bandOfShare`, `combatantBar`, `initRollCheck`, `initRollLine`, `initModOf`,
`youAC`, `buildCombatants`. The Party card (Bio): `partyRowsHTML`, `renderParty`,
`savePartyMember`, `removePartyMember`, `openPartyForm` — `NOTE_SECTIONS` gains `{k:"party",
tab:"story", title:"Party", nocv:true}` (18→19 sections) and `EDIT_CARDS` gains `"party"` (eleven→
twelve); the card sits in `30-story.html` right after Proficiencies. Roll initiative (opened by
`#cvStart` in place of the old direct `startCombatNow()`): `irState`, `irFoeRowHTML`,
`initRollHTML`, `irPaint`, `irSetTyped`, `irRoll`, `startInitFight`, `openInitRoll` — your row
copies the hit-die spend box's Roll-for-me/typed-and-Apply/Advantage pattern, party rows take a
typed total, foe rows take a name/×N/AC/total and "+ Add a monster" repeats the row. The strip
(inside `#cvHead`, so it sticks with the header) and the ▾ table: `hbBarHTML`,
`combatantHealthText`, `initStripHTML`, `initTableHTML`, `renderInitTable`, `toggleInitTable`,
`initNext`, `setInitMode`, `toggleInitRolls`. The combatant dialog (one per combatant, every target
≥44px): `initTie`, `combatantDialogHTML`, `setCombatant`, `removeCombatant`, `moveCombatant`,
`addCombatant`, `openCombatant`, `openAddCombatant` — foe gets five band buttons that set-and-close
in one tap; party gets an Exact HP/Estimate switch, an HP stepper clamped `0..max`, and a Dead
switch; you gets initiative only, read-only HP/AC off the sheet. `openCombatant()` binds one
delegated `click` listener on `#mBody`, guarded by a dataset flag so it survives every `innerHTML`
swap, rather than one listener per open (a deviation from the plan's own sample code, flagged and
reviewed clean).

**Ruling (plan-level, told to Mike at handoff):** a tie breaks with **Act earlier / Act later**
buttons inside the combatant dialog, never a drag on the table — the table's targets are 44px in a
sideways-scrolling strip, where a drag gesture collides with the scroll; cost if wrong is adding a
drag later.

**CSS.** `00-tokens.css` gains `--hb-healthy`, `--hb-injured`, `--hb-bloodied`, `--hb-near`,
`--hb-empty`. `45-combat.css` carries the strip/chip/table rules; `.cv-init-table` shares
`.cv-head`/`#cvList`'s `max-width:780px;margin:0 auto` so the table doesn't run the full page
width. `50-modal.css` carries Roll initiative's layout and the dialog's `.cd-band` (48px),
`.cd-pm`/`.cd-fld input` (44px) rules, plus a scoped `.add` rule (`#mBody .add,.ini-foot .add`) so
`#irAddFoe`/`#iniAdd` get the "+ Add" chip look the existing `.label .add` rule didn't reach.

**Two fixes made mid-build, both already landed (not open findings):**
- Roll initiative's inputs were going full-width under the app's general `input{width:100%}` rule,
  so Thorn's initiative box and a foe's ×/AC/Init each sat alone on their own line; fixed with
  scoped widths on `.ir-row input`/`.ir-foe input` (Task 3, commit `d5bacc3`).
- `#cvInitMore`'s ▾/▴ and `aria-expanded` reset to closed on every header repaint
  (`combatHeaderHTML()` → `renderCombatHeader()` rewrites `#cvHead` whole) while `#cvInitTable`
  itself stayed open — a real tap right after any round/turn change could silently close an
  already-open table. Fixed with one source of truth, a module-level `_iniTableOpen` flag that both
  the strip's button and `renderInitTable()` read, and `toggleInitTable()` as the one place that
  flips it (Task 4, commit `1da6e8d`).

**Deferred minors, from code review across Tasks 1–5 (progress.md has the full list):**
`initRollCheck` reports the generic "Type the number you rolled." for a negative like `-3` rather
than the d20-range message; a stale `sheet.js` test name after `party` became the second `nocv`
section; `.cv-head.fighting .cv-init{order:5}` sits in the media query ahead of the base `.cv-init`
rule, against the fragment's own convention; the party-row initiative box in Roll initiative has no
visible label; 4 of 8 newly exported functions have no direct unit test; an AC of literal `0`
displays (the `ac!==''` check); the dialog's change listeners read the live `_cdId` rather than the
id captured at open; a typed negative HP becomes blank instead of clamping to 0; `#cdHp` is 42px
tall, under the 44px target convention; every dialog reopen moves focus to the first field, losing
a keyboard user's place; the tie test is an OR of two conditions; the "you" branch of
`combatantDialogHTML` reads the global `character` rather than its own `ch` parameter.

**New finding from this task's browser QA, left for the controller:** typing an HP above max into
`#cdHp` and blurring clamps `character.combatants[].hp` correctly (`setCombatant`'s `hp` patch,
`87-initiative.js`), but the `#cdHp` input itself keeps showing the typed over-max number until the
dialog is closed and reopened. `openCombatant()`'s `ch()` helper
(`87-initiative.js:341-342`) wires `#cdInit`/`#cdAC`/`#cdHp` with a plain `change` listener that
calls `setCombatant` but never re-renders the dialog, unlike every other control in it (band,
track, HP step, Dead, Act earlier/later), which each call `openCombatant(cid)` again afterwards.
Steps: Start combat with a party member on Exact HP, open their dialog, type a number above their
max into the HP field, blur — the stored HP is correctly clamped (confirmed via
`character.combatants`), but the field still reads the over-max number; reopening the dialog shows
the correct, clamped value.

**Browser QA** (project Playwright MCP, before shots from main's `dist/fieldbook.html`, after shots
from the worktree build): before — the combat view in a fight and the Bio tab, at 1280 and 390
(`91-before-*.png`). After — two party members, one with a max HP and one without
(`91-after-bio-party-1280.png`); Start combat's Roll initiative with Roll-for-me, Advantage on and
off, a refused 21 and an accepted 14+Apply, a foe row ×2 plus a second foe with no AC
(`91-after-roll-*.png`); the strip at 1280 and 390 including a sideways scroll and Show rolls off
(`91-after-strip-*.png`); Next through a full wrap — the round advanced from 1 to 2 exactly once
and a manually-added active spell's `elapsedSec` ticked 0→6
(`91-after-wrap-round2-1280.png`); the foe dialog through all five bands, including Dead retargeting
the turn marker to the next living row (`91-after-foe-*.png`); the party dialog's Exact↔Estimate
round trip, HP − and +, the over-max clamp (and the finding above), and Dead
(`91-after-party-*.png`); Turns↔Rounds, including the marker landing on the first living row on the
way back to Turns (`91-after-rounds-mode-1280.png`, `91-after-table-turns-1280.png`); adding an
Ogre mid-fight and removing the then-current actor, retargeting the marker
(`91-after-add-ogre-1280.png`, `91-after-remove-actor-1280.png`); a full reload mid-fight restoring
`combatants`, `combatTurn`, `combatRound`, `initMode` and the active spell's elapsed time via
`loadCharById()` (`91-after-reload-midfight-1280.png`); End combat clearing the strip
(`91-after-end-combat-1280.png`); both skins at 1280 and dark mode once
(`91-after-skin-classic-light-1280.png`, `91-after-skin-humblewood-light-1280.png`,
`91-after-dark-humblewood-1280.png`, `91-after-dialog-dark-humblewood-1280.png`); the console
stayed empty (`browser_console_messages`, `all:true`) across the whole session. Full suite
(`./build.sh --no-zip && ./src/tests/run.sh`) green before each commit.

Pages: [Combat view](../wiki/features/combat-view.md), [Story & notes](../wiki/features/story-and-notes.md),
[Character model](../wiki/architecture/character-model.md), [Sections & layout](../wiki/ui/sections-and-layout.md),
[Theming & icons](../wiki/ui/theming-and-icons.md), [Overview](../wiki/overview.md),
[decisions](../wiki/decisions.md), [1.9.0](../wiki/roadmap/1.9.0.md), the spec's As built
(`src/docs/specs/2026-10-25-initiative-tracker-design.md`).

## Initiative tracker: final review fixes (#91, 2026-10-25)

The final whole-branch review (`.superpowers/sdd/2026-10-25-initiative-tracker/final-review.md`)
found three Important gaps and nine minors; the rulings at the end of `progress.md` took all but m8
(the double render, left: a few ms per tap). Code in commit `3785417`; tests in `sheet.js`
("#91 the final review's fixes"); driven at 390 with the project Playwright MCP
(`.claude/qa/91-fix-strip-390.png`).

- **I1, your chip follows your HP.** `renderHP()` (`66-coins-hp.js`) ends in `renderInitStrip()`
  (`87-initiative.js`), which patches **only your chip and your table row in place** (the chip and
  row markup are now `initChipHTML()`/`initRowHTML()`, shared with `initStripHTML()`/
  `initTableHTML()`). It returns at once with the view closed or no fight, and leaves a node alone
  that would come out the same (`isEqualNode`). Patching, not swapping the strip, is load-bearing:
  the HP box commits on `change`, which its blur fires on the *mousedown* of the next tap, and a
  first version that replaced the whole strip there swapped Next ▸ out between mousedown and
  mouseup, so the tap on Next was lost (driven, reproduced, then fixed). It never goes through
  `renderCombatHeader()`, which would re-announce the round and move focus.
- **I2, the actor stays in view.** `renderCombatHeader()` reads `.ini-chips`' `scrollLeft` before
  its repaint and hands it to `initKeepActorInView()`, which restores it and then scrolls only as
  far as needed to show `.ini-chip.now` (`initChipScroll()`, pure, 8px of margin; sets
  `scrollLeft` rather than `scrollIntoView()`, which can scroll the page). No actor → the old
  scroll is kept. Driven: eight chips at 390, the actor in view after every Next, and back at 0
  on the wrap.
- **I3, Start ▸ commits a typed roll.** The Start handler is now `irStart(party)`: with no roll
  set, a non-blank "I rolled" box goes through `irSetTyped()`, and a bad value stops Start with its
  message in `#irRes`. A blank box still means unrolled.
- **T5-M2 (ruled earlier).** `setCombatant()` (a foe's Dead band, a party member's Dead switch)
  and `removeCombatant()` move the marker off the actor with `initNextTurn()`; when that wraps past
  the end onto a living row (`initTurnWrapped()`), they call `advanceRound(1)` once, as Next does.
- **The combatant dialog.** The `#cdInit`/`#cdAC`/`#cdHp` change listeners write the stored value
  back into the box (an over-max HP shows the clamp; a negative HP is now 0, not blank).
  `.cd-step input` is `min-height:44px`. After −, +, Dead, a track flip or Act earlier/later the
  dialog reopens and `cdRefocus()` puts focus back on the pressed control (Act earlier/later fall
  back to the other one, then Done, at the end of a tie).
- **Minors.** m1: `migrate()` sets `combatTurn` only in Turns mode and never to a dead row;
  `setInitMode("turns")` keeps a stored actor only if alive. m2: `cvLiveRound` (`87-combat.js`)
  makes `renderCombatHeader()` say "Round N" only when the round moved (reset on open, on a
  character switch and out of combat); a wrap in `initNext()` says "Round N — <name>'s turn" as
  one message. m3: a party member on Exact with no max shows "HP n", a "?" bar, and no "/ ?" in
  the dialog. m4: `initFreshId()` gives a missing or repeated id a fresh one in `cleanParty()` and
  `cleanCombatants()`; a blank combatant name becomes "Unnamed" (foe) or "Party member". m5:
  `combatEnd()` returns `{rounds, sec, combatants}`, the list it cleared, for #105. m6:
  `startCombatNow()` stays, commented: no button calls it, the combat-view and #104 tests do. m9:
  `addCombatant()` keeps 60 characters. T3c: party rows in Roll initiative show `placeholder="Init"`.
  T2: the stale sheet.js test name is corrected.

Pages: [Combat view](../wiki/features/combat-view.md), [Character model](../wiki/architecture/character-model.md),
the spec's As built (`src/docs/specs/2026-10-25-initiative-tracker-design.md`).

## QA screenshots filed by issue (2026-10-25)

Mike: `.claude/qa/` had grown to 556 loose files. Shots now live in one folder per issue under
two lanes: `.claude/qa/in-progress/<issue>-<slug>/` while the branch is open, moved whole to
`.claude/qa/complete/<issue>-<slug>/` when it merges. Shots with no issue go in `complete/misc/`.
Every existing shot was moved into `complete/` (all of their branches had merged), slugged from
the issue's title. Still gitignored; still the project's Playwright MCP, absolute paths.

Pages: [Screenshot QA](../wiki/process/screenshot-qa.md).

## 1.9.0 scope: #118 in, #110 to 2.0, 1.9.1 items deferred (2026-10-25)

Mike, on the fifteen issues filed 2026-10-25 (#110–#124):
- The thirteen labelled `1.9.1` (#111–#117, #119–#124: layout width, centring and spacing polish,
  the Vitals edit toggle and HP dialog, chip fixes) wait for 1.9.1.
- **#118 (feat support)** joins 1.9.0, after #102 and before #105.
- **#110 (shapeshifting)** moves to the v2.0.0 milestone: an alternate sheet reaches into every
  computed number, which is what the 2.0 rewrite is for.

Remaining 1.9.0 order (Mike, 2026-10-25): #47 → #102 → #118 → #105.

Pages: [1.9.0](../wiki/roadmap/1.9.0.md), [2.0](../wiki/roadmap/2.0.md).

## #110 to the backlog, not 2.0 (2026-10-25)

Mike, correcting the entry above: #110 (shapeshifting) has **no milestone**; it is held on the
backlog. 2.0 is already large. Its milestone is cleared on GitHub; the 2.0 page no longer plans it.

Pages: [1.9.0](../wiki/roadmap/1.9.0.md), [2.0](../wiki/roadmap/2.0.md).

## Trade window and inventory log (#47, 2026-10-25)

Built on `issue/47-trade-window` in five tasks (spec `src/docs/specs/2026-10-25-trade-window-design.md`,
plan `src/docs/plans/2026-10-25-trade-window.md`; the implementer and reviewer reports and every
Ruling are in `.superpowers/sdd/2026-10-25-trade-window/`).

- **A new fragment, `67-trade.js`,** after `66-coins-hp.js` (37 JS fragments). It holds the coin
  maths (`coinsToCp()`, `cpToGpText()`, `itemWorthCp()`, all cost reads through `fnum()`), the log
  (`logInv()`, `cleanInvLog()`, `logGrant()`, `logFinderAdd()`, `logItemSave()`, `logCoins()`),
  the item helpers undo and the trade share (`invRemoveQty()`, `invRestore()`, which puts a row
  back at its old index), undo (`invUndoCheck()`, `invUndo()`), the Log dialog (`invLogHTML()`,
  `openInvLog()`) and the trade window (`newTradeDraft()`, `tradeClamp()`, `tradeBalance()`,
  `tradeHTML()`, `completeTrade()`, `openTrade()`).
- **Character fields:** `invLog` `[]` and `invLogSize` `500` (100 · 250 · 500 · 1,000 · 2,500) in
  `blankChar()`; `migrate()` cleans both after keeping every field.
- **Every writer logs once:** the finder's Add, the item form (an add; an edit only when a saved
  field changed), the row's delete, `applyItemUse()`, Adjust, a coin box, Convert, grants
  (`grantItemByName()` and `addGrantGold()`, one line per source within 5 seconds), and End combat
  (one `ammo` line per kind fired, from `ammoFightSummary()`, read before recovery clears the
  counts). Grant and ammo lines have no Undo.
- **Undo** per kind, refused with a reason when it is no longer clean. A trade undoes as one step;
  its given rows come back newest removal first, each at its old place. Every Use is undoable,
  including the last one, from a copy kept at Use time (a plan-level Ruling, wider than the spec).
- **UI:** ⇄ Trade and Log on the Equipment card; the Log dialog with filters, a receipt per trade,
  Undo and Clear log; Settings → Sheet display → Inventory → Inventory log size, which trims at
  once. The trade window: "With" with chips from the Party card and earlier trades, You give / You
  get with steppers capped at what you own, the finder (`openBrowse()` gained `cfg.onClose`, fired
  by Close only) and custom items, coin boxes, the two Apply item value switches, the balance, a
  short confirm. Side by side above 700px; tabs and a ✓ button at 700px and under.
- **The finder's Cost override reads `fnum()`:** it truncated 0.5 gp to 0 on every Add.
- **QA fixes in Task 5 (CSS only):** the log, sitting straight in the wide dialog's non-scrolling
  flex body, squashed its rows into each other and could not scroll past the first screen once it
  held more than a screenful (`.modal.wide .m-body:has(> .il-filters)` scrolls, the pieces keep
  their height); the Equipment heading pushed its edit, combat and note buttons off a 390px page,
  which then scrolled sideways (it wraps at 480px and under); the trade's coin boxes fit one row
  on a phone.
- **Open for Mike:** selling above an item's worth reads "N short" in red and confirms — the spec's
  rule, against the mockup's note. Found in QA and reported, not fixed: the Log button's 🕮 has
  no glyph in the app's fonts on macOS (a box); an unchanged save of a potion whose healing is read
  from its description writes an "Edited" line.

Pages: [Inventory](../wiki/features/inventory.md), [Ammunition](../wiki/features/ammunition.md),
[Grants & provenance](../wiki/architecture/grants-and-provenance.md),
[Character model](../wiki/architecture/character-model.md),
[Settings & updates](../wiki/features/settings-and-updates.md), [Shell](../wiki/ui/shell.md),
[Overview](../wiki/overview.md), [Known issues](../wiki/roadmap/known-issues.md),
[1.9.0](../wiki/roadmap/1.9.0.md), the spec's As built.

## #47 final review fixes (2026-10-25)

The whole-branch review of `issue/47-trade-window` returned "With fixes"; the controller ruled on
each finding (`.superpowers/sdd/2026-10-25-trade-window/final-fix-brief.md`, the review beside it,
the report in `final-fix-report.md`).

- **K1, undo never reports success while restoring nothing.** `applyItemUse()` and a trade's give
  (`invRemoveQty()`) now keep a copy of the item, its attack and both indexes every time, not only
  when the row went. Undo adds back to a row still there, or restores the copy with the quantity
  used or given, at its index. `invCheckPart()` checks exactly what the apply step can do: an old
  line with neither a row nor a copy is refused ("It is no longer in your inventory.") and never
  marked undone. Before, Use 1 of 2 potions then delete the other, or give 2 of 5 arrows then fire
  the rest to zero, undid "successfully" and gave nothing back (the trade even took its coins).
- **I1, an unchanged item-form Save writes no line.** The form builds its record in one function,
  `readRec()` inside `openItemForm()`; a baseline from it is taken as the form opens and compared
  at Save. A potion's healing read from its description, armour's AC, a missing `used` or `qty`
  no longer read as edits; no field is special-cased. A trade's custom items get `description`,
  `effects` and `equipped` at creation.
- **I2, the remaining unlogged changes.** `revertEquipmentGrants()` writes one `grant` line,
  "Removed with *source*", listing what left, with `meta.revert` and no Undo; `logGrant()` never
  folds into it. A row's Recover N during a fight is kept per kind in a new character field,
  `ammoFight` (`{}` in `blankChar()`, coerced by `migrate()`, cleared by `combatStart()` and End
  combat), and End combat's line adds it in (`ammoFightTotals()`); the toast's Undo recovery takes
  End combat's own recovery back off the line. Item-use pips stay unlogged (uses, not quantity).
- **Line text (C4, M9):** finder and form add lines carry the cost; receipt item lines carry their
  cost and coins run pp → cp; a blocked trade undo names the item; an "Undid:" trade line has no
  empty Receipt; the ammo line reads "Fight of N rounds"; the Use line says what is left.
- **UI (C1, C5, M7):** the Log button is an inline SVG; the log's rows scroll in `.il-scroll`
  (the `:has()` rule is gone); `.il-scroll>.il-day:first-child` replaces a selector that never
  matched; the active filter's text is `var(--paper)`.
- **Minors:** lowering the log size trims at once but asks first when lines would go
  (`setInvLogSize()`), a deliberate deviation from the spec's "at the next write" (M1);
  `cleanInvLog()` drops a malformed `undo` per kind (`invUndoShape()`) and `invUndoCheck()` never
  throws (M2); a granted item whose source is gone comes back ordinary (M3); a heal- or status-only
  Use writes no line (M4); `itemWorthCp()` and `tradeGetCp()` multiply before rounding (M5); a
  restored attack goes back at its own index (M6).
- **Measured:** a 2,500-line log of edits stores two item copies a line: about 1,470 characters a
  line for mundane gear and 2,090 for a median magic item, so 3.7 to 5.3 million characters for
  the log alone, at or past a browser's usual localStorage quota for the whole app. Recorded in
  known issues.

Pages: [Inventory](../wiki/features/inventory.md), [Ammunition](../wiki/features/ammunition.md),
[Grants & provenance](../wiki/architecture/grants-and-provenance.md),
[Character model](../wiki/architecture/character-model.md),
[Settings & updates](../wiki/features/settings-and-updates.md),
[Known issues](../wiki/roadmap/known-issues.md), [Decisions](../wiki/decisions.md), the spec's As
built.

## #47 re-review residuals (2026-10-25)

The re-review of the final fixes approved them and left two Minors, both fixed here.

- `invCheckPart()` sums an `add` part's records per row before checking. Received items of one name
  stack onto one row, so two records of 2 on a row of 3 passed one by one, and the undo then took
  back 3 while claiming 4. It is now refused unless the row still holds them all. Test in
  `src/tests/sheet.js`.
- Three doc statements made true: Use is refused not only for an old line with no copy but also
  for a uses-only Use whose row is gone or lost its uses; the duplicate "removing a source"
  Decisions line is gone.

Pages: [inventory](../wiki/features/inventory.md), [decisions](../wiki/decisions.md).

## #47 follow-ups: smaller edit lines, selling, the Coins filter, --on-accent (2026-10-25)

Mike's rulings on the three questions #47's final review left open, built on `issue/47-followups`
(no new issue: they finish #47's work).

- **Edit lines keep only what changed.** `logItemSave()` writes `invEditUndo(before, after)`:
  `{id, changed:{field:{b,a}}, hash}`, a side left out where the field was absent, and `invHash()`
  (cyrb53, key order ignored) of the row as edited. "Changed again since" compares the hash, and
  Undo sets the changed fields back, so it rebuilds the row exactly. A line saved with two whole
  copies is converted by `cleanInvLog()` on load (`invEditU()`), so existing logs shrink too.
  Measured: 500 edit lines of a long-described magic item fell from 2,346,581 characters to
  116,562 (−95%). Use, give and delete lines still keep one whole copy each.
- **Selling never reads red.** `tradeBalance()` returns `short` only when the items you get are worth
  more than everything you give; coins you receive never count toward it. A balance in your favour
  from coins received reads "N gp in your favour", plainly, and Complete skips the confirm.
- **Grant lines that moved gold file under Coins too.** `addGrantGold()` and
  `revertEquipmentGrants()` set `meta.gold`; `invInFilter()` adds those lines to the Coins filter.
  They still file under Items.
- **`--on-accent`**, a token for text on an `--accent` fill, one per theme and skin plus the rail.
  Every rule that put text on the accent uses it, replacing `#20160a`, `#fff`, `--paper` and
  `--panel`: the primary button, the update pill, filter pills, segmented buttons, Use, the spell
  pin's tick, the level ring, the toast, the combat tab, the initiative chip, the log filter and the
  level-up banners. Lowest contrast now 4.8:1 (humblewood light); classic light's red was 2.05:1.

Pages: [inventory](../wiki/features/inventory.md), [theming & icons](../wiki/ui/theming-and-icons.md),
[known issues](../wiki/roadmap/known-issues.md), [decisions](../wiki/decisions.md).

## Extensions and manifest installs (#102, 2026-10-26)

Fieldbook installs and updates packs from a **manifest**, and Settings → Rules data became
**Extensions**. Built on `issue/102-extensions` in seven tasks. Spec
`src/docs/specs/2026-10-26-extensions-manifest-design.md`, whose As built section lists every ruling
and deferred minor.

- **The manifest is format 2** of the data zip's `fieldbook-data.json`: per pack a `category`,
  `title`, `summary` (≤140), `description` (≤4,000), `minApp`, `size`, `sha256` and `requires` (with
  an optional http(s) `url`), at a path relative to the manifest; top-level `name` and `homepage`.
  `fbdata.py pack` writes it; `validate` checks lengths, `minApp`, `size` and folders as well as
  zips; the new `release-files` writes `releases/data/` (the manifest and the bundles, flat).
  `data/packs.json` gains `name`, `homepage`, and per pack `summary` and `description`.
- **The official source** is `releases/data/fieldbook-data.json` at the release tag on
  raw.githubusercontent.com, which answers a `file://` page. `./build.sh --release` and
  `data-release.js` (public registry only) write `releases/data/`; both workflows check it matches
  the build and is public only.
- **`89-extensions.js`**, the 38th JS fragment: `sha256Hex()` in JavaScript, `readManifest()` /
  `extEntry()` (caps 64 KB, 1,000 packs, 32 MB a file; paths an allow-list of
  `[A-Za-z0-9._-]` segments), `settings.sources` (official, manifest, plain) converted once from
  `rulesSources`/`rulesUrl` by `convertSources()` on every boot, `checkSources()` at boot (quiet,
  skipped offline) and on Check now, `availableFor()`, `planInstall()` and the all-or-nothing
  `runInstall()` (fetch and verify everything first; a merge throw restores a snapshot), the
  Extensions page, the details dialog, the plan dialog, Manual install (files, a folder, a drop) and
  the pills.
- **The pills.** "Extensions · N updates" (N updates at ≤560px) opens Settings → Extensions; each
  pill's × writes `settings.dismissedUpdates` and hides it until a newer version arrives. The app
  update pill gets the same ×, under `dismissedUpdates.app`.
- **Gone:** the Sources URL list, Fetch all (a plain source has its own Fetch), Import files, Get
  templates (`downloadRulesTemplates()`), the Settings Loaded data list, `renderSrcRows()` and
  `#fileRules`. Every file picker (home, the Rules tab, Manual install) goes through
  `manualInstallFiles()` and the plan. `importRulesFiles()` stays for the suites.
- **Player text** that named the removed UI now names Settings → Extensions, Remove all and Manual
  install (`706e885`), and `docs/rules-schema.md` gains "Publishing extensions".
- CLAUDE.md constraint 2 names the manifest checks and pack downloads among the allowed network
  calls. Closes known-issues' "A data update is announced, never installed".

Open for Mike: at ≤560px a showing notice takes a third header row; the alternative is one combined
"↑ N" pill with a menu (the reviewer recommends keeping the row).

Pages: [data archive](../wiki/architecture/data-archive.md),
[rules packs](../wiki/architecture/rules-packs.md),
[settings & updates](../wiki/features/settings-and-updates.md),
[storage](../wiki/architecture/storage.md), [shell](../wiki/ui/shell.md),
[data kit](../wiki/data/data-kit.md), [known issues](../wiki/roadmap/known-issues.md),
[overview](../wiki/overview.md), [1.9.0](../wiki/roadmap/1.9.0.md),
[building & CI](../wiki/process/building-and-ci.md), [decisions](../wiki/decisions.md); and
[RELEASING](../RELEASING.md).

## #102 final review fixes (2026-10-26)

The whole-branch review of #102 came back "With fixes"; the controller ruled on each (Rulings 15–18).

- **The Settings dot (I1, Ruling 15).** `rulesUpdatePending()` reads `extUpdateRows().length>0`, not
  `extPillCount()`, so the sidebar dot and the "· update" description stay while any update is
  pending (spec §6.2) and only the top-bar pill is cleared by its ×. Taken off "Open for Mike".
- **Who offers an update (I2, Ruling 16).** A manifest names itself, so a stranger's manifest could
  call itself "Fieldbook public data" and offer an update to a pack imported by hand, with nothing
  saying who. `extSourceName()` now gives a manifest source as "*name* (*host*)" (`extSourceHost()`,
  from its URL) in the rows, the plan, the details' Source box, "Also from *source*" (once "Also from
  this source") and Sources; only the built-in source reads the bare "Fieldbook public data". A loaded
  pack's update row whose offering source isn't `packOrigin` (a file, "manual", or another source)
  adds "· update from *name (host)*", and its plan line reads "Update from *name (host)*".
- **Caps without Content-Length (I3, Ruling 17).** `extFetchBytes()` reads `r.body.getReader()` with a
  running byte count and, past the cap, cancels the reader, aborts the request and rejects with the
  cap's own message; `arrayBuffer()` is the fallback only without a body stream, and its length is
  checked too. The timer still covers the whole stream and now also cancels the reader.
  **`addSource()` passes `EXT_FILE_MAX`, not the ruled `EXT_MAN_MAX`:** spec §4 lets a plain source
  be a whole pack file (SRD 5.2's `classes.json` is 269 KB), which a 64 KB cap would refuse; a
  manifest over 64 KB is still refused by `readManifest()`'s own byte check. Flagged to the controller.
- **Ruling 18.** A release list that isn't a JSON list reads "GitHub's release list couldn't be read"
  on the official row (M8). `fbdata.py` `validate <folder>` ignores dotfiles such as `.DS_Store`, and
  `release-files`' stale sweep removes only regular, non-dot `*.json` files (M9, and T1's deferred
  `isfile` guard). `data-release.js`'s exit-handler cleanup is in try/catch, so a cleanup error
  warns instead of turning a good release into exit 1. The `setCollapse` comment in
  `00-constants.js` names the `ext:*` keys (M10). `docs/rules-schema.md` §8 limits add `license` 64
  characters and `requires` 50 entries, and says `validate` ignores dotfiles.

Tests: data-archive (the inverted dot test; I2 with the reviewer's repro; I3 with stubbed streams,
over, under and exactly at the cap, a stall, `checkSource()` and `addSource()`; M8), data-kit (M9;
the exit handler under a preload whose `fs.rmSync` throws).

Pages: [settings & updates](../wiki/features/settings-and-updates.md),
[rules packs](../wiki/architecture/rules-packs.md), [data kit](../wiki/data/data-kit.md).

## #102 bidi strip (2026-10-26)

The re-review of the final fix wave found that a manifest name ending in U+202E (RIGHT-TO-LEFT
OVERRIDE) made the browser draw "name (host)" with the host reversed: `moc.buhtig.ws` showed as
"(sw.github.com)" on the row, the plan line and the Sources title (N1). Mike's call: strip invisible
characters.

- **`extText()` strips every format character, `\p{Cf}`, before the cap** (`extPlain()`,
  `EXT_INVISIBLE`): the bidi controls U+200E/F, U+202A–202E, U+2066–2069 and U+061C, the zero-width
  characters and the BOM. Every manifest string goes through it: name, titles (a title that falls
  back to the system too), summaries, descriptions, licences, attributions, `requires[].pack`.
  Letters, accents, emoji and right-to-left scripts are kept; an emoji joined by U+200D (ZWJ) splits
  into its parts.
- **`extSourceName()` and `extSourceHost()` strip again at display time**, so a manifest name saved
  before this fix can't reverse the host either. `new URL().host` is already clean: an IDN comes back
  as punycode, a zero-width character is dropped, and U+202E makes the URL invalid.
- **N2:** `addSource()` over its cap says "Its answer is larger than 32 MB.", not "It couldn't be
  reached: …" (the error carries `tooBig`).
- **N3, the spec's As built:** Ruling 19 (`addSource()` at `EXT_FILE_MAX`) replaces "Flagged for the
  controller"; Mike's three decisions are Rulings 20–22: strip invisible characters; Homebrew's
  Xanathar's chip stays, and Homebrew moves into the private repo as separate work; the ≤560px notice
  row stays. "Open for Mike" is empty. The wiki's open items for the notice row are closed, and
  known issues drops the two release-tooling minors fixed in the last wave.

Tests (data-archive): `extText()` strips U+200B, U+FEFF, U+2066 and U+202E, before the cap; accented,
emoji, CJK and Hebrew text is kept; every manifest field is stripped; the reviewer's repro (name
"Fieldbook public data ‮", URL `https://moc.buhtig.ws/m.json`) shows "(moc.buhtig.ws)" and no U+202E
on the row, the plan line and Sources; a stored unstripped name; an IDN host is punycode; N2's wording.

Pages: [settings & updates](../wiki/features/settings-and-updates.md),
[rules packs](../wiki/architecture/rules-packs.md), [shell](../wiki/ui/shell.md),
[homebrew](../wiki/data/homebrew.md), [known issues](../wiki/roadmap/known-issues.md).

## #102 bidi strip: URLs (2026-10-26)

The second re-review found that the U+202E trick still worked through a source's own URL.
`addSource()` stored the raw text the player typed (`url`/`base`), and the Sources sub-line and the
details' Manifest line showed it unstripped. Live, `https://good.example/‮noj.live-lifedoog` drew
the path, the separator and "checked today, …" backwards. This falls under Ruling 20 (Mike's
"strip invisible characters").

- `addSource()` fetches and stores the normalised URL, `new URL(u).href`, as `url` and `base`.
  That form percent-encodes a raw U+202E.
- Every URL shown as text goes through `extPlain()`: the Sources sub-line, the details' Manifest
  line and the Homepage link text. The Homepage link's `href` is the normalised URL. Plain sources
  converted from old settings were already shown through `extSourceName()`, which strips them.
  Stored URLs that predate the fix are covered by the display strip.

Tests (data-archive):
- an added URL with a raw U+202E is stored normalised;
- the Sources and details HTML carry no U+202E and still show the host;
- a raw stored URL and a converted plain source display without it.

Pages: [settings & updates](../wiki/features/settings-and-updates.md),
[rules packs](../wiki/architecture/rules-packs.md).

## Feat support (#118, 2026-10-27)

Branch `issue/118-feats`, commits `2bf87c3..be89263`, then this docs commit. Spec:
`src/docs/specs/2026-10-26-feat-support-design.md`. Its As built section lists every ruling and
every deferred minor. Plan: `src/docs/plans/2026-10-27-feat-support.md`. Mike decided the nine
§2 decisions on 2026-10-26 and 2026-10-27.

**What changed:**

- **The converter.**
  - `convert_feats()` keeps 5etools' structured `ability` field (`feat_ability()`): a
    `{choose, amount, max?}` or a fixed `{abil: n, max?}` per increase. It drops `hidden` entries.
  - `convert_races()` writes a race's or subrace's `feats` (`race_feats()`):
    - `anyFromCategory` becomes `choices:[{type:"feat", category, label}]`;
    - `any` becomes `{type:"feat", label:"A feat of your choice"}`;
    - a named feat becomes `feat`, resolved through the feat index, with `_title_feat_name()` as
      the fallback.
- **The packs.**
  - SRD 5.2: 8 of 17 feats gain `ability` (the seven Epic Boons and Grappler), and Human gains
    `{type:"feat", category:"origin", label:"An Origin feat of your choice"}`.
  - The private 2024, Xanathar's and Tasha's packs moved the same way (feats 54/77, 11/15 and
    10/15; races in 2024 and Tasha's). They are committed in the private repo as `999bf63`, which
    is **not pushed**; push it right after public `main`.
  - **Each of the four packs needs a data release, which Mike cuts.**
- **The ASI step (`58-choices.js`).**
  - An `asi` choice is one list: Ability Score Improvement pinned first, then the feats the
    character qualifies for (`featOfferable()`), a search box and a Show all switch. Below it is
    one panel, holding either the +2 / +1+1 controls or the feat's text and its "+1 to:" chips.
  - Prerequisites are read from the feat's first line (`featPrereq()`, `featUnmet()`).
  - The +1 comes from the `ability` field, else from the text (`featAbilityChoices()`), minus
    what the feat's own effects already raise (`featPendingIncreases()`).
  - `commitAsiPick()` grants the feat with the class-level origin and stores the +1 as an effect
    on that feature.
  - A pick with an unmet prerequisite asks through `confirm()` (Ruling 2), which never blocks.
  - Show all lifts every filter, a species list's category included (Ruling 6).
- **Species and background feats.**
  - `applyRace()` grants a fixed `feat`. An array of two or more is a choose-one menu (Ruling 10).
    Each `{type:"feat"}` choice is queued with the `race:` sid, and `applyBackground()` does the
    same with the `bg:` sid.
  - Every such choice without `from` opens the same list with no ASI row (Ruling 9). With a
    category it is filtered to that category. With none it offers Origin feats, plus General and
    Fighting Style feats whose readable prerequisites are met. Epic Boons appear only under Show
    all.
  - `commitExtraChoices()` grants the pick with the species or background origin.
- **Level 19.** `applyClassLevel()` adds `{type:"asi", boon:true}` when level 19 has a trait
  named "Epic Boon" and no `asi` choice. The level-up card reads "Epic Boon — a feat, or an
  Ability Score Improvement".
- **Feats allowed.** `character.featsAllowed` is `true` in `blankChar()`, and `migrate()` keeps a
  boolean. The switch is in Settings → Sheet display → Levels and companions. Off, the ASI step
  draws today's controls, and species and background feat choices still open.
- **Undo level-up (`57-levelup.js`).**
  - `doLevelUp()` takes `_undo` (a JSON copy) before it changes anything (Ruling 1).
  - Once the last window closes, `luSettle()` writes the `levelLog` record, then takes a
    signature of the sheet, and toasts "Fighter is now level 8 · Max HP 61 → 68" with Undo.
  - Undo is offered while the sheet still matches that signature exactly. It is not cleared by
    the next save, as spec §5a first said.
  - The card's own **Undo level-up** skips the signature (Ruling 3).
  - Switching character, going Home or reloading ends it.
- **Level down with a record (`56-class.js`).**
  - The record is `{at, class, level, hp, features:[{id, name, grants}], abilities, subclass,
    grants, slots}`, capped at 200 records.
  - Level down shows the record's HP and features as ticked boxes. A feature's grants go with it
    only when they trace to that feature: exactly one of the level's new traits grants that
    proficiency outright.
  - Everything else (other grants, the subclass, spells) is listed to adjust by hand.
  - A level with no record lowers only the number, as before.
  - `removeClass()` drops that class's records.

**Why:** a player at an ASI level had to add a feat and its +1 by hand. Human's Versatile was
prose. Level down left the player to remember what the level gave.

**Tests:** converter (`feat_ability`, `race_feats`); sheet (helpers, the step, species and
background lists, level 19, Undo end to end, the record and level down); rules-data (the switch).
Browser QA is in `.claude/qa/in-progress/118-feats/` (`118-before-*`, `118-after-*`, `118-t*-*`).

**Left open:**
- the deferred minors, listed in the spec's As built;
- three new known issues: fixed feat `skills` not granted, "+1 to two" accepting one ability
  twice, and choices inside feats staying manual.

Pages: [character building](../wiki/features/character-building.md),
[abilities & skills](../wiki/features/abilities-and-skills.md),
[grants & provenance](../wiki/architecture/grants-and-provenance.md),
[character model](../wiki/architecture/character-model.md),
[converter](../wiki/data/converter.md), [settings & updates](../wiki/features/settings-and-updates.md),
[known issues](../wiki/roadmap/known-issues.md), [2.0](../wiki/roadmap/2.0.md),
[1.9.0](../wiki/roadmap/1.9.0.md), [decisions](../wiki/decisions.md).

## #118 final fix wave (2026-10-27)

**What:** the five minors from #118's final whole-branch review.

- **Undo closes the open window.** The level-up toast stays reachable over a modal. Before, its
  Undo swapped `character` under whatever dialog was open. In a Level down dialog, that dialog's
  Level down then removed the *older* record (Fighter 8 → toast Undo → Fighter 6).
  - `undoLevelUp()` now clears `_undo` and the in-progress flag first, then closes an open modal
    with `closeModal()`, then restores. Its `luMaybeSettle()` hook finds nothing to settle.
  - `applyLevelDown(idx, remove, expect)` takes what the dialog showed: the class entry, the level
    and the record. On any mismatch it toasts "The sheet changed while Level down was open, so
    nothing was changed. Open Level down again." and changes nothing. An undo makes a new
    `character`, so the identity check fails.
- **A malformed imported level record no longer breaks Level down.** `migrate()` still drops
  records that aren't objects or lack `class`, `level` or a `features` array. A kept record now
  keeps every key, with the parts Level down reads made safe:
  - features: objects with a non-empty string `id` (`lvRecFeats()`), each with a `grants` array;
  - grants: objects (`lvRecGrants()`), with string `sid`/`type`/`key`;
  - `hp` a number ≥ 0, `subclass` a string, `abilities` an object.

  `levelDownHTML()` and `applyLevelDown()` read through the same two helpers, and `lvGrantKey` is
  null-safe, so a record that bypasses `migrate()` can't throw either.
- **A feat row's short line skips `Repeatable:` and `Prerequisite(s):` lines** (`asiFeatShort()`).
  SRD Skilled read "Repeatable". It now has no short line, like Savage Attacker.
- **"+1 any".** A feat whose +1 allows all six abilities reads "+1 any · Peerless Aim", not "+1 Str
  or Dex or Con or Int or Wis or Cha · …". Any other set is listed as before.
- **rules-schema §6.2.** A species' fixed `feat` gets its effects, not its `ability` increase:
  that is asked only when the feat is picked from a list. The player raises the score by hand, or
  the pack author puts the increase in `effects`. This is a doc fix only. Routing a fixed feat's
  `ability` through the +1 step would change behaviour, and that is Mike's call.

**Why:** M1 lost a second level and its record. M2 made Level down do nothing on a bad import. M3
and M5 were misleading or long sublines. M4 promised players something the app doesn't do.

**Tests:** sheet: the toast's Undo while Level down is open closes the dialog and records
nothing, and the stale click changes nothing; a stale or moved `expect` applies nothing, and a
matching one applies. Four malformed record shapes each load, round-trip unchanged, and open and
apply Level down, raw as well as migrated. The short-line fixtures are invented: Repeatable,
Prerequisite in any case, "+1 any" in any order, five abilities, and a fixed increase.

**QA:** `.claude/qa/in-progress/118-feats/118-fix-*` holds the shots:
- before and after of Skilled under Show all at Fighter 8;
- before and after of the level-19 boons, at 1280 and 390;
- the M1 sequence before (the dialog stays open over Fighter 7) and after (the dialog closes).

The toast's Undo was a real click. Live, a malformed record migrated and leveled down, and a normal
Level down was clicked through.

Pages: [character building](../wiki/features/character-building.md),
[character model](../wiki/architecture/character-model.md),
[known issues](../wiki/roadmap/known-issues.md) (the fixed feat's `ability`, M4), and the spec's
As built.

## #118 the warning window, and Epic Boon once (2026-10-27)

Two changes Mike approved on 2026-10-27, which settle the spec's last two Open items.

**The app's own warning window.** `askConfirm({title, message, ok, cancel})` in
`80-modal-forms.js` returns a Promise of true or false. It replaces the browser's `confirm()` at the
two choice windows' Done.
- **A second layer.** Its own backdrop and box (`#askWin.backdrop.ask-back`, z-index 90, between
  the modal's 80 and the toast's 9999), built on demand and removed on close. The dialog under it
  stays open and untouched. It uses the modal's own classes, so both skins and both themes come
  free. `50-modal.css` adds only a narrower box, a 16px gutter and 44px buttons.
- **Text only.** The title, message and labels are `textContent`, and the message's `\n` are line
  breaks (`.m-body p` is pre-wrap). Defaults are "Are you sure?", OK and Cancel.
- **Keyboard.** `role="alertdialog"`, `aria-modal`, labelled by its title and described by its
  message. Focus starts on the safe button and Tab stays between the two. Escape answers no, and
  so does a backdrop click under the dialog's own rule (fix round 1, below). A capture-phase `keydown` on `document` (`askKey()`) stops Escape there, so
  the dialog's own Escape never sees it, and that handler also checks `!_ask`. A held Enter or
  Space is ignored, so a key held on Done can't repeat into the warning. Every other `<body>`
  child goes inert, the dialog included and the toast excepted. On close, focus returns to what
  had it.
- **Never `closeModal()`.** Answering it doesn't settle a level-up (`luMaybeSettle()`) or run a
  dismissal guard.
- **Rulings.** Asking again while one is open answers the open one no, then shows the new one; no
  queue. `openModal()` and `closeModal()` answer it no through `askCancel()`,
  because the question was about a window that is no longer there. It is created on
  demand rather than in the template, so `modalTakeFocus()` can never find it hidden and make it
  inert. This is the first `async`/`await` in `src/js`.

**Done.** Both choice windows' Done (`runChoices()`, `runExtraChoices()`) is now
`choiceDoneHandler(btn, commit)` in `58-choices.js`.
- It asks "Picks left" (Go back / Continue anyway) with `choiceShortfall()`'s text. Then, one feat
  at a time, "Prerequisite not met" with the spec's sentence (Choose another / Take it anyway). Both
  go through `choiceWarningsConfirmed()`.
- The picks are read in `commit`, after the answers, with the window still open, as before.
- **With nothing to ask, it commits at once, in the same task.** So every flow behind the window,
  and the level-up's settle, keep their timing, and `char-update`'s synchronous flow tests pass
  unchanged.
- With something to ask, a second press while waiting is ignored. A window that went while the
  question was open (its button is out of the page) commits nothing.
- `asiPickConfirmed()` and `asiScreenPicksConfirmed()` are gone. Their parts are `asiScreenPicks()`
  (the DOM read) and `asiPickWarnings()` (the sentences, DOM-free).
- `dismissModal()`'s `confirm()` and the app's other `confirm()` calls are #126's to convert. The
  browser's prompt when a tab closes stays.

**Epic Boon once (`301442e`).** The level-19 card listed Epic Boon twice: the class feature and
the choice. `levelGains()` now leaves the feature row off while feats are allowed and the level
has a `boon` ASI choice, so the choice row is the one shown. The feature itself is still added to
the Features card. With Feats allowed off the choice reads as a plain ASI, and the feature row
stays.

**Tests:** sheet drives the real window in a small fake document:
- it opens over a stand-in dialog that stays, with the roles and labels;
- the safe button is focused, Tab cycles, and a held Enter is ignored;
- Escape answers no and goes no further, and inert is released, the listener removed and focus
  returned;
- the primary button, the backdrop (but not the box) and the safe button each answer;
- a second ask cancels the first;
- nothing is ever parsed as markup, and nothing calls `closeModal()` or settles.

Both Done handlers are driven too, with `askConfirm` stubbed:
- with nothing to ask, they commit in the same task;
- the shortfall, declined then accepted, reads the picks only afterwards;
- the feat warning declined keeps the window open and grants nothing, and accepted grants once;
- a double press asks and commits once, and a window gone mid-question commits nothing;
- `runExtraChoices()` declines and accepts the same way.

rules-data's source checks follow the new Done.

**QA:** shots are in `.claude/qa/in-progress/118-feats/118-warn-*`:
- the feat warning over the level-up window, in both skins, light and dark, at 1280 and 390;
- the window after Choose another, the sheet after Take it anyway, and the shortfall warning in the
  Humblewood skin.

Driven live with the SRD pack: a Fighter 7 → 8 with Show all on and Grappler picked.
- Enter on Done opened the warning with focus on Choose another. Clicking it left the window open
  with Grappler and its +1 intact.
- Escape closed only the warning. Tab cycled between the two buttons, and Space on Take it anyway
  granted Feat: Grappler once and settled the level once.
- A Fighter added at level 1: Done with no skills asked Picks left. A backdrop click cancelled it
  (the behaviour before fix round 1: a backdrop click now does nothing unless Tap outside is on),
  Continue anyway went on to the equipment window, and that window's Done committed with no
  warning.

The other skin's 1280 shots swap `data-skin`/`data-theme` with the warning open. The shortfall
shot is a real Humblewood character. The console showed nothing new.

Pages: [shell](../wiki/ui/shell.md),
[character building](../wiki/features/character-building.md), [decisions](../wiki/decisions.md),
and the spec's §5, §6 and As built.

**Fix round 1 (the same day, before review).** Three concerns from the first report, settled with
tests:
- **An "or" prerequisite is named whole.** `featUnmet()` used to name only the closest alternative,
  so Grappler (Str 13 or Dex 13) told a character with 10 in both "needs Strength 13 or higher".
  - A part every alternative shares (its "Level 4+") is now listed on its own.
  - What is left of the alternatives is one entry: "Strength 13 or Dexterity 13 (yours: Strength
    10, Dexterity 10)".
  - A single alternative (an and-group) still lists each unmet part with its "or higher (yours
    is N)".

  The row's amber tag and the warning both read it. This uses `featPartNeed()`, `featPartHave()`
  and `featPartSig()`.
- **A backdrop click follows the dialog's rule (#106).**
  - With Tap outside to close dialogs off (the default), a click on the warning's backdrop does
    nothing.
  - With it on, only a click pressed and let go on the backdrop counts, and not within
    `ASK_CLICK_GRACE` (400 ms) of opening (named `ASK_BACKDROP_GRACE` until fix round 2).
  - So the second click of a double-click on Done, which lands on the new warning's backdrop, never
    answers it. Escape and the safe button always cancel.
  - `.ask-back` is `user-select:none`, because that second click otherwise highlighted the nearest
    word in the box.
- **Undo replaces the sheet the warning asked about.** `undoLevelUp()` calls `askCancel()` first,
  and `closeModal()` now calls it unconditionally.
  - It used to be gated on the dialog being open, so the harness, whose `modal` is a stub, could
    never reach it.
  - The toast's Undo over an open warning now answers it no, closes the window and restores the
    sheet, and nothing commits after.

Tests (sheet):
- seven invented prerequisite fixtures (shared and-part, one alternative met, an and-group, an
  unequal or-group, three alternatives) and the warning's sentence;
- the backdrop with the setting off, on, a press that began in the box, inside the grace, and after
  it;
- a double-click on Done with the real window, under both settings: the warning stays and nothing
  commits;
- the toast's Undo while a warning is open, driven end to end with the real `askConfirm`.

QA:
- `118-warn-fix1-orgroup-dblclick-1280.png` and `118-warn-fix1-orgroup-390.png`: the or-group
  warning, after a real double-click, with no selection.
- `118-warn-fix1-orgroup-tag-390.png`: the longer amber tag, which wraps inside its pill.
- `118-warn-fix1-undo-under-warning-1280.png` and `118-warn-fix1-undo-after-1280.png`: a real click
  on the toast's Undo over the warning. Level 7 was restored, nothing was granted, and there was no
  record.

**Fix round 2 (review minors).**
- **The buttons get the same 400 ms grace.** At phone width Done and the warning's right-hand
  button can sit under the same spot, so the second click of a double-click could accept the
  warning unread. A pointer click on either button (`e.detail > 0`) within `ASK_CLICK_GRACE` of
  opening now does nothing. Enter and Space (a click with `detail` 0) always work.
- `featUnmet()` loses a dead `rest.length===1` branch. With one alternative every part is shared,
  so it already returned above. The output is identical.

Tests (sheet): a pointer click on the ok button at 399 ms is ignored, and on the safe button too;
at 400 ms ok accepts; keyboard activation works at once on both buttons. The double-click test also
clicks the ok button. QA: `118-warn-fix2-dblclick-390.png`, a real double-click on Done at 390 px,
with the warning still open.

## The Homebrew pack moves to the private repo (#125, 2026-10-28)

Mike, 2026-10-27: Homebrew (The Predator, CC BY-SA 3.0) moves to RPGFieldbookPrivate, because it
leans on private content (two Xanathar's spells). Players who installed it get release notes
only: their copy keeps working, shown as a plain installed pack with no updates.

1. **The private repo** gains `data/homebrew/` (the three files, byte-identical but for one line)
   and a `Homebrew` entry at the end of its `data/packs.json`, carried over with its `version`
   (1.8.0), `digest`, `license`, `attribution`, `summary` and `description`. The Xanathar's
   `requires` group gains `"file": "xanathars_full.json"` in all three files, now that both packs
   live together; the SRD 5.2 group is unchanged. That line moves the pack's digest, so the next
   private data release bumps it. The description now says it needs Xanathar's for two spells
   (not a digest field). `fbdata.py bundle` stamps the licence and credit from the private entry
   into `homebrew_full.json`, and `pack` lists them in the private archive's `NOTICE.md`; the
   private release notes say so instead of "these packs carry no open licence".
2. **The public repo** removes `data/homebrew/` and its registry entry. `DATA_VERSIONS` is left
   as it is, as #85 left it for the four packs (L5426, ruling `LEFT_FOR_PRIVATE`): `release.js`
   retakes it from the registry at the next app release. `docs.js`'s `LEFT_FOR_PRIVATE` gains
   `Homebrew`. No `releases/data/` exists yet; `release-files` rewrites it from the registry, so
   the first one will hold no homebrew. The public archive now holds SRD 5.2 alone, and its
   `NOTICE.md` credits only the SRD.
3. **Tests moved private.** The homebrew pack checks (files, system, same `requires`, the
   Predator), its `requires` groups, the SRD 5.2 plus homebrew import, homebrew's D&D group
   resolving with SRD 5.2 alone (#84 R7), and its bundle's credit reaching Settings move to
   `tests/private-data.js`. There, `homebrew` joins the folders read from the private repo, so the
   item and effect checks, the table-shape checks, the bundle round trip and its anchors cover it.
   New there: the Xanathar's group names its file, both files are bundles a registry ships, and
   importing the Xanathar's bundle too leaves nothing missing. The registry check now compares
   licence and credit as well, and #77's spell-bonus check expects homebrew to carry none, as the
   public one did.
4. **Public tests.** Every `['homebrew','srd52']` loop is `['srd52']`. Kept on invented packs: the
   tooltip's two forms, "— import <file>" and "— from <pack>" (the real pack was the only cover
   of the second). The real-bundle credit check now runs on the SRD 5.2 bundle. The staleness
   test needed two systems with a baseline, so it would have failed at the next release, when
   `DATA_VERSIONS` keeps only SRD 5.2. It now lends a baseline to an invented system and takes
   it back after. Checked by running the suites with `DATA_VERSIONS` set to SRD 5.2 only.
   `docs.js`'s private-pack scan now catches the homebrew folder in a path, a helper call or a
   list. A bare `homebrew_full.json` or a `homebrew:` key is spared, because invented fixtures use
   the word as a label.
5. **The leak scan.** Homebrew stays in the free corpus, read from `$FIELDBOOK/data/homebrew`, and
   does not join the private one. Its text is CC BY-SA, so free is true. The private CI scans the
   public tag a release builds on: `v1.8.1` and every older ref still carry `data/homebrew/`, and
   with homebrew out of the free corpus its Predator sentence shared with Xanathar's (27 words)
   failed the scan there, so the next private data release, and `main` before this merge, would
   have gone red (review, Important 1; Mike chose this fix). `corpus()` skips a missing folder, so
   at refs after this merge the entry reads nothing. Proved green against public `main` as it was
   (806), a clone of `v1.8.1` with no dump, as CI runs it (747), and this branch.
6. Docs: CLAUDE.md, README (the zip holds one pack; credits), README-converter, rules-schema (the
   archive example uses an invented pack), the data-update issue template, the wiki pages below,
   and the private README. A comment in `89-rules-merge.js` that said the public zip always notes
   homebrew's spells now gives the general case.
7. **Push order.** The private repo goes right after public `main`, as CLAUDE.md says. Left
   unpushed, its nightly CI would run the old suite, which reads the public homebrew folder, now
   deleted. Pushed first, it passes against the old public `main` (point 5).

Pages: [homebrew](../wiki/data/homebrew.md), [private data](../wiki/data/private-data.md),
[overview](../wiki/overview.md), [rules packs](../wiki/architecture/rules-packs.md),
[data archive](../wiki/architecture/data-archive.md), [SRD 5.2](../wiki/data/srd.md),
[settings & updates](../wiki/features/settings-and-updates.md), [testing](../wiki/process/testing.md),
[theming & icons](../wiki/ui/theming-and-icons.md), [converter](../wiki/data/converter.md),
[known issues](../wiki/roadmap/known-issues.md), [2.0](../wiki/roadmap/2.0.md),
[decisions](../wiki/decisions.md), [RELEASING](../RELEASING.md).
