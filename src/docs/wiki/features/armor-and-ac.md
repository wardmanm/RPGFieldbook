# Armor & AC

How the Armor Class in Vitals is worked out, and how a player can set it by hand. **Calculated**
(the default): equipped armor sets a **base**, its AC plus the character's Dexterity modifier
capped by the kind of armor, the best equipped shield adds its bonus, and any `ac` effects stack on
top. **Flat**: the player types the AC from their paper sheet, and only what comes and goes (a
status, a summoned familiar) adds to it. Armor is an inventory item like any other; what makes it
armor is either a structured `armor` field or an "AC …" line in its description, which the app
parses.

**Code:** `itemArmor()`, `armorKindOf()`, `armorAC()`, `acTotal()`, `acEffects()`, `acIsFlat()`,
`acFlatValue()`, `acFlatSeed()`, `isEquippable()`, `ARMOR_KINDS`, `ARMOR_DEXCAP` in
`25-origins-items.js` · `recompute()` in `10-compute.js` · `openStatBreakdown()`, `openACWindow()`,
`acWindowHTML()`, `setACMode()`, `setACFlat()`, `openItemForm()` in `80-modal-forms.js` · `youAC()`
in `87-initiative.js` · `invSection()` in `40-sheet.js` · **Data:** `character.acMode` and
`character.ac` ([Character model](../architecture/character-model.md)); the item
`armor` field and the description convention, [rules-schema §6.8](../../../../docs/rules-schema.md) ·
**Tests:** `sheet.js` · **See also:** [Inventory](inventory.md),
[Computed stats & effects](../architecture/computed-stats-and-effects.md),
[Vitals & rest](vitals-and-rest.md)

## How it works

**What counts as armor.** `itemArmor(it)` returns a descriptor or `null`:

1. A structured `it.armor` object wins, as is: `{kind:"body", base, dexCap}` or
   `{kind:"shield", bonus}`. No pack item ships one; the item form writes it.
2. Otherwise the item must look like armor — `category` contains "armor", `type` contains armor or
   shield, or the description has a whole-word `AC` — and then:
   - **Shield** when `type` or `name` contains "shield": the bonus is `AC +N` from the description,
     default 2.
   - **Body armor** needs `AC N` in the description. `+ Dex` present: `max N` caps it (medium),
     no `max` means uncapped (light, `dexCap: null`); no `+ Dex` means heavy (`dexCap: 0`).

**The four kinds.** `ARMOR_KINDS` lists light / medium / heavy / shield for the form;
`ARMOR_DEXCAP` is `{light:null, medium:2, heavy:0}` — `null` means uncapped, 0 means none.
`armorKindOf()` turns a parsed body descriptor back into a kind, so a pack item opens on the right one.

**Calculated.** `armorAC(c)` returns `{base, hasArmor, shield, body, dex, bodyName, shieldName,
shieldCount}`:

- **Dex** is the modifier of the *final* score, `abilFinal("dex")`, so ability effects count.
- **Body**: of the equipped body armors, the one with the highest base wins; base + Dex, capped by
  its `dexCap`.
- **No body armor**: 10 + Dex. `character.ac` is never read here.
- **Shields**: only the **best** equipped shield counts (`shield` is its bonus, not a sum);
  `shieldCount` says how many are equipped. The names are the winning items', for the AC window.

**Flat.** `character.acMode` is `"calc"` (the default) or `"flat"`, and `character.ac` is the Flat
number only: a whole number, or `""` until one is set. `acIsFlat()` is true only when the mode is
Flat *and* `acFlatValue()` reads a whole number, so the mode and the number can never disagree on
screen.

**The total.** `acTotal(c)` is the one place AC is added up: the Flat number or `armorAC(c).base`,
plus `acEffects(c)`, which is every `ac` contribution in Calculated and, in Flat, only those whose
kind is `status` or `familiar` ([Computed stats & effects](../architecture/computed-stats-and-effects.md)):
the typed number already counts the armor, shields, items and features. Casting a spell adds no AC
by itself; the Shield spell counts in either mode through a status the player gives `ac +5`. The
rail (`recompute()`), the initiative tracker (`youAC()`) and the AC window read `acTotal()`; print
reads `#acDisp`'s text. `recompute()` marks the number from `acEffects()` alone, so in Flat an
item's −1 is neither added nor red. In Flat the shield (`#acShield`) takes the `flat` class, which
draws its rim in `--rail-flat`, and its label (`#acLbl`) reads FLAT for AC; the combat view's copy is
the same element. Each palette's `--rail-flat` differs from its `--rail-line` (default light gold
`#d8a544`, default dark cream `#efe6d0`, classic `#dcae4e`).

**The Armor Class window.** Tapping AC runs `openStatBreakdown("ac")`, which opens
`openACWindow()`: a Calculated | Flat switch (`.seg`, `data-acmode`), then `acWindowHTML(c)`'s lines
and a total (`#acTotal`, the number on the sheet).

