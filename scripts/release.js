#!/usr/bin/env node
/*
 * Cut a release: fold the pending notes from src/docs/UNRELEASED.md into a new
 * CHANGELOG entry in src/js/30-version.js and bump APP_VERSION.
 *
 * Invoked by `./build.sh --release <level>` BEFORE the build runs, so the built
 * app carries the new version. Not meant to be run directly, but it is safe to:
 *
 *   node scripts/release.js patch|minor|major|X.Y.Z
 *
 * Deliberately does nothing else — no git commit, no tag, no push. Cutting the
 * GitHub Release stays a human step (see CLAUDE.md "Publishing / updates").
 */
"use strict";
const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VERSION_JS = path.join(ROOT, "src/js/30-version.js");
const NOTEBOOK = path.join(ROOT, "src/docs/UNRELEASED.md");

function die(msg) {
  console.error("release: " + msg);
  process.exit(1);
}

const level = process.argv[2];
if (!level) die("missing level — expected patch, minor, major, or an explicit X.Y.Z");

/* ---------------- pending notes ---------------- */

// Bullets live under the "## Pending" heading so the instructions above it can
// use dashes freely without being mistaken for release notes.
function readPendingNotes() {
  let raw;
  try {
    raw = fs.readFileSync(NOTEBOOK, "utf8");
  } catch (e) {
    die(`cannot read src/docs/UNRELEASED.md: ${e.message}`);
  }
  const marker = raw.indexOf("\n## Pending");
  if (marker < 0) die("src/docs/UNRELEASED.md has no '## Pending' heading");
  const body = raw.slice(raw.indexOf("\n", marker + 1));

  const notes = [];
  for (const line of body.split("\n")) {
    if (/^\s*-\s+/.test(line)) {
      notes.push(line.replace(/^\s*-\s+/, "").trim());
    } else if (/^\s+\S/.test(line) && notes.length) {
      // continuation of the previous bullet (wrapped line)
      notes[notes.length - 1] += " " + line.trim();
    }
  }
  return { raw, marker, notes };
}

const { raw, notes } = readPendingNotes();
if (!notes.length) {
  die("nothing to release — src/docs/UNRELEASED.md has no pending notes under '## Pending'");
}

/* ---------------- version ---------------- */

const src = fs.readFileSync(VERSION_JS, "utf8");
const cur = (src.match(/APP_VERSION\s*=\s*"([^"]+)"/) || [])[1];
if (!cur) die("could not find APP_VERSION in src/js/30-version.js");
const parts = cur.split(".").map((n) => parseInt(n, 10));
if (parts.length !== 3 || parts.some(isNaN)) die(`current APP_VERSION "${cur}" is not X.Y.Z`);

let next;
if (level === "patch") next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
else if (level === "minor") next = `${parts[0]}.${parts[1] + 1}.0`;
else if (level === "major") next = `${parts[0] + 1}.0.0`;
else if (/^\d+\.\d+\.\d+$/.test(level)) next = level;
else die(`unknown level "${level}" — expected patch, minor, major, or X.Y.Z`);

// An explicit version that goes backwards would break the in-app update check,
// which compares the newest release tag against APP_VERSION.
const cmp = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) { if (pa[i] !== pb[i]) return pa[i] - pb[i]; }
  return 0;
};
if (cmp(next, cur) <= 0) die(`refusing to go from ${cur} to ${next} — the new version must be higher`);

/* ---------------- write the CHANGELOG entry ---------------- */

// Local date, not UTC: the entry should read as the day the owner cut it.
const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
             `${String(d.getDate()).padStart(2, "0")}`;

const jsStr = (s) => JSON.stringify(s); // escapes quotes/backslashes correctly

const entry = `  {v:${jsStr(next)}, date:${jsStr(date)}, notes:[\n` +
  notes.map((n) => "    " + jsStr(n)).join(",\n") +
  "\n  ]},\n";

const anchor = "const CHANGELOG=[\n";
const at = src.indexOf(anchor);
if (at < 0) die("could not find `const CHANGELOG=[` in src/js/30-version.js");

let out = src.slice(0, at + anchor.length) + entry + src.slice(at + anchor.length);
out = out.replace(/APP_VERSION\s*=\s*"[^"]+"/, `APP_VERSION="${next}"`);

/* ---------------- data versions ----------------
   Bump a system's dataVersion ONLY if its data actually changed since the last
   release, so a player whose packs are still current isn't told to re-download
   them. Compared against the newest existing tag, working tree included —
   that is what this release will contain. Silently leaves everything alone if
   git or the tags are unavailable (a source-zip build, a fresh clone with no
   tags): the cost is a stale-looking pack, never a wrong bump. */
const SYSTEM_DIRS = { XPHB: "5e2024", Humblewood: "humblewood", XGE: "xanathars", TCE: "tashas",
                      Homebrew: "homebrew" };
function lastTag() {
  const r = spawnSync("git", ["-C", ROOT, "tag", "-l", "v[0-9]*.[0-9]*.[0-9]*",
                              "--sort=-v:refname"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return (r.stdout || "").split("\n").map((x) => x.trim()).filter(Boolean)[0] || null;
}
function dataChangedSince(tag, dir) {
  const r = spawnSync("git", ["-C", ROOT, "diff", "--quiet", tag, "--", "data/" + dir]);
  return r.status === 1;                       // 0 = same, 1 = differs, else error
}
const dvm = /const\s+DATA_VERSIONS\s*=\s*(\{[^}]*\})/.exec(out);
if (!dvm) die("could not find DATA_VERSIONS in src/js/30-version.js");
const versions = JSON.parse(dvm[1]);
const tag = lastTag();
const bumped = [];
for (const sysName of Object.keys(versions)) {
  const dir = SYSTEM_DIRS[sysName];
  if (!dir) { console.error(`    WARNING: no data dir mapped for system "${sysName}"`); continue; }
  if (!tag) { versions[sysName] = next; bumped.push(sysName + " (no previous tag)"); continue; }
  if (dataChangedSince(tag, dir)) { versions[sysName] = next; bumped.push(sysName); }
}
out = out.replace(dvm[1], JSON.stringify(versions).replace(/","/g, '","'));
fs.writeFileSync(VERSION_JS, out);
console.error(bumped.length
  ? `    rules data changed: ${bumped.join(", ")} -> dataVersion ${next}`
  : `    rules data unchanged since ${tag} — players need only the app`);

/* ---------------- empty the notebook ---------------- */

const keep = raw.slice(0, raw.indexOf("\n## Pending"));
fs.writeFileSync(NOTEBOOK, keep + "\n## Pending\n\n_Nothing yet._\n");

console.error(`    v${cur} -> v${next} (${date}), ${notes.length} note${notes.length === 1 ? "" : "s"}`);
process.stdout.write(next);
