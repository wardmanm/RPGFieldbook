#!/usr/bin/env bash
# Run every Fieldbook test suite. No framework, no dependencies — plain node and
# python3 asserting against the real source.
#
#   ./src/tests/run.sh          all suites
#   ./src/tests/run.sh tables   only suites whose name matches
#
# Exits non-zero if any suite fails, so CI and ./dev.sh can both rely on it.
set -uo pipefail                 # NOT -e: a failing suite must not abort the run
cd "$(dirname "$0")/../.."       # suites read src/ and data/ by relative path

FILTER="${1:-}"

# rules-data.js compares dist/*_full.json against data/<system>/*.json, so the
# bundles have to exist before it runs.
# ALWAYS rebundle. Only rebuilding when the file is missing lets a STALE bundle
# pass the round-trip test — data/ can gain a category (as it did with
# humblewood tables) while dist/ still holds the older pack.
node scripts/bundle-rules.js >/dev/null || { echo "bundling failed"; exit 1; }

PY=python3
command -v python3 >/dev/null 2>&1 || PY=python

SUITES="converter tables rules-data sheet char-update docs humblewood-verbatim"
TOTAL=0
FAILED=""
RAN=0

for name in $SUITES; do
  case "$name" in
    *"$FILTER"*) ;;
    *) continue ;;
  esac
  if [ -f "src/tests/$name.py" ]; then
    FILE="src/tests/$name.py"; CMD="$PY $FILE"
  else
    FILE="src/tests/$name.js"; CMD="node $FILE"
  fi
  RAN=$((RAN + 1))
  OUT=$($CMD 2>&1) || true
  # the suites print "ALL PASSED (n)" or "FAILURES: ..." as their last line
  LAST=$(printf '%s\n' "$OUT" | tail -1)
  case "$LAST" in
    SKIP*)
      printf '  %-20s skipped (%s)\n' "$name" "${LAST#SKIP - }"
      ;;
    "ALL PASSED"*)
      N=$(printf '%s\n' "$LAST" | tr -dc '0-9')
      TOTAL=$((TOTAL + ${N:-0}))
      printf '  %-20s %s checks\n' "$name" "${N:-?}"
      ;;
    *)
      FAILED="$FAILED $name"
      printf '  %-20s FAILED\n' "$name"
      printf '%s\n' "$OUT" | grep -E '^FAIL|^FAILURES|Error' | sed 's/^/      /'
      ;;
  esac
done

echo
if [ "$RAN" -eq 0 ]; then
  echo "no suite matched '$FILTER' (have: $SUITES)"
  exit 1
fi
if [ -n "$FAILED" ]; then
  echo "FAILED:$FAILED"
  exit 1
fi
echo "All $RAN suites passed — $TOTAL checks."
