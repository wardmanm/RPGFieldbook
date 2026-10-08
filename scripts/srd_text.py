"""The SRD 5.2 pack's text against the SRD's own (#84, spec
src/docs/specs/2026-10-08-srd-pack-design.md §5). Pure: the PDF's page texts in,
findings out. src/tests/srd-verbatim.py reads the PDF and reports.

A finding is a span of pack text that appears NOWHERE in the SRD. Shipping text
the SRD doesn't contain is what CC-BY-4.0 doesn't cover. Text the SRD has
elsewhere (the Ammunition rules quoted on an arrow) is SRD text, and passes.
"""
import bisect, difflib, re, unicodedata

# curly quotes, dashes, the minus and the times sign -> plain text
_QUOTES = ((chr(0x2019), "'"), (chr(0x2018), "'"), (chr(0x201C), '"'), (chr(0x201D), '"'),
           (chr(0x2013), '-'), (chr(0x2014), ' - '), (chr(0x2212), '-'), (chr(0xD7), 'x'))
_RUNNING_HEAD = re.compile(r'System Reference Document 5\.2(?:\.1)?\s*\n\s*\d+\s*\n')
# what the converter writes itself: an item's stat segments on its first line
# (scripts/convert.py convert_items(): Damage, Range, Properties, Mastery, AC,
# Requires Strength, Disadvantage on Stealth, Base item). None holds a period,
# so none can run on into the prose the converter joins after them.
_GENERATED = re.compile(r'^(Damage \S+ \w+( \([^)]*\))?|Range [\d/]+ ft|Properties: [^.]*|Mastery: [^.]*'
                        r'|AC [+\d][^.]*|Requires Strength \d+|Disadvantage on Stealth|Base item: [^.]*)$')
# lines the converter moves out of order: checked as words, not as a sequence
_SIDE = re.compile(r'(?m)^(?:Material|Prerequisite): (.*)$')
_DROP = re.compile(r'(?m)^Repeatable: .*$|\[Table: [^\]]*\]')

def norm(s):
    """Text reduced to comparable words: quotes and dashes unified, the PDF's
    running heads and line-end hyphenation removed, hyphens and punctuation
    dropped, lower case."""
    s = unicodedata.normalize('NFKC', s or '')
    s = s.replace(chr(0xAD), '').replace(chr(0x200B), '')   # soft hyphen, zero-width space
    for a, b in _QUOTES:
        s = s.replace(a, b)
    s = _RUNNING_HEAD.sub('\n', s)
    s = re.sub(r'-\s*\n\s*', '', s).replace('-', '')
    s = re.sub(r"'s\b", 's', s)
    s = re.sub(r'[^\w\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip().lower()

def strip_generated(text):
    """Drop the stat segments the converter writes on an item's first line.
    convert_items() joins them with " · " and the prose after them with ". ",
    so the last segment is split there and the prose kept."""
    lines = (text or '').split('\n')
    if lines:
        parts = lines[0].split(' · ')
        head, sep, tail = parts[-1].partition('. ')
        if sep and _GENERATED.match(head.strip()):
            parts[-1:] = [head, tail]
        lines[0] = ' · '.join(p for p in parts if not _GENERATED.match(p.strip()))
    return '\n'.join(lines)

def records(packs):
    """(key, text) for every checkable piece of the pack, keyed as
    srd-corrections.json names entries."""
    out = []
    for fname, obj in sorted(packs.items()):
        for cat, arr in obj.items():
            if not isinstance(arr, list) or cat == 'tables':
                continue
            for r in arr:
                if not isinstance(r, dict):
                    continue
                key = str(r.get('term') or r.get('name') or '')
                body = r.get('text') or r.get('description') or ''
                if body:
                    out.append((key, strip_generated(body)))
                for lv in (r.get('levels') or {}).values():
                    for t in lv.get('traits') or []:
                        out.append((key + '/' + str(t.get('name')), t.get('description') or ''))
                for sn, sd in (r.get('subclasses') or {}).items():
                    for lv in (sd.get('levels') or {}).values():
                        for t in lv.get('traits') or []:
                            out.append((sn + '/' + str(t.get('name')), t.get('description') or ''))
                for t in r.get('traits') or []:
                    out.append((key + '/' + str(t.get('name')), t.get('description') or ''))
    return out

class Srd:
    """The SRD's words, each with its page."""
    def __init__(self, pages):
        words, wpage = [], []
        for i, txt in enumerate(pages):
            ws = norm(txt).split()
            words += ws
            wpage += [i + 1] * len(ws)
        self.words, self.wpage = words, wpage
        self.text = ' ' + ' '.join(words) + ' '
        self.starts, c = [], 1
        for w in words:
            self.starts.append(c)
            c += len(w) + 1
        self.vocab = set(words)

    def has(self, span):
        return (' ' + span + ' ') in self.text

    def word_at(self, ch):
        return bisect.bisect_left(self.starts, ch)

def compare(srd, key, text, heading=None):
    """([spans of `text` the SRD lacks], page of the matched SRD section).
    `heading` (an alias) replaces the entry's own name where the SRD titles it
    differently. Each place the name occurs is tried; the best match wins."""
    sides = _SIDE.findall(text or '')
    body = _DROP.sub('', _SIDE.sub('', text or ''))
    ours = norm(body).split()
    if not ours:
        return [], None
    name = norm(heading or key.split('/')[-1])
    cands = [m.start() for m in re.finditer(r'(?<= )' + re.escape(name) + r'(?= )', srd.text)] if name else []
    if not cands:
        return ['(not located)'], None
    best = None
    for ch in cands:
        w0 = srd.word_at(ch) + len(name.split())
        win = srd.words[w0:w0 + len(ours) * 2 + 60]
        sm = difflib.SequenceMatcher(None, ours, win, autojunk=False)
        score = sum(b.size for b in sm.get_matching_blocks())
        if best is None or score > best[0]:
            best = (score, sm, w0)
    _, sm, w0 = best
    spans = [' '.join(ours[i1:i2]) for tag, i1, i2, _, _ in sm.get_opcodes() if tag in ('replace', 'delete')]
    spans = [s for s in spans if not srd.has(s)]
    for s in sides:
        miss = [w for w in norm(s).split() if w not in srd.vocab]
        if miss:
            spans.append(' '.join(miss))
    page = srd.wpage[min(w0, len(srd.wpage) - 1)] if srd.wpage else None
    return spans, page

def check(pages, packs, corrections):
    """[(key, span, page)] that corrections doesn't accept: every span of pack
    text the SRD lacks, and every table cell it lacks."""
    srd = Srd(pages)
    accepted = {(a['entry'], a['text']) for a in corrections.get('accepted') or []}
    alias = corrections.get('aliases') or {}
    out = []
    for key, text in records(packs):
        spans, page = compare(srd, key, text, alias.get(key))
        out += [(key, s, page) for s in spans if (key, s) not in accepted]
    for obj in sorted(packs.values(), key=lambda o: str(o.get('name'))):
        for t in obj.get('tables') or []:
            key = 'table:' + str(t.get('name'))
            for row in [t.get('cols') or []] + (t.get('rows') or []):
                for cell in row:
                    s = norm(str(cell))
                    if s and not srd.has(s) and (key, s) not in accepted:
                        out.append((key, s, None))
    return out
