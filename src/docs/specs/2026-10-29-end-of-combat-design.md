# End of combat: design

**Status:** approved in conversation 2026-10-29. It is wave 4 of [1.9.0](../wiki/roadmap/1.9.0.md), the
capstone.
**Issue:** #105 (Combat End Dialog). One branch, `issue/105-end-of-combat`.
**Mockup:** `.superpowers/brainstorm/55197-1793279092/content/end-combat-layout.html`. Layout B was chosen
(folded sections), with the window opening after the fight has ended rather than before (§2, decision 1).

**Read first:**
- [Combat view](../wiki/features/combat-view.md): `combatStart()`, `combatEnd()` and what it hands back,
  `endCombatAsk()`, the initiative tracker.
- [Ammunition](../wiki/features/ammunition.md): the recovery rule, `applyAmmoRecovery()`, its Undo, the
  per-fight log lines.
- [Inventory](../wiki/features/inventory.md): the trade window (`openTrade(opts)` and its `{with, give, get}`
  seam, built for this) and the inventory log.
- [Journal](../wiki/features/journal.md): pages, tickable checkboxes, tracker tiles.
- [Shell](../wiki/ui/shell.md): the modal, `askConfirm()`, the dismiss guard.

---

## 1. What it is

When a player ends a fight, Fieldbook asks first, then ends it and opens one window that wraps the fight
up: what happened, the ammunition that came back, experience, loot, and anything the player marked to
see after every fight. Every section can be skipped; Done closes the window.

Today End combat asks with the browser's `confirm("End combat at round N?")`, ends the fight, writes one
inventory-log line per kind of ammunition, and recovers ammunition with a toast and an Undo. Nothing
else happens at the end of a fight.

## 2. Decisions

Mike's, in conversation, 2026-10-29. The 1.9.0 roadmap's two #105 rows (one screen with sections; a
"Show after combat" switch) stand, refined as below.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | When the window opens | **After the fight has ended.** End combat asks "are you sure?" in the app's warning window; confirming ends the fight and opens the window | Opening the window with the fight still running, End combat as its last button (first chosen, then changed by Mike): the question and the wrap-up are different moments |
| 2 | What the summary shows | **What the app already knows**: rounds, time (6 seconds a round), the combatants with the fallen struck through, and the ammunition line | HP, slots and resources spent this fight: a snapshot at Start for a recap nothing acts on; rests restore them |
| 3 | The XP box | **One box, with a "Split among N" switch** (N = the Party roster plus this character, rounded down), off by default and remembered per character. If the XP reaches a level, the level-up opens after Done | A plain box: the split is the common table rule and the roster already knows N |
| 4 | Layout | **Folded sections**: the summary open, each other section a one-line row that opens on a tap and remembers being open, per character | Everything open in one scroll: long after every fight |

## 3. The flow

