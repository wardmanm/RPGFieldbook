#!/usr/bin/env python3
"""
Humblewood PDF -> Fieldbook rules JSON (tables).

DEV-ONLY. Unlike scripts/convert.py this needs third-party libraries, so it is
NOT part of the shipped converter and does NOT go in the player bundle:

    .venv/bin/python scripts/extract-humblewood.py --dump 27
    .venv/bin/python scripts/extract-humblewood.py --tables
    .venv/bin/python scripts/extract-humblewood.py --write

Why a separate tool rather than extending convert.py: convert.py ships to
players and is stdlib-only by contract (see CLAUDE.md). PDF extraction is a
dev-time step whose *output* — reviewed JSON — is what gets committed.

Two things about these PDFs that shape everything here:

1. TWO-COLUMN LAYOUT. Reading a page as one text flow interleaves the columns
   mid-sentence, so every page is read one column at a time via clip rects.

2. THE "Th" LIGATURE IS UNMAPPED. It extracts as a bare "T", so "The" -> "Te",
   "They" -> "Tey", ~170 times. Lowercase "th" is unaffected. Fixing this by
   guessing would be dangerous ("Ten"/"Tree"/"Tank" are real words), so there is
   an explicit map plus an ALLOW list, and ANY capital-T word in neither list is
   a hard error. Silence is what lets corruption ship.
"""
import argparse
import json
import os
import re
import sys
import unicodedata

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("needs PyMuPDF — run:  .venv/bin/python -m pip install pymupdf pdfplumber\n"
             "then invoke as:       .venv/bin/python scripts/extract-humblewood.py")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, "_conversion-data/Rulebooks/HumblewoodMaster-V1.04/"
                         "HBW_5ePlus-PlayerCharacterOptions_Update-09.2024_compressed.pdf")
OUT = os.path.join(ROOT, "data/humblewood/tables.json")

# ---------------------------------------------------------------- normalisation
LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi",
             "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st"}

# Capital-T words the broken ligature produces. Every one of these is NOT an
# English word, so the substitution is unambiguous.
TH_FIX = {
    "Te": "The", "Tey": "They", "Tis": "This", "Tese": "These", "Tere": "There",
    "Teir": "Their", "Tose": "Those", "Tieves": "Thieves", "Tief": "Thief",
    "Tunder": "Thunder", "Trow": "Throw", "Tose ": "Those ",
    "Tat": "That", "Tan": "Than", "Tus": "Thus", "Tird": "Third",
    "Tick": "Thick", "Tin": "Thin", "Tink": "Think", "Torn": "Thorn",
    "Trone": "Throne", "Trill": "Thrill", "Trew": "Threw",
}
# Genuinely ambiguous: both readings are real words, so these are fixed only in
# the exact phrase they appear in. Verified against the source page by page.
TH_CONTEXT = [
    ("Trough", "Through"),          # "Through it all" — trough never appears
    ("Ten, take the number", "Then, take the number"),
    ("Tree-quarters Cover", "Three-quarters Cover"),
]
# Capital-T words that are correct as-is. Anything outside this and TH_FIX stops
# the run rather than being silently emitted.
TH_ALLOW = {
    "To", "Too", "Tool", "Tools", "Total", "Title", "Type", "Test", "Take",
    "Talons", "Tank", "Tactics", "Team", "Ten", "Terrain", "Terran", "Tiffany",
    "Tinker", "Touched", "Tough", "Trick", "Tricks", "Tree", "Trees", "Two",
    "Traveler", "Travelers", "Travels", "Trav", "Treaty", "Temporary",
    "Twilight", "Trait", "Traits", "Turrill", "Training", "Truesight",
    "Tybalt", "Typical", "Together", "Telepathic", "Tug", "Tugs", "Tail",
    "Time", "Times", "Tiny", "Tips", "Torch", "True", "Toll", "Tale",
}


# SOURCE TYPOS in the printed text. Verbatim means verbatim, but shipping a
# misspelt species name to players helps nobody, so each correction is listed
# explicitly here rather than being quietly patched at a call site. Applied
# inside normalise(), so the verbatim CHECK sees the same corrected text on
# both sides and stays meaningful.
#   p15: "Stig Lineage. There are two main lineages of Srig: ..."  -> Strig
TEXT_ERRATA = [
    ("Stig Lineage", "Strig Lineage"),
    ("lineages of Srig", "lineages of Strig"),
]


def normalise(text):
    """Ligatures out, Th ligature repaired. Order matters: phrase fixes first."""
    for a, b in TEXT_ERRATA:
        text = text.replace(a, b)
    for a, b in TH_CONTEXT:
        text = text.replace(a, b)
    for lig, rep in LIGATURES.items():
        text = text.replace(lig, rep)
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("—", "-").replace("–", "-")
    return re.sub(r"\bT[a-z]+\b", lambda m: TH_FIX.get(m.group(0), m.group(0)), text)


def join_words(words):
    """Join words and repair line-break hyphenation.

    Words are normalised individually, so a break like "Intimi-" + "dating" is
    only visible once joined. All 103 cases in this document are syllable
    breaks ("bird- folk", "them- selves", "long- bows"), so the hyphen is
    dropped rather than kept."""
    return re.sub(r"(\w)- (\w)", r"\1\2", " ".join(words))


def audit_th(text, where, problems):
    """Any capital-T word we don't recognise is a possible silent corruption."""
    for w in set(re.findall(r"\bT[a-z]{1,12}\b", text)):
        if w in TH_ALLOW or w in TH_FIX.values():
            continue
        problems.append("%s: unrecognised capital-T word %r "
                        "(add to TH_FIX if it is a broken 'Th', else TH_ALLOW)" % (where, w))


# ---------------------------------------------------------------- word layer
# These PDFs double-print some text: a stray one- or two-character block is
# emitted on top of the tail of a real word, so "seen" becomes "seenn" and
# "has" becomes "hasas". The duplicate is a SEPARATE block whose bbox sits
# inside the real word's, e.g.
#     y=344.8 x=525.2..541.6 block=10 'seen'
#     y=344.8 x=536.4..541.6 block=13 'n'      <- contained
# so it can be dropped by geometry instead of by guessing at spellings.
def page_words(page, clip=None, ytol=2.5):
    ws = page.get_text("words", clip=clip)
    ws.sort(key=lambda w: (round(w[1] / ytol), w[0]))
    keep = []
    for w in ws:
        x0, y0, x1, y1, txt = w[0], w[1], w[2], w[3], w[4]
        dup = False
        for k in keep:
            if abs(k[1] - y0) > ytol:
                continue
            # contained horizontally (with a hair of slack) => a reprint
            if x0 >= k[0] - 0.6 and x1 <= k[2] + 0.6 and len(txt) <= len(k[4]):
                dup = True
                break
        if not dup:
            keep.append((x0, y0, x1, y1, normalise(txt)))
    return keep


def group_rows(words, ytol=3.0):
    """Cluster words into visual rows.

    Chains off the PREVIOUS line, not the first line of the row: a wrapped cell
    puts its continuation above the line carrying the other columns, e.g. the
    Birdfolk languages row is three lines (84.8 "Birdfolk," / 90.8 "Birdfolk"
    "Birdfolk" / 96.8 "Humblefolk"), and measuring from 84.8 would split it."""
    rows, cur, last = [], [], None
    for w in sorted(words, key=lambda w: (w[1], w[0])):
        if last is None or abs(w[1] - last) <= ytol:
            cur.append(w)
            last = w[1]
        else:
            rows.append(sorted(cur, key=lambda w: w[0]))
            cur, last = [w], w[1]
    if cur:
        rows.append(sorted(cur, key=lambda w: w[0]))
    return rows


def split_row(row, bounds):
    """Assign each word to a column by its left edge."""
    cells = [""] * (len(bounds) + 1)
    for w in row:
        i = 0
        while i < len(bounds) and w[0] >= bounds[i]:
            i += 1
        cells[i] = (cells[i] + " " + w[4]).strip()
    return [re.sub(r"(\w)- (\w)", r"\1\2", c) for c in cells]


def column_bounds(rows, ncols):
    """Infer column split points from the gaps between word left-edges."""
    xs = sorted({round(w[0]) for r in rows for w in r})
    if len(xs) < ncols:
        return []
    gaps = sorted(((xs[i + 1] - xs[i], (xs[i] + xs[i + 1]) / 2.0)
                   for i in range(len(xs) - 1)), reverse=True)
    return sorted(m for _, m in gaps[:ncols - 1])


def merge_continuations(rows):
    """Fold wrapped lines into the row they belong to.

    A row begins where the FIRST column has a value. Everything else is a
    wrapped line — but it does not simply belong to the row above it. These
    tables vertically CENTRE the key cell against its text, so the key lands in
    the middle of its own entry:

        y= 69.0  Repentance. I've done terrible things in the past,
        y= 74.8  1                     <- the key, on its own line
        y= 80.8  and I want to try and make up for them.
        y= 95.0  Nature. I've seen what's happening to the forest,
        y=106.8  2   and it's bigger than all of us...

    Line 69 precedes its own key and line 95 precedes the NEXT key, so each
    wrapped line is assigned to the nearest key by vertical distance. The same
    rule reassembles the languages table, whose wrapped cell sits above the line
    carrying its siblings.
    """
    keys = [(y, cells) for y, cells in rows if cells[0].strip()]
    if not keys:
        return []
    buckets = [[] for _ in keys]
    for y, cells in rows:
        if cells[0].strip():
            continue
        i = min(range(len(keys)), key=lambda k: abs(keys[k][0] - y))
        buckets[i].append((y, cells))
    out = []
    for (ky, kcells), extra in zip(keys, buckets):
        row = list(kcells)
        for _y, cells in sorted(extra, key=lambda t: t[0]):
            for i, c in enumerate(cells):
                if c:
                    # keep reading order: a line above the key comes first
                    row[i] = (c + " " + row[i]).strip() if _y < ky and row[i] else \
                             (row[i] + " " + c).strip()
        out.append(row)
    return out


