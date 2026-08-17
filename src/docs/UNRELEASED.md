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

- The Tables tab has moved onto the Rules tab, so there is one less tab to scroll past. Reference
  Tables now sits underneath the glossary on the Rules tab, with the same filter box and the same
  list — and tapping a highlighted table name anywhere in the app still opens it where you are.
- Attacks can now carry additional damage types. A sword that deals 1d8 slashing and 1d6 poison is
  one attack: add as many extra dice as you need in the attack form, and they show on the sheet, in
  the to-hit breakdown and on the printed sheet. Extras roll on their own — the ability modifier and
  any damage bonuses stay on the main damage.
- Rules pack names containing an ampersand no longer show their escape code in the glossary heading.
- **Adding a feature now searches the rules packs for feats and traits.** The Add button on Features
  and Traits opens the same full-screen search the spell and item lists use, covering every feat your
  packs carry and the loose traits they ship — Eldritch Invocations, Battle Master Maneuvers,
  Artificer Infusions and the rest. Search by name or by what the text says, filter by type
  (origin, general, fighting style, epic boon), by pack, or to only what has no prerequisite, and
  preview any entry before you add it. Anything already on your sheet is marked. Typing your own
  feature by hand is still there, behind the Custom button.
- The picker's Add button now reads "Add 1 item" rather than "Add 1 items" when you have ticked exactly one.
- Items can now be used. Anything with limited uses gets a Use button and a row of pips in your
  inventory, and those uses come back on a short or a long rest — or never, if you would rather track
  them yourself. An item can heal you and apply a status when it is used, and using one up reduces the
  quantity. Healing asks whether you rolled the dice at the table or want the app to roll them, and
  either way the result goes straight onto your hit points. Healing potions from a rules pack already
  know what they heal, so they work without being set up.
