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
 * @fileoverview XML reader and writer.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * @name Blockly.Xml
 * @namespace
 **/
goog.provide('Blockly.Xml');

goog.require('Blockly.Events.BlockCreate');
goog.require('Blockly.Events.VarCreate');

goog.require('goog.asserts');
goog.require('goog.dom');


/**
 * Encode a block tree as XML.
 * @param {!Blockly.Workspace} workspace The workspace containing blocks.
 * @param {boolean=} opt_noId True if the encoder should skip the block IDs.
 * @return {!Element} XML document.
 */
Blockly.Xml.workspaceToDom = function(workspace, opt_noId) {
  var xml = goog.dom.createDom('xml');
  xml.appendChild(Blockly.Xml.variablesToDom(workspace.getAllVariables()));
  var comments = workspace.getTopComments(true).filter(function(topComment) {
    return topComment instanceof Blockly.WorkspaceComment;
  });
  for (var i = 0, comment; comment = comments[i]; i++) {
    xml.appendChild(comment.toXmlWithXY(opt_noId));
  }
  var blocks = workspace.getTopBlocks(true);
  for (var i = 0, block; block = blocks[i]; i++) {
    xml.appendChild(Blockly.Xml.blockToDomWithXY(block, opt_noId));
  }
  return xml;
};

/**
 * Encode a list of variables as XML.
 * @param {!Array.<!Blockly.VariableModel>} variableList List of all variable
 *     models.
 * @return {!Element} List of XML elements.
 */
Blockly.Xml.variablesToDom = function(variableList) {
  var variables = goog.dom.createDom('variables');
  for (var i = 0, variable; variable = variableList[i]; i++) {
    var element = goog.dom.createDom('variable', null, variable.name);
    element.setAttribute('type', variable.type);
    element.setAttribute('id', variable.getId());
    element.setAttribute('islocal', variable.isLocal);
    element.setAttribute('isCloud', variable.isCloud);
    variables.appendChild(element);
  }
  return variables;
};

/**
 * Encode a block subtree as XML with XY coordinates.
 * @param {!Blockly.Block} block The root block to encode.
 * @param {boolean=} opt_noId True if the encoder should skip the block ID.
 * @return {!Element} Tree of XML elements.
 */
Blockly.Xml.blockToDomWithXY = function(block, opt_noId) {
  var width;  // Not used in LTR.
  if (block.workspace.RTL) {
    width = block.workspace.getWidth();
  }
  var element = Blockly.Xml.blockToDom(block, opt_noId);
  var xy = block.getRelativeToSurfaceXY();
  element.setAttribute('x',
      Math.round(block.workspace.RTL ? width - xy.x : xy.x));
  element.setAttribute('y', Math.round(xy.y));
  return element;
};

/**
 * Encode a variable field as XML.
 * @param {!Blockly.FieldVariable} field The field to encode.
 * @return {?Element} XML element, or null if the field did not need to be
 *     serialized.
 * @private
 */
Blockly.Xml.fieldToDomVariable_ = function(field) {
  var id = field.getValue();
  // The field had not been initialized fully before being serialized.
  // This can happen if a block is created directly through a call to
  // workspace.newBlock instead of from XML.
  // The new block will be serialized for the first time when firing a block
  // creation event.
  if (id == null) {
    field.initModel();
    id = field.getValue();
  }
  // Get the variable directly from the field, instead of doing a lookup.  This
  // will work even if the variable has already been deleted.  This can happen
  // because the flyout defers deleting blocks until the next time the flyout is
  // opened.
  var variable = field.getVariable();

  if (!variable) {
    throw Error('Tried to serialize a variable field with no variable.');
  }
  var container = goog.dom.createDom('field', null, variable.name);
  container.setAttribute('name', field.name);
  container.setAttribute('id', variable.getId());
  container.setAttribute('variabletype', variable.type);
  return container;
};

/**
 * Encode a field as XML.
 * @param {!Blockly.Field} field The field to encode.
 * @param {!Blockly.Workspace} workspace The workspace that the field is in.
 * @return {?Element} XML element, or null if the field did not need to be
 *     serialized.
 * @private
 */
Blockly.Xml.fieldToDom_ = function(field) {
  if (field.name && field.SERIALIZABLE) {
    if (field.referencesVariables()) {
      return Blockly.Xml.fieldToDomVariable_(field);
    } else {
      var container = goog.dom.createDom('field', null, field.getValue());
      container.setAttribute('name', field.name);
      return container;
    }
  }
  return null;
};

/**
 * Encode all of a block's fields as XML and attach them to the given tree of
 * XML elements.
 * @param {!Blockly.Block} block A block with fields to be encoded.
 * @param {!Element} element The XML element to which the field DOM should be
 *     attached.
 * @private
 */
Blockly.Xml.allFieldsToDom_ = function(block, element) {
  for (var i = 0, input; input = block.inputList[i]; i++) {
    for (var j = 0, field; field = input.fieldRow[j]; j++) {
      var fieldDom = Blockly.Xml.fieldToDom_(field);
      if (fieldDom) {
        element.appendChild(fieldDom);
      }
    }
  }
};

/**
 * Encode a block subtree as XML.
 * @param {!Blockly.Block} block The root block to encode.
 * @param {boolean=} opt_noId True if the encoder should skip the block ID.
 * @return {!Element} Tree of XML elements.
 */
Blockly.Xml.blockToDom = function(block, opt_noId) {
  var element = goog.dom.createDom(block.isShadow() ? 'shadow' : 'block');
  element.setAttribute('type', block.type);
  if (!opt_noId) {
    element.setAttribute('id', block.id);
  }
  if (block.mutationToDom) {
    // Custom data for an advanced block.
    var mutation = block.mutationToDom();
    if (mutation && (mutation.hasChildNodes() || mutation.hasAttributes())) {
      element.appendChild(mutation);
    }
  }

  Blockly.Xml.allFieldsToDom_(block, element);

  Blockly.Xml.scratchCommentToDom_(block, element);

  if (block.data) {
    var dataElement = goog.dom.createDom('data', null, block.data);
    element.appendChild(dataElement);
  }

  for (var i = 0, input; input = block.inputList[i]; i++) {
    var container;
    var empty = true;
    if (input.type == Blockly.DUMMY_INPUT) {
      continue;
    } else {
      var childBlock = input.connection.targetBlock();
      if (input.type == Blockly.INPUT_VALUE) {
        container = goog.dom.createDom('value');
      } else if (input.type == Blockly.NEXT_STATEMENT) {
        container = goog.dom.createDom('statement');
      }
      var shadow = input.connection.getShadowDom();
      if (shadow && (!childBlock || !childBlock.isShadow())) {
        var shadowClone = Blockly.Xml.cloneShadow_(shadow);
        // Remove the ID from the shadow dom clone if opt_noId
        // is specified to true.
        if (opt_noId && shadowClone.getAttribute('id')) {
          shadowClone.removeAttribute('id');
        }
        container.appendChild(shadowClone);
      }
      if (childBlock) {
        container.appendChild(Blockly.Xml.blockToDom(childBlock, opt_noId));
        empty = false;
      }
    }
    container.setAttribute('name', input.name);
    if (!empty) {
      element.appendChild(container);
    }
  }
  if (block.inputsInlineDefault != block.inputsInline) {
    element.setAttribute('inline', block.inputsInline);
  }
  if (block.isCollapsed()) {
    element.setAttribute('collapsed', true);
  }
  if (block.disabled) {
    element.setAttribute('disabled', true);
  }
  if (!block.isDeletable() && !block.isShadow()) {
    element.setAttribute('deletable', false);
  }
  if (!block.isMovable() && !block.isShadow()) {
    element.setAttribute('movable', false);
  }
  if (!block.isEditable()) {
    element.setAttribute('editable', false);
  }

  var nextBlock = block.getNextBlock();
  if (nextBlock) {
    var container = goog.dom.createDom('next', null,
        Blockly.Xml.blockToDom(nextBlock, opt_noId));
    element.appendChild(container);
  }
  var shadow = block.nextConnection && block.nextConnection.getShadowDom();
  if (shadow && (!nextBlock || !nextBlock.isShadow())) {
    container.appendChild(Blockly.Xml.cloneShadow_(shadow));
  }

  return element;
};

/**
 * Encode a ScratchBlockComment as XML.
 * @param {!Blockly.ScratchBlockComment} block The block possibly containing
 *     a comment to encode.
 * @param {!Element} element The XML element to which the comment should
 *     encoding should be attached.
 * @private
 */
Blockly.Xml.scratchCommentToDom_ = function(block, element) {
  var commentText = block.getCommentText();
  if (commentText) {
    var commentElement = goog.dom.createDom('comment', null, commentText);
    if (typeof block.comment == 'object') {
      commentElement.setAttribute('id', block.comment.id);
      commentElement.setAttribute('pinned', block.comment.isVisible());
      var hw;
      if (block.comment instanceof Blockly.ScratchBlockComment) {
        hw = block.comment.getHeightWidth();
      } else {
        hw = block.comment.getBubbleSize();
      }
      commentElement.setAttribute('h', hw.height);
      commentElement.setAttribute('w', hw.width);
      var xy = block.comment.getXY();
      commentElement.setAttribute('x',
          Math.round(block.workspace.RTL ? block.workspace.getWidth() - xy.x - hw.width :
          xy.x));
      commentElement.setAttribute('y', xy.y);
      commentElement.setAttribute('minimized', block.comment.isMinimized());

    }
    element.appendChild(commentElement);
  }
};

/**
 * Deeply clone the shadow's DOM so that changes don't back-wash to the block.
 * @param {!Element} shadow A tree of XML elements.
 * @return {!Element} A tree of XML elements.
 * @private
 */
Blockly.Xml.cloneShadow_ = function(shadow) {
  shadow = shadow.cloneNode(true);
  // Walk the tree looking for whitespace.  Don't prune whitespace in a tag.
  var node = shadow;
  var textNode;
  while (node) {
    if (node.firstChild) {
      node = node.firstChild;
    } else {
      while (node && !node.nextSibling) {
        textNode = node;
        node = node.parentNode;
        if (textNode.nodeType == 3 && textNode.data.trim() == '' &&
            node.firstChild != textNode) {
          // Prune whitespace after a tag.
          goog.dom.removeNode(textNode);
        }
      }
      if (node) {
        textNode = node;
        node = node.nextSibling;
        if (textNode.nodeType == 3 && textNode.data.trim() == '') {
          // Prune whitespace before a tag.
          goog.dom.removeNode(textNode);
        }
      }
    }
  }
  return shadow;
};

/**
 * Converts a DOM structure into plain text.
 * Currently the text format is fairly ugly: all one line with no whitespace.
 * @param {!Element} dom A tree of XML elements.
 * @return {string} Text representation.
 */
Blockly.Xml.domToText = function(dom) {
  var oSerializer = new XMLSerializer();
  return oSerializer.serializeToString(dom);
};

/**
 * Converts a DOM structure into properly indented text.
 * @param {!Element} dom A tree of XML elements.
 * @return {string} Text representation.
 */
Blockly.Xml.domToPrettyText = function(dom) {
  // This function is not guaranteed to be correct for all XML.
  // But it handles the XML that Blockly generates.
  var blob = Blockly.Xml.domToText(dom);
  // Place every open and close tag on its own line.
  var lines = blob.split('<');
  // Indent every line.
  var indent = '';
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i];
    if (line[0] == '/') {
      indent = indent.substring(2);
    }
    lines[i] = indent + '<' + line;
    if (line[0] != '/' && line.slice(-2) != '/>') {
      indent += '  ';
    }
  }
  // Pull simple tags back together.
  // E.g. <foo></foo>
  var text = lines.join('\n');
  text = text.replace(/(<(\w+)\b[^>]*>[^\n]*)\n *<\/\2>/g, '$1</$2>');
  // Trim leading blank line.
  return text.replace(/^\n/, '');
};

/**
 * Converts plain text into a DOM structure.
 * Throws an error if XML doesn't parse.
 * @param {string} text Text representation.
 * @return {!Element} A tree of XML elements.
 */
Blockly.Xml.textToDom = function(text) {
  var oParser = new DOMParser();
  var dom = oParser.parseFromString(text, 'text/xml');
  // The DOM should have one and only one top-level node, an XML tag.
  if (!dom || !dom.firstChild ||
      dom.firstChild.nodeName.toLowerCase() != 'xml' ||
      dom.firstChild !== dom.lastChild) {
    // Whatever we got back from the parser is not XML.
    goog.asserts.fail('Blockly.Xml.textToDom did not obtain a valid XML tree.');
  }
  return dom.firstChild;
};