- **Calculated**: "Armor 15 + DEX +2" (or "10 + DEX +3"), the shield on its own line by name, "Only
  your best shield counts (N equipped)." when there are two or more, each `ac` effect by source (red
  when negative), the total.
- **Flat**: "Your AC" in a box (`#acFlat`, `inputmode="numeric"`, committed on change), a struck
  line naming what no longer adds (the worn armor, the best shield, each item or feature `ac`
  effect; "Armor, shields, items and features" when there are none; "doesn't add … counts it" for
  one name, "don't add … counts them" for more), each status or familiar `ac` effect, the total.
- `setACMode()` switches. Switching to Flat with no number fills it with `acFlatSeed()`, the
  Calculated total less the status and familiar effects (never below 0), so the number does not
  jump; going back keeps the number for next time. `setACFlat()` takes a whole number and refuses
  anything else, and the box gets the last number back.
- **Escape keeps a typed number.** Escape closes the window without blurring the box, so its
  `change` never fires; `openACWindow()` registers a dismiss guard (`setDismissGuard()`) that
  commits a whole number still in the box, and anything else closes as it is. × and the backdrop
  blur the box first, so `change` has already committed it and the guard finds nothing to do.
- **The Vitals lock** ([Vitals & rest](vitals-and-rest.md)): while `vitalsLocked(character)`,
  `setACMode()` and `setACFlat()` refuse, and the window says "Vitals is locked — unlock it to
  change your AC" with both halves of the switch and the box disabled. The number still shows and
  counts, Calculated or Flat; only how it is set is locked, as for Max HP.

**Equipping.** `isEquippable()` is true for anything `itemArmor()` recognises, so parsed armor gets an
Equip control even with no effects. Only equipped items count — both for the base and for their `ac`
effects.

**Magic armor.** The base comes from the armor line; the magic bonus must be an `ac` **effect** on
the item (`{target:"ac", value:1}`), like a Ring of Protection or the Defense fighting style.
Effects are numeric modifiers and never set a base. An effect is on whenever its item is equipped,
so a pack item carries one only for a bonus the book gives all the time (a Dragon Scale Mail's +1,
the Shield of the Cavalier's extra +2). A momentary one stays in the description and never touches
the number: Quarterstaff of the Acrobat's Reaction (+5 against one attack), the Arrow-Catching
Shield's +2 against ranged attacks (its ordinary shield +2 still counts, from its armor line), the
Bracers of Defense's +2 when unarmored, the Rod of Alertness's planted aura. See
[Converter](../data/converter.md) for how the packs tell them apart.

**The item form's Armor toggle.** Beside the Weapon one: Kind, Base AC and Max Dex (which follows the
kind unless typed; blank = as the kind says, `none` or 0 = no Dex), or for a shield an AC bonus
instead. It opens prefilled from `itemArmor(it)`, so a pack item shows "Medium · AC 15 · Max Dex 2";
Insert from rules pack parses the chosen item the same way. Saving writes the structured field — the
prose becomes fields at that moment. With the toggle off, an existing `armor` is carried unchanged.

**Filing.** `invSection()` puts anything `itemArmor()` recognises under Armor.

## Rules that must hold

- **Armor sets a base; effects add to it.** Never express base AC as an effect, and never read magic
  bonuses out of the armor line.
- **One AC function.** Anything that shows AC reads `acTotal()` (or `#acDisp`, which it paints);
  nothing adds `armorAC()` and the effects itself. Four places used to, which is how a fix could
  reach one and miss another.
- **Calculated never reads `character.ac`.** It is the Flat number. An old save that carries one
  opens Calculated, and its number is what Flat shows; opening it Flat would silently stop its
  shield adding.
- **The Vitals lock locks how AC is set.** Both writers (`setACMode()`, `setACFlat()`) check
  `vitalsLocked()` themselves; the disabled controls are not the guard.
- **A Flat AC always has a number.** A blank box is refused, switching fills it, and `migrate()`
  turns `acMode:"flat"` with no whole number into `"calc"`.
- **Only the best shield counts.** The rules allow one.
- **The structured field beats the description.** An item saved through the Armor toggle stops caring
  what its description says: editing "AC 11" to "AC 14" in its text changes nothing. That is
  deliberate — explicit over prose, as `weapon` already behaves.
- **The form carries `armor` across a save** when the toggle is off — the same family of drop that
  cost attacks their `itemId` and spells their `src`.
- **`dexCap` is three-valued**: `null` uncapped, `0` none, a number caps it. A falsy test collapses
  light into heavy.
