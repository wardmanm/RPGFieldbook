# Sections & layout

Every tab is a column of **cards**, and most cards are **sections** with a stable id that the notes
feature, the combat view and print all key on. This page covers how the seven panels are laid out,
the `NOTE_SECTIONS` registry and the rules for tagging a card, and the conventions every list shares:
group headings with a caret, collapse state and where it is stored, favourites, collapse-all and
search boxes. It also covers the Sheet's own grid: the header band over a dark rail, the ability
strip, and familiars, which open from the header.

**Code:** `NOTE_SECTIONS`, `noteDef()`, `noteTitle()`, `renderNoteIcons()`, `noteGroupOpen()`,
`EDIT_CARDS`, `editHidden()`, `setEditHidden()`, `editCardTitle()`, `editToggleHTML()`,
`renderEditToggles()`, `toggleEditCard()` in `87-notes.js` · `combatSectionsOf()`,
`renderCombatToggles()`, `combatCard()`, `combatAddable()` in `87-combat.js` ·
`featGroups()`, `renderFeatures()`, `featCol()`, `invCol()`, `atkCol()`, `FEAT_FAV`, `ATK_FAV` in
`20-lists.js` · `renderInventory()`, `invGroups()`, `renderFamiliars()`, `renderSheetHead()`,
`famFlyHTML()`, `openShFly()`, `openFamiliar()` in `40-sheet.js` ·
`groupFieldHTML()`, `groupChoices()`, `groupNameProblem()`, `syncGroupFieldMsg()`, `groupFieldBlocked()` in
`80-modal-forms.js` · `GROUP_RESERVED` in `00-constants.js` · `tagLabel()`, `tagTidy()` in `87-journal.js` · `renderAttacks()` in
`60-attacks.js` · `rulesCatOf()` in `86-rules-browser.js` · `setPageOf()` in `88-settings.js` · `buildStats()`, `buildBio()`, `blankChar()` in `00-constants.js`
· `renderPortrait()` in `66-coins-hp.js` · markup in `00-sheet.html`, `10-inventory.html`,
`20-spells.html`, `30-story.html`, `40-rules.html`, `60-journal.html`, `70-combat.html` · `10-chrome.css`,
`20-cards.css`, `30-sheet.css` ·
**Tests:** `rules-data.js` (registry against template, the Sheet grid and its queries, section heads, search boxes,
Settings and Rules sections), `sheet.js` (`featGroups()`, the shared favourites label) ·
**See also:** [Shell](shell.md), [Story & notes](../features/story-and-notes.md),
[Combat view](../features/combat-view.md), [Inventory](../features/inventory.md),
[Features & traits](../features/features-and-traits.md)

## How it works

### Seven panels, one fragment each

| Fragment | Panel | Layout | Section cards (`data-note`) |
|---|---|---|---|
| `00-sheet.html` | `#tab-sheet` | the header (`<header class="card sheet-head">`), then `.sheet-grid` | portrait (the header) · the grid: vitals (the rail), abilities (the strip), skills, then in `.col-r` defences, statuses, resources; features full width; familiars hidden |
| `10-inventory.html` | `#tab-inventory` | one `.stack`, centred, max 720px | attacks, inventory, coins |
| `20-spells.html` | `#tab-spells` | one `.stack` | spellcasting, slots, activespells, spells; plus `#concCard`, untagged ([Conditions & concentration](../features/conditions-and-concentration.md)) |
| `30-story.html` | `#tab-story` (the **Bio** tab) | `.cols` | proficiencies ("Proficiencies, Senses & Languages"); `#bioStack` is filled by `buildBio()` with the eight bio cards, untagged by design |
| `40-rules.html` | `#tab-rules` | one `.stack` | none: one card, the Rules browser ([Rules & tables](../features/rules-and-tables.md)) |
| `60-journal.html` | `#tab-journal` | one `.stack`, centred, max 820px: Journal (`#journalCard`), Trackers (`data-note="trackers"`), Section Notes | Trackers only |
| `70-combat.html` | `#tab-combat` | `.cview`: header, live region, `#cvList` | none in markup: the real cards are moved in at runtime |

The panels concatenate in manifest order, which is not the tab-bar order (that lives in the
template). Only `.active` shows, so the two never need to agree. The gap at `50-` is the Tables tab
deleted in #32; prefixes are a reading aid and were not renumbered.

