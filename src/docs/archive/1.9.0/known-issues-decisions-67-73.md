From `src/docs/wiki/roadmap/known-issues.md`, section "Decisions made while fixing #67–#73 — for Mike to confirm"; archived at the 1.9.0 pre-release; Mike confirmed these decisions on 2026-10-30.

# Decisions made while fixing #67–#73

Each is recorded, with its reason, in the page's Decisions table; each is easy to reverse.

- **Import settings asks in a window with three buttons** (Cancel · Keep my rules · Replace my rules,
  Keep as the default), rather than the browser's OK/Cancel dialog, because there are three outcomes. There is no
  "merge" option; a file with an empty pool counts as carrying no rules; the sources list is still
  replaced wholesale; and a bare settings object with no known key is refused as "not a settings
  file". → ledger L4134, [Settings & updates](../../wiki/features/settings-and-updates.md)
- **`migrate()` drops non-object values from a character's lists** (a `null`, a bare string or
  number), silently, because they can't be shown and can crash a render; glossary objects are never
  dropped. → ledger L4206, [Character model](../../wiki/architecture/character-model.md)
- **A keyword written `{name, description}` loads as its term and text** (`desc` is not an alias);
  pack entries with no usable name are skipped and counted on the status line, not shown as a chip
  on the pack's row, and a settings file's unusable entries are dropped without a message. → ledger
  L4206, [Rules packs](../../wiki/architecture/rules-packs.md)
- **Magic weapons take their names from the base weapon data, not a copy of the base weapon's
  fields** — the dump's magic weapons already carry every base field. → ledger L4327,
  [Converter](../../wiki/data/converter.md)
- **A weapon bonus on a non-weapon item lives only in its description** (#74). Bracers of Archery,
  Oil of Sharpness, the Rod of Lordly Might, the Eldritch Claw Tattoo and Baba Yaga's Mortar and
  Pestle no longer add an automatic bonus: the old global effect reached every attack, and no effect
  target can say "bows only". The player types it on the weapon's extra-damage box instead.
  → ledger L4392, [Attacks & damage](../../wiki/features/attacks-and-damage.md)
- **Conditional AC and save bonuses stay in the description** (#76), decided by a text rule over the
  sentence that states each bonus plus a reviewed list pinned in the tests. Bracers of Defense is one
  of the five: its +2 needs no armor and no shield, so an unarmored monk loses the automatic +2 once
  the update is applied. The Quarterstaff's once-per-rest Reaction is description, not a tracked use.
  → ledger L4502, [Armor & AC](../../wiki/features/armor-and-ac.md)
- **A spell bonus limited to one class's spells applies to the character's single spellcasting**
  (#77) — exact for a single-class caster; a multiclass caster's other class gets it too. → ledger
  L4568, [Spells](../../wiki/features/spells.md)
- **"+1 to ability checks" is one `check` effect** (#79) that reaches every skill, initiative and
  passive Perception — not 18 skill effects plus initiative. A plain ability check shows the bonus
  only in that ability's breakdown; the modifier box stays the modifier. The Proficiency Bonus box is
  now marked when an effect changes it, and tappable. Items that set or cap a score (Belts of Giant
  Strength, the +2-to-a-maximum Ioun Stones) or change speed stay prose. → ledger L4689,
  [Computed stats & effects](../../wiki/architecture/computed-stats-and-effects.md)

"Existing Bards are not fixed automatically" moved to the Limitations in [Known issues](../../wiki/roadmap/known-issues.md) before this was archived.
