/* Sheet mechanics: the small pure functions the character sheet leans on.
   The coin-box entry parser, which is the whole of the add/subtract currency
   feature, and the carried-weight/encumbrance maths — everything else about
   both is DOM wiring. */
const {loadApp, makeCheck} = require('./harness');

const ck = makeCheck();
const {X, bootError, fragments} = loadApp([
  'signedEntry', 'signedDelta', 'num', 'fnum', 'fmtWt', 'fmtGp', 'blankChar', 'migrate',
  'clampHP', 'effMaxHP', 'adjustHP', 'applyHPInput', 'renderHP', 'hpBand', 'hdStyle',
  'itemWeight', 'itemWeightTotal', 'coinsWeight', 'carriedWeight',
  'sizeName', 'sizeLabel', 'charSize', 'carryCapacity', 'encMode', 'encState',
  'encSpeed', 'encTierNote', 'contributions', 'inventoryTotal', 'SIZES', 'SIZE_CARRY',
  'capacityFor', 'sizeOptionsHTML', 'invSection',
  'effectiveChoose', 'choiceShortfall', 'choiceFieldHTML', 'grantProf', 'effSkill', 'SKILLS',
  'featGroups', 'featItemHTML', 'featGroupLabel', 'FEAT_FAV',
  'FEAT_KINDS', 'featKindDef', 'featPickList', 'featPickKind', 'featPickPrereq',
  'featPickName', 'featPickStoredName', 'featPickGroup', 'addPickedFeature', 'updResolve',
  'spellLevelTally', 'spellAllotment', 'cantripsKnown',
  'descHTML', 'highlight', 'mergeRules', 'resetRules',
  'attackDamageStr', 'extraDamageList', 'damagePartStr',
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
ck('newlines are left alone — the CSS renders them',
   X.descHTML('one\ntwo').indexOf('\n') > -1);

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

ck.done();
