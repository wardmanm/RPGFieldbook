# Extensions and Manifest Installs: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and update rules packs from a manifest, in the style of Foundry VTT's module
manifests. The sources are Fieldbook's own release (built in) or any public manifest URL, and a
manual install takes files, a folder or a zip. All of them go through one install plan, which checks
digests and installs all or nothing. Settings → Rules data becomes **Extensions**, grouped by
category, and a top-bar pill announces updates and can be cleared.

**Architecture:**
- **Task 1:** the data kit writes the format-2 manifest (`fieldbook-data.json`, extended) and gains
  `release-files`.
- **Task 2:** the release paths commit `releases/data/` at the tag, and CI checks it.
- **Task 3:** a new fragment, `src/js/89-extensions.js`, with the pure core:
  - `sha256Hex`;
  - `readManifest`;
  - the source settings and their conversion;
  - offers, row states and update counts.
- **Task 4:** the network and the pipeline:
  - checking sources;
  - adding a source;
  - candidates from manifests and from files;
  - `planInstall`, `runInstall`;
  - the boot check.
- **Task 5:** the Extensions page and the details dialog.
- **Task 6:** the plan dialog, Manual install (pick, folder, drop), the pill and its ×, and the
  app pill's ×.
- **Task 7:** QA and docs.

**Tech Stack:** Plain ES2020 concatenated into one script, with no modules. Python 3.8+ stdlib for the
data kit. Node suites through `src/tests/harness.js`, and `src/tests/data-kit.py`. The project's
Playwright MCP.

**Spec:** `src/docs/specs/2026-10-26-extensions-manifest-design.md`. Read it first; its §2 decisions
table is binding.
**Mockups:** `.superpowers/brainstorm/23506-1793015387/content/extensions-page-2.html` is the agreed
page, details dialog and Manual install. It says "Install by hand"; the agreed wording is **Manual
install**. Its "requires newer Fieldbook" chip is agreed as **requires Fieldbook X.Y.Z**.

