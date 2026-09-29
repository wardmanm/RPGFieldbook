# Screenshot QA

Any change that alters what a tab renders ships with a screenshot of each affected tab, taken here,
before merging. For a change to existing UI that means a before shot and an after shot. The
screenshots come from the project's own Playwright MCP server, which drives the built
`dist/fieldbook.html` over `file://` in headless Chrome. Playwright can also click, type, drag and
press keys, so an interactive change should be driven through and then shot, not just rendered. None
of this replaces Mike's pass in real browsers.

**Code:** `.mcp.json`, `scripts/playwright-mcp.js`; `selectTab()` in `40-sheet.js`; `newCharacter()`,
`skinForSystem()` in `75-home-theme.js` · **See also:** [Testing](testing.md),
[Building & CI](building-and-ci.md), [Shell](../ui/shell.md),
[Theming & icons](../ui/theming-and-icons.md)

## How it works

### The server

`.mcp.json` registers one stdio server, `playwright`, whose command is `node` with the single argument
`scripts/playwright-mcp.js`. The launcher runs `npx -y @playwright/mcp@0.0.79` with these flags:

| Flag | Why |
|---|---|
| `--allow-unrestricted-file-access` | **Load-bearing.** Playwright MCP blocks `file://` navigation by default, and the app is only ever a `file://` URL. Without it every capture fails |
| `--browser chrome` | Reuses the installed Chrome instead of downloading Chromium |
| `--headless` | No window |
| `--viewport-size 1280x900` | The default desktop viewport. Use `browser_resize` for phone widths |
| `--output-dir <os.tmpdir>/playwright-mcp` | Per machine, not a path hardcoded by whoever set it up |

**Why a launcher.** `.mcp.json` has no per-platform conditionals, and the two platforms need different
spawns. On Windows, stdio servers start without a shell and `npx` is `npx.cmd`, a batch script, so a
bare `npx` dies with ENOENT. The launcher passes `shell: true` there, which goes through `cmd`. On
macOS and Linux `npx` is a real executable and there is no `cmd`. `node` is a real binary everywhere,
so `.mcp.json` always spawns node and the choice happens inside the launcher. The launcher is a
transparent passthrough: stdio is inherited. It exits with the server's real exit code and forwards
SIGINT and SIGTERM, so a headless Chrome doesn't outlive the session.

**The path in `.mcp.json` is relative on purpose.** `${CLAUDE_PROJECT_DIR}` is a hook variable. It is
not set when `.mcp.json` is read, so it reached node as literal text. Stdio servers start with the
project root as their working directory, which is all a relative path needs.

### Taking a screenshot

1. Build first (`./build.sh --no-zip` or `node scripts/build-html.js`). The server renders the
   **artifact**, not `src/`.
2. `browser_navigate` to `file:///<absolute path to the repo>/dist/fieldbook.html`.
3. Seed state with `browser_evaluate`. The one-line way into a sheet is
   `newCharacter("QA", "dnd")`. It builds a blank character, stores it, sets the skin to match the
   system, renders, and hides the home screen. Then `selectTab("spells")`, or whichever tab.
4. `browser_take_screenshot` with `fullPage: true`, giving an **absolute** `filename`.
5. For interactive changes, drive the flow (`browser_click`, `browser_type`, `browser_press_key`,
   `browser_drag`, `browser_hover`) and shoot the result.

Tab names are `sheet`, `inventory`, `spells`, `story`, `rules`, `journal` and `combat`. The combat tab's
button is the crossed swords (`#btnCombat`), not a `.tab`.

By local convention the shots go in `.claude/qa/` (gitignored) as `<issue>-before-<what>.png` and
`<issue>-after-<what>.png`. This is a habit, not something anything enforces.

### What it does not cover

Real browsers at real sizes, touch, print output (`printSheet()` hands off to the browser's print
dialog), and the owner's own saved characters. Say plainly what was driven and what wasn't. A driven
flow is evidence, not a substitute for Mike's pass, and "screenshot attached" is never the same claim
as "fully tested".

## Rules that must hold

