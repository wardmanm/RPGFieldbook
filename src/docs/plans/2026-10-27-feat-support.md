# Feat Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At every Ability Score Improvement level, offer the ASI or a feat in one list. Ask for the feat's +1.
Make level 19's Epic Boon a choice. Let a species grant feats the way a background does. Add a per-character
"Feats allowed" switch, Undo level-up, and a level-down dialog that shows what the level gave.

**Architecture:**
- **Task 1.** The converter keeps two things it drops today:
  - a feat's structured `ability` increase;
  - a species' `feats`, written as `feat` or `choices:[{type:"feat"}]`.

  SRD 5.2 and the private packs are regenerated.
- **Task 2.** Pure feat helpers: prerequisites, qualification, the +1, and the offered list.
- **Task 3.** The `asi` choice becomes one list with the ASI pinned first, plus the `featsAllowed` setting.
- **Task 4.** Feat choices on species and backgrounds, and level 19.
- **Task 5.** Undo level-up, and the level log with the level-down dialog.
- **Task 6.** QA and docs.

**Tech Stack:** Plain ES2020, concatenated with no modules. Python 3 stdlib for `scripts/convert.py`. Node suites
through `src/tests/harness.js`, `src/tests/converter.py`, and the project's Playwright MCP.

**Spec:** `src/docs/specs/2026-10-26-feat-support-design.md`. Read it first; its §2 decisions are binding.
**Mockup:** `.superpowers/brainstorm/32894-1793047656/content/asi-or-feat.html`, layout **B** (one list, with the
ASI pinned first).

**Worktree:** `.claude/worktrees/118`, branch `issue/118-feats`. Run every command from
`/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/worktrees/118`.

## Global Constraints

- **Build.** One shipped file, built by concatenation. No modules and no new network calls.
- **Bytes.** LF line endings, a final newline, no BOM.
- **Git.**
  - Never `git add` `dist/fieldbook.html` or `docs/CHANGELOG.md`.
  - Never touch `APP_VERSION`, `DATA_VERSIONS`, `CHANGELOG`, or the `version`, `digest` and `release` fields of
    `data/packs.json`.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Data.**
  - `data/srd52/` changes only in `feats.json` (the new `ability` field) and `races.json` (a species' `feat` and
    `choices`).
  - Every other file must still match byte for byte after `python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o /tmp/srd && diff -r /tmp/srd data/srd52`.
  - The private packs are regenerated only with `python3 scripts/sync-private.py --write`. Their diff is the same
    two kinds of change.
- **The character.**
  - `featsAllowed` defaults to `true`.
  - `levelLog` defaults to `[]`.
  - Both have literal defaults in `blankChar()` and are cleaned in `migrate()`. `migrate()` preserves every other
    field.
- **Identity.**
  - A feat taken at a class level is granted with the origin `{kind:"class", class, level}`.
  - A species' feat uses `{kind:"race", name}`.
  - A background's feat uses `{kind:"background", name}`.
- **Wording.**
  - Ability Score Improvement subline: "+2 to one score, or +1 to two".
  - Switch: "Show all".
  - Warning: "*Feat* needs *missing* (yours is *value*). Take it anyway?", with "Choose another" and "Take it anyway".
  - Setting: "Feats allowed", with the help "Offer a feat instead of an Ability Score Improvement. Turning it off keeps the feats you have."
  - Undo button: "Undo level-up".
- **Markup.**
  - Every `${…}` in a quoted attribute is `esc(…)`, and every body text is `esc()`d.
  - Feat descriptions are escaped text in paragraphs.
- **Touch targets** are at least 44px, and nothing scrolls sideways at 390px.
- **The harness.**
  - Run one suite: `node src/tests/<suite>.js | grep -E "^FAIL|^FAILURES|ALL PASSED|LOAD FAIL"`, or
    `python3 src/tests/converter.py | tail -3`.
  - Run everything: `./build.sh --no-zip && PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" ./src/tests/run.sh`,
    then `git checkout -- dist/fieldbook.html docs/CHANGELOG.md`.
- **Screenshots.** Use the project's Playwright MCP only (`mcp__playwright__*`), saving to
  `/Users/mwardman/Documents/Repos/RPGFieldbook/.claude/qa/in-progress/118-feats/`.

## Review Focus

1. **Qualification with bonuses.** A Strength 12 Fighter whose ASI gave +1 (Strength 13) qualifies for Grappler.
   The check must use `abilFinal()`, never the base score. → Task 2, "featQualifies after effects".
2. **Remove the class, and everything it gave goes.** That covers a feat taken at its level 8, the feat's +1, and
   its features. A feat from a species reverts with the species in the same way. → Task 3, "commit and revert";
   Task 4, "species revert".
3. **Undo after another change.** Rename the character after a level-up, and Undo is gone. Undo straight after
   restores the exact JSON from before. → Task 5, "undo signature".
4. **Level down on a level from before this change.** There's no record, so the app keeps today's behaviour and
   never removes the wrong thing. Two level-downs in a row use their own records. → Task 5, "level-down records".
5. **Hostile feat text.** `<img onerror>` in a feat name or description is escaped in the list, the panel and the
   warning. → Task 3, "escaping".

---

### Task 1: The converter keeps feat ability increases and species feats

**Files:**
- Modify: `scripts/convert.py`:
  - `convert_feats()` (~:1531–1547);
  - `convert_races()` (~:2406, where `rec` is built and `rec['choices']` is set).
