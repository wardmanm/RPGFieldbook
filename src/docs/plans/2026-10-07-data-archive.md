# Data Archive, Per-Pack Versions and Data-Only Releases — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rules data ships as one versioned archive that Fieldbook opens itself, each pack carries its own version and credit in a registry, data can be released without the app, and a running copy says quietly when newer data is out (#83, part 1 of #82).

**Architecture:**
- `data/packs.json` is the registry of packs (folder, file, title, version, content digest, licence, credit). A new stdlib-Python tool, `tools/data-kit/fbdata.py`, is the only code that computes digests, bumps versions and writes/validates the archive. `bundle-rules.js` and `release.js` read and drive it.
- In the app, a new pure fragment `src/js/89-zip.js` reads zips (an RFC 1951 inflate after zlib's `puff.c`). `89-rules-merge.js` gains a pure byte-level importer (`importRulesPayloads`) and a replace-on-reimport `importPack`. `30-version.js` gains the data-version functions and the data-release check. `88-settings.js` gains the `update` state and pack credits.
- Two new release paths: `release.js` (app releases, now via the registry) and `data-release.js` + `.github/workflows/data-release.yml` (data-only releases, never GitHub's "latest").

**Tech Stack:** plain ES2020 concatenated into one `<script>`; Node 20 scripts; Python 3.8+ standard library; bash (3.2-compatible for `dev.sh`); GitHub Actions with the runner's `gh`; the project Playwright MCP server for screenshots.

**Spec:** `src/docs/specs/2026-10-07-data-archive-design.md` — read it first; this plan argues from it. Its §2 rulings R1–R10 are binding.

**Worktree:** `.claude/worktrees/83`, branch `issue/83-data-archive`. Every command runs from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/83`.

## Global Constraints

**The build**
- The app ships as ONE file, `dist/fieldbook.html`, built by concatenation. No `import`/`export`, no network calls except the two existing optional GitHub checks and the new data check.
- **Byte hygiene:** LF only, one final newline, no BOM, no private-use characters. Your editing tool may decode backslash-u escape sequences into real characters: **never write a backslash-u escape in any file** (this plan needs none; a BOM test builds its bytes as `[0xEF,0xBB,0xBF]`).
- **TDZ (ADR-001):** a new top-level `const`/`let` is read only inside functions called at runtime.
- **Build before `rules-data.js` or `run.sh`:** `./build.sh --no-zip`. It rewrites the tracked `dist/fieldbook.html` and `docs/CHANGELOG.md`.
- `./build.sh --no-zip` and the Node suites need no Python. Zips (`./build.sh`, `./build.sh --data`) need `python3` (R1).

**Git and release — never violate**
- **Branch commits carry source and docs only.** Never `git add` `dist/fieldbook.html` or `docs/CHANGELOG.md`. Always `git add` explicit paths. Never use `git stash` in any form.
- Never run `./build.sh --release`, `node scripts/release.js`, or `node scripts/data-release.js` without `--dry-run` **in this worktree**. Tests run them only inside scratch copies under a temp dir.
- Never hand-edit `APP_VERSION`, `DATA_VERSIONS`, the `CHANGELOG` array, or the `version`/`digest`/`release` fields of `data/packs.json` (Task 1's seeding is the one sanctioned exception, done through `fbdata.py`). No merge, push or tag.
- Commit messages end with exactly: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` — this exact model name, whatever model you are.

**Data and storage**
- Characters are untouched. `rules.credits` is optional everywhere: a cache or settings file without it reads as `{}`.
- Storage failures are loud: an import whose cache write fails says so on the line the player is reading.

**Settled values (spec)**
- Data version: `X.Y.Z` or `X.Y.Z-N`, N ≥ 1, no leading zeros. Order: `1.7.2 < 1.8.0 < 1.8.0-1 < 1.8.0-2 < 1.8.0-10 < 1.8.1`. `cmpDataVer` of anything invalid is 0.
- Tags: app `vX.Y.Z`; data `data-vX.Y.Z-N`.
- Archive: `fieldbook-data-standalone-<release>[+dev].zip`, holding `fieldbook-data.json` (`_type:"fieldbook-data"`, `format:1`), `NOTICE.md`, and the bundles under their own names.
- Zip caps: zip ≤ 64 MiB, entry ≤ 32 MiB uncompressed, read total ≤ 128 MiB, ≤ 1,000 entries.
- Digest: `sha256:` + hex SHA-256 of `canon({"meta":{system,title,license,attribution},"files":{name: parsed JSON}})`, `canon` = `json.dumps(x, sort_keys=True, separators=(",",":"), ensure_ascii=False)`.
- Credits: `license` ≤ 64 characters (SPDX id), `attribution` ≤ 2,000 characters, plain text. Linked licences: `CC-BY-4.0`, `CC-BY-SA-3.0`, `MIT`.
- Homebrew's credit, verbatim: license `CC-BY-SA-3.0`, attribution `The Predator, a Warlock subclass by D&D Wiki contributors (https://www.dandwiki.com/wiki/The_Predator_(5e_Subclass)), used under CC BY-SA 3.0. Changed: converted to Fieldbook's rules format.`

**Markup safety**
- Every `${…}` inside a quoted HTML attribute is `esc(…)` of the whole expression (`rules-data.js` tokenizes all of `src/js`).
- Pack credits and anything from a fetched registry are shown through `esc()`, never as markup.

**Tests and screenshots**
- New suites: `src/tests/data-kit.py` (Task 1) and `src/tests/data-archive.js` (Task 2), both registered in `run.sh`, with CLAUDE.md's "across N suites" kept in step (the `docs` suite checks it).
- A test that needs `python3` or `zip` and can't find it prints a `note:` line and skips; it never fails for that.
- **Screenshots (Task 9):** only the project's `mcp__playwright__*` tools (load them with ToolSearch), never `mcp__plugin_playwright_*`. Branch build: `file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/83/dist/fieldbook.html`; `main`'s (before): `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`. Shots go in `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/` as `83-before-*.png` / `83-after-*.png`.

## Review Focus

The five conditions the spec implies that no task's own tests would otherwise reach, most likely to bite first. Each has its test in the owning task.

1. **An old app zip is imported** (1.7.x layout: loose packs in `data/`, plus `scripts/overlay.json` and `scripts/class-resources.json`, which are converter inputs, not packs). Only the packs load; the two converter inputs are skipped silently; the status says "Imported fieldbook-v1.7.2.zip: 2 files." for two packs. → Task 4.
2. **The same archive is imported twice.** The pool after the second import is identical to after the first: nothing doubled, nothing lost. → Task 4.
3. **A slow import on a phone.** "Reading 1 file…" appears at once on both status lines, before any work. → Task 4.
4. **A mobile picker greys out a `.zip`** unless its MIME types are listed. All four rules pickers accept `.zip`, `application/zip` and `application/x-zip-compressed`. → Task 4.
5. **The notice is showing, and the player imports the newer archive.** The row flips to current and the hint disappears without a reload. → Task 8.

**Plan rulings beyond the spec** (record them in the ledger entry, Task 9):
- In a zip of loose JSON, an entry with no rules category (no `keywords`/`features`/`traits`/`items`/`spells`/`races`/`classes`/`feats`/`backgrounds`/`subclasses`/`tables` array) is skipped silently. This is what makes Review Focus 1 work; R5 otherwise holds.
- `dataStatus()` treats a `dataVersion` that `parseDataVer` rejects as `unknown`, never `current` or `stale` (spec §3.2: "unknown is never stale or newer").
- The four pickers also accept `application/x-zip-compressed` (Windows and some Android pickers label zips with it).

## File map

| File | Task | Responsibility |
|---|---|---|
| `data/packs.json` (new) | 1 | the registry |
| `tools/data-kit/fbdata.py` (new) | 1, 6 | digests, versions (1); `pack`, `validate` (6) |
| `scripts/bundle-rules.js` | 1 | bundles from the registry |
| `scripts/release.js` | 1 | versions via `fbdata.py`, `DATA_VERSIONS` snapshot |
| `src/js/30-version.js` | 2, 8 | data-version functions (2); the data-release check (8) |
| `src/js/88-settings.js` | 2, 4, 5, 8 | `dataStatus` (2, 8); picker (4); credits, `prunePackMeta` (5); badge (8) |
| `src/js/89-zip.js` (new) | 3 | the zip reader |
| `src/js/89-rules-merge.js` | 4, 5, 8 | importer (4); credits (5); hint line (8) |
| `src/js/90-boot.js` | 4, 8 | home picker (4); boot call (8) |
| `src/fieldbook.template.html`, `src/html/40-rules.html` | 4 | pickers and help text |
| `build.sh` | 6 | the archive, `--data`, the app zip |
| `scripts/data-release.js`, `scripts/data-release-notes.js` (new) | 7 | data releases, release-body text |
| `.github/workflows/release.yml`, `.github/workflows/data-release.yml` (new) | 7 | publishing |
| `dev.sh` | 7 | menu `d`, status field |
| `src/tests/data-kit.py` (new) | 1, 6, 7 | the Python suite |
| `src/tests/data-archive.js` (new) | 2–6, 8 | the Node suite |
| `src/tests/harness.js`, `docs.js`, `rules-data.js`, `run.sh` | 1–4, 8, 9 | as each task says |
| docs (wiki, README, RELEASING, rules-schema, CLAUDE.md, ledger, UNRELEASED) | 1, 3, 5, 9 | as each task says |

---

### Task 1: The registry, `fbdata.py` digests and versions, and the release scripts rewired

**Files:**
- Create: `data/packs.json`, `tools/data-kit/fbdata.py`, `src/tests/data-kit.py`
- Modify: `scripts/bundle-rules.js` (the `SYSTEMS` array, `dataVersions()`, the pack assembly, the main loop), `scripts/release.js` (the `/* data versions */` block), `src/tests/docs.js` (WORDS, the function-name scan, the `DATA_VERSIONS` block), `src/tests/rules-data.js` (the `// ---------- every shipped pack agrees with DATA_VERSIONS` block), `src/tests/run.sh` (SUITES), `CLAUDE.md`, `src/docs/wiki/architecture/rules-packs.md`, `src/docs/wiki/data/homebrew.md`, `src/docs/wiki/data/converter.md`

**Interfaces:**
- Produces: `data/packs.json` shape (spec §4); `fbdata.py` CLI `digest`, `versions --changed|--check|--bump V|--seed`, each taking `--registry F --data-root D`; exit 0 ok / 1 check failed / 2 bad input; `versions --bump` prints a JSON list of changed systems on stdout. Python module functions `parse_data_ver`, `canon`, `check_registry`, `load_registry`, `pack_digest`, `changed_packs`, `write_registry`, class `KitError`, constants `ROOT`, `DEFAULT_REGISTRY`, `DEFAULT_DATA_ROOT`. Each bundle now carries `license`/`attribution` when the registry has them.

- [ ] **Step 1: Write the failing Python suite**

Create `src/tests/data-kit.py`:

```python
#!/usr/bin/env python3
"""The data kit (#83): tools/data-kit/fbdata.py — digests, versions and the
archive — and the release scripts that drive it. Every case runs on a scratch
copy under a temp dir, never on data/. Prints PASS/FAIL lines and ends with
"ALL PASSED (n)" or "FAILURES: ...", which is what run.sh reads.
Spec: src/docs/specs/2026-10-07-data-archive-design.md"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FBDATA = os.path.join(ROOT, "tools", "data-kit", "fbdata.py")
sys.path.insert(0, os.path.dirname(FBDATA))
import fbdata  # noqa: E402

FAILED = []
TOTAL = [0]


def ck(name, cond, extra=None):
    TOTAL[0] += 1
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond or extra is None else "  -> " + repr(extra)))
    if not cond:
        FAILED.append(name)


def write(d, rel, obj=None, raw=None):
    p = os.path.join(d, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(raw if raw is not None else json.dumps(obj, indent=2) + "\n")


def read_json(d, rel):
    with open(os.path.join(d, rel), encoding="utf-8") as f:
        return json.load(f)


def scratch():
    """A data root with two packs, Alpha (at the current release) and Beta (older)."""
    d = tempfile.mkdtemp(prefix="fbdata-")
    write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 1}]})
    write(d, "data/beta/feats.json", {"system": "Beta", "feats": [{"name": "Tough"}]})
    write(d, "data/packs.json", {"release": "1.8.0", "packs": [
        {"system": "Alpha", "dir": "alpha", "file": "alpha_full.json", "title": "Alpha", "version": "1.8.0"},
        {"system": "Beta", "dir": "beta", "file": "beta_full.json", "title": "Beta", "version": "1.7.0"}]})
    return d


def kit(d, *args):
    return subprocess.run([sys.executable, FBDATA] + list(args) +
                          ["--registry", os.path.join(d, "data", "packs.json"),
                           "--data-root", os.path.join(d, "data")],
                          capture_output=True, text=True)


def changed(d):
    return kit(d, "versions", "--changed").stdout.split()


# ---------- versions sort the data way, not the semver way (spec §3.1)
order = ["1.7.2", "1.8.0", "1.8.0-1", "1.8.0-2", "1.8.0-9", "1.8.0-10", "1.8.1", "1.10.0"]
ck("parse_data_ver orders 1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1",
   sorted(reversed(order), key=fbdata.parse_data_ver) == order)
for bad in ["", "v1.8.0", "1.8", "1.8.0-0", "1.8.0-01", "01.8.0", "1.8.0+dev", None, 7]:
    ck("parse_data_ver refuses %r" % (bad,), fbdata.parse_data_ver(bad) is None)

# ---------- digests: content, not formatting (R2)
d = scratch()
r = kit(d, "versions", "--seed")
ck("--seed records a digest for every pack",
   r.returncode == 0 and all((p.get("digest") or "").startswith("sha256:") for p in read_json(d, "data/packs.json")["packs"]),
   r.stderr)
ck("right after seeding nothing has changed", changed(d) == [], changed(d))
write(d, "data/alpha/spells.json", raw='{"spells":[{"level":1,"name":"Zap"}],"system":"Alpha"}')
ck("re-ordering keys and re-indenting is not a change", changed(d) == [], changed(d))
write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 2}]})
ck("changing a value is a change", changed(d) == ["Alpha"], changed(d))
write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 1}]})
ck("...and putting it back is not", changed(d) == [], changed(d))
reg = read_json(d, "data/packs.json")
reg["packs"][1]["license"] = "MIT"
write(d, "data/packs.json", reg)
ck("adding a licence to the registry is a change", changed(d) == ["Beta"], changed(d))
reg["packs"][1].pop("license")
reg["packs"][1]["title"] = "Beta Book"
write(d, "data/packs.json", reg)
ck("changing a title is a change", changed(d) == ["Beta"], changed(d))
reg["packs"][1]["title"] = "Beta"
write(d, "data/packs.json", reg)

# ---------- --check
ck("--check passes when nothing changed", kit(d, "versions", "--check").returncode == 0)
write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 3}]})
r = kit(d, "versions", "--check")
ck("--check fails (exit 1) and names the pack when one changed", r.returncode == 1 and "Alpha" in r.stderr, (r.returncode, r.stderr))

# ---------- --bump
r = kit(d, "versions", "--bump", "1.8.0-1")
reg = read_json(d, "data/packs.json")
ck("--bump prints the changed systems as JSON", r.returncode == 0 and json.loads(r.stdout) == ["Alpha"], (r.stdout, r.stderr))
ck("--bump moves only the changed pack", reg["packs"][0]["version"] == "1.8.0-1" and reg["packs"][1]["version"] == "1.7.0", reg)
ck("--bump sets the release", reg["release"] == "1.8.0-1", reg["release"])
ck("--bump records the new digest, so --check passes again", kit(d, "versions", "--check").returncode == 0)
with open(os.path.join(d, "data", "packs.json"), encoding="utf-8") as f:
    text = f.read()
ck("the registry is written with 2-space indent and a final newline",
   text.endswith("}\n") and '\n  "release": "1.8.0-1"' in text and not text.endswith("\n\n"))
ck("keys keep their order: system, dir, file, title, version, digest",
   list(reg["packs"][0].keys())[:6] == ["system", "dir", "file", "title", "version", "digest"], list(reg["packs"][0].keys()))
r = kit(d, "versions", "--bump", "1.8.0")
ck("--bump refuses to go backwards (exit 2)", r.returncode == 2 and "higher" in r.stderr, (r.returncode, r.stderr))
r = kit(d, "versions", "--bump", "1.8")
ck("--bump refuses a malformed version (exit 2)", r.returncode == 2, r.stderr)

# ---------- a pack whose folder is absent is skipped, not an error
shutil.rmtree(os.path.join(d, "data", "beta"))
ck("a missing folder is never 'changed'", changed(d) == [], changed(d))
r = kit(d, "digest")
ck("digest says 'no folder' for it", r.returncode == 0 and "no folder" in r.stdout, r.stdout)
shutil.rmtree(d)

# ---------- a bad registry is refused before anything happens (exit 2)
BAD = {
    "a duplicate system": lambda p: p.append(dict(p[0], file="other.json")),
    "a duplicate file": lambda p: p.append(dict(p[0], system="Other")),
    "a dir that escapes the data root": lambda p: p[0].update(dir="../x"),
    "a file name with a space": lambda p: p[0].update(file="a b.json"),
    "a malformed version": lambda p: p[0].update(version="1.8"),
    "a malformed digest": lambda p: p[0].update(digest="md5:abc"),
    "an over-long licence": lambda p: p[0].update(license="x" * 65),
    "an over-long attribution": lambda p: p[0].update(attribution="x" * 2001),
    "an empty title": lambda p: p[0].update(title=" "),
}
for label, spoil in BAD.items():
    d = scratch()
    reg = read_json(d, "data/packs.json")
    spoil(reg["packs"])
    write(d, "data/packs.json", reg)
    r = kit(d, "versions", "--changed")
    ck("refuses %s" % label, r.returncode == 2 and r.stderr.startswith("fbdata: "), (r.returncode, r.stderr))
    shutil.rmtree(d)
d = scratch()
write(d, "data/packs.json", raw="{ not json")
ck("refuses a registry that isn't JSON", kit(d, "versions", "--check").returncode == 2)
shutil.rmtree(d)

# ---------- the real registry is well-formed and fully seeded
real = fbdata.load_registry(fbdata.DEFAULT_REGISTRY)
ck("data/packs.json passes check_registry", isinstance(real, dict))
ck("every real pack has a digest", all((p.get("digest") or "").startswith("sha256:") for p in real["packs"]))

# ---- add new cases above this line ----
print("")
print(("FAILURES: " + ", ".join(FAILED)) if FAILED else "ALL PASSED (%d)" % TOTAL[0])
sys.exit(1 if FAILED else 0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python3 src/tests/data-kit.py`
Expected: an import error (`ModuleNotFoundError: No module named 'fbdata'`).

- [ ] **Step 3: Write `tools/data-kit/fbdata.py`**

```python
#!/usr/bin/env python3
"""Fieldbook data kit: versions, digests and archives for rules packs (#83).

    fbdata.py digest   [--registry F] [--data-root D]
    fbdata.py versions (--changed | --check | --bump V | --seed) [--registry F] [--data-root D]

Python 3.8+, standard library only. Exit status: 0 ok, 1 a check failed,
2 bad input. Spec: src/docs/specs/2026-10-07-data-archive-design.md §4, §5.1.
"""
import argparse
import hashlib
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DEFAULT_REGISTRY = os.path.join(ROOT, "data", "packs.json")
DEFAULT_DATA_ROOT = os.path.join(ROOT, "data")

# X.Y.Z is the data shipped with app X.Y.Z; X.Y.Z-N the Nth data-only release
# after it. NOT semver: here 1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1 (spec §3.1).
DATA_VER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([1-9]\d*))?$")
FILE_NAME = re.compile(r"^[A-Za-z0-9._-]+\.json$")
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
# The registry fields that reach the bundle, so changing one is a content change.
META_KEYS = ("system", "title", "license", "attribution")
# Written in this order; any other key a pack carries is kept, after these.
PACK_KEYS = ("system", "dir", "file", "title", "version", "digest", "license", "attribution")


class KitError(Exception):
    """Bad input: printed as one line, exit status 2."""


def parse_data_ver(v):
    m = DATA_VER.match(v) if isinstance(v, str) else None
    return tuple(int(x) if x else 0 for x in m.groups()) if m else None


def canon(x):
    return json.dumps(x, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def check_registry(reg, where):
    if not isinstance(reg, dict):
        raise KitError(where + ": not a JSON object")
    rel = reg.get("release")
    if rel is not None and not parse_data_ver(rel):
        raise KitError("%s: release %r is not X.Y.Z or X.Y.Z-N" % (where, rel))
    packs = reg.get("packs")
    if not isinstance(packs, list) or not packs:
        raise KitError(where + ": packs must be a non-empty list")
    systems, files = set(), set()
    for i, p in enumerate(packs):
        at = "%s: packs[%d]" % (where, i)
        if not isinstance(p, dict):
            raise KitError(at + " is not an object")
        for k in ("system", "dir", "file", "title"):
            if not isinstance(p.get(k), str) or not p[k].strip():
                raise KitError("%s.%s must be a non-empty string" % (at, k))
        if p["system"] in systems:
            raise KitError("%s.system %r appears twice" % (at, p["system"]))
        if p["file"] in files:
            raise KitError("%s.file %r appears twice" % (at, p["file"]))
        systems.add(p["system"])
        files.add(p["file"])
        if not FILE_NAME.match(p["file"]):
            raise KitError("%s.file %r must be letters, digits, . _ - and end .json" % (at, p["file"]))
        parts = p["dir"].replace("\\", "/").split("/")
        if os.path.isabs(p["dir"]) or any(s in ("", ".", "..") for s in parts):
            raise KitError("%s.dir %r must be a folder inside the data root" % (at, p["dir"]))
        if p.get("version") is not None and not parse_data_ver(p["version"]):
            raise KitError("%s.version %r is not X.Y.Z or X.Y.Z-N" % (at, p["version"]))
        dg = p.get("digest")
        if dg is not None and not (isinstance(dg, str) and DIGEST.match(dg)):
            raise KitError("%s.digest %r is not sha256:<64 hex>" % (at, dg))
        lic = p.get("license")
        if lic is not None and not (isinstance(lic, str) and 0 < len(lic) <= 64):
            raise KitError("%s.license must be an SPDX id of 1 to 64 characters" % at)
        att = p.get("attribution")
        if att is not None and not (isinstance(att, str) and 0 < len(att) <= 2000):
            raise KitError("%s.attribution must be text of 1 to 2,000 characters" % at)


def load_registry(path):
    try:
        with open(path, encoding="utf-8") as f:
            reg = json.load(f)
    except OSError as e:
        raise KitError("%s: %s" % (path, e.strerror or e))
    except ValueError as e:
        raise KitError("%s: not valid JSON — %s" % (path, e))
    check_registry(reg, os.path.basename(path))
    return reg


def pack_digest(pack, data_root):
    """sha256 of the canonical JSON of the pack's registry fields and every
    *.json directly in its folder; None when the folder is absent (spec §4.1)."""
    folder = os.path.join(data_root, pack["dir"])
    if not os.path.isdir(folder):
        return None
    files = {}
    for name in sorted(os.listdir(folder)):
        full = os.path.join(folder, name)
        if not name.endswith(".json") or not os.path.isfile(full):
            continue
        try:
            with open(full, encoding="utf-8") as f:
                files[name] = json.load(f)
        except ValueError as e:
            raise KitError("%s: not valid JSON — %s" % (full, e))
    meta = {k: pack[k] for k in META_KEYS if pack.get(k) is not None}
    body = canon({"meta": meta, "files": files}).encode("utf-8")
    return "sha256:" + hashlib.sha256(body).hexdigest()


def changed_packs(reg, data_root):
    """[(pack, computed digest)] for every pack whose folder exists and whose
    content no longer matches its recorded digest."""
    out = []
    for p in reg["packs"]:
        dg = pack_digest(p, data_root)
        if dg is not None and dg != p.get("digest"):
            out.append((p, dg))
    return out


def write_registry(reg, path):
    """The registry in one fixed shape, so a bump is a minimal diff: 2-space
    indent, known keys first and in order, anything else kept after them."""
    top = {}
    for k in ("_comment", "release", "packs"):
        if k in reg:
            top[k] = reg[k]
    for k, v in reg.items():
        top.setdefault(k, v)
    top["packs"] = [dict([(k, p[k]) for k in PACK_KEYS if k in p] +
                         [(k, v) for k, v in p.items() if k not in PACK_KEYS])
                    for p in reg["packs"]]
    text = json.dumps(top, indent=2, ensure_ascii=False) + "\n"
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)


def cmd_digest(a):
    reg = load_registry(a.registry)
    for p in reg["packs"]:
        dg = pack_digest(p, a.data_root)
        state = "no folder" if dg is None else ("same" if dg == p.get("digest") else "CHANGED")
        print("%-12s %-9s recorded %s" % (p["system"], state, p.get("digest") or "(none)"))
        if dg is not None and dg != p.get("digest"):
            print("%-12s %-9s computed %s" % ("", "", dg))
    return 0


def cmd_versions(a):
    reg = load_registry(a.registry)
    if a.seed:
        n = 0
        for p in reg["packs"]:
            dg = pack_digest(p, a.data_root)
            if dg is not None:
                p["digest"] = dg
                n += 1
        write_registry(reg, a.registry)
        print("seeded %d digest%s from %s" % (n, "" if n == 1 else "s", a.data_root), file=sys.stderr)
        return 0
    changed = changed_packs(reg, a.data_root)
    names = [p["system"] for p, _ in changed]
    if a.changed:
        for n in names:
            print(n)
        return 0
    if a.check:
        if names:
            print("changed since %s: %s" % (reg.get("release"), ", ".join(names)), file=sys.stderr)
            return 1
        print("digests current")
        return 0
    nv = parse_data_ver(a.bump)
    if not nv:
        raise KitError("--bump %r is not X.Y.Z or X.Y.Z-N" % a.bump)
    old = parse_data_ver(reg.get("release"))
    if old and nv <= old:
        raise KitError("refusing to go from release %s to %s — it must be higher" % (reg["release"], a.bump))
    for p, dg in changed:
        p["version"] = a.bump
        p["digest"] = dg
    reg["release"] = a.bump
    write_registry(reg, a.registry)
    print(json.dumps(names))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog="fbdata.py", description="Fieldbook data kit")
    sub = ap.add_subparsers(dest="cmd")

    def common(p):
        p.add_argument("--registry", default=DEFAULT_REGISTRY, help="default: data/packs.json")
        p.add_argument("--data-root", default=DEFAULT_DATA_ROOT, help="default: data/")

    p = sub.add_parser("digest", help="each pack's computed digest beside its recorded one")
    common(p)
    p.set_defaults(fn=cmd_digest)
    p = sub.add_parser("versions", help="compare, check or bump pack versions")
    common(p)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--changed", action="store_true", help="list packs changed since their release")
    g.add_argument("--check", action="store_true", help="exit 1 if any pack changed")
    g.add_argument("--bump", metavar="V", help="give changed packs version V; set release to V")
    g.add_argument("--seed", action="store_true", help="record every digest from --data-root")
    p.set_defaults(fn=cmd_versions)
    a = ap.parse_args(argv)
    if not getattr(a, "fn", None):
        ap.print_help()
        return 2
    try:
        return a.fn(a)
    except KitError as e:
        print("fbdata: " + str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Create `data/packs.json` without digests**

```json
{
  "_comment": "The rules-pack registry (spec src/docs/specs/2026-10-07-data-archive-design.md §4). version, digest and release are written only by scripts/release.js and scripts/data-release.js through tools/data-kit/fbdata.py — never by hand.",
  "release": "1.7.2",
  "packs": [
    {
      "system": "XPHB",
      "dir": "5e2024",
      "file": "5e2024_full.json",
      "title": "D&D 2024 — Complete Rulebook",
      "version": "1.7.2"
    },
    {
      "system": "Humblewood",
      "dir": "humblewood",
      "file": "humblewood_full.json",
      "title": "Humblewood — Complete Rulebook",
      "version": "1.7.1"
    },
    {
      "system": "XGE",
      "dir": "xanathars",
      "file": "xanathars_full.json",
      "title": "Xanathar's Guide to Everything",
      "version": "1.7.2"
    },
    {
      "system": "TCE",
      "dir": "tashas",
      "file": "tashas_full.json",
      "title": "Tasha's Cauldron of Everything",
      "version": "1.7.2"
    },
    {
      "system": "Homebrew",
      "dir": "homebrew",
      "file": "homebrew_full.json",
      "title": "Homebrew",
      "version": "1.5.0"
    }
  ]
}
```

The versions are today's `DATA_VERSIONS` values; the titles are today's `SYSTEMS[].name` in `bundle-rules.js`. Check both against the files before going on.

- [ ] **Step 5: Seed the digests from the v1.7.2 tree (spec §4.1), then add Homebrew's credit**

```bash
SEED=$(mktemp -d)
git archive v1.7.2 data | tar -x -C "$SEED"
python3 tools/data-kit/fbdata.py versions --seed --data-root "$SEED/data"
rm -rf "$SEED"
python3 tools/data-kit/fbdata.py versions --changed
```

Expected: `seeded 5 digests from …` on stderr, then exactly `XPHB` and `XGE` (their data changed after v1.7.2).

Now add to the Homebrew entry in `data/packs.json`, after `digest` (seeding put it there), these two keys with the exact values from Global Constraints:

```json
      "license": "CC-BY-SA-3.0",
      "attribution": "The Predator, a Warlock subclass by D&D Wiki contributors (https://www.dandwiki.com/wiki/The_Predator_(5e_Subclass)), used under CC BY-SA 3.0. Changed: converted to Fieldbook's rules format."
```

Run: `python3 tools/data-kit/fbdata.py versions --changed`
Expected: `XPHB`, `XGE`, `Homebrew` (the credit is a content change, R3).

- [ ] **Step 6: Run the Python suite**

Run: `python3 src/tests/data-kit.py`
Expected: last line `ALL PASSED (n)`.

- [ ] **Step 7: Rewire `scripts/bundle-rules.js` to the registry**

Replace the header comment's two arrow lines and its "Bundles carry" paragraph with:

```js
 * Roll each registered pack's per-category files into ONE importable pack.
 * data/packs.json lists the packs: data/<dir>/*.json -> dist/<file>, named
 * <title>, stamped dataVersion <version> (spec 2026-10-07-data-archive-design.md
 * §4). Versions and digests are written by tools/data-kit/fbdata.py, never here,
 * so this needs no Python.
```

(keep the paragraphs about players importing one file per system, `rulebook: true`, and `overlay.json`.)

Delete the `const SYSTEMS = [...]` array and the whole `dataVersions()` function with its comment. In their place:

```js
/* data/packs.json is the registry: which folders are packs, each bundle's file
   name and title, its version, and its licence and credit. */
function registry() {
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(DATA, "packs.json"), "utf8")); }
  catch (e) { throw new Error(`data/packs.json: ${e.message}`); }
  if (!reg || !Array.isArray(reg.packs) || !reg.packs.length)
    throw new Error("data/packs.json: no packs list");
  return reg.packs;
}
```

In `bundle(sys)`, replace everything from `const sysName = system || sys.dir;` down to and including the `if (requires && requires.length) pack.requires = requires;` line with:

```js
  // The registry names the system; the folder's files must agree, or the
  // version, title and credit stamped below would describe a different pack.
  if (system && system !== sys.system)
    return { errors: [`${sys.dir}: its files say system "${system}" but data/packs.json says "${sys.system}"`] };
  // `version` is the SCHEMA version; `dataVersion` is this pack's own release
  // (data/packs.json), and is what the app compares against.
  const pack = { system: sys.system, name: sys.title, version: 1 };
  if (sys.version) pack.dataVersion = sys.version;
  pack.rulebook = true;
  if (sys.license) pack.license = sys.license;
  if (sys.attribution) pack.attribution = sys.attribution;
  if (exclude && exclude.length) pack.excludeSystems = exclude;
  if (requires && requires.length) pack.requires = requires;
