/* eslint-disable */
// Temp script to extract uncovered branch lines from coverage data
const cov = require('../coverage/coverage-final.json');
const targets = ['APIManager.js', 'LayerRenderer.js', 'AngleDimensionRenderer.js', 'SlideController.js', 'LayersValidator.js'];

for (const [f, data] of Object.entries(cov)) {
  const match = targets.find(t => f.endsWith(t));
  if (!match) continue;
  
  const bMap = data.branchMap;
  const b = data.b;
  const uncov = [];
  
  for (const [id, counts] of Object.entries(b)) {
    counts.forEach((c, i) => {
      if (c === 0 && bMap[id]) {
        const loc = bMap[id].locations ? bMap[id].locations[i] : bMap[id].loc;
        if (loc) uncov.push(loc.start.line);
      }
    });
  }
  
  uncov.sort((a, b2) => a - b2);
  const unique = [...new Set(uncov)];
  console.log(`\n${match} (${unique.length} uncovered branches):`);
  console.log(unique.join(', '));
}
