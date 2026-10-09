import sys, json, os, zipfile
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
  "caption": "Glimmerwick Surge",
  "colLabels": ["{@dice 1d100}", "Effect"],
  "colStyles": ["col-2 text-center", "col-10"],
  "rows": [
    [{"type": "cell", "roll": {"min": 1, "max": 2, "pad": True}}, "A haze of copper sparks drifts around you for a minute."],
    [{"type": "cell", "roll": {"min": 3, "max": 4, "pad": True}}, "You hurl {@spell Glimmerbolt} as if from a level 3 slot."],
    [{"type": "cell", "roll": {"exact": 100, "pad": True}}, "You recover every spent {@variantrule Glimmer Points|XPHB}."],
  ],
}
sink = []
with C.table_ctx(sink, 'Glimmerwick Sorcery', 'subclass'):
    txt = C.flatten([ "Your glimmers sometimes slip their leash in odd, bright bursts.", node ])
t = sink[0]
ck('caption becomes name', t['name'] == 'Glimmerwick Surge', t['name'])
ck('col labels de-tagged', t['cols'] == ['1d100', 'Effect'], t['cols'])
ck('align from colStyles', t['align'] == ['center', 'left'], t['align'])
ck('roll range padded', t['rows'][0][0] == '01-02', t['rows'][0][0])
ck('roll exact padded', t['rows'][2][0] == '100', t['rows'][2][0])
ck('cell tags stripped', t['rows'][1][1] == 'You hurl Glimmerbolt as if from a level 3 slot.', t['rows'][1][1])
ck('owner recorded', (t['owner'], t['ownerKind']) == ('Glimmerwick Sorcery', 'subclass'), t.get('owner'))
ck('anchor emitted in prose', '[Table: Glimmerwick Surge]' in txt, txt)
ck('prose kept', txt.startswith('Your glimmers'), txt)

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
tagfile['subclassFeature'][0]['entries'] = ['{@i Temper Your Stance with Stubborn Patience}',
                                            'Ash Sentinels bank the coals of their resolve until it turns to iron.']
tsd = C.convert_classes([_tmpjson(tagfile)])['classes'][0]['subclasses']['Battle Master']['description']
ck('an italic tagline is never taken as the description', tsd.startswith('Ash Sentinels bank'), tsd)
ts2 = json.loads(json.dumps(_scfile()))
ts2['subclassFeature'][0]['source'] = 'XGE'   # section 14 mutates the shared _SC_FEAT to TCE
ts2['subclassFeature'][0]['entries'] = ['{@i Temper Your Stance with Stubborn Patience}', 'A long enough description line to be picked as the blurb.']
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
# below is the v2.36.1 dump's, with invented text.

# The shape of XGE's Arcane Archer "Arcane Shot Options" (class-fighter.json
# subclassFeature): prose, a sentence promising a formula, the formula, options
AA_OPTS = ["Ember Volley has a handful of tricks.",
           "When a trick calls for a saving throw, its DC comes from this formula:",
           {"type": "abilityDc", "name": "Ember Volley", "attributes": ["int"]},
           {"type": "options", "count": 2, "entries": [
               {"type": "refOptionalfeature", "optionalfeature": "Cinderburst Arrow|XGE"},
               {"type": "refOptionalfeature", "optionalfeature": "Glowmoth Arrow|XGE"}]}]
aa = C.flatten(AA_OPTS)
ck('abilityDc renders the save DC formula (Ember Volley)',
   'Ember Volley save DC = 8 + your proficiency bonus + your Intelligence modifier.' in aa, aa)
ck('...right after the sentence that promises it',
   'from this formula:\nEmber Volley save DC = 8' in aa, aa)
ck('...and the options still follow it', aa.endswith('• Cinderburst Arrow\n• Glowmoth Arrow'), aa)

# The shape of TCE's Artificer "Spellcasting" -> "Spellcasting Ability"
# (class-artificer.json classFeature): a named subsection, prose, two formulas
ART_SC = {"type": "entries", "name": "Spellcasting Ability", "entries": [
    "Your tinker spells run on Intelligence; you treat each one as a mechanism to be tuned rather than a prayer to be answered. Whenever a tinker spell asks for your spellcasting ability, use Intelligence. Use your Intelligence modifier, too, for the DC of a tinker spell you cast and for the attack rolls of those spells.",
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
   art.endswith('the attack rolls of those spells. Spell save DC = 8 + your proficiency bonus + your Intelligence '
                'modifier. Spell attack modifier = your proficiency bonus + your Intelligence modifier.'), art)

# The shape of PHB's Battle Master "Combat Superiority" (class-fighter.json):
# a formula with two attributes
BM_ST = {"type": "entries", "entries": [{"type": "entries", "name": "Saving Throws", "entries": [
    "A few of your feints force the target to make a saving throw to shrug them off. Work out the DC like this:",
    {"type": "abilityDc", "name": "Feint", "attributes": ["str", "con"]}]}]}
bm = C.flatten([BM_ST])
ck('several attributes join as 5e-tools does: "X or Y modifier (your choice)"',
   bm.endswith('Feint save DC = 8 + your proficiency bonus + your Strength or Constitution modifier (your choice).'), bm)
# book-xphb.json writes the generic caster as "spellcasting"
ck('the "spellcasting" attribute reads "spellcasting ability modifier"',
   C.flatten([{"type": "abilityAttackMod", "name": "Spell", "attributes": ["spellcasting"]}])
   == 'Spell attack modifier = your proficiency bonus + your spellcasting ability modifier.')
# abilityGeneric, the third of the family (shaped as book-xdmg.json, book-phb.json write it)
ck('abilityGeneric: "Name = text"',
   C.flatten([{"type": "abilityGeneric", "name": "DC", "page": 29, "text": "6 + your Grit + half your level"}])
   == 'DC = 6 + your Grit + half your level.')
ck('abilityGeneric: text alone',
   C.flatten([{"type": "abilityGeneric", "text": "12 + every bonus you would add to the roll"}])
   == '12 + every bonus you would add to the roll.')
ck('abilityGeneric: attributes follow the text (renderdemo.json)',
   C.flatten([{"type": "abilityGeneric", "name": "Initiative", "text": "10 - your power level + somebody else's",
               "attributes": ["dex", "str"]}])
   == "Initiative = 10 - your power level + somebody else's Dexterity or Strength modifier (your choice).")

# The shape of XDMG's Cackle Fever (conditionsdiseases.json): list items with a
# SINGULAR entry
CACKLE = ["Stale loaves from a hexed bakery can carry Crumbmouth, a sickness that takes hold only in Humanoids (halflings shrug it off). An eater shows these symptoms {@dice 1d4} days after the meal:",
          {"type": "list", "style": "list-hang-notitle", "items": [
              {"type": "item", "name": "Crumbs", "entry": "The eater takes 1 {@condition Exhaustion|XPHB} level that stays until the sickness passes."},
              {"type": "item", "name": "Endless Chewing", "entry": "As long as the eater has the {@condition Exhaustion|XPHB} condition, it must succeed on a {@dc 13} Constitution saving throw whenever it is hurt, or spend its next turn chewing."}]}]
cf = C.flatten(CACKLE)
ck('an item with a singular entry is kept (Crumbmouth)',
   'days after the meal:\nCrumbs: The eater takes 1 Exhaustion level that stays until the sickness passes.\n'
   'Endless Chewing: As long as the eater has the Exhaustion condition, it must succeed on a DC 13' in cf, cf)
one = {"type": "item", "name": "Bite", "entry": "It deals {@damage 1d8} piercing damage on a hit."}
ck('...and reads exactly as the same item written with `entries`',
   C.flatten([one]) == C.flatten([{"type": "item", "name": "Bite", "entries": [one['entry']]}]) == 'Bite: It deals 1d8 piercing damage on a hit.',
   C.flatten([one]))

# The shape of XPHB's Soulknife "Psychic Blades" (class-rogue.json): the traits
# are a statblock
PB_FEAT = ["Each {@action Attack|XPHB} action or {@action Opportunity Attack|XPHB} you make can use a {@item Mindshard Blade|XPHB}, a weapon with these traits:",
           {"type": "statblock", "tag": "item", "name": "Mindshard Blade", "source": "XPHB"},
           "The sliver melts away when the attack is done."]
PB_ITEM = {"name": "Mindshard Blade", "source": "XPHB", "page": 136, "type": "M", "rarity": "none",
           "weaponCategory": "simple", "property": ["F|XPHB", "T|XPHB"],
           "mastery": [{"uid": "Vex|XPHB", "note": "usable without the Weapon Mastery feature, and free of its usual limit"}],
           "range": "30/90", "dmg1": "1d8", "dmgType": "Y"}
# items-base.json itemProperty, prose trimmed: only the abbreviation and name matter
PB_PROPS = [{"abbreviation": "F", "source": "XPHB", "page": 213, "entries": [{"type": "entries", "name": "Finesse", "entries": ["…"]}]},
            {"abbreviation": "T", "source": "XPHB", "page": 214, "template": "{{prop_name}} ({{item.range}} ft.)",
             "entries": [{"type": "entries", "name": "Thrown", "entries": ["…"]}]}]
PB_TRAITS = ("Mindshard Blade: Simple Melee Weapon · Damage 1d8 psychic · Range 30/90 ft · "
             "Properties: Finesse, Thrown · Mastery: Vex (usable without the Weapon Mastery feature, "
             "and free of its usual limit).")
with C.statblock_ctx(C.load_item_index(_tmpjson({'itemProperty': PB_PROPS, 'baseitem': []}),
                                       _tmpjson({'item': [PB_ITEM]}))):
    C._ENTRY_MISSES.clear()
    pb = C.flatten(PB_FEAT)
    ck('a statblock embeds the item it names (Mindshard Blade)',
       'with these traits:\n' + PB_TRAITS + '\nThe sliver melts away' in pb, pb)
    ck('...and a resolved statblock is not a miss', not C._ENTRY_MISSES, dict(C._ENTRY_MISSES))
    # a statblock whose item is not in the index names it, and is reported
    ck('an unresolvable statblock falls back to its name',
       C.flatten([{"type": "statblock", "tag": "item", "name": "Nowhere Blade", "source": "XPHB"}]) == 'Nowhere Blade.')
    ck('...and is counted', C._ENTRY_MISSES.get('statblock') == 1, dict(C._ENTRY_MISSES))
C._ENTRY_MISSES.clear()
# with no index at all (a single subcommand), the same fallback — not silence
ck('no item index: the statblock still names what it embeds',
   C.flatten(PB_FEAT[1:2]) == 'Mindshard Blade.' and C._ENTRY_MISSES.get('statblock') == 1, dict(C._ENTRY_MISSES))

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
# saying what the mark meant. Both nodes have the shapes of XGE's "Downtime
# Activity: Crime" and "...: Buying a Magic Item" tables (variantrules.json):
# rows ending in *, and a starred column label.
CRIME = {"type": "table", "caption": "Mischief Complications", "colLabels": ["d8", "Complication"],
         "colStyles": ["col-2 text-center", "col-10"],
         "rows": [["1", "Every dog in the village barks all night, and the elders want a word about the mischief.*"],
                  ["2", "A goose painted blue waddles into the temple during prayers.*"],
                  ["3", "The pie contest is ruined, and the baker sulks for a week."],
                  ["4", "Blue paint prints lead from the green straight to your door.*"],
                  ["5", "The scarecrow you dressed as the mayor gets a standing ovation."],
                  ["6", "A bard writes a rude song about the night, and it catches on."],
                  ["7", "Somebody's grandmother saw everything and is telling it wrong."],
                  ["8", "The festival committee asks you to run next year's games."]],
         "footnotes": ["*A rival may be behind it"]}
PRICE = {"type": "table", "caption": "Trinket Price", "colLabels": ["Rarity", "Asking Price*"],
         "colStyles": ["col-5", "col-7 text-right"],
         "rows": [["Common", "({@dice 1d4 + 2}) × 10 gp"], ["Uncommon", "{@dice 1d8 × 100} gp"],
                  ["Rare", "{@dice 2d8 × 1,000} gp"], ["Very rare", "({@dice 1d6 + 2}) × 10,000 gp"],
                  ["Legendary", "{@dice 2d4 × 25,000} gp"]],
         "footnotes": ["*Doubled in a port town on market day"]}
fsink = []
with C.table_ctx(fsink, 'Downtime Activity: Mischief', 'rule'):
    ftxt = C.flatten(["You might stir up some mischief.", CRIME, PRICE])
fc, fp = fsink[0], fsink[1]
ck('#73 a table keeps its footnotes', fc.get('footnotes') == ['*A rival may be behind it'], fc.get('footnotes'))
ck('#73 ...and the rows keep the * they point from',
   fc['rows'][0][1].endswith('mischief.*') and not fc['rows'][2][1].endswith('*'), fc['rows'])
ck('#73 a footnote for a starred column label', fp.get('footnotes') == ['*Doubled in a port town on market day']
   and fp['cols'] == ['Rarity', 'Asking Price*'], [fp['cols'], fp.get('footnotes')])
ck('#73 footnotes sit after the rows, before the caption',
   list(fc) == ['name', 'cols', 'align', 'rows', 'footnotes', 'caption', 'owner', 'ownerKind'], list(fc))
ck('#73 the anchors are unchanged', ftxt.endswith('[Table: Mischief Complications]\n[Table: Trinket Price]'), ftxt)
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
   [t.get('footnotes') for t in fd] == [None, ['*A rival may be behind it']], [t.get('footnotes') for t in fd])
ck('#73 ...and a true duplicate still is', len(fd) == 2, len(fd))

# end to end through the glossary path, the one Xanathar's downtime tables take
fg = []
_vr = _tmpjson({'variantrule': [{'name': 'Downtime Activity: Mischief', 'source': 'XGE',
                                 'entries': ['You might stir up some mischief.', CRIME]}]})
