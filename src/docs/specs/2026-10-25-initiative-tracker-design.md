# Initiative tracker: design

**Status:** approved in conversation 2026-10-25, awaiting Mike's review of this written spec. Wave 3 of
[1.9.0](../wiki/roadmap/1.9.0.md).
**Issue:** #91 (Initiative tracker on the combat screen). One branch, `issue/91-initiative-tracker`.
**Mockups:** `.superpowers/brainstorm/8903-1792934547/content/`:
- `tracker-layout.html`, panel C (the strip);
- `tracker-details.html` (Start combat, the table, the Party card);
- `tracker-health.html` (bars, your roll);
- `tracker-dialog.html` (the combatant dialog).

**Read first:**
- [Combat view](../wiki/features/combat-view.md)
- [Vitals & rest](../wiki/features/vitals-and-rest.md) (the hit-die spend box whose roll controls this copies)
- [Story & notes](../wiki/features/story-and-notes.md) (the Bio tab)
- [Sections & layout](../wiki/ui/sections-and-layout.md)
- [Character model](../wiki/architecture/character-model.md)

---

## 1. What it is

An initiative tracker on the combat view. A strip of chips under the combat header shows the
fight's order, with a health bar under each name and, optionally, a "now acting" marker that **Next**
moves on. **Start combat** opens a Roll initiative window that already lists you and your party. A
**Party** card on the Bio tab holds your companions. Tapping any combatant opens a dialog with big
targets for their health, initiative and AC.

The issue asks for:
- initiative rolls, with an option to show them;
- an HP or estimated-health band (Healthy … Dead), with the dead skipped;
- an estimated AC;
- the round number;
- party names that join automatically;
- combatants added mid-fight.

## 2. Decisions

