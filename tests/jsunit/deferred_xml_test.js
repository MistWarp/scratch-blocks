'use strict';

goog.require('goog.testing.MockClock');

// Exercise the renderer with real blocks while controlling viewport and time.
function deferredXmlTest(run) {
  var clock = new goog.testing.MockClock(true);
  var oldRaf = window.requestAnimationFrame;
  var oldCache = Blockly.Xml.VIRTUAL_CACHE_BLOCKS;
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
    Blockly.Xml.VIRTUAL_CACHE_BLOCKS = oldCache;
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
    Blockly.Xml.VIRTUAL_CACHE_BLOCKS = 0;
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

function test_descriptionBuilderYieldsWithinOneLargeStack() {
  deferredXmlTest(function(ws) {
    var ctx = {blocks: {}, comments: {}};
    for (var i = 0; i < 300; i++) {
      ctx.blocks['b' + i] = {id: 'b' + i, opcode: 'deferred_test', inputs: {},
        fields: {TEXT: {name: 'TEXT', value: String(i)}}, next: i < 299 ? 'b' + (i + 1) : null};
    }
    var builder = Blockly.Xml.createDescBlockBuilder_(ctx.blocks.b0, ctx, ws, true);
    assertFalse(builder.step());
    assertEquals('One step creates one block, not the whole stack', 1, ws.getAllBlocks().length);
    while (!builder.step()) {}
    assertEquals(300, builder.root.getDescendants(false).length);
    assertEquals('299', ws.getBlockById('b299').getFieldValue('TEXT'));
    var disposer = Blockly.Xml.createBlockDisposer_(builder.root);
    assertFalse(disposer.step());
    assertEquals('One disposal step removes one leaf', 299, ws.getAllBlocks().length);
    while (!disposer.step()) {}
    assertEquals(0, ws.getAllBlocks().length);
    assertTrue('Disposal restores event recording', Blockly.Events.recordUndo);
  });
}

function test_connectRenderedStatementsAlignsConnections() {
  deferredXmlTest(function(ws) {
    var parent = ws.newBlock('deferred_test');
    var child = ws.newBlock('deferred_test');
    parent.initSvg();
    child.initSvg();
    parent.render();
    child.render();
    parent.moveBy(120, 80);
    child.moveBy(350, 200);
    parent.nextConnection.connect(child.previousConnection);
    assertEquals(parent, child.getParent());
    assertEquals('Connected notches must share a position', 0,
        parent.nextConnection.distanceFrom(child.previousConnection));
  });
}

function test_dragInsertKeepsStackInPlaceAndAttachesOnRelease() {
  deferredXmlTest(function(ws) {
    var parent = ws.newBlock('deferred_test');
    var child = ws.newBlock('deferred_test');
    var inserted = ws.newBlock('deferred_test');
    [parent, child, inserted].forEach(function(block) {
      block.initSvg();
      block.render();
    });
    parent.moveBy(120, 80);
    parent.nextConnection.connect(child.previousConnection);
    // Establish an aligned starting stack independently of connect's reflow.
    parent.render();
    inserted.moveBy(400, 300);
    ws.isDeleteArea = function() { return Blockly.DELETE_AREA_NONE; };
    ws.isInsideBlocksArea = function() { return true; };
    var dragger = new Blockly.BlockDragger(inserted, ws);
    var origin = parent.getRelativeToSurfaceXY();
    var delta = new goog.math.Coordinate(
        parent.nextConnection.x_ - inserted.previousConnection.x_ + 3,
        parent.nextConnection.y_ - inserted.previousConnection.y_ + 3);
    try {
      dragger.startBlockDrag(new goog.math.Coordinate(0, 0));
      dragger.dragBlock({}, delta, true);
      assertEquals('Preview must keep the existing stack aligned', 0,
          child.previousConnection.distanceFrom(child.previousConnection.targetConnection));
      dragger.endBlockDrag({}, delta);
      assertEquals(inserted, parent.getNextBlock());
      assertEquals(child, inserted.getNextBlock());
      assertEquals(0, parent.nextConnection.distanceFrom(inserted.previousConnection));
      assertEquals(0, inserted.nextConnection.distanceFrom(child.previousConnection));
      assertEquals(origin.x, parent.getRelativeToSurfaceXY().x);
      assertEquals(origin.y, parent.getRelativeToSurfaceXY().y);
    } finally {
      dragger.dispose();
    }
  });
}

function test_asyncWorkspaceClearCancellationUsesNewestTarget() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    for (var i = 0; i < 120; i++) ws.newBlock('deferred_test', 'old' + i);
    var obsolete = 0;
    var first = Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(
        Blockly.Xml.textToDom('<xml/>'), ws, {onDone: function() { obsolete++; }}, ctx);
    assertEquals('Clearing yields before disposal', 120, ws.getAllBlocks().length);
    first.cancel();
    var replacement = {blocks: {newest: {id: 'newest', opcode: 'deferred_test',
      topLevel: true, x: 10, y: 10, fields: {}, inputs: {}}}, scripts: ['newest'], comments: {}};
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, replacement);
    flush();
    assertEquals(0, obsolete);
    assertEquals(1, ws.getAllBlocks().length);
    assertNotNull(ws.getBlockById('newest'));
    assertNull(ws.getBlockById('near'));
  });
}

