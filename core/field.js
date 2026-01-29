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
 * @fileoverview Field.  Used for editable titles, variables, etc.
 * This is an abstract class that defines the UI on the block.  Actual
 * instances would be Blockly.FieldTextInput, Blockly.FieldDropdown, etc.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Field');

goog.require('Blockly.Events.BlockChange');
goog.require('Blockly.Gesture');

goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.math.Size');
goog.require('goog.style');
goog.require('goog.userAgent');


/**
 * Abstract class for an editable field.
 * @param {string} text The initial content of the field.
 * @param {Function=} opt_validator An optional function that is called
 *     to validate any constraints on what the user entered.  Takes the new
 *     text as an argument and returns either the accepted text, a replacement
 *     text, or null to abort the change.
 * @constructor
 */
Blockly.Field = function(text, opt_validator) {
  this.size_ = new goog.math.Size(
      Blockly.BlockSvg.FIELD_WIDTH,
      Blockly.BlockSvg.FIELD_HEIGHT);
  this.setValue(text);
  this.setValidator(opt_validator);

  /**
   * Maximum characters of text to display before adding an ellipsis.
   * Same for strings and numbers.
   * @type {number}
   */
  this.maxDisplayLength = Blockly.BlockSvg.MAX_DISPLAY_LENGTH;
};


/**
 * The set of all registered fields, keyed by field type as used in the JSON
 * definition of a block.
 * @type {!Object<string, !{fromJson: Function}>}
 * @private
 */
Blockly.Field.TYPE_MAP_ = {};

/**
 * Registers a field type. May also override an existing field type.
 * Blockly.Field.fromJson uses this registry to find the appropriate field.
 * @param {!string} type The field type name as used in the JSON definition.
 * @param {!{fromJson: Function}} fieldClass The field class containing a
 *     fromJson function that can construct an instance of the field.
 * @throws {Error} if the type name is empty, or the fieldClass is not an
 *     object containing a fromJson function.
 */
Blockly.Field.register = function(type, fieldClass) {
  if (!goog.isString(type) || goog.string.isEmptyOrWhitespace(type)) {
    throw new Error('Invalid field type "' + type + '"');
  }
  if (!goog.isObject(fieldClass) || !goog.isFunction(fieldClass.fromJson)) {
    throw new Error('Field "' + fieldClass +
        '" must have a fromJson function');
  }
  Blockly.Field.TYPE_MAP_[type] = fieldClass;
};

/**
 * Construct a Field from a JSON arg object.
 * Finds the appropriate registered field by the type name as registered using
 * Blockly.Field.register.
 * @param {!Object} options A JSON object with a type and options specific
 *     to the field type.
 * @returns {?Blockly.Field} The new field instance or null if a field wasn't
 *     found with the given type name
 * @package
 */
Blockly.Field.fromJson = function(options) {
  var fieldClass = Blockly.Field.TYPE_MAP_[options['type']];
  if (fieldClass) {
    return fieldClass.fromJson(options);
  }
  return null;
};

/**
 * Temporary cache of text widths.
 * @type {Object}
 * @private
 */
Blockly.Field.cacheWidths_ = null;

/**
 * Number of current references to cache.
 * @type {number}
 * @private
 */
Blockly.Field.cacheReference_ = 0;


/**
 * Name of field.  Unique within each block.
 * Static labels are usually unnamed.
 * @type {string|undefined}
 */
Blockly.Field.prototype.name = undefined;

/**
 * CSS class name for the text element.
 * @type {string}
 * @package
 */
Blockly.Field.prototype.className_ = 'blocklyText';

/**
 * Visible text to display.
 * @type {string}
 * @private
 */
Blockly.Field.prototype.text_ = '';

/**
 * Block this field is attached to.  Starts as null, then in set in init.
 * @type {Blockly.Block}
 * @private
 */
Blockly.Field.prototype.sourceBlock_ = null;

/**
 * Is the field visible, or hidden due to the block being collapsed?
 * @type {boolean}
 * @private
 */
Blockly.Field.prototype.visible_ = true;

/**
 * Null, or an array of the field's argTypes (for styling).
 * @type {Array}
 * @private
 */
Blockly.Field.prototype.argType_ = null;

/**
 * Validation function called when user edits an editable field.
 * @type {Function}
 * @private
 */
Blockly.Field.prototype.validator_ = null;

/**
 * Whether to assume user is using a touch device for interactions.
 * Used to show different UI for touch interactions, e.g.
 * @type {boolean}
 * @private
 */
Blockly.Field.prototype.useTouchInteraction_ = false;

/**
 * Non-breaking space.
 * @const
 */
