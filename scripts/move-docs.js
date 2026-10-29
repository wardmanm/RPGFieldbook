#!/usr/bin/env node
/*
 * Move dev docs and rewrite every reference to them (#127, the pre-release
 * spec, src/docs/specs/2026-10-29-pre-release-design.md §4 step 1.3).
 *
 *   node scripts/move-docs.js <moves.json> [--dry-run] [--root DIR]
 *
 * moves.json is [{"from": "src/docs/specs/example-a.md", "to": "src/docs/specs/1.9.0/example-a.md"}, ...],
 * repo-relative. Every file under SCAN is searched; a reference is rewritten in
 * the form it was written in:
 *   repo-rooted  src/docs/specs/example-a.md, also after a prefix (/abs/repo/src/docs/…)
 *   docs-rooted  specs/example-a.md — relative to src/docs/, as code comments write it
 *   relative     a markdown link or image target, `](…)`, whatever its extension —
 *                a folder (`../specs/`), an anchor (`../x.md#sec`), an image — or, outside
 *                link syntax, a bare `./`/`../`-prefixed `.md`/`.html` mention (reference-style
 *                links, quoted examples). Recomputed from the file's own folder, and from
 *                its new folder if it moved. A URL, an absolute path and a pure `#anchor`
 *                are left alone.
 * Fenced code blocks included. A path never holds a newline, so no file gains or
 * loses a line: the ledger's L<n> citations stay valid, and this is asserted
 * before anything is written. Everything is worked out in memory first; a bad
 * move list writes nothing. --dry-run prints the plan and writes nothing.
 *
 * Only text is rewritten. Every file is read as a Buffer first; one that contains a NUL
 * byte or isn't valid UTF-8 is moved byte for byte and never scanned for references (#127
 * fix round 1, finding 2) — a future archive move of a whole document (an image, a PDF)
 * must not be corrupted by a UTF-8 round trip.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const P = path.posix;

const SCAN = ["CLAUDE.md", "README.md", "build.sh", "dev.sh", ".githooks", ".claude/skills", ".github/workflows", "data/packs.json", "scripts", "src", "tools/data-kit"];
const TEXT = /\.(md|js|py|sh|ya?ml|json|html|css|txt)$/;
const SKIP_DIRS = new Set(["node_modules", "__pycache__", ".git"]);
const DOCS_DIRS = ["specs", "plans", "archive", "wiki", "qa", "_claude"];
/* a bare repo- or docs-rooted mention, anywhere in the text, always ending in .md/.html */
const TOKEN = /[A-Za-z0-9_.\/-]+\.(?:md|html)(?![A-Za-z0-9_-])/g;
/* a markdown link or image target, `](…)`, any extension or none, up to `)`, `#`, a space,
   `>` or a backtick; `<?` skips the angle-bracket form's open bracket without capturing it.
   Anchored on the literal `](` so it never matches inside a link's own label text. */
