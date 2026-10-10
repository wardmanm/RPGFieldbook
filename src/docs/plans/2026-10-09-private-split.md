# The private data split and the data kit — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public Fieldbook carries only SRD 5.2 and homebrew rules data; the copyrighted packs live and release in `wardmanm/RPGFieldbookPrivate`; a data kit builds archives from a 5e-tools export.

**Architecture:** The kit (`tools/data-kit/fbdata.py`) takes over bundling from `bundle-rules.js` and gains `build`/`convert`; the public text loses its book quotes; the four packs, their extractor and their content tests move to a private repo created from this repo's history with `git filter-repo`, which runs its tests against a public checkout; one public commit then removes the data and everything that depended on it.

**Tech Stack:** Python 3.8+ stdlib (kit, converter, tests), Node 20 (app tests, release scripts), bash (`build.sh`, `run.sh`, `dev.sh`, `wt.sh`), GitHub Actions, `git filter-repo`.

**Spec:** `src/docs/specs/2026-10-09-private-split-design.md` (approved 2026-10-09). Read it first; R-numbers below are its rulings.

## Global Constraints

**Git, releases and the private repo — never violate**
- **No release of any kind.** Never run `./build.sh --release`, `node scripts/release.js`, or `node scripts/data-release.js` without `--dry-run`. Never hand-edit `APP_VERSION`, `DATA_VERSIONS`, the `CHANGELOG` array, or any `version`/`digest`/`release` value in a `packs.json`. Never run `fbdata.py versions --seed` or `--bump` on a real registry. No tag, no push, no merge.
- **Nothing outward-facing.** Never `git push` in either repo, never run `gh release` (create, edit, upload, delete) or `gh api` writes, never delete release assets. The controller does these with Mike's go-ahead.
- **Branch commits carry source, data and docs only.** Never `git add` `dist/fieldbook.html` or `docs/CHANGELOG.md`; `git add` explicit paths; never `git stash` in any form.
- **The private repo** is created at `/Users/mwardman/Documents/Repos/RPGFieldbookPrivate` (Task 8) and reached as `_private-data` (a symlink, gitignored) from `/Users/mwardman/Documents/Repos/RPGFieldbook` and from this worktree. Its remote is `git@github.com:wardmanm/RPGFieldbookPrivate.git`, set but **never pushed**.
- **From Task 7 on, the four private packs' data never changes in this repo** except by deletion in Task 10. Before that deletion, `diff -r` proves the private copy identical.
- Commit messages end with exactly: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

**The build and data**
- The app ships as ONE file, `dist/fieldbook.html`. No `import`/`export`, no network beyond the existing optional fetches.
- **Byte hygiene:** LF only, one final newline, no BOM, no CR. **Never write a backslash-u escape in any file** (your editing tool may decode it into a real character): build such characters with `chr()` in Python and `String.fromCharCode()` in JS. Straight apostrophes in fixtures.
- `fbdata.py`, `convert.py`, `srd_text.py` and every new Python file: Python 3.8+, standard library only.
- **The SRD gate stays clean in every task:** `python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o /tmp/srd && diff -r /tmp/srd data/srd52`
- **The 2024 gate** stays clean except for Task 3's intended change, after which it is clean again: `python3 scripts/convert.py all _conversion-data/5etools-v2.36.1 -o /tmp/chk && diff -r /tmp/chk data/5e2024` (from Task 10: `… && diff -r /tmp/chk _private-data/data/5e2024`).
- **Tests pass without the dump, the PDFs or `_private-data`** (CI has none of them). Build before `run.sh`: `./build.sh --no-zip`.
- **CLAUDE.md's suite count** stays in step with `run.sh` (the `docs` suite checks). It stays **ten**.

**Settled values (spec)**
- Licences a public release may carry: `CC-BY-4.0`, `CC-BY-SA-3.0`, `MIT`.
- Asset names: `fieldbook-data-kit-<ver>.zip` (public, beside `fieldbook-data-standalone-<ver>.zip`); `fieldbook-data-private-<ver>.zip` (private repo only). Private tags: `data-vX.Y.Z-N`.
- Leak scan: a run of **14** words shared with the private packs and absent from SRD and homebrew **fails**; runs of **10** are **reported**. Allowlist entry: `{"file": <repo path>, "hash": <first 16 hex of sha256 of the run's normalised words joined by one space>, "why": <text>}`.
- Homebrew `requires`: group 1 `{"pack": "SRD 5.2", "file": "srd52_full.json", …}`; group 2 `{"pack": "Xanathar's Guide to Everything", …}` with no `file`.
- Screenshots: the project's `mcp__playwright__*` tools only, never `mcp__plugin_playwright_*`; shots in `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/` as `85-*.png`; 390 px wide; both skins.

## Review Focus

The five conditions the spec implies that no task's own feature tests would otherwise reach, most likely first. Each has its test in the named task.

1. **A v1.7.2 player who upgrades with the old XPHB, Humblewood, XGE or TCE packs loaded** sees each pack's version quietly, no "update available" alarm and no newer-data notice. → Task 4.
2. **CI with no private data at all**: every public suite passes, and no public test names a private path. → Tasks 9 and 10.
3. **A kit user with only the kit zip**, unzipped anywhere, runs `fbdata.py build` on a 5e-tools export and gets an archive the app opens. → Task 2b.
4. **A public release cannot carry a private pack**: an archive with a pack whose licence is missing or not allowlisted fails validation, and an asset named `*private*` fails the workflow. → Task 2a, Task 2b.
5. **The `private-data` suite tells the truth**: absent `_private-data` → SKIP; present and failing → FAILED; present and passing → its count. → Task 8.

---

### Task 1: The Python bundler, proved byte-for-byte against the Node one (R11)

**Files:**
- Modify: `tools/data-kit/fbdata.py` (add `CATS`, `bundle()`, `bundle_text()`, `cmd_bundle()`, the `bundle` subcommand)
- Modify: `src/tests/data-kit.py`
- Then (commit 2): `build.sh`, `src/tests/run.sh`, `.github/workflows/ci.yml`, `dev.sh`, `src/js/30-version.js` (comment only), `src/tests/rules-data.js` (comments only), delete `scripts/bundle-rules.js`; docs naming it (listed in Step 9)

**Interfaces:**
- Produces: `fbdata.py bundle [--registry F] [--data-root D] -o OUTDIR` → one `<file>` per registered pack whose folder exists; exit 1 if any pack has errors. Python API: `bundle(pack, data_root) -> dict` returning exactly one of `{"skipped": str}`, `{"errors": [str]}`, `{"obj": dict, "files": int, "dupes": [str], "nameless": [str]}`; `bundle_text(obj) -> str` (the bytes a bundle file holds, as text, ending in `"\n"`).
- Later tasks call `python3 tools/data-kit/fbdata.py bundle -o dist` wherever `node scripts/bundle-rules.js` was called.

- [ ] **Step 1: Read the Node bundler** — `scripts/bundle-rules.js` in full. The port must reproduce its output bytes for every real pack. Note its rules: one `system` per folder; `excludeSystems` and `requires` are folder-level and must agree across a folder's files (compared as `JSON.stringify`, i.e. key order matters); `features` falls back to `traits` only when `features` is JS-falsy (an empty array is truthy); same key in a category replaces in place (last wins) and is reported; a nameless entry is kept and reported; the pack's keys are written in the order `system, name, version(1), dataVersion?, rulebook, license?, attribution?, excludeSystems?, requires?, <CATS in order, non-empty only>`; output is `JSON.stringify(pack) + "\n"`.

- [ ] **Step 2: Write the failing parity test** — append to `src/tests/data-kit.py`, above `# ---- add new cases above this line ----`:

```python
# ---------- fbdata.py bundle writes what bundle-rules.js wrote, byte for byte (#85, R11)
NODE_BUNDLER = os.path.join(ROOT, "scripts", "bundle-rules.js")


def node_bundle(root):
    """bundle-rules.js run on a scratch root laid out like this repo: root/data, root/dist"""
    os.makedirs(os.path.join(root, "scripts"), exist_ok=True)
    shutil.copy(NODE_BUNDLER, os.path.join(root, "scripts", "bundle-rules.js"))
    return subprocess.run(["node", os.path.join(root, "scripts", "bundle-rules.js")], capture_output=True, text=True)


def py_bundle(root, out):
    return subprocess.run([sys.executable, FBDATA, "bundle", "-o", out,
                           "--registry", os.path.join(root, "data", "packs.json"),
                           "--data-root", os.path.join(root, "data")], capture_output=True, text=True)


def same_bundles(root):
    """(ok, detail): both bundlers agree on success and on every byte they write"""
    n, p = node_bundle(root), py_bundle(root, os.path.join(root, "pyout"))
    if (n.returncode == 0) != (p.returncode == 0):
        return False, ("exit", n.returncode, p.returncode, n.stderr[-300:], p.stderr[-300:])
    nd, pd = os.path.join(root, "dist"), os.path.join(root, "pyout")
    nf = sorted(os.listdir(nd)) if os.path.isdir(nd) else []
    pf = sorted(os.listdir(pd)) if os.path.isdir(pd) else []
    if nf != pf:
        return False, ("files", nf, pf)
    for f in nf:
        with open(os.path.join(nd, f), "rb") as a, open(os.path.join(pd, f), "rb") as b:
            if a.read() != b.read():
                return False, ("bytes differ", f)
    return True, len(nf)


if os.path.exists(NODE_BUNDLER):
    # every real pack, from a copy of data/ (never the repo's own dist/)
    d = tempfile.mkdtemp(prefix="fbdata-parity-")
    shutil.copytree(os.path.join(ROOT, "data"), os.path.join(d, "data"))
    ok, why = same_bundles(d)
    ck("bundle: every real pack, byte for byte the Node bundle", ok, why)
    shutil.rmtree(d)

    def case(name, files, packs):
        d = tempfile.mkdtemp(prefix="fbdata-case-")
        for rel, obj in files.items():
            write(d, "data/" + rel, obj if not isinstance(obj, str) else None, obj if isinstance(obj, str) else None)
        write(d, "data/packs.json", {"release": "1.8.0", "packs": packs})
        ok, why = same_bundles(d)
        ck("bundle parity: " + name, ok, why)
        shutil.rmtree(d)

    P = lambda **kw: dict({"system": "Z", "dir": "z", "file": "z_full.json", "title": "Zed"}, **kw)
    case("duplicates replace in place, last wins",
         {"z/a.json": {"system": "Z", "spells": [{"name": "Bolt", "level": 1}, {"name": "Glow"}]},
          "z/b.json": {"system": "Z", "spells": [{"name": "bolt ", "level": 2}]}}, [P(version="1.8.0")])
    case("nameless entries are kept",
         {"z/a.json": {"system": "Z", "items": [{"name": ""}, {"weight": 1}, "junk", [1]]}}, [P()])
    case("keywords key by term, or by name when the term is blank",
         {"z/a.json": {"system": "Z", "keywords": [{"term": " ", "name": "Gleam"}, {"term": "gleam", "name": "x"},
                                                   {"term": 0, "name": "zero"}, {"name": "Other"}]}}, [P()])
    case("subclasses key by class and name",
         {"z/a.json": {"system": "Z", "subclasses": [{"class": "Seer", "name": "Path"}, {"class": "Monk", "name": "Path"},
                                                     {"name": "Orphan"}, {}]}}, [P()])
    case("features fall back to traits only when features is absent",
         {"z/a.json": {"system": "Z", "traits": [{"name": "Keen"}]},
          "z/b.json": {"system": "Z", "features": [], "traits": [{"name": "Lost"}]}}, [P()])
    case("excludeSystems, requires, licence and credit carried",
         {"z/a.json": {"system": "Z", "excludeSystems": ["b", " a ", ""], "requires": [{"pack": "Q", "spells": ["S"]}],
                       "races": [{"name": "Gnomish"}]},
          "z/b.json": {"system": "Z", "excludeSystems": ["a", "b"], "requires": [{"pack": "Q", "spells": ["S"]}]}},
         [P(version="1.8.0-2", license="MIT", attribution="By someone.")])
    case("excludeSystems disagreeing across files fails",
         {"z/a.json": {"system": "Z", "excludeSystems": ["a"]}, "z/b.json": {"system": "Z", "excludeSystems": ["b"]}}, [P()])
    case("requires with its keys in another order fails",
         {"z/a.json": {"system": "Z", "requires": [{"pack": "Q", "file": "q.json"}]},
          "z/b.json": {"system": "Z", "requires": [{"file": "q.json", "pack": "Q"}]}}, [P()])
    case("a folder whose files name another system fails",
         {"z/a.json": {"system": "Other", "feats": [{"name": "Tough"}]}}, [P()])
    case("two systems in one folder fails",
         {"z/a.json": {"system": "Z"}, "z/b.json": {"system": "Y"}}, [P()])
    case("invalid JSON fails", {"z/a.json": "{nope"}, [P()])
    case("a missing folder or an empty one is skipped",
         {"y/readme.txt": "not json"}, [P(), P(system="Y", dir="y", file="y_full.json", title="Why")])
    case("text outside ASCII, numbers and floats",
         {"z/a.json": {"system": "Z", "items": [{"name": "Café — ✦", "weight": 0.5, "cost": 5.0, "n": -0, "big": 12345678}]}},
         [P()])
```

- [ ] **Step 3: Run it to see it fail**

Run: `python3 src/tests/data-kit.py | tail -3`
Expected: `FAILURES: bundle: every real pack, …` and every `bundle parity:` case (`fbdata.py` has no `bundle` command: exit 2).

- [ ] **Step 4: Implement `bundle` in `tools/data-kit/fbdata.py`** — after `cmd_validate()`, before `main()`:

