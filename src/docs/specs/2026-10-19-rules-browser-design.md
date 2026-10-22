# The Rules tab as a browser — design

**Status:** approved 2026-10-19 · wave 1 of [1.9.0](../wiki/roadmap/1.9.0.md), item D
**Issues:** #99 (Rules tab overhaul) with #53 (spells, feats and the rest in the Rules tab). One
branch, `issue/99-rules-browser`. Read [Rules & tables](../wiki/features/rules-and-tables.md),
[Rules packs](../wiki/architecture/rules-packs.md) and [Shell](../wiki/ui/shell.md) first.

---

## 1. What it is

The Rules tab becomes a browser over everything the loaded packs hold. A sidebar lists the
categories (Classes, Spells, Feats, Items, Glossary, Tables and the rest) with their counts and a
search across all of them. A category opens a table: sortable columns, its own search and the same
filters the Add pickers use. A row opens that entry's window, the one the sheet already uses. It is
for reading: nothing here adds to the character.

Why: a rules question mid-session means leaving the sheet for another site or guessing which picker
holds the answer. The tab today holds only the glossary and the reference tables.

## 2. Decisions

Settled with Mike: the categories and what a row opens on 2026-10-16 (the 1.9.0 page), the rest on
2026-10-19 (this brainstorm).

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Which categories | **Every loaded category, plus Glossary and Tables**, in a fixed order (§4); an empty one is hidden | Only what a character can add: leaves out subclasses, traits and conditions |
| 2 | What a row opens | **The existing info windows, unified**; feats, traits and items get one in the same style (§5) | One new generic modal: a second rendering of classes and spells that drifts. Inline expansion: a class makes the table unwieldy |
| 3 | Class, subclass and background windows from here | **Reference mode**: the same function with `{ref:true}`, showing the rules only, nothing about this character | The sheet's window as is: "your level 5" in a lookup. A "you have this" line: more to keep right for little |
| 4 | Narrow screens | **A list screen**: the categories are one screen, a table the next, with "← Categories" back | A chip row: categories scroll off the edge. A dropdown: the categories out of sight |
| 5 | Search | **One box above the sidebar searching every category**, as well as each table's own | Per-category only: finding "Hex" means guessing where it lives |
| 6 | Structure | **A new fragment, one generic table driven by a config per category**; the pickers' filter definitions move into shared builders | `openBrowse()` in a read-only mode: an overlay built for selecting and adding. A renderer per category: eleven searches, sorts and filter sets that drift |
| 7 | The pack | **A Source column everywhere**, and a Pack filter **only when more than one pack is loaded**, as the feat picker does | The pack chip row across the top: wanted, not now (2026-10-16) |
| 8 | Conditions | **Their own category**: glossary terms marked `cond` | Left inside Glossary: the one list a player reaches for most, buried |

## 3. Structure

- **`src/js/86-rules-browser.js`**, new, in `manifest.json` after `86-tables.js` and before
  `87-notes.js` (it uses `86-tables.js`'s `openTableView()` and `85-browse.js`'s builders). It
  holds the category configs, the table renderer, the sidebar, the cross-category search and the
  tab's state.
- **Shared filter builders**, moved out of the closures in `85-browse.js` (`browseItems`,
  `browseSpells`, `browseFeatures`) into named functions that both the pickers and the Rules tab
  call: `itemFacets(list)`, `spellFacets(list,opts)`, `featFacets(list)`, each returning the facet
  array `openBrowse()` takes today (`{key,label,options,default,match}` or `{key,label,match}`). The
  pickers' behaviour must not change; a test pins it (§9).
- **`src/html/40-rules.html`**: the two cards become one card holding the browser's shell (sidebar
  and table panes). Ids the boot wiring and tests use (`#glossSearch`, `#tablesSearch`,
  `#glossList`, `#tablesList`, `#btnAddGloss`, the import prompts) are replaced; every handler in
  `90-boot.js` that names them moves to the new ids, and nothing is left listening for an id that
  is gone.
