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

- **Adding a second class now follows the multiclassing rules.** Only your first class gives you
  saving throw proficiencies and starting equipment and gold; a class you add alongside it gives
  neither. Its skill choice shrinks to what multiclassing grants — one skill for a Bard, Ranger or
  Rogue, none for the other classes — and the class window tells you what else you gain, such as
  armor or tool training. Its level-1 features, like a Fighting Style, still arrive as before. If
  you remove your first class, the class that is now first takes its own saving throws. Characters
  you have already made keep what they have. Re-download the D&D 2024 pack to get the multiclass
  skill choices.
- **Creating a character above level 1 now gives you hit points.** Adding your first class at, say,
  level 3 used to leave Max HP blank. Level 1 is now filled in — the full hit die plus your
  Constitution modifier — and the class window asks for the levels above it: take the average, type
  what you rolled, or tap Roll for me.