Blockly.Field.NBSP = '\u00A0';

/**
 * Text offset used for IE/Edge.
 * @const
 */
Blockly.Field.IE_TEXT_OFFSET = '0.3em';

/**
 * Editable fields usually show some sort of UI for the user to change them.
 * @type {boolean}
 * @public
 */
Blockly.Field.prototype.EDITABLE = true;

/**
 * Serializable fields are saved by the XML renderer, non-serializable fields
 * are not.  Editable fields should be serialized.
 * @type {boolean}
 * @public
 */
Blockly.Field.prototype.SERIALIZABLE = true;

/**
 * Attach this field to a block.
 * @param {!Blockly.Block} block The block containing this field.
 */
Blockly.Field.prototype.setSourceBlock = function(block) {
  goog.asserts.assert(!this.sourceBlock_, 'Field already bound to a block.');
  this.sourceBlock_ = block;
};

/**
 * Install this field on a block.
 */
Blockly.Field.prototype.init = function() {
  if (this.fieldGroup_) {
    // Field has already been initialized once.
    return;
  }
  // Build the DOM.
  this.fieldGroup_ = Blockly.utils.createSvgElement('g', {}, null);
  if (!this.visible_) {
    this.fieldGroup_.style.display = 'none';
  }
  // Add an attribute to cassify the type of field.
  if (this.getArgTypes() !== null) {
    if (this.sourceBlock_.isShadow()) {
      this.sourceBlock_.svgGroup_.setAttribute('data-argument-type',
          this.getArgTypes());
    } else {
      // Fields without a shadow wrapper, like square dropdowns.
      this.fieldGroup_.setAttribute('data-argument-type', this.getArgTypes());
    }
  }
  // Adjust X to be flipped for RTL. Position is relative to horizontal start of source block.
  var size = this.getSize();
  var fieldX = (this.sourceBlock_.RTL) ? -size.width / 2 : size.width / 2;
  /** @type {!Element} */
  this.textElement_ = Blockly.utils.createSvgElement('text',
      {
        'class': this.className_,
        'x': fieldX,
        'y': size.height / 2 + Blockly.BlockSvg.FIELD_TOP_PADDING,
        'dominant-baseline': 'middle',
        'dy': goog.userAgent.EDGE_OR_IE ? Blockly.Field.IE_TEXT_OFFSET : '0',
        'text-anchor': 'middle'
      }, this.fieldGroup_);

  this.updateEditable();
  this.sourceBlock_.getSvgRoot().appendChild(this.fieldGroup_);
  // Force a render.
  this.render_();
  this.size_.width = 0;
  this.mouseDownWrapper_ = Blockly.bindEventWithChecks_(
      this.getClickTarget_(), 'mousedown', this, this.onMouseDown_);
};

/**
 * Initializes the model of the field after it has been installed on a block.
 * No-op by default.
 */
Blockly.Field.prototype.initModel = function() {
};

/**
 * Dispose of all DOM objects belonging to this editable field.
 */
Blockly.Field.prototype.dispose = function() {
  if (this.mouseDownWrapper_) {
    Blockly.unbindEvent_(this.mouseDownWrapper_);
    this.mouseDownWrapper_ = null;
  }
  this.sourceBlock_ = null;
  goog.dom.removeNode(this.fieldGroup_);
  this.fieldGroup_ = null;
  this.textElement_ = null;
  this.validator_ = null;
};

/**
 * Add or remove the UI indicating if this field is editable or not.
 */
Blockly.Field.prototype.updateEditable = function() {
  var group = this.fieldGroup_;
  if (!this.EDITABLE || !group) {
    return;
  }
  if (this.sourceBlock_.isEditable()) {
    Blockly.utils.addClass(group, 'blocklyEditableText');
    Blockly.utils.removeClass(group, 'blocklyNonEditableText');
    this.getClickTarget_().style.cursor = this.CURSOR;
  } else {
    Blockly.utils.addClass(group, 'blocklyNonEditableText');
    Blockly.utils.removeClass(group, 'blocklyEditableText');
    this.getClickTarget_().style.cursor = '';
  }
};

/**
 * Check whether this field is currently editable.  Some fields are never
 * editable (e.g. text labels).  Those fields are not serialized to XML.  Other
 * fields may be editable, and therefore serialized, but may exist on
 * non-editable blocks.
 * @return {boolean} whether this field is editable and on an editable block
 */
Blockly.Field.prototype.isCurrentlyEditable = function() {
  return this.EDITABLE && !!this.sourceBlock_ && this.sourceBlock_.isEditable();
};

/**
 * Gets whether this editable field is visible or not.
 * @return {boolean} True if visible.
 */
