# Rules & tables

The Rules tab: **Glossary & Rules** (every term from the loaded packs plus the player's own entries)
and **Reference Tables** (roll tables, class progressions and the lookup tables rules prose points
at). Neither is character data. Their real reach is elsewhere: every glossary term becomes a tappable
chip wherever it appears in the app, and every `[Table: Name]` anchor the converter left in the prose
becomes a chip that opens that table in place.

**Code:** `renderGloss()` in `60-attacks.js` · `openGlossForm()` in `85-browse.js` ·
`openGlossView()` in `80-modal-forms.js` · `allGlossary()`, `glossTerm()` in `00-constants.js` · `highlight()` in
`10-compute.js` · `RULES_SECS`, `rulesSecOpen()`, `setRulesSecOpen()`, `renderRulesSections()`,
`toggleRulesSec()`, `allTables()`, `tableRows()`, `tableCols()`, `findTable()`, `tablesFor()`, `tableHTML()`, `openTableView()`,
`openTableByName()`, `renderTables()`, `tableChipsHTML()` in `86-tables.js` · `refreshRulesUI()`,
`RULE_CATS` in `88-settings.js` · `mergeRules()`, `reindexRules()` in `89-rules-merge.js` · markup
`src/html/40-rules.html` · **Data:** each pack's `tables.json`;
[rules-schema §6.11](../../../../docs/rules-schema.md) · **Tests:** `tables.js`, `rules-data.js` ·
**See also:** [Rich text](../architecture/rich-text.md), [Rules packs](../architecture/rules-packs.md),
[Converter](../data/converter.md), [Supplements](../data/supplements.md),
Humblewood (the private repo's `docs/humblewood.md`)

## How it works

**Two folding sections.** Each card heading is a toggle (`data-rulessec`, `role="button"`, with
`aria-expanded` and a caret) over a body (`data-rulesbody`), and carries its count — `(154)` — so a
shut section still says what is inside. Both start shut. State is a collapse map in
`settings.rulesCollapse`, where an absent key means "never touched" and falls back to `RULES_SECS`'
default. `renderRulesSections()` paints both, from `renderAll()` (a sheet loaded with cached rules)
and from `refreshRulesUI()` (a pack load). A click that lands on anything interactive inside the
heading — the glossary's + Add — keeps its own meaning and does not toggle. Both filter boxes are the
shared `.searchbox` with a × clear button.

**The glossary.** `allGlossary()` is the rules pack's `keywords` plus `character.glossary`.
`renderGloss()` lists "From rules pack · *pack name*" (the first 150 matches, then "…and N more —
type to filter") and "Your entries", each row with a preview; the player's own entries also have Edit
and Delete. Every term is read through `glossTerm()`: a pack keyword with no term is not listed (the
pool drops those, see [Rules packs](../architecture/rules-packs.md)), and a player's entry with none
is listed as "(no term)", so it can be given one or deleted; it never becomes a chip. `openGlossForm()` makes an entry of type Text or Rules image (a screenshot stored as a
data URL); a term is required. With no pack loaded the list opens on an Import rules files prompt.
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
`renderTables()` filters on name, owner and column labels, groups by `ownerKind` in `TBL_KINDS` order
(class, subclass, race, spell, item, feat, background, rule, then Other) and sorts by name; with none
loaded it shows an Import rules files prompt. `openTableView()` opens the modal: owner, kind and row
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
- **The Tables tab was blank on load.** `renderTables()` was in `refreshRulesUI()` but not
  `renderAll()`, so tables drew only after an import or a keystroke in the filter. → L1581
- **A table with no `rows` stopped every render** (#71). `renderTables()` read `t.rows.length`,
  and it runs in `renderAll()`, so one hand-written table without rows failed the whole sheet the
  way a keyword without a term did. `mergeRules()` checks only the name. → L4206
- **The glossary heading's + Add toggled the section** every time it was pressed, until the handler
  learned to ignore interactive children. → L3189

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where the fold state lives | `settings`, as a collapse map | On the character: the glossary and tables come from global packs, so folding on one sheet and finding them open on the next would surprise |
| Default fold state | Both shut; an absent key means untouched | Open: reaching a table meant scrolling past 154 glossary entries |
| An anchor whose table is not loaded | The words "the *Name* table" | A chip: it would open nothing, and the tables pack is a separate optional download |
| An anchor with no table sink active (converter) | Keep the old silent drop | Emitting an anchor: one with no table behind it is worse than the drop |
| Spell-slot columns in class tables | Skipped | Kept: the app derives slots by level, and a 10-column grid swamps a phone |
| Where tables are browsed | A card under the glossary on the Rules tab (#32) | Their own tab: one more tab to scroll past (changelog) |
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
