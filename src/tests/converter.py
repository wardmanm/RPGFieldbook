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
barb = {"name": "Barbarian", "classTableGroups": [
  {"colLabels": ["Rages", "Rage Damage", "Weapon Mastery"],
   "rows": [[2, "+2", 2], [3, "+2", 2], [3, "+2", 3]]},
  {"title": "Spell Slots per Spell Level", "colLabels": ["1st", "2nd"], "rows": [[2, 0], [3, 0], [4, 2]]},
]}
s7 = []
bt = C._class_tables(barb, 'Barbarian', 'class', s7)
ck('class table named', bt['name'] == 'Barbarian Features', bt['name'])
ck('Level column first', bt['cols'][0] == 'Level', bt['cols'])
ck('Rage Damage recovered', 'Rage Damage' in bt['cols'], bt['cols'])
ck('Weapon Mastery recovered', 'Weapon Mastery' in bt['cols'], bt['cols'])
ck('slot group skipped', '1st' not in bt['cols'], bt['cols'])
ck('rows level-indexed', bt['rows'][0] == ['1', '2', '+2', '2'], bt['rows'][0])
ck('row count = levels', len(bt['rows']) == 3, len(bt['rows']))
ck('registered in sink', s7 and s7[0] is bt, s7)

# spellcaster: cantrip/prepared columns skipped, others kept
bard = {"name": "Bard", "classTableGroups": [
  {"colLabels": ["Cantrips Known", "Prepared Spells", "Bardic Die"],
   "rows": [[2, 4, "d6"], [2, 5, "d6"]]},
]}
s8 = []
bd = C._class_tables(bard, 'Bard', 'class', s8)
ck('Bardic Die recovered', bd['cols'] == ['Level', 'Bardic Die'], bd['cols'])
ck('cantrips col skipped', 'Cantrips Known' not in bd['cols'], bd['cols'])

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
ck('no optional features given: no picker, and nothing else changes',
   'choices' not in cls0['subclasses']['Battle Master']['levels']['3'], cls0)

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

print()
print('FAILURES: ' + ', '.join(fail) if fail else 'ALL PASSED (%d)' % total[0])
sys.exit(1 if fail else 0)
