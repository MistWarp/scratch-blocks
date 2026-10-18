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
  // Run only the frames requested so far.
  flush.step = function() {
    var batch = frames;
    frames = [];
    batch.forEach(function(callback) { callback(); });
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

function test_deferredSettleWaitsForScrollingToStop() {
  deferredXmlTest(function(ws, ctx, view, flush, clock) {
    var done = 0;
    ws.markUserScroll();
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(
        Blockly.Xml.textToDom('<xml/>'), ws, {onDone: function() { done++; }}, ctx);
    flush();
    assertNotNull('Scripts still load while scrolling', ws.getBlockById('near'));
    assertEquals('Settling waits until scrolling stops', 0, done);
    ws.lastScrollTime_ = 0;
    clock.tick(Blockly.Xml.DEFERRED_SCROLL_IDLE_MS);
    flush();
    assertEquals(1, done);
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
    // Force the frame-by-frame clear, which normally only big workspaces use.
    var oldMax = Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS;
    Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS = 100;
    try {
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
    } finally {
      Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS = oldMax;
    }
  });
}

function test_loadSkipsToolboxRefreshWhenFlyoutWasRebuilt() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    var oldRefresh = ws.refreshToolboxSelection_;
    var refreshes = 0;
    ws.refreshToolboxSelection_ = function() { refreshes++; };
    try {
      // Only count refreshes from the load finishing, not from re-enabling
      // toolbox refresh synchronously (which the GUI turns off anyway).
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
      refreshes = 0;
      flush();
      assertEquals('Nothing rebuilt the flyout, so the load refreshes it', 1, refreshes);

      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
      refreshes = 0;
      // The GUI rebuilds the toolbox for the new sprite mid-load.
      ws.flyoutShowCount_ = (ws.flyoutShowCount_ || 0) + 1;
      flush();
      assertEquals('A flyout rebuilt during the load is already current', 0, refreshes);
    } finally {
      ws.refreshToolboxSelection_ = oldRefresh;
    }
  });
}

function test_clearDoesNotRespawnShadowsOfDisposedBlocks() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    var created = 0;
    var oldDomToBlock = Blockly.Xml.domToBlock;
    Blockly.Xml.domToBlock = function() {
      created++;
      return oldDomToBlock.apply(this, arguments);
    };
    try {
      ws.clear();
    } finally {
      Blockly.Xml.domToBlock = oldDomToBlock;
    }
    assertEquals(0, created);
    assertEquals(0, ws.getAllBlocks().length);
    assertEquals(0, ws.getCanvas().childNodes.length);
  });
}

function test_smallWorkspaceClearsWithoutWaitingForFrames() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    for (var i = 0; i < 120; i++) ws.newBlock('deferred_test', 'old' + i);
    var done = 0;
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(
        Blockly.Xml.textToDom('<xml/>'), ws, {onDone: function() { done++; }}, ctx);
    assertNull('Old blocks are gone before the first frame', ws.getBlockById('old0'));
    assertEquals('Canvas stays visible', '', ws.getCanvas().style.visibility);
    flush();
    assertEquals(1, done);
    assertNull(ws.getBlockById('old119'));
  });
}

function test_firstFrameRendersVisibleScriptsPastNormalBudget() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    var oldNow = performance.now;
    var oldBudget = Blockly.Xml.DEFERRED_RENDER_BUDGET_MS;
    var time = 0;
    // Each step costs one fake millisecond, so the normal budget alone could
    // never finish a script in one frame.
    Blockly.Xml.DEFERRED_RENDER_BUDGET_MS = 2;
    performance.now = function() { return time++; };
    try {
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
      flush.step();
      var root = ws.getBlockById('near');
      assertNotNull('The on-screen script is built in the first frame', root);
      assertNotEquals('and shown', 'hidden', root.getSvgRoot().style.visibility);
      flush();
    } finally {
      performance.now = oldNow;
      Blockly.Xml.DEFERRED_RENDER_BUDGET_MS = oldBudget;
    }
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
    var oldFirst = Blockly.Xml.DEFERRED_FIRST_FRAME_BUDGET_MS;
    var time = 0;
    var updates = [];
    // Make each frame do one step so even this tiny script spans all phases.
    Blockly.Xml.DEFERRED_RENDER_BUDGET_MS = 2;
    Blockly.Xml.DEFERRED_FIRST_FRAME_BUDGET_MS = 0;
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
      Blockly.Xml.DEFERRED_FIRST_FRAME_BUDGET_MS = oldFirst;
    }
  });
}

