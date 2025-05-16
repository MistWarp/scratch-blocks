/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2011 Google Inc.
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
 * @fileoverview The class representing one block.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Block');

goog.require('Blockly.Blocks');
goog.require('Blockly.Colours');
goog.require('Blockly.Comment');
goog.require('Blockly.ScratchBlockComment');
goog.require('Blockly.Connection');
goog.require('Blockly.Events.BlockChange');
goog.require('Blockly.Events.BlockCreate');
goog.require('Blockly.Events.BlockDelete');
goog.require('Blockly.Events.BlockMove');
goog.require('Blockly.Extensions');
goog.require('Blockly.FieldLabelSerializable');
goog.require('Blockly.FieldVariableGetter');
goog.require('Blockly.Input');
goog.require('Blockly.Mutator');
goog.require('Blockly.Warning');
goog.require('Blockly.Workspace');
goog.require('Blockly.Xml');
goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.math.Coordinate');
goog.require('goog.string');


/**
 * Class for one block.
 * Not normally called directly, workspace.newBlock() is preferred.
 * @param {!Blockly.Workspace} workspace The block's workspace.
 * @param {?string} prototypeName Name of the language object containing
 *     type-specific functions for this block.
 * @param {string=} opt_id Optional ID.  Use this ID if provided, otherwise
 *     create a new ID.  If the ID conflicts with an in-use ID, a new one will
 *     be generated.
 * @constructor
 */
Blockly.Block = function(workspace, prototypeName, opt_id) {
  var flyoutWorkspace = workspace && workspace.getFlyout && workspace.getFlyout() ?
     workspace.getFlyout().getWorkspace() : null;
  /** @type {string} */
  this.id = (opt_id && !workspace.getBlockById(opt_id) &&
      (!flyoutWorkspace || !flyoutWorkspace.getBlockById(opt_id))) ?
      opt_id : Blockly.utils.genUid();
  workspace.blockDB_[this.id] = this;
  /** @type {Blockly.Connection} */
  this.outputConnection = null;
  /** @type {Blockly.Connection} */
  this.nextConnection = null;
  /** @type {Blockly.Connection} */
  this.previousConnection = null;
  /** @type {!Array.<!Blockly.Input>} */
  this.inputList = [];
  /** @type {boolean|undefined} */
  this.inputsInline = true;
  /** @type {boolean} */
  this.disabled = false;
  /** @type {string|!Function} */
  this.tooltip = '';
  /** @type {boolean} */
  this.contextMenu = true;

  /**
   * @type {Blockly.Block}
   * @protected
   */
  this.parentBlock_ = null;

  /**
   * @type {!Array.<!Blockly.Block>}
   * @protected
   */
  this.childBlocks_ = [];

  /**
   * @type {boolean}
   * @private
   */
  this.deletable_ = true;

  /**
   * @type {boolean}
   * @private
   */
  this.movable_ = true;

  /**
   * @type {boolean}
   * @private
   */
  this.editable_ = true;

  /**
   * @type {boolean}
   * @private
   */
  this.isShadow_ = false;

  /**
   * @type {boolean}
   * @protected
   */
  this.collapsed_ = false;

  /**
   * @type {boolean}
   * @private
   */
  this.checkboxInFlyout_ = false;

  /** @type {string|Blockly.Comment} */
  this.comment = null;

  /**
   * @type {?number}
   * @private
   */
  this.outputShape_ = null;

  /**
   * @type {?string}
   * @private
   */
  this.category_ = null;

  /**
   * The block's position in workspace units.  (0, 0) is at the workspace's
   * origin; scale does not change this value.
   * @type {!goog.math.Coordinate}
   * @private
   */
  this.xy_ = new goog.math.Coordinate(0, 0);

  /** @type {!Blockly.Workspace} */
  this.workspace = workspace;
  /** @type {boolean} */
  this.isInFlyout = workspace.isFlyout;
  /** @type {boolean} */
  this.isInMutator = workspace.isMutator;

  /** @type {boolean} */
  this.RTL = workspace.RTL;

  /** @type {boolean} */
  this.isInsertionMarker_ = false;

  // Copy the type-specific functions and data from the prototype.
  if (prototypeName) {
    /** @type {string} */
    this.type = prototypeName;
    var prototype = Blockly.Blocks[prototypeName];
    goog.asserts.assertObject(prototype,
        'Error: Unknown block type "%s".', prototypeName);
    goog.mixin(this, prototype);
  }

  workspace.addTopBlock(this);

  // Call an initialization function, if it exists.
  if (goog.isFunction(this.init)) {
    this.init();
  }
  // Record initial inline state.
  /** @type {boolean|undefined} */
  this.inputsInlineDefault = this.inputsInline;

  // Fire a create event.
  if (Blockly.Events.isEnabled()) {
    var existingGroup = Blockly.Events.getGroup();
    if (!existingGroup) {
      Blockly.Events.setGroup(true);
    }
    try {
      Blockly.Events.fire(new Blockly.Events.BlockCreate(this));
    } finally {
      if (!existingGroup) {
        Blockly.Events.setGroup(false);
      }
    }

  }
  // Bind an onchange function, if it exists.
  if (goog.isFunction(this.onchange)) {
    this.setOnChange(this.onchange);
  }
};

/**
 * Optional text data that round-trips beween blocks and XML.
 * Has no effect. May be used by 3rd parties for meta information.
 * @type {?string}
 */
Blockly.Block.prototype.data = null;

/**
 * Colour of the block in '#RRGGBB' format.
 * @type {string}
 * @private
 */
Blockly.Block.prototype.colour_ = '#FF0000';

/**
 * Secondary colour of the block in '#RRGGBB' format.
 * @type {string}
 * @private
 */
Blockly.Block.prototype.colourSecondary_ = '#FF0000';

/**
 * Tertiary colour of the block in '#RRGGBB' format.
 * @type {string}
 * @private
 */
Blockly.Block.prototype.colourTertiary_ = '#FF0000';

/**
 * Quaternary colour of the block in '#RRGGBB' format.
 * @type {string}
 * @private
 */
Blockly.Block.prototype.colourQuaternary = '#FF0000';

/**
 * Fill colour used to override default shadow colour behaviour.
 * @type {string}
 * @private
 */
Blockly.Block.prototype.shadowColour_ = null;

/**
 * Dispose of this block.
 * @param {boolean} healStack If true, then try to heal any gap by connecting
 *     the next statement with the previous statement.  Otherwise, dispose of
 *     all children of this block.
 */
Blockly.Block.prototype.dispose = function(healStack) {
  if (!this.workspace) {
    // Already deleted.
    return;
  }
  // Terminate onchange event calls.
  if (this.onchangeWrapper_) {
    this.workspace.removeChangeListener(this.onchangeWrapper_);
  }
  this.unplug(healStack);
  if (Blockly.Events.isEnabled()) {
    Blockly.Events.fire(new Blockly.Events.BlockDelete(this));
  }
  Blockly.Events.disable();

  try {
    // This block is now at the top of the workspace.
    // Remove this block from the workspace's list of top-most blocks.
    if (this.workspace) {
      this.workspace.removeTopBlock(this);
      // Remove from block database.
      delete this.workspace.blockDB_[this.id];
      this.workspace = null;
    }

    // Just deleting this block from the DOM would result in a memory leak as
    // well as corruption of the connection database.  Therefore we must
    // methodically step through the blocks and carefully disassemble them.

    if (Blockly.selected == this) {
      Blockly.selected = null;
    }

    // First, dispose of all my children.
    for (var i = this.childBlocks_.length - 1; i >= 0; i--) {
      this.childBlocks_[i].dispose(false);
    }
    // Then dispose of myself.
    // Dispose of all inputs and their fields.
    for (var i = 0, input; input = this.inputList[i]; i++) {
      input.dispose();
    }
    this.inputList.length = 0;
    // Dispose of any remaining connections (next/previous/output).
    var connections = this.getConnections_(true);
    for (var i = 0; i < connections.length; i++) {
      var connection = connections[i];
      if (connection.isConnected()) {
        connection.disconnect();
      }
      connections[i].dispose();
    }
  } finally {
    Blockly.Events.enable();
  }
};

/**
 * Call initModel on all fields on the block.
 * May be called more than once.
 * Either initModel or initSvg must be called after creating a block and before
 * the first interaction with it.  Interactions include UI actions
 * (e.g. clicking and dragging) and firing events (e.g. create, delete, and
 * change).
 * @public
 */
Blockly.Block.prototype.initModel = function() {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    for (var j = 0, field; field = input.fieldRow[j]; j++) {
      if (field.initModel) {
        field.initModel();
      }
    }
  }
};

/**
 * Unplug this block from its superior block.  If this block is a statement,
 * optionally reconnect the block underneath with the block on top.
 * @param {boolean=} opt_healStack Disconnect child statement and reconnect
 *   stack.  Defaults to false.
 */
Blockly.Block.prototype.unplug = function(opt_healStack) {
  if (this.outputConnection) {
    if (this.outputConnection.isConnected()) {
      // Disconnect from any superior block.
      this.outputConnection.disconnect();
    }
  } else {
    if (this.previousConnection) {
      var previousTarget = null;
      if (this.previousConnection.isConnected()) {
        // Remember the connection that any next statements need to connect to.
        previousTarget = this.previousConnection.targetConnection;
        // Detach this block from the parent's tree.
        this.previousConnection.disconnect();
      }
    }
    var nextBlock = this.getNextBlock();
    if (opt_healStack && nextBlock) {
      // Disconnect the next statement.
      var nextTarget = this.nextConnection.targetConnection;
      nextTarget.disconnect();
      if (previousTarget && previousTarget.checkType_(nextTarget)) {
        // Attach the next statement to the previous statement.
        previousTarget.connect(nextTarget);
      }
    }
  }
};

/**
 * Returns all connections originating from this block.
 * @return {!Array.<!Blockly.Connection>} Array of connections.
 * @private
 */
Blockly.Block.prototype.getConnections_ = function() {
  var myConnections = [];
  if (this.outputConnection) {
    myConnections.push(this.outputConnection);
  }
  if (this.previousConnection) {
    myConnections.push(this.previousConnection);
  }
  if (this.nextConnection) {
    myConnections.push(this.nextConnection);
  }
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (input.connection) {
      myConnections.push(input.connection);
    }
  }
  return myConnections;
};

/**
 * Walks down a stack of blocks and finds the last next connection on the stack.
 * @return {Blockly.Connection} The last next connection on the stack, or null.
 * @package
 */
Blockly.Block.prototype.lastConnectionInStack = function() {
  var nextConnection = this.nextConnection;
  while (nextConnection) {
    var nextBlock = nextConnection.targetBlock();
    if (!nextBlock) {
      // Found a next connection with nothing on the other side.
      return nextConnection;
    }
    nextConnection = nextBlock.nextConnection;
  }
  // Ran out of next connections.
  return null;
};

/**
 * Bump unconnected blocks out of alignment.  Two blocks which aren't actually
 * connected should not coincidentally line up on screen.
 * @protected
 */
Blockly.Block.prototype.bumpNeighbours_ = function() {
  console.warn('Not expected to reach this bumpNeighbours_ function. The ' +
    'BlockSvg function for bumpNeighbours_ was expected to be called instead.');
};

/**
 * Return the parent block or null if this block is at the top level.
 * @return {Blockly.Block} The block that holds the current block.
 */
Blockly.Block.prototype.getParent = function() {
  // Look at the DOM to see if we are nested in another block.
  return this.parentBlock_;
};

/**
 * Return the input that connects to the specified block.
 * @param {!Blockly.Block} block A block connected to an input on this block.
 * @return {Blockly.Input} The input that connects to the specified block.
 */
Blockly.Block.prototype.getInputWithBlock = function(block) {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (input.connection && input.connection.targetBlock() == block) {
      return input;
    }
  }
  return null;
};

/**
 * Return the input that contains the specified connection
 * @param {!Blockly.Connection} conn A connection on this block.
 * @return {Blockly.Input} The input that contains the specified connection.
 */
Blockly.Block.prototype.getInputWithConnection = function(conn) {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (input.connection == conn) {
      return input;
    }
  }
  return null;
};

/**
 * Return the parent block that surrounds the current block, or null if this
 * block has no surrounding block.  A parent block might just be the previous
 * statement, whereas the surrounding block is an if statement, while loop, etc.
 * @return {Blockly.Block} The block that surrounds the current block.
 */
Blockly.Block.prototype.getSurroundParent = function() {
  var block = this;
  do {
    var prevBlock = block;
    block = block.getParent();
    if (!block) {
      // Ran off the top.
      return null;
    }
  } while (block.getNextBlock() == prevBlock);
  // This block is an enclosing parent, not just a statement in a stack.
  return block;
};

/**
 * Return the next statement block directly connected to this block.
 * @return {Blockly.Block} The next statement block or null.
 */
Blockly.Block.prototype.getNextBlock = function() {
  return this.nextConnection && this.nextConnection.targetBlock();
};

/**
 * Return the previous statement block directly connected to this block.
 * @return {Blockly.Block} The previous statement block or null.
 */
Blockly.Block.prototype.getPreviousBlock = function() {
  return this.previousConnection && this.previousConnection.targetBlock();
};

/**
 * Return the connection on the first statement input on this block, or null if
 * there are none.
 * @return {Blockly.Connection} The first statement connection or null.
 */
Blockly.Block.prototype.getFirstStatementConnection = function() {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (input.connection && input.connection.type == Blockly.NEXT_STATEMENT) {
      return input.connection;
    }
  }
  return null;
};

/**
 * Return the top-most block in this block's tree.
 * This will return itself if this block is at the top level.
 * @return {!Blockly.Block} The root block.
 */
Blockly.Block.prototype.getRootBlock = function() {
  var rootBlock;
  var block = this;
  do {
    rootBlock = block;
    block = rootBlock.parentBlock_;
  } while (block);
  return rootBlock;
};

/**
 * Find all the blocks that are directly nested inside this one.
 * Includes value and statement inputs, as well as any following statement.
 * Excludes any connection on an output tab or any preceding statement.
 * Blocks are optionally sorted by position; top to bottom.
 * @param {boolean} ordered Sort the list if true.
 * @return {!Array.<!Blockly.Block>} Array of blocks.
 */
Blockly.Block.prototype.getChildren = function(ordered) {
  if (!ordered) {
    return this.childBlocks_;
  }
  var blocks = [];
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (input.connection) {
      var child = input.connection.targetBlock();
      if (child) {
        blocks.push(child);
      }
    }
  }
  var next = this.getNextBlock();
  if (next) {
    blocks.push(next);
  }
  return blocks;
};

/**
 * Set parent of this block to be a new block or null.
 * @param {Blockly.Block} newParent New parent block.
 */
Blockly.Block.prototype.setParent = function(newParent) {
  if (newParent == this.parentBlock_) {
    return;
  }
  if (this.parentBlock_) {
    // Remove this block from the old parent's child list.
    goog.array.remove(this.parentBlock_.childBlocks_, this);

    // Disconnect from superior blocks.
    if (this.previousConnection && this.previousConnection.isConnected()) {
      throw 'Still connected to previous block.';
    }
    if (this.outputConnection && this.outputConnection.isConnected()) {
      throw 'Still connected to parent block.';
    }
    this.parentBlock_ = null;
    // This block hasn't actually moved on-screen, so there's no need to update
    // its connection locations.
  } else {
    // Remove this block from the workspace's list of top-most blocks.
    this.workspace.removeTopBlock(this);
  }

  this.parentBlock_ = newParent;
  if (newParent) {
    // Add this block to the new parent's child list.
    newParent.childBlocks_.push(this);
  } else {
    this.workspace.addTopBlock(this);
  }
};

