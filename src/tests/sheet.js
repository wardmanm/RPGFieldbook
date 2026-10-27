/* Sheet mechanics: the small pure functions the character sheet leans on.
   The coin-box entry parser, which is the whole of the add/subtract currency
   feature, and the carried-weight/encumbrance maths — everything else about
   both is DOM wiring. */
const {loadApp, makeCheck} = require('./harness');

const ck = makeCheck();
const {X, ctx, state, bootError, fragments} = loadApp([
  'signedEntry', 'signedDelta', 'num', 'fnum', 'fmtWt', 'fmtGp', 'blankChar', 'migrate',
  'clampHP', 'effMaxHP', 'adjustHP', 'applyHPInput', 'renderHP', 'hpBand',
  'hdSpendCheck', 'hdHeal', 'hdBarHTML', 'hdSpendHTML',
  'itemWeight', 'itemWeightTotal', 'coinsWeight', 'carriedWeight',
  'sizeName', 'sizeLabel', 'charSize', 'carryCapacity', 'encMode', 'encState',
  'encSpeed', 'encTierNote', 'contributions', 'inventoryTotal', 'SIZES', 'SIZE_CARRY',
  'capacityFor', 'sizeOptionsHTML', 'invSection',
  'ORIGIN_KINDS', 'originDef', 'originLabel', 'originLetter', 'originFromSid',
  'itemOrigin', 'originOptionsHTML', 'grantedFromOrigin', 'originFromGranted',
  'effectiveChoose', 'choiceShortfall', 'choiceFieldHTML', 'grantProf', 'effSkill', 'SKILLS',
  'ABIL',
  'featGroups', 'featItemHTML', 'featGroupLabel', 'FEAT_FAV',
  'featOriginLabel', 'invSectionName', 'invGroups', 'INV_FAV', 'INV_ORDER', 'groupChoices', 'groupFieldHTML',
  'tagLabel', 'tagKey', 'journalEditorHTML', 'trackerFormHTML',
  'GROUP_RESERVED', 'tagTidy', 'groupNameProblem', 'syncGroupFieldMsg', 'groupFieldBlocked', 'groupByTag', 'invSection',
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
  'richHTML', 'richInline', 'noteHTML', 'noteCheckboxes', 'toggleCheckbox', 'noteProgress', 'notePreview',
  'noteDef', 'noteEntryHTML',
  'itemArmor', 'armorAC', 'armorKindOf', 'ARMOR_DEXCAP', 'isEquippable', 'contributions',
  'featGroups', 'FEAT_FAV', 'ATK_FAV', 'atkCol', 'featCol', 'statusRowHTML', 'concStatusRow',
  'attackVisible', 'migrateWeaponEquip',
  'syncSpellAttack', 'detectSpellAttack',
  'castSpell', 'endActiveSpell', 'bumpActive', 'spellIsConc',
  'syncConcStatus', 'endConcentration', 'endConcFromStatus', 'concActiveSpell', 'concStatusRow',
  'COMBAT_DEFAULTS', 'inCombat', 'combatSectionsOf', 'withCombatSection', 'moveCombatSection',
  'combatStart', 'combatEnd', 'combatElapsedSec', 'fmtCombatTime', 'advanceRound', 'combatButtonHTML',
  'combatToggleHTML', 'combatToggleText', 'combatHeaderHTML', 'startCombatNow', 'endCombatAsk',
  'EDIT_CARDS', 'editHidden', 'setEditHidden', 'editCardTitle', 'editToggleText', 'editToggleHTML',
  'combatGripHTML', 'moveCombatCard',
  'insertCombatSection', 'toggleCombatSection', 'undoCombatRemove', 'stepCombatSection',
  'MODAL_FOCUS_FIELDS', 'openerSelector', 'cvNeighbours',
  'finderQty', 'addLibraryItems', 'grantItemByName', 'attackNumbers', 'recompute',
  'spellDC', 'spellAtkBonus', 'fxTargets', 'FX_LABEL', 'promptSpellAttack', 'openStatBreakdown', 'openAttackBreakdown',
  'renderAttacks',
  'coinKeys',
  'RULE_CATS', 'reindexRules', 'recomputeDups', 'repairIds',
  'jnlStr', 'jnlTime', 'tagLabel', 'tagKey', 'groupByTag', 'attrSel', 'jnlPages', 'jnlTitle', 'jnlSort',
  'jnlQuery', 'jnlFind', 'jnlMatch', 'jnlSnippet', 'jnlSavePage', 'jnlDeletePage', 'jnlTagList',
  'jnlGroupOpen', 'jnlStampText', 'insertLine', 'insertMarker', 'journalListHTML', 'journalPageHTML', 'journalEditorHTML', 'jnlEntryHTML', 'NOTE_FMT_HINT',
  'fmtWhen', 'noteWhen', 'jnlWhen',
  'TRK_TYPES', 'trkList', 'trkType', 'trkInt', 'trkName', 'showTrackers', 'trkParse', 'trkProgress',
  'trkApply', 'trkStep', 'trkSetValue', 'trkClose', 'trkReopen',
  'trkSnapshot', 'trkRestore', 'trkFromForm', 'trkSplit', 'trkGroupOpen', 'trkTotalOn', 'trkGroupTotal', 'migrateTrackerPages',
  'trackerRowHTML', 'trackerClosedHTML', 'trackersHTML', 'trackerFormHTML', 'trkSummary', 'trkEditHTML',
  'ammoKindOf', 'itemAmmo', 'weaponAmmoKind', 'ammoStacks', 'loadedStack', 'ammoPlural', 'ammoOne',
  'unpackAmmo', 'rebaseAmmo', 'migrateAmmo', 'ammoTable', 'fpMap', 'fpHash',
  'AMMO_PASS', 'ammoRepairDef', 'stampSrc', 'updChangedFields', 'updEdited',
  'AMMO_RECOVERY', 'ammoRecoveryOf', 'itemRecover', 'weaponThrown', 'ammoThrownKind', 'AMMO_RECOVER_DEFAULTS', 'ammoDefaultRecover', 'ammoRecoverRule', 'ammoBack',
  'ammoSpentEntry', 'fireAmmo', 'undoFire', 'throwAmmo', 'ammoRecordShot', 'ammoEntryItem', 'ammoRecoverable', 'recoverAmmo', 'grantSidLive', 'undoRecovery', 'ammoSummaryText', 'attackAmmo', 'forgetAmmo',
  'forgetGrantAmmo',
  'ammoLineHTML', 'thrownLineHTML', 'ammoAsks', 'throwWeaponTap', 'ammoChoiceHTML', 'fireWeapon', 'undoFireTap', 'openAmmoPicker', 'loadAmmo', 'recoverWeaponAmmo',
  'applyAmmoRecovery', 'undoRecoveryTap', 'revertEquipmentGrants',
  'ammoKindChoices', 'ammoKindOptionsHTML', 'recoverOptionsHTML',
  'statusDuration', 'statusElapsed', 'statusTimed', 'statusUnitFor', 'fmtStatusTime', 'statusTimeText',
  'statusExpiredText', 'statusBackText', 'tickStatuses', 'restartStatus',
  'announceStatusExpiry', 'undoStatusExpiry', 'stepStatusTap', 'syncStatLock',
  'fxNeg', 'mark', 'editing',
  'itemFacets', 'spellFacets', 'featFacets', 'itemCatOf', 'itemRarOf', 'spellClassesOf', 'spellSchoolOf', 'openItemInfo', 'openFeatInfo', 'ITEM_RARITIES',
  'settings', 'rbUI',
  'CHIP_KEYS', 'chipClean', 'chipList', 'advancementOf', 'SRD_ADVANCEMENT', 'advancementFor', 'xpNumber', 'xpProgress', 'defaultLanguagesFor', 'ensureDefaultLanguages', 'langParse',
  'grantLanguages', 'dropLanguages',
  'CHIP_SUGGEST', 'chipSrcLabel', 'chipsHTML', 'chipChooserHTML', 'openChipChooser', 'addChip', 'removeChip', 'renderDefences', 'renderBioChips',
  'mergeNoteInto', 'liftLanguages', 'migrateSheet103',
  'pawHTML', 'classLineHTML', 'classFlyHTML', 'levelBadgeHTML', 'familiarCardHTML', 'famFlyHTML',
  'combatAddable', 'renderCombatToggles', 'jumpToNote', 'openAddClass', 'NO_RULES_HINT', 'NOTE_SECTIONS',
  'isTabHidden', 'cleanHiddenTabs', 'setTabHidden', 'applyHiddenTabs', 'HIDEABLE_TABS', 'TAB_LABELS', 'selectTab',
  'leaveCombatTab', 'tabsGroupHTML',
  'HB_NAMES', 'HB_SAYS', 'initInt', 'initOpt', 'cleanParty', 'cleanCombatants', 'combatantDead',
  'initSort', 'initFirstAlive', 'initNextTurn', 'bandOfShare', 'combatantBar', 'initRollCheck',
  'initRollLine', 'initModOf', 'youAC', 'buildCombatants',
  'partyRowsHTML', 'savePartyMember', 'removePartyMember',
  'initRollHTML', 'openInitRoll', 'irState', 'irSetTyped', 'irRoll', 'startInitFight',
  'hbBarHTML', 'combatantHealthText', 'initStripHTML', 'initTableHTML', 'renderInitTable',
  'initNext', 'setInitMode', 'toggleInitRolls', 'toggleInitTable',
  'initTie', 'combatantDialogHTML', 'setCombatant', 'removeCombatant', 'moveCombatant',
  'addCombatant', 'openCombatant', 'openAddCombatant',
  'renderInitStrip', 'initChipScroll', 'irStart', 'renderCombatHeader',
  'INV_LOG_SIZES', 'COIN_CP', 'coinsToCp', 'cpToGpText', 'itemWorthCp', 'invSame', 'invSnap',
  'cleanInvLog', 'logInv', 'logGrant', 'logItemSave', 'invUndoCheck', 'invUndo', 'invRemoveQty', 'invRestore',
  'applyCoinInput', 'convertCoins', 'ammoFightSummary',
  'INV_FILTERS', 'invDayLabel', 'invLogHTML', 'openInvLog',
  'newTradeDraft', 'tradeBalance', 'tradeHTML', 'completeTrade',
  'featCategory', 'featPrereq', 'featUnmet', 'featAbilityChoices', 'featOfferable', 'featTaken', 'abilFinal',
  'commitChoices', 'asiFeatListHTML', 'asiPanelHTML', 'commitAsiPick', 'removeClass', 'asiPickConfirmed',
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

/* ---- #103: spending a hit die (spec §6.3) ----
   The three hit-dice display styles (full/condensed/dice) and hdStyle() are
   retired along with their Settings row: one bar now, tapping it opens the
   spend box. */
{
  ck('#103 a typed roll must be a whole number from 1 to the die',
     X.hdSpendCheck('d8', '8').ok && X.hdSpendCheck('d8', ' 5 ').roll === 5 &&
     ['0', '9', '4.5', '', 'abc', '-1'].every(v => !X.hdSpendCheck('d8', v).ok && X.hdSpendCheck('d8', v).why));
  ck('#103 the heal is roll + CON, never below 0', X.hdHeal(5, 5) === 10 && X.hdHeal(1, -3) === 0 && X.hdHeal(3, -1) === 2);
  const pool = [{die: 'd8', total: 15, used: 3, cls: 'Cleric'}, {die: 'd10', total: 2, used: 2, cls: 'Fighter'}];
  const bar = X.hdBarHTML(pool, 5);
  ck('#103 the bar: die, left of total, CON', bar.includes('d8') && bar.includes('12 / 15') && bar.includes('CON +5') && bar.includes('data-hdspend'));
  const box = X.hdSpendHTML(pool, 'd8', 5, 88, 153);
  ck('#103 the box: a row per die, used −/+, both ways to spend', box.includes('data-hdpick="d8"') && box.includes('data-hdpick="d10"') &&
     box.includes('data-hdused="d8"') && box.includes('id="hdRollMe"') && box.includes('id="hdTyped"') && box.includes('id="hdApply"'));
  ck('#103 a die type with none left cannot be picked', /data-hdpick="d10"[^>]*disabled/.test(box));
  ck('#103 the box keeps auto / manual', box.includes('data-hdmode'));

  /* ---- #103 fix round 1 (minor): a fully-spent pool can't roll or type ----
     openHdSpend()'s fallback can leave `sel` pointing at an exhausted die
     when nothing in the pool has any left; Roll for me and the typed box
     must not sit there clickable and silently do nothing. */
  const spentPool = [{die: 'd8', total: 2, used: 2, cls: 'Cleric'}];
  const spentBox = X.hdSpendHTML(spentPool, 'd8', 5, 10, 20);
  ck('#103 fix1 an all-spent pool disables Roll for me', /id="hdRollMe"[^>]*disabled/.test(spentBox), spentBox);
  ck('#103 fix1 ...and the typed box', /id="hdTyped"[^>]*disabled/.test(spentBox));
  ck('#103 fix1 ...Apply stays disabled too', /id="hdApply"[^>]*disabled/.test(spentBox));
  ck('#103 fix1 ...with a reason shown up front', spentBox.includes('No hit dice left'));
  // a die with some left stays fully usable — this is about the SELECTED die
  // having none, not the pool being empty
  const mixedBox = X.hdSpendHTML(pool, 'd8', 5, 10, 20);
  ck('#103 fix1 a die with some left keeps Roll for me and the typed box enabled',
     !/id="hdRollMe"[^>]*disabled/.test(mixedBox) && !/id="hdTyped"[^>]*disabled/.test(mixedBox) &&
     !mixedBox.includes('No hit dice left'));
}

/* ---- #103 fix round 1 (important): the spend box does not close the
   "Hit die spent" summary it just opened ----
   bd9022c fixed a bug only a browser caught: Apply and Roll for me both end
   in spendHitDie(), which ends in restSummary() — OPENING the summary modal
   in the spend box's own place. The old code then called closeModal() right
   after, closing that summary in the same tick, before it ever painted. This
   drives openHdSpend()'s REAL wiring (not just the pure builders above) and
   asserts the openModal/closeModal call order: every path must END on an
   `open` of the summary, never a `close`. */
{
  X.rules = {classes: [{name: 'Fighter', hitDie: 'd8'}]};
  X.character = X.migrate({
    classes: [{name: 'Fighter', level: 1}],
    abilities: Object.assign(X.blankChar().abilities, {con: 14}),
    hp: {cur: 5, max: 20, temp: '', locked: false},
  });

  // a minimal per-id element: enough for openHdSpend()'s own wiring to find
  // hdTyped/hdApply/hdRollMe/mBody and for a full render pass (renderHP(),
  // renderHitDice(), recompute()) not to throw reaching for one
  const byId = {};
  const el = () => ({
    value: '', dataset: {}, disabled: false, hidden: false, readOnly: false,
    textContent: '', innerHTML: '', style: {}, children: [],
    classList: {toggle() {}, add() {}, remove() {}, contains: () => false},
    _on: {}, addEventListener(type, fn) { (this._on[type] = this._on[type] || []).push(fn); },
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    setAttribute() {}, removeAttribute() {}, focus() {}, remove() {},
  });
  const realGetById = ctx.document.getElementById, realOpen = ctx.openModal, realClose = ctx.closeModal;
  const log = [];
  ctx.document.getElementById = id => byId[id] || (byId[id] = el());
  ctx.openModal = t => log.push(['open', String(t)]);
  ctx.closeModal = () => log.push(['close']);

  const endsOnTheSummary = () =>
    log.length >= 2 && log[log.length - 1][0] === 'open' && /^Hit die spent/.test(log[log.length - 1][1]) &&
    !log.slice(1).some((e, i) => e[0] === 'close');   // no close AFTER the box's own open

  try {
    // (a) the Apply path, for a valid typed roll
    Object.keys(byId).forEach(k => delete byId[k]); log.length = 0;
    ctx.openHdSpend('d8');
    byId.hdTyped.value = '5';
    (byId.hdApply._on.click || []).forEach(fn => fn());
    ck('#103 fix1 Apply ends on the "Hit die spent" summary, not closed', endsOnTheSummary(), log);

    // (b) the Roll-for-me path — put the die back first
    X.character.hdUsed = {};
    Object.keys(byId).forEach(k => delete byId[k]); log.length = 0;
    ctx.openHdSpend('d8');
    (byId.hdRollMe._on.click || []).forEach(fn => fn());
    ck('#103 fix1 Roll for me ends on the "Hit die spent" summary too, not closed', endsOnTheSummary(), log);
  } finally {
    ctx.document.getElementById = realGetById; ctx.openModal = realOpen; ctx.closeModal = realClose;
  }
  X.character = X.blankChar(); X.rules = {};
}

/* ---- #103: the ability/skill layout setting is retired (spec decision 9) ----
   The strip and the Skills column replace "By ability". A saved statStyle
   stays in an old sheet (migrate() keeps every field) and nothing reads it.
   (Were the statStyle() fallback checks and the grouped markup's id contract,
   for builders that no longer exist.) */
ck('#103 a retired layout choice survives a round trip, unread',
   X.migrate(JSON.parse(JSON.stringify(X.migrate({id: 'k', statStyle: 'grouped'})))).statStyle === 'grouped');

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
/* #98: the category is a free-text group, as a journal tag is — one of the seven
   files there whatever its case, anything else is the player's own section */
ck("a category of the player's own is its own section", sec({category: 'Gear', sectionOverride: 'Spell Components'}) === 'Spell Components');
ck('...tidied as a tag is', sec({category: 'Gear', sectionOverride: '  Spell   Components '}) === 'Spell Components');
ck('a built-in section in any case files there', sec({category: 'Gear', sectionOverride: 'tools'}) === 'Tools' &&
   X.invSectionName('MAGIC ITEMS') === 'Magic Items');
ck('a blank category is no category', sec({category: 'Gear', sectionOverride: '   '}) === 'Gear' && X.invSectionName(7) === '7' &&
   X.invSectionName(null) === '' && X.invSectionName({}) === '');
ck('the favourites heading is not a section', sec({category: 'Gear', sectionOverride: '★ favorites'}) === 'Gear');
ck('a typed "consumables" is still read for its healing',
   !!X.detectItemUse({category: 'Gear', sectionOverride: 'consumables', description: 'You regain 2d4 + 2 Hit Points.'}));
{
  const it = (id, name, o) => Object.assign({id, name}, o || {});
  const g = X.invGroups([
    it('1', 'Rope', {category: 'Adventuring Gear'}),
    it('2', 'Eye of Newt', {sectionOverride: 'Spell Components'}),
    it('3', 'Dagger', {weapon: {dice: '1d4'}}),
    it('4', 'Bat Guano', {sectionOverride: 'spell components'}),
    it('5', 'Lockpicks', {sectionOverride: 'Burglary'}),
    it('6', 'Longsword', {weapon: {dice: '1d8'}, equipped: true}),
    it('7', 'Lucky Coin', {fav: true, sectionOverride: 'Burglary'}),
    it('8', 'Amulet', {fav: true}),
    it('9', 'Chalk', {sectionOverride: 'gear'})]);
  ck('sections run: favourites, the built-in seven in their order, then the player\'s own A to Z',
     g.map(x => x.title).join() === '★ Favorites,Weapons,Gear,Burglary,Spell Components', g.map(x => x.title));
  ck("...a player's section groups whatever the case, by its first spelling",
     g.find(x => x.title === 'Spell Components').items.map(i => i.name).join() === 'Bat Guano,Eye of Newt');
  ck('...a built-in name typed in lower case joins the built-in section',
     g.find(x => x.title === 'Gear').items.map(i => i.name).join() === 'Chalk,Rope');
  ck('...a starred item shows only in Favorites, by name', g[0].items.map(i => i.name).join() === 'Amulet,Lucky Coin' &&
     g.find(x => x.title === 'Burglary').items.length === 1);
  ck('...equipped first inside a section', g.find(x => x.title === 'Weapons').items.map(i => i.name).join() === 'Longsword,Dagger');
  ck('...and the favourites title is the shared label', X.INV_FAV === X.FEAT_FAV);
  ck('an empty or junk inventory has no sections', X.invGroups([]).length === 0 && X.invGroups(null).length === 0 &&
     X.invGroups([null, 7]).length === 0);
}

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
// #104 review finding 2: ×0 (reachable since Task 2's thrown weapons, and now
// from any item's own editor) must weigh and cost nothing — "||1" read it as ×1.
ck('a ×0 item weighs nothing', X.itemWeightTotal(item({weight: 3, qty: 0})) === 0);

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
// #104 review finding 2
sheet({inventory: [item({weight: 3, cost: 5}), item({weight: 7, cost: 11, qty: 0})]});
ck('a ×0 item adds no weight to carriedWeight()', X.carriedWeight() === 3);
ck('...and no value to inventoryTotal()', X.inventoryTotal() === 5);

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

/* #98: a feature files under its SOURCE — the label on its row, which the
   player edits — and only when it has none, under where it came from */
{
  const MAP = {kind: 'race', name: 'Mapach'}, BG = {kind: 'background', name: 'Wanderer'};
  const f = (id, name, origin, source, fav) => ({id, name, origin, source, fav, enabled: true});
  const list = [f('1', 'Climber', MAP, 'Mapach'), f('2', 'Darkvision', MAP, 'Mapach'), f('3', 'Resilience', MAP, 'Mapach'),
                f('4', 'Wanderer — Ability Scores', BG, 'Wanderer')];
  ck('granted features file under their source, which is where they came from',
     X.featGroups(list).map(g => g.label + ':' + g.items.length).join() === 'Mapach:3,Wanderer:1');
  list[0].source = 'Wanderer';
  const g = X.featGroups(list);
  ck('changing a source moves the feature into that group', g.map(g => g.label + ':' + g.items.length).join() === 'Mapach:2,Wanderer:2' &&
     g[1].items.map(x => x.name).join() === 'Climber,Wanderer — Ability Scores', g.map(g => g.label));
  ck("...while its origin stays, so removing the ancestry still takes it back", list[0].origin === MAP);
  list[0].source = 'Something Else';
  ck("a new source makes a new group, placed by its first feature: after the group that feature came from",
     X.featGroups(list).map(g => g.label).join() === 'Mapach,Something Else,Wanderer', X.featGroups(list).map(g => g.label));
  {
    const CLS = {kind: 'class', class: 'Fighter'};
    const three = [f('1', 'Climber', MAP, 'Mapach'), f('2', 'Darkvision', MAP, 'Mapach'), f('3', 'Second Wind', CLS, 'Fighter'),
                   f('4', 'Wanderer — Ability Scores', BG, 'Wanderer')];
    three[0].source = 'Wanderer';
    ck('moving a feature past a group between leaves every group where it was (review)',
       X.featGroups(three).map(g => g.label).join() === 'Mapach,Fighter,Wanderer', X.featGroups(three).map(g => g.label));
    const cfirst = [f('3', 'Second Wind', CLS, 'Wanderer'), f('5', 'Action Surge', CLS, 'Fighter'), f('1', 'Climber', MAP, 'Mapach'),
                    f('4', 'Wanderer — Ability Scores', BG, 'Wanderer')];
    ck('...whichever group the moved feature started in',
       X.featGroups(cfirst).map(g => g.label).join() === 'Fighter,Mapach,Wanderer', X.featGroups(cfirst).map(g => g.label));
    three[0].source = 'Climbing';
    three[1].source = 'Senses';
    ck('...and groups named only by a source follow the group their first feature came from, in order',
       X.featGroups(three).map(g => g.label).join() === 'Climbing,Senses,Fighter,Wanderer', X.featGroups(three).map(g => g.label));
  }
  ck('...and a group only a moved feature names, with its origin group emptied, still lists in grant order',
     X.featGroups([f('1', 'A', MAP, 'Wanderer'), f('2', 'B', BG, 'Wanderer'), f('3', 'C', {kind: 'class', class: 'Rogue'}, 'Rogue')])
       .map(g => g.label + ':' + g.items.length).join() === 'Wanderer:2,Rogue:1');
  list[0].source = 'mapach';
  ck('a source in another case joins the group, labelled by the first spelling met, as journal tags are',
     X.featGroups(list).map(g => g.label + ':' + g.items.length).join() === 'mapach:3,Wanderer:1', X.featGroups(list).map(g => g.label));
  list[0].source = '';
  ck('an empty source files where the feature came from', X.featGroupLabel(list[0]) === 'Mapach');
  ck('a source reading as the favourites heading files by origin', X.featGroupLabel(f('9', 'X', MAP, '★ favorites')) === 'Mapach');
  ck("...and a picked trait's own source is its group", X.featGroupLabel(f('9', 'Agonizing Blast', null, 'Eldritch Invocation')) === 'Eldritch Invocation');
  ck('what an empty source would file under ignores the source', X.featOriginLabel(f('9', 'X', BG, 'Mapach')) === 'Wanderer' &&
     X.featOriginLabel(f('9', 'X', null, 'Mapach')) === 'Other');
  ck('a starred feature still moves to Favorites whatever its source',
     X.featGroups([f('1', 'Climber', MAP, 'Wanderer', true)]).map(g => g.label).join() === X.FEAT_FAV);
}

/* #98: the one group field — the journal's tag box, now shared by the tags, a
   feature's source and an item's category */
{
  ck('the choices are deduped whatever the case, first spelling kept, A to Z, blanks and junk dropped',
     JSON.stringify(X.groupChoices(['Weapons', 'burglary', ' ', 'Burglary', null, 'armor  kit', 'Armor Kit', 7])) ===
     JSON.stringify(['7', 'armor kit', 'burglary', 'Weapons']), X.groupChoices(['Weapons', 'burglary', ' ', 'Burglary', null, 'armor  kit', 'Armor Kit', 7]));
  ck('...and no list is no choices', X.groupChoices(undefined).length === 0);
  const h = X.groupFieldHTML({id: 'fSrc', list: 'fSrcGroups', label: 'Source', value: 'Mapach', choices: ['Mapach', 'Wanderer'], placeholder: 'Automatic (Other)'});
  ck('it is a labelled box tied to its list of groups, with a place for its message',
     /<label class="f" for="fSrc">Source<\/label><input id="fSrc" value="Mapach" list="fSrcGroups" placeholder="Automatic \(Other\)" autocomplete="off" data-groupfield aria-describedby="fSrcMsg">/.test(h) &&
     /<datalist id="fSrcGroups"><option value="Mapach"><option value="Wanderer"><\/datalist><p class="grp-msg" id="fSrcMsg" aria-live="polite"><\/p>/.test(h), h);
  const evil = X.groupFieldHTML({id: 'x', list: 'y', label: '<b>', value: '"><i>', choices: ['"><i>'], placeholder: '"><i>'});
  ck('...and escapes everything a player typed', !/<i>|<b>/.test(evil), evil);
  ck("the journal editor's tag is that field", /id="jnlTag" data-jnlfield="tag" value="Quests" list="jnlTags"/.test(
     X.journalEditorHTML({id: 'p', title: 't', tag: 'Quests', text: ''}, ['Quests'])));
  ck("...and the tracker form's", /id="tkTag" value="Kills" list="tkTags"/.test(X.trackerFormHTML({type: 'counter', tag: 'Kills'}, ['Kills'], true)));
  const forms = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '80-modal-forms.js'), 'utf8');
  const body = name => (forms.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')) || [''])[0];
  ck("the feature form's Source and the item form's Category are that field too",
     /groupFieldHTML\(\{id:"fSrc"/.test(body('openFeatureForm')) && /groupFieldHTML\(\{id:"iCategory"/.test(body('openItemForm')) &&
     !/<select id="iCategory">/.test(forms) && !/<input id="fSrc"/.test(forms));
  /* a reserved name (#98 follow-up): every name Object.prototype carries.
     The collapse maps are plain objects, so "constructor" read an inherited
     function (folded from the start) and "__proto__" could never fold. */
  ck('the reserved names are every Object.prototype name, lower-cased',
     ['constructor', '__proto__', 'tostring', 'valueof', 'hasownproperty', 'isprototypeof'].every(n => X.GROUP_RESERVED.has(n)) &&
     !X.GROUP_RESERVED.has('kills'));
  ck('a reserved name is no group, whatever its case or spacing',
     ['constructor', 'Constructor', '  __proto__ ', 'toString', 'VALUEOF'].every(n => X.tagLabel(n) === '') &&
     X.tagLabel('Constructors') === 'Constructors' && X.tagTidy(' __proto__ ') === '__proto__');
  ck('...so tags read from a file never make one: they read as Untagged',
     JSON.stringify(X.groupByTag([{tag: 'constructor'}, {tag: '__proto__'}, {tag: 'Kills'}], x => x.tag).map(g => g.key)) === '["kills",""]');
  ck("...a feature with that source files where it came from, an item with that category where its data puts it",
     X.featGroupLabel({source: 'constructor', origin: {kind: 'race', name: 'Elf'}}) === 'Elf' &&
     X.invSectionName('__proto__') === '' && X.invSection({name: 'x', category: 'Gear', sectionOverride: 'toString'}) === 'Gear');
  ck('...and it is never offered as a choice, nor shown in the box', X.groupChoices(['constructor', 'Kills', '__proto__']).join() === 'Kills' &&
     /value=""/.test(X.groupFieldHTML({id: 'z', list: 'zl', label: 'Tag', value: 'constructor', choices: []})));
  ck('typing one is named in a message; anything else is fine',
     /“constructor” is a reserved word/.test(X.groupNameProblem(' constructor ')) && X.groupNameProblem('Kills') === '' && X.groupNameProblem('') === '');
  {
    const attrs = {};
    const box = {id: 'tkTag', value: '__proto__', focused: false, focus() { this.focused = true; },
                 setAttribute(k, v) { attrs[k] = v; }, removeAttribute(k) { delete attrs[k]; }};
    ck('the message shows under the box, which reads as invalid', /“__proto__”/.test(X.syncGroupFieldMsg(box)) && attrs['aria-invalid'] === 'true');
    box.value = 'Kills';
    ck('...and clears once the name changes', X.syncGroupFieldMsg(box) === '' && !('aria-invalid' in attrs));
    const realGet = ctx.document.getElementById;
    box.value = 'Constructor';
    ctx.document.getElementById = id => (id === 'tkTag' ? box : realGet(id));
    const blocked = X.groupFieldBlocked('tkTag');
    box.value = 'Kills'; box.focused = false;
    const allowed = X.groupFieldBlocked('tkTag');
    ctx.document.getElementById = realGet;
    ck('a save stops on a reserved name, with the box focused, and goes ahead on any other', blocked === true && allowed === false && box.focused === false);
  }
  const trk = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '87-trackers.js'), 'utf8');
  const jnl = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '87-journal.js'), 'utf8');
  const boot = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '90-boot.js'), 'utf8');
  ck('every save of a group field checks it first: the feature, item and tracker forms and the journal\'s Done',
     /getElementById\("fSave"\)\.addEventListener\("click",\(\)=>\{\s*if\(groupFieldBlocked\("fSrc"\)\)return;/.test(forms) &&
     /getElementById\("iSave"\)\.addEventListener\("click",\(\)=>\{\s*if\(groupFieldBlocked\("iCategory"\)\)return;/.test(forms) &&
     /\$\("tkSave"\)\.addEventListener\("click",\(\)=>\{\s*if\(groupFieldBlocked\("tkTag"\)\)return;/.test(trk) &&
     /addEventListener\("click",\(\)=>\{\s*if\(groupFieldBlocked\("tkTag"\)\)return;\s*const x=cur\(\);if\(!x\)\{closeModal\(\);renderTrackers\(\);return;\}\s*trkFromForm\(x,fields\(\)\);\s*if\(closing\)/.test(trk) &&
     /function jnlDone\(\)\{[\s\S]{0,200}if\(groupFieldBlocked\("jnlTag"\)\)return;/.test(jnl));
  ck('...and the box says so as it is typed', /closest\("\[data-groupfield\]"\);if\(g\)syncGroupFieldMsg\(g\)/.test(boot));
  ck('...and each saves what the group would show: a tidied source, a resolved category',
     /source:tagLabel\(document\.getElementById\("fSrc"\)\.value\)/.test(body('openFeatureForm')) &&
     /invSectionName\(document\.getElementById\("iCategory"\)\.value\)/.test(body('openItemForm')));
}

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

// ---------- #57: everything after a row's name is one group, which drops to its
// own line whole on a phone instead of the name running over its label
{
  const grouped = (html, del) => /<div class="top split">/.test(html) &&
    new RegExp('<span class="row-meta">[\\s\\S]*' + del).test(html) &&
    html.indexOf('class="nm"') < html.indexOf('class="row-meta"') && html.indexOf('class="row-meta"') < html.indexOf(del);
  const f = X.featItemHTML(Object.assign(feat('f9', 'Second Wind', CLS), {source: 'Fighter'}));
  ck('#57 a feature row groups its source, toggle and buttons after the name',
     grouped(f, 'data-del-feature') && f.indexOf('class="row-meta"') < f.indexOf('class="qty"'), f.slice(0, 900));
  const it = X.invItemHTML({id: 'i9', name: 'Potion of Greater Healing', qty: 3, cost: 150, weight: 0.5, category: 'Consumable'});
  ck('#57 an item row groups its counts, cost, weight and buttons after the name',
     grouped(it, 'data-del-item') && it.indexOf('class="row-meta"') < it.indexOf('×3'), it.slice(0, 900));
  // #104 review finding 2: a ×0 item (a thrown weapon out of throws, or any
  // item zeroed in the editor) must say ×0, not look like ×1 by showing nothing.
  const it0 = X.invItemHTML({id: 'i10', name: 'Dagger', qty: 0});
  ck('#104 a ×0 item shows ×0, not nothing', /class="qty">×0</.test(it0), it0.slice(0, 400));
  const it1 = X.invItemHTML({id: 'i11', name: 'Dagger', qty: 1});
  ck('...and ×1 still shows no badge, as before', !/class="qty">×/.test(it1), it1.slice(0, 400));
  const st = X.statusRowHTML({id: 's9', name: 'Frightened'});
  ck('#57 a condition row groups its toggle and buttons after the name', grouped(st, 'data-del-status'), st.slice(0, 700));
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

// A rules pack can use a literal `*` for its own footnote convention. A single *
// must stay literal: this is why descHTML is bold-only and not noteInline.
['You gain the Keen Senses* trait.',
 'you can use Keen Senses* without a free hand',
 'Traits marked with an asterisk (*) require a long rest to reset.'].forEach(s => {
  const out = X.descHTML(s);
  ck('a lone asterisk stays literal: ' + s.slice(0, 28),
     out.indexOf('*') > -1 && out.indexOf('<strong>') === -1 && out.indexOf('<em>') === -1, out);
});
ck('two lone asterisks in one string do not pair up',
   X.descHTML('cast farsight* and trueshot* freely').indexOf('<em>') === -1);

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
  {name: 'Glide', description: 'A probe feat that shares its name with a trait.'},
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

/* ---- timed conditions: reading, wording, the clock (#55) ----
   Design: src/docs/specs/2026-10-06-timed-conditions-design.md §3, §4. */
{
  ck('a duration is whole seconds above 0, else untimed',
     X.statusDuration({durationSec: 18}) === 18 && X.statusDuration({durationSec: '60'}) === 60 &&
     X.statusDuration({durationSec: 0}) === 0 && X.statusDuration({durationSec: -6}) === 0 &&
     X.statusDuration({durationSec: 'x'}) === 0 && X.statusDuration({}) === 0 && X.statusDuration(null) === 0);
  ck('the Concentrating condition is never timed', X.statusDuration({concId: 'a1', durationSec: 60}) === 0 &&
     !X.statusTimed({concId: 'a1', durationSec: 60}) && X.statusTimed({durationSec: 6}));
  ck('elapsed time reads as 0 when junk or negative', X.statusElapsed({elapsedSec: 12}) === 12 &&
     X.statusElapsed({elapsedSec: -5}) === 0 && X.statusElapsed({elapsedSec: 'x'}) === 0 && X.statusElapsed({}) === 0);
  const t = X.fmtStatusTime;
  ck('time left in rounds up to a minute', t(1) === '1 round' && t(6) === '1 round' && t(18) === '3 rounds' && t(60) === '10 rounds');
  ck('...then minutes, rounded up', t(66) === '2 min' && t(120) === '2 min' && t(3540) === '59 min');
  ck('...then hours and minutes', t(3599) === '1 h' && t(3600) === '1 h' && t(5400) === '1 h 30 min');
  ck('a row says the time left while active', X.statusTimeText({active: true, durationSec: 18, elapsedSec: 6}) === '2 rounds left');
  ck('...and its length while cleared', X.statusTimeText({active: false, durationSec: 18}) === 'lasts 3 rounds' &&
     X.statusTimeText({active: false, durationSec: 60}) === 'lasts 1 min' &&
     X.statusTimeText({active: false, durationSec: 3600}) === 'lasts 1 h' &&
     X.statusTimeText({active: false, durationSec: 6}) === 'lasts 1 round');
  ck('...and nothing when untimed', X.statusTimeText({active: true}) === '' && X.statusTimeText({active: true, concId: 'a', durationSec: 60}) === '');
  ck('the form shows a duration in the largest unit that divides it',
     JSON.stringify([X.statusUnitFor(60), X.statusUnitFor(18), X.statusUnitFor(5400), X.statusUnitFor(7200), X.statusUnitFor(0)]) ===
     JSON.stringify([[1, 'minutes'], [3, 'rounds'], [90, 'minutes'], [2, 'hours'], ['', 'rounds']]));
  ck('the toast names what ran out', X.statusExpiredText(['Poisoned']) === 'Poisoned has run out' &&
     X.statusExpiredText(['Poisoned', 'Frightened']) === 'Poisoned and Frightened have run out' &&
     X.statusExpiredText(['A', 'B', 'C', 'D']) === 'A, B and 2 more have run out');
  ck('the Undo toast names what came back (final review, #55)', X.statusBackText(['Poisoned']) === 'Poisoned is back' &&
     X.statusBackText(['Poisoned', 'Frightened']) === 'Poisoned and Frightened are back' &&
     X.statusBackText(['A', 'B', 'C', 'D']) === 'A, B and 2 more are back');

  const c = {statuses: [{id: 'p', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 12},
                        {id: 'u', name: 'Blessed', active: true},
                        {id: 'x', name: 'Prone', active: false, durationSec: 18, elapsedSec: 0}, null, 'junk']};
  const ran = X.tickStatuses(c, 6);
  ck('a step clears a condition that reaches its duration and reports it with its time before the step',
     JSON.stringify(ran) === JSON.stringify([{id: 'p', name: 'Poisoned', was: 12}]) &&
     c.statuses[0].active === false && c.statuses[0].elapsedSec === 18);
  ck('...leaving untimed, cleared and junk entries alone', !('elapsedSec' in c.statuses[1]) && c.statuses[2].elapsedSec === 0);
  const back = {statuses: [{id: 'p', active: true, durationSec: 18, elapsedSec: 18}]};
  ck('a step back never clears anything', X.tickStatuses(back, -6).length === 0 &&
     back.statuses[0].active === true && back.statuses[0].elapsedSec === 12);
  ck('...and stops at 0', (() => { const z = {statuses: [{id: 'z', active: true, durationSec: 18, elapsedSec: 0}]};
     X.tickStatuses(z, -6); return z.statuses[0].elapsedSec === 0; })());
  const one = {statuses: [{id: 'a', active: true, durationSec: 60, elapsedSec: 0}, {id: 'b', active: true, durationSec: 60, elapsedSec: 0}]};
  X.tickStatuses(one, 6, 'b');
  ck('a step for one condition moves only it', one.statuses[0].elapsedSec === 0 && one.statuses[1].elapsedSec === 6);
  ck('a character with no list of statuses steps nothing', X.tickStatuses({statuses: 'junk'}, 6).length === 0 &&
     X.tickStatuses(null, 6).length === 0);
  ck('restarting a timed condition starts its full time again', (() => {
     const s = {durationSec: 18, elapsedSec: 18}; X.restartStatus(s); return s.elapsedSec === 0; })());
  ck('...and leaves an untimed one alone', (() => { const s = {}; X.restartStatus(s); return !('elapsedSec' in s); })());
}

/* ---- timed conditions on the sheet: the round, the row, running out (#55) ---- */
{
  const mk = () => {
    const c = X.blankChar(); X.character = c;
    c.statuses = [{id: 'p', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 0, effects: []},
                  {id: 'f', name: 'Frightened', active: true, durationSec: 12, elapsedSec: 6, effects: []},
                  {id: 'u', name: 'Blessed', active: true, effects: []},
                  {id: 'x', name: 'Prone', active: false, durationSec: 18, elapsedSec: 0, effects: []}];
    X.combatStart(c);
    return c;
  };
  let c = mk();
  X.advanceRound(1);
  ck('the next round moves every active timed condition on 6 seconds', c.statuses[0].elapsedSec === 6);
  ck('...one brought to its duration clears itself, its time kept at the duration',
     c.statuses[1].active === false && c.statuses[1].elapsedSec === 12);
  ck('...an untimed one and a cleared one do not move', !('elapsedSec' in c.statuses[2]) && c.statuses[3].elapsedSec === 0);
  c = mk(); c.statuses[0].elapsedSec = 6;
  X.advanceRound(-1);
  ck('at round 1 in combat, the previous round moves no condition', c.combatRound === 1 && c.statuses[0].elapsedSec === 6);
  c = mk(); c.statuses[0].elapsedSec = 12;
  X.advanceRound(1);
  ck('several can run out on one step', c.statuses[0].active === false && c.statuses[1].active === false);

  c = mk();
  const ran = X.tickStatuses(c, 6);
  const rec = X.announceStatusExpiry(ran);
  ck('a step that ran something out puts up a toast with what Undo needs', !!rec && rec.ran.length === 1 && rec.ran[0].id === 'f');
  ck('an Undo shown for another character does nothing', X.undoStatusExpiry(rec, X.blankChar()) === false && c.statuses[1].active === false);
  ck("this character's Undo brings it back, at its time before the step",
     X.undoStatusExpiry(rec, c) === true && c.statuses[1].active === true && c.statuses[1].elapsedSec === 6);
  ck('...once only', X.undoStatusExpiry(rec, c) === false);
  ck('nothing ran out: no toast', X.announceStatusExpiry([]) === null);
  c = mk();
  const rec2 = X.announceStatusExpiry(X.tickStatuses(c, 12));
  c.statuses = c.statuses.filter(s => s.id !== 'f');
  ck('an Undo skips a condition deleted since', X.undoStatusExpiry(rec2, c) === true && c.statuses.every(s => s.id !== 'f'));

  c = mk();
  X.stepStatusTap('p', 6, false);
  ck('+ rd moves only that condition', c.statuses[0].elapsedSec === 6 && c.statuses[1].elapsedSec === 6);
  X.stepStatusTap('p', -6, false); X.stepStatusTap('p', -6, false);
  ck('− rd stops at 0', c.statuses[0].elapsedSec === 0);
  X.stepStatusTap('f', 6, false);
  ck('+ rd to the end clears it', c.statuses[1].active === false);

  c = X.blankChar(); X.character = c;
  c.statuses = [{id: 'q', name: 'Poisoned', active: false, durationSec: 60, elapsedSec: 60, effects: []}];
  ck('an item reactivating a timed condition restarts it', X.addStatusByName('Poisoned') === 'reactivated' && c.statuses[0].elapsedSec === 0);
  c.statuses[0].elapsedSec = 24;
  ck('...one already active keeps running', X.addStatusByName('Poisoned') === 'already' && c.statuses[0].elapsedSec === 24);

  const row = X.statusRowHTML({id: 'p', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 6});
  ck('an active timed row shows its time left and the round buttons',
     /2 rounds left/.test(row) && /data-status-tick="p" data-sec="-6"/.test(row) && /data-status-tick="p" data-sec="6"/.test(row), row);
  const off = X.statusRowHTML({id: 'p', name: 'Poisoned', active: false, durationSec: 60, elapsedSec: 60});
  ck('a cleared one shows its length and no round buttons', /lasts 1 min/.test(off) && !/data-status-tick/.test(off), off);
  const plain = X.statusRowHTML({id: 'b', name: 'Blessed', active: true});
  ck('an untimed row is as it was', !/st-time/.test(plain) && !/data-status-tick/.test(plain));
  ck('the Concentrating row is never timed', !/data-status-tick|st-time/.test(
     X.statusRowHTML({id: 'cc', name: 'Concentrating', active: true, concId: 'a1', durationSec: 60})));
  ck('the time sits under the name, not in the top line', !/class="top"[^]*st-time[^]*<\/div>\s*<div class="use-row/.test(row) && /use-row st-row"><span class="use-lbl st-time">2 rounds left/.test(row), row);

  const saved = Object.assign(X.blankChar(), {statuses: [{id: 'p', name: 'Poisoned', description: '', active: true, durationSec: 18, elapsedSec: 6, effects: []}]});
  const back = X.migrate(JSON.parse(JSON.stringify(saved))).statuses[0] || {};
  ck('a timed condition survives a save and a load', back.durationSec === 18 && back.elapsedSec === 6, back);
  X.character = X.blankChar();
}

/* ---- compact stats in the combat view are read-only (#62) ---- */
{
  /* two fake cards: closest('#cvList') follows each card's inView flag */
  const card = inView => {
    const c = {inView, ctls: [{disabled: false}, {disabled: false}, {disabled: false}]};
    c.closest = sel => (sel === '#cvList' && c.inView ? {} : null);
    c.querySelectorAll = sel => (sel === 'input[data-path],button.dot' ? c.ctls : []);
    return c;
  };
  const a = card(true), b = card(false);
  const doc = {querySelectorAll: sel => (sel === '[data-note="abilities"],[data-note="skills"]' ? [a, b] : [])};
  X.syncStatLock(doc);
  ck('inside the combat view the score boxes and proficiency dots are disabled', a.ctls.every(x => x.disabled === true));
  ck('...and at home they are not', b.ctls.every(x => x.disabled === false));
  X.syncStatLock(doc);
  ck('...and running it again changes nothing', a.ctls.every(x => x.disabled === true) && b.ctls.every(x => x.disabled === false));
  a.inView = false; b.inView = true;
  X.syncStatLock(doc);
  ck('a card that goes home is editable again, and one that comes in is locked',
     a.ctls.every(x => x.disabled === false) && b.ctls.every(x => x.disabled === true));
  ck('nothing to look in: nothing happens', (() => { try { X.syncStatLock({querySelectorAll: () => []}); return true; } catch (e) { return false; } })());
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

/* ---- hideable edit buttons: the field and the toggle (#97, spec §3, §5) ---- */
{
  ck('#97 a new character shows every card\'s edit buttons',
     JSON.stringify(X.blankChar().editHide) === '{}' && X.EDIT_CARDS.every(k => !X.editHidden(X.blankChar(), k)));
  // #103: class and origin leave (their Remove sits behind the header's flyout
  // and window, with a confirm); defences and proficiencies joined in Task 4
  // #103 final review I-3: familiars leaves (its card is hidden on the Sheet)
  // #91: the Party card joins (eleven → twelve)
  ck('#97 the twelve cards', JSON.stringify(X.EDIT_CARDS) ===
     JSON.stringify(['statuses', 'attacks', 'resources', 'features', 'spells', 'inventory', 'trackers', 'journal', 'secnotes', 'defences', 'proficiencies', 'party']));
  ck('#97 a sheet from before, and junk, read as {}',
     JSON.stringify(X.migrate({abilities: {}}).editHide) === '{}' &&
     ['x', [], null, 7].every(v => JSON.stringify(X.migrate({abilities: {}, editHide: v}).editHide) === '{}'));
  const c = X.blankChar();
  X.setEditHidden(c, 'features', true);
  ck('#97 hiding is stored as true, and read back', c.editHide.features === true && X.editHidden(c, 'features') && !X.editHidden(c, 'inventory'));
  X.setEditHidden(c, 'features', false);
  ck('#97 showing again removes the key', !('features' in c.editHide) && !X.editHidden(c, 'features'));
  X.setEditHidden(c, 'portrait', true); X.setEditHidden(c, '__proto__', true);
  ck('#97 a key that is not a card is never written', JSON.stringify(c.editHide) === '{}');
  ck('#97 only a true value hides',
     ['yes', 1, null, {}].every(v => !X.editHidden({editHide: {features: v}}, 'features')) &&
     X.editHidden({editHide: {features: true}}, 'features'));
  ck('#97 a stored key that is not a card does nothing, and junk maps read as shown',
     !X.editHidden({editHide: {portrait: true}}, 'portrait') && !X.editHidden({editHide: 'x'}, 'features') && !X.editHidden(null, 'features'));
  const saved = Object.assign(X.blankChar(), {editHide: {inventory: true, portrait: true}});
  const back = X.migrate(JSON.parse(JSON.stringify(saved)));
  ck('#97 the field survives a save and load, an unknown key untouched',
     back.editHide.inventory === true && back.editHide.portrait === true && X.editHidden(back, 'inventory'));
  ck('#97 each card has a title',
     X.editCardTitle('features') === 'Features & Traits' && X.editCardTitle('journal') === 'Journal' &&
     X.editCardTitle('secnotes') === 'Section Notes' && X.EDIT_CARDS.every(k => X.editCardTitle(k)));
  const shown = X.editToggleHTML('features', false), hidden = X.editToggleHTML('features', true);
  ck('#97 the toggle carries its card and its state',
     shown.includes('data-edtoggle="features"') && shown.includes('aria-pressed="false"') && shown.includes('class="edbtn"') &&
     hidden.includes('aria-pressed="true"') && hidden.includes('class="edbtn on"'));
  ck('#97 it says what it will do, and to which card',
     shown.includes('title="Hide edit buttons"') && shown.includes('aria-label="Hide edit buttons — Features &amp; Traits"') &&
     hidden.includes('title="Show edit buttons"') && hidden.includes('aria-label="Show edit buttons — Features &amp; Traits"'));
  ck('#97 hidden wears a slash, shown does not', hidden.includes('M3 3l18 18') && !shown.includes('M3 3l18 18'));
  const t = X.editToggleText('trackers', true);
  ck('#97 the repaint text matches the markup', t.title === 'Show edit buttons' && t.label === 'Show edit buttons — Trackers');
  ck('#97 the toggle never uses the bio Edit button\'s names', !/editbtn|data-edit=/.test(shown + hidden));
}

/* ---- hideable edit buttons: the rows (#97, spec §4, §6) ---- */
{
  const ed = (h, attr) => new RegExp('<button[^>]*class="[^"]*\\bed\\b[^"]*"[^>]*' + attr + '=').test(h);
  ck('#97 a feature row\'s edit and delete carry ed', ed(X.featItemHTML({id: 'f', name: 'Rage'}), 'data-edit-feature') && ed(X.featItemHTML({id: 'f', name: 'Rage'}), 'data-del-feature'));
  ck('#97 an item row\'s edit and delete carry ed', ed(X.invItemHTML({id: 'i', name: 'Rope'}), 'data-edit-item') && ed(X.invItemHTML({id: 'i', name: 'Rope'}), 'data-del-item'));
  ck('#97 a status row\'s edit and remove carry ed', ed(X.statusRowHTML({id: 's', name: 'poisoned'}), 'data-edit-status') && ed(X.statusRowHTML({id: 's', name: 'poisoned'}), 'data-del-status'));
  // #103: the class chip went with the Class card; its Remove is the flyout's
  ck('#97 a class\'s Remove carries ed', ed(X.classFlyHTML({classes: [{name: 'Fighter', level: 3, subclass: null}]}, 0), 'data-del-class'));
  ck('#97 a tracker\'s pencil carries ed', ed(X.trkEditHTML({id: 't', name: 'Kills'}), 'data-trkedit'));
  ck('#97 a section note\'s pencil carries ed', ed(X.noteEntryHTML(X.noteDef('features')), 'data-noteedit'));
  const page = {id: 'p', title: 'x', text: ''};
  X.character = X.blankChar();
  ck('#97 a page\'s Edit and Delete carry ed', ed(X.journalPageHTML(page), 'data-jnledit') && ed(X.journalPageHTML(page), 'data-jnldel'));
  ck('#97 a blank page says tap Edit while Edit shows', X.journalPageHTML(page).includes('Nothing written yet — tap Edit.'));
  X.setEditHidden(X.character, 'journal', true);
  ck('#97 and only "Nothing written yet." while it is hidden',
     X.journalPageHTML(page).includes('Nothing written yet.') && !X.journalPageHTML(page).includes('tap Edit'));
  X.character = X.blankChar();
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
  /* #80: the Combat tab acts like every tab — no ✕ (picking another tab, or the
     swords again, leaves it) and no ☰ of its own (the tab bar's one served it
     until #103 retired it; none may come back here) */
  ck('#80 the header has no ✕ and no ☰ of its own',
     !h.includes('id="cvClose"') && !h.includes('id="cvToc"') && !/✕|☰/.test(h), h);
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
  ck('#80 ...in combat too', !r3.includes('id="cvClose"') && !r3.includes('id="cvToc"') && !/✕|☰/.test(r3), r3);

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

/* ---- checklists in a note: the grammar, the toggle, the count (#95)
   Design: src/docs/specs/2026-10-17-journal-checklists-design.md §4. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const h = X.noteHTML('[ ] find the map\n[x] cross the Mire\n- [] meet Brindle\n   * [X] pay him');
  ck('#95 checkbox lines become one list of four', (h.match(/<li>/g) || []).length === 4 && h.includes('<ul class="n-ck">'), h);
  ck('#95 each box is a checkbox button with its ordinal',
     /<button type="button" class="ck" role="checkbox" aria-checked="false" data-ck="0"/.test(h) &&
     /aria-checked="true" data-ck="1"/.test(h) && /aria-checked="false" data-ck="2"/.test(h) && /aria-checked="true" data-ck="3"/.test(h), h);
  ck('#95 the text follows the box, the bullet dropped', h.includes('<span class="ck-t">meet Brindle</span>') && !h.includes('- meet'));
  ck('#95 a box is named by its item, its state left to aria-checked',
     /aria-checked="false" data-ck="0" aria-label="find the map"/.test(h) && /aria-checked="true" data-ck="1" aria-label="cross the Mire"/.test(h) &&
     !h.includes('aria-label="Checked"') && !h.includes('aria-label="Not checked"'), h);
  const marked = X.noteHTML('[ ] buy **rope** and `chalk`, *quickly*');
  ck('#95 ...in plain words: the emphasis and code marks dropped', marked.includes('aria-label="buy rope and chalk, quickly"'), marked);
  const txt = X.noteHTML('[x]y\nsee [x] mid-line\n[]\n[ ] \n> [ ] quoted');
  ck('#95 a marker glued to its text, mid-line, alone, or inside a quote is text', !txt.includes('n-ck') && !txt.includes('data-ck'), txt);
  const two = X.noteHTML('[ ] a\n[ ] b\n\nplain\n\n[x] c');
  ck('#95 two runs are two lists, ordinals continuing', (two.match(/<ul class="n-ck">/g) || []).length === 2 && two.includes('data-ck="2"'), two);
  const unb = X.noteHTML('[ ] **start\n[ ] end**');
  ck('#95 emphasis cannot span two items (each is rendered alone)', !/<strong>[^<]*<\/span><\/li>/.test(unb) && unb.includes('**start') && unb.includes('end**'), unb);
  const bul = X.noteHTML('- one\n- [ ] two\n- three');
  ck('#95 a checkbox line ends a bullet list and starts its own block', bul.indexOf('</ul>') < bul.indexOf('n-ck') && (bul.match(/<ul/g) || []).length === 3, bul);
  const hostile = X.noteHTML('[x] <script>alert(1)</script> "quoted"');
  ck('#95 the item text is escaped like any block', !hostile.includes('<script>') && hostile.includes('&lt;script&gt;'), hostile);
  ck('#95 ...and so is the box\'s name', hostile.includes('aria-label="&lt;script&gt;alert(1)&lt;/script&gt; &quot;quoted&quot;"'), hostile);
  ck('#95 no sentinel leaks', !/[\uE000-\uE00F]/.test(h + two + unb));

  const list = X.noteCheckboxes('intro\n[ ] a\n\n- [x] b\n[X] c\nnot [ ] one');
  ck('#95 noteCheckboxes() lists the checkbox lines with their line numbers',
     same(list, [{line: 1, checked: false, text: 'a'}, {line: 3, checked: true, text: 'b'}, {line: 4, checked: true, text: 'c'}]), list);
  ck('#95 noteCheckboxes() and noteHTML() agree on the count', list.length === (X.noteHTML('intro\n[ ] a\n\n- [x] b\n[X] c\nnot [ ] one').match(/data-ck=/g) || []).length);
  const sen = '\uE005[ ] a\n[ ] b';
  ck('#95 ...even on a line that starts with a sentinel character: two drawn, two counted',
     (X.noteHTML(sen).match(/data-ck=/g) || []).length === 2 && X.noteCheckboxes(sen).length === 2, X.noteCheckboxes(sen));
  ck('#95 ...and the first box flips the first line', X.toggleCheckbox(sen, 0) === '\uE005[x] a\n[ ] b' && X.toggleCheckbox(sen, 1) === '\uE005[ ] a\n[x] b');
  const src = 'title\n  - [] a\n[x] b  \nplain **x**\n[X] c';
  ck('#95 toggleCheckbox() flips only the named line, normalising the marker',
     X.toggleCheckbox(src, 0) === 'title\n  - [x] a\n[x] b  \nplain **x**\n[X] c' &&
     X.toggleCheckbox(src, 1) === 'title\n  - [] a\n[ ] b  \nplain **x**\n[X] c' &&
     X.toggleCheckbox(src, 2) === 'title\n  - [] a\n[x] b  \nplain **x**\n[ ] c', X.toggleCheckbox(src, 0));
  ck('#95 ...every other byte stays', X.toggleCheckbox(src, 1).split('\n').filter((l, i) => i !== 2).join('\n') === src.split('\n').filter((l, i) => i !== 2).join('\n'));
  ck('#95 ...out of range returns the text as it was', X.toggleCheckbox(src, 9) === src && X.toggleCheckbox(src, -1) === src && X.toggleCheckbox(null, 0) === '');
  ck('#95 ...twice is the original, its marker normalised', X.toggleCheckbox(X.toggleCheckbox(src, 1), 1) === src &&
     X.toggleCheckbox(X.toggleCheckbox(src, 0), 0) === src.replace('- [] a', '- [ ] a'));
  ck('#95 CRLF text still names the right line, and comes back LF', X.toggleCheckbox('a\r\n[ ] b\r\n[ ] c', 1) === 'a\n[ ] b\n[x] c');
  ck('#95 noteProgress() counts', same(X.noteProgress('[x] a\n[ ] b\n[x] c'), {done: 2, total: 3}) &&
     same(X.noteProgress('no boxes'), {done: 0, total: 0}) && same(X.noteProgress(''), {done: 0, total: 0}));
  const pv = X.notePreview('[ ] find\n[x] found\n- bullet');
  ck('#95 the hover preview shows a box glyph, never a button', pv.includes('☐ find') && pv.includes('☑ found') && pv.includes('• bullet') && !pv.includes('<button'), pv);
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

/* ---- the journal: tags, order, search, the page rule, the stamp ----
   Design: src/docs/specs/2026-09-29-journal-design.md §3, §5. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // tags
  ck('a tag is trimmed and its runs of spaces collapsed', X.tagLabel('  Side   quests ') === 'Side quests');
  ck('it groups by its lower-cased form', X.tagKey(' Side Quests') === 'side quests');
  ck('a missing or junk tag is untagged', X.tagLabel(undefined) === '' && X.tagLabel({}) === '' && X.tagKey(['a']) === '');
  ck('a number from a hand-edited file is still a tag', X.tagLabel(7) === '7');
  const g = X.groupByTag([{tag: 'quests'}, {}, {tag: 'NPCs'}, {tag: 'Quests'}, {tag: '  '}], x => x.tag);
  ck('groups run A to Z, Untagged last', same(g.map(x => x.key), ['npcs', 'quests', '']), g.map(x => x.key));
  ck('a group is labelled by the first spelling met', g[1].label === 'quests');
  ck('the untagged group is labelled Untagged and holds blanks too', g[2].label === 'Untagged' && g[2].items.length === 2);
  ck('a group keeps the order it was given', g[1].items[0].tag === 'quests' && g[1].items[1].tag === 'Quests');
  ck('a selector for a tag with quotes cannot break querySelector',
     X.attrSel('data-x', 'Bob\'s "crew"\\') === '[data-x="Bob\'s \\"crew\\"\\\\"]', X.attrSel('data-x', 'Bob\'s "crew"\\'));
  /* A raw newline inside a CSS string is a syntax error, and querySelector
     throws on one: in trkAct() that throw came before scheduleSave(), so every
     tap on a tracker whose id held a newline went unsaved. CSS escapes it as a
     backslash, its hex code and a space. */
  ck('a selector for an id with a newline has no raw newline in it',
     !/[\n\r\f]/.test(X.attrSel('data-x', 'a\nb\rc\fd')) && X.attrSel('data-x', 'a\nb') === '[data-x="a\\a b"]',
     X.attrSel('data-x', 'a\nb\rc\fd'));

  // order
  const pages = [{id: 'a', at: 100}, {id: 'b', at: 300}, {id: 'c', at: 200}, {id: 'd'}, {id: 'e', at: 300}];
  ck('pages run newest created first, ties in their saved order', same(X.jnlSort(pages).map(p => p.id), ['b', 'e', 'c', 'a', 'd']));
  ck('...without reordering the list it was given', pages[0].id === 'a');
  ck('only page objects are pages',
     same(X.jnlPages({journal: [null, 'x', {id: 'k'}, ['y']]}).map(p => p.id), ['k']) &&
     same(X.jnlPages({journal: 'nope'}), []) && same(X.jnlPages(null), []));
  ck('a page with no title reads Untitled', X.jnlTitle({title: '  '}) === 'Untitled' && X.jnlTitle({title: 'Mire'}) === 'Mire');

  // search
  const p = {title: 'Session 3', tag: 'Sessions', text: 'We  crossed\nthe **Mire** at dusk.'};
  ck('a query is trimmed and its spaces collapsed', X.jnlQuery('  the   mire ') === 'the mire');
  ck('search matches the title, the tag or the text', X.jnlMatch(p, 'session 3') && X.jnlMatch(p, 'SESSIONS') && X.jnlMatch(p, 'dusk'));
  ck('...case-blind, across a line break', X.jnlMatch(p, X.jnlQuery('crossed the')));
  ck('...and not everything', !X.jnlMatch(p, 'goblin'));
  ck('an empty query matches every page', X.jnlMatch(p, ''));
  ck('regex characters in a query are just characters', !X.jnlMatch(p, '.*') && X.jnlMatch({text: 'cost (5 gp)'}, '(5 gp)'));
  const s = X.jnlSnippet(p.text, 'mire');
  ck('a text match gets a snippet with the match marked', s.includes('<mark>Mire</mark>'), s);
  ck('a title-only match gets no snippet', X.jnlSnippet(p.text, 'Session') === '');
  ck('the snippet is escaped', (() => { const h = X.jnlSnippet('a <b>bold</b> mire', 'mire'); return h.includes('&lt;b&gt;') && !h.includes('<b>'); })());
  ck('...the match inside it too', X.jnlSnippet('x <i> y', '<i>').includes('<mark>&lt;i&gt;</mark>'));
  ck('a long text is cut either side, with an ellipsis',
     (() => { const h = X.jnlSnippet('a'.repeat(200) + ' mire ' + 'b'.repeat(200), 'mire', 10); return h.startsWith('…') && h.endsWith('…') && h.length < 60; })());
  ck('the match stays aligned where lower-casing would change the length',
     X.jnlSnippet('İİİİ İİ the mire', 'mire').includes('<mark>mire</mark>'), X.jnlSnippet('İİİİ İİ the mire', 'mire'));
  ck('the notes placeholders are stripped, so none reaches the page', !/[\uE000-\uE00F]/.test(X.jnlSnippet('mire\uE001x', 'mire')));

  // the page rule
  const c = {journal: []}, draft = {id: 'n1', at: null};
  ck('a blank draft adds nothing, even with a tag',
     X.jnlSavePage(c, draft, {title: ' ', tag: 'Sessions', text: '\n'}, 10) === null && c.journal.length === 0);
  const added = X.jnlSavePage(c, draft, {title: 'Session 1', tag: ' Sessions ', text: ''}, 20);
  ck('the first real input adds the page', c.journal.length === 1 && added.id === 'n1' && added.title === 'Session 1');
  ck('...with its tag tidied', added.tag === 'Sessions');
  ck('...created and edited at the same moment', added.at === 20 && added.editedAt === 20);
  X.jnlSavePage(c, draft, {title: 'Session 1', tag: 'Sessions', text: 'Mire'}, 30);
  ck('an edit moves the edited time and keeps the created time', c.journal[0].at === 20 && c.journal[0].editedAt === 30);
  X.jnlSavePage(c, draft, {title: 'Session 1', tag: 'Sessions', text: 'Mire'}, 40);
  ck('saving unchanged fields does not fake an edit', c.journal[0].editedAt === 30);
  X.jnlSavePage(c, draft, {title: '', tag: 'Sessions', text: '  '}, 50);
  ck('clearing title and text removes the page', c.journal.length === 0);
  X.jnlSavePage(c, draft, {title: 'Back again', tag: '', text: ''}, 60);
  ck('typing again brings it back with its first date', c.journal.length === 1 && c.journal[0].at === 20 && c.journal[0].editedAt === 60);
  const bad = {journal: 'nope'};
  X.jnlSavePage(bad, {id: 'z', at: null}, {title: 'x'}, 1);
  ck('a journal that is not a list is replaced, not written into', Array.isArray(bad.journal) && bad.journal.length === 1);
  ck('delete removes the one page and says so', X.jnlDeletePage(c, 'n1') === true && c.journal.length === 0);
  ck('deleting a page that is not there says so', X.jnlDeletePage(c, 'n1') === false);

  // tags offered, collapse
  const tc = {journal: [{tag: 'Quests'}, {tag: 'npcs'}, {tag: ''}, null], trackers: [{tag: 'quests'}, {tag: 'Kills'}, 'junk']};
  ck('tags are offered from pages and trackers together, once each, A to Z',
     same(X.jnlTagList(tc), ['Kills', 'npcs', 'Quests']), X.jnlTagList(tc));
  ck('a group nobody shut is open', X.jnlGroupOpen({}, 'quests', false));
  ck('a shut group is shut', !X.jnlGroupOpen({journalCollapse: {quests: true}}, 'quests', false));
  ck('a search opens every group', X.jnlGroupOpen({journalCollapse: {quests: true}}, 'quests', true));
  ck('a junk collapse map reads as open', ['x', null, [true]].every(m => X.jnlGroupOpen({journalCollapse: m}, 'quests', false)));

  // the stamp, and where a line goes
  const st = X.jnlStampText(new Date(2026, 8, 29, 19, 42));
  ck('the stamp is bold', /^\*\*[^*]+\*\*$/.test(st), st);
  ck('...one line, with the year and the minutes', !/\n/.test(st) && st.includes('2026') && st.includes('42'), st);
  const L = '**S**';
  ck('into an empty page: the line, then the caret on the next', same(X.insertLine('', 0, 0, L), {text: '**S**\n', caret: 6}));
  ck('at the end of the text: on a new line', same(X.insertLine('abc', 3, 3, L), {text: 'abc\n**S**\n', caret: 10}));
  ck('mid-line: the line is split around it', same(X.insertLine('abcdef', 3, 3, L), {text: 'abc\n**S**\ndef', caret: 10}));
  ck('at the start of a line: no extra break before it', same(X.insertLine('abc\ndef', 4, 4, L), {text: 'abc\n**S**\ndef', caret: 10}));
  ck('a selection is replaced', same(X.insertLine('abcd', 1, 3, L), {text: 'a\n**S**\nd', caret: 8}));
  ck('a selection past the end clamps to it', same(X.insertLine('ab', 99, 99, L), {text: 'ab\n**S**\n', caret: 9}));
}

/* ---- the journal's markup ---- */
{
  const c = {journal: [], journalCollapse: {}};
  ck('an empty journal says how to start one', /No pages yet/.test(X.journalListHTML(c, '')));
  c.journal = [
    {id: 'p1', title: 'Session 1', tag: 'Sessions', text: 'Met Brindle.', at: 100, editedAt: 100},
    {id: 'p2', title: 'Brindle', tag: 'NPCs', text: 'A **zorblat** smuggler.', at: 200, editedAt: 200},
    {id: 'p3', title: '', tag: '', text: 'Loose thought', at: 300, editedAt: 300},
    {id: 'p4', title: 'Session 2', tag: 'sessions', text: 'Crossed the Mire.', at: 400, editedAt: 400}];
  const h = X.journalListHTML(c, '');
  const order = [...h.matchAll(/data-jnlopen="(\w+)"/g)].map(m => m[1]);
  ck('groups A to Z, Untagged last, newest first inside each', JSON.stringify(order) === '["p2","p4","p1","p3"]', order);
  ck('a group counts its pages', h.includes('<span class="cnt">(2)</span>'));
  ck('a page with no title is listed as Untitled', /data-jnlopen="p3"><span class="jnl-title">Untitled</.test(h));
  ck('each page is a button that opens it', /<button type="button" class="jnl-entry" data-jnlopen="p1">/.test(h));
  ck('group headers are keyboard toggles', /data-jnlgroup="npcs" role="button" tabindex="0" aria-expanded="true"/.test(h));
  c.journalCollapse = {npcs: true};
  const shut = X.journalListHTML(c, '');
  ck('a shut group hides its pages but still renders them',
     /aria-expanded="false"/.test(shut) && /style="display:none"/.test(shut) && shut.includes('data-jnlopen="p2"'));
  const hit = X.journalListHTML(c, 'brindle');
  ck('a search lists only the matching pages',
     hit.includes('data-jnlopen="p1"') && hit.includes('data-jnlopen="p2"') && !hit.includes('data-jnlopen="p4"'));
  ck('...opens every group, shut ones too', !/display:none/.test(hit));
  ck('...and its headers are plain, not toggles', !/data-jnlgroup/.test(hit) && /jnl-static/.test(hit));
  ck('a text match shows where it matched', hit.includes('Met <mark>Brindle</mark>.'), hit);
  ck('no match says so, quoting the search', X.journalListHTML(c, 'goblin').includes('No pages match “goblin”'));
  ck('...escaped', X.journalListHTML(c, '<i>').includes('“&lt;i&gt;”'));

  const pg = X.journalPageHTML(c.journal[1]);
  ck('a page renders its text in the notes grammar', pg.includes('<strong>zorblat</strong>') && pg.includes('class="n-body"'));
  ck('...with its title as a focusable heading', /<h3 class="jnl-h" id="jnlHead" tabindex="-1">Brindle<\/h3>/.test(pg));
  ck('...its tag, and when it was written', pg.includes('<span class="jnl-tag">NPCs</span>') && /Added /.test(pg));
  ck('...Back, Edit and Delete', pg.includes('data-jnlback') && pg.includes('data-jnledit="p2"') && pg.includes('data-jnldel="p2"'));
  ck('an empty page says so', X.journalPageHTML({id: 'e', title: 'x', text: ''}).includes('Nothing written yet'));
  ck('a page with no date shows none, not a bare "Added"', !/Added/.test(X.journalPageHTML({id: 'e', title: 'x', text: 'y'})));

  const ed = X.journalEditorHTML(c.journal[1], ['NPCs', 'Sessions']);
  ck('the editor holds the title, the tag and the text',
     /id="jnlTitle" data-jnlfield="title" value="Brindle"/.test(ed) &&
     /id="jnlTag" data-jnlfield="tag" value="NPCs" list="jnlTags"/.test(ed) &&
     /data-jnlfield="text"[^>]*>A \*\*zorblat\*\* smuggler\.<\/textarea>/.test(ed));
  ck('...offers the tags already in use', ed.includes('<option value="Sessions">'));
  ck('...a timestamp button, Done, and the formatting key',
     ed.includes('data-jnlstamp') && ed.includes('data-jnldone="p2"') && ed.includes(X.NOTE_FMT_HINT));
  const evil = {id: 'x"y', title: '"><i>', tag: '"><i>', text: '</textarea><i>', at: 1};
  const all = X.journalListHTML({journal: [evil]}, '') + X.journalListHTML({journal: [evil]}, '<i>') +
    X.journalPageHTML(evil) + X.journalEditorHTML(evil, ['"><i>']);
  ck('nothing a file puts in a page reaches the markup raw', !/<i>/.test(all) && !all.includes('x"y'), all.slice(0, 300));

  // #95: progress on the row and the page, the editor's button
  const cl = {journal: [{id: 'q1', title: 'The lost map', tag: 'Quests', text: '[x] Find the map\n[ ] Cross the Mire\n[ ] Meet Brindle', at: 1, editedAt: 1},
                        {id: 'q2', title: 'No boxes', tag: 'Quests', text: 'prose', at: 2, editedAt: 2}], journalCollapse: {}};
  const lh = X.journalListHTML(cl, '');
  ck('#95 a page with checkboxes shows done/total on its row', /data-jnlopen="q1"><span class="jnl-title">The lost map<\/span><span class="jnl-prog">1\/3<\/span>/.test(lh), lh);
  ck('#95 ...and one without shows nothing new', (lh.match(/jnl-prog/g) || []).length === 1, lh);
  const ph = X.journalPageHTML(cl.journal[0]);
  ck('#95 the page view shows the count in its meta line and real boxes in its body',
     ph.includes('<span class="jnl-prog">1/3</span>') && /aria-checked="true" data-ck="0"/.test(ph) && /aria-checked="false" data-ck="2"/.test(ph), ph);
  ck('#95 the editor has Insert checkbox beside Insert timestamp',
     /data-jnlstamp>Insert timestamp<\/button><button type="button" class="tbtn" data-jnlck>Insert checkbox<\/button>/.test(X.journalEditorHTML({id: 'e', title: '', tag: '', text: ''}, [])));
  ck('#95 the formatting key mentions it', /\[ \]<\/b> checkbox/.test(X.NOTE_FMT_HINT), X.NOTE_FMT_HINT);
  // insertMarker: the caret lands AFTER the marker, on its line
  const M = '[ ] ';
  ck('#95 into an empty page: the marker, caret after it', JSON.stringify(X.insertMarker('', 0, 0, M)) === JSON.stringify({text: '[ ] ', caret: 4}));
  ck('#95 at the end of a line: on a new line', JSON.stringify(X.insertMarker('abc', 3, 3, M)) === JSON.stringify({text: 'abc\n[ ] ', caret: 8}));
  ck('#95 at the start of a line: no extra break', JSON.stringify(X.insertMarker('abc\ndef', 4, 4, M)) === JSON.stringify({text: 'abc\n[ ] def', caret: 8}));
  ck('#95 a selection is replaced', JSON.stringify(X.insertMarker('abcd', 1, 3, M)) === JSON.stringify({text: 'a\n[ ] d', caret: 6}));
}

/* ---- trackers: the model, progress, and the close rule ----
   Design: src/docs/specs/2026-09-29-journal-design.md §3, §6. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const b = X.blankChar();
  ck('a new character has no trackers, no shut groups, and shows the card',
     same(b.trackers, []) && same(b.trackerCollapse, {}) && b.showTrackers === true);
  const old = X.migrate({abilities: {}});
  ck('a sheet from before trackers gets the same', same(old.trackers, []) && X.showTrackers(old));
  ck('only a real false hides the card', !X.showTrackers({showTrackers: false}) &&
     X.showTrackers({showTrackers: null}) && X.showTrackers({showTrackers: 'false'}) && X.showTrackers({}));
  const t0 = {id: 't1', name: 'Goblins', type: 'counter', tag: 'Kills', value: 3, goal: 0, autoClose: true, closed: false, at: 5};
  const back = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {trackers: [t0], trackerCollapse: {kills: true}, showTrackers: false}))));
  ck('a save → load round trip keeps a tracker, the shut groups and the switch',
     same(back.trackers, [t0]) && same(back.trackerCollapse, {kills: true}) && back.showTrackers === false);
  const junk = X.migrate({abilities: {}, trackerCollapse: [],
    trackers: [null, 'x', ['arr'], {name: 'no id'}, {id: 't'}, {id: 't'}]});
  ck('only tracker objects survive', junk.trackers.length === 3);
  ck('trackers get ids, a repeat replaced',
     typeof junk.trackers[0].id === 'string' && junk.trackers[1].id === 't' && junk.trackers[2].id !== 't');
  ck('a junk collapse map resets', same(junk.trackerCollapse, {}));
  ck('migrate() stays idempotent over trackers', JSON.stringify(X.migrate(JSON.parse(JSON.stringify(junk)))) === JSON.stringify(junk));
  ck('#93 a new character has no totals switched on, and a junk map resets',
     same(X.blankChar().trackerTotals, {}) && same(X.migrate({abilities: {}, trackerTotals: 'yes'}).trackerTotals, {}) &&
     same(X.migrate({abilities: {}, trackerTotals: {kills: true}}).trackerTotals, {kills: true}));

  // reading junk
  ck('an unknown type is a counter', X.trkType({type: 'wheel'}) === 'counter' && X.trkType(null) === 'counter');
  ck('counts are whole and never negative', X.trkInt('12') === 12 && X.trkInt(-3) === 0 && X.trkInt('abc') === 0 && X.trkInt(2.7) === 2);
  ck('a typed count must be digits', X.trkParse(' 42 ') === 42 && X.trkParse('4x') === null && X.trkParse('-1') === null && X.trkParse('') === null);
  ck('a tracker with no name reads Untitled', X.trkName({name: ' '}) === 'Untitled');

  // progress
  const P = t => X.trkProgress(t);
  ck('a counter with no goal is never complete', same(P({value: 999}), {done: 999, total: 0, pct: 0, complete: false}));
  ck('a counter with a goal counts toward it', same(P({value: 150, goal: 300}), {done: 150, total: 300, pct: 50, complete: false}));
  ck('...is complete at its goal, and past it', P({value: 300, goal: 300}).complete && P({value: 400, goal: 300}).pct === 100);

  // the close rule
  const book = () => ({id: 'b', type: 'counter', value: 298, goal: 300, autoClose: true});
  let t = book();
  ck('a step short of the goal does not close', X.trkStep(t, 1, 10) === false && t.closed !== true && t.value === 299);
  ck('the step that reaches it closes, with the time', X.trkStep(t, 1, 11) === true && t.closed === true && t.closedAt === 11);
  X.trkReopen(t);
  ck('reopening clears the close and keeps the count', t.closed === false && !('closedAt' in t) && t.value === 300);
  ck('a reopened tracker at 100% stays open as it goes past', X.trkStep(t, 1, 12) === false && t.closed === false && t.value === 301);
  X.trkStep(t, -5, 13);
  ck('...and closes again only on its way back up to the goal', X.trkStep(t, 4, 14) === true && t.closed === true);
  t = Object.assign(book(), {autoClose: false});
  ck('with Close when complete off, it never closes itself', X.trkStep(t, 2, 15) === false && t.closed !== true);
  t = book();
  ck('a typed value that reaches the goal closes too', X.trkSetValue(t, '300', 16) === true && t.closed === true);
  ck('a step never goes below 0', (() => { const z = {value: 0}; X.trkStep(z, -1, 1); return z.value === 0; })());
  t = book(); X.trkClose(t, 30);
  ck('closing by hand closes, with the time', t.closed === true && t.closedAt === 30);

  // Undo
  t = book(); const snap = X.trkSnapshot(t); const c = {trackers: [t]};
  X.trkStep(t, 2, 20);
  ck('Undo puts back the whole tap — the count and the close',
     X.trkRestore(c, snap) === true && c.trackers[0].value === 298 && c.trackers[0].closed !== true);
  ck('...as a copy, so a later change cannot reach the snapshot', c.trackers[0] !== snap);
  ck('Undo for a tracker since deleted changes nothing', X.trkRestore({trackers: []}, snap) === false && X.trkRestore({}, snap) === false);

  // the form
  const f = X.trkFromForm({id: 'f', value: 7, closed: false}, {name: ' Read the Codex ', tag: ' Books ', goal: '5', autoClose: true});
  ck('the form tidies what it saves', f.name === 'Read the Codex' && f.tag === 'Books' && f.goal === 5 && f.autoClose === true);
  ck('the form never closes a tracker, even one it makes complete', f.closed === false && X.trkProgress(f).complete);
  ck('#95 whatever a form or file says, a tracker is a counter', X.trkFromForm({}, {type: 'x'}).type === 'counter' && X.trkType({type: 'checklist'}) === 'counter' && X.trkType({type: 'task'}) === 'counter');
  ck('Close when complete is on unless the form says off',
     X.trkFromForm({}, {}).autoClose === true && X.trkFromForm({}, {autoClose: false}).autoClose === false);

  // layout
  const L = {trackers: [
    {id: 'k1', name: 'Goblins', tag: 'Kills'}, {id: 'q1', name: 'Map', tag: 'quests'},
    {id: 'k2', name: 'Orcs', tag: 'kills'}, {id: 'x1', name: 'Done early', closed: true, closedAt: 5},
    {id: 'x2', name: 'Done later', closed: true, closedAt: 9}, {id: 'u1', name: 'Loose'}]};
  const s = X.trkSplit(L);
  ck('open trackers group by tag, A to Z, untagged last', same(s.open.map(g => g.key), ['kills', 'quests', '']));
  ck('...each group in the order they were made', same(s.open[0].items.map(t => t.id), ['k1', 'k2']));
  ck('closed trackers are one list, most recently closed first', same(s.closed.map(t => t.id), ['x2', 'x1']));
  ck('a tracker group nobody shut is open', X.trkGroupOpen({}, 'kills') && !X.trkGroupOpen({trackerCollapse: {kills: true}}, 'kills'));

  // #93 totals
  const T = {trackers: [{id: 'a', tag: 'Kills', value: 10}, {id: 'b', tag: 'kills', value: 5, closed: true, closedAt: 1}, {id: 'c', tag: 'Books', value: 99}, {id: 'd', tag: 'Kills', value: 'x'}], trackerTotals: {kills: true}};
  ck('#93 a total counts every counter with the tag, open or closed, junk as 0', X.trkGroupTotal(T, 'kills') === 15 && X.trkGroupTotal(T, 'books') === 99 && X.trkGroupTotal(T, '') === 0);
  ck('#93 the switch is read from trackerTotals, only a real true', X.trkTotalOn(T, 'kills') && !X.trkTotalOn(T, 'books') && !X.trkTotalOn({trackerTotals: {kills: 'yes'}}, 'kills') && !X.trkTotalOn({trackerTotals: []}, 'kills'));
}

/* ---- checklists and tasks become journal pages on load (#95, spec §5) ---- */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const D = new Date(2026, 9, 1, 12).getTime(), day = d => new Date(d).toLocaleDateString();
  const sheet = () => ({abilities: {}, journal: [{id: 'p0', title: 'Older', tag: '', text: 'x', at: 5, editedAt: 5}], trackers: [
    {id: 'c1', name: 'The lost map', type: 'checklist', tag: 'Quests', at: 100, items: [{id: 'i1', text: 'Find the map', done: true}, {id: 'i2', text: 'Cross the Mire', done: false}]},
    {id: 'c2', name: 'Done by hand', type: 'checklist', tag: 'quests', at: 200, closed: true, closedAt: D, items: [{id: 'i3', text: 'a', done: true}, {id: 'i4', text: 'b', done: false}]},
    {id: 'c3', name: 'Empty', type: 'checklist', tag: '', at: 300, items: []},
    {id: 't1', name: 'Pay Brindle', type: 'task', tag: 'Quests', at: 400},
    {id: 't2', name: 'Buy rope', type: 'task', tag: 'Shopping', at: 500, done: true, closed: true, closedAt: D},
    {id: 't3', name: 'Loose end', type: 'task', at: 600},
    {id: 't4', name: 'Second quest task', type: 'task', tag: 'quests', at: 50},
    {id: 'k1', name: 'Goblins', type: 'counter', tag: 'Kills', value: 3, at: 700}]});
  const m = X.migrate(sheet());
  ck('#95 every checklist and task leaves the trackers; the counter stays', same(m.trackers.map(t => t.id), ['k1']), m.trackers);
  const byTitle = t => m.journal.find(p => p.title === t);
  const map = byTitle('The lost map');
  ck('#95 an open checklist is a page: its name, tag, date and items',
     !!map && map.tag === 'Quests' && map.at === 100 && map.editedAt === 100 && map.text === '[x] Find the map\n[ ] Cross the Mire', map);
  const hand = byTitle('Done by hand');
  ck('#95 a closed checklist keeps each item\'s real tick, and gains a Closed line',
     !!hand && hand.text === '[x] a\n[ ] b\n\nClosed ' + day(D) && hand.editedAt === D, hand);
  ck('#95 an empty checklist is a page with just its title', byTitle('Empty') && byTitle('Empty').text === '' && byTitle('Empty').tag === '');
  const tasks = m.journal.filter(p => p.title === 'Tasks');
  ck('#95 tasks become one Tasks page per tag, the untagged included', tasks.length === 3 && same(tasks.map(p => p.tag).sort(), ['', 'Quests', 'Shopping']), tasks.map(p => p.tag));
  const q = tasks.find(p => p.tag === 'Quests');
  ck('#95 ...one line per task, in the order they were made, dated by the oldest',
     !!q && q.text === '[ ] Second quest task\n[ ] Pay Brindle' && q.at === 50, q);
  const s = tasks.find(p => p.tag === 'Shopping');
  ck('#95 ...a closed task is ticked with its date on its line', !!s && s.text === '[x] Buy rope — closed ' + day(D) && s.editedAt === D, s);
  ck('#95 the pages that were there are untouched', m.journal[0].id === 'p0' && m.journal[0].text === 'x');
  ck('#95 new pages get fresh, unique ids', new Set(m.journal.map(p => p.id)).size === m.journal.length && m.journal.every(p => typeof p.id === 'string' && p.id));
  const again = X.migrate(JSON.parse(JSON.stringify(m)));
  ck('#95 running it again changes nothing', JSON.stringify(again) === JSON.stringify(m));
  ck('#95 a sheet with no such trackers is untouched', (() => { const c = {abilities: {}, trackers: [{id: 'k', type: 'counter', value: 1}], journal: []}; return X.migrateTrackerPages(c, 1) === 0 && c.journal.length === 0 && c.trackers.length === 1; })());
  const junk = X.migrate({abilities: {}, trackers: [{id: 'j', type: 'checklist', items: [null, 'str', {text: 7}, {done: true}], tag: 'constructor'}]});
  ck('#95 junk items are skipped or named, and a reserved tag reads as none',
     junk.trackers.length === 0 && junk.journal.length === 1 && junk.journal[0].text === '[ ] 7\n[x] Untitled' && junk.journal[0].tag === '', junk.journal);
  const bad = X.migrate({abilities: {}, trackers: [
    {id: 'bc', name: 'Odd list', type: 'checklist', closed: true, closedAt: 1e20, items: [{text: 'a', done: true}]},
    {id: 'bt', name: 'Odd task', type: 'task', closed: true, closedAt: 1e20}]});
  ck('#95 a date no calendar holds writes no date: no Closed line, no "closed" on the task, never "Invalid Date"',
     bad.journal.length === 2 && bad.journal[0].text === '[x] a' && bad.journal[1].text === '[x] Odd task' && !/Invalid/.test(JSON.stringify(bad.journal)), bad.journal);
  ck('#95 a sheet whose journal is not a list gets one', (() => { const c = {abilities: {}, journal: 'nope', trackers: [{id: 'x', type: 'task', name: 'a'}]}; X.migrateTrackerPages(c, 9); return Array.isArray(c.journal) && c.journal[0].at === 9; })());
}

/* ---- the trackers' markup ---- */
{
  ck('no trackers says how to start one', /No trackers yet/.test(X.trackersHTML({trackers: []}, false)));
  ck('#95 ...and no longer offers the steps of a quest, which are a journal page now', !/quest/.test(X.trackersHTML({trackers: []}, false)));
  const kills = {id: 'k1', name: 'Goblins', type: 'counter', tag: 'Kills', value: 12};
  const book = {id: 'b1', name: 'Read the Codex', type: 'counter', tag: 'Books', value: 150, goal: 300};
  const done = {id: 'd1', name: 'Old quest', type: 'counter', value: 5, goal: 5, closed: true, closedAt: 50};
  const r1 = X.trackerRowHTML(kills);
  ck('a counter has −, its count in a box, and +',
     /data-trkdec="k1"[^>]*>−</.test(r1) && /data-trkval="k1"[^>]*value="12"/.test(r1) && /data-trkinc="k1"[^>]*>\+</.test(r1));
  ck('...each named for a screen reader', r1.includes('aria-label="One more — Goblins"'));
  ck('...and with no goal, no bar', !r1.includes('progressbar') && !r1.includes('trk-of'));
  const r2 = X.trackerRowHTML(book);
  ck('a counter with a goal says how far, with a bar',
     r2.includes('of 300') && /role="progressbar"[^>]*aria-valuemax="300" aria-valuenow="150"/.test(r2) && r2.includes('width:50%'));
  ck('every row can be edited', [r1, r2].every(r => /data-trkedit="/.test(r)));

  const c = {trackers: [kills, book, done], trackerCollapse: {books: true}};
  const h = X.trackersHTML(c, false);
  ck('open trackers are grouped by tag, A to Z',
     h.indexOf('>Books<') < h.indexOf('>Kills<'));
  ck('a shut group hides its trackers, still rendered', /data-trkgroup="books"[^>]*aria-expanded="false"/.test(h) && h.includes('data-trkdec="b1"'));

  const ht = X.trackersHTML({trackers: [kills, {id: 'k2', name: 'Orcs', tag: 'kills', value: 30, closed: true, closedAt: 1}], trackerTotals: {kills: true}}, false);
  ck('#93 a group with its total on reads it in the header, after the count',
     /<span class="cnt">\(1\)<\/span><span class="trk-total">· 42<\/span><button type="button" class="icon trk-sum on" data-trktotal="kills" aria-pressed="true"/.test(ht), ht);
  ck('#93 ...off, the header has the switch and no total', /data-trktotal="kills" aria-pressed="false"/.test(h) && !h.includes('trk-total'));
  ck('#93 the switch is named for a screen reader, the same name on and off: its state is aria-pressed',
     /data-trktotal="kills" aria-pressed="true" aria-label="Total for Kills"/.test(ht) && /data-trktotal="kills" aria-pressed="false" aria-label="Total for Kills"/.test(h), [ht, h]);
  ck('closed trackers are in Completed, shut by default',
     /data-trkcompleted role="button" tabindex="0" aria-expanded="false"/.test(h) &&
     h.includes('<span class="fgname">Completed</span><span class="cnt">(1)</span>'));
  ck('a closed tracker offers Reopen and says when it closed', h.includes('data-trkreopen="d1"') && /Closed /.test(h));
  ck('Completed opens when asked', /data-trkcompleted[^>]*aria-expanded="true"/.test(X.trackersHTML(c, true)));
  ck('with everything closed, the open list says so', /Nothing open/.test(X.trackersHTML({trackers: [done]}, false)));
  ck('what a closed tracker came to',
     X.trkSummary(book) === '150 / 300' && X.trkSummary(kills) === '12' && X.trkSummary(done) === '5 / 5');

  const fNew = X.trackerFormHTML({type: 'counter', autoClose: true}, ['Kills', 'Quests'], true);
  ck('a new tracker\'s form has Add, and no Delete or Close now',
     fNew.includes('>Add<') && !fNew.includes('id="tkDel"') && !fNew.includes('id="tkCloseNow"'));
  ck('...offers the tags in use', fNew.includes('<option value="Quests">'));
  ck('...has Close when complete on', /id="tkAuto" role="switch" aria-checked="true"/.test(fNew));
  const fEd = X.trackerFormHTML(book, [], false);
  ck('#95 the form has no Type and no Items', !fEd.includes('id="tkType"') && !fEd.includes('id="tkItems"') && /id="tkGoal"[^>]*value="300"/.test(fEd), fEd);
  ck('...Delete and Close now', fEd.includes('id="tkDel"') && fEd.includes('>Close now<'));
  ck('a closed tracker\'s form offers Reopen', X.trackerFormHTML(done, [], false).includes('>Reopen<'));
  const evil = {id: 'x"y', name: '"><i>', type: 'counter', tag: '"><i>', value: '"><i>', goal: '"><i>'};
  const all = X.trackerRowHTML(evil) +
    X.trackersHTML({trackers: [evil, Object.assign({}, evil, {id: 'z', closed: true, closedAt: 1})]}, true) +
    X.trackerFormHTML(evil, ['"><i>'], false);
  ck('nothing a file puts in a tracker reaches the markup raw',
     !/<i>/.test(all) && !all.includes('x"y'), all.slice(0, 300));
}

/* ---- a tick in the page view writes the line back (#95) ---- */
{
  const c = X.blankChar(); X.character = c;
  c.journal = [{id: 'q1', title: 'Map', tag: '', text: '[ ] a\n[x] b', at: 1, editedAt: 1}];
  ctx.renderJournal();
  ctx.jnlOpen('q1');
  ck('#95 a tap flips the line, stamps editedAt and says it did',
     ctx.jnlToggleCheckbox(0) === true && c.journal[0].text === '[x] a\n[x] b' && c.journal[0].editedAt > 1, c.journal[0]);
  ck('#95 ...and back', ctx.jnlToggleCheckbox(0) === true && c.journal[0].text === '[ ] a\n[x] b');
  ck('#95 an ordinal that is not there changes nothing', ctx.jnlToggleCheckbox(7) === false && c.journal[0].text === '[ ] a\n[x] b');
  ctx.jnlEdit('q1');
  ck('#95 while the editor is open a tick is refused', ctx.jnlToggleCheckbox(0) === false && c.journal[0].text === '[ ] a\n[x] b');
  ctx.jnlDone();
  c.journal = [];
  ck('#95 a tick on a page deleted meanwhile changes nothing', ctx.jnlToggleCheckbox(0) === false);
}

/* ---- a tick in a section note writes back too (#95) ---- */
{
  const c = X.blankChar(); X.character = c;
  c.secNotes = {vitals: {text: '[ ] rest\n[x] eat', at: 1, editedAt: 1}};
  ck('#95 a section note renders its boxes', /aria-checked="false" data-ck="0"/.test(ctx.noteEntryHTML(ctx.noteDef('vitals'))));
  ck('#95 a tap flips the note\'s line and keeps its dates',
     ctx.noteToggleCheckbox('vitals', 0) === true && c.secNotes.vitals.text === '[x] rest\n[x] eat' && c.secNotes.vitals.at === 1 && c.secNotes.vitals.editedAt > 1, c.secNotes.vitals);
  ck('#95 an unknown section or ordinal changes nothing',
     ctx.noteToggleCheckbox('nope', 0) === false && ctx.noteToggleCheckbox('vitals', 5) === false && c.secNotes.vitals.text === '[x] rest\n[x] eat');
}

/* ---- a tick in a Story field writes back too (#95, final review) ----
   renderRT() draws Proficiencies and the bio cards through richHTML(), so a
   checkbox line there is a real box; rtToggleCheckbox() is its owner. */
{
  const c = X.blankChar(); X.character = c;
  c.notes = '[ ] buy rope\n[x] sharpen sword';
  ck('#95 a tap on a box in a Story field flips its line',
     ctx.rtToggleCheckbox('notes', 0) === true && c.notes === '[x] buy rope\n[x] sharpen sword', c.notes);
  ck('#95 ...and back', ctx.rtToggleCheckbox('notes', 0) === true && c.notes === '[ ] buy rope\n[x] sharpen sword', c.notes);
  ck('#95 ...in Proficiencies as well', (() => { c.proficiencies = '[ ] Thieves\' tools'; return ctx.rtToggleCheckbox('proficiencies', 0) === true && c.proficiencies === '[x] Thieves\' tools'; })(), c.proficiencies);
  ck('#95 an ordinal that is not there changes nothing', ctx.rtToggleCheckbox('notes', 4) === false && c.notes === '[ ] buy rope\n[x] sharpen sword');
  X.editing.notes = true;
  ck('#95 while the field is being edited a tick is refused', ctx.rtToggleCheckbox('notes', 0) === false && c.notes === '[ ] buy rope\n[x] sharpen sword');
  delete X.editing.notes;
  ck('#95 a field that is not a Story field is refused', ctx.rtToggleCheckbox('nope', 0) === false && ctx.rtToggleCheckbox('constructor', 0) === false &&
     ctx.rtToggleCheckbox('secNotes', 0) === false && ctx.rtToggleCheckbox('name', 0) === false);
  ck('#95 an empty field takes no tick and is not written', ctx.rtToggleCheckbox('flaws', 0) === false && c.flaws === X.blankChar().flaws);
}

/* ---- trackers through their DOM layer: a tap, the close, the Undo ---- */
{
  const c = X.blankChar(); X.character = c;
  c.trackers = [{id: 'b', name: 'Codex', type: 'counter', value: 299, goal: 300, autoClose: true}];
  const step = d => (t, now) => ctx.trkStep(t, d, now);
  ck('a tap that finishes a tracker closes it', ctx.trkAct('b', step(1), false) === true && c.trackers[0].closed === true);
  ck('a closed tracker takes no more taps', ctx.trkAct('b', step(1), false) === false && c.trackers[0].value === 300);
  const before = {id: 'b', name: 'Codex', type: 'counter', value: 299, goal: 300, autoClose: true};
  X.character = X.blankChar();
  ck('an Undo that outlived a character switch does nothing', ctx.undoTrackerChange(before, c, false) === false);
  X.character = c;
  ck('Undo puts the whole tap back', ctx.undoTrackerChange(before, c, false) === true &&
     c.trackers[0].value === 299 && c.trackers[0].closed !== true);
  ctx.commitTrackerValue({dataset: {trkval: 'b'}, value: '12x'});
  ck('a typed count that is not a number changes nothing', c.trackers[0].value === 299);
  ctx.commitTrackerValue({dataset: {trkval: 'b'}, value: '300'});
  ck('a typed count that reaches the goal closes it', c.trackers[0].closed === true && c.trackers[0].value === 300);
  ctx.reopenTracker('b');
  ck('Reopen brings it back, its count kept', c.trackers[0].closed === false && c.trackers[0].value === 300);
  ck('the combat view accepts the Trackers card', ctx.combatSectionsOf({combatSections: ['trackers']}).join() === 'trackers');
  /* the keyboard flag threaded through commitTrackerValue()/reopenTracker() —
     the plain harness can't see where focus lands, so this only checks the
     flag doesn't break the underlying behaviour */
  c.trackers[0].value = 299; c.trackers[0].closed = false;
  ctx.commitTrackerValue({dataset: {trkval: 'b'}, value: '300'}, true);
  ck('a keyboard Enter that completes a tracker still closes it', c.trackers[0].closed === true && c.trackers[0].value === 300);
  ctx.reopenTracker('b', true);
  ck('a keyboard Reopen still reopens, its count kept', c.trackers[0].closed === false && c.trackers[0].value === 300);
  ck('#93 toggling a total writes the map and back', (() => { ctx.toggleTrkTotal('kills'); const on = X.character.trackerTotals.kills === true; ctx.toggleTrkTotal('kills'); return on && !('kills' in X.character.trackerTotals); })());
}

/* ---- a typed count commits in place (#41) ----
   `change` fires as the box loses focus: at the mousedown on +, or at a Tab.
   Redrawing the card there replaced the + under the pointer, so its click never
   arrived (5, type 9, click + → 9, not 10), and a Tab dropped focus to the page.
   The change path patches the row where it stands; Enter, and a change that
   closes the tracker, still redraw. A tiny DOM: the list counts its redraws. */
{
  const c = X.blankChar(); X.character = c;
  c.trackers = [{id: 'b', name: 'Codex', type: 'counter', value: 5, goal: 20, autoClose: true}];
  const doc = ctx.document, saved = {getElementById: doc.getElementById, querySelector: doc.querySelector};
  let draws = 0;
  const attrs = {}, fill = {style: {}};
  const bar = {setAttribute: (k, v) => { attrs[k] = String(v); }, querySelector: s => s === 'span' ? fill : null};
  const box = {value: '5', dataset: {trkval: 'b'}};
  const row = {querySelector: s => s === '[data-trkval]' ? box : s === '.trk-bar' ? bar : null};
  const list = {set innerHTML(v) { draws++; }, get innerHTML() { return ''; }};
  doc.getElementById = id => id === 'trkList' ? list : null;
  doc.querySelector = s => s === '[data-trk="b"]' ? row : s === '[data-trkval="b"]' ? box : null;
  box.value = '9';
  ctx.commitTrackerValue(box, false);
  ck('a typed count is stored', c.trackers[0].value === 9, c.trackers[0].value);
  ck('...and the change that stores it leaves the card standing, so the + under the pointer still gets its click',
     draws === 0, draws);
  ck('...patching the row in place: the box, the bar\'s value and its width',
     box.value === '9' && attrs['aria-valuenow'] === '9' && fill.style.width === '45%', [box.value, attrs, fill.style]);
  box.value = 'nine';
  ctx.commitTrackerValue(box, false);
  ck('a typed count that is not a number puts the stored count back, in place',
     box.value === '9' && draws === 0 && c.trackers[0].value === 9, [box.value, draws]);
  box.value = '12';
  ctx.commitTrackerValue(box, true);
  ck('Enter still redraws, for its own focus rules', draws === 1 && c.trackers[0].value === 12, draws);
  box.value = '20';
  ctx.commitTrackerValue(box, false);
  ck('a change that finishes the tracker redraws: its row leaves for Completed',
     draws === 2 && c.trackers[0].closed === true, [draws, c.trackers[0]]);
  Object.assign(doc, saved);
}

/* ---- a typed count moves its group's total too (#93, final review) ----
   The in-place patch above wrote the box and the bar, and the header's total
   kept the old sum until the next redraw. The same tiny DOM, plus the group the
   row sits in (row.closest(".fgroup")) holding the header's .trk-total. */
{
  const c = X.blankChar(); X.character = c;
  c.trackers = [{id: 'g', name: 'Goblins', type: 'counter', tag: 'Kills', value: 5},
    {id: 'o', name: 'Orcs', type: 'counter', tag: 'kills', value: 2, closed: true, closedAt: 1}];
  c.trackerTotals = {kills: true};
  const doc = ctx.document, saved = {getElementById: doc.getElementById, querySelector: doc.querySelector};
  let draws = 0;
  const total = {textContent: '· 7'};
  const group = {querySelector: s => s === '.trk-total' ? total : null};
  const box = {value: '5', dataset: {trkval: 'g'}};
  const row = {querySelector: s => s === '[data-trkval]' ? box : null, closest: s => s === '.fgroup' ? group : null};
  const list = {set innerHTML(v) { draws++; }, get innerHTML() { return ''; }};
  doc.getElementById = id => id === 'trkList' ? list : null;
  doc.querySelector = s => s === '[data-trk="g"]' ? row : s === '[data-trkval="g"]' ? box : null;
  box.value = '9';
  let err = null;
  try { ctx.commitTrackerValue(box, false); } catch (e) { err = e; }
  ck('#93 a typed count moves the header\'s total, in place, the closed counter still counted',
     !err && draws === 0 && c.trackers[0].value === 9 && total.textContent === '· 11', err ? String(err) : [draws, total.textContent]);
  group.querySelector = () => null;
  box.value = '4';
  try { ctx.commitTrackerValue(box, false); } catch (e) { err = e; }
  ck('#93 ...a group with its total off has none to move, and the count still lands in place',
     !err && draws === 0 && c.trackers[0].value === 4 && total.textContent === '· 11', err ? String(err) : [draws, total.textContent]);
  Object.assign(doc, saved);
}

/* ---- where Tab from the Undo goes: the next tracker (#41, spec §6) ----
   The ids drawn after the one that closed, in the card's order: the rest of its
   group, then the groups below. A shut group's rows can't take focus. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const c = {trackers: [
    {id: 'u1', name: 'Loose', tag: ''},
    {id: 'b1', name: 'Codex', tag: 'Books'}, {id: 'q1', name: 'Map', tag: 'Quests'},
    {id: 'b2', name: 'Atlas', tag: 'books'}, {id: 'k1', name: 'Goblins', tag: 'Kills'},
    {id: 'x1', name: 'Done', tag: 'Books', closed: true}], trackerCollapse: {quests: true}};
  const after = id => { try { return ctx.trkAfter(c, id); } catch (e) { return String(e); } };
  ck('the trackers after one, in the card\'s order: its group, then the groups below, a shut one skipped',
     same(after('b1'), ['b2', 'k1', 'u1']), after('b1'));
  ck('...none after the last', same(after('u1'), []), after('u1'));
  ck('...and none for one that is not open', same(after('x1'), []), after('x1'));
}

/* ---- an Undo belongs to the sheet it was shown for, not to its id (#41) ----
   Import → Replace keeps the id and swaps the whole sheet, so an Undo keyed on
   the id restored an old snapshot into the imported one. */
{
  const c = X.blankChar(); c.id = 'rep'; X.character = c;
  c.trackers = [{id: 'b', name: 'Codex', type: 'counter', value: 299, goal: 300, autoClose: true}];
  const realToast = ctx.toast; let offer = null;
  ctx.toast = (msg, action) => { if (action) offer = action; return null; };
  ctx.trkAct('b', (t, now) => ctx.trkStep(t, 1, now), false);
  X.character = X.migrate(JSON.parse(JSON.stringify(c)));    /* Import → Replace: the same id, a new sheet */
  if (offer) offer.run({detail: 1});
  ck('an Undo from before an Import → Replace does nothing to the imported sheet',
     !!offer && X.character.trackers[0].closed === true && X.character.trackers[0].value === 300, X.character.trackers[0]);
  X.character = c;
  if (offer) offer.run({detail: 1});
  ck('...while on the sheet it was shown for, it still undoes', c.trackers[0].closed !== true && c.trackers[0].value === 299, c.trackers[0]);
  ctx.toast = realToast;
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
  ck('...nor a newline, which querySelector would throw on',
     X.openerSelector(el('', {'data-x': 'a\nb'})) === '[data-x="a\\a b"]' && X.openerSelector(el('a\r\fb')) === '[id="a\\d \\c b"]',
     [X.openerSelector(el('', {'data-x': 'a\nb'})), X.openerSelector(el('a\r\fb'))]);
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
  const core = pack('srd52', 'items.json'), magic = pack('srd52', 'items-magic.json');
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
  /* the Dwarven Thrower: a STR weapon, so the +3 reads on its own */
  const c2 = X.blankChar(); X.character = c2;
  c2.abilities.str = 10; c2.abilities.dex = 10; c2.level = 1;
  X.addLibraryItems([def(magic, 'Dwarven Thrower'), def(core, 'Club')], null, null, 1);
  n = X.attackNumbers(c2.attacks.find(a => a.name === 'Dwarven Thrower'));
  ck('#74 the Dwarven Thrower: PB 2 + 3 = +5 to hit, +3 damage', n.toHit === 5 && n.dmgBonus === 3, n);
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
  const core = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'srd52', 'items.json'), 'utf8')).items;
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
  const el = () => { const e = {textContent: '', fx: false, neg: false};
    e.classList = {toggle: (k, on) => { if (k === 'fx-on') e.fx = !!on; if (k === 'fx-neg') e.neg = !!on; },
                   add: () => {}, remove: () => {}, contains: () => false};
    return e; };
  ctx.document.getElementById = id => ids.includes(id) ? (got[id] = got[id] || el()) : real(id);
  try { X.recompute(); } finally { ctx.document.getElementById = real; }
  const o = {}; ids.forEach(i => { o[i] = got[i] ? String(got[i].textContent) : undefined; });
  painted.fx = {}; ids.forEach(i => { painted.fx[i] = !!(got[i] && got[i].fx); });   /* marked .fx-on? */
  painted.neg = {}; ids.forEach(i => { painted.neg[i] = !!(got[i] && got[i].neg); }); /* ...and .fx-neg (#89)? */
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
  const magic = shippedItems('srd52', 'items-magic.json');
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
   app had no effect target for either, so an equipped Staff of Power changed
   nothing a caster looks at. Now they are `spell.attack` and `spell.dc`
   effects, read by spellAtkBonus()/spellDC() and so by the Spellcasting card,
   spell attack rows, save rows, the cast dialog and the breakdowns, and by
   nothing else: a weapon's row does not take them. The SHIPPED items, and two
   invented ones, added through the finder. A caster with the ability at 16
   (+3) at level 1 (PB 2): DC 13, spell attack +5. */
{
  const magic = shippedItems('srd52', 'items-magic.json');
  const core = shippedItems('srd52', 'items.json');
  const def = (list, name) => list.find(x => x.name === name);
  /* No SRD 5.2 item raises both numbers by the same amount, or the DC alone, so
     these two are invented: a +3 weapon that raises spell attack and DC alike,
     and a focus that raises the DC only. */
  const inv = [
    {name: '+3 Ember Sickle', system: 'Fixture', category: 'Weapon', type: 'Simple Melee Weapon', rarity: 'Very Rare',
     weight: 2, attune: true, description: 'An invented sickle that sharpens the spells of whoever wields it.',
     effects: [{target: 'spell.attack', value: 3}, {target: 'spell.dc', value: 3}],
     weapon: {kind: 'melee', dice: '1d4', damageType: 'slashing', ability: 'str', notes: 'Light', atkMisc: 3, dmgMisc: 3}},
    {name: 'Chime of Clear Notes', system: 'Fixture', category: 'Wondrous Item', type: 'Wondrous Item', rarity: 'Rare',
     attune: true, description: 'An invented chime that makes its bearer\'s spells harder to shrug off.',
     effects: [{target: 'spell.dc', value: 2}]},
  ];
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

  /* A +3 weapon for a druid that raises spell attack AND DC. A real one names
     the classes it serves; the sheet has one spellcasting ability, so the bonus
     goes on it. */
  c = fresh('wis');
  c.attacks.push({id: 'sf', name: 'Sacred Flame', spellId: 's2', source: 'spell', save: {ability: 'dex'},
                  damageDice: '1d8', damageType: 'radiant', notes: ''});
  X.addLibraryItems([def(inv, '+3 Ember Sickle')], null, null, 1);
  p = painted(['dcDisp', 'satkDisp']);
  ck('#77 a +3 Ember Sickle: DC 16 and spell attack +8, both marked',
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
    ck('#57 an attack row groups its type, to-hit and buttons after the name',
       /<div class="top split">/.test(sf) && /<span class="row-meta">[\s\S]*class="qty"[\s\S]*atk-hit/.test(sf) &&
       sf.indexOf('class="nm"') < sf.indexOf('class="row-meta"'), sf.slice(0, 600));
  }
  m = shownModal(() => X.openStatBreakdown('spell.dc'));
  ck('#77 ...and tapping the DC names the sickle', m.t === 'Spell save DC breakdown' && /\+3 Ember Sickle<\/span><b>\+3</.test(m.b), m);
  n = X.attackNumbers(c.attacks.find(a => a.name === '+3 Ember Sickle'));
  ck('#77 ...while the sickle\'s own row is its weapon: PB 2 + 3 = +5 to hit, +3 damage', n.toHit === 5 && n.dmgBonus === 3, n);

  /* a focus that raises the DC only, and is not a weapon, so it is equipped by hand */
  c = fresh('cha');
  X.addLibraryItems([def(inv, 'Chime of Clear Notes')], null, null, 1);
  c.inventory[0].equipped = true;
  p = painted(['dcDisp', 'satkDisp']);
  ck('#77 a Chime of Clear Notes: DC 15, spell attack still +5', p.dcDisp === '15' && p.satkDisp === '+5' && !painted.fx.satkDisp, [p, painted.fx]);

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
  const magic = shippedItems('srd52', 'items-magic.json'), core = shippedItems('srd52', 'items.json');
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

/* ---- ammunition: kinds, stacks, unpacking (#6) ----
   Design: src/docs/specs/2026-10-02-ammo-design.md §3, §5. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ck('a kind is trimmed, its spaces collapsed, lower-cased', X.ammoKindOf('  Sling   Bullet ') === 'sling bullet' && X.ammoKindOf(7) === '');
  ck('an item is ammunition only with a kind', same(X.itemAmmo({ammo: {kind: 'Arrow'}}), {kind: 'arrow', bonus: 0}) &&
     X.itemAmmo({ammo: 'arrow'}) === null && X.itemAmmo({ammo: {kind: ' '}}) === null && X.itemAmmo({}) === null);
  ck('a bonus is a whole number, kept within 9', X.itemAmmo({ammo: {kind: 'arrow', bonus: '2'}}).bonus === 2 &&
     X.itemAmmo({ammo: {kind: 'arrow', bonus: 1.7}}).bonus === 1 && X.itemAmmo({ammo: {kind: 'arrow', bonus: 99}}).bonus === 9 &&
     X.itemAmmo({ammo: {kind: 'arrow', bonus: 'x'}}).bonus === 0);
  ck("a weapon's ammo kind", X.weaponAmmoKind({weapon: {ammo: 'Arrow'}}) === 'arrow' && X.weaponAmmoKind({weapon: {}}) === '' && X.weaponAmmoKind({}) === '');
  const bow = {id: 'w1', name: 'Longbow', weapon: {kind: 'ranged', ammo: 'arrow'}};
  const plain = {id: 's1', name: 'Arrow', qty: 12, ammo: {kind: 'arrow'}};
  const magic = {id: 's2', name: '+1 Arrow', qty: 3, ammo: {kind: 'arrow', bonus: 1}};
  const bolts = {id: 's3', name: 'Bolt', qty: 5, ammo: {kind: 'bolt'}};
  const c = {inventory: [bow, bolts, plain, magic]};
  ck('the stacks a weapon can load are its kind, in inventory order', same(X.ammoStacks(c, 'arrow').map(s => s.id), ['s1', 's2']));
  ck('with no choice made it loads the first', X.loadedStack(c, bow) === plain);
  ck('a choice is remembered', X.loadedStack(c, Object.assign({}, bow, {ammoStack: 's2'})) === magic);
  ck('a choice that no longer exists falls back to the first', X.loadedStack(c, Object.assign({}, bow, {ammoStack: 'gone'})) === plain);
  ck('a choice of the wrong kind is ignored', X.loadedStack(c, Object.assign({}, bow, {ammoStack: 's3'})) === plain);
  ck('nothing of its kind loads nothing', X.loadedStack({inventory: [bow, bolts]}, bow) === null);
  ck('a bundle is never loaded', X.ammoStacks({inventory: [{id: 'b', name: 'Arrows (20)', ammo: {kind: 'arrow'}, pack: {item: 'Arrow', qty: 20}}]}, 'arrow').length === 0);
  ck('kinds read as words', X.ammoPlural('arrow') === 'arrows' && X.ammoPlural('sling bullet') === 'sling bullets' &&
     X.ammoOne('arrow') === 'an arrow' && X.ammoOne('bolt') === 'a bolt');

  const pool = [{name: 'Arrow', category: 'Ammunition', type: 'Ammunition', weight: 0.05, cost: '5 cp', ammo: {kind: 'arrow'}},
                {name: 'Arrows (20)', category: 'Ammunition', type: 'Ammunition', weight: 1, cost: '1 gp', ammo: {kind: 'arrow'}, pack: {item: 'Arrow', qty: 20}}];
  const u = X.unpackAmmo(pool[1], pool);
  ck("a bundle unpacks into the pool's own single piece, twenty to the bundle", u.def === pool[0] && u.per === 20);
  const u2 = X.unpackAmmo({name: 'Pellets (50)', category: 'Ammunition', weight: 2, cost: '1 gp', ammo: {kind: 'pellet'}, pack: {item: 'Pellet', qty: 50}}, pool);
  ck('a bundle whose piece the pool lacks is made from the bundle, cost and weight divided',
     u2.per === 50 && u2.def.name === 'Pellet' && u2.def.cost === '0.02 gp' && u2.def.weight === 0.04 && same(u2.def.ammo, {kind: 'pellet'}), u2.def);
  ck('anything else comes back as it is, one to one', X.unpackAmmo(pool[0], pool).def === pool[0] && X.unpackAmmo(pool[0], pool).per === 1);
  ck('a junk pack field is no bundle', X.unpackAmmo({name: 'X', pack: {item: 'Y', qty: 0}}, pool).per === 1 &&
     X.unpackAmmo({name: 'X', pack: 'Y'}, pool).per === 1);
}

/* ---- the one-time pass on sheets saved before ammunition (#6) ---- */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /* a copy stamped before this branch: its baselines know nothing of `ammo` */
  const stamp = (it, shape) => {
    const f = X.fpMap(it, 'item'); delete f.ammo;
    it.src = {cat: 'items', pack: '5e.json', kind: 'item', shape: shape || 'plain', name: it.name,
              fp: Object.assign({}, f), cfp: Object.assign({}, f)};
    return it;
  };
  const edited = stamp({id: 'w2', name: 'Shortbow', qty: 1, weapon: {kind: 'ranged', dice: '1d6', damageType: 'piercing', ability: 'dex'}});
  const editedFp = edited.src.fp.weapon;
  edited.weapon = Object.assign({}, edited.weapon, {notes: 'My grandfather\'s bow'});   /* the player's edit, after the copy */
  const old = {name: 'Ranger', abilities: {}, inventory: [
    stamp({id: 'b1', name: 'Arrows (20)', qty: 2, cost: 1, weight: 1, category: 'Ammunition', type: 'Ammunition', description: 'Arrows.', effects: [], grant: 'class:Ranger'}),
    {id: 'l1', name: 'Arrow', qty: 5, cost: 0.05, weight: 0.05, origin: {kind: 'purchased'}},
    stamp({id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', dice: '1d8', damageType: 'piercing', ability: 'dex', notes: 'Range 150/600'}}),
    edited,
    {id: 'c1', name: 'Crossbow Bolts (20)', qty: 1, weight: 1.5},
    {id: 'r1', name: 'Rope', qty: 1}]};
  const m = X.migrate(JSON.parse(JSON.stringify(old)));
  const by = id => m.inventory.find(i => i.id === id);
  ck('the pass ran and says which pass it reached', m.ammoInit === X.AMMO_PASS && X.AMMO_PASS === 2);
  ck('a granted bundle unpacks: Arrows (20) ×2 is Arrow ×40', by('b1') && by('b1').name === 'Arrow' && by('b1').qty === 40, by('b1'));
  ck("...each Arrow a twentieth of the bundle's price and weight, of the arrow kind",
     by('b1').cost === 0.05 && by('b1').weight === 0.05 && same(by('b1').ammo, {kind: 'arrow'}));
  ck('...still granted, so removing the class takes it back', by('b1').grant === 'class:Ranger');
  ck('a bought loose stack learns its kind and stays its own stack', by('l1') && by('l1').qty === 5 && same(by('l1').ammo, {kind: 'arrow'}));
  ck('a 2014 bundle unpacks into the 2024 piece', by('c1') && by('c1').name === 'Bolt' && by('c1').qty === 20 &&
     by('c1').weight === 0.075 && !('cost' in by('c1')) && same(by('c1').ammo, {kind: 'bolt'}), by('c1'));
  ck('a 2024 launcher learns what it fires, nothing else touched', by('w1').weapon.ammo === 'arrow' && by('w1').weapon.dice === '1d8');
  ck('anything else is left exactly as it was', same(by('r1'), {id: 'r1', name: 'Rope', qty: 1}));
  ck("the update tool's baseline follows the pass, so the change reads as the pack's",
     by('w1').src.cfp.weapon === X.fpHash(by('w1').weapon) && by('w1').src.fp.weapon === X.fpHash(by('w1').weapon) &&
     by('b1').src.name === 'Arrow' && by('b1').src.fp.weight === X.fpHash(0.05) && by('b1').src.fp.cost === X.fpHash(0.05) &&
     by('b1').src.cfp.ammo === X.fpHash({kind: 'arrow'}) && by('b1').src.fp.ammo === X.fpHash({kind: 'arrow'}));
  ck("a player's own edit to a launcher still reads as theirs, and the pack side is left alone",
     by('w2').weapon.ammo === 'arrow' && by('w2').src.cfp.weapon !== X.fpHash(by('w2').weapon) && by('w2').src.fp.weapon === editedFp);
  ck('a second load changes nothing', JSON.stringify(X.migrate(JSON.parse(JSON.stringify(m)))) === JSON.stringify(m));

  const paid = X.migrate({abilities: {}, inventory: [{id: 'p', name: 'Bolts (20)', qty: 1, cost: 2, weight: 1.5}]}).inventory[0];
  ck('a bundle bought for 2 gp makes bolts at 0.1 gp each', paid.name === 'Bolt' && paid.qty === 20 && paid.cost === 0.1, paid);
  const sling = X.migrate({abilities: {}, inventory: [stamp({id: 's', name: 'Sling Bullets (20)', qty: 1, cost: 0.04, weight: 1.5, type: 'Ammunition'})]}).inventory[0];
  ck("sling bullets keep their fraction of a copper, and the baseline knows the pack's bullet has no price",
     sling.cost === 0.002 && sling.src.fp.cost === X.fpHash(undefined) && sling.src.cfp.cost === X.fpHash(0.002), sling);
  const found = X.migrate({abilities: {}, inventory: [stamp({id: 'f', name: 'Arrows (20)', qty: 1, cost: 1, weight: 1, type: 'Ammunition',
                                                              description: 'Ammunition · 1 gp · 1 lb\nArrows.'}, 'browse')]}).inventory[0];
  ck("a finder copy's meta line now describes one arrow", found.description === 'Ammunition · 5 cp · 0.05 lb\nArrows.' &&
     found.src.fp.description === X.fpHash(found.description), found.description);

  const two = X.migrate({abilities: {}, inventory: [{id: 'a', name: 'Arrows (20)', qty: 1}, {id: 'b', name: 'Arrows (20)', qty: 1}]});
  ck('two unpacked bundles of one grant become one stack', two.inventory.length === 1 && two.inventory[0].qty === 40, two.inventory);
  const ahead = X.migrate({abilities: {}, inventory: [{id: 'u', name: 'Arrows (20)', qty: 1}, {id: 'l', name: 'Arrow', qty: 5, ammo: {kind: 'arrow'}}]});
  ck('a bundle unpacked ahead of a stack the player had still joins it, which keeps its place and id',
     ahead.inventory.length === 1 && ahead.inventory[0].id === 'l' && ahead.inventory[0].qty === 25, ahead.inventory);
  const behind = X.migrate({abilities: {}, inventory: [{id: 'l', name: 'Arrow', qty: 5}, {id: 'u', name: 'Arrows (20)', qty: 1}]});
  ck('...and so does one unpacked behind it', behind.inventory.length === 1 && behind.inventory[0].id === 'l' && behind.inventory[0].qty === 25, behind.inventory);
  const kept = X.migrate({abilities: {}, inventory: [{id: 'a', name: 'Arrow', qty: 3, ammo: {kind: 'arrow'}}, {id: 'b', name: 'Arrow', qty: 4, ammo: {kind: 'arrow'}}]});
  ck('stacks the player kept apart stay apart', kept.inventory.length === 2);
  ck('a fresh character has no spent ammunition, and the pass has not run on it',
     same(X.blankChar().ammoSpent, {}) && !('ammoInit' in X.blankChar()));
  const spent = {s1: {n: 3, kind: 'arrow', snap: {id: 's1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}}}};
  ck('ammoSpent survives a save and a load', same(X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {ammoSpent: spent})))).ammoSpent, spent));
  ck('ammoSpent from a file that is not a map resets', same(X.migrate({abilities: {}, ammoSpent: [1]}).ammoSpent, {}));

  /* #6 final review, item 1: "constructor" and "__proto__" find an INHERITED
     property of a plain-object table, never undefined, so the old lookups
     read one as a real bundle/piece/launcher and threw reading .name off it. */
  let hostileMigrate;
  try {
    hostileMigrate = X.migrate({abilities: {}, inventory: [
      {id: 'p1', name: 'Constructor', qty: 1}, {id: 'p2', name: '__proto__', qty: 1},
      {id: 'p3', name: 'toString', qty: 1, weapon: {kind: 'ranged'}}]});
  } catch (e) { hostileMigrate = e; }
  ck('an item named Constructor, __proto__ or toString does not throw migrate()', !(hostileMigrate instanceof Error), hostileMigrate);
  ck('...and none of them is read as real ammunition data',
     hostileMigrate && !hostileMigrate.inventory.some(i => i.ammo) &&
     !((hostileMigrate.inventory.find(i => i.id === 'p3') || {}).weapon || {}).ammo, hostileMigrate);
  ck('ammoTable() is an OWN-property lookup: "constructor" and "__proto__" read as absent',
     X.ammoTable({foo: 1}, 'constructor') === undefined && X.ammoTable({foo: 1}, '__proto__') === undefined &&
     X.ammoTable({foo: 1}, 'foo') === 1);
}

/* ---- a new character never runs the one-time ammo pass (#6 final review) ---- */
{
  ctx.newCharacter('Ammo Init Test', 'dnd');
  ck("newCharacter() marks the one-time pass already done, so it never runs on a fresh sheet",
     X.character.ammoInit === X.AMMO_PASS);
}

/* ---- ammunition arrives unpacked: the finder and starting equipment (#6) ---- */
{
  X.resetRules();
  X.mergeRules({system: 'XPHB', items: [
    {name: 'Arrow', category: 'Ammunition', type: 'Ammunition', weight: 0.05, cost: '5 cp', description: 'An arrow.', effects: [], ammo: {kind: 'arrow'}},
    {name: 'Arrows (20)', category: 'Ammunition', type: 'Ammunition', weight: 1, cost: '1 gp', description: 'Arrows.', effects: [],
     ammo: {kind: 'arrow'}, pack: {item: 'Arrow', qty: 20}}]}, '5e.json');
  const c = X.blankChar(); X.character = c;
  X.addLibraryItems([X.rules.items.find(x => x.name === 'Arrows (20)')], null, null, 2);
  ck('the finder adds two bundles of arrows as forty Arrows', c.inventory.length === 1 && c.inventory[0].name === 'Arrow' && c.inventory[0].qty === 40, c.inventory);
  ck('...priced and weighed as one Arrow, of the arrow kind, stamped from the Arrow entry',
     c.inventory[0].cost === 0.05 && c.inventory[0].weight === 0.05 && JSON.stringify(c.inventory[0].ammo) === '{"kind":"arrow"}' &&
     !!c.inventory[0].src && c.inventory[0].src.name === 'Arrow', c.inventory[0]);
  X.addLibraryItems([X.rules.items.find(x => x.name === 'Arrow')], null, null, 5);
  ck('more Arrows join the same stack', c.inventory.length === 1 && c.inventory[0].qty === 45);
  ck("the copy's ammo is its own object, not the pack's", c.inventory[0].ammo !== X.rules.items.find(x => x.name === 'Arrow').ammo);
  const p = X.blankChar(); X.character = p;
  X.addLibraryItems([X.rules.items.find(x => x.name === 'Arrows (20)')], null, 2, 1);
  ck('a price paid for a bundle is split across its pieces: 2 gp for twenty is 0.1 gp an arrow',
     p.inventory.length === 1 && p.inventory[0].qty === 20 && p.inventory[0].cost === 0.1, p.inventory);
  const g = X.blankChar(); X.character = g;
  X.grantItemByName('Arrows (20)', 1, 'class:Ranger');
  ck('a class that grants Arrows (20) grants twenty Arrows', g.inventory.length === 1 && g.inventory[0].name === 'Arrow' &&
     g.inventory[0].qty === 20 && g.inventory[0].grant === 'class:Ranger' && JSON.stringify(g.inventory[0].ammo) === '{"kind":"arrow"}', g.inventory);
  X.grantItemByName('Arrows (20)', 1, 'class:Ranger');
  ck('a second grant from the same source joins its stack', g.inventory.length === 1 && g.inventory[0].qty === 40);
  X.resetRules();
}

/* ---- a pack older than ammunition (#96) ----
   The 2024 pack players have was published with 1.7.2, before ammunition: no
   weapon.ammo on a launcher, no ammo on a piece, no pack on a bundle. These are
   its entries with those fields as it shipped them, trimmed of the rest. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bare = () => [
    {name: 'Light Crossbow', category: 'Weapon', type: 'Simple Ranged Weapon', weight: 5, cost: '25 gp', description: 'Bare.', effects: [],
     weapon: {kind: 'ranged', dice: '1d8', damageType: 'piercing', ability: 'dex', notes: 'Range 80/320 · Ammunition, Loading, Two-Handed'}},
    {name: 'Longbow', category: 'Weapon', type: 'Martial Ranged Weapon', weight: 2, cost: '50 gp', description: '', effects: [],
     weapon: {kind: 'ranged', dice: '1d8', damageType: 'piercing', ability: 'dex'}},
    {name: 'Bolt', category: 'Ammunition', type: 'Ammunition', weight: 0.075, cost: '5 cp', description: '', effects: []},
    {name: 'Bolts (20)', category: 'Ammunition', type: 'Ammunition', weight: 1.5, cost: '1 gp', description: '', effects: []},
    {name: 'Crossbow Bolts (20)', category: 'Ammunition', type: 'Ammunition', weight: 1.5, cost: '1 gp', description: '', effects: []},
    {name: 'Blowgun Needle', category: 'Ammunition', type: 'Ammunition', weight: 0.02, cost: '2 cp', description: '', effects: []},
    {name: 'Unbreakable Arrow', category: 'Ammunition', type: 'Ammunition', description: '', effects: []},
    {name: 'Dagger', category: 'Weapon', type: 'Simple Melee Weapon', weight: 1, cost: '2 gp', description: '', effects: [],
     weapon: {kind: 'melee', dice: '1d4', damageType: 'piercing', ability: 'finesse'}},
    {name: 'Rope', category: 'Adventuring Gear', type: 'Adventuring Gear', weight: 5, cost: '1 gp', description: '', effects: []}];
  const by = (arr, n) => arr.find(x => x.name === n);

  /* the repair itself, entry by entry */
  const e = bare(), wpn = by(e, 'Light Crossbow').weapon;
  const changed = e.map(x => X.ammoRepairDef(x));
  ck('a bare launcher learns what it fires, everything else kept',
     by(e, 'Light Crossbow').weapon.ammo === 'bolt' && by(e, 'Light Crossbow').weapon.dice === '1d8' && by(e, 'Longbow').weapon.ammo === 'arrow' &&
     by(e, 'Light Crossbow').weapon.notes === wpn.notes, by(e, 'Light Crossbow'));
  ck("...on a copy of the weapon, never the pack's own object", !('ammo' in wpn) && by(e, 'Light Crossbow').weapon !== wpn);
  ck('a bare piece learns its kind, a 2014 name its 2024 kind',
     same(by(e, 'Bolt').ammo, {kind: 'bolt'}) && same(by(e, 'Blowgun Needle').ammo, {kind: 'needle'}));
  ck("...and so does Xanathar's Unbreakable Arrow, the one magic piece the older packs had",
     same(by(e, 'Unbreakable Arrow').ammo, {kind: 'arrow'}));
  ck('a bare bundle becomes a bundle of its piece', same(by(e, 'Bolts (20)').ammo, {kind: 'bolt'}) && same(by(e, 'Bolts (20)').pack, {item: 'Bolt', qty: 20}));
  ck('...a 2014 bundle a bundle of the 2024 piece', same(by(e, 'Crossbow Bolts (20)').pack, {item: 'Bolt', qty: 20}));
  ck('anything not in the tables is left exactly as it was',
     same(by(e, 'Dagger'), by(bare(), 'Dagger')) && same(by(e, 'Rope'), by(bare(), 'Rope')));
  ck('...and the repair says which it changed', same(changed, [true, true, true, true, true, true, true, false, false]), changed);
  const own = {name: 'Longbow', weapon: {kind: 'ranged', ammo: 'flight arrow'}};
  const ownB = {name: 'Arrows (20)', ammo: {kind: 'arrow', bonus: 1}, pack: {item: '+1 Arrow', qty: 20}};
  ck("a pack's own value always wins", !X.ammoRepairDef(own) && own.weapon.ammo === 'flight arrow' &&
     !X.ammoRepairDef(ownB) && same(ownB, {name: 'Arrows (20)', ammo: {kind: 'arrow', bonus: 1}, pack: {item: '+1 Arrow', qty: 20}}));
  ck('junk, and a hostile name, are no ammunition',
     [null, 7, [], {}, {name: 'constructor'}, {name: '__proto__', weapon: {}}, {name: 'Sling', weapon: 'x'}].every(x => X.ammoRepairDef(x) === false));

  /* every path that loads rules repairs the pool: a merge... */
  X.resetRules();
  X.mergeRules({system: 'XPHB', items: bare()}, '5e.json');
  ck('a merged pack older than ammunition reads as the current packs do',
     by(X.rules.items, 'Light Crossbow').weapon.ammo === 'bolt' && same(by(X.rules.items, 'Bolts (20)').pack, {item: 'Bolt', qty: 20}));
  /* ...and a pool restored whole (the cache at boot, a settings file) */
  X.rules = Object.assign(X.rules, {items: bare()});
  X.reindexRules();
  ck('a pool restored from the cache is repaired too', by(X.rules.items, 'Light Crossbow').weapon.ammo === 'bolt' &&
     same(by(X.rules.items, 'Bolt').ammo, {kind: 'bolt'}));

  /* so every copy made from it is ammunition: the finder, and starting equipment */
  X.resetRules();
  X.mergeRules({system: 'XPHB', items: bare()}, '5e.json');
  const c = X.blankChar(); X.character = c;
  X.addLibraryItems([by(X.rules.items, 'Light Crossbow'), by(X.rules.items, 'Bolts (20)')], null, null, 1);
  const xb = by(c.inventory, 'Light Crossbow'), bolts = by(c.inventory, 'Bolt');
  ck('the finder adds a Light Crossbow that fires bolts', xb && xb.weapon.ammo === 'bolt', xb);
  ck('...and Bolts (20) as twenty Bolts of the bolt kind', bolts && bolts.qty === 20 && same(bolts.ammo, {kind: 'bolt'}) && !by(c.inventory, 'Bolts (20)'), c.inventory);
  ck('...which the crossbow loads', X.loadedStack(c, xb) === bolts);
  const g = X.blankChar(); X.character = g;
  X.grantItemByName('Light Crossbow', 1, 'class:Fighter');
  X.grantItemByName('Crossbow Bolts (20)', 1, 'class:Fighter');
  ck('starting equipment grants a crossbow that fires bolts, and twenty Bolts',
     by(g.inventory, 'Light Crossbow').weapon.ammo === 'bolt' && by(g.inventory, 'Bolt') && by(g.inventory, 'Bolt').qty === 20 &&
     same(by(g.inventory, 'Bolt').ammo, {kind: 'bolt'}), g.inventory);

  /* a sheet the first pass already ran on, holding copies made from the bare
     pack since: the second pass repairs them, and the update tool then agrees
     the copy and the repaired pack are the same, with nothing edited */
  /* stamped as the finder stamped them: from the bare entry, with the pack's
     source, so the update tool resolves them back through updResolve() */
  const stampBare = (it, def, shape) => X.stampSrc(it, Object.assign({_source: 'XPHB'}, def), 'item', 'items', shape);
  const bxb = bare()[0], bbolt = bare()[2];
  const mid = {name: 'Fighter', abilities: {}, ammoInit: '1', inventory: [
    stampBare({id: 'x', name: 'Light Crossbow', qty: 1, equipped: true, cost: 25, weight: 5, description: 'Bare.', effects: [],
               weapon: JSON.parse(JSON.stringify(bxb.weapon))}, bxb, 'plain'),
    stampBare({id: 'b', name: 'Bolt', qty: 6, cost: 0.05, weight: 0.075, description: 'Ammunition · 5 cp · 0.075 lb\n', effects: []}, bbolt, 'browse'),
    {id: 'k', name: 'Bolts (20)', qty: 1, cost: 1, weight: 1.5, category: 'Ammunition', type: 'Ammunition'},
    /* the workaround for this very bug: a bundle the player ticked as
       ammunition in the item editor and counted down by hand */
    {id: 'h', name: 'Crossbow Bolts (20)', qty: 17, ammo: {kind: 'bolt'}},
    {id: 'a', name: 'Arrow', qty: 9, ammo: {kind: 'arrow'}},
    {id: 'l', name: 'Longbow', qty: 1, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}, ammoStack: 'a'},
    {id: 'r', name: 'Rope', qty: 1}],
    ammoSpent: {a: {n: 3, kind: 'arrow', asked: 2, snap: {id: 'a', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}}}}};
  const m2 = X.migrate(JSON.parse(JSON.stringify(mid)));
  const at = id => m2.inventory.find(i => i.id === id);
  ck('the second pass runs on a sheet the first already did, whatever a file wrote for it', m2.ammoInit === X.AMMO_PASS);
  ck('...the crossbow fires bolts', at('x').weapon.ammo === 'bolt');
  ck('...the bundle unpacks and joins the Bolts already carried', !at('k') && at('b').qty === 26 && same(at('b').ammo, {kind: 'bolt'}), m2.inventory);
  ck('...and nothing else moves', same(at('r'), {id: 'r', name: 'Rope', qty: 1}));
  ck("...a bundle the player already marked as ammunition keeps their count, not twenty times it (review)",
     at('h') && at('h').qty === 17 && at('h').name === 'Crossbow Bolts (20)' && at('b').qty === 26, m2.inventory);
  ck('...and spent counts, Recover and a chosen stack are left as they were',
     same(m2.ammoSpent, mid.ammoSpent) && at('l').ammoStack === 'a' && at('a').qty === 9);
  X.resetRules();
  X.mergeRules({system: 'XPHB', items: bare()}, '5e.json');
  const rx = X.updResolve(at('x'), 'item').def, rb = X.updResolve(at('b'), 'item').def;
  ck('the update tool resolves the repaired copies to the repaired entries',
     rx === by(X.rules.items, 'Light Crossbow') && rb === by(X.rules.items, 'Bolt'));
  ck("...and sees no change between them, and no edit",
     !!rx && !!rb && X.updChangedFields(at('x'), rx, 'item').length === 0 && X.updEdited(at('x'), 'item') === false &&
     X.updChangedFields(at('b'), rb, 'item').length === 0 && X.updEdited(at('b'), 'item') === false,
     [rx && X.updChangedFields(at('x'), rx, 'item'), rb && X.updChangedFields(at('b'), rb, 'item')]);
  ck('a sheet already at this pass is left alone', JSON.stringify(X.migrate(JSON.parse(JSON.stringify(m2)))) === JSON.stringify(m2));
  const done = {abilities: {}, ammoInit: X.AMMO_PASS, inventory: [{id: 'k', name: 'Bolts (20)', qty: 1}]};
  ck('...even one still holding a bundle', X.migrate(JSON.parse(JSON.stringify(done))).inventory[0].name === 'Bolts (20)');
  ck('...or one whose file wrote the pass as text', X.migrate({abilities: {}, ammoInit: '2', inventory: [{id: 'k', name: 'Bolts (20)', qty: 1}]}).inventory[0].name === 'Bolts (20)');
  X.resetRules();
}

/* ---- the recovery rule: who gets what back (#104, spec §4) ---- */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ck('#104 a new character recovers half', X.blankChar().ammoRecovery === 'half' && X.ammoRecoveryOf(X.blankChar()) === 'half');
  ck('#104 a sheet from before reads as half, and so does junk',
     X.ammoRecoveryOf(X.migrate({abilities: {}})) === 'half' && X.ammoRecoveryOf({ammoRecovery: 'lots'}) === 'half' &&
     X.ammoRecoveryOf({ammoRecovery: 'constructor'}) === 'half' && X.ammoRecoveryOf(null) === 'half');
  ck('#104 each rule reads as itself', ['half', 'all', 'hits', 'none'].every(r => X.ammoRecoveryOf({ammoRecovery: r}) === r));
  ck('#104 the rule survives a save and load',
     X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {ammoRecovery: 'hits'})))).ammoRecovery === 'hits');
  ck('#104 an item override is always, never, or nothing',
     X.itemRecover({recover: 'always'}) === 'always' && X.itemRecover({recover: 'never'}) === 'never' &&
     X.itemRecover({recover: 'sometimes'}) === '' && X.itemRecover({recover: '__proto__'}) === '' && X.itemRecover(null) === '');
  const w = n => ({name: 'Dagger', weapon: {kind: 'melee', dice: '1d4', notes: n}});
  ck('#104 the SRD thrown weapons read as thrown',
     ['Range 20/60 · Finesse, Light, Thrown · Mastery: Nick', 'Range 30/120 · Thrown · Mastery: Slow',
      'Range 20/60 · Versatile 1d8 · Thrown · Mastery: Sap'].every(n => X.weaponThrown(w(n))));
  ck('#104 Thrown must be a whole property, in any case',
     X.weaponThrown(w('Light, THROWN')) && !X.weaponThrown(w('Unthrown, Light')) && !X.weaponThrown(w('Finesse, Light')) && !X.weaponThrown(w('')));
  ck('#104 a launcher is never thrown, and junk is not thrown',
     !X.weaponThrown({weapon: {ammo: 'arrow', notes: 'Thrown'}}) && !X.weaponThrown({weapon: {notes: 7}}) &&
     !X.weaponThrown({weapon: []}) && !X.weaponThrown({weapon: 'Thrown'}) && !X.weaponThrown(null));
  ck("#104 a thrown weapon's kind is its own name", X.ammoThrownKind({name: ' +1  Dagger '}) === '+1 dagger' && X.ammoThrownKind({name: ''}) === 'thrown weapon');
  const bullet = {ammo: {kind: 'firearm bullet'}}, arrow = {ammo: {kind: 'arrow'}}, dagger = w('Finesse, Light, Thrown');
  ck('#104 defaults: bullets never, thrown weapons always, arrows none',
     X.ammoDefaultRecover(bullet) === 'never' && X.ammoDefaultRecover(dagger) === 'always' && X.ammoDefaultRecover(arrow) === '' &&
     X.ammoDefaultRecover({ammo: {kind: 'constructor'}}) === '' && X.ammoDefaultRecover(null) === '');
  const none = {ammoRecovery: 'none'};
  ck('#104 the rule: the item, then its default, then the sheet',
     X.ammoRecoverRule(none, Object.assign({recover: 'never'}, dagger)) === 'never' && X.ammoRecoverRule(none, dagger) === 'always' &&
     X.ammoRecoverRule({ammoRecovery: 'all'}, bullet) === 'never' && X.ammoRecoverRule(none, arrow) === 'none' &&
     X.ammoRecoverRule(none, Object.assign({recover: 'always'}, arrow)) === 'always' && X.ammoRecoverRule({}, null) === 'half');
  const e = {n: 7, hits: 3, misses: 2};
  ck('#104 how many come back under each rule',
     X.ammoBack('always', e) === 7 && X.ammoBack('all', e) === 7 && X.ammoBack('half', e) === 3 &&
     X.ammoBack('hits', e) === 4 && X.ammoBack('never', e) === 0 && X.ammoBack('none', e) === 0);
  ck('#104 hits only, with no shot answered, is half', X.ammoBack('hits', {n: 5, hits: 0, misses: 0}) === 2);
  const E = v => X.ammoSpentEntry({ammoSpent: {a: v}}, 'a');
  ck('#104 an entry reads its tallies', same([E({n: 5, kind: 'arrow', hits: 2, misses: 1}).hits, E({n: 5, kind: 'arrow', hits: 2, misses: 1}).misses], [2, 1]));
  ck('#104 tallies are clamped: never below 0, never past n together',
     E({n: 5, kind: 'arrow', hits: 9, misses: 9}).hits === 5 && E({n: 5, kind: 'arrow', hits: 9, misses: 9}).misses === 0 &&
     E({n: 5, kind: 'arrow', hits: -1, misses: 'x'}).hits === 0 && E({n: 5, kind: 'arrow', hits: 3, misses: 4}).misses === 2);
  ck('#104 an entry from before #104 has no answers', E({n: 5, kind: 'arrow'}).hits === 0 && E({n: 5, kind: 'arrow'}).misses === 0);
}

/* ---- a shot's answer, and throwing (#104, spec §5) ---- */
{
  const DAGGER = 'Range 20/60 · Finesse, Light, Thrown · Mastery: Nick';
  const mk = () => {
    const c = X.blankChar();
    c.inventory = [{id: 'w1', name: 'Longbow', qty: 1, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
                   {id: 's1', name: 'Arrow', qty: 5, ammo: {kind: 'arrow'}},
                   {id: 'd1', name: 'Dagger', qty: 2, equipped: true, weapon: {kind: 'melee', dice: '1d4', notes: DAGGER}}];
    return c;
  };
  let c = mk(); const bow = c.inventory[0];
  X.fireAmmo(c, bow, 'hit'); X.fireAmmo(c, bow, 'miss'); X.fireAmmo(c, bow); const last = X.fireAmmo(c, bow, 'hit');
  let e = X.ammoSpentEntry(c, 's1');
  ck('#104 a shot records its answer, and an unanswered one records none', e.n === 4 && e.hits === 2 && e.misses === 1, e);
  ck('#104 ...and the shot says which', last.outcome === 'hit');
  ck('#104 Undo takes the answer back with the shot', X.undoFire(c, last) && X.ammoSpentEntry(c, 's1').hits === 1 && X.ammoSpentEntry(c, 's1').n === 3);
  ck('#104 an answer that is neither counts as none',
     (() => { const k = mk(); X.fireAmmo(k, k.inventory[0], 'graze'); const x = X.ammoSpentEntry(k, 's1'); return x.n === 1 && x.hits === 0 && x.misses === 0; })());
  c = mk(); const dag = c.inventory[2];
  const t = X.throwAmmo(c, dag);
  ck('#104 a throw takes one from the weapon itself', !!t && dag.qty === 1 && t.left === 1 && !t.removed && t.kind === 'dagger');
  ck('#104 ...and counts it under the weapon, with a one-piece copy',
     X.ammoSpentEntry(c, 'd1').n === 1 && X.ammoSpentEntry(c, 'd1').snap.name === 'Dagger' && X.ammoSpentEntry(c, 'd1').snap.qty === 1);
  const t2 = X.throwAmmo(c, dag, 'miss');
  ck('#104 the last throw leaves the weapon on the sheet at ×0, in its place',
     dag.qty === 0 && c.inventory.indexOf(dag) === 2 && !t2.removed && X.ammoSpentEntry(c, 'd1').misses === 1);
  ck('#104 at ×0 there is nothing to throw', X.throwAmmo(c, dag) === null && dag.qty === 0 && X.ammoSpentEntry(c, 'd1').n === 2);
  ck('#104 Undo of a throw puts the weapon back to ×1', X.undoFire(c, t2) && dag.qty === 1 && X.ammoSpentEntry(c, 'd1').n === 1);
  ck('#104 only a thrown weapon on this sheet is thrown',
     X.throwAmmo(c, c.inventory[0]) === null && X.throwAmmo(c, {id: 'x', name: 'Dagger', qty: 3, weapon: {notes: 'Thrown'}}) === null);
}

/* ---- recovery under each rule, its record and its Undo (#104, spec §4.3, §6) ---- */
{
  const norm = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  const mk = rule => {
    const c = X.blankChar(); c.ammoRecovery = rule;
    c.inventory = [{id: 's1', name: 'Arrow', qty: 2, ammo: {kind: 'arrow'}},
                   {id: 'b1', name: 'Firearm Bullet', qty: 3, ammo: {kind: 'firearm bullet'}},
                   {id: 'd1', name: 'Dagger', qty: 0, weapon: {kind: 'melee', dice: '1d4', notes: 'Finesse, Light, Thrown'}}];
    c.ammoSpent = {s1: {n: 6, hits: 3, misses: 1, kind: 'arrow'}, b1: {n: 4, kind: 'firearm bullet'}, d1: {n: 2, kind: 'dagger'}};
    return c;
  };
  const backOf = (c, k) => (X.ammoRecoverable(c).find(r => r.kind === k) || {}).back || 0;
  ck('#104 half: 3 of 6 arrows, no bullets, both daggers',
     backOf(mk('half'), 'arrow') === 3 && backOf(mk('half'), 'firearm bullet') === 0 && backOf(mk('half'), 'dagger') === 2);
  ck('#104 all: every arrow', backOf(mk('all'), 'arrow') === 6);
  ck('#104 hits only: the 3 hits and half the 2 unanswered', backOf(mk('hits'), 'arrow') === 4);
  ck('#104 none: no arrows, but the daggers still come back', backOf(mk('none'), 'arrow') === 0 && backOf(mk('none'), 'dagger') === 2);
  ck('#104 a stack set to always wins over None', (() => { const c = mk('none'); c.inventory[0].recover = 'always'; return backOf(c, 'arrow') === 6; })());
  ck('#104 a stack set to never wins over All', (() => { const c = mk('all'); c.inventory[0].recover = 'never'; return backOf(c, 'arrow') === 0; })());
  ck("#104 a stack that is gone is read from its copy",
     (() => { const c = mk('all'); c.inventory.splice(0, 1); c.ammoSpent.s1.snap = {id: 's1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}, recover: 'never'}; return backOf(c, 'arrow') === 0; })());

  let c = mk('none');
  ck('#104 under None, recovering the daggers puts them back on the weapon at ×0', X.recoverAmmo(c, ['dagger'], {}) === 2 && c.inventory[2].qty === 2);
  ck('#104 ...and the arrows, a kind not asked for, stay on record', 's1' in c.ammoSpent && !('d1' in c.ammoSpent));

  c = mk('all'); const r2 = {};
  const inv0 = JSON.stringify(c.inventory), spent0 = norm(c.ammoSpent);
  X.recoverAmmo(c, ['arrow', 'dagger'], r2);
  ck('#104 recovery records what it gave and what it cleared',
     r2.added.length === 2 && r2.made.length === 0 && Object.keys(r2.cleared).sort().join() === 'd1,s1', r2);
  ck('#104 Undo recovery puts everything back as it was',
     X.undoRecovery(c, r2) && JSON.stringify(c.inventory) === inv0 && norm(c.ammoSpent) === spent0, [c.inventory, c.ammoSpent]);
  ck('#104 ...once', X.undoRecovery(c, r2) === false);

  c = mk('all'); const r3 = {};
  X.recoverAmmo(c, ['arrow'], r3);                                           // arrows 2 -> 8; s1 cleared
  X.fireAmmo(c, {id: 'w', name: 'Bow', weapon: {ammo: 'arrow'}}, 'hit');      // 8 -> 7; a new s1 entry n 1, hits 1
  X.undoRecovery(c, r3);
  ck('#104 Undo recovery after a later shot takes back only what it gave, and keeps the shot',
     c.inventory[0].qty === 1 && c.ammoSpent.s1.n === 7 && c.ammoSpent.s1.hits === 4, [c.inventory[0], c.ammoSpent.s1]);

  c = mk('all'); c.inventory.splice(0, 1); c.ammoSpent.s1.snap = {id: 's1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}}; const r4 = {};
  X.recoverAmmo(c, ['arrow'], r4);
  ck('#104 a stack rebuilt by recovery is removed by its Undo',
     r4.made.length === 1 && X.undoRecovery(c, r4) && !c.inventory.some(i => i.id === 's1') && c.ammoSpent.s1.n === 6, c.inventory);
  ck('#104 a call with no record still returns the count', X.recoverAmmo(mk('half'), ['arrow']) === 3);
  ck('#104 Undo with no record, or a junk one, does nothing', X.undoRecovery(mk('half'), null) === false && X.undoRecovery(mk('half'), {}) === false);

  /* ---- review round 1, finding 1: Undo must not resurrect a stack — or a
     grant's history — that is no longer there (spec §8 wins over §6's "put
     back as it was") ---- */
  c = mk('all'); const ra = {};
  X.recoverAmmo(c, ['arrow'], ra);                            // s1: arrows 2 -> 8, cleared
  c.inventory = c.inventory.filter(i => i.id !== 's1');       // the delete handler's own removal...
  X.forgetAmmo(c, 's1');                                       // ...and its own forgetAmmo() call
  ck('#104 review 1a: Undo does not restore a topped-up stack the player deleted',
     X.undoRecovery(c, ra) === true && !('s1' in c.ammoSpent) && !X.ammoRecoverable(c).some(r => r.kind === 'arrow'));

  c = mk('all'); c.inventory.splice(0, 1);
  c.ammoSpent.s1.snap = {id: 's1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}};
  const rb = {};
  X.recoverAmmo(c, ['arrow'], rb);                            // rebuilds s1 at qty 6
  c.inventory = c.inventory.filter(i => i.id !== 's1');       // deleted before Undo
  X.forgetAmmo(c, 's1');
  ck('#104 review 1b: Undo does not restore a rebuilt stack the player deleted',
     X.undoRecovery(c, rb) === true && !('s1' in c.ammoSpent));

  {
    const g = X.blankChar(); X.character = g; g.ammoRecovery = 'all';
    g.inventory = [{id: 'g1', name: 'Arrow', qty: 2, ammo: {kind: 'arrow'}, grant: 'class:Ranger'}];
    g.ammoSpent = {g1: {n: 6, hits: 3, misses: 1, kind: 'arrow',
      snap: {id: 'g1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}, grant: 'class:Ranger'}}};
    const rc = {};
    ck('#104 review 1c setup: recovering the granted stack', X.recoverAmmo(g, ['arrow'], rc) === 6 && g.inventory[0].qty === 8);
    X.revertEquipmentGrants('class:Ranger');                   // the real removal path (50-classrace.js)
    ck('#104 review 1c: the grant removed the stack it had just topped up', !g.inventory.length);
    ck('#104 review 1c: Undo does not restore a granted stack whose source is gone',
       X.undoRecovery(g, rc) === true && !('g1' in g.ammoSpent));
  }

  /* The entry has NO dependency at all — its stack was already gone, nothing
     was given back — so this exercises grantSidLive() specifically: restored
     when the granting class is still there, not when it isn't (reproduced
     without a full removeClass(), which this suite can't call directly; the
     distinction grantSidLive() reads is exactly what removeClass() leaves
     behind either way: whether character.classes still names it). */
  {
    const g2 = X.blankChar(); g2.ammoRecovery = 'none';         // arrow has no app default, so None really gives 0
    g2.inventory = [];
    g2.ammoSpent = {g2a: {n: 2, kind: 'arrow', snap: {id: 'g2a', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}, grant: 'class:Ranger'}}};
    const re = {};
    ck('#104 review 1 (grantSidLive) setup: nothing to recover for an already-gone granted stack',
       X.recoverAmmo(g2, ['arrow'], re) === 0);
    ck('#104 review 1 (grantSidLive): Undo does not restore it when the class is gone',
       X.undoRecovery(g2, re) === true && !('g2a' in g2.ammoSpent));

    const g3 = X.blankChar(); g3.ammoRecovery = 'none'; g3.classes = [{name: 'Ranger', level: 1}];
    g3.inventory = [];
    g3.ammoSpent = {g3a: {n: 2, kind: 'arrow', snap: {id: 'g3a', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}, grant: 'class:Ranger'}}};
    const rf = {};
    X.recoverAmmo(g3, ['arrow'], rf);
    ck('#104 review 1 (grantSidLive): ...but comes back when the class is still there',
       X.undoRecovery(g3, rf) === true && g3.ammoSpent.g3a && g3.ammoSpent.g3a.n === 2);
  }

  /* ---- review round 1, finding 2: a shot since recovery that Undo cannot
     fully take back must not be counted twice ---- */
  c = mk('all'); const rg = {};
  X.recoverAmmo(c, ['arrow'], rg);                             // s1: arrows 2 -> 8
  for (let i = 0; i < 8; i++) X.fireAmmo(c, {id: 'w', name: 'Bow', weapon: {ammo: 'arrow'}}, '');
  ck('#104 review 2 setup: firing the whole recovered stack removes it, with a fresh n-8 entry',
     !c.inventory.some(i => i.id === 's1') && c.ammoSpent.s1.n === 8);
  X.undoRecovery(c, rg);
  ck('#104 review 2: Undo after it is all fired out does not double-count those shots (8, not 14)',
     c.ammoSpent.s1.n === 8 && !c.inventory.some(i => i.id === 's1'));

  c = mk('none'); const rh = {};
  X.recoverAmmo(c, ['dagger'], rh);                            // dagger: ×0 -> ×2 (Thrown defaults to always)
  X.throwAmmo(c, c.inventory[2], ''); X.throwAmmo(c, c.inventory[2], '');
  ck('#104 review 2 setup: throwing the recovered dagger back out leaves it at ×0 with a fresh n-2 entry',
     c.inventory[2].qty === 0 && c.ammoSpent.d1.n === 2);
  X.undoRecovery(c, rh);
  ck('#104 review 2: Undo of a thrown weapon does not double-count either (n 2, ×0)',
     c.inventory[2].qty === 0 && c.ammoSpent.d1.n === 2);

  /* ---- review round 1, finding 3: Undo re-points a weapon only if it is
     still pointed where recovery left it ---- */
  {
    const c5 = X.blankChar(); c5.ammoRecovery = 'all';
    c5.inventory = [
      {id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}, ammoStack: 's1'},
      {id: 's2', name: 'Arrow', qty: 3, ammo: {kind: 'arrow'}}];
    c5.ammoSpent = {s1: {n: 6, hits: 3, misses: 1, kind: 'arrow', snap: {id: 's1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}}}};
    const inv5 = JSON.stringify(c5.inventory), spent5 = norm(c5.ammoSpent), rh3 = {};
    X.recoverAmmo(c5, ['arrow'], rh3);
    ck('#104 review 3 setup: a home-join repoints the weapon and records its target',
       rh3.repointed.length === 1 && rh3.repointed[0].to === 's2' && c5.inventory[0].ammoStack === 's2' && c5.inventory[1].qty === 9);
    ck('#104 review 3: Undo of a home-join round-trips inventory, ammoSpent and the pointer',
       X.undoRecovery(c5, rh3) && JSON.stringify(c5.inventory) === inv5 && norm(c5.ammoSpent) === spent5 && c5.inventory[0].ammoStack === 's1');
  }
  {
    const c6 = X.blankChar(); c6.ammoRecovery = 'all';
    c6.inventory = [
      {id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}, ammoStack: 's1'},
      {id: 's2', name: 'Arrow', qty: 3, ammo: {kind: 'arrow'}}];
    c6.ammoSpent = {s1: {n: 6, hits: 3, misses: 1, kind: 'arrow', snap: {id: 's1', name: 'Arrow', qty: 1, ammo: {kind: 'arrow'}}}};
    const rh4 = {};
    X.recoverAmmo(c6, ['arrow'], rh4);
    ck('#104 review 3 setup: the weapon is repointed to the home stack', c6.inventory[0].ammoStack === 's2');
    c6.inventory[0].ammoStack = 's3';                          // the player loads a different stack since
    X.undoRecovery(c6, rh4);
    ck('#104 review 3: Undo leaves a weapon the player has since re-loaded alone',
       c6.inventory[0].ammoStack === 's3');
  }

  /* ---- review round 1, folded in: a ×0 non-thrown stack recovery gave
     nothing to must not be removed by its own Undo (reachable since an
     item's own Quantity can now be set to 0 in the editor) ---- */
  {
    const c7 = X.blankChar(); c7.ammoRecovery = 'half';
    c7.inventory = [{id: 'z1', name: 'Arrow', qty: 0, ammo: {kind: 'arrow'}}];
    c7.ammoSpent = {z1: {n: 1, kind: 'arrow'}};
    const rz = {};
    ck('#104 folded-in setup: half of 1 shot is 0, so recovery clears the entry but gives nothing',
       X.recoverAmmo(c7, ['arrow'], rz) === 0 && c7.inventory[0].id === 'z1' && c7.inventory[0].qty === 0 && !('z1' in c7.ammoSpent));
    ck('#104 folded-in: Undo recovery leaves the ×0 stack on the sheet, not removed, and restores the entry',
       X.undoRecovery(c7, rz) && c7.inventory.some(i => i.id === 'z1') && c7.inventory[0].qty === 0 && c7.ammoSpent.z1.n === 1,
       [c7.inventory, c7.ammoSpent]);
  }
}

/* ---- the thrown weapon's row, and when Fire asks (#104, spec §5.2, §5.4) ---- */
{
  const DAGGER = 'Range 20/60 · Finesse, Light, Thrown · Mastery: Nick';
  const c = X.blankChar();
  c.inventory = [{id: 'd1', name: 'Dagger', qty: 2, equipped: true, weapon: {kind: 'melee', dice: '1d4', notes: DAGGER}},
                 {id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
                 {id: 's1', name: 'Arrow', qty: 4, ammo: {kind: 'arrow'}},
                 {id: 'm1', name: 'Mace', qty: 1, equipped: true, weapon: {kind: 'melee', dice: '1d6', notes: ''}}];
  const h = X.ammoLineHTML(c, {itemId: 'd1'});
  ck("#104 a thrown weapon's row shows its count and Throw, and no picker or Fire",
     h.includes('>Dagger ×2<') && /data-ammo-throw="d1"[^>]*>Throw</.test(h) && !h.includes('data-ammo-fire') && !h.includes('data-ammo-pick'), h);
  c.inventory[0].qty = 0;
  ck('#104 ...Throw is disabled at ×0', /data-ammo-throw="d1" disabled/.test(X.ammoLineHTML(c, {itemId: 'd1'})), X.ammoLineHTML(c, {itemId: 'd1'}));
  c.ammoSpent = {d1: {n: 2, kind: 'dagger'}};
  ck('#104 ...and offers Recover 2 for the two thrown', /data-ammo-recover="d1"[^>]*>Recover 2</.test(X.ammoLineHTML(c, {itemId: 'd1'})));
  ck('#104 a weapon that neither fires nor is thrown draws no line', X.ammoLineHTML(c, {itemId: 'm1'}) === '');
  ck("#104 a launcher's row is as it was", /data-ammo-fire="w1"/.test(X.ammoLineHTML(c, {itemId: 'w1'})));
  const hh = X.ammoLineHTML({inventory: [{id: 'x"y', name: '<i>Dagger', qty: 1, weapon: {notes: 'Thrown'}}]}, {itemId: 'x"y'});
  ck('#104 the thrown row escapes what a file put in the item', !hh.includes('<i>') && !hh.includes('x"y') && hh.includes('&lt;i&gt;Dagger'), hh);
  ck('#104 Fire asks only under Hits only, for an item on the sheet rule',
     X.ammoAsks({ammoRecovery: 'hits'}, {ammo: {kind: 'arrow'}}) && !X.ammoAsks({ammoRecovery: 'half'}, {ammo: {kind: 'arrow'}}) &&
     !X.ammoAsks({ammoRecovery: 'hits'}, {ammo: {kind: 'arrow'}, recover: 'always'}) &&
     !X.ammoAsks({ammoRecovery: 'hits'}, {weapon: {notes: 'Thrown'}}) && !X.ammoAsks({ammoRecovery: 'hits'}, null));
  /* through the taps: under Hits only Fire asks first and fires nothing; with an answer it fires */
  const t = X.blankChar(); X.character = t; t.ammoRecovery = 'hits';
  t.inventory = JSON.parse(JSON.stringify(c.inventory)); t.inventory[0].qty = 2; t.ammoSpent = {};
  ck('#104 under Hits only, Fire asks and fires nothing yet', X.fireWeapon('w1', false) === null && t.inventory.find(i => i.id === 's1').qty === 4);
  ck('#104 ...the answer fires, with its tally', !!X.fireWeapon('w1', false, 'hit') && X.ammoSpentEntry(t, 's1').hits === 1 && t.inventory.find(i => i.id === 's1').qty === 3);
  ck('#104 a thrown weapon never asks: Throw throws at once', !!X.throwWeaponTap('d1', false) && t.inventory[0].qty === 1 && X.ammoSpentEntry(t, 'd1').n === 1);
  ck('#104 Recover on the thrown row brings it back', X.recoverWeaponAmmo('d1', false) === 1 && t.inventory[0].qty === 2);
  /* final review item 2: the row reads the weapon's own entry, not its kind —
     a rename after the throw hid Recover though End combat still recovered it */
  X.throwWeaponTap('d1', false); t.inventory[0].name = 'Silvered Dagger';
  ck('#104 throw, then rename: the row still offers Recover 1',
     /data-ammo-recover="d1"[^>]*>Recover 1</.test(X.ammoLineHTML(t, {itemId: 'd1'})), X.ammoLineHTML(t, {itemId: 'd1'}));
  ck('#104 ...and the tap recovers it', X.recoverWeaponAmmo('d1', false) === 1 && t.inventory[0].qty === 2 && !('d1' in t.ammoSpent));
  /* two daggers on one sheet: each row's N is its own, and its tap gives back exactly that */
  t.inventory.push({id: 'd2', name: 'Dagger', qty: 1, equipped: true, weapon: {kind: 'melee', dice: '1d4', notes: DAGGER}});
  t.inventory[0].name = 'Dagger';
  X.throwWeaponTap('d1', false); X.throwWeaponTap('d1', false); X.throwWeaponTap('d2', false);
  ck('#104 two daggers: each row offers its own count back',
     />Recover 2</.test(X.ammoLineHTML(t, {itemId: 'd1'})) && />Recover 1</.test(X.ammoLineHTML(t, {itemId: 'd2'})),
     [X.ammoLineHTML(t, {itemId: 'd1'}), X.ammoLineHTML(t, {itemId: 'd2'})]);
  ck("#104 ...and one row's tap leaves the other's throw on record",
     X.recoverWeaponAmmo('d2', false) === 1 && t.inventory.find(i => i.id === 'd2').qty === 1 && X.ammoSpentEntry(t, 'd1').n === 2 &&
     t.inventory[0].qty === 0, t.ammoSpent);
}

/* ---- firing, Undo, recovery and the +N (#6) ---- */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const mk = () => {
    const c = X.blankChar();
    c.inventory = [{id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8', damageType: 'piercing', ability: 'dex'}},
                   {id: 's1', name: 'Arrow', qty: 2, ammo: {kind: 'arrow'}},
                   {id: 's2', name: '+1 Arrow', qty: 1, ammo: {kind: 'arrow', bonus: 1}}];
    return c;
  };
  let c = mk(); const bow = c.inventory[0];
  let r = X.fireAmmo(c, bow);
  ck('a shot spends one from the loaded stack', !!r && c.inventory[1].qty === 1 && r.left === 1 && !r.removed);
  ck('...and counts it, with a copy of the stack', X.ammoSpentEntry(c, 's1').n === 1 && X.ammoSpentEntry(c, 's1').snap.name === 'Arrow');
  r = X.fireAmmo(c, bow);
  ck('the last piece removes the stack', r.removed && !c.inventory.some(i => i.id === 's1') && X.ammoSpentEntry(c, 's1').n === 2);
  ck('the weapon then loads the next stack of its kind', X.loadedStack(c, bow).id === 's2');
  ck('Undo puts the removed stack back where it was, one piece, and the count as it was',
     X.undoFire(c, r) && c.inventory[1].id === 's1' && c.inventory[1].qty === 1 && X.ammoSpentEntry(c, 's1').n === 1);
  ck('nothing loaded, nothing fired', X.fireAmmo({inventory: [bow]}, bow) === null);
  const empty = {inventory: [bow, {id: 'z', name: 'Arrow', qty: 0, ammo: {kind: 'arrow'}}, {id: 'y', name: 'Arrow', qty: 2, ammo: {kind: 'arrow'}}]};
  ck('a stack at ×0 is never loaded: the weapon loads the next', X.loadedStack(empty, bow).id === 'y' &&
     X.ammoStacks(empty, 'arrow').map(s => s.id).join() === 'y');
  ck('...and with only an empty stack, nothing is fired', X.fireAmmo({inventory: [bow, {id: 'z', name: 'Arrow', qty: 0, ammo: {kind: 'arrow'}}]}, bow) === null);
  c = mk(); const b2 = c.inventory[0];
  r = X.fireAmmo(c, b2);
  ck('Undo of a shot that left some puts the one piece back and forgets the shot',
     X.undoFire(c, r) && c.inventory[1].qty === 2 && !('s1' in c.ammoSpent));
  ck('the same Undo twice puts back one piece, not two', X.undoFire(c, r) === false && c.inventory[1].qty === 2);
  r = X.fireAmmo(c, b2); c.inventory = c.inventory.filter(i => i.id !== 's1');
  ck('Undo after the player deleted that stack leaves it deleted', !X.undoFire(c, r) && !c.inventory.some(i => i.id === 's1'));
  ck('junk spent entries read as nothing',
     same(X.ammoSpentEntry({ammoSpent: {x: 'junk'}}, 'x'), {n: 0, hits: 0, misses: 0, kind: '', snap: null}) &&
     X.ammoRecoverable({ammoSpent: {a: {n: 'x', kind: 7}, b: null, c: [1], d: {n: 4, kind: ''}}}).length === 0 &&
     X.ammoRecoverable({ammoSpent: 'junk'}).length === 0);

  c = mk(); const b3 = c.inventory[0];
  b3.ammoStack = 's1'; X.fireAmmo(c, b3); X.fireAmmo(c, b3);
  b3.ammoStack = 's2'; X.fireAmmo(c, b3);
  ck('what recovery would give: half of each stack, rounded down per stack', same(X.ammoRecoverable(c), [{kind: 'arrow', fired: 3, back: 1}]), X.ammoRecoverable(c));
  ck('...in words', X.ammoSummaryText(X.ammoRecoverable(c)) === '1 of 3 arrows');
  ck('recovering gives back 1', X.recoverAmmo(c, ['arrow']) === 1);
  ck('...rebuilding the used-up stack from its copy, with its old id', c.inventory.some(i => i.id === 's1' && i.qty === 1 && i.name === 'Arrow'));
  ck('...and clears every count of that kind, the lost half included', same(c.ammoSpent, {}));

  /* #6 final review, item 4: when the old stack's id is gone, recovery joins
     an equivalent one already on the sheet rather than making a second
     identical row, and repoints anything that had it loaded. */
  {
    const c4 = mk(); const bow4 = c4.inventory[0];
    c4.inventory.find(i => i.id === 's2').qty = 2;   // a two-piece stack, so half comes back as 1
    bow4.ammoStack = 's2';
    X.fireAmmo(c4, bow4); X.fireAmmo(c4, bow4);
    ck('the last +1 Arrow is gone, with two shots recorded', !c4.inventory.some(i => i.id === 's2') && X.ammoSpentEntry(c4, 's2').n === 2);
    c4.inventory.push({id: 's9', name: '+1 Arrow', qty: 3, ammo: {kind: 'arrow', bonus: 1}});
    const back4 = X.recoverAmmo(c4);
    ck('recovery joins the equivalent stack instead of making a duplicate',
       back4 === 1 && c4.inventory.filter(i => i.name === '+1 Arrow').length === 1 &&
       c4.inventory.find(i => i.id === 's9').qty === 4, c4.inventory);
    ck("...and repoints the weapon's loaded stack to the survivor", bow4.ammoStack === 's9');
  }

  c = mk(); c.ammoSpent = {s1: {n: 13, kind: 'arrow'}, s9: {n: 4, kind: 'bolt'}};
  ck('several kinds are summed and listed', X.ammoSummaryText(X.ammoRecoverable(c)) === '6 of 13 arrows, 2 of 4 bolts');
  ck('recovering one kind leaves the other', X.recoverAmmo(c, ['arrow']) === 6 && 's9' in c.ammoSpent && c.inventory.find(i => i.id === 's1').qty === 8);
  ck('a stack that is gone with no copy gives nothing back, and its count clears', X.recoverAmmo(c) === 0 && same(c.ammoSpent, {}));
  ck('forgetting a deleted stack drops its count', (() => { const k = {ammoSpent: {s1: {n: 2, kind: 'arrow'}}}; X.forgetAmmo(k, 's1'); return same(k.ammoSpent, {}); })());

  const ch = mk(); ch.abilities.dex = 14; X.character = ch;
  const atk = {id: 'a1', name: 'Longbow', kind: 'ranged', ability: 'dex', proficient: false, damageDice: '1d8', itemId: 'w1', addAbilityDamage: true};
  const base = X.attackNumbers(atk);
  ch.inventory[0].ammoStack = 's2';
  const plus = X.attackNumbers(atk);
  ck('a loaded +1 arrow adds 1 to hit and to damage', plus.toHit === base.toHit + 1 && plus.dmgBonus === base.dmgBonus + 1 &&
     plus.ammoBonus === 1 && plus.ammoName === '+1 Arrow', [base, plus]);
  ck('a row with no item gets nothing from ammunition', X.attackNumbers(Object.assign({}, atk, {itemId: undefined})).ammoBonus === 0);
}

/* ---- the attack row's ammunition line (#6) ---- */
{
  const c = X.blankChar();
  c.inventory = [{id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
                 {id: 'd1', name: 'Dagger', qty: 1, equipped: true, weapon: {kind: 'melee', dice: '1d4'}},
                 {id: 's1', name: 'Arrow', qty: 19, ammo: {kind: 'arrow'}}];
  const bowRow = {id: 'a1', name: 'Longbow', itemId: 'w1'}, dagRow = {id: 'a2', name: 'Dagger', itemId: 'd1'};
  let h = X.ammoLineHTML(c, bowRow);
  ck('a launcher row shows its loaded stack and Fire', /Arrow ×19/.test(h) && /data-ammo-fire="w1"/.test(h) && !/disabled/.test(h), h);
  ck('...as plain text while there is one stack to load', !/data-ammo-pick/.test(h));
  ck('...and no Recover while nothing would come back', !/data-ammo-recover/.test(h));
  ck('a weapon that fires nothing has no ammunition line', X.ammoLineHTML(c, dagRow) === '' && X.ammoLineHTML(c, {id: 'x'}) === '');
  c.inventory.push({id: 's2', name: '+1 Arrow', qty: 4, ammo: {kind: 'arrow', bonus: 1}});
  h = X.ammoLineHTML(c, bowRow);
  ck('with two stacks, the label opens the picker', /data-ammo-pick="w1"/.test(h), h);
  c.ammoSpent = {s1: {n: 13, kind: 'arrow'}, s2: {n: 4, kind: 'arrow'}};
  h = X.ammoLineHTML(c, bowRow);
  ck('Recover shows what would come back: 6 + 2', /data-ammo-recover="w1"/.test(h) && />Recover 8</.test(h), h);
  c.inventory = c.inventory.filter(i => !i.ammo);
  h = X.ammoLineHTML(c, bowRow);
  ck('with no arrows left it says so, and Fire is disabled', /No arrows/.test(h) && /data-ammo-fire="w1" disabled/.test(h), h);
}

/* ---- the stack picker's row shows the +N (#6 final review, item 5) ---- */
{
  const magic = X.ammoChoiceHTML({id: 's', name: 'Elven Arrow', qty: 4, ammo: {kind: 'arrow', bonus: 1}}, null);
  ck('a magic stack reads ×4 · +1', /×4 · \+1/.test(magic) && /data-ammo-load="s"/.test(magic), magic);
  const neg = X.ammoChoiceHTML({id: 's2', name: 'Arrow of Weakness', qty: 2, ammo: {kind: 'arrow', bonus: -1}}, null);
  ck('...and a negative bonus reads as -N, not +-1', /×2 · -1/.test(neg), neg);
  const mundane = X.ammoChoiceHTML({id: 'm', name: 'Arrow', qty: 4, ammo: {kind: 'arrow'}}, null);
  ck('a mundane stack is just the count, no ·', /×4/.test(mundane) && !/·/.test(mundane), mundane);
  const stack = {id: 's', name: 'Elven Arrow', qty: 4, ammo: {kind: 'arrow', bonus: 1}};
  const on = X.ammoChoiceHTML(stack, stack);
  ck('the loaded stack is marked on and pressed', /class="ammo-choice on"/.test(on) && /aria-pressed="true"/.test(on), on);
  ck('a different stack is neither', !/ on"/.test(mundane) && /aria-pressed="false"/.test(mundane), mundane);
}

/* ---- Fire, Undo, loading and Recover, through the sheet's own handlers (#6) ---- */
{
  const c = X.blankChar(); X.character = c;
  c.inventory = [{id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
                 {id: 's1', name: 'Arrow', qty: 2, ammo: {kind: 'arrow'}},
                 {id: 's2', name: '+1 Arrow', qty: 1, ammo: {kind: 'arrow', bonus: 1}}];
  const r = X.fireWeapon('w1', false);
  ck('Fire spends one and returns the shot', !!r && c.inventory[1].qty === 1);
  ck('an Undo shown for another character does nothing', X.undoFireTap(r, X.blankChar(), false, 'w1') === false && c.inventory[1].qty === 1);
  ck("this character's Undo puts it back", X.undoFireTap(r, c, false, 'w1') === true && c.inventory[1].qty === 2);
  ck('loading a stack remembers it, outside weapon',
     X.loadAmmo('w1', 's2') && c.inventory[0].ammoStack === 's2' && !('ammoStack' in c.inventory[0].weapon));
  ck('loading a stack that is not there changes nothing', !X.loadAmmo('w1', 'nope') && c.inventory[0].ammoStack === 's2');
  X.fireWeapon('w1', false);
  ck('the next shot comes from it, and its last piece removes it', !c.inventory.some(i => i.id === 's2'));
  X.fireWeapon('w1', false); X.fireWeapon('w1', false);
  ck('...then the weapon fires the plain arrows until they are gone too', !c.inventory.some(i => i.ammo));
  ck('nothing left: Fire does nothing', X.fireWeapon('w1', false) === null);
  ck('Recover gives back 1 of the 3 fired (half of each stack, rounded down), into the old stack',
     X.recoverWeaponAmmo('w1', false) === 1 && c.inventory.filter(i => i.ammo).map(i => i.id + '×' + i.qty).join() === 's1×1');
  ck('...and clears the counts', JSON.stringify(c.ammoSpent) === '{}');

  const g = X.blankChar(); X.character = g;
  g.inventory = [{id: 'g1', name: 'Arrow', qty: 3, ammo: {kind: 'arrow'}, grant: 'class:Ranger'}];
  g.ammoSpent = {g1: {n: 4, kind: 'arrow', snap: {id: 'g1', name: 'Arrow', qty: 1, grant: 'class:Ranger'}}};
  X.revertEquipmentGrants('class:Ranger');
  ck('removing the class that granted a stack forgets its spent count, so Recover cannot bring it back',
     !g.inventory.length && !('g1' in g.ammoSpent));

  /* #6 final review, item 2: a granted stack fired down to NOTHING is already
     removed by the time the class is removed, so the old id-based forgetAmmo()
     in revertEquipmentGrants() never reaches it — only forgetGrantAmmo(), by
     the snapshot's own `grant`, does. */
  const g2 = X.blankChar(); X.character = g2;
  g2.inventory = [{id: 'w2', name: 'Shortbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d6'}},
                  {id: 'g2', name: 'Arrow', qty: 2, ammo: {kind: 'arrow'}, grant: 'class:Ranger'}];
  X.fireWeapon('w2', false); X.fireWeapon('w2', false);
  ck('firing a granted stack down to nothing still counts the shots, and the stack is gone',
     g2.ammoSpent.g2 && g2.ammoSpent.g2.n === 2 && !g2.inventory.some(i => i.id === 'g2'));
  X.revertEquipmentGrants('class:Ranger');
  ck('removing the class also forgets a granted stack already fired to nothing',
     !('g2' in g2.ammoSpent) && X.ammoRecoverable(g2).length === 0 && X.recoverAmmo(g2) === 0 &&
     !g2.inventory.some(i => i.name === 'Arrow'), g2.ammoSpent);
}

/* ---- End combat recovers on its own, with an Undo (#104, spec §6) ---- */
{
  const mk = () => {
    const c = X.blankChar(); X.character = c;
    c.inventory = [{id: 's1', name: 'Arrow', qty: 7, ammo: {kind: 'arrow'}}];
    c.ammoSpent = {s1: {n: 13, kind: 'arrow'},
                   s2: {n: 4, kind: 'bolt', snap: {id: 's2', name: 'Bolt', qty: 1, ammo: {kind: 'bolt'}}},
                   s3: {n: 1, kind: 'needle'}};
    X.startCombatNow();
    return c;
  };
  let c = mk(); state.confirm = true; state.lastConfirm = null;
  ck('#104 End combat asks only about ending, then recovers half of each kind',
     X.endCombatAsk() === true && state.lastConfirm === 'End combat at round 1?' &&
     c.inventory.find(i => i.id === 's1').qty === 13 && (c.inventory.find(i => i.id === 's2') || {}).qty === 2, [state.lastConfirm, c.inventory]);
  ck('#104 ...and the lone needle, which gives nothing back, is spent: cleared', JSON.stringify(c.ammoSpent) === '{}', c.ammoSpent);
  c = mk(); const rec = {}; X.recoverAmmo(c, ['arrow', 'bolt'], rec);
  ck("#104 the toast's Undo recovery puts it all back",
     ctx.undoRecoveryTap(rec, c) === true && c.inventory.find(i => i.id === 's1').qty === 7 && !c.inventory.some(i => i.id === 's2') && c.ammoSpent.s1.n === 13);
  ck('#104 ...but not on another sheet',
     (() => { const k = mk(), r = {}; X.recoverAmmo(k, ['arrow'], r); X.character = X.blankChar(); return ctx.undoRecoveryTap(r, k) === false && k.inventory[0].qty === 13; })());
  c = mk(); c.ammoRecovery = 'none';
  {
    const realToast = ctx.toast; let offer = 'none yet', said = '';
    ctx.toast = (msg, action) => { said = msg; offer = action; return null; };
    ck('#104 with nothing recoverable, End combat recovers nothing and clears the counts',
       X.endCombatAsk() === true && c.inventory[0].qty === 7 && JSON.stringify(c.ammoSpent) === '{}', c.ammoSpent);
    ck('#104 ...quietly: no recovery in the toast, and no Undo recovery', !/recovered/.test(said) && offer === undefined, [said, offer]);
    ctx.toast = realToast;
  }
  ck('#104 applyAmmoRecovery says nothing when there is nothing', (() => { X.character = X.blankChar(); return ctx.applyAmmoRecovery() === null; })());
  ck('#104 ...and, with only counts that give nothing back, clears them and still says nothing',
     (() => { const k = mk(); k.ammoRecovery = 'none'; return ctx.applyAmmoRecovery() === null && JSON.stringify(k.ammoSpent) === '{}'; })());
  /* final review item 1: under None (or Never) the counts used to pile up fight
     after fight and come back in full once the rule changed. */
  {
    const k = X.blankChar(); X.character = k; k.ammoRecovery = 'none';
    k.inventory = [{id: 'w1', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
                   {id: 's1', name: 'Arrow', qty: 40, ammo: {kind: 'arrow'}}];
    for (let f = 0; f < 3; f++) { X.startCombatNow(); for (let i = 0; i < 10; i++) X.fireWeapon('w1', false); X.endCombatAsk(); }
    ck('#104 three fights under None: 30 arrows spent, nothing left on record',
       k.inventory[1].qty === 10 && JSON.stringify(k.ammoSpent) === '{}', [k.inventory[1].qty, k.ammoSpent]);
    k.ammoRecovery = 'all';
    ck('#104 ...so switching to All afterwards recovers nothing from those fights',
       X.ammoRecoverable(k).length === 0 && ctx.applyAmmoRecovery() === null && k.inventory[1].qty === 10);
  }
  /* ...and Undo recovery restores every entry that End combat cleared, the
     ones that gave nothing back included */
  {
    const k = mk(); let offer = null;
    const realToast = ctx.toast; ctx.toast = (msg, action) => { if (action) offer = action; return null; };
    X.endCombatAsk();
    ctx.toast = realToast;
    ck('#104 End combat that recovered something offers Undo recovery, which clears the needle too',
       !!offer && offer.label === 'Undo recovery' && JSON.stringify(k.ammoSpent) === '{}', offer);
    ck('#104 ...and Undo recovery brings the needle back with the rest',
       !!offer && offer.run() === true && k.ammoSpent.s3 && k.ammoSpent.s3.n === 1 && k.ammoSpent.s1.n === 13 && k.ammoSpent.s2.n === 4 &&
       k.inventory.find(i => i.id === 's1').qty === 7, k.ammoSpent);
  }
  ck('#104 a spent entry no longer carries asked', !('asked' in X.ammoSpentEntry({ammoSpent: {a: {n: 2, kind: 'arrow', asked: 1}}}, 'a')));
}

/* ---- the item editor's kind lists (#8) ---- */
{
  const c = {inventory: [{name: 'Pellet Bow', weapon: {ammo: 'Dart Pellet'}}, {name: 'Stone', ammo: {kind: 'stone'}}, {name: 'Arrow', ammo: {kind: 'arrow'}}]};
  ck('the kinds: the five 2024 ones, then those this sheet uses, then what the form opened with',
     X.ammoKindChoices(c, ['Zap', '']).join() === 'arrow,bolt,firearm bullet,needle,sling bullet,dart pellet,stone,zap');
  const h = X.ammoKindOptionsHTML(['arrow', 'bolt'], 'Bolt', 'None');
  ck('the options: None, each kind (the chosen one selected), then Other…',
     /^<option value="">None<\/option>/.test(h) && /<option value="bolt" selected>Bolt<\/option>/.test(h) && /<option value="__other">Other…<\/option>$/.test(h), h);
  ck('no None when the list has no label for it', !/value=""/.test(X.ammoKindOptionsHTML(['arrow'], 'arrow', '')));
  // #104: the Recovery select
  const sel = h2 => (h2.match(/<option value="([a-z]*)" selected>/) || [])[1];
  const ro = X.recoverOptionsHTML({ammo: {kind: 'firearm bullet'}});
  ck('#104 Recovery offers the default, Always and Never, naming the default when there is one',
     /<option value="" selected>Default \(never comes back\)<\/option><option value="always">Always comes back<\/option><option value="never">Never comes back<\/option>/.test(ro), ro);
  ck("#104 ...a thrown weapon's default is always", X.recoverOptionsHTML({weapon: {notes: 'Thrown'}}).includes('>Default (always comes back)<'));
  ck("#104 ...an arrow's is the sheet's rule (the apostrophe escaped, as esc() writes it)", X.recoverOptionsHTML({ammo: {kind: 'arrow'}}).includes('>Sheet&#39;s rule<'));
  ck("#104 ...and the item's own choice is selected", sel(X.recoverOptionsHTML({ammo: {kind: 'arrow'}, recover: 'never'})) === 'never' && sel(X.recoverOptionsHTML({recover: 'junk'})) === '');
}

/* ---- #99: the pickers' filters and previews, shared with the Rules tab ---- */
{
  const savedRules = X.rules, savedChar = X.character, savedOB = ctx.openBrowse, savedOM = ctx.openModal;
  let cfg = null, modal = null;
  ctx.openBrowse = c => { cfg = c; };
  ctx.openModal = (title, html) => { modal = {title, html}; };
  const items = [{_id: 'i1', name: 'Rope', category: 'Gear', cost: '1 gp', _source: 'SRD'},
    {_id: 'i2', name: 'Wand', category: 'Wondrous Item', rarity: 'Rare', attune: true, description: 'Zap.', _source: 'SRD'},
    {_id: 'i3', name: 'Ring', rarity: 'Uncommon', _source: 'SRD'}];
  const spells = [{_id: 's1', name: 'Fire Bolt', level: 0, meta: 'Evocation · Action · 120 feet', class: ['Wizard', 'Sorcerer'], _source: 'SRD'},
    {_id: 's2', name: 'Bless', level: 1, meta: 'Enchantment · Action · 30 feet · Concentration, up to 1 minute', class: 'Cleric', _source: 'SRD'},
    {_id: 's3', name: 'Loose', level: 2, meta: '', _source: 'SRD'}];
  const feats = [{_id: 'f1', name: 'Alert', description: 'Origin feat\nYou are alert.', _source: 'SRD'},
    {_id: 'f2', name: 'Grappler', description: 'General feat · Prerequisite: Level 4+, Strength 13+\nGrab.', _source: 'XPHB'}];
  const traits = [{_id: 't1', name: 'Darkvision', source: 'Elf', description: 'See.', _source: 'SRD'}];
  X.rules = {name: 'T', keywords: [], features: traits, items, spells, races: [], classes: [], feats,
             backgrounds: [], subclasses: [], tables: []};
  ctx.recomputeDups();
  X.character = X.blankChar();
  X.character.classes = [{name: 'Cleric', level: 1}];
  const shape = fs => JSON.stringify(fs.map(f => [f.key, f.label, f.type, f.options || null, f.default || null]));

  const fi = X.itemFacets(items);
  ck('#99 itemFacets: category, rarity, attunement', shape(fi) === JSON.stringify([
    ['cat', 'Category', 'multi', [{value: 'gear', label: 'Gear'}, {value: 'wondrous item', label: 'Wondrous Item'}], null],
    ['rar', 'Rarity', 'multi', [{value: 'mundane', label: 'Mundane'}, {value: 'uncommon', label: 'Uncommon'}, {value: 'rare', label: 'Rare'}], null],
    ['attune', 'Needs attunement', 'toggle', null, null]]), shape(fi));
  ck('#99 an item with no category is Gear, with no rarity Mundane',
     X.itemCatOf(items[2]) === 'Gear' && X.itemRarOf(items[0]) === 'Mundane' && X.itemCatOf(null) === 'Gear');
  ck('#99 the item facets match as the picker did',
     fi[0].match(items[2], new Set(['gear'])) && !fi[0].match(items[1], new Set(['gear'])) && fi[2].match(items[1]) && !fi[2].match(items[0]));
  ctx.browseItems();
  ck('#99 the item picker uses itemFacets', !!cfg && shape(cfg.facets) === shape(fi));
  modal = null; cfg.preview(items[1]); const viaPicker = modal;
  modal = null; X.openItemInfo(items[1]);
  ck('#99 openItemInfo is the picker\'s preview', !!modal && !!viaPicker && modal.title === 'Wand' &&
     modal.html === viaPicker.html && modal.html.includes('Zap.') && modal.html.includes(ctx.esc(ctx.itemMetaLine(items[1]))));

  const fs = X.spellFacets(spells), fsAll = X.spellFacets(spells, {classDefault: 'all'});
  ck('#99 spellFacets: level, class, school, concentration', JSON.stringify(fs.map(f => f.key)) === '["level","class","school","conc"]');
  ck('#99 the class filter starts on this character\'s classes in the picker',
     JSON.stringify(fs[1].default) === '["cleric"]');
  ck('#99 ...and on every class for a lookup', JSON.stringify(fsAll[1].default) === '[]');
  ck('#99 schools come from the first part of meta',
     JSON.stringify(fs[2].options.map(o => o.value)) === '["enchantment","evocation"]' && X.spellSchoolOf(spells[0]) === 'Evocation');
  ck('#99 a spell with no class passes any class filter, a string class is one class',
     fs[1].match(spells[2], new Set(['wizard'])) && fs[1].match(spells[1], new Set(['cleric'])) &&
     JSON.stringify(X.spellClassesOf(spells[1])) === '["Cleric"]' && JSON.stringify(X.spellClassesOf(null)) === '[]');
  ck('#99 concentration reads meta', fs[3].match(spells[1]) && !fs[3].match(spells[0]));
  cfg = null; ctx.browseSpells();
  ck('#99 the spell picker uses spellFacets', !!cfg && shape(cfg.facets) === shape(fs));

  const list = X.featPickList(), ff = X.featFacets(list);
  ck('#99 featFacets: type, pack (two packs), no prerequisite', JSON.stringify(ff.map(f => f.key)) === '["kind","pack","noreq"]');
  ck('#99 feat types are the ones present', JSON.stringify(ff[0].options.map(o => o.label)) === '["Origin feat","General feat","Trait"]');
  ck('#99 one pack, no Pack filter', JSON.stringify(X.featFacets(list.filter(w => w.e._source === 'SRD')).map(f => f.key)) === '["kind","noreq"]');
  ck('#99 no prerequisite reads the first line', ff[2].match(list[0]) && !ff[2].match(list[1]));
  cfg = null; ctx.browseFeatures();
  ck('#99 the feat picker uses featFacets', !!cfg && shape(cfg.facets) === shape(ff));
  modal = null; cfg.preview(list[1]); const featPicker = modal;
  modal = null; X.openFeatInfo(list[1]);
  ck('#99 openFeatInfo is the picker\'s preview', !!modal && !!featPicker && modal.title === 'Grappler' &&
     modal.html === featPicker.html && modal.html.includes('General feat · XPHB'));
  modal = null; X.openFeatInfo(list[2]);
  ck('#99 a trait reads its own source', !!modal && modal.html.includes('Elf · SRD'));
  modal = null; X.openFeatInfo(null); X.openItemInfo(null);
  ck('#99 nothing to show opens nothing', modal === null);

  ctx.openBrowse = savedOB; ctx.openModal = savedOM; X.rules = savedRules; X.character = savedChar;
}

/* ---- #99: the windows open by id, titled by name, and in reference mode ---- */
{
  const savedRules = X.rules, savedChar = X.character, savedOM = ctx.openModal;
  let modal = null;
  ctx.openModal = (title, html) => { modal = {title, html}; };
  const open = fn => { modal = null; fn(); return modal || {title: '', html: ''}; };
  X.rules = {name: 'T', keywords: [], features: [], items: [], spells: [], feats: [], tables: [], subclasses: [],
    classes: [{_id: 'c1', name: 'Fighter', description: 'First edition.', hitDie: 'd10', _source: 'SRD',
               levels: {'1': {traits: [{name: 'Second Wind'}]}, '3': {traits: [{name: 'Subclass'}]}},
               subclasses: {Champion: {description: 'Crits.', levels: {'3': {traits: [{name: 'Improved Critical'}]}}}}},
              {_id: 'c2', name: 'Fighter', description: 'Second edition.', hitDie: 'd10', _source: 'XPHB'}],
    races: [{_id: 'r1', name: 'Elf', description: 'Old elf.', speed: '30 ft', _source: 'SRD', subraces: [{name: 'High Elf'}]},
            {_id: 'r2', name: 'Elf', description: 'New elf.', speed: '35 ft', _source: 'XPHB', subraces: [{name: 'High Elf'}]}],
    backgrounds: [{_id: 'b1', name: 'Acolyte', description: 'Temple.', feat: 'Magic Initiate', abilityScores: ['int', 'wis', 'cha'], _source: 'SRD'}]};
  ctx.recomputeDups();
  X.character = X.blankChar();
  Object.assign(X.character, {classes: [{name: 'Fighter', level: 3, subclass: 'Champion'}],
    race: {name: 'Elf', subrace: 'High Elf'}, bg: {name: 'Acolyte', feat: 'Magic Initiate', abils: [{target: 'abilities.wis', value: 2}]}});

  const sheetCls = open(() => ctx.openClassInfo('Fighter'));
  ck('#99 from the sheet, the class window is unchanged', sheetCls.title === 'Fighter 3' &&
     sheetCls.html.includes('Level 3 — current') && sheetCls.html.includes('data-sub-info="Fighter|Champion"') && sheetCls.html.includes('data-change-sub'));
  const refCls = open(() => ctx.openClassInfo('c1', {ref: true}));
  ck('#99 by id, titled by its name', refCls.title === 'Fighter');
  ck('#99 reference mode shows nothing of the character',
     !refCls.html.includes('— current') && !refCls.html.includes('data-change-sub') && !refCls.html.includes('data-choose-sub'));
  ck('#99 ...and lists its subclasses as links that stay in reference mode',
     refCls.html.includes('data-sub-info="c1|Champion"') && refCls.html.includes('data-sub-ref="1"'));
  ck('#99 two packs\' Fighters open their own entries',
     refCls.html.includes('First edition.') && open(() => ctx.openClassInfo('c2', {ref: true})).html.includes('Second edition.'));

  ck('#99 from the sheet, the subclass window marks what was gained',
     open(() => ctx.openSubclassInfo('Fighter', 'Champion')).html.includes('Level 3 — gained'));
  const refSub = open(() => ctx.openSubclassInfo('c1', 'Champion', {ref: true}));
  ck('#99 a subclass in reference mode: no gained marks, the class named, not its id',
     refSub.title === 'Champion' && !refSub.html.includes('— gained') && refSub.html.includes('Fighter subclass') && !refSub.html.includes('c1 subclass'));

  ck('#99 from the sheet, the species window marks the chosen lineage',
     open(() => ctx.openRaceInfo('Elf')).html.includes('High Elf — selected'));
  const refRace = open(() => ctx.openRaceInfo('r2', {ref: true}));
  ck('#99 a species by id, in reference mode', refRace.title === 'Elf' && refRace.html.includes('New elf.') &&
     refRace.html.includes('35 ft') && !refRace.html.includes('— selected'));

  ck('#99 from the sheet, the background window shows your choices',
     open(() => ctx.openBackgroundInfo('Acolyte')).html.includes('Your choices'));
  const refBg = open(() => ctx.openBackgroundInfo('b1', {ref: true}));
  ck('#99 a background in reference mode shows its options, not your choices',
     refBg.title === 'Acolyte' && refBg.html.includes('Magic Initiate') && !refBg.html.includes('Your choices'));

  ck('#99 an unknown name still says so', open(() => ctx.openClassInfo('Nobody', {ref: true})).html.includes('No rules data loaded'));

  ctx.openModal = savedOM; X.rules = savedRules; X.character = savedChar;
}

/* ---- #103: chips, advancement and default languages (spec §3, §4, §4a) ---- */
{
  const savedRules = X.rules;
  const b = X.blankChar();
  ck('#103 new lists start empty', ['resists', 'immunes', 'senses', 'languages'].every(k => Array.isArray(b[k]) && b[k].length === 0));
  ck('#103 a new character advances by XP', b.advancement === 'xp' && X.advancementOf(b) === 'xp');
  ck('#103 advancement junk reads as xp', ['milestone', 'Milestone', 'lots', null, 7].map(v => X.advancementOf({advancement: v})).join() === 'milestone,xp,xp,xp,xp');
  const dirty = [{id: 'a', name: ' Fire '}, {name: 'fire'}, {name: ''}, 'Cold', null, [], {name: 5}, {id: 'c', name: 'Cold'}];
  const clean = X.chipClean(dirty, 'resists', false);
  ck('#103 chips: trimmed, deduped case-blind, junk dropped', JSON.stringify(clean.map(c => c.name)) === '["Fire","Cold"]', clean);
  ck('#103 a read never invents an id', clean[0].id === 'a' && X.chipClean([{name: 'X'}], 'resists', false)[0].id === '');
  ck('#103 migrate mints ids', typeof X.chipClean([{name: 'X'}], 'resists', true)[0].id === 'string' && X.chipClean([{name: 'X'}], 'resists', true)[0].id.length > 0);
  const sen = X.chipClean([{name: 'Darkvision', range: 60}, {name: 'Tremorsense', range: '30'}, {name: 'Blindsight', range: -5}, {name: 'Truesight', range: 'far'}], 'senses', false);
  ck('#103 a sense range is a whole number of feet or blank', JSON.stringify(sen.map(s => s.range)) === '[60,30,"",""]', sen);
  ck('#103 only languages keep a source', X.chipClean([{name: 'Common', src: 'system'}], 'languages', false)[0].src === 'system' &&
     !('src' in X.chipClean([{name: 'Fire', src: 'race:Elf'}], 'resists', false)[0]) && X.chipClean([{name: 'Elvish'}], 'languages', false)[0].src === '');
  ck('#103 chipList reads through the guard', X.chipList({resists: 'nope'}, 'resists').length === 0 && X.chipList(null, 'senses').length === 0);

  ck('#103 the SRD table: 20 levels from 0', X.SRD_ADVANCEMENT.length === 20 && X.SRD_ADVANCEMENT[0][0] === 0 && X.SRD_ADVANCEMENT[19][0] === 355000 && X.SRD_ADVANCEMENT[15][0] === 195000);
  X.rules = {name: 'T', advancement: Object.create(null), defaultLanguages: Object.create(null)};
  ck('#103 no declaration: the SRD table and Common', X.advancementFor({system: 'dnd'}) === X.SRD_ADVANCEMENT && JSON.stringify(X.defaultLanguagesFor({system: 'dnd'})) === '["Common"]');
  X.rules.advancement.humblewood = [[0, 1], [100, 2], [400, 3]];
  X.rules.defaultLanguages.humblewood = ['Common', 'Birdsong', '', 7];
  ck('#103 a ruleset that declares its own', X.advancementFor({system: 'humblewood'})[1][0] === 100 &&
     JSON.stringify(X.defaultLanguagesFor({system: 'humblewood'})) === '["Common","Birdsong"]');
  ck('#103 ...used only by its own ruleset', X.advancementFor({system: 'dnd'}) === X.SRD_ADVANCEMENT);
  X.rules.advancement.humblewood = [[0, 1], [500, 2], [400, 3]];
  ck('#103 a malformed table falls back', X.advancementFor({system: 'humblewood'}) === X.SRD_ADVANCEMENT);
  X.rules.advancement.humblewood = [[0, 2]];
  ck('#103 a table must start at level 1, xp 0', X.advancementFor({system: 'humblewood'}) === X.SRD_ADVANCEMENT);
  X.rules = savedRules;

  ck('#103 XP reads numbers and digit strings', X.xpNumber(183000) === 183000 && X.xpNumber('183,000') === 183000 && X.xpNumber(' 42 ') === 42 &&
     X.xpNumber('') === null && X.xpNumber('lots') === null && X.xpNumber(-5) === null && X.xpNumber('1.5') === null);
  const lvl = (n, xp) => ({system: 'dnd', xp, classes: [{name: 'Cleric', level: n}]});
  const p = X.xpProgress(lvl(15, '183,000'));
  ck('#103 progress toward the next level', p && p.xp === 183000 && p.level === 15 && p.next === 195000 && p.ready === false, p);
  ck('#103 past the threshold: ready', X.xpProgress(lvl(15, 200000)).ready === true);
  ck('#103 level 20 has no next', X.xpProgress(lvl(20, 400000)).next === null && X.xpProgress(lvl(20, 400000)).ready === false);
  ck('#103 XP not a number: no progress', X.xpProgress(lvl(3, 'a lot')) === null);

  ck('#103 languages parse from a pack string', JSON.stringify(X.langParse('Common, Elvish and one other language of your choice')) === '["Common","Elvish"]' &&
     JSON.stringify(X.langParse('Common and Dwarvish')) === '["Common","Dwarvish"]' && JSON.stringify(X.langParse('Any two languages')) === '[]' &&
     JSON.stringify(X.langParse(7)) === '[]');
  const c = X.blankChar(); c.system = 'dnd'; c.languages = [{id: 'x', name: 'common', src: ''}];
  X.ensureDefaultLanguages(c);
  ck('#103 a default already present is not doubled', c.languages.length === 1);
  const c2 = X.blankChar(); c2.system = 'dnd';
  X.ensureDefaultLanguages(c2); X.ensureDefaultLanguages(c2);
  ck('#103 defaults are added once, stamped system', c2.languages.length === 1 && c2.languages[0].name === 'Common' && c2.languages[0].src === 'system');
}

/* ---- #103: an old sheet comes forward (spec §5, §7, §11) ---- */
{
  const old = () => ({abilities: {}, system: 'dnd',
    proficiencies: 'Light armor.\nLanguages: Common, Elvish, Draconic\nTools: Thieves\' tools',
    secNotes: {class: {text: 'Took Life domain.', at: 5, editedAt: 9}, origin: {text: 'From the north.', at: 3, editedAt: 4},
               rest: {text: 'Short rests at noon.', at: 7, editedAt: 8}, portrait: {text: 'Scar on cheek.', at: 6, editedAt: 6}},
    combatSections: ['vitals', 'rest', 'statuses'], familiars: [{id: 'f', name: 'Owl'}]});
  const m = X.migrate(old());
  ck('#103 class and origin notes merge into Character', m.secNotes.portrait.text ===
     'Scar on cheek.\n\n**Class:**\nTook Life domain.\n\n**Ancestry & Background:**\nFrom the north.', m.secNotes.portrait.text);
  ck('#103 ...keeping the earlier start and the later edit', m.secNotes.portrait.at === 3 && m.secNotes.portrait.editedAt === 9);
  ck('#103 the merged notes are gone', !('class' in m.secNotes) && !('origin' in m.secNotes) && !('rest' in m.secNotes));
  ck('#103 the rest note merges into Vitals, created when absent', m.secNotes.vitals.text === '**Rest & Recovery:**\nShort rests at noon.', m.secNotes.vitals);
  ck('#103 the Languages line becomes chips', JSON.stringify(X.chipList(m, 'languages').map(l => l.name)) === '["Common","Elvish","Draconic"]' &&
     X.chipList(m, 'languages').every(l => l.src === ''));
  ck('#103 ...and leaves the rest of the text', m.proficiencies === 'Light armor.\nTools: Thieves\' tools', JSON.stringify(m.proficiencies));
  ck('#103 a migrated Common is not doubled by the default', X.chipList(m, 'languages').filter(l => l.name.toLowerCase() === 'common').length === 1);
  ck('#103 rest in the combat view becomes vitals, once', JSON.stringify(m.combatSections) === '["vitals","statuses"]', m.combatSections);
  ck('#103 a character with a familiar shows the icon', m.showFamiliars === true && X.migrate({abilities: {}}).showFamiliars === false);
  ck('#103 a stored choice is kept', X.migrate({abilities: {}, familiars: [{id: 'f', name: 'Owl'}], showFamiliars: false}).showFamiliars === false);
  const twice = X.migrate(JSON.parse(JSON.stringify(m)));
  ck('#103 migrating twice changes nothing', JSON.stringify(twice) === JSON.stringify(m));
  ck('#103 a sheet from before gets Common', JSON.stringify(X.chipList(X.migrate({abilities: {}, system: 'dnd'}), 'languages').map(l => [l.name, l.src])) === '[["Common","system"]]');
  ck('#103 junk lists are emptied, advancement guarded', (() => { const j = X.migrate({abilities: {}, resists: 'x', senses: [null, {name: 'Darkvision', range: '60'}], advancement: 'lots'});
    return j.resists.length === 0 && j.senses[0].range === 60 && typeof j.senses[0].id === 'string' && j.senses[0].id && j.advancement === 'xp'; })());
  const lift = {proficiencies: 'languages: Gnomish\nLanguages:   \nOther'};
  X.liftLanguages(lift);
  ck('#103 the lift is case-blind and drops an empty line', JSON.stringify(X.chipList(lift, 'languages').map(l => l.name)) === '["Gnomish"]' && lift.proficiencies === 'Other', lift);
  const n = {secNotes: {}};
  X.mergeNoteInto(n, 'class', 'portrait', 'Class');
  ck('#103 nothing to merge: nothing changes', JSON.stringify(n.secNotes) === '{}');

  const n2 = {secNotes: {class: 'Took Life.'}};
  X.mergeNoteInto(n2, 'class', 'portrait', 'Class');
  ck('#103 a note stored as a bare string still merges', n2.secNotes.portrait.text === '**Class:**\nTook Life.' && !('class' in n2.secNotes), n2);
  const n3 = {secNotes: {class: [1]}};
  X.mergeNoteInto(n3, 'class', 'portrait', 'Class');
  ck('#103 junk under a removed key is dropped, not merged, never throws', !('portrait' in n3.secNotes) && !('class' in n3.secNotes), n3);

  ck('#103 langLifted is set once migrate has run', m.langLifted === true);
  const again = X.migrate(Object.assign(JSON.parse(JSON.stringify(m)), {proficiencies: m.proficiencies + '\nLanguages: Orcish'}));
  ck('#103 the lift runs once: a later "Languages:" line stays text, not chips', again.proficiencies.includes('Languages: Orcish') &&
     !X.chipList(again, 'languages').some(l => l.name === 'Orcish'), again.proficiencies);
  const kept = X.migrate({abilities: {}, system: 'dnd', langLifted: true, proficiencies: 'Languages: Gnomish'});
  ck('#103 a sheet already flagged keeps its Languages line too', kept.proficiencies === 'Languages: Gnomish' &&
     !X.chipList(kept, 'languages').some(l => l.name === 'Gnomish'), kept);
}

/* ---- #103: the header is not combat-addable (Task 7 review M3) ----
   The header is the `portrait` section. Its rest buttons stay out of the combat
   view (not a fight action), and the portrait image now rides in with Vitals,
   so a saved `portrait` in the view becomes `vitals`, as `rest` does. */
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const m1 = X.migrate({abilities: {}, combatSections: ['portrait', 'statuses']});
  ck('#103 a saved portrait in the combat view becomes vitals', same(m1.combatSections, ['vitals', 'statuses']), m1.combatSections);
  const m2 = X.migrate({abilities: {}, combatSections: ['vitals', 'portrait', 'rest', 'statuses']});
  ck('#103 ...once, beside a vitals (and a rest) already there', same(m2.combatSections, ['vitals', 'statuses']), m2.combatSections);
  ck('#103 ...and migrating again changes nothing', same(X.migrate(JSON.parse(JSON.stringify(m2))).combatSections, ['vitals', 'statuses']));
  // #91: the Party card joins the header as the only other nocv section
  ck('#103 the header and the Party card are not combat-addable; every other section is',
     !X.combatAddable('portrait') && X.combatAddable('vitals') && X.combatAddable('familiars') && !X.combatAddable('nope') &&
     X.NOTE_SECTIONS.filter(s => !X.combatAddable(s.k)).map(s => s.k).join() === 'portrait,party');
  ck('#103 a portrait that reaches the view unmigrated is dropped', same(X.combatSectionsOf({combatSections: ['portrait', 'vitals']}), ['vitals']));
  const c = X.blankChar(); X.character = c;
  X.toggleCombatSection('portrait');
  ck('#103 the toggle cannot add the header', same(c.combatSections, X.COMBAT_DEFAULTS), c.combatSections);

  // renderCombatToggles() against fake cards: one per registry key, each with a .label
  const doc = ctx.document, q = doc.querySelector, got = [];
  doc.querySelector = sel => {
    const mm = /^\.card\[data-note="([a-z]+)"\]$/.exec(sel); if (!mm) return null;
    const k = mm[1];
    const label = {querySelector: () => null, insertAdjacentHTML: (pos, html) => got.push([k, html])};
    return {querySelector: s => s === '.label' ? label : null};
  };
  try { X.renderCombatToggles(); } finally { doc.querySelector = q; }
  // #91: the Party card is nocv too, so two registry sections carry no toggle
  ck('#103 the header carries no combat toggle', !got.some(([k]) => k === 'portrait') && got.some(([k]) => k === 'vitals') &&
     got.length === X.NOTE_SECTIONS.length - 2, got.map(([k]) => k));
}

/* ---- #103: a jump to the familiars note with the paw hidden (Task 7 review M4) ----
   With showFamiliars off there is no paw, so the flyout hangs from the header's
   .sh-bar instead of opening with no position. */
{
  const doc = ctx.document, q = doc.querySelector;
  const keep = {openShFly: ctx.openShFly, selectTab: ctx.selectTab, scrollToCard: ctx.scrollToCard};
  const bar = {bar: true}, paw = {paw: true};
  let anchor = 'unset';
  ctx.openShFly = (kind, i, a) => { anchor = a; };
  ctx.selectTab = () => {}; ctx.scrollToCard = () => {};
  try {
    doc.querySelector = sel => sel === '[data-shpaw]' ? null : sel === '#sheetHead .sh-bar' ? bar : null;
    X.jumpToNote('familiars');
    ck('#103 with the paw hidden, the flyout anchors on the header bar', anchor === bar, anchor);
    doc.querySelector = sel => sel === '[data-shpaw]' ? paw : sel === '#sheetHead .sh-bar' ? bar : null;
    X.jumpToNote('familiars');
    ck('#103 ...and on the paw when it shows', anchor === paw, anchor);
  } finally { doc.querySelector = q; Object.assign(ctx, keep); }
}

/* ---- #103: no rules pack, no classes: + Class says where to load one (Task 7 review M5) ----
   The Class card's hint went with the card; it lives on in the Add class window. */
{
  const keep = ctx.openModal, keepRules = X.rules;
  let body = '';
  ctx.openModal = (t, h) => { body = h; };
  try {
    X.rules = Object.assign({}, keepRules, {classes: []});
    X.character = X.blankChar();
    X.openAddClass();
    ck('#103 with no classes loaded, Add class points to Settings → Extensions (#102)', body.includes(X.NO_RULES_HINT) &&
       /Settings → Extensions/.test(X.NO_RULES_HINT) && /<b>races<\/b> and <b>classes<\/b>/.test(X.NO_RULES_HINT), body);
    X.rules = Object.assign({}, keepRules, {classes: [{name: 'Cleric', hitDie: 'd8'}]});
    X.openAddClass();
    ck('#103 ...and says nothing of it when a pack has classes', !body.includes('Settings → Extensions') && body.includes('Cleric'), body);
  } finally { ctx.openModal = keep; X.rules = keepRules; }
}

/* ---- #103: a species or background grants languages as chips (spec §5) ---- */
{
  const c = {languages: [{id: 'p', name: 'Elvish', src: ''}, {id: 's', name: 'Common', src: 'system'}]};
  X.grantLanguages(c, 'race:Elf', 'Common, Elvish and Sylvan');
  ck('#103 a grant adds what is missing, stamped with its source', JSON.stringify(c.languages.map(l => [l.name, l.src])) ===
     '[["Elvish",""],["Common","system"],["Sylvan","race:Elf"]]', c.languages);
  X.grantLanguages(c, 'bg:Sage', 'Sylvan, Draconic');
  ck('#103 a second grant does not double one', c.languages.filter(l => l.name === 'Sylvan').length === 1 && c.languages.some(l => l.name === 'Draconic' && l.src === 'bg:Sage'));
  X.dropLanguages(c, 'race:Elf');
  ck('#103 removing the species takes only its own', JSON.stringify(c.languages.map(l => l.name)) === '["Elvish","Common","Draconic"]', c.languages);
  X.grantLanguages(c, 'race:Odd', 42);
  ck('#103 a pack field that is not text grants nothing', c.languages.length === 3);
}
/* the real paths: apply and remove a species with languages */
{
  const savedRules = X.rules, savedChar = X.character;
  X.rules = Object.assign({}, X.rules, {races: [{name: 'Elf', languages: 'Common and Elvish', _source: 'SRD 5.2'}]});
  ctx.recomputeDups();
  X.character = X.migrate({abilities: {}, system: 'dnd'});
  ck('#103 the species apply function exists', typeof ctx.applyRace === 'function');
  ctx.applyRace('Elf');
  ck('#103 picking a species grants its languages as chips', X.chipList(X.character, 'languages').some(l => l.name === 'Elvish' && l.src === 'race:Elf'));
  ck('#103 ...and writes no Languages line', !/Languages:/i.test(X.character.proficiencies || ''));
  ctx.removeRace(false);
  ck('#103 removing it takes them back', !X.chipList(X.character, 'languages').some(l => l.name === 'Elvish'));
  X.rules = savedRules; X.character = savedChar;
}

/* ---- #103: the chip component (spec §8) ---- */
{
  const c = {resists: [{id: 'r1', name: 'Fire'}], senses: [{id: 's1', name: 'Darkvision', range: 60}],
             languages: [{id: 'l1', name: 'Common', src: 'system'}, {id: 'l2', name: 'Elvish', src: 'race:Elf'}, {id: 'l3', name: 'Draconic', src: ''}]};
  const r = X.chipsHTML(c, 'resists');
  ck('#103 a chip, in capitals, with an × the pencil hides', r.includes('>FIRE<button type="button" class="chip-x ed" data-chipdel="resists" data-chipid="r1"'), r);
  ck('#103 + Add opens the chooser', r.includes('data-chipadd="resists"'));
  ck('#103 a sense shows its range', X.chipsHTML(c, 'senses').includes('60 ft'));
  const l = X.chipsHTML(c, 'languages');
  ck('#103 a granted language shows its source and has no ×', l.includes('COMMON<span class="chip-src"> · rules</span>') && l.includes('ELVISH<span class="chip-src"> · species</span>') &&
     !l.includes('data-chipid="l1"') && !l.includes('data-chipid="l2"') && l.includes('data-chipid="l3"'), l);
  ck('#103 an empty list says None', X.chipsHTML({immunes: []}, 'immunes').includes('None'));
  ck('#103 names are escaped', X.chipsHTML({resists: [{id: 'x', name: '<b>'}]}, 'resists').includes('>&lt;B&gt;<button') && !X.chipsHTML({resists: [{id: 'x', name: '<b>'}]}, 'resists').includes('<B>'));
  const ch = X.chipChooserHTML({resists: [{id: 'r1', name: 'Fire'}]}, 'resists');
  ck('#103 the chooser offers the damage types, Fire marked added', X.CHIP_SUGGEST.resists.length === 13 && /data-chippick="Fire"[^>]*disabled/.test(ch) && ch.includes('data-chippick="Cold"'));
  ck('#103 immunities also offer conditions', X.CHIP_SUGGEST.immunes.includes('Poisoned') && X.CHIP_SUGGEST.immunes.includes('Poison'));
  ck('#103 senses offer the four, with a range box', JSON.stringify(X.CHIP_SUGGEST.senses) === '["Blindsight","Darkvision","Tremorsense","Truesight"]' && X.chipChooserHTML({}, 'senses').includes('id="chipRange"'));
  const a = {resists: []};
  X.addChip(a, 'resists', ' fire '); X.addChip(a, 'resists', 'FIRE'); X.addChip(a, 'resists', '');
  ck('#103 add trims, refuses blanks and duplicates', a.resists.length === 1 && a.resists[0].name === 'fire');
  X.addChip(a, 'senses', 'Darkvision', '60');
  ck('#103 a sense keeps its range', a.senses[0].range === 60);
  X.removeChip(a, 'resists', a.resists[0].id);
  ck('#103 remove by id', a.resists.length === 0);
  const g = {languages: [{id: 'l2', name: 'Elvish', src: 'race:Elf'}]};
  X.removeChip(g, 'languages', 'l2');
  ck('#103 a granted chip cannot be removed by hand', g.languages.length === 1);
}

/* ---- #103: the header (spec §6.1, §6.6) ---- */
{
  const c = X.migrate({abilities: {}, system: 'dnd', name: 'Hobbs', xp: '183,000', classes: [{name: 'Cleric', level: 15}],
    race: {name: 'Half-Elf'}, bg: {name: 'Acolyte'}, familiars: [{id: 'f1', name: 'A very long owl name', active: true}, {id: 'f2', name: 'Cat'}]});
  const line = X.classLineHTML(c);
  ck('#103 the class line: each class, species, background, tappable', line.includes('data-shcls="0"') && line.includes('Cleric 15') && line.includes('data-shrace') && line.includes('Half-Elf') && line.includes('Acolyte'));
  ck('#103 no class: + Class', X.classLineHTML(X.migrate({abilities: {}})).includes('data-shaddcls'));
  const lv = X.levelBadgeHTML(c);
  ck('#103 XP mode: the XP field and a bar to the next level', lv.includes('data-path="character.xp"') && lv.includes('sh-xpbar') && lv.includes('195,000'));
  ck('#103 ready: the badge offers Level up', X.levelBadgeHTML(Object.assign({}, c, {xp: '200000'})).includes('data-shlevelup'));
  ck('#103 Milestone: the ring only', !X.levelBadgeHTML(Object.assign({}, c, {advancement: 'milestone'})).includes('character.xp'));
  const fly = X.famFlyHTML(c);
  ck('#103 the familiar flyout: name and abbreviated status per familiar, + Add', fly.includes('data-shfam="f1"') && fly.includes('●') && fly.includes('○') && fly.includes('data-add="familiar"'));
  ck('#103 the familiar card markup is shared with the list', X.familiarCardHTML(c.familiars[0]).includes('data-toggle-familiar="f1"'));
  const cf = X.classFlyHTML(c, 0);
  ck('#103 the class flyout: info, level up/down, add, remove', ['data-shinfo="0"', 'data-shlevel="up"', 'data-shlevel="down"', 'data-shaddcls', 'data-del-class="0"'].every(s => cf.includes(s)), cf);
  ck('#103 the XP shows with thousands separators', X.levelBadgeHTML(c).includes('183,000 / 195,000'));

  /* beyond the brief's list: the edges spec §11 names */
  ck('#103 the class line joins several classes, each with its own index',
     X.classLineHTML(Object.assign({}, c, {classes: [{name: 'Cleric', level: 12}, {name: 'Fighter', level: 3}]})).includes('data-shcls="1"'));
  const bare = X.classLineHTML(X.migrate({abilities: {}}));
  ck('#103 no species or background: their add buttons', bare.includes('data-add-race') && bare.includes('data-add-bg') && !bare.includes('data-shrace') && !bare.includes('data-shbg'));
  ck('#103 the flyout offers Choose when there is no subclass, the subclass when there is',
     cf.includes('data-choose-sub="Cleric"') && X.classFlyHTML(Object.assign({}, c, {classes: [{name: 'Cleric', level: 15, subclass: 'Life'}]}), 0).includes('data-sub-info="Cleric|Life"'));
  ck('#103 a flyout for a class that is not there is empty', X.classFlyHTML(c, 7) === '');
  // I-2: the menu's level buttons carry the class they belong to
  const cf1 = X.classFlyHTML(Object.assign({}, c, {classes: [{name: 'Fighter', level: 3}, {name: 'Wizard', level: 1}]}), 1);
  ck('#103 I-2 a class menu\'s Level up / down name their class', cf1.includes('data-shlevel="up" data-shidx="1"') && cf1.includes('data-shlevel="down" data-shidx="1"'), cf1);
  ck('#103 I-2 ...and the tap passes it on', /\[data-shlevel\]"\)\)\)\{const i=num\(m\.dataset\.shidx\);return m\.dataset\.shlevel==="down"\?doLevelDown\(i\):doLevelUp\(i\);\}/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '90-boot.js'), 'utf8')));
  const typed = X.levelBadgeHTML(Object.assign({}, c, {xp: 'lots'}));
  ck('#103 XP not a number: shown as typed, no bar', typed.includes('value="lots"') && !typed.includes('sh-xpbar'));
  ck('#103 the ring holds #levelDisp, so recompute() still writes the level', lv.includes('id="levelDisp"') && lv.includes('>15<'));
  // M-9 (ruled): within the level, 165,000 → 195,000, so 183,000 is 60%
  ck('#103 the bar is as full as the XP is through the current level',
     /style="width:60%"/.test(lv), lv);
  ck('#103 Level up ready is said, not just coloured', /class="sh-ring ready"/.test(X.levelBadgeHTML(Object.assign({}, c, {xp: '200000'}))) &&
     X.levelBadgeHTML(Object.assign({}, c, {xp: '200000'})).includes('Level up ready'));
  ck('#103 the XP field is escaped', X.levelBadgeHTML(Object.assign({}, c, {xp: '"><b>'})).includes('value="&quot;&gt;&lt;b&gt;"'));
  ck('#103 the paw shows with the setting on, faint with no familiar',
     X.pawHTML(Object.assign({}, c, {showFamiliars: true})).includes('data-shpaw') && !X.pawHTML(Object.assign({}, c, {showFamiliars: true})).includes('faint') &&
     X.pawHTML(Object.assign({}, c, {showFamiliars: true, familiars: []})).includes('sh-paw faint'));
  ck('#103 the paw hides with the setting off', !X.pawHTML(Object.assign({}, c, {showFamiliars: false})).includes('data-shpaw'));
  ck('#103 an empty familiar list still offers + Add', X.famFlyHTML({familiars: []}).includes('data-add="familiar"') && X.famFlyHTML({}).includes('data-add="familiar"'));
  ck('#103 a familiar card with no stat block: its name and the Summon switch',
     /Owl[\s\S]*data-toggle-familiar="o"/.test(X.familiarCardHTML({id: 'o', name: 'Owl', active: true})));

  /* the info windows: Change / Remove from the sheet, never in reference mode */
  const savedOM = ctx.openModal, savedChar = X.character;
  let got = null; ctx.openModal = (t, b) => { got = String(b); };
  X.character = X.migrate({abilities: {}, race: {name: 'Half-Elf'}, bg: {name: 'Acolyte'}});
  ctx.openRaceInfo('Half-Elf');
  ck('#103 the species window from the sheet: Change and Remove', got.includes('data-shchange="race"') && got.includes('data-del-race="1"'), got);
  ctx.openRaceInfo('Half-Elf', {ref: true});
  ck('#103 ...but not in reference mode', !got.includes('data-shchange') && !got.includes('data-del-race'));
  ctx.openRaceInfo('Dwarf');
  ck('#103 ...nor for a species the character does not have', !got.includes('data-shchange'));
  ctx.openBackgroundInfo('Acolyte');
  ck('#103 the background window from the sheet: Change and Remove', got.includes('data-shchange="bg"') && got.includes('data-del-bg="1"'), got);
  ctx.openBackgroundInfo('Acolyte', {ref: true});
  ck('#103 ...but not in reference mode', !got.includes('data-shchange') && !got.includes('data-del-bg'));
  ctx.openModal = savedOM; X.character = savedChar;
}

/* ---- #103 (Mike's layout ruling): the combat view takes cards out of the
   Sheet's two stacks and puts each back in its own stack, in its own place.
   The REAL Sheet markup, parsed into a small node tree (just enough DOM for
   fillCombatView / emptyCombatView: before, appendChild, replaceWith,
   closest, querySelector by #id, .class and [attr]), with a #combatView >
   #cvList beside it. */
{
  const html = require('./harness').loadHTML();
  const at = html.indexOf('id="tab-sheet"'), from = html.lastIndexOf('<section', at), to = html.indexOf('<section class="tabpanel', at + 1);
  const VOID = new Set(['input', 'img', 'br', 'hr', 'path', 'circle', 'line', 'rect', 'polyline', 'polygon']);
  const match = (n, sel) => {
    if (!n.tag) return false;
    const parts = sel.match(/#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]|^[a-z]+/g) || [];
    return parts.length > 0 && parts.every(p => {
      if (p[0] === '#') return n.attr('id') === p.slice(1);
      if (p[0] === '.') return (n.attr('class') || '').split(/\s+/).includes(p.slice(1));
      if (p[0] === '[') { const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(p); const v = n.attr(m[1]); return m[2] === undefined ? v !== undefined : v === m[2]; }
      return n.tag === p;
    });
  };
  function mk(tag, attrs) {
    const n = {tag, attrs: attrs || {}, parent: null, children: [], dataset: {}, hidden: false,
      attr(k) { if (k in this.attrs) return this.attrs[k]; if (k.indexOf('data-') === 0) { const d = this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; return d === undefined ? undefined : String(d); } return undefined; },
      appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; },
      remove() { if (this.parent) { const s = this.parent.children; s.splice(s.indexOf(this), 1); this.parent = null; } },
      before(c) { if (c.parent) c.remove(); const s = this.parent.children; s.splice(s.indexOf(this), 0, c); c.parent = this.parent; },
      replaceWith(c) { const p = this.parent; if (c.parent) c.remove(); const s = p.children; s.splice(s.indexOf(this), 1, c); c.parent = p; this.parent = null; },
      closest(sel) { for (let x = this; x; x = x.parent) if (match(x, sel)) return x; return null; },
      querySelectorAll(sel) { const out = []; const walk = x => x.children.forEach(c => { if (match(c, sel)) out.push(c); walk(c); }); walk(this); return out; },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }};
    return n;
  }
  const root = mk('root');
  let cur = root;
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"]|"[^"]*")*?)(\/?)>/g;
  let m;
  const src = html.slice(from, to);
  while ((m = re.exec(src))) {
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) { if (cur.tag === tag) cur = cur.parent; continue; }
    const attrs = {}; let a; const ar = /([\w-]+)(?:="([^"]*)")?/g;
    while ((a = ar.exec(m[3]))) attrs[a[1]] = a[2] === undefined ? '' : a[2];
    const n = cur.appendChild(mk(tag, attrs));
    if (!VOID.has(tag) && !m[4]) cur = n;
  }
  const view = root.appendChild(mk('div', {id: 'combatView'})), list = view.appendChild(mk('div', {id: 'cvList'}));
  const where = k => { const c = root.querySelector('.card[data-note="' + k + '"]'); const p = c.parent; return (p.attr('class') || p.attr('id') || p.tag) + '#' + p.children.indexOf(c); };
  const KEYS = ['vitals', 'abilities', 'skills', 'features', 'defences', 'statuses', 'resources'];
  const before = KEYS.map(where);
  ck('#103 the parsed Sheet has the two stacks, in their places',
     before.join() === 'sheet-grid#0,sheet-grid#1,col-m#0,col-m#1,col-r#0,col-r#1,col-r#2', before);
  const doc = ctx.document, keep = {g: doc.getElementById, q: doc.querySelector, qa: doc.querySelectorAll, c: doc.createElement,
    ag: ctx.addGrip, rg: ctx.removeGrip, sl: ctx.syncStatLock, re: ctx.renderCombatEmpty, ch: X.character};
  doc.getElementById = id => root.querySelector('#' + id);
  doc.querySelector = sel => root.querySelector(sel);
  doc.querySelectorAll = sel => root.querySelectorAll(sel);
  doc.createElement = tag => mk(tag);
  ctx.addGrip = () => {}; ctx.removeGrip = () => {}; ctx.syncStatLock = () => {}; ctx.renderCombatEmpty = () => {};
  try {
    X.character = X.blankChar(); X.character.combatSections = KEYS.slice();
    ctx.fillCombatView();
    ck('#103 every card goes into the view, a marker left in its place',
       KEYS.every(k => root.querySelector('.card[data-note="' + k + '"]').parent === list) &&
       KEYS.every(k => root.querySelector('[data-cvhome="' + k + '"]')), KEYS.map(where));
    ck('#103 ...the markers sit in the stacks the cards came from',
       root.querySelector('[data-cvhome="features"]').parent.attr('class') === 'col-m' && root.querySelector('[data-cvhome="statuses"]').parent.attr('class') === 'col-r');
    ctx.emptyCombatView();
    const after = KEYS.map(where);
    ck('#103 after End, every card is back in its own stack, in its own place', JSON.stringify(after) === JSON.stringify(before), after);
    ck('#103 ...and no marker is left behind', root.querySelectorAll('[data-cvhome]').length === 0);
  } finally {
    doc.getElementById = keep.g; doc.querySelector = keep.q; doc.querySelectorAll = keep.qa; doc.createElement = keep.c;
    ctx.addGrip = keep.ag; ctx.removeGrip = keep.rg; ctx.syncStatLock = keep.sl; ctx.renderCombatEmpty = keep.re; X.character = keep.ch;
  }
}

/* ---- #103 final review fixes (I-1, I-3, M-1, M-3, M-7, M-8, M-9, M-11, M-14) ---- */
const FS103 = require('fs'), P103 = require('path');
const SRC103 = f => FS103.readFileSync(P103.join(__dirname, '..', f), 'utf8');
/* I-1 and M-8: the hit-dice pill and field, with no pool and across the box.
   A small fake document: #hdWrap and #mBody are what renderHitDice() and the
   box read. */
{
  const doc = ctx.document;
  const keep = {g: doc.getElementById, q: doc.querySelector, a: doc.activeElement, save: ctx.scheduleSave,
    om: ctx.openModal, cm: ctx.closeModal, ch: X.character, conf: state.confirm};
  let saves = 0, wrap, body = null, foot = null, picked = null, opened = null, closed = 0, inpEl = null;
  const mk = () => ({innerHTML: '', querySelector: () => null});
  const boxBody = () => ({querySelector: s => s === '#hdRollMe' ? {} : null, querySelectorAll: () => []});
  doc.getElementById = id => id === 'hdWrap' ? wrap : id === 'mBody' ? body : id === 'hitdiceInput' ? inpEl : null;
  doc.querySelector = s => s === '#hdWrap .hd-foot' ? foot : s === '#mBody .hd-pick.on [data-hdpick]' ? picked : null;
  ctx.scheduleSave = () => { saves++; };
  ctx.openModal = (t, h) => { opened = h; };
  ctx.closeModal = () => { closed++; body = null; };
  try {
    ctx.resetRules(); ctx.mergeRules({classes: [{name: 'Fighter', hitDie: 'd10'}]}, 'test-103');
    wrap = mk();
    X.character = X.migrate({abilities: {}, classes: [{name: 'Homebrewer', level: 3}]});
    ctx.renderHitDice();
    ck('#103 I-1 no pool: the auto/manual pill is still on the sheet', wrap.innerHTML.includes('data-hdmode'), wrap.innerHTML);
    ck('#103 I-1 ...and the dice field, once, bound like every field (the shared input handler writes and saves it)',
       (wrap.innerHTML.match(/id="hitdiceInput"/g) || []).length === 1 && wrap.innerHTML.includes('data-path="character.hitdice"'), wrap.innerHTML);
    ck('#103 I-1 ...and the hint says where the switch is', /Switch to manual below/.test(wrap.innerHTML) && /no hit die for your class/.test(wrap.innerHTML), wrap.innerHTML);
    state.confirm = true; saves = 0;
    ctx.toggleHdMode();
    ck('#103 I-1 the pill switches to manual, saves, and opens the field',
       X.character.hdManual === true && saves === 1 && /id="hitdiceInput"/.test(wrap.innerHTML) && !/id="hitdiceInput"[^>]*hidden/.test(wrap.innerHTML), wrap.innerHTML);
    X.character.hitdice = '3d6';   /* what the shared [data-path] handler writes */
    ctx.hdDiceEdited();
    ck('#103 I-1 typed dice become the bar', wrap.innerHTML.includes('data-hdspend') && wrap.innerHTML.includes('d6 · 3 / 3'), wrap.innerHTML);
    const boot = SRC103('js/90-boot.js');
    ck('#103 I-1 an edit to the field is saved: the input handler calls hdDiceEdited, then scheduleSave',
       /if\(inp\.dataset\.path==="character\.hitdice"\)hdDiceEdited\(\);[\s\S]{0,200}scheduleSave\(\);/.test(boot));
    ck('#103 I-1 the pill runs toggleHdMode', /\[data-hdmode\]"\)\)\{toggleHdMode\(\);return;\}/.test(boot) || /\[data-hdmode\]"\)\)return toggleHdMode\(\);/.test(boot));

    /* typing in the inline field keeps it: only the part above it is redrawn */
    const main = {innerHTML: ''}, own = {id: 'hitdiceInput'};
    wrap = {innerHTML: 'UNTOUCHED', querySelector: s => s === '#hitdiceInput' ? own : s === '.hd-main' ? main : null};
    doc.activeElement = own;
    X.character.hitdice = '2d8';
    ctx.renderHitDice();
    ck('#103 I-1 typing in the field redraws only the bar above it', wrap.innerHTML === 'UNTOUCHED' && main.innerHTML.includes('data-hdspend'), main.innerHTML);
    doc.activeElement = keep.a;

    /* the box open: its foot holds the ids, so the sheet leaves its copy out */
    wrap = mk(); body = boxBody();
    X.character.hitdice = '';
    ctx.renderHitDice();
    ck('#103 I-1 with the spend box open the sheet draws no second pill or field',
       !wrap.innerHTML.includes('hitdiceInput') && !wrap.innerHTML.includes('data-hdmode'), wrap.innerHTML);
    body = null;
    let removed = 0; foot = {remove: () => { removed++; }};
    X.character.hitdice = '2d8';
    ctx.openHdSpend();
    ck('#103 I-1 opening the box takes the inline copy away first', removed === 1);
    foot = null;

    /* M-8: an edit in the open box redraws its rows */
    body = boxBody(); picked = {dataset: {hdpick: 'd8'}}; opened = null;
    let focused = 0; inpEl = {hidden: false, focus: () => { focused++; }, setSelectionRange: () => {}};
    X.character.hitdice = '2d10';
    ctx.hdDiceEdited();
    ck('#103 M-8 a dice edit redraws the open box with the new rows', !!opened && opened.includes('data-hdpick="d10"') && !opened.includes('data-hdpick="d8"'), opened);
    ck('#103 M-8 ...and the field has the keyboard again', focused === 1);
    /* the mode switch, in the box: back to the class's dice */
    X.character = Object.assign(X.character, {classes: [{name: 'Fighter', level: 3}]});
    opened = null;
    ctx.toggleHdMode();
    ck('#103 M-8 the auto/manual switch redraws the open box from the class', X.character.hdManual === false && !!opened && opened.includes('Fighter · 3 / 3'), opened);
    /* nothing to spend from: the box gives way to the field under the hit points */
    X.character.classes = [{name: 'Homebrewer', level: 3}];
    X.character.hdManual = true; X.character.hitdice = 'd8';
    body = boxBody(); wrap = mk(); closed = 0;
    ctx.hdDiceEdited();
    ck('#103 M-8 dice that no longer parse close the box and bring the field back under HP',
       closed === 1 && (wrap.innerHTML.match(/id="hitdiceInput"/g) || []).length === 1, wrap.innerHTML);
  } finally {
    doc.getElementById = keep.g; doc.querySelector = keep.q; doc.activeElement = keep.a;
    ctx.scheduleSave = keep.save; ctx.openModal = keep.om; ctx.closeModal = keep.cm;
    X.character = keep.ch; state.confirm = keep.conf; ctx.resetRules();
  }
}

/* M-1: the short rest says where the hit dice are, and offers them */
{
  const keep = {rs: ctx.restSummary, ch: X.character};
  let got = null;
  ctx.restSummary = (t, lines, note, opts) => { got = {t, lines, note, opts}; };
  try {
    ctx.resetRules(); ctx.mergeRules({classes: [{name: 'Fighter', hitDie: 'd10'}]}, 'test-103');
    X.character = X.migrate({abilities: {}, classes: [{name: 'Fighter', level: 3}]});
    ctx.shortRest();
    ck('#103 M-1 the short rest points at the hit-dice bar, not the old card',
       got && /hit-dice bar under your hit points/.test(got.note) && !/Rest & Recovery card/.test(got.note), got && got.note);
    ck('#103 M-1 ...and offers Spend a hit die while there are some left', got && got.opts && got.opts.hd === true);
    X.character.hdUsed = {d10: 3};
    ctx.shortRest();
    ck('#103 M-1 ...but not when none are left', got && !(got.opts && got.opts.hd));
  } finally { ctx.restSummary = keep.rs; X.character = keep.ch; ctx.resetRules(); }
  ck('#103 M-1 the button opens the spend box', /id="restHd"/.test(SRC103('js/65-resources.js')) && /restHd[\s\S]{0,120}openHdSpend\(\)/.test(SRC103('js/65-resources.js')));
}

/* I-3: the paw's menu carries what the hidden Familiars card's heading did */
{
  const keep = {ch: X.character, toast: ctx.toast};
  ctx.toast = () => null;
  try {
    X.character = X.migrate({abilities: {}, familiars: [{id: 'f1', name: 'Owl'}]});
    let fly = X.famFlyHTML(X.character);
    ck('#103 I-3 the paw menu has the familiars combat toggle, showing off', fly.includes('data-combatbtn="familiars"') && /data-combatbtn="familiars"[^>]*aria-checked="false"|aria-checked="false"[^>]*data-combatbtn="familiars"/.test(fly), fly);
    ck('#103 I-3 ...and a Note item that starts the familiars note', fly.includes('data-notebtn="familiars"') && /Add a note/.test(fly), fly);
    ck('#103 I-3 ...neither of them hidden by a pencil', !/data-combatbtn="familiars"[^>]*class="[^"]*\bed\b/.test(fly) && !/class="[^"]*\bed\b[^"]*"[^>]*data-notebtn/.test(fly));
    ctx.toggleCombatSection('familiars');
    ck('#103 I-3 toggling it adds familiars to the combat view', X.combatSectionsOf(X.character).includes('familiars'), X.character.combatSections);
    fly = X.famFlyHTML(X.character);
    ck('#103 I-3 ...and the menu then shows it on', /aria-checked="true"/.test(fly), fly);
    X.character.secNotes = {familiars: {text: 'Owl hates rain', at: 1}};
    ck('#103 I-3 with a note, the item edits it', /Edit note/.test(X.famFlyHTML(X.character)));
    ctx.toggleCombatSection('familiars');
    ck('#103 I-3 toggling again takes it out', !X.combatSectionsOf(X.character).includes('familiars'));
    ck('#103 I-3 the view shows the card the Sheet hides', /#combatView #activeSpellCard,#combatView #familiarCard\{display:block!important\}/.test(SRC103('css/45-combat.css')));
    ck('#103 I-3 the pencil goes: familiars is off #97\'s list, and a stored hide is ignored',
       !X.EDIT_CARDS.includes('familiars') && !X.editHidden({editHide: {familiars: true}}, 'familiars'));
  } finally { X.character = keep.ch; ctx.toast = keep.toast; }
}

/* M-3: a language chip's source is one the sheet knows, or the player's */
{
  ck('#103 M-3 an unknown source has no label', X.chipSrcLabel('weird') === '' && X.chipSrcLabel('constructor') === '' && X.chipSrcLabel('__proto__:x') === '' && X.chipSrcLabel('toString') === '');
  ck('#103 M-3 ...and a known one keeps its', X.chipSrcLabel('race:Elf') === 'species' && X.chipSrcLabel('bg:Sage') === 'background' && X.chipSrcLabel('system') === 'rules');
  const cl = X.chipClean([{id: 'a', name: 'Weird', src: 'weird'}, {id: 'b', name: 'Ctor', src: 'constructor'}, {id: 'c', name: 'Proto', src: '__proto__:x'}, {id: 'd', name: 'Elvish', src: 'race:Elf'}], 'languages', false);
  ck('#103 M-3 an unknown source becomes the player\'s', JSON.stringify(cl.map(x => x.src)) === '["","","","race:Elf"]', cl);
  const c = {languages: [{id: 'a', name: 'Weird', src: 'weird'}, {id: 'b', name: 'Ctor', src: 'constructor'}, {id: 'c', name: 'Proto', src: '__proto__:x'}]};
  const h = X.chipsHTML(c, 'languages');
  ck('#103 M-3 ...so it shows an × and no junk label', ['a', 'b', 'c'].every(i => h.includes('data-chipid="' + i + '"')) && !/function|object Object/.test(h), h);
  ['a', 'b', 'c'].forEach(i => X.removeChip(c, 'languages', i));
  ck('#103 M-3 ...and the × removes it', c.languages.length === 0, c.languages);
}

/* M-7: the header names the subrace */
{
  const line = X.classLineHTML(X.migrate({abilities: {}, race: {name: 'Elf', subrace: 'High Elf'}}));
  ck('#103 M-7 the species button reads "Elf · High Elf"', line.includes('data-shrace="Elf">Elf · High Elf</button>'), line);
  ck('#103 M-7 ...escaped', X.classLineHTML(X.migrate({abilities: {}, race: {name: 'Elf', subrace: '<b>'}})).includes('Elf · &lt;b&gt;</button>'));
  ck('#103 M-7 ...and just the species when there is none', X.classLineHTML(X.migrate({abilities: {}, race: {name: 'Elf'}})).includes('data-shrace="Elf">Elf</button>'));
}

/* M-9: the XP bar fills within the current level */
{
  const at = (lvl, xp) => X.migrate({abilities: {}, system: 'dnd', xp, classes: [{name: 'Cleric', level: lvl}]});
  const p = X.xpProgress(at(5, 6500));
  ck('#103 M-9 progress knows the current level\'s threshold', p && p.cur === 6500 && p.next === 14000, p);
  const w = c => (/style="width:(\d+)%"/.exec(X.levelBadgeHTML(c)) || [])[1];
  ck('#103 M-9 just reached level 5: an empty bar', w(at(5, 6500)) === '0', w(at(5, 6500)));
  ck('#103 M-9 halfway through level 5', w(at(5, 10250)) === '50', w(at(5, 10250)));
  ck('#103 M-9 XP below the level\'s own threshold clamps to empty', w(at(5, 1000)) === '0', w(at(5, 1000)));
  ck('#103 M-9 at the top of the table: full', w(at(20, 400000)) === '100', w(at(20, 400000)));
}

/* M-11, M-14 */
{
  const css = ['css/20-cards.css', 'css/30-sheet.css', 'css/45-combat.css'].map(SRC103).join('\n');
  ck('#103 M-11 the dead .cr-k rule is gone', !/\.cr-k\b/.test(css));
  const fam = X.familiarCardHTML({id: 'f1', name: 'Owl', active: true});
  ck('#103 M-14 Summon / Dismiss is a button, so it can hold the keyboard', /<button type="button" class="fam-state on" data-toggle-familiar="f1" aria-pressed="true">/.test(fam), fam);
  ck('#103 M-14 ...and after the modal repaints, focus goes back to it',
     /openFamiliar\(f\.id\);[^\n]{0,160}attrSel\("data-toggle-familiar",f\.id\)[^\n]{0,60}\.focus\(\)/.test(SRC103('js/90-boot.js')));
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
    id: 'hostile', name: P, xp: P, portraitImg: 'data:image/png;base64,AA' + ON + ' x="' + P,
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
                 sectionOverride: P},
                {id: 'hl', name: P, qty: 1, equipped: true, weapon: {kind: 'ranged', dice: '1d8', damageType: P, ammo: P}},
                {id: 'ha', name: P, qty: 3, ammo: {kind: P, bonus: 1}},
                {id: 'hb', name: P, qty: 2, ammo: {kind: P}},
                {id: 'hc', name: 'Constructor', qty: 1}],
    statuses: [{id: P, name: P, description: P, effects: [], active: true},
               {id: 'st2', name: 'Pwnterm', description: '', effects: [], active: true},
               {id: 'st3', name: P, description: P, effects: [], active: true, durationSec: 18, elapsedSec: 6},
               {id: 'st4', name: P, effects: [], active: true, durationSec: P, elapsedSec: P}],
    familiars: [{id: P, name: P, kind: P, ac: P, hp: {cur: P, max: P}, speed: P, description: P, effects: [], active: true}],
    attacks: [{id: P, name: P, kind: 'melee', ability: 'str', proficient: true, damageDice: P, damageType: P, notes: P},
              {id: 'a2', spellId: P, source: 'spell', name: P, save: {ability: P}, damageDice: P, notes: P},
              {id: 'a3', name: P, kind: 'ranged', ability: 'dex', proficient: true, damageDice: '1d8', itemId: 'hl'}],
    spells: [{id: P, name: P, level: '0' + P, prepared: true, meta: P, text: P, atkType: 'attack',
              dice: '1d6', damageType: P, granted: P, origin: {kind: 'custom', detail: P}}],
    activeSpells: [{id: P, spellId: P, name: P, level: P, conc: true, durationSec: 60, elapsedSec: 6}],
    glossary: [{id: P, term: 'Pwnterm', type: 'image', text: P, image: 'data:image/png;base64,AA' + ON + ' x="' + P}],
    resources: [{id: P, name: P, max: 3, cur: 1, per: P, die: P, auto: false, source: P}],
    slots: Object.assign(X.blankChar().slots, {1: {total: P, used: 0}}),
    coins: {cp: P, sp: 0, gp: 1, pp: 0, ep: 0},
    secNotes: {abilities: {text: P, at: 0}},
    journal: [{id: P, title: P, tag: P, text: P, at: 1, editedAt: 2}],
    trackers: [{id: P, name: P, type: 'checklist', tag: P, items: [{id: P, text: P, done: true}], at: 1},
               {id: 'tc', name: P, type: 'counter', tag: P, value: 3, goal: 5},
               {id: 'tx', name: P, type: 'task', closed: true, closedAt: 2}],
    ammoSpent: {ha: {n: 4, kind: P, snap: {id: 'ha', name: P, qty: 1, ammo: {kind: P}}}},
  });
  X.character = X.migrate(JSON.parse(JSON.stringify(hostile)));   /* the import path */
  X.activeId = 'hostile';
  const C = () => X.character;
  const run = (name, fn, reach) => inert(name, capture(fn), reach);
  run('the portrait', () => ctx.renderPortrait());
  run('renderClassRace (the header)', () => ctx.renderClassRace());
  run('Features & Traits', () => ctx.renderFeatures());
  run('Inventory', () => ctx.renderInventory());
  run('Statuses', () => ctx.renderStatuses());
  run('Familiars', () => ctx.renderFamiliars());
  // #103: the header, its flyouts and the familiar's modal
  run('the sheet header', () => ctx.renderSheetHead());
  run('the class flyout', () => ctx.openShFly('class', 1));
  run('the familiar flyout', () => ctx.openShFly('fam'));
  run('the familiar modal', () => ctx.openFamiliar(P));
  run('Attacks & Weapons', () => ctx.renderAttacks());
  run('Active Spells', () => ctx.renderActiveSpells());
  run('the spell list', () => ctx.renderSpells());
  run('the Rules tab browser, on the Glossary', () => { X.settings.rulesCat = 'glossary'; X.rbUI.per = {}; ctx.renderRulesBrowser(); });
  run('Resources', () => ctx.renderResources());
  // #103: one bar now, not a three-way style choice
  run('Hit Dice from a pack\'s hit die', () => ctx.renderHitDice());
  run('the hit-dice spend box', () => ctx.openHdSpend());
  run('Story fields and Proficiencies (glossary chips)', () => ctx.renderAllRT());
  run('the Section Notes card', () => ctx.renderNotes());
  run('the Journal list', () => { el('jnlSearch').value = ''; ctx.renderJournal(); });
  run('the Journal list, searching', () => { el('jnlSearch').value = 'PWN'; ctx.renderJournal(); });
  run('a Journal page', () => ctx.jnlOpen(P));
  run('the Journal editor', () => ctx.jnlEdit(P));
  run('the Journal page again, after Done', () => ctx.jnlDone());
  run('Trackers', () => ctx.renderTrackers());
  run('the tracker editor', () => ctx.openTrackerForm(C().trackers[0]));
  run('the Coins card', () => ctx.renderCoins());
  run('the print sheet', () => ctx.printSheet());
  C().statuses.push({id: 'tp', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 6, effects: []});
  ck('#55 the print sheet lists a timed condition with its time left',
     /Poisoned \(2 rounds left\)/.test(capture(() => ctx.printSheet()).html));
  C().statuses = C().statuses.filter(s => s.id !== 'tp');
  run('a glossary entry of the character\'s own', () => ctx.openGlossView(C().glossary[0]));
  run('the pack\'s image keyword, whose id a settings file sets', () => ctx.renderAllRT());
  run('the item editor (structured armor from the file)', () => ctx.openItemForm(C().inventory[0]));
  run('the feature editor', () => ctx.openFeatureForm(C().features[0]));
  run('the spell editor', () => ctx.openSpellForm(C().spells[0]));
  run('the spell view', () => ctx.openSpellView(C().spells[0]));
  run('the attack editor', () => ctx.openAttackForm(C().attacks[0]));
  run('the to-hit breakdown', () => ctx.openAttackBreakdown(P));
  run('the to-hit breakdown of a loaded launcher', () => ctx.openAttackBreakdown('a3'));
  run('the ammunition picker', () => ctx.openAmmoPicker('hl'));
  run('Fire on a hostile stack', () => ctx.fireWeapon('hl', false));
  run('Recover on a hostile stack', () => ctx.recoverWeaponAmmo('hl', false));
  run('the item editor (a hostile ammunition stack)', () => ctx.openItemForm(C().inventory.find(i => i.id === 'hb')));
  run('the item editor (a launcher of a hostile kind)', () => ctx.openItemForm(C().inventory.find(i => i.id === 'hl')));
  run('the resource editor', () => ctx.openResourceForm(C().resources[0]));
  run('the status editor', () => ctx.openStatusForm(C().statuses[0]));
  run('the status editor (a timed condition)', () => ctx.openStatusForm(C().statuses.find(s => s.id === 'st3')));
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
  /* #104 final review item 3: a thrown weapon stays at ×0 — the print sheet
     showed it with no count, as if ×1. It counts as the inventory badge does. */
  X.character = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {
    inventory: [{id: 'p0', name: 'Dagger', qty: 0}, {id: 'p1', name: 'Rope', qty: 1}, {id: 'p3', name: 'Torch', qty: 3}, {id: 'pn', name: 'Chalk'}]}))));
  {
    const ph = capture(() => ctx.printSheet()).html;
    ck('#104 the print sheet counts a ×0 item, and leaves a single one plain',
       /<b>Dagger<\/b> ×0/.test(ph) && /<b>Rope<\/b>(?! ×)/.test(ph) && /<b>Torch<\/b> ×3/.test(ph) && /<b>Chalk<\/b>(?! ×)/.test(ph), ph);
  }

  /* ---- the journal, driven through its DOM layer (#40) */
  X.character = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {id: 'jnl'}))));
  /* a real switch (newCharacter/loadCharById/finishImport) always calls
     renderAll() before the player could click anything on the new character;
     settle jnlUI here so jnlNewPage() below isn't the first render to see the
     switch (which would otherwise reset the draft it just opened) */
  capture(() => ctx.renderJournal());
  let flow = capture(() => {
    ctx.jnlNewPage();
    el('jnlTitle').value = 'Session 9'; el('jnlText').value = 'Into the Mire.'; ctx.jnlInput();
    ctx.jnlDone();
  });
  ck('New page, typed into, then Done: the page is saved',
     !flow.err && X.character.journal.length === 1 && X.character.journal[0].title === 'Session 9', flow.err && String(flow.err));
  ck('...and Done shows it', /id="jnlHead"[^>]*>Session 9</.test(flow.html), flow.html.slice(-300));
  flow = capture(() => { ctx.jnlNewPage(); ctx.jnlDone(); });
  ck('a page left blank is never saved', !flow.err && X.character.journal.length === 1);
  ck('...and Done goes back to the list', /data-jnlopen=/.test(flow.html));
  state.confirm = false;
  ck('Delete asks first, naming the page, and No keeps it',
     ctx.jnlDelete(X.character.journal[0].id) === false && X.character.journal.length === 1 &&
     /Delete the page “Session 9”/.test(state.lastConfirm));
  state.confirm = true;
  ck('Yes deletes it', ctx.jnlDelete(X.character.journal[0].id) === true && X.character.journal.length === 0);
  X.character.journal = [{id: 'k', title: 'Kept', text: 'x', at: 1}];
  capture(() => ctx.jnlOpen('k'));
  X.character = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {id: 'other'}))));
  flow = capture(() => ctx.renderJournal());
  ck('another character starts at its own list, not the page left open', /No pages yet/.test(flow.html), flow.html);

  /* ---- Import → Replace keeps the id and swaps the sheet (#39, #40, #41)
     Session state was keyed on the id, so an editor open at the time survived
     the replace, and its next keystroke wrote the old text over the imported
     page; Completed stayed open. It is keyed on the character object now. */
  X.character = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {id: 'rep',
    journal: [{id: 'pg', title: 'Session 1', text: 'Old words.', at: 1}]}))));
  capture(() => ctx.renderJournal());
  capture(() => ctx.jnlEdit('pg'));
  const imported = X.migrate(JSON.parse(JSON.stringify(Object.assign({}, X.character, {
    journal: [{id: 'pg', title: 'Session 1', text: 'Imported words.', at: 1}]}))));
  X.character = imported;
  flow = capture(() => ctx.renderJournal());
  ck('an Import → Replace of the open character closes its editor, back at the list',
     !flow.err && !/id="jnlText"/.test(flow.html) && /data-jnlopen="pg"/.test(flow.html), flow.html.slice(0, 300));
  capture(() => { el('jnlText').value = 'Stale words.'; ctx.jnlInput(); });
  ck('...so a keystroke in the old editor cannot write over the imported page',
     imported.journal[0].text === 'Imported words.', imported.journal[0].text);
  X.character = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {id: 'rep2',
    trackers: [{id: 'd', name: 'Done', type: 'counter', value: 5, goal: 5, closed: true, closedAt: 1}]}))));
  capture(() => ctx.renderTrackers());
  flow = capture(() => ctx.toggleTrkCompleted());
  const wasOpen = /data-trkcompleted[^>]*aria-expanded="true"/.test(flow.html);
  X.character = X.migrate(JSON.parse(JSON.stringify(X.character)));
  flow = capture(() => ctx.renderTrackers());
  ck('...and the imported sheet starts with Completed shut, as any switch does',
     wasOpen && /data-trkcompleted[^>]*aria-expanded="false"/.test(flow.html), flow.html.slice(0, 300));

  /* ---- the tracker form keeps what was typed (#41)
     Close now and Reopen threw the form away; and an Undo while the form was
     open swapped the stored tracker for its snapshot, so Save wrote to an
     object no longer in the list. The recorder DOM does not read values back
     out of the markup, so the boxes are filled in by hand. */
  X.character = X.migrate(JSON.parse(JSON.stringify(Object.assign(X.blankChar(), {id: 'frm',
    trackers: [{id: 'm', name: 'Moths', type: 'counter', tag: 'Kills', value: 2, goal: 10, autoClose: true}]}))));
  const fillForm = name => [['tkName', name], ['tkTag', 'Kills'], ['tkGoal', '12']]
    .forEach(([id, v]) => { el(id).value = v; });
  let fr = capture(() => { ctx.openTrackerForm(X.character.trackers[0]); fillForm('Moths slain'); fire('tkCloseNow', 'click'); });
  let m0 = X.character.trackers[0];
  ck('Close now keeps what was typed into the form',
     !fr.err && m0.closed === true && m0.name === 'Moths slain' && m0.goal === 12, fr.err ? String(fr.err) : m0);
  fr = capture(() => { ctx.openTrackerForm(X.character.trackers[0]); fillForm('Moths, again'); fire('tkCloseNow', 'click'); });
  m0 = X.character.trackers[0];
  ck('...and so does Reopen', !fr.err && m0.closed === false && m0.name === 'Moths, again', fr.err ? String(fr.err) : m0);
  const snapM = ctx.trkSnapshot(X.character.trackers[0]);
  fr = capture(() => {
    ctx.openTrackerForm(X.character.trackers[0]);
    ctx.trkRestore(X.character, snapM);          /* the toast's Undo, landing while the form is open */
    fillForm('Moths, renamed'); fire('tkSave', 'click');
  });
  ck('Save after an Undo swapped the tracker still saves to the stored one',
     !fr.err && X.character.trackers.length === 1 && X.character.trackers[0].name === 'Moths, renamed',
     fr.err ? String(fr.err) : X.character.trackers);

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
  const gl = renders('the Rules tab glossary', () => { X.settings.rulesCat = 'glossary'; X.rbUI.per = {}; ctx.renderRulesBrowser(); });
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
  renders('renderClassRace (the header)', () => ctx.renderClassRace());

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
    const gl2 = renders('the Rules tab glossary after migrate()', () => { X.settings.rulesCat = 'glossary'; X.rbUI.per = {}; ctx.renderRulesBrowser(); });
    ck('#71 the entry with no term is listed after migrate() too', /data-edit-gloss="g0"/.test(gl2), gl2.slice(0, 400));
    let h2 = null; try { h2 = ctx.highlight('Aliased'); } catch (e) { h2 = String(e); }
    ck('#71 an aliased entry chips once migrated', /data-gid="g2"/.test(h2 || ''), h2);
    /* every list holding a null, a bare string and an array: once migrated, the
       whole sheet draws (a string in `spells` threw on the first write to it) */
    const junkLists = Object.assign(X.blankChar(), {system: 'dnd'});
    ['features', 'inventory', 'statuses', 'familiars', 'spells', 'attacks', 'activeSpells', 'glossary',
     'classes', 'grants', 'resources', 'journal', 'trackers'].forEach(k => { junkLists[k] = [null, 'str', 7, ['arr'], {}]; });
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
    renders('the Rules tab tables (a table with no rows, one with ragged rows)', () => { X.settings.rulesCat = 'tables'; X.rbUI.per = {}; ctx.renderRulesBrowser(); });
    const RB_EVERY = ['classes', 'subclasses', 'races', 'backgrounds', 'feats', 'features', 'spells', 'items', 'conditions', 'glossary', 'tables'];
    RB_EVERY.forEach(k => renders('the Rules tab browser on ' + k + ' over a tidied pool',
      () => { X.settings.rulesCat = k; X.rbUI.per = {}; ctx.renderRulesBrowser(); }));
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
    const magic = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'srd52', 'items-magic.json'), 'utf8')).items;
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

  /* ---- the item editor's ammunition fields (#8), driven through the form ---- */
  {
    const items = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'srd52', 'items.json'), 'utf8')).items;
    X.resetRules();
    X.mergeRules({system: 'XPHB', items: items.filter(x => ['Arrow', 'Arrows (20)', 'Longbow', 'Dagger', 'Firearm Bullets (10)', "Alchemist's Supplies"].includes(x.name))}, 'x.json');
    X.character = X.blankChar(); X.character.system = 'dnd';
    const at = n => String(X.rules.items.findIndex(x => x.name === n));
    const why = res => res.err ? String(res.err.stack || res.err).split('\n').slice(0, 3).join(' | ') : undefined;
    let res = capture(() => { ctx.openItemForm(); el('iLib').value = at('Arrows (20)'); fire('iLib', 'change'); fire('iSave', 'click'); });
    const ar = X.character.inventory[0] || {};
    ck('#8 Insert from pack turns a bundle into its piece: Arrow ×20, of the arrow kind',
       !res.err && ar.name === 'Arrow' && ar.qty === 20 && JSON.stringify(ar.ammo) === '{"kind":"arrow"}', why(res) || ar);
    res = capture(() => { ctx.openItemForm(); el('iLib').value = at('Longbow'); fire('iLib', 'change'); fire('iSave', 'click'); });
    const bw = X.character.inventory[1] || {};
    ck('#8 ...and an inserted Longbow fires arrows', !res.err && (bw.weapon || {}).ammo === 'arrow', why(res) || bw);
    res = capture(() => {
      ctx.openItemForm(); el('iName').value = 'Elven Arrow'; fire('iIsAmmo', 'click');
      el('iAmmoKind').value = 'arrow'; el('iAmmoBonus').value = '1'; fire('iSave', 'click');
    });
    const ea = X.character.inventory[2] || {};
    ck('#8 a homebrew item marked as ammunition: an arrow, +1', !res.err && JSON.stringify(ea.ammo) === '{"kind":"arrow","bonus":1}', why(res) || ea);
    res = capture(() => {
      ctx.openItemForm(); el('iName').value = 'Pellet Bow'; fire('iIsWeapon', 'click'); el('iWDice').value = '1d4'; el('iWKind').value = 'ranged';
      el('iWAmmo').value = '__other'; el('iWAmmoOther').value = ' Dart  Pellet '; fire('iSave', 'click');
    });
    const pb = X.character.inventory[3] || {};
    ck('#8 a weapon can fire a kind of its own', !res.err && (pb.weapon || {}).ammo === 'dart pellet', why(res) || pb);
    const n = X.character.inventory.length;
    capture(() => {
      ctx.openItemForm(); el('iName').value = 'Blank'; fire('iIsAmmo', 'click');
      el('iAmmoKind').value = '__other'; el('iAmmoKindOther').value = ''; fire('iSave', 'click');
    });
    ck('#8 Other… with no kind named saves nothing', X.character.inventory.length === n);
    bw.ammoStack = ar.id;
    res = capture(() => {
      ctx.openItemForm(bw);
      [['iName', 'Longbow'], ['iWKind', 'ranged'], ['iWAbil', 'dex'], ['iWDice', '1d8'], ['iWType', 'piercing'], ['iWAmmo', 'arrow']]
        .forEach(([id, v]) => { el(id).value = v; });
      fire('iSave', 'click');
    });
    const bw2 = X.character.inventory.find(i => i.id === bw.id) || {};
    ck('#8 re-saving a launcher keeps what it fires and the stack it is loaded with',
       !res.err && (bw2.weapon || {}).ammo === 'arrow' && bw2.ammoStack === ar.id, why(res) || bw2);

    /* #6 final review, item 8: Insert from pack filled the quantity box from
       "Arrows (20)" (20), and picking Longbow next left it there — Save would
       have added 20 Longbows. */
    res = capture(() => {
      ctx.openItemForm();
      el('iLib').value = at('Arrows (20)'); fire('iLib', 'change');
      el('iLib').value = at('Longbow'); fire('iLib', 'change');
      fire('iSave', 'click');
    });
    const lb = X.character.inventory[X.character.inventory.length - 1] || {};
    ck('#8 picking Longbow after a bundle puts the quantity back to 1',
       !res.err && lb.name === 'Longbow' && lb.qty === 1, why(res) || lb);

    /* #104 review finding 1: Insert from rules pack must re-sync the
       Recovery field too — it stayed hidden (with the blank item's default)
       when a thrown weapon or an ammunition bundle was inserted. */
    res = capture(() => { ctx.openItemForm(); el('iLib').value = at('Dagger'); fire('iLib', 'change'); });
    ck('#104 Insert from pack shows Recovery for a Thrown weapon, defaulted to Always',
       !res.err && el('iRecoverWrap').style.display !== 'none' && /Default \(always comes back\)/.test(el('iRecover').innerHTML),
       why(res) || { display: el('iRecoverWrap').style.display, html: el('iRecover').innerHTML });
    res = capture(() => { ctx.openItemForm(); el('iLib').value = at('Firearm Bullets (10)'); fire('iLib', 'change'); });
    ck("#104 ...and for an ammunition bundle, defaulted to this kind's own default (Never, for firearm bullets)",
       !res.err && el('iRecoverWrap').style.display !== 'none' && /Default \(never comes back\)/.test(el('iRecover').innerHTML),
       why(res) || { display: el('iRecoverWrap').style.display, html: el('iRecover').innerHTML });
    res = capture(() => { ctx.openItemForm(); el('iLib').value = at("Alchemist's Supplies"); fire('iLib', 'change'); });
    ck('#104 ...and hides it again for a plain item',
       !res.err && el('iRecoverWrap').style.display === 'none',
       why(res) || el('iRecoverWrap').style.display);
    /* #104 final review item 4: the toggles read the form's CURRENT weapon (the
       one just inserted), not the one the item opened with — ticking Ammunition
       on and off again after inserting a Dagger hid the field, though Save
       still keeps a Dagger's choice. */
    const shown = () => el('iRecoverWrap').style.display !== 'none';
    let seen = [];
    res = capture(() => {
      ctx.openItemForm(); el('iLib').value = at('Dagger'); fire('iLib', 'change');
      fire('iIsAmmo', 'click'); seen.push(shown()); fire('iIsAmmo', 'click'); seen.push(shown());
    });
    ck('#104 after Insert of a Dagger, Ammunition on and off again keeps "After a fight" showing',
       !res.err && seen.join() === 'true,true', why(res) || seen);
    seen = [];
    /* (capture() starts a fresh DOM, so the form is opened again in each) */
    res = capture(() => {
      ctx.openItemForm(); el('iLib').value = at('Dagger'); fire('iLib', 'change');
      fire('iIsWeapon', 'click'); seen.push(shown()); fire('iIsWeapon', 'click'); seen.push(shown());
      el('iWAmmo').value = 'arrow'; fire('iWAmmo', 'change'); seen.push(shown());
      el('iWAmmo').value = ''; fire('iWAmmo', 'change'); seen.push(shown());
      el('iName').value = 'Dagger'; el('iWDice').value = '1d4'; el('iWKind').value = 'melee'; el('iWAbil').value = 'finesse'; el('iWType').value = 'piercing';
      el('iRecover').value = 'never'; fire('iSave', 'click');
    });
    ck('#104 ...Weapon off hides it and on shows it again; a weapon that fires ammunition is no thrown weapon',
       !res.err && seen.join() === 'false,true,false,true', why(res) || seen);
    const dg = X.character.inventory[X.character.inventory.length - 1] || {};
    ck('#104 ...and Save keeps the choice the shown field made', !res.err && dg.name === 'Dagger' && dg.recover === 'never', why(res) || dg);
  }

  /* ---- the status form's Lasts row (#55), driven through the form ----
     The recorder DOM does not read values back out of the markup, so each box a
     save reads is set by hand. */
  {
    X.character = X.blankChar();
    const why = res => res.err ? String(res.err.stack || res.err).split('\n').slice(0, 3).join(' | ') : undefined;
    let res = capture(() => { ctx.openStatusForm(); el('stName').value = 'Poisoned'; el('stDurN').value = '3'; el('stDurU').value = 'rounds'; fire('stSave', 'click'); });
    const p = X.character.statuses[0] || {};
    ck('#55 the form saves a duration: 3 rounds is 18 seconds', !res.err && p.durationSec === 18 && !('elapsedSec' in p), why(res) || p);
    p.elapsedSec = 6;
    res = capture(() => { ctx.openStatusForm(p); el('stName').value = 'Poisoned'; el('stDesc').value = 'From the needle trap.';
      el('stDurN').value = '3'; el('stDurU').value = 'rounds'; fire('stSave', 'click'); });
    ck('#55 editing the notes mid-fight keeps the time already run', !res.err && X.character.statuses[0].elapsedSec === 6 &&
       X.character.statuses[0].description === 'From the needle trap.', why(res) || X.character.statuses[0]);
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Poisoned'; el('stDurN').value = '2'; el('stDurU').value = 'minutes'; fire('stSave', 'click'); });
    const p2 = X.character.statuses[0] || {};
    ck('#55 changing the length keeps the time already run', !res.err && p2.durationSec === 120 && p2.elapsedSec === 6, why(res) || p2);
    p2.active = false; p2.elapsedSec = 120;
    res = capture(() => { ctx.openStatusForm(p2); el('stName').value = 'Poisoned'; el('stDurN').value = '2'; el('stDurU').value = 'minutes';
      fire('stActive', 'click'); fire('stSave', 'click'); });
    const p3 = X.character.statuses[0] || {};
    ck('#55 switching it on in the form restarts it', !res.err && p3.active === true && p3.durationSec === 120 && !('elapsedSec' in p3), why(res) || p3);
    res = capture(() => { ctx.openStatusForm(p3); el('stName').value = 'Poisoned'; el('stDurN').value = ''; fire('stSave', 'click'); });
    ck('#55 a blank length makes it untimed', !res.err && !('durationSec' in X.character.statuses[0]) && !('elapsedSec' in X.character.statuses[0]),
       why(res) || X.character.statuses[0]);
    X.character.statuses = [{id: 'cc', name: 'Concentrating', active: true, concId: 'a1', effects: []}];
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Concentrating'; el('stDurN').value = '3'; fire('stSave', 'click'); });
    ck('#55 the Concentrating condition never takes a duration', !res.err && !('durationSec' in X.character.statuses[0]), why(res) || X.character.statuses[0]);

    /* final review: the Lasts box takes decimals — number × unit rounded to
       the second, not truncated to a whole number of the unit first. */
    X.character.statuses = [{id: 'd1', name: 'Poisoned', active: true, effects: []}];
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Poisoned'; el('stDurN').value = '1.5'; el('stDurU').value = 'hours'; fire('stSave', 'click'); });
    ck('#55 final review: "1.5 hours" saves 5400 seconds, not truncated away', !res.err && X.character.statuses[0].durationSec === 5400, why(res) || X.character.statuses[0]);
    X.character.statuses = [{id: 'd2', name: 'Poisoned', active: true, effects: []}];
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Poisoned'; el('stDurN').value = '0.5'; el('stDurU').value = 'hours'; fire('stSave', 'click'); });
    ck('#55 final review: "0.5 hours" saves 1800 seconds', !res.err && X.character.statuses[0].durationSec === 1800, why(res) || X.character.statuses[0]);
    X.character.statuses = [{id: 'd3', name: 'Poisoned', active: true, effects: []}];
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Poisoned'; el('stDurN').value = '-3'; el('stDurU').value = 'rounds'; fire('stSave', 'click'); });
    ck('#55 final review: "-3" rounds saves untimed', !res.err && !('durationSec' in X.character.statuses[0]) && !('elapsedSec' in X.character.statuses[0]), why(res) || X.character.statuses[0]);

    /* final review (the spec was silent): shortening a running condition to no
       more than the time it has already run saves it Cleared — it has already
       run its course. Restarting (switching it back on in the form) is not
       this path and still starts at 0, covered above. */
    X.character.statuses = [{id: 'd4', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 12, effects: []}];
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Poisoned'; el('stDurN').value = '1'; el('stDurU').value = 'rounds'; fire('stSave', 'click'); });
    ck('#55 final review: shortening to no more than the time already run saves it Cleared',
       !res.err && X.character.statuses[0].active === false && X.character.statuses[0].elapsedSec === 6, why(res) || X.character.statuses[0]);
    X.character.statuses = [{id: 'd5', name: 'Poisoned', active: true, durationSec: 18, elapsedSec: 12, effects: []}];
    res = capture(() => { ctx.openStatusForm(X.character.statuses[0]); el('stName').value = 'Poisoned'; el('stDurN').value = '3'; el('stDurU').value = 'rounds'; fire('stSave', 'click'); });
    ck('#55 final review: lengthening past the time already run stays active',
       !res.err && X.character.statuses[0].active === true && X.character.statuses[0].elapsedSec === 12, why(res) || X.character.statuses[0]);

    X.character = X.blankChar();
  }

  Object.assign(doc, saved);
  if (!hadFR) delete ctx.FileReader;
  X.activeId = null;
  X.character = X.blankChar();
  X.resetRules();
}


/* ---- a negative effect marks its number red (#89) ----
   Any ONE contribution below zero marks the number .fx-neg, even when a bonus
   outweighs it or cancels it out: the player wants to see the penalty first.
   Derived numbers keep the marker's old rule (Mike, 2026-10-13): -4 CON marks
   the CON modifier, not the CON save. */
{
  const fx = (target, value, source) => ({source: source || 'Test', target, value});
  ck('#89 fxNeg: no contributions, nothing negative', X.fxNeg([], 'ac') === false);
  ck('#89 fxNeg: a bonus alone is not negative', X.fxNeg([fx('ac', 1)], 'ac') === false);
  ck('#89 fxNeg: a penalty is', X.fxNeg([fx('ability.con', -4)], 'ability.con') === true);
  ck('#89 fxNeg: a penalty to another target is not', X.fxNeg([fx('ability.con', -4)], 'ac') === false);
  ck('#89 fxNeg: a bigger bonus does not hide a penalty', X.fxNeg([fx('ac', 3), fx('ac', -1)], 'ac') === true);
  ck('#89 fxNeg: nor does one that cancels it', X.fxNeg([fx('ac', 2), fx('ac', -2)], 'ac') === true);
  ck('#89 fxNeg: any of several targets counts', X.fxNeg([fx('check', -1)], 'skill.athletics', 'check') === true);

  /* mark(): .fx-neg implies .fx-on, so every existing .fx-on rule still applies */
  const cls = () => { const e = {on: null, neg: null}; e.classList = {toggle: (k, v) => { if (k === 'fx-on') e.on = !!v; if (k === 'fx-neg') e.neg = !!v; }}; return e; };
  let el = cls(); X.mark(el, true);
  ck('#89 mark: a bonus is .fx-on and not .fx-neg', el.on === true && el.neg === false, el);
  el = cls(); X.mark(el, false, true);
  ck('#89 mark: a penalty is .fx-on AND .fx-neg, even when the sum says nothing changed', el.on === true && el.neg === true, el);
  el = cls(); X.mark(el, false);
  ck('#89 mark: nothing is neither', el.on === false && el.neg === false, el);

  const fresh = () => { const c = X.blankChar(); X.character = c;
    Object.assign(c.abilities, {str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 8}); c.speed = 30; return c; };
  const status = (effects, active) => ({id: X.uid(), name: 'Sickened', description: '', active: active !== false, effects});
  const worn = (name, effects) => ({id: X.uid(), name, category: 'Wondrous item', qty: 1, equipped: true, effects});
  const IDS = ['mod-con', 'mod-dex', 'save-con', 'acDisp', 'initDisp', 'speedDisp', 'skill-athletics', 'pbDisp', 'sizeDisp'];

  let c = fresh();
  c.statuses.push(status([{target: 'ability.con', value: -4}]));
  c.inventory.push(worn('Gloves of Dexterity', [{target: 'ability.dex', value: 2}]));
  let p = painted(IDS);
  ck('#89 -4 CON: the CON modifier is +0 and marked red', p['mod-con'] === '+0' && painted.fx['mod-con'] && painted.neg['mod-con'], [p, painted.neg]);
  ck('#89 ...+2 DEX stays the plain marker', painted.fx['mod-dex'] && !painted.neg['mod-dex'], painted.neg);
  ck('#89 ...and the CON save is not marked, as a bonus would not mark it either',
     p['save-con'] === '+0' && !painted.fx['save-con'] && !painted.neg['save-con'], [p['save-con'], painted.fx, painted.neg]);
  c.statuses[0].active = false;
  p = painted(IDS);
  ck('#89 an inactive status marks nothing', p['mod-con'] === '+2' && !painted.fx['mod-con'] && !painted.neg['mod-con'], [p, painted.neg]);

  c = fresh();   /* unarmoured: 10 + DEX 1 = 11 */
  c.inventory.push(worn('Ring of Protection', [{target: 'ac', value: 1}]));
  p = painted(IDS);
  ck('#89 a bonus to AC alone: 12, marked, not red', p.acDisp === '12' && painted.fx.acDisp && !painted.neg.acDisp, [p.acDisp, painted.neg]);
  c.statuses.push(status([{target: 'ac', value: -2}]));
  p = painted(IDS);
  ck('#89 +1 and -2 to AC: 10, and red', p.acDisp === '10' && painted.fx.acDisp && painted.neg.acDisp, [p.acDisp, painted.neg]);
  c.statuses[0].effects[0].value = -1;
  p = painted(IDS);
  ck('#89 +1 and -1 cancel to 11, and it still shows red', p.acDisp === '11' && painted.fx.acDisp && painted.neg.acDisp, [p.acDisp, painted.fx, painted.neg]);

  c = fresh();
  c.statuses.push(status([{target: 'check', value: -1}]));
  p = painted(IDS);
  ck('#89 -1 to every ability check: Athletics and initiative are red', painted.neg['skill-athletics'] && painted.neg.initDisp, painted.neg);
  ck('#89 ...the modifiers and saves are not', !painted.neg['mod-dex'] && !painted.neg['save-con'], painted.neg);

  c = fresh();
  c.statuses.push(status([{target: 'profBonus', value: -1}]));
  p = painted(IDS);
  ck('#89 a penalty to the proficiency bonus is red', p.pbDisp === '+1' && painted.neg.pbDisp, [p.pbDisp, painted.neg]);

  c = fresh();
  c.statuses.push(status([{target: 'speed', value: -10}]));
  p = painted(IDS);
  ck('#89 -10 speed: 20, and red', p.speedDisp === '20' && painted.neg.speedDisp, [p.speedDisp, painted.neg]);
  c = fresh();
  c.encumbrance = 'variant'; c.inventory.push({id: X.uid(), name: 'Anvil', category: 'Gear', qty: 1, weight: 100});
  p = painted(IDS);
  ck('#89 encumbrance lowers speed (30 -> 20), and that is red too', p.speedDisp === '20' && painted.neg.speedDisp, [p.speedDisp, painted.neg]);
  c.encumbrance = 'none';
  p = painted(IDS);
  ck('#89 ...off again, speed is 30 and unmarked', p.speedDisp === '30' && !painted.fx.speedDisp && !painted.neg.speedDisp, [p.speedDisp, painted.neg]);
  c.size = 'Small';
  p = painted(IDS);
  ck('#89 a size you set yourself is marked, never red', painted.fx.sizeDisp && !painted.neg.sizeDisp, painted.neg);

  /* the attack row: to-hit, damage and a save spell's DC */
  c = fresh();
  c.inventory.push(worn('Cursed Gauntlet', [{target: 'attack', value: -1}, {target: 'damage', value: 2}]));
  c.attacks.push({id: 'ls', name: 'Longsword', kind: 'melee', ability: 'str', proficient: true, addAbilityDamage: true,
                  atkMisc: '', damageDice: '1d8', damageType: 'slashing', dmgMisc: '', notes: ''});
  let n = X.attackNumbers(c.attacks[0]);
  ck('#89 attackNumbers: -1 to hit is atkNeg, +2 damage is not dmgNeg',
     n.toHit === 3 && n.atkNeg === true && n.dmgNeg === false, n);
  c.inventory.push(worn('Rusty Blade Charm', [{target: 'damage.ranged', value: -3}]));
  ck('#89 ...a ranged-only penalty leaves a melee row alone', X.attackNumbers(c.attacks[0]).dmgNeg === false);
  c.inventory.push(worn('Dull Edge', [{target: 'damage.melee', value: -1}]));
  ck('#89 ...a melee one does not', X.attackNumbers(c.attacks[0]).dmgNeg === true);
  c.spellAbility = 'wis';
  c.inventory.push(worn('Muddled Focus', [{target: 'spell.attack', value: -1}, {target: 'spell.dc', value: -1}]));
  c.attacks.push({id: 'fb', source: 'spell', name: 'Fire Bolt', kind: 'ranged', ability: 'wis', proficient: true,
                  addAbilityDamage: false, atkMisc: '', damageDice: '1d10', damageType: 'fire', dmgMisc: '', notes: ''});
  c.attacks.push({id: 'sf', source: 'spell', name: 'Sacred Flame', save: {ability: 'dex'}, damageDice: '1d8', damageType: 'radiant', notes: ''});
  ck('#89 ...a spell attack row takes the spell.attack penalty', X.attackNumbers(c.attacks[1]).atkNeg === true);
  c.inventory.find(i => i.name === 'Cursed Gauntlet').equipped = false;
  ck('#89 ...a weapon row does not', X.attackNumbers(c.attacks[0]).atkNeg === false);
  c.inventory.find(i => i.name === 'Cursed Gauntlet').equipped = true;
  c.inventory.find(i => i.name === 'Dull Edge').equipped = false;
  {
    const realC = ctx.document.createElement, realB = ctx.document.getElementById, rows = [];
    ctx.document.createElement = () => { const e = {style: {}, dataset: {}, classList: {toggle() {}, add() {}, remove() {}}}; rows.push(e); return e; };
    ctx.document.getElementById = id => id === 'attackList' ? {innerHTML: '', appendChild() {}, style: {}} : realB(id);
    try { X.renderAttacks(); } finally { ctx.document.createElement = realC; ctx.document.getElementById = realB; }
    const html = nm => rows.map(e => String(e.innerHTML || '')).find(h => h.includes('>' + nm + '<')) || '';
    const ls = html('Longsword'), sf = html('Sacred Flame');
    ck('#89 the Longsword row: +3 to hit, red', /<span class="atk-hit fx-on fx-neg" data-atk-info="ls">\+3 to hit<\/span>/.test(ls), ls.slice(0, 700));
    const dmgOf = h => (h.match(/Damage <b[^>]*>/) || [''])[0];
    ck('#89 ...and its +2 damage the plain marker', dmgOf(ls) === 'Damage <b class="fx-on" style="">', dmgOf(ls));
    ck('#89 the Sacred Flame row: its DC red', /<span class="atk-hit fx-on fx-neg">DC \d+ DEX<\/span>/.test(sf), sf.slice(0, 700));
    c.inventory.find(i => i.name === 'Cursed Gauntlet').effects = [{target: 'damage', value: -2}];
    rows.length = 0;
    ctx.document.createElement = () => { const e = {style: {}, dataset: {}, classList: {toggle() {}, add() {}, remove() {}}}; rows.push(e); return e; };
    ctx.document.getElementById = id => id === 'attackList' ? {innerHTML: '', appendChild() {}, style: {}} : realB(id);
    try { X.renderAttacks(); } finally { ctx.document.createElement = realC; ctx.document.getElementById = realB; }
    const ls2 = html('Longsword');
    ck('#89 a damage penalty alone: the damage is red, the to-hit unmarked',
       dmgOf(ls2) === 'Damage <b class="fx-on fx-neg" style="">' && /<span class="atk-hit " data-atk-info="ls">/.test(ls2), [dmgOf(ls2), ls2.slice(0, 600)]);
  }

  /* the breakdowns: the lines that turned it red are red */
  c = fresh();
  c.statuses.push(status([{target: 'ability.con', value: -4}]));
  c.inventory.push(worn('Amulet of Health-ish', [{target: 'ability.con', value: 1}]));
  let m = shownModal(() => X.openStatBreakdown('ability.con'));
  ck('#89 the CON breakdown shows the -4 line red', /<div class="bd-neg"[^>]*><span>Sickened<\/span><b>-4<\/b>/.test(m.b), m.b);
  ck('#89 ...and the +1 line plain', /<div[^>]*><span>Amulet of Health-ish<\/span><b>\+1<\/b>/.test(m.b) && !/bd-neg"[^>]*><span>Amulet/.test(m.b), m.b);
  c = fresh();
  c.encumbrance = 'variant'; c.inventory.push({id: X.uid(), name: 'Anvil', category: 'Gear', qty: 1, weight: 100});
  m = shownModal(() => X.openStatBreakdown('speed'));
  ck('#89 the speed breakdown shows encumbrance red', /<div class="bd-neg"[^>]*><span>Encumbered/.test(m.b), m.b);
  c = fresh();
  c.inventory.push(worn('Cursed Gauntlet', [{target: 'attack', value: -1}]));
  c.attacks.push({id: 'ls', name: 'Longsword', kind: 'melee', ability: 'str', proficient: true, addAbilityDamage: true,
                  atkMisc: '', damageDice: '1d8', damageType: 'slashing', dmgMisc: '', notes: ''});
  m = shownModal(() => X.openAttackBreakdown('ls'));
  ck('#89 the attack breakdown shows the -1 effect red', /<div class="bd-neg"[^>]*><span>Cursed Gauntlet<\/span><b>-1<\/b>/.test(m.b), m.b);
  ck('#89 ...and not the STR modifier or proficiency, which are not effects',
     (m.b.match(/bd-neg/g) || []).length === 1, m.b);

  /* the style: brick red and a different shape, in every skin */
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'css', '30-sheet.css'), 'utf8');
  ck('#89 .fx-neg is brick red, over the .fx-on colour', /\.fx-on\.fx-neg\{color:var\(--brick\)!important\}/.test(css));
  ck('#89 ...with a ▼ in place of the ●', /\.fx-on\.fx-neg::after\{content:"▼";[^}]*color:var\(--brick\)/.test(css));
  ck('#89 ...and a red breakdown line', /\.bd-neg\{color:var\(--brick\)\}/.test(css));
  const tokens = require('fs').readFileSync(require('path').join(__dirname, '..', 'css', '00-tokens.css'), 'utf8');
  ck('#89 every skin defines --brick', (tokens.match(/--brick:/g) || []).length >= 4);
  X.character = X.blankChar();
}

// ---------- #52 hide tabs: the field and the tab bar
{
  ck('#52 a new character hides no tab', Array.isArray(X.blankChar().hiddenTabs) && X.blankChar().hiddenTabs.length === 0);
  ck('#52 the hideable tabs are the five word tabs', X.HIDEABLE_TABS.join() === 'spells,inventory,story,journal,rules', X.HIDEABLE_TABS);
  ck('#52 Bio is the story tab\'s label', X.TAB_LABELS.story === 'Bio');
  const cl = v => X.cleanHiddenTabs(v).join();
  ck('#52 migrate cleans hiddenTabs: junk, unknown names, sheet, combat, repeats',
     cl(['sheet', 'combat', 'bogus', 'spells', 'spells', 'rules']) === 'spells,rules' && cl('spells') === '' && cl({spells: 1}) === '' && cl(null) === '' && cl(undefined) === '',
     [cl(['sheet', 'combat', 'bogus', 'spells', 'spells', 'rules']), cl('spells')]);
  const m = X.migrate({abilities: {}, hiddenTabs: ['journal', 'sheet', 'journal']});
  ck('#52 migrate keeps the real names once', JSON.stringify(m.hiddenTabs) === '["journal"]', m.hiddenTabs);
  ck('#52 a sheet from before gets an empty list', JSON.stringify(X.migrate({abilities: {}}).hiddenTabs) === '[]');
  ck('#52 it survives a save → load round trip', JSON.stringify(X.migrate(JSON.parse(JSON.stringify(m))).hiddenTabs) === '["journal"]');
  const c = X.blankChar(); c.hiddenTabs = ['spells'];
  ck('#52 isTabHidden reads the character', X.isTabHidden('spells', c) === true && X.isTabHidden('rules', c) === false);
  c.hiddenTabs = ['sheet', 'combat'];
  ck('#52 sheet and combat are never hidden, whatever the list says', !X.isTabHidden('sheet', c) && !X.isTabHidden('combat', c));

  /* the real tab buttons from the template, as just-enough DOM */
  const html = require('./harness').loadHTML();
  const names = [...html.matchAll(/<button class="tab(?: active)?" data-tab="([a-z]+)"/g)].map(x => x[1]);
  ck('#52 the template has the Sheet and the five hideable tabs', names.join() === 'sheet,spells,inventory,story,journal,rules', names);
  const btns = names.map(n => ({dataset: {tab: n}, hidden: false}));
  let active = 'spells';
  const scrolls = [];
  const doc = ctx.document, keep = {qa: doc.querySelectorAll, q: doc.querySelector, st: ctx.selectTab, sv: ctx.scheduleSave, ch: X.character, scr: ctx.window.scrollTo};
  let selected = null, saved = 0;
  doc.querySelectorAll = sel => sel === '.tab[data-tab]' ? btns : [];
  doc.querySelector = sel => sel === '.tabpanel.active' ? {id: 'tab-' + active} : null;
  ctx.selectTab = n => { selected = n; active = n; };
  ctx.scheduleSave = () => { saved++; };
  ctx.window.scrollTo = o => { scrolls.push(o); };
  try {
    X.character = X.blankChar(); X.character.hiddenTabs = ['rules'];
    X.applyHiddenTabs();
    ck('#52 applyHiddenTabs hides exactly the listed buttons', btns.filter(b => b.hidden).map(b => b.dataset.tab).join() === 'rules');
    ck('#52 ...and leaves the active tab alone when it is shown', selected === null);
    ck('#52 ...and does not scroll when the active tab stays put', scrolls.length === 0, scrolls);
    X.character.hiddenTabs = ['spells'];
    X.applyHiddenTabs();
    ck('#52 applyHiddenTabs moves off a hidden active tab to the Sheet', selected === 'sheet' && btns.find(b => b.dataset.tab === 'rules').hidden === false, selected);
    ck('#52 ...and scrolls to the top, only in that redirect branch', scrolls.length === 1 && scrolls[0].top === 0, scrolls);
    selected = null; X.setTabHidden('journal', true);
    ck('#52 setTabHidden adds, applies and saves', JSON.stringify(X.character.hiddenTabs) === '["spells","journal"]' && btns.find(b => b.dataset.tab === 'journal').hidden && saved === 1, X.character.hiddenTabs);
    ck('#52 ...and does not scroll again when the active tab was already shown', scrolls.length === 1, scrolls);
    X.setTabHidden('spells', false);
    ck('#52 ...and removes', JSON.stringify(X.character.hiddenTabs) === '["journal"]' && !btns.find(b => b.dataset.tab === 'spells').hidden);
    X.setTabHidden('sheet', true); X.setTabHidden('combat', true);
    ck('#52 ...and refuses sheet and combat', JSON.stringify(X.character.hiddenTabs) === '["journal"]');
  } finally {
    doc.querySelectorAll = keep.qa; doc.querySelector = keep.q; ctx.selectTab = keep.st; ctx.scheduleSave = keep.sv; X.character = keep.ch; ctx.window.scrollTo = keep.scr;
  }
  const sel = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '40-sheet.js'), 'utf8');
  ck('#52 selectTab treats a hidden tab as the Sheet (a guard for stale callers)',
     /function selectTab\(name\)\{\s*(?:\/\*[\s\S]*?\*\/\s*)?if\(isTabHidden\(name\)\)name="sheet";/.test(sel));
  ck('#52 renderAll applies the hidden tabs, so every load and switch does',
     /applyHiddenTabs\(\)/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '66-coins-hp.js'), 'utf8').match(/function renderAll\(\)\{[\s\S]*?\n\}/)[0]));
}

// ---------- #52 hide tabs: ways in, and Settings
{
  const keep = {st: ctx.selectTab, sv: ctx.scheduleSave, toast: ctx.toast, ap: ctx.applyHiddenTabs, ch: X.character, sc: ctx.scrollToCard};
  let selected = [], toasts = [];
  ctx.selectTab = n => { selected.push(n); };
  ctx.scheduleSave = () => {}; ctx.applyHiddenTabs = () => {}; ctx.scrollToCard = () => {};
  ctx.toast = m => { toasts.push(m); };
  try {
    /* Review Focus 4: a note into a hidden tab */
    const key = 'proficiencies';   /* 87-notes.js: {k:"proficiencies", tab:"story"} */
    ck('#52 test setup: the proficiencies note lives on the Bio (story) tab', X.noteDef(key) && X.noteDef(key).tab === 'story', X.noteDef(key));
    X.character = X.blankChar(); X.character.hiddenTabs = ['story', 'rules'];
    X.jumpToNote(key);
    ck('#52 a note into a hidden tab unhides it', JSON.stringify(X.character.hiddenTabs) === '["rules"]', X.character.hiddenTabs);
    ck('#52 ...says so, naming the tab as the bar does', toasts[0] === 'Bio tab shown again; hide it in Settings → Sheet display.', toasts);
    ck('#52 ...and still goes there', selected[selected.length - 1] === 'story', selected);
    toasts = []; X.jumpToNote(key);
    ck('#52 a note into a shown tab says nothing', toasts.length === 0);
  } finally {
    ctx.selectTab = keep.st; ctx.scheduleSave = keep.sv; ctx.toast = keep.toast; ctx.applyHiddenTabs = keep.ap; ctx.scrollToCard = keep.sc; X.character = keep.ch;
  }
  /* Review Focus 5: the swords' way back. cvPrevTab is a top-level let the
     harness can't set, so the source pins the rule. */
  const comb = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '87-combat.js'), 'utf8');
  const leave = comb.match(/function leaveCombatTab\(\)\{[\s\S]*?\n\}/)[0];
  ck('#52 the swords go back to the Sheet when the tab they came from is hidden',
     /const back=\(cvPrevTab&&!isTabHidden\(cvPrevTab\)\)\?cvPrevTab:"sheet";/.test(leave), leave);

  const c = X.blankChar(); c.hiddenTabs = ['rules'];
  const g = X.tabsGroupHTML(c);
  ck('#52 Settings lists the five tabs as switches, by their bar labels',
     ['Spells', 'Inventory', 'Bio', 'Journal', 'Rules'].every(l => g.includes('aria-label="Show the ' + l + ' tab"')) && !/Show the Sheet tab/.test(g), g);
  ck('#52 ...on means shown', /class="switch on" id="swTab-spells"[^>]*aria-checked="true"/.test(g), g);
  ck('#52 ...a hidden tab\'s switch is off', /class="switch " id="swTab-rules"[^>]*aria-checked="false"/.test(g), g);
  ck('#52 ...with the group\'s help, as a <p class="hint"> the way Sources and Loaded data open',
     /^<div class="set-grp"><div class="set-grp-h">Tabs<\/div><p class="hint">Hide the tabs this character doesn't use\. Sheet always shows\.<\/p>/.test(g), g);
  ck('#52 ...before the first switch row', g.indexOf('Hide the tabs this character') < g.indexOf('id="swTab-spells"'), g);
  ck('#52 ...so the Spells row carries no help of its own', /<div class="t-lbl">Spells<\/div><\/div>/.test(g), g);
  ck('#52 ...and the Journal row says it also holds the Section Notes card',
     /<div class="t-lbl">Journal<\/div><div class="t-sub">Also holds the Section Notes card\.<\/div>/.test(g), g);
  ck('#52 ...that help appears on the Journal row only', (g.match(/Also holds the Section Notes card\./g) || []).length === 1, g);
  const set = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '88-settings.js'), 'utf8');
  ck('#52 the display page includes the Tabs group', /tabsGroupHTML\(character\)/.test(set));
  ck('#52 each switch writes through setTabHidden', /\[data-tabsw\][\s\S]{0,300}setTabHidden\(/.test(set));
}

// ---------- #91 initiative: the fields and the pure core
{
  const b = X.blankChar();
  ck('#91 a new character: no party, no fight, Turns, rolls shown',
     JSON.stringify(b.party) === '[]' && JSON.stringify(b.combatants) === '[]' && b.combatTurn === '' && b.initMode === 'turns' && b.initShowRolls === true);
  const P = X.cleanParty([{id: 'p1', name: '  Thorn ', ac: '14', maxHp: 22}, {name: ''}, null, 'x', {name: 'A'.repeat(200), ac: '-2', maxHp: 'lots'}]);
  ck('#91 cleanParty keeps named members, trims, cuts to 60, optional numbers or ""',
     P.length === 2 && P[0].name === 'Thorn' && P[0].ac === 14 && P[0].maxHp === 22 && P[1].name.length === 60 && P[1].ac === '' && P[1].maxHp === '', P);
  /* Review Focus 3 and 4 */
  const C = X.cleanCombatants([{kind: 'you', id: 'y', init: '17'}, {kind: 'you', id: 'y2'}, {kind: 'boss'}, 7,
    {kind: 'foe', id: 'f', name: '<img onerror=1>', init: 19, band: 2, ac: '15'}, {kind: 'party', id: 'p', name: 'Thorn', init: null, maxHp: 22, hp: 9, dead: 'yes'},
    {kind: 'foe', id: 'g', name: 'Wolf', band: 9}], true);
  ck('#91 cleanCombatants: one "you", known kinds only, types forced', C.length === 4 && C.filter(r => r.kind === 'you').length === 1 &&
     C[0].init === 17 && C[1].band === 2 && C[1].ac === 15 && C[1].name === '<img onerror=1>' && C[2].dead === false && C[2].track === 'exact' && C[3].band === null, C);
  ck('#91 ...and out of a fight the list is always empty', X.cleanCombatants([{kind: 'you'}], false).length === 0);
  const m = X.migrate({abilities: {}, combatActive: true, combatants: 'junk', initMode: 'sideways', initShowRolls: 'no', party: [{name: 'Bree'}]});
  ck('#91 migrate cleans the five fields; a fight in progress keeps an empty list',
     JSON.stringify(m.combatants) === '[]' && m.initMode === 'turns' && m.initShowRolls === true && m.party.length === 1 && m.combatTurn === '', m);
  ck('#91 ...a save → load round trip keeps a fight', (() => { const g = X.blankChar(); g.combatActive = true; g.combatRound = 2;
     g.combatants = [{id: 'y', kind: 'you', name: '', init: 12, ac: '', track: '', band: null, hp: '', maxHp: '', dead: false, partyId: ''}]; g.combatTurn = 'y';
     const r = X.migrate(JSON.parse(JSON.stringify(g))); return r.combatants.length === 1 && r.combatTurn === 'y'; })());

  /* sort: stable, unrolled last (Review Focus 5) */
  const S = X.initSort([{id: 'a', init: 10}, {id: 'b', init: null}, {id: 'c', init: 15}, {id: 'd', init: 10}]);
  ck('#91 initSort: highest first, ties keep their order, unrolled last', S.map(r => r.id).join() === 'c,a,d,b', S.map(r => r.id));

  /* next turn (Review Focus 1) */
  const L = [{id: 'f1', kind: 'foe', band: 1}, {id: 'y', kind: 'you'}, {id: 'p', kind: 'party', dead: true}, {id: 'f2', kind: 'foe', band: 4}, {id: 'f3', kind: 'foe', band: null}];
  const nt = (t) => X.initNextTurn(L, t);
  ck('#91 Next skips a dead party member and a dead foe', nt('y').turnId === 'f3' && nt('y').wrapped === false, nt('y'));
  ck('#91 Next wraps past the end, once', nt('f3').turnId === 'f1' && nt('f3').wrapped === true, nt('f3'));
  ck('#91 an unknown actor starts at the first living row without a wrap', nt('gone').turnId === 'f1' && nt('gone').wrapped === false);
  const solo = [{id: 'f', kind: 'foe', band: 4}, {id: 'y', kind: 'you'}];
  ck('#91 everyone else dead: you again, and every Next wraps', X.initNextTurn(solo, 'y').turnId === 'y' && X.initNextTurn(solo, 'y').wrapped === true);
  ck('#91 you are never dead', X.combatantDead({kind: 'you', band: 4, dead: true}) === false);

  /* bands */
  ck('#91 bandOfShare: full Healthy, >½ Injured, ≤½ Bloodied, ≤¼ Near death (0 too), no max → null',
     X.bandOfShare(22, 22) === 0 && X.bandOfShare(12, 22) === 1 && X.bandOfShare(11, 22) === 2 && X.bandOfShare(5, 22) === 3 && X.bandOfShare(0, 22) === 3 && X.bandOfShare(5, '') === null);
  ck('#91 a party member on Exact shows a share; on Estimate their band', (() => {
     const e = X.combatantBar({kind: 'party', track: 'exact', hp: 9, maxHp: 22}); const s = X.combatantBar({kind: 'party', track: 'estimate', band: 1});
     return e.band === 2 && Math.abs(e.share - 9 / 22) < 1e-9 && s.band === 1 && s.share === null; })());

  /* your roll (Review Focus 2) */
  const ok = v => X.initRollCheck(v).ok;
  ck('#91 a typed d20 takes 1..20', ok('1') && ok('20') && ok(' 14 ') && !ok('0') && !ok('21') && !ok('-3') && !ok('2.5') && !ok(''));
  ck('#91 ...saying why', X.initRollCheck('21').why === 'A d20 rolls 1 to 20.' && X.initRollCheck('').why === 'Type the number you rolled.');
  ck('#91 the working: one die, a negative modifier, and advantage',
     X.initRollLine([14], 3) === '14 + 3 = 17' && X.initRollLine([9], -1) === '9 − 1 = 8' && X.initRollLine([6, 14], 3) === 'Rolled 6, 14 → 14 + 3 = 17',
     [X.initRollLine([14], 3), X.initRollLine([9], -1), X.initRollLine([6, 14], 3)]);

  /* building a fight */
  const B = X.buildCombatants({name: 'Mira', init: 17}, [{id: 'p1', name: 'Thorn', ac: 14, maxHp: 22, init: 14}, {id: 'p2', name: 'Bree', ac: '', maxHp: '', init: null}],
    [{name: 'Goblin', count: 2, ac: 13, init: 11}, {name: 'Goblin boss', count: 1, ac: '', init: 19}, {name: '', count: 1, ac: '', init: 5}]);
  ck('#91 buildCombatants: sorted, "× 2" numbered, AC optional, unnamed foes dropped, unrolled last',
     B.map(r => r.name).join('|') === 'Goblin boss|Mira|Thorn|Goblin 1|Goblin 2|Bree' && B[1].kind === 'you' && B[2].track === 'exact' && B[2].hp === 22 && B[5].track === 'estimate' && B[0].ac === '',
     B.map(r => r.name));

  const e = X.blankChar(); e.combatActive = true; e.combatRound = 3; e.combatants = B; e.combatTurn = B[0].id;
  X.combatEnd(e);
  ck('#91 End combat clears the fight', JSON.stringify(e.combatants) === '[]' && e.combatTurn === '');
}

// ---------- #91 the Party card
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rp: ctx.renderParty};
  ctx.scheduleSave = () => {}; ctx.renderParty = () => {};
  try {
    X.character = X.blankChar();
    ck('#91 saving a member needs a name', X.savePartyMember('', '  ', '', '') === 'Give them a name.' && X.character.party.length === 0);
    ck('#91 ...and adds one with optional AC and max HP', X.savePartyMember('', 'Thorn', '14', '') === '' && X.character.party.length === 1 &&
       X.character.party[0].ac === 14 && X.character.party[0].maxHp === '', X.character.party);
    const id = X.character.party[0].id;
    X.savePartyMember(id, 'Thorn the Bold', '', '22');
    ck('#91 ...edits in place by id', X.character.party.length === 1 && X.character.party[0].name === 'Thorn the Bold' && X.character.party[0].ac === '' && X.character.party[0].maxHp === 22);
    const h = X.partyRowsHTML([{id: 'q"1', name: '<b>Bree</b>', ac: '', maxHp: 9}]);
    ck('#91 rows escape, show a blank AC as nothing, and carry #97-hideable edit and remove buttons',
       h.includes('&lt;b&gt;Bree&lt;/b&gt;') && !h.includes('<b>Bree') && !/AC\s*—/.test(h) && /class="icon ed" data-partyedit="q&quot;1"/.test(h) && /class="icon danger ed" data-partydel="q&quot;1"/.test(h), h);
    ck('#91 an empty party says how it works', /Add the friends who fight beside you/.test(X.partyRowsHTML([])));
    X.removePartyMember(id);
    ck('#91 removing takes them off the card', X.character.party.length === 0);
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderParty = keep.rp; }
  ck('#91 the Party card is a registered Bio section that never enters the combat view',
     X.NOTE_SECTIONS.some(s => s.k === 'party' && s.tab === 'story' && s.nocv === true) && X.EDIT_CARDS.indexOf('party') >= 0);
  const html = require('./harness').loadHTML();
  ck('#91 the Bio tab carries the card with its list and add button', /<div class="card" data-note="party">[\s\S]*?id="partyAdd"[\s\S]*?id="partyList"/.test(html));
}

// ---------- #91 Roll initiative and starting a fight
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rc: ctx.renderCombatChrome, ra: ctx.renderActiveSpells, cm: ctx.closeModal};
  ctx.scheduleSave = () => {}; ctx.renderCombatChrome = () => {}; ctx.renderActiveSpells = () => {}; ctx.closeModal = () => {};
  try {
    X.character = X.blankChar(); X.character.name = 'Mira';
    const h = X.initRollHTML([{id: 'p1', name: 'Thorn', ac: 14, maxHp: 22}], false);
    ck('#91 the window lists you with the roll controls, and the party with typed totals',
       /Mira/.test(h) && /id="irRoll"/.test(h) && /id="irTyped"/.test(h) && /id="irApply"/.test(h) && /id="irAdv"/.test(h) && /data-irparty="p1"/.test(h) && /Thorn/.test(h), h);
    ck('#91 ...a foe row and + Add a monster', /data-irfoe/.test(h) && /id="irAddFoe"/.test(h));
    ck('#91 a typed 21 is refused, a 14 kept', X.irSetTyped('21') === 'A d20 rolls 1 to 20.' && X.irState().set === false && X.irSetTyped('14') === '' && X.irState().faces.join() === '14');
    X.startInitFight({name: 'Mira', init: 17}, [{id: 'p1', name: 'Thorn', ac: 14, maxHp: 22, init: 14}], [{name: 'Goblin', count: 2, ac: '', init: 19}]);
    ck('#91 Start: round 1, combat on, sorted, Turns marker on the first living row',
       X.character.combatActive === true && X.num(X.character.combatRound) === 1 && X.character.combatants.map(r => r.name).join() === 'Goblin 1,Goblin 2,Mira,Thorn' &&
       X.character.combatTurn === X.character.combatants[0].id, X.character.combatants.map(r => r.name));
    X.character.combatRound = 4;
    X.startInitFight({name: 'Mira', init: 10}, [], []);
    ck('#91 rolling for a fight already running keeps its round', X.num(X.character.combatRound) === 4 && X.character.combatants.length === 1);
    X.character.initMode = 'rounds'; X.character.combatActive = false;
    X.startInitFight({name: 'Mira', init: 10}, [], []);
    ck('#91 Rounds mode sets no marker', X.character.combatTurn === '');
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderCombatChrome = keep.rc; ctx.renderActiveSpells = keep.ra; ctx.closeModal = keep.cm; }
  const boot = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', '90-boot.js'), 'utf8');
  ck('#91 Start combat opens Roll initiative', /closest\("#cvStart"\)\)return openInitRoll\(\)/.test(boot));
}

// ---------- #91 the strip, Next and the table
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rc: ctx.renderCombatChrome, ar: ctx.advanceRound, live: ctx.setCombatLive, rt: ctx.renderInitTable};
  let rounds = 0, live = '';
  ctx.scheduleSave = () => {}; ctx.renderCombatChrome = () => {}; ctx.renderInitTable = () => {};
  ctx.advanceRound = d => { rounds += d; }; ctx.setCombatLive = t => { live = t; };
  try {
    X.character = X.blankChar(); X.character.name = 'Mira'; X.character.combatActive = true; X.character.combatRound = 1; X.character.hp.max = 30; X.character.hp.cur = 30;
    X.character.combatants = X.buildCombatants({name: 'Mira', init: 17}, [], [{name: '<img onerror=1>', count: 1, ac: 15, init: 19}, {name: 'Wolf', count: 1, ac: '', init: 8}]);
    X.character.combatants[2].band = 4;
    X.character.combatTurn = X.character.combatants[0].id;
    const s = X.initStripHTML(X.character);
    ck('#91 the strip escapes names and marks the actor', s.includes('&lt;img onerror=1&gt;') && !s.includes('<img onerror') && /class="ini-chip now"/.test(s), s);
    ck('#91 ...strikes the dead and shows rolls', /class="ini-chip dead"/.test(s) && />19</.test(s));
    ck('#91 ...a not-set band is a "?" bar; yours is a share', /hb-q/.test(s) && /hb-share/.test(s));
    ck('#91 ...Next and ▾ in Turns mode', /id="cvTurn"/.test(s) && /id="cvInitMore"/.test(s));
    X.character.initShowRolls = false;
    ck('#91 Show rolls off hides the numbers', !/class="ini-n"/.test(X.initStripHTML(X.character)));
    X.character.initShowRolls = true;
    X.initNext();
    ck('#91 Next moves to Mira and announces it', X.character.combatTurn === X.character.combatants[1].id && live === "Mira's turn" && rounds === 0, live);
    X.initNext();
    ck('#91 Next past the end (the Wolf is dead) wraps and advances the round once', X.character.combatTurn === X.character.combatants[0].id && rounds === 1, rounds);
    X.setInitMode('rounds');
    ck('#91 Rounds mode: no marker, no Next', X.character.initMode === 'rounds' && X.character.combatTurn === '' && !/id="cvTurn"/.test(X.initStripHTML(X.character)));
    X.setInitMode('turns');
    ck('#91 back to Turns: the marker on the first living row', X.character.combatTurn === X.character.combatants[0].id);
    const t = X.initTableHTML(X.character);
    ck('#91 the table: a row per combatant, + Add, the mode switch, Show rolls', (t.match(/data-inirow=/g) || []).length === 3 && /id="iniAdd"/.test(t) && /data-inimode="rounds"/.test(t) && /id="iniRolls"/.test(t), t);
    /* fix round 1: the ▾ button must not forget it is open across a repaint */
    X.toggleInitTable();
    ck('#91 ▾ opens: ▴ and aria-expanded="true"', /aria-expanded="true"/.test(X.initStripHTML(X.character)) && />▴</.test(X.initStripHTML(X.character)));
    X.initNext();
    ck('#91 ...a repaint (Next) still says so', /aria-expanded="true"/.test(X.initStripHTML(X.character)) && />▴</.test(X.initStripHTML(X.character)));
    X.toggleInitTable();
    ck('#91 a second toggle closes it', /aria-expanded="false"/.test(X.initStripHTML(X.character)) && />▾</.test(X.initStripHTML(X.character)));
    /* Review Focus 4: a fight with no list */
    X.character.combatants = []; X.character.combatTurn = '';
    ck('#91 a fight with no list offers Roll initiative', /id="iniRollNow"/.test(X.initStripHTML(X.character)));
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderCombatChrome = keep.rc; ctx.advanceRound = keep.ar; ctx.setCombatLive = keep.live; ctx.renderInitTable = keep.rt; }
}

// ---------- #91 the combatant dialog and editing
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rc: ctx.renderCombatChrome, rt: ctx.renderInitTable, cm: ctx.closeModal, ar: ctx.advanceRound};
  let rounds = 0;
  ctx.scheduleSave = () => {}; ctx.renderCombatChrome = () => {}; ctx.renderInitTable = () => {}; ctx.closeModal = () => {}; ctx.advanceRound = d => { rounds += d; };
  try {
    X.character = X.blankChar(); X.character.combatActive = true; X.character.combatRound = 1;
    X.character.combatants = X.buildCombatants({name: 'Mira', init: 12}, [{id: 'p1', name: 'Thorn', ac: '', maxHp: 22, init: 12}], [{name: 'Goblin', count: 1, ac: '', init: 15}]);
    const [gob, mira, thorn] = X.character.combatants;
    X.character.combatTurn = gob.id;
    const foeD = X.combatantDialogHTML(gob, X.character);
    ck('#91 a foe\'s dialog: five band buttons with the DM\'s words, initiative, optional AC, Remove',
       (foeD.match(/data-cband="[0-4]"/g) || []).length === 5 && /barely hurt/.test(foeD) && /id="cdInit"/.test(foeD) && /id="cdAC"/.test(foeD) && /id="cdRemove"/.test(foeD), foeD);
    const pD = X.combatantDialogHTML(thorn, X.character);
    ck('#91 a party member\'s dialog: Exact/Estimate, the HP stepper on Exact, Dead, Remove',
       /data-ctrack="exact"/.test(pD) && /data-ctrack="estimate"/.test(pD) && /id="cdHp"/.test(pD) && /id="cdDead"/.test(pD) && /id="cdRemove"/.test(pD) && !/data-cband/.test(pD), pD);
    const yD = X.combatantDialogHTML(mira, X.character);
    ck('#91 your dialog: initiative only, no Remove, no Dead', /id="cdInit"/.test(yD) && !/id="cdRemove"/.test(yD) && !/id="cdDead"/.test(yD) && /Vitals card/.test(yD));
    ck('#91 a tie shows Act earlier / Act later', /data-cmove="-1"/.test(X.combatantDialogHTML(X.character.combatants[2], X.character)) || /data-cmove="1"/.test(X.combatantDialogHTML(mira, X.character)));

    X.setCombatant(gob.id, {band: 2});
    ck('#91 setting a band', X.character.combatants.find(r => r.id === gob.id).band === 2);
    X.setCombatant(thorn.id, {track: 'estimate'});
    ck('#91 flipping a party member to Estimate', X.character.combatants.find(r => r.id === thorn.id).track === 'estimate');
    X.setCombatant(thorn.id, {hp: 30});
    ck('#91 an exact HP is clamped to 0..max', X.character.combatants.find(r => r.id === thorn.id).hp === 22);

    /* Review Focus 5: ties */
    const order = () => X.character.combatants.map(r => r.name || 'Mira').join();
    ck('#91 test setup: Mira and Thorn tied at 12', order() === 'Goblin,Mira,Thorn', order());
    ck('#91 Act later swaps tied neighbours', X.moveCombatant(mira.id, 1) === true && order() === 'Goblin,Thorn,Mira', order());
    ck('#91 ...but never past a different roll', X.moveCombatant(X.character.combatants[1].id, -1) === false && order() === 'Goblin,Thorn,Mira', order());
    X.setCombatant(gob.id, {init: 5});
    ck('#91 a changed initiative re-sorts and keeps the actor', order() === 'Thorn,Mira,Goblin' && X.character.combatTurn === gob.id, order());

    /* Review Focus 1: remove the actor */
    X.removeCombatant(gob.id);
    ck('#91 removing the actor moves the marker to the next living row', X.character.combatants.length === 2 && X.character.combatTurn === X.character.combatants[0].id);
    ck('#91 T5-M2 ...and, the actor being last, that wraps: the round advances once', rounds === 1, rounds);
    ck('#91 you cannot be removed', (X.removeCombatant(mira.id), X.character.combatants.some(r => r.kind === 'you')));

    ck('#91 adding mid-fight needs a name', X.addCombatant('', '10', '') === 'Give it a name.');
    X.addCombatant('Ogre', '20', '11');
    ck('#91 ...and slots it in by initiative', X.character.combatants[0].name === 'Ogre' && X.character.combatants[0].ac === 11 && X.character.combatants[0].kind === 'foe', order());
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderCombatChrome = keep.rc; ctx.renderInitTable = keep.rt; ctx.closeModal = keep.cm; ctx.advanceRound = keep.ar; }
}

// ---------- #91 the final review's fixes
{
  const keep = {ch: X.character, sv: ctx.scheduleSave, rc: ctx.renderCombatChrome, rt: ctx.renderInitTable, cm: ctx.closeModal, ar: ctx.advanceRound,
    live: ctx.setCombatLive, cvo: ctx.combatViewOpen, qs: ctx.document.querySelector, gid: ctx.document.getElementById, ra: ctx.renderActiveSpells};
  let rounds = 0, live = [];
  ctx.scheduleSave = () => {}; ctx.renderCombatChrome = () => {}; ctx.closeModal = () => {}; ctx.renderActiveSpells = () => {};
  ctx.advanceRound = d => { rounds += d; X.character.combatRound = X.num(X.character.combatRound) + d; };
  ctx.setCombatLive = t => { live.push(t); };
  const fight = (turnIdx) => {
    X.character = X.blankChar(); X.character.name = 'Mira'; X.character.combatActive = true; X.character.combatRound = 1;
    X.character.hp.max = 20; X.character.hp.cur = 20;
    X.character.combatants = X.buildCombatants({name: 'Mira', init: 10}, [{id: 'p1', name: 'Thorn', ac: '', maxHp: 22, init: 8}], [{name: 'Ogre', count: 1, ac: '', init: 20}, {name: 'Wolf', count: 1, ac: '', init: 5}]);
    X.character.combatTurn = X.character.combatants[turnIdx].id;   // Ogre, Mira, Thorn, Wolf
    rounds = 0; live = [];
    return X.character.combatants;
  };
  try {
    /* I1: your chip and row follow your HP, patched in place */
    {
      const mkEl = (key, id) => { const e = {dataset: {[key]: id}, attrs: {}, html: '', cls: '', eq: false,
        isEqualNode() { return this.eq; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
        set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, set className(v) { this.cls = v; }}; return e; };
      const parsed = html => ({set innerHTML(v) { this.src = v; }, get content() { const src = this.src;
        return {firstElementChild: {className: (/class="([^"]*)"/.exec(src) || [])[1], getAttribute: k => ((new RegExp(k + '="([^"]*)"')).exec(src) || [])[1],
          hasAttribute: k => src.indexOf(k + '=') >= 0, innerHTML: src.replace(/^<button[^>]*>|<\/button>$/g, '')}}; }});
      const L0 = fight(0), me = L0.find(r => r.kind === 'you');
      const chip = mkEl('inichip', me.id), other = mkEl('inichip', L0[0].id), row = mkEl('inirow', me.id);
      ctx.combatViewOpen = () => true;
      const qsa = ctx.document.querySelectorAll, ce = ctx.document.createElement;
      ctx.document.querySelectorAll = q => q === '#cvHead [data-inichip]' ? [other, chip] : q === '#cvInitTable [data-inirow]' ? [row] : [];
      ctx.document.createElement = () => parsed();
      X.character.hp.cur = 5; X.renderHP();
      ck('#91 I1 an HP change on the sheet repaints your chip', /HP 5 \/ 20/.test(chip.attrs['aria-label']) && /width:25%/.test(chip.html) && chip.cls === 'ini-chip', [chip.attrs, chip.html]);
      ck('#91 I1 ...and your table row', /HP 5 \/ 20/.test(row.html), row.html);
      ck('#91 I1 ...and nothing else: no other chip is touched', other.html === '' && !('aria-label' in other.attrs));
      chip.html = ''; chip.eq = true; X.renderHP();
      ck('#91 I1 ...a chip that would come out the same is left alone (the blur after a typed HP)', chip.html === '');
      chip.eq = false; X.character.combatActive = false; X.renderHP();
      ck('#91 I1 ...out of a fight it repaints nothing', chip.html === '');
      X.character.combatActive = true; ctx.combatViewOpen = () => false; X.renderHP();
      ck('#91 I1 ...nor with the combat view closed', chip.html === '');
      ctx.document.querySelectorAll = qsa; ctx.document.createElement = ce; ctx.combatViewOpen = keep.cvo;
    }
    ctx.renderInitTable = () => {};

    /* I2: the actor kept in view */
    const box = {left: 0, right: 240};
    ck('#91 I2 an actor past the right edge scrolls into view', X.initChipScroll(0, box, {left: 580, right: 645}) === 413, X.initChipScroll(0, box, {left: 580, right: 645}));
    ck('#91 I2 ...one past the left edge too', X.initChipScroll(400, box, {left: -100, right: -40}) === 292, X.initChipScroll(400, box, {left: -100, right: -40}));
    ck('#91 I2 ...one already in view keeps the scroll', X.initChipScroll(120, box, {left: 30, right: 95}) === 120);
    ck('#91 I2 ...and nobody acting keeps it too', X.initChipScroll(120, box, null) === 120);
    ck('#91 I2 ...never below 0', X.initChipScroll(5, box, {left: -20, right: 40}) === 0);

    /* I3: Start ▸ applies a typed roll */
    {
      let typed = '14';
      ctx.document.getElementById = id => id === 'irTyped' ? {value: typed} : keep.gid(id);
      X.character = X.blankChar(); X.character.name = 'Mira';
      X.irState().set = false; X.irState().faces = [];
      ck('#91 I3 Start without Apply takes the typed roll', X.irStart([]) === '' && X.character.combatants[0].kind === 'you' &&
         X.character.combatants[0].init === 14 + X.initModOf(), X.character.combatants);
      X.character = X.blankChar(); typed = '25'; X.irState().set = false; X.irState().faces = [];
      ck('#91 I3 ...a bad one stops Start, saying why', X.irStart([]) === 'A d20 rolls 1 to 20.' && !X.inCombat(X.character));
      typed = ''; X.irState().set = false;
      ck('#91 I3 ...a blank box still starts, unrolled', X.irStart([]) === '' && X.inCombat(X.character) && X.character.combatants[0].init === null);
      ctx.document.getElementById = keep.gid;
    }
    ck('#91 party rows in Roll initiative are labelled Init', /data-irparty="p1"[^>]*placeholder="Init"/.test(X.initRollHTML([{id: 'p1', name: 'Thorn', ac: '', maxHp: ''}], false)));

    /* T5-M2: a wrap on remove or on dead advances the round once */
    let L = fight(3);
    X.removeCombatant(L[3].id);
    ck('#91 T5-M2 removing the last-placed actor wraps to the top and advances the round once',
       X.character.combatTurn === L[0].id && rounds === 1, [X.character.combatTurn, rounds]);
    L = fight(3);
    X.setCombatant(L[3].id, {band: 4});
    ck('#91 T5-M2 marking the last-placed actor dead does the same', X.character.combatTurn === L[0].id && rounds === 1, [X.character.combatTurn, rounds]);
    L = fight(2);
    X.setCombatant(L[2].id, {dead: true});
    ck('#91 T5-M2 ...a dead party member mid-order moves on without a new round', X.character.combatTurn === L[3].id && rounds === 0, [X.character.combatTurn, rounds]);
    L = fight(0);
    X.removeCombatant(L[0].id);
    ck('#91 T5-M2 ...nor does removing an actor with someone after them', X.character.combatTurn === L[1].id && rounds === 0);

    /* the HP box: clamped, never negative, and shown as stored */
    L = fight(0);
    const th = L.find(r => r.kind === 'party');
    X.setCombatant(th.id, {hp: -4});
    ck('#91 a typed negative HP clamps to 0', th.hp === 0, th.hp);
    {
      const els = {};
      const el = id => els[id] || (els[id] = {id, value: '', dataset: {}, ls: {}, addEventListener(ev, fn) { (this.ls[ev] = this.ls[ev] || []).push(fn); }, focus() { focused = this.sel || this.id; }});
      let focused = '';
      ctx.document.getElementById = el;
      const btn = sel => ({sel, focus() { focused = sel; }});
      ctx.document.querySelector = q => { const m = /^#mBody (.+)$/.exec(q); return m ? btn(m[1]) : null; };
      X.openCombatant(th.id);
      els.cdHp.value = '99'; els.cdHp.ls.change.forEach(f => f());
      ck('#91 the HP box shows the clamped value after a typed over-max', th.hp === 22 && els.cdHp.value === '22', [th.hp, els.cdHp.value]);
      els.cdHp.value = '-3'; els.cdHp.ls.change.forEach(f => f());
      ck('#91 ...and 0 after a typed negative', th.hp === 0 && els.cdHp.value === '0', [th.hp, els.cdHp.value]);
      /* focus goes back to the control that was pressed */
      const click = (attr, val) => { const t = {closest: q => (q === `[${attr}]` || q === `#${attr}`) ? {dataset: val} : null};
        els.mBody.ls.click.forEach(f => f({target: t})); };
      click('data-chp', {chp: '1'});
      ck('#91 after + the dialog reopens with focus on +', focused === '[data-chp="1"]' && th.hp === 1, [focused, th.hp]);
      click('data-ctrack', {ctrack: 'estimate'});
      ck('#91 ...after a track flip, on that track', focused === '[data-ctrack="estimate"]', focused);
      click('cdDead', {});
      ck('#91 ...after Dead, on Dead', focused === '#cdDead', focused);
      ctx.document.getElementById = keep.gid; ctx.document.querySelector = keep.qs;
    }
    ck('#91 the HP box is at least 44px tall', /\.cd-step input\{[^}]*min-height:44px/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'css', '50-modal.css'), 'utf8')));

    /* m1: no marker on a dead row */
    {
      const g = X.blankChar(); g.combatActive = true; g.initMode = 'rounds';
      g.combatants = [{id: 'w', kind: 'foe', name: 'Wolf', init: 15, band: null}, {id: 'y', kind: 'you', name: '', init: 10}];
      ck('#91 m1 migrate sets no marker in Rounds mode', X.migrate(JSON.parse(JSON.stringify(g))).combatTurn === '');
      L = fight(0); X.character.initMode = 'rounds'; X.character.combatTurn = L[0].id; L[0].band = 4;
      X.setInitMode('turns');
      ck('#91 m1 back to Turns: a stored actor that died is not kept', X.character.combatTurn === L[1].id, X.character.combatTurn);
    }

    /* m2: the round is said once, and a wrap says round and turn together */
    {
      L = fight(0); X.character.combatRound = 7; live = [];
      X.renderCombatHeader(); X.renderCombatHeader();
      ck('#91 m2 "Round N" is announced once, not on every repaint', live.filter(t => t === 'Round 7').length === 1, live);
      X.character.combatRound = 8; X.renderCombatHeader();
      ck('#91 m2 ...and again when the round moves', live[live.length - 1] === 'Round 8', live);
      L = fight(3); L[0].band = 4; live = [];
      X.initNext();
      ck('#91 m2 a wrap announces the round and the turn in one message', live[live.length - 1] === "Round 2 — Mira's turn" && rounds === 1, live);
      X.initNext();
      ck('#91 m2 ...a plain Next only the turn', live[live.length - 1] === "Thorn's turn", live);
    }

    /* m3: Exact with no max */
    {
      const p = {kind: 'party', track: 'exact', hp: 7, maxHp: '', band: 1, name: 'Bree'};
      ck('#91 m3 a party member on Exact with no max shows HP n', X.combatantHealthText(p) === 'HP 7', X.combatantHealthText(p));
      L = fight(0); const t = L.find(r => r.kind === 'party'); t.maxHp = ''; t.hp = 7;
      ck('#91 m3 ...and their dialog no "/ ?"', !/\/ \?/.test(X.combatantDialogHTML(t, X.character)));
    }

    /* m4: ids deduped, names never blank */
    {
      const C = X.cleanCombatants([{kind: 'you', id: 'x'}, {kind: 'foe', id: 'x', name: ''}, {kind: 'party', id: 'x', name: null}, {kind: 'foe', id: 'z', name: 'Rat'}], true);
      ck('#91 m4 a repeated id gets a fresh one', C[0].id === 'x' && new Set(C.map(r => r.id)).size === 4, C.map(r => r.id));
      ck('#91 m4 a blank foe is "Unnamed", a blank party member "Party member"', C[1].name === 'Unnamed' && C[2].name === 'Party member' && C[3].name === 'Rat', C.map(r => r.name));
      const P = X.cleanParty([{id: 'q', name: 'A'}, {id: 'q', name: 'B'}]);
      ck('#91 m4 the party roster dedupes ids too', P.length === 2 && P[0].id === 'q' && P[1].id !== 'q', P);
    }

    /* m5: End hands back the fight it cleared, for #105 */
    {
      L = fight(0); const before = L.slice();
      const s = X.combatEnd(X.character);
      ck('#91 m5 combatEnd returns {rounds, sec, combatants}', s.rounds === 1 && s.sec === 6 && s.combatants.length === 4 && s.combatants[0] === before[0] &&
         JSON.stringify(X.character.combatants) === '[]', s);
    }

    /* m9: a name added mid-fight keeps 60 characters */
    L = fight(0);
    X.addCombatant('B'.repeat(70), '3', '');
    ck('#91 m9 Add combatant caps the name at 60', X.character.combatants.some(r => r.name === 'B'.repeat(60)));
  } finally {
    X.character = keep.ch; ctx.scheduleSave = keep.sv; ctx.renderCombatChrome = keep.rc; ctx.renderInitTable = keep.rt; ctx.closeModal = keep.cm;
    ctx.advanceRound = keep.ar; ctx.setCombatLive = keep.live; ctx.combatViewOpen = keep.cvo; ctx.document.querySelector = keep.qs;
    ctx.document.getElementById = keep.gid; ctx.renderActiveSpells = keep.ra;
  }
}

// ---------- #47 the inventory log: fields, maths, undo
{
  const b = X.blankChar();
  ck('#47 a new character: empty log, size 500', JSON.stringify(b.invLog) === '[]' && b.invLogSize === 500);
  const m = X.migrate({abilities: {}, invLogSize: 7, invLog: [{kind: 'add', at: 5, title: 'A'}, {kind: 'bogus', at: 6}, 'x', {kind: 'coins', title: 'no at'}]});
  ck('#47 migrate: a bad size falls back to 500; unknown kinds, junk and entries with no time are dropped',
     m.invLogSize === 500 && m.invLog.length === 1 && m.invLog[0].kind === 'add' && Array.isArray(m.invLog[0].lines) && m.invLog[0].undone === false, m);
  ck('#47 an old save gets an empty log', JSON.stringify(X.migrate({abilities: {}}).invLog) === '[]');

  ck('#47 coins to copper: every denomination', X.coinsToCp({pp: 1, gp: 2, ep: 1, sp: 3, cp: 4}) === 1000 + 200 + 50 + 30 + 4);
  ck('#47 copper as gp text: whole, fractional, zero', X.cpToGpText(5100) === '51 gp' && X.cpToGpText(50) === '0.5 gp' && X.cpToGpText(1234) === '12.34 gp' && X.cpToGpText(0) === '0 gp');
  ck('#47 an item\'s worth is cost × quantity, no cost is 0', X.itemWorthCp({cost: 2}, 3) === 600 && X.itemWorthCp({}, 5) === 0 && X.itemWorthCp({cost: 0.5}, 1) === 50);
  ck('#47 invSame ignores key order', X.invSame({a: 1, b: {c: 2, d: 3}}, {b: {d: 3, c: 2}, a: 1}) && !X.invSame({a: 1}, {a: 2}));

  const keep = {ch: X.character, now: ctx.Date.now};
  try {
    X.character = X.blankChar(); X.character.invLogSize = 100;
    for (let i = 0; i < 105; i++) X.logInv({kind: 'coins', title: 'c' + i, lines: [], undo: null});
    ck('#47 logInv puts the newest first and trims to the size', X.character.invLog.length === 100 && X.character.invLog[0].title === 'c104' && X.character.invLog[99].title === 'c5');
    ck('#47 ...and stamps id, time and undone', typeof X.character.invLog[0].id === 'string' && X.character.invLog[0].at > 0 && X.character.invLog[0].undone === false);

    /* grant batching */
    X.character.invLog = []; let t = 1000; ctx.Date.now = () => t;
    X.logGrant('class:Fighter', {dir: '+', text: 'Chain Mail'}); t += 1000; X.logGrant('class:Fighter', {dir: '+', text: '10 gp'});
    t += 1000; X.logGrant('bg:Acolyte', {dir: '+', text: 'Holy symbol'});
    ck('#47 grants batch per source within 5 s; a new source starts a new line',
       X.character.invLog.length === 2 && X.character.invLog[1].title === 'Granted by Fighter' && X.character.invLog[1].lines.length === 2 && X.character.invLog[0].title === 'Granted by Acolyte' && X.character.invLog[1].undo === null,
       X.character.invLog.map(e => e.title));
    t += 9000; X.logGrant('bg:Acolyte', {dir: '+', text: 'Prayer book'});
    ck('#47 ...and the same source later starts a new line', X.character.invLog.length === 3);
  } finally { X.character = keep.ch; ctx.Date.now = keep.now; }
}

// ---------- #47 undo, kind by kind (Review Focus 1)
{
  const keep = {ch: X.character, rs: ctx.scheduleSave, ri: ctx.renderInventory, ra: ctx.renderAttacks, rc: ctx.renderCoins, rq: ctx.recompute};
  ctx.scheduleSave = () => {}; ctx.renderInventory = () => {}; ctx.renderAttacks = () => {}; ctx.renderCoins = () => {}; ctx.recompute = () => {};
  const fresh = () => { X.character = X.blankChar(); X.character.inventory = []; X.character.attacks = []; X.character.coins = {gp: 10, sp: 0, cp: 0}; };
  const top = () => X.character.invLog[0];
  try {
    /* add: created, then partly used → blocked */
    fresh(); X.character.inventory.push({id: 'p', name: 'Potion', qty: 3});
    X.logInv({kind: 'add', title: 'Added Potion', lines: [{dir: '+', text: 'Potion ×3'}], undo: {items: [{id: 'p', qty: 3, created: true}]}});
    const addE = top();
    X.character.inventory[0].qty = 2;
    ck('#47 undo add refuses once the item was partly used', X.invUndoCheck(addE).ok === false && X.invUndoCheck(addE).why === 'It has since been used, sold or removed.', X.invUndoCheck(addE));
    X.character.inventory[0].qty = 3;
    ck('#47 undo add removes a created item entirely', X.invUndo(addE.id) === '' && X.character.inventory.length === 0 && addE.undone === true && top().title === 'Undid: Added Potion');
    ck('#47 an undone line cannot be undone again', X.invUndoCheck(addE).ok === false);

    /* add onto an existing stack: removes only the added quantity */
    fresh(); X.character.inventory.push({id: 'a', name: 'Arrow', qty: 25});
    X.logInv({kind: 'add', title: 'Added Arrow', lines: [], undo: {items: [{id: 'a', qty: 20, created: false}]}});
    X.invUndo(top().id);
    ck('#47 undo add onto a stack takes back only what was added', X.character.inventory[0].qty === 5);

    /* edit */
    fresh(); const before = {id: 'b', name: 'Backpack', qty: 1}, after = {id: 'b', name: 'Backpack', qty: 2};
    X.character.inventory.push(JSON.parse(JSON.stringify(after)));
    X.logInv({kind: 'edit', title: 'Edited Backpack', lines: [], undo: {before, after}});
    const ed = top(); X.character.inventory[0].qty = 4;
    ck('#47 undo edit refuses after a second edit', X.invUndoCheck(ed).why === 'It has been changed again since.');
    X.character.inventory[0].qty = 2;
    ck('#47 undo edit puts the item back as it was', X.invUndo(ed.id) === '' && X.character.inventory[0].qty === 1);

    /* delete, with its linked attack */
    fresh();
    X.logInv({kind: 'delete', title: 'Deleted Dagger', lines: [], undo: {snap: {id: 'd', name: 'Dagger', qty: 1, weapon: {dice: '1d4'}}, at: 0, atk: {id: 'k', name: 'Dagger', itemId: 'd'}}});
    ck('#47 undo delete always works and brings its attack back', X.invUndo(top().id) === '' && X.character.inventory[0].name === 'Dagger' && X.character.attacks.some(a => a.itemId === X.character.inventory[0].id));

    /* use (plan-level choice: always clean, even for the last one) */
    fresh();
    X.logInv({kind: 'use', title: 'Used Healing Potion', lines: [], undo: {id: 'h', qty: 1, used: 0, snap: {id: 'h', name: 'Healing Potion', qty: 1}}});
    ck('#47 undo use of the last one puts it back', X.invUndo(top().id) === '' && X.character.inventory.length === 1 && X.character.inventory[0].qty === 1);
    fresh(); X.character.inventory.push({id: 'w', name: 'Wand', qty: 1, uses: {max: 3, used: 2}});
    X.logInv({kind: 'use', title: 'Used Wand', lines: [], undo: {id: 'w', qty: 0, used: 1, snap: null}});
    X.invUndo(top().id);
    ck('#47 undo use gives a use back', X.character.inventory[0].uses.used === 1);

    /* coins */
    fresh();
    X.logInv({kind: 'coins', title: 'Coins adjusted', lines: [], undo: {delta: {gp: 15}}});
    const co = top(); X.character.coins.gp = 10;
    ck('#47 undo coins refuses when the gold has been spent', X.invUndoCheck(co).ok === false && /Not enough GP left to take back\./.test(X.invUndoCheck(co).why), X.invUndoCheck(co));
    X.character.coins.gp = 30;
    ck('#47 undo coins applies the opposite change', X.invUndo(co.id) === '' && X.character.coins.gp === 15);

    /* grant and ammo: never */
    X.logInv({kind: 'grant', title: 'Granted by Fighter', lines: [], undo: null});
    ck('#47 grants have no undo', X.invUndoCheck(top()).ok === false && X.invUndoCheck(top()).why === '');
    ck('#47 an unknown id is refused', X.invUndo('nope') !== '');
  } finally { X.character = keep.ch; ctx.scheduleSave = keep.rs; ctx.renderInventory = keep.ri; ctx.renderAttacks = keep.ra; ctx.renderCoins = keep.rc; ctx.recompute = keep.rq; }
}

// ---------- #47 one change, one line
{
  const keep = {ch: X.character, rules: X.rules, rs: ctx.scheduleSave, ri: ctx.renderInventory, ra: ctx.renderAttacks, rc: ctx.renderCoins, rq: ctx.recompute, rsum: ctx.restSummary, rst: ctx.renderStatuses};
  ['scheduleSave', 'renderInventory', 'renderAttacks', 'renderCoins', 'recompute', 'restSummary', 'renderStatuses'].forEach(n => ctx[n] = () => {});
  try {
    X.character = X.blankChar(); X.character.inventory = []; X.character.attacks = [];
    X.rules = Object.assign({}, X.rules, {items: [{name: 'Rope', cost: '1 gp'}, {name: 'Healing Potion', cost: '50 gp'}]});
    const did = X.addLibraryItems([{name: 'Rope', cost: '1 gp'}], null, null, 2);
    ck('#47 addLibraryItems says what it did', did.length === 1 && did[0].qty === 2 && did[0].created === true, did);
    const did2 = X.addLibraryItems([{name: 'Rope', cost: '1 gp'}], null, null, 1);
    ck('#47 ...stacking reports created:false', did2[0].created === false && did2[0].id === did[0].id);
    ck('#47 addLibraryItems itself writes no line (its caller does)', X.character.invLog.length === 0);

    const src = n => require('fs').readFileSync(require('path').join(__dirname, '..', 'js', n), 'utf8');
    ck('#47 the finder\'s onAdd logs one add line', /onAdd:\(entries,og,costOverride,qty\)=>\{const did=addLibraryItems\([^)]*\);logFinderAdd\(did/.test(src('85-browse.js')));
    ck('#47 the item form logs add or edit, and nothing for an unchanged save', /logItemSave\(/.test(src('80-modal-forms.js')));
    ck('#47 the row delete logs one delete line', /data-del-item[\s\S]{0,1400}logInv\(\{kind:"delete"/.test(src('90-boot.js')));

    /* Use */
    X.character.inventory = [{id: 'h', name: 'Healing Potion', qty: 1, use: {consume: true}}];
    X.applyItemUse(X.character.inventory[0], {consume: true}, 0, '');
    ck('#47 Use writes one line, keeping a copy of the last one', X.character.invLog.length === 1 && X.character.invLog[0].kind === 'use' && X.character.invLog[0].undo.snap.name === 'Healing Potion');

    /* coins */
    X.character.invLog = []; X.character.coins = {gp: 5};
    const inp = {dataset: {coin: 'gp'}, value: '+10'}; X.applyCoinInput(inp);
    ck('#47 a coin field commit writes one coins line with the change', X.character.invLog.length === 1 && X.character.invLog[0].undo.delta.gp === 10);
    inp.value = '15'; X.applyCoinInput(inp);
    ck('#47 ...an unchanged commit writes nothing', X.character.invLog.length === 1);
    X.character.coins = {gp: 0, sp: 25, cp: 0}; X.character.system = 'humblewood'; X.convertCoins();
    ck('#47 Convert writes one re-denomination line', X.character.invLog[0].kind === 'coins' && /Converted/.test(X.character.invLog[0].title) && X.character.invLog[0].undo.delta.gp === 2 && X.character.invLog[0].undo.delta.sp === -20);

    /* grants: one line per source */
    X.character.invLog = [];
    X.grantItemByName('Rope', 1, 'class:Fighter'); X.grantItemByName('Healing Potion', 1, 'class:Fighter');
    ck('#47 a source\'s grants share one line', X.character.invLog.length === 1 && X.character.invLog[0].lines.length === 2 && X.character.invLog[0].title === 'Granted by Fighter');

    /* ammo per fight */
    X.character.ammoSpent = {s1: {n: 12, kind: 'arrow', snap: {id: 's1', name: 'Arrow'}}};
    const sum = X.ammoFightSummary(X.character);
    ck('#47 ammoFightSummary totals what was fired per kind', sum.length === 1 && sum[0].kind === 'arrow' && sum[0].fired === 12, sum);
    ck('#47 End combat logs one ammo line per kind fired', /ammoFightTotals\(character\)[\s\S]{0,400}logInv\(\{kind:"ammo"/.test(src('87-combat.js')));
  } finally { Object.assign(ctx, {scheduleSave: keep.rs, renderInventory: keep.ri, renderAttacks: keep.ra, renderCoins: keep.rc, recompute: keep.rq, restSummary: keep.rsum, renderStatuses: keep.rst}); X.character = keep.ch; X.rules = keep.rules; }
}

// ---------- #47 the Log dialog
{
  const L = [
    {id: 'a', at: Date.now(), kind: 'trade', title: 'Traded with <b>Olvin</b>', lines: [{dir: '-', text: 'Dagger ×1'}, {dir: '+', text: 'Rope ×1'}], undo: {parts: []}, undone: false, meta: {with: '<b>Olvin</b>'}},
    {id: 'b', at: Date.now() - 1000, kind: 'grant', title: 'Granted by Fighter', lines: [{dir: '+', text: 'Chain Mail ×1'}], undo: null, undone: false, meta: {}},
    {id: 'c', at: Date.now() - 2000, kind: 'coins', title: 'Coins adjusted', lines: [{dir: '+', text: '+15 GP'}], undo: {delta: {gp: 15}}, undone: true, meta: {}}
  ];
  const keep = X.character; X.character = X.blankChar(); X.character.invLog = L; X.character.coins = {gp: 100};
  try {
    const h = X.invLogHTML(L, 'all', 500);
    ck('#47 the log escapes titles and receipts', h.includes('Traded with &lt;b&gt;Olvin&lt;/b&gt;') && !h.includes('<b>Olvin'));
    ck('#47 ...offers Undo only where allowed; a grant has none', /data-invundo="a"/.test(h) && !/data-invundo="b"/.test(h));
    ck('#47 ...strikes an undone line and offers it no Undo', /class="il-e undone"[^>]*data-ilid="c"/.test(h) && !/data-invundo="c"/.test(h));
    ck('#47 ...groups by day with Today first', /Today/.test(h));
    ck('#47 ...shows the size and Clear log', /Keeps the newest 500/.test(h) && /id="invLogClear"/.test(h));
    ck('#47 ...a filter narrows it', !/Coins adjusted/.test(X.invLogHTML(L, 'trades', 500)) && /Traded with/.test(X.invLogHTML(L, 'trades', 500)));
    X.character.coins = {gp: 0}; L[2].undone = false;
    const h2 = X.invLogHTML(L, 'all', 500);
    ck('#47 a blocked Undo is disabled with its reason', /data-invundo="c" disabled title="Not enough GP left to take back\."/.test(h2), h2);
  } finally { X.character = keep; }
  const html = require('./harness').loadHTML();
  ck('#47 the Equipment card has Trade and Log beside Add', /data-add="item"[\s\S]{0,400}id="btnTrade"[\s\S]{0,400}id="btnInvLog"/.test(html));
}

// ---------- #47 the trade window
{
  const keep = {ch: X.character, rules: X.rules, rs: ctx.scheduleSave, ri: ctx.renderInventory, ra: ctx.renderAttacks, rc: ctx.renderCoins, rq: ctx.recompute};
  ['scheduleSave', 'renderInventory', 'renderAttacks', 'renderCoins', 'recompute'].forEach(n => ctx[n] = () => {});
  try {
    X.character = X.blankChar(); X.character.system = 'dnd'; X.character.attacks = [];
    X.character.inventory = [{id: 'dg', name: 'Dagger', qty: 1, cost: 2, weapon: {dice: '1d4'}}, {id: 'ro', name: 'Rope', qty: 2, cost: 1}];
    X.character.coins = {gp: 40, sp: 0, cp: 0};
    const d = X.newTradeDraft({with: 'Olvin <i>'});
    d.give.items = [{id: 'dg', qty: 1}]; d.give.coins = {gp: 30};
    d.get.items = [{key: 'k1', name: 'Healing Potion', qty: 1, cost: 50, def: {name: 'Healing Potion', cost: '50 gp'}, custom: false},
      {key: 'k2', name: 'Rope', qty: 1, cost: 1, def: {name: 'Rope', cost: '1 gp'}, custom: false}, {key: 'k3', name: 'Lucky coin', qty: 1, cost: 0, def: null, custom: true}];
    let b = X.tradeBalance(d, X.character);
    ck('#47 balance: coins plus item value on both sides', b.giveCp === 3200 && b.getCp === 5100 && b.diff === -1900, b);
    d.applyGive = false; b = X.tradeBalance(d, X.character);
    ck('#47 ...the give switch off drops the Dagger\'s 2 gp', b.giveCp === 3000 && b.diff === -2100);
    d.applyGet = false; b = X.tradeBalance(d, X.character);
    ck('#47 ...the get switch off drops the items\' cost (a gift)', b.getCp === 0 && b.diff === 3000);
    d.applyGive = true; d.applyGet = true;
    const h = X.tradeHTML(d, X.character);
    ck('#47 the window escapes "With" and shows the shortfall in red', h.includes('Olvin &lt;i&gt;') && /class="tr-bal short"/.test(h) && /19 gp short/.test(h), h);
    ck('#47 ...both switches, the tabs, and a ✓ button labelled for screen readers',
       /id="trApplyGive"[^>]*aria-checked="true"/.test(h) && /id="trApplyGet"/.test(h) && /data-trtab="give"/.test(h) && /id="trComplete"[^>]*aria-label="Complete trade"/.test(h) && /class="tr-done-lbl">Complete Trade</.test(h));
    ck('#47 ...giving is capped at what you own', /data-trgive="dg"[^>]*data-max="1"/.test(h) && /data-trcoin="give:gp"[^>]*max="40"/.test(h));
    /* complete, then undo (Review Focus 2) */
    const before = JSON.stringify({inv: X.character.inventory, coins: X.character.coins});
    const e = X.completeTrade(d);
    ck('#47 Complete: the Dagger and 30 gp leave; the Potion, a Rope (stacking on yours) and a custom Lucky coin arrive',
       !X.character.inventory.some(i => i.id === 'dg') && X.character.coins.gp === 10 && X.character.inventory.some(i => i.name === 'Healing Potion') &&
       X.character.inventory.find(i => i.name === 'Rope').qty === 3 && X.character.inventory.find(i => i.name === 'Lucky coin').origin.kind === 'custom', X.character.inventory);
    ck('#47 ...one trade line, nothing else', X.character.invLog.length === 1 && X.character.invLog[0].kind === 'trade' && X.character.invLog[0].meta.with === 'Olvin <i>' && X.character.invLog[0].meta.applyGive === true);
    ck('#47 undo the trade: everything back as it was', X.invUndo(e.id) === '' &&
       JSON.stringify({inv: X.character.inventory.map(i => ({n: i.name, q: i.qty})).sort((a, b) => a.n < b.n ? -1 : 1), coins: X.character.coins.gp}) ===
       JSON.stringify({inv: JSON.parse(before).inv.map(i => ({n: i.name, q: i.qty})).sort((a, b) => a.n < b.n ? -1 : 1), coins: 40}), X.character.inventory);
    ck('#47 an empty trade cannot complete', X.completeTrade(X.newTradeDraft({})) === null);
  } finally { Object.assign(ctx, {scheduleSave: keep.rs, renderInventory: keep.ri, renderAttacks: keep.ra, renderCoins: keep.rc, recompute: keep.rq}); X.character = keep.ch; X.rules = keep.rules; }
  /* Review Focus 2, as named: a whole stack given AND a same-named item received.
     Undo must restore the given row (same id, same place, its attack) and take
     back the new row, leaving items, attacks and coins exactly as before. */
  {
    const keep2 = {ch: X.character, rs: ctx.scheduleSave, ri: ctx.renderInventory, ra: ctx.renderAttacks, rc: ctx.renderCoins, rq: ctx.recompute};
    ['scheduleSave', 'renderInventory', 'renderAttacks', 'renderCoins', 'recompute'].forEach(n => ctx[n] = () => {});
    try {
      const seed = () => {
        X.character = X.blankChar(); X.character.system = 'dnd';
        X.character.attacks = [{id: 'a1', name: 'Dagger', itemId: 'dg'}];
        X.character.inventory = [{id: 'dg', name: 'Dagger', qty: 1, cost: 2, weapon: {dice: '1d4'}, attackId: 'a1'}, {id: 'ro', name: 'Rope', qty: 2, cost: 1}, {id: 'tc', name: 'Torch', qty: 5, cost: 0.01}];
        X.character.coins = {gp: 40, sp: 0, cp: 0};
        return JSON.stringify({inv: X.character.inventory, atk: X.character.attacks, coins: X.character.coins});
      };
      const now = () => JSON.stringify({inv: X.character.inventory, atk: X.character.attacks, coins: X.character.coins});
      /* case A: the whole Rope stack given, a library Rope received */
      let before = seed(), d = X.newTradeDraft({with: 'Olvin'});
      d.give.items = [{id: 'ro', qty: 2}];
      d.get.items = [{key: 'k', name: 'Rope', qty: 1, cost: 1, def: {name: 'Rope', cost: '1 gp'}, custom: false}];
      let e = X.completeTrade(d);
      ck('#47 case A (whole Rope given, a Rope received): the old row leaves, a new Rope row arrives, one trade line',
         !X.character.inventory.some(i => i.id === 'ro') && X.character.inventory.filter(i => i.name === 'Rope').length === 1 &&
         X.character.invLog.length === 1 && X.character.invLog[0].kind === 'trade', X.character.inventory);
      ck('#47 ...undo restores items, order, attacks and coins exactly', X.invUndo(e.id) === '' && now() === before, now());
      /* case D: the whole Dagger (with its attack) given, a Dagger received, plus 5 gp */
      before = seed(); d = X.newTradeDraft({with: 'Olvin'});
      d.give.items = [{id: 'dg', qty: 1}]; d.give.coins = {gp: 5};
      d.get.items = [{key: 'k', name: 'Dagger', qty: 1, cost: 2, def: {name: 'Dagger', cost: '2 gp', weapon: {dice: '1d4'}}, custom: false}];
      e = X.completeTrade(d);
      ck('#47 case D (whole Dagger + attack given, a Dagger received): one trade line, the new Dagger has its own attack',
         X.character.invLog.length === 1 && X.character.invLog[0].kind === 'trade' && !X.character.attacks.some(a => a.id === 'a1') &&
         X.character.attacks.length === 1 && X.character.inventory.some(i => i.name === 'Dagger' && i.id !== 'dg') && X.character.coins.gp === 35, X.character);
      ck('#47 ...undo restores items, order, attacks and coins exactly', X.invUndo(e.id) === '' && now() === before, now());
      /* two whole rows given: each goes back to its own place */
      before = seed(); d = X.newTradeDraft({});
      d.give.items = [{id: 'dg', qty: 1}, {id: 'ro', qty: 2}];
      e = X.completeTrade(d);
      ck('#47 two whole rows given and undone come back in their order', X.invUndo(e.id) === '' && now() === before, now());
      /* delete and use undo reinsert at the row's place too */
      before = seed();
      const ro = X.character.inventory[1]; X.character.inventory.splice(1, 1);
      const de = X.logInv({kind: 'delete', title: 'Deleted Rope', lines: [], undo: {snap: X.invSnap(ro), at: 1, atk: null}});
      ck('#47 undo delete puts the row back where it was', X.invUndo(de.id) === '' && X.character.inventory.map(i => i.id).join() === 'dg,ro,tc', X.character.inventory);
      const dg = X.character.inventory[0], atk = X.character.attacks[0];
      X.character.inventory.splice(0, 1); X.character.attacks = [];
      const ue = X.logInv({kind: 'use', title: 'Used Dagger', lines: [], undo: {id: 'dg', qty: 1, used: 0, snap: X.invSnap(dg), atk: X.invSnap(atk), at: 0}});
      ck('#47 undo use of the last one puts the row back where it was', X.invUndo(ue.id) === '' && X.character.inventory.map(i => i.id).join() === 'dg,ro,tc' && now() === before, now());
      /* a seeded draft (#105) is clamped to what you hold */
      seed();
      d = X.newTradeDraft({give: {items: [{id: 'ro', qty: 9}, {id: 'gone', qty: 1}], coins: {gp: 99, sp: 2.7}}});
      ck('#47 a seeded draft gives no more than you hold', d.give.items.length === 1 && d.give.items[0].qty === 2 && d.give.coins.gp === 40 && d.give.coins.sp === 0, d.give);
      ck('#47 ...so its balance is what Complete applies', X.tradeBalance(d, X.character).giveCp === 4200);
      /* hostile names are escaped: a give item, a library get item, a custom name in its box */
      seed();
      X.character.inventory[1].name = 'Rope"><img src=x onerror=alert(1)>';
      d = X.newTradeDraft({});
      d.give.items = [{id: 'ro', qty: 1}];
      d.get.items = [{key: 'k1', name: 'Potion<script>x</script>', qty: 1, cost: 50, def: {name: 'Potion<script>x</script>'}, custom: false},
        {key: 'k9', name: 'Lucky "coin" <b>', qty: 1, cost: 0, def: null, custom: true}];
      const hh = X.tradeHTML(d, X.character);
      ck('#47 the window escapes a give item\'s name', hh.includes('Rope&quot;&gt;&lt;img src=x onerror=alert(1)&gt;') && !hh.includes('<img'), hh);
      ck('#47 ...a library item\'s name', hh.includes('Potion&lt;script&gt;x&lt;/script&gt;') && !hh.includes('<script'));
      ck('#47 ...and a custom name inside its box', /data-trname="k9" value="Lucky &quot;coin&quot; &lt;b&gt;"/.test(hh) && !hh.includes('"coin"'));
      ck('#47 the tabs control their panels', /id="trTabGive" aria-controls="trSideGive"/.test(hh) && /id="trSideGive" role="tabpanel" aria-labelledby="trTabGive"/.test(hh) &&
         /id="trTabGet" aria-controls="trSideGet"/.test(hh) && /id="trSideGet" role="tabpanel" aria-labelledby="trTabGet"/.test(hh));
    } finally { Object.assign(ctx, {scheduleSave: keep2.rs, renderInventory: keep2.ri, renderAttacks: keep2.ra, renderCoins: keep2.rc, recompute: keep2.rq}); X.character = keep2.ch; }
  }
  const src = n => require('fs').readFileSync(require('path').join(__dirname, '..', 'js', n), 'utf8');
  ck('#47 the Trade button opens the trade window', /t\.closest\("#btnTrade"\)\)return openTrade\(\{\}\)/.test(src('90-boot.js')));
  ck('#47 the picker reads a fractional Cost override (0.5 gp is not 0)', /costOverride=\(oc&&oc\.value!==""\)\?Math\.max\(0,fnum\(oc\.value\)\)/.test(src('85-browse.js')));
  ck('#47 a coin box shows the whole number the draft holds', /if\(t\.value!==""&&t\.value!==String\(v\)\)t\.value=String\(v\)/.test(src('67-trade.js')));
  ck('#47 a merged finder add keeps its Cost override', /if\(ex\)\{ex\.qty=[^}]*if\(costOverride!=null\)ex\.cost=costOverride;return;\}/.test(src('67-trade.js')));
  /* "Use records where the row stood" now holds for every Use: the final-review K1 check below */
  ck('#47 the picker calls cfg.onClose only when it closes without adding', /#brClose"\)\)\{closeBrowse\(\);if\(cfg\.onClose\)cfg\.onClose\(\);/.test(src('85-browse.js')));
}


// ---------- #47 final review fixes (K1, I1, I2, C1, C4, C5, M1-M9)
{
  const fs = require('fs'), path = require('path');
  const src = n => fs.readFileSync(path.join(__dirname, '..', 'js', n), 'utf8');
  const css = n => fs.readFileSync(path.join(__dirname, '..', 'css', n), 'utf8');
  const STUB = ['scheduleSave', 'renderInventory', 'renderAttacks', 'renderCoins', 'recompute', 'restSummary', 'renderStatuses', 'renderHP',
    'renderActiveSpells', 'renderCombatChrome', 'setCombatLive', 'toast', 'openModal', 'closeModal'];
  const keep = {ch: X.character, rules: X.rules, conf: state.confirm, gid: ctx.document.getElementById};
  STUB.forEach(n => { keep[n] = ctx[n]; ctx[n] = () => null; });
  const fresh = () => { X.character = X.blankChar(); X.character.system = 'dnd'; X.character.inventory = []; X.character.attacks = []; X.character.coins = {gp: 40, sp: 0, cp: 0}; return X.character; };
  const top = () => X.character.invLog[0];
  const undids = () => X.character.invLog.filter(e => /^Undid:/.test(e.title)).length;
  try {
    /* ---- K1: an undo never reports success while restoring nothing ---- */
    fresh(); X.character.inventory = [{id: 'p', name: 'Potion', qty: 2, use: {consume: true}}];
    X.applyItemUse(X.character.inventory[0], {consume: true}, 0, '');
    const useA = top();
    X.character.inventory = [];   /* the other potion deleted */
    ck('#47 K1 case A: use 1 of 2 potions, delete the other, undo the Use: one potion back',
       X.invUndoCheck(useA).ok === true && X.invUndo(useA.id) === '' && X.character.inventory.length === 1 &&
       X.character.inventory[0].name === 'Potion' && X.character.inventory[0].qty === 1 && useA.undone === true, X.character.inventory);

    fresh(); X.character.coins = {gp: 0, sp: 0, cp: 0};
    X.character.inventory = [{id: 'bow', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
      {id: 'ar', name: 'Arrow', qty: 5, cost: 0.05, ammo: {kind: 'arrow'}}];
    let d = X.newTradeDraft({with: 'Olvin'}); d.give.items = [{id: 'ar', qty: 2}]; d.get.coins = {sp: 1};
    const tB = X.completeTrade(d);
    for (let i = 0; i < 3; i++) X.fireAmmo(X.character, X.character.inventory[0]);
    ck('#47 K1 case B: the other 3 arrows fired to zero, so the row is gone', !X.character.inventory.some(i => i.id === 'ar') && X.character.coins.sp === 1);
    ck('#47 K1 case B: undo the trade: 2 arrows back and the 1 sp returned',
       X.invUndo(tB.id) === '' && (X.character.inventory.find(i => i.name === 'Arrow') || {}).qty === 2 && X.character.coins.sp === 0 && tB.undone === true,
       [X.character.inventory, X.character.coins]);
    ck('#47 K1 ...the arrows come back where the row stood', X.character.inventory.map(i => i.name).join() === 'Longbow,Arrow');

    /* two records of one line that stacked onto one row are checked together */
    fresh(); X.character.inventory = [{id: 'ar', name: 'Arrow', qty: 3}];
    const twoAdds = X.logInv({kind: 'trade', title: 'Traded with Olvin', lines: [], undo: {parts: [{kind: 'add', u: {items: [{id: 'ar', qty: 2, created: true}, {id: 'ar', qty: 2, created: false}]}}]}});
    ck('#47 re-review: 2+2 arrows received onto one row, one since used: the undo is refused, nothing taken',
       X.invUndoCheck(twoAdds).ok === false && X.invUndo(twoAdds.id) !== '' && X.character.inventory[0].qty === 3 && !twoAdds.undone);
    X.character.inventory[0].qty = 4;
    ck('#47 re-review: ...with all 4 still held, it undoes and removes the row',
       X.invUndo(twoAdds.id) === '' && X.character.inventory.length === 0, X.character.inventory);

    /* an old line, with no copy kept, whose row is gone: refused, never marked */
    fresh();
    const oldUse = X.logInv({kind: 'use', title: 'Used Potion', lines: [], undo: {id: 'gone', qty: 1, used: 0, snap: null}});
    const before = X.character.invLog.length;
    const ch = X.invUndoCheck(oldUse);
    ck('#47 K1 an old Use line with no row and no copy is refused, with a reason', ch.ok === false && ch.why === 'It is no longer in your inventory.', ch);
    ck('#47 K1 ...invUndo restores nothing, leaves it not undone, writes no "Undid:" line',
       X.invUndo(oldUse.id) !== '' && oldUse.undone === false && X.character.invLog.length === before && undids() === 0 && X.character.inventory.length === 0);
    fresh();
    const oldTrade = X.logInv({kind: 'trade', title: 'Traded', lines: [], undo: {parts: [{kind: 'give', u: {items: [{id: 'gone', qty: 2, snap: null, name: 'Arrow'}]}}, {kind: 'add', u: {items: []}}, {kind: 'coins', u: {delta: {sp: 1}}}]}});
    X.character.coins.sp = 1;
    const ct = X.invUndoCheck(oldTrade);
    ck('#47 K1 an old trade whose given row is gone and has no copy is refused, naming the item', ct.ok === false && /Arrow/.test(ct.why), ct);
    ck('#47 K1 ...and nothing of it is applied: the sp stays, no "Undid:" line', X.invUndo(oldTrade.id) !== '' && X.character.coins.sp === 1 && oldTrade.undone === false && undids() === 0);
    ck('#47 K1 Use always keeps a copy of the item, its attack and its place', /undo:\{id:it\.id,[^}]*snap:snap0,atk:atk0,at:at0/.test(src('80-modal-forms.js')));

    /* ---- M3: a granted item whose source is gone comes back as an ordinary item ---- */
    fresh(); X.character.classes = [];
    X.character.inventory = [{id: 'g', name: 'Rope', qty: 2, grant: 'class:Fighter'}];
    d = X.newTradeDraft({}); d.give.items = [{id: 'g', qty: 2}]; d.get.coins = {gp: 1};
    const tG = X.completeTrade(d);
    X.invUndo(tG.id);
    const rope = X.character.inventory.find(i => i.name === 'Rope');
    ck('#47 M3 undoing a trade of a granted Rope after the class is gone: the Rope is ordinary, its origin kept',
       rope && rope.qty === 2 && !('grant' in rope) && rope.origin && rope.origin.kind === 'class' && rope.origin.detail === 'Fighter', rope);
    fresh(); X.character.classes = [{name: 'Fighter', level: 1}];
    X.character.inventory = [{id: 'g', name: 'Rope', qty: 2, grant: 'class:Fighter'}];
    d = X.newTradeDraft({}); d.give.items = [{id: 'g', qty: 2}];
    X.invUndo(X.completeTrade(d).id);
    ck('#47 M3 ...while the class is still there, it keeps its grant', X.character.inventory[0].grant === 'class:Fighter');

    /* ---- M6: a restored attack goes back at its own index ---- */
    fresh();
    X.character.attacks = [{id: 'a0', name: 'Unarmed'}, {id: 'a1', name: 'Dagger', itemId: 'dg'}, {id: 'a2', name: 'Fire Bolt'}];
    X.character.inventory = [{id: 'dg', name: 'Dagger', qty: 1, cost: 2, weapon: {dice: '1d4'}, attackId: 'a1'}];
    d = X.newTradeDraft({}); d.give.items = [{id: 'dg', qty: 1}];
    X.invUndo(X.completeTrade(d).id);
    ck('#47 M6 undo puts the Dagger\'s attack back in its place', X.character.attacks.map(a => a.id).join() === 'a0,a1,a2', X.character.attacks);

    /* ---- M4: a Use that changes no inventory writes no line ---- */
    fresh(); X.character.hp = {cur: 5, max: 20, temp: 0};
    X.character.inventory = [{id: 'h', name: 'Herb', qty: 1, use: {heal: '2'}}];
    X.applyItemUse(X.character.inventory[0], {heal: '2'}, 2, '');
    ck('#47 M4 a heal-only Use writes no line', X.character.invLog.length === 0);

    /* ---- M9: the Use line says what is left ---- */
    fresh(); X.character.inventory = [{id: 'p', name: 'Potion', qty: 3, use: {consume: true}}];
    X.applyItemUse(X.character.inventory[0], {consume: true}, 0, '');
    ck('#47 M9 the Use line says what is left', top().lines.length === 1 && top().lines[0].text === '−1 · 2 left' && top().lines[0].dir === '-', top().lines);
    fresh(); X.character.inventory = [{id: 'w', name: 'Wand', qty: 1, uses: {max: 3, used: 0, per: 'long'}}];
    X.applyItemUse(X.character.inventory[0], {}, 0, '');
    ck('#47 M9 ...and for uses, how many uses are left', top().lines[0].text === '1 use · 2 of 3 left', top().lines);

    /* ---- M5: worth multiplies before rounding ---- */
    ck('#47 M5 20 sling bullets at 0.002 gp are worth 4 cp', X.itemWorthCp({cost: 0.002}, 20) === 4);
    ck('#47 M5 ...and a got item at 0.002 gp ×20 is too', ctx.tradeGetCp({cost: 0.002, qty: 20}) === 4);

    /* ---- M2: a malformed undo is dropped, the line kept; invUndoCheck never throws ---- */
    const m = X.migrate({abilities: {}, invLog: [
      {kind: 'edit', at: 9, title: 'e', undo: {}},
      {kind: 'trade', at: 8, title: 't', undo: {parts: [{kind: 'add'}]}},
      {kind: 'use', at: 7, title: 'u', undo: {qty: 1}},
      {kind: 'delete', at: 6, title: 'd', undo: {snap: 'x'}},
      {kind: 'coins', at: 5, title: 'c', undo: {delta: 'x'}},
      {kind: 'add', at: 4, title: 'a', undo: {items: [{qty: 1}]}},
      {kind: 'coins', at: 3, title: 'ok', undo: {delta: {gp: 1}}},
      {kind: 'grant', at: 2, title: 'g', undo: {delta: {gp: 1}}}]});
    ck('#47 M2 a malformed undo is dropped and its line kept', m.invLog.length === 8 && m.invLog.slice(0, 6).every(e => e.undo === null) && m.invLog[7].undo === null, m.invLog.map(e => e.undo));
    ck('#47 M2 ...a well-formed one is kept', m.invLog[6].undo && m.invLog[6].undo.delta.gp === 1);
    X.character = m;
    let threw = false; try { X.invLogHTML(m.invLog, 'all', 500); } catch (e) { threw = String(e); }
    ck('#47 M2 ...and the Log dialog paints', threw === false, threw);
    let gc; threw = false;
    try { gc = X.invUndoCheck({id: 'z', kind: 'trade', at: 1, undo: {parts: [{kind: 'give', u: null}]}}); } catch (e) { threw = String(e); }
    ck('#47 M2 invUndoCheck is guarded: a broken shape is refused, not thrown', threw === false && gc.ok === false && gc.why === "This line can't be undone.", [threw, gc]);

    /* ---- C4 + M9: line text ---- */
    fresh(); X.rules = Object.assign({}, X.rules, {items: [{name: 'Rope', cost: '1 gp'}, {name: 'Torch', cost: '1 cp'}]});
    ctx.logFinderAdd(X.addLibraryItems([{name: 'Rope', cost: '1 gp'}], null, null, 2));
    ck('#47 C4 the finder add line carries the cost', top().lines[0].text === 'Rope ×2 · 2 gp', top().lines);
    fresh();
    X.character.inventory = [{id: 'dg', name: 'Dagger', qty: 1, cost: 2}, {id: 'ro', name: 'Rope', qty: 3, cost: 1}];
    X.character.coins = {pp: 2, gp: 40, sp: 5, cp: 5};
    d = X.newTradeDraft({with: 'Olvin'});
    d.give.items = [{id: 'dg', qty: 1}, {id: 'ro', qty: 2}]; d.give.coins = {cp: 3, gp: 1, pp: 1};
    d.get.items = [{key: 'k', name: 'Healing Potion', qty: 1, cost: 50, def: {name: 'Healing Potion', cost: '50 gp'}, custom: false},
      {key: 'c', name: 'Lucky coin', qty: 2, cost: 0.5, def: null, custom: true}];
    d.get.coins = {sp: 2};
    const tr = X.completeTrade(d), rl = tr.lines.map(l => l.text);
    ck('#47 C4 receipt item lines carry costs', rl.includes('Dagger ×1 (2 gp)') && rl.includes('Rope ×2 (2 gp)') && rl.includes('Healing Potion ×1 (50 gp)') && rl.includes('Lucky coin ×2 (1 gp)'), rl);
    const coinAt = k => rl.findIndex(t => new RegExp('^\\d+ ' + k + '$').test(t));
    ck('#47 C4 receipt coins run pp → cp', coinAt('PP') >= 0 && coinAt('PP') < coinAt('GP') && coinAt('GP') < coinAt('SP') && coinAt('SP') < coinAt('CP'), rl);
    const lucky = X.character.inventory.find(i => i.name === 'Lucky coin');
    ck('#47 I1 a custom item from a trade has the standard item fields', lucky.description === '' && Array.isArray(lucky.effects) && lucky.effects.length === 0 && lucky.equipped === false, lucky);
    X.character.inventory.find(i => i.name === 'Healing Potion').qty = 0;
    const blk = X.invUndoCheck(tr);
    ck('#47 C4 a blocked trade undo names the item', blk.ok === false && /Healing Potion/.test(blk.why), blk);
    X.character.inventory.find(i => i.name === 'Healing Potion').qty = 1;
    X.invUndo(tr.id);
    const hU = X.invLogHTML(X.character.invLog, 'all', 500);
    const undidRow = hU.slice(hU.indexOf('Undid: Traded with Olvin'), hU.indexOf('Undid: Traded with Olvin') + 400);
    ck('#47 C4 an "Undid:" trade line shows no empty Receipt', !/<details>/.test(undidRow.split('il-side')[0]), undidRow);
    ck('#47 C4 ...while the trade itself keeps its receipt', /<details><summary>Receipt<\/summary>/.test(hU));

    /* ---- C5: the log scrolls through its own scroller ---- */
    ck('#47 C5 the log rows sit in one scroller, filters and foot outside it',
       /^<div class="il-filters">[\s\S]*<\/div><div class="il-scroll">[\s\S]*<\/div><div class="il-foot">/.test(hU), hU.slice(0, 300));
    ck('#47 C5 the scroller is a real scrolling element and the :has() rule is gone',
       /\.il-scroll\{[^}]*overflow-y:auto/.test(css('50-modal.css')) && /\.il-scroll\{[^}]*min-height:0/.test(css('50-modal.css')) && !/:has\(> \.il-filters\)/.test(css('50-modal.css')));
    /* ---- M7 ---- */
    ck('#47 M7 the first day header rule matches (.il-filters + .il-day), no :first-of-type', !/\.il-day:first-of-type/.test(css('50-modal.css')) && /\.il-scroll>\.il-day:first-child|\.il-filters ?\+ ?\.il-day/.test(css('50-modal.css')));
    ck('#47 M7 the active filter uses a theme token, not #20160a', !/#20160a/i.test((css('50-modal.css').match(/\.il-f\.on\{[^}]*\}/) || [''])[0]) && /\.il-f\.on\{[^}]*var\(--/.test(css('50-modal.css')));
    /* ---- C1 ---- */
    const html = require('./harness').loadHTML(), lb = (html.match(/<button[^>]*id="btnInvLog"[\s\S]*?<\/button>/) || [''])[0];
    ck('#47 C1 the Log button is an inline SVG, keeps its label, no 🕮', /<svg viewBox="0 0 24 24"/.test(lb) && /aria-label="Inventory log"/.test(lb) && !/🕮/.test(lb) && /il-word">Log</.test(lb), lb);

    /* ---- I2: removing a source writes one "Removed with" line ---- */
    fresh(); X.rules = Object.assign({}, X.rules, {items: [{name: 'Chain Mail', cost: '75 gp'}, {name: 'Shield', cost: '10 gp'}]});
    X.character.coins = {gp: 0};
    let t = 1000; const realNow = ctx.Date.now; ctx.Date.now = () => t;
    try {
      X.grantItemByName('Chain Mail', 1, 'class:Fighter'); X.grantItemByName('Shield', 1, 'class:Fighter'); ctx.addGrantGold(10, 'class:Fighter');
      t += 500; const n0 = X.character.invLog.length;
      X.revertEquipmentGrants('class:Fighter');
      const rv = top();
      ck('#47 I2 removing a class that granted items and gold writes ONE line, no Undo',
         X.character.invLog.length === n0 + 1 && rv.kind === 'grant' && rv.meta.revert === true && rv.title === 'Removed with Fighter' && rv.undo === null &&
         rv.lines.map(l => l.text).join('|') === 'Chain Mail ×1|Shield ×1|10 GP' && rv.lines.every(l => l.dir === '-') && X.invUndoCheck(rv).ok === false, rv);
      ck('#47 I2 ...it files under Items, as a grant line does', /Removed with Fighter/.test(X.invLogHTML(X.character.invLog, 'items', 500)));
      t += 500; X.grantItemByName('Shield', 1, 'class:Fighter');
      ck('#47 I2 ...a grant straight after starts its own line, never folding into the removal', top().title === 'Granted by Fighter' && rv.lines.length === 3);
      t += 9000; const n1 = X.character.invLog.length; X.revertEquipmentGrants('bg:Nobody');
      ck('#47 I2 removing a source that granted nothing writes nothing', X.character.invLog.length === n1);
    } finally { ctx.Date.now = realNow; }

    /* ---- I2: Recover N counts in the fight's tally; Undo recovery takes End combat's off ---- */
    fresh(); state.confirm = true;
    X.character.inventory = [{id: 'bow', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
      {id: 'ar', name: 'Arrow', qty: 20, ammo: {kind: 'arrow'}}];
    X.startCombatNow(); X.character.combatRound = 3;
    for (let i = 0; i < 4; i++) X.fireAmmo(X.character, X.character.inventory[0]);
    X.recoverWeaponAmmo('bow', false);
    ck('#47 I2 a row Recover writes no line of its own', X.character.invLog.length === 0 && X.character.inventory[1].qty === 18);
    for (let i = 0; i < 2; i++) X.fireAmmo(X.character, X.character.inventory[0]);
    let offer = null; ctx.toast = (msg, action) => { offer = action; return null; };
    X.endCombatAsk();
    const am = top();
    ck('#47 I2 End combat\'s line includes what the row recovered', am.kind === 'ammo' && am.title === 'Arrows: 6 fired, 3 recovered', am.title);
    ck('#47 M9 ...and reads "Fight of N rounds"', am.lines.length === 1 && am.lines[0].text === 'Fight of 3 rounds' && am.meta.rounds === 3, am.lines);
    ck('#47 I2 ...the tally is cleared with the fight', JSON.stringify(X.character.ammoFight) === '{}');
    ck('#47 I2 Undo recovery on the toast takes End combat\'s recovery back off the line', offer && offer.run() === true && am.title === 'Arrows: 6 fired, 2 recovered' && X.character.invLog.length === 1, am.title);
    ck('#47 I2 a new character has an empty fight tally', JSON.stringify(X.blankChar().ammoFight) === '{}' && JSON.stringify(X.migrate({abilities: {}, ammoFight: 'x'}).ammoFight) === '{}');
    fresh(); X.character.inventory = [{id: 'bow', name: 'Longbow', qty: 1, equipped: true, weapon: {kind: 'ranged', ammo: 'arrow', dice: '1d8'}},
      {id: 'ar', name: 'Arrow', qty: 20, ammo: {kind: 'arrow'}}];
    X.startCombatNow(); X.character.combatRound = 1;
    for (let i = 0; i < 2; i++) X.fireAmmo(X.character, X.character.inventory[0]);
    X.recoverWeaponAmmo('bow', false); offer = 'none';
    X.endCombatAsk();
    ck('#47 I2 every shot recovered by the row still gets its line at End combat', top().kind === 'ammo' && top().title === 'Arrows: 2 fired, 1 recovered' && top().lines[0].text === 'Fight of 1 round' && offer === undefined, top());
    ctx.toast = () => null;

    /* ---- M1: lowering the log size asks first when lines would go ---- */
    fresh(); X.character.invLogSize = 2500;
    for (let i = 0; i < 2500; i++) X.logInv({kind: 'coins', title: 'c' + i, lines: [], undo: null});
    state.confirm = false; state.lastConfirm = null;
    ck('#47 M1 declining keeps the size and every line', ctx.setInvLogSize(100) === false && state.lastConfirm === 'Keep the newest 100? This removes 2,400 older lines.' &&
       X.character.invLogSize === 2500 && X.character.invLog.length === 2500, state.lastConfirm);
    state.confirm = true;
    ck('#47 M1 accepting trims at once', ctx.setInvLogSize(100) === true && X.character.invLogSize === 100 && X.character.invLog.length === 100 && X.character.invLog[0].title === 'c2499');
    state.lastConfirm = null;
    ck('#47 M1 raising it never asks', ctx.setInvLogSize(1000) === true && state.lastConfirm === null && X.character.invLogSize === 1000);
    ck('#47 M1 the select uses it, and puts itself back when declined', /setInvLogSize\(num\(s\.value\)\)/.test(src('88-settings.js')));
  } finally {
    STUB.forEach(n => { ctx[n] = keep[n]; });
    X.character = keep.ch; X.rules = keep.rules; state.confirm = keep.conf; ctx.document.getElementById = keep.gid;
  }
}

// ---------- #47 follow-ups (Mike, 2026-10-25): edit lines keep only what changed;
// selling never reads red; grant lines that moved gold file under Coins; --on-accent
{
  const fs = require('fs'), path = require('path');
  const cssAll = fs.readdirSync(path.join(__dirname, '..', 'css')).map(n => fs.readFileSync(path.join(__dirname, '..', 'css', n), 'utf8')).join('\n');
  const STUB = ['scheduleSave', 'renderInventory', 'renderAttacks', 'renderCoins', 'recompute', 'toast'];
  const keep = {ch: X.character, rules: X.rules, conf: state.confirm, now: ctx.Date.now};
  STUB.forEach(n => { keep[n] = ctx[n]; ctx[n] = () => null; });
  const fresh = () => { X.character = X.blankChar(); X.character.system = 'dnd'; X.character.inventory = []; X.character.attacks = []; X.character.coins = {gp: 40, sp: 0, cp: 0}; return X.character; };
  const top = () => X.character.invLog[0];
  try {
    /* ---- edit lines: only the changed fields, and a fingerprint ---- */
    fresh();
    const long = 'A long magic-item description. '.repeat(60), stamp = {pack: 'srd52', v: '1.2.0', fp: 'x'.repeat(280)};
    const before = {id: 'w', name: 'Wand of Wonder', qty: 1, description: long, src: stamp, notes: 'old'};
    const after = {id: 'w', name: 'Wand of Wonder', qty: 2, description: long, src: stamp, fav: true};
    X.character.inventory = [JSON.parse(JSON.stringify(after))];
    X.logItemSave(before, after);
    const ed = top(), chg = ed.undo.changed || {};
    ck('#47 follow-up: an edit line keeps only the fields that changed',
       ed.kind === 'edit' && Object.keys(chg).sort().join() === 'fav,notes,qty' && ed.undo.id === 'w' && typeof ed.undo.hash === 'string' &&
       !('before' in ed.undo) && !('after' in ed.undo) && JSON.stringify(ed.undo).length < 120, ed.undo);
    ck('#47 ...a field the edit added has no "before", one it removed no "after"',
       !!chg.fav && !('b' in chg.fav) && chg.fav.a === true && !!chg.notes && chg.notes.b === 'old' && !('a' in chg.notes));
    X.character.inventory[0] = {fav: true, src: stamp, description: long, qty: 2, name: 'Wand of Wonder', id: 'w'};
    ck('#47 ...the fingerprint ignores key order', X.invUndoCheck(ed).ok === true);
    X.character.inventory[0].description = long + '!';
    ck('#47 ...and any later change refuses the undo', X.invUndoCheck(ed).why === 'It has been changed again since.');
    X.character.inventory[0].description = long;
    ck('#47 ...Undo rebuilds the row exactly as it was',
       X.invUndo(ed.id) === '' && X.invSame(X.character.inventory[0], before) && !('fav' in X.character.inventory[0]), X.character.inventory[0]);

    /* a line saved with two whole copies still undoes, and shrinks when the character loads */
    fresh(); X.character.inventory = [JSON.parse(JSON.stringify(after))];
    X.logInv({kind: 'edit', title: 'Edited Wand of Wonder', lines: [], undo: {before, after}});
    const cleaned = X.cleanInvLog(JSON.parse(JSON.stringify(X.character.invLog)), 500);
    ck('#47 follow-up: an old two-copy edit line is converted on load',
       Object.keys(cleaned[0].undo.changed || {}).sort().join() === 'fav,notes,qty' && !('before' in cleaned[0].undo), cleaned[0].undo);
    ck('#47 ...and an unconverted one still undoes', X.invUndo(top().id) === '' && X.invSame(X.character.inventory[0], before));
    ck('#47 ...a malformed edit undo is dropped, its line kept',
       X.cleanInvLog([{kind: 'edit', at: 9, title: 'e', undo: {id: 'w', changed: 'x', hash: 'h'}}], 500)[0].undo === null);

    /* the size this was for: 500 edits of a magic item */
    fresh(); X.character.invLogSize = 500;
    let row = JSON.parse(JSON.stringify(after));
    for (let i = 0; i < 500; i++) { const b = row; row = Object.assign({}, b, {qty: b.qty + 1}); X.logItemSave(b, row); }
    const size = JSON.stringify(X.character.invLog).length;
    ck('#47 follow-up: 500 edit lines of a long-described magic item stay under 150,000 characters', X.character.invLog.length === 500 && size < 150000, size);

    /* ---- selling: coins you receive never make it red ---- */
    fresh(); X.character.inventory = [{id: 'dg', name: 'Dagger', qty: 1, cost: 2}];
    let d = X.newTradeDraft({with: 'Olvin'}); d.give.items = [{id: 'dg', qty: 1}]; d.get.coins = {gp: 5};
    let b = X.tradeBalance(d, X.character), h = X.tradeHTML(d, X.character);
    ck('#47 follow-up: selling a 2 gp Dagger for 5 gp is not short, and not red',
       b.diff === -300 && b.short === false && !/tr-bal short/.test(h) && /3 gp in your favour/.test(h), h.match(/<div class="tr-bal[^]*?<\/div>/));
    d.get.items = [{key: 'k', name: 'Torch', qty: 1, cost: 1, def: {name: 'Torch', cost: '1 gp'}, custom: false}];
    b = X.tradeBalance(d, X.character);
    ck('#47 ...nor when the items you get are worth no more than what you give', b.short === false && b.diff === -400);
    d.get.coins = {}; d.get.items[0].cost = 5; b = X.tradeBalance(d, X.character); h = X.tradeHTML(d, X.character);
    ck('#47 ...buying for more than you give is still short, in red', b.short === true && /tr-bal short/.test(h) && /3 gp short/.test(h));
    d.applyGet = false;
    ck('#47 ...and the get switch off is never short', X.tradeBalance(d, X.character).short === false);
    ck('#47 ...Complete asks only when short', /if\(b\.short&&!confirm\(/.test(fs.readFileSync(path.join(__dirname, '..', 'js', '67-trade.js'), 'utf8')));

    /* ---- grant and "Removed with" lines that moved gold file under Coins ---- */
    fresh(); X.rules = Object.assign({}, X.rules, {items: [{name: 'Shield', cost: '10 gp'}]});
    let t = 1000; ctx.Date.now = () => t;
    X.grantItemByName('Shield', 1, 'class:Fighter'); ctx.addGrantGold(10, 'class:Fighter');
    t += 9000; X.grantItemByName('Shield', 1, 'bg:Soldier');
    t += 9000; X.revertEquipmentGrants('class:Fighter');
    t += 9000; X.revertEquipmentGrants('bg:Soldier');
    const coinsView = X.invLogHTML(X.character.invLog, 'coins', 500), itemsView = X.invLogHTML(X.character.invLog, 'items', 500);
    ck('#47 follow-up: a grant that gave gold, and its removal, also file under Coins',
       /Granted by Fighter/.test(coinsView) && /Removed with Fighter/.test(coinsView), coinsView);
    ck('#47 ...a grant and a removal with no gold stay out of Coins', !/Soldier/.test(coinsView));
    ck('#47 ...all four still file under Items', /Granted by Fighter/.test(itemsView) && /Granted by Soldier/.test(itemsView) && /Removed with Fighter/.test(itemsView) && /Removed with Soldier/.test(itemsView));

    /* ---- text on an accent fill reads in every skin ---- */
    ck('#47 follow-up: no hard-coded text colour on the accent remains', !/#20160a/i.test(cssAll));
    ck('#47 ...--on-accent is set for both themes, both classic themes, and the rail',
       (cssAll.match(/--on-accent:#/g) || []).length === 5 && /--accent:var\(--rail-accent\);--on-accent:#181410;/.test(cssAll));
    ck('#47 ...the log filter, the primary button, the toast and the initiative chip use it',
       /\.il-f\.on\{[^}]*color:var\(--on-accent\)/.test(cssAll) && /\.tbtn\.primary\{[^}]*color:var\(--on-accent\)/.test(cssAll) &&
       /\.toast\{[^}]*color:var\(--on-accent\)/.test(cssAll) && /\.ini-chip\.now\{[^}]*color:var\(--on-accent\)/.test(cssAll));
  } finally {
    STUB.forEach(n => { ctx[n] = keep[n]; });
    X.character = keep.ch; X.rules = keep.rules; state.confirm = keep.conf; ctx.Date.now = keep.now;
  }
}

// ---------- #47 I1: the item form, unchanged open → Save, writes no line
{
  const VOID = new Set(['input', 'img', 'br', 'hr', 'path', 'circle', 'line', 'rect', 'polyline', 'polygon', 'meta']);
  const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  /* a tiny DOM for one form: elements by id, values, classes, listeners */
  function parse(html, parent, byId) {
    const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"]|"[^"]*")*?)(\/?)>|([^<]+)/g;
    let cur = parent, m;
    while ((m = re.exec(html))) {
      if (m[5] !== undefined) { if (cur.tag === 'textarea' || cur.tag === 'option') cur.text += unesc(m[5]); continue; }
      if (!m[2]) continue;
      const tag = m[2].toLowerCase();
      if (m[1]) { let x = cur; while (x && x.tag !== tag) x = x.parent; if (x) cur = x.parent; continue; }
      const attrs = {}; let a; const ar = /([\w-]+)(?:="([^"]*)")?/g;
      while ((a = ar.exec(m[3]))) attrs[a[1]] = a[2] === undefined ? '' : unesc(a[2]);
      const n = mk(tag, attrs, byId); n.parent = cur; cur.children.push(n);
      if (!VOID.has(tag) && !m[4]) cur = n;
    }
  }
  function mk(tag, attrs, byId) {
    const cls = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    const n = {tag, attrs, parent: null, children: [], text: '', _on: {}, _val: null, dataset: {}, disabled: 'disabled' in attrs,
      style: {display: /display:none/.test(attrs.style || '') ? 'none' : ''}, placeholder: attrs.placeholder || '',
      classList: {contains: c => cls.has(c), add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; if (v) cls.add(c); else cls.delete(c); return v; }},
      get id() { return attrs.id; },
      get value() {
        if (this._val !== null) return this._val;
        if (tag === 'textarea') return this.text;
        if (tag === 'select') { const os = this.querySelectorAll('option'); const o = os.find(x => 'selected' in x.attrs) || os[0]; return o ? ('value' in o.attrs ? o.attrs.value : o.text) : ''; }
        if (tag === 'option') return 'value' in attrs ? attrs.value : this.text;
        return attrs.value || '';
      },
      set value(v) { this._val = String(v); },
      addEventListener(type, fn) { (this._on[type] = this._on[type] || []).push(fn); },
      fire(type) { (this._on[type] || []).forEach(fn => fn({target: this})); },
      matches(sel) { return sel[0] === '.' ? cls.has(sel.slice(1)) : sel[0] === '#' ? attrs.id === sel.slice(1) : tag === sel; },
      querySelectorAll(sel) { const out = []; const walk = x => x.children.forEach(c => { if (c.matches(sel)) out.push(c); walk(c); }); walk(this); return out; },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      closest(sel) { for (let x = this; x && x.matches; x = x.parent) if (x.matches(sel)) return x; return null; },
      set innerHTML(h) { this.children = []; parse(h, this, byId); },
      insertAdjacentHTML(_, h) { parse(h, this, byId); },
      remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); },
      setAttribute() {}, removeAttribute() {}, focus() {}, textContent: ''};
    if (attrs.id) byId[attrs.id] = n;
    return n;
  }
  const keep = {ch: X.character, rules: X.rules, gid: ctx.document.getElementById, open: ctx.openModal, close: ctx.closeModal,
    rs: ctx.scheduleSave, ri: ctx.renderInventory, ra: ctx.renderAttacks, rq: ctx.recompute, rc: ctx.renderCoins};
  let byId = {};
  ctx.openModal = (title, html) => { byId = {}; const root = mk('root', {}, byId); parse(html, root, byId); };
  ctx.closeModal = () => {};
  ctx.document.getElementById = id => byId[id] || null;
  ['scheduleSave', 'renderInventory', 'renderAttacks', 'recompute', 'renderCoins'].forEach(n => ctx[n] = () => {});
  const saveUnchanged = it => { const n = X.character.invLog.length; ctx.openItemForm(it); byId.iSave.fire('click'); return X.character.invLog.length - n; };
  try {
    const items = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'srd52', 'items.json'), 'utf8')).items;
    const magic = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'srd52', 'items-magic.json'), 'utf8')).items;
    const def = n => items.concat(magic).find(x => x.name === n);
    X.rules = Object.assign({}, X.rules, {items: items.concat(magic)});
    X.character = X.blankChar(); X.character.system = 'dnd'; X.character.inventory = []; X.character.attacks = [];
    X.addLibraryItems([def('Potion of Healing'), def('Chain Mail'), def('Longsword')], {kind: 'purchased', detail: '', at: 5}, null, 1);
    X.character.inventory.push({id: 'wand', name: 'Wand of Sparks', qty: 1, description: '', effects: [], equipped: false, uses: {max: 7, per: 'long'}});
    X.character.inventory.push({id: 'lant', name: 'Lantern', description: '', effects: [], equipped: false});
    const d = X.newTradeDraft({with: 'Olvin'}); d.get.items = [{key: 'k', name: 'Lucky coin', qty: 1, cost: 0, def: null, custom: true}];
    X.completeTrade(d);
    X.character.invLog = [];
    const inv = X.character.inventory, by = n => inv.find(i => i.name === n);
    ck('#47 I1 the fake form opens the real item form', (ctx.openItemForm(by('Potion of Healing')), !!byId.iSave && byId.iName.value === 'Potion of Healing' && byId.iHeal.value === '2d4+2'), Object.keys(byId).length);
    ck('#47 I1 an unchanged Save of a Potion of Healing writes no line', saveUnchanged(by('Potion of Healing')) === 0, X.character.invLog[0]);
    ck('#47 I1 ...of Chain Mail', saveUnchanged(by('Chain Mail')) === 0, X.character.invLog[0]);
    ck('#47 I1 ...of a Wand with uses but no used', saveUnchanged(by('Wand of Sparks')) === 0, X.character.invLog[0]);
    ck('#47 I1 ...of an item with no qty', saveUnchanged(by('Lantern')) === 0, X.character.invLog[0]);
    ck('#47 I1 ...of a custom item received in a trade', saveUnchanged(by('Lucky coin')) === 0, X.character.invLog[0]);
    ck('#47 I1 ...of a Longsword', saveUnchanged(by('Longsword')) === 0, X.character.invLog[0]);
    ctx.openItemForm(by('Longsword')); byId.iQty.value = '2'; byId.iSave.fire('click');
    ck('#47 I1 a real change (qty 1 → 2) still writes exactly one line', X.character.invLog.length === 1 && X.character.invLog[0].kind === 'edit' && X.character.invLog[0].lines[0].text === 'Quantity 1 → 2', X.character.invLog);
    ctx.openItemForm(null); byId.iName.value = 'Rope'; byId.iCost.value = '1'; byId.iQty.value = '3'; byId.iSave.fire('click');
    ck('#47 C4 the item form\'s add line carries the cost', X.character.invLog[0].kind === 'add' && X.character.invLog[0].lines[0].text === 'Rope ×3 · 3 gp', X.character.invLog[0].lines);
  } finally {
    Object.assign(ctx, {openModal: keep.open, closeModal: keep.close, scheduleSave: keep.rs, renderInventory: keep.ri, renderAttacks: keep.ra, recompute: keep.rq, renderCoins: keep.rc});
    ctx.document.getElementById = keep.gid; X.character = keep.ch; X.rules = keep.rules;
  }
}

// ---------- #118 feat helpers
{
  const keep = X.character;
  const f = (name, desc, extra) => Object.assign({name, description: desc}, extra || {});
  const ath = f('Athlete', 'General feat · Prerequisite: Level 5+ and Strength 13+ or Level 5+ and Dexterity 13+\nYou gain the following benefits.', {ability: [{choose: ['str', 'dex'], amount: 1}]});
  const boon = f('Boon of Fate', 'Epic Boon · Prerequisite: Level 19+\nx', {ability: [{choose: ['str','dex','con','int','wis','cha'], amount: 1, max: 30}]});
  const sty = f('Archery', 'Fighting Style feat · Prerequisite: Fighting Style feature\nx');
  const org = f('Alert', 'Origin feat\nx');
  const odd = f('Weird', 'General feat · Prerequisite: Membership in the Harpers\nx');
  const spl = f('War Caster', 'General feat · Prerequisite: Level 4+ and Spellcasting or Pact Magic feature\nx');
  const castOnly = f('Spell Sniper', 'General feat · Prerequisite: Spellcasting feature\nx');
  const pactF = f('Eldritch Adept', 'General feat · Prerequisite: Spellcasting or Pact Magic feature\nx');
  const hb = f('Moonlit', 'Increase your Dexterity, Wisdom, or Charisma score by 1, up to 20.\nYou gain…');
  ck('#118 featCategory', X.featCategory(ath) === 'general' && X.featCategory(boon) === 'boon' && X.featCategory(sty) === 'style' && X.featCategory(org) === 'origin' && X.featCategory(hb) === '');
  const pr = X.featPrereq(ath);
  ck('#118 featPrereq reads or-groups of and-parts', pr.length === 2 && pr[0].some(p => p.kind === 'level' && p.n === 5) && pr[0].some(p => p.kind === 'ability' && p.key === 'str' && p.n === 13) && pr[1].some(p => p.key === 'dex'), pr);
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
  ck('#118 a plain Fighter does not meet Spellcasting feature', X.featUnmet(castOnly).length === 1, X.featUnmet(castOnly));
  X.character.classes = [{name: 'Fighter', level: 3, subclass: 'Eldritch Knight'}]; X.character.level = 3;
  ck('#118 an Eldritch Knight subclass meets Spellcasting feature (hasCasterClass, not the base class field)', X.featUnmet(castOnly).length === 0, X.featUnmet(castOnly));
  X.character.classes = [{name: 'Warlock', level: 1}]; X.character.level = 1;
  ck('#118 a Warlock meets Spellcasting or Pact Magic feature', X.featUnmet(pactF).length === 0, X.featUnmet(pactF));
  ck('#118 a Warlock does NOT meet a plain Spellcasting feature (pact is not spellcasting)', X.featUnmet(castOnly).length === 1, X.featUnmet(castOnly));
  X.character.classes = [{name: 'Fighter', level: 8}]; X.character.level = 8;
  const ac = X.featAbilityChoices(ath);
  ck('#118 ability from the field', ac.length === 1 && ac[0].choose.join() === 'str,dex' && ac[0].amount === 1);
  const tc = X.featAbilityChoices(hb);
  ck('#118 ability from the text', tc.length === 1 && tc[0].choose.join() === 'dex,wis,cha' && tc[0].amount === 1, tc);
  ck('#118 fixed increase', JSON.stringify(X.featAbilityChoices(f('D', 'x', {ability: [{con: 1}]}))) === JSON.stringify([{fixed: {con: 1}}]));
  ck('#118 no increase', X.featAbilityChoices(org).length === 0);
  ck('#118 a choose increase\'s max round-trips from the field', X.featAbilityChoices(boon)[0].max === 30, X.featAbilityChoices(boon));
  ck('#118 offered at an ASI: general yes, origin no, boon only at 19, style with the feature',
     X.featOfferable(ath, {}) && !X.featOfferable(org, {}) && !X.featOfferable(boon, {}) && X.featOfferable(boon, {boon: true}) && X.featOfferable(sty, {}));
  ck('#118 Show all offers everything', X.featOfferable(org, {showAll: true}));
  ck('#118 a species Origin choice offers only Origin feats', X.featOfferable(org, {category: 'origin'}) && !X.featOfferable(ath, {category: 'origin'}));
  ck('#118 Show all lifts the category filter too (the escape hatch, Mike 2026-10-27)', X.featOfferable(ath, {category: 'origin', showAll: true}) === true);
  X.character.features.push({id: 'c', name: 'Feat: Athlete', enabled: true});
  ck('#118 a taken feat is hidden unless Repeatable', X.featTaken('Athlete') && !X.featOfferable(ath, {}) && X.featOfferable(f('Skilled', 'General feat\nRepeatable: You can take this feat more than once.'), {}) );
  X.character.features.push({id: 'd', name: 'Feat: Notionist', enabled: true});
  ck('#118 "not Repeatable" in the body is not read as the Repeatable line', !X.featOfferable(f('Notionist', 'General feat\nThis feat is not Repeatable.'), {}));
  ck('#118 the rules feat named Ability Score Improvement is never offered', !X.featOfferable(f('Ability Score Improvement', 'General feat\nx'), {showAll: true}));
  ck('#118 featPrereq also splits parts joined by a comma', (() => {
    const pr2 = X.featPrereq(f('Comma', 'General feat · Prerequisite: Level 5+, Strength 13+\nx'));
    return pr2.length === 1 && pr2[0].length === 2 && pr2[0][0].kind === 'level' && pr2[0][1].kind === 'ability';
  })());
  X.character = keep;
}

// ---------- #118 the ASI-or-feat step
{
  const keep = {ch: X.character, rules: X.rules, conf: state.confirm};
  X.character = X.blankChar(); X.character.classes = [{name: 'Fighter', level: 8}]; X.character.level = 8;
  X.character.abilities.str = 15;
  const evil = '<img src=x onerror=alert(1)>';
  X.rules = Object.assign({}, X.rules, {feats: [
    {name: 'Athlete', description: 'General feat · Prerequisite: Level 5+ and Strength 13+ or Level 5+ and Dexterity 13+\nYou gain the following benefits.\nClimb Speed: …', ability: [{choose: ['str', 'dex'], amount: 1}]},
    {name: 'Great Weapon Master', description: 'General feat · Prerequisite: Level 4+ and Strength 13+\nx', ability: [{str: 1}]},
    {name: 'Alert', description: 'Origin feat\nx'},
    {name: evil, description: 'General feat\n' + evil}]});
  ck('#118 a fresh character has featsAllowed', X.blankChar().featsAllowed === true);
  ck('#118 migrate keeps a boolean featsAllowed and defaults the rest to true',
     X.migrate({featsAllowed: false}).featsAllowed === false && X.migrate({}).featsAllowed === true && X.migrate({featsAllowed: 'no'}).featsAllowed === true);
  const h = X.choiceFieldHTML({type: 'asi'}, 0, null);
  ck('#118 the ASI row is pinned first', h.indexOf('data-ft-pick="__asi__"') > -1 && h.indexOf('data-ft-pick="__asi__"') < h.indexOf('data-ft-pick="Athlete"'));
  ck('#118 qualified feats listed, Origin hidden', /data-ft-pick="Athlete"/.test(h) && !/data-ft-pick="Alert"/.test(h));
  ck('#118 the ASI is selected by default, showing today\'s controls', /data-asi-mode/.test(h));
  ck('#118 ...and its row is the pressed one', /data-ft-pick="__asi__" aria-pressed="true"/.test(h) && !/data-ft-pick="Athlete" aria-pressed="true"/.test(h));
  ck('#118 the step carries the search box and the Show all switch', /data-ft-search/.test(h) && /data-ft-all/.test(h) && /data-ctype="asi"/.test(h));
  ck('#118 escaping', !h.includes('<img src=x') && h.includes('&lt;img src=x'));
  ck('#118 a row\'s short line: its +1 and its first benefit', /\+1 Str or Dex · Climb Speed/.test(h), h);
  const all = X.asiFeatListHTML({type: 'asi'}, 0, {showAll: true});
  ck('#118 Show all lists the Origin feat too', /data-ft-pick="Alert"/.test(all));
  X.character.abilities.str = 12;
  const short = X.asiFeatListHTML({type: 'asi'}, 0, {showAll: true});
  ck('#118 Show all tags an unmet prerequisite in amber', /class="ft-tag warn">needs Strength 13 or higher \(yours is 12\)/.test(short), short);
  ck('#118 ...and Show all off hides it', !/data-ft-pick="Great Weapon Master"/.test(X.asiFeatListHTML({type: 'asi'}, 0, {showAll: false})));
  // the unmet-prerequisite warning: browser confirm() (no in-modal two-button confirm exists)
  state.confirm = false; state.lastConfirm = null;
  ck('#118 declining the warning keeps the step open', X.asiPickConfirmed(['Great Weapon Master']) === false);
  ck('#118 the warning names the feat and what is missing', state.lastConfirm === 'Great Weapon Master needs Strength 13 or higher (yours is 12). Take it anyway?', state.lastConfirm);
  state.confirm = true;
  ck('#118 accepting the warning goes on', X.asiPickConfirmed(['Great Weapon Master']) === true);
  state.lastConfirm = null;
  ck('#118 the ASI and a qualified feat never ask', X.asiPickConfirmed(['__asi__', 'Alert']) === true && state.lastConfirm === null);
  X.character.abilities.str = 15;
  X.character.featsAllowed = false;
  const off = X.choiceFieldHTML({type: 'asi'}, 0, null);
  ck('#118 Feats allowed off: no list, today\'s controls', !/data-ft-pick/.test(off) && /data-asi-mode/.test(off));
  X.character.featsAllowed = true;
  const p = X.asiPanelHTML({type: 'asi'}, 0, 'Athlete');
  ck('#118 the panel asks the +1 from the field', /data-ft-plus="0"/.test(p) && /Strength/.test(p) && /Dexterity/.test(p));
  ck('#118 the panel shows the feat\'s text, not its category line', /Climb Speed/.test(p) && !/General feat/.test(p));
  ck('#118 a fixed increase is text, not a control', !/data-ft-plus/.test(X.asiPanelHTML({type: 'asi'}, 0, 'Great Weapon Master')) && /\+1 Strength/.test(X.asiPanelHTML({type: 'asi'}, 0, 'Great Weapon Master')));
  ck('#118 the panel escapes the feat text', !X.asiPanelHTML({type: 'asi'}, 0, evil).includes('<img src=x'));
  // commit: a feat with its +1, tied to the class level; then removing the class reverts both
  X.commitAsiPick({type: 'asi', pick: 'Athlete', plus: ['dex']}, {kind: 'class', class: 'Fighter', level: 8}, []);
  const ft = X.character.features.find(x => x.name === 'Feat: Athlete');
  ck('#118 the feat is granted with its class-level origin', ft && ft.origin.kind === 'class' && ft.origin.class === 'Fighter' && ft.origin.level === 8, ft);
  ck('#118 its +1 is an effect on the feat', ft && ft.effects.some(e => e.target === 'ability.dex' && e.value === 1), ft && ft.effects);
  ck('#118 the +1 does not leak into the rules entry', !(X.rules.feats[0].effects || []).length);
  X.commitAsiPick({type: 'asi', pick: 'Great Weapon Master', plus: []}, {kind: 'class', class: 'Fighter', level: 4}, []);
  const gwm = X.character.features.find(x => x.name === 'Feat: Great Weapon Master');
  ck('#118 a fixed increase is stored on the feat', gwm && gwm.effects.some(e => e.target === 'ability.str' && e.value === 1), gwm && gwm.effects);
  X.commitAsiPick({type: 'asi', pick: '__asi__', mode: '2', a: 'str'}, {kind: 'class', class: 'Fighter', level: 4}, []);
  ck('#118 an ASI is stored as today', X.character.features.some(x => x.name === 'Ability Score Improvement' && x.effects[0].target === 'ability.str' && x.effects[0].value === 2));
  X.commitAsiPick({type: 'asi', pick: '__asi__', mode: '1', a: 'con', b: 'wis'}, {kind: 'class', class: 'Fighter', level: 6}, []);
  ck('#118 +1 to two is stored as today', X.character.features.some(x => x.name === 'Ability Score Improvement' && x.effects.length === 2 && x.effects[1].target === 'ability.wis'));
  X.removeClass(0);
  ck('#118 removing the class removes the feat and the ASI', !X.character.features.some(x => /Athlete|Great Weapon|Ability Score Improvement/.test(x.name)));
  X.character = keep.ch; X.rules = keep.rules; state.confirm = keep.conf;
}

ck.done();
