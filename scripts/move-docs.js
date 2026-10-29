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
 *   relative     ../specs/example-a.md, or any markdown link target — recomputed from
 *                the file's own folder, and from its new folder if it moved
 * Fenced code blocks included. A path never holds a newline, so no file gains or
 * loses a line: the ledger's L<n> citations stay valid, and this is asserted
 * before anything is written. Everything is worked out in memory first; a bad
 * move list writes nothing. --dry-run prints the plan and writes nothing.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const P = path.posix;

const SCAN = ["CLAUDE.md", "README.md", "build.sh", "dev.sh", ".githooks", ".claude/skills", ".github/workflows", "data/packs.json", "scripts", "src", "tools/data-kit"];
const TEXT = /\.(md|js|py|sh|ya?ml|json|html|css|txt)$/;
const SKIP_DIRS = new Set(["node_modules", "__pycache__", ".git"]);
const DOCS_DIRS = ["specs", "plans", "archive", "wiki", "qa", "_claude"];
const TOKEN = /[A-Za-z0-9_.\/-]+\.(?:md|html)(?![A-Za-z0-9_-])/g;
const FENCE = /^\s*(```|~~~)/;

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
   [{line (1-based), index, token, kind: 'repo'|'docs'|'rel', target, prefix, fenced}] */
function findRefs(text, file) {
  const refs = [];
  let fenced = false;
  text.split("\n").forEach((line, i) => {
    if (FENCE.test(line)) { fenced = !fenced; return; }
    for (const m of line.matchAll(TOKEN)) {
      const token = m[0];
      const before = line.slice(0, m.index);
      const repo = /^(.*\/)?(src\/docs\/.+)$/.exec(token);
      let kind, target, prefix = "";
      if (repo) { kind = "repo"; prefix = repo[1] || ""; target = repo[2]; }
      else if (/^\.\.?\//.test(token) || /\]\($/.test(before)) {
        kind = "rel";
        target = P.normalize(P.join(P.dirname(file), token));
        if (target.startsWith("../")) continue;
      } else if (DOCS_DIRS.includes(token.split("/")[0]) && token.includes("/")) {
        kind = "docs"; target = "src/docs/" + token;
      } else continue;
      refs.push({ line: i + 1, index: m.index, token, kind, target, prefix, fenced });
    }
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

/* work out every write; nothing touches the disk.
   Returns {errors, moves, edits: [{from, to, text, count}]} where from === to for a file that stays */
function planMoves(root, moves) {
  const errors = checkMoves(root, moves);
  if (errors.length) return { errors, moves, edits: [] };
  const map = new Map(moves.map(m => [m.from, m.to]));
  const exists = p => { try { return fs.statSync(path.join(root, p)).isFile(); } catch (e) { return false; } };
  const edits = [];
  const files = new Set(scanFiles(root));
  moves.forEach(m => files.add(m.from));
  for (const f of [...files].sort()) {
    const before = fs.readFileSync(path.join(root, f), "utf8");
    const to = map.get(f) || f;
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
    fs.writeFileSync(dest, e.text);
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
