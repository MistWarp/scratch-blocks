/* global assertEquals, assertNotEquals */
/* eslint-disable no-unused-vars */
'use strict';

var procedureColourTest_blocks = {
  procedures_call: Blockly.Blocks.procedures_call,
  procedures_prototype: Blockly.Blocks.procedures_prototype,
  procedures_definition: Blockly.Blocks.procedures_definition
};

function procedureColourTest_run(callback) {
  var previous = {};
  Object.keys(procedureColourTest_blocks).forEach(function(type) {
    previous[type] = Blockly.Blocks[type];
    Blockly.Blocks[type] = procedureColourTest_blocks[type];
  });
  var workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox')
  });
  try {
    callback(workspace);
  } finally {
    workspace.dispose();
    Object.keys(previous).forEach(function(type) {
      Blockly.Blocks[type] = previous[type];
    });
  }
}

function procedureColourTest_create(workspace, name, color) {
  var xml = '<xml><block type="procedures_definition">' +
    '<statement name="custom_block"><shadow type="procedures_prototype">' +
    '<mutation proccode="' + name + ' %s %b" argumentids=\'["x","b"]\' ' +
    'argumentnames=\'["X","B"]\' argumentdefaults=\'["","false"]\' ' +
    'warp="false" generateshadows="true" customcolor="' + color + '"></mutation>' +
    '</shadow></statement></block></xml>';
  var ids = Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), workspace);
  return workspace.getBlockById(ids[0]);
}

function procedureColourTest_assertPalette(source, block) {
  assertEquals(source.getColour(), block.getColour());
  assertEquals(source.getColourSecondary(), block.getColourSecondary());
  assertEquals(source.getColourTertiary(), block.getColourTertiary());
  assertEquals(source.getColourQuaternary(), block.getColourQuaternary());
  assertEquals(source.getColourTertiary(), block.svgPath_.getAttribute('stroke'));
}

function test_procedureColour_loadedDefinitionAndArguments() {
  procedureColourTest_run(function(workspace) {
    var definition = procedureColourTest_create(workspace, 'collisionbox', '#70afce');
    var prototype = definition.getInputTargetBlock('custom_block');
    assertEquals('#70afce', prototype.getColour());
    assertEquals('#5a8ca5', prototype.getColourTertiary());
    procedureColourTest_assertPalette(prototype, definition);
    ['x', 'b'].forEach(function(id) {
      procedureColourTest_assertPalette(prototype, prototype.getInputTargetBlock(id));
    });
    assertEquals(prototype.getColourTertiary(), prototype.svgPath_.getAttribute('stroke'));
    assertEquals(prototype.getColour(), definition.svgPath_.getAttribute('fill'));
  });
}

function test_procedureColour_editsRefreshCallsAndNestedReporters() {
  procedureColourTest_run(function(workspace) {
    var definition = procedureColourTest_create(workspace, 'collisionbox', '#70afce');
    var prototype = definition.getInputTargetBlock('custom_block');
    var returnBlock = workspace.newBlock('procedures_return');
    returnBlock.initSvg();
    returnBlock.render();
    definition.nextConnection.connect(returnBlock.previousConnection);
    var reporter = workspace.newBlock('argument_reporter_string_number');
    reporter.setFieldValue('X', 'VALUE');
    reporter.initSvg();
    reporter.render();
    returnBlock.getInput('VALUE').connection.connect(reporter.outputConnection);
    var call = workspace.newBlock('procedures_call');
    call.domToMutation(prototype.mutationToDom(true));
    call.initSvg();
    call.render();
    prototype.setCustomColor('#4488cc');
    [definition, returnBlock, reporter, call].forEach(function(block) {
      procedureColourTest_assertPalette(prototype, block);
    });
    assertEquals('#4488cc', reporter.svgPath_.getAttribute('fill'));
    assertEquals(prototype.getColourTertiary(), call.getInputTargetBlock('x').svgPath_.getAttribute('stroke'));
    prototype.setCustomColor('#ff6680');
    [definition, returnBlock, reporter, call].forEach(function(block) {
      procedureColourTest_assertPalette(prototype, block);
    });
    assertEquals(Blockly.Colours.more.tertiary, reporter.getColourTertiary());
  });
}

