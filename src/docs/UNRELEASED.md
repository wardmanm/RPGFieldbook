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

- Hide the tabs a character doesn't use (Settings → Sheet display → Tabs).
- Journal pages can hold checklists: a line starting `[ ]` or `[x]` is a checkbox you can tick in
  the page itself, and the page list shows how many are done. Section notes and the text fields on
  the Bio tab tick the same way, and the journal and section-note editors have an Insert checkbox
  button. Checklist and task trackers you already had have moved
  into journal pages, ticks and dates included; Trackers now holds counters only.
- A tracker group can show the total of its counters: tap the Σ on the group's heading.
- Trackers lay out as tiles across the card instead of one long list.
- Choose how ammunition comes back after a fight in Settings → Sheet display: half (the rules as
  written), all, only the shots that hit, or none. Firearm bullets never come back, and any item can
  be set to always or never. Thrown weapons such as daggers and javelins now have a Throw button
  that counts them, and they come back after the fight. Ending combat recovers ammunition on its own,
  with an Undo.
- Every list card has a pencil in its header that hides its edit and delete buttons, so they stay
  out of the way in play.
- The Rules tab is now a browser: every class, species, background, feat, spell, item, condition, glossary term and table from your rules packs, in sortable tables with filters and a search across all of them. Tap a row to read it.
- The Sheet tab is redesigned: a header with your class, level and rest buttons, a portrait rail
  with AC, HP and hit dice, abilities with their saves across the top, and a new Defences card for
  resistances and immunities. Spend a hit die by rolling in the app or entering your own roll.
  Attacks move to Inventory; the Story tab is now Bio, with alignment, languages and senses.
- Familiars live in a paw menu in the sheet's header: summon, edit, add, put them in the combat view
  and keep their note from there. A character without a familiar can show the paw with the
  Familiars & companions icon switch in Settings.
- The level in the header has an XP bar that fills toward your next level, and says when you are
  ready to level up. Groups that level by milestone can hide it with the Advancement setting
  (XP or Milestone) in Settings.
- Languages are chips now. Your species and background add theirs, and take them back if you change
  them. The "Languages:" lines on an existing sheet become chips that are yours to keep or remove.
- The Hit Dice display and Skills display settings are gone: hit dice are one bar under your hit
  points, and skills one list. A class with no hit die in your rules data can still switch the bar
  to manual and type its dice.
- On a phone, the cards on the Spells, Inventory and Journal tabs have a small gap between them
  again instead of touching.
- The ☰ section menu is gone; a ↑ button in the bottom corner takes you back to the top.
- Levelling up is a moment now: a short animation, then a card with everything the level gives
  you and your hit-point roll.
- Paladin and Ranger spell slots follow the 2024 rule (half your levels, rounded up), so a level 1
  Paladin has its two slots.
- An initiative tracker in the combat view: roll initiative when combat starts, follow the order turn by turn or round by round, and track everyone's health at a glance.
- A Party card on the Bio tab: your companions join every fight you start.
- Trade from the Inventory tab: give items and coins, get items and coins, see whether it
  balances, and complete it in one step. Selling for more than something is worth reads as in
  your favour, not short.
- An inventory log records every change to your items and coins, and lets you undo any change
  that can still be reversed. It notes what leaves when you remove a class, background or
  ancestry, and each fight's ammunition, counting arrows you recovered mid-fight. Making the log
  smaller asks before it drops any lines.
- The item finder's Cost box keeps fractions of a gold piece, such as 0.5 gp, instead of rounding
  them down to nothing.
- Text on gold and red buttons, pills and banners is easier to read in every skin, most of all on
  the classic skin's light theme.
- Settings → Rules data is now Extensions: install and update rules packs from Fieldbook's own
  data, which is built in, or from any manifest URL you add, with Update all. When a newer
  version of a pack you have is out, a pill in the top bar says so. Every download is checked
  before anything installs, and if one fails, nothing changes.
- Manual install takes rules files, a folder or a zip, chosen or dropped, and shows what will
  change before anything installs.
- Update notices can be cleared with their ×, and stay cleared until a newer version arrives.
- Every source you add is named with its web address, and an update offered by a different source
  from the one that installed a pack says who is offering it, so you can always see where a file
  comes from.