Settled with Mike: 2026-10-16 on the 1.9.0 page (rows #91), and 2026-10-24/25 in this brainstorm, with
mockups.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Where the fight is kept | **Saved with the character while a fight is on**, beside `combatActive` and `combatRound`; End combat clears it | Session only: a phone reload mid-fight loses the order. Kept after End: stale |
| 2 | Turns or rounds | **Both, per character (`initMode`)**. *Turns*: a now-acting marker; **Next** moves it, skipping the dead; passing the last advances the round through `advanceRound(1)`. *Rounds*: no marker and no Next; the header's ▶ moves the round as now. Default **Turns** | One mode only: Mike wants the granular marker and plain rounds both |
| 3 | Where it sits | **A strip of chips stuck under the combat header** (C); **▾** opens the full table | A card at the top (A): scrolls away. A side column (B): cramped, and a phone needs A anyway |
| 4 | Editing a combatant | **One dialog per combatant**, opened by tapping a chip or a table row, with targets at least 44px tall. The table itself is read-only | Inline segments and inputs in the table: too small to tap on a phone (Mike) |
| 5 | Health | **Five bands: Healthy · Injured · Bloodied · Near death · Dead**, plus "?" for not set, shown as a four-segment bar coloured by band. Each band carries the DM's usual words ("barely hurt", "almost dead"). "Bloodied" replaces the issue's "Severely injured", to match the 2024 rules | Exact HP for everyone: enemy HP is never known |
| 6 | A party member's health | **Each party member chooses Exact HP or Estimate.** Exact gives an HP stepper and a smooth bar (share of max HP, coloured by band). Estimate gives the band buttons. It starts on Exact when the party list gives a max HP. It can be flipped any time | Exact only: friends' HP is often unknown (Mike) |
| 7 | AC | **Optional for party members and enemies**; a blank shows nothing. Yours is read from your sheet | A required AC: rarely known for enemies (Mike) |
| 8 | Your initiative | **The hit-die spend box's controls**: 🎲 Roll for me (d20 + your initiative modifier), or "I rolled [d20 face]" + Apply. The modifier is added and the working shown ("14 + 3 = 17"). An **Advantage** switch rolls two and keeps the higher | A typed total only: Mike wants the same roll dialog as the HP steps |
| 9 | Everyone else's initiative | **A typed total.** Their players or the DM roll it | n/a |
| 10 | Who is skipped | **Enemies marked Dead; party members marked Dead** (a switch, because 0 HP means dying, not dead). **You never are**: at 0 HP you still take death-save turns | Skipping anyone at 0 HP: wrong for dying characters |
| 11 | The party | **A Party card on the Bio tab.** Each member has a name, an optional AC and an optional max HP. Every fight you start adds them, and you | Typing the party each fight: the issue asked for it to be automatic |
| 12 | Show rolls | **A switch (`initShowRolls`, default on)** hides initiative numbers from the strip | n/a |

## 3. Data

All of these are new optional fields. Each defaults in `blankChar()` with a literal (TDZ), is cleaned
by `migrate()` after it preserves every field, and survives a save → load round trip.

- **`party`**: `[{id, name, ac, maxHp}]`, default `[]`.
  - `name` is a string trimmed to 60 characters.
  - `ac` and `maxHp` are a whole number ≥ 0 or `""`.
  - Entries with no name are dropped.
- **`combatants`**: `[{id, kind, name, init, ac, track, band, hp, maxHp, dead, partyId}]`, default `[]`.
  - `kind` is `"you"`, `"party"` or `"foe"`.
  - `init` is a whole number, or `null` for not rolled. Rows with no roll go last.
  - `track` (party only) is `"exact"` or `"estimate"`.
  - `band` is `0`–`4` (Healthy, Injured, Bloodied, Near death, Dead), or `null` for not set. It is used by foes, and by party members on Estimate.
  - `hp` and `maxHp` belong to party members on Exact.
  - `dead` is a boolean for party members. For a foe, death is `band===4`.
  - The array order **is** the turn order.
  - At most one `kind:"you"` row.
  - Cleaning drops unknown kinds and junk, and forces each field's type. Out of a fight (`combatActive!==true`) it is always `[]`.
- **`combatTurn`**: the acting combatant's `id`, or `""`. Cleaning resets it to the first living row if the id no longer exists.
- **`initMode`**: `"turns"` or `"rounds"`, default `"turns"`.
- **`initShowRolls`**: a boolean, default `true`.

## 4. Behaviour

- **Start combat** (`#cvStart`) opens **Roll initiative** (§5.3). Cancel or × starts nothing. Start then:
  1. calls `combatStart()` (round 1);
  2. builds `combatants` from the window, sorted by `init` descending (stable, unrolled last);
  3. in Turns mode, sets `combatTurn` to the first living row;
  4. saves.
- **Re-sorting:** changing a row's initiative moves it to its sorted place. Rows with equal rolls keep their order; the table lets a row be dragged within a tie (§5.2).
- **Next ▸** (Turns only) sets `combatTurn` to the next living row after it.
  - Passing the end calls `advanceRound(1)`, so spells and conditions tick as today, and the marker wraps to the first living row.
  - If no row is living except you, the marker stays on you, and passing the end still advances the round.
  - The header's ◀ ▶ change only the round and never move the marker.
- **Adding mid-fight** (`+ Add combatant`): a name, an initiative and an optional AC, inserted in its sorted place. If the new row lands before the actor, the actor doesn't change.
- **Removing** a row that is acting first moves the marker to the next living row.
- **Your row** reads `effMaxHP()`, `character.hp.cur` and your AC live. Its bar repaints whenever the sheet's HP does.
- **End combat** clears `combatants` and `combatTurn` (inside `combatEnd()`), after whatever reads them. #105 will read them first.
- **Switching character:** each character has its own fight. The strip repaints from the character on screen (`renderAll()` → the combat chrome).

## 5. Interface

### 5.1 The strip

- `#cvInit` sits in the combat view, directly under `#cvHead` and stuck with it (sticky).
- It is shown only while `inCombat()`.
- It is a horizontal row of chips in turn order. Each chip shows the initiative (if Show rolls is on), the name, and a bar:
  - a four-segment band bar;
  - a smooth share bar for you and for party members on Exact;
  - a grey "?" when the band is not set.
- The acting chip has the accent background (Turns mode). Dead chips are faded and struck through.
- The strip scrolls sideways on a phone and keeps the actor in view.
- The right end holds **Next ▸** (Turns mode) and **▾**.
- Tapping a chip opens its dialog (§5.4).
- Keyboard: each chip is a button. Next and ▾ are buttons with aria-labels. A live region announces "<name>'s turn" on Next.

### 5.2 The table (▾)

- A panel under the strip, toggled by ▾ / ▴.
- One row per combatant: initiative, name with a kind tag, the health (band name, or HP x/y), and AC when it is set.
- Rows are read-only. A tap opens the dialog. A grip drags a row within a tie, using the combat view's existing drag pattern.
- The panel foot holds **+ Add combatant**, the **Turns / Rounds** switch and **Show rolls**.

### 5.3 Roll initiative

- A modal listing your row first, then the party, then empty foe rows.
- Your row:
  - **🎲 Roll for me**, `or`, **I rolled [ ] Apply**, and an **Advantage** switch;
  - a result line: "Rolled 6, 14 → 14 + 3 = 17", or "14 + 3 = 17";
  - the typed value must be 1–20, with the spend box's message otherwise.
- Party rows take a typed total, blank allowed.
- Foe rows take a name, a count (`× N`, 1–20, which makes "Name 1" … "Name N" sharing the roll), an optional AC and a typed total.
- **+ Add a monster** adds a foe row.
- **Start ▸** builds the fight (§4).

### 5.4 The combatant dialog

- A modal titled with the combatant's name, with every target at least 44 px.
- **Foe:**
  - "How hurt?" offers five full-width band buttons, each with its bar, its name and the DM's words. One tap sets the band and closes the dialog.
  - Initiative and an optional AC guess.
  - **Remove** and **Done**.
- **Party:**
  - an **Exact HP / Estimate** switch. Exact gives the HP stepper (− [n / max] +, with a typed value accepted, clamped 0..max); Estimate gives the band buttons;
  - a **Dead** switch;
  - Initiative and an optional AC;
  - **Remove** and **Done**.
- **You:**
  - Initiative only, with a note that HP changes on the Vitals card;
  - **Done**. You can't be removed or marked dead here.

### 5.5 The Party card (Bio)

- A new card on the Bio tab, registered as section `party` (tab `story`, `nocv:true`, so its note button works and it never enters the combat view).
- The rows are name, AC and max HP, with ✕ to remove one and **+ Add** to add one. An add or edit opens a small form.
- It follows the #97 pencil for edit and delete, like other list cards (`EDIT_CARDS` gains `party`).
- The hint reads "Joins every fight you start. AC and max HP are optional."

## 6. Code

- **A new fragment, `src/js/87-initiative.js`, placed after `87-combat.js` in `src/manifest.json`.** The JS fragment count goes from 35 to 36 in CLAUDE.md and ADR-001, and it gets a code-map row in the overview and citation by a topic page.
- **Pure functions:**
  - the cleaners (`cleanParty`, `cleanCombatants`);
  - `initSort` (stable);
  - `initNextTurn(list, turnId)` → `{turnId, wrapped}`;
  - `bandOfShare(hp, max)`;
  - `initRollCheck(face)`;
  - `initTotal(face, mod)`;
  - `buildCombatants(you, party, foes)`.
- **Renderers and wiring** for the strip, the table, the two dialogs, Roll initiative and the Party card.
- **`87-combat.js`:**
  - `combatStart` and `#cvStart` go through Roll initiative;
  - `combatEnd` clears the fight;
  - the header and chrome render the strip.
- **Elsewhere:**
  - `00-constants.js` (the fields);
  - `71-char-io.js` (cleaning);
  - `30-story.html` and the section registry (`87-notes.js`) for the Party card;
  - `70-combat.html` (`#cvInit`);
  - `45-combat.css` (the strip, bars and dialog, on theme tokens for both skins);
  - band colours as tokens in `00-tokens.css` (`--hb-healthy`, `--hb-injured`, `--hb-bloodied`, `--hb-near`).

## 7. Edge cases

- **Nobody but you:** the strip shows one chip, and Next advances the round every press.
- **Every foe dead:** Next cycles through you and the living party.
- **A party member removed from the Bio card mid-fight:** their combatant stays. The Party card is only the template for the next fight.
- **Your initiative modifier changes mid-fight:** your stored total stays. Initiative is rolled once.
- **A reload mid-fight:** everything restores, including the marker.
- **An old sheet with `combatActive:true`:** it loads with `combatants:[]`, and the strip shows "Roll initiative to start the tracker" with a button that opens §5.3 for the fight already in progress.
- **Rounds mode switched to Turns mid-fight:** the marker lands on the first living row.

## 8. Testing

- **Pure:**
  - the cleaners: junk, types, max one "you", empty out of a fight;
  - the sort: stable, unrolled last;
  - `initNextTurn`: skips the dead (foe band 4, party dead), never skips you, wraps with `wrapped:true`, and handles everyone dead but you;
  - `bandOfShare(hp, max)` thresholds: full Healthy, above half Injured, half or less Bloodied, a quarter or less Near death (0 HP included; Dead only by the switch);
  - `initRollCheck` 1–20;
  - `initTotal` with a negative modifier;
  - Advantage keeps the higher roll;
  - `buildCombatants`: party in, you in, "× N" names, AC optional.
- **Flow (sheet.js):**
  - Start → sorted, marker on the first living row, round 1;
  - a Next that wraps calls `advanceRound(1)` once;
  - Rounds mode has no marker;
  - add and remove mid-fight;
  - End clears;
  - a save → load round trip mid-fight.
- **Markup:**
  - strip chips escape names;
  - dialogs have targets ≥44 px (CSS check);
  - the Party card is registered, so the section counts and `EDIT_CARDS` move;
  - `${…}` in attributes is `esc`-ed.
- **Browser QA** through the project's Playwright MCP:
  - a full fight at 1280 and 390, in both skins;
  - Roll for me and a typed roll, with Advantage;
  - the dialog for each kind;
  - Exact ↔ Estimate;
  - Turns ↔ Rounds;
  - Show rolls off;
  - add and remove mid-fight;
  - a reload mid-fight;
  - End.

## 9. Docs

- Rewrite these wiki pages, each with a History line citing `## Initiative tracker (#91, <date>)`:
  - combat-view (the tracker);
  - story-and-notes (the Party card);
  - character-model (the fields);
  - sections-and-layout (the `party` section);
  - theming-and-icons (the band tokens);
  - the overview code map.
- Add Decisions rows, with matching lines in the register.
- Add these `UNRELEASED.md` bullets:
  - "An initiative tracker in the combat view: roll initiative when combat starts, follow the order turn by turn or round by round, and track everyone's health at a glance."
  - "A Party card on the Bio tab: your companions join every fight you start."

## 10. Out of scope

- The end-of-fight dialog: loot, XP and recovery are #105.
- Monster stat blocks, and importing monsters from a pack.
- Rolling for party members or monsters.
- Conditions on other combatants.
- Sharing the tracker between players.

## As built

As specified, §1–§9, with the differences below, built in six tasks and a final fix wave (the implementer and reviewer reports, every `Ruling:` and
`minor (deferred)` line, and the full browser-QA account are in
`.superpowers/sdd/2026-10-25-initiative-tracker/progress.md` and the task reports beside it; see
the ledger entry "Initiative tracker (#91, 2026-10-25)" for the condensed version with code and
screenshot citations).

**The plan-level tie Ruling.** Decision 4 says editing is one dialog with ≥44px targets and the
table is read-only, but does not itself say how two tied rows reorder. The plan settled it and told
Mike at handoff, rather than leaving it to drift during the build: a tie breaks with **Act earlier**
/ **Act later** buttons inside the combatant dialog (`initTie()`, `moveCombatant()`), never a drag
on the table row. The table's rows are read-only by decision 4 and the strip scrolls sideways on a
phone, so a drag gesture there would fight the scroll; the dialog's buttons are free. Cost if this
turns out wrong: adding a drag gesture later, on top of what's built, not a rework.

**Fixed mid-build, not left open:**
- Roll initiative's inputs went full width under the app's general `input{width:100%}` rule — a
  party row's initiative box and a foe row's ×/AC/Init boxes each ended up alone on their own line.
  Fixed with scoped widths (`.ir-row input`, `.ir-foe input`) in Task 3 (commit `d5bacc3`).
- `#irAddFoe`'s (later also `#iniAdd`'s) bare `class="add"` matched no CSS rule and rendered as a
  plain browser button — the existing `.add` styling was scoped to `.label .add` / `.rb-head .add`.
  Fixed with a scoped copy, `#mBody .add,.ini-foot .add` (Task 3).
