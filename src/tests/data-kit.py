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
import zipfile

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
# every pack that has shipped a version is seeded with a digest; a pack still
# awaiting its first release (SRD 5.2, #84: version is deliberately None until
# 1.8.0) has none yet, and --seed is never run by hand to manufacture one.
ck("every released real pack has a digest",
   all((p.get("digest") or "").startswith("sha256:") for p in real["packs"] if p.get("version") is not None))

# ---------- the archive: pack and validate (spec §6)
def bundles(d):
    """bundles in d/dist matching d's registry, the way fbdata.py bundle stamps them"""
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

# ---------- the release scripts, in a scratch git checkout (never this one)
def git(d, *args):
    # -c commit.gpgsign=false / tag.gpgsign=false: these scratch repos commit
    # and tag under a throwaway identity that can't sign — without this, a
    # machine with signing on globally would hang these tests on a GPG prompt
    # or fail every commit/tag outright (#83 final review item 12).
    return subprocess.run(["git", "-C", d, "-c", "user.name=t", "-c", "user.email=t@example.com",
                           "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false"] + list(args),
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

# ---------- a data release needs an app that can open the zip (#83 final review item 8)
d = checkout(app="1.7.2", release="1.7.2")
r = node(d, "scripts/data-release.js")
ck("data-release refuses an app older than 1.8.0", r.returncode == 1 and "1.8.0 or later" in r.stderr, r.stderr)
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
ck("app notes when no pack changed say only the app is needed",
   r.returncode == 0 and "No rules pack changed in this release" in r.stdout, r.stdout)
ck("bad arguments exit 1", node(d, "scripts/data-release-notes.js", "1.9", "--app").returncode == 1)
shutil.rmtree(d)

# ---------- fbdata.py bundle: golden checks pinning its behaviour (#85, R11)
# The Node bundler this replaced reproduced these byte for byte, over every
# real pack and these same fixtures, before it was removed — see
# src/docs/_claude/WIRING-LEDGER.md "The bundler moves to Python".
def py_bundle(root, out):
    return subprocess.run([sys.executable, FBDATA, "bundle", "-o", out,
                           "--registry", os.path.join(root, "data", "packs.json"),
                           "--data-root", os.path.join(root, "data")], capture_output=True, text=True)


def case(name, files, packs, check):
    """write files/packs under a scratch data root, run fbdata.py bundle into
    d/pyout, then hand (name, returncode, pyout-dir) to check(), which ck()s"""
    d = tempfile.mkdtemp(prefix="fbdata-case-")
    for rel, obj in files.items():
        write(d, "data/" + rel, obj if not isinstance(obj, str) else None, obj if isinstance(obj, str) else None)
    write(d, "data/packs.json", {"release": "1.8.0", "packs": packs})
    out = os.path.join(d, "pyout")
    r = py_bundle(d, out)
    check(name, r, out)
    shutil.rmtree(d)


def fails(name, r, out):
    ck("bundle: " + name, r.returncode == 1, (r.returncode, r.stdout, r.stderr))


def z_obj(name, r, out):
    """(ok, the parsed z_full.json or None): the success cases all write one pack"""
    ck("bundle: " + name + " (exit 0)", r.returncode == 0, (r.returncode, r.stdout, r.stderr))
    p = os.path.join(out, "z_full.json")
    return read_json(out, "z_full.json") if r.returncode == 0 and os.path.isfile(p) else None


P = lambda **kw: dict({"system": "Z", "dir": "z", "file": "z_full.json", "title": "Zed"}, **kw)

case("duplicates replace in place, last wins",
     {"z/a.json": {"system": "Z", "spells": [{"name": "Bolt", "level": 1}, {"name": "Glow"}]},
      "z/b.json": {"system": "Z", "spells": [{"name": "bolt ", "level": 2}]}}, [P(version="1.8.0")],
     lambda name, r, out: ck("bundle: " + name + " writes exactly this",
         open(os.path.join(out, "z_full.json"), encoding="utf-8").read() ==
         '{"system":"Z","name":"Zed","version":1,"dataVersion":"1.8.0","rulebook":true,'
         '"spells":[{"name":"bolt ","level":2},{"name":"Glow"}]}\n'
         if r.returncode == 0 and os.path.isfile(os.path.join(out, "z_full.json")) else False,
         (r.returncode, r.stdout, r.stderr)))

case("nameless entries are kept",
     {"z/a.json": {"system": "Z", "items": [{"name": ""}, {"weight": 1}, "junk", [1]]}}, [P()],
     lambda name, r, out: ck("bundle: " + name + ", in order",
         (lambda o: o is not None and o["items"] == [{"name": ""}, {"weight": 1}, "junk", [1]])(z_obj(name, r, out))))

case("keywords key by term, or by name when the term is blank",
     {"z/a.json": {"system": "Z", "keywords": [{"term": " ", "name": "Gleam"}, {"term": "gleam", "name": "x"},
                                               {"term": 0, "name": "zero"}, {"name": "Other"}]}}, [P()],
     lambda name, r, out: ck("bundle: " + name,
         (lambda o: o is not None and o["keywords"] ==
          [{"term": "gleam", "name": "x"}, {"term": 0, "name": "zero"}, {"name": "Other"}])(z_obj(name, r, out))))

case("subclasses key by class and name",
     {"z/a.json": {"system": "Z", "subclasses": [{"class": "Seer", "name": "Path"}, {"class": "Monk", "name": "Path"},
                                                 {"name": "Orphan"}, {}]}}, [P()],
     lambda name, r, out: ck("bundle: " + name + " (same name, different class, both kept)",
         (lambda o: o is not None and o["subclasses"] ==
          [{"class": "Seer", "name": "Path"}, {"class": "Monk", "name": "Path"}, {"name": "Orphan"}, {}])
         (z_obj(name, r, out))))

case("features fall back to traits only when features is absent",
     {"z/a.json": {"system": "Z", "traits": [{"name": "Keen"}]},
      "z/b.json": {"system": "Z", "features": [], "traits": [{"name": "Lost"}]}}, [P()],
     lambda name, r, out: ck("bundle: " + name + " (holds only Keen)",
         (lambda o: o is not None and o["features"] == [{"name": "Keen"}])(z_obj(name, r, out))))

case("excludeSystems, requires, licence and credit carried",
     {"z/a.json": {"system": "Z", "excludeSystems": ["b", " a ", ""], "requires": [{"pack": "Q", "spells": ["S"]}],
                   "races": [{"name": "Gnomish"}]},
      "z/b.json": {"system": "Z", "excludeSystems": ["a", "b"], "requires": [{"pack": "Q", "spells": ["S"]}]}},
     [P(version="1.8.0-2", license="MIT", attribution="By someone.")],
     lambda name, r, out: ck("bundle: " + name,
         (lambda o: o is not None and o["excludeSystems"] == ["a", "b"]
          and o["requires"] == [{"pack": "Q", "spells": ["S"]}] and o["license"] == "MIT"
          and o["attribution"] == "By someone." and o["dataVersion"] == "1.8.0-2")(z_obj(name, r, out))))

case("excludeSystems disagreeing across files fails",
     {"z/a.json": {"system": "Z", "excludeSystems": ["a"]}, "z/b.json": {"system": "Z", "excludeSystems": ["b"]}},
     [P()], fails)
case("requires with its keys in another order fails",
     {"z/a.json": {"system": "Z", "requires": [{"pack": "Q", "file": "q.json"}]},
      "z/b.json": {"system": "Z", "requires": [{"file": "q.json", "pack": "Q"}]}}, [P()], fails)
case("requires differing only by 1.0 vs 1 still agree",
     {"z/a.json": {"system": "Z", "requires": [{"pack": "Q", "n": 1.0}]},
      "z/b.json": {"system": "Z", "requires": [{"pack": "Q", "n": 1}]}}, [P()],
     lambda name, r, out: ck("bundle: " + name,
         (lambda o: o is not None and o["requires"] == [{"pack": "Q", "n": 1.0}])(z_obj(name, r, out))))
case("a folder whose files name another system fails",
     {"z/a.json": {"system": "Other", "feats": [{"name": "Tough"}]}}, [P()], fails)
case("two systems in one folder fails",
     {"z/a.json": {"system": "Z"}, "z/b.json": {"system": "Y"}}, [P()], fails)
case("invalid JSON fails", {"z/a.json": "{nope"}, [P()], fails)

case("a missing folder or an empty one is skipped",
     {"y/readme.txt": "not json"}, [P(), P(system="Y", dir="y", file="y_full.json", title="Why")],
     lambda name, r, out: ck("bundle: " + name + " (exit 0, nothing written)",
         r.returncode == 0 and os.path.isdir(out) and os.listdir(out) == [], (r.returncode, os.listdir(out) if os.path.isdir(out) else None)))

case("text outside ASCII, numbers and floats",
     {"z/a.json": {"system": "Z", "items": [{"name": "Café — ✦", "weight": 0.5, "cost": 5.0, "n": -0, "big": 12345678}]}},
     [P()],
     lambda name, r, out: ck("bundle: " + name + " writes exactly this",
         open(os.path.join(out, "z_full.json"), encoding="utf-8").read() ==
         '{"system":"Z","name":"Zed","version":1,"rulebook":true,'
         '"items":[{"name":"Café — ✦","weight":0.5,"cost":5,"n":0,"big":12345678}]}\n'
         if r.returncode == 0 and os.path.isfile(os.path.join(out, "z_full.json")) else False,
         (r.returncode, r.stdout, r.stderr)))

ck('bundle_text escapes a lone surrogate as JSON.stringify does',
   fbdata.bundle_text({"a": 5.0, "b": chr(0xD800)}) == '{"a":5,"b":"' + chr(92) + 'ud800"}\n')

# ---- add new cases above this line ----
print("")
print(("FAILURES: " + ", ".join(FAILED)) if FAILED else "ALL PASSED (%d)" % TOTAL[0])
sys.exit(1 if FAILED else 0)