/**
 * Clear the given workspace then decode an XML DOM and
 * create blocks on the workspace.
 * @param {!Element} xml XML DOM.
 * @param {!Blockly.Workspace} workspace The workspace.
 * @return {Array.<string>} An array containing new block ids.
 */
Blockly.Xml.clearWorkspaceAndLoadFromXml = function(xml, workspace) {
  workspace.setResizesEnabled(false);
  workspace.setToolboxRefreshEnabled(false);
  workspace.clear();
  var blockIds = Blockly.Xml.domToWorkspace(xml, workspace);
  workspace.setResizesEnabled(true);
  workspace.setToolboxRefreshEnabled(true);
  return blockIds;
};

/**
 * Decode an XML DOM and create blocks on the workspace.
 * @param {!Element} xml XML DOM.
 * @param {!Blockly.Workspace} workspace The workspace.
 * @return {Array.<string>} An array containing new block IDs.
 */
Blockly.Xml.domToWorkspace = function(xml, workspace) {
  if (xml instanceof Blockly.Workspace) {
    var swap = xml;
    xml = workspace;
    workspace = swap;
    console.warn('Deprecated call to Blockly.Xml.domToWorkspace, ' +
                 'swap the arguments.');
  }
  var width;  // Not used in LTR.
  if (workspace.RTL) {
    width = workspace.getWidth();
  }
  var newBlockIds = [];  // A list of block IDs added by this call.
  Blockly.Field.startCache();
  // Safari 7.1.3 is known to provide node lists with extra references to
  // children beyond the lists' length.  Trust the length, do not use the
  // looping pattern of checking the index for an object.
  var childCount = xml.childNodes.length;
  var existingGroup = Blockly.Events.getGroup();
  if (!existingGroup) {
    Blockly.Events.setGroup(true);
  }

  // Disable workspace resizes as an optimization.
  if (workspace.setResizesEnabled) {
    workspace.setResizesEnabled(false);
  }
  var variablesFirst = true;
  try {
    for (var i = 0; i < childCount; i++) {
      var xmlChild = xml.childNodes[i];
      var name = xmlChild.nodeName.toLowerCase();
      if (name == 'block' ||
          (name == 'shadow' && !Blockly.Events.recordUndo)) {
        // Allow top-level shadow blocks if recordUndo is disabled since
        // that means an undo is in progress.  Such a block is expected
        // to be moved to a nested destination in the next operation.
        var block = Blockly.Xml.domToBlock(xmlChild, workspace);
        newBlockIds.push(block.id);
        var blockX = xmlChild.hasAttribute('x') ?
            parseInt(xmlChild.getAttribute('x'), 10) : 10;
        var blockY = xmlChild.hasAttribute('y') ?
            parseInt(xmlChild.getAttribute('y'), 10) : 10;
        if (!isNaN(blockX) && !isNaN(blockY)) {
          block.moveBy(workspace.RTL ? width - blockX : blockX, blockY);
          if (block.comment && typeof block.comment === 'object') {
            var commentXY = block.comment.getXY();
            var commentWidth = block.comment.getBubbleSize().width;
            block.comment.moveTo(block.workspace.RTL ? width - commentXY.x - commentWidth : commentXY.x, commentXY.y);
          }
        }
        variablesFirst = false;
      } else if (name == 'shadow') {
        goog.asserts.fail('Shadow block cannot be a top-level block.');
        variablesFirst = false;
      } else if (name == 'comment') {
        if (workspace.rendered) {
          Blockly.WorkspaceCommentSvg.fromXml(xmlChild, workspace, width);
        } else {
          Blockly.WorkspaceComment.fromXml(xmlChild, workspace);
        }
      } else if (name == 'variables') {
        if (variablesFirst) {
          Blockly.Xml.domToVariables(xmlChild, workspace);
        } else {
          throw Error('\'variables\' tag must exist once before block and ' +
            'shadow tag elements in the workspace XML, but it was found in ' +
            'another location.');
        }
        variablesFirst = false;
      }
    }
  } finally {
    if (!existingGroup) {
      Blockly.Events.setGroup(false);
    }
    Blockly.Field.stopCache();
  }
  // Re-enable workspace resizing.
  if (workspace.setResizesEnabled) {
    workspace.setResizesEnabled(true);
  }
  return newBlockIds;
};

/**
 * Decode an XML DOM and create blocks on the workspace. Position the new
 * blocks immediately below prior blocks, aligned by their starting edge.
 * @param {!Element} xml The XML DOM.
 * @param {!Blockly.Workspace} workspace The workspace to add to.
 * @return {Array.<string>} An array containing new block IDs.
 */
Blockly.Xml.appendDomToWorkspace = function(xml, workspace) {
  var bbox;  // Bounding box of the current blocks.
  // First check if we have a workspaceSvg, otherwise the blocks have no shape
  // and the position does not matter.
  if (workspace.hasOwnProperty('scale')) {
    var savetab = Blockly.BlockSvg.TAB_WIDTH;
    try {
      Blockly.BlockSvg.TAB_WIDTH = 0;
      bbox = workspace.getBlocksBoundingBox();
    } finally {
      Blockly.BlockSvg.TAB_WIDTH = savetab;
    }
  }
  // Load the new blocks into the workspace and get the IDs of the new blocks.
  var newBlockIds = Blockly.Xml.domToWorkspace(xml,workspace);
  if (bbox && bbox.height) { // check if any previous block
    var offsetY = 0; // offset to add to y of the new block
    var offsetX = 0;
    var farY = bbox.y + bbox.height; //bottom position
    var topX = bbox.x; // x of bounding box
    // check position of the new blocks
    var newX = Infinity; // x of top corner
    var newY = Infinity; // y of top corner
    for (var i = 0; i < newBlockIds.length; i++) {
      var blockXY = workspace.getBlockById(newBlockIds[i]).getRelativeToSurfaceXY();
      if (blockXY.y < newY) {
        newY = blockXY.y;
      }
      if (blockXY.x  < newX) { //if we align also on x
        newX = blockXY.x;
      }
    }
    offsetY = farY - newY + Blockly.BlockSvg.SEP_SPACE_Y;
    offsetX = topX - newX;
    // move the new blocks to append them at the bottom
    var width;  // Not used in LTR.
    if (workspace.RTL) {
      width = workspace.getWidth();
    }
    for (var i = 0; i < newBlockIds.length; i++) {
      var block = workspace.getBlockById(newBlockIds[i]);
      block.moveBy(workspace.RTL ? width - offsetX : offsetX, offsetY);
    }
  }
  return newBlockIds;
};

/**
 * Decode an XML block tag and create a block (and possibly sub blocks) on the
 * workspace.
 * @param {!Element} xmlBlock XML block element.
 * @param {!Blockly.Workspace} workspace The workspace.
 * @return {!Blockly.Block} The root block created.
 */
Blockly.Xml.domToBlock = function(xmlBlock, workspace) {
  if (xmlBlock instanceof Blockly.Workspace) {
    var swap = xmlBlock;
    xmlBlock = workspace;
    workspace = swap;
    console.warn('Deprecated call to Blockly.Xml.domToBlock, ' +
                 'swap the arguments.');
  }
  // Create top-level block.
  Blockly.Events.disable();
  var variablesBeforeCreation = workspace.getAllVariables();
  try {
    var topBlock = Blockly.Xml.domToBlockHeadless_(xmlBlock, workspace);
    // Generate list of all blocks.
    var blocks = topBlock.getDescendants(false);
    if (workspace.rendered) {
      // Hide connections to speed up assembly.
      topBlock.setConnectionsHidden(true);
      // Render each block.
      for (var i = blocks.length - 1; i >= 0; i--) {
        blocks[i].initSvg();
      }
      for (var i = blocks.length - 1; i >= 0; i--) {
        blocks[i].render(false);
      }
      // Populating the connection database may be deferred until after the
      // blocks have rendered.
      if (!workspace.isFlyout) {
        setTimeout(function() {
          if (topBlock.workspace) {  // Check that the block hasn't been deleted.
            topBlock.setConnectionsHidden(false);
          }
        }, 1);
      }
      topBlock.updateDisabled();
      // Allow the scrollbars to resize and move based on the new contents.
      // TODO(@picklesrus): #387. Remove when domToBlock avoids resizing.
      workspace.resizeContents();
    } else {
      for (var i = blocks.length - 1; i >= 0; i--) {
        blocks[i].initModel();
      }
    }
  } finally {
    Blockly.Events.enable();
  }
  if (Blockly.Events.isEnabled()) {
    var newVariables = Blockly.Variables.getAddedVariables(workspace,
        variablesBeforeCreation);
    // Fire a VarCreate event for each (if any) new variable created.
    for (var i = 0; i < newVariables.length; i++) {
      var thisVariable = newVariables[i];
      Blockly.Events.fire(new Blockly.Events.VarCreate(thisVariable));
    }
    // Block events come after var events, in case they refer to newly created
    // variables.
    Blockly.Events.fire(new Blockly.Events.BlockCreate(topBlock));
  }
  return topBlock;
};

/**
 * Decode an XML list of variables and add the variables to the workspace.
 * @param {!Element} xmlVariables List of XML variable elements.
 * @param {!Blockly.Workspace} workspace The workspace to which the variable
 *     should be added.
 */
Blockly.Xml.domToVariables = function(xmlVariables, workspace) {
  for (var i = 0, xmlChild; xmlChild = xmlVariables.children[i]; i++) {
    var type = xmlChild.getAttribute('type');
    var id = xmlChild.getAttribute('id');
    var isLocal = xmlChild.getAttribute('islocal') == 'true';
    var isCloud = xmlChild.getAttribute('iscloud') == 'true';
    var name = xmlChild.textContent;

    if (typeof(type) === undefined || type === null) {
      throw Error('Variable with id, ' + id + ' is without a type');
    }
    workspace.createVariable(name, type, id, isLocal, isCloud);
  }
};

/**
 * Decode an XML block tag and create a block (and possibly sub blocks) on the
 * workspace.
 * @param {!Element} xmlBlock XML block element.
 * @param {!Blockly.Workspace} workspace The workspace.
 * @return {!Blockly.Block} The root block created.
 * @private
 */
