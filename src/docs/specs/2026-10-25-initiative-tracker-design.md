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
