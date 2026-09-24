'use strict';

goog.provide('Blockly.IntersectionObserver');

Blockly.IntersectionObserver = function(workspace) {
  this.workspace = workspace;
  this.observing = [];
  /**
   * Observed blocks whose position or size changed since the last check. When
   * the viewport itself has not moved, only these need a new hit test.
   * @type {!Array.<!Blockly.BlockSvg>}
   * @private
   */
  this.dirty_ = [];
  this.viewportKey_ = '';
  this.intersectionCheckQueued = false;
  this.checkForIntersections = this.checkForIntersections.bind(this);
};

Blockly.IntersectionObserver.prototype.observe = function(block) {
  if (!block.intersectionObserved_) {
    block.intersectionObserved_ = true;
    this.observing.push(block);
  }
  this.markDirty(block);
};

Blockly.IntersectionObserver.prototype.unobserve = function(block) {
  if (!block.intersectionObserved_) {
    return;
  }
  block.intersectionObserved_ = false;
  var index = this.observing.indexOf(block);
  if (index !== -1) {
    this.observing.splice(index, 1);
  }
};

/**
 * Note that a block moved or was resized, so its visibility needs another look
 * even if the viewport stays where it is.
 * @param {!Blockly.BlockSvg} block The block.
 */
Blockly.IntersectionObserver.prototype.markDirty = function(block) {
  if (block.intersectionObserved_ && !block.intersectionDirty_) {
    block.intersectionDirty_ = true;
    this.dirty_.push(block);
  }
};

/**
 * Stop observing everything at once. Disposing blocks one at a time would be
 * quadratic, so workspace.clear() calls this instead.
 */
Blockly.IntersectionObserver.prototype.unobserveAll = function() {
  for (var i = 0; i < this.observing.length; i++) {
    this.observing[i].intersectionObserved_ = false;
  }
  this.observing.length = 0;
  this.clearDirty_();
};

Blockly.IntersectionObserver.prototype.clearDirty_ = function() {
  for (var i = 0; i < this.dirty_.length; i++) {
    this.dirty_[i].intersectionDirty_ = false;
  }
  this.dirty_.length = 0;
};

Blockly.IntersectionObserver.prototype.dispose = function() {
  this.unobserveAll();
  this.workspace = null;
};

Blockly.IntersectionObserver.prototype.queueIntersectionCheck = function() {
  if (this.intersectionCheckQueued) {
    return;
  }
  this.intersectionCheckQueued = true;
  // Check for intersections on the next microtick
  // Prefer to use the native method when available, otherwise fallback to a Promise-based polyfill
  if (window.queueMicrotask) {
    window.queueMicrotask(this.checkForIntersections);
  } else {
    // eslint-disable-next-line no-undef
    Promise.resolve().then(this.checkForIntersections);
  }
};

Blockly.IntersectionObserver.prototype.checkForIntersections = function() {
  this.intersectionCheckQueued = false;

  if (!this.workspace) {
    return;
  }

  var workspace = this.workspace;
  var workspaceScale = workspace.scale;
  var RTL = workspace.RTL;
  var workspaceHeight = workspace.getParentSvg().height.baseVal.value;
  var workspaceWidth = workspace.getParentSvg().width.baseVal.value;
  if (workspace.isDragSurfaceActive_) {
    var canvasPos = Blockly.utils.getRelativeXY(workspace.workspaceDragSurface_.SVG_);
  } else {
    var canvasPos = Blockly.utils.getRelativeXY(workspace.getCanvas());
  }

  // Only blocks that moved need a new hit test while the viewport stays put.
  var viewportKey = canvasPos.x + ',' + canvasPos.y + ',' + workspaceScale + ',' +
      workspaceWidth + ',' + workspaceHeight + ',' + RTL;
  var blocks;
  if (viewportKey === this.viewportKey_) {
    if (!this.dirty_.length) {
      return;
    }
    blocks = this.dirty_.slice();
  } else {
    this.viewportKey_ = viewportKey;
    blocks = this.observing;
  }
  this.clearDirty_();

  // Allow blocks to go slightly offscreen so that effects such as glow do not get cut off.
  var margin = 12 * workspaceScale;

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (!block.intersectionObserved_ || !block.rendered) {
      // Size is unknown until the block renders, so any hit test would be
      // wrong. Rendering re-queues a check.
      continue;
    }
    var blockPos = block.getRelativeToSurfaceXY();
    var scaledPosX = blockPos.x * workspaceScale;
    var canvasPlusY = canvasPos.y + blockPos.y * workspaceScale;
    var visible;
    if (canvasPlusY - margin > workspaceHeight ||
        (!RTL && canvasPos.x + scaledPosX - margin > workspaceWidth)) {
      visible = false;
    } else {
      var blockSize = block.getHeightWidth();
      var scaledBlockWidth = blockSize.width * workspaceScale;
      if (RTL) {
        scaledPosX -= scaledBlockWidth;
      }
      var canvasPlusX = canvasPos.x + scaledPosX;
      visible = !(
        canvasPlusX - margin > workspaceWidth ||
        canvasPlusX + scaledBlockWidth + margin < 0 ||
        canvasPlusY + blockSize.height * workspaceScale + margin < 0
      );
    }

    block.setIntersects(visible);
  }
};
