import sys, json, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import convert as C

fail = []
total = [0]
def ck(name, cond, extra=''):
    total[0] += 1
    print(('PASS  ' if cond else 'FAIL  ') + name + (('  -> ' + str(extra)) if not cond and extra else ''))
    if not cond: fail.append(name)

# ---- 1. a real-shaped d100 roll table with pad + entry cells
node = {
  "type": "table",
  "caption": "Wild Magic Surge",
  "colLabels": ["{@dice 1d100}", "Effect"],
  "colStyles": ["col-2 text-center", "col-10"],
  "rows": [
    [{"type": "cell", "roll": {"min": 1, "max": 2, "pad": True}}, "Roll on this table at the start of each of your turns."],
    [{"type": "cell", "roll": {"min": 3, "max": 4, "pad": True}}, "You cast {@spell Fireball} as a level 3 spell."],
    [{"type": "cell", "roll": {"exact": 100, "pad": True}}, "You regain all expended {@variantrule Sorcery Points|XPHB}."],
  ],
}
sink = []
with C.table_ctx(sink, 'Wild Magic Sorcery', 'subclass'):
    txt = C.flatten([ "Your spellcasting can unleash surges of untamed magic.", node ])
t = sink[0]
ck('caption becomes name', t['name'] == 'Wild Magic Surge', t['name'])
ck('col labels de-tagged', t['cols'] == ['1d100', 'Effect'], t['cols'])
ck('align from colStyles', t['align'] == ['center', 'left'], t['align'])
ck('roll range padded', t['rows'][0][0] == '01-02', t['rows'][0][0])
ck('roll exact padded', t['rows'][2][0] == '100', t['rows'][2][0])
ck('cell tags stripped', t['rows'][1][1] == 'You cast Fireball as a level 3 spell.', t['rows'][1][1])
ck('owner recorded', (t['owner'], t['ownerKind']) == ('Wild Magic Sorcery', 'subclass'), t.get('owner'))
ck('anchor emitted in prose', '[Table: Wild Magic Surge]' in txt, txt)
ck('prose kept', txt.startswith('Your spellcasting'), txt)

# ---- 2. no sink -> old behaviour, no dangling anchor
plain = C.flatten(["Before.", node, "After."])
ck('no sink: table dropped', '[Table:' not in plain, plain)
ck('no sink: prose kept', plain == 'Before.\nAfter.', plain)

# ---- 3. unnamed table falls back to the owner's name
anon = {"type": "table", "colLabels": ["Spell", "Charges"], "rows": [["Pass without Trace", "2"]]}
s2 = []
with C.table_ctx(s2, 'Staff of the Woodlands', 'item'):
    txt2 = C.flatten([anon])
ck('unnamed -> owner name', s2[0]['name'] == 'Staff of the Woodlands Table', s2[0]['name'])
ck('no caption key when absent', 'caption' not in s2[0], s2[0].get('caption'))
ck('anchor matches name', '[Table: Staff of the Woodlands Table]' in txt2, txt2)

# ---- 4. name collision -> uniquified; identical table -> reused (this is the merge key)
s3 = []
a = {"type": "table", "colLabels": ["A"], "rows": [["1"]]}
b = {"type": "table", "colLabels": ["B"], "rows": [["2"]]}
with C.table_ctx(s3, 'Thing', 'item'):
    C.flatten([a]); C.flatten([b]); C.flatten([a])
ck('collision uniquified', [t['name'] for t in s3] == ['Thing Table', 'Thing Table (2)'], [t['name'] for t in s3])
ck('identical table deduped', len(s3) == 2, len(s3))
names = [t['name'] for t in s3]
ck('names unique', len(names) == len(set(names)), names)

# ---- 5. tableGroup recursion
grp = {"type": "tableGroup", "name": "Deck", "tables": [
    {"type": "table", "caption": "Deck of Illusions", "colLabels": ["Card", "Illusion"], "rows": [["Ace of Hearts", "Red dragon"]]},
    {"type": "table", "caption": "Deck Backs", "colLabels": ["Card"], "rows": [["Joker"]]},
]}
s4 = []
with C.table_ctx(s4, 'Deck of Illusions', 'item'):
    txt4 = C.flatten([grp])
ck('tableGroup -> 2 tables', [t['name'] for t in s4] == ['Deck of Illusions', 'Deck Backs'], [t['name'] for t in s4])
ck('tableGroup -> 2 anchors', txt4.count('[Table:') == 2, txt4)

# ---- 6. ragged rows padded to a rectangle (renderer assumes this)
rag = {"type": "table", "colLabels": ["A", "B", "C"], "rows": [["1"], ["1", "2", "3"]]}
s5 = []
with C.table_ctx(s5, 'X', 'item'):
    C.flatten([rag])
t5 = s5[0]
w = len(t5['cols'])
ck('rectangular rows', all(len(r) == w for r in t5['rows']) and w == 3, [w, t5['rows']])
ck('align padded to width', len(t5['align']) == w, t5['align'])

# ---- 7. empty / all-blank table produces nothing at all
s6 = []
with C.table_ctx(s6, 'X', 'item'):
    txt6 = C.flatten([{"type": "table", "colLabels": ["A"], "rows": []}])
ck('empty table -> no record', s6 == [], s6)
ck('empty table -> no anchor', '[Table:' not in txt6, txt6)

# ---- 8. class progression table: the columns _spell_notes ignores
# Every cell below is copied from the v2.36.1 dump (class-*.json, XPHB). 5e-tools
# writes these columns as TYPED objects, not strings: {"type":"bonus"} (Rage
# Damage), {"type":"bonusSpeed"} (Unarmored Movement) and {"type":"dice"}
# (Martial Arts, Bardic Die, Sneak Attack). This test once wrote Rage Damage as
# the string '+2' and passed while the shipped column was blank (#64).
D6 = {"type": "dice", "toRoll": [{"number": 1, "faces": 6}], "rollable": True}
barb = {"name": "Barbarian", "classTableGroups": [
  {"colLabels": ["Rages", "Rage Damage", "Weapon Mastery"],
   "rows": [["2", {"type": "bonus", "value": 2}, "2"],
            ["2", {"type": "bonus", "value": 2}, "2"],
            ["3", {"type": "bonus", "value": 2}, "2"]]},
  {"title": "Spell Slots per Spell Level", "colLabels": ["1st", "2nd"], "rows": [[2, 0], [3, 0], [4, 2]]},
]}
s7 = []
bt = C._class_tables(barb, 'Barbarian', 'class', s7)
ck('class table named', bt['name'] == 'Barbarian Features', bt['name'])
ck('Level column first', bt['cols'][0] == 'Level', bt['cols'])
ck('Rage Damage recovered', 'Rage Damage' in bt['cols'], bt['cols'])
ck('Weapon Mastery recovered', 'Weapon Mastery' in bt['cols'], bt['cols'])
ck('slot group skipped', '1st' not in bt['cols'], bt['cols'])
ck('rows level-indexed, bonus cell rendered +2', bt['rows'][0] == ['1', '2', '+2', '2'], bt['rows'][0])
ck('row count = levels', len(bt['rows']) == 3, len(bt['rows']))
ck('registered in sink', s7 and s7[0] is bt, s7)

# Monk: dice and bonusSpeed side by side; a bonusSpeed of 0 is the book's dash
monk = {"name": "Monk", "classTableGroups": [
  {"colLabels": ["Martial Arts", "Focus Points", "Unarmored Movement"],
   "rows": [[D6, 0, {"type": "bonusSpeed", "value": 0}],
            [D6, 2, {"type": "bonusSpeed", "value": 10}],
            [D6, 3, {"type": "bonusSpeed", "value": 10}],
            [D6, 4, {"type": "bonusSpeed", "value": 10}],
            [{"type": "dice", "toRoll": [{"number": 1, "faces": 8}], "rollable": True}, 5,
             {"type": "bonusSpeed", "value": 10}]]},
]}
mk = C._class_tables(monk, 'Monk', 'class', [])
ck('Martial Arts dice rendered', [r[1] for r in mk['rows']] == ['1d6', '1d6', '1d6', '1d6', '1d8'], mk['rows'])
ck('Unarmored Movement 0 -> dash', mk['rows'][0][3] == '—', mk['rows'][0])
ck('Unarmored Movement +10 ft.', mk['rows'][1][3] == '+10 ft.', mk['rows'][1])
ck('Focus Points 0 kept as a number', mk['rows'][0][2] == '0', mk['rows'][0])

# spellcaster: cantrip/prepared columns skipped, others kept. The real labels
# carry {@filter} tags, and the Bardic Die is the only column that survives —
# so while dice cells rendered blank the whole table was suppressed (#64).
bard = {"name": "Bard", "classTableGroups": [
  {"colLabels": ["Bardic Die", "{@filter Cantrips|spells|level=0|class=bard}",
                 "{@filter Prepared Spells|spells|level=!0|class=bard}"],
   "rows": [[D6, 2, 4], [D6, 2, 5]]},
]}
s8 = []
bd = C._class_tables(bard, 'Bard', 'class', s8)
ck('Bard table not suppressed', bd is not None and s8 and s8[0] is bd, s8)
ck('Bardic Die recovered', bd and bd['cols'] == ['Level', 'Bardic Die'], bd and bd['cols'])
ck('Bardic Die rendered', bd and bd['rows'] == [['1', '1d6'], ['2', '1d6']], bd and bd['rows'])
ck('cantrips col skipped', bd and 'Cantrips' not in bd['cols'], bd and bd['cols'])

# Rogue: Sneak Attack is the only column at all
rogue = {"name": "Rogue", "classTableGroups": [
  {"colLabels": ["Sneak Attack"],
   "rows": [[D6], [D6], [{"type": "dice", "toRoll": [{"number": 2, "faces": 6}], "rollable": True}]]},
]}
rg = C._class_tables(rogue, 'Rogue', 'class', [])
ck('Rogue table not suppressed', rg is not None, rg)
ck('Sneak Attack rendered', rg and [r[1] for r in rg['rows']] == ['1d6', '1d6', '2d6'], rg and rg['rows'])

# the cell renderer on its own, for each typed shape the dump uses in a table
ck('bonus cell', C._cell_text({"type": "bonus", "value": 3}) == '+3', C._cell_text({"type": "bonus", "value": 3}))
ck('negative bonus keeps its sign', C._cell_text({"type": "bonus", "value": -1}) == '-1',
   C._cell_text({"type": "bonus", "value": -1}))
ck('bonusSpeed cell', C._cell_text({"type": "bonusSpeed", "value": 30}) == '+30 ft.',
   C._cell_text({"type": "bonusSpeed", "value": 30}))
ck('dice cell', C._cell_text({"type": "dice", "toRoll": [{"number": 10, "faces": 6}], "rollable": True}) == '10d6')
# the multi-part shape from 5e-tools' renderdemo.json, plus a shown modifier
demo = {"type": "dice", "toRoll": [{"number": 1, "faces": 4}, {"number": 2, "faces": 7, "modifier": 0},
                                   {"number": 3, "faces": 10, "modifier": 2, "hideModifier": True}]}
ck('multi-part dice, hidden modifier', C._cell_text(demo) == '1d4+2d7+3d10', C._cell_text(demo))
ck('dice modifier shown', C._cell_text({"type": "dice", "toRoll": [{"number": 1, "faces": 6, "modifier": 2}]}) == '1d6+2')

# a typed cell the renderer does not know must not vanish quietly — the blank
# columns above hid for months because this path returned '' and said nothing
C._CELL_MISSES.clear()
ck('unknown typed cell -> blank', C._cell_text({"type": "abilityDc", "name": "Spell"}) == '')
ck('...and a dice cell with nothing to roll', C._cell_text({"type": "dice"}) == '')
said = []
C._cell_miss_warnings(said.append)
ck('...each type is reported as a WARNING', len(said) == 2 and "'abilityDc'" in said[0] and "'dice'" in said[1], said)
C._CELL_MISSES.clear()

# a class with only slot/spell columns yields no table rather than a bare Level column
empty_cls = {"name": "Wizard", "classTableGroups": [
  {"colLabels": ["Cantrips Known"], "rows": [[3], [3]]},
]}
s9 = []
ck('level-only table suppressed', C._class_tables(empty_cls, 'Wizard', 'class', s9) is None and s9 == [], s9)
ck('no classTableGroups -> None', C._class_tables({"name": "X"}, 'X', 'class', []) is None)

# ---- 9. _spell_notes still works unchanged (it feeds the app's per-level notes)
notes = C._spell_notes(bard)
ck('_spell_notes untouched', notes.get(1, {}).get('note', '').startswith('You can now have'), notes)

# ---- 10. refSubclassFeature / refClassFeature nodes are inlined, not dropped
target = {"name": "Wild Magic Surge", "entries": [
    "Roll on the table.",
    {"type": "table", "caption": "Wild Magic Surge", "colLabels": ["1d100", "Effect"],
     "rows": [[{"type": "cell", "roll": {"min": 1, "max": 4, "pad": True}}, "Chaos"]]}]}
idx = {("wild magic surge", "XPHB", 3, "wild magic"): target}
def resolver(node):
    p = str(node.get('subclassFeature') or '').split('|')
    return idx.get((p[0].lower(), p[4], int(p[5]), p[3].lower()))
holder = ["Your magic churns.",
          {"type": "refSubclassFeature", "subclassFeature": "Wild Magic Surge|Sorcerer|XPHB|Wild Magic|XPHB|3"}]
s10 = []
with C.table_ctx(s10, 'Wild Magic Sorcery', 'subclass'), C.ref_ctx(resolver):
    txt10 = C.flatten(holder)
ck('ref feature inlined', 'Wild Magic Surge:' in txt10, txt10)
ck('ref feature table captured', [t['name'] for t in s10] == ['Wild Magic Surge'], s10)
ck('ref table owner is the subclass', s10[0]['owner'] == 'Wild Magic Sorcery', s10[0].get('owner'))
ck('ref table rows converted', s10[0]['rows'] == [['01-04', 'Chaos']], s10[0]['rows'])

