#!/usr/bin/env python3
"""
Keep the private repo's converted packs in step with this repo (#90)
====================================================================

The 2024, Xanathar's and Tasha's packs in RPGFieldbookPrivate are convert.py's
output on the 5e-tools dump, so a change here to convert.py, overlay.json or
class-resources.json can move them. This is the one place their conversion
commands live: dev.sh's converter menu writes through it, and the private
repo's converter gate checks through it, so the two cannot drift apart.

USAGE
  python3 scripts/sync-private.py [PACK ...]          check (the default)
  python3 scripts/sync-private.py --write [PACK ...]  regenerate them in place
  python3 scripts/sync-private.py --status            what the private repo has
                                                      left to commit or push

  PACK            5e2024, xanathars or tashas (default: all three)
  --dump DIR      the 5e-tools dump (default: _conversion-data/5etools-v2.36.1)
  --private DIR   the private checkout (default: _private-data)

A check converts into a scratch folder, compares byte for byte, and ends with
ALL PASSED (n), FAILURES: ... or SKIP - why: the line the test runners read.
--write converts every pack first and touches the private repo only if all of
them succeed. Humblewood is not here: its extractor reads the PDFs, nothing in
this repo. Dev-only; it never ships. Python 3.8+, standard library only.
"""
import argparse
import filecmp
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = "python3 scripts/sync-private.py --write"

# In this order: a supplement avoids the 2024 pack's table names, because the
# app looks a table up by name across every loaded pack.
PACKS = ["5e2024", "xanathars", "tashas"]
BOOKS = {"xanathars": "XGE", "tashas": "TCE"}


def command(pack, dump, out, core):
    """convert.py's arguments for one pack. `core` is the 2024 folder a supplement avoids."""
    if pack == "5e2024":
        return ["all", dump, "-o", out]
    book = BOOKS[pack]
    return ["supplement", dump, "-o", out, "--book", book, "--system", book,
            "--avoid-table-names", os.path.join(core, "tables.json")]


def files(d):
    return sorted(n for n in os.listdir(d) if os.path.isfile(os.path.join(d, n))) if os.path.isdir(d) else []


def differences(got, want):
    """{file: how} for each file that is not byte for byte the same."""
    out = {}
    for n in sorted(set(files(got)) | set(files(want))):
        g, w = os.path.join(got, n), os.path.join(want, n)
        if not os.path.isfile(w):
            out[n] = "is new"
        elif not os.path.isfile(g):
            out[n] = "is no longer made"
        elif not filecmp.cmp(g, w, shallow=False):
            out[n] = "differs"
    return out


def convert_all(a, packs, scratch):
    """Convert each pack into scratch/<pack>. Returns {pack: error} for the ones that failed."""
    data = os.path.join(a.private, "data")
    # a supplement avoids the 2024 tables as they will be after this run
    core = os.path.join(scratch, "5e2024") if "5e2024" in packs else os.path.join(data, "5e2024")
    failed = {}
    for p in packs:
        r = subprocess.run([sys.executable, a.converter] + command(p, a.dump, os.path.join(scratch, p), core),
                           capture_output=True, text=True)
        if r.returncode:
            failed[p] = "convert.py exited %d" % r.returncode
            print("FAIL  %s: convert.py exited %d" % (p, r.returncode))
            for line in (r.stderr or r.stdout).strip().splitlines()[-5:]:
                print("      " + line)
    return failed


def check(a, packs):
    data = os.path.join(a.private, "data")
    with tempfile.TemporaryDirectory(prefix="sync-private-") as t:
        bad = convert_all(a, packs, t)
        total = 0
        for p in packs:
            if p in bad:
                continue
            got, want = os.path.join(t, p), os.path.join(data, p)
            diff = differences(got, want)
            for n in sorted(set(files(got)) | set(files(want))):
                total += 1
                print(("FAIL  %s/%s %s" % (p, n, diff[n])) if n in diff else ("PASS  %s/%s" % (p, n)))
            if diff:
                bad[p] = "%d file%s" % (len(diff), "" if len(diff) == 1 else "s")
    if bad:
        print("FAILURES: " + ", ".join("%s (%s)" % (p, bad[p]) for p in packs if p in bad)
              + "; not in step with this repo's converter: run " + FIX + ", then commit it in the private repo")
        return 1
    print("ALL PASSED (%d)" % total)
    return 0


