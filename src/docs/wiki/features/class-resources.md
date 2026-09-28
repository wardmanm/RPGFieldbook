# Class resources

The Resources card on the Sheet tab tracks point pools — Rage, Focus Points, Sorcery Points,
Superiority Dice, the Gadgeteer's Scrap — as a current and a maximum with −, + and restore. A pool
that a class or subclass declares appears by itself, scales with class level, shows its die size
when its points are dice, and refills on the right rest; players can add their own. A feature that
costs a resource (a maneuver, a metamagic option) spends from the pool with the matching name.

**Code:** `syncResources()`, `resolveResMax()`, `resolveResDie()`, `renderResources()`,
`openResourceForm()`, `resetResources()` in `65-resources.js`; `useFeature()` in `20-lists.js`;
`recompute()` in `10-compute.js`; the resource handlers in `90-boot.js`; `load_class_resources()`,
`_optfeat_cost()`, `_prose_choices()` in [convert.py](../../../../scripts/convert.py) ·
**Data:** [class-resources.json](../../../../data/class-resources.json); `resources` on a class or
subclass, per [rules-schema](../../../../docs/rules-schema.md) §6.3 · **Tests:** `char-update.js`,
`converter.py` · **See also:** [Character building](character-building.md),
[Features & traits](features-and-traits.md), [Converter](../data/converter.md),
[README-converter](../../../../docs/README-converter.md)

## How it works

**A pool** is `{id, key, name, max, cur, per, auto, source, die?}` in `character.resources`.

**Automatic pools.** `recompute()` calls `syncResources()` and then `renderResources()`. For each
class on the sheet, `syncResources()` reads `resources` from the class definition and from its
chosen subclass (through `subclassesFor()`), both at **that class's level**, and keys each pool
`class:<Class>:<name>` or `subclass:<Class>:<Subclass>:<name>`:

- `resolveResMax()` reads `max` as a number, `{byLevel:[…]}` (index 0 is level 1; past the end, the
  last entry holds), `{formula:"level"}`, or `{formula:"<abbr>[±N]"}` — an ability modifier from
  `abilFinal()`, minimum 1.
- A max of 0 means "not yet" and removes the pool (Focus Points before Monk 2, Superiority Dice
  before Battle Master 3).
- A new pool starts full. An existing one has its name, max and `per` refreshed and `cur` clamped to
  the new max — never refilled.
- `resolveResDie()` turns `die` (`{byLevel:[sides…]}`, or a fixed `8` / `"d8"`) into `"d8"` and
  stores it as `r.die`; a pool without one is plain points.
- Any automatic pool no longer declared — class removed, subclass changed — is dropped.

**The card.** Each row shows the name, a die badge (`.res-die`), an "auto" badge naming its source,
"resets on short/long rest" or "manual reset", then −, `cur/max`, + and restore. Only a player's own
pools get edit and delete: an automatic pool's max is managed. "+ Resource" opens
`openResourceForm()` — name, max, and resets on Long rest, Short rest or Manual only.

**Rests.** `longRest()` calls `resetResources(["short","long"])`; `shortRest()` calls
`resetResources(["short"])`. `per:"none"` never refills by itself.

**Spending.** A feature with `cost: {resource, amount}` gets a Use button and a "Costs N X per use"
line. `useFeature()` finds the pool by **name**, case-insensitively; it refuses with a message when
there is no such pool or not enough in it, and otherwise spends — and marks a use too, if the feature
also has limited uses.

**Where the pools come from.** Rules packs carry `resources` on classes and subclasses. For the
5e-tools conversions they come from the hand-authored `data/class-resources.json`, keyed by class
name or `"Class/Subclass"`:

| Key | Pool | Max | Die | Rest |
|---|---|---|---|---|
| Barbarian | Rage | 2 → 6 by level | — | long |
| Monk | Focus Points | = level, from 2 | — | short |
| Sorcerer | Sorcery Points | = level, from 2 | — | long |
| Fighter/Battle Master | Superiority Dice | 4 at 3, 5 at 7, 6 at 15 | d8, d10 at 10, d12 at 18 | short |
| Fighter/Arcane Archer | Arcane Shot | 2 from 3 | — | short |

