# Smoke list: still works

The standing "Still works" lines for each release's QA checklist. `/pre-release` copies each area's
lines, word for word, into `src/docs/QA-CHECKLIST.md` under that area, and never edits this file:
Mike does, as the app grows. One line is one thing to do and what you should see. The areas are the
app's, in tab order; keep the `## ` headings as they are, because the skill and the docs suite read
them. The first version was written from the wiki's feature pages (#127).

## Home
- Open the app with no characters: the home screen offers New character and Import.
- Make a new character, then go back Home: its card shows its name, system badge and a relative time.
- Star a character as autoload and reload the page: that character opens by itself.
- Save a character to a `.json` file, delete it, then Import the file: it comes back whole.
- Import a file whose character you already have: the app offers Replace, Import as copy, or Cancel.
- Delete a character: the app asks first, then the card goes.

## Sheet
- Type each ability score: its modifier, its saving throw and the skills under it all follow.
- Tap a skill's proficiency dot: its bonus gains the proficiency bonus.
- Add an ancestry, a background and a class from the Sheet header: each choice window opens, and what it grants lands on the sheet.
- Remove that ancestry: everything it granted goes with it.
- Level up: the hit points step and any choices open; Undo level-up puts the sheet back as it was.
- Hit points: − and + change Current; a signed number typed into Current (−7, +4) applies; Temp HP takes damage first; the Max padlock stops Max from moving.
- Short Rest restores Warlock pact slots and short-rest uses, offering to spend a Hit Die while any remain; Long Rest restores hit points to full, refills every spell slot, and returns half your Hit Dice.
- Death saves: tick successes and failures; only a Long Rest clears them.
- Add a condition in Statuses & Conditions: it shows with its notes, and removing it takes its effects away.
- Features & Traits: Add searches every feat and trait; a feature with uses counts down and refills on its rest.
- Resources: −, + and restore work, and a class's pool refills on the right rest.

## Combat
- The crossed swords open the combat view with the cards chosen for it; picking a word tab sends them home.
- Start combat opens Roll initiative; starting the fight puts the round at 1.
- Turns move through the initiative order, and the round counts up.
- Fire a ranged weapon: its ammunition count drops, and Undo puts the shot back.
- End combat asks first, then the End of combat window opens with its folded sections.
- Leaving the combat tab during a fight does not end it.

## Spells
- Add a spell from the browser: it appears under its level.
- Mark a spell prepared, then unprepare it.
- Cast a levelled spell: a slot of its level is spent; with that level empty, the app offers to upcast.
- Cast a concentration spell while concentrating on another: the app asks to drop the first and start the new one; confirm, and only one Concentrating condition remains.
- A spell with a duration appears in Active Spells and counts down with the rounds.
- A spell with an attack roll or a save shows its line in Attacks & Weapons.

## Inventory
- Add an item through the finder: it lands in its section with its weight and cost.
- Type an item in by hand and edit it: the edits are still there after a reload.
- Equip armor: AC in the Sheet's rail changes; add a shield: AC gains its bonus.
- A weapon has a row in Attacks & Weapons with its to-hit and damage worked out.
- An item with uses: Use counts down, and the uses come back on their rest.
- Coins: a signed amount typed into a coin box applies, and the total follows.
- Open the trade window, give and get coins and an item, then Complete Trade: both sides land, and the inventory log records the trade with Undo.
- The encumbrance pill follows the weight carried.

## Bio
- Type into each bio card and reload: the text is kept.
- Add a language and a sense under Proficiencies, Senses & Languages.
- Add someone to the Party card: they appear in the initiative tracker's party.

## Journal
- Make a page with a title, a tag and text: it saves and groups under its tag.
- Search finds a page by a word in its text.
- A line starting `[ ]` is a checkbox: tick it from the page.
- Make a tracker: + and − count, and one that reaches its goal closes itself, with Undo.
- Write a section note from a card's heading: it shows in the Section Notes card.

## Rules
- Browse each rules category; search narrows the list.
- Open a glossary term, then add a glossary entry of your own.
- Open a table; a `[Table: Name]` chip in rules text opens that table in place.
- A glossary term inside a feature's text is a chip that opens its entry.

## Settings
- The cog opens Settings, and every page in its sidebar opens.
- Switch light and dark, then the skin: the whole app follows.
- Hide a tab for this character: it leaves the tab bar, and comes back when shown again.
- Back up: export the settings file, then import it; the status line says what the import did.
- Credits name the icon artists and every loaded pack's credit.

## Extensions and updates
- Settings → Extensions lists the loaded packs and the official source.
- Check now with a network: the official source answers, or says it can't be reached, and nothing breaks.
- Manual install of a pack file (`dist/srd52_full.json`): the pack loads and its rules appear.
- With no network at all: the app opens and works, and no update check shows an error.
- The version button opens the changelog, newest release first.
