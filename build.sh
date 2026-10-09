#!/usr/bin/env bash
# Fieldbook build: concatenate src/ into dist/fieldbook.html, validate everything,
# regenerate docs/CHANGELOG.md from the in-app CHANGELOG array, and produce
# dist/fieldbook-data-standalone-<release>.zip, dist/fieldbook-v<version>.zip and
# dist/fieldbook-data-kit-<version>.zip.
# Run from the repo root:
#
#   ./build.sh                    build + validate. NEVER changes the version.
#   ./build.sh --no-zip           skip the zips — fast path to dist/fieldbook.html
#   ./build.sh --data             rules data only: bundles + the data archive
#   ./build.sh --release patch    cut a release first, then build
#   ./build.sh --release minor
#   ./build.sh --release major
#   ./build.sh --release 2.0.0    explicit version
#
# Every build needs python3: tools/data-kit/fbdata.py bundles the rules packs
# and writes the data archive.
#
# Releasing is a separate, deliberate act: it folds the pending notes from
# src/docs/UNRELEASED.md into a new CHANGELOG entry and bumps APP_VERSION.
# A bare build has to be safe to run constantly, so it must not touch either.
#
# Build with unreleased notes pending and the app zip is marked "+dev"; build
# with rules data changed since data/packs.json's release and the archive is.
# Their contents are NOT the version their names would otherwise claim.
set -euo pipefail
cd "$(dirname "$0")"

RELEASE=""
NOZIP=""
DATAONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --release)
      shift
      [ $# -gt 0 ] || { echo "--release needs a level: patch | minor | major | X.Y.Z"; exit 1; }
      RELEASE="$1"; shift ;;
    --release=*) RELEASE="${1#*=}"; shift ;;
    --no-zip) NOZIP=1; shift ;;
    --data) DATAONLY=1; shift ;;
    -h|--help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (try --help)"; exit 1 ;;
  esac
done

# Checked before anything runs: --release would otherwise cut a release first.
if [ -n "$DATAONLY" ] && { [ -n "$RELEASE" ] || [ -n "$NOZIP" ]; }; then
  echo "--data builds only the rules-data archive; it doesn't mix with --release or --no-zip."
  echo "A data release is cut with: node scripts/data-release.js"
  exit 1
fi

# Closing output, shared by the normal path and the --no-zip early exit.
# VER/PENDING are set later; the body is evaluated at call time.
finish(){
  echo "==> Done (v$VER). Remember: browser smoke-test any UI changes before publishing."
  if [ -z "$RELEASE" ] && [ "$PENDING" -gt 0 ]; then
    echo "    $PENDING unreleased note(s) in src/docs/UNRELEASED.md — still on v$VER."
    echo "    Cut a release with: ./build.sh --release patch|minor|major"
  fi
}

# The interpreter for tools/data-kit/fbdata.py: python3, then python. Probed by
# RUNNING it — Windows ships a python3 stub that resolves and then fails.
find_python() {
  local p
  for p in python3 python; do
    if "$p" -c '' >/dev/null 2>&1; then printf '%s' "$p"; return 0; fi
  done
  return 1
}

validate_data() {
  echo "==> Validating data/**/*.json"
  local files f
  files=$(find data -name '*.json' | sort)
  for f in $files; do
    node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || { echo "    INVALID: $f"; exit 1; }
  done
  echo "    ok ($(echo "$files" | wc -l | tr -d ' ') files)"
}

# Roll each registered pack's per-category files into one importable pack. This
# is what players get; the individual files stay in the repo for cherry-picking.
bundle_packs() {
  echo "==> Bundling rules packs"
  local py
  py=$(find_python) || { echo "    bundling needs python3 (tools/data-kit/fbdata.py)"; exit 1; }
  "$py" tools/data-kit/fbdata.py bundle -o dist || { echo "    bundling failed"; exit 1; }
}