Blockly.Field.prototype.isVisible = function() {
  return this.visible_;
};

/**
 * Sets whether this editable field is visible or not.
 * @param {boolean} visible True if visible.
 */
Blockly.Field.prototype.setVisible = function(visible) {
  if (this.visible_ == visible) {
    return;
  }
  this.visible_ = visible;
  var root = this.getSvgRoot();
  if (root) {
    root.style.display = visible ? 'block' : 'none';
    this.render_();
  }
};

/**
 * Adds a string to the field's array of argTypes (used for styling).
 * @param {string} argType New argType.
 */
Blockly.Field.prototype.addArgType = function(argType) {
  if (this.argType_ == null) {
    this.argType_ = [];
  }
  this.argType_.push(argType);
};

/**
 * Gets the field's argTypes joined as a string, or returns null (used for styling).
 * @return {string} argType string, or null.
 */
Blockly.Field.prototype.getArgTypes = function() {
  if (this.argType_ === null || this.argType_.length === 0) {
    return null;
  } else {
    return this.argType_.join(' ');
  }
};

/**
 * Sets a new validation function for editable fields.
 * @param {Function} handler New validation function, or null.
 */
Blockly.Field.prototype.setValidator = function(handler) {
  this.validator_ = handler;
};

/**
 * Gets the validation function for editable fields.
 * @return {Function} Validation function, or null.
 */
Blockly.Field.prototype.getValidator = function() {
  return this.validator_;
};

/**
 * Validates a change.  Does nothing.  Subclasses may override this.
 * @param {string} text The user's text.
 * @return {string} No change needed.
 */
Blockly.Field.prototype.classValidator = function(text) {
  return text;
};

/**
 * Calls the validation function for this field, as well as all the validation
 * function for the field's class and its parents.
 * @param {string} text Proposed text.
 * @return {?string} Revised text, or null if invalid.
 */
Blockly.Field.prototype.callValidator = function(text) {
  var classResult = this.classValidator(text);
  if (classResult === null) {
    // Class validator rejects value.  Game over.
    return null;
  } else if (classResult !== undefined) {
    text = classResult;
  }
  var userValidator = this.getValidator();
  if (userValidator) {
    var userResult = userValidator.call(this, text);
    if (userResult === null) {
      // User validator rejects value.  Game over.
      return null;
    } else if (userResult !== undefined) {
      text = userResult;
    }
  }
  return text;
};

/**
 * Gets the group element for this editable field.
 * Used for measuring the size and for positioning.
 * @return {!Element} The group element.
 */
Blockly.Field.prototype.getSvgRoot = function() {
  return /** @type {!Element} */ (this.fieldGroup_);
};

/**
 * Draws the border with the correct width.
 * Saves the computed width in a property.
 * @private
 */
Blockly.Field.prototype.render_ = function() {
  if (this.visible_ && this.textElement_) {
    // Replace the text.
    this.textElement_.textContent = this.getDisplayText_();
    this.updateWidth();

    // Update text centering, based on newly calculated width.
    var centerTextX = (this.size_.width - this.arrowWidth_) / 2;
    if (this.sourceBlock_.RTL) {
      centerTextX += this.arrowWidth_;
    }

    // In a text-editing shadow block's field,
    // if half the text length is not at least center of
    // visible field (FIELD_WIDTH), center it there instead,
    // unless there is a drop-down arrow.
    if (this.sourceBlock_.isShadow() && !this.positionArrow) {
      var minOffset = Blockly.BlockSvg.FIELD_WIDTH / 2;
      if (this.sourceBlock_.RTL) {
        // X position starts at the left edge of the block, in both RTL and LTR.
        // First offset by the width of the block to move to the right edge,
        // and then subtract to move to the same position as LTR.
        var minCenter = this.size_.width - minOffset;
        centerTextX = Math.min(minCenter, centerTextX);
      } else {
        // (width / 2) should exceed Blockly.BlockSvg.FIELD_WIDTH / 2
        // if the text is longer.
        centerTextX = Math.max(minOffset, centerTextX);
      }
    }

    // Apply new text element x position.
    this.textElement_.setAttribute('x', centerTextX);
  }

  // Update any drawn box to the correct width and height.
  if (this.box_) {
    this.box_.setAttribute('width', this.size_.width);
    this.box_.setAttribute('height', this.size_.height);
  }
};

/**
 * Updates the width of the field. This calls getCachedWidth which won't cache
 * the approximated width on IE/Edge when `getComputedTextLength` fails. Once
 * it eventually does succeed, the result will be cached.
 **/
