/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2026 Mistwarp
 * https://github.com/mistwarp/scratch-blocks
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
 * @fileoverview Pretext-based text measurement. No DOM layout required!
 * Uses @chenglou/pretext for fast, accurate text measurement.
 * @author mistwarp
 */

'use strict';

goog.provide('Blockly.PretextMeasurement');

// Import pretext - webpack will handle the module loading
var pretext;
try {
  pretext = require('@chenglou/pretext');
} catch (e) {
  // Fallback for closure compiler - will be replaced at runtime
  pretext = {
    prepare: function() {},
    layout: function() { return { height: 0, lineCount: 0 }; },
    prepareWithSegments: function() {},
    walkLineRanges: function() {}
  };
}

var prepare = pretext.prepare;
var layout = pretext.layout;
var prepareWithSegments = pretext.prepareWithSegments;
var walkLineRanges = pretext.walkLineRanges;

/**
 * LRU cache for prepared text objects.
 * Key: "text|font", Value: PreparedText
 * @type {Map<string, any>}
 * @private
 */
Blockly.PretextMeasurement.preparedCache_ = new Map();

/**
 * Maximum cache size (evict oldest when exceeded)
 * @const {number}
 * @private
 */
Blockly.PretextMeasurement.MAX_CACHE_SIZE_ = 1000;

/**
 * Measure text width using pretext (no DOM layout!)
 * @param {string} text The text to measure
 * @param {string} font Canvas font shorthand (e.g., "500 12pt Helvetica Neue")
 * @return {number} Width in pixels
 */
Blockly.PretextMeasurement.measureWidth = function(text, font) {
  if (!text) {
    return 0;
  }
  // Use prepareWithSegments to get natural width
  var prepared = prepareWithSegments(text, font);
  var maxWidth = 0;
  // Walk through lines to find the maximum width
  walkLineRanges(prepared, Infinity, function(line) {
    if (line.width > maxWidth) {
      maxWidth = line.width;
    }
  });
  return maxWidth;
};

/**
 * Measure text height for multiline text (given a max width)
 * @param {string} text The text to measure
 * @param {string} font Canvas font shorthand
 * @param {number} maxWidth Maximum width for wrapping
 * @param {number} lineHeight Line height in pixels
 * @return {{width: number, height: number, lineCount: number}} Measurement result
 */
Blockly.PretextMeasurement.measureHeight = function(text, font, maxWidth, lineHeight) {
  if (!text) {
    return { width: 0, height: 0, lineCount: 0 };
  }
  var prepared = this.getPrepared_(text, font);
  var result = layout(prepared, maxWidth, lineHeight);
  var width = this.measureWidth(text, font);
  return {
    width: width,
    height: result.height,
    lineCount: result.lineCount
  };
};

/**
 * Get or create a prepared text object (with caching)
 * @param {string} text
 * @param {string} font
 * @return {any} PreparedText object from pretext
 * @private
 */
Blockly.PretextMeasurement.getPrepared_ = function(text, font) {
  var key = text + '|' + font;
  
  if (this.preparedCache_.has(key)) {
    return this.preparedCache_.get(key);
  }
  
  // Evict oldest if cache is full
  if (this.preparedCache_.size >= this.MAX_CACHE_SIZE_) {
    var firstKey = this.preparedCache_.keys().next().value;
    this.preparedCache_.delete(firstKey);
  }
  
  // Use prepare() for simple cases, prepareWithSegments for width measurement
  var prepared = prepare(text, font);
  this.preparedCache_.set(key, prepared);
  return prepared;
};

/**
 * Clear the prepared text cache
 */
Blockly.PretextMeasurement.clearCache = function() {
  this.preparedCache_.clear();
};
