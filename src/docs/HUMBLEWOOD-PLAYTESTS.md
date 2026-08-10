# Humblewood playtest packets — extraction map

Dev-facing. Lives under `src/`, so `build.sh`'s allowlist check keeps it out of the player zip.

## 1. Purpose and scope

Hit Point Press has released a Humblewood playtest packet most months since January 2024. Between
them they add far more player content than we currently hold, and they **revise each other** — one
class was renamed and rebuilt, one race is split across two packets, and several lineages attach to
core species we already ship. Planning that extraction one PDF at a time doesn't work, because the
supersessions are only visible when packets are compared.

This document is the map: per packet, what it adds, **what state our copy of it is in**, and what
supersedes what.

**Player options only.** Locations, monsters, stat blocks, magic items and adventures are out of
scope — the app has no schema for them. Packets whose content is entirely of that kind are still
listed, marked *no player options*, so nobody re-reads them looking for something to extract.

Everything below was generated from the PDFs with the extractor's own `doc_stream()` (column-aware
reading order) rather than transcribed by hand, so trait and feature names match the sources exactly.

## 2. Source inventory

**27 PDF files → 23 unique documents.** Four pairs are byte-identical in text; keep either twin:

| Duplicate pair |
|---|
| `HW2_Playtest_April2024.pdf` / `…-1.pdf` |
| `HWP_Playtest_August2024.pdf` / `…-1.pdf` |
| `HWP_Playtest_Mar2025.pdf` / `…-1.pdf` |
| `HWP_Playtest_November2024.pdf` / `…-1.pdf` |

Font styling is structural and matches the condensed core doc, so `styled_spans()` and `classify()`
in [scripts/extract-humblewood.py](../../scripts/extract-humblewood.py) carry over unchanged:

| Style | Meaning |
|---|---|
| `P22Aragon` 36 | entity name (`New Race: Talpo`) |
| `AGaramondPro-Bold` 14 | section heading (`TALPO TRAITS`) |
| `AGaramondPro-Regular` 14 | subsection, and subclass feature names |
| `AGaramondPro-BoldItalic` 10 | run-in trait name (`Glide.`) |
| `P22Aragon` 10, `Montserrat` | running footer — already classified as `footer` |

**Two exceptions that will break a naive run:**

- **Jan 2025 (Pexian)** sets trait names in **plain bold**, not bold-italic, so they classify as
  `label` and never appear as traits. Its trait list has to be read from the bold spans directly.
- **Humblewood Spells Vol 2** is a Times New Roman document from an entirely different template
  (probably a word processor, not InDesign). It shares no styling with any other packet and needs
  its own parser.

Front matter is boilerplate in every packet — cover, credits, a Patreon advert, and (in 2025+) a
recurring Skarthrax teaser page carrying `lair actionS` / `regional effectS` headings. Content
starts on page 4 or 5.

## 3. Coverage — DONE

Extraction is complete except where noted in §7. Run it with:

```
.venv/bin/python scripts/extract-humblewood.py --playtests        # preview, writes nothing
.venv/bin/python scripts/extract-humblewood.py --write-playtests  # fold into data/humblewood/
.venv/bin/python scripts/extract-humblewood.py --write            # rebuild tables.json
```

| Category | before | now |
|---|---|---|
| Races | 16 | **26** |
| Lineages | 21 | **35** |
| Backgrounds | 3 | **10** |
| Subclasses | 5 (+2 Gadgeteer paths) | **11** (+2) |
| Feats | 10 | 10 |
| Spells | 44 | 44 |
| Tables | 19 | **35** |

**Prose is now verbatim: 450 of 472 fields** across every Humblewood file, up from 27/172 on the
playtest content. The 22 that are not are all accounted for — see §7. `--playtests` self-checks the
extraction at **350/350** against the packets before anything is written.

The extractor verifies what it is told to expect rather than trusting the layout: each race spec
declares its trait count (or, where a count cannot disambiguate, the trait names), each subclass
declares its feature list, and each table must come back the right length **and** numbered 1..n
**and** free of text bled in from the neighbouring column. Anything that fails is reported and left
out rather than written.

