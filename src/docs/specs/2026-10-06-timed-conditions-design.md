# Timed conditions and compact stats in combat — design

**Status:** implemented on branch `issue/55-timed-conditions` · 2026-10-06 — see As built at the end
**Issues:** #55 (timed conditions), #62 (quick view of abilities and skills in the combat tracker).
Both land on one branch, `issue/55-timed-conditions`, in two milestones (§7), each with its own
commits. They share the combat view and the round tracker, and a fight is where both are used.

---

## 1. What it is

**Timed conditions (#55).** A condition can last a set time: Poisoned for 1 minute, Frightened for 3
rounds. The round tracker moves it on as it moves spell durations — ▶ in the combat view, Round ± on
the Active Spells card — and the row shows the time left. When the time runs out the condition clears
itself, with an Undo. An untimed condition works exactly as it does today.

**Compact stats in combat (#62).** The Ability Scores & Saves and Skills cards, added to the combat
view with their existing swords buttons, draw condensed and read-only there: modifiers, saves and
skills at a glance, nothing to type in or toggle by accident. On the Sheet tab they are unchanged.

Why: in a fight a player counts down conditions in their head, and scrolls past inputs to read a
skill bonus.

## 2. Decisions

Settled with Mike on 2026-10-03 and 2026-10-06. The rejected options are recorded so they are not
re-proposed without the reason they lost.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | How a duration is entered | **A number and a unit** (rounds, minutes, hours); blank is untimed | Free text parsed like spell durations: a typo silently makes it untimed. Rounds only: an hour is 600 |
| 2 | When the time runs out | **It clears itself**, with a toast and an **Undo** | Asking first, as spells do: a dialog in the middle of a fight. Only marking it "expired": the player still has to clear it |
| 3 | What moves the clock | **The round tracker plus − rd / + rd on the row** | The tracker only: a wrong count could be fixed only by editing the duration |
| 4 | What the row shows | **Time left** ("3 rounds left") | Elapsed / duration like Active Spells ("0:18 / 1:00"): not the number you act on |
| 5 | An item's Use applying a timed condition | **Not now**: item-applied conditions stay untimed | A duration on the item form's applied status: more surface than this release needs |
| 6 | Reactivating a cleared timed condition | **Restarts its full duration** | Resuming the time it had left: not what happens at the table |
| 7 | How the quick view reaches the combat view | **The existing Abilities and Skills cards draw compact and read-only inside the view** | A new Quick Stats card on the Sheet tab: duplicates the full cards there. A card that exists only in the view: needs a new way to add it, since cards are added from their own tab |
| 8 | The quick view's layout | **Follows the character's Skills display** (Classic or By ability) | Always by ability, or always classic: ignores a choice the player already made |

## 3. Timed conditions: data

| Field | Where | Default | Meaning |
|---|---|---|---|
| `durationSec` | a status | absent | how long it lasts, in seconds (a round is 6). Absent, not a number, or not above 0: untimed |
| `elapsedSec` | a status | absent (= 0) | how long it has run since it was last applied |

- Both are optional; an existing save needs no migration. `migrate()` keeps them like any other field,
  and every reader coerces: a junk `durationSec` reads as untimed, a junk or negative `elapsedSec` as 0.
  `character.statuses` already exists in `blankChar()`.
- **The Concentrating condition is never timed.** Its spell owns the clock (an active spell's
  `durationSec`), so a status with `concId` ignores any duration it is given, and the form hides the
  duration row on it.

## 4. Timed conditions: behaviour

### 4.1 The status form

- A new **Lasts** row under the notes: a number box and a unit select (rounds, minutes, hours). Blank
  or 0 is untimed. Saved as `durationSec` = number × 6, × 60 or × 3600.
- Editing a timed condition shows its duration in the largest unit that divides it exactly (60 s →
  1 minute, 18 s → 3 rounds).
- **Changing the duration keeps the time already elapsed**, so a mistyped length can be corrected
  without restarting. Removing it (blank) makes the condition untimed and drops `elapsedSec`.
- The form rebuilds the record on save, so `durationSec` and `elapsedSec` are written from the form
  and the old record (as `concId` already is carried).

### 4.2 The clock

- `advanceRound(dir)` moves every **active** timed condition by `dir × 6` seconds, together with the
  active spells, after its existing guard: at round 1 in combat ◀ moves nothing, spells or conditions.
- Each active timed row has **− rd / + rd**, moving only that condition by 6 seconds. − rd stops at 0.
- A cleared condition does not tick.
- Out of combat the Active Spells card's Round ± is the tracker, as today; it is hidden while no spell
  is active, so the row buttons are how time passes then. In the combat view Active Spells always
  shows.

### 4.3 Running out

- When a step brings an active condition's `elapsedSec` to its `durationSec` or past, the condition
  flips to **Cleared**: `active` becomes false, the row stays, its effects stop — exactly what tapping
  the toggle does. Its `elapsedSec` is kept at the duration.
- **One toast per step** names every condition that ran out: "Poisoned has run out", "Poisoned and
  Frightened have run out", "Poisoned, Frightened and 1 more have run out".
- The toast's **Undo** restores each of them to active with the elapsed time it had before the step
  (so ▶ then Undo leaves them one step from the end, as before the ▶). It applies **once** (a second
  press does nothing) and only on the character it was shown for (it carries the character object,
  as the trackers' and ammunition Undo do).
- **Focus stays where it is.** The ▶ or Round + that was pressed is still there, so a keyboard player
  pressing it again must not land on Undo instead. The toast is announced (`role="status"`).
- ◀ after a condition ran out does not bring it back; Undo does.

### 4.4 Restarting

- Switching a timed condition from Cleared to Active (the row's toggle, or "Active now" in the form)
  sets `elapsedSec` to 0: the full duration again.
- An item's Use that reactivates a same-named condition (`addStatusByName()`) restarts it the same
  way. A new condition added that way stays untimed (decision 5).

### 4.5 On the row

- **Active and timed:** the time left, `durationSec − elapsedSec`:
  - up to 60 s: rounds, rounded up — "1 round left", "3 rounds left", "10 rounds left";
  - otherwise the time rounded up to the minute: under an hour, minutes — "2 min left",
    "59 min left"; an hour or more, hours and minutes — "1 h left", "1 h 30 min left".
- **Cleared and timed:** its length — "lasts 3 rounds", "lasts 1 min", "lasts 1 h".
- **Untimed:** nothing new.
- The text sits beside the Active/Cleared toggle; − rd / + rd sit in a row under it, as on Active
  Spells. The Concentrating mirror on the Spells tab is untimed, so it shows nothing new.
- **Print:** an active timed condition is listed with its time left: "Poisoned (3 rounds left)".

## 5. Compact stats in the combat view (#62)

### 5.1 What changes

The Ability Scores & Saves card (`data-note="abilities"`) and the Skills card (`data-note="skills"`)
draw condensed while they are inside the combat view (`#cvList`):

- **Classic display:** the six abilities in one row (three per row on a phone), each its name, its
  modifier large, the score small, and its save with the proficiency mark. The Skills card's eighteen
  skills in three tight columns (two on a tablet, one or two on a phone): value, name, ability.
- **By ability display:** the grouped blocks with tighter rows and smaller type. The Skills card stays
  hidden in the view, as it is on the Sheet in this display.
- The proficiency legend ("None · Proficient · Expertise · Tap dot to cycle") is hidden in the view.
- Card headings — the grip, the title, the swords and note buttons — are unchanged.

### 5.2 Read-only

- While a card is in the view, its **score inputs and proficiency dots are disabled**: no typing, no
  tapping to cycle a proficiency, and not in the Tab order. The score box is styled as a plain number;
  the dot keeps showing proficient and expertise (`data-lvl`), just not as a button.
- **The values stay tappable**: a modifier, save or skill still opens its breakdown, which only reads.
- When the card goes back to its tab, every control is enabled again.

### 5.3 How it is wired

- One idempotent function, `syncStatLock()`, sets `disabled` on each score input and proficiency dot
  of the two cards to exactly "is this card inside `#cvList`?".
- It runs after `fillCombatView()` moves cards in, after `sendCardHome()` moves one out, and at the
  end of `buildStats()`. The last matters: a redraw while the view is open — a character switch, or
  changing the Skills display — builds fresh controls, which must come out disabled.
- The compact look is CSS under `#cvList [data-note="abilities"]` and `#cvList [data-note="skills"]`
  in the combat view's stylesheet, using existing tokens.

## 6. Edge cases

- **Hostile data:** a status's `durationSec`/`elapsedSec` from a file can be anything; readers coerce,
  and the row text and the form never put a raw value into markup (`esc()`; numbers only).
- **Several conditions run out on one step:** one toast, one Undo that restores all of them.
- **A step that both runs out a condition and ends a spell:** the spell's own expiry prompt
  (`maybeExpire()`) is unchanged; the condition's toast follows it.
- **A character switch with the toast showing:** the Undo does nothing on another character.
- **Deleting a condition** that the toast names: Undo restores the others and skips it.
- **Effects:** a condition that runs out stops contributing at once (`recompute()` after the step).
- **The combat view open on a character switch:** `syncCombatView()` refills it, and `buildStats()`
  runs first in `renderAll()`, so `syncStatLock()` leaves the new controls in the right state.

## 7. Milestones

| | What | Closes |
|---|---|---|
| A | Timed conditions: the fields, the form, the clock, the row buttons, running out with Undo, the row text, print | #55 |
| B | Compact, read-only Abilities and Skills cards in the combat view: CSS and `syncStatLock()` | #62 |

## 8. Testing

- **`src/tests/sheet.js`, pure:**
  - reading a duration: junk, negative, 0, strings, the Concentrating row (never timed);
  - the time-left text at each boundary (1, 10 and 11 rounds; 2 and 59 minutes; 1 hour; 1 h 30 min)
    and the cleared "lasts …" text;
  - the form's unit choice when editing (60 → 1 minute, 18 → 3 rounds, 5400 → 90 minutes);
  - a step moving only active timed conditions; ◀ at round 1 in combat moving nothing;
  - running out at exactly the duration; several at once; the toast's wording;
  - Undo restoring active and the previous elapsed, once, and only on the same character;
  - restarting on reactivation from the row, the form, and `addStatusByName()`;
  - a save→load round trip of a timed condition;
  - `syncStatLock()` over a stub view: controls inside disabled, outside enabled, idempotent;
  - hostile status data through the row, the form and the print sheet.
- **`src/tests/rules-data.js`:** the row's new controls are wired; `syncStatLock()` is called from
  `fillCombatView()`, `sendCardHome()` and `buildStats()`; attribute escaping (automatic).
- **Driven in Playwright** (both skins, 1280 and 390):
  - Poisoned for 3 rounds through ▶ to running out, the toast, Undo;
  - − rd / + rd; reactivating restarts the clock;
  - "10 rounds left" for a 1-minute condition; "2 min left" for 2 minutes;
  - Abilities and Skills in the combat view in both Skills displays: compact, unable to type or
    toggle, breakdowns opening; editable again on the Sheet tab;
  - a character switch with the view open.

## 9. Out of scope

- Short and long rests moving condition clocks (they do not move spell clocks either).
- A duration on an item's applied status (decision 5).
- Initiative and turn order: the round is still the unit of time.
- Passive Perception and Initiative in the compact view: they are on Vitals.
- A compact mode for any other card.

## 10. Release notes

For `src/docs/UNRELEASED.md`:

> - Conditions can now last a set time: give one a duration in rounds, minutes or hours, and the round
>   tracker counts it down beside your active spells. The condition shows the time it has left, clears
>   itself when it runs out (with an Undo), and starts its full time again if you switch it back on.

> - Ability Scores & Saves and Skills now draw as a compact, read-only quick view when you add them to
>   the combat view, so your bonuses are easy to read mid-fight. Tap any value for its breakdown; edit
>   them on the Sheet tab as before.

## As built (2026-10-06)

Built as designed. Names the spec did not give: `STATUS_UNITS`, `statusDuration()`,
`statusElapsed()`, `statusTimed()`, `statusUnitFor()`, `fmtStatusTime()`, `statusTimeText()`,
`statusExpiredText()`, `tickStatuses()`, `restartStatus()`, `announceStatusExpiry()`,
`undoStatusExpiry()`, `stepStatusTap()` (in `40-sheet.js`), and `syncStatLock()` (in `87-combat.js`).
The timed-condition code lives beside the status row in `40-sheet.js`; no new fragment.

1. **A timed condition's time sits under its name, not beside the toggle** (spec §4.5 put it in the row's top line). At phone width the top line has no room for it — the name and "3 rounds left" collided — so the time text shares the line under the name with − rd / + rd while active, and stands alone there ("lasts 3 rounds") while cleared. The top line is exactly as it was before this feature.
