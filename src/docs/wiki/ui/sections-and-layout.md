# Sections & layout

Every tab is a column of **cards**, and most cards are **sections** with a stable id that the notes
feature, the combat view and print all key on. This page covers how the seven panels are laid out,
the `NOTE_SECTIONS` registry and the rules for tagging a card, and the conventions every list shares:
group headings with a caret, collapse state and where it is stored, favourites, collapse-all and
search boxes. It also covers two sidebar residents, familiars and the portrait.

**Code:** `NOTE_SECTIONS`, `noteDef()`, `noteTitle()`, `renderNoteIcons()`, `noteGroupOpen()` in
`87-notes.js` · `combatSectionsOf()`, `renderCombatToggles()`, `combatCard()` in `87-combat.js` ·
`featGroups()`, `renderFeatures()`, `featCol()`, `invCol()`, `atkCol()`, `FEAT_FAV`, `ATK_FAV` in
`20-lists.js` · `renderInventory()`, `renderFamiliars()` in `40-sheet.js` · `renderAttacks()` in
`60-attacks.js` · `rulesSecOpen()`, `renderRulesSections()` in `86-tables.js` · `setSecOpen()`,
`setSecHTML()` in `88-settings.js` · `buildStats()`, `buildBio()`, `blankChar()` in `00-constants.js`
· `renderPortrait()` in `66-coins-hp.js` · markup in `00-sheet.html`, `10-inventory.html`,
`20-spells.html`, `30-story.html`, `40-rules.html`, `60-journal.html`, `70-combat.html` · `10-chrome.css`,
`20-cards.css`, `30-sheet.css` ·
**Tests:** `rules-data.js` (registry against template, familiars layout, section heads, search boxes,
Settings and Rules sections), `sheet.js` (`featGroups()`, the shared favourites label) ·
**See also:** [Shell](shell.md), [Story & notes](../features/story-and-notes.md),
[Combat view](../features/combat-view.md), [Inventory](../features/inventory.md),
[Features & traits](../features/features-and-traits.md)

## How it works

### Seven panels, one fragment each

| Fragment | Panel | Layout | Section cards (`data-note`) |
|---|---|---|---|
| `00-sheet.html` | `#tab-sheet` | `.cols`: sidebar `.stack` + main `.stack` | sidebar: portrait, origin, class, familiars · main: abilities, skills, vitals, rest, statuses, attacks, resources, features |
| `10-inventory.html` | `#tab-inventory` | one `.stack`, centred, max 720px | inventory, coins |
| `20-spells.html` | `#tab-spells` | one `.stack` | spellcasting, slots, activespells, spells; plus `#concCard`, untagged ([Conditions & concentration](../features/conditions-and-concentration.md)) |
| `30-story.html` | `#tab-story` | `.cols` | proficiencies; `#bioStack` is filled by `buildBio()` with the eight bio cards, untagged by design |
| `40-rules.html` | `#tab-rules` | one `.stack` | none: two foldable cards ([Rules & tables](../features/rules-and-tables.md)) |
| `60-journal.html` | `#tab-journal` | one `.stack`, centred, max 820px: Journal (`#journalCard`), Section Notes | none: neither card takes a section note |
| `70-combat.html` | `#tab-combat` | `.cview`: header, live region, `#cvList` | none in markup: the real cards are moved in at runtime |

The panels concatenate in manifest order, which is not the tab-bar order (that lives in the
template). Only `.active` shows, so the two never need to agree. The gap at `50-` is the Tables tab
deleted in #32; prefixes are a reading aid and were not renumbered.

`.page` is capped at 1160px. `.cols` is a 320px sidebar beside a flexible main column. At ≤820px it
becomes one column and `.stack` becomes `display:contents`, so every card is a direct grid item of
`.cols`. That lets one `order:1` sink `#familiarCard` and `#addFamiliarLink` below the main column
instead of above HP and Skills. It costs nothing because `.stack` carries one rule and its gap equals
`.cols`'s.

### The section registry

`NOTE_SECTIONS` in `87-notes.js` lists 19 sections as `{k, tab, title}`. Each one's card carries
`data-note="k"` as the attribute right after `class="card"`. Its consumers:

- **Notes.** `renderNoteIcons()` puts a note button in each card's `.label`, `notesHTML()` groups
  the Journal tab's Section Notes card by `tab`, and notes are stored in `character.secNotes[k]`
  ([Story & notes](../features/story-and-notes.md)).
