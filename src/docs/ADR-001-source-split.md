# ADR-001: Split the source into modules, but keep shipping one file

**Status:** **Implemented** 2026-08-07. See "As built" at the end for where the execution differs
from the sketch below.
**Date:** 2026-08-07

## Context

`fieldbook.html` is a single self-contained file (HTML + CSS + JS). It has grown large enough that
finding and maintaining code in one file is friction. We want a module-per-area source layout —
`common.js`, `sheet.js`, `spells.js`, `inventory.js`, … — without giving up the core property that
the app runs on any device by just opening a file, with **no server**.

The constraint that drives the decision: over the `file://` protocol (double-clicking the app),
browsers use an opaque origin, which **blocks ES modules** (`<script type="module">` /
`import`/`export`) and **blocks `fetch()`**. Loading several plain `<script src="…">` files from
`file://` is inconsistent across browsers and especially fragile on mobile and from folder-based
opens. So multi-file *delivery* is out.

Our JS is already all top-level function declarations and top-level `const`/`let` in one shared
global scope — there are no module boundaries to untangle. That makes a **concatenation** approach
essentially mechanical.

## Decision

**Split the source; build back to one file.**

- Source of truth becomes a `src/` tree of plain `.js` (and optionally `.css`) fragments.
- `build.sh` concatenates the fragments **in order** and inlines them into a single
  `fieldbook.html` (the build artifact we ship — unchanged in behavior and still one file).
- No `import`/`export`, no bundler, no `type="module"`. Just ordered concatenation into the existing
  `<script>` block. This is what keeps `file://` working everywhere.
- The release process is unchanged: cut a version, run `build.sh`, zip, ship.

## Target layout (suggested — final boundaries are the implementer's call)

```
fieldbook.template.html   HTML shell with two markers: <!--@@CSS@@--> and //@@JS@@
src/
  css/                    (optional CSS split, concatenated into <style>)
    *.css
  js/                     concatenated into <script> IN THIS ORDER
    00-constants.js       APP_VERSION, CHANGELOG, UPDATE_REPO, lookup tables
                          (ABIL, SKILLS, BIO, SCHOOL…), tiny helpers (num, esc, uid, fmt)
    10-model.js           blankChar, migrate, character state, contributions, effects/sumFx
    20-rules.js           rules load/merge/dedup/fetch, sources, manifest include
    30-compute.js         recompute + all math: abilities, saves, skills, AC/armor, attacks, spell DC
    40-sheet.js           Sheet tab renders: portrait, vitals, HP, features, familiars, statuses, resources
    50-spells.js          spell form, detectSpellAttack, casting, Active Spells, browseSpells
    60-inventory.js       inventory sections, item form, armor parsing, browseItems
    70-ui.js              tabs, ToC flyout, modal, toast, settings, home/library, changelog, update check, theme
    90-boot.js            wire(), boot(), and the boot() invocation LAST
```

## Concatenation rules (critical)

1. **Cut, don't reorder.** Fragments must concatenate to the *same top-to-bottom order* as the
   current file. Function declarations are hoisted, but top-level `const`/`let` are not (temporal
   dead zone), and some top-level statements run at load (e.g. `const modal =
   document.getElementById(…)`, DOM listeners). Preserving original order guarantees correctness.
2. **`boot()` runs last.** The call that starts the app must be the final line of the last fragment.
3. **One `<script>` and one `<style>`.** Concatenate all JS into the single script block and all CSS
   into the single style block via the template markers. Don't emit multiple script tags.
4. **No new globals or wrappers.** Don't wrap fragments in IIFEs or add `"use strict"` per file —
   that would change scope. It's one shared scope, exactly as today.

## Acceptance test (must pass before this is considered done)

- Extract the JS from the freshly built `fieldbook.html` and from the pre-split app; they must be
  **identical except for insignificant whitespace at fragment joins**. Same for CSS. In other words,
  the split is a pure refactor — the shipped file is byte-for-byte equivalent (normalize trailing
  whitespace/newlines before diffing).
