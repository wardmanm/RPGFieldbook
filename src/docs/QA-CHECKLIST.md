# QA checklist 1.9.0

Generated against `95b0503` (chore(repo): ask before /pre-release's GitHub writes) on 2026-10-30

**29 lines are yours; 188 passed when Claude drove them** (Chrome, 1280 and 390, both skins) and are folded away at the end.

How to mark: tick `- [x]` when a line passes; add `FAIL: <what happened>` to a line that fails. A `✗ Claude` line is a probable bug: tick it if you disagree.
Lines marked (needs SRD) need SRD 5.2 loaded: install `dist/srd52_full.json` through Settings → Extensions → Manual install first.

## Your pass (29)

### Sheet (1)

- [ ] Remove that ancestry: everything it granted goes with it. (not driven: line may be wrong — traits, the skill pick and the Origin feat revert, but speed (30) and size stay after Remove, which the grants page documents as by design (seeded only when empty))

### Inventory (1)

- [ ] Coins: a signed amount typed into a coin box applies, and the total follows. (not driven: line may be wrong — there is no coin total to follow: a signed amount (+10, -5) applies in the box, but the Coins card shows no total, and Total value (items only) does not change; only Carried weight moves with coin weight)

### Bio (2)

- [ ] + Add under Languages: a chooser with pills from your packs and an "Or type one" box; the added chip has a × that removes it (#103) (not driven: SRD 5.2's species and backgrounds list no languages, so the chooser has no pills, only the Or type one box (a typed language's chip and its × work); needs a pack such as the 2024 one)
- [ ] Choose a species whose rules list languages, then change it to another: its language chips, marked "· species", swap for the new species' (needs a pack whose species list languages, such as the 2024 pack; SRD 5.2's don't) (#103) (not driven: needs a pack whose species list languages (SRD 5.2's don't))

### Journal (1)

- [ ] Press + Tracker: the form has Name, Tag, Goal, Show after combat (and Close when complete once there is a goal), and no Type (#95) ✗ Claude: + Tracker's form shows "Close when complete" before any goal is set: its row (#tkAutoRow) carries the hidden attribute, but .toggle{display:flex} in 50-modal.css overrides it (no .toggle[hidden] rule). Name, Tag, Goal, Show after combat and no Type are right. Shot: FAIL-199-tracker-form-close-when-complete-no-goal.png

### Settings (1)

- [ ] Classic skin, light theme: the text on gold buttons, red buttons, the level ring and the toast reads clearly; then the same in the other skin and dark (#47) ✗ Claude: the toast's Undo button is white text on the gold toast: 2.2:1 in Humblewood dark (3.7:1 classic dark, 4.2:1 Humblewood light); gold buttons, red buttons, the level ring and the toast's own text read clearly in all four. Shot: FAIL-249-hw-dark-toast-undo-contrast.png

### Extensions and updates (7)

- [ ] Add a manifest source: it is listed as "name (host)", with its host and path beneath (needs a manifest URL) (#102) (not driven: needs a manifest URL; none is reachable (the official v1.8.1 manifest 404s))
- [ ] With a source offering a newer version of a loaded pack: the top bar shows "Extensions · 1 update", the page an updates banner with Update all, and the row "have → new" with Update (needs a source offering a newer version) (#102) (not driven: needs a source offering a newer version of a loaded pack)
- [ ] Clear that update pill with its ×: it goes, and stays gone after a reload until a newer version is offered; the page's banner and Update stay (needs a source offering a newer version) (#102) (not driven: needs a source offering a newer version of a loaded pack)
- [ ] An update offered by a different source from the one that installed the pack: the row reads "· update from name (host)" and the plan "Update from name (host)" (needs two sources) (#102) (not driven: needs two manifest sources)
- [ ] Install from a source whose file doesn't match its listed sha256: the plan says "Nothing was installed: … — …", stays open, and the loaded packs are unchanged (needs a source with a mismatched file) (#102) (not driven: needs a source with a mismatched file)
- [ ] A source offering a pack that needs a newer Fieldbook: its row and plan line show "requires Fieldbook X" and it can't be ticked (needs a manifest with a newer minimum app version) (#102) (not driven: needs a manifest with a newer minimum app version)
- [ ] Sources' Remove all: it asks first, then removes every added source and switches Fieldbook public data off; installed packs stay (#102) (not driven: needs an added manifest source; with none added, Sources shows no Remove all)

### Device pass (16)

- [ ] Touch: on a phone or tablet, play through a sheet, a fight (initiative chips, the combatant dialog, End of combat), a trade and the Journal (a checklist box, a tracker tile): every control answers one tap and nothing needs a hover (#105, #118, #102, #47, #91, #52, #101, #103, #97, #99) (not driven: touch on a real phone or tablet)
- [ ] Print: print a character: the sheet prints, with no ↑ button, toast or level-up animation on the page (#101, #103) (not driven: print goes to the browser's print dialog)
- [ ] Safari, desktop and iPhone: open the app from the file and run a level-up, a fight to the End of combat window, a trade and Settings → Extensions: each works as it does in Chrome (#105, #118, #102, #47, #91, #101, #103) (not driven: Safari and iPhone)
- [ ] Firefox: open the app from the file and run a level-up, a fight to the End of combat window, a trade and Settings → Extensions: each works as it does in Chrome (#105, #118, #102, #47, #91, #101, #103) (not driven: Firefox)
- [ ] Safari: type letters in the End of combat window's XP box: "Whole numbers only" shows and Done refuses (#105) (not driven: Safari)
- [ ] Real phone: the initiative strip scrolls sideways with a finger and keeps the acting chip in view as Next moves on (#91) (not driven: real phone)
- [ ] Real phone: a trade, switching the You give and You get tabs and completing it with ✓ (#47) (not driven: real phone)
- [ ] Real phone: with an update notice showing, the top bar's notices sit on a row of their own and their × can be tapped (#102) (not driven: real phone, and needs a source offering an update)
- [ ] Real phone: a long level-up card (several features at once) puts the hit-points step and Done below the fold: they can be scrolled to and pressed (#101, #146) (not driven: real phone)
- [ ] Real phone: look at the rail's AC shield where it meets the portrait: the AC number reads clearly and the shield doesn't cover the portrait's subject (#103) (not driven: real phone)
- [ ] Phone, mid-scroll in Inventory or Journal: the ↑ button can sit over a row's delete button; check whether that row's delete can still be reached (#103, #151) (not driven: phone)
- [ ] Safari: the inventory Log dialog scrolls its rows between the filters and the foot (#47) (not driven: Safari)
- [ ] Desktop: drag rules files from the desktop onto Manual install, and onto the Extensions page: the plan opens with them (#102) (not driven: needs a real drag from the desktop)
- [ ] Your own characters: load each one: it opens with its numbers, notes, inventory and journal as before; languages are chips, old checklists are journal pages, and old card notes sit in the header and Vitals notes (#103, #95) (not driven: Mike's own characters)
- [ ] Your own characters: run a whole fight with one of them, Start combat to End of combat's Done (#91, #105) (not driven: Mike's own characters)
- [ ] Your own characters: after a session, open the inventory Log: what you traded, bought, used and fired is there (#47) (not driven: Mike's own characters)

## Passed by Claude (188)

<details><summary>Home (7)</summary>

- [x] On the home screen, tap Import rules files (bulk) and choose `dist/srd52_full.json`: the install plan opens with SRD 5.2 as New and ticked; Install 1 loads it and a toast says it installed (needs SRD) (#102) ✓ Claude, Chrome 1280/390
- [x] Open the app with no characters: the home screen offers New character and Import. ✓ Claude, Chrome 1280/390
- [x] Make a new character, then go back Home: its card shows its name, system badge and a relative time. ✓ Claude, Chrome 1280/390
- [x] Star a character as autoload and reload the page: that character opens by itself. ✓ Claude, Chrome 1280/390
- [x] Save a character to a `.json` file, delete it, then Import the file: it comes back whole. ✓ Claude, Chrome 1280/390
- [x] Import a file whose character you already have: the app offers Replace, Import as copy, or Cancel. ✓ Claude, Chrome 1280/390
- [x] Delete a character: the app asks first, then the card goes. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Sheet (43)</summary>

- [x] Open a sheet: the header shows the name, then a class line, Short rest, Long rest, the ✦ star and the level ring with an XP box; no Class, Ancestry & Background or Rest & Recovery cards remain (#103) ✓ Claude, Chrome 1280/390
- [x] Add a class, a species and a background: the class line reads like "Fighter 1 · Human · Soldier", and each part is a button (needs SRD) (#103) ✓ Claude, Chrome 1280/390
- [x] Tap the class in the class line: a menu opens with About, the subclass (or Choose subclass), ▲ Level up, ▼ Level down, + Add class and Remove; Esc closes it (needs SRD) (#103) ✓ Claude, Chrome 1280/390
- [x] Tap the species in the class line: its info window ends in Change and Remove (needs SRD) (#103) ✓ Claude, Chrome 1280/390
- [x] Look at the rail: the portrait with the AC shield, death saves, Init, Speed and Prof badges, the hit points bar, the hit dice bar, then Size · Passive Perception (#103) ✓ Claude, Chrome 1280/390
- [x] With HP below max, tap the hit dice bar, pick a die and press 🎲 Roll for me: one die is spent and the heal (roll + CON) is added to Current HP (#103) ✓ Claude, Chrome 1280/390
- [x] In Spend a hit die, type a roll larger than the die (9 on a d8): it is refused with a reason; type 5: a preview like "5 + CON 2 = 7 HP → …" shows, and Apply heals by that (#103) ✓ Claude, Chrome 1280/390
- [x] Add a custom class by name (no rules data for it): the hit dice area shows a hint with the auto/manual pill; switch to manual and type `2d8`: the bar shows d8 2 / 2 (#103) ✓ Claude, Chrome 1280/390
- [x] Defences card: + Add under Resistances, pick Fire: a FIRE chip with × appears; × removes it (#103) ✓ Claude, Chrome 1280/390
- [x] Type 300 into the header's XP box on a level-1 character: the bar fills and the ring becomes "Level up ready"; tapping it starts the level-up (#103) ✓ Claude, Chrome 1280/390
- [x] Turn on Settings → Sheet display → Familiars & companions icon: a faint 🐾 joins the header; its menu offers + Add familiar, Combat view and Add a note (#103) ✓ Claude, Chrome 1280/390
- [x] Add a familiar from the paw's menu: it is listed in the menu with ● or ○; tapping it opens its window with a ● Summoned / ○ Dismissed switch, Edit and Delete (#103) ✓ Claude, Chrome 1280/390
- [x] Level up from the class menu: a short animation plays (a rune circle, then a LEVEL N banner), then a card lists what the level gives and asks for hit points (needs SRD) (#101) ✓ Claude, Chrome 1280/390
- [x] Level up again and tap the screen during the animation: it skips straight to the card (needs SRD) (#101) ✓ Claude, Chrome 1280/390
- [x] On the level-up card, Done stays disabled until hit points are set by Roll for me, an I rolled value with Apply, or Take the average; Done then raises Max and Current HP (needs SRD) (#101) ✓ Claude, Chrome 1280/390
- [x] Level a class to a level with a choice (a Fighter to 3 for its subclass): the card ends in "Continue to your choice ▸", which opens the choice window with no hit-points block (needs SRD) (#101) ✓ Claude, Chrome 1280/390
- [x] Close a level-up card with × before setting hit points: it asks first, applies no hit points, and any choices still open (needs SRD) (#101) ✓ Claude, Chrome 1280/390
- [x] Add a second class to a level-2 character: the level-up card opens for the new class with its own hit-points step (needs SRD) (#101) ✓ Claude, Chrome 1280/390
- [x] Press Undo level-up on the card: the sheet goes back to exactly how it was before the level-up (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] Finish a level-up: a toast like "Fighter is now level 4 · Max HP 28 → 36" offers Undo; Undo restores the level; after any other edit first, Undo says it is no longer available (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] Level a Fighter up, then choose ▼ Level down from its menu: the dialog reads like "Fighter 4 → 3. Level 4 gave you:" with ticked boxes for the hit points and features; Level down removes them (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] Level a Fighter to 4: the step lists Ability Score Improvement first (pressed), then the general feats you qualify for, with a search box and Show all (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] At the Fighter's level 4 step with Strength and Dexterity below 13, turn on Show all: Grappler shows an amber "needs …" tag; pick it and press Done: "Prerequisite not met" offers Choose another and Take it anyway (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] Take Grappler: a "+1 to:" choice between Strength and Dexterity shows, and the chosen score goes up by 1 (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] Take a Fighter to level 19: the card's choice row reads "Epic Boon — a feat, or an Ability Score Improvement", and the step offers the Boon feats (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] Add the Human species: a window offers an Origin feat list (Alert, Magic Initiate, Savage Attacker, Skilled); remove the species and the feat goes with it (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] In a choice window, press Done with a skill still to pick: "Picks left" asks, with Go back and Continue anyway; Go back keeps the picks you made (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] Turn Settings → Sheet display → Feats allowed off and level a Fighter to 4: the step shows only the +2 / +1 and +1 controls, and feats already taken stay (needs SRD) (#118) ✓ Claude, Chrome 1280/390
- [x] Tap the pencil in the Features & Traits heading: each feature's edit and delete buttons hide, Use and the star stay; tap again and they come back (#97) ✓ Claude, Chrome 1280/390
- [x] Tap the pencil in the Defences heading: the chips' × buttons hide (#97) ✓ Claude, Chrome 1280/390
- [x] Look at every card heading: there is no ☰ section menu (#103) ✓ Claude, Chrome 1280/390
- [x] Scroll the Sheet down by more than a screen: a round ↑ button appears in the bottom-right corner; tap it: the page scrolls to the top and the button fades (#103) ✓ Claude, Chrome 1280/390
- [x] Load a character saved before this release that had notes on the old Class, Ancestry & Background or Rest & Recovery cards: the notes are now in the header's and Vitals' notes, under bold "Class:", "Ancestry & Background:" or "Rest & Recovery:" (#103) ✓ Claude, Chrome 1280/390
- [x] Type each ability score: its modifier, its saving throw and the skills under it all follow. ✓ Claude, Chrome 1280/390
- [x] Tap a skill's proficiency dot: its bonus gains the proficiency bonus. ✓ Claude, Chrome 1280/390
- [x] Add an ancestry, a background and a class from the Sheet header: each choice window opens, and what it grants lands on the sheet. ✓ Claude, Chrome 1280/390
- [x] Level up: the hit points step and any choices open; Undo level-up puts the sheet back as it was. ✓ Claude, Chrome 1280/390
- [x] Hit points: − and + change Current; a signed number typed into Current (−7, +4) applies; Temp HP takes damage first; the Max padlock stops Max from moving. ✓ Claude, Chrome 1280/390
- [x] Short Rest restores Warlock pact slots and short-rest uses, offering to spend a Hit Die while any remain; Long Rest restores hit points to full, refills every spell slot, and returns half your Hit Dice. ✓ Claude, Chrome 1280/390
- [x] Death saves: tick successes and failures; only a Long Rest clears them. ✓ Claude, Chrome 1280/390
- [x] Add a condition in Statuses & Conditions: it shows with its notes, and removing it takes its effects away. ✓ Claude, Chrome 1280/390
- [x] Features & Traits: Add searches every feat and trait; a feature with uses counts down and refills on its rest. ✓ Claude, Chrome 1280/390
- [x] Resources: −, + and restore work, and a class's pool refills on the right rest. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Combat (34)</summary>

- [x] Press Start combat: Roll initiative lists you first, with 🎲 Roll for me, I rolled with Apply, and an Advantage switch, then each party member, then a monster row and + Add a monster (#91) ✓ Claude, Chrome 1280/390
- [x] Turn Advantage on and press Roll for me: the line reads "Rolled a, b → higher + mod = total", keeping the higher roll (#91) ✓ Claude, Chrome 1280/390
- [x] Add a monster "Goblin" with × 3 and an initiative, then Start ▸: the strip shows Goblin 1, Goblin 2 and Goblin 3 in initiative order, round 1, and the first row marked as acting (#91) ✓ Claude, Chrome 1280/390
- [x] Press Next ▸ past the last chip: the marker wraps to the first chip and the round goes up by exactly one (#91) ✓ Claude, Chrome 1280/390
- [x] Tap a goblin chip and choose Dead: the dialog closes, the chip fades and is struck through, and Next skips it (#91) ✓ Claude, Chrome 1280/390
- [x] Tap a party member's chip: Exact HP gives a − / + stepper that stops at 0 and at their max; Estimate gives four band buttons; Dead is its own switch (#91) ✓ Claude, Chrome 1280/390
- [x] Change your own HP on the Vitals card mid-fight: your chip's health bar follows (#91) ✓ Claude, Chrome 1280/390
- [x] Open ▾: a table lists every combatant; its foot has + Add combatant, Turns / Rounds and Show rolls. Rounds removes the marker and Next; Show rolls off hides the initiative numbers (#91) ✓ Claude, Chrome 1280/390
- [x] Add a combatant mid-fight with + Add combatant: it lands in its initiative place, and the acting row doesn't change (#91) ✓ Claude, Chrome 1280/390
- [x] Give two combatants the same initiative and open one: Act earlier or Act later swaps them (#91) ✓ Claude, Chrome 1280/390
- [x] Reload the page mid-fight: the strip, the marker and the round come back as they were (#91) ✓ Claude, Chrome 1280/390
- [x] With arrows fired, press End combat: "End combat?" asks "End the fight at round N? Ammunition comes back under your recovery rule."; Keep fighting changes nothing (needs SRD) (#105) ✓ Claude, Chrome 1280/390
- [x] Press End combat and confirm: the End of combat window shows "Round N · time", a chip per combatant with the fallen struck through, and folded rows (Ammunition, Experience, Loot, After combat) (#105) ✓ Claude, Chrome 1280/390
- [x] In the window's Ammunition row: "Arrows: N fired, M recovered", and Undo recovery takes the recovered arrows back off the stack, then reads "Recovery undone" (needs SRD) (#105) ✓ Claude, Chrome 1280/390
- [x] Set Ammo recovery to None, fire arrows, then end combat: the row reads "Arrows: N fired, none come back (recovery: None)" (needs SRD) (#104) ✓ Claude, Chrome 1280/390
- [x] With three people on the Party card, type 450 in Experience and turn on Split among 4: it reads "450 ÷ 4 = 112 each"; Done adds 112 XP to the sheet (#105) ✓ Claude, Chrome 1280/390
- [x] Type XP that reaches the next level: the row says "Level N ready — the level-up opens when you press Done."; Done opens the level-up (needs SRD) (#105) ✓ Claude, Chrome 1280/390
- [x] Type 112 in Experience, then close the window with ×: "Add 112 XP?" asks, with Add XP and Don't add; either closes the window, and only Add XP adds it (#105) ✓ Claude, Chrome 1280/390
- [x] Put "6350 xp" in the sheet's XP box, then end a fight: the Experience row says "Your XP on the sheet isn't a number, so it can't be added to here.", and Done leaves it as typed (#105) ✓ Claude, Chrome 1280/390
- [x] After marking a goblin Dead, end the fight and press Open trade in the Loot row: the trade opens with With already holding the fallen foes' names; Cancel brings the End of combat window back as it was (#105) ✓ Claude, Chrome 1280/390
- [x] Complete a trade from Loot: the window comes back and the Loot row reads "Traded with …" (#105) ✓ Claude, Chrome 1280/390
- [x] Flag a tracker and a journal page "Show after combat", then end a fight: the After combat row shows the tracker's tile and the page's text; + on the tile moves the Journal tab's tile too, and a ticked box ticks the page (#105) ✓ Claude, Chrome 1280/390
- [x] With the flagged page open for editing in the Journal tab, tick its box in the End of combat window: a toast says "Finish editing “…” first." and nothing changes (#105) ✓ Claude, Chrome 1280/390
- [x] Open one row of the window, close it, then end another fight: that row opens the way you left it (#105) ✓ Claude, Chrome 1280/390
- [x] Set Settings → Sheet display → Advancement to Milestone, then end a fight: the window has no Experience row (#105) ✓ Claude, Chrome 1280/390
- [x] Hide the Journal tab, then end a fight with a flagged page: the window has no After combat row (#105) ✓ Claude, Chrome 1280/390
- [x] Add Features & Traits to the combat view and tap its pencil there: its edit buttons hide in the view and stay hidden back on the Sheet (#97) ✓ Claude, Chrome 1280/390
- [x] Open the combat view from the Spells tab, hide Spells in Settings, then press the swords: you land on the Sheet (#52) ✓ Claude, Chrome 1280/390
- [x] The crossed swords open the combat view with the cards chosen for it; picking a word tab sends them home. ✓ Claude, Chrome 1280/390
- [x] Start combat opens Roll initiative; starting the fight puts the round at 1. ✓ Claude, Chrome 1280/390
- [x] Turns move through the initiative order, and the round counts up. ✓ Claude, Chrome 1280/390
- [x] Fire a ranged weapon: its ammunition count drops, and Undo puts the shot back. ✓ Claude, Chrome 1280/390
- [x] End combat asks first, then the End of combat window opens with its folded sections. ✓ Claude, Chrome 1280/390
- [x] Leaving the combat tab during a fight does not end it. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Spells (10)</summary>

- [x] Add a Paladin at level 1: Spell Slots shows two 1st-level slots (needs SRD) (#101) ✓ Claude, Chrome 1280/390
- [x] Add a Ranger at level 3: Spell Slots shows three 1st-level slots (needs SRD) (#101) ✓ Claude, Chrome 1280/390
- [x] Tap the pencil in the Spells & Cantrips heading: each spell's edit and delete buttons hide; Cast and the prepared pin stay (needs SRD) (#97) ✓ Claude, Chrome 1280/390
- [x] At 390 wide, scroll the Spells tab: the cards have a small gap between them instead of touching (#103) ✓ Claude, Chrome 1280/390
- [x] Add a spell from the browser: it appears under its level. ✓ Claude, Chrome 1280/390
- [x] Mark a spell prepared, then unprepare it. ✓ Claude, Chrome 1280/390
- [x] Cast a levelled spell: a slot of its level is spent; with that level empty, the app offers to upcast. ✓ Claude, Chrome 1280/390
- [x] Cast a concentration spell while concentrating on another: the app asks to drop the first and start the new one; confirm, and only one Concentrating condition remains. ✓ Claude, Chrome 1280/390
- [x] A spell with a duration appears in Active Spells and counts down with the rounds. ✓ Claude, Chrome 1280/390
- [x] A spell with an attack roll or a save shows its line in Attacks & Weapons. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Inventory (26)</summary>

- [x] Open Inventory: Attacks & Weapons is the first card here, and the Sheet no longer has it (#103) ✓ Claude, Chrome 1280/390
- [x] Add a Dagger through the finder: its attack row has a Throw button; each Throw counts it down, at ×0 it stays on the sheet with Throw disabled, and Recover N gives it back (needs SRD) (#104) ✓ Claude, Chrome 1280/390
- [x] Set Ammo recovery to Hits only and press Fire on a longbow with arrows: "Longbow: hit or miss?" asks; closing it with × fires nothing (needs SRD) (#104) ✓ Claude, Chrome 1280/390
- [x] Throw a Dagger under Hits only: it throws at once, with no question, since thrown weapons always come back (needs SRD) (#104) ✓ Claude, Chrome 1280/390
- [x] Edit an ammunition item: an After a fight select offers Sheet's rule, Always comes back and Never comes back; on a firearm bullet the first reads "Default (never comes back)" (needs SRD) (#104) ✓ Claude, Chrome 1280/390
- [x] In the item finder, type 0.5 in Cost (gp) and Add an item: it lands costing 0.5 gp, not 0 (needs SRD) (#47) ✓ Claude, Chrome 1280/390
- [x] Open ⇄ Trade and get an item worth more than you give: the balance reads "N gp short" in red, and Complete Trade asks first (needs SRD) (#47) ✓ Claude, Chrome 1280/390
- [x] In a trade, give an item and get more coins than it is worth: the balance reads "N gp in your favour", and Complete Trade doesn't ask (#47) ✓ Claude, Chrome 1280/390
- [x] Turn each side's Apply item value switch off and on: the balance follows (#47) ✓ Claude, Chrome 1280/390
- [x] In a trade's With box: chips offer your Party members and the names of earlier trades (#47) ✓ Claude, Chrome 1280/390
- [x] Make a trade at 390 wide: the sides are tabs "You give · n" and "You get · n", the balance stays in view, and a ✓ button completes it (#47) ✓ Claude, Chrome 1280/390
- [x] Put something in a trade and press ×: "Discard this trade?" asks first (#47) ✓ Claude, Chrome 1280/390
- [x] Open the Equipment card's Log: filters All, Trades, Items, Coins and Ammo; lines grouped by day, newest first; a trade's details fold under Receipt (#47) ✓ Claude, Chrome 1280/390
- [x] Change your coins, then Undo that line in the Log: the coins go back, the line is struck through, and an "Undid: …" line is added (#47) ✓ Claude, Chrome 1280/390
- [x] Add Rope ×2 through the finder, delete it, then press Undo on the add line in the Log: it is refused with "It has since been used, sold or removed." (needs SRD) (#47) ✓ Claude, Chrome 1280/390
- [x] Remove a class that granted starting equipment: the Log gets one "Removed with …" line listing what left, with no Undo (needs SRD) (#47) ✓ Claude, Chrome 1280/390
- [x] Clear log: it asks first, then empties the log (#47) ✓ Claude, Chrome 1280/390
- [x] Tap the pencil in the Equipment & Inventory heading: the item edit and delete buttons hide; Use and equip stay (#97) ✓ Claude, Chrome 1280/390
- [x] At 390 wide, scroll the Inventory tab: the cards have a small gap between them (#103) ✓ Claude, Chrome 1280/390
- [x] Add an item through the finder: it lands in its section with its weight and cost. ✓ Claude, Chrome 1280/390
- [x] Type an item in by hand and edit it: the edits are still there after a reload. ✓ Claude, Chrome 1280/390
- [x] Equip armor: AC in the Sheet's rail changes; add a shield: AC gains its bonus. ✓ Claude, Chrome 1280/390
- [x] A weapon has a row in Attacks & Weapons with its to-hit and damage worked out. ✓ Claude, Chrome 1280/390
- [x] An item with uses: Use counts down, and the uses come back on their rest. ✓ Claude, Chrome 1280/390
- [x] Open the trade window, give and get coins and an item, then Complete Trade: both sides land, and the inventory log records the trade with Undo. ✓ Claude, Chrome 1280/390
- [x] The encumbrance pill follows the weight carried. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Bio (11)</summary>

- [x] The tab bar reads Bio where it said Story; its first card is Proficiencies, Senses & Languages, with Alignment, Languages and Senses (#103) ✓ Claude, Chrome 1280/390
- [x] A new character's Languages show a COMMON chip marked "· rules" and no × (#103) ✓ Claude, Chrome 1280/390
- [x] + Add under Senses: pick Darkvision, range 60: a "DARKVISION · 60 ft" chip appears (#103) ✓ Claude, Chrome 1280/390
- [x] Load a character saved before this release whose Proficiencies text has a "Languages: Common, Elvish" line: those languages are chips with ×, and the line has left the text (#103) ✓ Claude, Chrome 1280/390
- [x] Party card: + Add with a name, AC and max HP; the row shows them, its edit button changes them, and its remove button takes it away (#91) ✓ Claude, Chrome 1280/390
- [x] Tap the pencil on the Party card: each row's edit and remove buttons hide (#97) ✓ Claude, Chrome 1280/390
- [x] Tap the pencil on the Proficiencies, Senses & Languages card: the chips' × buttons hide (#97) ✓ Claude, Chrome 1280/390
- [x] Write "[ ] Find the sword" in Backstory and press Done: it shows as a checkbox you can tick right there, and the tick is kept after a reload (#95) ✓ Claude, Chrome 1280/390
- [x] Type into each bio card and reload: the text is kept. ✓ Claude, Chrome 1280/390
- [x] Add a language and a sense under Proficiencies, Senses & Languages. ✓ Claude, Chrome 1280/390
- [x] Add someone to the Party card: they appear in the initiative tracker's party. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Journal (16)</summary>

- [x] Write a page with the lines `[ ] Rope`, `[x] Torch` and `- [ ] Map`: three checkboxes show, one ticked, and the page list shows 1/3 next to its title (#95) ✓ Claude, Chrome 1280/390
- [x] Tick a box on the page: the text's line becomes `[x]`, and the list's count goes up by one (#95) ✓ Claude, Chrome 1280/390
- [x] In the page editor, press Insert checkbox: `[ ] ` goes on a line of its own and the caret sits right after it (#95) ✓ Claude, Chrome 1280/390
- [x] Put `[ ] Buy rations` in a section note: in the Section Notes card it is a box you can tick, and the note's hover preview shows ☐ or ☑ (#95) ✓ Claude, Chrome 1280/390
- [x] Load a character saved before this release that had checklist or task trackers: each checklist is now a journal page of `[ ]` / `[x]` lines, tasks a "Tasks" page per tag, and Trackers holds only counters (#95) ✓ Claude, Chrome 1280/390
- [x] Make three trackers with one tag: they lay out as tiles across the card, two across at 390 wide (#94) ✓ Claude, Chrome 1280/390
- [x] Tap the Σ on that tag group's heading: the heading shows the group's total after its count, like "Kills (3) · 42"; completing one of them keeps the total (#93) ✓ Claude, Chrome 1280/390
- [x] Tap the pencil on the Journal card: a page's Edit and Delete hide, and an empty page reads "Nothing written yet." (#97) ✓ Claude, Chrome 1280/390
- [x] The page editor has a Show after combat switch; turn it on, Done, and open the editor again: it is still on (#105) ✓ Claude, Chrome 1280/390
- [x] Hide Spells, then use the jump link on a Spells section note in the Section Notes card: the Spells tab comes back, a toast says "Spells tab shown again; hide it in Settings → Sheet display.", and the card is shown (#52) ✓ Claude, Chrome 1280/390
- [x] At 390 wide, scroll the Journal tab: the cards have a small gap between them (#103) ✓ Claude, Chrome 1280/390
- [x] Make a page with a title, a tag and text: it saves and groups under its tag. ✓ Claude, Chrome 1280/390
- [x] Search finds a page by a word in its text. ✓ Claude, Chrome 1280/390
- [x] A line starting `[ ]` is a checkbox: tick it from the page. ✓ Claude, Chrome 1280/390
- [x] Make a tracker: + and − count, and one that reaches its goal closes itself, with Undo. ✓ Claude, Chrome 1280/390
- [x] Write a section note from a card's heading: it shows in the Section Notes card. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Rules (12)</summary>

- [x] Open the Rules tab: a list of categories with counts (Classes, Subclasses, Species, Backgrounds, Feats, Traits, Spells, Items, Conditions, Glossary, Tables) beside the open category's table (needs SRD) (#99, #53) ✓ Claude, Chrome 1280/390
- [x] Open Spells: a sortable table (Name, Level, School, Time, Source); tap a column heading to sort and again to reverse (needs SRD) (#99, #53) ✓ Claude, Chrome 1280/390
- [x] In Spells, open Filters, pick a level: only those spells show, the button reads "Filters (1)", and Clear removes it (needs SRD) (#99) ✓ Claude, Chrome 1280/390
- [x] Tap a class row: its window opens with nothing to add or change (needs SRD) (#99) ✓ Claude, Chrome 1280/390
- [x] Type "of" in the search over every category: results grouped by category, up to 8 each, then "N more in Spells →", which opens Spells with "of" in its own search box (needs SRD) (#99) ✓ Claude, Chrome 1280/390
- [x] Open Items: the first 300 rows show, then a "Show N more" button (needs SRD) (#99) ✓ Claude, Chrome 1280/390
- [x] Open a category and reload the page: the Rules tab opens on that category again (needs SRD) (#99) ✓ Claude, Chrome 1280/390
- [x] At 390 wide, open a category: it fills the screen, and ← Categories goes back to the list (needs SRD) (#99) ✓ Claude, Chrome 1280/390
- [x] Browse each rules category; search narrows the list. ✓ Claude, Chrome 1280/390
- [x] Open a glossary term, then add a glossary entry of your own. ✓ Claude, Chrome 1280/390
- [x] Open a table; a `[Table: Name]` chip in rules text opens that table in place. ✓ Claude, Chrome 1280/390
- [x] A glossary term inside a feature's text is a chip that opens its entry. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Settings (14)</summary>

- [x] Settings → Sheet display: Cards has Colour current HP and Trackers card only; there is no Skills display or Hit Dice display row (#103) ✓ Claude, Chrome 1280/390
- [x] Settings → Sheet display → Advancement, Milestone: the header's XP box and bar go; back to XP and they return with the XP kept (#103) ✓ Claude, Chrome 1280/390
- [x] Settings → Sheet display → Ammo recovery offers Half (rules as written), All, Hits only and None (#104) ✓ Claude, Chrome 1280/390
- [x] Settings → Sheet display → Feats allowed is a switch, on by default (#118) ✓ Claude, Chrome 1280/390
- [x] Settings → Sheet display → Tabs: a switch each for Spells, Inventory, Bio, Journal and Rules, the Journal one noting "Also holds the Section Notes card."; the Sheet isn't listed (#52) ✓ Claude, Chrome 1280/390
- [x] Hide the tab you are on: the app goes to the Sheet, at the top (#52) ✓ Claude, Chrome 1280/390
- [x] Hide Rules on one character, then open another: the other's Rules tab still shows; switch back and it is hidden again (#52) ✓ Claude, Chrome 1280/390
- [x] With Icon tabs on, hide Journal: its icon leaves the tab bar too (#52) ✓ Claude, Chrome 1280/390
- [x] Settings → Sheet display → Inventory log size, pick a size smaller than your log: it asks "Keep the newest N? …"; declining leaves the size as it was (needs a log longer than 100 lines) (#47) ✓ Claude, Chrome 1280/390
- [x] The cog opens Settings, and every page in its sidebar opens. ✓ Claude, Chrome 1280/390
- [x] Switch light and dark, then the skin: the whole app follows. ✓ Claude, Chrome 1280/390
- [x] Hide a tab for this character: it leaves the tab bar, and comes back when shown again. ✓ Claude, Chrome 1280/390
- [x] Back up: export the settings file, then import it; the status line says what the import did. ✓ Claude, Chrome 1280/390
- [x] Credits name the icon artists and every loaded pack's credit. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Extensions and updates (13)</summary>

- [x] The Settings sidebar shows Extensions where Rules data was; its page has Rules data and Sources sections that fold from their headers, and stay folded after a reopen (#102) ✓ Claude, Chrome 1280/390
- [x] Sources lists Fieldbook public data as built in, with a switch, then a URL box, + Add a source URL, Check now and Manual install… (#102) ✓ Claude, Chrome 1280/390
- [x] Type a web address that isn't a manifest and press + Add a source URL: the status line says why it wasn't added, and nothing else changes (#102) ✓ Claude, Chrome 1280/390
- [x] Manual install…: the dialog offers Choose files, Choose a folder and a drop zone; choose `dist/srd52_full.json`: the plan lists SRD 5.2 with its version, size and New (needs SRD) (#102) ✓ Claude, Chrome 1280/390
- [x] Manual install the same file again: the plan shows it as Same version and unticked, so nothing installs by default (needs SRD) (#102) ✓ Claude, Chrome 1280/390
- [x] Drop a file that isn't a rules pack (a .txt) on Manual install: the toast says "Nothing to install: drop rules packs (.json) or a data zip." (#102) ✓ Claude, Chrome 1280/390
- [x] Tap a loaded pack's name: its details show its version and "installed", and the Source box reads "Imported from a file: …" (needs SRD) (#102) ✓ Claude, Chrome 1280/390
- [x] Manual install an older `homebrew_full.json` (from a 1.8 data download) with SRD 5.2 loaded: it installs, and The Predator is listed in Rules → Subclasses (needs SRD and the old file) (#125) ✓ Claude, Chrome 1280/390
- [x] Settings → Extensions lists the loaded packs and the official source. ✓ Claude, Chrome 1280/390
- [x] Check now with a network: the official source answers, or says it can't be reached, and nothing breaks. ✓ Claude, Chrome 1280/390
- [x] Manual install of a pack file (`dist/srd52_full.json`): the pack loads and its rules appear. ✓ Claude, Chrome 1280/390
- [x] With no network at all: the app opens and works, and no update check shows an error. ✓ Claude, Chrome 1280/390
- [x] The version button opens the changelog, newest release first. ✓ Claude, Chrome 1280/390

</details>

<details><summary>Device pass (2)</summary>

- [x] The level-up card's class line and LEVEL banner are in the body font, in both skins (#101) ✓ Claude, Chrome 1280/390
- [x] Manual install of a data zip (a release's data download): the plan lists every pack in it (#102) ✓ Claude, Chrome 1280/390

</details>