# unresolvable ref is skipped quietly, not crashed on
with C.ref_ctx(lambda n: None):
    ck('unresolved ref -> skipped', C.flatten(["A.", {"type": "refSubclassFeature", "subclassFeature": "X|Y|Z|W|V|1"}]) == 'A.')
ck('malformed ref -> skipped', C.flatten(["A.", {"type": "refSubclassFeature", "subclassFeature": "junk"}]) == 'A.')
with C.ref_ctx(resolver):
    ck('no resolver ctx elsewhere is safe', C.flatten(["A."]) == 'A.')

# self-reference must not loop forever
loop = {"name": "Loopy", "entries": ["body", {"type": "refSubclassFeature", "subclassFeature": "Loopy|C|XPHB|S|XPHB|1"}]}
lidx = {("loopy", "XPHB", 1, "s"): loop}
with C.ref_ctx(lambda n: lidx.get(tuple([n['subclassFeature'].split('|')[0].lower(),
                                         n['subclassFeature'].split('|')[4],
                                         int(n['subclassFeature'].split('|')[5]),
                                         n['subclassFeature'].split('|')[3].lower()]))):
    out10 = C.flatten([loop['entries'][1]])
ck('self-reference terminates', out10.count('body') == 1, out10)

# ---- 11. XPHB selection: the whole book, with basic-rules entries backfilled
pool = [
    {"name": "InXphb", "source": "XPHB"},
    {"name": "XphbNotBasic", "source": "XPHB"},
    {"name": "BasicOnly", "source": "PHB", "basicRules2024": True},
    {"name": "LegacyOnly", "source": "PHB", "basicRules": True},
    {"name": "InXphb", "source": "PHB", "basicRules": True},   # dup name, XPHB wins
    {"name": "Unrelated", "source": "TCE"},
]
got = [e['name'] for e in C.pick_2024_preferred(pool)]
ck('all XPHB kept', got.count('InXphb') == 1 and 'XphbNotBasic' in got, got)
ck('non-basic XPHB kept', 'XphbNotBasic' in got, got)
ck('basic-rules backfilled', 'BasicOnly' in got and 'LegacyOnly' in got, got)
ck('XPHB wins over dup legacy name', got.count('InXphb') == 1, got)
ck('non-XPHB non-basic excluded', 'Unrelated' not in got, got)
# 5e-tools v2.36.1 moved the 2024 Cloak of Invisibility from basicRules2024 to
# srd52 alone; reading only the first flag silently dropped it from the pack.
sr = [e['name'] + '|' + e['source'] for e in C.pick_2024_preferred([
    {"name": "Cloak", "source": "XDMG", "srd52": True},
    {"name": "Cloak", "source": "DMG", "basicRules": True},       # the 2014 printing must not win
    {"name": "Unflagged", "source": "XDMG"}])]
ck('an SRD 5.2 entry counts as the free 2024 subset', sr == ['Cloak|XDMG'], sr)

# ---- 12. races: speed, skills, lineage parsing
ck('speed int', C._race_speed(30) == '30 ft', C._race_speed(30))
ck('speed dict walk+fly', C._race_speed({'walk': 30, 'fly': 30}) == '30 ft, fly 30 ft', C._race_speed({'walk':30,'fly':30}))
ck('speed fly:true', C._race_speed({'walk': 25, 'fly': True}) == '25 ft, fly equal to walking speed', C._race_speed({'walk':25,'fly':True}))
ck('speed missing', C._race_speed(None) == '')

# size: single code -> one name, several -> the choice is kept for the app to show
ck('size single code', C._race_size(['M']) == 'Medium', C._race_size(['M']))
ck('size choice kept as a list', C._race_size(['S', 'M']) == ['Small', 'Medium'], C._race_size(['S','M']))
ck('size bare string', C._race_size('M') == 'Medium', C._race_size('M'))
ck('size missing', C._race_size(None) == '')
ck('size empty list', C._race_size([]) == '')
# "V" is Varies — it names no size, and guessing one is worse than omitting it
ck('size Varies dropped', C._race_size(['V']) == '', C._race_size(['V']))
ck('size unknown code dropped from a mix', C._race_size(['S', 'V']) == 'Small', C._race_size(['S','V']))

fx, chs = C._race_skills([{'choose': {'from': ['insight', 'perception']}}])
ck('skill choose -> chooser', not fx and chs == [{'type':'skill','choose':1,'from':['Insight','Perception']}], (fx, chs))
fx, chs = C._race_skills([{'any': 1}])
ck('skill any -> all 18', not fx and chs[0]['choose'] == 1 and len(chs[0]['from']) == 18, (fx, chs))
fx, chs = C._race_skills([{'perception': True}])
ck('fixed skill', fx == ['Perception'] and not chs, (fx, chs))
ck('no skills', C._race_skills(None) == ([], []))

def _v(nm, replace, text):
    return {'name': nm, '_mod': {'entries': {'mode': 'replaceArr', 'replace': replace,
            'items': {'name': replace + ' (x)', 'type': 'entries', 'entries': [text]}}}}
subs = C._version_subraces({'_versions': [
    _v('Elf; Drow Lineage', 'Elven Lineage', 'Darkvision 120.'),
    _v('Goliath; Cloud Giant Ancestry', 'Giant Ancestry', 'Cloud step.'),
    _v('Tiefling; Abyssal Legacy', 'Fiendish Legacy', 'Poison resistance.'),
]})
ck('lineage/ancestry/legacy suffixes stripped',
   [s['name'] for s in subs] == ['Drow', 'Cloud Giant', 'Abyssal'], [s['name'] for s in subs])
ck('subrace carries description', subs[0]['description'] == 'Darkvision 120.', subs[0])
ck('_mod.entries as a LIST also works',
   [s['name'] for s in C._version_subraces({'_versions': [
       {'name': 'Gnome; Rock Gnome Lineage',
        '_mod': {'entries': [{'mode': 'replaceArr', 'replace': 'Gnomish Lineage',
                              'items': {'name': 'L', 'entries': ['Tinker.']}}]}}]})] == ['Rock Gnome'])
ck('unnamed _version skipped (Dragonborn template)',
   C._version_subraces({'_versions': [{'_abstract': {}, '_implementations': []}]}) == [])
ck('no _versions -> no subraces', C._version_subraces({}) == [])

# table fallback (Dragonborn) turns the ancestry table into real picks
db = {'entries': [{'name': 'Draconic Ancestry', 'entries': [
        'Choose one.', {'type': 'table', 'colLabels': ['Dragon', 'Damage Type'],
                        'rows': [['Black', 'Acid'], ['Blue', 'Lightning']]}]}]}
tsubs = C._table_subraces(db, None)
ck('table fallback -> subraces', [s['name'] for s in tsubs] == ['Black', 'Blue'], tsubs)
ck('table fallback description', tsubs[0]['description'] == 'Damage Type: Acid', tsubs[0])
ck('table fallback when no table', C._table_subraces({'entries': []}, None) == [])

# ---- 13. supplement books: source selection and pack headers
XGE = C.Book(codes=['XGE'], system='XGE',
             names={'spells': "Xanathar's — Spells"}, note='2014-era.',
             exclude_systems=['humblewood'])
ck('default Book is the 2024 path', C.DEFAULT_BOOK.is_default and not XGE.is_default)
ck('pick_sources default == pick_2024_preferred',
   [e['name'] for e in C.pick_sources(pool)] == [e['name'] for e in C.pick_2024_preferred(pool)])
ck('pick_sources by book selects only that source',
   [e['name'] for e in C.pick_sources(pool, C.Book(codes=['TCE']))] == ['Unrelated'])
# The canary the whole task rests on: the old filter is not merely wrong for a
# supplement, it is SILENTLY wrong — an empty pack that imports cleanly.
ck('pick_2024_preferred returns [] for a supplement',
   C.pick_2024_preferred([{'name': 'A', 'source': 'XGE'}]) == [])

# Key ORDER is load-bearing: json.dump writes insertion order and data/5e2024/
# is compared byte for byte.
ck('_pack XPHB items header exact',
   list(C._pack(None, 'items', [1], stem='items').items())
   == [('system', 'XPHB'), ('name', 'D&D 2024 Items'), ('items', [1])])
ck('_pack XPHB classes header exact',
   list(C._pack(None, 'classes', [], stem='classes', version=1).items())
   == [('system', 'XPHB'), ('name', 'XPHB Classes (2024)'), ('version', 1), ('classes', [])])
ck('_pack XPHB unnamed categories carry no name',
   list(C._pack(None, 'feats', []).items()) == [('system', 'XPHB'), ('feats', [])])
ck('_pack supplement carries _note and excludeSystems, array last',
   list(C._pack(XGE, 'spells', [], stem='spells').items())
   == [('system', 'XGE'), ('name', "Xanathar's — Spells"), ('_note', '2014-era.'),
       ('excludeSystems', ['humblewood']), ('spells', [])])

# ---- 14. subclasses: the _copy stub is the duplicate, not a rival printing
_SC_FEAT = {'name': 'Trick', 'source': 'XGE', 'level': 3, 'subclassShortName': 'Scout',
            'className': 'Rogue', 'entries': ['A long enough description line to be picked as the blurb.']}
def _scfile(**over):
    d = {'subclassFeature': [_SC_FEAT], 'classFeature': [],
         'subclass': [
             {'name': 'Scout', 'className': 'Rogue', 'source': 'XGE', 'classSource': 'PHB',
              'subclassFeatures': ['Trick|Rogue|PHB|Scout|XGE|3']},
             # the stub: newer classSource, no features of its own
             {'name': 'Scout', 'className': 'Rogue', 'source': 'XGE', 'classSource': 'XPHB',
              '_copy': {'name': 'Scout'}},
         ]}
    d.update(over); return d
import tempfile
def _tmpjson(obj):
    fh = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8')
    json.dump(obj, fh); fh.close(); return fh.name

got = C.convert_subclasses([_tmpjson(_scfile())], book=XGE, tables=[])['subclasses']
ck('_copy stub deduped away', len(got) == 1, got)
ck('the kept record is the one WITH features', got and got[0]['levels'].get('3'), got)
ck('subclass attaches by plain class name', got and got[0]['class'] == 'Rogue', got)
ck('subclass description lifted from its first feature',
   got and got[0]['description'].startswith('A long enough'), got)

# a 7th UID part names the feature's own source and overrides the 5th
seven = _scfile()
seven['subclassFeature'][0]['source'] = 'TCE'
seven['subclass'][0]['subclassFeatures'] = ['Trick|Rogue|PHB|Scout|XGE|3|TCE']
g7 = C.convert_subclasses([_tmpjson(seven)], book=XGE, tables=[])['subclasses']
ck('7-part subclassFeature UID resolves', g7 and g7[0]['levels'].get('3'), g7)

# ---- 15. optional features
ck('featureType label', C._oft_label(['EI']) == 'Eldritch Invocation')
ck('fighting styles collapse into one label',
   C._oft_label(['FS:F', 'FS:P', 'FS:R']) == 'Fighting Style (Fighter, Paladin, Ranger)',
   C._oft_label(['FS:F', 'FS:P', 'FS:R']))
ck('optfeat prereq: level is a dict here, not an int',
   C._render_optfeat_prereq([{'level': {'level': 14, 'class': {'name': 'Artificer'}}}])
   == 'Level 14 Artificer')
ck('optfeat prereq: pact', C._render_optfeat_prereq([{'pact': 'Tome'}]) == 'Pact of the Tome')
ck('optfeat prereq: cantrip suffix',
   C._render_optfeat_prereq([{'spell': ['eldritch blast#c']}]) == 'Eldritch Blast cantrip')

# ---- 16. optional CLASS features (Tasha's) — exclusion and collision naming
cffile = {'class': [{'name': 'Artificer', 'source': 'TCE'}],
          'classFeature': [
              {'name': 'Infuse Item', 'className': 'Artificer', 'source': 'TCE', 'level': 2, 'entries': ['x']},
              {'name': 'Favored Foe', 'className': 'Ranger', 'source': 'TCE', 'level': 1, 'entries': ['x']},
              {'name': 'Deft Explorer', 'className': 'Ranger', 'source': 'TCE', 'level': 6, 'entries': ['x']},
              {'name': 'Deft Explorer', 'className': 'Ranger', 'source': 'TCE', 'level': 10, 'entries': ['x']},
          ]}
cfs = C.convert_class_features([_tmpjson(cffile)], book=C.Book(codes=['TCE'], system='TCE'), tables=[])
names = [x['name'] for x in cfs]
ck("a book's own class keeps its features out of the options list",
   not any('Artificer' in n for n in names), names)
ck('optional class features are class-qualified', 'Ranger: Favored Foe' in names, names)
# one bare + one suffixed would read as two different kinds of thing
ck('colliding names are BOTH disambiguated',
   sorted(n for n in names if 'Deft' in n)
   == ['Ranger: Deft Explorer (Level 10)', 'Ranger: Deft Explorer (Level 6)'], names)
ck('every optional class feature name is unique', len(names) == len(set(names)), names)

# ---- 17. legacy prerequisite shapes are GATED, not merely harmless
race_pr = [{'race': [{'name': 'elf', 'subrace': 'drow'}]}]
ck('race prerequisite renders under legacy',
   C._render_prereq(race_pr, legacy=True) == 'Elf (Drow)', C._render_prereq(race_pr, legacy=True))
ck('race prerequisite is invisible to the 2024 run', C._render_prereq(race_pr) == '')
# `proficiency` DOES occur in the 2024 run and is not rendered there today —
# rendering it unconditionally would move data/5e2024/feats.json.
prof_pr = [{'proficiency': [{'armor': 'heavy'}]}]
ck('proficiency prerequisite is invisible to the 2024 run', C._render_prereq(prof_pr) == '')
ck('proficiency prerequisite renders under legacy',
   C._render_prereq(prof_pr, legacy=True) == 'Heavy armor', C._render_prereq(prof_pr, legacy=True))