- `build.sh` still passes: `node --check` on the built JS, JSON validation, changelog regen, zip.
- Manual browser smoke-test from `file://` on desktop and a phone: app opens and works with no server.

## Consequences

- **Mental model changes:** `src/` is the source; `fieldbook.html` is a generated artifact. Never
  hand-edit the built file — edit fragments and rebuild. `.gitignore` may keep the built file out of
  version control (or commit it only as part of a release).
- Easier navigation and smaller diffs per change; the build gains a concat step (cheap, no deps).
- One added discipline: never ship a stale build. `build.sh` should fail loudly if `src/` is newer
  than a committed `fieldbook.html`, or simply always rebuild before zipping.

---

## As built (2026-08-07)

The decision above stands unchanged. These are the places the execution differs from the sketch,
and why.

**Layout.** Build outputs live in `dist/`, not the repo root:

```
src/   fieldbook.template.html · manifest.json · js/ (22 fragments) · css/ (7) · tests/ · docs/
dist/  fieldbook.html (tracked) · fieldbook-v<version>.zip · <system>_full.json · .buildstamp (all ignored)
```

`dist/fieldbook.html` stays **tracked**, not gitignored: it is the release artifact, the file the
in-app update badge points players at, and the reference the builder's clobber guard compares
against. Safe to relocate because the app makes no relative-path requests — its only two `fetch()`
calls are the GitHub releases API and user-configured rules URLs; `data/*.json` arrives via a file
picker. The **zip's internal layout is unchanged** (`fieldbook.html` at the zip root next to
`data/`), so README section 9 still describes what players download.

The template lives at `src/fieldbook.template.html` rather than the repo root — it is source, and
root now holds no build inputs or outputs.

**Markers.** `/*@@CSS@@*/` and `//@@JS@@`, not the `<!--@@CSS@@-->` sketched above: an HTML comment
inside `<style>` is not a CSS comment. Real comments keep the template itself syntactically valid.

**Ordering is a manifest, not a glob.** `src/manifest.json` lists both blobs in order. A sorted glob
would silently concatenate a stray `50-x.OLD.js` (this repo accumulates `*.OLD.*` scratch files) and
still pass `node --check`. The build hard-fails on drift in **both** directions — listed-but-missing
and present-but-unlisted.

**Fragment boundaries are positional.** Rule 1 ("cut, don't reorder") means fragments are contiguous
slices of the original file cut at its own banner comments, so they cannot match the concern-grouped
file list sketched above — the original interleaves those concerns. Notably **`APP_VERSION` and
`CHANGELOG` live in `src/js/30-version.js`**, not `00-constants.js`: they sit at original line ~1155
and moving them would have been a reorder.

**Acceptance was stronger than required.** The "identical except for insignificant whitespace" bar
above was met as **byte-for-byte identity**: the first build reproduced the committed file exactly
(280,473 bytes, sha256 `adef1ec3…`), and git records the relocation as a pure rename. Because the
shipped bytes are unchanged, no `APP_VERSION` bump was needed and no functional QA was owed for
build #1. The mechanism is documented in `scripts/build-html.js`: every fragment ends in exactly one
`\n`, and the builder splices out each marker token *plus its trailing newline*.

**Staleness is handled by content hash, not mtime.** mtimes don't survive `git checkout`/`clone`, so
they give both false alarms and false all-clears. `build.sh` always rebuilds (step 1);
`node scripts/build-html.js --check` is the separate stale gate for a pre-commit hook or CI.

**Also fixed in passing:** the committed `build.sh` parsed under zsh but not under bash, which is
what its own shebang selects — the apostrophe in `app's`, inside a heredoc nested in a `$(…)`
command substitution, opens a quote bash never closes. Run as `./build.sh` it validated JS and JSON,
then died at the changelog step (exit 2), so the zip was never produced by that path. Moving the
block to `scripts/gen-changelog.js` makes it interpreter-agnostic. The ledger has the measured
before/after.