/**
 * Find all the blocks that are directly or indirectly nested inside this one.
 * Includes this block in the list.
 * Includes value and statement inputs, as well as any following statements.
 * Excludes any connection on an output tab or any preceding statements.
 * Blocks are optionally sorted by position, top to bottom.
 * @param {boolean} ordered Sort the list if true.
 * @param {boolean=} opt_ignoreShadows If set, don't include shadow blocks.
 * @return {!Array.<!Blockly.Block>} Flattened array of blocks.
 */
Blockly.Block.prototype.getDescendants = function(ordered, opt_ignoreShadows) {
  var blocks = [this];
  var childBlocks = this.getChildren(ordered);
  for (var child, i = 0; child = childBlocks[i]; i++) {
    if (!opt_ignoreShadows || !child.isShadow_) {
      blocks.push.apply(
          blocks, child.getDescendants(ordered, opt_ignoreShadows));
    }
  }
  return blocks;
};

/**
 * Get whether this block is deletable or not.
 * @return {boolean} True if deletable.
 */
Blockly.Block.prototype.isDeletable = function() {
  return this.deletable_ && !this.isShadow_ &&
      !(this.workspace && this.workspace.options.readOnly);
};

/**
 * Set whether this block is deletable or not.
 * @param {boolean} deletable True if deletable.
 */
Blockly.Block.prototype.setDeletable = function(deletable) {
  this.deletable_ = deletable;
};

/**
 * Get whether this block is movable or not.
 * @return {boolean} True if movable.
 */
Blockly.Block.prototype.isMovable = function() {
  return this.movable_ && !this.isShadow_ &&
      !(this.workspace && this.workspace.options.readOnly);
};

/**
 * Set whether this block is movable or not.
 * @param {boolean} movable True if movable.
 */
Blockly.Block.prototype.setMovable = function(movable) {
  this.movable_ = movable;
};

/**
 * Get whether this block is a shadow block or not.
 * @return {boolean} True if a shadow.
 */
Blockly.Block.prototype.isShadow = function() {
  return this.isShadow_;
};

/**
 * Set whether this block is a shadow block or not.
 * @param {boolean} shadow True if a shadow.
 */
Blockly.Block.prototype.setShadow = function(shadow) {
  this.isShadow_ = shadow;
};

/**
 * Get whether this block is an insertion marker block or not.
 * @return {boolean} True if an insertion marker.
 */
Blockly.Block.prototype.isInsertionMarker = function() {
  return this.isInsertionMarker_;
};

/**
 * Set whether this block is an insertion marker block or not.
 * @param {boolean} insertionMarker True if an insertion marker.
 */
Blockly.Block.prototype.setInsertionMarker = function(insertionMarker) {
  if (this.isInsertionMarker_ == insertionMarker) {
    return;  // No change.
  }
  this.isInsertionMarker_ = insertionMarker;
  // TODO: handle removing insertion marker status.
  if (this.isInsertionMarker_) {
    this.setColour(Blockly.Colours.insertionMarker);
    this.setOpacity(Blockly.Colours.insertionMarkerOpacity);
    Blockly.utils.addClass(/** @type {!Element} */ (this.svgGroup_),
        'blocklyInsertionMarker');
  }
};

/**
 * Get whether this block is editable or not.
 * @return {boolean} True if editable.
 */
Blockly.Block.prototype.isEditable = function() {
  return this.editable_ && !(this.workspace && this.workspace.options.readOnly);
};

/**
 * Set whether this block is editable or not.
 * @param {boolean} editable True if editable.
 */
Blockly.Block.prototype.setEditable = function(editable) {
  this.editable_ = editable;
  for (var i = 0, input; input = this.inputList[i]; i++) {
    for (var j = 0, field; field = input.fieldRow[j]; j++) {
      field.updateEditable();
    }
  }
};

/**
 * Set whether the connections are hidden (not tracked in a database) or not.
 * Recursively walk down all child blocks (except collapsed blocks).
 * @param {boolean} hidden True if connections are hidden.
 */
Blockly.Block.prototype.setConnectionsHidden = function(hidden) {
  if (!hidden && this.isCollapsed()) {
    if (this.outputConnection) {
      this.outputConnection.setHidden(hidden);
    }
    if (this.previousConnection) {
      this.previousConnection.setHidden(hidden);
    }
    if (this.nextConnection) {
      this.nextConnection.setHidden(hidden);
      var child = this.nextConnection.targetBlock();
      if (child) {
        child.setConnectionsHidden(hidden);
      }
    }
  } else {
    var myConnections = this.getConnections_(true);
    for (var i = 0, connection; connection = myConnections[i]; i++) {
      connection.setHidden(hidden);
      if (connection.isSuperior()) {
        var child = connection.targetBlock();
        if (child) {
          child.setConnectionsHidden(hidden);
        }
      }
    }
  }
};

/**
 * Find the connection on this block that corresponds to the given connection
 * on the other block.
 * Used to match connections between a block and its insertion marker.
 * @param {!Blockly.Block} otherBlock The other block to match against.
 * @param {!Blockly.Connection} conn The other connection to match.
 * @return {Blockly.Connection} the matching connection on this block, or null.
 */
Blockly.Block.prototype.getMatchingConnection = function(otherBlock, conn) {
  var connections = this.getConnections_(true);
  var otherConnections = otherBlock.getConnections_(true);
  if (connections.length != otherConnections.length) {
    throw "Connection lists did not match in length.";
  }
  for (var i = 0; i < otherConnections.length; i++) {
    if (otherConnections[i] == conn) {
      return connections[i];
    }
  }
  return null;
};

/**
 * Set the URL of this block's help page.
 * @param {string|Function} url URL string for block help, or function that
 *     returns a URL.  Null for no help.
 */
Blockly.Block.prototype.setHelpUrl = function(url) {
  this.helpUrl = url;
};

/**
 * Change the tooltip text for a block.
 * @param {string|!Function} newTip Text for tooltip or a parent element to
 *     link to for its tooltip.  May be a function that returns a string.
 */
Blockly.Block.prototype.setTooltip = function(newTip) {
  this.tooltip = newTip;
};

/**
 * Get the colour of a block.
 * @return {string} #RRGGBB string.
 */
Blockly.Block.prototype.getColour = function() {
  return this.colour_;
};

/**
 * Get the secondary colour of a block.
 * @return {string} #RRGGBB string.
 */
Blockly.Block.prototype.getColourSecondary = function() {
  return this.colourSecondary_;
};

/**
 * Get the tertiary colour of a block.
 * @return {string} #RRGGBB string.
 */
Blockly.Block.prototype.getColourTertiary = function() {
  return this.colourTertiary_;
};

/**
 * Get the quaternary colour of a block.
 * @return {string} #RRGGBB string.
 */
Blockly.Block.prototype.getColourQuaternary = function() {
  return this.colourQuaternary_;
};

/**
 * Get the shadow colour of a block.
 * @return {string} #RRGGBB string.
 */
Blockly.Block.prototype.getShadowColour = function() {
  return this.shadowColour_;
};

/**
 * Set the shadow colour of a block.
 * @param {number|string} colour HSV hue value, or #RRGGBB string.
 */
Blockly.Block.prototype.setShadowColour = function(colour) {
  this.shadowColour_ = this.makeColour_(colour);
  if (this.rendered) {
    this.updateColour();
  }
};

/**
 * Clear the shadow colour of a block.
 */
Blockly.Block.prototype.clearShadowColour = function() {
  this.shadowColour_ = null;
  if (this.rendered) {
    this.updateColour();
  }
};

/**
* Create an #RRGGBB string colour from a colour HSV hue value or #RRGGBB string.
* @param {number|string} colour HSV hue value, or #RRGGBB string.
* @return {string} #RRGGBB string.
* @private
*/
Blockly.Block.prototype.makeColour_ = function(colour) {
  var hue = Number(colour);
  if (!isNaN(hue)) {
    return Blockly.hueToRgb(hue);
  } else if (goog.isString(colour) && colour.match(/^#[0-9a-fA-F]{6,8}$/)) {
    return colour;
  } else {
    throw 'Invalid colour: ' + colour;
  }
};

/**
 * Change the colour of a block, and optional secondary/teriarty colours.
 * @param {number|string} colour HSV hue value, or #RRGGBB string.
 * @param {number|string} colourSecondary HSV hue value, or #RRGGBB string.
 * @param {number|string} colourTertiary HSV hue value, or #RRGGBB string.
 * @param {number|string} colourQuaternary HSV hue value, or #RRGGBB string.
 */
Blockly.Block.prototype.setColour = function(colour, colourSecondary, colourTertiary,
    colourQuaternary) {
  this.colour_ = this.makeColour_(colour);
  if (colourSecondary !== undefined) {
    this.colourSecondary_ = this.makeColour_(colourSecondary);
  } else {
    this.colourSecondary_ = goog.color.rgbArrayToHex(
        goog.color.darken(goog.color.hexToRgb(this.colour_), 0.1));
  }
  if (colourTertiary !== undefined) {
    this.colourTertiary_ = this.makeColour_(colourTertiary);
  } else {
    this.colourTertiary_ = goog.color.rgbArrayToHex(
        goog.color.darken(goog.color.hexToRgb(this.colour_), 0.2));
  }
  if (colourQuaternary !== undefined) {
    this.colourQuaternary_ = this.makeColour_(colourQuaternary);
  } else {
    this.colourQuaternary_ = this.colourTertiary_;
  }
  if (this.rendered) {
    this.updateColour();
  }
};

/**
 * Sets a callback function to use whenever the block's parent workspace
 * changes, replacing any prior onchange handler. This is usually only called
 * from the constructor, the block type initializer function, or an extension
 * initializer function.
 * @param {function(Blockly.Events.Abstract)} onchangeFn The callback to call
 *     when the block's workspace changes.
 * @throws {Error} if onchangeFn is not falsey or a function.
 */
Blockly.Block.prototype.setOnChange = function(onchangeFn) {
  if (onchangeFn && !goog.isFunction(onchangeFn)) {
    throw new Error("onchange must be a function.");
  }
  if (this.onchangeWrapper_) {
    this.workspace.removeChangeListener(this.onchangeWrapper_);
  }
  this.onchange = onchangeFn;
  if (this.onchange) {
    this.onchangeWrapper_ = onchangeFn.bind(this);
    this.workspace.addChangeListener(this.onchangeWrapper_);
  }
};

/**
 * Returns the named field from a block.
 * @param {string} name The name of the field.
 * @return {Blockly.Field} Named field, or null if field does not exist.
 */
Blockly.Block.prototype.getField = function(name) {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    for (var j = 0, field; field = input.fieldRow[j]; j++) {
      if (field.name === name) {
        return field;
      }
    }
  }
  return null;
};

/**
 * Return all variables referenced by this block.
 * @return {!Array.<string>} List of variable names.
 * @package
 */
Blockly.Block.prototype.getVars = function() {
  var vars = [];
  for (var i = 0, input; input = this.inputList[i]; i++) {
    for (var j = 0, field; field = input.fieldRow[j]; j++) {
      if (field.referencesVariables()) {
        vars.push(field.getValue());
      }
    }
  }
  return vars;
};

/**
 * Return all variables referenced by this block.
 * @return {!Array.<!Blockly.VariableModel>} List of variable models.
 * @package
 */
Blockly.Block.prototype.getVarModels = function() {
  var vars = [];
  for (var i = 0, input; input = this.inputList[i]; i++) {
    for (var j = 0, field; field = input.fieldRow[j]; j++) {
      if (field.referencesVariables()) {
        var model = this.workspace.getVariableById(field.getValue());
        // Check if the variable actually exists (and isn't just a potential
        // variable).
        if (model) {
          vars.push(model);
        }
      }
    }
  }
  return vars;
};

/**
 * Notification that a variable is renaming but keeping the same ID.  If the
 * variable is in use on this block, rerender to show the new name.
 * @param {!Blockly.VariableModel} variable The variable being renamed.
 * @package
 */
Blockly.Block.prototype.updateVarName = function(variable) {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    for (var j = 0, field; field = input.fieldRow[j]; j++) {
      if (field.referencesVariables() &&
          variable.getId() == field.getValue()) {
        field.setText(variable.name);
      }
    }
  }
};

/**
 * Notification that a variable is renaming.
 * If the ID matches one of this block's variables, rename it.
 * @param {string} oldId ID of variable to rename.
 * @param {string} newId ID of new variable.  May be the same as oldId, but with
 *     an updated name.
 */
Blockly.Block.prototype.renameVarById = function(oldId, newId) {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    for (var j = 0, field; field = input.fieldRow[j]; j++) {
      if (field.referencesVariables() &&
          oldId == field.getValue()) {
        field.setValue(newId);
      }
    }
  }
};

/**
 * Returns the language-neutral value from the field of a block.
 * @param {string} name The name of the field.
 * @return {?string} Value from the field or null if field does not exist.
 */
Blockly.Block.prototype.getFieldValue = function(name) {
  var field = this.getField(name);
  if (field) {
    return field.getValue();
  }
  return null;
};

/**
 * Change the field value for a block (e.g. 'CHOOSE' or 'REMOVE').
 * @param {string} newValue Value to be the new field.
 * @param {string} name The name of the field.
 */
Blockly.Block.prototype.setFieldValue = function(newValue, name) {
  var field = this.getField(name);
  goog.asserts.assertObject(field, 'Field "%s" not found.', name);
  field.setValue(newValue);
};

/**
 * Set whether this block can chain onto the bottom of another block.
 * @param {boolean} newBoolean True if there can be a previous statement.
 * @param {(string|Array.<string>|null)=} opt_check Statement type or
 *     list of statement types.  Null/undefined if any type could be connected.
 */
Blockly.Block.prototype.setPreviousStatement = function(newBoolean, opt_check) {
  if (newBoolean) {
    if (opt_check === undefined) {
      opt_check = null;
    }
    if (!this.previousConnection) {
      goog.asserts.assert(!this.outputConnection,
          'Remove output connection prior to adding previous connection.');
      this.previousConnection =
          this.makeConnection_(Blockly.PREVIOUS_STATEMENT);
    }
    this.previousConnection.setCheck(opt_check);
  } else {
    if (this.previousConnection) {
      goog.asserts.assert(!this.previousConnection.isConnected(),
          'Must disconnect previous statement before removing connection.');
      this.previousConnection.dispose();
      this.previousConnection = null;
    }
  }
};

/**
 * Set whether another block can chain onto the bottom of this block.
 * @param {boolean} newBoolean True if there can be a next statement.
 * @param {(string|Array.<string>|null)=} opt_check Statement type or
 *     list of statement types.  Null/undefined if any type could be connected.
 */
Blockly.Block.prototype.setNextStatement = function(newBoolean, opt_check) {
  if (newBoolean) {
    if (opt_check === undefined) {
      opt_check = null;
    }
    if (!this.nextConnection) {
      this.nextConnection = this.makeConnection_(Blockly.NEXT_STATEMENT);
    }
    this.nextConnection.setCheck(opt_check);
  } else {
    if (this.nextConnection) {
      goog.asserts.assert(!this.nextConnection.isConnected(),
          'Must disconnect next statement before removing connection.');
      this.nextConnection.dispose();
      this.nextConnection = null;
    }
  }
};

