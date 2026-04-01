#!/usr/bin/env node
'use strict';
const cov = require('../coverage/coverage-final.json');
const target = process.argv[2] || 'LayerRenderer.js';
const keys = Object.keys(cov).filter(k => k.replace(/\\/g,'/').endsWith(target));
if (keys.length === 0) {
  console.log('No match for', target);
  console.log('Available:', Object.keys(cov).filter(k => k.includes('LayerRenderer')).map(k=>k.split('/').pop()));
  process.exit(1);
}
const key = keys[0];
console.log('File:', key.split('/').pop());
const b = cov[key].branchMap;
const bc = cov[key].b;
const uncov = [];
for (const [id, info] of Object.entries(b)) {
  const counts = bc[id];
  counts.forEach((c, i) => {
    if (c === 0) uncov.push({ id, line: info.loc.start.line, type: info.type, branch: i });
  });
}
const total = Object.values(bc).reduce((sum, arr) => sum + arr.length, 0);
const covered = Object.values(bc).reduce((sum, arr) => sum + arr.filter(c => c > 0).length, 0);
console.log(`Branches: ${covered}/${total} (${(covered/total*100).toFixed(1)}%), uncovered: ${uncov.length}`);
uncov.sort((a, b) => a.line - b.line);
uncov.forEach(u => console.log(`  Line ${u.line}: ${u.type} branch ${u.branch}`));
