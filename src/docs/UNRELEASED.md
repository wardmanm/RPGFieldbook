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