1. **End combat** (`#cvEnd`, the combat view's head; the only entry point) calls `endCombatAsk()`, which
   now asks through `askConfirm()`:
   - title "End combat?";
   - message "End the fight at round 5? Ammunition comes back under your recovery rule." The second
     sentence appears only when something was fired since Start and the rule is not None;
   - buttons "Keep fighting" (safe) and "End combat".
   Keep fighting changes nothing. This is the one `confirm()` #105 converts; the rest are #126's.
2. **On End combat**, in this order, as today: the per-kind inventory-log lines are written, `ammoFight`
   is cleared, `combatEnd()` ends the fight and hands back `{rounds, sec, combatants}`, the chrome is
   redrawn, the save is scheduled, and ammunition recovery is applied, **quietly**: no toast, its result
   and Undo handed to the window (§5).
3. **The End of combat window** opens (§4).
4. **Done** adds the XP (§4.3), closes the window, and opens the level-up if the XP reached a level.
   Closing with × or Escape while XP is typed asks, through the dismiss guard, "Add 112 XP?" (OK adds
   it and closes; Cancel closes without it). With no XP typed, × and Escape simply close.

## 4. The window

`openModal()`, titled **"End of combat"**, with the time under the title: "Round 5 · 30 seconds"
(`fmtCombatTime()`). Wide on desktop. A section with nothing to show is left out entirely, so a quiet
fight is a short window.

The **summary** is always open. Every other section is a folded row: a label and a one-line status,
opening on a tap. Which rows are open is remembered per character (`endCombatOpen`, §6); the first time,
every row is folded.

### 4.1 Summary

A chip per combatant from `combatEnd()`'s `combatants`, in initiative order, the fallen
(`combatantDead()`) struck through with "fell" in their accessible name. This character is not listed. With
no combatants (the initiative tracker unused), the summary is just the time.

### 4.2 Ammunition

Shown when anything was fired since Start. Row status and body, per kind: "Arrows: 9 fired, 4 came
back" (the log line's own wording, `ammoLogTitle()`). With the rule None: "Arrows: 9 fired, none come
back (recovery: None)". The body has **Undo recovery**, which does what the toast's Undo does today
(`undoRecoveryTap()`: puts the recovered ammunition back as spent and corrects the log lines' `back`),
and then reads "Recovery undone". It is offered only while the window is open.

### 4.3 Experience

Shown when the character levels by XP (`advancementOf(c)==="xp"`); hidden for milestone. Row status:
"XP 6,350 / 6,500" (`xpProgress()`), or "+112 XP" once something is typed.
- A whole-number box, 0 to 1,000,000.
- **Split among N**, a switch, shown only when the Party roster has at least one member. On: the line
  reads "450 ÷ 4 = 112 each" and 112 is what Done adds. Its state is `xpSplit`, saved on change.
- When the total after adding would reach a level the character hasn't reached yet, the section says
  "Level 6 ready — the level-up opens when you press Done."

Done writes `character.xp = xpNumber(character.xp) + n`. If `xpProgress()` was not `ready` before and is
after, the level-up opens next, through the same path as the level ring's button (`doLevelUp()`).

### 4.4 Loot

Always shown. Row status: "Open trade…". The body says "Coins and items from the fight go through a trade,
so they're in your inventory log", and an **Open trade** button calls
`openTrade({with: <name>, onClose: <reopen>})`:
- `<name>` is the fallen combatants' names joined with commas ("Goblin 1, Bugbear"), or "Combat loot" when
  none fell or there were no combatants. The trade window lets the player edit it, as today.
- The trade window replaces this one (the modal has one layer). When it closes, by Complete Trade or by
  cancelling, `onClose` reopens the End of combat window with its state intact: typed XP, the split, open
  rows, Undo still offered or done. After a completed trade the Loot row reads "Traded with Goblin 1,
  Bugbear"; another trade is allowed.

The window's state lives in memory (`_endFight`), not on the character, tied to the character's id. It
is dropped on Done, on ×/Escape, and if the character changes.

### 4.5 After combat

Shown when at least one open tracker or one journal page has `afterCombat` on, and the Journal tab is not
hidden (`isTabHidden("journal")`, #52). Row status: "2 trackers · 1 page".
- **Trackers**: the open ones (not closed), as their tiles (`trackerRowHTML()`), live: + and − change the
  counter there, exactly as on the Journal tab, and the tab's copy follows. Hidden when the sheet's
  trackers are switched off (`showTrackers === false`).
- **Pages**: each flagged page's title and its rendered text (`noteHTML()`), with its checkboxes tickable
  there; a tick rewrites that page's line as on the Journal tab. Long pages scroll inside the section.
Nothing changes on its own: a tracker is never bumped and a box never ticked by ending a fight.

## 5. Ammunition recovery, quietly

`applyAmmoRecovery(opts)` gains `opts.quiet`. Quiet, it applies the rule exactly as now and returns
`{lines, undo}` (what came back per kind, and a function that undoes it) instead of showing the toast.
Without `quiet` it behaves as today. The undo is the toast's own logic (`undoRecoveryTap()`), moved behind
the returned function so both callers share it; nothing about what is recovered or logged changes. The
pending #104 decisions (End combat settling every outstanding count; old firearm sheets; a stack deleted
under Undo) are untouched by this and stay open.

## 6. Data

New character fields, each optional, defaulted in `blankChar()`, cleaned by `migrate()` (never a
whitelist), and round-trip tested:

| Field | Shape | Default | migrate() |
|---|---|---|---|
| `xpSplit` | boolean | `false` | anything not `true` → `false` |
| `endCombatOpen` | `{ammo?, xp?, loot?, after?: true}` | `{}` | not a plain object → `{}`; non-`true` values dropped |
| `trackers[i].afterCombat` | boolean, absent when off | absent | kept only when `true` |
| `journal[i].afterCombat` | boolean, absent when off | absent | kept only when `true` |

**The switch.** "Show after combat" is a switch in the tracker's edit window and in the page's edit
window, beside the existing fields. Off by default.

**Party size** for the split: `character.party` (the #91 roster) length plus one.

## 7. Code

- **New fragment `src/js/87-combat-end.js`**, after `87-journal.js` and `87-trackers.js` in
  `src/manifest.json` (it calls their renderers), before `88-settings.js`: `openEndOfCombat(result)`,
  the window's HTML per section, `_endFight`, the fold toggles, Done, the dismiss guard, the reopen hook.
- **`87-combat.js` `endCombatAsk()`**: async, `askConfirm()`; after ending, `applyAmmoRecovery({quiet:true})`
  and `openEndOfCombat({...combatEnd's result, ammo})`.
- **`62-ammo.js` `applyAmmoRecovery()`**: the `quiet` option and the returned `{lines, undo}` (§5).
- **`67-trade.js` `openTrade()`**: an optional `onClose`, run once when the trade window closes, however
  it closes.
- **`87-trackers.js`**: `trkPatchRow()` and the tracker re-render patch **every** copy of a tile in the
  page (the Journal tab's and the window's), not the first one found. The edit window gains the switch.
- **`87-journal.js`**: the page editor gains the switch.
- **`90-boot.js`**: the checkbox click dispatcher (`data-ck`) gains a branch for a page shown in the End of
  combat window (it falls through to section notes today); the fold rows and Done are wired in the new
  fragment.
- **`00-constants.js` `blankChar()`, `71-char-io.js` `migrate()`**: §6.
- **CSS** in `50-modal.css` (window) and `47-journal.css` only if a tile needs it inside a modal; tokens
  only, both skins.

## 8. Edge cases

- **No initiative used**: summary is just the time; Loot's party is "Combat loot".
- **Nothing fired**: no Ammunition row; the warning's second sentence is left out.
- **Recovery rule None**: the Ammunition row says none come back; no Undo.
- **Milestone character**: no Experience row; nothing about XP anywhere in the window.
- **No Party roster**: no split switch; the box adds what is typed.
- **XP field holding text** (`character.xp` is free text): `xpNumber()` reads it; Done writes a number.
- **A trade cancelled**: the window comes back, Loot unchanged, nothing logged.
- **The character changes** (home, another sheet) while the window or its trade is open: `_endFight` is
  dropped and nothing reopens.
- **A reload** with the window open: the fight already ended and saved; typed XP is lost, as any unsaved
  form is.
- **A hidden Journal tab**: no After combat row. A closed tracker or an unflagged page never shows.
- **Undo level-up** settling on `closeModal()`: the window's closing goes through `closeModal()` like
  every modal, which is harmless (§5a of the feat spec).
- **End combat pressed twice**: the warning's own guard (one at a time) and the button's re-entry guard
  mean one end.

## 9. Testing

`src/tests/sheet.js` (harness `loadApp`), new checks for:
- the warning: its text with and without ammunition; Keep fighting changes nothing (still in combat,
  `ammoSpent` untouched, no log lines); End combat ends it.
- `applyAmmoRecovery({quiet:true})`: same recovery and log as today, no toast, `{lines, undo}` returned;
  `undo` restores exactly what the toast's Undo restores.
- the window: sections present/absent per §8; the summary chips and struck-through fallen; the time line.
- XP: plain add; split on/off and its rounding; party size; milestone hides it; Done writes the number;
  the level-up opens only when `ready` flips; the dismiss guard's "Add N XP?" both ways.
- Loot: `openTrade` gets the right `with`; `onClose` reopens with state intact after Complete and after
  cancel; a character change drops it.
- After combat: flagged open trackers and pages only; hidden Journal tab hides it; + in the window
  changes the counter and both copies of the tile; a tick in the window rewrites the page's line.
- Data: `blankChar()` defaults, `migrate()` cleaning of each field, save → load round trip.

Throwaway Node checks for the split arithmetic and the `with` name. Screenshots via the project Playwright
MCP (`mcp__playwright__*`), both skins, 1280 and 390: the warning, the window folded, each section open,
the window back after a trade; before and after for the combat view's End flow. Drive one whole fight
end (fire, End combat, Undo recovery, split XP, open trade and come back, tick a page, + a tracker, Done
into a level-up) and say what was driven and what wasn't.

## 10. Docs

- Ledger entry; wiki: combat-view.md (End combat and the window), ammunition.md (quiet recovery, Undo in
  the window), journal.md (Show after combat), inventory.md (`onClose`), shell.md if `askConfirm()` gains
  a user, character-model.md (the four fields), decisions.md (§2), known-issues.md, the 1.9.0 roadmap
  page (#105 done; its two rows updated to match §2).
- `UNRELEASED.md`: one bullet for the window, one for "Show after combat".

## 11. Out of scope

- Active spells, conditions and concentration at the end of a fight: untouched, as today.
- HP, spell slot and resource recaps (§2, decision 2).
- The app's other `confirm()` boxes (#126).
- The pending #104 ammunition decisions.
- Party members' XP: the split tells this character its share; other sheets are their own.
