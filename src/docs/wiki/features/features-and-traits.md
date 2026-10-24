# Features & traits

The Features & Traits card on the Sheet tab lists everything a character can do that is not a spell,
an item or an attack: ancestry traits, class and subclass features, feats, picked options such as
maneuvers and invocations, and anything the player writes in. Each can carry numeric effects,
limited uses that come back on a rest, and a cost in a resource. The list groups by each feature's
source — the label on its row, which the player can edit — pins favourites at the top, and its Add
button searches every feat and trait in the loaded packs.

**Code:** `renderFeatures()`, `featGroups()`, `featGroupLabel()`, `featOriginLabel()`, `featItemHTML()`, `usesMax()`,
`usesRowHTML()`, `useFeature()`, `featCol()`, `fxChips()` in `20-lists.js`; `addFeatureFromDef()`,
`grantFeatDef()` in `50-classrace.js`; `browseFeatures()`, `featPickList()`, `featPickKind()`,
`featPickPrereq()`, `featPickGroup()`, `addPickedFeature()` in `85-browse.js`; `openFeatureForm()`,
`groupFieldHTML()` in `80-modal-forms.js`; `resetFeatureUses()` in `65-resources.js`; the feature handlers in
`90-boot.js` · **Data:** `feats` and `features`, per
[rules-schema](../../../../docs/rules-schema.md) §6.6 and §6.9 · **Tests:** `sheet.js`,
`rules-data.js`, `char-update.js` · **See also:** [Character building](character-building.md),
[Class resources](class-resources.md), [Grants & provenance](../architecture/grants-and-provenance.md),
[Rules-update tool](rules-update-tool.md), [Sections & layout](../ui/sections-and-layout.md),
[Shell](../ui/shell.md) (the browse picker)

## How it works

**A feature** is `{id, name, source, description, effects, enabled, origin}`, optionally with
`uses {max, per, used}`, `cost {resource, amount}`, `fav` and the `src` stamp.

**How they arrive.** `addFeatureFromDef(def, origin)` is the one constructor behind ancestry and
background traits, class and subclass levels, picked options and ASIs. It forwards `uses` when the
max is a positive number or a formula, and `cost` when the amount is positive; stamps `src` for the
[Rules-update tool](rules-update-tool.md); and grants the def's `skills` and `saves` under the
origin's source id. `grantFeatDef()` wraps a feat as "Feat: <name>", re-stamps it against the real
feat entry, and queues the feat's skill choices when the origin has a source id.

**Groups.** `featGroups(list)` is pure. Favourites come first, sorted by name, under
"★ Favorites" (`FEAT_FAV`); then one group per `featGroupLabel()`, which is the feature's `source`
when it has one, and otherwise `featOriginLabel()` — the ancestry's name, the background's, the
class's, or "Other" for a feature with no `origin`. A granted feature's source is that same name
(`addFeatureFromDef()`), so it files where it came from until the player edits it; then it moves.
Groups key on `tagKey()`, so a source typed in another case joins the group, which keeps the first
spelling met. A source reading as "★ Favorites" files by origin. The groups features came from
list in grant order whether or not anything is still filed in them, so moving a feature between
them never reorders the list; a group named only by a source lists right after the group its first
feature came from. Features keep grant order inside a group (level order, for a class). Favourites are **moved**, not copied: the other groups are built
from the rest. A group heading (`.fghead`) collapses under
`featCollapse.groups[label]`, an item under `featCollapse.items[id]`, and "Collapse all" shuts every
group while any is open. The heading style is shared with the inventory:
[Sections & layout](../ui/sections-and-layout.md).

**A row** (`featItemHTML()`, also pure): collapse caret, star (`data-fav-feature`), name, source tag,
Use (when there is a cost or uses), an On/Off toggle, edit and delete; the body holds the
description through `descHTML()`, a "Costs N X per use" line, the use pips and the effect chips.
**Off** stops the feature's effects (`contributions()` skips it) and greys the chips. The star
re-renders without `recompute()`, since nothing derived changes; On/Off recomputes.

