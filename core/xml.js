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

goog.require('Blockly.utils');
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

Blockly.Xml.DEFERRED_RENDER_BUDGET_MS = 24;
Blockly.Xml.DEFERRED_RENDER_BACKGROUND_BUDGET_MS = 10;
Blockly.Xml.DEFERRED_SCRIPT_WIDTH_ESTIMATE = 300;
Blockly.Xml.DEFERRED_BLOCK_HEIGHT_ESTIMATE = 30;

Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred = function(xml, workspace, opt_callbacks) {
  workspace.setResizesEnabled(false);
  workspace.setToolboxRefreshEnabled(false);
  Blockly.Events.disable();
  try {
    workspace.clear();
  } finally {
    Blockly.Events.enable();
  }
  var handle = Blockly.Xml.domToWorkspaceDeferred(xml, workspace, opt_callbacks);
  workspace.setToolboxRefreshEnabled(true);
  return handle;
};

Blockly.Xml.domToWorkspaceDeferred = function(xml, workspace, opt_callbacks) {
  var callbacks = opt_callbacks || {};
  if (!workspace.rendered) {
    var blockIds = Blockly.Xml.domToWorkspace(xml, workspace);
    if (callbacks.onDone) {
      callbacks.onDone();
    }
    return {blockIds: blockIds, cancel: function() {}};
  }
  var width;
  if (workspace.RTL) {
    width = workspace.getWidth();
  }
  var scripts = [];
  Blockly.Field.startCache();
  var childCount = xml.childNodes.length;
  var existingGroup = Blockly.Events.getGroup();
  if (!existingGroup) {
    Blockly.Events.setGroup(true);
  }
  if (workspace.setResizesEnabled) {
    workspace.setResizesEnabled(false);
  }
  var variablesFirst = true;
  var caughtError = null;
  try {
    for (var i = 0; i < childCount; i++) {
      var xmlChild = xml.childNodes[i];
      var name = xmlChild.nodeName.toLowerCase();
      if (name == 'block' ||
          (name == 'shadow' && !Blockly.Events.recordUndo)) {
        var blockX = xmlChild.hasAttribute('x') ?
            parseInt(xmlChild.getAttribute('x'), 10) : 10;
        var blockY = xmlChild.hasAttribute('y') ?
            parseInt(xmlChild.getAttribute('y'), 10) : 10;
        var hasPosition = !isNaN(blockX) && !isNaN(blockY);
        scripts.push({
          xmlNode: xmlChild,
          hasPosition: hasPosition,
          x: hasPosition ? (workspace.RTL ? width - blockX : blockX) : 0,
          y: hasPosition ? blockY : 0,
          estimate: xmlChild.getElementsByTagName('block').length +
              xmlChild.getElementsByTagName('shadow').length + 1,
          rows: xmlChild.getElementsByTagName('next').length +
              xmlChild.getElementsByTagName('statement').length + 1,
          phase: -1,
          topBlock: null,
          blocks: null,
          blockIndex: -1,
          placeholder: null,
          done: false
        });
        variablesFirst = false;
      } else if (name == 'shadow') {
        goog.asserts.fail('Shadow block cannot be a top-level block.');
        variablesFirst = false;
      } else if (name == 'comment') {
        Blockly.WorkspaceCommentSvg.fromXml(xmlChild, workspace, width);
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
  } catch (e) {
    caughtError = e;
  } finally {
    if (!existingGroup) {
      Blockly.Events.setGroup(false);
    }
  }
  var handle = Blockly.Xml.startDeferredRender_(workspace, scripts, callbacks);
  if (caughtError) {
    throw caughtError;
  }
  return handle;
};

Blockly.Xml.startDeferredRender_ = function(workspace, scripts, callbacks) {
  workspace.deferredRenderActive = true;
  var totalBlocks = 0;
  var canvas = workspace.getCanvas();
  var phWidth = Blockly.Xml.DEFERRED_SCRIPT_WIDTH_ESTIMATE;
  var scriptHeight = function(script) {
    return script.rows * Blockly.Xml.DEFERRED_BLOCK_HEIGHT_ESTIMATE;
  };
  var updateBounds = function() {
    var bounds = null;
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.done || !script.hasPosition) {
        continue;
      }
      var left = workspace.RTL ? script.x - phWidth : script.x;
      var bottom = script.y + scriptHeight(script);
      if (!bounds) {
        bounds = {left: left, top: script.y,
          right: left + phWidth, bottom: bottom};
      } else {
        bounds.left = Math.min(bounds.left, left);
        bounds.top = Math.min(bounds.top, script.y);
        bounds.right = Math.max(bounds.right, left + phWidth);
        bounds.bottom = Math.max(bounds.bottom, bottom);
      }
    }
    workspace.deferredContentBounds_ = bounds;
  };
  for (var i = 0; i < scripts.length; i++) {
    var script = scripts[i];
    totalBlocks += script.estimate;
    if (script.hasPosition && canvas) {
      script.placeholder = Blockly.utils.createSvgElement('rect', {
        'class': 'blocklyScriptPlaceholder',
        'x': workspace.RTL ? script.x - phWidth : script.x,
        'y': script.y,
        'width': phWidth,
        'height': scriptHeight(script),
        'rx': 8,
        'ry': 8
      }, canvas);
    }
  }
  updateBounds();
  workspace.getDeferredScripts = function() {
    var out = [];
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (!s.done && s.phase === -1) {
        out.push({
          id: s.xmlNode.getAttribute('id'),
          type: s.xmlNode.getAttribute('type'),
          x: s.x,
          y: s.y,
          xmlNode: s.xmlNode
        });
      }
    }
    return out;
  };
  workspace.findDeferredScriptByBlockId = function(id) {
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.done || s.phase !== -1) {
        continue;
      }
      if (s.xmlNode.getAttribute('id') === id) {
        return {x: s.x, y: s.y};
      }
      var els = s.xmlNode.getElementsByTagName('block');
      for (var j = 0; j < els.length; j++) {
        if (els[j].getAttribute('id') === id) {
          return {x: s.x, y: s.y};
        }
      }
    }
    return null;
  };
  var totalSteps = (totalBlocks * 2) + (scripts.length * 2);
  var pendingCount = scripts.length;
  var doneSteps = 0;
  var doneBlocks = 0;
  var finished = false;
  var cancelled = false;

  var removePlaceholder = function(script) {
    if (script.placeholder) {
      goog.dom.removeNode(script.placeholder);
      script.placeholder = null;
    }
  };
  var materializeScript = function(script) {
    Blockly.Events.disable();
    try {
      var topBlock = Blockly.Xml.domToBlockHeadless_(script.xmlNode, workspace);
      script.topBlock = topBlock;
      script.blocks = topBlock.getDescendants(false);
      topBlock.setConnectionsHidden(true);
      var svgRoot = topBlock.getSvgRoot();
      if (svgRoot) {
        svgRoot.style.visibility = 'hidden';
      }
      if (script.hasPosition) {
        topBlock.moveBy(script.x, script.y);
        if (topBlock.comment && typeof topBlock.comment === 'object') {
          var commentXY = topBlock.comment.getXY();
          var commentWidth = topBlock.comment.getBubbleSize().width;
          topBlock.comment.moveTo(workspace.RTL ?
            workspace.getWidth() - commentXY.x - commentWidth : commentXY.x,
          commentXY.y);
        }
      }
      totalSteps += (script.blocks.length - script.estimate) * 2;
      totalBlocks += script.blocks.length - script.estimate;
    } finally {
      Blockly.Events.enable();
    }
  };

  var now = function() {
    return (typeof performance != 'undefined' && performance.now) ?
        performance.now() : Date.now();
  };
  var schedule = function(fn) {
    if (typeof requestAnimationFrame == 'undefined') {
      setTimeout(fn, 16);
      return;
    }
    var fired = false;
    var run = function() {
      if (fired) {
        return;
      }
      fired = true;
      fn();
    };
    requestAnimationFrame(run);
    setTimeout(run, 250);
  };
  var reportProgress = function() {
    if (callbacks.onProgress) {
      callbacks.onProgress(Math.min(doneSteps, totalSteps), totalSteps,
          Math.min(doneBlocks, totalBlocks), totalBlocks);
    }
  };
  var getViewport = function() {
    if (!workspace.rendered) {
      return null;
    }
    var metrics = null;
    try {
      metrics = workspace.getMetrics();
    } catch (e) {
      return null;
    }
    if (!metrics || !metrics.viewWidth) {
      return null;
    }
    var scale = workspace.scale || 1;
    var left = metrics.viewLeft / scale;
    var top = metrics.viewTop / scale;
    return {
      left: left,
      top: top,
      right: left + (metrics.viewWidth / scale),
      bottom: top + (metrics.viewHeight / scale)
    };
  };
  var scriptDistance = function(script, viewport) {
    var left = workspace.RTL ? script.x - phWidth : script.x;
    var right = left + phWidth;
    var bottom = script.y + scriptHeight(script);
    var dx = viewport.left > right ? viewport.left - right :
        (left > viewport.right ? left - viewport.right : 0);
    var dy = viewport.top > bottom ? viewport.top - bottom :
        (script.y > viewport.bottom ? script.y - viewport.bottom : 0);
    return dx + dy;
  };
  var skipScript = function(script) {
    if (script.phase === -1) {
      doneSteps += 2 + (script.estimate * 2);
      doneBlocks += script.estimate;
    } else if (script.phase === 0) {
      doneSteps += (script.blockIndex + 1) + script.blocks.length + 1;
      doneBlocks += script.blocks.length;
    } else if (script.phase === 1) {
      doneSteps += (script.blockIndex + 1) + 1;
      doneBlocks += script.blockIndex + 1;
    } else {
      doneSteps += 1;
    }
    removePlaceholder(script);
    script.done = true;
    pendingCount--;
    updateBounds();
  };
  var pickScript = function(viewport) {
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.done) {
        continue;
      }
      if (script.phase !== -1 && !script.topBlock.workspace) {
        skipScript(script);
        continue;
      }
      if (!viewport) {
        return {script: script, dist: 0};
      }
      var d = scriptDistance(script, viewport);
      if (d < bestDist) {
        bestDist = d;
        best = script;
        if (d === 0) {
          break;
        }
      }
    }
    return best ? {script: best, dist: bestDist} : null;
  };
  var stepScript = function(script) {
    if (script.phase === -1) {
      try {
        materializeScript(script);
      } catch (e) {
        console.warn('Deferred block materialization failed.', e);
        skipScript(script);
        return;
      }
      doneSteps++;
      script.phase = 0;
      script.blockIndex = script.blocks.length - 1;
      return;
    }
    var topBlock = script.topBlock;
    try {
      if (script.phase === 2) {
        topBlock.setConnectionsHidden(false);
        topBlock.updateDisabled();
        var svgRoot = topBlock.getSvgRoot();
        if (svgRoot) {
          svgRoot.style.visibility = '';
        }
      } else {
        var block = script.blocks[script.blockIndex];
        if (block && block.workspace) {
          if (script.phase === 0) {
            block.initSvg();
          } else {
            block.render(false);
          }
        }
      }
    } catch (e) {
      console.warn('Deferred block rendering failed.', e);
    }
    doneSteps++;
    if (script.phase === 2) {
      removePlaceholder(script);
      script.done = true;
      pendingCount--;
      updateBounds();
      if (workspace.rendered) {
        workspace.resizeContents();
      }
    } else {
      if (script.phase === 1) {
        doneBlocks++;
      }
      script.blockIndex--;
      if (script.blockIndex < 0) {
        script.phase++;
        script.blockIndex = script.blocks.length - 1;
      }
    }
  };
  var finish = function() {
    if (finished) {
      return;
    }
    finished = true;
    workspace.deferredRenderActive = false;
    workspace.deferredContentBounds_ = null;
    workspace.getDeferredScripts = null;
    workspace.findDeferredScriptByBlockId = null;
    for (var i = 0; i < scripts.length; i++) {
      removePlaceholder(scripts[i]);
    }
    Blockly.Field.stopCache();
    if (workspace.rendered && workspace.setResizesEnabled) {
      workspace.setResizesEnabled(true);
    }
    if (callbacks.onDone) {
      callbacks.onDone();
    }
  };
  var processFrame = function() {
    if (finished || cancelled) {
      return;
    }
    if (workspace.isDragging && workspace.isDragging()) {
      schedule(processFrame);
      return;
    }
    var viewport = getViewport();
    var pick = pickScript(viewport);
    var urgent = !viewport;
    if (pick && viewport) {
      var margin = ((viewport.right - viewport.left) +
          (viewport.bottom - viewport.top)) / 4;
      urgent = pick.dist <= margin;
    }
    var budget = urgent ? Blockly.Xml.DEFERRED_RENDER_BUDGET_MS :
        Blockly.Xml.DEFERRED_RENDER_BACKGROUND_BUDGET_MS;
    var deadline = now() + budget;
    while (pick && now() < deadline) {
      stepScript(pick.script);
      if (pick.script.done) {
        pick = pickScript(viewport);
      }
    }
    reportProgress();
    if (pendingCount <= 0) {
      finish();
    } else {
      schedule(processFrame);
    }
  };

  if (scripts.length) {
    if (workspace.setResizesEnabled) {
      workspace.setResizesEnabled(true);
    }
    reportProgress();
    schedule(processFrame);
  } else {
    finish();
  }

  return {
    cancel: function() {
      if (finished || cancelled) {
        return;
      }
      cancelled = true;
      finished = true;
      workspace.deferredRenderActive = false;
      workspace.deferredContentBounds_ = null;
      workspace.getDeferredScripts = null;
      workspace.findDeferredScriptByBlockId = null;
      for (var i = 0; i < scripts.length; i++) {
        removePlaceholder(scripts[i]);
      }
      Blockly.Field.stopCache();
    }
  };
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
goog.global['Blockly']['Xml']['domToWorkspaceDeferred'] =
  Blockly.Xml.domToWorkspaceDeferred;
goog.global['Blockly']['Xml']['clearWorkspaceAndLoadFromXmlDeferred'] =
  Blockly.Xml.clearWorkspaceAndLoadFromXmlDeferred;
