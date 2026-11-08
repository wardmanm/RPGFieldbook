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
- In a browser that blocks storage for the page, Fieldbook now opens and tells you it can't keep your
  characters or settings, instead of stopping on a half-drawn screen.
- Rules packs you added or removed while your browser couldn't use its main store no longer come back
  as the older set the next time you open Fieldbook.
- A character that opens automatically at launch now gets the rules-update prompt, the same as one you
  open from the home screen.
- Removing a pack, or Remove all, now says on its status line when the change couldn't be saved, and
  that what you removed may come back next time.
- The app's lettering now looks the same offline as online: its fonts are built in.
- Vitals has an edit pencil like the other cards. Tap it to lock Vitals: the portrait buttons hide and
  Max HP can't be changed. The small padlock is gone, and Max HP can be typed into again until you lock
  Vitals.
- On a phone or tablet, tapping the HP bar opens a Hit points window: type how much, then tap Damage,
  Heal or Temp. No minus sign needed. "Set exactly" underneath types the numbers straight in.
- The hit-point numbers and the − and + signs now sit in the middle of the bar and their buttons. When
  there isn't room beside the numbers, your temporary hit points show beside the Hit points label instead.
- Armor Class can be set by hand: tap the AC shield and switch from Calculated to Flat, then type
  your AC. Flat ignores armour, shields, and item and feature bonuses; things that come and go, like
  the Shield spell as a status you've added, still add. The shield on the sheet reads FLAT while
  it's on, and locking Vitals with its pencil locks your AC's setting too.
- Only your best shield counts toward Armor Class now; two equipped shields used to add together.
- A to-hit or damage effect can count for spells: tick Include spells on the effect. The
  Spellcasting card, the cast window and the spell's attack row now always show the same number.
  An effect that isn't ticked counts for weapons only, so a spell's attack row no longer adds it:
  Archery's +2, for one, now goes only on ranged weapons, as the rules say, and no longer on a
  spell like Fire Bolt.
- Editing a feature or an item no longer stops its uses growing with your level.
- Tool proficiencies are chips on the Bio tab, like languages. A background's tools arrive with
  it and leave with it. When a background lets you choose ("one kind of Gaming Set"), you pick
  it as you add the background, or later by tapping its chip. Tools already written in your
  Proficiencies text become chips the first time you open the sheet.
- The Add window for resistances, immunities, languages and tools lets you pick several at once.
- Chips on the Sheet and Bio tabs, and the choices in their Add window, have more room and are
  easier to tap on a phone.
- Removing or changing your species, background or class now takes back the speed, size,
  spellcasting ability and proficiency text it gave you, unless you changed them yourself. Size
  no longer shows as set by hand when your species set it.
- Tap Speed to set your own base speed. A speed you type stays when you change species, and a
  custom species can have a speed at last.
- Skin now only changes how Fieldbook looks. It no longer changes the open character's game, and
  opening a character from the other game no longer switches it. To change a character's game, use
  Settings → Sheet display → Game system, which tells you what will change before it does.
- A D&D character's sheet says Race and its top bar reads D&D Character Sheet, and a Humblewood
  character's says Ancestry, whichever skin you use.
- A Humblewood character holding platinum or electrum (from a D&D sheet, or an imported one) now
  sees them on the Coins card until they're spent or converted.
- When a settings change can't be saved, because your browser's storage is full, Fieldbook now says
  so once instead of quietly losing it the next time you open it.
