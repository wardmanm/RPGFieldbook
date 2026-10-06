# Conditions & concentration

The Statuses & Conditions card on the Sheet tab: the conditions and temporary states a character is
under — Poisoned, Blessed, Raging — each with optional notes and numeric effects that apply while it
is active. Casting a concentration spell adds a **Concentrating** condition linked to that spell.
The two are one fact, so ending either ends both, and the same row is mirrored on the Spells tab
above Active Spells, where you look before casting the next spell.

**Code:** `renderStatuses()`, `statusRowHTML()`, `statusTitle()`, `renderConcCard()`, `statusDuration()`,
`statusElapsed()`, `statusTimeText()`, `tickStatuses()`, `restartStatus()`, `announceStatusExpiry()`,
`undoStatusExpiry()`, `stepStatusTap()` in `40-sheet.js`; `syncConcStatus()`, `endConcentration()`,
`endConcFromStatus()`, `concActiveSpell()`, `concStatusRow()`, `concStatusDesc()`, `castSpell()`,
`maybeExpire()`, `endActiveSpell()`, `advanceRound()` in `60-attacks.js`; `openStatusForm()`,
`addStatusByName()`, `statusTermList()` in `80-modal-forms.js`; `contributions()` in
`00-constants.js`; `renderAll()` in `66-coins-hp.js`; the status handlers in `90-boot.js`;
`#concCard` in `src/html/20-spells.html` · **Tests:**
`sheet.js`, `rules-data.js` · **See also:** [Spells](spells.md),
[Computed stats & effects](../architecture/computed-stats-and-effects.md),
[Combat view](combat-view.md), [Inventory](inventory.md)

## How it works

**A status** is `{id, name, description, effects, active}` in `character.statuses`, plus `concId`
on the Concentrating row and, optionally, `durationSec`/`elapsedSec` for a timed condition. The
card's Add (`data-add="status"`) opens `openStatusForm()`: a name with
a datalist of conditions — glossary entries flagged `cond`, or whose term is a standard condition in
`STATUS_CONDSET` — optional notes, a **Lasts** row, numeric effect rows, and "Active now". Save
rebuilds the record from the form.

**A row** (`statusRowHTML()`) shows the name — tappable as a glossary keyword when it matches a term
(`statusTitle()`) — an Active/Cleared toggle, edit and delete, the notes through `richHTML()`, and the
effect chips, greyed while cleared. **Cleared is not removed**: the row stays and its effects stop,
because `contributions()` counts a status's effects only while `active !== false`. An item's Use can
apply a status by name through `addStatusByName()`, which reactivates a same-named row rather than
adding a second ([Inventory](inventory.md)).

**Timed conditions.** A condition can now last a set time. A status carries an optional
`durationSec` (a round is 6) and `elapsedSec`; the status form's "Lasts" row sets it in rounds,
minutes or hours, and blank is untimed, as every condition was before. `advanceRound()` moves every
active timed condition with the active spells. The time text sits under the name, with − rd / + rd
while active — never in the top line, which stays exactly as it was before this feature, so it still
fits a phone. A forward step that brings one to its duration flips it to Cleared (row kept, effects
off); one toast per step names them, with an Undo that applies once and only on the character it was
shown for. Focus is not moved,
so a keyboard ▶ cannot land on Undo. Switching one back on — the toggle, the form, or an item's Use
reactivating it — restarts its full duration; changing its length in the form keeps the time already
run. The Concentrating condition is never timed: its spell owns the clock. The print sheet shows the
time left.

**Concentrating.** The running spell is the truth: the entry in `character.activeSpells` with
`conc:true` (`concActiveSpell()`). The condition is a **mirror** named `CONC_STATUS_NAME`
("Concentrating") whose `concId` is that active spell's id; `concStatusRow()` finds it by `concId`,
never by name. `syncConcStatus()` reconciles the two:

- a spell running and a linked row → re-point it and re-describe it (`concStatusDesc()`:
  "Concentrating on Hex (level 1). Clearing this condition ends the spell.");
- a spell running and no linked row → **adopt** a hand-typed "Concentrating" if there is one (its
  notes kept unless empty), otherwise add a row with `effects: []`;
- no spell running → delete the linked row.

It runs from `castSpell()` (after the "end X and concentrate on Y instead?" confirm has dropped the
old spell), from `maybeExpire()` when a duration runs out and the player ends it, from
`endActiveSpell()`, from spell deletion in `90-boot.js`, and from `renderAll()` before anything
draws — which is how an older sheet, or one whose spell ended by a route the mirror missed, loads
consistent.

**The other direction.** Deleting the row confirms with the spell's name, then
`endConcentration()` removes the concentration spell and every `concId` row. Toggling it to Cleared
goes through `endConcFromStatus()`, which asks "End concentration on X? The spell ends too." The
status form carries `concId` across its rebuild, and unticking "Active now" there ends it too.