function test_deferredNestedLayoutMatchesSynchronousLayout() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    ctx = {blocks: {}, scripts: ['repeat0'], comments: {}};
    for (var i = 0; i < 30; i++) {
      var id = 'repeat' + i;
      var number = 'number' + i;
      ctx.blocks[id] = {id: id, opcode: 'control_repeat', topLevel: i === 0,
        x: 20, y: 30, fields: {}, inputs: {
          TIMES: {name: 'TIMES', block: number, shadow: number},
          SUBSTACK: {name: 'SUBSTACK', block: i < 29 ? 'repeat' + (i + 1) : 'leaf'}
        }};
      ctx.blocks[number] = {id: number, opcode: 'math_number', shadow: true,
        fields: {NUM: {name: 'NUM', value: i}}, inputs: {}};
    }
    ctx.blocks.leaf = {id: 'leaf', opcode: 'patching_jscommand', fields: {},
      mutation: {tagName: 'mutation', itemcount: '2', children: []}, inputs: {
        ARG1: {name: 'ARG1', block: 'code', shadow: 'code'},
        ARG2: {name: 'ARG2', block: 'value', shadow: 'value'}
      }};
    ctx.blocks.code = {id: 'code', opcode: 'text', shadow: true, inputs: {},
      fields: {TEXT: {name: 'TEXT', value: 'console.log(value)'}}};
    ctx.blocks.value = {id: 'value', opcode: 'text', shadow: true, inputs: {},
      fields: {TEXT: {name: 'TEXT', value: 'nested argument'}}};
    Blockly.Xml.clearWorkspaceAndLoadFromDescs(Blockly.Xml.textToDom('<xml/>'), ctx, ws);
    var positions = {};
    ws.getAllBlocks().forEach(function(block) {
      positions[block.id] = block.getRelativeToSurfaceXY();
    });
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    ws.getAllBlocks().forEach(function(block) {
      var xy = block.getRelativeToSurfaceXY();
      assertEquals(block.id + ' x', positions[block.id].x, xy.x);
      assertEquals(block.id + ' y', positions[block.id].y, xy.y);
      block.getConnections_(true).forEach(function(connection) {
        if (connection.isConnected()) assertEquals('Connections align', 0,
            connection.distanceFrom(connection.targetConnection));
      });
      assertUndefined(block.deferredRenderXY_);
    });
    assertEquals('Finished script is visible', '', ws.getBlockById('repeat0').getSvgRoot().style.display);
  });
}

// Blocks that the VM holds in a slot the editor would not let you drop them in.
function defineMismatchBlocks() {
  Blockly.Blocks.deferred_bool_slot = {
    init: function() {
      this.appendValueInput('COND').setCheck('Boolean');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#123456');
    }
  };
  Blockly.Blocks.deferred_round = {
    init: function() {
      this.setOutput(true, 'Number');
      this.setColour('#123456');
    }
  };
}

function deleteMismatchBlocks() {
  delete Blockly.Blocks.deferred_bool_slot;
  delete Blockly.Blocks.deferred_round;
}

function mismatchCtx() {
  return {
    blocks: {
      top: {id: 'top', opcode: 'deferred_bool_slot', topLevel: true, x: 10, y: 10,
        inputs: {COND: {name: 'COND', block: 'round', shadow: null}}, fields: {}, next: 'after'},
      round: {id: 'round', opcode: 'deferred_round', topLevel: false, inputs: {}, fields: {}},
      after: {id: 'after', opcode: 'deferred_test', topLevel: false, inputs: {},
        fields: {TEXT: {name: 'TEXT', value: 'after'}}},
      other: {id: 'other', opcode: 'deferred_test', topLevel: true, x: 10, y: 300,
        inputs: {}, fields: {}}
    },
    scripts: ['top', 'other'],
    comments: {}
  };
}

