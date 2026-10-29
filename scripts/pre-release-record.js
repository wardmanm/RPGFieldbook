#!/usr/bin/env node
/*
 * The pre-release record, src/docs/PRE-RELEASE.md (#127; spec
 * 2026-10-29-pre-release-design.md §3, §5). `/pre-release X.Y.Z` writes it;
 * scripts/release.js refuses to cut X.Y.Z until it names exactly X.Y.Z with all
 * five steps done, and files it under src/docs/archive/X.Y.Z/ after the cut.
 * Offline by design: the open-P0 check against GitHub is the release skill's.
 *
 *   node scripts/pre-release-record.js [X.Y.Z] [--root DIR]
 *
 * prints "pre-release X.Y.Z: complete" and exits 0, or prints what release.js
 * would refuse with and exits 1. With no version it checks the record's own.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const RECORD = "src/docs/PRE-RELEASE.md";
const STEPS = ["Docs", "Outstanding issues", "QA checklist", "QA bugs", "Release notes"];

function archivePath(version) {
  return "src/docs/archive/" + version + "/PRE-RELEASE.md";
}

/* the record's text, or null when there is none */
function readRecord(root) {
  try { return fs.readFileSync(path.join(root, RECORD), "utf8"); } catch (e) { return null; }
}

/* {version, steps: [{n, name, state}]} from the part above the first "## " */
function parseRecord(text) {
  const top = String(text).split(/^## /m)[0];
  const head = /^# Pre-release (\S+)[ \t]*$/m.exec(top);
  const steps = [];
  for (const m of top.matchAll(/^\|\s*(\d+)\.\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/gm)) {
    steps.push({ n: +m[1], name: m[2], state: m[3] });
  }
  return { version: head ? head[1] : null, steps };
}

/* null when `text` is a complete record for exactly `version`, else why not */
function recordProblem(text, version) {
  const run = "Run /pre-release " + version;
  if (text == null) return "no pre-release record for " + version + " (" + RECORD + " does not exist). " + run + " first.";
  const rec = parseRecord(text);
  if (!rec.version) return RECORD + ' has no "# Pre-release X.Y.Z" heading. ' + run + " first.";
  if (rec.version !== version) return RECORD + " is for " + rec.version + ", not " + version + ". " + run + " first.";
  for (let i = 0; i < STEPS.length; i++) {
    const step = (i + 1) + ". " + STEPS[i];
    const row = rec.steps.find(s => s.n === i + 1);
    if (!row) return RECORD + " has no row for step " + step + ". " + run + " to finish it.";
    if (row.state !== "done") return "pre-release " + version + " is not finished: step " + step + " is open. " + run + " to finish it.";
  }
  return null;
}

/* what release.js refuses with for `version` in the tree at root, or null */
function gateProblem(root, version) {
  const p = recordProblem(readRecord(root), version);
  if (p) return p;
  if (fs.existsSync(path.join(root, archivePath(version)))) {
    return archivePath(version) + " already exists: " + version + " has been cut before.";
  }
  return null;
}

/* move the record to src/docs/archive/<version>/; returns that path */
function archiveRecord(root, version) {
  const dest = path.join(root, archivePath(version));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(path.join(root, RECORD), dest);
  return archivePath(version);
}

function main(argv) {
  const args = argv.slice(2);
  const ri = args.indexOf("--root");
  const root = ri >= 0 ? path.resolve(args[ri + 1] || ".") : path.resolve(__dirname, "..");
  const rest = args.filter((a, i) => ri < 0 || (i !== ri && i !== ri + 1));
  let version = rest[0];
  if (!version) {
    const text = readRecord(root);
    if (text == null) { console.error("pre-release: no record (" + RECORD + " does not exist). Run /pre-release X.Y.Z first."); return 1; }
    version = parseRecord(text).version || "X.Y.Z";
  }
  const p = gateProblem(root, version);
  if (p) { console.error("pre-release: " + p); return 1; }
  console.log("pre-release " + version + ": complete");
  return 0;
}

module.exports = { RECORD, STEPS, archivePath, readRecord, parseRecord, recordProblem, gateProblem, archiveRecord };
if (require.main === module) process.exit(main(process.argv));