- **Combat view.** `combatSectionsOf()` filters the saved `combatSections` down to registry ids,
  `renderCombatToggles()` puts a toggle before the note button, and `combatCard()` looks the card up
  fresh on every call ([Combat view](../features/combat-view.md)).
- **Print** lists section notes in registry order; `jumpToNote()` uses `tab` to pick the tab.

The ☰ flyout does **not** use the registry. It walks the DOM (see [Shell](shell.md)).

`noteTitle()` returns the registry title, except for `origin`, whose heading depends on the skin
("Race" or "Ancestry" & Background, from `raceTerm()`).

Card headings are live. A `.label` can hold `#starBtn`, `#encPill` or `#roundNum`, so injected
controls replace only their own button (`outerHTML`) or insert beside it, never
`label.innerHTML +=`. The note button parks at the far right with `margin-left:auto`, and the combat
toggle goes just before it.

### Group headings: `.fgroup` / `.fghead` / `.fcaret`

One idiom for every foldable group inside a card or modal:

```html
<div class="fgroup">
  <div class="fghead" data-…><svg class="fcaret [c]" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
    <span class="fgname">Title</span><span class="cnt">(N)</span></div>
  …body…
</div>
```

The caret is drawn pointing right. `.fcaret` turns it 90° to point down (open), and `.fcaret.c`
leaves it pointing right (shut). The users are the Features & Traits groups (`data-fgroup`), the
Section Notes card (`data-notegroup`) and the Settings sections (`data-setsec`). The inventory sections and
the Attacks card's Favorites / Attacks split use `.inv-sec-head`, which shares the one rule
`.fghead,.inv-sec-head` (a solid 1.5px `--line` rule and an 8px gap) but carries its text directly
rather than in `.fgname`. The Rules tab's two card headings are `.label.rules-head` with the same
caret. Rows inside a group fold individually through a `.fitoggle` button holding its own `.fcaret`
(features, items, attacks).

A **count** goes in `.cnt`, plain and in brackets. A **badge** such as "12 entries" or the
character's name goes in `.fgcount`, a pill pushed right.

### Collapse state: character or settings

| Map | Lives on | Keyed by | Read through |
|---|---|---|---|
| `featCollapse.groups` / `.items` | character | group label / feature id | `featCol()` |
| `invCollapse.sections` / `.items` | character | section name / item id | `invCol()` |
| `atkCollapse.items` | character | attack id | `atkCol()` |
| `noteCollapse` | character | tab | `noteGroupOpen()`, `toggleNoteGroup()` |
| `setCollapse` | settings | Settings section id | `setSecOpen()` |
| `rulesCollapse` | settings | `gloss` / `tables` | `rulesSecOpen()`, `setRulesSecOpen()` |

Every map stores `true` for **shut**, and an absent key means "never touched", which falls back to
a default. Character lists default open. `SET_SECTIONS[].open` opens Appearance and This character
and shuts Rules data, Backup and Credits. `RULES_SECS[].open` shuts both Rules cards. The accessors
repair or ignore a wrong shape (a hand-edited file) rather than trusting it, and `migrate()`
guarantees the character maps are objects. Group labels double as keys: `FEAT_FAV` and `ATK_FAV`
are the same string, "★ Favorites", which is also how `invCollapse.sections` holds that section.

**Collapse all** exists on Inventory (items), Attacks (items) and Features (groups). Its label is
"Collapse all" while anything is open and "Expand all" once everything is shut, and the button hides
on an empty list. Spells and Statuses have no collapse state.

### Favourites

A `.fav` ★/☆ button sits on items (`data-fav-item`), features (`data-fav-feature`) and attacks
(`data-fav-attack`). Items and features are **moved**, not copied, into a "★ Favorites" group at the
top, sorted by name; the rest keep their own grouping (`invSection()` for items, the granting
origin for features, see `featGroups()`). Attacks keep favourites first in the order they were
added, and draw headings only when something is starred. A star changes no derived number, so it
never calls `recompute()`.

### Search boxes

`.searchbox` wraps an input with a placeholder and a `button.search-clear`. CSS shows the × only
while the box has text, using `:placeholder-shown`, so no script tracks it. The click handler in
`wire()` empties the box and dispatches the same bubbling `input` event typing sends, so each box's
own listener re-filters unchanged. There are three: `#glossSearch`, `#tablesSearch`, and
`#brSearch`, shared by the item, spell and feature finders.

### Familiars