# The rules-data archive (spec 2026-10-07-data-archive-design.md §6), named for
# data/packs.json's release — "+dev" when some pack's content has changed since
# then, because that zip is NOT that release's data. Validated before it can
# ship; one that fails is deleted. Sets ARCHIVE.
pack_archive() {
  local py rel suf="" rc=0
  py=$(find_python) || { echo "    the zips need python3 (tools/data-kit/fbdata.py)"; exit 1; }
  rel=$(node -e 'process.stdout.write(String(require("./data/packs.json").release||""))')
  case "$rel" in
    [0-9]*.[0-9]*.[0-9]*) ;;
    *) echo "    BAD data/packs.json release: '$rel'"; exit 1 ;;
  esac
  "$py" tools/data-kit/fbdata.py versions --check >/dev/null || rc=$?
  case "$rc" in
    0) ;;
    1) suf="+dev"; echo "    rules data changed since $rel — naming the archive $rel$suf" ;;
    *) echo "    fbdata.py versions --check failed"; exit 1 ;;
  esac
  ARCHIVE="dist/fieldbook-data-standalone-$rel$suf.zip"
  rm -f dist/fieldbook-data-standalone-*.zip
  echo "==> Building $ARCHIVE"
  if [ -n "$suf" ]; then
    "$py" tools/data-kit/fbdata.py pack dist -o "$ARCHIVE" --dev
  else
    "$py" tools/data-kit/fbdata.py pack dist -o "$ARCHIVE"
  fi
  "$py" tools/data-kit/fbdata.py validate "$ARCHIVE" || {
    rm -f "$ARCHIVE"; echo "    $ARCHIVE failed validation and was deleted"; exit 1; }
}

