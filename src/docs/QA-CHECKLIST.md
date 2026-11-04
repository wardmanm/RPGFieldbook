# Test pass 1.9.0

Generated against `b68c346` (chore(repo): /pre-release step 3 — Mike's high-level test pass, Claude's pre-drive apart) on 2026-11-02

Generated against `f2e3ad7` (docs: pre-release 1.9.0 — record) on 2026-11-04: the work merged since the pass ("Since the test pass", below); two lines it changed are reworded and unticked, every other mark carried forward

How to mark: tick `- [x]` when a line holds; append `FAIL: <what happened>` to a line that doesn't.

A feature that needs rules data wants SRD 5.2 installed (`dist/srd52_full.json` through Settings → Extensions → Manual install), and the 2024 pack or Humblewood where a feature needs more.

## The Sheet makeover (#103)

- [x] Make a new SRD 5.2 character and read down the Sheet at desktop width: the header (class and level, species, background, Short rest, Long rest, inspiration, level and XP), the rail (portrait, AC, death saves, Init / Speed / Prof, HP, hit dice), the abilities with their saves, then Skills, Defences, Statuses, Resources and Features all sit on one page, and the ↑ button takes a long scroll back to the top
- [x] Take some damage, then tap the hit-dice bar and spend a die twice, once with 🎲 Roll for me and once typing your own roll: the working (roll + CON) shows before it applies, and HP and the dice left follow
- [x] Tap the class, the species and the background in the header: the class opens a menu with its info, subclass, Level up / Level down, add and remove; species and background open their info with Change and Remove
- [x] Add a resistance and an immunity on the Defences card, then on Bio add a sense with a range and a language: each is a chip whose × removes it, and Attacks now lives on the Inventory tab
- [x] With Humblewood loaded, give a character a species, then change it: the old species' language chips go and the new one's arrive, and languages you added yourself stay
- [x] Turn on Settings → Sheet display → Familiars & companions icon, then add, summon and dismiss a familiar from the paw in the header: the paw's menu does all of it and shows who is summoned
- [x] At desktop width, read down the Sheet: Vitals on the left; Abilities, Skills and Statuses & Conditions in the middle; Defences and Resources on the right; Features & Traits full width below, one card per row. The three columns always end on one line: add conditions or resources and the other columns stretch to match, remove them and they shrink back (#155)
- [x] Narrow the window to tablet width (about 900): Skills, Statuses, Defences, Resources read top to bottom, and Tab walks them in that order (#155)

## Level-up (#101)

- [x] Type enough XP into the header to reach the next level: the bar under the level fills toward it, and the level turns into Level up ready
- [x] Level up: the runes, ring and LEVEL banner play (a tap or Esc skips them), then a card lists what the level gave you, and Done waits until hit points are rolled, typed or taken as the average
- [x] Level into a choice, such as a subclass: the card's Continue leads into the choice window, and the new features are on the sheet afterwards
- [x] Add a second class to a levelled character: the fanfare plays for it, and the multiclass note says it needs 13 or more in both primary abilities without blocking you
- [x] Make a level 1 Paladin and a level 1 Ranger: each has two 1st-level spell slots
- [x] Switch Settings → Sheet display → Advancement to Milestone: the XP leaves the header, and Level up from the class menu still works

## Feats (#118)

- [x] Level an SRD 5.2 Fighter to 4: the choice lists Ability Score Improvement first, then the feats you qualify for, and Show all adds the rest with what you're missing in amber
- [x] Choose a feat you don't qualify for (Grappler with Strength and Dexterity under 13), or press Done with a pick unmade: Fieldbook asks in its own window, going back keeps your picks, and Take it anyway grants the feat
- [x] Take a feat that raises a score (Grappler): its +1 is asked in the same step and lands on the score, and removing the feat takes the +1 back
- [x] Choose Human as a species: Versatile opens the feat list for an Origin feat, and changing the species takes that feat away again
- [x] Press Undo level-up on the card (or the message after it), then level up again and use Level down: Undo restores the sheet exactly; Level down shows what the level gave and removes its hit points and features
- [x] Turn Settings → Sheet display → Feats allowed off and reach the next ASI level: the step is the plain ASI, and the feats you already have stay

## Initiative tracker and Party (#91)

- [x] Add two companions on Bio's Party card (one with a max HP), open the combat view and press Start combat: Roll initiative lists you and both, and rolls yours by 🎲 Roll for me (Advantage keeps the higher) or by a d20 you type
- [x] Add a goblin ×2 and a boss in the same window and Start: the strip under the combat header shows everyone in initiative order, each with a health bar, and the one acting is highlighted
- [x] Press Next round the table: the marker moves on, a foe marked Dead is skipped, and passing the last one advances the round
- [x] Tap a foe, a companion and yourself on the strip: a foe's health is one tap on a band, a companion switches between exact HP and an estimate, and ▾ opens the full table
- [x] Add a combatant mid-fight, then reload the page: the newcomer is in its place, and the fight, its round and whose turn it is all come back

## Ammunition recovery and thrown weapons (#104)

- [x] Equip a Longbow with Arrows, set Settings → Sheet display → Ammo recovery to Hits only and Fire a few: each shot asks Hit or Miss, and the toast says which
- [x] Equip a Dagger or a Javelin and Throw it until none are left: the count drops, Throw greys out at ×0, and the weapon stays on the sheet
- [x] End fights under Half, All and None: arrows come back by the rule, a thrown weapon comes back under every rule, and a Pistol's firearm bullets never do
- [x] Set an item's After a fight to Always or Never in the item editor: it overrides the sheet's rule at the next End combat

## End of combat (#105)

- [x] Press End combat: Fieldbook asks in its own window, Keep fighting changes nothing, and End combat opens the End of combat window with the rounds, the time and who fought, the fallen struck through
- [x] Open the folded sections: Ammunition shows what was fired and what came back, with Undo recovery, and the sections you opened are open again at the next fight
- [x] With a Party member, type XP and turn on Split among N: the line shows each share, and when it reaches a level the level-up opens after Done
- [ ] Press Open loot under Loot: the Loot window opens with the fallen foes named in From, and closing it brings back the window with your XP still typed (#166)
- [x] Switch on Show after combat for a counter and a journal page, then end a fight: both appear in the window, + / − and the page's boxes work there, and the Journal tab follows
- [x] Close the window with × while XP is typed, then try a character whose XP reads "6350 xp": × asks whether to add the XP, and the words are never overwritten (the window says to fix them on the sheet)

## Trade and the inventory log (#47)

- [x] On Inventory's Equipment card press ⇄ Trade, give an item and some coins, and get an item from the finder and a custom one: you can't give more than you hold, the balance shows both sides, and Complete Trade applies it all in one step
- [x] Get items worth more than everything you give: the balance reads short in red and Complete asks first; sell an item for more coins than it's worth: it reads in your favour and doesn't ask
- [x] Add, edit, Use and delete items, change coins and trade, then open Log: every change is listed by day, and Undo reverses any that can still be reversed (the rest say why not)
- [x] Add an item from the finder with a Cost of 0.5 gp: it keeps 0.5 gp
- [x] Set Settings → Sheet display → Inventory log size below the number of lines in the log: it asks before dropping any

## Journal checklists and trackers (#93, #94, #95)

- [x] Write a journal page with `[ ]` and `[x]` lines (Insert checkbox adds one): they are boxes you tick in the page itself, the text follows, and the page list shows the count done, like "2/3"
- [x] Put the same lines in a section note and in a Bio text field: they tick there too
- [x] Open a character saved before this release that had checklist or task trackers: they are journal pages now, ticks and dates kept, and Trackers holds counters only
- [x] Add several counters with one tag: they lay out as tiles across the card, and the Σ on the group's heading shows their total, which follows every + and −

## The Rules browser (#99, #53)

- [x] Open Rules with SRD 5.2 loaded: the categories (Classes to Tables) list with counts, and each opens a table you can sort by its headings and narrow with Filters and its own search
- [x] Search the box above the categories for a word such as "fire": matches come grouped by category, with a link to see the rest of each
- [x] Tap a row in Classes, Species, Spells, Feats, Items and Conditions: each opens its window, and a class or species shows its rules only, nothing about your character
- [x] At phone width, open a category and go back with ← Categories: one screen at a time, and a wide table scrolls inside its own box, not the page
- [x] Add a Glossary entry of your own with + Add: it is listed as Yours and opens like the rest

## Hide tabs (#52)

- [x] In Settings → Sheet display → Tabs, hide Spells and Rules: they leave the tab bar, and the Sheet and the combat swords can't be hidden
- [x] Hide the tab you're on: you land at the top of the Sheet
- [x] Switch to another character and back, then reload: each character keeps its own hidden tabs
- [x] Leave a section note on a Spells card, hide Spells, then jump to that note from the Journal's Section Notes card: the Spells tab comes back, with a toast saying where to hide it again
- [x] Put a Spells card into the combat view, then hide Spells: the card stays in the fight

## Hideable edit buttons (#97)

- [x] Tap the pencil in the Features card's heading: its edit and delete buttons go while stars, Use and folding stay; tap it again and they're back
- [x] Hide them on Inventory, Attacks and Spells too, then reload and switch character: each card keeps its own choice, and the other character's cards are untouched
- [x] With Inventory's and Attacks' edit buttons hidden, play a turn: Fire, Throw, Use, equip and + Add all still work

## Extensions and rules packs (#102, #125)

- [x] Open Settings → Extensions: Rules data lists each loaded pack with where it came from, Sources lists Fieldbook public data as built in, and each section folds
- [x] Manual install → Choose files with `dist/srd52_full.json`: a plan says what will change and nothing installs until you confirm; run it again and the plan calls it the same version
- [x] Manual install with a zip, with a folder, and with a file dropped on the dialog: each reaches the same plan
- [x] Delete a pack from its row, then Remove all under Rules data: each asks first, and your characters still open afterwards
- [x] Press Check now, and add a manifest URL if you have one: the status line says what was checked, and an added source is named "name (host)"; when a source offers a newer version, the top bar's Extensions pill says so and its × clears it
- [x] Load a Homebrew pack you installed before this release: it still loads and its content still works

## Since the test pass (#159, #161, #162, #165, #166, #167, #168)

- [ ] Start a fight with more combatants than fit across the strip: the one acting stays in the middle, who has acted this round is on its left and who is still to come on its right, and the rest sit under +N buttons that list them in order (#165)
- [ ] Press Next through a round, then ◂ Prev back across the top of it: the round steps back and the right combatant is acting; Prev is greyed on round 1's first turn (#165)
- [ ] During a fight, the header's title and round sit centred between the round arrows, with Combatants ▾ and End combat centred at the foot (#165)
- [ ] Add four or more monsters in Roll initiative on a phone: the window scrolls, Start stays in reach, nothing touches the right edge, and the "I rolled" box sits beside its words (#161, #162)
- [ ] With Humblewood loaded, add Stonesinger (or another playtest background) from the list: it adds in one click, with no empty +2/+1 pickers (#159)
- [ ] End a fight with fallen foes and press Open loot: only You get, with From naming the foes; take an item and some coins: the inventory log reads "Looted from …" (#166)
- [ ] In a trade, get an item worth more than the coins you've typed and press Balance trade: your coins fill in, a gold piece splits into silver when you need change, and the purse comes out right after Complete (#168)
- [ ] Give more than you get and press Complete Trade: Fieldbook warns first, and Go back changes nothing (#168)
- [ ] Open a journal page's editor and try each Page style (Sheet, Notebook, Book, Parchment): the page reads as a page in each, in both skins, light and dark (#167)

## Across the app

- [x] Both skins, light and dark: open the Sheet, the combat view, a trade and the End of combat window: gold and red buttons, pills and banners read clearly, and the Sheet's rail suits each
- [x] Phone width (390): every tab fits without sideways scrolling, cards on Spells, Inventory and Journal have a gap between them, the trade uses You give / You get tabs, and the header's level and icons share a row
- [x] Offline (cut the network, then open the file): the app opens and works, the update checks fail quietly, and Check now on Extensions says you're offline
- [x] An older saved character (from 1.8.x): it loads with its numbers, notes, inventory and journal intact; "Languages:" lines are chips, checklist trackers are journal pages, and old card notes sit with the header and Vitals
- [x] Print a character: the sheet prints with the new Resistances, Immunities, Senses and Languages box, and no ↑ button, toast or level-up scene

## Device pass

- [x] Touch, on a phone or tablet: play through the Sheet (the hit-dice bar and spend box, the paw, chips' ×), a level-up, a fight (initiative chips, the combatant dialog, End of combat), a trade and the Journal (a checkbox, a tracker tile): every control answers one tap and nothing needs a hover
- [x] Safari, desktop and iPhone: a level-up, a fight to the End of combat window, a trade and Settings → Extensions each work as they do in Chrome
- [x] Safari: type letters into the End of combat window's XP box: "Whole numbers only" shows and Done refuses
- [x] Safari: the inventory Log dialog scrolls its lines between the filters and its foot
- [x] Firefox: a level-up, a fight to the End of combat window, a trade and Settings → Extensions each work as they do in Chrome
- [x] Real phone: a long level-up card (several features at once) puts the hit-points step and Done below the fold: they can be scrolled to and pressed (#101, #146)
- [x] Real phone: the level-up card's class line and LEVEL banner, now in the body font, read well (#101)
- [x] Real phone: the rail's AC shield over the portrait: the AC reads clearly and doesn't hide the portrait's subject (#103)
- [x] Real phone, mid-scroll on Inventory or Journal: where the ↑ button sits over a row's delete, that delete can still be reached (#103, #151)
- [ ] Real phone: the initiative strip: tap a +N, ◂ Prev and Next: the acting chip stays in the middle, a +N's list opens under it, and nothing scrolls sideways (#91, #165)
- [x] Real phone: a trade, switching between You give and You get and completing it with ✓ (#47)
- [x] Real phone: with an update notice showing, the top bar's notices sit on a row of their own and their × can be tapped (#102)
- [x] Desktop: drag rules files from the desktop onto Manual install, and a zip through Manual install: the plan opens with them (#102)
- [x] Reduced motion switched on in the OS or browser: a level-up skips the animation and goes straight to the card (#101)
- [x] Your own characters: load each one: numbers, notes, inventory and journal are as before, and its combat view still holds its cards
- [x] Your own characters: a whole fight with one of them, Start combat to the End of combat window's Done (#91, #105)
- [x] Your own characters: after a session, open the inventory Log: what you traded, bought, used and fired is there (#47)
- [x] Your own characters: level a levelled, multiclassed one up: the level-up card lists what the level really gave (#101)
