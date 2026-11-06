# Vitals pencil and the HP dialog — design

**Status:** approved 2026-11-06 (Mike) · wave 1 of [1.9.1](../wiki/roadmap/1.9.1.md), the Vitals & HP worktree
**Issues:** #115 (Vitals edit toggle) → #112 (HP input fiddly) → #113 (HP display off centre, rides
along). One branch, built in that order.
Read [Vitals & rest](../wiki/features/vitals-and-rest.md), the [edit-toggle spec](1.9.0/2026-10-19-edit-toggle-design.md)
and [Character building](../wiki/features/character-building.md) (the level-up's hit points) first.

---

## 1. What it is

**#115.** The Vitals rail gets the same pencil every list card has. Unlocked, the portrait's add and
remove buttons show and Max HP can be changed. Locked, both are gone. The small padlock beside the
"Max" label is removed. Every sheet opens unlocked.

**#112.** On a touchscreen, tapping the HP bar opens a **Hit points** dialog: type an amount, then
tap **Damage**, **Heal** or **Temp**. A phone's keypad hides the minus sign behind other keyboards,
so nothing in the dialog needs one. On desktop the bar keeps its type-in numbers. The − and + buttons
stay everywhere.

**#113.** The bar's numbers and the − and + glyphs sit centred, horizontally and vertically.

Why: the portrait buttons and the padlock clutter the rail (#115), and three small text boxes inside
a bar are fiddly under a finger (#112).

## 2. Decisions

Settled with Mike: #115's default on 2026-11-05, the rest on 2026-11-06 (this brainstorm, with
mockups).

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Does Vitals start locked? | **Unlocked**, like every other card's pencil (Mike) | Locked, reusing `hp.locked` (the lean offered): it keeps the 1.7-era "Max HP locked by default", but hides Add portrait on a new character and makes Vitals the one card whose pencil works backwards |
| 2 | What the pencil covers | **The portrait's add and remove buttons, and Max HP.** Current, Temp, −/+, death saves, hit dice, Size and the badges work either way. *(Since #130: it also locks how AC is set, the Armor Class window's Calculated / Flat switch and Flat box; the AC badge still opens its window, so "the badges work either way" stays true of Init, Speed and Prof. See the armour & attack numbers spec, decision 7.)* | Hiding more: those are play controls |
| 3 | Existing sheets | **All open unlocked.** Today every sheet's Max is locked because that is the default; a deliberate lock can't be told from it, so the padlock's state is not carried over | Carrying `hp.locked` over: every sheet would open locked, against decision 1 |
| 4 | Level-up | **Unchanged in effect:** a level-up (and Add class) unlocks Vitals so the new total can be typed, and the hit-points step's Done puts it back as it was | Leaving a locked Vitals locked: the level-up's "type it yourself" fallback would have nowhere to type |
| 5 | Combat view | **The same pencil**, because it is the same card moved | — |
| 6 | How HP is typed on a touchscreen | **Tapping the bar opens a dialog** (Mike) | Typing into the bar: the issue |
| 7 | And on desktop | **The bar keeps its type-in numbers**, −7 and +4 included (Mike) | The dialog everywhere: slower with a keyboard |
| 8 | What "touchscreen" means | **The device's primary pointer is coarse** (phones and tablets), not the window's width (Mike: "any touchscreen, phone or tablet"); a touchscreen laptop counts as desktop | By width: a landscape tablet is as wide as a laptop, and a narrowed laptop window has a mouse |
| 9 | The − and + buttons | **Stay, on every device** (Mike) | Dropping them for the dialog: ±1 is the quickest tap there is |
| 10 | What the dialog holds | **One amount, then Damage, Heal or Temp** (mockup C, Mike: "typing minus on mobile can be tough and hidden behind different keyboards"), with **Set exactly** in a fold | A: the bar's three boxes, bigger, signed entry: needs a minus for damage. B: Adjust coins' shape, changes only: needs a minus, and setting an exact number means working out the difference |
| 11 | Temp | **Replaces** what you have: under the rules temp HP don't stack and you choose which to keep | Adding: against the rules |
| 12 | Undo | **None.** A mis-tap is fixed by reopening; a toast with Undo is #175 (1.9.2) | — |
| 13 | Coins | **Their own issue, 1.9.2**, the same "amount, then Gain or Spend" idea for the Coins card and Adjust coins; drafted for Mike's yes, not built here | In this branch: Adjust coins changes several coins at once and needs its own design |

## 3. Data

- **The lock is `character.editHide.vitals`**, the existing per-card map (`true` = locked; absent or
  anything else = unlocked). `vitals` joins `EDIT_CARDS` in `87-notes.js`. Nothing new in
  `blankChar()` or `migrate()`: `editHide` already defaults to `{}` and is shape-guarded.
- **`hp.locked` is retired.** Nothing reads or writes it. It is removed from `blankChar()`'s `hp`;
  an old save's value survives `migrate()` (which keeps every field) and is ignored, as
  `hdStyle` is. Its comment in `00-constants.js` goes.
- No other field. The dialog holds no state.

## 4. The Vitals pencil (#115)

- **Markup.** The `[data-hplock]` button goes from `00-sheet.html`, along with its CSS
  (`.hp-lock`, `.hp-maxlbl`'s padlock spacing, the `.hd-mode,.hp-lock` shared rule). The two
  portrait buttons (`#btnPortrait`, `#btnPortraitDel`) gain the class `ed`, so `.ed-off .ed` hides
  them in CSS, the edit-toggle spec's mechanism (its decision 6). `renderEditToggles()` puts the
  pencil in `.rail>.label` as for any card.
- **One place reads the lock:** a helper (say `vitalsLocked(c)`, `= editHidden(c,"vitals")`). It
  replaces every `character.hp.locked!==false` read: `renderHP()` (Max `readOnly`), the second
  layer in `applyHPInput()` (which still refuses Max while locked, because `readOnly` does not stop
  a paste), and the dialog's Max row (§5).
- **One place sets it from code:** a helper (say `setVitalsLocked(bool)`) that writes the flag
  through `setEditHidden()`, toggles `ed-off` on the card, repaints the pencil
  (`paintEditToggle()`) and calls `renderHP()`. The level-up code uses it: `hpChoice()` records
  `_wasLocked` from `vitalsLocked()`; the three `character.hp.locked=false` writes in
  `56-class.js` (two in `addClass()`, one in `doLevelUp()`) and `commitHPChoice()`'s relock go
  through the helper.
- **A pencil tap** on Vitals must also repaint Max's `readOnly`: `toggleEditCard()` calls
  `renderHP()` for `vitals`, the way it calls `renderJournal()` for `journal`.
- **Its words** (my call): title "Lock Vitals" while unlocked and "Unlock Vitals" while locked,
  where other cards say "Hide/Show edit buttons", because this one also locks a number. Its
  aria-label says what it does: "Lock Vitals — hides the portrait buttons and locks Max HP".
- **The padlock's click handler** in `90-boot.js` goes. The automatic writers (`seedLevel1HP()`,
  `resyncLevel1HP()`, `removeClass()`'s un-seed, the level-up step) still write `hp.max` directly
  and bypass the lock, as now (the wiki's "Rules that must hold").
- **Wording that names the padlock** changes: the Max box's aria-label, `LU_HP_CLOSE`'s "Max HP is
  unlocked" (still true: say Vitals is unlocked), and code comments.

## 5. The Hit points dialog (#112)

**When it opens.** On a touchscreen (`matchMedia("(pointer:coarse)")`, read at tap time), a tap
anywhere on `.hp-bar` opens it, on the Sheet and in the combat view. The tap must not bring up the
keyboard in the bar's boxes: on a touchscreen the dialog is the only way to type HP. With a mouse,
nothing changes: tapping a number focuses it, as now. The −/+ buttons are outside the bar and work
on both.

**What it shows** (mockup C; screens kept in the brainstorm, described here):

```
Hit points                      26 / 38 · temp 3
[        How much?        ]       ← focused on open; digits-only keypad
[ Damage ] [  Heal  ] [  Temp  ]  ← greyed until a whole number ≥ 1
           ↓ after typing 7
[ Damage   ] [ Heal  ] [ Temp   ]
[ → 22,    ] [ → 33  ] [ 3 → 7  ]
[  no temp ]
▸ Set exactly
```

- **The amount box:** `type="text" inputmode="numeric"`, focused on open. A whole number from 1
  up; anything else keeps the three buttons greyed (spaces and commas may be stripped, as Adjust
  coins does).
- **Each button shows what it would do**, live, and one tap applies it and closes the dialog:
  - **Damage** → `adjustHP(-n)`: temp first, the rest off Current, floored at 0. Its line shows
    the resulting Current and Temp ("→ 22, no temp"; "temp 3 → 1" when Temp soaks it all).
  - **Heal** → `adjustHP(+n)`: Current only, capped at the effective maximum by `clampHP()`.
  - **Temp** → `hp.temp = n`, replacing what is there (decision 11), then `clampHP()`. Its line
    shows "3 → 7" (or "→ 7" with none).
  - Then `renderHP()`, `scheduleSave()`, close. No toast (the bar shows the result).
- **The header** shows Current / the effective maximum (`effMaxHP()`, which `#maxNote` explains
  when an effect applies) · temp, so the player sees what they are changing.
- **Set exactly**, a fold closed by default: **Current**, **Max** (only while Vitals is unlocked)
  and **Temp**, filled in with what is there now, then Cancel and Apply. Plain whole numbers
  (`inputmode="numeric"`), blank Temp meaning none (my call: no signed entry here, so there is one
  grammar per box: the bar's on desktop, this one on touch). Apply writes all of them, then
  `clampHP()`, `renderHP()`, `recompute()` if Max changed, and saves.
- **The logic lives in `66-coins-hp.js`**, not `90-boot.js` (the harness drops boot). The preview
  is a pure function the tests can call without a sheet (say `hpQuick(hp, effMax, n)` →
  `{damage:{cur,temp}, heal:{cur}, temp:{temp}}`), and the amount check is another
  (whole number ≥ 1, else `null`). `adjustHP()` stays the one damage path.
- **Keyboard and screen readers:** on a touchscreen the bar acts as one button (an accessible name
  like "Hit points 26 of 38, temp 3 — change"). The dialog uses `openModal()`, so Escape and the
  dismiss behave as every other window.

## 6. Centring (#113)

The "26 / 38" group sits in the middle of the bar, the temp figure doesn't push it off centre, and
the numbers are vertically centred in the bar's 38px. The − and + glyphs are centred in their
buttons on both axes (font glyphs sit high; an SVG stroke like the portrait buttons', or flex
centring with a fixed line box, both work). Checked by screenshot in both skins, light and dark, at
desktop and phone widths, with one, two and three digits.

**When it doesn't fit** (my call, for Mike to check; raised by the builder check). At 360–375px the
bar is about 135–150px wide, and today's fixed-width boxes (3.1ch each, temp 4.6ch) make the group
about 78px and temp about 40px, so a centred group and temp can collide. First, numbers sized to
their content (spans on touch, inputs sized to their value on desktop) and a smaller size at narrow
widths. If temp still collides, **temp leaves the bar at those widths only**, to the right of the
"Hit points" label ("+3 temp"), on touch and desktop alike; the bar keeps "26 / 38" centred.
Rejected: shrinking the numbers further (unreadable at the table); relaxing centring while temp
shows (the issue).

## 7. Tests

- **Rewrite, don't delete,** the padlock's checks (line numbers at 9caff27):
  - `sheet.js` ≈ 297–344, about twelve lock checks, several asserting the old default
    (`blankChar().hp.locked===true`, "a missing lock flag means locked", "a sheet saved before the
    lock comes back locked"). **Inverted in place**, not appended: they are the lock's checks and
    nothing else edits those lines. The fixture at ≈ 433 drops its `locked:false`.
  - `char-update.js`'s level-up lock checks (≈ 961–1041, 1498–1506, 1874–1935) assert the same
    behaviour on `editHide.vitals`.
  - `rules-data.js`'s padlock block (≈ 1845–1898, including the `doLevelUp`, `hpChoice` and
    `commitHPChoice` source checks at 1892–1898) becomes: no `data-hplock` left in the template,
    `vitals` in `EDIT_CARDS`, both portrait buttons carry `ed`, `renderHP()` and the level-up code
    read and set the lock through the helpers, the automatic writers still don't touch it.
- **A new block at the end of `sheet.js`** (the roadmap's rule for that file): an old save with
  `hp.locked:true` opens unlocked; `applyHPInput()` refuses Max while Vitals is locked and takes it
  while unlocked; the preview function (damage soaks temp first, overflow off Current, floor at 0;
  heal capped at the effective max; temp replaces, higher or lower); the amount check (0, blank,
  "-3", "1.5", "abc" refused; "7", " 12 " taken); Set exactly's parse.
- A throwaway Node check in the scratchpad for the pure functions, per CLAUDE.md.

## 8. Docs, notes, screenshots

- **Wiki:** [Vitals & rest](../wiki/features/vitals-and-rest.md) (the lock, typing HP, the dialog,
  Decisions rows "Where the lock flag lives" and "Whether the padlock confirms" replaced, Traps),
  [Character building](../wiki/features/character-building.md) (what a level-up unlocks),
  [Sections & layout](../wiki/ui/sections-and-layout.md) and anything else that lists `EDIT_CARDS`,
  [Character model](../wiki/architecture/character-model.md) (the `hp` shape, the `!== false` trap,
  the "Where the Max HP lock lives" decision) and [Decisions](../wiki/decisions.md) (its two
  lock rows). A ledger entry; History lines citing it.
- **[Smoke list](../qa/smoke.md)** line 23, "the Max padlock stops Max from moving": Mike's file
  (#150), so the branch proposes the new line ("locking Vitals stops Max from moving; on a
  touchscreen the HP bar opens Hit points") and he says yes.
- **`UNRELEASED.md`**, worded for players (drafts):
  - Vitals has an edit pencil like the other cards. Tap it to lock Vitals: the portrait buttons
    hide and Max HP can't be changed. The small padlock is gone, and Max HP can be typed into again
    until you lock Vitals.
  - On a phone or tablet, tapping the HP bar opens a Hit points window: type how much, then tap
    Damage, Heal or Temp. No minus sign needed. "Set exactly" underneath types the numbers
    straight in.
  - The hit-point numbers and the − and + signs now sit in the middle of the bar and their buttons.
- **Screenshots** to `.claude/qa/in-progress/115-vitals-hp/`: the Sheet and Combat tabs before and
  after, both skins; the rail locked and unlocked; the dialog opened, typed in and with Set exactly
  open, at phone width with a coarse pointer. The project's Playwright MCP may not emulate a coarse
  pointer: if it can't, drive the dialog by forcing the touch path in the page and say so plainly.
  The real phone pass is Mike's.

## 9. Out of scope

- **Coins** (decision 13): a separate issue, drafted for Mike's yes.
- **An Undo toast** for the dialog's taps (#175).
- **HP in the initiative tracker** (#163, wave 2), the hit-dice bar, death saves, rests.
- **The bar's type-in boxes on desktop**: unchanged, beyond centring.

## 10. Left to the builder

The exact markup and class names, the preview's wording within the shapes in §5, how the bar's
boxes are kept from raising the keyboard on a touchscreen (`readOnly` with `inputmode="none"`, or
spans in place of inputs, as long as desktop is untouched and the ids `renderHP()` paints still
exist), and the centring technique.
