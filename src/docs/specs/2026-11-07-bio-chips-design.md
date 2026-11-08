# Bio chips: tools as chips, roomier chips, multi-select, clean swaps — design

**Status:** draft 2026-11-07, design calls settled; awaiting Mike's approval of the document · wave 2 of [1.9.1](../wiki/roadmap/1.9.1.md), the Bio chips worktree
**Issues:** #121 (tool proficiencies as chips) → #120 (chips need more padding, rides along) →
#119 (multi-select in the Add window) + #123 (the Add window's spacing, rides along) → #131
(removing a source leaves seeded speed, size and text). One branch, `issue/121-bio-chips`, built
in that order.
Read [Story & notes](../wiki/features/story-and-notes.md), [Grants & provenance](../wiki/architecture/grants-and-provenance.md),
[Character model](../wiki/architecture/character-model.md) and [Character building](../wiki/features/character-building.md)
first, and [Vitals & rest](../wiki/features/vitals-and-rest.md) for Size and Speed, and the
[armour & attack numbers spec](2026-11-06-armour-attack-numbers-design.md) for the AC window the Speed window copies. Line numbers below are at e07a136.

---

## 1. What it is

**#121.** The Bio tab's first card gets a **Tools** chip row beside Languages and Senses. A
background's tools arrive as chips stamped with the background, "THIEVES' TOOLS · background",
and leave with it. When a background offers a choice ("Choose one kind of Gaming Set"), the
choices window that opens after Add background asks for it, and the pick becomes the chip. If
the app can't turn the wording into a list, or the player leaves the pick unmade, a **placeholder
chip** holds the place ("GAMING SET · choose") and a tap on it names it later. The "Tools: …"
lines already in a sheet's Proficiencies text become the player's own chips, once. What text is
left sits under an **Other proficiencies** heading styled like the others.

**#120 and #123.** The chips on the Bio tab and the Sheet's Defences card get room: bigger tap
targets, space between chips and between rows, and a clear rule under each heading. In the Add
window the suggestion pills are spaced and padded, with clear space above "Or type one".

**#119.** In the Add window for resistances, immunities, languages and tools, the suggestion pills
toggle on and off, and **Add** takes all the ticked ones at once (plus anything typed). Senses stay
one at a time, because each carries a range.

**#131.** Removing or changing a species, background or class takes back what it seeded:
speed, size, spellcasting ability, the Proficiencies text it added, and the old `ancestry` and
`background` strings. A value the player has since changed is theirs and stays. A side effect
is that Size no longer shows "set by hand" when the species set it. Because a removed species now
takes its speed with it, **tapping the Speed badge opens a window with a Base speed box**, as Size
has its window, above the breakdown it shows today. A speed typed there is the player's: no swap
or remove touches it, and a custom ancestry gets a speed at last.

