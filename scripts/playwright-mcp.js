#!/usr/bin/env node
/* Cross-platform launcher for the Playwright MCP server.
 *
 * WHY THIS FILE EXISTS. `.mcp.json` has no per-platform conditionals, and the
 * two platforms need different spawns:
 *
 *   - Windows: stdio MCP servers are spawned WITHOUT a shell, and `npx` there is
 *     `npx.cmd` — a batch script, not an executable. A bare `npx` dies with
 *     ENOENT, so it has to go through `cmd /c`.
 *   - macOS / Linux: `npx` is a real executable and needs no shell. Wrapping it
 *     in `cmd` is what broke this config on a Mac ("Executable not found in
 *     $PATH: cmd").
 *
 * `node` is a real binary on all three, so `.mcp.json` can always spawn THIS,
 * and the platform choice moves here where it can be expressed.
 *
 * It is a transparent passthrough: stdio is inherited, so the MCP protocol runs
 * between Claude Code and the server exactly as if it had been spawned directly.
 */
"use strict";
const { spawn } = require("child_process");
const os = require("os");
const path = require("path");

/* Pinned deliberately — do NOT move to @latest. A silent server bump changes
   screenshot output under a change it has nothing to do with. */
const SERVER = "@playwright/mcp@0.0.79";

/* --allow-unrestricted-file-access is load-bearing, not decoration: Playwright
   MCP blocks file:// navigation by default and this whole app IS a file:// URL,
   so without it every single capture fails.
   --browser chrome reuses the installed Chrome instead of downloading Chromium.
   The output dir was hardcoded to a Windows path; os.tmpdir() is the same idea
   on whichever machine is running. */
const args = [
  "-y", SERVER,
  "--headless",
  "--browser", "chrome",
  "--allow-unrestricted-file-access",
  "--viewport-size", "1280x900",
  "--output-dir", path.join(os.tmpdir(), "playwright-mcp"),
];

const isWindows = process.platform === "win32";

/* On Windows the command goes through a shell, so any argument holding a space
   has to be quoted — os.tmpdir() sits under a user profile, and user names have
   spaces often enough to matter. Everywhere else the args array is passed
   through untouched and no quoting applies. */
const quote = a => (/[\s"^&|<>]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

const child = isWindows
  ? spawn(["npx", ...args].map(quote).join(" "), { stdio: "inherit", shell: true })
  : spawn("npx", args, { stdio: "inherit" });

child.on("error", err => {
  console.error(`playwright-mcp launcher: could not start npx — ${err.message}`);
  process.exit(1);
});

/* Wait for the real exit. Reading child.exitCode straight after spawn always
   gives null, which would report success no matter how the server died. */
child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code == null ? 1 : code));
});

/* Claude Code shuts a stdio server down by signalling this process; pass it on,
   or npx keeps a headless Chrome alive after the session ends. */
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { if (!child.killed) child.kill(sig); });
}