```

and change `const dest = path.join(OUTDIR, sys.out);` to `const dest = path.join(OUTDIR, sys.file);`.

Replace the main loop's first lines so the registry error is reported, and every `sys.out` becomes `sys.file`:

```js
let failed = false;
let packs;
try { packs = registry(); }
catch (e) { console.error(`    FAILED: ${e.message}`); process.exit(1); }
for (const sys of packs) {
  const r = bundle(sys);
  if (r.skipped) { console.log(`    skipped ${sys.file} — ${r.skipped}`); continue; }
  if (r.errors) {
    failed = true;
    console.error(`    FAILED ${sys.file}:`);
```

(the rest of the loop is unchanged.)

Run: `node scripts/bundle-rules.js`
Expected: five `dist/*_full.json` lines as before. Then:
`node -e 'const p=require("./dist/homebrew_full.json");console.log(p.dataVersion,p.license,!!p.attribution)'` → `1.5.0 CC-BY-SA-3.0 true`.

- [ ] **Step 8: Rewire `scripts/release.js`**

Replace the whole `/* ---------------- data versions ---------------- */` block (from that comment through the `console.error(bumped.length ? ... : ...)` statement, keeping `fs.writeFileSync(VERSION_JS, out);`) with:

```js
/* ---------------- data versions ----------------
   data/packs.json records each pack's version and a digest of its content
   (spec 2026-10-07-data-archive-design.md §4). fbdata.py gives every pack
   whose content changed since its last release the version `next`, and sets
   the archive's release to it. DATA_VERSIONS is then a SNAPSHOT of the
   registry: this build's offline baseline. Run before any file is written
   here, so a failure leaves the CHANGELOG and APP_VERSION untouched. */
function findPython() {
  for (const py of ["python3", "python"]) {
    if (spawnSync(py, ["-c", ""], { stdio: "ignore" }).status === 0) return py;
  }
  return null;
}
const PY = findPython();
if (!PY) die("cutting a release needs python3 (tools/data-kit/fbdata.py)");
const bump = spawnSync(PY, [path.join(ROOT, "tools/data-kit/fbdata.py"), "versions", "--bump", next],
                       { encoding: "utf8" });
if (bump.status !== 0) die("fbdata.py versions --bump failed:\n" + (bump.stderr || bump.stdout || ""));
let bumped;
try { bumped = JSON.parse(bump.stdout); } catch (e) { die("fbdata.py printed no JSON: " + bump.stdout); }
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "data/packs.json"), "utf8"));
const versions = {};
registry.packs.forEach((p) => { if (p.version) versions[p.system] = p.version; });
const dvm = /const\s+DATA_VERSIONS\s*=\s*(\{[^}]*\})/.exec(out);
if (!dvm) die("could not find DATA_VERSIONS in src/js/30-version.js");
out = out.replace(dvm[1], () => JSON.stringify(versions));
fs.writeFileSync(VERSION_JS, out);
console.error(bumped.length
  ? `    rules data changed: ${bumped.join(", ")} -> ${next}`
  : "    rules data unchanged — every pack keeps its version");
```

`SYSTEM_DIRS`, `lastTag()` and `dataChangedSince()` are gone with the old block. Fix the file's header comment: after "bump APP_VERSION", add ", and record each rules pack's version in data/packs.json (through tools/data-kit/fbdata.py)".

Check: `node --check scripts/release.js`. Do NOT run it here.

- [ ] **Step 9: Update `src/tests/docs.js`**

1. Change `const WORDS = {one: 1, …, eight: 8};` to add `nine: 9, ten: 10`.
2. In the wiki block, extend the function-name scan to the kit — replace

```js
  const srcFiles = manifest.js.concat(fs.readdirSync(path.join(ROOT, 'scripts'))
    .filter(f => /\.(js|py)$/.test(f)).map(f => 'scripts/' + f));
```

with

```js
  const srcFiles = manifest.js.concat(fs.readdirSync(path.join(ROOT, 'scripts'))
    .filter(f => /\.(js|py)$/.test(f)).map(f => 'scripts/' + f))
    .concat(fs.readdirSync(path.join(ROOT, 'tools/data-kit'))
      .filter(f => /\.py$/.test(f)).map(f => 'tools/data-kit/' + f));
```

3. Replace the whole `// ---------- DATA_VERSIONS must cover every system bundle-rules.js emits` block (through its closing `}`) with:

```js
// ---------- data/packs.json, the registry of rules packs (#83)
// The one source of truth for which folders are packs and what version each is
// at. DATA_VERSIONS is a SNAPSHOT of it taken at each app release, so every
// system it names must be registered, at that version or a later data release.
const DV_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([1-9]\d*))?$/;
const dvParse = v => { const m = DV_RE.exec(typeof v === 'string' ? v : ''); return m ? [+m[1], +m[2], +m[3], m[4] ? +m[4] : 0] : null; };
const dvCmp = (a, b) => { const pa = dvParse(a), pb = dvParse(b); if (!pa || !pb) return NaN;
  for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return 0; };
let packsReg = null;
try { packsReg = JSON.parse(read('data/packs.json')); } catch (e) { /* reported below */ }
ck('data/packs.json parses and lists packs', !!packsReg && Array.isArray(packsReg.packs) && packsReg.packs.length > 0);
if (packsReg && Array.isArray(packsReg.packs)) {
  ck('data/packs.json release is a data version', !!dvParse(packsReg.release), packsReg.release);
  packsReg.packs.forEach(p => {
    ck('pack ' + p.system + ': data/' + p.dir + '/ exists', fs.existsSync(path.join(ROOT, 'data', String(p.dir))));
    ck('pack ' + p.system + ': version is a data version or null', p.version === null || !!dvParse(p.version), p.version);
  });
  const dvm = /const\s+DATA_VERSIONS\s*=\s*(\{[^}]*\})/.exec(read('src/js/30-version.js'));
  let dv = null;
  try { dv = JSON.parse(dvm[1]); } catch (e) { /* reported below */ }
  ck('DATA_VERSIONS is present and is flat JSON (release.js rewrites it)', !!dv);
  if (dv) Object.entries(dv).forEach(([sys, v]) => {
    const p = packsReg.packs.find(x => x.system === sys);
    ck('DATA_VERSIONS.' + sys + ' has a pack in data/packs.json', !!p);
    if (p) ck('data/packs.json ' + sys + ' is at or after DATA_VERSIONS', dvCmp(p.version, v) >= 0, p.version + ' vs ' + v);
  });
}
```

- [ ] **Step 10: Update `src/tests/rules-data.js`**

Replace the `// ---------- every shipped pack agrees with DATA_VERSIONS` block (the `[['5e2024_full.json','XPHB'], …].forEach(…)` through its `});`) with:

```js
// ---------- every shipped pack agrees with data/packs.json (#83)
JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'packs.json'), 'utf8')).packs.forEach(reg => {
  if (!fs.existsSync(path.join(ROOT, 'data', reg.dir))) return;
  const p = path.join(ROOT, 'dist', reg.file);
  if (!fs.existsSync(p)) { ck(reg.file + ' exists', false); return; }
  const pack = JSON.parse(fs.readFileSync(p, 'utf8'));
  ck(reg.file + ' system is the registry system', pack.system === reg.system, pack.system);
  ck(reg.file + ' name is the registry title', pack.name === reg.title, pack.name);
  ck(reg.file + ' dataVersion is the registry version',
     (pack.dataVersion || null) === (reg.version || null), pack.dataVersion + ' vs ' + reg.version);
  ck(reg.file + ' licence and credit match the registry',
     (pack.license || null) === (reg.license || null) && (pack.attribution || null) === (reg.attribution || null));
});
```

- [ ] **Step 11: Register the suite and fix the docs that cite removed names**

1. `src/tests/run.sh`: `SUITES="converter tables rules-data sheet char-update docs humblewood-verbatim data-kit"`.
2. `CLAUDE.md`:
   - "(across seven suites)" → "(across eight suites)".
   - In the "Where to edit what" block, after the `data/<system>/*.json` line, add:
     `tools/data-kit/          fbdata.py — pack versions, digests, the data archive (Python 3.8+, stdlib)`
     and change the `data/<system>/*.json` line's text to `rules data; data/packs.json registers each pack; bundled into dist/*_full.json`.
   - In "Versioning & changelog", change the second bullet to: "**Never hand-edit `APP_VERSION`, `DATA_VERSIONS`, the `CHANGELOG` array, or the `version`/`digest`/`release` fields of `data/packs.json`** — `scripts/release.js` and `scripts/data-release.js` own them. `docs/CHANGELOG.md` is generated."
3. `src/docs/wiki/architecture/rules-packs.md`, the **Code:** line: replace `` `bundle()` and `dataVersions()` in `scripts/bundle-rules.js`; `dataChangedSince()` in `scripts/release.js` `` with `` `bundle()` and `registry()` in `scripts/bundle-rules.js`; `pack_digest()` and `changed_packs()` in `tools/data-kit/fbdata.py` ``.
4. `src/docs/wiki/data/homebrew.md`, the **Code:** line: replace `` `dataChangedSince()` in `scripts/release.js` `` with `` `pack_digest()` in `tools/data-kit/fbdata.py` ``.
5. `src/docs/wiki/data/converter.md`: on the **Code:** line replace `` `dataChangedSince()` in `scripts/release.js` `` with `` `pack_digest()` in `tools/data-kit/fbdata.py` ``; and in the "Rules that must hold" bullet that begins "**The default run reproduces `data/5e2024/` byte for byte.**", replace its second sentence with: "Any change to a value moves that pack's content digest (`pack_digest()`), so the next release bumps its version and every player is told to re-download it. Check it before and after any converter change:"

