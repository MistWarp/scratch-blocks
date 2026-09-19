const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

for (const dispose of [false, true]) {
  test(`deferred duplication ${dispose ? 'ignores a disposed block' : 'creates and drags a live block'}`, () => {
    let deferred;
    let created = 0;
    let dragged = 0;
    let disabled = 0;
    const workspace = {
      setResizesEnabled() {},
      startDragWithFakeEvent() { dragged++; }
    };
    const oldBlock = {workspace, getSvgRoot() { return this.workspace ? {} : null; },
      getRelativeToSurfaceXY: () => ({x: 10, y: 20})};
    const newBlock = {getSvgRoot: () => ({}), moveBy() {}};
    const Blockly = {
      scratchBlocksUtils: {},
      Touch: {getTouchIdentifierFromEvent: () => 'mouse'},
      Xml: {blockToDom: () => ({}), domToBlock: () => { created++; return newBlock; }},
      Events: {
        disable() { disabled++; }, enable() { disabled--; }, isEnabled: () => disabled === 0,
        fire() {}, BlockCreate: function() {}
      }
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../core/scratch_blocks_utils.js'), 'utf8'), {
      Blockly, goog: {provide() {}, require() {}}, setTimeout(callback) { deferred = callback; }
    });
    Blockly.scratchBlocksUtils.changeObscuredShadowIds = () => {};
    Blockly.scratchBlocksUtils.duplicateAndDragCallback(oldBlock, {clientX: 10, clientY: 20})({});
    if (dispose) oldBlock.workspace = null;
    deferred();
    assert.equal(created, dispose ? 0 : 1);
    assert.equal(dragged, dispose ? 0 : 1);
    assert.equal(disabled, 0);
  });
}
