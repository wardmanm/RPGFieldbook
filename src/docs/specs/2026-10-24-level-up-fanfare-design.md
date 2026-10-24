# Level-up fanfare: design

**Status:** approved in conversation 2026-10-24, awaiting Mike's review of this written spec. Wave 2 of
[1.9.0](../wiki/roadmap/1.9.0.md).
**Issue:** #101 (More fanfare on level up). One branch, `issue/101-level-up-fanfare`.
**Mockups:** `.superpowers/brainstorm/96071-1792852951/content/`. The chosen animation is panel F
of `levelup-anim-v5.html`; the chosen card layout is panel A of `levelup-card.html`.
**Read first:** [Character building](../wiki/features/character-building.md) (level-up, the choice
modal, the HP step), [Vitals & rest](../wiki/features/vitals-and-rest.md) (the hit-dice spend box
this HP step copies), [Spells](../wiki/features/spells.md) (slots),
[Class resources](../wiki/features/class-resources.md) and
[Theming & icons](../wiki/ui/theming-and-icons.md).

---

## 1. What it is

Levelling up becomes a moment. The page dims, a circle of runes draws itself behind your level
ring, the ring glows and ticks up, there is a flash, and a banner reading **LEVEL N** unfurls with
gold sparks. A card then rises showing everything the level gave you, with the hit-point roll on the
card itself. A level with nothing to choose ends there. A level with a choice continues into the
choice window the app already has.

The issue asked for "some sort of fun animation on level up" and "a modal of all things they gain
at the new level along with the HP roll dialog". While designing it with Mike, two multiclassing
rules turned out wrong in the app, and he asked for both to be fixed here (§7).

## 2. Decisions