Blockly.Field.prototype.updateWidth = function() {
  // Calculate width of field
  var width = Blockly.Field.getCachedWidth(this.textElement_);

  // Add padding to left and right of text.
  if (this.EDITABLE) {
    width += Blockly.BlockSvg.EDITABLE_FIELD_PADDING;
  }

  // Adjust width for drop-down arrows.
  this.arrowWidth_ = 0;
  if (this.positionArrow) {
    this.arrowWidth_ = this.positionArrow(width);
    width += this.arrowWidth_;
  }

  // Add padding to any drawn box.
  if (this.box_) {
    width += 2 * Blockly.BlockSvg.BOX_FIELD_PADDING;
  }

  // Set width of the field.
  this.size_.width = width;
};

/**
 * Cache of text widths by font configuration.
 * Keys are font identifiers (class names), values are LRU caches.
 * @type {Object<string, Object>}
 * @private
 */
Blockly.Field.fontWidthCache_ = {};

/**
 * Cache of average character widths by font configuration.
 * Used for approximation when text hasn't been measured yet.
 * @type {Object<string, number>}
 * @private
 */
Blockly.Field.avgCharWidthCache_ = {};

/**
 * Cache of individual character widths by font configuration.
 * Keys are font identifiers, values are objects mapping characters to widths.
 * @type {Object<string, Object<string, number>>}
 * @private
 */
Blockly.Field.charWidthCache_ = {};

/**
 * Common kerning pairs and their adjustment values by font.
 * @type {Object<string, Object<string, number>>}
 * @private
 */
Blockly.Field.kerningCache_ = {};

/**
 * Shared measurement element for all font classes.
 * @type {?{svg: Element, text: Element}}
 * @private
 */
Blockly.Field.measurementElement_ = null;

/**
 * Maximum number of entries per font cache (LRU).
 * @const {number}
 * @private
 */
Blockly.Field.MAX_CACHE_ENTRIES_ = 5000;

/**
 * Maximum text length to cache. Longer strings are measured directly.
 * @const {number}
 * @private
 */
Blockly.Field.MAX_CACHE_LENGTH_ = 100;

/**
 * Whether to use character-based width approximation for uncached strings.
 * When true, uses sum of individual character widths instead of measuring.
 * Slightly less accurate but much faster (no DOM calls).
 * @type {boolean}
 * @private
 */
Blockly.Field.USE_CHAR_APPROXIMATION_ = true;

/**
 * Accuracy threshold for character-based approximation (as percentage).
 * If approximation is within this % of actual, use approximation going forward.
 * @const {number}
 * @private
 */
Blockly.Field.APPROXIMATION_THRESHOLD_ = 2;

/**
 * Simple LRU cache implementation.
 * @param {number} maxSize Maximum number of entries.
 * @constructor
 * @private
 */
Blockly.Field.LRUCache_ = function(maxSize) {
  this.maxSize = maxSize;
  this.cache = Object.create(null);
  this.keys = [];
};

/**
 * Get a value from the cache.
 * @param {string} key The cache key.
 * @return {*} The cached value, or undefined if not found.
 */
Blockly.Field.LRUCache_.prototype.get = function(key) {
  var value = this.cache[key];
  if (value !== undefined) {
    // Move to end (most recently used)
    var index = this.keys.indexOf(key);
    if (index !== -1 && index !== this.keys.length - 1) {
      this.keys.splice(index, 1);
      this.keys.push(key);
    }
  }
  return value;
};

/**
 * Set a value in the cache.
 * @param {string} key The cache key.
 * @param {*} value The value to cache.
 */
Blockly.Field.LRUCache_.prototype.set = function(key, value) {
  if (this.cache[key] === undefined) {
    // New entry
    if (this.keys.length >= this.maxSize) {
      // Evict oldest entry
      var oldestKey = this.keys.shift();
      delete this.cache[oldestKey];
    }
    this.keys.push(key);
  } else {
    // Update existing - move to end
    var index = this.keys.indexOf(key);
    if (index !== -1) {
      this.keys.splice(index, 1);
      this.keys.push(key);
    }
  }
  this.cache[key] = value;
};

/**
 * Clear all entries from the cache.
 */
Blockly.Field.LRUCache_.prototype.clear = function() {
  this.cache = Object.create(null);
  this.keys = [];
};

/**
 * Initialize the shared measurement element.
 * @private
 */
Blockly.Field.initMeasurementElement_ = function() {
  if (Blockly.Field.measurementElement_) {
    return;
  }
  
  // Create a single shared measurement element
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  svg.style.left = '-9999px';
  svg.style.pointerEvents = 'none';
  
  var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  svg.appendChild(text);
  document.body.appendChild(svg);
  
  Blockly.Field.measurementElement_ = {
    svg: svg,
    text: text
  };
};

