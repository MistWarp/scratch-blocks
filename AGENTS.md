# AGENTS.md

scratch-blocks is the block workspace in MistWarp's editor: a Blockly fork, by way of Scratch and TurboWarp, written in Google Closure JavaScript. scratch-gui pins it to a commit and uses the compiled output.

## Where code goes

- `core/` is the workspace engine: rendering, dragging, events, the flyout, the toolbox, and lazy loading of large projects.
- `blocks_vertical/` and `blocks_common/` define the blocks. `msg/` holds the messages, and `i18n/` the translation tooling.
- `blockly_compressed_*.js` and `blocks_compressed*.js` are build output, and they are committed. Rebuild them whenever you change `core/` or the blocks.

## Things that look safe to change but are not

- **Closure compiles `core/`.** A new symbol must be exported in the `goog.global` block, or Closure strips it. The JSDoc type annotations (`@param {Type}`, `@private`, `@export`) are compiler input, not comments. Keep them accurate, but don't add explanatory prose.
- **Building needs Java.** Put a JRE 17 on `PATH`, then run `npm run build:closure` (about 25 seconds) and commit the regenerated compressed files.
- **Lazy loading and loose blocks are subtle.** Large projects load scripts on demand, so check changes to events, the flyout or `xml.js` with a big project in the real editor.

## Checks

`npm run test:lint` (`core/xml.js` already has lint errors, so compare against `develop` before blaming your change), `npm run test:unit` (jsunit; `tests/jsunit/vertical_tests.html` also runs headless), `node --test tests/*.test.cjs`, and `npm run test:messages`.

## Working here

- The default branch is `develop`. This repo is a fork, so open PRs with `gh pr create -R MistWarp/scratch-blocks --base develop`.
- To try a change in the editor, link this checkout into a scratch-gui worktree's `node_modules/scratch-blocks`, and restart its dev server after every relink.
- No explanatory comments, and no em dashes anywhere.
- Never add `Co-Authored-By` or any AI or tool attribution to commits or PRs.
- READMEs are overviews. Documentation goes in MistWarp/docs (https://mistwarp.org/docs/).
