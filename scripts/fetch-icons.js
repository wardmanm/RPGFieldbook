#!/usr/bin/env node
/* Vendor the class/ancestry/background emblems from game-icons.net.
 *
 *   node scripts/fetch-icons.js [--dry-run]
 *
 * Reads the hand-authored map in src/icons/icons.json and writes the generated
 * fragment src/js/05-icons.js. DEV ONLY and run BY HAND — never from build.sh
 * or CI, both of which must stay offline and byte-reproducible. The generated
 * fragment is committed; it IS the vendored copy of the artwork, which is why
 * no *.svg files are kept in the repo.
 *
 * Upstream files are white-on-black squares:
 *   <svg viewBox="0 0 512 512"><path d="M0 0h512v512H0z"/><path fill="#fff" d="…"/></svg>
 * We keep only the glyph's `d` and drop the fill, so CSS can colour it with
 * currentColor and it follows the theme. That transformation IS the "indicate
 * changes" half of CC BY 3.0 — see src/icons/README.md.
 *
 * The parse is deliberately STRICT. A handful of the 4200+ upstream icons carry
 * groups or transforms; rather than half-handle them, this dies naming the key
 * so you can pick a different icon. Swapping a pick costs seconds, and a
 * silently mangled glyph costs an afternoon.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MAP = path.join(ROOT, "src/icons/icons.json");
const OUT = path.join(ROOT, "src/js/05-icons.js");
const RAW = "https://raw.githubusercontent.com/game-icons/icons/master/";
const DRY = process.argv.includes("--dry-run");

const die = (m) => { console.error("fetch-icons: " + m); process.exit(1); };

/* The three kinds that get emblems. Subclasses deliberately do NOT — they are
   the second line of a class chip, and an emblem there would compete with the
   class's own. Keep this in step with the `kind` argument of iconSVG(). */
const KINDS = ["classes", "races", "backgrounds"];

/* Folder name -> display name for the credits block. Everything else is just
   the hyphenated folder title-cased, which is right for the vast majority. */
const ARTIST_NAMES = {
  "caro-asercion": "Caro Asercion",
  "darkzaitzev": "DarkZaitzev",
  "delapouite": "Delapouite",
  "kier-heyl": "Kier Heyl",
  "lorc": "Lorc",
  "sbed": "Sbed",
  "skoll": "Skoll",
  "willdabeast": "Willdabeast",
};
const artistName = (folder) => ARTIST_NAMES[folder]
  || folder.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/* ---------------- read and validate the map ---------------- */

let raw;
try { raw = JSON.parse(fs.readFileSync(MAP, "utf8")); }
catch (e) { die("could not read " + path.relative(ROOT, MAP) + ": " + e.message); }

for (const k of Object.keys(raw)) {
  if (k.startsWith("_")) continue;
  if (!KINDS.includes(k)) die(`unknown kind "${k}" in icons.json — expected ${KINDS.join(", ")}`);
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const entries = [];                       // {kind, name, slug}
for (const kind of KINDS) {
  const block = raw[kind] || {};
  for (const [name, slug] of Object.entries(block)) {
    if (typeof slug !== "string" || !SLUG.test(slug))
      die(`${kind}."${name}": "${slug}" is not a valid <artist>/<icon> slug`);
    entries.push({ kind, name, slug });
  }
}
if (!entries.length) die("icons.json maps nothing");

const slugs = [...new Set(entries.map((e) => e.slug))].sort();

/* ---------------- fetch and strip ---------------- */

/* Only the SVG path-data charset. This is the whole injection argument: the
   renderer interpolates `d` into a template literal WITHOUT esc(), and this is
   what makes that provably safe. Keep it strict; widening it moves the burden
   of proof onto every call site. */
const PATH_DATA = /^[-0-9.,eE MmLlHhVvCcSsQqTtAaZz]+$/;
const BG_SQUARE = "M0 0h512v512H0z";

async function grab(slug) {
  const res = await fetch(RAW + slug + ".svg");
  /* A missing file is a 404 whose BODY is the text "404: Not Found" — checking
     res.ok alone would be enough, but a body sniff costs nothing and catches a
     proxy that helpfully returns 200 with an error page. */
  if (!res.ok) throw new Error("HTTP " + res.status);
  const svg = (await res.text()).trim();
  if (!svg.startsWith("<svg")) throw new Error("not an SVG (got: " + svg.slice(0, 40) + ")");
  if (!/viewBox="0 0 512 512"/.test(svg)) throw new Error("unexpected viewBox");
  if (/<g[\s>]/.test(svg)) throw new Error("contains a <g> — pick a different icon");

  const paths = [...svg.matchAll(/<path\b([^>]*)\/?>/g)].map((m) => m[1]);
  if (paths.length !== 2) throw new Error(`expected 2 <path>, found ${paths.length} — pick a different icon`);

  const dOf = (attrs) => { const m = /\sd="([^"]+)"/.exec(attrs); return m ? m[1] : null; };
  const bg = dOf(paths[0]), glyph = dOf(paths[1]);
  if (bg !== BG_SQUARE) throw new Error("first path is not the background square");
  if (!glyph) throw new Error("second path has no d");
  if (/transform=/.test(paths[1])) throw new Error("glyph carries a transform — pick a different icon");
  if (!PATH_DATA.test(glyph)) throw new Error("glyph path data has unexpected characters");
  /* NOT setting fill-rule on purpose: these glyphs are drawn with counter-wound
     holes and render correctly under the default nonzero rule. Forcing
     even-odd inverts the holes on a good number of them. */
  return glyph;
}