def table_at(page, heading, ncols, clip=None, maxrows=400, ytol=3.0,
              header_row=False, expect=None):
    """Find `heading` on the page and read the aligned rows beneath it."""
    words = page_words(page, clip=clip)
    # Locate the heading from word positions, NOT from grouped rows: row grouping
    # chains, and on a full-width page the two prose columns chain together into
    # lines the heading is merely buried inside.
    hy, hrow = None, []
    first = heading.split()[0].upper()
    for w in words:
        if w[4].upper() != first:
            continue
        near = sorted((v for v in words if abs(v[1] - w[1]) <= 3.0 and v[0] >= w[0] - 0.5),
                      key=lambda v: v[0])
        if " ".join(v[4] for v in near).upper().startswith(heading.upper()):
            hy, hrow = w[1], near
            break
    if hy is None:
        return None, None
    body = [w for w in words if w[1] > hy + 1]
    rows = group_rows(body, ytol)[:maxrows]
    if not rows:
        return None, None
    if header_row:
        # the anchor line IS the header: take column starts from its words
        starts = [w[0] for w in hrow][:ncols]
    else:
        # the header is the first parsed line below the anchor
        starts = [w[0] for w in rows[0]][:ncols] if rows else []
    if len(starts) == ncols:
        bounds = [starts[i + 1] - 2.0 for i in range(ncols - 1)]
    else:
        bounds = column_bounds(rows[:8], ncols)
    # typical line pitch, used to spot where the table stops and the page
    # furniture (footer) begins
    ys = [r[0][1] for r in rows]
    gaps = sorted(ys[i + 1] - ys[i] for i in range(len(ys) - 1)) or [12.0]
    pitch = gaps[len(gaps) // 2]
    # Stop on key COUNT, not on a line budget: each entry can wrap over several
    # lines, so "6 rows" is not "6 lines". Without `expect` we run until the
    # layout breaks.
    out, prev, keys = [], None, 0
    for r in rows:
        y = r[0][1]
        # The gap test only makes sense once every expected row is in hand.
        # Wrapped entries sit ~6pt apart while entries sit ~20pt apart, so the
        # median pitch is the INTRA-entry spacing and firing this mid-table
        # would truncate after the first entry. With `expect` known, key count
        # ends the table; the gap then just stops trailing prose attaching to
        # the final row.
        if out and prev is not None and (y - prev) > pitch * 1.6 \
                and (expect is None or keys >= expect):
            break
        cells = split_row(r, bounds)
        if not any(cells):
            continue
        if cells[0].strip():
            if expect and keys >= expect:
                break                  # the table's rows are all accounted for
            keys += 1
        out.append((y, cells))
        prev = y
    grid = merge_continuations(out)
    span = (hy, out[-1][0] if out else hy)
    return grid, span


# ---------------------------------------------------------------- page reading
def page_columns(page, n=2):
    """Read a page one column at a time. Reading it whole interleaves them."""
    r = page.rect
    if n == 1:
        return [normalise(page.get_text("text", sort=True))]
    step = r.width / n
    out = []
    for i in range(n):
        clip = fitz.Rect(r.x0 + i * step, r.y0, r.x0 + (i + 1) * step, r.y1)
        out.append(normalise(page.get_text("text", clip=clip, sort=True)))
    return out


def dump(doc, pages, cols):
    for pno in pages:
        page = doc[pno - 1]
        print("=" * 74)
        print("PAGE %d  (%.0f x %.0f)" % (pno, page.rect.width, page.rect.height))
        print("=" * 74)
        for i, col in enumerate(page_columns(page, cols)):
            if cols > 1:
                print("-- column %d " % (i + 1) + "-" * 58)
            for line in col.splitlines():
                if line.strip():
                    print("   " + line.rstrip())
        print()


# ---------------------------------------------------------------- prose layer
# Style IS structure in this document, so segmentation is not guesswork:
#
#   P22Aragon               36   entity title        (Corvum, New Feats)
#   AGaramondPro-Bold       14   section heading     (CORVUM TRAITS, BANDIT DEFECTOR)
#   AGaramondPro-Regular    14   narrative subsection (For Personal Gain)  -> SKIPPED
#   AGaramondPro-BoldItalic 10   trait run-in name   (Glide., Talons.)
#   AGaramondPro-Bold       10   stat label          (Speed:, Ability Scores:)
#   AGaramondPro-Italic     10   feat prerequisite
#   AGaramondPro-Regular    10   body text
def classify(font, size):
    sz = round(size)
    # Small-caps bold is used for the "LEVEL 3: BONUS PROFICIENCIES" feature
    # headings, and is typeset as alternating 12pt/8.4pt fragments
    # ('L' 'EVEL' '3: B' 'ONUS' ...), so it is one style regardless of size.
    if "SC700" in font:                       return "head"
    if "P22Aragon" in font and sz >= 30:      return "title"
    # the running footer ("23  Player Character Options 5e Plus") uses the
    # display face at body size, and was being collected as prose
    if "P22Aragon" in font:                   return "footer"
    if "Montserrat" in font:                  return "footer"
    if "Humblescratch" in font:               return "tagline"
    if "HumbleBullet" in font:                return "bullet"
    if "Bold" in font and "Italic" in font and sz <= 11:  return "trait"
    if "Bold" in font and sz >= 13:           return "head"
    if "Bold" in font and sz <= 11:           return "label"
    if "Italic" in font and sz <= 11:         return "prereq"
    if sz >= 13:                              return "sub"
    return "body"


def styled_spans(page, clip):
    """Spans with style, with the double-printed reprints dropped (same rule as
    page_words: a duplicate sits inside an earlier span's box)."""
    out = []
    dct = page.get_text("dict", clip=clip)
    for b in dct.get("blocks", []):
        for l in b.get("lines", []):
            for sp in l.get("spans", []):
                t = sp["text"]
                if not t.strip():
                    continue
                x0, y0, x1, y1 = sp["bbox"]
                base = sp["origin"][1]
                dup = False
                for k in out:
                    if abs(k[6] - base) > 2.5:
                        continue
                    if x0 >= k[0] - 0.6 and x1 <= k[2] + 0.6 and len(t) <= len(k[4]):
                        dup = True
                        break
                if not dup:
                    style = classify(sp["font"], sp["size"])
                    # The bare page number is set in the body face, so only its
                    # position gives it away: always in the bottom margin
                    # (y1~761 of a 783pt page). Without this it tails every
                    # entity that ends a page — and the check cannot catch it,
                    # since the reference contains it too.
                    if y1 > page.rect.height - 35:
                        style = "footer"
                    # the bullet font's glyph decodes to a bare "l"
                    txt = "\n\u2022 " if style == "bullet" else normalise(t)
                    out.append((x0, y0, x1, y1, txt, style, base))
    out.sort(key=lambda v: (round(v[6] / 2.5), v[0]))
    # Coalesce adjacent same-style fragments on one line: small-caps headings
    # arrive letter-split, and body text is frequently broken mid-sentence.
    merged = []
    for sp in out:
        if merged:
            k = merged[-1]
            if k[5] == sp[5] and abs(k[6] - sp[6]) <= 2.5 and sp[0] - k[2] < 6.0:
                merged[-1] = (k[0], k[1], sp[2], max(k[3], sp[3]),
                              k[4] + sp[4], k[5], k[6])
                continue
        merged.append(sp)
    return merged


def doc_stream(doc, pages, skip=()):
    """Style-classified spans across the document in READING order: page, then
    left column, then right column. An entity whose text runs over a column or
    page break is therefore contiguous here."""
    stream = []
    for pno in pages:
        page = doc[pno - 1]
        for side in ("L", "R"):
            for sp in styled_spans(page, side_clip(page, side)):
                base = sp[6]
                # table rows are body-styled too; drop the bands the table
                # extractor already claimed so they don't land in prose
                if any(p == pno and sd == side and lo <= base <= hi
                       for p, sd, lo, hi in skip):
                    continue
                stream.append((pno, side, base, sp[4], sp[5]))
    return stream


def flush(buf):
    """Join fragments, repair hyphenation, keep deliberate bullet breaks."""
    if not buf:
        return ""
    t = re.sub(r"(\w)- (\w)", r"\1\2", " ".join(buf))
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    return t.strip()


def parse_entity(stream, i, stop_styles=("head", "title"), stop_texts=()):
    """Read one entity starting just after its heading at index i.

    Returns (description, traits, next_index). `description` is the body before
    the first trait; narrative subsections ('sub') and everything after them up
    to the next trait/heading are dropped, per the like-for-like rule.
    """
    desc, traits = [], []
    cur_name, cur_body = None, []
    skipping = False
    j = i
    while j < len(stream):
        _p, _s, _y, text, style = stream[j]
        if style in stop_styles:
            break
        if stop_texts and text.strip() in stop_texts:
            break
        if style == "sub":
            skipping = True           # narrative section: skip until the next trait
        elif style == "trait":
            if cur_name:
                traits.append((cur_name, flush(cur_body)))
            cur_name, cur_body, skipping = text.strip().rstrip("."), [], False
        elif style == "footer":
            pass
        elif style in ("body", "label", "prereq", "bullet"):
            if skipping:
                pass
            elif cur_name:
                cur_body.append(text)
            else:
                desc.append(text)
        j += 1
    if cur_name:
        traits.append((cur_name, flush(cur_body)))
    return flush(desc), traits, j


# ---------------------------------------------------------------- entities
PAGES = dict(races=range(7, 27), subclasses=range(31, 38),
             backgrounds=range(38, 42), feats=range(42, 43))

# Playtest content lives in other PDFs; it must survive this pass untouched.
PLAYTEST_RACES = {"Greno", "Sylph", "Tilia", "Eluran", "Seeta", "Capran"}

# Match headings against the names we EXPECT rather than guessing from case or
# position. Two reasons: race titles use a drop cap that is a separate span, so
# "Luma" arrives as "uma"; and pull-quotes are styled like headings ("COUPLED
# WITH POWER" looked like a fourth background). Anything expected but not found
# becomes a loud problem instead of a silent omission.
CORE_RACES = ["Corvum", "Gallus", "Luma", "Raptor", "Strig",
              "Cervan", "Hedge", "Jerbeen", "Mapach", "Vulpin"]
CORE_BACKGROUNDS = ["Bandit Defector", "Grounded", "Wind-Touched"]
CORE_SUBCLASSES = ["College of the Road", "Community Domain", "Night Domain", "Scofflaw"]
CORE_FEATS = ["Aerial Expert", "Bandit Cunning", "Heavy Glider", "Opportunistic Thief",
              "Perfect Landing", "Speech of the Ancient Beasts", "Woodwise"]


def match_name(text, expected):
    """Resolve a heading to an expected name, tolerating a dropped first letter."""
    t = re.sub(r"[^a-z]", "", text.lower())
    if not t:
        return None
    for name in expected:
        n = re.sub(r"[^a-z]", "", name.lower())
        if t == n or (len(t) == len(n) - 1 and n.endswith(t)):
            return name
    return None

LEVEL_RE = re.compile(r"^LEVEL\s+(\d+)\s*:\s*(.+)$", re.I)

# SOURCE ERRATA. p35 carries the heading "LEVEL 3: NIGHT DOMAIN SPELLS" twice;
# the second one sits above the Ward of Shadows feature ("You can create a ward
# of divine shadows..."), which our data already names correctly. Taking the
# book literally would overwrite the real Night Domain Spells text. Keyed by
# (subclass, level, 1-based occurrence of the repeated heading).
HEAD_ERRATA = {("Night Domain", "3", 2): "Ward of Shadows"}

# Traits the source RENAMED. Without this the old and new names both survive and
# the player sees one trait twice — Huden Gallus had "One With the Land" and
# "One With the Wood" side by side, both reading "You have proficiency in the
# Nature skill." Everything else absent from the condensed doc is KEPT: it is
# playtest content this book does not cover, and dropping rules someone may be
# using is the harder mistake to undo.
RENAMED = {("Huden Gallus", "One With the Land"): "One With the Wood"}


def add_anchors(text, names):
    """Turn a named table reference into a tappable anchor IN PLACE.

    The source already writes the table's name, e.g. "...from the Bandit
    Specialty table", so the name is replaced by the anchor token and the
    sentence still reads exactly as the page does. References with no name
    ("roll on the table below") are left alone — inventing a name there would
    be editorialising, and the owner chip covers them.
    """
    for n in sorted(names, key=len, reverse=True):
        if "[Table: %s]" % n in text:
            continue
        text = re.sub(r"\b%s(?=\s+table\b)" % re.escape(n), "[Table: %s]" % n, text)
    return text


def title_case_head(t):
    """'BANDIT DEFECTOR' -> 'Bandit Defector' (our data uses title case)."""
    small = {"of", "the", "and", "a", "an", "to", "for", "in", "or"}
    out = []
    for i, w in enumerate(t.strip().split()):
        lw = w.lower()
        out.append(lw if (i and lw in small) else lw.capitalize())
    return " ".join(out)


def extract_feats(doc, skip):
    st = doc_stream(doc, PAGES["feats"], skip)
    out, i = {}, 0
    while i < len(st):
        name = match_name(st[i][3], CORE_FEATS) if st[i][4] == "head" else None
        if name:
            desc, _tr, i = parse_entity(st, i + 1)
            out[name] = desc
        else:
            i += 1
    return out


def extract_backgrounds(doc, skip):
    """A background is: flavour body, then structured labels (Ability Scores:,
    Feat:, ...) that we already hold, then narrative sections, then
    'Feature: <name>' whose body we do want."""
    st = doc_stream(doc, PAGES["backgrounds"], skip)
    out, i = {}, 0
    while i < len(st):
        name = match_name(st[i][3], CORE_BACKGROUNDS) if st[i][4] == "head" else None
        if not name:
            i += 1
            continue
        desc, feats = [], []
        feat_name, feat_buf = None, []
        in_desc = True                     # flavour runs until the first label
        i += 1
        def close_feature():
            if feat_name:
                feats.append((feat_name, flush(feat_buf)))
        while i < len(st) and st[i][4] != "head":
            _p, _s, _y, text, style = st[i]
            t = text.strip()
            if style == "label":
                in_desc = False            # structured fields start here
            elif style == "sub":
                in_desc = False
                close_feature()          # a later section must not erase it
                if t.lower().startswith("feature:"):
                    feat_name, feat_buf = t.split(":", 1)[1].strip(), []
                else:
                    feat_name, feat_buf = None, []
            elif style == "footer":
                pass
            elif style in ("body", "bullet", "trait"):
                if feat_name is not None:
                    feat_buf.append(text)
                elif in_desc:
                    desc.append(text)
            i += 1
        close_feature()
        out[name] = {"description": flush(desc),
                     "feature": feats[0] if feats else None}
    return out


def extract_subclasses(doc, skip, problems_out=None):
    problems_out = problems_out if problems_out is not None else []
    st = doc_stream(doc, PAGES["subclasses"], skip)
    known = {"College of the Road", "Community Domain", "Night Domain", "Scofflaw"}
    out, cur, i = {}, None, 0
    while i < len(st):
        _p, _s, _y, text, style = st[i]
        t = text.strip()
        if style == "sub" and t in known:
            cur = t
            desc, _tr, i = parse_entity(st, i + 1, stop_styles=("head", "title", "sub"))
            out[cur] = {"description": desc, "levels": {}}
            continue
        if style == "head" and cur:
            m = LEVEL_RE.match(t)
            if m:
                lvl, nm = m.group(1), title_case_head(m.group(2))
                body, _tr, i = parse_entity(st, i + 1, stop_styles=("head", "title", "sub"))
                bucket = out[cur]["levels"].setdefault(lvl, [])
                dup = sum(1 for n, _ in bucket if n == nm)
                if dup:
                    fixed = HEAD_ERRATA.get((cur, lvl, dup + 1))
                    if not fixed:
                        problems_out.append(
                            "%s L%s: heading %r repeats and is not in HEAD_ERRATA — "
                            "the second block would overwrite the first" % (cur, lvl, nm))
                        continue
                    nm = fixed
                bucket.append((nm, body))
                continue
            cur = None        # a class heading (BARD/CLERIC) ends the subclass
        i += 1
    return out


def extract_races(doc, skip, known_subraces=None):
    known_subraces = known_subraces or {}
    st = doc_stream(doc, PAGES["races"], skip)
    out, cur, i = {}, None, 0
    while i < len(st):
        _p, _s, _y, text, style = st[i]
        t = text.strip()
        rname = match_name(t, CORE_RACES) if style == "title" else None
        if rname:
            cur = {"name": rname, "description": "", "traits": [], "subraces": []}
            out[rname] = cur
            desc, _tr, i = parse_entity(st, i + 1, stop_styles=("head", "title"))
            cur["description"] = desc
            continue
        if style == "head" and cur:
            if t.upper().endswith("TRAITS"):
                subs = known_subraces.get(cur["name"], [])
                _d, traits, i = parse_entity(st, i + 1, stop_styles=("head", "title"),
                                             stop_texts=set(subs))
                cur["traits"] = traits
            else:
                i += 1
            continue
        if style == "sub" and cur and t in known_subraces.get(cur["name"], []):
            sd, straits, i = parse_entity(st, i + 1, stop_styles=("head", "title"),
                                          stop_texts=set(known_subraces[cur["name"]]) - {t})
            cur["subraces"].append({"name": t, "description": sd, "traits": straits})
            continue
        i += 1
    return out


# ================================================================ playtests
# The monthly playtest packets. Same house style as the condensed book, so the
# machinery above is reused wholesale; what differs is that each packet is its
# own PDF with its own front matter, and that most of this content is NEW
# rather than an update to a record we already hold.
#
# Full survey, supersessions and per-packet contents:
#   src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md
PT_DIR = os.path.join(ROOT, "_conversion-data/Rulebooks")

# `first` skips the cover/credits/Patreon advert (and, in 2025+, a recurring
# Skarthrax teaser page). Content always starts at 4 or 5.
PACKETS = [
    dict(date="2026-02", file="HWP_Playtest_February2026_Rev-1.pdf", first=5,
         races=[dict(name="Talpo", title="New Race: Talpo", traits=9,
                     lineages=["Dirtsnout", "Starsnout"],
                     lineage_traits={"Dirtsnout": 2, "Starsnout": 2})],
         subclasses=[dict(name="Workhand", cls="Fighter", head="WORKHAND",
                          features=["Bonus Proficiencies", "Ready For Anything",
                                    "Strong Arms, Light Work", "Improved Tools",
                                    "Craftsman's Shield", "The Flurry of Creation"])]),

    dict(date="2025-12", file="HWP_Playtest_Decemberr2025.pdf", first=5,
         # a lineage on the CORE Gallus; the packet reprints the shared traits
         races=[dict(name="Gallus", title="New Race: Marshfoot Gallus",
                     traits_head="MARSHFOOT GALLUS TRAITS", traits=11,
                     lineages=["Marshfoot"], lineage_traits={"Marshfoot": 3},
                     merge_into_core=True)],
         subclasses=[dict(name="College of Courtly Jests", cls="Bard",
                          head="COLLEGE OF COURTLY JESTS",
                          features=["With The In Crowd", "Subtle Jabs",
                                    "Cut To The Quick", "Deadly Jest"])]),

    dict(date="2025-10", file="HWP_Playtest_October2025_v1.pdf", first=5,
         races=[dict(name="Vesper", title="New Race: Vesper", traits=9)],
         backgrounds=[dict(name="Ambassador", title="New Background: Ambassador")]),

    dict(date="2025-09", file="HWP_Playtest_September2025.pdf", first=5,
         races=[dict(name="Rhopala", title="New Race: Rhopala", traits=9,
                     lineages=["Boldwing Rhopala", "Dustwing Rhopala"],
                     lineage_traits={"Boldwing Rhopala": 2, "Dustwing Rhopala": 2})],
         subclasses=[dict(name="The Whispering Wind", cls="Warlock",
                          head="WARLOCK PATRON: THE WHISPERING WIND",
                          features=["Expanded Spell List", "Voice of the Wind",
                                    "Nature's Force", "10th Level Feature",
                                    "14th Level Feature"],
                          # the only feature stating no level of its own; a
                          # patron's expanded list comes with the 1st-level one
                          feature_levels={"Expanded Spell List": "1"})]),

    dict(date="2025-08", file="HWP_Playtest_August2025-1.pdf", first=4,
         races=[dict(name="Roden", title="New Race: Roden", traits=9)],
         backgrounds=[dict(name="Underscout", title="New Background: Underscout")]),

    dict(date="2025-07", file="HWP_Playtest_July2025_.pdf", first=4,
         races=[dict(name="Porchini", title="New Race: Porchini", traits=9)],
         subclasses=[dict(name="Burrowskulker", cls="Rogue",
                          head="ROGUE ARCHETYPE: BURROWSKULKER",
                          features=["Narrow Maneuvers", "Wallcrawler", "Quick Nick",
                                    "Natural Camouflage", "Living Hazard"])]),

    dict(date="2025-06", file="HWP_Playtest_June2025.pdf", first=5,
         races=[dict(name="Almare", title="New Race: Almare", traits=9,
                     lineages=["Shieldwing", "Swordwing"],
                     lineage_traits={"Shieldwing": 3, "Swordwing": 3})],
         backgrounds=[dict(name="Courtier", title="New Background: Courtier")]),

    dict(date="2025-05", file="HWP_Playtest_May2025.pdf", first=5,
         races=[dict(name="Greno", title="New Race: Greno", traits=10,
                     lineages=["Venim", "Veret", "Verru"],
                     lineage_traits={"Venim": 2, "Veret": 2, "Verru": 2})]),

    dict(date="2025-04", file="HWP_Playtest_April2025.pdf", first=5,
         races=[dict(name="Arkton", title="New Race: Arkton", traits=10)]),

    dict(date="2025-03", file="HWP_Playtest_Mar2025.pdf", first=5,
         races=[dict(name="Lunin", title="New Race: Lunin", traits=9, speed=30)],
         subclasses=[dict(name="Path of the Corsair", cls="Barbarian",
                          title="Barbarian Path of the Corsair",
                          features=["Steady Rage", "Sea Legs", "Captain's Orders",
                                    "Sailor's Knacks", "Inspiring Commander"])]),

    dict(date="2025-02", file="HWP_Playtest_Feb2025.pdf", first=5,
         # third Mustel lineage; the packet reprints the shared MUSTEL TRAITS
         races=[dict(name="Mustel", title="Mustel, Webpaw", traits=6,
                     traits_head="MUSTEL TRAITS", lineages=["Webpaw Mustel"],
                     lineage_traits={"Webpaw Mustel": 8})],
         backgrounds=[dict(name="Seaborn", title="New Background: Seaborn")]),

    dict(date="2025-01", file="HWP_Playtest_Jan2025.pdf", first=4,
         # trait names are PLAIN BOLD in this packet, not bold-italic
         races=[dict(name="Pexian", title="New Race: Pexian", bold_traits=True, traits=9,
                     unbolded=["Ability Score Increases"],
                     lineages=["Cave Pexians", "Swamp Pexians"],
                     lineage_traits={
                         "Cave Pexians": ["Soft Body", "Tail and Feet",
                                          "Swamp Pexian Transformation"],
                         "Swamp Pexians": ["Big Jaws", "Swamp Camouflage", "Tail Slap",
                                           "Wet and Dry", "Cave Pexian Transformation"]})]),

    dict(date="2024-11", file="HWP_Playtest_November2024.pdf", first=5,
         # p3 reprints Seeta as a recap — `first` already excludes it
         classes=[dict(name="Gadgeteer", title="New Class: Gadgeteer",
                       paths_title="Gadgeteer Paths",
                       paths=[dict(name="Engineer", head="ENGINEER"),
                              dict(name="Fizzar", head="FIZZAR")])]),

    dict(date="2024-09", file="HWP_Playtest_September2024.pdf", first=4,
         races=[dict(name="Mustel", title="Part 1: Mustel", traits=5,
                     traits_head="MUSTEL TRAITS",
                     lineages=["Brightfang", "Longdance"],
                     lineage_traits={"Brightfang": 5, "Longdance": 5})],
         backgrounds=[dict(name="Stonesinger", head="STONESINGER"),
                      dict(name="Warrenborn", head="WARRENBORN"),
                      dict(name="Wonderstruck", head="WONDERSTRUCK")]),

    dict(date="2024-08", file="HWP_Playtest_August2024.pdf", first=7,
         subclasses=[dict(name="Way of the Wrangler", cls="Monk",
                          title="Part 2: Way of the Wrangler Monk",
                          features=["Friend of Beasts", "Monster Guider",
                                    "Monster Rider", "Leader of the Herd",
                                    "Freedom of the Plains", "Lasso Master"])],
         spells=["Spectral Stampede"]),

    dict(date="2024-07", file="HW2_Playtest_July2024.pdf", first=4,
         races=[dict(name="Capran", title="Capran", traits=9,
                     lineages=["Yantan Capran", "Tethera Capran"],
                     lineage_traits={"Yantan Capran": 3, "Tethera Capran": 3}),
                dict(name="Hedge", title="Arma Hedge", traits_head="HEDGE TRAITS", traits=8,
                     lineages=["Arma Hedge"], lineage_traits={"Arma Hedge": 5},
                     merge_into_core=True)],
         spells=["Arboreal Eruption", "Cymatic Sight", "Divert Power",
                 "Kren's Kindness", "Spectral Stampede"]),

    dict(date="2024-04", file="HW2_Playtest_April2024.pdf", first=4,
         races=[dict(name="Sylph", title="Sylph", traits=14),
                dict(name="Tilia", title="Tilia", traits=9,
                     lineages=["Treescale Tilia", "Sandscale Tilia"],
                     lineage_traits={"Treescale Tilia": 2, "Sandscale Tilia": 3}),
                dict(name="Jerbeen", title="Rockburrow Jerbeen", traits=7,
                     traits_head="JERBEEN TRAITS",
                     lineages=["Rockburrow Jerbeen"],
                     lineage_traits={"Rockburrow Jerbeen": 5},
                     merge_into_core=True)]),

    # 2024-03 (Fizzar) is DELIBERATELY ABSENT — superseded in full by 2024-11.
    # See src/docs/_claude/HUMBLEWOOD-PLAYTESTS.md §5. Do not add it back.

    dict(date="2024-02", file="HW2_Playtest_February2024.pdf", first=8,
         subclasses=[dict(name="Deep Roots", cls="Sorcerer",
                          head="DEEP ROOTS SORCERER",
                          features=["In Tune with the Land", "Grounded Magic",
                                    "Natural Battery", "Land's Harmony",
                                    "Home Turf", "Charged Up"],
                          # states no level of its own; it is the 1st-level
                          # feature, alongside Grounded Magic and Natural Battery
                          feature_levels={"In Tune with the Land": "1"})],
         feats=["Arboreal Acrobat", "Moonlit", "Sun Touched"]),

    dict(date="2024-01", file="HW2_Playtest_January2024.pdf", first=3,
         races=[dict(name="Eluran", title="Eluran", traits=12,
                     lineages=["Moon Eluran", "Sun Eluran"],
                     lineage_traits={"Moon Eluran": 2, "Sun Eluran": 2}),
                dict(name="Seeta", title="Seeta", traits=13)]),
]

# Every feature states its level in prose ("Beginning at 17th level", "when you
# choose this archetype at 3rd level"), which is the only place it appears —
# playtest subclasses have no "LEVEL n:" headings the way the core book does.
PT_LEVEL_RE = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)[- ]level\b", re.I)


