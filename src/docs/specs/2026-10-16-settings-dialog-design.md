# Settings dialog — design

**Status:** design approved in conversation with Mike, 2026-10-16; awaiting review of this spec
**Issue:** #107 (Settings dialog update). Branch `issue/107-settings-dialog-update`.

---

## 1. What it is

The Settings dialog becomes a two-pane dialog: a sidebar of six categories on the left, and the
chosen category's page on the right. Every setting on a page is one row, with its name and a short
line of help on the left and its control in a right-hand column. The control follows one rule by
kind of setting. The sidebar condenses to a rail of icons when Icon tabs is on or the screen is
narrow.

Why (Mike, in the issue): the dialog is cluttered, and one long vertical scroll of five folding
sections is hard to parse. "This character" alone holds ten controls of four kinds, each laid out its
own way. He asked for sidebar categories, consistent control types lined up as in a reference
Preferences dialog, and an icon-only sidebar when icon tabs are on or the screen is cramped.

What does **not** change: what any setting does, which settings exist, and when a change applies
(instantly, as now — there is no Save or Cancel). The home screen's rules setup is untouched.

## 2. Decisions

Settled with Mike on 2026-10-16. Rejected options are kept so they are not re-proposed without the
reason they lost.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | The categories | **Six:** Appearance, Sheet display, Carrying, Rules data, Backup, Credits. The crowded "This character" splits by what a player looks for; checking a sheet for rules updates joins Rules data | Keeping the five sections as sidebar entries: "This character" would stay the cluttered page. Splitting by scope (General, Character, Data, About): fewer entries but longer pages |
| 2 | How a setting looks | **Rows plus a type rule:** name and help left, control right; on/off is a switch, two or three short choices are segmented buttons, longer lists are dropdowns, actions are buttons at the foot of their group | Everything a dropdown, as in the reference: on/off and Light/Dark would take two taps. Grouping by control type: settings that belong together would end up apart |
| 3 | The icon rail on a phone | **On the left, as on a desktop**, about 56px wide; rows stack their control under the name where they don't fit | An icon strip across the top: more width for the page, but a second layout to learn |
| 4 | How it is built | **Every page built when the dialog opens, one shown at a time** (§5) | Building only the visible page: every control's wiring rewritten into per-page binders, for nothing a player would see. CSS only: cannot split "This character" or line rows up |
| 5 | When a change applies | **Instantly, as now** | Save/Cancel, as the reference shows: a new behaviour nobody asked for, and every setting would need a staging copy |

## 3. Structure and navigation