## 4. Per-packet detail, newest first

### 2026-02 — `HWP_Playtest_February2026_Rev-1.pdf` (7 pp)

- **Race: Talpo** (p5–6) Moles. Traits: Ability Score Increases, Speed, Age, Size,
  Born To Dig, Claws, Darkvision, Efficient Breathers, Languages.
  Lineages: **Dirtsnout** (Deep Detection, Strong Hands); **Starsnout** (Empath, Sensitive Nose).
- **Fighter Archetype: Workhand** (p7) Features: Bonus Proficiencies, Improved Tools,
  Craftsman's Shield, Ready For Anything, Strong Arms Light Work, The Flurry of Creation.

### 2026-01 — `HW3_Skarthrax_30.01.2026.pdf` (9 pp)

*No player options.* Monster, lair actions, regional effects and two magic items.

### 2025-12 — `HWP_Playtest_Decemberr2025.pdf` (6 pp)

*(filename typo is the publisher's)*

- **Lineage: Marshfoot Gallus** (p5–6) **Attaches to the core Gallus**, which we already
  hold with Bright and Huden. The packet reprints the whole shared trait block (Ability Score
  Increases, Speed, Age, Size, Glide, Wing Flap, Communal, Militia Training, Of the People,
  Languages, Lineage Options); only **Marshfoot** (Waterborne, Self Sufficient, Skilled Diver) is
  new. Merge into the existing race — do not create a new one.
- **Bard: College of Courtly Jests** (p6) Features: With The In Crowd, Subtle Jabs,
  Cut To The Quick, Deadly Jest.

### 2025-10 — `HWP_Playtest_October2025_v1.pdf` (9 pp)

- **Race: Vesper** (p5–6) Bats. Traits: Ability Score Increases, Speed, Age, Size,
  Bat Climb, Echolocation, Nightblessed, Hypersonic Squeak, Languages. No lineages.
- **Background: Ambassador** (p8) Feature: Diplomatic Privilege, plus the full four-table
  characteristic set (they are printed on p9).
- Flowstone (location) — out of scope.

### 2025-09 — `HWP_Playtest_September2025.pdf` (7 pp)

- **Race: Rhopala** (p5–6) Butterflies/moths. Traits: Ability Score Increases, Speed,
  Age, Size, Evolving Form, Extra Limbs, Silkweaver's Knack, Languages, Lineage Options.
  Lineages: **Boldwing** (Dazzling Display, Evasive Maneuvers); **Dustwing** (Camouflage,
  Light Bearer).
- **Warlock Patron: The Whispering Wind** (p6–7) Features: Expanded Spell List (with an
  expanded-spells table), Voice of the Wind, Nature's Force, plus 10th- and 14th-level features.
  Voice of the Wind offers four visions: A Vision of Courage, A Vision of Terror, A Vision of
  Flight, A Vision of Warriors.

### 2025-08 — `HWP_Playtest_August2025-1.pdf` (8 pp)

- **Race: Roden** (p4–5) Rats. Traits: Ability Score Increases, Speed, Age, Size, Bite,
  Iron Stomachs, Never Lost, Sensitive Whiskers, Languages.
- **Background: Underscout** (p7) Feature: Deep Delver.
- Lurker's Landing (location) — out of scope.

### 2025-07 — `HWP_Playtest_July2025_.pdf` (5 pp)

- **Race: Porchini** (p4–5) Traits: Ability Score Increases, Speed, Age, Size,
  Keen Snout, Never Cornered, Resilience, Tusks, Languages.
- **Rogue Archetype: Burrowskulker** (p5) Features: Narrow Maneuvers, Wallcrawler,
  Quick Nick, Natural Camouflage, Living Hazard.

### 2025-06 — `HWP_Playtest_June2025.pdf` (9 pp)

- **Race: Almare** (p5–6) Traits: Ability Score Increases, Speed, Age, Size, Glide,
  Seafeathers, Wing Flap, Languages, Lineage Options.
  Lineages: **Shieldwing** (Greater Glide, Imposing Wingspan, Sea**s**wise Endurance);
  **Swordwing** (Brash Opportunist, Seawise Agility, Sky Dive).
  Note the source's own inconsistency: *Seaswise* Endurance vs *Seawise* Agility. Transcribe as
  printed.
- **Background: Courtier** (p8) Feature: Courtly Manners.
- Castle Argest (location) — out of scope.

### 2025-05 — `HWP_Playtest_May2025.pdf` (9 pp)

- **Race: Greno** (p5–6)
  Frogs. Traits: Ability Score Increases, Alignment, Speed, Age, Size, Amphibious, Bombastic Croak,
  Jumper, Languages, Lineage Options.
  Lineages: **Venim** (Poison Skin (3/Day), Warning Colors); **Veret** (Sticky Feet, Sensitive Skin);
  **Verru** (Unslowed Toad, Warty Skin).
- The Gasping Marshes + Boggler, Lampredator, Mirebones — out of scope.

### 2025-04 — `HWP_Playtest_April2025.pdf` (9 pp)

- **Race: Arkton** (p5–6) Bears. Traits: Ability Score Increase, Creature Type, Age,
  Size, Speed, Guardian's Roar, Bear Snug, Darkvision, Heavy Claws, Languages.
- Castleshield Caves + Stonebunter Swarm, Stonebunter Brood Mother, Fellfisher — out of scope.

### 2025-03 — `HWP_Playtest_Mar2025.pdf` (7 pp)

- **Race: Lunin** (p5–6) Dogs. Traits: Ability Score Increases, Alignment, Age, Size,
  Acute Nose, Bite, Pack Position, Pedigree, Languages. Carries a **Lunin Pedigree** table that the
  Pedigree trait depends on — extract the table with the race, not separately.
- **Barbarian: Path of the Corsair** (p7) Features: Steady Rage, Sea Legs,
  Captain's Orders, Inspiring Commander, Sailor's Knacks.

### 2025-02 — `HWP_Playtest_Feb2025.pdf` (9 pp)

- **Lineage: Webpaw Mustel** (p5–6) **Extends the Mustel race from Sep 2024**, and
  reprints the shared `MUSTEL TRAITS` block (Ability Score Increases, Age, Bite, Relentless,
  Languages, Lineage Options). New: **Webpaw** (Alignment, Size, Speed, Hold Breath, Playful Paws,
  Slick Fur, Waterdancer, Water Wise). Extract with Sep 2024 as one race with three lineages.
- **Background: Seaborn** (p8–9) Feature: Ship Shape. Full d8 Personality Trait / Ideal
  / Bond / Flaw set confirmed present.
- Patternraft (location) — out of scope.

### 2025-01 — `HWP_Playtest_Jan2025.pdf` (9 pp)

- **Race: Pexian** (p4–6) Axolotls. **Trait names are plain bold here** (see §2).
  Shared traits: Ability Score Increases, Alignment, Speed, Age, Size, Amphibious, Regeneration,
  Origin, Languages.
  Lineages: **Cave Pexians** (Soft Body, Tail and Feet, Swamp Pexian Transformation);
  **Swamp Pexians** (Big Jaws, Swamp Camouflage, Tail Slap, Wet and Dry, Cave Pexian
  Transformation).
  Unusual mechanic: the two forms **transform into one another**, and all pexians begin as cave
  pexians. This is not an ordinary either/or lineage choice — check how it should map onto our
  lineage chooser before extracting.
- The Pearl Caves + Weeping Carp, Drownweed, Nightsnare — out of scope.

### 2024-12 — `HWP_Playtest_December2024-1.pdf` (12 pp)

*No player options.* The *Northern Voyage* adventure, three stat blocks and a magic item.

### 2024-11 — `HWP_Playtest_November2024.pdf` (12 pp)

**"The Gadgeteer Class 2.1"** — the packet that supersedes March 2024. See §5.

- **Class: Gadgeteer** (p5–9)
  Carries the **Gadgeteer Table** (class progression). Features: Hit Points, Proficiencies,
  Equipment, Gadgeteering, Frames, Components, Always Prepared, Gadgeteer Path, Ability Score
  Improvement, Signature Frame, Hot Swap, Tools and Talent, See How It Ticks, Sufficiently Advanced
  Technologies, Sacrificial Scrapping, Magic Item Hacking.
  **Frames**: Autonomous (Remote Control, Mobile, Defenses, Size, Basic Function, Melee, Ranged,
  Utility), Handheld (Two-Handed + the same function set), Wearable (Bulky, Reinforced, Worn + the
  same function set).
  **Components**: Armored, Auto-Cover, Auto-Shielding, Communications Relay, Enhanced Weapon,
  Elemental Damage, Flight, Grabber, Heavy-Duty, Lightweight, Quick Draw, Quick Shield, Multitool,
  Elemental Battery, Sentient.
- **Gadgeteer Paths** (p10–12).
  **Engineer**: L3 Crafty Components, L3 Safety Equipment, L6 Quick Study, L9 Mechanical
  Specialization, L13 Upcycling, L17 Make More With Less.
  **Fizzar**: L3 Arcane Components, L3 Elemental Expertise, L6 Transferable Skills, L9 Arcane
  Specialization, L13 Arcane Drain, L17 Elemental Overload.
- p3 **reprints Seeta** (names and full trait list) as a recap. Not new content.

### 2024-09 — `HWP_Playtest_September2024.pdf` (9 pp)

- **Race: Mustel** (p4–6) Shared traits: Ability Score Increases, Age, Alignment, Bite,
  Scenting. Lineages: **Brightfang** (Size, Speed, Bigger Bite, Scrappy, Strong Claws);
  **Longdance** (Size, Speed, Fleet Feet, Shifting Camouflage, Slippery Dancer).
  Feb 2025 adds a third lineage — extract both packets together.
- **Backgrounds** (p6–9), all with the full four-table characteristic set:
  **Stonesinger** (Feature: Stonewise), **Warrenborn** (Background Feature: Warrenborn),
  **Wonderstruck** (Feature: Reverberations; also an Amaranthine Experiences subsection).

### 2024-08 — `HWP_Playtest_August2024.pdf` (8 pp)

- **Monk: Way of the Wrangler** (p7) Features: Friend of Beasts, Monster Guider,
  Monster Rider, Leader of the Herd, Lasso Master.
- **Spell: Spectral Stampede** (p8) Also printed in Jul 2024; one spell, not two.
- Firnveldt (location) + Gargath, Sweetbee — out of scope.

### 2024-07 — `HW2_Playtest_July2024.pdf` (8 pp)

- **Race: Capran** (p4–5) Goats. Traits: Ability Score Increase, Creature
  Type, Size, Speed, Age, Hard Headed, Stubborn Mind, Languages, Ancestry Options.
  Lineages: **Yantan** (Alignment, Legacy of Learning, Sure Footing); **Tethera** (Alignment,
  Friendly Face, Flock Together).
- **Lineage: Arma Hedge** (p6–7) Attaches to the core Hedge; the packet
  reprints the shared Hedge traits. New: Size, Armor Plates, Earthblessed, Plate Wall, Speech of
  Stone and Soil.
- **Spells** (p8) — Arboreal Eruption, Cymatic Sight, Divert Power,
  Kren's Kindness, Spectral Stampede.

### 2024-04 — `HW2_Playtest_April2024.pdf` (8 pp)

- **Race: Sylph** (p4–5) Traits: Ability Score Increase, Creature Type, Age,
  Alignment, Size, Speed, Determined, Diminutive, Healing Stillness, Hover, Wing Flap, Moving
  Target, Quick Reflexes, Languages. No lineages.
- **Race: Tilia** (p5–6) Traits: Ability Score Increase, Creature Type,
  Size, Speed, Sticky Grip, Sticky Tongue, Purifying Skin, Languages, Ancestry Options.
  Lineages: **Treescale** (Forest Cunning, Poison Skin); **Sandscale** (Desert Lore, Heat Tolerance,
  Sand Swimmer).
- **Lineage: Rockburrow Jerbeen** (p7–8) Attaches to the core Jerbeen; shared
  Jerbeen traits reprinted. New: Ability Score Increase, Size, Cheek Pouches, Fluff Up, Thick Fur.

### 2024-03 — `HW2_Playtest_March2024.pdf` (17 pp)

**Superseded in full by Nov 2024 — do not extract.** See §5.

"First Look at The FiZZar Class": a standalone Fizzar class with a bespoke technology system
(technology tiers, prototypes, schematics, workbook, Fizzcraft Kit, upkeep and maintenance,
technological mishaps), one specialization (**Scroungecrafter**: Built Sturdy, Makeshift Tools,
Resourceful, Salvage Expert, Automation), and a Fizzar Technology List. None of it survives into the
Gadgeteer.

### 2024-02 — `HW2_Playtest_February2024.pdf` (9 pp)

- **Sorcerer: Deep Roots** (p8) Features: L1 In Tune with the Land, L1
  Grounded Magic, L1 Natural Battery, L6 Land's Harmony, L14 Home Turf, L18 Charged Up. Carries two
  tables (sorcerer marks, and its spell list) that we do not hold.
- **Feats** (p9) — Arboreal Acrobat, Moonlit, Sun Touched.
- The Tanglewilds (location) + Golden Suneater, Luhz Kehsh Warrior, Tythran — out of scope.

### 2024-01 — `HW2_Playtest_January2024.pdf` (6 pp)

- **Race: Eluran** (p3–5) Cats. Traits: Ability Score Increase, Creature
  Type, Age, Alignment, Size, Speed, Darkvision, Claws, Graceful Landing, Wariness, Languages,
  Ancestry Options. Lineages: **Moon Eluran** (Soothing Purr, Paws of the Artist); **Sun Eluran**
  (Thunderous Roar, Hunter's Weapon Training).
- **Race: Seeta** (p5–6) Traits: Ability Score Increase, Creature Type, Age,
  Alignment, Size, Speed, Glide, Wing Flap, Strong Beak, Striking Plumage, The Knack, Mimicry,
  Languages. No lineages.

### undated — `Humblewood Spells Vol 2.pdf` (21 pp)

- **29 spells** — all present by name. Indexed by class across Bard, Cleric,
  Druid, Paladin, Ranger, Sorcerer, Warlock and Wizard lists; descriptions follow from p5.
- Two source defects to expect: the index prints **"Etheral Claws"** (we hold *Ethereal Claws*) and
  **"Hearth"** for *Hearth & Home*. Neither is a missing spell.
- Different template — see §2.

## 5. Supersessions, reprints and overlaps

**Fizzar → Gadgeteer (the big one).** March 2024 shipped **Fizzar** as a standalone class. November
2024 reissued it as **"The Gadgeteer Class 2.1"**, with Fizzar demoted to one of two Gadgeteer
Paths. Word counts across the Nov 2024 text: **Fizzar 7, Engineer 2, Scroungecrafter 0.** The whole
March technology system is replaced by Frames and Components, and **Scroungecrafter is dropped
outright** — it exists in no later packet. Our `classes.json` already follows Nov 2024. **March 2024
must be excluded from extraction**; taking it verbatim would add a dead class and an obsolete
subsystem.

**Mustel is one race across two packets.** Sep 2024 gives Brightfang and Longdance; Feb 2025 adds
Webpaw and reprints the shared trait block. Extract as a single race with three lineages, not two
races.

**Three lineages attach to core species we already ship.** Marshfoot Gallus (Dec 2025) → Gallus;
Arma Hedge (Jul 2024) → Hedge; Rockburrow Jerbeen (Apr 2024) → Jerbeen. Each packet reprints the
core species' shared traits alongside the new lineage. Merge into the existing race entry; don't
create a new race, and don't let the reprinted traits overwrite the verbatim core ones.

**Nov 2024 p3 reprints Seeta** — names and the full trait list, as a recap of Jan 2024. Not new.

**Spectral Stampede is printed twice** — Jul 2024 and Aug 2024. One spell.

**Almare's lineage traits disagree with each other in the source**: *Seaswise* Endurance vs
*Seawise* Agility. Transcribe as printed rather than normalising.

## 6. What was wrong before, and is now fixed

Kept because it is the reason the extraction was done, and because the measurement traps below cost
real time.

The playtest data carried the **same paraphrase defect the core prose did**, and by a wider margin:
**27 of 172 prose fields verbatim (16%)**. Worst were the Gadgeteer at 1/27, Engineer and Fizzar at
0/7 each, and every one of the 44 spells at 0/44.

**The spells were not merely reworded, they were summarised.** Measured old text against the
verbatim text that replaced it, across the 34 spells with a source: the paraphrases ran to a
**median 72% of the real length**, worst 44% — Cymatic Sight 295 characters against 667, Mind Marble
873 against 1800, Enthrall Plant 738 against 1468. Rekindle's three source sentences were compressed
into one; Mind Marble's "This spell can be used in one of two ways, chosen when you cast the spell"
became "Choose one use when you cast it". Two went the other way and had text *added* (Haunting Echo
619 against 418, Divert Power 717 against 558). Either way it is rules text rewritten, with real
scope for altered meaning — the same class of loss that cost College of the Road its level 14 row.

*(An earlier note here put the median at 59% and Entomb at 372 characters against 1208. That
comparison was against a crude slice of the PDF that included each spell's stat block and ran into
the next spell's heading; Entomb's actual body is 460 characters. The figures above compare old text
to the extracted text and are the ones to trust. The 0/44 verbatim finding was never in doubt.)*

**Ten descriptions carried an invented `(Humblewood 2 Playtest.)` attribution** that appears in no
source. All are gone: nine were replaced outright, and the tenth (the Arma Hedge lineage, which the
packet gives no flavour text of its own) is stripped explicitly by the writer.

### Three traps when re-measuring this

Each produced a wrong "clean" result during this work:

1. **Spells store prose in `text`; everything else uses `description`.** Walking only `description`
   silently skips all 44 spells and reports success.
2. **`levels` is `{"1": {"traits": [...]}}`** — a dict of dicts, not a list. A walker that assumes a
   list skips every class and subclass feature, which hid 88 of the 172 fields and made the defect
   look half its real size (the first figure reported was "25/84").
3. **A table can be the right size and still be the wrong pixels.** Two characteristic tables came
   back with exactly six rows numbered 1–6 and were still wrong, having absorbed words from the
   column beside them ("...rural bumpkin, d10 Experience so I judge"). Row counts do not catch this;
   reading the cells does.

Use a shape-agnostic recursive walker that collects every `description`/`text` string in the subtree.

## 7. What is still outstanding

**22 prose fields of 472 are not verbatim, and every one is accounted for:**

- **10 spells have no available source** — Ambush Prey, Elevated Sight, Feathered Reach, Globe of
  Twilight, Gust Barrier, Invoke the Amaranthine, Shape Plants, Spiny Shield, Stellar Bodies, Veil
  of Dusk. They are Humblewood Vol 1 content; the condensed Player Character Options doc names some
  of them in domain spell lists but prints no descriptions, and we hold no other PDF that does.
  Their text is left exactly as it was. **Getting these needs a source we do not have.**
- **2 Gadgeteer "Component Tier Upgrade" entries** (levels 7 and 14) come from the class progression
  table, not from any prose block. Our own wording, correctly.
- **6 core-book fields** are the pre-existing expected exceptions the core suite already tracks
  (Raptor ×2, Hedge ×2, Mapach, Night Domain).
- **4 remaining** are core-book prose covered by that same suite.

**12 characteristic tables from the Sep 2024 packet are not taken.** Stonesinger, Warrenborn and
Wonderstruck share pages in a layout the table reader does not yet handle — tables stacked *and*
side by side, with headings interleaving once the columns are flattened. 6 of their 12 came back
malformed, so all 12 are dropped: the builder ships a background's four tables or none, because a
background showing a Flaw table and no Ideal table reads as "the book has no Ideals". The other four
backgrounds' 16 tables are extracted and verified.

Also not extracted, and lower value: the Gadgeteer class progression table, Lunin Pedigree, the
Whispering Wind expanded-spells table and Deep Roots' two tables. The features that reference them
carry their full text, so nothing is unusable without them.

**March 2024 is excluded deliberately**, per §5 — it is superseded in full by Nov 2024.
