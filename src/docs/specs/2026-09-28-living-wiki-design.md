# Living wiki — design

**Status:** approved and built on branch `docs/living-wiki` · 2026-09-28 — see [As built](#as-built) for
where the result differs from this text
**Scope:** dev documentation and one project skill. No app change, so no `UNRELEASED.md` bullet and
no release.

---

## 1. What it is

A set of topic pages under `src/docs/wiki/` that describe **how Fieldbook works now**, kept current by
the same change that alters the behaviour, plus a project skill that tells Claude how to maintain them.

Why: [WIRING-LEDGER.md](../_claude/WIRING-LEDGER.md) is 3,707 lines in date order. It is a good log and
a poor reference: what is true about spells is spread over 11 entries between L179 and L3169, and a
reader has to replay them in order to know which one won. CLAUDE.md (422 lines) has grown into a
reference manual as well as a rulebook, and all of it loads into every session. The 2.0 refactor needs
a clean "before" picture — the behaviour to keep, the invariants that are load-bearing, and the traps
that have already bitten — and neither file gives one.

The ledger does not go away. It stays the append-only log; the wiki is what the log has been compiled
into.

## 2. Decisions

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Where the wiki lives | `src/docs/wiki/`. `build.sh`'s bundle guard bans every `^src/` path, so it can never ship | `docs/` (an allowlist of three files, and it ships to players); a GitHub Wiki (a separate repo, so a page could not change in the same commit as the behaviour it describes) |
| 2 | The existing dev docs | **Indexed where they are**, not moved. `RELEASING.md`, `WORKTREES.md`, `ADR-001` and `HUMBLEWOOD-PLAYTESTS.md` are named by `build.sh`, `dev.sh`, `ci.yml`, `build-html.js`, `extract-humblewood.py` and `src/tests/docs.js` | Moving them into `wiki/`: churn in six tooling files for no reader benefit. Can be revisited in 2.0 |
| 3 | The ledger | Stays, append-only, `merge=union`. New entries get shorter: what changed, why, and a link to the page that now describes it | Retiring it: every page's History section cites it, and it is the only record of *why* in date order |
| 4 | How pages are cut | **By concept** — the thing a player or developer would name | By tab: concentration, attacks and the combat view all cross tabs. By fragment: fragments are positional slices of the original file (ADR-001), so their boundaries do not follow concepts |
| 5 | Where decisions are recorded | In the page they govern, as a **Decisions table** in this spec's format (question · decision · rejected and why), plus a one-line-per-decision register page | One ADR file per decision: ~30 files, separated from the behaviour they explain. ADR files stay for cross-cutting architecture only; ADR-001 is the only one today |
| 6 | Code references | Function and fragment names, never line numbers. The lint test (§7) checks that each one still exists | Line numbers: stale on the next edit above them |
| 7 | Links | Plain relative markdown links. They render on GitHub and in VS Code | `[[wikilinks]]`: they render as literal brackets on GitHub |
| 8 | The skill | `.claude/skills/wiki/SKILL.md`, **tracked in git** (§6) | A personal skill in `~/.claude/skills/`: it exists on one machine only |
| 9 | Merging | `index.md` gets `merge=union`, since branches only add lines to it. Pages merge normally | `union` on pages: two branches rewriting the same paragraph would silently keep both versions |
| 10 | CLAUDE.md | Slimmed to rules and conventions. It imports the index with `@src/docs/wiki/index.md`, so every session knows what exists without loading all of it | Leaving it as is: the 31 KB loads into every session, and half of it is reference |

## 3. Layout

```
src/docs/wiki/
  index.md              catalog, one line per page, grouped as below. Loaded by CLAUDE.md
  overview.md           what Fieldbook is, the constraints, a code map, a glossary of project terms
  decisions.md          register: every recorded decision, one line each, linking to where it lives
  architecture/         cross-cutting mechanisms (7 pages)
  features/             what a player can do (16 pages)
  ui/                   the shell and the conventions every tab shares (3 pages)
  data/                 where the rules packs come from (4 pages)
  process/              how work is built, tested and checked (3 pages)
  roadmap/              what's open, and 2.0 (2 pages)
```

Existing docs indexed in place: [RELEASING.md](../RELEASING.md), [WORKTREES.md](../WORKTREES.md),
[ADR-001](../ADR-001-source-split.md), [HUMBLEWOOD-PLAYTESTS.md](../_claude/HUMBLEWOOD-PLAYTESTS.md),
[UNRELEASED.md](../UNRELEASED.md), [specs/](../specs/), [plans/](../plans/), and the player-facing
[rules-schema.md](../../../docs/rules-schema.md) and [README-converter.md](../../../docs/README-converter.md).
Pages link to the player docs and do not restate them.

## 4. Page template

```markdown
# <Topic>

One paragraph: what this is, for someone who has never seen it.

**Code:** `fnName()`, `otherFn()` in `NN-fragment.js` · **Data:** … · **Tests:** `suite.js` ·
**See also:** [page](../x/page.md)

## How it works
Present tense. The current behaviour, not how it got here.

## Rules that must hold
The invariants — what a refactor must preserve, and why.

## Traps
What has already gone wrong, and the guard that now catches it.

## Decisions
| Question | Decision | Rejected, and why |

## Open
Known limitations and deferred work, linking to roadmap/known-issues.md.

## History
- 2026-08-17 — one line. → ledger L2893, #37
```

Empty sections are dropped rather than left with "none". A claim that could not be checked against
the code is marked **(unverified)**, not omitted.

## 5. Pages

What each page covers, and where its material comes from. `L` numbers are ledger lines as of
`facbc78`; the ledger is append-only, so they are stable. Every `##` and `###` section of the ledger is
assigned to at least one page. The compile checks this, so nothing is left behind. A page that turns
out thin can be merged into a neighbour during the compile: what's being approved is the division into
topics, not the count.

### Top level

- **overview.md** — What Fieldbook is, the systems and packs, the three non-negotiables, a code map
  (each fragment → the pages that describe it), and a glossary of project terms: pack, system,
  supplement, sid, grant, provenance, origin, section, skin, stamp, fingerprint. *Sources:* CLAUDE.md
  §What this is, §Non-negotiable constraints, §Repo layout; L341, L1302.
- **decisions.md** — The register. *Sources:* the Decisions tables of every page, ADR-001, the combat
  view spec §2.

### architecture/

- **build-and-source-split.md** — `src/` → `dist/fieldbook.html`: the template markers, the
  manifest, concatenation order and TDZ, byte hygiene, the clobber guard, `--check`, fragment naming.
  *Sources:* ADR-001; CLAUDE.md §Source split; L354, L370, L397, L1262, L2592.
- **storage.md** — localStorage for characters, settings and the library; IndexedDB for the rules
  cache; LZW fallback; timeouts on every IDB call; a failed write must say so. *Sources:* CLAUDE.md
  constraint 2; L1950, L1993.
- **character-model.md** — `blankChar()`, `migrate()` (preserves every field, then normalizes), the
  save→load round trip, the character version stamp, `notes` vs `secNotes`. *Sources:* CLAUDE.md
  §Architecture invariants; L284, L702.
- **rules-packs.md** — Systems vs supplements, loading and merging (`89-rules-merge.js`), `requires`
  and missing-dependency reporting, `dataVersion` / `DATA_VERSIONS`, the rules-source fetch.
  *Sources:* CLAUDE.md §Versioning (DATA_VERSIONS); L625, L1323, L1816, L1883.
- **grants-and-provenance.md** — Source ids (`race:`, `bg:`, `class:`), clean revert, granted gold and
  equipment, `grantFeatDef`, `applyEquipGrants`/`revertEquipmentGrants`, the level-down limitation.
  *Sources:* CLAUDE.md §Architecture invariants; L16, L42, L153, L1444, L2571, L3649 (the equipment
  leak).
- **computed-stats-and-effects.md** — `recompute()`, `contributions()`, `sumFx()`; effects are
  numeric-only and why; `usesMax` formulas. *Sources:* CLAUDE.md §Architecture invariants; L16, L2581.
- **rich-text.md** — `highlight()`, the glossary pass, `[Table: …]` anchors, `descHTML`, `noteHTML`
  markdown layered on top, and the escaping order as the security argument. *Sources:* L1504, L2519,
  L2538, L3035.

### features/

- **home-and-characters.md** — Home screen, character cards, create/delete, export/import,
  import conflicts, backups. *Sources:* L284, L312, L497, L505.
- **character-building.md** — Ancestry, background, class, subclass and feat pickers; `choices` and
  "choose N" enforcement; level-up; option pickers (Battle Master, the 2024 options library).
  *Sources:* L16, L2298, L3548, L3596, L3649.
- **abilities-and-skills.md** — Abilities, saves, skills, expertise, the layout choice (#17).
  *Sources:* L106, L3525 (skills).
- **vitals-and-rest.md** — HP entry, temp HP, max HP lock, the level-1 seed, Hit Dice and their three
  looks, current-HP colour bands, death saves, Rest & Recovery, size. *Sources:* L1174, L1614, L1711,
  L2035, L2105, L3676 (Hit Dice back to Rest).
- **conditions-and-concentration.md** — Statuses and conditions, the Concentrating condition, and
  its mirror on the Spells tab. *Sources:* L2893, L3151.
- **attacks-and-damage.md** — Attacks & weapons, `attackNumbers()`, spell→attack sync
  (`syncSpellAttack`, `detectSpellAttack`), additional damage types, the damage detector, resync
  rules, equipping weapons. *Sources:* L179, L2742, L2850, L2863, L2945, L2989, L3213.
- **class-resources.md** — Resource trackers, the `class-resources.json` overlay, Superiority Die
  size and the Battle Master dice. *Sources:* L3649, L3676; README-converter §overlay.
- **features-and-traits.md** — The features & traits list, feat uses and cost, favourites, search.
  *Sources:* L16, L2381, L2776.
- **spells.md** — Spell list and browser, prepared box, slots, casting and upcast, Active Spells and
  the round counter; slots on level-up follow the rule. *Sources:* L179, L212, L2345, L2429, L2927,
  L3169.
- **inventory.md** — Items, sections and `sectionOverride`, origin and cost, the library, the item
  finder, custom categories, favourites, weight and encumbrance, item uses, coins and the Adjust
  transaction. *Sources:* L42, L74, L153, L229, L256, L276, L1143, L1361, L1444, L2818, L3503, L3525
  (coins, search).
- **armor-and-ac.md** — `itemArmor()`, `armorAC()`, the four armor kinds, shields, armor as a field.
  *Sources:* L239, L3092.
- **story-and-notes.md** — The Story tab's BIO fields, section notes, the Notes tab.
  *Sources:* L1491.
- **rules-and-tables.md** — The Rules tab, glossary browse, reference tables: the `cols` key, anchors,
  `findTable`, folding. *Sources:* L533, L1103, L1219, L1581, L2714, L3189.
- **combat-view.md** — The combat tab: moving the real cards, the tracker, Undo. Links to the spec
  and plan. *Sources:* combat view spec; L3397, L3454, L3470, L3676.
- **rules-update-tool.md** — Fingerprints, `src` stamps, matching, the three rules (never deletes,
  never touches the player's numbers, backup first). *Sources:* CLAUDE.md §Architecture invariants;
  L702, L772, L1116, L2927, L2945.
- **settings-and-updates.md** — Settings sections, rules sources, pack status badges, the update
  pill, the in-app changelog. *Sources:* L302, L331, L527, L1741, L1779.

### ui/

- **shell.md** — Top bar, sticky tab bar, icon tabs, the ☰ ToC flyout, the generic modal (Escape
  guards, focus), the browse picker (`85-browse.js`), `selectTab()` and lowercase tab names.
  *Sources:* L256, L1557, L3470.
- **sections-and-layout.md** — The section registry (`NOTE_SECTIONS`) that notes, the ToC and the
  combat view share; per-tab layout; the collapse, favourite and group-heading conventions;
  familiars; portrait. *Sources:* L2242, L3123, L3525 (section heads).
- **theming-and-icons.md** — Skins follow the system, light/dark, CSS tokens; the emblem pipeline
  (`icons.json` → `fetch-icons.js` → `05-icons.js`) and its licence obligations. *Sources:* L3289.

### data/

- **converter.md** — `convert.py`: subcommands, flags, the `basicRules2024`/`srd52` trap, checking
  counts against full XPHB, the byte-for-byte gate on `data/5e2024/`. Links to README-converter.
  *Sources:* CLAUDE.md §Converter; L320, L625, L1426, L3548 (data half), L3676.
- **supplements.md** — XGE/TCE: the `Book` model, the three traps (`_copy` dedupe, `classVariant`,
  table-name collisions), skipping what core already has. *Sources:* CLAUDE.md §Supplements; L1816.
- **humblewood.md** — `extract-humblewood.py`, verbatim prose, tables, the playtest packets (links
  HUMBLEWOOD-PLAYTESTS), Gadgeteer prose. *Sources:* L11, L904, L990, L1045, L1219, L2484.
- **homebrew.md** — The hand-authored pack, `requires`, why there is no converter. *Sources:* L1883.

### process/

- **building-and-ci.md** — `build.sh`, `--no-zip`, `+dev` naming, the zip allowlist, `ci.yml` (and
  src-only PRs), the git hooks, why there is no source zip. Links to RELEASING for releases.
  *Sources:* CLAUDE.md §Build & validate; L418, L441, L463, L811, L878, L1194, L1276, L2651, L3339.
- **testing.md** — The seven suites and what each guards, the harness, `humblewood-verbatim`, the docs
  suite, and the measurement-bug lessons ("a green check is not proof"). *Sources:* L772, L846,
  L972, L1030, L1232, L3246.
- **screenshot-qa.md** — The Playwright MCP launcher and its flags, seeding state, and the gotchas
  (lowercase tabs, relative filenames, the plugin server). *Sources:* CLAUDE.md §Build & validate item
  4; L3246, L3361.

Indexed in place: RELEASING.md (with L475 and L811 as its history), WORKTREES.md (L2685, L3377).

### roadmap/

- **known-issues.md** — Known limitations, deferred work, data waiting on sources, and the
  "verified NOT gaps — do not fix" list. *Sources:* L1808, L2571, L2581, L3548;
  HUMBLEWOOD-PLAYTESTS §7.
- **2.0.md** — A stub. Goals are Mike's to write; the page holds the invariants 2.0 has to carry,
  open design questions, and links to the 2.0 specs as they are written.

## 6. The skill, and making it travel

**Today `.gitignore` ignores the whole of `.claude/`,** so a skill put there would exist on this machine
only. The fix:

```gitignore
.claude/*
!.claude/skills/
```

The trailing-slash form `.claude/` stops git descending into the directory, so no `!` rule under it can
take effect. `.claude/*` ignores the contents instead, which lets the exception apply. Worktrees,
`qa/` screenshots and `settings.local.json` stay ignored.

Once it is tracked, the skill loads for anyone who opens the repo in Claude Code, whether in the CLI,
VS Code, the desktop app or the web. Each worktree gets it as well, since a worktree is a checkout of
the branch. It cannot reach players: `build.sh`'s bundle guard bans every path starting with `.`, and
the zip is an allowlist anyway. GitHub's auto-generated source archive will include it, which is
intended.

The skill covers three operations:

- **ingest** — After a task or a merge: read the diff, find the affected pages through the code map,
  update them in present tense, add a History line, and update `index.md` if a page was added. It
  can also ingest a spec, a plan, or a range of the ledger.
- **query** — Answer from the wiki first and confirm against the code. If the wiki did not have the
  answer, add it. This is what makes the wiki compound instead of only being maintained.
- **lint** — Run the docs suite, then read the pages against the code and report contradictions,
  stale claims, orphan pages and code that no page covers.

The rule "update the wiki at the end of a task" also goes into CLAUDE.md. CLAUDE.md is always loaded,
whereas a skill fires only when its description matches, so the rule does not depend on the skill
triggering.

## 7. The lint test

This extends `src/tests/docs.js` rather than adding a suite, which keeps the "seven suites" claim true.
Like the rest of that file, it checks facts and not wording:

1. Every `.md` under `src/docs/wiki/` is linked from `index.md`, and every link in the index resolves.
2. Every relative link on every page resolves to a file.
3. Every backticked `name()` on a page is defined somewhere in `src/js/` or `scripts/`, and every
   `NN-name.js` a page cites is in `manifest.json`.
4. **Coverage:** every JS fragment in the manifest is cited by at least one page. A new fragment that
   nobody documented turns the suite red.

Wrong prose is not caught mechanically. That is what the skill's lint pass is for.

## 8. CLAUDE.md afterwards

- **Keeps:** what this is (short), the non-negotiables, where to edit what, build freely / never
  release, the notebook and ledger rules, the invariants as one-line bullets that link to their pages,
  and working style.
- **Moves out:** the repo layout detail (→ overview), the Playwright detail (→ screenshot-qa), the
  converter and supplement traps (→ data/), the source-split detail (→ build-and-source-split), and the
  publishing detail (already in RELEASING).
- **Adds:** the `@src/docs/wiki/index.md` import and the update-the-wiki rule.
- The claims `docs.js` asserts against CLAUDE.md, the fragment counts and the suite count, either stay
  in CLAUDE.md or the test's regexes move with them.
- **Target:** under 150 lines, down from 422.

## 9. Order of work

1. **Scaffold:** the `.gitignore` change, `src/docs/wiki/` with `index.md` and empty pages, the
   `merge=union` line, and the skill.
2. **Compile:** one agent per group (architecture, features ×2, ui, data, process + roadmap). Each gets
   its page list, its ledger ranges and the docs it needs, and is told to check every claim against
   `src/` and mark what it cannot check. Afterwards, check that every ledger section in §5 is cited
   by at least one page's History.
3. **Lint test:** extend `docs.js`, then fix whatever it finds.
4. **CLAUDE.md:** slim it and move the `docs.js` regexes.
5. **Review:** Mike reads the pages, fully or by sampling.
6. **Ledger:** its header gains a line saying the reference now lives in the wiki and the ledger is
   the log.

## 10. Risks

- **The compile states a superseded fact.** This is the main risk. The mitigations are checking every
  claim against the code, the **(unverified)** marker, and Mike's review.
- **Drift.** The lint test catches renamed or removed code, but not prose that has become wrong. The
  skill's lint pass covers that, run before a release or on request.
- **Page conflicts between worktrees.** They should be rare, since pages follow concepts, and when
  they happen they are real disagreements.
- **Session cost.** The index is loaded every session. One line per page keeps it at roughly 45 lines.

## 11. Out of scope

- Moving the existing dev docs.
- Rewriting or trimming the ledger.
- Any app change.
- Publishing the wiki anywhere. GitHub renders it in the repo.
- 2.0 content beyond the stub.

## As built

Built 2026-09-28 on branch `docs/living-wiki`: 38 pages, all 38 as §5 lists them (none merged). Where
the result differs from the text above:

- **§5, sections-and-layout:** the ☰ ToC does *not* use `NOTE_SECTIONS` — `buildToc()` walks the DOM.
  The registry's consumers are section notes, the combat view, print and `jumpToNote()`. The page
  and the overview's glossary say so.
- **§7 gained a check:** every ledger `L<n>` a page cites must be a heading line in the ledger. The
  L-numbers are only stable while the ledger is append-only, and this is what enforces it.
- **§7, the register:** `decisions.md` was generated from the pages' Decisions tables (264 rows) and
  is exempt from the name/fragment existence checks, like the Decisions sections it collects —
  rejected alternatives name things that never existed.
- **roadmap/known-issues.md** gained a "Found while compiling the wiki — for Mike's triage" section:
  ~40 ledger-vs-code discrepancies the compile turned up, several of them real bugs. Nothing was
  fixed as part of this work.
- **§8, CLAUDE.md:** 157 lines, not under 150. The fragment-count and suite-count claims stayed in it,
  so `docs.js`'s existing regexes did not move.
- **Beyond scope, done because they were one-line factual fixes in a doc the wiki indexes:**
  RELEASING.md's "both zips" and its two-pack attachment table (there is one zip and five packs).
- **The skill** was checked with one scenario, run twice: a subagent with CLAUDE.md alone and one
  with the skill, both wrapping up the same change. See the ledger entry for the result.
- **§6, ingest order:** the ledger entry is appended *first*, not last, because the History lines
  cite its heading's line number. After a worktree merge those citations must be re-pointed; the
  skill, CLAUDE.md and WORKTREES §4 all say so, and the L-number check is what catches a miss.
