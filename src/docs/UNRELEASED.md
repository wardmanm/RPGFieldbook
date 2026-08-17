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

- **Adding a feature now searches the rules packs for feats and traits.** The Add button on Features
  and Traits opens the same full-screen search the spell and item lists use, covering every feat your
  packs carry and the loose traits they ship — Eldritch Invocations, Battle Master Maneuvers,
  Artificer Infusions and the rest. Search by name or by what the text says, filter by type
  (origin, general, fighting style, epic boon), by pack, or to only what has no prerequisite, and
  preview any entry before you add it. Anything already on your sheet is marked. Typing your own
  feature by hand is still there, behind the Custom button.
- The picker's Add button now reads "Add 1 item" rather than "Add 1 items" when you have ticked exactly one.
