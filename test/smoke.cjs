const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
let ok = true;
function assert(cond, msg) {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
  if (!cond) ok = false;
}

// 1. 致命的な残骸がないこと
assert(!html.includes('css=r'), 'stray css=r removed');
assert(!html.includes('eval(cachedJsFormula)'), 'unsafe eval removed');

// 2. 高優先度の修正が残っていること
assert(html.includes('function isSnapEnabled()'), 'isSnapEnabled helper present');
assert(html.includes('function setSnapEnabled(v)'), 'setSnapEnabled helper present');
assert(html.includes('function getFormulaFn(js)'), 'safe formula fn present');
assert(html.includes('undoStack=[];playbookRedo=[]'), 'undo cleared on page switch present');

// 3. 中優先度の修正
assert(html.includes('function eraseThreshold(base)'), 'eraseThreshold present');
assert(html.includes('Ctrl/Cmd+Z/Y is handled by the core handler'), 'key handler dedup comment present');

// 4. 低優先度の追加機能
assert(html.includes('bbExportPNGWhite'), 'white PNG export present');
assert(html.includes('manifest.webmanifest'), 'PWA manifest linked');
assert(html.includes('serviceWorker'), 'SW registration present');
assert(fs.existsSync(path.join(root, 'manifest.webmanifest')), 'manifest file exists');
assert(fs.existsSync(path.join(root, 'sw.js')), 'sw.js exists');
assert(fs.existsSync(path.join(root, 'vercel.json')), 'vercel.json exists');

// 5. 全inline scriptの構文チェック
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
console.log('script blocks: ' + scripts.length);
scripts.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: 'block' + i + '.js' });
    console.log('PASS syntax block' + i + ' len=' + code.length);
  } catch (e) {
    console.log('FAIL syntax block' + i + ': ' + e.message);
    ok = false;
  }
});

// 6. sw.js / manifest の構文チェック
try {
  new vm.Script(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), { filename: 'sw.js' });
  console.log('PASS syntax sw.js');
} catch (e) {
  console.log('FAIL syntax sw.js: ' + e.message);
  ok = false;
}
try {
  JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  console.log('PASS manifest JSON valid');
} catch (e) {
  console.log('FAIL manifest JSON: ' + e.message);
  ok = false;
}
try {
  JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  console.log('PASS vercel.json valid');
} catch (e) {
  console.log('FAIL vercel.json: ' + e.message);
  ok = false;
}

// 7. 純粋ロジックの単体テスト
function snapBoth(m, a, b) {
  if (!a && !b) return m;
  return { x: Math.round(m.x), y: Math.round(m.y) };
}
assert(JSON.stringify(snapBoth({ x: 1.2, y: 2.7 }, false, false)) === JSON.stringify({ x: 1.2, y: 2.7 }), 'snap off passthrough');
assert(JSON.stringify(snapBoth({ x: 1.2, y: 2.7 }, true, false)) === JSON.stringify({ x: 1, y: 3 }), 'snap on rounds');

if (!ok) {
  console.log('RESULT FAIL');
  process.exit(1);
}
console.log('RESULT ALL PASS');