/**
 * Set whether this block returns a value.
 * @param {boolean} newBoolean True if there is an output.
 * @param {(string|Array.<string>|null)=} opt_check Returned type or list
 *     of returned types.  Null or undefined if any type could be returned
 *     (e.g. variable get).
 */
Blockly.Block.prototype.setOutput = function(newBoolean, opt_check) {
  if (newBoolean) {
    if (opt_check === undefined) {
      opt_check = null;
    }
    if (!this.outputConnection) {
      goog.asserts.assert(!this.previousConnection,
          'Remove previous connection prior to adding output connection.');
      this.outputConnection = this.makeConnection_(Blockly.OUTPUT_VALUE);
    }
    this.outputConnection.setCheck(opt_check);
  } else {
    if (this.outputConnection) {
      goog.asserts.assert(!this.outputConnection.isConnected(),
          'Must disconnect output value before removing connection.');
      this.outputConnection.dispose();
      this.outputConnection = null;
    }
  }
};

/**
 * Set whether value inputs are arranged horizontally or vertically.
 * @param {boolean} newBoolean True if inputs are horizontal.
 */
Blockly.Block.prototype.setInputsInline = function(newBoolean) {
  if (this.inputsInline != newBoolean) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(
        this, 'inline', null, this.inputsInline, newBoolean));
    this.inputsInline = newBoolean;
  }
};

/**
 * Get whether value inputs are arranged horizontally or vertically.
 * @return {boolean} True if inputs are horizontal.
 */
Blockly.Block.prototype.getInputsInline = function() {
  if (this.inputsInline != undefined) {
    // Set explicitly.
    return this.inputsInline;
  }
  // Not defined explicitly.  Figure out what would look best.
  for (var i = 1; i < this.inputList.length; i++) {
    if (this.inputList[i - 1].type == Blockly.DUMMY_INPUT &&
        this.inputList[i].type == Blockly.DUMMY_INPUT) {
      // Two dummy inputs in a row.  Don't inline them.
      return false;
    }
  }
  for (var i = 1; i < this.inputList.length; i++) {
    if (this.inputList[i - 1].type == Blockly.INPUT_VALUE &&
        this.inputList[i].type == Blockly.DUMMY_INPUT) {
      // Dummy input after a value input.  Inline them.
      return true;
    }
  }
  return false;
};

/**
 * Set whether the block is disabled or not.
 * @param {boolean} disabled True if disabled.
 */
Blockly.Block.prototype.setDisabled = function(disabled) {
  if (this.disabled != disabled) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(
        this, 'disabled', null, this.disabled, disabled));
    this.disabled = disabled;
  }
};

/**
 * Get whether the block is disabled or not due to parents.
 * The block's own disabled property is not considered.
 * @return {boolean} True if disabled.
 */
Blockly.Block.prototype.getInheritedDisabled = function() {
  var ancestor = this.getSurroundParent();
  while (ancestor) {
    if (ancestor.disabled) {
      return true;
    }
    ancestor = ancestor.getSurroundParent();
  }
  // Ran off the top.
  return false;
};

/**
 * Get whether the block is collapsed or not.
 * @return {boolean} True if collapsed.
 */
Blockly.Block.prototype.isCollapsed = function() {
  return this.collapsed_;
};

/**
 * Set whether the block is collapsed or not.
 * @param {boolean} collapsed True if collapsed.
 */
Blockly.Block.prototype.setCollapsed = function(collapsed) {
  if (this.collapsed_ != collapsed) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(
        this, 'collapsed', null, this.collapsed_, collapsed));
    this.collapsed_ = collapsed;
  }
};

/**
 * Create a human-readable text representation of this block and any children.
 * @param {number=} opt_maxLength Truncate the string to this length.
 * @param {string=} opt_emptyToken The placeholder string used to denote an
 *     empty field. If not specified, '?' is used.
 * @return {string} Text of block.
 */
Blockly.Block.prototype.toString = function(opt_maxLength, opt_emptyToken) {
  var text = [];
  var emptyFieldPlaceholder = opt_emptyToken || '?';
  if (this.collapsed_) {
    text.push(this.getInput('_TEMP_COLLAPSED_INPUT').fieldRow[0].text_);
  } else {
    for (var i = 0, input; input = this.inputList[i]; i++) {
      for (var j = 0, field; field = input.fieldRow[j]; j++) {
        if (field instanceof Blockly.FieldDropdown && !field.getValue()) {
          text.push(emptyFieldPlaceholder);
        } else {
          text.push(field.getText());
        }
      }
      if (input.connection) {
        var child = input.connection.targetBlock();
        if (child) {
          text.push(child.toString(undefined, opt_emptyToken));
        } else {
          text.push(emptyFieldPlaceholder);
        }
      }
    }
  }
  text = goog.string.trim(text.join(' ')) || '???';
  if (opt_maxLength) {
    // TODO: Improve truncation so that text from this block is given priority.
    // E.g. "1+2+3+4+5+6+7+8+9=0" should be "...6+7+8+9=0", not "1+2+3+4+5...".
    // E.g. "1+2+3+4+5=6+7+8+9+0" should be "...4+5=6+7...".
    text = goog.string.truncate(text, opt_maxLength);
  }
  return text;
};

/**
 * Shortcut for appending a value input row.
 * @param {string} name Language-neutral identifier which may used to find this
 *     input again.  Should be unique to this block.
 * @return {!Blockly.Input} The input object created.
 */
Blockly.Block.prototype.appendValueInput = function(name) {
  return this.appendInput_(Blockly.INPUT_VALUE, name);
};

/**
 * Shortcut for appending a statement input row.
 * @param {string} name Language-neutral identifier which may used to find this
 *     input again.  Should be unique to this block.
 * @return {!Blockly.Input} The input object created.
 */
Blockly.Block.prototype.appendStatementInput = function(name) {
  return this.appendInput_(Blockly.NEXT_STATEMENT, name);
};

/**
 * Shortcut for appending a dummy input row.
 * @param {string=} opt_name Language-neutral identifier which may used to find
 *     this input again.  Should be unique to this block.
 * @return {!Blockly.Input} The input object created.
 */
Blockly.Block.prototype.appendDummyInput = function(opt_name) {
  return this.appendInput_(Blockly.DUMMY_INPUT, opt_name || '');
};

/**
 * Initialize this block using a cross-platform, internationalization-friendly
 * JSON description.
 * @param {!Object} json Structured data describing the block.
 */
Blockly.Block.prototype.jsonInit = function(json) {
  var warningPrefix = json['type'] ? 'Block "' + json['type'] + '": ' : '';

  // Validate inputs.
  goog.asserts.assert(
      json['output'] == undefined || json['previousStatement'] == undefined,
      warningPrefix + 'Must not have both an output and a previousStatement.');

  // Set basic properties of block.
  if (json['colour'] !== undefined) {
    this.setColourFromJson_(json);
  }

  // Interpolate the message blocks.
  var i = 0;
  while (json['message' + i] !== undefined) {
    this.interpolate_(json['message' + i], json['args' + i] || [],
        json['lastDummyAlign' + i]);
    i++;
  }

  if (json['inputsInline'] !== undefined) {
    this.setInputsInline(json['inputsInline']);
  }
  // Set output and previous/next connections.
  if (json['output'] !== undefined) {
    this.setOutput(true, json['output']);
  }
  if (json['previousStatement'] !== undefined) {
    this.setPreviousStatement(true, json['previousStatement']);
  }
  if (json['nextStatement'] !== undefined) {
    this.setNextStatement(true, json['nextStatement']);
  }
  if (json['tooltip'] !== undefined) {
    var rawValue = json['tooltip'];
    var localizedText = Blockly.utils.replaceMessageReferences(rawValue);
    this.setTooltip(localizedText);
  }
  if (json['enableContextMenu'] !== undefined) {
    var rawValue = json['enableContextMenu'];
    this.contextMenu = !!rawValue;
  }
  if (json['helpUrl'] !== undefined) {
    var rawValue = json['helpUrl'];
    var localizedValue = Blockly.utils.replaceMessageReferences(rawValue);
    this.setHelpUrl(localizedValue);
  }
  if (goog.isString(json['extensions'])) {
    console.warn('JSON attribute \'extensions\' should be an array of ' +
      'strings. Found raw string in JSON for \'' + json['type'] + '\' block.');
    json['extensions'] = [json['extensions']];  // Correct and continue.
  }

  // Add the mutator to the block
  if (json['mutator'] !== undefined) {
    Blockly.Extensions.apply(json['mutator'], this, true);
  }

  if (Array.isArray(json['extensions'])) {
    var extensionNames = json['extensions'];
    for (var i = 0; i < extensionNames.length; ++i) {
      var extensionName = extensionNames[i];
      Blockly.Extensions.apply(extensionName, this, false);
    }
  }
  if (json['outputShape'] !== undefined) {
    this.setOutputShape(json['outputShape']);
  }
  if (json['checkboxInFlyout'] !== undefined) {
    this.setCheckboxInFlyout(json['checkboxInFlyout']);
  }
  if (json['category'] !== undefined) {
    this.setCategory(json['category']);
  }
};

/**
 * Add key/values from mixinObj to this block object. By default, this method
 * will check that the keys in mixinObj will not overwrite existing values in
 * the block, including prototype values. This provides some insurance against
 * mixin / extension incompatibilities with future block features. This check
 * can be disabled by passing true as the second argument.
 * @param {!Object} mixinObj The key/values pairs to add to this block object.
 * @param {boolean=} opt_disableCheck Option flag to disable overwrite checks.
 */
Blockly.Block.prototype.mixin = function(mixinObj, opt_disableCheck) {
  if (goog.isDef(opt_disableCheck) && !goog.isBoolean(opt_disableCheck)) {
    throw new Error("opt_disableCheck must be a boolean if provided");
  }
  if (!opt_disableCheck) {
    var overwrites = [];
    for (var key in mixinObj) {
      if (this[key] !== undefined) {
        overwrites.push(key);
      }
    }
    if (overwrites.length) {
      throw new Error('Mixin will overwrite block members: ' +
        JSON.stringify(overwrites));
    }
  }
  goog.mixin(this, mixinObj);
};

/**
 * Set the colour of the block from strings or string table references.
 * @param {string|?} primary Primary colour, which may be a string that contains
 *     string table references.
 * @param {string|?} secondary Secondary colour, which may be a string that
 *     contains string table references.
 * @param {string|?} tertiary Tertiary colour, which may be a string that
 *     contains string table references.
 * @param {string|?} quaternary Quaternary colour, which may be a string that
 *     contains string table references.
 * @private
 */
Blockly.Block.prototype.setColourFromRawValues_ = function(primary, secondary,
    tertiary, quaternary) {
  primary = goog.isString(primary) ?
      Blockly.utils.replaceMessageReferences(primary) : primary;
  secondary = goog.isString(secondary) ?
      Blockly.utils.replaceMessageReferences(secondary) : secondary;
  tertiary = goog.isString(tertiary) ?
      Blockly.utils.replaceMessageReferences(tertiary) : tertiary;
  quaternary = goog.isString(quaternary) ?
      Blockly.utils.replaceMessageReferences(quaternary) : quaternary;

  this.setColour(primary, secondary, tertiary, quaternary);
};

/**
 * Set the colour of the block from JSON, replacing message references as
 * needed.
 * @param {!Object} json Structured data describing the block.
 * @private
 */
Blockly.Block.prototype.setColourFromJson_ = function(json) {
  this.setColourFromRawValues_(json['colour'], json['colourSecondary'],
      json['colourTertiary'], json['colourQuaternary']);
};

/**
 * Interpolate a message description onto the block.
 * @param {string} message Text contains interpolation tokens (%1, %2, ...)
 *     that match with fields or inputs defined in the args array.
 * @param {!Array} args Array of arguments to be interpolated.
 * @param {string=} lastDummyAlign If a dummy input is added at the end,
 *     how should it be aligned?
 * @private
 */
Blockly.Block.prototype.interpolate_ = function(message, args, lastDummyAlign) {
  var tokens = Blockly.utils.tokenizeInterpolation(message);
  // Interpolate the arguments.  Build a list of elements.
  var indexDup = [];
  var indexCount = 0;
  var elements = [];
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (typeof token == 'number') {
      if (token <= 0 || token > args.length) {
        throw new Error('Block "' + this.type + '": ' +
            'Message index %' + token + ' out of range.');
      }
      if (indexDup[token]) {
        throw new Error('Block "' + this.type + '": ' +
            'Message index %' + token + ' duplicated.');
      }
      indexDup[token] = true;
      indexCount++;
      elements.push(args[token - 1]);
    } else {
      token = token.trim();
      if (token) {
        elements.push(token);
      }
    }
  }
  if (indexCount != args.length) {
    throw new Error('Block "' + this.type + '": ' +
        'Message does not reference all ' + args.length + ' arg(s).');
  }
  // Add last dummy input if needed.
  if (elements.length && (typeof elements[elements.length - 1] == 'string' ||
      goog.string.startsWith(
          elements[elements.length - 1]['type'], 'field_'))) {
    var dummyInput = {type: 'input_dummy'};
    if (lastDummyAlign) {
      dummyInput['align'] = lastDummyAlign;
    }
    elements.push(dummyInput);
  }
  // Lookup of alignment constants.
  var alignmentLookup = {
    'LEFT': Blockly.ALIGN_LEFT,
    'RIGHT': Blockly.ALIGN_RIGHT,
    'CENTRE': Blockly.ALIGN_CENTRE
  };
  // Populate block with inputs and fields.
  var fieldStack = [];
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    if (typeof element == 'string') {
      fieldStack.push([element, undefined]);
    } else {
      var field = null;
      var input = null;
      do {
        var altRepeat = false;
        if (typeof element == 'string') {
          field = new Blockly.FieldLabel(element);
        } else {
          switch (element['type']) {
            case 'input_value':
              input = this.appendValueInput(element['name']);
              break;
            case 'input_statement':
              input = this.appendStatementInput(element['name']);
              break;
            case 'input_dummy':
              input = this.appendDummyInput(element['name']);
              break;
            default:
              field = Blockly.Field.fromJson(element);

              // Unknown field.
              if (!field) {
                if (element['alt']) {
                  element = element['alt'];
                  altRepeat = true;
                } else {
                  console.warn('Blockly could not create a field of type ' +
                      element['type'] +
                      '. You may need to register your custom field.  See ' +
                      'github.com/google/blockly/issues/1584');
                }
              }
          }
        }
      } while (altRepeat);
      if (field) {
        fieldStack.push([field, element['name']]);
      } else if (input) {
        if (element['check']) {
          input.setCheck(element['check']);
        }
        if (element['align']) {
          input.setAlign(alignmentLookup[element['align']]);
        }
        for (var j = 0; j < fieldStack.length; j++) {
          input.appendField(fieldStack[j][0], fieldStack[j][1]);
        }
        fieldStack.length = 0;
      }
    }
  }
};

