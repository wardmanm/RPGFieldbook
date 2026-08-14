#!/usr/bin/env python3
"""
Humblewood Fieldbook — 5e-tools converter
==========================================

Turns raw 5e-tools JSON (the files from 5e.tools/data) into the Fieldbook rules
schema, preferring the 2024 rules (XPHB / basicRules2024) and, where a 2014
entry has no 2024 equivalent, keeping the 2014 one. Mechanical effects that the
sheet can't read from prose (e.g. "Archery gives +2 to ranged attacks") come
from a small, hand-editable overlay file (overlay.json).

USAGE
-----
  python convert.py conditions conditionsdiseases.json      -o conditions-2024.json
  python convert.py feats      feats.json                    -o feats-2024.json
  python convert.py spells     spells-xphb.json --sources sources.json -o spells-2024.json
  python convert.py classes    class-*.json                  -o classes.json
  python convert.py races      races.json                    -o races.json
  python convert.py all        <input-dir> -o <output-dir>   # everything it can find

'all' searches <input-dir> and its spells/ and class/ subdirectories, converts both
items-base.json and items.json (magic), and falls back to the repo's data/ for
overlay.json and class-resources.json. It warns loudly for anything it can't find.

Options that apply where relevant:
  --overlay overlay.json   add effects/skill/save grants by entry name (feats, fighting styles)
  --sources sources.json   (spells only) tag each spell with its 2024 class list
  --include-legacy         (classes only) also include non-XPHB subclasses (mixes editions)
  --no-spell-notes         (classes only) skip the per-level "prepared/known spells" notes
  --tables tables.json     also write the tables lifted out of the prose to this file
                           ('all' always writes <outdir>/tables-2024.json)

No third-party dependencies — standard library only. Python 3.8+.
"""
import json, re, argparse, glob, os, sys, contextlib, collections

# ---------------------------------------------------------------- tag rendering
# 5e-tools inline tags look like {@tag arg|arg|arg}. Different tags put the
# human-readable display text in different positions, hence the per-tag rules.
TAG = re.compile(r'\{@([a-zA-Z0-9]+)\s+([^{}]+)\}')

def strip_tags(s):
    def rep(m):
        tag = m.group(1).lower()
        p = m.group(2).split('|')
        if tag == 'classfeature':                 # name|class|source|level|display?
            return p[4] if len(p) > 4 and p[4].strip() else p[0]
        if tag == 'subclassfeature':              # name|class|classSrc|subShort|subSrc|level|display?
            return p[6] if len(p) > 6 and p[6].strip() else p[0]
        if tag in ('filter', 'book', '5etools', 'adventure', 'link'):
            return p[0]
        if tag == 'chance':
            return p[0] + ' percent'
        if tag == 'dc':
            return 'DC ' + p[0]
        # default family: name|source|display?  (feat, spell, item, condition,
        # creature, skill, action, sense, variantrule, status, damage, dice,
        # scaledamage, scaledice, hazard, ...)
        if len(p) >= 3 and p[2].strip():
            return p[2]
        return p[0]
    prev = None
    while prev != s:
        prev = s
        s = TAG.sub(rep, s)
    return re.sub(r'\s+', ' ', s).strip()

# ---------------------------------------------------------------- tables
# 5e-tools carries real table structures ({type:table, colLabels, rows}). We lift
# them out of the prose into a separate 'tables' pack and leave a "[Table: Name]"
# anchor behind, which the app turns into a tappable chip (and which still reads
# as plain English when no tables pack is loaded).
_SINK = None       # list to collect normalized tables into, or None to discard
_OWNER = ('', '')  # (name, kind) of the entity currently being flattened

@contextlib.contextmanager
def table_ctx(sink, name, kind):
    """Collect any tables found while flattening into `sink`, tagged with owner."""
    global _SINK, _OWNER
    prev = (_SINK, _OWNER)
    _SINK, _OWNER = sink, (str(name or ''), kind)
    try:
        yield
    finally:
        _SINK, _OWNER = prev

# ---------------------------------------------------------------- feature refs
# A class/subclass feature's entries can point at a SIBLING feature instead of
# containing it: {"type":"refSubclassFeature","subclassFeature":"Name|..."}.
# flatten() used to fall through those silently, losing the whole referenced
# feature — and any table inside it. That is why the Wild Magic Surge table went
# missing while three later Sorcerer features still cited it.
_REFRES = None     # callable(node) -> feature dict, or None
_REFSEEN = None    # cycle guard

@contextlib.contextmanager
def ref_ctx(resolver):
    global _REFRES, _REFSEEN
    prev = (_REFRES, _REFSEEN)
    _REFRES, _REFSEEN = resolver, set()
    try:
        yield
    finally:
        _REFRES, _REFSEEN = prev

def _roll_text(roll):
    """{min:1,max:2,pad:true} -> '01-02'; {exact:5} -> '5'."""
    pad = bool(roll.get('pad'))
    def f(n):
        return '%02d' % int(n) if pad else str(int(n))
    if roll.get('exact') is not None:
        return f(roll['exact'])
    lo, hi = roll.get('min'), roll.get('max')
    if lo is None and hi is None:
        return ''
    if lo is None or hi is None:
        return f(hi if lo is None else lo)
    return f(lo) if int(lo) == int(hi) else '%s-%s' % (f(lo), f(hi))

def _cell_text(cell):
    """A table cell in 5e-tools may be a string, a number, a roll spec or entries."""
    if isinstance(cell, bool) or cell is None:
        return ''
    if isinstance(cell, (int, float)):
        return str(cell)
    if isinstance(cell, str):
        return strip_tags(cell)
    if isinstance(cell, list):
        return ' '.join(x for x in (_cell_text(c) for c in cell) if x)
    if isinstance(cell, dict):
        if isinstance(cell.get('roll'), dict):
            return _roll_text(cell['roll'])
        if 'entry' in cell:
            return flatten([cell['entry']]).replace('\n', ' ')
        if 'entries' in cell:
            return flatten(cell['entries']).replace('\n', ' ')
    return ''

def _align(style):
    s = str(style or '')
    if 'text-center' in s:
        return 'center'
    if 'text-right' in s:
        return 'right'
    return 'left'

_RESERVED = frozenset()   # table names another pack already owns
_SUFFIX = ''              # what to append when we'd collide with one

@contextlib.contextmanager
def reserved_names(names, suffix):
    """Table names are a GLOBAL lookup in the app (findTable, 86-tables.js) — the
    "[Table: X]" anchor carries no pack, so the first loaded X wins. The 2024 PHB
    reprinted seven Xanathar's/Tasha's subclasses, so "Gloom Stalker Spells" names
    two genuinely different tables; without this, the 2014 subclass's own anchor
    opens the 2024 table. Renaming here rather than in the app is what keeps the
    anchors correct for free: _register returns the final name and flatten() uses
    exactly that."""
    global _RESERVED, _SUFFIX
    prev = (_RESERVED, _SUFFIX)
    _RESERVED, _SUFFIX = frozenset(names or ()), suffix or ''
    try:
        yield
    finally:
        _RESERVED, _SUFFIX = prev

def _register(tbl, sink):
    """Add a table to the sink under a unique name; reuse an identical one.
    Names are the merge key in the app, so they must not collide."""
    if sink is None:
        return tbl['name']
    for t in sink:
        if t['cols'] == tbl['cols'] and t['rows'] == tbl['rows']:
            return t['name']            # same table captured already — reuse it
    if _SUFFIX and tbl['name'] in _RESERVED:
        tbl['name'] = tbl['name'] + _SUFFIX
    taken = {t['name'] for t in sink}
    if tbl['name'] in taken:
        i = 2
        while '%s (%d)' % (tbl['name'], i) in taken:
            i += 1
        tbl['name'] = '%s (%d)' % (tbl['name'], i)
    sink.append(tbl)
    return tbl['name']

def _norm_table(node, name=None, owner=None, kind=None):
    """Normalize a 5e-tools table node into the Fieldbook 'tables' schema."""
    rows = []
    for row in node.get('rows') or []:
        cells = row.get('row') if isinstance(row, dict) else row
        if not isinstance(cells, list):
            continue
        cells = [_cell_text(c) for c in cells]
        if any(c for c in cells):
            rows.append(cells)
    if not rows:
        return None
    cols = [strip_tags(str(c)) for c in (node.get('colLabels') or [])]
    width = max([len(r) for r in rows] + [len(cols)])
    cols += [''] * (width - len(cols))
    for r in rows:
        r += [''] * (width - len(r))
    styles = list(node.get('colStyles') or [])
    styles += [''] * (width - len(styles))
    caption = strip_tags(str(node.get('caption') or '')) if node.get('caption') else ''
    nm = name or caption or ((owner or _OWNER[0]) + ' Table').strip() or 'Table'
    tbl = {'name': nm, 'cols': cols, 'align': [_align(s) for s in styles], 'rows': rows}
    if caption:
        tbl['caption'] = caption
    ownr = owner if owner is not None else _OWNER[0]
    if ownr:
        tbl['owner'] = ownr
        tbl['ownerKind'] = kind if kind is not None else _OWNER[1]
    return tbl

def flatten(entries):
    """Flatten a 5e-tools 'entries' tree into readable plain text.
    Named subsections render as 'Name: text'; lists as bullets; tables are
    lifted into the active table sink and replaced by a "[Table: Name]" anchor."""
    lines = []
    def walk(node):
        if isinstance(node, str):
            lines.append(strip_tags(node))
        elif isinstance(node, list):
            for x in node:
                walk(x)
        elif isinstance(node, dict):
            t = node.get('type')
            if t == 'list':
                for it in node.get('items', []):
                    lines.append('• ' + strip_tags(it) if isinstance(it, str) else flatten([it]))
            elif t == 'tableGroup':
                for sub in node.get('tables', []):
                    walk(sub)           # a group is just several tables in a row
            elif t == 'table':
                # only anchor it if something is collecting — an anchor with no
                # table behind it would be worse than the old silent drop
                tbl = _norm_table(node) if _SINK is not None else None
                if tbl:
                    lines.append('[Table: %s]' % _register(tbl, _SINK))
            elif t in ('refClassFeature', 'refSubclassFeature'):
                ref = node.get('classFeature') or node.get('subclassFeature')
                sub = _REFRES(node) if (_REFRES and ref) else None
                if sub is not None and ref not in _REFSEEN:
                    _REFSEEN.add(ref)       # a feature must not inline itself
                    walk({'name': sub.get('name'), 'entries': sub.get('entries', [])})
            elif t in ('image', 'gallery'):
                pass
            elif t == 'entries' or 'entries' in node:
                name = node.get('name')
                if name:
                    sub = [strip_tags(x) if isinstance(x, str) else flatten([x]) for x in node.get('entries', [])]
                    lines.append(strip_tags(name) + ': ' + ' '.join(s for s in sub if s))
                else:
                    walk(node.get('entries', []))
    walk(entries)
    return '\n'.join(l for l in lines if l)