`#familiarCard` and `#addFamiliarLink` are one control in the sidebar, under Class.
`renderFamiliars()` shows exactly one of them: the card once a familiar exists, the "Add a familiar"
button until then. It clears the list before its early return, because the combat view shows the
card even when empty. `openFamiliarForm()` edits a record of name, type (`kind`), `ac`,
`hp.cur`/`hp.max`, `speed`, `description`, `effects` and `active`. Its effects count only while it is
summoned: `contributions()` adds them when `active` is true, labelled with the familiar's name and
"(summoned)". Row wrapping for the narrow column is scoped to `#familiarList`.

### Portrait

The first sidebar card (`data-note="portrait"`) holds the image plus name, alignment, XP, level and
proficiency bonus. Add image opens a file input. `FileReader` turns the file into a data URL stored
as `character.portraitImg`, at full size with no downscaling, and `renderPortrait()` draws it through
`imgHTML()` as an `<img>` in a square, `object-fit:cover` frame. An imported file controls that
string, so it is escaped and must be a data: URL; anything else (a web address, javascript:) shows
the "No portrait yet" placeholder instead. See [Rich text](../architecture/rich-text.md). The field is
optional and not in `blankChar()`; `migrate()` keeps it because it keeps every field.

## Rules that must hold

- **Registry and template agree both ways.** `rules-data.js` asserts 19 entries, unique ids, a card
  for every entry, an entry for every tagged card, no card tagged twice, and each title equal to its
  heading (except `origin`).
- **Section ids are stable and never derived from a heading.** A note or a saved combat layout is
  keyed by `k`, and a reworded heading must not orphan it.
- **`data-note` comes straight after `class="card"`.** The 19-card test counts the literal prefix
  `<div class="card" data-note="`, so an `id` placed first hides the card from it.
  `#familiarCard` and `#skillsCard` put their ids last for this reason.
- **A section's card is hidden, never removed.** Familiars and Active Spells are `display:none`
  until they have content, and Skills is hidden in the grouped ability layout (`buildStats()`). The
  registry, the card count and every id lookup need them in the document.
- **The familiar pair stays adjacent, and their ids stay unique and unrenamed.**
  `renderFamiliars()` and `wire()` both look them up without a guard. A missing id throws, and in
  `wire()` that leaves every later listener unbound.
- **The ≤820px query sits below the `.stack` rule and holds both halves.** `display:contents` may
  appear once in `10-chrome.css` and only inside the query (asserted); at top level it would flatten
  the desktop layout.
- **`.inv-sec-head` keeps its name.** `buildToc()` and the `[data-invsec]` handler depend on it.
- **Headings in a `.label` stay ToC-clean.** See [Shell](shell.md).
- **Every search box has a placeholder**, or its × never hides.
- **Collapse maps store "shut", and a missing key is the default.** Changing a default then only
  affects sections nobody has touched.

## Traps

- **The phone fix that did nothing.** The ≤820px query was first written above `.stack{display:grid}`.
  At equal specificity the later rule wins, so `display` quietly stayed `grid`. The test asserting
  the rule existed passed. It now asserts the order too (L2242).
- **`flex-wrap` alone did not wrap the familiar row.** `.item .nm` is `flex:1 1 0` with
  `min-width:0`, so flex always found "room" on line one and squeezed the name to 12px. The name
  needs `flex-basis:100%`. The fix is scoped to `#familiarList`, because an unscoped `.item .top`
  wrap would restyle Statuses (L2242).
- **The test slicer and HTML comments.** The `block` helper in `rules-data.js` finds an element by
  counting `<div>`s, and a comment quoting the markup it described broke that within minutes.
  Comments are now stripped first (L2242).
- **`.fgname{flex:1}`** pushed the count to the far right, not beside the title. It is now
  `flex:0 1 auto` (L3123).
- **`.fgcount` is not always a count.** Settings passes badges through it, which would read absurdly
  in brackets, so counts moved to `.cnt` (L3123).
- **The inventory caret pointed left when open.** It was drawn pointing down and then turned another
  90° by the shared `.fcaret`. It is now drawn like the Features caret (L3525).