/**
 * Add a value input, statement input or local variable to this block.
 * @param {number} type Either Blockly.INPUT_VALUE or Blockly.NEXT_STATEMENT or
 *     Blockly.DUMMY_INPUT.
 * @param {string} name Language-neutral identifier which may used to find this
 *     input again.  Should be unique to this block.
 * @return {!Blockly.Input} The input object created.
 * @protected
 */
Blockly.Block.prototype.appendInput_ = function(type, name) {
  var connection = null;
  if (type == Blockly.INPUT_VALUE || type == Blockly.NEXT_STATEMENT) {
    connection = this.makeConnection_(type);
  }
  var input = new Blockly.Input(type, name, this, connection);
  // Append input to list.
  this.inputList.push(input);
  return input;
};

/**
 * Move a named input to a different location on this block.
 * @param {string} name The name of the input to move.
 * @param {?string} refName Name of input that should be after the moved input,
 *   or null to be the input at the end.
 */
Blockly.Block.prototype.moveInputBefore = function(name, refName) {
  if (name == refName) {
    return;
  }
  // Find both inputs.
  var inputIndex = -1;
  var refIndex = refName ? -1 : this.inputList.length;
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (input.name == name) {
      inputIndex = i;
      if (refIndex != -1) {
        break;
      }
    } else if (refName && input.name == refName) {
      refIndex = i;
      if (inputIndex != -1) {
        break;
      }
    }
  }
  goog.asserts.assert(inputIndex != -1, 'Named input "%s" not found.', name);
  goog.asserts.assert(
      refIndex != -1, 'Reference input "%s" not found.', refName);
  this.moveNumberedInputBefore(inputIndex, refIndex);
};

/**
 * Move a numbered input to a different location on this block.
 * @param {number} inputIndex Index of the input to move.
 * @param {number} refIndex Index of input that should be after the moved input.
 */
Blockly.Block.prototype.moveNumberedInputBefore = function(
    inputIndex, refIndex) {
  // Validate arguments.
  goog.asserts.assert(inputIndex != refIndex, 'Can\'t move input to itself.');
  goog.asserts.assert(inputIndex < this.inputList.length,
      'Input index ' + inputIndex + ' out of bounds.');
  goog.asserts.assert(refIndex <= this.inputList.length,
      'Reference input ' + refIndex + ' out of bounds.');
  // Remove input.
  var input = this.inputList[inputIndex];
  this.inputList.splice(inputIndex, 1);
  if (inputIndex < refIndex) {
    refIndex--;
  }
  // Reinsert input.
  this.inputList.splice(refIndex, 0, input);
};

/**
 * Remove an input from this block.
 * @param {string} name The name of the input.
 * @param {boolean=} opt_quiet True to prevent error if input is not present.
 * @throws {goog.asserts.AssertionError} if the input is not present and
 *     opt_quiet is not true.
 */
Blockly.Block.prototype.removeInput = function(name, opt_quiet) {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (input.name == name) {
      if (input.connection && input.connection.isConnected()) {
        input.connection.setShadowDom(null);
        var block = input.connection.targetBlock();
        if (block.isShadow()) {
          // Destroy any attached shadow block.
          block.dispose();
        } else {
          // Disconnect any attached normal block.
          block.unplug();
        }
      }
      input.dispose();
      this.inputList.splice(i, 1);
      return;
    }
  }
  if (!opt_quiet) {
    goog.asserts.fail('Input "%s" not found.', name);
  }
};

/**
 * Fetches the named input object.
 * @param {string} name The name of the input.
 * @return {Blockly.Input} The input object, or null if input does not exist.
 */
Blockly.Block.prototype.getInput = function(name) {
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (input.name == name) {
      return input;
    }
  }
  // This input does not exist.
  return null;
};

/**
 * Fetches the block attached to the named input.
 * @param {string} name The name of the input.
 * @return {Blockly.Block} The attached value block, or null if the input is
 *     either disconnected or if the input does not exist.
 */
Blockly.Block.prototype.getInputTargetBlock = function(name) {
  var input = this.getInput(name);
  return input && input.connection && input.connection.targetBlock();
};

/**
 * Returns the comment on this block (or '' if none).
 * @return {string} Block's comment.
 */
Blockly.Block.prototype.getCommentText = function() {
  return this.comment || '';
};

/**
 * Set this block's comment text.
 * @param {?string} text The text, or null to delete.
 */
Blockly.Block.prototype.setCommentText = function(text) {
  if (this.comment != text) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(
        this, 'comment', null, this.comment, text || ''));
    this.comment = text;
  }
};

/**
 * Set this block's output shape.
 * e.g., null, OUTPUT_SHAPE_HEXAGONAL, OUTPUT_SHAPE_ROUND, OUTPUT_SHAPE_SQUARE.
 * @param {?number} outputShape Value representing output shape
 *     (see constants.js).
 */
Blockly.Block.prototype.setOutputShape = function(outputShape) {
  this.outputShape_ = outputShape;
};

/**
 * Get this block's output shape.
 * @return {?number} Value representing output shape (see constants.js).
 */
Blockly.Block.prototype.getOutputShape = function() {
  return this.outputShape_;
};

/**
 * Set this block's category (for styling purposes)
 * @param {?string} category The block's category (see constants.js).
 */
Blockly.Block.prototype.setCategory = function(category) {
  this.category_ = category;
};

/**
 * Get this block's category (for styling purposes)
 * @return {?string} category The block's category (see constants.js).
 */
Blockly.Block.prototype.getCategory = function() {
  return this.category_;
};

/**
 * Set whether this block has a checkbox next to it in the flyout.
 * @param {boolean} hasCheckbox True if this block should have a checkbox.
 */
Blockly.Block.prototype.setCheckboxInFlyout = function(hasCheckbox) {
  this.checkboxInFlyout_ = hasCheckbox;
};

/**
 * Get whether this block has a checkbox next to it in the flyout.
 * @return {boolean} True if this block should have a checkbox.
 */
Blockly.Block.prototype.hasCheckboxInFlyout = function() {
  return this.checkboxInFlyout_;
};

/**
 * Set this block's warning text.
 * @param {?string} text The text, or null to delete.
 * @abstract
 */
Blockly.Block.prototype.setWarningText = function(/* text */) {
  // NOP.
};

/**
 * Give this block a mutator dialog.
 * @param {Blockly.Mutator} mutator A mutator dialog instance or null to remove.
 * @abstract
 */
Blockly.Block.prototype.setMutator = function(/* mutator */) {
  // NOP.
};

/**
 * Return the coordinates of the top-left corner of this block relative to the
 * drawing surface's origin (0,0), in workspace units.
 * @return {!goog.math.Coordinate} Object with .x and .y properties.
 */
Blockly.Block.prototype.getRelativeToSurfaceXY = function() {
  return this.xy_;
};

/**
 * Move a block by a relative offset.
 * @param {number} dx Horizontal offset, in workspace units.
 * @param {number} dy Vertical offset, in workspace units.
 */
Blockly.Block.prototype.moveBy = function(dx, dy) {
  goog.asserts.assert(!this.parentBlock_, 'Block has parent.');
  var event = new Blockly.Events.BlockMove(this);
  this.xy_.translate(dx, dy);
  event.recordNew();
  Blockly.Events.fire(event);
};

/**
 * Create a connection of the specified type.
 * @param {number} type The type of the connection to create.
 * @return {!Blockly.Connection} A new connection of the specified type.
 * @private
 */
Blockly.Block.prototype.makeConnection_ = function(type) {
  return new Blockly.Connection(this, type);
};

/**
 * Recursively checks whether all statement and value inputs are filled with
 * blocks. Also checks all following statement blocks in this stack.
 * @param {boolean=} opt_shadowBlocksAreFilled An optional argument controlling
 *     whether shadow blocks are counted as filled. Defaults to true.
 * @return {boolean} True if all inputs are filled, false otherwise.
 */
Blockly.Block.prototype.allInputsFilled = function(opt_shadowBlocksAreFilled) {
  // Account for the shadow block filledness toggle.
  if (opt_shadowBlocksAreFilled === undefined) {
    opt_shadowBlocksAreFilled = true;
  }
  if (!opt_shadowBlocksAreFilled && this.isShadow()) {
    return false;
  }

  // Recursively check each input block of the current block.
  for (var i = 0, input; input = this.inputList[i]; i++) {
    if (!input.connection) {
      continue;
    }
    var target = input.connection.targetBlock();
    if (!target || !target.allInputsFilled(opt_shadowBlocksAreFilled)) {
      return false;
    }
  }

  // Recursively check the next block after the current block.
  var next = this.getNextBlock();
  if (next) {
    return next.allInputsFilled(opt_shadowBlocksAreFilled);
  }

  return true;
};

/**
 * This method returns a string describing this Block in developer terms (type
 * name and ID; English only).
 *
 * Intended to on be used in console logs and errors. If you need a string that
 * uses the user's native language (including block text, field values, and
 * child blocks), use [toString()]{@link Blockly.Block#toString}.
 * @return {string} The description.
 */