ck('existing prereq shapes unchanged',
   C._render_prereq([{'level': 4, 'ability': [{'str': 13}]}]) == 'Level 4+ and Strength 13+')

# ---- 18. table names must not collide with another pack's (findTable is global)
tnode = {'type': 'table', 'caption': 'Gloom Stalker Spells',
         'colLabels': ['Level', 'Spell'], 'rows': [['3', 'Disguise Self']]}
sink = []
with C.table_ctx(sink, 'Gloom Stalker', 'subclass'):
    plain = C.flatten([tnode])
ck('unreserved name is left alone', sink[0]['name'] == 'Gloom Stalker Spells', sink[0]['name'])
ck('anchor matches the registered name', plain == '[Table: Gloom Stalker Spells]', plain)
sink2 = []
with C.reserved_names(['Gloom Stalker Spells'], ' (XGE)'), \
     C.table_ctx(sink2, 'Gloom Stalker', 'subclass'):
    anchored = C.flatten([tnode])
ck('a name another pack owns is suffixed', sink2[0]['name'] == 'Gloom Stalker Spells (XGE)',
   sink2[0]['name'])
# the anchor is what makes the rename safe: rename without it and the chip dies
ck('the anchor follows the rename', anchored == '[Table: Gloom Stalker Spells (XGE)]', anchored)
sink3 = []
with C.reserved_names(['Something Else'], ' (XGE)'), C.table_ctx(sink3, 'X', 'subclass'):
    C.flatten([tnode])
ck('non-colliding names are untouched under reservation',
   sink3[0]['name'] == 'Gloom Stalker Spells', sink3[0]['name'])
ck('reservation is scoped — the 2024 run sees none', C._SUFFIX == '' and not C._RESERVED)

# ---- 19. option pickers from optionalfeatureProgression (#60)
# 5e-tools lists maneuvers, invocations and metamagic as refOptionalfeature
# nodes, which flatten() dropped — the prose ended at "presented here in
# alphabetical order." and no picker existed. Three shipped 2024 classes, the
# Artificer, and three supplement subclasses were all hit.
refs = [{'name': 'Maneuver Options', 'entries': ['The maneuvers are presented here in alphabetical order.',
         {'type': 'options', 'count': 3, 'entries': [
             {'type': 'refOptionalfeature', 'optionalfeature': 'Ambush|XPHB'},
             {'type': 'refOptionalfeature', 'optionalfeature': 'Parry|XPHB'}]}]}]
ftxt = C.flatten(refs)
ck('a referenced option is named, not dropped', 'Ambush' in ftxt and 'Parry' in ftxt, ftxt)
ck('...as a bullet, like a list item', '• Ambush' in ftxt and '• Parry' in ftxt, ftxt)
ck('...without its source suffix', '|XPHB' not in ftxt, ftxt)

ck('progression map -> totals', C._prog_totals({'3': 3, '7': 5}) == {3: 3, 7: 5})
ck('progression list -> totals by level', C._prog_totals([1, 3, 3])[2] == 3 and C._prog_totals([1, 3, 3])[1] == 1)

OF = [
    {'name': 'Ambush', 'source': 'XPHB', 'featureType': ['MV:B'], 'entries': ['Add the die to Stealth.']},
    {'name': 'Parry', 'source': 'XPHB', 'featureType': ['MV:B'], 'entries': ['Reduce the damage.']},
    {'name': 'Parry', 'source': 'PHB', 'featureType': ['MV:B'], 'entries': ['2014 wording.']},
    {'name': 'Late Trick', 'source': 'XPHB', 'featureType': ['MV:B'], 'entries': ['Later.'],
     'prerequisite': [{'level': {'level': 7, 'class': {'name': 'Fighter'}}}]},
    {'name': 'Agonizing Blast', 'source': 'XPHB', 'featureType': ['EI'],
     'entries': ['Add CHA.', {'type': 'entries', 'name': 'Repeatable', 'entries': ['Again.']}]},
    {'name': 'Dueling', 'source': 'PHB', 'featureType': ['FS:F', 'FS:B'], 'entries': ['+2 damage.']},
]
bm = C._optfeat_choices([{'name': 'Maneuvers', 'featureType': ['MV:B'], 'progression': {'3': 3, '7': 5}}], OF, 'XPHB')
ck('a choice at each level the total rises', sorted(bm) == [3, 7], sorted(bm))
c3, c7 = bm[3][0], bm[7][0]
ck('the choice is an option picker', c3['type'] == 'option', c3)
ck('it asks for the rise, not the total', c3['choose'] == 3 and c7['choose'] == 2, (c3['choose'], c7['choose']))
ck('the label says how many, and "more" after the first',
   c3['label'] == 'Maneuvers: choose 3' and c7['label'] == 'Maneuvers: choose 2 more', (c3['label'], c7['label']))
n3 = [o['name'] for o in c3['from']]
ck('only the printing the class comes from — no 2014 Parry beside the 2024 one',
   n3.count('Parry') == 1 and all('2014' not in o['description'] for o in c3['from']), c3['from'])
ck('an option whose level prerequisite is unmet is not offered yet', 'Late Trick' not in n3, n3)
ck('...and is offered once it is met', 'Late Trick' in [o['name'] for o in c7['from']], c7['from'])
ck('the prerequisite is stated in the description',
   [o for o in c7['from'] if o['name'] == 'Late Trick'][0]['description'].startswith('Prerequisite: Level 7 Fighter'))
ck('options are alphabetical', n3 == sorted(n3), n3)

ei = C._optfeat_choices([{'name': 'Eldritch Invocations', 'featureType': ['EI'], 'progression': [1, 3]}], OF, 'XPHB')
ck('a list progression works the same', ei[1][0]['choose'] == 1 and ei[2][0]['choose'] == 2, ei)
ck('a repeatable option is flagged, so the picker can offer it again',
   ei[1][0]['from'][0].get('repeatable') is True, ei[1][0]['from'][0])
ck('a normal option is not', not bm[3][0]['from'][0].get('repeatable'), bm[3][0]['from'][0])

sw = C._optfeat_choices([{'name': 'Fighting Style', 'featureType': ['FS:B'], 'progression': {'3': 1}}], OF, 'XGE')
ck("a 2014 book with no printing of its own falls back to the PHB's (College of Swords)",
   [o['name'] for o in sw[3][0]['from']] == ['Dueling'], sw)
ck('no options of the type at all emits nothing, not an empty picker',
   C._optfeat_choices([{'name': 'Runes', 'featureType': ['RN'], 'progression': {'3': 2}}], OF, 'TCE') == {})

# wired through both converters: nested 2024 subclasses and standalone supplement ones
bmfile = {'class': [{'name': 'Fighter', 'source': 'XPHB', 'hd': {'faces': 10}, 'classFeatures': []}],
          'classFeature': [],
          'subclass': [{'name': 'Battle Master', 'shortName': 'Battle Master', 'className': 'Fighter',
                        'source': 'XPHB', 'classSource': 'XPHB',
                        'subclassFeatures': ['Combat Superiority|Fighter|XPHB|Battle Master|XPHB|3'],
                        'optionalfeatureProgression': [{'name': 'Maneuvers', 'featureType': ['MV:B'],
                                                        'progression': {'3': 3}}]}],
          'subclassFeature': [{'name': 'Combat Superiority', 'source': 'XPHB', 'level': 3,
                               'subclassShortName': 'Battle Master', 'className': 'Fighter',
                               'entries': ['You learn maneuvers fueled by Superiority Dice, long enough.']}]}
cls = C.convert_classes([_tmpjson(bmfile)], optfeats=OF)['classes'][0]
bml3 = cls['subclasses']['Battle Master']['levels']['3']
ck('a 2024 subclass carries its picker beside its traits',
   bml3.get('traits') and bml3.get('choices') and bml3['choices'][0]['label'] == 'Maneuvers: choose 3', bml3)
cls0 = C.convert_classes([_tmpjson(bmfile)])['classes'][0]
ck('no optional features given: no maneuver picker',
   not any(str(c.get('label', '')).startswith('Maneuvers')
           for c in cls0['subclasses']['Battle Master']['levels']['3'].get('choices', [])), cls0)

# A 2024 subclass opens with an italic tagline. The description picker took the
# first line over 40 characters, so the taglines of 41+ (eight of them — Psi
# Warrior, Thief, Hunter...) became the whole description.
tagfile = json.loads(json.dumps(bmfile))
tagfile['subclassFeature'][0]['entries'] = ['{@i Augment Physical Might with Psionic Power}',
                                            'Psi Warriors awaken the power of their minds to augment their might.']
tsd = C.convert_classes([_tmpjson(tagfile)])['classes'][0]['subclasses']['Battle Master']['description']
ck('an italic tagline is never taken as the description', tsd.startswith('Psi Warriors awaken'), tsd)
ts2 = json.loads(json.dumps(_scfile()))
ts2['subclassFeature'][0]['source'] = 'XGE'   # section 14 mutates the shared _SC_FEAT to TCE
ts2['subclassFeature'][0]['entries'] = ['{@i Augment Physical Might with Psionic Power}', 'A long enough description line to be picked as the blurb.']
g2 = C.convert_subclasses([_tmpjson(ts2)], book=XGE, tables=[])['subclasses']
ck('...in the supplement path too', g2 and g2[0]['description'].startswith('A long enough'), g2)

ss = json.loads(json.dumps(_scfile()))
ss['subclassFeature'][0]['source'] = 'XGE'
ss['subclass'][0]['optionalfeatureProgression'] = [{'name': 'Fighting Style', 'featureType': ['FS:B'], 'progression': {'3': 1}}]
gs = C.convert_subclasses([_tmpjson(ss)], book=XGE, tables=[], optfeats=OF)['subclasses']
ck('a supplement subclass carries its picker too, beside its traits',
   gs and gs[0]['levels']['3'].get('traits') and gs[0]['levels']['3'].get('choices') and gs[0]['levels']['3']['choices'][0]['from'][0]['name'] == 'Dueling', gs)

# ---- 20. what an option spends, subclass resources, Student of War, the library
ck('a maneuver spends a Superiority Die from the pool the sheet tracks',
   C._optfeat_cost({'consumes': {'name': 'Superiority Die'}}) == {'resource': 'Superiority Dice', 'amount': 1},
   C._optfeat_cost({'consumes': {'name': 'Superiority Die'}}))
ck('an amount is kept, and the pool name is the tracked one',
   C._optfeat_cost({'consumes': {'name': 'Sorcery Point', 'amount': 2}}) == {'resource': 'Sorcery Points', 'amount': 2})
ck('an unknown pool keeps its own name', C._optfeat_cost({'consumes': {'name': 'Arcane Shot'}})['resource'] == 'Arcane Shot')
ck('nothing consumed, no cost', C._optfeat_cost({}) is None)
OFC = [{'name': 'Parry', 'source': 'XPHB', 'featureType': ['MV:B'], 'entries': ['x'], 'consumes': {'name': 'Superiority Die'}}]
pc = C._optfeat_choices([{'name': 'Maneuvers', 'featureType': ['MV:B'], 'progression': {'3': 3}}], OFC, 'XPHB')
ck('a picked maneuver carries its cost', pc[3][0]['from'][0].get('cost') == {'resource': 'Superiority Dice', 'amount': 1}, pc)

bm2 = json.loads(json.dumps(bmfile))
bm2['class'][0]['startingProficiencies'] = {'skills': [{'choose': {'count': 2, 'from': ['athletics', 'history', 'insight']}}]}
bm2['subclassFeature'].append({'name': 'Student of War', 'source': 'XPHB', 'level': 3, 'subclassShortName': 'Battle Master',
                               'className': 'Fighter', 'entries': ['You gain proficiency with one type of Artisan\'s Tools.']})
bm2['subclass'][0]['subclassFeatures'].append('Student of War|Fighter|XPHB|Battle Master|XPHB|3')
res = {'Fighter/Battle Master': [{'name': 'Superiority Dice', 'per': 'short', 'max': {'byLevel': [0, 0, 4]}}]}
bmc = C.convert_classes([_tmpjson(bm2)], optfeats=OFC, resources=res)['classes'][0]
bms = bmc['subclasses']['Battle Master']
ck('a subclass takes its resources from class-resources.json ("Class/Subclass")',
   bms.get('resources') == res['Fighter/Battle Master'], bms.get('resources'))
ck('...and the class does not', 'resources' not in bmc, bmc.get('resources'))
ch3 = bms['levels']['3']['choices']
sk = [c for c in ch3 if c['type'] == 'skill']
ck('Student of War asks for one skill from the Fighter\'s own level-1 list',
   len(sk) == 1 and sk[0]['choose'] == 1 and sk[0]['from'] == ['Athletics', 'History', 'Insight'], sk)
tl = [c for c in ch3 if c['type'] == 'option' and 'Tools' in c['label']]
ck("...and one type of Artisan's Tools, all 17", len(tl) == 1 and len(tl[0]['from']) == 17 and tl[0]['choose'] == 1, tl)
ck('...after the maneuvers, in book order', [c['type'] for c in ch3] == ['option', 'skill', 'option'], [c['label'] if 'label' in c else c['type'] for c in ch3])

ss3 = json.loads(json.dumps(_scfile())); ss3['subclassFeature'][0]['source'] = 'XGE'
g3 = C.convert_subclasses([_tmpjson(ss3)], book=XGE, tables=[],
                          resources={'Rogue/Scout': [{'name': 'Tricks', 'per': 'short', 'max': 2}]})['subclasses']
ck('a supplement subclass takes its resources too', g3 and g3[0].get('resources') == [{'name': 'Tricks', 'per': 'short', 'max': 2}], g3)

lib = C._optfeat_features(OFC + [{'name': 'Quickened Spell', 'source': 'XPHB', 'featureType': ['MM'], 'entries': ['y'],
                                   'consumes': {'name': 'Sorcery Point', 'amount': 2}}])
