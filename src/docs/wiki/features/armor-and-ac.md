# Armor & AC

How the Armor Class in Vitals is worked out. Equipped armor sets a **base** — its AC plus the
character's Dexterity modifier, capped by the kind of armor — shields add a flat bonus, and any `ac`
effects stack on top. Armor is an inventory item like any other; what makes it armor is either a
structured `armor` field or an "AC …" line in its description, which the app parses.

**Code:** `itemArmor()`, `armorKindOf()`, `armorAC()`, `isEquippable()`, `ARMOR_KINDS`,
`ARMOR_DEXCAP` in `25-origins-items.js` · `recompute()` in `10-compute.js` · `openStatBreakdown()`,
`openItemForm()` in `80-modal-forms.js` · `invSection()` in `40-sheet.js` · **Data:** the item
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

**The number.** `armorAC(c)` returns `{base, hasArmor, shield, body, dex}`:

- **Dex** is the modifier of the *final* score, `abilFinal("dex")`, so ability effects count.
- **Body**: of the equipped body armors, the one with the highest base wins; base + Dex, capped by
  its `dexCap`.
- **No body armor**: `character.ac` if the character carries a value, else 10 + Dex.
- **Shields**: every equipped shield's bonus is added.

`recompute()` paints `armorAC(c).base + sumFx("ac")`, marked when effects apply. Tapping it opens
`openStatBreakdown("ac")`: "Armor 15 + DEX +2" (or "Base AC 14", or "10 + DEX +3"), "+ Shield +2",
then each `ac` effect by source.

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
| Structured field or description when both exist | The field wins — explicit over prose, as `weapon` already behaves | — |
| How a custom item becomes armor | An Armor toggle writing the structured field | Typing the description incantation: nothing in the UI said so |
| What the shield kind shows | A bonus box instead of Base AC and Max Dex | Showing all three: two of them mean nothing for a shield |
| A pack item's AC bonus that holds only sometimes (#76) | Prose in the description, no `ac` effect | An `ac` effect: on at all times while equipped, so a once-per-rest Reaction read as +5 AC |

## Open

- **Nothing on the sheet sets `character.ac`.** The Armor Class box is a display that opens the
  breakdown; `armorAC()` honours a manual value only when a saved or imported character carries one.
  Unarmored Defense and similar need an `ac` effect instead.
- **Bracers of Defense add nothing on their own.** Their +2 needs no armor and no shield, which
  `armorAC()` already knows (`hasArmor`, `shield`), but an effect cannot be scoped to it, so it is
  prose (#76); an unarmored wearer adds an `ac` +2 effect by hand. A scoped target like
  `attack.ranged` would do it; owner's call.
- **Shields stack**, one bonus per equipped shield; the rules allow one.
- **A manual `character.ac` gets the shield bonus added**, which double-counts if the typed value
  already included it.
- The breakdown tests `character.ac !== ""` while `armorAC()` also rejects `null`; a hand-edited
  `null` reads "Base AC 0" in the breakdown over a computed 10 + Dex.
- A converter pass emitting a structured `armor` field for pack items was floated in 2026-08 and not
  done; prose parsing covers the shipped data.
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Armor equips and drives AC: base + capped Dex + shields + `ac` effects, parsed from the description. → ledger L239
- 2026-08-18 — The item form's Armor toggle writes a structured `armor` field; the form carries it across saves. → ledger L3092
- 2026-08-18 — Weapons became equippable too; `isEquippable()` is effects, armor or a weapon. → ledger L3213
- 2026-09-28 — A pack item's `ac` effect is a standing bonus only; five conditional ones (Quarterstaff of the Acrobat among them) stay in the description. → ledger L4502, #76
