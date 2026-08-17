#!/usr/bin/env node
/*
 * Fieldbook builder — concatenate src/ fragments into the single-file app.
 *
 * See src/docs/ADR-001-source-split.md. src/ is the source of truth; dist/fieldbook.html
 * is a build artifact. Never hand-edit the artifact — edit fragments and rebuild.
 *
 *   node scripts/build-html.js            build (with clobber guard)
 *   node scripts/build-html.js --check    no write; exit 1 if the artifact is stale
 *   node scripts/build-html.js --force    build, bypassing the clobber guard
 *
 * Everything here is Buffer-based: no string decoding, so encoding cannot corrupt
 * the output, and the build is byte-exact by construction.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = "src/fieldbook.template.html";
const MANIFEST = "src/manifest.json";
const OUT = "dist/fieldbook.html";
const STAMP = "dist/.buildstamp";

// A marker "unit" is the token PLUS its trailing newline. Splicing out the whole
// unit and splicing in a blob that ends with exactly one \n is what keeps the
// output byte-exact — leave the newline behind and you get a spurious blank line.
const M_CSS = Buffer.from("/*@@CSS@@*/\n");
const M_JS = Buffer.from("//@@JS@@\n");
// Unlike the CSS marker (an HTML comment inside <style> is not a CSS comment —
// see ADR-001), this one sits in body context, where <!-- --> is a real comment.
const M_HTML = Buffer.from("<!--@@HTML@@-->\n");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const FORCE = args.includes("--force");
for (const a of args) {
  if (a !== "--check" && a !== "--force") die(`unknown option: ${a}`);
}

function die(msg) {
  console.error("build-html: " + msg);
  process.exit(1);
}
const abs = (rel) => path.join(ROOT, rel);
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/* ---------------- manifest + fragment-order drift ---------------- */

function readManifest() {
  let m;
  try {
    m = JSON.parse(fs.readFileSync(abs(MANIFEST), "utf8"));
  } catch (e) {
    die(`cannot read ${MANIFEST}: ${e.message}`);
  }
  for (const k of ["css", "js", "html"]) {
    if (!Array.isArray(m[k])) die(`${MANIFEST}: "${k}" must be an array`);
  }
  if (!m.js.length) die(`${MANIFEST}: "js" is empty — nothing to build`);
  if (!m.html.length) die(`${MANIFEST}: "html" is empty — the body would be blank`);
  return m;
}

// Fails loudly in BOTH directions: a fragment listed but absent, or present on
// disk but unlisted. The second case is the one a sorted glob would ship
// silently (e.g. a stray 50-x.OLD.js concatenated ahead of 50-x.js).
function validateOrder(list, dir, ext) {
  const prefix = dir + "/";
  const seen = new Set();
  for (const rel of list) {
    if (typeof rel !== "string") die(`${MANIFEST}: non-string entry in ${dir}`);
    if (!rel.startsWith(prefix)) die(`${MANIFEST}: "${rel}" is not under ${prefix}`);
    const base = rel.slice(prefix.length);
    if (base.includes("/") || base.includes("..") || base === "") {
      die(`${MANIFEST}: "${rel}" must name a file directly in ${dir}`);
    }
    if (!base.endsWith(ext)) die(`${MANIFEST}: "${rel}" does not end in ${ext}`);
    if (seen.has(rel)) die(`${MANIFEST}: duplicate entry "${rel}"`);
    seen.add(rel);
  }

  let entries;
  try {
    entries = fs.readdirSync(abs(dir), { withFileTypes: true });
  } catch (e) {
    die(`cannot read ${dir}: ${e.message}`);
  }
  const onDisk = new Set();
  for (const e of entries) {
    if (!e.name.endsWith(ext)) continue;
    if (e.isSymbolicLink()) {
      die(`${dir}/${e.name} is a symlink — source fragments must be real files ` +
          `(symlinks break reproducible builds)`);
    }
    if (!e.isFile()) die(`${dir}/${e.name} is not a regular file`);
    onDisk.add(prefix + e.name);
  }

  const missing = [...seen].filter((r) => !onDisk.has(r));
  const extra = [...onDisk].filter((r) => !seen.has(r));
  if (missing.length || extra.length) {
    console.error(`build-html: FRAGMENT ORDER DRIFT in ${dir}`);
    if (missing.length) console.error("  in manifest, missing on disk:\n    " + missing.join("\n    "));
    if (extra.length) console.error("  on disk, absent from manifest:\n    " + extra.join("\n    "));
    console.error(`  fix ${MANIFEST} (or delete the stray file), then rebuild.`);
    process.exit(1);
  }
}

/* ---------------- fragment reads ---------------- */

function readFragment(rel) {
  let buf;
  try {
    buf = fs.readFileSync(abs(rel));
  } catch (e) {
    die(`cannot read ${rel}: ${e.message}`);
  }
  if (buf.length === 0) die(`empty fragment: ${rel}`);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    // A BOM before "use strict"; breaks the directive prologue and silently
    // disables strict mode — node --check would not catch it.
    die(`UTF-8 BOM in ${rel} — save it without a byte-order mark`);
  }
  if (buf.includes(0x0d)) {
    die(`CR byte in ${rel} (CRLF line endings?) — see .gitattributes`);
  }
  if (buf[buf.length - 1] !== 0x0a) {
    console.warn(`build-html: warning: ${rel} has no trailing newline; adding one`);
    buf = Buffer.concat([buf, Buffer.from("\n")]);
  }
  return buf;
}

/* ---------------- assemble ---------------- */