- **Every PR and every merge that changes what a tab renders carries a screenshot of each affected
  tab,** with before and after for a change to existing UI. No screenshot, no claim that the UI works.
- **Shoot both skins when a change touches themed CSS.** The skin follows the system
  (`skinForSystem()`: `dnd` gives `classic`, anything else gives `humblewood`), so one `"dnd"` and one
  `"humblewood"` character covers both.
- **The launcher's flags stay in the launcher,** where the platform split can be expressed.
  `.mcp.json` spawns `node scripts/playwright-mcp.js` and nothing else.
- **The server version is pinned.** Bump it deliberately. Never move to `@latest`, which re-resolves
  on every session start (a network dependency) and changes screenshot output under unrelated work.

## Traps

- **Tab names are lowercase.** `selectTab("Sheet")` throws nothing. It matches no panel, deactivates
  all of them, and leaves an intact top bar over an empty body. That looks like a working app, which
  is exactly the failure a screenshot catches and the test suite cannot.
- **`newCharacter()` treats anything but `"dnd"` as Humblewood.** A typo such as `"DnD"` silently
  gives you a Humblewood sheet in the Humblewood skin.
- **A relative `filename` lands relative to the server's working directory** (the repo root), not in
  `--output-dir`.
- **A plugin-provided Playwright server is not a substitute.** One may well be connected: its tools
  are `mcp__plugin_playwright_playwright__*`, where this project's are `mcp__playwright__*`. It does
  not carry `--allow-unrestricted-file-access`, so it refuses `file://`, the only URL this app has.
- **When the server won't connect, `/mcp` only says "Connection closed".** The real stderr is in
  `~/Library/Caches/claude-cli-nodejs/<project path with / as ->/mcp-logs-playwright/` on macOS.
  Read that first. The `${CLAUDE_PROJECT_DIR}` failure went unnoticed from 2 Sep to 24 Sep because the
  launcher was checked by running it by hand, which never exercises that variable.
- **Old worktrees carry old config.** A branch cut before the launcher existed has the Windows-only
  `cmd /c npx` in `.mcp.json` and no launcher, so a session rooted there cannot take screenshots until
  it is rebased onto `main`.
- **Screenshots catch what tests can't.** The Settings credit paragraphs rendered as a stair-step
  because `.m-body p` is `white-space:pre-wrap`, and a wrapped source line keeps its newline and
  indent. Nothing but a picture showed it.
- **A fresh character is not the whole test.** A rule that only runs when a record is edited can
  leave sheets saved before the change untouched. The damage-less spell rows passed every unit test
  and looked right on a new character. Seed a pre-change save when behaviour depends on stored data.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How screenshots are taken | The Playwright MCP server, registered at project scope in `.mcp.json` | Hand-rolled headless Chrome over the DevTools Protocol. It worked with no dependencies and was superseded within the hour, because Mike asked for the MCP |
| How `.mcp.json` starts it | `node scripts/playwright-mcp.js`, which picks the spawn per platform | `cmd /c npx` directly: Windows-only, and dies on a Mac with `Executable not found in $PATH: cmd` |
| The launcher's path | Relative | `${CLAUDE_PROJECT_DIR}/…`: not set when `.mcp.json` is read |
| Server version | Pinned in the launcher | `@latest`: a network dependency and an unannounced upgrade every session |
| Browser | Installed Chrome | Downloading Chromium |
| Output directory | `os.tmpdir` | A hardcoded Windows path |

## History

- 2026-08-18 — Screenshot validation becomes required for UI changes: first hand-rolled CDP, then the Playwright MCP in `.mcp.json` via `cmd /c npx`. → ledger L3246
- 2026-08-18 — The first emblem screenshots catch the pre-wrap stair-step and the lowercase-tab trap. → ledger L3289
- 2026-09-01 — `.mcp.json` moves to the cross-platform launcher, whose `${CLAUDE_PROJECT_DIR}` path never resolved. → ledger L3361, #42
- 2026-09-24 — Launcher path made relative, and the server connects again. → ledger L3361
- 2026-09-29 — The Notes tab is the Journal tab (`tab-journal`); the notes print as "Section notes". → ledger L4756, #39
