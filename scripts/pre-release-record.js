#!/usr/bin/env node
/*
 * The pre-release record, src/docs/PRE-RELEASE.md (#127; spec
 * 2026-10-29-pre-release-design.md §3, §5). `/pre-release X.Y.Z` writes it;
 * scripts/release.js refuses to cut X.Y.Z until it names exactly X.Y.Z with all
 * five steps done, and files it under src/docs/archive/X.Y.Z/ after the cut.
 * Offline by design: the open-P0 check against GitHub is the release skill's.
 *
 *   node scripts/pre-release-record.js [X.Y.Z] [--root DIR]
 *   node scripts/pre-release-record.js --help
 *
 * prints "pre-release X.Y.Z: complete" and exits 0, or prints what release.js
 * would refuse with and exits 1. With no version it checks the record's own, by
 * the same rule: its heading must name a version X.Y.Z, so "# Pre-release v1.9.0"
 * is refused here just as release.js refuses it. --help (-h) prints the usage and
 * exits 0; an unknown flag or an argument that is not X.Y.Z prints it and exits 2.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
  /* every step has exactly one row, or the record is invalid: a duplicated row
     (one copy done, another open) must never pass on whichever copy comes
     first (#127 ruling 18: fail closed) */
  for (let i = 0; i < STEPS.length; i++) {
    const rows = rec.steps.filter(s => s.n === i + 1).length;
    if (rows === 0) return RECORD + " has no row for step " + (i + 1) + ". " + STEPS[i] + ". " + run + " to finish it.";
    if (rows > 1) return RECORD + " has " + rows + " rows for step " + (i + 1) + ". " + STEPS[i] + ". " + run + " to finish it.";
  }
  for (let i = 0; i < STEPS.length; i++) {
    const row = rec.steps.find(s => s.n === i + 1);
    if (row.state !== "done") return "pre-release " + version + " is not finished: step " + (i + 1) + ". " + STEPS[i] + " is open. " + run + " to finish it.";
  }
  return null;
}

/* a local git query in the tree at root (offline); true when it exits 0. Not a
   repo, or no git at all, reads as false. GIT_DIR and friends are dropped so a
   hook's environment can't point it at another repo. */
function gitOk(root, args) {
  const env = Object.assign({}, process.env);
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[k];
  const r = spawnSync("git", ["-C", root].concat(args), { stdio: "ignore", env });
  return r.status === 0;
}

/* what release.js refuses with for `version` in the tree at root, or null.
   "Cut before" (#127 ruling 17) is the tag v<version>, or an archived record
   that git tracks. An archived record git does NOT track, with no tag, is a
   cut that was undone (`git checkout -- .` restores what release.js changed
   but leaves the new file): refused with the command that puts it back, and
   never moved here, so nothing is lost or overwritten unasked. */
function gateProblem(root, version) {
  const archived = archivePath(version);
  if (gitOk(root, ["rev-parse", "-q", "--verify", "refs/tags/v" + version])) {
    return "the tag v" + version + " already exists: " + version + " has been cut before.";
  }
  if (fs.existsSync(path.join(root, archived))) {
    if (gitOk(root, ["ls-files", "--error-unmatch", "--", archived])) {
      return archived + " already exists: " + version + " has been cut before.";
    }
    return archived + " is left from a cut of " + version + " that was undone: git does not track it and there is no tag v" +
      version + ". Put the record back, then run again: mv " + archived + " " + RECORD;
  }
  return recordProblem(readRecord(root), version);
}

/* move the record to src/docs/archive/<version>/; returns that path. On a failure
   it removes the folder it made, if it made one and it is still empty, so nothing
   is left that a later gate could misread, then throws. */
function archiveRecord(root, version) {
  const dest = path.join(root, archivePath(version));
  const made = fs.mkdirSync(path.dirname(dest), { recursive: true });
  try { fs.renameSync(path.join(root, RECORD), dest); }
  catch (e) {
    if (made) { try { fs.rmdirSync(path.dirname(dest)); } catch (e2) { /* not empty, or not ours: leave it */ } }
    throw e;
  }
  return archivePath(version);
}

/* the commands that file the record by hand when archiveRecord() failed after a cut:
   git mv when git tracks the record (as /pre-release leaves it), plain mv otherwise */
function archiveByHand(root, version) {
  const mv = gitOk(root, ["ls-files", "--error-unmatch", "--", RECORD]) ? "git mv" : "mv";
  return "mkdir -p " + path.posix.dirname(archivePath(version)) + " && " + mv + " " + RECORD + " " + archivePath(version);
}

const VERSION = /^\d+\.\d+\.\d+$/;
const USAGE = "usage: node scripts/pre-release-record.js [X.Y.Z] [--root DIR]\n" +
  "  checks src/docs/PRE-RELEASE.md as release.js does before a cut: prints\n" +
  "  \"pre-release X.Y.Z: complete\" and exits 0, or the refusal and exits 1.\n" +
  "  With no version, checks the version the record's own heading names.";

/* a refusal, read "pre-release …" once: the gate's own words already start with
   "pre-release" when they name the step, and get the prefix otherwise */
function refuse(msg) {
  console.error(/^pre-release\b/.test(msg) ? msg : "pre-release: " + msg);
  return 1;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { console.log(USAGE); return 0; }
  const usage = why => { console.error("pre-release: " + why); console.error(USAGE); return 2; };
  let root = path.resolve(__dirname, ".."), rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") {
      if (i + 1 >= args.length || args[i + 1].startsWith("-")) return usage("--root needs a folder");
      root = path.resolve(args[++i]);
    } else if (args[i].startsWith("-")) return usage("unknown option " + args[i]);
    else rest.push(args[i]);
  }
  if (rest.length > 1) return usage("one version at most, not " + rest.join(" "));
  let version = rest[0];
  if (version !== undefined && !VERSION.test(version)) return usage(version + " is not a version X.Y.Z");
  if (version === undefined) {
    const text = readRecord(root);
    if (text == null) return refuse("no record (" + RECORD + " does not exist). Run /pre-release X.Y.Z first.");
    const named = parseRecord(text).version;
    if (!named) return refuse(RECORD + ' has no "# Pre-release X.Y.Z" heading. Run /pre-release X.Y.Z first.');
    /* the same exact-heading rule release.js applies: it compares the heading with
       the X.Y.Z it is cutting, so a heading that is not X.Y.Z never passes there */
    if (!VERSION.test(named)) return refuse(RECORD + "'s heading names " + named + ", which is not a version X.Y.Z: release.js refuses it. Run /pre-release X.Y.Z first.");
    version = named;
  }
  const p = gateProblem(root, version);
  if (p) return refuse(p);
  console.log("pre-release " + version + ": complete");
  return 0;
}

module.exports = { RECORD, STEPS, archivePath, readRecord, parseRecord, recordProblem, gateProblem, archiveRecord, archiveByHand, main };
if (require.main === module) process.exit(main(process.argv));
