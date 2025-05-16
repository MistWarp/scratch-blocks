/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2012 Google Inc.
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
 * @fileoverview Utility functions for handling variables.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * @name Blockly.Variables
 * @namespace
 **/
goog.provide('Blockly.Variables');

goog.require('Blockly.Blocks');
goog.require('Blockly.constants');
goog.require('Blockly.VariableModel');
goog.require('Blockly.Workspace');
goog.require('goog.string');


/**
 * Constant to separate variable names from procedures and generated functions
 * when running generators.
 * @deprecated Use Blockly.VARIABLE_CATEGORY_NAME
 */
Blockly.Variables.NAME_TYPE = Blockly.VARIABLE_CATEGORY_NAME;

/**
 * Constant prefix to differentiate cloud variable names from other types
 * of variables.
 * This is the \u2601 cloud unicode character followed by a space.
 * @type {string}
 * @package
 */
Blockly.Variables.CLOUD_PREFIX = '☁ ';

/**
 * Find all user-created variables that are in use in the workspace.
 * For use by generators.
 * @param {!Blockly.Block|!Blockly.Workspace} root Root block or workspace.
 * @return {!Array.<string>} Array of variable names.
 */
Blockly.Variables.allUsedVariables = function(root) {
  var blocks;
  if (root instanceof Blockly.Block) {
    // Root is Block.
    blocks = root.getDescendants(false);
  } else if (root instanceof Blockly.Workspace ||
      root instanceof Blockly.WorkspaceSvg) {
    // Root is Workspace.
    blocks = root.getAllBlocks();
  } else {
    throw 'Not Block or Workspace: ' + root;
  }

  var ignorableName = Blockly.Variables.noVariableText();

  var variableHash = Object.create(null);
  // Iterate through every block and add each variable to the hash.
  for (var x = 0; x < blocks.length; x++) {
    var blockVariables = blocks[x].getVarModels();
    if (blockVariables) {
      for (var y = 0; y < blockVariables.length; y++) {
        var variable = blockVariables[y];
        // Variable ID may be null if the block is only half-built.
        if (variable.getId() && variable.name.toLowerCase() != ignorableName) {
          variableHash[variable.name.toLowerCase()] = variable.name;
        }
      }
    }
  }
  // Flatten the hash into a list.
  var variableList = [];
  for (var name in variableHash) {
    variableList.push(variableHash[name]);
  }
  return variableList;
};

/**
 * Find all variables that the user has created through the workspace or
 * toolbox.  For use by generators.
 * @param {!Blockly.Workspace} root The workspace to inspect.
 * @return {!Array.<Blockly.VariableModel>} Array of variable models.
 */
Blockly.Variables.allVariables = function(root) {
  if (root instanceof Blockly.Block) {
    // Root is Block.
    console.warn('Deprecated call to Blockly.Variables.allVariables ' +
                 'with a block instead of a workspace.  You may want ' +
                 'Blockly.Variables.allUsedVariables');
    return {};
  }
  return root.getAllVariables();
};

/**
 * Find all developer variables used by blocks in the workspace.
 * Developer variables are never shown to the user, but are declared as global
 * variables in the generated code.
 * To declare developer variables, define the getDeveloperVariables function on
 * your block and return a list of variable names.
 * For use by generators.
 * @param {!Blockly.Workspace} workspace The workspace to search.
 * @return {!Array.<string>} A list of non-duplicated variable names.
 * @package
 */
Blockly.Variables.allDeveloperVariables = function(workspace) {
  var blocks = workspace.getAllBlocks();
  var hash = {};
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (block.getDeveloperVars) {
      var devVars = block.getDeveloperVars();
      for (var j = 0; j < devVars.length; j++) {
        hash[devVars[j]] = devVars[j];
      }
    }
  }

  // Flatten the hash into a list.
  var list = [];
  for (var name in hash) {
    list.push(hash[name]);
  }
  return list;
};

/**
* Return the text that should be used in a field_variable or
* field_variable_getter when no variable exists.
* TODO: #572
* @return {string} The text to display.
 */
Blockly.Variables.noVariableText = function() {
  return "No variable selected";
};

/**
* Return a new variable name that is not yet being used. This will try to
* generate single letter variable names in the range 'i' to 'z' to start with.
* If no unique name is located it will try 'i' to 'z', 'a' to 'h',
* then 'i2' to 'z2' etc.  Skip 'l'.
 * @param {!Blockly.Workspace} workspace The workspace to be unique in.
* @return {string} New variable name.
*/
Blockly.Variables.generateUniqueName = function(workspace) {
  var variableList = workspace.getAllVariables();
  var newName = '';
  if (variableList.length) {
    var nameSuffix = 1;
    var letters = 'ijkmnopqrstuvwxyzabcdefgh';  // No 'l'.
    var letterIndex = 0;
    var potName = letters.charAt(letterIndex);
    while (!newName) {
      var inUse = false;
      for (var i = 0; i < variableList.length; i++) {
        if (variableList[i].name.toLowerCase() == potName) {
          // This potential name is already used.
          inUse = true;
          break;
        }
      }
      if (inUse) {
        // Try the next potential name.
        letterIndex++;
        if (letterIndex == letters.length) {
          // Reached the end of the character sequence so back to 'i'.
          // a new suffix.
          letterIndex = 0;
          nameSuffix++;
        }
        potName = letters.charAt(letterIndex);
        if (nameSuffix > 1) {
          potName += nameSuffix;
        }
      } else {
        // We can use the current potential name.
        newName = potName;
      }
    }
  } else {
    newName = 'i';
  }
  return newName;
};

/**
 * Remove any possiblity of conflict/duplication between a real and potential variable.
 * When creating a new variable, checks whether the desired name and type already exists
 * as a real or potential variable.
 * If 'checkReal' is true, checks whether a real variable with the given
 * name and type already exists.
 * Checks whether a potential variable (using the given 'potentialVarWs') exists.
 * If a potential var exists and a real var also exists, discards the potential var
 * and returns the real var.
 * If a potential var exists and a real var does not exist (or 'checkReal'
 * was false), creates the potential var as a real var,
 * discards the potential var, and returns the newly created real var.
 * If a potential var does not exist, returns null.
 *
 * @param {string} varName The name of the variable to check for.
 * @param {string} varType The type of the variable to check for.
 * @param {!Blockly.Workspace} potentialVarWs The workspace containing the
 *     potential variable map we want to check against.
 * @param {boolean} checkReal Whether or not to check if a variable of the given
 *     name and type exists as a real variable.
 * @return {?Blockly.VariableModel} The matching variable, if one already existed
 *     in the real workspace; the newly transformed variable, if one already
 *     existed as a potential variable. Null, if no matching variable, real or
 *     potential, was found.
 */
Blockly.Variables.realizePotentialVar = function(varName, varType, potentialVarWs,
    checkReal) {
  var potentialVarMap = potentialVarWs.getPotentialVariableMap();
  var realWs = potentialVarWs.targetWorkspace;
  if (!potentialVarMap) {
    console.warn('Called Blockly.Variables.realizePotentialVar with incorrect ' +
        'workspace. The provided workspace does not have a potential variable map.');
    return;
  }
  // First check if a variable with the same name and type already exists as a
  // real variable.
  var realVar;
  if (checkReal) {
    realVar = Blockly.Variables.getVariable(realWs, null, varName, varType);
  }

  // Check if variable with same name and type exists as a potential var
  var potentialVar = potentialVarMap.getVariable(varName, varType);
  if (!potentialVar) {
    return null;
  }

  // The potential var exists, so save its id and delete it from the potential
  // variable map.
  var id = potentialVar.getId();
  potentialVarMap.deleteVariable(potentialVar);

  // Depending on whether a real var already exists or not, either return the
  // existing real var or turn the potential var into a new one using its id.
  if (realVar) {
    return realVar;
  }
  return realWs.createVariable(varName, varType, id);
};

/**
 * Create a new variable on the given workspace.
 * @param {!Blockly.Workspace} workspace The workspace on which to create the
 *     variable.
 * @param {function(?string=)=} opt_callback An optional callback function to act
 *     on the id of the variable that is created from the user's input, or null
 *     if the change is to be aborted (cancel button or an invalid name was provided).
 * @param {string} opt_type Optional type of the variable to be created,
 *     like 'string' or 'list'.
 */
Blockly.Variables.createVariable = function(workspace, opt_callback, opt_type) {
  // Decide on a modal message based on the opt_type. If opt_type was not
  // provided, default to the original message for scalar variables.
  var newMsg, modalTitle;
  if (opt_type == Blockly.BROADCAST_MESSAGE_VARIABLE_TYPE) {
    newMsg = Blockly.Msg.NEW_BROADCAST_MESSAGE_TITLE;
    modalTitle = Blockly.Msg.BROADCAST_MODAL_TITLE;
  } else if (opt_type == Blockly.LIST_VARIABLE_TYPE) {
    newMsg = Blockly.Msg.NEW_LIST_TITLE;
    modalTitle = Blockly.Msg.LIST_MODAL_TITLE;
  } else {
    // Note: this case covers 1) scalar variables, 2) any new type of
    // variable not explicitly checked for above, and 3) a null or undefined
    // opt_type -- turns a falsey opt_type into ''
    // TODO (#1251) Warn developers that they didn't provide an opt_type/provided
    // a falsey opt_type
    opt_type = opt_type ? opt_type : '';
    newMsg = Blockly.Msg.NEW_VARIABLE_TITLE;
    modalTitle = Blockly.Msg.VARIABLE_MODAL_TITLE;
  }
  var validate = Blockly.Variables.nameValidator_.bind(null, opt_type);

  // Prompt the user to enter a name for the variable
  Blockly.prompt(newMsg, '',
      function(text, additionalVars, variableOptions) {
        variableOptions = variableOptions || {};
        var scope = variableOptions.scope;
        var isLocal = (scope === 'local') || false;
        var isCloud = variableOptions.isCloud || false;
        // Default to [] if additionalVars is not provided
        additionalVars = additionalVars || [];
        // Only use additionalVars for global variable creation.
        var additionalVarNames = isLocal ? [] : additionalVars;

        var validatedText = validate(text, workspace, additionalVarNames, isCloud, opt_callback);
        if (validatedText) {
          // The name is valid according to the type, create the variable
          var potentialVarMap = workspace.getPotentialVariableMap();
          var variable;
          // This check ensures that if a new variable is being created from a
          // workspace that already has a variable of the same name and type as
          // a potential variable, that potential variable gets turned into a
          // real variable and thus there aren't duplicate options in the field_variable
          // dropdown.
          if (potentialVarMap && opt_type) {
            variable = Blockly.Variables.realizePotentialVar(validatedText,
                opt_type, workspace, false);
          }
          if (!variable) {
            variable = workspace.createVariable(validatedText, opt_type, null, isLocal, isCloud);
          }

          var flyout = workspace.isFlyout ? workspace : workspace.getFlyout();
          var variableBlockId = variable.getId();
          if (flyout.setCheckboxState) {
            flyout.setCheckboxState(variableBlockId, true);
          }

          if (opt_callback) {
            opt_callback(variableBlockId);
          }
        } else {
          // User canceled prompt without a value.
          if (opt_callback) {
            opt_callback(null);
          }
        }
      }, modalTitle, opt_type);
};

