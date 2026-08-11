/* Shared test harness.
 *
 * Loads the app the way the BUILD does — concatenating src/js in the order
 * src/manifest.json gives, minus 90-boot.js (which calls boot() at load) — into
 * a vm context with the DOM stubbed out. Everything else is real code.
 *
 * Evaluating the real concatenation in the real order is itself a test: it is
 * what catches a top-level TDZ, e.g. 00-constants.js runs `let character =
 * blankChar()` before 30-version.js defines APP_VERSION, so referencing
 * APP_VERSION from blankChar() would white-screen the app. Keep it that way —
 * do not "optimise" this into requiring individual fragments.
 *
 * Top-level `let`/`const` are lexical in a vm script, not properties of the
 * context, so each suite names what it needs and gets it back on one object.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");

/* the three globals a suite may need to WRITE, so they need accessors */
const MUTABLE = ["rules", "character", "activeId", "updateAvailable"];

function loadApp(names) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "src/manifest.json"), "utf8"));

  const noop = () => {};
  const stubEl = new Proxy({}, {
    get: (t, k) => k === "classList" ? {toggle: noop, add: noop, remove: noop, contains: () => false}
      : k === "style" ? {} : k === "dataset" ? {} : k === "value" ? ""
      : k === "children" ? [] : noop,
    set: () => true,
  });

  /* Controllable from the suite: a real localStorage so persistence can be
     asserted, a quota switch so the "storage refused" path is reachable, and a
     confirm() whose answer and last message are both inspectable. */
  const store = {};
  const state = {quotaFull: false, confirm: true, lastConfirm: null};

  const ctx = {
    console, JSON, Math, Date, RegExp, String, Number, Array, Object, Set, Map,
    parseInt, parseFloat, isNaN,
    setTimeout: noop, clearTimeout: noop,
    crypto: {getRandomValues: a => a},
    alert: noop,
    confirm: (msg) => { state.lastConfirm = msg; return state.confirm; },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { if (state.quotaFull) throw new Error("QuotaExceededError"); store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    navigator: {onLine: false},
    fetch: () => Promise.reject(new Error("offline")),
    window: {addEventListener: noop, matchMedia: () => ({matches: false, addEventListener: noop}),
             scrollTo: noop, print: noop},
    document: {
      getElementById: () => stubEl, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => stubEl, addEventListener: noop, body: stubEl, documentElement: stubEl,
    },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const fragments = manifest.js.filter(p => !/90-boot\.js$/.test(p));
  const wanted = (names || []).filter(n => MUTABLE.indexOf(n) < 0);
  const exportsSrc = MUTABLE.map(n => `get ${n}(){return ${n}}, set ${n}(v){${n}=v}`)
    .concat(wanted).join(",\n ");

  const src = fragments.map(p => fs.readFileSync(path.join(ROOT, p), "utf8")).join("\n")
    + `\n;globalThis.__X={\n ${exportsSrc}\n};`;

  let bootError = null;
  try { vm.runInContext(src, ctx, {filename: "bundle.js"}); }
  catch (e) { bootError = e; }

  return {X: ctx.__X, ctx, store, state, bootError, fragments};
}

/* Tiny assertion recorder — no framework, no dependencies. */
function makeCheck() {
  const failed = [];
  let total = 0;
  function ck(name, cond, extra) {
    total++;
    console.log((cond ? "PASS  " : "FAIL  ") + name
      + (!cond && extra !== undefined ? "  -> " + JSON.stringify(extra) : ""));
    if (!cond) failed.push(name);
  }
  ck.done = function () {
    console.log("");
    console.log(failed.length ? "FAILURES: " + failed.join(", ") : "ALL PASSED (" + total + ")");
    process.exit(failed.length ? 1 : 0);
  };
  ck.failed = failed;
  return ck;
}

module.exports = {loadApp, makeCheck, ROOT};
