# Rich text

Nearly every run of prose the app renders goes through one pipeline, whether a player typed it or
a rules pack shipped it: escape everything, then add the tappable glossary and table chips
(`highlight()`), then lay a small markdown grammar on top (`noteInline()` inside `noteHTML()`).
**The order is the security argument.** After `esc()` the only angle brackets left are tags the app
wrote itself, which makes it safe to hold those tags aside while the markdown regexes run over the
rest. One grammar serves every field, so no field quietly supports less formatting than the one
beside it. The same argument covers the markup the app builds around that prose: **every value
interpolated into an HTML attribute is `esc()`'d**, and every image source is a data: URL, both
checked mechanically.

**Code:** `esc()`, `escReg()`, `safeImgSrc()`, `imgHTML()`, `allGlossary()` in `00-constants.js`; `highlight()`, `descHTML()`,
`renderRT()` in `10-compute.js`; `findTable()`, `tableHTML()`, `openTableByName()`,
`tableChipsHTML()` in `86-tables.js`; `noteInline()`, `noteHTML()`, `richHTML()`, `richInline()`,
`notePreview()` in `87-notes.js`; `printSheet()`, `printStrip()` in `71-char-io.js`;
`refreshRulesUI()` in `88-settings.js` · **Tests:** `tables.js` (escaping, forged placeholders,
chips inside markdown), `sheet.js` (the renderers, no sentinel leaks; a hostile character, pack and
keyword id through 40 renderers), `rules-data.js` (every attribute interpolation `esc()`'d, every
image through `safeImgSrc()`; run-in panes call `richInline()`, no mid-sentence breaks in
Humblewood prose) ·
**See also:** [Story & notes](../features/story-and-notes.md),
[Rules & tables](../features/rules-and-tables.md), [Humblewood](../data/humblewood.md),
[Build & source split](build-and-source-split.md)

## How it works

**1. `highlight(text)`: escape, then chips.**

1. Lift every `[Table: Name]` anchor out *first*, replacing it with `TBL_MARK` (U+E000) and keeping
   the name raw. This happens before escaping, so the name stays exact for the lookup, and before
   the glossary pass, which would otherwise chew through a table name like "Damage Types".
2. `esc()` the rest (`& < > " '`).
3. The glossary pass. Every term in `allGlossary()` (pack keywords plus the character's own
   glossary) is escaped, regex-escaped, and sorted longest first into one case-insensitive
   `\b(…)\b` pattern. Each hit becomes `<span class="kw" data-gid=… role="button" tabindex="0">`.
4. Put the anchors back in order. A name `findTable()` resolves becomes
   `<span class="tblref" data-tbl=…>`. Otherwise it reads as plain prose, "the Name table", so no
   dead chip appears when no tables pack is loaded.

A click, Enter or Space on `.kw` opens the glossary entry, and on `.tblref` opens the table
(`90-boot.js`).

**2. `noteInline(raw)`: inline markdown on top.**

1. Run `highlight(raw)`.
2. Hold aside every tag matched by `/<[^>]+>/g`. This is an **exact** matcher, not a heuristic,
   because `esc()` removed every `<` the author wrote. Each tag becomes an indexed placeholder, U+E001
   + base-36 index + U+E002.
3. Hold `` `code` `` spans as `<code>` first, so nothing inside code is emphasised.
4. `**x**` becomes `<strong>`.
5. `*x*` becomes `<em>` only when the content starts **and** ends with a non-space, and the opening
   `*` is not preceded by another. An asterisk followed by a space can therefore only *close*, and
   two closers never pair.
6. Soft line breaks (U+E003) become `<br>`.
7. Restore the held tags, over up to eight passes, because holds nest: a code span can swallow an
   already-held chip.

**3. Blocks, and the entry points.**

- `noteHTML(text)` normalises CRLF and **strips U+E000–U+E00F from the input**, so nobody can type a
  placeholder, `TBL_MARK` included. It then reads lines: `---`/`***`/`___` becomes a rule (checked
  before bullets, so `* * *` is a rule), `#`…`######` a heading, `-`/`*`/`+` a list, `1.`/`1)` a
  numbered list that keeps its start, `>` a quote, and anything else a paragraph. The lines of one
  block are joined with U+E003 so each block costs **one** `noteInline()`/`highlight()` call.