function locate(tpl, marker, label) {
  const i = tpl.indexOf(marker);
  if (i < 0) die(`marker not found in ${TEMPLATE}: ${label}`);
  if (tpl.indexOf(marker, i + 1) >= 0) die(`marker appears more than once in ${TEMPLATE}: ${label}`);
  return i;
}

function build() {
  const m = readManifest();
  validateOrder(m.css, "src/css", ".css");
  validateOrder(m.js, "src/js", ".js");
  validateOrder(m.html, "src/html", ".html");

  const cssBlob = Buffer.concat(m.css.map(readFragment));
  const jsBlob = Buffer.concat(m.js.map(readFragment));
  // No separator between fragments: each already ends in exactly one \n (and
  // fragments 1..n-1 carry the blank line that used to separate the panels), so
  // concatenating them reproduces the original body byte for byte.
  const htmlBlob = Buffer.concat(m.html.map(readFragment));

  // ADR rule 2: boot() must be the very last statement, on its own final line.
  // Enforced here so it stays a machine-checked invariant rather than a convention.
  // A stray extra newline at the end of the last fragment makes this fail, which
  // is the point — do not "helpfully" trim it, that would mask real damage.
  const TAIL = Buffer.from("boot();\n");
  if (!jsBlob.subarray(-TAIL.length).equals(TAIL)) {
    die(`the JS must end with exactly "boot();" on its own last line ` +
        `(check the end of ${m.js[m.js.length - 1]} for stray blank lines)`);
  }

  let tpl;
  try {
    tpl = fs.readFileSync(abs(TEMPLATE));
  } catch (e) {
    die(`cannot read ${TEMPLATE}: ${e.message}`);
  }

  // Single splice pass over the ORIGINAL template, with indices computed up
  // front. Sequential String.replace() calls would be order-dependent (a CSS
  // blob containing the JS marker could eat the JS insertion) and would honour
  // $&/$'/$1 special patterns inside the replacement. Splicing has neither flaw.
  const parts = [
    { i: locate(tpl, M_CSS, "/*@@CSS@@*/"), len: M_CSS.length, blob: cssBlob },
    { i: locate(tpl, M_JS, "//@@JS@@"), len: M_JS.length, blob: jsBlob },
    { i: locate(tpl, M_HTML, "<!--@@HTML@@-->"), len: M_HTML.length, blob: htmlBlob },
  ].sort((a, b) => a.i - b.i);

  const out = [];
  let cur = 0;
  for (const p of parts) {
    out.push(tpl.subarray(cur, p.i), p.blob);
    cur = p.i + p.len;
  }
  out.push(tpl.subarray(cur));
  return Buffer.concat(out);
}

/* ---------------- clobber guard ---------------- */

// The pre-split habit was "edit fieldbook.html". Overwriting such an edit with
// no trace would lose it for good — the artifact is generated, so git checkout
// cannot bring it back either.
function headRef() {
  for (const p of ["HEAD:dist/fieldbook.html", "HEAD:fieldbook.html"]) {
    const r = spawnSync("git", ["-C", ROOT, "show", p], { maxBuffer: 1 << 26 });
    if (r.status === 0 && r.stdout && r.stdout.length) return r.stdout;
  }
  return null; // no reference available; not an error
}

function readStamp() {
  try {
    return fs.readFileSync(abs(STAMP), "utf8").trim();
  } catch (e) {
    return null; // absent on a fresh clone; the HEAD comparison covers that
  }
}

function mayOverwrite(existing, builtHash) {
  if (FORCE) return true;
  const h = sha(existing);
  if (h === readStamp()) return true; // our own last output
  const ref = headRef();
  if (ref && h === sha(ref)) return true; // pristine committed artifact
  console.error(`build-html: REFUSING TO OVERWRITE ${OUT}`);
  console.error("  It differs from this build's output AND from the last build AND from HEAD.");
  console.error("  It was probably hand-edited. " + OUT + " is a build artifact.");
  console.error(`  -> port the change into src/ (see: git diff -- ${OUT}), then rebuild`);
  console.error("  -> or discard it:  node scripts/build-html.js --force");
  return false;
}

/* ---------------- main ---------------- */

const built = build();
const outPath = abs(OUT);
const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath) : null;

if (CHECK) {
  if (existing && existing.equals(built)) {
    console.log(`build-html: ${OUT} is up to date (${built.length} bytes)`);
    process.exit(0);
  }
  console.error(`build-html: ${OUT} is STALE — rebuild with: node scripts/build-html.js`);
  if (!existing) console.error("  (the file does not exist)");
  else console.error(`  on disk: ${existing.length} bytes / ${sha(existing).slice(0, 12)}` +
                     `   built: ${built.length} bytes / ${sha(built).slice(0, 12)}`);
  process.exit(1);
}

if (existing && existing.equals(built)) {
  // No-op on purpose: skipping the write preserves the mtime and keeps
  // `git status` quiet when nothing actually changed.
  fs.writeFileSync(abs(STAMP), sha(built) + "\n");
  console.log(`build-html: ${OUT} is up to date (${built.length} bytes)`);
  process.exit(0);
}

if (existing && !mayOverwrite(existing, sha(built))) process.exit(1);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
// Default 'w' truncates in place, preserving the existing file mode. Do not
// switch to write-temp-then-rename: a new inode picks up 0666 & ~umask, which
// can surface as a spurious mode change in git on another machine.
fs.writeFileSync(outPath, built);
fs.writeFileSync(abs(STAMP), sha(built) + "\n");
console.log(`build-html: wrote ${OUT} (${built.length} bytes, sha256 ${sha(built).slice(0, 12)}…)`);