**The Spells-tab mirror.** `#concCard` sits above Active Spells. `renderConcCard()` shows it only
while a linked row exists and draws that row with the same `statusRowHTML()`. It is called from
inside `renderStatuses()`, and the row's controls are delegated from `document`, so toggle, edit
and delete work identically on either tab. It is not a note-bearing card.

## Rules that must hold

- **One fact, one store.** Concentration lives on the active spell (`a.conc`); the status only
  mirrors it. Nothing may be kept in agreement between two records that can both claim to be true.
- **Match on `concId`, never on the name.** A condition the player typed "Concentrating" themselves
  is not the linked row. `sheet.js` asserts that a row with the name but no `concId` is not found.
- **Anything that ends an active spell must reconcile** — call `syncConcStatus()` (or
  `endConcentration()`) and redraw the statuses. `maybeExpire()` redraws them itself so every
  `bumpActive()` caller is covered.
- **`renderAll()` reconciles before drawing**, ahead of `renderPortrait()`; `rules-data.js` guards
  the order.
- **A form that rebuilds a status must carry `concId`.** Losing it stops the condition ending the
  spell, and nothing on screen says why.
- **The Concentrating row has no effects.** Its rules — a Constitution save on damage, one spell at a
  time — are prose; effects are numeric only.
- **The mirror is a view, redrawn from `renderStatuses()`** with the one row builder. No caller has
  to remember to update both.
- **`concId` is optional and additive.** `migrate()` keeps it with no code; a status saved before it
  existed loads untouched.
- **The Concentrating condition is never timed — its spell owns the clock.**
- **The Undo after a condition runs out applies once, and only on its character.**

## Traps

- **The stranded condition.** Adding the row on cast and removing it on End leaves it behind whenever
  the spell ends another way — a second concentration spell replacing it, the duration elapsing, the
  spell being deleted, or a sheet saved mid-concentration before the feature existed. The reconcile
  is the fix; the add/remove shape is the trap.
- **A form rebuild drops what the form doesn't ask about** — here `concId`, as it was `src`,
  `origin` and `fav` elsewhere. `rules-data.js` has a source guard on the status form's save.
- **The stub DOM cannot click.** The three handlers are covered by wiring guards in `rules-data.js`;
  the logic by checks in `sheet.js` — the first coverage `castSpell()` had.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where concentration is recorded | On the active spell; the status mirrors it by `concId` | Two independent records: both could claim to be true and nothing would keep them in agreement |
| How the two stay in step | A reconcile, `syncConcStatus()`, run from every route that ends a spell and on load | Add on cast, remove on End: strands the condition when the spell ends by a route the adding code never saw |
| How the linked row is found | `concId` | The name: a player's own "Concentrating" row would be mistaken for it |
| A hand-typed "Concentrating" when you cast | Adopted, keeping its notes | Adding a second row (the `addStatusByName()` precedent): two rows both claiming to be the truth |
| Clearing the condition | Asks, then ends the spell | A silent toggle: a lost concentration spell cannot be given back |
| Effects on the Concentrating row | None: its rules are prose, and effects are numeric only | — |
| The Spells-tab copy | The same `statusRowHTML()`, redrawn from `renderStatuses()` | A second, nearly identical row: the obvious thing to drift |
| Where the copy sits | Above Active Spells, where you look when casting the next spell — it tells you what you would drop | — |
| How a duration is entered | A number and a unit (rounds, minutes, hours); blank is untimed | Free text parsed like spell durations: a typo silently makes it untimed. Rounds only: an hour is 600 |
| When the time runs out | It clears itself, with a toast and an Undo | Asking first, as spells do: a dialog in the middle of a fight. Only marking it "expired": the player still has to clear it |
| What moves the clock | The round tracker plus − rd / + rd on the row | The tracker only: a wrong count could be fixed only by editing the duration |
| What the row shows | Time left ("3 rounds left") | Elapsed / duration like Active Spells ("0:18 / 1:00"): not the number you act on |
| An item's Use applying a timed condition | Not now: item-applied conditions stay untimed | A duration on the item form's applied status: more surface than this release needs |
| Reactivating a cleared timed condition | Restarts its full duration | Resuming the time it had left: not what happens at the table |

## Open

- Nothing prompts a concentration save when you take damage; `adjustHP()` does not look at
  concentration.
- Conditions are on/off with optional numeric effects: exhaustion levels, advantage and the like
  stay as notes and glossary text, by design. See [Known issues](../roadmap/known-issues.md).
- Rests do not move condition clocks (nor spell clocks).
- An item's Use applies an untimed condition.

## History

- 2026-08-17 — casting a concentration spell adds a linked Concentrating condition; clearing or
  removing it ends the spell. → ledger L2893, #37
- 2026-08-18 — the Concentrating row mirrored onto the Spells tab, above Active Spells.
  → ledger L3151
- 2026-10-06 — Timed conditions: a duration in rounds, minutes or hours, counted down by the round
  tracker, clearing itself with an Undo. → ledger L5031, #55
