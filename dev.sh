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
# A cut release publishes nothing until its tag is pushed, and a missing tag is
# invisible — Actions simply never runs. Surface it in the header instead.
tag_missing() {
  local v; v=$(app_version)
  git rev-parse --git-dir >/dev/null 2>&1 || return 1
  [ -n "$v" ] || return 1
  git rev-parse -q --verify "refs/tags/v$v" >/dev/null 2>&1 && return 1
  return 0
}

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
  printf '%s' "$stale"
  if tag_missing; then
    printf ' %s·%s %sv%s NOT TAGGED%s' "$DIM" "$OFF" "$YEL" "$ver" "$OFF"
  fi
  printf '\n'
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
  GIT
    c  Commit…                   (type, issue number, message, then push)
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
  printf 'It does NOT commit, tag or publish — the exact commands are printed afterwards.\n'
  printf '\nProceed with --release %s? [y/N] ' "$lvl"
  local ok; read -r ok
  case "$ok" in
    y|Y)
      run ./build.sh --release "$lvl" || return 0
      # AFTER the build, so it is the last thing on screen rather than scrolled
      # away by build output — and with the real version, not a placeholder.
      # `git add -A`, never `commit -am`: -a stages tracked changes only, so it
      # silently misses a new fragment, data file or workflow.
      local new; new=$(app_version)
      printf '\n%sPUBLISH v%s — nothing is public until you do this:%s\n\n' "$B" "$new" "$OFF"
      printf '    git add -A\n'
      printf '    git commit -m "Release v%s"\n' "$new"
      printf '    git tag -a v%s -m "v%s"\n' "$new" "$new"
      printf '    git push --follow-tags\n\n'
      printf '  %sThe TAG is what triggers publishing. Without it Actions never runs\n' "$DIM"
      printf '  and no release appears — with no error anywhere.%s\n' "$OFF"
      ;;
    *) printf 'cancelled\n' ;;
  esac
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
  printf '\nSource: %s\n\n' "$dir"
  printf '  1) D&D 2024 core        -> data/5e2024\n'
  printf "  2) Xanathar's Guide     -> data/xanathars\n"
  printf "  3) Tasha's Cauldron     -> data/tashas\n"
  printf '  4) all three\n'
  printf '  q) cancel\n\n'
  printf 'Which? [q] '
  local which; read -r which
  # The book profiles (pack names, the 2014-era _note, Artificer skip) live in
  # convert.py's SUPPLEMENTS table, not here — duplicating that prose in a menu is
  # how a re-run silently stops reproducing the committed packs.
  local core=0 xge=0 tce=0
  case "$which" in
    1) core=1 ;; 2) xge=1 ;; 3) tce=1 ;; 4) core=1; xge=1; tce=1 ;;
    *) printf 'cancelled\n'; return 0 ;;
  esac
  local targets=""
  [ "$core" = 1 ] && targets="$targets data/5e2024"
  [ "$xge" = 1 ] && targets="$targets data/xanathars"
  [ "$tce" = 1 ] && targets="$targets data/tashas"
  printf 'This OVERWRITES%s/*.json. Proceed? [y/N] ' "$targets"
  local ok; read -r ok
  case "$ok" in y|Y) : ;; *) printf 'cancelled\n'; return 0 ;; esac
  [ "$core" = 1 ] && run "$PY" scripts/convert.py all "$dir" -o data/5e2024
  # --avoid-table-names: the app looks tables up by name across every loaded pack,
  # so a supplement must not reuse one the core pack already owns.
  [ "$xge" = 1 ] && run "$PY" scripts/convert.py supplement "$dir" -o data/xanathars \
      --book XGE --system XGE --avoid-table-names data/5e2024/tables.json
  [ "$tce" = 1 ] && run "$PY" scripts/convert.py supplement "$dir" -o data/tashas \
      --book TCE --system TCE --avoid-table-names data/5e2024/tables.json
  return 0
}

# ---------------------------------------------------------------- commit
# Build the commit subject from its parts. PURE — no prompts, no git, no colour —
# so the formatting can be exercised on its own without making a commit:
#
#   commit_subject task closes "26, 30" "lorum ipsum"
#     -> task [26/30]: lorum ipsum, closes #26, closes #30
#
# Numbers may be separated by commas, spaces or both, and may carry a leading #.
# Returns 1 without printing if any of them isn't a number, so the caller can
# re-prompt rather than commit something malformed.
commit_subject() {
  local type="$1" kw="$2" raw="$3" msg="$4"
  local n slash="" trailer=""
  # Deliberate word splitting: tr has already turned , and # into spaces, and
  # every token is checked to be digits before it is used.
  for n in $(printf '%s' "$raw" | tr ',#' '  '); do
    case "$n" in ''|*[!0-9]*) return 1 ;; esac
    if [ -z "$slash" ]; then slash="$n"; else slash="$slash/$n"; fi
    trailer="$trailer, $kw #$n"
  done
  if [ -n "$slash" ]; then
    printf '%s [%s]: %s%s\n' "$type" "$slash" "$msg" "$trailer"
  else
    printf '%s: %s\n' "$type" "$msg"
  fi
}

