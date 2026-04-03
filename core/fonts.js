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
 * @fileoverview Font configuration for pretext measurements.
 * Maps CSS class names to canvas font shorthands.
 * @author mistwarp
 */

'use strict';

goog.provide('Blockly.Fonts');

/**
 * Font configurations for different CSS classes.
 * Maps className -> {weight, size, family}
 * These must match the CSS definitions in core/css.js
 */
Blockly.Fonts.CONFIG = {
  'blocklyText': {
    weight: '500',
    size: '12pt',
    family: '"Helvetica Neue", Helvetica, sans-serif'
  },
  'blocklyTextTruncated': {
    weight: '500',
    size: '11pt',
    family: '"Helvetica Neue", Helvetica, sans-serif'
  },
  'blocklyFlyoutLabelText': {
    weight: '500',
    size: '14pt',
    family: '"Helvetica Neue", Helvetica, sans-serif'
  },
  'blocklyTreeLabel': {
    weight: '400',
    size: '16px',
    family: '"Helvetica Neue", Helvetica, sans-serif'
  },
  'scratchCategoryMenuItem': {
    weight: '400',
    size: '0.7rem',
    family: '"Helvetica Neue", Helvetica, sans-serif'
  }
};

/**
 * Get canvas font shorthand for a class name
 * @param {string} className CSS class name
 * @return {string} Canvas font shorthand (e.g., "500 12pt Helvetica Neue")
 */
Blockly.Fonts.getFont = function(className) {
  var config = this.CONFIG[className] || this.CONFIG['blocklyText'];
  return config.weight + ' ' + config.size + ' ' + config.family;
};

/**
 * Get font configuration for a class name
 * @param {string} className CSS class name
 * @return {{weight: string, size: string, family: string}} Font configuration
 */
Blockly.Fonts.getConfig = function(className) {
  return this.CONFIG[className] || this.CONFIG['blocklyText'];
};
