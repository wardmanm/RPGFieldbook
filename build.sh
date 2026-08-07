#!/usr/bin/env bash
# Fieldbook build: validate everything, regenerate docs/CHANGELOG.md from the in-app
# CHANGELOG array, and produce fieldbook-bundle.zip. Run from the repo root: ./build.sh
set -euo pipefail
cd "$(dirname "$0")"

# ---------------------------------------------------------------------------
# SOURCE-SPLIT BUILD STEP (planned — see docs/ADR-001-source-split.md).
# Currently OFF: fieldbook.html is the source. Once the split exists, enable
# this to generate fieldbook.html from src/ before the checks below run.
#
# if [ -d src ]; then
#   echo "==> Building fieldbook.html from src/"
#   CSS=$(cat src/css/*.css 2>/dev/null || true)
#   JS=$(cat src/js/*.js)            # relies on 00-, 10-, … ordering; boot() call lives last
#   node - "$CSS" "$JS" <<'NODE'
# const fs=require("fs");
# const [css,js]=process.argv.slice(2);
# let html=fs.readFileSync("fieldbook.template.html","utf8");
# html=html.replace("<!--@@CSS@@-->", () => css).replace("//@@JS@@", () => js);
# fs.writeFileSync("fieldbook.html", html);
# NODE
#   # First build only: prove it's a pure refactor before trusting it —
#   #   diff the built JS/CSS against the pre-split app (whitespace-normalized).
# fi
# ---------------------------------------------------------------------------

echo "==> Checking app JavaScript (node --check)"
node - <<'NODE'
const fs=require("fs");
const html=fs.readFileSync("fieldbook.html","utf8");
const js=(html.match(/<script>([\s\S]*?)<\/script>/g)||[])
  .map(b=>b.replace(/^<script>/,"").replace(/<\/script>$/,"")).join("\n");
fs.writeFileSync("/tmp/_fieldbook.js",js);
NODE
node --check /tmp/_fieldbook.js
echo "    ok"

echo "==> Validating data/*.json"
for f in data/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || { echo "    INVALID: $f"; exit 1; }
done
echo "    ok ($(ls data/*.json | wc -l | tr -d ' ') files)"

echo "==> Regenerating docs/CHANGELOG.md from the in-app CHANGELOG array"
VER=$(node - <<'NODE'
const fs=require("fs");const src=fs.readFileSync("fieldbook.html","utf8");
// APP_VERSION
const v=(src.match(/APP_VERSION\s*=\s*"([^"]+)"/)||[])[1]||"?";
// balanced extraction of the CHANGELOG array (handles nested notes arrays)
const start=src.indexOf("const CHANGELOG=");
const b=src.indexOf("[",start);let d=0,end=-1;
for(let i=b;i<src.length;i++){const c=src[i];if(c==="[")d++;else if(c==="]"){d--;if(d===0){end=i;break;}}}
const CHANGELOG=eval(src.slice(b,end+1));
let out="# Fieldbook — Changelog\n\nVersion shown in the app's top bar (tap it to view this in-app). "
 +"Bump `APP_VERSION` and add an\nentry here whenever `fieldbook.html` changes.\n";
for(const e of CHANGELOG){out+=`\n## v${e.v} — ${e.date}\n\n`+e.notes.map(n=>"- "+n).join("\n")+"\n";}
fs.writeFileSync("docs/CHANGELOG.md",out);
process.stdout.write(v);
NODE
)
echo "    app version: v$VER"

echo "==> Building fieldbook-bundle.zip"
rm -rf .buildtmp fieldbook-bundle.zip
mkdir -p .buildtmp/data .buildtmp/docs .buildtmp/scripts
cp fieldbook.html .buildtmp/
for f in README.md CLAUDE.md build.sh .gitignore; do [ -f "$f" ] && cp "$f" .buildtmp/ || true; done
cp data/*.json .buildtmp/data/
cp docs/*.md .buildtmp/docs/
cp scripts/* .buildtmp/scripts/ 2>/dev/null || true
( cd .buildtmp && zip -rq ../fieldbook-bundle.zip . )
rm -rf .buildtmp
echo "    wrote fieldbook-bundle.zip"

echo "==> Done (v$VER). Remember: browser smoke-test any UI changes before publishing."
