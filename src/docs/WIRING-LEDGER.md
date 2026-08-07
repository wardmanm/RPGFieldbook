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