`convert.py all` finds the file through its `--resources` flag, the input directory, then the repo's
`data/`; `supplement` always loads it. `convert_classes()` attaches a class's pools by name and a
subclass's by `"Class/Subclass"`, and `convert_subclasses()` does the same for standalone
subclasses. Humblewood's Gadgeteer carries Scrap in its own pack. The overlay is a converter input,
not a loadable pack.

**What spends them.** 5e-tools records what an option spends as `consumes`, in the singular.
`_optfeat_cost()` turns that into `cost` on every option — in the level-up pickers and in the 2024
options library alike — and maps the name to the tracker's through `_CONSUMES_AS` (Superiority Die →
Superiority Dice, Sorcery Point → Sorcery Points). `commitChoices()` passes the cost on to the
feature it creates.

**The Battle Master, end to end.** Picking the subclass at Fighter 3 brings a Superiority Dice pool
of 4 with a d8 badge, and a modal asking for three maneuvers (each costing one die), a skill and an
artisan's tool (Student of War, from `_prose_choices()` — the source carries no data for it). Each
maneuver becomes a feature with a Use button that spends a die; a short rest refills them; at
Fighter 10 the badge reads d10. Choosing a maneuver: [Character building](character-building.md).

## Rules that must hold

- **The pool's name is the join key.** A feature's `cost.resource` finds its tracker by name, so a
  renamed pool in `class-resources.json` silently disconnects every Use button that spends it. Keep
  `_CONSUMES_AS` in step with the tracker names.
- **`die` is separate from `max`.** The dice's count and their size follow different tables, so the
  two cannot share one field.
- **`syncResources()` runs inside every `recompute()`**, so it must stay idempotent: it clamps `cur`
  but never refills it, or every repaint would restore spent points.
- **Pools are keyed by source and class**, so a multiclass character's two pools never collide, and
  removing a class or changing a subclass removes exactly its own.
- **`commitChoices()` must pass `cost` into `addFeatureFromDef()`.** A picked maneuver's Use button
  depends on it.

## Traps

- **The app supported `resources` on a subclass long before anything supplied one.** Superiority
  Dice appeared only once `class-resources.json` gained `"Class/Subclass"` keys and the converter —
  both the 2024 path and `supplement` — read them.
- **A picked option's cost was dropped** between the picker and the sheet, and 5e-tools' singular
  "Superiority Die" would have matched no tracker even if it had arrived.
- **A die badge set in the heading face read "D10"** (small caps); it uses the body font.
- **A conversion without the overlay loses the trackers quietly.** `all` used to look only in the
  input directory; it now falls back to the repo's `data/` and warns when neither has the file.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How a pool shows its die size | A separate `die`, resolved per level like `max` | Folding it into `max`: the count follows its own table |
| An option's cost name | Mapped to the tracker's name in the converter (`_CONSUMES_AS`), because the sheet spends from a pool matched by name | — |
| Where Battle Master's pool is declared | A `"Fighter/Battle Master"` key in `class-resources.json`, read by both converter paths | — |
| Student of War | Hand-listed in `_prose_choices()`, as the source carries no data for it; keyed by class, subclass and source so another printing is never touched | — |
| What the 2024 options library contains | XPHB printings only | `pick_2024_preferred()`: it would backfill 2014-only invocations into the core pack |

## Open

- Rune Knight runes are per-rune uses, not a pool, and have no tracker.
- Only the pools in the table above (and Humblewood's Scrap) are automatic. Others — Bardic
  Inspiration, Channel Divinity, Wild Shape — are added by hand or tracked as feature uses.
- A player's own pool with the same name as an automatic one competes for `useFeature()`'s name
  match; whichever comes first in the list is spent.
- See [Known issues](../roadmap/known-issues.md).

## History

- 2026-09-25 — option costs reach the sheet; subclass trackers from `"Class/Subclass"` keys
  (Superiority Dice, Arcane Shot); Student of War; the 2024 options library. → ledger L3649
- 2026-09-25 — a pool can carry a `die`, shown as a badge; Battle Master's d8 → d10 → d12.
  → ledger L3676