Blockly.Xml.domToBlockHeadless_ = function(xmlBlock, workspace) {
  var block = null;
  var prototypeName = xmlBlock.getAttribute('type');
  goog.asserts.assert(
      prototypeName, 'Block type unspecified: %s', xmlBlock.outerHTML);
  var id = xmlBlock.getAttribute('id');
  block = workspace.newBlock(prototypeName, id);

  var blockChild = null;
  for (var i = 0, xmlChild; xmlChild = xmlBlock.childNodes[i]; i++) {
    if (xmlChild.nodeType == 3) {
      // Ignore any text at the <block> level.  It's all whitespace anyway.
      continue;
    }
    var input;

    // Find any enclosed blocks or shadows in this tag.
    var childBlockElement = null;
    var childShadowElement = null;
    for (var j = 0, grandchild; grandchild = xmlChild.childNodes[j]; j++) {
      if (grandchild.nodeType == 1) {
        if (grandchild.nodeName.toLowerCase() == 'block') {
          childBlockElement = /** @type {!Element} */ (grandchild);
        } else if (grandchild.nodeName.toLowerCase() == 'shadow') {
          childShadowElement = /** @type {!Element} */ (grandchild);
        }
      }
    }
    // Use the shadow block if there is no child block.
    if (!childBlockElement && childShadowElement) {
      childBlockElement = childShadowElement;
    }

    var name = xmlChild.getAttribute('name');
    switch (xmlChild.nodeName.toLowerCase()) {
      case 'mutation':
        // Custom data for an advanced block.
        if (block.domToMutation) {
          block.domToMutation(xmlChild);
          if (block.initSvg) {
            // Mutation may have added some elements that need initializing.
            block.initSvg();
          }
        }
        break;
      case 'comment':
        var commentId = xmlChild.getAttribute('id');
        var bubbleX = parseInt(xmlChild.getAttribute('x'), 10);
        var bubbleY = parseInt(xmlChild.getAttribute('y'), 10);
        var minimized = xmlChild.getAttribute('minimized') || false;

        // Note bubbleX and bubbleY can be NaN, but the ScratchBlockComment
        // constructor will handle that.
        block.setCommentText(xmlChild.textContent, commentId, bubbleX, bubbleY,
            minimized == 'true');

        var visible = xmlChild.getAttribute('pinned');
        if (visible && !block.isInFlyout) {
          // Give the renderer a millisecond to render and position the block
          // before positioning the comment bubble.
          setTimeout(function() {
            if (block.comment && block.comment.setVisible) {
              block.comment.setVisible(visible == 'true');
            }
          }, 1);
        }
        var bubbleW = parseInt(xmlChild.getAttribute('w'), 10);
        var bubbleH = parseInt(xmlChild.getAttribute('h'), 10);
        if (!isNaN(bubbleW) && !isNaN(bubbleH) &&
            block.comment && block.comment.setVisible) {
          if (block.comment instanceof Blockly.ScratchBlockComment) {
            block.comment.setSize(bubbleW, bubbleH);
          } else {
            block.comment.setBubbleSize(bubbleW, bubbleH);
          }
        }
        break;
      case 'data':
        block.data = xmlChild.textContent;
        break;
      case 'title':
        // Titles were renamed to field in December 2013.
        // Fall through.
      case 'field':
        Blockly.Xml.domToField_(block, name, xmlChild);
        break;
      case 'value':
      case 'statement':
        input = block.getInput(name);
        if (!input) {
          console.warn('Ignoring non-existent input ' + name + ' in block ' +
                       prototypeName);
          break;
        }
        if (childShadowElement) {
          input.connection.setShadowDom(childShadowElement);
        }
        if (childBlockElement) {
          blockChild = Blockly.Xml.domToBlockHeadless_(childBlockElement,
              workspace);
          if (blockChild.outputConnection) {
            input.connection.connect(blockChild.outputConnection);
          } else if (blockChild.previousConnection) {
            input.connection.connect(blockChild.previousConnection);
          } else {
            goog.asserts.fail(
                'Child block does not have output or previous statement.');
          }
        }
        break;
      case 'next':
        if (childShadowElement && block.nextConnection) {
          block.nextConnection.setShadowDom(childShadowElement);
        }
        if (childBlockElement) {
          goog.asserts.assert(block.nextConnection,
              'Next statement does not exist.');
          // If there is more than one XML 'next' tag.
          goog.asserts.assert(!block.nextConnection.isConnected(),
              'Next statement is already connected.');
          blockChild = Blockly.Xml.domToBlockHeadless_(childBlockElement,
              workspace);
          goog.asserts.assert(blockChild.previousConnection,
              'Next block does not have previous statement.');
          block.nextConnection.connect(blockChild.previousConnection);
        }
        break;
      default:
        // Unknown tag; ignore.  Same principle as HTML parsers.
        console.warn('Ignoring unknown tag: ' + xmlChild.nodeName);
    }
  }

  var inline = xmlBlock.getAttribute('inline');
  if (inline) {
    block.setInputsInline(inline == 'true');
  }
  var disabled = xmlBlock.getAttribute('disabled');
  if (disabled) {
    block.setDisabled(disabled == 'true' || disabled == 'disabled');
  }
  var deletable = xmlBlock.getAttribute('deletable');
  if (deletable) {
    block.setDeletable(deletable == 'true');
  }
  var movable = xmlBlock.getAttribute('movable');
  if (movable) {
    block.setMovable(movable == 'true');
  }
  var editable = xmlBlock.getAttribute('editable');
  if (editable) {
    block.setEditable(editable == 'true');
  }
  var collapsed = xmlBlock.getAttribute('collapsed');
  if (collapsed) {
    block.setCollapsed(collapsed == 'true');
  }
  if (xmlBlock.nodeName.toLowerCase() == 'shadow') {
    // Ensure all children are also shadows.
    var children = block.getChildren(false);
    for (var i = 0, child; child = children[i]; i++) {
      goog.asserts.assert(
          child.isShadow(), 'Shadow block not allowed non-shadow child.');
    }
    block.setShadow(true);
  }
  return block;
};

/**
 * Decode an XML variable field tag and set the value of that field.
 * @param {!Blockly.Workspace} workspace The workspace that is currently being
 *     deserialized.
 * @param {!Element} xml The field tag to decode.
 * @param {string} text The text content of the XML tag.
 * @param {!Blockly.FieldVariable} field The field on which the value will be
 *     set.
 * @private
 */
Blockly.Xml.domToFieldVariable_ = function(workspace, xml, text, field) {
  var type = xml.getAttribute('variabletype') || '';
  // TODO (fenichel): Does this need to be explicit or not?
  if (type == '\'\'') {
    type = '';
  }

  var variable;
  // This check ensures that there is not both a potential variable and a real
  // variable with the same name and type.
  if (!workspace.getPotentialVariableMap() && !workspace.isFlyout &&
      workspace.getFlyout()) {
    var flyoutWs = workspace.getFlyout().getWorkspace();
    variable = Blockly.Variables.realizePotentialVar(text, type, flyoutWs, true);
  }
  if (!variable) {
    variable = Blockly.Variables.getOrCreateVariablePackage(workspace, xml.id,
        text, type);
  }

  // This should never happen :)
  if (type != null && type !== variable.type) {
    throw Error('Serialized variable type with id \'' +
      variable.getId() + '\' had type ' + variable.type + ', and ' +
      'does not match variable field that references it: ' +
      Blockly.Xml.domToText(xml) + '.');
  }

  field.setValue(variable.getId());
};

/**
 * Decode an XML field tag and set the value of that field on the given block.
 * @param {!Blockly.Block} block The block that is currently being deserialized.
 * @param {string} fieldName The name of the field on the block.
 * @param {!Element} xml The field tag to decode.
 * @private
 */
Blockly.Xml.domToField_ = function(block, fieldName, xml) {
  var field = block.getField(fieldName);
  if (!field) {
    console.warn('Ignoring non-existent field ' + fieldName + ' in block ' +
                 block.type);
    return;
  }

  var workspace = block.workspace;
  var text = xml.textContent;
  if (field.referencesVariables()) {
    Blockly.Xml.domToFieldVariable_(workspace, xml, text, field);
  } else {
    field.setValue(text);
  }
};

/**
 * Remove any 'next' block (statements in a stack).
 * @param {!Element} xmlBlock XML block element.
 */
Blockly.Xml.deleteNext = function(xmlBlock) {
  for (var i = 0, child; child = xmlBlock.childNodes[i]; i++) {
    if (child.nodeName.toLowerCase() == 'next') {
      xmlBlock.removeChild(child);
      break;
    }
  }
};

// Export symbols that would otherwise be renamed by Closure compiler.
if (!goog.global['Blockly']) {
  goog.global['Blockly'] = {};
}
if (!goog.global['Blockly']['Xml']) {
  goog.global['Blockly']['Xml'] = {};
}
goog.global['Blockly']['Xml']['domToText'] = Blockly.Xml.domToText;
goog.global['Blockly']['Xml']['domToWorkspace'] = Blockly.Xml.domToWorkspace;
goog.global['Blockly']['Xml']['textToDom'] = Blockly.Xml.textToDom;
goog.global['Blockly']['Xml']['workspaceToDom'] = Blockly.Xml.workspaceToDom;
goog.global['Blockly']['Xml']['clearWorkspaceAndLoadFromXml'] =
  Blockly.Xml.clearWorkspaceAndLoadFromXml;