- `#cvInitMore`'s ▾/▴ glyph and `aria-expanded` were hard-coded inside `initStripHTML()`, which
  `combatHeaderHTML()` rewrites whole on every round, turn or mode change — so the table could stay
  open while the button visually reset to closed, and a real tap then closed it unexpectedly. Fixed
  with one source of truth, a module-level `_iniTableOpen` flag both the button and
  `renderInitTable()` read, flipped only by `toggleInitTable()` (Task 4, commit `1da6e8d`).
- `#cvInitTable` ran the full page width instead of sharing the combat view's own column — it sits
  outside `#cvHead` as a sibling, so it inherited no width constraint. Fixed by giving it
  `.cv-head`/`#cvList`'s own `max-width:780px;margin:0 auto` (Task 4, same commit).

**Where the build differs from §1–§9:**
- **The strip lives inside `#cvHead`** as `.cv-init`, drawn by `initStripHTML()` from
  `combatHeaderHTML()`'s in-combat branch, not as a separate `#cvInit` "directly under" the header
  (§5.1, §6). It sticks with the header for free and repaints with it. Only the ▾ table is its own
  element, `#cvInitTable` in `70-combat.html`, a sibling below the header.
- **The old-save strip** (§7) reads "No initiative yet." with a **Roll initiative** button
  (`#iniRollNow`), not "Roll initiative to start the tracker".