(async () => {
  const glyphs = {};
  let failed = 0;
  for (const slug of slugs) {
    try {
      glyphs[slug] = await grab(slug);
      process.stderr.write(".");
    } catch (e) {
      failed++;
      process.stderr.write("\n    " + slug + ": " + e.message + "\n");
    }
  }
  process.stderr.write("\n");
  if (failed) die(`${failed} of ${slugs.length} icons failed — fix icons.json and re-run`);

  const bytes = Object.values(glyphs).reduce((a, d) => a + d.length, 0);
  if (DRY) {
    console.error(`    --dry-run: all ${slugs.length} icons fetched and parsed clean`);
    console.error(`    ${entries.length} entries, ${slugs.length} distinct icons, ${(bytes / 1024).toFixed(1)} KB of path data`);
    return;
  }

  /* ---------------- emit ---------------- */

  const byKind = {};
  for (const kind of KINDS) {
    byKind[kind] = {};
    for (const e of entries.filter((x) => x.kind === kind).sort((a, b) => a.name.localeCompare(b.name)))
      byKind[kind][e.name.trim().toLowerCase()] = e.slug;   /* lower-cased to match keyOf() */
  }
  const artists = [...new Set(slugs.map((s) => artistName(s.split("/")[0])))].sort();

  const j = (o) => Object.entries(o).map(([k, v]) => JSON.stringify(k) + ":" + JSON.stringify(v)).join(",\n");
  const out =
`/* ============ game-icons.net emblems — GENERATED, DO NOT EDIT ============
   Written by scripts/fetch-icons.js from src/icons/icons.json. To change an
   icon, edit that file and re-run:  node scripts/fetch-icons.js

   Artwork from https://game-icons.net under CC BY 3.0. Each glyph has had its
   black background square removed and its fill dropped, so CSS colours it with
   currentColor and it follows the skin and light/dark mode. Artists are credited
   in Settings -> Credits & licences, from ICON_ARTISTS below.

   Keys are lower-cased to match keyOf() in 89-rules-merge.js: a character
   stores its class/ancestry/background as a plain NAME, so these look up by
   name and keep working with no rules pack loaded. */
const GAME_ICONS={
${j(glyphs)}
};
const ICON_MAP={
${KINDS.map((k) => JSON.stringify(k) + ":{\n" + j(byKind[k]) + "\n}").join(",\n")}
};
const ICON_ARTISTS=${JSON.stringify(artists)};
`;
  fs.writeFileSync(OUT, out);            /* LF only, single trailing newline, no BOM */
  console.error(`    wrote ${path.relative(ROOT, OUT)} — ${entries.length} entries, ${slugs.length} icons, ${(out.length / 1024).toFixed(1)} KB`);
})().catch((e) => die(e.stack || e.message));