# ---------------------------------------------------------------- shared maps
SKMAP = {'acrobatics':'Acrobatics','animal handling':'Animal Handling','arcana':'Arcana','athletics':'Athletics',
    'deception':'Deception','history':'History','insight':'Insight','intimidation':'Intimidation','investigation':'Investigation',
    'medicine':'Medicine','nature':'Nature','perception':'Perception','performance':'Performance','persuasion':'Persuasion',
    'religion':'Religion','sleight of hand':'Sleight of Hand','stealth':'Stealth','survival':'Survival'}
def sk(nm): return SKMAP.get(str(nm).lower(), str(nm))

SCHOOL = {'A':'Abjuration','C':'Conjuration','D':'Divination','E':'Enchantment','V':'Evocation',
          'I':'Illusion','N':'Necromancy','T':'Transmutation','P':'Psionic'}
SHAPE = {'cone':'Cone','sphere':'Sphere','cube':'Cube','line':'Line','emanation':'Emanation',
         'radius':'Radius','hemisphere':'Hemisphere'}
ABIL_FULL = {'str':'Strength','dex':'Dexterity','con':'Constitution','int':'Intelligence','wis':'Wisdom','cha':'Charisma'}
CAT_LABEL = {'O':'Origin feat','G':'General feat','FS':'Fighting Style feat','EB':'Epic Boon'}

# The 2024 Fighting Style menu. Effects (attack/AC etc.) come from the overlay.
FIGHTING_STYLES = [
    {"name":"Archery","description":"+2 bonus to ranged weapon attack rolls."},
    {"name":"Blind Fighting","description":"You have Blindsight with a range of 10 feet."},
    {"name":"Defense","description":"+1 AC while wearing armor."},
    {"name":"Dueling","description":"+2 damage with a one-handed melee weapon when no other weapon is held."},
    {"name":"Great Weapon Fighting","description":"Treat 1s and 2s on two-handed melee damage dice as 3s."},
    {"name":"Interception","description":"Reaction to reduce damage to a creature within 5 feet of you."},
    {"name":"Protection","description":"Reaction (with a shield) to give an attacker Disadvantage."},
    {"name":"Thrown Weapon Fighting","description":"Draw thrown weapons as part of the attack; +2 damage with them."},
    {"name":"Two-Weapon Fighting","description":"Add your ability modifier to the off-hand attack's damage."},
    {"name":"Unarmed Fighting","description":"Your unarmed strikes deal more damage and can hurt a grappled creature."},
]
CLASS_BLURB = {
    'Barbarian':'A fierce warrior who channels primal rage.',
    'Bard':'An inspiring magician whose power echoes the music of creation.',
    'Cleric':'A priestly champion who wields divine magic in service of a higher power.',
    'Druid':'A priest of the Old Faith, wielding the powers of nature.',
    'Fighter':'A master of martial combat, skilled with many weapons and armor.',
    'Monk':'A martial artist who harnesses the power of ki.',
    'Paladin':'A holy warrior bound to a sacred oath.',
    'Ranger':'A warrior of the wilds who blends martial skill with primal magic.',
    'Rogue':'A scoundrel who uses stealth and precision to overcome obstacles.',
    'Sorcerer':'A spellcaster who draws on inherent magic from a gift or bloodline.',
    'Warlock':'A wielder of magic derived from a bargain with an extraplanar entity.',
    'Wizard':'A scholarly magic-user capable of manipulating the structures of reality.',
    'Artificer':'An inventor who infuses objects with magical power.',
    'Mystic':'A wielder of psionic power drawn from the mind.',
}

# ---------------------------------------------------------------- overlay
def load_class_resources(path):
    if not path or not os.path.exists(path):
        return {}
    try:
        return json.load(open(path, encoding='utf-8'))
    except Exception:
        return {}

def load_overlay(path):
    if not path:
        return {}
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return data.get('byName', data) if isinstance(data, dict) else {}

def apply_overlay(name, rec, overlay):
    """Merge overlay effects/skills/saves into a record (feat or option) by name."""
    o = overlay.get(name)
    if not o:
        return rec
    for k in ('effects', 'skills', 'saves'):
        if o.get(k):
            rec[k] = o[k]
    if o.get('description'):
        rec['description'] = o['description']
    return rec

# ---------------------------------------------------------------- 2024 selection
def pick_2024_preferred(entries, name_key='name'):
    """Everything from XPHB — the definitive 2024 book — plus any basic-rules
    entry whose name XPHB doesn't already cover (2024 wins on overlap, then the
    free 2024 subset, then 2014).

    NB: `basicRules2024` selects only the *free* rules subset. Filtering on it
    alone silently trims the book — it has already cost us backgrounds (4 of 16)
    and spells (339 of 391). Source is the filter; the flags only backfill."""
    xphb = [e for e in entries if e.get('source') == 'XPHB']
    names = {e[name_key] for e in xphb}
    two4 = [e for e in entries if e.get('basicRules2024') is True and e[name_key] not in names]
    names |= {e[name_key] for e in two4}
    legacy = [e for e in entries if e.get('basicRules') is True and e[name_key] not in names]
    return xphb + two4 + legacy

# ---------------------------------------------------------------- which book
# Everything below used to say 'XPHB' out loud, twelve times over, and filter on
# it in five more places. A supplement (Xanathar's, Tasha's) is the same pipeline
# pointed at a different source code, so the book became a parameter instead.
#
# The DEFAULT Book reproduces the original behaviour byte for byte — no source
# codes means pick_2024_preferred, and the pack names are the exact strings the
# committed data/5e2024/ files already carry. Do not "tidy" these strings.
_XPHB_NAMES = {
    'items': 'D&D 2024 Items', 'backgrounds': 'D&D 2024 Backgrounds',
    'classes': 'XPHB Classes (2024)', 'races': 'D&D 2024 Species',
    'tables': 'XPHB Tables',
}

class Book:
    """The source book(s) a run converts, and how its packs are labelled.

    codes           5e-tools `source` values to keep. Empty = the 2024 default
                    (pick_2024_preferred), which is what data/5e2024/ was built with.
    system          the string stamped as each pack's `system` field. This is the
                    app's merge namespace AND the DATA_VERSIONS key.
    names           per-output-stem pack display names.
    note            `_note` written into every pack — used to say out loud that a
                    supplement is 2014-era content sitting beside the 2024 rules.
    exclude_systems `excludeSystems` — character systems this pack's species must
                    not be offered to (see docs/rules-schema.md §1).
    """
    def __init__(self, codes=None, system='XPHB', names=None, note='', exclude_systems=None):
        self.codes = tuple(codes or ())
        self.system = system
        self.names = dict(_XPHB_NAMES)
        self.names.update(names or {})
        self.note = note or ''
        self.exclude_systems = tuple(exclude_systems or ())

    @property
    def is_default(self):
        """True for the plain 2024 run — the one whose output must never move."""
        return not self.codes

DEFAULT_BOOK = Book()

def _bk(book):
    return book if book is not None else DEFAULT_BOOK

def pick_sources(entries, book=None, name_key='name'):
    """Select entries for `book`. With no explicit source codes this is exactly
    pick_2024_preferred; with them it is a plain source filter — the basicRules
    backfills are 2024 flags and are never set on a supplement's entries."""
    b = _bk(book)
    if b.is_default:
        return pick_2024_preferred(entries, name_key)
    codes = set(b.codes)
    return [e for e in entries if e.get('source') in codes]

def _pack(book, cat, arr, stem=None, version=None):
    """Build a pack wrapper. Key order is load-bearing: the committed 5e2024
    files were written as system, name?, version?, <array> and the build compares
    bytes. `_note`/`excludeSystems` are absent unless the book sets them, so the
    default run is untouched."""
    b = _bk(book)
    out = {'system': b.system}
    nm = b.names.get(stem if stem is not None else cat)
    if nm:
        out['name'] = nm
    if version is not None:
        out['version'] = version
    if b.note:
        out['_note'] = b.note
    if b.exclude_systems:
        out['excludeSystems'] = list(b.exclude_systems)
    out[cat] = arr
    return out