- **A tie reorders in the dialog** (Act earlier / Act later), not by a grip on the table (§5.2):
  the plan-level Ruling above.
- **No `initTotal(face, mod)`** (§6): `initRollLine(faces, mod)` writes the working, and the total
  is computed where the fight is started (`irStart()`).
- **A wrap off a dead or removed actor advances the round** (ruling T5-M2, final fix wave): §4
  says only that passing the end on Next advances the round; marking the actor Dead, or removing
  them, when the marker's move wraps past the end, does too, once.

**Fixed in the final fix wave** (the final whole-branch review,
`.superpowers/sdd/2026-10-25-initiative-tracker/final-review.md`; ledger "Initiative tracker:
final review fixes (#91, 2026-10-25)"):
- **I1.** Your chip and table row did not repaint when your HP changed (§4 says they do).
  `renderHP()` now ends in `renderInitStrip()`, which patches just those two nodes in place. A
  first version that swapped the whole strip lost a tap on Next made right after typing an HP (the
  HP box's blur commits on that tap's mousedown); patching in place fixed it.
- **I2.** The strip never kept the actor in view, and every repaint snapped it back to the start
  (§5.1). The header's repaint now carries the scroll across and scrolls only as far as the acting
  chip needs (`initKeepActorInView()`, `initChipScroll()`).
- **I3.** A roll typed into "I rolled" was dropped if Start ▸ was pressed without Apply. Start
  (`irStart()`) now applies it, and a bad one stops Start with its message.
- **T5-M2.** As above: a wrap on Dead or Remove advances the round once.
- **The `#cdHp` finding** below: the box is now rewritten from the stored row on every change.
- **Deferred minors fixed:** the stale `sheet.js` test name; an "Init" placeholder on party rows in
  Roll initiative; a typed negative HP clamps to 0; `#cdHp` is 44px tall; focus returns to the
  pressed control after the dialog reopens.
- **m1** no marker on a dead row, and none in Rounds mode after a reload; **m2** "Round N" is
  announced only when the round moves, and a wrap says "Round N — <name>'s turn" in one message;
  **m3** a party member on Exact with no max shows "HP n" (and no "/ ?"); **m4** a missing or
  repeated id gets a fresh one, and a blank name becomes "Unnamed" or "Party member"; **m5**
  `combatEnd()` returns `{rounds, sec, combatants}`, the fight it cleared, for #105; **m6**
  `startCombatNow()` stays as the no-roll start the tests call, now commented; **m7** this As built
  corrected; **m9** Add combatant keeps a 60-character name. **m8** (the double render per tracker
  action) was left by ruling.

**Deferred minors, from code review across Tasks 1–5 (all recorded in progress.md; those marked
✔ were fixed in the final fix wave, the rest left by ruling):**
- `initRollCheck` reports the generic "Type the number you rolled." for a negative input like
  `-3`, rather than the d20-range message — the plan's own code (Task 1).
- ✔ A `sheet.js` test name read "every other section is combat-addable", now stale since `party` is
  a second `nocv` section (Task 2); the assertion itself was fixed, only the name is stale.
- ✔ The party-row initiative box in Roll initiative has no visible Init label beside it (Task 3).
- `.cv-head.fighting .cv-init{order:5}` sits in the phone media query ahead of the base `.cv-init`
  rule, against the fragment's own media-after-base convention (Task 4).
- 4 of 8 newly exported `87-initiative.js` functions have no direct unit test (Task 4).
- An AC of literal `0` displays, because the guard is `ac!==''` (Task 4).
- The combatant dialog's change listeners read the live `_cdId`, not the id captured at open
  (`87-initiative.js:341`) — harmless today since only one dialog is ever open, flagged for when
  that assumption might change (Task 5).
- ✔ A typed negative HP becomes blank rather than clamping to 0 (Task 5).
- ✔ `#cdHp` is 42px tall, under the 44px target convention the rest of the dialog follows (Task 5).
- ✔ Every dialog reopen moves focus to the first field, so a keyboard user loses their place after
  −/+/Act earlier/Act later (Task 5).
- The tie test (`initTie()`) is written as an OR of two conditions rather than one helper call
  (Task 5).
- The "you" branch of `combatantDialogHTML` reads the global `character` rather than its own `ch`
  parameter — works today because the dialog is only ever opened for the character on screen, but
  not parameter-pure (Task 5).

**New finding from Task 6's browser QA (✔ fixed in the final fix wave: the change listener now
writes the stored value back into the box):** typing an HP above max into `#cdHp` and blurring clamps
`character.combatants[].hp` correctly, but the `#cdHp` input itself keeps showing the typed
over-max number until the dialog is closed and reopened — `openCombatant()`'s `ch()` helper
(`87-initiative.js:341-342`) wires `#cdInit`/`#cdAC`/`#cdHp` with a plain `change` listener that
calls `setCombatant()` but, unlike every other control in the dialog (band, track, HP step, Dead,
Act earlier/later — each of which reopens the dialog), never re-renders it. Steps to reproduce:
start a fight with a party member on Exact HP, open their dialog, type a number above their max
into the HP field, blur — `character.combatants` shows the correctly clamped value, but the field
still reads what was typed; Done then reopening the dialog shows the correct value.

**Browser QA** (project Playwright MCP; before shots from main's `dist/fieldbook.html`, after shots
from the worktree build — paths and what each shows are in the ledger entry and
`.claude/qa/91-*.png`): the combat view in a fight and the Bio tab, 1280 and 390, before and after;
two party members (one with a max HP, one without); Roll initiative — Roll for me with Advantage on
and off, a refused 21, an accepted 14+Apply, a Goblin×2 and a Goblin boss with no AC; the strip at
1280 and 390 including a sideways scroll and Show rolls off; Next through a full wrap — the round
advanced from 1 to 2 exactly once and a test active spell's `elapsedSec` ticked 0→6; the foe dialog
through all five bands, including Dead retargeting the turn marker; the party dialog's Exact↔
Estimate round trip, HP − and +, the over-max clamp (and the finding above), and Dead; Turns↔
Rounds, including the marker landing on the first living row on the way back to Turns; adding an
Ogre mid-fight and removing the then-current actor, retargeting the marker; a full reload mid-fight
restoring `combatants`, `combatTurn`, `combatRound`, `initMode` and the active spell's elapsed time
through `loadCharById()`; End combat clearing the strip; both skins at 1280 and dark mode once; a
clean console (`browser_console_messages`, `all:true`) throughout. Full suite
(`./build.sh --no-zip && ./src/tests/run.sh`) green before every commit.

**Everything else** — the data model (§3), `startInitFight()`/`combatStart()`/`combatEnd()`
wiring, re-sorting, `initNextTurn()`'s skip/wrap/never-skip-you rules, the Party card, Roll
initiative's modal, the combatant dialog per kind, and the section/`EDIT_CARDS` registry changes —
landed as specified, with the differences and fixes listed above. The final fix wave was driven at
390 with the project Playwright MCP (`.claude/qa/91-fix-strip-390.png`): a typed roll with no
Apply, a refused 25, eight chips through two wraps with the actor in view each time, your HP typed
on Vitals reaching the chip and the table row, a Dead band and a Remove on the last actor each
advancing the round once, the dialog's focus after −, +, Dead, a track flip and Act earlier/later,
and the HP box after an over-max and a negative entry; the console stayed clean.