C.convert_glossary(_vr, tables=fg, book=XGE)
ck('#73 a supplement rule\'s table ships its footnotes',
   len(fg) == 1 and fg[0].get('footnotes') == ['*A rival may be behind it'] and fg[0].get('owner') == 'Downtime Activity: Mischief',
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
pbw = ib_magic.get('Mindshard Blade', {}).get('weapon', {})
ck('an object-shaped mastery reads as the statblock reads it, note and all (Mindshard Blade)',
   pbw.get('notes') == 'Range 30/90 · Finesse, Thrown · Mastery: Vex (usable without the Weapon Mastery '
                       'feature, and free of its usual limit)', pbw)
ck('...not the dict\'s repr', '{' not in json.dumps(ib_magic.get('Mindshard Blade', {}).get('description', '')) and
   "'uid'" not in pbw.get('notes', ''), ib_magic.get('Mindshard Blade'))
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
# no effect target can say "only that weapon", so it stays in the prose. The
# shapes of real items in the v2.36.1 dump (bracers, a rod, an oil, a tattoo, an
# artifact, a ring), with invented names and text, one entry each.
NONWEAPON = [
    {"name": "Fletcher's Vambraces", "source": "XDMG", "page": 240, "srd52": True, "basicRules2024": True, "rarity": "uncommon", "reqAttune": True, "wondrous": True, "grantsProficiency": True, "bonusWeaponDamage": "+2",
     "entries": ["Strapped to your forearms, these vambraces make you proficient with the {@item Longbow|XPHB} and {@item Shortbow|XPHB}, and you add a +2 bonus to damage rolls with those bows."]},
    {"name": "Rod of the Hearth-Lord", "source": "XDMG", "page": 300, "srd52": True, "basicRules2024": True, "type": "RD|XDMG", "rarity": "legendary", "reqAttune": True, "weight": 2, "bonusWeapon": "+3", "light": [{"bright": 40, "dim": 80}],
     "entries": ["The rod's iron head is shaped like a turnip, and it serves as a magic Mace that adds a +3 bonus to its attack and damage rolls."]},
    {"name": "Whetstone Balm", "source": "XDMG", "page": 282, "srd52": True, "basicRules2024": True, "referenceSources": ["DrDe-BtS"], "type": "P|XPHB", "rarity": "very rare", "weight": 0.5, "bonusWeapon": "+3",
     "entries": ["A dab of this balm can treat one Melee weapon or a quiver of twenty arrows, so long as the steel is plain and made to cut or pierce."]},
    {"name": "Thornknuckle Tattoo", "source": "TCE", "page": 126, "rarity": "uncommon", "reqAttune": True, "wondrous": True, "tattoo": True, "bonusWeapon": "+1",
     "entries": [{"type": "entries", "name": "Thorned Fists", "entries": ["Thorns curl over your knuckles, and your unarmed strikes gain a +1 bonus to their attack and damage rolls."]}]},
    {"name": "Granny Nettle's Kettle and Ladle", "source": "TCE", "page": 121, "rarity": "artifact", "reqAttune": True, "wondrous": True, "bonusWeapon": "+3",
     "entries": ["Granny Nettle cooked up these two long before anyone thought to write down rules for magic."]},
    # the control: a bonus that really is global stays an effect
    {"name": "Ring of the Copper Ward", "source": "XDMG", "page": 294, "srd52": True, "basicRules2024": True, "type": "RG|XDMG", "rarity": "rare", "reqAttune": True, "bonusAc": "+1", "bonusSavingThrow": "+1", "classFeatures": ["replicate magic item|artificer|efa|2|efa"],
     "entries": ["This plain copper band grants a +1 bonus to {@variantrule Armor Class|XPHB} and to saving throws while wearing it."]},
]
_nwf = _tmpjson({'item': NONWEAPON})
with C.statblock_ctx(C.load_item_index(IB_BASEFILE, _nwf)):
    nw = dict(_by_name(C.convert_items(_nwf)), **_by_name(C.convert_items(_nwf, book=TCE)))
for name, needle in (("Fletcher's Vambraces", '+2 bonus to damage rolls with those bows'),
                     ('Rod of the Hearth-Lord', '+3 bonus to its attack and damage rolls'),
                     ('Whetstone Balm', 'treat one Melee weapon'),
                     ('Thornknuckle Tattoo', '+1 bonus to their attack and damage rolls'),
                     ("Granny Nettle's Kettle and Ladle", 'write down rules for magic')):
    e = nw.get(name, {})
    ck('#74 %s: its weapon-only bonus is not an effect on every attack' % name,
       name in nw and e.get('effects') == [] and 'weapon' not in e, e.get('effects'))
    ck('#74 ...and %s\'s prose still states it' % name, needle in e.get('description', ''), e.get('description', '')[:120])
ring = nw.get('Ring of the Copper Ward', {})
ck('#74 a ring of protection keeps its AC and saving-throw effects',
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
# sentence that states the bonus. The fixtures have the shapes of those items
# and their kin in the v2.36.1 dump, with invented names and text; each states
# its bonus in the same kind of sentence its model does.
B76_CONDITIONAL = [
    {"name": "Quarterstaff of the Tumbler", "source": "XDMG", "page": 291, "srd52": True, "basicRules2024": True, "baseItem": "quarterstaff|xphb", "type": "M|XPHB", "rarity": "very rare", "reqAttune": True, "weight": 4, "weaponCategory": "simple", "property": ["T|XPHB", "V|XPHB"], "mastery": ["Topple|XPHB"], "range": "30/120", "dmg1": "1d6", "dmgType": "B", "dmg2": "1d8", "bonusWeapon": "+2", "bonusAc": "+5", "staff": True, "entries": ["This magic staff adds a +2 bonus to its own attack rolls and damage rolls.", "While holding the staff, you can make it glow with a soft amber {@variantrule Dim Light|XPHB} out to 10 feet, either as a {@variantrule Bonus Action|XPHB} or when you roll {@variantrule Initiative|XPHB}, and you can douse it as a {@variantrule Bonus Action|XPHB}.", "While holding the staff, you can take a {@variantrule Bonus Action|XPHB} to fold it down into a 6-inch baton, stretch it out into a 10-foot pole, or return it to a Quarterstaff; it never grows past the room it has.", "Some of its forms carry extra properties.", {"type": "entries", "name": "Sure Footing (Quarterstaff and 10-Foot Pole Forms Only)", "entries": ["While holding the staff, you keep your feet on any surface: you have {@variantrule Advantage|XPHB} on Dexterity ({@skill Acrobatics|XPHB}) checks."]}, {"type": "entries", "name": "Spinning Guard (Quarterstaff Form Only)", "entries": ["If an attack hits you while you hold the staff, you can take a {@variantrule Reaction|XPHB} to spin it into a blur, gaining a +5 bonus to your {@variantrule Armor Class|XPHB} against that attack, which may turn the hit into a miss. Once used, this property returns when you finish a {@variantrule Short Rest|XPHB|Short} or {@variantrule Long Rest|XPHB}."]}, {"type": "entries", "name": "Boomerang (Quarterstaff Form Only)", "entries": ["The staff has the {@itemProperty T|XPHB|Thrown} property, with a range of 30/120 feet. Right after you make a ranged attack with it, the staff spins back into your hand."]}], "light": [{"dim": 10}]},
    {"name": "Missile-Snaring Shield", "source": "XDMG", "page": 231, "srd52": True, "basicRules2024": True, "baseItem": "shield|xphb", "type": "S|XPHB", "rarity": "rare", "reqAttune": True, "weight": 6, "ac": 2, "bonusAc": "+2", "entries": ["While you wield this Shield, arrows and bolts glance off it, and it adds a +2 bonus to {@variantrule Armor Class|XPHB} against ranged attacks. That bonus comes on top of the Shield's ordinary bonus to AC.", "When a ranged attack targets an ally beside you, you can take a {@variantrule Reaction|XPHB} to step in and take the shot yourself."]},
    {"name": "Warding Bracers", "source": "XDMG", "page": 241, "srd52": True, "basicRules2024": True, "rarity": "rare", "reqAttune": True, "wondrous": True, "bonusAc": "+2", "entries": ["While you wear these leather bracers, they give you a +2 bonus to {@variantrule Armor Class|XPHB} if your body is free of armor and your arms hold no {@item Shield|XPHB}."]},
    {"name": "Rod of the Night Watch", "source": "XDMG", "page": 299, "srd52": True, "basicRules2024": True, "type": "RD|XDMG", "rarity": "very rare", "reqAttune": True, "weight": 2, "bonusAc": "+1", "bonusSavingThrow": "+1", "entries": ["The rod carries these properties.", {"type": "entries", "name": "Wakefulness", "entries": ["While holding the rod, nothing sneaks up on you: you have {@variantrule Advantage|XPHB} on {@variantrule Initiative|XPHB} rolls and on Wisdom ({@skill Perception|XPHB}) checks."]}, {"type": "entries", "name": "Spells", "entries": ["While holding the rod, you can cast these spells from it:", {"type": "list", "items": ["{@spell Lantern Sight|XPHB}", "{@spell Owl's Ear|XPHB}", "{@spell Sniff Out Rot|XPHB}", "{@spell Unveil the Hidden|XPHB}"]}]}, {"type": "entries", "name": "Watchfire", "entries": ["As a {@action Magic|XPHB} action, you can drive the rod's foot into the ground, and its head blazes with {@variantrule Bright Light|XPHB} in a 60-foot radius and {@variantrule Dim Light|XPHB} for 60 feet beyond. While you stand in that {@variantrule Bright Light|XPHB}, you and your allies have a +1 bonus to {@variantrule Armor Class|XPHB} and saving throws and can see any {@condition Invisible|XPHB} creature standing in the light.", "The light dies after 10 minutes, or sooner if a creature takes a {@action Magic|XPHB} action to pull the rod free. The rod then rests until the next dawn."]}], "light": [{"bright": 60, "dim": 120}]},
]
B76_STANDING = [
    {"name": "Hedge-Wool Cloak", "source": "XDMG", "page": 245, "srd52": True, "basicRules2024": True, "rarity": "uncommon", "reqAttune": True, "wondrous": True, "bonusAc": "+1", "bonusSavingThrow": "+1", "entries": ["Woven from hedge-wool, this cloak lends you a +1 bonus to {@variantrule Armor Class|XPHB} and saving throws while you wear it."]},
    {"name": "Jade Beetle Brooch", "source": "XDMG", "page": 302, "srd52": True, "basicRules2024": True, "rarity": "legendary", "reqAttune": True, "wondrous": True, "weight": 1, "bonusAc": "+1", "charges": 12, "entries": ["This brooch, carved from jade in the shape of a beetle, gives three gifts while it is on your person.", {"type": "entries", "name": "Shell", "entries": ["You have a +1 bonus to {@variantrule Armor Class|XPHB}."]}, {"type": "entries", "name": "Second Chance", "entries": ["The brooch has 12 charges. If you fail a saving throw against a curse or a poison, you can take a {@variantrule Reaction|XPHB} to spend 1 charge and succeed instead. Once its last charge is spent, the brooch cracks into green dust."]}, {"type": "entries", "name": "Spell Shell", "entries": ["When a spell calls for a saving throw, you make it with {@variantrule Advantage|XPHB}."]}]},
    {"name": "Shield of the Outrider", "source": "XDMG", "page": 304, "srd52": True, "basicRules2024": True, "baseItem": "shield|xphb", "type": "S|XPHB", "rarity": "very rare", "reqAttune": True, "weight": 6, "ac": 2, "bonusAc": "+2", "entries": ["While you hold this lance-scarred Shield, it grants a +2 bonus to {@variantrule Armor Class|XPHB}, on top of the usual bonus any Shield gives."]},
    {"name": "Lucky River Pebble", "alias": ["Luckpebble"], "source": "XDMG", "page": 312, "srd52": True, "basicRules2024": True, "rarity": "uncommon", "reqAttune": True, "wondrous": True, "bonusSavingThrow": "+1", "bonusAbilityCheck": "+1", "entries": ["While this river-smoothed pebble is on your person, luck leans your way, granting a +1 bonus to ability checks and saving throws."]},
    {"name": "Robe of Lanterns", "source": "XDMG", "page": 297, "srd52": True, "basicRules2024": True, "rarity": "very rare", "reqAttune": True, "wondrous": True, "bonusSavingThrow": "+1", "rechargeAmount": "{@dice 1d6}", "charges": 6, "entries": ["Tiny lanterns are stitched in gold thread all over this deep-red robe. While you wear it, you have a +1 bonus to saving throws."]},
    {"name": "Masquer's Studded Leather", "source": "XDMG", "page": 264, "srd52": True, "basicRules2024": True, "baseItem": "studded leather armor|xphb", "type": "LA|XPHB", "rarity": "rare", "weight": 13, "ac": 12, "bonusAc": "+1", "entries": ["While wearing these studs and straps, you have a +1 bonus to {@variantrule Armor Class|XPHB}. As a {@variantrule Bonus Action|XPHB}, you can make the armor look like a fine coat, a farmer's smock or any other clothes or armor you picture, though it keeps its true bulk and weight. The disguise holds until you use this property again or take the armor off."]},
    {"name": "Wisp Stone, Protection", "source": "XDMG", "page": 273, "srd52": True, "basicRules2024": True, "rarity": "rare", "reqAttune": True, "wondrous": True, "bonusAc": "+1", "hasRefs": True, "entries": ["{#itemEntry Wisp Stone|XDMG}", "You have a +1 bonus to {@variantrule Armor Class|XPHB} while this slate-blue bead orbits your head."]},
    {"name": "Black Wyrmhide Mail", "source": "XDMG", "page": 254, "srd52": True, "basicRules2024": True, "baseItem": "scale mail|xphb", "type": "MA|XPHB", "resist": ["acid"], "detail1": "black", "rarity": "very rare", "reqAttune": True, "weight": 45, "ac": 14, "bonusAc": "+1", "stealth": True, "hasRefs": True, "entries": ["{#itemEntry Wyrmhide Mail|XDMG}"]},
    {"name": "Staff of the Bramble King", "source": "XDMG", "page": 308, "srd52": True, "basicRules2024": True, "type": "M|XPHB", "rarity": "very rare", "reqAttune": "by a sorcerer, warlock, or wizard", "reqAttuneTags": [{"class": "sorcerer"}, {"class": "warlock"}, {"class": "wizard"}], "weight": 4, "weaponCategory": "simple", "property": ["V|XPHB"], "mastery": ["Topple|XPHB"], "dmg1": "1d6", "dmgType": "B", "dmg2": "1d8", "bonusWeapon": "+2", "bonusSpellAttack": "+2", "bonusAc": "+2", "bonusSavingThrow": "+2", "recharge": "dawn", "rechargeAmount": "{@dice 2d8 + 4}", "charges": 20, "staff": True, "entries": ["Twenty charges sleep in this staff, and you can swing it as a magic Quarterstaff that adds a +2 bonus to its attack rolls and damage rolls. While holding it, you feel its strength: a +2 bonus to {@variantrule Armor Class|XPHB}, saving throws, and spell attack rolls."]},
]
B76_TEETH = {"name": "Satchel of Tall Tales", "source": "TCE", "page": 135, "rarity": "artifact", "reqAttune": True, "wondrous": True, "bonusAc": "+2", "modifySpeed": {"static": {"fly": 30}}, "recharge": "dawn", "rechargeAmount": 8, "charges": 8, "entries": ["A patched satchel, heavy with buttons.", {"type": "entries", "name": "Drawing a Button", "entries": ["Pull out a button and roll on the Satchel of Tall Tales table.", {"type": "table", "caption": "Satchel of Tall Tales", "colLabels": ["d20", "Tale and Button", "Creatures Summoned", "Sewn-On Effect"], "colStyles": ["col-2 text-center", "col-2", "col-1", "col-7"], "rows": [["5", "The Bog Queen's Wager (mossy jade button)", "1 {@creature bog crone||marsh crone} and 4 {@creature frogfolk}", "Bark grows over your skin and gives you a +2 bonus to your AC."]]}]}]}
# The templates two of them embed as "{#itemEntry …}": the Wyrmhide Mails'
# bonus is stated only there.
B76_ENTRIES = [
    {"name": "Wyrmhide Mail", "source": "XDMG", "entriesTemplate": ["Wyrmhide Mail is stitched from the shed skin of a single kind of dragon. A few dragons trade their old hides for favors; more often the hide comes from a dragon that lost its last fight. Either way, the armor fetches a king's ransom.", "While wearing this armor, you enjoy a +1 bonus to {@variantrule Armor Class|XPHB}, you have {@variantrule Advantage|XPHB} on saving throws against a dragon's breath, and you have {@variantrule Resistance|XPHB} to {{getFullImmRes item.resist}} damage.", "As a {@action Magic|XPHB} action, you can sense how far away and in which direction the nearest {{item.detail1}} dragon within 30 miles of you lies. The sense then sleeps until the next dawn."]},
    {"name": "Wisp Stone", "source": "XDMG", "entriesTemplate": ["No bigger than a cherry, {@i Wisp Stones} take their name from the marsh-lights they were first mistaken for. Each kind has its own cut and its own color.", "When you take a {@action Magic|XPHB} action to flick a {@i Wisp Stone} upward, it circles your head {@dice 1d3} feet away and grants you its benefit while it circles. Up to three {@i Wisp Stones} can circle you at once.", "A circling {@i Wisp Stone} counts as an object you are wearing. It weaves aside from other creatures and objects, and no one else can strike it or pluck it from the air.", "As a {@action Utilize|XPHB} action, you can pluck any number of circling {@i Wisp Stones} from the air and pocket them. If your {@variantrule Attunement|XPHB} to a stone ends while it circles you, it drops as if you had let it go."]},
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
for name, needle in (('Quarterstaff of the Tumbler', 'you can take a Reaction to spin it into a blur, gaining a +5 bonus '
                                                     'to your Armor Class against that attack'),
                     ('Missile-Snaring Shield', 'While you wield this Shield, arrows and bolts glance off it, and it adds a +2 bonus to '
                                                'Armor Class against ranged attacks'),
                     ('Warding Bracers', 'they give you a +2 bonus to Armor Class if your body is free of armor and your arms hold no Shield'),
                     ('Rod of the Night Watch', 'While you stand in that Bright Light, you and your allies have a +1 bonus to Armor Class and saving throws'),
                     ('Satchel of Tall Tales', 'Drawing a Button')):
    e = b76.get(name, {})
    ck('#76 %s: a conditional bonus is not a standing effect' % name, name in b76 and e.get('effects') == [], e.get('effects'))
    ck('#76 ...and %s\'s prose still states it' % name, needle in e.get('description', ''), e.get('description', '')[:160])
qa = b76.get('Quarterstaff of the Tumbler', {})
ck('#76 the Quarterstaff keeps its own +2, on its weapon', qa.get('weapon', {}).get('atkMisc') == 2
   and qa.get('weapon', {}).get('dmgMisc') == 2, qa.get('weapon'))
ck('#76 the Missile-Snaring Shield is still a +2 shield: its armor line, which AC reads', 
   b76.get('Missile-Snaring Shield', {}).get('description', '').startswith('AC +2 (Shield)'),
   b76.get('Missile-Snaring Shield', {}).get('description', '')[:40])
for name, want in (('Hedge-Wool Cloak', _fx(1, 1)), ('Jade Beetle Brooch', _fx(1)), ('Shield of the Outrider', _fx(2)),
                   # its +1 to ability checks is #79's `check`
                   ('Lucky River Pebble', _fx(0, 1) + [{'target': 'check', 'value': 1}]),
                   ('Robe of Lanterns', _fx(0, 1)), ("Masquer's Studded Leather", _fx(1)),
                   ('Wisp Stone, Protection', _fx(1)), ('Black Wyrmhide Mail', _fx(1))):
    ck('#76 %s: a standing bonus stays an effect' % name, b76.get(name, {}).get('effects') == want, b76.get(name, {}).get('effects'))
sop = [e for e in b76.get('Staff of the Bramble King', {}).get('effects', []) if e['target'] == 'ac' or e['target'].startswith('save.')]
ck('#76 Staff of the Bramble King: its standing AC and saving-throw bonus stay effects', sop == _fx(2, 2), sop)
ck('#76 a bonus stated only in an embedded {#itemEntry} template is read from it (Wyrmhide Mail)',
   b76.get('Black Wyrmhide Mail', {}).get('effects') == _fx(1), b76.get('Black Wyrmhide Mail', {}).get('effects'))
ck('#78 ...and its description carries the template\'s text, not the tag',
   '+1 bonus to Armor Class' in b76.get('Black Wyrmhide Mail', {}).get('description', '')
   and '{#' not in b76.get('Black Wyrmhide Mail', {}).get('description', ''),
   b76.get('Black Wyrmhide Mail', {}).get('description', '')[-60:])

# The reader itself, on the sentences above and the shapes it must not misread.
_rd = getattr(C, '_bonus_reading', None)
def rd(text, key, n):
    try:
        return _rd(text, key, n) if _rd else ('no _bonus_reading',)
    except Exception as e:          # a key the reader does not know yet is a FAIL, not a crash
        return ('error', repr(e))
ck('#76 "while you wear it" is standing', rd('Woven from hedge-wool, this cloak lends you a +1 bonus to Armor Class and saving throws while you wear it.', 'ac', 1)[0] is True,
   rd('Woven from hedge-wool, this cloak lends you a +1 bonus to Armor Class and saving throws while you wear it.', 'ac', 1))
ck('#76 "while this … is on your person" and "orbits your head" are standing',
   rd('While this river-smoothed pebble is on your person, luck leans your way, granting a +1 bonus to ability checks and saving throws.', 'saves', 1)[0] is True
   and rd('You have a +1 bonus to Armor Class while this slate-blue bead orbits your head.', 'ac', 1)[0] is True)
ck('#76 a clause after the bonus does not taint it (Wyrmhide Mail\'s "saving throws against a dragon\'s breath")',
   rd('While wearing this armor, you enjoy a +1 bonus to Armor Class, you have Advantage on saving throws against a '
      'dragon\'s breath, and you have Resistance to acid damage.', 'ac', 1)[0] is True)
ck('#76 "against" right after the bonus narrows it',
   rd('While you wield this Shield, arrows and bolts glance off it, and it adds a +2 bonus to Armor Class against ranged attacks.', 'ac', 2)[:2] == (False, 'against'),
   rd('While you wield this Shield, arrows and bolts glance off it, and it adds a +2 bonus to Armor Class against ranged attacks.', 'ac', 2))
ck('#76 "until your next turn begins" is conditional',
   rd('You and every creature in the circle have a +1 bonus to AC until your next turn begins.', 'ac', 1)[0] is False)
ck('#76 one named save is not all six', rd('While attuned to this clockwork owl, you have a +1 bonus to Intelligence saving throws.', 'saves', 1)[0] is None,
   rd('While attuned to this clockwork owl, you have a +1 bonus to Intelligence saving throws.', 'saves', 1))
ck('#76 no sentence stating the bonus: not an effect, and said', rd('A satchel of buttons. [Table: Satchel of Tall Tales]', 'ac', 2)[0] is None)

# never quiet: every bonus kept out of the effects is listed, with the word that decided it
got = sorted((n, f) for n, f, v, why in (_BP or []))
ck('#76 the five bonuses kept in prose are recorded by item and field',
   got == [('Missile-Snaring Shield', 'bonusAc'), ('Quarterstaff of the Tumbler', 'bonusAc'), ('Rod of the Night Watch', 'bonusAc'),
           ('Rod of the Night Watch', 'bonusSavingThrow'), ('Satchel of Tall Tales', 'bonusAc'), ('Warding Bracers', 'bonusAc')], got)
said = []
getattr(C, '_bonus_prose_notes', lambda say: None)(said.append)
ck('#76 ...and reported one line per item, naming the field and the reason',
   len(said) == 5 and any('Quarterstaff of the Tumbler' in s and 'bonusAc +5' in s and 'reaction' in s.lower() for s in said)
   and any('Satchel of Tall Tales' in s and 'no sentence' in s for s in said), said)
if _BP is not None: _BP.clear()

# ...at the end of every kind of run that converts items
_dump = tempfile.mkdtemp()
json.dump({'itemProperty': IB_PROPS, 'itemMastery': IB_MASTERY, 'baseitem': IB_BASE, 'itemEntry': B76_ENTRIES},
          open(os.path.join(_dump, 'items-base.json'), 'w'))
json.dump({'item': B76_CONDITIONAL + B76_STANDING + [B76_TEETH]}, open(os.path.join(_dump, 'items.json'), 'w'))
_out = tempfile.mkdtemp()
for label, argv, outfile, who, fine in (
        ('`items`', ['items', os.path.join(_dump, 'items.json'), '-o', os.path.join(_out, 'i.json')], 'i.json',
         'Quarterstaff of the Tumbler', 'Black Wyrmhide Mail'),
        ('all', ['all', _dump, '-o', os.path.join(_out, 'all')], os.path.join('all', 'items-magic.json'),
         'Quarterstaff of the Tumbler', 'Black Wyrmhide Mail'),
        ('supplement', ['supplement', _dump, '-o', os.path.join(_out, 'sup'), '--book', 'TCE'],
         os.path.join('sup', 'items-magic.json'), 'Satchel of Tall Tales', None)):
    r = subprocess.run([sys.executable, CONV] + argv, capture_output=True, text=True)
    ck('#76 %s notes the bonus it kept in prose' % label, 'note:' in r.stdout and who in r.stdout
       and 'not an effect' in r.stdout, r.stdout[-800:] + r.stderr[-300:])
    try:
        got = _by_name(json.load(open(os.path.join(_out, outfile), encoding='utf-8')))
    except (OSError, ValueError) as e:
        got = {'error': str(e)}
    ck('#76 %s leaves %s with no effect' % (label, who), got.get(who, {}).get('effects') == [], got.get('error') or got.get(who))
    if fine:
        ck('#76 %s reads the Wyrmhide Mail\'s bonus through its template' % label,
           got.get(fine, {}).get('effects') == _fx(1), got.get(fine))
shutil.rmtree(_dump, ignore_errors=True); shutil.rmtree(_out, ignore_errors=True)

# ---- 29. an item's spell attack and spell save DC bonus reach the sheet (#77)
# 5e-tools' bonusSpellAttack / bonusSpellSaveDc were never read, so the Moon
# Sickles, Staff of Power, the Wands of the War Mage and Tasha's spellcasting
# focuses carried no effect at all. They become `spell.attack` / `spell.dc`
# effects through the same sentence reader as AC and saves (#76). A bonus the
# book limits to one class's spells ("of your druid and ranger spells") is
# applied to the character's spellcasting, which is the only one the sheet has;
# the class stays in the prose and in the item's attunement. The fixtures have
# the shapes of those items in the v2.36.1 dump, with invented names and text.
B77 = [
    {"name": "+2 Dewlight Sickle", "source": "TCE", "page": 133, "baseItem": "sickle|PHB", "type": "M", "rarity": "rare", "reqAttune": "by a druid or ranger", "weight": 2, "weaponCategory": "simple", "property": ["L"], "dmg1": "1d4", "dmgType": "S", "bonusWeapon": "+2", "bonusSpellAttack": "+2", "bonusSpellSaveDc": "+2", "focus": ["Druid", "Ranger"], "entries": ["A sickle of green bronze, cool to the touch. While holding this magic weapon, you have a +2 bonus to its attack and damage rolls, and you also gain a +2 bonus to spell attack rolls made with druid and ranger spells and to the saving throw DCs of those spells. The sickle can serve as a spellcasting focus for them.", "Its edge never rusts."]},
    {"name": "+1 Wand of the Hedge Mage", "source": "XDMG", "page": 322, "srd52": True, "basicRules2024": True, "type": "WD|XDMG", "rarity": "uncommon", "reqAttune": "by a spellcaster", "weight": 1, "bonusSpellAttack": "+1", "entries": ["While you hold this birch wand, it adds a +1 bonus to your spell attack rolls. Your spell attacks also ignore {@variantrule Cover|XPHB|Half Cover}."]},
    {"name": "Robe of the Grand Magister", "source": "XDMG", "page": 298, "srd52": True, "basicRules2024": True, "rarity": "legendary", "reqAttune": "by a sorcerer, warlock, or wizard", "wondrous": True, "bonusSpellAttack": "+2", "bonusSpellSaveDc": "+2", "entries": ["Silver thread traces old sigils along the hems of this sweeping robe.", "You enjoy the following while you wear the robe.", {"type": "entries", "name": "Armor", "entries": ["Unarmored, you have a base {@variantrule Armor Class|XPHB} of 15 plus your Dexterity modifier."]}, {"type": "entries", "name": "Spell Ward", "entries": ["Spells and other magic that call for a save meet a stubborn wall: you have {@variantrule Advantage|XPHB} on those saving throws."]}, {"type": "entries", "name": "Magister's Edge", "entries": ["Both your spell attack bonus and your spell save DC increase by 2."]}]},
    {"name": "Staff of the Old Magisters", "source": "XDMG", "page": 310, "srd52": True, "basicRules2024": True, "type": "M|XPHB", "rarity": "legendary", "reqAttune": "by a sorcerer, warlock, or wizard", "weight": 4, "weaponCategory": "simple", "property": ["V|XPHB"], "mastery": ["Topple|XPHB"], "dmg1": "1d6", "dmgType": "B", "dmg2": "1d8", "bonusWeapon": "+2", "bonusSpellAttack": "+2", "recharge": "dawn", "rechargeAmount": "{@dice 4d6 + 2}", "charges": 50, "staff": True, "entries": ["Fifty charges hum inside this staff, which you can swing as a magic Quarterstaff that adds a +2 bonus to its attack rolls and damage rolls. While you hold it, it steadies your magic, granting a +2 bonus to spell attack rolls."]},
    {"name": "Talisman of the Dawn Choir", "source": "XDMG", "page": 314, "srd52": True, "basicRules2024": True, "rarity": "legendary", "reqAttune": "by a cleric or paladin", "wondrous": True, "weight": 1, "bonusSpellAttack": "+2", "charges": 7, "entries": ["A sunburst of hammered gold, this talisman burns the wicked. A Fiend or an Undead that touches it takes {@damage 8d6} Radiant damage, and takes it again at the end of each of its turns for as long as it clings to the talisman.", {"type": "entries", "name": "Holy Symbol", "entries": ["The talisman can serve as your Holy Symbol. Its glow lends a +2 bonus to your spell attack rolls while you wear or hold it."]}, {"type": "entries", "name": "Dawn's Judgment", "entries": ["The talisman has 7 charges. While wearing or holding it, you can take a {@action Magic|XPHB} action and spend 1 charge to pick out someone standing on the ground, up to 120 feet away, whom you can see. White fire cracks the earth open beneath the target, which makes a {@dc 20} Dexterity saving throw, with {@variantrule Disadvantage|XPHB} if it is a Fiend or an Undead. If it fails, it drops into the crack and is gone for good. If it succeeds, it keeps its footing but takes {@damage 4d6} Psychic damage from the fright. Either way, the crack then seals over. When the last charge is spent, the talisman crumbles into golden dust."]}]},
    {"name": "Merrymaker's Squeezebox", "source": "TCE", "page": 134, "type": "INS", "rarity": "rare", "reqAttune": "by a bard", "wondrous": True, "bonusSpellSaveDc": "+2", "entries": ["While you hold this squeezebox, its wheezing tune adds a +2 bonus to the saving throw DC of every bard spell you cast.", "It smells faintly of onions."]},
    {"name": "+1 Hedge-Witch's Almanac", "source": "TCE", "page": 120, "type": "SCF", "rarity": "uncommon", "reqAttune": "by a wizard", "wondrous": True, "weight": 3, "bonusSpellAttack": "+1", "bonusSpellSaveDc": "+1", "focus": ["Wizard"], "entries": ["While you are holding this almanac of moon phases and turnip lore, it is a spellcasting focus for wizard spells you cast, and it grants a +1 bonus to the saving throw DCs of those spells and to your spell attack rolls.", "Its margins are crammed with recipes."]},
    {"name": "+1 Tinker's Everything-Key", "source": "TCE", "page": 119, "type": "SCF", "rarity": "uncommon", "reqAttune": "by an artificer", "wondrous": True, "bonusSpellAttack": "+1", "bonusSpellSaveDc": "+1", "focus": ["Artificer"], "entries": ["A brass key whose bow is a tiny cog, hung on a ring of {@item artisan's tools|PHB} ({@book Player's Handbook|PHB}).", "While holding the key, your craft-magic sharpens: you have a +1 bonus to the spell attack rolls you make and the saving throw DCs you set with artificer spells.", "It ticks quietly when no one is listening."]},
]
_b77 = _tmpjson({'item': B77 + [x for x in B76_STANDING if x['name'] == 'Staff of the Bramble King']})
_BP = getattr(C, '_BONUS_PROSE', None)
if _BP is not None: _BP.clear()
with C.statblock_ctx(C.load_item_index(_b76base, _b77)):
    b77 = dict(_by_name(C.convert_items(_b77)), **_by_name(C.convert_items(_b77, book=TCE)))
def _sp(atk=0, dc=0):
    return ([{'target': 'spell.attack', 'value': atk}] if atk else []) + ([{'target': 'spell.dc', 'value': dc}] if dc else [])
for name, want, why in (('+2 Dewlight Sickle', _sp(2, 2), '"…spell attack rolls made with druid and ranger spells and to the saving throw DCs of those spells"'),
                        ('+1 Wand of the Hedge Mage', _sp(1), '"…a +1 bonus to your spell attack rolls"'),
                        ('Robe of the Grand Magister', _sp(2, 2), '"Both your spell attack bonus and your spell save DC increase by 2"'),
                        ('Staff of the Old Magisters', _sp(2), 'spell attack rolls only, no DC'),
                        ('Talisman of the Dawn Choir', _sp(2), '"…while you wear or hold it"'),
                        ("Merrymaker's Squeezebox", _sp(0, 2), 'the DC only'),
                        ("+1 Hedge-Witch's Almanac", _sp(1, 1), '"…to the saving throw DCs of those spells and to your spell attack rolls"'),
                        ("+1 Tinker's Everything-Key", _sp(1, 1), '"…to the spell attack rolls you make and the saving throw DCs you set"'),
                        ('Staff of the Bramble King', _fx(2, 2) + _sp(2), 'AC, saves and spell attack rolls, while holding it')):
    e = b77.get(name, {})
    ck('#77 %s: %s' % (name, why), e.get('effects') == want, e.get('effects'))
ck('#77 the Dewlight Sickle keeps its own +2 on its weapon too',
   b77.get('+2 Dewlight Sickle', {}).get('weapon', {}).get('atkMisc') == 2, b77.get('+2 Dewlight Sickle', {}).get('weapon'))
ck('#77 ...and its class limit is still in its description',
   'druid and ranger spells' in b77.get('+2 Dewlight Sickle', {}).get('description', ''), b77.get('+2 Dewlight Sickle', {}).get('description', '')[:200])
ck('#77 every spell bonus here is standing: none kept in prose', not (_BP or []), list(_BP or []))
ck('#77 a spell bonus the book conditions is not an effect (as the 2014 talismans word it: "If you serve the dawn")',
   rd('If you serve the dawn, the talisman can be your holy symbol, and its glow lends a +2 bonus to your spell '
      'attack rolls while you wear or hold it.', 'spell.attack', 2)[0] is False,
   rd('If you serve the dawn, the talisman can be your holy symbol, and its glow lends a +2 bonus to your spell '
      'attack rolls while you wear or hold it.', 'spell.attack', 2))
ck('#77 a weapon\'s "+2 bonus to its own attack rolls" is not a spell attack bonus',
   rd('This magic staff adds a +2 bonus to its own attack rolls and damage rolls.', 'spell.attack', 2)[0] is None)
if _BP is not None: _BP.clear()

# ---- 30. an item's shared text template is written out (#78)
# 5e-tools shares one text among a family of items: the item's entries carry
# "{#itemEntry Name|SRC}", items-base.json's `itemEntry` list holds the template,
# and "{{item.resist}}" / "{{getFullImmRes item.resist}}" / "{{item.detail1}}" in
# it are filled from the item's own fields. flatten() passed the tag through as
# text, so 54 pack items (the Dragon Scale Mails, Ioun Stones, Potions and Rings
# of Resistance, Tasha's Absorbing Tattoos) read "{#itemEntry Ring of Resistance|
# XDMG}" where the book's text belongs. The fixtures have the shapes of those
# templates and items in the v2.36.1 dump, with invented names and text.
B78_ENTRIES = B76_ENTRIES + [
    {"name": "Warding Sigil", "source": "TCE", "entriesTemplate": ["This sigil is inked in {{item.detail1}}.", {"type": "entries", "name": "Sigil Attunement", "entries": ["You attune to the sigil through its needle.", "Ending the attunement fades it."]}, {"type": "entries", "name": "Damage Resistance", "entries": ["While the sigil marks your skin, you have resistance to {{item.resist}} damage."]}, {"type": "entries", "name": "Soaking the Blow", "entries": ["Once per dawn, your reaction can shrug off one hit of {{item.resist}} damage."]}]},
    {"name": "Draught of Warding", "source": "XDMG", "entriesTemplate": ["A swallow of this draught gives you {@variantrule Resistance|XPHB} to {{getFullImmRes item.resist}} damage for 1 hour."]},
    {"name": "Band of Warding", "source": "DMG", "entriesTemplate": ["Set with a {{item.detail1}}, this band grants resistance to {{item.resist}} damage while you wear it."]},
    {"name": "Band of Warding", "source": "XDMG", "entriesTemplate": ["You have {@variantrule Resistance|XPHB} to {{getFullImmRes item.resist}} damage while you wear this band. Its setting holds a {{item.detail1}}."]},
]
B78_ITEMS = [
    {"name": "Band of Acid Warding", "source": "XDMG", "page": 294, "srd52": True, "basicRules2024": True, "referenceSources": ["DrDe-BtS"], "type": "RG|XDMG", "resist": ["acid"], "detail1": "pearl", "rarity": "rare", "hasRefs": True, "entries": ["{#itemEntry Band of Warding|XDMG}"]},
    # the 2014 printing names no source in its tag: the DMG, as in 5e-tools
    {"name": "Band of Acid Warding", "source": "DMG", "page": 192, "srd": True, "basicRules": True, "referenceSources": ["CM", "GotSF"], "reprintedAs": ["Band of Acid Warding|XDMG"], "type": "RG|DMG", "resist": ["acid"], "detail1": "pearl", "tier": "major", "rarity": "rare", "reqAttune": True, "hasRefs": True, "entries": ["{#itemEntry Band of Warding}"]},
    {"name": "Draught of Fire Warding", "source": "XDMG", "page": 289, "srd52": True, "basicRules2024": True, "type": "P|XPHB", "resist": ["fire"], "rarity": "uncommon", "weight": 0.5, "hasRefs": True, "entries": ["{#itemEntry Draught of Warding|XDMG}"], "miscTags": ["CNS"]},
    {"name": "Acid Warding Sigil", "source": "TCE", "page": 119, "resist": ["acid"], "detail1": "green", "rarity": "very rare", "reqAttune": True, "wondrous": True, "tattoo": True, "hasRefs": True, "entries": ["{#itemEntry Warding Sigil|TCE}"]},
    {"name": "Wisp Stone, Mastery", "source": "XDMG", "page": 273, "srd52": True, "basicRules2024": True, "rarity": "legendary", "reqAttune": True, "wondrous": True, "bonusProficiencyBonus": "+1", "hasRefs": True, "entries": ["{#itemEntry Wisp Stone|XDMG}", "Your {@variantrule Proficiency|XPHB|Proficiency Bonus} increases by 1 while this sea-green bead orbits your head."], "lootTables": ["Arcana - Legendary|XDMG"], "hasFluffImages": True},
    [x for x in B76_STANDING if x['name'] == 'Black Wyrmhide Mail'][0],
]
_b78base = _tmpjson({'itemProperty': IB_PROPS, 'itemMastery': IB_MASTERY, 'baseitem': IB_BASE, 'itemEntry': B78_ENTRIES})
_b78magic = _tmpjson({'item': B78_ITEMS})
_TM = getattr(C, '_TEMPLATE_MISSES', None)
if _TM is not None: _TM.clear()
DMG = C.Book(codes=['DMG'], system='DMG')
with C.statblock_ctx(C.load_item_index(_b78base, _b78magic)):
    b78 = _by_name(C.convert_items(_b78magic))
    b78t = _by_name(C.convert_items(_b78magic, book=TCE))
    b78d = _by_name(C.convert_items(_b78magic, book=DMG))
    b78sb = C._statblock_text({'type': 'statblock', 'tag': 'item', 'name': 'Band of Acid Warding', 'source': 'XDMG'})
desc = lambda pack, n: pack.get(n, {}).get('description', '')
ck('#78 Band of Acid Warding reads the template, its damage type in the 2024 book\'s capitals',
   desc(b78, 'Band of Acid Warding') == 'You have Resistance to Acid damage while you wear this band. Its setting holds a pearl',
   desc(b78, 'Band of Acid Warding'))
ck('#78 Draught of Fire Warding reads the template',
   desc(b78, 'Draught of Fire Warding') == 'A swallow of this draught gives you Resistance to Fire damage for 1 hour',
   desc(b78, 'Draught of Fire Warding'))
ck('#78 a tag naming no source is the DMG\'s template, "{{item.resist}}" printed as the item has it (2014 band)',
   desc(b78d, 'Band of Acid Warding') == 'Set with a pearl, this band grants resistance to acid damage while you wear it',
   desc(b78d, 'Band of Acid Warding'))
_bdsm = desc(b78, 'Black Wyrmhide Mail')
ck('#78 Black Wyrmhide Mail: its armor line, then the template, filled with its type and its colour',
   _bdsm.startswith('AC 14 + Dex modifier (max 2) · Disadvantage on Stealth · Base item: Scale Mail. Wyrmhide Mail is stitched from the shed skin')
   and '\nWhile wearing this armor, you enjoy a +1 bonus to Armor Class, you have Advantage on saving throws against a '
       'dragon\'s breath, and you have Resistance to Acid damage.\n' in _bdsm
   and 'the nearest black dragon within 30 miles' in _bdsm and _bdsm.endswith('sleeps until the next dawn'), _bdsm)
ck('#78 ...and it still reads its +1 AC from that text', b78.get('Black Wyrmhide Mail', {}).get('effects') == _fx(1),
   b78.get('Black Wyrmhide Mail', {}).get('effects'))
_tat = desc(b78t, 'Acid Warding Sigil')
ck('#78 Acid Warding Sigil: the template\'s named sections, as flatten() writes any others',
   _tat.startswith('This sigil is inked in green.\n'
                   'Sigil Attunement: You attune to the sigil through its needle.')
   and '\nDamage Resistance: While the sigil marks your skin, you have resistance to acid damage.\n' in _tat
   and '\nSoaking the Blow: Once per dawn, your reaction can shrug off one hit of acid damage' in _tat, _tat)
_ism = desc(b78, 'Wisp Stone, Mastery')
ck('#78 Wisp Stone, Mastery: the four shared paragraphs, then its own',
   _ism.startswith('No bigger than a cherry, Wisp Stones take their name') and _ism.count('\n') == 4
   and _ism.endswith('\nYour Proficiency Bonus increases by 1 while this sea-green bead orbits your head'), _ism)
ck('#78 an embedded item statblock reads its template too',
   'Resistance to Acid damage' in b78sb and '{' not in b78sb, b78sb)
ck('#78 no template text is left in any of them',
   not [n for p in (b78, b78t, b78d) for n, e in p.items() if '{#' in e.get('description', '') or '{{' in e.get('description', '')])
ck('#78 ...and nothing to warn about', _TM is not None and not _TM, dict(_TM) if _TM is not None else 'no _TEMPLATE_MISSES')

# never quiet: a template the dump lacks, a value the item lacks, a tag inside a sentence
B78_BAD = [
    {"name": "Ring of Nothing", "source": "XDMG", "srd52": True, "type": "RG|XDMG", "rarity": "rare", "hasRefs": True,
     "entries": ["{#itemEntry Ring of Nothing|XDMG}"]},
    {"name": "Ring of Blank Resistance", "source": "XDMG", "srd52": True, "type": "RG|XDMG", "rarity": "rare", "hasRefs": True,
     "entries": ["{#itemEntry Band of Warding|XDMG}"]},
    {"name": "Ring of Asides", "source": "XDMG", "srd52": True, "type": "RG|XDMG", "rarity": "rare",
     "entries": ["As for {#itemEntry Band of Warding|XDMG}, but cold."]},
]
if _TM is not None: _TM.clear()
with C.statblock_ctx(C.load_item_index(_b78base)):
    b78b = _by_name(C.convert_items(_tmpjson({'item': B78_BAD})))
ck('#78 a template the dump lacks is printed as the tag', desc(b78b, 'Ring of Nothing') == '{#itemEntry Ring of Nothing|XDMG}',
   desc(b78b, 'Ring of Nothing'))
ck('#78 a placeholder the item has no value for is printed as it stands',
   '{{getFullImmRes item.resist}}' in desc(b78b, 'Ring of Blank Resistance') and '{{item.detail1}}' in desc(b78b, 'Ring of Blank Resistance'),
   desc(b78b, 'Ring of Blank Resistance'))
_tmk = {t: set(v) for (t, why), v in (_TM or {}).items()}
ck('#78 ...and each is counted with its item',
   _tmk.get('{#itemEntry Ring of Nothing|XDMG}') == {'Ring of Nothing'}
   and _tmk.get('{{getFullImmRes item.resist}}') == {'Ring of Blank Resistance'}
   and _tmk.get('{{item.detail1}}') == {'Ring of Blank Resistance'}
   and _tmk.get('{#itemEntry Band of Warding|XDMG}') == {'Ring of Asides'}, _tmk)
said = []
getattr(C, '_template_miss_warnings', lambda warn: None)(said.append)
ck('#78 ...and reported as one WARNING per text, naming the item and why',
   len(said) == 4 and any('Ring of Nothing' in s and '{#itemEntry Ring of Nothing|XDMG}' in s for s in said)
   and any('Ring of Blank Resistance' in s and '{{item.detail1}}' in s for s in said), said)
if _TM is not None: _TM.clear()

# ...at the end of every kind of run that converts items, and in the file's own line
_dump = tempfile.mkdtemp()
json.dump({'itemProperty': IB_PROPS, 'itemMastery': IB_MASTERY, 'baseitem': IB_BASE, 'itemEntry': B78_ENTRIES},
          open(os.path.join(_dump, 'items-base.json'), 'w'))
json.dump({'item': B78_ITEMS + B78_BAD[:1] + [dict(B78_BAD[0], source='TCE')]}, open(os.path.join(_dump, 'items.json'), 'w'))
_out = tempfile.mkdtemp()
for label, argv, outfile, fine, want in (
        ('`items`', ['items', os.path.join(_dump, 'items.json'), '-o', os.path.join(_out, 'i.json')], 'i.json',
         'Band of Acid Warding', 'You have Resistance to Acid damage'),
        ('all', ['all', _dump, '-o', os.path.join(_out, 'all')], os.path.join('all', 'items-magic.json'),
         'Band of Acid Warding', 'You have Resistance to Acid damage'),
        ('supplement', ['supplement', _dump, '-o', os.path.join(_out, 'sup'), '--book', 'TCE'],
         os.path.join('sup', 'items-magic.json'), 'Acid Warding Sigil', 'you have resistance to acid damage')):
    r = subprocess.run([sys.executable, CONV] + argv, capture_output=True, text=True)
    ck('#78 %s warns about the template it could not find' % label,
       'WARNING:' in r.stdout and '{#itemEntry Ring of Nothing|XDMG}' in r.stdout and 'Ring of Nothing' in r.stdout,
       r.stdout[-800:] + r.stderr[-300:])
    ck('#78 %s counts it in the file\'s own line too' % label, 'unresolved' in r.stdout, r.stdout[-600:])
    try:
        got = _by_name(json.load(open(os.path.join(_out, outfile), encoding='utf-8')))
    except (OSError, ValueError) as e:
        got = {'error': str(e)}
    ck('#78 %s writes %s out from its template' % (label, fine), want in got.get(fine, {}).get('description', ''),
       got.get('error') or got.get(fine))
shutil.rmtree(_dump, ignore_errors=True); shutil.rmtree(_out, ignore_errors=True)

# ---- 31. a standing bonus to ability checks or to the proficiency bonus (#79)
# 5e-tools tags the Stone of Good Luck's "+1 bonus to ability checks" as
# bonusAbilityCheck and the Ioun Stone of Mastery's "Your Proficiency Bonus
# increases by 1" as bonusProficiencyBonus, and convert.py read neither: the
# stone's saving-throw half was an effect, its check half nothing, and the Ioun
# Stone changed no number at all. They become `check` (every ability check:
# skills, initiative, passive Perception) and `profBonus`, through the same
# sentence reader as AC and saves (#76), so a bonus the book conditions stays
# prose. The fixtures are the invented stand-ins above, shaped as those items are.
_BP = getattr(C, '_BONUS_PROSE', None)
if _BP is not None: _BP.clear()
_b79 = _tmpjson({'item': [x for x in B76_STANDING if x['name'] == 'Lucky River Pebble']
                         + [x for x in B78_ITEMS if x['name'] == 'Wisp Stone, Mastery']})
with C.statblock_ctx(C.load_item_index(_b78base, _b79)):
    b79 = _by_name(C.convert_items(_b79))
ck('#79 Lucky River Pebble: +1 to all six saves and +1 to ability checks, "while this river-smoothed pebble is on your person"',
   b79.get('Lucky River Pebble', {}).get('effects') == _fx(0, 1) + [{'target': 'check', 'value': 1}],
   b79.get('Lucky River Pebble', {}).get('effects'))
ck('#79 Wisp Stone, Mastery: +1 proficiency bonus, "while this sea-green bead orbits your head"',
   b79.get('Wisp Stone, Mastery', {}).get('effects') == [{'target': 'profBonus', 'value': 1}],
   b79.get('Wisp Stone, Mastery', {}).get('effects'))
ck('#79 both are standing: nothing kept in prose', not (_BP or []), list(_BP or []))
# the reader, on the wordings it must read and the ones it must not
ck('#79 "+1 bonus to ability checks and saving throws" is a standing check bonus',
   rd('While this river-smoothed pebble is on your person, luck leans your way, granting a +1 bonus to ability checks and saving throws.', 'checks', 1)[0] is True,
   rd('While this river-smoothed pebble is on your person, luck leans your way, granting a +1 bonus to ability checks and saving throws.', 'checks', 1))
ck('#79 one named check is not every check ("+5 bonus to Wisdom (Perception) checks")',
   rd('You gain a +5 bonus to Wisdom (Perception) checks.', 'checks', 5)[0] is None,
   rd('You gain a +5 bonus to Wisdom (Perception) checks.', 'checks', 5))
ck('#79 checks narrowed to a tool are not every check ("ability checks made with thieves\' tools")',
   rd("You gain a +2 bonus to ability checks made with thieves' tools.", 'checks', 2)[0] is not True,
   rd("You gain a +2 bonus to ability checks made with thieves' tools.", 'checks', 2))
ck('#79 a check bonus that lasts "until" something is conditional',
   rd('You gain a +1 bonus to ability checks until the end of your next turn.', 'checks', 1)[0] is False,
   rd('You gain a +1 bonus to ability checks until the end of your next turn.', 'checks', 1))
ck('#79 "Your Proficiency Bonus increases by 1 while this … orbits your head" is standing',
   rd('Your Proficiency Bonus increases by 1 while this sea-green bead orbits your head.', 'profBonus', 1)[0] is True,
   rd('Your Proficiency Bonus increases by 1 while this sea-green bead orbits your head.', 'profBonus', 1))
ck('#79 a proficiency bonus that lasts "until" a rest is conditional',
   rd('Your Proficiency Bonus increases by 1 until you finish a Long Rest.', 'profBonus', 1)[0] is False,
   rd('Your Proficiency Bonus increases by 1 until you finish a Long Rest.', 'profBonus', 1))
# a "-2 penalty", shaped as an adventure item's is (never converted), is no bonus: prose, and said
if _BP is not None: _BP.clear()
ILL = {"name": "Unlucky River Pebble", "source": "XDMG", "srd52": True, "rarity": "uncommon", "reqAttune": True, "wondrous": True,
       "bonusSavingThrow": "-2", "bonusAbilityCheck": "-2",
       "entries": ["While this river-smoothed pebble is on your person, luck turns its back on you: you take a "
                   + chr(0x2212) + "2 penalty to ability checks and saving throws."]}
with C.statblock_ctx(C.load_item_index(_b78base)):
    ill = C.convert_items(_tmpjson({'item': [ILL]}))['items'][0]
ck('#79 a penalty no sentence states as a bonus is not an effect', ill.get('effects') == [], ill.get('effects'))
ck('#79 ...and is noted, field by field', sorted(f for n, f, v, why in (_BP or [])) == ['bonusAbilityCheck', 'bonusSavingThrow'],
   list(_BP or []))
if _BP is not None: _BP.clear()

# ---- 31. ammunition: what a launcher fires, what a piece is, what a bundle holds (#7)
# 5e-tools names a launcher's ammunition (ammoType, the single piece) and a
# bundle's contents (packContents); the converter dropped both. Real XPHB/XGE
# items' fields, trimmed of page numbers; the few entries kept are invented.
AMMO_PROPS = IB_PROPS + [{"name": "Ammunition", "abbreviation": "A", "source": "XPHB", "entries": [{"type": "entries", "name": "Ammunition", "entries": ["A weapon with this property needs something to shoot: with nothing loaded, it makes no ranged attack."]}]}]
LONGBOW = {"name": "Longbow", "source": "XPHB", "srd52": True, "basicRules2024": True, "edition": "one", "type": "R|XPHB", "rarity": "none", "weight": 2, "value": 5000, "weaponCategory": "martial", "property": ["A|XPHB", "H|XPHB", "2H|XPHB"], "mastery": ["Slow|XPHB"], "range": "150/600", "dmg1": "1d8", "dmgType": "P", "bow": True, "weapon": True, "ammoType": "arrow|xphb"}
ARROW = {"name": "Arrow", "source": "XPHB", "srd52": True, "edition": "one", "type": "A|XPHB", "rarity": "none", "weight": 0.05, "value": 5, "arrow": True}
ARROWS20 = {"name": "Arrows (20)", "source": "XPHB", "srd52": True, "edition": "one", "type": "A|XPHB", "rarity": "none", "weight": 1, "value": 100, "arrow": True, "packContents": [{"item": "arrow|xphb", "quantity": 20}]}
BOLT = {"name": "Bolt", "source": "XPHB", "srd52": True, "edition": "one", "type": "A|XPHB", "rarity": "none", "weight": 0.075, "value": 5, "bolt": True}
BOLTS20 = {"name": "Bolts (20)", "source": "XPHB", "srd52": True, "edition": "one", "type": "A|XPHB", "rarity": "none", "weight": 1.5, "value": 100, "bolt": True, "packContents": [{"item": "bolt|xphb", "quantity": 20}]}
SLINGB = {"name": "Sling Bullet", "source": "XPHB", "srd52": True, "edition": "one", "type": "A|XPHB", "rarity": "none", "weight": 0.075, "value": 0.2, "bulletSling": True}
CBOLT14 = {"name": "Crossbow Bolt", "source": "PHB", "srd": True, "basicRules": True, "reprintedAs": ["Bolt|XPHB"], "edition": "classic", "type": "A", "rarity": "none", "weight": 0.075, "value": 5, "bolt": True}
CBOLTS14 = {"name": "Crossbow Bolts (20)", "source": "PHB", "srd": True, "basicRules": True, "reprintedAs": ["Bolts (20)|XPHB"], "edition": "classic", "type": "A", "rarity": "none", "weight": 1.5, "value": 100, "bolt": True, "packContents": [{"item": "crossbow bolt|phb", "quantity": 20}]}
NET14 = {"name": "Net", "source": "PHB", "srd": True, "basicRules": True, "reprintedAs": [{"uid": "Net|XPHB", "tag": "item"}], "edition": "classic", "type": "R", "rarity": "none", "weight": 3, "value": 100, "weaponCategory": "martial", "property": ["S", "T"], "range": "5/15", "net": True, "weapon": True}
NET24 = {"name": "Net", "source": "XPHB", "srd52": True, "basicRules2024": True, "type": "G|XPHB", "rarity": "none", "weight": 3, "value": 100, "entries": ["In place of one of the attacks of your Attack action, you can fling this net."]}
UNBREAKABLE = {"name": "Stubborn Arrow", "source": "XGE", "type": "A", "tier": "minor", "rarity": "common", "entries": ["Nothing can snap this arrow unless it lies inside a {@spell null zone}."]}
_ammobase = _tmpjson({'itemProperty': AMMO_PROPS, 'itemMastery': IB_MASTERY,
                      'baseitem': [LONGBOW, ARROW, ARROWS20, BOLT, BOLTS20, SLINGB, CBOLT14, CBOLTS14, NET14]})
_ammomagic = _tmpjson({'item': [NET24, UNBREAKABLE]})
with C.statblock_ctx(C.load_item_index(_ammobase, _ammomagic)):
    ab = _by_name(C.convert_items(_ammobase))
    ax = _by_name(C.convert_items(_ammomagic, book=XGE))
    ck('#7 a Longbow says it fires arrows', ab.get('Longbow', {}).get('weapon', {}).get('ammo') == 'arrow',
       ab.get('Longbow', {}).get('weapon'))
    ck('#7 an Arrow is ammunition of the arrow kind', ab.get('Arrow', {}).get('ammo') == {'kind': 'arrow'}, ab.get('Arrow'))
    ck('#7 a single piece holds no bundle', 'pack' not in ab.get('Arrow', {}))
    ck('#7 Arrows (20) is twenty Arrows, of the arrow kind',
       ab.get('Arrows (20)', {}).get('pack') == {'item': 'Arrow', 'qty': 20} and ab.get('Arrows (20)', {}).get('ammo') == {'kind': 'arrow'},
       ab.get('Arrows (20)'))
    ck('#7 a Sling Bullet is a sling bullet, by its family flag', ab.get('Sling Bullet', {}).get('ammo') == {'kind': 'sling bullet'},
       ab.get('Sling Bullet'))
    ck("#7 an XGE arrow with no family flag (as the Unbreakable Arrow has none) is an arrow by its name",
       ax.get('Stubborn Arrow', {}).get('ammo') == {'kind': 'arrow'}, ax.get('Stubborn Arrow'))
    ck("#7 a 2014 launcher's pipe-less ammoType resolves through the index to its piece's kind",
       C._ammo_type_kind('crossbow bolt') == 'bolt' and C._ammo_type_kind('arrow|xphb') == 'arrow',
       (C._ammo_type_kind('crossbow bolt'), C._ammo_type_kind('arrow|xphb')))
ck("#7 a launcher's ammoType is read as a kind", C._ammo_type_kind('firearm bullet|xphb') == 'firearm bullet'
   and C._ammo_type_kind(None) == '')
ck('#7 a piece nothing names is no ammunition', C._ammo_kind({'name': 'Rock'}) == '')
_plus2 = dict(ARROW, name='Test Arrow', bonusWeapon='+2')
with C.statblock_ctx(C.load_item_index(_tmpjson({'baseitem': [_plus2]}))):
    p2 = C.convert_items(_tmpjson({'baseitem': [_plus2]}))['items'][0]
ck('#7 ammunition with its own +N carries it as the bonus', p2.get('ammo') == {'kind': 'arrow', 'bonus': 2}, p2.get('ammo'))

# ---- 32. a 2014 item reprinted under another name is not shipped beside its 2024 self (#7)
# pick_2024_preferred() backfilled 2014 entries by NAME, so a renamed reprint
# ("Crossbow Bolt" -> the 2024 "Bolt") shipped twice. Checked against everything
# the 2024 pack ships from EITHER item file: the 2024 Net is gear in items.json.
with C.statblock_ctx(C.load_item_index(_ammobase, _ammomagic)):
    rb = _by_name(C.convert_items(_ammobase))
ck('#7 the 2014 Crossbow Bolt, reprinted as the 2024 Bolt, is dropped', 'Crossbow Bolt' not in rb and 'Bolt' in rb, sorted(rb))
ck('#7 ...and its bundle', 'Crossbow Bolts (20)' not in rb, sorted(rb))
ck('#7 the 2014 Net, reprinted as a 2024 Net in the OTHER item file, is dropped', 'Net' not in rb, sorted(rb))
_lone = dict(CBOLT14, name='Lone 2014 Thing', reprintedAs=['Nothing Shipped|XDMG'])
_lonef = _tmpjson({'baseitem': [_lone]})
with C.statblock_ctx(C.load_item_index(_lonef)):
    lb = _by_name(C.convert_items(_lonef))
ck('#7 a 2014 item whose reprint does NOT ship is kept', 'Lone 2014 Thing' in lb, sorted(lb))
ck('#7 reprint references read in both shapes',
   C._reprint_keys({'reprintedAs': ['Bolt|XPHB', {'uid': 'Net|XPHB', 'tag': 'item'}]}) == {('bolt', 'XPHB'), ('net', 'XPHB')})
ck('#7 with no shipped set the 2014 backfill is as it was (every other category)',
   [e['name'] for e in C.pick_2024_preferred([CBOLT14, BOLT])] == ['Bolt', 'Crossbow Bolt'])

# ---- 33. magic ammunition from 5e-tools' magic variants (#7)
# +1 Ammunition and its kin are generic variants in magicvariants.json, which
# nothing read. Each one the book ships is expanded onto every single 2024 piece
# (never a bundle), selected exactly as other items are. Real-shaped entries,
# with invented names and text.
VARIANTS = {'magicvariant': [
    {"name": "+1 Ammunition", "type": "GV|XDMG", "requires": [{"type": "A|XPHB"}, {"type": "AF|XDMG"}], "ammo": True,
     "inherits": {"namePrefix": "+1 ", "source": "XDMG", "srd52": True, "basicRules2024": True, "rarity": "uncommon", "bonusWeapon": "+1",
                  "entries": ["Add {=bonusWeapon} to the attack and damage rolls of this enchanted piece. The enchantment fades the moment it strikes something."]}},
    {"name": "+1 Ammunition", "type": "GV|DMG", "requires": [{"type": "A"}, {"type": "AF|DMG"}, {"type": "A|XPHB"}, {"type": "AF|XDMG"}], "ammo": True,
     "inherits": {"namePrefix": "+1 ", "source": "DMG", "rarity": "uncommon", "bonusWeapon": "+1",
                  "entries": ["Add {=bonusWeapon} to the attack and damage rolls of this enchanted piece."]}},
    {"name": "Ammunition of Felling", "type": "GV|XDMG", "requires": [{"type": "A|XPHB"}, {"type": "AF|XDMG"}], "ammo": True,
     "inherits": {"nameSuffix": " of Felling", "source": "XDMG", "srd52": True, "basicRules2024": True, "rarity": "very rare",
                  "entries": ["Each piece of this ammunition hungers for one sort of creature; the DM picks the sort, or rolls for it on the table below.",
                              {"type": "table", "colStyles": ["col-2 text-center", "col-10"], "colLabels": ["1d100", "Creature Type"],
                               "rows": [["01-10", "Aberrations"], ["11-15", "Beasts"]]}]}},
    {"name": "Thudding Ammunition", "edition": "classic", "type": "GV|DMG", "requires": [{"type": "A"}, {"type": "AF|DMG"}, {"type": "A|XPHB"}, {"type": "AF|XDMG"}], "ammo": True,
     "inherits": {"namePrefix": "Thudding ", "source": "XGE", "reprintedAs": ["Thudding Ammunition|XDMG"], "rarity": "common",
                  "entries": ["Whatever this piece strikes, it strikes like a mallet: the target makes a {@dc 10} Strength saving throw, landing {@condition prone} on a failure."]}},
    {"name": "Thudding Ammunition", "type": "GV|XDMG", "requires": [{"type": "A|XPHB"}, {"type": "AF|XDMG"}], "ammo": True,
     "inherits": {"namePrefix": "Thudding ", "source": "XDMG", "rarity": "common", "entries": ["Thudding, the 2024 printing."]}},
    {"name": "Adamantine Armor", "type": "GV|XDMG", "requires": [{"type": "MA|XPHB"}, {"type": "HA|XPHB"}],
     "inherits": {"namePrefix": "Adamantine ", "source": "XDMG", "srd52": True, "basicRules2024": True, "rarity": "uncommon", "entries": ["Armor."]}},
]}
_varf = _tmpjson(VARIANTS)
vsink = []
with C.statblock_ctx(C.load_item_index(_ammobase, _ammomagic)):
    v24 = _by_name({'items': C.convert_ammo_variants(_varf, tables=vsink)})
    vxge = _by_name({'items': C.convert_ammo_variants(_varf, tables=[], book=XGE)})
ck('#7 the 2024 pack gets +1 and Felling ammunition, on each single piece and no bundle',
   sorted(v24) == ['+1 Arrow', '+1 Bolt', '+1 Sling Bullet', 'Arrow of Felling', 'Bolt of Felling', 'Sling Bullet of Felling'], sorted(v24))
_p1 = v24.get('+1 Arrow', {})
ck('#7 +1 Arrow is uncommon ammunition, an arrow with +1', _p1.get('ammo') == {'kind': 'arrow', 'bonus': 1}
   and _p1.get('rarity') == 'Uncommon' and _p1.get('category') == 'Ammunition' and _p1.get('type') == 'Ammunition', _p1)
ck("#7 ...weighing what an Arrow weighs, with no cost", _p1.get('weight') == 0.05 and 'cost' not in _p1, _p1)
ck('#7 ...its "{=bonusWeapon}" written out',
   _p1.get('description') == 'Add +1 to the attack and damage rolls of this enchanted piece. The enchantment fades the moment it strikes something',
   _p1.get('description'))
_sl = v24.get('Bolt of Felling', {})
ck('#7 Bolt of Felling is a bolt with no bonus', _sl.get('ammo') == {'kind': 'bolt'} and _sl.get('rarity') == 'Very Rare', _sl)
ck("#7 ...its creature table lifted ONCE, under the variant's own name",
   [t['name'] for t in vsink] == ['Ammunition of Felling Table'] and '[Table: Ammunition of Felling Table]' in _sl.get('description', ''),
   [[t['name'] for t in vsink], _sl.get('description')])
ck("#7 Xanathar's pack gets its own Thudding ammunition and nothing else",
   sorted(vxge) == ['Thudding Arrow', 'Thudding Bolt', 'Thudding Sling Bullet'], sorted(vxge))
ck('#7 ...its tags flattened to words', 'Strength saving throw' in vxge.get('Thudding Arrow', {}).get('description', '')
   and '{@' not in vxge.get('Thudding Arrow', {}).get('description', ''), vxge.get('Thudding Arrow'))
ck('#7 a variant that is not ammunition is never expanded onto a piece', not any(n.startswith('Adamantine') for n in v24))
ck('#7 a variant template the variant cannot fill stays as written',
   C._fill_variant(['A {=bonusWeapon} b {=nope}'], {'bonusWeapon': '+2'}, 'Test') == ['A +2 b {=nope}'])

# ---- #84 decision 1: a rename-flagged entry is still flagged
ents = [{"name": "Lolth's Sting", "source": "XDMG", "srd52": "Spider's Sting"},
        {"name": "Plain", "source": "XDMG"}]
ck('#84 pick_2024_preferred keeps an entry whose srd52 is a rename',
   [e['name'] for e in C.pick_2024_preferred(ents)] == ["Lolth's Sting"])
ck('#84 _variant_selected reads a rename flag on inherits',
   C._variant_selected({"inherits": {"source": "XDMG", "srd52": "New Name"}}, None) is True)

# ---- #84 decision 1: a dict-shaped spell prerequisite renders its own words
pr = [{"spell": [{"choose": "level=0|class=Warlock", "entry": "a Warlock Cantrip That Deals Damage",
                  "entrySummary": "Warlock Cantrip That Deals Damage"}],
       "level": {"level": 2, "class": {"name": "Warlock", "source": "XPHB"}}}]
ck('#84 a choose-a-spell prerequisite renders its entry, never a dict',
   C._render_optfeat_prereq(pr) == 'Level 2 Warlock and a Warlock Cantrip That Deals Damage',
   C._render_optfeat_prereq(pr))

# ---- #84 R4: the Fighting Style choice carries the class's own refFeat option
import tempfile
ck('#84 _ref_feats finds a refFeat however deep',
   C._ref_feats(["x", {"type": "entries", "entries": [{"type": "refFeat", "feat": "Blessed Warrior|XPHB"}]}])
   == [('Blessed Warrior', 'XPHB')])
_pal = {"class": [{"name": "Paladin", "source": "XPHB", "hd": {"number": 1, "faces": 10},
                   "proficiency": ["wis", "cha"], "classFeatures": ["Fighting Style|Paladin|XPHB|2"]}],
        "classFeature": [{"name": "Fighting Style", "source": "XPHB", "className": "Paladin",
                          "classSource": "XPHB", "level": 2,
                          "entries": ["You gain a Fighting Style feat of your choice. Instead of choosing one of those feats, you can choose the option below.",
                                      {"type": "entries", "entries": [{"type": "refFeat", "feat": "Blessed Warrior|XPHB"}]}]}]}
with tempfile.TemporaryDirectory() as _td:
    _pp = os.path.join(_td, 'class-paladin.json')
    json.dump(_pal, open(_pp, 'w', encoding='utf-8'))
    _saved = C._FEAT_INDEX
    C._FEAT_INDEX = {('blessed warrior', 'XPHB'): {"name": "Blessed Warrior", "source": "XPHB",
                                                    "entries": ["You learn two Cleric cantrips of your choice."]}}
    try:
        _cl = C.convert_classes([_pp], book=C.Book(fighting_styles={'Archery', 'Defense'}))['classes'][0]
        _menu = [ch for ch in _cl['levels']['2']['choices'] if ch.get('label') == 'Choose a Fighting Style'][0]
        ck('#84 R4 the menu is filtered to the Book\'s styles, then the refFeat option follows',
           [o['name'] for o in _menu['from']] == ['Archery', 'Defense', 'Blessed Warrior'], [o['name'] for o in _menu['from']])
        ck('#84 R4 the option carries the feat\'s text',
           _menu['from'][-1]['description'] == 'You learn two Cleric cantrips of your choice.', _menu['from'][-1])
        _cl2 = C.convert_classes([_pp])['classes'][0]
        _menu2 = [ch for ch in _cl2['levels']['2']['choices'] if ch.get('label') == 'Choose a Fighting Style'][0]
        ck('#84 R4 with no filter the full ten-style menu stays, plus the option',
           len(_menu2['from']) == len(C.FIGHTING_STYLES) + 1 and _menu2['from'][-1]['name'] == 'Blessed Warrior')
    finally:
        C._FEAT_INDEX = _saved

# ---- #84: the SRD view and the `srd` command, on an invented mini dump
import subprocess
# scripts/srd-corrections.json is written against the real dump: on the mini dump
# every correction would be stale, so these runs pass an empty one, written into
# the run's own temp dir (a missing file is an error)
def _nocorr(root):
    p = os.path.join(root, 'no-corrections.json')
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write('{}\n')
    return p
def _mini_dump(root):
    """Invented entries in the dump's shape: flagged, rename-flagged, unflagged,
    an inherits-flagged variant, a 2014 basicRules-only entry, mixed-case tags."""
    def put(rel, obj):
        p = os.path.join(root, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        json.dump(obj, open(p, 'w', encoding='utf-8'))
    T = [{"number": 1, "unit": "action"}]
    R = {"type": "point", "distance": {"type": "feet", "amount": 60}}
    D = [{"type": "instant"}]
    put('conditionsdiseases.json', {"condition": [
        {"name": "Blinded", "source": "XPHB", "srd52": True, "entries": ["You can't see."]},
        {"name": "Dazed", "source": "XPHB", "entries": ["Not in the SRD."]}], "status": [], "disease": []})
    put('variantrules.json', {"variantrule": [
        {"name": "Advantage", "source": "XPHB", "srd52": True, "entries": ["Roll two d20s."]},
        {"name": "Bastion", "source": "XPHB", "entries": ["Not in the SRD."]}]})
    put('items-base.json', {"baseitem": [
        {"name": "Club", "source": "XPHB", "srd52": True, "type": "M|XPHB", "rarity": "none", "weight": 2,
         "weaponCategory": "simple", "dmg1": "1d4", "dmgType": "B", "weapon": True, "property": ["L|XPHB"]}],
        "itemProperty": [{"abbreviation": "L", "source": "XPHB", "entries": [{"name": "Light"}]}]})
    put('items.json', {"item": [
        {"name": "Heward's Handy Haversack", "source": "XDMG", "srd52": "Handy Haversack", "rarity": "rare",
         "wondrous": True, "entries": ["Heward's Handy Haversack swallows more than it looks able to."]},
        {"name": "Bag of Holding", "source": "XDMG", "srd52": True, "rarity": "uncommon", "wondrous": True,
         "entries": ["It holds what a {@item heward's handy haversack|XDMG|Heward's Handy Haversack} holds."]},
        {"name": "Abacus", "source": "PHB", "basicRules": True, "rarity": "none", "entries": ["A 2014 item."]},
        {"name": "Psychic Blade", "source": "XPHB", "rarity": "none", "entries": ["Not in the SRD."]}]})
    put('magicvariants.json', {"magicvariant": [
        {"name": "Weapon, +1", "inherits": {"source": "XDMG", "srd52": True, "nameSuffix": " +1", "rarity": "uncommon"}},
        {"name": "Weapon of Warning", "inherits": {"source": "XDMG", "rarity": "uncommon"}}]})
    put('backgrounds.json', {"background": [
        {"name": "Acolyte", "source": "XPHB", "srd52": True, "entries": []},
        {"name": "Farmer", "source": "XPHB", "entries": []}]})
    put('feats.json', {"feat": [
        {"name": "Archery", "source": "XPHB", "srd52": True, "category": "FS", "entries": ["+2 to ranged attack rolls."]},
        {"name": "Dueling", "source": "XPHB", "category": "FS", "entries": ["Not in the SRD."]},
        {"name": "Blessed Warrior", "source": "XPHB", "category": "FS:P", "entries": ["You learn two Cleric cantrips."]}]})
    put('races.json', {"race": [
        {"name": "Dwarf", "source": "XPHB", "srd52": True, "size": ["M"], "speed": 30, "entries": []},
        {"name": "Aasimar", "source": "XPHB", "size": ["M"], "speed": 30, "entries": []}]})
    put('optionalfeatures.json', {"optionalfeature": [
        {"name": "Agonizing Blast", "source": "XPHB", "srd52": True, "featureType": ["EI"], "entries": ["Add your Charisma."]},
        {"name": "Parry", "source": "XPHB", "featureType": ["MV:B"], "entries": ["Not in the SRD."]}]})
    put('spells/spells-xphb.json', {"spell": [
        {"name": "Bigby's Hand", "source": "XPHB", "srd52": "Arcane Hand", "level": 5, "school": "V", "time": T,
         "range": R, "components": {"v": True}, "duration": D, "entries": ["{@spell Bigby's hand} makes a hand."]},
        {"name": "Fireball", "source": "XPHB", "srd52": True, "level": 3, "school": "V", "time": T, "range": R,
         "components": {"v": True}, "duration": D, "entries": ["Boom. Compare {@spell bigby's hand|XPHB}."]},
        {"name": "Witch Bolt", "source": "XPHB", "level": 1, "school": "V", "time": T, "range": R,
         "components": {"v": True}, "duration": D, "entries": ["Not in the SRD."]}]})
    put('spells/sources.json', {"XPHB": {
        "Bigby's Hand": {"class": [{"name": "Wizard", "source": "XPHB"}, {"name": "Artificer", "source": "EFA"}]},
        "Fireball": {"class": [{"name": "Wizard", "source": "XPHB"}]}}})
    pal = json.loads(json.dumps(_pal))
    pal['class'][0]['srd52'] = True
    pal['classFeature'][0]['srd52'] = True
    put('class/class-paladin.json', pal)
    put('class/class-artificer.json', {"class": [{"name": "Artificer", "source": "TCE",
        "hd": {"number": 1, "faces": 8}, "classFeatures": []}], "classFeature": []})

CONVERT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts', 'convert.py')
with tempfile.TemporaryDirectory() as _td:
    dump, view, out, out_all = (os.path.join(_td, x) for x in ('dump', 'view', 'out', 'all'))
    _mini_dump(dump)
    info = C.srd_view(dump, view)
    ck('#84 srd_view reads every rename', info['renames'] == {"heward's handy haversack": 'Handy Haversack', "bigby's hand": 'Arcane Hand'}, info['renames'])
    ck('#84 srd_view derives the SRD Fighting Style feats', info['fighting_styles'] == {'Archery'}, info['fighting_styles'])
    ck('#84 srd_view carries the referenced feat', info['ref_feats'] == ['Blessed Warrior'], info['ref_feats'])
    vmv = json.load(open(os.path.join(view, 'magicvariants.json')))['magicvariant']
    ck('#84 an inherits-flagged variant is kept, marked true; an unflagged one goes',
       [v['name'] for v in vmv] == ['Weapon, +1'] and vmv[0]['inherits']['srd52'] is True and vmv[0]['srd52'] is True)
    ck('#84 the view never touches the dump',
       json.load(open(os.path.join(dump, 'items.json')))['item'][0]['name'] == "Heward's Handy Haversack")
    ck('#84 a class the SRD lacks gets no file in the view', not os.path.exists(os.path.join(view, 'class', 'class-artificer.json')))
    NOCORR = _nocorr(_td)
    r = subprocess.run([sys.executable, CONVERT, 'srd', dump, '-o', out, '--corrections', NOCORR], capture_output=True, text=True)
    ck('#84 srd runs clean on the mini dump', r.returncode == 0, r.stdout[-600:] + r.stderr[-600:])
    ck('#84 srd says which corrections file it applied, and how many',
       'corrections: %s (0 removals, 0 global, 0 corrections)' % NOCORR in r.stdout, r.stdout[-600:])
    P = lambda f: json.load(open(os.path.join(out, f), encoding='utf-8'))
    allf = sorted(os.listdir(out))
    ck('#84 every SRD file says system "SRD 5.2" and excludes Humblewood',
       all(P(f).get('system') == 'SRD 5.2' and P(f).get('excludeSystems') == ['humblewood'] for f in allf), allf)
    names = lambda f, k: [e.get('name') or e.get('term') for e in P(f)[k]]
    ck('#84 only flagged entries: conditions', names('conditions.json', 'keywords') == ['Blinded'])
    ck('#84 only flagged entries: glossary', names('glossary.json', 'keywords') == ['Advantage'])
    ck('#84 only flagged entries: magic items (renamed, no 2014 backfill, no Psychic Blade)',
       sorted(names('items-magic.json', 'items')) == ['Bag of Holding', 'Handy Haversack'], names('items-magic.json', 'items'))
    ck('#84 only flagged entries: backgrounds, feats, species, options',
       names('backgrounds.json', 'backgrounds') == ['Acolyte'] and names('feats.json', 'feats') == ['Archery']
       and names('races.json', 'races') == ['Dwarf'] and names('features.json', 'features') == ['Agonizing Blast'])
    sp = {s['name']: s for s in P('spells.json')['spells']}
    ck('#84 a renamed spell keeps its classes, without the Artificer',
       sorted(sp) == ['Arcane Hand', 'Fireball'] and sp['Arcane Hand'].get('class') == ['Wizard'], sp)
    ck('#84 tags to a renamed entry follow it (case-insensitive, display text too)',
       'Arcane Hand makes a hand' in sp['Arcane Hand']['text'] and 'Compare Arcane Hand' in sp['Fireball']['text'],
       [sp['Arcane Hand']['text'], sp['Fireball']['text']])
    mi = {i['name']: i for i in P('items-magic.json')['items']}
    ck('#84 a renamed item\'s own prose uses its new name',
       mi['Handy Haversack']['description'].startswith('Handy Haversack swallows more than it looks'), mi['Handy Haversack'])
    ck('#84 another item\'s tag to it follows', 'what a Handy Haversack holds' in mi['Bag of Holding']['description'], mi['Bag of Holding'])
    cl = P('classes.json')['classes']
    menu = [ch for ch in cl[0]['levels']['2']['choices'] if ch.get('label') == 'Choose a Fighting Style'][0]
    ck('#84 one SRD class (no Artificer fallback), with the SRD menu and the refFeat option',
       [c['name'] for c in cl] == ['Paladin'] and [o['name'] for o in menu['from']] == ['Archery', 'Blessed Warrior'],
       [[c['name'] for c in cl], [o['name'] for o in menu['from']]])
    ck('#84 SRD pack names', P('classes.json').get('name') == 'SRD 5.2 Classes' and P('items.json').get('name') == 'SRD 5.2 Items')
    r = subprocess.run([sys.executable, CONVERT, 'all', dump, '-o', out_all], capture_output=True, text=True)
    A = lambda f: json.load(open(os.path.join(out_all, f), encoding='utf-8'))
    ck('#84 contrast: `all` on the same dump still backfills 2014 and keeps XPHB-only entries',
       {'Abacus', 'Psychic Blade'} <= {i['name'] for i in A('items-magic.json')['items']}
       and A('spells.json')['system'] == 'XPHB')

# ---- #84: the leak scan — names the SRD doesn't publish
fake = {'spells.json': {'spells': [{'name': 'Witch Bolt', 'text': 'x'}, {'name': 'Fireball', 'text': 'Aura of Protection.'}]},
        'classes.json': {'classes': [{'name': 'Fighter', 'subclasses': {'Battle Master': {}}}]}}
errs = C._srd_leaks(fake, {'nonsrd': {'witch bolt', 'protection', 'battle master'}, 'renames': {}})
ck('#84 the leak scan names a non-SRD record and a non-SRD subclass',
   len(errs) == 2 and any('Witch Bolt' in e for e in errs) and any('Battle Master' in e for e in errs), errs)
ck('#84 ...but never matches a name inside other words ("Aura of Protection")',
   not any('Protection' in e for e in errs), errs)
errs = C._srd_leaks({'items.json': {'items': [{'name': 'Bag', 'description': "Like Heward's Handy Haversack."}]}},
                    {'nonsrd': set(), 'renames': {"heward's handy haversack": 'Handy Haversack'}})
ck('#84 the leak scan finds a renamed entry\'s old name anywhere in the text', len(errs) == 1 and 'haversack' in errs[0].lower(), errs)

with tempfile.TemporaryDirectory() as _td:
    dump, view, out, exl = (os.path.join(_td, x) for x in ('dump', 'view', 'out', 'excluded.json'))
    _mini_dump(dump)
    info = C.srd_view(dump, view)
    ck('#84 nonsrd holds the dropped XPHB/XDMG names and the old names',
       {'witch bolt', 'dueling', 'aasimar', 'farmer', 'psychic blade', 'parry', 'dazed', 'bastion',
        "heward's handy haversack", "bigby's hand"} <= info['nonsrd'], sorted(info['nonsrd']))
    ck('#84 ...but not a kept name, nor a feat a kept class references',
       not ({'club', 'archery', 'blessed warrior', 'fireball'} & info['nonsrd']), sorted(info['nonsrd']))
    NOCORR = _nocorr(_td)
    r = subprocess.run([sys.executable, CONVERT, 'srd', dump, '-o', out, '--excluded-out', exl, '--corrections', NOCORR], capture_output=True, text=True)
    ck('#84 a clean mini dump passes the scan, and --excluded-out is written',
       r.returncode == 0 and json.load(open(exl))['renamed'] == {"bigby's hand": 'Arcane Hand', "heward's handy haversack": 'Handy Haversack'},
       r.stdout[-400:])
    sp = os.path.join(dump, 'spells', 'spells-xphb.json')
    d = json.load(open(sp)); d['spell'][1]['entries'].append("Unlike Heward's Handy Haversack, this is fire.")
    json.dump(d, open(sp, 'w'))
    out2 = os.path.join(_td, 'out2')
    r = subprocess.run([sys.executable, CONVERT, 'srd', dump, '-o', out2, '--corrections', NOCORR], capture_output=True, text=True)
    ck('#84 a planted old name fails the run, says why, and writes nothing',
       r.returncode == 1 and "heward's handy haversack" in r.stdout.lower() and not os.path.exists(out2), r.stdout[-400:])

# ---- #84 final review: the SRD pack is built with its corrections, or not at all
with tempfile.TemporaryDirectory() as _td:
    dump, out = os.path.join(_td, 'dump'), os.path.join(_td, 'out')
    _mini_dump(dump)
    _missing = os.path.join(_td, 'nowhere', 'srd-corrections.json')
    r = subprocess.run([sys.executable, CONVERT, 'srd', dump, '-o', out, '--corrections', _missing], capture_output=True, text=True)
    ck('#84 an explicit --corrections path that does not exist fails the run, names it, and writes nothing',
       r.returncode == 1 and _missing in r.stdout and not os.path.exists(out), r.stdout[-600:] + r.stderr[-600:])
    # the default is srd-corrections.json BESIDE convert.py: that is what makes
    # the app zip's scripts/ work, so a convert.py copied alone must fail loudly
    _alone = os.path.join(_td, 'scripts')
    os.makedirs(_alone)
    shutil.copy(CONVERT, _alone)
    _repo_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
    r = subprocess.run([sys.executable, os.path.join(_alone, 'convert.py'), 'srd', dump, '-o', out,
                        '--overlay', os.path.join(_repo_data, 'overlay.json'),
                        '--resources', os.path.join(_repo_data, 'class-resources.json')], capture_output=True, text=True)
    ck('#84 with no --corrections, a convert.py with no srd-corrections.json beside it fails, naming where it looked',
       r.returncode == 1 and os.path.join(_alone, 'srd-corrections.json') in r.stdout and not os.path.exists(out),
       r.stdout[-600:] + r.stderr[-600:])

# ---- #84: srd-corrections.json applied to the converted pack
def _corr_packs():
    return {'spells.json': {'system': 'SRD 5.2', 'spells': [{'name': 'Augury', 'text': "Ask the DM. The DMs and the DM's friend agree."}]},
            'classes.json': {'classes': [{'name': 'Warlock', 'levels': {'1': {'traits': [
                {'name': 'Pact Magic', 'description': 'For example, Witch Bolt.'}]}}}]},
            'tables.json': {'tables': [{'name': 'Bag of Beans Table', 'cols': ['d8', 'Effect'], 'rows': [['1', "The DM's choice"]]}]}}
with tempfile.TemporaryDirectory() as _td:
    good = os.path.join(_td, 'good.json')
    json.dump({'global': [{'word': 'DM', 'replace': 'GM', 'why': 'the SRD says GM', 'page': 5}],
               'corrections': [{'entry': 'Warlock/Pact Magic', 'find': 'Witch Bolt', 'replace': 'Chill Touch', 'page': 70},
                               {'entry': 'table:Bag of Beans Table', 'find': "GM's choice", 'replace': "GM's chosen effect", 'page': 2}]},
              open(good, 'w'))
    p = _corr_packs()
    errs = C._srd_apply_corrections(p, good)
    ck('#84 corrections apply cleanly', errs == [], errs)
    ck('#84 a global swap is whole-word: "DM" and "DM\'s" change, "DMs" doesn\'t',
       p['spells.json']['spells'][0]['text'] == "Ask the GM. The DMs and the GM's friend agree.", p['spells.json']['spells'][0]['text'])
    ck('#84 a trait correction lands on that trait',
       p['classes.json']['classes'][0]['levels']['1']['traits'][0]['description'] == 'For example, Chill Touch.')
    ck('#84 a table correction lands in its cells, after the global swap',
       p['tables.json']['tables'][0]['rows'][0][1] == "The GM's chosen effect", p['tables.json']['tables'][0])
    ck('#84 names are never rewritten', p['tables.json']['tables'][0]['name'] == 'Bag of Beans Table')
    bad = os.path.join(_td, 'bad.json')
    json.dump({'global': [{'word': 'Zzyzx', 'replace': 'Q', 'why': '', 'page': 1}],
               'corrections': [{'entry': 'No Such Entry', 'find': 'a', 'replace': 'b', 'page': 1},
                               {'entry': 'Augury', 'find': 'not in the text', 'replace': 'b', 'page': 1}]}, open(bad, 'w'))
    errs = C._srd_apply_corrections(_corr_packs(), bad)
    ck('#84 a stale or unknown correction is an error, each named',
       len(errs) == 3 and any('Zzyzx' in e for e in errs) and any('No Such Entry' in e for e in errs)
       and any('not in the text' in e for e in errs), errs)
    _absent = os.path.join(_td, 'absent.json')
    errs = C._srd_apply_corrections(_corr_packs(), _absent)
    ck('#84 a missing corrections file is an error, naming the path', len(errs) == 1 and _absent in errs[0], errs)
    _broken = os.path.join(_td, 'broken.json')
    with open(_broken, 'w', encoding='utf-8') as fh:
        fh.write('{"corrections": [\n')
    errs = C._srd_apply_corrections(_corr_packs(), _broken)
    ck('#84 a corrections file that is not JSON is an error line, naming the path, not a traceback',
       len(errs) == 1 and _broken in errs[0], errs)
    # a whole record the SRD doesn't print (the Iron Flask's table) is removed, by the same keys
    rm = os.path.join(_td, 'rm.json')
    json.dump({'remove': [{'entry': 'table:Bag of Beans Table', 'why': 'the SRD prints no such table', 'page': 1}]}, open(rm, 'w'))
    p = _corr_packs()
    errs = C._srd_apply_corrections(p, rm)
    ck('#84 a removal drops the record it names, and nothing else',
       errs == [] and p['tables.json']['tables'] == [] and len(p['spells.json']['spells']) == 1, (errs, p))
    errs = C._srd_apply_corrections(p, rm)
    ck('#84 a removal that matches nothing is an error, named', len(errs) == 1 and 'Bag of Beans Table' in errs[0], errs)

# ---- #84 final review: the committed SRD pack carries its corrections
# CI has neither the dump nor the PDF, so neither the SRD gate nor srd-verbatim
# runs there. This reads committed files only: a data/srd52 regenerated without
# its corrections, or a corrections file of the wrong shape, fails here.
import re
_ROOT =os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
_SC = json.load(open(os.path.join(_ROOT, 'scripts', 'srd-corrections.json'), encoding='utf-8'))
_SP = {f: json.load(open(os.path.join(_ROOT, 'data', 'srd52', f), encoding='utf-8'))
       for f in sorted(os.listdir(os.path.join(_ROOT, 'data', 'srd52'))) if f.endswith('.json')}
def _strs(node):
    """Every string a correction can reach under node: _srd_sub()'s walk."""
    if isinstance(node, str):
        return [node]
    if isinstance(node, dict):
        return [s for k, v in node.items() if k not in C.SRD_KEY_EXEMPT for s in _strs(v)]
    if isinstance(node, list):
        return [s for v in node for s in _strs(v)]
    return []
_is = lambda x, t: isinstance(x, t) and not isinstance(x, bool)
_shape = ([('corrections', c) for c in _SC.get('corrections') or []
           if not (all(_is(c.get(k), str) for k in ('entry', 'find', 'replace')) and _is(c.get('page'), int))]
          + [('accepted', a) for a in _SC.get('accepted') or [] if not all(_is(a.get(k), str) for k in ('entry', 'text', 'why'))]
          + [('global', g) for g in _SC.get('global') or []
             if not (all(_is(g.get(k), str) for k in ('word', 'replace')) and _is(g.get('page'), int))]
          + [('remove', m) for m in _SC.get('remove') or [] if not (_is(m.get('entry'), str) and _is(m.get('page'), int))]
          + [('aliases', k) for k, v in (_SC.get('aliases') or {}).items() if not (_is(k, str) and _is(v, str))])
ck('#84 srd-corrections.json: every section has its shape', _shape == [] and isinstance(_SC.get('aliases'), dict), _shape[:5])
_tg = {}
for _k, _n in C._srd_targets(_SP):
    _tg.setdefault(_k, []).append(_n)
_unknown, _unapplied = [], []
for c in _SC.get('corrections') or []:
    if c['entry'] not in _tg:
        _unknown.append(c['entry'])
        continue
    ss = [s for n in _tg[c['entry']] for s in _strs(n)]
    if c['find'] not in c['replace'] and any(c['find'] in s for s in ss):
        _unapplied.append((c['entry'], 'still has', c['find']))
    if c['replace'] and not any(c['replace'] in s for s in ss):
        _unapplied.append((c['entry'], 'lacks', c['replace']))
ck('#84 every correction names an entry in the committed SRD pack', _unknown == [], _unknown)
ck('#84 every correction is applied in the committed SRD pack: its find gone, its replace there', _unapplied == [], _unapplied[:5])
_top = {('table:' if cat == 'tables' else '') + str(r.get('term') or r.get('name') or '')
        for o in _SP.values() for cat, arr in o.items() if isinstance(arr, list) for r in arr if isinstance(r, dict)}
_kept = [m['entry'] for m in _SC.get('remove') or [] if m['entry'] in _top]
ck('#84 nothing the corrections remove is in the committed SRD pack', _kept == [], _kept)
_left = [g['word'] for g in _SC.get('global') or []
         if any(re.search(r'(?<![\w])' + re.escape(g['word']) + r'(?![\w])', s) for o in _SP.values() for s in _strs(o))]
ck('#84 no global swap\'s word is left, as a whole word, in the committed SRD pack', _left == [], _left)

# ---- #84: srd_text — the pure PDF comparison
import copy
import srd_text as T
ck('#84 norm joins line-end hyphenation and drops running heads',
   T.norm('suc-\ncessful System Reference Document 5.2.1\n7\nend') == 'successful end', T.norm('suc-\ncessful System Reference Document 5.2.1\n7\nend'))
ck('#84 norm drops the PDF\'s soft hyphens and zero-width spaces, as it joins line-end hyphenation',
   T.norm('Meta' + chr(0xAD) + 'magic Op' + chr(0x200B) + 'tions') == 'metamagic options',
   T.norm('Meta' + chr(0xAD) + 'magic Op' + chr(0x200B) + 'tions'))
ck('#84 strip_generated drops the converter\'s stat segments',
   T.strip_generated('Damage 1d6 bludgeoning (Versatile 1d8) · Properties: Versatile · Mastery: Topple\nIt hums.')
   == '\nIt hums.', T.strip_generated('Damage 1d6 bludgeoning (Versatile 1d8) · Properties: Versatile · Mastery: Topple\nIt hums.'))
# convert_items() writes mech + '. ' + prose: the prose after the last segment is checked, not swallowed
_sg = T.strip_generated('Damage 1d6 bludgeoning · Range 20/60 ft · Mastery: Sap · Base item: Mace. When you hit a Fiend, it burns.\nMore.')
ck('#84 strip_generated keeps the prose the converter joins on with ". "', _sg == 'When you hit a Fiend, it burns.\nMore.', _sg)
_sg = T.strip_generated('Damage 1d6 bludgeoning (Versatile 1d8) · Properties: Versatile · Mastery: Topple. This staff has 10 charges.')
ck('#84 ...after a Mastery segment too', _sg == 'This staff has 10 charges.', _sg)
_sg = T.strip_generated('AC +2 (Shield) · Base item: Shield. While holding this Shield, you can animate it.')
ck('#84 ...and after armor segments', _sg == 'While holding this Shield, you can animate it.', _sg)
ck('#84 a description that is all prose is untouched',
   T.strip_generated('A Bedroll sleeps one creature. It is warm.') == 'A Bedroll sleeps one creature. It is warm.')
_pages = ["Augury\nLevel 2 Divination (Cleric)\nAsk the GM about a course of action.\n",
          "Fireball\nLevel 3 Evocation (Wizard)\nA bright streak flashes to a point you choose.\n",
          "Belt of Giant Strength\nWondrous Item\nWhile wearing this belt, your Strength changes.\n"]
_packs = {'spells.json': {'spells': [{'name': 'Augury', 'text': 'Ask the DM about a course of action.'},
                                     {'name': 'Fireball', 'text': 'A bright streak flashes to a point you choose.\nMaterial: a ball of bat guano.'}]},
          'items-magic.json': {'items': [{'name': 'Belt of Hill Giant Strength', 'description': 'While wearing this belt, your Strength changes.'}]},
          'tables.json': {'tables': [{'name': 'Deck', 'cols': ['Card'], 'rows': [['Beholder']]}]}}
f = T.check(_pages, _packs, {})
ck('#84 check finds a span the SRD lacks, with its page', ('Augury', 'dm', 1) in f, f)
ck('#84 a Material line is checked as words', ('Fireball', 'ball bat guano', 2) in f, f)
ck('#84 an entry the SRD titles differently is "(not located)" without an alias',
   ('Belt of Hill Giant Strength', '(not located)', None) in f, f)
ck('#84 a table cell the SRD lacks is found', ('table:Deck', 'beholder', None) in f, f)
f2 = T.check(_pages, _packs, {'accepted': [{'entry': 'Augury', 'text': 'dm', 'why': 't'}],
                              'aliases': {'Belt of Hill Giant Strength': 'Belt of Giant Strength'}})
ck('#84 accepted spans and aliases clear their findings',
   not any(k in ('Augury', 'Belt of Hill Giant Strength') for k, _, _ in f2) and len(f2) == 3, f2)
ck('#84 a table\'s header cells are checked too', ('table:Deck', 'card', None) in f2, f2)
# a stale acceptance or alias fails srd-verbatim, as a stale correction fails the run
f3 = T.check(_pages, _packs, {'accepted': [{'entry': 'Augury', 'text': 'dm', 'why': 't'},
                                           {'entry': 'table:Deck', 'text': 'beholder', 'why': 't'},
                                           {'entry': 'Augury', 'text': 'a span nothing finds', 'why': 't'}],
                              'aliases': {'Belt of Hill Giant Strength': 'Belt of Giant Strength',
                                          'Fireball': 'Fireball',
                                          'Belt of Frost Giant Strength': 'Belt of Giant Strength'}})
_stale = [(k, s) for k, s, _ in f3 if s.startswith('(')]
ck('#84 an acceptance that matches no finding is reported, with its entry and text',
   ('Augury', '(accepted, matched nothing) a span nothing finds') in _stale, f3)
ck('#84 an alias that names no record is reported', ('Belt of Frost Giant Strength', '(alias names no record)') in _stale, f3)
ck('#84 ...but not a used acceptance (prose or a table cell), a used alias, nor one its entry is found without',
   len(_stale) == 2, _stale)
# subraces, subclass descriptions and choice options: walked by both, under the same keys
_walk = {'races.json': {'races': [{'name': 'Elf', 'description': 'An elf.', 'traits': [{'name': 'Keen Senses', 'description': 'Sharp.'}],
                                   'subraces': [{'name': 'Drow', 'description': 'A drow.',
                                                 'traits': [{'name': 'Elven Lineage (Drow)', 'description': 'Dark magic.'}]}]}]},
         'classes.json': {'classes': [{'name': 'Warlock', 'description': 'A pact.', 'levels': {'1': {
             'choices': [{'type': 'option', 'from': [{'name': 'Pact of the Chain', 'description': 'A familiar.'}, 'a plain name']}],
             'spells': {'note': 'You can now have Cantrips: 2.'}}},
             'subclasses': {'Fiend Patron': {'description': 'The Lower Planes.', 'levels': {'3': {
                 'traits': [{'name': "Dark One's Blessing", 'description': 'Temporary Hit Points.'}],
                 'choices': [{'type': 'option', 'from': [{'name': 'A Boon', 'description': 'A boon.'}]}]}}}}}]}}
_want = {'Elf/Drow': 'A drow.', 'Drow/Elven Lineage (Drow)': 'Dark magic.', 'Fiend Patron': 'The Lower Planes.',
         'Warlock/Pact of the Chain': 'A familiar.', 'Fiend Patron/A Boon': 'A boon.'}
_rec = dict(T.records(_walk))
ck('#84 records() walks subraces, their traits, subclass descriptions and choice options',
   all(_rec.get(k) == v for k, v in _want.items()), sorted(_rec.items()))
_tk = {k for k, _ in C._srd_targets(_walk)}
ck('#84 _srd_targets() names the same entries', set(_want) <= _tk, sorted(_tk))
ck('#84 a level\'s spells note is not checked: the converter writes those counts',
   not any('Cantrips: 2' in v for v in _rec.values()), _rec)
_cw = copy.deepcopy(_walk)
with tempfile.TemporaryDirectory() as _td:
    _p = os.path.join(_td, 'c.json')
    json.dump({'corrections': [{'entry': 'Drow/Elven Lineage (Drow)', 'find': 'Dark', 'replace': 'Drow', 'page': 1},
                               {'entry': 'Elf/Drow', 'find': 'A drow.', 'replace': 'A dark elf.', 'page': 1},
                               {'entry': 'Fiend Patron', 'find': 'Lower', 'replace': 'lower', 'page': 1},
                               {'entry': 'Warlock/Pact of the Chain', 'find': 'familiar', 'replace': 'friend', 'page': 1}]}, open(_p, 'w'))
    _e = C._srd_apply_corrections(_cw, _p)
_cr = dict(T.records(_cw))
ck('#84 a correction reaches a subrace, its trait, a subclass description and an option',
   _e == [] and _cr['Drow/Elven Lineage (Drow)'] == 'Drow magic.' and _cr['Elf/Drow'] == 'A dark elf.'
   and _cr['Fiend Patron'] == 'The lower Planes.' and _cr['Warlock/Pact of the Chain'] == 'A friend.', (_e, _cr))
_f = T.check(["Elf\nDrow\nElven Lineage\nYou know the Dancing Lights cantrip.\n"],
             {'races.json': {'races': [{'name': 'Elf', 'subraces': [{'name': 'Drow', 'traits': [
                 {'name': 'Elven Lineage', 'description': 'You know the Dancing Lights cantrip, and Lolth whispers to you.'}]}]}]}}, {})
ck('#84 check() finds a planted non-SRD span in a subrace trait',
   any(k == 'Drow/Elven Lineage' and 'lolth' in s for k, s, _ in _f), _f)

# ---- #84 final review: a {@dice} roll holding a 5e-tools prompt template
# {@dice roll|display} puts its display text second, not third. A roll that is a
# template ("#$prompt_number:…$#", the Carrying Capacity table's) prints that
# display text; every other dice tag prints exactly what it did.
_cc = '{@dice #$prompt_number:title=Enter Strength Score$# × 7.5|Str. × 7.5} lb.'
ck('#84 a dice roll holding a prompt template renders its display text',
   C.strip_tags(_cc) == 'Str. × 7.5 lb.', C.strip_tags(_cc))
ck('#84 ...no other dice text moves: a plain roll with display text keeps the roll',
   C.strip_tags('{@dice 1d6|one die}') == '1d6', C.strip_tags('{@dice 1d6|one die}'))
ck('#84 ...nor a damage roll', C.strip_tags('{@damage 2d6}') == '2d6', C.strip_tags('{@damage 2d6}'))
with tempfile.TemporaryDirectory() as _td:
    _buf = io.StringIO()
    with contextlib.redirect_stdout(_buf):
        C._write({'tables': [{'name': 'T', 'cols': ['A'], 'rows': [[C.strip_tags('{@dice #$prompt_number$# × 2}')]]}]},
                 os.path.join(_td, 't.json'))
    ck('#84 a prompt template with no display text is reported as unresolved', 'unresolved tags!' in _buf.getvalue(), _buf.getvalue())

# ---- #84 final review: a replacement is text, never a regex template
p = _corr_packs()
with tempfile.TemporaryDirectory() as _td:
    _bs = os.path.join(_td, 'bs.json')
    json.dump({'global': [{'word': 'DM', 'replace': 'G\\g<0>M', 'why': 't', 'page': 1}]}, open(_bs, 'w'))
    try:
        errs = C._srd_apply_corrections(p, _bs)
    except Exception as e:
        errs = [repr(e)]
ck('#84 a global swap\'s replacement is written as it stands, backslashes and all',
   errs == [] and p['spells.json']['spells'][0]['text'].startswith('Ask the G\\g<0>M.'), (errs, p['spells.json']['spells'][0]['text']))
with tempfile.TemporaryDirectory() as _td:
    _src, _view = os.path.join(_td, 'dump'), os.path.join(_td, 'view')
    os.makedirs(_src)
    json.dump({'item': [{'name': 'Old Thing', 'source': 'XDMG', 'srd52': 'New \\1 Thing', 'rarity': 'rare',
                         'entries': ['Old Thing hums.']},
                        {'source': 'XDMG', 'srd52': 'Nameless', 'rarity': 'rare', 'entries': ['No name.']}]},
              open(os.path.join(_src, 'items.json'), 'w'))
    try:
        C.srd_view(_src, _view)
        _vi = json.load(open(os.path.join(_view, 'items.json')))['item']
    except Exception as e:
        _vi = [{'entries': [repr(e)]}]
ck('#84 a rename\'s new name is written into its own prose as it stands, backslashes and all',
   _vi[0]['entries'] == ['New \\1 Thing hums.'], _vi)
ck('#84 ...and a rename-flagged entry with no name is kept, not a KeyError', len(_vi) == 2 and 'name' not in _vi[1], _vi)

# ---- #84 final review: `classes` reads the feats a class feature references
with tempfile.TemporaryDirectory() as _td:
    dump = os.path.join(_td, 'dump')
    _mini_dump(dump)
    _pp = os.path.join(dump, 'class', 'class-paladin.json')
    _fs = lambda f: [o['name'] for ch in json.load(open(f))['classes'][0]['levels']['2']['choices']
                     if ch.get('label') == 'Choose a Fighting Style' for o in ch['from']] if os.path.exists(f) else ['(no output)']
    r = subprocess.run([sys.executable, CONVERT, 'classes', _pp, '-o', os.path.join(_td, 'c1.json')], capture_output=True, text=True)
    ck('#84 `classes` without --feats warns, naming the referenced feat it could not find',
       'WARNING' in r.stdout and 'Blessed Warrior' in r.stdout and 'not in the feat index' in r.stdout, r.stdout[-600:] + r.stderr[-300:])
    ck('#84 ...and its Paladin menu lacks Blessed Warrior', 'Blessed Warrior' not in _fs(os.path.join(_td, 'c1.json')), _fs(os.path.join(_td, 'c1.json')))
    r = subprocess.run([sys.executable, CONVERT, 'classes', _pp, '--feats', os.path.join(dump, 'feats.json'),
                        '-o', os.path.join(_td, 'c2.json')], capture_output=True, text=True)
    ck('#84 `classes --feats feats.json` gives the Paladin Blessed Warrior, with no warning',
       _fs(os.path.join(_td, 'c2.json'))[-1:] == ['Blessed Warrior'] and 'not in the feat index' not in r.stdout,
       [_fs(os.path.join(_td, 'c2.json')), r.stdout[-400:]])
    r = subprocess.run([sys.executable, CONVERT, 'all', dump, '-o', os.path.join(_td, 'all')], capture_output=True, text=True)
    r2 = subprocess.run([sys.executable, CONVERT, 'srd', dump, '-o', os.path.join(_td, 'srd'), '--corrections', _nocorr(_td)],
                        capture_output=True, text=True)
    ck('#84 `all` and `srd` find it themselves: no such warning', 'not in the feat index' not in r.stdout + r2.stdout
       and r2.returncode == 0, (r.stdout[-300:], r2.stdout[-300:]))

# ---------- fbdata.py build <dump> --srd: convert, bundle, pack, validate (#85, R12)
with tempfile.TemporaryDirectory() as t:
    dump = os.path.join(t, 'dump')
    _mini_dump(dump)
    out = os.path.join(t, 'srd.zip')
    fb = os.path.join(_ROOT, 'tools', 'data-kit', 'fbdata.py')
    # the mini dump needs an empty corrections file: the real scripts/srd-corrections.json
    # names hundreds of entries this invented dump doesn't have, and a stale correction
    # fails the run (see _nocorr(), used by the other mini-dump `srd` runs above).
    r = subprocess.run([sys.executable, fb, 'build', dump, '--srd', '-o', out,
                        '--corrections', _nocorr(t)], capture_output=True, text=True)
    ok = r.returncode == 0 and os.path.exists(out)
    man = json.loads(zipfile.ZipFile(out).read('fieldbook-data.json')) if ok else {}
    ck('fbdata build <dump> --srd writes an archive holding srd52_full.json',
       ok and [m['file'] for m in man.get('packs', [])] == ['srd52_full.json'], (r.returncode, r.stderr[-400:]))
    ck('...credited CC-BY-4.0, with the SRD statement in NOTICE.md',
       ok and man['packs'][0].get('license') == 'CC-BY-4.0'
       and 'System Reference Document 5.2.1' in zipfile.ZipFile(out).read('NOTICE.md').decode('utf-8'))

# ---------- class one-liners are Fieldbook's own; the SRD pack has none (#85, decision 1)
# Pinned by value: the old lines were the book's, and this file is public, so
# the test names the new wording rather than quoting the old.
ck('CLASS_BLURB is Fieldbook\'s own wording',
   C.CLASS_BLURB.get('Bard', '').startswith('A performer whose songs and stories')
   and C.CLASS_BLURB.get('Wizard', '').startswith('A scholar who masters magic'), C.CLASS_BLURB)
ck('CLASS_BLURB covers the twelve classes, the Artificer and the Mystic', len(C.CLASS_BLURB) == 14)
with tempfile.TemporaryDirectory() as t:
    dump = os.path.join(t, 'dump')
    _mini_dump(dump)
    out = os.path.join(t, 'out')
    r = subprocess.run([sys.executable, CONVERT, 'srd', dump, '-o', out, '--corrections', _nocorr(t)],
                        capture_output=True, text=True)
    classes = json.load(open(os.path.join(out, 'classes.json'), encoding='utf-8'))['classes']
    ck('SRD mode writes no class one-liner', r.returncode == 0 and all(c.get('description', '') == '' for c in classes),
       [c.get('description') for c in classes])

print()
print('FAILURES: ' + ', '.join(fail) if fail else 'ALL PASSED (%d)' % total[0])
sys.exit(1 if fail else 0)