```python
# ---------- bundling (#85, R11): the port of scripts/bundle-rules.js
# Rules categories a bundle carries, in the order it writes them. Must stay in
# step with RULE_CATS in src/js/88-settings.js; "traits" is read as "features".
CATS = ("keywords", "features", "items", "spells", "races", "classes",
        "feats", "backgrounds", "subclasses", "tables")
# JavaScript's String.prototype.trim() set, so keys match the app's (and the
# Node bundler's) exactly. Built with chr() — no escapes in this file.
_JS_WS = "".join(map(chr, [9, 10, 11, 12, 13, 32, 0xA0, 0x1680] + list(range(0x2000, 0x200B))
                     + [0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF]))
_LONE = re.compile("[%s-%s]" % (chr(0xD800), chr(0xDFFF)))


def _truthy(v):
    """JavaScript truthiness: [] and {} are true; 0, "" and null are not."""
    if v is None or v is False:
        return False
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v == v and v != 0
    if isinstance(v, str):
        return v != ""
    return True


def _num(v):
    """String(n) for a finite number, as JavaScript writes it."""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return repr(v) if isinstance(v, float) else str(v)


def _name(v):
    """String(v || "") for a name field. A name that is not text, a number or
    true is nameless here; the Node bundler stringified it. No pack has one."""
    if not _truthy(v):
        return ""
    if v is True:
        return "true"
    if isinstance(v, str):
        return v
    if isinstance(v, (int, float)):
        return _num(v)
    return ""


def _key(entry, cat):
    """subclasses key by class|name, keywords by term (or name when the term is
    blank), everything else by name; "" is an entry the app skips at import."""
    if not isinstance(entry, dict):
        return ""
    if cat == "keywords":
        term = entry.get("term")
        blank = term is None or (isinstance(term, str) and not term.strip(_JS_WS))
        v = entry.get("name") if blank else term
        s = v if isinstance(v, str) else (_num(v) if isinstance(v, (int, float)) and not isinstance(v, bool)
                                          and v == v and v not in (float("inf"), float("-inf")) else "")
        return s.strip(_JS_WS).lower()
    if cat == "subclasses":
        return (_name(entry.get("class")) + "|" + _name(entry.get("name"))).strip(_JS_WS).lower()
    return _name(entry.get("name")).strip(_JS_WS).lower()


def _same(a, b):
    """JSON.stringify(a) === JSON.stringify(b): key order counts"""
    return json.dumps(a, ensure_ascii=False, separators=(",", ":")) == json.dumps(b, ensure_ascii=False, separators=(",", ":"))


def _ints(x):
    """JSON.stringify writes 5.0 as 5"""
    if isinstance(x, float) and x.is_integer():
        return int(x)
    if isinstance(x, list):
        return [_ints(v) for v in x]
    if isinstance(x, dict):
        return {k: _ints(v) for k, v in x.items()}
    return x


def _refuse(tok):
    raise ValueError("%s is not JSON" % tok)


def bundle_text(obj):
    """The bundle file's text: JSON.stringify(obj) + "\\n", byte for byte. Lone
    surrogates are written as escapes, as JSON.stringify does."""
    s = json.dumps(_ints(obj), ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return _LONE.sub(lambda m: chr(92) + "u%04x" % ord(m.group()), s) + "\n"


def bundle(pack, data_root):
    """One registered pack's folder rolled into one bundle object (spec #83 §4)."""
    folder = os.path.join(data_root, pack["dir"])
    shown = pack["dir"]
    if not os.path.isdir(folder):
        return {"skipped": "no data/%s/ directory" % shown}
    files = sorted(f for f in os.listdir(folder) if f.endswith(".json"))
    if not files:
        return {"skipped": "data/%s/ has no .json files" % shown}
    out, seen, errors, dupes, nameless = {}, {}, [], [], []
    system, exclude, requires = "", None, None
    for f in files:
        try:
            with open(os.path.join(folder, f), encoding="utf-8") as fh:
                obj = json.loads(fh.read(), parse_constant=_refuse)
        except (OSError, ValueError) as e:
            errors.append("%s/%s: not valid JSON — %s" % (shown, f, e))
            continue
        if not isinstance(obj, dict):
            errors.append("%s/%s: not a JSON object" % (shown, f))
            continue
        s = _name(obj.get("system")).strip(_JS_WS)
        if s:
            if not system:
                system = s
            elif s != system:
                errors.append('%s/%s: system "%s" but the folder is "%s"' % (shown, f, s, system))
        if isinstance(obj.get("excludeSystems"), list):
            e = sorted(x for x in (_name(v) if not isinstance(v, (list, dict)) else "" for v in obj["excludeSystems"])
                       for x in [x.strip(_JS_WS)] if x)
            if exclude is None:
                exclude = e
            elif e != exclude:
                errors.append("%s/%s: excludeSystems [%s] but the folder declares [%s]"
                              % (shown, f, ",".join(e), ",".join(exclude)))
        if isinstance(obj.get("requires"), list):
            if requires is None:
                requires = obj["requires"]
            elif not _same(obj["requires"], requires):
                errors.append("%s/%s: requires differs from the rest of the folder" % (shown, f))
        for cat in CATS:
            # JavaScript's obj.features || obj.traits: an empty features list is truthy
            if cat == "features":
                arr = obj.get("features") if _truthy(obj.get("features")) else obj.get("traits")
            else:
                arr = obj.get(cat)
            if not isinstance(arr, list):
                continue
            out.setdefault(cat, [])
            seen.setdefault(cat, {})
            for e in arr:
                k = _key(e, cat)
                if not k:
                    out[cat].append(e)
                    nameless.append("%s in %s" % (cat, f))
                    continue
                prev = seen[cat].get(k)
                if prev:
                    out[cat][prev[0]] = e
                    label = e.get("name") or e.get("term") or k
                    dupes.append('%s "%s" (%s -> %s)' % (cat, label, prev[1], f))
                    continue
                seen[cat][k] = (len(out[cat]), f)
                out[cat].append(e)
    if errors:
        return {"errors": errors}
    if system and system != pack["system"]:
        return {"errors": ['%s: its files say system "%s" but data/packs.json says "%s"' % (shown, system, pack["system"])]}
    res = {"system": pack["system"], "name": pack["title"], "version": 1}
    if pack.get("version"):
        res["dataVersion"] = pack["version"]
    res["rulebook"] = True
    if pack.get("license"):
        res["license"] = pack["license"]
    if pack.get("attribution"):
        res["attribution"] = pack["attribution"]
    if exclude:
        res["excludeSystems"] = exclude
    if requires:
        res["requires"] = requires
    for cat in CATS:
        if out.get(cat):
            res[cat] = out[cat]
    return {"obj": res, "files": len(files), "dupes": dupes, "nameless": nameless}


def cmd_bundle(a):
    reg = load_registry(a.registry)
    os.makedirs(a.output, exist_ok=True)
    failed = False
    for p in reg["packs"]:
        r = bundle(p, a.data_root)
        if "skipped" in r:
            print("    skipped %s — %s" % (p["file"], r["skipped"]))
            continue
        if "errors" in r:
            failed = True
            print("    FAILED %s:" % p["file"], file=sys.stderr)
            for e in r["errors"]:
                print("      - " + e, file=sys.stderr)
            continue
        dest = os.path.join(a.output, p["file"])
        text = bundle_text(r["obj"])
        tmp = dest + ".tmp"
        with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        os.replace(tmp, dest)
        counts = ["%d %s" % (len(r["obj"][c]), c) for c in CATS if c in r["obj"]]
        print("    %s  (%d files, %d KB)" % (os.path.relpath(dest), r["files"], round(len(text.encode("utf-8")) / 1024)))
        print("      " + " · ".join(counts))
        if r["dupes"]:
            print("      deduped %d: %s" % (len(r["dupes"]), ", ".join(r["dupes"])))
        if r["nameless"]:
            print("      %d with no name, which the app will skip: %s" % (len(r["nameless"]), ", ".join(r["nameless"])))
    return 1 if failed else 0
```

In `main()`, after the `validate` parser:

```python
    p = sub.add_parser("bundle", help="roll each registered pack's folder into one importable file")
    common(p)
    p.add_argument("-o", "--output", required=True, help="the folder to write the bundles to (dist/)")
    p.set_defaults(fn=cmd_bundle)
```

and add `bundle` to the module docstring's usage block:

```
    fbdata.py bundle   -o DIR [--registry F] [--data-root D]
```

`excludeSystems` entries: JS `String(x).trim()` on each. A non-text, non-number entry (a list or object) is dropped here; no pack has one, and the parity cases do not include one.

- [ ] **Step 5: Run the suite to see it pass**

Run: `python3 src/tests/data-kit.py | tail -3`
Expected: `ALL PASSED (n)`, every `bundle parity:` line PASS. If a real pack differs, find the first differing byte (`cmp` the two files) and fix the port, never the data.

- [ ] **Step 6: Commit the port and its proof**

```bash
git add tools/data-kit/fbdata.py src/tests/data-kit.py
git commit -m "feat: fbdata.py bundle — the Python port of bundle-rules.js, byte for byte (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Switch every caller to `fbdata.py bundle`**

- `build.sh` `bundle_packs()`:

```bash
bundle_packs() {
  echo "==> Bundling rules packs"
  local py
  py=$(find_python) || { echo "    bundling needs python3 (tools/data-kit/fbdata.py)"; exit 1; }
  "$py" tools/data-kit/fbdata.py bundle -o dist || { echo "    bundling failed"; exit 1; }
}
```

  and in the header comment replace "The zips need python3 (tools/data-kit/fbdata.py writes the data archive); --no-zip does not." with "Every build needs python3: tools/data-kit/fbdata.py bundles the rules packs and writes the data archive."
- `src/tests/run.sh`: move the `PY=` probe above the bundling line, and replace `node scripts/bundle-rules.js >/dev/null || …` with `"$PY" tools/data-kit/fbdata.py bundle -o dist >/dev/null || { echo "bundling failed"; exit 1; }`. Update the comment above it to name `fbdata.py bundle`.
- `.github/workflows/ci.yml` "Rules packs bundle cleanly": `run: python3 tools/data-kit/fbdata.py bundle -o dist`.
- `dev.sh` menu item 5: `run "$PY" tools/data-kit/fbdata.py bundle -o dist` (read the menu text around it and keep its label accurate).
- `src/js/30-version.js` comment (line ~7) and `src/tests/rules-data.js` comments (~459, ~939), `src/tests/data-kit.py`'s `bundles()` docstring: say `fbdata.py bundle` instead of `bundle-rules.js`.
- `git rm scripts/bundle-rules.js`.
- In `src/tests/data-kit.py`, the parity block now skips (no Node bundler). Replace it with golden checks that pin the port's behaviour on their own: keep the `case(...)` inputs, but run only `py_bundle` and assert, for "duplicates replace in place, last wins", that `z_full.json` equals exactly
  `{"system":"Z","name":"Zed","version":1,"dataVersion":"1.8.0","rulebook":true,"spells":[{"name":"bolt ","level":2},{"name":"Glow"}]}` + `"\n"`;
  for "nameless entries are kept", that the four items are kept in order; for "features fall back …", that `features` holds only `Keen`; for each failing case, exit 1; for "a missing folder or an empty one is skipped", exit 0 and no file written; and `bundle_text({"a": 5.0, "b": chr(0xD800)})` equals `'{"a":5,"b":"' + chr(92) + 'ud800"}\n'`.

- [ ] **Step 8: Build and run everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: `All 10 suites passed`. `git status --short` shows `dist/fieldbook.html` modified (never stage it).

- [ ] **Step 9: The docs that name the Node bundler**

`src/tests/docs.js` checks that every function a wiki page names exists. Rewrite each mention to the Python bundler (`bundle()` / `cmd_bundle()` in `tools/data-kit/fbdata.py`; `load_registry()` for the registry read), in present tense:
`src/docs/wiki/architecture/rules-packs.md` (lines ~20, 187, 203, 228), `data/converter.md` (~7, 24, 273, 369; delete the known-issue bullet at ~581 about a comment in `bundle-rules.js` — the file is gone), `data/homebrew.md` (~11), `data/supplements.md` (~14, 114), `features/settings-and-updates.md` (~22, 105), `overview.md` (~20, and the code map line ~89: `fbdata.py bundle` replaces the `bundle-rules.js` line), `process/building-and-ci.md` (~13, 37, 112, 229; ~89 lists banned zip names — leave the ban list as it is), `process/testing.md` (~28), `roadmap/known-issues.md` (delete the NUL-bytes entry at ~271 and the bullet at ~294: the file is gone), `architecture/data-archive.md` (~18, 28), `architecture/build-and-source-split.md` (~73), `src/docs/RELEASING.md` (~247). Run `git grep -n "bundle-rules" -- ':!src/docs/_claude/WIRING-LEDGER.md' ':!src/docs/plans' ':!src/docs/specs'`; expected: only the zip ban list in `build.sh` and its mention in `building-and-ci.md`.

Append to the end of `src/docs/_claude/WIRING-LEDGER.md`:

```markdown
## The bundler moves to Python (#85, 2026-10-09)

1. `fbdata.py bundle` replaces `scripts/bundle-rules.js` (spec 2026-10-09 R11): kit users have
   Python, not Node. It reproduced every real pack byte for byte before the switch (the parity test
   ran over all six packs and 13 synthetic cases, then was replaced by golden checks when the Node
   bundler was removed). `build.sh`, `run.sh`, CI and `dev.sh` call it; every build now needs python3.

Pages: [rules packs](../wiki/architecture/rules-packs.md), [building & CI](../wiki/process/building-and-ci.md),
[converter](../wiki/data/converter.md), [testing](../wiki/process/testing.md)
```

Find its line: `grep -n '^## The bundler moves to Python' src/docs/_claude/WIRING-LEDGER.md`. Add a History line citing `→ ledger L<n>` to each wiki page you changed.

- [ ] **Step 10: Run the docs suite, then commit**

Run: `node src/tests/docs.js | tail -1` → `ALL PASSED (n)`.

```bash
git add build.sh src/tests/run.sh .github/workflows/ci.yml dev.sh src/js/30-version.js src/tests/rules-data.js src/tests/data-kit.py src/docs/wiki src/docs/RELEASING.md src/docs/_claude/WIRING-LEDGER.md
git status --short             # scripts/bundle-rules.js shows as deleted (staged in Step 7)
git commit -m "build: bundle with fbdata.py; bundle-rules.js is gone (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2a: The kit's commands, the licence guard, private data releases (R4, R12, R13)

**Files:**
- Modify: `tools/data-kit/fbdata.py` (`convert`, `build`, `validate --public`)
- Modify: `scripts/data-release.js` (`--registry`, `--data-root`)
- Test: `src/tests/data-kit.py`, `src/tests/converter.py` (the `build` run on the mini dump)

