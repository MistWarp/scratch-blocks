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
/**
 * Blocks of a visible script that lie further than this many viewports from the
 * view draw nothing of their own. Their groups stay in the tree so the blocks
 * inside and after them keep their positions.
 */
Blockly.IntersectionObserver.CULL_MARGIN = 0.5;

/**
 * Whether within-script culling is on. Off leaves every block of a visible
 * script drawn.
 */
Blockly.IntersectionObserver.CULL_ENABLED = true;

/**
 * Hide or show what a block draws of itself: its path, fields and icons, but
 * not the blocks inside it or after it, which have their own state. Inline
 * styles keep the change local to those elements; hiding a block's whole group
 * would detach and reattach everything nested in it each time the edge of the
 * view passed it.
 * @param {!Blockly.BlockSvg} block The block.
 * @param {boolean} hidden Whether to hide the block's own drawing.
 * @private
 */
Blockly.IntersectionObserver.prototype.setOwnHidden_ = function(block, hidden) {
  var root = block.getSvgRoot();
  if (!root) {
    return;
  }
  block.culledOwn_ = hidden;
  for (var child = root.firstElementChild; child; child = child.nextElementSibling) {
    if (child.hasAttribute('data-id')) {
      continue;
    }
    if (hidden) {
      if (child.culledDisplay_ === undefined) {
        child.culledDisplay_ = child.style.display;
        child.style.display = 'none';
      }
    } else if (child.culledDisplay_ !== undefined) {
      child.style.display = child.culledDisplay_;
      child.culledDisplay_ = undefined;
    }
  }
};

/**
 * Show every block of a script again, including any outside the view. Call
 * before a script is dragged, exported or otherwise needed whole.
 * @param {!Blockly.BlockSvg} block Root of the subtree to show.
 */
Blockly.IntersectionObserver.prototype.uncull = function(block) {
  var stack = [block];
  while (stack.length) {
    var current = stack.pop();
    if (current.culledOwn_) {
      this.setOwnHidden_(current, false);
    }
    var children = current.childBlocks_;
    for (var i = 0; children && i < children.length; i++) {
      stack.push(children[i]);
    }
  }
};

/**
 * Show every block on the workspace again.
 */
Blockly.IntersectionObserver.prototype.uncullAll = function() {
  for (var i = 0; i < this.observing.length; i++) {
    this.uncull(this.observing[i]);
  }
};

/**
 * Hide the drawing of every block of a visible script that is outside the view.
 * @param {!Blockly.BlockSvg} top The script's top block.
 * @param {!Object} view Visible area in workspace units, with the margin.
 * @private
 */
Blockly.IntersectionObserver.prototype.cullStack_ = function(top, view) {
  var origin = top.getRelativeToSurfaceXY();
  var stack = [{block: top, x: origin.x, y: origin.y}];
  while (stack.length) {
    var item = stack.pop();
    var block = item.block;
    if (!block.rendered) {
      continue;
    }
    var x = item.x;
    var y = item.y;
    var outside = y > view.bottom || x > view.right ||
        y + block.height < view.top || x + block.width < view.left;
    if (outside !== !!block.culledOwn_) {
      this.setOwnHidden_(block, outside);
    }
    var children = block.childBlocks_;
    for (var i = 0; children && i < children.length; i++) {
      var child = children[i];
      var childRoot = child.getSvgRoot();
      if (!childRoot) {
        continue;
      }
      var xy = Blockly.utils.getRelativeXY(childRoot);
      stack.push({block: child, x: x + xy.x, y: y + xy.y});
    }
  }
};

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

  var cullView = null;
  if (Blockly.IntersectionObserver.CULL_ENABLED && !RTL && workspaceScale > 0) {
    var viewLeft = -canvasPos.x / workspaceScale;
    var viewTop = -canvasPos.y / workspaceScale;
    var viewWidth = workspaceWidth / workspaceScale;
    var viewHeight = workspaceHeight / workspaceScale;
    var cullMargin = Blockly.IntersectionObserver.CULL_MARGIN;
    cullView = {
      left: viewLeft - viewWidth * cullMargin,
      top: viewTop - viewHeight * cullMargin,
      right: viewLeft + viewWidth * (1 + cullMargin),
      bottom: viewTop + viewHeight * (1 + cullMargin)
    };
  }

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
    if (visible && cullView) {
      this.cullStack_(block, cullView);
    }
  }
};
