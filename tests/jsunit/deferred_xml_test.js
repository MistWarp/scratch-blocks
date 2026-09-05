'use strict';

goog.require('goog.testing.MockClock');

// Exercise the renderer with real blocks while controlling viewport and time.
function deferredXmlTest(run) {
  var clock = new goog.testing.MockClock(true);
  var oldRaf = window.requestAnimationFrame;
  var oldDelay = Blockly.Xml.VIRTUAL_UNLOAD_DELAY_MS;
  var frames = [];
  window.requestAnimationFrame = function(callback) { frames.push(callback); };
  Blockly.Xml.VIRTUAL_UNLOAD_DELAY_MS = 0;
  Blockly.Blocks.deferred_test = {
    init: function() {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('initial'), 'TEXT');
      this.appendValueInput('VALUE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#123456');
    }
  };
  Blockly.Blocks.deferred_number = {
    init: function() {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(0), 'NUM');
      this.setOutput(true);
      this.setColour('#123456');
    }
  };
  var ws = Blockly.inject('blocklyDiv', {scrollbars: true});
  var view = {viewLeft: 0, viewTop: 0, viewWidth: 600, viewHeight: 480};
  ws.getMetrics = function() { return view; };
  ws.resizeContents = function() {};
  var ctx = {
    blocks: {
      near: {id: 'near', opcode: 'deferred_test', topLevel: true,
        x: 10, y: 10, inputs: {}, fields: {TEXT: {name: 'TEXT', value: 'near'}}},
      far: {id: 'far', opcode: 'deferred_test', topLevel: true,
        x: 100000, y: 10, inputs: {}, fields: {TEXT: {name: 'TEXT', value: 'far'}}}
    },
    scripts: ['near', 'far'],
    comments: {}
  };
  var flush = function() {
    for (var i = 0; frames.length && i < 20; i++) {
      var batch = frames;
      frames = [];
      batch.forEach(function(callback) { callback(); });
    }
    assertEquals('Idle workspaces must stop requesting frames', 0, frames.length);
  };
  Blockly.Events.disable();
  try {
    run(ws, ctx, view, flush, clock);
  } finally {
    ws.dispose();
    Blockly.Events.enable();
    window.requestAnimationFrame = oldRaf;
    Blockly.Xml.VIRTUAL_UNLOAD_DELAY_MS = oldDelay;
    clock.dispose();
    delete Blockly.Blocks.deferred_test;
    delete Blockly.Blocks.deferred_number;
  }
}

function test_deferredLoadViewportAndExport() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    var done = 0;
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(
        Blockly.Xml.textToDom('<xml/>'), ws, {onDone: function() { done++; }}, ctx);
    assertEquals('Only nearby scripts need placeholder SVG nodes', 1,
        ws.getCanvas().querySelectorAll('.blocklyScriptPlaceholder').length);
    flush();
    assertNotNull(ws.getBlockById('near'));
    assertNull(ws.getBlockById('far'));
    assertEquals(2, ws.getTotalBlockCount());
    assertEquals(1, done);
    var exported = Blockly.Xml.workspaceToDom(ws);
    assertEquals(2, exported.getElementsByTagName('block').length);
    assertNotNull(ws.getBlockById('far'));
    flush();
    assertEquals('onDone is called once', 1, done);
  });
}

function test_deferredUnloadPreservesEditsAndUndo() {
  deferredXmlTest(function(ws, ctx, view, flush, clock) {
    ctx.blocks.cold = {id: 'cold', opcode: 'deferred_test', topLevel: true,
      x: 200000, y: 10, inputs: {}, fields: {TEXT: {name: 'TEXT', value: 'cold'}}};
    ctx.scripts.push('cold');
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    var block = ws.getBlockById('near');
    block.setFieldValue('edited', 'TEXT');
    ctx.blocks.near.fields.TEXT.value = 'edited';
    ws.undoStack_.push(new Blockly.Events.BlockChange(block, 'field', 'TEXT', 'near', 'edited'));
    view.viewLeft = 100000;
    flush();
    clock.tick(2000);
    flush();
    assertNull('Offscreen script was unloaded', ws.getBlockById('near'));
    ws.undo(false);
    assertEquals('Undo finds an unloaded block', 'near', ws.getBlockById('near').getFieldValue('TEXT'));
    assertNull('Undo leaves unrelated scripts unloaded', ws.getBlockById('cold'));
  });
}

function test_deferredMovedScriptStaysLoaded() {
  deferredXmlTest(function(ws, ctx, view, flush, clock) {
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    var block = ws.getBlockById('near');
    block.moveBy(100000, 0);
    ctx.blocks.near.x += 100000;
    view.viewLeft = 100000;
    clock.tick(2000);
    flush();
    assertEquals('Use the current position when deciding to unload', block, ws.getBlockById('near'));
  });
}

