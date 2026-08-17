#!/usr/bin/env bash
# Shared check library for the git hooks. Sourced by pre-commit and pre-push —
# not a hook itself (git only ever runs files named after a hook).
#
# Everything here is cheap: the whole pre-commit set runs in about a second, so
# nothing is scoped to staged files for speed. It is scoped for RELEVANCE only —
# there is no point parsing every workflow when you touched a rules pack.
#
# These read the WORKING TREE, not the staged content. Partial staging
# (`git add -p`) could therefore validate bytes you are not committing. Accepted
# deliberately: reading staged blobs means temp files and rewritten error paths,
# and this repo commits whole files. The one index-aware check is
# check_manifest_tracked, because "listed but never git add-ed" is the failure
# that reading the working tree cannot see at all.

# Colours only when someone is watching.
if [ -t 1 ]; then
  H_B=$(printf '\033[1m'); H_OFF=$(printf '\033[0m')
  H_GRN=$(printf '\033[32m'); H_RED=$(printf '\033[31m'); H_DIM=$(printf '\033[2m')
else
  H_B=""; H_OFF=""; H_GRN=""; H_RED=""; H_DIM=""
fi

fail_msg() { printf '  %sFAIL%s  %s\n' "$H_RED" "$H_OFF" "$1"; }
ok_msg()   { printf '  %sok%s    %s\n' "$H_GRN" "$H_OFF" "$1"; }
skip_msg() { printf '  %s--    %s%s\n' "$H_DIM" "$1" "$H_OFF"; }

# Files staged for this commit (added/copied/modified/renamed — never deletions,
# which would otherwise be handed to `node --check` as missing paths).
staged_files() { git diff --cached --name-only --diff-filter=ACMR; }

# Every tracked file, for pre-push, where "what is staged" is the wrong question.
all_files() { git ls-files; }

# ---- individual checks. Each prints its own line and returns 0/1. ----

check_js_syntax() {
  local files bad=0 f
  files=$(printf '%s\n' "$@" | grep -E '^(src/js|scripts|src/tests)/.*\.js$' || true)
  [ -n "$files" ] || { skip_msg "js syntax (no .js touched)"; return 0; }
  for f in $files; do
    [ -f "$f" ] || continue
    node --check "$f" || bad=1
  done
  [ "$bad" -eq 0 ] && ok_msg "js syntax" || fail_msg "js syntax"
  return "$bad"
}

# A CR, a BOM or a stripped final newline changes the shipped bytes — the build
# is byte-exact, so these are correctness bugs, not style.
check_byte_hygiene() {
  local files bad=0 f
  files=$(printf '%s\n' "$@" \
    | grep -E '^(src/(js|css|html)/.*\.(js|css|html)|src/manifest\.json|src/fieldbook\.template\.html)$' || true)
  [ -n "$files" ] || { skip_msg "byte hygiene (no fragments touched)"; return 0; }
  for f in $files; do
    [ -f "$f" ] || continue
    if grep -q $'\r' "$f"; then fail_msg "CR bytes: $f"; bad=1; fi
    if [ "$(head -c3 "$f" | od -An -tx1 | tr -d ' \n')" = "efbbbf" ]; then
      fail_msg "UTF-8 BOM: $f"; bad=1
    fi
    if [ -n "$(tail -c1 "$f")" ]; then fail_msg "no trailing newline: $f"; bad=1; fi
  done
  [ "$bad" -eq 0 ] && ok_msg "byte hygiene"
  return "$bad"
}

# src/manifest.json is the authoritative order. Drift in either direction is a
# broken build; the builder hard-fails on it, so catch it before the commit.
check_manifest_parity() {
  node -e '
    const fs=require("fs"),m=require("./src/manifest.json");let bad=0;
    for(const k of ["js","css","html"]){
      if(!Array.isArray(m[k])){console.error("  manifest has no \""+k+"\" array");bad=1;continue}
      m[k].forEach(p=>{if(!fs.existsSync(p)){console.error("  listed but missing: "+p);bad=1}});
    }
    [["js","src/js",".js"],["css","src/css",".css"],["html","src/html",".html"]].forEach(([k,d,e])=>{
      let ents;try{ents=fs.readdirSync(d)}catch(err){console.error("  cannot read "+d);bad=1;return}
      ents.filter(f=>f.endsWith(e)).forEach(f=>{
        if(!m[k].includes(d+"/"+f)){console.error("  on disk but unlisted: "+d+"/"+f);bad=1}});
    });
    process.exit(bad);' 2>&1
  local rc=$?
  [ "$rc" -eq 0 ] && ok_msg "manifest parity" || fail_msg "manifest parity"
  return "$rc"
}

# The failure this exists for: a new fragment written, listed in the manifest,
# built and tested locally — and never `git add`ed. Everything passes here and
# the build produces a broken app on a clean checkout, which is the one thing
# the release workflow refuses on.
check_manifest_tracked() {
  local tracked staged bad=0 p
  tracked=$(git ls-files)
  staged=$(git diff --cached --name-only --diff-filter=ACMR)
  for p in $(node -e 'const m=require("./src/manifest.json");
                      process.stdout.write([...m.js,...m.css,...m.html].join("\n"))'); do
    if ! printf '%s\n' "$tracked" | grep -qxF "$p" && ! printf '%s\n' "$staged" | grep -qxF "$p"; then
      fail_msg "in the manifest but not tracked or staged: $p"
      printf '        %sgit add %s%s\n' "$H_DIM" "$p" "$H_OFF"
      bad=1
    fi
  done
  [ "$bad" -eq 0 ] && ok_msg "every manifest fragment is tracked"
  return "$bad"
}

check_json() {
  local files bad=0 f
  files=$(printf '%s\n' "$@" | grep -E '^(data/.*|src/manifest)\.json$' || true)
  [ -n "$files" ] || { skip_msg "json (no data touched)"; return 0; }
  for f in $files; do
    [ -f "$f" ] || continue
    node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$f" 2>&1 \
      || { fail_msg "invalid JSON: $f"; bad=1; }
  done
  [ "$bad" -eq 0 ] && ok_msg "json parses"
  return "$bad"
}

# GitHub validates workflows itself, but only once you have pushed. Skips
# cleanly with no npx and no network — a hook must never be the reason a commit
# is impossible offline.
check_yaml() {
  local files bad=0 f out
  files=$(printf '%s\n' "$@" | grep -E '^\.github/workflows/.*\.ya?ml$' || true)
  [ -n "$files" ] || { skip_msg "workflow yaml (none touched)"; return 0; }
  command -v npx >/dev/null 2>&1 || { skip_msg "workflow yaml (no npx)"; return 0; }
  for f in $files; do
    [ -f "$f" ] || continue
    if out=$(npx --yes js-yaml "$f" 2>&1 >/dev/null); then
      continue
    elif printf '%s' "$out" | grep -qiE 'network|ENOTFOUND|EAI_AGAIN|registry|offline|ECONNREFUSED'; then
      skip_msg "workflow yaml (no network)"; return 0
    else
      fail_msg "$f"; printf '%s\n' "$out"; bad=1
    fi
  done
  [ "$bad" -eq 0 ] && ok_msg "workflow yaml"
  return "$bad"
}