**Limited uses.** `usesMax(f)` resolves `uses.max` as a number, `{byLevel:[…]}` indexed by *total*
level, `{formula:"level"}`, or `{formula:"<abbr>[±N]"}` (or that string bare) — an ability modifier
from `abilFinal()`, minimum 1. It is resolved at every render, so the pips track levels and ability
changes. Clicking pip *i* marks *i* used, or *i* − 1 if it already was. `resetFeatureUses()` clears
`short` uses on either rest and `long` on a long rest. `useFeature()` checks and spends the cost
from the resource of that name, then marks a use; it refuses when either has run out
([Class resources](class-resources.md)).

**Add searches the packs.** The card's Add (`data-add="feature"`) opens `browseFeatures()` in the
shared full-screen picker, or the plain form when no pack has feats or traits:

- **One list, two kinds.** `featPickList()` wraps every `rules.feats` entry and every
  `rules.features` entry as `{k:"feat"|"trait", e, id}`.
- **Facets**: Type — Origin feat, General feat, Fighting Style feat, Epic Boon, Feat, Trait, only the
  kinds present; Pack, when more than one source is loaded; and "No prerequisite" — built by
  `featFacets(list)`, the same facets the Rules tab's Feats and Traits categories filter by (#99), as
  `itemFacets()` and `spellFacets()` do for Items and Spells. The eye button's preview opens
  `openFeatInfo(w)`, likewise shared with those two categories' rows.
- **Search** covers the name, the source and the whole description.
- A feat's kind and prerequisite come from the **first line** of its description, where the
  converter writes them ("General feat · Prerequisite: Level 4+"): `featPickKind()`,
  `featPickPrereq()`. 2014-era feats have no such line and read as plain "Feat".
- **Traits group by their own `source`** — "Battle Master Maneuver", "Eldritch Invocation",
  "Artificer Infusion" — so the list sorts kind → group → name, since a heading is emitted whenever
  the group changes.
- Rows already on the sheet show "added"; `addPickedFeature()` refuses a duplicate by stored name.
  A feat is stored as "Feat: <name>" and stamped against `feats`, exactly as a granted one; a trait
  keeps its name and is stamped against `features`. Both get `origin: null`; a trait files under its
  own source ("Eldritch Invocation"), a feat, which has none, under "Other".

