# Armour & attack numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flat AC behind a Calculated / Flat switch with only the best shield counting (#130); an
"Include spells" tick so the Spellcasting card, the cast window and a spell's attack row agree
(#129); editing a feature keeps a use count that scales (#132).

**Architecture:** One AC function (`acTotal()`) replaces the four places that add AC up themselves;
`contributions()` tags each entry with its kind and its `spells` flag, so Flat keeps statuses and
familiars and the spell sums keep the ticked effects. One list function (`spellFxList()`) feeds
every spell number, its marks and its breakdowns. One pure helper (`usesFromForm()`) decides what a
form's "Limited uses" box saves.

**Tech Stack:** plain JS fragments concatenated into one HTML file (ADR-001); Node suites under
`src/tests/` (`harness.js`, no framework).

**Spec:** [the design](../specs/2026-11-06-armour-attack-numbers-design.md). It depends on the
Vitals & HP branch's spec, `2026-11-06-vitals-hp-design.md`, which is on that branch until it
merges.

**Two phases.** Phase 1 (Tasks 0–7) is built now, from `main` at 9caff27. Phase 2 (Tasks P2-1 to
P2-3) is built after this branch is rebased on a `main` that has the Vitals & HP branch
(`vitalsLocked()`) and the Grants redraw branch (`openItemForm()`'s new-item `equipped`). Nothing in
phase 1 stubs or copies their code.

## Global Constraints

- No ES modules, no new fragment: edits go in the fragments named below (ADR-001).
- Old saves load: `acMode` is optional, defaulted in `blankChar()` (`"calc"`), normalised in
  `migrate()` (anything but `"flat"` → `"calc"`; `"flat"` with no number in `ac` → `"calc"`).
- **Calculated never reads `character.ac`.** An old save with one opens Calculated, and the old
  number is what Flat shows.
- Effects stay numeric-only. `spells: true` is optional on `{target, value}`, written only for the
  six generic targets: `attack`, `attack.melee`, `attack.ranged`, `damage`, `damage.melee`,
  `damage.ranged`. Absent or anything but `true` = unticked = weapons only.
- Pack data is unchanged; `data/srd52/` and the private packs reproduce byte for byte.
- Words: "Calculated", "Flat", "Your AC", "Include spells", "FLAT" under the rail's number.
- `--rail-flat` in all four palettes, each different from that palette's `--rail-line`; added away
  from `00-tokens.css` lines 3–5 and 72 (Web fonts edits those).
- `migrate()`'s change is one self-contained line, away from the `hp` normalisation (Vitals & HP
  edits that).
- New `sheet.js` checks go in one new block at the end of the file's synchronous section, right
  before the async `t118EndToEnd()` section: the literal last line is the async chain, whose first
  function swaps `ctx` globals before its first `await`, so a synchronous block after it would run
  inside that setup. Existing checks that encode old behaviour are rewritten in place.
- Commit with explicit `git add <paths>`; never `dist/fieldbook.html` or `docs/CHANGELOG.md`.

## Review Focus

1. **An old save with a typed `ac`** (`"14"` or `14`, no `acMode`): AC is the computed number; the
   window opens on Calculated; switching to Flat shows 14, not a seeded number. → Task 2, Task 3.
2. **A hand-edited or junk `ac`** (`null`, `"abc"`, `15.5`) with `acMode:"flat"`: loads Calculated,
   never "AC 0" or "Base AC 0". → Task 2.
3. **Typing junk in the Flat box** (`""`, `"abc"`, `"15.5"`, `"-3"`): refused, the last number
   stays. → Task 3.
4. **A ticked row whose target is then changed** to a non-spell target (the tick is hidden but still
   checked in the DOM): no `spells` written. → Task 5.
5. **A feature whose `byLevel` max is 0 at the current level** (its box opens blank): saving it
   unchanged keeps the `byLevel`, rather than dropping its uses. → Task 6.

---

## Phase 1

### Task 0: The spec's link to the Vitals spec (docs suite green)

The `docs` suite fails while `2026-11-06-vitals-hp-design.md` is on another branch.

**Files:** Modify `src/docs/specs/2026-11-06-armour-attack-numbers-design.md:12`

- [ ] Replace the link `([its spec](2026-11-06-vitals-hp-design.md))` with
  `(its spec, ` + backticked `2026-11-06-vitals-hp-design.md` + `, on that branch until it merges)`.
  Nothing else in the spec changes. Phase 2 (P2-3) restores the link.
- [ ] Run `./src/tests/run.sh docs` → `ALL PASSED`.
- [ ] Commit: `docs(#130): the spec names the Vitals spec until that branch merges`.

### Task 1: Contributions carry their kind and the `spells` flag

**Files:** Modify `src/js/00-constants.js` (`fxTargets()` area, `contributions()`) · Test
`src/tests/sheet.js` (new block, see Global Constraints)

**Interfaces — Produces:**
- `FX_SPELL_TARGETS` (array of the six targets), `fxSpellable(target) → boolean`
- every `contributions()` entry gains `kind` (`"feature"|"item"|"status"|"familiar"`) and
  `spells` (`true` only when the effect's `spells === true`)

- [ ] **Step 1: Failing tests** (`#129` prefix):
  - `fxSpellable` is true for each of the six and false for `ac`, `spell.attack`, `spell.dc`, `check`.
  - a character with one effect of each kind: `contributions().map(x=>x.kind)` is
    `["feature","item","status","familiar"]` (familiar `active:true`); an effect with `spells:true`
    gives `spells===true`, one without gives `false`, one with `spells:"yes"` gives `false`.
- [ ] **Step 2:** `./src/tests/run.sh sheet` → those FAIL.
- [ ] **Step 3:** implement; `fxTargets()` and `FX_LABEL` unchanged.
- [ ] **Step 4:** `./src/tests/run.sh sheet` → PASS.
- [ ] **Step 5:** commit `feat(#129): contributions carry their kind and the spells flag`.

### Task 2: One AC function; best shield; Calculated ignores `character.ac`

**Files:** Modify `src/js/25-origins-items.js` (`armorAC()` and new functions after it),
`src/js/10-compute.js` (`recompute()` AC lines), `src/js/87-initiative.js` (`youAC()`),
`src/js/00-constants.js` (`blankChar()`), `src/js/71-char-io.js` (`migrate()`) · Test
`src/tests/sheet.js` (new block), `src/tests/char-update.js` (≈529, 634, 648 rewritten in place;
add `'acTotal'` to its `loadApp` list)

**Interfaces — Consumes:** Task 1's `kind`. **Produces** (all in `25-origins-items.js`):
- `armorAC(c) → {base, hasArmor, shield, body, dex, bodyName, shieldName, shieldCount}`: `shield` is
  the **best** equipped shield's `num(bonus||2)`, not a sum; with no body armour, base is `10 + Dex`;
  `character.ac` is never read. `bodyName`/`shieldName` are the winning items' names (`""` if none).
- `acFlatValue(v) → number|null`: a whole number ≥ 0 from a number or a digits-only string
  (trimmed), else `null`.
- `acIsFlat(ch) → boolean`: `ch.acMode==="flat" && acFlatValue(ch.ac)!=null`.
- `acEffects(c) → contributions[]`: the `ac` entries that count — all of them, or in Flat only kinds
  `status` and `familiar`.
- `acTotal(c?) → number`: (Flat ? `acFlatValue(character.ac)` : `armorAC(c).base`) + sum of
  `acEffects(c)`. `c` optional, as for `effMaxHP()`.
- `acFlatSeed(c) → number`: `armorAC(c).base` + the `item` and `feature` `ac` effects (the
  Calculated total less what still adds in Flat).

- [ ] **Step 1: Failing tests** (`#130` prefix), DEX 14 (+2) unless said:
  - two equipped shields `{bonus:2}` and `{bonus:3}`, either order: `armorAC().shield===3`,
    unarmoured base `15`, `shieldCount===2`; one unequipped of the two → only the other counts.
  - `character.ac` `14`, `"14"` and `null`, `acMode` absent: `acTotal()===12` each time.
  - `acFlatValue`: `14→14`, `"14"→14`, `" 9 "→9`, `0→0`; `""`, `null`, `undefined`, `"abc"`,
    `"15.5"`, `15.5`, `"-3"`, `-3` → `null`.
  - Flat 16 with chain mail + shield equipped, a Ring of Protection item `ac+1`, a Defense feature
    `ac+1`, a Shield status `ac+5`, a familiar `ac+1` (active): `acTotal()===22`; the same in
    Calculated: `16+2+1+1+5+1=26`.
  - `acFlatSeed()` for that sheet is `20` (16 + 2 + 1 + 1).
  - painted `#acDisp` (the existing `painted()` helper) equals `acTotal()` and `youAC()`, in both
    modes; in Flat an item's `ac −1` does not mark it red, a status's `ac −2` does.
  - `blankChar().acMode==="calc"`; `migrate({acMode:"flat",ac:15}).acMode==="flat"`;
    `migrate({acMode:"flat",ac:""})`, `({acMode:"flat",ac:null})`, `({acMode:"flat"})` → `"calc"`;
    `migrate({acMode:"weird",ac:12}).acMode==="calc"` and `.ac===12`; a Flat sheet survives
    `migrate(JSON.parse(JSON.stringify(migrate(x))))` with `acMode` and `ac` intact.
  - the old armour block (`sheet.js` ≈ 637–651, "a shield stacks on top") stays true unchanged.
- [ ] **Step 2:** run `sheet` and `char-update` → new checks FAIL.
- [ ] **Step 3:** implement. `recompute()` paints `acTotal(c)`, marks with `acEffects(c)` (`.fx-on`
  when their sum is non-zero, `.fx-neg` when any is below zero). `youAC()` returns `acTotal()`.
  `blankChar()` gains `acMode:"calc"` on its own line after `ammoSpent:{}…` (away from the `hp`
  block). `migrate()` gains one line after the `featsAllowed` line:
  `base.acMode=(s.acMode==="flat"&&acFlatValue(s.ac)!=null)?"flat":"calc";` with a `#130` comment.
  `char-update.js`'s three expressions become `X.acTotal()`.
- [ ] **Step 4:** run `sheet`, `char-update` → PASS.
- [ ] **Step 5:** commit `feat(#130): one AC function; only the best shield counts; Calculated ignores the old manual value`.

### Task 3: The Armor Class window and the rail's FLAT shield

**Files:** Modify `src/js/80-modal-forms.js` (`openStatBreakdown()` and new functions beside it),
`src/js/10-compute.js` (rail shield class and label), `src/html/00-sheet.html` (the `.rail-ac`
line only), `src/css/00-tokens.css` (one new `--rail-flat` line after each palette's
`--rail-accent` line), `src/css/30-sheet.css` (after the `.rail-ac` rules) · Test
`src/tests/sheet.js` (new block)

**Interfaces — Consumes:** Task 2. **Produces** (in `80-modal-forms.js`):
- `acWindowHTML(c) → string`: the window body for the current mode.
- `openACWindow()`: `openModal("Armor Class", acWindowHTML(c))`, then wires `#acMode`'s
  `[data-acmode]` buttons (click → `setACMode()`, then `openACWindow()` again) and `#acFlat`
  (change → `setACFlat()`; refused → the box gets `character.ac` back; then `#acTotal` repainted).
- `setACMode(mode) → boolean`: `"flat"` or `"calc"`; switching to Flat with no valid number fills
  `character.ac` with `acFlatSeed()`; then `recompute()`, `scheduleSave()`.
- `setACFlat(v) → boolean`: refuses unless `acFlatValue(v)!=null`; stores the number, `recompute()`,
  `scheduleSave()`.
- `openStatBreakdown("ac")` returns `openACWindow()`; its old `ac` branch goes.

Markup (builder's calls, spec §10):
- the switch is the app's `.seg` pair, `id="acMode"`, buttons `data-acmode="calc"` / `"flat"` with
  `class="on"` and `aria-pressed` on the current one, labels "Calculated" / "Flat";
- Calculated: a `<p>` base line as today ("Armor 16 + DEX +0" or "10 + DEX +2"), a row for the
  shield named by its item ("Shield +2"), a hint "Only your best shield counts (N equipped)." when
  `shieldCount>1`, each `ac` effect as a row by source (red when negative, `.bd-neg`), then the total;
- Flat: `<label class="f" for="acFlat">Your AC</label><input id="acFlat" inputmode="numeric"
  pattern="[0-9]*" autocomplete="off" value="…">`; a struck line `<s>names</s> don't add: your AC
  already counts them.` where names are the worn body armour, the best shield and each item or
  feature `ac` effect's source (de-duplicated, in that order), or "Armour, shields, items and
  features" when there are none; each status or familiar `ac` effect as a row; then the total;
- the total, both modes: `<b>Armor Class</b><b id="acTotal">N</b>` on the breakdowns' total line.
- rail: `.rail-ac` gets `id="acShield"`, its label `id="acLbl"`; `recompute()` toggles `flat` on
  `#acShield` and writes "FLAT" or "AC" into `#acLbl`, both lookups guarded.
- CSS: `.rail-ac.flat{background:var(--rail-flat)}`. Tokens: default light `#d8a544` (line
  `#a99467`), default dark `#efe6d0` (line `#d8a544`), classic light and dark `#dcae4e` (line
  `#bfae86`).

- [ ] **Step 1: Failing tests** (`#130`), through `shownModal()`:
  - `openStatBreakdown('ac')` → title `"Armor Class"`; Calculated body has `data-acmode="calc"` with
    `class="on"`, "Armor 16 + DEX +0", a "Shield" row `+2`, the Ring's row, and `id="acTotal">N<`
    where N equals painted `#acDisp` and `youAC()`.
  - two shields: the hint "Only your best shield counts (2 equipped)." and the total uses the best.
  - Flat 16: body has `id="acFlat"` with `value="16"`, a `<s>` line naming the chain mail, the shield
    and the Ring, the Shield status's row, no Ring row outside the `<s>`, and `acTotal` = 16 + status.
  - `setACMode('flat')` on a blank `ac` with armour 16 + shield 2 + Ring 1 + status 5: `ac===19`,
    `acMode==="flat"`, `acTotal()` still 24 (it didn't jump); `setACMode('calc')` keeps `ac===19`.
  - **Constraint 3:** `migrate({ac:"14", abilities:{dex:14}})` → `acMode==="calc"`, `acTotal()===12`;
    `setACMode('flat')` → `ac` still `"14"`-valued (14) and `acTotal()===14`.
  - `setACFlat` refuses `""`, `"abc"`, `"15.5"`, `"-3"` (returns `false`, `ac` unchanged) and takes
    `"17"` (`ac===17`, painted `#acDisp` `"17"`).
  - the template: `.rail-ac` carries `id="acShield"` and `<div class="n" id="acLbl">AC</div>`;
    `00-tokens.css` defines `--rail-flat` four times, each different from its block's `--rail-line`;
    `30-sheet.css` has `.rail-ac.flat{background:var(--rail-flat)}`.
- [ ] **Step 2:** run `sheet` → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run `sheet`, `rules-data` (the id guard reads `#acShield`, `#acLbl`, `#acMode`,
  `#acFlat`, `#acTotal`) → PASS.
- [ ] **Step 5:** commit `feat(#130): the Armor Class window's Calculated / Flat switch, and FLAT on the rail`.

### Task 4: One set of spell effects for every spell number

**Files:** Modify `src/js/60-attacks.js` (`attackNumbers()`, `spellAtkBonus()`, new functions after
it, `promptSpellAttack()`, `renderAttacks()`, `openAttackBreakdown()`), `src/js/10-compute.js`
(`#satkDisp` mark), `src/js/71-char-io.js` (`printSheet()`'s attack row), `src/js/80-modal-forms.js`
(`openStatBreakdown("spell.attack")`'s list) · Test `src/tests/sheet.js` (new block)

**Interfaces — Consumes:** Task 1. **Produces** (in `60-attacks.js`):
- `spellFxList(c, part, kind?) → contributions[]`, `part` `"attack"|"damage"`: for `attack`,
  `spell.attack` plus ticked `attack` (plus ticked `attack.<kind>` when `kind` is given); for
  `damage`, ticked `damage` (plus ticked `damage.<kind>` when given).
- `spellAtkFx(c, kind?)`, `spellDmgFx(c, kind?) → number`: the sums of those lists.
- `spellAtkBonus(c?, kind?) → number|null`: PB + spellcasting modifier + `spellAtkFx(c, kind)`.
- `attackNumbers(a)` additionally returns `atkList`, `dmgList`: the contributions it counted.
  Weapon rows: every generic effect, ticked or not (unchanged). Spell rows (`source==="spell"`):
  `spellFxList(c,"attack",kind)` and `spellFxList(c,"damage", save ? null : kind)`; the row keeps
  its own ability part (#74). `atkFx`/`dmgFx`/`atkNeg`/`dmgNeg` come from those lists.

Callers: the card calls `spellAtkBonus(c)` (no kind) and marks from `spellFxList(c,"attack")`;
`promptSpellAttack()` uses `spellAtkBonus(c,kind)` and `attackDamageStr(…, spellDmgFx(c, attack ?
kind : null))` with `kind` from `sp.atkKind` (melee, else ranged); `renderAttacks()` and
`printSheet()` pass `save ? n.dmgFx : n.dmgBonus` and the save row's damage mark lights from
`n.dmgFx`/`n.dmgNeg`; `openAttackBreakdown()` lists `n.atkList`/`n.dmgList`; the `spell.attack`
breakdown lists `spellFxList(c,"attack")`.

- [ ] **Step 1: Failing tests** (`#129`), INT 16 (+3), level 1 (PB 2), `spellAbility:"int"`, a
  Longsword row (STR 10), a Fire Bolt attack row (ranged, `ability:"int"`, source spell), a
  Shocking Grasp row (melee spell attack), a Sacred Flame save row with 1d8 radiant:
  - an item `attack +1` unticked: the Longsword +1; Fire Bolt row, `spellAtkBonus()`, painted
    `#satkDisp` and the cast window (`promptSpellAttack`, "Spell attack:</b> +5") all unchanged at +5.
  - ticked: all three +6 and the row marked (`atkFx===1`).
  - ticked `attack.melee +1`: Shocking Grasp's row and its cast window +6; the card stays +5; Fire
    Bolt +5.
  - ticked `damage +2`: Sacred Flame's row damage string `"1d8 +2 radiant"` and marked; its cast
    window "Damage:</b> 1d8 +2 radiant"; Fire Bolt's row `"1d10 +2 fire"`; unticked → `"1d8
    radiant"`, unmarked.
  - ticked `damage.ranged +1`: Fire Bolt `+1`, Sacred Flame `+0` (a save spell has no kind).
  - **shipped Archery** (read from `data/srd52/feats.json`, added as a feature): a Longbow row
    (DEX 14) goes +2→+4; Fire Bolt stays +5 and unmarked.
  - #74 still holds: a Fire Bolt row with `ability:"int"` and no `spellAbility` shows INT's modifier.
  - the attack row's breakdown names a ticked effect and leaves out an unticked one; the
    `spell.attack` breakdown names a ticked `attack` effect.
- [ ] **Step 2:** run `sheet` → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run `sheet`, `char-update` → PASS (the #77 and #89 blocks unchanged).
- [ ] **Step 5:** commit `feat(#129): a spell's numbers take spell.attack and ticked effects, the same everywhere`.

### Task 5: The "Include spells" tick

**Files:** Modify `src/js/80-modal-forms.js` (`fxRow()`, `collectFx()`, new `fxRowSync()`, one
delegated `change` listener on `modal` beside its other listeners), `src/css/50-modal.css` (after
`.fxrow select,.fxrow input`) · Test `src/tests/sheet.js` (new block), `src/tests/rules-data.js`
(the delegated listener, as a source guard)

**Interfaces — Consumes:** Task 1's `fxSpellable()`. **Produces:**
- `fxRow(e)`: adds `<label class="fx-sp" title="…">` + `<input type="checkbox" class="fx-s">` +
  ` Include spells</label>`, `hidden` unless `fxSpellable(target)`, checked when `e.spells===true`
  and the target is one of the six.
- `fxRowSync(row)`: sets `.fx-sp`'s `hidden` from `.fx-t`'s value.
- `collectFx(scope)`: writes `spells:true` only when the tick is checked **and** the target is one
  of the six.
- CSS: `.fxrow .fx-sp{grid-column:1/-1;…}` and `.fxrow .fx-sp[hidden]{display:none}`.

- [ ] **Step 1: Failing tests:**
  - `fxRow({target:'attack',value:1,spells:true})` has `class="fx-s" checked`, no `hidden`;
    `fxRow({target:'ac',value:1})` and `fxRow(null)` have the label `hidden` and unchecked;
    `fxRow({target:'ac',value:1,spells:true})` is unchecked.
  - `collectFx` on fake rows: `attack` ticked → `{target:'attack',value:1,spells:true}`;
    `attack` unticked → no `spells` key; `ac` with a checked (hidden) tick → no `spells`
    (Review Focus 4); a zero value still dropped.
  - `fxRowSync` on a fake row: `damage.melee` → `hidden===false`; `spell.dc` → `true`.
  - copy paths keep the flag: `addFeatureFromDef()` (the feat grant and the choices path),
    `updProject(def,'feature','plain')`, `updProject(def,'item','browse')`, `addLibraryItems()`,
    `grantItemByName()`, `invSnap()` (the trade window), and a `migrate()` round trip.
  - `rules-data.js`: `80-modal-forms.js` has one `modal.addEventListener("change"` that calls
    `fxRowSync(`, and no editor wires its own.
- [ ] **Step 2:** run `sheet`, `rules-data` → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** `./build.sh --no-zip`, then `sheet`, `rules-data` → PASS.
- [ ] **Step 5:** commit `feat(#129): an Include spells tick on to-hit and damage effects`.

### Task 6: Editing a feature keeps a scaling use count (#132, feature form)

**Files:** Modify `src/js/20-lists.js` (after `usesMax()`), `src/js/80-modal-forms.js`
(`openFeatureForm()`) · Test `src/tests/sheet.js` (new block)

**Interfaces — Produces** (in `20-lists.js`, so the item form reuses them in P2-2):
- `usesFromForm(prev, shown, typed, per) → {max, per, used}|null`: `um = max(0, num(typed))`. When
  `prev` has a non-number `max` and `um === shown`, keep `prev.max`; otherwise `um > 0` gives
  `{max: um}`; otherwise `null`. `used` is `min(num(prev.used), um)`.
- `usesScaleHint(f) → string`: `""` for a number max; `byLevel` or `{formula:"level"}`: "Grows with
  your level: N now. Typing a different number stops it growing."; an ability formula: "From your
  WIS modifier: N now. Typing a different number stops it changing." (with "+ 1" / "− 1" after
  the ability when the formula has one); N is `usesMax(f)`.
- `openFeatureForm()`: keeps the box's opening number (`num(f.uses&&usesMax(f))`), shows the hint as
  `<p class="hint" id="fUsesHint">` under the uses row when non-empty, and saves through
  `usesFromForm()`.

- [ ] **Step 1: Failing tests** (`#132`):
  - `usesMax`: `{max:3}`→3; `{max:{byLevel:[1,1,2,2,3]}}` at levels 1, 3, 5 and 9 → 1, 2, 3, 3;
    `{formula:"level"}` at level 4 → 4; `{formula:"wis"}` WIS 16 → 3; `"wis+1"` → 4; `{formula:"cha-1"}`
    CHA 12 → 1 (the floor); `{formula:"wis"}` WIS 8 → 1 (the floor).
  - `usesFromForm`: byLevel prev, shown 2, typed `"2"` → same `byLevel` object; typed `"4"` →
    `{max:4}`; formula prev the same; `used` 3 with typed `"2"` → `used 2`; number prev 3, typed
    `"3"` → `{max:3}`; typed `""` with number prev → `null`; byLevel `[0,0,2]` at level 1, shown 0,
    typed `""` → the `byLevel` kept (Review Focus 5).
  - `usesScaleHint` for each shape above, and `""` for a number.
  - driven: `openFeatureForm()` on a byLevel feature with fake `getElementById` elements (`fUses`
    holding its opening value, `fSave`'s click captured); saving unchanged leaves
    `character.features[0].uses.max` the same `byLevel`; changing `fUses` to `"5"` saves `{max:5}`.
    The body shown contains `id="fUsesHint"` and "Grows with your level".
  - `rules-data.js`'s `featSave` slice (`{0,2000}`) still reaches `character.features[i]=rec`.
- [ ] **Step 2:** run `sheet` → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run `sheet`, `rules-data` → PASS.
- [ ] **Step 5:** commit `fix(#132): editing a feature keeps a use count that scales`.

### Task 7: Docs, notes, the full run, the build

**Files:** `docs/rules-schema.md` (the item `effects` paragraph), `src/docs/wiki/features/armor-and-ac.md`,
`attacks-and-damage.md`, `spells.md`, `features-and-traits.md`, `vitals-and-rest.md` (the AC badge
opens the AC window; not the lock), `combat-view.md` (the shield's FLAT mark travels with it),
`src/docs/wiki/architecture/computed-stats-and-effects.md`, `character-model.md`,
`src/docs/wiki/roadmap/known-issues.md`, `src/docs/wiki/decisions.md`,
`src/docs/_claude/WIRING-LEDGER.md` (append at the end), `src/docs/UNRELEASED.md`

- [ ] `rules-schema.md`: an `attack` or `damage` effect counts for weapons only, unless it carries
  `"spells": true`, which makes it count for spells too (the card, the cast window, the spell's
  row); `spells` is read only on the six generic targets.
- [ ] Ledger entry at the end; note its heading line for History.
- [ ] Each page rewritten to the new truth (present tense), Decisions rows for spec decisions 1–14
  where they belong, a History line each citing the entry; `decisions.md` one line per new row;
  known-issues: the #129, #130 and #132 entries go, and `usesMax()` leaves the "tests the ledger
  says exist but don't" line; Open notes what phase 2 still does (the lock; the item form).
- [ ] `UNRELEASED.md`: the spec's four bullets under `## Pending`, the Fire Bolt / Archery note in the third.
- [ ] `./build.sh --no-zip`, then `./src/tests/run.sh` → every suite passes (srd-verbatim may skip).
- [ ] Commit `docs(#130, #129, #132): the wiki, ledger, rules-schema and release notes`.

---

## Phase 2 — after rebasing on `main` with Vitals & HP and Grants redraw merged

Build only once both branches are on `main` and this branch is rebased on it. Re-run the full suite
first; re-point any wiki `L<n>` citation the rebase moved.

### Task P2-1: The AC window follows the Vitals lock

**Files:** `src/js/80-modal-forms.js` (`acWindowHTML()`, `setACMode()`, `setACFlat()`), the Vitals
pencil's aria-label (where the Vitals branch put it), `src/docs/wiki/features/vitals-and-rest.md`,
the Vitals spec's decision 2 note and the proposed smoke-list line (spec §8) · Test `sheet.js`
(the same new block)

**Interfaces — Consumes:** `vitalsLocked(c)` from the Vitals & HP branch.

- [ ] Failing tests: while `vitalsLocked(character)`, `setACMode('flat')` and `setACFlat('17')`
  return `false` and change nothing; the window shows "Vitals is locked — unlock it to change your
  AC" and both `data-acmode` buttons and `#acFlat` carry `disabled`; unlocked, both work.
- [ ] Implement; the pencil's aria-label reads "…locks Max HP and a flat AC" in the Vitals branch's
  wording; the wiki says AC follows the lock; the smoke-list line proposed in the Vitals spec gains AC.
- [ ] Run `./src/tests/run.sh`; commit `feat(#130): the AC window follows the Vitals lock`.

### Task P2-2: The item form keeps a scaling use count (#132, item half)

**Files:** `src/js/80-modal-forms.js` (`openItemForm()`) · Test `sheet.js`

**Interfaces — Consumes:** Task 6's `usesFromForm()`, `usesScaleHint()`; `itemUsesMax()`.

- [ ] Failing tests: saving an item with a `byLevel` or formula `uses.max` unchanged keeps it;
  changing the number saves a number; the hint shows under `#iUses` (`id="iUsesHint"`).
- [ ] Implement: the form keeps `itemUsesMax(it)` as the box's opening number; the save at
  "Limited uses and what Use does" goes through `usesFromForm(it.uses, shown, …,
  document.getElementById("iUsesPer").value)`.
- [ ] Run `./src/tests/run.sh`; commit `fix(#132): editing an item keeps a use count that scales`.

### Task P2-3: Phase 2's docs

- [ ] Restore the spec's link to `2026-11-06-vitals-hp-design.md` (Task 0, reversed).
- [ ] A ledger entry; History lines on armor-and-ac, vitals-and-rest, features-and-traits and
  inventory; the `UNRELEASED.md` #132 bullet says "a feature or an item".
- [ ] `./build.sh --no-zip`, `./src/tests/run.sh` green; commit.