function test_unchangedTextInputDoesNotRenderOrResize() {
  var oldInput = Blockly.FieldTextInput.htmlInput_;
  var input = {value: 'unchanged', oldValue_: 'unchanged'};
  var renders = 0;
  var resizes = 0;
  Blockly.FieldTextInput.htmlInput_ = input;
  try {
    Blockly.FieldTextInput.prototype.onHtmlInputChange_.call({
      sourceBlock_: {render: function() { renders++; }},
      resizeEditor_: function() { resizes++; }
    }, {type: 'keyup'});
    assertEquals(0, renders);
    assertEquals(0, resizes);
  } finally {
    Blockly.FieldTextInput.htmlInput_ = oldInput;
  }
}

function test_textEditReflowsEnclosingInputAndKeepsStatementsAligned() {
  deferredXmlTest(function(ws, ctx) {
    Blockly.Blocks.deferred_surround = {init: function() {
      this.appendStatementInput('BODY');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#123456');
    }};
    try {
      ctx.blocks = {outer: {id: 'outer', opcode: 'deferred_surround', inputs: {
        BODY: {name: 'BODY', block: 'edit0'}}, fields: {}}};
      ctx.scripts = ['outer'];
      for (var i = 0; i < 100; i++) {
        ctx.blocks['edit' + i] = {id: 'edit' + i, opcode: 'deferred_test',
          inputs: {}, fields: {TEXT: {name: 'TEXT', value: 'short'}},
          next: i < 99 ? 'edit' + (i + 1) : null};
      }
      Blockly.Xml.descsToWorkspace_(ctx, ws);
      var width = ws.getBlockById('outer').width;
      ws.getBlockById('edit99').setFieldValue('a substantially wider input value', 'TEXT');
      assertTrue('The enclosing statement still grows', ws.getBlockById('outer').width > width);
      for (var i = 0; i < 100; i++) {
        var connection = ws.getBlockById('edit' + i).previousConnection;
        assertEquals('Editing must preserve statement alignment', 0,
            connection.distanceFrom(connection.targetConnection));
      }
    } finally {
      delete Blockly.Blocks.deferred_surround;
    }
  });
}

function test_deferredCacheRetainsVisitedScripts() {
  deferredXmlTest(function(ws, ctx, view, flush, clock) {
    var progress = [];
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {
      onProgress: function(value) { progress.push(value.phase); }
    }, ctx);
    flush();
    var near = ws.getBlockById('near');
    near.setFieldValue('cached edit', 'TEXT');
    view.viewLeft = 100000;
    ws.wakeVirtualScripts_();
    flush();
    clock.tick(130000);
    flush();
    assertEquals('Offscreen scripts below the cache budget keep their blocks', near, ws.getBlockById('near'));
    view.viewLeft = 0;
    ws.wakeVirtualScripts_();
    flush();
    assertEquals('cached edit', ws.getBlockById('near').getFieldValue('TEXT'));
    assertEquals('Progress settles again after scrolling', 'idle', progress[progress.length - 1]);
  });
}

function test_deferredBrokenScriptDoesNotBlockOtherScripts() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    ctx.blocks.near.opcode = 'unknown_test_block';
    ctx.blocks.far.x = 50;
    var status;
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {
      onProgress: function(value) { status = value; }
    }, ctx);
    flush();
    assertNotNull(ws.getBlockById('far'));
    assertEquals('error', status.phase);
    assertEquals(1, status.failures);
  });
}

function test_deferredProgressReportsWorkAndCompletion() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    var oldNow = performance.now;
    var oldBudget = Blockly.Xml.DEFERRED_RENDER_BUDGET_MS;
    var time = 0;
    var updates = [];
    // Make each frame do one step so even this tiny script spans all phases.
    Blockly.Xml.DEFERRED_RENDER_BUDGET_MS = 2;
    performance.now = function() { return time++; };
    try {
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {
        onProgress: function(value) { updates.push(value); }
      }, ctx);
      flush();
      var phases = updates.map(function(update) { return update.phase; });
      assertTrue(phases.indexOf('building') !== -1);
      assertTrue(phases.indexOf('drawing') !== -1);
      assertTrue(phases.indexOf('layout') !== -1);
      assertEquals('idle', phases[phases.length - 1]);
      updates.forEach(function(update) {
        assertTrue(update.completed >= 0 && update.completed <= update.total);
      });
    } finally {
      performance.now = oldNow;
      Blockly.Xml.DEFERRED_RENDER_BUDGET_MS = oldBudget;
    }
  });
}
