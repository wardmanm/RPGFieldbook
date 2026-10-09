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

- The Notes tab is now the Journal. Keep a running campaign journal in pages — sessions,
  characters, quests, anything — each with an optional tag to group it by, created and edited
  dates, a button that stamps the current date and time, and the same formatting as your notes.
  Search finds any page by its title, tag or text. Your section notes are still there, further
  down.
- New trackers on the Journal tab: counters (with or without a goal), checklists and one-line
  tasks, grouped by a tag you choose — kills by creature type, pages of a book, steps of a quest.
  Anything with a goal can close itself when it's done and move to Completed, with an Undo. Add
  the Trackers card to the combat view to count mid-fight, or hide it in Settings → This
  character.
- If your browser refuses to save a change, the sheet now says so plainly — and keeps saying so
  until a save goes through — with a button to save the character to a file instead, and it asks
  before you switch away from changes it couldn't save.
- Bows, crossbows, slings, blowguns and firearms now track their ammunition. The weapon's attack
  row shows what it's loaded with and a Fire button that spends one (with an Undo); ending combat
  offers to recover half of what you fired, and a Recover button does the same any time. Ammo
  bundles like "Arrows (20)" unpack into single arrows when they reach your sheet, so the count is
  always the number you have. Magic ammunition (+1, +2, +3 and Slaying, plus Walloping and
  Adamantine with Xanathar's Guide loaded) is in the item finder, and a loaded +1 arrow adds +1 to
  the attack.
- Items you make yourself can use ammunition too: in the item editor, choose what ammunition a
  weapon fires, or tick Ammunition to make the item a kind of ammunition, with a magic bonus of up
  to +3. Inserting a bundle like "Arrows (20)" from the rules pack fills in 20 single arrows.
- Conditions can now last a set time: give one a duration in rounds, minutes or hours, and the round
  tracker counts it down beside your active spells. The condition shows the time it has left, clears
  itself when it runs out (with an Undo), and starts its full time again if you switch it back on.
- Ability Scores & Saves and Skills now draw as a compact, read-only quick view when you add them to
  the combat view, so your bonuses are easy to read mid-fight. Tap any value for its breakdown; edit
  them on the Sheet tab as before.
- **Rules data now comes as one download**, `fieldbook-data-standalone-….zip`, and Fieldbook opens
  it itself: choose it in Import files on the home screen or in Settings → Rules data. The app's own
  download zip works too. An older copy of Fieldbook can't open a zip: unzip it and import the
  `.json` files inside.
- Rules data can now be updated between app releases. When a newer copy of a rules pack you have
  loaded is out, Fieldbook says so quietly beside that pack in Settings → Rules data, with a link to
  download it.
- Re-importing a rules pack now replaces it completely: anything the new copy no longer has is
  removed, instead of staying loaded alongside it.
- Settings → Credits & licences now lists the licence and credit of each rules pack you have loaded,
  starting with the Homebrew pack's credit to D&D Wiki.
- When an import fails, Fieldbook now names the file and says why — for example that a zip is
  password-protected or damaged — on the home screen as well as in Settings, and a large import
  shows straight away that it is reading the files.
- **A new SRD 5.2 rules pack** comes in the rules data zip: the free D&D rules published under Creative Commons as the System Reference Document 5.2.1 — 12 classes, 339 spells, 9 species, 4 backgrounds and over 470 magic items. Its text follows the official SRD, and Settings → Credits & licences shows the attribution its licence requires.
- The D&D 2024 pack gains Carrion Crawler Mucus and Lolth's Sting, which were missing.
- The Warlock invocations Agonizing Blast, Eldritch Spear and Repelling Blast show their prerequisite properly, instead of a line of code.
- The Carrying Capacity table shows each size's limit (Str. × 7.5 lb. and so on) instead of a line of code.
- A Paladin choosing a Fighting Style can take Blessed Warrior, and a Ranger Druidic Warrior, as the rules allow.
- Settings → Rules data now shows the version of a loaded pack this build doesn't recognise — a
  pack of your own, or an older one a previous release shipped — quietly, with no false "update
  available" alert.