**Editing.** `openFeatureForm()` has name, source, description, effect rows, limited uses with a
reset, a cost with a resource (a datalist of the sheet's pools), and an "Insert from rules pack"
select over `rules.features`. The source is the group field (`groupFieldHTML()`, see
[Sections & layout](../ui/sections-and-layout.md)): it offers every group on the list, and left
empty it reads "Automatic (*the group it came from*)". Save stores the source tidied as a tag
(`tagLabel()`), rebuilds the record from the form and carries `fav`, `origin` and `src` across.

## Rules that must hold

- **`featGroups()` and `featItemHTML()` stay pure.** `renderFeatures()` writes `innerHTML` into an
  element the harness stubs, so these are the only parts of the list a test can reach.
- **`"★ Favorites"` is both the label and the collapse key**, exactly as `invCollapse.sections` holds
  the same string for the inventory.
- **`fav` stays out of `UPD_FIELDS.feature`**, so an update never writes it and `updEdited()` never
  reads a star as an edit.
- **Every form save carries `fav`, `origin` and `src`.** Each fails silently in its own way — a lost
  star, a class feature that no longer goes when its class does, a copy the update tool can no
  longer tell from a hand edit — and each has its own source guard in `rules-data.js`.
- **`origin` is structural, not a label.** It drives the `removeFeaturesWhere()` predicates that
  make removing a class or ancestry take its features back, wherever the feature is filed, and the
  group an empty source falls back to. Where a feature is *shown* is its `source`. A picked feature
  gets `origin: null`.
- **A picked feat and a granted feat are the same record** — "Feat: X", stamped against `feats` —
  so the update tool treats them identically.

## Traps

- **Editing the source did not move the feature** (#98). The list grouped by `origin` alone, so
  the row's label changed and the feature stayed put. The two agree for every granted feature,
  which is why it only showed once a player edited one.
- **Ordering groups by their members reshuffled the list.** Placing each group at its first member
  pulled the background's group above Mapach when the first Mapach trait moved into it. The first
  fix, each feature placing its origin group and then its own, still pulled the background's group
  above the class's for a character with all three; review caught it. The groups features came
  from now hold their places outright.
- **The form's rebuild dropped what it did not ask about.** `origin` and `src` were already being
  lost when favourites arrived: an edited class feature jumped to "Other" and dropped out of the
  update tool. Fixed alongside `fav`, the same guard the item form has.
- **The form also freezes a scaling use count.** Its "Limited uses" box is filled from `usesMax(f)`
  and saved as that number, so editing any field of a feature whose max is `{byLevel}` or a formula
  replaces the scaling with today's value. Traced in the code.
- **A favourited granted feature loses its star** when the grant is rebuilt — a subclass change,
  a removed class, a swapped ancestry — because `addFeatureFromDef()` makes a new object with a new
  id. Levelling up only adds, so it is safe. Inventory avoids this because `grantItemByName()`
  reuses the existing item.
- **The old chooser offered no feats.** The form's "Insert from rules pack" reads `rules.features`
  alone; 117 feats were reachable only by typing them out until the browser.
- **`addFeatureFromDef()`'s own stamp has an empty category**, which would send the update tool down
  the name-only legacy path; `addPickedFeature()` re-stamps against the real category.
- **`usesMax()` has no check in the suite.** Its formula handling was verified once, when it was
  written, by a throwaway script.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| What starring a feature does | Moves it into a pinned "★ Favorites" group — the same partition the inventory uses, so most of it came for free | — |
| How groups sort | Favourites by name, like the inventory's; the other groups keep grant order, which for a class is level order | — |
| What a feature groups by (#98) | Its `source`, falling back to its origin | `origin` alone: editing the source changed the label and left the feature where it was. A separate group field: a second label beside the source, for the same idea |
| The order of groups once sources move (#98) | The groups features came from, in grant order; a group named only by a source right after the group its first feature came from | Placing each group at its first member, or each feature placing its origin then its own group: one feature moving pulls a group up past others. A to Z: loses ancestry, background, class order |
| Favourites in the ☰ menu | Moot since #103 retired the ☰ menu; it was not listed (the menu collected `.inv-sec-head`, not `.fghead`) | Adding them: every feature group would land in the menu |
| A starred granted feature on a grant rebuild | Loses the star, left as-is: in most of those paths the feature genuinely changes | — |
| Feats and traits in one picker | Each wrapped as `{k, e, id}` | Concatenating the lists: Humblewood ships `Glide` as both, added in different shapes, and `_id` alone does not say which list a row came from |
| The origin of a picked feature | `null`, so it files under its own source, or "Other" without one | An origin select for the label: `origin` drives clean revert, and browse origins carry `detail`, not the `name` those predicates match |
| Where a feat's kind and prerequisite are read | The first line of the description only | The whole body: its prose would gate half the list behind false prerequisites |

## Open

- A feat picked from the browser gets no skill-choice prompt; `grantFeatDef()` offers those only
  when there is an origin source id.
- The form's freezing of scaling uses, above. See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — feats forward their uses and cost through `grantFeatDef()`; `usesMax()` accepts
  `byLevel` and formulas. → ledger L16
- 2026-08-15 — favourites on Features & Traits; `featGroups()` extracted; the form carries `fav`,
  `origin` and `src`. → ledger L2381, #26
- 2026-08-17 — Add searches every feat and trait in the loaded packs. → ledger L2776, #31
- 2026-08-18 — "Collapse all" on Features & Traits, and the shared group-heading style.
  → ledger L3123
- 2026-10-16 — A feature files under its source, falling back to where it came from; the Source box offers the groups in use. → ledger L5823, #98
- 2026-10-22 — The feat/trait picker's filters and preview become `featFacets()` and `openFeatInfo()`, shared with the Rules tab's Feats and Traits categories. → ledger L6327, #99
