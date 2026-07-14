/**
 * @license
 * Blockly Tests
 *
 * Copyright 2016 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var svgTest_workspace;

function svgTest_setUp() {
  svgTest_workspace = Blockly.inject('blocklyDiv',
      {toolbox: document.getElementById('toolbox')});
}

function svgTest_tearDown() {
  svgTest_workspace.dispose();
  svgTest_workspace = null;
}

/**
 * Create a block with one field. Must be called after svgTest_setUp().
 * @return {!Blockly.Block} The new block with one field.
 */
function svgTest_newOneFieldBlock() {
  Blockly.Blocks['one_field_block'] = {
    init: function() {
      this.jsonInit({
        'message0': '%1',
        'args0': [
          {
            'type': 'field_input',
            'name': 'FIELD'
          }
        ]
      });
    }
  };

  var block = svgTest_workspace.newBlock('one_field_block');
  block.initSvg();
  block.render(false);
  return block;
}

/**
 * Create a block with two fields. Must be called after svgTest_setUp().
 * @return {!Blockly.Block} The new block with two fields.
 */
function svgTest_newTwoFieldBlock() {
  Blockly.Blocks['two_field_block'] = {
    init: function() {
      this.jsonInit({
        'message0': 'text_field %1',
        'args0': [
          {
            'type': 'field_input',
            'name': 'FIELD'
          }
        ]
      });
    }
  };

  var block = svgTest_workspace.newBlock('two_field_block');
  block.initSvg();
  block.render(false);
  return block;
}

function testBooleanInputToggleUsesVanillaNotBlock() {
  var oldMainWorkspace = Blockly.mainWorkspace;
  var oldOperatorNot = Blockly.Blocks['operator_not'];
  svgTest_setUp();
  try {
    Blockly.Blocks['boolean_parent'] = {
      init: function() {
        this.appendValueInput('CONDITION').setCheck('Boolean');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
    };
    Blockly.Blocks['operator_not'] = {
      init: function() {
        this.appendValueInput('OPERAND').setCheck('Boolean');
        this.setOutput(true, 'Boolean');
      }
    };
    var block = svgTest_workspace.newBlock('boolean_parent');
    block.initSvg();
    block.render(false);
    var input = block.getInput('CONDITION');
    var event = {stopPropagation: function() {}, preventDefault: function() {}};

    block.toggleBooleanInput_(input, event);
    assertEquals('operator_not', input.connection.targetBlock().type);
    assertTrue(block.isBooleanToggle_(input));
    assertEquals('visible', input.booleanToggleMark_.getAttribute('visibility'));
    assertContains('type="operator_not"',
        Blockly.Xml.domToText(Blockly.Xml.blockToDom(block)));

    block.toggleBooleanInput_(input, event);
    assertFalse(input.connection.isConnected());
  } finally {
    svgTest_tearDown();
    Blockly.mainWorkspace = oldMainWorkspace;
    delete Blockly.Blocks['boolean_parent'];
    if (oldOperatorNot) {
      Blockly.Blocks['operator_not'] = oldOperatorNot;
    } else {
      delete Blockly.Blocks['operator_not'];
    }
  }
}

function testPatchingReporterAcceptsBooleanConnection() {
  svgTest_setUp();
  try {
    Blockly.Blocks['boolean_parent'] = {
      init: function() {
        this.appendValueInput('CONDITION').setCheck('Boolean');
      }
    };
    var parent = svgTest_workspace.newBlock('boolean_parent');
    var patch = svgTest_workspace.newBlock('patching_jsreporter');
    parent.getInput('CONDITION').connection.connect(patch.outputConnection);
    assertEquals(patch, parent.getInput('CONDITION').connection.targetBlock());
  } finally {
    svgTest_tearDown();
    delete Blockly.Blocks['boolean_parent'];
  }
}