commit_menu() {
  git rev-parse --git-dir >/dev/null 2>&1 || {
    printf '\n%sNot a git repository.%s\n' "$YEL" "$OFF"; return 0; }
  if [ -z "$(git status --porcelain)" ]; then
    printf '\n%sNothing to commit — the working tree is clean.%s\n' "$YEL" "$OFF"; return 0
  fi

  printf '\n%sCommit%s  (branch: %s)\n\n' "$B" "$OFF" "$(git_branch)"
  git status --short
  printf '\n    1  bug    → fixes\n    2  task   → closes\n    3  data   → closes\n    b  back\n\n'
  printf '  Type: '
  local c type kw; read -r c
  case "$c" in
    1|bug|BUG)   type=bug;  kw=fixes ;;
    2|task|TASK) type=task; kw=closes ;;
    3|data|DATA) type=data; kw=closes ;;
    *) printf 'cancelled\n'; return 0 ;;
  esac

  printf '  Issue number(s) — "34" or "26, 30": '
  local raw; read -r raw
  if [ -z "$raw" ]; then
    printf '\n  %sNo issue number. Commit as "%s: <message>", with nothing closed? [y/N] %s' "$YEL" "$type" "$OFF"
    local noissue; read -r noissue
    case "$noissue" in y|Y) : ;; *) printf 'cancelled\n'; return 0 ;; esac
  fi

  printf '  Message: '
  local msg; read -r msg
  [ -n "$msg" ] || { printf '\n%sNo message — cancelled.%s\n' "$YEL" "$OFF"; return 0; }

  local subject
  subject=$(commit_subject "$type" "$kw" "$raw" "$msg") || {
    printf '\n%s"%s" is not a list of numbers — cancelled.%s\n' "$YEL" "$raw" "$OFF"; return 0; }

  # Shown BEFORE staging, so backing out at the next prompt still tells you what
  # the message would have been.
  printf '\n    git commit -m "%s"\n' "$subject"

  # `git add -A`, never `commit -a`: -a stages tracked changes only, so it
  # silently misses a new fragment, data file or workflow — the same trap the
  # release checklist calls out.
  if git diff --cached --quiet; then
    printf '\n  Nothing staged yet. Stage everything (git add -A)? [Y/n] '
    local a; read -r a
    case "$a" in
      n|N) printf '  cancelled — stage what you want, then come back\n'; return 0 ;;
    esac
    run git add -A || return 0
  else
    printf '\n  %sCommitting what is already staged.%s\n' "$DIM" "$OFF"
  fi

  printf '\n  Commit the above? [y/N] '
  local ok; read -r ok
  case "$ok" in
    y|Y) : ;;
    *) printf '  cancelled — nothing committed, staging left as it is\n'; return 0 ;;
  esac
  run git commit -m "$subject" || return 0

  local br; br=$(git_branch)
  printf '\n  Push to origin/%s? [y/N] ' "$br"
  local p; read -r p
  case "$p" in
    # No --follow-tags on purpose: pushing a TAG is what publishes a release,
    # and that is a separate, deliberate act (menu 7 prints those commands).
    y|Y) run git push -u origin "$br" ;;
    *)   printf '  not pushed — "git push" when you are ready\n' ;;
  esac
}

where_things_live() {
  cat <<EOF

  ${B}Source of truth${OFF}   src/  — js/ css/ fragments (order: src/manifest.json),
                    fieldbook.template.html, tests/, docs/ (dev-only)
  ${B}Build artifact${OFF}    dist/fieldbook.html — never hand-edit; rebuild instead
  ${B}Rules data${OFF}        data/5e2024/, humblewood/, xanathars/, tashas/ (per category);
                    build bundles them into dist/<system>_full.json
  ${B}Notebook${OFF}          src/docs/UNRELEASED.md — one bullet per player-visible change
  ${B}Releasing${OFF}         src/docs/RELEASING.md — full procedure and failure modes
  ${B}Conventions${OFF}       CLAUDE.md · project memory: src/docs/_claude/WIRING-LEDGER.md

EOF
}

checklist() {
  cat <<EOF

  ${B}Release checklist${OFF}
    1. Every player-visible change has a bullet in src/docs/UNRELEASED.md
    2. Menu 4 — tests pass
    3. git status --porcelain — NOTHING untracked (??). The tag is built in a
       clean checkout, so an untracked file is simply absent there.
    4. Menu 7 — cut the release, then READ the diff (last chance on wording)
    5. Browser smoke-test the UI changes
    6. git add -A                    ← not commit -am; -a misses NEW files
       git commit -m "Release vX.Y.Z"
    7. git tag -a vX.Y.Z -m "vX.Y.Z" ← the tag IS the publish button
    8. git push --follow-tags
    9. Watch Actions → Release

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
    c|C) commit_menu; pause ;;
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
