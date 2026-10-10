#!/usr/bin/env bash
# Coverage of the three stacks (011-quality-delivery, FR-014, contracts/coverage.md).
#   coverage.sh        run the engine (JaCoCo + coverlet) and web coverage, then the summary   (make coverage)
#   coverage.sh summary  print "[coverage] java|dotnet|web: <pct>% lines (<report>)"; exit 1 if a report is missing
# Report locations can be overridden with COVERAGE_JAVA (jacoco.xml), COVERAGE_DOTNET (directory searched for
# coverage.cobertura.xml) and COVERAGE_WEB (summary.json).
set -u
export LC_ALL=C  # decimal point in the printed percentages
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$PRODUCT_ROOT" || exit 1

JAVA_REPORT="${COVERAGE_JAVA:-$ENGINE_DIR/target/site/jacoco/jacoco.xml}"
DOTNET_DIR="${COVERAGE_DOTNET:-$ENGINE_DIR/target/coverage/dotnet}"
WEB_SUMMARY="${COVERAGE_WEB:-$PRODUCT_ROOT/web/coverage/summary.json}"

line() { # stack pct report
  printf '[coverage] %s: %s%% lines (%s)\n' "$1" "$2" "$3"
}

summary() {
  local missing=0 report pct
  if [ -f "$JAVA_REPORT" ]; then
    # Report-level LINE counter: the last <counter type="LINE" .../> of jacoco.xml.
    pct="$(grep -o '<counter type="LINE" missed="[0-9]*" covered="[0-9]*"/>' "$JAVA_REPORT" | tail -n 1 \
      | sed -E 's/.*missed="([0-9]+)" covered="([0-9]+)".*/\1 \2/' | awk '{ t=$1+$2; printf "%.2f", t ? 100*$2/t : 0 }')"
    line java "$pct" "$JAVA_REPORT"
  else
    echo "[coverage] java: MISSING ($JAVA_REPORT)"; missing=1
  fi
  # Newest run (each dotnet test --collect writes a new <guid>/ folder).
  report=""
  while IFS= read -r f; do
    if [ -z "$report" ] || [ "$f" -nt "$report" ]; then report="$f"; fi
  done < <(find "$DOTNET_DIR" -name coverage.cobertura.xml 2>/dev/null)
  if [ -n "$report" ]; then
    pct="$(grep -o '<coverage line-rate="[0-9.]*"' "$report" | head -n 1 | sed -E 's/.*"([0-9.]+)"/\1/' \
      | awk '{ printf "%.2f", 100*$1 }')"
    line dotnet "$pct" "$report"
  else
    echo "[coverage] dotnet: MISSING ($DOTNET_DIR/**/coverage.cobertura.xml)"; missing=1
  fi
  if [ -f "$WEB_SUMMARY" ]; then
    pct="$(node -e 'const s=require(process.argv[1]); process.stdout.write(Number(s.lines.pct).toFixed(2))' "$WEB_SUMMARY")"
    line web "$pct" "$WEB_SUMMARY"
  else
    echo "[coverage] web: MISSING ($WEB_SUMMARY)"; missing=1
  fi
  return $missing
}

run_all() {
  local rc=0
  # Engine: mvn verify (JaCoCo report bound to verify) and dotnet test --collect "XPlat Code Coverage".
  bash "$PRODUCT_ROOT/scripts/test.sh" engine || rc=1
  echo "[coverage] run: npm run coverage -w web"
  npm run coverage -w web || rc=1
  summary || rc=1
  return $rc
}

case "${1:-run}" in
  run) run_all ;;
  summary) summary ;;
  *) echo "usage: $0 [run|summary]" >&2; exit 64 ;;
esac