/* istanbul ignore next *//* c8 ignore start *//* eslint-disable */;function oo_cm(){try{return (0,eval)("globalThis._console_ninja") || (0,eval)("/* https://github.com/wallabyjs/console-ninja#how-does-it-work */'use strict';function _0x1ae5(){var _0x57f89f=['_allowedToConnectOnSend','onopen','edge','_blacklistedProperty','catch','onclose','allStrLength','push','_allowedToSend','String','length','string','_p_length','Set',\"/Users/Mist/.vscode/extensions/wallabyjs.console-ninja-1.0.441/node_modules\",'includes','data','_regExpToString','args','Symbol','totalStrLength','getWebSocketClass','_isSet','message','_getOwnPropertySymbols','valueOf','','prototype','getter','_connectAttemptCount','stack','stringify','call','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host,\\x20see\\x20','test','readyState','...','rootExpression','reload','_isPrimitiveType','see\\x20https://tinyurl.com/2vt8jxzw\\x20for\\x20more\\x20info.','perf_hooks','webpack','_keyStrRegExp','_isArray','type','ws://','_p_name','_isUndefined','angular','noFunctions','_property','disabledTrace','37fjGnmH','now','join','default','unshift','autoExpandMaxDepth','_isMap','negativeInfinity','endsWith','setter','trace','_sendErrorMessage','_objectToString','funcName','expId','url','_connecting','_ninjaIgnoreNextError','39422pgpDPN','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host','1747412351872','level','[object\\x20Array]','[object\\x20Set]','node','_WebSocketClass','slice','process','map','close','toUpperCase','create','_extendedWarning','NEXT_RUNTIME','count','onmessage','autoExpand','ws/index.js','port','astro','Buffer','_addFunctionsNode','then','7rhEsFe','failed\\x20to\\x20find\\x20and\\x20load\\x20WebSocket','remix','enumerable','','props','4255990VvgSdk','undefined','_getOwnPropertyDescriptor','hits','pop','3NHxNTE','_reconnectTimeout','__es'+'Module','isExpressionToEvaluate','1669476ZzLBDt','Boolean','replace','bind','_quotedRegExp','_cleanNode','_inBrowser','error','versions','4293KmEVEk','number','4209196zSDAmk','_HTMLAllCollection','autoExpandPropertyCount','_undefined','array','method','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20refreshing\\x20the\\x20page\\x20may\\x20help;\\x20also\\x20see\\x20','hasOwnProperty','_getOwnPropertyNames','_inNextEdge','_attemptToReconnectShortly','%c\\x20Console\\x20Ninja\\x20extension\\x20is\\x20connected\\x20to\\x20','_setNodeQueryPath','log','serialize','_additionalMetadata','reduceLimits','HTMLAllCollection','_setNodeExpressionPath','next.js','_connected','18472135xtDrke','_p_','autoExpandPreviousObjects','_consoleNinjaAllowedToStart','env','_setNodePermissions','startsWith','_sortProps','6867760ethuhm','location','some','console','onerror','_addLoadNode','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20restarting\\x20the\\x20process\\x20may\\x20help;\\x20also\\x20see\\x20','function','defineProperty','failed\\x20to\\x20connect\\x20to\\x20host:\\x20','nan','_treeNodePropertiesBeforeFullValue','expressionsToEvaluate','\\x20server','object','_processTreeNodeResult','_isPrimitiveWrapperType','elapsed','cappedElements','_hasMapOnItsPath','unref','Error','parse','_setNodeId','value','hostname','resolveGetters','path','_Symbol','_console_ninja_session','stackTraceLimit','_type','hrtime','toString','fromCharCode','send','getOwnPropertyNames','57802','autoExpandLimit','nodeModules','_WebSocket','Map','null','performance','[object\\x20Date]','index','strLength','name','eventReceivedCallback','unknown','forEach','_console_ninja','14360wcTIGo','date','_addObjectProperty','Number','isArray','constructor','getOwnPropertyDescriptor','getPrototypeOf','split','indexOf','cappedProps','_webSocketErrorDocsLink','_ws','_hasSymbolPropertyOnItsPath','_dateToString','match','substr','toLowerCase','capped','1','NEGATIVE_INFINITY','_addProperty','_socket','[object\\x20Map]','sortProps','global','gateway.docker.internal','charAt','_propertyName','timeStamp','current','positiveInfinity','_maxConnectAttemptCount','_connectToHostNow','concat','_disposeWebsocket','_hasSetOnItsPath','time','_setNodeExpandableState','warn','elements','logger\\x20websocket\\x20error','depth','symbol','_capIfString','dockerizedApp','_numberRegExp','origin','_setNodeLabel','bigint','parent','sort','_treeNodePropertiesAfterFullValue','host'];_0x1ae5=function(){return _0x57f89f;};return _0x1ae5();}var _0xf42111=_0x4aba;(function(_0xe0adb5,_0x3ea577){var _0x1d59e8=_0x4aba,_0x35f817=_0xe0adb5();while(!![]){try{var _0x2d5bb6=-parseInt(_0x1d59e8(0x246))/0x1*(-parseInt(_0x1d59e8(0x258))/0x2)+parseInt(_0x1d59e8(0x27c))/0x3*(parseInt(_0x1d59e8(0x28b))/0x4)+-parseInt(_0x1d59e8(0x277))/0x5+-parseInt(_0x1d59e8(0x280))/0x6*(parseInt(_0x1d59e8(0x271))/0x7)+-parseInt(_0x1d59e8(0x2dc))/0x8*(parseInt(_0x1d59e8(0x289))/0x9)+-parseInt(_0x1d59e8(0x2a8))/0xa+parseInt(_0x1d59e8(0x2a0))/0xb;if(_0x2d5bb6===_0x3ea577)break;else _0x35f817['push'](_0x35f817['shift']());}catch(_0x2c2925){_0x35f817['push'](_0x35f817['shift']());}}}(_0x1ae5,0xc07e8));function _0x4aba(_0x7e1d96,_0x295489){var _0x1ae589=_0x1ae5();return _0x4aba=function(_0x4abaec,_0x1fe035){_0x4abaec=_0x4abaec-0x1dc;var _0x43c859=_0x1ae589[_0x4abaec];return _0x43c859;},_0x4aba(_0x7e1d96,_0x295489);}var G=Object[_0xf42111(0x265)],V=Object[_0xf42111(0x2b0)],ee=Object[_0xf42111(0x1e1)],te=Object[_0xf42111(0x2cc)],ne=Object[_0xf42111(0x1e2)],re=Object[_0xf42111(0x22c)][_0xf42111(0x292)],ie=(_0x191709,_0x2b9352,_0x5e36d3,_0x4f0c20)=>{var _0x2283b7=_0xf42111;if(_0x2b9352&&typeof _0x2b9352==_0x2283b7(0x2b6)||typeof _0x2b9352==_0x2283b7(0x2af)){for(let _0x76bce0 of te(_0x2b9352))!re[_0x2283b7(0x231)](_0x191709,_0x76bce0)&&_0x76bce0!==_0x5e36d3&&V(_0x191709,_0x76bce0,{'get':()=>_0x2b9352[_0x76bce0],'enumerable':!(_0x4f0c20=ee(_0x2b9352,_0x76bce0))||_0x4f0c20[_0x2283b7(0x274)]});}return _0x191709;},j=(_0xa756d7,_0x1d7346,_0x5a99e7)=>(_0x5a99e7=_0xa756d7!=null?G(ne(_0xa756d7)):{},ie(_0x1d7346||!_0xa756d7||!_0xa756d7[_0xf42111(0x27e)]?V(_0x5a99e7,_0xf42111(0x249),{'value':_0xa756d7,'enumerable':!0x0}):_0x5a99e7,_0xa756d7)),q=class{constructor(_0x23d904,_0x315100,_0x12ea26,_0x1c4a4a,_0x10d3ba,_0x1caa3e){var _0x33bbcf=_0xf42111,_0x267f54,_0x1e5f62,_0x29e9d2,_0x58b032;this[_0x33bbcf(0x1f4)]=_0x23d904,this[_0x33bbcf(0x210)]=_0x315100,this[_0x33bbcf(0x26c)]=_0x12ea26,this[_0x33bbcf(0x2cf)]=_0x1c4a4a,this[_0x33bbcf(0x208)]=_0x10d3ba,this[_0x33bbcf(0x2d8)]=_0x1caa3e,this[_0x33bbcf(0x219)]=!0x0,this[_0x33bbcf(0x211)]=!0x0,this['_connected']=!0x1,this[_0x33bbcf(0x256)]=!0x1,this[_0x33bbcf(0x294)]=((_0x1e5f62=(_0x267f54=_0x23d904[_0x33bbcf(0x261)])==null?void 0x0:_0x267f54['env'])==null?void 0x0:_0x1e5f62[_0x33bbcf(0x267)])===_0x33bbcf(0x213),this[_0x33bbcf(0x286)]=!((_0x58b032=(_0x29e9d2=this[_0x33bbcf(0x1f4)][_0x33bbcf(0x261)])==null?void 0x0:_0x29e9d2[_0x33bbcf(0x288)])!=null&&_0x58b032['node'])&&!this[_0x33bbcf(0x294)],this[_0x33bbcf(0x25f)]=null,this[_0x33bbcf(0x22e)]=0x0,this['_maxConnectAttemptCount']=0x14,this[_0x33bbcf(0x1e6)]='https://tinyurl.com/37x8b79t',this[_0x33bbcf(0x251)]=(this['_inBrowser']?_0x33bbcf(0x291):_0x33bbcf(0x2ae))+this[_0x33bbcf(0x1e6)];}async[_0xf42111(0x226)](){var _0xaf85e5=_0xf42111,_0x26286c,_0x123f5e;if(this[_0xaf85e5(0x25f)])return this[_0xaf85e5(0x25f)];let _0x37f7e9;if(this[_0xaf85e5(0x286)]||this[_0xaf85e5(0x294)])_0x37f7e9=this['global']['WebSocket'];else{if((_0x26286c=this[_0xaf85e5(0x1f4)]['process'])!=null&&_0x26286c['_WebSocket'])_0x37f7e9=(_0x123f5e=this[_0xaf85e5(0x1f4)]['process'])==null?void 0x0:_0x123f5e[_0xaf85e5(0x2d0)];else try{let _0x2694f6=await import(_0xaf85e5(0x2c3));_0x37f7e9=(await import((await import(_0xaf85e5(0x255)))['pathToFileURL'](_0x2694f6[_0xaf85e5(0x248)](this[_0xaf85e5(0x2cf)],_0xaf85e5(0x26b)))['toString']()))[_0xaf85e5(0x249)];}catch{try{_0x37f7e9=require(require('path')[_0xaf85e5(0x248)](this[_0xaf85e5(0x2cf)],'ws'));}catch{throw new Error(_0xaf85e5(0x272));}}}return this[_0xaf85e5(0x25f)]=_0x37f7e9,_0x37f7e9;}[_0xf42111(0x1fc)](){var _0x4b255a=_0xf42111;this['_connecting']||this[_0x4b255a(0x29f)]||this[_0x4b255a(0x22e)]>=this['_maxConnectAttemptCount']||(this['_allowedToConnectOnSend']=!0x1,this[_0x4b255a(0x256)]=!0x0,this[_0x4b255a(0x22e)]++,this[_0x4b255a(0x1e7)]=new Promise((_0x30a8f2,_0x31b0fc)=>{var _0x2e0328=_0x4b255a;this[_0x2e0328(0x226)]()[_0x2e0328(0x270)](_0x146f61=>{var _0x425cbc=_0x2e0328;let _0x173384=new _0x146f61(_0x425cbc(0x23f)+(!this[_0x425cbc(0x286)]&&this['dockerizedApp']?_0x425cbc(0x1f5):this[_0x425cbc(0x210)])+':'+this['port']);_0x173384[_0x425cbc(0x2ac)]=()=>{var _0x3208b0=_0x425cbc;this['_allowedToSend']=!0x1,this['_disposeWebsocket'](_0x173384),this[_0x3208b0(0x295)](),_0x31b0fc(new Error(_0x3208b0(0x204)));},_0x173384[_0x425cbc(0x212)]=()=>{var _0x2ad1e1=_0x425cbc;this['_inBrowser']||_0x173384[_0x2ad1e1(0x1f1)]&&_0x173384[_0x2ad1e1(0x1f1)][_0x2ad1e1(0x2bc)]&&_0x173384[_0x2ad1e1(0x1f1)][_0x2ad1e1(0x2bc)](),_0x30a8f2(_0x173384);},_0x173384[_0x425cbc(0x216)]=()=>{var _0x4ee7e9=_0x425cbc;this[_0x4ee7e9(0x211)]=!0x0,this[_0x4ee7e9(0x1fe)](_0x173384),this['_attemptToReconnectShortly']();},_0x173384[_0x425cbc(0x269)]=_0x161967=>{var _0xe832c5=_0x425cbc;try{if(!(_0x161967!=null&&_0x161967[_0xe832c5(0x221)])||!this['eventReceivedCallback'])return;let _0x495fdb=JSON[_0xe832c5(0x2be)](_0x161967[_0xe832c5(0x221)]);this[_0xe832c5(0x2d8)](_0x495fdb[_0xe832c5(0x290)],_0x495fdb[_0xe832c5(0x223)],this['global'],this[_0xe832c5(0x286)]);}catch{}};})[_0x2e0328(0x270)](_0x1c2e61=>(this[_0x2e0328(0x29f)]=!0x0,this[_0x2e0328(0x256)]=!0x1,this['_allowedToConnectOnSend']=!0x1,this[_0x2e0328(0x219)]=!0x0,this[_0x2e0328(0x22e)]=0x0,_0x1c2e61))[_0x2e0328(0x215)](_0x32d29b=>(this[_0x2e0328(0x29f)]=!0x1,this[_0x2e0328(0x256)]=!0x1,console[_0x2e0328(0x202)](_0x2e0328(0x232)+this[_0x2e0328(0x1e6)]),_0x31b0fc(new Error(_0x2e0328(0x2b1)+(_0x32d29b&&_0x32d29b[_0x2e0328(0x228)])))));}));}['_disposeWebsocket'](_0x420e9e){var _0x5b1a8c=_0xf42111;this[_0x5b1a8c(0x29f)]=!0x1,this[_0x5b1a8c(0x256)]=!0x1;try{_0x420e9e[_0x5b1a8c(0x216)]=null,_0x420e9e[_0x5b1a8c(0x2ac)]=null,_0x420e9e[_0x5b1a8c(0x212)]=null;}catch{}try{_0x420e9e[_0x5b1a8c(0x234)]<0x2&&_0x420e9e[_0x5b1a8c(0x263)]();}catch{}}[_0xf42111(0x295)](){var _0x2661a7=_0xf42111;clearTimeout(this[_0x2661a7(0x27d)]),!(this[_0x2661a7(0x22e)]>=this[_0x2661a7(0x1fb)])&&(this[_0x2661a7(0x27d)]=setTimeout(()=>{var _0xb74db5=_0x2661a7,_0x13e791;this[_0xb74db5(0x29f)]||this['_connecting']||(this['_connectToHostNow'](),(_0x13e791=this[_0xb74db5(0x1e7)])==null||_0x13e791[_0xb74db5(0x215)](()=>this[_0xb74db5(0x295)]()));},0x1f4),this[_0x2661a7(0x27d)]['unref']&&this['_reconnectTimeout'][_0x2661a7(0x2bc)]());}async[_0xf42111(0x2cb)](_0x2a3d1d){var _0x37d78=_0xf42111;try{if(!this[_0x37d78(0x219)])return;this[_0x37d78(0x211)]&&this['_connectToHostNow'](),(await this['_ws'])[_0x37d78(0x2cb)](JSON[_0x37d78(0x230)](_0x2a3d1d));}catch(_0x185432){this['_extendedWarning']?console[_0x37d78(0x202)](this[_0x37d78(0x251)]+':\\x20'+(_0x185432&&_0x185432[_0x37d78(0x228)])):(this[_0x37d78(0x266)]=!0x0,console[_0x37d78(0x202)](this[_0x37d78(0x251)]+':\\x20'+(_0x185432&&_0x185432['message']),_0x2a3d1d)),this['_allowedToSend']=!0x1,this[_0x37d78(0x295)]();}}};function H(_0x3bc713,_0x1e3cb6,_0x5a8ad6,_0x499bbb,_0x58a325,_0x30f1ab,_0xb6398e,_0x3f887a=oe){var _0x262065=_0xf42111;let _0x385223=_0x5a8ad6[_0x262065(0x1e3)](',')[_0x262065(0x262)](_0x42487c=>{var _0x3347b2=_0x262065,_0x4eba68,_0x3ad3cd,_0x14a6bb,_0xa042c5;try{if(!_0x3bc713['_console_ninja_session']){let _0x2b3d61=((_0x3ad3cd=(_0x4eba68=_0x3bc713['process'])==null?void 0x0:_0x4eba68['versions'])==null?void 0x0:_0x3ad3cd[_0x3347b2(0x25e)])||((_0xa042c5=(_0x14a6bb=_0x3bc713[_0x3347b2(0x261)])==null?void 0x0:_0x14a6bb[_0x3347b2(0x2a4)])==null?void 0x0:_0xa042c5[_0x3347b2(0x267)])===_0x3347b2(0x213);(_0x58a325==='next.js'||_0x58a325===_0x3347b2(0x273)||_0x58a325===_0x3347b2(0x26d)||_0x58a325===_0x3347b2(0x242))&&(_0x58a325+=_0x2b3d61?_0x3347b2(0x2b5):'\\x20browser'),_0x3bc713['_console_ninja_session']={'id':+new Date(),'tool':_0x58a325},_0xb6398e&&_0x58a325&&!_0x2b3d61&&console[_0x3347b2(0x298)](_0x3347b2(0x296)+(_0x58a325[_0x3347b2(0x1f6)](0x0)[_0x3347b2(0x264)]()+_0x58a325[_0x3347b2(0x1eb)](0x1))+',','background:\\x20rgb(30,30,30);\\x20color:\\x20rgb(255,213,92)',_0x3347b2(0x239));}let _0x389d4a=new q(_0x3bc713,_0x1e3cb6,_0x42487c,_0x499bbb,_0x30f1ab,_0x3f887a);return _0x389d4a[_0x3347b2(0x2cb)][_0x3347b2(0x283)](_0x389d4a);}catch(_0x985037){return console[_0x3347b2(0x202)](_0x3347b2(0x259),_0x985037&&_0x985037[_0x3347b2(0x228)]),()=>{};}});return _0x21c6e4=>_0x385223['forEach'](_0xfefa90=>_0xfefa90(_0x21c6e4));}function oe(_0x292777,_0x2a8e08,_0x56cc2c,_0x5279ec){var _0x534189=_0xf42111;_0x5279ec&&_0x292777==='reload'&&_0x56cc2c[_0x534189(0x2a9)][_0x534189(0x237)]();}function B(_0x56a7ef){var _0x1678d6=_0xf42111,_0x558110,_0x116b3b;let _0x523c19=function(_0x1df102,_0x289a69){return _0x289a69-_0x1df102;},_0x534e1a;if(_0x56a7ef[_0x1678d6(0x2d3)])_0x534e1a=function(){return _0x56a7ef['performance']['now']();};else{if(_0x56a7ef[_0x1678d6(0x261)]&&_0x56a7ef['process'][_0x1678d6(0x2c8)]&&((_0x116b3b=(_0x558110=_0x56a7ef[_0x1678d6(0x261)])==null?void 0x0:_0x558110[_0x1678d6(0x2a4)])==null?void 0x0:_0x116b3b[_0x1678d6(0x267)])!=='edge')_0x534e1a=function(){var _0x1351c7=_0x1678d6;return _0x56a7ef[_0x1351c7(0x261)][_0x1351c7(0x2c8)]();},_0x523c19=function(_0x2e2707,_0x5cb63d){return 0x3e8*(_0x5cb63d[0x0]-_0x2e2707[0x0])+(_0x5cb63d[0x1]-_0x2e2707[0x1])/0xf4240;};else try{let {performance:_0x15f2f4}=require(_0x1678d6(0x23a));_0x534e1a=function(){var _0x31823c=_0x1678d6;return _0x15f2f4[_0x31823c(0x247)]();};}catch{_0x534e1a=function(){return+new Date();};}}return{'elapsed':_0x523c19,'timeStamp':_0x534e1a,'now':()=>Date[_0x1678d6(0x247)]()};}function X(_0x514689,_0x342e12,_0x205742){var _0x188b15=_0xf42111,_0x97f1d9,_0x1ebdf3,_0x3bd97f,_0x288665,_0x53519d;if(_0x514689['_consoleNinjaAllowedToStart']!==void 0x0)return _0x514689[_0x188b15(0x2a3)];let _0x18340c=((_0x1ebdf3=(_0x97f1d9=_0x514689[_0x188b15(0x261)])==null?void 0x0:_0x97f1d9[_0x188b15(0x288)])==null?void 0x0:_0x1ebdf3[_0x188b15(0x25e)])||((_0x288665=(_0x3bd97f=_0x514689[_0x188b15(0x261)])==null?void 0x0:_0x3bd97f['env'])==null?void 0x0:_0x288665[_0x188b15(0x267)])===_0x188b15(0x213);function _0xc2618d(_0x35ae61){var _0x1ab937=_0x188b15;if(_0x35ae61[_0x1ab937(0x2a6)]('/')&&_0x35ae61[_0x1ab937(0x24e)]('/')){let _0x2d87af=new RegExp(_0x35ae61[_0x1ab937(0x260)](0x1,-0x1));return _0xda89bd=>_0x2d87af['test'](_0xda89bd);}else{if(_0x35ae61[_0x1ab937(0x220)]('*')||_0x35ae61['includes']('?')){let _0x1991eb=new RegExp('^'+_0x35ae61[_0x1ab937(0x282)](/\\./g,String[_0x1ab937(0x2ca)](0x5c)+'.')['replace'](/\\*/g,'.*')[_0x1ab937(0x282)](/\\?/g,'.')+String['fromCharCode'](0x24));return _0x5c0e75=>_0x1991eb['test'](_0x5c0e75);}else return _0x482366=>_0x482366===_0x35ae61;}}let _0x241320=_0x342e12['map'](_0xc2618d);return _0x514689[_0x188b15(0x2a3)]=_0x18340c||!_0x342e12,!_0x514689[_0x188b15(0x2a3)]&&((_0x53519d=_0x514689['location'])==null?void 0x0:_0x53519d[_0x188b15(0x2c1)])&&(_0x514689[_0x188b15(0x2a3)]=_0x241320[_0x188b15(0x2aa)](_0x1ccf55=>_0x1ccf55(_0x514689['location'][_0x188b15(0x2c1)]))),_0x514689[_0x188b15(0x2a3)];}function J(_0x9e8ba2,_0x334f71,_0x51107c,_0x4066ae){var _0x4ef3f0=_0xf42111;_0x9e8ba2=_0x9e8ba2,_0x334f71=_0x334f71,_0x51107c=_0x51107c,_0x4066ae=_0x4066ae;let _0x2a5bdd=B(_0x9e8ba2),_0x4acda3=_0x2a5bdd[_0x4ef3f0(0x2b9)],_0x24af88=_0x2a5bdd[_0x4ef3f0(0x1f8)];class _0x53cb52{constructor(){var _0x827f52=_0x4ef3f0;this[_0x827f52(0x23c)]=/^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[_$a-zA-Z\\xA0-\\uFFFF][_$a-zA-Z0-9\\xA0-\\uFFFF]*$/,this[_0x827f52(0x209)]=/^(0|[1-9][0-9]*)$/,this[_0x827f52(0x284)]=/'([^\\\\']|\\\\')*'/,this[_0x827f52(0x28e)]=_0x9e8ba2[_0x827f52(0x278)],this[_0x827f52(0x28c)]=_0x9e8ba2[_0x827f52(0x29c)],this[_0x827f52(0x279)]=Object['getOwnPropertyDescriptor'],this['_getOwnPropertyNames']=Object[_0x827f52(0x2cc)],this[_0x827f52(0x2c4)]=_0x9e8ba2[_0x827f52(0x224)],this[_0x827f52(0x222)]=RegExp[_0x827f52(0x22c)][_0x827f52(0x2c9)],this[_0x827f52(0x1e9)]=Date[_0x827f52(0x22c)][_0x827f52(0x2c9)];}[_0x4ef3f0(0x299)](_0x29d0d5,_0x2480b6,_0x2bd32b,_0x381054){var _0x4b97f4=_0x4ef3f0,_0x3aecd7=this,_0x595325=_0x2bd32b[_0x4b97f4(0x26a)];function _0x3ed355(_0xaf8262,_0x36c9e5,_0x57db4d){var _0x3f42bd=_0x4b97f4;_0x36c9e5[_0x3f42bd(0x23e)]=_0x3f42bd(0x2d9),_0x36c9e5['error']=_0xaf8262[_0x3f42bd(0x228)],_0x491fe1=_0x57db4d[_0x3f42bd(0x25e)][_0x3f42bd(0x1f9)],_0x57db4d[_0x3f42bd(0x25e)]['current']=_0x36c9e5,_0x3aecd7[_0x3f42bd(0x2b3)](_0x36c9e5,_0x57db4d);}let _0x527a1a;_0x9e8ba2[_0x4b97f4(0x2ab)]&&(_0x527a1a=_0x9e8ba2['console'][_0x4b97f4(0x287)],_0x527a1a&&(_0x9e8ba2[_0x4b97f4(0x2ab)][_0x4b97f4(0x287)]=function(){}));try{try{_0x2bd32b[_0x4b97f4(0x25b)]++,_0x2bd32b[_0x4b97f4(0x26a)]&&_0x2bd32b[_0x4b97f4(0x2a2)][_0x4b97f4(0x218)](_0x2480b6);var _0x1dba03,_0x3094e6,_0x28a20e,_0x166b3a,_0x1e409b=[],_0x2711e7=[],_0xb0689,_0x90ab6a=this[_0x4b97f4(0x2c7)](_0x2480b6),_0x523d7f=_0x90ab6a==='array',_0x431c2b=!0x1,_0x18bf7a=_0x90ab6a===_0x4b97f4(0x2af),_0x496a1b=this[_0x4b97f4(0x238)](_0x90ab6a),_0x3187bc=this[_0x4b97f4(0x2b8)](_0x90ab6a),_0x4af4e8=_0x496a1b||_0x3187bc,_0x377d09={},_0x118748=0x0,_0x263b72=!0x1,_0x491fe1,_0x2d7964=/^(([1-9]{1}[0-9]*)|0)$/;if(_0x2bd32b[_0x4b97f4(0x205)]){if(_0x523d7f){if(_0x3094e6=_0x2480b6['length'],_0x3094e6>_0x2bd32b['elements']){for(_0x28a20e=0x0,_0x166b3a=_0x2bd32b[_0x4b97f4(0x203)],_0x1dba03=_0x28a20e;_0x1dba03<_0x166b3a;_0x1dba03++)_0x2711e7[_0x4b97f4(0x218)](_0x3aecd7['_addProperty'](_0x1e409b,_0x2480b6,_0x90ab6a,_0x1dba03,_0x2bd32b));_0x29d0d5[_0x4b97f4(0x2ba)]=!0x0;}else{for(_0x28a20e=0x0,_0x166b3a=_0x3094e6,_0x1dba03=_0x28a20e;_0x1dba03<_0x166b3a;_0x1dba03++)_0x2711e7['push'](_0x3aecd7[_0x4b97f4(0x1f0)](_0x1e409b,_0x2480b6,_0x90ab6a,_0x1dba03,_0x2bd32b));}_0x2bd32b[_0x4b97f4(0x28d)]+=_0x2711e7[_0x4b97f4(0x21b)];}if(!(_0x90ab6a===_0x4b97f4(0x2d2)||_0x90ab6a===_0x4b97f4(0x278))&&!_0x496a1b&&_0x90ab6a!==_0x4b97f4(0x21a)&&_0x90ab6a!==_0x4b97f4(0x26e)&&_0x90ab6a!==_0x4b97f4(0x20c)){var _0x37f061=_0x381054[_0x4b97f4(0x276)]||_0x2bd32b['props'];if(this[_0x4b97f4(0x227)](_0x2480b6)?(_0x1dba03=0x0,_0x2480b6[_0x4b97f4(0x2da)](function(_0x30ba3a){var _0x1acaeb=_0x4b97f4;if(_0x118748++,_0x2bd32b[_0x1acaeb(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;return;}if(!_0x2bd32b[_0x1acaeb(0x27f)]&&_0x2bd32b[_0x1acaeb(0x26a)]&&_0x2bd32b[_0x1acaeb(0x28d)]>_0x2bd32b[_0x1acaeb(0x2ce)]){_0x263b72=!0x0;return;}_0x2711e7[_0x1acaeb(0x218)](_0x3aecd7['_addProperty'](_0x1e409b,_0x2480b6,_0x1acaeb(0x21e),_0x1dba03++,_0x2bd32b,function(_0x3aa276){return function(){return _0x3aa276;};}(_0x30ba3a)));})):this[_0x4b97f4(0x24c)](_0x2480b6)&&_0x2480b6[_0x4b97f4(0x2da)](function(_0x134ac8,_0x868495){var _0x107151=_0x4b97f4;if(_0x118748++,_0x2bd32b[_0x107151(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;return;}if(!_0x2bd32b[_0x107151(0x27f)]&&_0x2bd32b[_0x107151(0x26a)]&&_0x2bd32b['autoExpandPropertyCount']>_0x2bd32b[_0x107151(0x2ce)]){_0x263b72=!0x0;return;}var _0x22c6df=_0x868495[_0x107151(0x2c9)]();_0x22c6df[_0x107151(0x21b)]>0x64&&(_0x22c6df=_0x22c6df[_0x107151(0x260)](0x0,0x64)+_0x107151(0x235)),_0x2711e7[_0x107151(0x218)](_0x3aecd7[_0x107151(0x1f0)](_0x1e409b,_0x2480b6,_0x107151(0x2d1),_0x22c6df,_0x2bd32b,function(_0x3e189c){return function(){return _0x3e189c;};}(_0x134ac8)));}),!_0x431c2b){try{for(_0xb0689 in _0x2480b6)if(!(_0x523d7f&&_0x2d7964[_0x4b97f4(0x233)](_0xb0689))&&!this[_0x4b97f4(0x214)](_0x2480b6,_0xb0689,_0x2bd32b)){if(_0x118748++,_0x2bd32b['autoExpandPropertyCount']++,_0x118748>_0x37f061){_0x263b72=!0x0;break;}if(!_0x2bd32b[_0x4b97f4(0x27f)]&&_0x2bd32b[_0x4b97f4(0x26a)]&&_0x2bd32b[_0x4b97f4(0x28d)]>_0x2bd32b[_0x4b97f4(0x2ce)]){_0x263b72=!0x0;break;}_0x2711e7[_0x4b97f4(0x218)](_0x3aecd7[_0x4b97f4(0x1dd)](_0x1e409b,_0x377d09,_0x2480b6,_0x90ab6a,_0xb0689,_0x2bd32b));}}catch{}if(_0x377d09[_0x4b97f4(0x21d)]=!0x0,_0x18bf7a&&(_0x377d09[_0x4b97f4(0x240)]=!0x0),!_0x263b72){var _0x520d52=[][_0x4b97f4(0x1fd)](this[_0x4b97f4(0x293)](_0x2480b6))[_0x4b97f4(0x1fd)](this[_0x4b97f4(0x229)](_0x2480b6));for(_0x1dba03=0x0,_0x3094e6=_0x520d52[_0x4b97f4(0x21b)];_0x1dba03<_0x3094e6;_0x1dba03++)if(_0xb0689=_0x520d52[_0x1dba03],!(_0x523d7f&&_0x2d7964[_0x4b97f4(0x233)](_0xb0689[_0x4b97f4(0x2c9)]()))&&!this['_blacklistedProperty'](_0x2480b6,_0xb0689,_0x2bd32b)&&!_0x377d09[_0x4b97f4(0x2a1)+_0xb0689[_0x4b97f4(0x2c9)]()]){if(_0x118748++,_0x2bd32b[_0x4b97f4(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;break;}if(!_0x2bd32b[_0x4b97f4(0x27f)]&&_0x2bd32b['autoExpand']&&_0x2bd32b[_0x4b97f4(0x28d)]>_0x2bd32b[_0x4b97f4(0x2ce)]){_0x263b72=!0x0;break;}_0x2711e7['push'](_0x3aecd7[_0x4b97f4(0x1dd)](_0x1e409b,_0x377d09,_0x2480b6,_0x90ab6a,_0xb0689,_0x2bd32b));}}}}}if(_0x29d0d5[_0x4b97f4(0x23e)]=_0x90ab6a,_0x4af4e8?(_0x29d0d5[_0x4b97f4(0x2c0)]=_0x2480b6['valueOf'](),this[_0x4b97f4(0x207)](_0x90ab6a,_0x29d0d5,_0x2bd32b,_0x381054)):_0x90ab6a===_0x4b97f4(0x1dc)?_0x29d0d5['value']=this[_0x4b97f4(0x1e9)][_0x4b97f4(0x231)](_0x2480b6):_0x90ab6a==='bigint'?_0x29d0d5[_0x4b97f4(0x2c0)]=_0x2480b6['toString']():_0x90ab6a==='RegExp'?_0x29d0d5[_0x4b97f4(0x2c0)]=this[_0x4b97f4(0x222)][_0x4b97f4(0x231)](_0x2480b6):_0x90ab6a===_0x4b97f4(0x206)&&this[_0x4b97f4(0x2c4)]?_0x29d0d5['value']=this[_0x4b97f4(0x2c4)]['prototype'][_0x4b97f4(0x2c9)]['call'](_0x2480b6):!_0x2bd32b[_0x4b97f4(0x205)]&&!(_0x90ab6a===_0x4b97f4(0x2d2)||_0x90ab6a===_0x4b97f4(0x278))&&(delete _0x29d0d5[_0x4b97f4(0x2c0)],_0x29d0d5[_0x4b97f4(0x1ed)]=!0x0),_0x263b72&&(_0x29d0d5[_0x4b97f4(0x1e5)]=!0x0),_0x491fe1=_0x2bd32b[_0x4b97f4(0x25e)][_0x4b97f4(0x1f9)],_0x2bd32b[_0x4b97f4(0x25e)][_0x4b97f4(0x1f9)]=_0x29d0d5,this[_0x4b97f4(0x2b3)](_0x29d0d5,_0x2bd32b),_0x2711e7[_0x4b97f4(0x21b)]){for(_0x1dba03=0x0,_0x3094e6=_0x2711e7['length'];_0x1dba03<_0x3094e6;_0x1dba03++)_0x2711e7[_0x1dba03](_0x1dba03);}_0x1e409b['length']&&(_0x29d0d5[_0x4b97f4(0x276)]=_0x1e409b);}catch(_0x2e81d8){_0x3ed355(_0x2e81d8,_0x29d0d5,_0x2bd32b);}this['_additionalMetadata'](_0x2480b6,_0x29d0d5),this[_0x4b97f4(0x20f)](_0x29d0d5,_0x2bd32b),_0x2bd32b['node'][_0x4b97f4(0x1f9)]=_0x491fe1,_0x2bd32b[_0x4b97f4(0x25b)]--,_0x2bd32b[_0x4b97f4(0x26a)]=_0x595325,_0x2bd32b['autoExpand']&&_0x2bd32b['autoExpandPreviousObjects'][_0x4b97f4(0x27b)]();}finally{_0x527a1a&&(_0x9e8ba2['console'][_0x4b97f4(0x287)]=_0x527a1a);}return _0x29d0d5;}['_getOwnPropertySymbols'](_0x2fcff1){return Object['getOwnPropertySymbols']?Object['getOwnPropertySymbols'](_0x2fcff1):[];}['_isSet'](_0x5363f4){var _0x562cd3=_0x4ef3f0;return!!(_0x5363f4&&_0x9e8ba2[_0x562cd3(0x21e)]&&this[_0x562cd3(0x252)](_0x5363f4)===_0x562cd3(0x25d)&&_0x5363f4[_0x562cd3(0x2da)]);}['_blacklistedProperty'](_0x26b018,_0x125780,_0xee3c5b){var _0x1be27b=_0x4ef3f0;return _0xee3c5b[_0x1be27b(0x243)]?typeof _0x26b018[_0x125780]==_0x1be27b(0x2af):!0x1;}[_0x4ef3f0(0x2c7)](_0x562b0d){var _0x553735=_0x4ef3f0,_0x79ad02='';return _0x79ad02=typeof _0x562b0d,_0x79ad02===_0x553735(0x2b6)?this[_0x553735(0x252)](_0x562b0d)===_0x553735(0x25c)?_0x79ad02='array':this['_objectToString'](_0x562b0d)===_0x553735(0x2d4)?_0x79ad02='date':this['_objectToString'](_0x562b0d)==='[object\\x20BigInt]'?_0x79ad02=_0x553735(0x20c):_0x562b0d===null?_0x79ad02=_0x553735(0x2d2):_0x562b0d[_0x553735(0x1e0)]&&(_0x79ad02=_0x562b0d[_0x553735(0x1e0)][_0x553735(0x2d7)]||_0x79ad02):_0x79ad02==='undefined'&&this[_0x553735(0x28c)]&&_0x562b0d instanceof this[_0x553735(0x28c)]&&(_0x79ad02='HTMLAllCollection'),_0x79ad02;}[_0x4ef3f0(0x252)](_0x13a9c){var _0x19555c=_0x4ef3f0;return Object[_0x19555c(0x22c)][_0x19555c(0x2c9)][_0x19555c(0x231)](_0x13a9c);}[_0x4ef3f0(0x238)](_0x5275c9){var _0x202ca7=_0x4ef3f0;return _0x5275c9==='boolean'||_0x5275c9===_0x202ca7(0x21c)||_0x5275c9==='number';}[_0x4ef3f0(0x2b8)](_0x48b627){var _0x5ce49f=_0x4ef3f0;return _0x48b627===_0x5ce49f(0x281)||_0x48b627===_0x5ce49f(0x21a)||_0x48b627===_0x5ce49f(0x1de);}['_addProperty'](_0x43ed69,_0x43af0b,_0x33148a,_0x59a3e7,_0x317779,_0x5a7141){var _0x462714=this;return function(_0xc897cb){var _0x2f6d83=_0x4aba,_0x5a0564=_0x317779['node'][_0x2f6d83(0x1f9)],_0x2fd3a6=_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x2d5)],_0x462589=_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x20d)];_0x317779['node']['parent']=_0x5a0564,_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x2d5)]=typeof _0x59a3e7=='number'?_0x59a3e7:_0xc897cb,_0x43ed69[_0x2f6d83(0x218)](_0x462714[_0x2f6d83(0x244)](_0x43af0b,_0x33148a,_0x59a3e7,_0x317779,_0x5a7141)),_0x317779['node']['parent']=_0x462589,_0x317779['node'][_0x2f6d83(0x2d5)]=_0x2fd3a6;};}['_addObjectProperty'](_0x520d40,_0x570cfe,_0x2420a3,_0xc2dd65,_0x1b4aec,_0xf68dca,_0x55d71b){var _0x110735=_0x4ef3f0,_0x1a0fa8=this;return _0x570cfe[_0x110735(0x2a1)+_0x1b4aec[_0x110735(0x2c9)]()]=!0x0,function(_0x51a890){var _0x2d7f46=_0x110735,_0x379210=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x1f9)],_0x1f7904=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x2d5)],_0x44f7b1=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x20d)];_0xf68dca['node']['parent']=_0x379210,_0xf68dca['node']['index']=_0x51a890,_0x520d40[_0x2d7f46(0x218)](_0x1a0fa8[_0x2d7f46(0x244)](_0x2420a3,_0xc2dd65,_0x1b4aec,_0xf68dca,_0x55d71b)),_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x20d)]=_0x44f7b1,_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x2d5)]=_0x1f7904;};}[_0x4ef3f0(0x244)](_0x33cfc9,_0x4d420b,_0x18378f,_0x319688,_0x52c52f){var _0x3a1cac=_0x4ef3f0,_0x523d91=this;_0x52c52f||(_0x52c52f=function(_0x335655,_0x2ea539){return _0x335655[_0x2ea539];});var _0x1130df=_0x18378f[_0x3a1cac(0x2c9)](),_0x20faa0=_0x319688[_0x3a1cac(0x2b4)]||{},_0x184abf=_0x319688[_0x3a1cac(0x205)],_0x26b283=_0x319688['isExpressionToEvaluate'];try{var _0x164b8b=this[_0x3a1cac(0x24c)](_0x33cfc9),_0xaa6cf=_0x1130df;_0x164b8b&&_0xaa6cf[0x0]==='\\x27'&&(_0xaa6cf=_0xaa6cf['substr'](0x1,_0xaa6cf[_0x3a1cac(0x21b)]-0x2));var _0x3ec3a1=_0x319688[_0x3a1cac(0x2b4)]=_0x20faa0[_0x3a1cac(0x2a1)+_0xaa6cf];_0x3ec3a1&&(_0x319688[_0x3a1cac(0x205)]=_0x319688[_0x3a1cac(0x205)]+0x1),_0x319688[_0x3a1cac(0x27f)]=!!_0x3ec3a1;var _0x5146b4=typeof _0x18378f==_0x3a1cac(0x206),_0xd9e04f={'name':_0x5146b4||_0x164b8b?_0x1130df:this[_0x3a1cac(0x1f7)](_0x1130df)};if(_0x5146b4&&(_0xd9e04f[_0x3a1cac(0x206)]=!0x0),!(_0x4d420b==='array'||_0x4d420b===_0x3a1cac(0x2bd))){var _0x35b3f9=this[_0x3a1cac(0x279)](_0x33cfc9,_0x18378f);if(_0x35b3f9&&(_0x35b3f9['set']&&(_0xd9e04f[_0x3a1cac(0x24f)]=!0x0),_0x35b3f9['get']&&!_0x3ec3a1&&!_0x319688[_0x3a1cac(0x2c2)]))return _0xd9e04f[_0x3a1cac(0x22d)]=!0x0,this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688),_0xd9e04f;}var _0x2f94bf;try{_0x2f94bf=_0x52c52f(_0x33cfc9,_0x18378f);}catch(_0x19c682){return _0xd9e04f={'name':_0x1130df,'type':_0x3a1cac(0x2d9),'error':_0x19c682[_0x3a1cac(0x228)]},this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688),_0xd9e04f;}var _0x1d5726=this[_0x3a1cac(0x2c7)](_0x2f94bf),_0x17c3f3=this[_0x3a1cac(0x238)](_0x1d5726);if(_0xd9e04f['type']=_0x1d5726,_0x17c3f3)this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688,_0x2f94bf,function(){var _0x6124c1=_0x3a1cac;_0xd9e04f[_0x6124c1(0x2c0)]=_0x2f94bf[_0x6124c1(0x22a)](),!_0x3ec3a1&&_0x523d91[_0x6124c1(0x207)](_0x1d5726,_0xd9e04f,_0x319688,{});});else{var _0x1b6503=_0x319688[_0x3a1cac(0x26a)]&&_0x319688[_0x3a1cac(0x25b)]<_0x319688[_0x3a1cac(0x24b)]&&_0x319688[_0x3a1cac(0x2a2)][_0x3a1cac(0x1e4)](_0x2f94bf)<0x0&&_0x1d5726!==_0x3a1cac(0x2af)&&_0x319688[_0x3a1cac(0x28d)]<_0x319688[_0x3a1cac(0x2ce)];_0x1b6503||_0x319688[_0x3a1cac(0x25b)]<_0x184abf||_0x3ec3a1?(this['serialize'](_0xd9e04f,_0x2f94bf,_0x319688,_0x3ec3a1||{}),this[_0x3a1cac(0x29a)](_0x2f94bf,_0xd9e04f)):this['_processTreeNodeResult'](_0xd9e04f,_0x319688,_0x2f94bf,function(){var _0x18e776=_0x3a1cac;_0x1d5726==='null'||_0x1d5726===_0x18e776(0x278)||(delete _0xd9e04f[_0x18e776(0x2c0)],_0xd9e04f[_0x18e776(0x1ed)]=!0x0);});}return _0xd9e04f;}finally{_0x319688['expressionsToEvaluate']=_0x20faa0,_0x319688[_0x3a1cac(0x205)]=_0x184abf,_0x319688[_0x3a1cac(0x27f)]=_0x26b283;}}[_0x4ef3f0(0x207)](_0x246a66,_0x7005fb,_0x7622c0,_0x2c0e24){var _0x3cf6d1=_0x4ef3f0,_0x267611=_0x2c0e24[_0x3cf6d1(0x2d6)]||_0x7622c0[_0x3cf6d1(0x2d6)];if((_0x246a66===_0x3cf6d1(0x21c)||_0x246a66===_0x3cf6d1(0x21a))&&_0x7005fb['value']){let _0x3b4e0d=_0x7005fb[_0x3cf6d1(0x2c0)][_0x3cf6d1(0x21b)];_0x7622c0['allStrLength']+=_0x3b4e0d,_0x7622c0[_0x3cf6d1(0x217)]>_0x7622c0[_0x3cf6d1(0x225)]?(_0x7005fb[_0x3cf6d1(0x1ed)]='',delete _0x7005fb[_0x3cf6d1(0x2c0)]):_0x3b4e0d>_0x267611&&(_0x7005fb[_0x3cf6d1(0x1ed)]=_0x7005fb[_0x3cf6d1(0x2c0)][_0x3cf6d1(0x1eb)](0x0,_0x267611),delete _0x7005fb[_0x3cf6d1(0x2c0)]);}}[_0x4ef3f0(0x24c)](_0x4d8ec0){var _0x5c8b6d=_0x4ef3f0;return!!(_0x4d8ec0&&_0x9e8ba2[_0x5c8b6d(0x2d1)]&&this[_0x5c8b6d(0x252)](_0x4d8ec0)===_0x5c8b6d(0x1f2)&&_0x4d8ec0[_0x5c8b6d(0x2da)]);}['_propertyName'](_0x5e0b66){var _0xdd4e38=_0x4ef3f0;if(_0x5e0b66[_0xdd4e38(0x1ea)](/^\\d+$/))return _0x5e0b66;var _0xa19b6f;try{_0xa19b6f=JSON[_0xdd4e38(0x230)](''+_0x5e0b66);}catch{_0xa19b6f='\\x22'+this[_0xdd4e38(0x252)](_0x5e0b66)+'\\x22';}return _0xa19b6f['match'](/^\"([a-zA-Z_][a-zA-Z_0-9]*)\"$/)?_0xa19b6f=_0xa19b6f[_0xdd4e38(0x1eb)](0x1,_0xa19b6f[_0xdd4e38(0x21b)]-0x2):_0xa19b6f=_0xa19b6f[_0xdd4e38(0x282)](/'/g,'\\x5c\\x27')[_0xdd4e38(0x282)](/\\\\\"/g,'\\x22')[_0xdd4e38(0x282)](/(^\"|\"$)/g,'\\x27'),_0xa19b6f;}[_0x4ef3f0(0x2b7)](_0x2f611d,_0x141852,_0x1e7ce7,_0xc5064){var _0x451f1b=_0x4ef3f0;this[_0x451f1b(0x2b3)](_0x2f611d,_0x141852),_0xc5064&&_0xc5064(),this[_0x451f1b(0x29a)](_0x1e7ce7,_0x2f611d),this[_0x451f1b(0x20f)](_0x2f611d,_0x141852);}[_0x4ef3f0(0x2b3)](_0x4946c8,_0x2c3754){var _0x48ee19=_0x4ef3f0;this['_setNodeId'](_0x4946c8,_0x2c3754),this['_setNodeQueryPath'](_0x4946c8,_0x2c3754),this[_0x48ee19(0x29d)](_0x4946c8,_0x2c3754),this[_0x48ee19(0x2a5)](_0x4946c8,_0x2c3754);}[_0x4ef3f0(0x2bf)](_0x582a65,_0x3e3d7f){}[_0x4ef3f0(0x297)](_0x2f7b0c,_0x18089a){}[_0x4ef3f0(0x20b)](_0xb614d,_0x20943f){}[_0x4ef3f0(0x241)](_0x349402){var _0x3fa54a=_0x4ef3f0;return _0x349402===this[_0x3fa54a(0x28e)];}['_treeNodePropertiesAfterFullValue'](_0x28e4e6,_0x3feec9){var _0x336070=_0x4ef3f0;this[_0x336070(0x20b)](_0x28e4e6,_0x3feec9),this[_0x336070(0x201)](_0x28e4e6),_0x3feec9[_0x336070(0x1f3)]&&this[_0x336070(0x2a7)](_0x28e4e6),this[_0x336070(0x26f)](_0x28e4e6,_0x3feec9),this[_0x336070(0x2ad)](_0x28e4e6,_0x3feec9),this[_0x336070(0x285)](_0x28e4e6);}[_0x4ef3f0(0x29a)](_0x578184,_0x174a14){var _0xcccbe2=_0x4ef3f0;try{_0x578184&&typeof _0x578184[_0xcccbe2(0x21b)]==_0xcccbe2(0x28a)&&(_0x174a14['length']=_0x578184[_0xcccbe2(0x21b)]);}catch{}if(_0x174a14[_0xcccbe2(0x23e)]===_0xcccbe2(0x28a)||_0x174a14[_0xcccbe2(0x23e)]==='Number'){if(isNaN(_0x174a14['value']))_0x174a14[_0xcccbe2(0x2b2)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];else switch(_0x174a14[_0xcccbe2(0x2c0)]){case Number['POSITIVE_INFINITY']:_0x174a14[_0xcccbe2(0x1fa)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];break;case Number[_0xcccbe2(0x1ef)]:_0x174a14[_0xcccbe2(0x24d)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];break;case 0x0:this['_isNegativeZero'](_0x174a14[_0xcccbe2(0x2c0)])&&(_0x174a14['negativeZero']=!0x0);break;}}else _0x174a14[_0xcccbe2(0x23e)]===_0xcccbe2(0x2af)&&typeof _0x578184[_0xcccbe2(0x2d7)]==_0xcccbe2(0x21c)&&_0x578184[_0xcccbe2(0x2d7)]&&_0x174a14[_0xcccbe2(0x2d7)]&&_0x578184[_0xcccbe2(0x2d7)]!==_0x174a14['name']&&(_0x174a14[_0xcccbe2(0x253)]=_0x578184[_0xcccbe2(0x2d7)]);}['_isNegativeZero'](_0x1c8afb){var _0x10332e=_0x4ef3f0;return 0x1/_0x1c8afb===Number[_0x10332e(0x1ef)];}[_0x4ef3f0(0x2a7)](_0x166a0c){var _0x27c448=_0x4ef3f0;!_0x166a0c[_0x27c448(0x276)]||!_0x166a0c['props']['length']||_0x166a0c[_0x27c448(0x23e)]===_0x27c448(0x28f)||_0x166a0c[_0x27c448(0x23e)]==='Map'||_0x166a0c[_0x27c448(0x23e)]==='Set'||_0x166a0c[_0x27c448(0x276)][_0x27c448(0x20e)](function(_0x5c2cb6,_0x165930){var _0xfed0ed=_0x27c448,_0x5712c9=_0x5c2cb6[_0xfed0ed(0x2d7)][_0xfed0ed(0x1ec)](),_0x2df8b7=_0x165930[_0xfed0ed(0x2d7)][_0xfed0ed(0x1ec)]();return _0x5712c9<_0x2df8b7?-0x1:_0x5712c9>_0x2df8b7?0x1:0x0;});}[_0x4ef3f0(0x26f)](_0x123b9c,_0x5a8b0f){var _0xf631bb=_0x4ef3f0;if(!(_0x5a8b0f[_0xf631bb(0x243)]||!_0x123b9c['props']||!_0x123b9c[_0xf631bb(0x276)][_0xf631bb(0x21b)])){for(var _0x14b6f1=[],_0x3382a2=[],_0x513206=0x0,_0x188c9a=_0x123b9c[_0xf631bb(0x276)]['length'];_0x513206<_0x188c9a;_0x513206++){var _0x533e59=_0x123b9c[_0xf631bb(0x276)][_0x513206];_0x533e59['type']==='function'?_0x14b6f1[_0xf631bb(0x218)](_0x533e59):_0x3382a2['push'](_0x533e59);}if(!(!_0x3382a2[_0xf631bb(0x21b)]||_0x14b6f1['length']<=0x1)){_0x123b9c[_0xf631bb(0x276)]=_0x3382a2;var _0x2577ff={'functionsNode':!0x0,'props':_0x14b6f1};this[_0xf631bb(0x2bf)](_0x2577ff,_0x5a8b0f),this[_0xf631bb(0x20b)](_0x2577ff,_0x5a8b0f),this[_0xf631bb(0x201)](_0x2577ff),this['_setNodePermissions'](_0x2577ff,_0x5a8b0f),_0x2577ff['id']+='\\x20f',_0x123b9c['props'][_0xf631bb(0x24a)](_0x2577ff);}}}[_0x4ef3f0(0x2ad)](_0x1d7997,_0x52a427){}[_0x4ef3f0(0x201)](_0x445202){}[_0x4ef3f0(0x23d)](_0x4d1986){var _0x200d2a=_0x4ef3f0;return Array[_0x200d2a(0x1df)](_0x4d1986)||typeof _0x4d1986=='object'&&this[_0x200d2a(0x252)](_0x4d1986)===_0x200d2a(0x25c);}['_setNodePermissions'](_0x149508,_0x29eafe){}[_0x4ef3f0(0x285)](_0x79c8d1){var _0x27c883=_0x4ef3f0;delete _0x79c8d1[_0x27c883(0x1e8)],delete _0x79c8d1[_0x27c883(0x1ff)],delete _0x79c8d1[_0x27c883(0x2bb)];}[_0x4ef3f0(0x29d)](_0x434db9,_0x1a27d6){}}let _0x3acf77=new _0x53cb52(),_0x3f9944={'props':0x64,'elements':0x64,'strLength':0x400*0x32,'totalStrLength':0x400*0x32,'autoExpandLimit':0x1388,'autoExpandMaxDepth':0xa},_0x158b85={'props':0x5,'elements':0x5,'strLength':0x100,'totalStrLength':0x100*0x3,'autoExpandLimit':0x1e,'autoExpandMaxDepth':0x2};function _0x592f4f(_0x223f0c,_0x54589,_0x1136d9,_0x1d6964,_0x5bef40,_0x59669e){var _0x45be8f=_0x4ef3f0;let _0x37574a,_0x2f3c34;try{_0x2f3c34=_0x24af88(),_0x37574a=_0x51107c[_0x54589],!_0x37574a||_0x2f3c34-_0x37574a['ts']>0x1f4&&_0x37574a[_0x45be8f(0x268)]&&_0x37574a['time']/_0x37574a[_0x45be8f(0x268)]<0x64?(_0x51107c[_0x54589]=_0x37574a={'count':0x0,'time':0x0,'ts':_0x2f3c34},_0x51107c[_0x45be8f(0x27a)]={}):_0x2f3c34-_0x51107c['hits']['ts']>0x32&&_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]&&_0x51107c[_0x45be8f(0x27a)]['time']/_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]<0x64&&(_0x51107c['hits']={});let _0x5e7590=[],_0x303aff=_0x37574a[_0x45be8f(0x29b)]||_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x29b)]?_0x158b85:_0x3f9944,_0x5cd473=_0x4d6a9d=>{var _0x427700=_0x45be8f;let _0x422e30={};return _0x422e30[_0x427700(0x276)]=_0x4d6a9d[_0x427700(0x276)],_0x422e30['elements']=_0x4d6a9d[_0x427700(0x203)],_0x422e30[_0x427700(0x2d6)]=_0x4d6a9d['strLength'],_0x422e30['totalStrLength']=_0x4d6a9d[_0x427700(0x225)],_0x422e30[_0x427700(0x2ce)]=_0x4d6a9d[_0x427700(0x2ce)],_0x422e30['autoExpandMaxDepth']=_0x4d6a9d[_0x427700(0x24b)],_0x422e30[_0x427700(0x1f3)]=!0x1,_0x422e30[_0x427700(0x243)]=!_0x334f71,_0x422e30[_0x427700(0x205)]=0x1,_0x422e30[_0x427700(0x25b)]=0x0,_0x422e30[_0x427700(0x254)]='root_exp_id',_0x422e30[_0x427700(0x236)]='root_exp',_0x422e30[_0x427700(0x26a)]=!0x0,_0x422e30[_0x427700(0x2a2)]=[],_0x422e30[_0x427700(0x28d)]=0x0,_0x422e30[_0x427700(0x2c2)]=!0x0,_0x422e30['allStrLength']=0x0,_0x422e30['node']={'current':void 0x0,'parent':void 0x0,'index':0x0},_0x422e30;};for(var _0x2ce81c=0x0;_0x2ce81c<_0x5bef40[_0x45be8f(0x21b)];_0x2ce81c++)_0x5e7590[_0x45be8f(0x218)](_0x3acf77[_0x45be8f(0x299)]({'timeNode':_0x223f0c===_0x45be8f(0x200)||void 0x0},_0x5bef40[_0x2ce81c],_0x5cd473(_0x303aff),{}));if(_0x223f0c==='trace'||_0x223f0c==='error'){let _0x1ab583=Error[_0x45be8f(0x2c6)];try{Error[_0x45be8f(0x2c6)]=0x1/0x0,_0x5e7590[_0x45be8f(0x218)](_0x3acf77['serialize']({'stackNode':!0x0},new Error()[_0x45be8f(0x22f)],_0x5cd473(_0x303aff),{'strLength':0x1/0x0}));}finally{Error[_0x45be8f(0x2c6)]=_0x1ab583;}}return{'method':'log','version':_0x4066ae,'args':[{'ts':_0x1136d9,'session':_0x1d6964,'args':_0x5e7590,'id':_0x54589,'context':_0x59669e}]};}catch(_0xc08614){return{'method':_0x45be8f(0x298),'version':_0x4066ae,'args':[{'ts':_0x1136d9,'session':_0x1d6964,'args':[{'type':'unknown','error':_0xc08614&&_0xc08614[_0x45be8f(0x228)]}],'id':_0x54589,'context':_0x59669e}]};}finally{try{if(_0x37574a&&_0x2f3c34){let _0x47e2fd=_0x24af88();_0x37574a[_0x45be8f(0x268)]++,_0x37574a[_0x45be8f(0x200)]+=_0x4acda3(_0x2f3c34,_0x47e2fd),_0x37574a['ts']=_0x47e2fd,_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]++,_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x200)]+=_0x4acda3(_0x2f3c34,_0x47e2fd),_0x51107c[_0x45be8f(0x27a)]['ts']=_0x47e2fd,(_0x37574a[_0x45be8f(0x268)]>0x32||_0x37574a[_0x45be8f(0x200)]>0x64)&&(_0x37574a[_0x45be8f(0x29b)]=!0x0),(_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]>0x3e8||_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x200)]>0x12c)&&(_0x51107c['hits'][_0x45be8f(0x29b)]=!0x0);}}catch{}}}return _0x592f4f;}((_0x1d4663,_0x5790be,_0x591588,_0x59fd35,_0x1f79cd,_0x3c6a0d,_0x2a6eb4,_0x482905,_0x5dd233,_0x300997,_0x40824a)=>{var _0x2bff8a=_0xf42111;if(_0x1d4663[_0x2bff8a(0x2db)])return _0x1d4663[_0x2bff8a(0x2db)];if(!X(_0x1d4663,_0x482905,_0x1f79cd))return _0x1d4663[_0x2bff8a(0x2db)]={'consoleLog':()=>{},'consoleTrace':()=>{},'consoleTime':()=>{},'consoleTimeEnd':()=>{},'autoLog':()=>{},'autoLogMany':()=>{},'autoTraceMany':()=>{},'coverage':()=>{},'autoTrace':()=>{},'autoTime':()=>{},'autoTimeEnd':()=>{}},_0x1d4663['_console_ninja'];let _0x2ab37c=B(_0x1d4663),_0x5089e9=_0x2ab37c[_0x2bff8a(0x2b9)],_0x24eda4=_0x2ab37c[_0x2bff8a(0x1f8)],_0x177676=_0x2ab37c['now'],_0x34ecbc={'hits':{},'ts':{}},_0x2f6e8a=J(_0x1d4663,_0x5dd233,_0x34ecbc,_0x3c6a0d),_0x5c844f=_0x41f245=>{_0x34ecbc['ts'][_0x41f245]=_0x24eda4();},_0x549ae4=(_0x53c32b,_0x32d193)=>{var _0xb017ca=_0x2bff8a;let _0x4ed5f6=_0x34ecbc['ts'][_0x32d193];if(delete _0x34ecbc['ts'][_0x32d193],_0x4ed5f6){let _0x4fc230=_0x5089e9(_0x4ed5f6,_0x24eda4());_0x1d2fe7(_0x2f6e8a(_0xb017ca(0x200),_0x53c32b,_0x177676(),_0x4f8767,[_0x4fc230],_0x32d193));}},_0x7ca32b=_0x5298a2=>{var _0x85a531=_0x2bff8a,_0x12eff1;return _0x1f79cd===_0x85a531(0x29e)&&_0x1d4663[_0x85a531(0x20a)]&&((_0x12eff1=_0x5298a2==null?void 0x0:_0x5298a2['args'])==null?void 0x0:_0x12eff1[_0x85a531(0x21b)])&&(_0x5298a2[_0x85a531(0x223)][0x0][_0x85a531(0x20a)]=_0x1d4663[_0x85a531(0x20a)]),_0x5298a2;};_0x1d4663[_0x2bff8a(0x2db)]={'consoleLog':(_0x39118b,_0x3cc253)=>{var _0x463333=_0x2bff8a;_0x1d4663[_0x463333(0x2ab)][_0x463333(0x298)]['name']!=='disabledLog'&&_0x1d2fe7(_0x2f6e8a(_0x463333(0x298),_0x39118b,_0x177676(),_0x4f8767,_0x3cc253));},'consoleTrace':(_0xbd86d1,_0x59bc4f)=>{var _0x2b716f=_0x2bff8a,_0xdf1d72,_0x57fed4;_0x1d4663[_0x2b716f(0x2ab)][_0x2b716f(0x298)]['name']!==_0x2b716f(0x245)&&((_0x57fed4=(_0xdf1d72=_0x1d4663[_0x2b716f(0x261)])==null?void 0x0:_0xdf1d72[_0x2b716f(0x288)])!=null&&_0x57fed4[_0x2b716f(0x25e)]&&(_0x1d4663['_ninjaIgnoreNextError']=!0x0),_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x2b716f(0x250),_0xbd86d1,_0x177676(),_0x4f8767,_0x59bc4f))));},'consoleError':(_0x146478,_0x4b8f11)=>{var _0x3255ce=_0x2bff8a;_0x1d4663[_0x3255ce(0x257)]=!0x0,_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x3255ce(0x287),_0x146478,_0x177676(),_0x4f8767,_0x4b8f11)));},'consoleTime':_0x205fad=>{_0x5c844f(_0x205fad);},'consoleTimeEnd':(_0x3a184f,_0x3a07f4)=>{_0x549ae4(_0x3a07f4,_0x3a184f);},'autoLog':(_0x32a379,_0xd1b917)=>{var _0x7eb520=_0x2bff8a;_0x1d2fe7(_0x2f6e8a(_0x7eb520(0x298),_0xd1b917,_0x177676(),_0x4f8767,[_0x32a379]));},'autoLogMany':(_0x58ad40,_0x5eab6f)=>{var _0x2b94ae=_0x2bff8a;_0x1d2fe7(_0x2f6e8a(_0x2b94ae(0x298),_0x58ad40,_0x177676(),_0x4f8767,_0x5eab6f));},'autoTrace':(_0x5b1a6b,_0x276055)=>{var _0xbfa21a=_0x2bff8a;_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0xbfa21a(0x250),_0x276055,_0x177676(),_0x4f8767,[_0x5b1a6b])));},'autoTraceMany':(_0x584f66,_0x1572d9)=>{var _0x5e3c7c=_0x2bff8a;_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x5e3c7c(0x250),_0x584f66,_0x177676(),_0x4f8767,_0x1572d9)));},'autoTime':(_0x957eeb,_0x4863a8,_0x5a8f3b)=>{_0x5c844f(_0x5a8f3b);},'autoTimeEnd':(_0x49ce61,_0x2d878a,_0x368c47)=>{_0x549ae4(_0x2d878a,_0x368c47);},'coverage':_0x508391=>{_0x1d2fe7({'method':'coverage','version':_0x3c6a0d,'args':[{'id':_0x508391}]});}};let _0x1d2fe7=H(_0x1d4663,_0x5790be,_0x591588,_0x59fd35,_0x1f79cd,_0x300997,_0x40824a),_0x4f8767=_0x1d4663[_0x2bff8a(0x2c5)];return _0x1d4663[_0x2bff8a(0x2db)];})(globalThis,'127.0.0.1',_0xf42111(0x2cd),_0xf42111(0x21f),_0xf42111(0x23b),'1.0.0',_0xf42111(0x25a),[\"localhost\",\"127.0.0.1\",\"example.cypress.io\",\"MacBook-Pro-3.local\",\"192.168.50.116\"],_0xf42111(0x22b),_0xf42111(0x275),_0xf42111(0x1ee));");}catch(e){}};/* istanbul ignore next */function oo_oo(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleLog(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_tr(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleTrace(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_tx(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleError(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_ts(/**@type{any}**/v){try{oo_cm().consoleTime(v);}catch(e){} return v;};/* istanbul ignore next */function oo_te(/**@type{any}**/v, /**@type{any}**/i){try{oo_cm().consoleTimeEnd(v, i);}catch(e){} return v;};/*eslint unicorn/no-abusive-eslint-disable:,eslint-comments/disable-enable-pair:,eslint-comments/no-unlimited-disable:,eslint-comments/no-aggregating-enable:,eslint-comments/no-duplicate-disable:,eslint-comments/no-unused-disable:,eslint-comments/no-unused-enable:,*/