Settled with Mike: 2026-10-16 on the 1.9.0 page (row #101), and 2026-10-24 in this brainstorm, with
mockups.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Which moments get the fanfare | **Level up** (the class menu's ▲, and "Level up ready") **and adding a second class**, which is a level gained | Subclass choice too: it is a choice inside a level, not a level. Excluding multiclassing: it is a level up |
| 2 | Not celebrated | Character creation (the first class, at any starting level), level down, and choosing or changing a subclass from the info window | n/a |
| 3 | The animation | **F: sigil, ring and banner.** A rune circle with a seven-point star draws itself and turns; motes of light rise; your level ring glows and ticks old → new; a flash; the LEVEL N banner unfurls with gold sparks; the card rises. About 2.4s | A (ring burst) and B (banner): Mike liked both and asked for more magic. C (quiet glow): too little. E (sigil alone): F keeps the ring and banner he liked |
| 4 | Where the HP step lives | **On the level card (A).** Done or Continue waits for HP to be set; the choice window follows only when the level has something to choose | B, HP in the choice window: two screens every level, even when nothing is chosen |
| 5 | How HP is entered | **Like the hit-die spend box (#103):** 🎲 Roll for me, or "I rolled" plus Apply; CON is added for you and the working is shown | The old blank-means-average box: not what the spend box taught |
| 6 | Take the average | **Kept, as a small link** beside Roll and Apply. It is the rules' fixed value, and the app offers it today | Removing it: the rules allow it, and players use it |
| 7 | An "animate level-ups" setting | **None.** Reduced motion skips the animation, and a tap, click or Esc skips it at any time | A Settings switch: more surface for a 2.4s moment that can always be skipped |
| 8 | What the card lists | **What actually changed on the sheet**, found by comparing it before and after the level is applied (§4) | Reading each class's table: misses homebrew and resources, and can claim things the sheet didn't get |
| 9 | Half-caster spell slots | **Round up, for every ruleset, Humblewood included** (Mike: "follow the 2024 rules even though Humblewood was built for the old ones") | Per ruleset: Humblewood would keep the 2014 rounding |
| 10 | The 13+ multiclass prerequisite | **A one-line note in the add-class window**; nothing is blocked | A check: the packs don't carry each class's primary ability, so it would mean a converter change and new pack digests |
| 11 | Features that don't stack | **The card tags a new feature that has the same name as one you already have from another class**: "you already have this from Fighter; they don't stack" | Silence: Extra Attack from two classes looks like four attacks |

## 3. The flow

1. `doLevelUp(idx)` and `addClass()` (for a second class) take a `levelSnapshot()` **before** they
   change anything.
2. They apply the level exactly as now: `applyClassLevel()`, the Max HP unlock, `recompute()`,
   renders and save.
3. Instead of `runChoices()`, they call `openLevelUp(info)`. `info` holds:
   - the class;
   - the old and new class level, and the new character level;
   - the before snapshot;
   - the HP choice (`hpChoice()`, still built before the unlock so it remembers the lock);
   - the remaining choices and notes;
   - anything pending behind them (a second class's starting equipment).
4. `openLevelUp` plays the animation (§6), then shows the card (§4, §5).
5. **Done** applies the HP and closes; this is the button when no choices remain. **Continue to your
   choice ▸** applies the HP, closes the card and calls
   `runChoices(className, choices, notes, pending)`, so the choice window opens as it does today,
   minus the HP block. Notes alone count as nothing to choose: they are already on the card.
6. Both buttons stay disabled until HP is set: rolled, applied, or averaged.
7. **Closing early** (Esc, ×, or the backdrop where that setting is on) asks first, in the same words
   as today's HP dismissal: "Close without adding this level's hit points? Max HP is unlocked, so
   you can type the new total yourself." If the player confirms, HP is not applied, Max stays
   unlocked, and any choices still open as today. A choice the player has not been shown must not
   vanish because the card was closed.

**Creation is unchanged.** A first class added above level 1 keeps its `{type:"hp"}` block (levels
2..N) inside the choice window, because creation has no fanfare. So `choiceFieldHTML`'s `hp` type
stays; level-ups and second classes simply stop sending one.

## 4. The card: what it lists

`levelSnapshot()` records:
- the ids of the character's features;
- spell-slot totals for levels 1–9, pact slots included;
- each resource's maximum and die, keyed by name;
- the proficiency bonus.

`levelGains(before, after, choices, notes)` is pure and has no DOM. It returns rows in this order:

1. **New features**: name, plus the first sentence of the description, plain text with tags
   stripped. Subclass features are tagged with the subclass name. A new feature whose name matches
   one the character already had from a *different* class gets the no-stacking tag (decision 11).
2. **Choices still to make**: each choice's label and a short description, tagged *choose next*.
   This includes a `subclass` choice.
3. **Resources**:
   - new: "Superiority Dice ×4 · d8", tagged *new*;
   - more uses: "Channel Divinity 2 → 3";
   - a bigger die: "Superiority Dice d8 → d10".
4. **Spell slots**, per spell level: "1st 3 → 4", "3rd ×2", tagged *new*.
5. **Proficiency bonus**, only when it rises: "+2 → +3".
6. **Notes** the pack gives at that level, such as "You can now know up to 6 Wizard spells".

**Header:** "You reached · Cleric 4 → 5 · character level 5". For a second class: "Wizard 0 → 3 ·
character level 9". **Banner:** LEVEL *new character level*.

**Nothing listed:** the line "Nothing new from the rules at this level." with the HP step below. This
covers a homebrew class with no levels table, or a quiet level.

The card scrolls inside the modal on a phone; the HP step and the buttons stay at its foot.

## 5. The HP step

It copies the spend box's controls, wording and order:

```
Hit points · d10 + CON 2            (n dice when a second class arrives at level n: "3d6 + 3×CON 1")
[🎲 Roll for me]  or  I rolled [  ] [Apply]   Take the average (6)
7 + 2 CON = 9 HP · Max HP 30 → 39
```

- **Roll for me** rolls n dice through `rollDiceExpr` and shows the faces: "Rolled 4, 6 — 10 + 2×2
  CON = 14 HP …".
- **I rolled + Apply** takes the dice total.
  - It must be a whole number from n to n × die.
  - Anything else shows the spend box's out-of-range message, and nothing is set.
- **Take the average** uses `hpFixed()`.
- The result line is `hpGainText()`. The gain is `hpGain()`, so the floor of 1 HP per level and the
  CON rules don't change.
- The value is committed with `commitHPChoice()` when Done or Continue is pressed, not on Apply, so
  the player can roll again before leaving. Lock behaviour is unchanged.
- **A class with no hit die** in the loaded rules (a custom class) shows one box: "HP gained [ ]"
  with Apply. No CON is added, matching today's no-die path. Any whole number ≥ 0 is accepted.

## 6. The animation

- **Markup.** A full-screen layer, `#luFx`, sits above the page and below the modal's backdrop. It
  holds:
  - an inline SVG sigil: two circles, a seven-point star, and a ring of runes drawn as SVG paths, not
    a font, so every device shows them;
  - a copy of the level ring showing the old level;
  - the flash;
  - the banner;
  - the sparks and motes. These are a fixed set of elements with preset delays and positions, so
    there is no per-run randomness to test around.
- **Timing.** CSS keyframes only. The sigil draws for 0–0.9s; motes run for 0–2s; the ring ticks
  old → new at about 0.85s and glows; the flash is at 1.1s; the banner and sparks at 1.5s; the card
  rises at 1.9s. The whole run is about 2.4s. One `animationend` (or a 2.6s timer as a backstop)
  removes the layer.
- **Skip.** A click, a tap, or Esc during the animation removes the layer and shows the card at
  once. Keyboard focus goes to the card's first control.
- **Reduced motion.** When `prefers-reduced-motion: reduce` matches, the layer is never built and
  the card simply opens.
- **Colours.** New tokens in `00-tokens.css`, defined for both skins and both themes:
  - `--lu-night` (the dimmed backdrop): classic is the violet night of the mockup; Humblewood is a
    forest night (deep green);
  - `--lu-glow` (sigil, motes): classic is pale arcane blue; Humblewood is a warm gold-green;
  - `--lu-spark` (gold).

  The banner uses the skin's accent and paper. Light and dark share the night backdrop. It is a
  scene, not a surface.
- **Print** never shows the layer.
- **Single file:** no library, nothing fetched, no ES module.

## 7. Multiclassing fixes

Checked against SRD 5.2.1, "Multiclassing", pp. 25–26.

- **Spell slots (a bug).** "Half your levels (round up) in the Paladin and Ranger classes."
  `casterLevel()` in `00-constants.js` rounds down. It changes to `Math.ceil(L/2)` for `half`
  casters, for every ruleset (decision 9). Third-casters (Eldritch Knight, Arcane Trickster) keep
  `Math.floor(L/3)`.

  Single-class half-casters come out right as well: a Paladin 1 now gets two 1st-level slots, as its
  2024 table says. This changes slots on existing Paladin and Ranger sheets the next time they
  recompute. That is the intended fix, and the player note says so.
- **Prerequisite note.** `multiclassNote()` gains one sentence: "Multiclassing needs a score of 13
  or more in the primary ability of your current class and the new one." It is informational and
  blocks nothing. That note already shows in two places: the class picker's preview once the
  character has a class (`56-class.js` around line 16), and the second class's notes. The notes now
  appear on the level card (§4, row 6), so the sentence shows there too.
- **No stacking.** As decision 11, in `levelGains()`.
- **Already correct, and to stay so** (tests pin them):
  - level-1 HP only at total level 1;
  - hit dice pooled by die type;
  - proficiency bonus and XP from total level;
  - multiclass proficiencies only.

## 8. Files

- **New `src/js/57-levelup.js`**, between `56-class.js` and `58-choices.js` in `src/manifest.json`:
  `levelSnapshot`, `levelGains`, `levelUpCardHTML`, `levelUpHPHTML`, `openLevelUp`, and the
  animation's build, skip and remove. It is a new fragment, so the fragment counts in CLAUDE.md and
  ADR-001 go from 34 to 35 JS fragments, and the docs suite checks them.
- **`56-class.js`:** `doLevelUp()` and `addClass()` take the snapshot and call `openLevelUp` (the
  creation path is unchanged); `multiclassNote()` gains the prerequisite sentence.
- **`00-constants.js`:** `casterLevel()`.
- **`58-choices.js`:** unchanged in behaviour; `hpPending`'s wording is reused by the card's close
  guard. A shared helper is fine.
- **`50-modal.css`:** the card. **`00-tokens.css`:** the `--lu-*` tokens. The animation's keyframes
  go in `50-modal.css` or a small new section beside it, with media queries after their base rules
  and a print rule.

## 9. Edge cases

- **Level 20:** `doLevelUp` stops first, as now, so no fanfare.
- **"Level up ready" on a sheet with several classes:** the which-class window first, then the
  fanfare for the class picked.
- **A level whose only gain is a subclass choice:** the card lists it under *choose next*, and
  Continue opens the window with the subclass radios. `selectSubclass()` then opens its own window
  as today.
- **Two quick level-ups:** the second can't start while the card is open, because it is a modal.
  After Done it can.
- **The combat view open:** the fanfare plays over it like any modal.
- **A rules pack missing for the class** (a custom class): the card shows the "nothing new" line and
  the no-die HP box.
- **The sheet saves** before the fanfare, as now, so closing the tab mid-animation loses only the
  HP step. Max stays unlocked, as when today's window is dismissed.

## 10. Testing

**Pure (`rules-data.js` or `sheet.js`), driving `levelGains`:**
- features, with the subclass tag and the first-sentence summary (tags stripped, escaped);
- choices;
- resources: new, a max change and a die change;
- slots, new and changed, pact included;
- proficiency bonus, only when it rises;
- notes;
- the "nothing new" case;
- a second class at level 3 (n dice);
- the no-stacking tag.

**Slots:**
- Paladin 1 (2 first-level slots);
- Ranger 3 (= full caster 2);
- Wizard 3 / Paladin 3 (= 5);
- Ranger 1 / Paladin 1 (= 2);
- Eldritch Knight 3 unchanged;
- Warlock pact unchanged.

**HP step:**
- Roll for me: n dice, the result line;
- typed in range;
- typed out of range (rejected, nothing set);
- average;
- no die;
- the 1-per-level floor;
- the lock restored as before.

**Flow (sheet.js, real `doLevelUp` / `addClass`):**
- with no choices, the card ends with Done and no choice window;
- with a choice, Continue opens `runChoices` without an `hp` block;
- Done and Continue are disabled until HP is set;
- closing early asks first, applies no HP, leaves Max unlocked, and still opens pending choices;
- creation (the first class above level 1) still uses the choice window's HP block and gets no
  fanfare;
- level down: no fanfare.

**Animation:**
- reduced motion means no `#luFx` is built;
- a skip removes it and focuses the card;
- the layer's z-index sits under the modal;
- print hides it.

**Browser QA (project Playwright MCP):**
- a level-up with no choice, and one with a choice;
- adding a second class at level 2;
- Paladin 1's slots;
- both skins, light and dark, at 1280 and 390;
- a mid-animation frame and the card;
- the console clean.

## 11. Docs

- **Wiki:** character-building (level-up, the card, HP); spells (half-caster rounding); vitals-and-rest
  (the shared HP controls); theming-and-icons (the `--lu-*` tokens); the overview code map (the new
  fragment); known-issues if anything is deferred. Each change gets a History line citing the
  ledger entry `## Level-up fanfare (#101, <date>)`.
- **Fragment counts** in CLAUDE.md and ADR-001.
- **`UNRELEASED.md`**, two bullets:
  - "Levelling up is a moment now: a short animation, then a card with everything the level gives
    you and your hit-point roll."
  - "Paladin and Ranger spell slots follow the 2024 rule (half your levels, rounded up), so a level 1
    Paladin has its two slots."

## 12. Out of scope

- Fanfare for subclass choice, feats or ASIs on their own.
- A sound.
- A history of past level-ups.
- Blocking a multiclass that misses the 13+ prerequisite. That needs primary abilities in the packs,
  which is converter work for 2.0's pack-driven rules (#103 decision 18).
- Multiclass AC rules: one AC calculation at a time is already how `armorAC()` works.

## 13. As built

Built as designed, §1–§11, with these notes:

1. **§6's "`animationend` or a 2.6s backstop timer" became one 2.4s timer, full stop.** The
   keyframes all finish by 2.4s (the longest, the sigil, is 2.1s plus its 1.9s-delayed ring finale,
   and the banner's own unfurl ends at 2.1s), so a single `setTimeout(luSkip, LU_FX_MS)` both ends
   the scene and is what a test can wait on; `animationend` on a multi-element layer would have to
   pick which element's event to trust. Cost if wrong: the card could open a frame early on a very
   slow device, never late.
2. **§3.5's Continue passes `[]` for `notes`, not the level's notes**, so `runChoices(className,
   choices, [], pending)` rather than `runChoices(className, choices, notes, pending)` as literally
   written. This matches the same section's own rule two sentences later — "notes alone count as
   nothing to choose: they are already on the card" — passing the real notes through would reopen a
   window just to repeat text the card already showed, with no pick to make there. The spec's two
   sentences disagreed in their literal reading; the second one governed.
3. **The multiclass 13+ sentence (§7) is appended to `multiclassNote()`'s return, not inserted as
   its own row.** It reads in the note the player already sees in the add-class preview and on the
   level card (§4 row 6), rather than as a seventh `levelGains()` row kind of its own.
4. **Two cosmetic fixes, found in Task 3's own screenshot QA and made here, CSS only
   (`50-modal.css`):** at phone width the card's class line ("Fighter 1 → 2 · character level 2")
   could wrap onto a line holding only the trailing number; and `--head`/`--display`'s Cinzel face
   (the classic skin) draws "1" with no serif, reading as a capital "I" in both the class line and
   the LEVEL N banner. `font-variant-numeric:lining-nums` was tried first and changed nothing —
   Cinzel defines no alternate numeral set for the property to pick between — so `.lu-cls` and
   `.lu-bn` move to `var(--body)` (EB Garamond) instead, whose figures read unambiguously and which,
   as a side effect, fits every realistic class line on one line down to 320px wide.
5. **Reduced motion was not driven through true OS-level emulation.** The project's Playwright MCP
   server (`@playwright/mcp@0.0.79`) has no `browser_emulate_media` tool, so the branch was driven
   by monkey-patching `window.matchMedia` in the live page and re-running `doLevelUp()`, exercising
   the real `luReducedMotion()` code path rather than the unit harness's own mock. This is not the
   same as a real OS or browser reduced-motion setting; see "What Mike checks," below.
6. **Known minor items, left for the controller, not fixed in this branch:**
   - a resource whose max and die both change in the same level emits two rows, "uses" then "die",
     as spec §4 intends (separate lines) — this case has no test (`levelGains()`);
   - a bad "I rolled" + Apply after a good one shows the error line but Done/Continue still commits
     the earlier, now-unseen value (`57-levelup.js`, `luSetHP`/`luFinish`) — **fixed in note 7**;
   - stale comments at `char-update.js:977` and `58-choices.js:241`, left over from before this
     branch's rewiring of the lines near them — **fixed in note 7**;
   - the card's own DOM wiring (`showLevelUpCard`'s listeners) has no unit coverage, only the
     browser QA drive recorded in the ledger;
   - the #63 regression test (no two choice windows open at once) passes whether or not
     `runExtraChoices` is actually called, so it would not catch that specific call being dropped;
   - `LU_ICON` is a plain-object lookup keyed by `kind`, so an internal kind named `constructor`
     would print a function instead of falling through to the default bullet — internal kinds only,
     never player text, so not reachable today;
   - `rules-data.js`'s `#101` CSS-block check sits just before the file's trailing async IIFE,
     rather than beside the file's other CSS checks — a pointer comment at the usual spot would
     help the next person find it;
   - two notes with no code effect, left as called: the commit trailer on Task 1's commit
     (`86b585f`) names the model that actually wrote it rather than the brief's; and
     `casterLevel()`'s SRD-citing comment sits mid-expression, which the plan asked for and which
     is valid JS;
   - after a skip (click, tap or Esc/Enter/Space), keyboard focus lands on the HP step's first
     `<input>` (`#luTyped`), not the card's first element in DOM order (`#luRoll`) — `openModal()`'s
     existing first-focusable-input behaviour, not new here, rather than a dedicated focus target
     for the card;
   - **390-wide QA was read narrowly.** Only the quiet-level card (`101-after-card-390-classic-
     light.png`), the before shot, the Humblewood scene (`101-scene-humblewood-light-390.png`) and
     the class-line wrap fix (`101-css-wrap-*-360.png`, 360 not 390) were shot at phone width; the
     ASI card's Continue window, the multiclass note's full text, Cleric 5's longer gains list,
     Paladin 1's slots page and the reduced-motion card were driven and shot only at 1280 — so
     whether a card with more rows or a longer note reads well at 390 is still Mike's phone pass to
     confirm.

7. **The final review's fixes** (ledger "Level-up fanfare: final review fixes"):
   - **Decision 11 is narrowed to an allowlist.** The card tags a new feature "you already have
     this from X; they don't stack" only when its name is on `LU_NO_STACK`, Extra Attack or
     Unarmored Defense, and it is already held from another class. Those are the two SRD 5.2.1
     p.26 names: Extra Attack doesn't stack, and you use only one way to calculate AC. A
     same-named Spellcasting is not tagged, because it combines by the multiclass slot table.
     Nor are Expertise and Epic Boon, which are separate picks. The decisions table keeps the
     original wording; this note governs.
   - **§5's "nothing is set" now holds after a good value.** An Apply that fails clears `_lu.set`,
     `_lu.raw` and `_lu.note`, disables Done/Continue and shows the error. So Done does nothing,
     and closing asks `LU_HP_CLOSE` again.
   - **A level-up belongs to its character.** `_lu.id` is the `activeId` at `openLevelUp()`. The
     scene's end, Done and closing drop a level-up whose character has changed: no card, no HP,
     no choices. Loading, importing or starting a character, and going Home, call `luAbandon()`.
     It ends a playing scene and closes an open card.
   - **One spell note per class.** A second class added above level 1 lists only the highest
     level's spell note (`luLatestNotes()`), not every level's.
   - **The two stale comments** above now describe creation.
   - **Left, and in the wiki's known issues:**
     - a long card at 390 puts the HP step and Done below the fold, for Mike's phone pass;
     - the page behind the scene isn't inert for its 2.4s;
     - `luSummary()` cuts at abbreviations;
     - focus after a skip lands on `#luTyped`.

     Nothing may `openModal()` over the card; this is now a rule in the wiki's character-building
     page.

**What Mike checks on his devices:** touch (the card's buttons and the HP step's Roll/Apply are
sized the same as every other modal control, but the scene itself has never been tapped on a real
touchscreen); print (the scene and the card are modals, like every other window, and are not
expected to print — nothing here changes `@media print`'s existing rule for `.modal`, only adds one
for `.lu-fx`); real characters (every level-up driven in QA started from a fresh `newCharacter()`
sheet; nothing here reads or writes a field a saved character wouldn't already have, but a levelled,
multiclassed character of Mike's own is the real stress case for `levelGains()`'s diffing); and real
reduced motion, set in the OS or the browser rather than monkey-patched, which is the one branch
this task could not drive end to end (note 5, above).

Everything else — the scene's markup, timing and tokens, the card's rows and ordering, the HP
step's controls and wording, Done/Continue/closing-early, the multiclass fixes, and the QA pass
across both skins, both themes, 1280 and 390 wide, with the console clean throughout — landed as
specified. See the ledger entry (`WIRING-LEDGER.md`, "Level-up fanfare (#101, 2026-10-24)") for the
full QA account and every screenshot path.
