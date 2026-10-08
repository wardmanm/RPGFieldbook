#!/usr/bin/env python3
"""Fieldbook data kit: versions, digests and archives for rules packs (#83).

    fbdata.py digest   [--registry F] [--data-root D]
    fbdata.py versions (--changed | --check | --bump V | --seed) [--registry F] [--data-root D]
    fbdata.py pack <bundles-dir> -o OUT.zip [--registry F] [--dev] [--built-for X.Y.Z]
    fbdata.py validate OUT.zip

Python 3.8+, standard library only. Exit status: 0 ok, 1 a check failed,
2 bad input. Spec: src/docs/specs/2026-10-07-data-archive-design.md §4–§6.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import zipfile

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