function test_deferredTypeMismatchStaysInItsSlot() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    defineMismatchBlocks();
    try {
      var status = null;
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {
        onProgress: function(value) { status = value; }
      }, mismatchCtx());
      flush();
      var top = ws.getBlockById('top');
      assertNotNull('The script loads', top);
      assertEquals('The reporter stays where the VM has it', top,
          ws.getBlockById('round').getParent());
      assertEquals(top, ws.getBlockById('after').getParent());
      assertNotEquals('hidden', top.getSvgRoot().style.visibility);
      assertEquals('idle', status.phase);
    } finally {
      deleteMismatchBlocks();
    }
  });
}

function test_deferredBlockThatCannotConnectIsLeftBesideItsScript() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    // A stack block in a reporter slot cannot connect at all.
    ctx.blocks.near.inputs = {VALUE: {name: 'VALUE', block: 'stack', shadow: 'slot'}};
    ctx.blocks.near.next = 'tail';
    ctx.blocks.slot = {id: 'slot', opcode: 'deferred_number', topLevel: false, shadow: true,
      inputs: {}, fields: {}};
    ctx.blocks.stack = {id: 'stack', opcode: 'deferred_test', topLevel: false,
      inputs: {VALUE: {name: 'VALUE', block: 'num', shadow: null}}, fields: {}};
    ctx.blocks.num = {id: 'num', opcode: 'deferred_number', topLevel: false, inputs: {}, fields: {}};
    ctx.blocks.tail = {id: 'tail', opcode: 'deferred_test', topLevel: false, inputs: {}, fields: {}};
    var status = null;
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {
      onProgress: function(value) { status = value; }
    }, ctx);
    flush();
    var near = ws.getBlockById('near');
    assertNotNull('The rest of the script loads', near);
    assertEquals(near, ws.getBlockById('tail').getParent());
    var slot = ws.getBlockById('slot');
    assertEquals('The empty slot gets its shadow back', near, slot.getParent());
    assertTrue(slot.isShadow());
    var stack = ws.getBlockById('stack');
    assertNotNull('The block that does not fit is kept', stack);
    assertNull(stack.getParent());
    assertEquals('with its own children', stack, ws.getBlockById('num').getParent());
    assertEquals('shown', ws.getCanvas(), stack.getSvgRoot().parentNode);
    assertNotEquals('hidden', stack.getSvgRoot().style.visibility);
    assertTrue('beside the script, not on top of it',
        stack.getRelativeToSurfaceXY().x > near.getRelativeToSurfaceXY().x);
    assertEquals('error', status.phase);
    assertEquals(1, status.failures);
  });
}

function test_deferredBlockWithoutConnectionsKeepsTheRestOfItsScript() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    // What a block from an extension that did not load turns into.
    Blockly.Blocks.deferred_bare = {init: function() { this.setColour('#123456'); }};
    try {
      ctx.blocks.near.next = 'bare';
      ctx.blocks.bare = {id: 'bare', opcode: 'deferred_bare', topLevel: false,
        inputs: {}, fields: {}, next: 'tail'};
      ctx.blocks.tail = {id: 'tail', opcode: 'deferred_test', topLevel: false, inputs: {}, fields: {}};
      var status = null;
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {
        onProgress: function(value) { status = value; }
      }, ctx);
      flush();
      assertNotEquals('hidden', ws.getBlockById('near').getSvgRoot().style.visibility);
      assertNull(ws.getBlockById('near').getNextBlock());
      ['bare', 'tail'].forEach(function(id) {
        var block = ws.getBlockById(id);
        assertNotNull(id + ' is kept', block);
        assertNull(id + ' is left beside the script', block.getParent());
        assertEquals(ws.getCanvas(), block.getSvgRoot().parentNode);
      });
      assertEquals('error', status.phase);
      assertEquals(2, status.failures);
    } finally {
      delete Blockly.Blocks.deferred_bare;
    }
  });
}