**Worktree:** `.claude/worktrees/102`, branch `issue/102-extensions`. Run every command below from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/102`.

## Global Constraints

- **Build**
  - One shipped file, built by concatenation: no modules. The only network calls are the existing
    ones plus the manifest checks and pack downloads this plan adds, every one with a timeout.
  - `src/js/89-extensions.js` goes in `src/manifest.json` right after `"src/js/89-rules-merge.js"`.
  - The JS fragment count goes to **38** in `CLAUDE.md` (`js/*.js  37 fragments`) and
    `src/docs/ADR-001-source-split.md`.
  - Add a code-map row in `src/docs/wiki/overview.md`, and cite the fragment from
    `src/docs/wiki/architecture/rules-packs.md`.
- **Bytes:** LF line endings, a final newline, no BOM.
- **Git**
  - Never `git add` `dist/fieldbook.html` or `docs/CHANGELOG.md`. Add explicit paths only.
  - Never touch `APP_VERSION`, `DATA_VERSIONS`, `CHANGELOG`, or the `version`, `digest` and
    `release` fields of `data/packs.json`.
  - Adding `name`, `homepage`, `summary` and `description` to `data/packs.json` is allowed: they are
    not in `META_KEYS`, so no digest moves. Verify with `python3 tools/data-kit/fbdata.py versions --check`.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Limits (spec §3)**
  - summary 140 characters, description 4,000;
  - a manifest of at most 64 KiB (65,536 bytes) and 1,000 packs;
  - one pack file of at most 32 MiB;
  - check timeout 10 s, file timeout 30 s.
- **Pack identity:** `system|file`. `system` is `srcLabel(obj)`; `file` is the base name. This is
  `importPack()`'s identity.
- **Categories this app installs:** `["rules"]`. A missing category is `"rules"`.
- **Too new:** `cmpDataVer(minApp, APP_VERSION) > 0`, where `minApp` is X.Y.Z and defaults to the
  manifest's `builtFor`.
- **Wording (spec decision 20):**
  - "requires Fieldbook X.Y.Z";
  - "requires *Pack*";
  - "Unsupported";
  - "Manual install";
  - "Extensions · N updates".
- **Markup:**
  - every `${…}` in a quoted attribute is `esc(…)`, and all body text is `esc()`d;
  - descriptions are text, split on blank lines into `<p>`s;
  - links are http or https only (`extUrl()`), with `target="_blank" rel="noopener"`.
- **Storage:** a failed `saveRulesCache()` or `saveSettings()` is reported on the status line,
  never swallowed.
- **The harness**
  - Read values through `loadApp([...])` names, and add any that are missing.
  - `ctx.fetch = …` installs a fetch, and `document` is a stub.
  - Run one suite: `node src/tests/<suite>.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`.
    The data-kit suite: `python3 src/tests/data-kit.py | tail -3`.
  - Run everything: `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`,
    then `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.
- **Screenshots:** the project's Playwright MCP only (`mcp__playwright__*`), with absolute paths
  under `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/in-progress/102-extensions/`.

## Review Focus

1. **Offline, or a source that times out or answers garbage at boot.**
   - Nothing changes.
   - The source keeps its last good manifest and its row says "couldn't check: …".
   - No toast, and no pill change.
   - An official source on a release with no `releases/data/` says nothing at all.

   → Task 4, "checkSources failures".
2. **One bad file in Update all**: a 404, a wrong sha256, the wrong system or a mismatched
   `dataVersion`. Nothing is imported, the cache isn't saved, and the error names the file. → Task 4,
   "runInstall all or nothing".
3. **Old settings and old backups.** `rulesSources` and `rulesUrl` convert once into plain sources.
   The official source exists exactly once. A second conversion changes nothing. An old settings
   file imported later converts the same way. → Task 3, "convertSources".
4. **Hostile manifest text**:
   - `<img onerror>` in a name, summary or description;
   - a `javascript:` homepage or `requires.url`;
   - a `../` path;
   - a 10,000-character summary.

   All are cut, escaped or refused in the rows, the details dialog and the plan. → Task 3 (reading)
   and Tasks 5 and 6 (markup).
5. **Clearing and the next update.** × hides the pill and Update stays on the row. A newer version
   brings the pill back, and the same version never does. The app pill follows the same rule.
   → Task 3, "dismissal", and Task 6, "app pill".

---

### Task 1: The data kit writes the format-2 manifest and `release-files`

**Files:**
- Modify: `tools/data-kit/fbdata.py`:
  - `check_registry` (~:65), to accept and check the new optional fields;
  - `cmd_pack` (~:265), splitting out `build_manifest()`;
  - `validate_archive` (~:314), to read a folder too and accept format 1 or 2;
  - `main` (~:744), to add `release-files`.
- Modify: `data/packs.json`, adding top-level `name` and `homepage`, and per-pack `summary` and
  `description`.
- Test: `src/tests/data-kit.py`.

**Interfaces:**
- Produces:
  - `build_manifest(reg, bundles_dir, built_for, dev) -> (manifest_dict, {file_name: raw_bytes})`.
  - `fbdata.py release-files <bundles> -o <dir> [--registry R] [--built-for V]`, which writes
    `<dir>/fieldbook-data.json` and every bundle, removes other `*.json` in `<dir>`, and validates it
    `--public`.
  - `fbdata.py validate <zip-or-folder> [--public]`.
  - Each manifest pack carries these keys, in this order:
    `file, category, system, title, summary, description, version, minApp, size, sha256, license, attribution, requires`.
  - The manifest's top level: `_type, format: 2, name, homepage, version, builtFor, packs`.

- [ ] **Step 1: Write the failing tests** at the end of `src/tests/data-kit.py`, before its summary
  line. Copy the style of the existing `pack`/`validate` tests near :220–:240, which build a scratch
  registry and bundles; reuse their helpers `scratch()`, `write()` and `kit()`. Add:

```python
# ---------- #102: the format-2 manifest and release-files
d = scratch()
reg = read_json(d, "packs.json")
reg["name"] = "Test data"
reg["homepage"] = "https://example.com/data"
reg["packs"][0]["summary"] = "A short line."
reg["packs"][0]["description"] = "Para one.\n\nPara two."
reg["packs"][0]["minApp"] = "1.9.0"
write(d, "packs.json", reg)
r = kit(d, "bundle", "-o", os.path.join(d, "dist"))
ck("#102 bundle still works with the new registry fields", r.returncode == 0, r.stderr)
z = os.path.join(d, "out.zip")
r = subprocess.run([sys.executable, FBDATA, "pack", os.path.join(d, "dist"), "-o", z,
                    "--registry", os.path.join(d, "packs.json"), "--built-for", "1.9.0"],
                   capture_output=True, text=True)
ck("#102 pack writes the archive", r.returncode == 0, r.stderr)
with zipfile.ZipFile(z) as zf:
    man = json.loads(zf.read("fieldbook-data.json").decode("utf-8"))
    raw0 = zf.read(man["packs"][0]["file"])
p0 = man["packs"][0]
ck("#102 the manifest is format 2 with name and homepage",
   man["format"] == 2 and man["name"] == "Test data" and man["homepage"] == "https://example.com/data", man)
ck("#102 each pack carries category, title, summary, description, minApp and size",
   p0["category"] == "rules" and p0["summary"] == "A short line." and p0["description"].startswith("Para one")
   and p0["minApp"] == "1.9.0" and p0["size"] == len(raw0) and isinstance(p0["title"], str), p0)
ck("#102 keys are written in a fixed order",
   list(p0.keys())[:6] == ["file", "category", "system", "title", "summary", "description"], list(p0.keys()))
ck("#102 a pack with no minApp in the registry carries none (the reader defaults it to builtFor)",
   all("minApp" in p or p is p0 for p in man["packs"]) and ("minApp" not in man["packs"][-1] or len(man["packs"]) == 1))
ck("#102 a format-2 archive validates", subprocess.run([sys.executable, FBDATA, "validate", z],
   capture_output=True, text=True).returncode == 0)

# requires is copied from the bundle, names and url only
bundle_path = os.path.join(d, "dist", p0["file"])
b = json.load(open(bundle_path, encoding="utf-8"))
b["requires"] = [{"pack": "Other", "file": "other_full.json", "url": "https://example.com/other", "spells": ["Haste"]}]
open(bundle_path, "w", encoding="utf-8").write(json.dumps(b))
man2, _ = fbdata.build_manifest(fbdata.load_registry(os.path.join(d, "packs.json")), os.path.join(d, "dist"), "1.9.0", False)
ck("#102 requires carries pack, file and url, never the entry lists",
   man2["packs"][0]["requires"] == [{"pack": "Other", "file": "other_full.json", "url": "https://example.com/other"}],
   man2["packs"][0].get("requires"))

# the registry refuses bad new fields
for field, bad, why in [("summary", "x" * 141, "141 characters"), ("description", "x" * 4001, "4,001 characters"),
                        ("minApp", "1.9", "not X.Y.Z"), ("category", "", "empty")]:
    reg_bad = json.loads(json.dumps(reg)); reg_bad["packs"][0][field] = bad
    write(d, "bad.json", reg_bad)
    r = kit(d, "digest", "--registry", os.path.join(d, "bad.json"))
    ck("#102 the registry refuses a %s that is %s" % (field, why), r.returncode == 2, r.stdout + r.stderr)
reg_bad = json.loads(json.dumps(reg)); reg_bad["homepage"] = "javascript:alert(1)"
write(d, "bad.json", reg_bad)
ck("#102 the registry refuses a homepage that isn't http(s)",
   kit(d, "digest", "--registry", os.path.join(d, "bad.json")).returncode == 2)

# release-files: a flat folder that raw.githubusercontent.com can serve
out = os.path.join(d, "releases", "data")
os.makedirs(out); open(os.path.join(out, "stale_full.json"), "w").write("{}")
r = subprocess.run([sys.executable, FBDATA, "release-files", os.path.join(d, "dist"), "-o", out,
                    "--registry", os.path.join(d, "packs.json"), "--built-for", "1.9.0"], capture_output=True, text=True)
ck("#102 release-files succeeds", r.returncode == 0, r.stderr)
names = sorted(os.listdir(out))
ck("#102 release-files writes the manifest and every bundle, and removes stale files",
   "fieldbook-data.json" in names and "stale_full.json" not in names and all(p["file"] in names for p in man["packs"]), names)
fm = json.load(open(os.path.join(out, "fieldbook-data.json"), encoding="utf-8"))
ck("#102 the folder's sha256 values match its files",
   all(hashlib.sha256(open(os.path.join(out, p["file"]), "rb").read()).hexdigest() == p["sha256"] for p in fm["packs"]))
ck("#102 validate reads a folder", subprocess.run([sys.executable, FBDATA, "validate", out],
   capture_output=True, text=True).returncode == 0)
open(os.path.join(out, fm["packs"][0]["file"]), "a").write(" ")
r = subprocess.run([sys.executable, FBDATA, "validate", out], capture_output=True, text=True)
ck("#102 validate names a folder file whose sha256 no longer matches", r.returncode == 1 and "sha256" in r.stderr, r.stderr)
```

  If `hashlib`, `zipfile` or `fbdata` (the imported module) aren't imported at the top of the suite
  yet, add the imports. The suite imports `fbdata` as a module near its top: check how, and use the
  same name.

- [ ] **Step 2: Run them and watch them fail**

  Run: `python3 src/tests/data-kit.py | tail -5`
  Expected: FAIL lines for the `#102` checks (format is 1, there is no `release-files`, and so on).

- [ ] **Step 3: Implement.** In `tools/data-kit/fbdata.py`:

```python
HTTP_URL = re.compile(r"^https?://", re.I)
SUMMARY_MAX, DESCRIPTION_MAX = 140, 4000
APP_VER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
# The manifest's per-pack keys, in the order they are written (#102)
MANIFEST_PACK_KEYS = ("file", "category", "system", "title", "summary", "description", "version",
                      "minApp", "size", "sha256", "license", "attribution", "requires")
```

  In `check_registry`, after the attribution check inside the loop:

```python
        for k, cap in (("summary", SUMMARY_MAX), ("description", DESCRIPTION_MAX)):
            v = p.get(k)
            if v is not None and not (isinstance(v, str) and 0 < len(v) <= cap):
                raise KitError("%s.%s must be text of 1 to %s characters" % (at, k, format(cap, ",")))
        if p.get("minApp") is not None and not (isinstance(p["minApp"], str) and APP_VER.match(p["minApp"])):
            raise KitError("%s.minApp %r is not X.Y.Z" % (at, p.get("minApp")))
        if p.get("category") is not None and not (isinstance(p["category"], str) and p["category"].strip()):
            raise KitError("%s.category must be a non-empty string" % at)
```

  And before the loop, for the top level:

```python
    hp = reg.get("homepage")
    if hp is not None and not (isinstance(hp, str) and HTTP_URL.match(hp)):
        raise KitError("%s: homepage must be an http(s) URL" % where)
    nm = reg.get("name")
    if nm is not None and not (isinstance(nm, str) and 0 < len(nm) <= 120):
        raise KitError("%s: name must be text of 1 to 120 characters" % where)
```

  Split the manifest out of `cmd_pack`:

```python
def build_manifest(reg, bundles, built_for, dev):
    """The format-2 manifest (#102) and the bundles it lists, read from `bundles`.
    Shared by `pack` (into the zip) and `release-files` (into releases/data/)."""
    if not reg.get("release"):
        raise KitError("the registry has no release to name the archive")
    version = reg["release"] + ("+dev" if dev else "")
    entries, mpacks = {}, []
    for p in reg["packs"]:
        src = os.path.join(bundles, p["file"])
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
        req = []
        for r in obj.get("requires") or []:
            if isinstance(r, dict) and isinstance(r.get("pack"), str) and r["pack"].strip():
                one = {"pack": r["pack"]}
                if isinstance(r.get("file"), str):
                    one["file"] = r["file"]
                if isinstance(r.get("url"), str) and HTTP_URL.match(r["url"]):
                    one["url"] = r["url"]
                if one not in req:
                    req.append(one)
        m = {"file": p["file"], "category": p.get("category") or "rules", "system": p["system"],
             "title": p["title"]}
        for k in ("summary", "description", "version", "minApp"):
            if p.get(k):
                m[k] = p[k]
        m["size"] = len(raw)
        m["sha256"] = hashlib.sha256(raw).hexdigest()
        for k in ("license", "attribution"):
            if p.get(k):
                m[k] = p[k]
        if req:
            m["requires"] = req
        mpacks.append(dict((k, m[k]) for k in MANIFEST_PACK_KEYS if k in m))
        entries[p["file"]] = raw
    if not mpacks:
        raise KitError("none of the registry's bundles is in %s — bundle first" % bundles)
    manifest = {"_type": "fieldbook-data", "format": 2}
    for k in ("name", "homepage"):
        if reg.get(k):
            manifest[k] = reg[k]
    manifest.update({"version": version, "builtFor": built_for, "packs": mpacks})
    return manifest, entries
```

  `cmd_pack` then calls it:

```python
def cmd_pack(a):
    """The archive (spec §6): every registered bundle found in a.bundles, a
    manifest and NOTICE.md; entries sorted, fixed timestamps, deflate level 9,
    so two runs with one zlib write the same bytes."""
    reg = load_registry(a.registry)
    built_for = a.built_for if a.built_for is not None else app_version()
    manifest, entries = build_manifest(reg, a.bundles, built_for, a.dev)
    version = manifest["version"]
    entries[MANIFEST] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    entries[NOTICE] = notice_md(reg, manifest["packs"], version, built_for).encode("utf-8")
    tmp = a.output + ".tmp"
    with zipfile.ZipFile(tmp, "w") as z:
        for name in sorted(entries):
            z.writestr(_zinfo(name), entries[name], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    os.replace(tmp, a.output)
    n = len(manifest["packs"])
    print("wrote %s (%d pack%s, data %s)" % (a.output, n, "" if n == 1 else "s", version), file=sys.stderr)
    return 0


def cmd_release_files(a):
    """The official source's files (#102): the manifest and every bundle, flat,
    for the release commit — raw.githubusercontent.com serves them at the tag."""
    reg = load_registry(a.registry)
    built_for = a.built_for if a.built_for is not None else app_version()
    manifest, entries = build_manifest(reg, a.bundles, built_for, False)
    os.makedirs(a.output, exist_ok=True)
    for n in os.listdir(a.output):
        if n.endswith(".json"):
            os.remove(os.path.join(a.output, n))
    for name, raw in entries.items():
        with open(os.path.join(a.output, name), "wb") as f:
            f.write(raw)
    with open(os.path.join(a.output, MANIFEST), "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    errs = validate_archive(a.output, public=True)
    for e in errs:
        print("%s: %s" % (a.output, e), file=sys.stderr)
    if errs:
        return 1
    print("wrote %s (%d packs, data %s)" % (a.output, len(manifest["packs"]), manifest["version"]), file=sys.stderr)
    return 0
```

  Make `validate_archive(path, public=False)` read either source. At its top:

```python
    if os.path.isdir(path):
        names = sorted(n for n in os.listdir(path) if os.path.isfile(os.path.join(path, n)))
        def read(n):
            with open(os.path.join(path, n), "rb") as f:
                return f.read()
        return _validate_entries(names, read, public)
    try:
        z = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as e:
        return ["not a readable zip: %s" % e]
    with z:
        return _validate_entries([i.filename for i in z.infolist()], z.read, public)
```

  Move the existing body (from `errs = []` on) into
  `_validate_entries(names, read, public)`, replacing `z.read(...)` with `read(...)` and
  `zipfile.BadZipFile` catches with `(zipfile.BadZipFile, OSError)`. Inside it:
  - accept format 1 or 2: `man.get("format") not in (1, 2)`, with the message `'%s: _type must be "fieldbook-data" and format 1 or 2'`;
  - for format 2, check each pack, appending one line per problem:

```python
            if man.get("format") == 2:
                for k, cap in (("summary", SUMMARY_MAX), ("description", DESCRIPTION_MAX)):
                    v = m.get(k)
                    if v is not None and not (isinstance(v, str) and len(v) <= cap):
                        errs.append("%s: %s is over %s characters" % (f, k, format(cap, ",")))
                if m.get("minApp") is not None and not (isinstance(m["minApp"], str) and APP_VER.match(m["minApp"])):
                    errs.append("%s: minApp %r is not X.Y.Z" % (f, m.get("minApp")))
                if m.get("size") is not None and m.get("size") != len(raw):
                    errs.append("%s: size %r, the file is %d bytes" % (f, m.get("size"), len(raw)))
```

  Also refuse an unsafe `file` before reading it:
  `if f.startswith("/") or "\\" in f or ".." in f.split("/"): errs.append("an unsafe path: %s" % f); continue`.

  In `main`, add:

```python
    p = sub.add_parser("release-files", help="write releases/data/: the manifest and every bundle (#102)")
    p.add_argument("bundles", help="the folder holding the bundles (dist/)")
    p.add_argument("-o", "--output", required=True, help="the folder to write (releases/data)")
    p.add_argument("--registry", default=DEFAULT_REGISTRY, help="default: data/packs.json")
    p.add_argument("--built-for", default=None, help="the app version it is for (default: APP_VERSION)")
    p.set_defaults(fn=cmd_release_files)
```

  Change the `validate` help to "check an archive or a releases/data folder; exit 1 with one line per problem".

  In `data/packs.json`:
  - add `"name": "Fieldbook public data"` and `"homepage": "https://github.com/wardmanm/RPGFieldbook"` after `"release"`;
  - give each pack a `summary` and a `description` after `attribution`, exactly:
    - **SRD 5.2** summary: `"The free D&D rules: classes, species, backgrounds, feats, spells, items and more."`
    - **SRD 5.2** description: `"The System Reference Document 5.2.1 is the part of the 2024 D&D rules that Wizards of the Coast publishes for free, under Creative Commons.\n\nIt has every class with one subclass each, the core species and backgrounds, origin and general feats, hundreds of spells, and the equipment and magic items to go with them. Fieldbook's character building, spells and inventory all work from it."`
    - **Homebrew** summary: `"Hand-picked extra options, starting with The Predator, a warlock subclass."`
    - **Homebrew** description: `"Options from outside the official books, picked and converted by hand.\n\nIt starts with The Predator, a Warlock subclass from D&D Wiki, used under CC BY-SA 3.0. It needs SRD 5.2 for the Warlock class and the spells it refers to."`
  - Use `json.dumps` style, 2-space indent and LF, as `write_registry` writes it.

  Then run `python3 tools/data-kit/fbdata.py versions --check` and confirm it exits 0: no digest
  moved.

- [ ] **Step 4: Run the tests**

  Run: `python3 src/tests/data-kit.py | tail -3`
  Expected: `ALL PASSED`. Any older test pinning the manifest's exact text, its `format: 1` or its
  key order, fails now: update it to format 2 and say so in the report. Those are the "pinned
  output" checks near `pack`.

  Run: `node src/tests/data-archive.js | grep -E "^FAIL|ALL PASSED"`
  Expected: `ALL PASSED`. The app reads format 2, since `readDataArchive` doesn't check `format`.

- [ ] **Step 5: Commit**

```bash
git add tools/data-kit/fbdata.py data/packs.json src/tests/data-kit.py
git commit -m "feat(#102): the data kit writes the format-2 manifest and release-files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Releases commit `releases/data/`, and CI checks it

**Files:**
- Modify: `build.sh`, in `pack_archive()` (~:96–:120) or right after its call on the release path.
- Modify: `scripts/data-release.js` (~:123–:137).
- Modify: `.github/workflows/release.yml` and `.github/workflows/data-release.yml`, each gaining a
  step after the build.
- Modify: `src/docs/RELEASING.md`, where it shows the data-release commands (~:200) and in the app
  release section.
- Test: `src/tests/data-kit.py` (script checks).

**Interfaces:**
- Consumes: `fbdata.py release-files` and `validate <folder>` (Task 1).
- Produces: at every app or public data release tag, `releases/data/fieldbook-data.json` plus the
  built bundles, byte-identical to that release's zip contents. Task 4's official source reads
  `https://raw.githubusercontent.com/<UPDATE_REPO>/<tag>/releases/data/fieldbook-data.json`.

- [ ] **Step 1: Write the failing tests** at the end of `src/tests/data-kit.py`:

```python
# ---------- #102: the release paths write releases/data/
build_sh = open(os.path.join(ROOT, "build.sh"), encoding="utf-8").read()
ck("#102 build.sh writes releases/data on a release build only",
   re.search(r'if \[ -n "\$RELEASE" \][^\n]*\n[^\n]*release-files dist -o releases/data', build_sh) is not None)
dr = open(os.path.join(ROOT, "scripts", "data-release.js"), encoding="utf-8").read()
ck("#102 data-release.js bundles and writes releases/data for the public registry",
   '"release-files"' in dr and "releases/data" in dr and "if (!PRIVATE)" in dr)
ck("#102 data-release.js tells you to commit releases/data", "git add data/packs.json releases/data" in dr)
for wf in ("release.yml", "data-release.yml"):
    t = open(os.path.join(ROOT, ".github", "workflows", wf), encoding="utf-8").read()
    ck("#102 %s checks releases/data against the build" % wf,
       "fbdata.py validate --public releases/data" in t and 'cmp "releases/data/' in t)
```

  If `ROOT` and `re` aren't defined in the suite, define `ROOT` the way the suite finds `FBDATA` and
  import `re`.

- [ ] **Step 2: Run them and watch them fail**

  Run: `python3 src/tests/data-kit.py | tail -3`
  Expected: FAIL on the four `#102` release checks.

- [ ] **Step 3: Implement.**

  `build.sh`: at the end of `pack_archive()`, after the validate line:

```bash
  # #102: the official source's files, committed with the release so
  # raw.githubusercontent.com serves them at the tag. Only a real release
  # writes them: a +dev archive is not that release's data.
  if [ -n "$RELEASE" ] && [ -z "$suf" ]; then
    "$py" tools/data-kit/fbdata.py release-files dist -o releases/data || {
      echo "    releases/data failed validation"; exit 1; }
  fi
```

  Check that `RELEASE` is set globally before `pack_archive` runs; it is parsed at the top (:34). If
  it isn't visible there, pass it as a parameter.

  `scripts/data-release.js`, after `fbdata(["versions", "--bump", next, ...fbArgs]);`:

```js
// #102: the official source's files at this tag. Bundled from the bumped
// registry into a scratch folder, then written flat to releases/data/ — what
// raw.githubusercontent.com serves the app. A private registry has no public
// raw URL, so it gets none.
if (!PRIVATE) {
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "fb-data-release-"));
  fbdata(["bundle", "-o", tmp]);
  fbdata(["release-files", tmp, "-o", path.join(ROOT, "releases", "data")]);
}
```

  In the public `console.log` block, change `"    git add data/packs.json"` to
  `"    git add data/packs.json releases/data"`.

  `.github/workflows/release.yml`: after the **Build** step, add:

```yaml
      - name: releases/data matches this build (#102)
        run: |
          python3 tools/data-kit/fbdata.py validate --public releases/data
          for f in releases/data/*_full.json; do
            cmp "releases/data/$(basename "$f")" "dist/$(basename "$f")" || {
              echo "::error::releases/data/$(basename "$f") differs from the build — re-run the release so the commit carries this build's data"; exit 1; }
          done
          V="$(node -e 'process.stdout.write(require("./data/packs.json").release)')"
          node -e 'const m=require("./releases/data/fieldbook-data.json");if(m.version!==process.argv[1]){console.error("::error::releases/data is data "+m.version+", the tag is "+process.argv[1]);process.exit(1)}' "$V"
```

  Add the same step to `.github/workflows/data-release.yml`, after **Build the archive**.

  `src/docs/RELEASING.md`: in the data release commands, change `git add data/packs.json` to
  `git add data/packs.json releases/data`. In the app release section, add one sentence:
  "`./build.sh --release` also writes `releases/data/` (the official source's manifest and packs,
  #102); `git add -A` takes it, and CI checks it matches the build."

- [ ] **Step 4: Run the tests**

  Run: `python3 src/tests/data-kit.py | tail -3`
  Expected: `ALL PASSED`.

  Then run `bash -n build.sh` and `node --check scripts/data-release.js`. Both must print nothing.

  Do **not** run `./build.sh --release` or `node scripts/data-release.js` without `--dry-run`: those
  cut a release. `node scripts/data-release.js --dry-run` is safe; run it and paste its output.

- [ ] **Step 5: Commit**

```bash
git add build.sh scripts/data-release.js .github/workflows/release.yml .github/workflows/data-release.yml src/docs/RELEASING.md src/tests/data-kit.py
git commit -m "feat(#102): releases commit releases/data/, and CI checks it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The core: SHA-256, manifests, sources, offers and update counts

**Files:**
- Create: `src/js/89-extensions.js`.
- Modify: `src/manifest.json` (after `89-rules-merge.js`), `CLAUDE.md` (the JS count 37 → 38),
  `src/docs/ADR-001-source-split.md` (the same count), `src/docs/wiki/overview.md` (a code-map row),
  `src/docs/wiki/architecture/rules-packs.md` (cite the fragment in its header's code list).
- Modify: `src/js/00-constants.js:117`, the `settings` defaults:
  `sources:[],packOrigin:{},dismissedUpdates:{}`.
- Modify: `src/js/88-settings.js`:
  - `SETTINGS_KEYS` (:280): add `"sources","packOrigin","dismissedUpdates"` and keep `"rulesSources","rulesUrl"` so old files are read;
  - `foldLegacySettings()` (:284): call `convertSources(settings)`.
- Test: `src/tests/data-archive.js`, in new sections above its marker line, with the names added to
  its `loadApp` list.

**Interfaces:**
- Produces, with exact signatures:
  - `sha256Hex(bytes: Uint8Array) -> string`: 64 lowercase hex characters.
  - `extUrl(u) -> string`: the URL if it is http(s), else `""`.
  - `extRelPath(p) -> string`: a safe relative path, or `""`.
  - `extEntry(p, builtFor) -> entry|null`, where entry is
    `{path, file, system, category, title, summary, description, version, minApp, sha256, size, license, attribution, requires:[{pack,file,url}]}`.
  - `readManifest(obj, byteLength) -> {name, homepage, version, builtFor, packs:[entry]}`, which
    throws `Error(reason)`.
  - `extKey(system, file) -> "system|file"`.
  - `extTooNew(entry) -> boolean`.
  - `convertSources(s) -> boolean` (changed).
  - `extOffers() -> [{entry, source}]`: enabled sources only.
  - `availableFor(system, file) -> {entry, source}|null`.
  - `extPackRows() -> [row]`, where row is `{key, group|null, offer|null, state}` and state is one of
    `"update"`, `"install"`, `"blocked"`, `"current"`, `"none"` or `"unsupported"`.
  - `extUpdateRows() -> [row]`: state `"update"`.
  - `extPillCount() -> number`: updates not dismissed.
  - `dismissUpdates()`.
  - `EXT_CATS = ["rules"]`, `EXT_SUMMARY_MAX = 140`, `EXT_DESC_MAX = 4000`, `EXT_MAN_MAX = 65536`,
    `EXT_PACKS_MAX = 1000`, `EXT_FILE_MAX = 33554432`, `EXT_CHECK_MS = 10000`,
    `EXT_FILE_MS = 30000`.
  - A source is `{id, kind:"official"|"manifest"|"plain", url, on, checked, error, manifest, base}`.
    `base` is the URL the manifest was read from, so relative paths resolve against it. The official
    source's `id` is `"official"`.

- [ ] **Step 1: Write the failing tests.** Add to `data-archive.js`'s `loadApp` list:
  `'sha256Hex','extUrl','extRelPath','extEntry','readManifest','extKey','extTooNew','convertSources','extOffers','availableFor','extPackRows','extUpdateRows','extPillCount','dismissUpdates','settings','EXT_CATS','foldLegacySettings'`.
  If `settings` can't be written through `X`, use `X.settings.x = …` mutations only, which work
  through the getter. Then add these sections above the marker line:

```js
// ---------- #102: sha256Hex
section('#102 sha256Hex', () => {
  const crypto = require('crypto');
  const hex = b => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
  const big = new Uint8Array(1024 * 1024); for (let i = 0; i < big.length; i++) big[i] = (i * 31 + 7) & 255;
  [[], [0x61, 0x62, 0x63], Array.from({length: 55}, () => 0x61), Array.from({length: 56}, () => 0x61), Array.from({length: 64}, () => 0x62)]
    .forEach(a => ck('#102 sha256Hex of ' + a.length + ' bytes matches Node', X.sha256Hex(new Uint8Array(a)) === hex(a)));
  ck('#102 sha256Hex of 1 MB matches Node', X.sha256Hex(big) === hex(big));
  ck('#102 sha256Hex reads a view at an offset', X.sha256Hex(new Uint8Array(big.buffer, 10, 100)) === hex(big.subarray(10, 110)));
});

// ---------- #102: reading a manifest
section('#102 readManifest', () => {
  const pk = o => Object.assign({file: 'srd52_full.json', system: 'SRD 5.2', version: '1.9.0', sha256: 'a'.repeat(64)}, o);
  const m = X.readManifest({_type: 'fieldbook-data', format: 2, name: 'N', homepage: 'https://x.org', version: '1.9.0', builtFor: '1.9.0',
    packs: [pk({title: 'SRD', summary: 's'.repeat(500), description: 'd'.repeat(9000), requires: [{pack: 'X', url: 'javascript:alert(1)'}, {pack: 'Y', url: 'https://y.org'}]})]}, 900);
  const e = m.packs[0];
  ck('#102 a format-2 manifest reads', m.name === 'N' && m.homepage === 'https://x.org' && e.system === 'SRD 5.2' && e.file === 'srd52_full.json', m);
  ck('#102 category defaults to rules, minApp to builtFor', e.category === 'rules' && e.minApp === '1.9.0');
  ck('#102 summary is cut to 140 and description to 4,000', e.summary.length === 140 && e.description.length === 4000);
  ck('#102 a requires url that isn\'t http(s) becomes ""', e.requires[0].url === '' && e.requires[1].url === 'https://y.org', e.requires);
  const m1 = X.readManifest({_type: 'fieldbook-data', format: 1, version: '1.8.1', builtFor: '1.8.1', packs: [{file: 'a_full.json', system: 'A', version: '1.8.0', sha256: 'b'.repeat(64)}]}, 200);
  ck('#102 a format-1 manifest (today\'s zip) reads with defaults', m1.packs[0].title === 'A' && m1.packs[0].minApp === '1.8.1' && m1.packs[0].summary === '');
  ck('#102 a homepage that isn\'t http(s) becomes ""', X.readManifest({_type: 'fieldbook-data', homepage: 'javascript:x', packs: []}, 50).homepage === '');
  ['../x_full.json', '/abs_full.json', 'https://evil.org/x_full.json', 'a\\b_full.json', 'dir/../x_full.json', 'x.txt', '']
    .forEach(f => ck('#102 an unsafe or non-json path is dropped: ' + JSON.stringify(f),
      X.readManifest({_type: 'fieldbook-data', packs: [pk({file: f})]}, 100).packs.length === 0));
  ck('#102 a path in a folder keeps its base name as the file',
    X.readManifest({_type: 'fieldbook-data', packs: [pk({file: 'packs/srd52_full.json'})]}, 100).packs[0].file === 'srd52_full.json');
  ck('#102 a pack with no version is dropped', X.readManifest({_type: 'fieldbook-data', packs: [pk({version: 'x'})]}, 100).packs.length === 0);
  const dup = X.readManifest({_type: 'fieldbook-data', packs: [pk({version: '1.8.0'}), pk({version: '1.9.0'}), pk({version: '1.8.5'})]}, 100);
  ck('#102 the same system|file twice keeps the newest', dup.packs.length === 1 && dup.packs[0].version === '1.9.0');
  const thrown = (o, n) => { try { X.readManifest(o, n); return ''; } catch (e) { return e.message; } };
  ck('#102 not a manifest throws', /isn't a Fieldbook manifest/.test(thrown({packs: []}, 10)));
  ck('#102 over 64 KB throws', /larger than 64 KB/.test(thrown({_type: 'fieldbook-data', packs: []}, 65537)));
  ck('#102 over 1,000 packs throws', /more than 1,000/.test(thrown({_type: 'fieldbook-data', packs: Array.from({length: 1001}, () => pk({}))}, 100)));
  ck('#102 extUrl keeps http(s) only', X.extUrl('https://a') === 'https://a' && X.extUrl('HTTP://a') === 'HTTP://a' && X.extUrl('javascript:x') === '' && X.extUrl(7) === '');
});

// ---------- #102: settings conversion
section('#102 convertSources', () => {
  const s = {rulesSources: ['https://a.org/x.json', ' https://b.org/y.json '], rulesUrl: 'https://c.org/z.json'};
  ck('#102 the first conversion reports a change', X.convertSources(s) === true);
  ck('#102 the official source exists once, first, on', s.sources.filter(x => x.kind === 'official').length === 1 && s.sources[0].id === 'official' && s.sources[0].on === true, s.sources);
  ck('#102 rulesSources and rulesUrl become plain sources, trimmed',
    JSON.stringify(s.sources.filter(x => x.kind === 'plain').map(x => x.url)) === JSON.stringify(['https://a.org/x.json', 'https://b.org/y.json', 'https://c.org/z.json']));
  ck('#102 the old fields are gone', !('rulesSources' in s) && !('rulesUrl' in s));
  ck('#102 packOrigin and dismissedUpdates default to {}', JSON.stringify(s.packOrigin) === '{}' && JSON.stringify(s.dismissedUpdates) === '{}');
  const before = JSON.stringify(s);
  ck('#102 a second conversion changes nothing', X.convertSources(s) === false && JSON.stringify(s) === before);
  const junk = {sources: [null, {kind: 'weird'}, {kind: 'manifest', url: 'javascript:x'}, {kind: 'official'}, {kind: 'official'}]};
  X.convertSources(junk);
  ck('#102 malformed sources are dropped, and two officials become one', junk.sources.length === 1 && junk.sources[0].kind === 'official', junk.sources);
});

// ---------- #102: offers, row states, the pill count and dismissal
section('#102 offers and rows', () => {
  X.resetRules();
  const loadPack = (system, file, ver) => X.importPack({system, dataVersion: ver, spells: [{name: system + ' Spell', level: 1}]}, file);
  loadPack('SRD 5.2', 'srd52_full.json', '1.8.1');
  loadPack('Homebrew', 'homebrew_full.json', '1.2.0');
  const man = (packs, extra) => X.readManifest(Object.assign({_type: 'fieldbook-data', builtFor: '1.0.0', packs}, extra || {}), 100);
  const e = (system, file, version, o) => Object.assign({file, system, version, sha256: 'c'.repeat(64)}, o || {});
  X.settings.sources = [
    {id: 'official', kind: 'official', url: '', on: true, checked: 1, error: '', base: 'https://raw.example/fieldbook-data.json',
      manifest: man([e('SRD 5.2', 'srd52_full.json', '1.9.0'), e('Homebrew', 'homebrew_full.json', '1.2.0')])},
    {id: 's2', kind: 'manifest', url: 'https://ember.example/m.json', on: true, checked: 1, error: '', base: 'https://ember.example/m.json',
      manifest: man([e('Ember', 'ember_full.json', '2.1.0', {minApp: '99.0.0'}), e('Ember Theme', 'ember_ui.json', '1.0.0', {category: 'ui'}),
                     e('SRD 5.2', 'srd52_full.json', '1.9.5')])},
    {id: 's3', kind: 'manifest', url: 'https://off.example/m.json', on: false, checked: 1, error: '', base: 'https://off.example/m.json',
      manifest: man([e('Off', 'off_full.json', '1.0.0')])}];
  X.settings.packOrigin = {'SRD 5.2|srd52_full.json': 'official'};
  X.settings.dismissedUpdates = {};
  ck('#102 offers come from enabled sources only', !X.extOffers().some(o => o.entry.system === 'Off'));
  ck('#102 the installing source wins over a newer offer elsewhere', X.availableFor('SRD 5.2', 'srd52_full.json').source.id === 'official');
  X.settings.packOrigin = {};
  ck('#102 with no installing source, the newest offer wins', X.availableFor('SRD 5.2', 'srd52_full.json').entry.version === '1.9.5');
  X.settings.packOrigin = {'SRD 5.2|srd52_full.json': 'official'};
  const rows = X.extPackRows(), by = k => rows.find(r => r.key === k);
  ck('#102 a newer offer is an update', by('SRD 5.2|srd52_full.json').state === 'update');
  ck('#102 the same version is current', by('Homebrew|homebrew_full.json').state === 'current');
  ck('#102 an offer too new for this app is blocked', by('Ember|ember_full.json').state === 'blocked' && X.extTooNew(by('Ember|ember_full.json').offer.entry));
  ck('#102 an unknown category is unsupported', by('Ember Theme|ember_ui.json').state === 'unsupported');
  ck('#102 the pill counts updates', X.extPillCount() === 1 && X.extUpdateRows().length === 1);
  X.dismissUpdates();
  ck('#102 dismissal: the pill hides, the update stays on the row', X.extPillCount() === 0 && X.extUpdateRows().length === 1);
  X.settings.sources[0].manifest = man([e('SRD 5.2', 'srd52_full.json', '1.9.0')]);
  ck('#102 dismissal: the same version never brings it back', X.extPillCount() === 0);
  X.settings.sources[0].manifest = man([e('SRD 5.2', 'srd52_full.json', '1.9.1')]);
  ck('#102 dismissal: a newer version brings it back', X.extPillCount() === 1);
  X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {}; X.settings.dismissedUpdates = {};
});
```

- [ ] **Step 2: Run them and watch them fail**

  Run: `node src/tests/data-archive.js | grep -E "^FAIL|LOAD FAIL|ALL PASSED" | head`
  Expected: `LOAD FAIL` or `FAIL` because the names don't exist yet.

- [ ] **Step 3: Implement.** Create `src/js/89-extensions.js`:

```js
/* ================= extensions: manifests, sources, the install pipeline (#102) =================
   A manifest is the data zip's own fieldbook-data.json, extended (format 2):
   packs with a version, sha256, category, minimum app and descriptions, at
   paths relative to the manifest. Sources are where manifests come from: the
   built-in official source (the release tag on raw.githubusercontent.com),
   manifest URLs, and old-style plain URLs (fetchAllRules()). Every way of
   installing builds candidates, then one plan, one confirm, one all-or-nothing
   install. Spec: src/docs/specs/2026-10-26-extensions-manifest-design.md */