ck('library entries are labelled by kind', sorted(x['source'] for x in lib) == ['Battle Master Maneuver', 'Metamagic'], lib)
ck('...and carry their cost too', all(x.get('cost') for x in lib), lib)

# ---- 21. multiclassing (#66): what a class grants as a SECOND class
mcf = json.loads(json.dumps(bmfile))
mcf['class'][0]['multiclassing'] = {'proficienciesGained': {
    'skills': [{'choose': {'from': ['stealth', 'sleight of hand'], 'count': 1}}],
    'tools': ["{@item Thieves' Tools|XPHB}"], 'armor': ['light', 'shield'], 'weapons': ['martial']}}
mc = C.convert_classes([_tmpjson(mcf)])['classes'][0].get('multiclass')
ck('multiclass skills become a level-choice-shaped skill choice',
   mc and mc.get('choices') == [{'type': 'skill', 'choose': 1, 'from': ['Stealth', 'Sleight of Hand']}], mc)
ck('...and armor, weapon and tool training one display string',
   mc and mc.get('proficiencies') == "Light armor, Shields, Martial weapons, Thieves' Tools", mc)
mcf['class'][0]['multiclassing'] = {'proficienciesGained': {'tools': ['Choose one {@item Musical Instrument|XPHB}']}}
mcb = C.convert_classes([_tmpjson(mcf)])['classes'][0].get('multiclass')
ck('"Choose one X" reads as "one X of your choice"', mcb == {'proficiencies': 'one Musical Instrument of your choice'}, mcb)
mcf['class'][0]['multiclassing'] = {}
ck('a class the table says gains nothing carries an empty block, not none',
   C.convert_classes([_tmpjson(mcf)])['classes'][0].get('multiclass') == {})
del mcf['class'][0]['multiclassing']
ck('...and a source with no multiclassing entry carries no block at all',
   'multiclass' not in C.convert_classes([_tmpjson(mcf)])['classes'][0])

# ---- 22. a first class's "any N" skills (#67)
# The 2024 Bard's starting skills are `{"any": 3}`: three of the player's choice
# from all 18. The class path read only `choose` and bare names, dropped this
# without a word, and a first-class Bard was offered no skills at all. The Bard
# below is the real one, copied from the v2.36.1 dump (class-bard.json, XPHB).
import io, contextlib
ALL18 = sorted(C.SKMAP.values())
bardf = {'class': [{'name': 'Bard', 'source': 'XPHB', 'hd': {'number': 1, 'faces': 8}, 'classFeatures': [],
    'startingProficiencies': {'skills': [{'any': 3}], 'weapons': ['simple'],
        'tools': ['Choose three {@item Musical Instrument|XPHB|Musical Instruments}'],
        'toolProficiencies': [{'anyMusicalInstrument': 3}], 'armor': ['light'], 'armorProficiencies': [{'light': True}]},
    'multiclassing': {'proficienciesGained': {'skills': [{'choose': {'from': [
        'athletics', 'acrobatics', 'sleight of hand', 'stealth', 'arcana', 'history', 'investigation', 'nature',
        'religion', 'animal handling', 'insight', 'medicine', 'perception', 'survival', 'deception', 'intimidation',
        'performance', 'persuasion'], 'count': 1}}],
        'tools': ['Choose one {@item Musical Instrument|XPHB}'], 'toolProficiencies': [{'anyMusicalInstrument': 1}],
        'armor': ['light'], 'armorProficiencies': [{'light': True}]}}}],
    'classFeature': []}
bard = C.convert_classes([_tmpjson(bardf)])['classes'][0]
b1 = [c for c in bard.get('levels', {}).get('1', {}).get('choices', []) if c['type'] == 'skill']
ck('#67 a Bard\'s "any 3" becomes a level-1 skill choice', len(b1) == 1, bard.get('levels'))
ck('#67 ...of three, from all 18 skills',
   b1 == [{'type': 'skill', 'choose': 3, 'from': ALL18}] and len(ALL18) == 18, b1)
ck('#67 ...and no fixed skills', 'skills' not in bard, bard.get('skills'))
ck('#67 ...while the multiclass block keeps its own one skill',
   [(c['choose'], len(c['from'])) for c in bard['multiclass'].get('choices', [])] == [(1, 18)], bard.get('multiclass'))
ck('#67 one reader: a species\' "any 3" is the same choice',
   C._race_skills([{'any': 3}]) == ([], b1), C._race_skills([{'any': 3}]))
mcany = json.loads(json.dumps(bardf))
mcany['class'][0]['multiclassing'] = {'proficienciesGained': {'skills': [{'any': 1}]}}
ck('#67 ...and a multiclass "any 1" reads the same way, not as a warning',
   C.convert_classes([_tmpjson(mcany)])['classes'][0]['multiclass'] == {'choices': [{'type': 'skill', 'choose': 1, 'from': ALL18}]},
   C.convert_classes([_tmpjson(mcany)])['classes'][0].get('multiclass'))
# A skill entry the reader does not know is said out loud, never dropped quietly:
# that silence is what hid this bug.
odd = json.loads(json.dumps(bardf))
odd['class'][0]['startingProficiencies']['skills'] = [{'anyFromList': 2}]
err = io.StringIO()
with contextlib.redirect_stderr(err):
    oddc = C.convert_classes([_tmpjson(odd)])['classes'][0]
ck('#67 an unknown starting-skill entry is a note, not a silent skip',
   'Bard' in err.getvalue() and 'anyFromList' in err.getvalue() and 'starting skill' in err.getvalue(), err.getvalue())
ck('#67 ...and invents no choice for it', not oddc.get('levels', {}).get('1', {}).get('choices'), oddc.get('levels'))

# ---- 23. entry nodes flatten() used to drop (#68)
# flatten() fell through any node type it had no branch for, silently. Four
# carried text a player needs: the save-DC and attack-modifier formulas, list
# items written with a singular `entry`, and an embedded stat block. Every shape
# below is copied from the v2.36.1 dump (long prose trimmed where noted).

# XGE Arcane Archer, "Arcane Shot Options" (class-fighter.json subclassFeature)
AA_OPTS = ["The Arcane Shot feature lets you choose options for it at certain levels. The options are presented here in alphabetical order. They are all magical effects, and each one is associated with one of the schools of magic.",
           "If an option requires a saving throw, your Arcane Shot save DC is calculated as follows:",
           {"type": "abilityDc", "name": "Arcane Shot", "attributes": ["int"]},
           {"type": "options", "count": 2, "entries": [
               {"type": "refOptionalfeature", "optionalfeature": "Banishing Arrow|XGE"},
               {"type": "refOptionalfeature", "optionalfeature": "Beguiling Arrow|XGE"}]}]
aa = C.flatten(AA_OPTS)
ck('abilityDc renders the save DC formula (Arcane Shot)',
   'Arcane Shot save DC = 8 + your proficiency bonus + your Intelligence modifier.' in aa, aa)
ck('...right after the sentence that promises it',
   'calculated as follows:\nArcane Shot save DC = 8' in aa, aa)
ck('...and the options still follow it', aa.endswith('• Banishing Arrow\n• Beguiling Arrow'), aa)

# TCE Artificer, "Spellcasting" -> "Spellcasting Ability" (class-artificer.json classFeature)
ART_SC = {"type": "entries", "name": "Spellcasting Ability", "entries": [
    "Intelligence is your spellcasting ability for your artificer spells; your understanding of the theory behind magic allows you to wield these spells with superior skill. You use your Intelligence whenever an artificer spell refers to your spellcasting ability. In addition, you use your Intelligence modifier when setting the saving throw DC for an artificer spell you cast and when making an attack roll with one.",
    {"type": "abilityDc", "name": "Spell", "attributes": ["int"]},
    {"type": "abilityAttackMod", "name": "Spell", "attributes": ["int"]}]}
art = C.flatten([ART_SC])
ck('abilityDc: Artificer spell save DC',
   'Spell save DC = 8 + your proficiency bonus + your Intelligence modifier.' in art, art)
ck('abilityAttackMod: Artificer spell attack modifier',
   'Spell attack modifier = your proficiency bonus + your Intelligence modifier.' in art, art)
# a named subsection joins its blocks with spaces, so an unterminated formula
# would run into the next one: "…Intelligence modifier Spell attack modifier = …"
ck('...each formula ends its sentence, so the two do not run together',
   art.endswith('attack roll with one. Spell save DC = 8 + your proficiency bonus + your Intelligence '
                'modifier. Spell attack modifier = your proficiency bonus + your Intelligence modifier.'), art)

# PHB Battle Master, "Combat Superiority" (class-fighter.json): two attributes
BM_ST = {"type": "entries", "entries": [{"type": "entries", "name": "Saving Throws", "entries": [
    "Some of your maneuvers require your target to make a saving throw to resist the maneuver's effects. The saving throw DC is calculated as follows:",
    {"type": "abilityDc", "name": "Maneuver", "attributes": ["str", "dex"]}]}]}
bm = C.flatten([BM_ST])
ck('several attributes join as 5e-tools does: "X or Y modifier (your choice)"',
   bm.endswith('Maneuver save DC = 8 + your proficiency bonus + your Strength or Dexterity modifier (your choice).'), bm)
# book-xphb.json writes the generic caster as "spellcasting"
ck('the "spellcasting" attribute reads "spellcasting ability modifier"',
   C.flatten([{"type": "abilityAttackMod", "name": "Spell", "attributes": ["spellcasting"]}])
   == 'Spell attack modifier = your proficiency bonus + your spellcasting ability modifier.')
# abilityGeneric, the third of the family (book-xdmg.json, book-phb.json)
ck('abilityGeneric: "Name = text"',
   C.flatten([{"type": "abilityGeneric", "name": "DC", "page": 29, "text": "8 + ability modifier + Proficiency Bonus"}])
   == 'DC = 8 + ability modifier + Proficiency Bonus.')
ck('abilityGeneric: text alone',
   C.flatten([{"type": "abilityGeneric", "text": "10 + all modifiers that normally apply to the check"}])
   == '10 + all modifiers that normally apply to the check.')
ck('abilityGeneric: attributes follow the text (renderdemo.json)',
   C.flatten([{"type": "abilityGeneric", "name": "Initiative", "text": "10 - your power level + somebody else's",
               "attributes": ["dex", "str"]}])
   == "Initiative = 10 - your power level + somebody else's Dexterity or Strength modifier (your choice).")

# XDMG Cackle Fever (conditionsdiseases.json): list items with a SINGULAR entry
CACKLE = ["Cheaply made potions and elixirs are sometimes tainted by Cackle Fever, which affects Humanoids only (gnomes are strangely immune). A creature suffers the following effects {@dice 1d4} days after infection:",
          {"type": "list", "style": "list-hang-notitle", "items": [
              {"type": "item", "name": "Fever", "entry": "The creature gains 1 {@condition Exhaustion|XPHB} level, which lasts until the contagion ends on the creature."},
              {"type": "item", "name": "Uncontrollable Laughter", "entry": "While the creature has the {@condition Exhaustion|XPHB} condition, the creature makes a {@dc 13} Constitution saving throw each time it takes damage other than Psychic damage."}]}]
cf = C.flatten(CACKLE)
ck('an item with a singular entry is kept (Cackle Fever)',
   'days after infection:\nFever: The creature gains 1 Exhaustion level, which lasts until the contagion ends on the creature.\n'
   'Uncontrollable Laughter: While the creature has the Exhaustion condition, the creature makes a DC 13' in cf, cf)
one = {"type": "item", "name": "Bite", "entry": "It deals {@damage 1d8} piercing damage on a hit."}
ck('...and reads exactly as the same item written with `entries`',
   C.flatten([one]) == C.flatten([{"type": "item", "name": "Bite", "entries": [one['entry']]}]) == 'Bite: It deals 1d8 piercing damage on a hit.',
   C.flatten([one]))

# XPHB Soulknife, "Psychic Blades" (class-rogue.json): the traits are a statblock
PB_FEAT = ["You can manifest shimmering blades of psychic energy. Whenever you take the {@action Attack|XPHB} action or make an {@action Opportunity Attack|XPHB}, you can manifest a {@item Psychic Blade|XPHB} in your free hand and make the attack with that blade. The magic blade has the following traits:",
           {"type": "statblock", "tag": "item", "name": "Psychic Blade", "source": "XPHB"},
           "The blade vanishes immediately after it hits or misses its target, and it leaves no mark if it deals damage."]
PB_ITEM = {"name": "Psychic Blade", "source": "XPHB", "page": 136, "type": "M", "rarity": "none",
           "weaponCategory": "simple", "property": ["F|XPHB", "T|XPHB"],
           "mastery": [{"uid": "Vex|XPHB", "note": "you can use this property, and it doesn't count against the number of properties you can use with Weapon Mastery"}],
           "range": "60/120", "dmg1": "1d6", "dmgType": "Y"}
# items-base.json itemProperty, prose trimmed: only the abbreviation and name matter
PB_PROPS = [{"abbreviation": "F", "source": "XPHB", "page": 213, "entries": [{"type": "entries", "name": "Finesse", "entries": ["…"]}]},
            {"abbreviation": "T", "source": "XPHB", "page": 214, "template": "{{prop_name}} ({{item.range}} ft.)",
             "entries": [{"type": "entries", "name": "Thrown", "entries": ["…"]}]}]
PB_TRAITS = ("Psychic Blade: Simple Melee Weapon · Damage 1d6 psychic · Range 60/120 ft · "
             "Properties: Finesse, Thrown · Mastery: Vex (you can use this property, and it doesn't count "
             "against the number of properties you can use with Weapon Mastery).")