function test_deferredRepeatedBlockLoadsOnce() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    ctx.blocks.near.inputs = {VALUE: {name: 'VALUE', block: 'num', shadow: null}};
    ctx.blocks.near.next = 'tail';
    ctx.blocks.tail = {id: 'tail', opcode: 'deferred_test', topLevel: false,
      inputs: {VALUE: {name: 'VALUE', block: 'num', shadow: null}}, fields: {}};
    ctx.blocks.num = {id: 'num', opcode: 'deferred_number', topLevel: false, inputs: {}, fields: {}};
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    assertNotNull(ws.getBlockById('near'));
    assertEquals(ws.getBlockById('tail'), ws.getBlockById('near').getNextBlock());
    assertNotNull(ws.getBlockById('num'));
  });
}

function test_descriptionsKeepBooleanToggles() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    ctx.blocks.near.booleanToggle = true;
    ctx.blocks.far.x = 50;
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    assertTrue(ws.getBlockById('near').booleanToggle_);
    assertFalse(!!ws.getBlockById('far').booleanToggle_);
    assertEquals('true', Blockly.Xml.blockDescToDom(ctx.blocks.near, ctx)
        .getAttribute('boolean-toggle'));
  });
}

function test_synchronousDescriptionLoadKeepsGoingPastABadScript() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    defineMismatchBlocks();
    try {
      var descs = mismatchCtx();
      descs.blocks.top.inputs.COND.block = 'stack';
      descs.blocks.stack = {id: 'stack', opcode: 'deferred_test', topLevel: false, inputs: {}, fields: {}};
      var error = null;
      try {
        Blockly.Xml.clearWorkspaceAndLoadFromDescs(Blockly.Xml.textToDom('<xml/>'), descs, ws);
      } catch (e) {
        error = e;
      }
      assertNotNull('The editor hears that something did not load', error);
      assertNotNull(ws.getBlockById('top'));
      assertNotNull(ws.getBlockById('after'));
      assertNotNull('Later scripts still load', ws.getBlockById('other'));
      var stack = ws.getBlockById('stack');
      assertNull(stack.getParent());
      assertTrue(stack.rendered);
    } finally {
      deleteMismatchBlocks();
    }
  });
}

function test_asyncClearTakesOldScriptsOutOfThePageAtOnce() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    var oldMax = Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS;
    Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS = 10;
    try {
      var old = [];
      for (var i = 0; i < 20; i++) {
        var block = ws.newBlock('deferred_test', 'old' + i);
        block.initSvg();
        block.render(false);
        old.push(block.getSvgRoot());
      }
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
      old.forEach(function(svg) {
        assertNull('Old scripts leave the page before any frame', svg.parentNode);
      });
      flush();
      assertNull(ws.getBlockById('old0'));
      assertNotNull(ws.getBlockById('near'));
    } finally {
      Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS = oldMax;
    }
  });
}

function test_asyncClearSurvivesABlockThatCannotBeDisposed() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    var oldMax = Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS;
    Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS = 10;
    try {
      for (var i = 0; i < 20; i++) ws.newBlock('deferred_test', 'old' + i);
      var broken = ws.getBlockById('old5');
      var dispose = broken.dispose;
      var throws = true;
      broken.dispose = function() {
        if (throws) {
          throws = false;
          throw Error('broken dispose');
        }
        return dispose.apply(this, arguments);
      };
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
      flush();
      assertEquals('The canvas comes back', '', ws.getCanvas().style.visibility);
      assertNotNull('and the next sprite loads', ws.getBlockById('near'));
    } finally {
      Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS = oldMax;
    }
  });
}

