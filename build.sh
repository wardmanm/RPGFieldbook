#!/usr/bin/env bash
# Fieldbook build: concatenate src/ into dist/fieldbook.html, validate everything,
# regenerate docs/CHANGELOG.md from the in-app CHANGELOG array, and produce
# dist/fieldbook-v<version>.zip. Run from the repo root:
#
#   ./build.sh                    build + validate. NEVER changes the version.
#   ./build.sh --no-zip           skip the zips — fast path to dist/fieldbook.html
#   ./build.sh --release patch    cut a release first, then build
#   ./build.sh --release minor
#   ./build.sh --release major
#   ./build.sh --release 2.0.0    explicit version
#
# Releasing is a separate, deliberate act: it folds the pending notes from
# src/docs/UNRELEASED.md into a new CHANGELOG entry and bumps APP_VERSION.
# A bare build has to be safe to run constantly, so it must not touch either.
#
# Build with unreleased notes pending and the zips are marked "+dev" — their
# contents are NOT the version their name would otherwise claim.
set -euo pipefail
cd "$(dirname "$0")"

RELEASE=""
NOZIP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --release)
      shift
      [ $# -gt 0 ] || { echo "--release needs a level: patch | minor | major | X.Y.Z"; exit 1; }
      RELEASE="$1"; shift ;;
    --release=*) RELEASE="${1#*=}"; shift ;;
    --no-zip) NOZIP=1; shift ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (try --help)"; exit 1 ;;
  esac
done

# Closing output, shared by the normal path and the --no-zip early exit.
# VER/PENDING are set later; the body is evaluated at call time.
finish(){
  echo "==> Done (v$VER). Remember: browser smoke-test any UI changes before publishing."
  if [ -z "$RELEASE" ] && [ "$PENDING" -gt 0 ]; then
    echo "    $PENDING unreleased note(s) in src/docs/UNRELEASED.md — still on v$VER."
    echo "    Cut a release with: ./build.sh --release patch|minor|major"
  fi
}

# A private temp dir, not a fixed name in a world-writable /tmp. The .js
# extension is required: node --check refuses to parse an unknown extension.
TMPDIR_BUILD=$(mktemp -d -t fieldbook)
TMPJS="$TMPDIR_BUILD/_fieldbook.js"
trap 'rm -rf "$TMPDIR_BUILD"' EXIT

# Must run before the build so the built app carries the new version.
if [ -n "$RELEASE" ]; then
  echo "==> Cutting release ($RELEASE)"
  node scripts/release.js "$RELEASE" >/dev/null
fi

# ---------------------------------------------------------------------------
# Source split — see src/docs/ADR-001-source-split.md. src/ is the source of truth;
# dist/fieldbook.html is a build artifact. Never hand-edit it.
# This must run FIRST: every check below reads the built file.
# ---------------------------------------------------------------------------
echo "==> Building dist/fieldbook.html from src/"
node scripts/build-html.js

echo "==> Checking each src/js fragment (node --check)"
# Every fragment is a complete run of top-level statements, so each parses alone.
# Worth doing before the whole-file check purely for error attribution: you get
# src/js/56-class.js:88 instead of a line number in the 2,600-line concatenation.
node -e 'process.stdout.write(require("./src/manifest.json").js.join("\n"))' \
  | while IFS= read -r f; do node --check "$f" || { echo "    FAILED: $f"; exit 1; }; done
echo "    ok"

echo "==> Checking app JavaScript (node --check)"
node - "$TMPJS" <<'NODE'
const fs=require("fs");
const html=fs.readFileSync("dist/fieldbook.html","utf8");
const js=(html.match(/<script>([\s\S]*?)<\/script>/g)||[])
  .map(b=>b.replace(/^<script>/,"").replace(/<\/script>$/,"")).join("\n");
fs.writeFileSync(process.argv[2],js);
NODE
node --check "$TMPJS"
echo "    ok"

echo "==> Validating data/**/*.json"
DATAFILES=$(find data -name '*.json' | sort)
for f in $DATAFILES; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || { echo "    INVALID: $f"; exit 1; }
done
echo "    ok ($(echo "$DATAFILES" | wc -l | tr -d ' ') files)"

# Roll each system's per-category files into one importable pack. This is what
# players get; the individual files stay in the repo for cherry-picking.
echo "==> Bundling rules packs"
node scripts/bundle-rules.js || { echo "    bundling failed"; exit 1; }

echo "==> Regenerating docs/CHANGELOG.md from the in-app CHANGELOG array"
VER=$(node scripts/gen-changelog.js)
echo "    app version: v$VER"

# The zips are named for the version, matching the vX.Y.Z release tag the in-app
# update check compares against. Guard it: an empty VER would silently produce
# "fieldbook-v.zip" and quietly ship an unidentifiable bundle.
case "$VER" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) echo "    BAD APP_VERSION: '$VER' (want X.Y.Z)"; exit 1 ;;
esac
# Count the notebook once: it decides both the zip naming and the closing nudge.
PENDING=0
if [ -f src/docs/UNRELEASED.md ]; then
  PENDING=$(sed -n '/^## Pending/,$p' src/docs/UNRELEASED.md | grep -c '^- ' || true)
fi

if [ -n "$NOZIP" ]; then
  echo "==> Skipping zips (--no-zip)"
  finish
  exit 0
fi