function test_deferredCancelDoesNotResurrectBlocks() {
  deferredXmlTest(function(ws, ctx, view, flush, clock) {
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    ws.clear();
    flush();
    clock.tick(4000);
    flush();
    assertEquals(0, ws.getAllBlocks().length);
    assertNull(ws.deferredRenderHandle_);
  });
}

function test_descriptionsPreserveCommentsAndCollapsedState() {
  deferredXmlTest(function(ws, ctx) {
    ctx.blocks.near.collapsed = true;
    ctx.blocks.near.comment = 'comment';
    ctx.comments.comment = {id: 'comment', text: 'note', x: 200, y: 150,
      width: 160, height: 100, minimized: true, colour: '#abcdef'};
    Blockly.Xml.clearWorkspaceAndLoadFromDescs(Blockly.Xml.textToDom('<xml/>'), ctx, ws);
    var block = ws.getBlockById('near');
    assertTrue(block.isCollapsed());
    var comment = Blockly.Xml.blockToDom(block).getElementsByTagName('comment')[0];
    assertEquals('note', comment.textContent);
    assertEquals('200', comment.getAttribute('x'));
    assertEquals('150', comment.getAttribute('y'));
  });
}

function test_descriptionsRespawnObscuredShadows() {
  deferredXmlTest(function(ws, ctx) {
    ctx.blocks.near.inputs.VALUE = {name: 'VALUE', block: 'active', shadow: 'shadow'};
    ctx.blocks.active = {id: 'active', opcode: 'deferred_number', topLevel: false,
      inputs: {}, fields: {NUM: {name: 'NUM', value: 99}}};
    ctx.blocks.shadow = {id: 'shadow', opcode: 'deferred_number', topLevel: false, shadow: true,
      inputs: {}, fields: {NUM: {name: 'NUM', value: 12}}};
    Blockly.Xml.clearWorkspaceAndLoadFromDescs(Blockly.Xml.textToDom('<xml/>'), ctx, ws);
    ws.getBlockById('active').outputConnection.disconnect();
    var shadow = ws.getBlockById('near').getInputTargetBlock('VALUE');
    assertTrue(shadow.isShadow());
    assertEquals('12', shadow.getFieldValue('NUM'));
  });
}

function test_deferredXmlProcedurePrototypeShadows() {
  var xml = Blockly.Xml.textToDom('<xml><block type="procedures_definition">' +
      '<value name="custom_block"><shadow type="procedures_prototype">' +
      '<mutation proccode="offscreen procedure"/></shadow></value></block></xml>');
  var mutations = Blockly.Procedures.deferredProcedureMutations_({
    getDeferredScripts: function() { return [{xmlNode: xml.firstChild}]; }
  });
  assertEquals(1, mutations.length);
  assertEquals('offscreen procedure', mutations[0].getAttribute('proccode'));
}

function test_deferredCollapsedFrameLoadsOnlyAffectedScripts() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    ctx.blocks.cold = {id: 'cold', opcode: 'deferred_test', topLevel: true,
      x: 200000, y: 10, inputs: {}, fields: {TEXT: {name: 'TEXT', value: 'cold'}}};
    ctx.scripts.push('cold');
    var xml = Blockly.Xml.textToDom('<xml><frame id="frame" x="100000" y="0" ' +
        'w="600" h="400" collapsed="true" blocks="far">Frame</frame></xml>');
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(xml, ws, {}, ctx);
    flush();
    assertNull(ws.getBlockById('far'));
    ws.materializeScriptsForBlockIds(['far']);
    assertEquals('Collapsed frame hides newly rendered scripts', 'none', ws.getBlockById('far').getSvgRoot().style.display);
    ws.getBlockById('far').setIntersects(false);
    ws.getBlockById('far').setIntersects(true);
    assertEquals('Viewport changes keep frame members hidden', 'none', ws.getBlockById('far').getSvgRoot().style.display);
    ws.getFrameById('frame').setCollapsed(false);
    assertEquals('', ws.getBlockById('far').getSvgRoot().style.display);
    assertNull('Unrelated scripts stay unloaded', ws.getBlockById('cold'));
  });
}

function test_deferredTargetedLoadingUsesCurrentParentDescriptions() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    ctx.blocks.far.next = 'child';
    ctx.blocks.child = {id: 'child', opcode: 'deferred_test', parent: 'far', topLevel: false,
      inputs: {}, fields: {TEXT: {name: 'TEXT', value: 'child'}}};
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    ctx.blocks.far = Object.assign({}, ctx.blocks.far, {
      fields: {TEXT: {name: 'TEXT', value: 'updated'}}
    });
    ws.materializeScriptsForBlockIds(['child']);
    assertEquals('far', ws.getBlockById('child').getRootBlock().id);
    assertEquals('updated', ws.getBlockById('far').getFieldValue('TEXT'));
  });
}