function test_looseBlockTellsTheVmWhereItWasWhenMovedOrDeleted() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    ctx.blocks.near.inputs = {VALUE: {name: 'VALUE', block: 'stack', shadow: 'slot'}};
    ctx.blocks.near.next = 'stack2';
    ctx.blocks.slot = {id: 'slot', opcode: 'deferred_number', topLevel: false, shadow: true,
      inputs: {}, fields: {}};
    ctx.blocks.stack = {id: 'stack', opcode: 'deferred_test', topLevel: false, inputs: {}, fields: {}};
    // A stack block whose next connection is missing (an extension changed it).
    ctx.blocks.stack2 = {id: 'stack2', opcode: 'deferred_number', topLevel: false, inputs: {}, fields: {}};
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    var stack = ws.getBlockById('stack');
    var stack2 = ws.getBlockById('stack2');
    assertNull(stack.getParent());
    assertNull(stack2.getParent());

    var fired = [];
    var oldQueue = Blockly.Events.FIRE_QUEUE_.slice();
    Blockly.Events.enable();
    try {
      stack.dispose(false);
      fired = Blockly.Events.FIRE_QUEUE_.slice(oldQueue.length);
    } finally {
      Blockly.Events.FIRE_QUEUE_.length = 0;
      Blockly.Events.disable();
    }
    assertEquals(3, fired.length);
    assertEquals('Detach it from where the VM has it', Blockly.Events.MOVE, fired[0].type);
    assertEquals('near', fired[0].oldParentId);
    assertEquals('VALUE', fired[0].oldInputName);
    assertEquals('then put the shadow back in the slot', 'slot', fired[1].blockId);
    assertUndefined(fired[1].oldParentId);
    assertEquals('near', fired[1].newParentId);
    assertEquals('VALUE', fired[1].newInputName);
    assertFalse(fired[1].recordUndo);
    assertEquals('before deleting it', Blockly.Events.DELETE, fired[2].type);

    assertUndefined('A move built while events are off is not sent and keeps nothing',
        new Blockly.Events.BlockMove(stack2).oldParentId);
    Blockly.Events.enable();
    try {
      var move = new Blockly.Events.BlockMove(stack2);
      assertEquals('A block off a next connection detaches from it', 'near', move.oldParentId);
      assertUndefined(move.oldInputName);
      assertUndefined('later moves start from where it is',
          new Blockly.Events.BlockMove(stack2).oldParentId);
    } finally {
      Blockly.Events.disable();
    }
  });
}

function test_deferredBlockThatFailsToDrawDoesNotHideTheRest() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    ctx.blocks.near.next = 'mid';
    ctx.blocks.mid = {id: 'mid', opcode: 'deferred_test', topLevel: false, inputs: {}, fields: {}, next: 'tail'};
    ctx.blocks.tail = {id: 'tail', opcode: 'deferred_test', topLevel: false, inputs: {}, fields: {}};
    var oldDraw = Blockly.BlockSvg.prototype.renderDraw_;
    var cacheBefore = Blockly.Field.cacheReference_;
    Blockly.BlockSvg.prototype.renderDraw_ = function() {
      if (this.id == 'mid') throw Error('cannot draw');
      return oldDraw.apply(this, arguments);
    };
    try {
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
      flush();
    } finally {
      Blockly.BlockSvg.prototype.renderDraw_ = oldDraw;
    }
    var canvas = ws.getCanvas();
    for (var node = ws.getBlockById('tail').getSvgRoot(); node !== canvas; node = node.parentNode) {
      assertNotNull('tail is in the canvas', node);
      assertNotEquals('nothing above tail is hidden', 'hidden', node.style.visibility);
    }
    assertEquals('A failed render does not leave width caching on', cacheBefore,
        Blockly.Field.cacheReference_);
  });
}

function test_pastingACopyOfAnUnloadedScriptGetsNewIds() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    assertNull('far is not loaded', ws.getBlockById('far'));
    ws.paste(Blockly.Xml.textToDom(
        '<xml><block type="deferred_test" id="far" x="10" y="200"></block></xml>').firstChild);
    ws.paste(Blockly.Xml.textToDom(
        '<xml><block type="deferred_test" id="fresh" x="10" y="400"></block></xml>').firstChild);
    assertNull('The copy must not take the unloaded block\'s ID', ws.getBlockById('far'));
    assertNotNull('Free IDs are kept as before', ws.getBlockById('fresh'));
    assertEquals(3, ws.getTopBlocks().length);
  });
}

// The stack block that cannot go in near's VALUE slot, with the slot's shadow.
function addLooseStack(ctx) {
  ctx.blocks.near.inputs = {VALUE: {name: 'VALUE', block: 'stack', shadow: 'slot'}};
  ctx.blocks.slot = {id: 'slot', opcode: 'deferred_number', topLevel: false, shadow: true,
    inputs: {}, fields: {}};
  ctx.blocks.stack = {id: 'stack', opcode: 'deferred_test', topLevel: false, inputs: {}, fields: {}};
}

