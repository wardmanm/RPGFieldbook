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

- Extensions can install and update packs from a private GitHub repo, using a link and a token the repo's
  owner sends you; paste the link into Settings → Extensions → Sources. A new guide in the app's docs shows
  owners how to set one up for their table.
- Gold, languages and items from a species, background or class now show the moment you add, change
  or remove it: the coin boxes, the Languages pills on the Bio tab and the inventory no longer wait
  for a reload.
- Starting and granted weapons now arrive equipped, with their attack ready under Attacks & Weapons,
  as weapons from the item finder always have. A new weapon you make in the item form starts
  equipped too; untick Equipped if you'd rather it didn't.
- Undo recovery in the End of combat window no longer brings your ammunition back in the next fight. It
  takes back the arrows that came back and leaves the ones you fired spent, so the next fight starts with
  nothing fired. If your DM lets you find some, add them to the stack by hand.
- Editing one of your own glossary entries no longer throws away what the editor doesn't show. An entry
  marked as a condition stays among the status suggestions after you reword it, and anything else your
  character file kept with the entry stays too.