```
┌──────────────────────────────────────────────────────────────┐
│ SETTINGS                                                   × │
├────────────────┬─────────────────────────────────────────────┤
│ ◐ Appearance   │ APPEARANCE                                  │
│                │ LOOK                                        │
│ THIS CHARACTER │ Skin                 [ Humblewood | Classic]│
│ ▤ Sheet display│ Mode                 [System | Light | Dark]│
│ ⚖ Carrying     │ Hand-drawn borders                    (●  ) │
│                │ INTERFACE                                   │
│ ⇩ Rules data 2k│ Icon tabs                             (  ○) │
│ ⟲ Backup       │ Tap outside to close dialogs          (  ○) │
│ © Credits      │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

- **Width.** Settings opens wider than other dialogs: up to about 820px, the full width on smaller
  screens. `openModal()` takes an optional `{wide:true}` and sets or clears the dialog's wide class
  on **every** open, as it already does for its emblem slot, so no other dialog is affected and a
  later dialog never inherits the width.
- **The sidebar** lists the six categories in that order. Sheet display and Carrying sit under a
  small "This character" caption and appear only while a character is open, as the section does
  today. Rules data shows its entry count, and a dot when a newer copy of a loaded pack is out (the
  `update` state that `rulesBadge()` reports today).
- **The icon rail.** The sidebar shows only its icons when `settings.tabIcons` is on
  (`html[data-tabs="icons"]`) or the viewport is 640px wide or less. Each icon has a tooltip and an
  accessible name; the caption and the count give way to the rail (the update dot stays). The icons
  are simple line drawings in the tab bar's style (24px viewBox, stroked), written into the app, not
  game-icons artwork, so they need no attribution.
- **Which page opens:** the last one viewed, kept in `settings.setPage`. A missing or unknown value,
  or a character page with no character open, opens Appearance.
- **Scrolling.** The page scrolls on its own; the sidebar stays in place.
- **Keyboard and screen readers.** The sidebar is a `role="tablist"` of `role="tab"` buttons with
  `aria-selected`; each page is a `role="tabpanel"` labelled by its tab. ↑ and ↓ move between
  categories (Home and End to the ends), and a click or Enter selects. Focus on open follows
  `modalTakeFocus()` as now.

## 4. The pages

Rows: the name (`.t-lbl` weight) with one help line beneath it on the left, the control in a
right-hand column. Groups within a page have small headings. On a narrow page a switch stays at the
right of its row; a segmented control or a dropdown drops below its name.

| Page | Group | Setting | Control | Today |
|---|---|---|---|---|
| Appearance | Look | Skin | segmented: Humblewood / Classic D&D | segmented |
| | | Mode | segmented: System / Light / Dark | segmented |
| | | Hand-drawn borders | switch | switch |
| | Interface | Icon tabs | switch | switch |
| | | Tap outside to close dialogs | switch | switch |
| Sheet display *(for the character's name)* | Cards | Skills display | segmented: Classic / By ability | segmented |
| | | Hit Dice display | segmented: Full / Condensed / Dice | segmented |
| | | Colour current HP | switch | switch |
| | | Trackers card | switch | switch |
| Carrying *(for the character's name)* | Size and weight | Size | dropdown, 7 options (From ancestry, then Tiny to Gargantuan) | dropdown |
| | | Encumbrance | **segmented:** Off / Standard / Variant | dropdown — changes under the type rule |
| | | Coins count as weight | switch | switch |
| | | *the live "Carrying X of Y" line, under the group* | text | text |
| Rules data | Sources | the URL list and its Add box | list | list |
| | | Fetch all · Import files · Get templates · Clear all (set apart, at the end) | buttons | buttons |
| | | the status line | text | text |
| | Loaded data | the loaded-data list | list | list |
| | This sheet *(only with a character open)* | Rules updates: "Last checked against vX" | button: Check for rules updates | button, in "This character" |
| Backup | Characters | Character library | button: Open | button |
| | Settings file | Export settings · Import settings | buttons | buttons |
| | | the status line and one help line | text | text |
| Credits | Icons · Rules data you have loaded · Rules content | the licence text, **word for word** (CC BY 3.0 requires it) | text | text |

**Copy.** Each long help paragraph is cut to one line without changing what it says, with a second
line only where a second fact matters:

- Skills display: "Skills listed A to Z, or under each ability." Display only stays implicit in the
  page's name.
- Hit Dice display: "Boxes, one line per size, or dice you tap." Second line: "Only Full and
  Condensed can mark a die spent without healing."
- Encumbrance: "Off shows weight only; Standard and Variant apply capacity." The live carrying line
  stays.
- Rules sources: "Import the rules data zip or JSON files, or add a URL and Fetch all (needs a
  connection). What is loaded stays saved for offline use." The rest of today's paragraph
  (manifests, later sources win, what Fetch all keeps) moves into the Fetch all and Import files
  tooltips.

The exact wording is settled in the plan and checked on screen; any line that loses a fact the
player needs is a defect.

## 5. Build

- **A page registry, `SET_PAGES`** in `88-settings.js`, replaces `SET_SECTIONS`:
  `{k, title, icon, scope}` with `scope` `"app"` or `"char"`. Keys: `appearance`, `display`,
  `carrying`, `rules`, `backup`, `credits`.
- **Pure helpers**, testable in the harness: `setPageDef(k)`, `setPagesFor(hasChar)` (the pages to
  show), `setPageOf(stored, hasChar)` (the page to open: the stored one if shown, else
  `appearance`), `setNavHTML(pages, active, badges)`, `setPageHTML(k, body)`, and a row builder
  `setRowHTML(name, help, control)` so every row shares one markup.
- **`openSettings()`** builds the sidebar and **all** shown pages into the dialog, hides every page
  but the active one, and binds the sidebar (click, keys) from a wrapper inside the dialog body, as
  `#setSections` is bound today, never from `#mBody`. Every control keeps its id and its handler
  unchanged; only the markup around it moves. Because every page exists, `renderRulesData()`,
  `renderSrcRows()` and the encumbrance hint keep refreshing whichever page is showing.
- **`renderRulesData()`** refreshes the Rules data badge on the sidebar item rather than on the old
  section header.
- **`openModal(title, html, icon, opts)`** gains `opts`; `{wide:true}` is the only option.
- **CSS** in `50-modal.css`: the two panes, the rows, group headings, the rail (by
  `html[data-tabs="icons"]` and a `max-width:640px` query), and the stacked rows on a narrow page.

## 6. Stored data and compatibility

- `settings.setPage` (string) is new, defaulting to `"appearance"`, and joins `SETTINGS_KEYS` so a
  bare settings file carrying only it is still recognised.
- `settings.setCollapse` is no longer read. It stays in old saved settings and settings files and is
  left alone: removing it buys nothing and Import settings assigns whatever a file holds.
- No character field changes, so `blankChar()` and `migrate()` are untouched.

## 7. Testing

- **Unit (`rules-data.js` / `sheet.js`):** the registry and the sidebar agree both ways; character
  pages are absent without a character; `setPageOf()` falls back for a missing, unknown or
  character-only page; every control id appears exactly once in the built markup; rows share
  `setRowHTML()`; the wide flag is set and then cleared by the next `openModal()`; the badge refresh
  targets the sidebar item; the rail's two CSS triggers exist; the existing checks on the dialog's
  ids both ways carry over.
- **Browser (Playwright MCP):** before and after screenshots of every page, Humblewood and Classic,
  light and dark, desktop and 390px, Icon tabs on and off. Driven: switching pages by click and by
  ↑/↓, changing a switch, a segmented choice and the size dropdown, Fetch all's status line, the
  badge after an import, reopening on the remembered page, and opening with no character open.
- **Not covered:** real devices and touch, which are Mike's pass.

## 8. Docs

Ledger entry; the wiki's Settings & updates page (the modal and its page state), Shell (`openModal`'s
`wide`), and Sections & layout (Settings no longer uses the `.fgroup` collapsible: its decision row
becomes the rejected alternative); `decisions.md`; one `UNRELEASED.md` bullet.

## 9. Out of scope

New settings; changing what any setting does; Save/Cancel; the home screen's rules setup; the
`settings.autoload` flag, which is seeded and never read (a known issue).
