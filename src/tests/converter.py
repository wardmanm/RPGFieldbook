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

print()
print('FAILURES: ' + ', '.join(fail) if fail else 'ALL PASSED (%d)' % total[0])
sys.exit(1 if fail else 0)