Why: tools were the one proficiency still written as prose. Prose can't be removed with its
source, so a swapped background left its old tools behind (#121, #131). The chips were too tight
to read and to tap on a phone (#120, #123). Adding four damage types one at a time was slow
(#119). A swapped species kept the old speed and size, because the seed only fills an empty field
(#131). And nothing on the sheet let a player set their own base speed (Known issues).

## 2. Decisions

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | A background's tool **choice** (#121) | **Asked when the background is added:** a pick step in the choices window `runExtraChoices()` opens. The pick names the chip, which carries the background's source (Mike, 2026-11-07) | A placeholder to name later as the only path: the pick belongs with the add. Named tools only: leaves the choice as prose, which is the issue |
| 2 | Wording the app can't list, and a pick left unmade | **A placeholder chip** with the pack's wording, carrying the background's source; tapping it names it. Mike chose this for unreadable wording; using it for a skipped pick too is my call | Dropping a skipped pick: the background would grant nothing visible, and the choice would be lost |
| 3 | "Tools: …" lines already in Proficiencies | **Lifted once into the player's own chips**, as "Languages: …" lines were (Mike, 2026-11-07), under their own once-flag `toolsLifted` | Leaving them as text: the issue |
| 4 | A lifted line's choice part ("one Gaming Set or Musical Instrument of your choice") | **A placeholder chip, the player's own** (my call) | Leaving it in the text: half a line left behind reads as a bug. Dropping it: the player loses the reminder |
| 5 | Is a lifted tool tied to the background? | **No: it is the player's**, as lifted languages are (my call, for consistency with #103). Without the pack loaded, `migrate()` can't tell a background's line from one the player typed | Guessing from `bg.name`: a wrong guess deletes a player's tool when they change background |
| 6 | Armor and weapon chips | **Not in this branch.** Class training belongs to wave 3's #137 (Mike didn't choose it) | — |
| 7 | The leftover Proficiencies text | **An "Other proficiencies" heading** styled like Languages and Senses (`.def-h`), then the text and its Edit button, shown even when empty (Mike, 2026-11-07) | No heading: the issue's style mismatch. Hidden when empty: Mike didn't choose it |
| 8 | Which Add windows become multi-select (#119) | **Resistances, immunities, languages and tools.** Senses stay one at a time (Mike, 2026-11-07) | Senses too: each sense needs its own range box |
| 9 | A swap or remove, when the player changed a seeded value (#131) | **The player's value stays.** A source's value is reverted only while it still matches what that source put in (Mike, 2026-11-07) | The source always wins: overwrites the player's choice. Asking each time: a dialog for something with one right answer |
| 10 | How the sheet knows what a source seeded | **A record, `character.seeds`:** one entry per seedable field a source carries (`{sid, field, value}`), written when the source is applied and compared at the revert (my call) | Stop storing seeds and read speed and size live from the pack: a sheet opened without its pack would read Speed 0 and lose its size. Recognise by value only, as level-1 HP is: a pack update that changes a species' speed would strand the old value |
| 10a | A source applied over a field that is already full | **It still writes an entry, with `value: null`**: "applied, seeded nothing". Its revert then touches nothing (my call) | Writing no entry: the fallback (decision 11) would take the missing entry for an old sheet and revert the player's value. Two cases: a Wizard added over an INT the player set, then removed; a Tiefling, the player picks Small, then a swap to Gnome and Gnome removed |
| 11 | Sheets saved before the record | **The fallback runs only when there is no entry at all for that sid and field**, which is true only of a source applied before this change. Then the field counts as seeded if it equals exactly what the outgoing source's loaded definition seeds. With no definition loaded, or a different value, it is kept (my call) | No fallback: every existing character keeps the bug. A one-time pass in `migrate()`: the rules may not be loaded when it runs. Running the fallback whenever no value is recorded: see 10a |
| 12 | Spellcasting ability when its source goes | **Handed to the next caster**, as saving throws pass to the new first class (#66): one helper, run after **every** revert that empties `spellAbility` (`removeClass()`, and `selectSubclass()` replacing a subclass that seeded it). It seeds an empty `spellAbility` from the first remaining class, or that class's subclass, that casts, under that one's sid (my call) | Leaving it blank: a Cleric/Wizard who drops Cleric, or a Fighter/Wizard whose Eldritch Knight is swapped, would have no spell DC. Handing on only from `removeClass()`: the subclass path would miss it |
| 13 | A species' `proficiencies` text | **Stays text**, under Other proficiencies, and is now recorded and removed with the species (my call). It is free text that mixes armor, weapons and tools, and no shipped pack uses it | Parsing it into tool chips: it isn't a tool list |
| 14 | A class's tool training (Rogue's multiclass Thieves' Tools, Bard's instrument) | **Left to #137** (my call). Nothing applies it today. If #137 tracks it, it adds a `class` source key to `CHIP_SRC` and uses this chip row | Doing it here: #137 is where the design call for class training sits |
| 15 | The tool suggestion list | **The loaded packs' items whose `category` is `Tool`, merged case-blind with a built-in list in `41-chips.js`** (Artisan's Tools ×17, Gaming Sets ×4, Musical Instruments ×10, other kits ×6) (my call). The 2024 pack's `items-magic.json` (loaded into `rules.items`, `convert.py` ≈ 3052) has all four gaming sets (type `Gaming Set`) and the six kits (type `Tool`). The SRD pack has only `Artisan's Tools` and `Instrument`, and Humblewood has none, so the built-in list fills those | Pack items only: an SRD or Humblewood character would have no gaming set to pick, the commonest choice |
| 15a | What a placeholder chip is called | **A real name, since `chipClean()` drops an entry without one:** the kinds the wording names ("Gaming Set", "Artisan's Tools", "Gaming Set or Musical Instrument"), else "Tool of your choice". The pack's wording is kept in `ask` (my call) | The wording as the name: long, and Humblewood's would read "ONE TYPE OF WIND MUSICAL INSTRUMENT · CHOOSE" |
| 15b | Dismissing the choices window with a tool pick unmade | **No warning for it.** Nothing is lost: the placeholder stays on the card and a tap names it. Tool blocks still count in Picks left at Done (my call) | The dismiss guard's "There is no way to reopen this later": untrue for a tool |
| 16 | Size showing "set by hand" when the species set it (#146's item) | **Fixed here** (my call): it is one line once the record exists. Tick it off in #146 when this merges | Leaving it to #146: the same field, the same branch |
| 17 | The card's row order | **Alignment, Languages, Senses, Tools, Other proficiencies** (my call): the two proficiency rows sit together at the bottom | Tools first: it splits Languages from the card's title order |
| 18 | Naming a placeholder while the card's pencil is locked | **Still works** (my call). The pencil hides removal (×), not play; naming adds information | Hidden with the pencil: a granted placeholder could then never be named on a locked card |
| 19 | The field's name and sources | **`tools`**, `[{id, name, src}]` like `languages`, plus an optional `ask` on a placeholder; sources `bg:<Name>` and `race:<Name>` through `CHIP_SRC` (my call) | A separate placeholder list: two lists to keep in step |
| 20 | Speed once a revert can empty it | **A Base speed box.** Tapping the Speed badge opens a window with the box above today's breakdown, as Size has its window. A speed typed there is the player's own and is never reverted or overwritten (Mike, 2026-11-07) | Keeping the outgoing speed when the incoming source sets none: a removed species' speed stays behind, the leftover #131 is about. Accepting Speed 0 after a remove or a custom ancestry: looks broken, with no way to fix it |
| 21 | How a typed value is told apart from a seed | **A `player` entry in `seeds`** (`{sid:"player", field, value}`): `seedField()` writes nothing over it (recording `null`, as decision 10a does for any full field), and `unseedSource()` skips that field entirely, fallback included. Size's window and Settings → Carrying write it too, so a size the player picks behaves the same way (my call) | Deleting the field's entries on a typed save: with no entry left, the fallback (decision 11) would revert a typed speed that happens to equal the old species'. A separate flag per field: a second mechanism beside `seeds` |
| 22 | The box while Vitals is locked | **Read-only**, as the AC window's Flat box is (the armour & attack numbers spec, decision 7): the Vitals pencil locks the rail's own numbers. The breakdown below still shows (my call) | Always editable: Base speed would be the one rail number the pencil doesn't lock |

## 3. Data

All new fields are optional, have a default in `blankChar()`, and survive a save→load round trip
(constraint 3).

- **`tools`**: `[]` in `blankChar()`, next to `languages` (`00-constants.js` ≈ 83). Each entry is
  `{id, name, src}`, and a placeholder also carries **`ask`**, the pack's wording (a non-empty
  string). `CHIP_KEYS` gains `"tools"`, so `migrateSheet103()`'s `chipClean()` pass covers it.
- **`chipClean()`** keeps `src` for `tools` as it does for `languages`: one rule, keyed by a list of
  sourced chip keys rather than `key==="languages"`. It keeps `ask` only when it is a non-empty
  string. **Duplicates are dropped by name among named chips only.** A placeholder (with `ask`) is
  never deduplicated, so "two Artisan's Tools of your choice" can hold two. The unknown-`src` rule
  stays: anything `chipSrcKey()` doesn't know reads as the player's.
- **`seeds`**: `[]` in `blankChar()`. Each entry is `{sid, field, value}` with `field` one of
  `speed`, `size`, `spellAbility`, `proficiencies`. `value` is what the source wrote, stored as it
  wrote it: a string, or a **number** (a Humblewood species' speed is `30`, an SRD or 2024 one
  `"30 ft"`). It is **`null`** when the source carries the field but found it already full and
  wrote nothing (decision 10a). It joins `migrate()`'s list of array fields forced to objects
  (`71-char-io.js` ≈ 146). Every read goes through one accessor (say `seedsOf(c)`), which ignores
  an entry unless it has a string `sid`, a known `field`, and a `value` that is a string, a finite
  number or `null`. Values are compared with `String()` on both sides. There is one entry per sid
  and field: applying a source again replaces its own entries. **The sid `player`** marks a value
  the player set in the Speed or Size window (decision 21). It is used only for `speed` and `size`,
  and at most one exists per field.
- **`speed`** keeps its shape: a typed Base speed is stored as a whole number of feet (`35`), as a
  Humblewood seed is. Everything that reads it already goes through `num()`.
- **`toolsLifted`**: a one-time flag, **never set in `blankChar()`** (the `langLifted` rule, and
  the `wpnEquipInit` trap). `migrateSheet103()` runs `liftTools()` once beside `liftLanguages()`,
  and `newCharacter()` sets `toolsLifted=true` beside `langLifted`.
- Nothing else changes shape. `ancestry` and `background` stay as they are, cleared on remove (§7).

## 4. Tools as chips (#121)

**Parsing** (`41-chips.js`, pure): `toolParse(str)` → `{fixed:[names], choices:[{kinds, count,
ask}]}`. It splits on commas, "and" and semicolons (as `langParse()` does). A fragment naming a
choice (choose, choice, any, one, two, three, kind, type) is a choice: `count` comes from
one/two/three (default 1), `kinds` are the known kinds it names ("Artisan's Tools", "Gaming
Set", "Musical Instrument"/"Instrument"), and `ask` is the fragment as written. Anything else is a
fixed tool name. A non-string reads as nothing. Each choice also carries the placeholder's
**name** (decision 15a). Every shipped wording has a test (§10):

| Pack wording | Result | Placeholder's name |
|---|---|---|
| `Calligrapher's Supplies`, `Thieves' Tools` | one fixed chip | none |
| `Choose one kind of Gaming Set` (SRD and 2024) | one choice, kind Gaming Set | Gaming Set |
| `Choose one kind of Artisan's Tools` (2024) | one choice, kind Artisan's Tools | Artisan's Tools |
| `Choose one kind of Musical Instrument` (2024) | one choice, kind Musical Instrument | Musical Instrument |
| `Disguise Kit, and one Gaming Set or Musical Instrument of your choice` (Humblewood) | Disguise Kit fixed, then one choice of Gaming Set or Musical Instrument | Gaming Set or Musical Instrument |
| `one type of Artisan's Tools of your choice` (Humblewood) | one choice, kind Artisan's Tools | Artisan's Tools |
| `one type of wind Musical Instrument` (Humblewood) | one choice, kind Musical Instrument, with the pack's wording as the step's label, so the player picks a wind one | Musical Instrument |
| a choice naming no known kind | a placeholder only, no step | Tool of your choice |

**The suggestion list:** `toolSuggestions()` returns kinds → names: loaded `rules.items` with
`category==="Tool"`, filed by `type` (`Artisan's Tools`; `Instrument` or `Musical Instrument` →
Musical Instrument; `Gaming Set`; `Tool` or anything else → Other), merged case-blind with the
built-in list (decision 15), so the 2024 pack's own names win and nothing appears twice, then
sorted within each kind.

**Granting** (`applyBackground()`, `54-background.js` ≈ 79–83): the "Tools: …" note is replaced
by one call, `grantTools(character, "bg:"+name, d.tools, _bgPending)`, so wave 3's #160, which also
edits `applyBackground()`, rebases over a one-line change. `grantTools()`:
- adds each fixed name the sheet lacks as a chip with that `src`. As with languages, a tool the
  sheet already has keeps its own source;
- adds `count` placeholders per choice (`ask` set, `src` the background), and queues one pending
  step per choice, `{ch:{type:"tool", kinds, choose:count, label:ask, _sid}, sid, label}`, carrying
  the placeholders' ids so the pick names exactly them.
- `applyRace()` grants no tool chips (decision 13).

**The pick step** (`58-choices.js`, `50-classrace.js`): `runExtraChoices()` collects `type:"tool"`
entries beside skills, feats and equipment. `choiceFieldHTML()` gains a `tool` block: a heading
with the pack's wording, then checkboxes from `toolSuggestions()` for the named kinds, grouped by
kind with a small heading, `data-choose=count` and the "0 of 1 chosen" counter, so `choiceBlocks()`
and `choiceShortfall()` count it in **Picks left at Done** like a skill block. A tool the sheet
already has is ticked, disabled and marked "(already yours)", the skills' `data-fixed` pattern.

**The dismiss guard leaves tool blocks out** (decision 15b). `choiceBlocks()` returns each
block's `ctype` as well, and `armChoiceDismissGuard()` (`58-choices.js` ≈ 562–577) filters out
`tool` blocks before it counts picks and shortfall. Its "There is no way to reopen this later"
text then speaks only of what is really lost. A window whose only blocks are tool steps has no
guard at all (the guard returns `""`): dismissing it closes the window, and the placeholders stay
on the card. A window with a tool step beside a skill or feat block warns exactly as it does now
about those blocks. A pick already ticked in a tool block is discarded on dismiss, as every pick
in a dismissed window is, and the placeholder stays.
`gatherChoices()` reads `{type:"tool", sid, names}` plus the placeholder ids.
`commitExtraChoices()` names each placeholder in turn: the chip's `name` becomes the pick and `ask`
goes. Unpicked placeholders stay. Nothing about the tool step reaches `commitChoices()`: no class
level has a tool choice today.

**Removing:** `removeBackground()` drops `tools` chips whose `src` is `bg:<Name>`, placeholders
included. The drop is generalised from `dropLanguages()` to `dropChips(c, key, src)`, and
`dropLanguages()` stays as a one-line wrapper so its callers don't move. `removeRace()` drops
`race:` tools as it drops `race:` languages.

**On the card** (`src/html/30-story.html`; `renderBioChips()` gains `#bioTools`):
`chipsHTML(c,"tools")` draws the chips like languages: "THIEVES' TOOLS · background", with no ×
on a granted chip. A placeholder is a `<button>` styled dashed, "GAMING SET · choose" (its `ask`
in the title attribute and accessible name), with `data-chipask="<id>"`. The delegate in
`90-boot.js` (≈ 176) opens `openToolNamer(id)`: the Add window in single-pick mode, with the
placeholder's kinds first and "Or type one". It names the chip, keeps its `src`, and refuses a
name the sheet already has, saying so. A player's own placeholder also has ×.

**The lift** (`71-char-io.js`, beside `liftLanguages()`): `liftTools(c)` takes each line matching
`^\s*tools\s*:` out of `proficiencies`, runs `toolParse()` on the rest of the line, and adds the
fixed names as the player's chips (`src:""`) and each choice as the player's placeholder. The text
is tidied as `liftLanguages()` tidies it. It runs once, behind `toolsLifted` (§3).

**Everywhere else a background's tools show:** `openAddBackground()`'s "Also grants" preview and
`openBackgroundInfo()` keep showing the pack's wording (they describe the pack, not the sheet).
`printSheet()`'s chip lines (`71-char-io.js` ≈ 249) gain "Tools", with a placeholder printed as
its wording.

**Other proficiencies** (decision 7): in `30-story.html` the `#rt-proficiencies` host and its Edit
button sit under `<div class="def-h">Other proficiencies</div>`, after the Tools row. `renderRT()`
is unchanged. Its empty state ("Nothing yet — tap Edit.") shows.

## 5. Room for the chips (#120)

Today the Bio and Defences chips are hit by two `.chip` rules: `20-cards.css` ≈ 250 (12px, square
corners) and the later `30-sheet.css` ≈ 419 (10px, a pill, for features' effect chips), which wins.
The chip rows get their own rule, scoped to `.chips` so the effect chips don't move:
- a chip is about 28px tall, with more padding sideways, and its × has a hit area of at least
  32px (a transparent `::after`, as `.chip.ext-req` already does in `50-modal.css` ≈ 157);
- the gap is about 8px between chips, the same between wrapped rows, and about 12px between a row
  and the next heading;
- `.def-h` gets more space above it, so each heading and its rule start a clearly separate group.

The exact values are the builder's, checked by screenshot (§11) in both skins, light and dark,
at 390px and desktop. The Sheet's Defences card shares these rules and is shot too.

## 6. The Add window (#119, #123)

**Multi-select** (`chipChooserHTML()`, `openChipChooser()`): for `resists`, `immunes`,
`languages` and `tools`, a suggestion pill is a toggle (`aria-pressed`, `.on`), not an instant
add. One already on the sheet stays disabled with ✓. **Add** takes every pressed pill plus the
typed name, through `addChips(c, key, names)`, which skips duplicates case-blind and returns how
many it added. Its label counts: "Add", "Add 3". With nothing pressed and nothing typed it does
nothing. Senses keep today's one-at-a-time shape: a pill adds at once with the Range box's value.
Tools' pills are grouped by kind (Artisan's Tools, Gaming Sets, Musical Instruments, Other), each
group headed. The window's title says "Add resistances", "Add languages" and so on for the
multi-select keys.

**Spacing** (#123): `.chip-sug` and its groups get about 8px between pills, pills about 32px tall
with more padding, and about 14px of space before the "Or type one" field. On a phone every pill
is comfortably tappable, and the window scrolls when there are many (Tools has about 37).

## 7. Clean swaps (#131)

**Seeding through one helper** (`00-constants.js` or `50-classrace.js`): `seedField(c, field,
value, sid)` is called for **every** seedable field the source carries. It writes `c[field]=value`
**only when the field is empty**, which is today's rule, and records `{sid, field, value}`. When
the field is already full it writes nothing and records `{sid, field, value:null}` (decision 10a).
Either way it replaces that sid's earlier entry for the field. **A field with a `player` entry
counts as full**, whatever it holds, so a typed speed or a picked size is never overwritten
(decision 21). A value is stored as the source gives it, so a Humblewood species' numeric speed
stays a number, as `applyRace()` stores it today.
For `proficiencies` it appends the text and records the appended text (this field is never
"full": it always appends). The three seeds that exist move onto it:
- `applyRace()`'s `grantFrom()` (`52-race.js` ≈ 120–125): speed, size and `proficiencies`, under
  `race:<Name>` (a subrace's go under the same sid, as its languages do);
- `addClass()` (`56-class.js` ≈ 215): `spellAbility` under `class:<Name>`;
- `selectSubclass()` (`56-class.js` ≈ 436): `spellAbility` under `subclass:<Class>:<Sub>`.

**Reverting through one helper**, `unseedSource(c, sid, def)`, for each seedable field:
- **a `player` entry for the field:** the field is skipped entirely, the fallback included. It is
  the player's;
- **an entry with a value:** a scalar field that still equals it (`String()` on both sides) becomes
  `""`, and a value that differs is the player's and stays. For `proficiencies`, the recorded text
  is removed where it still appears verbatim, together with the newline that joined it, and the
  text is tidied as the lifts tidy it; edited text stays;
- **an entry with `null`:** nothing is touched (the source seeded nothing);
- **no entry at all for this sid and field**, which means a source applied before this change: the
  outgoing source's definition, `def`, if loaded, says what it would have seeded (`speed`,
  `sizeName(size)`, `spellcasting`, `proficiencies`). A value that equals exactly that is reverted,
  and anything else is kept (decision 11);
- the sid's entries are then deleted.

It is called from `removeRace()` (with the species and subrace definitions), `removeBackground()`
(no seeds today, but it costs nothing and #160 may add some), `removeClass()` (the class and each
`subclass:<Class>:*` sid), and `selectSubclass()` when it replaces an old subclass. **After every
one of them that can empty `spellAbility`** (`removeClass()` and `selectSubclass()`), one helper
(say `handOnSpellAbility(c)`) seeds an empty `spellAbility` from the first remaining class, or its
subclass, that casts, through `seedField()` under that one's sid (decision 12). The Spells tab's
select is repainted as `addClass()` repaints it now (`[data-path="character.spellAbility"]`).

**Setting a value as the player's**, through one helper (say `setPlayerField(c, field, value)`,
for `speed` and `size` only), used by the Speed window, the Size window and Settings → Carrying:
- **a value:** it is written to the field, and the field's `player` entry is written (replacing
  any). The sources' entries for the field stay, so their reverts still know what they seeded,
  but the `player` entry overrides them both ways (above);
- **cleared** ("From species" in either window): the `player` entry goes and the field is emptied.
  Size then reads the species' size live through `charSize()`, as it does today. Speed has no live
  fallback, so the current species' speed is seeded again from its loaded definition, through
  `seedField()` under its `race:` sid. With no species, a custom one or no definition loaded, Speed
  is 0 until the player types one.

**The Speed window** (decision 20). `openStatBreakdown("speed")` (`80-modal-forms.js` ≈ 254–290)
keeps everything it shows today, and gains a **Base speed** field at the top, the way the AC
window puts its switch and Flat box above its lines (`openACWindow()`, ≈ 323):
- a whole-number box in feet (`type="text" inputmode="numeric"`), holding the player's own speed
  when there is one, else empty with the species' speed as its placeholder ("30");
- a hint line under it: "From Elf: 30 ft. Type a number to set your own." when the base is a seed,
  "Your own. Clear it to use your species' speed." when it is the player's, and "No species speed.
  Type yours." when there is none;
- it **commits on change**, and on the window's dismissal, as the AC window's Flat box does
  (Escape doesn't blur the box, so the commit is made there too). A whole number 0–999 is taken
  (spaces stripped); blank clears (above); anything else is refused and the box shows its value
  again. Then `recompute()`, `scheduleSave()`, and the window's rows are redrawn in place;
- **read-only while Vitals is locked** (decision 22), with the hint "Unlock Vitals to change it";
- below it, the breakdown as today: the base line, now naming whose base it is ("Base 35 ft,
  yours" or "Base 30 ft, from Elf"), each `speed` effect, and the encumbrance row last;
- the window's title becomes "Speed" (it is no longer only a breakdown). The other badges'
  windows are unchanged;
- the logic is in pure functions the tests can call without a sheet: the box's parse (say
  `parseBaseSpeed(raw)` → a number, `""` for blank, or `null` for refused) and the base's source
  (say `speedBase(c)` → `{value, by}` with `by` `"player"`, a `race:` sid, or `""`).

The Speed badge's own mark is unchanged: it marks effects and encumbrance, as now. The base's
source is named in the window.

**A swap** is remove-then-apply, as now: `applyRace()` calls `removeRace(false)` first, the revert
empties the unchanged fields, and the new species seeds them. A size the player picked or a speed
they typed survives: its `player` entry makes the revert skip it and the new seed count it as full.
On a sheet from before this change, a size the player picked survives too, because it no longer
matches the old species' value, so the new species' seed (empty-only) leaves it alone.

**The legacy strings:** `removeRace()` clears `character.ancestry` when it equals the removed
name, and `removeBackground()` clears `character.background` likewise. `printSheet()` reads them as
fallbacks (`71-char-io.js` ≈ 217–218), so a removed species stops printing.

**Size "set by hand"** (`recompute()`, `10-compute.js` ≈ 46): marked only when `character.size` is
set and isn't a source's: a `player` entry for size exists, or the value matches neither a `size`
entry's value nor `raceDefSize()` (a sheet from before this change). `openSizePicker()`'s Save and
Settings → Carrying's size select (`88-settings.js` ≈ 231) write through `setPlayerField()`, with
"From ancestry" as the clear. `sizeOptionsHTML()` is unchanged.

**The dead speed query.** `applyRace()`'s `[data-path="character.speed"]` repaint (`52-race.js` ≈
134) finds nothing, since no element has that path. It goes; the Speed window reads the field when
it opens.

## 8. Shared files and merge order

- **Skin & settings saves (#133, #141)** adds one new function to `41-chips.js`, a default-language
  swap beside `ensureDefaultLanguages()`, and changes none of the existing ones. This branch leaves
  `ensureDefaultLanguages()` alone and **merges first**; Skin rebases.
- **ASI (#172, #171)** edits `addClass()` in `56-class.js` for the ASI path. This branch edits only
  its spellcasting seed line and `removeClass()`. Whichever merges second rebases. The hunks
  shouldn't overlap.
- **Wave 3:** #160 (Humblewood backgrounds) rebases over `applyBackground()`'s one-line `grantTools()`
  call, and #137 (class training) may add a `class` source to `CHIP_SRC` and grant tool chips from
  `addClass()`.
- `90-boot.js`: one line in the chip delegate (`data-chipask`).
- `80-modal-forms.js`: the Speed window is a new branch of `openStatBreakdown()` and a change to
  `openSizePicker()`'s Save. Armour & attack numbers (wave 1, merged) owns `openACWindow()` beside
  them; nothing in wave 2 edits these functions.
- `88-settings.js`: one line, the size select's handler (≈ 231). Skin & settings saves edits other
  handlers in the same `openSettings()` wiring (#141's `saveSettings()` callers); Bio chips merges
  first.

## 9. What doesn't change

Languages, senses and defences keep their data and their grants. Student of War's tool still
lands as a feature. `liftLanguages()` and `langLifted` are untouched. Equipment, gold and skill
grants are untouched.

## 10. Tests

**A new block at the end of `src/tests/sheet.js`**, "1.9.1 Bio chips: #121, #120, #119, #123,
#131" (the roadmap's rule for that file), checking what the screen holds through the recorder
pattern of the #153/#154 block (≈ 9989):
- `toolParse()` on every wording in §4's table (result and placeholder name), on junk
  (non-string, empty, only separators) and on a "two … of your choice" count;
- `toolSuggestions()`: with a 2024-shaped `rules.items` (a `Gaming Set` and a `Tool` item) the
  pack's names are used and filed under Gaming Sets and Other, with no case-blind duplicate of
  the built-in list; with an SRD-shaped one, the built-in gaming sets and kits are there;
- `chipClean()` for `tools`: `src` kept, an unknown `src` cleared, a placeholder's `ask` kept, a
  non-string `ask` dropped, two placeholders both kept, named duplicates dropped;
- `applyBackground()` for a fixed tool (Criminal): a chip "· background" on `#bioTools` at once, no
  "Tools:" line in Proficiencies; removing it takes the chip away; a swap shows only the new one;
- a choice (Soldier): a placeholder and a queued `tool` step; `commitExtraChoices()` with a pick
  names the placeholder (its `src` kept, `ask` gone); with no pick it stays; removing the
  background removes it, named or not;
- `liftTools()`: fixed names become the player's chips, a choice becomes the player's
  placeholder, the rest of the text stays, it runs once (`toolsLifted`), a later "Tools:" line
  stays text, `blankChar()` doesn't set the flag, `newCharacter()` does, and `migrate()` stays
  idempotent;
- `addChips()`: several at once, case-blind duplicates skipped, the count returned;
  `chipChooserHTML()` gives toggles for the four multi-select keys and today's instant pills for
  senses;
- #131: seeding writes an entry; removing the species reverts unchanged speed and size, keeps a
  size the player picked, and a swap then keeps that size; a record-less sheet (no entry for the
  sid and field) reverts a value equal to the loaded definition's and keeps a different one, or
  any value when no definition is loaded; the species' `proficiencies` text leaves with it unless
  edited; `ancestry` and `background` clear; Size isn't marked when the species set it and is
  marked when the player picked another;
- the two `null`-entry cases (decision 10a): **a Wizard added over an INT `spellAbility` the
  player set, then removed, leaves INT**; **a Tiefling, then the player picks Small, then a swap to
  Gnome, then Gnome removed, leaves Small**;
- spellcasting hand-on (decision 12): `spellAbility` reverts with its class and passes to the
  next caster; **a Fighter/Wizard whose Eldritch Knight seeded INT, with that subclass replaced
  through `selectSubclass()`, gets the Wizard's INT under `class:Wizard`**; with no caster left it
  stays empty;
- a Humblewood-shaped species (`speed: 30`, a number, and no `size`): the seed stores `30`, the
  entry survives `seedsOf()`, and removing the species reverts it; an SRD-shaped one (`"30 ft"`)
  does the same;
- the Base speed (decision 20, 21): `parseBaseSpeed()` takes "35", " 40 " and "0", gives `""`
  for blank, and refuses "-5", "3.5", "30 ft", "abc" and "1000"; `setPlayerField()` writes the
  speed and a `player` entry; **a typed speed survives a species swap and a species remove**, and
  a later species' seed records `null` over it; **a typed speed that equals the old species' own
  speed survives too** (the case that rules out deleting entries); clearing it re-seeds the current
  species' speed under its `race:` sid, and leaves `""` with a custom species or none; a custom
  ancestry's typed speed shows in `recompute()`'s Speed with effects added; `speedBase()` names
  `player`, the `race:` sid, or nothing; a typed value is refused while Vitals is locked;
- Size through `setPlayerField()`: a picked size writes a `player` entry and survives a swap even
  when it equals the old species' size; "From ancestry" clears it; the Size mark follows the rule
  in §7 on a new sheet and on one from before this change;
- `seeds` defaults to `[]`, junk entries are ignored by `seedsOf()` (a bad `field`, an object
  `value`, a missing `sid`) while string, number and `null` values and the `player` sid are kept,
  and an unknown field survives a round trip.
- **Existing test to update:** `sheet.js` ≈ 4573–4585 builds a sheet whose Proficiencies holds
  `Tools: Thieves' tools` and asserts that `migrate()` leaves it as
  `'Light armor.\nTools: Thieves\' tools'`. With `liftTools()` the expected text is `'Light armor.'`,
  with a player chip "Thieves' tools". Change it in place: it is #103's check of what the lift
  leaves, and nothing else edits those lines.

**`src/tests/char-update.js`:** the choice-window flow with a `tool` step: queued with its
window, one window at a time, counted in Picks left at Done, and left out of the dismiss guard
(a window with only a tool step has no guard; with a skill step beside it the guard speaks of the
skill only). No existing expectation there changes: none of its windows has a tool step.
**`src/tests/rules-data.js`** ≈ 1282: the template-order check gains `#bioTools` and the "Other
proficiencies" heading. A source check that `applyRace()` no longer queries
`[data-path="character.speed"]`, and that the Size window and Settings → Carrying write size
through `setPlayerField()`.
A throwaway Node check in the scratchpad for `toolParse()`, `unseedSource()` and
`parseBaseSpeed()`, per CLAUDE.md.

## 11. Screenshots

To `.claude/qa/in-progress/121-bio-chips/`, via the project's Playwright MCP (`.mcp.json`):
- the Bio tab (`story`) before and after, both skins, light and dark, at 390px and desktop, on a
  sheet with languages, senses, tools and Proficiencies text;
- the Sheet tab's Defences card before and after (it shares the chip rules);
- the Add window before and after: resistances with three pills pressed and the "Add 3" button,
  and tools grouped by kind, at 390px;
- Add background → Soldier (SRD), the tool step, then the named chip, and the placeholder after a
  skipped pick with its namer open;
- a species swap with a picked size, Size unmarked before the pick and marked after;
- the Speed window: before (today's breakdown) and after, in both skins, light and dark, at 390px
  and desktop; with a species' speed, with a typed one, with a custom ancestry and none, and with
  Vitals locked;
- a custom ancestry's Speed badge after a speed is typed.

Driven: the adds, picks, swaps and removes above, and typing, clearing and refusing a Base speed. Not driven: a real phone, touch, print, and
Mike's own characters (his pass).

## 12. Docs and notes

- **Wiki:** [Story & notes](../wiki/features/story-and-notes.md) (the card's rows and the
  heading), [Grants & provenance](../wiki/architecture/grants-and-provenance.md) (a Tools row and
  a Seeds row in the grant table, and the Open list loses what this fixes),
  [Character model](../wiki/architecture/character-model.md) (`tools`, `seeds`, `toolsLifted`,
  the `migrateSheet103()` step), [Character building](../wiki/features/character-building.md) (the
  tool step in `runExtraChoices()`), [Vitals & rest](../wiki/features/vitals-and-rest.md) (the Speed
  window and its Base speed box in "The badges", the Size mark, a Decisions row "Speed on tap" beside
  "Size on tap", and the Open line "There is no box to type a base Speed…" removed),
  [Known issues](../wiki/roadmap/known-issues.md) (remove #131's item, #146's Size item, and the
  "Nothing binds `character.speed`, so base speed only ever comes from the ancestry" sentence),
  [Decisions](../wiki/decisions.md) (rows 1, 9, 10, 11, 20, 21), and
  [Sections & layout](../wiki/ui/sections-and-layout.md) if it describes chip styling. One ledger
  entry, with History lines citing it.
- **`docs/rules-schema.md`** (player-facing, ships): a background's `tools` and `languages` become
  chips, and a tool choice is asked for when the background is added. It currently says "added as
  proficiency notes" (≈ 467), which has been wrong for languages since #103. The species example's
  `"proficiencies": "Thieves' Tools"` (≈ 291) changes to a non-tool line such as `"Light armor"`,
  described as display text shown under Other proficiencies and removed with the species, so the
  example doesn't suggest a species grants tool chips (decision 13).
- **`UNRELEASED.md`**, worded for players (drafts):
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
- **[Smoke list](../qa/smoke.md):** Mike's file (#150). The branch proposes one line for him to
  approve: "a background's tools are chips on Bio and leave with it; a tool choice is asked when
  it's added".

## 13. Out of scope

- Armor and weapon chips, and class tool training (#137, wave 3).
- Feats that grant tool choices (Crafter, Musician, Skilled): they stay feature text; a later
  issue can queue them through the same `tool` step.
- Wind-Touched's "Auran (you can speak as well as understand it)" language parse: #160.
- Recovering the background behind tools lifted from text (decision 5).

## 14. Open: left to the builder

The exact chip and pill sizes within §5 and §6, the placeholder's look (dashed, as `.chip-add`
is, or another clear "unfinished" style), the helpers' names and which fragment holds
`seedField()`, `unseedSource()` and `setPlayerField()` (anywhere above their first caller in
concatenation order), how a tool step carries its placeholder ids (a `data-` attribute on the
block, or the pending entry), the wording of the namer's duplicate refusal, and the Speed window's
markup and hint wording within §7.
