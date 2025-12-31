/**
 * Dictionary extension blocks.
 * Provides blocks for creating and manipulating dictionaries (objects) and lists.
 */

'use strict';

goog.provide('Blockly.Blocks.json');

goog.require('Blockly.Blocks');
goog.require('Blockly.Colours');
goog.require('Blockly.constants');
goog.require('Blockly.ScratchBlocks.VerticalExtensions');

// Dictionary Variable blocks
Blockly.Blocks['data_jsoncontents'] = {
  init: function() {
    this.jsonInit({
      "message0": "%1",
      "args0": [
        {
          "type": "field_variable_getter",
          "text": "",
          "name": "JSON",
          "variableType": Blockly.JSON_VARIABLE_TYPE
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["contextMenu_getJsonBlock", "colours_json", "output_string"],
      "checkboxInFlyout": true
    });
  }
};

// Core Dictionary operations
Blockly.Blocks['json_get'] = {
  init: function() {
    this.jsonInit({
      "message0": "value at key %1 of %2",
      "args0": [
        {
          "type": "input_value",
          "name": "KEY"
        },
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "output_string"]
    });
  }
};

Blockly.Blocks['json_set'] = {
  init: function() {
    this.jsonInit({
      "message0": "set key %1 of %2 to %3",
      "args0": [
        {
          "type": "input_value",
          "name": "KEY"
        },
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        },
        {
          "type": "input_value",
          "name": "VALUE"
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "shape_statement"]
    });
  }
};

Blockly.Blocks['json_keys'] = {
  init: function() {
    this.jsonInit({
      "message0": "keys of %1",
      "args0": [
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "output_string"]
    });
  }
};

Blockly.Blocks['json_values'] = {
  init: function() {
    this.jsonInit({
      "message0": "values of %1",
      "args0": [
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "output_string"]
    });
  }
};

Blockly.Blocks['json_entries'] = {
  init: function() {
    this.jsonInit({
      "message0": "entries of %1",
      "args0": [
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "output_string"]
    });
  }
};

Blockly.Blocks['json_length'] = {
  init: function() {
    this.jsonInit({
      "message0": "length of %1",
      "args0": [
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "output_number"]
    });
  }
};

Blockly.Blocks['json_has_key'] = {
  init: function() {
    this.jsonInit({
      "message0": "%1 contains key %2?",
      "args0": [
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        },
        {
          "type": "input_value",
          "name": "KEY"
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "output_boolean"]
    });
  }
};

Blockly.Blocks['json_delete'] = {
  init: function() {
    this.jsonInit({
      "message0": "delete key %1 of %2",
      "args0": [
        {
          "type": "input_value",
          "name": "KEY"
        },
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "shape_statement"]
    });
  }
};

// Monitor controls
Blockly.Blocks['json_show_variable'] = {
  init: function() {
    this.jsonInit({
      "message0": "show dict %1",
      "args0": [
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "shape_statement"]
    });
  }
};

Blockly.Blocks['json_hide_variable'] = {
  init: function() {
    this.jsonInit({
      "message0": "hide dict %1",
      "args0": [
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "shape_statement"]
    });
  }
};

Blockly.Blocks['json_stringify'] = {
  init: function() {
    this.jsonInit({
      "message0": "stringify %1",
      "args0": [
        {
          "type": "field_variable",
          "name": "JSON",
          "variableTypes": [Blockly.JSON_VARIABLE_TYPE]
        }
      ],
      "category": Blockly.Categories.json,
      "extensions": ["colours_json", "output_string"]
    });
  }
};

/**
 * Mixin to add a context menu for a data_jsoncontents block.  It adds one item for
 * each JSON variable defined on the workspace.
 * @mixin
 * @augments Blockly.Block
 * @package
 * @readonly
 */
Blockly.Constants.Data.CUSTOM_CONTEXT_MENU_GET_JSON_MIXIN = {
  /**
   * Add context menu option to change the selected JSON variable.
   * @param {!Array} options List of menu options to add to.
   * @this Blockly.Block
   */
  customContextMenu: function(options) {
    var fieldName = 'JSON';
    if (this.isCollapsed()) {
      return;
    }
    var currentVarName = this.getField(fieldName).text_;
    if (!this.isInFlyout) {
      var variablesList = this.workspace.getVariablesOfType('json');
      variablesList.sort(function(a, b) {
        return Blockly.scratchBlocksUtils.compareStrings(a.name, b.name);
      });
      for (var i = 0; i < variablesList.length; i++) {
        var varName = variablesList[i].name;
        if (varName == currentVarName) continue;

        var option = {enabled: true};
        option.text = varName;

        option.callback =
            Blockly.Constants.Data.VARIABLE_OPTION_CALLBACK_FACTORY(this,
                variablesList[i].getId(), fieldName);
        options.push(option);
      }
    } else {
      var renameOption = {
        text: Blockly.Msg.RENAME_JSON,
        enabled: true,
        callback: Blockly.Constants.Data.RENAME_OPTION_CALLBACK_FACTORY(this,
            fieldName)
      };
      var deleteOption = {
        text: Blockly.Msg.DELETE_JSON.replace('%1', currentVarName),
        enabled: true,
        callback: Blockly.Constants.Data.DELETE_OPTION_CALLBACK_FACTORY(this,
            fieldName)
      };
      options.push(renameOption);
      options.push(deleteOption);
    }
  }
};

Blockly.Extensions.registerMixin('contextMenu_getJsonBlock',
    Blockly.Constants.Data.CUSTOM_CONTEXT_MENU_GET_JSON_MIXIN);