const EXT_CATS=["rules"];
const EXT_SUMMARY_MAX=140,EXT_DESC_MAX=4000,EXT_MAN_MAX=65536,EXT_PACKS_MAX=1000,EXT_FILE_MAX=33554432;
const EXT_CHECK_MS=10000,EXT_FILE_MS=30000;
/* ---- SHA-256, in JavaScript: whether a file:// page may use crypto.subtle
   differs by browser, and the suites check this against Node's crypto ---- */
const SHA256_K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256Hex(bytes){
  const src=bytes instanceof Uint8Array?bytes:new Uint8Array(0),len=src.length;
  const total=((len+9+63)>>6)<<6,m=new Uint8Array(total);
  m.set(src);m[len]=0x80;
  const dv=new DataView(m.buffer);
  dv.setUint32(total-8,Math.floor(len/0x20000000));dv.setUint32(total-4,(len*8)>>>0);
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const W=new Uint32Array(64),rot=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let off=0;off<total;off+=64){
    for(let i=0;i<16;i++)W[i]=dv.getUint32(off+i*4);
    for(let i=16;i<64;i++){
      const s0=rot(W[i-15],7)^rot(W[i-15],18)^(W[i-15]>>>3),s1=rot(W[i-2],17)^rot(W[i-2],19)^(W[i-2]>>>10);
      W[i]=(W[i-16]+s0+W[i-7]+s1)>>>0;
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(let i=0;i<64;i++){
      const t1=(h+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+SHA256_K[i]+W[i])>>>0;
      const t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  return H.map(x=>x.toString(16).padStart(8,"0")).join("");
}
/* ---- reading a manifest ---- */
function extUrl(u){return typeof u==="string"&&/^https?:\/\//i.test(u)?u:"";}
function extText(s,max){return typeof s==="string"?s.slice(0,max):"";}
/* a path relative to the manifest: never absolute, never up, never a URL */
function extRelPath(p){
  const s=typeof p==="string"?p:"";
  if(!s||s.startsWith("/")||s.includes("\\")||/^[a-z][a-z0-9+.-]*:/i.test(s))return "";
  return s.split("/").some(x=>x===""||x==="."||x==="..")?"":s;
}
function extKey(system,file){return String(system)+"|"+String(file);}
/* one pack of a manifest, normalised, or null when it can't be installed from */
function extEntry(p,builtFor){
  if(!p||typeof p!=="object")return null;
  const path=extRelPath(p.file),file=path.split("/").pop(),system=typeof p.system==="string"?p.system.trim():"";
  if(!path||!system||!/^[A-Za-z0-9._-]+\.json$/.test(file)||!parseDataVer(p.version))return null;
  const app=v=>typeof v==="string"&&/^\d+\.\d+\.\d+$/.test(v)?v:"";
  return {path,file,system,
    category:typeof p.category==="string"&&p.category.trim()?p.category.trim():"rules",
    title:extText(p.title,200)||system,summary:extText(p.summary,EXT_SUMMARY_MAX),description:extText(p.description,EXT_DESC_MAX),
    version:p.version,minApp:app(p.minApp)||app(builtFor),
    sha256:/^[0-9a-f]{64}$/.test(String(p.sha256||""))?p.sha256:"",size:Math.max(0,num(p.size)),
    license:extText(p.license,64),attribution:extText(p.attribution,2000),
    requires:(Array.isArray(p.requires)?p.requires:[]).filter(r=>r&&typeof r==="object"&&typeof r.pack==="string"&&r.pack.trim())
      .slice(0,50).map(r=>({pack:r.pack.trim(),file:typeof r.file==="string"?r.file:"",url:extUrl(r.url)}))};
}
function readManifest(obj,byteLength){
  if(num(byteLength)>EXT_MAN_MAX)throw new Error("the manifest is larger than 64 KB");
  if(!obj||typeof obj!=="object"||Array.isArray(obj)||obj._type!=="fieldbook-data"||!Array.isArray(obj.packs))
    throw new Error("it isn't a Fieldbook manifest");
  if(obj.packs.length>EXT_PACKS_MAX)throw new Error("it lists more than 1,000 packs");
  const builtFor=typeof obj.builtFor==="string"?obj.builtFor:"",byKey=new Map();
  obj.packs.forEach(p=>{
    const e=extEntry(p,builtFor);if(!e)return;
    const k=extKey(e.system,e.file),ex=byKey.get(k);
    if(!ex||cmpDataVer(e.version,ex.version)>0)byKey.set(k,e);
  });
  return {name:extText(obj.name,120),homepage:extUrl(obj.homepage),version:typeof obj.version==="string"?obj.version:"",builtFor,packs:[...byKey.values()]};
}
/* a pack this app is too old for (spec decision 3) */
function extTooNew(e){return !!(e&&e.minApp)&&cmpDataVer(e.minApp,APP_VERSION)>0;}
/* ---- sources (spec §4) ---- */
function extOfficial(){return {id:"official",kind:"official",url:"",on:true,checked:0,error:"",manifest:null,base:""};}
/* settings.rulesSources and the legacy rulesUrl -> settings.sources, once; the
   official source exactly once. True when anything changed. */
function convertSources(s){
  const before=JSON.stringify([s.sources,s.packOrigin,s.dismissedUpdates,s.rulesSources,s.rulesUrl]);
  const isObj=o=>!!o&&typeof o==="object"&&!Array.isArray(o);
  let list=(Array.isArray(s.sources)?s.sources:[]).filter(x=>isObj(x)&&(
    x.kind==="official"||(x.kind==="manifest"&&extUrl(x.url))||(x.kind==="plain"&&typeof x.url==="string"&&x.url.trim())));
  let off=list.find(x=>x.kind==="official");
  list=list.filter(x=>x.kind!=="official");
  off=Object.assign(extOfficial(),off||{},{id:"official",kind:"official",url:""});
  const old=[].concat(Array.isArray(s.rulesSources)?s.rulesSources:[],s.rulesUrl?[s.rulesUrl]:[])
    .map(u=>String(u||"").trim()).filter(Boolean);
  old.forEach(u=>{if(!list.some(x=>x.url===u))list.push({id:uid(),kind:"plain",url:u,on:true,checked:0,error:"",manifest:null,base:""});});
  s.sources=[off].concat(list);
  delete s.rulesSources;delete s.rulesUrl;
  if(!isObj(s.packOrigin))s.packOrigin={};
  if(!isObj(s.dismissedUpdates))s.dismissedUpdates={};
  return JSON.stringify([s.sources,s.packOrigin,s.dismissedUpdates,s.rulesSources,s.rulesUrl])!==before;
}
/* ---- offers and rows ---- */
function extOffers(){
  const out=[];
  (settings.sources||[]).forEach(src=>{
    if(!src.on||!src.manifest||!Array.isArray(src.manifest.packs))return;
    src.manifest.packs.forEach(entry=>out.push({entry,source:src}));
  });
  return out;
}
/* the offer for one pack: the source that installed it, if it still offers it;
   otherwise the newest; on a tie, the official source */
function availableFor(system,file){
  const all=extOffers().filter(o=>o.entry.system===system&&o.entry.file===file);
  if(!all.length)return null;
  const origin=(settings.packOrigin||{})[extKey(system,file)];
  const own=all.find(o=>o.source.id===origin);if(own)return own;
  return all.slice().sort((a,b)=>cmpDataVer(b.entry.version,a.entry.version)||((b.source.kind==="official")-(a.source.kind==="official")))[0];
}
function extRowState(group,offer){
  if(offer&&EXT_CATS.indexOf(offer.entry.category)<0)return "unsupported";
  if(!group)return offer?(extTooNew(offer.entry)?"blocked":"install"):"none";
  if(!offer)return "none";
  const have=group.dataVersion;
  if(parseDataVer(have)&&cmpDataVer(offer.entry.version,have)<=0)return "current";
  return extTooNew(offer.entry)?"blocked":"update";
}
/* one row per loaded pack, then one per offered pack that isn't loaded */
function extPackRows(){
  const rows=[],seen=new Set();
  loadedRulesGroups().forEach(g=>{
    const key=g.isFile?extKey(g.source,g.label):g.key;seen.add(key);
    const offer=g.isFile?availableFor(g.source,g.label):null;
    rows.push({key,group:g,offer,state:extRowState(g,offer)});
  });
  extOffers().forEach(o=>{
    const key=extKey(o.entry.system,o.entry.file);if(seen.has(key))return;seen.add(key);
    const offer=availableFor(o.entry.system,o.entry.file);
    rows.push({key,group:null,offer,state:extRowState(null,offer)});
  });
  return rows;
}
function extUpdateRows(){return extPackRows().filter(r=>r.state==="update");}
/* the pill's count: updates newer than the version the player cleared (spec decision 9) */
function extPillCount(){
  const d=settings.dismissedUpdates||{};
  return extUpdateRows().filter(r=>!d[r.key]||cmpDataVer(r.offer.entry.version,d[r.key])>0).length;
}
function dismissUpdates(){
  if(!settings.dismissedUpdates||typeof settings.dismissedUpdates!=="object")settings.dismissedUpdates={};
  extUpdateRows().forEach(r=>{settings.dismissedUpdates[r.key]=r.offer.entry.version;});
}
```

  In `00-constants.js:117`, add `sources:[],packOrigin:{},dismissedUpdates:{}` to the literal and
  remove `rulesSources:[]`. Then grep for `settings.rulesSources` in `src/js`. Task 4 rewrites
  `fetchAllRules`'s read; until then `fetchAllRules` reads `settings.rulesSources||[]`, which is
  safe.

  `88-settings.js` `foldLegacySettings()` becomes:

```js
function foldLegacySettings(){return convertSources(settings);}
```

  Keep its comment, updated to say it now converts the sources list (#102).

  Wire the fragment in:
  - `src/manifest.json`: add `"src/js/89-extensions.js",` after `"src/js/89-rules-merge.js",`.
  - `CLAUDE.md`: `js/*.js                37 fragments` becomes 38.
  - `src/docs/ADR-001-source-split.md`: the same count.
  - `src/docs/wiki/overview.md`: a code-map row for `89-extensions.js`: "Extensions (#102): manifests, sources, the install pipeline, the Extensions page".
  - `src/docs/wiki/architecture/rules-packs.md`: add `89-extensions.js` to its header's code list.

- [ ] **Step 4: Run the tests**

  Run: `node src/tests/data-archive.js | grep -E "^FAIL|LOAD FAIL|ALL PASSED"`
  Expected: `ALL PASSED`.

  Run: `node src/tests/docs.js | grep -E "^FAIL|ALL PASSED"`
  Expected: `ALL PASSED`, with the fragment count, code map and citation all in place.

  Run: `node src/tests/rules-data.js | grep -E "^FAIL|ALL PASSED"`
  Expected: `ALL PASSED`. If the fetch-all tests fail because `settings.rulesSources` is no longer a
  default, leave them for Task 4, which rewrites them. Say so in the report.

- [ ] **Step 5: Commit**

```bash
git add src/js/89-extensions.js src/manifest.json src/js/00-constants.js src/js/88-settings.js CLAUDE.md src/docs/ADR-001-source-split.md src/docs/wiki/overview.md src/docs/wiki/architecture/rules-packs.md src/tests/data-archive.js
git commit -m "feat(#102): the extensions core — sha256, manifests, sources, offers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Checking sources, candidates, the plan and the install

**Files:**
- Modify: `src/js/89-extensions.js`, appending to it.
- Modify: `src/js/89-zip.js`, in `readDataArchive()` (:189–:252): each pack carries the manifest
  entry it came with.
- Modify: `src/js/89-rules-merge.js`, in `fetchAllRules()` (:443–:490): it reads plain sources from
  `settings.sources` and takes an optional list of URLs.
- Modify: `src/js/90-boot.js:401`: after `checkForUpdate();checkForDataUpdate();`, add
  `checkSources({boot:true});`.
- Test: `src/tests/data-archive.js` for the new sections, and `src/tests/rules-data.js`, where the
  fetch-all tests (:3000–:3215) set `X.settings.sources` instead of `X.settings.rulesSources`.

**Interfaces:**
- Consumes: everything Task 3 produced; `pickDataRelease`, `UPDATE_REPO`, `utf8Text`, `importPack`,
  `srcLabel`, `isRulesPack`, `loadedRulesGroups`, `saveRulesCache` (a Promise of an error string,
  or `""`), `saveSettings` (an error string, or `""`), `refreshRulesUI`, `renderRulesData`,
  `readDataArchive`.
- Produces:
  - `extFetchBytes(url, ms) -> Promise<Uint8Array>`. It rejects with an `Error` that has a
    `.status` on HTTP errors.
  - `checkSource(src) -> Promise<void>`. It sets `src.manifest`, `src.base`, `src.checked` and
    `src.error`, and keeps the last good manifest on failure.
  - `checkSources({boot}) -> Promise<boolean>`. It saves settings and calls `renderExtUI()` when that
    exists (Task 5 defines it; guard with `typeof`).
  - `addSource(url) -> Promise<{ok, why}>`.
  - `offerCandidate({entry, source}) -> cand`.
  - `manualCandidates(payloads:[{name, bytes, path?}]) -> {cands, failed:[{name, why}]}`.
  - A cand is `{key, category, system, file, title, version, minApp, sha256, size, requires, origin, manual, get:()=>Promise<Uint8Array>}`.
  - `planInstall(cands) -> [line]`, where a line is
    `{cand, outcome:"install"|"update"|"same"|"older"|"replace"|"blocked"|"unsupported", have, ticked, canTick, why}`.
  - `runInstall(lines) -> Promise<{ok, installed:[title], error:{file, why}|null, saveErr:string}>`.
  - `fetchAllRules(urls?)`: with no argument, it fetches every enabled plain source.

- [ ] **Step 1: Write the failing tests.** Add to `data-archive.js`'s `loadApp` list:
  `'extFetchBytes','checkSource','checkSources','addSource','offerCandidate','manualCandidates','planInstall','runInstall','importPack','loadedRulesGroups'`.
  Some of these may already be there. Then add:

```js
// ---------- #102: the network and the pipeline (fetch stubbed)
const extRoutes = {};
const extFetch = (url) => {
  if (!(url in extRoutes)) return Promise.reject(new TypeError('Failed to fetch'));
  const r = extRoutes[url];
  if (r === 'hang') return new Promise(() => {});
  const body = typeof r === 'number' ? '' : (typeof r === 'string' ? r : JSON.stringify(r));
  const bytes = new TextEncoder().encode(body);
  return Promise.resolve({ok: typeof r !== 'number', status: typeof r === 'number' ? r : 200,
    arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))});
};
const flush = () => new Promise(r => setImmediate(r));
const packJSON = (system, ver, name) => JSON.stringify({system, dataVersion: ver, spells: [{name: name || (system + ' Spell'), level: 1}]});
const shaOf = s => require('crypto').createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
section('#102 checkSources failures', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  const good = {_type: 'fieldbook-data', format: 2, builtFor: '1.0.0', packs: [{file: 'a_full.json', system: 'A', version: '1.0.0', sha256: 'd'.repeat(64)}]};
  extRoutes['https://m.example/ok.json'] = good;
  const src = {id: 'm1', kind: 'manifest', url: 'https://m.example/ok.json', on: true, checked: 0, error: '', manifest: null, base: ''};
  await X.checkSource(src);
  ck('#102 a good manifest is stored with its base URL', src.manifest && src.manifest.packs.length === 1 && src.base === 'https://m.example/ok.json' && src.error === '', src);
  extRoutes['https://m.example/ok.json'] = 'not json{';
  await X.checkSource(src);
  ck('#102 garbage keeps the last good manifest and says why', src.manifest.packs.length === 1 && /JSON/.test(src.error), src.error);
  extRoutes['https://m.example/ok.json'] = 500;
  await X.checkSource(src);
  ck('#102 an HTTP error keeps the last good manifest', src.manifest.packs.length === 1 && /500/.test(src.error));
  delete extRoutes['https://m.example/ok.json'];
  await X.checkSource(src);
  ck('#102 a network failure keeps the last good manifest', src.manifest.packs.length === 1 && src.error !== '');
  // the official source on a release from before #102: a 404 is no error
  extRoutes['https://api.github.com/repos/wardmanm/RPGFieldbook/releases?per_page=100'] =
    [{tag_name: 'v1.0.0', draft: false, prerelease: false, html_url: 'https://github.com/x', assets: [{name: 'fieldbook-data-standalone-1.0.0.zip'}]}];
  extRoutes['https://raw.githubusercontent.com/wardmanm/RPGFieldbook/v1.0.0/releases/data/fieldbook-data.json'] = 404;
  const off = {id: 'official', kind: 'official', url: '', on: true, checked: 0, error: '', manifest: null, base: ''};
  await X.checkSource(off);
  ck('#102 official on an old release: no manifest and no error', off.manifest === null && off.error === '', off);
  extRoutes['https://raw.githubusercontent.com/wardmanm/RPGFieldbook/v1.0.0/releases/data/fieldbook-data.json'] = good;
  await X.checkSource(off);
  ck('#102 official reads the manifest at the picked tag', off.manifest && off.base.endsWith('/v1.0.0/releases/data/fieldbook-data.json'));
  const realOnline = ctx.navigator.onLine; ctx.navigator.onLine = false;
  let fetched = 0; ctx.fetch = u => { fetched++; return extFetch(u); };
  const r = await X.checkSources({boot: true});
  ck('#102 offline at boot: nothing is fetched', r === false && fetched === 0);
  ctx.navigator.onLine = realOnline; ctx.fetch = extFetch;
});

section('#102 runInstall all or nothing', async () => {
  ctx.fetch = extFetch; Object.keys(extRoutes).forEach(k => delete extRoutes[k]);
  X.resetRules();
  X.importPack(JSON.parse(packJSON('A', '1.0.0')), 'a_full.json');
  const a2 = packJSON('A', '1.1.0', 'A New'), b1 = packJSON('B', '1.0.0');
  extRoutes['https://m.example/a_full.json'] = a2;
  extRoutes['https://m.example/b_full.json'] = b1;
  const src = {id: 'm1', kind: 'manifest', url: 'https://m.example/m.json', on: true, checked: 1, error: '', base: 'https://m.example/m.json',
    manifest: X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [
      {file: 'a_full.json', system: 'A', version: '1.1.0', sha256: shaOf(a2)},
      {file: 'b_full.json', system: 'B', version: '1.0.0', sha256: 'e'.repeat(64)}]}, 100)};
  X.settings.sources = [src];
  let saves = 0; const realSave = ctx.saveRulesCache; ctx.saveRulesCache = () => { saves++; return Promise.resolve(''); };
  const lines = X.planInstall(src.manifest.packs.map(entry => X.offerCandidate({entry, source: src})));
  ck('#102 the plan: A is an update, B an install, both ticked',
    lines.map(l => l.outcome + ':' + l.ticked).join() === 'update:true,install:true', lines.map(l => l.outcome));
  const before = JSON.stringify(X.loadedRulesGroups());
  const r1 = await X.runInstall(lines);
  ck('#102 one wrong sha256: nothing installs and the file is named',
    r1.ok === false && r1.error.file === 'b_full.json' && /sha256/.test(r1.error.why) && JSON.stringify(X.loadedRulesGroups()) === before && saves === 0, r1);
  src.manifest = X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [
    {file: 'a_full.json', system: 'A', version: '1.1.0', sha256: shaOf(a2)}, {file: 'b_full.json', system: 'B', version: '1.0.0', sha256: shaOf(b1)}]}, 100);
  extRoutes['https://m.example/b_full.json'] = 404;
  const r2 = await X.runInstall(X.planInstall(src.manifest.packs.map(entry => X.offerCandidate({entry, source: src}))));
  ck('#102 a 404: nothing installs', r2.ok === false && r2.error.file === 'b_full.json' && saves === 0, r2);
  extRoutes['https://m.example/b_full.json'] = packJSON('Imposter', '1.0.0');
  src.manifest.packs[1].sha256 = shaOf(extRoutes['https://m.example/b_full.json']);
  const r3 = await X.runInstall(X.planInstall(src.manifest.packs.map(entry => X.offerCandidate({entry, source: src}))));
  ck('#102 the wrong system: nothing installs', r3.ok === false && /Imposter/.test(r3.error.why), r3.error);
  extRoutes['https://m.example/b_full.json'] = b1; src.manifest.packs[1].sha256 = shaOf(b1);
  const r4 = await X.runInstall(X.planInstall(src.manifest.packs.map(entry => X.offerCandidate({entry, source: src}))));
  const g = X.loadedRulesGroups();
  ck('#102 all verified: both install, the cache saves once, origins are recorded',
    r4.ok === true && saves === 1 && g.find(x => x.label === 'a_full.json').dataVersion === '1.1.0' && g.some(x => x.label === 'b_full.json') &&
    X.settings.packOrigin['A|a_full.json'] === 'm1', r4);
  ctx.saveRulesCache = realSave; X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {};
});

section('#102 planInstall outcomes and manual candidates', () => {
  X.resetRules();
  X.importPack(JSON.parse(packJSON('A', '1.1.0')), 'a_full.json');
  const cand = (system, file, version, o) => Object.assign({key: system + '|' + file, category: 'rules', system, file, title: system, version,
    minApp: '', sha256: '', size: 0, requires: [], origin: 'm1', manual: false, get: () => Promise.resolve(new Uint8Array())}, o || {});
  const out = X.planInstall([cand('A', 'a_full.json', '1.1.0'), cand('A', 'a_full.json', '1.0.0', {key: 'x'}), cand('N', 'n_full.json', '1.0.0', {minApp: '99.0.0'}),
    cand('U', 'u.json', '1.0.0', {category: 'ui'})]).map(l => l.outcome + ':' + l.ticked + ':' + l.canTick);
  ck('#102 same, too new and unsupported are never ticked or tickable from a source',
    out.join() === 'same:false:false,blocked:false:false,unsupported:false:false', out);
  const man = X.planInstall([cand('A', 'a_full.json', '1.0.0', {manual: true})])[0];
  ck('#102 a manual older copy offers Replace anyway, unticked', man.outcome === 'older' && man.ticked === false && man.canTick === true);
  // a requirement pulled in from a source
  X.settings.sources = [{id: 'official', kind: 'official', url: '', on: true, checked: 1, error: '', base: 'https://r.example/m.json',
    manifest: X.readManifest({_type: 'fieldbook-data', builtFor: '1.0.0', packs: [{file: 'srd_full.json', system: 'SRD 5.2', version: '1.0.0', sha256: 'f'.repeat(64)}]}, 100)}];
  const req = X.planInstall([cand('H', 'h_full.json', '1.0.0', {requires: [{pack: 'SRD 5.2', file: 'srd_full.json', url: ''}]})]);
  ck('#102 a missing requirement a source offers joins the plan, ticked',
    req.length === 2 && req[1].cand.system === 'SRD 5.2' && req[1].outcome === 'install' && req[1].ticked === true && /H/.test(req[1].why), req.map(l => l.cand.system));
  // manual candidates: a loose pack, a non-pack, and a zip carrying its manifest
  const enc = s => new TextEncoder().encode(s);
  const mc = X.manualCandidates([{name: 'a_full.json', bytes: enc(packJSON('A', '1.2.0'))}, {name: 'notes.json', bytes: enc('{"hello":1}')}]);
  ck('#102 a loose pack is a candidate named by srcLabel and file', mc.cands.length === 1 && mc.cands[0].system === 'A' && mc.cands[0].version === '1.2.0' && mc.cands[0].manual === true);
  ck('#102 a file that isn\'t a rules pack is named and skipped', mc.failed.length === 1 && mc.failed[0].name === 'notes.json', mc.failed);
  const folder = X.manualCandidates([
    {name: 'fieldbook-data.json', bytes: enc(JSON.stringify({_type: 'fieldbook-data', builtFor: '9.9.9', packs: [{file: 'a_full.json', system: 'A', version: '1.2.0', sha256: 'a'.repeat(64)}]}))},
    {name: 'a_full.json', bytes: enc(packJSON('A', '1.2.0'))}]);
  ck('#102 a folder with its manifest: the manifest\'s sha256 and minApp apply', folder.cands.length === 1 && folder.cands[0].sha256 === 'a'.repeat(64) && folder.cands[0].minApp === '9.9.9');
  X.resetRules(); X.settings.sources = [];
});
```

  In `rules-data.js`, the fetch-all tests set `X.settings.rulesSources = [...]`. Replace each with
  `X.settings.sources = plain([...])`, defining once at the top of that block:

```js
const plain = urls => urls.map((url, i) => ({id: 'p' + i, kind: 'plain', url, on: true, checked: 0, error: '', manifest: null, base: ''}));
```

  The check at :3124, which passes `[HB, HB + ' ']`, tests de-duplication and trimming. Keep it
  meaningful: plain URLs are trimmed and de-duplicated in `fetchAllRules`.

- [ ] **Step 2: Run them and watch them fail**

  Run: `node src/tests/data-archive.js | grep -E "^FAIL|LOAD FAIL|ALL PASSED" | head`
  Expected: `FAIL` or `LOAD FAIL` for the new names.

- [ ] **Step 3: Implement.** Append to `89-extensions.js`:

```js
/* ---- the network: every call has a timeout (constraint 2) ---- */
function extFetchBytes(url,ms){
  let timer;
  const timeout=new Promise((_,rej)=>{timer=setTimeout(()=>rej(new Error("it took too long to answer")),ms);});
  return Promise.race([fetch(url,{cache:"no-store"}),timeout]).then(r=>{
    if(!r||!r.ok){const e=new Error("HTTP "+(r?r.status:"error"));e.status=r?r.status:0;throw e;}
    return r.arrayBuffer();
  }).then(b=>new Uint8Array(b)).finally(()=>clearTimeout(timer));
}
/* the official source's manifest URL: the newest release this app can run
   (pickDataRelease(), as the boot data check), at its tag, on raw — which
   answers a file:// page. "" when there is no such release. */
function extOfficialUrl(){
  if(!UPDATE_REPO)return Promise.resolve("");
  return extFetchBytes(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=100`,EXT_CHECK_MS).then(b=>{
    const pick=pickDataRelease(JSON.parse(utf8Text(b)),APP_VERSION);
    return pick?`https://raw.githubusercontent.com/${UPDATE_REPO}/${encodeURIComponent(pick.tag)}/releases/data/fieldbook-data.json`:"";
  });
}
/* One source's manifest. A failure keeps the last good manifest and says why
   on the source's row; the official source on a release from before #102 (no
   releases/data/, a 404) is simply nothing to offer, not an error. */
function checkSource(src){
  const at=Date.now();
  return (src.kind==="official"?extOfficialUrl():Promise.resolve(src.url)).then(url=>{
    if(!url){src.manifest=null;src.base="";return;}
    return extFetchBytes(url,EXT_CHECK_MS).then(bytes=>{
      let obj;try{obj=JSON.parse(utf8Text(bytes));}catch(e){throw new Error("it isn't valid JSON");}
      src.manifest=readManifest(obj,bytes.length);src.base=url;
    });
  }).then(()=>{src.checked=at;src.error="";},e=>{
    src.checked=at;
    if(src.kind==="official"&&e&&e.status===404){src.manifest=null;src.base="";src.error="";return;}
    src.error=String((e&&e.message)||e||"it couldn't be reached");
  });
}
/* Every enabled manifest source, and the official one: at boot (quiet, never
   offline) and on Check now. Reads manifests only, never pack files. */
function checkSources(opts){
  const o=opts||{};
  if(navigator.onLine===false)return Promise.resolve(false);
  const list=(settings.sources||[]).filter(s=>s.on&&(s.kind==="official"||s.kind==="manifest"));
  return Promise.all(list.map(checkSource)).then(()=>{
    const err=saveSettings();
    if(err&&!o.boot&&typeof updateRulesStatus==="function")updateRulesStatus("Couldn't save your sources: "+err,"err");
    if(typeof renderExtUI==="function")renderExtUI();
    return true;
  });
}
/* + Add a source URL: fetched once and sorted (spec §4) */
function addSource(url){
  const u=String(url||"").trim();
  if(!extUrl(u))return Promise.resolve({ok:false,why:"That isn't a web address (it must start with http:// or https://)."});
  if((settings.sources||[]).some(s=>s.url===u))return Promise.resolve({ok:false,why:"That source is already in the list."});
  return extFetchBytes(u,EXT_CHECK_MS).then(bytes=>{
    let obj;try{obj=JSON.parse(utf8Text(bytes));}catch(e){return {ok:false,why:"It didn't answer with JSON."};}
    const src={id:uid(),kind:"plain",url:u,on:true,checked:Date.now(),error:"",manifest:null,base:""};
    if(obj&&obj._type==="fieldbook-data"){
      try{src.manifest=readManifest(obj,bytes.length);}catch(e){return {ok:false,why:"Its manifest can't be used: "+e.message+"."};}
      src.kind="manifest";src.base=u;
    }else if(!(obj&&typeof obj==="object"&&(isRulesPack(obj)||Array.isArray(obj.include)))){
      return {ok:false,why:"It isn't a Fieldbook manifest or rules file."};
    }
    settings.sources.push(src);
    const err=saveSettings();
    return {ok:true,why:err?"Added, but your settings couldn't be saved: "+err:""};
  },e=>({ok:false,why:"It couldn't be reached: "+((e&&e.message)||e)+"."}));
}
/* ---- candidates (spec §5 step 1) ---- */
function offerCandidate(o){
  const e=o.entry,url=new URL(e.path,o.source.base||o.source.url).href;
  return {key:extKey(e.system,e.file),category:e.category,system:e.system,file:e.file,title:e.title,version:e.version,
    minApp:e.minApp,sha256:e.sha256,size:e.size,requires:e.requires,origin:o.source.id,manual:false,
    get:()=>extFetchBytes(url,EXT_FILE_MS)};
}
/* Files, a folder or a dropped set, as {name, bytes, path?}. A zip goes
   through readDataArchive() and keeps its manifest's entries; a folder's
   fieldbook-data.json does the same for the files beside it; a loose pack is
   named by its own system and dataVersion. */
function manualCandidates(payloads){
  const cands=[],failed=[],list=Array.isArray(payloads)?payloads:[];
  const fromBytes=(name,bytes,entry)=>{
    let obj;
    try{obj=JSON.parse(utf8Text(bytes));}catch(e){failed.push({name,why:"it isn't valid JSON"});return;}
    if(!obj||typeof obj!=="object"||Array.isArray(obj)||!isRulesPack(obj)){failed.push({name,why:"it isn't a rules pack"});return;}
    const file=String(name).split("/").pop(),system=srcLabel(obj);
    const e=entry&&entry.system===system?entry:null;
    cands.push({key:extKey(system,file),category:e?e.category:"rules",system,file,title:e?e.title:system,
      version:e?e.version:(typeof obj.dataVersion==="string"?obj.dataVersion:""),minApp:e?e.minApp:"",
      sha256:e?e.sha256:"",size:bytes.length,requires:e?e.requires:[],origin:"manual",manual:true,
      get:()=>Promise.resolve(bytes)});
  };
  /* a folder's (or a drop's) own manifest, read first */
  let folderMan=null;
  const manFile=list.find(p=>p&&String(p.name).split("/").pop()==="fieldbook-data.json");
  if(manFile){try{folderMan=readManifest(JSON.parse(utf8Text(manFile.bytes)),manFile.bytes.length);}catch(e){failed.push({name:"fieldbook-data.json",why:e.message});}}
  const metaFor=file=>folderMan?folderMan.packs.find(p=>p.file===file)||null:null;
  list.forEach(p=>{
    if(!p||p===manFile)return;
    const name=String(p.name||"file"),bytes=p.bytes;
    if(!bytes||!ArrayBuffer.isView(bytes)){failed.push({name,why:"it couldn't be read"});return;}
    if(isZipBytes(bytes)){
      let arc;
      try{arc=readDataArchive(bytes,name);}catch(e){failed.push({name,why:ZIP_WHY[e&&e.code]||"it couldn't be read"});return;}
      arc.packs.forEach(pk=>fromBytes(pk.name,pk.bytes,pk.meta?extEntry(pk.meta,pk.builtFor):null));
      return;
    }
    if(!/\.json$/i.test(name))return;
    fromBytes(name,bytes,metaFor(name.split("/").pop()));
  });
  return {cands,failed};
}
/* ---- the plan (spec §5 step 2) ---- */
function extLoadedGroup(system,file){return loadedRulesGroups().find(g=>g.isFile&&g.label===file&&g.source===system)||null;}
function planInstall(cands){
  const byKey=new Map();
  (cands||[]).forEach(c=>{const ex=byKey.get(c.key);if(!ex||cmpDataVer(c.version,ex.version)>0)byKey.set(c.key,c);});
  const line=c=>{
    if(EXT_CATS.indexOf(c.category)<0)return {cand:c,outcome:"unsupported",have:"",ticked:false,canTick:false,why:"requires Fieldbook "+(c.minApp||"newer")};
    if(extTooNew(c))return {cand:c,outcome:"blocked",have:"",ticked:false,canTick:false,why:"requires Fieldbook "+c.minApp};
    const g=extLoadedGroup(c.system,c.file),have=g?g.dataVersion:"";
    if(!g)return {cand:c,outcome:"install",have,ticked:true,canTick:true,why:""};
    if(!parseDataVer(have)||!parseDataVer(c.version))return {cand:c,outcome:"replace",have,ticked:true,canTick:true,why:""};
    const d=cmpDataVer(c.version,have);
    if(d>0)return {cand:c,outcome:"update",have,ticked:true,canTick:true,why:""};
    return {cand:c,outcome:d===0?"same":"older",have,ticked:false,canTick:!!c.manual,why:c.manual?"Replace anyway":""};
  };
  const lines=[...byKey.values()].map(line);
  /* a ticked pack's missing requirement, offered by an enabled source, joins
     the plan as its own install line (spec §8) — bounded, never a loop */
  for(let pass=0;pass<10;pass++){
    let added=false;
    lines.filter(l=>l.ticked).forEach(l=>(l.cand.requires||[]).forEach(r=>{
      if(loadedRulesGroups().some(g=>g.source===r.pack))return;
      if(lines.some(x=>x.cand.system===r.pack))return;
      const o=extOffers().find(x=>x.entry.system===r.pack&&(!r.file||x.entry.file===r.file)&&EXT_CATS.indexOf(x.entry.category)>=0&&!extTooNew(x.entry));
      if(!o)return;
      lines.push({cand:offerCandidate(o),outcome:"install",have:"",ticked:true,canTick:true,why:"needed by "+l.cand.title});added=true;
    }));
    if(!added)break;
  }
  return lines;
}
/* ---- the install (spec §5 steps 4 and 5): everything fetched and verified
   first; one failure changes nothing ---- */
function extVerify(c,bytes){
  if(bytes.length>EXT_FILE_MAX)throw new Error("it's larger than 32 MB");
  if(c.sha256&&sha256Hex(bytes)!==c.sha256)throw new Error("its sha256 doesn't match the manifest");
  let obj;try{obj=JSON.parse(utf8Text(bytes));}catch(e){throw new Error("it isn't valid JSON");}
  if(!obj||typeof obj!=="object"||Array.isArray(obj)||!isRulesPack(obj))throw new Error("it isn't a rules pack");
  if(srcLabel(obj)!==c.system)throw new Error(`it says it is ${srcLabel(obj)}, not ${c.system}`);
  if(c.version&&obj.dataVersion!==c.version)throw new Error(`it is version ${obj.dataVersion||"(none)"}, the manifest says ${c.version}`);
  return obj;
}
function runInstall(lines){
  const todo=(lines||[]).filter(l=>l.ticked&&l.canTick!==false);
  const got=[];
  const step=i=>{
    if(i>=todo.length)return Promise.resolve(null);
    const c=todo[i].cand;
    return Promise.resolve().then(()=>c.get()).then(bytes=>{got.push({c,obj:extVerify(c,bytes)});return step(i+1);},
      e=>({file:c.file,why:String((e&&e.message)||e)}));
  };
  return step(0).then(error=>{
    if(error)return {ok:false,installed:[],error,saveErr:""};
    if(!got.length)return {ok:true,installed:[],error:null,saveErr:""};
    if(!settings.packOrigin||typeof settings.packOrigin!=="object")settings.packOrigin={};
    const installed=[];
    got.forEach(({c,obj})=>{importPack(obj,c.file);settings.packOrigin[c.key]=c.origin;installed.push(c.title);});
    const setErr=saveSettings();
    return saveRulesCache().then(cacheErr=>{
      if(typeof refreshRulesUI==="function")refreshRulesUI();
      renderRulesData();
      return {ok:true,installed,error:null,saveErr:[cacheErr,setErr].filter(Boolean).join(" ")};
    });
  });
}
```

  `89-zip.js` `readDataArchive()`: in the manifest branch, keep each pack's manifest entry and the
  archive's `builtFor`:

```js
    const resolved=m.packs.map(p=>{
      const f=p&&typeof p.file==="string"?p.file:"";
      const en=f?all.find(x=>x.name===dir+f):null;
      if(!en)throw zipError("damaged","it lists "+(f||"a pack")+" but doesn't hold it");
      return {name:base(f),en,meta:p};
    });
    reserve(resolved.map(r=>r.en));
    const builtFor=typeof m.builtFor==="string"?m.builtFor:"";
    const packs=resolved.map(r=>({name:r.name,bytes:zipEntryBytes(bytes,r.en),meta:r.meta,builtFor}));
```

  The nested-zip and loose branches are unchanged: their packs have no `meta`.

  `89-rules-merge.js` `fetchAllRules()` (:453): replace

```js
  const srcs=[...new Set((settings.rulesSources||[]).map(s=>String(s||"").trim()).filter(Boolean))];
```

  with

```js
function fetchAllRules(urls){
  /* the plain sources (#102): old-style pack and include URLs, which have no
     versions; a manifest source installs through the plan instead */
  const from=Array.isArray(urls)?urls:(settings.sources||[]).filter(s=>s.kind==="plain"&&s.on).map(s=>s.url);
  const srcs=[...new Set(from.map(s=>String(s||"").trim()).filter(Boolean))];
```

  Keep the rest of the function as it is. Change its empty-list message from
  `"Add at least one source URL first."` to `"There's no plain source to fetch."`.

  `90-boot.js:401`: `checkForUpdate();checkForDataUpdate();checkSources({boot:true});`.

- [ ] **Step 4: Run the tests**

  Run `node src/tests/data-archive.js | grep -E "^FAIL|LOAD FAIL|ALL PASSED"` and
  `node src/tests/rules-data.js | grep -E "^FAIL|ALL PASSED"`.
  Expected: both `ALL PASSED`.

  If the harness's `ctx.navigator` has no `onLine`, the offline check sets it. Make sure your edit to
  `navigator` is restored.

- [ ] **Step 5: Commit**

```bash
git add src/js/89-extensions.js src/js/89-zip.js src/js/89-rules-merge.js src/js/90-boot.js src/tests/data-archive.js src/tests/rules-data.js
git commit -m "feat(#102): checking sources, candidates, the plan and the all-or-nothing install

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The Extensions page and the details dialog

**Files:**
- Modify: `src/js/88-settings.js`:
  - `SET_PAGES`: `k:"rules"` becomes `k:"extensions"`, `title:"Extensions"`; keep the icon;
  - `setPageOf()`: a stored `"rules"` reads as `"extensions"`;
  - `openSettings()`: `secRules` (:148–:159) is replaced by the Extensions page, and its wiring
    (:217–:224 and :246) by `wireExtPage()`;
  - remove `downloadRulesTemplates` from wherever `#btnRulesTemplate` is wired.
- Modify: `src/js/89-rules-merge.js`:
  - remove `renderSrcRows()` and `downloadRulesTemplates()`;
  - `renderRulesData()` also calls `renderExtUI()` and updates `[data-setbadge="extensions"]`;
  - the home screen's `homeRulesData` keeps `rulesDataHTML()` exactly as it is.
- Modify: `src/js/89-extensions.js`, appending the page, the rows, Sources, the details dialog,
  `renderExtUI()` and `wireExtPage()`.
- Modify: `src/css/50-modal.css`, adding `.ext-*` rules after the `.set-*` block.
- Modify: the wiki pages that name a removed function: `features/settings-and-updates.md`
  (`renderSrcRows`, `downloadRulesTemplates`), `roadmap/2.0.md:79` and `decisions.md:583`
  (`downloadRulesTemplates`). Change the wording to past tense with no backticked name, for example
  "the templates Get templates used to download (removed in #102)", so the docs suite's
  function-name check passes. Task 7 rewrites these pages fully.
- Test: `src/tests/data-archive.js`.

**Interfaces:**
- Consumes: Task 3's `extPackRows`, `extUpdateRows`, `extOffers`, `availableFor`, `extTooNew`,
  `extUrl`, `EXT_CATS`, `extKey`; and Task 4's `checkSources`, `addSource`, `fetchAllRules`,
  `planInstall`, `offerCandidate`.
- Produces:
  - `extPageHTML() -> string` (the whole page body);
  - `extRowHTML(row) -> string`;
  - `extSourcesHTML() -> string`;
  - `extDetailsHTML(key) -> string`;
  - `openExtDetails(key)`;
  - `renderExtUI()` (repaints `#extPage` if present, and the pill via `renderExtPill()` when Task 6
    defines it: guard with `typeof`);
  - `wireExtPage(root)`;
  - `extUpdateFromRows(rows)`, which calls `openInstallPlan(planInstall(cands))` (Task 6 defines
    `openInstallPlan`; until then this calls it under a `typeof` guard);
  - `extParas(text) -> string` (escaped `<p>`s).
  - Markup hooks Task 6 relies on: `#extPage`, `[data-ext-open="<key>"]`, `[data-ext-update="<key>"]`,
    `[data-ext-install="<key>"]`, `#extUpdateAll`, `#extCheckNow`, `#extManual`, `#extAddUrl` and
    `#extAddGo`, `[data-ext-sec="<name>"]` (fold toggles), `#extRemoveRules`, `#extRemoveSources`,
    `[data-ext-src-on="<id>"]`, `[data-ext-src-del="<id>"]`, `[data-ext-src-fetch="<id>"]`,
    `[data-ext-req="<pack>"]`, and the status line `#rulesStatus`.

- [ ] **Step 1: Write the failing tests.** Add to the `loadApp` list:
  `'extPageHTML','extRowHTML','extSourcesHTML','extDetailsHTML','extParas','setPageOf','SET_PAGES'`.

```js
section('#102 the Extensions page markup', () => {
  X.resetRules();
  X.importPack({system: 'SRD 5.2', dataVersion: '1.8.1', spells: [{name: 'Bless', level: 1}]}, 'srd52_full.json');
  X.importPack({system: '2024 Rules', dataVersion: '1.8.0', spells: [{name: 'Haste', level: 3}]}, 'xphb_full.json');
  const evil = '<img src=x onerror=alert(1)>';
  X.settings.sources = [
    {id: 'official', kind: 'official', url: '', on: true, checked: Date.now(), error: '', base: 'https://raw.example/m.json',
      manifest: X.readManifest({_type: 'fieldbook-data', name: 'Fieldbook public data', builtFor: '1.0.0', packs: [
        {file: 'srd52_full.json', system: 'SRD 5.2', version: '1.9.0', sha256: 'a'.repeat(64), title: 'SRD 5.2', summary: 'Free rules.'}]}, 100)},
    {id: 's2', kind: 'manifest', url: 'https://ember.example/m.json', on: true, checked: Date.now(), error: 'HTTP 500', base: 'https://ember.example/m.json',
      manifest: X.readManifest({_type: 'fieldbook-data', name: evil, homepage: 'javascript:alert(1)', builtFor: '1.0.0', packs: [
        {file: 'ember_full.json', system: 'Ember', version: '2.1.0', sha256: 'b'.repeat(64), title: evil, summary: evil, description: evil + '\n\nSecond para.',
          minApp: '99.0.0', requires: [{pack: 'SRD 5.2', url: 'javascript:alert(1)'}, {pack: 'Mystery', url: 'https://m.example'}]},
        {file: 'ember_ui.json', system: 'Ember Theme', version: '1.0.0', category: 'ui', sha256: 'c'.repeat(64), minApp: '2.0.0'}]}, 100)},
    {id: 'p1', kind: 'plain', url: 'https://plain.example/spells.json', on: true, checked: 0, error: '', manifest: null, base: ''}];
  X.settings.packOrigin = {'SRD 5.2|srd52_full.json': 'official'}; X.settings.dismissedUpdates = {}; X.settings.setCollapse = {};
  const h = X.extPageHTML();
  ck('#102 the banner offers Update all for one update', /id="extUpdateAll"/.test(h) && /1 update/.test(h) && /SRD 5\.2/.test(h));
  ck('#102 sections: Rules data, Unsupported, Sources, each foldable',
    /data-ext-sec="rules"/.test(h) && /data-ext-sec="unsupported"/.test(h) && /data-ext-sec="sources"/.test(h) && /aria-expanded="true"/.test(h));
  ck('#102 the update row shows 1.8.1 → 1.9.0 and Update', /1\.8\.1/.test(h) && /1\.9\.0/.test(h) && /data-ext-update="SRD 5\.2\|srd52_full\.json"/.test(h));
  ck('#102 a hand-imported pack reads "imported from a file"', /imported from a file/.test(h));
  ck('#102 a too-new pack reads "requires Fieldbook 99.0.0" and has no live Install',
    /requires Fieldbook 99\.0\.0/.test(h) && !/data-ext-install="Ember\|ember_full\.json"/.test(h));
  ck('#102 an unsupported category reads "requires Fieldbook 2.0.0" under Unsupported', /Unsupported/.test(h) && /requires Fieldbook 2\.0\.0/.test(h));
  ck('#102 a missing requirement is a chip "requires Mystery"', /data-ext-req="Mystery"[^>]*>requires Mystery</.test(h));
  ck('#102 hostile manifest text is escaped everywhere', !h.includes('<img src=x') && h.includes('&lt;img src=x'));
  ck('#102 a source that failed says why', /couldn.t check: HTTP 500/.test(h));
  ck('#102 the plain source has Fetch and Remove', /data-ext-src-fetch="p1"/.test(h) && /data-ext-src-del="p1"/.test(h));
  ck('#102 the built-in source has a switch, not Remove', /data-ext-src-on="official"/.test(h) && !/data-ext-src-del="official"/.test(h));
  ck('#102 the row of actions: Add, Check now, Manual install', /id="extAddUrl"/.test(h) && /id="extCheckNow"/.test(h) && /id="extManual"[^>]*>Manual install/.test(h));
  ck('#102 no Get templates and no Fetch all', !/Get templates/.test(h) && !/Fetch all/.test(h));
  X.settings.setCollapse = {'ext:rules': true};
  ck('#102 a folded section stays folded', /data-ext-sec="rules"[^>]*aria-expanded="false"/.test(X.extPageHTML()));
  const d = X.extDetailsHTML('Ember|ember_full.json');
  ck('#102 details: the full description as escaped paragraphs', (d.match(/<p>/g) || []).length >= 2 && !d.includes('<img src=x'));
  ck('#102 details: a javascript: homepage and requires url never become links', !/href="javascript/i.test(d));
  ck('#102 details: the source box and the other extensions from that source', /Source/.test(d) && /ember\.example\/m\.json/.test(d) && /data-ext-open="Ember Theme\|ember_ui\.json"/.test(d));
  ck('#102 a requirement with an https url links out', /href="https:\/\/m\.example"[^>]*target="_blank"[^>]*rel="noopener"/.test(d));
  ck('#102 extParas splits on blank lines and escapes', X.extParas('a<b\n\nc') === '<p>a&lt;b</p><p>c</p>');
  ck('#102 the Settings page is Extensions, and a stored "rules" opens it',
    X.SET_PAGES.some(p => p.k === 'extensions' && p.title === 'Extensions') && X.setPageOf('rules', false) === 'extensions');
  X.resetRules(); X.settings.sources = []; X.settings.packOrigin = {}; X.settings.setCollapse = {};
});
```

- [ ] **Step 2: Run them and watch them fail**

  Run: `node src/tests/data-archive.js | grep -E "^FAIL|LOAD FAIL" | head`
  Expected: `LOAD FAIL` (the names don't exist yet).

- [ ] **Step 3: Implement.** Append to `89-extensions.js`:

```js
/* ---- the Extensions page (spec §6.2) ---- */
function extParas(t){return String(t||"").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean).map(s=>`<p>${esc(s)}</p>`).join("");}
function extAgo(t){if(!t)return "not checked yet";const d=new Date(t);return "checked "+(new Date().toDateString()===d.toDateString()?"":d.toLocaleDateString()+" ")+d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});}
function extSourceName(src){
  if(src.kind==="official")return "Fieldbook public data";
  return (src.manifest&&src.manifest.name)||String(src.url||"").replace(/^https?:\/\//i,"");
}
/* a requirement chip: a button when something answers it (a source offers it,
   or it carries a link), otherwise a plain label */
function extReqChip(r){
  return `<button type="button" class="chip ext-req" data-ext-req="${esc(r.pack)}"${r.url?` data-ext-req-url="${esc(r.url)}"`:""}>requires ${esc(r.pack)}</button>`;
}
function extMissingReqs(entry){
  return (entry&&entry.requires||[]).filter(r=>!loadedRulesGroups().some(g=>g.source===r.pack));
}
function extSecHTML(key,title,count,body,action){
  const shut=!!(settings.setCollapse||{})["ext:"+key];
  return `<section class="ext-sec">`+
    `<div class="ext-sec-h"><button type="button" class="ext-fold" data-ext-sec="${esc(key)}" aria-expanded="${shut?"false":"true"}"><span class="ext-car" aria-hidden="true">${shut?"▸":"▾"}</span>${esc(title)}${count!=null?` <span class="ext-n">${esc(String(count))}</span>`:""}</button>${action||""}</div>`+
    `<div class="ext-sec-b"${shut?" hidden":""}>${body}</div></section>`;
}
function extRowHTML(r){
  const g=r.group,o=r.offer,e=o&&o.entry;
  const title=e?e.title:(g?(g.isFile&&g.source?g.source:g.label):r.key);
  const from=g?(o&&(settings.packOrigin||{})[r.key]===o.source.id?"from "+extSourceName(o.source):(g.isFile?"imported from a file":"from "+g.label))
    :(o?"from "+extSourceName(o.source)+" · not installed":"");
  const have=g&&parseDataVer(g.dataVersion)?g.dataVersion:"";
  let ver="",act="";
  if(r.state==="update"){ver=`${esc(have||"—")} → <b class="ext-up">${esc(e.version)}</b>`;act=`<button type="button" class="tbtn ext-act" data-ext-update="${esc(r.key)}">Update</button>`;}
  else if(r.state==="install"){ver=`<b>${esc(e.version)}</b>`;act=`<button type="button" class="tbtn ext-act" data-ext-install="${esc(r.key)}">Install</button>`;}
  else if(have)ver=esc(have);
  const chips=[];
  if(e&&(r.state==="blocked"||r.state==="unsupported"))chips.push(`<span class="chip ext-app">requires Fieldbook ${esc(e.minApp||"newer")}</span>`);
  if(e)extMissingReqs(e).forEach(rq=>chips.push(extReqChip(rq)));
  const del=g?`<button type="button" class="icon danger" data-rd-del="${esc(g.key)}" aria-label="${esc("Remove "+title)}" title="Remove this data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg></button>`:"";
  return `<div class="ext-row"><div class="ext-main"><button type="button" class="ext-name" data-ext-open="${esc(r.key)}">${esc(title)}</button>`+
    /* the old boot check's "v… out" chip only where no source offers the pack:
       an offer says the same thing, with an Update button */
    (g?(o?"":dataStatusHTML(g))+requiresStatusHTML(g):"")+
    (e&&e.summary?`<div class="ext-sum">${esc(e.summary)}</div>`:"")+
    (from?`<div class="ext-from">${esc(from)}</div>`:"")+
    (chips.length?`<div class="ext-chips">${chips.join("")}</div>`:"")+
    `</div>${ver?`<span class="ext-ver">${ver}</span>`:""}${act}${del}</div>`;
}
function extSourcesHTML(){
  const rows=(settings.sources||[]).map(s=>{
    const name=extSourceName(s),note=s.kind==="plain"?"plain file":(s.error?"couldn't check: "+s.error:extAgo(s.checked));
    const sub=s.kind==="official"?"built in · "+note:(s.kind==="manifest"?String(s.url).replace(/^https?:\/\//i,"")+" · "+note:note);
    const ctl=s.kind==="official"
      ?`<button type="button" class="switch ${s.on?"on":""}" data-ext-src-on="${esc(s.id)}" role="switch" aria-checked="${s.on?"true":"false"}" aria-label="Use Fieldbook public data"></button>`
      :(s.kind==="plain"?`<button type="button" class="tbtn" data-ext-src-fetch="${esc(s.id)}">Fetch</button>`:"")+`<button type="button" class="tbtn" data-ext-src-del="${esc(s.id)}">Remove</button>`;
    return `<div class="ext-src"><div class="ext-main"><b>${esc(name)}</b><div class="ext-from${s.error?" ext-err":""}">${esc(sub)}</div></div>${ctl}</div>`;
  }).join("");
  return `<div class="ext-list">${rows}</div>`+
    `<div class="ext-acts"><input id="extAddUrl" placeholder="https://…/fieldbook-data.json" aria-label="Source URL"><button type="button" class="tbtn" id="extAddGo">+ Add a source URL</button>`+
    `<button type="button" class="tbtn" id="extCheckNow">Check now</button><button type="button" class="tbtn" id="extManual">Manual install…</button></div>`;
}
function extPageHTML(){
  const rows=extPackRows(),rules=rows.filter(r=>r.state!=="unsupported"),uns=rows.filter(r=>r.state==="unsupported");
  const ups=rows.filter(r=>r.state==="update");
  const warn=rulesCacheWarning()?`<p class="status err">${esc(rulesCacheWarning())}</p>`:"";
  const banner=ups.length?`<div class="ext-banner"><span class="ext-grow"><b>${ups.length} update${ups.length===1?"":"s"}</b> · ${esc(ups.map(r=>r.offer.entry.title).join(", "))}</span><button type="button" class="tbtn primary" id="extUpdateAll">Update all</button></div>`:"";
  const rulesBody=rules.length?`<div class="ext-list">${rules.map(extRowHTML).join("")}</div>`:`<p class="hint">No rules data yet. Install it from a source below, or use Manual install.</p>`;
  return `<div id="extPage">`+warn+banner+
    extSecHTML("rules","Rules data",rules.length,rulesBody,rules.some(r=>r.group)?`<button type="button" class="tbtn danger ext-secbtn" id="extRemoveRules">Remove all</button>`:"")+
    (uns.length?extSecHTML("unsupported","Unsupported",uns.length,`<div class="ext-list">${uns.map(extRowHTML).join("")}</div>`,""):"")+
    extSecHTML("sources","Sources",(settings.sources||[]).length,extSourcesHTML(),
      (settings.sources||[]).some(s=>s.kind!=="official")?`<button type="button" class="tbtn danger ext-secbtn" id="extRemoveSources">Remove all</button>`:"")+
    `<div class="status" id="rulesStatus">${esc(rulesStatusText())}</div>`+
    `<input type="file" id="fileRules" accept="application/json,.json,application/zip,application/x-zip-compressed,.zip" multiple class="hidefile">`+
    `</div>`;
}
/* ---- the details dialog (spec §6.3) ---- */
function extRowFor(key){return extPackRows().find(r=>r.key===key)||null;}
function extDetailsHTML(key){
  const r=extRowFor(key);if(!r)return `<p class="hint">That extension isn't listed any more.</p>`;
  const e=r.offer&&r.offer.entry,src=r.offer&&r.offer.source,g=r.group;
  const cat=e?(e.category==="rules"?"Rules data":e.category):"Rules data";
  const ver=e?e.version:(g&&g.dataVersion)||"";
  const chips=[];
  if(e&&(r.state==="blocked"||r.state==="unsupported"))chips.push(`<span class="chip ext-app">requires Fieldbook ${esc(e.minApp||"newer")}</span>`);
  if(e)extMissingReqs(e).forEach(rq=>chips.push(rq.url?`<a class="chip ext-req" href="${esc(rq.url)}" target="_blank" rel="noopener">requires ${esc(rq.pack)}</a>`:extReqChip(rq)));
  const others=src?extPackRows().filter(x=>x.key!==key&&x.offer&&x.offer.source.id===src.id):[];
  const kv=(k,v)=>v?`<div><span class="ext-k">${esc(k)}</span>${v}</div>`:"";
  const box=src?`<div class="ext-box"><b>Source</b>`+
    kv("Name",esc(extSourceName(src)))+
    kv("Manifest",esc(src.kind==="official"?"the Fieldbook release":String(src.base||src.url).replace(/^https?:\/\//i,"")))+
    kv("Homepage",src.manifest&&src.manifest.homepage?`<a href="${esc(src.manifest.homepage)}" target="_blank" rel="noopener">${esc(src.manifest.homepage.replace(/^https?:\/\//i,""))}</a>`:"")+
    kv("Checked",esc(extAgo(src.checked)))+
    kv("Licence",esc([e&&e.license,e&&e.attribution].filter(Boolean).join(" · ")))+`</div>`:
    `<div class="ext-box"><b>Source</b><div>${esc(g&&g.isFile?"Imported from a file: "+g.label:"From "+(g?g.label:""))}</div></div>`;
  const alsoBox=others.length?`<div class="ext-box"><b>Also from this source</b>${others.map(x=>`<div><button type="button" class="ext-name" data-ext-open="${esc(x.key)}">${esc(x.offer.entry.title)}</button>${x.state==="blocked"||x.state==="unsupported"?` · requires Fieldbook ${esc(x.offer.entry.minApp||"newer")}`:""}</div>`).join("")}</div>`:"";
  const act=r.state==="update"?`<button type="button" class="tbtn primary" data-ext-update="${esc(key)}">Update</button>`
    :(r.state==="install"?`<button type="button" class="tbtn primary" data-ext-install="${esc(key)}">Install</button>`:"");
  return `<div class="ext-dlg"><div class="ext-meta">${esc(cat)}${ver?" · "+esc(ver):""} · ${g?"installed":"not installed"}</div>`+
    (e&&e.description?extParas(e.description):(e&&e.summary?extParas(e.summary):`<p class="hint">No description.</p>`))+
    (chips.length?`<div class="ext-chips">${chips.join("")}</div>`:"")+box+alsoBox+
    `<div class="m-actions"><button type="button" class="tbtn" id="extDlgClose">Close</button>${act}</div></div>`;
}
function openExtDetails(key){
  const r=extRowFor(key);
  const title=r?(r.offer?r.offer.entry.title:(r.group&&r.group.isFile&&r.group.source)||(r.group&&r.group.label)||key):"Extension";
  openModal(title,extDetailsHTML(key),"",{});
  const body=document.getElementById("mBody");
  const close=document.getElementById("extDlgClose");if(close)close.addEventListener("click",()=>{closeModal();openSettings();});
  body.querySelectorAll("[data-ext-open]").forEach(b=>b.addEventListener("click",()=>openExtDetails(b.dataset.extOpen)));
  body.querySelectorAll("[data-ext-update],[data-ext-install]").forEach(b=>b.addEventListener("click",()=>extUpdateFromRows([extRowFor(b.dataset.extUpdate||b.dataset.extInstall)].filter(Boolean))));
  body.querySelectorAll("button[data-ext-req]").forEach(b=>b.addEventListener("click",()=>extReqTap(b)));
}
/* a requirement chip: the pack's details when a source offers it, else its link */
function extReqTap(b){
  const o=extOffers().find(x=>x.entry.system===b.dataset.extReq);
  if(o)return openExtDetails(extKey(o.entry.system,o.entry.file));
  const u=extUrl(b.dataset.extReqUrl||"");if(u)window.open(u,"_blank","noopener");
}
function extUpdateFromRows(rows){
  const cands=rows.filter(r=>r&&r.offer&&(r.state==="update"||r.state==="install")).map(r=>offerCandidate(r.offer));
  if(!cands.length)return;
  if(typeof openInstallPlan==="function")openInstallPlan(planInstall(cands),{back:"settings"});
}
function renderExtUI(){
  const host=document.getElementById("extPage");
  if(host){const fold={};host.querySelectorAll("[data-ext-sec]").forEach(b=>{fold[b.dataset.extSec]=b.getAttribute("aria-expanded");});
    host.outerHTML=extPageHTML();const fresh=document.getElementById("extPage");if(fresh)wireExtPage(fresh);}
  if(typeof renderExtPill==="function")renderExtPill();
  const badge=document.querySelector('[data-setbadge="extensions"]');if(badge&&typeof rulesNavBadgeHTML==="function")badge.innerHTML=rulesNavBadgeHTML();
}
/* bound to the fresh #extPage each time it is drawn, so listeners never stack */
function wireExtPage(root){
  root.addEventListener("click",e=>{
    const t=e.target;let b;
    if((b=t.closest("[data-ext-sec]"))){const k="ext:"+b.dataset.extSec;settings.setCollapse=settings.setCollapse||{};settings.setCollapse[k]=!settings.setCollapse[k];saveSettings();return renderExtUI();}
    if((b=t.closest("[data-ext-open]")))return openExtDetails(b.dataset.extOpen);
    if((b=t.closest("[data-ext-update],[data-ext-install]")))return extUpdateFromRows([extRowFor(b.dataset.extUpdate||b.dataset.extInstall)]);
    if(t.closest("#extUpdateAll"))return extUpdateFromRows(extUpdateRows());
    if((b=t.closest("button[data-ext-req]")))return extReqTap(b);
    if((b=t.closest("[data-rd-del]"))){const g=loadedRulesGroups().find(x=>x.key===b.dataset.rdDel);if(g&&confirm(`Remove “${g.label}” (${g.count} entr${g.count===1?"y":"ies"}) from your loaded rules?`))removeRulesGroup(b.dataset.rdDel);return;}
    if(t.closest("#extRemoveRules"))return clearAllRules();
    if(t.closest("#extRemoveSources")){
      if(!confirm("Remove every source you added, and switch off Fieldbook public data?\n\nPacks you've installed stay installed."))return;
      settings.sources=(settings.sources||[]).filter(s=>s.kind==="official");settings.sources.forEach(s=>{s.on=false;});
      const err=saveSettings();if(err)updateRulesStatus("Couldn't save your sources: "+err,"err");return renderExtUI();}
    if((b=t.closest("[data-ext-src-on]"))){const s=(settings.sources||[]).find(x=>x.id===b.dataset.extSrcOn);if(s){s.on=!s.on;saveSettings();if(s.on)checkSources({});else renderExtUI();}return;}
    if((b=t.closest("[data-ext-src-del]"))){settings.sources=(settings.sources||[]).filter(x=>x.id!==b.dataset.extSrcDel);const err=saveSettings();if(err)updateRulesStatus("Couldn't save your sources: "+err,"err");return renderExtUI();}
    if((b=t.closest("[data-ext-src-fetch]"))){const s=(settings.sources||[]).find(x=>x.id===b.dataset.extSrcFetch);if(s)fetchAllRules([s.url]);return;}
    if(t.closest("#extCheckNow")){
      if(navigator.onLine===false)return updateRulesStatus("You're offline.","err");
      updateRulesStatus("Checking your sources…","");
      return checkSources({}).then(()=>updateRulesStatus("Checked.","ok"));}
    if(t.closest("#extAddGo")){
      const i=document.getElementById("extAddUrl");const v=i?i.value:"";
      updateRulesStatus("Reading that source…","");
      return addSource(v).then(r=>{updateRulesStatus(r.ok?(r.why||"Source added."):r.why,r.ok&&!r.why?"ok":"err");if(r.ok){renderExtUI();checkSources({});}});}
    if(t.closest("#extManual")&&typeof openManualInstall==="function")return openManualInstall();
  });
  /* a drop onto the page is a Manual install (spec §6.4; Task 6 defines it) */
  if(typeof extWireDrop==="function")extWireDrop(root);
}
```

  In `88-settings.js` `openSettings()`, replace the whole `const secRules=…;` with:

```js
  const secRules=extPageHTML()+
    (hasChar?setGroupHTML("This sheet",
      setRowHTML("Rules updates",`Last checked against <b>v${esc(character.appVersion||"—")}</b>; you're on v${esc(APP_VERSION)}. Compares this sheet with your loaded rules; a backup is saved first.`,
        `<button type="button" class="tbtn" id="btnCharUpdate">Check for rules updates</button>`)):"");
```

  Change the `body` map key `rules:secRules` to `extensions:secRules`, and
  `setNavHTML(pages,active,{rules:rulesNavBadgeHTML()})` to `{extensions:rulesNavBadgeHTML()}`.
  Replace the wiring from `renderSrcRows();renderRulesData();` through
  `document.getElementById("btnClearRules")…` with:

```js
  {const ep=document.getElementById("extPage");if(ep)wireExtPage(ep);}
```

  Keep the `#fileRules` change listener (:246) as it is; Task 6 reroutes it. Delete the
  `btnRulesTemplate` wiring wherever it is.

  `setPageOf`: `function setPageOf(stored,hasChar){const s=stored==="rules"?"extensions":stored;const p=setPagesFor(hasChar).find(x=>x.k===s);return p?p.k:"appearance";}`.

  `rulesNavBadgeHTML()`: find it with grep. Make it also show the update dot when `extPillCount()>0`,
  using the existing dot markup it already uses for updates, or `<span class="set-dot" aria-hidden="true"></span>`.

  `89-rules-merge.js`:
  - delete `renderSrcRows()` and `downloadRulesTemplates()`, and grep for and remove every caller;
  - in `renderRulesData()`, change `'[data-setbadge="rules"]'` to `'[data-setbadge="extensions"]'`
    and add `if(typeof renderExtUI==="function")renderExtUI();` at its end.

  `50-modal.css`, after the `.set-*` rules:

```css
/* #102 the Extensions page */
.ext-sec{margin:0 0 14px}
.ext-sec-h{display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--hair);margin-bottom:8px}
.ext-fold{flex:1;display:flex;align-items:center;gap:8px;min-height:44px;background:none;border:0;padding:0;font-family:var(--head);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);text-align:left;cursor:pointer}
.ext-car{width:12px;font-size:10px}
.ext-n{letter-spacing:0;text-transform:none;font-family:var(--body);font-size:12px}
.ext-secbtn{min-height:32px;padding:4px 10px}
.ext-banner{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;margin:0 0 12px;border:1.5px solid var(--warn);border-radius:8px;background:var(--panel)}
.ext-grow{flex:1;min-width:0}
.ext-list{border:1px solid var(--hair);border-radius:8px;background:var(--panel)}
.ext-row,.ext-src{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-top:1px dotted var(--hair)}
.ext-row:first-child,.ext-src:first-child{border-top:0}
.ext-main{flex:1 1 220px;min-width:0}
.ext-name{background:none;border:0;padding:0;min-height:32px;font-family:var(--head);font-size:14px;font-weight:700;color:var(--ink);text-align:left;cursor:pointer;text-decoration:underline dotted var(--hair);text-underline-offset:3px}
.ext-sum{font-size:13px;color:var(--ink-soft)}
.ext-from{font-size:12px;color:var(--ink-soft);opacity:.85}
.ext-from.ext-err{color:var(--brick);opacity:1}
.ext-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.chip.ext-req{border-color:var(--brick);color:var(--brick);background:none;cursor:pointer;font:inherit;font-size:11px;text-decoration:none}
.chip.ext-app{border-color:var(--warn);color:var(--warn)}
.ext-ver{font-family:ui-monospace,monospace;font-size:12px;color:var(--ink-soft);white-space:nowrap}
.ext-up{color:var(--accent-2)}
.ext-act{min-height:44px}
.ext-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ext-acts input{flex:1 1 220px;min-width:0}
.ext-dlg p{margin:0 0 8px}
.ext-meta{font-size:12px;color:var(--ink-soft);margin:0 0 8px}
.ext-box{border:1px solid var(--hair);border-radius:8px;padding:8px 10px;margin-top:10px;font-size:13px}
.ext-box div{padding:2px 0}
.ext-k{display:inline-block;width:84px;color:var(--ink-soft)}
```

- [ ] **Step 4: Run the tests**

  Run `node src/tests/data-archive.js | grep -E "^FAIL|LOAD FAIL|ALL PASSED"`. Then build and run
  everything:
  `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`,
  followed by `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.
  Expected: all suites pass. The `docs` suite fails if a wiki page still names `renderSrcRows` or
  `downloadRulesTemplates`; fix the wording as described under **Files**.

- [ ] **Step 5: Screenshot** the Extensions page at 1280 and 390 on the classic skin. Seed sources
  through `browser_evaluate`, using the test's objects. Save the shots as
  `102-t5-page-1280.png` and `102-t5-page-390.png`, plus the details dialog as
  `102-t5-details-1280.png`. Check that nothing scrolls sideways at 390 and that every button is at
  least 44px tall, except the 32px section Remove all, which is a deliberate secondary target.

- [ ] **Step 6: Commit**

```bash
git add src/js/88-settings.js src/js/89-rules-merge.js src/js/89-extensions.js src/css/50-modal.css src/tests/data-archive.js src/docs/wiki/features/settings-and-updates.md src/docs/wiki/roadmap/2.0.md src/docs/wiki/decisions.md
git commit -m "feat(#102): the Extensions page and the details dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The plan dialog, Manual install, and the pills

**Files:**
- Modify: `src/js/89-extensions.js`, appending to it.
- Modify: `src/fieldbook.template.html:20–21`, adding the Extensions pill and the app pill's ×.
- Modify: `src/js/30-version.js`, `showUpdatePill()` (:56–:63): respect
  `settings.dismissedUpdates.app`.
- Modify: `src/js/90-boot.js`:
  - (:310) wire the pills;
  - (:355–:356) the home screen's and the Rules tab's file inputs open the plan through
    `manualInstallFiles()`.
- Modify: `src/js/88-settings.js:246`: `#fileRules` → `manualInstallFiles`.
- Modify: `src/css/10-chrome.css`, after `.updpill` (:73–:74).
- Test: `src/tests/data-archive.js`.

**Interfaces:**
- Consumes: `planInstall`, `runInstall`, `manualCandidates`, `extPillCount`, `dismissUpdates`,
  `renderExtUI`, `openSettings`, and `toast(text, …)`.
- Produces:
  - `extPlanHTML(lines) -> string`;
  - `openInstallPlan(lines, opts)`;
  - `openManualInstall()`;
  - `manualInstallFiles(fileList) -> Promise`;
  - `readDropped(dataTransfer) -> Promise<[{name, bytes}]>`;
  - `renderExtPill()`;
  - `#extPill`, `#extPillGo`, `#extPillX` and `#updatePillX` in the template.

- [ ] **Step 1: Write the failing tests.** Add `'extPlanHTML','renderExtPill','showUpdatePill'` to
  the `loadApp` list.

```js
section('#102 the plan dialog and the pills', () => {
  X.resetRules();
  X.importPack({system: 'A', dataVersion: '1.0.0', spells: [{name: 'A1', level: 1}]}, 'a_full.json');
  const cand = (system, file, version, o) => Object.assign({key: system + '|' + file, category: 'rules', system, file, title: '<b>' + system + '</b>', version,
    minApp: '', sha256: '', size: 2048, requires: [], origin: 'm1', manual: false, get: () => Promise.resolve(new Uint8Array())}, o || {});
  const lines = X.planInstall([cand('A', 'a_full.json', '1.1.0'), cand('N', 'n_full.json', '1.0.0', {minApp: '99.0.0'}), cand('A2', 'a2_full.json', '1.0.0', {manual: true})]);
  const h = X.extPlanHTML(lines);
  ck('#102 the plan lists each pack with its outcome and versions', /1\.0\.0 → 1\.1\.0/.test(h) && /requires Fieldbook 99\.0\.0/.test(h) && /New/.test(h));
  ck('#102 ticked lines are checked; the blocked one is disabled', /data-plan-i="0"[^>]*checked/.test(h) && /data-plan-i="1"[^>]*disabled/.test(h));
  ck('#102 the confirm button counts the ticked lines', /id="planGo"[^>]*>Install 2</.test(h));
  ck('#102 plan titles are escaped', !h.includes('<b>A</b>') && h.includes('&lt;b&gt;A&lt;/b&gt;'));
  ck('#102 sizes read in KB', /2 KB/.test(h));
  const none = X.extPlanHTML(X.planInstall([cand('A', 'a_full.json', '1.0.0')]));
  ck('#102 a plan with nothing to do says so, with only Close', /Nothing to install/.test(none) && !/id="planGo"/.test(none));
  // the app pill respects dismissal
  const pill = {textContent: '', title: '', style: {}}, ver = {style: {}}, x = {hidden: true};
  const realGet = ctx.document.getElementById;
  ctx.document.getElementById = id => id === 'updatePill' ? pill : id === 'btnVer' ? ver : id === 'updatePillX' ? x : realGet(id);
  X.updateAvailable = {ver: '9.9.9', url: 'https://github.com/x'};
  X.settings.dismissedUpdates = {app: '9.9.9'};
  pill.style.display = 'none'; X.showUpdatePill();
  ck('#102 a cleared app update stays hidden', pill.style.display === 'none');
  X.updateAvailable = {ver: '9.9.10', url: 'https://github.com/x'};
  X.showUpdatePill();
  ck('#102 a newer app update shows again, with its ×', pill.style.display === 'inline-flex' && x.hidden === false);
  ctx.document.getElementById = realGet; X.updateAvailable = null; X.settings.dismissedUpdates = {};
  X.resetRules();
});
```

- [ ] **Step 2: Run them and watch them fail**

  Run: `node src/tests/data-archive.js | grep -E "^FAIL|LOAD FAIL" | head`
  Expected: `LOAD FAIL` or `FAIL`.

- [ ] **Step 3: Implement.** Append to `89-extensions.js`:

```js
/* ---- the plan dialog (spec §5 step 3) ---- */
function extSize(n){n=num(n);return n>=1048576?(Math.round(n/104857.6)/10)+" MB":Math.max(1,Math.round(n/1024))+" KB";}
const EXT_OUTCOME={install:"New",update:"Update",replace:"Replace",same:"Same version",older:"Older than yours",blocked:"",unsupported:""};
function extPlanHTML(lines){
  const ticked=lines.filter(l=>l.ticked&&l.canTick).length;
  if(!lines.some(l=>l.canTick))return `<p class="hint">Nothing to install: ${lines.length?"you already have these, or they need a newer Fieldbook.":"no rules packs found."}</p>`+
    (lines.length?`<div class="ext-list">${lines.map((l,i)=>extPlanRow(l,i)).join("")}</div>`:"")+
    `<div class="m-actions"><button type="button" class="tbtn" id="planClose">Close</button></div>`;
  return `<p class="hint">Nothing changes until you press Install. Every file is checked before any is installed.</p>`+
    `<div class="ext-list">${lines.map((l,i)=>extPlanRow(l,i)).join("")}</div>`+
    `<div class="status" id="planStatus"></div>`+
    `<div class="m-actions"><button type="button" class="tbtn" id="planClose">Cancel</button><button type="button" class="tbtn primary" id="planGo"${ticked?"":" disabled"}>Install ${ticked}</button></div>`;
}
function extPlanRow(l,i){
  const c=l.cand;
  const ver=l.have&&(l.outcome==="update"||l.outcome==="replace"||l.outcome==="same"||l.outcome==="older")?`${esc(l.have)} → ${esc(c.version||"?")}`:esc(c.version||"");
  const tag=l.outcome==="blocked"||l.outcome==="unsupported"?`<span class="chip ext-app">${esc(l.why)}</span>`:`<span class="ext-from">${esc(EXT_OUTCOME[l.outcome]||"")}${l.why&&l.outcome==="install"?" · "+esc(l.why):""}${l.why&&l.canTick&&!l.ticked?" · "+esc(l.why):""}</span>`;
  return `<label class="ext-row"><input type="checkbox" data-plan-i="${esc(String(i))}"${l.ticked&&l.canTick?" checked":""}${l.canTick?"":" disabled"}>`+
    `<span class="ext-main"><b>${esc(c.title)}</b><span class="ext-ver"> ${ver}</span><br>${tag}</span><span class="ext-ver">${c.size?esc(extSize(c.size)):""}</span></label>`;
}
function openInstallPlan(lines,opts){
  const o=opts||{};
  openModal("Install",extPlanHTML(lines),"",{});
  const back=()=>{closeModal();if(o.back==="settings")openSettings();};
  const close=document.getElementById("planClose");if(close)close.addEventListener("click",back);
  const go=document.getElementById("planGo");if(!go)return;
  const count=()=>{const n=lines.filter(l=>l.ticked&&l.canTick).length;go.textContent="Install "+n;go.disabled=!n;};
  document.querySelectorAll("[data-plan-i]").forEach(cb=>cb.addEventListener("change",()=>{lines[num(cb.dataset.planI)].ticked=cb.checked;count();}));
  go.addEventListener("click",()=>{
    go.disabled=true;const st=document.getElementById("planStatus");if(st)st.textContent="Downloading and checking…";
    runInstall(lines).then(r=>{
      if(!r.ok){if(st){st.className="status err";st.textContent=`Nothing was installed: ${r.error.file} — ${r.error.why}.`;}go.disabled=false;return;}
      const n=r.installed.length;
      toast(`Installed ${n} pack${n===1?"":"s"}${r.saveErr?". "+r.saveErr:""}`,null,{err:!!r.saveErr});
      back();
    });
  });
}
/* ---- Manual install (spec §6.4) ---- */
function extReadFile(f){
  return new Promise(res=>{const r=new FileReader();
    r.onload=()=>res({name:f.webkitRelativePath||f.name,bytes:new Uint8Array(r.result)});
    r.onerror=()=>res({name:f.name,bytes:null});r.readAsArrayBuffer(f);});
}
function manualInstallFiles(files,opts){
  const list=Array.from(files||[]);
  return Promise.all(list.map(extReadFile)).then(payloads=>extManualPlan(payloads,opts));
}
function extManualPlan(payloads,opts){
  const {cands,failed}=manualCandidates(payloads);
  const lines=planInstall(cands);
  openInstallPlan(lines,opts||{});
  if(failed.length){const st=document.getElementById("planStatus")||document.querySelector("#mBody .hint");
    if(st)st.insertAdjacentHTML("afterend",`<p class="status err">${esc(failed.map(f=>`Skipped ${f.name}: ${f.why}.`).join(" "))}</p>`);}
}
/* a drop: files, a zip, or whole folders (webkitGetAsEntry), read recursively */
function readDropped(dt){
  const out=[],jobs=[];
  const walk=(entry,prefix)=>new Promise(res=>{
    if(!entry)return res();
    if(entry.isFile)return entry.file(f=>extReadFile(f).then(p=>{p.name=prefix+f.name;out.push(p);res();}),()=>res());
    if(entry.isDirectory){const rd=entry.createReader(),all=[];
      const more=()=>rd.readEntries(es=>{if(!es.length)return Promise.all(all.map(x=>walk(x,prefix+entry.name+"/"))).then(()=>res());all.push(...es);more();},()=>res());
      return more();}
    res();
  });
  const items=dt&&dt.items?Array.from(dt.items):[];
  if(items.length&&items[0].webkitGetAsEntry)items.forEach(it=>jobs.push(walk(it.webkitGetAsEntry(),"")));
  else Array.from((dt&&dt.files)||[]).forEach(f=>jobs.push(extReadFile(f).then(p=>out.push(p))));
  return Promise.all(jobs).then(()=>out);
}
function openManualInstall(){
  openModal("Manual install",
    `<p class="hint">Downloaded a data zip or pack files? Choose them or drop them here. You'll see what changes before anything installs.</p>`+
    `<div class="ext-acts"><button type="button" class="tbtn" id="miFiles">Choose files</button><button type="button" class="tbtn" id="miFolder">Choose a folder</button></div>`+
    `<div class="ext-drop" id="miDrop" tabindex="0">Drop files, a zip or a folder here</div>`+
    `<input type="file" id="miFileIn" multiple accept="application/json,.json,application/zip,.zip" class="hidefile">`+
    `<input type="file" id="miDirIn" webkitdirectory multiple class="hidefile">`,"",{});
  const fi=document.getElementById("miFileIn"),di=document.getElementById("miDirIn"),drop=document.getElementById("miDrop");
  document.getElementById("miFiles").addEventListener("click",()=>fi.click());
  document.getElementById("miFolder").addEventListener("click",()=>di.click());
  [fi,di].forEach(inp=>inp.addEventListener("change",()=>{if(inp.files.length)manualInstallFiles(inp.files,{back:"settings"});}));
  extWireDrop(drop);
}
/* files, a zip or a folder dropped on the Manual install box or the Extensions page */
function extWireDrop(el){
  el.addEventListener("dragover",e=>{e.preventDefault();el.classList.add("ext-dropping");});
  el.addEventListener("dragleave",()=>el.classList.remove("ext-dropping"));
  el.addEventListener("drop",e=>{e.preventDefault();el.classList.remove("ext-dropping");
    readDropped(e.dataTransfer).then(p=>{if(p.length)extManualPlan(p,{back:"settings"});});});
}
/* ---- the pills (spec §6.1) ---- */
function renderExtPill(){
  const wrap=document.getElementById("extPill"),go=document.getElementById("extPillGo");if(!wrap||!go)return;
  const n=extPillCount();
  wrap.hidden=!n;
  if(n){go.innerHTML=`<span class="extpill-long">Extensions · </span>${esc(String(n))} update${n===1?"":"s"}`;
    go.title=`${n} extension update${n===1?"":"s"} — open Settings → Extensions`;}
}
```

  In `src/fieldbook.template.html`, after the `updatePill` line (:21):

```html
  <button class="updpill-x" id="updatePillX" hidden aria-label="Clear the app update notice" title="Clear until a newer version">×</button>
  <span class="extpill" id="extPill" hidden><button class="updpill" id="extPillGo"></button><button class="updpill-x" id="extPillX" aria-label="Clear the extension update notice" title="Clear until a newer version">×</button></span>
```

  In `30-version.js` `showUpdatePill()`, after `if(!updateAvailable)return;`:

```js
  /* cleared until a newer version (#102, spec decision 9) */
  const cleared=(settings.dismissedUpdates||{}).app;
  if(cleared&&cmpVer(updateAvailable.ver,cleared)<=0)return;
```

  and at its end: `const x=document.getElementById("updatePillX");if(x)x.hidden=false;`.

  In `90-boot.js`, after the `_up` line (:310):

```js
  /* #102: the pills' × clears a notice until a newer version arrives */
  {const x=document.getElementById("updatePillX");if(x)x.addEventListener("click",()=>{
    if(!updateAvailable)return;settings.dismissedUpdates=settings.dismissedUpdates||{};settings.dismissedUpdates.app=updateAvailable.ver;saveSettings();
    const p=document.getElementById("updatePill");if(p)p.style.display="none";x.hidden=true;
    const v=document.getElementById("btnVer");if(v)v.style.display="";});}
  {const g=document.getElementById("extPillGo");if(g)g.addEventListener("click",()=>{settings.setPage="extensions";openSettings();});}
  {const x=document.getElementById("extPillX");if(x)x.addEventListener("click",()=>{dismissUpdates();saveSettings();renderExtPill();});}
```

  At :355–:356 and in `88-settings.js:246`, replace `importRulesFiles(e.target.files)` with
  `manualInstallFiles(e.target.files)`. Keep `importRulesFiles` itself: its tests and the settings
  import still use it.

  `10-chrome.css`, after `.updpill:hover`:

```css
.updpill-x{align-self:center;min-width:32px;min-height:32px;border:0;border-radius:999px;background:none;color:var(--ink-soft);font-size:16px;cursor:pointer;margin-left:-6px}
.extpill{display:inline-flex;align-items:center;gap:0;align-self:center;margin-right:auto}
.extpill[hidden],.updpill-x[hidden]{display:none}
@media (max-width:480px){.extpill-long{display:none}}
```

  And in `50-modal.css`, add
  `.ext-drop{margin-top:8px;padding:22px;border:1.5px dashed var(--hair);border-radius:8px;text-align:center;color:var(--ink-soft)}`
  and `.ext-drop.ext-dropping,#extPage.ext-dropping{outline:2px dashed var(--accent);outline-offset:4px}`.

- [ ] **Step 4: Run the tests**

  Run `node src/tests/data-archive.js | grep -E "^FAIL|LOAD FAIL|ALL PASSED"`, then the full suite
  (build, run, restore).
  Expected: all suites pass.

- [ ] **Step 5: Drive and screenshot.** Serve a manifest the browser can fetch: write
  `/private/tmp/claude-501/-Users-mwardman-Documents-Repos-RPGFieldbook/20248c39-e02c-4175-bbc8-2f38bb742b56/scratchpad/ext/`
  with a `fieldbook-data.json` and two packs, using real sha256 values. If `fetch` of a `file://` URL
  is refused, stub `fetch` in the page with `browser_evaluate` to answer from an in-page map.
  Drive, in this order:
  1. add the source;
  2. watch the pill appear;
  3. clear it with ×;
  4. Update all, then check the plan's ticks;
  5. Install, and confirm the toast;
  6. break one sha256 and try again: nothing installed, and the error names the file;
  7. Manual install with Choose files.

  Save `102-t6-plan-1280.png`, `102-t6-plan-error-1280.png`, `102-t6-pill-1280.png`,
  `102-t6-pill-390.png` and `102-t6-manual-390.png`. Report what you drove and what you didn't:
  drag and drop from the OS can't be driven headless.

- [ ] **Step 6: Commit**

```bash
git add src/js/89-extensions.js src/fieldbook.template.html src/js/30-version.js src/js/90-boot.js src/js/88-settings.js src/css/10-chrome.css src/css/50-modal.css src/tests/data-archive.js
git commit -m "feat(#102): the install plan, Manual install, and clearable update pills

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Browser QA, docs, release notes

**Files:**
- The pages in spec §10: `wiki/architecture/data-archive.md`, `wiki/architecture/rules-packs.md`,
  `wiki/features/settings-and-updates.md`, `wiki/data/data-kit.md`, `wiki/roadmap/known-issues.md`,
  `wiki/overview.md`, `wiki/roadmap/1.9.0.md`, `wiki/decisions.md`, and also
  `wiki/architecture/storage.md` (the settings keys) and `wiki/ui/shell.md` (the boot line and the
  pills).
- `CLAUDE.md`: constraint 2 names manifest update checks and pack downloads; the JS count is 38.
- `src/docs/RELEASING.md` (Task 2 touched it; finish it).
- `docs/rules-schema.md`, which ships: add "Publishing extensions" and remove its Get templates
  mention.
- `src/docs/_claude/WIRING-LEDGER.md`, `src/docs/UNRELEASED.md`, and the spec's As built.

CSS changes here are for tuning only. A JS bug found here is a finding for the controller, not
something to fix in this task.

- [ ] **Step 1: Before shots** from main's build,
  `file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`: Settings → Rules data
  at 1280 and 390. Save them as
  `.claude/qa/in-progress/102-extensions/102-before-rules-data-{1280,390}.png`.
- [ ] **Step 2: After shots and driven checks,** saved as `102-after-*.png`:
  - the Extensions page with an update and with nothing to update;
  - a blocked pack;
  - Unsupported;
  - a folded section;
  - the details dialog;
  - a requires chip tapped, both kinds;
  - Update all;
  - the plan with a pulled-in requirement;
  - an install that fails and changes nothing;
  - Manual install with files and with a folder;
  - the pill and its ×, and the app pill's ×;
  - offline Check now;
  - both skins, light and dark, at 1280 and 390;
  - the console stays clean.

  Report what you drove and what you didn't.
- [ ] **Step 3: Docs.**
  - Append `## Extensions and manifest installs (#102, <today>)` to the ledger. It is append-only;
    read back its line number.
  - Rewrite the pages above to the new truth, each with a History line citing that L-number.
  - Add Decisions rows and register lines for the spec's 21 decisions, one line each.
  - Close known-issues' "A data update is announced, never installed".
  - Write the spec's As built: every Ruling and deferred Minor from the controller's
    `progress.md`.
  - Add the three `UNRELEASED.md` bullets from spec §10.
  - Mark #102 built on the 1.9.0 page.
- [ ] **Step 4: Run the full suite.** It must pass. Then restore the build files.
- [ ] **Step 5: Commit** as `docs(#102): …`, and any CSS tuning separately as `style(#102): …`.