def pt_level(body, where, problems):
    """Level a feature is gained at, read from its own first sentence."""
    m = PT_LEVEL_RE.search(body or "")
    if not m:
        problems.append("%s: no level stated in the feature text — cannot place it" % where)
        return None
    return m.group(1)


def _letters(s):
    return re.sub(r"[^a-z]", "", (s or "").lower())


def pt_head_match(text, expected):
    """Does this heading span begin `expected`?

    Drop caps are separate spans, so a title arrives split — "New Race: Marshfo"
    then "oot Gallus". Prefix matching reunites them without needing to know
    where the publisher put the break. The 8-char floor stops short headings
    ("Age", "Size") matching by accident.
    """
    t, e = _letters(text), _letters(expected)
    if not t or not e:
        return False
    return t == e or (len(t) >= 8 and e.startswith(t))


def dropcap_repair(spans):
    """Reattach decorative drop caps to the words they belong to.

    The condensed book has none, so the core path never needed this; every
    playtest packet opens its sections with one. A drop cap is its own span in
    the display face, so it (a) classifies as `title` and would end the entity
    being parsed, and (b) sorts by BASELINE, which for a three-line-tall letter
    is two lines below where it visually starts — landing mid-paragraph.

    Both are fixed by removing it and prepending its letter to the body span
    that starts on the same visual line, which is what the reader sees.
    """
    caps = [s for s in spans if s[5] == "title" and len(s[4].strip()) == 1
            and s[4].strip().isalpha() and (s[3] - s[1]) > 18]
    if not caps:
        return spans
    out = list(spans)
    for cap in caps:
        best, bestd = None, 1e9
        for k, s in enumerate(out):
            if s is cap or s[5] not in ("body", "label", "trait"):
                continue
            if s[0] <= cap[0]:               # must sit to the RIGHT of the cap
                continue
            d = abs(s[1] - cap[1])           # same visual line = same bbox top
            if d < bestd and d < 14:
                best, bestd = k, d
        if best is None:
            continue
        s = out[best]
        out[best] = (s[0], s[1], s[2], s[3], cap[4].strip() + s[4], s[5], s[6])
    return [s for s in out if s not in caps]


