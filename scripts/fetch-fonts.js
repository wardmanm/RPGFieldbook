#!/usr/bin/env node
/* Embed the app's three web fonts (Grenze Gotisch, Cinzel, EB Garamond).
 *
 *   node scripts/fetch-fonts.js [--dry-run]
 *
 * Asks the Google Fonts css2 API for exactly the families and weights in
 * FAMILIES below, keeps the Latin faces, downloads their woff2 files and each
 * family's OFL.txt from the google/fonts repo, and writes the generated fragment
 * src/css/90-fonts.css: the copyright notices and the SIL Open Font License 1.1
 * in a comment, then one @font-face per file with a data: URL. DEV ONLY and run
 * BY HAND — never from build.sh or CI, both of which must stay offline and
 * byte-reproducible. The generated fragment is committed; it IS the vendored
 * copy of the fonts, so no font files are kept in the repo (#144).
 *
 * Latin only (Mike, 2026-11-06): Google's "latin" subset, with its own
 * unicode-range, so a letter outside it falls back to the next font in its
 * stack (Times New Roman or Georgia) for that letter.
 * Subsetting counts as modifying a font under the OFL, and a Reserved Font Name
 * would then forbid keeping the name, so a family that declares one stops this.
 *
 * The parse is deliberately STRICT, like fetch-icons.js. Google's answer depends
 * on the User-Agent and changes over time; rather than half-handle a new shape
 * (static files per weight, a renamed subset, woff instead of woff2), this dies
 * naming what it got and writes nothing. One exception is retried: now and then
 * Google answers with fonts.gstatic.com/l/font?kit=… addresses instead of
 * /s/…woff2 files, and asking again gets the files. Never widen GSTATIC to
 * take those addresses.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src/css/90-fonts.css");
const API = "https://fonts.googleapis.com/css2?";
const OFL = "https://raw.githubusercontent.com/google/fonts/main/ofl/";
const DRY = process.argv.includes("--dry-run");
/* Google serves woff2 only to a browser it knows takes it; a bare fetch gets ttf. */
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
/* The Latin set is ~135 KiB. Much more means Google changed what it serves, and
   what the app weighs is a decision, not something to drift into. */
const MAX_TOTAL = 256 * 1024;

const die = (m) => { console.error("fetch-fonts: " + m); process.exit(1); };

/* The family names must match the tokens in src/css/00-tokens.css exactly
   (src/tests/docs.js checks both ways). The weights are the ones the template's
   Google link asked for before #144, and each @font-face gets their range. A
   weight the CSS asks for beyond the range clamps to its end, as Google's faces
   did; one between two requested weights renders as asked, where Google's
   one-face-per-weight answer snapped it to the next requested one. docs.js checks
   that every weight the CSS asks for lands where it did online. */
const FAMILIES = [
  { family: "Grenze Gotisch", ofl: "grenzegotisch", faces: { normal: [500, 700, 900] } },
  { family: "Cinzel", ofl: "cinzel", faces: { normal: [500, 600, 700] } },
  { family: "EB Garamond", ofl: "ebgaramond", faces: { normal: [400, 500, 600], italic: [400] } },
];

function css2Url() {
  const fams = FAMILIES.map((f) => {
    const name = f.family.replace(/ /g, "+");
    if (!f.faces.italic) return "family=" + name + ":wght@" + f.faces.normal.join(";");
    const tuples = [...(f.faces.normal || []).map((w) => "0," + w), ...f.faces.italic.map((w) => "1," + w)];
    return "family=" + name + ":ital,wght@" + tuples.join(";");
  });
  return API + fams.join("&") + "&display=swap";
}

const RANGE = /^U\+[0-9A-F]{1,6}(?:-[0-9A-F]{1,6})?(?:, U\+[0-9A-F]{1,6}(?:-[0-9A-F]{1,6})?)*$/;
const GSTATIC = /^https:\/\/fonts\.gstatic\.com\/s\/[a-z0-9]+\/v\d+\/[A-Za-z0-9_-]+\.woff2$/;

