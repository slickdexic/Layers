// Temporary script to analyze uncovered branches
// Clear require cache to get fresh data
delete require.cache[require.resolve('../coverage/coverage-final.json')];
const cov = require('../coverage/coverage-final.json');
const targets = ['LayerPanel','LayerDragDrop','HistoryManager','ArrowRenderer','DimensionRenderer','SlideController','GroupManager','CanvasEvents','CalloutRenderer','ShapeRenderer','ToolbarStyleControls','LayerRenderer','SelectionManager','PropertiesForm','TransformController','APIManager'];
const results = [];
for (const [file, data] of Object.entries(cov)) {
  const base = file.replace(/.*[\\\/]/, '').replace('.js','');
  if (targets.indexOf(base) === -1) continue;
  const b = data.b;
  let uncov = 0, total = 0;
  for (const k of Object.keys(b)) {
    for (let i = 0; i < b[k].length; i++) {
      total++;
      if (b[k][i] === 0) uncov++;
    }
  }
  if (uncov > 0) results.push({ base, uncov, total, pct: (100*(total-uncov)/total).toFixed(1) });
}
results.sort((a,b) => b.uncov - a.uncov);
for (const r of results) {
  console.log(r.base + ': ' + r.uncov + '/' + r.total + ' uncov (' + r.pct + '%)');
}