def pt_stream(doc, packet, bold_traits=False):
    """Content-page span stream for a packet, front matter excluded.

    Mirrors doc_stream()'s page-then-column reading order, but repairs drop caps
    per column first — they have to be resolved while bboxes are still in hand.

    `bold_traits` reclassifies plain-bold run-in names as traits, for the Jan
    2025 (Pexian) packet which sets them that way instead of bold-italic. It is
    opt-in because everywhere else plain bold means a stat label
    ("Female names:") that must stay out of the trait list.
    """
    st = []
    for pno in range(packet["first"], len(doc) + 1):
        page = doc[pno - 1]
        for side in ("L", "R"):
            for sp in dropcap_repair(styled_spans(page, side_clip(page, side))):
                style = sp[5]
                if bold_traits and style == "label" and \
                        re.match(r"^[A-Z][A-Za-z'’()/ -]{2,34}\.$", sp[4].strip()):
                    style = "trait"
                st.append((pno, side, sp[6], sp[4], style))
    return st


def merge_split_anchor(st, anchor):
    """Rejoin a heading the drop cap split in two.

    "New Race: Marshfoot Gallus" arrives as "New Race: Marshfo" + "oot Gallus",
    and "New Background: Ambassador" as "New Background: A" + "Ambassador" —
    the second form repeats the drop cap letter, so an exact join is not enough.
    """
    want = _letters(anchor)
    out, i = [], 0
    while i < len(st):
        p, s, y, text, style = st[i]
        t = _letters(text)
        if style == "title" and t and t != want and want.startswith(t):
            # A full-width heading is cut by the column clip, so its halves can
            # sit a whole column apart in reading order — search the rest of the
            # page, not a fixed window.
            for j in range(i + 1, len(st)):
                if st[j][0] != p or st[j][4] != "title":
                    continue
                u = _letters(st[j][3])
                if t + u == want or t + u[1:] == want or t[:-1] + u == want:
                    out.append((p, s, y, anchor, "title"))
                    st = st[:j] + st[j + 1:]
                    i += 1
                    break
            else:
                out.append(st[i]); i += 1
            continue
        out.append(st[i]); i += 1
    return out


# Cross-reference callout boxes ("see the Humblewood Campaign Setting"). They
# are set in the same bold-italic as run-in trait names, so they arrive as
# traits and land at the top of whatever list they interrupt — Jerbeen gained a
# "Humblewood Campaign Setting" trait, Mustel a "Humblewood: Beyond the Canopy".
CALLOUTS = {
    "humblewood campaign setting", "the humblewood campaign setting",
    "humblewood tales", "humblewood beyond the canopy",
    "humblewood adventure in the wood", "caprans arma hedges and spells",
}


def is_callout(name):
    return re.sub(r"[^a-z ]", "", (name or "").lower()).strip() in CALLOUTS


DIE_HDR = re.compile(r"^d\d{1,3}$", re.I)


def is_table_start(style, text):
    """A bare "d6"/"d8" label is a roll table's first column header.

    These tables are full width, so the column clip cuts every row in half and
    the halves land in the prose stream — which is how a background feature
    grew to 1750 characters ending in "...I bleed tree sap." Prose stops here.
    """
    return style == "label" and bool(DIE_HDR.match((text or "").strip()))


def first_sub_body(st, i):
    """Body of the first narrative subsection, for entities with no lead para."""
    buf, started = [], False
    while i < len(st):
        _p, _s, _y, text, style = st[i]
        if style in ("head", "title", "trait"):
            break
        if style == "sub":
            if started:
                break
            started = True
        elif started and style in ("body", "bullet"):
            buf.append(text)
        i += 1
    return flush(buf)


def pt_traits(st, i, stop_texts, expect=None, unbolded=None):
    """Collect a trait list that may be interrupted by a foreign section.

    Trait lists flow left column then right, but a *following* section's
    full-width heading is cut by the column clip and lands between them in
    reading order — Roden's traits run ASI/Speed/Age, then "Lurker's Landing",
    then Size/Bite/... So an intervening `title` suspends collection (its body
    is not ours) rather than ending it; the next trait resumes.

    `expect` is the declared trait count, and is what makes that safe: without
    it there is no principled place to stop. Same rule as the table specs —
    declare what you expect or the run can't verify itself.
    """
    # `expect` is either a count or, where a count cannot disambiguate, the
    # explicit list of trait names. Pexian needs the list: its lineage traits
    # and the Pearl Caves section's are INTERLEAVED by the column order, so
    # "the next 5 traits" picks up "Dark Times" and misses "Tail Slap".
    want_names = None
    if isinstance(expect, (list, tuple)):
        want_names = {n.lower() for n in expect}
        expect = len(expect)
    traits, name, buf, skipping = [], None, [], False
    unbolded = set(unbolded or ())
    def close():
        if name:
            traits.append((name, flush(buf)))
    while i < len(st):
        _p, _s, _y, text, style = st[i]
        t = text.strip()
        if style == "sub" and t in stop_texts:
            break
        if style == "head":
            # A heading only ENDS the list once we have everything we were told
            # to expect. Longdance's last two traits sit in the right column,
            # after the next section's heading has already appeared in the left
            # one — so an early heading suspends collection instead.
            if expect and len(traits) < expect:
                close(); name, buf, skipping = None, [], True
                i += 1
                continue
            break
        # The publisher failed to bold one run-in name (Pexian's "Ability Score
        # Increases."), so it arrives as ordinary body text. Named explicitly on
        # the spec rather than guessed, and split off here.
        if style == "body" and unbolded:
            m = re.match(r"^(%s)\.\s+(.*)$" % "|".join(re.escape(u) for u in unbolded),
                         t)
            if m:
                close()
                name, buf, skipping = m.group(1), [m.group(2)], False
                i += 1
                continue
        if style == "title" or (style == "sub" and t not in stop_texts):
            close(); name, buf, skipping = None, [], True
            i += 1
            continue
        if style == "trait":
            close()
            if expect and len(traits) >= expect:
                name = None            # stop BEFORE opening an extra trait
                break
            if is_callout(t) or (want_names and t.rstrip(".").lower() not in want_names):
                name, buf, skipping = None, [], True
                i += 1
                continue
            name, buf, skipping = t.rstrip("."), [], False
            i += 1
            continue
        if style in ("body", "bullet", "label", "prereq") and name and not skipping:
            buf.append(text)
        i += 1
    close()
    return traits, i


def pt_race(st, i, spec, problems, others=()):
    """One race: flavour description, shared traits, then each lineage.

    `others` are the headings of the packet's OTHER entities. Only those end
    this race — a bare `title` is not a reliable boundary, because a section
    heading like "Part 1: New Races" is itself split into fragments by the
    column clip and one of them ("ewaces") lands between Capran and its traits.
    """
    lineages = spec.get("lineages") or []
    traits_head = spec.get("traits_head")
    rec = {"name": spec["name"], "description": "", "traits": [], "subraces": []}
    start = i
    desc, _tr, i = parse_entity(st, i + 1, stop_styles=("head", "title"))
    if not desc:
        # Most packets open with a lead paragraph, which is the description.
        # A few (Talpo, Marshfoot Gallus) go straight into a titled narrative
        # subsection instead, so that section's body is the opening flavour.
        desc = first_sub_body(st, start + 1)
    rec["description"] = desc
    # Phase 1 — reach this race's TRAITS heading. Intervening headings are the
    # names sidebar ("Example Sylph Names"), not the end of the race, so they
    # are skipped rather than treated as a boundary.
    while i < len(st):
        _p, _s, _y, text, style = st[i]
        t = text.strip()
        if style == "title" and any(pt_head_match(t, o) for o in others):
            break
        hit = (pt_head_match(t, traits_head) if traits_head
               else t.upper().rstrip(":").endswith("TRAITS"))
        if style == "head" and hit:
            traits, i = pt_traits(st, i + 1, set(lineages), spec.get("traits"),
                                  spec.get("unbolded"))
            rec["traits"] = traits
            break
        i += 1
    # Phase 2 — the lineages, which always follow the shared traits.
    want_sub = spec.get("lineage_traits") or {}
    while i < len(st) and lineages:
        _p, _s, _y, text, style = st[i]
        t = text.strip()
        if style == "head":
            break
        if style == "sub" and t in lineages:
            j = i + 1
            lead = []                       # flavour before the first trait
            while j < len(st) and st[j][4] in ("body", "bullet"):
                lead.append(st[j][3])
                j += 1
            straits, i = pt_traits(st, j, set(lineages) - {t}, want_sub.get(t),
                                   spec.get("unbolded"))
            rec["subraces"].append({"name": t, "description": flush(lead),
                                    "traits": straits})
            continue
        i += 1
    if not rec["traits"]:
        problems.append("race %s: no traits found (traits_head=%r)"
                        % (spec["name"], traits_head))
    missing = [n for n in lineages
               if n not in {s["name"] for s in rec["subraces"]}]
    if missing:
        problems.append("race %s: lineage(s) not found: %s"
                        % (spec["name"], ", ".join(missing)))
    # Declared counts are the guard against a list that silently ran on into the
    # next section or stopped at a column break. Same rule as the table specs.
    want = spec.get("traits")
    if want is None:
        problems.append("race %s: spec declares no trait count — unverifiable"
                        % spec["name"])
    elif len(rec["traits"]) != want:
        problems.append("race %s: expected %d traits, got %d (%s)"
                        % (spec["name"], want, len(rec["traits"]),
                           ", ".join(n for n, _ in rec["traits"])))
    for sub in rec["subraces"]:
        w = (spec.get("lineage_traits") or {}).get(sub["name"])
        if w is None:
            problems.append("race %s/%s: no declared trait count"
                            % (spec["name"], sub["name"]))
            continue
        n = len(w) if isinstance(w, (list, tuple)) else w
        if len(sub["traits"]) != n:
            problems.append("race %s/%s: expected %d traits, got %d (%s)"
                            % (spec["name"], sub["name"], n, len(sub["traits"]),
                               ", ".join(x for x, _ in sub["traits"])))
    return rec, i


