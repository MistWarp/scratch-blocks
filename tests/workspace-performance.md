# Workspace performance check

Serve scratch-blocks over HTTP and open `tests/workspace-performance.html`. Run the button with the tab visible. It builds a 1,200-block stack, edits its final numeric input, scrolls it out of view and back, then forces cache eviction. It reports load time, longest scheduled tasks, whether the script stayed cached, revisit time, and whether eviction completed. These are JavaScript callback timings, not a guarantee about browser paint or frame presentation.

For a comparison against the committed engine, prepare the ignored baseline fixture:

```sh
mkdir -p node_modules/.cache/mistwarp-performance
git show HEAD:blockly_compressed_vertical.js > node_modules/.cache/mistwarp-performance/baseline.js
```

Then open `tests/workspace-performance.html?baseline=1`. Disable the browser cache when comparing rebuilt bundles. The test restores its scheduler instrumentation, cache budget and unload delay when complete.