- **CSS**: a new block in `35-tables.css` (the reference tables' file) for the sidebar, the table,
  sortable headers and the narrow layout. Tokens only, so both skins follow.
- **Render invariant** ([Rules & tables](../wiki/features/rules-and-tables.md)): `renderRulesBrowser()`
  replaces `renderGloss()`, `renderTables()` and `renderRulesSections()` in both `renderAll()` and
  `refreshRulesUI()`. The test that every `refreshRulesUI()` renderer is also in `renderAll()` stays.
- **`RULE_CATS` stays the single category list.** The browser's config table names categories by
  `RULE_CATS` keys; Conditions is a view over `keywords`, not a new key.

## 4. Categories

Order is fixed. A category with no entries is not listed. Every row is an entry; its name is
`dispName(entry,kind)`, so "Name (SRC)" appears only when two packs share a name.

| Category | Source data | Columns | Filters | Default sort |
|---|---|---|---|---|
| Classes | `classes` | Name · Hit die · Source | — | name |
| Subclasses | `subclasses` | Name · Class · Source | Class | class, then name |
| Species | `races` | Name · Size · Speed · Source | — | name |
| Backgrounds | `backgrounds` | Name · Feat · Source | — | name |
| Feats | `feats` | Name · Type · Prerequisite · Source | Type, No prerequisite (`featFacets`) | name |
| Traits | `features` | Name · From (`source` text) · Source | — | name |
| Spells | `spells` | Name · Level · School · Time · Source | Level, Class, School, Concentration (`spellFacets`) | level, then name |
| Items | `items` | Name · Category · Rarity · Cost · Source | Category, Rarity, Needs attunement (`itemFacets`) | name |
| Conditions | `keywords` with `cond` | Name · Source | — | name |
| Glossary | `keywords` without `cond`, and `character.glossary` | Term · Type · Source ("Yours" for the player's) | Your entries (a switch) | term |
| Tables | `tables` | Name · Rows · From (owner) | Kind (`TBL_KINDS`) | kind, then name |

- **Source** is the entry's `_source` (the pack); the player's glossary entries read "Yours".
- **Pack** filter: added to every category when the merged rules hold more than one `_source`.
- **The spell Class filter** defaults to *every* class here, not the character's classes as the
  picker does: this is a lookup, not a choice. `spellFacets(list,{classDefault:"all"})`.
- **Sorting**: tapping a column header sorts by it, again reverses; numbers sort as numbers, cost
  by gold value, level with cantrips first. The header shows the direction (`aria-sort`).
- **Fields read through the helpers** (`glossTerm()`, `tableRows()`, `featPickKind()`,
  `featPickPrereq()`, `itemMetaLine()`), never raw, so a malformed entry renders as blank cells
  rather than stopping the tab (#71).
- **Glossary** keeps **+ Add** (`openGlossForm()`) in its table's header, and the player's rows keep
  Preview, Edit and Delete. An entry with no term is listed as "(no term)", as today.
- **Long tables**: the first 300 rows render, then a "Show 300 more" button. Filters and search
  narrow before the cap applies.

## 5. Windows

A row's tap opens the entry by its `_id`. `ruleById()` already matches `_id` before name, so
`findClassDef()`, `findRaceDef()` and `findBackgroundDef()` take an id unchanged; the windows that
take a name pass the id through. Two packs' "Elf" each open their own.

| Category | Window | Change |
|---|---|---|
| Classes | `openClassInfo(idOrName,opts)` | `{ref:true}`: no current level, no subclass marker, nothing from `character.classes` |
| Subclasses | `openSubclassInfo(cls,sub,opts)` | `{ref:true}` as above |
| Species | `openRaceInfo(idOrName,opts)` | `{ref:true}`: no current-subrace marker |
| Backgrounds | `openBackgroundInfo(idOrName,opts)` | `{ref:true}`: the background's options, not the character's choices |
| Feats, Traits | **`openFeatInfo(entry)`**, new | the feat picker's preview body (`85-browse.js` `browseFeatures` `preview`), lifted out; the picker calls it |
| Items | **`openItemInfo(entry)`**, new | the item picker's preview body (`browseItems` `preview`), lifted out; the picker calls it |
| Spells | `openSpellView(s)` | none |
| Conditions, Glossary | `openGlossView(g)` | none |
| Tables | `openTableView(t)` | none |

- Without `opts`, every window behaves exactly as today: the sheet's calls do not change.
- The new viewers use the existing modal (`openModal()`), the `richHTML()` body and the emblem the
  picker shows, so they look like the others.

## 6. State

- **`settings.rulesCat`**: the category last opened, app-wide (the tab is not per character).
  Absent or unknown → the first listed category.
- **In memory, for the session**: each category's search text, filters and sort, and the
  cross-category query. Switching category keeps them; reloading clears them.
- **`settings.rulesCollapse`** is no longer read. It is left in place in stored settings (an unknown
  key is harmless) and its tests are replaced.
- Nothing new on the character. The player's glossary entries stay in `character.glossary`.

## 7. Layout

- **Wide** (over 640px): a two-column card. Left, the sidebar: the search box, then the categories,
  each with its count, the open one marked (`aria-current`). Right, the open category: its title
  and count, its search box, its filters (the pickers' facet look), the table.
- **Narrow** (640px and under, the breakpoint Settings uses for its icon rail): one pane at a time.
  The tab opens on the category list; a category opens its table with "← Categories" above it.
  Settings narrows to an icon rail instead; categories have no icons, so a list screen it is.
- **The table** scrolls horizontally inside its box on narrow screens rather than squeezing
  columns; Name stays the first column.
- **The ☰ flyout** lists the categories while the Rules tab is active; a tap opens one (and, narrow,
  shows its table). `buildToc()` gains a Rules-tab case; every other tab is unchanged.
- **No packs loaded**: the import prompt, as today, in place of the browser.

## 8. Search across everything

- The sidebar's box searches every listed category's display name (and a glossary term's text is
  not searched, only its term, as the glossary search does today).
- While it has text, the category list is replaced by results grouped by category, in the §4
  order: up to 8 rows each, then "N more in Spells →", which opens Spells with that text in its
  own search. A row opens its window. Clearing the box restores the list.
- Matching: case-insensitive substring, as every search in the app.

## 9. Testing

- **Configs**: every category in §4 has columns, a source list and a window; each row's open action
  resolves to its entry by `_id`.
- **Shared builders**: `itemFacets`, `spellFacets` and `featFacets` give the pickers the same options
  and matches they had (the pickers' existing tests keep passing; new tests pin the builders).
- **Sorting**: numeric, cost and level orders; reversing; a malformed entry sorts without throwing.
- **Reference mode**: `openClassInfo`, `openSubclassInfo`, `openRaceInfo`, `openBackgroundInfo` with
  `{ref:true}` contain nothing from the character; without it, unchanged.
- **Duplicates**: two packs with the same species name open two different windows.
- **Search**: grouping, the 8-row cap and the "more" link carrying the text.
- **Long tables**: the 300 cap and Show more.
- **Render invariant**: `renderRulesBrowser()` is in both `renderAll()` and `refreshRulesUI()`.
- **State**: `settings.rulesCat` survives a reload; an unknown value falls back.
- `./src/tests/run.sh` green; the `rules-data` suite's `RULES_SECS`/`rulesCollapse` and search-box
  tests are rewritten for the new markup.
- **Screenshots**: the Rules tab wide and at phone width (list screen, a table, a window opened from
  a row, the cross-category search), both skins; the item and feat pickers' preview after the lift,
  to show they are unchanged; driven: open a category, filter, sort, open a row, search, go back.

## 10. Docs

- [Rules & tables](../wiki/features/rules-and-tables.md): rewritten for the browser.
- [Shell](../wiki/ui/shell.md): the flyout's Rules-tab case.
- [Sections & layout](../wiki/ui/sections-and-layout.md): `RULES_SECS` and `rulesCollapse` gone,
  `settings.rulesCat`.
- The class, species, background and item/feat pages where they describe their windows.
- [Overview](../wiki/overview.md) code map: the new fragment.
- Ledger entry; `UNRELEASED.md`: "The Rules tab is now a browser: every class, species, background,
  feat, spell, item, condition, glossary term and table from your rules packs, in sortable tables
  with filters and a search across all of them. Tap a row to read it."

## 11. Out of scope

- Adding to the character from the Rules tab (#53 says so).
- The pack chip row across the top (decision 7).
- The features inside a class's or subclass's `levels` as rows of their own: they stay in the class
  window. (The Traits category is the packs' standalone `features` list, which is separate.)
- Fixing `openGlossView()`'s literal `[Table: …]` brackets (a known issue, separate).
- Persisting searches, filters or sort.

## As built (2026-10-22)

Built across four tasks ([the plan](../plans/2026-10-21-rules-browser.md)); every section below is
as specified except where noted. Ledger: `src/docs/_claude/WIRING-LEDGER.md`, "The Rules tab as a
browser (#99, #53, 2026-10-22)".

- **§1–§3 (what it is, decisions, structure)** — as specified. The new fragment is
  `src/js/86-rules-browser.js`, the 33rd JS fragment, after `86-tables.js`; the shared filter
  builders (`itemFacets()`, `spellFacets()`, `featFacets()`) and the lifted previews
  (`openItemInfo()`, `openFeatInfo()`) landed in `85-browse.js` as §3 describes.
- **§4 (categories) — four rulings beyond the literal text**, added by the plan's Global
  Constraints and carried through unchanged:
  - **The Glossary is always listed, even empty** (§4 only promises a non-empty category is
    listed), so its + Add stays reachable with no pack loaded.
  - **Subclasses lists `subclassesFor()` of every loaded class** — its own inline subclasses plus
    any standalone `rules.subclasses` entry naming it — not `rules.subclasses` alone as §4's source
    column literally says, because the SRD pack (and most packs) carry a class's subclasses inside
    the class record; the literal source would leave the category empty for an SRD-only player.
  - **Tables carries a Source column too**, beyond §4's shorter column list for it, because
    decision 7 ("a Source column everywhere") outranks it.
  - **The Pack filter is per category**, exactly matching decision 7's "only when more than one
    pack is loaded" read per category rather than app-wide; feats keep their own Pack filter from
    `featFacets()` rather than gaining a second one.
  - One UI addition §4 does not name: the filter pills sit behind a **Filters button that folds
    them away**, carrying the active count and a Clear button once any are set, so a category with
    several facets does not push its table below the fold by default.
- **§5 (windows)** — as specified: every row opens by `_id`; the four reference-mode windows show
  nothing of the open character; a class window's subclass link carries `data-sub-ref="1"` so
  following it from a reference-mode window stays in reference mode.
- **§6 (state)** — as specified: `settings.rulesCat` persists and falls back to the first listed
  category when the stored value is unknown or now empty; everything else lives in memory for the
  session; `settings.rulesCollapse` is left alone, unread.
- **§7 (layout) — as specified.** Two gaps found in this task's own QA were fixed in the
  final-review pass (ledger `## The Rules browser: final-review fixes (#99, 2026-10-22)`,
  [Rules & tables](../wiki/features/rules-and-tables.md), [Shell](../wiki/ui/shell.md)):
  - The tab now always reopens the category list the way §7 says "the tab opens on the category
    list" — `rbToList()` resets `rbUI.screen` when `selectTab()` enters the Rules tab from
    elsewhere, so a table left open on a previous visit no longer carries over.
  - The ☰ flyout's Rules-tab entries now scroll the chosen category into view after
    `rbOpenCat()` repaints it, via `scrollToCard(document.getElementById("rbCard"))`, matching
    every other tab's entries — picking a category from deep in a long table's scroll position no
    longer leaves the newly painted pane off-screen.
  - What already held as specified: the narrow one-pane-at-a-time screen with "← Categories" (which
    also returns focus to the category button just left); the table scrolling sideways inside its
    own box at 360–390px while the page itself does not scroll sideways.
- **§8 (search)** — as specified: the sidebar's box searches every category's display name only (not
  a glossary term's text); results group in `RB_CATS` order, 8 rows per category, then "*N* more in
  *Category* →", which opens that category with the text carried into its own box.
- **§9 (testing)** — as specified: the configs, shared builders, sorting, reference mode, duplicate
  same-named entries, search, the 300-row cap and the render invariant are each pinned in
  `sheet.js` / `rules-data.js`; `./src/tests/run.sh` is green. Screenshots and the driven checks are
  in the ledger entry; one substitution worth naming: the brief's example search, "fire", produced
  only 7 Spells hits in the real SRD pack (under the 8-row cap), so no "more in Spells →" link
  existed to follow — the one actually shown was Items' ("8 more in Items →"), and that is the link
  driven and shot.
- **§10 (docs)** — done: this page, the ledger, `rules-and-tables.md`, `shell.md`,
  `sections-and-layout.md`, `decisions.md`, `character-building.md`, `inventory.md`,
  `features-and-traits.md`, `1.9.0.md`'s wave table, and the `UNRELEASED.md` bullet.
- **§11 (out of scope)** — held: nothing here adds to the character; no pack chip row; no class
  feature rows of their own; `openGlossView()`'s literal brackets untouched; no persistence of
  search, filters or sort beyond the category itself.