def pt_features(st, i, problems, where, expect=None, lvl_override=None):
    """The subclass's named features, each with the level it is gained at.

    `expect` is the declared feature list, and it is what makes the boundaries
    tractable. Neither a heading nor a title reliably ends a subclass: table
    headings ("deep roots spells") sit between features, and the section title
    itself is split by the column clip so a fragment ("ass", from "Part 2: New
    Subclass") lands in the middle. Collecting only the declared names, until
    they are all found, sidesteps both — and reports anything missing.
    """
    expect = list(expect or [])
    want = {n.lower() for n in expect}
    lvl_override = lvl_override or {}
    feats, name, buf, skipping = [], None, [], False
    def close():
        if name:
            body = flush(buf)
            lvl = lvl_override.get(name) or pt_level(body, "%s · %s" % (where, name),
                                                     problems)
            feats.append((name, body, lvl))
    while i < len(st):
        _p, _s, _y, text, style = st[i]
        if expect and len({n for n, _, _ in feats}) >= len(expect) and name is None:
            break
        if not expect and style == "title":
            break
        if style == "head" or is_table_start(style, text):
            close(); name, buf, skipping = None, [], True
            i += 1
            continue
        if style == "sub":
            close()
            t = text.strip()
            if want and t.lower() not in want:
                name, buf, skipping = None, [], True   # narrative, not a feature
                i += 1
                continue
            name, buf, skipping = t, [], False
        elif style in ("body", "bullet", "label", "prereq", "trait"):
            if name and not skipping:
                buf.append(text)
        i += 1
    close()
    return feats, i


def pt_subclass(st, i, spec, problems):
    """A subclass: flavour body, then its levelled features."""
    where = "subclass/" + spec["name"]
    desc, _tr, j = parse_entity(st, i + 1, stop_styles=("title", "sub", "head"))
    feats, j = pt_features(st, j, problems, where, spec.get("features"),
                           spec.get("feature_levels"))
    levels = {}
    for nm, body, lvl in feats:
        if lvl:
            levels.setdefault(lvl, []).append((nm, body))
    if not levels:
        problems.append("%s: no levelled features found" % where)
    want = spec.get("features")
    if not want:
        problems.append("%s: spec declares no feature list — unverifiable" % where)
    else:
        got = {n.lower() for n, _, _ in feats}
        missing = [n for n in want if n.lower() not in got]
        if missing:
            problems.append("%s: feature(s) not found: %s" % (where, ", ".join(missing)))
    return {"class": spec["cls"], "name": spec["name"],
            "description": desc, "levels": levels}, j


def pt_background(st, i, spec, problems):
    """Flavour, then the 'Feature: <name>' block. Structured fields stay ours."""
    desc, feat_name, feat_buf = [], None, []
    in_desc, in_table = True, False
    i += 1
    while i < len(st):
        _p, _s, _y, text, style = st[i]
        t = text.strip()
        if style in ("title",) or (style == "head" and not in_desc):
            break
        # A characteristic table SUSPENDS collection rather than ending it. It
        # is full width, so its shredded rows sit between the left column and
        # the right one — and for Ambassador, Underscout and Courtier the
        # "Feature:" block is in that right column, on the far side of them.
        if is_table_start(style, t):
            in_table = True
            i += 1
            continue
        if style == "sub":
            in_desc = False
            if t.lower().startswith(("feature:", "background feature:")):
                in_table = False
                feat_name, feat_buf = t.split(":", 1)[1].strip(), []
            elif feat_name:
                break                       # a later section must not extend it
        elif style == "label":
            in_desc = False
        elif style in ("body", "bullet", "trait", "prereq") and not in_table:
            if feat_name is not None:
                feat_buf.append(text)
            elif in_desc:
                desc.append(text)
        i += 1
    if not feat_name:
        problems.append("background %s: no 'Feature:' block found" % spec["name"])
    return {"name": spec["name"], "description": flush(desc),
            "feature": (feat_name, flush(feat_buf)) if feat_name else None}, i


def pt_reference(doc, packet):
    """The packet's prose as the extractor reads it, for the verbatim check.

    Built the same way the extraction is — column-aware, drop caps repaired,
    page furniture dropped — because a reference assembled any other way makes
    correct extractions look wrong. That mistake has already been made twice on
    this project; see the ledger.
    """
    parts = []
    for pno in range(packet["first"], len(doc) + 1):
        page = doc[pno - 1]
        for side in ("L", "R"):
            for sp in dropcap_repair(styled_spans(page, side_clip(page, side))):
                if sp[5] in ("footer", "tagline"):
                    continue
                parts.append(sp[4])
    t = re.sub(r"\s+", " ", " ".join(parts))
    return re.sub(r"(\w)- (\w)", r"\1\2", t)


def vb_norm(s):
    s = re.sub(r"\[Table: ([^\]]+)\]", r"\1", s or "")
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s)).strip().lower()


def pt_verbatim(rec_fields, ref):
    """(verbatim, total, failures) over prose long enough to be meaningful."""
    ok = tot = 0
    bad = []
    for label, text in rec_fields:
        n = vb_norm(text)
        if len(n) < 25:
            continue
        tot += 1
        if n in ref:
            ok += 1
        else:
            bad.append((label, len(n)))
    return ok, tot, bad


def pt_fields(got):
    """Every (label, prose) pair one packet's extraction produced."""
    out = []
    for r in got["races"]:
        out.append(("race %s desc" % r["name"], r["description"]))
        out += [("race %s · %s" % (r["name"], n), b) for n, b in r["traits"]]
        for s in r["subraces"]:
            out.append(("lineage %s desc" % s["name"], s["description"]))
            out += [("lineage %s · %s" % (s["name"], n), b) for n, b in s["traits"]]
    for s in got["subclasses"]:
        out.append(("subclass %s desc" % s["name"], s["description"]))
        out += [("subclass %s · %s" % (s["name"], n), b)
                for lv in s["levels"].values() for n, b in lv]
    for b in got["backgrounds"]:
        out.append(("bg %s desc" % b["name"], b["description"]))
        if b["feature"]:
            out.append(("bg %s · %s" % (b["name"], b["feature"][0]), b["feature"][1]))
    return out


def pt_named_blocks(st, wanted, style_want, problems, where):
    """Blocks introduced by a heading whose text is one of `wanted`.

    Covers the two simple shapes: the packet spells (Jul/Aug 2024), whose names
    are set as ALL-CAPS headings, and the feats (Feb 2024), whose names are
    ordinary subsection headings.
    """
    want = {_letters(n): n for n in wanted}
    out, name, buf = {}, None, []
    def close():
        if name:
            out[name] = flush(buf)
    for _p, _s, _y, text, style in st:
        t = text.strip()
        if style == style_want and _letters(t) in want:
            close()
            name, buf = want[_letters(t)], []
            continue
        if style in ("head", "title", "sub") and name:
            close()
            name, buf = None, []
            continue
        if name and style in ("body", "bullet", "trait", "label", "prereq"):
            buf.append(text)
    close()
    missing = [n for n in wanted if n not in out]
    if missing:
        problems.append("%s: not found: %s" % (where, ", ".join(missing)))
    return out


def pt_all_subs(st):
    """Every subsection block in a packet, as name -> body.

    Used for the Gadgeteer, whose 27 class features and 12 path features are all
    ordinary subsections. Their LEVELS are already correct in our data (and the
    class progression table, not the prose, is what assigns them), so this only
    needs to supply the words — matched by name.
    """
    out, name, buf = {}, None, []
    def close():
        if name and name not in out:
            out[name] = flush(buf)
    for _p, _s, _y, text, style in st:
        t = text.strip()
        if style == "sub":
            close()
            name, buf = t, []
            continue
        if style in ("title",) or is_table_start(style, t):
            close(); name, buf = None, []
            continue
        # Headings INSIDE a section are part of it — "Frames" runs through
        # Autonomous / Handheld / Wearable Frame, and dropping those three words
        # leaves the text non-contiguous with the page.
        if name and style in ("body", "bullet", "trait", "label", "prereq", "head"):
            buf.append(text)
    close()
    return out


# The source pluralises one feature our data holds in the singular.
CLASS_ALIAS = {"sufficiently advanced technology": "Sufficiently Advanced Technologies"}


def pt_extract(packet, problems):
    """Everything one packet contributes, keyed by kind."""
    path = os.path.join(PT_DIR, packet["file"])
    if not os.path.exists(path):
        problems.append("missing PDF: %s" % packet["file"])
        return {}
    doc = fitz.open(path)
    got = {"races": [], "subclasses": [], "backgrounds": [], "classes": [],
           "spells": {}, "feats": {}}
    if packet.get("spells"):
        got["spells"] = pt_named_blocks(pt_stream(doc, packet), packet["spells"],
                                        "head", problems,
                                        "%s spells" % packet["date"])
    if packet.get("feats"):
        got["feats"] = pt_named_blocks(pt_stream(doc, packet), packet["feats"],
                                       "sub", problems,
                                       "%s feats" % packet["date"])
    if packet.get("classes"):
        st = pt_stream(doc, packet)
        got["blocks"] = pt_all_subs(st)
        for spec in packet["classes"]:
            anchor = spec["title"]
            s2 = merge_split_anchor(st, anchor)
            k = next((n for n, x in enumerate(s2)
                      if x[4] == "title" and pt_head_match(x[3], anchor)), None)
            if k is None:
                problems.append("class %s: heading %r not found" % (spec["name"], anchor))
                continue
            desc, _tr, _j = parse_entity(s2, k + 1, stop_styles=("head", "title", "sub"))
            got["classes"].append({"name": spec["name"], "description": desc,
                                   "_spec": spec})
    for kind in ("races", "subclasses", "backgrounds", "classes"):
        for spec in packet.get(kind) or []:
            bold = bool(spec.get("bold_traits"))
            anchor = spec.get("title") or spec.get("head")
            st = merge_split_anchor(pt_stream(doc, packet, bold), anchor)
            want_style = "title" if spec.get("title") else "head"
            i, found = 0, False
            while i < len(st):
                _p, _s, _y, text, style = st[i]
                if style == want_style and pt_head_match(text, anchor):
                    found = True
                    if kind == "races":
                        others = [(s.get("title") or s.get("head"))
                                  for k2 in ("races", "subclasses", "backgrounds", "classes")
                                  for s in (packet.get(k2) or []) if s is not spec]
                        rec, i = pt_race(st, i, spec, problems, others)
                    elif kind == "subclasses":
                        rec, i = pt_subclass(st, i, spec, problems)
                    elif kind == "backgrounds":
                        rec, i = pt_background(st, i, spec, problems)
                    else:
                        break
                    rec["_spec"] = spec
                    got[kind].append(rec)
                    break
                i += 1
            if not found and kind != "classes":
                problems.append("%s %s: heading %r (%s) not found in %s"
                                % (kind[:-1], spec["name"], anchor, want_style, packet["file"]))
    doc.close()
    return got


# ------------------------------------------------------- playtest -> our JSON
# Stat-block rows that our schema holds as FIELDS, not traits — the same split
# the existing records use (Greno keeps Size as a trait but carries speed,
# languages and abilityChoice as fields). Everything not listed here is a trait.
STAT_ROWS = {"ability score increase", "ability score increases", "creature type",
             "age", "alignment", "speed", "languages", "ancestry options",
             "lineage options"}


def stat_row(traits, *names):
    for n, body in traits:
        if n.strip().lower() in names:
            return body
    return None


def derive_speed(got, spec, where, problems):
    """Walking speed, from the race's Speed row or — failing that — a lineage's.

    Mustel states speed per lineage and Lunin states none at all, so a missing
    row is normal rather than an error; what is not acceptable is guessing, so
    the spec has to declare the fallback.
    """
    for traits in [got["traits"]] + [s["traits"] for s in got["subraces"]]:
        body = stat_row(traits, "speed") or ""
        m = re.search(r"walking speed is (\d+)", body, re.I)
        if m:
            return int(m.group(1))
    if spec.get("speed"):
        return spec["speed"]
    problems.append("%s: no walking speed stated anywhere; declare speed= on the spec"
                    % where)
    return None


def derive_languages(traits, where, problems):
    """The Languages row as our short "Birdfolk, Porchini" form.

    Deliberately conservative: anything that is not the plain "speak, read, and
    write X and Y" shape is reported rather than guessed at, because a wrong
    language list is invisible in play until someone tries to use it.
    """
    body = (stat_row(traits, "languages") or "").strip()
    # Talpo runs "Lineage Options." straight on from the Languages row
    body = re.split(r"\b(?:Lineage|Ancestry) Options\.", body)[0]
    m = re.search(r"speak,?\s*read,?\s*and write\s+(.+?)(?:\.|$)", body, re.I)
    if not m:
        problems.append("%s: unparsed Languages row %r" % (where, body[:80]))
        return None
    frag = m.group(1)
    if re.search(r"\bchoice\b|\bunderstand\b|\bplus\b|\bcan\b|language of", frag, re.I):
        return frag[0].upper() + frag[1:]          # keep the qualifier verbatim
    parts = [p.strip() for p in re.split(r",| and ", frag) if p.strip()]
    return ", ".join(p[0].upper() + p[1:] for p in parts)


