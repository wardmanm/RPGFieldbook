#!/usr/bin/env bash
# Fieldbook — dev menu. Every build/test/release task on one screen so you don't
# have to go and look them up.
#
#   ./dev.sh
#
# This is a MENU, not a build system: every action shells out to build.sh or
# scripts/*, and prints the command before running it. Nothing is implemented
# here that isn't implemented there, so the menu can't drift from what CI runs.
#
# Bash 3.2 compatible on purpose — macOS still ships 3.2.57, so no associative
# arrays, no mapfile, no ${v,,}. Runs in Git Bash on Windows too.
set -uo pipefail
cd "$(dirname "$0")"

# ---------------------------------------------------------------- presentation
if [ -t 1 ]; then
  B=$(printf '\033[1m'); DIM=$(printf '\033[2m'); OFF=$(printf '\033[0m')
  GRN=$(printf '\033[32m'); YEL=$(printf '\033[33m'); RED=$(printf '\033[31m')
else
  B=""; DIM=""; OFF=""; GRN=""; YEL=""; RED=""
fi

PY=python3
command -v python3 >/dev/null 2>&1 || PY=python
command -v "$PY" >/dev/null 2>&1 || PY=""

opener() {
  case "$(uname -s)" in
    Darwin)            echo "open" ;;
    MINGW*|MSYS*|CYGWIN*) echo "start" ;;
    *)                 echo "xdg-open" ;;
  esac
}

app_version() { grep -oE 'APP_VERSION="[^"]+"' src/js/30-version.js | head -1 | cut -d'"' -f2; }
pending_notes() {
  [ -f src/docs/UNRELEASED.md ] || { echo 0; return; }
  sed -n '/^## Pending/,$p' src/docs/UNRELEASED.md | grep -c '^- ' || true
}
git_branch() { git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(no git)"; }

status_line() {
  local ver branch notes stale
  ver=$(app_version); branch=$(git_branch); notes=$(pending_notes)
  if node scripts/build-html.js --check >/dev/null 2>&1; then
    stale="${GRN}artifact fresh${OFF}"
  else
    stale="${YEL}artifact STALE${OFF}"
  fi
  printf '  v%s %s·%s %s %s·%s ' "$ver" "$DIM" "$OFF" "$branch" "$DIM" "$OFF"
  if [ "$notes" -gt 0 ]; then
    printf '%s%s note(s) pending%s %s·%s ' "$YEL" "$notes" "$OFF" "$DIM" "$OFF"
  else
    printf '%sno pending notes%s %s·%s ' "$DIM" "$OFF" "$DIM" "$OFF"
  fi
  printf '%s\n' "$stale"
}

# Run a command, showing it first. Never aborts the menu on failure.
run() {
  printf '\n%s$ %s%s\n\n' "$DIM" "$*" "$OFF"
  "$@"
  local rc=$?
  if [ $rc -eq 0 ]; then printf '\n%s✓ done%s\n' "$GRN" "$OFF"
  else printf '\n%s✗ exited %s%s\n' "$RED" "$rc" "$OFF"; fi
  return $rc
}
pause() { printf '\n%sPress Enter%s ' "$DIM" "$OFF"; read -r _; }

menu() {
  printf '\n%sFieldbook — dev menu%s\n' "$B" "$OFF"
  status_line
  cat <<'EOF'

  BUILD
    1  Build everything          (validate + zips)
    2  Build, skip zips          (fast: artifact + rules packs)
    3  Is the artifact stale?
  TEST
    4  Run all tests
  DATA
    5  Rebuild rules bundles
    6  Re-convert rules data from 5e-tools
  RELEASE
    7  Cut a release…
    8  Release checklist
  OTHER
    9  Open the built app in a browser
    s  Where things live
    q  Quit
EOF
}

release_menu() {
  local cur; cur=$(app_version)
  printf '\n%sCut a release%s  (current: v%s)\n\n' "$B" "$OFF" "$cur"
  printf '    1  patch   — a fix\n'
  printf '    2  minor   — a new feature\n'
  printf '    3  major   — breaking rework\n'
  printf '    4  explicit X.Y.Z\n'
  printf '    b  back\n\n'
  printf '  Choice: '
  local c lvl; read -r c
  case "$c" in
    1) lvl=patch ;; 2) lvl=minor ;; 3) lvl=major ;;
    4) printf '  Version (X.Y.Z): '; read -r lvl ;;
    *) return 0 ;;
  esac
  [ -n "$lvl" ] || return 0
  local notes; notes=$(pending_notes)
  if [ "$notes" -eq 0 ]; then
    printf '\n%sNo pending notes in src/docs/UNRELEASED.md — release.js will refuse.%s\n' "$YEL" "$OFF"
    printf 'Add a bullet per player-visible change first.\n'
    return 0
  fi
  printf '\nThis folds %s note(s) into the changelog, bumps APP_VERSION and rebuilds.\n' "$notes"
  printf 'It does NOT commit, tag or publish — you do that next:\n'
  printf '  %sgit commit -am "Release vX.Y.Z" && git tag -a vX.Y.Z -m vX.Y.Z && git push --follow-tags%s\n' "$DIM" "$OFF"
  printf '\nProceed with --release %s? [y/N] ' "$lvl"
  local ok; read -r ok
  case "$ok" in y|Y) run ./build.sh --release "$lvl" ;; *) printf 'cancelled\n' ;; esac
}