**Interfaces:**
- Consumes: `bundle()`, `bundle_text()`, `cmd_pack()`, `validate_archive()` (Task 1, #83).
- Produces:
  - `fbdata.py convert <convert.py arguments…>` — runs `convert.py` with `--overlay`, `--resources` (and for `srd`, `--corrections`) filled in from the kit when not given.
  - `fbdata.py build <src> [--srd | --full | --book CODE] -o OUT.zip [--version V]`.
  - `fbdata.py validate OUT.zip [--public]`; `PUBLIC_LICENCES = ("CC-BY-4.0", "CC-BY-SA-3.0", "MIT")`; `validate_archive(path, public=False)`.
  - `kit_file(name, repo_rel) -> str`: the converter's inputs beside `fbdata.py` (kit zip), else at the repo path.
  - `node scripts/data-release.js [--dry-run] [--registry F --data-root D]`.

- [ ] **Step 1: Write the failing tests** — in `src/tests/data-kit.py`, above the end marker:

```python
# ---------- validate --public: only allowlisted licences reach a public release (R13)
def archive_with(lic):
    d = scratch()
    reg = read_json(d, "data/packs.json")
    reg["packs"] = [reg["packs"][0]]
    if lic is not None:
        reg["packs"][0]["license"] = lic
    write(d, "data/packs.json", reg)
    bundles(d)
    out = os.path.join(d, "a.zip")
    pack(d, out)
    return d, out


for lic, ok in (("CC-BY-4.0", True), ("CC-BY-SA-3.0", True), ("MIT", True), (None, False), ("LicenseRef-WotC", False)):
    d, z = archive_with(lic)
    r = subprocess.run([sys.executable, FBDATA, "validate", z, "--public"], capture_output=True, text=True)
    ck("validate --public %s licence %r" % ("accepts" if ok else "refuses", lic),
       (r.returncode == 0) == ok and (ok or "public release" in r.stderr), (r.returncode, r.stderr))
    r = subprocess.run([sys.executable, FBDATA, "validate", z], capture_output=True, text=True)
    ck("plain validate ignores the licence (%r)" % lic, r.returncode == 0, r.stderr)
    shutil.rmtree(d)

# ---------- build: a folder of packs, a registry, a single pack file (R12)
d = scratch()
bundles(d)
out = os.path.join(d, "from-registry.zip")
r = subprocess.run([sys.executable, FBDATA, "build", os.path.join(d, "data"), "-o", out], capture_output=True, text=True)
ck("build <data root with packs.json> writes a valid archive named for its release",
   r.returncode == 0 and fbdata.validate_archive(out) == []
   and json.loads(zipfile.ZipFile(out).read("fieldbook-data.json"))["version"] == "1.8.0", r.stderr)
one = os.path.join(d, "single.json")
write(d, "single.json", {"system": "Mine", "name": "My pack", "feats": [{"name": "Sturdy"}]})
out = os.path.join(d, "single.zip")
r = subprocess.run([sys.executable, FBDATA, "build", one, "-o", out, "--version", "0.1.0"], capture_output=True, text=True)
man = json.loads(zipfile.ZipFile(out).read("fieldbook-data.json")) if r.returncode == 0 else {}
ck("build <one pack file> archives it as it is, versioned by --version",
   r.returncode == 0 and man.get("version") == "0.1.0" and [m["file"] for m in man["packs"]] == ["single.json"]
   and "version" not in man["packs"][0], (r.stderr, man))
r = subprocess.run([sys.executable, FBDATA, "build", os.path.join(d, "nope"), "-o", out], capture_output=True, text=True)
ck("build refuses a source that isn't there, writing nothing new", r.returncode == 2 and "nope" in r.stderr, r.stderr)
shutil.rmtree(d)

# ---------- kit_file: beside fbdata.py first (the kit zip), then the repo
ck("kit_file finds convert.py in the repo", fbdata.kit_file("convert.py", "scripts/convert.py").endswith(os.path.join("scripts", "convert.py")))

# ---------- data-release.js against another registry (R4: private data releases)
def private_checkout(release="1.7.2"):
    d = checkout()                       # the public layout, app 1.8.0
    pd = os.path.join(d, "priv")
    write(pd, "data/gamma/spells.json", {"system": "Gamma", "spells": [{"name": "Hex", "level": 1}]})
    write(pd, "data/packs.json", {"release": release, "packs": [
        {"system": "Gamma", "dir": "gamma", "file": "gamma_full.json", "title": "Gamma", "version": release}]})
    subprocess.run([sys.executable, os.path.join(d, "tools/data-kit/fbdata.py"), "versions", "--seed",
                    "--registry", os.path.join(pd, "data/packs.json"), "--data-root", os.path.join(pd, "data")], capture_output=True)
    git(pd, "init", "-q")
    git(pd, "add", "-A")
    git(pd, "commit", "-qm", "start")
    return d, pd


d, pd = private_checkout()
write(pd, "data/gamma/spells.json", {"system": "Gamma", "spells": [{"name": "Hex", "level": 2}]})
git(pd, "commit", "-qam", "change")
args = ["scripts/data-release.js", "--registry", os.path.join(pd, "data/packs.json"), "--data-root", os.path.join(pd, "data")]
r = node(d, *args)
reg = read_json(pd, "data/packs.json")
ck("a private data release after app 1.8.0 is 1.8.0-1, though its last release was 1.7.2",
   r.returncode == 0 and reg["release"] == "1.8.0-1" and reg["packs"][0]["version"] == "1.8.0-1", (r.stdout, r.stderr))
ck("...its printed commands run in the private repo", "git -C " in r.stdout and "data-v1.8.0-1" in r.stdout, r.stdout)
ck("...and the public registry is untouched", read_json(d, "data/packs.json")["release"] == "1.8.0")
write(pd, "data/gamma/spells.json", {"system": "Gamma", "spells": [{"name": "Hex", "level": 3}]})
r = node(d, *args)
ck("a private release refuses uncommitted private data", r.returncode == 1 and "uncommitted" in r.stderr, r.stderr)
shutil.rmtree(d)
d = checkout(release="1.7.2")
write(d, "data/alpha/spells.json", {"system": "Alpha", "spells": [{"name": "Zap", "level": 5}]})
git(d, "commit", "-qam", "change")
r = node(d, "scripts/data-release.js")
ck("the PUBLIC registry still refuses a release from another app version", r.returncode == 1 and "doesn't belong" in r.stderr, r.stderr)
shutil.rmtree(d)
```

And in `src/tests/converter.py`, beside the other `_mini_dump` tests (above its summary lines), a `build` run on the mini dump:

```python
# ---------- fbdata.py build <dump> --srd: convert, bundle, pack, validate (#85, R12)
with tempfile.TemporaryDirectory() as t:
    dump = os.path.join(t, 'dump')
    _mini_dump(dump)
    out = os.path.join(t, 'srd.zip')
    fb = os.path.join(ROOT, 'tools', 'data-kit', 'fbdata.py')
    r = subprocess.run([sys.executable, fb, 'build', dump, '--srd', '-o', out], capture_output=True, text=True)
    ok = r.returncode == 0 and os.path.exists(out)
    man = json.loads(zipfile.ZipFile(out).read('fieldbook-data.json')) if ok else {}
    ck('fbdata build <dump> --srd writes an archive holding srd52_full.json',
       ok and [m['file'] for m in man.get('packs', [])] == ['srd52_full.json'], (r.returncode, r.stderr[-400:]))
    ck('...credited CC-BY-4.0, with the SRD statement in NOTICE.md',
       ok and man['packs'][0].get('license') == 'CC-BY-4.0'
       and 'System Reference Document 5.2.1' in zipfile.ZipFile(out).read('NOTICE.md').decode('utf-8'))
```

(Use the names `converter.py` already imports; add `import zipfile` if it is missing. If `_mini_dump`'s output needs corrections to pass `srd`, the test passes `--corrections` through: check how the existing `srd` tests on the mini dump supply theirs (`_nocorr()`), and have `build` accept `--corrections PATH`, passed to `convert.py srd`.)

- [ ] **Step 2: Run them to see them fail**

Run: `python3 src/tests/data-kit.py | tail -2; python3 src/tests/converter.py | tail -2`
Expected: FAILURES naming the new cases.

- [ ] **Step 3: Implement in `tools/data-kit/fbdata.py`**

```python
KIT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_LICENCES = ("CC-BY-4.0", "CC-BY-SA-3.0", "MIT")
# What `build` writes for each kind of conversion: the registry entry its pack gets.
SRD_PACK = {"system": "SRD 5.2", "dir": "srd52", "file": "srd52_full.json",
            "title": "SRD 5.2 — System Reference Document", "license": "CC-BY-4.0",
            "attribution": ("This work includes material from the System Reference Document 5.2.1 "
                            "(\"SRD 5.2.1\") by Wizards of the Coast LLC, available at "
                            "https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative "
                            "Commons Attribution 4.0 International License, available at "
                            "https://creativecommons.org/licenses/by/4.0/legalcode. Changed: converted to "
                            "Fieldbook's rules format, with renamed entries' references updated.")}
FULL_PACK = {"system": "XPHB", "dir": "5e2024", "file": "5e2024_full.json",
             "title": "D&D 2024 (built from your 5e-tools data)"}
BOOK_PACKS = {"XGE": {"system": "XGE", "dir": "xanathars", "file": "xanathars_full.json",
                      "title": "Xanathar's Guide (built from your 5e-tools data)"},
              "TCE": {"system": "TCE", "dir": "tashas", "file": "tashas_full.json",
                      "title": "Tasha's Cauldron (built from your 5e-tools data)"}}


def kit_file(name, repo_rel):
    """A converter input: beside fbdata.py (the kit zip's flat layout), else in
    the repo checkout this file lives in."""
    for p in (os.path.join(KIT_DIR, name), os.path.join(ROOT, repo_rel)):
        if os.path.isfile(p):
            return p
    raise KitError("can't find %s beside fbdata.py or at %s" % (name, repo_rel))


def _convert_argv(args):
    """convert.py's command line with the kit's overlay, resources and (for srd)
    corrections filled in, unless the caller named their own."""
    argv = [sys.executable, kit_file("convert.py", "scripts/convert.py")] + list(args)
    if args and args[0] in ("all", "srd", "supplement"):
        if "--overlay" not in args:
            argv += ["--overlay", kit_file("overlay.json", "data/overlay.json")]
        if "--resources" not in args:
            argv += ["--resources", kit_file("class-resources.json", "data/class-resources.json")]
        if args[0] == "srd" and "--corrections" not in args:
            argv += ["--corrections", kit_file("srd-corrections.json", "scripts/srd-corrections.json")]
    return argv


def cmd_convert(a):
    return subprocess.run(_convert_argv(a.args)).returncode
```

(`import subprocess, tempfile, shutil` at the top.) Then `build`:

```python
def _is_dump(src):
    return os.path.isdir(os.path.join(src, "class")) or os.path.isdir(os.path.join(src, "spells"))


def cmd_build(a):
    src = os.path.abspath(a.src)
    if not os.path.exists(src):
        raise KitError("%s: no such file or folder" % a.src)
    if a.version is not None and not parse_data_ver(a.version):
        raise KitError("--version %r is not X.Y.Z or X.Y.Z-N" % a.version)
    work = tempfile.mkdtemp(prefix="fbdata-build-")
    try:
        data, dist = os.path.join(work, "data"), os.path.join(work, "dist")
        os.makedirs(data)
        os.makedirs(dist)
        if os.path.isdir(src) and _is_dump(src):
            if a.full:
                entry, conv = dict(FULL_PACK), ["all", src]
            elif a.book:
                code = a.book.upper()
                entry = dict(BOOK_PACKS.get(code) or {"system": code, "dir": code.lower(),
                                                      "file": code.lower() + "_full.json", "title": code})
                core = os.path.join(work, "core")
                rc = subprocess.run(_convert_argv(["all", src, "-o", core])).returncode
                if rc:
                    return rc
                conv = ["supplement", src, "--book", code, "--system", entry["system"],
                        "--avoid-table-names", os.path.join(core, "tables.json")]
            else:
                entry, conv = dict(SRD_PACK), ["srd", src]
                if a.corrections:
                    conv += ["--corrections", a.corrections]
            rc = subprocess.run(_convert_argv(conv + ["-o", os.path.join(data, entry["dir"])])).returncode
            if rc:
                return rc
            reg = {"release": a.version or "0.0.0", "packs": [entry]}
        elif os.path.isdir(src) and os.path.isfile(os.path.join(src, "packs.json")):
            reg = load_registry(os.path.join(src, "packs.json"))
            data = src
        else:
            files = [src] if os.path.isfile(src) else sorted(
                os.path.join(src, f) for f in os.listdir(src) if f.endswith(".json"))
            packs = []
            for f in files:
                try:
                    with open(f, encoding="utf-8") as fh:
                        obj = json.load(fh)
                except ValueError as e:
                    raise KitError("%s: not valid JSON — %s" % (f, e))
                if not isinstance(obj, dict) or not str(obj.get("system") or "").strip():
                    raise KitError("%s: not a rules pack (no system)" % f)
                name = os.path.basename(f)
                shutil.copy(f, os.path.join(dist, name))
                packs.append({"system": obj["system"], "dir": "_", "file": name,
                              "title": str(obj.get("name") or name), "license": obj.get("license"),
                              "attribution": obj.get("attribution")})
            reg = {"release": a.version or "0.0.0",
                   "packs": [{k: v for k, v in p.items() if v} for p in packs]}
        check_registry(reg, "build")
        regpath = os.path.join(work, "packs.json")
        write_registry(reg, regpath)
        if data != src or os.path.isfile(os.path.join(src, "packs.json")):
            for p in reg["packs"]:
                if p["dir"] == "_":
                    continue
                r = bundle(p, data)
                if "errors" in r:
                    raise KitError("%s: %s" % (p["file"], "; ".join(r["errors"])))
                if "obj" in r:
                    with open(os.path.join(dist, p["file"]), "w", encoding="utf-8", newline="\n") as fh:
                        fh.write(bundle_text(r["obj"]))
        out = os.path.abspath(a.output)
        rc = cmd_pack(argparse.Namespace(registry=regpath, bundles=dist, output=out, dev=False, built_for=app_version()))
        if rc:
            return rc
        errs = validate_archive(out)
        for e in errs:
            print("%s: %s" % (out, e), file=sys.stderr)
        return 1 if errs else 0
    finally:
        shutil.rmtree(work, ignore_errors=True)
```

The single-pack branch archives the file as it is: `cmd_pack` checks `dataVersion` against the registry's `version`, which is absent for both, so a loose pack must carry no `dataVersion`, or `build` raises `KitError("<file>: carries dataVersion …; build it from a registry instead")`. Add that check in the loop.

`validate --public`:

```python
def validate_archive(path, public=False):
    ...  # unchanged body; before `return errs` at the end, add:
        if public:
            for m in packs:
                lic = m.get("license") if isinstance(m, dict) else None
                if lic not in PUBLIC_LICENCES:
                    errs.append("%s: licence %s is not one a public release may carry (%s)"
                                % (m.get("file"), lic or "(none)", ", ".join(PUBLIC_LICENCES)))
    return errs


def cmd_validate(a):
    errs = validate_archive(a.zip, public=a.public)
    ...
```

Parsers in `main()`:

```python
    p = sub.add_parser("validate", help="check an archive; exit 1 with one line per problem")
    p.add_argument("zip")
    p.add_argument("--public", action="store_true",
                   help="also refuse a pack whose licence a public release may not carry")
    p.set_defaults(fn=cmd_validate)
    p = sub.add_parser("convert", help="run convert.py with the kit's overlay, resources and corrections")
    p.add_argument("args", nargs=argparse.REMAINDER)
    p.set_defaults(fn=cmd_convert)
    p = sub.add_parser("build", help="one command: convert or collect, bundle, pack, validate")
    p.add_argument("src", help="a 5e-tools data folder, a folder with packs.json, a folder of packs, or one pack")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--srd", action="store_true", help="the SRD 5.2 pack (the default for a 5e-tools folder)")
    g.add_argument("--full", action="store_true", help="the full 2024 pack (only for your own use)")
    g.add_argument("--book", metavar="CODE", help="one supplement, e.g. XGE or TCE (only for your own use)")
    p.add_argument("--corrections", metavar="PATH", help="(--srd) another corrections file")
    p.add_argument("--version", help="the archive's version when there is no registry (default 0.0.0)")
    p.add_argument("-o", "--output", required=True)
    p.set_defaults(fn=cmd_build)
```

Docstring usage block: add `convert`, `build`, and `validate OUT.zip [--public]`.

- [ ] **Step 4: Implement in `scripts/data-release.js`**

Parse `--registry F` and `--data-root D` (both or neither; one alone → `die("--registry and --data-root go together")`). With them:
- `REG = path.resolve(F)`, `DATA = path.resolve(D)`, `REPO = git -C DATA rev-parse --show-toplevel` (die if it fails: "the data root is not in a git checkout").
- The dirty check runs `git -C REPO status --porcelain -- <DATA relative to REPO>`; the tag check runs in `REPO`.
- `fbdata(["versions", "--changed", "--registry", REG, "--data-root", DATA])` and the same for `--bump`.
- The next version: as today, **plus** when `--registry` is given and the release's base (`X.Y.Z` of `X.Y.Z` or `X.Y.Z-N`) is **older** than `APP_VERSION` by `cmpDataVer` order, `next = app + "-1"` (a private registry is never bumped by an app release). The public path keeps its "doesn't belong" refusal.
- The printed commands use `git -C <REPO> add <REG relative to REPO>`, `git -C <REPO> commit …`, `git -C <REPO> tag -a data-v<next> …`, `git -C <REPO> push && git -C <REPO> push origin data-v<next>`.
Update the header comment to document both forms.

- [ ] **Step 5: Run the tests to see them pass**

Run: `python3 src/tests/data-kit.py | tail -1; python3 src/tests/converter.py | tail -1`
Expected: `ALL PASSED (n)` twice.

- [ ] **Step 6: Commit**

```bash
git add tools/data-kit/fbdata.py scripts/data-release.js src/tests/data-kit.py src/tests/converter.py
git commit -m "feat: the data kit builds archives in one command; public archives carry only open licences (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2b: The kit zip, the app zip without scripts/, and the release workflows (R12, R13)

**Files:**
- Create: `tools/data-kit/README.md`, `tools/data-kit/example-pack/example-pack.json`
- Modify: `build.sh` (`pack_kit()`; the app zip loses `scripts/`), `.github/workflows/release.yml`, `.github/workflows/data-release.yml`, `scripts/data-release-notes.js`, `README.md` §9, `src/tests/docs.js`
- Test: `src/tests/data-kit.py`

**Interfaces:**
- Consumes: `fbdata.py build`, `validate --public` (Task 2a).
- Produces: `dist/fieldbook-data-kit-<ver>[+dev].zip` from every full `./build.sh` (not `--no-zip`, not `--data`).

- [ ] **Step 1: Write the kit's README and example pack**

`tools/data-kit/README.md` (ships in the kit zip; plain, for players):

```markdown
# Fieldbook data kit

Build a rules data zip Fieldbook opens, from your own 5e-tools data or from packs you wrote.
Needs Python 3.8 or later; nothing else to install.

## Three recipes

    python fbdata.py build <5e-tools data folder> -o srd.zip            # the SRD 5.2 pack
    python fbdata.py build <5e-tools data folder> --full -o mine.zip    # the full 2024 pack, for you only
    python fbdata.py build <folder of your packs> -o mine.zip           # your own packs, as they are

Then in Fieldbook: Settings → Rules data → Import files, and choose the zip.

## What you may share

The SRD 5.2 pack is under CC-BY-4.0: share it, keeping its NOTICE.md. Packs built with `--full`
or `--book` hold text from books you bought; keep them to yourself.

## Also here

- `fbdata.py convert …` runs `convert.py` with this kit's helper files (see README-converter.md).
- `fbdata.py validate <zip>` checks an archive.
- `rules-schema.md` describes the format; `example-pack/` is a small pack showing every category.
```

`tools/data-kit/example-pack/example-pack.json`: one invented pack, system `"Example"`, name `"Example pack"`, `license: "MIT"`, with one entry in each of `keywords`, `features`, `items`, `spells`, `races`, `classes` (one level), `feats`, `backgrounds`, `subclasses`, `tables` (with `cols`), all invented (names like "Glimmerwick", "Ash Sentinel"), following `docs/rules-schema.md`. It must import cleanly: add a `data-kit.py` check that `fbdata.py build tools/data-kit/example-pack -o <tmp>/ex.zip --version 0.1.0` succeeds and `validate --public` passes.

- [ ] **Step 2: Write the failing tests** — `src/tests/data-kit.py`:

```python
# ---------- the kit zip works on its own, unzipped anywhere (Review Focus 3)
kits = sorted(f for f in os.listdir(os.path.join(ROOT, "dist")) if f.startswith("fieldbook-data-kit-")) \
    if os.path.isdir(os.path.join(ROOT, "dist")) else []
if not kits:
    print("note: no dist/fieldbook-data-kit-*.zip — run ./build.sh (with zips) to test the kit zip")
else:
    kz = os.path.join(ROOT, "dist", kits[-1])
    names = sorted(n for n in zipfile.ZipFile(kz).namelist() if not n.endswith("/"))
    want = sorted(["fbdata.py", "convert.py", "overlay.json", "class-resources.json", "srd-corrections.json",
                   "README.md", "README-converter.md", "rules-schema.md", "LICENSE", "example-pack/example-pack.json"])
    ck("the kit zip holds exactly the kit", names == want, names)
    t = tempfile.mkdtemp(prefix="kit-")
    zipfile.ZipFile(kz).extractall(t)
    r = subprocess.run([sys.executable, os.path.join(t, "fbdata.py"), "build", os.path.join(t, "example-pack"),
                        "-o", os.path.join(t, "ex.zip"), "--version", "0.1.0"], capture_output=True, text=True, cwd=t)
    ck("an unzipped kit builds the example pack with no repo around it", r.returncode == 0, r.stderr)
    ck("...and the kit finds its own convert.py", fbdata_kit_file(t) == os.path.join(t, "convert.py"))
    shutil.rmtree(t)
```

with this helper defined above it:

```python
def fbdata_kit_file(t):
    """kit_file() as the unzipped kit's own fbdata.py answers it"""
    code = "import runpy,sys; m=runpy.run_path(sys.argv[1]); print(m['kit_file']('convert.py','scripts/convert.py'))"
    r = subprocess.run([sys.executable, "-c", code, os.path.join(t, "fbdata.py")], capture_output=True, text=True)
    return r.stdout.strip()
``` In `src/tests/docs.js`, replace the check "build.sh ships scripts/srd-corrections.json beside convert.py in the app zip" with:

```js
ck('the app zip ships no scripts/ (the data kit replaces it)', !/mkdir -p[^\n]*\.buildtmp\/scripts/.test(build) && !/cp scripts\/convert\.py \.buildtmp/.test(build));
ck('build.sh builds the data kit zip from the kit allowlist', /fieldbook-data-kit-/.test(build) && /cp scripts\/srd-corrections\.json/.test(build));
ck('README section 9 names the data kit', /fieldbook-data-kit-/.test(readme));
```

- [ ] **Step 3: Run them to see them fail**

Run: `./build.sh && python3 src/tests/data-kit.py | tail -2; node src/tests/docs.js | tail -1`
Expected: the kit checks print the "no dist/fieldbook-data-kit" note (not yet built); docs FAILURES on the three new checks.

- [ ] **Step 4: `build.sh`**

- In the app-zip block: `mkdir -p .buildtmp/data .buildtmp/docs` (no `scripts`); delete the `cp scripts/convert.py …` and `cp data/overlay.json … .buildtmp/scripts/` lines and their comment; above them, one comment line: "convert.py and its helper files travel in the data kit zip now (#85)".
- After `pack_archive` and the app zip, a new function and call:

```bash
# The data kit (#85): fbdata.py and the converter with the files they read, flat,
# so `python fbdata.py build …` works wherever the zip is unpacked. An allowlist:
# exactly these files, and the guard below fails the build on anything else.
pack_kit() {
  KIT="dist/fieldbook-data-kit-$VER$TAGSUF.zip"
  echo "==> Building $KIT"
  rm -rf .buildkit && mkdir -p .buildkit/example-pack
  cp tools/data-kit/fbdata.py tools/data-kit/README.md scripts/convert.py \
     data/overlay.json data/class-resources.json scripts/srd-corrections.json \
     docs/README-converter.md docs/rules-schema.md LICENSE .buildkit/
  cp tools/data-kit/example-pack/*.json .buildkit/example-pack/
  ( cd .buildkit && zip -rqD "../$KIT" . -x '*.DS_Store' )
  rm -rf .buildkit
  local got
  got=$(unzip -Z1 "$KIT" | grep -v '/$' | sort | tr '\n' ' ')
  local want="LICENSE README-converter.md README.md class-resources.json convert.py example-pack/example-pack.json fbdata.py overlay.json rules-schema.md srd-corrections.json "
  if [ "$got" != "$want" ]; then
    rm -f "$KIT"; echo "    the kit zip holds the wrong files: $got"; exit 1
  fi
  echo "    wrote $KIT"
}
```

  Call `pack_kit` after the app zip's guard and before `finish`. Add `rm -f dist/fieldbook-data-kit-*.zip` beside the existing `rm -f dist/*.zip` (that line already covers it — check, and say so in a comment). Header comment: list the kit zip among the outputs. Add `.buildkit/` to `.gitignore` beside `.buildtmp/`.
- The app zip's banned-name regex keeps `bundle-rules\.js` (harmless) and gains nothing.

- [ ] **Step 5: The release workflows**

`.github/workflows/release.yml`:
- "Check the assets exist": add `"dist/fieldbook-data-kit-$V.zip"`.
- New step after it, "Public assets only":

```yaml
      - name: Public assets only
        run: |
          V="${{ steps.tag.outputs.version }}"
          python3 tools/data-kit/fbdata.py validate --public "dist/fieldbook-data-standalone-$V.zip" || {
            echo "::error::The rules-data archive holds a pack a public release may not carry."; exit 1; }
          for f in dist/fieldbook.html "dist/fieldbook-v$V.zip" "dist/fieldbook-data-standalone-$V.zip" "dist/fieldbook-data-kit-$V.zip"; do
            case "$f" in *private*) echo "::error::refusing to publish $f"; exit 1 ;; esac
          done
          if unzip -Z1 "dist/fieldbook-v$V.zip" | grep -qi private; then
            echo "::error::the app zip names something private"; exit 1
          fi
```

- "Publish": `ASSETS` gains `"dist/fieldbook-data-kit-$V.zip"`.

`.github/workflows/data-release.yml`, "Validate the archive": `python3 tools/data-kit/fbdata.py validate --public "$Z"` and the same `*private*` name check.

`scripts/data-release-notes.js` `--app`: after the rules-data line, add

```js
    out.push("", "**Build your own:** `fieldbook-data-kit-" + ver + ".zip` turns a 5e-tools export into a rules data zip. See the README inside it.");
```

and a `data-kit.py` assertion, beside the existing `--app` notes checks, that the output for `1.8.0-1` contains `fieldbook-data-kit-1.8.0-1.zip`.

- [ ] **Step 6: README §9**

Rewrite the code block: the app zip holds `fieldbook.html`, `README.md`, `LICENSE`, `data/` (the archive) and `docs/`; drop the `scripts/` lines. After the block, add: "**Want to build your own rules data?** Each release also has `fieldbook-data-kit-<version>.zip`: the converter and `fbdata.py`, which turns a 5e-tools export into a zip Fieldbook opens. See the README inside it." Keep the archive's list of packs as it is (Task 12 rewrites it when the packs leave).

- [ ] **Step 7: Build, test, commit**

Run: `./build.sh && ./src/tests/run.sh && unzip -l dist/fieldbook-data-kit-*.zip`
Expected: `All 10 suites passed`; the listing shows the ten kit files. Restore nothing by hand; `dist/` zips are gitignored.

```bash
git add build.sh .gitignore tools/data-kit/README.md tools/data-kit/example-pack .github/workflows/release.yml .github/workflows/data-release.yml scripts/data-release-notes.js README.md src/tests/docs.js src/tests/data-kit.py
git commit -m "build: the data kit zip; the app zip drops scripts/; public releases refuse private packs (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The class one-liners in Fieldbook's own words (decision 1, R6)

**Files:**
- Modify: `scripts/convert.py` (`CLASS_BLURB`, `convert_classes()`), `scripts/srd-corrections.json` (remove the 12 blurb corrections)
- Regenerate: `data/5e2024/classes.json`
- Test: `src/tests/converter.py`

**Interfaces:**
- Consumes: `Book.mode` (`'srd'` for `srd_book()`).
- Produces: `data/5e2024/classes.json` whose class `description`s are the new lines; `data/srd52` byte-identical.

- [ ] **Step 1: Write the failing test** — `src/tests/converter.py`, above the summary lines:

```python
# ---------- class one-liners are Fieldbook's own; the SRD pack has none (#85, decision 1)
# Pinned by value: the old lines were the book's, and this file is public, so
# the test names the new wording rather than quoting the old.
ck('CLASS_BLURB is Fieldbook\'s own wording',
   C.CLASS_BLURB.get('Bard', '').startswith('A performer whose songs and stories')
   and C.CLASS_BLURB.get('Wizard', '').startswith('A scholar who masters magic'), C.CLASS_BLURB)
ck('CLASS_BLURB covers the twelve classes, the Artificer and the Mystic', len(C.CLASS_BLURB) == 14)
with tempfile.TemporaryDirectory() as t:
    dump = os.path.join(t, 'dump')
    _mini_dump(dump)
    r = _run_srd_cli(dump, os.path.join(t, 'out'))      # the helper the #84 srd tests use; see note
    classes = json.load(open(os.path.join(t, 'out', 'classes.json'), encoding='utf-8'))['classes']
    ck('SRD mode writes no class one-liner', r == 0 and all(c.get('description', '') == '' for c in classes),
       [c.get('description') for c in classes])
```

Note: use whatever helper the existing #84 `srd`-on-mini-dump tests use to run `convert.py srd` (read them: they build `_mini_dump`, write a `{}` corrections file with `_nocorr()`, and call the CLI in a subprocess); do not invent `_run_srd_cli` if a helper exists under another name.

- [ ] **Step 2: Run it to see it fail**

Run: `python3 src/tests/converter.py | tail -2`
Expected: FAILURES on the first test (the old lines) and on "SRD mode writes no class one-liner" (the mini dump's classes get blurbs through `CLASS_BLURB`).

- [ ] **Step 3: Implement**

Replace `CLASS_BLURB` in `scripts/convert.py` with exactly:

```python
# One line per class for the class picker, in Fieldbook's own words (#85): the
# books' class-table summaries are theirs, and this file is public. The SRD
# pack writes none — the SRD's class sections have no summary.
CLASS_BLURB = {
    'Barbarian': 'A warrior who fights on instinct and fury, shrugging off blows that would fell others.',
    'Bard': 'A performer whose songs and stories carry real magic, lifting allies and unsettling foes.',
    'Cleric': 'A servant of a god who channels divine power to heal, protect and smite.',
    'Druid': "A guardian of the wild who calls on nature's power and takes the shapes of beasts.",
    'Fighter': 'A trained combatant at home with any weapon and any armor.',
    'Monk': 'A disciplined fighter who turns body and focus into speed and striking power.',
    'Paladin': 'A sworn champion whose oath lends holy power to sword and shield.',
    'Ranger': 'A hunter and scout who mixes weapon skill with the magic of the wilds.',
    'Rogue': 'A specialist who wins through stealth, skill and a well-placed strike.',
    'Sorcerer': 'A caster born with magic in the blood, shaping spells by raw talent.',
    'Warlock': 'A caster who gains magic by striking a pact with a powerful being.',
    'Wizard': 'A scholar who masters magic through study and a spellbook full of options.',
    'Artificer': 'An inventor who builds magic into tools, gear and gadgets.',
    'Mystic': 'A student of the mind who unlocks psionic power through discipline.',
}
```

In `convert_classes()`, the class dict line becomes:

```python
        C = {'name': entry['name'],
             'description': '' if bk.mode == 'srd' else CLASS_BLURB.get(entry['name'], ''),
             'hitDie': 'd' + str(entry['hd']['faces'])}
```

Remove the 12 corrections from `scripts/srd-corrections.json` whose `why` names `CLASS_BLURB`, keeping the file's formatting (2-space indent, LF, final newline):

```bash
python3 - <<'PY'
import json
p = 'scripts/srd-corrections.json'
d = json.load(open(p, encoding='utf-8'))
before = len(d['corrections'])
d['corrections'] = [c for c in d['corrections'] if 'CLASS_BLURB' not in c.get('why', '')]
print(before, '->', len(d['corrections']))
open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
PY
git diff --stat scripts/srd-corrections.json
```

Expected: `124 -> 112`. Check the diff is only those 12 entries; if `json.dumps` reformatted anything else, restore the file and delete the 12 entries by hand instead.

- [ ] **Step 4: Regenerate and run both gates**

```bash
python3 scripts/convert.py all _conversion-data/5etools-v2.36.1 -o data/5e2024
git diff --stat data/5e2024
python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o /tmp/srd && diff -r /tmp/srd data/srd52 && echo SRD-GATE-CLEAN
```

Expected: `data/5e2024/classes.json` only, with only `description` lines changing (check with `git diff -U0 data/5e2024/classes.json | grep '^[-+] ' | grep -vc description` → `0`); `SRD-GATE-CLEAN`; the `srd` run reports no stale correction.

- [ ] **Step 5: Run everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh && .venv/bin/python src/tests/srd-verbatim.py | tail -1`
Expected: `All 10 suites passed`; `ALL PASSED (n)` from srd-verbatim. If a test pinned an old blurb, change its expectation to the new line.

- [ ] **Step 6: Commit**

```bash
git add scripts/convert.py scripts/srd-corrections.json data/5e2024/classes.json src/tests/converter.py
git commit -m "feat: class one-liners in Fieldbook's own words; the SRD pack writes none (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: A quiet version chip, and homebrew's needs point at SRD 5.2 (R5, R14)

**Files:**
- Modify: `src/js/88-settings.js` (`dataStatus()`, `dataStatusHTML()`)
- Modify: `data/homebrew/features.json`, `data/homebrew/subclasses.json`, `data/homebrew/tables.json` (`requires`)
- Test: `src/tests/data-archive.js`, `src/tests/rules-data.js`

**Interfaces:**
- Produces: `dataStatus(g)` gains the state `{state: "known", have}`: a readable `dataVersion`, no baseline in `DATA_VERSIONS`, no newer copy in the data-release notice. `dataStatusHTML()` renders it as `v<have>` with the title `This pack's version.`.

- [ ] **Step 1: Write the failing tests**

`src/tests/data-archive.js`, in the section `'dataStatus reads data versions'`, before `X.resetRules();`:

```js
  // Review Focus 1: a pack this build has no baseline for (a private pack, or a
  // v1.7.2 player's old XPHB after 1.8.0 drops it from DATA_VERSIONS) shows its
  // version quietly: no alarm, no notice.
  const other = v => { X.resetRules(); X.mergeRules({system: 'Not In This Build', rulebook: true, dataVersion: v, races: [{name: 'Elf'}]}, 'mine_full.json'); return X.loadedRulesGroups()[0]; };
  ck('a pack with no baseline is "known"', X.dataStatus(other('1.7.2')).state === 'known', X.dataStatus(other('1.7.2')));
  ck('...shown as its version, quietly', /v1\.7\.2/.test(X.dataStatusHTML(other('1.7.2'))) && !/update available/.test(X.dataStatusHTML(other('1.7.2'))),
     X.dataStatusHTML(other('1.7.2')));
  ck('...and it raises no newer-data notice', !/Newer rules data is out/.test(X.rulesDataHTML()) && !/update/.test(X.rulesBadge()));
  ck('a pack with no baseline and no version stays unknown and shows nothing',
     X.dataStatus(other(undefined)).state === 'unknown' && X.dataStatusHTML(other(undefined)) === '');
```

`src/tests/rules-data.js`, beside the existing homebrew `requires` checks (search for `requires` and `homebrew`):

```js
// ---------- homebrew's needs point at public packs (#85, R14)
['features', 'subclasses', 'tables'].forEach(f => {
  const req = JSON.parse(fs.readFileSync('data/homebrew/' + f + '.json', 'utf8')).requires || [];
  ck('homebrew/' + f + ': its D&D group needs SRD 5.2, by file', req[0] && req[0].pack === 'SRD 5.2' && req[0].file === 'srd52_full.json', req[0]);
  ck('homebrew/' + f + ": its Xanathar's group names the book, not a file", req[1] && req[1].pack === "Xanathar's Guide to Everything" && !('file' in req[1]), req[1]);
});
```

and, using the harness the suite already uses to merge packs, load `dist/srd52_full.json` then `dist/homebrew_full.json` and check `missingRequirements('Homebrew')` reports only the two Xanathar's spells (`Cause Fear`, `Primal Savagery`) with `pack: "Xanathar's Guide to Everything"` and `file: ""`, and that `requiresStatusHTML` for the homebrew group contains `from Xanathar's Guide to Everything`.

- [ ] **Step 2: Run them to see them fail**

Run: `./build.sh --no-zip && node src/tests/data-archive.js | tail -1; node src/tests/rules-data.js | tail -1`
Expected: FAILURES naming the new checks.

- [ ] **Step 3: Implement**

`src/js/88-settings.js`:

```js
function dataStatus(g){
  const have=g.dataVersion||"";
  const want=(typeof DATA_VERSIONS!=="undefined"&&DATA_VERSIONS[g.source])||"";
  const upd=dataUpdateFor(g);
  if(!have||!parseDataVer(have))return {state:"unknown"};
  /* no baseline in this build and no newer copy known: a private pack, or a pack
     an older Fieldbook shipped (#85). Its version, and no claim either way. */
  if(!want&&!upd)return {state:"known",have};
  if(want&&cmpDataVer(have,want)<0)return {state:"stale",have,want};
  if(upd&&cmpDataVer(have,upd.version)<0)return {state:"update",have,want:upd.version,release:dataUpdate.release};
  return {state:"current",have};
}
```

and in `dataStatusHTML()`, before the `current` line:

```js
  if(st.state==="known")return ` <span class="rd-src" title="This pack's version.">v${esc(st.have)}</span>`;
```

Homebrew: in each of the three files, the first `requires` group's `"pack": "D&D 2024", "file": "5e2024_full.json"` becomes `"pack": "SRD 5.2", "file": "srd52_full.json"`; the second group's `"file": "xanathars_full.json"` line is removed. The three files' `requires` must stay identical (the bundler fails otherwise). Keep each file's formatting.

- [ ] **Step 4: Run them to see them pass, and everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: `All 10 suites passed`.

- [ ] **Step 5: Screenshots** (UI-visible). Load the project's Playwright tools with ToolSearch (`select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_resize,mcp__playwright__browser_click,mcp__playwright__browser_file_upload,mcp__playwright__browser_snapshot`). At 390 px, on `file:///Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/85/dist/fieldbook.html`:
  1. Import `dist/srd52_full.json` and `dist/homebrew_full.json` (Settings → Rules data → Import files, then `browser_file_upload`); open Settings → Rules data. Shoot `85-rules-data-homebrew-<skin>.png`: the homebrew row's needs note reads "from Xanathar's Guide to Everything" and names the two spells only.
  2. In the page, `mergeRules({system:"Old Pack",rulebook:true,dataVersion:"1.7.2",races:[{name:"Testkin"}]},"old_full.json"); renderSettings&&renderSettings();` (use whatever re-render the Settings code uses; read `88-settings.js`), and shoot `85-rules-data-quiet-chip-<skin>.png`: its row shows `v1.7.2`, no amber chip.
  Both in the Classic and Humblewood skins (`settings.skin="classic"|"humblewood"; applyTheme()`). Read every PNG before reporting it.

- [ ] **Step 6: Commit**

```bash
git add src/js/88-settings.js data/homebrew/features.json data/homebrew/subclasses.json data/homebrew/tables.json src/tests/data-archive.js src/tests/rules-data.js
git commit -m "feat: packs this build has no baseline for show their version quietly; homebrew needs SRD 5.2 (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### The inventories (read before Tasks 5, 6 and 9)

Three research inventories list, line by line, what Tasks 5, 6 and 9 change. **They quote the book
text being replaced, so they never enter the repo.** The controller copies them into this plan's
gitignored workspace before Task 5:

- `.superpowers/sdd/2026-10-09-private-split/inventories/redaction.md` — every quote in the files
  that stay public (Task 5), with a proposed replacement for each.
- `.superpowers/sdd/2026-10-09-private-split/inventories/converter-prose.md` — every book-prose input
  in `src/tests/converter.py` (Task 6), with the structure each replacement must keep.
- `.superpowers/sdd/2026-10-09-private-split/inventories/js-tests.md` — every check in `rules-data.js`,
  `tables.js`, `sheet.js`, `char-update.js` and `docs.js` that reads a leaving pack, with its
  disposition (Task 9).
- `.superpowers/sdd/2026-10-09-private-split/inventories/leakscan.py` — the prototype leak scanner;
  `python3 <it>` from the repo root prints every run of 10+ words shared with the private packs and
  absent from SRD and homebrew, per file.

Line numbers in the inventories are from the start of #85; earlier tasks may have shifted them.
Find each place by its content, not its number. **Never paste inventory text into a tracked file**:
a replacement is always Fieldbook's own wording.

---

### Task 5: Public text without book quotes (decision 2, R7)

**Files:**
- Modify (ship): `src/js/89-rules-merge.js` (the Bard sample), `docs/README-converter.md` (a formula example), `docs/rules-schema.md` (the table example)
- Modify (dev): `scripts/convert.py` (three comments: `_formula_text()`'s docstring, the Student-of-War comment, the maneuver-swap comment), `src/docs/_claude/WIRING-LEDGER.md` (four lines, in place), `src/docs/plans/2026-10-02-ammo.md` (19 pasted entries), `src/docs/wiki/data/converter.md`, `src/docs/wiki/data/supplements.md`, `src/docs/wiki/roadmap/known-issues.md`, `src/tests/sheet.js` (the lone-asterisk strings and their comment)
- Leave: everything the inventory marks MOVES (it leaves in Task 10), the `CHANGELOG` array (decision 3), `scripts/srd-corrections.json` (R8), `FIGHTING_STYLES` and the edition notes in `convert.py` (Fieldbook's own text, which the converter writes into the packs, hence the scan's match), `data/srd52` (the SRD's own text)

**Interfaces:** none. Behaviour does not change; only wording.

- [ ] **Step 1: Record the ledger's shape before touching it**

```bash
F=src/docs/_claude/WIRING-LEDGER.md
wc -l < $F > /tmp/85-ledger-lines.before
grep -n '^## ' $F > /tmp/85-ledger-heads.before
python3 .superpowers/sdd/2026-10-09-private-split/inventories/leakscan.py > /tmp/85-scan.before 2>&1; tail -30 /tmp/85-scan.before
```

- [ ] **Step 2: Replace each quote** listed in `inventories/redaction.md` §D, §E, §F (items 4–6), §J, §K, §L, §N, §O, §Q, §S. Rules:
  - **Shipped files** (`89-rules-merge.js`, `docs/*`): an invented example that teaches the same thing. The Bard sample becomes `"A performer who channels story and song into magic."`; the table example becomes the invented "Wandering Weather" table with the same keys (`name`, `caption`, `cols`, `align`, `rows`, `owner`, `ownerKind`); the formula example becomes an invented formula line.
  - **The ledger:** in place, **same line count, every `## ` heading on the same line**: rewrite only the quoted words on those four lines (`[book text: <what it was>]` or a paraphrase). The ledger is otherwise append-only; this is decision 2's one-time exception.
  - **The ammunition plan:** each pasted 5e-tools entry becomes `[5e-tools entry: <name>]`, keeping the Python variable names (`LONGBOW = …`). Nothing cites that file by line, so its length may change.
  - **Wiki pages and comments:** paraphrase, or `[book text: <what it was>]`.
  - **`sheet.js`:** the three lone-asterisk strings become invented ones with the same shapes: a word with a trailing `*` mid-sentence, a word with a trailing `*` before more text, and a sentence that explains the asterisk. Reword the comment above them so it no longer says the strings come from the Humblewood data. Keep the assertions.

- [ ] **Step 3: Prove the ledger kept its shape**

```bash
F=src/docs/_claude/WIRING-LEDGER.md
[ "$(wc -l < $F)" = "$(cat /tmp/85-ledger-lines.before)" ] && echo LINES-SAME
grep -n '^## ' $F | diff - /tmp/85-ledger-heads.before && echo HEADINGS-SAME
```

Expected: `LINES-SAME`, `HEADINGS-SAME`.

- [ ] **Step 4: Prove the quotes are gone**

Run: `python3 .superpowers/sdd/2026-10-09-private-split/inventories/leakscan.py > /tmp/85-scan.after 2>&1; tail -30 /tmp/85-scan.after`
Expected: **no run in any file this task edited**. Remaining runs are only in:
- files that leave in Task 10 (`scripts/extract-humblewood.py`, `HUMBLEWOOD-PLAYTESTS.md`, `wiki/data/humblewood.md`);
- files Task 6 and Task 9 handle (`src/tests/converter.py`, `rules-data.js`, `tables.js`);
- the allowlisted ones: the `CHANGELOG` footnote in `30-version.js`, `docs/CHANGELOG.md` and `dist/fieldbook.html`; `srd-corrections.json`; `FIGHTING_STYLES` and the edition notes in `convert.py`; `data/srd52/tables.json`.

List the remaining files and their counts in your report.

- [ ] **Step 5: Run everything**

Run: `./build.sh --no-zip && ./src/tests/run.sh`
Expected: `All 10 suites passed`. The docs suite also re-checks every ledger citation.

- [ ] **Step 6: Commit**

```bash
git add src/js/89-rules-merge.js docs/README-converter.md docs/rules-schema.md scripts/convert.py src/docs/_claude/WIRING-LEDGER.md src/docs/plans/2026-10-02-ammo.md src/docs/wiki/data/converter.md src/docs/wiki/data/supplements.md src/docs/wiki/roadmap/known-issues.md src/tests/sheet.js
git commit -m "docs: public files lose their book quotes — invented examples, paraphrases in place (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The converter tests' book-prose inputs become invented text (R10)

**Files:**
- Modify: `src/tests/converter.py` only

**Interfaces:** none. `convert.py` does not change; the tests exercise the same paths with invented text.

- [ ] **Step 1: Baseline**

Run: `python3 src/tests/converter.py | tail -1` and record `ALL PASSED (N)`; `python3 .superpowers/sdd/2026-10-09-private-split/inventories/leakscan.py 2>&1 | grep -A3 'src/tests/converter.py'`.

- [ ] **Step 2: Rewrite each block** listed in `inventories/converter-prose.md`, one block at a time, running the suite after each:
  - Keep the **structure** the test exercises: the same 5e-tools tags (`{@spell …}`, `{@dice …}`, `{@table …}`, `{#itemEntry …}`), the same nesting (entries, lists, tables, footnotes), the same punctuation the converter keys on, and the same edge case (a dict prerequisite, a footnote asterisk, a template variable).
  - Replace the **prose** with invented text: invented entry names ("Glimmerwick", "Ash Sentinel", "Cindermoss"), invented sentences.
  - **Names that stay:** generic rules terms (Strength, saving throw, bonus action, Finesse, Thrown, Vex) and class names. A real entry name stays only where the test is about that name, such as a rename test (`Heward's Handy Haversack` → `Handy Haversack`). The sentence around it is reworded.
  - **Assertions:** change each expected string to the new text. **Never weaken one:** an exact-match check stays exact, and a count stays a count.
  - The SRD mini-dump builder (`_mini_dump`) and its tests are already invented text; leave them.

- [ ] **Step 3: Prove it**

Run: `python3 src/tests/converter.py | tail -1` → `ALL PASSED (N)`, the same N as the baseline.
Run: `python3 .superpowers/sdd/2026-10-09-private-split/inventories/leakscan.py 2>&1 | grep -A3 'src/tests/converter.py'` → nothing.

- [ ] **Step 4: Run everything and commit**

Run: `./build.sh --no-zip && ./src/tests/run.sh` → `All 10 suites passed`.

```bash
git add src/tests/converter.py
git commit -m "test: the converter's test inputs are invented text, not book prose (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The private repository, created from public history (R2, R15, R16)

**Files:**
- Create (outside this repo): `/Users/mwardman/Documents/Repos/RPGFieldbookPrivate` — its history from `git filter-repo`, then `data/packs.json`, `.gitignore`
- Create (symlinks, gitignored): `/Users/mwardman/Documents/Repos/RPGFieldbook/_private-data` → `../RPGFieldbookPrivate`; `<worktree>/_private-data` → `../../../_private-data`; `RPGFieldbookPrivate/_conversion-data` → `../RPGFieldbook/_conversion-data`
- Modify (public): `.gitignore`, `scripts/wt.sh`

**Interfaces:**
- Produces: the private repo at `main`, holding `data/{5e2024,xanathars,tashas,humblewood}/`, `data/packs.json` (the four entries), `scripts/extract-humblewood.py`, `tests/humblewood-verbatim.py`, `docs/HUMBLEWOOD-PLAYTESTS.md`, `docs/humblewood.md`, with their history, no tags, and remote `origin` = `git@github.com:wardmanm/RPGFieldbookPrivate.git` (**never pushed**). `_private-data` resolves from the main checkout and this worktree.

- [ ] **Step 1: Preconditions**

```bash
git status --short                  # only dist/fieldbook.html may show; everything else committed
test ! -e /Users/mwardman/Documents/Repos/RPGFieldbookPrivate && echo FREE
git filter-repo --version
gh repo view wardmanm/RPGFieldbookPrivate --json isEmpty -q .isEmpty    # true: nothing to merge with
```

If the folder exists, or the remote is not empty, stop and report BLOCKED.

- [ ] **Step 2: Clone this branch and filter it to the private paths**

```bash
B=$(git rev-parse --abbrev-ref HEAD)
P=/Users/mwardman/Documents/Repos/RPGFieldbookPrivate
git clone --no-local --single-branch --no-tags --branch "$B" /Users/mwardman/Documents/Repos/RPGFieldbook "$P"
cd "$P"
git filter-repo --force \
  --path data/5e2024/ --path data/xanathars/ --path data/tashas/ --path data/humblewood/ \
  --path scripts/extract-humblewood.py --path src/tests/humblewood-verbatim.py \
  --path src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md --path src/docs/wiki/data/humblewood.md \
  --path-rename src/tests/humblewood-verbatim.py:tests/humblewood-verbatim.py \
  --path-rename src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md:docs/HUMBLEWOOD-PLAYTESTS.md \
  --path-rename src/docs/wiki/data/humblewood.md:docs/humblewood.md
git branch -m main
git remote add origin git@github.com:wardmanm/RPGFieldbookPrivate.git
git tag -l | wc -l                    # 0
git ls-files | sed 's|/[^/]*$||' | sort -u
```

Expected: the folders `data/5e2024`, `data/humblewood`, `data/tashas`, `data/xanathars`, `docs`, `scripts`, `tests`; no tags; `git log --oneline | wc -l` well above 1.

- [ ] **Step 3: Prove the copy**

```bash
W=/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/85
for d in 5e2024 xanathars tashas humblewood; do diff -r "$W/data/$d" "$P/data/$d" && echo "same $d"; done
cmp "$W/scripts/extract-humblewood.py" "$P/scripts/extract-humblewood.py" && echo same-extractor
```

Expected: `same` for all four, `same-extractor`.

- [ ] **Step 4: The private registry and ignores**

```bash
cd "$P"
python3 - "$W/data/packs.json" <<'PY'
import json, sys
pub = json.load(open(sys.argv[1], encoding="utf-8"))
keep = [p for p in pub["packs"] if p["dir"] in ("5e2024", "humblewood", "xanathars", "tashas")]
assert len(keep) == 4, keep
reg = {"_comment": "The private rules packs (#85). Versions and digests are written by scripts/data-release.js "
                   "in the public repo (--registry/--data-root), never by hand.",
       "release": pub["release"], "packs": keep}
open("data/packs.json", "w", encoding="utf-8", newline="\n").write(json.dumps(reg, indent=2, ensure_ascii=False) + "\n")
PY
printf '%s\n' '__pycache__/' '*.pyc' 'dist/' '_fieldbook/' '_conversion-data' > .gitignore
python3 "$W/tools/data-kit/fbdata.py" digest --registry data/packs.json --data-root data
```

Expected from `digest`: `XPHB CHANGED` (the #84 fixes and Task 3's one-liners since 1.7.2); Humblewood, XGE and TCE `same`.

```bash
git add data/packs.json .gitignore
git -c commit.gpgsign=false commit -m "The private rules packs' registry (#85)"
```

- [ ] **Step 5: The links**

```bash
ln -s ../RPGFieldbookPrivate /Users/mwardman/Documents/Repos/RPGFieldbook/_private-data
ln -s ../../../_private-data "$W/_private-data"
ln -s ../RPGFieldbook/_conversion-data "$P/_conversion-data"
ls "$W/_private-data/data/packs.json" "$P/_conversion-data/" | head -3
```

Public `.gitignore`, beside the `.venv` lines, with the same reason in its comment (a symlink is a file to git, so no trailing slash):

```
_private-data
```

`scripts/wt.sh`: `add` links it like `.venv` and `_conversion-data`
(`[ -e _private-data ] && ln -s "$up/_private-data" "$path/_private-data"`); `rm` removes it beside them. Update the comment above those lines: the Humblewood suite now lives in the private repo, and `srd-verbatim` and the `private-data` suite are what need the links.

- [ ] **Step 6: Commit (public)**

```bash
cd "$W"
git add .gitignore scripts/wt.sh
git commit -m "chore: _private-data links the private rules repo into checkouts and worktrees (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

**From here on, never change `data/5e2024`, `data/xanathars`, `data/tashas` or `data/humblewood` in this repo**; Task 10 deletes them.

---

### Task 8: The private tests, CI and release workflow, and the public `private-data` suite (R4, R9, Review Focus 5)

**Files (private repo, `$P`):**
- Create: `tests/run.sh`, `tests/private-data.js`, `tests/gate-2024.py`, `tests/leak-scan.py`, `tests/leak-allowlist.json`, `README.md`, `.github/workflows/ci.yml`, `.github/workflows/data-release.yml`
- Modify: `tests/humblewood-verbatim.py` (its root is one level up now)

**Files (public):**
- Create: `src/tests/private-data.js`
- Modify: `dev.sh` (the converter menu), `src/tests/data-kit.py` (the `private-data` suite's three outcomes)

**Interfaces:**
- Produces: `FIELDBOOK=<public checkout> bash <private>/tests/run.sh` runs every private suite and ends with exactly one summary line, `ALL PASSED (<n>)` or `FAILURES: <names>`. `node src/tests/private-data.js` (public) prints `SKIP - no _private-data` when the private repo isn't linked, else relays that summary. The env var `FIELDBOOK_PRIVATE` overrides where it looks (for tests).
- `tests/private-data.js` (private) exports nothing; it reads `FIELDBOOK` (the public root), `BUNDLES` (the private bundles' folder), and requires `${FIELDBOOK}/src/tests/harness.js`.

- [ ] **Step 1: The public `private-data` suite, test first** — `src/tests/data-kit.py`:

```python
# ---------- the private-data suite tells the truth (Review Focus 5)
PRIV = os.path.join(ROOT, "src", "tests", "private-data.js")


def priv(run_sh):
    d = tempfile.mkdtemp(prefix="priv-")
    if run_sh is not None:
        write(d, "tests/run.sh", raw=run_sh)
    r = subprocess.run(["node", PRIV], capture_output=True, text=True,
                       env=dict(os.environ, FIELDBOOK_PRIVATE=os.path.join(d, "absent" if run_sh is None else "")))
    shutil.rmtree(d)
    return r


r = priv(None)
ck("private-data with nothing linked skips", r.stdout.strip().splitlines()[-1].startswith("SKIP"), r.stdout)
r = priv('#!/usr/bin/env bash\necho "  leak-scan  FAILED"\necho "FAILURES: leak-scan"\nexit 1\n')
ck("private-data relays a private failure as a failure", r.stdout.strip().splitlines()[-1].startswith("FAILURES"), r.stdout)
r = priv('#!/usr/bin/env bash\necho "ALL PASSED (7)"\n')
ck("private-data relays the private count", r.stdout.strip().splitlines()[-1] == "ALL PASSED (7)", r.stdout)
r = priv('#!/usr/bin/env bash\necho "something odd"\n')
ck("private-data treats output it doesn't recognise as a failure", r.stdout.strip().splitlines()[-1].startswith("FAILURES"), r.stdout)
```

Run `python3 src/tests/data-kit.py | tail -1` → FAILURES (no `private-data.js`).

- [ ] **Step 2: `src/tests/private-data.js`**

```js
#!/usr/bin/env node
/* The private rules packs' tests (#85), run against THIS checkout when the
   private repo is linked as _private-data (scripts/wt.sh links it into
   worktrees). CI never has it, and skips. The private runner prints one
   summary line; anything else is a failure, never a pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const P = process.env.FIELDBOOK_PRIVATE || path.join(ROOT, '_private-data');
const RUN = path.join(P, 'tests', 'run.sh');
if (!fs.existsSync(RUN)) {
  console.log('SKIP - no _private-data');
  process.exit(0);
}
const r = spawnSync('bash', [RUN], {env: Object.assign({}, process.env, {FIELDBOOK: ROOT}), encoding: 'utf8', maxBuffer: 64 << 20});
const out = (r.stdout || '') + (r.stderr || '');
const last = out.trim().split('\n').pop() || '';
process.stdout.write(out.replace(/\n?$/, '\n'));
if (r.status === 0 && /^ALL PASSED \(\d+\)$/.test(last)) {
  console.log(last);
  process.exit(0);
}
console.log('FAILURES: private-data (' + (last || 'no output') + ')');
process.exit(1);
```

Do **not** add it to `run.sh`'s `SUITES` yet: Task 10 swaps it in for `humblewood-verbatim`, so the count stays ten. Run the data-kit test → PASS.

- [ ] **Step 3: The private runner** — `$P/tests/run.sh` (mode 755):

```bash
#!/usr/bin/env bash
# The private rules packs' suites (#85), run against a public Fieldbook checkout:
#   FIELDBOOK=<public checkout> tests/run.sh      (default: ../RPGFieldbook)
# Bundles the private packs with the public kit, then runs each suite. Ends with
# ONE summary line, "ALL PASSED (n)" or "FAILURES: …" — the public private-data
# suite reads that line and nothing else.
set -uo pipefail
cd "$(dirname "$0")/.."
FIELDBOOK="${FIELDBOOK:-../RPGFieldbook}"
FIELDBOOK="$(cd "$FIELDBOOK" && pwd)" || { echo "FAILURES: no public checkout at $FIELDBOOK"; exit 1; }
export FIELDBOOK
PY=python3; "$PY" -c '' >/dev/null 2>&1 || PY=python
export BUNDLES="$PWD/dist"
"$PY" "$FIELDBOOK/tools/data-kit/fbdata.py" bundle --registry data/packs.json --data-root data -o "$BUNDLES" >/dev/null \
  || { echo "FAILURES: bundling"; exit 1; }
TOTAL=0; FAILED=""
run() {  # name, command…
  local name="$1"; shift
  local out last n
  out=$("$@" 2>&1) || true
  last=$(printf '%s\n' "$out" | tail -1)
  case "$last" in
    SKIP*) printf '  %-22s skipped (%s)\n' "$name" "${last#SKIP - }" ;;
    "ALL PASSED"*) n=$(printf '%s' "$last" | tr -dc '0-9'); TOTAL=$((TOTAL + ${n:-0})); printf '  %-22s %s checks\n' "$name" "$n" ;;
    *) FAILED="$FAILED $name"; printf '  %-22s FAILED\n' "$name"; printf '%s\n' "$out" | grep -E '^FAIL|Error' | sed 's/^/      /' ;;
  esac
}
run private-data        node tests/private-data.js
run leak-scan           "$PY" tests/leak-scan.py
run 2024-gate           "$PY" tests/gate-2024.py
run humblewood-verbatim "$PY" tests/humblewood-verbatim.py
if [ -n "$FAILED" ]; then echo "FAILURES:$FAILED"; exit 1; fi
echo "ALL PASSED ($TOTAL)"
```

`$P/tests/gate-2024.py`:

```python
#!/usr/bin/env python3
"""The 2024 pack reproduces byte for byte from the 5e-tools dump (the gate CLAUDE.md
names), run from the private repo against the public converter. Skips without the dump."""
import filecmp, os, subprocess, sys, tempfile
FIELDBOOK = os.environ.get("FIELDBOOK") or sys.exit("FAILURES: FIELDBOOK is not set")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(FIELDBOOK, "_conversion-data", "5etools-v2.36.1")
if not os.path.isdir(DUMP):
    print("SKIP - no 5e-tools dump")
    sys.exit(0)
with tempfile.TemporaryDirectory() as t:
    r = subprocess.run([sys.executable, os.path.join(FIELDBOOK, "scripts", "convert.py"), "all", DUMP, "-o", t],
                       capture_output=True, text=True)
    want = os.path.join(HERE, "data", "5e2024")
    names = sorted(set(os.listdir(t)) | set(os.listdir(want)))
    bad = [n for n in names if not (os.path.isfile(os.path.join(t, n)) and os.path.isfile(os.path.join(want, n))
                                    and filecmp.cmp(os.path.join(t, n), os.path.join(want, n), shallow=False))]
    for n in names:
        print(("FAIL  " if n in bad else "PASS  ") + n)
    if r.returncode or bad:
        print("FAILURES: " + ", ".join(bad or ["convert.py exited %d" % r.returncode]))
        sys.exit(1)
    print("ALL PASSED (%d)" % len(names))
```

`$P/tests/humblewood-verbatim.py`: its `ROOT` becomes the private repo root (two `dirname`s from `tests/…`, not three), and it imports `extract-humblewood.py` from `scripts/` the way it did before (read its import lines and keep them working). With `_conversion-data` linked (Task 7) it finds the PDFs; without them it still prints its `SKIP` line.

- [ ] **Step 4: `$P/tests/private-data.js`** — the skeleton Task 9 fills:

```js
#!/usr/bin/env node
/* Content checks on the private packs (#85), moved out of the public suites.
   Runs with the public harness: FIELDBOOK is the public checkout, BUNDLES the
   private bundles tests/run.sh just wrote. */
'use strict';
const fs = require('fs');
const path = require('path');
const FIELDBOOK = process.env.FIELDBOOK;
const BUNDLES = process.env.BUNDLES;
if (!FIELDBOOK || !BUNDLES) { console.log('FAILURES: run me through tests/run.sh'); process.exit(1); }
const {loadApp, makeCheck} = require(path.join(FIELDBOOK, 'src', 'tests', 'harness.js'));
const ck = makeCheck();
const PRIV = path.resolve(__dirname, '..');
const data = (dir, file) => JSON.parse(fs.readFileSync(path.join(PRIV, 'data', dir, file), 'utf8'));
const bundle = file => JSON.parse(fs.readFileSync(path.join(BUNDLES, file), 'utf8'));

// ---------- the registry agrees with every bundle (the public rules-data.js check, for this registry)
const reg = JSON.parse(fs.readFileSync(path.join(PRIV, 'data', 'packs.json'), 'utf8'));
reg.packs.forEach(p => {
  const b = bundle(p.file);
  ck(p.file + ': system, name and dataVersion from the registry',
     b.system === p.system && b.name === p.title && (b.dataVersion || null) === (p.version || null), [b.system, b.name, b.dataVersion]);
});

// ---- moved checks go above this line (Task 9) ----
ck.done();
```

(Check `makeCheck()`'s `done()` prints `ALL PASSED (n)` / `FAILURES: …` as the last line; adjust the runner if it prints anything else.)

- [ ] **Step 5: The leak scanner** — `$P/tests/leak-scan.py`, a cleaned-up port of `inventories/leakscan.py` (stdlib only):

```
python3 tests/leak-scan.py [--self-test]
```

- **Private corpus:** every string value in `data/{5e2024,xanathars,tashas,humblewood}/*.json`.
- **Free corpus:** every string in `$FIELDBOOK/data/srd52/*.json` and `$FIELDBOOK/data/homebrew/*.json`.
- **Normalising:** strip `{@tag …}` (keep its display part), `[Table: …]` and HTML tags; lowercase; split into words (`[a-z0-9']+`).
- **Index:** every 14-word and every 10-word run of the private corpus that is absent from the free corpus.
- **Scan:** every file in `git -C $FIELDBOOK ls-files`, plus `$FIELDBOOK/dist/fieldbook.html`. Skip binary files (images, fonts, zips) and `data/packs.json`.
- **Runs:** collapse overlapping hits into maximal runs. A run's hash is the first 16 hex characters of the sha256 of its normalised words joined by single spaces.
- **Fail** when:
  - a 14-word run is not in `tests/leak-allowlist.json` (as `{file, hash}`);
  - an allowlist entry matches nothing. Stale entries fail, as stale corrections do.
- **Report only:** 10-word runs, one line each with file, line and the run's first 12 words.
- **Output:**
  - `PASS`/`FAIL` lines and the summary line `ALL PASSED (n)` / `FAILURES: …`;
  - never print a whole run longer than 12 words. The output is private, but keep it short.
- **`--self-test`:** synthetic corpora in a temp dir. It checks that:
  - a planted 14-word run is found;
  - an allowlisted one is not reported as a failure;
  - a stale allowlist entry fails;
  - a 10-word run is reported and does not fail.

  `run.sh` calls it first, as its own `run leak-scan-self-test "$PY" tests/leak-scan.py --self-test`.

- [ ] **Step 6: Build the allowlist by review, not by bulk**

Run `FIELDBOOK=$W python3 $P/tests/leak-scan.py`. For every failing run, decide exactly one of:
- **Allowed** (add `{"file", "hash", "why"}`):
  - (a) `scripts/srd-corrections.json`: "R8: a span the SRD correction must find";
  - (b) the `CHANGELOG` footnote in `src/js/30-version.js`, `docs/CHANGELOG.md` and `dist/fieldbook.html`: "decision 3";
  - (c) Fieldbook's own text that the converter writes into the packs (`FIGHTING_STYLES`, `CLASS_BLURB`, the edition notes, `overlay.json` prose) wherever it appears: "Fieldbook's own text, in the packs because convert.py writes it there";
  - (d) `data/srd52/*`: "the SRD's own text".
- **A leak:** fix it in the public repo, in this task. Commit it with the others, and say which file and why in the report.

Anything left in the files that leave in Task 10, or that Task 9 moves, is listed in the report and **not** allowlisted: the scan runs green only after Task 10. Until then, run it with the expected leftovers reported.

- [ ] **Step 7: CI and the release workflow (private)**

`$P/.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  schedule:
    - cron: "17 4 * * *"          # nightly: a leak in public main is caught within a day
  workflow_dispatch:
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: wardmanm/RPGFieldbook
          ref: main
          path: _fieldbook
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Build the public app (the harness reads its sources; the scan reads its artifact)
        run: cd _fieldbook && ./build.sh --no-zip
      - name: Private suites
        run: FIELDBOOK="$PWD/_fieldbook" bash tests/run.sh
```

`$P/.github/workflows/data-release.yml`, on `push: tags: ["data-v[0-9]+.[0-9]+.[0-9]+-[0-9]+"]` and `workflow_dispatch` with a `tag` input. It mirrors the public `data-release.yml`, with these differences:
1. Check out the public repo at `v<base>` into `_fieldbook`: the app release this data is for. Fail if that tag is missing.
2. Verify that `data/packs.json`'s `release` equals the tag's version.
3. Run `python3 _fieldbook/tools/data-kit/fbdata.py versions --check --registry data/packs.json --data-root data`.
4. Build: `cd _fieldbook && ./build.sh --no-zip`.
5. Run the tests: `FIELDBOOK=$PWD/_fieldbook bash tests/run.sh`.
6. Bundle into `dist`, then
   `python3 _fieldbook/tools/data-kit/fbdata.py pack dist -o dist/fieldbook-data-private-$V.zip --registry data/packs.json --built-for <base>`.
7. Validate with `fbdata.py validate`. **Not `--public`**: these packs carry no open licence.
8. Write the notes inline: what changed (the packs whose `version` is this release), and how to import.
9. Publish with `gh release create "$TAG" … --title "Fieldbook private data $V" --latest=false`.

No "latest" check is needed: this repo has no app releases.

- [ ] **Step 8: `$P/README.md`**

Cover:
- what this repo is and why it's private;
- the layout (§3 of the spec);
- one-time setup next to the public clone (the two symlinks);
- running the tests (`FIELDBOOK=../RPGFieldbook tests/run.sh`, or through the public `run.sh`);
- converting, via the public `dev.sh` menu;
- the Humblewood extractor (`python3 scripts/extract-humblewood.py --help`) and `docs/humblewood.md`;
- cutting a private data release: the public `node scripts/data-release.js --registry ../RPGFieldbookPrivate/data/packs.json --data-root ../RPGFieldbookPrivate/data`, then the printed commands;
- the leak scan and its allowlist rules (Step 6's four categories).

Plain, for Mike.

- [ ] **Step 9: `dev.sh`'s converter menu** — the options become:

```
  1) SRD 5.2                 -> data/srd52
  2) D&D 2024 core           -> _private-data/data/5e2024
  3) Xanathar's Guide        -> _private-data/data/xanathars
  4) Tasha's Cauldron        -> _private-data/data/tashas
  5) all of 2–4
```

- **SRD:** `run "$PY" scripts/convert.py srd "$dir" -o data/srd52`.
- **Options 2–5** need `_private-data/data`. Without it, say "Link the private repo as _private-data first (see its README)" and stop.
- **XGE and TCE:** their `--avoid-table-names` reads `_private-data/data/5e2024/tables.json`.
- Keep the overwrite prompt naming the targets.

- [ ] **Step 10: Run, and commit in both repos**

```bash
cd "$W" && ./build.sh --no-zip && ./src/tests/run.sh && node src/tests/private-data.js | tail -3
cd "$P" && FIELDBOOK="$W" bash tests/run.sh | tail -8
```

Expected:
- **Public:** `All 10 suites passed`.
- **`private-data.js`:** relays the private summary, which still reports the leftovers Step 6 names.
- **Private:** every suite passes or skips, except `leak-scan`. Until Task 10 it reports only the expected leftovers. Say so plainly.

```bash
cd "$P" && git add -A tests README.md .github && git -c commit.gpgsign=false commit -m "Private tests, the leak scan, CI and the private data release (#85)"
cd "$W" && git add src/tests/private-data.js src/tests/data-kit.py dev.sh && git commit -m "test: the private-data suite runs the private repo's tests when it is linked (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(Plus any public leak fix from Step 6, with its own commit.)

---

### Task 9: The test split — public suites keep their logic, the private one takes the content (R10, Review Focus 2)

**Files:**
- Modify (public): `src/tests/rules-data.js`, `src/tests/tables.js`, `src/tests/sheet.js`, `src/tests/char-update.js`, `src/tests/docs.js`
- Modify (private): `$P/tests/private-data.js`

**Interfaces:**
- Consumes: the private test harness (Task 8): `data(dir, file)`, `bundle(file)`, `FIELDBOOK`, `BUNDLES`.
- Produces: public suites that pass with the four packs' folders absent.

- [ ] **Step 1: Baseline counts** — `./build.sh --no-zip && for s in rules-data tables sheet char-update docs; do node src/tests/$s.js | tail -1; done` and the private `tests/run.sh` count. Record them.

- [ ] **Step 2: Apply `inventories/js-tests.md`, block by block, by its dispositions:**
  - **KEEP-GENERIC:** leave it. Where the inventory's §1 lists a pack loop, change it to `['homebrew','srd52']`. That adds `srd52` where a loop lacked it, which is more coverage, not less.
  - **REPOINT:** read the same entry from `data/srd52` (or `dist/srd52_full.json`). The inventory verified each entry exists with the same values; re-check the ones it marks "re-verify" (the #78 prose pins, the #66 multiclass block) before relying on them. The one asserted value that changes: the Fighter's Fighting Style menu has **4** options in SRD 5.2, not 10.
  - **FIXTURE:** build the invented fixture the inventory describes, inline in the test:
    - for `char-update.js` #63/#69, a class with two subclasses (one with its own multi-step picker, one with none) and a second class for the multiclass-title case. Generalise the file's existing `'Tester'`/`'Path of Tests'` fixture;
    - for #77, one item with `spell.attack` and `spell.dc` both +3, and one with `spell.dc` only, reproducing the asserted numbers;
    - for `tables.js`, empty `EXPLAINED_IN_PROSE` and reword its comment without quoting the book.

    Invented names and text only.
  - **MOVE-PRIVATE:** cut the block from the public file and paste it above `// ---- moved checks go above this line (Task 9) ----` in `$P/tests/private-data.js`, rewriting its file reads: `data/<pack>/x.json` → `data('<pack>', 'x.json')`; `dist/<pack>_full.json` → `bundle('<pack>_full.json')`; a read of `data/srd52` (the SRD/2024 twin checks need both) → `path.join(FIELDBOOK, 'data', 'srd52', …)`. Keep each check's label and assertion as it was. Add whatever `X` names the moved checks use to the private `loadApp([...])` call.

- [ ] **Step 3: Pin "no public test reads a private pack"** — `src/tests/docs.js`:

```js
// ---------- no public test reads a private pack (#85, Review Focus 2)
const PRIVATE_DIRS = /(?:data|dist)[\/'", ]+(?:5e2024|xanathars|tashas|humblewood)(?:_full\.json|[\/'"])/;
fs.readdirSync('src/tests').filter(f => /\.(js|py)$/.test(f)).forEach(f => {
  const hits = read('src/tests/' + f).split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => PRIVATE_DIRS.test(l));
  ck('src/tests/' + f + ' reads no private pack', !hits.length, hits.slice(0, 3));
});
```

(Adjust the regex until it catches each read form the old suites used: `'data/5e2024/items.json'`, `path.join(ROOT,'data','5e2024',…)`, `pack('5e2024', …)`, `shippedItems('tashas', …)`, `dist/xanathars_full.json`. Arbitrary label strings in synthetic fixtures, like `mergeRules(…, '5e2024_full.json')`, do not read a pack. Rename them to neutral labels such as `'rulebook_full.json'` so the check needs no exceptions.)

- [ ] **Step 4: Prove the public suites need no private data**

```bash
T=$(mktemp -d)
rsync -a --exclude .git --exclude _private-data --exclude _conversion-data --exclude .venv --exclude .superpowers ./ "$T/"
rm -rf "$T/data/5e2024" "$T/data/xanathars" "$T/data/tashas" "$T/data/humblewood"
python3 - "$T/data/packs.json" <<'PY'
import json, sys
p = sys.argv[1]; r = json.load(open(p))
r["packs"] = [x for x in r["packs"] if x["dir"] in ("srd52", "homebrew")]
open(p, "w").write(json.dumps(r, indent=2) + "\n")
PY
(cd "$T" && ./build.sh --no-zip >/dev/null && ./src/tests/run.sh)
```

Expected: every suite passes except `humblewood-verbatim`, which skips (no PyMuPDF under the system python) or fails for want of its data. That suite leaves in Task 10. If anything else fails, a check still reads a private pack: fix it, and repeat.

- [ ] **Step 5: Run both repos for real**

Run: `./build.sh --no-zip && ./src/tests/run.sh` → `All 10 suites passed`, then `cd $P && FIELDBOOK=$W bash tests/run.sh | tail -6` → `private-data` passes with the moved checks.
Report the before/after counts:
- **public:** the drop per suite;
- **private:** the gain, which should roughly equal the public drop less the FIXTURE checks, which stay public.

- [ ] **Step 6: Commit in both repos**

```bash
cd "$P" && git add tests/private-data.js && git -c commit.gpgsign=false commit -m "The private packs' content checks, moved from the public suites (#85)"
cd "$W" && git add src/tests/rules-data.js src/tests/tables.js src/tests/sheet.js src/tests/char-update.js src/tests/docs.js
git commit -m "test: public suites test the public packs and invented fixtures; content checks moved private (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: The removal commit (R1, R3)

**Files:**
- Delete: `data/5e2024/`, `data/xanathars/`, `data/tashas/`, `data/humblewood/`, `scripts/extract-humblewood.py`, `src/tests/humblewood-verbatim.py`, `src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md`, `src/docs/wiki/data/humblewood.md`
- Modify: `data/packs.json` (drop four entries), `src/tests/run.sh` (`SUITES`), `CLAUDE.md`, `src/docs/wiki/index.md`, every page linking a moved page, any other file `git grep` finds below

**Interfaces:** after this commit, nothing public names a private path except as a description of the private repo.

- [ ] **Step 1: Prove the private copy is current**

```bash
for d in 5e2024 xanathars tashas humblewood; do diff -r "data/$d" "_private-data/data/$d" >/dev/null && echo "same $d" || echo "DIFFERS $d"; done
T7=<Task 7's public commit — the SDD ledger names it>
git log --oneline "$T7"..HEAD -- data/5e2024 data/xanathars data/tashas data/humblewood scripts/extract-humblewood.py src/tests/humblewood-verbatim.py src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md src/docs/wiki/data/humblewood.md
```

Expected: `same` four times; the log is empty, so nothing that leaves has changed since Task 7. Anything else is a stop: report BLOCKED.

- [ ] **Step 2: Remove, and fix everything that named them, in one commit**

```bash
git rm -r -q data/5e2024 data/xanathars data/tashas data/humblewood scripts/extract-humblewood.py \
  src/tests/humblewood-verbatim.py src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md src/docs/wiki/data/humblewood.md
python3 - <<'PY'
import json
p = "data/packs.json"
r = json.load(open(p, encoding="utf-8"))
before = [x["system"] for x in r["packs"]]
r["packs"] = [x for x in r["packs"] if x["dir"] in ("srd52", "homebrew")]
open(p, "w", encoding="utf-8", newline="\n").write(json.dumps(r, indent=2, ensure_ascii=False) + "\n")
print(before, "->", [x["system"] for x in r["packs"]])
PY
git diff data/packs.json        # only the four entries removed; release, SRD and Homebrew untouched
```

(Removing whole entries is the R3 change the spec rules on. No `version`, `digest` or `release` value is edited.)

- `src/tests/run.sh`: `SUITES="converter tables rules-data sheet char-update docs data-kit data-archive srd-verbatim private-data"` (ten).
- `CLAUDE.md`:
  - "What this is": the public packs are SRD 5.2 and homebrew; the 2024, Xanathar's, Tasha's and Humblewood packs live in the private repo. Drop the `extract-humblewood.py` sentence.
  - The tests bullet: ten suites, with `private-data` running the private repo's suites when `_private-data` is linked, and skipping otherwise. Drop the `humblewood-verbatim` lines.
  - "Where to edit what": `data/<system>/` holds `srd52` and `homebrew`.
  - Converter: the 2024 gate reads `diff -r /tmp/chk _private-data/data/5e2024`.
- `src/docs/wiki/index.md`: remove the Humblewood and Humblewood-playtests lines. Every wiki page that links `data/humblewood.md` or `HUMBLEWOOD-PLAYTESTS.md` (`git grep -ln 'humblewood.md\|HUMBLEWOOD-PLAYTESTS' src/docs CLAUDE.md README.md docs`) changes the link to plain text: "the private repo's `docs/humblewood.md`".
- Then:
  ```bash
  git grep -n "data/5e2024\|data/xanathars\|data/tashas\|data/humblewood\|extract-humblewood\|humblewood-verbatim\|HUMBLEWOOD-PLAYTESTS" -- ':!src/docs/_claude/WIRING-LEDGER.md' ':!src/docs/plans' ':!src/docs/specs'
  ```
  Each hit must be fixed, or must describe the private repo. Code and tests have none (Task 9). The zip ban list's `extract-humblewood\.py` stays, harmlessly. Task 11 rewrites the wiki prose: fix only what breaks a test here.

- [ ] **Step 3: Run everything, with and without the private repo**

```bash
./build.sh --no-zip && ./src/tests/run.sh                                 # All 10 suites passed (private-data runs)
mv _private-data /tmp/85-unlinked && ./src/tests/run.sh; mv /tmp/85-unlinked _private-data   # 9 pass, private-data skipped
python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o /tmp/srd && diff -r /tmp/srd data/srd52 && echo SRD-GATE-CLEAN
python3 scripts/convert.py all _conversion-data/5etools-v2.36.1 -o /tmp/chk && diff -r /tmp/chk _private-data/data/5e2024 && echo 2024-GATE-CLEAN
```

The private `leak-scan` must now pass with **no** leftovers: the files that left are gone. If it reports a run, it is a leak: fix it (Task 8, Step 6's rules).

- [ ] **Step 4: Commit**

```bash
git add -A data/packs.json src/tests/run.sh CLAUDE.md src/docs/wiki
git status --short             # the deletions are staged; dist/fieldbook.html only modified
git commit -m "chore: the copyrighted packs leave this repo for RPGFieldbookPrivate (#85)

The 2024, Xanathar's, Tasha's and Humblewood packs, the Humblewood extractor,
its PDF suite and its notes now live in the private repo, with their history.
Public data is SRD 5.2 and homebrew.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Docs — README, player docs, RELEASING, the wiki, the 2.0 purge, the ledger, the player notes

**Files:**
- Modify: `README.md` (§3a, §9, §10), `docs/README-converter.md`, `docs/rules-schema.md`, `src/docs/RELEASING.md`
- Create: `src/docs/wiki/data/private-data.md`, `src/docs/wiki/data/data-kit.md`
- Modify (wiki): `index.md`, `overview.md`, `decisions.md`, `data/converter.md`, `data/supplements.md`, `data/homebrew.md`, `data/srd.md`, `architecture/rules-packs.md`, `architecture/data-archive.md`, `features/settings-and-updates.md`, `process/building-and-ci.md`, `process/testing.md`, `roadmap/known-issues.md`, `roadmap/2.0.md`
- Modify: `src/docs/_claude/WIRING-LEDGER.md` (append), `src/docs/UNRELEASED.md`

- [ ] **Step 1: The ledger entry (append only)** — `## The private data split and the data kit (#85, 2026-10-09)`, numbered points:
  1. what is public now and what is private;
  2. the private repo: layout, history kept by `git filter-repo`, its tests, CI (nightly), private releases (`data-release.js --registry`, `X.Y.Z-N`, `fieldbook-data-private-<ver>.zip`);
  3. `_private-data` and `wt.sh`;
  4. the kit: `bundle` (the port and its parity proof), `convert`, `build`, `validate --public`, the kit zip, the app zip without `scripts/`;
  5. the release guards;
  6. the quiet chip;
  7. homebrew `requires`;
  8. the class one-liners;
  9. the text clean-up (decisions 2 and 3, R7, R8);
  10. the test split, and the counts moved;
  11. the leak scan and its allowlist rules;
  12. every spec ruling R1–R16 and decisions 1–4.

  End with `Pages:` links. Get its line with `grep -n '^## The private data split' …`; every History line below cites it.

- [ ] **Step 2: The wiki**
  - **New `data/private-data.md`** (page template in `.claude/skills/wiki/SKILL.md`):
    - the split and why;
    - the private repo's layout;
    - `_private-data`;
    - how the tests reach across (`private-data.js` → `tests/run.sh` → the public harness);
    - the leak scan;
    - private data releases;
    - Mike's workflow (spec §9);
    - **Rules that must hold:** the removal ordering, never a private pack in a public release, the allowlist categories;
    - **Traps:** stale allowlist entries fail; a symlink is a file to git; the private CI builds public `main`;
    - **Code:** `bundle()`, `cmd_build()`, `validate_archive()` in `fbdata.py`; `dataStatus()`; the scripts;
    - History.
  - **New `data/data-kit.md`:**
    - `fbdata.py`'s commands, with an example of each;
    - the kit zip and its allowlist;
    - `build`'s three inputs;
    - what a kit user may share;
    - the bundler's history (Node → Python, parity);
    - History.
  - **`index.md`**, under "## Data":
    - `- [Private data](data/private-data.md) — the copyrighted packs in RPGFieldbookPrivate: layout, tests, the leak scan, private releases`
    - `- [Data kit](data/data-kit.md) — fbdata.py: bundle, convert, build, validate; the kit zip`
  - **Every page in the Files list:** rewrite to the new truth, with a History line. Covers:
    - examples of packs now name `srd52` or `homebrew`;
    - `supplements.md` says its output goes to `_private-data` and keeps the three traps;
    - `testing.md` lists the ten suites;
    - `known-issues.md`:
      - private packs get no newer-data notice;
      - homebrew's Xanathar's spells cannot resolve publicly;
      - the old releases' source archives stay reachable until 2.0;
    - `decisions.md` gets one line per spec decision and ruling.
  - **`roadmap/2.0.md`:** the purge plan (spec §10).

- [ ] **Step 3: Player-facing docs**
  - **README §3a:** the rules data zip holds SRD 5.2 and homebrew. The 2024 books, Xanathar's, Tasha's and Humblewood are no longer distributed; packs already loaded keep working. Anyone with their own 5e-tools data can build more with the data kit.
  - **§9:** the archive's list names `srd52_full.json` and `homebrew_full.json` only.
  - **§10:** credits for the public packs only, with the SRD statement unchanged (the `docs` suite checks it).
  - **`docs/README-converter.md`:** the kit (`fbdata.py convert` and `build`) is how to run the converter from a release. `all` and `supplement` build packs for your own use only.
  - **`docs/rules-schema.md`:** worked examples that named `5e2024_full.json`, `xanathars_full.json` or `humblewood_full.json` now use `srd52_full.json`, `homebrew_full.json` or invented packs. The mechanisms they describe are unchanged.
  - **`src/docs/RELEASING.md`:**
    - app releases attach the kit zip;
    - the public-assets guard;
    - a new section on cutting a private data release;
    - deleting old release assets is a one-time step, done by hand with Mike's go-ahead.

- [ ] **Step 4: The player notes** — under `## Pending` in `src/docs/UNRELEASED.md` (no tags, no versions):

```markdown
- The rules data zip now holds the free SRD 5.2 rules and the homebrew pack. The D&D 2024 books, Xanathar's Guide, Tasha's Cauldron and Humblewood packs are no longer distributed; any you have already loaded keep working.
- A new data kit, attached to each release, builds a rules data zip from your own 5e-tools data in one command.
- A rules pack this version of Fieldbook doesn't know now shows its version quietly in Settings → Rules data.
- The homebrew pack's "needs" note now points to the SRD 5.2 pack.
```

- [ ] **Step 5: Build, test, and commit**

Run: `./build.sh && ./src/tests/run.sh` → `All 10 suites passed`; `node src/tests/docs.js | tail -1` → `ALL PASSED`.

```bash
git add README.md docs/README-converter.md docs/rules-schema.md src/docs/RELEASING.md src/docs/wiki src/docs/_claude/WIRING-LEDGER.md src/docs/UNRELEASED.md
git commit -m "docs: the private data split and the data kit — README, player docs, RELEASING, wiki, ledger, notes (#85)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## At the finish (the controller, each step on Mike's go-ahead)

Not tasks for an implementer:
1. **Push the private repo:** `git -C /Users/mwardman/Documents/Repos/RPGFieldbookPrivate push -u origin main`. Expect its push-triggered CI run to fail (`FAILURES: bundling`): it checks out public `main`, which has no `fbdata.py bundle` until #85 merges. Don't hold the merge for it, and don't change the private repo to make it pass. R1 still holds: the private repo has the data before public `main` loses it.
2. **Merge and push public `main`** with `Closes #85, closes #82`, then rebuild the artifact on `main` (`./build.sh --no-zip`, `node scripts/build-html.js --check`, commit "chore: rebuild the artifact") and push.
3. **Run the private CI by hand** (`gh workflow run ci.yml -R wardmanm/RPGFieldbookPrivate`) and confirm it is green.
4. **Delete the old release assets**, after showing Mike the exact list:
   - every `*_full.json`, `fieldbook-v*.zip` and `fieldbook-v1.3.0-source.zip`, on v1.3.0 to v1.7.2;
   - `fieldbook.html` stays.