def derive_ability_choice(traits, where, problems):
    """The 2024-style ability choice, plus the source's own 'typical' hint."""
    body = stat_row(traits, "ability score increase", "ability score increases") or ""
    modes = []
    if re.search(r"by 2,? and another", body, re.I):
        modes.append("2-1")
    if re.search(r"three (?:different )?ability scores?(?: of your choice)? "
                 r"(?:each )?(?:increases?|by) ?1", body, re.I) or \
            re.search(r"Alternatively.*three", body, re.I | re.S):
        modes.append("1-1-1")
    if not modes:
        problems.append("%s: unparsed ability-score row %r" % (where, body[:80]))
        return None
    out = {"modes": modes}
    hints = re.findall(r"To play a typical\s+(.*?),?\s*choose\s+(.+?)\.", body, re.I)
    if hints:
        out["hint"] = "; ".join("%s: %s" % (w.strip() or "typical", a.strip())
                                for w, a in hints)
    return out


def split_traits(traits):
    """(keepable traits, stat rows) — stat rows become fields, not traits."""
    keep = [(n, b) for n, b in traits if n.strip().lower() not in STAT_ROWS]
    return keep


def as_traits(pairs, names):
    return [{"name": n, "description": add_anchors(b, names)} for n, b in pairs]


def pt_new_race(got, spec, names, problems):
    """Build a brand-new race record, deriving the mechanical fields."""
    where = "race/" + got["name"]
    rec = {"name": got["name"]}
    desc = got["description"]
    rec["category"] = "Birdfolk" if re.search(r"\bbirdfolk\b", desc, re.I) else got["name"]
    sp = derive_speed(got, spec, where, problems)
    if sp:
        rec["speed"] = sp
    lg = derive_languages(got["traits"], where, problems)
    if lg:
        rec["languages"] = lg
    rec["description"] = add_anchors(desc, names)
    rec["traits"] = as_traits(split_traits(got["traits"]), names)
    if got["subraces"]:
        rec["subraces"] = [{"name": s["name"],
                            "description": add_anchors(s["description"], names),
                            "traits": as_traits(split_traits(s["traits"]), names)}
                           for s in got["subraces"]]
    ac = derive_ability_choice(got["traits"], where, problems)
    if ac:
        rec["abilityChoice"] = ac
    return rec


# SOURCE DEFECTS in Vol 2, handled like TEXT_ERRATA rather than at a call site.
#   the spell is "Ethereal Claws" everywhere else, including its own index entry
VOL2_RENAME = {"Etheral Claws": "Ethereal Claws"}
#   a table column header inside Wrath of Roots, set in the same bold as a name
VOL2_NOISE = {"d4 Effect"}

INVENTED_ATTR = re.compile(r"\s*\(Humblewood(?: \d)? Playtest\.?\)\s*$")

SPELLS_VOL2 = os.path.join(PT_DIR, "Humblewood Spells Vol 2.pdf")
# The class-list index; descriptions start after it.
VOL2_FIRST_PAGE = 5


def vol2_lines(doc):
    """(text, all_bold, all_italic) per line — Vol 2 is single column."""
    out = []
    for pno in range(VOL2_FIRST_PAGE, len(doc) + 1):
        for b in doc[pno - 1].get_text("dict").get("blocks", []):
            for l in b.get("lines", []):
                sp = [s for s in l.get("spans", []) if s["text"].strip()]
                if not sp:
                    continue
                txt = normalise("".join(s["text"] for s in sp)).strip()
                if not txt or txt == "•":
                    continue
                fonts = [s["font"] for s in sp]
                out.append((txt,
                            all("Bold" in f for f in fonts),
                            all("Italic" in f and "Bold" not in f for f in fonts)))
    return out


VOL2_LEVEL = re.compile(
    r"^(?:(\d+)(?:st|nd|rd|th)-level\s+(\w+)|(\w+)\s+cantrip)\s*(\(ritual\))?\s*$", re.I)


def extract_vol2_spells(problems):
    """Spell name -> {level, school, meta, text} from Humblewood Spells Vol 2.

    A different template from every other Humblewood PDF (Times New Roman, one
    column), so it gets its own reader rather than the shared style classifier —
    which sees its 12pt bold headings as ordinary body text.

    A line set ENTIRELY in bold is a spell name; a run-in like "Cut. You can
    make a surgical cut..." mixes bold with regular on the same line and is
    body. That distinction is the whole parser.
    """
    if not os.path.exists(SPELLS_VOL2):
        problems.append("missing PDF: Humblewood Spells Vol 2.pdf")
        return {}
    doc = fitz.open(SPELLS_VOL2)
    lines = vol2_lines(doc)
    doc.close()
    out, cur = {}, None
    for txt, bold, ital in lines:
        m = VOL2_LEVEL.match(txt)
        if m and cur:
            lvl = int(m.group(1)) if m.group(1) else 0
            cur["level"] = lvl
            cur["school"] = (m.group(2) or m.group(3) or "").capitalize()
            cur["ritual"] = bool(m.group(4))
            continue
        if bold and not ital and len(txt) < 52 and ":" not in txt \
                and not txt[0].isdigit():
            cur = {"level": None, "school": "", "ritual": False,
                   "stats": {}, "body": []}
            out[txt] = cur
            continue
        if cur is None:
            continue
        m = re.match(r"^(Casting Time|Range|Components|Duration):\s*(.*)$", txt)
        if m:
            cur["stats"][m.group(1)] = m.group(2).strip()
            cur["_last"] = m.group(1)
            continue
        if cur["body"]:
            cur["body"].append(txt)
        elif cur["stats"] and cur.get("_last"):
            # a stat value wrapped onto the next line (long Components lists)
            if txt.endswith(")") and not txt.endswith("."):
                cur["stats"][cur["_last"]] += " " + txt
                continue
            cur["body"].append(txt)
        else:
            cur["body"].append(txt)
    recs = {}
    for name, c in out.items():
        if name in VOL2_NOISE:
            continue
        if c["level"] is None:
            problems.append("Vol 2 spell %r: no level/school line" % name)
            continue
        name = VOL2_RENAME.get(name, name)
        ct = c["stats"].get("Casting Time", "")
        if c["ritual"] and ct:
            ct += " (Ritual)"
        meta = " · ".join(x for x in (c["school"], ct, c["stats"].get("Range", ""),
                                           c["stats"].get("Components", ""),
                                           c["stats"].get("Duration", "")) if x)
        recs[name] = {"level": c["level"], "meta": meta,
                      "text": join_words(c["body"])}
    return recs


