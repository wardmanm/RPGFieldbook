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
/* What the private repo still has to commit or push (#90): its clone is shared by
   every worktree, so a change that regenerated a private pack leaves its files
   there. NOTE lines, never a failure; run.sh shows them under the suite. */
for (const py of ['python3', 'python']) {
  const s = spawnSync(py, [path.join(ROOT, 'scripts', 'sync-private.py'), '--status', '--private', P], {encoding: 'utf8'});
  if (s.error || s.status !== 0) continue;
  if (s.stdout.trim()) process.stdout.write(s.stdout.replace(/\n?$/, '\n'));
  break;
}
if (r.status === 0 && /^ALL PASSED \(\d+\)$/.test(last)) {
  console.log(last);
  process.exit(0);
}
console.log('FAILURES: private-data (' + (last || 'no output') + ')');
process.exit(1);
