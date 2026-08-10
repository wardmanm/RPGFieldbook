/* Sheet mechanics: the small pure functions the character sheet leans on.
   Currently the coin-box entry parser, which is the whole of the add/subtract
   currency feature — everything else about it is DOM wiring. */
const {loadApp, makeCheck} = require('./harness');

const ck = makeCheck();
const {X, bootError, fragments} = loadApp(['coinEntry', 'num']);
if (bootError) { console.log('LOAD FAIL: ' + bootError.message); process.exit(1); }
console.log('loaded ' + fragments.length + ' fragments\n');

const e = X.coinEntry;

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

ck.done();
