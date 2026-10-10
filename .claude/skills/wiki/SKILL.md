---
name: wiki
description: Use when finishing any Fieldbook task that changed app behaviour, data, the converter, the build or the dev process; when folding a merged branch, spec or ledger entry into the docs; when asked how some part of Fieldbook works; or when asked to check, lint or audit src/docs/wiki/ for drift.
---

# Fieldbook wiki

## Overview

`src/docs/wiki/` says how Fieldbook works **now**, one topic per page. The ledger
(`src/docs/_claude/WIRING-LEDGER.md`) is the log of how it got there. **The code is the truth**;
a page is a claim about the code, and the ledger is only evidence of where to look.

Invoked as `/wiki ingest`, `/wiki lint`, or `/wiki <question>`. With no argument after a task,
run **ingest**.

## Ingest — after a change

1. List what changed: `git diff --stat` against the branch point, plus the task's own summary.
2. Find the pages: the code map in `src/docs/wiki/overview.md` maps each fragment to its pages;
   `grep -rl '<functionName>' src/docs/wiki` finds the rest.
3. **Append the ledger entry first** (`src/docs/_claude/WIRING-LEDGER.md`, at the end, never
   above): what changed and why, linking the page(s). Its heading's line number is what History
   cites — `grep -n '^## ' src/docs/_claude/WIRING-LEDGER.md | tail -1`.
4. **Rewrite** the affected sections so they state the new behaviour in present tense. Delete
   what is no longer true — superseded text does not stay "for history". Check every page that
   *mentions* the behaviour, not only its home page, and code comments that restate it.
5. Add one line to each touched page's **History**: `- YYYY-MM-DD — what changed. → ledger L<n>, #issue`.
6. A decision with a reason goes in the page's **Decisions** table *and* one line in
   `decisions.md`. A reversed decision keeps the old choice as the rejected alternative.
7. Known limitation or deferral → the page's **Open**, and `roadmap/known-issues.md`.
8. New topic (not a new fix to an old topic) → new page from the template, plus its line in
   `index.md` under the right group. Update the code map in `overview.md` if a fragment's
   coverage changed.
9. Run `./src/tests/run.sh` — the `docs` suite checks the wiki mechanically.

**After merging a branch** (worktrees): `merge=union` appends the branch's ledger entry after
whatever `main` added meanwhile, so its heading moves and the branch's History citations point at
the wrong line. The `docs` suite fails on exactly this; re-point those `L<n>` in the merge commit.

## Query — "how does X work?"

Read `index.md`, then the page. Confirm the answer against the code before giving it. If the page
was wrong or silent, fix the page in the same turn — that is how the wiki compounds.

## Lint — audit for drift

1. `node src/tests/docs.js` — the mechanical checks.
2. Page by page, read the **Code:** functions and compare every claim in How it works and Rules
   that must hold. Report: contradictions, stale claims, (unverified) marks you can now resolve,
   code no page covers. Fix what is unambiguous; list the rest for Mike.

## Page template

```markdown
# <Topic>

One paragraph: what this is, for someone who has never seen it.

**Code:** `fnName()` in `NN-fragment.js` · **Data:** … · **Tests:** `suite.js` · **See also:** [Page](../group/page.md)

## How it works
## Rules that must hold
## Traps
## Decisions
| Question | Decision | Rejected, and why |
|---|---|---|
## Open
## History
- YYYY-MM-DD — one line. → ledger L<n>
```

Drop empty sections. Mark a claim you could not check against code **(unverified)**.

## Contract the `docs` suite enforces

| Write | Because |
|---|---|
| `name()` only for a function defined in `src/js/` or `scripts/` | every `name()` on a page must resolve |
| Constants, fields, CSS classes backticked **without** `()` | they are not functions |
| Fragments as `NN-name.js`, exactly as in `src/manifest.json` | cited fragments must exist; every JS fragment must be cited by some page |
| Relative links, e.g. `[Spells](../features/spells.md)` | every link must resolve; `[[wikilinks]]` do not render on GitHub |
| Every page listed in `index.md` | an unlisted page fails |
| No line numbers into code | they rot on the next edit above them |
| Ledger citations as `L<n>` of a `#` heading line | every one must still land on a heading — so the ledger is append-only |

## Common mistakes

- **Appending "Update:" paragraphs** instead of rewriting. The page then contradicts itself.
- **Trusting the ledger.** Later entries supersede earlier ones; check the code.
- **A page per fix.** Fixes update their topic's page; only a new topic earns a new page.
- **Restating player docs.** `docs/rules-schema.md` and `docs/README-converter.md` ship to
  players — link them.
- **Moving the indexed-in-place docs** (RELEASING, WORKTREES, ADR-001).
  Tooling and tests name their paths.
