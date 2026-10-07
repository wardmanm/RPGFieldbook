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