convert_data() {
  local dir; dir=$(ls -d _conversion-data/5etools-* 2>/dev/null | head -1)
  if [ -z "$dir" ]; then
    printf '\n%sNo _conversion-data/5etools-* directory found.%s\n' "$YEL" "$OFF"
    printf 'Drop a 5e-tools data dump there first; it is gitignored.\n'
    return 0
  fi
  if [ -z "$PY" ]; then
    printf '\n%sPython not found on PATH.%s\n' "$YEL" "$OFF"
    printf 'The converter needs python3 (or python). Everything else in this menu works without it.\n'
    return 0
  fi
  printf '\nSource: %s\n' "$dir"
  printf 'This OVERWRITES data/5e2024/*.json. Proceed? [y/N] '
  local ok; read -r ok
  case "$ok" in y|Y) run "$PY" scripts/convert.py all "$dir" -o data/5e2024 ;; *) printf 'cancelled\n' ;; esac
}

where_things_live() {
  cat <<EOF

  ${B}Source of truth${OFF}   src/  — js/ css/ fragments (order: src/manifest.json),
                    fieldbook.template.html, tests/, docs/ (dev-only)
  ${B}Build artifact${OFF}    dist/fieldbook.html — never hand-edit; rebuild instead
  ${B}Rules data${OFF}        data/5e2024/ and data/humblewood/ (per category);
                    build bundles them into dist/<system>_full.json
  ${B}Notebook${OFF}          src/docs/UNRELEASED.md — one bullet per player-visible change
  ${B}Releasing${OFF}         src/docs/RELEASING.md — full procedure and failure modes
  ${B}Conventions${OFF}       CLAUDE.md · project memory: src/docs/WIRING-LEDGER.md

EOF
}

checklist() {
  cat <<EOF

  ${B}Release checklist${OFF}
    1. Every player-visible change has a bullet in src/docs/UNRELEASED.md
    2. Menu 4 — tests pass
    3. Menu 7 — cut the release, then READ the diff (last chance on wording)
    4. Browser smoke-test the UI changes
    5. git commit -am "Release vX.Y.Z"
    6. git tag -a vX.Y.Z -m "vX.Y.Z"
    7. git push --follow-tags        ← the tag push publishes
    8. Watch Actions → Release

  Full detail, including what each CI guard refuses and why:
    src/docs/RELEASING.md

EOF
}

# ---------------------------------------------------------------- non-interactive
# Without a TTY this would spin forever on read — print the menu as help instead,
# so a stray ./dev.sh in a script or CI job exits cleanly.
if [ ! -t 0 ]; then
  menu
  printf '\n(not a terminal — nothing to read from stdin, so this is just the menu)\n'
  exit 0
fi

while true; do
  menu
  printf '\n  Choice: '
  read -r choice || break
  case "$choice" in
    1) run ./build.sh; pause ;;
    2) run ./build.sh --no-zip; pause ;;
    3) run node scripts/build-html.js --check; pause ;;
    4) run ./src/tests/run.sh; pause ;;
    5) run node scripts/bundle-rules.js; pause ;;
    6) convert_data; pause ;;
    7) release_menu; pause ;;
    8) checklist; pause ;;
    9) if [ -f dist/fieldbook.html ]; then
         run "$(opener)" dist/fieldbook.html
       else
         printf '\n%sdist/fieldbook.html does not exist yet — build it first (menu 1 or 2).%s\n' "$YEL" "$OFF"
       fi; pause ;;
    s|S) where_things_live; pause ;;
    q|Q) printf 'bye\n'; exit 0 ;;
    "") ;;
    *) printf '\n%s"%s" is not on the menu.%s\n' "$YEL" "$choice" "$OFF"; pause ;;
  esac
done