(Task 9 rewrites these pages fully; this step only keeps the `docs` suite's "every name() it cites is defined" check green.)

- [ ] **Step 12: Build and run everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: `All 8 suites passed` (humblewood-verbatim may say skipped).

- [ ] **Step 13: Commit**

```bash
git add data/packs.json tools/data-kit/fbdata.py src/tests/data-kit.py scripts/bundle-rules.js scripts/release.js \
  src/tests/docs.js src/tests/rules-data.js src/tests/run.sh CLAUDE.md \
  src/docs/wiki/architecture/rules-packs.md src/docs/wiki/data/homebrew.md src/docs/wiki/data/converter.md
git commit -m "feat: data/packs.json and fbdata.py — per-pack versions and content digests (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Data versions in the app

**Files:**
- Modify: `src/js/30-version.js` (after `cmpVer`), `src/js/88-settings.js` (`dataStatus()`; the `older` filter in `settingsImportQuestionHTML()`), `src/tests/run.sh`, `CLAUDE.md`
- Create: `src/tests/data-archive.js`

**Interfaces:**
- Consumes: nothing from Task 1 in the app.
- Produces: `parseDataVer(s) -> [x,y,z,n] | null`, `cmpDataVer(a,b) -> -1|0|1` (0 if either invalid), `dataVerOfTag(tag) -> string` (`""` if not an app or data tag), `dataVerBase(v) -> string`. The suite file `src/tests/data-archive.js` with its `section(name, fn)` runner; later tasks add sections **above the line `// ---- add new sections above this line ----`** and add names to the `loadApp([...])` list.

- [ ] **Step 1: Write the failing suite**

Create `src/tests/data-archive.js`:

```js
/* Rules data as an archive (#83): data versions, the zip reader, importing an
   archive, pack credits, and the newer-data notice. Sections run in order (some
   are async), then ck.done(). Later tasks add sections above the marker line
   and names to the loadApp() list. Spec:
   src/docs/specs/2026-10-07-data-archive-design.md */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os');
const {spawnSync} = require('child_process');
const {loadApp, makeCheck, ROOT} = require('./harness');

const ck = makeCheck();
const {X, ctx, state, bootError} = loadApp([
  'parseDataVer', 'cmpDataVer', 'dataVerOfTag', 'dataVerBase',
  'mergeRules', 'resetRules', 'loadedRulesGroups', 'dataStatus', 'dataStatusHTML', 'DATA_VERSIONS',
  'poolFromExport', 'settingsImportQuestionHTML',
]);
if (bootError) { console.log('LOAD FAIL: ' + bootError.message); process.exit(1); }

const SECTIONS = [];
const section = (name, fn) => SECTIONS.push([name, fn]);
/* the interpreter run.sh would pick, or null: python3, then python */
const PY = ['python3', 'python'].find(p => spawnSync(p, ['-c', ''], {stdio: 'ignore'}).status === 0) || null;
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fb-archive-'));
/* the code of the error fn throws, 'none' if it doesn't */
const code = fn => { try { fn(); return 'none'; } catch (e) { return (e && e.code) || String(e); } };

// ---------- data versions (spec §3)
section('data versions', () => {
  ck('parseDataVer reads X.Y.Z', JSON.stringify(X.parseDataVer('1.8.0')) === '[1,8,0,0]', X.parseDataVer('1.8.0'));
  ck('parseDataVer reads X.Y.Z-N', JSON.stringify(X.parseDataVer('1.8.0-12')) === '[1,8,0,12]', X.parseDataVer('1.8.0-12'));
  ['', 'v1.8.0', '1.8', '1.8.0-0', '1.8.0-01', '01.8.0', '1.8.0+dev', '1.8.0-1-2', ' 1.8.0', '1.8.0-', null, 7]
    .forEach(s => ck('parseDataVer refuses ' + JSON.stringify(s), X.parseDataVer(s) === null));
  const order = ['1.7.2', '1.8.0', '1.8.0-1', '1.8.0-2', '1.8.0-9', '1.8.0-10', '1.8.1', '1.10.0', '2.0.0'];
  const sorted = order.slice().reverse().sort((a, b) => X.cmpDataVer(a, b));
  ck('cmpDataVer: 1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1', JSON.stringify(sorted) === JSON.stringify(order), sorted);
  ck('cmpDataVer: equal is 0', X.cmpDataVer('1.8.0-3', '1.8.0-3') === 0);
  ck('cmpDataVer: invalid on either side is 0', X.cmpDataVer('junk', '1.8.0') === 0 && X.cmpDataVer('1.8.0', undefined) === 0);
  [['v1.8.0', '1.8.0'], ['data-v1.8.0-2', '1.8.0-2'], ['data-v1.8.0', ''], ['v1.8.0-1', ''], ['1.8.0', ''],
   ['data-v1.8', ''], ['', ''], [null, '']].forEach(([t, want]) =>
    ck('dataVerOfTag ' + JSON.stringify(t) + ' -> ' + JSON.stringify(want), X.dataVerOfTag(t) === want, X.dataVerOfTag(t)));
  [['1.8.0-2', '1.8.0'], ['1.8.0', '1.8.0'], ['nope', '']].forEach(([v, want]) =>
    ck('dataVerBase ' + v + ' -> ' + JSON.stringify(want), X.dataVerBase(v) === want, X.dataVerBase(v)));
});

section('dataStatus reads data versions', () => {
  const sys = Object.keys(X.DATA_VERSIONS)[0], want = X.DATA_VERSIONS[sys];
  const at = v => { X.resetRules(); X.mergeRules({system: sys, rulebook: true, dataVersion: v, races: [{name: 'Elf'}]}, 'p.json'); return X.dataStatus(X.loadedRulesGroups()[0]); };
  ck('a data release after the baseline is current', at(want + '-1').state === 'current', at(want + '-1'));
  ck('the baseline itself is current', at(want).state === 'current');
  ck('a pack older than the baseline is stale', at('1.0.0').state === 'stale');
  ck('an unreadable version is unknown, never stale or current', at('1.0').state === 'unknown', at('1.0'));
  X.resetRules();
});

section('Import settings sees an older -N copy', () => {
  X.resetRules();
  X.mergeRules({system: 'XPHB', rulebook: true, dataVersion: '1.8.0-2', races: [{name: 'Elf'}]}, '5e2024_full.json');
  const saved = {races: [{name: 'Elf', _source: 'XPHB', _file: '5e2024_full.json', _rulebook: 1, _dataVersion: '1.8.0-1'}]};
  const built = X.poolFromExport(saved);
  const html = X.settingsImportQuestionHTML({pool: built.pool, skipped: 0});
  ck('a file holding 1.8.0-1 while 1.8.0-2 is loaded is an older copy', /puts back an older copy/.test(html), html.slice(0, 300));
  X.resetRules();
});

// ---- add new sections above this line ----
(async () => {
  for (const [name, fn] of SECTIONS) {
    try { await fn(); } catch (e) { ck(name + ' ran to the end', false, String((e && e.stack) || e)); }
  }
})().then(() => ck.done());
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/tests/data-archive.js`
Expected: `LOAD FAIL: parseDataVer is not defined`.

- [ ] **Step 3: Add the functions to `src/js/30-version.js`**

Directly after the `function cmpVer(a,b){…}` line:

```js
/* Rules-DATA versions (#83): X.Y.Z is the data shipped with app X.Y.Z, X.Y.Z-N
   the Nth data-only release after it. NOT semver, where -N would be a
   pre-release sorting BELOW X.Y.Z: here 1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1.
   cmpVer() reads "1.8.0-1" and "1.8.0-2" as equal, so data never goes through
   it. Anything unreadable compares as 0: unknown is never "stale" or "newer".
   Spec: 2026-10-07-data-archive-design.md §3. */
function parseDataVer(s){
  const m=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([1-9]\d*))?$/.exec(typeof s==="string"?s:"");
  return m?[+m[1],+m[2],+m[3],m[4]?+m[4]:0]:null;
}
function cmpDataVer(a,b){
  const pa=parseDataVer(a),pb=parseDataVer(b);
  if(!pa||!pb)return 0;
  for(let i=0;i<4;i++){if(pa[i]!==pb[i])return pa[i]>pb[i]?1:-1;}
  return 0;
}
/* "v1.8.0" -> "1.8.0"; "data-v1.8.0-2" -> "1.8.0-2"; anything else -> "". A data
   tag always has its -N: plain X.Y.Z belongs to the app release. */
function dataVerOfTag(tag){
  const t=typeof tag==="string"?tag:"";
  let m=/^v(\d+\.\d+\.\d+)$/.exec(t);
  if(m&&parseDataVer(m[1]))return m[1];
  m=/^data-v(\d+\.\d+\.\d+-\d+)$/.exec(t);
  if(m&&parseDataVer(m[1]))return m[1];
  return "";
}
/* the oldest app a data version is built for: "1.8.0-2" -> "1.8.0" */
function dataVerBase(v){const p=parseDataVer(v);return p?p.slice(0,3).join("."):"";}
```

- [ ] **Step 4: Use them in `src/js/88-settings.js`**

In `dataStatus(g)`, replace the body with:

```js
  const want=(typeof DATA_VERSIONS!=="undefined"&&DATA_VERSIONS[g.source])||"";
  if(!want||!g.dataVersion||!parseDataVer(g.dataVersion))return {state:"unknown"};
  const c=cmpDataVer(g.dataVersion,want);
  if(c<0)return {state:"stale",have:g.dataVersion,want};
  return {state:"current",have:g.dataVersion};
```

and in its comment, after "Unknown (an old pack from before stamping, or homebrew) is NOT stale", add "— nor is a version that doesn't parse (cmpDataVer)".

In `settingsImportQuestionHTML()`, in the `older` filter, change `cmpVer(f.dataVersion,g.dataVersion)<0` to `cmpDataVer(f.dataVersion,g.dataVersion)<0`.

- [ ] **Step 5: Register the suite**

`src/tests/run.sh`: append ` data-archive` to `SUITES`. `CLAUDE.md`: "(across eight suites)" → "(across nine suites)".

- [ ] **Step 6: Run everything**

Run: `node src/tests/data-archive.js && ./build.sh --no-zip && ./src/tests/run.sh`
Expected: `ALL PASSED`, then `All 9 suites passed`.

- [ ] **Step 7: Commit**

```bash
git add src/js/30-version.js src/js/88-settings.js src/tests/data-archive.js src/tests/run.sh CLAUDE.md
git commit -m "feat: data versions X.Y.Z-N in the app — parseDataVer, cmpDataVer (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The zip reader, `src/js/89-zip.js`

**Files:**
- Create: `src/js/89-zip.js`, `src/docs/wiki/architecture/data-archive.md` (a stub Task 9 completes)
- Modify: `src/manifest.json` (insert before `src/js/89-rules-merge.js`), `src/tests/harness.js` (`ctx`), `src/tests/data-archive.js`, `CLAUDE.md` and `src/docs/ADR-001-source-split.md` (31 → 32 fragments), `src/docs/wiki/overview.md` (code map row), `src/docs/wiki/index.md`

**Interfaces:**
- Consumes: nothing.
- Produces (all pure): `zipError(code, detail) -> Error` with `.code` one of `notzip|zip64|encrypted|method|damaged|toolarge|toomany|kit|empty`; `utf8Text(bytes) -> string`; `crc32(bytes) -> uint32`; `inflateRaw(bytes, size) -> Uint8Array`; `isZipBytes(bytes) -> bool`; `zipEntries(bytes) -> [{name, method, flags, crc, csize, usize, offset}]`; `zipEntryBytes(bytes, entry) -> Uint8Array`; `zipJunk(name) -> bool`; `readDataArchive(bytes, zipName) -> {kind: "data"|"loose", version: string, packs: [{name, bytes}]}`. Constants `ZIP_MAX_BYTES`, `ZIP_MAX_ENTRY`, `ZIP_MAX_TOTAL`, `ZIP_MAX_ENTRIES`.

- [ ] **Step 1: Give the harness `TextDecoder`**

In `src/tests/harness.js`, in the `ctx` object, after `parseInt, parseFloat, isNaN,` add:

```js
    TextDecoder, TextEncoder,
```

- [ ] **Step 2: Write the failing tests**

In `src/tests/data-archive.js`, add to the `loadApp([...])` list:
`'crc32', 'inflateRaw', 'isZipBytes', 'zipEntries', 'zipEntryBytes', 'readDataArchive', 'utf8Text', 'zipError',`

Then above `// ---- add new sections above this line ----`:

```js
// ---------- a zip writer for the tests: stored or deflated, an optional data
// descriptor, and every header field the refusal cases need to break
function makeZip(files, opt = {}) {
  const parts = [], central = []; let off = 0;
  files.forEach(f => {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data == null ? '' : f.data, 'utf8');
    const method = f.method == null ? 8 : f.method;
    const comp = f.comp || (method === 8 ? zlib.deflateRawSync(data, {level: f.level == null ? 6 : f.level}) : data);
    const name = Buffer.from(f.name, 'utf8');
    const crc = f.crc == null ? X.crc32(new Uint8Array(data)) : f.crc;
    const flags = (f.flags || 0) | 0x800 | (f.descriptor ? 8 : 0);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8);
    if (!f.descriptor) { lh.writeUInt32LE(crc >>> 0, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); }
    lh.writeUInt16LE(name.length, 26);
    const dd = Buffer.alloc(f.descriptor ? 16 : 0);
    if (f.descriptor) { dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc >>> 0, 4); dd.writeUInt32LE(comp.length, 8); dd.writeUInt32LE(data.length, 12); }
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc >>> 0, 16);
    ch.writeUInt32LE(f.csize == null ? comp.length : f.csize, 20);
    ch.writeUInt32LE(f.usize == null ? data.length : f.usize, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(f.offset == null ? off : f.offset, 42);
    parts.push(lh, name, comp, dd); central.push(ch, name);
    off += 30 + name.length + comp.length + dd.length;
  });
  const cd = Buffer.concat(central), eocd = Buffer.alloc(22);
  const n = opt.count == null ? files.length : opt.count;
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(n, 8); eocd.writeUInt16LE(n, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  const loc = Buffer.alloc(opt.zip64Locator ? 20 : 0);
  if (opt.zip64Locator) loc.writeUInt32LE(0x07064b50, 0);
  return new Uint8Array(Buffer.concat([...parts, cd, loc, eocd]));
}
/* a deterministic incompressible buffer */
const noise = n => { const b = Buffer.alloc(n); let s = 12345; for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; b[i] = s >>> 24; } return b; };
const PACK = (sys, spells) => JSON.stringify({system: sys, spells: spells.map(name => ({name}))});
const MANIFEST = (version, files) => JSON.stringify({_type: 'fieldbook-data', format: 1, version, builtFor: '1.8.0', packs: files.map(file => ({file}))});

section('crc32 and inflate', () => {
  ck('crc32 of nothing is 0', X.crc32(new Uint8Array(0)) === 0);
  ck('crc32 of "123456789" is cbf43926', X.crc32(new Uint8Array(Buffer.from('123456789'))) === 0xcbf43926);
  const text = Buffer.from(JSON.stringify(Array.from({length: 3000}, (_, i) => ({name: 'Spell ' + i, level: i % 10, text: 'Deal 8d6 fire damage.'}))));
  const big = Buffer.concat(Array.from({length: Math.ceil(2097152 / text.length)}, () => text)).subarray(0, 2097152);
  const inputs = {empty: Buffer.alloc(0), tiny: Buffer.from('a'), text, noise: noise(70000)};
  Object.entries(inputs).forEach(([label, buf]) => {
    for (let level = 0; level <= 9; level++) {
      const out = X.inflateRaw(new Uint8Array(zlib.deflateRawSync(buf, {level})), buf.length);
      ck('inflateRaw ' + label + ' at level ' + level, Buffer.from(out).equals(buf));
    }
  });
  [1, 6, 9].forEach(level => {
    const out = X.inflateRaw(new Uint8Array(zlib.deflateRawSync(big, {level})), big.length);
    ck('inflateRaw 2 MB at level ' + level, Buffer.from(out).equals(big));
  });
  const d = new Uint8Array(zlib.deflateRawSync(text));
  ck('a truncated stream is damaged', code(() => X.inflateRaw(d.subarray(0, d.length >> 1), text.length)) === 'damaged');
  ck('a bad block type is damaged', code(() => X.inflateRaw(new Uint8Array([0x07]), 10)) === 'damaged');
  ck('more output than promised is damaged', code(() => X.inflateRaw(d, text.length - 1)) === 'damaged');
  ck('less output than promised is damaged', code(() => X.inflateRaw(d, text.length + 1)) === 'damaged');
});

section('the zip reader refuses by name', () => {
  const ok = [{name: 'a.json', data: PACK('Zed', ['Zap'])}];
  ck('isZipBytes: a zip', X.isZipBytes(makeZip(ok)));
  ck('isZipBytes: JSON is not', !X.isZipBytes(new Uint8Array(Buffer.from('{"a":1}'))));
  ck('no end record: notzip', code(() => X.zipEntries(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0]))) === 'notzip');
  ck('an entry count of 0xFFFF: zip64', code(() => X.zipEntries(makeZip(ok, {count: 0xffff}))) === 'zip64');
  ck('a ZIP64 locator: zip64', code(() => X.zipEntries(makeZip(ok, {zip64Locator: true}))) === 'zip64');
  ck('a size of 0xFFFFFFFF: zip64', code(() => X.zipEntries(makeZip([{name: 'a.json', data: 'x', csize: 0xffffffff}]))) === 'zip64');
  ck('more than 1,000 entries: toomany', code(() => X.zipEntries(makeZip(ok, {count: 1001}))) === 'toomany');
  ck('encrypted (flag bit 0)', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: PACK('Z', ['A']), flags: 1}]), 'e.zip')) === 'encrypted');
  ck('encrypted (method 99, AES)', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: 'x', method: 99, comp: Buffer.from('x')}]), 'e.zip')) === 'encrypted');
  ck('bzip2 (method 12): method', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: 'x', method: 12, comp: Buffer.from('x')}]), 'm.zip')) === 'method');
  ck('a wrong CRC: damaged', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: PACK('Z', ['A']), crc: 1}]), 'c.zip')) === 'damaged');
  ck('an offset past the end: damaged', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: 'x', offset: 99999}]), 'o.zip')) === 'damaged');
  ck('an entry claiming 33 MiB: toolarge', code(() => X.readDataArchive(makeZip([{name: 'a.json', data: 'x', usize: 33 * 1048576}]), 'l.zip')) === 'toolarge');
  ck('a zip over 64 MiB: toolarge', code(() => X.zipEntries(new Uint8Array(64 * 1048576 + 1))) === 'toolarge');
  ck('the data kit: kit', code(() => X.readDataArchive(makeZip([{name: 'kit/fbdata.py', data: 'print()'}, {name: 'kit/README.md', data: '#'}]), 'k.zip')) === 'kit');
  ck('nothing usable: empty', code(() => X.readDataArchive(makeZip([{name: 'readme.txt', data: 'hi'}]), 'r.zip')) === 'empty');
});

section('the zip reader reads', () => {
  const loose = X.readDataArchive(makeZip([
    {name: '__MACOSX/._a.json', data: 'junk'}, {name: '._b.json', data: 'junk'}, {name: 'dir/.DS_Store', data: 'junk'},
    {name: 'dir/', data: '', method: 0}, {name: 'dir/b.json', data: PACK('Z', ['B'])}, {name: 'a.json', data: PACK('Z', ['A'])},
  ]), 'l.zip');
  ck('loose: every .json, in name order, junk ignored', loose.kind === 'loose' && loose.packs.map(p => p.name).join() === 'a.json,b.json', loose.packs.map(p => p.name));
  const bom = X.readDataArchive(makeZip([{name: 'a.json', data: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(PACK('Bom', ['A']))])}]), 'b.zip');
  ck('a BOM on a JSON entry is dropped by utf8Text', JSON.parse(X.utf8Text(bom.packs[0].bytes)).system === 'Bom');
  const desc = X.readDataArchive(makeZip([{name: 'a.json', data: PACK('Dd', ['A']), descriptor: true}]), 'd.zip');
  ck('a data-descriptor (flag bit 3) entry reads', JSON.parse(X.utf8Text(desc.packs[0].bytes)).system === 'Dd');
  const stored = X.readDataArchive(makeZip([{name: 'a.json', data: PACK('St', ['A']), method: 0}]), 's.zip');
  ck('a stored entry reads', JSON.parse(X.utf8Text(stored.packs[0].bytes)).system === 'St');
  const accent = X.readDataArchive(makeZip([{name: 'é.json', data: PACK('E', ['A'])}]), 'n.zip');
  ck('a non-ASCII name decodes', accent.packs[0].name === 'é.json', accent.packs[0].name);

  const archive = [{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['z_full.json', 'y_full.json'])},
                   {name: 'NOTICE.md', data: '# notice'},
                   {name: 'y_full.json', data: PACK('Y', ['B'])}, {name: 'z_full.json', data: PACK('Z', ['A'])}];
  const a = X.readDataArchive(makeZip(archive), 'fieldbook-data-standalone-1.8.0.zip');
  ck('an archive: kind data, its version, packs in manifest order', a.kind === 'data' && a.version === '1.8.0' && a.packs.map(p => p.name).join() === 'z_full.json,y_full.json', a);
  const down = X.readDataArchive(makeZip(archive.map(f => Object.assign({}, f, {name: 'fieldbook-data-standalone-1.8.0/' + f.name}))), 'r.zip');
  ck('an archive one folder down still reads', down.kind === 'data' && down.packs.length === 2, down);
  ck('a manifest listing a missing file: damaged',
     code(() => X.readDataArchive(makeZip([{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['gone.json'])}]), 'g.zip')) === 'damaged');
  ck('a manifest that is not one: damaged',
     code(() => X.readDataArchive(makeZip([{name: 'fieldbook-data.json', data: '{"_type":"other","packs":[]}'}]), 'g.zip')) === 'damaged');

  const app = X.readDataArchive(makeZip([
    {name: 'fieldbook.html', data: '<!doctype html>'}, {name: 'scripts/overlay.json', data: '{"byName":{}}'},
    {name: 'data/fieldbook-data-standalone-1.8.0.zip', data: Buffer.from(makeZip(archive)), method: 0},
  ]), 'fieldbook-v1.8.0.zip');
  ck('the app zip: the archive inside it is read', app.kind === 'data' && app.version === '1.8.0' && app.packs.length === 2, app);
  const notArchive = X.readDataArchive(makeZip([
    {name: 'data/other.zip', data: Buffer.from(makeZip([{name: 'x.json', data: PACK('X', ['A'])}])), method: 0},
    {name: 'a.json', data: PACK('Zed', ['A'])},
  ]), 'o.zip');
  ck('an inner zip that is not an archive is skipped', notArchive.kind === 'loose' && notArchive.packs.map(p => p.name).join() === 'a.json', notArchive);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node src/tests/data-archive.js`
Expected: `LOAD FAIL: crc32 is not defined`.

- [ ] **Step 4: Write `src/js/89-zip.js`**

```js
/* ================= reading a zip (#83) =================
   Rules data ships as one zip, fieldbook-data-standalone-<version>.zip, and the
   app opens it itself, offline (spec 2026-10-07-data-archive-design.md §9).
   Pure: bytes in, bytes out — no DOM, no storage — so the suites run it as is.

   A small reader of what every zip tool writes: entries found through the
   central directory, stored or deflated. Everything else is refused by name
   (zipError's code) rather than half-read, and the caps keep a hostile or
   mistaken file from eating a phone's memory. */
const ZIP_MAX_BYTES=64*1048576,ZIP_MAX_ENTRY=32*1048576,ZIP_MAX_TOTAL=128*1048576,ZIP_MAX_ENTRIES=1000;
function zipError(code,detail){const e=new Error(code+(detail?": "+detail:""));e.code=code;return e;}
/* Bytes to text the way a JSON file is read: UTF-8, a leading BOM dropped. */
function utf8Text(bytes){const s=new TextDecoder("utf-8").decode(bytes);return s.charCodeAt(0)===0xFEFF?s.slice(1):s;}
let _crcTable=null;
function crc32(bytes){
  if(!_crcTable){
    _crcTable=new Uint32Array(256);
    for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;_crcTable[n]=c>>>0;}
  }
  let c=0xFFFFFFFF;
  for(let i=0;i<bytes.length;i++)c=_crcTable[(c^bytes[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
/* ---- RFC 1951 inflate, after zlib's puff.c: small and plain rather than fast ---- */
const INF_LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const INF_LEXT=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const INF_DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const INF_DEXT=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
const INF_CLORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
let _infFixed=null;
/* a canonical Huffman code from its code lengths: how many codes of each
   length, and the symbols in code order */
function infTable(lens){
  const count=new Uint16Array(16),offs=new Uint16Array(16),symbol=new Uint16Array(lens.length);
  for(let i=0;i<lens.length;i++)count[lens[i]]++;
  count[0]=0;
  let left=1;
  for(let len=1;len<16;len++){left=left*2-count[len];if(left<0)throw zipError("damaged","an over-subscribed Huffman code");}
  for(let len=1;len<15;len++)offs[len+1]=offs[len]+count[len];
  for(let i=0;i<lens.length;i++)if(lens[i])symbol[offs[lens[i]]++]=i;
  return {count,symbol};
}
/* `size` is the length the zip's directory promises. The output is never
   allowed past it, so a hostile stream can't balloon, and must reach it. */
function inflateRaw(src,size){
  const out=new Uint8Array(size);
  let op=0,ip=0,bitbuf=0,bitcnt=0;
  const bits=need=>{
    let val=bitbuf;
    while(bitcnt<need){
      if(ip>=src.length)throw zipError("damaged","the compressed data ends early");
      val|=src[ip++]<<bitcnt;bitcnt+=8;
    }
    bitbuf=val>>>need;bitcnt-=need;
    return val&((1<<need)-1);
  };
  const decode=h=>{
    let code=0,first=0,index=0;
    for(let len=1;len<16;len++){
      code|=bits(1);
      const n=h.count[len];
      if(code-n<first)return h.symbol[index+(code-first)];
      index+=n;first=(first+n)<<1;code<<=1;
    }
    throw zipError("damaged","a bad Huffman code");
  };
  const room=len=>{if(op+len>size)throw zipError("damaged","longer than the zip says");};
  const codes=(lc,dc)=>{
    for(;;){
      let sym=decode(lc);
      if(sym<256){room(1);out[op++]=sym;continue;}
      if(sym===256)return;
      sym-=257;
      if(sym>=29)throw zipError("damaged","a bad length code");
      const len=INF_LBASE[sym]+bits(INF_LEXT[sym]);
      const ds=decode(dc);
      if(ds>=30)throw zipError("damaged","a bad distance code");
      const dist=INF_DBASE[ds]+bits(INF_DEXT[ds]);
      if(dist>op)throw zipError("damaged","a distance too far back");
      room(len);
      for(let i=0;i<len;i++,op++)out[op]=out[op-dist];
    }
  };
  let last=0;
  do{
    last=bits(1);
    const type=bits(2);
    if(type===0){
      /* stored: the rest of the current byte is padding */
      bitbuf=0;bitcnt=0;
      if(ip+4>src.length)throw zipError("damaged","the compressed data ends early");
      const len=src[ip]|(src[ip+1]<<8),nlen=src[ip+2]|(src[ip+3]<<8);ip+=4;
      if(len!==(~nlen&0xFFFF))throw zipError("damaged","a bad stored block");
      if(ip+len>src.length)throw zipError("damaged","the compressed data ends early");
      room(len);out.set(src.subarray(ip,ip+len),op);op+=len;ip+=len;
    }else if(type===1){
      if(!_infFixed){
        const l=new Uint8Array(288);let i=0;
        for(;i<144;i++)l[i]=8;for(;i<256;i++)l[i]=9;for(;i<280;i++)l[i]=7;for(;i<288;i++)l[i]=8;
        _infFixed=[infTable(l),infTable(new Uint8Array(30).fill(5))];
      }
      codes(_infFixed[0],_infFixed[1]);
    }else if(type===2){
      const nlen=bits(5)+257,ndist=bits(5)+1,ncode=bits(4)+4;
      if(nlen>286||ndist>30)throw zipError("damaged","a bad dynamic block");
      const cl=new Uint8Array(19);
      for(let i=0;i<ncode;i++)cl[INF_CLORDER[i]]=bits(3);
      const clh=infTable(cl),lens=new Uint8Array(nlen+ndist);
      for(let i=0;i<nlen+ndist;){
        const sym=decode(clh);
        if(sym<16){lens[i++]=sym;continue;}
        let val=0,rep;
        if(sym===16){if(!i)throw zipError("damaged","a repeat with nothing before it");val=lens[i-1];rep=3+bits(2);}
        else if(sym===17)rep=3+bits(3);
        else rep=11+bits(7);
        if(i+rep>nlen+ndist)throw zipError("damaged","too many code lengths");
        while(rep--)lens[i++]=val;
      }
      if(!lens[256])throw zipError("damaged","no end-of-block code");
      codes(infTable(lens.subarray(0,nlen)),infTable(lens.subarray(nlen)));
    }else throw zipError("damaged","a bad block type");
  }while(!last);
  if(op!==size)throw zipError("damaged","shorter than the zip says");
  return out;
}
/* ---- the container ---- */
function isZipBytes(b){return !!b&&b.length>=4&&b[0]===0x50&&b[1]===0x4B&&((b[2]===3&&b[3]===4)||(b[2]===5&&b[3]===6));}
function zipEntries(b){
  if(b.length>ZIP_MAX_BYTES)throw zipError("toolarge");
  const u16=o=>b[o]|(b[o+1]<<8),u32=o=>(b[o]|(b[o+1]<<8)|(b[o+2]<<16))+b[o+3]*16777216;
  /* the end record: the last 22 bytes, or up to a 64 KiB comment before them */
  let e=-1;
  for(let i=b.length-22;i>=0&&i>=b.length-22-65535;i--){
    if(b[i]===0x50&&b[i+1]===0x4B&&b[i+2]===5&&b[i+3]===6){e=i;break;}
  }
  if(e<0)throw zipError("notzip");
  const n=u16(e+10),cdSize=u32(e+12),cdOff=u32(e+16);
  if(u16(e+8)===0xFFFF||n===0xFFFF||cdSize===0xFFFFFFFF||cdOff===0xFFFFFFFF)throw zipError("zip64");
  if(e>=20&&u32(e-20)===0x07064B50)throw zipError("zip64");
  if(n>ZIP_MAX_ENTRIES)throw zipError("toomany");
  if(cdOff+cdSize>e)throw zipError("damaged","the directory is out of range");
  const dec=new TextDecoder("utf-8"),out=[];
  let p=cdOff;
  for(let k=0;k<n;k++){
    if(p+46>e||u32(p)!==0x02014B50)throw zipError("damaged","a bad directory entry");
    const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),csize=u32(p+20),usize=u32(p+24);
    const nl=u16(p+28),xl=u16(p+30),cl=u16(p+32),offset=u32(p+42);
    if(csize===0xFFFFFFFF||usize===0xFFFFFFFF||offset===0xFFFFFFFF)throw zipError("zip64");
    if(p+46+nl>e)throw zipError("damaged","a name out of range");
    out.push({name:dec.decode(b.subarray(p+46,p+46+nl)),method,flags,crc,csize,usize,offset});
    p+=46+nl+xl+cl;
  }
  return out;
}
function zipEntryBytes(b,en){
  if((en.flags&1)||en.method===99)throw zipError("encrypted",en.name);
  if(en.method!==0&&en.method!==8)throw zipError("method",String(en.method));
  if(en.usize>ZIP_MAX_ENTRY)throw zipError("toolarge",en.name);
  const o=en.offset;
  if(o+30>b.length||b[o]!==0x50||b[o+1]!==0x4B||b[o+2]!==3||b[o+3]!==4)throw zipError("damaged","a bad local header for "+en.name);
  const start=o+30+(b[o+26]|(b[o+27]<<8))+(b[o+28]|(b[o+29]<<8));
  if(start+en.csize>b.length)throw zipError("damaged",en.name+" runs past the end");
  const raw=b.subarray(start,start+en.csize);
  let data;
  if(en.method===0){if(en.csize!==en.usize)throw zipError("damaged",en.name+"'s sizes disagree");data=raw;}
  else data=inflateRaw(raw,en.usize);
  if(crc32(data)!==en.crc)throw zipError("damaged",en.name+" fails its CRC check");
  return data;
}
/* folders, and what macOS and Finder leave behind */
function zipJunk(name){
  const base=name.split("/").pop();
  return name.endsWith("/")||name.startsWith("__MACOSX/")||base.startsWith("._")||base===".DS_Store";
}
/* A rules zip -> {kind, version, packs:[{name, bytes}]} (spec §9.2), or a
   zipError. In order: an archive (its manifest at the root or one folder
   down); the data kit, refused; an archive one level inside (the app's zip);
   a zip of loose .json files. Every entry it returns is read and checked
   before it returns, so a damaged zip imports nothing at all. */
function readDataArchive(bytes,zipName,nested){
  const all=zipEntries(bytes).filter(en=>!zipJunk(en.name));
  let total=0;
  const read=en=>{total+=en.usize;if(total>ZIP_MAX_TOTAL)throw zipError("toolarge");return zipEntryBytes(bytes,en);};
  const base=n=>n.split("/").pop();
  const byName=(a,b)=>a.name<b.name?-1:a.name>b.name?1:0;
  const man=all.filter(en=>base(en.name)==="fieldbook-data.json"&&en.name.split("/").length<=2)
    .sort((a,b)=>a.name.length-b.name.length)[0];
  if(man){
    let m=null;
    try{m=JSON.parse(utf8Text(read(man)));}catch(e){if(e&&e.code)throw e;}
    if(!m||typeof m!=="object"||m._type!=="fieldbook-data"||!Array.isArray(m.packs))
      throw zipError("damaged","fieldbook-data.json isn't a Fieldbook data manifest");
    const dir=man.name.slice(0,man.name.length-"fieldbook-data.json".length);
    const packs=m.packs.map(p=>{
      const f=p&&typeof p.file==="string"?p.file:"";
      const en=f?all.find(x=>x.name===dir+f):null;
      if(!en)throw zipError("damaged","it lists "+(f||"a pack")+" but doesn't hold it");
      return {name:base(f),bytes:read(en)};
    });
    return {kind:"data",version:typeof m.version==="string"?m.version:"",packs};
  }
  if(all.some(en=>base(en.name)==="fbdata.py"))throw zipError("kit");
  if(!nested){
    const found=[];
    all.filter(en=>/\.zip$/i.test(en.name)).sort(byName).forEach(en=>{
      const inner=read(en);
      if(!isZipBytes(inner))return;
      let r;
      try{r=readDataArchive(inner,base(en.name),true);}
      catch(e){if(e&&(e.code==="notzip"||e.code==="kit"||e.code==="empty"))return;throw e;}
      if(r.kind==="data")found.push(r);
    });
    if(found.length)return {kind:"data",version:found.map(r=>r.version).filter(Boolean).join(", "),
      packs:[].concat(...found.map(r=>r.packs))};
  }
  const json=all.filter(en=>/\.json$/i.test(en.name)).sort(byName);
  if(json.length)return {kind:"loose",version:"",packs:json.map(en=>({name:base(en.name),bytes:read(en)}))};
  throw zipError("empty");
}
```

- [ ] **Step 5: Register the fragment**

In `src/manifest.json`'s `js` list, insert `"src/js/89-zip.js",` between `"src/js/88-settings.js",` and `"src/js/89-rules-merge.js",`.

- [ ] **Step 6: Run the suite**

Run: `node src/tests/data-archive.js`
Expected: `ALL PASSED (n)`. If an inflate case fails, compare against the puff.c logic above before changing a test.

- [ ] **Step 7: Keep the docs suite green for a new fragment**

1. `CLAUDE.md`: `js/*.js                31 fragments` → `32 fragments`.
2. `src/docs/ADR-001-source-split.md`: `js/ (31 fragments)` → `js/ (32 fragments)`.
3. `src/docs/wiki/overview.md`, in the code map table, after the `88-settings.js` row:
   `` | `89-zip.js` | the zip reader: `readDataArchive()`, `inflateRaw()`, `zipEntries()` — pure | [Data archive](architecture/data-archive.md) | ``
4. Create `src/docs/wiki/architecture/data-archive.md` (Task 9 writes it in full):

```markdown
# Data archive

Rules data ships as one zip, `fieldbook-data-standalone-<version>.zip`, and Fieldbook opens it
itself. This page covers the archive, the registry of packs and their versions, and data-only
releases. It is being written as #83 lands; the spec is
[2026-10-07-data-archive-design](../../specs/2026-10-07-data-archive-design.md).

**Code:** `readDataArchive()`, `zipEntries()`, `zipEntryBytes()`, `inflateRaw()`, `crc32()` in
`89-zip.js` · **Tests:** `data-archive.js` · **See also:** [Rules packs](rules-packs.md)
```

5. `src/docs/wiki/index.md`, under "## Architecture", after the Rules packs line:
   `- [Data archive](architecture/data-archive.md) — the data zip, the pack registry and versions, data-only releases`

- [ ] **Step 8: Build and run everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: `All 9 suites passed`.

- [ ] **Step 9: Commit**

```bash
git add src/js/89-zip.js src/manifest.json src/tests/harness.js src/tests/data-archive.js CLAUDE.md \
  src/docs/ADR-001-source-split.md src/docs/wiki/overview.md src/docs/wiki/architecture/data-archive.md src/docs/wiki/index.md
git commit -m "feat: a pure zip reader for rules data — 89-zip.js (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Importing zips and JSON as bytes — `importRulesPayloads`, `importPack`, the status lines, the pickers

**Files:**
- Modify: `src/js/89-rules-merge.js` (replace `importRulesFiles()`; change `applyFetchedSource()`), `src/js/90-boot.js` (the `homeRulesFiles` change handler), `src/js/88-settings.js` (the `fileRules` input and the Rules sources hint), `src/fieldbook.template.html` (the `homeRulesFiles` input and its hint), `src/html/40-rules.html` (`glossRulesFiles`, `tablesRulesFiles`), `src/tests/rules-data.js` (move the #71 file-import checks out), `src/tests/data-archive.js`

**Interfaces:**
- Consumes: `isZipBytes`, `readDataArchive`, `utf8Text` (Task 3); `mergeRules`, `srcLabel`, `addSkipped`, `skippedSummary`, `missingSummary`, `rulesStatusText`, `updateRulesStatus`, `saveRulesCache`, `pruneRequires`, `reindexRules`, `recomputeDups`, `RULE_CATS` (existing).
- Produces: `ZIP_WHY` (code → reason text); `isRulesPack(obj) -> bool`; `dropOwnedPackMeta(labels, old)`; `importPack(obj, file) -> skipped`; `importRulesPayloads([{name, bytes}]) -> {files, archives:[{name, kind, version, count}], failed:[{name, why}], skipped}`; `importSummary(res) -> string`; `rulesImportStatus(msg, cls)`; `importRulesFiles(files) -> Promise<{msg, cls}>`. Task 5 renames `pruneRequires` to `prunePackMeta` at every call site, including the one `importPack` adds here.

- [ ] **Step 1: Write the failing tests**

In `src/tests/data-archive.js`, add to the `loadApp([...])` list:
`'importRulesPayloads', 'importPack', 'importSummary', 'importRulesFiles', 'RULE_CATS',`

Then above the marker line:

```js
const B = s => new Uint8Array(Buffer.from(s, 'utf8'));
const names = cat => (X.rules[cat] || []).map(e => e.name);
/* the pool as data, minus the ids the importer hands out */
const poolSnap = () => JSON.stringify([X.RULE_CATS.map(c => (X.rules[c] || []).map(e => {
  const o = Object.assign({}, e); delete o._id; if (c === 'keywords') delete o.id; return o; })),
  X.rules.requires || {}, X.rules.credits || {}]);

section('importing payloads', () => {
  X.resetRules();
  let res = X.importRulesPayloads([{name: 'a.json', bytes: B(PACK('Zed', ['Zap', 'Bolt']))}]);
  ck('a JSON file imports', res.files === 1 && names('spells').join() === 'Zap,Bolt', res);
  X.importRulesPayloads([{name: 'a.json', bytes: B(PACK('Zed', ['Zap']))}]);
  ck('re-importing a file drops what its new copy no longer has (R4)', names('spells').join() === 'Zap', names('spells'));
  X.importRulesPayloads([{name: 'spells.json', bytes: B(PACK('Tasha', ['T1']))}, {name: 'spells.json', bytes: B(PACK('Xan', ['X1']))}]);
  ck('the same file name from another system is left alone', ['Zap', 'T1', 'X1'].every(n => names('spells').includes(n)), names('spells'));
  X.importRulesPayloads([{name: 'spells.json', bytes: B(PACK('Tasha', ['T2']))}]);
  ck('...and re-importing one of them replaces only its own', names('spells').sort().join() === 'T2,X1,Zap', names('spells'));

  /* requires: dropped with the last file that declared it, kept while another file shares the label */
  const HB = (spells, req) => B(JSON.stringify(Object.assign({system: 'HB', spells: spells.map(name => ({name}))},
    req ? {requires: [{spells: ['Nope']}]} : {})));
  X.resetRules();
  X.importRulesPayloads([{name: 'h.json', bytes: HB(['A'], true)}]);
  ck('requires is recorded', !!(X.rules.requires && X.rules.requires.HB));
  X.importRulesPayloads([{name: 'h.json', bytes: HB(['A'], false)}]);
  ck('a re-import that stops declaring requires drops it, when that file alone had the label',
     !(X.rules.requires && X.rules.requires.HB), X.rules.requires);
  X.importRulesPayloads([{name: 'h.json', bytes: HB(['A'], true)}, {name: 'h2.json', bytes: HB(['B'], false)}]);
  X.importRulesPayloads([{name: 'h2.json', bytes: HB(['B'], false)}]);
  ck('a label shared with another file keeps its requires', !!(X.rules.requires && X.rules.requires.HB), X.rules.requires);

  /* failures are named, and nothing half-loads */
  X.resetRules();
  res = X.importRulesPayloads([{name: 'bad.json', bytes: B('{ nope')}, {name: 'list.json', bytes: B('[1,2]')},
    {name: 'gone.json', bytes: null},
    {name: 'locked.zip', bytes: makeZip([{name: 'a.json', data: PACK('Z', ['A']), flags: 1}])},
    {name: 'kit.zip', bytes: makeZip([{name: 'fbdata.py', data: ''}])}]);
  const why = Object.fromEntries(res.failed.map(f => [f.name, f.why]));
  ck('bad JSON: "not valid JSON"', why['bad.json'] === 'not valid JSON', why);
  ck('a JSON list: "not a rules file"', why['list.json'] === 'not a rules file', why);
  ck('an unreadable file: "it couldn\'t be read"', why['gone.json'] === "it couldn't be read", why);
  ck('an encrypted zip: "it\'s password-protected"', why['locked.zip'] === "it's password-protected", why);
  ck('the data kit says it is the kit', /data kit/.test(why['kit.zip'] || ''), why);
  ck('...and nothing was loaded', X.RULE_CATS.every(c => !(X.rules[c] || []).length));

  /* an archive */
  X.resetRules();
  const arc = makeZip([{name: 'fieldbook-data.json', data: MANIFEST('1.8.0', ['z_full.json', 'y_full.json'])},
    {name: 'y_full.json', data: PACK('Y', ['B'])}, {name: 'z_full.json', data: PACK('Z', ['A'])}]);
  res = X.importRulesPayloads([{name: 'fieldbook-data-standalone-1.8.0.zip', bytes: arc}]);
  ck('an archive imports each pack under its own file name',
     X.loadedRulesGroups().map(g => g.label).sort().join() === 'y_full.json,z_full.json', X.loadedRulesGroups().map(g => g.label));
  ck('...and the summary names the archive, its packs and its version',
     X.importSummary(res) === 'Imported fieldbook-data-standalone-1.8.0.zip: 2 packs, data 1.8.0.', X.importSummary(res));
  const once = poolSnap();
  res = X.importRulesPayloads([{name: 'fieldbook-data-standalone-1.8.0.zip', bytes: arc}]);
  ck('Review focus 2: importing the same archive twice leaves the pool as it was', poolSnap() === once && res.failed.length === 0);
  X.resetRules();
  X.importRulesPayloads([{name: 'z_full.json', bytes: B(PACK('Z', ['A', 'Old']))}]);
  X.importRulesPayloads([{name: 'a.zip', bytes: arc}]);
  ck('the archive replaces the same pack imported loose', names('spells').sort().join() === 'A,B', names('spells'));

  /* Review focus 1: an app zip from 1.7.x */
  X.resetRules();
  const overlay = fs.readFileSync(path.join(ROOT, 'data/overlay.json'));
  const resources = fs.readFileSync(path.join(ROOT, 'data/class-resources.json'));
  res = X.importRulesPayloads([{name: 'fieldbook-v1.7.2.zip', bytes: makeZip([
    {name: 'fieldbook.html', data: '<!doctype html>'}, {name: 'README.md', data: '# Fieldbook'},
    {name: 'scripts/overlay.json', data: overlay}, {name: 'scripts/class-resources.json', data: resources},
    {name: 'data/a_full.json', data: PACK('A', ['One'])}, {name: 'data/b_full.json', data: PACK('B', ['Two'])}])}]);
  ck('Review focus 1: an old app zip loads only its packs, and says so',
     res.failed.length === 0 && X.importSummary(res) === 'Imported fieldbook-v1.7.2.zip: 2 files.' && names('spells').sort().join() === 'One,Two',
     [X.importSummary(res), res.failed]);
  res = X.importRulesPayloads([{name: 'inputs.zip', bytes: makeZip([{name: 'overlay.json', data: overlay}])}]);
  ck('a zip holding no rules pack at all: "there\'s no rules data in it"',
     res.failed.length === 1 && res.failed[0].why === "there's no rules data in it", res.failed);
  X.resetRules();
});

section('Import files: the status lines', async () => {
  const writes = [];
  const el = id => {
    const o = {className: '', _t: ''};
    Object.defineProperty(o, 'textContent', {get() { return o._t; }, set(v) { o._t = v; writes.push(id + ': ' + v); }});
    return o;
  };
  const els = {rulesStatus: el('rulesStatus'), homeRulesStatus: el('homeRulesStatus')};
  const getById = ctx.document.getElementById;
  ctx.document.getElementById = id => els[id] || getById(id);
  const hadFR = 'FileReader' in ctx;
  ctx.FileReader = class {
    readAsArrayBuffer(f) {
      if (f.fail) { if (this.onerror) this.onerror(); return; }
      const b = Buffer.from(f.bytes);
      this.result = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      if (this.onload) this.onload();
    }
  };
  const file = (name, s) => ({name, bytes: Buffer.from(s, 'utf8')});
  try {
    X.resetRules(); writes.length = 0;
    const p = X.importRulesFiles([file('a.json', PACK('Zed', ['Zap']))]);
    ck('Review focus 3: "Reading 1 file…" shows at once, on both lines',
       writes[0] === 'rulesStatus: Reading 1 file…' && writes[1] === 'homeRulesStatus: Reading 1 file…', writes);
    const out = await p;
    ck('a good import says what it merged, as ok', /^Merged 1 file\. Loaded/.test(out.msg) && out.cls === 'ok', out);
    ck('...on the home screen too', els.homeRulesStatus.textContent === out.msg, els.homeRulesStatus.textContent);
    const bad = await X.importRulesFiles([file('broken.json', '{ nope'), {name: 'gone.json', fail: true}]);
    ck('a failure is named with its reason',
       /Couldn't import broken\.json: not valid JSON\./.test(bad.msg) && /Couldn't import gone\.json: it couldn't be read\./.test(bad.msg)
       && bad.cls === 'err', bad);
    /* moved from rules-data.js (#71) */
    X.resetRules();
    const sk = await X.importRulesFiles([file('hb.json', JSON.stringify({system: 'HB',
      keywords: [{text: 'no term'}, {term: 'Kept'}], spells: [{level: 1}, {name: 'Zap'}]}))]);
    ck('#71 importing a file says what it skipped',
       /skipped/i.test(sk.msg) && /1 glossary entry/.test(sk.msg) && /1 spell/.test(sk.msg), sk.msg);
    ck('#71 ...and the rest of it loaded', (X.rules.keywords || []).length === 1 && (X.rules.spells || []).length === 1);
    X.resetRules();
    const clean = await X.importRulesFiles([file('ok.json', PACK('HB', ['Zap']))]);
    ck('#71 ...and a clean file says nothing about skipping', !/skipped/i.test(clean.msg) && clean.cls === 'ok', clean);
    /* the storage rule: a cache write that does not land is said on the same line */
    state.quotaFull = true;
    const full = await X.importRulesFiles([file('q.json', PACK('Q', ['Q1']))]);
    state.quotaFull = false;
    ck('a cache save that fails is reported on both import lines',
       full.cls === 'err' && /wouldn't save/.test(full.msg) && /wouldn't save/.test(els.homeRulesStatus.textContent), full);
  } finally {
    ctx.document.getElementById = getById;
    if (!hadFR) delete ctx.FileReader;
    X.resetRules();
  }
});

section('every rules picker takes a zip', () => {
  const src = ['src/fieldbook.template.html', 'src/html/40-rules.html', 'src/js/88-settings.js']
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  ['fileRules', 'homeRulesFiles', 'glossRulesFiles', 'tablesRulesFiles'].forEach(id => {
    const m = new RegExp('id="' + id + '" accept="([^"]*)"').exec(src);
    const acc = m ? m[1].split(',') : [];
    ck('Review focus 4: ' + id + ' accepts .json, .zip, application/zip and application/x-zip-compressed',
       ['.json', '.zip', 'application/zip', 'application/x-zip-compressed'].every(t => acc.includes(t)), m && m[1]);
  });
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8');
  ck('the home import no longer overwrites its own status line on a timer',
     !/homeRulesFiles[^\n]*setTimeout/.test(boot), (/homeRulesFiles[^\n]*/.exec(boot) || [])[0]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node src/tests/data-archive.js`
Expected: `LOAD FAIL: importRulesPayloads is not defined`.

- [ ] **Step 3: Replace `importRulesFiles()` in `src/js/89-rules-merge.js`**

Delete the existing `/* import one or many files; … */` comment and `function importRulesFiles(files){…}`, and put this in their place:

```js
/* ---- importing files (#83) ----
   Why a zip couldn't be imported, in the player's words. */
const ZIP_WHY={
  notzip:"it isn't a zip Fieldbook can read",
  encrypted:"it's password-protected",
  zip64:"it's a ZIP64 archive",
  method:"it uses a compression Fieldbook can't read; re-zip it normally or import the .json files",
  damaged:"it's damaged — download it again",
  toolarge:"it's too large to be rules data",
  toomany:"it has too many files to be rules data",
  kit:"that's the Fieldbook data kit, a tool for building rules data — import a fieldbook-data-standalone zip instead",
  empty:"there's no rules data in it"
};
/* Holds at least one rules category: what tells a pack from the converter's
   own inputs (overlay.json, class-resources.json) inside an old app zip. */
function isRulesPack(o){return RULE_CATS.concat(["traits"]).some(c=>Array.isArray(o[c]));}
/* A label's `requires` and `credits` are kept once per LABEL, and mergeRules
   only ever sets them. When the entries about to be replaced are everything
   that label has, the fresh copy decides: drop them first, so a pack that
   stopped declaring one doesn't keep it. A label another file shares keeps it. */
function dropOwnedPackMeta(labels,old){
  labels.forEach(l=>{
    if(!RULE_CATS.every(c=>(rules[c]||[]).every(e=>(e._source||"")!==l||old.has(e))))return;
    if(rules.requires)delete rules.requires[l];
    if(rules.credits)delete rules.credits[l];
  });
}
/* One pack from a file, replacing what that same file loaded before (R4).
   mergeRules() alone only adds and replaces, so an entry the new copy dropped
   lingered forever. Keyed on file name AND source, so spells.json from one
   pack never unloads spells.json from another — applyFetchedSource()'s
   pattern, for files. */
function importPack(obj,file){
  const src=srcLabel(obj),old=new Set();
  RULE_CATS.forEach(c=>(rules[c]||[]).forEach(e=>{if(e&&e._file===file&&(e._source||"")===src)old.add(e);}));
  dropOwnedPackMeta([src],old);
  const skipped=mergeRules(obj,file);
  RULE_CATS.forEach(c=>{if(rules[c])rules[c]=rules[c].filter(e=>!old.has(e));});
  pruneRequires();reindexRules();recomputeDups();
  return skipped;
}
/* Rules files as bytes -> merged into the pool. Pure — no DOM, no storage —
   so the suites drive it directly; importRulesFiles() reads and reports.
   A zip (known by its first bytes, whatever its name) goes through
   readDataArchive(), and each pack inside is imported under its OWN file
   name: the loaded-data rows and version chips stay per pack, and the zip
   replaces the same packs imported loose. A zip is read whole before any of
   it merges, so a damaged one changes nothing. Anything else is one JSON pack.
   Returns {files, archives:[{name,kind,version,count}], failed:[{name,why}],
   skipped}. */
function importRulesPayloads(payloads){
  const res={files:0,archives:[],failed:[],skipped:{}};
  const parse=(name,bytes)=>{
    let obj;
    try{obj=JSON.parse(utf8Text(bytes));}catch(e){res.failed.push({name,why:"not valid JSON"});return null;}
    if(!obj||typeof obj!=="object"||Array.isArray(obj)){res.failed.push({name,why:"not a rules file"});return null;}
    return obj;
  };
  (Array.isArray(payloads)?payloads:[]).forEach(p=>{
    const name=String((p&&p.name)||"file"),raw=p&&p.bytes;
    if(!raw||!ArrayBuffer.isView(raw)){res.failed.push({name,why:"it couldn't be read"});return;}
    const bytes=new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength);
    if(!isZipBytes(bytes)){
      const obj=parse(name,bytes);
      if(obj){addSkipped(res.skipped,importPack(obj,name));res.files++;}
      return;
    }
    let arc;
    try{arc=readDataArchive(bytes,name);}
    catch(e){res.failed.push({name,why:ZIP_WHY[e&&e.code]||"it couldn't be read"});return;}
    const before=res.failed.length;let count=0;
    arc.packs.forEach(pk=>{
      const obj=parse(pk.name+" in "+name,pk.bytes);
      if(!obj||(arc.kind==="loose"&&!isRulesPack(obj)))return;
      addSkipped(res.skipped,importPack(obj,pk.name));count++;
    });
    if(!count&&arc.kind==="loose"&&res.failed.length===before){res.failed.push({name,why:ZIP_WHY.empty});return;}
    res.archives.push({name,kind:arc.kind,version:arc.version,count});
  });
  return res;
}
/* the first sentences of the status line: each zip, the loose files, each failure */
function importSummary(res){
  const s=[];
  res.archives.forEach(a=>s.push(`Imported ${a.name}: ${a.count} ${a.kind==="loose"?"file":"pack"}${a.count===1?"":"s"}${a.version?", data "+a.version:""}.`));
  if(res.files)s.push(`Merged ${res.files} file${res.files===1?"":"s"}.`);
  res.failed.forEach(f=>s.push(`Couldn't import ${f.name}: ${f.why}.`));
  return s.join(" ");
}
/* Both status lines, Settings' and the home screen's, whichever is on show.
   The home one used to be overwritten with the bare count 400 ms after an
   import, which hid every failure there. */
function rulesImportStatus(msg,cls){
  updateRulesStatus(msg,cls);
  const h=document.getElementById("homeRulesStatus");if(h)h.textContent=msg;
}
/* Settings → Import files, the home screen's import and the Rules tab's two:
   read every file as bytes, import, save the cache, and say what happened.
   A save that does not land is said on the same line (the storage rule).
   Resolves to {msg, cls} once the save has landed or failed, for the suites. */
function importRulesFiles(files){
  const list=Array.from(files||[]);
  rulesImportStatus(`Reading ${list.length} file${list.length===1?"":"s"}…`,"");
  const readOne=f=>new Promise(resolve=>{
    const r=new FileReader();
    r.onload=()=>resolve({name:f.name,bytes:new Uint8Array(r.result)});
    r.onerror=()=>resolve({name:f.name,bytes:null});
    r.readAsArrayBuffer(f);
  });
  return Promise.all(list.map(readOne)).then(payloads=>{
    const res=importRulesPayloads(payloads);
    const saving=saveRulesCache();
    refreshRulesUI();renderRulesData();
    const m=missingSummary(),sk=skippedSummary(res.skipped);
    const msg=(importSummary(res)+" "+rulesStatusText()+m+sk).trim();
    const cls=(res.failed.length||m||sk)?"err":"ok";
    rulesImportStatus(msg,cls);
    return saving.then(err=>{
      if(!err)return {msg,cls};
      renderRulesData();rulesImportStatus(msg+" "+err,"err");
      return {msg:msg+" "+err,cls:"err"};
    });
  });
}
```

- [ ] **Step 4: Let `applyFetchedSource()` share the label rule**

In `applyFetchedSource()`, replace this block:

```js
  /* A `requires` declaration is kept per LABEL, and mergeRules only ever sets
     one. If this source alone owns a label, its fresh copy decides the
     declaration, so a pack that stopped declaring one doesn't keep a false
     "missing" chip. A label shared with a file import keeps it. */
  if(rules.requires)new Set(packs.map(srcLabel)).forEach(l=>{
    if(RULE_CATS.every(c=>(rules[c]||[]).every(e=>(e._source||"")!==l||old.has(e))))delete rules.requires[l];
  });
```

with:

```js
  /* If this source alone owns a label, its fresh copy decides the label's
     `requires` (and credits), so a pack that stopped declaring one doesn't
     keep a false "missing" chip. A label shared with a file import keeps it. */
  dropOwnedPackMeta(new Set(packs.map(srcLabel)),old);
```

- [ ] **Step 5: The pickers and their help text**

1. In all four inputs — `#fileRules` (`src/js/88-settings.js`), `#homeRulesFiles` (`src/fieldbook.template.html`), `#glossRulesFiles` and `#tablesRulesFiles` (`src/html/40-rules.html`) — change `accept="application/json,.json"` to
   `accept="application/json,.json,application/zip,application/x-zip-compressed,.zip"`. Keep `id` immediately before `accept`, as now (the test reads `id="…" accept="…"`).
2. `src/fieldbook.template.html`: replace the hint under the home import, "Select multiple JSON files at once — races, classes, spells, feats, backgrounds, subclasses, and glossary all merge together.", with "Choose the rules data zip, or JSON files — races, classes, spells, feats, backgrounds, subclasses and glossary all merge together. You can pick several at once."
3. `src/js/88-settings.js`, the Rules sources hint: replace its opening words "Load one or more JSON files — split by category" with "Import the rules data zip, or one or more JSON files — split by category".
4. `src/html/40-rules.html`: if a hint beside either import names JSON files, add the zip the same way; if neither has one, change nothing else.
5. `src/js/90-boot.js`: the `homeRulesFiles` change handler becomes
   `document.getElementById("homeRulesFiles").addEventListener("change",e=>{if(e.target.files.length)importRulesFiles(e.target.files);e.target.value="";});`

- [ ] **Step 6: Move the #71 file-import checks out of `rules-data.js`**

In `src/tests/rules-data.js`, delete from the line `  /* the file import writes it on the status line the player is reading */` through the line `  if (!hadFR) delete ctx.FileReader;` (keep the `X.resetRules();` and `}` after it). Its three checks now live in `data-archive.js` under the same names. Then run `grep -n "importRulesFiles\|Merged " src/tests/*.js` and make sure nothing else still drives the old synchronous `readAsText` import.

- [ ] **Step 7: Run everything**

Run: `node src/tests/data-archive.js && ./build.sh --no-zip && ./src/tests/run.sh`
Expected: `ALL PASSED`, then `All 9 suites passed`.

- [ ] **Step 8: Commit**

```bash
git add src/js/89-rules-merge.js src/js/90-boot.js src/js/88-settings.js src/fieldbook.template.html src/html/40-rules.html \
  src/tests/rules-data.js src/tests/data-archive.js
git commit -m "feat: import the rules data zip; a re-import replaces its pack; failures named on both status lines (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Pack credits — `rules.credits` and Settings → Credits & licences

**Files:**
- Modify: `src/js/89-rules-merge.js` (`creditOf` new; `mergeRules`; `resetRules`; `tidyRules`; `poolFromExport`; `importPack` and `applyFetchedSource` call sites), `src/js/88-settings.js` (`pruneRequires` → `prunePackMeta`; `rulesCreditsHTML` new; `openSettings`'s `secCredits`), `src/tests/data-archive.js`, `src/docs/wiki/architecture/rules-packs.md` (two mentions of `pruneRequires()`)

**Interfaces:**
- Consumes: `importRulesPayloads`, `importPack`, `dropOwnedPackMeta` (Task 4).
- Produces: `creditOf(title, license, attribution) -> {title, license, attribution} | null`; `rules.credits[label]`; `prunePackMeta()`; `LICENSE_URLS`; `rulesCreditsHTML() -> string` (`""` when no loaded pack has a credit).

- [ ] **Step 1: Write the failing tests**

In `src/tests/data-archive.js`, add to the `loadApp([...])` list:
`'creditOf', 'rulesCreditsHTML', 'removeRulesGroup', 'clearAllRules', 'reindexRules', 'prunePackMeta',`

Then above the marker line:

```js
section('pack credits', () => {
  const HBC = {system: 'Homebrew', name: 'Homebrew', license: 'CC-BY-SA-3.0',
               attribution: 'The Predator, by someone. Changed: converted.', spells: [{name: 'Zap'}]};
  X.resetRules();
  X.mergeRules(HBC, 'homebrew_full.json');
  ck('a pack\'s licence and credit are kept per source',
     JSON.stringify(X.rules.credits.Homebrew) === JSON.stringify({title: 'Homebrew', license: 'CC-BY-SA-3.0',
       attribution: 'The Predator, by someone. Changed: converted.'}), X.rules.credits);
  X.resetRules();
  X.mergeRules({system: 'Long', license: 'x'.repeat(65), attribution: 'y'.repeat(2500), spells: [{name: 'A'}]}, 'l.json');
  ck('an over-long licence is dropped, and a credit is cut to 2,000',
     X.rules.credits.Long.license === '' && X.rules.credits.Long.attribution.length === 2000, X.rules.credits.Long);
  X.resetRules();
  X.mergeRules({system: 'Plain', spells: [{name: 'A'}]}, 'p.json');
  ck('a pack with neither has no credit', !X.rules.credits || !X.rules.credits.Plain);

  /* lifecycle */
  X.resetRules();
  X.importRulesPayloads([{name: 'h.json', bytes: B(JSON.stringify(HBC))}]);
  X.importRulesPayloads([{name: 'h.json', bytes: B(JSON.stringify({system: 'Homebrew', spells: [{name: 'Zap'}]}))}]);
  ck('a re-import without a credit drops it', !X.rules.credits.Homebrew, X.rules.credits);
  X.importRulesPayloads([{name: 'h.json', bytes: B(JSON.stringify(HBC))}]);
  X.removeRulesGroup(X.loadedRulesGroups().find(g => g.label === 'h.json').key);
  ck('removing the pack prunes its credit', !X.rules.credits.Homebrew, X.rules.credits);
  X.importRulesPayloads([{name: 'h.json', bytes: B(JSON.stringify(HBC))}]);
  state.confirm = true;
  X.clearAllRules();
  ck('clearing everything clears credits', JSON.stringify(X.rules.credits) === '{}', X.rules.credits);

  /* settings files carry them */
  X.resetRules();
  X.mergeRules(HBC, 'homebrew_full.json');
  const saved = JSON.parse(JSON.stringify(X.rules));
  saved.credits.Ghost = {title: 'Gone', license: 'MIT', attribution: 'Nobody'};
  saved.credits.Junk = 'not an object';
  const built = X.poolFromExport(saved);
  ck('a settings file\'s pool keeps the credits of the packs it holds',
     !!built.pool.credits && !!built.pool.credits.Homebrew && built.pool.credits.Homebrew.license === 'CC-BY-SA-3.0', built.pool.credits);
  ck('...and none for labels it doesn\'t hold, or junk', !built.pool.credits.Ghost && !built.pool.credits.Junk, built.pool.credits);

  /* an old or broken cache */
  X.resetRules();
  delete X.rules.credits;
  ck('a pool from before credits renders no credits list', X.rulesCreditsHTML() === '');
  X.prunePackMeta();
  ck('...and prunes without throwing', true);
  X.rules.credits = 'junk';
  X.reindexRules();
  ck('a credits value that isn\'t an object is reset by the tidy', JSON.stringify(X.rules.credits) === '{}', X.rules.credits);

  /* shown escaped */
  X.resetRules();
  X.mergeRules({system: 'Evil', name: '<b>Evil</b>', license: 'CC-BY-4.0', attribution: '<img src=x onerror=alert(1)>', spells: [{name: 'A'}]}, 'e.json');
  X.mergeRules({system: 'Odd', license: 'Custom-1', attribution: 'Ours.', spells: [{name: 'B'}]}, 'o.json');
  const html = X.rulesCreditsHTML();
  ck('credits are escaped, never markup', !/<img/.test(html) && html.includes('&lt;img') && html.includes('&lt;b&gt;Evil'), html);
  ck('a known licence links its deed', html.includes('href="https://creativecommons.org/licenses/by/4.0/"'), html);
  ck('an unknown licence is plain text', html.includes('Licence: Custom-1.') && !/href="[^"]*Custom/.test(html), html);

  /* the shipped Homebrew bundle carries its credit through an import */
  const hb = path.join(ROOT, 'dist', 'homebrew_full.json');
  if (fs.existsSync(hb)) {
    X.resetRules();
    X.importRulesPayloads([{name: 'homebrew_full.json', bytes: new Uint8Array(fs.readFileSync(hb))}]);
    ck('the Homebrew bundle\'s credit reaches Settings',
       /CC-BY-SA-3\.0/.test(X.rulesCreditsHTML()) && /D&amp;D Wiki/.test(X.rulesCreditsHTML()), X.rulesCreditsHTML());
  } else console.log('note: dist/homebrew_full.json missing (run.sh bundles first), its credit check skipped');
  X.resetRules();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node src/tests/data-archive.js`
Expected: `LOAD FAIL: creditOf is not defined`.

- [ ] **Step 3: Credits in `src/js/89-rules-merge.js`**

1. Directly before `function mergeRules(obj,fileName,url){`:

```js
/* A pack's licence and credit (#83), kept per source LABEL like `requires`, for
   Settings → Credits & licences: null when it states neither. Plain strings,
   capped, never markup — they are shown through esc(). */
function creditOf(title,license,attribution){
  const lic=typeof license==="string"?license.trim():"";
  const att=typeof attribution==="string"?attribution.trim().slice(0,2000):"";
  const l=lic.length<=64?lic:"";
  if(!l&&!att)return null;
  return {title:String(title||"").trim(),license:l,attribution:att};
}
```

2. In `mergeRules`, directly after the `if(Array.isArray(obj.requires)){…}` block:

```js
  const credit=creditOf(obj.name||src,obj.license,obj.attribution);
  if(credit){
    if(!rules.credits||typeof rules.credits!=="object"||Array.isArray(rules.credits))rules.credits={};
    rules.credits[src]=credit;
  }
```

3. `resetRules()`: add `credits:{}` after `requires:{}`.
4. `tidyRules()`: as its first statement, after `const dropped={};`:

```js
  if(rules.credits!=null&&(typeof rules.credits!=="object"||Array.isArray(rules.credits)))rules.credits={};
```

5. `poolFromExport()`: inside `if(isObj(saved)){…}`, after the `RULE_CATS.forEach(cat=>{…});` loop:

```js
      /* credits ride along per label, like `requires`, for the labels that came back */
      if(isObj(saved.credits))Object.keys(saved.credits).forEach(l=>{
        const c=saved.credits[l];
        if(!isObj(c)||!RULE_CATS.some(k=>(rules[k]||[]).some(e=>e._source===l)))return;
        const cr=creditOf(c.title||l,c.license,c.attribution);
        if(cr){if(!isObj(rules.credits))rules.credits={};rules.credits[l]=cr;}
      });
```

6. `importPack()` and `applyFetchedSource()`: `pruneRequires()` → `prunePackMeta()`.

- [ ] **Step 4: `src/js/88-settings.js`**

1. Replace `pruneRequires()` and its comment with:

```js
/* drop a source's `requires` and credits once none of its entries are left,
   so the persisted pool doesn't accumulate them for packs that are gone */
function prunePackMeta(){
  ["requires","credits"].forEach(k=>{
    const m=rules[k];if(!m||typeof m!=="object")return;
    Object.keys(m).forEach(src=>{if(!RULE_CATS.some(c=>(rules[c]||[]).some(e=>(e._source||"")===src)))delete m[src];});
  });
}
```

and in `removeRulesGroup()` change `pruneRequires();` to `prunePackMeta();`.

2. After `function rulesBadge(){…}`:

```js
/* Settings → Credits & licences: each loaded pack's own terms (#83). A pack
   carries them as `license` (an SPDX id) and `attribution` (plain text). */
const LICENSE_URLS={"CC-BY-4.0":"https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-3.0":"https://creativecommons.org/licenses/by-sa/3.0/","MIT":"https://opensource.org/license/mit"};
function rulesCreditsHTML(){
  const cr=(rules.credits&&typeof rules.credits==="object"&&!Array.isArray(rules.credits))?rules.credits:{};
  const str=v=>typeof v==="string"?v:"";
  const rows=Object.keys(cr).sort().map(l=>{
    const c=cr[l]&&typeof cr[l]==="object"?cr[l]:{};
    const lic=str(c.license),url=LICENSE_URLS[lic];
    const licHTML=lic?(url?` Licence: <a href="${esc(url)}" target="_blank" rel="noopener">${esc(lic)}</a>.`:` Licence: ${esc(lic)}.`):"";
    return `<p class="hint"><b>${esc(str(c.title)||l)}</b>${str(c.attribution)?" — "+esc(str(c.attribution)):""}${licHTML}</p>`;
  });
  return rows.length?`<div class="field"><label class="f">Rules data you have loaded</label>${rows.join("")}</div>`:"";
}
```

3. In `openSettings()`, in `secCredits`, insert `${rulesCreditsHTML()}` on its own line directly after the Icons `<div class="field">…</div>` and before the "Rules content" field. Each `<p>` stays on one source line (`.m-body p` is `white-space:pre-wrap`).

4. `grep -rn "pruneRequires" src/` must now find only `src/docs/wiki/architecture/rules-packs.md`: change both mentions there to `prunePackMeta()` (on its **Code:** line and in "How it works": "After a removal, `prunePackMeta()` drops a source's `requires` and credits once none of its entries remain").

- [ ] **Step 5: Run everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: `All 9 suites passed` (run.sh bundles first, so the Homebrew credit check runs).

- [ ] **Step 6: Commit**

```bash
git add src/js/89-rules-merge.js src/js/88-settings.js src/tests/data-archive.js src/docs/wiki/architecture/rules-packs.md
git commit -m "feat: each loaded pack's licence and credit in Settings → Credits & licences (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The archive — `fbdata.py pack`/`validate` and `build.sh`

**Files:**
- Modify: `tools/data-kit/fbdata.py` (imports, constants, `app_version`, `notice_md`, `_zinfo`, `cmd_pack`, `validate_archive`, `cmd_validate`, `main`), `build.sh`, `src/tests/data-kit.py`, `src/tests/data-archive.js`, `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1's registry functions; Task 4's `importRulesPayloads`; Task 3's `readDataArchive`.
- Produces: `fbdata.py pack <bundles> -o OUT [--registry F] [--dev] [--built-for V]` (exit 0/2), `fbdata.py validate ZIP` (exit 0/1); Python `validate_archive(path) -> [str]`, `notice_md(...)`; `build.sh --data`; build sets `ARCHIVE=dist/fieldbook-data-standalone-<release>[+dev].zip`; the app zip's `data/` holds exactly that archive.

- [ ] **Step 1: Write the failing Python tests**

In `src/tests/data-kit.py`, add `import zipfile` to the imports, then above `# ---- add new cases above this line ----`:

```python
# ---------- the archive: pack and validate (spec §6)
def bundles(d):
    """bundles in d/dist matching d's registry, the way bundle-rules.js stamps them"""
    for p in read_json(d, "data/packs.json")["packs"]:
        b = {"system": p["system"], "name": p["title"], "version": 1, "rulebook": True,
             "spells": [{"name": "S-" + p["system"]}]}
        if p.get("version"):
            b["dataVersion"] = p["version"]
        write(d, "dist/" + p["file"], b)


def pack(d, out, *extra):
    return subprocess.run([sys.executable, FBDATA, "pack", os.path.join(d, "dist"), "-o", out,
                           "--registry", os.path.join(d, "data", "packs.json"), "--built-for", "1.8.0"] + list(extra),
                          capture_output=True, text=True)


def validate(z):
    return subprocess.run([sys.executable, FBDATA, "validate", z], capture_output=True, text=True)


def rezip(src, dst, change=lambda n, b: b, add=()):
    """copy an archive, letting change(name, bytes) return new bytes or None to drop the entry"""
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for i in zin.infolist():
            data = change(i.filename, zin.read(i.filename))
            if data is not None:
                zout.writestr(i.filename, data)
        for name, data in add:
            zout.writestr(name, data)


d = scratch()
reg = read_json(d, "data/packs.json")
reg["packs"][1]["license"] = "CC-BY-SA-3.0"
reg["packs"][1]["attribution"] = "Beta, by its authors."
write(d, "data/packs.json", reg)
bundles(d)
z1, z2 = os.path.join(d, "one.zip"), os.path.join(d, "two.zip")
r = pack(d, z1)
pack(d, z2)
ck("pack writes the archive", r.returncode == 0 and os.path.isfile(z1), r.stderr)
with open(z1, "rb") as f1, open(z2, "rb") as f2:
    ck("pack is reproducible: two runs, identical bytes", f1.read() == f2.read())
with zipfile.ZipFile(z1) as z:
    infos = z.infolist()
    man = json.loads(z.read("fieldbook-data.json"))
    notice = z.read("NOTICE.md").decode("utf-8")
ck("entries are sorted by name",
   [i.filename for i in infos] == sorted(["NOTICE.md", "alpha_full.json", "beta_full.json", "fieldbook-data.json"]),
   [i.filename for i in infos])
ck("every entry is deflated and dated 1980-01-01",
   all(i.compress_type == zipfile.ZIP_DEFLATED and i.date_time == (1980, 1, 1, 0, 0, 0) for i in infos))
ck("the manifest names the release and the app",
   man["_type"] == "fieldbook-data" and man["format"] == 1 and man["version"] == "1.8.0" and man["builtFor"] == "1.8.0", man)
ck("each manifest pack has file, system, version and sha256",
   [(m["file"], m["system"], m.get("version")) for m in man["packs"]] == [("alpha_full.json", "Alpha", "1.8.0"), ("beta_full.json", "Beta", "1.7.0")]
   and all(len(m["sha256"]) == 64 for m in man["packs"]), man["packs"])
ck("the manifest has no top-level name, system or category keys", not ({"name", "system", "spells", "races"} & set(man)), list(man))
ck("NOTICE.md carries the licensed pack's credit and licence", "Beta, by its authors." in notice and "Licence: CC-BY-SA-3.0." in notice, notice)
ck("NOTICE.md says when a pack states no licence", "No licence statement." in notice, notice)
r = validate(z1)
ck("validate passes a fresh archive", r.returncode == 0, r.stderr)
pack(d, z2, "--dev")
with zipfile.ZipFile(z2) as z:
    ck("--dev names the version <release>+dev", json.loads(z.read("fieldbook-data.json"))["version"] == "1.8.0+dev")
ck("validate accepts +dev", validate(z2).returncode == 0, validate(z2).stderr)

bad = os.path.join(d, "bad.zip")
CASES = {
    "an extra file": dict(add=[("extra.json", "{}")]),
    "a missing pack": dict(change=lambda n, b: None if n == "beta_full.json" else b),
    "a changed pack (sha256)": dict(change=lambda n, b: b.replace(b"S-Beta", b"S-Bet4") if n == "beta_full.json" else b),
    "a system mismatch": dict(change=lambda n, b: b.replace(b'"Alpha"', b'"Other"') if n == "fieldbook-data.json" else b),
    "a path that escapes": dict(add=[("../evil.json", "{}")]),
    "a directory entry": dict(add=[("folder/", "")]),
    "no manifest": dict(change=lambda n, b: None if n == "fieldbook-data.json" else b),
}
for label, kw in CASES.items():
    rezip(z1, bad, **kw)
    r = validate(bad)
    ck("validate refuses %s" % label, r.returncode == 1 and r.stderr.strip() != "", (r.returncode, r.stderr))

write(d, "dist/alpha_full.json", {"system": "Wrong", "dataVersion": "1.8.0"})
r = pack(d, os.path.join(d, "x.zip"))
ck("pack refuses a bundle whose system disagrees with the registry", r.returncode == 2 and "Wrong" in r.stderr, r.stderr)
write(d, "dist/alpha_full.json", {"system": "Alpha", "dataVersion": "1.7.9"})
r = pack(d, os.path.join(d, "x.zip"))
ck("pack refuses a stale bundle", r.returncode == 2 and "rebuild" in r.stderr, r.stderr)
shutil.rmtree(d)
```

- [ ] **Step 2: Run them to verify they fail**

Run: `python3 src/tests/data-kit.py`
Expected: FAIL lines from "pack writes the archive" on (`invalid choice: 'pack'`).

- [ ] **Step 3: Add `pack` and `validate` to `tools/data-kit/fbdata.py`**

1. Docstring usage: add the lines
   `    fbdata.py pack <bundles-dir> -o OUT.zip [--registry F] [--dev] [--built-for X.Y.Z]`
   `    fbdata.py validate OUT.zip`
   and change "§4, §5.1" to "§4–§6".
2. Imports: add `import zipfile`.
3. After `PACK_KEYS`:

```python
MANIFEST = "fieldbook-data.json"
NOTICE = "NOTICE.md"
FIXED_TIME = (1980, 1, 1, 0, 0, 0)  # the earliest a zip can say: no build time leaks in
```

4. After `cmd_versions`:

```python
def app_version():
    """APP_VERSION from src/js/30-version.js, or "" when the kit runs outside the repo."""
    try:
        with open(os.path.join(ROOT, "src", "js", "30-version.js"), encoding="utf-8") as f:
            m = re.search(r'APP_VERSION="([^"]+)"', f.read())
        return m.group(1) if m else ""
    except OSError:
        return ""


def notice_md(reg, mpacks, version, built_for):
    """The archive's NOTICE.md: what is in it, and every pack's licence and credit."""
    by_file = {p["file"]: p for p in reg["packs"]}
    out = ["# Fieldbook rules data %s" % version, ""]
    if built_for:
        out += ["Built for Fieldbook %s." % built_for, ""]
    out += ["Fieldbook 1.8.0 and later open this zip directly: Settings → Rules data → Import files,",
            "then choose it. Older versions: unzip it and import the .json files.", "",
            "## Packs", ""]
    for m in mpacks:
        p = by_file[m["file"]]
        out.append("- %s — `%s` (%s%s)" % (p["title"], m["file"], m["system"],
                                         ", v" + m["version"] if m.get("version") else ""))
    out += ["", "## Licences and credits", ""]
    for m in mpacks:
        p = by_file[m["file"]]
        out += ["### " + p["title"], ""]
        if p.get("attribution"):
            out += [p["attribution"], ""]
        if p.get("license"):
            out += ["Licence: %s." % p["license"], ""]
        if not p.get("attribution") and not p.get("license"):
            out += ["No licence statement.", ""]
    return "\n".join(out).rstrip("\n") + "\n"


def _zinfo(name):
    zi = zipfile.ZipInfo(name, date_time=FIXED_TIME)
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.create_system = 3
    zi.external_attr = 0o100644 << 16
    return zi


def cmd_pack(a):
    """The archive (spec §6): every registered bundle found in a.bundles, a
    manifest and NOTICE.md; entries sorted, fixed timestamps, deflate level 9,
    so two runs with one zlib write the same bytes."""
    reg = load_registry(a.registry)
    if not reg.get("release"):
        raise KitError("the registry has no release to name the archive")
    version = reg["release"] + ("+dev" if a.dev else "")
    built_for = a.built_for if a.built_for is not None else app_version()
    entries, mpacks = {}, []
    for p in reg["packs"]:
        src = os.path.join(a.bundles, p["file"])
        if not os.path.isfile(src):
            continue
        with open(src, "rb") as f:
            raw = f.read()
        try:
            obj = json.loads(raw.decode("utf-8"))
        except ValueError as e:
            raise KitError("%s: not valid JSON — %s" % (src, e))
        got = obj.get("system") if isinstance(obj, dict) else None
        if got != p["system"]:
            raise KitError("%s: system %r, but the registry says %r" % (src, got, p["system"]))
        if obj.get("dataVersion") != p.get("version"):
            raise KitError("%s: dataVersion %r, but the registry says %r — rebuild the bundles"
                           % (src, obj.get("dataVersion"), p.get("version")))
        m = {"file": p["file"], "system": p["system"]}
        if p.get("version"):
            m["version"] = p["version"]
        if p.get("license"):
            m["license"] = p["license"]
        m["sha256"] = hashlib.sha256(raw).hexdigest()
        mpacks.append(m)
        entries[p["file"]] = raw
    if not mpacks:
        raise KitError("none of the registry's bundles is in %s — bundle first" % a.bundles)
    manifest = {"_type": "fieldbook-data", "format": 1, "version": version, "builtFor": built_for, "packs": mpacks}
    entries[MANIFEST] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    entries[NOTICE] = notice_md(reg, mpacks, version, built_for).encode("utf-8")
    tmp = a.output + ".tmp"
    with zipfile.ZipFile(tmp, "w") as z:
        for name in sorted(entries):
            z.writestr(_zinfo(name), entries[name], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    os.replace(tmp, a.output)
    print("wrote %s (%d pack%s, data %s)" % (a.output, len(mpacks), "" if len(mpacks) == 1 else "s", version),
          file=sys.stderr)
    return 0


def validate_archive(path):
    """Problems with an archive (spec §6.3), one line each; [] when it is sound."""
    try:
        z = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as e:
        return ["not a readable zip: %s" % e]
    errs = []
    with z:
        names = [i.filename for i in z.infolist()]
        if len(set(names)) != len(names):
            errs.append("an entry name appears twice")
        for n in names:
            if n.endswith("/"):
                errs.append("a directory entry: %s" % n)
            if n.startswith("/") or "\\" in n or ".." in n.split("/"):
                errs.append("an unsafe path: %s" % n)
        if MANIFEST not in names:
            return errs + ["no %s at the root" % MANIFEST]
        try:
            man = json.loads(z.read(MANIFEST).decode("utf-8"))
        except (ValueError, zipfile.BadZipFile) as e:
            return errs + ["%s is unreadable: %s" % (MANIFEST, e)]
        if not isinstance(man, dict) or man.get("_type") != "fieldbook-data" or man.get("format") != 1:
            return errs + ['%s: _type must be "fieldbook-data" and format 1' % MANIFEST]
        ver = man.get("version")
        if not (isinstance(ver, str) and parse_data_ver(ver[:-4] if ver.endswith("+dev") else ver)):
            errs.append("%s: version %r" % (MANIFEST, ver))
        packs = man.get("packs")
        if not isinstance(packs, list) or not packs:
            return errs + ["%s: packs must be a non-empty list" % MANIFEST]
        listed = set()
        for i, m in enumerate(packs):
            f = m.get("file") if isinstance(m, dict) else None
            if not isinstance(f, str):
                errs.append("packs[%d] names no file" % i)
                continue
            listed.add(f)
            if f not in names:
                errs.append("%s is listed but missing" % f)
                continue
            try:
                raw = z.read(f)
            except zipfile.BadZipFile as e:
                errs.append("%s: %s" % (f, e))
                continue
            if hashlib.sha256(raw).hexdigest() != m.get("sha256"):
                errs.append("%s: its sha256 doesn't match the manifest" % f)
            try:
                obj = json.loads(raw.decode("utf-8"))
            except ValueError:
                errs.append("%s: not valid JSON" % f)
                continue
            if not isinstance(obj, dict):
                errs.append("%s: not a JSON object" % f)
                continue
            if obj.get("system") != m.get("system"):
                errs.append("%s: system %r, the manifest says %r" % (f, obj.get("system"), m.get("system")))
            if obj.get("dataVersion") != m.get("version"):
                errs.append("%s: dataVersion %r, the manifest says %r" % (f, obj.get("dataVersion"), m.get("version")))
        extra = [n for n in names if n not in listed and n not in (MANIFEST, NOTICE)]
        if extra:
            errs.append("not in the manifest: " + ", ".join(extra))
    return errs


def cmd_validate(a):
    errs = validate_archive(a.zip)
    for e in errs:
        print("%s: %s" % (a.zip, e), file=sys.stderr)
    if errs:
        return 1
    print("ok: %s" % a.zip)
    return 0
```

5. In `main()`, before `a = ap.parse_args(argv)`:

```python
    p = sub.add_parser("pack", help="write the data archive from bundled packs")
    p.add_argument("bundles", help="the folder holding the bundles (dist/)")
    p.add_argument("-o", "--output", required=True, help="the .zip to write")
    p.add_argument("--registry", default=DEFAULT_REGISTRY, help="default: data/packs.json")
    p.add_argument("--dev", action="store_true", help='version the archive "<release>+dev"')
    p.add_argument("--built-for", default=None, help="the app version it is for (default: APP_VERSION)")
    p.set_defaults(fn=cmd_pack)
    p = sub.add_parser("validate", help="check an archive; exit 1 with one line per problem")
    p.add_argument("zip")
    p.set_defaults(fn=cmd_validate)
```

Run: `python3 src/tests/data-kit.py`
Expected: `ALL PASSED (n)`.

- [ ] **Step 4: Add the Node round-trip and other-producer tests**

These exercise Tasks 3–5's code against real producers, so they should pass at once; a failure is a bug in `89-zip.js` or the importer, not in the test. In `src/tests/data-archive.js`, above the marker line:

```js
section('round trip: the built archive imports exactly like the bundles', () => {
  if (!PY) { console.log('note: no python3, round trip skipped'); return; }
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/packs.json'), 'utf8'));
  const present = reg.packs.filter(p => fs.existsSync(path.join(ROOT, 'dist', p.file)));
  ck('the bundles exist (run.sh bundles first)', present.length > 0);
  const dir = tmpDir(), zip = path.join(dir, 'a.zip');
  const r = spawnSync(PY, [path.join(ROOT, 'tools/data-kit/fbdata.py'), 'pack', path.join(ROOT, 'dist'), '-o', zip], {encoding: 'utf8'});
  ck('fbdata.py pack ran', r.status === 0, r.stderr);
  if (r.status === 0) {
    X.resetRules();
    const res = X.importRulesPayloads([{name: 'a.zip', bytes: new Uint8Array(fs.readFileSync(zip))}]);
    ck('the archive imported every pack', res.failed.length === 0 && res.archives[0].count === present.length, res);
    const viaZip = poolSnap();
    X.resetRules();
    present.forEach(p => X.importRulesPayloads([{name: p.file, bytes: new Uint8Array(fs.readFileSync(path.join(ROOT, 'dist', p.file)))}]));
    ck('the pool equals importing the bundles one by one', poolSnap() === viaZip);
  }
  fs.rmSync(dir, {recursive: true, force: true});
  X.resetRules();
});

section('zips from other tools', () => {
  if (!PY) console.log('note: no python3, Python zipfile cases skipped');
  else {
    const dir = tmpDir();
    const script = [
      'import json, sys, zipfile',
      'out, method = sys.argv[1], int(sys.argv[2])',
      'with zipfile.ZipFile(out, "w", compression=method) as z:',
      '    z.writestr("packs/a.json", json.dumps({"system": "Py", "spells": [{"name": "Alpha"}]}))',
      '    z.writestr("packs/b.json", json.dumps({"system": "Py", "feats": [{"name": "Beta"}]}))',
    ].join('\n');
    [[0, 'stored'], [8, 'deflated']].forEach(([m, label]) => {
      const out = path.join(dir, label + '.zip');
      const r = spawnSync(PY, ['-c', script, out, String(m)], {encoding: 'utf8'});
      const arc = r.status === 0 ? X.readDataArchive(new Uint8Array(fs.readFileSync(out)), label + '.zip') : null;
      ck('Python zipfile, ' + label + ': read as loose packs',
         !!arc && arc.kind === 'loose' && arc.packs.map(p => p.name).join() === 'a.json,b.json', r.stderr || arc);
    });
    fs.rmSync(dir, {recursive: true, force: true});
  }
  if (spawnSync('zip', ['-v'], {stdio: 'ignore'}).status !== 0) { console.log('note: no zip tool, the zip -9 case skipped'); return; }
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'in'));
  const body = JSON.stringify({system: 'Zip', spells: Array.from({length: 2000}, (_, i) => ({name: 'Spell ' + i, text: 'Lorem ipsum '.repeat(20)}))});
  fs.writeFileSync(path.join(dir, 'in', 'big.json'), body);
  const r = spawnSync('zip', ['-9', '-q', '-r', 'z.zip', 'in'], {cwd: dir});
  const arc = r.status === 0 ? X.readDataArchive(new Uint8Array(fs.readFileSync(path.join(dir, 'z.zip'))), 'z.zip') : null;
  ck('zip -9: the deflated entry inflates byte for byte', !!arc && Buffer.from(arc.packs[0].bytes).toString('utf8') === body);
  fs.rmSync(dir, {recursive: true, force: true});
});
```

Run: `./build.sh --no-zip && ./src/tests/run.sh data-archive`
Expected: `data-archive` passes.

- [ ] **Step 5: Rewrite `build.sh` for the archive**

1. Replace the header comment (lines 2–18) with:

```bash
# Fieldbook build: concatenate src/ into dist/fieldbook.html, validate everything,
# regenerate docs/CHANGELOG.md from the in-app CHANGELOG array, and produce
# dist/fieldbook-data-standalone-<release>.zip and dist/fieldbook-v<version>.zip.
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
# The zips need python3 (tools/data-kit/fbdata.py writes the data archive);
# --no-zip does not.
#
# Releasing is a separate, deliberate act: it folds the pending notes from
# src/docs/UNRELEASED.md into a new CHANGELOG entry and bumps APP_VERSION.
# A bare build has to be safe to run constantly, so it must not touch either.
#
# Build with unreleased notes pending and the app zip is marked "+dev"; build
# with rules data changed since data/packs.json's release and the archive is.
# Their contents are NOT the version their names would otherwise claim.
```

and change the help line to `-h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;`.

2. Options: add `DATAONLY=""` beside `NOZIP=""`, the case arm `--data) DATAONLY=1; shift ;;`, and directly after the `while … done` loop:

```bash
# Checked before anything runs: --release would otherwise cut a release first.
if [ -n "$DATAONLY" ] && { [ -n "$RELEASE" ] || [ -n "$NOZIP" ]; }; then
  echo "--data builds only the rules-data archive; it doesn't mix with --release or --no-zip."
  echo "A data release is cut with: node scripts/data-release.js"
  exit 1
fi
```

3. After the `finish(){…}` function:

```bash
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
  node scripts/bundle-rules.js || { echo "    bundling failed"; exit 1; }
}

# The rules-data archive (spec 2026-10-07-data-archive-design.md §6), named for
# data/packs.json's release — "+dev" when some pack's content has changed since
# then, because that zip is NOT that release's data. Validated before it can
# ship; one that fails is deleted. Sets ARCHIVE.
pack_archive() {
  local py rel suf="" rc=0
  py=$(find_python) || { echo "    the zips need python3 (tools/data-kit/fbdata.py); use --no-zip for just the app"; exit 1; }
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
```

4. Directly after the `if [ -n "$RELEASE" ]; then … fi` block and before `echo "==> Building dist/fieldbook.html from src/"`:

```bash
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
```

5. Replace the inline `echo "==> Validating data/**/*.json"` … `echo "    ok (…)"` block with `validate_data`, and the comment plus `echo "==> Bundling rules packs"` / `node scripts/bundle-rules.js || …` lines with `bundle_packs`.
6. After `rm -f dist/*.zip` (the "Clear every old zip" block), add `pack_archive` on its own line.
7. In the app-zip block, replace the comment and `cp dist/5e2024_full.json … .buildtmp/data/` with:

```bash
# The rules data travels as its archive, which Fieldbook opens as it is — and
# opens inside this zip too. The per-category files remain in the repo.
cp "$ARCHIVE" .buildtmp/data/
```

8. In the allowlist guard (the `node - "$BUNDLE" <<'NODE'` block), replace the three lines from `// data/ must hold ONLY the bundled packs` through `if(strays.length)banned.push(...strays);` with:

```js
// data/ must hold ONLY the rules-data archive — anything else means the zip
// stopped matching what README section 9 promises.
const dataFiles=names.filter(n=>/^data\/.+/.test(n));
const strays=dataFiles.filter(n=>!/^data\/fieldbook-data-standalone-[^/]+\.zip$/.test(n));
if(strays.length)banned.push(...strays);
if(dataFiles.length>1)banned.push("(data/ holds more than one archive)");
```

and change `"(no rules packs in data/ — bundling did not run)"` to `"(no rules-data archive in data/)"`.

9. `CLAUDE.md`, the "Building to test is fine" bullet: after "`./build.sh --no-zip` for just the artifact" add "(the zips need `python3`; `./build.sh --data` builds only the rules-data archive)".

- [ ] **Step 6: Drive the build**

```bash
bash -n build.sh
./build.sh --help | head -3
SUM=$(mktemp)
shasum dist/fieldbook.html > "$SUM"
./build.sh --data
shasum -c "$SUM"
unzip -l dist/fieldbook-data-standalone-*.zip
./build.sh --data --no-zip; echo "exit $?"
./build.sh
unzip -l dist/fieldbook-v*.zip | grep data/
```

Expected:
- `--help` prints the new header.
- `./build.sh --data` names `dist/fieldbook-data-standalone-1.7.2+dev.zip` (XPHB, XGE and Homebrew changed since their recorded digests), validates it, and `shasum -c` says `OK`: `dist/fieldbook.html` untouched.
- The archive lists `NOTICE.md`, the five `*_full.json` and `fieldbook-data.json`.
- `--data --no-zip` exits 1 with the "doesn't mix" message. **Never try `--data --release`.**
- The full build ends "bundle is player-facing only", and the app zip's `data/` holds exactly the one archive.

- [ ] **Step 7: Run everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: `All 9 suites passed`.

- [ ] **Step 8: Commit**

```bash
git add tools/data-kit/fbdata.py build.sh src/tests/data-kit.py src/tests/data-archive.js CLAUDE.md
git commit -m "feat: the rules-data archive — fbdata.py pack/validate, build.sh --data, the app zip carries it (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Data releases — `data-release.js`, the release notes, both workflows, `dev.sh`

**Files:**
- Create: `scripts/data-release.js`, `scripts/data-release-notes.js`, `.github/workflows/data-release.yml`
- Modify: `.github/workflows/release.yml`, `dev.sh`, `src/tests/data-kit.py`

**Interfaces:**
- Consumes: `fbdata.py versions --changed|--bump` (Task 1); `build.sh --data` and `fbdata.py validate` (Task 6).
- Produces: `node scripts/data-release.js [--dry-run]` (exit 0, or 1 with `data-release: <why>`); `node scripts/data-release-notes.js <version> --app|--data` (markdown on stdout; exit 1 on bad arguments); the `data-release.yml` workflow; dev.sh menu `d` and a `data …` status field.

- [ ] **Step 1: Write the failing tests**

In `src/tests/data-kit.py`, above `# ---- add new cases above this line ----`:

```python
# ---------- the release scripts, in a scratch git checkout (never this one)
def git(d, *args):
    return subprocess.run(["git", "-C", d, "-c", "user.name=t", "-c", "user.email=t@example.com"] + list(args),
                          capture_output=True, text=True)


def node(d, *args):
    return subprocess.run(["node"] + list(args), cwd=d, capture_output=True, text=True)


def checkout(app="1.8.0", release="1.8.0"):
    """a scratch repo laid out like this one: the scripts, the kit, 30-version.js,
    the notebook and data/, digests seeded, everything committed"""
    d = scratch()
    for rel in ("scripts/data-release.js", "scripts/data-release-notes.js", "scripts/release.js", "tools/data-kit/fbdata.py"):
        os.makedirs(os.path.dirname(os.path.join(d, rel)), exist_ok=True)
        shutil.copy(os.path.join(ROOT, rel), os.path.join(d, rel))
    write(d, "src/js/30-version.js", raw='const APP_VERSION="%s";\nconst DATA_VERSIONS={"Alpha":"1.8.0","Beta":"1.7.0"};\n'
                                        'const CHANGELOG=[\n  {v:"%s", date:"2026-10-07", notes:["x"]}\n];\n' % (app, app))
    write(d, "src/docs/UNRELEASED.md", raw="# Notebook\n\n## Pending\n\n- A change a player can see.\n")
    reg = read_json(d, "data/packs.json")
    reg["release"] = release
    write(d, "data/packs.json", reg)
    subprocess.run([sys.executable, os.path.join(d, "tools/data-kit/fbdata.py"), "versions", "--seed"], capture_output=True)
    git(d, "init", "-q")
    git(d, "add", "-A")
    git(d, "commit", "-qm", "start")
    return d


d = checkout()
r = node(d, "scripts/data-release.js")
ck("data-release refuses when nothing changed", r.returncode == 1 and "nothing to release" in r.stderr, r.stderr)
write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 5}]})
r = node(d, "scripts/data-release.js")
ck("data-release refuses uncommitted data", r.returncode == 1 and "uncommitted" in r.stderr, r.stderr)
git(d, "commit", "-qam", "change alpha")
before = read_json(d, "data/packs.json")
r = node(d, "scripts/data-release.js", "--dry-run")
ck("--dry-run names the release and the pack, and writes nothing",
   r.returncode == 0 and "1.8.0-1" in r.stdout and "Alpha" in r.stdout and read_json(d, "data/packs.json") == before,
   (r.stdout, r.stderr))
r = node(d, "scripts/data-release.js")
reg = read_json(d, "data/packs.json")
ck("a data release bumps only the changed pack to 1.8.0-1",
   r.returncode == 0 and reg["release"] == "1.8.0-1" and reg["packs"][0]["version"] == "1.8.0-1"
   and reg["packs"][1]["version"] == "1.7.0", (reg, r.stderr))
ck("...prints the commands, and runs none of them",
   "git tag -a data-v1.8.0-1" in r.stdout and git(d, "tag", "-l").stdout.strip() == "", r.stdout)
with open(os.path.join(d, "src/js/30-version.js"), encoding="utf-8") as f:
    v = f.read()
ck("...and never touches 30-version.js", 'APP_VERSION="1.8.0"' in v and '"Alpha":"1.8.0"' in v, v[:200])
git(d, "commit", "-qam", "Data release 1.8.0-1")
write(d, "data/beta/feats.json", {"system": "Beta", "feats": [{"name": "Tougher"}]})
git(d, "commit", "-qam", "change beta")
git(d, "tag", "data-v1.8.0-2")
r = node(d, "scripts/data-release.js")
ck("data-release refuses a tag that already exists", r.returncode == 1 and "already exists" in r.stderr, r.stderr)
git(d, "tag", "-d", "data-v1.8.0-2")
r = node(d, "scripts/data-release.js")
ck("the one after 1.8.0-1 is 1.8.0-2", r.returncode == 0 and read_json(d, "data/packs.json")["release"] == "1.8.0-2", r.stderr)
shutil.rmtree(d)

d = checkout(release="1.7.2")
write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 5}]})
git(d, "commit", "-qam", "change")
r = node(d, "scripts/data-release.js")
ck("data-release refuses a release that belongs to another app version", r.returncode == 1 and "doesn't belong" in r.stderr, r.stderr)
shutil.rmtree(d)

d = checkout()
write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 6}]})
r = node(d, "scripts/release.js", "1.9.0")
reg = read_json(d, "data/packs.json")
with open(os.path.join(d, "src/js/30-version.js"), encoding="utf-8") as f:
    v = f.read()
ck("release.js bumps the changed pack to the new app version",
   r.returncode == 0 and reg["release"] == "1.9.0" and reg["packs"][0]["version"] == "1.9.0" and reg["packs"][1]["version"] == "1.7.0",
   (r.stderr, reg))
ck("...snapshots DATA_VERSIONS from the registry", 'const DATA_VERSIONS={"Alpha":"1.9.0","Beta":"1.7.0"}' in v, v[:200])
ck("...and still bumps APP_VERSION", 'APP_VERSION="1.9.0"' in v)
shutil.rmtree(d)

d = checkout()
reg = read_json(d, "data/packs.json")
reg["release"] = "1.8.0-1"
reg["packs"][0]["version"] = "1.8.0-1"
write(d, "data/packs.json", reg)
r = node(d, "scripts/data-release-notes.js", "1.8.0-1", "--data")
ck("data notes: for this app and later, what changed, how to import, and the older-app fallback",
   r.returncode == 0 and "Rules data 1.8.0-1, for Fieldbook 1.8.0 and later" in r.stdout and "Alpha (v1.8.0-1)" in r.stdout
   and "fieldbook-data-standalone-1.8.0-1.zip" in r.stdout and "unzip it" in r.stdout, r.stdout)
r = node(d, "scripts/data-release-notes.js", "1.8.0-1", "--app")
ck("app notes: the archive to download, and what changed",
   r.returncode == 0 and "fieldbook-data-standalone-1.8.0-1.zip" in r.stdout and "Changed in this release: Alpha (v1.8.0-1)" in r.stdout,
   r.stdout)
r = node(d, "scripts/data-release-notes.js", "1.9.0", "--app")
ck("app notes when no pack changed say only the app is needed", "has not changed" in r.stdout, r.stdout)
ck("bad arguments exit 1", node(d, "scripts/data-release-notes.js", "1.9", "--app").returncode == 1)
shutil.rmtree(d)
```

Run: `python3 src/tests/data-kit.py`
Expected: FAIL lines from "data-release refuses when nothing changed" on (the scripts don't exist; `shutil.copy` raises — if it stops the run, that is the failure).

- [ ] **Step 2: Write `scripts/data-release.js`**

```js
#!/usr/bin/env node
/*
 * Cut a DATA release (#83): give each rules pack whose content changed since its
 * last release the version <APP_VERSION>-N in data/packs.json, and print the
 * commands that publish it. Spec: src/docs/specs/2026-10-07-data-archive-design.md §5.4.
 *
 *   node scripts/data-release.js            bump data/packs.json
 *   node scripts/data-release.js --dry-run  say what it would do; write nothing
 *
 * Never touches fieldbook.html, APP_VERSION, DATA_VERSIONS, the CHANGELOG or the
 * notebook: a data release ships no app. Never commits, tags or pushes — the
 * tag is what publishes (.github/workflows/data-release.yml), and that stays a
 * human step.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const FBDATA = path.join(ROOT, "tools/data-kit/fbdata.py");
const DRY = process.argv.includes("--dry-run");

function die(msg) {
  console.error("data-release: " + msg);
  process.exit(1);
}
function findPython() {
  for (const py of ["python3", "python"]) {
    if (spawnSync(py, ["-c", ""], { stdio: "ignore" }).status === 0) return py;
  }
  return null;
}
const PY = findPython();
if (!PY) die("needs python3 (tools/data-kit/fbdata.py)");
function fbdata(args) {
  const r = spawnSync(PY, [FBDATA, ...args], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) die("fbdata.py " + args.join(" ") + " failed:\n" + (r.stderr || r.stdout));
  return r.stdout;
}

const src = fs.readFileSync(path.join(ROOT, "src/js/30-version.js"), "utf8");
const app = (/APP_VERSION\s*=\s*"([^"]+)"/.exec(src) || [])[1] || "";
if (!/^\d+\.\d+\.\d+$/.test(app)) die(`APP_VERSION "${app}" is not X.Y.Z`);

// The digests recorded below must describe what gets committed and tagged.
const dirty = spawnSync("git", ["-C", ROOT, "status", "--porcelain", "--", "data"], { encoding: "utf8" });
if (dirty.status !== 0) die("git status failed — is this a git checkout?");
if (dirty.stdout.trim()) die("data/ has uncommitted changes — commit them first:\n" + dirty.stdout);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "data/packs.json"), "utf8"));
const rel = String(reg.release || "");
let next;
if (rel === app) next = app + "-1";
else {
  const m = /^(\d+\.\d+\.\d+)-([1-9]\d*)$/.exec(rel);
  if (!m || m[1] !== app) die(`data/packs.json's release ${rel || "(none)"} doesn't belong to APP_VERSION ${app}`);
  next = app + "-" + (Number(m[2]) + 1);
}
const tag = "data-v" + next;
if (spawnSync("git", ["-C", ROOT, "rev-parse", "-q", "--verify", "refs/tags/" + tag]).status === 0)
  die(`tag ${tag} already exists`);

const changed = fbdata(["versions", "--changed"]).split("\n").map((s) => s.trim()).filter(Boolean);
if (!changed.length) die("nothing to release — no pack's content differs from its last release");

console.log(`data release ${next}: ${changed.join(", ")} change${changed.length === 1 ? "s" : ""}`);
if (DRY) {
  console.log("(dry run — nothing written)");
  process.exit(0);
}
fbdata(["versions", "--bump", next]);
console.log(`\nwrote data/packs.json. PUBLISH data ${next} — nothing is public until you do this:\n`);
console.log("    git add data/packs.json");
console.log(`    git commit -m "Data release ${next}"`);
console.log(`    git tag -a ${tag} -m "Fieldbook data ${next}"`);
console.log(`    git push && git push origin ${tag}`);
```

- [ ] **Step 3: Write `scripts/data-release-notes.js`**

```js
#!/usr/bin/env node
/*
 * The rules-data part of a GitHub release body (#83), from data/packs.json.
 *
 *   node scripts/data-release-notes.js <version> --app    footer for an app release
 *   node scripts/data-release-notes.js <version> --data   the body of a data release
 *
 * A pack changed in this release when its version IS this release's version:
 * release.js and data-release.js give exactly the changed packs that version.
 * Spec: src/docs/specs/2026-10-07-data-archive-design.md §5.5.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const [ver, mode] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(-[1-9]\d*)?$/.test(ver || "") || (mode !== "--app" && mode !== "--data")) {
  console.error("usage: data-release-notes.js <X.Y.Z or X.Y.Z-N> --app|--data");
  process.exit(1);
}
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "data/packs.json"), "utf8"));
const zip = `fieldbook-data-standalone-${ver}.zip`;
const changed = reg.packs.filter((p) => p.version === ver);
const same = reg.packs.filter((p) => p.version && p.version !== ver);
const list = (ps) => ps.map((p) => `${p.title} (v${p.version})`).join(", ");
const older = "Fieldbook older than 1.8.0 can't open a zip: unzip it and import the `.json` files instead.";
const out = [];
if (mode === "--app") {
  out.push("", "---", "",
    "**Just want the app?** Download `fieldbook.html` and open it — that is the whole thing.", "",
    `**Rules data:** \`${zip}\`. In Fieldbook, open Settings → Rules data → Import files and choose the zip.`);
  if (changed.length) {
    out.push("", `Changed in this release: ${list(changed)}.` +
      (same.length ? ` Unchanged: ${list(same)} — if you already have those loaded, there's no need to re-import them.` : ""));
  } else {
    out.push("", "**The rules data has not changed** — if you already have it loaded, you only need `fieldbook.html`.");
  }
  out.push("", older);
} else {
  const base = ver.replace(/-\d+$/, "");
  out.push(`Rules data ${ver}, for Fieldbook ${base} and later. There is no app update in this release.`, "");
  out.push(changed.length ? `**Changed:** ${list(changed)}.` : "**Changed:** nothing.");
  if (same.length) out.push("", `Unchanged: ${list(same)}.`);
  out.push("", `**To update:** download \`${zip}\`, then in Fieldbook open Settings → Rules data → Import files and choose it. ` +
    "Re-importing replaces each pack completely.", "", older);
}
process.stdout.write(out.join("\n") + "\n");
```

Run: `python3 src/tests/data-kit.py`
Expected: `ALL PASSED (n)`.

- [ ] **Step 4: `.github/workflows/release.yml`**

1. In the header comment, after "anything it cannot independently reproduce from source.", add:

```yaml
#
# Assets: fieldbook.html, the app zip, and the rules-data archive
# fieldbook-data-standalone-X.Y.Z.zip. Data-only releases are data-release.yml.
```

2. After the "Verify the tag matches APP_VERSION" step, add:

```yaml
      # release.js records every pack's version in data/packs.json and sets its
      # release to the app version (#83). A tag cut without it would publish an
      # archive named for the previous release.
      - name: Verify data/packs.json is released at this tag
        run: |
          REL=$(node -e 'process.stdout.write(String(require("./data/packs.json").release||""))')
          echo "tag=${{ steps.tag.outputs.version }}  data/packs.json release=$REL"
          if [ "$REL" != "${{ steps.tag.outputs.version }}" ]; then
            echo "::error::data/packs.json's release is $REL, not ${{ steps.tag.outputs.version }}."
            echo "::error::Cut the release with ./build.sh --release <level>, which records the data versions."
            exit 1
          fi
```

3. The "Build" step becomes:

```yaml
      # Build, validate and zip exactly as a local run would. The zips need
      # python3 (tools/data-kit/fbdata.py): the runner's own, named in the log.
      - name: Build
        run: |
          python3 --version
          ./build.sh
```

4. Replace the whole "Collect release notes" step (the `id: notes` one with the `git diff` block) with:

```yaml
      - name: Collect release notes
        run: |
          V="${{ steps.tag.outputs.version }}"
          node scripts/release-notes.js "$V" > /tmp/notes.md
          # What to download, and which rules packs changed — from data/packs.json,
          # where release.js recorded each pack's version (#83).
          node scripts/data-release-notes.js "$V" --app >> /tmp/notes.md
          echo "Release body:"; cat /tmp/notes.md
```

5. "Check the assets exist":

```yaml
      - name: Check the assets exist
        run: |
          V="${{ steps.tag.outputs.version }}"
          for f in dist/fieldbook.html "dist/fieldbook-v$V.zip" "dist/fieldbook-data-standalone-$V.zip"; do
            [ -s "$f" ] || { echo "::error::missing or empty asset: $f"; exit 1; }
            printf '  %-46s %s\n' "$f" "$(du -h "$f" | cut -f1)"
          done
```

6. In "Publish", the `ASSETS` array becomes:

```bash
          ASSETS=(dist/fieldbook.html
                  "dist/fieldbook-v$V.zip"
                  "dist/fieldbook-data-standalone-$V.zip")
```

- [ ] **Step 5: Create `.github/workflows/data-release.yml`**

```yaml
name: Data release

# Publishes a DATA-only release (#83): rules data with no app change. Triggered
# by pushing an annotated tag that scripts/data-release.js prepared:
#
#   node scripts/data-release.js       # bumps data/packs.json to X.Y.Z-N
#   git add data/packs.json && git commit -m "Data release X.Y.Z-N"
#   git tag -a data-vX.Y.Z-N -m "Fieldbook data X.Y.Z-N"
#   git push && git push origin data-vX.Y.Z-N
#
# A data release is NEVER GitHub's "latest". Every installed copy of Fieldbook
# finds app updates through /releases/latest, so a data release there would
# hide them — the last step checks, and repairs it if it ever happens.
# Spec: src/docs/specs/2026-10-07-data-archive-design.md §8.2.

on:
  push:
    tags: ["data-v[0-9]+.[0-9]+.[0-9]+-[0-9]+"]
  workflow_dispatch:
    inputs:
      tag:
        description: "Existing data tag to (re)publish, e.g. data-v1.8.0-1"
        required: true
        type: string

permissions:
  contents: write        # create the release and upload the archive

concurrency:
  group: data-release-${{ github.event.inputs.tag || github.ref }}
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Resolve tag
        id: tag
        run: |
          TAG="${{ github.event.inputs.tag || github.ref_name }}"
          if ! printf '%s' "$TAG" | grep -Eq '^data-v[0-9]+\.[0-9]+\.[0-9]+-[1-9][0-9]*$'; then
            echo "::error::'$TAG' is not a data-vX.Y.Z-N tag"; exit 1
          fi
          V="${TAG#data-v}"
          echo "tag=$TAG"         >> "$GITHUB_OUTPUT"
          echo "version=$V"       >> "$GITHUB_OUTPUT"
          echo "base=${V%-*}"     >> "$GITHUB_OUTPUT"

      - uses: actions/checkout@v4
        with:
          ref: ${{ steps.tag.outputs.tag }}
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Verify data/packs.json is released at this tag
        run: |
          REL=$(node -e 'process.stdout.write(String(require("./data/packs.json").release||""))')
          echo "tag=${{ steps.tag.outputs.version }}  data/packs.json release=$REL"
          if [ "$REL" != "${{ steps.tag.outputs.version }}" ]; then
            echo "::error::data/packs.json's release is $REL, not ${{ steps.tag.outputs.version }}."
            echo "::error::Prepare it with node scripts/data-release.js and commit data/packs.json before tagging."
            exit 1
          fi

      - name: Verify the data is for the current app
        run: |
          APP=$(grep -oE 'APP_VERSION="[^"]+"' src/js/30-version.js | head -1 | cut -d'"' -f2)
          echo "data base=${{ steps.tag.outputs.base }}  APP_VERSION=$APP"
          if [ "$APP" != "${{ steps.tag.outputs.base }}" ]; then
            echo "::error::Data ${{ steps.tag.outputs.version }} is for app ${{ steps.tag.outputs.base }}, but APP_VERSION here is $APP."
            exit 1
          fi

      - name: Verify the recorded digests are current
        run: |
          python3 --version
          if ! python3 tools/data-kit/fbdata.py versions --check; then
            echo "::error::A pack changed after data/packs.json was bumped. Run node scripts/data-release.js again on the committed data."
            exit 1
          fi

      - name: Tests
        run: ./src/tests/run.sh

      - name: Build the archive
        run: ./build.sh --data

      - name: Validate the archive
        run: |
          Z="dist/fieldbook-data-standalone-${{ steps.tag.outputs.version }}.zip"
          [ -s "$Z" ] || { echo "::error::missing or empty asset: $Z"; exit 1; }
          python3 tools/data-kit/fbdata.py validate "$Z"

      - name: Collect release notes
        run: |
          node scripts/data-release-notes.js "${{ steps.tag.outputs.version }}" --data > /tmp/notes.md
          echo "Release body:"; cat /tmp/notes.md

      - name: Publish
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          V="${{ steps.tag.outputs.version }}"
          TAG="${{ steps.tag.outputs.tag }}"
          Z="dist/fieldbook-data-standalone-$V.zip"
          if gh release view "$TAG" >/dev/null 2>&1; then
            echo "Release $TAG exists — updating notes and re-uploading the archive."
            gh release edit "$TAG" --title "Fieldbook data $V" --notes-file /tmp/notes.md --latest=false
            gh release upload "$TAG" "$Z" --clobber
          else
            gh release create "$TAG" "$Z" --title "Fieldbook data $V" --notes-file /tmp/notes.md --latest=false
          fi
          echo "Published: $(gh release view "$TAG" --json url -q .url)"

      # R9: if a data release ever ends up "latest", put the newest app release
      # back, then fail so it is seen.
      - name: Check an app release is still "latest"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          LATEST=$(gh api "repos/${{ github.repository }}/releases/latest" --jq .tag_name)
          echo "latest release: $LATEST"
          case "$LATEST" in
            v[0-9]*) exit 0 ;;
          esac
          APPTAG=$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1)
          if [ -n "$APPTAG" ]; then gh release edit "$APPTAG" --latest; fi
          echo "::error::$LATEST was the latest release, which hides app updates from every installed copy of Fieldbook."
          echo "::error::Re-marked ${APPTAG:-(no app tag found)} as latest. Check the releases page."
          exit 1
```

Check both workflows parse: `npx --yes js-yaml .github/workflows/data-release.yml >/dev/null && npx --yes js-yaml .github/workflows/release.yml >/dev/null` (needs network); without network, `ruby -ryaml -e 'ARGV.each { |f| YAML.load_file(f) }' .github/workflows/*.yml`. Expected: no output, exit 0.

- [ ] **Step 6: `dev.sh`**

1. After `tag_missing() {…}`:

```bash
# Where the rules data stands: the release data/packs.json records, and how many
# packs have changed since — a data release (menu d) waiting to happen. Silent
# without Python, which nothing else on this menu needs.
data_status() {
  [ -n "$PY" ] || return 0
  local rel n
  rel=$(node -e 'try{process.stdout.write(String(require("./data/packs.json").release||"?"))}catch(e){process.stdout.write("?")}')
  n=$("$PY" tools/data-kit/fbdata.py versions --changed 2>/dev/null | grep -c . || true)
  if [ "${n:-0}" -gt 0 ]; then
    printf ' %s·%s %sdata %s, %s changed%s' "$DIM" "$OFF" "$YEL" "$rel" "$n" "$OFF"
  else
    printf ' %s·%s %sdata %s%s' "$DIM" "$OFF" "$DIM" "$rel" "$OFF"
  fi
}
```

2. In `status_line()`, directly before the `# Uninstalled hooks are invisible` comment: `data_status`.
3. In `menu()`'s RELEASE group:

```
  RELEASE
    7  Cut a release…
    d  Cut a data release…       (rules data only — no app)
    8  Release checklist
```

4. After `release_menu() {…}`:

```bash
# A data release changes only data/packs.json, so it needs no build. The dry run
# shows what it would do first; nothing is committed, tagged or pushed.
data_release_menu() {
  printf '\n%sCut a data release%s  (rules data only — the app is not touched)\n' "$B" "$OFF"
  run node scripts/data-release.js --dry-run || return 0
  printf '\nBump data/packs.json for this data release? [y/N] '
  local ok; read -r ok
  case "$ok" in
    y|Y) run node scripts/data-release.js ;;
    *) printf 'cancelled\n' ;;
  esac
}
```

5. In the main `case`: `d|D) data_release_menu; pause ;;` after the `7)` arm.
6. In `where_things_live()`, the Rules data entry becomes:

```
  ${B}Rules data${OFF}        data/<dir>/ per category, registered in data/packs.json; the build
                    bundles them into dist/<file> and packs the archive
                    dist/fieldbook-data-standalone-<release>.zip (tools/data-kit/fbdata.py)
```

Check: `bash -n dev.sh && ./dev.sh </dev/null | grep -E "data release|data [0-9]"`
Expected: the `d  Cut a data release…` line and a status line with `data 1.7.2, 3 changed`. Do NOT answer `y` to menu `d` in this worktree.

- [ ] **Step 7: Run everything and the dry run**

Run: `./build.sh --no-zip && ./src/tests/run.sh && node scripts/data-release.js --dry-run; git status --short`
Expected: `All 9 suites passed`; the dry run prints `data release 1.7.2-1: XPHB, XGE, Homebrew change` and `(dry run — nothing written)`; `git status` shows only `dist/fieldbook.html`/`docs/CHANGELOG.md` if the build touched them.

- [ ] **Step 8: Commit**

```bash
git add scripts/data-release.js scripts/data-release-notes.js .github/workflows/data-release.yml .github/workflows/release.yml \
  dev.sh src/tests/data-kit.py
git commit -m "feat: data-only releases — data-release.js, data-release.yml (never latest), notes from the registry (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The newer-data notice

**Files:**
- Modify: `src/js/30-version.js` (after `showUpdatePill()`), `src/js/88-settings.js` (`dataStatus`, `dataStatusHTML`, `rulesBadge`, new `dataUpdateFor`), `src/js/89-rules-merge.js` (`rulesDataHTML`, new `dataUpdateHint`), `src/js/90-boot.js` (`boot()`), `src/tests/harness.js` (`MUTABLE`), `src/tests/data-archive.js`

**Interfaces:**
- Consumes: `parseDataVer`, `cmpDataVer`, `dataVerOfTag`, `dataVerBase` (Task 2); `importRulesPayloads` (Task 4).
- Produces: `let dataUpdate` (`null` or `{release, url, packs:[{system, file, version}]}`); `pickDataRelease(list, appVer) -> {tag, version, url} | null`; `dataUpdateFrom(registry, pick) -> dataUpdate | null`; `checkForDataUpdate() -> Promise<dataUpdate | null>`; `dataUpdateFor(group) -> pack | null`; `dataStatus()` state `"update"` with `{have, want, release}`; `dataUpdateHint(groups) -> string`.

- [ ] **Step 1: Make `dataUpdate` writable in the harness**

`src/tests/harness.js`: `const MUTABLE = ["rules", "character", "activeId", "updateAvailable", "dataUpdate"];` and its comment becomes `/* the globals a suite may need to WRITE, so they need accessors */`.

- [ ] **Step 2: Write the failing tests**

In `src/tests/data-archive.js`, add to the `loadApp([...])` list:
`'pickDataRelease', 'dataUpdateFrom', 'checkForDataUpdate', 'rulesDataHTML', 'rulesBadge', 'APP_VERSION', 'dataUpdateHint',`

Then above the marker line:

```js
section('the newer-data notice', async () => {
  const rel = (tag, extra = {}) => Object.assign({tag_name: tag, draft: false, prerelease: false,
    html_url: 'https://github.com/x/y/releases/tag/' + tag,
    assets: [{name: 'fieldbook-data-standalone-' + X.dataVerOfTag(tag) + '.zip'}]}, extra);
  const P = list => X.pickDataRelease(list, '1.8.0');
  ck('picks the newest data release for this app', (P([rel('v1.8.0'), rel('data-v1.8.0-1'), rel('data-v1.8.0-2')]) || {}).version === '1.8.0-2');
  ck('-10 beats -9', (P([rel('data-v1.8.0-9'), rel('data-v1.8.0-10')]) || {}).version === '1.8.0-10');
  ck('an app release carrying the archive counts', (P([rel('v1.8.0')]) || {}).tag === 'v1.8.0');
  ck('data built for a newer app is skipped', (P([rel('data-v1.8.0-1'), rel('data-v1.9.0-1'), rel('v1.9.0')]) || {}).version === '1.8.0-1');
  ck('drafts and pre-releases are skipped', P([rel('data-v1.8.0-1', {draft: true}), rel('data-v1.8.0-2', {prerelease: true})]) === null);
  ck('a release without the archive is skipped', P([rel('v1.7.2', {assets: [{name: 'fieldbook.html'}]})]) === null);
  ck('junk tags are skipped', P([rel('nightly'), rel('data-v1.8.0'), {tag_name: 7}, null]) === null);
  ck('not a list (a rate-limit reply): null', X.pickDataRelease({message: 'API rate limit exceeded'}, '1.8.0') === null && X.pickDataRelease(null, '1.8.0') === null);
  ck('a page off github.com falls back to the releases page',
     /^https:\/\/github\.com\/.+\/releases$/.test(P([rel('data-v1.8.0-1', {html_url: 'https://evil.example/x'})]).url));

  const pick = {tag: 'data-v1.8.0-1', version: '1.8.0-1', url: 'https://github.com/x/y/releases/tag/data-v1.8.0-1'};
  const up = X.dataUpdateFrom({release: '1.8.0-1', packs: [
    {system: 'XPHB', file: '5e2024_full.json', version: '1.8.0-1'}, {system: 'Bad', file: '../evil.json', version: '1.8.0-1'},
    {system: 'Bad2', file: 'x.json', version: 'v9'}, {system: '', file: 'y.json', version: '1.8.0'}, null]}, pick);
  ck('dataUpdateFrom keeps only well-formed packs', !!up && up.packs.length === 1 && up.packs[0].system === 'XPHB' && up.release === '1.8.0-1', up);
  ck('dataUpdateFrom: no packs, no registry or no pick is null',
     X.dataUpdateFrom({packs: []}, pick) === null && X.dataUpdateFrom(null, pick) === null
     && X.dataUpdateFrom({packs: [{system: 'A', file: 'a.json', version: '1.8.0'}]}, null) === null);

  /* the row, the hint and the badge */
  const sys = 'XPHB', base = X.DATA_VERSIONS[sys];
  const g = () => X.loadedRulesGroups()[0];
  const load = (v, file) => { X.resetRules(); X.mergeRules({system: sys, rulebook: true, dataVersion: v, races: [{name: 'Elf'}]}, file || '5e2024_full.json'); };
  load(base);
  X.dataUpdate = {release: base + '-1', url: 'https://github.com/x/y/releases/tag/data-v' + base + '-1',
                  packs: [{system: sys, file: '5e2024_full.json', version: base + '-1'}]};
  ck('a newer data release makes the row "update"', X.dataStatus(g()).state === 'update', X.dataStatus(g()));
  const chip = X.dataStatusHTML(g());
  ck('...shown muted, naming both versions', /class="rd-src"/.test(chip) && chip.includes('v' + base + '-1 out') && !/update available/.test(chip), chip);
  const list = X.rulesDataHTML();
  ck('...a hint above the list links the release',
     /Newer rules data is out: XPHB v[\d.-]+\./.test(list) && list.includes('href="https://github.com/x/y/releases/tag/data-v'), list.slice(0, 400));
  ck('...and the Settings count says so', / · update$/.test(X.rulesBadge()), X.rulesBadge());
  load(base, 'my-phb.json');
  ck('a pack loaded under another file name gets no notice', X.dataStatus(g()).state === 'current');
  load('1.0.0');
  ck('a pack behind the app is still "stale", amber', X.dataStatus(g()).state === 'stale' && /update available/.test(X.dataStatusHTML(g())));
  load(base);
  X.importRulesPayloads([{name: '5e2024_full.json', bytes: B(JSON.stringify({system: sys, rulebook: true, dataVersion: base + '-1', races: [{name: 'Elf'}]}))}]);
  ck('Review focus 5: importing the newer copy flips the row to current and drops the hint and badge',
     X.dataStatus(g()).state === 'current' && !/Newer rules data is out/.test(X.rulesDataHTML()) && !/update/.test(X.rulesBadge()),
     [X.dataStatus(g()), X.rulesBadge()]);

  /* the network: the releases list, then that tag's registry; silent on failure */
  const calls = [];
  const reply = body => Promise.resolve({ok: true, json: () => Promise.resolve(body)});
  const savedFetch = ctx.fetch, savedOnline = ctx.navigator.onLine;
  try {
    ctx.navigator.onLine = true;
    X.dataUpdate = null;
    ctx.fetch = url => { calls.push(url); return url.includes('api.github.com')
      ? reply([rel('data-v' + X.APP_VERSION + '-1')])
      : reply({release: X.APP_VERSION + '-1', packs: [{system: sys, file: '5e2024_full.json', version: X.APP_VERSION + '-1'}]}); };
    const got = await X.checkForDataUpdate();
    ck('checkForDataUpdate lists releases, then reads that tag\'s registry',
       calls.length === 2 && /api\.github\.com\/repos\/.+\/releases\?per_page=100$/.test(calls[0])
       && /^https:\/\/raw\.githubusercontent\.com\/.+\/data-v[\d.]+-1\/data\/packs\.json$/.test(calls[1]), calls);
    ck('...and sets dataUpdate', !!got && !!X.dataUpdate && X.dataUpdate.release === X.APP_VERSION + '-1', X.dataUpdate);
    X.dataUpdate = null;
    ctx.fetch = () => Promise.reject(new Error('offline'));
    const none = await X.checkForDataUpdate();
    ck('a failed check is silent and changes nothing', none === null && X.dataUpdate === null);
    ctx.navigator.onLine = false; calls.length = 0;
    ctx.fetch = url => { calls.push(url); return reply([]); };
    await X.checkForDataUpdate();
    ck('offline, it doesn\'t try', calls.length === 0);
  } finally {
    ctx.fetch = savedFetch; ctx.navigator.onLine = savedOnline;
    X.dataUpdate = null; X.resetRules();
  }
  ck('boot runs the data check after the app check',
     /checkForUpdate\(\);\s*checkForDataUpdate\(\);/.test(fs.readFileSync(path.join(ROOT, 'src/js/90-boot.js'), 'utf8')));
});
```

Run: `node src/tests/data-archive.js`
Expected: `LOAD FAIL: pickDataRelease is not defined`.

- [ ] **Step 3: The check, in `src/js/30-version.js`, after `function showUpdatePill(){…}`**

```js
/* Newer rules DATA than what is loaded (#83). Data can be released without the
   app, as data-vX.Y.Z-N, and those releases are never GitHub's "latest", so
   checkForUpdate() never sees them. This lists the releases, picks the newest
   with an archive built for this app or an older one, and reads that tag's
   registry straight from the repo — raw.githubusercontent.com answers a
   file:// page. Every failure is silent, as in checkForUpdate(). */
let dataUpdate=null;
function pickDataRelease(list,appVer){
  if(!Array.isArray(list))return null;
  let best=null;
  list.forEach(rel=>{
    if(!rel||typeof rel!=="object"||rel.draft||rel.prerelease)return;
    const tag=typeof rel.tag_name==="string"?rel.tag_name:"";
    const ver=dataVerOfTag(tag);if(!ver)return;
    /* data built for a newer app arrives with that app's own update */
    if(cmpDataVer(dataVerBase(ver),appVer)>0)return;
    const asset="fieldbook-data-standalone-"+ver+".zip";
    if(!Array.isArray(rel.assets)||!rel.assets.some(a=>a&&a.name===asset))return;
    if(best&&cmpDataVer(ver,best.version)<=0)return;
    /* the link becomes an <a href>, so only a github.com page is taken */
    const page=String(rel.html_url||"");
    best={tag,version:ver,url:/^https:\/\/github\.com\//i.test(page)?page:`https://github.com/${UPDATE_REPO}/releases`};
  });
  return best;
}
/* the registry at that tag, kept to well-formed packs, or null */
function dataUpdateFrom(reg,pick){
  if(!pick||!reg||typeof reg!=="object"||!Array.isArray(reg.packs))return null;
  const packs=reg.packs.filter(p=>p&&typeof p==="object"&&typeof p.system==="string"&&p.system.trim()
      &&typeof p.file==="string"&&/^[A-Za-z0-9._-]+\.json$/.test(p.file)&&parseDataVer(p.version))
    .map(p=>({system:p.system,file:p.file,version:p.version}));
  return packs.length?{release:pick.version,url:pick.url,packs}:null;
}
function checkForDataUpdate(){
  if(!UPDATE_REPO||(navigator.onLine===false))return Promise.resolve(null);
  return fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=100`,{headers:{Accept:"application/vnd.github+json"}})
    .then(r=>r.ok?r.json():null)
    .then(list=>{
      const pick=pickDataRelease(list,APP_VERSION);
      if(!pick)return null;
      return fetch(`https://raw.githubusercontent.com/${UPDATE_REPO}/${encodeURIComponent(pick.tag)}/data/packs.json`,{cache:"no-store"})
        .then(r=>r.ok?r.json():null)
        .then(reg=>{
          dataUpdate=dataUpdateFrom(reg,pick);
          if(dataUpdate&&typeof renderRulesData==="function")renderRulesData();
          return dataUpdate;
        });
    }).catch(()=>null);
}
```

- [ ] **Step 4: The `update` state, in `src/js/88-settings.js`**

Replace `dataStatus(g)`'s body (Task 2's version) with:

```js
  const have=g.dataVersion||"";
  const want=(typeof DATA_VERSIONS!=="undefined"&&DATA_VERSIONS[g.source])||"";
  const upd=dataUpdateFor(g);
  if(!have||!parseDataVer(have)||(!want&&!upd))return {state:"unknown"};
  if(want&&cmpDataVer(have,want)<0)return {state:"stale",have,want};
  if(upd&&cmpDataVer(have,upd.version)<0)return {state:"update",have,want:upd.version,release:dataUpdate.release};
  return {state:"current",have};
```

add to its comment: "A pack the app is happy with can still be behind a data-only release (#83): that is \"update\", quiet, because a data release is optional." Then directly after `dataStatus`:

```js
/* the newer copy the data-release check found for a pack loaded from a file of
   the same system and file name, or null */
function dataUpdateFor(g){
  if(!dataUpdate||!g||!g.isFile)return null;
  return (dataUpdate.packs||[]).find(p=>p.system===g.source&&p.file===g.label)||null;
}
```

In `dataStatusHTML(g)`, after the `stale` branch:

```js
  if(st.state==="update")
    return ` <span class="rd-src" title="${esc("Rules data "+st.release+" has a newer copy of this pack, v"+st.want+". Download it from the release page and import it.")}">v${esc(st.have)} · v${esc(st.want)} out</span>`;
```

`rulesBadge()` becomes:

```js
function rulesBadge(){
  const n=rulesEntryCount();
  const up=loadedRulesGroups().some(g=>dataStatus(g).state==="update");
  return (n?n+" entries":"none loaded")+(up?" · update":"");
}
```

- [ ] **Step 5: The hint, in `src/js/89-rules-merge.js`**

Before `function rulesDataHTML(){`:

```js
/* One line above the loaded-data list when a data release has newer copies of
   packs the player has loaded (#83). Quiet on purpose (R7): a data release is
   optional. The link is pickDataRelease()'s, kept to github.com. */
function dataUpdateHint(groups){
  const ups=[...new Set(groups.map(g=>({g,st:dataStatus(g)})).filter(x=>x.st.state==="update")
    .map(x=>x.g.source+" v"+x.st.want))];
  if(!ups.length||!dataUpdate)return "";
  return `<p class="hint" style="margin:4px 0 8px">Newer rules data is out: ${esc(ups.join(", "))}. <a href="${esc(dataUpdate.url)}" target="_blank" rel="noopener">Download it from the release page</a>.</p>`;
}
```

and in `rulesDataHTML()`, change the final `return warn+html;` to `return warn+dataUpdateHint(groups)+html;`.

- [ ] **Step 6: Boot, in `src/js/90-boot.js`**

At the end of `boot()`: `checkForUpdate();` becomes `checkForUpdate();checkForDataUpdate();` (one line, in that order — the test reads it).

- [ ] **Step 7: Run everything**

Run: `node src/tests/data-archive.js && ./build.sh --no-zip && ./src/tests/run.sh`
Expected: `ALL PASSED`, then `All 9 suites passed`.

- [ ] **Step 8: Commit**

```bash
git add src/js/30-version.js src/js/88-settings.js src/js/89-rules-merge.js src/js/90-boot.js src/tests/harness.js src/tests/data-archive.js
git commit -m "feat: a quiet notice when newer rules data is out for a loaded pack (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Docs, the player notes, and screenshot QA

**Files:**
- Modify: `src/docs/wiki/architecture/data-archive.md` (write it in full), `src/docs/wiki/architecture/rules-packs.md`, `src/docs/wiki/features/settings-and-updates.md`, `src/docs/wiki/process/building-and-ci.md`, `src/docs/wiki/process/testing.md`, `src/docs/wiki/overview.md`, `src/docs/wiki/data/homebrew.md`, `src/docs/wiki/data/converter.md`, `src/docs/wiki/roadmap/2.0.md`, `src/docs/wiki/roadmap/known-issues.md`, `src/docs/wiki/decisions.md`, `src/docs/RELEASING.md`, `README.md`, `docs/rules-schema.md`, `CLAUDE.md`, `.github/ISSUE_TEMPLATE/4-data-update.md`, `src/tests/docs.js`, `src/docs/_claude/WIRING-LEDGER.md`, `src/docs/UNRELEASED.md`

**Interfaces:**
- Consumes: everything above. Every function a wiki page names in backticks with `()` must exist (the `docs` suite checks, outside History and Decisions sections).

- [ ] **Step 1: The ledger entry (append only)**

Append to the end of `src/docs/_claude/WIRING-LEDGER.md`:

```markdown

## Data archive, per-pack versions and data-only releases (#83, 2026-10-07)

Part 1 of #82. Rules data ships as one zip that Fieldbook opens itself, every pack has its own
version, and data can be released without the app.

1. `data/packs.json` registers every pack (system, dir, file, title, version, digest, optional
   licence and credit). `tools/data-kit/fbdata.py` (Python 3.8+, stdlib) is the only code that
   computes digests — canonical JSON of the registry fields and the folder's files — and the only
   writer of versions. The first digests were seeded from the v1.7.2 tree.
2. `bundle-rules.js` reads the registry; `release.js` bumps changed packs to the app version through
   `fbdata.py` and snapshots `DATA_VERSIONS`. The git-diff-since-last-tag logic is gone.
3. Data versions are `X.Y.Z` / `X.Y.Z-N` (not semver); `cmpDataVer()` compares them. `dataStatus()`
   and the settings-import older-copy check use it; an unreadable version is unknown.
4. `89-zip.js`: a pure zip reader with a puff.c-style inflate; refuses encrypted, ZIP64, unknown
   methods, damage and oversize by code. `readDataArchive()` reads an archive, the app zip's nested
   archive, or loose JSON, and refuses the data kit.
5. `importRulesPayloads()` imports bytes; each pack in a zip keeps its own file name. `importPack()`
   replaces what the same file name and system loaded before (R4). In a loose zip, JSON with no
   rules category is skipped (an old app zip's converter inputs) — a plan ruling. Both status lines
   show "Reading…", then every failure by name; a failed cache save is reported there.
6. Pack `license`/`attribution` → `rules.credits` → Settings → Credits & licences and `NOTICE.md`.
   Homebrew's CC BY-SA 3.0 credit to D&D Wiki ships for the first time.
7. The archive `fieldbook-data-standalone-<release>.zip` (`fbdata.py pack`, validated by
   `fbdata.py validate`); the app zip carries it. `build.sh --data` builds only it; the zips need
   python3, `--no-zip` doesn't.
8. Data-only releases: `scripts/data-release.js` (dev.sh `d`) and `data-release.yml`, published with
   `--latest=false` and checked afterwards; app releases attach the archive and get their data notes
   from `scripts/data-release-notes.js`.
9. `checkForDataUpdate()` finds the newest data release for this app, reads its registry, and marks
   older loaded packs "update" — quietly (R7).
10. A release freeze holds until 1.8.0 (#83, #84, #85) is complete; the history purge is logged for 2.0.

Pages: [data archive](../wiki/architecture/data-archive.md), [rules packs](../wiki/architecture/rules-packs.md),
[settings & updates](../wiki/features/settings-and-updates.md), [building & CI](../wiki/process/building-and-ci.md),
[testing](../wiki/process/testing.md).
```

Then find its line number: `grep -n '^## Data archive, per-pack versions' src/docs/_claude/WIRING-LEDGER.md` — call it L. Every History line below cites `→ ledger L<that number>`.

- [ ] **Step 2: Write `src/docs/wiki/architecture/data-archive.md` in full**

Replace the stub with this page (put the real ledger line number in the History line):

```markdown
# Data archive

Rules data ships as one zip, `fieldbook-data-standalone-<version>.zip`, and Fieldbook opens it
itself, offline. Each pack in it has its own version, recorded with a digest of its content in the
registry `data/packs.json`, so data can be released without the app: a data-only release
(`data-v1.8.0-1`) publishes a new archive, and a running copy says quietly that it is out. This page
covers the archive, the registry and versions, opening a zip, re-importing, pack credits, the
notice, and both release paths. What the app does with a pack once it is loaded is
[Rules packs](rules-packs.md).

**Code:** `crc32()`, `inflateRaw()`, `isZipBytes()`, `zipEntries()`, `zipEntryBytes()`,
`readDataArchive()` in `89-zip.js`; `importRulesPayloads()`, `importPack()`, `dropOwnedPackMeta()`,
`importSummary()`, `importRulesFiles()`, `creditOf()`, `dataUpdateHint()` in `89-rules-merge.js`;
`parseDataVer()`, `cmpDataVer()`, `dataVerOfTag()`, `dataVerBase()`, `pickDataRelease()`,
`dataUpdateFrom()`, `checkForDataUpdate()` in `30-version.js`; `dataStatus()`, `dataUpdateFor()`,
`prunePackMeta()`, `rulesCreditsHTML()`, `rulesBadge()` in `88-settings.js`; `pack_digest()`,
`changed_packs()`, `cmd_pack()`, `validate_archive()` in `tools/data-kit/fbdata.py`; `registry()` in
`scripts/bundle-rules.js` · **Data:** `data/packs.json` · **Tests:** `data-archive.js`, `data-kit.py`,
`rules-data.js`, `docs.js` · **See also:** [Rules packs](rules-packs.md),
[Settings & updates](../features/settings-and-updates.md), [Building & CI](../process/building-and-ci.md),
[RELEASING](../../RELEASING.md), [the spec](../../specs/2026-10-07-data-archive-design.md)

## How it works

**The registry.** `data/packs.json` lists every pack: its `system`, the `dir` under `data/` it is
built from, the bundle's `file` and `title`, its `version`, a `digest`, and optionally a `license`
(an SPDX id) and an `attribution`. `release` is the version of the last release, app or data, and
names the archive. `bundle-rules.js` reads it (`registry()`), so a bundle's `name`, `dataVersion`,
`license` and `attribution` all come from here.

**Versions.** A data version is `X.Y.Z` — the data shipped with app X.Y.Z — or `X.Y.Z-N`, the Nth
data-only release after it. It is not semver: `1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1`.
`cmpDataVer()` compares them and returns 0 for anything unreadable; `cmpVer()` still compares app
versions, and would read `1.8.0-1` and `1.8.0-2` as equal. A pack's version moves only when its
content does: the digest is the SHA-256 of the canonical JSON of its registry fields and every file
in its folder (`pack_digest()`), so re-indenting a file changes nothing.

**App releases** (`./build.sh --release`): `release.js` runs `fbdata.py versions --bump <next>`,
which gives every changed pack the new app version and sets `release`, then snapshots
`DATA_VERSIONS` from the registry. `DATA_VERSIONS` is the app's offline baseline: a loaded pack
older than it is **stale**.

**Data releases** (`node scripts/data-release.js`, dev.sh `d`): bump only the changed packs to
`<APP_VERSION>-N`; refuse when nothing changed, when `data/` is dirty, or when the tag exists; print
the commit, tag and push commands. Pushing `data-vX.Y.Z-N` runs `data-release.yml`, which publishes
the archive alone with `--latest=false`.

**The archive.** `fbdata.py pack` writes `fieldbook-data.json` (the manifest), `NOTICE.md` and the
bundles — sorted, dated 1980-01-01, deflated at level 9 — and `fbdata.py validate`
(`validate_archive()`) checks it. A build names it `+dev` when a digest is unreleased. The app zip
carries it in `data/`.

**Opening a zip.** `89-zip.js` is pure. `readDataArchive()` reads, in order: an archive (its manifest
at the root or one folder down); the data kit, refused; an archive one level inside (the app zip); a
zip of loose `.json`. It refuses encrypted, ZIP64, unknown-method, damaged, oversized and
1,000-plus-entry zips by `zipError` code, and every entry is CRC-checked before anything merges.

**Importing.** `importRulesPayloads()` takes bytes; a zip's packs are imported under their own file
names, so rows and chips stay per pack. `importPack()` replaces what that file name and system
loaded before, dropping entries the new copy no longer has. In a loose zip, JSON with no rules
category — the converter's inputs in an old app zip — is skipped. `importRulesFiles()` shows
"Reading N files…" at once, then one line on both status lines naming each zip, each failure and
its reason, and a cache save that failed.

**Credits.** A pack's `license` and `attribution` become `rules.credits[label]` (`creditOf()`), kept
and pruned like `requires`, carried by settings files, and listed in Settings → Credits & licences
(`rulesCreditsHTML()`), escaped.

**The notice.** `checkForDataUpdate()` runs after `checkForUpdate()`. It lists the releases,
`pickDataRelease()` takes the newest with an archive built for this app or an older one, and it
reads that tag's `data/packs.json` from `raw.githubusercontent.com`, which answers a `file://` page
with `access-control-allow-origin: *`. A loaded pack with the same system and file name and an older
version shows a muted `vA · vB out`, a hint line links the release, and the Settings count adds
`· update`. Any failure is silent.

## Rules that must hold

- **Only `release.js` and `data-release.js` write versions, digests and `release`,** through
  `fbdata.py` — never by hand, never in a build.
- **A data release is never "latest".** Every installed copy finds app updates through
  `/releases/latest`. `data-release.yml` publishes with `--latest=false`, then checks; if a data
  release is latest, it re-marks the newest app release and fails.
- **Data tags sort in code** (`cmpDataVer()`), never with git's `v:refname`; every app glob is
  anchored at `v`, so `data-v…` never matches one.
- **A zip is read whole before any of it merges.** A damaged archive imports nothing.
- **Re-importing replaces by file name and system,** never by file name alone.
- **Credits are text,** shown through `esc()` and capped at 64 and 2,000 characters.

## Traps

- **`cmpVer()` ignores `-N`.** Every comparison of data versions goes through `cmpDataVer()`.
- **The zips need Python.** `./build.sh --no-zip` and the Node suites don't; the zips, a release
  and the `data-kit` suite do.
- **Seeding was the one hand-run step.** The first digests came from the v1.7.2 tree, so data
  changed after v1.7.2 still moves to 1.8.0.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How players load the data | The app opens the zip itself | Unzip first: one more step, and an awkward one on a phone |
| Version granularity | Per pack; the archive carries the release | One version for everything: re-downloading every pack because one changed |
| Version format | `X.Y.Z` / `X.Y.Z-N` | Semver: `-N` would be a pre-release, sorting below the release it follows |
| What says a pack changed | A digest of its content (canonical JSON) | `git diff` since the last tag: formatting-only changes bumped packs |
| How a running copy learns of new data | The releases list plus the tag's registry; a quiet notice | Baked into the app: only a new app could announce new data |
| Where digests are computed | Only `fbdata.py` | In Node and Python both: two implementations that must agree |

## Open

- The SRD 5.2 pack (#84), and the private split with the data kit (#85).

## History

- 2026-10-07 — The data archive, the pack registry and per-pack versions, opening zips, pack
  credits, the newer-data notice and data-only releases. → ledger L<n>
```

- [ ] **Step 3: Update the other wiki pages (present tense, each with a History line citing the ledger)**

- `architecture/rules-packs.md`: the **Code:** line gains `importPack()`, `dropOwnedPackMeta()`, `creditOf()` (89-rules-merge.js) and `cmpDataVer()` (30-version.js); "How it works" — importing now takes bytes and zips (one paragraph, linking [Data archive](data-archive.md)), re-import replaces (R4); the "**Is my pack current?**" paragraph is rewritten to the registry, digests, `cmpDataVer()` and the four states (unknown, stale, update, current); the "Rules that must hold" bullet about `DATA_VERSIONS` says it is a snapshot written by `release.js` from `data/packs.json`, and drops the `SYSTEM_DIRS` sentence; the Tests note says `data-archive.js`, and that `rules-data.js` checks every bundle against `data/packs.json`.
- `features/settings-and-updates.md`: the data-status passage gains the `update` state, the hint line and `· update` on the count; a paragraph on `checkForDataUpdate()`; Credits & licences lists each loaded pack's credit; the "never hand-edit" bullet names `data/packs.json`'s versions, digests and release.
- `process/building-and-ci.md`: `build.sh --data`, the archive and its validation, Python for the zips, the app zip's `data/` rule, the new `release.yml` guard and assets, `data-release.yml` and its "latest" check.
- `process/testing.md`: nine suites; what `data-kit.py` and `data-archive.js` cover; the `note:` skips when python3 or zip is missing.
- `overview.md`: glossary entries for **data version**, **data release**, **rules-data archive** and **registry** (`data/packs.json`); the code map row for `30-version.js` names `checkForDataUpdate()`.
- `data/homebrew.md`: its licence and credit now ship in the bundle, in Settings and in `NOTICE.md`; `requires` unchanged.
- `data/converter.md`: the byte-for-byte rule — a value that moves changes the pack's digest, so the next release bumps it.
- `roadmap/2.0.md`: a new section after "What 2.0 must carry":

```markdown
## Planned for 2.0

- **Purge the copyrighted rules data from git history** (#82). Until then it is only removed from
  `main` (#85), which writes up the full procedure here.
```

- `roadmap/known-issues.md`: under limitations — Fieldbook before 1.8.0 can't open the zip (unzip and import the JSON); a data update is announced, never installed automatically; the notice needs the network and is silent offline.
- `decisions.md`: one line per row of the new page's Decisions table, in the register's own format, linking `architecture/data-archive.md`.

- [ ] **Step 4: Player-facing docs**

- `README.md` (read §3a, §9 and §10 first):
  - §3a: load the rules data by downloading `fieldbook-data-standalone-<version>.zip` from the release and choosing it in Import files (home screen or Settings → Rules data); the app zip works too; a newer copy of a loaded pack is announced quietly; Fieldbook before 1.8.0 needs it unzipped.
  - §9: `data/` in the download now holds the one archive, not the separate `*_full.json` files; say what is inside it (the packs, `fieldbook-data.json`, `NOTICE.md`).
  - §10: replace "Rules content is not distributed with the app…" with: the rules data comes separately, as the archive; each pack keeps its own terms, listed in its `NOTICE.md` and in Settings → Credits & licences; the Homebrew pack's The Predator is from D&D Wiki, used under CC BY-SA 3.0.
- `docs/rules-schema.md`: §1's pack-level fields gain `license` (SPDX id, ≤ 64 characters) and `attribution` (plain text, ≤ 2,000), shown in Settings → Credits & licences; a new §6.10a, "The rules-data archive": the zip's layout, the manifest's fields (`_type`, `format`, `version`, `builtFor`, `packs[].file/system/version/license/sha256`), that Fieldbook also opens a zip of loose packs, and the data version format. Keep its existing heading style.
- `.github/ISSUE_TEMPLATE/4-data-update.md`: the sentence about `release.js` bumping `DATA_VERSIONS` becomes: changed packs get a new version in `data/packs.json` at the next release, app or data (`node scripts/data-release.js`).
- `src/docs/RELEASING.md`:
  - Directly after its first paragraph:

    ```markdown
    > **Release freeze (from 2026-10-07):** no releases — app or data — until 1.8.0 is complete:
    > #83 (the data archive), #84 (the SRD 5.2 pack) and #85 (the private split). Mike lifts it.
    ```

  - Where it says `release.js` bumps `DATA_VERSIONS` for changed systems: it now bumps changed packs in `data/packs.json` through `fbdata.py` (content digests) and snapshots `DATA_VERSIONS`; a release needs `python3`.
  - The assets table: `fieldbook.html`, `fieldbook-vX.Y.Z.zip`, `fieldbook-data-standalone-X.Y.Z.zip` (the five `*_full.json` rows go); the new guard (`data/packs.json` release = tag).
  - A new section "Data releases": when (data changed, app didn't); `./dev.sh` → `d` or `node scripts/data-release.js [--dry-run]`; the printed commands; what `data-release.yml` checks, in order; that it is never "latest" and what the last step does if one is; re-publishing with `workflow_dispatch`; rollback (delete the release and the `data-v…` tag; the next data release reuses nothing).
- `CLAUDE.md`: "Data-only or converter-only changes need no note and no release — record them in the ledger." becomes "Data-only or converter-only changes need no player note — record them in the ledger. They can ship without an app release as a data release (`node scripts/data-release.js`), which is Mike's to cut like any release." In "Converter", the byte-for-byte sentence's reason becomes "or the pack's content digest moves and the next release tells every player to re-download a pack that didn't change".
- `src/tests/docs.js`: replace the "the two data files players actually get" check with:

```js
// ---------- the rules data players actually get: one archive (#83)
ck('README names the rules-data archive', readme.includes('fieldbook-data-standalone'));
```

- [ ] **Step 5: The player notes**

Append under `## Pending` in `src/docs/UNRELEASED.md` (no `<tags>`, no `vX.Y.Z`):

```markdown
- **Rules data now comes as one download**, `fieldbook-data-standalone-….zip`, and Fieldbook opens it itself: choose it in Import files on the home screen or in Settings → Rules data. The app's own download zip works too. An older copy of Fieldbook can't open a zip: unzip it and import the `.json` files inside.
- Rules data can now be updated between app releases. When a newer copy of a rules pack you have loaded is out, Fieldbook says so quietly beside that pack in Settings → Rules data, with a link to download it.
- Re-importing a rules pack now replaces it completely: anything the new copy no longer has is removed, instead of staying loaded alongside it.
- Settings → Credits & licences now lists the licence and credit of each rules pack you have loaded, starting with the Homebrew pack's credit to D&D Wiki.
- When an import fails, Fieldbook now names the file and says why — for example that a zip is password-protected or damaged — on the home screen as well as in Settings, and a large import shows straight away that it is reading the files.
```

- [ ] **Step 6: Build, test, and the by-hand checks**

```bash
./build.sh --no-zip && ./src/tests/run.sh
./build.sh
unzip -l dist/fieldbook-data-standalone-*.zip
unzip -l dist/fieldbook-v*.zip | grep data/
node scripts/data-release.js --dry-run
git status --short
```

Expected: `All 9 suites passed`; both zips built and listed; the dry run names `1.7.2-1` and writes nothing; `git status` shows only the docs you changed plus `dist/fieldbook.html`/`docs/CHANGELOG.md` if the build touched them (never commit those two).

- [ ] **Step 7: Screenshots — before and after, both skins**

Load the project's Playwright tools (`ToolSearch` with `select:mcp__playwright__browser_navigate,mcp__playwright__browser_click,mcp__playwright__browser_file_upload,mcp__playwright__browser_evaluate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_resize,mcp__playwright__browser_snapshot`). Never the `mcp__plugin_playwright_*` ones. Width 390 and 1280. QA dir: `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/`.

Make the locked zip for the error shot:

```bash
python3 - <<'EOF'
import zipfile
p = "/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/83-locked.zip"
with zipfile.ZipFile(p, "w") as z:
    z.writestr("a.json", '{"spells": []}')
b = bytearray(open(p, "rb").read())
b[6] |= 1                                   # local header: "encrypted"
i = b.find(bytes([0x50, 0x4B, 1, 2]))
b[i + 8] |= 1                               # central header: "encrypted"
open(p, "wb").write(bytes(b))
EOF
```

Shots, each in the Humblewood skin, then Classic (`browser_evaluate`: `() => { settings.skin = "classic"; applyTheme(); }`):

1. **Before** (`main`'s build): import `/Users/mwardman/Documents/Repos/RPGFieldbook/dist/5e2024_full.json` and `homebrew_full.json` from the home screen (click the home import button, then `browser_file_upload`); open Settings (`() => openSettings()`), open Rules data and Credits & licences → `83-before-settings-<skin>.png`; the home screen → `83-before-home-<skin>.png`.
2. **After** (this branch's build, a fresh tab): import `dist/fieldbook-data-standalone-*.zip` from the home screen → `83-after-home-import-<skin>.png` (the status line names the zip and its version).
3. Settings → Rules data and Credits & licences → `83-after-settings-<skin>.png`.
4. The notice: `browser_evaluate` `() => { dataUpdate = {release: "1.7.2-1", url: "https://github.com/wardmanm/RPGFieldbook/releases", packs: [{system: "XPHB", file: "5e2024_full.json", version: "1.7.2-1"}]}; openSettings(); return rulesBadge(); }`, open Rules data → `83-after-notice-<skin>.png` (the hint, the muted row text, `· update` on the count).
5. Import `83-locked.zip` → `83-after-locked-<skin>.png` ("Couldn't import 83-locked.zip: it's password-protected.").
6. A fresh tab: import the app zip `dist/fieldbook-v*.zip` from the home screen → `83-after-appzip-<skin>.png`.

Look at every shot yourself before reporting: text legible, nothing overlapping at 390 px, the status lines readable in both skins. Report what you drove and what you did not (real phones' file pickers, the notice against real GitHub, and Mike's own characters are Mike's pass).

- [ ] **Step 8: Commit**

```bash
git add src/docs/wiki src/docs/RELEASING.md README.md docs/rules-schema.md CLAUDE.md .github/ISSUE_TEMPLATE/4-data-update.md \
  src/tests/docs.js src/docs/_claude/WIRING-LEDGER.md src/docs/UNRELEASED.md
git commit -m "docs: the data archive — wiki, README, RELEASING, rules-schema, ledger, player notes (#83)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(`git add src/docs/wiki` adds only tracked or new wiki files; check `git status` first that nothing else is staged.)