/* One entry per (family, style): {family, style, weights, url, range}. */
function parseLatinFaces(css) {
  const blocks = [...css.matchAll(/\/\* ([a-z0-9-]+) \*\/\s*@font-face\s*\{([^}]*)\}/g)];
  if (!blocks.length) die("the css2 answer holds no labelled @font-face blocks (got: " + css.slice(0, 60) + ")");
  const prop = (b, k) => { const m = new RegExp("(?:^|;)\\s*" + k + ":\\s*([^;]+);").exec(b); return m ? m[1].trim() : null; };
  const faces = new Map();
  for (const [, subset, b] of blocks) {
    if (subset !== "latin") continue;
    const family = (prop(b, "font-family") || "").replace(/^'(.*)'$/, "$1");
    const style = prop(b, "font-style"), weight = +prop(b, "font-weight");
    const src = /^url\((\S+)\) format\('woff2'\)$/.exec(prop(b, "src") || "");
    const range = prop(b, "unicode-range") || "";
    const want = FAMILIES.find((f) => f.family === family);
    if (!want) die(`unexpected latin family "${family}"`);
    if (!want.faces[style]) die(`${family}: unexpected latin style "${style}"`);
    if (!want.faces[style].includes(weight)) die(`${family} ${style}: unexpected weight ${weight}`);
    if (!src || !GSTATIC.test(src[1])) die(`${family} ${style} ${weight}: src is not one fonts.gstatic.com woff2 (${prop(b, "src")})`);
    if (prop(b, "font-display") !== "swap") die(`${family} ${style} ${weight}: font-display is not swap`);
    if (!RANGE.test(range)) die(`${family} ${style} ${weight}: unexpected unicode-range "${range}"`);
    const key = family + "|" + style;
    const f = faces.get(key);
    if (!f) { faces.set(key, { family, style, weights: [weight], url: src[1], range }); continue; }
    if (f.url !== src[1]) die(`${family} ${style}: weights ${f.weights.join("/")} and ${weight} are different files, not one variable font`);
    if (f.range !== range) die(`${family} ${style}: the latin unicode-range differs between weights`);
    f.weights.push(weight);
  }
  const out = [];
  for (const want of FAMILIES) {
    for (const [style, weights] of Object.entries(want.faces)) {
      const f = faces.get(want.family + "|" + style);
      if (!f) die(`${want.family} ${style}: no latin face in the css2 answer`);
      const missing = weights.filter((w) => !f.weights.includes(w));
      if (missing.length) die(`${want.family} ${style}: no latin face for weight ${missing.join(", ")}`);
      out.push({ ...f, weights: [...weights].sort((a, b) => a - b) });
    }
  }
  return out;
}

const LICENSED = "This Font Software is licensed under the SIL Open Font License, Version 1.1.";
const OFL_TITLE = "SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007";

/* {notice, body}: the copyright lines above the licence, and the licence text
   from its dashed title rule to the end. Line endings and trailing whitespace
   are normalised, so the fragment stays byte-clean (.editorconfig, build-html.js). */
function licenceParts(text) {
  const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  const at = lines.indexOf(LICENSED);
  if (at < 0) throw new Error("no line \"" + LICENSED + "\"");
  const notice = lines.slice(0, at).filter(Boolean);
  if (!notice.length || !notice.every((l) => /^Copyright /.test(l))) throw new Error("the lines above the licence are not copyright notices: " + JSON.stringify(notice));
  /* The OFL's own definitions mention "Reserved Font Name"; a family DECLARES
     one in its notice, as "... with Reserved Font Name X". */
  if (notice.some((l) => /Reserved Font Name/i.test(l))) throw new Error("it declares a Reserved Font Name, which subsetting would breach — stop and ask");
  const t = lines.indexOf(OFL_TITLE);
  if (t < 1 || !/^-{20,}$/.test(lines[t - 1])) throw new Error("no \"" + OFL_TITLE + "\" title under a dashed rule");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const body = lines.slice(t - 1).join("\n");
  const all = notice.join("\n") + body;
  if (all.includes("*/")) throw new Error("the text holds */, which would end the CSS comment");
  /* The comment sits inside the page's one <style>, so this would end that too. */
  if (/<\/style/i.test(all)) throw new Error("the text holds </style, which would end the page's stylesheet");
  return { notice, body };
}

const b64Bytes = (n) => 4 * Math.ceil(n / 3);

