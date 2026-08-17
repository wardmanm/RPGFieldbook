#!/usr/bin/env bash
# Worktree bootstrap for working several GitHub issues in parallel.
#
#   ./scripts/wt.sh add 41 [slug]   create a worktree + branch for issue 41
#   ./scripts/wt.sh list            what exists right now
#   ./scripts/wt.sh status          what each worktree has actually DONE
#   ./scripts/wt.sh rm 41           remove the worktree and its branch
#
# Worktrees live in .claude/worktrees/<issue>/ — inside the repo, but .gitignore
# already ignores .claude/, so `git status` on main stays clean.
#
# Branches carry SRC-ONLY diffs: build in a worktree to verify, but never commit
# dist/fieldbook.html. Merges then never conflict on a 473 KB generated file, and
# one ./build.sh on main after merging produces the single correct artifact. This
# is also why the pre-commit hook does not check artifact freshness — a stale
# dist/ is the expected state here.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ -t 1 ]; then
  B=$(printf '\033[1m'); OFF=$(printf '\033[0m'); DIM=$(printf '\033[2m')
  GRN=$(printf '\033[32m'); YEL=$(printf '\033[33m'); RED=$(printf '\033[31m')
else
  B=""; OFF=""; DIM=""; GRN=""; YEL=""; RED=""
fi

WT_ROOT=".claude/worktrees"

die() { printf '%s%s%s\n' "$RED" "$1" "$OFF" >&2; exit 1; }

# Homebrew's bin is on the PATH of a LOGIN shell (~/.zprofile) but not
# necessarily of whatever spawned this. Look it up rather than assume.
find_gh() {
  command -v gh 2>/dev/null && return 0
  for p in /opt/homebrew/bin/gh /usr/local/bin/gh "$HOME/.local/bin/gh"; do
    [ -x "$p" ] && { printf '%s' "$p"; return 0; }
  done
  return 1
}

# sed -E (ERE), NOT `\+`. `\+` is a GNU extension: BSD sed on macOS reads
# `[^a-z0-9]\+` as "one non-alphanumeric followed by a literal +", which matches
# nothing — so an issue title's spaces survived into the branch name and
# `git worktree add` rejected it. -E is understood by both BSD and GNU sed.
slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E -e 's/[^a-z0-9]+/-/g' -e 's/^-+//' -e 's/-+$//' \
    | cut -c1-40 \
    | sed -E 's/-+$//'
}

# `merge=ours` in .gitattributes is inert without a driver — git ships union and
# binary built in, but not ours. Idempotent, so just ensure it every time.
ensure_config() {
  [ "$(git config --get merge.ours.driver 2>/dev/null)" = "true" ] \
    || git config merge.ours.driver true
}

cmd_add() {
  local num="${1:-}" slug="${2:-}" gh title branch path
  [ -n "$num" ] || die "usage: wt.sh add <issue-number> [slug]"
  case "$num" in (*[!0-9]*) die "issue number must be digits: $num";; esac

  # Falling back to a generic slug is fine, but doing it SILENTLY is not: you end
  # up with issue/30-work and no idea the title lookup failed. GitHub's API 503s
  # often enough that this matters.
  if [ -z "$slug" ]; then
    if gh=$(find_gh); then
      title=$("$gh" issue view "$num" --json title -q .title 2>/dev/null || true)
      if [ -n "$title" ]; then
        slug=$(slugify "$title")
        printf '%sissue %s:%s %s\n' "$DIM" "$num" "$OFF" "$title"
      else
        printf '%scould not read issue %s from GitHub (API down, or no such issue).%s\n' \
          "$YEL" "$num" "$OFF"
        printf '%s  naming the branch generically — or ^C and: wt.sh add %s my-slug%s\n' \
          "$DIM" "$num" "$OFF"
      fi
    else
      printf '%sgh not found — naming the branch generically%s\n' "$YEL" "$OFF"
    fi
  fi
  [ -n "$slug" ] || slug="work"

  branch="issue/${num}-${slug}"
  path="$WT_ROOT/$num"

  # Belt and braces: whatever slugify produced, refuse before git does. A bad
  # ref name should fail here with the name in the message, not as a `fatal:`
  # from `git worktree add` after the worktree machinery has already started.
  git check-ref-format --branch "$branch" >/dev/null 2>&1 \
    || die "not a valid branch name: $branch  (pass an explicit slug: wt.sh add $num my-slug)"

  [ -e "$path" ] && die "$path already exists — ./scripts/wt.sh rm $num first"
  git show-ref --verify --quiet "refs/heads/$branch" \
    && die "branch $branch already exists"

  ensure_config
  git fetch --quiet origin || printf '%sfetch failed — branching from local main%s\n' "$YEL" "$OFF"

  local base="origin/main"
  git rev-parse --verify --quiet "$base" >/dev/null || base="main"

  mkdir -p "$WT_ROOT"
  git worktree add -b "$branch" "$path" "$base" || die "git worktree add failed"

  # Untracked, gitignored, and large: a fresh worktree has none of them, so the
  # humblewood-verbatim suite would silently drop 129 assertions and converter
  # work would have no 5e-tools dump to read. Symlink rather than copy — .venv is
  # 102 MB and _conversion-data is 461 MB.
  local up="../../.."
  [ -d .venv ]             && ln -s "$up/.venv" "$path/.venv"
  [ -d _conversion-data ]  && ln -s "$up/_conversion-data" "$path/_conversion-data"

  # Otherwise every agent re-triggers the permission prompts you already answered.
  if [ -f .claude/settings.local.json ]; then
    mkdir -p "$path/.claude"
    cp .claude/settings.local.json "$path/.claude/settings.local.json"
  fi

  printf '\n  %sworktree%s  %s\n  %sbranch%s    %s\n  %sbase%s      %s\n' \
    "$B" "$OFF" "$path" "$B" "$OFF" "$branch" "$B" "$OFF" "$base"
  printf '\n  %sBranch rules: commit src/ only — never dist/fieldbook.html.%s\n' "$DIM" "$OFF"
  printf '  %sBuild to verify, leave the built artifact uncommitted for QA.%s\n\n' "$DIM" "$OFF"
}

