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
  python convert.py classes    class-*.json                  -o classes-2024.json
  python convert.py all        <input-dir> -o <output-dir>   # everything it can find

Options that apply where relevant:
  --overlay overlay.json   add effects/skill/save grants by entry name (feats, fighting styles)
  --sources sources.json   (spells only) tag each spell with its 2024 class list
  --include-legacy         (classes only) also include non-XPHB subclasses (mixes editions)
  --no-spell-notes         (classes only) skip the per-level "prepared/known spells" notes

No third-party dependencies — standard library only. Python 3.8+.
"""
import json, re, argparse, glob, os, sys

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

def flatten(entries):
    """Flatten a 5e-tools 'entries' tree into readable plain text.
    Named subsections render as 'Name: text'; lists as bullets; tables skipped."""
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
            elif t in ('table', 'tableGroup', 'image', 'gallery'):
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
    """Return entries flagged basicRules2024, plus any basicRules(2014) entry
    whose name isn't already covered by a 2024 one (2024 wins on overlap)."""
    two4 = [e for e in entries if e.get('basicRules2024') is True]
    names = {e[name_key] for e in two4}
    legacy = [e for e in entries if e.get('basicRules') is True and e[name_key] not in names]
    return two4 + legacy

# ================================================================ CONDITIONS
def convert_conditions(path, overlay=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    buckets = [d.get('condition', []), d.get('status', []), d.get('disease', [])]
    entries = [e for b in buckets for e in b]
    chosen = pick_2024_preferred(entries)
    keywords = [{'term': e['name'], 'type': 'text', 'text': flatten(e.get('entries', [])), 'cond': True} for e in chosen]
    return {'system': 'XPHB', 'keywords': keywords}

# ================================================================ GLOSSARY (variant rules)
def convert_glossary(path, overlay=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    chosen = pick_2024_preferred(d.get('variantrule', []))
    keywords = [{'term': e['name'], 'type': 'text', 'text': flatten(e.get('entries', []))} for e in chosen]
    return {'system': 'XPHB', 'keywords': keywords}

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

def convert_items(path, overlay=None, **_):
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
    for it in src:
        if it.get('basicRules2024') is not True: continue
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
        prose = flatten(it.get('entries', [])) if it.get('entries') else ''
        mech = ' \u00b7 '.join(bits)
        desc = (mech + '. ' + prose).strip() if mech and prose else (mech or prose)
        # attunement
        ra = it.get('reqAttune')
        attune = bool(ra) and ra is not False
        rec = {'name': it['name'], 'system': 'XPHB', 'category': category, 'type': tname.strip(),
               'rarity': _RAR.get(it.get('rarity', 'none'), (it.get('rarity') or 'Mundane').title()),
               'weight': it.get('weight', None), 'cost': _cost(it.get('value')),
               'attune': attune, 'attuneNote': (strip_tags(ra) if isinstance(ra, str) and ra not in ('optional',) else ''),
               'description': desc.strip(' \u00b7.'), 'effects': _item_effects(it)}
        rec = {k: v for k, v in rec.items() if v not in (None, '', False)}
        rec.setdefault('effects', [])
        if weapon_data: rec['weapon'] = weapon_data
        out.append(rec)
    return {'system': 'XPHB', 'name': 'D&D 2024 Items', 'items': out}

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

def convert_backgrounds(path, overlay=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    chosen = [b for b in d.get('background', []) if b.get('source') == 'XPHB']
    out = []
    for b in chosen:
        rec = {'name': b['name'], 'system': 'XPHB'}
        ab = b.get('ability', [])
        if ab:
            fr = ab[0].get('choose', {}).get('weighted', {}).get('from', [])
            if fr:
                rec['abilityScores'] = fr
        labels = {}
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
    return {'system': 'XPHB', 'name': 'D&D 2024 Backgrounds', 'backgrounds': out}

# ================================================================ FEATS
def _render_prereq(pr):
    if not pr: return ''
    alts = []
    for block in pr:
        parts = []
        if 'level' in block: parts.append(f"Level {block['level']}+")
        if 'feature' in block: parts.append(', '.join(block['feature']) + ' feature')
        if block.get('spellcasting2020') or block.get('spellcastingFeature'): parts.append('Spellcasting feature')
        for a in block.get('ability', []):
            for k, v in a.items(): parts.append(f"{ABIL_FULL.get(k, k)} {v}+")
        if 'other' in block: parts.append(strip_tags(block['other']))
        if parts: alts.append(' and '.join(parts))
    return ' or '.join(alts)

def convert_feats(path, overlay=None, **_):
    overlay = overlay or {}
    d = json.load(open(path, encoding='utf-8'))
    chosen = pick_2024_preferred(d.get('feat', []))
    out = []
    for f in chosen:
        lead = CAT_LABEL.get(f.get('category'), '')
        pr = _render_prereq(f.get('prerequisite'))
        if pr: lead = (lead + ' · ' if lead else '') + 'Prerequisite: ' + pr
        body = flatten(f.get('entries', []))
        if f.get('repeatable') and 'more than once' not in body:
            body = (body + '\n' if body else '') + 'Repeatable: You can take this feat more than once.'
        rec = {'name': f['name'], 'description': ((lead + '\n' if lead else '') + body).strip()}
        apply_overlay(f['name'], rec, overlay)
        out.append(rec)
    return {'system': 'XPHB', 'feats': out}

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

def convert_spells(path, sources=None, **_):
    d = json.load(open(path, encoding='utf-8'))
    chosen = [s for s in d.get('spell', []) if s.get('source') == 'XPHB'] \
             or pick_2024_preferred(d.get('spell', []))
    classmap = {}
    if sources:
        srcdata = json.load(open(sources, encoding='utf-8'))
        # merge every book's spell->class map; keep 2024 sources (XPHB + EFA = 2024 Artificer)
        for book, spells in srcdata.items():
            for spname, info in spells.items():
                names = sorted({c['name'] for c in info.get('class', []) if c.get('source') in ('XPHB', 'EFA')})
                if names:
                    classmap.setdefault(spname, set()).update(names)
    out = []
    for s in chosen:
        meta = ' · '.join(x for x in [SCHOOL.get(s.get('school'), ''), _cast_time(s), _range(s), _components(s), _duration(s)] if x)
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
    return {'system': 'XPHB', 'spells': out}

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

def _ref_str(ref):
    return ref.get('classFeature') if isinstance(ref, dict) else ref

def convert_classes(paths, overlay=None, include_legacy=False, spell_notes=True, resources=None, **_):
    overlay = overlay or {}
    resources = resources or {}
    out_classes = []
    warnings = []
    for path in paths:
        d = json.load(open(path, encoding='utf-8'))
        cls = d.get('class', [])
        entry = next((c for c in cls if c.get('source') == 'XPHB'), None) \
                or next((c for c in cls if c.get('source') == 'PHB'), None) \
                or (cls[0] if cls else None)
        if not entry:
            continue
        src = entry['source']
        if src != 'XPHB':
            warnings.append(f"{entry['name']}: no XPHB version, used {src}")

        cfidx = {(cf['name'].lower(), cf['source'], int(cf['level']), cf['className'].lower()): cf
                 for cf in d.get('classFeature', [])}
        sfidx = {(sf['name'].lower(), sf['source'], int(sf['level']), sf.get('subclassShortName', '').lower()): sf
                 for sf in d.get('subclassFeature', [])}

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
            if name == 'Fighting Style':
                fs = [apply_overlay(o['name'], dict(o), overlay) for o in (dict(x) for x in FIGHTING_STYLES)]
                addchoice(lvl, {'type': 'option', 'label': 'Choose a Fighting Style', 'choose': 1, 'from': fs}); continue
            cf = cfidx.get((name.lower(), fsrc, lvl, cn.lower())) or cfidx.get((name.lower(), src, lvl, cn.lower()))
            if not cf: continue
            addtrait(lvl, {'name': name, 'description': flatten(cf.get('entries', []))})
        if sub_level:
            addchoice(sub_level, {'type': 'subclass', 'label': sub_title})

        if spell_notes and C.get('spellcasting'):
            for lvl, note in _spell_notes(entry).items():
                L(lvl).setdefault('spells', {}).update(note)

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
                slevels.setdefault(lvl, {}).setdefault('traits', []).append(
                    {'name': nm, 'description': flatten(sf.get('entries', []))})
                if not desc:
                    for e in sf.get('entries', []):
                        if isinstance(e, str) and len(strip_tags(e)) > 40:
                            desc = strip_tags(e); break
            SD['description'] = desc
            SD['levels'] = {str(k): slevels[k] for k in sorted(slevels)}
            subs[sc['name']] = SD
        if subs: C['subclasses'] = subs
        if C['name'] in resources: C['resources'] = resources[C['name']]
        out_classes.append(C)

    for w in warnings:
        print('  note:', w, file=sys.stderr)
    return {'system': 'XPHB', 'name': 'XPHB Classes (2024)', 'version': 1, 'classes': out_classes}

# ================================================================ CLI
def _write(obj, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    residual = open(path, encoding='utf-8').read().count('{@')
    n = len(obj.get('keywords') or obj.get('feats') or obj.get('spells') or obj.get('classes') or [])
    print(f"  wrote {path}  ({n} entries{', ' + str(residual) + ' unresolved tags!' if residual else ''})")

def main():
    ap = argparse.ArgumentParser(description="Convert 5e-tools JSON into Fieldbook rules JSON.")
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name in ('conditions', 'glossary', 'feats', 'backgrounds', 'items', 'spells', 'classes'):
        p = sub.add_parser(name)
        p.add_argument('inputs', nargs='+')
        p.add_argument('-o', '--out', required=True)
        p.add_argument('--overlay')
        p.add_argument('--resources')
        p.add_argument('--sources')
        p.add_argument('--include-legacy', action='store_true')
        p.add_argument('--no-spell-notes', action='store_true')
    pa = sub.add_parser('all'); pa.add_argument('dir'); pa.add_argument('-o', '--out', required=True)
    pa.add_argument('--overlay'); pa.add_argument('--include-legacy', action='store_true')
    a = ap.parse_args()

    if a.cmd == 'all':
        d, outdir = a.dir, a.out
        os.makedirs(outdir, exist_ok=True)
        overlay = load_overlay(a.overlay or (os.path.join(d, 'overlay.json') if os.path.exists(os.path.join(d, 'overlay.json')) else None))
        def find(*names):
            for n in names:
                hits = glob.glob(os.path.join(d, n))
                if hits: return hits
            return []
        cond = find('*condition*.json', 'conditionsdiseases.json')
        if cond: _write(convert_conditions(cond[0]), os.path.join(outdir, 'conditions-2024.json'))
        gloss = find('*variantrule*.json', 'variantrules.json')
        if gloss: _write(convert_glossary(gloss[0]), os.path.join(outdir, 'glossary-2024.json'))
        items = find('items-base*.json', 'items-base.json', 'items*.json')
        if items: _write(convert_items(items[0]), os.path.join(outdir, 'items-2024.json'))
        bgs = find('background*.json', 'backgrounds.json')
        if bgs: _write(convert_backgrounds(bgs[0]), os.path.join(outdir, 'backgrounds-2024.json'))
        feats = find('feats*.json', 'feat.json')
        if feats: _write(convert_feats(feats[0], overlay=overlay), os.path.join(outdir, 'feats-2024.json'))
        spells = find('spells*.json', 'spell*.json')
        srcs = find('sources.json')
        if spells: _write(convert_spells(spells[0], sources=srcs[0] if srcs else None), os.path.join(outdir, 'spells-2024.json'))
        classfiles = sorted(glob.glob(os.path.join(d, 'class-*.json')))
        cres = load_class_resources(os.path.join(d, 'class-resources.json'))
        if classfiles: _write(convert_classes(classfiles, overlay=overlay, include_legacy=a.include_legacy, resources=cres), os.path.join(outdir, 'classes-2024.json'))
        return

    overlay = load_overlay(a.overlay)
    if a.cmd == 'conditions':
        _write(convert_conditions(a.inputs[0]), a.out)
    elif a.cmd == 'glossary':
        _write(convert_glossary(a.inputs[0]), a.out)
    elif a.cmd == 'backgrounds':
        _write(convert_backgrounds(a.inputs[0]), a.out)
    elif a.cmd == 'items':
        _write(convert_items(a.inputs[0]), a.out)
    elif a.cmd == 'feats':
        _write(convert_feats(a.inputs[0], overlay=overlay), a.out)
    elif a.cmd == 'spells':
        _write(convert_spells(a.inputs[0], sources=a.sources), a.out)
    elif a.cmd == 'classes':
        files = []
        for pat in a.inputs:
            files.extend(sorted(glob.glob(pat)) if any(ch in pat for ch in '*?[') else [pat])
        _write(convert_classes(files, overlay=overlay, include_legacy=a.include_legacy,
                               spell_notes=not a.no_spell_notes), a.out)

if __name__ == '__main__':
    main()