with C.statblock_ctx(C.load_item_index(_tmpjson({'itemProperty': PB_PROPS, 'baseitem': []}),
                                       _tmpjson({'item': [PB_ITEM]}))):
    C._ENTRY_MISSES.clear()
    pb = C.flatten(PB_FEAT)
    ck('a statblock embeds the item it names (Psychic Blade)',
       'has the following traits:\n' + PB_TRAITS + '\nThe blade vanishes' in pb, pb)
    ck('...and a resolved statblock is not a miss', not C._ENTRY_MISSES, dict(C._ENTRY_MISSES))
    # a statblock whose item is not in the index names it, and is reported
    ck('an unresolvable statblock falls back to its name',
       C.flatten([{"type": "statblock", "tag": "item", "name": "Nowhere Blade", "source": "XPHB"}]) == 'Nowhere Blade.')
    ck('...and is counted', C._ENTRY_MISSES.get('statblock') == 1, dict(C._ENTRY_MISSES))
C._ENTRY_MISSES.clear()
# with no index at all (a single subcommand), the same fallback — not silence
ck('no item index: the statblock still names what it embeds',
   C.flatten(PB_FEAT[1:2]) == 'Psychic Blade.' and C._ENTRY_MISSES.get('statblock') == 1, dict(C._ENTRY_MISSES))

# every shape above, known and handled, counts nothing
C._ENTRY_MISSES.clear()
for shape in (AA_OPTS, [ART_SC], [BM_ST], CACKLE, [one]):
    C.flatten(shape)
ck('handled node types are not misses', not C._ENTRY_MISSES, dict(C._ENTRY_MISSES))
# images are deliberately skipped: they carry no rules text
ck('an image is skipped without a warning',
   C.flatten(["A.", {"type": "image", "href": {"type": "internal", "path": "x.webp"}}]) == 'A.' and not C._ENTRY_MISSES,
   dict(C._ENTRY_MISSES))

# the NEXT unknown type must not vanish the way these four did
ck('an unknown node type renders nothing...', C.flatten(["A.", {"type": "someFutureNode", "text": "lost"}]) == 'A.')
ck('...but is counted by type', C._ENTRY_MISSES.get('someFutureNode') == 1, dict(C._ENTRY_MISSES))
said = []
C._entry_miss_warnings(said.append)
ck('...and reported as a WARNING naming the type', len(said) == 1 and "'someFutureNode'" in said[0], said)
C._ENTRY_MISSES.clear()

# ...at the end of every kind of run, not only when a tables sink is collecting
import subprocess, shutil
CONV = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts', 'convert.py')
_odd = {'condition': [{'name': 'Odd', 'source': 'XPHB', 'entries': ['A.', {'type': 'someFutureNode'}]}]}
_dump = tempfile.mkdtemp()
json.dump(_odd, open(os.path.join(_dump, 'conditionsdiseases.json'), 'w'))
json.dump({'variantrule': [{'name': 'Odd', 'source': 'XGE', 'entries': ['A.', {'type': 'someFutureNode'}]}]},
          open(os.path.join(_dump, 'variantrules.json'), 'w'))
_out = tempfile.mkdtemp()
for label, argv in (('a single subcommand', ['conditions', os.path.join(_dump, 'conditionsdiseases.json'),
                                             '-o', os.path.join(_out, 'c.json')]),
                    ('all', ['all', _dump, '-o', os.path.join(_out, 'all')]),
                    ('supplement', ['supplement', _dump, '-o', os.path.join(_out, 'sup'), '--book', 'XGE'])):
    r = subprocess.run([sys.executable, CONV] + argv, capture_output=True, text=True)
    ck('%s warns about an unknown entry node' % label,
       "WARNING: 1 entry node(s) of type 'someFutureNode'" in r.stdout, r.stdout[-600:] + r.stderr[-300:])
shutil.rmtree(_dump, ignore_errors=True); shutil.rmtree(_out, ignore_errors=True)

# ---- 24. a table's footnotes ship with it (#73)
# 5e-tools hangs a table's footnotes off the node as `footnotes`, an array of
# entries. _norm_table() read rows, colLabels, colStyles and caption and nothing
# else, so 17 Xanathar's downtime tables shipped rows marked * with nothing
# saying what the mark meant. Both nodes are copied whole from the v2.36.1 dump
# (variantrules.json, XGE "Downtime Activity: Crime" and "...: Buying a Magic Item").
CRIME = {"type": "table", "caption": "Crime Complications", "colLabels": ["d8", "Complication"],
         "colStyles": ["col-2 text-center", "col-10"],
         "rows": [["1", "A bounty equal to your earnings is offered for information about your crime.*"],
                  ["2", "An unknown person contacts you, threatening to reveal your crime if you don't render a service.*"],
                  ["3", "Your victim is financially ruined by your crime."],
                  ["4", "Someone who knows of your crime has been arrested on an unrelated matter.*"],
                  ["5", "Your loot is a single, easily identified item that you can't fence in this region."],
                  ["6", "You robbed someone who was under a local crime lord's protection, and who now wants revenge."],
                  ["7", "Your victim calls in a favor from a guard, doubling the efforts to solve the case."],
                  ["8", "Your victim asks one of your adventuring companions to solve the crime."]],
         "footnotes": ["*Might involve a rival"]}
PRICE = {"type": "table", "caption": "Magic Item Price", "colLabels": ["Rarity", "Asking Price*"],
         "colStyles": ["col-5", "col-7 text-right"],
         "rows": [["Common", "({@dice 1d6 + 1}) × 10 gp"], ["Uncommon", "{@dice 1d6 × 100} gp"],
                  ["Rare", "{@dice 2d10 × 1,000} gp"], ["Very rare", "({@dice 1d4 + 1}) × 10,000 gp"],
                  ["Legendary", "{@dice 2d6 × 25,000} gp"]],
         "footnotes": ["*Halved for a consumable item like a potion or scroll"]}
fsink = []
with C.table_ctx(fsink, 'Downtime Activity: Crime', 'rule'):
    ftxt = C.flatten(["You might commit a crime.", CRIME, PRICE])
fc, fp = fsink[0], fsink[1]
ck('#73 a table keeps its footnotes', fc.get('footnotes') == ['*Might involve a rival'], fc.get('footnotes'))
ck('#73 ...and the rows keep the * they point from',
   fc['rows'][0][1].endswith('crime.*') and not fc['rows'][2][1].endswith('*'), fc['rows'])
ck('#73 a footnote for a starred column label', fp.get('footnotes') == ['*Halved for a consumable item like a potion or scroll']
   and fp['cols'] == ['Rarity', 'Asking Price*'], [fp['cols'], fp.get('footnotes')])
ck('#73 footnotes sit after the rows, before the caption',
   list(fc) == ['name', 'cols', 'align', 'rows', 'footnotes', 'caption', 'owner', 'ownerKind'], list(fc))
ck('#73 the anchors are unchanged', ftxt.endswith('[Table: Crime Complications]\n[Table: Magic Item Price]'), ftxt)
ck('#73 a table with no footnotes gains no key', 'footnotes' not in sink3[0] and 'footnotes' not in s4[0], sink3[0])
fe = []
with C.table_ctx(fe, 'X', 'rule'):
    C.flatten([dict(CRIME, footnotes=[])])
ck('#73 an empty footnotes list gains no key', 'footnotes' not in fe[0], fe[0])

# Footnotes are entries, like cells: the same text path de-tags a string and
# flattens an entries object. Blank ones are dropped rather than shipped empty.
ftag = {"type": "table", "colLabels": ["Item"], "rows": [["Potion of Healing*"]],
        "footnotes": ["*See the {@item Potion of Healing|XDMG} entry.",
                      {"type": "entries", "entries": ["Roll {@dice 1d4} {@b more}."]}, "", "   "]}
ft = []
with C.table_ctx(ft, 'X', 'rule'):
    C.flatten([ftag])
ck('#73 footnote tags are rendered the way cell tags are',
   ft[0].get('footnotes') == ['*See the Potion of Healing entry.', 'Roll 1d4 more.'], ft[0].get('footnotes'))

# The identical-table reuse in _register() must not merge a footnoted table into
# an unfootnoted twin: the second would lose its footnotes (or gain the first's).
fd = []
with C.table_ctx(fd, 'X', 'rule'):
    C.flatten([dict(CRIME, footnotes=None)]); C.flatten([CRIME]); C.flatten([CRIME])
ck('#73 a twin that differs only in its footnotes is not reused',
   [t.get('footnotes') for t in fd] == [None, ['*Might involve a rival']], [t.get('footnotes') for t in fd])
ck('#73 ...and a true duplicate still is', len(fd) == 2, len(fd))

# end to end through the glossary path, the one Xanathar's downtime tables take
fg = []
_vr = _tmpjson({'variantrule': [{'name': 'Downtime Activity: Crime', 'source': 'XGE',
                                 'entries': ['You might commit a crime.', CRIME]}]})
C.convert_glossary(_vr, tables=fg, book=XGE)
ck('#73 a supplement rule\'s table ships its footnotes',
   len(fg) == 1 and fg[0].get('footnotes') == ['*Might involve a rival'] and fg[0].get('owner') == 'Downtime Activity: Crime',
   fg)

# ---- 25. magic weapons name their properties and mastery (#72)
# Only items-base.json defines what "F|XPHB" or "Nick|XPHB" means. The magic-item
# file carries the codes (copied from the base weapon) and no definitions, so
# reading names from the file being converted printed "Properties: F, L, T" on
# the Dagger of Venom -- and, "Finesse" never being in the list, gave it
# ability "str" where the Dagger has "finesse". Shapes copied from the v2.36.1
# dump; prose, loot tables and reference lists trimmed.
IB_PROPS = [
    {"abbreviation": "2H", "source": "XPHB", "template": "{{prop_name}}", "entries": [{"type": "entries", "name": "Two-Handed", "entries": ["…"]}]},
    {"abbreviation": "F", "source": "XPHB", "template": "{{prop_name}}", "entries": [{"type": "entries", "name": "Finesse", "entries": ["…"]}]},
    {"abbreviation": "H", "source": "XPHB", "template": "{{prop_name}}", "entries": [{"type": "entries", "name": "Heavy", "entries": ["…"]}]},
    {"abbreviation": "L", "source": "PHB", "template": "{{prop_name_lower}}", "entries": [{"type": "entries", "name": "Light", "entries": ["…"]}]},
    {"abbreviation": "L", "source": "XPHB", "template": "{{prop_name}}", "entries": [{"type": "entries", "name": "Light", "entries": ["…"]}]},
    {"abbreviation": "R", "source": "XPHB", "template": "{{prop_name}}", "entries": [{"type": "entries", "name": "Reach", "entries": ["…"]}]},
    # the one definition with no entries: its name is a top-level key
    {"name": "special", "abbreviation": "S", "source": "PHB", "template": "{{prop_name_lower}}"},
    {"abbreviation": "T", "source": "XPHB", "template": "{{prop_name}} ({{item.range}} ft.)", "entries": [{"type": "entries", "name": "Thrown", "entries": ["…"]}]},
    {"abbreviation": "V", "source": "XPHB", "template": "{{prop_name}} ({{item.dmg2}})", "entries": [{"type": "entries", "name": "Versatile", "entries": ["…"]}]},
]
IB_MASTERY = [{"name": n, "source": "XPHB", "entries": ["…"]} for n in ('Nick', 'Push', 'Sap', 'Topple', 'Vex')]
IB_BASE = [
    {"name": "Dagger", "source": "XPHB", "page": 215, "srd52": True, "basicRules2024": True, "edition": "one", "type": "M|XPHB", "rarity": "none", "weight": 1, "value": 200, "weaponCategory": "simple", "property": ["F|XPHB", "L|XPHB", "T|XPHB"], "mastery": ["Nick|XPHB"], "range": "20/60", "dmg1": "1d4", "dmgType": "P", "dagger": True, "weapon": True},
    {"name": "Warhammer", "source": "XPHB", "page": 215, "srd52": True, "basicRules2024": True, "edition": "one", "type": "M|XPHB", "rarity": "none", "weight": 5, "value": 1500, "weaponCategory": "martial", "property": ["V|XPHB"], "mastery": ["Push|XPHB"], "dmg1": "1d8", "dmgType": "B", "dmg2": "1d10", "hammer": True, "weapon": True},
    # a property carrying a note, the only object-shaped one in the dump
    {"name": "Lance", "source": "XPHB", "page": 215, "srd52": True, "basicRules2024": True, "edition": "one", "type": "M|XPHB", "rarity": "none", "weight": 6, "value": 1000, "weaponCategory": "martial", "property": ["H|XPHB", "R|XPHB", {"uid": "2H|XPHB", "note": "unless mounted"}], "mastery": ["Topple|XPHB"], "dmg1": "1d10", "dmgType": "P", "lance": True, "weapon": True},
    # the 2014 Net ships (XPHB reprinted it as gear), with the name-only "S"
    {"name": "Net", "source": "PHB", "page": 149, "basicRules": True, "edition": "classic", "type": "R", "rarity": "none", "weight": 3, "value": 100, "weaponCategory": "martial", "property": ["S", "T"], "range": "5/15", "net": True, "weapon": True},
]
IB_MAGIC = [
    {"name": "Dagger of Venom", "source": "XDMG", "page": 248, "srd52": True, "basicRules2024": True, "baseItem": "dagger|xphb", "type": "M|XPHB", "rarity": "rare", "weight": 1, "weaponCategory": "simple", "property": ["F|XPHB", "L|XPHB", "T|XPHB"], "mastery": ["Nick|XPHB"], "range": "20/60", "dmg1": "1d4", "dmgType": "P", "bonusWeapon": "+1"},
    # versatile, and adds Thrown and a range to its Warhammer
    {"name": "Dwarven Thrower", "source": "XDMG", "page": 256, "srd52": True, "basicRules2024": True, "baseItem": "warhammer|xphb", "type": "M|XPHB", "rarity": "very rare", "reqAttune": "by a Dwarf or a Creature Attuned to a {@item Belt of Dwarvenkind|XDMG}", "weight": 5, "weaponCategory": "martial", "property": ["T|XPHB", "V|XPHB"], "mastery": ["Push|XPHB"], "range": "20/60", "dmg1": "1d8", "dmgType": "B", "dmg2": "1d10", "bonusWeapon": "+3"},
    # finesse where its Longsword is not
    {"name": "Sun Blade", "source": "XDMG", "page": 312, "srd52": True, "basicRules2024": True, "baseItem": "longsword|xphb", "type": "M|XPHB", "rarity": "rare", "reqAttune": True, "weight": 3, "weaponCategory": "martial", "property": ["F|XPHB", "V|XPHB"], "mastery": ["Sap|XPHB"], "dmg1": "1d8", "dmgType": "R", "dmg2": "1d10", "bonusWeapon": "+2"},
    # no base item at all: a staff is its own quarterstaff
    {"name": "Staff of Power", "source": "XDMG", "page": 308, "srd52": True, "basicRules2024": True, "type": "M|XPHB", "rarity": "very rare", "reqAttune": "by a sorcerer, warlock, or wizard", "weight": 4, "weaponCategory": "simple", "property": ["V|XPHB"], "mastery": ["Topple|XPHB"], "dmg1": "1d6", "dmgType": "B", "dmg2": "1d8", "bonusWeapon": "+2", "staff": True},
    PB_ITEM,    # the object-shaped mastery: {"uid": "Vex|XPHB", "note": …}
    # Tasha's: a bare 2014 code with no source at all
    {"name": "+1 Moon Sickle", "source": "TCE", "page": 133, "baseItem": "sickle|PHB", "type": "M", "rarity": "uncommon", "reqAttune": "by a druid or ranger", "weight": 2, "weaponCategory": "simple", "property": ["L"], "dmg1": "1d4", "dmgType": "S", "bonusWeapon": "+1"},
]
IB_BASEFILE = _tmpjson({'itemProperty': IB_PROPS, 'itemMastery': IB_MASTERY, 'baseitem': IB_BASE})
IB_MAGICFILE = _tmpjson({'item': IB_MAGIC})
TCE = C.Book(codes=['TCE'], system='TCE')
def _by_name(pack): return {x['name']: x for x in pack['items']}

