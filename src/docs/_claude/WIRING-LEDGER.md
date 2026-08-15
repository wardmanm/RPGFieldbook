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
built from it. Placeholder is `` — private-use, so it cannot occur in rules text, `esc()`
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
  changing behaviour, and the build is byte-exact. (`` was already taken by `TBL_MARK`.)
  `noteHTML` also strips `-` from its input, so a player typing one can't forge a
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