def write(a, packs):
    data = os.path.join(a.private, "data")
    changed = False
    with tempfile.TemporaryDirectory(prefix="sync-private-") as t:
        if convert_all(a, packs, t):
            print("Nothing written: the private packs are as they were.")
            return 1
        for p in packs:
            got, want = os.path.join(t, p), os.path.join(data, p)
            diff = differences(got, want)
            os.makedirs(want, exist_ok=True)
            for n, how in diff.items():
                if how == "is no longer made":
                    os.remove(os.path.join(want, n))
                else:
                    shutil.copyfile(os.path.join(got, n), os.path.join(want, n))
            if diff:
                changed = True
                print("  %-10s %s" % (p, ", ".join("%s %s" % (n, {"differs": "updated", "is new": "added",
                                                                   "is no longer made": "removed"}[h])
                                                   for n, h in diff.items())))
            else:
                print("  %-10s unchanged" % p)
    if changed:
        print("\nNow commit it in the private repo, as part of this change:")
        print("  git -C %s add data && git -C %s commit -m \"... (#N)\"" % (a.private, a.private))
        print("and push it there after public main.")
    return 0


def status(a):
    """NOTE lines for what the private repo has left to commit or push; nothing when it has none."""
    def git(*args):
        return subprocess.run(["git", "-C", a.private] + list(args), capture_output=True, text=True)
    top = git("rev-parse", "--show-toplevel")
    # a plain folder inside some other repo would report that repo: ask only of the private repo's own top
    if top.returncode or os.path.realpath(top.stdout.strip()) != os.path.realpath(a.private):
        return 0
    name = os.path.basename(os.path.realpath(a.private))
    n = len([x for x in git("status", "--porcelain").stdout.splitlines() if x.strip()])
    if n:
        print("NOTE  the private repo (%s) has %d uncommitted change%s: commit them there with this change"
              % (name, n, "" if n == 1 else "s"))
    r = git("rev-list", "--count", "@{u}..HEAD")
    ahead = int(r.stdout.strip() or 0) if r.returncode == 0 else 0
    if ahead:
        print("NOTE  the private repo (%s) has %d commit%s not pushed: push it after public main"
              % (name, ahead, "" if ahead == 1 else "s"))
    return 0


def main():
    ap = argparse.ArgumentParser(description="Keep the private repo's converted packs in step with this repo.")
    ap.add_argument("packs", nargs="*", metavar="PACK", help="5e2024, xanathars or tashas (default: all three)")
    ap.add_argument("--write", action="store_true", help="regenerate the packs in the private repo")
    ap.add_argument("--status", action="store_true", help="note what the private repo has left to commit or push")
    ap.add_argument("--dump", default=os.path.join(ROOT, "_conversion-data", "5etools-v2.36.1"))
    ap.add_argument("--private", default=os.path.join(ROOT, "_private-data"))
    ap.add_argument("--converter", default=os.path.join(ROOT, "scripts", "convert.py"), help=argparse.SUPPRESS)
    a = ap.parse_args()
    if a.status:
        return status(a)
    unknown = [p for p in a.packs if p not in PACKS]
    if unknown:
        ap.error("not a converted pack: %s (choose from %s)" % (", ".join(unknown), ", ".join(PACKS)))
    packs = [p for p in PACKS if p in a.packs] or PACKS
    if not os.path.isdir(os.path.join(a.private, "data")):
        print("FAILURES: no private packs at %s (link the private repo as _private-data; see its README)"
              % os.path.join(a.private, "data"))
        return 1
    if not os.path.isdir(a.dump):
        if a.write:
            print("No 5e-tools dump at %s" % a.dump)
            return 1
        print("SKIP - no 5e-tools dump")
        return 0
    return write(a, packs) if a.write else check(a, packs)


if __name__ == "__main__":
    sys.exit(main())