/**
 * Initialize font metrics for a given class name.
 * @param {string} className The CSS class name for the font.
 * @private
 */
Blockly.Field.initFontMetrics_ = function(className) {
  if (Blockly.Field.fontWidthCache_[className]) {
    return;
  }
  
  // Ensure shared measurement element exists
  Blockly.Field.initMeasurementElement_();
  
  // Initialize LRU cache for this font
  Blockly.Field.fontWidthCache_[className] = new Blockly.Field.LRUCache_(
      Blockly.Field.MAX_CACHE_ENTRIES_);
  
  // Initialize character width cache
  Blockly.Field.charWidthCache_[className] = {};
  
  // Initialize kerning cache
  Blockly.Field.kerningCache_[className] = {};
  
  var text = Blockly.Field.measurementElement_.text;
  text.setAttribute('class', className);
  
  // Pre-measure ALL individual characters for character-based approximation
  var allChars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
    ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~\u00A0';
  
  var charCache = Blockly.Field.charWidthCache_[className];
  var totalChars = 0;
  var totalWidth = 0;
  
  // Measure each character individually
  for (var i = 0; i < allChars.length; i++) {
    var char = allChars[i];
    text.textContent = char;
    try {
      var width = text.getComputedTextLength();
      charCache[char] = width;
      totalChars++;
      totalWidth += width;
    } catch (e) {
      // Skip on error
    }
  }
  
  // Pre-measure common short strings to seed the full-string cache
  var testStrings = [
    // Common operators and keywords
    'if', 'to', 'do', 'for', 'and', 'or', 'not', 'set', 'get',
    'var', 'let', 'int', 'str', 'true', 'false', 'null',
    'while', 'else', 'return', 'break', 'continue',
    // Common block text
    'repeat', 'forever', 'times', 'move', 'turn', 'wait',
    'when', 'start', 'stop', 'show', 'hide', 'say', 'think',
    'length', 'item', 'contains', 'join', 'random'
  ];
  
  var cache = Blockly.Field.fontWidthCache_[className];
  
  for (var i = 0; i < testStrings.length; i++) {
    var str = testStrings[i];
    text.textContent = str;
    try {
      var width = text.getComputedTextLength();
      cache.set(str, width);
      totalChars += str.length;
      totalWidth += width;
    } catch (e) {
      // Skip on error
    }
  }
  
  // Measure common kerning pairs to improve approximation accuracy
  var kerningPairs = [
    'AV', 'AW', 'AY', 'FA', 'LT', 'LV', 'LW', 'LY', 'PA', 'TA', 'TO',
    'Tr', 'Tu', 'Tw', 'Ty', 'VA', 'WA', 'Wa', 'We', 'Wo', 'Ya', 'Ye', 'Yo'
  ];
  
  var kerningCache = Blockly.Field.kerningCache_[className];
  
  for (var i = 0; i < kerningPairs.length; i++) {
    var pair = kerningPairs[i];
    if (charCache[pair[0]] !== undefined && charCache[pair[1]] !== undefined) {
      text.textContent = pair;
      try {
        var actualWidth = text.getComputedTextLength();
        var expectedWidth = charCache[pair[0]] + charCache[pair[1]];
        var kerning = actualWidth - expectedWidth;
        if (Math.abs(kerning) > 0.1) { // Only store significant kerning
          kerningCache[pair] = kerning;
        }
      } catch (e) {
        // Skip on error
      }
    }
  }
  
  // Calculate average character width (including kerning/spacing)
  Blockly.Field.avgCharWidthCache_[className] = totalChars > 0 ?
      totalWidth / totalChars : 8;
};

/**
 * Get the cached width of a text element.
 * @param {!Element} textElement The text element to measure.
 * @return {number} The width of the text in pixels.
 */
