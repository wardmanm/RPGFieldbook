# Theming & icons

Fieldbook has two **skins**, Humblewood and Classic D&D, each in **light** and **dark**, plus an
optional hand-drawn wobble on every frame. The skin is not a free choice: it follows the open
character's system. All of it is driven by four attributes on `<html>` and the CSS custom
properties in `00-tokens.css`. The same page covers the **emblems**, 79 glyphs from game-icons.net
beside classes, ancestries and backgrounds and on the combat button. They come from a hand-authored
map through a fetch script into a generated fragment, and they carry CC BY 3.0 obligations the app
has to meet on its own.

**Code:** `applyTheme()`, `skinForSystem()`, `systemForSkin()` in `75-home-theme.js` · `raceTerm()`,
`racesForCharacter()` in `52-race.js` · `iconSVG()`, `iconSlug()` in `50-classrace.js` ·
`GAME_ICONS`, `ICON_MAP`, `ICON_ARTISTS` in `05-icons.js` (generated) · the credits in
`88-settings.js` · `scripts/fetch-icons.js` · `00-tokens.css`, the `::before` frames in
`20-cards.css` and `30-sheet.css` · **Data:** `src/icons/icons.json` ·
**Tests:** `docs.js` (map against fragment, path-data charset, coverage of shipped names, CC BY),
`sheet.js` (`iconSVG()` lookups), `rules-data.js` (`--warn` in every palette, the `data-tabs`
default) · **See also:** [Shell](shell.md), [Settings & updates](../features/settings-and-updates.md),
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
"D&D / Character Sheet"), `document.title`, the Race/Ancestry word in the origin card's heading
(`#craceWord`, via `raceTerm()`) and the sun/moon glyph on the theme button. It then redraws the
class and ancestry chips, whose labels use the same word. It runs at boot, on every character load,
create and import, and on each Appearance control.

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
`--accent`, `--accent-2`, `--brick`, `--warn`, `--field`, `--field-focus`, `--shadow` and
`--ground`. The fonts are `--display` (Grenze Gotisch; Cinzel on the classic skin), `--head`
(Cinzel) and `--body` (EB Garamond). They load from Google Fonts through a `<link>` in the template,
and each stack falls back to Georgia or Times New Roman, which is what renders offline. Most text on
an `--accent` fill is a fixed `#20160a` in both themes (primary buttons, selected segments and
pills). Print ignores the tokens: `#printArea` is forced to black on white. `prefers-reduced-motion`
switches every animation and transition off (`50-modal.css`).

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

**Why `d` is interpolated without `esc()`.** Every glyph was checked against the path-data charset
(`[-0-9.,eE MmLlHhVvCcSsQqTtAaZz]`) before it was written, and `docs.js` re-checks the committed
fragment against the same charset. The name never reaches the output (it is only a lookup key), and
`kind` only selects a map. The third argument, a class name, is also unescaped, and every caller
passes a literal (`"lg"`, `"cvicon"`).

### The licence

CC BY 3.0 asks for three things: name the artists, name and link the licence, and say the work was
changed. Removing the background square and the fill is the change. All three appear in two places:

- **In the app**, Settings → Credits & licences (folded by default), built from `ICON_ARTISTS`, so
  the credit cannot drift from what is vendored.
- **In [README §10](../../../../README.md)**, which ships in the zip.

`docs.js` checks the README for game-icons.net, "CC BY 3.0", the licence URL and "background
square was removed", and `88-settings.js` for `ICON_ARTISTS`, "CC BY 3.0" and "background square was
removed".

## Rules that must hold

- **Never hand-edit `05-icons.js`.** Edit `icons.json`, run `node scripts/fetch-icons.js`, and
  commit both. `docs.js` fails if the slugs in the map and the fragment differ in either direction,
  and its message names the command.
- **The fetch is never part of the build or CI.** CI asserts that a build changes no tracked file,
  and a network fetch would make that depend on GitHub. `build.sh` also bans `fetch-icons.js` from
  the zip.
- **Emblems are keyed by name, lower-cased, never by `_id`.** This is the "keep working with no pack"
  property.
- **Subclasses get no emblem** (`docs.js` asserts `icons.json` has no `subclasses` block).
- **Every shipped class, race and background has an emblem.** `docs.js` walks `data/5e2024`,
  `humblewood`, `xanathars`, `tashas` and `homebrew`, so a **data-only** change that adds a name
  turns the docs suite red until `icons.json` gains a line and the fetcher is re-run.
- **The kinds list lives in three places** and moves together: `KINDS` in `fetch-icons.js`,
  `KINDS` in `docs.js` (with `DATA_KINDS`, the three that name things in `data/`), and the `kind`
  argument of `iconSVG()`.
- **The path-data charset check stays strict.** Widening it moves the proof of safety onto every
  call site.
- **The credits stay in the app**, because `fieldbook.html` is shared as a lone file that no README
  follows.
- **Every palette defines every token.** `rules-data.js` asserts that `--warn` appears as often as
  `--brick`. A token missing from a classic block would quietly fall back to the Humblewood value.
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

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where the emblem map lives | In the app: `src/icons/icons.json`, generated into `05-icons.js` | In `data/`: converter output is overwritten whole by `_write()`; `data/5e2024/` must reproduce byte for byte; and `release.js` would bump `dataVersion`, telling every player to re-download five packs for a cosmetic change |
| Keep the `.svg` files? | No: the generated fragment is the vendored artwork | 78 SVGs plus a second offline generator: buys nothing, since the only possible drift ("edited the map, forgot to re-fetch") is detectable from the fragment alone |
| Fetch during the build? | No: run by hand | In `build.sh`: CI's "the build changes no tracked file" check would become a network-dependent comparison against GitHub |
| What an emblem is keyed by | The entity's name, lower-cased | `_id`: a character stores plain names, and the emblem must draw with no pack loaded |
| An unmapped name | No emblem (`""`) | A per-kind fallback: a wrong-but-present emblem on someone's homebrew is worse than none |
| Subclasses | No emblem | One per subclass: it is the second half of a class chip and would compete with the class's own |
| An upstream icon with groups or transforms | The fetcher dies, naming it; pick another icon | Half-handling it: swapping a pick costs seconds, a silently mangled glyph an afternoon |
| Artifact size | No size gate; path data kept as published | Coordinate rounding: about 15% smaller, but arc-flag digits are position-sensitive |
| Where the credit appears | Settings (folded) and README §10, both generated or asserted | README only: `fieldbook.html` travels as a lone file |
| The mid-band HP colour | Its own `--warn` token in all four palettes | Reusing `--accent`: on the classic skin it is `--brick`, so two bands would be one colour |

## Open

- The template's Google Fonts `<link>` is a third-party URL in the shipped file, which CLAUDE.md's
  constraint 1 forbids adding. It has been there since the first commit, and offline the font
  stacks fall back to local serifs.
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
