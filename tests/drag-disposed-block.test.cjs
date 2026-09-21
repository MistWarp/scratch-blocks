const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const load = (Blockly, file) => vm.runInNewContext(
  fs.readFileSync(require.resolve(`../core/${file}`), 'utf8'),
  {Blockly, goog: {provide() {}, require() {}, asserts: {assert() {}}}, document: {
    getElementsByClassName: () => [{style: {}}]
  }}
);

const setup = () => {
  const calls = [];
  const surface = {
    SVG_: {style: {display: 'block'}},
    dragGroup_: {childNodes: [], removeChild() { calls.push('removeChild'); }},
    getCurrentBlock: () => null
  };
  const workspace = {
    id: 'main',
    rendered: true,
    getBlockDragSurface: () => surface,
    setResizesEnabled: enabled => calls.push(`resizes:${enabled}`),
    getToolbox: () => ({removeStyle: style => calls.push(`removeStyle:${style}`)})
  };
  const fired = [];
  const Blockly = {
    BlockAnimations: {disconnectUiStop: () => calls.push('disconnectUiStop')},
    Events: {
      EndBlockDrag: function(block, isOutside) {
        this.blockId = block.id;
        this.workspaceId = block.workspace ? block.workspace.id : '';
        this.isOutside = isOutside;
      },
      fire: event => fired.push(event),
      setGroup: group => calls.push(`group:${group}`)
    },
    longStop_: () => {}
  };
  load(Blockly, 'block_drag_surface.js');
  load(Blockly, 'block_dragger.js');
  load(Blockly, 'gesture.js');
  const block = {id: 'dragged', workspace: null};
  const dragger = Object.create(Blockly.BlockDragger.prototype);
  dragger.draggingBlock_ = block;
  dragger.workspace_ = workspace;
  dragger.dragBlock = () => { throw new Error('dragged a disposed block'); };
  dragger.endBlockDrag = () => { throw new Error('ended a drag on a disposed block'); };
  const gesture = Object.create(Blockly.Gesture.prototype);
  Object.assign(gesture, {
    isDraggingBlock_: true,
    isEnding_: false,
    targetBlock_: block,
    blockDragger_: dragger,
    updateFromEvent_() {},
    dispose() { calls.push('dispose'); }
  });
  surface.clearAndHide = Blockly.BlockDragSurfaceSvg.prototype.clearAndHide;
  return {gesture, surface, calls, fired};
};

for (const handler of ['handleMove', 'handleUp', 'cancel']) {
  test(`${handler} abandons a drag whose block was disposed`, () => {
    const {gesture, surface, calls, fired} = setup();
    gesture[handler]({preventDefault() {}, stopPropagation() {}});
    assert.equal(surface.SVG_.style.display, 'none');
    assert.ok(!calls.includes('removeChild'));
    assert.ok(calls.includes('resizes:true'));
    assert.ok(calls.includes('group:false'));
    assert.ok(calls.includes('dispose'));
    assert.equal(fired.length, 1);
    assert.equal(fired[0].workspaceId, 'main');
    assert.equal(fired[0].isOutside, false);
  });
}
