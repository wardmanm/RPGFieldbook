# Hide tabs per character: design

**Status:** approved in conversation 2026-10-24, awaiting Mike's review of this written spec. Wave 3 of
[1.9.0](../wiki/roadmap/1.9.0.md).
**Issue:** #52 (Ability to hide tabs). One branch, `issue/52-hide-tabs`.
**Read first:** [Shell](../wiki/ui/shell.md) (the tab bar, `selectTab()`), [Settings & updates](../wiki/features/settings-and-updates.md)
(the Settings pages), [Combat view](../wiki/features/combat-view.md), [Story & notes](../wiki/features/story-and-notes.md)
(section notes and their jump), [Character model](../wiki/architecture/character-model.md).

---

## 1. What it is

A player can hide the tabs a character doesn't use, such as Spells for a Fighter or Rules for a
player who never opens it. The choice is saved with the character and is easy to undo. The issue
asks for it to "save to their profile" and to be "easily unhidden".

## 2. Decisions

These were settled with Mike on 2026-10-16 (the 1.9.0 page, row #52) and on 2026-10-24 (this
brainstorm).

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Where tabs are hidden | **Settings → Sheet display gets a Tabs group** with one switch per word tab: Spells, Inventory, Bio, Journal, Rules. | Hiding from the tab with a long-press to unhide: invisible, and it clashes with the phone's own long-press. |
| 2 | What can't be hidden | **The Sheet tab and the combat swords.** | Hiding Combat: the swords would disappear mid-fight. |
| 3 | Scope | **Per character**, saved on the character. A new character shows every tab. | Per device: a Fighter and a Wizard on one device want different tabs. |
| 4 | A hidden tab that is active | **The Sheet shows.** | n/a |
| 5 | A jump into a hidden tab | **The section-note jump unhides the tab, saves, and toasts** "Spells tab shown again; hide it in Settings → Sheet display." Then the jump carries on. | Refusing the jump: the note's link would do nothing. |
| 6 | Cards from a hidden tab in the combat view | **They stay.** The player put them there; hiding a tab is about the tab bar, not the combat layout. Each card's own combat toggle still works inside the view. | Dropping out while hidden: hiding Spells would quietly strip the slots from the fight (Mike chose to keep them) |
| 7 | Print | **Unchanged.** `printSheet()` builds from the character's data, not from the tabs. | n/a |

## 3. Data

- **`character.hiddenTabs`** is a list of tab names drawn from `HIDEABLE_TABS = ["spells","inventory","story","journal","rules"]`.
  - In `blankChar()` it is `[]`, a literal, in line with the TDZ rule.
  - `migrate()` keeps every field as it is, then cleans this one: it must be an array, only names
    in `HIDEABLE_TABS` stay, and repeats go. A missing field becomes `[]`.
  - It survives a save → load round trip.
- **`isTabHidden(name)`** returns true only for a name in `HIDEABLE_TABS` that is in the list. It is
  always false for `sheet` and `combat`.

## 4. The tab bar

- **`applyHiddenTabs()`** sets the `hidden` attribute on each `.tab[data-tab]` button that
  `isTabHidden()` names, and clears it on the rest. The button leaves the bar at every width,
  icon tabs included, and the remaining tabs share the space.
  - It runs on load, whenever a character is opened or switched, and when a Settings switch flips.
  - If the active panel's tab is now hidden, it calls `selectTab("sheet")`.
- **`selectTab(name)`** treats a hidden tab as `sheet`. This is a guard, so that a stale caller
  can't open a hidden panel.

## 5. Ways into a hidden tab

- **The section-note jump:** `jumpToNote()`. If the note's tab is hidden, the jump removes it from
  `hiddenTabs`, runs `applyHiddenTabs()` and `scheduleSave()`, and shows the toast in decision 5,
  using the tab's own label (Bio, not story). Then it carries on as before.
- **The combat view's way back:** `leaveCombatTab()`. If `cvPrevTab` is now hidden, it goes to the
  Sheet.
- **Combat cards** stay, as in decision 6, with no code change. Hiding the tab moves no card.

## 6. Settings

The Sheet display page (`88-settings.js`, the `display` page) gets a new group, **Tabs**:
- Help text: "Hide the tabs this character doesn't use. Sheet always shows."
- One `setRowHTML` switch per hideable tab, labelled with the tab's own name. On means shown.
- Each switch's id is `swTab-<name>`, its `aria-checked` reflects whether the tab is shown, and its
  `aria-label` is "Show the <Label> tab".
- Flipping a switch updates `hiddenTabs`, runs `applyHiddenTabs()`, and saves. This follows the
  existing switch handlers, for example `swFamiliars`.

## 7. Edge cases

- **Every hideable tab hidden:** the bar shows Sheet and the swords. That's allowed.
- **A tab hidden while the combat view is open:** the view stays. On leaving it, the way back goes to
  the Sheet if the tab it came from is hidden.
- **A sheet saved with an unknown name** (from the future, or edited by hand): `migrate` drops it.
- **Switching characters:** the new character's tabs apply. If the active tab is hidden for them,
  the Sheet shows.
- **No character open** (Home): the Settings Tabs group is shown only when a character is open, like
  the page's other character groups.

## 8. Testing

- **The field:**
  - `blankChar().hiddenTabs` is `[]`;
  - `migrate()` cleans junk, unknown names, repeats and a non-array;
  - the save → load round trip keeps it.
- **`isTabHidden`:** `sheet` and `combat` are never hidden.
- **`applyHiddenTabs` against the real tab markup** (`loadHTML`):
  - the right buttons are hidden and unhidden;
  - when the active tab is hidden, the Sheet is selected;
  - the `selectTab` guard holds.
- **`jumpToNote`** into a hidden tab: the tab is unhidden, the toast appears with the label, and the
  character saves.
- **`leaveCombatTab`** with a hidden `cvPrevTab`: it goes to the Sheet.
- **Settings:** the Tabs group's markup, and that a switch flips the field.
- **Browser QA** with the project's Playwright MCP:
  - hide Spells and Rules, then switch character and back;
  - icon tabs on and off;
  - both skins at 1280 and 390;
  - a section note jumping into a hidden tab;
  - the console stays clean.

## 9. Docs

- The wiki pages shell, settings-and-updates, character-model, combat-view and story-and-notes each
  get a History line citing the ledger entry `## Hide tabs (#52, <date>)`.
- `UNRELEASED.md` gets: "Hide the tabs a character doesn't use (Settings → Sheet display → Tabs)."

## 10. Out of scope

- Reordering tabs.
- Hiding the Sheet or the combat swords.
- Hiding individual cards, which #97 and the existing card toggles cover.