`.page` is capped at 1160px. `.stack` is a column of cards with a 12–18px gap (it scales with the width) at
every width. `.cols`, now only on Bio, is a 320px sidebar beside a flexible main column, one column
at ≤820px.

### The Sheet: a header over a grid (#103)

The Sheet is one condensed page after Foundry VTT's sheet (spec
`2026-10-23-sheet-makeover-design.md`):

- **The header** is a band across the top, `<header class="card sheet-head" data-note="portrait">`:
  the name and the class line, then one row: Short rest, Long rest, the paw, the star, the level
  ring with the XP, and the note button last (Mike's order). The rests read "Short rest" /
  "Long rest" and show their icons instead with Icon tabs on or at ≤860px, the tab bar's own rule.
  It is the `portrait` section, titled "Character"; that row is a `.label sh-bar` whose caption
  "Character" is visually hidden, so the note button and the ☰ entry find it like any card
  heading. The level badge (`#shLevel`) is the `.label`'s last child, so the note button
  `renderNoteIcons()` appends lands after the XP bar; the ☰ strips `.sh-level` with the buttons, so
  its entry still reads "Character". The header has no combat toggle (`nocv`). What it does is on [Vitals & rest](../features/vitals-and-rest.md)
  and [Character building](../features/character-building.md).
- **`.sheet-grid`** (`10-chrome.css`) holds the rest: `minmax(220px,260px) minmax(0,1.3fr)
  minmax(0,1fr)`. The **rail** (`card rail`, the `vitals` section) spans the left column's four
  rows, so it never stretches the others. The **strip** (`card strip`, `abilities`) runs over the
  other two columns; under it two **independent stacks** sit side by side (Mike's ruling):
  **`.col-m`** (Skills, Features) and **`.col-r`** (Defences, Statuses, Resources), each its own
  grid, so no card waits on its neighbour's row and Features follows Skills directly.
- **Two columns at ≤1000px:** the rail beside one column of the strip (3 × 2), Skills and `.col-r`;
  Features full width under both, as widths.html. `.col-m` becomes `display:contents` inside that
  query so Skills and Features are grid items of their own; `.col-r` stays a stack.
- **One column at ≤700px**, in the spec's order: rail, abilities, Defences, Statuses, Skills,
  Resources, Features. Both stacks become `display:contents` inside that query, so their cards are
  grid items and `order` can interleave them.
- **The rail is dark by its own tokens.** `.rail` re-points `--panel`, `--ink`, `--ink-soft`,
  `--line` and the field tokens to `--rail-*` (all four palettes in `00-tokens.css`), so the
  cards' own rules draw it dark without a second set of selectors. In dark mode the rail is tinted
  (forest green in Humblewood, slate in Classic) rather than darker, because the page ground is
  already near-black.
- **The phone header** (≤480px, `30-sheet.css`) tightens its gaps and the XP box so the icons and
  the level badge share one row under the name.

### The section registry

`NOTE_SECTIONS` in `87-notes.js` lists 18 sections as `{k, tab, title}`, with `nocv:true` on the
one the combat view may not take (`portrait`, the header). Each one's card carries `data-note="k"`
as the attribute right after its class attribute (`class="card"`, or `card` plus one layout class:
`card rail`, `card strip`, and the header's `card sheet-head`). Its consumers:

- **Notes.** `renderNoteIcons()` puts a note button in each card's `.label`, `notesHTML()` groups
  the Journal tab's Section Notes card by `tab`, and notes are stored in `character.secNotes[k]`
  ([Story & notes](../features/story-and-notes.md)).
- **Combat view.** `combatSectionsOf()` filters the saved `combatSections` down to registry ids
  the view may take (`combatAddable()`), `renderCombatToggles()` puts a toggle before the note
  button of each of those, and `combatCard()` looks the card up fresh on every call
  ([Combat view](../features/combat-view.md)).
- **Print** lists section notes in registry order; `jumpToNote()` uses `tab` to pick the tab.

The ☰ flyout does **not** use the registry. It walks the DOM (see [Shell](shell.md)).

`noteTitle()` returns the registry title. (It once varied `origin`'s by skin; that card went with
#103.)

Card headings are live. A `.label` can hold `#starBtn` (the header's), `#encPill` or `#roundNum`, so injected
controls replace only their own button (`outerHTML`) or insert beside it, never
`label.innerHTML +=`. The note button parks at the far right with `margin-left:auto`, and the combat
toggle goes just before it.

### Hideable edit buttons (#97)

Every card that lists things with edit, delete or remove buttons gets a pencil in its header,
before the combat toggle and the note button (so the note keeps the far right): pencil, combat,
note. A tap hides that card's edit, delete and remove buttons — a bin or a chip's Remove is one
mis-tap from losing a feature, an item or a resistance — and leaves every play control alone (stars,
folds, Use, Fire, Throw, Cast, equip, On/Off, prepared pins, resource −/+/reset, the familiar's
Summoned switch, + Add). One switch per card, per character, shown by default.

`EDIT_CARDS` in `87-notes.js` lists the eleven keys: the nine `NOTE_SECTIONS` ids `statuses`,
`attacks`, `resources`, `features`, `spells`, `inventory`, `trackers`, `defences`,
`proficiencies` (the last two hide the chips' ×), plus
`journal` and `secnotes` — the two cards outside that registry, found by id (`#journalCard`,
`#notesCard`, which the Section Notes card carries for this). A class's, species' or background's
Remove sits behind the header's flyout or info window, with a confirm, so those carry `ed` but no
pencil reaches them: stored `editHide.class` / `.origin` are left and ignored. `familiars` left
the list too: its card is hidden on the Sheet, so its pencil was out of reach, and Edit and Delete
now sit in the familiar's own window, which is not a list in play. Its buttons keep `ed` (inert) for
the guard, and a stored `editHide.familiars` is ignored. `character.editHide` maps a key to
`true` when hidden; absent or anything but a literal `true` reads as shown (see
[Character model](../architecture/character-model.md)).

**How it hides: CSS, not a render check (spec decision 6).** Each edit/delete/remove button carries
the class `ed`, beside its existing classes; a hidden card's root carries `ed-off`; one rule,
`.ed-off .ed{display:none!important}`, does the rest (`20-cards.css`). No renderer reads the flag,
so a card whose renderer rebuilds its rows — a feature's fold, a new item, a re-sorted list — stays
hidden for free, instead of ten renderers each gaining a condition that can drift.

`editHidden()`, `setEditHidden()`, `editCardTitle()`, `editToggleText()`, `editToggleSVG()`,
`editToggleHTML()` (pure) and `editCard()` are the small pieces; `renderEditToggles()` draws one
button per `EDIT_CARDS` entry and sets `ed-off` both ways (so switching to a character who hides
nothing clears the last one's), mirroring `renderCombatToggles()`: idempotent, replacing only its
own button, never `label.innerHTML +=`. A tap (`toggleEditCard()`, wired in `90-boot.js` on
`[data-edtoggle]`) flips the map, toggles `ed-off` on the card, **repaints the one button in place**
rather than replacing it — so a keyboard Enter on the pencil keeps focus on it — and
`scheduleSave()`s; no list re-renders. Hiding or showing Journal also re-runs `renderJournal()`,
since a blank page's empty-state line names the Edit button and must read "Nothing written yet."
with no "— tap Edit" once it's gone.

**Names.** The button class is `edbtn` and its hook is `data-edtoggle`, not `editbtn` /
`data-edit`: those already name the Bio tab's rich-text "Edit" button (`buildBio()`,
`00-constants.js`), and reusing them would have collided both as a CSS selector and as a
click-delegation key.

**Look.** Shown: a plain pencil, faint (`--hair`). Hidden: the same pencil with a slash through it
(an extra `<path>` from `editToggleSVG()`), in `--accent`, `aria-pressed="true"` — so a card in
"locked" state is the one that stands out, matching the combat toggle's and note button's idiom.
Title is the action ("Hide edit buttons" / "Show edit buttons"); the aria-label adds the card's
title via `noteTitle()` — "Hide edit buttons — Features & Traits".

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
Section Notes card (`data-notegroup`). (Settings used it for its sections until #107 made it a sidebar of pages.) The inventory sections and
the Attacks card's Favorites / Attacks split use `.inv-sec-head`, which shares the one rule
`.fghead,.inv-sec-head` (a solid 1.5px `--line` rule and an 8px gap) but carries its text directly
rather than in `.fgname`. Rows inside a group fold individually through a `.fitoggle` button holding its own `.fcaret`
(features, items, attacks).

A **count** goes in `.cnt`, plain and in brackets. A **badge** such as "12 entries" or the
character's name goes in `.fgcount`, a pill pushed right; nothing uses it since Settings became a sidebar (#107).

### The group field

Wherever a player types a label that files a record into a group, the box is one control,
`groupFieldHTML()` (#98): a labelled text box with a datalist of the groups already in use, so an
existing group is a tap and a new one is just typed. `groupChoices()` dedupes the offered labels by
`tagKey()` (first spelling kept) and sorts them A to Z. Its users:

| Field | Groups | Empty means |
|---|---|---|
| A journal page's Tag | the page list's tag groups | Untagged |
| A tracker's Tag | the Trackers card's tag groups | Untagged |
| A feature's Source | the Features & Traits groups (`featGroups()`) | where it came from, named in the placeholder |
| An item's Category | the inventory sections (`invGroups()`) | the section its own data puts it in, named in the placeholder |

Every user groups case-blind by `tagKey()`, so what the box offers and what the list draws agree.

**Reserved names.** No group may be named for an `Object.prototype` property — `constructor`,
`__proto__`, `toString` and the rest (`GROUP_RESERVED`, compared lower-cased). The collapse maps are
plain objects read by key, so such a group used to read an inherited value: folded from the start,
or never foldable. `tagLabel()`, which every grouping reads, turns one into no group, so a name from
a file is caught too. Typed in the box, `syncGroupFieldMsg()` names the word under it (`.grp-msg`)
and marks it `aria-invalid`, and `groupFieldBlocked()` stops the form's Save — the tracker form's
Close now and the journal's Done too — with the box focused.

Spells have no such field: they group by level, and their Origin is a fixed list of kinds that
decides what counts against the allotment.

### Collapse state: character or settings

| Map | Lives on | Keyed by | Read through |
|---|---|---|---|
| `featCollapse.groups` / `.items` | character | group label / feature id | `featCol()` |
| `invCollapse.sections` / `.items` | character | section name / item id | `invCol()` |
| `atkCollapse.items` | character | attack id | `atkCol()` |
| `noteCollapse` | character | tab | `noteGroupOpen()`, `toggleNoteGroup()` |
| `rulesCat` | settings | the category last opened | `rulesCatOf()` |

Every map stores `true` for **shut**, and an absent key means "never touched", which falls back to
a default. Character lists default open. Settings
keeps no collapse map since #107: it remembers the page last viewed (`settings.setPage`), and the old
`settings.setCollapse` is no longer read. The accessors
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
own listener re-filters unchanged. Among them: `#rbSearch` over the Rules tab's categories,
`#rbCatSearch` in the open category (built with the pane, so its listener is delegated on
`#rbMain`), and `#brSearch`, shared by the item, spell and feature finders.

### Familiars

Familiars open from the header (#103, spec §6.6). While `character.showFamiliars` is on, the
header shows a paw (`pawHTML()`), faint when there is no familiar. Tapping it opens the
header's popover (`openShFly()` with `famFlyHTML()`): each familiar's name with ● (summoned) or
○ (dismissed), **+ Add familiar**, then the section's two controls the hidden card's heading used to
carry: **Combat view** on/off (`role="menuitemcheckbox"`, `data-combatbtn="familiars"`) and
**Add a note** / **Edit note** (`data-notebtn="familiars"`). Both are the existing delegated hooks,
which run after the popover closes. A name opens a modal (`openFamiliar()`) with that
familiar's card (`familiarCardHTML()`: kind, AC, HP, speed, notes) and its Summon / Dismiss (a
button with `aria-pressed`; after the modal repaints, focus goes back to it), Edit
and Delete. Settings → Sheet display → "Familiars & companions icon" is the switch; `migrate()`
sets it once from whether the sheet has a familiar, and adding the first familiar turns it on.

`#familiarCard` stays in the Sheet's markup, always `display:none` there, with the old
`#addFamiliarLink` hidden beside it: the combat view still takes the card (its CSS shows it there),
and its note keeps its key. `renderFamiliars()` fills its list, clearing it before its early return,
because the combat view shows the card even when empty. `jumpToNote('familiars')` scrolls to the
header and opens the paw's popover, hung from `#sheetHead .sh-bar` when the paw is hidden.
`openFamiliarForm()` edits a record of name, type (`kind`), `ac`,
`hp.cur`/`hp.max`, `speed`, `description`, `effects` and `active`. Its effects count only while it is
summoned: `contributions()` adds them when `active` is true, labelled with the familiar's name and
"(summoned)". Row wrapping is scoped to `#familiarList` (and the modal's copy).

### List rows on a narrow screen

Attack, feature, item and condition rows (`renderAttacks()`, `featItemHTML()`, `invItemHTML()`,
`statusRowHTML()`) put everything after the name (labels, the to-hit pill, toggles, buttons) in one
`.row-meta` group, and mark their `.top` as `.split`. A split row may wrap: the name asks for 6em,
and when the name and the group don't fit side by side, the group drops to its own line whole,
right-aligned, while the name keeps the line above. The group may also wrap inside itself, for an
item with many labels. On a wide screen every row is one line. The layout is opt-in by `split`, so
the other `.item` rows (inventory totals, notes, Active Spells, familiars) are unchanged (#57).

### Portrait

The portrait sits at the top of the rail (`.rail-pic`, in the `vitals` section), with the AC
shield over its bottom edge and two small buttons, + (add) and × (remove). The name, XP and level
are in the header; alignment is on Bio; the proficiency bonus is a rail badge. Add image opens a file input. `FileReader` turns the file into a data URL stored
as `character.portraitImg`, at full size with no downscaling, and `renderPortrait()` draws it through
`imgHTML()` as an `<img>` in a square, `object-fit:cover` frame. An imported file controls that
string, so it is escaped and must be a data: URL; anything else (a web address, javascript:) shows
the "No portrait yet" placeholder instead. See [Rich text](../architecture/rich-text.md). The field is
optional and not in `blankChar()`; `migrate()` keeps it because it keeps every field.

## Rules that must hold

- **Registry and template agree both ways.** `rules-data.js` asserts 18 entries, unique ids, a card
  for every entry, an entry for every tagged card, no card tagged twice, and each title equal to
  the heading inside that card's own element (sliced to its closing tag, so a card that lost its
  `.label` cannot borrow the next card's).
- **Section ids are stable and never derived from a heading.** A note or a saved combat layout is
  keyed by `k`, and a reworded heading must not orphan it.
- **`data-note` comes straight after the class attribute.** The card-count test counts
  `<div class="card( layout-class)?" data-note="` plus the header's opening, so an `id` placed first
  hides the card from it. `#familiarCard` and `#skillsCard` put their ids last for this reason.
- **A section's card is hidden, never removed.** Familiars is always `display:none` on the Sheet
  and Active Spells until it has content. The registry, the card count, the combat view and every
  id lookup need them in the document.
- **The familiar ids stay unique and unrenamed.** `renderFamiliars()` and `wire()` both look
  `#familiarCard`, `#familiarList` and `#addFamiliarLink` up without a guard. A missing id throws,
  and in `wire()` that leaves every later listener unbound.
- **A media query comes after the rule it overrides.** `rules-data.js` pins the grid's ≤1000px and
  ≤700px queries after `.sheet-grid`, and 30-sheet.css's strip (≤1000px) and rail (≤700px) queries
  after `.strip .abilities` and `.rail`. `display:contents` on `.col-m` (≤1000px) and on both
  stacks (≤700px) lives only inside those queries, scoped to `.sheet-grid`; an unscoped `.stack`
  rule once broke every one-stack tab.
- **A card goes home to its own stack.** The combat view leaves a marker where each card was, inside
  `.col-m` or `.col-r`, and puts the card back in its place; `sheet.js` checks this against the real
  markup.
- **The header is not combat-addable** (`nocv`). Its rests are not a fight action, and the portrait
  rides in with Vitals; a saved `portrait` in the view becomes `vitals` in `migrate()`.
- **One group field.** A free-text label that files a record into a group is typed in
  `groupFieldHTML()`, and the list it files into groups by `tagKey()`. A second control would let
  the two drift, which is the #98 request.
- **Every group name goes through `tagLabel()`**, which refuses a reserved name. A grouping path
  that read the raw text would put an `Object.prototype` name back into a collapse map, and every
  save of a group field calls `groupFieldBlocked()` first.
- **`.inv-sec-head` keeps its name.** `buildToc()` and the `[data-invsec]` handler depend on it.
- **Headings in a `.label` stay ToC-clean.** See [Shell](shell.md).
- **Every search box has a placeholder**, or its × never hides.
- **Collapse maps store "shut", and a missing key is the default.** Changing a default then only
  affects sections nobody has touched.

## Traps

- **The phone fix that did nothing.** A ≤820px query was once written above `.stack{display:grid}`.
  At equal specificity the later rule wins, so `display` quietly stayed `grid`. The test asserting
  the rule existed passed. The tests now assert each query's order (L2242, L6633).
- **An unscoped `display:contents` flattened every tab.** The Sheet's old `.stack{display:contents}`
  at ≤820px (there to sink the familiars) reached every `.stack`, so the cards on Spells, Journal and
  Inventory touched with no gap on a phone. It went with the stacks in #103, and the gap came back
  (L6633).
- **`flex-wrap` alone did not wrap the familiar row.** `.item .nm` is `flex:1 1 0` with
  `min-width:0`, so flex always found "room" on line one and squeezed the name to 12px. The name
  needs `flex-basis:100%`. The fix is scoped to `#familiarList`, because an unscoped `.item .top`
  wrap would restyle Statuses (L2242).
- **The test slicer and HTML comments.** The `block` helper in `rules-data.js` finds an element by
  counting `<div>`s, and a comment quoting the markup it described broke that within minutes.
  Comments are now stripped first (L2242).
- **`.fgname{flex:1}`** pushed the count to the far right, not beside the title. It is now
  `flex:0 1 auto` (L3123).
- **`.fgcount` was not always a count.** Settings used to pass badges through it, which would read absurdly
  in brackets, so counts moved to `.cnt` (L3123).
- **The inventory caret pointed left when open.** It was drawn pointing down and then turned another
  90° by the shared `.fcaret`. It is now drawn like the Features caret (L3525).
- **The Rules glossary heading contained its own "+ Add".** A bare `closest` on the fold toggle
  folded the section whenever you reached for Add, until the handler ignored clicks on anything
  interactive inside the heading (L3189). The folding headings went with the Rules browser (#99).

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How is a section identified? | A stable `k` in `NOTE_SECTIONS` | A heading-derived id: headings get reworded, and notes keyed to one would be orphaned |
| The Sheet's layout (#103) | One layout, no setting: header, rail, strip, then two independent stacks (Skills, Features · Defences, Statuses, Resources); three columns, two, one by width | A classic fallback: twice the CSS and screenshots until 2.0 |
| Familiars on the Sheet (#103) | A paw in the header, shown by a per-character switch, opening a popover and a modal; the card stays in the DOM, hidden, for the combat view | A chip with the name: long names and several familiars don't fit. A side drawer: heavier than needed. Flattening `.stack` to sink the card on a phone (the 2026-08-15 answer): the stacks are gone |
| The familiars' #97 pencil (#103) | None: `familiars` leaves `EDIT_CARDS` | The familiar's window honouring `editHide`: its only toggle would be on the card, reachable just in the combat view |
| May the header go in the combat view? (#103) | No (`nocv`); a saved one becomes Vitals | Keeping it addable: the name, rests and level would ride into a fight view |
| Where the familiar row may wrap | Only in `#familiarList` | Unscoped `.item .top{flex-wrap:wrap}`: silently restyles Statuses, where one row is right |
| How a list row fits a phone (#57) | Everything after the name in one `.row-meta` group that drops to its own line whole; opt-in by `.split`; the name asks for 6em | The familiars' `flex-basis:100%`: these rows put a fold button and star before the name, which it would orphan on a line of their own. Truncating the name: loses the name, the one thing the row is for. 8em: split short item rows for no reason |
| How Settings is organised (#107) | A sidebar of pages, one shown at a time (see [Settings & updates](../features/settings-and-updates.md)) | Reusing `.fgroup` / `.fghead` / `.fcaret` (the 2026-08-11 answer): the sections grew into one long scroll. A second collapsible: the app should not have two things that look like a section header |
| How a grouping label is typed (#98) | One group field, the journal's tag box, for tags, a feature's source and an item's category | A select of fixed groups: a player can't add their own. A box with no suggestions: a typo makes a second group |
| A group named `constructor` or `__proto__` (#98) | Refused: no group may be named for an `Object.prototype` property, said under the box, and read as no group from a file (Mike) | Making the collapse maps own-property safe: the names would still work, and four maps would each need it |
| A folded group whose first member is retyped in another case (#98) | Reopens, as its label changes: fine as it is (Mike) | Folding by `tagKey()` as the journal does: would reset every feature group and section a player has folded |
| How collapse state is stored | As shut = `true`, absent = default, so a default can change without reopening what a player shut | Storing "open" (named and set aside at L1741) |
| Where the Rules tab remembers its place | `settings.rulesCat`, app-wide — the category last opened, since the tab's own fold ended with #99 | On the character: the packs are global, so remembering per-character would surprise a player opening a different sheet and finding a different category open |
| Colour of group names | `--accent`, set on the shared `.fgname` rule | Scoping the change to Features: the owner chose consistency |
| Counts and badges in a heading | Counts in `.cnt`, badges keep the `.fgcount` pill | One style for both: a badge like "12 entries" reads absurdly in brackets |
| Order of favourite attacks | The order they were added | Sorted: the list is short and hand-built, so a row stays where the player put it |
| Headings on the Attacks card | Only when something is starred | Always: a lone "Favorites" or a bare "Attacks" over the whole list is noise |
| The shared section-head rule | `.fghead,.inv-sec-head` share one rule; the inventory class keeps its name | Renaming `.inv-sec-head`: `buildToc()` and the `[data-invsec]` handler depend on it |
| Fragment prefixes after the Tables tab went | Left as they were (`50-` is a gap) | Renumbering: pure churn, since the manifest is the authoritative order |

## Open

- **Keyboard reach of group headings is uneven.** Notes and Settings headings are
  `role="button" tabindex="0"` with Enter/Space handlers. Features group
  heads and inventory section heads are not focusable at all.
- The Attacks card's headings reuse `.inv-sec-head`, inheriting its `cursor:pointer`, but
  `data-atksec` has no handler, so they do not fold.
- Active Spells is hidden when empty, so its note button and combat toggle are unreachable until it
  has content (L3397). Familiars' note and combat toggle are in the paw's menu (L6729).
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
- 2026-09-29 — Trackers: counters, checklists and tasks that close themselves when done, with Undo; registered section 20, in the combat view; hideable per character. → ledger L4822, #41
- 2026-10-12 — Attack, feature, item and condition rows group what follows the name, so on a phone it drops below whole instead of the name running over it. → ledger L5667, #57
- 2026-10-16 — The group field: one control for a journal tag, a tracker tag, a feature's source and an item's category. → ledger L5823, #98
- 2026-10-16 — No group may be named for an `Object.prototype` property; the group field says so and stops the save. A group reopening after a case edit is kept, by decision. → ledger L5872, #98
- 2026-10-16 — Settings no longer uses the `.fgroup` collapsible or a collapse map: it is a sidebar of pages and remembers the last one. → ledger L5930, #107
- 2026-10-19 — A pencil in every card's header hides that card's edit, delete and remove buttons, per card and per character, by CSS (`.ed`/`.ed-off`), before the combat toggle and the note button. → ledger L6248, #97
- 2026-10-22 — The Rules tab becomes one card, the browser; `settings.rulesCat` (the category last opened) replaces `settings.rulesCollapse`. → ledger L6327, #99
- 2026-10-22 — The stale "Where Rules-tab folding is stored" decision is rewritten: `settings.rulesCat`, not `rulesCollapse`. → ledger L6455, #99
- 2026-10-23 — The Sheet makeover: a header band over a grid (rail, strip, Skills, Defences/Statuses/Resources, Features), three, two and one columns; the stacks and their phone flatten go; familiars open from the paw; 18 sections, `portrait` is the header and not combat-addable; Attacks on Inventory. → ledger L6633, #103
- 2026-10-23 — Final review fixes: the paw's menu gains Combat view and Note; `familiars` leaves `EDIT_CARDS` (eleven); `sheetHeadHTML()` is `pawHTML()`. → ledger L6729, #103
- 2026-10-23 — Mike's changes: the middle and right columns are independent stacks (Features follows Skills); the rests read as words; the header runs rests, paw, star, level, note. → ledger L6776, #103