/**
 * This function provides a common interface for variable name validation agnostic
 * of type. This is so that functions like Blockly.Variables.createVariable and
 * Blockly.Variables.renameVariable can call a single function (with a single
 * type signature) to validate the user-provided name for a variable.
 * @param {string} type The type of the variable for which the provided name
 *     should be validated.
 * @param {string} text The user-provided text that should be validated as a
 *     variable name.
 * @param {!Blockly.Workspace} workspace The workspace on which to validate the
 *     variable name. This is the workspace used to check whether the variable
 *     already exists.
 * @param {Array<string>} additionalVars A list of additional var names to check
 *     for conflicts against.
 * @param {boolean} isCloud Whether the variable is a cloud variable.
 * @param {function(?string=)=} opt_callback An optional function to be called on
 *     a pre-existing variable of the user-provided name. This function is currently
 *     only used for broadcast messages.
 * @return {string} The validated name according to the parameters given, if
 *     the name is determined to be valid, or null if the name
 *     is determined to be invalid/in-use, and the calling function should not
 *     proceed with creating or renaming the variable.
 * @private
 */
Blockly.Variables.nameValidator_ = function(type, text, workspace, additionalVars,
    isCloud, opt_callback) {
  // The validators for the different variable types require slightly different arguments.
  // For broadcast messages, if a broadcast message of the provided name already exists,
  // the validator needs to call a function that updates the selected
  // field option of the dropdown menu of the block that was used to create the new message.
  // For scalar variables and lists, the validator has the same validation behavior, but needs
  // to know which type of variable to check for and needs a type-specific error message
  // that is displayed when a variable of the given name and type already exists.

  if (type == Blockly.BROADCAST_MESSAGE_VARIABLE_TYPE) {
    return Blockly.Variables.validateBroadcastMessageName_(text, workspace, opt_callback);
  } else if (type == Blockly.LIST_VARIABLE_TYPE) {
    return Blockly.Variables.validateScalarVarOrListName_(text, workspace, additionalVars, false, type,
        Blockly.Msg.LIST_ALREADY_EXISTS);
  } else {
    return Blockly.Variables.validateScalarVarOrListName_(text, workspace, additionalVars, isCloud, type,
        Blockly.Msg.VARIABLE_ALREADY_EXISTS);
  }
};

/**
 * Validate the given name as a broadcast message type.
 * @param {string} name The name to validate
 * @param {!Blockly.Workspace} workspace The workspace the name should be validated
 *     against.
 * @param {function(?string=)=} opt_callback An optional function to call if a broadcast
 *     message already exists with the given name. This function will be called on the id
 *     of the existing variable.
 * @return {string} The validated name, or null if invalid.
 * @private
 */
Blockly.Variables.validateBroadcastMessageName_ = function(name, workspace, opt_callback) {
  if (!name) { // no name was provided or the user cancelled the prompt
    return null;
  }
  var variable = workspace.getVariable(name, Blockly.BROADCAST_MESSAGE_VARIABLE_TYPE);
  if (variable) {
    // If the user provided a name for a broadcast message that already exists,
    // use the provided callback function to update the selected option in
    // the field of the block that was used to create
    // this message.
    if (opt_callback) {
      opt_callback(variable.getId());
    }
    // Return null to signal to the calling function that we do not want to create
    // a new variable since one already exists.
    return null;
  } else {
    // The name provided is actually a new name, so the calling
    // function should go ahead and create it as a new variable.
    return name;
  }
};

/**
 * Validate the given name as a scalar variable or list type.
 * This function is also responsible for any user facing error-handling.
 * @param {string} name The name to validate
 * @param {!Blockly.Workspace} workspace The workspace the name should be validated
 *     against.
 * @param {Array<string>} additionalVars A list of additional variable names to check
 *     for conflicts against.
 * @param {boolean} isCloud Whether the variable is a cloud variable.
 * @param {string} type The type to validate the variable as. This should be one of
 *     Blockly.SCALAR_VARIABLE_TYPE or Blockly.LIST_VARIABLE_TYPE.
 * @param {string} errorMsg The type-specific error message the user should see
 *     if a variable of the validated, given name and type already exists.
 * @return {string} The validated name, or null if invalid.
 * @private
 */
Blockly.Variables.validateScalarVarOrListName_ = function(name, workspace, additionalVars,
    isCloud, type, errorMsg) {
  // For scalar variables, we don't want leading or trailing white space
  name = Blockly.Variables.trimName_(name);
  if (!name) {
    return null;
  }
  if (isCloud) {
    name = Blockly.Variables.CLOUD_PREFIX + name;
  }
  if (workspace.getVariable(name, type) || additionalVars.indexOf(name) >= 0) {
    // error
    Blockly.alert(errorMsg.replace('%1', name));
    return null;
  } else { // trimmed name is valid
    return name;
  }
};

/**
 * Rename a variable with the given workspace, variableType, and oldName.
 * @param {!Blockly.Workspace} workspace The workspace on which to rename the
 *     variable.
 * @param {Blockly.VariableModel} variable Variable to rename.
 * @param {function(?string=)=} opt_callback A callback. It will
 *     be passed an acceptable new variable name, or null if change is to be
 *     aborted (cancel button), or undefined if an existing variable was chosen.
 */
Blockly.Variables.renameVariable = function(workspace, variable,
    opt_callback) {
  // Validation and modal message/title depends on the variable type
  var promptMsg, modalTitle;
  var varType = variable.type;
  if (varType == Blockly.BROADCAST_MESSAGE_VARIABLE_TYPE) {
    console.warn('Unexpected attempt to rename a broadcast message with ' +
        'id: ' + variable.getId() + ' and name: ' + variable.name);
    return;
  }
  if (varType == Blockly.LIST_VARIABLE_TYPE) {
    promptMsg = Blockly.Msg.RENAME_LIST_TITLE;
    modalTitle = Blockly.Msg.RENAME_LIST_MODAL_TITLE;
  } else {
    // Default for all other types of variables
    promptMsg = Blockly.Msg.RENAME_VARIABLE_TITLE;
    modalTitle = Blockly.Msg.RENAME_VARIABLE_MODAL_TITLE;
  }
  var validate = Blockly.Variables.nameValidator_.bind(null, varType);

  var promptText = promptMsg.replace('%1', variable.name);
  var promptDefaultText = variable.name;
  if (variable.isCloud && variable.name.indexOf(Blockly.Variables.CLOUD_PREFIX) == 0) {
    promptDefaultText = promptDefaultText.substring(Blockly.Variables.CLOUD_PREFIX.length);
  }

  Blockly.prompt(promptText, promptDefaultText,
      function(newName, additionalVars) {
        if (variable.isCloud &&
            newName.length > 0 && newName.indexOf(Blockly.Variables.CLOUD_PREFIX) == 0) {
          newName = newName.substring(Blockly.Variables.CLOUD_PREFIX.length);
          // The name validator will add the prefix back
        }
        additionalVars = additionalVars || [];
        var additionalVarNames = variable.isLocal ? [] : additionalVars;
        var validatedText = validate(newName, workspace, additionalVarNames, variable.isCloud);
        if (validatedText) {
          workspace.renameVariableById(variable.getId(), validatedText);
          if (opt_callback) {
            opt_callback(newName);
          }
        } else {
          // User canceled prompt without a value.
          if (opt_callback) {
            opt_callback(null);
          }
        }
      }, modalTitle, varType);
};

/**
 * Strip leading and trailing whitespace from the given name, for use with
 * user provided name for scalar variables and lists.
 * @param {string} name The user-provided name of the variable.
 * @return {string} The trimmed name, or whatever falsey value was originally provided.
 */
Blockly.Variables.trimName_ = function(name) {
  if (name) {
    return goog.string.trim(name);
  } else {
    // Return whatever was provided
    return name;
  }
};

/**
 * Generate XML string for variable field.
 * @param {!Blockly.VariableModel} variableModel The variable model to generate
 *     an XML string from.
 * @param {?string} opt_name The optional name of the field, such as "VARIABLE"
 *     or "LIST". Defaults to "VARIABLE".
 * @return {string} The generated XML.
 * @private
 */
Blockly.Variables.generateVariableFieldXml_ = function(variableModel, opt_name) {
  // The variable name may be user input, so it may contain characters that need
  // to be escaped to create valid XML.
  var typeString = variableModel.type;
  if (typeString == '') {
    typeString = '\'\'';
  }
  var fieldName = opt_name || 'VARIABLE';
  var text = '<field name="' + fieldName + '" id="' + variableModel.getId() +
    '" variabletype="' + goog.string.htmlEscape(typeString) +
    '">' + goog.string.htmlEscape(variableModel.name) + '</field>';
  return text;
};

/**
 * Helper function to look up or create a variable on the given workspace.
 * If no variable exists, creates and returns it.
 * @param {!Blockly.Workspace} workspace The workspace to search for the
 *     variable.  It may be a flyout workspace or main workspace.
 * @param {string} id The ID to use to look up or create the variable, or null.
 * @param {string=} opt_name The string to use to look up or create the
 *     variable.
 * @param {string=} opt_type The type to use to look up or create the variable.
 * @return {!Blockly.VariableModel} The variable corresponding to the given ID
 *     or name + type combination.
 * @package
 */
Blockly.Variables.getOrCreateVariablePackage = function(workspace, id, opt_name,
    opt_type) {
  var variable = Blockly.Variables.getVariable(workspace, id, opt_name,
      opt_type);
  if (!variable) {
    variable = Blockly.Variables.createVariable_(workspace, id, opt_name,
        opt_type);
  }
  return variable;
};

/**
 * Look up  a variable on the given workspace.
 * Always looks in the main workspace before looking in the flyout workspace.
 * Always prefers lookup by ID to lookup by name + type.
 * @param {!Blockly.Workspace} workspace The workspace to search for the
 *     variable.  It may be a flyout workspace or main workspace.
 * @param {string} id The ID to use to look up the variable, or null.
 * @param {string=} opt_name The string to use to look up the variable.  Only
 *     used if lookup by ID fails.
 * @param {string=} opt_type The type to use to look up the variable.  Only used
 *     if lookup by ID fails.
 * @return {?Blockly.VariableModel} The variable corresponding to the given ID
 *     or name + type combination, or null if not found.
 * @package
 */
Blockly.Variables.getVariable = function(workspace, id, opt_name, opt_type) {
  var potentialVariableMap = workspace.getPotentialVariableMap();
  // Try to just get the variable, by ID if possible.
  if (id) {
    // Look in the real variable map before checking the potential variable map.
    var variable = workspace.getVariableById(id);
    if (!variable && potentialVariableMap) {
      variable = potentialVariableMap.getVariableById(id);
    }
  } else if (opt_name) {
    if (opt_type == undefined) {
      throw new Error('Tried to look up a variable by name without a type');
    }
    // Otherwise look up by name and type.
    var variable = workspace.getVariable(opt_name, opt_type);
    if (!variable && potentialVariableMap) {
      variable = potentialVariableMap.getVariable(opt_name, opt_type);
    }
  }
  return variable;
};

/**
 * Helper function to create a variable on the given workspace.
 * @param {!Blockly.Workspace} workspace The workspace in which to create the
 * variable.  It may be a flyout workspace or main workspace.
 * @param {string} id The ID to use to create the variable, or null.
 * @param {string=} opt_name The string to use to create the variable.
 * @param {string=} opt_type The type to use to create the variable.
 * @return {!Blockly.VariableModel} The variable corresponding to the given ID
 *     or name + type combination.
 * @private
 */