- **Dex is the final modifier**, including ability effects, so AC tracks a DEX-raising item.
- **An `ac` effect is a standing bonus.** It applies whenever its item is equipped, with no way to
  say "against this attack" or "while unarmored", so a bonus that holds only sometimes is prose
  (#76). `rules-data.js` holds the reviewed list of every pack item allowed one.

## Traps

- **A manual AC with no control (#130).** `armorAC()` read `character.ac` when no body armor was
  worn, though nothing on the sheet could set it; shields were added on top of it, two shields
  added up, and the breakdown read "Base AC 0" for a hand-edited `null` over a computed 10 + Dex.
  The number was added up in four places, so a fix had to reach all four. → L9537
- **No pack item carries the structured field** (31 armor items when measured; still none today).
  Every one states its AC in the description and is parsed, so armor worked invisibly, on prose, and a
  custom item could only be armor by typing the exact incantation. → L3092
- **A Buckler described as `AC +2` is not armor** to the parser: the shield branch keys off "shield"
  in the type or name, and `AC\s*(\d+)` does not match `+2`. It had no AC and no Equip control. The
  form's Shield kind is the fix. → L3092
- **A Reaction that read as AC +5 (#76).** The packs wrote every 5e-tools `bonusAc` as an `ac`
  effect, conditional or not, so equipping Quarterstaff of the Acrobat read AC 17 for AC 12, and
  four other items (Arrow-Catching Shield, Bracers of Defense, Rod of Alertness, Tasha's Teeth of
  Dahlver-Nar) added bonuses the book gives only in a moment. `armorAC()` and `recompute()` were
  right; the data was not. An existing sheet gets the fix through the rules-update tool. → L4502
- **Armor had empty `effects`, so it never showed Equip** and never touched AC, until
  `isEquippable()` learned to ask `itemArmor()`. → L239

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Can AC be typed by hand? (#130) | Yes, "if needed" (Mike) | Removing the hidden manual value: no escape hatch when the app gets it wrong |
| How (#130) | A Calculated / Flat switch in the Armor Class window (Mike: "calculated AC OR flat AC") | A typed base that armour and shields build on: the issue's confusion |
| What adds to Flat (#130) | Only what comes and goes: statuses and a summoned familiar. Armour, shields, items and features do not; casting a spell adds no AC by itself | Nothing adds: a Shield status would not show. Everything adds: a Ring of Protection counted twice |
| An old sheet with a typed `character.ac` (#130) | Opens Calculated, which never reads it; the old number fills the Flat box | Opening it Flat: its shield would stop adding, silently |
| Shields (#130) | Only the best equipped shield counts | Stacking: a bug |
| Showing Flat (#130) | FLAT in place of AC under the number, in every skin, and a `--rail-flat` rim unlike each palette's `--rail-line` | No mark: putting on armour would seem to do nothing. `--rail-accent` for the rim: no change on default dark, red on classic |
| Locking (#130) | The switch and the number follow the Vitals pencil: read-only while it is locked, like Max HP | Always editable: the one rail number left open |
| An empty Flat box (#130) | Not accepted: clearing it puts the last number back, switching to Flat fills it, and `migrate()` turns a numberless Flat into Calculated | Showing 0: an AC of 0 reads as a bug. Falling back silently: the mode and the number disagree |
| Structured field or description when both exist | The field wins — explicit over prose, as `weapon` already behaves | — |
| How a custom item becomes armor | An Armor toggle writing the structured field | Typing the description incantation: nothing in the UI said so |
| What the shield kind shows | A bonus box instead of Base AC and Max Dex | Showing all three: two of them mean nothing for a shield |
| A pack item's AC bonus that holds only sometimes (#76) | Prose in the description, no `ac` effect | An `ac` effect: on at all times while equipped, so a once-per-rest Reaction read as +5 AC |

## Open

- **Unarmored Defense and Mage Armor are not formulas.** They need an `ac` effect, or a Flat AC.
- **Bracers of Defense add nothing on their own.** Their +2 needs no armor and no shield, which
  `armorAC()` already knows (`hasArmor`, `shield`), but an effect cannot be scoped to it, so it is
  prose (#76); an unarmored wearer adds an `ac` +2 effect by hand. A scoped target like
  `attack.ranged` would do it; owner's call.
- A converter pass emitting a structured `armor` field for pack items was floated in 2026-08 and not
  done; prose parsing covers the shipped data.
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Armor equips and drives AC: base + capped Dex + shields + `ac` effects, parsed from the description. → ledger L239
- 2026-08-18 — The item form's Armor toggle writes a structured `armor` field; the form carries it across saves. → ledger L3092
- 2026-08-18 — Weapons became equippable too; `isEquippable()` is effects, armor or a weapon. → ledger L3213
- 2026-09-28 — A pack item's `ac` effect is a standing bonus only; five conditional ones (Quarterstaff of the Acrobat among them) stay in the description. → ledger L4502, #76
- 2026-11-06 — Calculated or Flat AC: one `acTotal()`, only the best shield, `character.ac` the Flat number only, the Armor Class window's switch, FLAT on the rail. → ledger L9537, #130
- 2026-11-06 — The AC window follows the Vitals lock; Escape keeps a typed Flat number; the Flat seed is never below 0; the struck line's wording. → ledger L9597, #130
- 2026-11-06 — A switch the Vitals lock holds looks held; only Escape needs the dismiss guard (× and the backdrop blur the box first). → ledger L9632, #130
