# Rules & tables

The Rules tab: a browser over every loaded rules category, the **Glossary** (every term from the
loaded packs plus the player's own entries) and the **Tables** (roll tables, class progressions and
the lookup tables rules prose points at) among them. None of it is character data. Their real reach is elsewhere: every glossary term becomes a tappable
chip wherever it appears in the app, and every `[Table: Name]` anchor the converter left in the prose
becomes a chip that opens that table in place.

**Code:** `openGlossForm()` in `85-browse.js` ·
`openGlossView()` in `80-modal-forms.js` · `allGlossary()`, `glossTerm()` in `00-constants.js` · `highlight()` in
`10-compute.js` · `allTables()`, `tableRows()`, `tableCols()`, `findTable()`, `tablesFor()`, `tableHTML()`, `openTableView()`,
`openTableByName()`, `TBL_KINDS`, `tableChipsHTML()` in `86-tables.js` · `refreshRulesUI()`,
`RULE_CATS` in `88-settings.js` · `mergeRules()`, `reindexRules()` in `89-rules-merge.js` ·
`RB_CATS`, `rbShown()`, `rbBodyHTML()`, `rbSearchHTML()`, `renderRulesBrowser()` in `86-rules-browser.js` · markup
`src/html/40-rules.html` · **Data:** each pack's `tables.json`;
[rules-schema §6.11](../../../../docs/rules-schema.md) · **Tests:** `tables.js`, `rules-data.js` ·
**See also:** [Rich text](../architecture/rich-text.md), [Rules packs](../architecture/rules-packs.md),
[Converter](../data/converter.md), [Supplements](../data/supplements.md),
Humblewood (the private repo's `docs/humblewood.md`)

## How it works

**The browser.** One card (`#rbCard`, `src/html/40-rules.html`). On the left, every category the
loaded packs hold, in `RB_CATS` order with its count (Classes, Subclasses, Species, Backgrounds,
Feats, Traits, Spells, Items, Conditions, Glossary, Tables; the Glossary is always listed, even
empty, so its + Add is always reachable — a ruling beyond the spec, which only said every
*non-empty* category), under a search box across all of them. On the right, the open category as a
sortable table with its own search box and, where it has them, the Add pickers' filters behind a
Filters button that folds the pills away (open or shut is per-category session state,
`st.showFilters`); its label carries the active count ("Filters (2)") and a Clear button appears
beside it once any are set. A row opens the window the sheet already uses for that entry, by the
entry's `_id` (the class, subclass, species and background windows in reference mode, with nothing
to add — see below). The category last opened is `settings.rulesCat` (read through `rulesCatOf()`,
which falls back to the first listed category when the stored one is unknown or now empty); the
search text, filters and sort of every category, and the sidebar's own query, live only for the
session, in the module-level `rbUI`. `renderRulesBrowser()` paints it all — the import prompt or the
sidebar and pane — from `renderAll()` (a sheet loaded with cached rules) and from `refreshRulesUI()`
(a pack load); typing in a category's own box runs `rbRefreshBody()`, which repaints only `#rbBody`,
so the box keeps focus and every keystroke lands (the sidebar's box, over every category, repaints
the sidebar the same way). 640px and under it shows one pane at a time, by `#rbCard[data-screen]`,
with ← Categories to go back, which also returns keyboard focus to the category button just left.
A category button (`[data-rbcat]`) calls `rbOpenCat()`, which repaints the pane and does not scroll
the page. A long table (more than 300 rows after filtering) shows the first page and a
"Show *N* more" button (`rbState().shown`, capped at 300 more per tap); filters and search narrow
*before* the cap applies. With no pack loaded the card opens on an Import rules files prompt, above
where the (Glossary-only) browser would be.

**The categories.** `RB_CATS` in `86-rules-browser.js` is the config table, one entry per category:

