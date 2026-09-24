const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const load = () => {
  const Blockly = {utils: {getRelativeXY: element => ({x: element.x, y: element.y})}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../core/intersection_observer.js'), 'utf8'), {
    Blockly, goog: {provide() {}, require() {}}, window: {}
  });
  return Blockly;
};

const makeWorkspace = () => {
  const canvas = {x: 0, y: 0};
  return {
    scale: 1, RTL: false, isDragSurfaceActive_: false,
    getParentSvg: () => ({width: {baseVal: {value: 800}}, height: {baseVal: {value: 600}}}),
    getCanvas: () => canvas,
    canvas
  };
};

const makeBlock = (x, y) => {
  const block = {
    x, y, rendered: true, intersects_: true, measured: 0, states: [],
    getRelativeToSurfaceXY() { return {x: this.x, y: this.y}; },
    getHeightWidth() { this.measured++; return {width: 100, height: 50}; },
    setIntersects(visible) { this.intersects_ = visible; this.states.push(visible); }
  };
  return block;
};

test('a check with an unchanged viewport only revisits blocks that moved', () => {
  const Blockly = load();
  const workspace = makeWorkspace();
  const observer = new Blockly.IntersectionObserver(workspace);
  const near = makeBlock(10, 10);
  const far = makeBlock(5000, 5000);
  observer.observe(near);
  observer.observe(far);
  observer.checkForIntersections();
  assert.equal(near.intersects_, true);
  assert.equal(far.intersects_, false);
  assert.equal(near.measured, 1);
  assert.equal(far.measured, 0);

  observer.checkForIntersections();
  assert.equal(near.measured, 1);
  assert.equal(far.measured, 0);

  far.x = 20;
  far.y = 20;
  observer.markDirty(far);
  observer.checkForIntersections();
  assert.equal(near.measured, 1);
  assert.equal(far.measured, 1);
  assert.equal(far.intersects_, true);
});

test('moving the viewport revisits every observed block', () => {
  const Blockly = load();
  const workspace = makeWorkspace();
  const observer = new Blockly.IntersectionObserver(workspace);
  const blocks = [makeBlock(10, 10), makeBlock(900, 10), makeBlock(10, 700)];
  blocks.forEach(block => observer.observe(block));
  observer.checkForIntersections();
  assert.deepEqual(blocks.map(block => block.intersects_), [true, false, false]);

  workspace.canvas.x = -500;
  observer.checkForIntersections();
  assert.deepEqual(blocks.map(block => block.measured), [2, 1, 0]);
  assert.deepEqual(blocks.map(block => block.intersects_), [false, true, false]);

  workspace.scale = 0.5;
  workspace.canvas.x = 0;
  observer.checkForIntersections();
  assert.deepEqual(blocks.map(block => block.intersects_), [true, true, true]);
});

test('blocks past the bottom or right edge are hidden without being measured', () => {
  const Blockly = load();
  const workspace = makeWorkspace();
  const observer = new Blockly.IntersectionObserver(workspace);
  const blocks = [makeBlock(900, 10), makeBlock(10, 700), makeBlock(-200, 10), makeBlock(10, -100)];
  blocks.forEach(block => observer.observe(block));
  observer.checkForIntersections();
  assert.deepEqual(blocks.map(block => block.intersects_), [false, false, false, false]);
  assert.deepEqual(blocks.map(block => block.measured), [0, 0, 1, 1]);

  workspace.RTL = true;
  blocks[0].x = 850;
  observer.markDirty(blocks[0]);
  observer.checkForIntersections();
  assert.equal(blocks[0].measured, 1);
  assert.equal(blocks[0].intersects_, true);
});

test('dirty marks are ignored for unobserved blocks and cleared by unobserveAll', () => {
  const Blockly = load();
  const workspace = makeWorkspace();
  const observer = new Blockly.IntersectionObserver(workspace);
  const block = makeBlock(10, 10);
  observer.markDirty(block);
  assert.equal(observer.dirty_.length, 0);
  observer.observe(block);
  assert.equal(observer.dirty_.length, 1);
  observer.checkForIntersections();
  observer.markDirty(block);
  assert.equal(block.intersectionDirty_, true);
  observer.unobserveAll();
  assert.equal(observer.dirty_.length, 0);
  assert.equal(block.intersectionDirty_, false);
  assert.equal(block.intersectionObserved_, false);
  observer.checkForIntersections();
  assert.equal(block.measured, 1);
});

test('unobserving a block drops it from a pending dirty pass', () => {
  const Blockly = load();
  const workspace = makeWorkspace();
  const observer = new Blockly.IntersectionObserver(workspace);
  const block = makeBlock(10, 10);
  observer.observe(block);
  observer.checkForIntersections();
  observer.markDirty(block);
  observer.unobserve(block);
  observer.checkForIntersections();
  assert.equal(block.measured, 1);
  assert.equal(observer.dirty_.length, 0);
});
