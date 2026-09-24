# Unreleased

Running notebook of changes made since the last release. `APP_VERSION` stays at the last **released**
version while you work — nothing here is versioned yet.

**Add a `- ` bullet for every player-visible change as you make it.** One bullet per change, written
the way it should read in the changelog (players see these). Text can wrap onto continuation lines.

Bullets are copied VERBATIM into three places that render differently, so:
- **No angle brackets.** `<name>` is an HTML tag on GitHub and disappears from the release notes.
- **No literal version numbers** — they go stale the moment the version is bumped.
- `**bold**` renders on GitHub and in `docs/CHANGELOG.md`, but shows as literal asterisks in the
  app's own What's New list, which escapes its text. Use it sparingly.

When you are ready to cut a release, run one of:

```
./build.sh --release patch     1.2.1 -> 1.2.2   bug fixes
./build.sh --release minor     1.2.1 -> 1.3.0   new features
./build.sh --release major     1.2.1 -> 2.0.0   breaking rework
./build.sh --release 2.0.0     an explicit version
```

That bumps `APP_VERSION`, moves every bullet below into a new `CHANGELOG` entry in
`src/js/30-version.js`, empties this list, and then builds. A release fails if this list is empty.

Bullets below this line — leave the heading in place.

## Pending

- Tidied up setting an item's **origin**. In the item finder the three controls along the bottom now
  carry labels — Origin, Detail, Cost (gp) — and match the shape of every other field in the app
  instead of being slightly rounder and thinner. On the item form, Origin and Origin detail now sit
  side by side like Cost and Weight above them, with a line explaining what the detail is for, and
  the form no longer jumps around when you pick an origin.
- Fixed: typing an origin detail in the item finder without choosing an origin first threw the text
  away when you tapped Add. The detail box now stays greyed out until you pick an origin, and its
  hint follows what you picked — "at (place)" for Purchased, "from (who)" for a Gift.
- New **Skills display** choice in Settings, under This character. **Classic** is the layout you have
  now — Ability Scores and Skills as two cards, skills listed A to Z. **By ability** puts the six
  abilities in a grid, three across, each heading the saving throw and the skills that ability
  governs, and folds the Skills card away. It is a display choice only: every number means exactly
  the same thing in both, and each character remembers its own setting.
- New **combat view**. Tap the crossed swords in the tab bar to open a full-screen view of just the
  sections you need in a fight — any card from any tab, added with the crossed-swords button in its
  heading and arranged by dragging. Everything works there exactly as it does on its own tab.
  **Start combat** counts rounds and in-game time and moves your active spells along each round.
  Close the view to look something up and combat keeps going — the button shows the round, and one
  tap brings you back. **End combat** is its own button. Take a card out by mistake and the message
  that confirms it has an **Undo**.
- Pop-up windows now work properly from the keyboard. When one opens, the cursor goes to its first
  text box, or to the window itself if it has none — and on a touch screen always to the window, so
  the on-screen keyboard stays out of the way. Tab stays inside the window instead of wandering onto
  the page behind, and when it closes you are back where you were. Screen readers now announce each
  window by its title, and read out the short messages that appear at the bottom of the screen.
- Adding gear from the item browser now has a **Qty** box beside Origin and Cost. Set it to add
  several of each ticked item at once; if you already carry that item, they join the same stack.
  Any cost you type is still the price of one. Changing a filter while you pick no longer resets
  Origin, Qty or Cost.
- Fixed: coins now read from most to least valuable — PP, GP, EP, SP, CP in D&D and GP, SP, CP in
  Humblewood — on the Coins card and in the Adjust coins window, the same order the printout uses.
- Fixed: in the Classic layout the skills now read down each column — Acrobatics to Investigation on
  the left, Medicine to Survival on the right — instead of zig-zagging across the two columns.
