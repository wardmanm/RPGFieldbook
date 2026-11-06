# Theming & icons

Fieldbook has two **skins**, Humblewood and Classic D&D, each in **light** and **dark**, plus an
optional hand-drawn wobble on every frame. The skin is not a free choice: it follows the open
character's system. All of it is driven by four attributes on `<html>` and the CSS custom
properties in `00-tokens.css`. The same page covers the **emblems**, 79 glyphs from game-icons.net
beside classes, ancestries and backgrounds and on the combat button. They come from a hand-authored
map through a fetch script into a generated fragment, and they carry CC BY 3.0 obligations the app
has to meet on its own. The **fonts** work the same way: three families, embedded in the stylesheet
by a second fetch script so the page makes no font request, under the SIL Open Font License 1.1.

**Code:** `applyTheme()`, `skinForSystem()`, `systemForSkin()` in `75-home-theme.js` · `raceTerm()`,
`racesForCharacter()` in `52-race.js` · `iconSVG()`, `iconSlug()` in `50-classrace.js` ·
`GAME_ICONS`, `ICON_MAP`, `ICON_ARTISTS` in `05-icons.js` (generated) · the credits in
`88-settings.js` · `scripts/fetch-icons.js` · `css2Url()`, `parseLatinFaces()`, `licenceParts()`,
`fragmentCSS()` in `scripts/fetch-fonts.js`, which writes `90-fonts.css` (generated) ·
`00-tokens.css`, the `::before` frames in `20-cards.css` and `30-sheet.css` · **Data:**
`src/icons/icons.json` ·
**Tests:** `docs.js` (map against fragment, path-data charset, coverage of shipped names, CC BY;
the tokens' families against `90-fonts.css`, each face and its sha256, the weights the CSS asks for,
the OFL text and notices, the fonts' credit),
`sheet.js` (`iconSVG()` lookups), `rules-data.js` (`--warn` in every palette, the `data-tabs`
default; the page loads nothing from a third-party address, and carries `90-fonts.css` byte for
byte) · **See also:** [Shell](shell.md), [Settings & updates](../features/settings-and-updates.md),
[README §10](../../../../README.md)

## How it works

### Four attributes on `<html>`

`applyTheme()` is the only writer. The template ships defaults so the first paint, before any script
runs, is Humblewood, light, rough, word tabs.

| Attribute | Values | From | Default in the template |
|---|---|---|---|
| `data-skin` | `humblewood`, `classic` | `settings.skin` | `humblewood` |
| `data-theme` | `light`, `dark` | `settings.theme`, with `system` resolved through `prefers-color-scheme` | `light` |
| `data-rough` | `on`, `off` | `settings.rough` (Hand-drawn borders) | `on` |
| `data-tabs` | `icons`, `labels` | `settings.tabIcons` (Icon tabs) | `labels` |

`applyTheme()` also writes the wordmark (`#wmMain` / `#wmSub`: "Humblewood / The Fieldbook" or
"D&D / Character Sheet"), `document.title` and the sun/moon glyph on the theme button, and repaints
the sheet header (`renderSheetHead()`), whose "+ Race" / "+ Ancestry" follows the skin through
`raceTerm()`. It runs at boot, on every character load, create and import, and on each Appearance
control.

### Skins follow the system

A character's `system` is `dnd` or `humblewood`. `skinForSystem()` maps `dnd` to `classic` and
anything else to `humblewood`, and `systemForSkin()` is its inverse. `loadCharById()`,
`newCharacter()` and the import path all set `settings.skin` from the character's system before
drawing. The link runs the other way too: the **skin control in Settings** writes
`character.system` for the open character, then redraws coins, updates the library entry and saves.
Changing the skin there therefore changes the system, which sets the coin set (PP GP EP SP CP or
GP SP CP), the ancestries `racesForCharacter()` offers, and the badge on the home screen's
character card. The skin buttons in the home screen's setup panel change only `settings.skin`.
`settings.skin` is global, so opening a character of the other system switches the whole app.

### Light, dark and system

`settings.theme` is `system`, `light` or `dark`. In `system` mode a `prefers-color-scheme` listener
set up in `wire()` re-applies the theme when the OS changes. The top-bar button flips light and dark
and so leaves `system` mode, resolving it to what is showing first.

### Tokens

`:root` holds the fonts and the radius. The palettes are four blocks:

- `html[data-theme="light"]` and `html[data-theme="dark"]`, which are the Humblewood palette
  (the CSS never names `humblewood`);
- `html[data-skin="classic"][data-theme="light"]` and `…[data-theme="dark"]`, which win on
  specificity.

Each defines `--paper`, `--paper-2`, `--panel`, `--ink`, `--ink-soft`, `--line`, `--hair`,
`--accent`, `--accent-2`, `--brick`, `--warn`, `--field`, `--field-focus`, `--shadow`, `--ground`
and, since #101, `--lu-night`, `--lu-night-2`, `--lu-glow` and `--lu-spark` for the level-up scene
([Character building](../features/character-building.md)). Unlike every other token, light and
dark **share one value** per skin: the scene dims the whole page to a night backdrop regardless of
theme (`--lu-night`/`--lu-night-2`, the gradient's edge and centre), so it is defined once per skin
block rather than once per theme block — Humblewood's values are on `:root` and the classic skin's
on `html[data-skin="classic"]`, which wins as usual (`00-tokens.css`). Classic is a violet night with pale
arcane blue (`--lu-glow`); Humblewood is a deep forest green (`#0d1a12`) with a warm gold-green glow.
`--lu-spark` (the banner's gold sparks) is the same gold in both skins. **`--hb-healthy`,
`--hb-injured`, `--hb-bloodied`, `--hb-near` and `--hb-empty`** (#91, the initiative tracker's
health bands, [Combat view](../features/combat-view.md)) go a step further: one green/amber/
orange/red/grey set on bare `:root`, shared by **every** skin and theme — a fixed semaphore so
"Bloodied" always reads the same colour whichever palette is open, rather than following `--warn`/
`--brick`'s per-palette drift. The fonts are `--display`
(Grenze Gotisch; Cinzel on the classic skin), `--head`
(Cinzel) and `--body` (EB Garamond). All three are **embedded** in the stylesheet by `90-fonts.css`
(below), so they render the same online and off and the page makes no font request. Only Google's
Latin subset is embedded: a letter outside its `unicode-range`, such as "Ł", falls back to the
stack's next font, Georgia or Times New Roman, for that letter alone. Text on an
`--accent` fill uses **`--on-accent`** (#47), set per palette for contrast: near-black on
Humblewood's ochre and gold and on classic dark's bright red, cream on classic light's deep red
(lowest 4.8:1, Humblewood light). The rail sets its own, since it swaps `--accent` for
`--rail-accent`. Primary buttons, the update pill, filter pills, selected segments, Use, the spell
pin's tick, the level ring, the toast, the combat tab, the initiative chip, the log filter and the
level-up banners all use it; a fixed `#20160a` used to read at 2:1 on classic light's red. Print ignores the tokens: `#printArea` is forced to black on white. `prefers-reduced-motion`
switches every animation and transition off (`50-modal.css`), and never builds the level-up scene
layer at all (#101).

On the classic skin **`--accent` and `--brick` are the same colour** (`#8f2318` light, `#e2564a`
dark). That is why `--warn` exists, for the middle band of the current-HP colours, and why states
that must differ also differ in shape: the "missing" pack chip carries a `!`, and an out-of-date
version badge an `↑`.

### The rough frame

A panel's frame is an inset `::before` border with `pointer-events:none`. Its children are lifted
above it with `position:relative`, and `html[data-rough="on"] X::before{filter:url(#rough)}` wobbles
the frame alone. `#rough` is the `feTurbulence` + `feDisplacementMap` filter inlined at the top of
the template. Cards, the modal, abilities, vitals boxes, the HP and Hit Dice panels, slots, items
and the portrait all use it.

### The emblem pipeline

```
src/icons/icons.json  --(node scripts/fetch-icons.js, by hand)-->  src/js/05-icons.js  --(build)-->  fieldbook.html
```

- **`icons.json` is hand-authored:** four kinds, `classes`, `races`, `backgrounds` and `ui`, each
  mapping an entity **name** to an `<artist>/<icon>` slug from the game-icons GitHub repo. Keys that
  start with `_` are comments. There are 79 entries today (15 classes, 37 races, 26 backgrounds and
  the combat button), no two sharing a slug.
- **`fetch-icons.js`** validates the map (known kinds, well-formed slugs) and downloads each distinct
  slug. It checks every file strictly: a 512 viewBox, no `<g>`, exactly two paths, the first being
  the black background square, no transform, and glyph path data within the SVG path charset. It
  reports each failing slug and exits without writing, rather than half-handling an icon. It keeps
  only the glyph's `d`, drops the fill, and writes `05-icons.js`: `GAME_ICONS` (slug → path data),
  `ICON_MAP` (kind → lower-cased name → slug) and `ICON_ARTISTS` (from the slugs actually vendored).
  `--dry-run` fetches and parses without writing.
- **`05-icons.js` is committed and is the vendored artwork.** No `.svg` files are kept. Its header
  says GENERATED, DO NOT EDIT.

### Drawing an emblem

`iconSVG()` (kind, name, class) looks the name up through `iconSlug()`, trimmed and lower-cased to
match `keyOf()` in `89-rules-merge.js`. It returns
`<svg class="gicon …" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="…"/></svg>`,
or `""` for an unmapped name, so a custom or homebrew entry simply has no emblem. The lookup is by
the plain name the character stores, so emblems draw with no rules pack loaded. `.gicon` fills with
`currentColor`: `--ink-soft` on the class, ancestry and background chips (`--accent` on hover),
`--accent` and 30px in a modal header (via the third argument of `openModal()`), and the button's
own colour on the combat swords.

**`d` cannot carry markup, and is escaped anyway.** Every glyph was checked against the path-data
charset (`[-0-9.,eE MmLlHhVvCcSsQqTtAaZz]`) before it was written, and `docs.js` re-checks the
committed fragment against the same charset. The name never reaches the output (it is only a lookup
key), and `kind` only selects a map. Both `d` and the third argument, a class name every caller
passes as a literal (`"lg"`, `"cvicon"`), still go through `esc()`, where it is the identity: every
attribute value in `src/js` is escaped, so the guard needs no list of exceptions (see
[Rich text](../architecture/rich-text.md)).

### The font pipeline

```
FAMILIES in scripts/fetch-fonts.js  --(node scripts/fetch-fonts.js, by hand)-->  src/css/90-fonts.css  --(build)-->  fieldbook.html
```

- **`FAMILIES`** names each family, its google/fonts `ofl/` folder and its weights per style:
  Grenze Gotisch 500/700/900, Cinzel 500/600/700, EB Garamond 400/500/600 and italic 400 (the request
  the template's Google link made before #144). The names must be the tokens' names exactly.
- **`fetch-fonts.js`** sends that request to the Google Fonts css2 API (`css2Url()`) with a Chrome
  User-Agent, since woff2 is served only to a browser it knows, and keeps the `/* latin */` faces
  (`parseLatinFaces()`). Each style comes back as **one woff2 covering every weight requested**,
  four files in all, about 135 KiB (184 KB as base64): variable fonts for the three styles with
  several weights, a static file for the italic's one. It fetches each family's `OFL.txt`
  and splits it into the copyright notice and the licence text (`licenceParts()`), then writes the
  fragment (`fragmentCSS()`). It is strict like `fetch-icons.js`: an unexpected family, style,
  weight, subset range or file, separate files per weight, a file that is not woff2, more than
  256 KiB in all, a Reserved Font Name, licence texts that differ, or `*/` or `</style` in them,
  and it dies naming the problem and writes nothing. One answer is retried: now and then Google
  gives `fonts.gstatic.com/l/font?kit=…` addresses instead of `/s/…woff2` files, and asking again
  (up to three times) gets the files. `--dry-run` fetches and checks without writing.
- **`90-fonts.css` is committed and is the vendored copy of the fonts.** No font files are kept. It
  is last in `manifest.css` (an `@font-face` works anywhere in a sheet, and the readable CSS stays
  first). Its header says GENERATED, DO NOT EDIT; then come the notices and the full OFL text in one
  comment, then one `@font-face` per file: `font-weight` as the range of the requested weights
  (`500 900`, `500 700`, `400 600`, `400`), Google's latin `unicode-range`, `font-display:swap`, and a
  `data:font/woff2;base64,` URL, each line of base64 one file. The comment above each block gives
  the file's size, sha256 and Google address, and `docs.js` checks the blob against the first two.
- **Weights.** A weight the CSS asks for beyond a range (800 and 900 on `--head` and `--body`)
  clamps to its end, the face the Google link gave. One *inside* a range, between two requested
  weights, renders as asked, where Google's one face per weight snapped it to the next requested
  one: Grenze Gotisch's range has gaps at 600 and 800. `.hcard-name` once asked for 800, which drew
  at 900 online, so it asks for 900. `docs.js` maps every weight the CSS asks of each family both
  ways and fails where they differ.

### The licence

**The emblems.** CC BY 3.0 asks for three things: name the artists, name and link the licence, and
say the work was changed. Removing the background square and the fill is the change. All three
appear in two places:

- **In the app**, Settings → Credits, built from `ICON_ARTISTS`, so
  the credit cannot drift from what is vendored.
- **In [README §10](../../../../README.md)**, which ships in the zip.

`docs.js` checks the README for game-icons.net, "CC BY 3.0", the licence URL and "background
square was removed", and `88-settings.js` for `ICON_ARTISTS`, "CC BY 3.0" and "background square was
removed".

**The fonts.** The SIL Open Font License 1.1 asks that each copy carry the copyright notice and the
licence. `90-fonts.css`'s comment holds both, and the build keeps comments (it is plain
concatenation), so they travel inside `fieldbook.html` itself. Subsetting to Latin modifies the fonts
under the OFL, so a Reserved Font Name would forbid keeping the name: none of the three declares one,
and the fetcher refuses a family that does. The notices are Copyright 2020 The Grenze Gotisch Project
Authors, Copyright 2020 The Cinzel Project Authors and Copyright 2017 The EB Garamond Project
Authors. Settings → Credits and README §10 name the three families and the SIL Open Font License 1.1,
linked to openfontlicense.org; `docs.js` checks both name every family the fragment embeds.

## Rules that must hold

- **Never hand-edit `05-icons.js`.** Edit `icons.json`, run `node scripts/fetch-icons.js`, and
  commit both. `docs.js` fails if the slugs in the map and the fragment differ in either direction,
  and its message names the command.
- **The fetch is never part of the build or CI.** CI asserts that a build changes no tracked file,
  and a network fetch would make that depend on GitHub. That goes for both fetchers; the app zip's
  guard bans every `scripts/` path.
- **Never hand-edit `90-fonts.css`.** Edit `FAMILIES` in `fetch-fonts.js`, re-run it, and commit
  both. `docs.js` fails if a family the tokens name is not embedded, or one is embedded that no token
  names, and its message names the command.
- **The page loads no font, or anything else, from a third-party address** (CLAUDE.md constraint 1).
  `rules-data.js` checks the built page and its sources.
- **Latin only** (Mike, 2026-11-06). Each face keeps Google's latin `unicode-range`; `docs.js`
  checks it, and that no `U+0100` (Latin Extended) is in it.
- **A `--display` weight is 500, 700 or 900** (Grenze Gotisch's requested weights), or it will not
  draw as it did online; `docs.js` checks every weight the CSS asks of every family.
- **Never widen `GSTATIC`** in `fetch-fonts.js` to take Google's `/l/font?kit=` addresses: re-run.
- **The fonts' notices and licence stay in the file,** in `90-fonts.css`'s comment: a minifier or a
  build step that dropped comments would break the OFL. `rules-data.js` checks the built page holds
  the fragment byte for byte.
- **Emblems are keyed by name, lower-cased, never by `_id`.** This is the "keep working with no pack"
  property.
- **Subclasses get no emblem** (`docs.js` asserts `icons.json` has no `subclasses` block).
- **Every shipped class, race and background has an emblem.** `docs.js` walks the public pack
  (`DIRS`: `srd52`), and the private suite walks the 2024, Humblewood, Xanathar's, Tasha's and
  homebrew packs, so a **data-only** change that adds a name turns one of them red until
  `icons.json` gains a line and the fetcher is re-run. The icon map keeps every pack's names,
  private ones included: names are not the protected text.
- **The kinds list lives in three places** and moves together: `KINDS` in `fetch-icons.js`,
  `KINDS` in `docs.js` (with `DATA_KINDS`, the three that name things in `data/`), and the `kind`
  argument of `iconSVG()`.
- **The path-data charset check stays strict.** Widening it moves the proof of safety onto every
  call site.
- **The credits stay in the app**, emblems and fonts both, because `fieldbook.html` is shared as a
  lone file that no README follows.
- **Every palette defines every token.** `rules-data.js` asserts that `--warn` appears as often as
  `--brick`. A token missing from a classic block would quietly fall back to the Humblewood value.
  The two deliberate exceptions, each defined once rather than per palette and asserted as such,
  are the level-up scene's tokens (once per **skin**, #101), the initiative tracker's band
  tokens (once on bare `:root`, shared by all four palettes, #91), and the Parchment page style's
  ink (`--parch-ink`, `--parch-soft`, `--parch-hair`, `--parch-accent`: once per skin, #167, since
  parchment is cream with dark ink in both themes). Every palette defines the journal page's
  `--sheet`, `--sheet-edge`, `--sheet-lift`, `--sheet-gutter` and `--parch` ([Journal](../features/journal.md)).
- **`applyTheme()` is the only writer of the four attributes**, and the template keeps its defaults.
  A test asserts `data-tabs="labels"` is on the root element.

## Traps

- **The credits rendered as a stair-step.** `.m-body p` is `white-space:pre-wrap`, so a paragraph
  wrapped in source kept its newlines and indentation. Every hint in `88-settings.js` is one long
  line for this reason (L3289).
- **An emblem leaks into the next modal** if `openModal()`'s icon assignment is guarded; see
  [Shell](shell.md) (L3289).
- **Colour alone cannot carry a state on the classic skin.** A red "missing" chip and the amber
  "update available" chip are identical there, hence the glyphs (L1883); two HP bands would merge,
  hence `--warn` (L2212).
- **A real border does not wobble.** The rough filter reaches only `::before`, so a panel framed with
  `border` sat still beside its wobbling neighbour. It was also 1px out at the corners, because the
  inset sits inside the padding box and a border outside it (L2151).
- **`--muted` does not exist.** The soft text token is `--ink-soft`, and an undefined custom
  property fails silently (L505).
- **`fill-rule` is left at the default.** The glyphs are drawn with counter-wound holes, and forcing
  `evenodd` inverts the holes on many of them (`fetch-icons.js`).
- **Cinzel's "1" reads like a capital "I".** `--head` and `--display` (classic skin) have no serif
  on the digit, and `font-variant-numeric:lining-nums` does nothing to it — Cinzel defines no
  alternate numeral set for the property to pick between. Anywhere a digit must stay readable next
  to this face, set `--body` instead; that is what the level-up card's class line and banner number
  do (L6840, #101).

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where the emblem map lives | In the app: `src/icons/icons.json`, generated into `05-icons.js` | In `data/`: converter output is overwritten whole by `_write()`; the 2024 pack must reproduce byte for byte; and `release.js` would bump `dataVersion`, telling every player to re-download five packs for a cosmetic change |
| Keep the `.svg` files? | No: the generated fragment is the vendored artwork | 78 SVGs plus a second offline generator: buys nothing, since the only possible drift ("edited the map, forgot to re-fetch") is detectable from the fragment alone |
| Fetch during the build? | No: run by hand | In `build.sh`: CI's "the build changes no tracked file" check would become a network-dependent comparison against GitHub |
| What an emblem is keyed by | The entity's name, lower-cased | `_id`: a character stores plain names, and the emblem must draw with no pack loaded |
| An unmapped name | No emblem (`""`) | A per-kind fallback: a wrong-but-present emblem on someone's homebrew is worse than none |
| Subclasses | No emblem | One per subclass: it is the second half of a class chip and would compete with the class's own |
| An upstream icon with groups or transforms | The fetcher dies, naming it; pick another icon | Half-handling it: swapping a pick costs seconds, a silently mangled glyph an afternoon |
| Artifact size | No size gate; path data kept as published | Coordinate rounding: about 15% smaller, but arc-flag digits are position-sensitive |
| Where the credit appears | Settings (folded) and README §10, both generated or asserted | README only: `fieldbook.html` travels as a lone file |
| Text on an accent fill | `--on-accent`, chosen per palette | A fixed dark brown: 2:1 on classic light's red. `--paper`: 3.6:1 on Humblewood light's ochre |
| The mid-band HP colour | Its own `--warn` token in all four palettes | Reusing `--accent`: on the classic skin it is `--brick`, so two bands would be one colour |
| The web fonts (#144) | Embedded: the three families as base64 woff2 in a generated fragment, `90-fonts.css`, Latin only (Mike, 2026-11-06) | The Google Fonts `<link>`: a third-party URL against constraint 1, and offline the lettering was lost. Latin Extended as well: a second file per family; a letter outside Latin falls back to Georgia for that letter instead (L9357) |

## Open

- The comment in `fetch-icons.js` points at `src/icons/README.md`, which does not exist; the
  `_readme` key in `icons.json` carries that note.
- `settings.skin` is global while `system` is per character, so the skin control in Settings is also
  a system switch for the open character, with no warning that its coins and ancestry list change.
- More: [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Import from the home screen reuses the Load path, skin switching included; `--ink-soft` confirmed in all four palettes (first commit). → ledger L505
- 2026-08-11 — `data-tabs` joins `data-theme`, `data-skin` and `data-rough`, all set by `applyTheme()`. → ledger L1557
- 2026-08-14 — Missing-dependency chips carry a `!`, because the classic `--accent` equals `--brick`. → ledger L1883
- 2026-08-14 — The Hit Dice panel takes the inset `::before` frame so it wobbles with the HP panel. → ledger L2151
- 2026-08-14 — `--warn` added to all four palettes for the current-HP colour bands. → ledger L2212
- 2026-08-18 — Emblems: 78 game-icons.net glyphs through `icons.json` → `fetch-icons.js` → `05-icons.js`, credited in Settings and README §10. → ledger L3289
- 2026-09-24 — A `ui` kind for the combat button's crossed swords; `docs.js` splits `KINDS` from `DATA_KINDS`. → ledger L3397, #9, #10, #11
- 2026-09-28 — The emblem's path and class are `esc()`'d like every other attribute value. → ledger L3940
- 2026-10-09 — The emblem coverage check walks `homebrew` and `srd52`; the private suite covers the four private packs. → ledger L5426, #85
- 2026-10-24 — `--lu-night`, `--lu-night-2`, `--lu-glow` and `--lu-spark` for the level-up scene, one
  violet-night value per skin shared by light and dark; the card's class line and banner number move
  to `--body` so a "1" doesn't read as "I". → ledger L6840, #101
- 2026-10-24 — Corrected: Humblewood's scene tokens are on `:root`, not `html[data-theme]`. → ledger L6928, #101
- 2026-10-25 — `--hb-healthy`, `--hb-injured`, `--hb-bloodied`, `--hb-near` and `--hb-empty` join `:root`, one set for all four palettes, for the initiative tracker's health bands. → ledger L7097, #91
- 2026-10-25 — `--on-accent` joins every palette and the rail; every rule with text on an accent fill uses it. → ledger L7401, #47
- 2026-10-28 — The emblem coverage check walks `srd52` alone; homebrew's moves to the private suite with the pack. → ledger L7858, #125
- 2026-11-04 — `--sheet`, `--sheet-edge`, `--sheet-lift`, `--sheet-gutter` and `--parch` join every palette, and the parchment ink each skin, for the journal's page styles. → ledger L8699, #167
- 2026-11-06 — `applyTheme()` repaints the header alone (`renderSheetHead()`), now that `renderClassRace()` also redraws what a grant touches; the stale `#craceWord` line is gone. → ledger L9101, #153
- 2026-11-06 — The fonts are embedded, Latin only: `scripts/fetch-fonts.js` writes `90-fonts.css` with the OFL notices and text; the Google Fonts link is gone, and a guard checks the page loads nothing from a third-party address. → ledger L9357, #144
- 2026-11-06 — After review: `.hcard-name` asks for 900, the weight it drew at online; `docs.js` checks every weight and each face's sha256; the fetcher retries Google's `/l/font?kit=` answer and refuses `</style`. → ledger L9416, #144
