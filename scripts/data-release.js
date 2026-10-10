#!/usr/bin/env node
/*
 * Cut a DATA release (#83, #85): give each rules pack whose content changed since its
 * last release the version <APP_VERSION>-N in a registry, and print the commands that
 * publish it. Two forms:
 *
 *   node scripts/data-release.js                               bump data/packs.json (public)
 *   node scripts/data-release.js --dry-run                     say what it would do; write nothing
 *   node scripts/data-release.js --registry F --data-root D    bump another registry (e.g. the
 *                                                               private repo's), in its own git
 *                                                               checkout — pass both or neither
 *
 * The public registry's release must belong to APP_VERSION (an app release is what bumps
 * it); a private registry is never bumped by an app release — once its last release falls
 * behind APP_VERSION, the next one is simply <APP_VERSION>-1.
 *
 * Never touches fieldbook.html, APP_VERSION, DATA_VERSIONS, the CHANGELOG or the
 * notebook: a data release ships no app. Never commits, tags or pushes — the
 * tag is what publishes (.github/workflows/data-release.yml), and that stays a
 * human step; for a private registry those commands run against ITS own repo
 * (git -C <that repo>), never this one.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const FBDATA = path.join(ROOT, "tools/data-kit/fbdata.py");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");

function die(msg) {
  console.error("data-release: " + msg);
  process.exit(1);
}
function argVal(flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
}
const registryArg = argVal("--registry");
const dataRootArg = argVal("--data-root");
if ((registryArg == null) !== (dataRootArg == null)) die("--registry and --data-root go together");
const PRIVATE = registryArg != null;

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

const REG = PRIVATE ? path.resolve(registryArg) : path.join(ROOT, "data/packs.json");
const DATA = PRIVATE ? path.resolve(dataRootArg) : path.join(ROOT, "data");

// A private registry lives in its own git checkout (the private repo), never this one.
// Resolve symlinks (e.g. macOS /var -> /private/var) before comparing against git's own
// (symlink-resolved) view of the checkout, or a relative pathspec built from the two can
// come out "outside repository" even though they name the same directory.
let REPO = ROOT, DATA_FS = DATA, REG_FS = REG;
if (PRIVATE) {
  try { DATA_FS = fs.realpathSync(DATA); } catch (e) { die(`${dataRootArg}: ${e.message}`); }
  try { REG_FS = fs.realpathSync(REG); } catch (e) { die(`${registryArg}: ${e.message}`); }
  const top = spawnSync("git", ["-C", DATA_FS, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (top.status !== 0) die("the data root is not in a git checkout");
  REPO = top.stdout.trim();
}

// The digests recorded below must describe what gets committed and tagged.
const relData = PRIVATE ? path.relative(REPO, DATA_FS) : "data";
const dirty = spawnSync("git", ["-C", REPO, "status", "--porcelain", "--", relData], { encoding: "utf8" });
if (dirty.status !== 0) die("git status failed — is this a git checkout?");
if (dirty.stdout.trim()) die(`${relData}/ has uncommitted changes — commit them first:\n` + dirty.stdout);

const reg = JSON.parse(fs.readFileSync(REG, "utf8"));
const rel = String(reg.release || "");
const relBase = (/^(\d+\.\d+\.\d+)/.exec(rel) || [])[1];
let next;
if (PRIVATE && relBase && cmp3(relBase, app) < 0) {
  // a private registry is never bumped by an app release
  next = app + "-1";
} else if (rel === app) {
  next = app + "-1";
} else {
  const m = /^(\d+\.\d+\.\d+)-([1-9]\d*)$/.exec(rel);
  if (!m || m[1] !== app) die(`${PRIVATE ? REG : "data/packs.json"}'s release ${rel || "(none)"} doesn't belong to APP_VERSION ${app}`);
  next = app + "-" + (Number(m[2]) + 1);
}
const tag = "data-v" + next;
if (spawnSync("git", ["-C", REPO, "rev-parse", "-q", "--verify", "refs/tags/" + tag]).status === 0)
  die(`tag ${tag} already exists`);

const fbArgs = PRIVATE ? ["--registry", REG, "--data-root", DATA] : [];
const changed = fbdata(["versions", "--changed", ...fbArgs]).split("\n").map((s) => s.trim()).filter(Boolean);
if (!changed.length) die("nothing to release — no pack's content differs from its last release");

console.log(`data release ${next}: ${changed.join(", ")} change${changed.length === 1 ? "s" : ""}`);
if (DRY) {
  console.log("(dry run — nothing written)");
  process.exit(0);
}
fbdata(["versions", "--bump", next, ...fbArgs]);
if (PRIVATE) {
  const regRel = path.relative(REPO, REG_FS);
  console.log(`\nwrote ${regRel}. PUBLISH data ${next} — nothing is public until you do this:\n`);
  console.log(`    git -C ${REPO} add ${regRel}`);
  console.log(`    git -C ${REPO} commit -m "Data release ${next}"`);
  console.log(`    git -C ${REPO} tag -a ${tag} -m "Fieldbook data ${next}"`);
  console.log(`    git -C ${REPO} push && git -C ${REPO} push origin ${tag}`);
} else {
  console.log(`\nwrote data/packs.json. PUBLISH data ${next} — nothing is public until you do this:\n`);
  console.log("    git add data/packs.json");
  console.log(`    git commit -m "Data release ${next}"`);
  console.log(`    git tag -a ${tag} -m "Fieldbook data ${next}"`);
  console.log(`    git push && git push origin ${tag}`);
}
