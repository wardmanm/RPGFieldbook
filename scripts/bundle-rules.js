#!/usr/bin/env node
/*
 * Roll each system's per-category rules files into ONE importable pack.
 *
 *   data/5e2024/*.json      -> dist/5e2024_full.json
 *   data/humblewood/*.json  -> dist/humblewood_full.json
 *
 * Players import one file per system instead of ten; the individual category
 * files stay in the repo for anyone who wants to cherry-pick. The bundles are
 * build artifacts (gitignored) and are what the player zip ships.
 *
 * Bundles carry "rulebook": true, which the app uses to file them under a
 * "Rulebook" heading in Settings -> Loaded rules data instead of "Mixed".
 *
 * Only files directly inside a system folder are bundled. data/overlay.json and
 * data/class-resources.json sit at the data/ root precisely so they can't be
 * swept in — they are converter inputs, not loadable packs.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const OUTDIR = path.join(ROOT, "dist");

/* Must stay in step with RULE_CATS in src/js/88-settings.js. "traits" is an
   accepted alias for "features" (see rules-schema §1). */
const CATS = ["keywords", "features", "items", "spells", "races", "classes",
              "feats", "backgrounds", "subclasses", "tables"];

const SYSTEMS = [
  { dir: "5e2024",     out: "5e2024_full.json",     name: "D&D 2024 — Complete Rulebook" },
  { dir: "humblewood", out: "humblewood_full.json", name: "Humblewood — Complete Rulebook" },
];

/* DATA_VERSIONS lives in src/js/30-version.js so the app and the packs cannot
   disagree about it — read, never duplicated. Parsed rather than imported
   because the fragment is a plain script, not a module. */
function dataVersions() {
  const src = fs.readFileSync(path.join(ROOT, "src/js/30-version.js"), "utf8");
  const m = /const\s+DATA_VERSIONS\s*=\s*(\{[^}]*\})/.exec(src);
  if (!m) throw new Error("DATA_VERSIONS not found in src/js/30-version.js");
  return JSON.parse(m[1]);
}

/* subclasses are keyed by class+name, everything else by name; keywords use `term` */
function keyOf(entry, cat) {
  if (cat === "keywords") return String(entry.term || "").trim().toLowerCase();
  if (cat === "subclasses") return (String(entry.class || "") + "|" + String(entry.name || "")).trim().toLowerCase();
  return String(entry.name || "").trim().toLowerCase();
}

function bundle(sys) {
  const dir = path.join(DATA, sys.dir);
  if (!fs.existsSync(dir)) return { skipped: `no ${path.relative(ROOT, dir)}/ directory` };
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  if (!files.length) return { skipped: `${path.relative(ROOT, dir)}/ has no .json files` };

  const out = {};
  const seen = {};
  const errors = [];
  const dupes = [];
  let system = "";

  for (const f of files) {
    const p = path.join(dir, f);
    let obj;
    try { obj = JSON.parse(fs.readFileSync(p, "utf8")); }
    catch (e) { errors.push(`${sys.dir}/${f}: not valid JSON — ${e.message}`); continue; }

    // one system per folder, or the merged `system` field would be a lie
    const s = String(obj.system || "").trim();
    if (s) {
      if (!system) system = s;
      else if (s !== system) errors.push(`${sys.dir}/${f}: system "${s}" but the folder is "${system}"`);
    }

    for (const cat of CATS) {
      const arr = cat === "features" ? (obj.features || obj.traits) : obj[cat];
      if (!Array.isArray(arr)) continue;
      out[cat] = out[cat] || [];
      seen[cat] = seen[cat] || new Map();
      for (const e of arr) {
        const k = keyOf(e, cat);
        if (!k) { out[cat].push(e); continue; }
        const prev = seen[cat].get(k);
        if (prev) {
          // Mirror mergeRules (88-settings.js): same source + name replaces in
          // place, last wins. Must match, or the bundle would not equal
          // importing the individual files.
          out[cat][prev.i] = e;
          dupes.push(`${cat} "${e.name || e.term || k}" (${prev.f} -> ${f})`);
          continue;
        }
        seen[cat].set(k, { i: out[cat].length, f });
        out[cat].push(e);
      }
    }
  }
  if (errors.length) return { errors };

  const sysName = system || sys.dir;
  // `version` is the SCHEMA version; `dataVersion` is which release this
  // system's content last changed in, and is what the app compares against.
  const dv = dataVersions()[sysName];
  if (!dv) return { errors: [`${sys.dir}: no DATA_VERSIONS entry for system "${sysName}" ` +
                             `— add one in src/js/30-version.js`] };
  const pack = { system: sysName, name: sys.name, version: 1, dataVersion: dv, rulebook: true };
  for (const cat of CATS) if (out[cat] && out[cat].length) pack[cat] = out[cat];

  fs.mkdirSync(OUTDIR, { recursive: true });
  const dest = path.join(OUTDIR, sys.out);
  fs.writeFileSync(dest, JSON.stringify(pack) + "\n");
  const counts = CATS.filter(c => pack[c]).map(c => `${pack[c].length} ${c}`);
  return { dest, files: files.length, counts, dupes, bytes: fs.statSync(dest).size };
}

let failed = false;
for (const sys of SYSTEMS) {
  const r = bundle(sys);
  if (r.skipped) { console.log(`    skipped ${sys.out} — ${r.skipped}`); continue; }
  if (r.errors) {
    failed = true;
    console.error(`    FAILED ${sys.out}:`);
    r.errors.forEach(e => console.error(`      - ${e}`));
    continue;
  }
  console.log(`    ${path.relative(ROOT, r.dest)}  (${r.files} files, ${(r.bytes / 1024).toFixed(0)} KB)`);
  console.log(`      ${r.counts.join(" · ")}`);
  // not an error — the app dedupes the same way — but never silently
  if (r.dupes.length) console.log(`      deduped ${r.dupes.length}: ${r.dupes.join(", ")}`);
}
process.exit(failed ? 1 : 0);