# The data kit (#85): fbdata.py and the converter with the files they read, flat,
# so `python fbdata.py build …` works wherever the zip is unpacked. An allowlist:
# exactly these files, and the guard below fails the build on anything else.
pack_kit() {
  KIT="dist/fieldbook-data-kit-$VER$TAGSUF.zip"
  echo "==> Building $KIT"
  rm -rf .buildkit && mkdir -p .buildkit/example-pack
  cp scripts/srd-corrections.json scripts/convert.py tools/data-kit/fbdata.py tools/data-kit/README.md \
     data/overlay.json data/class-resources.json \
     docs/README-converter.md docs/rules-schema.md LICENSE .buildkit/
  cp tools/data-kit/example-pack/*.json .buildkit/example-pack/
  ( cd .buildkit && zip -rqD "../$KIT" . -x '*.DS_Store' )
  rm -rf .buildkit
  local got
  got=$(unzip -Z1 "$KIT" | grep -v '/$' | LC_ALL=C sort | tr '\n' ' ')
  local want="LICENSE README-converter.md README.md class-resources.json convert.py example-pack/example-pack.json fbdata.py overlay.json rules-schema.md srd-corrections.json "
  if [ "$got" != "$want" ]; then
    rm -f "$KIT"; echo "    the kit zip holds the wrong files: $got"; exit 1
  fi
  echo "    wrote $KIT"
}

# A private temp dir, not a fixed name in a world-writable /tmp. The .js
# extension is required: node --check refuses to parse an unknown extension.
#
# An explicit template, NOT `-t fieldbook`: the two mktemps disagree about what
# -t means. BSD (macOS) reads it as a prefix and appends its own X's; GNU (the
# CI runner) reads it as the whole template and rejects it with "too few X's".
# Passing the full path with X's is the form both accept.
TMPDIR_BUILD=$(mktemp -d "${TMPDIR:-/tmp}/fieldbook.XXXXXXXX")
TMPJS="$TMPDIR_BUILD/_fieldbook.js"
trap 'rm -rf "$TMPDIR_BUILD"' EXIT

# Must run before the build so the built app carries the new version.
if [ -n "$RELEASE" ]; then
  echo "==> Cutting release ($RELEASE)"
  node scripts/release.js "$RELEASE" >/dev/null
fi

# --data: rules data only, for the data-release workflow. It must not touch
# dist/fieldbook.html or docs/CHANGELOG.md — a data release ships no app.
if [ -n "$DATAONLY" ]; then
  mkdir -p dist
  validate_data
  bundle_packs
  pack_archive
  echo "==> Done (rules data only): $ARCHIVE"
  exit 0
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

validate_data

bundle_packs

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

# Clear every old zip so dist/ never accumulates stale versions, and a failed
# build can't leave last version's bundle looking like the current one. This
# glob already covers dist/fieldbook-data-kit-*.zip too — no separate rm needed.
rm -f dist/*.zip
pack_archive

echo "==> Building $BUNDLE"
# PLAYER-FACING BUNDLE ONLY. This is an allowlist on purpose: it must match what
# README section 9 tells players they are getting, and nothing else. Development
# material (src/, CLAUDE.md, build.sh, the dev docs under src/docs/, the build
# scripts, dotfiles) is deliberately excluded — the repo is where that lives.
# fieldbook.html sits at the ZIP root next to data/; dist/ is a repo-layout
# detail, not a download one.
rm -rf .buildtmp
mkdir -p .buildtmp/data .buildtmp/docs
cp dist/fieldbook.html .buildtmp/
cp README.md .buildtmp/
# The app is MIT; shipping it without its licence would be an oversight.
cp LICENSE .buildtmp/
# The rules data travels as its archive, which Fieldbook opens as it is — and
# opens inside this zip too. The per-category files remain in the repo.
cp "$ARCHIVE" .buildtmp/data/
cp docs/*.md .buildtmp/docs/
# convert.py and its helper files travel in the data kit zip now (#85).
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
const banned=names.filter(n=>/^src\/|^CLAUDE\.md$|^build\.sh$|^dev\.sh$|^\.|WIRING-LEDGER|ADR-\d|UNRELEASED|RELEASING|build-html\.js|gen-changelog\.js|release(-notes)?\.js|bundle-rules\.js|fetch-icons\.js|extract-humblewood\.py/.test(n));
// data/ must hold ONLY the rules-data archive — anything else means the zip
// stopped matching what README section 9 promises.
const dataFiles=names.filter(n=>/^data\/.+/.test(n));
const strays=dataFiles.filter(n=>!/^data\/fieldbook-data-standalone-[^/]+\.zip$/.test(n));
if(strays.length)banned.push(...strays);
if(dataFiles.length>1)banned.push("(data/ holds more than one archive)");
// docs/ is an ALLOWLIST, not a blocklist. Naming each dev doc to ban leaves a
// hole the size of the next one written: HUMBLEWOOD-PLAYTESTS.md was not in the
// list and would have shipped if it ever landed in docs/.
const docFiles=names.filter(n=>/^docs\/.+/.test(n)&&!n.endsWith("/"));
const docStrays=docFiles.filter(n=>!/^docs\/(CHANGELOG|README-converter|rules-schema)\.md$/.test(n));
if(docStrays.length)banned.push(...docStrays);
if(!dataFiles.length)banned.push("(no rules-data archive in data/)");
if(banned.length){
  // Delete the bundle: a zip that fails this check must never be publishable.
  require("fs").unlinkSync(zip);
  console.error("    LEAKED into the player bundle:\n      "+banned.join("\n      "));
  console.error("    "+zip+" deleted. Dev material belongs under src/, not docs/.");
  process.exit(1);
}
console.error("    bundle is player-facing only ("+names.filter(n=>!n.endsWith("/")).length+" files)");
NODE

pack_kit

# NO source zip. GitHub attaches "Source code (zip)" and "(tar.gz)" to every
# release automatically, built from the tag — which on a clean checkout is the
# same file set this used to produce, so it was a byte-for-byte duplicate of an
# asset we get for free. It was also the one asset that differed between a local
# build and the runner's, because it swept in untracked files. For a local
# snapshot use `git archive HEAD -o snapshot.zip`.

# Surfaces the notebook on a plain build so pending work can't be quietly forgotten.
finish
