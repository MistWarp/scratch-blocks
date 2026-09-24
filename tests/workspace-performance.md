# Workspace performance check

Serve scratch-blocks over HTTP and open `tests/workspace-performance.html`. Run the button with the tab visible. It builds a 1,200-block stack, edits its final numeric input, scrolls it out of view and back, then forces cache eviction. It reports load time, longest scheduled tasks, whether the script stayed cached, revisit time, and whether eviction completed. These are JavaScript callback timings, not a guarantee about browser paint or frame presentation.

For a comparison against the committed engine, prepare the ignored baseline fixture:

```sh
mkdir -p node_modules/.cache/mistwarp-performance
git show HEAD:blockly_compressed_vertical.js > node_modules/.cache/mistwarp-performance/baseline.js
```

Then open `tests/workspace-performance.html?baseline=1`. Disable the browser cache when comparing rebuilt bundles. The test restores its scheduler instrumentation, cache budget and unload delay when complete.

## Scrolling through many scripts

`tests/workspace-scroll-performance.html` lays out 400 eight-block scripts in a grid, loads them with the deferred loader, then scrolls the viewport down and back up at 40 pixels per frame while timing the loader's animation frames, the intersection checks, `resizeContents` and `getHeightWidth`. It also times a field edit on a visible block afterwards. Use `?columns=`, `?rows=` and `?stack=` to change the grid, and `?baseline=1` to run the fixture above instead of the committed engine. The counters that matter are the frame gaps over 25 ms, the total intersection and `resizeContents` time per sweep, and how many blocks are rendered after each sweep.
