#!/usr/bin/env node
/*
 * Cut a DATA release (#83): give each rules pack whose content changed since its
 * last release the version <APP_VERSION>-N in data/packs.json, and print the
 * commands that publish it. Spec: src/docs/specs/2026-10-07-data-archive-design.md §5.4.
 *
 *   node scripts/data-release.js            bump data/packs.json
 *   node scripts/data-release.js --dry-run  say what it would do; write nothing
 *
 * Never touches fieldbook.html, APP_VERSION, DATA_VERSIONS, the CHANGELOG or the
 * notebook: a data release ships no app. Never commits, tags or pushes — the
 * tag is what publishes (.github/workflows/data-release.yml), and that stays a
 * human step.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const FBDATA = path.join(ROOT, "tools/data-kit/fbdata.py");
const DRY = process.argv.includes("--dry-run");

function die(msg) {
  console.error("data-release: " + msg);
  process.exit(1);
}
function findPython() {
  for (const py of ["python3", "python"]) {
    if (spawnSync(py, ["-c", ""], { stdio: "ignore" }).status === 0) return py;
  }
  return null;
}
const PY = findPython();
if (!PY) die("needs python3 (tools/data-kit/fbdata.py)");
function fbdata(args) {
  const r = spawnSync(PY, [FBDATA, ...args], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) die("fbdata.py " + args.join(" ") + " failed:\n" + (r.stderr || r.stdout));
  return r.stdout;
}

const src = fs.readFileSync(path.join(ROOT, "src/js/30-version.js"), "utf8");
const app = (/APP_VERSION\s*=\s*"([^"]+)"/.exec(src) || [])[1] || "";
if (!/^\d+\.\d+\.\d+$/.test(app)) die(`APP_VERSION "${app}" is not X.Y.Z`);

// 1.8.0 is the first app release that opens the data zip (#83). A data
// release built against an older APP_VERSION would publish an archive no
// installed copy of Fieldbook could import.
const cmp3 = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) { if (pa[i] !== pb[i]) return pa[i] - pb[i]; }
  return 0;
};
if (cmp3(app, "1.8.0") < 0) die(`a data release needs Fieldbook 1.8.0 or later, the first that opens the zip — APP_VERSION is ${app}`);

// The digests recorded below must describe what gets committed and tagged.
const dirty = spawnSync("git", ["-C", ROOT, "status", "--porcelain", "--", "data"], { encoding: "utf8" });
if (dirty.status !== 0) die("git status failed — is this a git checkout?");
if (dirty.stdout.trim()) die("data/ has uncommitted changes — commit them first:\n" + dirty.stdout);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "data/packs.json"), "utf8"));
const rel = String(reg.release || "");
let next;
if (rel === app) next = app + "-1";
else {
  const m = /^(\d+\.\d+\.\d+)-([1-9]\d*)$/.exec(rel);
  if (!m || m[1] !== app) die(`data/packs.json's release ${rel || "(none)"} doesn't belong to APP_VERSION ${app}`);
  next = app + "-" + (Number(m[2]) + 1);
}
const tag = "data-v" + next;
if (spawnSync("git", ["-C", ROOT, "rev-parse", "-q", "--verify", "refs/tags/" + tag]).status === 0)
  die(`tag ${tag} already exists`);

const changed = fbdata(["versions", "--changed"]).split("\n").map((s) => s.trim()).filter(Boolean);
if (!changed.length) die("nothing to release — no pack's content differs from its last release");

console.log(`data release ${next}: ${changed.join(", ")} change${changed.length === 1 ? "s" : ""}`);
if (DRY) {
  console.log("(dry run — nothing written)");
  process.exit(0);
}
fbdata(["versions", "--bump", next]);
console.log(`\nwrote data/packs.json. PUBLISH data ${next} — nothing is public until you do this:\n`);
console.log("    git add data/packs.json");
console.log(`    git commit -m "Data release ${next}"`);
console.log(`    git tag -a ${tag} -m "Fieldbook data ${next}"`);
console.log(`    git push && git push origin ${tag}`);
