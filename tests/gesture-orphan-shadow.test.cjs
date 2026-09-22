const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const loadGesture = () => {
  const Blockly = {};
  vm.runInNewContext(
    fs.readFileSync(require.resolve('../core/gesture.js'), 'utf8'),
    {Blockly, goog: {provide() {}, require() {}, asserts: {assert() {}}}}
  );
  return Blockly;
};

const makeBlock = (id, shadow, parent) => ({
  id,
  isInFlyout: false,
  isShadow: () => shadow,
  getParent: () => parent,
  getRootBlock() { return parent ? parent.getRootBlock() : this; }
});

const startOn = block => {
  const Blockly = loadGesture();
  Blockly.scratchBlocksUtils = {isShadowArgumentReporter: () => false};
  const gesture = Object.create(Blockly.Gesture.prototype);
  gesture.setStartBlock(block);
  return gesture;
};

test('a shadow targets its first non-shadow parent', () => {
  const parent = makeBlock('parent', false, null);
  const outer = makeBlock('outer', true, parent);
  const inner = makeBlock('inner', true, outer);
  assert.equal(startOn(inner).targetBlock_, parent);
});

test('a shadow without a parent targets itself', () => {
  const orphan = makeBlock('orphan', true, null);
  assert.equal(startOn(orphan).targetBlock_, orphan);
});

test('a shadow inside an orphaned shadow targets the topmost shadow', () => {
  const orphan = makeBlock('orphan', true, null);
  const inner = makeBlock('inner', true, orphan);
  assert.equal(startOn(inner).targetBlock_, orphan);
});
