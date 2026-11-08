# Skin is look only, and every settings save says so — design

**Status:** draft 2026-11-07, design calls settled; awaiting Mike's approval of the document · wave 2 of [1.9.1](../wiki/roadmap/1.9.1.md), the Skin & settings saves worktree
**Issues:** #133 (changing the skin silently changes the character's system) → #141 (a refused
settings save is not reported). One branch, built in that order: #141 then touches the skin
handlers that #133 rewrites.
Read [Theming & icons](../wiki/ui/theming-and-icons.md) ("Skins follow the system"),
[Storage](../wiki/architecture/storage.md) (settings, and constraint 2),
[Settings & updates](../wiki/features/settings-and-updates.md) and
[Home & characters](../wiki/features/home-and-characters.md) first.

Line numbers below are at e07a136.

---

## 1. What it is

**#133.** Skin becomes a look and nothing else. Today the Skin control in Settings rewrites the open
character's `system` without a word. That changes its coin set, the ancestries it is offered and the
header's wording, and it leaves the old ruleset's default language chips behind. Opening, making or
importing a character also flips the skin to match that character's system. After this change:

- **Skin** changes colours, lettering and frames, for the whole app, and stays as chosen whichever
  character is open.
- A character's **game system** is its own. It is set when the character is made, and it can be
  changed later from a new **Game system** row on the character's Settings page. That row says what
  will change and asks first.
- What reads like the game rather than the look follows the **character's system**, not the skin:
  "Race" or "Ancestry" (with "+ Race" / "+ Ancestry" on the sheet header and the picker's example
  name), the top bar's wordmark and the page title.
- The New character dialog's hint says what the system really does.

**#141.** Every place that saves settings reports a save that didn't land. `saveSettings()` already
returns why a write was refused, but its result is thrown away by **15 bare `saveSettings();` calls**
at e07a136. Three of them go with #133. A player whose storage is full changes a setting, sees it
take effect, and finds it gone at the next launch with no warning. That breaks constraint 2 (storage
failures are loud).

Why now: #133 is a silent rewrite of character data from a control that says it is about looks, and
#141 is a standing break of a non-negotiable. Both live in the same one-line `#segSkin` handler.