- `richHTML(text)` is `noteHTML()` with a **lone** `<p>` unwrapped. Hundreds of `.desc` slots get
  bare inline text, and a `<p>` there would pick up browser margins. Blocks appear only when the
  text actually contains a list, heading or quote.
- `richInline(text)` is inline only, never a block. It exists for run-in headings,
  `<p><b>Trait.</b> …</p>`, where a block element would nest inside the `<p>`, the parser would close
  it early, and the layout would come apart.
- `descHTML()` is the name the description call sites use, and it delegates to `richHTML()`.
- `notePreview()` renders the hover card inside a note's `<button>`, whose content model is
  *phrasing* only. It truncates the **source**, never the rendered HTML (which would cut tags in
  half), represents the block markers (`• `, a heading without hashes, `—` for a divider), renders
  through `richInline()`, then unwraps the chips to plain words. A `role="button"` inside a button
  is invalid, and a hover card is a trap for anything you reach for.

**Which surface uses what:**

| Surface | Renderer |
|---|---|
| Section notes (the Notes tab and each card's note) | `noteHTML()` |
| Story bio fields and Proficiencies (`renderRT()`) | `richHTML()` |
| Feature, item, status and familiar descriptions; browse previews; the spell view | `richHTML()` / `descHTML()` |
| Trait lines in the class, subclass, species and background panes | `richInline()` |
| A note's hover preview | `notePreview()` |
| Glossary entry view (`openGlossView()`) | `esc()` only; line breaks come from `.m-body p`'s `pre-wrap`. An image entry goes through `imgHTML()` |
| The portrait (`renderPortrait()`), the glossary form's preview (`openGlossForm()`) | `imgHTML()` |
| Table cells (`tableHTML()`) | `esc()` only |
| A modal's title (`openModal()`) | None: it is set as `textContent`, so it is passed as written and never `esc()`'d, or its entities show ([Shell](../ui/shell.md)) |
| Print (`printSheet()`) | `esc()` plus `printStrip()` for 5e-tools `{@tag …}`; markdown markers print as typed |

**4. Attribute values and images.** Prose is one way in; the markup around it is the other. A
template literal assigned to innerHTML carries ids, names, dice and numbers from a character file, a
rules pack or a settings file (its pool is rebuilt through `mergeRules()`, which gives keywords
fresh ids but keeps every other value the file had), and a raw `"` in any of
them closes its attribute. So every `${…}` inside a quoted attribute value is `esc(…)` of the whole
expression, or a ternary whose two results are literals (`${on?"on":""}`), whatever the value looks
like. An `<img>` built from data comes only from `imgHTML(u, alt)`, which returns `""` unless
`safeImgSrc(u)` accepts it: a data: URL of any media type, trimmed, scheme matched case-blind.
Everything else is refused: javascript:, relative paths, and web addresses, which would be a network
request beyond the rules fetch and the update check. Portraits and glossary images are only ever
written by `FileReader.readAsDataURL`, so nothing real is refused. A refused portrait shows the
placeholder; a refused glossary image says it isn't stored in the file.

**CSS follows the renderer.** `.item .desc` and `.rt-view` no longer set `white-space:pre-wrap`,
because with real `<br>` elements that would double every break. `.m-body p` keeps it, which is
safe because the renderer consumes every newline. `.n-body p`, `.desc p` and `.rt-view p` share
paragraph margins, and `code` is styled on the element, since only this renderer ever emits it.
Editing the glossary changes how every note reads, so `refreshRulesUI()` re-renders the notes too.

## Rules that must hold

- **Escape first, markup second.** Every renderer reaches markup only through `highlight()`, which
  runs `esc()` before anything else. Running markdown *before* the glossary pass is unsafe the
  other way: a term such as "strong" would match inside a `<strong>` just written. Running it after
  without holding the tags lets a `*` inside a `data-tbl` attribute be eaten.
- **Every attribute value `highlight()` writes is `esc()`'d**, the glossary id in `data-gid`
  included. A raw `>` inside an inserted tag would break the exact `/<[^>]+>/g` hold.
- **Every `${…}` inside a quoted HTML attribute value in `src/js` is `esc(…)` of the whole
  expression, or a ternary that can only yield a literal** (asserted over all of `src/js`, about
  350 sites). No exceptions list: constants are escaped too, where `esc()` is the identity. A CSS
  attribute selector built for `querySelector` (`[data-x="${k}"]`) is not markup and is exempt; an
  unquoted `attr=${…}` is refused.
- **Every image source is `esc(safeImgSrc(…))`**, which in practice means every `<img>` comes from
  `imgHTML()` (asserted).
- **Text between tags that comes from a file is `esc()`'d or goes through a renderer above.** The
  scan cannot see this; the hostile-character renders in `sheet.js` do.
- **Sentinels live in U+E000–U+E00F and are written as escapes** (`""`,
  `String.fromCharCode(0xE001)`), never as literal characters. Invisible bytes in source are one
  whitespace cleanup away from changing behaviour, and the build is byte-exact. The strip in
  `noteHTML()`/`richInline()` covers exactly that range, so a new sentinel must come from it.
- **Placeholders are indexed**, not the single repeating `TBL_MARK` idiom, because the markdown
  pass nests and ordinal restore-in-order does not hold there.
- **One `highlight()` per block, not per line.** Each call rebuilds and sorts the glossary and
  compiles a fresh RegExp, and the Notes tab can render nineteen notes at once.
- **Run-in panes call `richInline()`, never a block renderer** (asserted).
- **Emphasis needs non-space at both ends,** or the Humblewood footnote asterisks ("divert power\*",
  "cymatic sight\*") pair up and italicise the sentence between them.
- **Deliberately unsupported:** links (they point at a network, in an offline-first app, and read
  confusingly beside `[Table: X]`), `_underscore_` emphasis (it collides with snake_case), nested
  lists, and pipe tables.

## Traps

- **Three renderers, three grammars.** `highlight()` alone once served the Story fields, with no
  markup and not even line breaks. `descHTML()` did bold only, and `noteHTML()` everything. The
  field literally called Notes on the Story tab formatted nothing, and 68% of pack descriptions
  rendered their newlines as one run-on blob. That is why there is now one grammar with several
  entry points.
- **The old reason for bold-only was real.** Single-asterisk emphasis paired Humblewood's footnote
  markers (415 asterisks in that pack). It was fixed in the rule itself, not by keeping italics out,
  and re-checked over 19,156 strings across all five packs: zero spurious italics, zero spurious
  blocks.
- **Newlines in pack data now render.** A stray `\n` mid-sentence from the Humblewood extractor
  shows as a line break. Treating italics as structure broke Gadgeteer features mid-sentence ("as if
  you had cast the\nidentify spell"), and was caught only by scanning the data. The scan is now a
  test across every Humblewood file, and the extractor's tagline rule is positional, never
  stylistic.
- **The first drafts embedded real private-use bytes.** Both the notes sentinels and `descHTML()`'s
  were rewritten as escapes. The test that asserted the escape form went with `descHTML()`'s own
  sentinels, so nothing guards this now. `src/js/` has no literal private-use characters today
  (checked for this page).
- **A known loss:** `**Hit** Points` loses its *Hit Points* chip, because the asterisks break
  `\b(term)\b`. That is inherent to escaping first and matching second.
- **Ids look like app data and are not.** They come from `uid()` when the app makes a row, and
  straight from the file when a character is imported. Forty-odd `data-*` hooks carried them raw,
  and `highlight()`'s own `data-gid` did too, while this page claimed every attribute it wrote was
  escaped. That is why the rule is total rather than "escape the untrusted ones".
- **Three image sources were raw** (portrait, glossary view, glossary form) until the rule above;
  the same audit found pack ability keys, a class's hit die, the pack name in Settings and a few
  numbers-that-weren't going in raw as well (ledger L3940).
- **A regex over the source cannot find attribute values.** `class="a ${x?"b":"c"} ${id}"` hides the
  second value behind the first one's quotes, and `87-notes.js` has a regex literal full of
  backticks. The guard in `rules-data.js` is a small tokenizer (strings, comments, regex literals,
  nested templates) for that reason; it tests itself on both shapes.
- **Renderers rewrite what they draw.** `renderSpells()` sets `s.level=num(s.level)` in place and
  `autoSlots()` rewrites slot totals, so a hostile value can be defused by an earlier render. The
  behavioural tests give each sink a fresh value.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Order of markdown and glossary | Escape, then glossary chips, then markdown with the tags held aside | Markdown first: a term like "strong" matches inside a `<strong>` just written. Markdown after without holding: a `*` inside a `data-tbl` attribute gets eaten (L1504) |
| Placeholder style | Indexed holds | The single repeating `TBL_MARK`: the pass nests, so restore-in-order breaks (L1504) |
| How many `highlight()` calls | One per block, lines joined by a sentinel | Per line: ~10³ regex compilations in one render of the Notes tab (L1504) |
| How sentinels appear in source | `String.fromCharCode`/`\u` escapes | Literal private-use characters: invisible, one cleanup away from a silent change in a byte-exact build (L1504, L2519) |
| Italics in pack descriptions | Allowed, with emphasis that cannot open on "`* `" | Keeping descriptions bold-only (`descHTML()` in L2519): fixed at the rule instead, so every field shares one grammar (L3035) |
| A one-paragraph rich field | Unwrap the lone `<p>` | Always wrapping: spaces out every item, status and feature in the app for no gain (L3035) |
| What a note preview can contain | Phrasing markup, block markers represented, chips unwrapped | Flattening to one line: markers vanished with no sign they worked. Block markup: illegal inside a `<button>` (L3035) |
| Markdown links | Not supported | Links: they point at a network in an offline-first app, and read confusingly beside `[Table: X]` (L1504) |
| Extending the Gadgeteer's italic fix to every Humblewood extract | Only the positional tagline rule | A blanket `prereq` rule: italics also mark inline spell names, so it breaks sentences (L2538) |
| Which attribute values are escaped | All of them, checked mechanically | Only the untrusted ones: not checkable by a scan, and ids, which look internal, come from the file (L3940) |
| Which image sources load | data: URLs only, any media type | Also `https:` for pack images: a network request beyond the two the app makes, the schema says data URL, and no shipped pack has an image. `data:image/` only: FileReader labels an untyped file octet-stream, and an `<img>` runs no script whatever it holds (L3940) |
| How the guard finds attribute values | A tokenizer over `src/js` | A regex over the source: defeated by an earlier `${…}` holding quotes, and by a regex literal holding backticks (L3940) |

## Open

- The attribute rule does not reach markup emitted in **tag position** on purpose
  (`<option${sel?" selected":""}>`, `${chooseAttr}`), which only the behavioural tests cover.
- The comment block above `descHTML()` in `10-compute.js` still describes the old bold-only
  renderer, and a comment in `20-cards.css` still says `.rt-view` is `pre-wrap`. Both are stale.
- `tables.js` holds four literal private-use characters, in the strings and one regex of its
  sentinel tests. It is a test file, outside the byte-hygiene checks.

See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-11 — Section notes get markdown layered on top of `highlight()`, with escape-first ordering as the safety argument. → ledger L1504
- 2026-08-15 — `descHTML()` becomes `highlight()` plus `**bold**` only, for Gadgeteer run-in headings. → ledger L2519
- 2026-08-15 — Italics-as-structure is rejected for other Humblewood extracts, and a data scan for mid-sentence breaks becomes a test. → ledger L2538
- 2026-08-18 — One grammar for every field: `richHTML()` and `richInline()` arrive, `descHTML()` delegates, emphasis needs non-space at both ends, and the note preview renders phrasing markup. → ledger L3035
- 2026-09-28 — Every attribute interpolation is `esc()`'d and every image goes through `imgHTML()` (data: URLs only), both guarded; the audit's other raw values fixed. → ledger L3940
- 2026-09-28 — A modal title is text, never `esc()`'d (guarded); the one escaped title fixed. → ledger L4086, #69
- 2026-09-28 — A settings file's pool no longer goes in raw: it is rebuilt through `mergeRules()`, so its keyword ids are the app's. → ledger L4134, #70
