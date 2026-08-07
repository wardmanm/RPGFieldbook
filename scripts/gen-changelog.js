#!/usr/bin/env node
/*
 * Regenerate docs/CHANGELOG.md from the CHANGELOG array inside the built app,
 * and print APP_VERSION on stdout.
 *
 * Deliberately reads dist/fieldbook.html rather than src/js/30-version.js: the
 * round-trip through the artifact asserts that the version about to be zipped is
 * the version that was actually edited. So it must run AFTER build-html.js.
 *
 * (This lives in its own file because the equivalent heredoc inside a $(…)
 * command substitution in build.sh was unparseable — the apostrophe in "app's"
 * below opened a quote bash never closed, and the whole script failed to parse.)
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "dist/fieldbook.html");
const OUT = path.join(ROOT, "docs/CHANGELOG.md");

const src = fs.readFileSync(APP, "utf8");

const v = (src.match(/APP_VERSION\s*=\s*"([^"]+)"/) || [])[1];
if (!v) {
  console.error("gen-changelog: could not find APP_VERSION in dist/fieldbook.html");
  process.exit(1);
}

// Balanced extraction of the CHANGELOG array (the notes arrays nest).
const start = src.indexOf("const CHANGELOG=");
if (start < 0) {
  console.error("gen-changelog: could not find `const CHANGELOG=` in dist/fieldbook.html");
  process.exit(1);
}
const b = src.indexOf("[", start);
let depth = 0, end = -1;
for (let i = b; i < src.length; i++) {
  const c = src[i];
  if (c === "[") depth++;
  else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) {
  console.error("gen-changelog: unbalanced CHANGELOG array");
  process.exit(1);
}

const CHANGELOG = eval(src.slice(b, end + 1));

// Player-facing wording: this file ships in the bundle zip. The instructions for
// maintainers live in CLAUDE.md, not here.
let out = "# Fieldbook — Changelog\n\nWhat changed in each release. The version you are running is "
  + "shown in the app's top bar —\ntap it to read this same list in-app.\n";
for (const e of CHANGELOG) {
  out += `\n## v${e.v} — ${e.date}\n\n` + e.notes.map((n) => "- " + n).join("\n") + "\n";
}
fs.writeFileSync(OUT, out);

process.stdout.write(v);
