#!/usr/bin/env node
/*
 * The rules-data part of a GitHub release body (#83), from data/packs.json.
 *
 *   node scripts/data-release-notes.js <version> --app    footer for an app release
 *   node scripts/data-release-notes.js <version> --data   the body of a data release
 *
 * A pack changed in this release when its version IS this release's version:
 * release.js and data-release.js give exactly the changed packs that version.
 * Spec: src/docs/specs/2026-10-07-data-archive-design.md §5.5.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const [ver, mode] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(-[1-9]\d*)?$/.test(ver || "") || (mode !== "--app" && mode !== "--data")) {
  console.error("usage: data-release-notes.js <X.Y.Z or X.Y.Z-N> --app|--data");
  process.exit(1);
}
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "data/packs.json"), "utf8"));
const zip = `fieldbook-data-standalone-${ver}.zip`;
const changed = reg.packs.filter((p) => p.version === ver);
const same = reg.packs.filter((p) => p.version && p.version !== ver);
const list = (ps) => ps.map((p) => `${p.title} (v${p.version})`).join(", ");
const older = "Fieldbook older than 1.8.0 can't open a zip: unzip it and import the `.json` files instead.";
const out = [];
if (mode === "--app") {
  out.push("", "---", "",
    "**Just want the app?** Download `fieldbook.html` and open it — that is the whole thing.", "",
    `**Rules data:** \`${zip}\`. In Fieldbook, open Settings → Rules data → Import files and choose the zip.`);
  out.push("", "**Build your own:** `fieldbook-data-kit-" + ver + ".zip` turns a 5e-tools export into a rules data zip. See the README inside it.");
  if (changed.length) {
    out.push("", `Changed in this release: ${list(changed)}.` +
      (same.length ? ` Unchanged: ${list(same)} — if you already have those versions loaded, there's no need to re-import them.` : ""));
  } else {
    out.push("", "**No rules pack changed in this release** — if you already have these versions loaded, you only need `fieldbook.html`.");
  }
  out.push("", older);
} else {
  const base = ver.replace(/-\d+$/, "");
  out.push(`Rules data ${ver}, for Fieldbook ${base} and later. There is no app update in this release.`, "");
  out.push(changed.length ? `**Changed:** ${list(changed)}.` : "**Changed:** nothing.");
  if (same.length) out.push("", `Unchanged: ${list(same)}.`);
  out.push("", `**To update:** download \`${zip}\`, then in Fieldbook open Settings → Rules data → Import files and choose it. ` +
    "Re-importing replaces each pack completely.", "", older);
}
process.stdout.write(out.join("\n") + "\n");
