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

- In the combat view, with skills grouped by ability, each ability's name, modifier and score are
  large and easy to read again, and "Saving Throws" no longer outweighs the ability it belongs to.
- Bows, crossbows, slings, blowguns and firearms now know their ammunition, and arrows, bolts,
  needles and bullets mark themselves as ammunition, even with rules data from before ammunition
  arrived. A crossbow or bundle of bolts already on your sheet is fixed the next time you open it.
- Changing a feature's source now moves it into that group on Features & Traits, and the Source box
  suggests the groups you already have, the way journal tags do. Left empty, a feature goes back to
  where it came from. Options you picked from the feature list, such as Eldritch Invocations or
  Metamagic, now sit under their own heading instead of "Other".
- An item's Category works the same way: pick one of the sections or type your own, and the item
  gets a section of that name after the built-in ones.
- A tag, feature source or item category can't be one of a few reserved words, such as
  "constructor"; the box says so. A journal or tracker tag with one of those names used to fold its
  group on its own, or never let it fold.
- Clicking or tapping outside a dialog no longer closes it, so a stray click or tapping away to hide
  your phone's keyboard can't lose what you typed. If you prefer the old way, turn on Settings →
  Appearance → Tap outside to close dialogs. ×, Cancel and Esc still close as before.