C._WEAPON_MISSES.clear()
with C.statblock_ctx(C.load_item_index(IB_BASEFILE, IB_MAGICFILE)):      # as `all` and `supplement` set it
    ib_base = _by_name(C.convert_items(IB_BASEFILE))
    ib_magic = _by_name(C.convert_items(IB_MAGICFILE))
    ib_tce = _by_name(C.convert_items(IB_MAGICFILE, book=TCE))
dov = ib_magic.get('Dagger of Venom', {})
ck('Dagger of Venom names its properties and mastery',
   dov.get('weapon', {}).get('notes') == 'Range 20/60 · Finesse, Light, Thrown · Mastery: Nick', dov.get('weapon'))
ck('...and attacks with finesse, as the Dagger does', dov.get('weapon', {}).get('ability') == 'finesse', dov.get('weapon'))
ck('...its description reads the same names',
   dov.get('description', '').startswith('Damage 1d4 piercing · Range 20/60 ft · Properties: Finesse, Light, '
                                         'Thrown · Mastery: Nick · Base item: Dagger'), dov.get('description'))
_dg = ib_base.get('Dagger', {}).get('weapon', {})
ck('...and its weapon is the base Dagger\'s, plus only its +1',
   {k: v for k, v in dov.get('weapon', {}).items() if k not in ('atkMisc', 'dmgMisc')} == _dg
   and dov['weapon'].get('atkMisc') == 1 and dov['weapon'].get('dmgMisc') == 1, (dov.get('weapon'), _dg))
dt = ib_magic.get('Dwarven Thrower', {}).get('weapon', {})
ck('a versatile magic weapon: the Versatile dice once, not again as a bare "V"',
   dt.get('notes') == 'Range 20/60 · Versatile 1d10 · Thrown · Mastery: Push', dt)
ck('...and it keeps Strength, as its Warhammer does',
   dt.get('ability') == 'str' == ib_base.get('Warhammer', {}).get('weapon', {}).get('ability'), dt)
ck('the Sun Blade\'s own Finesse makes it a finesse weapon',
   ib_magic.get('Sun Blade', {}).get('weapon', {}).get('ability') == 'finesse', ib_magic.get('Sun Blade'))
ck('a staff with no base item names Versatile too (Staff of Power)',
   ib_magic.get('Staff of Power', {}).get('weapon', {}).get('notes') == 'Versatile 1d8 · Mastery: Topple',
   ib_magic.get('Staff of Power', {}).get('weapon'))
pbw = ib_magic.get('Psychic Blade', {}).get('weapon', {})
ck('an object-shaped mastery reads as the statblock reads it, note and all (Psychic Blade)',
   pbw.get('notes') == 'Range 60/120 · Finesse, Thrown · Mastery: Vex (you can use this property, and it '
                       "doesn't count against the number of properties you can use with Weapon Mastery)", pbw)
ck('...not the dict\'s repr', '{' not in json.dumps(ib_magic.get('Psychic Blade', {}).get('description', '')) and
   "'uid'" not in pbw.get('notes', ''), ib_magic.get('Psychic Blade'))
ck('...and attacks with finesse', pbw.get('ability') == 'finesse', pbw)
ms = ib_tce.get('+1 Moon Sickle', {})
ck('a bare 2014 code resolves as well (Tasha\'s +1 Moon Sickle: "L")',
   ms.get('weapon', {}).get('notes') == 'Light' and 'Properties: Light · Base item: Sickle' in ms.get('description', ''), ms)
ck('an object-shaped property keeps its note (Lance)',
   ib_base.get('Lance', {}).get('weapon', {}).get('notes') == 'Heavy, Reach, Two-Handed (unless mounted) · Mastery: Topple',
   ib_base.get('Lance', {}).get('weapon'))
ck('a definition whose name is a top-level key resolves (Net: "S")',
   ib_base.get('Net', {}).get('weapon', {}).get('notes') == 'Range 5/15 · Special, Thrown', ib_base.get('Net', {}).get('weapon'))
ck('every code in the fixtures resolved: nothing to warn about', not C._WEAPON_MISSES, dict(C._WEAPON_MISSES))

# the statblock reads the same definitions through the same resolver
with C.statblock_ctx(C.load_item_index(IB_BASEFILE, IB_MAGICFILE)):
    ck('the Soulknife statblock still reads exactly as before',
       C.flatten(PB_FEAT[1:2]) == PB_TRAITS, C.flatten(PB_FEAT[1:2]))

# a code nothing defines is printed as it stands AND reported, never passed through quietly
WOBBLE = {"name": "Wobbling Blade", "source": "XDMG", "srd52": True, "type": "M|XPHB", "rarity": "rare",
          "weaponCategory": "martial", "property": ["F|XPHB", "Zz|XPHB"], "mastery": ["Wobble|XPHB"],
          "dmg1": "1d8", "dmgType": "S"}
C._WEAPON_MISSES.clear()
with C.statblock_ctx(C.load_item_index(IB_BASEFILE)):
    wb = C.convert_items(_tmpjson({'item': [WOBBLE]}))['items'][0]['weapon']
ck('an unknown property or mastery code is printed as the code', wb.get('notes') == 'Finesse, Zz · Mastery: Wobble', wb)
ck('...and counted with the item it is on',
   C._WEAPON_MISSES.get(('property', 'Zz')) == {'Wobbling Blade'} and C._WEAPON_MISSES.get(('mastery', 'Wobble')) == {'Wobbling Blade'},
   dict(C._WEAPON_MISSES))
said = []
C._weapon_miss_warnings(said.append)
ck('...and reported as one WARNING per code, naming the item',
   len(said) == 2 and any("'Zz'" in s and 'Wobbling Blade' in s for s in said), said)
# with no definitions at all -- the magic file alone -- every code is a miss, not a silent pass
C._WEAPON_MISSES.clear()
C.convert_items(IB_MAGICFILE)
ck('no definitions: the Dagger of Venom\'s codes are all reported',
   all(('property', c) in C._WEAPON_MISSES for c in ('F', 'L', 'T')) and ('mastery', 'Nick') in C._WEAPON_MISSES,
   dict(C._WEAPON_MISSES))
C._WEAPON_MISSES.clear()

# ...at the end of every kind of run that converts items
_dump = tempfile.mkdtemp()
json.dump({'itemProperty': IB_PROPS, 'itemMastery': IB_MASTERY, 'baseitem': IB_BASE},
          open(os.path.join(_dump, 'items-base.json'), 'w'))
json.dump({'item': IB_MAGIC + [WOBBLE, dict(WOBBLE, source='TCE')]}, open(os.path.join(_dump, 'items.json'), 'w'))
_out = tempfile.mkdtemp()
for label, argv, outfile in (
        ('`items` on the magic file, items-base.json beside it',
         ['items', os.path.join(_dump, 'items.json'), '-o', os.path.join(_out, 'i.json')], 'i.json'),
        ('all', ['all', _dump, '-o', os.path.join(_out, 'all')], os.path.join('all', 'items-magic.json')),
        ('supplement', ['supplement', _dump, '-o', os.path.join(_out, 'sup'), '--book', 'TCE'],
         os.path.join('sup', 'items-magic.json'))):
    r = subprocess.run([sys.executable, CONV] + argv, capture_output=True, text=True)
    ck('%s warns about the unknown code' % label,
       "WARNING: weapon property 'Zz'" in r.stdout and 'Wobbling Blade' in r.stdout, r.stdout[-800:] + r.stderr[-300:])
    try:
        got = _by_name(json.load(open(os.path.join(_out, outfile), encoding='utf-8')))
    except (OSError, ValueError) as e:
        got = {'error': str(e)}
    want = 'Moon Sickle' if label == 'supplement' else 'Dagger of Venom'
    w = next((v.get('weapon', {}) for k, v in got.items() if want in k), {})
    ck('%s names the known codes' % label,
       w.get('notes') in ('Light', 'Range 20/60 · Finesse, Light, Thrown · Mastery: Nick'), got.get('error') or w)
shutil.rmtree(_dump, ignore_errors=True); shutil.rmtree(_out, ignore_errors=True)

# ---- 26. a +N weapon's bonus is the weapon's own, and counts once (#74)
# 5e-tools' bonusWeapon (and bonusWeaponAttack / bonusWeaponDamage) means rolls
# made with a weapon, nearly always one weapon. convert_items() writes it onto
# the item's weapon as atkMisc/dmgMisc; _item_effects() ALSO wrote it as global
# `attack`/`damage` effects, so attackNumbers() added it twice on the weapon's
# own row and once on every other attack, spell rows included, while it was
# equipped. The fixtures above are the real Dagger of Venom, Dwarven Thrower,
# Sun Blade, Staff of Power and Tasha's +1 Moon Sickle.
for label, pack, name, n in (('core', ib_magic, 'Dagger of Venom', 1), ('core', ib_magic, 'Dwarven Thrower', 3),
                             ('core', ib_magic, 'Sun Blade', 2), ('core', ib_magic, 'Staff of Power', 2),
                             ('TCE', ib_tce, '+1 Moon Sickle', 1)):
    e = pack.get(name, {})
    ck('#74 %s %s carries +%d on its own weapon, to hit and to damage' % (label, name, n),
       e.get('weapon', {}).get('atkMisc') == n and e.get('weapon', {}).get('dmgMisc') == n, e.get('weapon'))
    ck('#74 ...and %s has no attack or damage effect, which would reach every other attack' % name,
       e.get('effects') == [], e.get('effects'))
# The same field on an item that is not a weapon is scoped just as narrowly --
# bows only, one coated weapon, unarmed strikes, the rod's own mace form -- and
# no effect target can say "only that weapon", so it stays in the prose. Real
# shapes from the v2.36.1 dump, loot tables and all but the first entry trimmed.
NONWEAPON = [
    {"name": "Bracers of Archery", "source": "XDMG", "page": 240, "srd52": True, "basicRules2024": True, "rarity": "uncommon", "reqAttune": True, "wondrous": True, "grantsProficiency": True, "bonusWeaponDamage": "+2",
     "entries": ["While wearing these bracers, you have proficiency with the {@item Longbow|XPHB} and {@item Shortbow|XPHB}, and you gain a +2 bonus to damage rolls made with such weapons."]},
    {"name": "Rod of Lordly Might", "source": "XDMG", "page": 300, "srd52": True, "basicRules2024": True, "type": "RD|XDMG", "rarity": "legendary", "reqAttune": True, "weight": 2, "bonusWeapon": "+3", "light": [{"bright": 40, "dim": 80}],
     "entries": ["This rod has a flanged head, and it functions as a magic Mace that grants a +3 bonus to attack rolls and damage rolls made with it."]},
    {"name": "Oil of Sharpness", "source": "XDMG", "page": 282, "srd52": True, "basicRules2024": True, "referenceSources": ["DrDe-BtS"], "type": "P|XPHB", "rarity": "very rare", "weight": 0.5, "bonusWeapon": "+3",
     "entries": ["One vial of this oil can coat one Melee weapon or twenty pieces of ammunition, but only ammunition and Melee weapons that are nonmagical and deal Slashing or Piercing damage are affected."]},
    {"name": "Eldritch Claw Tattoo", "source": "TCE", "page": 126, "rarity": "uncommon", "reqAttune": True, "wondrous": True, "tattoo": True, "bonusWeapon": "+1",
     "entries": [{"type": "entries", "name": "Magical Strikes", "entries": ["While the tattoo is on your skin, your unarmed strikes are considered magical for the purpose of overcoming immunity and resistance to nonmagical attacks, and you gain a +1 bonus to attack and damage rolls with them."]}]},
    {"name": "Baba Yaga's Mortar and Pestle", "source": "TCE", "page": 121, "rarity": "artifact", "reqAttune": True, "wondrous": True, "bonusWeapon": "+3",
     "entries": ["The creations of the immortal hag Baba Yaga defy the laws of mortal magic."]},
    # the control: a bonus that really is global stays an effect
    {"name": "Ring of Protection", "source": "XDMG", "page": 294, "srd52": True, "basicRules2024": True, "type": "RG|XDMG", "rarity": "rare", "reqAttune": True, "bonusAc": "+1", "bonusSavingThrow": "+1", "classFeatures": ["replicate magic item|artificer|efa|2|efa"],
     "entries": ["You gain a +1 bonus to {@variantrule Armor Class|XPHB} and saving throws while wearing this ring."]},
]
_nwf = _tmpjson({'item': NONWEAPON})
with C.statblock_ctx(C.load_item_index(IB_BASEFILE, _nwf)):
    nw = dict(_by_name(C.convert_items(_nwf)), **_by_name(C.convert_items(_nwf, book=TCE)))
