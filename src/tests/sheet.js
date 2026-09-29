/* Sheet mechanics: the small pure functions the character sheet leans on.
   The coin-box entry parser, which is the whole of the add/subtract currency
   feature, and the carried-weight/encumbrance maths — everything else about
   both is DOM wiring. */
const {loadApp, makeCheck} = require('./harness');

const ck = makeCheck();
const {X, ctx, state, bootError, fragments} = loadApp([
  'signedEntry', 'signedDelta', 'num', 'fnum', 'fmtWt', 'fmtGp', 'blankChar', 'migrate',
  'clampHP', 'effMaxHP', 'adjustHP', 'applyHPInput', 'renderHP', 'hpBand', 'hdStyle',
  'itemWeight', 'itemWeightTotal', 'coinsWeight', 'carriedWeight',
  'sizeName', 'sizeLabel', 'charSize', 'carryCapacity', 'encMode', 'encState',
  'encSpeed', 'encTierNote', 'contributions', 'inventoryTotal', 'SIZES', 'SIZE_CARRY',
  'capacityFor', 'sizeOptionsHTML', 'invSection',
  'ORIGIN_KINDS', 'originDef', 'originLabel', 'originLetter', 'originFromSid',
  'itemOrigin', 'originOptionsHTML', 'grantedFromOrigin', 'originFromGranted',
  'effectiveChoose', 'choiceShortfall', 'choiceFieldHTML', 'grantProf', 'effSkill', 'SKILLS',
  'statStyle', 'statGroupHTML', 'statGroupsHTML', 'ABIL',
  'featGroups', 'featItemHTML', 'featGroupLabel', 'FEAT_FAV',
  'FEAT_KINDS', 'featKindDef', 'featPickList', 'featPickKind', 'featPickPrereq',
  'featPickName', 'featPickStoredName', 'featPickGroup', 'addPickedFeature', 'updResolve',
  'parseDiceExpr', 'rollDiceExpr', 'diceExprText', 'diceExprDice',
  'detectItemUse', 'itemUse', 'itemUsable', 'itemUsesMax', 'itemQty',
  'addStatusByName', 'applyItemUse', 'useItem', 'resetItemUses', 'longRest',
  'invItemHTML', 'itemUseLine', 'itemUsesRowHTML', 'uid',
  'spellLevelTally', 'spellAllotment', 'cantripsKnown',
  'descHTML', 'highlight', 'mergeRules', 'resetRules',
  'iconSVG', 'iconSlug', 'GAME_ICONS', 'ICON_MAP',
  'attackDamageStr', 'extraDamageList', 'damagePartStr', 'carryAttackLinks',
  'spellHasDamage', 'spellDamageFromText', 'spellDamageBackfill', 'dropDamagelessSpellRows',
  'richHTML', 'richInline', 'noteHTML',
  'itemArmor', 'armorAC', 'armorKindOf', 'ARMOR_DEXCAP', 'isEquippable', 'contributions',
  'featGroups', 'FEAT_FAV', 'ATK_FAV', 'atkCol', 'featCol', 'statusRowHTML', 'concStatusRow',
  'attackVisible', 'migrateWeaponEquip',
  'syncSpellAttack', 'detectSpellAttack',
  'castSpell', 'endActiveSpell', 'bumpActive', 'spellIsConc',
  'syncConcStatus', 'endConcentration', 'endConcFromStatus', 'concActiveSpell', 'concStatusRow',
  'COMBAT_DEFAULTS', 'inCombat', 'combatSectionsOf', 'withCombatSection', 'moveCombatSection',
  'combatStart', 'combatEnd', 'combatElapsedSec', 'fmtCombatTime', 'advanceRound', 'combatButtonHTML',
  'combatToggleHTML', 'combatToggleText', 'combatHeaderHTML', 'startCombatNow', 'endCombatAsk',
  'combatGripHTML', 'moveCombatCard',
  'insertCombatSection', 'toggleCombatSection', 'undoCombatRemove', 'stepCombatSection',
  'MODAL_FOCUS_FIELDS', 'openerSelector', 'cvNeighbours',
  'finderQty', 'addLibraryItems', 'attackNumbers', 'recompute',
  'spellDC', 'spellAtkBonus', 'fxTargets', 'FX_LABEL', 'promptSpellAttack', 'openStatBreakdown', 'openAttackBreakdown',
  'renderAttacks',
  'coinKeys',
  'RULE_CATS', 'reindexRules', 'recomputeDups', 'repairIds',
]);
if (bootError) { console.log('LOAD FAIL: ' + bootError.message); process.exit(1); }
console.log('loaded ' + fragments.length + ' fragments\n');

// Was `coinEntry` until the HP boxes wanted the same behaviour; the parser was
// never coin-specific, so it got a name that says what it does. Every assertion
// below is unchanged — that is the point of asserting through `e`.
const e = X.signedEntry;

// ---------- absolute entry still works
ck('a plain number sets the value', e(7, '12') === 12);
ck('zero is a real value, not empty', e(7, '0') === 0);
ck('leading zeros are fine', e(0, '007') === 7);
ck('empty clears the box', e(9, '') === '');
ck('whitespace-only clears too', e(9, '   ') === '');
ck('thousands separators are tolerated', e(0, '1,250') === 1250);

// ---------- the point of the feature: signed deltas
ck('+10 adds to what is there', e(5, '+10') === 15);
ck('-5 spends', e(20, '-5') === 15);
ck('adding to an empty box starts from zero', e('', '+10') === 10);
ck('adding to a null box starts from zero', e(null, '+3') === 3);
ck('spaces around the sign are ignored', e(5, ' + 10 ') === 15);
ck('unicode minus works (the on-screen hint shows one)', e(20, '−5') === 15);
ck('en dash works too', e(20, '–5') === 15);

// ---------- you cannot owe copper
ck('spending more than you hold floors at zero', e(3, '-10') === 0);
ck('spending exactly what you hold leaves zero', e(10, '-10') === 0);
ck('+0 is a no-op, not a clear', e(4, '+0') === 4);

// ---------- rubbish is rejected, NOT silently coerced
// The caller puts the old value back on null. Coercing "abc" to 0 would wipe
// someone's gold on a typo, which is the one outcome that must not happen.
['abc', '+', '-', '1+2', '5g', '--5', '+-2', '1.5', '-2.5', '1 2'].forEach(bad => {
  ck('rejects ' + JSON.stringify(bad), e(42, bad) === null);
});
ck('rejection does not mutate anything', X.num(42) === 42);

// ---------- a rejected entry must be distinguishable from a cleared one
ck('null (invalid) and "" (cleared) are different results',
   e(5, 'abc') === null && e(5, '') === '');

/* ================= hit points ================= */

// The HP boxes take the same signed entries as the coin boxes, but unlike coins
// they have a CEILING. That bound lives in clampHP(), not in the parser: it also
// has to hold when you spend a hit die, take a long rest, or drop Max below
// Current, and one rule enforced in four places is a rule enforced in three.
function hpOf(o) {
  const c = X.blankChar();
  Object.assign(c.hp, o);
  X.character = c;
  return c;
}
hpOf({cur: 9, max: 12, temp: ''});   X.clampHP();
ck('under max is left alone', X.character.hp.cur === 9);
hpOf({cur: 20, max: 12, temp: ''});  X.clampHP();
ck('current is capped at max', X.character.hp.cur === 12);
hpOf({cur: 20, max: '', temp: ''});  X.clampHP();
ck('no max set means no cap yet', X.character.hp.cur === 20);
hpOf({cur: -3, max: 12, temp: ''});  X.clampHP();
ck('current floors at zero', X.character.hp.cur === 0);
hpOf({cur: 1, max: -5, temp: -2});   X.clampHP();
ck('max and temp floor at zero too', X.character.hp.max === 0 && X.character.hp.temp === 0);
// "" means "not set yet", which is not zero — removeClass() tells them apart
// when it takes back a level-1 seeded HP, so clamping must not coerce.
hpOf({cur: '', max: '', temp: ''});  X.clampHP();
ck('empty stays empty, not zero', X.character.hp.cur === '' && X.character.hp.max === '');

// ---------- the ceiling is the EFFECTIVE max, not the number in the box
hpOf({cur: 16, max: 10, temp: ''});
X.character.features = [{name: 'Tough', effects: [{target: 'hp.max', value: 5}]}];
ck('effMaxHP counts hp.max effects', X.effMaxHP() === 15);
ck('effMaxHP(c) agrees with effMaxHP()', X.effMaxHP(X.contributions()) === X.effMaxHP());
X.clampHP();
ck('a +5 max HP item lets you keep 15, not 10', X.character.hp.cur === 15);

// ---------- damage spends temporary HP first
// Temp was stored, displayed and cleared on a long rest, but nothing ever spent
// it — the player did the subtraction by hand. adjustHP is the one delta path:
// the − button, a typed negative, and a spent hit die all come through here.
hpOf({cur: 9, max: 12, temp: ''});  X.adjustHP(-1);
ck('with no temp, damage comes straight off current', X.character.hp.cur === 8);
ck('...and an unset temp is not coerced to zero', X.character.hp.temp === '');

hpOf({cur: 10, max: 10, temp: 5});  X.adjustHP(-3);
ck('temp HP soaks the hit first', X.character.hp.temp === 2);
ck('...leaving current untouched', X.character.hp.cur === 10);

hpOf({cur: 10, max: 10, temp: 3});  X.adjustHP(-3);
ck('temp spent exactly to nothing reads back blank, as a long rest leaves it',
   X.character.hp.temp === '' && X.character.hp.cur === 10);

hpOf({cur: 10, max: 10, temp: 2});  X.adjustHP(-5);
ck('damage past your temp spills into current', X.character.hp.cur === 7);
ck('...and the temp box empties', X.character.hp.temp === '');

hpOf({cur: 5, max: 12, temp: 5});   X.adjustHP(3);
ck('healing never touches temp — it is granted, not restored',
   X.character.hp.cur === 8 && X.character.hp.temp === 5);
hpOf({cur: 12, max: 12, temp: 5});  X.adjustHP(1);
ck('healing overflow does not become temp',
   X.character.hp.cur === 12 && X.character.hp.temp === 5);

hpOf({cur: 1, max: 12, temp: 0});   X.adjustHP(-50);
ck('overkill still floors at zero', X.character.hp.cur === 0);
// clampHP floors temp but never caps it: a big ward legitimately exceeds max.
hpOf({cur: 5, max: 10, temp: 20});  X.adjustHP(-1);
ck('temp above your maximum stays legal', X.character.hp.temp === 19 && X.character.hp.cur === 5);

hpOf({cur: 15, max: 10, temp: 4});
X.character.features = [{name: 'Tough', effects: [{target: 'hp.max', value: 5}]}];
X.adjustHP(-6);
ck('adjustHP clamps against the EFFECTIVE max',
   X.character.hp.temp === '' && X.character.hp.cur === 13,
   X.character.hp.temp + '/' + X.character.hp.cur);
X.character.features = [];

hpOf({cur: 8, max: 12, temp: 3});   X.adjustHP(0);
ck('a zero delta moves nothing',
   X.character.hp.cur === 8 && X.character.hp.temp === 3 && X.character.hp.max === 12);

// ---------- signedDelta: the same grammar, read as a delta rather than a total
const d = X.signedDelta;
ck('signedDelta reads damage', d('-7') === -7);
ck('signedDelta reads healing, space after the sign and all', d('+ 4') === 4);
ck('signedDelta takes the unicode minus the hint shows', d('−7') === -7);
ck('signedDelta reads grouped digits', d('-1,200') === -1200);
ck('a bare total is not a delta', d('12') === null);
ck('junk is not a delta either', d('+ab') === null && d('') === null && d(null) === null);

// ---------- signed entry composed the way applyHPInput composes it
// NOTE: typeHP documents how signedDelta / signedEntry / clampHP COMPOSE. It is
// not applyHPInput and deliberately carries no Max-HP lock guard — the lock is
// asserted against the real function further down.
hpOf({cur: 8, max: 12, temp: ''});
const typeHP = (k, s) => {
  const dmg = (k === 'cur' || k === 'temp') ? X.signedDelta(s) : null;
  if (dmg !== null && dmg < 0) { X.adjustHP(dmg); return dmg; }
  const n = X.signedEntry(X.character.hp[k], s);
  if (n !== null) { X.character.hp[k] = n; X.clampHP(); } return n; };
typeHP('cur', '-3');
ck('typing -3 into Current takes 3 damage', X.character.hp.cur === 5);
typeHP('cur', '+50');
ck('healing past your maximum stops at your maximum', X.character.hp.cur === 12);
typeHP('cur', '-100');
ck('a big hit floors at zero, never negative', X.character.hp.cur === 0);
typeHP('temp', '+7');
ck('granting temp HP still just adds to the box', X.character.hp.temp === 7);
ck('junk in an HP box is rejected, not read as zero', typeHP('cur', '5 hp') === null);
ck('and the rejected box keeps its value', X.character.hp.cur === 0);
// lowering Max has to drag Current down with it. A negative in the MAX box is
// still a plain edit — only the Current box reads one as damage.
hpOf({cur: 30, max: 30, temp: 4});
typeHP('max', '-20');
ck('lowering Max pulls Current down to it', X.character.hp.cur === 10 && X.character.hp.max === 10);
ck('...without spending temp on the way', X.character.hp.temp === 4);
// and the Current box routes through adjustHP, so a typed hit spends temp too
hpOf({cur: 10, max: 10, temp: 5});
typeHP('cur', '-7');
ck('typing damage into Current spends temp first',
   X.character.hp.temp === '' && X.character.hp.cur === 8,
   X.character.hp.temp + '/' + X.character.hp.cur);
typeHP('cur', '+1');
ck('typing a heal leaves temp alone', X.character.hp.cur === 9 && X.character.hp.temp === '');
// A negative in the TEMP box is damage too, and means the same as the same
// entry in Current. signedEntry would have floored temp at 0 and thrown the
// overflow away, leaving you 2 hit points better off than you should be.
hpOf({cur: 10, max: 10, temp: 3});
typeHP('temp', '-5');
ck('damage typed into Temp rolls the overflow into current',
   X.character.hp.temp === '' && X.character.hp.cur === 8,
   X.character.hp.temp + '/' + X.character.hp.cur);
hpOf({cur: 10, max: 10, temp: 5});
typeHP('temp', '-3');
ck('...and stops at Temp when it covers the hit',
   X.character.hp.temp === 2 && X.character.hp.cur === 10);

/* ---- the Max HP lock ----
   Max is the one number that barely moves after character creation and is
   catastrophic to fat-finger: a stray digit drags Current down through clampHP()
   and there is no undo. Asserted against the REAL applyHPInput, not the
   composition helper above — the harness's DOM stub swallows renderHP's writes,
   returns null from querySelector and no-ops setTimeout, so it is safe to call. */
const box = (k, v) => X.applyHPInput({dataset: {hp: k}, value: v});

ck('a new character starts with Max HP locked', X.blankChar().hp.locked === true);

// temp deliberately empty here, so damage to Current is unambiguous — with temp
// set it would be soaked first, which the block above already covers
hpOf({cur: 8, max: 12, temp: ''});
ck('a locked Max box refuses a typed number', box('max', '40') === false);
ck('...and the model is untouched', X.character.hp.max === 12);
ck('a locked Max box refuses a typed delta too',
   box('max', '+5') === false && X.character.hp.max === 12);
ck('the lock is only on Max — Current still takes damage',
   box('cur', '-3') === true && X.character.hp.cur === 5);
ck('...and Temp still takes a grant', box('temp', '+4') === true && X.character.hp.temp === 4);

X.character.hp.locked = false;
ck('unlocked, Max takes the number', box('max', '40') === true && X.character.hp.max === 40);
ck('...and a negative in Max is still a plain edit, not damage',
   box('max', '-30') === true && X.character.hp.max === 10 && X.character.hp.temp === 4);
// Current was 5 and the new max is 10, so nothing to drag; push it over first
X.character.hp.cur = 30;
ck('...which still drags Current down with it',
   box('max', '-2') === true && X.character.hp.max === 8 && X.character.hp.cur === 8);

// A character object that never went through migrate() must read as LOCKED, not
// as unlocked-by-absence: `!==false`, not a truth test.
hpOf({cur: 8, max: 12, temp: ''});
delete X.character.hp.locked;
ck('a missing lock flag means locked', box('max', '99') === false && X.character.hp.max === 12);

// `locked` is a key on character.hp now, so the old `k in character.hp` guard
// would have let a data-hp="locked" hook write a boolean field.
hpOf({cur: 8, max: 12, temp: ''});
ck('no data-hp hook can reach the lock flag',
   box('locked', 'false') === true && X.character.hp.locked === true);

// The lock is a new sub-key of character.hp. migrate() normalizes hp onto
// blankChar()'s defaults, so this needs no new code — which is exactly why it
// needs a test, or the next person to tidy that Object.assign silently unlocks
// every sheet in the world.
const preLock = X.migrate({id: 'old', name: 'Before the lock', hp: {cur: 12, max: 24, temp: ''}});
ck('a sheet saved before the lock comes back locked', preLock.hp.locked === true);
ck('...with its HP numbers untouched', preLock.hp.max === 24 && preLock.hp.cur === 12);
const unlocked = X.migrate({id: 'u', hp: {cur: 30, max: 30, temp: '', locked: false}});
ck('a deliberately unlocked sheet survives a round-trip', unlocked.hp.locked === false);
ck('...and a second one', X.migrate(JSON.parse(JSON.stringify(unlocked))).hp.locked === false);
// migrate's Object.assign only runs when s.hp is a non-array object, so a sheet
// with no hp at all is a separate branch
ck('a sheet with no hp object at all still comes back locked',
   X.migrate({id: 'bare'}).hp.locked === true);

/* ---- current HP colours by how much of your maximum is left ----
   Measured against the EFFECTIVE max so an item that raises it moves the bands,
   and excluding temp, which sits above your maximum rather than inside it. */
X.character.features = [];
hpOf({cur: 20, max: 20, temp: ''});
ck('full HP is not coloured', X.hpBand() === '');
hpOf({cur: 11, max: 20, temp: ''});
ck('just over half is not coloured', X.hpBand() === '');
hpOf({cur: 10, max: 20, temp: ''});
ck('exactly half is amber', X.hpBand() === 'hp-warn');
hpOf({cur: 6, max: 20, temp: ''});
ck('above a quarter is still amber', X.hpBand() === 'hp-warn');
hpOf({cur: 5, max: 20, temp: ''});
ck('exactly a quarter is red', X.hpBand() === 'hp-danger');
hpOf({cur: 0, max: 20, temp: ''});
ck('nothing left is red', X.hpBand() === 'hp-danger');
// a blank new character must not open painted red
hpOf({cur: '', max: '', temp: ''});
ck('no maximum set means no band at all', X.hpBand() === '');
// temp is a buffer ABOVE the maximum — folding it in could read as healthy
// while the real pool is empty
hpOf({cur: 3, max: 20, temp: 30});
ck('temp HP does not lift you out of the red band', X.hpBand() === 'hp-danger');
// the bands follow the effective max, not the number in the box
hpOf({cur: 11, max: 20, temp: ''});
X.character.features = [{name: 'Tough', effects: [{target: 'hp.max', value: 20}]}];
ck('an item that raises your maximum moves the thresholds', X.hpBand() === 'hp-warn');
X.character.features = [];
hpOf({cur: 3, max: 20, temp: ''});
X.character.hpColor = false;
ck('the per-character switch turns the colouring off', X.hpBand() === '');
X.character.hpColor = true;
ck('...and back on', X.hpBand() === 'hp-danger');
ck('colouring is on by default for a new character', X.blankChar().hpColor === true);
ck('...and for a sheet saved before the setting existed',
   X.migrate({id: 'old2'}).hpColor === true);

/* ---- the hit-dice display style ----
   Three looks, chosen per character. hdStyle() resolves anything it does not
   recognise to full — the same value blankChar defaults to, so an older sheet
   with no field at all lands on the same look a new character gets, and the
   setting needs no migration of its own. */
ck('a new character defaults to full', X.blankChar().hdStyle === 'full');
X.character.hdStyle = 'full';      ck('full is honoured', X.hdStyle() === 'full');
X.character.hdStyle = 'dice';      ck('dice is honoured', X.hdStyle() === 'dice');
X.character.hdStyle = 'condensed'; ck('condensed is honoured', X.hdStyle() === 'condensed');
X.character.hdStyle = 'nonsense';  ck('an unknown style falls back', X.hdStyle() === 'full');
delete X.character.hdStyle;        ck('a missing style falls back too', X.hdStyle() === 'full');
ck('a sheet saved before the styles existed reads as full',
   X.migrate({id: 'old3'}).hdStyle === 'full');
// the fallback and the blankChar default must not drift apart, or an old sheet
// and a new character show different things
ck('the fallback agrees with the default', (() => {
  delete X.character.hdStyle; return X.hdStyle() === X.blankChar().hdStyle;
})());
ck('a chosen style survives a round-trip',
   X.migrate(JSON.parse(JSON.stringify(X.migrate({id: 'k', hdStyle: 'dice'})))).hdStyle === 'dice');

/* ---- the ability/skill layout ----
   Two looks over ONE set of ids, chosen per character. statStyle() resolves
   anything it does not recognise to classic — the same value blankChar defaults
   to — so an older sheet needs no migration and does not move under the player. */
ck('a new character defaults to classic', X.blankChar().statStyle === 'classic');
X.character.statStyle = 'grouped';  ck('grouped is honoured', X.statStyle() === 'grouped');
X.character.statStyle = 'classic';  ck('classic is honoured', X.statStyle() === 'classic');
X.character.statStyle = 'nonsense'; ck('an unknown layout falls back', X.statStyle() === 'classic');
delete X.character.statStyle;       ck('a missing layout falls back too', X.statStyle() === 'classic');
ck('a sheet saved before the layouts existed reads as classic',
   X.migrate({id: 'old4'}).statStyle === 'classic');
ck('the fallback agrees with the default', (() => {
  delete X.character.statStyle; return X.statStyle() === X.blankChar().statStyle;
})());
ck('a chosen layout survives a round-trip',
   X.migrate(JSON.parse(JSON.stringify(X.migrate({id: 'k', statStyle: 'grouped'})))).statStyle === 'grouped');

/* The grouped markup must emit every hook recompute() finds by id or attribute.
   Get one wrong and that number just stops updating — nothing throws, and the
   harness has no DOM, so these string assertions are the only guard there is. */
const gHTML = X.statGroupsHTML();
ck('every ability keeps its modifier id and its breakdown hook',
   X.ABIL.every(([k]) => gHTML.includes(`id="mod-${k}"`) && gHTML.includes(`data-stat="ability.${k}"`)));
ck('every score box keeps its data-path and its recompute trigger',
   X.ABIL.every(([k]) => gHTML.includes(`data-path="character.abilities.${k}"`)) &&
   (gHTML.match(/data-recompute/g) || []).length === 6);
ck('every save keeps its id, its dot and its breakdown hook',
   X.ABIL.every(([k]) => gHTML.includes(`id="save-${k}"`) && gHTML.includes(`data-save="${k}"`) &&
                         gHTML.includes(`data-stat="save.${k}"`)));
ck('every skill appears exactly once — a duplicate id updates one and strands the other',
   X.SKILLS.every(([k]) => (gHTML.match(new RegExp(`id="skill-${k}"`, 'g')) || []).length === 1));
ck('...under the ability that governs it',
   X.SKILLS.every(([k, , ab]) => X.statGroupHTML(ab, ab.toUpperCase()).includes(`id="skill-${k}"`)));
ck('Constitution gets a saving throw and no skills',
   X.statGroupHTML('con', 'CON').includes('id="save-con"') &&
   !/data-skill=/.test(X.statGroupHTML('con', 'CON')));