## 2. Decisions

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | What Skin does | **Look only.** It never writes `character.system`, and nothing that opens a character writes `settings.skin` (Mike, 2026-11-07) | Keep the link and warn before the switch: the skin would still flip on every character load, so a player with characters in both systems never gets the look they chose. Lock the system at creation: a player who picked the wrong one has to start the character again |
| 2 | How a character's system is changed | **A Game system row on the character's Settings page, with a warning first** that names what will change (Mike, 2026-11-07) | — |
| 3 | What follows the system instead of the skin | **The "Race"/"Ancestry" wording** (`raceTerm()`, the header's + Race / + Ancestry, the picker's example name) **and the top bar's wordmark and page title** (Mike, 2026-11-07) | The wordmark following the skin: it says "D&D Character Sheet" over a Humblewood character |
| 4 | Which Settings page the Game system row is on | **Sheet display, in a new first group "Game"** (my call). It is the page headed "For *name*", which is where per-character choices go | Appearance: that page is app-wide, and a per-character control there is what caused #133 |
| 5 | What the Skin row says | "How Fieldbook looks: colours, lettering and frames. It doesn't change any character." (my call) | Keeping "It also sets the open character's game system": no longer true |
| 6 | The wordmark and page title with no character open | **They follow the skin**, as today (my call). The home screen covers the top bar and has its own fixed wordmark ("Fieldbook / Character Library"), so only the browser tab's title shows. With no character there's no system to follow | A neutral "Fieldbook" title: it changes what a player sees in the tab today for no gain |
| 7 | The warning's content | **Only what actually changes for this character**, one sentence each, worked out once in advance by a pure plan (§5). The warning and the change both read that plan. It always ends by saying classes, spells, feats and items stay available, and the look doesn't change (my call) | A fixed paragraph: it would name coin and language changes that don't apply, so players learn to skip it. Working out the warning and the change separately: they could disagree |
| 8 | The ruleset's default language chips | **Swapped:** a `system`-sourced chip the new ruleset doesn't list is dropped, then the new ruleset's defaults are added. The player's own chips and grant chips are never touched. It is a new function in `41-chips.js` beside `ensureDefaultLanguages()` (my call, as the #103 spec §4 asked) | Leaving them: that is the gap known-issues records (KI:149–152). Re-granting the species' and background's languages from the rules during the swap: a second grant path for a case no shipped pack reaches (decision 9) |
| 9 | A default the swap drops that a species also grants | **Not handled; recorded as latent in known issues** (my call). A species that grants Common gets no `race:` chip of its own, because the `system` chip already covers the name (`grantLanguages()` skips names already present). A swap that drops that default would then drop a language the species still grants. Inert: no pack declares `defaultLanguages`, so every ruleset's default is Common and nothing is ever dropped | Re-granting from the rules in the swap: see decision 8 |
| 10 | Platinum and electrum on a Humblewood sheet | **Never converted. A Humblewood sheet shows a PP or EP row only while it holds some** (Mike, 2026-11-07). The player's numbers never change, and it fixes older sheets' hidden coins with no migration. Convert, on the Coins card, folds them into gold and silver whenever the player wants | Converting them at the swap (1 PP = 10 GP, 1 EP = 5 SP): it changes the player's numbers, its log line couldn't carry an Undo (undoing the coins alone brings PP back onto a Humblewood sheet), carried weight goes up (3 PP and 4 EP weigh 0.14 lb; 30 GP and 20 SP weigh 1 lb), and old sheets would still need a migration. Keeping them hidden, as today: they vanish from the Coins card and the trade window but still weigh, and the old sheets keep the bug |
| 11 | An ancestry from the other system already on the sheet | **It stays.** `racesForCharacter()` filters only the picker, and `findRaceDef()` must keep resolving it (the comment at `52-race.js:15–18`). The warning says so when it applies (my call) | Removing it: it takes the player's traits with it |
| 12 | The home screen's Skin, Mode and borders buttons | **They stay as they are:** each changes only the look, which is now what Skin means everywhere (my call) | Removing Skin from the home screen: a first run then has no way to choose a look before making a character |
| 13 | The New character dialog's system choice | **Stays, with Humblewood preselected as today**, and its hint corrected (§7) (my call) | Preselecting the system that matches the skin: it puts back the look-to-game link that decision 1 removes |
| 14 | Existing players' `settings.skin` | **Kept as stored.** Today it equals the skin of the last character opened. From now on it simply stays (my call) | Resetting it to Humblewood: it changes the look of every Classic player's app on update |
| 15 | How a refused settings save is reported | **An error toast**, `toast(msg,null,{err:true})`. It shows above Settings and the home screen, and stays until dismissed (#87). The pill's `_pillSaved()` already does this. It is lifted into one shared helper beside `saveSettings()` and used by every silent caller. Callers that already report keep their own channel (my call) | A new status line on each Settings page: three pages and the home screen would each need one, and the toast already does the job. The character save strip (`#saveWarn`): it is about the open character, and its button saves the character to a file |
| 16 | How often it is said | **Once per distinct message a session,** re-armed by the next settings save that lands. **Quiet when `storageBlockedWhy()` is set**, because boot has already said, in its alert, that nothing will be kept (`90-boot.js:433`) (my call) | On every refused save: a Settings page switch (`showPage()`) and a Rules category tap (`rbOpenCat()`) each save, so a full disk would raise a toast on every tap of an ordinary control |
| 17 | Toast wording | One sentence for every setting: "Couldn't save your settings: *why*. Changes to settings last until you close Fieldbook." The pill keeps its own "Couldn't save that you cleared the notice: *why*." (my call) | A name for each setting: twelve strings that say the same thing |
| 18 | The boot-time save after `foldLegacySettings()` | **Kept the way the boot source check keeps its refusal** (`extSaveError`), so Settings → Extensions shows "Couldn't save your sources at the last check: …" (my call). Blocked storage already gets its own alert from `storageBlockedWhy()` at boot, the same rule as decision 16 | A toast at boot: it would sit over the first paint about a conversion the player never asked for, and blocked storage is already said |

## 3. Data

- **No new character field, and no new settings key.** `character.system` stays `"dnd"` or
  `"humblewood"` (`migrate()` already coerces it, `71-char-io.js:129`). `settings.skin` stays
  `"humblewood"` or `"classic"`.
- **Backward compatibility:** nothing to migrate. An old save loads exactly as before. The only
  difference is that loading it no longer changes `settings.skin`. Under decision 10, an old
  Humblewood sheet that already carries hidden PP or EP (today's bug: `coinKeys()` hides them,
  `coinsWeight()` still weighs them, `sheet.js:840–842`) shows them, with no migration.
- **`skinForSystem()` and `systemForSkin()` go** (`75-home-theme.js:2–3`), because nothing calls
  them after this change. Every page that names them changes with them (§10), because `docs.js`
  (≈ 485–492) fails on a function a page names that doesn't exist.
- A system change writes the character through `scheduleSave()` as any edit does. `saveNow()`
  already updates the library index (the home card's system badge) through `libTouch()` and
  reports a refusal on the save strip. The explicit `libTouch()` call in today's skin handler, whose
  result is ignored, goes.
- The once-a-session memory of decision 16 is a module variable in `70-persistence.js`, not a
  setting: it is not saved, and a reload starts it empty.

## 4. Skin is look only (#133)

- **The Settings Skin control** (`88-settings.js:221`): it sets `settings.skin`, moves the `on`
  class, calls `applyTheme()` and saves through the reporting helper (§8). The `if(activeId){…}`
  tail goes.
- **Opening, making and importing a character** stop writing the skin:
  - `loadCharById()` (`75-home-theme.js:15`), `newCharacter()` (`:36`) and `finishImport()`
    (`71-char-io.js:284`) each lose `settings.skin=skinForSystem(…);saveSettings();`.
  - Each **still calls `applyTheme()`**, because the wordmark, the page title and the header's
    "+ Race"/"+ Ancestry" now depend on the character that just opened (§6).
- **The home screen's Skin buttons** (`90-boot.js:385`) are unchanged apart from reporting their save
  (§8).
- **`applyTheme()`** sets `data-skin` from `settings.skin` as now. Only the wordmark and title source
  changes (§6).

## 5. The Game system row and its warning (#133)

**The row.** On Sheet display, a new first group **"Game"** holds one row:

- **Game system**, with the help text "The game this character is for. It sets the coins, the
  ancestries you're offered and the default languages." and a segmented control `#segSystem` with
  **Humblewood** and **D&D**, `aria-pressed` as the other segmented controls have it.

**The plan, worked out once.** A tap on the other system first works out everything the change
would do, with a pure function, say `systemChangePlan(c, sys)`. It reads the character and the
loaded rules and writes nothing. It returns:

- `from`, `to`: the two systems.
- `langs`: `{drop:[names], add:[names]}`. This comes from running `swapDefaultLanguages()` on a
  scratch copy (`{system:c.system, languages:<a copy of c.languages>}`), so there is one swap rule,
  not two.
- `coins`: `{gain:true}` for a switch to D&D; `{pp, ep}` held for a switch to Humblewood while the
  sheet holds some; otherwise `null`. Nothing in the purse changes either way (decision 10).
- `ancestryStays`: the sheet's ancestry name when its definition is from the other system
  (`systemOf()` of `findRaceDef()` is `from`), else `""`.
- `advDiffers`: whether `advancementFor()` differs between the two systems (inert today).
- `term` and `wordmark`: the new "Race"/"Ancestry" and the top bar's words.

**The warning** asks with `askConfirm()` (`80-modal-forms.js:151`). It sits above the Settings
modal and doesn't close it.

- **Title:** "Make *name* a D&D character?" (or "a Humblewood character?"). An unnamed sheet reads
  "this character".
- **Message:** `systemChangeLines(plan)` → `string[]`, joined with spaces. It is pure and reads only
  the plan. Each sentence appears only when it applies:
  - Coins, to D&D: "Coins gain platinum and electrum." To Humblewood, holding PP or EP: "Your 3 PP
    and 4 EP stay on the Coins card until you spend or convert them."
  - Ancestry list: "The + Race list offers D&D species." / "The + Ancestry list offers Humblewood
    ancestries." When `ancestryStays`: "Strig stays on the sheet."
  - Languages, only when `langs` is not empty: "Humblefolk (a Humblewood default) goes; Common
    stays." / "Dwarvish is added." Inert today.
  - XP table, only when `advDiffers`: "The XP bar uses D&D's table."
  - Always: "The sheet says Race, and the top bar reads D&D Character Sheet." (or Ancestry /
    Humblewood). "Classes, spells, feats and items from every loaded pack stay available. The look
    doesn't change: that's Skin, on Appearance."
- **Buttons:** Cancel / "Make it D&D" (or "Make it Humblewood").

**Cancel** changes nothing. The control's `on` class must not move before the answer. The page's
delegated click handler (`88-settings.js:210–214`) reads `on` to set `aria-pressed`, so the handler
leaves both alone until Yes, then repaints the control and its `aria-pressed` itself.

**Yes** applies the same plan with `changeSystem(c, plan)` in `75-home-theme.js`. It changes only
`c`, and writes no log:

1. `c.system = plan.to`.
2. `swapDefaultLanguages(c, plan.to)`, the new function in `41-chips.js` (decision 8). It drops each
   chip with `src === "system"` whose name (case-blind) is not in
   `defaultLanguagesFor({system:plan.to})`, then adds the defaults that are missing, stamped
   `system`. Chips with `src:""` (the player's) and `race:`/`bg:` (grants) are never touched. It
   changes `c.languages` only, and returns `{drop, add}`. `ensureDefaultLanguages()` and every other
   existing function in `41-chips.js` are unchanged.

The coins are not touched (decision 10), so there is no inventory-log line.

Then the **handler** redraws what reads the system:
`applyTheme()` (wordmark, title, and the header via `renderSheetHead()`), the coins
(`renderCoins()`, and `renderInventory()` for coin weight), the language chips, `recompute()`, and
`scheduleSave()`. Calling `renderAll()` is fine if it leaves the open Settings modal alone; the
builder chooses. Settings stays open on Sheet display.

**The coins: shown while held (decision 10).** Nothing is converted at the swap.

- **`coinKeys()`** (`66-coins-hp.js:100`):
  - on a D&D sheet it is unchanged (PP GP EP SP CP);
  - on a Humblewood sheet it returns GP, SP and CP, plus PP and EP when the sheet holds some
    (`num(...)>0`), in the display order PP GP EP SP CP.
  - It reads `character`, as now.
- **What follows from `coinKeys()`**, with no other change:
  - The Coins card and Adjust coins (`66-coins-hp.js:14, 145`) show those rows.
  - `convertCoins()` (`:80–92`) already counts all five and writes only the system's set, so
    Convert folds PP and EP into GP and SP, and their rows go.
  - The trade window (`67-trade.js:305–422`) lists them on both sides. The give side is capped at
    what is held. Paying can break a held PP (`tradeSplitPlan()` reads `coinKeys()`), and change
    comes back in GP, SP and CP (the `chain` at `:355`).
- A row whose count reaches 0 goes at the next redraw.
- Weight is unchanged: `coinsWeight()` has always counted all five.
- Older Humblewood sheets whose PP or EP was hidden (`sheet.js:840–842`) show them from the first
  load, with no migration.

**What reads `character.system`** (the full list at e07a136, so the plan misses nothing):

- `racesForCharacter()` (`52-race.js:28`).
- `rulesetDecl()` (`41-chips.js:40`), and through it `advancementFor()` and `defaultLanguagesFor()`.
- `convertCoins()` and `coinKeys()` (`66-coins-hp.js:87, 100`), and through them the Coins card,
  Adjust coins and the trade window (`67-trade.js`).
- `libTouch()` and `backupCharacter()`'s index entry (the home card's badge).

The `system` fields in `89-extensions.js` and `89-rules-merge.js` are pack labels, not the
character's.

## 6. What follows the system

- **`raceTerm()`** (`52-race.js:2`) reads `character.system`: `"dnd"` → "Race", anything else →
  "Ancestry". Its callers need no change: the feature group heading (`20-lists.js:24`), the header's
  + Race / + Ancestry (`40-sheet.js:484`), the picker (`52-race.js:48`), the no-data info window
  (`:161`) and the credits sentence (`88-settings.js:185`).
- **The picker's example name** (`52-race.js:52`, `settings.skin==="classic"?"Elf":"Strig"`) reads
  the system the same way.
- **The wordmark and page title** (`applyTheme()`, `75-home-theme.js:136–140`): from
  `character.system` when a character is open (`activeId`), from `settings.skin` when none is
  (decision 6). The two texts are unchanged: "D&D / Character Sheet / D&D Character Sheet" and
  "Humblewood / The Fieldbook / Fieldbook — Humblewood". Its comment about "+ Species" / "+ Race"
  is corrected.
- **What the skin keeps:** `data-skin`, so the palette, fonts and frames (`00-tokens.css`), and
  nothing else.

## 7. The New character dialog and the home screen

- **The hint** (`75-home-theme.js:118`) becomes: "The game this character is for. It sets the coins,
  the ancestries you're offered and your starting languages. Classes, spells, feats and items from
  every loaded pack are offered either way. You can change it later in Settings → Sheet display."
  The old hint says the system sets the look, and that all loaded rules stay available, which is
  false for ancestries.
- The dialog's system choice and its Humblewood default are unchanged (decision 13).
- The home setup panel's Skin, Mode and borders buttons are unchanged apart from reporting their
  saves (decision 12).

## 8. Every settings save says so (#141)

**The helper.** `_pillSaved()` (`90-boot.js:335`) moves into `70-persistence.js` beside
`saveSettings()`, as, say, `saveSettingsSaid(what)`:

- It calls `saveSettings()` and returns its result either way.
- On a refusal it toasts "Couldn't save *what*: *why*." with `{err:true}`. With no `what`, the
  sentence is decision 17's.
- It doesn't toast (decision 16):
  - when `storageBlockedWhy()` is non-empty, because boot's alert has said it;
  - when this exact sentence has already been shown this session.
- A save that lands empties the remembered sentences, so a later refusal is said again.
- `toast()` is in `60-attacks.js`, earlier in the concatenation, and is only called at run time.

`saveSettings()` itself is unchanged, so the callers that already report keep using it.

**Every caller at e07a136.** The 15 bare calls are every row marked "silent".

| Where | What it saves | Today | After |
|---|---|---|---|
| `71-char-io.js:284` `finishImport()` | skin from system | silent | **removed** (§4) |
| `75-home-theme.js:15` `loadCharById()` | skin from system | silent | **removed** |
| `75-home-theme.js:36` `newCharacter()` | skin from system | silent | **removed** |
| `86-rules-browser.js:313` `rbOpenCat()` | the Rules tab's category | silent | helper |
| `88-settings.js:205` `showPage()` | the Settings page | silent | helper |
| `88-settings.js:221` `#segSkin` | skin | silent | helper |
| `88-settings.js:222` `#segTheme` | mode | silent | helper |
| `88-settings.js:224` `#swRough` | borders | silent | helper |
| `88-settings.js:225` `#swTabIcons` | icon tabs | silent | helper |
| `88-settings.js:227` `#swBackdrop` | tap outside to close | silent | helper |
| `88-settings.js:351` `finishSettingsImport()` | imported settings | reports on `#setImpStatus` | unchanged |
| `89-extensions.js:404` `checkSources()` | sources after a check | status line; at boot kept in `extSaveError` | unchanged |
| `89-extensions.js:439–440` `extSetToken()` | a source's token | returned; callers report | unchanged |
| `89-extensions.js:462` `addGithubSource()` | a new source | in its `why` | unchanged |
| `89-extensions.js:507` `addSource()` | a new source | in its `why` | unchanged |
| `89-extensions.js:728` `runInstall()` | pack origins | in `saveErr` (`:741`), which the install toast shows (≈ 1126) | unchanged |
| `89-extensions.js:993` `extSaveSources()` | sources | status line | unchanged |
| `90-boot.js:327` `#btnTheme` | mode (top bar) | silent | helper |
| `90-boot.js:335` `_pillSaved()` | a cleared notice | toast | **becomes the helper**, with its own `what` |
| `90-boot.js:385–387` `#homeSkin`, `#homeMode`, `#homeRough` | look | silent | helper |
| `90-boot.js:409` `boot()` | sources folded from old settings | silent | kept in `extSaveError` (decision 18) |

After this, no bare `saveSettings();` statement is left in `src/js`: every call's result is used.
A source check (§9) keeps it that way.

## 9. Tests

**Rewrite in place** the checks this changes (they assert the old wording):

- `rules-data.js:2204`: the `#swBackdrop` handler regex ends `saveSettings\(\);\}\)`. It changes
  to the helper.
- `rules-data.js:2502`: `settings\.setPage=k;saveSettings\(\);` changes the same way.
- `rules-data.js:2481`: Appearance still holds `segSkin`. A new check says Sheet display holds
  `segSystem`, first on the page.

**New in `rules-data.js`'s storage guards:**

- No bare `saveSettings();` statement in any `src/js` fragment.
- Every call's result is used: either it goes through the helper, or it is one of §8's
  "unchanged" callers, which report on their own channel (`#setImpStatus`, the Extensions status
  line, `extSaveError`, a `why`, and `runInstall()`'s `saveErr` in its install toast).
- `skinForSystem`/`systemForSkin` are gone.
- No `settings.skin=` assignment remains outside the two skin controls (`#segSkin`, `#homeSkin`)
  and Import settings.

**A new block at the end of `sheet.js`**, "1.9.1 Skin & settings saves: #133, #141". It uses the
boot & storage harness (`BS.app`) where real storage is needed, and its quota switch
(`a.state.quotaFull`).

*Skin and system (#133):*

- Opening (`loadCharById()`), making (`newCharacter(name,"dnd")`) and importing (`finishImport()`)
  a D&D character under the Humblewood skin leaves `settings.skin` at `humblewood`.
- With `activeId` set, `applyTheme()` writes "D&D" to the wordmark, "D&D Character Sheet" to the
  title, and `humblewood` to `data-skin`. With no character open, the wordmark follows the skin.
- `raceTerm()` is "Race" for a D&D character under either skin, and "Ancestry" for a Humblewood
  one.

*`swapDefaultLanguages()`, with `rules.defaultLanguages` stubbed to declare one list per ruleset:*

- A `system` chip the new ruleset doesn't list goes; one it lists stays.
- The new defaults arrive stamped `system`.
- Player chips and `race:`/`bg:` chips are never dropped, whatever their names.
- With no declared defaults, the languages are unchanged.
- It returns what it dropped and added.

*The plan and the warning:*

- `systemChangePlan()` writes nothing: the character is deep-equal before and after, and so is
  `character.invLog`.
- Its `langs` match what `swapDefaultLanguages()` then does.
- `systemChangeLines()`:
  - the coin sentence names the amounts when PP or EP is held;
  - the ancestry-stays sentence appears only for a cross-system ancestry;
  - the language sentence appears only when chips change;
  - the closing sentences are always there.
- `changeSystem()` applies the plan it is given and writes no log.

*Coins (decision 10):*

- A Humblewood sheet with `ep:50` has EP in `coinKeys()`, between GP and SP; with `ep:""` it
  hasn't. The same holds for PP, first.
- Convert on that sheet folds the EP into SP, and the EP row goes.
- The trade window's give side offers the held EP.
- `sheet.js:840–842` still holds.
- D&D → Humblewood with `pp:3, ep:4` leaves the coins exactly as they were, and writes no
  inventory-log line.

*Settings saves (#141), with storage full (`quotaFull`):*

- The first refused save from each silent caller in §8 (the settings controls through their
  handlers, `rbOpenCat()`, `showPage()`, the top-bar theme button, the home buttons) raises one error
  toast reading "Couldn't save your settings: your browser's storage is full…".
- A second refused save, from the same control or another, raises none.
- After a save that lands, the next refusal is said again.
- The pill keeps its own sentence.
- With storage blocked (`BS.denied()`), boot's one alert is all: no settings save toasts.
- With storage working, no toast at all.
- A boot whose fold save is refused leaves `extSaveErrorText()` set.

Also a throwaway Node check in the scratchpad for `systemChangePlan()`, `systemChangeLines()` and
`swapDefaultLanguages()`, per CLAUDE.md.

## 10. Docs, notes, screenshots

**Wiki:**

- [Theming & icons](../wiki/ui/theming-and-icons.md):
  - The intro's "the skin is not a free choice" and the section "Skins follow the system" become
    "The skin is look only; the system is the character's".
  - The `applyTheme()` paragraph: the wordmark and "+ Race" follow the system.
  - The Code line drops the two removed functions.
  - A Decisions row for decisions 1, 3 and 6.
- [Settings & updates](../wiki/features/settings-and-updates.md): the Appearance row; the Sheet
  display row gains Game system and its warning.
- [Home & characters](../wiki/features/home-and-characters.md): lines 47–57, 94 and 120 (no skin
  switch on new, open, import), the decision at 146, and the dialog's hint.
- [Storage](../wiki/architecture/storage.md): the Settings paragraph (every caller reports, the
  helper, once a session, quiet when blocked, the boot fold), and the "Open" item about
  `saveSettings()` removed.
- [Character model](../wiki/architecture/character-model.md): the `system` chips gap (line 230)
  resolved by `swapDefaultLanguages()`.
- [Character building](../wiki/features/character-building.md): line 51, "by skin" becomes "by
  system".
- [Overview](../wiki/overview.md):
  - line 31, "which also picks the skin";
  - glossary line 209, "follows the character's system";
  - the code map's lines for `75-home-theme.js` and `41-chips.js`.
- [Decisions](../wiki/decisions.md): rows for decisions 1, 2, 3, 8, 15 and 16.
- [Known issues](../wiki/roadmap/known-issues.md):
  - Remove the #133 lines (the skin rewrite, KI ≈ 290–292; the `system` chips, ≈ 149–152) and the
    #141 line (≈ 302–306).
  - Add to "Latent: no shipped data triggers these yet" (≈ 308): decision 9's case, a default
    language dropped by a system swap that the species also grants.
- [Inventory](../wiki/features/inventory.md): the coin set. A Humblewood sheet shows PP or EP while
  it holds some.
- [Screenshot QA](../wiki/process/screenshot-qa.md) ≈ 80–82: the rule "Shoot both skins" names
  `skinForSystem()` and says a `"dnd"` character is classic. Both stop being true. New text: the
  skin is independent of the character, so shoot both skins by setting it,
  `settings.skin="classic";applyTheme()` (and back to `"humblewood"`) through `browser_evaluate`,
  or by tapping Skin on Settings → Appearance. Shoot a D&D and a Humblewood character when the
  change is about the system (coins, Race/Ancestry, the wordmark).
- [1.9.1 roadmap](../wiki/roadmap/1.9.1.md) line 58: the Skin & settings saves row names
  `systemForSkin()` and `41-chips.js` `ensureDefaultLanguages()`. It changes to name what the
  branch does: the new `swapDefaultLanguages()` beside it, and no removed function by name.

**Outside the wiki:**

- **`.claude/skills/release/pre-release.md` ≈ 364**, the pre-drive: "a `newCharacter("QA", "dnd")`
  sheet is classic, a `newCharacter("QA", "humblewood")` sheet is humblewood". It becomes: set the
  skin with `settings.skin` and `applyTheme()` (or Settings → Appearance), once each, and make one
  D&D and one Humblewood character for the lines about the system.
- **Ledger** entry, with History lines citing it on each page above.
- **Spec trail:** the [sheet makeover spec](1.9.0/2026-10-23-sheet-makeover-design.md)'s deviation
  "§4 … not needed (#133)" gets a one-line pointer to this spec.
- **[Smoke list](../qa/smoke.md)** line 78 reads "Switch light and dark, then the skin: the whole app
  follows". It is Mike's file, so the branch proposes new wording and he decides: "Switch light and
  dark, then the skin: the whole app follows, and the open character's system and coins don't
  change. Settings → Sheet display → Game system asks first, then swaps the coins and the
  Race/Ancestry wording."

**`UNRELEASED.md`**, worded for players (drafts):

- Skin now only changes how Fieldbook looks. It no longer changes the open character's game, and
  opening a character from the other game no longer switches it. To change a character's game, use
  Settings → Sheet display → Game system, which tells you what will change before it does.
- A D&D character's sheet says Race and its top bar reads D&D Character Sheet, and a Humblewood
  character's says Ancestry, whichever skin you use.
- A Humblewood character holding platinum or electrum (from a D&D sheet, or an imported one) now
  sees them on the Coins card until they're spent or converted.
- When a settings change can't be saved, because your browser's storage is full, Fieldbook now says
  so once instead of quietly losing it the next time you open it.

**Screenshots** go to `.claude/qa/in-progress/133-skin-settings-saves/`. Shoot both skins, set as
above, at desktop and phone width; light and dark only where themed CSS is touched (none is
expected).

- Settings → Appearance before and after (the Skin help text).
- Settings → Sheet display with the Game system row.
- The warning both ways: D&D → Humblewood holding PP and EP, and Humblewood → D&D with a Humblewood
  ancestry on the sheet.
- The sheet header and top bar of a D&D character under the Humblewood skin, and of a Humblewood
  character under the Classic skin.
- A Humblewood Coins card holding EP.
- The New character dialog's hint.
- The error toast, with storage forced full in the page (`localStorage.setItem` overridden to throw
  `QuotaExceededError` for `hw-fb-settings`), over Settings and over the home screen. A second
  refused toggle shows no second toast.
- Interactive changes are driven (tap, answer, screenshot), and what was and wasn't driven is said
  plainly. Real devices and Mike's own characters are his pass.

## 11. Merge order and shared files

- **Bio chips (#121) merges first**, then this branch rebases onto it.
- **This branch adds one function to `41-chips.js`, `swapDefaultLanguages()`, beside
  `ensureDefaultLanguages()`, and changes no existing function there.** Bio chips edits other
  functions in the same fragment. After the rebase, check that `chipClean()`,
  `defaultLanguagesFor()` and the chip redraw this branch calls (`renderChipsAll()` today) still
  exist under those names and shapes.
- Both branches touch `52-race.js` and `71-char-io.js`, in different functions: here `raceTerm()`,
  the picker placeholder and one line of `finishImport()`; there `applyRace()` and a `migrate()`
  lift.
- Boot & storage (#142…) is already merged. This branch edits two of `boot()`'s neighbours in
  `90-boot.js` (the home buttons and `_pillSaved()`) and the fold line at `:409`.
- `src/tests/sheet.js`: a new block at the end, as the roadmap's rule says.

## 12. Out of scope

- Converting the remaining `confirm()` and `alert()` calls (#126).
- A per-character skin. The skin stays one app-wide setting.
- Any change to which categories are filtered by system: species only, in the picker only, as
  decided at #84.
- New `defaultLanguages` or `advancement` data in any pack. The swap is built and tested against
  stubs, and is inert with today's packs.
- Re-granting a species' or background's languages during a system swap (decision 9).

## 13. Left to the builder

- the helper's and the pure functions' exact names;
- the markup and class names of the new group and row;
- whether the redraw after Yes is `renderAll()` or the specific renders;
- how the source check in §9 recognises a bare call;
- the exact sentence wording within the shapes in §5, §7 and §8.
