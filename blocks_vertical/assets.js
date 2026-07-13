/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2016 Massachusetts Institute of Technology
 * All rights reserved.
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

'use strict';

goog.provide('Blockly.Blocks.assets');

goog.require('Blockly.Blocks');
goog.require('Blockly.Colours');
goog.require('Blockly.constants');
goog.require('Blockly.ScratchBlocks.VerticalExtensions');

Blockly.Blocks['assets_menu'] = {
  /**
   * Custom asset drop-down menu. Options are populated by scratch-gui.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": "%1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "ASSET",
          "options": [
            ['', '']
          ]
        }
      ],
      "colour": Blockly.Colours.assets.secondary,
      "colourSecondary": Blockly.Colours.assets.secondary,
      "colourTertiary": Blockly.Colours.assets.tertiary,
      "colourQuaternary": Blockly.Colours.assets.quaternary,
      "extensions": ["output_string"]
    });
  }
};

Blockly.Blocks['assets_load'] = {
  /**
   * Block to load an asset as a costume or a sound.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_LOAD,
      "args0": [
        {
          "type": "input_value",
          "name": "ASSET"
        },
        {
          "type": "field_dropdown",
          "name": "KIND",
          "options": [
            [Blockly.Msg.ASSETS_KIND_COSTUME, 'costume'],
            [Blockly.Msg.ASSETS_KIND_SOUND, 'sound']
          ]
        }
      ],
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "shape_statement"]
    });
  }
};

Blockly.Blocks['assets_unload'] = {
  /**
   * Block to unload an asset.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_UNLOAD,
      "args0": [
        {
          "type": "input_value",
          "name": "ASSET"
        }
      ],
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "shape_statement"]
    });
  }
};

Blockly.Blocks['assets_unloadall'] = {
  /**
   * Block to unload every asset.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_UNLOADALL,
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "shape_statement"]
    });
  }
};

Blockly.Blocks['assets_get'] = {
  /**
   * Block to report an asset's contents in a chosen representation.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_GET,
      "args0": [
        {
          "type": "field_dropdown",
          "name": "PROPERTY",
          "options": [
            [Blockly.Msg.ASSETS_PROPERTY_TEXT, 'text'],
            [Blockly.Msg.ASSETS_PROPERTY_DATAURI, 'data uri'],
            [Blockly.Msg.ASSETS_PROPERTY_BASE64, 'base64'],
            [Blockly.Msg.ASSETS_PROPERTY_URL, 'url'],
            [Blockly.Msg.ASSETS_PROPERTY_SIZE, 'size'],
            [Blockly.Msg.ASSETS_PROPERTY_FORMAT, 'format'],
            [Blockly.Msg.ASSETS_PROPERTY_FOLDER, 'folder']
          ]
        },
        {
          "type": "input_value",
          "name": "ASSET"
        }
      ],
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "output_string"]
    });
  }
};

Blockly.Blocks['assets_byte'] = {
  /**
   * Block to report a single byte of an asset.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_BYTE,
      "args0": [
        {
          "type": "input_value",
          "name": "INDEX"
        },
        {
          "type": "input_value",
          "name": "ASSET"
        }
      ],
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "output_number"]
    });
  }
};

Blockly.Blocks['assets_check'] = {
  /**
   * Block to report whether an asset exists or is currently loaded.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_CHECK,
      "args0": [
        {
          "type": "input_value",
          "name": "ASSET"
        },
        {
          "type": "field_dropdown",
          "name": "STATE",
          "options": [
            [Blockly.Msg.ASSETS_STATE_EXISTS, 'exists'],
            [Blockly.Msg.ASSETS_STATE_LOADED, 'is loaded']
          ]
        }
      ],
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "output_boolean"]
    });
  }
};

Blockly.Blocks['assets_set'] = {
  /**
   * Block to write a value into an asset.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_SET,
      "args0": [
        {
          "type": "input_value",
          "name": "ASSET"
        },
        {
          "type": "input_value",
          "name": "VALUE"
        },
        {
          "type": "field_dropdown",
          "name": "FORMAT",
          "options": [
            [Blockly.Msg.ASSETS_PROPERTY_TEXT, 'text'],
            [Blockly.Msg.ASSETS_PROPERTY_BASE64, 'base64'],
            [Blockly.Msg.ASSETS_PROPERTY_URL, 'url']
          ]
        }
      ],
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "shape_statement"]
    });
  }
};

Blockly.Blocks['assets_delete'] = {
  /**
   * Block to delete an asset.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_DELETE,
      "args0": [
        {
          "type": "input_value",
          "name": "ASSET"
        }
      ],
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "shape_statement"]
    });
  }
};

Blockly.Blocks['assets_allnames'] = {
  /**
   * Block to report the paths of every asset.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_ALLNAMES,
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "output_string"]
    });
  }
};

Blockly.Blocks['assets_infolder'] = {
  /**
   * Block to report the paths of every asset directly inside a folder.
   * @this Blockly.Block
   */
  init: function() {
    this.jsonInit({
      "message0": Blockly.Msg.ASSETS_INFOLDER,
      "args0": [
        {
          "type": "input_value",
          "name": "FOLDER"
        }
      ],
      "category": Blockly.Categories.assets,
      "extensions": ["colours_assets", "output_string"]
    });
  }
};
