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

- **Levelling up now asks for your hit points.** Every level-up window starts with a Hit Points
  box: leave it blank to take the average, type what you rolled at the table, or tap Roll for me.
  It shows its working (the die, your Constitution modifier and your new maximum), and on Done the
  hit points are added to both your maximum and your current HP. The level where you pick a
  subclass used to be the easiest place to forget them; that is fixed. Multiclassing into a new
  class asks too, using that class's hit die. If you close the window without pressing Done, Max
  HP is left unlocked so you can type the total yourself.
- **Subclass choices now show their descriptions** in the level-up window, the same way the Change
  subclass window already did, so you are no longer picking from a bare list of names.
- **Battle Masters now choose their maneuvers**, Sorcerers their Metamagic, Warlocks their
  Eldritch Invocations and Artificers their infusions, at the levels the rules give them. Arcane
  Archers (arcane shots), Rune Knights (runes) and the College of Swords (fighting style) get the
  same. Only the options you qualify for at that level are offered. The ones you already know are
  shown as yours rather than offered twice, except invocations the rules let you take again. The
  chosen options go on your sheet as features. Re-download the D&D 2024, Xanathar's and Tasha's
  packs to get the pickers.
- **Battle Masters get their Superiority Dice tracker** on the Resources card: four dice, five at
  level 7 and six at 15, refilled on a short or long rest. Each maneuver you pick has a Use button
  that spends a die, and Metamagic spends Sorcery Points the same way. Arcane Archers get an Arcane
  Shot tracker. Student of War now asks for its skill (from the Fighter's list) and its artisan's
  tools.
- **Swap a maneuver, invocation or Metamagic option by hand.** The D&D 2024 pack now carries all
  of them in Add feature, so you can replace one you know when the rules let you: delete the old
  one and add the new one.
- **Fixed: the starting-equipment picker could turn up after a later level-up.** If you closed
  the Add class window without pressing Done, the class's starting equipment used to appear after
  your next level-up instead of being dropped with the rest of that window's picks.
- **Fixed: the Gadgeteer's Engineer path had the wrong feature text.** Crafty Components now lists
  the Engineer's two components, Quick Shield and Multitool, instead of the end of Magic Item
  Hacking, which is whole again. Several Gadgeteer features no longer end in stray fragments of
  picture captions, the class description is no longer cut off mid-sentence, and both paths now
  have their own introductions from the playtest. Re-download the Humblewood pack to get these.
- **Fixed: subclass descriptions.** Eight D&D 2024 subclasses (among them Psi Warrior, Thief and
  Hunter) showed only their one-line motto as a description. Four Humblewood subclasses had their
  feature table run into theirs. A subclass printed in two packs no longer shows its pack name
  twice.
- **Tap your subclass on the class card to read about it.** The subclass name beside your class is
  now its own link, straight to its description and features, instead of sitting two taps deep
  inside the class window.