# ================================================================ CONDITIONS
def convert_conditions(path, overlay=None, tables=None, book=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    buckets = [d.get('condition', []), d.get('status', []), d.get('disease', [])]
    entries = [e for b in buckets for e in b]
    chosen = pick_sources(entries, book)
    keywords = []
    for e in chosen:
        with table_ctx(tables, e['name'], 'rule'):
            keywords.append({'term': e['name'], 'type': 'text',
                             'text': flatten(e.get('entries', [])), 'cond': True})
    return _pack(book, 'keywords', keywords, stem='conditions')

# ================================================================ GLOSSARY (variant rules)
def convert_glossary(path, overlay=None, tables=None, book=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    chosen = pick_sources(d.get('variantrule', []), book)
    keywords = []
    for e in chosen:
        with table_ctx(tables, e['name'], 'rule'):
            keywords.append({'term': e['name'], 'type': 'text',
                             'text': flatten(e.get('entries', []))})
    return _pack(book, 'keywords', keywords, stem='glossary')

# ================================================================ ITEMS
_DMG = {'S': 'slashing', 'P': 'piercing', 'B': 'bludgeoning', 'R': 'radiant', 'N': 'necrotic', 'F': 'force', 'L': 'lightning', 'C': 'cold', 'A': 'acid', 'T': 'thunder', 'Y': 'psychic', 'O': 'poison', 'I': 'fire'}
_RAR = {'none': 'Mundane', 'common': 'Common', 'uncommon': 'Uncommon', 'rare': 'Rare', 'very rare': 'Very Rare', 'legendary': 'Legendary', 'artifact': 'Artifact'}
_ITYPES = {'A':'Ammunition','AF':'Ammunition','AT':"Artisan's Tools",'EXP':'Explosive','FD':'Food and Drink','G':'Adventuring Gear','GS':'Gaming Set','GV':'Generic Variant','HA':'Heavy Armor','INS':'Instrument','LA':'Light Armor','M':'Melee Weapon','MA':'Medium Armor','MNT':'Mount','OTH':'Other','P':'Potion','R':'Ranged Weapon','RD':'Rod','RG':'Ring','S':'Shield','SC':'Scroll','SCF':'Spellcasting Focus','SHP':'Vehicle (Water)','T':'Tool','TAH':'Tack and Harness','TG':'Trade Good','VEH':'Vehicle (Land)','WD':'Wand','AIR':'Vehicle (Air)','SPC':'Vehicle (Space)','$':'Treasure','$A':'Treasure (Art Object)','$C':'Coinage','$G':'Gemstone','TB':'Trade Bar'}

def _abbr(x): return str(x).split('|')[0].strip()

def _cost(value):
    v = int(value or 0)
    if v <= 0: return ''
    gp, rem = divmod(v, 100); sp, cp = divmod(rem, 10)
    parts = []
    if gp: parts.append('%d gp' % gp)
    if sp: parts.append('%d sp' % sp)
    if cp: parts.append('%d cp' % cp)
    return ', '.join(parts)

def _ival(x):
    try: return int(str(x).replace('+', '').strip())
    except Exception: return 0

def _item_effects(it):
    fx = []
    if it.get('bonusAc'): fx.append(('ac', _ival(it['bonusAc'])))
    if it.get('bonusWeapon'):
        v = _ival(it['bonusWeapon']); fx += [('attack', v), ('damage', v)]
    if it.get('bonusWeaponAttack'): fx.append(('attack', _ival(it['bonusWeaponAttack'])))
    if it.get('bonusWeaponDamage'): fx.append(('damage', _ival(it['bonusWeaponDamage'])))
    if it.get('bonusSavingThrow'):
        v = _ival(it['bonusSavingThrow']); fx += [('save.' + a, v) for a in ('str','dex','con','int','wis','cha')]
    return [{'target': t, 'value': v} for t, v in fx if v]

def _coarse(tcode, it):
    if it.get('wondrous'): return 'Wondrous Item'
    if it.get('staff'): return 'Staff'
    c = {'M':'Weapon','R':'Weapon','LA':'Armor','MA':'Armor','HA':'Armor','S':'Armor','A':'Ammunition','AF':'Ammunition','AT':'Tool','T':'Tool','GS':'Tool','INS':'Tool','P':'Potion','RG':'Ring','RD':'Rod','WD':'Wand','SC':'Scroll','SCF':'Focus','MNT':'Mount','VEH':'Vehicle','SHP':'Vehicle','AIR':'Vehicle'}.get(tcode)
    if c: return c
    if it.get('weapon'): return 'Weapon'
    if it.get('armor'): return 'Armor'
    return 'Gear'

def convert_items(path, overlay=None, tables=None, book=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    # type-name map: from the file's itemType table if present, else the static fallback
    types = dict(_ITYPES)
    for e in d.get('itemType', []):
        ab, nm = e.get('abbreviation'), e.get('name')
        if ab and nm: types[ab] = nm
    props = {}
    for e in d.get('itemProperty', []):
        ab = e.get('abbreviation'); ent = e.get('entries') or [{}]
        nm = ent[0].get('name') if isinstance(ent[0], dict) else None
        if ab and nm: props[ab] = nm
    src = d.get('baseitem') if d.get('baseitem') else d.get('item', [])
    out = []
    keep = {id(e) for e in pick_sources(src, book)}
    for it in src:
        if id(it) not in keep: continue
        tcode = _abbr(it.get('type', ''))
        tname = types.get(tcode, tcode or ('Wondrous Item' if it.get('wondrous') else 'Item'))
        if it.get('wondrous'): tname = 'Wondrous Item'
        category = _coarse(tcode, it)
        bits = []
        weapon_data = None
        if it.get('weapon') or it.get('dmg1'):
            wc = (it.get('weaponCategory') or '').capitalize()
            kind = 'Melee Weapon' if tcode == 'M' else ('Ranged Weapon' if tcode == 'R' else '')
            if wc or kind: tname = (wc + ' ' + (kind or 'Weapon')).strip()
            dmg = it.get('dmg1', ''); dt = _DMG.get(it.get('dmgType', ''), it.get('dmgType', ''))
            if dmg:
                seg = 'Damage %s %s' % (dmg, dt)
                if it.get('dmg2'): seg += ' (Versatile %s)' % it['dmg2']
                bits.append(seg)
            if it.get('range'): bits.append('Range %s ft' % it['range'])
            pr = [props.get(_abbr(p), _abbr(p)) for p in (it.get('property') or [])]
            pr = [p for p in pr if p and p != 'None']
            if pr: bits.append('Properties: ' + ', '.join(pr))
            ms = [_abbr(m) for m in (it.get('mastery') or [])]
            if ms: bits.append('Mastery: ' + ', '.join(ms))
            kind = 'ranged' if tcode == 'R' else 'melee'
            finesse = 'Finesse' in pr
            ability = 'dex' if kind == 'ranged' else ('finesse' if finesse else 'str')
            nb = []
            if it.get('range'): nb.append('Range ' + it['range'])
            if it.get('dmg2'): nb.append('Versatile ' + it['dmg2'])
            pr_n = [p for p in pr if not (it.get('dmg2') and p == 'Versatile')]
            if pr_n: nb.append(', '.join(pr_n))
            if ms: nb.append('Mastery: ' + ', '.join(ms))
            weapon_data = {'kind': kind, 'dice': it.get('dmg1', ''),
                           'damageType': _DMG.get(it.get('dmgType', ''), it.get('dmgType', '')),
                           'ability': ability, 'notes': ' \u00b7 '.join(nb)}
            b = _ival(it.get('bonusWeapon') or it.get('bonusWeaponAttack') or 0)
            db = _ival(it.get('bonusWeapon') or it.get('bonusWeaponDamage') or 0)
            if b: weapon_data['atkMisc'] = b
            if db: weapon_data['dmgMisc'] = db
        elif it.get('armor') or tcode in ('LA', 'MA', 'HA', 'S'):
            ac = it.get('ac')
            if ac is not None:
                if tcode == 'S': bits.append('AC +%s (Shield)' % ac)
                elif tcode == 'LA': bits.append('AC %s + Dex modifier' % ac)
                elif tcode == 'MA': bits.append('AC %s + Dex modifier (max 2)' % ac)
                else: bits.append('AC %s' % ac)
            if it.get('strength'): bits.append('Requires Strength %s' % it['strength'])
            if it.get('stealth'): bits.append('Disadvantage on Stealth')
        if it.get('baseItem'): bits.append('Base item: ' + _abbr(it['baseItem']).title())
        with table_ctx(tables, it['name'], 'item'):
            prose = flatten(it.get('entries', [])) if it.get('entries') else ''
        mech = ' \u00b7 '.join(bits)
        desc = (mech + '. ' + prose).strip() if mech and prose else (mech or prose)
        # attunement
        ra = it.get('reqAttune')
        attune = bool(ra) and ra is not False
        rec = {'name': it['name'], 'system': _bk(book).system, 'category': category, 'type': tname.strip(),
               'rarity': _RAR.get(it.get('rarity', 'none'), (it.get('rarity') or 'Mundane').title()),
               'weight': it.get('weight', None), 'cost': _cost(it.get('value')),
               'attune': attune, 'attuneNote': (strip_tags(ra) if isinstance(ra, str) and ra not in ('optional',) else ''),
               'description': desc.strip(' \u00b7.'), 'effects': _item_effects(it)}
        rec = {k: v for k, v in rec.items() if v not in (None, '', False)}
        rec.setdefault('effects', [])
        if weapon_data: rec['weapon'] = weapon_data
        out.append(rec)
    return _pack(book, 'items', out, stem='items')

# ================================================================ BACKGROUNDS
def _titlecase_item(name):
    parts = name.replace('_', ' ').split(' ')
    return ' '.join((w[:1].upper() + w[1:]) if w else w for w in parts)

import re as _re_eq
_EQTYPE = {
    'weapon': 'a Weapon (your choice)', 'weaponSimple': 'a Simple weapon (your choice)',
    'weaponMartial': 'a Martial weapon (your choice)', 'armor': 'Armor (your choice)',
    'armorLight': 'Light Armor (your choice)', 'armorMedium': 'Medium Armor (your choice)',
    'armorHeavy': 'Heavy Armor (your choice)', 'shield': 'Shield',
    'instrument': 'a Musical Instrument (your choice)', 'instrumentMusical': 'a Musical Instrument (your choice)',
    'setGaming': 'a Gaming Set (your choice)', 'toolArtisan': "Artisan's Tools (your choice)",
    'toolArtisans': "Artisan's Tools (your choice)",
    'focusSpellcasting': 'a Spellcasting Focus (your choice)', 'focusArcane': 'an Arcane Focus (your choice)',
    'focusDruidic': 'a Druidic Focus (your choice)', 'focusHoly': 'a Holy Symbol (your choice)',
}
def _human_eqtype(et):
    if et in _EQTYPE:
        return _EQTYPE[et]
    words = _re_eq.sub(r'([a-z])([A-Z])', r'\1 \2', str(et)).split()
    return (' '.join(w.capitalize() for w in words) + ' (your choice)') if words else str(et)

def _equip_bundle(entries):
    """One package -> {items:[{name,qty?}], gold?}. Currency values are copper -> gp."""
    items, gold = [], 0.0
    for e in entries or []:
        if not isinstance(e, dict):
            continue
        if 'item' in e:
            nm = e.get('displayName') or _titlecase_item(str(e['item']).split('|')[0].strip())
            it = {'name': nm}
            if int(e.get('quantity', 1) or 1) != 1:
                it['qty'] = int(e['quantity'])
            items.append(it)
        elif 'special' in e:
            it = {'name': str(e['special']).strip()}
            if int(e.get('quantity', 1) or 1) != 1:
                it['qty'] = int(e['quantity'])
            items.append(it)
        elif 'equipmentType' in e:
            items.append({'name': _human_eqtype(e['equipmentType'])})
        elif 'value' in e:
            gold += float(e['value']) / 100.0
    bundle = {}
    if items:
        bundle['items'] = items
    if gold:
        bundle['gold'] = int(gold) if float(gold).is_integer() else round(gold, 2)
    return bundle

def _dice_avg_gold(expr):
    """Average gp for a class gold-alternative like '{@dice 5d4 × 10}'."""
    import re as _re
    s = strip_tags(str(expr)).replace('\u00d7', 'x').replace('*', 'x')
    m = _re.search(r'(\d+)d(\d+)\s*(?:x\s*(\d+))?', s, _re.I)
    if not m:
        return 0
    n, sides, mult = int(m.group(1)), int(m.group(2)), int(m.group(3) or 1)
    return int(round(n * (sides + 1) / 2.0 * mult))

def _equip_grants_bg(se):
    """5e-tools background startingEquipment -> equipmentGrants array."""
    if not se:
        return None
    out = []
    for elem in se:
        if not isinstance(elem, dict):
            continue
        if '_' in elem:
            b = _equip_bundle(elem['_'])
            if b:
                out.append(b)
        letters = sorted(k for k in elem.keys() if k != '_')
        if letters:
            opts = []
            for k in letters:
                b = _equip_bundle(elem[k])
                b['label'] = k.upper()
                opts.append(b)
            if opts:
                out.append({'choose': opts})
    return out or None

def _equip_grants_class(se):
    """5e-tools class startingEquipment -> equipmentGrants (items package vs gold alternative)."""
    if not se or not isinstance(se, dict):
        return None
    out = _equip_grants_bg(se.get('defaultData')) or []
    ga = se.get('goldAlternative')
    if ga:
        g = _dice_avg_gold(ga)
        if g:
            if out and 'choose' not in out[-1] and out[-1].get('items'):
                pkg = out.pop(); pkg['label'] = 'A'
                out.append({'choose': [pkg, {'label': 'B', 'gold': g}]})
            else:
                out.append({'choose': [{'label': 'B', 'gold': g}]})
    return out or None

def convert_backgrounds(path, overlay=None, tables=None, book=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    bk = _bk(book)
    # Backgrounds get NO basicRules backfill — that flag names the free subset and
    # once cost us 12 of the 16 XPHB backgrounds. Source is the whole filter.
    codes = set(bk.codes) or {'XPHB'}
    chosen = [b for b in d.get('background', []) if b.get('source') in codes]
    out = []
    for b in chosen:
        rec = {'name': b['name'], 'system': bk.system}
        ab = b.get('ability', [])
        if ab:
            fr = ab[0].get('choose', {}).get('weighted', {}).get('from', [])
            if fr:
                rec['abilityScores'] = fr
        labels = {}
        with table_ctx(tables, b['name'], 'background'):
            for ent in b.get('entries', []):
                if isinstance(ent, dict) and ent.get('type') == 'list':
                    for it in ent.get('items', []):
                        key = (it.get('name') or '').rstrip(':').strip().lower()
                        labels[key] = strip_tags(flatten([it.get('entry', '')]))
        for k, v in labels.items():
            if k.startswith('feat'):
                rec['feat'] = v
            elif k.startswith('skill'):
                rec['skills'] = [x.strip() for x in v.split(',') if x.strip()]
            elif k.startswith('tool'):
                rec['tools'] = v
            elif k.startswith('equipment'):
                rec['equipment'] = v
        eg = _equip_grants_bg(b.get('startingEquipment'))
        if eg:
            rec['equipmentGrants'] = eg
        rec['description'] = ''
        out.append(rec)
    return _pack(book, 'backgrounds', out, stem='backgrounds')

# ================================================================ FEATS
def _render_prereq(pr, legacy=False):
    """`legacy` adds the prerequisite shapes 2014-era books use. Both of the extra
    branches are gated rather than merely "verified harmless": `race` never occurs
    in the 2024 run (0 of 77 feats) but `proficiency` does (5 of 77) and is not
    rendered today, so rendering it unconditionally would move data/5e2024/."""
    if not pr: return ''
    alts = []
    for block in pr:
        parts = []
        if 'level' in block: parts.append(f"Level {block['level']}+")
        if legacy and block.get('race'):
            races = []
            for r in block['race']:
                nm = (r.get('name') or '').title()
                if r.get('subrace'): nm += f" ({str(r['subrace']).title()})"
                if nm: races.append(nm)
            if races: parts.append(' or '.join(races))
        if 'feature' in block: parts.append(', '.join(block['feature']) + ' feature')
        if block.get('spellcasting2020') or block.get('spellcastingFeature'): parts.append('Spellcasting feature')
        for a in block.get('ability', []):
            for k, v in a.items(): parts.append(f"{ABIL_FULL.get(k, k)} {v}+")
        if legacy and block.get('proficiency'):
            for p in block['proficiency']:
                for k, v in p.items(): parts.append(f"{str(v).title()} {k}")
        if 'other' in block: parts.append(strip_tags(block['other']))
        if parts: alts.append(' and '.join(parts))
    return ' or '.join(alts)

def convert_feats(path, overlay=None, tables=None, book=None, **_):
    overlay = overlay or {}
    d = json.load(open(path, encoding='utf-8'))
    chosen = pick_sources(d.get('feat', []), book)
    out = []
    for f in chosen:
        lead = CAT_LABEL.get(f.get('category'), '')
        pr = _render_prereq(f.get('prerequisite'), legacy=not _bk(book).is_default)
        if pr: lead = (lead + ' · ' if lead else '') + 'Prerequisite: ' + pr
        with table_ctx(tables, f['name'], 'feat'):
            body = flatten(f.get('entries', []))
        if f.get('repeatable') and 'more than once' not in body:
            body = (body + '\n' if body else '') + 'Repeatable: You can take this feat more than once.'
        rec = {'name': f['name'], 'description': ((lead + '\n' if lead else '') + body).strip()}
        apply_overlay(f['name'], rec, overlay)
        out.append(rec)
    return _pack(book, 'feats', out, stem='feats')

# ================================================================ SPELLS
def _cast_time(s):
    t = (s.get('time') or [{}])[0]
    n = t.get('number', 1); unit = t.get('unit', 'action')
    if unit == 'bonus': base = f"{n} bonus action"
    elif unit in ('minute', 'hour', 'round', 'day'): base = f"{n} {unit}" + ('s' if n != 1 else '')
    else: base = f"{n} {unit}"
    if unit == 'reaction' and t.get('condition'): base += f" ({strip_tags(t['condition'])})"
    if s.get('meta', {}).get('ritual'): base += " (ritual)"
    return base

def _range(s):
    r = s.get('range', {}); rt = r.get('type'); dist = r.get('distance', {}) or {}
    if rt == 'point':
        dt = dist.get('type')
        if dt == 'touch': return 'Touch'
        if dt == 'self': return 'Self'
        if dt == 'sight': return 'Sight'
        if dt == 'unlimited': return 'Unlimited'
        if dt in ('feet', 'miles', 'mile'): return f"{dist.get('amount')} {dt}"
        return 'Special'
    if rt in SHAPE: return f"Self ({dist.get('amount')}-foot {SHAPE[rt]})"
    if rt == 'special': return 'Special'
    return 'Self'

def _components(s):
    c = s.get('components', {}); return ', '.join(x for x, k in [('V','v'),('S','s'),('M','m')] if c.get(k))

def _duration(s):
    dd = (s.get('duration') or [{}])[0]; t = dd.get('type')
    if t == 'instant': return 'Instantaneous'
    if t == 'permanent': return 'Until dispelled'
    if t == 'special': return 'Special'
    if t == 'timed':
        du = dd.get('duration', {}); amt = du.get('amount'); unit = du.get('type', '')
        base = f"{amt} {unit}" + ('s' if amt != 1 else '')
        return ('Concentration, up to ' + base) if dd.get('concentration') else base
    return 'Special'

def _material(s):
    m = s.get('components', {}).get('m')
    if isinstance(m, str): return m
    if isinstance(m, dict): return m.get('text')
    return None

def convert_spells(path, sources=None, tables=None, book=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    bk = _bk(book)
    if bk.is_default:
        chosen = [s for s in d.get('spell', []) if s.get('source') == 'XPHB'] \
                 or pick_2024_preferred(d.get('spell', []))
    else:
        chosen = pick_sources(d.get('spell', []), book)
    classmap = {}
    if sources:
        srcdata = json.load(open(sources, encoding='utf-8'))
        # merge every book's spell->class map; keep 2024 sources (XPHB + EFA = 2024
        # Artificer).
        #
        # A supplement needs two widenings, both gated so the 2024 run cannot move.
        # sources.json records a 2014 book's spells under `classVariant`, not
        # `class`: reading only `class` gives XGE 0 of 95 class tags and TCE 7 of
        # 21 — a pack that looks complete until someone ticks "only my class" and
        # sees nothing. And the class list for those spells is filed under PHB/TCE,
        # so those sources come in too. The class NAMES are the same 2024 strings
        # either way (verified: no 2014-only class appears), which is the point —
        # a supplement's spells must name classes the player has on their sheet.
        keys = ('class',) if bk.is_default else ('class', 'classVariant')
        want = ('XPHB', 'EFA') if bk.is_default else ('XPHB', 'EFA', 'PHB', 'TCE')
        for _srcbook, spells in srcdata.items():
            for spname, info in spells.items():
                names = sorted({c['name'] for k in keys for c in info.get(k, [])
                                if c.get('source') in want})
                if names:
                    classmap.setdefault(spname, set()).update(names)
    out = []
    for s in chosen:
        meta = ' · '.join(x for x in [SCHOOL.get(s.get('school'), ''), _cast_time(s), _range(s), _components(s), _duration(s)] if x)
        with table_ctx(tables, s['name'], 'spell'):
            text = flatten(s.get('entries', []))
            mt = _material(s)
            if mt: text += f"\nMaterial: {strip_tags(mt)}."
            hi = flatten(s.get('entriesHigherLevel', []))
            if hi: text += "\n" + hi
        rec = {'name': s['name'], 'level': s['level'], 'meta': meta, 'text': text.strip()}
        cls = classmap.get(s['name'])
        if cls: rec['class'] = sorted(cls)
        out.append(rec)
    out.sort(key=lambda x: (x['level'], x['name']))
    return _pack(book, 'spells', out, stem='spells')

# ================================================================ CLASSES
def _spell_notes(entry):
    """Best-effort: read the class table for cantrips / prepared / spells-known
    counts and emit a spells note at each level the count increases."""
    notes = {}
    try:
        for grp in entry.get('classTableGroups', []):
            labels = grp.get('colLabels', [])
            rows = grp.get('rows')
            if not rows:
                continue
            for ci, lab in enumerate(labels):
                l = strip_tags(str(lab)).lower()
                if not any(w in l for w in ('cantrip', 'prepared spell', 'spells known', 'spells prepared')):
                    continue
                nice = strip_tags(str(lab))
                last = 0
                for lvl_i, row in enumerate(rows, start=1):
                    if ci >= len(row):
                        continue
                    cell = row[ci]
                    val = cell if isinstance(cell, int) else (int(cell) if isinstance(cell, str) and cell.isdigit() else None)
                    if val is None:
                        continue
                    if val > last:
                        notes.setdefault(lvl_i, []).append(f"{nice}: {val}")
                        last = val
    except Exception:
        return {}
    return {lvl: {'note': "You can now have " + "; ".join(v) + "."} for lvl, v in notes.items()}

_SPELL_SLOT_COLS = ('cantrip', 'prepared spell', 'spells known', 'spells prepared',
                    '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th')

def _class_tables(entry, owner, kind, sink):
    """Turn a class/subclass 'classTableGroups' into one Level-indexed table.

    _spell_notes() only reads the cantrip/prepared-spell columns; every other
    column (Rage Damage, Weapon Mastery, Bardic Die, Sneak Attack, ...) was being
    dropped on the floor. This keeps the lot as a reference table.

    Spell-slot columns are skipped: the app already computes slots by level and a
    10-column slot grid would swamp the useful columns on a phone."""
    groups = entry.get('classTableGroups') or []
    cols, colvals = [], []
    nrows = 0
    for grp in groups:
        labels = grp.get('colLabels') or []
        rows = grp.get('rows') or []
        if not rows:
            continue
        if 'spell slot' in str(grp.get('title') or '').lower():
            continue                    # the app computes slots by level already
        nrows = max(nrows, len(rows))
        for ci, lab in enumerate(labels):
            nice = strip_tags(str(lab))
            if not nice:
                continue
            low = nice.lower()
            if any(w in low for w in _SPELL_SLOT_COLS) and len(nice) <= 16:
                continue
            cols.append(nice)
            colvals.append([_cell_text(r[ci]) if ci < len(r) else '' for r in rows])
    if not cols or not nrows:
        return None
    rows = []
    for i in range(nrows):
        rows.append([str(i + 1)] + [(v[i] if i < len(v) else '') for v in colvals])
    if not any(any(c for c in r[1:]) for r in rows):
        return None                     # nothing but the level column — not worth a table
    node = {'colLabels': ['Level'] + cols,
            'colStyles': ['text-center'] * (len(cols) + 1),
            'rows': rows}
    tbl = _norm_table(node, name='%s Features' % owner, owner=owner, kind=kind)
    if tbl:
        _register(tbl, sink)
    return tbl

def _ref_str(ref):
    return ref.get('classFeature') if isinstance(ref, dict) else ref

def convert_classes(paths, overlay=None, include_legacy=False, spell_notes=True, resources=None,
                    tables=None, book=None, only=None, **_):
    overlay = overlay or {}
    resources = resources or {}
    bk = _bk(book)
    # Which printing of a class to take. The default is unchanged (2024, then the
    # 2014 PHB, then whatever the file holds); a supplement asks for its own.
    prefer = list(bk.codes) or ['XPHB', 'PHB']
    only = {str(n).lower() for n in (only or ())}
    out_classes = []
    warnings = []
    for path in paths:
        d = json.load(open(path, encoding='utf-8'))
        cls = d.get('class', [])
        entry = None
        for want in prefer:
            entry = next((c for c in cls if c.get('source') == want), None)
            if entry:
                break
        if entry is None and bk.is_default:
            entry = cls[0] if cls else None
        if not entry:
            continue
        # A supplement converts only the classes it actually prints.
        if only and entry['name'].lower() not in only:
            continue
        # TCE "sidekick" classes have hd: null. Skip them with a note rather than
        # dying on entry['hd']['faces'] and taking every other class down too.
        if not isinstance(entry.get('hd'), dict) or not entry['hd'].get('faces'):
            warnings.append(f"{entry.get('name', path)}: no hit die — skipped (not a player class)")
            continue
        src = entry['source']
        if bk.is_default and src != 'XPHB':
            warnings.append(f"{entry['name']}: no XPHB version, used {src}")

        cfidx = {(cf['name'].lower(), cf['source'], int(cf['level']), cf['className'].lower()): cf
                 for cf in d.get('classFeature', [])}
        sfidx = {(sf['name'].lower(), sf['source'], int(sf['level']), sf.get('subclassShortName', '').lower()): sf
                 for sf in d.get('subclassFeature', [])}

        def _resolve_ref(node):
            """A feature's entries may reference a sibling feature instead of
            embedding it. Resolve so flatten() can inline it — otherwise the
            whole referenced feature (and any table in it) is lost."""
            try:
                if node.get('type') == 'refClassFeature':
                    p = str(node.get('classFeature') or '').split('|')
                    # name|className|classSource|level
                    return cfidx.get((p[0].lower(), p[2] or src, int(p[3]), p[1].lower()))
                p = str(node.get('subclassFeature') or '').split('|')
                # name|className|classSource|subclassShortName|subclassSource|level
                return sfidx.get((p[0].lower(), p[4] or src, int(p[5]), p[3].lower()))
            except (IndexError, ValueError):
                return None

        C = {'name': entry['name'], 'description': CLASS_BLURB.get(entry['name'], ''),
             'hitDie': 'd' + str(entry['hd']['faces'])}
        if entry.get('proficiency'): C['savingThrows'] = entry['proficiency']
        if entry.get('spellcastingAbility'): C['spellcasting'] = entry['spellcastingAbility']

        levels = {}
        def L(n): return levels.setdefault(int(n), {})
        def addtrait(n, t): L(n).setdefault('traits', []).append(t)
        def addchoice(n, c): L(n).setdefault('choices', []).append(c)

        fixedskills = []
        for item in entry.get('startingProficiencies', {}).get('skills', []):
            if isinstance(item, dict) and 'choose' in item:
                ch = item['choose']
                addchoice(1, {'type': 'skill', 'choose': ch.get('count', 1), 'from': [sk(x) for x in ch.get('from', [])]})
            elif isinstance(item, str):
                fixedskills.append(sk(item))
        if fixedskills: C['skills'] = fixedskills
        eg = _equip_grants_class(entry.get('startingEquipment'))
        if eg:
            C['equipmentGrants'] = eg

        sub_level = None; sub_title = entry.get('subclassTitle', 'Subclass')
        for ref in entry.get('classFeatures', []):
            if isinstance(ref, dict) and ref.get('gainSubclassFeature'):
                lv2 = int(_ref_str(ref).split('|')[3])
                sub_level = lv2 if sub_level is None else min(sub_level, lv2)
                continue
            parts = _ref_str(ref).split('|')
            name = parts[0]; fsrc = parts[2] if len(parts) > 2 and parts[2] else src
            lvl = int(parts[3]); cn = parts[1]
            if name == 'Ability Score Improvement':
                addchoice(lvl, {'type': 'asi'}); continue
            # FIGHTING_STYLES is the 2024 menu, wording and all. Substituting it into
            # a 2014-era class would print 2024 text where that book's own list
            # belongs — and it would read perfectly, which is what makes it dangerous.
            if name == 'Fighting Style' and bk.is_default:
                fs = [apply_overlay(o['name'], dict(o), overlay) for o in (dict(x) for x in FIGHTING_STYLES)]
                addchoice(lvl, {'type': 'option', 'label': 'Choose a Fighting Style', 'choose': 1, 'from': fs}); continue
            cf = cfidx.get((name.lower(), fsrc, lvl, cn.lower())) or cfidx.get((name.lower(), src, lvl, cn.lower()))
            if not cf: continue
            with table_ctx(tables, entry['name'], 'class'), ref_ctx(_resolve_ref):
                addtrait(lvl, {'name': name, 'description': flatten(cf.get('entries', []))})
        if sub_level:
            addchoice(sub_level, {'type': 'subclass', 'label': sub_title})

        if spell_notes and C.get('spellcasting'):
            for lvl, note in _spell_notes(entry).items():
                L(lvl).setdefault('spells', {}).update(note)
        # the full level-progression table, including the numeric columns
        # _spell_notes() ignores (Rage Damage, Weapon Mastery, Bardic Die, ...)
        if tables is not None:
            _class_tables(entry, entry['name'], 'class', tables)

        C['levels'] = {str(k): levels[k] for k in sorted(levels)}

        subs = {}
        for sc in d.get('subclass', []):
            if sc.get('className') != entry['name']:
                continue
            if not include_legacy and (sc.get('source') != src or sc.get('classSource') != src):
                continue
            SD = {}
            if sc.get('spellcastingAbility'): SD['spellcasting'] = sc['spellcastingAbility']
            featlist = []
            for ref in sc.get('subclassFeatures', []):
                parts = _ref_str(ref).split('|')
                nm = parts[0]; subsrc = parts[4] if len(parts) > 4 else src
                lvl = int(parts[5]); subshort = parts[3]
                sf = sfidx.get((nm.lower(), subsrc, lvl, subshort.lower()))
                if sf: featlist.append((lvl, nm, sf))
            featlist.sort(key=lambda x: x[0])
            slevels = {}; desc = ''
            for lvl, nm, sf in featlist:
                with table_ctx(tables, sc['name'], 'subclass'), ref_ctx(_resolve_ref):
                    slevels.setdefault(lvl, {}).setdefault('traits', []).append(
                        {'name': nm, 'description': flatten(sf.get('entries', []))})
                if not desc:
                    for e in sf.get('entries', []):
                        if isinstance(e, str) and len(strip_tags(e)) > 40:
                            desc = strip_tags(e); break
            SD['description'] = desc
            SD['levels'] = {str(k): slevels[k] for k in sorted(slevels)}
            if tables is not None:
                _class_tables(sc, sc['name'], 'subclass', tables)
            subs[sc['name']] = SD
        if subs: C['subclasses'] = subs
        if C['name'] in resources: C['resources'] = resources[C['name']]
        out_classes.append(C)

    for w in warnings:
        print('  note:', w, file=sys.stderr)
    return _pack(book, 'classes', out_classes, stem='classes', version=1)

# ================================================================ SUBCLASSES (standalone)
def _sub_ref_str(ref):
    """subclassFeatures entries are usually plain strings, occasionally a wrapper
    dict. _ref_str() only knows the classFeature key, and returning None here
    would drop the feature silently."""
    if isinstance(ref, dict):
        return ref.get('subclassFeature') or ref.get('classFeature')
    return ref

def _subclass_levels(sc, sfidx, resolver, tables, src):
    """Shared with convert_classes' nested build: features by level, plus the
    first substantial prose line as the description."""
    featlist = []
    for ref in sc.get('subclassFeatures', []):
        parts = str(_sub_ref_str(ref) or '').split('|')
        if len(parts) < 6:
            continue
        # name|className|classSource|subclassShortName|subclassSource|level[|featureSource]
        # A 7th part names the feature's OWN source and overrides the 5th — five
        # XGE/TCE features are printed in a different book from their subclass.
        nm = parts[0]
        subsrc = (parts[6] if len(parts) > 6 and parts[6].strip() else parts[4]) or src
        try:
            lvl = int(parts[5])
        except ValueError:
            continue
        sf = sfidx.get((nm.lower(), subsrc, lvl, parts[3].lower())) \
            or sfidx.get((nm.lower(), parts[4] or src, lvl, parts[3].lower()))
        if sf:
            featlist.append((lvl, nm, sf))
    featlist.sort(key=lambda x: x[0])
    slevels, desc = {}, ''
    for lvl, nm, sf in featlist:
        with table_ctx(tables, sc['name'], 'subclass'), ref_ctx(resolver):
            slevels.setdefault(lvl, {}).setdefault('traits', []).append(
                {'name': nm, 'description': flatten(sf.get('entries', []))})
        if not desc:
            for e in sf.get('entries', []):
                if isinstance(e, str) and len(strip_tags(e)) > 40:
                    desc = strip_tags(e); break
    return slevels, desc

def convert_subclasses(paths, book=None, tables=None, skip_classes=(), **_):
    """Subclasses a supplement adds to classes the player already has, as
    standalone `subclasses` records that attach by class name (schema §6.5).

    THE TRAP: 5e-tools carries every XGE/TCE subclass TWICE — 122 records for 61
    real subclasses. The duplicate is a 5e-tools `_copy` STUB (classSource XPHB,
    or EFA for the Artificer) which inherits from the original and, in 35 of the
    57 cases, carries no `subclassFeatures` of its own at all.

    So the filter is `'_copy' not in sc`, NOT a (className, name) dedupe keeping
    the newest classSource. Keeping the stub yields a subclass with `levels: {}`
    — valid JSON, correct entry count, and no features. Preferring classSource
    "XPHB" here would have shipped 26 subclasses out of 61 and reported 26 as if
    that were the whole book.

    `className` is the plain class name on both records, so taking the original
    still attaches it to the 2024 class the player has.
    """
    bk = _bk(book)
    codes = set(bk.codes)
    skip = {str(c).lower() for c in skip_classes}
    picked, files = [], []
    for path in paths:
        d = json.load(open(path, encoding='utf-8'))
        fi = len(files); files.append(d)
        for sc in d.get('subclass', []):
            if codes and sc.get('source') not in codes:
                continue
            if '_copy' in sc:
                continue
            cn = sc.get('className') or ''
            if cn.lower() in skip or not sc.get('name'):
                continue
            picked.append((sc, fi))

    out, empty = [], []
    for sc, fi in picked:
        d = files[fi]
        src = sc.get('classSource') or sc.get('source')
        sfidx = {(sf['name'].lower(), sf['source'], int(sf['level']), sf.get('subclassShortName', '').lower()): sf
                 for sf in d.get('subclassFeature', [])}
        cfidx = {(cf['name'].lower(), cf['source'], int(cf['level']), cf['className'].lower()): cf
                 for cf in d.get('classFeature', [])}

        def _resolve_ref(node, _sfidx=sfidx, _cfidx=cfidx, _src=src):
            try:
                if node.get('type') == 'refClassFeature':
                    p = str(node.get('classFeature') or '').split('|')
                    return _cfidx.get((p[0].lower(), p[2] or _src, int(p[3]), p[1].lower()))
                p = str(node.get('subclassFeature') or '').split('|')
                return _sfidx.get((p[0].lower(), p[4] or _src, int(p[5]), p[3].lower()))
            except (IndexError, ValueError):
                return None

        slevels, desc = _subclass_levels(sc, sfidx, _resolve_ref, tables, src)
        if not slevels:
            # Never drop one quietly — a featureless subclass means the ref format
            # changed, and silence is how 35 empty stubs would have looked fine.
            empty.append('%s (%s)' % (sc['name'], sc['className']))
            continue
        rec = {'class': sc['className'], 'name': sc['name'], 'description': desc}
        if sc.get('spellcastingAbility'):
            rec['spellcasting'] = sc['spellcastingAbility']
        rec['levels'] = {str(k): slevels[k] for k in sorted(slevels)}
        if tables is not None:
            _class_tables(sc, sc['name'], 'subclass', tables)
        out.append(rec)
    if empty:
        print('  WARNING: %d subclass(es) resolved no features: %s'
              % (len(empty), ', '.join(sorted(empty))), file=sys.stderr)
    out.sort(key=lambda x: (x['class'], x['name']))
    return _pack(book, 'subclasses', out, stem='subclasses', version=1)

# ================================================================ OPTIONAL FEATURES
# Invocations, metamagic, infusions, maneuvers, runes, fighting styles, arcane
# shots. The app has no dedicated category for these and doesn't need one: they
# are standalone `features` (displayed as "Traits", schema §6.9), pickable from
# the rules-pack library, with `source` naming what kind of option they are.
_OFT_FAMILY = {
    'AS': 'Arcane Shot', 'EI': 'Eldritch Invocation', 'AI': 'Artificer Infusion',
    'MM': 'Metamagic', 'MV:B': 'Battle Master Maneuver', 'MV': 'Maneuver',
    'RN': 'Rune', 'PB': 'Pact Boon', 'OI': 'Onomancy Resonant',
    'SHP:H': 'Ship Upgrade', 'IWM:W': 'Infernal War Machine Upgrade',
    'OFS': 'Optional Class Feature',
}
_FS_CLASS = {'F': 'Fighter', 'P': 'Paladin', 'R': 'Ranger', 'B': 'Bard'}

def _oft_label(codes):
    """One readable kind-label for a record's featureType codes. Fighting styles
    carry one code per class that can take them, so they collapse into a single
    'Fighting Style (Fighter, Paladin, Ranger)' rather than three labels."""
    codes = [str(c) for c in (codes or [])]
    fs = [_FS_CLASS.get(c.split(':', 1)[1], c.split(':', 1)[1])
          for c in codes if c.startswith('FS:') and ':' in c]
    rest, seen = [], set()
    for c in codes:
        if c.startswith('FS:'):
            continue
        lab = _OFT_FAMILY.get(c, c)
        if lab not in seen:
            seen.add(lab); rest.append(lab)
    if fs:
        rest.insert(0, 'Fighting Style (%s)' % ', '.join(fs))
    return ' · '.join(rest)

def _render_optfeat_prereq(pr):
    """Optional features use their own prerequisite shapes — notably `level` is a
    dict here ({level, class, subclass}), where _render_prereq expects an int and
    would print the raw dict into the description."""
    if not pr: return ''
    alts = []
    for block in pr:
        parts = []
        lv = block.get('level')
        if isinstance(lv, dict):
            bit = 'Level %s' % lv.get('level')
            cn = (lv.get('class') or {}).get('name')
            if cn: bit += ' ' + cn
            sn = (lv.get('subclass') or {}).get('name')
            if sn: bit += ' (%s)' % sn
            parts.append(bit)
        elif lv is not None:
            parts.append('Level %s+' % lv)
        if block.get('pact'):
            parts.append('Pact of the %s' % block['pact'])
        for s in block.get('spell') or []:
            nm = str(s).split('#')
            parts.append(nm[0].title() + (' cantrip' if len(nm) > 1 and nm[1] == 'c' else ' spell'))
        for it in block.get('item') or []:
            parts.append(strip_tags(str(it)))
        if block.get('feature'):
            parts.append(', '.join(block['feature']) + ' feature')
        for a in block.get('ability', []):
            for k, v in a.items(): parts.append('%s %s+' % (ABIL_FULL.get(k, k), v))
        if block.get('other'):
            parts.append(strip_tags(block['other']))
        if parts: alts.append(' and '.join(parts))
    return ' or '.join(alts)

def convert_optional_features(path, book=None, tables=None, overlay=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    chosen = pick_sources(d.get('optionalfeature', []), book)
    out = []
    for f in chosen:
        pr = _render_optfeat_prereq(f.get('prerequisite'))
        with table_ctx(tables, f['name'], 'feat'):
            body = flatten(f.get('entries', []))
        lead = ('Prerequisite: ' + pr) if pr else ''
        rec = {'name': f['name'], 'source': _oft_label(f.get('featureType')),
               'description': ((lead + '\n' if lead else '') + body).strip()}
        apply_overlay(f['name'], rec, overlay or {})
        out.append(rec)
    out.sort(key=lambda x: (x['source'], x['name']))
    return out

def convert_class_features(paths, book=None, tables=None, skip_classes=(), **_):
    """Tasha's "Optional Class Features" — per-class additions and replacements
    that live as `classFeature` records, NOT in optionalfeatures.json.

    Names repeat across classes (three classes print "Martial Versatility", the
    Ranger prints "Deft Explorer Improvement" at two levels). `features` merge on
    name within a source, so an unqualified name silently swallows its twins:
    every record is prefixed with its class, and a still-colliding name takes its
    level as well."""
    bk = _bk(book)
    codes = set(bk.codes)
    skip = {str(c).lower() for c in skip_classes}
    picked = []
    for path in paths:
        d = json.load(open(path, encoding='utf-8'))
        # A class this book DEFINES gets its features through convert_classes as a
        # normal level progression. Only additions to other people's classes are
        # optional features — one rule that drops the Artificer's 22 and the
        # sidekicks' 47 without naming either.
        own = {c['name'].lower() for c in d.get('class', []) if not codes or c.get('source') in codes}
        for cf in d.get('classFeature', []):
            if codes and cf.get('source') not in codes:
                continue
            cn = cf.get('className') or ''
            if not cn or cn.lower() in own or cn.lower() in skip:
                continue
            picked.append(cf)

    # Disambiguate across the WHOLE colliding group, not as we go: appending the
    # level only to the second arrival leaves one bare name and one qualified one,
    # which reads as if they were different kinds of thing.
    counts = collections.Counter('%s: %s' % (cf['className'], cf['name']) for cf in picked)
    out = []
    for cf in picked:
        nm = '%s: %s' % (cf['className'], cf['name'])
        if counts[nm] > 1:
            nm = '%s (Level %s)' % (nm, cf.get('level'))
        with table_ctx(tables, cf['name'], 'class'):
            body = flatten(cf.get('entries', []))
        out.append({'name': nm, 'source': '%s (Optional Class Feature)' % cf['className'],
                    'description': ('Level %s.\n' % cf.get('level') + body).strip()})
    out.sort(key=lambda x: (x['source'], x['name']))
    return out

# ================================================================ RACES
def _race_speed(sp):
    """5e-tools speed is an int, or a dict of movement modes."""
    if isinstance(sp, (int, float)):
        return '%d ft' % int(sp)
    if isinstance(sp, dict):
        walk = sp.get('walk')
        bits = ['%d ft' % int(walk)] if isinstance(walk, (int, float)) else []
        for mode in ('fly', 'swim', 'climb', 'burrow'):
            v = sp.get(mode)
            if v is True:
                bits.append('%s equal to walking speed' % mode)
            elif isinstance(v, (int, float)):
                bits.append('%s %d ft' % (mode, int(v)))
        return ', '.join(bits)
    return ''

_SIZE_NAMES = {'T': 'Tiny', 'S': 'Small', 'M': 'Medium',
               'L': 'Large', 'H': 'Huge', 'G': 'Gargantuan'}

def _race_size(sz):
    """5e-tools size is a list of single-letter codes, occasionally a bare string.

    -> '' | 'Medium' | ['Small', 'Medium'].  A species offering a choice keeps
    both, because the app displays the choice and only settles on one (the
    largest) when it needs a carrying capacity.  'V' (Varies) is dropped: it
    names no size, and a wrong size is worse than none.
    """
    if not sz:
        return ''
    codes = sz if isinstance(sz, list) else [sz]
    names = [_SIZE_NAMES[c] for c in codes
             if isinstance(c, str) and c in _SIZE_NAMES]
    if not names:
        return ''
    return names[0] if len(names) == 1 else names

def _race_skills(sp):
    """-> (fixed skill names, choice blocks). The app supports both (52-race.js)."""
    fixed, choices = [], []
    for block in sp or []:
        if not isinstance(block, dict):
            continue
        for k, v in block.items():
            if k == 'choose' and isinstance(v, dict):
                frm = [sk(x) for x in v.get('from', [])]
                if frm:
                    choices.append({'type': 'skill', 'choose': int(v.get('count', 1)), 'from': frm})
            elif k == 'any':
                choices.append({'type': 'skill', 'choose': int(v), 'from': sorted(SKMAP.values())})
            elif v is True:
                fixed.append(sk(k))
    return fixed, choices

_LINEAGE_WORDS = (' Lineage', ' Ancestry', ' Legacy')

def _version_subraces(entry):
    """2024 lineages live in `_versions` ("Elf; Drow Lineage"). Each carries a
    `_mod` that swaps the generic lineage trait for the specific one."""
    out = []
    for v in entry.get('_versions') or []:
        nm = v.get('name')
        if not nm:
            continue                    # Dragonborn: an _abstract template, no usable name
        short = nm.split(';', 1)[1].strip() if ';' in nm else nm.strip()
        for w in _LINEAGE_WORDS:
            if short.endswith(w):
                short = short[: -len(w)].strip()
                break
        if not short:
            continue
        mods = (v.get('_mod') or {}).get('entries')
        mods = mods if isinstance(mods, list) else ([mods] if mods else [])
        traits = []
        for m in mods:
            if not isinstance(m, dict) or m.get('mode') != 'replaceArr':
                continue
            items = m.get('items')
            for it in (items if isinstance(items, list) else [items]):
                if isinstance(it, dict) and it.get('entries'):
                    traits.append({'name': strip_tags(str(it.get('name') or short)),
                                   'description': flatten(it['entries'])})
        sub = {'name': short}
        if traits:
            sub['description'] = traits[0]['description']
            sub['traits'] = traits
        out.append(sub)
    return out

def _table_subraces(entry, tables):
    """Fallback for Dragonborn, whose lineages exist only as a table (its
    `_versions` entry is an unnamed template). Build the pick from the table's
    first column so the damage type stays a real choice, not prose."""
    for e in entry.get('entries', []):
        if not isinstance(e, dict):
            continue
        for node in e.get('entries', []) or []:
            if not (isinstance(node, dict) and node.get('type') == 'table'):
                continue
            tbl = _norm_table(node)
            if not tbl or len(tbl['cols']) < 2:
                continue
            rest = tbl['cols'][1:]
            subs = []
            for row in tbl['rows']:
                nm = row[0].strip()
                if not nm:
                    continue
                desc = '; '.join('%s: %s' % (c, row[i + 1])
                                 for i, c in enumerate(rest) if i + 1 < len(row) and row[i + 1])
                subs.append({'name': nm, 'description': desc})
            if subs:
                return subs
    return []

def convert_races(path, overlay=None, tables=None, book=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    chosen = pick_sources(d.get('race', []), book)
    bysub = {}
    for s in d.get('subrace', []):
        bysub.setdefault(s.get('raceName'), []).append(s)
    out = []
    for r in chosen:
        rec = {'name': r['name'], 'system': _bk(book).system}
        sz = _race_size(r.get('size'))
        if sz: rec['size'] = sz
        sp = _race_speed(r.get('speed'))
        if sp: rec['speed'] = sp
        fixed, choices = _race_skills(r.get('skillProficiencies'))
        if fixed: rec['skills'] = fixed
        if choices: rec['choices'] = choices
        traits, desc = [], ''
        with table_ctx(tables, r['name'], 'race'):
            for e in r.get('entries', []):
                if isinstance(e, str):
                    if not desc and len(strip_tags(e)) > 40:
                        desc = strip_tags(e)
                elif isinstance(e, dict) and e.get('name'):
                    traits.append({'name': strip_tags(str(e['name'])),
                                   'description': flatten(e.get('entries', []))})
            subs = _version_subraces(r) or _table_subraces(r, tables)
        # explicit 2014-style subrace records, if this source has any
        for s in bysub.get(r['name'], []):
            if s.get('source') != r.get('source') or not s.get('name'):
                continue
            with table_ctx(tables, r['name'], 'race'):
                subs.append({'name': s['name'],
                             'traits': [{'name': strip_tags(str(x.get('name') or s['name'])),
                                         'description': flatten(x.get('entries', []))}
                                        for x in s.get('entries', []) if isinstance(x, dict) and x.get('name')]})
        rec['description'] = desc
        if traits: rec['traits'] = traits
        if subs: rec['subraces'] = subs
        apply_overlay(r['name'], rec, overlay or {})
        out.append(rec)
    out.sort(key=lambda x: x['name'])
    return _pack(book, 'races', out, stem='races', version=1)

# ================================================================ CLI
def _write(obj, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write('\n')          # .editorconfig: every file ends in a newline
    residual = open(path, encoding='utf-8').read().count('{@')
    n = len(obj.get('keywords') or obj.get('feats') or obj.get('spells') or obj.get('classes')
            or obj.get('items') or obj.get('backgrounds') or obj.get('races')
            or obj.get('subclasses') or obj.get('features') or obj.get('tables') or [])
    print(f"  wrote {path}  ({n} entries{', ' + str(residual) + ' unresolved tags!' if residual else ''})")

def _write_tables(tables, path, book=None):
    if not tables:
        print("  no tables found — nothing written to " + path)
        return
    tables.sort(key=lambda t: (t.get('ownerKind', ''), t['name']))
    _write(_pack(book, 'tables', tables, stem='tables', version=1), path)

_SUPP_WORDS = {'glossary': 'Rules', 'items': 'Magic Items', 'feats': 'Feats',
               'races': 'Species', 'spells': 'Spells', 'classes': 'Classes',
               'subclasses': 'Subclasses', 'features': 'Options', 'tables': 'Tables'}

_EDITION_NOTE = (
    "%s is 2014-era D&D content, converted as published for use alongside the 2024 rules. "
    "Subclass features are listed at their 2014 levels (a 2024 character picks a subclass at "
    "level 3 and gains any earlier features at once), and the prose cites 2014 class features "
    "and terminology. Where the 2024 Player's Handbook reprinted a subclass, both versions are "
    "offered and this one is tagged with its pack. %sNothing here has been rewritten to match "
    "the 2024 rules — check with your table before using it.")

# The books this converter knows how to produce, so that a re-run reproduces the
# shipped packs exactly. Every field is still overridable by flag; what must not
# drift is the prose, which would otherwise live in dev.sh and in whatever command
# someone last pasted.
SUPPLEMENTS = {
    'XGE': {'pack_name': "Xanathar's Guide to Everything", 'exclude_systems': 'humblewood'},
    'TCE': {'pack_name': "Tasha's Cauldron of Everything", 'exclude_systems': 'humblewood',
            # The Artificer and its four subclasses already reach the player through the
            # 2024 pack (convert_classes' fallback picks up the TCE printing). Shipping
            # them again would sit beside them, not replace them.
            'skip_classes': 'Artificer',
            'extra_note': "The Artificer class and its four subclasses already reach you "
                          "through the D&D 2024 pack, so they are not repeated here; its "
                          "infusions are under Traits. "},
}

def supplement_defaults(code):
    """Flag defaults for a known book, including its _note."""
    d = dict(SUPPLEMENTS.get(code, {}))
    if d.get('pack_name'):
        d.setdefault('note', _EDITION_NOTE % (d['pack_name'], d.pop('extra_note', '')))
    d.pop('extra_note', None)
    return d

def _find_in(d, *names):
    """Look for a file in the dump root and its spells/ and class/ subdirectories."""
    dirs = [d] + [os.path.join(d, s) for s in ('spells', 'class') if os.path.isdir(os.path.join(d, s))]
    for n in names:
        for sd in dirs:
            hits = sorted(glob.glob(os.path.join(sd, n)))
            if hits:
                return hits
    return []

def _run_supplement(a):
    """One supplement book -> one pack folder.

    Deliberately NOT folded into `all`: `all` converts the core rules from many
    files at once, this converts one book, and the two share no input list. The
    guarantee that matters is that `all`'s output never moves — see Book.is_default.
    """
    code = a.book.strip()
    # Flags win; anything not given falls back to the book's profile, so a re-run
    # with just --book reproduces the committed pack.
    dflt = supplement_defaults(code)
    def opt(name):
        return str(getattr(a, name, '') or dflt.get(name, '') or '')
    def csv(name):
        return [x.strip() for x in opt(name).split(',') if x.strip()]

    system = (a.system or code).strip()
    label = opt('pack_name').strip()
    if not label:
        print('  ERROR: --pack-name is required for a book this converter has no profile for '
              '(known: %s)' % ', '.join(sorted(SUPPLEMENTS)), file=sys.stderr)
        return 1
    only = csv('classes')
    # Classes whose subclasses already reach the player from another pack. Emitting
    # them again would not override the existing ones, it would sit beside them —
    # see subclassesFor() in src/js/50-classrace.js.
    skip = only + csv('skip_classes')
    bk = Book(codes=[code], system=system,
              names={stem: '%s — %s' % (label, word) for stem, word in _SUPP_WORDS.items()},
              note=opt('note'), exclude_systems=csv('exclude_systems'))

    d, outdir = a.dir, a.out
    os.makedirs(outdir, exist_ok=True)
    problems = []
    def warn(msg):
        problems.append(msg)
        print('  WARNING: ' + msg)

    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ov = None
    for cand in ([a.overlay] if a.overlay else []) + [os.path.join(d, 'overlay.json'),
                                                      os.path.join(here, 'data', 'overlay.json')]:
        if cand and os.path.exists(cand):
            print('  using overlay: %s' % cand); ov = cand; break
    overlay = load_overlay(ov)

    global _RESERVED, _SUFFIX
    if a.avoid_table_names:
        try:
            other = json.load(open(a.avoid_table_names, encoding='utf-8')).get('tables') or []
        except (OSError, ValueError) as e:
            warn('could not read %s (%s) — table names may collide with it'
                 % (a.avoid_table_names, e))
            other = []
        _RESERVED = frozenset(t.get('name', '') for t in other)
        _SUFFIX = ' (%s)' % code
        print('  avoiding %d table name(s) already used by %s'
              % (len(_RESERVED), a.avoid_table_names))

    tbls = []
    def emit(obj, stem, cat):
        """Write a pack only if it has content. An empty pack file would import
        cleanly and say nothing — the exact silent-skip failure this converter
        has been bitten by before, so say so out loud instead."""
        if not obj.get(cat):
            print('  (no %s in %s — no file written)' % (cat, code))
            return
        _write(obj, os.path.join(outdir, stem + '.json'))

    gloss = _find_in(d, 'variantrules.json', '*variantrule*.json')
    if not gloss: warn('no variantrules.json found')
    else: emit(convert_glossary(gloss[0], tables=tbls, book=bk), 'glossary', 'keywords')

    magic = _find_in(d, 'items.json')
    if not magic: warn('no items.json found')
    else: emit(convert_items(magic[0], tables=tbls, book=bk), 'items-magic', 'items')

    feats = _find_in(d, 'feats.json', 'feat.json')
    if not feats: warn('no feats.json found')
    else: emit(convert_feats(feats[0], overlay=overlay, tables=tbls, book=bk), 'feats', 'feats')

    races = _find_in(d, 'races.json')
    if not races: warn('no races.json found')
    else: emit(convert_races(races[0], tables=tbls, book=bk), 'races', 'races')

    # One book's spells live in one file — no globbing, because a glob that
    # matched the wrong book would convert it silently and look correct.
    spellfile = os.path.join(d, 'spells', 'spells-%s.json' % code.lower())
    srcs = _find_in(d, 'sources.json')
    if not srcs: warn('sources.json not found — spells will have no class tags')
    if not os.path.exists(spellfile):
        warn('no %s found' % spellfile)
    else:
        emit(convert_spells(spellfile, sources=srcs[0] if srcs else None, tables=tbls, book=bk),
             'spells', 'spells')

    classfiles = _find_in(d, 'class-*.json')
    if not classfiles:
        warn('no class-*.json found')
    else:
        # Classes the book prints in full carry their own subclasses nested, so
        # the standalone subclasses file must skip them or they ship twice.
        if only:
            cres = load_class_resources(os.path.join(here, 'data', 'class-resources.json'))
            emit(convert_classes(classfiles, overlay=overlay, resources=cres, tables=tbls,
                                 book=bk, only=only), 'classes', 'classes')
        emit(convert_subclasses(classfiles, book=bk, tables=tbls, skip_classes=skip),
             'subclasses', 'subclasses')

    optf = _find_in(d, 'optionalfeatures.json')
    if not optf: warn('no optionalfeatures.json found')
    feats_out = (convert_optional_features(optf[0], book=bk, tables=tbls) if optf else []) \
        + (convert_class_features(classfiles, book=bk, tables=tbls, skip_classes=skip) if classfiles else [])
    emit(_pack(bk, 'features', feats_out, stem='features', version=1), 'features', 'features')

    _write_tables(tbls, os.path.join(outdir, 'tables.json'), book=bk)
    if problems:
        print('\n  %d WARNING(S) — output is incomplete:' % len(problems))
        for p in problems:
            print('    - ' + p)
    else:
        print('\n  all inputs found.')

def main():
    ap = argparse.ArgumentParser(description="Convert 5e-tools JSON into Fieldbook rules JSON.")
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name in ('conditions', 'glossary', 'feats', 'backgrounds', 'items', 'spells', 'classes', 'races'):
        p = sub.add_parser(name)
        p.add_argument('inputs', nargs='+')
        p.add_argument('-o', '--out', required=True)
        p.add_argument('--overlay')
        p.add_argument('--resources')
        p.add_argument('--sources')
        p.add_argument('--include-legacy', action='store_true')
        p.add_argument('--no-spell-notes', action='store_true')
        p.add_argument('--tables', metavar='PATH',
                       help='also write the tables lifted out of this source to PATH')
    pa = sub.add_parser('all'); pa.add_argument('dir'); pa.add_argument('-o', '--out', required=True)
    pa.add_argument('--overlay'); pa.add_argument('--resources')
    pa.add_argument('--include-legacy', action='store_true')

    ps = sub.add_parser('supplement', help='convert one supplement book (e.g. XGE, TCE) into a pack folder')
    ps.add_argument('dir'); ps.add_argument('-o', '--out', required=True)
    ps.add_argument('--book', required=True, help='5e-tools source code, e.g. XGE or TCE')
    ps.add_argument('--system', help='pack `system` field (defaults to --book)')
    ps.add_argument('--pack-name', default='',
                    help='human label, e.g. "Xanathar\'s Guide to Everything". Defaults to the '
                         'built-in profile for --book (see SUPPLEMENTS)')
    ps.add_argument('--note', default='',
                    help='_note written into every pack in the folder (defaults to the profile)')
    ps.add_argument('--classes', default='', help='comma-separated classes this book PRINTS IN FULL (e.g. Artificer)')
    ps.add_argument('--skip-classes', default='',
                    help='comma-separated classes whose subclasses already ship in another pack')
    ps.add_argument('--avoid-table-names', default='', metavar='PACK.json',
                    help='an existing tables pack whose table names must not be reused '
                         '(the app looks tables up by name alone)')
    ps.add_argument('--exclude-systems', default='',
                    help='comma-separated character systems this pack\'s species must not be offered to')
    ps.add_argument('--overlay'); ps.add_argument('--resources')
    a = ap.parse_args()

    if a.cmd == 'supplement':
        return _run_supplement(a)

    if a.cmd == 'all':
        d, outdir = a.dir, a.out
        os.makedirs(outdir, exist_ok=True)
        problems = []
        def warn(msg):
            problems.append(msg)
            print('  WARNING: ' + msg)

        # 5e-tools keeps spells and classes in SUBDIRECTORIES; globbing only the
        # top level silently found nothing and produced no spells and no classes.
        searchdirs = [d] + [os.path.join(d, s) for s in ('spells', 'class') if os.path.isdir(os.path.join(d, s))]
        def find(*names):
            for n in names:
                for sd in searchdirs:
                    hits = sorted(glob.glob(os.path.join(sd, n)))
                    if hits: return hits
            return []
        def need(label, *names):
            hits = find(*names)
            if not hits:
                warn('no %s source found (looked for %s)' % (label, ', '.join(names)))
            return hits

        # The hand-authored helper files live in the REPO's data/, not in the
        # 5e-tools dump. Looking only in the input dir silently dropped the
        # Archery/Defense effects and the Rage/Focus/Sorcery trackers.
        here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        def helper(flag, fname, label):
            for cand in ([flag] if flag else []) + [os.path.join(d, fname), os.path.join(here, 'data', fname)]:
                if cand and os.path.exists(cand):
                    print('  using %s: %s' % (label, cand))
                    return cand
            warn('%s not found (%s) — those entries will have no effects/trackers' % (label, fname))
            return None
        overlay = load_overlay(helper(a.overlay, 'overlay.json', 'overlay'))
        cres = load_class_resources(helper(a.resources, 'class-resources.json', 'class resources') or '')

        tbls = []       # every converter lifts its tables into this one pack
        cond = need('conditions', '*condition*.json', 'conditionsdiseases.json')
        if cond: _write(convert_conditions(cond[0], tables=tbls), os.path.join(outdir, 'conditions.json'))
        gloss = need('glossary', '*variantrule*.json', 'variantrules.json')
        if gloss: _write(convert_glossary(gloss[0], tables=tbls), os.path.join(outdir, 'glossary.json'))
        base = need('base items', 'items-base*.json')
        if base: _write(convert_items(base[0], tables=tbls), os.path.join(outdir, 'items.json'))
        # items.json is the MAGIC item file — a separate source from items-base.json,
        # and the old glob order meant it was never reached.
        magic = need('magic items', 'items.json')
        if magic: _write(convert_items(magic[0], tables=tbls), os.path.join(outdir, 'items-magic.json'))
        bgs = need('backgrounds', 'background*.json', 'backgrounds.json')
        if bgs: _write(convert_backgrounds(bgs[0], tables=tbls), os.path.join(outdir, 'backgrounds.json'))
        feats = need('feats', 'feats*.json', 'feat.json')
        if feats: _write(convert_feats(feats[0], overlay=overlay, tables=tbls), os.path.join(outdir, 'feats.json'))
        races = need('races', 'races.json')
        if races: _write(convert_races(races[0], tables=tbls), os.path.join(outdir, 'races.json'))
        spells = need('spells', 'spells-xphb.json', 'spells*.json')
        srcs = find('sources.json')
        if not srcs: warn('sources.json not found — spells will have no class tags')
        if spells: _write(convert_spells(spells[0], sources=srcs[0] if srcs else None, tables=tbls), os.path.join(outdir, 'spells.json'))
        classfiles = find('class-*.json')
        if not classfiles: warn('no class-*.json found')
        if classfiles: _write(convert_classes(classfiles, overlay=overlay, include_legacy=a.include_legacy, resources=cres, tables=tbls), os.path.join(outdir, 'classes.json'))
        _write_tables(tbls, os.path.join(outdir, 'tables.json'))
        if problems:
            print('\n  %d WARNING(S) — output is incomplete:' % len(problems))
            for p in problems:
                print('    - ' + p)
        else:
            print('\n  all inputs found.')
        return

    overlay = load_overlay(a.overlay)
    tbls = [] if a.tables else None
    if a.cmd == 'conditions':
        _write(convert_conditions(a.inputs[0], tables=tbls), a.out)
    elif a.cmd == 'glossary':
        _write(convert_glossary(a.inputs[0], tables=tbls), a.out)
    elif a.cmd == 'backgrounds':
        _write(convert_backgrounds(a.inputs[0], tables=tbls), a.out)
    elif a.cmd == 'items':
        _write(convert_items(a.inputs[0], tables=tbls), a.out)
    elif a.cmd == 'races':
        _write(convert_races(a.inputs[0], overlay=overlay, tables=tbls), a.out)
    elif a.cmd == 'feats':
        _write(convert_feats(a.inputs[0], overlay=overlay, tables=tbls), a.out)
    elif a.cmd == 'spells':
        _write(convert_spells(a.inputs[0], sources=a.sources, tables=tbls), a.out)
    elif a.cmd == 'classes':
        files = []
        for pat in a.inputs:
            files.extend(sorted(glob.glob(pat)) if any(ch in pat for ch in '*?[') else [pat])
        _write(convert_classes(files, overlay=overlay, include_legacy=a.include_legacy,
                               spell_notes=not a.no_spell_notes, tables=tbls), a.out)
    if a.tables:
        _write_tables(tbls, a.tables)

if __name__ == '__main__':
    sys.exit(main() or 0)
