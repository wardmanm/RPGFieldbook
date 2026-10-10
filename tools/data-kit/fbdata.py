#!/usr/bin/env python3
"""Fieldbook data kit: versions, digests and archives for rules packs (#83, #85).

    fbdata.py digest   [--registry F] [--data-root D]
    fbdata.py versions (--changed | --check | --bump V | --seed) [--registry F] [--data-root D]
    fbdata.py bundle   -o DIR [--registry F] [--data-root D]
    fbdata.py pack <bundles-dir> -o OUT.zip [--registry F] [--dev] [--built-for X.Y.Z]
    fbdata.py validate OUT.zip [--public]
    fbdata.py convert <convert.py arguments...>
    fbdata.py build <src> [--srd | --full | --book CODE] -o OUT.zip [--version V]

Python 3.8+, standard library only. Exit status: 0 ok, 1 a check failed,
2 bad input. Spec: src/docs/specs/2026-10-07-data-archive-design.md §4–§6.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DEFAULT_REGISTRY = os.path.join(ROOT, "data", "packs.json")
DEFAULT_DATA_ROOT = os.path.join(ROOT, "data")
KIT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_LICENCES = ("CC-BY-4.0", "CC-BY-SA-3.0", "MIT")

# X.Y.Z is the data shipped with app X.Y.Z; X.Y.Z-N the Nth data-only release
# after it. NOT semver: here 1.8.0 < 1.8.0-1 < 1.8.0-10 < 1.8.1 (spec §3.1).
DATA_VER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([1-9]\d*))?$")
FILE_NAME = re.compile(r"^[A-Za-z0-9._-]+\.json$")
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
# The registry fields that reach the bundle, so changing one is a content change.
META_KEYS = ("system", "title", "license", "attribution")
# Written in this order; any other key a pack carries is kept, after these.
PACK_KEYS = ("system", "dir", "file", "title", "version", "digest", "license", "attribution")

MANIFEST = "fieldbook-data.json"
NOTICE = "NOTICE.md"
FIXED_TIME = (1980, 1, 1, 0, 0, 0)  # the earliest a zip can say: no build time leaks in


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


def validate_archive(path, public=False):
    """Problems with an archive (spec §6.3), one line each; [] when it is sound.
    public=True also refuses a pack whose licence a public release may not
    carry (R13) — missing or not one of PUBLIC_LICENCES."""
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
        if public:
            for m in packs:
                lic = m.get("license") if isinstance(m, dict) else None
                if lic not in PUBLIC_LICENCES:
                    errs.append("%s: licence %s is not one a public release may carry (%s)"
                                % (m.get("file"), lic or "(none)", ", ".join(PUBLIC_LICENCES)))
    return errs


def cmd_validate(a):
    errs = validate_archive(a.zip, public=a.public)
    for e in errs:
        print("%s: %s" % (a.zip, e), file=sys.stderr)
    if errs:
        return 1
    print("ok: %s" % a.zip)
    return 0


# ---------- bundling (#85, R11)
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
    """JSON.stringify(a) === JSON.stringify(b): key order counts, but 5.0 == 5
    as JSON.stringify sees it too — so compare through _ints() first."""
    a, b = _ints(a), _ints(b)
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


# ---------- convert / build: the kit's user-facing commands (#85, R12)
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


def _given(args, flag):
    """Whether the caller passed flag, as "--flag PATH" or "--flag=PATH"."""
    return any(a == flag or a.startswith(flag + "=") for a in args)


def _convert_argv(args):
    """convert.py's command line with the kit's overlay, resources and (for srd)
    corrections filled in, unless the caller named their own. argparse keeps the
    last of a repeated flag, so appending ours after a caller's --flag=PATH would
    silently replace theirs."""
    argv = [sys.executable, kit_file("convert.py", "scripts/convert.py")] + list(args)
    if args and args[0] in ("all", "srd", "supplement"):
        if not _given(args, "--overlay"):
            argv += ["--overlay", kit_file("overlay.json", "data/overlay.json")]
        if not _given(args, "--resources"):
            argv += ["--resources", kit_file("class-resources.json", "data/class-resources.json")]
        if args[0] == "srd" and not _given(args, "--corrections"):
            argv += ["--corrections", kit_file("srd-corrections.json", "scripts/srd-corrections.json")]
    return argv


def cmd_convert(a):
    return subprocess.run(_convert_argv(a.args)).returncode


def _is_dump(src):
    return os.path.isdir(os.path.join(src, "class")) or os.path.isdir(os.path.join(src, "spells"))


def cmd_build(a):
    src = os.path.abspath(a.src)
    if not os.path.exists(src):
        raise KitError("%s: no such file or folder" % a.src)
    if os.path.isdir(src) and not _is_dump(src) and _is_dump(os.path.join(src, "data")):
        raise KitError("%s looks like a 5e-tools checkout; point build at its data/ folder" % a.src)
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
                if obj.get("dataVersion") is not None:
                    raise KitError("%s: carries dataVersion %r; build it from a registry instead"
                                   % (f, obj.get("dataVersion")))
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
    p = sub.add_parser("bundle", help="roll each registered pack's folder into one importable file")
    common(p)
    p.add_argument("-o", "--output", required=True, help="the folder to write the bundles to (dist/)")
    p.set_defaults(fn=cmd_bundle)
    p = sub.add_parser("pack", help="write the data archive from bundled packs")
    p.add_argument("bundles", help="the folder holding the bundles (dist/)")
    p.add_argument("-o", "--output", required=True, help="the .zip to write")
    p.add_argument("--registry", default=DEFAULT_REGISTRY, help="default: data/packs.json")
    p.add_argument("--dev", action="store_true", help='version the archive "<release>+dev"')
    p.add_argument("--built-for", default=None, help="the app version it is for (default: APP_VERSION)")
    p.set_defaults(fn=cmd_pack)
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