cmd_list() {
  printf '\n%sWorktrees%s\n\n' "$B" "$OFF"
  git worktree list | sed 's/^/  /'
  printf '\n'
}

# What has actually happened in each worktree. Deliberately git-level rather
# than agent-level: it tells you the same thing whether the work was done by an
# agent, by you, or not at all — and it is the only view that survives an agent
# session ending.
cmd_status() {
  local p b n br ahead dirty last
  printf '\n%s%-6s %-44s %6s %6s  %s%s\n' "$B" "ISSUE" "BRANCH" "AHEAD" "DIRTY" "LAST COMMIT" "$OFF"
  git worktree list --porcelain | awk '/^worktree /{p=$2} /^branch /{print p" "$2}' \
  | while read -r p b; do
      case "$p" in (*/worktrees/*) ;; (*) continue;; esac
      n=$(basename "$p"); br=${b#refs/heads/}
      ahead=$(git -C "$p" rev-list --count origin/main..HEAD 2>/dev/null || echo '?')
      dirty=$(git -C "$p" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
      last=$(git -C "$p" log -1 --format='%cr — %s' 2>/dev/null | cut -c1-42)
      if [ "$ahead" = "0" ] && [ "$dirty" = "0" ]; then
        printf '%s%-6s %-44s %6s %6s  %s%s\n' "$DIM" "$n" "$br" "$ahead" "$dirty" "nothing yet" "$OFF"
      else
        printf '%-6s %-44s %s%6s%s %6s  %s\n' "$n" "$br" "$GRN" "$ahead" "$OFF" "$dirty" "$last"
      fi
    done
  printf '\n  %sAHEAD = commits not on origin/main. DIRTY = uncommitted files.%s\n' "$DIM" "$OFF"
  printf '  %sA worktree that built to verify shows DIRTY 1 (dist/fieldbook.html) — expected.%s\n\n' "$DIM" "$OFF"
}

cmd_rm() {
  local num="${1:-}" path branch
  [ -n "$num" ] || die "usage: wt.sh rm <issue-number>"
  path="$WT_ROOT/$num"
  [ -d "$path" ] || die "no worktree at $path"
  branch=$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)

  # Remove what `add` put there. Without this, git refuses forever: the two
  # symlinks and the copied settings are files this script created, not work,
  # and `git worktree remove` counts them as reasons not to proceed. Real
  # uncommitted work still blocks removal, which is the behaviour we want.
  rm -f "$path/.venv" "$path/_conversion-data" "$path/.claude/settings.local.json"
  rmdir "$path/.claude" 2>/dev/null || true

  # dist/fieldbook.html is a BUILD ARTIFACT and branches deliberately never commit
  # it — so "built to verify" is the normal end state of every worktree, and git
  # counts that modification as a reason to refuse. Restore it (it regenerates
  # from src/ in a second) rather than making --force the routine answer, which
  # would blunt the guard that still has to catch real uncommitted source.
  git -C "$path" checkout -- dist/fieldbook.html 2>/dev/null || true

  git worktree remove "$path" || die "worktree has uncommitted work — commit it, or discard with: git worktree remove --force $path"
  if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
    # `git branch -d` measures "merged" against the branch's UPSTREAM, and these
    # track origin/main — so work already merged into a LOCAL main that has not
    # been pushed reads as unmerged and the branch survives with a misleading
    # message. Ask the question that actually matters instead: is every commit on
    # this branch already contained in main?
    if git merge-base --is-ancestor "$branch" main 2>/dev/null; then
      git branch -D "$branch" >/dev/null 2>&1
      printf '  %sremoved%s worktree and branch %s %s(merged into main)%s\n' \
        "$GRN" "$OFF" "$branch" "$DIM" "$OFF"
    else
      printf '  %sremoved worktree; branch %s kept — it has commits main does not%s\n' \
        "$YEL" "$branch" "$OFF"
      printf '  %sdelete it anyway with: git branch -D %s%s\n' "$DIM" "$branch" "$OFF"
    fi
  fi
}

case "${1:-}" in
  add)    shift; cmd_add "$@" ;;
  list)   cmd_list ;;
  status) cmd_status ;;
  rm)     shift; cmd_rm "$@" ;;
  *)    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