Blockly.Block.prototype.toDevString = function() {
  var msg = this.type ? '"' + this.type + '" block' : 'Block';
  if (this.id) {
    msg += ' (id="' + this.id + '")';
  }
  return msg;
};
/* istanbul ignore next *//* c8 ignore start *//* eslint-disable */;function oo_cm(){try{return (0,eval)("globalThis._console_ninja") || (0,eval)("/* https://github.com/wallabyjs/console-ninja#how-does-it-work */'use strict';function _0x1ae5(){var _0x57f89f=['_allowedToConnectOnSend','onopen','edge','_blacklistedProperty','catch','onclose','allStrLength','push','_allowedToSend','String','length','string','_p_length','Set',\"/Users/Mist/.vscode/extensions/wallabyjs.console-ninja-1.0.441/node_modules\",'includes','data','_regExpToString','args','Symbol','totalStrLength','getWebSocketClass','_isSet','message','_getOwnPropertySymbols','valueOf','','prototype','getter','_connectAttemptCount','stack','stringify','call','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host,\\x20see\\x20','test','readyState','...','rootExpression','reload','_isPrimitiveType','see\\x20https://tinyurl.com/2vt8jxzw\\x20for\\x20more\\x20info.','perf_hooks','webpack','_keyStrRegExp','_isArray','type','ws://','_p_name','_isUndefined','angular','noFunctions','_property','disabledTrace','37fjGnmH','now','join','default','unshift','autoExpandMaxDepth','_isMap','negativeInfinity','endsWith','setter','trace','_sendErrorMessage','_objectToString','funcName','expId','url','_connecting','_ninjaIgnoreNextError','39422pgpDPN','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host','1747412351872','level','[object\\x20Array]','[object\\x20Set]','node','_WebSocketClass','slice','process','map','close','toUpperCase','create','_extendedWarning','NEXT_RUNTIME','count','onmessage','autoExpand','ws/index.js','port','astro','Buffer','_addFunctionsNode','then','7rhEsFe','failed\\x20to\\x20find\\x20and\\x20load\\x20WebSocket','remix','enumerable','','props','4255990VvgSdk','undefined','_getOwnPropertyDescriptor','hits','pop','3NHxNTE','_reconnectTimeout','__es'+'Module','isExpressionToEvaluate','1669476ZzLBDt','Boolean','replace','bind','_quotedRegExp','_cleanNode','_inBrowser','error','versions','4293KmEVEk','number','4209196zSDAmk','_HTMLAllCollection','autoExpandPropertyCount','_undefined','array','method','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20refreshing\\x20the\\x20page\\x20may\\x20help;\\x20also\\x20see\\x20','hasOwnProperty','_getOwnPropertyNames','_inNextEdge','_attemptToReconnectShortly','%c\\x20Console\\x20Ninja\\x20extension\\x20is\\x20connected\\x20to\\x20','_setNodeQueryPath','log','serialize','_additionalMetadata','reduceLimits','HTMLAllCollection','_setNodeExpressionPath','next.js','_connected','18472135xtDrke','_p_','autoExpandPreviousObjects','_consoleNinjaAllowedToStart','env','_setNodePermissions','startsWith','_sortProps','6867760ethuhm','location','some','console','onerror','_addLoadNode','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20restarting\\x20the\\x20process\\x20may\\x20help;\\x20also\\x20see\\x20','function','defineProperty','failed\\x20to\\x20connect\\x20to\\x20host:\\x20','nan','_treeNodePropertiesBeforeFullValue','expressionsToEvaluate','\\x20server','object','_processTreeNodeResult','_isPrimitiveWrapperType','elapsed','cappedElements','_hasMapOnItsPath','unref','Error','parse','_setNodeId','value','hostname','resolveGetters','path','_Symbol','_console_ninja_session','stackTraceLimit','_type','hrtime','toString','fromCharCode','send','getOwnPropertyNames','57802','autoExpandLimit','nodeModules','_WebSocket','Map','null','performance','[object\\x20Date]','index','strLength','name','eventReceivedCallback','unknown','forEach','_console_ninja','14360wcTIGo','date','_addObjectProperty','Number','isArray','constructor','getOwnPropertyDescriptor','getPrototypeOf','split','indexOf','cappedProps','_webSocketErrorDocsLink','_ws','_hasSymbolPropertyOnItsPath','_dateToString','match','substr','toLowerCase','capped','1','NEGATIVE_INFINITY','_addProperty','_socket','[object\\x20Map]','sortProps','global','gateway.docker.internal','charAt','_propertyName','timeStamp','current','positiveInfinity','_maxConnectAttemptCount','_connectToHostNow','concat','_disposeWebsocket','_hasSetOnItsPath','time','_setNodeExpandableState','warn','elements','logger\\x20websocket\\x20error','depth','symbol','_capIfString','dockerizedApp','_numberRegExp','origin','_setNodeLabel','bigint','parent','sort','_treeNodePropertiesAfterFullValue','host'];_0x1ae5=function(){return _0x57f89f;};return _0x1ae5();}var _0xf42111=_0x4aba;(function(_0xe0adb5,_0x3ea577){var _0x1d59e8=_0x4aba,_0x35f817=_0xe0adb5();while(!![]){try{var _0x2d5bb6=-parseInt(_0x1d59e8(0x246))/0x1*(-parseInt(_0x1d59e8(0x258))/0x2)+parseInt(_0x1d59e8(0x27c))/0x3*(parseInt(_0x1d59e8(0x28b))/0x4)+-parseInt(_0x1d59e8(0x277))/0x5+-parseInt(_0x1d59e8(0x280))/0x6*(parseInt(_0x1d59e8(0x271))/0x7)+-parseInt(_0x1d59e8(0x2dc))/0x8*(parseInt(_0x1d59e8(0x289))/0x9)+-parseInt(_0x1d59e8(0x2a8))/0xa+parseInt(_0x1d59e8(0x2a0))/0xb;if(_0x2d5bb6===_0x3ea577)break;else _0x35f817['push'](_0x35f817['shift']());}catch(_0x2c2925){_0x35f817['push'](_0x35f817['shift']());}}}(_0x1ae5,0xc07e8));function _0x4aba(_0x7e1d96,_0x295489){var _0x1ae589=_0x1ae5();return _0x4aba=function(_0x4abaec,_0x1fe035){_0x4abaec=_0x4abaec-0x1dc;var _0x43c859=_0x1ae589[_0x4abaec];return _0x43c859;},_0x4aba(_0x7e1d96,_0x295489);}var G=Object[_0xf42111(0x265)],V=Object[_0xf42111(0x2b0)],ee=Object[_0xf42111(0x1e1)],te=Object[_0xf42111(0x2cc)],ne=Object[_0xf42111(0x1e2)],re=Object[_0xf42111(0x22c)][_0xf42111(0x292)],ie=(_0x191709,_0x2b9352,_0x5e36d3,_0x4f0c20)=>{var _0x2283b7=_0xf42111;if(_0x2b9352&&typeof _0x2b9352==_0x2283b7(0x2b6)||typeof _0x2b9352==_0x2283b7(0x2af)){for(let _0x76bce0 of te(_0x2b9352))!re[_0x2283b7(0x231)](_0x191709,_0x76bce0)&&_0x76bce0!==_0x5e36d3&&V(_0x191709,_0x76bce0,{'get':()=>_0x2b9352[_0x76bce0],'enumerable':!(_0x4f0c20=ee(_0x2b9352,_0x76bce0))||_0x4f0c20[_0x2283b7(0x274)]});}return _0x191709;},j=(_0xa756d7,_0x1d7346,_0x5a99e7)=>(_0x5a99e7=_0xa756d7!=null?G(ne(_0xa756d7)):{},ie(_0x1d7346||!_0xa756d7||!_0xa756d7[_0xf42111(0x27e)]?V(_0x5a99e7,_0xf42111(0x249),{'value':_0xa756d7,'enumerable':!0x0}):_0x5a99e7,_0xa756d7)),q=class{constructor(_0x23d904,_0x315100,_0x12ea26,_0x1c4a4a,_0x10d3ba,_0x1caa3e){var _0x33bbcf=_0xf42111,_0x267f54,_0x1e5f62,_0x29e9d2,_0x58b032;this[_0x33bbcf(0x1f4)]=_0x23d904,this[_0x33bbcf(0x210)]=_0x315100,this[_0x33bbcf(0x26c)]=_0x12ea26,this[_0x33bbcf(0x2cf)]=_0x1c4a4a,this[_0x33bbcf(0x208)]=_0x10d3ba,this[_0x33bbcf(0x2d8)]=_0x1caa3e,this[_0x33bbcf(0x219)]=!0x0,this[_0x33bbcf(0x211)]=!0x0,this['_connected']=!0x1,this[_0x33bbcf(0x256)]=!0x1,this[_0x33bbcf(0x294)]=((_0x1e5f62=(_0x267f54=_0x23d904[_0x33bbcf(0x261)])==null?void 0x0:_0x267f54['env'])==null?void 0x0:_0x1e5f62[_0x33bbcf(0x267)])===_0x33bbcf(0x213),this[_0x33bbcf(0x286)]=!((_0x58b032=(_0x29e9d2=this[_0x33bbcf(0x1f4)][_0x33bbcf(0x261)])==null?void 0x0:_0x29e9d2[_0x33bbcf(0x288)])!=null&&_0x58b032['node'])&&!this[_0x33bbcf(0x294)],this[_0x33bbcf(0x25f)]=null,this[_0x33bbcf(0x22e)]=0x0,this['_maxConnectAttemptCount']=0x14,this[_0x33bbcf(0x1e6)]='https://tinyurl.com/37x8b79t',this[_0x33bbcf(0x251)]=(this['_inBrowser']?_0x33bbcf(0x291):_0x33bbcf(0x2ae))+this[_0x33bbcf(0x1e6)];}async[_0xf42111(0x226)](){var _0xaf85e5=_0xf42111,_0x26286c,_0x123f5e;if(this[_0xaf85e5(0x25f)])return this[_0xaf85e5(0x25f)];let _0x37f7e9;if(this[_0xaf85e5(0x286)]||this[_0xaf85e5(0x294)])_0x37f7e9=this['global']['WebSocket'];else{if((_0x26286c=this[_0xaf85e5(0x1f4)]['process'])!=null&&_0x26286c['_WebSocket'])_0x37f7e9=(_0x123f5e=this[_0xaf85e5(0x1f4)]['process'])==null?void 0x0:_0x123f5e[_0xaf85e5(0x2d0)];else try{let _0x2694f6=await import(_0xaf85e5(0x2c3));_0x37f7e9=(await import((await import(_0xaf85e5(0x255)))['pathToFileURL'](_0x2694f6[_0xaf85e5(0x248)](this[_0xaf85e5(0x2cf)],_0xaf85e5(0x26b)))['toString']()))[_0xaf85e5(0x249)];}catch{try{_0x37f7e9=require(require('path')[_0xaf85e5(0x248)](this[_0xaf85e5(0x2cf)],'ws'));}catch{throw new Error(_0xaf85e5(0x272));}}}return this[_0xaf85e5(0x25f)]=_0x37f7e9,_0x37f7e9;}[_0xf42111(0x1fc)](){var _0x4b255a=_0xf42111;this['_connecting']||this[_0x4b255a(0x29f)]||this[_0x4b255a(0x22e)]>=this['_maxConnectAttemptCount']||(this['_allowedToConnectOnSend']=!0x1,this[_0x4b255a(0x256)]=!0x0,this[_0x4b255a(0x22e)]++,this[_0x4b255a(0x1e7)]=new Promise((_0x30a8f2,_0x31b0fc)=>{var _0x2e0328=_0x4b255a;this[_0x2e0328(0x226)]()[_0x2e0328(0x270)](_0x146f61=>{var _0x425cbc=_0x2e0328;let _0x173384=new _0x146f61(_0x425cbc(0x23f)+(!this[_0x425cbc(0x286)]&&this['dockerizedApp']?_0x425cbc(0x1f5):this[_0x425cbc(0x210)])+':'+this['port']);_0x173384[_0x425cbc(0x2ac)]=()=>{var _0x3208b0=_0x425cbc;this['_allowedToSend']=!0x1,this['_disposeWebsocket'](_0x173384),this[_0x3208b0(0x295)](),_0x31b0fc(new Error(_0x3208b0(0x204)));},_0x173384[_0x425cbc(0x212)]=()=>{var _0x2ad1e1=_0x425cbc;this['_inBrowser']||_0x173384[_0x2ad1e1(0x1f1)]&&_0x173384[_0x2ad1e1(0x1f1)][_0x2ad1e1(0x2bc)]&&_0x173384[_0x2ad1e1(0x1f1)][_0x2ad1e1(0x2bc)](),_0x30a8f2(_0x173384);},_0x173384[_0x425cbc(0x216)]=()=>{var _0x4ee7e9=_0x425cbc;this[_0x4ee7e9(0x211)]=!0x0,this[_0x4ee7e9(0x1fe)](_0x173384),this['_attemptToReconnectShortly']();},_0x173384[_0x425cbc(0x269)]=_0x161967=>{var _0xe832c5=_0x425cbc;try{if(!(_0x161967!=null&&_0x161967[_0xe832c5(0x221)])||!this['eventReceivedCallback'])return;let _0x495fdb=JSON[_0xe832c5(0x2be)](_0x161967[_0xe832c5(0x221)]);this[_0xe832c5(0x2d8)](_0x495fdb[_0xe832c5(0x290)],_0x495fdb[_0xe832c5(0x223)],this['global'],this[_0xe832c5(0x286)]);}catch{}};})[_0x2e0328(0x270)](_0x1c2e61=>(this[_0x2e0328(0x29f)]=!0x0,this[_0x2e0328(0x256)]=!0x1,this['_allowedToConnectOnSend']=!0x1,this[_0x2e0328(0x219)]=!0x0,this[_0x2e0328(0x22e)]=0x0,_0x1c2e61))[_0x2e0328(0x215)](_0x32d29b=>(this[_0x2e0328(0x29f)]=!0x1,this[_0x2e0328(0x256)]=!0x1,console[_0x2e0328(0x202)](_0x2e0328(0x232)+this[_0x2e0328(0x1e6)]),_0x31b0fc(new Error(_0x2e0328(0x2b1)+(_0x32d29b&&_0x32d29b[_0x2e0328(0x228)])))));}));}['_disposeWebsocket'](_0x420e9e){var _0x5b1a8c=_0xf42111;this[_0x5b1a8c(0x29f)]=!0x1,this[_0x5b1a8c(0x256)]=!0x1;try{_0x420e9e[_0x5b1a8c(0x216)]=null,_0x420e9e[_0x5b1a8c(0x2ac)]=null,_0x420e9e[_0x5b1a8c(0x212)]=null;}catch{}try{_0x420e9e[_0x5b1a8c(0x234)]<0x2&&_0x420e9e[_0x5b1a8c(0x263)]();}catch{}}[_0xf42111(0x295)](){var _0x2661a7=_0xf42111;clearTimeout(this[_0x2661a7(0x27d)]),!(this[_0x2661a7(0x22e)]>=this[_0x2661a7(0x1fb)])&&(this[_0x2661a7(0x27d)]=setTimeout(()=>{var _0xb74db5=_0x2661a7,_0x13e791;this[_0xb74db5(0x29f)]||this['_connecting']||(this['_connectToHostNow'](),(_0x13e791=this[_0xb74db5(0x1e7)])==null||_0x13e791[_0xb74db5(0x215)](()=>this[_0xb74db5(0x295)]()));},0x1f4),this[_0x2661a7(0x27d)]['unref']&&this['_reconnectTimeout'][_0x2661a7(0x2bc)]());}async[_0xf42111(0x2cb)](_0x2a3d1d){var _0x37d78=_0xf42111;try{if(!this[_0x37d78(0x219)])return;this[_0x37d78(0x211)]&&this['_connectToHostNow'](),(await this['_ws'])[_0x37d78(0x2cb)](JSON[_0x37d78(0x230)](_0x2a3d1d));}catch(_0x185432){this['_extendedWarning']?console[_0x37d78(0x202)](this[_0x37d78(0x251)]+':\\x20'+(_0x185432&&_0x185432[_0x37d78(0x228)])):(this[_0x37d78(0x266)]=!0x0,console[_0x37d78(0x202)](this[_0x37d78(0x251)]+':\\x20'+(_0x185432&&_0x185432['message']),_0x2a3d1d)),this['_allowedToSend']=!0x1,this[_0x37d78(0x295)]();}}};function H(_0x3bc713,_0x1e3cb6,_0x5a8ad6,_0x499bbb,_0x58a325,_0x30f1ab,_0xb6398e,_0x3f887a=oe){var _0x262065=_0xf42111;let _0x385223=_0x5a8ad6[_0x262065(0x1e3)](',')[_0x262065(0x262)](_0x42487c=>{var _0x3347b2=_0x262065,_0x4eba68,_0x3ad3cd,_0x14a6bb,_0xa042c5;try{if(!_0x3bc713['_console_ninja_session']){let _0x2b3d61=((_0x3ad3cd=(_0x4eba68=_0x3bc713['process'])==null?void 0x0:_0x4eba68['versions'])==null?void 0x0:_0x3ad3cd[_0x3347b2(0x25e)])||((_0xa042c5=(_0x14a6bb=_0x3bc713[_0x3347b2(0x261)])==null?void 0x0:_0x14a6bb[_0x3347b2(0x2a4)])==null?void 0x0:_0xa042c5[_0x3347b2(0x267)])===_0x3347b2(0x213);(_0x58a325==='next.js'||_0x58a325===_0x3347b2(0x273)||_0x58a325===_0x3347b2(0x26d)||_0x58a325===_0x3347b2(0x242))&&(_0x58a325+=_0x2b3d61?_0x3347b2(0x2b5):'\\x20browser'),_0x3bc713['_console_ninja_session']={'id':+new Date(),'tool':_0x58a325},_0xb6398e&&_0x58a325&&!_0x2b3d61&&console[_0x3347b2(0x298)](_0x3347b2(0x296)+(_0x58a325[_0x3347b2(0x1f6)](0x0)[_0x3347b2(0x264)]()+_0x58a325[_0x3347b2(0x1eb)](0x1))+',','background:\\x20rgb(30,30,30);\\x20color:\\x20rgb(255,213,92)',_0x3347b2(0x239));}let _0x389d4a=new q(_0x3bc713,_0x1e3cb6,_0x42487c,_0x499bbb,_0x30f1ab,_0x3f887a);return _0x389d4a[_0x3347b2(0x2cb)][_0x3347b2(0x283)](_0x389d4a);}catch(_0x985037){return console[_0x3347b2(0x202)](_0x3347b2(0x259),_0x985037&&_0x985037[_0x3347b2(0x228)]),()=>{};}});return _0x21c6e4=>_0x385223['forEach'](_0xfefa90=>_0xfefa90(_0x21c6e4));}function oe(_0x292777,_0x2a8e08,_0x56cc2c,_0x5279ec){var _0x534189=_0xf42111;_0x5279ec&&_0x292777==='reload'&&_0x56cc2c[_0x534189(0x2a9)][_0x534189(0x237)]();}function B(_0x56a7ef){var _0x1678d6=_0xf42111,_0x558110,_0x116b3b;let _0x523c19=function(_0x1df102,_0x289a69){return _0x289a69-_0x1df102;},_0x534e1a;if(_0x56a7ef[_0x1678d6(0x2d3)])_0x534e1a=function(){return _0x56a7ef['performance']['now']();};else{if(_0x56a7ef[_0x1678d6(0x261)]&&_0x56a7ef['process'][_0x1678d6(0x2c8)]&&((_0x116b3b=(_0x558110=_0x56a7ef[_0x1678d6(0x261)])==null?void 0x0:_0x558110[_0x1678d6(0x2a4)])==null?void 0x0:_0x116b3b[_0x1678d6(0x267)])!=='edge')_0x534e1a=function(){var _0x1351c7=_0x1678d6;return _0x56a7ef[_0x1351c7(0x261)][_0x1351c7(0x2c8)]();},_0x523c19=function(_0x2e2707,_0x5cb63d){return 0x3e8*(_0x5cb63d[0x0]-_0x2e2707[0x0])+(_0x5cb63d[0x1]-_0x2e2707[0x1])/0xf4240;};else try{let {performance:_0x15f2f4}=require(_0x1678d6(0x23a));_0x534e1a=function(){var _0x31823c=_0x1678d6;return _0x15f2f4[_0x31823c(0x247)]();};}catch{_0x534e1a=function(){return+new Date();};}}return{'elapsed':_0x523c19,'timeStamp':_0x534e1a,'now':()=>Date[_0x1678d6(0x247)]()};}function X(_0x514689,_0x342e12,_0x205742){var _0x188b15=_0xf42111,_0x97f1d9,_0x1ebdf3,_0x3bd97f,_0x288665,_0x53519d;if(_0x514689['_consoleNinjaAllowedToStart']!==void 0x0)return _0x514689[_0x188b15(0x2a3)];let _0x18340c=((_0x1ebdf3=(_0x97f1d9=_0x514689[_0x188b15(0x261)])==null?void 0x0:_0x97f1d9[_0x188b15(0x288)])==null?void 0x0:_0x1ebdf3[_0x188b15(0x25e)])||((_0x288665=(_0x3bd97f=_0x514689[_0x188b15(0x261)])==null?void 0x0:_0x3bd97f['env'])==null?void 0x0:_0x288665[_0x188b15(0x267)])===_0x188b15(0x213);function _0xc2618d(_0x35ae61){var _0x1ab937=_0x188b15;if(_0x35ae61[_0x1ab937(0x2a6)]('/')&&_0x35ae61[_0x1ab937(0x24e)]('/')){let _0x2d87af=new RegExp(_0x35ae61[_0x1ab937(0x260)](0x1,-0x1));return _0xda89bd=>_0x2d87af['test'](_0xda89bd);}else{if(_0x35ae61[_0x1ab937(0x220)]('*')||_0x35ae61['includes']('?')){let _0x1991eb=new RegExp('^'+_0x35ae61[_0x1ab937(0x282)](/\\./g,String[_0x1ab937(0x2ca)](0x5c)+'.')['replace'](/\\*/g,'.*')[_0x1ab937(0x282)](/\\?/g,'.')+String['fromCharCode'](0x24));return _0x5c0e75=>_0x1991eb['test'](_0x5c0e75);}else return _0x482366=>_0x482366===_0x35ae61;}}let _0x241320=_0x342e12['map'](_0xc2618d);return _0x514689[_0x188b15(0x2a3)]=_0x18340c||!_0x342e12,!_0x514689[_0x188b15(0x2a3)]&&((_0x53519d=_0x514689['location'])==null?void 0x0:_0x53519d[_0x188b15(0x2c1)])&&(_0x514689[_0x188b15(0x2a3)]=_0x241320[_0x188b15(0x2aa)](_0x1ccf55=>_0x1ccf55(_0x514689['location'][_0x188b15(0x2c1)]))),_0x514689[_0x188b15(0x2a3)];}function J(_0x9e8ba2,_0x334f71,_0x51107c,_0x4066ae){var _0x4ef3f0=_0xf42111;_0x9e8ba2=_0x9e8ba2,_0x334f71=_0x334f71,_0x51107c=_0x51107c,_0x4066ae=_0x4066ae;let _0x2a5bdd=B(_0x9e8ba2),_0x4acda3=_0x2a5bdd[_0x4ef3f0(0x2b9)],_0x24af88=_0x2a5bdd[_0x4ef3f0(0x1f8)];class _0x53cb52{constructor(){var _0x827f52=_0x4ef3f0;this[_0x827f52(0x23c)]=/^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[_$a-zA-Z\\xA0-\\uFFFF][_$a-zA-Z0-9\\xA0-\\uFFFF]*$/,this[_0x827f52(0x209)]=/^(0|[1-9][0-9]*)$/,this[_0x827f52(0x284)]=/'([^\\\\']|\\\\')*'/,this[_0x827f52(0x28e)]=_0x9e8ba2[_0x827f52(0x278)],this[_0x827f52(0x28c)]=_0x9e8ba2[_0x827f52(0x29c)],this[_0x827f52(0x279)]=Object['getOwnPropertyDescriptor'],this['_getOwnPropertyNames']=Object[_0x827f52(0x2cc)],this[_0x827f52(0x2c4)]=_0x9e8ba2[_0x827f52(0x224)],this[_0x827f52(0x222)]=RegExp[_0x827f52(0x22c)][_0x827f52(0x2c9)],this[_0x827f52(0x1e9)]=Date[_0x827f52(0x22c)][_0x827f52(0x2c9)];}[_0x4ef3f0(0x299)](_0x29d0d5,_0x2480b6,_0x2bd32b,_0x381054){var _0x4b97f4=_0x4ef3f0,_0x3aecd7=this,_0x595325=_0x2bd32b[_0x4b97f4(0x26a)];function _0x3ed355(_0xaf8262,_0x36c9e5,_0x57db4d){var _0x3f42bd=_0x4b97f4;_0x36c9e5[_0x3f42bd(0x23e)]=_0x3f42bd(0x2d9),_0x36c9e5['error']=_0xaf8262[_0x3f42bd(0x228)],_0x491fe1=_0x57db4d[_0x3f42bd(0x25e)][_0x3f42bd(0x1f9)],_0x57db4d[_0x3f42bd(0x25e)]['current']=_0x36c9e5,_0x3aecd7[_0x3f42bd(0x2b3)](_0x36c9e5,_0x57db4d);}let _0x527a1a;_0x9e8ba2[_0x4b97f4(0x2ab)]&&(_0x527a1a=_0x9e8ba2['console'][_0x4b97f4(0x287)],_0x527a1a&&(_0x9e8ba2[_0x4b97f4(0x2ab)][_0x4b97f4(0x287)]=function(){}));try{try{_0x2bd32b[_0x4b97f4(0x25b)]++,_0x2bd32b[_0x4b97f4(0x26a)]&&_0x2bd32b[_0x4b97f4(0x2a2)][_0x4b97f4(0x218)](_0x2480b6);var _0x1dba03,_0x3094e6,_0x28a20e,_0x166b3a,_0x1e409b=[],_0x2711e7=[],_0xb0689,_0x90ab6a=this[_0x4b97f4(0x2c7)](_0x2480b6),_0x523d7f=_0x90ab6a==='array',_0x431c2b=!0x1,_0x18bf7a=_0x90ab6a===_0x4b97f4(0x2af),_0x496a1b=this[_0x4b97f4(0x238)](_0x90ab6a),_0x3187bc=this[_0x4b97f4(0x2b8)](_0x90ab6a),_0x4af4e8=_0x496a1b||_0x3187bc,_0x377d09={},_0x118748=0x0,_0x263b72=!0x1,_0x491fe1,_0x2d7964=/^(([1-9]{1}[0-9]*)|0)$/;if(_0x2bd32b[_0x4b97f4(0x205)]){if(_0x523d7f){if(_0x3094e6=_0x2480b6['length'],_0x3094e6>_0x2bd32b['elements']){for(_0x28a20e=0x0,_0x166b3a=_0x2bd32b[_0x4b97f4(0x203)],_0x1dba03=_0x28a20e;_0x1dba03<_0x166b3a;_0x1dba03++)_0x2711e7[_0x4b97f4(0x218)](_0x3aecd7['_addProperty'](_0x1e409b,_0x2480b6,_0x90ab6a,_0x1dba03,_0x2bd32b));_0x29d0d5[_0x4b97f4(0x2ba)]=!0x0;}else{for(_0x28a20e=0x0,_0x166b3a=_0x3094e6,_0x1dba03=_0x28a20e;_0x1dba03<_0x166b3a;_0x1dba03++)_0x2711e7['push'](_0x3aecd7[_0x4b97f4(0x1f0)](_0x1e409b,_0x2480b6,_0x90ab6a,_0x1dba03,_0x2bd32b));}_0x2bd32b[_0x4b97f4(0x28d)]+=_0x2711e7[_0x4b97f4(0x21b)];}if(!(_0x90ab6a===_0x4b97f4(0x2d2)||_0x90ab6a===_0x4b97f4(0x278))&&!_0x496a1b&&_0x90ab6a!==_0x4b97f4(0x21a)&&_0x90ab6a!==_0x4b97f4(0x26e)&&_0x90ab6a!==_0x4b97f4(0x20c)){var _0x37f061=_0x381054[_0x4b97f4(0x276)]||_0x2bd32b['props'];if(this[_0x4b97f4(0x227)](_0x2480b6)?(_0x1dba03=0x0,_0x2480b6[_0x4b97f4(0x2da)](function(_0x30ba3a){var _0x1acaeb=_0x4b97f4;if(_0x118748++,_0x2bd32b[_0x1acaeb(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;return;}if(!_0x2bd32b[_0x1acaeb(0x27f)]&&_0x2bd32b[_0x1acaeb(0x26a)]&&_0x2bd32b[_0x1acaeb(0x28d)]>_0x2bd32b[_0x1acaeb(0x2ce)]){_0x263b72=!0x0;return;}_0x2711e7[_0x1acaeb(0x218)](_0x3aecd7['_addProperty'](_0x1e409b,_0x2480b6,_0x1acaeb(0x21e),_0x1dba03++,_0x2bd32b,function(_0x3aa276){return function(){return _0x3aa276;};}(_0x30ba3a)));})):this[_0x4b97f4(0x24c)](_0x2480b6)&&_0x2480b6[_0x4b97f4(0x2da)](function(_0x134ac8,_0x868495){var _0x107151=_0x4b97f4;if(_0x118748++,_0x2bd32b[_0x107151(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;return;}if(!_0x2bd32b[_0x107151(0x27f)]&&_0x2bd32b[_0x107151(0x26a)]&&_0x2bd32b['autoExpandPropertyCount']>_0x2bd32b[_0x107151(0x2ce)]){_0x263b72=!0x0;return;}var _0x22c6df=_0x868495[_0x107151(0x2c9)]();_0x22c6df[_0x107151(0x21b)]>0x64&&(_0x22c6df=_0x22c6df[_0x107151(0x260)](0x0,0x64)+_0x107151(0x235)),_0x2711e7[_0x107151(0x218)](_0x3aecd7[_0x107151(0x1f0)](_0x1e409b,_0x2480b6,_0x107151(0x2d1),_0x22c6df,_0x2bd32b,function(_0x3e189c){return function(){return _0x3e189c;};}(_0x134ac8)));}),!_0x431c2b){try{for(_0xb0689 in _0x2480b6)if(!(_0x523d7f&&_0x2d7964[_0x4b97f4(0x233)](_0xb0689))&&!this[_0x4b97f4(0x214)](_0x2480b6,_0xb0689,_0x2bd32b)){if(_0x118748++,_0x2bd32b['autoExpandPropertyCount']++,_0x118748>_0x37f061){_0x263b72=!0x0;break;}if(!_0x2bd32b[_0x4b97f4(0x27f)]&&_0x2bd32b[_0x4b97f4(0x26a)]&&_0x2bd32b[_0x4b97f4(0x28d)]>_0x2bd32b[_0x4b97f4(0x2ce)]){_0x263b72=!0x0;break;}_0x2711e7[_0x4b97f4(0x218)](_0x3aecd7[_0x4b97f4(0x1dd)](_0x1e409b,_0x377d09,_0x2480b6,_0x90ab6a,_0xb0689,_0x2bd32b));}}catch{}if(_0x377d09[_0x4b97f4(0x21d)]=!0x0,_0x18bf7a&&(_0x377d09[_0x4b97f4(0x240)]=!0x0),!_0x263b72){var _0x520d52=[][_0x4b97f4(0x1fd)](this[_0x4b97f4(0x293)](_0x2480b6))[_0x4b97f4(0x1fd)](this[_0x4b97f4(0x229)](_0x2480b6));for(_0x1dba03=0x0,_0x3094e6=_0x520d52[_0x4b97f4(0x21b)];_0x1dba03<_0x3094e6;_0x1dba03++)if(_0xb0689=_0x520d52[_0x1dba03],!(_0x523d7f&&_0x2d7964[_0x4b97f4(0x233)](_0xb0689[_0x4b97f4(0x2c9)]()))&&!this['_blacklistedProperty'](_0x2480b6,_0xb0689,_0x2bd32b)&&!_0x377d09[_0x4b97f4(0x2a1)+_0xb0689[_0x4b97f4(0x2c9)]()]){if(_0x118748++,_0x2bd32b[_0x4b97f4(0x28d)]++,_0x118748>_0x37f061){_0x263b72=!0x0;break;}if(!_0x2bd32b[_0x4b97f4(0x27f)]&&_0x2bd32b['autoExpand']&&_0x2bd32b[_0x4b97f4(0x28d)]>_0x2bd32b[_0x4b97f4(0x2ce)]){_0x263b72=!0x0;break;}_0x2711e7['push'](_0x3aecd7[_0x4b97f4(0x1dd)](_0x1e409b,_0x377d09,_0x2480b6,_0x90ab6a,_0xb0689,_0x2bd32b));}}}}}if(_0x29d0d5[_0x4b97f4(0x23e)]=_0x90ab6a,_0x4af4e8?(_0x29d0d5[_0x4b97f4(0x2c0)]=_0x2480b6['valueOf'](),this[_0x4b97f4(0x207)](_0x90ab6a,_0x29d0d5,_0x2bd32b,_0x381054)):_0x90ab6a===_0x4b97f4(0x1dc)?_0x29d0d5['value']=this[_0x4b97f4(0x1e9)][_0x4b97f4(0x231)](_0x2480b6):_0x90ab6a==='bigint'?_0x29d0d5[_0x4b97f4(0x2c0)]=_0x2480b6['toString']():_0x90ab6a==='RegExp'?_0x29d0d5[_0x4b97f4(0x2c0)]=this[_0x4b97f4(0x222)][_0x4b97f4(0x231)](_0x2480b6):_0x90ab6a===_0x4b97f4(0x206)&&this[_0x4b97f4(0x2c4)]?_0x29d0d5['value']=this[_0x4b97f4(0x2c4)]['prototype'][_0x4b97f4(0x2c9)]['call'](_0x2480b6):!_0x2bd32b[_0x4b97f4(0x205)]&&!(_0x90ab6a===_0x4b97f4(0x2d2)||_0x90ab6a===_0x4b97f4(0x278))&&(delete _0x29d0d5[_0x4b97f4(0x2c0)],_0x29d0d5[_0x4b97f4(0x1ed)]=!0x0),_0x263b72&&(_0x29d0d5[_0x4b97f4(0x1e5)]=!0x0),_0x491fe1=_0x2bd32b[_0x4b97f4(0x25e)][_0x4b97f4(0x1f9)],_0x2bd32b[_0x4b97f4(0x25e)][_0x4b97f4(0x1f9)]=_0x29d0d5,this[_0x4b97f4(0x2b3)](_0x29d0d5,_0x2bd32b),_0x2711e7[_0x4b97f4(0x21b)]){for(_0x1dba03=0x0,_0x3094e6=_0x2711e7['length'];_0x1dba03<_0x3094e6;_0x1dba03++)_0x2711e7[_0x1dba03](_0x1dba03);}_0x1e409b['length']&&(_0x29d0d5[_0x4b97f4(0x276)]=_0x1e409b);}catch(_0x2e81d8){_0x3ed355(_0x2e81d8,_0x29d0d5,_0x2bd32b);}this['_additionalMetadata'](_0x2480b6,_0x29d0d5),this[_0x4b97f4(0x20f)](_0x29d0d5,_0x2bd32b),_0x2bd32b['node'][_0x4b97f4(0x1f9)]=_0x491fe1,_0x2bd32b[_0x4b97f4(0x25b)]--,_0x2bd32b[_0x4b97f4(0x26a)]=_0x595325,_0x2bd32b['autoExpand']&&_0x2bd32b['autoExpandPreviousObjects'][_0x4b97f4(0x27b)]();}finally{_0x527a1a&&(_0x9e8ba2['console'][_0x4b97f4(0x287)]=_0x527a1a);}return _0x29d0d5;}['_getOwnPropertySymbols'](_0x2fcff1){return Object['getOwnPropertySymbols']?Object['getOwnPropertySymbols'](_0x2fcff1):[];}['_isSet'](_0x5363f4){var _0x562cd3=_0x4ef3f0;return!!(_0x5363f4&&_0x9e8ba2[_0x562cd3(0x21e)]&&this[_0x562cd3(0x252)](_0x5363f4)===_0x562cd3(0x25d)&&_0x5363f4[_0x562cd3(0x2da)]);}['_blacklistedProperty'](_0x26b018,_0x125780,_0xee3c5b){var _0x1be27b=_0x4ef3f0;return _0xee3c5b[_0x1be27b(0x243)]?typeof _0x26b018[_0x125780]==_0x1be27b(0x2af):!0x1;}[_0x4ef3f0(0x2c7)](_0x562b0d){var _0x553735=_0x4ef3f0,_0x79ad02='';return _0x79ad02=typeof _0x562b0d,_0x79ad02===_0x553735(0x2b6)?this[_0x553735(0x252)](_0x562b0d)===_0x553735(0x25c)?_0x79ad02='array':this['_objectToString'](_0x562b0d)===_0x553735(0x2d4)?_0x79ad02='date':this['_objectToString'](_0x562b0d)==='[object\\x20BigInt]'?_0x79ad02=_0x553735(0x20c):_0x562b0d===null?_0x79ad02=_0x553735(0x2d2):_0x562b0d[_0x553735(0x1e0)]&&(_0x79ad02=_0x562b0d[_0x553735(0x1e0)][_0x553735(0x2d7)]||_0x79ad02):_0x79ad02==='undefined'&&this[_0x553735(0x28c)]&&_0x562b0d instanceof this[_0x553735(0x28c)]&&(_0x79ad02='HTMLAllCollection'),_0x79ad02;}[_0x4ef3f0(0x252)](_0x13a9c){var _0x19555c=_0x4ef3f0;return Object[_0x19555c(0x22c)][_0x19555c(0x2c9)][_0x19555c(0x231)](_0x13a9c);}[_0x4ef3f0(0x238)](_0x5275c9){var _0x202ca7=_0x4ef3f0;return _0x5275c9==='boolean'||_0x5275c9===_0x202ca7(0x21c)||_0x5275c9==='number';}[_0x4ef3f0(0x2b8)](_0x48b627){var _0x5ce49f=_0x4ef3f0;return _0x48b627===_0x5ce49f(0x281)||_0x48b627===_0x5ce49f(0x21a)||_0x48b627===_0x5ce49f(0x1de);}['_addProperty'](_0x43ed69,_0x43af0b,_0x33148a,_0x59a3e7,_0x317779,_0x5a7141){var _0x462714=this;return function(_0xc897cb){var _0x2f6d83=_0x4aba,_0x5a0564=_0x317779['node'][_0x2f6d83(0x1f9)],_0x2fd3a6=_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x2d5)],_0x462589=_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x20d)];_0x317779['node']['parent']=_0x5a0564,_0x317779[_0x2f6d83(0x25e)][_0x2f6d83(0x2d5)]=typeof _0x59a3e7=='number'?_0x59a3e7:_0xc897cb,_0x43ed69[_0x2f6d83(0x218)](_0x462714[_0x2f6d83(0x244)](_0x43af0b,_0x33148a,_0x59a3e7,_0x317779,_0x5a7141)),_0x317779['node']['parent']=_0x462589,_0x317779['node'][_0x2f6d83(0x2d5)]=_0x2fd3a6;};}['_addObjectProperty'](_0x520d40,_0x570cfe,_0x2420a3,_0xc2dd65,_0x1b4aec,_0xf68dca,_0x55d71b){var _0x110735=_0x4ef3f0,_0x1a0fa8=this;return _0x570cfe[_0x110735(0x2a1)+_0x1b4aec[_0x110735(0x2c9)]()]=!0x0,function(_0x51a890){var _0x2d7f46=_0x110735,_0x379210=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x1f9)],_0x1f7904=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x2d5)],_0x44f7b1=_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x20d)];_0xf68dca['node']['parent']=_0x379210,_0xf68dca['node']['index']=_0x51a890,_0x520d40[_0x2d7f46(0x218)](_0x1a0fa8[_0x2d7f46(0x244)](_0x2420a3,_0xc2dd65,_0x1b4aec,_0xf68dca,_0x55d71b)),_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x20d)]=_0x44f7b1,_0xf68dca[_0x2d7f46(0x25e)][_0x2d7f46(0x2d5)]=_0x1f7904;};}[_0x4ef3f0(0x244)](_0x33cfc9,_0x4d420b,_0x18378f,_0x319688,_0x52c52f){var _0x3a1cac=_0x4ef3f0,_0x523d91=this;_0x52c52f||(_0x52c52f=function(_0x335655,_0x2ea539){return _0x335655[_0x2ea539];});var _0x1130df=_0x18378f[_0x3a1cac(0x2c9)](),_0x20faa0=_0x319688[_0x3a1cac(0x2b4)]||{},_0x184abf=_0x319688[_0x3a1cac(0x205)],_0x26b283=_0x319688['isExpressionToEvaluate'];try{var _0x164b8b=this[_0x3a1cac(0x24c)](_0x33cfc9),_0xaa6cf=_0x1130df;_0x164b8b&&_0xaa6cf[0x0]==='\\x27'&&(_0xaa6cf=_0xaa6cf['substr'](0x1,_0xaa6cf[_0x3a1cac(0x21b)]-0x2));var _0x3ec3a1=_0x319688[_0x3a1cac(0x2b4)]=_0x20faa0[_0x3a1cac(0x2a1)+_0xaa6cf];_0x3ec3a1&&(_0x319688[_0x3a1cac(0x205)]=_0x319688[_0x3a1cac(0x205)]+0x1),_0x319688[_0x3a1cac(0x27f)]=!!_0x3ec3a1;var _0x5146b4=typeof _0x18378f==_0x3a1cac(0x206),_0xd9e04f={'name':_0x5146b4||_0x164b8b?_0x1130df:this[_0x3a1cac(0x1f7)](_0x1130df)};if(_0x5146b4&&(_0xd9e04f[_0x3a1cac(0x206)]=!0x0),!(_0x4d420b==='array'||_0x4d420b===_0x3a1cac(0x2bd))){var _0x35b3f9=this[_0x3a1cac(0x279)](_0x33cfc9,_0x18378f);if(_0x35b3f9&&(_0x35b3f9['set']&&(_0xd9e04f[_0x3a1cac(0x24f)]=!0x0),_0x35b3f9['get']&&!_0x3ec3a1&&!_0x319688[_0x3a1cac(0x2c2)]))return _0xd9e04f[_0x3a1cac(0x22d)]=!0x0,this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688),_0xd9e04f;}var _0x2f94bf;try{_0x2f94bf=_0x52c52f(_0x33cfc9,_0x18378f);}catch(_0x19c682){return _0xd9e04f={'name':_0x1130df,'type':_0x3a1cac(0x2d9),'error':_0x19c682[_0x3a1cac(0x228)]},this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688),_0xd9e04f;}var _0x1d5726=this[_0x3a1cac(0x2c7)](_0x2f94bf),_0x17c3f3=this[_0x3a1cac(0x238)](_0x1d5726);if(_0xd9e04f['type']=_0x1d5726,_0x17c3f3)this[_0x3a1cac(0x2b7)](_0xd9e04f,_0x319688,_0x2f94bf,function(){var _0x6124c1=_0x3a1cac;_0xd9e04f[_0x6124c1(0x2c0)]=_0x2f94bf[_0x6124c1(0x22a)](),!_0x3ec3a1&&_0x523d91[_0x6124c1(0x207)](_0x1d5726,_0xd9e04f,_0x319688,{});});else{var _0x1b6503=_0x319688[_0x3a1cac(0x26a)]&&_0x319688[_0x3a1cac(0x25b)]<_0x319688[_0x3a1cac(0x24b)]&&_0x319688[_0x3a1cac(0x2a2)][_0x3a1cac(0x1e4)](_0x2f94bf)<0x0&&_0x1d5726!==_0x3a1cac(0x2af)&&_0x319688[_0x3a1cac(0x28d)]<_0x319688[_0x3a1cac(0x2ce)];_0x1b6503||_0x319688[_0x3a1cac(0x25b)]<_0x184abf||_0x3ec3a1?(this['serialize'](_0xd9e04f,_0x2f94bf,_0x319688,_0x3ec3a1||{}),this[_0x3a1cac(0x29a)](_0x2f94bf,_0xd9e04f)):this['_processTreeNodeResult'](_0xd9e04f,_0x319688,_0x2f94bf,function(){var _0x18e776=_0x3a1cac;_0x1d5726==='null'||_0x1d5726===_0x18e776(0x278)||(delete _0xd9e04f[_0x18e776(0x2c0)],_0xd9e04f[_0x18e776(0x1ed)]=!0x0);});}return _0xd9e04f;}finally{_0x319688['expressionsToEvaluate']=_0x20faa0,_0x319688[_0x3a1cac(0x205)]=_0x184abf,_0x319688[_0x3a1cac(0x27f)]=_0x26b283;}}[_0x4ef3f0(0x207)](_0x246a66,_0x7005fb,_0x7622c0,_0x2c0e24){var _0x3cf6d1=_0x4ef3f0,_0x267611=_0x2c0e24[_0x3cf6d1(0x2d6)]||_0x7622c0[_0x3cf6d1(0x2d6)];if((_0x246a66===_0x3cf6d1(0x21c)||_0x246a66===_0x3cf6d1(0x21a))&&_0x7005fb['value']){let _0x3b4e0d=_0x7005fb[_0x3cf6d1(0x2c0)][_0x3cf6d1(0x21b)];_0x7622c0['allStrLength']+=_0x3b4e0d,_0x7622c0[_0x3cf6d1(0x217)]>_0x7622c0[_0x3cf6d1(0x225)]?(_0x7005fb[_0x3cf6d1(0x1ed)]='',delete _0x7005fb[_0x3cf6d1(0x2c0)]):_0x3b4e0d>_0x267611&&(_0x7005fb[_0x3cf6d1(0x1ed)]=_0x7005fb[_0x3cf6d1(0x2c0)][_0x3cf6d1(0x1eb)](0x0,_0x267611),delete _0x7005fb[_0x3cf6d1(0x2c0)]);}}[_0x4ef3f0(0x24c)](_0x4d8ec0){var _0x5c8b6d=_0x4ef3f0;return!!(_0x4d8ec0&&_0x9e8ba2[_0x5c8b6d(0x2d1)]&&this[_0x5c8b6d(0x252)](_0x4d8ec0)===_0x5c8b6d(0x1f2)&&_0x4d8ec0[_0x5c8b6d(0x2da)]);}['_propertyName'](_0x5e0b66){var _0xdd4e38=_0x4ef3f0;if(_0x5e0b66[_0xdd4e38(0x1ea)](/^\\d+$/))return _0x5e0b66;var _0xa19b6f;try{_0xa19b6f=JSON[_0xdd4e38(0x230)](''+_0x5e0b66);}catch{_0xa19b6f='\\x22'+this[_0xdd4e38(0x252)](_0x5e0b66)+'\\x22';}return _0xa19b6f['match'](/^\"([a-zA-Z_][a-zA-Z_0-9]*)\"$/)?_0xa19b6f=_0xa19b6f[_0xdd4e38(0x1eb)](0x1,_0xa19b6f[_0xdd4e38(0x21b)]-0x2):_0xa19b6f=_0xa19b6f[_0xdd4e38(0x282)](/'/g,'\\x5c\\x27')[_0xdd4e38(0x282)](/\\\\\"/g,'\\x22')[_0xdd4e38(0x282)](/(^\"|\"$)/g,'\\x27'),_0xa19b6f;}[_0x4ef3f0(0x2b7)](_0x2f611d,_0x141852,_0x1e7ce7,_0xc5064){var _0x451f1b=_0x4ef3f0;this[_0x451f1b(0x2b3)](_0x2f611d,_0x141852),_0xc5064&&_0xc5064(),this[_0x451f1b(0x29a)](_0x1e7ce7,_0x2f611d),this[_0x451f1b(0x20f)](_0x2f611d,_0x141852);}[_0x4ef3f0(0x2b3)](_0x4946c8,_0x2c3754){var _0x48ee19=_0x4ef3f0;this['_setNodeId'](_0x4946c8,_0x2c3754),this['_setNodeQueryPath'](_0x4946c8,_0x2c3754),this[_0x48ee19(0x29d)](_0x4946c8,_0x2c3754),this[_0x48ee19(0x2a5)](_0x4946c8,_0x2c3754);}[_0x4ef3f0(0x2bf)](_0x582a65,_0x3e3d7f){}[_0x4ef3f0(0x297)](_0x2f7b0c,_0x18089a){}[_0x4ef3f0(0x20b)](_0xb614d,_0x20943f){}[_0x4ef3f0(0x241)](_0x349402){var _0x3fa54a=_0x4ef3f0;return _0x349402===this[_0x3fa54a(0x28e)];}['_treeNodePropertiesAfterFullValue'](_0x28e4e6,_0x3feec9){var _0x336070=_0x4ef3f0;this[_0x336070(0x20b)](_0x28e4e6,_0x3feec9),this[_0x336070(0x201)](_0x28e4e6),_0x3feec9[_0x336070(0x1f3)]&&this[_0x336070(0x2a7)](_0x28e4e6),this[_0x336070(0x26f)](_0x28e4e6,_0x3feec9),this[_0x336070(0x2ad)](_0x28e4e6,_0x3feec9),this[_0x336070(0x285)](_0x28e4e6);}[_0x4ef3f0(0x29a)](_0x578184,_0x174a14){var _0xcccbe2=_0x4ef3f0;try{_0x578184&&typeof _0x578184[_0xcccbe2(0x21b)]==_0xcccbe2(0x28a)&&(_0x174a14['length']=_0x578184[_0xcccbe2(0x21b)]);}catch{}if(_0x174a14[_0xcccbe2(0x23e)]===_0xcccbe2(0x28a)||_0x174a14[_0xcccbe2(0x23e)]==='Number'){if(isNaN(_0x174a14['value']))_0x174a14[_0xcccbe2(0x2b2)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];else switch(_0x174a14[_0xcccbe2(0x2c0)]){case Number['POSITIVE_INFINITY']:_0x174a14[_0xcccbe2(0x1fa)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];break;case Number[_0xcccbe2(0x1ef)]:_0x174a14[_0xcccbe2(0x24d)]=!0x0,delete _0x174a14[_0xcccbe2(0x2c0)];break;case 0x0:this['_isNegativeZero'](_0x174a14[_0xcccbe2(0x2c0)])&&(_0x174a14['negativeZero']=!0x0);break;}}else _0x174a14[_0xcccbe2(0x23e)]===_0xcccbe2(0x2af)&&typeof _0x578184[_0xcccbe2(0x2d7)]==_0xcccbe2(0x21c)&&_0x578184[_0xcccbe2(0x2d7)]&&_0x174a14[_0xcccbe2(0x2d7)]&&_0x578184[_0xcccbe2(0x2d7)]!==_0x174a14['name']&&(_0x174a14[_0xcccbe2(0x253)]=_0x578184[_0xcccbe2(0x2d7)]);}['_isNegativeZero'](_0x1c8afb){var _0x10332e=_0x4ef3f0;return 0x1/_0x1c8afb===Number[_0x10332e(0x1ef)];}[_0x4ef3f0(0x2a7)](_0x166a0c){var _0x27c448=_0x4ef3f0;!_0x166a0c[_0x27c448(0x276)]||!_0x166a0c['props']['length']||_0x166a0c[_0x27c448(0x23e)]===_0x27c448(0x28f)||_0x166a0c[_0x27c448(0x23e)]==='Map'||_0x166a0c[_0x27c448(0x23e)]==='Set'||_0x166a0c[_0x27c448(0x276)][_0x27c448(0x20e)](function(_0x5c2cb6,_0x165930){var _0xfed0ed=_0x27c448,_0x5712c9=_0x5c2cb6[_0xfed0ed(0x2d7)][_0xfed0ed(0x1ec)](),_0x2df8b7=_0x165930[_0xfed0ed(0x2d7)][_0xfed0ed(0x1ec)]();return _0x5712c9<_0x2df8b7?-0x1:_0x5712c9>_0x2df8b7?0x1:0x0;});}[_0x4ef3f0(0x26f)](_0x123b9c,_0x5a8b0f){var _0xf631bb=_0x4ef3f0;if(!(_0x5a8b0f[_0xf631bb(0x243)]||!_0x123b9c['props']||!_0x123b9c[_0xf631bb(0x276)][_0xf631bb(0x21b)])){for(var _0x14b6f1=[],_0x3382a2=[],_0x513206=0x0,_0x188c9a=_0x123b9c[_0xf631bb(0x276)]['length'];_0x513206<_0x188c9a;_0x513206++){var _0x533e59=_0x123b9c[_0xf631bb(0x276)][_0x513206];_0x533e59['type']==='function'?_0x14b6f1[_0xf631bb(0x218)](_0x533e59):_0x3382a2['push'](_0x533e59);}if(!(!_0x3382a2[_0xf631bb(0x21b)]||_0x14b6f1['length']<=0x1)){_0x123b9c[_0xf631bb(0x276)]=_0x3382a2;var _0x2577ff={'functionsNode':!0x0,'props':_0x14b6f1};this[_0xf631bb(0x2bf)](_0x2577ff,_0x5a8b0f),this[_0xf631bb(0x20b)](_0x2577ff,_0x5a8b0f),this[_0xf631bb(0x201)](_0x2577ff),this['_setNodePermissions'](_0x2577ff,_0x5a8b0f),_0x2577ff['id']+='\\x20f',_0x123b9c['props'][_0xf631bb(0x24a)](_0x2577ff);}}}[_0x4ef3f0(0x2ad)](_0x1d7997,_0x52a427){}[_0x4ef3f0(0x201)](_0x445202){}[_0x4ef3f0(0x23d)](_0x4d1986){var _0x200d2a=_0x4ef3f0;return Array[_0x200d2a(0x1df)](_0x4d1986)||typeof _0x4d1986=='object'&&this[_0x200d2a(0x252)](_0x4d1986)===_0x200d2a(0x25c);}['_setNodePermissions'](_0x149508,_0x29eafe){}[_0x4ef3f0(0x285)](_0x79c8d1){var _0x27c883=_0x4ef3f0;delete _0x79c8d1[_0x27c883(0x1e8)],delete _0x79c8d1[_0x27c883(0x1ff)],delete _0x79c8d1[_0x27c883(0x2bb)];}[_0x4ef3f0(0x29d)](_0x434db9,_0x1a27d6){}}let _0x3acf77=new _0x53cb52(),_0x3f9944={'props':0x64,'elements':0x64,'strLength':0x400*0x32,'totalStrLength':0x400*0x32,'autoExpandLimit':0x1388,'autoExpandMaxDepth':0xa},_0x158b85={'props':0x5,'elements':0x5,'strLength':0x100,'totalStrLength':0x100*0x3,'autoExpandLimit':0x1e,'autoExpandMaxDepth':0x2};function _0x592f4f(_0x223f0c,_0x54589,_0x1136d9,_0x1d6964,_0x5bef40,_0x59669e){var _0x45be8f=_0x4ef3f0;let _0x37574a,_0x2f3c34;try{_0x2f3c34=_0x24af88(),_0x37574a=_0x51107c[_0x54589],!_0x37574a||_0x2f3c34-_0x37574a['ts']>0x1f4&&_0x37574a[_0x45be8f(0x268)]&&_0x37574a['time']/_0x37574a[_0x45be8f(0x268)]<0x64?(_0x51107c[_0x54589]=_0x37574a={'count':0x0,'time':0x0,'ts':_0x2f3c34},_0x51107c[_0x45be8f(0x27a)]={}):_0x2f3c34-_0x51107c['hits']['ts']>0x32&&_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]&&_0x51107c[_0x45be8f(0x27a)]['time']/_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]<0x64&&(_0x51107c['hits']={});let _0x5e7590=[],_0x303aff=_0x37574a[_0x45be8f(0x29b)]||_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x29b)]?_0x158b85:_0x3f9944,_0x5cd473=_0x4d6a9d=>{var _0x427700=_0x45be8f;let _0x422e30={};return _0x422e30[_0x427700(0x276)]=_0x4d6a9d[_0x427700(0x276)],_0x422e30['elements']=_0x4d6a9d[_0x427700(0x203)],_0x422e30[_0x427700(0x2d6)]=_0x4d6a9d['strLength'],_0x422e30['totalStrLength']=_0x4d6a9d[_0x427700(0x225)],_0x422e30[_0x427700(0x2ce)]=_0x4d6a9d[_0x427700(0x2ce)],_0x422e30['autoExpandMaxDepth']=_0x4d6a9d[_0x427700(0x24b)],_0x422e30[_0x427700(0x1f3)]=!0x1,_0x422e30[_0x427700(0x243)]=!_0x334f71,_0x422e30[_0x427700(0x205)]=0x1,_0x422e30[_0x427700(0x25b)]=0x0,_0x422e30[_0x427700(0x254)]='root_exp_id',_0x422e30[_0x427700(0x236)]='root_exp',_0x422e30[_0x427700(0x26a)]=!0x0,_0x422e30[_0x427700(0x2a2)]=[],_0x422e30[_0x427700(0x28d)]=0x0,_0x422e30[_0x427700(0x2c2)]=!0x0,_0x422e30['allStrLength']=0x0,_0x422e30['node']={'current':void 0x0,'parent':void 0x0,'index':0x0},_0x422e30;};for(var _0x2ce81c=0x0;_0x2ce81c<_0x5bef40[_0x45be8f(0x21b)];_0x2ce81c++)_0x5e7590[_0x45be8f(0x218)](_0x3acf77[_0x45be8f(0x299)]({'timeNode':_0x223f0c===_0x45be8f(0x200)||void 0x0},_0x5bef40[_0x2ce81c],_0x5cd473(_0x303aff),{}));if(_0x223f0c==='trace'||_0x223f0c==='error'){let _0x1ab583=Error[_0x45be8f(0x2c6)];try{Error[_0x45be8f(0x2c6)]=0x1/0x0,_0x5e7590[_0x45be8f(0x218)](_0x3acf77['serialize']({'stackNode':!0x0},new Error()[_0x45be8f(0x22f)],_0x5cd473(_0x303aff),{'strLength':0x1/0x0}));}finally{Error[_0x45be8f(0x2c6)]=_0x1ab583;}}return{'method':'log','version':_0x4066ae,'args':[{'ts':_0x1136d9,'session':_0x1d6964,'args':_0x5e7590,'id':_0x54589,'context':_0x59669e}]};}catch(_0xc08614){return{'method':_0x45be8f(0x298),'version':_0x4066ae,'args':[{'ts':_0x1136d9,'session':_0x1d6964,'args':[{'type':'unknown','error':_0xc08614&&_0xc08614[_0x45be8f(0x228)]}],'id':_0x54589,'context':_0x59669e}]};}finally{try{if(_0x37574a&&_0x2f3c34){let _0x47e2fd=_0x24af88();_0x37574a[_0x45be8f(0x268)]++,_0x37574a[_0x45be8f(0x200)]+=_0x4acda3(_0x2f3c34,_0x47e2fd),_0x37574a['ts']=_0x47e2fd,_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]++,_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x200)]+=_0x4acda3(_0x2f3c34,_0x47e2fd),_0x51107c[_0x45be8f(0x27a)]['ts']=_0x47e2fd,(_0x37574a[_0x45be8f(0x268)]>0x32||_0x37574a[_0x45be8f(0x200)]>0x64)&&(_0x37574a[_0x45be8f(0x29b)]=!0x0),(_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x268)]>0x3e8||_0x51107c[_0x45be8f(0x27a)][_0x45be8f(0x200)]>0x12c)&&(_0x51107c['hits'][_0x45be8f(0x29b)]=!0x0);}}catch{}}}return _0x592f4f;}((_0x1d4663,_0x5790be,_0x591588,_0x59fd35,_0x1f79cd,_0x3c6a0d,_0x2a6eb4,_0x482905,_0x5dd233,_0x300997,_0x40824a)=>{var _0x2bff8a=_0xf42111;if(_0x1d4663[_0x2bff8a(0x2db)])return _0x1d4663[_0x2bff8a(0x2db)];if(!X(_0x1d4663,_0x482905,_0x1f79cd))return _0x1d4663[_0x2bff8a(0x2db)]={'consoleLog':()=>{},'consoleTrace':()=>{},'consoleTime':()=>{},'consoleTimeEnd':()=>{},'autoLog':()=>{},'autoLogMany':()=>{},'autoTraceMany':()=>{},'coverage':()=>{},'autoTrace':()=>{},'autoTime':()=>{},'autoTimeEnd':()=>{}},_0x1d4663['_console_ninja'];let _0x2ab37c=B(_0x1d4663),_0x5089e9=_0x2ab37c[_0x2bff8a(0x2b9)],_0x24eda4=_0x2ab37c[_0x2bff8a(0x1f8)],_0x177676=_0x2ab37c['now'],_0x34ecbc={'hits':{},'ts':{}},_0x2f6e8a=J(_0x1d4663,_0x5dd233,_0x34ecbc,_0x3c6a0d),_0x5c844f=_0x41f245=>{_0x34ecbc['ts'][_0x41f245]=_0x24eda4();},_0x549ae4=(_0x53c32b,_0x32d193)=>{var _0xb017ca=_0x2bff8a;let _0x4ed5f6=_0x34ecbc['ts'][_0x32d193];if(delete _0x34ecbc['ts'][_0x32d193],_0x4ed5f6){let _0x4fc230=_0x5089e9(_0x4ed5f6,_0x24eda4());_0x1d2fe7(_0x2f6e8a(_0xb017ca(0x200),_0x53c32b,_0x177676(),_0x4f8767,[_0x4fc230],_0x32d193));}},_0x7ca32b=_0x5298a2=>{var _0x85a531=_0x2bff8a,_0x12eff1;return _0x1f79cd===_0x85a531(0x29e)&&_0x1d4663[_0x85a531(0x20a)]&&((_0x12eff1=_0x5298a2==null?void 0x0:_0x5298a2['args'])==null?void 0x0:_0x12eff1[_0x85a531(0x21b)])&&(_0x5298a2[_0x85a531(0x223)][0x0][_0x85a531(0x20a)]=_0x1d4663[_0x85a531(0x20a)]),_0x5298a2;};_0x1d4663[_0x2bff8a(0x2db)]={'consoleLog':(_0x39118b,_0x3cc253)=>{var _0x463333=_0x2bff8a;_0x1d4663[_0x463333(0x2ab)][_0x463333(0x298)]['name']!=='disabledLog'&&_0x1d2fe7(_0x2f6e8a(_0x463333(0x298),_0x39118b,_0x177676(),_0x4f8767,_0x3cc253));},'consoleTrace':(_0xbd86d1,_0x59bc4f)=>{var _0x2b716f=_0x2bff8a,_0xdf1d72,_0x57fed4;_0x1d4663[_0x2b716f(0x2ab)][_0x2b716f(0x298)]['name']!==_0x2b716f(0x245)&&((_0x57fed4=(_0xdf1d72=_0x1d4663[_0x2b716f(0x261)])==null?void 0x0:_0xdf1d72[_0x2b716f(0x288)])!=null&&_0x57fed4[_0x2b716f(0x25e)]&&(_0x1d4663['_ninjaIgnoreNextError']=!0x0),_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x2b716f(0x250),_0xbd86d1,_0x177676(),_0x4f8767,_0x59bc4f))));},'consoleError':(_0x146478,_0x4b8f11)=>{var _0x3255ce=_0x2bff8a;_0x1d4663[_0x3255ce(0x257)]=!0x0,_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x3255ce(0x287),_0x146478,_0x177676(),_0x4f8767,_0x4b8f11)));},'consoleTime':_0x205fad=>{_0x5c844f(_0x205fad);},'consoleTimeEnd':(_0x3a184f,_0x3a07f4)=>{_0x549ae4(_0x3a07f4,_0x3a184f);},'autoLog':(_0x32a379,_0xd1b917)=>{var _0x7eb520=_0x2bff8a;_0x1d2fe7(_0x2f6e8a(_0x7eb520(0x298),_0xd1b917,_0x177676(),_0x4f8767,[_0x32a379]));},'autoLogMany':(_0x58ad40,_0x5eab6f)=>{var _0x2b94ae=_0x2bff8a;_0x1d2fe7(_0x2f6e8a(_0x2b94ae(0x298),_0x58ad40,_0x177676(),_0x4f8767,_0x5eab6f));},'autoTrace':(_0x5b1a6b,_0x276055)=>{var _0xbfa21a=_0x2bff8a;_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0xbfa21a(0x250),_0x276055,_0x177676(),_0x4f8767,[_0x5b1a6b])));},'autoTraceMany':(_0x584f66,_0x1572d9)=>{var _0x5e3c7c=_0x2bff8a;_0x1d2fe7(_0x7ca32b(_0x2f6e8a(_0x5e3c7c(0x250),_0x584f66,_0x177676(),_0x4f8767,_0x1572d9)));},'autoTime':(_0x957eeb,_0x4863a8,_0x5a8f3b)=>{_0x5c844f(_0x5a8f3b);},'autoTimeEnd':(_0x49ce61,_0x2d878a,_0x368c47)=>{_0x549ae4(_0x2d878a,_0x368c47);},'coverage':_0x508391=>{_0x1d2fe7({'method':'coverage','version':_0x3c6a0d,'args':[{'id':_0x508391}]});}};let _0x1d2fe7=H(_0x1d4663,_0x5790be,_0x591588,_0x59fd35,_0x1f79cd,_0x300997,_0x40824a),_0x4f8767=_0x1d4663[_0x2bff8a(0x2c5)];return _0x1d4663[_0x2bff8a(0x2db)];})(globalThis,'127.0.0.1',_0xf42111(0x2cd),_0xf42111(0x21f),_0xf42111(0x23b),'1.0.0',_0xf42111(0x25a),[\"localhost\",\"127.0.0.1\",\"example.cypress.io\",\"MacBook-Pro-3.local\",\"192.168.50.116\"],_0xf42111(0x22b),_0xf42111(0x275),_0xf42111(0x1ee));");}catch(e){}};/* istanbul ignore next */function oo_oo(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleLog(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_tr(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleTrace(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_tx(/**@type{any}**/i,/**@type{any}**/...v){try{oo_cm().consoleError(i, v);}catch(e){} return v};/* istanbul ignore next */function oo_ts(/**@type{any}**/v){try{oo_cm().consoleTime(v);}catch(e){} return v;};/* istanbul ignore next */function oo_te(/**@type{any}**/v, /**@type{any}**/i){try{oo_cm().consoleTimeEnd(v, i);}catch(e){} return v;};/*eslint unicorn/no-abusive-eslint-disable:,eslint-comments/disable-enable-pair:,eslint-comments/no-unlimited-disable:,eslint-comments/no-aggregating-enable:,eslint-comments/no-duplicate-disable:,eslint-comments/no-unused-disable:,eslint-comments/no-unused-enable:,*/