const LINK_TARGET = /\]\(<?([^\s)>"'#\]`(]+)/g;
const FENCE = /^\s*(```|~~~)/;
const REPO_PATTERN = /^(.*\/)?(src\/docs\/.+)$/;
const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/* every text file under SCAN that exists, repo-relative, sorted */
function scanFiles(root) {
  const out = [];
  const walk = rel => {
    const abs = path.join(root, rel);
    let st;
    try { st = fs.statSync(abs); } catch (e) { return; }
    if (st.isFile()) { if (TEXT.test(rel)) out.push(rel); return; }
    if (!st.isDirectory()) return;
    for (const name of fs.readdirSync(abs)) if (!SKIP_DIRS.has(name)) walk(P.join(rel, name));
  };
  SCAN.forEach(walk);
  return [...new Set(out)].sort();
}

/* the references to a doc in `text`, which lives at repo path `file`:
   [{line (1-based), index, token, kind: 'repo'|'docs'|'rel', target, prefix, fenced}]
   in the order they appear. Two passes per line, merged by index:
   TOKEN finds repo- and docs-rooted bare mentions (always .md/.html, anywhere in the
   text) and, outside any `](…)`, a bare ./- or ../-prefixed .md/.html mention (a
   reference-style link or a quoted example) — gated on the extension so it can never
   match a fragment of a link's own label text, such as the "./" in "[./ form]".
   LINK_TARGET finds every markdown link/image target, whatever its extension, but only
   inside `](…)`, so it never strays into label text either; a target that is itself a
   src/docs/ mention, a URL or an absolute path is left to TOKEN or left alone. */
function findRefs(text, file) {
  const refs = [];
  let fenced = false;
  text.split("\n").forEach((line, i) => {
    if (FENCE.test(line)) { fenced = !fenced; return; }
    const cands = [];
    for (const m of line.matchAll(TOKEN)) {
      const token = m[0];
      const before = line.slice(0, m.index);
      const inLink = /\]\($/.test(before);
      const repo = REPO_PATTERN.exec(token);
      if (repo) { cands.push({ index: m.index, token, kind: "repo", target: repo[2], prefix: repo[1] || "" }); continue; }
      if (inLink) continue; // a link target, any extension: left to LINK_TARGET below
      if (/^\.\.?\//.test(token)) {
        const target = P.normalize(P.join(P.dirname(file), token));
        if (target.startsWith("../")) continue;
        cands.push({ index: m.index, token, kind: "rel", target, prefix: "" });
      } else if (DOCS_DIRS.includes(token.split("/")[0]) && token.includes("/")) {
        cands.push({ index: m.index, token, kind: "docs", target: "src/docs/" + token, prefix: "" });
      }
    }
    for (const m of line.matchAll(LINK_TARGET)) {
      const token = m[1];
      if (!token || REPO_PATTERN.test(token) || token.startsWith("/") || URL_SCHEME.test(token)) continue;
      const target = P.normalize(P.join(P.dirname(file), token));
      if (target.startsWith("../")) continue;
      const index = m.index + (m[0].length - token.length);
      cands.push({ index, token, kind: "rel", target, prefix: "" });
    }
    cands.sort((a, b) => a.index - b.index);
    for (const c of cands) refs.push({ line: i + 1, index: c.index, token: c.token, kind: c.kind, target: c.target, prefix: c.prefix, fenced });
  });
  return refs;
}

/* `text` from `fileOld`, rewritten for its home `fileNew` and the moves in `map`
   (old repo path -> new); exists(p) says whether repo path p is a file.
   Returns {text, count}. */
function rewriteText(text, fileOld, fileNew, map, exists) {
  const moved = fileOld !== fileNew;
  const lines = text.split("\n");
  let count = 0;
  const byLine = new Map();
  for (const r of findRefs(text, fileOld)) {
    let next = null;
    if (r.kind === "repo" && map.has(r.target)) next = r.prefix + map.get(r.target);
    else if (r.kind === "docs" && map.has(r.target)) next = map.get(r.target).slice("src/docs/".length);
    else if (r.kind === "rel" && (map.has(r.target) || (moved && exists(r.target)))) {
      const to = map.get(r.target) || r.target;
      next = P.relative(P.dirname(fileNew), to);
      if (r.token.startsWith("./") && !next.startsWith("../")) next = "./" + next;
      if (r.token.endsWith("/") && !next.endsWith("/")) next += "/"; // a folder link, e.g. ../specs/
    }
    if (next === null || next === r.token) continue;
    if (!byLine.has(r.line)) byLine.set(r.line, []);
    byLine.get(r.line).push([r.index, r.token.length, next]);
  }
  for (const [n, edits] of byLine) {
    let s = lines[n - 1];
    edits.sort((a, b) => b[0] - a[0]).forEach(([at, len, rep]) => { s = s.slice(0, at) + rep + s.slice(at + len); count++; });
    lines[n - 1] = s;
  }
  return { text: lines.join("\n"), count };
}

/* check a move list against the tree at root; returns a list of problems */
function checkMoves(root, moves) {
  const errs = [];
  if (!Array.isArray(moves) || !moves.length) return ["the move list is empty or not a list"];
  const froms = new Set(), tos = new Set();
  for (const mv of moves) {
    const from = mv && mv.from, to = mv && mv.to;
    if (typeof from !== "string" || typeof to !== "string") { errs.push("a move needs a from and a to: " + JSON.stringify(mv)); continue; }
    for (const p of [from, to]) {
      if (!p.startsWith("src/docs/") || P.normalize(p) !== p || p.includes("..")) errs.push(p + " is not a plain path under src/docs/");
    }
    if (P.extname(from) !== P.extname(to)) errs.push(from + " -> " + to + " changes the file type");
    if (!fs.existsSync(path.join(root, from)) || !fs.statSync(path.join(root, from)).isFile()) errs.push(from + " does not exist");
    if (fs.existsSync(path.join(root, to))) errs.push(to + " already exists");
    if (froms.has(from)) errs.push(from + " is moved twice");
    if (tos.has(to)) errs.push(to + " is the target of two moves");
    froms.add(from); tos.add(to);
  }
  for (const t of tos) if (froms.has(t)) errs.push(t + " is both moved and a target");
  return errs;
}

/* true if buf is plain text: no NUL byte, and a clean UTF-8 round trip. A file that
   fails this is never read as a string and never scanned for references (#127 fix
   round 1, finding 2) — it is moved, if it moves at all, byte for byte. */
function isTextBuf(buf) {
  if (buf.includes(0)) return false;
  return Buffer.from(buf.toString("utf8"), "utf8").equals(buf);
}

/* work out every write; nothing touches the disk.
   Returns {errors, moves, edits} where each edit is {from, to, count} plus either
   `text` (a rewritten text file) or `buf` (a binary file moved byte for byte, count 0);
   from === to for a text file that stays but gets an edit */
function planMoves(root, moves) {
  const errors = checkMoves(root, moves);
  if (errors.length) return { errors, moves, edits: [] };
  const map = new Map(moves.map(m => [m.from, m.to]));
  const exists = p => { try { fs.statSync(path.join(root, p)); return true; } catch (e) { return false; } };
  const edits = [];
  const files = new Set(scanFiles(root));
  moves.forEach(m => files.add(m.from));
  for (const f of [...files].sort()) {
    const to = map.get(f) || f;
    const buf = fs.readFileSync(path.join(root, f));
    if (!isTextBuf(buf)) {
      if (to !== f) edits.push({ from: f, to, buf, count: 0 }); // moved whole, never scanned
      continue;
    }
    const before = buf.toString("utf8");
    const r = rewriteText(before, f, to, map, exists);
    if (r.text.split("\n").length !== before.split("\n").length) {
      errors.push(f + ": a rewrite changed the number of lines");
      continue;
    }
    if (r.count || to !== f) edits.push({ from: f, to, text: r.text, count: r.count });
  }
  return { errors, moves, edits };
}

function applyPlan(root, plan) {
  for (const e of plan.edits) {
    const dest = path.join(root, e.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, e.buf !== undefined ? e.buf : e.text);
    if (e.to !== e.from) fs.unlinkSync(path.join(root, e.from));
  }
}

function main(argv) {
  const args = argv.slice(2);
  const dry = args.includes("--dry-run");
  const ri = args.indexOf("--root");
  const root = ri >= 0 ? path.resolve(args[ri + 1] || "") : path.resolve(__dirname, "..");
  const list = args.filter((a, i) => !a.startsWith("--") && (ri < 0 || i !== ri + 1))[0];
  if (!list) {
    console.error("move-docs: usage: node scripts/move-docs.js <moves.json> [--dry-run] [--root DIR]");
    console.error("move-docs: nothing was written");
    return 1;
  }
  let moves;
  try { moves = JSON.parse(fs.readFileSync(list, "utf8")); }
  catch (e) {
    console.error("move-docs: cannot read " + list + ": " + e.message);
    console.error("move-docs: nothing was written");
    return 1;
  }
  const plan = planMoves(root, moves);
  if (plan.errors.length) { plan.errors.forEach(e => console.error("move-docs: " + e)); console.error("move-docs: nothing was written"); return 1; }
  for (const m of moves) console.log("move  " + m.from + " -> " + m.to);
  let refs = 0, files = 0;
  for (const e of plan.edits) if (e.count) { console.log("edit  " + e.to + " (" + e.count + ")"); refs += e.count; files++; }
  console.log(moves.length + " moved, " + refs + " references rewritten in " + files + " files" + (dry ? " (dry run: nothing written)" : ""));
  if (!dry) applyPlan(root, plan);
  return 0;
}

module.exports = { SCAN, scanFiles, findRefs, rewriteText, checkMoves, planMoves, applyPlan };
if (require.main === module) process.exit(main(process.argv));