Blockly.Field.getCachedWidth = function(textElement) {
  var className = textElement.className.baseVal || 'blocklyText';
  var text = textElement.textContent;
  
  if (!text) {
    return 0;
  }
  
  // Initialize font metrics for this class if not already done
  if (!Blockly.Field.fontWidthCache_[className]) {
    Blockly.Field.initFontMetrics_(className);
  }
  
  var cache = Blockly.Field.fontWidthCache_[className];
  var shouldCache = text.length <= Blockly.Field.MAX_CACHE_LENGTH_;
  
  // Check cache first for cacheable strings
  if (shouldCache) {
    var cachedWidth = cache.get(text);
    if (cachedWidth !== undefined) {
      return cachedWidth;
    }
    
    // Also check the per-session cache (if active)
    if (Blockly.Field.cacheWidths_) {
      var key = text + '\n' + className;
      if (Blockly.Field.cacheWidths_[key] !== undefined) {
        return Blockly.Field.cacheWidths_[key];
      }
    }
  }
  
  // Try character-based approximation first (zero DOM calls!)
  if (Blockly.Field.USE_CHAR_APPROXIMATION_) {
    var approximateWidth = Blockly.Field.approximateWidth_(text, className);
    if (approximateWidth !== null) {
      // For very common patterns, trust the approximation without measuring
      // This eliminates DOM calls for the majority of fields
      if (shouldCache) {
        cache.set(text, approximateWidth);
        if (Blockly.Field.cacheWidths_) {
          var key = text + '\n' + className;
          Blockly.Field.cacheWidths_[key] = approximateWidth;
        }
      }
      return approximateWidth;
    }
  }
  
  var width;
  
  // Try to measure using the shared measurement element (most efficient)
  var measurementText = Blockly.Field.measurementElement_.text;
  measurementText.setAttribute('class', className);
  measurementText.textContent = text;
  
  try {
    if (goog.userAgent.IE || goog.userAgent.EDGE) {
      width = measurementText.getBBox().width;
    } else {
      width = measurementText.getComputedTextLength();
    }
  } catch (e) {
    // Measurement element not ready - try the actual element
    try {
      if (goog.userAgent.IE || goog.userAgent.EDGE) {
        width = textElement.getBBox().width;
      } else {
        width = textElement.getComputedTextLength();
      }
    } catch (e2) {
      // Element not in DOM yet - use character approximation or fallback
      var approxWidth = Blockly.Field.approximateWidth_(text, className);
      if (approxWidth !== null) {
        return approxWidth;
      }
      var avgWidth = Blockly.Field.avgCharWidthCache_[className] || 8;
      return text.length * avgWidth;
    }
  }
  
  // Cache the measured width if it's cacheable
  if (shouldCache) {
    cache.set(text, width);
    
    // Also cache in the per-session cache if active
    if (Blockly.Field.cacheWidths_) {
      var key = text + '\n' + className;
      Blockly.Field.cacheWidths_[key] = width;
    }
  }
  
  return width;
};

/**
 * Approximate the width of text using individual character widths.
 * This avoids DOM calls entirely for strings where we have all character data.
 * @param {string} text The text to approximate.
 * @param {string} className The CSS class name.
 * @return {?number} The approximate width, or null if not enough data.
 * @private
 */
Blockly.Field.approximateWidth_ = function(text, className) {
  var charCache = Blockly.Field.charWidthCache_[className];
  if (!charCache) {
    return null;
  }
  
  var width = 0;
  var hasAllChars = true;
  
  // Sum individual character widths
  for (var i = 0; i < text.length; i++) {
    var char = text[i];
    if (charCache[char] === undefined) {
      hasAllChars = false;
      break;
    }
    width += charCache[char];
  }
  
  if (!hasAllChars) {
    return null;
  }
  
  // Apply kerning adjustments for known pairs
  var kerningCache = Blockly.Field.kerningCache_[className];
  if (kerningCache && text.length > 1) {
    for (var i = 0; i < text.length - 1; i++) {
      var pair = text[i] + text[i + 1];
      if (kerningCache[pair] !== undefined) {
        width += kerningCache[pair];
      }
    }
  }
  
  return width;
};

/**
 * Pre-warm the font metrics cache for commonly used text.
 * Call this during initialization to improve performance for large projects.
 * @param {string=} opt_className Optional class name, defaults to 'blocklyText'.
 * @param {Array<string>=} opt_commonTexts Optional array of common text strings to pre-cache.
 */
Blockly.Field.prewarmFontCache = function(opt_className, opt_commonTexts) {
  var className = opt_className || 'blocklyText';
  
  // Initialize if not already done
  if (!Blockly.Field.fontWidthCache_[className]) {
    Blockly.Field.initFontMetrics_(className);
  }
  
  if (opt_commonTexts && opt_commonTexts.length > 0) {
    Blockly.Field.initMeasurementElement_();
    
    var text = Blockly.Field.measurementElement_.text;
    text.setAttribute('class', className);
    
    var cache = Blockly.Field.fontWidthCache_[className];
    
    for (var i = 0; i < opt_commonTexts.length; i++) {
      var str = opt_commonTexts[i];
      
      // Only pre-cache strings within the length limit
      if (str && str.length <= Blockly.Field.MAX_CACHE_LENGTH_ &&
          cache.get(str) === undefined) {
        text.textContent = str;
        try {
          var width = text.getComputedTextLength();
          cache.set(str, width);
        } catch (e) {
          // Skip on error
        }
      }
    }
  }
};