def pt_write(problems):
    """Fold every packet's content into data/humblewood/*.json.

    Prose is replaced wholesale (the source owns the words); mechanics we author
    — abilityScores, skills, effects, equipment, choices — are never touched.
    New entities are created; existing ones are updated in place.
    """
    tab_doc = load("data/humblewood/tables.json")
    names = [t["name"] for t in tab_doc["tables"]]
    log = []
    # PACKETS runs newest first, and two packets can describe the same entity —
    # Sep 2024 and Feb 2025 both print the shared MUSTEL TRAITS block. First
    # writer wins, so the newest printing of a shared trait is the one kept.
    claimed = set()

    def fresh(where):
        if where in claimed:
            return False
        claimed.add(where)
        return True

    def take(rec, key, new, where):
        if fresh(where + "." + key):
            set_prose(rec, key, new, log, where, names)

    def take_traits(existing, found, where, owner=None):
        new = [(n, b) for n, b in found if fresh("%s · %s" % (where, n))]
        merge_traits(existing, new, log, where, names, owner)

    races_doc = load("data/humblewood/races.json")
    by_race = {r["name"]: r for r in races_doc["races"]}
    sc_doc = load("data/humblewood/subclasses.json")
    by_sc = {s["name"]: s for s in sc_doc["subclasses"]}
    bg_doc = load("data/humblewood/backgrounds.json")
    by_bg = {b["name"]: b for b in bg_doc["backgrounds"]}

    for pk in PACKETS:
        got = pt_extract(pk, problems)
        for r in got["races"]:
            spec = r["_spec"]
            cur = by_race.get(r["name"])
            core = spec.get("merge_into_core")
            if cur is None:
                rec = pt_new_race(r, spec, names, problems)
                races_doc["races"].append(rec)
                by_race[r["name"]] = rec
                log.append(("CREATED", "race/" + r["name"]))
            elif not core:
                w = "race/" + r["name"]
                take(cur, "description", r["description"], w)
                take_traits(cur.setdefault("traits", []), split_traits(r["traits"]), w)
            # merge_into_core: the packet reprints the CORE species' shared
            # traits, which are already verbatim from the book. Overwriting them
            # with a reprint would trade good text for a duplicate, so only the
            # new lineage is taken.
            for s in r["subraces"]:
                subs = cur.setdefault("subraces", []) if cur is not None else \
                    by_race[r["name"]].setdefault("subraces", [])
                tgt = next((x for x in subs if x["name"] == s["name"]), None)
                w = "race/%s/%s" % (r["name"], s["name"])
                if tgt is None:
                    subs.append({"name": s["name"],
                                 "description": add_anchors(s["description"], names),
                                 "traits": as_traits(split_traits(s["traits"]), names)})
                    log.append(("CREATED", w))
                else:
                    take(tgt, "description", s["description"], w)
                    take_traits(tgt.setdefault("traits", []),
                                split_traits(s["traits"]), w, s["name"])

        for s in got["subclasses"]:
            cur = by_sc.get(s["name"])
            w = "subclass/" + s["name"]
            if cur is None:
                cur = {"class": s["class"], "name": s["name"],
                       "description": add_anchors(s["description"], names),
                       "levels": {}}
                sc_doc["subclasses"].append(cur)
                by_sc[s["name"]] = cur
                log.append(("CREATED", w))
            else:
                take(cur, "description", s["description"], w)
            for lvl, feats in s["levels"].items():
                blk = cur.setdefault("levels", {}).setdefault(lvl, {})
                take_traits(blk.setdefault("traits", []), feats, "%s L%s" % (w, lvl))

        for b in got["backgrounds"]:
            cur = by_bg.get(b["name"])
            w = "bg/" + b["name"]
            if cur is None:
                cur = {"name": b["name"],
                       "description": add_anchors(b["description"], names)}
                if b["feature"]:
                    cur["feature"] = {"name": b["feature"][0],
                                      "description": add_anchors(b["feature"][1], names)}
                bg_doc["backgrounds"].append(cur)
                by_bg[b["name"]] = cur
                log.append(("CREATED", w))
                continue
            take(cur, "description", b["description"], w)
            if b["feature"]:
                f = cur.setdefault("feature", {"name": b["feature"][0]})
                take(f, "description", b["feature"][1], "%s · %s" % (w, f.get("name")))

    # Classes: prose only. Levels, hit die, saving throws and the Scrap resource
    # are ours and stay untouched; the source supplies the wording, matched by
    # feature name.
    cls_doc = load("data/humblewood/classes.json")
    for pk in PACKETS:
        if not pk.get("classes"):
            continue
        got = pt_extract(pk, problems)
        blocks = got.get("blocks") or {}
        by_norm = {_letters(k): v for k, v in blocks.items()}
        def block_for(nm):
            alias = CLASS_ALIAS.get(nm.strip().lower(), nm)
            return by_norm.get(_letters(alias))
        for c in got["classes"]:
            rec = next((x for x in cls_doc["classes"] if x["name"] == c["name"]), None)
            if rec is None:
                problems.append("class %s: not in classes.json" % c["name"])
                continue
            take(rec, "description", c["description"], "class/" + c["name"])
            targets = [(rec, "class/" + c["name"])]
            for pth in c["_spec"].get("paths") or []:
                sub = next((x for x in cls_doc.get("subclasses", [])
                            if x["name"] == pth["name"]), None)
                if sub is None:
                    problems.append("path %s: not in classes.json" % pth["name"])
                    continue
                targets.append((sub, "path/" + pth["name"]))
            for tgt, w in targets:
                for lvl, blk in (tgt.get("levels") or {}).items():
                    for t in blk.get("traits", []):
                        body = block_for(t.get("name", ""))
                        if body is None:
                            problems.append("%s L%s · %s: no source block"
                                            % (w, lvl, t.get("name")))
                            continue
                        take(t, "description", body, "%s L%s · %s" % (w, lvl, t["name"]))

    # Feats and packet spells: prose only, everything else already ours.
    ft_doc = load("data/humblewood/feats.json")
    sp_doc = load("data/humblewood/spells.json")
    by_sp = {s["name"]: s for s in sp_doc["spells"]}
    for pk in PACKETS:
        got = pt_extract(pk, problems)
        for nm, body in (got.get("feats") or {}).items():
            rec = next((f for f in ft_doc["feats"] if f["name"] == nm), None)
            if rec is None:
                problems.append("feat %s: not in feats.json" % nm)
                continue
            take(rec, "description", body, "feat/" + nm)
        for nm, body in (got.get("spells") or {}).items():
            rec = by_sp.get(nm)
            if rec is None:
                problems.append("spell %s: not in spells.json" % nm)
                continue
            take(rec, "text", body, "spell/" + nm)

    # Spells Vol 2 — its own reader; replaces prose only, never level/class.
    for nm, got_sp in extract_vol2_spells(problems).items():
        rec = by_sp.get(nm)
        if rec is None:
            problems.append("Vol 2 spell %s: not in spells.json" % nm)
            continue
        take(rec, "text", got_sp["text"], "spell/" + nm)

    unsourced = [s["name"] for s in sp_doc["spells"]
                 if "spell/" + s["name"] + ".text" not in claimed]
    if unsourced:
        problems.append("no source available for %d spell(s), left as-is: %s"
                        % (len(unsourced), ", ".join(sorted(unsourced))))

    # A previous pass appended "(Humblewood 2 Playtest.)" to ten descriptions.
    # It is a source attribution someone typed, not text from any packet, and it
    # renders to players as a stray parenthetical. Most are gone simply by being
    # replaced; this clears any the source gives us no text to replace (the Arma
    # Hedge lineage block is traits only, with no flavour of its own).
    stripped = [0]

    def unattribute(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ("description", "text") and isinstance(v, str):
                    new = INVENTED_ATTR.sub("", v).rstrip()
                    if new != v:
                        node[k] = new
                        stripped[0] += 1
                else:
                    unattribute(v)
        elif isinstance(node, list):
            for v in node:
                unattribute(v)

    for d in (races_doc, sc_doc, bg_doc, ft_doc, sp_doc, cls_doc):
        unattribute(d)
    if stripped[0]:
        log.append(("attribution stripped", "%d field(s)" % stripped[0]))

    save("data/humblewood/races.json", races_doc)
    save("data/humblewood/subclasses.json", sc_doc)
    save("data/humblewood/backgrounds.json", bg_doc)
    save("data/humblewood/feats.json", ft_doc)
    save("data/humblewood/spells.json", sp_doc)
    save("data/humblewood/classes.json", cls_doc)
    return log


# ---------------------------------------------------------------- table specs
# Explicit, not auto-detected. Heuristic table-finding on a two-column RPG PDF
# produces confident nonsense (extract_tables() finds 0 with ruled lines and 38
# false positives with text mode). Each entry names the page, the heading to
# anchor on, how many columns to expect, and which half of the page to read.
# L/R/F = left column, right column, full width.
SPECS = [
    dict(name="Random Height and Weight", page=27, heading="RANDOM HEIGHT", cols=5, side="F",
         owner="Random Height and Weight", kind="rule", rows=11),
    dict(name="Standard Languages", page=29, heading="STANDARD LANGUAGES", cols=3, side="R",
         owner="Languages of the Wood", kind="rule", rows=6),

    # Subclass progressions. The anchor here IS the column-header row, so the
    # header is given explicitly and every parsed row is data. Two tables on p34
    # both begin "Cleric Level", hence anchoring on the full header text.
    dict(name="Community Domain Spells", page=34, heading="Cleric Level Spells", cols=2, side="L",
         header=["Cleric Level", "Spells"], owner="Community Domain", kind="subclass", rows=4),
    dict(name="Night Domain Spells", page=35, heading="Cleric Level Spells", cols=2, side="R",
         header=["Cleric Level", "Spells"], owner="Night Domain", kind="subclass", rows=4),
]

# Background characteristic tables. Three backgrounds each have a "Personality
# Trait"/"Ideal"/"Bond"/"Flaw", and the table NAME is the app's merge key, so
# every one is prefixed with its background. Ownership was verified by reading
# order against the BANDIT DEFECTOR / GROUNDED / WIND-TOUCHED headings rather
# than assumed from page numbers.
_BG = [
    ("Bandit Defector", [("Bandit Specialty", 38, "L", "d6", 6),
                         ("Personality Trait", 38, "R", "d8", 8),
                         ("Ideal",             39, "L", "d6", 6),
                         ("Bond",              39, "L", "d6", 6),
                         ("Flaw",              39, "L", "d6", 6)]),
    ("Grounded",        [("Community Place",   39, "R", "d6", 6),
                         ("Personality Trait", 40, "L", "d8", 8),
                         ("Ideal",             40, "L", "d6", 6),
                         ("Bond",              40, "L", "d6", 6),
                         ("Flaw",              40, "R", "d6", 6)]),
    ("Wind-Touched",    [("Acceptance",        40, "R", "d6", 6),
                         ("Personality Trait", 41, "L", "d8", 8),
                         ("Ideal",             41, "L", "d6", 6),
                         ("Bond",              41, "R", "d6", 6),
                         ("Flaw",              41, "R", "d6", 6)]),
]
for _bg, _tables in _BG:
    for _label, _pg, _side, _die, _n in _tables:
        # tables whose label already names the thing don't get the prefix twice
        _name = _label if _label in ("Bandit Specialty", "Community Place", "Acceptance") \
                else "%s %s" % (_bg, _label)
        SPECS.append(dict(name=_name, page=_pg, heading="%s %s" % (_die, _label),
                          cols=2, side=_side, header=[_die, _label],
                          owner=_bg, kind="background", rows=_n))


def side_clip(page, side):
    r = page.rect
    if side == "L":
        return fitz.Rect(r.x0, r.y0, r.x0 + r.width / 2, r.y1)
    if side == "R":
        return fitz.Rect(r.x0 + r.width / 2, r.y0, r.x1, r.y1)
    return None


def build_tables(doc, problems):
    out = []
    missing = [sp["name"] for sp in SPECS if not sp.get("rows")]
    if missing:
        problems.append("specs with no declared row count (unverifiable): %s" % ", ".join(missing))
        return out
    for sp in SPECS:
        page = doc[sp["page"] - 1]
        grid, span = table_at(page, sp["heading"], sp["cols"],
                        clip=side_clip(page, sp["side"]),
                        header_row=bool(sp.get("header")),
                        # when the header is the first parsed row it counts
                        # as a key, so allow one extra
                        expect=(sp["rows"] + (0 if sp.get("header") else 1))
                               if sp.get("rows") else None)
        region = (sp["page"], sp["side"], span[0] - 4, span[1] + 10) if span else None
        if grid is None:
            problems.append("%s: heading %r not found on p%d" % (sp["name"], sp["heading"], sp["page"]))
            continue
        if not grid:
            problems.append("%s: heading found on p%d but no rows parsed" % (sp["name"], sp["page"]))
            continue
        if sp.get("header"):
            header, body = sp["header"], grid      # anchor was the header row
        else:
            header, body = grid[0], grid[1:]
        want = sp.get("rows")
        if want and len(body) != want:
            problems.append("%s: expected %d rows, got %d" % (sp["name"], want, len(body)))
        for cells in grid:
            audit_th(" ".join(cells), sp["name"], problems)
        t = dict(name=sp["name"], cols=header, align=["left"] * len(header),
                 rows=body, owner=sp["owner"], ownerKind=sp["kind"],
                 source="Humblewood")
        t["_region"] = region
        out.append(t)
    return out


CHARACTERISTICS = ("Personality Trait", "Ideal", "Bond", "Flaw")

# Which backgrounds each packet carries, in the order they appear. Only Sep 2024
# has more than one, and that is the packet that makes the ordering matter.
PT_BG_TABLES = [
    ("HWP_Playtest_October2025_v1.pdf", ["Ambassador"]),
    ("HWP_Playtest_August2025-1.pdf", ["Underscout"]),
    ("HWP_Playtest_June2025.pdf", ["Courtier"]),
    ("HWP_Playtest_Feb2025.pdf", ["Seaborn"]),
    ("HWP_Playtest_September2024.pdf", ["Stonesinger", "Warrenborn", "Wonderstruck"]),
]


def find_die_headers(doc):
    """Every "d6 <Characteristic>" table header, in reading order.

    Returns (page, y, die, label). Scanned full width, because unlike the core
    book's column tables these are full-page and a column clip cuts every row
    in half.
    """
    out = []
    for pno in range(1, len(doc) + 1):
        sps = styled_spans(doc[pno - 1], None)
        for k, sp in enumerate(sps):
            t = sp[4].strip()
            if sp[5] != "label" or not DIE_HDR.match(t):
                continue
            nxt = [x[4].strip() for x in sps[k + 1:k + 3] if x[4].strip()]
            lab = next((x for x in nxt if x in CHARACTERISTICS), None)
            if lab:
                out.append((pno, sp[6], t, lab, sp[0]))
    return out


def build_pt_tables(problems):
    """The playtest backgrounds' d6/d8 characteristic tables.

    Ownership is by Nth occurrence: the backgrounds appear in order and each has
    exactly one of each characteristic, so the second "d6 Bond" in the Sep 2024
    packet is Warrenborn's. (Verified against the page: it reads "I love my
    warren with all my heart".) Position alone will not do it — that packet's
    headings and its full-width tables interleave once the columns are flattened.

    Each table is clipped vertically to the band between its own header and the
    next, so two tables sharing a page cannot bleed into one another.
    """
    out = []
    for fname, owners in PT_BG_TABLES:
        path = os.path.join(PT_DIR, fname)
        if not os.path.exists(path):
            problems.append("missing PDF: %s" % fname)
            continue
        doc = fitz.open(path)
        hdrs = find_die_headers(doc)
        seen = {c: 0 for c in CHARACTERISTICS}
        for idx, (pno, y, die, lab, x) in enumerate(hdrs):
            owner_ix = seen[lab]
            seen[lab] += 1
            if owner_ix >= len(owners):
                problems.append("%s: more %r tables (%d) than backgrounds (%d)"
                                % (fname, lab, owner_ix + 1, len(owners)))
                continue
            owner = owners[owner_ix]
            page = doc[pno - 1]
            mid = page.rect.x0 + page.rect.width / 2
            mine_left = x < mid
            # Two layouts are in use. Oct 2025 sets its tables FULL WIDTH down
            # the page; Sep 2024 and Feb 2025 put one in each column. Telling
            # them apart by x alone fails — a full-width table also starts in
            # the left column. What distinguishes them is whether a table exists
            # beside this one: if the opposite half has a header overlapping this
            # table's vertical extent, the page is two-up and we clip to a
            # column; otherwise the table owns the full width.
            same = [h for h in hdrs
                    if h[0] == pno and h[1] > y + 8 and (h[4] < mid) == mine_left]
            bottom = same[0][1] if same else page.rect.y1
            two_up = any(h[0] == pno and (h[4] < mid) != mine_left
                         and y - 8 < h[1] < bottom for h in hdrs)
            if two_up:
                x0, x1 = (page.rect.x0, mid) if mine_left else (mid, page.rect.x1)
            else:
                x0, x1 = page.rect.x0, page.rect.x1
            clip = fitz.Rect(x0, y - 6, x1, bottom - 4)
            rows = int(die[1:])
            try:
                grid, _span = table_at(page, "%s %s" % (die, lab), 2, clip=clip,
                                       header_row=True, expect=rows)
            except Exception as ex:                       # noqa: BLE001
                problems.append("%s %s %s p%d: %s" % (owner, die, lab, pno, ex))
                continue
            grid = [r for r in grid if r and r[0].strip().isdigit()][:rows]
            if len(grid) != rows:
                problems.append("%s %s: expected %d rows, got %d"
                                % (owner, lab, rows, len(grid)))
                continue
            # A right-sized table can still be the wrong slice of the page:
            # Wonderstruck's Ideal came back six rows long but starting at 4.
            # The die faces must read 1..n, in order.
            faces = [r[0].strip() for r in grid]
            if faces != [str(k) for k in range(1, rows + 1)]:
                problems.append("%s %s: rows are %s, expected 1..%d"
                                % (owner, lab, ",".join(faces), rows))
                continue
            # A correctly sized, correctly numbered table can STILL be the wrong
            # pixels: a neighbouring column bleeds words into the cells. Two of
            # them looked perfect until the text was read ("...rural bumpkin,
            # d10 Experience so I judge"). Row counts do not catch this.
            dirty = next((c for _f, c in grid
                          if re.match(r"^\d+\s", c.strip())
                          or re.search(r"\bd\d+ (?:%s)\b" % "|".join(CHARACTERISTICS
                                                                    + ("Experience",)), c)
                          or re.search(r"\s\d+\s+[A-Z]", c)), None)
            if dirty:
                problems.append("%s %s: text from an adjacent column bled in (%r)"
                                % (owner, lab, dirty[:60]))
                continue
            # "cols", NOT "columns" — the schema and 86-tables.js both read
            # `cols`, and a table with the wrong key renders with no header row
            # at all. It looks fine in the JSON, which is how 16 of these
            # shipped headerless.
            out.append({"name": "%s %s" % (owner, lab), "owner": owner,
                        "ownerKind": "background", "cols": [die, lab],
                        "rows": grid})
        doc.close()
    # All four or none. A background showing a Flaw table but no Ideal table
    # reads as "the book has no Ideals", which is worse than showing neither.
    keep, by_owner = [], {}
    for t in out:
        by_owner.setdefault(t["owner"], []).append(t)
    for owner, ts in by_owner.items():
        if len(ts) == len(CHARACTERISTICS):
            keep += ts
        else:
            problems.append("%s: only %d of %d characteristic tables verified — "
                            "dropping the set rather than shipping a partial one"
                            % (owner, len(ts), len(CHARACTERISTICS)))
    return keep


def show(tables):
    for t in tables:
        print("=" * 74)
        print("%s   [owner: %s / %s]" % (t["name"], t["owner"], t["ownerKind"]))
        print("=" * 74)
        w = [max(len(str(r[i])) for r in [t["cols"]] + t["rows"]) for i in range(len(t["cols"]))]
        def line(cells):
            return "  " + " | ".join(str(c).ljust(w[i])[:34] for i, c in enumerate(cells))
        print(line(t["cols"]))
        print("  " + "-+-".join("-" * min(x, 34) for x in w))
        for r in t["rows"]:
            print(line(r))
        print()


# ---------------------------------------------------------------- merge
# Only these carry source prose. Everything else in a record — abilityScores,
# skills, tools, languages, equipment, equipmentGrants, effects, feat, uses,
# cost, class, category, choices, levels structure — is ours and is preserved.
# Same split as the character-update tool: the book owns the words, we own the
# mechanics.
def load(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return json.load(f)


def save(path, obj):
    with open(os.path.join(ROOT, path), "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def set_prose(rec, key, new, log, where, names):
    old = rec.get(key) or ""
    new = add_anchors(new, names)
    if not new or old == new:
        return
    rec[key] = new
    log.append(("reworded" if old else "added", "%s.%s" % (where, key)))


def merge_traits(existing, found, log, where, names, owner=None):
    """Update trait descriptions by name; append traits the paraphrase dropped."""
    for t in list(existing):
        new = RENAMED.get((owner, t.get("name")))
        if new:
            log.append(("renamed", "%s · %s -> %s" % (where, t["name"], new)))
            t["name"] = new
    by = {t.get("name", "").strip().lower(): t for t in existing}
    for nm, body in found:
        cur = by.get(nm.strip().lower())
        if cur is None:
            existing.append({"name": nm, "description": add_anchors(body, names)})
            log.append(("ADDED", "%s · %s" % (where, nm)))
        else:
            set_prose(cur, "description", body, log, "%s · %s" % (where, nm), names)
    seen = {n.strip().lower() for n, _ in found}
    for t in existing:
        if t.get("name", "").strip().lower() not in seen:
            log.append(("kept (not in source)", "%s · %s" % (where, t.get("name"))))


def write_prose(doc, problems):
    tabs = build_tables(doc, problems)
    if problems:
        return None
    names = [t["name"] for t in tabs]
    skip = [t["_region"] for t in tabs if t.get("_region")]
    log = []

    races_doc = load("data/humblewood/races.json")
    known = {x["name"]: [s["name"] for s in x.get("subraces") or []] for x in races_doc["races"]}
    found_r = extract_races(doc, skip, known)
    for rec in races_doc["races"]:
        got = found_r.get(rec["name"])
        if not got:
            continue                                  # playtest race: untouched
        set_prose(rec, "description", got["description"], log, "race/" + rec["name"], names)
        merge_traits(rec.setdefault("traits", []), got["traits"], log, "race/" + rec["name"], names)
        for sd in got["subraces"]:
            cur = next((x for x in rec.get("subraces", []) if x["name"] == sd["name"]), None)
            if cur is None:
                continue
            w = "race/%s/%s" % (rec["name"], sd["name"])
            if sd["description"]:
                set_prose(cur, "description", sd["description"], log, w, names)
            merge_traits(cur.setdefault("traits", []), sd["traits"], log, w, names, sd["name"])
    save("data/humblewood/races.json", races_doc)

    bg_doc = load("data/humblewood/backgrounds.json")
    found_b = extract_backgrounds(doc, skip)
    for rec in bg_doc["backgrounds"]:
        got = found_b.get(rec["name"])
        if not got:
            continue
        set_prose(rec, "description", got["description"], log, "bg/" + rec["name"], names)
        if got["feature"] and rec.get("feature"):
            set_prose(rec["feature"], "description", got["feature"][1], log,
                      "bg/%s · %s" % (rec["name"], rec["feature"].get("name")), names)
    save("data/humblewood/backgrounds.json", bg_doc)

    sc_doc = load("data/humblewood/subclasses.json")
    found_s = extract_subclasses(doc, skip, problems)
    for rec in sc_doc["subclasses"]:
        got = found_s.get(rec["name"])
        if not got:
            continue
        set_prose(rec, "description", got["description"], log, "sub/" + rec["name"], names)
        for lvl, feats in got["levels"].items():
            blk = rec.setdefault("levels", {}).setdefault(lvl, {})
            merge_traits(blk.setdefault("traits", []), feats, log,
                         "sub/%s L%s" % (rec["name"], lvl), names)
    save("data/humblewood/subclasses.json", sc_doc)

    ft_doc = load("data/humblewood/feats.json")
    found_f = extract_feats(doc, skip)
    for rec in ft_doc["feats"]:
        got = found_f.get(rec["name"])
        if got:
            set_prose(rec, "description", got, log, "feat/" + rec["name"], names)
    save("data/humblewood/feats.json", ft_doc)
    return log


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dump", metavar="PAGES",
                    help="print page text by column, e.g. 27 or 38-41")
    ap.add_argument("--cols", type=int, default=2, help="columns per page (default 2)")
    ap.add_argument("--tables", action="store_true", help="preview the extracted tables")
    ap.add_argument("--write-prose", action="store_true",
                    help="replace core prose in data/humblewood/*.json with source text")
    ap.add_argument("--write", action="store_true",
                    help="write data/humblewood/tables.json (refuses if anything is off)")
    ap.add_argument("--playtests", action="store_true",
                    help="preview what the playtest packets yield (writes nothing)")
    ap.add_argument("--only", metavar="DATE",
                    help="restrict --playtests to one packet, e.g. 2025-07")
    ap.add_argument("--write-playtests", action="store_true",
                    help="fold the playtest packets into data/humblewood/*.json")
    ap.add_argument("--pdf", default=PDF)
    a = ap.parse_args()

    if a.write_playtests:
        problems = []
        log = pt_write(problems)
        if problems:
            print("PROBLEMS (%d) — data written anyway, review these:" % len(problems))
            for x in problems:
                print("   - " + x)
        import collections
        by = collections.Counter(k for k, _ in log)
        for kind in ("CREATED", "ADDED", "kept (not in source)"):
            rows = [w for k, w in log if k == kind]
            if rows:
                print("%s (%d):" % (kind.upper(), len(rows)))
                for w in rows:
                    print("   - " + w)
        print("\nsummary: " + ", ".join("%s %d" % (k, n) for k, n in sorted(by.items())))
        return

    if a.playtests:
        problems = []
        packets = [p for p in PACKETS if not a.only or p["date"] == a.only]
        if not packets:
            sys.exit("no packet dated %r (have: %s)"
                     % (a.only, ", ".join(p["date"] for p in PACKETS)))
        n, vb_ok, vb_tot, vb_bad = 0, 0, 0, []
        for pk in packets:
            got = pt_extract(pk, problems)
            if not any(got.values()):
                continue
            doc = fitz.open(os.path.join(PT_DIR, pk["file"]))
            ok, tot, bad = pt_verbatim(pt_fields(got), vb_norm(pt_reference(doc, pk)))
            doc.close()
            vb_ok += ok; vb_tot += tot
            vb_bad += [(pk["date"],) + b for b in bad]
            print("\n=== %s  %s   [verbatim %d/%d]" % (pk["date"], pk["file"], ok, tot))
            for r in got["races"]:
                print("  race %s — %d traits, %d lineage(s): %s"
                      % (r["name"], len(r["traits"]),
                         len(r["subraces"]), ", ".join(s["name"] for s in r["subraces"])))
                print("     desc: %s" % (r["description"][:100] or "(none)"))
                print("     traits: %s" % ", ".join(t for t, _ in r["traits"]))
                for s in r["subraces"]:
                    print("       %s: %s" % (s["name"], ", ".join(t for t, _ in s["traits"])))
                n += 1
            for s in got["subclasses"]:
                lv = ", ".join("L%s %s" % (l, nm)
                               for l in sorted(s["levels"], key=int)
                               for nm, _ in s["levels"][l])
                print("  subclass %s (%s) — %s" % (s["name"], s["class"], lv))
                n += 1
            for b in got["backgrounds"]:
                print("  background %s — feature %r, desc %d ch"
                      % (b["name"], b["feature"][0] if b["feature"] else None,
                         len(b["description"])))
                n += 1
        print("\n%d entit(ies) extracted — VERBATIM %d/%d" % (n, vb_ok, vb_tot))
        if vb_bad:
            print("\nNOT VERBATIM (%d):" % len(vb_bad))
            for date, label, ln in vb_bad:
                print("   %s  %-52s (%d ch)" % (date, label[:52], ln))
        if problems:
            print("\nPROBLEMS (%d):" % len(problems))
            for x in problems:
                print("   - " + x)
            sys.exit(1)
        print("no problems")
        return

    if not os.path.exists(a.pdf):
        sys.exit("no such PDF: %s" % a.pdf)
    doc = fitz.open(a.pdf)

    if a.dump:
        if "-" in a.dump:
            lo, hi = a.dump.split("-")
            pages = range(int(lo), int(hi) + 1)
        else:
            pages = [int(x) for x in a.dump.split(",")]
        dump(doc, pages, a.cols)
        return

    if a.write_prose:
        problems = []
        log = write_prose(doc, problems)
        if log is None:
            print("REFUSING — table extraction has problems:")
            for x in problems:
                print("   - " + x)
            sys.exit(1)
        import collections
        by = collections.Counter(k for k, _ in log)
        for kind in ("ADDED", "kept (not in source)"):
            rows = [w for k, w in log if k == kind]
            if rows:
                print("%s (%d):" % (kind.upper(), len(rows)))
                for w in rows:
                    print("   - " + w)
        print("\nsummary: " + ", ".join("%s %d" % (k, n) for k, n in sorted(by.items())))
        return

    if a.write:
        problems = []
        tables = build_tables(doc, problems)
        # Playtest tables are additive and separately guarded: their own
        # failures are reported but must not block the core 19 from writing.
        pt_problems = []
        tables += build_pt_tables(pt_problems)
        if pt_problems:
            print("playtest tables — %d not taken:" % len(pt_problems))
            for x in pt_problems:
                print("   - " + x)
        if problems:
            print("REFUSING TO WRITE — %d problem(s):" % len(problems))
            for x in problems:
                print("   - " + x)
            sys.exit(1)
        names = [t["name"] for t in tables]
        if len(names) != len(set(names)):
            sys.exit("duplicate table names (the app merges on name): %s" % names)
        tables.sort(key=lambda t: (t["ownerKind"], t["owner"], t["name"]))
        # `_region` is the page band each table occupies. write_prose() needs it
        # in memory to keep table rows out of the prose, but it is an extractor
        # detail and has no business in a file players load — strip every
        # underscore-prefixed key on the way out.
        tables = [{k: v for k, v in t.items() if not k.startswith("_")} for t in tables]
        missing_cols = [t["name"] for t in tables if not t.get("cols")]
        if missing_cols:
            sys.exit("tables with no `cols` would render headerless: %s"
                     % ", ".join(missing_cols))
        pack = {"system": "Humblewood", "name": "Humblewood Tables",
                "version": 1, "tables": tables}
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(pack, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print("wrote %s — %d tables, %d rows"
              % (os.path.relpath(OUT, ROOT), len(tables), sum(len(t["rows"]) for t in tables)))
        return

    if a.tables:
        problems = []
        tables = build_tables(doc, problems)
        show(tables)
        if problems:
            print("PROBLEMS (%d):" % len(problems))
            for x in problems:
                print("   - " + x)
            sys.exit(1)
        print("no problems — %d table(s)" % len(tables))
        return

    ap.print_help()


if __name__ == "__main__":
    main()
