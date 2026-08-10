#!/usr/bin/env python3
"""Humblewood core prose must match the source book word for word.

Needs the PDF and .venv (pdfplumber/pymupdf), so it is SKIPPED when either is
absent — CI has neither. Run it locally after any re-extraction:

    .venv/bin/python src/tests/humblewood-verbatim.py

The reference is built the same way the extractor reads the page — column
aware, page furniture and table bands excluded — because a naive get_text()
interleaves the columns and injects footers mid-flow, which makes correct
extractions look wrong. Playtest content is excluded: it is not in this book.
"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
try:
    import fitz  # noqa: F401
except ImportError:
    print("SKIP - pymupdf not installed (needs .venv)"); sys.exit(0)
if not os.path.exists(os.path.join(ROOT, "_conversion-data/Rulebooks/HumblewoodMaster-V1.04/"
                                   "HBW_5ePlus-PlayerCharacterOptions_Update-09.2024_compressed.pdf")):
    print("SKIP - source PDF not present"); sys.exit(0)

import importlib.util, fitz, json, re, difflib, sys
spec=importlib.util.spec_from_file_location("eh","scripts/extract-humblewood.py")
eh=importlib.util.module_from_spec(spec); spec.loader.exec_module(eh)
d=fitz.open(eh.PDF)
# Build the reference COLUMN-AWARE, in the same reading order the extractor
# uses. A plain get_text() interleaves the two columns, so any passage crossing
# a column break is not contiguous in it and would look non-verbatim even when
# the extraction is perfect.
# Reference = the page's reading-order text with PAGE FURNITURE removed.
# page_words() keeps the running footer and the section tagline, which are
# injected mid-flow at every page break; any passage spanning a break then
# looks non-verbatim even when extracted perfectly.
# The extractor also excludes the bands the tables occupy, so the reference
# must too; otherwise a description that spans a table is not contiguous here.
_probs=[]
_tabs=eh.build_tables(d,_probs)
_skip=[t["_region"] for t in _tabs if t.get("_region")]
parts=[]
for pno in range(1,len(d)+1):
    for side in ("L","R"):
        pg=d[pno-1]
        for sp in eh.styled_spans(pg, eh.side_clip(pg,side)):
            if sp[5] in ("footer","tagline"): continue
            if any(p==pno and sd==side and lo<=sp[6]<=hi for p,sd,lo,hi in _skip): continue
            parts.append(sp[4])
d.close()
pdf=re.sub(r"\s+"," "," ".join(parts))
pdf=re.sub(r"(\w)- (\w)",r"\1\2",pdf)
def norm(s):
    s=re.sub(r"\[Table: ([^\]]+)\]",r"\1",s or "")
    t=re.sub(r"\s+"," ",re.sub(r"[^\w\s]"," ",s)).strip().lower()
    return re.sub(r"\s+"," ",re.sub(r"\bl\b"," ",t)).strip()
P=norm(pdf)
# Playtest content is not in THIS PDF and must not be checked against it. The
# set is derived from the extractor's packet registry rather than listed here,
# so adding a packet can never silently turn this suite red.
PLAY_SUB=set(); PLAY_BG=set()
for _pk in eh.PACKETS:
    for _r in _pk.get("races") or []:
        PLAY_SUB |= set(_r.get("lineages") or [])
    for _b in _pk.get("backgrounds") or []:
        PLAY_BG.add(_b["name"])
rows=[]
def ck(lbl,t):
    n=norm(t)
    if not n: return
    if n in P: rows.append((lbl,True,100)); return
    m=difflib.SequenceMatcher(None,n,P,autojunk=False).find_longest_match(0,len(n),0,len(P))
    rows.append((lbl,False,round(100*m.size/len(n))))
for x in json.load(open("data/humblewood/backgrounds.json"))["backgrounds"]:
    if x["name"] in PLAY_BG: continue
    ck("bg/"+x["name"],x.get("description"))
    if x.get("feature"): ck("bg/%s·%s"%(x["name"],x["feature"]["name"]),x["feature"].get("description"))
for x in json.load(open("data/humblewood/subclasses.json"))["subclasses"]:
    if x["name"] not in set(eh.CORE_SUBCLASSES): continue
    ck("sub/"+x["name"],x.get("description"))
    for lv,b in (x.get("levels") or {}).items():
        for t in b.get("traits") or []: ck("sub/%s L%s·%s"%(x["name"],lv,t["name"]),t.get("description"))
for x in json.load(open("data/humblewood/races.json"))["races"]:
    if x["name"] not in set(eh.CORE_RACES): continue
    ck("race/"+x["name"],x.get("description"))
    for t in x.get("traits") or []: ck("race/%s·%s"%(x["name"],t["name"]),t.get("description"))
    for sd in x.get("subraces") or []:
        if sd["name"] in PLAY_SUB: continue
        for t in sd.get("traits") or []: ck("race/%s/%s·%s"%(x["name"],sd["name"],t["name"]),t.get("description"))
for x in json.load(open("data/humblewood/feats.json"))["feats"]:
    if x["name"] not in set(eh.CORE_FEATS): continue
    ck("feat/"+x["name"],x.get("description"))
ok=sum(1 for _,v,_ in rows if v)
# These four are ours, not the book's: playtest content inside core races,
# preserved deliberately (see WIRING-LEDGER).
EXPECTED_NON_VERBATIM={"race/Raptor/Mistral Raptor\u00b7Diving Strike","race/Raptor\u00b7Size & Speed",
                       "race/Mapach\u00b7Climber","race/Hedge\u00b7Burrow"}
bad=[r for r in rows if not r[1] and r[0] not in EXPECTED_NON_VERBATIM]
print("VERBATIM: %d / %d  (%d expected exceptions)" % (ok,len(rows),len(EXPECTED_NON_VERBATIM)))
if bad:
    print("\nUNEXPECTED non-verbatim (%d):" % len(bad))
    for lbl,_,pct in sorted(bad,key=lambda r:r[2]): print("   %-52s %s%%" % (lbl[:52],pct))
    print("\nFAILURES: %d" % len(bad)); sys.exit(1)
print("ALL PASSED (%d)" % ok)