// Run fn with events on and return the events it queued for ws.
function eventsFrom(ws, fn) {
  var start = Blockly.Events.FIRE_QUEUE_.length;
  Blockly.Events.enable();
  try {
    fn();
    return Blockly.Events.FIRE_QUEUE_.slice(start).filter(function(event) {
      return event.workspaceId == ws.id;
    });
  } finally {
    Blockly.Events.FIRE_QUEUE_.length = start;
    Blockly.Events.disable();
  }
}

function test_loadingLooseBlocksDoesNotChangeTheVm() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    addLooseStack(ctx);
    var events = eventsFrom(ws, function() {
      Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
      flush();
    });
    assertNull(ws.getBlockById('stack').getParent());
    events.forEach(function(event) {
      assertNotEquals('Loading sends no moves: ' + event.blockId + ' ' + event.oldParentId +
          ' ' + event.newParentId, Blockly.Events.MOVE, event.type);
    });
    assertEquals('The VM parent is still remembered', 'near',
        ws.getBlockById('stack').loadedParent_.parentId);
  });
}

function test_deletingAScriptDetachesBlocksLeftBesideIt() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    addLooseStack(ctx);
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    var near = ws.getBlockById('near');
    var events = eventsFrom(ws, function() {
      near.dispose(false);
    });
    assertEquals(Blockly.Events.MOVE, events[0].type);
    assertEquals('stack', events[0].blockId);
    assertEquals('near', events[0].oldParentId);
    assertEquals(Blockly.Events.DELETE, events[events.length - 1].type);
    assertEquals('near', events[events.length - 1].blockId);
    assertNotNull('The loose block stays', ws.getBlockById('stack'));
    assertNull(ws.getBlockById('stack').loadedParent_);
  });
}

function test_fillingTheSlotDetachesTheBlockLeftOutOfIt() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    addLooseStack(ctx);
    Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
    flush();
    var near = ws.getBlockById('near');
    var number = ws.newBlock('deferred_number', 'number');
    var events = eventsFrom(ws, function() {
      near.getInput('VALUE').connection.connect(number.outputConnection);
    });
    var moved = events.filter(function(event) { return event.type == Blockly.Events.MOVE; })
        .map(function(event) { return event.blockId; });
    assertEquals('The loose block leaves the slot first', 'stack', moved[0]);
    assertEquals('then the shadow is put back', 'slot', moved[1]);
    assertTrue('before the new block goes in', moved.indexOf('number') > 1);
  });
}

function test_cancellingAnAsyncClearPutsUntouchedScriptsBack() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    var oldMax = Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS;
    Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS = 10;
    try {
      for (var i = 0; i < 20; i++) {
        var block = ws.newBlock('deferred_test', 'old' + i);
        block.initSvg();
        block.render(false);
      }
      var handle = Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred(
          Blockly.Xml.textToDom('<xml/>'), ws, {}, ctx);
      handle.cancel();
      for (var j = 0; j < 20; j++) {
        assertEquals('old' + j + ' is back in the page', ws.getCanvas(),
            ws.getBlockById('old' + j).getSvgRoot().parentNode);
      }
      assertEquals('', ws.getCanvas().style.visibility);
      flush();
    } finally {
      Blockly.Xml.SYNC_CLEAR_MAX_BLOCKS = oldMax;
    }
  });
}

function test_clearFinishesWhenABlockCannotBeDisposed() {
  deferredXmlTest(function(ws, ctx, view, flush) {
    for (var i = 0; i < 5; i++) ws.newBlock('deferred_test', 'old' + i);
    ws.getBlockById('old2').dispose = function() { throw Error('broken dispose'); };
    ws.clear();
    assertEquals(0, ws.getTopBlocks().length);
    assertFalse(ws.isClearing);
    assertEquals('', Blockly.Events.getGroup());
    ws.connectionDBList.forEach(function(db) {
      if (db) assertFalse(!!db.bulkClear_);
    });
  });
}
