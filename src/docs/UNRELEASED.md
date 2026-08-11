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

- Items can carry a weight, and the Inventory tab totals up what you're hauling. Gear added from
  the rules browser brings its weight with it.
- New per-character Encumbrance setting, in Settings: off, the standard rules, or the variant
  Encumbered / Heavily Encumbered tiers. When it's on, a heavy pack really does slow you down —
  the Speed on your sheet drops, tapping it explains why, and a badge on the Inventory card shows
  how close to your limit you are.
- Coins count toward what you're carrying, at 50 coins to the pound, with a switch to turn that off.
- Characters now have a Size, shown in Vitals next to Speed. It comes from your ancestry unless you
  tap it and pick your own — the picker tells you what each size would let you carry before you
  commit. Large characters carry twice as much, Tiny half as much, and Size prints on the sheet.
- Item costs under 1 gp are no longer rounded down to zero in the item list or the inventory total.
- Fixed: editing an item no longer quietly loses its favourite star, or its link back to the rules
  pack it came from.
- Settings is now grouped into collapsible sections — Appearance, This character, Rules data, and
  Characters & backup — instead of one long scroll. It remembers which ones you left open, and the
  folded Rules data header still tells you how much is loaded.
- The Hit Point boxes now take signed entries, the way the coin boxes do: type -7 to take damage,
  +4 to heal, or a plain number to set the total. All three boxes work this way, and Current HP
  won't run past your maximum or below zero.
- Short and Long Rest and your Hit Dice have moved into their own Rest & Recovery card, just below
  Vitals. Hit Dice used to be listed twice in two different places; now it's in one.
- Hit Dice are easier to read: one line per die size showing how many you have left in words, and a
  labelled Roll button. While they're set automatically from your class the text box is hidden,
  since it only repeated what the dice below it already said — switch to manual and it comes back.
- Vitals is tidier: Inspiration is a star in the card's heading rather than a box of its own, and
  the death saves now read as failures, a skull, then successes, centred under the HP buttons.
  Both sets fill outward from the skull.
- Fixed: the HP minus button could take you below zero.
- Every section of your sheet can now hold a note. Tap the little page icon beside any heading on
  the Sheet, Spells, Inventory or Story tabs and jot down whatever you need — the icon lights up
  when there's something there, and hovering it shows you what without opening anything.
- Notes understand a bit of formatting: bold, italics, code, headings, bullet and numbered lists,
  quotes and dividers. Rules terms you know stay tappable inside them, same as everywhere else.
- New Notes tab: every note you've written, grouped by the tab it came from, each with a link that
  takes you straight back to the section it belongs to. Notes print with your sheet too.
- The tab bar switches from words to icons when the screen gets narrow, and there's a new
  Icon tabs switch in Settings if you'd rather have icons all the time.
- The Inspiration star is bigger and easier to hit.
- Fixed: equipment handed to you by a class or background arrived with no gp value, so your
  inventory total was wildly wrong. It also brings its category across now. For characters you
  already have, run Check for rules updates in Settings and it will fill the missing values in.
- Fixed: items that weren't weapons or armour all piled into Loot instead of Gear, Tools or
  Consumables. Gear you add from now on files itself properly.
- Fixed: the Tables tab was empty when you reopened the app, even with a rules pack loaded — the
  tables were there, nothing had drawn them, and typing in the filter box made them appear. It also
  means the tab now tells you how to import tables when you have none, instead of showing nothing.
- The update notice now takes the version number's place in the top bar instead of stranding itself
  at the other end of it. Hover it to see which version is waiting and which one you're on, and tap
  it for the release notes and the download.