- **The Rules glossary heading contains its own "+ Add".** A bare `closest` on `[data-rulessec]`
  folded the section whenever you reached for Add, so the handler ignores clicks on anything
  interactive inside the heading (L3189).

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How is a section identified? | A stable `k` in `NOTE_SECTIONS` | A heading-derived id: headings get reworded, and notes keyed to one would be orphaned |
| The `origin` title on the Notes tab | Ask `noteTitle()`, which asks `raceTerm()` | Quoting the registry: on the classic skin the Notes tab would disagree with the card it links to |
| Familiars on a phone | Flatten `.stack` inside the ≤820px query and sink the pair with `order:1` | `order` alone: it only reorders siblings, so a sidebar card can never pass the other column's cards |
| Where the familiar row may wrap | Only in `#familiarList` | Unscoped `.item .top{flex-wrap:wrap}`: silently restyles Statuses, where one row is right |
| A collapsible in Settings | Reuse `.fgroup` / `.fghead` / `.fcaret` | A second collapsible: the app should not have two things that look like a section header |
| How collapse state is stored | As shut = `true`, absent = default, so a default can change without reopening what a player shut | Storing "open" (named and set aside at L1741) |
| Where Rules-tab folding is stored | `settings.rulesCollapse` | On the character: the glossary and tables come from global packs, and folding them on one character to find them open on the next would surprise |
| Colour of group names | `--accent`, set on the shared `.fgname` rule | Scoping the change to Features: the owner chose consistency |
| Counts and badges in a heading | Counts in `.cnt`, badges keep the `.fgcount` pill | One style for both: a badge like "12 entries" reads absurdly in brackets |
| Order of favourite attacks | The order they were added | Sorted: the list is short and hand-built, so a row stays where the player put it |
| Headings on the Attacks card | Only when something is starred | Always: a lone "Favorites" or a bare "Attacks" over the whole list is noise |
| The shared section-head rule | `.fghead,.inv-sec-head` share one rule; the inventory class keeps its name | Renaming `.inv-sec-head`: `buildToc()` and the `[data-invsec]` handler depend on it |
| Fragment prefixes after the Tables tab went | Left as they were (`50-` is a gap) | Renumbering: pure churn, since the manifest is the authoritative order |

## Open

- **Keyboard reach of group headings is uneven.** Notes and Settings headings are
  `role="button" tabindex="0"` with Enter/Space handlers. The Rules-tab headings have the role,
  `tabindex` and `aria-expanded` but no key handler (only `click` toggles them). Features group
  heads and inventory section heads are not focusable at all.
- The Attacks card's headings reuse `.inv-sec-head`, inheriting its `cursor:pointer`, but
  `data-atksec` has no handler, so they do not fold.
- At phone width an attack row's name runs into its type label behind the to-hit pill, and a
  feature row's name crowds its source tag (seen at L3525, pre-existing).
- Active Spells, Familiars and Skills (in the grouped layout) are hidden when empty, so their note
  button and combat toggle are unreachable until they have content (L3397).
- A portrait is stored at full size, against the localStorage quota.
- More: [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Inventory sections that collapse, a ★ Favorites section, `invCollapse.sections` (first commit; the work predates the repo). → ledger L256
- 2026-08-11 — `NOTE_SECTIONS`: 19 sections, `data-note` on each card, checked against the template both ways. → ledger L1535
- 2026-08-11 — Settings split into collapsible sections on the shared `.fgroup` idiom; `setCollapse` stores "shut". → ledger L1741
- 2026-08-15 — Familiars move into the left sidebar; the phone layout flattens `.stack` and sinks the pair. → ledger L2242, #27
- 2026-08-17 — The Tables tab folds into Rules; the registry is untouched and `50-` stays a gap. → ledger L2714, #32
- 2026-08-18 — Attacks gain favourites and collapse-all; `.fgname` takes `--accent`; counts move to `.cnt`. → ledger L3123
- 2026-08-18 — The Rules tab's two sections fold and start folded, stored in `settings.rulesCollapse`. → ledger L3189
- 2026-09-24 — The combat view keys its section list on the registry ids. → ledger L3397, #9, #10, #11
- 2026-09-24 — One section-heading rule for `.fghead` and `.inv-sec-head`; the inventory caret redrawn; a clear button in every search box. → ledger L3525, #51, #49
- 2026-09-25 — Hit Dice move from Vitals into Rest & Recovery. → ledger L3676
- 2026-09-28 — The portrait is escaped and drawn only from a data: URL. → ledger L3940
- 2026-09-29 — The Notes tab is the Journal tab (`tab-journal`); the notes print as "Section notes". → ledger L4756, #39
- 2026-09-29 — Journal pages: tags, search, timestamps, the page rule; the card and its editor. → ledger L4793, #40
