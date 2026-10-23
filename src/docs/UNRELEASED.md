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
- On a phone, the cards on the Spells, Inventory and Journal tabs have a small gap between them
  again instead of touching.