for name, needle in (('Bracers of Archery', '+2 bonus to damage rolls made with such weapons'),
                     ('Rod of Lordly Might', '+3 bonus to attack rolls and damage rolls made with it'),
                     ('Oil of Sharpness', 'coat one Melee weapon'),
                     ('Eldritch Claw Tattoo', '+1 bonus to attack and damage rolls with them'),
                     ("Baba Yaga's Mortar and Pestle", 'defy the laws of mortal magic')):
    e = nw.get(name, {})
    ck('#74 %s: its weapon-only bonus is not an effect on every attack' % name,
       name in nw and e.get('effects') == [] and 'weapon' not in e, e.get('effects'))
    ck('#74 ...and %s\'s prose still states it' % name, needle in e.get('description', ''), e.get('description', '')[:120])
ring = nw.get('Ring of Protection', {})
ck('#74 a Ring of Protection keeps its AC and saving-throw effects',
   ring.get('effects') == [{'target': 'ac', 'value': 1}] + [{'target': 'save.' + a, 'value': 1}
                                                              for a in ('str', 'dex', 'con', 'int', 'wis', 'cha')],
   ring.get('effects'))
ck('#74 _item_effects() never turns a weapon bonus into an effect',
   C._item_effects({'bonusWeapon': '+2', 'bonusWeaponAttack': '+1', 'bonusWeaponDamage': '+1'}) == [],
   C._item_effects({'bonusWeapon': '+2', 'bonusWeaponAttack': '+1', 'bonusWeaponDamage': '+1'}))
# ...while a weapon's split bonus still lands on the weapon, each half on its own box
_split = dict(IB_MAGIC[0], name='Split Dagger', bonusWeapon=None, bonusWeaponAttack='+2', bonusWeaponDamage='+1')
with C.statblock_ctx(C.load_item_index(IB_BASEFILE)):
    sp = C.convert_items(_tmpjson({'item': [_split]}))['items'][0]
ck('#74 a split attack/damage bonus lands on the weapon, each half in its own box',
   sp.get('weapon', {}).get('atkMisc') == 2 and sp.get('weapon', {}).get('dmgMisc') == 1 and sp.get('effects') == [],
   [sp.get('weapon'), sp.get('effects')])

# ---- 27. a ranged finesse weapon uses the better of STR and DEX (#75)
# Finesse lets an attack use STR or DEX whether it is a melee or a ranged
# attack; the ability test asked "ranged?" first and gave every ranged weapon
# "dex", so a Dart (Finesse, Thrown) could never use Strength. The real XPHB
# Dart, beside the fixtures' Net (ranged, no Finesse) and Dagger (melee).
DART = {"name": "Dart", "source": "XPHB", "page": 215, "srd52": True, "basicRules2024": True, "edition": "one", "type": "R|XPHB", "rarity": "none", "weight": 0.25, "value": 5, "weaponCategory": "simple", "property": ["F|XPHB", "T|XPHB"], "mastery": ["Vex|XPHB"], "range": "20/60", "dmg1": "1d4", "dmgType": "P", "weapon": True, "hasFluffImages": True}
_dartf = _tmpjson({'itemProperty': IB_PROPS, 'itemMastery': IB_MASTERY, 'baseitem': IB_BASE + [DART]})
with C.statblock_ctx(C.load_item_index(_dartf)):
    dpack = _by_name(C.convert_items(_dartf))
dw = dpack.get('Dart', {}).get('weapon', {})
ck('#75 a Dart attacks with finesse, the better of STR and DEX', dw.get('ability') == 'finesse', dw)
ck('#75 ...and is still a ranged weapon with its range and properties',
   dw.get('kind') == 'ranged' and dw.get('notes') == 'Range 20/60 · Finesse, Thrown · Mastery: Vex', dw)
ck('#75 a ranged weapon without Finesse still uses DEX (Net)',
   dpack.get('Net', {}).get('weapon', {}).get('ability') == 'dex', dpack.get('Net', {}).get('weapon'))
ck('#75 a melee finesse weapon is unchanged (Dagger)', dpack.get('Dagger', {}).get('weapon', {}).get('ability') == 'finesse')
ck('#75 a melee weapon without Finesse still uses STR (Warhammer)',
   dpack.get('Warhammer', {}).get('weapon', {}).get('ability') == 'str')

# ---- 28. a bonus the book gives only in a moment is not a standing effect (#76)
# 5e-tools tags an item's bonusAc / bonusSavingThrow for its search filters,
# whether the book gives the bonus all the time or only now and then. Written as
# `ac` / `save.*` effects, a conditional one applied whenever the item was
# equipped: Quarterstaff of the Acrobat's once-per-rest Reaction against one
# attack read AC +5 at all times. No field in the dump tells the two apart (the
# Arrow-Catching Shield's +2 against ranged attacks and the Shield of the
# Cavalier's standing +2 have the same shape), so the converter reads the
# sentence that states the bonus. Real shapes from the v2.36.1 dump, loot tables
# and cross-references trimmed; a long item keeps only the entry that states it.
B76_CONDITIONAL = [
    {"name": "Quarterstaff of the Acrobat", "source": "XDMG", "page": 291, "srd52": True, "basicRules2024": True, "baseItem": "quarterstaff|xphb", "type": "M|XPHB", "rarity": "very rare", "reqAttune": True, "weight": 4, "weaponCategory": "simple", "property": ["T|XPHB", "V|XPHB"], "mastery": ["Topple|XPHB"], "range": "30/120", "dmg1": "1d6", "dmgType": "B", "dmg2": "1d8", "bonusWeapon": "+2", "bonusAc": "+5", "staff": True, "entries": ["You have a +2 bonus to attack rolls and damage rolls made with this magic weapon.", "While holding this weapon, you can cause it to emit green {@variantrule Dim Light|XPHB} out to 10 feet, either as a {@variantrule Bonus Action|XPHB} or after you roll {@variantrule Initiative|XPHB}, or you can extinguish the light as a {@variantrule Bonus Action|XPHB}.", "While holding this weapon, you can take a {@variantrule Bonus Action|XPHB} to alter its form, turning it into a 6-inch rod (for ease of storage) or a 10-foot pole, or reverting it a Quarterstaff; the weapon will elongate only as far as the surrounding space allows.", "In certain forms, the weapon has the following additional properties.", {"type": "entries", "name": "Acrobatic Assist (Quarterstaff and 10-Foot Pole Forms Only)", "entries": ["While holding this weapon, you have {@variantrule Advantage|XPHB} on Dexterity ({@skill Acrobatics|XPHB}) checks."]}, {"type": "entries", "name": "Attack Deflection (Quarterstaff Form Only)", "entries": ["When you are hit by an attack while holding the weapon, you can take a {@variantrule Reaction|XPHB} to twirl the weapon around you, gaining a +5 bonus to your {@variantrule Armor Class|XPHB} against the triggering attack, potentially causing the attack to miss you. You can't use this property again until you finish a {@variantrule Short Rest|XPHB|Short} or {@variantrule Long Rest|XPHB}."]}, {"type": "entries", "name": "Ranged Weapon (Quarterstaff Form Only)", "entries": ["This weapon has {@itemProperty T|XPHB|Thrown} with a normal range of 30 feet and a long range of 120 feet. Immediately after you make a ranged attack with the weapon, it flies back to your hand."]}], "light": [{"dim": 10}]},
    {"name": "Arrow-Catching Shield", "source": "XDMG", "page": 231, "srd52": True, "basicRules2024": True, "baseItem": "shield|xphb", "type": "S|XPHB", "rarity": "rare", "reqAttune": True, "weight": 6, "ac": 2, "bonusAc": "+2", "entries": ["You gain a +2 bonus to {@variantrule Armor Class|XPHB} against ranged attack rolls while you wield this Shield. This bonus is in addition to the Shield's normal bonus to AC.", "Whenever an attacker makes a ranged attack roll against a target within 5 feet of you, you can take a {@variantrule Reaction|XPHB} to become the target of the attack instead."]},
    {"name": "Bracers of Defense", "source": "XDMG", "page": 241, "srd52": True, "basicRules2024": True, "rarity": "rare", "reqAttune": True, "wondrous": True, "bonusAc": "+2", "entries": ["While wearing these bracers, you gain a +2 bonus to {@variantrule Armor Class|XPHB} if you are wearing no armor and using no {@item Shield|XPHB}."]},
    {"name": "Rod of Alertness", "source": "XDMG", "page": 299, "srd52": True, "basicRules2024": True, "type": "RD|XDMG", "rarity": "very rare", "reqAttune": True, "weight": 2, "bonusAc": "+1", "bonusSavingThrow": "+1", "entries": ["This rod has the following properties.", {"type": "entries", "name": "Alertness", "entries": ["While holding the rod, you have {@variantrule Advantage|XPHB} on Wisdom ({@skill Perception|XPHB}) checks and on {@variantrule Initiative|XPHB} rolls."]}, {"type": "entries", "name": "Spells", "entries": ["While holding the rod, you can cast the following spells from it:", {"type": "list", "items": ["{@spell Detect Evil and Good|XPHB}", "{@spell Detect Magic|XPHB}", "{@spell Detect Poison and Disease|XPHB}", "{@spell See Invisibility|XPHB}"]}]}, {"type": "entries", "name": "Protective Aura", "entries": ["As a {@action Magic|XPHB} action, you can plant the haft end of the rod in the ground, whereupon the rod's head sheds {@variantrule Bright Light|XPHB} in a 60-foot radius and {@variantrule Dim Light|XPHB} for an additional 60 feet. While in that {@variantrule Bright Light|XPHB}, you and your allies gain a +1 bonus to {@variantrule Armor Class|XPHB} and saving throws and can sense the location of any {@condition Invisible|XPHB} creature that is also in the {@variantrule Bright Light|XPHB}.", "The rod's head stops glowing and the effect ends after 10 minutes or when a creature takes a {@action Magic|XPHB} action to pull the rod from the ground. Once used, this property can't be used again until the next dawn."]}], "light": [{"bright": 60, "dim": 120}]},
]
B76_STANDING = [
    {"name": "Cloak of Protection", "source": "XDMG", "page": 245, "srd52": True, "basicRules2024": True, "rarity": "uncommon", "reqAttune": True, "wondrous": True, "bonusAc": "+1", "bonusSavingThrow": "+1", "entries": ["You gain a +1 bonus to {@variantrule Armor Class|XPHB} and saving throws while you wear this cloak."]},
    {"name": "Scarab of Protection", "source": "XDMG", "page": 302, "srd52": True, "basicRules2024": True, "rarity": "legendary", "reqAttune": True, "wondrous": True, "weight": 1, "bonusAc": "+1", "charges": 12, "entries": ["This beetle-shaped medallion provides three benefits while it is on your person.", {"type": "entries", "name": "Defense", "entries": ["You gain a +1 bonus to {@variantrule Armor Class|XPHB}."]}, {"type": "entries", "name": "Preservation", "entries": ["The scarab has 12 charges. If you fail a saving throw against a Necromancy spell or a harmful effect originating from an Undead, you can take a {@variantrule Reaction|XPHB} to expend 1 charge and turn the failed save into a successful one. The scarab crumbles into powder and is destroyed when its last charge is expended."]}, {"type": "entries", "name": "Spell Resistance", "entries": ["You have {@variantrule Advantage|XPHB} on saving throws against spells."]}]},
    {"name": "Shield of the Cavalier", "source": "XDMG", "page": 304, "srd52": True, "basicRules2024": True, "baseItem": "shield|xphb", "type": "S|XPHB", "rarity": "very rare", "reqAttune": True, "weight": 6, "ac": 2, "bonusAc": "+2", "entries": ["While holding this Shield, you have a +2 bonus to {@variantrule Armor Class|XPHB}. This bonus is in addition to the Shield's normal bonus to AC."]},
    {"name": "Stone of Good Luck", "alias": ["Luckstone"], "source": "XDMG", "page": 312, "srd52": True, "basicRules2024": True, "rarity": "uncommon", "reqAttune": True, "wondrous": True, "bonusSavingThrow": "+1", "bonusAbilityCheck": "+1", "entries": ["While this polished agate is on your person, you gain a +1 bonus to ability checks and saving throws."]},
    {"name": "Robe of Stars", "source": "XDMG", "page": 297, "srd52": True, "basicRules2024": True, "rarity": "very rare", "reqAttune": True, "wondrous": True, "bonusSavingThrow": "+1", "rechargeAmount": "{@dice 1d6}", "charges": 6, "entries": ["This black or dark-blue robe is embroidered with small white or silver stars. You gain a +1 bonus to saving throws while you wear it."]},
    {"name": "Glamoured Studded Leather", "source": "XDMG", "page": 264, "srd52": True, "basicRules2024": True, "baseItem": "studded leather armor|xphb", "type": "LA|XPHB", "rarity": "rare", "weight": 13, "ac": 12, "bonusAc": "+1", "entries": ["While wearing this armor, you gain a +1 bonus to {@variantrule Armor Class|XPHB}. You can also take a {@variantrule Bonus Action|XPHB} to cause the armor to assume the appearance of a normal set of clothing or some other kind of armor. You decide what it looks like—including color, style, and accessories—but the armor retains its normal bulk and weight. The illusory appearance lasts until you use this property again or doff the armor."]},
    {"name": "Ioun Stone, Protection", "source": "XDMG", "page": 273, "srd52": True, "basicRules2024": True, "rarity": "rare", "reqAttune": True, "wondrous": True, "bonusAc": "+1", "hasRefs": True, "entries": ["{#itemEntry Ioun Stone|XDMG}", "You gain a +1 bonus to {@variantrule Armor Class|XPHB} while this dusty-rose prism orbits your head."]},
    {"name": "Black Dragon Scale Mail", "source": "XDMG", "page": 254, "srd52": True, "basicRules2024": True, "baseItem": "scale mail|xphb", "type": "MA|XPHB", "resist": ["acid"], "detail1": "black", "rarity": "very rare", "reqAttune": True, "weight": 45, "ac": 14, "bonusAc": "+1", "stealth": True, "hasRefs": True, "entries": ["{#itemEntry Dragon Scale Mail|XDMG}"]},
    {"name": "Staff of Power", "source": "XDMG", "page": 308, "srd52": True, "basicRules2024": True, "type": "M|XPHB", "rarity": "very rare", "reqAttune": "by a sorcerer, warlock, or wizard", "reqAttuneTags": [{"class": "sorcerer"}, {"class": "warlock"}, {"class": "wizard"}], "weight": 4, "weaponCategory": "simple", "property": ["V|XPHB"], "mastery": ["Topple|XPHB"], "dmg1": "1d6", "dmgType": "B", "dmg2": "1d8", "bonusWeapon": "+2", "bonusSpellAttack": "+2", "bonusAc": "+2", "bonusSavingThrow": "+2", "recharge": "dawn", "rechargeAmount": "{@dice 2d8 + 4}", "charges": 20, "staff": True, "entries": ["This staff has 20 charges and can be wielded as a magic Quarterstaff that grants a +2 bonus to attack rolls and damage rolls made with it. While holding it, you gain a +2 bonus to {@variantrule Armor Class|XPHB}, saving throws, and spell attack rolls."]},
]
B76_TEETH = {"name": "Teeth of Dahlver-Nar", "source": "TCE", "page": 135, "rarity": "artifact", "reqAttune": True, "wondrous": True, "bonusAc": "+2", "modifySpeed": {"static": {"fly": 30}}, "recharge": "dawn", "rechargeAmount": 8, "charges": 8, "entries": ["The Teeth of Dahlver-Nar are stories given form. They are a collection of teeth, each suggestive of wildly different origins and made from various materials. The collection rests within a leather pouch, stitched with images of heroes and whimsical creatures. Where the teeth fall, they bring legends to life.", {"type": "entries", "name": "Using the Teeth", "entries": ["While you are holding the pouch, you can use an action to draw one tooth. Roll on the Teeth of Dahlver-Nar table to determine which tooth you draw, and you can either sow the tooth or implant it (both of which are described later).", {"type": "table", "caption": "Teeth of Dahlver-Nar", "colLabels": ["d20", "Tale and Tooth", "Creatures Summoned", "Implanted Effect"], "colStyles": ["col-2 text-center", "col-2", "col-1", "col-7"], "rows": [["5", "Dooms of the Malpheggi (emerald lizardfolk fang)", "1 {@creature lizard queen||lizardfolk queen} and 4 {@creature lizardfolk}", "You gain reptilian scales, granting you a +2 bonus to your AC. Additionally, when you finish a long rest, you must succeed on a {@dc 15} Constitution saving throw or gain 1 level of {@condition exhaustion}."]]}]}]}
# The templates two of them embed as "{#itemEntry …}": the Dragon Scale Mails'
# bonus is stated only there.
B76_ENTRIES = [
    {"name": "Dragon Scale Mail", "source": "XDMG", "entriesTemplate": ["Dragon Scale Mail is made of the scales of one kind of dragon. Sometimes dragons collect their cast-off scales and gift them. Other times, hunters carefully preserve the hide of a dead dragon. In either case, Dragon Scale Mail is highly valued.", "While wearing this armor, you gain a +1 bonus to {@variantrule Armor Class|XPHB}, you have {@variantrule Advantage|XPHB} on saving throws against the breath weapons of Dragons, and you have {@variantrule Resistance|XPHB} to {{getFullImmRes item.resist}} damage.", "Additionally, you can focus your senses as a {@action Magic|XPHB} action to discern the distance and direction to the closest {{item.detail1}} dragon within 30 miles of yourself. This action can't be used again until the next dawn."]},
    {"name": "Ioun Stone", "source": "XDMG", "entriesTemplate": ["Roughly marble sized, {@i Ioun Stones} are named after Ioun, a god of knowledge and prophecy revered on some worlds. Many types of {@i Ioun Stones} exist, each type a distinct combination of shape and color.", "When you take a {@action Magic|XPHB} action to toss an {@i Ioun Stone} into the air, the stone orbits your head at a distance of {@dice 1d3} feet, conferring its benefit to you while doing so. You can have up to three {@i Ioun Stones} orbiting your head at the same time.", "Each {@i Ioun Stone} orbiting your head is considered to be an object you are wearing. The orbiting stone avoids contact with other creatures and objects, adjusting its orbit to avoid collisions and thwarting all attempts by other creatures to attack or snatch it.", "As a {@action Utilize|XPHB} action, you can seize and stow any number of {@i Ioun Stones} orbiting your head. If your {@variantrule Attunement|XPHB} to an Ioun Stone ends while it's orbiting your head, the stone falls as though you had dropped it."]},
]
_b76base = _tmpjson({'itemProperty': IB_PROPS, 'itemMastery': IB_MASTERY, 'baseitem': IB_BASE, 'itemEntry': B76_ENTRIES})
_b76magic = _tmpjson({'item': B76_CONDITIONAL + B76_STANDING + [B76_TEETH]})
_BP = getattr(C, '_BONUS_PROSE', None)
if _BP is not None: _BP.clear()
with C.statblock_ctx(C.load_item_index(_b76base, _b76magic)):
    b76 = dict(_by_name(C.convert_items(_b76magic)), **_by_name(C.convert_items(_b76magic, book=TCE)))