/**
 * Clear all font metrics caches and dispose of measurement elements.
 */
Blockly.Field.clearFontCache = function() {
  // Clean up the shared measurement element
  if (Blockly.Field.measurementElement_) {
    var svg = Blockly.Field.measurementElement_.svg;
    if (svg && svg.parentNode) {
      svg.parentNode.removeChild(svg);
    }
    Blockly.Field.measurementElement_ = null;
  }
  
  // Clear all caches
  for (var className in Blockly.Field.fontWidthCache_) {
    if (Blockly.Field.fontWidthCache_[className].clear) {
      Blockly.Field.fontWidthCache_[className].clear();
    }
  }
  
  Blockly.Field.fontWidthCache_ = {};
  Blockly.Field.avgCharWidthCache_ = {};
  Blockly.Field.charWidthCache_ = {};
  Blockly.Field.kerningCache_ = {};
};

/**
 * Start caching field widths.  Every call to this function MUST also call
 * stopCache.  Caches must not survive between execution threads.
 */
Blockly.Field.startCache = function() {
  Blockly.Field.cacheReference_++;
  if (!Blockly.Field.cacheWidths_) {
    Blockly.Field.cacheWidths_ = Object.create(null);
  }
};

/**
 * Stop caching field widths.  Unless caching was already on when the
 * corresponding call to startCache was made.
 */
Blockly.Field.stopCache = function() {
  Blockly.Field.cacheReference_--;
  if (!Blockly.Field.cacheReference_) {
    Blockly.Field.cacheWidths_ = null;
  }
};

/**
 * Returns the height and width of the field.
 * @return {!goog.math.Size} Height and width.
 */
Blockly.Field.prototype.getSize = function() {
  if (!this.size_.width) {
    this.render_();
  }
  return this.size_;
};

/**
 * Returns the bounding box of the rendered field, accounting for workspace
 * scaling.
 * @return {!Object} An object with top, bottom, left, and right in pixels
 *     relative to the top left corner of the page (window coordinates).
 * @private
 */
Blockly.Field.prototype.getScaledBBox_ = function() {
  var size = this.getSize();
  var scaledHeight = size.height * this.sourceBlock_.workspace.scale;
  var scaledWidth = size.width * this.sourceBlock_.workspace.scale;
  var xy = this.getAbsoluteXY_();
  return {
    top: xy.y,
    bottom: xy.y + scaledHeight,
    left: xy.x,
    right: xy.x + scaledWidth
  };
};

/**
 * Get the text from this field as displayed on screen.  May differ from getText
 * due to ellipsis, and other formatting.
 * @return {string} Currently displayed text.
 * @private
 */
Blockly.Field.prototype.getDisplayText_ = function() {
  var text = this.text_;
  if (!text) {
    // Prevent the field from disappearing if empty.
    return Blockly.Field.NBSP;
  }
  if (text.length > this.maxDisplayLength) {
    // Truncate displayed string and add an ellipsis ('...').
    text = text.substring(0, this.maxDisplayLength - 2) + '\u2026';
  }
  // Replace whitespace with non-breaking spaces so the text doesn't collapse.
  text = text.replace(/\s/g, Blockly.Field.NBSP);
  if (this.sourceBlock_.RTL) {
    // The SVG is LTR, force text to be RTL unless a number.
    if (this.sourceBlock_.editable_ && this.sourceBlock_.type === 'math_number') {
      text = '\u202A' + text + '\u202C';
    } else {
      text = '\u202B' + text + '\u202C';
    }
  }
  return text;
};

/**
 * Get the text from this field.
 * @return {string} Current text.
 */
Blockly.Field.prototype.getText = function() {
  return this.text_;
};

/**
 * Set the text in this field.  Trigger a rerender of the source block.
 * @param {*} newText New text.
 */
Blockly.Field.prototype.setText = function(newText) {
  if (newText === null) {
    // No change if null.
    return;
  }
  newText = String(newText);
  if (newText === this.text_) {
    // No change.
    return;
  }
  this.text_ = newText;
  this.forceRerender();
};

/**
 * Force a rerender of the block that this field is installed on, which will
 * rerender this field and adjust for any sizing changes.
 * Other fields on the same block will not rerender, because their sizes have
 * already been recorded.
 * @package
 */
Blockly.Field.prototype.forceRerender = function() {
  // Set width to 0 to force a rerender of this field.
  this.size_.width = 0;

  if (this.sourceBlock_ && this.sourceBlock_.rendered) {
    this.sourceBlock_.render();
    this.sourceBlock_.bumpNeighbours_();
  }
};

