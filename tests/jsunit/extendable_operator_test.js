'use strict';

goog.require('goog.testing.MockClock');

function extendableOperatorTest(xml, run) {
  var clock = new goog.testing.MockClock(true);
  var ws = Blockly.inject('blocklyDiv', {});
  try {
    var block = Blockly.Xml.domToBlock(Blockly.Xml.textToDom('<xml>' + xml + '</xml>').firstChild, ws);
    Blockly.Events.fireNow_();
    ws.clearUndo();
    run(ws, block, function() {
      clock.tick(10);
      Blockly.Events.fireNow_();
    });
  } finally {
    ws.dispose();
    clock.uninstall();
  }
}

function extendableOperatorTest_inputs(block) {
  var out = [];
  for (var i = 1; block.getInput('NUM' + i); i++) {
    var target = block.getInput('NUM' + i).connection.targetBlock();
    out.push(target ? (target.isShadow() ? 'shadow' : target.type) : 'empty');
  }
  return out.join(',');
}

function extendableOperatorTest_looseShadows(ws) {
  return ws.getTopBlocks(false).filter(function(b) {
    return b.isShadow();
  }).length;
}

var EXTENDABLE_OPERATOR_TEST_ADD =
    '<block type="operator_add" id="add">' +
    '<value name="NUM1"><shadow type="math_number"><field name="NUM">1</field></shadow></value>' +
    '<value name="NUM2"><shadow type="math_number"><field name="NUM">2</field></shadow></value>' +
    '</block>';

function test_extendableOperator_undoAddInputIsOneStep() {
  extendableOperatorTest(EXTENDABLE_OPERATOR_TEST_ADD, function(ws, block, flush) {
    block.plus();
    flush();
    assertEquals('shadow,shadow,shadow', extendableOperatorTest_inputs(block));
    ws.undo(false);
    flush();
    assertEquals('shadow,shadow', extendableOperatorTest_inputs(block));
    assertEquals(0, extendableOperatorTest_looseShadows(ws));
    assertEquals(0, ws.undoStack_.length);
    ws.undo(true);
    flush();
    assertEquals('shadow,shadow,shadow', extendableOperatorTest_inputs(block));
    assertEquals(0, extendableOperatorTest_looseShadows(ws));
  });
}

function test_extendableOperator_undoRemoveInputRestoresReporter() {
  var xml =
      '<block type="operator_add" id="add">' +
      '<mutation itemcount="3"></mutation>' +
      '<value name="NUM1"><shadow type="math_number"><field name="NUM">1</field></shadow></value>' +
      '<value name="NUM2"><shadow type="math_number"><field name="NUM">2</field></shadow></value>' +
      '<value name="NUM3"><shadow type="math_number"><field name="NUM">3</field></shadow>' +
      '<block type="operator_multiply" id="child">' +
      '<value name="NUM1"><shadow type="math_number"><field name="NUM">4</field></shadow></value>' +
      '<value name="NUM2"><shadow type="math_number"><field name="NUM">5</field></shadow></value>' +
      '</block></value>' +
      '</block>';
  extendableOperatorTest(xml, function(ws, block, flush) {
    block.minus();
    flush();
    assertEquals('shadow,shadow', extendableOperatorTest_inputs(block));
    assertNull(ws.getBlockById('child').getParent());
    ws.undo(false);
    flush();
    assertEquals('shadow,shadow,operator_multiply', extendableOperatorTest_inputs(block));
    assertEquals(0, extendableOperatorTest_looseShadows(ws));
    assertEquals(1, ws.getTopBlocks(false).length);
    var obscured = block.getInput('NUM3').connection.getShadowDom();
    assertEquals('3', obscured.firstChild.textContent);
    ws.undo(true);
    flush();
    assertEquals('shadow,shadow', extendableOperatorTest_inputs(block));
    assertEquals(0, extendableOperatorTest_looseShadows(ws));
  });
}