SIX = ('str', 'dex', 'con', 'int', 'wis', 'cha')
def _fx(ac=0, sv=0):
    return ([{'target': 'ac', 'value': ac}] if ac else []) + [{'target': 'save.' + a, 'value': sv} for a in SIX if sv]
for name, needle in (('Quarterstaff of the Acrobat', 'you can take a Reaction to twirl the weapon around you, gaining a +5 bonus '
                                                     'to your Armor Class against the triggering attack'),
                     ('Arrow-Catching Shield', 'You gain a +2 bonus to Armor Class against ranged attack rolls while you wield this Shield'),
                     ('Bracers of Defense', 'you gain a +2 bonus to Armor Class if you are wearing no armor and using no Shield'),
                     ('Rod of Alertness', 'While in that Bright Light, you and your allies gain a +1 bonus to Armor Class and saving throws'),
                     ('Teeth of Dahlver-Nar', 'Using the Teeth')):
    e = b76.get(name, {})
    ck('#76 %s: a conditional bonus is not a standing effect' % name, name in b76 and e.get('effects') == [], e.get('effects'))
    ck('#76 ...and %s\'s prose still states it' % name, needle in e.get('description', ''), e.get('description', '')[:160])
qa = b76.get('Quarterstaff of the Acrobat', {})
ck('#76 the Quarterstaff keeps its own +2, on its weapon', qa.get('weapon', {}).get('atkMisc') == 2
   and qa.get('weapon', {}).get('dmgMisc') == 2, qa.get('weapon'))
ck('#76 the Arrow-Catching Shield is still a +2 shield: its armor line, which AC reads', 
   b76.get('Arrow-Catching Shield', {}).get('description', '').startswith('AC +2 (Shield)'),
   b76.get('Arrow-Catching Shield', {}).get('description', '')[:40])
for name, want in (('Cloak of Protection', _fx(1, 1)), ('Scarab of Protection', _fx(1)), ('Shield of the Cavalier', _fx(2)),
                   ('Stone of Good Luck', _fx(0, 1)), ('Robe of Stars', _fx(0, 1)), ('Glamoured Studded Leather', _fx(1)),
                   ('Ioun Stone, Protection', _fx(1)), ('Black Dragon Scale Mail', _fx(1)), ('Staff of Power', _fx(2, 2))):
    ck('#76 %s: a standing bonus stays an effect' % name, b76.get(name, {}).get('effects') == want, b76.get(name, {}).get('effects'))
ck('#76 a bonus stated only in an embedded {#itemEntry} template is read from it (Dragon Scale Mail)',
   b76.get('Black Dragon Scale Mail', {}).get('effects') == _fx(1), b76.get('Black Dragon Scale Mail', {}).get('effects'))
ck('#76 ...though its description is left exactly as before',
   b76.get('Black Dragon Scale Mail', {}).get('description', '').endswith('{#itemEntry Dragon Scale Mail|XDMG}'),
   b76.get('Black Dragon Scale Mail', {}).get('description', '')[-60:])

# The reader itself, on the sentences above and the shapes it must not misread.
_rd = getattr(C, '_bonus_reading', None)
def rd(text, key, n):
    return _rd(text, key, n) if _rd else ('no _bonus_reading',)
ck('#76 "while you wear this cloak" is standing', rd('You gain a +1 bonus to Armor Class and saving throws while you wear this cloak.', 'ac', 1)[0] is True,
   rd('You gain a +1 bonus to Armor Class and saving throws while you wear this cloak.', 'ac', 1))
ck('#76 "while this … is on your person" and "orbits your head" are standing',
   rd('While this polished agate is on your person, you gain a +1 bonus to ability checks and saving throws.', 'saves', 1)[0] is True
   and rd('You gain a +1 bonus to Armor Class while this dusty-rose prism orbits your head.', 'ac', 1)[0] is True)
ck('#76 a clause after the bonus does not taint it (Dragon Scale Mail\'s "saving throws against the breath weapons")',
   rd('While wearing this armor, you gain a +1 bonus to Armor Class, you have Advantage on saving throws against the breath '
      'weapons of Dragons, and you have Resistance to acid damage.', 'ac', 1)[0] is True)
ck('#76 "against" right after the bonus narrows it', rd('You gain a +2 bonus to Armor Class against ranged attack rolls while you wield this Shield.', 'ac', 2)[:2] == (False, 'against'),
   rd('You gain a +2 bonus to Armor Class against ranged attack rolls while you wield this Shield.', 'ac', 2))
ck('#76 "until the start of your next turn" is conditional',
   rd('You and all affected creatures gain a +1 bonus to AC until the start of your next turn.', 'ac', 1)[0] is False)
ck('#76 one named save is not all six', rd('While attuned to this device, you have a +1 bonus to Intelligence saving throws.', 'saves', 1)[0] is None,
   rd('While attuned to this device, you have a +1 bonus to Intelligence saving throws.', 'saves', 1))
ck('#76 no sentence stating the bonus: not an effect, and said', rd('A pouch of teeth. [Table: Teeth of Dahlver-Nar]', 'ac', 2)[0] is None)

# never quiet: every bonus kept out of the effects is listed, with the word that decided it
got = sorted((n, f) for n, f, v, why in (_BP or []))
ck('#76 the five bonuses kept in prose are recorded by item and field',
   got == [('Arrow-Catching Shield', 'bonusAc'), ('Bracers of Defense', 'bonusAc'), ('Quarterstaff of the Acrobat', 'bonusAc'),
           ('Rod of Alertness', 'bonusAc'), ('Rod of Alertness', 'bonusSavingThrow'), ('Teeth of Dahlver-Nar', 'bonusAc')], got)
said = []
getattr(C, '_bonus_prose_notes', lambda say: None)(said.append)
ck('#76 ...and reported one line per item, naming the field and the reason',
   len(said) == 5 and any('Quarterstaff of the Acrobat' in s and 'bonusAc +5' in s and 'reaction' in s.lower() for s in said)
   and any('Teeth of Dahlver-Nar' in s and 'no sentence' in s for s in said), said)
if _BP is not None: _BP.clear()

# ...at the end of every kind of run that converts items
_dump = tempfile.mkdtemp()
json.dump({'itemProperty': IB_PROPS, 'itemMastery': IB_MASTERY, 'baseitem': IB_BASE, 'itemEntry': B76_ENTRIES},
          open(os.path.join(_dump, 'items-base.json'), 'w'))
json.dump({'item': B76_CONDITIONAL + B76_STANDING + [B76_TEETH]}, open(os.path.join(_dump, 'items.json'), 'w'))
_out = tempfile.mkdtemp()
for label, argv, outfile, who, fine in (
        ('`items`', ['items', os.path.join(_dump, 'items.json'), '-o', os.path.join(_out, 'i.json')], 'i.json',
         'Quarterstaff of the Acrobat', 'Black Dragon Scale Mail'),
        ('all', ['all', _dump, '-o', os.path.join(_out, 'all')], os.path.join('all', 'items-magic.json'),
         'Quarterstaff of the Acrobat', 'Black Dragon Scale Mail'),
        ('supplement', ['supplement', _dump, '-o', os.path.join(_out, 'sup'), '--book', 'TCE'],
         os.path.join('sup', 'items-magic.json'), 'Teeth of Dahlver-Nar', None)):
    r = subprocess.run([sys.executable, CONV] + argv, capture_output=True, text=True)
    ck('#76 %s notes the bonus it kept in prose' % label, 'note:' in r.stdout and who in r.stdout
       and 'not an effect' in r.stdout, r.stdout[-800:] + r.stderr[-300:])
    try:
        got = _by_name(json.load(open(os.path.join(_out, outfile), encoding='utf-8')))
    except (OSError, ValueError) as e:
        got = {'error': str(e)}
    ck('#76 %s leaves %s with no effect' % (label, who), got.get(who, {}).get('effects') == [], got.get('error') or got.get(who))
    if fine:
        ck('#76 %s reads the Dragon Scale Mail\'s bonus through its template' % label,
           got.get(fine, {}).get('effects') == _fx(1), got.get(fine))
shutil.rmtree(_dump, ignore_errors=True); shutil.rmtree(_out, ignore_errors=True)

print()
print('FAILURES: ' + ', '.join(fail) if fail else 'ALL PASSED (%d)' % total[0])
sys.exit(1 if fail else 0)