# A build carrying unreleased work is NOT the version it would otherwise be
# named for, and a zip named fieldbook-v1.2.1.zip that isn't v1.2.1 is a trap
# for whoever you hand it to. "+dev" is semver build metadata: 1.2.1+dev reads
# as "1.2.1 plus extra", which is what it is. ("-dev" would mean a PRE-release
# of 1.2.1 — the opposite.) --release empties the notebook first, so releases
# and clean rebuilds keep their plain names; the release workflow relies on that.
TAGSUF=""
if [ -z "$RELEASE" ] && [ "$PENDING" -gt 0 ]; then
  TAGSUF="+dev"
  echo "    $PENDING unreleased note(s) pending — naming the zips v$VER$TAGSUF"
fi
BUNDLE="dist/fieldbook-v$VER$TAGSUF.zip"
SOURCE="dist/fieldbook-v$VER$TAGSUF-source.zip"

# Clear every old zip so dist/ never accumulates stale versions, and a failed
# build can't leave last version's bundle looking like the current one.
rm -f dist/*.zip

echo "==> Building $BUNDLE"
# PLAYER-FACING BUNDLE ONLY. This is an allowlist on purpose: it must match what
# README section 9 tells players they are getting, and nothing else. Development
# material (src/, CLAUDE.md, build.sh, the dev docs under src/docs/, the build
# scripts, dotfiles) is deliberately excluded — the repo is where that lives.
# fieldbook.html sits at the ZIP root next to data/; dist/ is a repo-layout
# detail, not a download one.
rm -rf .buildtmp
mkdir -p .buildtmp/data .buildtmp/docs .buildtmp/scripts
cp dist/fieldbook.html .buildtmp/
cp README.md .buildtmp/
# The app is MIT; shipping it without its licence would be an oversight.
cp LICENSE .buildtmp/
# ONE pack per system, not the per-category files — players import two files, not
# sixteen. The individual files remain in the repo (and in the source zip).
cp dist/5e2024_full.json dist/humblewood_full.json .buildtmp/data/
cp docs/*.md .buildtmp/docs/
cp scripts/convert.py .buildtmp/scripts/
# convert.py's hand-authored inputs travel with it — without them an advanced
# player regenerating data silently loses the Archery/Defense effects and the
# Rage/Focus/Sorcery trackers. (They are not loadable rules packs, so they must
# NOT go in data/.)
cp data/overlay.json data/class-resources.json .buildtmp/scripts/
( cd .buildtmp && zip -rq "../$BUNDLE" . -x '*.DS_Store' )
rm -rf .buildtmp
echo "    wrote $BUNDLE"

# Guard the allowlist: fail loudly if anything development-shaped slipped in.
node - "$BUNDLE" <<'NODE'
const {execFileSync}=require("child_process");
const zip=process.argv[2];
const names=execFileSync("unzip",["-Z1",zip],{encoding:"utf8"})
  .split("\n").map(s=>s.replace(/^\.\//,"")).filter(Boolean);
// ^src\/ already covers src/tests/ — the audience rule does that work for us.
const banned=names.filter(n=>/^src\/|^CLAUDE\.md$|^build\.sh$|^dev\.sh$|^\.|WIRING-LEDGER|ADR-\d|UNRELEASED|RELEASING|build-html\.js|gen-changelog\.js|release(-notes)?\.js|bundle-rules\.js|extract-humblewood\.py/.test(n));
// data/ must hold ONLY the bundled packs — a stray per-category file means the
// zip stopped matching what README section 9 promises.
const dataFiles=names.filter(n=>/^data\/.+/.test(n));
const strays=dataFiles.filter(n=>!/^data\/(5e2024|humblewood)_full\.json$/.test(n));
if(strays.length)banned.push(...strays);
// docs/ is an ALLOWLIST, not a blocklist. Naming each dev doc to ban leaves a
// hole the size of the next one written: HUMBLEWOOD-PLAYTESTS.md was not in the
// list and would have shipped if it ever landed in docs/.
const docFiles=names.filter(n=>/^docs\/.+/.test(n)&&!n.endsWith("/"));
const docStrays=docFiles.filter(n=>!/^docs\/(CHANGELOG|README-converter|rules-schema)\.md$/.test(n));
if(docStrays.length)banned.push(...docStrays);
if(!dataFiles.length)banned.push("(no rules packs in data/ — bundling did not run)");
if(banned.length){
  // Delete the bundle: a zip that fails this check must never be publishable.
  require("fs").unlinkSync(zip);
  console.error("    LEAKED into the player bundle:\n      "+banned.join("\n      "));
  console.error("    "+zip+" deleted. Dev material belongs under src/, not docs/.");
  process.exit(1);
}
console.error("    bundle is player-facing only ("+names.filter(n=>!n.endsWith("/")).length+" files)");
NODE

echo "==> Building $SOURCE"
# THE WHOLE REPO — the counterpart to the player bundle. Membership comes from
# git: tracked files plus untracked-but-not-ignored ones. That is exactly "every
# source file", including anything not yet `git add`ed, while .gitignore keeps
# build artifacts out. dist/fieldbook.html is tracked, so it rides along and the
# zip can be checked against its own rebuild.
if git rev-parse --git-dir >/dev/null 2>&1; then
  # Skipped rather than fatal when git is absent: build.sh must still work for
  # someone who unzipped THIS zip and has no .git directory.
  git ls-files --cached --others --exclude-standard > "$TMPDIR_BUILD/srclist"
  zip -q "$SOURCE" -@ < "$TMPDIR_BUILD/srclist"
  echo "    wrote $SOURCE ($(wc -l < "$TMPDIR_BUILD/srclist" | tr -d ' ') files)"
else
  echo "    skipped — not a git checkout, so the source file list is unknown"
fi

# Surfaces the notebook on a plain build so pending work can't be quietly forgotten.
finish