/**
 * Update the text node of this field to display the current text.
 * @private
 */
Blockly.Field.prototype.updateTextNode_ = function() {
  if (!this.textElement_) {
    // Not rendered yet.
    return;
  }
  var text = this.text_;
  if (text.length > this.maxDisplayLength) {
    // Truncate displayed string and add an ellipsis ('...').
    text = text.substring(0, this.maxDisplayLength - 2) + '\u2026';
    // Add special class for sizing font when truncated
    this.textElement_.setAttribute('class', this.className_ + ' blocklyTextTruncated');
  } else {
    this.textElement_.setAttribute('class', this.className_);
  }
  // Empty the text element.
  goog.dom.removeChildren(/** @type {!Element} */ (this.textElement_));
  // Replace whitespace with non-breaking spaces so the text doesn't collapse.
  text = text.replace(/\s/g, Blockly.Field.NBSP);
  if (this.sourceBlock_.RTL && text) {
    // The SVG is LTR, force text to be RTL.
    if (this.sourceBlock_.editable_ && this.sourceBlock_.type === 'math_number') {
      text = '\u202A' + text + '\u202C';
    } else {
      text = '\u202B' + text + '\u202C';
    }
  }
  if (!text) {
    // Prevent the field from disappearing if empty.
    text = Blockly.Field.NBSP;
  }
  var textNode = document.createTextNode(text);
  this.textElement_.appendChild(textNode);

  // Cached width is obsolete.  Clear it.
  this.size_.width = 0;
};

/**
 * By default there is no difference between the human-readable text and
 * the language-neutral values.  Subclasses (such as dropdown) may define this.
 * @return {string} Current value.
 */
Blockly.Field.prototype.getValue = function() {
  return this.getText();
};

/**
 * By default there is no difference between the human-readable text and
 * the language-neutral values.  Subclasses (such as dropdown) may define this.
 * @param {string} newValue New value.
 */
Blockly.Field.prototype.setValue = function(newValue) {
  if (newValue === null) {
    // No change if null.
    return;
  }
  var oldValue = this.getValue();
  if (oldValue == newValue) {
    return;
  }
  if (this.sourceBlock_ && Blockly.Events.isEnabled()) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(
        this.sourceBlock_, 'field', this.name, oldValue, newValue));
  }
  this.setText(newValue);
};

/**
 * Handle a mouse down event on a field.
 * @param {!Event} e Mouse down event.
 * @private
 */
Blockly.Field.prototype.onMouseDown_ = function(e) {
  if (!this.sourceBlock_ || !this.sourceBlock_.workspace) {
    return;
  }
  if (this.sourceBlock_.workspace.isDragging()) {
    return;
  }
  var gesture = this.sourceBlock_.workspace.getGesture(e);
  if (gesture) {
    gesture.setStartField(this);
  }
  this.useTouchInteraction_ = Blockly.Touch.getTouchIdentifierFromEvent(e) !== 'mouse';
};

/**
 * Change the tooltip text for this field.
 * @param {string|!Element} _newTip Text for tooltip or a parent element to
 *     link to for its tooltip.
 * @abstract
 */
Blockly.Field.prototype.setTooltip = function(_newTip) {
  // Non-abstract sub-classes may wish to implement this.  See FieldLabel.
};

/**
 * Select the element to bind the click handler to. When this element is
 * clicked on an editable field, the editor will open.
 *
 * If the block has only one field and no output connection, we handle clicks
 * over the whole block. Otherwise, handle clicks over the the group containing
 * the field.
 *
 * @return {!Element} Element to bind click handler to.
 * @private
 */
Blockly.Field.prototype.getClickTarget_ = function() {
  var nFields = 0;

  for (var i = 0, input; input = this.sourceBlock_.inputList[i]; i++) {
    nFields += input.fieldRow.length;
  }
  if (nFields <= 1 && this.sourceBlock_.outputConnection) {
    return this.sourceBlock_.getSvgRoot();
  } else {
    return this.getSvgRoot();
  }
};

/**
 * Return the absolute coordinates of the top-left corner of this field.
 * The origin (0,0) is the top-left corner of the page body.
 * @return {!goog.math.Coordinate} Object with .x and .y properties.
 * @private
 */
Blockly.Field.prototype.getAbsoluteXY_ = function() {
  return goog.style.getPageOffset(this.getClickTarget_());
};

/**
 * Whether this field references any Blockly variables.  If true it may need to
 * be handled differently during serialization and deserialization.  Subclasses
 * may override this.
 * @return {boolean} True if this field has any variable references.
 * @package
 */
Blockly.Field.prototype.referencesVariables = function() {
  return false;
};
