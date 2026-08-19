# Fieldbook — Character Sheet App

A friendly, offline character sheet for **Dungeons & Dragons 5e (2024 rules)** and the
**Humblewood** setting. It's a single file that runs in any web browser on a computer, tablet,
or phone — no accounts, no installation, and no internet needed once it's open.

This guide is written for everyone, including non-technical folks. Take it a section at a time.

---

## Contents

1. [What Fieldbook is](#1-what-fieldbook-is)
2. [How to run it](#2-how-to-run-it) — computer, Android, **iPhone/iPad**
3. [First-time setup](#3-first-time-setup)
4. [⚠️ Saving & backups (please read)](#4-️-saving--backups-please-read)
5. [A tour of the app](#5-a-tour-of-the-app)
6. [How the smart features work](#6-how-the-smart-features-work)
7. [Settings & themes](#7-settings--themes)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)
9. [What's in the download](#9-whats-in-the-download)
10. [Credits & licences](#10-credits--licences)

---

## 1. What Fieldbook is

Fieldbook keeps track of a tabletop RPG character for you: ability scores, HP, spells, gear,
money, features, and more. It does the fiddly math automatically — armor bonuses, attack rolls,
spell slots, hit dice, and resources like Rage or Sorcery Points — and it works completely
offline.

It's a **single file** called `fieldbook.html`. Opening that file *is* running the app.

---

## 2. How to run it

### On a computer (Windows, Mac, or Linux) — easiest

1. Find the `fieldbook.html` file (it's inside the download; see [section 9](#9-whats-in-the-download)).
2. **Double-click it.** It opens in your default web browser and you're ready to go.

That's it. If double-clicking opens a code editor or something odd, right-click the file →
**Open With** → choose a browser like Chrome, Edge, Firefox, or Safari.

### On an Android phone or tablet

1. Save `fieldbook.html` somewhere you can find it (for example, your **Downloads** or **Files**).
2. Open the **Files** app, tap the `fieldbook.html` file, and choose to open it with **Chrome**
   (or another browser).

### On an iPhone or iPad — needs a small workaround

Apple makes it hard to open a plain HTML file directly, so here's the reliable way:

1. Install **Microsoft Edge** from the App Store (it's free).
2. Open the **Files** app and find `fieldbook.html`.
3. **Long-press** the file, then tap **Share**.
4. In the row of app icons, **scroll all the way to the right** and tap the **“…”** (More) button.
5. Find **Edge** in the list and tap **Open in Microsoft Edge**.

From there it runs normally, and you can bookmark it in Edge for quick access next time.

### Do I need the internet?

Only the very first time you open it (to load it into the browser). After that it works fully
offline — on a plane, in a basement dungeon, anywhere.

---

## 3. First-time setup

When you first open Fieldbook you'll see a **home screen**. Two quick things to do:

### a) Load the rules data (recommended)

The app comes with one rules file per book, in the `data` folder:

- **`5e2024_full.json`** — D&D 2024: species, classes, spells, feats, backgrounds, items, magic
  items, conditions, glossary and reference tables. Start here for D&D.
- **`humblewood_full.json`** — Humblewood: species, classes, subclasses, spells, feats,
  backgrounds and reference tables.
- **`xanathars_full.json`** — Xanathar's Guide to Everything: 95 spells, 31 subclasses, 15 feats,
  43 magic items, the Eldritch Invocations and Arcane Shot options, and the downtime and
  tool-proficiency rules with their tables.
- **`tashas_full.json`** — Tasha's Cauldron of Everything: 26 subclasses, 21 spells, 15 feats,
  84 magic items, Custom Lineage, and the infusions, metamagic, fighting styles, maneuvers, runes
  and optional class features.
- **`homebrew_full.json`** — community homebrew, currently The Predator (a Warlock patron) with its
  pact boon and invocations.

The last three are **add-ons to D&D 2024, not games of their own** — load `5e2024_full.json` as
well, or there will be no classes for their subclasses to attach to. If a pack refers to something
you haven't loaded, Fieldbook says so: the pack gets a red **! n missing** badge under **Loaded
data**, and hovering it lists what's absent and which file to import. Nothing breaks — you just
won't get the parts that depend on the missing pack.

> **A note on editions.** Xanathar's and Tasha's are 2014-era books, converted exactly as
> published. Their subclasses list features at the 2014 levels, and the text refers to 2014 class
> features. Where the 2024 Player's Handbook reprinted a subclass, you get **both** — the 2024 one
> under its plain name and the older one tagged with its book, e.g. `Gloom Stalker (XGE)` — so
> nothing you have already chosen changes, and you pick which version your table uses.

Loading them turns on the pickers and auto-calculations. You can load them in any of these places:

- **On the home screen:** under **Rules data**, tap **Import rules files (bulk)** and pick as many
  of the files from the `data` folder as you want.
- **Later, from Settings** (gear icon): **Rules → Import files**.
- **From the Rules tab:** if nothing is loaded yet, there's an **Import rules files** link right
  there.

Pick as many or as few of the `data` files as you want. They merge together, and once loaded
they're remembered for next time. You never *have* to load them — you can fill everything in by
hand — but they make life much easier.

> **Tip:** You don't have to load them all. Playing only Humblewood? Load just
> `humblewood_full.json`. Only core D&D? Load just `5e2024_full.json`, and add
> `xanathars_full.json`, `tashas_full.json` or `homebrew_full.json` if your table uses them.

### b) Create a character

On the home screen choose **New character**, give it a name, and pick whether it's a **D&D** or
**Humblewood** character (this just sets the look and the coin types). You can keep several
characters and switch between them from the home screen at any time.

---

## 4. ⚠️ Saving & backups (please read)

**Fieldbook autosaves as you go — but only inside that one browser on that one device.**

Autosave uses your browser's private storage. That's convenient, but it is **not a real backup**.
Clearing your browser history/data, using a different browser, "private/incognito" mode, a
phone reset, or certain iOS storage cleanups can **erase your characters without warning**.

**So make a habit of exporting your character at the end of every session:**

- Tap the **Save** button in the top bar. This downloads a file named
  `humblewood-<your character>.json` — that's a real backup you own.
- Keep those files somewhere safe (cloud drive, email to yourself, etc.).
- To restore or move a character to another device, tap **Load** in the top bar and choose the
  file.

Think of it like a video game: autosave is nice, but you still want to save your own file before
you quit. **When in doubt, hit Save and keep the file.**

You can also back up your whole setup (appearance settings **and** all loaded rules) from
**Settings → Export settings**, and restore it later with **Import settings**.

---

## 5. A tour of the app

Along the top you'll find your character's key buttons: **Home** (switch characters), **Load** and
**Save** (import/export a character file), **Print** (a printer-friendly sheet — see below), the
**Settings** gear, and a light/dark theme toggle.

The app is organized into tabs:

### 🗡️ Sheet

Your main character page:

- **Portrait, name, alignment, and experience.** Your level and proficiency bonus are worked out
  for you.
- **Ancestry & Background** and **Class** cards. Use **Level up / Level down** on the Class card;
  the app applies the right features and asks you to make any choices (skills, subclass, feats,
  ability increases).
- **Ability Scores.** Tap any score to see a breakdown of exactly what's adding to it.
- **Vitals:** AC, Initiative, Speed, Size and Passive Perception, with Inspiration as a star in the
  card's heading.
- **Hit Points:** current / max / temporary HP with quick +/− buttons, and death saves. All three
  boxes take **signed entries** like the coin boxes — type `-7` to take damage, `+4` to heal, or a
  plain number to set the total. Current HP won't go past your maximum or below zero.
- **Rest & Recovery:** **Short Rest / Long Rest**, plus your **Hit Dice** — spend them to heal (tap
  the 🎲 to roll), automatically figured from your class(es). A long rest brings some back. (You can
  switch Hit Dice to manual entry — see [section 6](#6-how-the-smart-features-work).)
- **Statuses & Conditions**, **Attacks & Weapons**, **Skills**, **Resources**,
  **Features & Traits**, and **Familiars & Companions**.

### 🎒 Inventory

Items are grouped into collapsible **sections** (Weapons, Armor, Consumables, Magic Items, Tools,
Gear, Loot), with equipped items sorted to the top of each and the rest alphabetical. Tap the **★**
on any item to pin it to a **Favorites** section at the very top. The section tabs stay pinned while
you scroll, and the **☰** button in the tab bar opens a jump-to-section list for the current tab.


- **Equipment & Inventory:** add gear from the built-in browser or make your own. Items can be
  **collapsed** to keep the list tidy (tap the little arrow, or **Collapse all / Expand all**).
  Equip items that give bonuses and your stats update automatically.
- **Coins:** tracks your money, with an **Auto-convert** button that rolls loose change up into
  higher denominations. Coin types match your character's setting.
- **Carried weight:** items can have a weight, and the bottom of the list totals what you're
  hauling — including your coins, at 50 to the pound. Turn on **Encumbrance** in Settings and you
  also get a carrying capacity, a badge in the card header, and a Speed that actually drops when
  you're overloaded. Two flavours: **Standard** (over Strength × 15 you can only push, drag or
  lift, at 5 ft of movement) and **Variant** (the Encumbered / Heavily Encumbered tiers).

### ✨ Spells

- **Spell slots** fill in automatically based on your caster level.
- Each spell level shows how many you've added versus how many you can have, and warns you (in
  red) if you go over. Spells granted by a feat or background are marked and don't count against
  that limit.
- **Add spells** from a searchable, filterable browser (by level, class, school, and more), or
  add your own.

### 📝 Notes

Every section of your sheet can hold a note — tap the small page icon beside any heading on the
**Sheet**, **Spells**, **Inventory** or **Story** tabs. The icon lights up when there's something
there, and hovering it shows you the note without opening it. Each note remembers when you wrote it
and when you last changed it.

The **Notes** tab gathers them all, grouped by where they came from, with a link on each that takes
you back to that section. Notes print with your sheet.

Notes support a little formatting:

| You type | You get |
|---|---|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | fixed-width text |
| `# Heading` | a heading (`#` to `######` for smaller ones) |
| `- item` | a bullet list (`*` and `+` work too) |
| `1. item` | a numbered list |
| `> quoted` | an indented quote |
| `---` | a horizontal divider |

Rules terms you know stay tappable inside notes, and `[Table: Some Table]` links to a loaded table,
exactly as they do everywhere else. Links, tables and nested lists aren't supported.

### 📖 Story

Space for your character's backstory, personality, and notes. Any rules terms you know appear as
tappable links here so you can read a reminder without leaving the page.

### 📚 Rules

Two cards, both fed by the rules packs you've loaded.

**Glossary & Rules** is a searchable glossary of conditions and rules terms. It shows entries from
any rules pack you've loaded, plus any personal terms or house rules you add yourself. If nothing's
loaded, there's a handy **Import rules files** link.

**Reference Tables** lists every reference table in the rules you've loaded, in one searchable
list — roll tables, class level progressions, background personality/ideal/bond/flaw tables, and
the lookup tables the rules keep pointing you at.

You mostly won't need to scroll down to the tables, because they come to you: wherever a spell, feat, item or
class feature mentions one by name, that name is highlighted in the text. Tap it and the table opens
right there, without losing your place. Species, backgrounds and subclasses also link to their own
tables from their info panels.

Tables arrive with your rules packs, so if you don't see any, import a pack. Descriptions still read
perfectly well without them.

### 🖨️ Printing or saving a PDF

Tap the **Print** button (the printer icon in the top bar) to get a clean, printer-friendly
version of the whole character — abilities, saves, skills, attacks, spells, features, **inventory
and coins**, and your notes, all laid out in plain black-on-white.

It opens your device's normal print dialog, so from there you can either send it to a printer or
choose **"Save as PDF"** (or "Save to Files" on iPhone/iPad) to keep a tidy copy. A printed or
PDF sheet also makes a nice offline backup to bring to the table.

---

## 6. How the smart features work

You don't need to understand any of this to use the app — it just works — but here's what's
happening behind the scenes.

- **Automatic bonuses (the "effects" system).** Items, features, and statuses can carry bonuses
  (like +1 AC or +2 to a save). When something is equipped or turned on, your sheet updates
  instantly, and turning it off removes the bonus. Tap any stat to see everything contributing to
  it.

- **Rests.** **Long Rest** restores HP to full, clears temporary HP, refills spell slots and
  resources, recovers some Hit Dice, resets death saves, and refreshes per-rest abilities.
  **Short Rest** refills the things that come back on a short rest (like Warlock pact slots and
  short-rest abilities). Each rest shows a short summary of what it did.

- **Hit Dice.** Normally figured automatically from your class and level (e.g. `3d10`, or
  `3d10 + 2d6` if you multiclass). Prefer to set them yourself? Tap the **auto** badge next to
  "Hit Dice" to switch to **manual** — the app warns you that, in manual mode, your dice won't
  follow your class automatically when you level up. A **Reset to class** link switches back.

- **Resources.** Point-pools like **Rage**, **Ki/Focus Points**, **Sorcery Points**, or the
  Gadgeteer's **Scrap** appear automatically for the right classes and grow as you level. You can
  also add your own custom pools. Spend and restore them with the +/− buttons; rests refill them.

- **Feature uses & costs.** Features can track limited uses (with tappable pips that reset on a
  rest) and can **cost** a resource — a **Use** button spends it for you and won't let you overspend.

- **Weapons create attacks.** Add a weapon to your inventory and a matching entry appears under
  **Attacks & Weapons**, with the to-hit and damage worked out. Remove the weapon and its attack
  goes away too. (When you build a custom item, tick the **Weapon** box to get the same linking.)

- **Multiple characters.** Keep a whole party. Switch, duplicate, or delete them from the home
  screen, and set one to open automatically. There's an **Import** button there too, so you can open
  a saved character file without going into a sheet first.

- **Starting hit points.** Add your first class at level 1 and Max HP is filled in from the hit die
  — a d8 class starts on 8, at full health. It only ever fills in a blank, so a number you typed
  yourself is never overwritten, and it stays out of the way when you multiclass.

- **Adding and spending coins.** Type a plain number in a coin box to set it, or **+10** / **-5** to
  add or spend without doing the arithmetic. For a purchase spanning several denominations, the
  **Adjust** button takes an amount for each coin at once, shows you the resulting totals, and won't
  let you spend coins you don't have.

- **Keeping up with rules updates.** Your character remembers which version of Fieldbook it was last
  checked against — that's the small badge on its card, which turns gold when there may be something
  new. Open it and Fieldbook offers to compare the sheet against your loaded rules and show exactly
  what differs: a feat whose wording changed, a spell that was corrected, a feature that was missing.
  Tick what you want and leave the rest, or just carry on playing.

  Anything you've hand-edited is flagged and left unticked, entries that can't be matched with
  confidence are shown but never changed, **nothing is ever deleted**, and your own numbers are never
  touched. **A backup is always saved first** — as a separate entry in your character list, or as a
  downloaded file if your browser is out of space. You can run the check any time from
  **Settings → This character → Check for rules updates**.

- **New versions of the app.** When a newer release is published, an **↑ Update** pill appears in the
  top bar linking to the download. It only looks when you're online and fails quietly otherwise, so
  the app still works completely offline.

---

## 7. Settings & themes

Open **Settings** (the gear icon). It's grouped into collapsible sections — **Appearance**, **This
character**, **Rules data**, **Characters & backup** — and remembers which ones you left open. From
there you can:

- **Manage rules data:** import files, see a list of everything currently loaded (grouped by
  file), and remove any piece you no longer want.
- **Back up everything:** **Export / Import settings** saves your appearance settings *and* all
  loaded rules to a single file — handy for moving your whole setup to another device.
- **Toggle the hand-drawn borders** on or off (turn off for a plainer look or on slower devices).
- **Icon tabs:** the tab bar switches from words to icons on its own when the screen is narrow;
  turn this on to get icons at any size.
- **Set this character's Size and Encumbrance:** Size also sits in Vitals on the sheet, where you can
  tap it. It comes from your ancestry unless you pick one, and decides how much you can carry (Large
  and up carry double, Tiny half). Encumbrance is off by default — weight is still tracked and
  totalled, just without penalties. There's also a switch for whether your coins count toward the
  load.

**Themes:** there's a light/dark toggle in the top bar, plus a **Humblewood** or **Classic D&D**
look. The app can also follow your device's system light/dark setting.

---

## 8. Troubleshooting & FAQ

**The file opens as code / text instead of the app.**
Right-click it and choose **Open With → (a web browser)**. On iPhone/iPad, use the Edge steps in
[section 2](#2-how-to-run-it).

**My character disappeared!**
Autosave lives only in that browser's storage, which can be wiped (see
[section 4](#4-️-saving--backups-please-read)). Restore from a `.json` file you exported with the
**Save** button (**Load** → pick the file). This is exactly why exporting after each session
matters.

**A spell slot / feature isn't showing up.**
Make sure you've loaded the relevant rules files (Settings → Rules), and that your class and
level are set on the Sheet tab.

**Can I use it on more than one device?**
Yes — export your character (and optionally your settings) on one device and import them on the
other. They don't sync automatically; you move the files yourself.

**Does it cost anything or need an account?**
No. It's just a file you open in a browser.

**Is my data private?**
Everything stays on your device. The app doesn't send your characters anywhere.

---

## 9. What's in the download

```
fieldbook.html      ← the app — open this to run Fieldbook
README.md           ← this guide
LICENSE             ← the MIT licence this app is released under
data/               ← the rules data — one file per book, import the ones you play
   • 5e2024_full.json     — D&D 2024: species, classes, spells, feats, backgrounds,
                            items, magic items, conditions, glossary, reference tables
   • humblewood_full.json — Humblewood: species, classes, subclasses, spells, feats,
                            backgrounds, reference tables
   • xanathars_full.json  — Xanathar's Guide: subclasses, spells, feats, magic items,
                            invocations, downtime and tool rules (add-on to D&D 2024)
   • tashas_full.json     — Tasha's Cauldron: subclasses, spells, feats, magic items,
                            Custom Lineage, infusions and optional class features
                            (add-on to D&D 2024)
   • homebrew_full.json   — community homebrew (add-on to D&D 2024)
docs/               ← reference material (you can ignore these to just play)
   • CHANGELOG — what changed in each release
   • rules schema — the format, if you want to write your own rules data
   • converter notes — how the data-generation tool works
scripts/            ← convert.py (plus overlay.json and class-resources.json, the two
                      files it reads), for advanced users generating their own rules data
```

**To play, you only ever need `fieldbook.html`.** The `data` files make the pickers and
auto-math available, and the `docs`/`scripts` folders are optional extras for the curious.

## 10. Credits & licences

Fieldbook itself is MIT-licensed — see `LICENSE`.

**Icons.** The emblems beside each class, ancestry and background come from
[game-icons.net](https://game-icons.net), by Caro Asercion, DarkZaitzev, Delapouite, Lorc
and Skoll, used under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Each icon
has been changed: its original black background square was removed, and its colour now
follows your chosen theme. Which icon came from whom is recorded in
`src/icons/icons.json` in the source repository, and the same credit appears in the app
under **Settings → Credits & licences**.

**Rules content** is not distributed with the app. You load it yourself, from files you
supply, and it keeps whatever terms it came with.

Have fun out there. 🌿
