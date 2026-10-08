#!/usr/bin/env python3
"""SRD 5.2's text against the SRD 5.2.1 PDF (#84, spec §5): every span of pack
text the SRD lacks must be corrected or accepted in scripts/srd-corrections.json.
Needs PyMuPDF (.venv) and _conversion-data/srd52/SRD_CC_v5.2.1.pdf; SKIPPED
without either, so CI and other machines stay green.

    .venv/bin/python src/tests/srd-verbatim.py [--report PATH]
"""
import glob, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
PDF = os.path.join(ROOT, '_conversion-data', 'srd52', 'SRD_CC_v5.2.1.pdf')
try:
    import fitz
except ImportError:
    print('SKIP - pymupdf not installed (needs .venv)')
    sys.exit(0)
if not os.path.exists(PDF):
    print('SKIP - SRD PDF not present')
    sys.exit(0)
import srd_text

corr_path = os.path.join(ROOT, 'scripts', 'srd-corrections.json')
corr = json.load(open(corr_path, encoding='utf-8')) if os.path.exists(corr_path) else {}
packs = {os.path.basename(p): json.load(open(p, encoding='utf-8'))
         for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'srd52', '*.json')))}
pages = [pg.get_text() for pg in fitz.open(PDF)]
findings = srd_text.check(pages, packs, corr)

if '--report' in sys.argv:
    out = sys.argv[sys.argv.index('--report') + 1]
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write('# SRD 5.2 against SRD 5.2.1: %d findings\n' % len(findings))
        cur = None
        for key, span, page in sorted(findings, key=lambda x: (x[0], x[1])):
            if key != cur:
                fh.write('\n## %s%s\n\n' % (key, (' (PDF p. %s)' % page) if page else ''))
                cur = key
            fh.write('- `%s`\n' % span)
    print('report: ' + out)
for key, span, page in findings:
    print('FAIL  %s: %r%s' % (key, span, (' (PDF p. %s)' % page) if page else ''))
print('')
print(('FAILURES: %d spans of SRD 5.2 text the SRD lacks' % len(findings)) if findings
      else 'ALL PASSED (%d)' % len(srd_text.records(packs)))
sys.exit(1 if findings else 0)