function test_procedureColour_movedStackUsesItsOwnDefinition() {
  procedureColourTest_run(function(workspace) {
    var first = procedureColourTest_create(workspace, 'first', '#70afce');
    var second = procedureColourTest_create(workspace, 'second', '#8855cc');
    var returnBlock = workspace.newBlock('procedures_return');
    returnBlock.initSvg();
    returnBlock.render();
    var reporter = workspace.newBlock('argument_reporter_boolean');
    reporter.setFieldValue('B', 'VALUE');
    reporter.initSvg();
    reporter.render();
    returnBlock.getInput('VALUE').connection.connect(reporter.outputConnection);
    first.nextConnection.connect(returnBlock.previousConnection);
    procedureColourTest_assertPalette(first, reporter);
    returnBlock.unplug();
    second.nextConnection.connect(returnBlock.previousConnection);
    procedureColourTest_assertPalette(second, returnBlock);
    procedureColourTest_assertPalette(second, reporter);
    assertNotEquals(first.getColour(), reporter.getColour());
    procedureColourTest_assertPalette(first, first.getInputTargetBlock('custom_block').getInputTargetBlock('b'));
  });
}

function test_procedureColour_roundTripPreservesOutlines() {
  procedureColourTest_run(function(workspace) {
    procedureColourTest_create(workspace, 'collisionbox', '#70afce');
    var xml = Blockly.Xml.workspaceToDom(workspace);
    workspace.clear();
    Blockly.Xml.domToWorkspace(xml, workspace);
    var definition = workspace.getTopBlocks(false)[0];
    var prototype = definition.getInputTargetBlock('custom_block');
    procedureColourTest_assertPalette(prototype, definition);
    procedureColourTest_assertPalette(prototype, prototype.getInputTargetBlock('x'));
    assertEquals('#5a8ca5', prototype.getColourTertiary());
  });
}

function test_procedureColour_doesNotOverrideInsertionMarkers() {
  procedureColourTest_run(function(workspace) {
    var definition = procedureColourTest_create(workspace, 'collisionbox', '#70afce');
    definition.setInsertionMarker(true);
    definition.updateColour();
    assertEquals(Blockly.Colours.insertionMarker, definition.getColour());
    assertEquals(Blockly.Colours.insertionMarker, definition.svgPath_.getAttribute('fill'));
  });
}

function test_procedureColour_removingCustomMutationResetsPalette() {
  procedureColourTest_run(function(workspace) {
    var definition = procedureColourTest_create(workspace, 'collisionbox', '#70afce');
    var prototype = definition.getInputTargetBlock('custom_block');
    var mutation = prototype.mutationToDom();
    mutation.removeAttribute('customcolor');
    prototype.domToMutation(mutation);
    assertEquals(null, prototype.getCustomColor());
    assertEquals(Blockly.Colours.more.primary, prototype.getColour());
    procedureColourTest_assertPalette(prototype, definition);
    procedureColourTest_assertPalette(prototype, prototype.getInputTargetBlock('x'));
  });
}

function test_procedureColour_reporterAndBooleanCallsKeepPalette() {
  procedureColourTest_run(function(workspace) {
    var definition = procedureColourTest_create(workspace, 'collisionbox', '#70afce');
    var prototype = definition.getInputTargetBlock('custom_block');
    [Blockly.PROCEDURES_CALL_TYPE_REPORTER, Blockly.PROCEDURES_CALL_TYPE_BOOLEAN].forEach(function(type) {
      var mutation = prototype.mutationToDom();
      mutation.setAttribute('return', type);
      var call = workspace.newBlock('procedures_call');
      call.domToMutation(mutation);
      call.initSvg();
      call.render();
      procedureColourTest_assertPalette(prototype, call);
    });
    prototype.setColour(Blockly.Colours.more.primary, '#112233', '#445566', '#778899');
    definition.updateColour();
    procedureColourTest_assertPalette(prototype, definition);
  });
}