| Category | Rows from | Columns | Filters | Default sort |
|---|---|---|---|---|
| Classes | `classes` | Name · Hit die · Source | — | name |
| Subclasses | `subclassesFor()` of every loaded class | Name · Class · Source | Class | class, then name |
| Species | `races` | Name · Size · Speed · Source | — | name |
| Backgrounds | `backgrounds` | Name · Feat · Source | — | name |
| Feats | `feats` (wrapped as `{k:"feat",e}`) | Name · Type · Prerequisite · Source | Type, Pack (own), No prerequisite (`featFacets()`) | name |
| Traits | `features` (wrapped as `{k:"trait",e}`) | Name · From (`source`) · Source | — | name |
| Spells | `spells` | Name · Level · School · Time · Source | Level, Class (defaults to *every* class, not this character's — a lookup, not a choice), School, Concentration (`spellFacets(list,{classDefault:"all"})`) | level (cantrips first), then name |
| Items | `items` | Name · Category · Rarity · Cost · Source | Category, Rarity, Needs attunement (`itemFacets()`) | name |
| Conditions | `keywords` with `cond:true` | Name · Source | — | name |
| Glossary | `keywords` without `cond:true`, plus `character.glossary` | Term · Type · Source ("Yours" for the player's) | Your entries (toggle) | term |
| Tables | `allTables()` | Name · Rows · From (`owner`) · **Source** | Kind (`TBL_KINDS`) | kind, then name |

**Subclasses, a ruling beyond the spec's literal source.** The spec names `rules.subclasses` alone;
this category instead lists what `subclassesFor()` returns for every loaded class — the class's own
inline `subclasses` plus any standalone `rules.subclasses` entry naming it — because the SRD pack
(and most packs) carry a class's subclasses inside the class record, and the literal source would
leave the category empty for an SRD-only player. A subclass whose class is not loaded is not listed.
**Tables carries a Source column too**, beyond its shorter §4 column list, because decision 7 ("a
Source column everywhere") outranks it.

**The Pack filter is per category**, not app-wide: `rbFacets()` adds one, labelled "Pack", whenever
that category's *own* rows (after its own filters) span more than one `_source` — matching the item,
spell and feat pickers. Feats already carry their own Pack filter from `featFacets()`; `rbFacets()`
does not add a second one.

**Search across everything.** The sidebar's box (`#rbSearch`) searches every listed category's
display name — a glossary term's *text* is not searched, only its term, matching the glossary's own
search today. While it has text, the category list is replaced by grouped results, in `RB_CATS`
order: up to `RB_HITS` (8) rows per category, then "*N* more in *Category* →" when a category has
more; a row opens its window directly (`rbOpenRow()`), and the "more in" link opens that category
with the same text carried into its *own* search box (`rbMoreIn()`), clearing the sidebar's. Clearing
the sidebar's box restores the category list. Matching is case-insensitive substring, as every
search in the app is.

**The glossary.** `allGlossary()` is the rules pack's `keywords` plus `character.glossary`. The
Glossary category lists the pack's terms (conditions have their own category) together with the
player's own, sourced "Yours", which carry Preview, Edit and Delete beside the row and can be shown alone with
the "Your entries" filter. + Add sits in its heading. Every term is read through `glossTerm()`: a
pack keyword with no term is not listed (the pool drops those, see
[Rules packs](../architecture/rules-packs.md)), and a player's entry with none is listed as
"(no term)", so it can be given one or deleted; it never becomes a chip. `openGlossForm()` makes an
entry of type Text or Rules image (a screenshot stored as a data URL); a term is required.
An image entry, the player's or a pack's, is drawn through `imgHTML()`: escaped, and only from a
data: URL, the form rules-schema §6.1 documents. A pack image given as a web address is not fetched;
the entry says the image isn't stored in the file. See [Rich text](../architecture/rich-text.md).

**Glossary chips.** `highlight()` escapes the text, then wraps every glossary term — longest first,
whole word, any case — in a `.kw` chip (`role="button"`, `tabindex="0"`). A click, Enter or Space on
one opens `openGlossView()`. Saving or deleting an entry redraws the features, inventory and Story
text, because it changes how they read.

**Tables.** `rules.tables` is merged like every category (`mergeRules()`: keyed by source + name, so
re-loading a pack replaces its own and a same-named table from another pack is kept beside it). A
table is `{name, cols, align, rows, owner, ownerKind}`, optionally `footnotes`, `caption` and
`source`.
The Tables category lists them sorted by `ownerKind` in `TBL_KINDS` order (class, subclass, race,
spell, item, feat, background, rule, then Other), with a Kind filter over the same groups; a row
opens `openTableView()`, the modal: owner, kind and row
count, then `tableHTML()` — a header from `cols` (omitted when every label is empty), per-column
`align`, and every cell escaped. Rows and columns are read through `tableRows()` and `tableCols()`,
which give lists whatever the pack wrote: a table with no `rows` counts as 0 rows and says it has
none, and a row that is not a list is one cell.
The table's `footnotes` (what a `*` in a row or label points at,
such as Xanathar's "Might involve a rival") follow as one escaped line each in a `.tbl-notes`
block **after** the scroll box, so a wide table never carries them off-screen. A table without
footnotes renders exactly as it did before they existed.

**Anchors.** The converter lifts each table out of the prose it lived in and leaves `[Table: Name]`
in its place. `highlight()` lifts the anchors out **before** escaping and before the glossary pass
(behind `TBL_MARK`, a private-use placeholder), then restores each one as a `.tblref` chip if
`findTable()` resolves it, or as the plain words "the *Name* table" if not. `findTable()` matches the
exact name, ignoring case and surrounding space, across every loaded pack, first match wins.
`tableChipsHTML(name, kind)` (through `tablesFor()`) adds an entity's own tables to the class,
subclass, species and background info panes even when no prose anchors them. Any `.tblref` opens
`openTableByName()`; a name no loaded pack has gets a short explanation. The modal is a singleton, so
a table opened from a spell preview replaces it.

## Rules that must hold

- **`cols` is the key.** `tableHTML()` reads nothing else; a table written with `columns` renders
  without a header and looks perfectly correct in the JSON. `tables.js` asserts, for every pack: a
  non-empty `cols`, no underscore-prefixed keys, every row as wide as `cols`, unique names, an
  `owner` and `ownerKind` on each, and no column blank in every row. It also pins the 2024 class
  progression values (Rage Damage, Martial Arts, Unarmored Movement, Bardic Die, Sneak Attack).
- **Every `*` in a shipped table has a footnote to point at.** `tables.js` checks every pack.
  The one exception is Humblewood's Night Domain Spells, whose note the book prints after the table
  and the extractor keeps verbatim in the feature prose beside its anchor. Footnotes go through
  `esc()` like cells; the attribute guard in `rules-data.js` cannot see text, so `tables.js`
  asserts the escaping itself.
- **Names are the merge key and the anchor target.** They must be unique within a pack, and because
  `findTable()` is global, collisions across packs are resolved at conversion time
  (`--avoid-table-names` — see [Supplements](../data/supplements.md)).
- **The anchor pass runs before `esc()` and before the glossary pass**, or a term like "Damage Types"
  is matched inside a table name and corrupts the markup. See [Rich text](../architecture/rich-text.md).
- **An unresolved anchor reads as prose, never a dead chip** — the tables pack is optional.
- **Every renderer `refreshRulesUI()` calls must also be called by `renderAll()`.** A surface that
  redraws when the rules change must also draw when the app starts with rules already cached. A test
  asserts the invariant, not the name.
- **One category list.** `RULE_CATS` drives `reindexRules()`, `recomputeDups()` and the loaded-data
  list. Both functions once carried their own hardcoded copy, which would have left tables without an
  `_id`; four copies of one list is a bug generator.
- **Tables are reference only**: nothing is written to a character, so loading or removing a tables
  pack never changes a saved sheet.

## Traps

- **Every table was silently discarded** by the converter (`flatten()` had `pass` for tables), and so
  was every referenced feature — which is why Wild Magic Surge was missing while two features still
  cited it. The shipped data was full of dangling "see the table" prose. → L533
- **16 of 35 Humblewood tables rendered headerless** (`columns`, not `cols`), and 19 shipped the
  extractor's `_region` marker. Neither was visible to any test. → L1219
- **Right row count, wrong pixels.** Two Humblewood characteristic tables had six rows numbered 1–6
  and had still absorbed words from the neighbouring column. The builder now requires die faces 1..n
  in order and rejects bled text; a clean count is not proof. → L1103
- **Right header, empty column.** Barbarian Features shipped a Rage Damage header over 20 blank
  cells, Monk Features two such columns, and Bard and Rogue had no Features table at all: the
  converter could not read 5e-tools' typed `dice`/`bonus` cells and dropped them without a word.
  Every table check passed, since the rows were the right width. → L3761
- **Marks that pointed at nothing.** 17 Xanathar's downtime tables shipped rows marked `*` with
  the note they point at dropped: `_norm_table()` never read the node's `footnotes`, and the
  schema had nowhere to put them (#73). → L4273
- **The Tables tab was blank on load.** The tables renderer was in `refreshRulesUI()` but not
  `renderAll()`, so tables drew only after an import or a keystroke in the filter. → L1581
- **A table with no `rows` stopped every render** (#71). The tables renderer read `t.rows.length`,
  and it runs in `renderAll()`, so one hand-written table without rows failed the whole sheet the
  way a keyword without a term did. `mergeRules()` checks only the name. → L4206
- **The glossary heading's + Add toggled the section** every time it was pressed, until the handler
  learned to ignore interactive children. → L3189

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where the Rules tab remembers its place | `settings.rulesCat`, app-wide — the category last opened | On the character: the packs are global, so remembering per-character would surprise a player opening a different sheet and finding a different category open |
| Which category opens with nothing stored, or the stored one now empty | The first listed category (`rulesCatOf()`'s fallback) | Always Classes: drops the "last opened" promise the moment a stored category empties out, e.g. after Clear all |
| An anchor whose table is not loaded | The words "the *Name* table" | A chip: it would open nothing, and the tables pack is a separate optional download |
| An anchor with no table sink active (converter) | Keep the old silent drop | Emitting an anchor: one with no table behind it is worse than the drop |
| Spell-slot columns in class tables | Skipped | Kept: the app derives slots by level, and a 10-column grid swamps a phone |
| Where tables are browsed | As one of the Rules browser's own categories (`Tables` in `RB_CATS`), same as any other | Their own tab: one more tab to scroll past (changelog); a card under the glossary (#32): superseded once the whole tab became a browser over every category (#99) |
| Where a table's footnotes render (#73) | Under the table, outside its scroll box, escaped like a cell | A `<tfoot>` row: it sits inside the scroll box, so a wide d100 table scrolls the note away. Through `highlight()`: cells use `esc()`, and a note is part of the table |

## Open

- **Glossary popups ignore anchors and markup.** `openGlossView()` renders the entry with `esc()`
  only, so the 5e2024 glossary's `[Table: Carrying Capacity]`, `[Table: Damage Types]` and others
  (and Xanathar's and Tasha's) show as literal bracketed text rather than chips. Seen in the code and
  data; not checked in a browser.
- [rules-schema §6.11](../../../../docs/rules-schema.md) still opens with "the app's **Tables** tab",
  says ragged rows are padded (the converter pads; `tableHTML()` does not), and leaves `race` out of
  the `ownerKind` list that `TBL_KINDS` groups by.
- Rolling is not done in the app; a `1d100` column is text.
- Small tables inside a feature (Magic Item Hacking's rarity costs) still read as flat text.
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-10 — The converter recovers tables and referenced features; `tables` category; a Tables tab; anchors in `highlight()`. → ledger L533
- 2026-08-10 — Humblewood table extraction checks die faces and bled cells. → ledger L1103
- 2026-08-10 — `cols` not `columns`; underscore keys stripped; `tables.js` guards the shipped data. → ledger L1219
- 2026-08-11 — `renderAll()` draws the tables; the refresh/load invariant test. → ledger L1581
- 2026-08-17 — The Tables tab folded into the Rules tab. → ledger L2714, #32
- 2026-08-18 — Both Rules sections fold, start shut, and show counts. → ledger L3189
- 2026-09-24 — A × clear button in both filter boxes. → ledger L3525, #49
- 2026-09-28 — Class progression tables carry their dice and bonus cells; Bard and Rogue Features tables; `tables.js` rejects an all-blank column. → ledger L3761, #64
- 2026-09-28 — Glossary images are escaped and shown only from data: URLs; the glossary id in a chip is escaped. → ledger L3940
- 2026-09-28 — A player's entry with no term is listed as "(no term)"; tables are read through `tableRows()`/`tableCols()`, so a table with no rows no longer stops the sheet. → ledger L4206, #71
- 2026-09-28 — Tables carry optional `footnotes`, shown under the table; 17 Xanathar's downtime tables gain theirs. → ledger L4273, #73
- 2026-10-22 — The Rules tab becomes a browser over every loaded category (Classes through Tables), replacing the Glossary and Reference Tables cards: a sidebar with counts and a search across everything, a sortable filterable table per category, a row opening the window the sheet already uses, in reference mode for class/subclass/species/background. `settings.rulesCat` replaces `rulesCollapse`. → ledger L6327, #99, #53
- 2026-10-22 — Final-review fixes: re-entering the Rules tab always opens the category list; the ☰ flyout scrolls the chosen category into view and shows its count; same-named classes from two packs read distinctly in Subclasses' Class column; `rbNum()` reads the first number instead of joining every digit. The stale fold-state rows above are rewritten to the current truth. → ledger L6455, #99
