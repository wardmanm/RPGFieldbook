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
- **Tap your subclass on the class card to read about it.** The subclass name beside your class is
  now its own link, straight to its description and features, instead of sitting two taps deep
  inside the class window.
