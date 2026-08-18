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
- Editing an attack no longer breaks its link to the weapon it came from. Renaming or tweaking a
  weapon attack used to quietly detach it from the item in your inventory, and the next time you
  updated your rules packs you were given a second copy of the same attack.
- Editing a spell no longer detaches it from the rules pack it came from. Changing so much as its
  wording used to leave the update tool guessing by name, so it could no longer tell a pack revision
  from something you had deliberately written yourself.
- Updating your rules packs no longer overwrites an attack you had edited. A weapon's attack row used
  to be rebuilt from the item every time, so a renamed attack or a damage die you had adjusted was
  quietly thrown away. Attacks you have changed are now left as you left them, and so are attacks
  from before this version, where there is no way to tell. Untouched ones still follow the weapon.
- Spells can now carry additional damage types, the same way attacks do. Add as many extra dice as
  the spell needs in the spell form and they show on the attack row it creates, in the cast dialog
  and on the printed sheet. Extras roll on their own.
- Casting a spell that needs concentration now adds a Concentrating condition to your statuses,
  naming the spell you are holding. The two are the same thing: clear or remove the condition and
  the spell ends, and ending the spell on Active Spells clears the condition. Concentrating on
  something else, letting a spell run out of time, or deleting it all keep the two in step, so you
  are never left holding a condition for a spell that is no longer running.
- The picker's Add button now reads "Add 1 item" rather than "Add 1 items" when you have ticked exactly one.
- Items can now be used. Anything with limited uses gets a Use button and a row of pips in your
  inventory, and those uses come back on a short or a long rest — or never, if you would rather track
  them yourself. An item can heal you and apply a status when it is used, and using one up reduces the
  quantity. Healing asks whether you rolled the dice at the table or want the app to roll them, and
  either way the result goes straight onto your hit points. Healing potions from a rules pack already
  know what they heal, so they work without being set up.
- Attacks & Weapons now lists a spell only when it has damage to roll. A spell that just imposes a saving throw with no damage no longer takes up a row there — its save DC is on the Spells tab. Spells you attack with still appear either way, because the to-hit is the number you need.
- Fixed the damage on spells written as "10d6 + 40 force damage" or "3d6 damage of the chosen type" — Disintegrate, Finger of Death, Chromatic Orb, Dragon's Breath and others were showing no damage at all. Existing characters pick this up the next time the sheet is opened.
- Formatting now works everywhere you can type, not just in section notes. Bold, italics, `code`, bullet and numbered lists, headings, quotes and rules all render in your Story fields (Appearance, Backstory, Notes and the rest), in item, feature, status and spell descriptions, and in the preview panels. Line breaks you type are finally kept.
- The little preview that pops up from a section's note icon now shows your formatting instead of flattening it. Bold, italics and `code` render, a bullet shows as a bullet, and line breaks are kept. Rules terms stay plain there on purpose — the preview disappears when you reach for them.
- The item editor can now set the armour an item gives. Pick Light, Medium, Heavy or Shield and the base AC, and the sheet works out the Dex it adds. Armour from a rules pack opens with its numbers already filled in, so you can see the formula that was only ever hidden in the description — and a piece of armour you invent yourself now works exactly like one from the book.
- Attacks and weapons can be favourited now, the same as items and features — starred ones gather at the top of the list.
- Attacks & Weapons and Features & Traits gained the Collapse all / Expand all button that Inventory already had.
- Group headings across the app now match the Inventory and Spells ones: the same colour, with the count in brackets beside the heading.

