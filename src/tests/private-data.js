#!/usr/bin/env node
/* The private rules packs' tests (#85), run against THIS checkout when the
   private repo is linked as _private-data (scripts/wt.sh links it into
   worktrees). CI never has it, and skips. The private runner prints one
   summary line; anything else is a failure, never a pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const P = process.env.FIELDBOOK_PRIVATE || path.join(ROOT, '_private-data');
const RUN = path.join(P, 'tests', 'run.sh');
if (!fs.existsSync(RUN)) {
  console.log('SKIP - no _private-data');
  process.exit(0);
}
const r = spawnSync('bash', [RUN], {env: Object.assign({}, process.env, {FIELDBOOK: ROOT}), encoding: 'utf8', maxBuffer: 64 << 20});
const out = (r.stdout || '') + (r.stderr || '');
const last = out.trim().split('\n').pop() || '';
process.stdout.write(out.replace(/\n?$/, '\n'));
if (r.status === 0 && /^ALL PASSED \(\d+\)$/.test(last)) {
  console.log(last);
  process.exit(0);
}
console.log('FAILURES: private-data (' + (last || 'no output') + ')');
process.exit(1);