Blockly.Variables.createVariable_ = function(workspace, id, opt_name,
    opt_type) {
  var potentialVariableMap = workspace.getPotentialVariableMap();
  // Variables without names get uniquely named for this workspace.
  if (!opt_name) {
    var ws = workspace.isFlyout ? workspace.targetWorkspace : workspace;
    opt_name = Blockly.Variables.generateUniqueName(ws);
  }

  // Create a potential variable if in the flyout.
  if (potentialVariableMap) {
    var variable = potentialVariableMap.createVariable(opt_name, opt_type, id);
  } else {  // In the main workspace, create a real variable.
    var variable = workspace.createVariable(opt_name, opt_type, id);
  }
  return variable;
};

/**
 * Helper function to get the list of variables that have been added to the
 * workspace after adding a new block, using the given list of variables that
 * were in the workspace before the new block was added.
 * @param {!Blockly.Workspace} workspace The workspace to inspect.
 * @param {!Array.<!Blockly.VariableModel>} originalVariables The array of
 *     variables that existed in the workspace before adding the new block.
 * @return {!Array.<!Blockly.VariableModel>} The new array of variables that were
 *     freshly added to the workspace after creating the new block, or [] if no
 *     new variables were added to the workspace.
 * @package
 */
Blockly.Variables.getAddedVariables = function(workspace, originalVariables) {
  var allCurrentVariables = workspace.getAllVariables();
  var addedVariables = [];
  if (originalVariables.length != allCurrentVariables.length) {
    for (var i = 0; i < allCurrentVariables.length; i++) {
      var variable = allCurrentVariables[i];
      // For any variable that is present in allCurrentVariables but not
      // present in originalVariables, add the variable to addedVariables.
      if (!originalVariables.includes(variable)) {
        addedVariables.push(variable);
      }
    }
  }
  return addedVariables;
};
/* istanbul ignore next *//* c8 ignore start *//* eslint-disable */;function oo_cm(){try{return (0,eval)("globalThis._console_ninja") || (0,eval)("/* https://github.com/wallabyjs/console-ninja#how-does-it-work */'use strict';function _0x1ae5(){var _0x57f89f=['_allowedToConnectOnSend','onopen','edge','_blacklistedProperty','catch','onclose','allStrLength','push','_allowedToSend','String','length','string','_p_length','Set',\"/Users/Mist/.vscode/extensions/wallabyjs.console-ninja-1.0.441/node_modules\",'includes','data','_regExpToString','args','Symbol','totalStrLength','getWebSocketClass','_isSet','message','_getOwnPropertySymbols','valueOf','','prototype','getter','_connectAttemptCount','stack','stringify','call','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host,\\x20see\\x20','test','readyState','...','rootExpression','reload','_isPrimitiveType','see\\x20https://tinyurl.com/2vt8jxzw\\x20for\\x20more\\x20info.','perf_hooks','webpack','_keyStrRegExp','_isArray','type','ws://','_p_name','_isUndefined','angular','noFunctions','_property','disabledTrace','37fjGnmH','now','join','default','unshift','autoExpandMaxDepth','_isMap','negativeInfinity','endsWith','setter','trace','_sendErrorMessage','_objectToString','funcName','expId','url','_connecting','_ninjaIgnoreNextError','39422pgpDPN','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host','1747412351872','level','[object\\x20Array]','[object\\x20Set]','node','_WebSocketClass','slice','process','map','close','toUpperCase','create','_extendedWarning','NEXT_RUNTIME','count','onmessage','autoExpand','ws/index.js','port','astro','Buffer','_addFunctionsNode','then','7rhEsFe','failed\\x20to\\x20find\\x20and\\x20load\\x20WebSocket','remix','enumerable','','props','4255990VvgSdk','undefined','_getOwnPropertyDescriptor','hits','pop','3NHxNTE','_reconnectTimeout','__es'+'Module','isExpressionToEvaluate','1669476ZzLBDt','Boolean','replace','bind','_quotedRegExp','_cleanNode','_inBrowser','error','versions','4293KmEVEk','number','4209196zSDAmk','_HTMLAllCollection','autoExpandPropertyCount','_undefined','array','method','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20refreshing\\x20the\\x20page\\x20may\\x20help;\\x20also\\x20see\\x20','hasOwnProperty','_getOwnPropertyNames','_inNextEdge','_attemptToReconnectShortly','%c\\x20Console\\x20Ninja\\x20extension\\x20is\\x20connected\\x20to\\x20','_setNodeQueryPath','log','serialize','_additionalMetadata','reduceLimits','HTMLAllCollection','_setNodeExpressionPath','next.js','_connected','18472135xtDrke','_p_','autoExpandPreviousObjects','_consoleNinjaAllowedToStart','env','_setNodePermissions','startsWith','_sortProps','6867760ethuhm','location','some','console','onerror','_addLoadNode','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20restarting\\x20the\\x20process\\x20may\\x20help;\\x20also\\x20see\\x20','function','defineProperty','failed\\x20to\\x20connect\\x20to\\x20host:\\x20','nan','_treeNodePropertiesBeforeFullValue','expressionsToEvaluate','\\x20server','object','_processTreeNodeResult','_isPrimitiveWrapperType','elapsed','cappedElements','_hasMapOnItsPath','unref','Error','parse','_setNodeId','value','hostname','resolveGetters','path','_Symbol','_console_ninja_session','stackTraceLimit','_type','hrtime','toString','fromCharCode','send','getOwnPropertyNames','57802','autoExpandLimit','nodeModules','_WebSocket','Map','null','performance','[object\\x20Date]','index','strLength','name','eventReceivedCallback','unknown','forEach','_console_ninja','14360wcTIGo','date','_addObjectProperty','Number','isArray','constructor','getOwnPropertyDescriptor','getPrototypeOf','split','indexOf','cappedProps','_webSocketErrorDocsLink','_ws','_hasSymbolPropertyOnItsPath','_dateToString','match','substr','toLowerCase','capped','1','NEGATIVE_INFINITY','_addProperty','_socket','[object\\x20Map]','sortProps','global','gateway.docker.internal','charAt','_propertyName','timeStamp','current','positiveInfinity','_maxConnectAttemptCount','_connectToHostNow','concat','_disposeWebsocket','_hasSetOnItsPath','time','_setNodeExpandableState','warn','elements','logger\\x20websocket\\x20error','depth','symbol','_capIfString','dockerizedApp','_numberRegExp','origin','_setNodeLabel','bigint','parent','sort','_treeNodePropertiesAfterFullValue','host'];_0x1ae5=function(){return _0x57f89f;};return _0x1ae5();}var _0xf42111=_0x4aba;(function(_0xe0adb5,_0x3ea577){var _0x1d59e8=_0x4aba,_0x35f817=_0xe0adb5();while(!![]){try{var _0x2d5bb6=-parseInt(_0x1d59e8(0x246))/0x1*(-parseInt(_0x1d59e8(0x258))/0x2)+parseInt(_0x1d59e8(0x27c))/0x3*(parseInt(_0x1d59e8(0x28b))/0x4)+-parseInt(_0x1d59e8(0x277))/0x5+-parseInt(_0x1d59e8(0x280))/0x6*(parseInt(_0x1d59e8(0x271))/0x7)+-parseInt(_0x1d59e8(0x2dc))/0x8*(parseInt(_0x1d59e8(0x289))/0x9)+-parseInt(_0x1d59e8(0x2a8))/0xa+parseInt(_0x1d59e8(0x2a0))/0xb;if(_0x2d5bb6===_0x3ea577)break;else _0x35f817['push'](_0x35f817['shift']());}catch(_0x2c2925){_0x35f817['push'](_0x35f817['shift']());}}}(_0x1ae5,0xc07e8));function _0x4aba(_0x7e1d96,_0x295489){var _0x1ae589=_0x1ae5();return _0x4aba=function(_0x4abaec,_0x1fe035){_0x4abaec=_0x4abaec-0x1dc;var _0x43c859=_0x1ae589[_0x4abaec];return _0x43c859;},_0x4aba(_0x7e1d96,_0x295489);}var G=Object[_0xf42111(0x265)],V=Object[_0xf42111(0x2b0)],ee=Object[_0xf42111(0x1e1)],te=Object[_0xf42111(0x2cc)],ne=Object[_0xf42111(0x1e2)],re=Object[_0xf42111(0x22c)][_0xf42111(0x292)],ie=(_0x191709,_0x2b9352,_0x5e36d3,_0x4f0c20)=>{var _0x2283b7=_0xf42111;if(_0x2b9352&&typeof _0x2b9352==_0x2283b7(0x2b6)||typeof _0x2b9352==_0x2283b7(0x2af)){for(let _0x76bce0 of te(_0x2b9352))!re[_0x2283b7(0x231)](_0x191709,_0x76bce0)&&_0x76bce0!==_0x5e36d3&&V(_0x191709,_0x76bce0,{'get':()=>_0x2b9352[_0x76bce0],'enumerable':!(_0x4f0c20=ee(_0x2b9352,_0x76bce0))||_0x4f0c20[_0x2283b7(0x274)]});}return _0x191709;},j=(_0xa756d7,_0x1d7346,_0x5a99e7)=>(_0x5a99e7=_0xa756d7!=null?G(ne(_0xa756d7)):{},ie(_0x1d7346||!_0xa756d7||!_0xa756d7[_0xf42111(0x27e)]?V(_0x5a99e7,_0xf42111(0x249),{'value':_0xa756d7,'enumerable':!0x0}):_0x5a99e7,_0xa756d7)),q=class{constructor(_0x23d904,_0x315100,_0x12ea26,_0x1c4a4a,_0x10d3ba,_0x1caa3e){var _0x33bbcf=_0xf42111,_0x267f54,_0x1e5f62,_0x29e9d2,_0x58b032;this[_0x33bbcf(0x1f4)]=_0x23d904,this[_0x33bbcf(0x210)]=_0x315100,this[_0x33bbcf(0x26c)]=_0x12ea26,this[_0x33bbcf(0x2cf)]=_0x1c4a4a,this[_0x33bbcf(0x208)]=_0x10d3ba,this[_0x33bbcf(0x2d8)]=_0x1caa3e,this[_0x33bbcf(0x219)]=!0x0,this[_0x33bbcf(0x211)]=!0x0,this['_connected']=!0x1,this[_0x33bbcf(0x256)]=!0x1,this[_0x33bbcf(0x294)]=((_0x1e5f62=(_0x267f54=_0x23d904[_0x33bbcf(0x261)])==null?void 0x0:_0x267f54['env'])==null?void 0x0:_0x1e5f62[_0x33bbcf(0x267)])===_0x33bbcf(0x213),this[_0x33bbcf(0x286)]=!((_0x58b032=(_0x29e9d2=this[_0x33bbcf(0x1f4)][_0x33bbcf(0x261)])==null?void 0x0:_0x29e9d2[_0x33bbcf(0x288)])!=null&&_0x58b032['node'])&&!this[_0x33bbcf(0x294)],this[_0x33bbcf(0x25f)]=null,this[_0x33bbcf(0x22e)]=0x0,this['_maxConnectAttemptCount']=0x14,this[_0x33bbcf(0x1e6)]='https://tinyurl.com/37x8b79t',this[_0x33bbcf(0x251)]=(this['_inBrowser']?_0x33bbcf(0x291):_0x33bbcf(0x2ae))+this[_0x33bbcf(0x1e6)];}async[_0xf42111(0x226)](){var _0xaf85e5=_0xf42111,_0x26286c,_0x123f5e;if(this[_0xaf85e5(0x25f)])return this[_0xaf85e5(0x25f)];let _0x37f7e9;if(this[_0xaf85e5(0x286)]||this[_0xaf85e5(0x294)])_0x37f7e9=this['global']['WebSocket'];else{if((_0x26286c=this[_0xaf85e5(0x1f4)]['process'])!=null&&_0x26286c['_WebSocket'])_0x37f7e9=(_0x123f5e=this[_0xaf85e5(0x1f4)]['process'])==null?void 0x0:_0x123f5e[_0xaf85e5(0x2d0)];else try{let _0x2694f6=await import(_0xaf85e5(0x2c3));_0x37f7e9=(await import((await import(_0xaf85e5(0x255)))['pathToFileURL'](_0x2694f6[_0xaf85e5(0x248)](this[_0xaf85e5(0x2cf)],_0xaf85e5(0x26b)))['toString']()))[_0xaf85e5(0x249)];}catch{try{_0x37f7e9=require(require('path')[_0xaf85e5(0x248)](this[_0xaf85e5(0x2cf)],'ws'));}catch{throw new Error(_0xaf85e5(0x272));}}}return this[_0xaf85e5(0x25f)]=_0x37f7e9,_0x37f7e9;}[_0xf42111(0x1fc)](){var _0x4b255a=_0xf42111;this['_connecting']||this[_0x4b255a(0x29f)]||this[_0x4b255a(0x22e)]>=this['_maxConnectAttemptCount']||(this['_allowedToConnectOnSend']=!0x1,this[_0x4b255a(0x256)]=!0x0,this[_0x4b255a(0x22e)]++,this[_0x4b255a(0x1e7)]=new Promise((_0x30a8f2,_0x31b0fc)=>{var _0x2e0328=_0x4b255a;this[_0x2e0328(0x226)]()[_0x2e0328(0x270)](_0x146f61=>{var _0x425cbc=_0x2e0328;let _0x173384=new _0x146f61(_0x425cbc(0x23f)+(!this[_0x425cbc(0x286)]&&this['dockerizedApp']?_0x425cbc(0x1f5):this[_0x425cbc(0x210)])+':'+this['port']);_0x173384[_0x425cbc(0x2ac)]=()=>{var _0x3208b0=_0x425cbc;this['_allowedToSend']=!0x1,this['_disposeWebsocket'](_0x173384),this[_0x3208b0(0x295)](),_0x31b0fc(new Error(_0x3208b0(0x204)));},_0x173384[_0x425cbc(0x212)]=()=>{var _0x2ad1e1=_0x425cbc;this['_inBrowser']||_0x173384[_0x2ad1e1(0x1f1)]&&_0x173384[_0x2ad1e1(0x1f1)][_0x2ad1e1(0x2bc)]&&_0x173384[_0x2ad1e1(0x1f1)][_0x2ad1e1(0x2bc)](),_0x30a8f2(_0x173384);},_0x173384[_0x425cbc(0x216)]=()=>{var _0x4ee7e9=_0x425cbc;this[_0x4ee7e9(0x211)]=!0x0,this[_0x4ee7e9(0x1fe)](_0x173384),this['_attemptToReconnectShortly']();},_0x173384[_0x425cbc(0x269)]=_0x161967=>{var _0xe832c5=_0x425cbc;try{if(!(_0x161967!=null&&_0x161967[_0xe832c5(0x221)])||!this['eventReceivedCallback'])return;let _0x495fdb=JSON[_0xe832c5(0x2be)](_0x161967[_0xe832c5(0x221)]);this[_0xe832c5(0x2d8)](_0x495fdb[_0xe832c5(0x290)],_0x495fdb[_0xe832c5(0x223)],this['global'],this[_0xe832c5(0x286)]);}catch{}};})[_0x2e0328(0x270)](_0x1c2e61=>(this[_0x2e0328(0x29f)]=!0x0,this[_0x2e0328(0x256)]=!0x1,this['_allowedToConnectOnSend']=!0x1,this[_0x2e0328(0x219)]=!0x0,this[_0x2e0328(0x22e)]=0x0,_0x1c2e61))[_0x2e0328(0x215)](_0x32d29b=>(this[_0x2e0328(0x29f)]=!0x1,this[_0x2e0328(0x256)]=!0x1,console[_0x2e0328(0x202)](_0x2e0328(0x232)+this[_0x2e0328(0x1e6)]),_0x31b0fc(new Error(_0x2e0328(0x2b1)+(_0x32d29b&&_0x32d29b[_0x2e0328(0x228)])))));}));}['_disposeWebsocket'](_0x420e9e){var _0x5b1a8c=_0xf42111;this[_0x5b1a8c(0x29f)]=!0x1,this[_0x5b1a8c(0x256)]=!0x1;try{_0x420e9e[_0x5b1a8c(0x216)]=null,_0x420e9e[_0x5b1a8c(0x2ac)]=null,_0x420e9e[_0x5b1a8c(0x212)]=null;}catch{}try{_0x420e9e[_0x5b1a8c(0x234)]<0x2&&_0x420e9e[_0x5b1a8c(0x263)]();}catch{}}[_0xf42111(0x295)](){var _0x2661a7=_0xf42111;clearTimeout(this[_0x2661a7(0x27d)]),!(this[_0x2661a7(0x22e)]>=this[_0x2661a7(0x1fb)])&&(this[_0x2661a7(0x27d)]=setTimeout(()=>{var _0xb74db5=_0x2661a7,_0x13e791;this[_0xb74db5(0x29f)]||this['_connecting']||(this['_connectToHostNow'](),(_0x13e791=this[_0xb74db5(0x1e7)])==null||_0x13e791[_0xb74db5(0x215)](()=>this[_0xb74db5(0x295)]()));},0x1f4),this[_0x2661a7(0x27d)]['unref']&&this['_reconnectTimeout'][_0x2661a7(0x2bc)]());}async[_0xf42111(0x2cb)](_0x2a3d1d){var _0x37d78=_0xf42111;try{if(!this[_0x37d78(0x219)])return;this[_0x37d78(0x211)]&&this['_connectToHostNow'](),(await this['_ws'])[_0x37d78(0x2cb)](JSON[_0x37d78(0x230)](_0x2a3d1d));}catch(_0x185432){this['_extendedWarning']?console[_0x37d78(0x202)](this[_0x37d78(0x251)]+':\\x20'+(_0x185432&&_0x185432[_0x37d78(0x228)])):(this[_0x37d78(0x266)]=!0x0,console[_0x37d78(0x202)](this[_0x37d78(0x251)]+':\\x20'+(_0x185432&&_0x185432['message']),_0x2a3d1d)),this['_allowedToSend']=!0x1,this[_0x37d78(0x295)]();}}};function H(_0x3bc713,_0x1e3cb6,_0x5a8ad6,_0x499bbb,_0x58a325,_0x30f1ab,_0xb6398e,_0x3f887a=oe){var _0x262065=_0xf42111;let _0x385223=_0x5a8ad6[_0x262065(0x1e3)](',')[_0x262065(0x262)](_0x42487c=>{var _0x3347b2=_0x262065,_0x4eba68,_0x3ad3cd,_0x14a6bb,_0xa042c5;try{if(!_0x3bc713['_console_ninja_session']){let _0x2b3d61=((_0x3ad3cd=(_0x4eba68=_0x3bc713['process'])==null?void 0x0:_0x4eba68['versions'])==null?void 0x0:_0x3ad3cd[_0x3347b2(0x25e)])||((_0xa042c5=(_0x14a6bb=_0x3bc713[_0x3347b2(0x261)])==null?void 0x0:_0x14a6bb[_0x3347b2(0x2a4)])==null?void 0x0:_0xa042c5[_0x3347b2(0x267)])===_0x3347b2(0x213);(_0x58a325==='next.js'||_0x58a325===_0x3347b2(0x273)||_0x58a325===_0x3347b2(0x26d)||_0x58a325===_0x3347b2(0x242))&&(_0x58a325+=_0x2b3d61?_0x3347b2(0x2b5):'\\x20browser'),_0x3bc713['_console_ninja_session']={'id':+new Date(),'tool':_0x58a325},_0xb6398e&&_0x58a325&&!_0x2b3d61&&console[_0x3347b2(0x298)](_0x3347b2(0x296)+(_0x58a325[_0x3347b2(0x1f6)](0x0)[_0x3347b2(0x264)]()+_0x58a325[_0x3347b2(0x1eb)](0x1))+',','background:\\x20rgb(30,30,30);\\x20color:\\x20rgb(255,213,92)',_0x3347b2(0x239));}let _0x389d4a=new q(_0x3bc713,_0x1e3cb6,_0x42487c,_0x499bbb,_0x30f1ab,_0x3f887a);return _0x389d4a[_0x3347b2(0x2cb)][_0x3347b2(0x283)](_0x389d4a);}catch(_0x985037){return console[_0x3347b2(0x202)](_0x3347b2(0x259),_0x985037&&_0x985037[_0x3347b2(0x228)]),()=>{};}});return _0x21c6e4=>_0x385223['forEach'](_0xfefa90=>_0xfefa90(_0x21c6e4));}function oe(_0x292777,_0x2a8e08,_0x56cc2c,_0x5279ec){var _0x534189=_0xf42111;_0x5279ec&&_0x292777==='reload'&&_0x56cc2c[_0x534189(0x2a9)][_0x534189(0x237)]();}function B(_0x56a7ef){var _0x1678d6=_0xf42111,_0x558110,_0x116b3b;let _0x523c19=function(_0x1df102,_0x289a69){return _0x289a69-_0x1df102;},_0x534e1a;if(_0x56a7ef[_0x1678d6(0x2d3)])_0x534e1a=function(){return _0x56a7ef['performance']['now']();};else{if(_0x56a7ef[_0x1678d6(0x261)]&&_0x56a7ef['process'][_0x1678d6(0x2c8)]&&((_0x116b3b=(_0x558110=_0x56a7ef[_0x1678d6(0x261)])==null?void 0x0:_0x558110[_0x1678d6(0x2a4)])==null?void 0x0:_0x116b3b[_0x1678d6(0x267)])!=='edge')_0x534e1a=function(){var _0x1351c7=_0x1678d6;return _0x56a7ef[_0x1351c7(0x261)][_0x1351c7(0x2c8)]();},_0x523c19=function(_0x2e2707,_0x5cb63d){return 0x3e8*(_0x5cb63d[0x0]-_0x2e2707[0x0])+(_0x5cb63d[0x1]-_0x2e2707[0x1])/0xf4240;};else try{let {performance:_0x15f2f4}=require(_0x1678d6(0x23a));_0x534e1a=function(){var _0x31823c=_0x1678d6;return _0x15f2f4[_0x31823c(0x247)]();};}catch{_0x534e1a=function(){return+new Date();};}}return{'elapsed':_0x523c19,'timeStamp':_0x534e1a,'now':()=>Date[_0x1678d6(0x247)]()};}function X(_0x514689,_0x342e12,_0x205742){var _0x188b15=_0xf42111,_0x97f1d9,_0x1ebdf3,_0x3bd97f,_0x288665,_0x53519d;if(_0x514689['_consoleNinjaAllowedToStart']!==void 0x0)return _0x514689[_0x188b15(0x2a3)];let _0x18340c=((_0x1ebdf3=(_0x97f1d9=_0x514689[_0x188b15(0x261)])==null?void 0x0:_0x97f1d9[_0x188b15(0x288)])==null?void 0x0:_0x1ebdf3[_0x188b15(0x25e)])||((_0x288665=(_0x3bd97f=_0x514689[_0x188b15(0x261)])==null?void 0x0:_0x3bd97f['env'])==null?void 0x0:_0x288665[_0x188b15(0x267)])===_0x188b15(0x213);function _0xc2618d(_0x35ae61){var _0x1ab937=_0x188b15;if(_0x35ae61[_0x1ab937(0x2a6)]('/')&&_0x35ae61[_0x1ab937(0x24e)]('/')){let _0x2d87af=new RegExp(_0x35ae61[_0x1ab937(0x260)](0x1,-0x1));return _0xda89bd=>_0x2d87af['test'](_0xda89bd);}else{if(_0x35ae61[_0x1ab937(0x220)]('*')||_0x35ae61['includes']('?')){let _0x1991eb=new RegExp('^'+_0x35ae61[_0x1ab937(0x282)](/\\./g,String[_0x1ab937(0x2ca)](0x5c)+'.')['replace'](/\\*/g,'.*')[_0x1ab937(0x282)](/\\?/g,'.')+String['fromCharCode'](0x24));return _0x5c0e75=>_0x1991eb['test'](_0x5c0e75);}else return _0x482366=>_0x482366===_0x35ae61;}}let _0x241320=_0x342e12['map'](_0xc2618d);return _0x514689[_0x188b15(0x2a3)]=_0x18340c||!_0x342e12,!_0x514689[_0x188b15(0x2a3)]&&((_0x53519d=_0x514689['location'])==null?void 0x0:_0x53519d[_0x188b15(0x2c1)])&&(_0x514689[_0x188b15(0x2a3)]=_0x241320[_0x188b15(0x2aa)](_0x1ccf55=>_0x1ccf55(_0x514689['location'][_0x188b15(0x2c1)]))),_0x514689[_0x188b15(0x2a3)];}function J(_0x9e8ba2,_0x334f71,_0x51107c,_0x4066ae){var _0x4ef3f0=_0xf42111;_0x9e8ba2=_0x9e8ba2,_0x334f71=_0x334f71,_0x51107c=_0x51107c,_0x4066ae=_0x4066ae;let _0x2a5bdd=B(_0x9e8ba2),_0x4acda3=_0x2a5bdd[_0x4ef3f0(0x2b9)],_0x24af88=_0x2a5bdd[_0x4ef3f0(0x1f8)];class _0x53cb52{constructor(){var _0x827f52=_0x4ef3f0;this[_0x827f52(0x23c)]=/^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[_$a-zA-Z\\xA0-\\uFFFF][_$a-zA-Z0-9\\xA0-\\uFFFF]*$/,this[_0x827f52(0x209)]=/^(0|[1-9][0-9]*)$/,this[_0x827f52(0x284)]=/'([^\\\\']|\\\\')*'/,this[_0x827f52(0x28e)]=_0x9e8ba2[_0x827f52(0x278)],this[_0x827f52(0x28c)]=_0x9e8ba2[_0x827f52(0x29c)],this[_0x827f52(0x279)]=Object['getOwnPropertyDescriptor'],this['_getOwnPropertyNames']=Object[_0x827f52(0x2cc)],this[_0x827f52(0x2c4)]=_0x9e8ba2[_0x827f52(0x224)],this[_0x827f52(0x222)]=RegExp[_0x827f52(0x22c)][_0x827f52(0x2c9)],this[_0x827f52(0x1e9)]=Date[_0x827f52(0x22c)][_0x827f52(0x2c9)];}[_0x4ef3f0(0x299)](_0x29d0d5,_0x2480b6,_0x2bd32b,_0x381054){var _0x4b97f4=_0x4ef3f0,_0x3aecd7=this,_0x595325=_0x2bd32b[_0x4b97f4(0x26a)];function _0x3ed355(_0xaf8262,_0x36c9e5,_0x57db4d){var _0x3f42bd=_0x4b97f4;_0x36c9e5[_0x3f42bd(0x23e)]=_0x3f42bd(0x2d9),_0x36c9e5['error']=_0xaf8262[_0x3f42bd(0x228)],_0x491fe1=_0x57db4d[_0x3f42bd(0x25e)][_0x3f42bd(0x1f9)],_0x57db4d[_0x3f42bd(0x25e)]['current']=_0x36c9e5,_0x3aecd7[_0x3f42bd(0x2b3)](_0x36c9e5,_0x57db4d);}let _0x527a1a;_0x9e8ba2[_0x4b97f4(0x2ab)]&&(_0x527a1a=_0x9e8ba2['console'][_0x4b97f4(0x287)],_0x527a1a&&(_0x9e8ba2[_0x4b97f4(0x2ab)][_0x4b97f4(0x287)]=function(){}));try{try{_0x2bd32b[_0x4b97f4(0x25b)]++,_0x2bd32b[_0x4b97f4(0x26a)]&&_0x2bd32b[_0x4b97f4(0x2a2)][_0x4b97f4(0x218)](_0x2480b6);var _0x1dba03,_0x3094e6,_0x28a20e,_0x166b3a,_0x1e409b=[],_0x2711e7=[],_0xb0689,_0x90ab6a=this[_0x4b97f4(0x2c7)](_0x2480b6),_0x523d7f=_0x90ab6a==='array',_0x431c2b=!0x1,_0x18bf7a=_0x90ab6a===_0x4b97f4(0x2af),_0x496a1b=this[_0x4b97f4(0x238)](_0x90ab6a),_0x3187bc=this[_0x4b97f4(0x2b8)](_0x90ab6a),_0x4af4e8=_0x496a1b||_0x3187bc,_0x377d09={},_0x118748=0x0,_0x263b72=!0x1,_0x491fe1,_0x2d7964=/^(([1-9]{1}[0-9]*)|0)$/;if(_0x2bd32b[_0x4b97f4(0x205)]){if(_0x523d7f){if(_0x3094e6=_0x2480b6['length'],_0x3094e6>_0x2bd32b['elements']){for(_0x28a20e=0x0,_0x166b3a=_0x2bd32b[_0x4b97f4(0x203)],_0x1dba03=_0x28a20e;_0x1dba03<_0x166b3a;_0x1dba03++)_0x2711e7[_0x4b97f4(0x218)](_0x3aecd7['_addProperty'](_0x1e409b,_0x2480b6,_0x90ab6a,_0x1dba03,_0x2bd32b));_0x29d0d5[_0x4b97f4(0x2ba)]=!0x0;}else{for(_0x28a20e=0x0,_0x166b3a=_0x3094e6,_0x1dba03=_0x28a20e;_0x1dba03<_0x166b3a;_0x1dba03++)_0x2711e7['push'](_0x3aecd7[_0x4b97f4(0x1f0)](_0x1e409b,_0x2480b6,_0x90ab6a,_0x1dba03,_0x2bd32b));}_0x2bd32b[_0x4b97f4(0x28d)]+=_0x2711e7[_0x4b97f4(0x21b)];}if(!(_0x90ab6a===_0x4b97f4(0x2d2)||_0x90ab6a===_0x4b97f4(0x278))&&!_0x496a1b&&_0x90ab6a!==_0x4b97f4(0x21a)&&_0x90ab6a!==_0x4b97f4(0x26e)&&_0x90ab6a!==_0x4b97f4(0x20c)){var _0x37f061=_0x381054[_0x4b97f4(0x276)]||_0x2bd32b['props'];if(this[_0x4b97f4(0x227)](_0x2480b6)?(_0x1dba03=0x0,_0x2480b6[_0x4b97f4(0x2da)](function(_0x30ba3a){var _0x1acaeb=_0x4b97f4;if(_0x118748++,_0x2bd32b[_0x1acaeb(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;return;}if(!_0x2bd32b[_0x1acaeb(0x27f)]&&_0x2bd32b[_0x1acaeb(0x26a)]&&_0x2bd32b[_0x1acaeb(0x28d)]>_0x2bd32b[_0x1acaeb(0x2ce)]){_0x263b72=!0x0;return;}_0x2711e7[_0x1acaeb(0x218)](_0x3aecd7['_addProperty'](_0x1e409b,_0x2480b6,_0x1acaeb(0x21e),_0x1dba03++,_0x2bd32b,function(_0x3aa276){return function(){return _0x3aa276;};}(_0x30ba3a)));})):this[_0x4b97f4(0x24c)](_0x2480b6)&&_0x2480b6[_0x4b97f4(0x2da)](function(_0x134ac8,_0x868495){var _0x107151=_0x4b97f4;if(_0x118748++,_0x2bd32b[_0x107151(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;return;}if(!_0x2bd32b[_0x107151(0x27f)]&&_0x2bd32b[_0x107151(0x26a)]&&_0x2bd32b['autoExpandPropertyCount']>_0x2bd32b[_0x107151(0x2ce)]){_0x263b72=!0x0;return;}var _0x22c6df=_0x868495[_0x107151(0x2c9)]();_0x22c6df[_0x107151(0x21b)]>0x64&&(_0x22c6df=_0x22c6df[_0x107151(0x260)](0x0,0x64)+_0x107151(0x235)),_0x2711e7[_0x107151(0x218)](_0x3aecd7[_0x107151(0x1f0)](_0x1e409b,_0x2480b6,_0x107151(0x2d1),_0x22c6df,_0x2bd32b,function(_0x3e189c){return function(){return _0x3e189c;};}(_0x134ac8)));}),!_0x431c2b){try{for(_0xb0689 in _0x2480b6)if(!(_0x523d7f&&_0x2d7964[_0x4b97f4(0x233)](_0xb0689))&&!this[_0x4b97f4(0x214)](_0x2480b6,_0xb0689,_0x2bd32b)){if(_0x118748++,_0x2bd32b['autoExpandPropertyCount']++,_0x118748>_0x37f061){_0x263b72=!0x0;break;}if(!_0x2bd32b[_0x4b97f4(0x27f)]&&_0x2bd32b[_0x4b97f4(0x26a)]&&_0x2bd32b[_0x4b97f4(0x28d)]>_0x2bd32b[_0x4b97f4(0x2ce)]){_0x263b72=!0x0;break;}_0x2711e7[_0x4b97f4(0x218)](_0x3aecd7[_0x4b97f4(0x1dd)](_0x1e409b,_0x377d09,_0x2480b6,_0x90ab6a,_0xb0689,_0x2bd32b));}}catch{}if(_0x377d09[_0x4b97f4(0x21d)]=!0x0,_0x18bf7a&&(_0x377d09[_0x4b97f4(0x240)]=!0x0),!_0x263b72){var _0x520d52=[][_0x4b97f4(0x1fd)](this[_0x4b97f4(0x293)](_0x2480b6))[_0x4b97f4(0x1fd)](this[_0x4b97f4(0x229)](_0x2480b6));for(_0x1dba03=0x0,_0x3094e6=_0x520d52[_0x4b97f4(0x21b)];_0x1dba03<_0x3094e6;_0x1dba03++)if(_0xb0689=_0x520d52[_0x1dba03],!(_0x523d7f&&_0x2d7964[_0x4b97f4(0x233)](_0xb0689[_0x4b97f4(0x2c9)]()))&&!this['_blacklistedProperty'](_0x2480b6,_0xb0689,_0x2bd32b)&&!_0x377d09[_0x4b97f4(0x2a1)+_0xb0689[_0x4b97f4(0x2c9)]()]){if(_0x118748++,_0x2bd32b[_0x4b97f4(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;break;}if(!_0x2bd32b[_0x4b97f4(0x27f)]&&_0x2bd32b['autoExpand']&&_0x2bd32b[_0x4b97f4(0x28d)]>_0x2bd32b[_0x4b97f4(0x2ce)]){_0x263b72=!0x0;break;}_0x2711e7['push'](_0x3aecd7[_0x4b97f4(0x1dd)](_0x1e409b,_0x377d09,_0x2480b6,_0x90ab6a,_0xb0689,_0x2bd32b));}}}}}if(_0x29d0d5[_0x4b97f4(0x23e)]=_0x90ab6a,_0x4af4e8?(_0x29d0d5[_0x4b97f4(0x2c0)]=_0x2480b6['valueOf'](),this[_0x4b97f4(0x207)](_0x90ab6a,_0x29d0d5,_0x2bd32b,_0x381054)):_0x90ab6a===_0x4b97f4(0x1dc)?_0x29d0d5['value']=this[_0x4b97f4(0x1e9)][_0x4b97f4(0x231)](_0x2480b6):_0x90ab6a==='bigint'?_0x29d0d5[_0x4b97f4(0x2c0)]=_0x2480b6['toString']():_0x90ab6a==='RegExp'?_0x29d0d5[_0x4b97f4(0x2c0)]=this[_0x4b97f4(0x222)][_0x4b97f4(0x231)](_0x2480b6):_0x90ab6a===_0x4b97f4(0x206)&&this[_0x4b97f4(0x2c4)]?_0x29d0d5['value']=this[_0x4b97f4(0x2c4)]['prototype'][_0x4b97f4(0x2c9)]['call'](_0x2480b6):!_0x2bd32b[_0x4b97f4(0x205)]&&!(_0x90ab6a===_0x4b97f4(0x2d2)||_0x90ab6a===_0x4b97f4(0x278))&&(delete _0x29d0d5[_0x4b97f4(0x2c0)],_0x29d0d5[_0x4b97f4(0x1ed)]=!0x0),_0x263b72&&(_0x29d0d5[_0x4b97f4(0x1e5)]=!0x0),_0x491fe1=_0x2bd32b[_0x4b97f4(0x25e)][_0x4b97f4(0x1f9)],_0x2bd32b[_0x4b97f4(0x25e)][_0x4b97f4(0x1f9)]=_0x29d0d5,this[_0x4b97f4(0x2b3)](_0x29d0d5,_0x2bd32b),_0x2711e7[_0x4b97f4(0x21b)]){for(_0x1dba03=0x0,_0x3094e6=_0x2711e7['length'];_0x1dba03<_0x3094e6;_0x1dba03++)_0x2711e7[_0x1dba03](_0x1dba03);}_0x1e409b['length']&&(_0x29d0d5[_0x4b97f4(0x276)]=_0x1e409b);}catch(_0x2e81d8){_0x3ed355(_0x2e81d8,_0x29d0d5,_0x2bd32b);}this['_additionalMetadata'](_0x2480b6,_0x29d0d5),this[_0x4b97f4(0x20f)](_0x29d0d5,_0x2bd32b),_0x2bd32b['node'][_0x4b97f4(0x1f9)]=_0x491fe1,_0x2bd32b[_0x4b97f4(0x25b)]--,_0x2bd32b[_0x4b97f4(0x26a)]=_0x595325,_0x2bd32b['autoExpand']&&_0x2bd32b['autoExpandPreviousObjects'][_0x4b97f4(0x27b)]();}finally{_0x527a1a&&(_0x9e8ba2['console'][_0x4b97f4(0x287)]=_0x527a1a);}return _0x29d0d5;}['_getOwnPropertySymbols'](_0x2fcff1){return Object['getOwnPropertySymbols']?Object['getOwnPropertySymbols'](_0x2fcff1):[];}['_isSet'](_0x5363f4){var _0x562cd3=_0x4ef3f0;return!!(_0x5363f4&&_0x9e8ba2[_0x562cd3(0x21e)]&&this[_0x562cd3(0x252)](_0x5363f4)===_0x562cd3(0x25d)&&_0x5363f4[_0x562cd3(0x2da)]);}['_blacklistedProperty'](_0x26b018,_0x125780,_0xee3c5b){var _0x1be27b=_0x4ef3f0;return _0xee3c5b[_0x1be27b(0x243)]?typeof _0x26b018[_0x125780]==_0x1be27b(0x2af):!0x1;}[_0x4ef3f0(0x2c7)](_0x562b0d){var _0x553735=_0x4ef3f0,_0x79ad02='';return _0x79ad02=typeof _0x562b0d,_0x79ad02===_0x553735(0x2b6)?this[_0x553735(0x252)](_0x562b0d)===_0x553735(0x25c)?_0x79ad02='array':this['_objectToString'](_0x562b0d)===_0x553735(0x2d4)?_0x79ad02='date':this['_objectToString'](_0x562b0d)==='[object\\x20BigInt]'?_0x79ad02=_0x553735(0x20c):_0x562b0d===null?_0x79ad02=_0x553735(0x2d2):_0x562b0d[_0x553735(0x1e0)]&&(_0x79ad02=_0x562b0d[_0x553735(0x1e0)][_0x553735(0x2d7)]||_0x79ad02):_0x79ad02==='undefined'&&this[_0x553735(0x28c)]&&_0x562b0d instanceof this[_0x553735(0x28c)]&&(_0x79ad02='HTMLAllCollection'),_0x79ad02;}[_0x4ef3f0(0x252)](_0x13a9c){var _0x19555c=_0x4ef3f0;return Object[_0x19555c(0x22c)][_0x19555c(0x2c9)][_0x19555c(0x231)](_0x13a9c);}[_0x4ef3f0(0x238)](_0x5275c9){var _0x202ca7=_0x4ef3f0;return _0x5275c9==='boolean'||_0x5275c9===_0x202ca7(0x21c)||_0x5275c9==='number';}[_0x4ef3f0(0x2b8)](_0x48b627){var _0x5ce49f=_0x4ef3f0;return _0x48b627===_0x5ce49f(0x281)||_0x48b627===_0x5ce49f(0x21a)||_0x48b627===_0x5ce49f(0x1de);}['_addProperty'](_0x43ed69,_0x43af0b,_0x33148a,_0x59a3e7,_0x317779,_0x5a7141){var _0x462714=this;return function(_0xc897cb){var _0x2f6d83=_0x4aba,_0x5a0564=_0x317779['node'][_0x2f6d83(0x1f9)],_0x2fd3a6=_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x2d5)],_0x462589=_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x20d)];_0x317779['node']['parent']=_0x5a0564,_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x2d5)]=typeof _0x59a3e7=='number'?_0x59a3e7:_0xc897cb,_0x43ed69[_0x2f6d83(0x218)](_0x462714[_0x2f6d83(0x244)](_0x43af0b,_0x33148a,_0x59a3e7,_0x317779,_0x5a7141)),_0x317779['node']['parent']=_0x462589,_0x317779['node'][_0x2f6d83(0x2d5)]=_0x2fd3a6;};}['_addObjectProperty'](_0x520d40,_0x570cfe,_0x2420a3,_0xc2dd65,_0x1b4aec,_0xf68dca,_0x55d71b){var _0x110735=_0x4ef3f0,_0x1a0fa8=this;return _0x570cfe[_0x110735(0x2a1)+_0x1b4aec[_0x110735(0x2c9)]()]=!0x0,function(_0x51a890){var _0x2d7f46=_0x110735,_0x379210=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x1f9)],_0x1f7904=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x2d5)],_0x44f7b1=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x20d)];_0xf68dca['node']['parent']=_0x379210,_0xf68dca['node']['index']=_0x51a890,_0x520d40[_0x2d7f46(0x218)](_0x1a0fa8[_0x2d7f46(0x244)](_0x2420a3,_0xc2dd65,_0x1b4aec,_0xf68dca,_0x55d71b)),_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x20d)]=_0x44f7b1,_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x2d5)]=_0x1f7904;};}[_0x4ef3f0(0x244)](_0x33cfc9,_0x4d420b,_0x18378f,_0x319688,_0x52c52f){var _0x3a1cac=_0x4ef3f0,_0x523d91=this;_0x52c52f||(_0x52c52f=function(_0x335655,_0x2ea539){return _0x335655[_0x2ea539];});var _0x1130df=_0x18378f[_0x3a1cac(0x2c9)](),_0x20faa0=_0x319688[_0x3a1cac(0x2b4)]||{},_0x184abf=_0x319688[_0x3a1cac(0x205)],_0x26b283=_0x319688['isExpressionToEvaluate'];try{var _0x164b8b=this[_0x3a1cac(0x24c)](_0x33cfc9),_0xaa6cf=_0x1130df;_0x164b8b&&_0xaa6cf[0x0]==='\\x27'&&(_0xaa6cf=_0xaa6cf['substr'](0x1,_0xaa6cf[_0x3a1cac(0x21b)]-0x2));var _0x3ec3a1=_0x319688[_0x3a1cac(0x2b4)]=_0x20faa0[_0x3a1cac(0x2a1)+_0xaa6cf];_0x3ec3a1&&(_0x319688[_0x3a1cac(0x205)]=_0x319688[_0x3a1cac(0x205)]+0x1),_0x319688[_0x3a1cac(0x27f)]=!!_0x3ec3a1;var _0x5146b4=typeof _0x18378f==_0x3a1cac(0x206),_0xd9e04f={'name':_0x5146b4||_0x164b8b?_0x1130df:this[_0x3a1cac(0x1f7)](_0x1130df)};if(_0x5146b4&&(_0xd9e04f[_0x3a1cac(0x206)]=!0x0),!(_0x4d420b==='array'||_0x4d420b===_0x3a1cac(0x2bd))){var _0x35b3f9=this[_0x3a1cac(0x279)](_0x33cfc9,_0x18378f);if(_0x35b3f9&&(_0x35b3f9['set']&&(_0xd9e04f[_0x3a1cac(0x24f)]=!0x0),_0x35b3f9['get']&&!_0x3ec3a1&&!_0x319688[_0x3a1cac(0x2c2)]))return _0xd9e04f[_0x3a1cac(0x22d)]=!0x0,this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688),_0xd9e04f;}var _0x2f94bf;try{_0x2f94bf=_0x52c52f(_0x33cfc9,_0x18378f);}catch(_0x19c682){return _0xd9e04f={'name':_0x1130df,'type':_0x3a1cac(0x2d9),'error':_0x19c682[_0x3a1cac(0x228)]},this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688),_0xd9e04f;}var _0x1d5726=this[_0x3a1cac(0x2c7)](_0x2f94bf),_0x17c3f3=this[_0x3a1cac(0x238)](_0x1d5726);if(_0xd9e04f['type']=_0x1d5726,_0x17c3f3)this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688,_0x2f94bf,function(){var _0x6124c1=_0x3a1cac;_0xd9e04f[_0x6124c1(0x2c0)]=_0x2f94bf[_0x6124c1(0x22a)](),!_0x3ec3a1&&_0x523d91[_0x6124c1(0x207)](_0x1d5726,_0xd9e04f,_0x319688,{});});else{var _0x1b6503=_0x319688[_0x3a1cac(0x26a)]&&_0x319688[_0x3a1cac(0x25b)]<_0x319688[_0x3a1cac(0x24b)]&&_0x319688[_0x3a1cac(0x2a2)][_0x3a1cac(0x1e4)](_0x2f94bf)<0x0&&_0x1d5726!==_0x3a1cac(0x2af)&&_0x319688[_0x3a1cac(0x28d)]<_0x319688[_0x3a1cac(0x2ce)];_0x1b6503||_0x319688[_0x3a1cac(0x25b)]<_0x184abf||_0x3ec3a1?(this['serialize'](_0xd9e04f,_0x2f94bf,_0x319688,_0x3ec3a1||{}),this[_0x3a1cac(0x29a)](_0x2f94bf,_0xd9e04f)):this['_processTreeNodeResult'](_0xd9e04f,_0x319688,_0x2f94bf,function(){var _0x18e776=_0x3a1cac;_0x1d5726==='null'||_0x1d5726===_0x18e776(0x278)||(delete _0xd9e04f[_0x18e776(0x2c0)],_0xd9e04f[_0x18e776(0x1ed)]=!0x0);});}return _0xd9e04f;}finally{_0x319688['expressionsToEvaluate']=_0x20faa0,_0x319688[_0x3a1cac(0x205)]=_0x184abf,_0x319688[_0x3a1cac(0x27f)]=_0x26b283;}}[_0x4ef3f0(0x207)](_0x246a66,_0x7005fb,_0x7622c0,_0x2c0e24){var _0x3cf6d1=_0x4ef3f0,_0x267611=_0x2c0e24[_0x3cf6d1(0x2d6)]||_0x7622c0[_0x3cf6d1(0x2d6)];if((_0x246a66===_0x3cf6d1(0x21c)||_0x246a66===_0x3cf6d1(0x21a))&&_0x7005fb['value']){let _0x3b4e0d=_0x7005fb[_0x3cf6d1(0x2c0)][_0x3cf6d1(0x21b)];_0x7622c0['allStrLength']+=_0x3b4e0d,_0x7622c0[_0x3cf6d1(0x217)]>_0x7622c0[_0x3cf6d1(0x225)]?(_0x7005fb[_0x3cf6d1(0x1ed)]='',delete _0x7005fb[_0x3cf6d1(0x2c0)]):_0x3b4e0d>_0x267611&&(_0x7005fb[_0x3cf6d1(0x1ed)]=_0x7005fb[_0x3cf6d1(0x2c0)][_0x3cf6d1(0x1eb)](0x0,_0x267611),delete _0x7005fb[_0x3cf6d1(0x2c0)]);}}[_0x4ef3f0(0x24c)](_0x4d8ec0){var _0x5c8b6d=_0x4ef3f0;return!!(_0x4d8ec0&&_0x9e8ba2[_0x5c8b6d(0x2d1)]&&this[_0x5c8b6d(0x252)](_0x4d8ec0)===_0x5c8b6d(0x1f2)&&_0x4d8ec0[_0x5c8b6d(0x2da)]);}['_propertyName'](_0x5e0b66){var _0xdd4e38=_0x4ef3f0;if(_0x5e0b66[_0xdd4e38(0x1ea)](/^\\d+$/))return _0x5e0b66;var _0xa19b6f;try{_0xa19b6f=JSON[_0xdd4e38(0x230)](''+_0x5e0b66);}catch{_0xa19b6f='\\x22'+this[_0xdd4e38(0x252)](_0x5e0b66)+'\\x22';}return _0xa19b6f['match'](/^\"([a-zA-Z_][a-zA-Z_0-9]*)\"$/)?_0xa19b6f=_0xa19b6f[_0xdd4e38(0x1eb)](0x1,_0xa19b6f[_0xdd4e38(0x21b)]-0x2):_0xa19b6f=_0xa19b6f[_0xdd4e38(0x282)](/'/g,'\\x5c\\x27')[_0xdd4e38(0x282)](/\\\\\"/g,'\\x22')[_0xdd4e38(0x282)](/(^\"|\"$)/g,'\\x27'),_0xa19b6f;}[_0x4ef3f0(0x2b7)](_0x2f611d,_0x141852,_0x1e7ce7,_0xc5064){var _0x451f1b=_0x4ef3f0;this[_0x451f1b(0x2b3)](_0x2f611d,_0x141852),_0xc5064&&_0xc5064(),this[_0x451f1b(0x29a)](_0x1e7ce7,_0x2f611d),this[_0x451f1b(0x20f)](_0x2f611d,_0x141852);}[_0x4ef3f0(0x2b3)](_0x4946c8,_0x2c3754){var _0x48ee19=_0x4ef3f0;this['_setNodeId'](_0x4946c8,_0x2c3754),this['_setNodeQueryPath'](_0x4946c8,_0x2c3754),this[_0x48ee19(0x29d)](_0x4946c8,_0x2c3754),this[_0x48ee19(0x2a5)](_0x4946c8,_0x2c3754);}[_0x4ef3f0(0x2bf)](_0x582a65,_0x3e3d7f){}[_0x4ef3f0(0x297)](_0x2f7b0c,_0x18089a){}[_0x4ef3f0(0x20b)](_0xb614d,_0x20943f){}[_0x4ef3f0(0x241)](_0x349402){var _0x3fa54a=_0x4ef3f0;return _0x349402===this[_0x3fa54a(0x28e)];}['_treeNodePropertiesAfterFullValue'](_0x28e4e6,_0x3feec9){var _0x336070=_0x4ef3f0;this[_0x336070(0x20b)](_0x28e4e6,_0x3feec9),this[_0x336070(0x201)](_0x28e4e6),_0x3feec9[_0x336070(0x1f3)]&&this[_0x336070(0x2a7)](_0x28e4e6),this[_0x336070(0x26f)](_0x28e4e6,_0x3feec9),this[_0x336070(0x2ad)](_0x28e4e6,_0x3feec9),this[_0x336070(0x285)](_0x28e4e6);}[_0x4ef3f0(0x29a)](_0x578184,_0x174a14){var _0xcccbe2=_0x4ef3f0;try{_0x578184&&typeof _0x578184[_0xcccbe2(0x21b)]==_0xcccbe2(0x28a)&&(_0x174a14['length']=_0x578184[_0xcccbe2(0x21b)]);}catch{}if(_0x174a14[_0xcccbe2(0x23e)]===_0xcccbe2(0x28a)||_0x174a14[_0xcccbe2(0x23e)]==='Number'){if(isNaN(_0x174a14['value']))_0x174a14[_0xcccbe2(0x2b2)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];else switch(_0x174a14[_0xcccbe2(0x2c0)]){case Number['POSITIVE_INFINITY']:_0x174a14[_0xcccbe2(0x1fa)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];break;case Number[_0xcccbe2(0x1ef)]:_0x174a14[_0xcccbe2(0x24d)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];break;case 0x0:this['_isNegativeZero'](_0x174a14[_0xcccbe2(0x2c0)])&&(_0x174a14['negativeZero']=!0x0);break;}}else _0x174a14[_0xcccbe2(0x23e)]===_0xcccbe2(0x2af)&&typeof _0x578184[_0xcccbe2(0x2d7)]==_0xcccbe2(0x21c)&&_0x578184[_0xcccbe2(0x2d7)]&&_0x174a14[_0xcccbe2(0x2d7)]&&_0x578184[_0xcccbe2(0x2d7)]!==_0x174a14['name']&&(_0x174a14[_0xcccbe2(0x253)]=_0x578184[_0xcccbe2(0x2d7)]);}['_isNegativeZero'](_0x1c8afb){var _0x10332e=_0x4ef3f0;return 0x1/_0x1c8afb===Number[_0x10332e(0x1ef)];}[_0x4ef3f0(0x2a7)](_0x166a0c){var _0x27c448=_0x4ef3f0;!_0x166a0c[_0x27c448(0x276)]||!_0x166a0c['props']['length']||_0x166a0c[_0x27c448(0x23e)]===_0x27c448(0x28f)||_0x166a0c[_0x27c448(0x23e)]==='Map'||_0x166a0c[_0x27c448(0x23e)]==='Set'||_0x166a0c[_0x27c448(0x276)][_0x27c448(0x20e)](function(_0x5c2cb6,_0x165930){var _0xfed0ed=_0x27c448,_0x5712c9=_0x5c2cb6[_0xfed0ed(0x2d7)][_0xfed0ed(0x1ec)](),_0x2df8b7=_0x165930[_0xfed0ed(0x2d7)][_0xfed0ed(0x1ec)]();return _0x5712c9<_0x2df8b7?-0x1:_0x5712c9>_0x2df8b7?0x1:0x0;});}[_0x4ef3f0(0x26f)](_0x123b9c,_0x5a8b0f){var _0xf631bb=_0x4ef3f0;if(!(_0x5a8b0f[_0xf631bb(0x243)]||!_0x123b9c['props']||!_0x123b9c[_0xf631bb(0x276)][_0xf631bb(0x21b)])){for(var _0x14b6f1=[],_0x3382a2=[],_0x513206=0x0,_0x188c9a=_0x123b9c[_0xf631bb(0x276)]['length'];_0x513206<_0x188c9a;_0x513206++){var _0x533e59=_0x123b9c[_0xf631bb(0x276)][_0x513206];_0x533e59['type']==='function'?_0x14b6f1[_0xf631bb(0x218)](_0x533e59):_0x3382a2['push'](_0x533e59);}if(!(!_0x3382a2[_0xf631bb(0x21b)]||_0x14b6f1['length']<=0x1)){_0x123b9c[_0xf631bb(0x276)]=_0x3382a2;var _0x2577ff={'functionsNode':!0x0,'props':_0x14b6f1};this[_0xf631bb(0x2bf)](_0x2577ff,_0x5a8b0f),this[_0xf631bb(0x20b)](_0x2577ff,_0x5a8b0f),this[_0xf631bb(0x201)](_0x2577ff),this['_setNodePermissions'](_0x2577ff,_0x5a8b0f),_0x2577ff['id']+='\\x20f',_0x123b9c['props'][_0xf631bb(0x24a)](_0x2577ff);}}}[_0x4ef3f0(0x2ad)](_0x1d7997,_0x52a427){}[_0x4ef3f0(0x201)](_0x445202){}[_0x4ef3f0(0x23d)](_0x4d1986){var _0x200d2a=_0x4ef3f0;return Array[_0x200d2a(0x1df)](_0x4d1986)||typeof _0x4d1986=='object'&&this[_0x200d2a(0x252)](_0x4d1986)===_0x200d2a(0x25c);}['_setNodePermissions'](_0x149508,_0x29eafe){}[_0x4ef3f0(0x285)](_0x79c8d1){var _0x27c883=_0x4ef3f0;delete _0x79c8d1[_0x27c883(0x1e8)],delete _0x79c8d1[_0x27c883(0x1ff)],delete _0x79c8d1[_0x27c883(0x2bb)];}[_0x4ef3f0(0x29d)](_0x434db9,_0x1a27d6){}}let _0x3acf77=new _0x53cb52(),_0x3f9944={'props':0x64,'elements':0x64,'strLength':0x400*0x32,'totalStrLength':0x400*0x32,'autoExpandLimit':0x1388,'autoExpandMaxDepth':0xa},_0x158b85={'props':0x5,'elements':0x5,'strLength':0x100,'totalStrLength':0x100*0x3,'autoExpandLimit':0x1e,'autoExpandMaxDepth':0x2};function _0x592f4f(_0x223f0c,_0x54589,_0x1136d9,_0x1d6964,_0x5bef40,_0x59669e){var _0x45be8f=_0x4ef3f0;let _0x37574a,_0x2f3c34;try{_0x2f3c34=_0x24af88(),_0x37574a=_0x51107c[_0x54589],!_0x37574a||_0x2f3c34-_0x37574a['ts']>0x1f4&&_0x37574a[_0x45be8f(0x268)]&&_0x37574a['time']/_0x37574a[_0x45be8f(0x268)]<0x64?(_0x51107c[_0x54589]=_0x37574a={'count':0x0,'time':0x0,'ts':_0x2f3c34},_0x51107c[_0x45be8f(0x27a)]={}):_0x2f3c34-_0x51107c['hits']['ts']>0x32&&_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]&&_0x51107c[_0x45be8f(0x27a)]['time']/_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]<0x64&&(_0x51107c['hits']={});let _0x5e7590=[],_0x303aff=_0x37574a[_0x45be8f(0x29b)]||_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x29b)]?_0x158b85:_0x3f9944,_0x5cd473=_0x4d6a9d=>{var _0x427700=_0x45be8f;let _0x422e30={};return _0x422e30[_0x427700(0x276)]=_0x4d6a9d[_0x427700(0x276)],_0x422e30['elements']=_0x4d6a9d[_0x427700(0x203)],_0x422e30[_0x427700(0x2d6)]=_0x4d6a9d['strLength'],_0x422e30['totalStrLength']=_0x4d6a9d[_0x427700(0x225)],_0x422e30[_0x427700(0x2ce)]=_0x4d6a9d[_0x427700(0x2ce)],_0x422e30['autoExpandMaxDepth']=_0x4d6a9d[_0x427700(0x24b)],_0x422e30[_0x427700(0x1f3)]=!0x1,_0x422e30[_0x427700(0x243)]=!_0x334f71,_0x422e30[_0x427700(0x205)]=0x1,_0x422e30[_0x427700(0x25b)]=0x0,_0x422e30[_0x427700(0x254)]='root_exp_id',_0x422e30[_0x427700(0x236)]='root_exp',_0x422e30[_0x427700(0x26a)]=!0x0,_0x422e30[_0x427700(0x2a2)]=[],_0x422e30[_0x427700(0x28d)]=0x0,_0x422e30[_0x427700(0x2c2)]=!0x0,_0x422e30['allStrLength']=0x0,_0x422e30['node']={'current':void 0x0,'parent':void 0x0,'index':0x0},_0x422e30;};for(var _0x2ce81c=0x0;_0x2ce81c<_0x5bef40[_0x45be8f(0x21b)];_0x2ce81c++)_0x5e7590[_0x45be8f(0x218)](_0x3acf77[_0x45be8f(0x299)]({'timeNode':_0x223f0c===_0x45be8f(0x200)||void 0x0},_0x5bef40[_0x2ce81c],_0x5cd473(_0x303aff),{}));if(_0x223f0c==='trace'||_0x223f0c==='error'){let _0x1ab583=Error[_0x45be8f(0x2c6)];try{Error[_0x45be8f(0x2c6)]=0x1/0x0,_0x5e7590[_0x45be8f(0x218)](_0x3acf77['serialize']({'stackNode':!0x0},new Error()[_0x45be8f(0x22f)],_0x5cd473(_0x303aff),{'strLength':0x1/0x0}));}finally{Error[_0x45be8f(0x2c6)]=_0x1ab583;}}return{'method':'log','version':_0x4066ae,'args':[{'ts':_0x1136d9,'session':_0x1d6964,'args':_0x5e7590,'id':_0x54589,'context':_0x59669e}]};}catch(_0xc08614){return{'method':_0x45be8f(0x298),'version':_0x4066ae,'args':[{'ts':_0x1136d9,'session':_0x1d6964,'args':[{'type':'unknown','error':_0xc08614&&_0xc08614[_0x45be8f(0x228)]}],'id':_0x54589,'context':_0x59669e}]};}finally{try{if(_0x37574a&&_0x2f3c34){let _0x47e2fd=_0x24af88();_0x37574a[_0x45be8f(0x268)]++,_0x37574a[_0x45be8f(0x200)]+=_0x4acda3(_0x2f3c34,_0x47e2fd),_0x37574a['ts']=_0x47e2fd,_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]++,_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x200)]+=_0x4acda3(_0x2f3c34,_0x47e2fd),_0x51107c[_0x45be8f(0x27a)]['ts']=_0x47e2fd,(_0x37574a[_0x45be8f(0x268)]>0x32||_0x37574a[_0x45be8f(0x200)]>0x64)&&(_0x37574a[_0x45be8f(0x29b)]=!0x0),(_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]>0x3e8||_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x200)]>0x12c)&&(_0x51107c['hits'][_0x45be8f(0x29b)]=!0x0);}}catch{}}}return _0x592f4f;}((_0x1d4663,_0x5790be,_0x591588,_0x59fd35,_0x1f79cd,_0x3c6a0d,_0x2a6eb4,_0x482905,_0x5dd233,_0x300997,_0x40824a)=>{var _0x2bff8a=_0xf42111;if(_0x1d4663[_0x2bff8a(0x2db)])return _0x1d4663[_0x2bff8a(0x2db)];if(!X(_0x1d4663,_0x482905,_0x1f79cd))return _0x1d4663[_0x2bff8a(0x2db)]={'consoleLog':()=>{},'consoleTrace':()=>{},'consoleTime':()=>{},'consoleTimeEnd':()=>{},'autoLog':()=>{},'autoLogMany':()=>{},'autoTraceMany':()=>{},'coverage':()=>{},'autoTrace':()=>{},'autoTime':()=>{},'autoTimeEnd':()=>{}},_0x1d4663['_console_ninja'];let _0x2ab37c=B(_0x1d4663),_0x5089e9=_0x2ab37c[_0x2bff8a(0x2b9)],_0x24eda4=_0x2ab37c[_0x2bff8a(0x1f8)],_0x177676=_0x2ab37c['now'],_0x34ecbc={'hits':{},'ts':{}},_0x2f6e8a=J(_0x1d4663,_0x5dd233,_0x34ecbc,_0x3c6a0d),_0x5c844f=_0x41f245=>{_0x34ecbc['ts'][_0x41f245]=_0x24eda4();},_0x549ae4=(_0x53c32b,_0x32d193)=>{var _0xb017ca=_0x2bff8a;let _0x4ed5f6=_0x34ecbc['ts'][_0x32d193];if(delete _0x34ecbc['ts'][_0x32d193],_0x4ed5f6){let _0x4fc230=_0x5089e9(_0x4ed5f6,_0x24eda4());_0x1d2fe7(_0x2f6e8a(_0xb017ca(0x200),_0x53c32b,_0x177676(),_0x4f8767,[_0x4fc230],_0x32d193));}},_0x7ca32b=_0x5298a2=>{var _0x85a531=_0x2bff8a,_0x12eff1;return _0x1f79cd===_0x85a531(0x29e)&&_0x1d4663[_0x85a531(0x20a)]&&((_0x12eff1=_0x5298a2==null?void 0x0:_0x5298a2['args'])==null?void 0x0:_0x12eff1[_0x85a531(0x21b)])&&(_0x5298a2[_0x85a531(0x223)][0x0][_0x85a531(0x20a)]=_0x1d4663[_0x85a531(0x20a)]),_0x5298a2;};_0x1d4663[_0x2bff8a(0x2db)]={'consoleLog':(_0x39118b,_0x3cc253)=>{var _0x463333=_0x2bff8a;_0x1d4663[_0x463333(0x2ab)][_0x463333(0x298)]['name']!=='disabledLog'&&_0x1d2fe7(_0x2f6e8a(_0x463333(0x298),_0x39118b,_0x177676(),_0x4f8767,_0x3cc253));},'consoleTrace':(_0xbd86d1,_0x59bc4f)=>{var _0x2b716f=_0x2bff8a,_0xdf1d72,_0x57fed4;_0x1d4663[_0x2b716f(0x2ab)][_0x2b716f(0x298)]['name']!==_0x2b716f(0x245)&&((_0x57fed4=(_0xdf1d72=_0x1d4663[_0x2b716f(0x261)])==null?void 0x0:_0xdf1d72[_0x2b716f(0x288)])!=null&&_0x57fed4[_0x2b716f(0x25e)]&&(_0x1d4663['_ninjaIgnoreNextError']=!0x0),_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x2b716f(0x250),_0xbd86d1,_0x177676(),_0x4f8767,_0x59bc4f))));},'consoleError':(_0x146478,_0x4b8f11)=>{var _0x3255ce=_0x2bff8a;_0x1d4663[_0x3255ce(0x257)]=!0x0,_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x3255ce(0x287),_0x146478,_0x177676(),_0x4f8767,_0x4b8f11)));},'consoleTime':_0x205fad=>{_0x5c844f(_0x205fad);},'consoleTimeEnd':(_0x3a184f,_0x3a07f4)=>{_0x549ae4(_0x3a07f4,_0x3a184f);},'autoLog':(_0x32a379,_0xd1b917)=>{var _0x7eb520=_0x2bff8a;_0x1d2fe7(_0x2f6e8a(_0x7eb520(0x298),_0xd1b917,_0x177676(),_0x4f8767,[_0x32a379]));},'autoLogMany':(_0x58ad40,_0x5eab6f)=>{var _0x2b94ae=_0x2bff8a;_0x1d2fe7(_0x2f6e8a(_0x2b94ae(0x298),_0x58ad40,_0x177676(),_0x4f8767,_0x5eab6f));},'autoTrace':(_0x5b1a6b,_0x276055)=>{var _0xbfa21a=_0x2bff8a;_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0xbfa21a(0x250),_0x276055,_0x177676(),_0x4f8767,[_0x5b1a6b])));},'autoTraceMany':(_0x584f66,_0x1572d9)=>{var _0x5e3c7c=_0x2bff8a;_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x5e3c7c(0x250),_0x584f66,_0x177676(),_0x4f8767,_0x1572d9)));},'autoTime':(_0x957eeb,_0x4863a8,_0x5a8f3b)=>{_0x5c844f(_0x5a8f3b);},'autoTimeEnd':(_0x49ce61,_0x2d878a,_0x368c47)=>{_0x549ae4(_0x2d878a,_0x368c47);},'coverage':_0x508391=>{_0x1d2fe7({'method':'coverage','version':_0x3c6a0d,'args':[{'id':_0x508391}]});}};let _0x1d2fe7=H(_0x1d4663,_0x5790be,_0x591588,_0x59fd35,_0x1f79cd,_0x300997,_0x40824a),_0x4f8767=_0x1d4663[_0x2bff8a(0x2c5)];return _0x1d4663[_0x2bff8a(0x2db)];})(globalThis,'127.0.0.1',_0xf42111(0x2cd),_0xf42111(0x21f),_0xf42111(0x23b),'1.0.0',_0xf42111(0x25a),[\"localhost\",\"127.0.0.1\",\"example.cypress.io\",\"MacBook-Pro-3.local\",\"192.168.50.116\"],_0xf42111(0x22b),_0xf42111(0x275),_0xf42111(0x1ee));");}catch(e){}};/* istanbul ignore next */function oo_oo(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleLog(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_tr(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleTrace(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_tx(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleError(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_ts(/**@type{any}**/v){try{oo_cm().consoleTime(v);}catch(e){} return v;};/* istanbul ignore next */function oo_te(/**@type{any}**/v, /**@type{any}**/i){try{oo_cm().consoleTimeEnd(v, i);}catch(e){} return v;};/*eslint unicorn/no-abusive-eslint-disable:,eslint-comments/disable-enable-pair:,eslint-comments/no-unlimited-disable:,eslint-comments/no-aggregating-enable:,eslint-comments/no-duplicate-disable:,eslint-comments/no-unused-disable:,eslint-comments/no-unused-enable:,*/