function fragmentCSS(faces, notices, body) {
  const head =
`/* ============ Embedded web fonts — GENERATED, DO NOT EDIT ============
   Written by scripts/fetch-fonts.js from the Google Fonts css2 API. To change a
   family or a weight, edit FAMILIES in that script and re-run:
     node scripts/fetch-fonts.js

   The families the tokens in 00-tokens.css name, embedded so the page makes no
   font request at all (CLAUDE.md constraint 1) and looks the same offline as
   online (#144). Google's "latin" subset only, with its own unicode-range: a
   letter outside it, such as "Ł", falls back to the next font in its stack
   (Times New Roman or Georgia) for that letter. Each style is one woff2 file
   covering every weight listed: a variable font where several are listed.

   Fonts and their copyright notices:
${notices.map(([fam, lines]) => lines.map((l, i) => "   " + (i ? " ".repeat(fam.length + 2) : fam + ": ") + l).join("\n")).join("\n")}

   No family declares a Reserved Font Name; fetch-fonts.js refuses one that does,
   since subsetting a font modifies it under the licence. The fonts are credited
   in Settings -> Credits and in README section 10.

   This Font Software is licensed under the SIL Open Font License, Version 1.1.
   This license is copied below, and is also available with a FAQ at:
   https://openfontlicense.org

${body}
*/
`;
  const face = (f, bytes) => {
    const w = f.weights[0] === f.weights[f.weights.length - 1] ? String(f.weights[0]) : f.weights[0] + " " + f.weights[f.weights.length - 1];
    const sha = crypto.createHash("sha256").update(bytes).digest("hex");
    return `/* ${f.family}, ${f.style}, weights ${f.weights.join("/")}: latin, ${bytes.length} bytes, sha256 ${sha}, from ${f.url} */\n` +
      `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${w};font-display:swap;\n` +
      `  unicode-range:${f.range};\n` +
      `  src:url("data:font/woff2;base64,${bytes.toString("base64")}") format("woff2")}\n`;
  };
  return head + faces.map((f) => face(f, f.bytes)).join("");
}

async function get(url, as) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return as === "bytes" ? Buffer.from(await res.arrayBuffer()) : res.text();
}

async function main() {
  let css;
  for (let tries = 1; ; tries++) {
    css = await get(css2Url(), "text");
    if (!/fonts\.gstatic\.com\/l\/font\?/.test(css)) break;
    if (tries === 3) die("Google answered three times with fonts.gstatic.com/l/font?kit=… addresses, not /s/…woff2 files. " +
                         "It does this now and then: re-run later. Never widen GSTATIC to take them.");
    console.error("    Google answered with /l/font?kit=… addresses; asking again");
  }
  const faces = parseLatinFaces(css);

  let total = 0;
  for (const f of faces) {
    f.bytes = await get(f.url, "bytes");
    if (f.bytes.subarray(0, 4).toString("latin1") !== "wOF2") die(`${f.family} ${f.style}: ${f.url} is not a woff2 file`);
    total += f.bytes.length;
    console.error(`    ${f.family}, ${f.style}, ${f.weights.join("/")}: ${f.bytes.length} bytes`);
  }
  if (total > MAX_TOTAL) die(`the Latin files total ${total} bytes, over ${MAX_TOTAL}: Google is serving something else — check before embedding it`);

  const notices = [];
  let body = null;
  for (const fam of FAMILIES) {
    let parts;
    try { parts = licenceParts(await get(OFL + fam.ofl + "/OFL.txt", "text")); }
    catch (e) { die(`${fam.family}'s OFL.txt: ${e.message}`); }
    if (body !== null && parts.body !== body) die(`${fam.family}'s OFL.txt carries a different licence text from the others; the fragment holds it once`);
    body = parts.body;
    notices.push([fam.family, parts.notice]);
    console.error(`    ${fam.family}: ${parts.notice.join(" / ")} — no Reserved Font Name`);
  }

  const out = Buffer.from(fragmentCSS(faces, notices, body), "utf8");
  if (out.includes(0x0d)) die("the fragment would hold a CR byte");
  if (out.includes(Buffer.from([0xef, 0xbb, 0xbf]))) die("the fragment would hold a BOM");
  if (/[ \t]$/m.test(out.toString("utf8"))) die("the fragment would hold trailing whitespace");
  const b64 = faces.reduce((a, f) => a + b64Bytes(f.bytes.length), 0);
  console.error(`    ${faces.length} files, ${total} bytes; ${b64} bytes as base64; the fragment is ${out.length} bytes`);
  if (DRY) { console.error("    --dry-run: nothing written"); return; }
  fs.writeFileSync(OUT, out);            /* LF only, single trailing newline, no BOM */
  console.error(`    wrote ${path.relative(ROOT, OUT)}`);
}

/* Required rather than run (a throwaway check), it fetches nothing. */
if (require.main === module) main().catch((e) => die(e.stack || e.message));
else module.exports = { css2Url, parseLatinFaces, licenceParts, fragmentCSS };