ck('the breakdown modal is reachable from all thirty numbers',
   (gHTML.match(/data-stat="/g) || []).length === X.ABIL.length * 2 + X.SKILLS.length);

/* ================= inventory filing =================
   invSection() reads category/type. Nothing used to copy those onto an item, so
   everything that wasn't a weapon or armour fell through to Loot — a class's
   Scholar's Pack and Spellbook included. There were no tests here at all, which
   is how that shipped. */
const sec = (o) => X.invSection(Object.assign({name: 'x'}, o));
ck('a weapon files under Weapons', sec({weapon: {dice: '1d6'}}) === 'Weapons');
ck('...and so does anything typed as one', sec({category: 'Weapon'}) === 'Weapons');
ck('armour files under Armor', sec({category: 'Armor'}) === 'Armor');
ck('a shield files under Armor', sec({type: 'Shield'}) === 'Armor');
ck('gear files under Gear', sec({category: 'Gear'}) === 'Gear');
ck('adventuring gear files under Gear', sec({type: 'Adventuring Gear'}) === 'Gear');
ck('tools file under Tools', sec({category: 'Tool'}) === 'Tools');
ck('an instrument files under Tools', sec({type: "Musical Instrument"}) === 'Tools');
ck('ammunition files under Consumables', sec({category: 'Ammunition'}) === 'Consumables');
ck('a potion files under Consumables', sec({category: 'Potion'}) === 'Consumables');
ck('a ring files under Magic Items', sec({category: 'Ring'}) === 'Magic Items');
ck('a wondrous item files under Magic Items', sec({category: 'Wondrous Item'}) === 'Magic Items');
// the fallback, and the bug: with no category at all everything looked like loot
ck('something uncategorised falls back to Loot', sec({}) === 'Loot');
ck('category wins over type', sec({category: 'Gear', type: 'Musical Instrument'}) === 'Gear');
// a shield is a shield whichever field says so — itemArmor() reads type directly
ck('a Gear-categorised shield still files as Armor',
   sec({category: 'Gear', type: 'Shield'}) === 'Armor');
// the substring traps: these all used to file as Magic Items
ck('"Adventuring Gear" is gear, not a ring', sec({type: 'Adventuring Gear'}) === 'Gear');
ck('a quarterstaff is not a magic staff',
   sec({category: 'Weapon', type: 'Quarterstaff'}) === 'Weapons');
ck('"Adventuring Gear" does not match on the ring in adventuring',
   sec({category: 'Adventuring Gear'}) === 'Gear');
// the player's own choice beats all of it
ck('an explicit section override wins', sec({category: 'Gear', sectionOverride: 'Tools'}) === 'Tools');
ck('a nonsense override is ignored', sec({category: 'Gear', sectionOverride: 'Nowhere'}) === 'Gear');

/* ================= item origin =================
   Where a thing came from: {kind, detail, at}, kind drawn from a fixed
   vocabulary. None of this had unit coverage, which is how a dead parameter and
   a silently-dropped detail both survived in it. */
ck('every origin kind has a letter and a label',
   X.ORIGIN_KINDS.every(o => o.k && o.ltr && o.label));
ck('origin kinds are unique', new Set(X.ORIGIN_KINDS.map(o => o.k)).size === X.ORIGIN_KINDS.length);
ck('the label is just the kind when there is no detail',
   X.originLabel({kind: 'purchased'}) === 'Purchased');
ck('...and gains the detail when there is one',
   X.originLabel({kind: 'purchased', detail: 'Waterdeep'}) === 'Purchased — Waterdeep');
// grants tag their items from the provenance sid, which is why the item form
// must offer Class: a class-granted item's own origin is kind:"class"
ck('a class grant becomes a class origin',
   X.originFromSid('class:Fighter').kind === 'class' &&
   X.originFromSid('class:Fighter').detail === 'Fighter');
ck('a background grant becomes a background origin',
   X.originFromSid('bg:Soldier').kind === 'background');
ck('an ancestry grant becomes an ancestry origin',
   X.originFromSid('race:Elf').kind === 'race');
ck('a subclass sid has no origin of its own', X.originFromSid('subclass:Fighter:Champion') === null);
ck('no sid, no origin', X.originFromSid('') === null && X.originFromSid(undefined) === null);
// the Class option must be offered, or editing a class-granted item cannot show
// its own origin back to you
ck('the option list offers every kind, Class included',
   X.ORIGIN_KINDS.every(o => X.originOptionsHTML(null).includes(`value="${o.k}"`)));
ck('...and a none option, selected when there is no origin',
   /<option value=""\s+selected>/.test(X.originOptionsHTML(null)));
ck('the current kind comes back selected',
   X.originOptionsHTML({kind: 'gift'}).includes('value="gift" selected'));
// a legacy item has no origin object at all, only the grant field
ck('a legacy granted item still gets a badge',
   X.itemOrigin({grant: 'bg:Sage'}).kind === 'background');
ck('an explicit origin wins over the grant',
   X.itemOrigin({grant: 'bg:Sage', origin: {kind: 'found'}}).kind === 'found');
ck('an item from nowhere has no origin', !X.itemOrigin({name: 'Rock'}));
// origin is character-local: a rules update must never touch it
ck('origin survives a save and load round-trip', (() => {
  const c = X.migrate({id: 'o1', items: [{id: 'i1', name: 'Blade',
    origin: {kind: 'reward', detail: 'the duke', at: 123}}]});
  const back = X.migrate(JSON.parse(JSON.stringify(c)));
  return back.items[0].origin.kind === 'reward' && back.items[0].origin.detail === 'the duke' &&
         back.items[0].origin.at === 123;
})());

/* ================= armor: the structured field and the prose it replaces =====
   No pack item carries an `armor` object — all 31 state their AC in the
   DESCRIPTION, which itemArmor() parses. The item form now writes the
   structured field, so an item saved through it stops depending on wording. */
{
  const A = X.itemArmor;

  // what the pack actually ships, parsed out of prose
  ck('light armor reads as uncapped Dex',
     JSON.stringify(A({name:'Leather Armor', type:'Light Armor', description:'AC 11 + Dex modifier'}))
     === '{"kind":"body","base":11,"dexCap":null}');
  ck('medium armor reads its cap',
     A({name:'Half Plate', type:'Medium Armor', description:'AC 15 + Dex modifier (max 2)'}).dexCap === 2);
  ck('heavy armor adds no Dex',
     A({name:'Chain Mail', type:'Heavy Armor', description:'AC 16'}).dexCap === 0);

  // the structured field wins, which is the point of writing it
  ck('an explicit armor field beats the description',
     A({description:'AC 11 + Dex modifier', armor:{kind:'body',base:18,dexCap:0}}).base === 18);

  /* The gap that made custom armor unusable: a shield only registered if its
     TYPE or NAME said "shield", so a Buckler described as "AC +2" was not armor
     at all — not even equippable. An explicit kind does not care what it is called. */
  ck('a Buckler described as "AC +2" is still not read from prose',
     A({name:'Buckler', description:'AC +2'}) === null);
  ck('...but an explicit shield kind works whatever it is called',
     JSON.stringify(A({name:'Buckler', armor:{kind:'shield',bonus:2}})) === '{"kind":"shield","bonus":2}');
  ck('...and that makes it equippable', X.isEquippable({name:'Buckler', armor:{kind:'shield',bonus:2}}));

  // the kind a parsed armor opens on in the form
  ck('a parsed light armor opens on Light', X.armorKindOf({kind:'body',base:11,dexCap:null}) === 'light');
  ck('a parsed medium armor opens on Medium', X.armorKindOf({kind:'body',base:15,dexCap:2}) === 'medium');
  ck('a parsed heavy armor opens on Heavy', X.armorKindOf({kind:'body',base:16,dexCap:0}) === 'heavy');
  ck('a shield opens on Shield', X.armorKindOf({kind:'shield',bonus:2}) === 'shield');
  ck('the kinds carry the Dex each one adds',
     X.ARMOR_DEXCAP.light === null && X.ARMOR_DEXCAP.medium === 2 && X.ARMOR_DEXCAP.heavy === 0);

  /* AC maths through the real computation, with a Dex the caps actually bite.
     armorAC takes the CONTRIBUTIONS list, not the character — it hands that
     straight to abilFinal, which filters it. */
  X.character = X.blankChar();
  X.character.abilities.dex = 18;                       // +4
  const ac = () => X.armorAC(X.contributions()).base;
  const wear = a => { X.character.inventory = [{id:'a1', name:'W', equipped:true, armor:a}]; return ac(); };
  ck('light armor takes all of a +4 Dex', wear({kind:'body',base:11,dexCap:null}) === 15, wear({kind:'body',base:11,dexCap:null}));
  ck('medium armor caps it at 2', wear({kind:'body',base:15,dexCap:2}) === 17);
  ck('heavy armor takes none of it', wear({kind:'body',base:16,dexCap:0}) === 16);
  X.character.inventory = [{id:'a1',name:'W',equipped:true,armor:{kind:'body',base:16,dexCap:0}},
                           {id:'a2',name:'S',equipped:true,armor:{kind:'shield',bonus:2}}];
  ck('a shield stacks on top', ac() === 18, ac());
  X.character.inventory = [{id:'a1',name:'W',equipped:false,armor:{kind:'body',base:18,dexCap:0}}];
  ck('unequipped armor does nothing', ac() === 14, ac());   // 10 + 4 Dex
  X.character = X.blankChar();
}

/* ================= favorites and collapse, consistently ======================
   Inventory set the pattern: a star per row, a "★ Favorites" group above the
   rest, and one control that shuts everything or opens everything. Attacks and
   Features now read the same way. */
{
  ck('attacks and features share one favorites label', X.ATK_FAV === X.FEAT_FAV);

  // features already grouped; assert the shape attacks was made to match
  const g = X.featGroups([
    {id:'f1', name:'Zeta', fav:true},
    {id:'f2', name:'Alpha', fav:true},
    {id:'f3', name:'Plain'},
  ]);
  ck('favorites come first', g[0].label === X.FEAT_FAV, g.map(x => x.label));
  ck('...sorted by name inside the group', g[0].items.map(i => i.name).join() === 'Alpha,Zeta');
  ck('...and the rest keep their own grouping', g.length === 2 && g[1].items.length === 1);
  ck('no favorites means no favorites heading',
     X.featGroups([{id:'f1', name:'Only'}]).every(x => x.label !== X.FEAT_FAV));

  /* The collapse-all label is derived, not stored: "Collapse all" while anything
     is open, "Expand all" once everything is shut. Getting this backwards is the
     easy mistake, so pin the derivation both ways. */
  X.character = X.blankChar();
  X.character.attacks = [{id:'a1', name:'One'}, {id:'a2', name:'Two'}];
  const atkLbl = () => X.character.attacks.some(a => !X.atkCol().items[a.id]) ? 'Collapse all' : 'Expand all';
  ck('all open reads Collapse all', atkLbl() === 'Collapse all');
  X.atkCol().items.a1 = true;
  ck('one still open reads Collapse all', atkLbl() === 'Collapse all');
  X.atkCol().items.a2 = true;
  ck('all shut reads Expand all', atkLbl() === 'Expand all');

  X.character = X.blankChar();
  X.character.features = [{id:'f1', name:'A'}, {id:'f2', name:'B', fav:true}];
  const featLbl = () => X.featGroups(X.character.features).some(g2 => !X.featCol().groups[g2.label]) ? 'Collapse all' : 'Expand all';
  ck('features start on Collapse all', featLbl() === 'Collapse all');
  X.featGroups(X.character.features).forEach(g2 => { X.featCol().groups[g2.label] = true; });
  ck('...and read Expand all once every group is shut', featLbl() === 'Expand all');
  X.character = X.blankChar();
}

/* ===== the Concentrating condition is mirrored onto the Spells tab ===========
   One row markup, two places. The controls are delegated from document, so the
   same buttons work wherever the row is drawn — which is why the markup is
   shared rather than written twice and left to drift. */
{
  X.character = X.blankChar();
  ck('nothing to mirror when not concentrating', X.concStatusRow() === null);

  X.character.statuses = [
    {id:'s1', name:'Poisoned', active:true},
    {id:'s2', name:'Concentrating', active:true, concId:'act1', description:'Concentrating on Hex (level 1).'},
  ];
  const row = X.concStatusRow();
  ck('the mirror finds the concentration row by its link, not its name',
     row && row.id === 's2', row && row.id);
  ck('...and a status the player named "Concentrating" themselves is not mistaken for it', (() => {
    X.character.statuses = [{id:'s3', name:'Concentrating', active:true}];   // no concId
    return X.concStatusRow() === null;
  })());

  X.character.statuses = [{id:'s2', name:'Concentrating', active:true, concId:'act1', description:'On Hex.'}];
  const html = X.statusRowHTML(X.concStatusRow());
  ck('the shared row carries the same controls in both places',
     /data-toggle-status="s2"/.test(html) && /data-edit-status="s2"/.test(html) && /data-del-status="s2"/.test(html), html.slice(0, 120));
  ck('...and renders its description through the rich renderer',
     html.includes('On Hex.'));
  ck('an inactive status still renders, marked as cleared',
     !/on-status/.test(X.statusRowHTML({id:'x', name:'Prone', active:false})));
  X.character = X.blankChar();
}

/* ===== a weapon's attack follows whether you are carrying it =================
   Rows are hidden, never removed: unequipping must not throw away an attack the
   player tuned, and re-equipping has to bring it back exactly. */
{
  const inv = [
    {id:'i1', name:'Longsword', weapon:{dice:'1d8'}, equipped:true},
    {id:'i2', name:'Greataxe',  weapon:{dice:'1d12'}, equipped:false},
  ];
  const V = a => X.attackVisible(a, inv);

  ck('an equipped weapon shows its attack', V({id:'a1', itemId:'i1'}) === true);
  ck('an unequipped weapon does not', V({id:'a2', itemId:'i2'}) === false);
  ck('a hand-made attack has no item and always shows', V({id:'a3', name:'Unarmed'}) === true);
  ck('a spell attack is governed by the spell, not an item',
     V({id:'a4', spellId:'s1', source:'spell'}) === true);
  /* the item is gone, so there is no Equip control anywhere that could bring
     this back — hiding it would bury the row for good */
  ck('an orphaned attack keeps showing', V({id:'a5', itemId:'deleted'}) === true);

  // a weapon is equippable on its own now; before, only effects or armor did it
  ck('a plain weapon is equippable', X.isEquippable({name:'Club', weapon:{dice:'1d4'}}));
  ck('...and a plain non-weapon still is not', !X.isEquippable({name:'Rope'}));

  /* ---- the one-time migration ----
     Every weapon written before this version is stored equipped:false, not as a
     decision but because there was no control to make one. */
  const old = {inventory:[
    {id:'i1', name:'Sword', weapon:{dice:'1d8'}, equipped:false},
    {id:'i2', name:'Rope'},                                   // not a weapon
    {id:'i3', name:'Bow', weapon:{dice:'1d6'}, equipped:true}, // already equipped
  ]};
  const n = X.migrateWeaponEquip(old);
  ck('it equips the weapons that were never given the choice', n === 1, n);
  ck('...leaves a non-weapon alone', !old.inventory[1].equipped);
  ck('...and does not disturb one already equipped', old.inventory[2].equipped === true);
  ck('...marking the sheet so it cannot run twice', old.wpnEquipInit === 1);

  /* the flag is the whole point: without it, a weapon the player deliberately
     unequips would be re-equipped on the next load, forever */
  old.inventory[0].equipped = false;
  ck('a later unequip survives the next load', X.migrateWeaponEquip(old) === 0 && !old.inventory[0].equipped);

  /* blankChar must NOT pre-set the flag: migrate() builds its result FROM
     blankChar, so marking it there made every old sheet look already-migrated
     and skipped silently. */
  ck('blankChar does not pre-mark the flag', X.blankChar().wpnEquipInit === undefined);
  ck('...so migrate() actually runs it on an old sheet',
     X.migrate({abilities:{}, inventory:[{id:'x', name:'Axe', weapon:{dice:'1d12'}, equipped:false}]})
      .inventory[0].equipped === true);
}

/* ================= carried weight and encumbrance ================= */

// Build a character the way the app does, then assert against the real helpers.
// They read the module-level `character`, so each block sets it up first.
function sheet(over) {
  const c = X.blankChar();
  Object.assign(c, over || {});
  X.character = c;
  return c;
}
const item = (o) => Object.assign({id: 'x', name: 'Thing', qty: 1}, o);

// ---------- fnum: pounds and copper are measured, not counted
// num() is parseInt. An arrow weighs 0.05 lb and a candle costs 0.01 gp, so
// using num() for either silently turns them into nothing.
ck('num truncates a fractional weight to zero (why fnum exists)', X.num('0.05') === 0);
ck('fnum keeps it', X.fnum('0.05') === 0.05);
ck('fnum of a bare number passes through', X.fnum(3) === 3);
ck('fnum of empty is zero', X.fnum('') === 0);
ck('fnum of undefined is zero', X.fnum(undefined) === 0);
ck('fnum of rubbish is zero, not NaN', X.fnum('abc') === 0);
ck('fnum reads the number off "3 lb"', X.fnum('3 lb') === 3);

// ---------- formatting
ck('fmtWt prints a whole number plainly', X.fmtWt(3) === '3 lb');
ck('fmtWt keeps two decimals', X.fmtWt(0.05) === '0.05 lb');
ck('fmtWt rounds to two decimals', X.fmtWt(12.345) === '12.35 lb');
ck('fmtWt of nothing is 0 lb', X.fmtWt(undefined) === '0 lb');
// the same parseInt bug used to eat sub-1gp costs
ck('fmtGp no longer rounds a 1 sp cost to zero', X.fmtGp(0.1) === '0.1 gp');
ck('fmtGp still prints whole gp plainly', X.fmtGp(75) === '75 gp');

// ---------- per-item weight, times quantity
sheet();
ck('an item with no weight weighs nothing', X.itemWeight(item({})) === 0);
ck('weight is per unit', X.itemWeight(item({weight: 0.05, qty: 20})) === 0.05);
ck('20 arrows at 0.05 lb weigh exactly 1 lb, not 0',
   X.itemWeightTotal(item({weight: 0.05, qty: 20})) === 1);
ck('a missing qty counts as one', X.itemWeightTotal(item({weight: 3, qty: undefined})) === 3);

// ---------- coins weigh something: 50 to the pound
sheet({coins: {cp: '', sp: '', ep: '', gp: 500, pp: ''}});
ck('500 gold coins weigh 10 lb', X.coinsWeight() === 10);
sheet({coins: {cp: 25, sp: 25, ep: '', gp: '', pp: ''}});
ck('denominations sum before dividing', X.coinsWeight() === 1);
sheet({coins: {cp: '', sp: '', ep: '', gp: '', pp: ''}});
ck('an empty purse weighs nothing', X.coinsWeight() === 0);
sheet({coins: {gp: 500}, coinWeight: false});
ck('the coin-weight switch turns it off', X.coinsWeight() === 0);
// electrum is D&D-only, so coinKeys() hides it on a Humblewood sheet — but an
// imported character can still be carrying some, and it is still in the purse.
sheet({system: 'humblewood', coins: {cp: '', sp: '', ep: 50, gp: '', pp: ''}});
ck('electrum counts even when the skin does not show it', X.coinsWeight() === 1);

// ---------- the total
sheet({coins: {gp: 100}, inventory: [item({weight: 3}), item({weight: 0.05, qty: 20})]});
ck('carried weight is items plus coins', X.carriedWeight() === 6);
sheet({inventory: [item({weight: 0.05, qty: 20})]});
ck('carried weight is rounded, so binary float never trips a threshold',
   X.carriedWeight() === 1, X.carriedWeight());
sheet({inventory: [item({weight: 3, equipped: false}), item({weight: 3, equipped: true})]});
ck('unequipped gear still weighs — you are carrying it', X.carriedWeight() === 6);
sheet({inventory: [item({cost: 0.1, qty: 3})]});
ck('inventory value no longer truncates sub-1gp costs', X.inventoryTotal() === 0.3);

// ---------- size: explicit choice, else ancestry, else Medium
// the app stores full names; the converter is what turns 5e-tools' codes into them
ck('sizeName rejects a raw 5e-tools code', X.sizeName(['M']) === '');
ck('sizeName takes full names', X.sizeName(['Medium']) === 'Medium');
ck('sizeName of a bare string works', X.sizeName('Small') === 'Small');
ck('a choice of sizes settles on the largest', X.sizeName(['Small', 'Medium']) === 'Medium');
ck('sizeName of nothing is empty', X.sizeName(null) === '');
ck('sizeName drops sizes it does not know', X.sizeName(['Varies']) === '');
ck('sizeLabel keeps the choice for display', X.sizeLabel(['Small', 'Medium']) === 'Small or Medium');

X.rules = {races: [{name: 'Halfling', size: 'Small'}, {name: 'Goliath', size: 'Medium'}]};
sheet({race: {name: 'Halfling'}});
ck('size falls back to the ancestry', X.charSize() === 'Small');
sheet({race: {name: 'Halfling'}, size: 'Large'});
ck('an explicit size beats the ancestry', X.charSize() === 'Large');
sheet({race: {name: 'Nobody Knows'}});
ck('an unresolvable ancestry reads as Medium', X.charSize() === 'Medium');
sheet();
ck('no ancestry at all reads as Medium', X.charSize() === 'Medium');
X.rules = {races: []};

// ---------- carrying capacity
const cap = (over) => { sheet(over); return X.carryCapacity(X.contributions()); };
ck('STR 10, Medium: 150 lb', cap({}) === 150);
ck('STR 18, Medium: 270 lb', cap({abilities: Object.assign(X.blankChar().abilities, {str: 18})}) === 270);
ck('Large doubles it', cap({size: 'Large'}) === 300);
ck('Tiny halves it', cap({size: 'Tiny'}) === 75);
ck('Small is not halved — only Tiny is', cap({size: 'Small'}) === 150);
ck('a +2 STR item raises capacity, because it raises Strength',
   cap({size: 'Medium', inventory: [item({equipped: true, effects: [{target: 'ability.str', value: 2}]})]}) === 180);

// capacityFor is split out so the size picker can preview a size before you
// commit to it — it must agree with the capacity you actually get.
sheet({size: 'Large'});
ck('capacityFor previews a size you have not chosen',
   X.capacityFor('Tiny', X.contributions()) === 75);
ck('previewing does not change your real capacity',
   X.carryCapacity(X.contributions()) === 300);
ck('carryCapacity is capacityFor of your current size',
   X.carryCapacity(X.contributions()) === X.capacityFor(X.charSize(), X.contributions()));
ck('an unknown size falls back to the Medium multiplier',
   X.capacityFor('Enormous', X.contributions()) === 150);

// ---------- the size options list, shared by Vitals and Settings
X.rules = {races: [{name: 'Halfling', size: 'Small'}]};
sheet({race: {name: 'Halfling'}});
let opts = X.sizeOptionsHTML(X.character.size);
ck('the from-ancestry option names what it resolves to', opts.includes('From ancestry (Small)'), opts);
ck('with no explicit size, from-ancestry is selected',
   /value=""\s+selected/.test(opts), opts.slice(0, 120));
ck('every size is offered', X.SIZES.every(s => opts.includes('>' + s + '<')));
sheet({race: {name: 'Halfling'}, size: 'Large'});
opts = X.sizeOptionsHTML(X.character.size);
ck('an explicit size is the selected option', opts.includes('value="Large" selected'), opts);
ck('and from-ancestry is no longer selected', !/value=""\s+selected/.test(opts));
X.rules = {races: []};
ck('with no ancestry the fallback is named as Medium',
   X.sizeOptionsHTML('').includes('From ancestry (Medium)'));

// ---------- tiers. STR 10 Medium: cap 150, hard limit 300.
// Weight is supplied as one item so the boundaries are exact.
function tier(mode, lb, over) {
  sheet(Object.assign({encumbrance: mode, inventory: lb ? [item({weight: lb})] : []}, over || {}));
  return X.encState(X.contributions());
}
ck('mode off reports no tier at any weight', tier('none', 9999).tier === 'none');
ck('mode off still reports what you are carrying', tier('none', 42).carried === 42);
ck('an unknown mode falls back to off', tier('nonsense', 9999).tier === 'none');

ck('standard: exactly at capacity is fine', tier('standard', 150).tier === 'ok');
ck('standard: a hundredth over is over', tier('standard', 150.01).tier === 'over');
ck('standard: over means speed becomes 5, not minus 5', tier('standard', 200).floor === 5);
ck('standard: exactly at the hard limit is still liftable', tier('standard', 300).tier === 'over');
ck('standard: past the hard limit you cannot move', tier('standard', 300.01).tier === 'max');
ck('standard: the hard limit is twice capacity', tier('standard', 10).max === 300);
ck('standard has no middle tiers', tier('standard', 100).tier === 'ok');

ck('variant: up to a third of capacity is unencumbered', tier('variant', 50).tier === 'ok');
ck('variant: past that is Encumbered', tier('variant', 50.01).tier === 'encumbered');
ck('variant: Encumbered costs 10 ft', tier('variant', 75).penalty === -10);
ck('variant: two thirds is still only Encumbered', tier('variant', 100).tier === 'encumbered');
ck('variant: past two thirds is Heavily Encumbered', tier('variant', 100.01).tier === 'heavy');
ck('variant: Heavily Encumbered costs 20 ft', tier('variant', 150).penalty === -20);
ck('variant: above capacity the standard limits take over', tier('variant', 150.01).tier === 'over');
ck('variant: and so does the hard limit', tier('variant', 300.01).tier === 'max');
// the tiers are fractions of capacity, so size scales all of them
ck('variant tiers scale with size', tier('variant', 100, {size: 'Large'}).tier === 'ok');

// ---------- what that does to speed
const st = (mode, lb) => tier(mode, lb);
ck('off never touches speed', X.encSpeed(30, st('none', 9999)) === 30);
ck('unencumbered leaves speed alone', X.encSpeed(30, st('variant', 10)) === 30);
ck('Encumbered is minus 10', X.encSpeed(30, st('variant', 75)) === 20);
ck('Heavily Encumbered is minus 20', X.encSpeed(30, st('variant', 150)) === 10);
ck('over capacity replaces speed with 5', X.encSpeed(30, st('standard', 200)) === 5);
ck('past the hard limit you do not move', X.encSpeed(30, st('standard', 400)) === 0);
// a replacement must never make you FASTER, and a penalty must not go negative
ck('a slow character does not speed up to 5', X.encSpeed(0, st('standard', 200)) === 0);
ck('a 5 ft speed stays 5 ft when over capacity', X.encSpeed(5, st('standard', 200)) === 5);
ck('speed never goes below zero', X.encSpeed(15, st('variant', 150)) === 0);

// ---------- the prose that carries the non-numeric half of the rules
// Heavily Encumbered costs a speed penalty AND disadvantage on STR/DEX/CON.
// Only the penalty is a number, so if this sentence goes missing the player
// silently loses half the rule — there is nowhere else it is written down.
ck('every tier explains itself',
   ['ok', 'encumbered', 'heavy', 'over', 'max'].every((t, i) =>
     X.encTierNote(tier(i > 2 ? 'standard' : 'variant', [10, 75, 150, 200, 400][i])).length > 10));
ck('Heavily Encumbered still names the disadvantage',
   /disadvantage/i.test(X.encTierNote(tier('variant', 150))));
ck('Heavily Encumbered names which abilities',
   /Strength.*Dexterity.*Constitution/.test(X.encTierNote(tier('variant', 150))));
ck('over capacity explains it is push/drag/lift only',
   /push, drag or lift/i.test(X.encTierNote(tier('standard', 200))));
ck('the hard limit note quotes the actual limit',
   X.encTierNote(tier('standard', 400)).includes('300 lb'), X.encTierNote(tier('standard', 400)));

// ---------- these settings have to survive save and load
const saved = JSON.parse(JSON.stringify(sheet({
  size: 'Small', encumbrance: 'variant', coinWeight: false,
  inventory: [item({weight: 0.05, qty: 20})],
})));
const back = X.migrate(saved);
ck('size survives a save/load round-trip', back.size === 'Small');
ck('encumbrance mode survives', back.encumbrance === 'variant');
ck('the coin-weight switch survives, including when it is off', back.coinWeight === false);
ck('item weight survives', back.inventory[0].weight === 0.05);

// A sheet saved before this feature existed has none of these keys. It must come
// back with encumbrance OFF — silently dropping an existing character's speed to
// 5 ft because they were already carrying loot is the one unacceptable outcome.
const legacy = X.migrate({id: 'old', name: 'Existing character', inventory: [item({})]});
ck('an old save defaults to encumbrance off', legacy.encumbrance === 'none');
ck('an old save defaults to counting coin weight', legacy.coinWeight === true);
ck('an old save has no explicit size, so it derives one', legacy.size === '');
X.character = legacy;
ck('and therefore takes no speed penalty', X.encState(X.contributions()).tier === 'none');

/* ================= "choose N" pickers =================
   `choose` used to reach the label prose and nowhere else, so a Rogue offering
   "choose 4 of 10" would grant all ten and ticking none was equally accepted.
   choiceFieldHTML is a pure string builder — it reads character state but no
   DOM — so the markup that carries the count is directly assertable here. The
   live locking and the confirms are DOM, and are guarded in rules-data.js. */

// ---------- effectiveChoose: granted options don't eat the budget...
ck('a plain choice asks for its full count', X.effectiveChoose(2, 10, 0) === 2);
ck('one already granted still leaves two NEW picks', X.effectiveChoose(2, 10, 1) === 2);
ck('a missing count means one', X.effectiveChoose(undefined, 5, 0) === 1 && X.effectiveChoose(0, 5, 0) === 1);
// ...but it can never ask for more than remain
ck('choose 2 of 3 with two granted asks for the one that is left', X.effectiveChoose(2, 3, 2) === 1);
ck('everything granted asks for nothing', X.effectiveChoose(4, 4, 4) === 0);
ck('it never goes negative', X.effectiveChoose(4, 2, 3) === 0);

// ---------- choiceShortfall: the sentence, or "" when there is nothing owed
ck('a satisfied block says nothing', X.choiceShortfall([{label: 'Skills', picked: 2, target: 2}]) === '');
ck('an over-picked block says nothing either',
   X.choiceShortfall([{label: 'Skills', picked: 3, target: 2}]) === '');
ck('no blocks at all says nothing',
   X.choiceShortfall([]) === '' && X.choiceShortfall(null) === '' && X.choiceShortfall(undefined) === '');
ck('a zero target is satisfied by zero picks — the exhausted-pool case',
   X.choiceShortfall([{label: 'Skills', picked: 0, target: 0}]) === '');
{
  const w = X.choiceShortfall([{label: 'Choose 4 skill(s)', picked: 2, target: 4}]);
  ck('a short block names itself and both numbers',
     w.indexOf('Choose 4 skill(s)') > -1 && w.indexOf('2 of 4') > -1, w);
  ck('...and asks rather than tells', /Continue anyway\?/.test(w), w);
}
{
  // several blocks in one modal: only the unfinished ones are named
  const w = X.choiceShortfall([
    {label: 'Skills', picked: 2, target: 2},
    {label: 'Expertise', picked: 0, target: 2},
  ]);
  ck('a finished block is not listed beside an unfinished one',
     w.indexOf('Expertise') > -1 && w.indexOf('Skills') === -1, w);
}

// ---------- choiceFieldHTML carries the count into the markup
const fld = (ch) => X.choiceFieldHTML(ch, 0, null);
const attr = (html, re) => { const m = re.exec(html); return m ? m[1] : null; };
X.character = X.blankChar();

{
  const h = fld({type: 'skill', choose: 2, from: ['Acrobatics', 'Athletics', 'Stealth']});
  ck('a skill block emits its target as data-choose', attr(h, /data-choose="(\d+)"/) === '2', h);
  ck('...and a live counter to explain the locking', /data-chcount>0 of 2 chosen/.test(h), h);
  ck('nothing is pre-checked on a blank character', h.indexOf('checked') === -1, h);
  ck('no option is marked fixed either', h.indexOf('data-fixed') === -1, h);
  ck('every option is a checkbox with its skill key',
     (h.match(/type="checkbox" data-skill-opt="[a-z]+"/g) || []).length === 3, h);
}

// a proficiency granted elsewhere: locked, labelled with its source, and NOT
// counted against the budget — this is the case the fix exists for
X.character = X.blankChar();
X.grantProf('race:Elf', 'skill', 'perception', 1);
{
  const h = fld({type: 'skill', choose: 2, from: ['Perception', 'Stealth', 'Athletics']});
  ck('a granted option is checked, disabled and fixed',
     /data-skill-opt="perception" checked disabled data-fixed/.test(h), h);
  ck('...and names where it came from', h.indexOf('from Elf (ancestry)') > -1, h);
  ck('the other options stay open', (h.match(/data-skill-opt="(?!perception)[a-z]+"(?! checked)/g) || []).length === 2, h);
  ck('a granted option does NOT spend one of the picks', attr(h, /data-choose="(\d+)"/) === '2', h);
  ck('the heading says how many are already yours', h.indexOf('1 already yours') > -1, h);
}

// exhausted pool: two of three granted, so only one is pickable
X.character = X.blankChar();
X.grantProf('race:Elf', 'skill', 'perception', 1);
X.grantProf('bg:Sage', 'skill', 'athletics', 1);
{
  const h = fld({type: 'skill', choose: 2, from: ['Perception', 'Athletics', 'Stealth']});
  ck('the target drops to what is actually pickable', attr(h, /data-choose="(\d+)"/) === '1', h);
  ck('...and the heading asks for that many', h.indexOf('Choose 1 skill(s)') > -1, h);
}

// a skill the player toggled by hand counts as theirs too — effSkill takes the
// max of the manual dot and the grants
X.character = X.blankChar();
X.character.skills.stealth = 1;
{
  const h = fld({type: 'skill', choose: 1, from: ['Stealth', 'Athletics']});
  ck('a hand-set proficiency is locked as well',
     /data-skill-opt="stealth" checked disabled data-fixed/.test(h), h);
  ck('...and says so without inventing a source', h.indexOf('(already proficient)') > -1, h);
}

// ---------- the option type
X.character = X.blankChar();
{
  const one = fld({type: 'option', label: 'Fighting Style', choose: 1,
                   from: [{name: 'Archery'}, {name: 'Defense'}]});
  ck('choose:1 options stay radios — structurally capped', /type="radio"/.test(one), one);
  ck('...so they need no data-choose', one.indexOf('data-choose') === -1, one);
  const two = fld({type: 'option', label: 'Two Styles', choose: 2,
                   from: [{name: 'Archery'}, {name: 'Defense'}, {name: 'Duelling'}]});
  ck('choose:2 options are checkboxes', /type="checkbox"/.test(two), two);
  ck('...and DO carry the cap', attr(two, /data-choose="(\d+)"/) === '2', two);
  ck('...with a counter of their own', /data-chcount>0 of 2 chosen/.test(two), two);
}

// ---------- types with no count are left alone
{
  const sub = fld({type: 'subclass', from: ['Thief', 'Assassin']});
  ck('a subclass block is unchanged and uncapped',
     sub.indexOf('data-choose') === -1 && /type="radio"/.test(sub), sub);
  const asi = fld({type: 'asi'});
  ck('an ASI block is unchanged', asi.indexOf('data-choose') === -1, asi);
}

/* ================= favourites on Features & Traits =================
   Mirrors the inventory star: a favourite is MOVED to a pinned group at the top,
   not copied into one. featGroups is pure so the partition and ordering are
   assertable — renderFeatures itself writes through innerHTML on an element the
   harness stubs, so nothing about it is reachable. */
X.character = X.blankChar();
const feat = (id, name, origin, fav) => ({id, name, origin: origin || null, fav: fav || undefined, enabled: true});
const RACE = {kind: 'race', name: 'Elf'}, CLS = {kind: 'class', class: 'Rogue'};

{
  const g = X.featGroups([feat('1', 'Darkvision', RACE), feat('2', 'Sneak Attack', CLS)]);
  ck('with nothing starred there is no favourites group',
     g.length === 2 && g.every(x => x.label !== X.FEAT_FAV), g.map(x => x.label));
  ck('...and the origin groups are in grant order', g[0].label === 'Elf' && g[1].label === 'Rogue');
}
{
  const g = X.featGroups([feat('1', 'Darkvision', RACE), feat('2', 'Sneak Attack', CLS, true),
                          feat('3', 'Fey Ancestry', RACE)]);
  ck('a starred feature makes a favourites group, and it comes first', g[0].label === X.FEAT_FAV);
  ck('...holding exactly the starred one', g[0].items.map(f => f.name).join() === 'Sneak Attack');
  ck('...which LEAVES its origin group rather than appearing twice',
     g.filter(x => x.label === 'Rogue').length === 0 &&
     g.find(x => x.label === 'Elf').items.length === 2, g.map(x => x.label + ':' + x.items.length));
}
{
  // alphabetical in Favourites, mirroring inventory; grant order everywhere else
  const g = X.featGroups([feat('1', 'Zealous Presence', CLS, true), feat('2', 'Action Surge', CLS, true),
                          feat('3', 'Mask of the Wild', RACE), feat('4', 'Darkvision', RACE)]);
  ck('the favourites group sorts by name',
     g[0].items.map(f => f.name).join() === 'Action Surge,Zealous Presence');
  ck('...while the origin groups keep the order they were granted in',
     g[1].items.map(f => f.name).join() === 'Mask of the Wild,Darkvision');
}
{
  const g = X.featGroups([feat('1', 'Lucky', null), feat('2', 'Tough', null, true)]);
  ck('a feature with no origin still groups under Other',
     g[0].label === X.FEAT_FAV && g[1].label === 'Other');
}
ck('an empty list makes no groups at all',
   X.featGroups([]).length === 0 && X.featGroups(null).length === 0);

// ---------- the star markup matches inventory's
{
  const off = X.featItemHTML(feat('f1', 'Darkvision', RACE));
  const on = X.featItemHTML(feat('f2', 'Sneak Attack', CLS, true));
  ck('every feature row carries a star hooked to its id',
     /data-fav-feature="f1"/.test(off) && /data-fav-feature="f2"/.test(on));
  ck('an unstarred row is a hollow star with no on class',
     /class="fav "[^>]*>☆</.test(off), (off.match(/<button class="fav[^<]*<\/button>/) || [''])[0]);
  ck('a starred row is filled and marked on',
     /class="fav on"[^>]*>★</.test(on), (on.match(/<button class="fav[^<]*<\/button>/) || [''])[0]);
  ck('the star sits before the name, the slot inventory uses',
     off.indexOf('data-fav-feature') < off.indexOf('class="nm"'));
  ck('...and after the collapse caret, so the row reads the same as an item',
     off.indexOf('data-fitem') < off.indexOf('data-fav-feature'));
}

/* ================= spells per level =================
   spellLevelTally is the one place both the Spells tab heading and the spell
   browser's heading get their numbers, so the browser cannot promise something
   the sheet then disagrees with. Pure, hence assertable here. */
X.character = X.blankChar();
const spell = (name, level, granted) => ({id: 'sp-' + name, name, level, granted: granted || ''});

X.character.spells = [];
ck('a level with nothing is all zeros', (() => {
  const t = X.spellLevelTally(3);
  return t.added === 0 && t.granted === 0;
})());

X.character.spells = [spell('Fire Bolt', 0), spell('Light', 0), spell('Guidance', 0, 'Feat')];
ck('added counts only what is NOT granted', X.spellLevelTally(0).added === 2);
ck('...and granted is counted separately', X.spellLevelTally(0).granted === 1);
ck('a different level sees none of them', X.spellLevelTally(1).added === 0);

// levels 1-9 take their allotment from the SLOT total, not from spells known
X.character.slots = {1: {total: 4, used: 0}, 2: {total: 3, used: 0}};
X.character.spells = [spell('Bless', 1), spell('Shield', 1)];
ck('a spell level reads its allotment from the slots', X.spellLevelTally(1).allot === 4);
ck('...and a level with no slots has no allotment', X.spellLevelTally(9).allot === 0);
ck('the tally agrees with spellAllotment directly',
   X.spellLevelTally(2).allot === X.spellAllotment(2));

// level 0 takes it from cantrips-known, which is derived from class levels
X.character.slots = {};
X.character.classes = [{name: 'Wizard', level: 1}];
ck('cantrips take their allotment from the class table',
   X.spellLevelTally(0).allot === X.cantripsKnown() && X.cantripsKnown() === 3);
X.character.classes = [{name: 'Wizard', level: 4}];
ck('...and it moves with level', X.spellLevelTally(0).allot === 4);
X.character.classes = [];
ck('no caster class means no cantrip allotment', X.spellLevelTally(0).allot === 0);

// the string level a data file might carry must not break the match
X.character.classes = [];
X.character.spells = [{id: 'x', name: 'Mage Hand', level: '0', granted: ''}];
ck('a level stored as a string still tallies', X.spellLevelTally(0).added === 1);

// being over the allotment is a fact the tally reports, not one it prevents
X.character.slots = {1: {total: 1, used: 0}};
X.character.spells = [spell('Bless', 1), spell('Shield', 1), spell('Cure Wounds', 1)];
{
  const t = X.spellLevelTally(1);
  ck('going over the allotment is allowed and simply reported',
     t.added === 3 && t.allot === 1, t);
}

/* ================= descHTML: highlight() plus **bold** =================
   Rules prose carries run-in headings the source sets in bold. This is
   highlight() with exactly one addition, and the ordering is the security
   argument: esc() runs first, so the only tags in play are the ones highlight()
   inserted itself. */
X.character = X.blankChar();
X.resetRules();

ck('bold markers become strong', X.descHTML('**Autonomous Frame**') === '<strong>Autonomous Frame</strong>');
ck('a run-in heading keeps its prose beside it',
   X.descHTML('**Mobile.** Your gadget can move.') === '<strong>Mobile.</strong> Your gadget can move.');
ck('several in one string all convert',
   (X.descHTML('**A** x **B** y').match(/<strong>/g) || []).length === 2);
/* Newlines are REAL <br> elements now. .item .desc and .rt-view dropped their
   white-space:pre-wrap in the same change — keeping both doubled every break. */
ck('a newline becomes a real line break', X.descHTML('one\ntwo') === 'one<br>two');
ck('...and a lone paragraph comes back unwrapped, so .desc spacing is unchanged',
   X.descHTML('just prose').indexOf('<p>') === -1, X.descHTML('just prose'));
ck('...while a real block still produces block markup',
   /n-ul/.test(X.descHTML('- one\n- two')), X.descHTML('- one\n- two'));
ck('two paragraphs stay two paragraphs',
   (X.richHTML('one\n\ntwo').match(/<p>/g) || []).length === 2);

/* Run-in headings sit inside a <p>; a block element there nests illegally. */
ck('richInline never emits a block, whatever it is given',
   !/<p>|<ul|<ol|n-h|n-hr|n-q/.test(X.richInline('# Heading\n- bullet\n> quote\n---')),
   X.richInline('# Heading\n- bullet\n> quote\n---'));
ck('...but still does emphasis and line breaks',
   X.richInline('**b** *i* `c`\nnext') === '<strong>b</strong> <em>i</em> <code>c</code><br>next',
   X.richInline('**b** *i* `c`\nnext'));

/* the whole point of the change: every surface gets the same grammar */
ck('italic works in descriptions now', X.descHTML('*slanted*') === '<em>slanted</em>');
ck('code works in descriptions now', X.descHTML('`typed`') === '<code>typed</code>');

// The footnote asterisks that are ALREADY in the Humblewood data. A single *
// must stay literal: this is why descHTML is bold-only and not noteInline.
['You learn the divert power* spell.',
 'you can cast cymatic sight* without material components',
 'Spells marked with an asterisk (*) can be found in this book.'].forEach(s => {
  const out = X.descHTML(s);
  ck('a lone asterisk stays literal: ' + s.slice(0, 28),
     out.indexOf('*') > -1 && out.indexOf('<strong>') === -1 && out.indexOf('<em>') === -1, out);
});
ck('two lone asterisks in one string do not pair up',
   X.descHTML('cast divert power* and cymatic sight* freely').indexOf('<em>') === -1);

// escaping is highlight()'s job and must survive the bold pass
ck('markup in the text is still escaped',
   X.descHTML('<script>alert(1)</script>').indexOf('<script>') === -1);
ck('...including inside a bold run',
   X.descHTML('**<img src=x onerror=1>**').indexOf('<img') === -1);
ck('an unclosed marker is inert', X.descHTML('**not bold').indexOf('<strong>') === -1);
ck('empty and null are safe', X.descHTML('') === '' && X.descHTML(null) === '' && X.descHTML(undefined) === '');
ck('no sentinel leaks into the output',
   !/[\uE000-\uE00F]/.test(X.descHTML('**A** plain **B**')), JSON.stringify(X.descHTML('**A** plain **B**')));

// a glossary chip must survive being held aside, and bold must not corrupt it
X.mergeRules({keywords: [{term: 'Dodge', text: 'A defensive action.'}]}, 'probe');
{
  const out = X.descHTML('takes the Dodge action');
  ck('a glossary term still becomes a chip', /class="kw"/.test(out), out);
  const bold = X.descHTML('**Remote Control.** takes the Dodge action');
  ck('...and still does when a bold run precedes it',
     /<strong>Remote Control\.<\/strong>/.test(bold) && /class="kw"/.test(bold), bold);
  ck('bold does not eat the chip markup', bold.indexOf('<strong>Dodge') === -1, bold);
  // the chip's own attributes contain no ** so nothing inside it can convert
  ck('a chip is returned intact, not re-escaped',
     bold.indexOf('&lt;span') === -1, bold);
}
X.resetRules();

// ---------- attack damage lines, including additional damage types
// The sheet row, the breakdown modal and the print sheet all format damage
// through attackDamageStr, so these assertions cover all three.
{
  const S = X.attackDamageStr, L = X.extraDamageList, P = X.damagePartStr;

  // the shape every attack saved before this feature has: no extraDamage key
  const plain = {damageDice: '1d8', damageType: 'slashing'};
  ck('an old attack with no extras formats exactly as before',
     S(plain, 3) === '1d8 +3 slashing', S(plain, 3));
  ck('...and with no bonus', S(plain, 0) === '1d8 slashing', S(plain, 0));
  ck('a negative bonus keeps its sign', S(plain, -1) === '1d8 -1 slashing', S(plain, -1));
  ck('an empty attack is an empty line, not stray spaces', S({}, 0) === '', JSON.stringify(S({}, 0)));
  ck('a null attack is safe', S(null, 3) === '');

  // the feature: a sword that also deals poison
  const poisoned = {damageDice: '1d8', damageType: 'slashing',
                    extraDamage: [{dice: '1d6', type: 'poison'}]};
  ck('an extra damage type is appended with a plus',
     S(poisoned, 3) === '1d8 +3 slashing + 1d6 poison', S(poisoned, 3));
  ck('the bonus lands on the main damage only, never on an extra',
     S(poisoned, 3).indexOf('1d6 +3') === -1, S(poisoned, 3));
  ck('several extras all show',
     S({damageDice: '1d8', damageType: 'slashing',
        extraDamage: [{dice: '1d6', type: 'fire'}, {dice: '2d4', type: 'necrotic'}]}, 0)
     === '1d8 slashing + 1d6 fire + 2d4 necrotic');

  // a save spell's row passes bonus 0 — extras must still print
  ck('a save attack shows its extras with no bonus',
     S({damageDice: '8d6', damageType: 'fire', extraDamage: [{dice: '1d4', type: 'radiant'}]}, 0)
     === '8d6 fire + 1d4 radiant');

  // half-filled rows are usable: dice with no type, or a type with no dice
  ck('an extra with dice but no type still shows',
     S({damageDice: '1d8', extraDamage: [{dice: '1d6'}]}, 0) === '1d8 + 1d6');
  ck('an extra with a type but no dice still shows',
     S({damageDice: '1d8', extraDamage: [{type: 'poison'}]}, 0) === '1d8 + poison');
  ck('an extra with a main die missing leads with the extra',
     S({extraDamage: [{dice: '1d6', type: 'fire'}]}, 0) === '1d6 fire');

  // rubbish must not produce a stray " + " or throw
  ck('a wholly empty extra row is dropped',
     S({damageDice: '1d8', extraDamage: [{dice: '', type: ''}]}, 0) === '1d8');
  ck('a null entry in the list is dropped',
     S({damageDice: '1d8', extraDamage: [null, {dice: '1d6', type: 'fire'}]}, 0) === '1d8 + 1d6 fire');
  ck('extraDamage that is not an array is ignored, not thrown on',
     S({damageDice: '1d8', extraDamage: '1d6 fire'}, 0) === '1d8');
  ck('surrounding whitespace is trimmed off an extra',
     S({damageDice: '1d8', extraDamage: [{dice: '  1d6 ', type: ' fire '}]}, 0) === '1d8 + 1d6 fire');
  ck('numbers survive being typed into the boxes',
     S({damageDice: '1d8', extraDamage: [{dice: 6, type: 'fire'}]}, 0) === '1d8 + 6 fire');

  ck('extraDamageList is empty for an attack that has none', L({damageDice: '1d8'}).length === 0);
  ck('extraDamageList normalises to trimmed strings',
     JSON.stringify(L({extraDamage: [{dice: ' 1d6 '}]})) === '[{"dice":"1d6","type":""}]',
     JSON.stringify(L({extraDamage: [{dice: ' 1d6 '}]})));
  ck('damagePartStr with nothing at all is empty', P('', '', 0) === '');
}

// the field must survive a save -> load round-trip untouched
{
  const c = X.blankChar();
  c.attacks = [{id: 'a1', name: 'Flame Tongue', damageDice: '1d8', damageType: 'slashing',
                extraDamage: [{dice: '2d6', type: 'fire'}]},
               {id: 'a2', name: 'Club', damageDice: '1d4', damageType: 'bludgeoning'}];
  const back = X.migrate(JSON.parse(JSON.stringify(c)));
  ck('migrate keeps extraDamage on the attack',
     JSON.stringify(back.attacks[0].extraDamage) === '[{"dice":"2d6","type":"fire"}]',
     JSON.stringify(back.attacks[0]));
  ck('...and does not invent one on an attack without it',
     back.attacks[1].extraDamage === undefined, JSON.stringify(back.attacks[1]));
  ck('a blank character starts with no attacks at all',
     Array.isArray(X.blankChar().attacks) && X.blankChar().attacks.length === 0);
}

// ---------- editing an attack must not unlink it from its item or spell
// The attack form rebuilds the record from its boxes, so the links the form
// never shows have to be carried across by hand. The bug this encodes: an edited
// weapon attack lost its itemId, so the next rules-pack update found no attack
// for the item and added a SECOND one.
{
  const C = X.carryAttackLinks;
  const edited = () => ({id: 'a1', name: 'Longsword', kind: 'melee', damageDice: '1d8'});

  const fromItem = C({id: 'a1', name: 'Longsword', itemId: 'it7'}, edited());
  ck('an edited attack keeps the item it came from', fromItem.itemId === 'it7', JSON.stringify(fromItem));

  const fresh = C({id: 'a2', name: '', kind: 'melee'}, edited());
  ck('a fresh attack still has no itemId', fresh.itemId === undefined, JSON.stringify(fresh));
  ck('...and no spellId, so nothing invents a link', fresh.spellId === undefined);

  const spellAtk = C({id: 'a3', spellId: 's1', source: 'spell', save: {ability: 'dex'}}, edited());
  ck('a spell attack keeps its spell link', spellAtk.spellId === 's1' && spellAtk.source === 'spell');
  ck('...and its save block, which is what prints the DC',
     JSON.stringify(spellAtk.save) === '{"ability":"dex"}');

  const typed = C({id: 'a4', itemId: 'it7'}, {id: 'a4', name: 'Longsword +1', itemId: undefined});
  ck('a link is restored even when the rebuilt record set it undefined', typed.itemId === 'it7');
  ck('carrying links does not touch what the player just typed',
     typed.name === 'Longsword +1');
  ck('a record with no previous version is returned unchanged',
     JSON.stringify(C(null, edited())) === JSON.stringify(edited()));
}

// ---------- a spell's own additional damage types
// A spell's attack row is rebuilt from the spell every time (which is why it has
// Cast where a weapon has Edit), so extras had nowhere to live and a spell that
// dealt two damage types could not say so. The field is on the SPELL now, in the
// same {dice,type} shape, and syncSpellAttack carries it onto the row.
{
  const c = X.blankChar();
  c.spellAbility = 'int';
  X.character = c;
  const row = () => X.character.attacks[0];

  const bolt = {id: 'sp1', name: 'Fire Bolt', atkType: 'attack', atkKind: 'ranged',
                dice: '1d10', damageType: 'fire',
                extraDamage: [{dice: '1d6', type: 'radiant'}]};
  X.syncSpellAttack(bolt);
  ck('a spell attack row is created', X.character.attacks.length === 1 && row().spellId === 'sp1');
  ck('the spell carries its extra damage onto the row',
     JSON.stringify(row().extraDamage) === '[{"dice":"1d6","type":"radiant"}]', JSON.stringify(row()));
  ck('...and the row formats both types',
     X.attackDamageStr(row(), 0) === '1d10 fire + 1d6 radiant', X.attackDamageStr(row(), 0));

  const save = {id: 'sp2', name: 'Ice Knife', atkType: 'save', saveAbility: 'dex',
                dice: '2d6', damageType: 'cold', extraDamage: [{dice: '1d10', type: 'piercing'}]};
  X.syncSpellAttack(save);
  const srow = X.character.attacks.find(a => a.spellId === 'sp2');
  ck('a save spell carries its extras too',
     JSON.stringify(srow.extraDamage) === '[{"dice":"1d10","type":"piercing"}]', JSON.stringify(srow));
  ck('...and still prints its save block', JSON.stringify(srow.save) === '{"ability":"dex"}');

  // the shape every spell saved before this has
  X.syncSpellAttack({id: 'sp3', name: 'Sacred Flame', atkType: 'save', saveAbility: 'dex', dice: '1d8', damageType: 'radiant'});
  const plain = X.character.attacks.find(a => a.spellId === 'sp3');
  ck('a spell with no extras produces a row with no extraDamage key',
     plain.extraDamage === undefined, JSON.stringify(plain));
  ck('...and formats exactly as it did before', X.attackDamageStr(plain, 0) === '1d8 radiant');

  // rubbish on the spell must not reach the row as a stray " + "
  X.syncSpellAttack({id: 'sp4', name: 'Bad', atkType: 'attack', dice: '1d4', extraDamage: [{dice: '', type: ''}]});
  ck('an empty extra row on a spell is dropped, not carried',
     X.character.attacks.find(a => a.spellId === 'sp4').extraDamage === undefined);

  /* ---------- a save spell earns a row only if it deals damage ----------
     A damage-free save row repeats the Spell Save DC already on the
     Spellcasting card, and 92 of them across the packs buried the rows that
     carry numbers. An ATTACK spell keeps its row either way: the to-hit is the
     number, and nothing else on the sheet shows it. */
  const rowsFor = id => X.character.attacks.filter(a => a.spellId === id).length;

  X.syncSpellAttack({id: 'nd1', name: 'Cause Fear', atkType: 'save', saveAbility: 'wis'});
  ck('a save spell with no damage gets no row', rowsFor('nd1') === 0);

  X.syncSpellAttack({id: 'nd2', name: 'Hold Person', atkType: 'save', saveAbility: 'wis', dice: '   '});
  ck('...whitespace is not damage', rowsFor('nd2') === 0);

  X.syncSpellAttack({id: 'nd3', name: 'Fireball', atkType: 'save', saveAbility: 'dex', dice: '8d6', damageType: 'fire'});
  ck('a save spell WITH damage keeps its row', rowsFor('nd3') === 1);

  X.syncSpellAttack({id: 'nd4', name: 'Odd', atkType: 'save', saveAbility: 'dex',
                     extraDamage: [{dice: '1d6', type: 'fire'}]});
  ck('...extras alone are damage enough', rowsFor('nd4') === 1);

  X.syncSpellAttack({id: 'nd5', name: 'Flame Blade', atkType: 'attack', atkKind: 'melee'});
  ck('an attack spell with no damage KEEPS its row', rowsFor('nd5') === 1,
     JSON.stringify(X.character.attacks.filter(a => a.spellId === 'nd5')));

  // a row that no longer qualifies is removed when the spell is re-synced
  X.syncSpellAttack({id: 'nd3', name: 'Fireball', atkType: 'save', saveAbility: 'dex'});
  ck('losing its damage removes the row on the next sync', rowsFor('nd3') === 0);

  /* ---------- reading damage out of spell text ---------- */
  const dmg = t => { const o = {text: t}; X.spellDamageFromText(o); return (o.dice || '') + '|' + (o.damageType || ''); };
  ck('a flat bonus is part of the dice, not the type',
     dmg('takes 10d6 + 40 force damage') === '10d6 + 40|force', dmg('takes 10d6 + 40 force damage'));
  ck('the plain form still reads as it did', dmg('takes 8d6 fire damage') === '8d6|fire');
  ck('a player-chosen type fills the dice and leaves the type blank',
     dmg('taking 3d6 damage of the chosen type') === '3d6|');
  /* the one construction a looser pattern would get wrong */
  ck('a penalty to someone else\'s damage is not this spell\'s damage',
     dmg('it subtracts 1d8 from all its damage rolls') === '|');
  ck('an explicit value is never overwritten', (() => {
    const o = {text: 'takes 8d6 fire damage', dice: '1d4', damageType: 'cold'};
    X.spellDamageFromText(o); return o.dice === '1d4' && o.damageType === 'cold';
  })());

  /* ---------- the load-time backfill ----------
     A sheet saved before the pattern was widened has atkType set, so
     detectSpellAttack returns early and never revisits it. */
  X.character.spells = [
    {id: 'bf1', name: 'Disintegrate', atkType: 'save', saveAbility: 'dex', text: 'takes 10d6 + 40 force damage'},
    {id: 'bf2', name: 'Charm Person', atkType: 'save', saveAbility: 'wis', text: 'no damage here'},
    {id: 'bf3', name: 'Mine', atkType: 'save', saveAbility: 'dex', dice: '1d4', text: 'takes 8d6 fire damage'},
  ];
  X.character.attacks = [];
  const filled = X.spellDamageBackfill();
  ck('the backfill fills a blank from the text', X.character.spells[0].dice === '10d6 + 40');
  ck('...and gives that spell its row back', rowsFor('bf1') === 1);
  ck('...leaves a genuinely damage-free spell alone',
     !X.character.spells[1].dice && rowsFor('bf2') === 0);
  ck('...and never overwrites what the player typed', X.character.spells[2].dice === '1d4');
  ck('...reporting how many it touched', filled === 1, filled);

  /* The rule only bites when syncSpellAttack runs, so a sheet saved before it
     existed keeps its damage-free rows until something touches that spell —
     which for a spell you never edit is never. Swept once on load. */
  X.character.spells = [
    {id: 'sw1', name: 'Cause Fear', atkType: 'save', saveAbility: 'wis', text: 'no damage'},
    {id: 'sw2', name: 'Fireball', atkType: 'save', saveAbility: 'dex', dice: '8d6', damageType: 'fire'},
    {id: 'sw3', name: 'Flame Blade', atkType: 'attack', atkKind: 'melee'},
  ];
  X.character.attacks = [
    {id: 'r1', spellId: 'sw1', source: 'spell', name: 'Cause Fear', save: {ability: 'wis'}, damageDice: ''},
    {id: 'r2', spellId: 'sw2', source: 'spell', name: 'Fireball', save: {ability: 'dex'}, damageDice: '8d6'},
    {id: 'r3', spellId: 'sw3', source: 'spell', name: 'Flame Blade', kind: 'melee', damageDice: ''},
    {id: 'r4', name: 'Longsword', itemId: 'i1', damageDice: '1d8'},
    {id: 'r5', spellId: 'gone', source: 'spell', name: 'Orphan', save: {ability: 'dex'}, damageDice: ''},
  ];
  const swept = X.dropDamagelessSpellRows();
  const left = X.character.attacks.map(a => a.id).join(',');
  ck('the sweep drops a stored damage-free save row', swept === 1, swept);
  ck('...keeps the save row that has damage', left.indexOf('r2') >= 0);
  ck('...keeps an attack spell row with no damage', left.indexOf('r3') >= 0);
  ck('...never touches a weapon row', left.indexOf('r4') >= 0);
  ck('...and leaves an orphan row alone rather than judging it', left.indexOf('r5') >= 0, left);
  ck('...keeping the ids of the rows it spares', left === 'r2,r3,r4,r5', left);

  X.character.spells = []; X.character.attacks = [];

  // re-syncing rebuilds the row: the extras must come back with it, and only once
  X.syncSpellAttack(bolt);
  ck('re-syncing a spell leaves exactly one row for it',
     X.character.attacks.filter(a => a.spellId === 'sp1').length === 1);
  ck('...still carrying its extras',
     JSON.stringify(X.character.attacks.find(a => a.spellId === 'sp1').extraDamage)
     === '[{"dice":"1d6","type":"radiant"}]');

  // a spell that stops being an attack takes its row with it
  X.syncSpellAttack({id: 'sp1', name: 'Fire Bolt', atkType: '', extraDamage: [{dice: '1d6', type: 'radiant'}]});
  ck('a spell that is not an attack has no row at all',
     X.character.attacks.filter(a => a.spellId === 'sp1').length === 0);

  // detection is untouched: an explicit setting still wins over the text
  const explicit = {atkType: '', text: 'make a ranged spell attack'};
  X.detectSpellAttack(explicit);
  ck('"not an attack" still sticks against the spell text', explicit.atkType === '');

  // and the field survives a save -> load round trip on the spell
  const c2 = X.blankChar();
  c2.spells = [{id: 'sp1', name: 'Fire Bolt', level: 0, extraDamage: [{dice: '1d6', type: 'radiant'}]},
               {id: 'sp2', name: 'Light', level: 0}];
  const back2 = X.migrate(JSON.parse(JSON.stringify(c2)));
  ck('migrate keeps extraDamage on the spell',
     JSON.stringify(back2.spells[0].extraDamage) === '[{"dice":"1d6","type":"radiant"}]');
  ck('...and does not invent one on a spell without it', back2.spells[1].extraDamage === undefined);
  X.character = X.blankChar();
}
/* ================= feats & traits: what the picker offers, and what it adds ===
   The browser itself is DOM, but everything it decides is in these functions:
   which category a feat is, what its prerequisite says, what the sheet ends up
   calling it, and — the part that matters six months later — that the record it
   writes still resolves back to its rules entry. */
X.character = X.blankChar();
X.resetRules();
X.mergeRules({system: 'Probe', feats: [
  {name: 'Alert', description: 'Origin feat\nYou gain a +5 bonus to Initiative.',
   effects: [{target: 'init', value: 5}]},
  {name: 'Grappler', description: 'General feat · Prerequisite: Level 4+ and Strength 13+\nYou have advantage.'},
  {name: 'Archery', description: 'Fighting Style feat · Prerequisite: Fighting Style feature\n+2 to ranged attack rolls.'},
  {name: 'Boon of Combat Prowess', description: 'Epic Boon · Prerequisite: Level 19+\nYou never miss.'},
  {name: 'Aerial Expert', description: 'Origin Feat (Prerequisite: Glide trait)\nYou glide well.'},
  {name: 'Dragon Fear', description: 'Prerequisite: Dragonborn\nYou can roar.'},
  {name: 'Glide', description: 'You are more at home in the trees than on the ground.'},
], features: [
  {name: 'Glide', description: 'You can glide when you fall.', source: 'Ancestry'},
  {name: 'Darkvision', description: 'You see in the dark.'},
]}, 'probe.json');

const picks = X.featPickList();
const pick = (k, n) => picks.find(w => w.k === k && w.e.name === n);
ck('the picker offers feats AND traits, which no chooser did before',
   picks.length === 9 && picks.filter(w => w.k === 'feat').length === 7, picks.length);
ck('a feat and a trait of the same name stay two rows',
   pick('feat', 'Glide') && pick('trait', 'Glide') &&
   pick('feat', 'Glide').id !== pick('trait', 'Glide').id);

// ---------- the category line the converter writes as the first line
[['Alert', 'origin'], ['Aerial Expert', 'origin'], ['Grappler', 'general'],
 ['Archery', 'style'], ['Boon of Combat Prowess', 'boon'],
 ['Dragon Fear', 'feat'], ['Glide', 'feat']].forEach(([n, k]) => {
  ck(n + ' is a "' + k + '"', X.featPickKind(pick('feat', n)) === k, X.featPickKind(pick('feat', n)));
});
ck('a 2014-era feat with no category line is simply a Feat',
   X.featKindDef(X.featPickKind(pick('feat', 'Dragon Fear'))).label === 'Feat');
ck('a trait is a trait whatever its text says',
   X.featPickKind(pick('trait', 'Glide')) === 'trait' &&
   X.featPickKind(pick('trait', 'Darkvision')) === 'trait');
ck('every kind has a group heading', X.FEAT_KINDS.every(k => !!k.group && !!k.label));

// ---------- headings: feats by category, loose traits by what they actually are
ck('a feat heads its category', X.featPickGroup(pick('feat', 'Alert')) === 'Origin Feats' &&
   X.featPickGroup(pick('feat', 'Boon of Combat Prowess')) === 'Epic Boons');
ck('a trait heads its own source — the Invocations/Maneuvers/Infusions split',
   X.featPickGroup(pick('trait', 'Glide')) === 'Ancestry', X.featPickGroup(pick('trait', 'Glide')));
ck('...and falls back to one bucket when it has none',
   X.featPickGroup(pick('trait', 'Darkvision')) === 'Traits');

// ---------- prerequisites: first line only, and the filter depends on it
ck('a middot prerequisite is read',
   X.featPickPrereq(pick('feat', 'Grappler')) === 'Level 4+ and Strength 13+',
   X.featPickPrereq(pick('feat', 'Grappler')));
ck('a bare prerequisite line is read too',
   X.featPickPrereq(pick('feat', 'Dragon Fear')) === 'Dragonborn');
ck('the parenthesised Humblewood form loses its bracket',
   X.featPickPrereq(pick('feat', 'Aerial Expert')) === 'Glide trait',
   X.featPickPrereq(pick('feat', 'Aerial Expert')));
ck('a feat with no prerequisite reports none',
   X.featPickPrereq(pick('feat', 'Alert')) === '' && X.featPickPrereq(pick('trait', 'Glide')) === '');
// prose in the body must not be mistaken for a gate — this is a filter, not a rules engine
ck('"prerequisite" deeper in the text is ignored',
   X.featPickPrereq({k: 'feat', e: {description: 'Origin feat\nIgnore any prerequisite: none.'}}) === '');

// ---------- adding: a feat is stored exactly as grantFeatDef stores one
const added = X.addPickedFeature(pick('feat', 'Alert'));
ck('a feat is named the way a granted feat is', added.name === 'Feat: Alert', added.name);
ck('...and carries its effects', JSON.stringify(added.effects) === '[{"target":"init","value":5}]');
ck('...and is stamped against the feats category',
   added.src && added.src.cat === 'feats' && added.src.name === 'Alert', added.src);
ck('...so the update tool finds its definition again',
   X.updResolve(added, 'feature').def === X.rules.feats.find(f => f.name === 'Alert'));
ck('a picked feat gets no origin, so changing species cannot delete it',
   added.origin === null && X.featGroupLabel(added) === 'Other');

const tr = X.addPickedFeature(pick('trait', 'Glide'));
ck('a trait keeps its own name', tr.name === 'Glide');
ck('...and its own source badge', tr.source === 'Ancestry');
ck('...and is stamped against the features category',
   tr.src && tr.src.cat === 'features' && tr.src.name === 'Glide', tr.src);
ck('...and resolves back too',
   X.updResolve(tr, 'feature').def === X.rules.features.find(f => f.name === 'Glide'));
ck('the same-named FEAT is still addable beside it',
   !!X.addPickedFeature(pick('feat', 'Glide')) && X.character.features.length === 3,
   X.character.features.map(f => f.name));

// ---------- picking something you already have is a misclick, not a second copy
ck('adding a feat twice is refused', X.addPickedFeature(pick('feat', 'Alert')) === null);
ck('...and nothing is pushed', X.character.features.length === 3);
ck('...which is exactly what the row badge warns about',
   X.featPickStoredName(pick('feat', 'Alert')) === 'Feat: Alert' &&
   X.featPickStoredName(pick('trait', 'Darkvision')) === 'Darkvision');

// a pack that loaded nothing must not offer an empty browser
X.resetRules();
ck('no rules loaded, nothing to pick', X.featPickList().length === 0);
X.character = X.blankChar();
/* ================= item uses ================= */

// A dice expression is what the player TYPES, so the parser has to accept the
// spellings people actually use and reject everything else outright — a
// mis-read heal hands out the wrong hit points and nothing on screen says so.
const P = X.parseDiceExpr;
ck('2d4+2 parses', JSON.stringify(P('2d4+2')) === JSON.stringify({dice: [{n: 2, sides: 4, sign: 1}], mod: 2}),
   JSON.stringify(P('2d4+2')));
ck('spaces are ignored', JSON.stringify(P('2d4 + 2')) === JSON.stringify(P('2d4+2')));
ck('a bare die means one of them', P('d6').dice[0].n === 1 && P('d6').dice[0].sides === 6);
ck('1d8 has no modifier', P('1d8').mod === 0);
ck('a flat number is dice-free', P('10').dice.length === 0 && P('10').mod === 10);
ck('a negative modifier is kept', P('2d4-1').mod === -1);
ck('two dice groups both survive', P('1d4+1d6').dice.length === 2);
ck('a unicode minus reads as a minus', P('2d4−1').mod === -1);
['', '   ', 'abc', '2d', 'd', '2x4', '1d4+', '+', '2.5d4', '1d4 fire', '0d6', '2d1', '200d6']
  .forEach(bad => ck('rejects ' + JSON.stringify(bad), P(bad) === null, JSON.stringify(P(bad))));

ck('diceExprText writes the whole expression back', X.diceExprText(P('2d4+2')) === '2d4 + 2',
   X.diceExprText(P('2d4+2')));
ck('...a flat heal is just the number', X.diceExprText(P('10')) === '10');
ck('diceExprDice is the part you pick up', X.diceExprDice(P('2d4+2')) === '2d4');
ck('...and is empty when there are no dice', X.diceExprDice(P('10')) === '');

// The roll is the only part that touches Math.random, so it is asserted by
// bounds rather than by value — 300 rolls of 2d4+2 must all land in 4..10.
{
  const p = P('2d4+2');
  let lo = 99, hi = -99, badFaces = 0;
  for (let i = 0; i < 300; i++) {
    const r = X.rollDiceExpr(p);
    lo = Math.min(lo, r.total); hi = Math.max(hi, r.total);
    if (r.faces.length !== 2 || r.faces.some(v => v < 1 || v > 4)) badFaces++;
  }
  ck('every 2d4+2 roll is within 4..10', lo >= 4 && hi <= 10, lo + '..' + hi);
  ck('...and shows its working: two d4 faces each time', badFaces === 0, badFaces);
  ck('a flat expression rolls to itself', X.rollDiceExpr(P('7')).total === 7);
}

// ---------- reading a potion out of its own text
const potion = {name: 'Potion of Healing', category: 'Potion',
  description: 'The creature that drinks the magical red fluid in this vial regains 2d4 + 2 Hit Points.'};
ck('a healing potion is read from its description',
   JSON.stringify(X.detectItemUse(potion)) === JSON.stringify({heal: '2d4+2', consume: true}),
   JSON.stringify(X.detectItemUse(potion)));
ck('a flat heal is read too',
   X.detectItemUse({category: 'Potion', description: 'You regain 15 Hit Points.'}).heal === '15');
// The trap: "regains 1d3 expended charges" is the same verb and is NOT a heal.
ck('recharging charges is not healing',
   X.detectItemUse({category: 'Potion', description: 'The wand regains 1d3 expended charges daily at dawn'}) === null);
ck('a wondrous item is never auto-read',
   X.detectItemUse({category: 'Wondrous Item', description: 'you can regain 2d4 + 2 Hit Points'}) === null);
ck('nothing is read out of an empty item', X.detectItemUse({}) === null && X.detectItemUse(null) === null);

// ---------- what the player set beats what we inferred, and "off" sticks
ck('an explicit use wins over the detected one',
   X.itemUse(Object.assign({use: {heal: '1d4'}}, potion)).heal === '1d4');
ck('use.off means not usable, against a detected default',
   X.itemUse(Object.assign({use: {off: true}}, potion)) === null);
ck('an unedited potion falls back to detection', X.itemUse(potion).heal === '2d4+2');
ck('a rope is not usable', X.itemUsable({name: 'Rope', category: 'Gear'}) === false);
ck('a potion is usable with no configuration at all', X.itemUsable(potion) === true);
ck('limited uses alone make an item usable',
   X.itemUsable({name: 'Wand', category: 'Wand', uses: {max: 3, per: 'long', used: 0}}) === true);
ck('itemUsesMax reads the same shape features use',
   X.itemUsesMax({uses: {max: 3, per: 'long', used: 1}}) === 3 && X.itemUsesMax({}) === 0);
ck('a missing quantity means one', X.itemQty({}) === 1 && X.itemQty({qty: ''}) === 1);
ck('...but a real zero is zero', X.itemQty({qty: 0}) === 0 && X.itemQty({qty: 3}) === 3);
ck('the Use button only appears on a usable item',
   X.invItemHTML(Object.assign({id: 'p1'}, potion)).indexOf('data-useitem="p1"') > -1 &&
   X.invItemHTML({id: 'r1', name: 'Rope', category: 'Gear'}).indexOf('data-useitem') === -1);
ck('the uses pips carry the item id',
   X.itemUsesRowHTML({id: 'w1', uses: {max: 2, per: 'short', used: 1}}).indexOf('data-iuse="w1"') > -1);

// ---------- applying a use
function charWith(inv, hp) {
  const c = X.migrate({inventory: inv, hp: Object.assign({cur: 5, max: 20, temp: ''}, hp || {})});
  X.character = c;
  return c;
}
{
  const it = {id: 'i1', name: 'Potion of Healing', qty: 2, category: 'Potion', use: {heal: '2d4+2', consume: true}};
  charWith([it]);
  X.applyItemUse(it, it.use, 9, 'rolled 3, 4');
  ck('healing from an item lands on current HP', X.character.hp.cur === 14, X.character.hp.cur);
  ck('...and one is used up', X.character.inventory[0].qty === 1);
  X.applyItemUse(it, it.use, 3, '');
  ck('the last one is removed from the inventory', X.character.inventory.length === 0,
     JSON.stringify(X.character.inventory));
  ck('...after healing for it', X.character.hp.cur === 17);
}
{
  const it = {id: 'i2', name: 'Wand of Sparks', category: 'Wand', uses: {max: 3, per: 'long', used: 0}};
  charWith([it]);
  X.applyItemUse(it, {}, 0, '');
  ck('a limited use is spent', X.character.inventory[0].uses.used === 1);
  X.applyItemUse(it, {}, 0, '');
  X.applyItemUse(it, {}, 0, '');
  ck('...and never past the maximum', X.character.inventory[0].uses.used === 3);
  ck('spending uses does not remove the item', X.character.inventory.length === 1);
}
{
  const it = {id: 'i3', name: 'Draught of Fury', category: 'Potion', use: {status: 'Poisoned'}};
  charWith([it]);
  X.applyItemUse(it, it.use, 0, '');
  ck('a status named by the item is added', X.character.statuses.length === 1 &&
     X.character.statuses[0].name === 'Poisoned' && X.character.statuses[0].active === true);
  X.applyItemUse(it, it.use, 0, '');
  ck('using it again does not duplicate the status', X.character.statuses.length === 1);
  X.character.statuses[0].active = false;
  ck('a cleared status is switched back on, not re-added',
     X.addStatusByName('poisoned') === 'reactivated' && X.character.statuses.length === 1 &&
     X.character.statuses[0].active === true);
  ck('an empty name adds nothing',
     X.addStatusByName('  ') === '' && X.character.statuses.length === 1);
}
// A flat heal has nothing to roll, so useItem applies it without a prompt.
{
  const it = {id: 'i4', name: 'Bandage', category: 'Consumable', use: {heal: '5', consume: true}, qty: 1};
  charWith([it]);
  X.useItem('i4');
  ck('a heal with no dice applies straight away', X.character.hp.cur === 10, X.character.hp.cur);
  ck('...and consumes the item', X.character.inventory.length === 0);
}
// Out of uses: nothing moves.
{
  const it = {id: 'i5', name: 'Spent Wand', category: 'Wand', uses: {max: 1, per: 'long', used: 1}};
  charWith([it]);
  X.useItem('i5');
  ck('an item with no uses left changes nothing', X.character.inventory[0].uses.used === 1 &&
     X.character.hp.cur === 5);
}

// ---------- rests give item uses back, on the same terms features get them
{
  charWith([
    {id: 'a', name: 'Long', uses: {max: 2, per: 'long', used: 2}},
    {id: 'b', name: 'Short', uses: {max: 2, per: 'short', used: 1}},
    {id: 'c', name: 'Never', uses: {max: 2, per: 'none', used: 2}},
    {id: 'd', name: 'Plain'},
  ]);
  const inv = () => X.character.inventory;
  ck('a short rest returns only short-rest uses', X.resetItemUses(['short']) === 1 &&
     inv()[1].uses.used === 0 && inv()[0].uses.used === 2);
  ck('...and leaves a manual-only charge alone', inv()[2].uses.used === 2);
  ck('a long rest returns both', X.resetItemUses(['short', 'long']) === 1 && inv()[0].uses.used === 0);
  ck('...still leaving the manual-only charge', inv()[2].uses.used === 2);
  ck('nothing to reset counts as nothing', X.resetItemUses(['short', 'long']) === 0);
}
{
  charWith([{id: 'a', name: 'Wand', uses: {max: 2, per: 'long', used: 2}}]);
  X.longRest();
  ck('longRest itself resets item uses', X.character.inventory[0].uses.used === 0);
}

// ---------- a save→load round trip must not drop any of it
{
  const it = {id: 'i9', name: 'Potion', qty: 3, category: 'Potion',
    uses: {max: 2, per: 'short', used: 1}, use: {heal: '2d4+2', status: 'Blessed', consume: true}};
  const back = X.migrate(JSON.parse(JSON.stringify(X.migrate({inventory: [it]}))));
  ck('item uses survive a save and load',
     JSON.stringify(back.inventory[0].uses) === JSON.stringify(it.uses));
  ck('...and so does what using it does',
     JSON.stringify(back.inventory[0].use) === JSON.stringify(it.use));
  const off = X.migrate(JSON.parse(JSON.stringify(X.migrate({inventory: [{id: 'x', use: {off: true}}]}))));
  ck('...including an explicit "not usable"', off.inventory[0].use.off === true);
}

/* ================= the Concentrating condition (issue #37) ===================
   Concentration is stored once — as the active spell — and the condition mirrors
   it. Both directions are asserted here: casting puts the condition on the
   sheet, and clearing the condition ends the spell. The third case is the one
   that goes wrong quietly: the spell ending by some OTHER route (replaced,
   expired, deleted) must not leave the condition stranded. */
{
  const caster = (spells) => {
    const c = X.blankChar();
    c.spellAbility = 'wis';
    for (let L = 1; L <= 9; L++) c.slots[L] = {total: 3, used: 0};
    c.spells = spells;
    X.character = c;
    return c;
  };
  const bless = {id: 'sp1', name: 'Bless', level: 1, conc: true, duration: '1 minute'};
  const hex = {id: 'sp2', name: 'Hex', level: 1, conc: true, duration: '1 hour'};
  const shield = {id: 'sp3', name: 'Shield', level: 1, conc: false, duration: '1 round'};
  const st = () => X.character.statuses;
  const conc = () => X.concStatusRow();

  // ---------- casting a concentration spell adds the condition
  caster([bless, hex, shield]);
  X.castSpell('sp1');
  ck('casting a concentration spell puts it on Active Spells',
     X.character.activeSpells.length === 1 && X.character.activeSpells[0].conc === true);
  ck('...and adds the Concentrating condition', st().length === 1 && st()[0].name === 'Concentrating');
  ck('...linked to that spell, not matched by name',
     conc() && conc().concId === X.character.activeSpells[0].id, JSON.stringify(st()));
  ck('...saying which spell it is', /Bless/.test(conc().description), conc().description);
  ck('...active, so the sheet shows it as held', conc().active === true);
  ck('the condition carries no effects — concentration is prose, not a number',
     Array.isArray(conc().effects) && conc().effects.length === 0);

  // ---------- a non-concentration spell adds nothing
  X.castSpell('sp3');
  ck('a timed spell that needs no concentration adds no condition',
     st().length === 1 && X.character.activeSpells.length === 2);

  // ---------- a second concentration spell replaces the first, condition and all
  state.confirm = true;
  X.castSpell('sp2');
  ck('concentrating on a second spell drops the first',
     X.character.activeSpells.filter(a => a.conc).length === 1);
  ck('...leaves exactly one Concentrating condition',
     st().filter(s => s.name === 'Concentrating').length === 1);
  ck('...re-pointed at the new spell',
     conc().concId === X.character.activeSpells.find(a => a.conc).id);
  ck('...and re-described, so it never names the spell that ended',
     /Hex/.test(conc().description) && !/Bless/.test(conc().description), conc().description);

  // ---------- ending the spell from Active Spells clears the condition
  X.endActiveSpell(X.character.activeSpells.find(a => a.conc).id);
  ck('ending the active spell removes the condition, never strands it',
     X.concStatusRow() === null && st().length === 0);
  ck('...and leaves the other active spell alone', X.character.activeSpells.length === 1);

  // ---------- the other direction: clearing the condition ends the spell
  caster([bless]);
  X.castSpell('sp1');
  const ended = X.endConcentration();
  ck('clearing the condition ends the spell it was linked to',
     !!ended && ended.name === 'Bless' && X.character.activeSpells.length === 0);
  ck('...and takes the condition with it', st().length === 0);

  // ---------- and it asks first, because a lost spell cannot be given back
  caster([bless]);
  X.castSpell('sp1');
  state.confirm = false;
  ck('saying no to the prompt changes nothing', X.endConcFromStatus() === false
     && X.character.activeSpells.length === 1 && st().length === 1);
  state.confirm = true;
  ck('saying yes ends both', X.endConcFromStatus() === true
     && X.character.activeSpells.length === 0 && st().length === 0);

  // ---------- the spell running out of time
  caster([bless]);
  X.castSpell('sp1');
  X.bumpActive(X.character.activeSpells[0], 600);   // 1 minute, well past
  ck('a spell that reaches its duration takes the condition with it',
     X.character.activeSpells.length === 0 && st().length === 0);

  // ---------- a stranded link is reconciled, not left showing
  caster([bless]);
  X.character.statuses = [{id: 'x1', name: 'Concentrating', description: 'on something', effects: [], active: true, concId: 'gone'}];
  X.syncConcStatus();
  ck('a condition whose spell is no longer running is removed on sync', st().length === 0);

  // ---------- a sheet saved mid-concentration before this existed gains the condition
  caster([bless]);
  X.character.activeSpells = [{id: 'act9', spellId: 'sp1', name: 'Bless', level: 1, conc: true, elapsedSec: 0, durationSec: 60}];
  X.syncConcStatus();
  ck('an older sheet still concentrating gains the condition on load',
     st().length === 1 && conc().concId === 'act9');

  // ---------- a hand-typed "Concentrating" is adopted, not duplicated
  caster([bless]);
  X.character.statuses = [{id: 'own', name: 'Concentrating', description: 'my own note', effects: [], active: true}];
  X.castSpell('sp1');
  ck('a status the player typed is adopted rather than doubled',
     st().length === 1 && st()[0].id === 'own');
  ck('...gaining the link', st()[0].concId === X.character.activeSpells[0].id);
  ck('...and keeping the note the player wrote', st()[0].description === 'my own note');

  // ---------- syncing repeatedly is a no-op, not a pile of rows
  X.syncConcStatus(); X.syncConcStatus();
  ck('reconciling twice adds nothing', st().length === 1);

  // ---------- other statuses are never touched
  caster([bless]);
  X.character.statuses = [{id: 'p', name: 'Poisoned', description: '', effects: [], active: true}];
  X.castSpell('sp1');
  ck('an unrelated status survives casting', st().length === 2 && st()[0].name === 'Poisoned');
  X.endConcentration();
  ck('...and survives the concentration ending', st().length === 1 && st()[0].name === 'Poisoned');

  // ---------- save -> load
  caster([bless]);
  X.castSpell('sp1');
  const back = X.migrate(JSON.parse(JSON.stringify(X.character)));
  ck('the link survives a save and load',
     back.statuses[0].concId === back.activeSpells[0].id, JSON.stringify(back.statuses));
  ck('a blank character has no statuses and nothing to concentrate on',
     X.blankChar().statuses.length === 0 && X.blankChar().activeSpells.length === 0);

  // ---------- an old status without the field is left entirely alone
  const old = X.migrate({statuses: [{id: 's', name: 'Prone', active: true}]});
  ck('a status saved before the field exists has no link, and still loads',
     old.statuses[0].concId === undefined && old.statuses[0].name === 'Prone');

  X.character = X.blankChar();
}

/* ---------- game-icons emblems ----------
   The emblem is looked up by NAME, never by _id, so it must resolve with NO
   rules pack loaded at all — that is the whole reason it is keyed this way. */
{
  const svg = X.iconSVG('races', 'Elf');
  ck('a mapped name yields an svg', /^<svg /.test(svg), svg.slice(0, 40));
  ck('the emblem carries the .gicon class', /class="gicon"/.test(svg));
  ck('the emblem uses the 512 viewBox', /viewBox="0 0 512 512"/.test(svg));
  ck('the emblem is hidden from assistive tech', /aria-hidden="true"/.test(svg));
  ck('the emblem is not focusable', /focusable="false"/.test(svg));
  ck('no upstream white fill survives', !/fill="#fff"/.test(svg));
  ck('no background square survives', !svg.includes('M0 0h512v512H0z'));

  ck('lookup is case-insensitive', X.iconSVG('races', 'elf') === svg);
  ck('lookup trims', X.iconSVG('races', '  Elf  ') === svg);
  ck('a modifier class is appended', /class="gicon lg"/.test(X.iconSVG('races', 'Elf', 'lg')));

  ck('an unmapped custom name yields nothing', X.iconSVG('classes', 'Rune Knight of Nowhere') === '');
  ck('a blank name yields nothing', X.iconSVG('classes', '') === '');
  ck('a null name yields nothing', X.iconSVG('classes', null) === '');
  ck('subclasses deliberately have no emblems', X.iconSVG('subclasses', 'Champion') === '');
  ck('an unknown kind yields nothing', X.iconSVG('nonsense', 'Elf') === '');

  ck('all three kinds are mapped',
     ['classes', 'races', 'backgrounds'].every(k => Object.keys(X.ICON_MAP[k] || {}).length > 0));
  const dangling = [];
  Object.entries(X.ICON_MAP).forEach(([k, m]) =>
    Object.entries(m).forEach(([n, slug]) => { if (!X.GAME_ICONS[slug]) dangling.push(k + '.' + n); }));
  ck('no ICON_MAP entry points at a missing glyph', dangling.length === 0, dangling.join(', '));
  ck('every ICON_MAP key is already lower-case',
     Object.values(X.ICON_MAP).every(m => Object.keys(m).every(n => n === n.toLowerCase())));
}

/* ---- combat view: which sections, in what order, and combat state ----
   Design: src/docs/specs/2026-09-24-combat-view-design.md §3. */
{
  const D = ['vitals', 'statuses', 'attacks', 'resources', 'slots', 'activespells'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  ck('the defaults are the six sheet-order sections', same(X.COMBAT_DEFAULTS, D));
  ck('a new character gets the defaults', same(X.blankChar().combatSections, D));
  ck('...as its own copy, so editing one character cannot edit the defaults', (() => {
    X.blankChar().combatSections.push('coins'); return same(X.blankChar().combatSections, D);
  })());
  ck('a new character is not in combat',
     X.blankChar().combatActive === false && X.blankChar().combatRound === 0);

  ck('a missing list resolves to the defaults', same(X.combatSectionsOf({}), D));
  ck('null and a string resolve to the defaults too',
     same(X.combatSectionsOf({combatSections: null}), D) &&
     same(X.combatSectionsOf({combatSections: 'attacks'}), D));
  ck('unknown keys, non-strings and repeats are dropped; order is kept',
     same(X.combatSectionsOf({combatSections: ['attacks', 'nope', 7, 'vitals', 'attacks']}),
          ['attacks', 'vitals']));
  ck('an EMPTY list is a real choice and stays empty', same(X.combatSectionsOf({combatSections: []}), []));
  ck('the resolver never hands back the stored array itself', (() => {
    const c = {combatSections: ['coins']}; return X.combatSectionsOf(c) !== c.combatSections;
  })());

  ck('adding appends at the end', same(X.withCombatSection(['vitals'], 'coins', true), ['vitals', 'coins']));
  ck('adding one already there changes nothing', same(X.withCombatSection(['vitals'], 'vitals', true), ['vitals']));
  ck('removing keeps the rest in order',
     same(X.withCombatSection(['vitals', 'coins', 'attacks'], 'coins', false), ['vitals', 'attacks']));
  ck('removing one that is not there changes nothing',
     same(X.withCombatSection(['vitals'], 'coins', false), ['vitals']));

  ck('first to last', same(X.moveCombatSection(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']));
  ck('last to first', same(X.moveCombatSection(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']));
  ck('a target past the end lands last', same(X.moveCombatSection(['a', 'b', 'c'], 0, 9), ['b', 'c', 'a']));
  ck('a source out of range changes nothing', same(X.moveCombatSection(['a', 'b'], 5, 0), ['a', 'b']));
  ck('a one-item list is left alone', same(X.moveCombatSection(['a'], 0, 0), ['a']));
  ck('moving never edits the list it was given', (() => {
    const l = ['a', 'b']; X.moveCombatSection(l, 0, 1); return same(l, ['a', 'b']);
  })());

  ck('only a real true means in combat',
     X.inCombat({combatActive: true}) && !X.inCombat({combatActive: 'true'}) &&
     !X.inCombat({}) && !X.inCombat(null));
  const c = X.blankChar(); c.combatRound = 5;
  c.activeSpells = [{id: 'h', name: 'Haste', conc: true, durationSec: 60, elapsedSec: 30}];
  X.combatStart(c);
  ck('Start combat begins at round 1 whatever the old counter said',
     c.combatActive === true && c.combatRound === 1);
  c.combatRound = 7;
  const r = X.combatEnd(c);
  ck('End combat stops it and resets the round', c.combatActive === false && c.combatRound === 0);
  ck('...counting the round being ended as finished', r.rounds === 7 && r.sec === 42);
  ck('...and leaves active spells running', c.activeSpells.length === 1 && c.activeSpells[0].elapsedSec === 30);

  ck('in-game time counts from the start of round 1',
     X.combatElapsedSec({combatRound: 1}) === 0 && X.combatElapsedSec({combatRound: 3}) === 12 &&
     X.combatElapsedSec({combatRound: 0}) === 0);
  [[0, '0 sec'], [12, '12 sec'], [60, '1 min'], [66, '1 min 6 sec'], [3600, '1 hr'], [3840, '1 hr 4 min']]
    .forEach(([s, want]) => ck(`${s} s reads "${want}"`, X.fmtCombatTime(s) === want, X.fmtCombatTime(s)));

  const saved = X.migrate(JSON.parse(JSON.stringify(X.migrate(
    {id: 'cv1', combatSections: ['coins', 'attacks'], combatActive: true, combatRound: 4}))));
  ck('a save → load round trip keeps the list, its order and the combat state',
     same(saved.combatSections, ['coins', 'attacks']) && saved.combatActive === true && saved.combatRound === 4);
  const old = X.migrate({id: 'cv-old'});
  ck('a sheet saved before the combat view is not in combat and gets the defaults',
     !X.inCombat(old) && same(X.combatSectionsOf(old), D));
}

/* ---- rounds: in combat the floor is round 1 ---- */
{
  const bless = () => ({id: 'b', name: 'Bless', level: 1, conc: true, durationSec: 60, elapsedSec: 0});
  const c = X.blankChar(); c.activeSpells = [bless()]; X.character = c; X.combatStart(c);
  X.advanceRound(1);
  ck('next round moves the round on', c.combatRound === 2);
  ck('...and every active spell gains 6 seconds', c.activeSpells[0].elapsedSec === 6);
  X.advanceRound(-1);
  ck('previous round takes them back off', c.combatRound === 1 && c.activeSpells[0].elapsedSec === 0);
  c.activeSpells[0].elapsedSec = 12;
  X.advanceRound(-1);
  ck('in combat, previous at round 1 moves nothing — not the round, not the spells',
     c.combatRound === 1 && c.activeSpells[0].elapsedSec === 12);

  const o = X.blankChar(); o.activeSpells = [bless()]; o.activeSpells[0].elapsedSec = 12; X.character = o;
  X.advanceRound(-1);
  ck('out of combat nothing changes: the round floors at 0 and spells still step back',
     o.combatRound === 0 && o.activeSpells[0].elapsedSec === 6);
}

ck('the combat button has its crossed swords', X.iconSVG('ui', 'Combat').includes('<path d="M'));

/* ---- the tab-bar button ---- */
{
  const idle = X.combatButtonHTML({combatActive: false, combatRound: 4});
  ck('idle, the button is the crossed swords alone', idle.includes('<svg') && !/Rd/.test(idle));
  const on = X.combatButtonHTML({combatActive: true, combatRound: 3});
  ck('in combat it carries the round, reading "Rd 3"',
     on.includes('<svg') && on.replace(/<svg[\s\S]*<\/svg>/, '').replace(/<[^>]+>/g, '') === 'Rd 3');
  // A phone-width tab bar hides the word and keeps the number (45-combat.css),
  // so "Rd " must be its own element and the number must sit outside it.
  ck('"Rd " is its own span, so a phone can drop it and keep the number',
     on.includes('<span class="cv-rd"><span class="cv-rdw">Rd </span>3</span>'));
}

/* ---- the per-card toggle, and the view's header ---- */
{
  const off = X.combatToggleHTML('attacks', false), on = X.combatToggleHTML('attacks', true);
  ck('the toggle carries its section and its state',
     off.includes('data-combatbtn="attacks"') && off.includes('aria-pressed="false"') &&
     on.includes('aria-pressed="true"') && on.includes('class="cvbtn on"') && off.includes('class="cvbtn"'));
  ck('it says what it will do, and to which card',
     off.includes('Add to combat view — Attacks &amp; Weapons') &&
     on.includes('Remove from combat view — Attacks &amp; Weapons'));
  ck('it wears the crossed swords', off.includes('class="gicon cvicon"'));
  // paintCombatToggle() repaints a clicked toggle in place from the same text,
  // so the two can never say different things.
  const tOff = X.combatToggleText('attacks', false), tOn = X.combatToggleText('attacks', true);
  ck('the in-place repaint says what the markup says',
     tOff.title === 'Add to combat view' && tOn.title === 'Remove from combat view' &&
     tOn.label === 'Remove from combat view — Attacks & Weapons' &&
     on.includes('title="Remove from combat view"'));
  const h = X.combatHeaderHTML({combatActive: false, combatRound: 0});
  ck('the header can always close, and says combat keeps going',
     h.includes('id="cvClose"') && /combat keeps going/.test(h));
  ck('the header has its own ☰', h.includes('id="cvToc"'));
}

/* ---- the tracker in the view's header ---- */
{
  const idle = X.combatHeaderHTML({combatActive: false, combatRound: 5});
  ck('out of combat the header offers Start combat, and no arrows or End',
     idle.includes('id="cvStart"') && !idle.includes('id="cvNext"') && !idle.includes('id="cvEnd"'));
  const r3 = X.combatHeaderHTML({combatActive: true, combatRound: 3});
  ck('in combat: round, in-game time, both arrows and End — and no Start',
     r3.includes('Round <b>3</b><span class="cv-sep"> · </span><span class="cv-time">12 sec</span>') &&
     r3.includes('id="cvPrev"') && r3.includes('id="cvNext"') &&
     r3.includes('id="cvEnd"') && !r3.includes('id="cvStart"'));
  ck('the repainted header is no live region — #cvLive in the shell is',
     !/aria-live/.test(r3) && !/aria-live/.test(idle));
  ck('◀ is live after round 1', !/id="cvPrev"[^>]*disabled/.test(r3));
  ck('◀ is disabled at round 1',
     /id="cvPrev"[^>]*disabled/.test(X.combatHeaderHTML({combatActive: true, combatRound: 1})));
  ck('End sits apart from the arrows',
     r3.indexOf('id="cvNext"') < r3.indexOf('class="grow"') && r3.indexOf('class="grow"') < r3.indexOf('id="cvEnd"'));
  ck('the header can still close and still has ☰', r3.includes('id="cvClose"') && r3.includes('id="cvToc"'));

  const c = X.blankChar(); c.combatRound = 4; X.character = c;
  X.startCombatNow();
  ck('Start combat, from the header, begins at round 1', X.inCombat(c) && c.combatRound === 1);
  c.combatRound = 7; state.confirm = false;
  ck('End combat asks first, naming the round',
     X.endCombatAsk() === false && state.lastConfirm === 'End combat at round 7?');
  ck('...and saying no leaves the fight running', X.inCombat(c) && c.combatRound === 7);
  state.confirm = true;
  ck('saying yes ends it', X.endCombatAsk() === true && !X.inCombat(c) && c.combatRound === 0);
}

/* ---- arranging ---- */
{
  const g = X.combatGripHTML('vitals');
  ck('the grip is a real button, named for its card and its keys',
     g.startsWith('<button') && g.includes('data-cvgrip="vitals"') && /Move Vitals — ↑ and ↓/.test(g));
  const c = X.blankChar(); X.character = c;
  X.moveCombatCard('vitals', 1);
  ck('↓ moves a section one place later', JSON.stringify(c.combatSections.slice(0, 2)) === '["statuses","vitals"]');
  X.moveCombatCard('vitals', -1);
  ck('↑ moves it back', c.combatSections[0] === 'vitals');
  X.moveCombatCard('vitals', -1);
  ck('↑ at the top does nothing', c.combatSections[0] === 'vitals' && c.combatSections.length === 6);
  X.moveCombatCard('coins', 1);
  ck('a section not in the view cannot be moved', c.combatSections.indexOf('coins') < 0);
}

/* ---- removing a section offers Undo, and Undo puts it back where it was ----
   Active Spells and Familiars hide themselves on their tab when empty, so their
   toggle cannot bring them back — the Undo on the removal toast is the way back. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ck('insert puts a section back at its old place', same(X.insertCombatSection(['a', 'c'], 'b', 1), ['a', 'b', 'c']));
  ck('...clamps a stale position to the end', same(X.insertCombatSection(['a'], 'b', 9), ['a', 'b']));
  ck('...never adds a second copy', same(X.insertCombatSection(['a', 'b'], 'b', 0), ['a', 'b']));
  ck('...and never edits the list it was given', (() => {
    const l = ['a']; X.insertCombatSection(l, 'b', 0); return same(l, ['a']);
  })());

  const c = X.blankChar(); X.character = c;
  X.toggleCombatSection('attacks');
  ck('removing takes the section out', !c.combatSections.includes('attacks'));
  X.undoCombatRemove('attacks', 2, c.id);
  ck('Undo puts it back in the same place', same(c.combatSections, X.COMBAT_DEFAULTS));
  X.undoCombatRemove('attacks', 2, c.id);
  ck('a second Undo changes nothing', same(c.combatSections, X.COMBAT_DEFAULTS));

  X.toggleCombatSection('activespells');
  const other = X.blankChar(); other.combatSections = ['vitals']; X.character = other;
  X.undoCombatRemove('activespells', 5, c.id);
  ck('an Undo that outlived a character switch does nothing to the new character',
     same(other.combatSections, ['vitals']) && !c.combatSections.includes('activespells'));
}

/* ---- ↑/↓ step past the next SHOWN section ----
   Skills in By ability mode is hidden in the view but keeps its slot; an arrow
   press that only swapped with it would look like nothing happened. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const all = () => true, noSkills = k => k !== 'skills';
  ck('↑ moves one place when nothing is hidden', same(X.stepCombatSection(['a', 'b', 'c'], 'b', -1, all), ['b', 'a', 'c']));
  ck('↓ moves one place when nothing is hidden', same(X.stepCombatSection(['a', 'b', 'c'], 'b', 1, all), ['a', 'c', 'b']));
  ck('↑ passes a hidden section and the shown one above it',
     same(X.stepCombatSection(['vitals', 'skills', 'attacks'], 'attacks', -1, noSkills), ['attacks', 'vitals', 'skills']));
  ck('↓ passes a hidden section and the shown one below it',
     same(X.stepCombatSection(['attacks', 'skills', 'vitals'], 'attacks', 1, noSkills), ['skills', 'vitals', 'attacks']));
  ck('with only hidden sections above, ↑ changes nothing',
     same(X.stepCombatSection(['skills', 'attacks'], 'attacks', -1, noSkills), ['skills', 'attacks']));
  ck('the ends change nothing',
     same(X.stepCombatSection(['a', 'b'], 'a', -1, all), ['a', 'b']) && same(X.stepCombatSection(['a', 'b'], 'b', 1, all), ['a', 'b']));
  ck('a section not in the list changes nothing', same(X.stepCombatSection(['a'], 'z', 1, all), ['a']));
  ck('stepping never edits the list it was given', (() => {
    const l = ['a', 'b']; X.stepCombatSection(l, 'a', 1, all); return same(l, ['a', 'b']);
  })());
}

/* ---- after a keyboard removal, Tab/Esc go to the next SHOWN card ----
   Worked out from the shown cards before the removal, so a hidden Skills card in
   the saved order cannot shift it onto the wrong grip. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ck('the card that followed it, then the one before',
     same(X.cvNeighbours(['vitals', 'attacks', 'resources'], 'attacks'), ['resources', 'vitals']));
  ck('the last card has only the one before', same(X.cvNeighbours(['vitals', 'attacks'], 'attacks'), [null, 'vitals']));
  ck('the first card has only the one after', same(X.cvNeighbours(['attacks', 'vitals'], 'attacks'), ['vitals', null]));
  ck('a lone card has neither', same(X.cvNeighbours(['vitals'], 'vitals'), [null, null]));
  ck('a card not shown has neither', same(X.cvNeighbours(['vitals'], 'skills'), [null, null]));
}

/* ---- the journal: its fields, and what migrate() does to them ----
   Design: src/docs/specs/2026-09-29-journal-design.md §3. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const b = X.blankChar();
  ck('a new character has an empty journal and no shut groups', same(b.journal, []) && same(b.journalCollapse, {}));
  ck('...each its own copy', (() => { X.blankChar().journal.push({}); return X.blankChar().journal.length === 0; })());
  const page = {id: 'p1', title: 'Session 1', tag: 'Sessions', text: 'We met **Brindle**.', at: 100, editedAt: 200};
  const back = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {journal: [page], journalCollapse: {sessions: true}}))));
  ck('a save → load round trip keeps every page field', same(back.journal, [page]));
  ck('...and the shut groups', same(back.journalCollapse, {sessions: true}));
  const old = X.migrate({name: 'Before the journal', abilities: {}});
  ck('a sheet saved before the journal gets an empty one', same(old.journal, []) && same(old.journalCollapse, {}));
  const junk = X.migrate({abilities: {}, journalCollapse: 'shut',
    journal: [null, 'text', 7, ['arr'], {title: 'kept'}, {id: 5, title: 'numbered'}, {id: 'p1'}, {id: 'p1'}]});
  ck('only page objects survive — not an array, which the list guard lets through', junk.journal.length === 4, junk.journal);
  ck('a page with no id gets one', typeof junk.journal[0].id === 'string' && junk.journal[0].id.length > 0);
  ck('a numeric id becomes text', junk.journal[1].id === '5');
  ck('a repeated id is replaced, so Edit and Delete find one page', junk.journal[2].id === 'p1' && junk.journal[3].id !== 'p1');
  ck('a junk collapse map resets', same(junk.journalCollapse, {}));
  ck('migrate() stays idempotent over the journal', JSON.stringify(X.migrate(JSON.parse(JSON.stringify(junk)))) === JSON.stringify(junk));
  ck('repairIds leaves a clean list as it is', (() => { const l = [{id: 'a'}, {id: 'b'}]; X.repairIds(l); return same(l, [{id: 'a'}, {id: 'b'}]); })());
  ck('repairIds can share one pool across lists', (() => {
    const s = new Set(), l1 = [{id: 'a'}], l2 = [{id: 'a'}];
    X.repairIds(l1, s); X.repairIds(l2, s); return l1[0].id === 'a' && l2[0].id !== 'a';
  })());
}

/* ---- dialogs: what auto-focus may pick, and how the opener is found again ---- */
{
  const F = X.MODAL_FOCUS_FIELDS;
  ck('dialog auto-focus never picks a dropdown — type-ahead on the rules-pack picker rewrote the whole form',
     !/select/.test(F));
  ck('...nor a checkbox, radio or file input', !/checkbox|radio|file/.test(F));
  ck('...but does pick text boxes and text areas',
     F.includes('input:not([type])') && F.includes('input[type=text]') && F.includes('textarea'));
  const el = (id, attrs) => ({id, attributes: Object.entries(attrs || {}).map(([name, value]) => ({name, value}))});
  ck('an opener with an id is found again by it', X.openerSelector(el('btnSettings')) === '[id="btnSettings"]');
  ck('...otherwise by its first data-* hook',
     X.openerSelector(el('', {class: 'add', 'data-edit-attack': 'a1'})) === '[data-edit-attack="a1"]');
  ck('...and one with neither has no way back', X.openerSelector(el('', {class: 'x'})) === null);
  ck('no opener, no selector', X.openerSelector(null) === null);
  ck('a quote in a hook value cannot break the selector',
     X.openerSelector(el('', {'data-x': 'a"b'})) === '[data-x="a\\"b"]');
}

/* ---- the item finder's quantity (issue #50) ----
   One Qty box for everything ticked, like Origin and Cost. A new item arrives as
   one stack of N; one already carried gains N. Cost stays the price of ONE —
   inventoryTotal() already multiplies by the quantity. */
{
  [['3', 3], [7, 7], ['', 1], [null, 1], ['0', 1], ['-2', 1], ['abc', 1], ['2.7', 2], ['5000', 999]]
    .forEach(([raw, want]) => ck(`Qty ${JSON.stringify(raw)} counts as ${want}`, X.finderQty(raw) === want, X.finderQty(raw)));

  const c = X.blankChar(); X.character = c;
  const torch = {name: 'Torch', category: 'Adventuring Gear', cost: '1 cp', weight: 1, description: 'Light.'};
  X.addLibraryItems([torch], null, null, 3);
  const t = () => c.inventory.filter(i => i.name === 'Torch');
  ck('a new item arrives as one stack of N', t().length === 1 && t()[0].qty === 3);
  ck('...priced per item, not per stack', t()[0].cost === 0.01);
  X.addLibraryItems([torch], null, null, 2);
  ck('an item already carried gains N, with no second entry', t().length === 1 && t()[0].qty === 5);
  X.addLibraryItems([{name: 'torch'}], null, null, undefined);
  ck('the same name in another case is the same stack, and no Qty means 1', t().length === 1 && t()[0].qty === 6);

  const rope = {name: 'Rope', cost: '1 gp'}, oil = {name: 'Oil', cost: '1 sp'};
  X.addLibraryItems([rope, oil], {kind: 'purchased', detail: 'market'}, 4, 2);
  const r = c.inventory.find(i => i.name === 'Rope'), o = c.inventory.find(i => i.name === 'Oil');
  ck('every ticked item gets the same quantity', r.qty === 2 && o.qty === 2);
  ck('a typed Cost is the price of one of each', r.cost === 4 && o.cost === 4);
  ck('the origin applies to each new stack', r.origin && r.origin.kind === 'purchased' && o.origin.detail === 'market');

  const sword = {name: 'Longsword', category: 'Weapon', cost: '15 gp',
    weapon: {kind: 'melee', ability: 'str', dice: '1d8', damageType: 'slashing'}};
  const atkBefore = c.attacks.length;
  X.addLibraryItems([sword], null, null, 3);
  const s = c.inventory.find(i => i.name === 'Longsword');
  ck('three weapons are one stack of three with one linked attack',
     s.qty === 3 && c.attacks.length === atkBefore + 1 && s.attackId === c.attacks[c.attacks.length - 1].id);
}

/* ---- coins read high to low (issue #48) ----
   The Coins card and the Adjust coins window both lay the boxes out in
   coinKeys() order; the printout already ran PP → CP. */
{
  X.character = X.blankChar(); X.character.system = 'dnd';
  ck('D&D coins read high to low: PP GP EP SP CP', JSON.stringify(X.coinKeys()) === '["pp","gp","ep","sp","cp"]', X.coinKeys());
  X.character.system = 'humblewood';
  ck('Humblewood coins read high to low: GP SP CP', JSON.stringify(X.coinKeys()) === '["gp","sp","cp"]', X.coinKeys());
}

/* ---- a pack's +N weapon adds its bonus once, to its own attack (#74) ----
   Read from the SHIPPED packs and added the way the item finder adds them. The
   packs used to carry the bonus twice — on the weapon (atkMisc/dmgMisc) and as
   global attack/damage effects on the item — so the Dagger of Venom's own row
   read +2 over its base, and every other attack, spell rows included, gained +1
   while it was equipped. attackNumbers() is right to add both: a weapon's own
   bonus and an equipped item's effect are different things. The data was wrong. */
{
  const pack = (dir, f) => JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', dir, f), 'utf8')).items;
  const core = pack('5e2024', 'items.json'), magic = pack('5e2024', 'items-magic.json'), tce = pack('tashas', 'items-magic.json');
  const def = (list, name) => list.find(x => x.name === name);
  const c = X.blankChar(); X.character = c;
  c.abilities.str = 10; c.abilities.dex = 16; c.level = 1;                    /* STR +0, DEX +3, PB +2 */
  X.addLibraryItems([def(magic, 'Dagger of Venom'), def(core, 'Club')], null, null, 1);
  c.attacks.push({id: 'fb', name: 'Fire Bolt', kind: 'ranged', ability: 'int', proficient: true, atkMisc: '', dmgMisc: '',
                  damageDice: '1d10', damageType: 'fire', addAbilityDamage: false, spellId: 's1', source: 'spell'});
  const row = name => c.attacks.find(a => a.name === name);
  const dagger = c.inventory.find(i => i.name === 'Dagger of Venom');
  ck('#74 the Dagger of Venom arrives equipped, with its attack', !!dagger && dagger.equipped === true && !!row('Dagger of Venom'));
  let n = X.attackNumbers(row('Dagger of Venom'));
  ck('#74 its own row adds its +1 once: DEX 3 + PB 2 + 1 = +6 to hit', n.toHit === 6, n);
  ck('#74 ...and 3 + 1 = +4 to damage', n.dmgBonus === 4, n);
  ck('#74 ...none of it from an effect', n.atkFx === 0 && n.dmgFx === 0, n);
  n = X.attackNumbers(row('Club'));
  ck('#74 a Club beside it is untouched: STR 0 + PB 2 = +2 to hit, +0 damage', n.toHit === 2 && n.dmgBonus === 0, n);
  n = X.attackNumbers(row('Fire Bolt'));
  ck('#74 ...and so is a spell row: INT 0 + PB 2 = +2', n.toHit === 2 && n.dmgBonus === 0, n);
  dagger.equipped = false;
  ck('#74 unequipping the dagger changes no other row',
     X.attackNumbers(row('Club')).toHit === 2 && X.attackNumbers(row('Fire Bolt')).toHit === 2);
  /* Tasha's: a STR weapon, so the +3 reads on its own */
  const c2 = X.blankChar(); X.character = c2;
  c2.abilities.str = 10; c2.abilities.dex = 10; c2.level = 1;
  X.addLibraryItems([def(tce, '+3 Moon Sickle'), def(core, 'Club')], null, null, 1);
  n = X.attackNumbers(c2.attacks.find(a => a.name === '+3 Moon Sickle'));
  ck('#74 Tasha\'s +3 Moon Sickle: PB 2 + 3 = +5 to hit, +3 damage', n.toHit === 5 && n.dmgBonus === 3, n);
  n = X.attackNumbers(c2.attacks.find(a => a.name === 'Club'));
  ck('#74 ...and its Club stays at +2', n.toHit === 2 && n.dmgBonus === 0, n);
  X.character = X.blankChar();
}

/* ---- a Dart uses the better of STR and DEX, and is still a ranged attack (#75) ----
   The shipped Dart, added through the finder. The pack gave every ranged weapon
   "dex", ignoring Finesse, so a strong thrower's Dart used the weaker score.
   attackNumbers() already reads "finesse" the same way for any kind; the row's
   kind stays ranged, so a ranged-only effect (Archery) still applies. */
{
  const core = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', '5e2024', 'items.json'), 'utf8')).items;
  const dartDef = core.find(x => x.name === 'Dart');
  const withDart = (str, dex) => {
    const c = X.blankChar(); X.character = c;
    c.abilities.str = str; c.abilities.dex = dex; c.level = 1;
    X.addLibraryItems([dartDef], null, null, 10);
    return c.attacks.find(a => a.name === 'Dart');
  };
  let row = withDart(18, 12), n = X.attackNumbers(row);
  ck('#75 a strong thrower\'s Dart uses STR: STR 4 + PB 2 = +6 to hit, +4 damage',
     n.abilName === 'STR' && n.toHit === 6 && n.dmgBonus === 4, n);
  ck('#75 ...and is still a ranged attack', row.kind === 'ranged' && n.kind === 'ranged', [row.kind, n.kind]);
  row = withDart(10, 16); n = X.attackNumbers(row);
  ck('#75 a nimble one\'s uses DEX: DEX 3 + PB 2 = +5 to hit, +3 damage',
     n.abilName === 'DEX' && n.toHit === 5 && n.dmgBonus === 3, n);
  X.character.features.push({id: 'arch', name: 'Archery', effects: [{target: 'attack.ranged', value: 2}], enabled: true});
  ck('#75 ...and a ranged-only effect still reaches it (Archery +2 → +7)', X.attackNumbers(row).toHit === 7, X.attackNumbers(row));
  X.character = X.blankChar();
}

/* The numbers recompute() actually paints, read off the ids it writes. The
   harness DOM swallows every write; this swaps in a recorder for the named ids
   for one recompute() and hands back their text. */
const painted = ids => {
  const got = {}, real = ctx.document.getElementById;
  const el = () => { const e = {textContent: '', fx: false};
    e.classList = {toggle: (k, on) => { if (k === 'fx-on') e.fx = !!on; }, add: () => {}, remove: () => {}, contains: () => false};
    return e; };
  ctx.document.getElementById = id => ids.includes(id) ? (got[id] = got[id] || el()) : real(id);
  try { X.recompute(); } finally { ctx.document.getElementById = real; }
  const o = {}; ids.forEach(i => { o[i] = got[i] ? String(got[i].textContent) : undefined; });
  painted.fx = {}; ids.forEach(i => { painted.fx[i] = !!(got[i] && got[i].fx); });   /* marked .fx-on? */
  return o;
};
/* what a modal would have shown: its title and body */
const shownModal = fn => {
  const real = ctx.openModal; let got = null;
  ctx.openModal = (t, b) => { got = {t: String(t), b: String(b)}; };
  try { fn(); } finally { ctx.openModal = real; }
  return got || {t: '', b: ''};
};
const shippedItems = (dir, f) => JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', dir, f), 'utf8')).items;

/* ---- a bonus the book gives only in a moment does not raise AC (#76) ----
   The SHIPPED items, added the way the item finder adds them. Quarterstaff of
   the Acrobat's +5 is a Reaction against one attack, once per rest, and the
   pack wrote it as a standing `ac` effect, so equipping the staff read AC +5 at
   all times. The Arrow-Catching Shield's extra +2 is against ranged attacks
   only; its ordinary +2 as a shield still counts. The Cloak of Protection is the
   control: its +1 is standing and still applies. */
{
  const magic = shippedItems('5e2024', 'items-magic.json');
  const def = name => magic.find(x => x.name === name);
  const fresh = () => { const c = X.blankChar(); X.character = c; c.abilities.dex = 14; c.level = 1; return c; };  /* 10 + DEX 2 */
  let c = fresh();
  ck('#76 unarmoured AC is 10 + DEX 2 = 12', painted(['acDisp']).acDisp === '12', painted(['acDisp']));
  X.addLibraryItems([def('Quarterstaff of the Acrobat')], null, null, 1);
  const staff = c.inventory.find(i => i.name === 'Quarterstaff of the Acrobat');
  ck('#76 the Quarterstaff of the Acrobat arrives equipped', !!staff && staff.equipped === true, staff && staff.equipped);
  ck('#76 ...and leaves AC at 12, not 17', painted(['acDisp']).acDisp === '12', painted(['acDisp']));
  ck('#76 ...its Reaction still in its description',
     /Reaction to twirl the weapon around you, gaining a \+5 bonus to your Armor Class against the triggering attack/.test(staff.description || ''));
  const row = c.attacks.find(a => a.name === 'Quarterstaff of the Acrobat');
  ck('#76 ...and its own +2 still on its attack: STR 0 + PB 2 + 2 = +4', !!row && X.attackNumbers(row).toHit === 4, row && X.attackNumbers(row));
  c = fresh();
  X.addLibraryItems([def('Arrow-Catching Shield')], null, null, 1);
  c.inventory[0].equipped = true;
  ck('#76 the Arrow-Catching Shield adds its shield +2 only: 12 + 2 = 14', painted(['acDisp']).acDisp === '14', painted(['acDisp']));
  c = fresh();
  X.addLibraryItems([def('Bracers of Defense')], null, null, 1);
  c.inventory[0].equipped = true;
  ck('#76 Bracers of Defense leave AC at 12 (their +2 needs no armor and no shield, which the sheet does not test)',
     painted(['acDisp']).acDisp === '12', painted(['acDisp']));
  c = fresh();
  X.addLibraryItems([def('Rod of Alertness')], null, null, 1);
  c.inventory[0].equipped = true;
  ck('#76 the Rod of Alertness adds nothing to AC or saves: its aura needs planting',
     painted(['acDisp']).acDisp === '12' && painted(['save-dex'])['save-dex'] === '+2',
     painted(['acDisp', 'save-dex']));
  c = fresh();
  X.addLibraryItems([def('Cloak of Protection')], null, null, 1);
  c.inventory[0].equipped = true;
  ck('#76 the control: a Cloak of Protection still gives +1 AC (13) and +1 to saves (DEX +3)',
     painted(['acDisp']).acDisp === '13' && painted(['save-dex'])['save-dex'] === '+3', painted(['acDisp', 'save-dex']));
  X.character = X.blankChar();
}

/* ---- an item's spell attack and spell save DC bonus reach every number that shows them (#77) ----
   The packs never read 5e-tools' bonusSpellAttack / bonusSpellSaveDc, and the
   app had no effect target for either, so an equipped Staff of Power or Moon
   Sickle changed nothing a caster looks at. Now they are `spell.attack` and
   `spell.dc` effects, read by spellAtkBonus()/spellDC() and so by the
   Spellcasting card, spell attack rows, save rows, the cast dialog and the
   breakdowns, and by nothing else: a weapon's row does not take them. The
   SHIPPED items, added through the finder. A caster with the ability at 16
   (+3) at level 1 (PB 2): DC 13, spell attack +5. */
{
  const magic = shippedItems('5e2024', 'items-magic.json'), tce = shippedItems('tashas', 'items-magic.json');
  const core = shippedItems('5e2024', 'items.json');
  const def = (list, name) => list.find(x => x.name === name);
  const fresh = ab => { const c = X.blankChar(); X.character = c; c.level = 1; c.abilities[ab] = 16; c.spellAbility = ab; return c; };
  const T = X.fxTargets().map(([l, t]) => t);
  ck('#77 the effect editor offers Spell attack and Spell save DC',
     T.includes('spell.attack') && T.includes('spell.dc') && X.FX_LABEL['spell.attack'] === 'Spell attack'
     && X.FX_LABEL['spell.dc'] === 'Spell save DC', [T.slice(-4), X.FX_LABEL['spell.attack'], X.FX_LABEL['spell.dc']]);
  let c = fresh('int');
  c.attacks.push({id: 'fb', name: 'Fire Bolt', kind: 'ranged', ability: 'int', proficient: true, atkMisc: '', dmgMisc: '',
                  damageDice: '1d10', damageType: 'fire', addAbilityDamage: false, spellId: 's1', source: 'spell'});
  const fireBolt = {id: 's1', name: 'Fire Bolt', level: 0, atkType: 'attack', atkKind: 'ranged', dice: '1d10', damageType: 'fire'};
  let p = painted(['dcDisp', 'satkDisp']);
  ck('#77 the base: DC 13, spell attack +5, unmarked', p.dcDisp === '13' && p.satkDisp === '+5' && !painted.fx.satkDisp, [p, painted.fx]);
  X.addLibraryItems([def(magic, 'Staff of Power'), def(core, 'Club')], null, null, 1);
  const staff = c.inventory.find(i => i.name === 'Staff of Power');
  ck('#77 the Staff of Power arrives equipped', !!staff && staff.equipped === true);
  p = painted(['dcDisp', 'satkDisp']);
  ck('#77 ...and the Spellcasting card reads spell attack +7, marked', p.satkDisp === '+7' && painted.fx.satkDisp === true, [p, painted.fx]);
  ck('#77 ...and DC 13, unmarked: the staff gives spell attack rolls only', p.dcDisp === '13' && !painted.fx.dcDisp, [p, painted.fx]);
  ck('#77 spellAtkBonus() and spellDC() agree: 7 and 13', X.spellAtkBonus() === 7 && X.spellDC() === 13, [X.spellAtkBonus(), X.spellDC()]);
  let n = X.attackNumbers(c.attacks.find(a => a.name === 'Fire Bolt'));
  ck('#77 a spell attack row takes it: INT 3 + PB 2 + 2 = +7, marked', n.toHit === 7 && n.atkFx === 2, n);
  n = X.attackNumbers(c.attacks.find(a => a.name === 'Staff of Power'));
  ck('#77 the staff\'s own weapon row does not: STR 0 + PB 2 + 2 = +4', n.toHit === 4, n);
  n = X.attackNumbers(c.attacks.find(a => a.name === 'Club'));
  ck('#77 ...nor a Club: +2', n.toHit === 2, n);
  let m = shownModal(() => X.promptSpellAttack(fireBolt, 0));
  ck('#77 the cast dialog says +7 to hit', /Spell attack:<\/b> \+7 to hit/.test(m.b), m.b.slice(0, 120));
  m = shownModal(() => X.openStatBreakdown('spell.attack'));
  ck('#77 tapping the card\'s spell attack names the staff and its +2',
     m.t === 'Spell attack breakdown' && /Staff of Power<\/span><b>\+2</.test(m.b) && /INT/.test(m.b), m);
  m = shownModal(() => X.openAttackBreakdown('fb'));
  ck('#77 ...and so does the Fire Bolt row\'s breakdown', /Staff of Power<\/span><b>\+2</.test(m.b), m.b.slice(0, 400));
  staff.equipped = false;
  p = painted(['dcDisp', 'satkDisp']);
  ck('#77 unequipped, the card is back to +5', p.satkDisp === '+5' && X.attackNumbers(c.attacks.find(a => a.name === 'Fire Bolt')).toHit === 5, p);

  /* Tasha's +3 Moon Sickle for a druid: spell attack AND DC. Its limit to
     "your druid and ranger spells" is the item's attunement; the sheet has one
     spellcasting ability, so the bonus goes on it. */
  c = fresh('wis');
  c.attacks.push({id: 'sf', name: 'Sacred Flame', spellId: 's2', source: 'spell', save: {ability: 'dex'},
                  damageDice: '1d8', damageType: 'radiant', notes: ''});
  X.addLibraryItems([def(tce, '+3 Moon Sickle')], null, null, 1);
  p = painted(['dcDisp', 'satkDisp']);
  ck('#77 a +3 Moon Sickle: DC 16 and spell attack +8, both marked',
     p.dcDisp === '16' && p.satkDisp === '+8' && painted.fx.dcDisp && painted.fx.satkDisp, [p, painted.fx]);
  m = shownModal(() => X.promptSpellAttack({id: 's2', name: 'Sacred Flame', level: 0, atkType: 'save', saveAbility: 'dex',
                                            dice: '1d8', damageType: 'radiant'}, 0));
  ck('#77 ...the cast dialog of a save spell says DC 16', /Save DC:<\/b> 16 DEX/.test(m.b), m.b.slice(0, 120));
  ck('#77 ...and a save row prints DC 16 through spellDC()', X.spellDC() === 16, X.spellDC());
  {
    /* the rows renderAttacks() builds, read off the elements it creates */
    const realC = ctx.document.createElement, realB = ctx.document.getElementById, rows = [];
    ctx.document.createElement = () => { const e = {style: {}, dataset: {}, classList: {toggle() {}, add() {}, remove() {}}}; rows.push(e); return e; };
    ctx.document.getElementById = id => id === 'attackList' ? {innerHTML: '', appendChild() {}, style: {}} : realB(id);
    try { X.renderAttacks(); } finally { ctx.document.createElement = realC; ctx.document.getElementById = realB; }
    const sf = rows.map(e => String(e.innerHTML || '')).find(h => h.includes('Sacred Flame')) || '';
    ck('#77 ...and the Sacred Flame row shows DC 16, marked as changed by an effect',
       /<span class="atk-hit fx-on">DC 16 DEX<\/span>/.test(sf), sf.slice(0, 600));
  }
  m = shownModal(() => X.openStatBreakdown('spell.dc'));
  ck('#77 ...and tapping the DC names the sickle', m.t === 'Spell save DC breakdown' && /\+3 Moon Sickle<\/span><b>\+3</.test(m.b), m);
  n = X.attackNumbers(c.attacks.find(a => a.name === '+3 Moon Sickle'));
  ck('#77 ...while the sickle\'s own row is its weapon: PB 2 + 3 = +5 to hit, +3 damage', n.toHit === 5 && n.dmgBonus === 3, n);

  /* Reveler's Concertina: the DC only, and not a weapon, so it is equipped by hand */
  c = fresh('cha');
  X.addLibraryItems([def(tce, "Reveler's Concertina")], null, null, 1);
  c.inventory[0].equipped = true;
  p = painted(['dcDisp', 'satkDisp']);
  ck('#77 Reveler\'s Concertina: DC 15, spell attack still +5', p.dcDisp === '15' && p.satkDisp === '+5' && !painted.fx.satkDisp, [p, painted.fx]);

  /* no spellcasting ability: nothing to add to */
  c = fresh('int'); c.spellAbility = '';
  X.addLibraryItems([def(magic, 'Staff of Power')], null, null, 1);
  p = painted(['dcDisp', 'satkDisp']);
  ck('#77 with no spellcasting ability the card still reads —', p.dcDisp === '—' && p.satkDisp === '—' && X.spellDC() === null, p);
  X.character = X.blankChar();
}

/* ---- a bonus to every ability check, and to the proficiency bonus (#79) ----
   The Stone of Good Luck's +1 to ability checks and the Ioun Stone of Mastery's
   +1 proficiency bonus reached no number: 5e-tools' bonusAbilityCheck and
   bonusProficiencyBonus were never read, and the app had no target for "every
   ability check". `check` reaches every skill, initiative (a Dexterity check)
   and passive Perception (10 + the Perception check), and nothing else: not the
   ability modifiers, which attacks, saves, AC and spell DCs read, and not saves,
   which the stone raises through its own save.* effects. The SHIPPED items,
   added through the finder and worn by hand (neither is a weapon). */
{
  const magic = shippedItems('5e2024', 'items-magic.json'), core = shippedItems('5e2024', 'items.json');
  const def = (list, name) => list.find(x => x.name === name);
  const SK = X.SKILLS.map(([k]) => 'skill-' + k), MODS = X.ABIL.map(([k]) => 'mod-' + k), SAVES = X.ABIL.map(([k]) => 'save-' + k);
  const IDS = SK.concat(MODS, SAVES, ['initDisp', 'passDisp', 'pbDisp', 'acDisp', 'dcDisp', 'satkDisp']);
  const T = X.fxTargets().map(([l, t]) => t);
  ck('#79 the effect editor offers Ability checks', T.includes('check') && X.FX_LABEL.check === 'Ability checks',
     [T.filter(t => !/^(ability|save|skill)\./.test(t)), X.FX_LABEL.check]);

  let c = X.blankChar(); X.character = c; c.level = 1; c.spellAbility = 'wis';
  Object.assign(c.abilities, {str: 10, dex: 14, con: 10, int: 10, wis: 12, cha: 8});
  c.skills.perception = 1; c.skills.stealth = 2;                      /* proficient; expertise */
  X.addLibraryItems([def(magic, 'Stone of Good Luck'), def(core, 'Club')], null, null, 1);
  const stone = c.inventory.find(i => i.name === 'Stone of Good Luck');
  const club = () => X.attackNumbers(c.attacks.find(a => a.name === 'Club'));
  const clubBefore = club().toHit;
  const before = painted(IDS), n = s => Number(String(s).replace('+', ''));
  ck('#79 the base: Stealth +6 (DEX 2 + PB 2 x2), Perception +3, initiative +2, passive 13',
     before['skill-stealth'] === '+6' && before['skill-perception'] === '+3' && before.initDisp === '+2' && before.passDisp === '13', before);
  ck('#79 the Stone of Good Luck arrives unworn: nothing moves', !!stone && stone.equipped === false
     && JSON.stringify(painted(IDS)) === JSON.stringify(before), stone && stone.equipped);
  stone.equipped = true;
  const after = painted(IDS), fx = painted.fx;
  const up = ids => ids.filter(i => n(after[i]) !== n(before[i]) + 1);
  ck('#79 worn, every one of the 18 skills is 1 higher', up(SK).length === 0, up(SK).map(i => i + ' ' + before[i] + ' -> ' + after[i]));
  ck('#79 ...and each is marked as changed by an effect', SK.every(i => fx[i]), SK.filter(i => !fx[i]));
  ck('#79 initiative is 1 higher (+3), marked: it is a Dexterity check', after.initDisp === '+3' && fx.initDisp, [after.initDisp, fx.initDisp]);
  ck('#79 passive Perception is 1 higher (14): 10 + the Perception check', after.passDisp === '14', after.passDisp);
  ck('#79 each save is 1 higher, from the stone\'s own saving-throw bonus only (not +2)', up(SAVES).length === 0,
     up(SAVES).map(i => i + ' ' + before[i] + ' -> ' + after[i]));
  ck('#79 the ability modifiers do not move, and are not marked: a check bonus is not the modifier',
     MODS.every(i => after[i] === before[i] && !fx[i]), MODS.map(i => i + ' ' + before[i] + ' -> ' + after[i] + (fx[i] ? ' marked' : '')));
  ck('#79 nor do the proficiency bonus, AC, spell save DC or spell attack',
     ['pbDisp', 'acDisp', 'dcDisp', 'satkDisp'].every(i => after[i] === before[i]), ['pbDisp', 'acDisp', 'dcDisp', 'satkDisp'].map(i => before[i] + ' -> ' + after[i]));
  ck('#79 nor an attack roll (the Club stays ' + clubBefore + ')', club().toHit === clubBefore, club());
  let m = shownModal(() => X.openStatBreakdown('skill.stealth'));
  ck('#79 tapping Stealth names the stone and its +1', /Stone of Good Luck[^<]*<\/span><b>\+1</.test(m.b), m.b.slice(0, 600));
  m = shownModal(() => X.openStatBreakdown('init'));
  ck('#79 ...and so does tapping initiative', /Stone of Good Luck[^<]*<\/span><b>\+1</.test(m.b), m.b.slice(0, 600));
  m = shownModal(() => X.openStatBreakdown('ability.dex'));
  ck('#79 tapping DEX names it as what a plain Dexterity check adds, not as a score change',
     /ability check/i.test(m.b) && /Stone of Good Luck[^<]*<\/span><b>\+1</.test(m.b) && /Base score 14/.test(m.b), m.b.slice(0, 600));
  c.init = '5';
  ck('#79 a typed initiative takes it too: 5 + 1 = +6', painted(['initDisp']).initDisp === '+6', painted(['initDisp']));
  c.init = '';
  stone.equipped = false;
  ck('#79 taken off, every number is back', JSON.stringify(painted(IDS)) === JSON.stringify(before));

  /* the Ioun Stone of Mastery: +1 proficiency bonus, so everything proficient follows */
  c = X.blankChar(); X.character = c; c.level = 1; c.spellAbility = 'wis';
  Object.assign(c.abilities, {str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10});
  c.skills.perception = 1; c.saves.wis = true;
  X.addLibraryItems([def(magic, 'Ioun Stone, Mastery'), def(core, 'Club')], null, null, 1);
  const ioun = c.inventory.find(i => i.name === 'Ioun Stone, Mastery');
  const b2 = painted(IDS);
  ck('#79 the base: PB +2, Perception +5, WIS save +5, passive 15, DC 13, spell attack +5, Club +2',
     b2.pbDisp === '+2' && b2['skill-perception'] === '+5' && b2['save-wis'] === '+5' && b2.passDisp === '15'
     && b2.dcDisp === '13' && b2.satkDisp === '+5' && club().toHit === 2, [b2, club().toHit]);
  ioun.equipped = true;
  const a2 = painted(IDS), fx2 = painted.fx;
  ck('#79 worn, the Ioun Stone of Mastery makes the proficiency bonus +3, marked', a2.pbDisp === '+3' && fx2.pbDisp, [a2.pbDisp, fx2.pbDisp]);
  ck('#79 ...and everything proficient follows: Perception +6, WIS save +6, passive 16, DC 14, spell attack +6, Club +3',
     a2['skill-perception'] === '+6' && a2['save-wis'] === '+6' && a2.passDisp === '16' && a2.dcDisp === '14'
     && a2.satkDisp === '+6' && club().toHit === 3, [a2, club().toHit]);
  ck('#79 ...while what is not proficient stays: Arcana +0, the STR save +0, initiative +0',
     a2['skill-arcana'] === '+0' && a2['save-str'] === '+0' && a2.initDisp === '+0', [a2['skill-arcana'], a2['save-str'], a2.initDisp]);
  m = shownModal(() => X.openStatBreakdown('profBonus'));
  ck('#79 tapping the proficiency bonus shows the level\'s +2 and names the stone',
     m.t === 'Proficiency Bonus breakdown' && /Level 1: \+2/.test(m.b) && /Ioun Stone, Mastery<\/span><b>\+1</.test(m.b), m);
  ioun.equipped = false;
  ck('#79 taken off, the proficiency bonus is +2 again, unmarked', painted(['pbDisp']).pbDisp === '+2' && !painted.fx.pbDisp);
  X.character = X.blankChar();
}

/* ---- imported files and packs render inert ----
   A character file, a rules pack and a settings file (which carries a whole
   `rules` object) are all written by someone else, and all reach the page
   through innerHTML. Three image sources went into <img src="…"> unescaped, so
   a crafted value could close the attribute and add an onerror handler — script
   in the app's origin, where every saved character lives. The audit that
   followed found list-item ids, a glossary id, pack ability keys, a class's hit
   die, the pack name and a few numbers-that-weren't going in raw as well.

   The harness DOM swallows innerHTML, so for these tests getElementById and
   createElement hand out RECORDERS that log every innerHTML / outerHTML /
   insertAdjacentHTML write. Each renderer then runs against a hostile
   character and pack, and must (a) not throw, (b) actually put the payload on
   the page — escaped — so the check is not vacuous, and (c) never emit it raw.
   rules-data.js holds the static half: every attribute interpolation esc()'d. */
{
  const noop = () => {};
  const log = [];
  let byId = {};
  function rec(id) {
    const t = {
      id: id || '', value: '', checked: false, disabled: false, readOnly: false, hidden: false,
      textContent: '', innerHTML: '', title: '', placeholder: '',
      style: {setProperty: noop}, dataset: {}, children: [], options: [], selectedOptions: [], files: [],
      parentNode: null, offsetParent: null, _on: {},
      classList: {toggle: noop, add: noop, remove: noop, contains: () => false},
      appendChild: c => c, insertAdjacentHTML: (pos, h) => { log.push(String(h)); },
      addEventListener: (type, fn) => { (t._on[type] = t._on[type] || []).push(fn); },
      querySelector: () => null, querySelectorAll: () => [], closest: () => null,
      getBoundingClientRect: () => ({top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0}),
      setAttribute: noop, removeAttribute: noop, focus: noop, remove: noop, replaceWith: noop,
      contains: () => false, click: noop, dispatchEvent: noop,
    };
    return new Proxy(t, {
      get: (o, k) => k === 'firstElementChild' ? rec() : (k in o ? o[k] : noop),
      /* textContent reads back as a string, as the DOM's does — printSheet trims it */
      set: (o, k, v) => { if (k === 'innerHTML' || k === 'outerHTML') log.push(String(v)); o[k] = k === 'textContent' ? String(v) : v; return true; },
    });
  }
  const el = id => byId[id] || (byId[id] = rec(id));
  const fire = (id, type, ev) => (el(id)._on[type] || []).forEach(fn => fn(ev || {target: el(id)}));
  const doc = ctx.document;
  const saved = {getElementById: doc.getElementById, createElement: doc.createElement, body: doc.body};
  doc.getElementById = el;
  doc.createElement = () => rec();
  doc.body = rec('body');
  /* The upload path: a FileReader that hands back whatever data URL the test
     put on the fake file, the way readAsDataURL would. */
  const hadFR = 'FileReader' in ctx;
  ctx.FileReader = function () {
    this.readAsDataURL = f => { this.result = f.url; this.onload && this.onload(); };
    this.readAsText = f => { this.result = f.text; this.onload && this.onload(); };
  };
  function capture(fn) {
    log.length = 0; byId = {};
    let err = null;
    try { fn(); } catch (e) { err = e; }
    return {html: log.join('\n'), err};
  }

  /* One payload for text and attributes alike: it closes either quote, ends the
     tag and opens an element. Escaped, `<i` becomes `&lt;i`, so a raw
     `<i data-pwn` anywhere means something went in unescaped. */
  const P = 'PWN"\'><i data-pwn=1>';
  const ON = '" onerror="alert(1)';          /* the attribute breakout the issue named */
  const RAW = /<i data-pwn/i, HANDLER = /\son\w+\s*=\s*["']?alert/i, REACHED = /&lt;i data-pwn=1&gt;/;
  const inert = (name, r, reach) => {
    ck(name + ' — renders without throwing', !r.err, r.err && String(r.err.stack || r.err).split('\n').slice(0, 3).join(' | '));
    if (reach !== false) ck(name + ' — the payload reaches the page, escaped', REACHED.test(r.html) || /&quot; onerror=&quot;/.test(r.html), r.html.slice(0, 300));
    ck(name + ' — nothing from the file is emitted raw', !RAW.test(r.html) && !HANDLER.test(r.html),
       (r.html.match(/.{0,80}(<i data-pwn|\son\w+\s*=\s*["']?alert).{0,40}/i) || [''])[0]);
  };

  // ---- safeImgSrc: data: URLs only
  const S = ctx.safeImgSrc;
  ck('safeImgSrc exists', typeof S === 'function');
  if (typeof S === 'function') {
    ck('safeImgSrc keeps a data: image URL', S('data:image/png;base64,iVBORw0KGgo=') === 'data:image/png;base64,iVBORw0KGgo=');
    ck('safeImgSrc keeps a data: URL whatever its media type (FileReader writes octet-stream for an untyped file)',
       S('data:application/octet-stream;base64,AAAA') === 'data:application/octet-stream;base64,AAAA');
    ck('safeImgSrc trims, and the scheme is case-blind', S('  DATA:image/gif;base64,R0lG ') === 'DATA:image/gif;base64,R0lG');
    ck('safeImgSrc refuses javascript:', S('javascript:alert(1)') === '' && S(' JaVaScRiPt:alert(1)') === '');
    ck('safeImgSrc refuses the network (offline-first: no request the player did not ask for)',
       S('https://example.com/p.png') === '' && S('http://example.com/p.png') === '' && S('//example.com/p.png') === '');
    ck('safeImgSrc refuses a relative path, blob: and file:', S('img/p.png') === '' && S('blob:null/1') === '' && S('file:///etc/passwd') === '');
    ck('safeImgSrc refuses a non-string', S(null) === '' && S(undefined) === '' && S({}) === '' && S(42) === '');
  }

  // ---- the portrait
  const withPortrait = v => { X.character = X.blankChar(); X.character.portraitImg = v; return capture(() => ctx.renderPortrait()); };
  let r = withPortrait('data:image/png;base64,iVBORw0KGgo=');
  ck('a normal portrait still renders', !r.err && r.html === '<img src="data:image/png;base64,iVBORw0KGgo=" alt="Portrait">', r.html);
  r = withPortrait('data:image/png;base64,AA' + ON + ' x="' + P);
  inert('a portrait that tries to close its src attribute', r);
  ck('...and is still the image it claims to be', /^<img src="data:image\/png;base64,AA&quot; onerror=&quot;/.test(r.html), r.html);
  r = withPortrait('javascript:alert(1)');
  ck('a javascript: portrait is not rendered as an image', !r.err && !/<img/i.test(r.html) && /No portrait yet/.test(r.html), r.html);
  r = withPortrait('https://example.com/me.png');
  ck('a network portrait is not fetched', !r.err && !/<img/i.test(r.html), r.html);
  r = withPortrait(null);
  ck('no portrait: the placeholder, as before', !r.err && /No portrait yet/.test(r.html), r.html);

  // ---- a glossary image: the view, the form, and the upload preview
  X.rules = {name: '', keywords: [], items: [], features: [], spells: [], races: [], classes: [], feats: [], tables: []};
  X.character = X.blankChar();
  const gHostile = {id: 'g1', term: 'Pwnterm', type: 'image', text: '', image: 'data:image/png;base64,AA' + ON + ' x="' + P};
  r = capture(() => ctx.openGlossView(gHostile));
  inert('a glossary image that tries to close its src attribute (view)', r);
  r = capture(() => ctx.openGlossView({id: 'g2', term: 'Js', type: 'image', image: 'javascript:alert(1)'}));
  ck('a javascript: glossary image is not rendered', !r.err && !/<img/i.test(r.html), r.html);
  r = capture(() => ctx.openGlossView({id: 'g3', term: 'Net', type: 'image', image: 'https://example.com/cover.png'}));
  ck('a pack image on the network is not fetched', !r.err && !/<img/i.test(r.html), r.html);
  r = capture(() => ctx.openGlossView({id: 'g4', term: 'Cover', type: 'image', image: 'data:image/png;base64,iVBORw0KGgo='}));
  ck('a normal glossary image still renders', !r.err && /<img src="data:image\/png;base64,iVBORw0KGgo=" alt="Cover">/.test(r.html), r.html);
  r = capture(() => ctx.openGlossForm(gHostile));
  inert('a glossary image that tries to close its src attribute (edit form)', r);
  r = capture(() => {
    ctx.openGlossForm({id: 'g5', term: 'Up', type: 'image', text: '', image: null});
    el('gFile').files = [{url: 'data:image/png;base64,AA' + ON + ' x="' + P}];
    fire('gFile', 'change');
  });
  inert('a picked file whose data URL tries to close the preview\'s src attribute', r);

  // ---- a hostile character, through every renderer
  X.resetRules();
  X.mergeRules({name: 'Pack ' + P, system: 'Hostile',
    keywords: [{term: 'Pwnkw', type: 'image', image: 'https://example.com/x.png'}],
    classes: [{name: 'Hostile', hitDie: 'd8' + P, savingThrows: ['dex' + P], spellcasting: 'int' + P,
               levels: {1: {traits: [{name: P, description: P}]}}, subclasses: {['Sub' + P]: {description: P}}}],
    races: [{name: 'HRace', description: P, abilityScores: {['str' + P]: 2},
             abilityChoice: {eligible: ['dex' + P], modes: ['2-1']}}],
    backgrounds: [{name: 'HBg', description: P, abilityScores: ['wis' + P], feat: ['Alert', P],
                   skills: [P], tools: P, languages: P, equipment: P}],
  }, 'hostile.json');
  /* a settings file restores `rules` wholesale, keyword ids included */
  X.rules.keywords[0].id = P;
  const hostile = X.blankChar();
  Object.assign(hostile, {
    id: 'hostile', name: P, portraitImg: 'data:image/png;base64,AA' + ON + ' x="' + P,
    classes: [{name: 'Hostile', level: 2, subclass: 'Sub' + P}, {name: P, level: 1, subclass: P}],
    race: {name: 'HRace', subrace: P}, bg: {name: 'HBg'},
    proficiencies: 'Pwnterm and Pwnkw, ' + P, appearance: P, notes: P,
    features: [{id: P, name: P, source: P, description: P, effects: [{target: 'ac', value: 1}],
                uses: {max: 2, per: P, used: 1}, cost: {resource: P, amount: 1}, enabled: true,
                origin: {kind: 'class', class: P}}],
    inventory: [{id: P, name: P, qty: 2, description: P, cost: 1, weight: 1, equipped: true,
                 effects: [{target: 'ac', value: 1}], origin: {kind: 'custom', detail: P, at: 0},
                 uses: {max: 2, per: P, used: 0}, armor: {kind: 'body', base: P, dexCap: P},
                 weapon: {kind: 'melee', dice: P, damageType: P}, use: {heal: '1d4', status: P},
                 sectionOverride: P}],
    statuses: [{id: P, name: P, description: P, effects: [], active: true},
               {id: 'st2', name: 'Pwnterm', description: '', effects: [], active: true}],
    familiars: [{id: P, name: P, kind: P, ac: P, hp: {cur: P, max: P}, speed: P, description: P, effects: [], active: true}],
    attacks: [{id: P, name: P, kind: 'melee', ability: 'str', proficient: true, damageDice: P, damageType: P, notes: P},
              {id: 'a2', spellId: P, source: 'spell', name: P, save: {ability: P}, damageDice: P, notes: P}],
    spells: [{id: P, name: P, level: '0' + P, prepared: true, meta: P, text: P, atkType: 'attack',
              dice: '1d6', damageType: P, granted: P, origin: {kind: 'custom', detail: P}}],
    activeSpells: [{id: P, spellId: P, name: P, level: P, conc: true, durationSec: 60, elapsedSec: 6}],
    glossary: [{id: P, term: 'Pwnterm', type: 'image', text: P, image: 'data:image/png;base64,AA' + ON + ' x="' + P}],
    resources: [{id: P, name: P, max: 3, cur: 1, per: P, die: P, auto: false, source: P}],
    slots: Object.assign(X.blankChar().slots, {1: {total: P, used: 0}}),
    coins: {cp: P, sp: 0, gp: 1, pp: 0, ep: 0},
    secNotes: {abilities: {text: P, at: 0}},
  });
  X.character = X.migrate(JSON.parse(JSON.stringify(hostile)));   /* the import path */
  X.activeId = 'hostile';
  const C = () => X.character;
  const run = (name, fn, reach) => inert(name, capture(fn), reach);
  run('the portrait', () => ctx.renderPortrait());
  run('class, ancestry and background chips', () => ctx.renderClassRace());
  run('Features & Traits', () => ctx.renderFeatures());
  run('Inventory', () => ctx.renderInventory());
  run('Statuses', () => ctx.renderStatuses());
  run('Familiars', () => ctx.renderFamiliars());
  run('Attacks & Weapons', () => ctx.renderAttacks());
  run('Active Spells', () => ctx.renderActiveSpells());
  run('the spell list', () => ctx.renderSpells());
  run('the Rules tab glossary', () => ctx.renderGloss());
  run('Resources', () => ctx.renderResources());
  ['full', 'condensed', 'dice'].forEach(s => {
    C().hdStyle = s;
    run('Hit Dice from a pack\'s hit die (' + s + ')', () => ctx.renderHitDice());
  });
  run('Story fields and Proficiencies (glossary chips)', () => ctx.renderAllRT());
  run('the Section Notes card', () => ctx.renderNotes());
  run('the Coins card', () => ctx.renderCoins());
  run('the print sheet', () => ctx.printSheet());
  run('a glossary entry of the character\'s own', () => ctx.openGlossView(C().glossary[0]));
  run('the pack\'s image keyword, whose id a settings file sets', () => ctx.renderAllRT());
  run('the item editor (structured armor from the file)', () => ctx.openItemForm(C().inventory[0]));
  run('the feature editor', () => ctx.openFeatureForm(C().features[0]));
  run('the spell editor', () => ctx.openSpellForm(C().spells[0]));
  run('the spell view', () => ctx.openSpellView(C().spells[0]));
  run('the attack editor', () => ctx.openAttackForm(C().attacks[0]));
  run('the to-hit breakdown', () => ctx.openAttackBreakdown(P));
  run('the resource editor', () => ctx.openResourceForm(C().resources[0]));
  run('the status editor', () => ctx.openStatusForm(C().statuses[0]));
  run('the familiar editor', () => ctx.openFamiliarForm(C().familiars[0]));
  run('the origin badge\'s window', () => ctx.openOriginInfo(C().inventory[0].origin));
  /* A fresh copy: renderSpells() above rewrote s.level to a number in place,
     which is also why this one is hard to reach from the UI after renderAll(). */
  run('casting a cantrip whose level is not a number', () => ctx.promptSpellAttack(Object.assign({}, C().spells[0], {level: '0' + P}), 0));
  run('the class window (a pack\'s saves, spellcasting and subclasses)', () => ctx.openClassInfo('Hostile'));
  run('the ancestry window (a pack\'s ability keys)', () => ctx.openRaceInfo('HRace'));
  run('the background window (a pack\'s ability list)', () => ctx.openBackgroundInfo('HBg'));
  run('Add ancestry, after picking the pack\'s species', () => {
    ctx.openAddRace(); el('raceSel').value = X.rules.races[0]._id; fire('raceSel', 'change');
  });
  run('Add background, after picking the pack\'s background', () => {
    ctx.openAddBackground(); el('bgSel').value = X.rules.backgrounds[0]._id; fire('bgSel', 'change');
  });
  run('Settings (the pack\'s name in the status line)', () => ctx.openSettings());
  /* Slot totals survive recompute() only on a sheet with a spellcasting ability
     and no caster class — autoSlots() rewrites them otherwise — and the print
     sheet's slot line printed them as they came. */
  X.character = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {
    spellAbility: 'wis', slots: Object.assign(X.blankChar().slots, {1: {total: '2' + P, used: 0}})}))));
  run('the print sheet\'s spell-slot line', () => ctx.printSheet(), false);
  ck('...which still prints a real slot count', /L1: 2\/2/.test(capture(() => ctx.printSheet()).html));

  /* ---- a glossary entry with no term never breaks the sheet (#71)
     highlight() looked each chip up with allGlossary().find(x=>x.term.toLowerCase()…),
     and nearly every render runs text through highlight(). ONE keyword or
     glossary entry without a term — a hand-written pack, a settings file (which
     restores `rules` wholesale, never through mergeRules), an imported
     character — threw a TypeError, and every render after it stopped: the
     features list, the Add class window, the lot.
     The READERS are tested first, with the pool and the character set directly
     so no boundary repair can hide a reader that still assumes a term. The
     malformed entries come FIRST, because find() stopped at the first match and
     a well-formed entry ahead of them hid the bug. */
  const renders = (label, fn) => {
    const res = capture(fn);
    ck('#71 ' + label + ' — renders without throwing', !res.err,
       res.err && String(res.err.stack || res.err).split('\n').slice(0, 3).join(' | '));
    return res.html;
  };
  const badKeywords = () => [{name: 'Mangled', desc: 'no term at all'}, {term: 5, text: 'a number'},
    {term: {x: 1}, text: 'an object'}, {term: '   ', text: 'only spaces'}, null, 'Grappled', ['Grappled'],
    {id: 'kw1', term: 'Grappled', type: 'text', text: 'Speed 0.', cond: true}];
  const badOwn = () => [{id: 'own0', type: 'text', text: 'mine, and it has no term'}, null, 'Doom', {id: 'own2', term: ['x']},
    {id: 'own1', term: 'Hexed', type: 'text', text: 'mine'}, {id: 'own3', term: "Hunter's Mark", type: 'text', text: 'quarry'}];
  const seedMalformed = () => {
    X.rules = {name: 'Wholesale', keywords: badKeywords(), items: [], features: [], spells: [], races: [],
               classes: [], feats: [], tables: []};
    X.character = X.blankChar();      /* no migrate(): the readers must cope on their own */
    X.character.system = 'dnd';
    Object.assign(X.character, {
      proficiencies: 'Grappled and Hexed.', glossary: badOwn(),
      statuses: [{id: 's1', name: 'Grappled', active: true, effects: []}, {id: 's2', name: 7, active: true, effects: []},
                 {id: 's3', active: true, effects: []}],
      features: [{id: 'f1', name: 'Tough', description: 'While Grappled you are Hexed.', effects: []}],
      spells: [{id: 'sp1', name: 'Hex', level: 1, text: 'The target is Hexed.'}],
      secNotes: {abilities: {text: 'Grappled **and** Hexed', at: 0}},
    });
  };
  seedMalformed();
  let hl = null, hlErr = null;
  try { hl = ctx.highlight('Grappled and Hexed, then Hunter\'s Mark.'); } catch (e) { hlErr = e; }
  ck('#71 highlight() survives keywords and entries with no term', !hlErr, hlErr && String(hlErr));
  ck('#71 ...and still chips a pack term', /<span class="kw" data-gid="kw1"[^>]*>Grappled<\/span>/.test(hl || ''), hl);
  ck('#71 ...and the player\'s own term', /<span class="kw" data-gid="own1"[^>]*>Hexed<\/span>/.test(hl || ''), hl);
  ck('#71 a term with an apostrophe opens its own entry (its chip had no id)',
     /<span class="kw" data-gid="own3"[^>]*>Hunter&#39;s Mark<\/span>/.test(hl || ''), hl);
  hl = null; try { hl = ctx.highlight('a b c'); } catch (e) { hl = String(e); }
  ck('#71 a term of only spaces does not turn every space into a chip', hl === 'a b c', hl);
  renders('Features & Traits', () => ctx.renderFeatures());
  renders('Inventory', () => ctx.renderInventory());
  renders('the spell list', () => ctx.renderSpells());
  const stHtml = renders('Statuses (a status named after a keyword, one named 7, one with no name)', () => ctx.renderStatuses());
  ck('#71 a status named after a keyword is still a chip', /data-gid="kw1"[^>]*>Grappled</.test(stHtml), stHtml.slice(0, 400));
  renders('Story fields and Proficiencies', () => ctx.renderAllRT());
  renders('the Section Notes card', () => ctx.renderNotes());
  renders('the Rules tab section counts', () => ctx.renderRulesSections());
  const gl = renders('the Rules tab glossary', () => ctx.renderGloss());
  ck('#71 the player\'s entry with no term is still listed, so it can be fixed',
     /data-edit-gloss="own0"/.test(gl) && /data-del-gloss="own0"/.test(gl) && /no term/i.test(gl), gl.slice(0, 600));
  ck('#71 ...and so is the one whose term is not text', /data-edit-gloss="own2"/.test(gl), gl.slice(0, 600));
  renders('the glossary view of an entry with no term', () => ctx.openGlossView(X.character.glossary[0]));
  renders('the glossary view of nothing (a stale id)', () => ctx.openGlossView(undefined));
  renders('the glossary editor on an entry with no term', () => ctx.openGlossForm(X.character.glossary[0]));
  renders('the status editor (its condition list comes from keywords)', () => ctx.openStatusForm());
  let stl = null; try { stl = ctx.statusTermList(); } catch (e) { stl = String(e); }
  ck('#71 the condition list offers the good terms, all of them text',
     Array.isArray(stl) && stl.includes('Grappled') && stl.every(t => typeof t === 'string' && t.trim() === t && t), stl);
  renders('the item editor (its "applies" list comes from keywords)', () => ctx.openItemForm());
  renders('the print sheet', () => ctx.printSheet());
  renders('the Add class window', () => ctx.openAddClass());
  renders('class, ancestry and background chips', () => ctx.renderClassRace());

  /* ---- the character's boundary: migrate() keeps the player's entries (#71)
     A glossary entry is the player's own data, so migrate() never drops one
     that is an object — whatever its shape. It repairs only what lets the
     player reach it: the other categories' field names, read as the glossary's
     (name → term, description → text), and an id, without which the Rules
     tab's Edit and Delete cannot find it. What goes is what is not an object:
     `null` (JSON's hole or undefined) and bare strings or numbers, which carry
     no field of an entry and threw on the first read or (strict mode) write. */
  {
    const file = {abilities: {}, glossary: [
      {id: 'g0', text: 'no term, kept'}, null, 'Doom', {term: 'NoId', text: 'x'},
      {id: 'g2', name: 'Aliased', description: 'from description', extra: 'kept'},
      {id: 'g3', term: 20, text: 'a number'}, {id: 9, term: 'NumId'}],
      features: [null, {id: 'f', name: 'Kept'}], inventory: [null, 'Rope', 3], spells: [null, 'Hex', {id: 's', name: 'Hex'}]};
    let m = null, err = null;
    try { m = X.migrate(JSON.parse(JSON.stringify(file))); } catch (e) { err = e; }
    ck('#71 migrate() copes with a malformed glossary', !err, err && String(err));
    const g = (m && m.glossary) || [];
    const byId = id => g.find(x => x && x.id === id);
    ck('#71 migrate() keeps every glossary object, the one with no term included',
       g.length === 5 && !!byId('g0') && byId('g0').text === 'no term, kept', g);
    ck('#71 ...drops the null and the bare string', g.every(x => x && typeof x === 'object'), g);
    ck('#71 ...gives an entry with no id one, so Edit and Delete can reach it',
       g.every(x => x && typeof x.id === 'string' && x.id), g.map(x => x && x.id));
    ck('#71 ...keeps a numeric id, as text', g.some(x => x && x.id === '9' && x.term === 'NumId'), g.map(x => x && x.id));
    const al = byId('g2') || {};
    ck('#71 ...reads name/description as term/text, and keeps both originals',
       al.term === 'Aliased' && al.text === 'from description' && al.name === 'Aliased' && al.description === 'from description' && al.extra === 'kept', al);
    ck('#71 ...turns a numeric term into text', (byId('g3') || {}).term === '20', byId('g3'));
    ck('#71 migrate() drops null and bare-value list items everywhere, and keeps the rest',
       m && m.features.length === 1 && m.features[0].name === 'Kept' && m.inventory.length === 0 && m.spells.length === 1,
       m && [m.features, m.inventory, m.spells]);
    const again = m && X.migrate(JSON.parse(JSON.stringify(m)));
    ck('#71 ...and is still idempotent', !!m && JSON.stringify(again) === JSON.stringify(m));
    /* and the migrated sheet renders, the entry with no term listed for fixing */
    X.character = m || X.blankChar();
    const gl2 = renders('the Rules tab glossary after migrate()', () => ctx.renderGloss());
    ck('#71 the entry with no term is listed after migrate() too', /data-edit-gloss="g0"/.test(gl2), gl2.slice(0, 400));
    let h2 = null; try { h2 = ctx.highlight('Aliased'); } catch (e) { h2 = String(e); }
    ck('#71 an aliased entry chips once migrated', /data-gid="g2"/.test(h2 || ''), h2);
    /* every list holding a null, a bare string and an array: once migrated, the
       whole sheet draws (a string in `spells` threw on the first write to it) */
    const junkLists = Object.assign(X.blankChar(), {system: 'dnd'});
    ['features', 'inventory', 'statuses', 'familiars', 'spells', 'attacks', 'activeSpells', 'glossary',
     'classes', 'grants', 'resources', 'journal'].forEach(k => { junkLists[k] = [null, 'str', 7, ['arr'], {}]; });
    X.character = X.migrate(JSON.parse(JSON.stringify(junkLists)));
    renders('the whole sheet from a file whose lists hold null, text and numbers (renderAll)', () => ctx.renderAll());
    renders('the print sheet from that file', () => ctx.printSheet());
  }

  /* ---- the pool's boundary: whatever arrives, reindexRules() leaves it renderable
     A settings file restores `rules` wholesale and the cache restores it as
     saved; neither goes through mergeRules(), but both end in reindexRules().
     Any category, not only keywords: a race, class or spell with no name, or a
     non-object, reached code that calls .toLowerCase() on it or sets `_id`. */
  {
    const junk = () => [null, 'text', ['arr'], {}, {name: '   '}, {name: {x: 1}}];
    const pool = {name: 'Wholesale'};
    X.RULE_CATS.forEach(c => { pool[c] = junk(); });
    pool.keywords.push({name: 'Mangled', description: 'aliased'}, {term: 'Grappled', text: 'Speed 0.', cond: true});
    pool.spells.push({name: 7, level: 1}, {name: 'Hex', level: 1, class: ['Warlock']});
    pool.classes.push({name: 'Fighter', hitDie: 'd10', levels: {}});
    pool.races.push({name: 'Elf'});
    pool.backgrounds.push({name: 'Acolyte'});
    pool.items.push({name: 'Rope'});
    pool.feats.push({name: 'Alert'});
    pool.features.push({name: 'Tough'});
    pool.subclasses.push({name: 'Champion', class: 'Fighter'});
    pool.tables.push({name: 'Rowless'}, {name: 'Ragged', cols: 'not a list', rows: ['not a row', ['1', '2']]});
    X.rules = JSON.parse(JSON.stringify(pool));
    let err = null;
    try { X.reindexRules(); X.recomputeDups(); } catch (e) { err = e; }
    ck('#71 reindexRules() copes with a wholesale pool full of junk', !err, err && String(err));
    const kw = (X.rules.keywords || []).map(k => k && k.term);
    ck('#71 ...keeps the usable keywords, the aliased one included', kw.join('|') === 'Mangled|Grappled', kw);
    ck('#71 ...drops every entry with no usable name, in every category',
       X.RULE_CATS.every(c => (X.rules[c] || []).every(e => e && typeof e === 'object' && !Array.isArray(e)
         && typeof (c === 'keywords' ? e.term : e.name) === 'string' && (c === 'keywords' ? e.term : e.name).trim())),
       X.RULE_CATS.map(c => c + ':' + (X.rules[c] || []).length));
    ck('#71 ...keeps a spell named 7, as text', (X.rules.spells || []).some(s => s && s.name === '7'), X.rules.spells);
    ck('#71 ...gives a keyword without an id one, so its chip opens it',
       (X.rules.keywords || []).every(k => k && typeof k.id === 'string' && k.id));
    X.rules.classes = 'not a list';
    try { X.reindexRules(); } catch (e) { err = e; }
    ck('#71 ...and turns a category that is not a list into an empty one', !err && Array.isArray(X.rules.classes), X.rules.classes);
    X.rules = JSON.parse(JSON.stringify(pool));
    try { X.reindexRules(); X.recomputeDups(); } catch (e) { /* reported above */ }
    X.character = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {system: 'dnd',
      classes: [{name: 'Fighter', level: 1}, {level: 1}, {name: 5, level: 1}], race: {name: 'Elf'}, bg: {name: 'Acolyte'},
      proficiencies: 'Grappled, Mangled.', spells: [{id: 'h', name: 'Hex', level: 1}]}))));
    renders('the whole sheet over a tidied pool (renderAll)', () => ctx.renderAll());
    renders('Settings and its loaded-data list', () => ctx.openSettings());
    renders('the Add class window over a tidied pool', () => ctx.openAddClass());
    renders('the Add ancestry window', () => ctx.openAddRace());
    renders('the Add background window', () => ctx.openAddBackground());
    renders('the feat picker', () => ctx.browseFeatures());
    renders('the item picker', () => ctx.browseItems());
    renders('the spell picker', () => ctx.browseSpells());
    renders('the class window, with classes that have no name', () => ctx.openClassInfo('Fighter'));
    renders('the Reference Tables list (a table with no rows, one with ragged rows)', () => ctx.renderTables());
    renders('a table with no rows', () => ctx.openTableByName('Rowless'));
    renders('a table whose cols and rows are not lists', () => ctx.openTableByName('Ragged'));
    renders('the print sheet over a tidied pool', () => ctx.printSheet());
  }

  /* ---- the item form's "Insert from rules pack" keeps a weapon's own bonus (#74)
     The form asks for a weapon's kind, ability, dice and type and nothing else,
     and carried atkMisc/dmgMisc/notes only from the item being EDITED — so a
     new item filled from the pack's Dagger of Venom got no +1 on the weapon.
     That hid while the pack also wrote the +1 as a global effect (which the
     insert does copy); with the effect gone, the dagger would have had no bonus
     at all. Driven through the form itself, with the real shipped entry. */
  {
    const magic = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', '5e2024', 'items-magic.json'), 'utf8')).items;
    X.resetRules();
    X.mergeRules({system: 'XPHB', items: [magic.find(x => x.name === 'Dagger of Venom')]}, 'x.json');
    X.character = X.blankChar(); X.character.system = 'dnd';
    X.character.abilities.str = 10; X.character.abilities.dex = 16; X.character.level = 1;
    const res = capture(() => {
      ctx.openItemForm();
      el('iLib').value = '0'; fire('iLib', 'change');
      fire('iSave', 'click');
    });
    ck('#74 the item form saves an inserted pack weapon', !res.err && X.character.inventory.length === 1,
       res.err && String(res.err.stack || res.err).split('\n').slice(0, 3).join(' | '));
    const iw = (X.character.inventory[0] || {}).weapon || {};
    ck('#74 ...keeping the weapon\'s own +1, to hit and to damage', iw.atkMisc === 1 && iw.dmgMisc === 1, iw);
    ck('#74 ...and its range and properties', iw.notes === 'Range 20/60 · Finesse, Light, Thrown · Mastery: Nick', iw);
    const ia = X.character.attacks.find(a => a.itemId === (X.character.inventory[0] || {}).id);
    ck('#74 ...so its attack reads DEX 3 + PB 2 + 1 = +6, as the finder\'s does',
       !!ia && X.attackNumbers(ia).toHit === 6, ia && X.attackNumbers(ia));
    /* editing it again, with nothing inserted, still carries what it has (the
       recorder DOM does not read values back out of the markup, so the boxes
       the form would show are filled in by hand) */
    const again = capture(() => {
      ctx.openItemForm(X.character.inventory[0]);
      [['iName', 'Dagger of Venom'], ['iWKind', 'melee'], ['iWAbil', 'finesse'], ['iWDice', '1d4'], ['iWType', 'piercing']]
        .forEach(([id, v]) => { el(id).value = v; });
      fire('iSave', 'click');
    });
    const iw2 = (X.character.inventory[0] || {}).weapon || {};
    ck('#74 re-saving the item keeps the bonus and notes', !again.err && iw2.atkMisc === 1 && iw2.dmgMisc === 1
       && iw2.notes === iw.notes, again.err ? String(again.err) : iw2);
    X.resetRules();
  }

  Object.assign(doc, saved);
  if (!hadFR) delete ctx.FileReader;
  X.activeId = null;
  X.character = X.blankChar();
  X.resetRules();
}

ck.done();
