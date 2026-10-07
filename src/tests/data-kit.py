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
