#!/usr/bin/env node
/*
 * Print ONE version's section from docs/CHANGELOG.md, for use as a GitHub
 * Release body.
 *
 *   node scripts/release-notes.js 1.2.2
 *
 * Reads the generated changelog rather than the CHANGELOG array so the release
 * notes and the shipped docs are provably the same text. Must therefore run
 * AFTER build.sh has regenerated docs/CHANGELOG.md.
 *
 * Exits non-zero if the version has no section — a release with an empty body
 * is worse than a failed workflow.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "docs/CHANGELOG.md");

const want = String(process.argv[2] || "").replace(/^v/i, "").trim();
if (!want) {
  console.error("usage: release-notes.js <version>   e.g. 1.2.2");
  process.exit(1);
}

let md;
try { md = fs.readFileSync(FILE, "utf8"); }
catch (e) { console.error("release-notes: cannot read " + FILE); process.exit(1); }

const lines = md.split("\n");
const head = /^##\s+v(\S+)/;
let start = -1, end = lines.length;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(head);
  if (!m) continue;
  if (start < 0 && m[1] === want) { start = i + 1; continue; }
  if (start >= 0) { end = i; break; }
}
if (start < 0) {
  console.error(`release-notes: no "## v${want}" section in docs/CHANGELOG.md`);
  console.error("  versions present: " + lines.filter(l => head.test(l))
    .map(l => l.match(head)[1]).join(", "));
  process.exit(1);
}

const body = lines.slice(start, end).join("\n").trim();
if (!body) {
  console.error(`release-notes: the v${want} section is empty`);
  process.exit(1);
}
process.stdout.write(body + "\n");
