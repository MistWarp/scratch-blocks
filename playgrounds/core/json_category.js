/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2017 Google Inc.
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

/**
 * @fileoverview Dictionary blocks category for Dictionary variable management.
 * @author tmickel@mit.edu (Tim Mickel)
 */
'use strict';

goog.provide('Blockly.JsonCategory');

goog.require('Blockly.Colours');
goog.require('Blockly.constants');
goog.require('Blockly.utils');
goog.require('Blockly.Variables');
goog.require('Blockly.Workspace');
goog.require('Blockly.Xml');

/**
 * @param {!Blockly.Workspace} workspace The workspace this category will appear in.
 * @return {!Array.<!Element>} Array of XML elements.
 */
Blockly.JsonCategory = function(workspace) {
  var xmlList = [];

  // Create button for new Dictionary variables
  var button = goog.dom.createDom('button');
  button.setAttribute('text', 'Create Dictionary');
  button.setAttribute('callbackKey', 'CREATE_JSON_VARIABLE');

  workspace.registerButtonCallback('CREATE_JSON_VARIABLE', function(button) {
    Blockly.Variables.createVariable(button.getTargetWorkspace(), null, 'json');
  });
  xmlList.push(button);

  // Get all Dictionary variables
  var getAllVariablesOfType = function(variableType) {
    var allVariables = workspace.getAllVariables();
    var variablesOfType = [];
    for (var i = 0; i < allVariables.length; i++) {
      var variable = allVariables[i];
      if (variable.type == variableType) {
        variablesOfType.push(variable);
      }
    }
    return variablesOfType;
  };

  var jsonVariables = getAllVariablesOfType('json');

  // Show Dictionary variable getter blocks
  for (var i = 0; i < jsonVariables.length; i++) {
    var variable = jsonVariables[i];
    var block = goog.dom.createDom('block');
    block.setAttribute('type', 'data_jsoncontents');
    block.setAttribute('gap', 8);
    var field = goog.dom.createDom('field', null, variable.name);
    field.setAttribute('name', 'JSON');
    field.setAttribute('id', variable.getId());
    field.setAttribute('variabletype', 'json');
    block.appendChild(field);
    xmlList.push(block);
  }

  if (jsonVariables.length > 0) {
    xmlList[xmlList.length - 1].setAttribute('gap', 24);

    var firstVariable = jsonVariables[0];
    
    // Helper function to create blocks with proper field setup
    var createBlockWithValue = function(type, valueName, valueType, defaultValue) {
      var blockText = '<xml>' +
          '<block type="' + type + '" gap="8">' +
          '<field name="JSON" variabletype="json" id="' + firstVariable.getId() + '">' +
          firstVariable.name + '</field>';
      
      if (valueName) {
        var fieldName = (valueType === 'math_number') ? 'NUM' : 'TEXT';
        blockText += '<value name="' + valueName + '">' +
            '<shadow type="' + valueType + '">' +
            '<field name="' + fieldName + '">' + defaultValue + '</field>' +
            '</shadow>' +
            '</value>';
      }
      
      blockText += '</block></xml>';
      return Blockly.Xml.textToDom(blockText).firstChild;
    };

    var createBlockWithTwoValues = function(type, value1Name, value1Type, value1Default,
        value2Name, value2Type, value2Default) {
      var blockText = '<xml>' +
          '<block type="' + type + '" gap="8">' +
          '<field name="JSON" variabletype="json" id="' + firstVariable.getId() + '">' +
          firstVariable.name + '</field>';
      
      var field1Name = (value1Type === 'math_number') ? 'NUM' : 'TEXT';
      var field2Name = (value2Type === 'math_number') ? 'NUM' : 'TEXT';
      
      blockText += '<value name="' + value1Name + '">' +
          '<shadow type="' + value1Type + '">' +
          '<field name="' + field1Name + '">' + value1Default + '</field>' +
          '</shadow>' +
          '</value>';
          
      blockText += '<value name="' + value2Name + '">' +
          '<shadow type="' + value2Type + '">' +
          '<field name="' + field2Name + '">' + value2Default + '</field>' +
          '</shadow>' +
          '</value>';
      
      blockText += '</block></xml>';
      return Blockly.Xml.textToDom(blockText).firstChild;
    };

    // Essential Dictionary blocks - organized logically
    
    // Getting values
    xmlList.push(createBlockWithValue('json_get', 'KEY', 'text', 'name'));
    
    // Setting values
    xmlList.push(createBlockWithTwoValues('json_set', 'KEY', 'text', 'name', 'VALUE', 'text', 'value'));
    
    // Add separator
    xmlList[xmlList.length - 1].setAttribute('gap', 24);
    
    // Getting object info
    xmlList.push(createBlockWithValue('json_keys', null, null, null));
    xmlList.push(createBlockWithValue('json_values', null, null, null));
    xmlList.push(createBlockWithValue('json_entries', null, null, null));
    
    // Add separator
    xmlList[xmlList.length - 1].setAttribute('gap', 24);
    
    // Checking content
    xmlList.push(createBlockWithValue('json_has_key', 'KEY', 'text', 'name'));
    xmlList.push(createBlockWithValue('json_length', null, null, null));
    
    // Add separator
    xmlList[xmlList.length - 1].setAttribute('gap', 24);
    
    // Removing content
    xmlList.push(createBlockWithValue('json_delete', 'KEY', 'text', 'name'));
    
    // Add separator
    xmlList[xmlList.length - 1].setAttribute('gap', 24);
    
    // Monitor controls
    xmlList.push(createBlockWithValue('json_show_variable', null, null, null));
    xmlList.push(createBlockWithValue('json_hide_variable', null, null, null));
  }

  // Essential utility blocks (no variable needed)
  if (xmlList.length > 1) {
    xmlList[xmlList.length - 1].setAttribute('gap', 36);
  }

  return xmlList;
};