- Modify: `data/srd52/feats.json`, `data/srd52/races.json` (regenerated, never hand-edited).
- Modify: `docs/rules-schema.md` (the feats section, and the species section's `feat`/`choices`).
- Test: `src/tests/converter.py`.
- Private repo: `_private-data/` (regenerated with `sync-private.py --write`, and committed there).

**Interfaces:**
- Produces, in rules data:
  - a feat's optional `"ability": [ {"choose":[abil…],"amount":N,"max":M?} | {abil:N, …} ]`;
  - a species' optional `"feat": "Name"`;
  - a species' optional `"choices": [ …, {"type":"feat","category":"origin","label":"…"} ]`.

- [ ] **Step 1: Write the failing tests.** In `src/tests/converter.py`, follow its existing style of loading a
  small 5etools-shaped fixture and calling the converter function. Add:

```python
# ---------- #118: feat ability increases and species feats
import importlib
cv = importlib.import_module("convert") if "convert" not in globals() else convert
feats_fixture = {"feat": [
    {"name": "Athlete", "source": "XPHB", "category": "G", "prerequisite": [{"level": 4, "ability": [{"str": 13}]}],
     "ability": [{"choose": {"from": ["str", "dex"]}}], "entries": ["You gain the following benefits."]},
    {"name": "Durable", "source": "XPHB", "category": "G", "ability": [{"con": 1}], "entries": ["x"]},
    {"name": "Boon of Fate", "source": "XPHB", "category": "EB",
     "ability": [{"choose": {"from": ["str", "dex", "con", "int", "wis", "cha"]}, "max": 30}], "entries": ["x"]},
    {"name": "Ability Score Improvement", "source": "XPHB", "category": "G", "repeatable": True,
     "ability": [{"choose": {"from": ["str", "dex"], "amount": 2}, "hidden": True}], "entries": ["x"]},
    {"name": "Alert", "source": "XPHB", "category": "O", "entries": ["x"]}]}
# write the fixture, then convert it as the existing feat tests do (reuse their helper)
recs = {r["name"]: r for r in run_feats(feats_fixture)}     # run_feats: the suite's own helper, or define one
check("#118 a choose increase becomes {choose, amount}",
      recs["Athlete"].get("ability") == [{"choose": ["str", "dex"], "amount": 1}], recs["Athlete"].get("ability"))
check("#118 a fixed increase is kept", recs["Durable"].get("ability") == [{"con": 1}], recs["Durable"].get("ability"))
check("#118 max is kept", recs["Boon of Fate"].get("ability") == [{"choose": ["str", "dex", "con", "int", "wis", "cha"], "amount": 1, "max": 30}])
check("#118 hidden entries are skipped", "ability" not in recs["Ability Score Improvement"])
check("#118 a feat with no increase has no field", "ability" not in recs["Alert"])
races_fixture = {"race": [
    {"name": "Human", "source": "XPHB", "size": ["M"], "speed": 30, "feats": [{"anyFromCategory": {"category": ["O"], "count": 1}}], "entries": []},
    {"name": "Custom Lineage", "source": "XPHB", "size": ["M"], "speed": 30, "feats": [{"any": 1}], "entries": []},
    {"name": "Tester", "source": "XPHB", "size": ["M"], "speed": 30, "feats": [{"alert|xphb": True}], "entries": []}]}
rr = {r["name"]: r for r in run_races(races_fixture)}
check("#118 an Origin-feat choice becomes a feat choice", {"type": "feat", "category": "origin", "label": "An Origin feat of your choice"} in rr["Human"].get("choices", []), rr["Human"].get("choices"))
check("#118 any feat becomes an unrestricted feat choice", {"type": "feat", "label": "A feat of your choice"} in rr["Custom Lineage"].get("choices", []))
check("#118 a named feat becomes feat", rr["Tester"].get("feat") == "Alert", rr["Tester"].get("feat"))
```

  Use the suite's real helper names for converting a fixture, which are its existing feat and race test helpers.
  Name them in your report. If none exists, write `run_feats` and `run_races` that dump the fixture to a temp
  file and call `cv.convert_feats(path)` / `cv.convert_races(path)`, unpacking the pack the way the existing
  tests do.

- [ ] **Step 2: Run them and watch them fail.**
  Run: `python3 src/tests/converter.py | tail -5`. Expected: FAIL on the `#118` checks.

- [ ] **Step 3: Implement.** In `scripts/convert.py`, near `CAT_LABEL`:

```python
ABIL_KEYS = ('str', 'dex', 'con', 'int', 'wis', 'cha')

def feat_ability(raw):
    """5etools' feat `ability` -> Fieldbook's (#118): [{choose:[...], amount, max?} | {abil: n}].
    Entries marked hidden are dropped (only the Ability Score Improvement feat has them: the app
    supplies that one itself)."""
    out = []
    for a in raw or []:
        if not isinstance(a, dict) or a.get('hidden'):
            continue
        if isinstance(a.get('choose'), dict):
            frm = [k for k in a['choose'].get('from', []) if k in ABIL_KEYS]
            if not frm:
                continue
            e = {'choose': frm, 'amount': int(a['choose'].get('amount', 1))}
            if a.get('max'):
                e['max'] = int(a['max'])
            out.append(e)
        else:
            fixed = {k: int(v) for k, v in a.items() if k in ABIL_KEYS}
            if fixed:
                out.append(fixed)
    return out

def race_feats(raw):
    """5etools' race `feats` -> (fixed feat name or None, [feat choices]) (#118)."""
    fixed, choices = None, []
    for f in raw or []:
        if not isinstance(f, dict):
            continue
        if 'anyFromCategory' in f:
            cats = f['anyFromCategory'].get('category') or []
            if 'O' in cats:
                choices.append({'type': 'feat', 'category': 'origin', 'label': 'An Origin feat of your choice'})
            else:
                choices.append({'type': 'feat', 'label': 'A feat of your choice'})
        elif 'any' in f:
            choices.append({'type': 'feat', 'label': 'A feat of your choice'})
        else:
            for k, v in f.items():
                if v is True:
                    fixed = k.split('|')[0].title()
    return fixed, choices
```

  In `convert_feats()`, after `rec = {...}` and before `apply_overlay`:

```python
        ab = feat_ability(f.get('ability'))
        if ab:
            rec['ability'] = ab
```

  In `convert_races()`, where `rec['choices'] = choices` is set from `_race_skills`, extend it so feat choices
  join the skill choices:

```python
        fixed_feat, feat_choices = race_feats(r.get('feats'))
        if fixed_feat: rec['feat'] = fixed_feat
        if choices or feat_choices: rec['choices'] = (choices or []) + feat_choices
```

  Keep key order stable with the rest of `rec`, so unchanged species stay byte-identical. Check this with the
  diff in Step 5.

  `.title()` on a 5etools name such as `magic initiate; cleric` must give the same name that backgrounds give.
  Backgrounds read their feat from entries text such as "Magic Initiate (Cleric)". If a named species feat ever
  carries a `;`, map `a; b` to `A (B)`. Add that mapping with a test if the fixture shows it.

- [ ] **Step 4: Run the tests.** `python3 src/tests/converter.py | tail -3`. Expected: ALL PASSED.

- [ ] **Step 5: Regenerate and check the gates.**

```bash
python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o /tmp/srd118
diff -r /tmp/srd118 data/srd52 | head -40      # expected: only feats.json and races.json differ
cp /tmp/srd118/feats.json data/srd52/feats.json; cp /tmp/srd118/races.json data/srd52/races.json
diff -r /tmp/srd118 data/srd52                  # expected: no output
python3 scripts/sync-private.py                 # dry run: lists the private packs that change
python3 scripts/sync-private.py --write
git -C _private-data diff --stat                # expected: only feats.json / races.json per pack
```

  Read the private diff. It must show only added `ability` fields and species `feat`/`choices`. Commit it in the
  private repo with `git -C _private-data add -A && git -C _private-data commit -m "data(#118): feat ability increases and species feats"`.
  Do not push; the controller pushes it after public main.

  Then run `PATH="/Users/mwardman/Documents/Repos/RPGFieldbook/.venv/bin:$PATH" .venv/bin/python src/tests/srd-verbatim.py | tail -2`.
  Expected: it passes, since the new fields are data, not prose.

- [ ] **Step 6: Document.** In `docs/rules-schema.md`:
  - add `ability` to the feats section, with the three shapes from spec §3.1;
  - add `feat` and the `feat` choice (`{type:"feat", category?, label?}`) to the species section;
  - note the choice's `category` in the choices section (§5).

- [ ] **Step 7: Run the full suite** (build, run, restore). Expected: all pass.

  The private-data suite runs the sync check; it must pass after `--write`. If `data-archive` or `rules-data`
  pins counts that the new fields change, update them and say so.

- [ ] **Step 8: Commit.**

```bash
git add scripts/convert.py data/srd52/feats.json data/srd52/races.json docs/rules-schema.md src/tests/converter.py
git commit -m "feat(#118): the converter keeps feat ability increases and species feats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Feat helpers: prerequisites, qualification, the +1, and the offered list

**Files:**
- Modify: `src/js/58-choices.js`. Add the helpers under a `/* ---- feats at an ASI (#118) ---- */` header,
  before `choiceFieldHTML`.
- Test: `src/tests/sheet.js`. Add the names to its `loadApp` list.

**Interfaces:**
- Produces:
  - `featCategory(feat) -> "general"|"origin"|"style"|"boon"|""`. It reads the first description line.
  - `featPrereq(feat) -> [[part…]…]`. These are "or" alternatives of "and" parts. Each part is one of:
    - `{kind:"level", n}`;
    - `{kind:"ability", key, n}`;
    - `{kind:"spellcasting", pact:bool}`;
    - `{kind:"style"}`;
    - `{kind:"unknown", text}`.
  - `featUnmet(feat, c?) -> [string]`. Empty means qualified. Otherwise it holds human phrases for the closest
    alternative's unmet known parts, for example `"Strength 13 or higher (yours is 12)"`.
  - `featAbilityChoices(feat) -> [{choose:[k…], amount, max?} | {fixed:{k:n}}]`. It reads the field first and
    the description text second.
  - `featOfferable(feat, opts) -> boolean`, where `opts = {boon:bool, category:"origin"|null, showAll:bool}`.
  - `featTaken(name) -> boolean`.

- [ ] **Step 1: Write the failing tests** in `src/tests/sheet.js`. Add these to `loadApp`:
  `'featCategory','featPrereq','featUnmet','featAbilityChoices','featOfferable','featTaken','abilFinal'`.

```js
// ---------- #118 feat helpers
{
  const keep = X.character;
  const f = (name, desc, extra) => Object.assign({name, description: desc}, extra || {});
  const ath = f('Athlete', 'General feat · Prerequisite: Level 4+ and Strength 13+ or Level 4+ and Dexterity 13+\nYou gain the following benefits.', {ability: [{choose: ['str', 'dex'], amount: 1}]});
  const boon = f('Boon of Fate', 'Epic Boon · Prerequisite: Level 19+\nx', {ability: [{choose: ['str','dex','con','int','wis','cha'], amount: 1, max: 30}]});
  const sty = f('Archery', 'Fighting Style feat · Prerequisite: Fighting Style feature\nx');
  const org = f('Alert', 'Origin feat\nx');
  const odd = f('Weird', 'General feat · Prerequisite: Membership in the Harpers\nx');
  const spl = f('War Caster', 'General feat · Prerequisite: Level 4+ and Spellcasting or Pact Magic feature\nx');
  const hb = f('Moonlit', 'Increase your Dexterity, Wisdom, or Charisma score by 1, to a maximum of 20.\nYou gain…');
  ck('#118 featCategory', X.featCategory(ath) === 'general' && X.featCategory(boon) === 'boon' && X.featCategory(sty) === 'style' && X.featCategory(org) === 'origin' && X.featCategory(hb) === '');
  const pr = X.featPrereq(ath);
  ck('#118 featPrereq reads or-groups of and-parts', pr.length === 2 && pr[0].some(p => p.kind === 'level' && p.n === 4) && pr[0].some(p => p.kind === 'ability' && p.key === 'str' && p.n === 13) && pr[1].some(p => p.key === 'dex'), pr);
  ck('#118 featPrereq keeps what it can\'t read as unknown', X.featPrereq(odd)[0][0].kind === 'unknown');
  ck('#118 featPrereq: spellcasting or pact magic', X.featPrereq(spl)[0].some(p => p.kind === 'spellcasting' && p.pact === true));
  X.character = X.blankChar(); X.character.classes = [{name: 'Fighter', level: 8}]; X.character.level = 8;
  X.character.abilities.str = 12; X.character.abilities.dex = 10;
  ck('#118 featUnmet names the shortfall', /Strength 13 or higher \(yours is 12\)/.test(X.featUnmet(ath).join(' ')), X.featUnmet(ath));
  X.character.features = [{id: 'a', name: 'Ability Score Improvement', enabled: true, effects: [{target: 'ability.str', value: 1}]}];
  ck('#118 featQualifies after effects (abilFinal)', X.featUnmet(ath).length === 0, X.featUnmet(ath));
  ck('#118 an unknown prerequisite never counts as unmet', X.featUnmet(odd).length === 0);
  ck('#118 level 19 for an Epic Boon', X.featUnmet(boon).length === 1);
  ck('#118 Fighting Style needs the feature', X.featUnmet(sty).length === 1);
  X.character.features.push({id: 'b', name: 'Fighting Style', enabled: true});
  ck('#118 ...and is met by it', X.featUnmet(sty).length === 0);
  const ac = X.featAbilityChoices(ath);
  ck('#118 ability from the field', ac.length === 1 && ac[0].choose.join() === 'str,dex' && ac[0].amount === 1);
  const tc = X.featAbilityChoices(hb);
  ck('#118 ability from the text', tc.length === 1 && tc[0].choose.join() === 'dex,wis,cha' && tc[0].amount === 1, tc);
  ck('#118 fixed increase', JSON.stringify(X.featAbilityChoices(f('D', 'x', {ability: [{con: 1}]}))) === JSON.stringify([{fixed: {con: 1}}]));
  ck('#118 no increase', X.featAbilityChoices(org).length === 0);
  ck('#118 offered at an ASI: general yes, origin no, boon only at 19, style with the feature',
     X.featOfferable(ath, {}) && !X.featOfferable(org, {}) && !X.featOfferable(boon, {}) && X.featOfferable(boon, {boon: true}) && X.featOfferable(sty, {}));
  ck('#118 Show all offers everything', X.featOfferable(org, {showAll: true}));
  ck('#118 a species Origin choice offers only Origin feats', X.featOfferable(org, {category: 'origin'}) && !X.featOfferable(ath, {category: 'origin'}));
  X.character.features.push({id: 'c', name: 'Feat: Athlete', enabled: true});
  ck('#118 a taken feat is hidden unless Repeatable', X.featTaken('Athlete') && !X.featOfferable(ath, {}) && X.featOfferable(f('Skilled', 'General feat\nRepeatable: You can take this feat more than once.'), {}) );
  ck('#118 the rules feat named Ability Score Improvement is never offered', !X.featOfferable(f('Ability Score Improvement', 'General feat\nx'), {showAll: true}));
  X.character = keep;
}
```

- [ ] **Step 2: Run and watch it fail.** `node src/tests/sheet.js | grep -E "^FAIL|LOAD FAIL" | head`.

- [ ] **Step 3: Implement** in `src/js/58-choices.js`:

```js
/* ---- feats at an ASI (#118) ----
   A feat's category and prerequisites are its first description line, written
   by the converter: "General feat · Prerequisite: Level 4+ and Strength 13+ or
   Level 4+ and Dexterity 13+". What can't be read is shown, never counted. */
const FEAT_ABIL={strength:"str",dexterity:"dex",constitution:"con",intelligence:"int",wisdom:"wis",charisma:"cha"};
function featHead(f){return String((f&&f.description)||"").split("\n")[0];}
function featCategory(f){
  const h=featHead(f).toLowerCase();
  if(/^general feat/.test(h))return "general";
  if(/^origin feat/.test(h))return "origin";
  if(/^fighting style feat/.test(h))return "style";
  if(/^epic boon/.test(h))return "boon";
  return "";
}
function featPrereq(f){
  const m=/Prerequisite:\s*(.+)$/i.exec(featHead(f));if(!m)return [];
  return m[1].split(/\s+or\s+(?=Level|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Spellcasting|Fighting)/i).map(alt=>
    alt.split(/\s+and\s+/i).map(p=>{
      const s=p.trim();let r;
      if((r=/^Level\s+(\d+)\+$/i.exec(s)))return {kind:"level",n:num(r[1])};
      if((r=/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(\d+)\+$/i.exec(s)))return {kind:"ability",key:FEAT_ABIL[r[1].toLowerCase()],n:num(r[2])};
      if(/^Spellcasting( or Pact Magic)? feature$/i.test(s))return {kind:"spellcasting",pact:/Pact Magic/i.test(s)};
      if(/^Fighting Style feature$/i.test(s))return {kind:"style"};
      return {kind:"unknown",text:s};
    }));
}
function featHasFeature(re){return (character.features||[]).some(x=>x&&x.enabled!==false&&re.test(String(x.name||"")));}
function featPartUnmet(p){
  if(p.kind==="level")return num(character.level)>=p.n?"":`level ${p.n} or higher (yours is ${num(character.level)})`;
  if(p.kind==="ability"){const v=abilFinal(p.key);const nm=(ABIL.find(a=>a[0]===p.key)||[p.key,p.key])[1];return v>=p.n?"":`${nm} ${p.n} or higher (yours is ${v})`;}
  if(p.kind==="spellcasting"){const ok=featHasFeature(p.pact?/Spellcasting|Pact Magic/i:/Spellcasting/i)||(character.classes||[]).some(c=>{const d=findClassDef(c.name);return d&&d.spellcasting;});return ok?"":(p.pact?"the Spellcasting or Pact Magic feature":"the Spellcasting feature");}
  if(p.kind==="style")return featHasFeature(/Fighting Style/i)?"":"the Fighting Style feature";
  return "";   /* unknown: shown on the row, never unmet */
}
/* The closest alternative's unmet parts; [] when any alternative is fully met. */
function featUnmet(f){
  const alts=featPrereq(f);if(!alts.length)return [];
  let best=null;
  for(const alt of alts){const miss=alt.map(featPartUnmet).filter(Boolean);if(!miss.length)return [];if(!best||miss.length<best.length)best=miss;}
  return best;
}
/* A feat's ability increase: its `ability` field (the converter, #118) or, for
   packs without it, "Increase your A, B, or C score by N" in its text. */
function featAbilityChoices(f){
  if(f&&Array.isArray(f.ability)&&f.ability.length)return f.ability.map(a=>a&&Array.isArray(a.choose)
    ?Object.assign({choose:a.choose.filter(k=>FEAT_ABIL_KEYS.includes(k)),amount:Math.max(1,num(a.amount)||1)},a.max?{max:num(a.max)}:{})
    :{fixed:Object.fromEntries(Object.entries(a||{}).filter(([k])=>FEAT_ABIL_KEYS.includes(k)).map(([k,v])=>[k,num(v)]))}).filter(x=>x.fixed?Object.keys(x.fixed).length:x.choose.length);
  const m=/Increase your ((?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:,? (?:or )?(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))*) score by (\d)/i.exec(String((f&&f.description)||""));
  if(!m)return [];
  const keys=m[1].split(/,?\s+or\s+|,\s*/).map(w=>FEAT_ABIL[w.trim().toLowerCase()]).filter(Boolean);
  return keys.length===1?[{fixed:{[keys[0]]:num(m[2])}}]:[{choose:keys,amount:num(m[2])}];
}
const FEAT_ABIL_KEYS=["str","dex","con","int","wis","cha"];
function featTaken(name){const n=String(name||"").toLowerCase();return (character.features||[]).some(x=>String(x.name||"").toLowerCase()==="feat: "+n);}
function featOfferable(f,opts){
  const o=opts||{};const nm=String((f&&f.name)||"");
  if(!nm||/^ability score improvement$/i.test(nm))return false;
  if(o.showAll)return true;
  if(featTaken(nm)&&!/Repeatable/i.test(f.description||""))return false;
  const cat=featCategory(f);
  if(o.category)return cat===o.category;
  if(cat==="origin")return false;
  if(cat==="boon")return !!o.boon;
  if(cat==="style")return featHasFeature(/Fighting Style/i);
  return featUnmet(f).length===0;
}
```

  Two notes on this code:
  - Check that `ABIL` is `[[key,label]…]` as used elsewhere. If `findClassDef(name).spellcasting` isn't the
    field that marks a caster class, use the field `buildSlots()` reads (`00-constants.js:303`) and say so.
  - `FEAT_ABIL_KEYS` is a `const` referenced inside a function. That is fine, because functions only run after
    load. Define it above `featAbilityChoices` anyway, for clarity.

- [ ] **Step 4: Run.** `node src/tests/sheet.js | grep -E "^FAIL|ALL PASSED"`. Expected: ALL PASSED. Fix any
  regex the real data defeats. Also run the helpers over every feat in `data/srd52/feats.json`, and in
  `_private-data/data/5e2024/feats.json` if present. Every prerequisite part should parse to a known kind except
  genuinely free text. Paste that survey into the report.

- [ ] **Step 5: Commit.**

```bash
git add src/js/58-choices.js src/tests/sheet.js
git commit -m "feat(#118): feat helpers — category, prerequisites, qualification, the +1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The choice step: one list with the ASI pinned first, and Feats allowed

**Files:**
- Modify: `src/js/58-choices.js`:
  - the `asi` branch of `choiceFieldHTML()` (~:103);
  - `gatherChoices()` (~:257);
  - `commitChoices()` (~:271);
  - `runChoices()`'s Done handler (~:202), for the warning.
- Modify: `src/js/00-constants.js` `blankChar()` (`featsAllowed:true`), `src/js/71-char-io.js` `migrate()`.
- Modify: `src/js/88-settings.js`: the "Levels and companions" group (~:133) gets the switch, wired like
  `swFamiliars`.
- Modify: `src/css/50-modal.css`: `.ft-*` rules.
- Test: `src/tests/sheet.js`.

**Interfaces:**
- Consumes: the Task 2 helpers, `grantFeatDef(name, origin, pending)` (`50-classrace.js:139`), `addFeatureFromDef`.
- Produces:
  - markup hooks: `.choice[data-ctype="asi"]`, `[data-ft-search]`, `[data-ft-all]`, `[data-ft-pick="<name>"]`
    (`"__asi__"` for the ASI row), `[data-ft-plus="<i>"]`;
  - `asiFeatListHTML(ch, ci, opts)`, `asiPanelHTML(ch, ci, pick)`;
  - `gatherChoices()` returns `{type:"asi", pick:"__asi__"|<feat name>, mode, a, b, plus:[k…]}`;
  - `commitAsiPick(sel, origin, pending)`, used again by Task 4 for species and backgrounds.

- [ ] **Step 1: Write the failing tests** in `src/tests/sheet.js`. Add these to `loadApp`:
  `'choiceFieldHTML','commitChoices','asiFeatListHTML','asiPanelHTML','commitAsiPick','removeClass'`.

```js
// ---------- #118 the ASI-or-feat step
{
  const keep = {ch: X.character, rules: X.rules};
  X.character = X.blankChar(); X.character.classes = [{name: 'Fighter', level: 8}]; X.character.level = 8;
  X.character.abilities.str = 15;
  const evil = '<img src=x onerror=alert(1)>';
  X.rules = Object.assign({}, X.rules, {feats: [
    {name: 'Athlete', description: 'General feat · Prerequisite: Level 4+ and Strength 13+ or Level 4+ and Dexterity 13+\nYou gain the following benefits.\nClimb Speed: …', ability: [{choose: ['str', 'dex'], amount: 1}]},
    {name: 'Great Weapon Master', description: 'General feat · Prerequisite: Level 4+ and Strength 13+\nx', ability: [{str: 1}]},
    {name: 'Alert', description: 'Origin feat\nx'},
    {name: evil, description: 'General feat\n' + evil}]});
  ck('#118 a fresh character has featsAllowed', X.blankChar().featsAllowed === true);
  const h = X.choiceFieldHTML({type: 'asi'}, 0, null);
  ck('#118 the ASI row is pinned first', h.indexOf('data-ft-pick="__asi__"') > -1 && h.indexOf('data-ft-pick="__asi__"') < h.indexOf('data-ft-pick="Athlete"'));
  ck('#118 qualified feats listed, Origin hidden', /data-ft-pick="Athlete"/.test(h) && !/data-ft-pick="Alert"/.test(h));
  ck('#118 the ASI is selected by default, showing today\'s controls', /data-asi-mode/.test(h));
  ck('#118 escaping', !h.includes('<img src=x') && h.includes('&lt;img src=x'));
  X.character.featsAllowed = false;
  const off = X.choiceFieldHTML({type: 'asi'}, 0, null);
  ck('#118 Feats allowed off: no list, today\'s controls', !/data-ft-pick/.test(off) && /data-asi-mode/.test(off));
  X.character.featsAllowed = true;
  const p = X.asiPanelHTML({type: 'asi'}, 0, 'Athlete');
  ck('#118 the panel asks the +1 from the field', /data-ft-plus="0"/.test(p) && /Strength/.test(p) && /Dexterity/.test(p));
  // commit: a feat with its +1, tied to the class level; then removing the class reverts both
  X.commitAsiPick({type: 'asi', pick: 'Athlete', plus: ['dex']}, {kind: 'class', class: 'Fighter', level: 8}, []);
  const ft = X.character.features.find(x => x.name === 'Feat: Athlete');
  ck('#118 the feat is granted with its class-level origin', ft && ft.origin.kind === 'class' && ft.origin.class === 'Fighter' && ft.origin.level === 8, ft);
  ck('#118 its +1 is an effect on the feat', ft && ft.effects.some(e => e.target === 'ability.dex' && e.value === 1), ft && ft.effects);
  X.commitAsiPick({type: 'asi', pick: '__asi__', mode: '2', a: 'str'}, {kind: 'class', class: 'Fighter', level: 4}, []);
  ck('#118 an ASI is stored as today', X.character.features.some(x => x.name === 'Ability Score Improvement' && x.effects[0].target === 'ability.str' && x.effects[0].value === 2));
  X.removeClass(0);
  ck('#118 removing the class removes the feat and the ASI', !X.character.features.some(x => /Athlete|Ability Score Improvement/.test(x.name)));
  X.character = keep.ch; X.rules = keep.rules;
}
```

  If `removeClass` asks for confirmation, set `state.confirm = true` around it. If it takes another argument
  shape, adapt the call and say so.

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Implement.**
  - `blankChar()`: add `featsAllowed:true,`.
  - `migrate()`: add `if(typeof c.featsAllowed!=="boolean")c.featsAllowed=true;`, alongside the other boolean
    defaults.
  - In `58-choices.js`, replace the `asi` branch:

```js
  }else if(t==="asi"){
    inner=character.featsAllowed===false?asiControlsHTML(ci):asiFeatListHTML(ch,ci,{showAll:false})+`<div class="ft-panel" data-ft-panel="${esc(ci)}">${asiPanelHTML(ch,ci,"__asi__")}</div>`;
```

  with these helpers:

```js
/* today's +2 / +1+1 controls, unchanged */
function asiControlsHTML(ci){
  return `<label class="f">Ability Score Improvement</label>
      <div style="display:flex;gap:14px;margin-bottom:6px"><label class="opt" style="margin:0"><input type="radio" name="asimode-${esc(ci)}" data-asi-mode value="2" checked>+2 to one</label><label class="opt" style="margin:0"><input type="radio" name="asimode-${esc(ci)}" data-asi-mode value="1">+1 to two</label></div>
      <div class="g2"><select data-asi-a>${ABIL.map(([k,l])=>`<option value="${esc(k)}">${l}</option>`).join("")}</select><select data-asi-b>${ABIL.map(([k,l])=>`<option value="${esc(k)}">${l}</option>`).join("")}</select></div>`;
}
function asiFeatShort(f){
  const ac=featAbilityChoices(f)[0];const ab=k=>(ABIL.find(a=>a[0]===k)||[k,k])[1].slice(0,3);
  const plus=ac?(ac.fixed?Object.keys(ac.fixed).map(k=>"+"+ac.fixed[k]+" "+ab(k)).join(", "):"+"+ac.amount+" "+ac.choose.map(ab).join(" or ")):"";
  const first=(String(f.description||"").split("\n").slice(1).find(l=>/:/.test(l))||"").split(":")[0];
  return [plus,first].filter(Boolean).join(" · ");
}
function asiFeatListHTML(ch,ci,opts){
  const o=Object.assign({boon:!!ch.boon,category:ch.category||null},opts||{});
  const feats=(rules.feats||[]).filter(f=>featOfferable(f,o)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const row=(key,name,sub,tag,warn)=>`<button type="button" class="ft-row" data-ft-pick="${esc(key)}" aria-pressed="false"><span class="ft-nm"><b>${esc(name)}</b>${sub?`<small>${esc(sub)}</small>`:""}</span>${tag?`<span class="ft-tag${warn?" warn":""}">${esc(tag)}</span>`:""}</button>`;
  const catTag={general:"General",origin:"Origin",style:"Fighting Style",boon:"Epic Boon"};
  return `<label class="f">${esc(ch.label||(ch.boon?"Epic Boon — a feat, or an Ability Score Improvement":"Ability Score Improvement — or a feat instead"))}</label>`+
    `<div class="ft-tools"><input type="search" data-ft-search placeholder="Search feats…" aria-label="Search feats"><label class="ft-all">Show all <button type="button" class="switch${o.showAll?" on":""}" data-ft-all role="switch" aria-checked="${o.showAll?"true":"false"}" aria-label="Show all feats"></button></label></div>`+
    `<div class="ft-list" data-ft-list="${esc(ci)}">`+
    (ch.category?"":row("__asi__","Ability Score Improvement","+2 to one score, or +1 to two","General",false))+
    feats.map(f=>{const un=featUnmet(f);return row(f.name,dispName(f),asiFeatShort(f),un.length?"needs "+un[0]:(catTag[featCategory(f)]||""),un.length>0);}).join("")+
    `</div>`;
}
function asiPanelHTML(ch,ci,pick){
  if(pick==="__asi__")return asiControlsHTML(ci);
  const f=(rules.feats||[]).find(x=>x.name===pick);if(!f)return "";
  const body=String(f.description||"").split("\n").slice(1).join("\n");
  const plus=featAbilityChoices(f).map((a,i)=>a.fixed
    ?`<p class="hint">${esc(Object.entries(a.fixed).map(([k,v])=>"+"+v+" "+(ABIL.find(x=>x[0]===k)||[k,k])[1]).join(", "))}</p>`
    :`<div class="ft-plus" role="radiogroup" aria-label="+${esc(String(a.amount))} to">+${esc(String(a.amount))} to: ${a.choose.map((k,j)=>`<button type="button" class="ft-chip${j===0?" on":""}" data-ft-plus="${esc(String(i))}" data-k="${esc(k)}" aria-pressed="${j===0?"true":"false"}">${esc((ABIL.find(x=>x[0]===k)||[k,k])[1])}</button>`).join("")}</div>`).join("");
  return `<div class="ft-desc">${body.split(/\n\s*\n|\n/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join("")}</div>${plus}`;
}
```

  Wiring. `choiceFieldHTML` returns markup only, so add `wireAsiFeats()` and call it right after `wireHPChoice()`
  in `runChoices()` (and in `runExtraChoices()` in Task 4). For each `.choice[data-ctype="asi"]`:
  - a click on `[data-ft-pick]` sets it pressed (only one at a time) and repaints that choice's
    `[data-ft-panel]` with `asiPanelHTML`;
  - input on `[data-ft-search]` hides rows whose name doesn't contain the text;
  - a click on `[data-ft-all]` toggles the switch, re-renders the list with `{showAll:on}`, and keeps the search
    text and the current pick;
  - a click on a `[data-ft-plus]` chip makes it the only pressed chip in its group.

  The ASI row starts pressed. Bind listeners on each choice's own elements. They are new on each modal open,
  so they never stack.

  `gatherChoices()`, the `asi` case:

```js
    else if(t==="asi"){const pk=div.querySelector('[data-ft-pick][aria-pressed="true"]');const pick=pk?pk.dataset.ftPick:"__asi__";
      const mode=(div.querySelector('[data-asi-mode]:checked')||{}).value||"2";
      out.push({type:"asi",pick,mode,a:(div.querySelector('[data-asi-a]')||{}).value,b:(div.querySelector('[data-asi-b]')||{}).value,
        plus:Array.from(div.querySelectorAll('.ft-plus')).map(g=>{const c=g.querySelector('[data-ft-plus][aria-pressed="true"]');return c?c.dataset.k:"";}),
        sid:div.dataset.sid||""});}
```

  `commitChoices()`, the `asi` case, becomes
  `else if(sel.type==="asi")commitAsiPick(sel,{kind:"class",class:className,level:entry?entry.level:null},_featPending);`.
  Then:

```js
/* One pick at an ASI (#118): the ASI as today, or a feat with its +1 stored on
   the feat, granted with `origin` so it reverts with whatever gave it. */
function commitAsiPick(sel,origin,pending){
  if(!sel.pick||sel.pick==="__asi__"){
    const fx=sel.mode==="2"?[{target:"ability."+sel.a,value:2}]:[{target:"ability."+sel.a,value:1},{target:"ability."+sel.b,value:1}];
    addFeatureFromDef({name:"Ability Score Improvement",description:"Gained from leveling "+(origin.class||"")+".",effects:fx},origin);return;
  }
  const f=(rules.feats||[]).find(x=>x.name===sel.pick);
  grantFeatDef(sel.pick,origin,pending);
  const ft=(character.features||[]).slice().reverse().find(x=>x.name==="Feat: "+(f?f.name:sel.pick));
  if(!ft)return;
  const fx=[];
  featAbilityChoices(f).forEach((a,i)=>{
    if(a.fixed)Object.entries(a.fixed).forEach(([k,v])=>fx.push({target:"ability."+k,value:v}));
    else{const k=(sel.plus||[])[i]||a.choose[0];if(k)fx.push({target:"ability."+k,value:a.amount});}
  });
  if(fx.length)ft.effects=(Array.isArray(ft.effects)?ft.effects:[]).concat(fx);
}
```

  The warning goes in `runChoices()`'s Done handler, before `gatherChoices()` closes the modal. For each `asi`
  choice whose pick is a feat with `featUnmet(f).length`, call `confirm(...)` and return when it is declined:

```js
    for(const div of document.querySelectorAll('.choice[data-ctype="asi"]')){
      const pk=div.querySelector('[data-ft-pick][aria-pressed="true"]');if(!pk||pk.dataset.ftPick==="__asi__")continue;
      const f=(rules.feats||[]).find(x=>x.name===pk.dataset.ftPick);const un=f?featUnmet(f):[];
      if(un.length&&!confirm(`${f.name} needs ${un.join(" and ")}. Take it anyway?`))return;
    }
```

  `confirm()` can't label its buttons "Choose another" and "Take it anyway". The spec wants those labels, so
  use the app's own in-modal confirm if one exists (grep for a `confirmModal` or a two-button pattern). Otherwise
  keep `confirm()` with this text and note the deviation in the report. Test both answers with `state.confirm`.

  Settings (`88-settings.js`), in "Levels and companions":

```js
      setRowHTML("Feats allowed","Offer a feat instead of an Ability Score Improvement. Turning it off keeps the feats you have.",
        `<button type="button" class="switch ${character.featsAllowed!==false?"on":""}" id="swFeats" role="switch" aria-checked="${character.featsAllowed!==false?"true":"false"}" aria-label="Feats allowed"></button>`,true)+
```

  Wire it like `swFamiliars`: `character.featsAllowed=character.featsAllowed===false;b.classList.toggle("on",character.featsAllowed);scheduleSave();`.

  The CSS goes in `50-modal.css`. It must keep 44px rows and pills and fit 390px:

```css
/* #118 the ASI-or-feat step */
.ft-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 6px}
.ft-tools input{flex:1 1 160px;min-width:0;min-height:44px}
.ft-all{display:flex;gap:6px;align-items:center;font-size:13px}
.ft-list{max-height:260px;overflow-y:auto;border:1px solid var(--hair);border-radius:8px;background:var(--panel)}
.ft-row{display:flex;gap:8px;align-items:center;width:100%;min-height:44px;padding:6px 10px;border:0;border-top:1px dotted var(--hair);background:none;text-align:left;color:var(--ink);cursor:pointer}
.ft-row:first-child{border-top:0}
.ft-row[aria-pressed="true"]{outline:2px solid var(--accent);outline-offset:-2px;background:var(--paper-2)}
.ft-nm{flex:1;min-width:0}.ft-nm small{display:block;color:var(--ink-soft)}
.ft-tag{font-size:11px;border:1px solid var(--hair);border-radius:999px;padding:1px 8px;white-space:nowrap}
.ft-tag.warn{border-color:var(--warn);color:var(--warn)}
.ft-panel{margin-top:8px}
.ft-desc{max-height:180px;overflow-y:auto;border:1px solid var(--hair);border-radius:8px;padding:6px 10px;font-size:13px}
.ft-plus{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}
.ft-chip{min-height:44px;padding:4px 14px;border:1.3px solid var(--line);border-radius:999px;background:var(--panel);color:var(--ink)}
.ft-chip.on{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
```

- [ ] **Step 4: Run** `sheet.js` and the full suite. Expected: all pass.
- [ ] **Step 5: Screenshot.** Show the step for a level-8 Fighter at 1280 and 390, on the classic skin. Drive it:
  pick a feat, its +1, and Continue. Save `118-t3-step-1280.png` and `118-t3-step-390.png`.
- [ ] **Step 6: Commit.**

```bash
git add src/js/58-choices.js src/js/00-constants.js src/js/71-char-io.js src/js/88-settings.js src/css/50-modal.css src/tests/sheet.js
git commit -m "feat(#118): one list at an Ability Score Improvement — the ASI or a feat — and Feats allowed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Feat choices on species and backgrounds, and level 19

**Files:**
- Modify: `src/js/52-race.js` `applyRace()` (~:96–118).
- Modify: `src/js/54-background.js`, only where a background carries `choices` with a `feat` type. Today they
  carry a fixed `feat`, so mainly make sure the same pending path handles a background feat choice.
- Modify: `src/js/50-classrace.js` `runExtraChoices()` (~:150): handle `x.ch.type==="feat"` blocks.
- Modify: `src/js/56-class.js` `applyClassLevel()` (~:24): the Epic Boon rule.
- Modify: `src/js/57-levelup.js` `LU_CHOICE` (~:25).
- Test: `src/tests/sheet.js`.

**Interfaces:**
- Consumes: `asiFeatListHTML(ch, ci, opts)`, `asiPanelHTML`, `commitAsiPick(sel, origin, pending)`,
  `wireAsiFeats()`, and `sidToOrigin(sid)` (`58-choices.js:169`, which maps `race:Name` → `{kind:"race",name}`).
- Produces:
  - a species' `feat` granted with `{kind:"race", name}`;
  - a species `{type:"feat", category}` choice queued as `pending` and rendered in `runExtraChoices()` as a list
    without the ASI row;
  - level 19 with an "Epic Boon" trait and no `asi` choice gets `{type:"asi", boon:true, _level:19}`.

- [ ] **Step 1: Write the failing tests:**

```js
// ---------- #118 species feats and level 19
{
  const keep = {ch: X.character, rules: X.rules};
  X.character = X.blankChar();
  X.rules = Object.assign({}, X.rules, {
    feats: [{name: 'Alert', description: 'Origin feat\nx'}, {name: 'Tough', description: 'Origin feat\nx'}, {name: 'Athlete', description: 'General feat · Prerequisite: Level 4+\nx'}],
    races: [{name: 'Human', choices: [{type: 'feat', category: 'origin', label: 'An Origin feat of your choice'}], traits: [{name: 'Versatile', description: 'You gain an Origin feat of your choice.'}]},
            {name: 'Tester', feat: 'Tough'}]});
  X.reindexRules && X.reindexRules();
  let pend = null; const realRun = ctx.runExtraChoices; ctx.runExtraChoices = p => { pend = p; };
  X.applyRace('Human');
  ck('#118 a species feat choice is queued with the race sid', pend && pend.some(x => x.ch && x.ch.type === 'feat' && x.ch.category === 'origin' && x.sid === 'race:Human'), pend);
  ctx.runExtraChoices = realRun;
  const h = X.asiFeatListHTML({type: 'feat', category: 'origin'}, 0, {});
  ck('#118 the species list offers Origin feats only, with no ASI row', /data-ft-pick="Alert"/.test(h) && !/data-ft-pick="Athlete"/.test(h) && !/__asi__/.test(h));
  X.commitAsiPick({type: 'asi', pick: 'Alert', plus: []}, {kind: 'race', name: 'Human'}, []);
  ck('#118 the species feat is granted with the race origin', X.character.features.some(x => x.name === 'Feat: Alert' && x.origin.kind === 'race'));
  X.applyRace('Tester');
  ck('#118 species revert: changing species removes its feat', !X.character.features.some(x => x.name === 'Feat: Alert'));
  ck('#118 a fixed species feat is granted', X.character.features.some(x => x.name === 'Feat: Tough' && x.origin.kind === 'race'));
  // level 19
  const res = X.applyClassLevel({name: 'Wizard', level: 19}, {name: 'Wizard', levels: {'19': {traits: [{name: 'Epic Boon', description: 'You gain an Epic Boon feat…'}]}}}, 19);
  ck('#118 level 19 Epic Boon becomes an asi choice with boon', res.choices.some(c => c.type === 'asi' && c.boon === true && c._level === 19), res.choices);
  const res4 = X.applyClassLevel({name: 'Wizard', level: 4}, {name: 'Wizard', levels: {'4': {choices: [{type: 'asi'}]}}}, 4);
  ck('#118 an existing asi level is unchanged', res4.choices.filter(c => c.type === 'asi').length === 1 && !res4.choices[0].boon);
  X.character = keep.ch; X.rules = keep.rules;
}
```

  Add `'applyRace','applyClassLevel','reindexRules','sidToOrigin'` to `loadApp` if they're missing. If
  `applyRace` needs a different argument, or `reindexRules` is named differently, adapt it and say so.

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Implement.**
  - `applyRace()` `grantFrom`: after the skill handling, add:

```js
    if(obj.feat)grantFeatDef(obj.feat,{kind:"race",name},pending);
    (obj.choices||[]).forEach(ch=>{if(ch&&ch.type==="feat")pending.push({ch:Object.assign({},ch,{_sid:"race:"+name}),sid:"race:"+name,label:ch.label||label});});
```

    Feats granted through `grantFeatDef` with `origin.kind==="race"` are already removed by `removeRace()` (see
    `52-race.js:130`). Confirm that it removes features by origin; the species-revert test proves it.

  - `runExtraChoices()` (`50-classrace.js:150`): include feat blocks.

```js
  const feats=(pending||[]).filter(x=>x&&x.ch&&x.ch.type==="feat");
  if(!skills.length&&!equips.length&&!feats.length)return;
  …
  feats.forEach(x=>{body+=`<div class="choice" data-ctype="asi" data-sid="${esc(x.sid)}" style="border-top:1px dotted var(--hair);padding-top:10px;margin-top:10px">`+
    asiFeatListHTML(x.ch,ci,{})+`<div class="ft-panel" data-ft-panel="${esc(ci)}"></div></div>`;ci++;});
```

    The list for a category choice has no ASI row (Task 3 omits it when `ch.category` is set). Leave no row
    pressed, and make Done require a pick. `choiceShortfall()` reads `data-choose`, so add `data-choose="1"` on
    that wrapper, or check for an empty pick before committing.

    After `openModal`, call `wireAsiFeats()`. In the Done handler, for each `asi` selection from
    `gatherChoices()` with a `sid`, call `commitAsiPick(s, sidToOrigin(s.sid), [])`. Run the same
    unmet-prerequisite confirm as Task 3.

    `choiceFieldHTML` must also handle `t==="feat"` with a `category`, by delegating to the list:

```js
  }else if(t==="feat"&&ch.category){
    inner=asiFeatListHTML(ch,ci,{})+`<div class="ft-panel" data-ft-panel="${esc(ci)}"></div>`;
```

    Leave the existing `feat` branch, `ch.from` or the full select, for packs that use it.

  - `applyClassLevel()`: after reading `lv.choices`:

```js
    /* #118: level 19's Epic Boon is an Ability Score Improvement level too —
       "an Epic Boon feat or another feat" — when the data has no asi choice there. */
    if(L===19&&!(lv.choices||[]).some(c=>c&&c.type==="asi")&&(lv.traits||[]).some(t=>/^Epic Boon$/i.test(String(t.name||""))))
      choices.push({type:"asi",boon:true,_level:L,_sid:"class:"+entry.name});
```

  - `57-levelup.js` `LU_CHOICE`: the choice row for `asi` with `boon` reads "Epic Boon — a feat, or an Ability
    Score Improvement". Wherever `levelGains()` labels choices, use `ch.boon?["Epic Boon","a feat, or an Ability Score Improvement"]:LU_CHOICE.asi`.

- [ ] **Step 4: Run** `sheet.js` and the full suite.
- [ ] **Step 5: Screenshot** the Human species picker's Origin-feat list and a level-19 step. Save
  `118-t4-human-1280.png` and `118-t4-boon-390.png`.
- [ ] **Step 6: Commit** `feat(#118): species feats, background feat choices, and level 19's Epic Boon`.

---

### Task 5: Undo level-up, and level down with a record

**Files:**
- Modify: `src/js/56-class.js`:
  - `doLevelUp()` (~:264): the copy is taken before `entry.level=newL`;
  - `doLevelDown()` (~:296): the dialog.
- Modify: `src/js/57-levelup.js`: the card's Undo button, the settle step, and the toast.
- Modify: `src/js/70-persistence.js` `scheduleSave()` (~:68) and `src/js/80-modal-forms.js` `closeModal()`
  (~:34): each calls `luMaybeSettle()` when a level-up is in progress.
- Modify: `src/js/00-constants.js` `blankChar()` (`levelLog:[]`) and `71-char-io.js` `migrate()`.
- Test: `src/tests/sheet.js`.

**Interfaces:**
- Produces:
  - `_undo = {copy:<JSON string>, at, sig:<JSON string>|null, cls, level}`, never saved;
  - `undoLevelUpAvailable() -> boolean`, `undoLevelUp()`;
  - `levelLogRecord(beforeChar, afterChar, cls, level) -> record`;
  - `luMaybeSettle()`;
  - `levelDownHTML(rec, entry)`.

- [ ] **Step 1: Write the failing tests:**

```js
// ---------- #118 undo level-up and the level log
{
  const keep = X.character;
  X.character = X.blankChar(); X.character.classes = [{name: 'Fighter', level: 7}]; X.character.level = 7;
  X.character.hp.max = 61; X.character.hp.cur = 61;
  const before = JSON.parse(JSON.stringify(X.character));
  // simulate a level-up's effect on the character, as doLevelUp + the HP step + a feat pick do
  X.character.classes[0].level = 8; X.character.level = 8; X.character.hp.max = 68;
  X.character.features.push({id: 'f1', name: 'Feat: Athlete', enabled: true, origin: {kind: 'class', class: 'Fighter', level: 8}, effects: [{target: 'ability.str', value: 1}]});
  const rec = X.levelLogRecord(before, X.character, 'Fighter', 8);
  ck('#118 the record holds HP, features and ability changes', rec.hp === 7 && rec.features.length === 1 && rec.features[0].name === 'Feat: Athlete' && rec.abilities.str === 1 && rec.class === 'Fighter' && rec.level === 8, rec);
  // undo signature: available only while the sheet is unchanged
  ctx._undo = {copy: JSON.stringify(before), at: 1, sig: JSON.stringify(X.character), cls: 'Fighter', level: 8};
  ck('#118 undo is available right after', X.undoLevelUpAvailable() === true);
  X.character.name = 'Renamed';
  ck('#118 undo is gone after another change', X.undoLevelUpAvailable() === false);
  X.character.name = before.name;
  X.undoLevelUp();
  ck('#118 undo restores the exact character', JSON.stringify(X.character) === JSON.stringify(before), X.character.classes);
  // level down with a record
  X.character = JSON.parse(JSON.stringify(before)); X.character.classes[0].level = 8; X.character.level = 8; X.character.hp.max = 68; X.character.hp.cur = 68;
  X.character.features.push({id: 'f1', name: 'Feat: Athlete', enabled: true, origin: {kind: 'class', class: 'Fighter', level: 8}});
  X.character.levelLog = [Object.assign({at: 2}, rec)];
  const html = X.levelDownHTML(X.character.levelLog[0], X.character.classes[0]);
  ck('#118 the dialog lists HP and features, ticked', /\+7 hit points/.test(html) && /Feat: Athlete/.test(html) && (html.match(/checked/g) || []).length >= 2);
  X.applyLevelDown(0, {hp: true, features: ['f1']});
  ck('#118 level down removes ticked HP and features and deletes the record', X.character.classes[0].level === 7 && X.character.hp.max === 61 && !X.character.features.some(x => x.id === 'f1') && X.character.levelLog.length === 0);
  X.character.classes[0].level = 7;
  X.applyLevelDown(0, null);
  ck('#118 a level without a record only lowers the number', X.character.classes[0].level === 6 && X.character.hp.max === 61);
  const m = X.migrate(Object.assign(X.blankChar(), {levelLog: [{bad: 1}, {class: 'Fighter', level: 3, hp: 5, features: [], abilities: {}}]}));
  ck('#118 migrate keeps well-formed records only', Array.isArray(m.levelLog) && m.levelLog.length === 1);
  X.character = keep;
}
```

  Add `'levelLogRecord','undoLevelUpAvailable','undoLevelUp','levelDownHTML','applyLevelDown','migrate'` and
  `_undo` to `loadApp`. If `_undo` is a `let`, add it to the harness's `MUTABLE` list, or expose a setter
  `setUndoForTest`. Prefer adding it to `MUTABLE` in `harness.js`, as `dataUpdate` is.

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Implement.**

```js
/* ---- #118 undo level-up, and the level log ----
   The copy is the character just before doLevelUp touched it. Undo is offered
   only while the sheet is exactly as the level-up left it (sig), so it can
   never throw away a later edit. Never saved: a reload ends it. */
let _undo=null,_luActive=false;
function undoLevelUpAvailable(){return !!_undo&&_undo.sig!==null&&JSON.stringify(character)===_undo.sig;}
function undoLevelUp(){
  if(!undoLevelUpAvailable())return false;
  character=migrate(JSON.parse(_undo.copy));_undo=null;
  renderAll();recompute();scheduleSave();toast("Level-up undone");return true;
}
function levelLogRecord(b,a,cls,L){
  const ids=new Set((b.features||[]).map(f=>f.id));
  const feats=(a.features||[]).filter(f=>!ids.has(f.id)&&f.origin&&f.origin.kind==="class"&&f.origin.class===cls&&num(f.origin.level)===L);
  const abilities={};feats.forEach(f=>(f.effects||[]).forEach(e=>{const m=/^ability\.(\w+)$/.exec(String(e.target||""));if(m)abilities[m[1]]=(abilities[m[1]]||0)+num(e.value);}));
  const gk=g=>g.sid+"|"+g.type+"|"+g.key,bg=new Set((b.grants||[]).map(gk));
  const ac=(a.classes||[]).find(c=>c.name===cls)||{},bc=(b.classes||[]).find(c=>c.name===cls)||{};
  return {at:Date.now(),class:cls,level:L,hp:Math.max(0,num(a.hp&&a.hp.max)-num(b.hp&&b.hp.max)),
    features:feats.map(f=>({id:f.id,name:String(f.name||"")})),abilities,
    subclass:(ac.subclass&&ac.subclass!==bc.subclass)?ac.subclass:"",
    grants:(a.grants||[]).filter(g=>!bg.has(gk(g))).map(g=>({type:g.type,key:g.key})),
    slots:{before:Object.fromEntries(Object.entries(b.slots||{}).map(([k,v])=>[k,num(v&&v.total)])),after:Object.fromEntries(Object.entries(a.slots||{}).map(([k,v])=>[k,num(v&&v.total)]))}};
}
/* A level-up spans the card and its choice windows. When the last of them has
   closed and saved, write the record, take the signature, and offer Undo. */
function luMaybeSettle(){
  if(!_luActive||!_undo)return;
  setTimeout(()=>{
    if(!_luActive||!_undo||document.getElementById("modal").classList.contains("open")||luBusy()||_lu)return;
    _luActive=false;
    const before=JSON.parse(_undo.copy);
    if(!Array.isArray(character.levelLog))character.levelLog=[];
    character.levelLog.push(levelLogRecord(before,character,_undo.cls,_undo.level));
    if(character.levelLog.length>200)character.levelLog=character.levelLog.slice(-200);
    _undo.sig=JSON.stringify(character);
    scheduleSave();   /* persists only; it does not change `character`, so the signature taken above still holds */
    toast(`${_undo.cls} is now level ${_undo.level}`,{label:"Undo",run:()=>undoLevelUp()});
  },0);
}
```

  The signature has to survive the save that writes the record. `scheduleSave()` only persists and doesn't change
  `character`, so it's enough to take `sig` after pushing the record and before any later edit. If
  `scheduleSave` triggers `luMaybeSettle` again, `_luActive` is already false, so nothing loops. Use whichever
  immediate-save function exists (grep `70-persistence.js`), or, as shown, call `scheduleSave()` after setting `sig`.

  - `doLevelUp()`: before `entry.level=newL`, add
    `_undo={copy:JSON.stringify(character),at:Date.now(),sig:null,cls:entry.name,level:newL};_luActive=true;`.
  - `scheduleSave()` and `closeModal()` each end with `if(typeof luMaybeSettle==="function")luMaybeSettle();`.
    It is a no-op unless `_luActive`.
  - Switching character (`activeId` changes, wherever the app loads another character) clears `_undo`. Grep for
    the load function, and add `_undo=null;_luActive=false;`.
  - The level-up card (`levelUpCardHTML`) gets an `Undo level-up` button next to Done, which calls
    `closeModal(); undoLevelUp-on-card`. On the card, the level-up hasn't settled yet, so Undo there restores
    `_undo.copy` directly, regardless of the signature. Give it an explicit
    `undoLevelUp({force:true})`, where `force` skips the signature check but still requires `_undo`.
  - `blankChar()`: `levelLog:[],`. `migrate()`:
    `c.levelLog=(Array.isArray(c.levelLog)?c.levelLog:[]).filter(r=>r&&typeof r==="object"&&typeof r.class==="string"&&num(r.level)>0&&Array.isArray(r.features));`.

  Level down:

```js
function levelDownHTML(rec,entry){
  const L=num(entry.level);
  const feats=(rec.features||[]).filter(f=>(character.features||[]).some(x=>x.id===f.id));
  const gone=(rec.features||[]).length-feats.length;
  const ab=Object.entries(rec.abilities||{}).map(([k,v])=>(v>0?"+":"")+v+" "+((ABIL.find(a=>a[0]===k)||[k,k])[1])).join(", ");
  return `<p><b>${esc(entry.name)} ${esc(String(L))} → ${esc(String(L-1))}.</b> Level ${esc(String(L))} gave you:</p>`+
    `<p class="hint">Fieldbook can remove these for you:</p>`+
    (rec.hp?`<label class="opt"><input type="checkbox" data-ld-hp checked> +${esc(String(rec.hp))} hit points (max HP ${esc(String(character.hp.max))} → ${esc(String(num(character.hp.max)-num(rec.hp)))})</label>`:"")+
    feats.map(f=>`<label class="opt"><input type="checkbox" data-ld-ft="${esc(f.id)}" checked> ${esc(f.name)}${ab&&/^Feat:|Ability Score Improvement/.test(f.name)?" ("+esc(ab)+")":""}</label>`).join("")+
    (gone?`<p class="hint">${esc(String(gone))} feature${gone===1?" was":"s were"} already removed by hand.</p>`:"")+
    `<p class="hint">These change by themselves: proficiency bonus, spell slots and class resources.</p>`+
    ((rec.grants||[]).length||rec.subclass?`<p class="hint">Adjust these by hand if you need to: ${esc([rec.subclass?"subclass "+rec.subclass:"",...(rec.grants||[]).map(g=>g.type+" "+g.key)].filter(Boolean).join(", "))}, and any spells you learned.</p>`:`<p class="hint">Adjust by hand any spells you learned.</p>`)+
    `<div class="m-actions"><button type="button" class="tbtn" id="ldCancel">Cancel</button><button type="button" class="tbtn primary" id="ldGo">Level down</button></div>`;
}
function applyLevelDown(idx,remove){
  const entry=character.classes[idx];if(!entry)return;
  const L=num(entry.level);if(L<=1)return;
  const ri=(character.levelLog||[]).map((r,i)=>({r,i})).reverse().find(x=>x.r.class===entry.name&&num(x.r.level)===L);
  if(ri&&remove){
    if(remove.hp&&ri.r.hp){character.hp.max=Math.max(1,num(character.hp.max)-num(ri.r.hp));character.hp.cur=Math.min(num(character.hp.cur),character.hp.max);}
    const ids=new Set(remove.features||[]);
    if(ids.size)character.features=(character.features||[]).filter(f=>!ids.has(f.id));
    character.levelLog.splice(ri.i,1);
  }
  entry.level=L-1;character.level=totalLevel();
  renderClassRace();renderFeatures();renderAllRT();recompute();renderHP();scheduleSave();
}
```

  `doLevelDown()`'s `proceed(idx)`:
  - if a record exists for that class and level, open `levelDownHTML` in a modal;
  - on `#ldGo`, read the ticked boxes and call `applyLevelDown(idx,{hp:!!hpBox&&hpBox.checked,features:[...ticked ids]})`;
  - `#ldCancel` closes the modal;
  - without a record, keep today's behaviour by calling `applyLevelDown(idx,null)`.

  Keep today's notice about traits being kept for the no-record case. Removing a feature also has to remove its
  grants: `grantFeatDef` grants skills with `sid`. Grep how `removeFeaturesWhere` and `removeGrants` pair in
  `removeClass()`, and reuse that path for each removed feature if it exists. Otherwise list the feature's grants
  in "adjust by hand".

- [ ] **Step 4: Run** `sheet.js` and the full suite.
- [ ] **Step 5: Drive and screenshot.** Do these in the browser:
  1. Level a Fighter from 7 to 8, take a feat, and see the "Fighter is now level 8 · Undo" toast. Press Undo; the
     sheet is back at 7.
  2. Level up again and rename the character; Undo is gone.
  3. Level down from 8: the dialog appears with its boxes. Press Level down; HP and the feat are gone.

  Save `118-t5-undo-1280.png`, `118-t5-leveldown-1280.png` and `118-t5-leveldown-390.png`.
- [ ] **Step 6: Commit** `feat(#118): undo a level-up, and level down shows what the level gave`.

---

### Task 6: Browser QA, docs, release notes

**Files:**
- **Wiki pages** (spec §11):
  - `wiki/features/character-building.md`: close the Open line about `asi` offering only +2 / +1+1;
  - `wiki/features/abilities-and-skills.md`;
  - `wiki/data/converter.md`;
  - `wiki/features/settings-and-updates.md`;
  - `wiki/roadmap/known-issues.md`: narrow "Level-down only lowers the number" to levels with no record;
  - `wiki/decisions.md`: rows for decisions 1–9;
  - `wiki/roadmap/1.9.0.md`: #118 built.
- **Ledger:** `src/docs/_claude/WIRING-LEDGER.md`.
- **Release notes:** `src/docs/UNRELEASED.md`, the four bullets in spec §11.
- **The spec's As built.**

CSS changes are tuning only. A JS bug found here goes to the controller as a finding.

- [ ] **Step 1: Before shots** from main's build
  (`file:///Users/mwardman/Documents/Repos/RPGFieldbook/dist/fieldbook.html`): the level-8 ASI step and Settings
  → Sheet display, at 1280. Save them as `118-before-*.png`.
- [ ] **Step 2: After shots and driven checks**, saved as `118-after-*.png`:
  - the level-8 step, with and without Show all;
  - an amber prerequisite, and the warning answered both ways;
  - a feat's +1;
  - Feats allowed off;
  - level 19;
  - the Human Origin feat;
  - Undo level-up, offered and then gone;
  - level down with a record, and without one;
  - both skins, at 1280 and 390;
  - a clean console.

  Report what you drove and what you didn't.
- [ ] **Step 3: Docs.**
  - Append `## Feat support (#118, <today>)` to the ledger. It is append-only.
  - Update the wiki pages, each with a History line citing that entry.
  - Write the spec's As built from the controller's `progress.md`, covering its Rulings and deferred Minors.
  - Add the UNRELEASED bullets.
- [ ] **Step 4: Run the full suite**, then restore the build files.
- [ ] **Step 5: Commit** as `docs(#118): …`. Commit any CSS tuning separately as `style(#118): …`.
