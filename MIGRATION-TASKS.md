# React migration task list

The vanilla implementation was removed on 2026-11-07. The React/Vite app is now the only active implementation. The following capabilities existed in the removed implementation and need to be reimplemented if they remain part of the product scope.

## Rendering and preview

- [x] Establish a React-owned WebGL2 render-engine boundary with a versioned scene document.
- [ ] Port the WebGL2 shader renderer from the old `app.js` implementation into the new engine.
- [ ] Add shader compilation and the node-to-GLSL pipeline to the new engine.
- [ ] Add perspective/orthographic camera matrices and 3D transforms.
- [ ] Add geometry buffers, materials, lights, and render passes.
- [ ] Add image/video texture assets and compositing layers.
- [ ] Add custom GLSL material compilation with validation and fallback errors.
- [ ] Add linear working color, tone mapping, display transforms, and output profiles.
- [ ] Recreate the full set of shader effects and their parameters: gradient, noise, mirror, blend, grain, waves, contours, rings, stars, bloom, prism, rays, ink, halftone, particles, horizon, ribbons, refraction, watercolor, star trails, and mosaic.
- [ ] Preserve animated energy and grain-driven parameter resolution in the renderer.
- [ ] Preserve separate-feed versus span-layout rendering in the production renderer.

## Recipe and scene model

- [x] Replace the Browser and Editor recipe controls with scene-layer and material editing foundations.
- [x] Establish a versioned recipe document with layers, nodes, connections, and editable node parameters.
- [ ] Consolidate the recipe catalog into one source of truth with complete node definitions, colors, defaults, descriptions, and connections.
- [ ] Support custom recipe creation, persistence, and catalog loading in React.
- [ ] Support importing and exporting recipe JSON files.
- [ ] Preserve per-scene graph, color, and parameter settings when scenes are duplicated or reordered.
- [ ] Add migration for existing `stillframe-prototype` localStorage data into the current `display-forge-react` state format.

## Recipe Designer

- [x] Establish the Designer graph foundation with React Flow.
- [x] Add a recipe-driven Background node to the default graph.
- [x] Add React Flow node/edge adapters and typed connection validation.
- [x] Replace the React Designer placeholder with the first layer/node graph editor pass.
- [x] Add a full canvas graph with draggable nodes and visible connection wires.
- [x] Add a docked bottom-right live recipe preview using the shared renderer.
- [x] Add automatic upstream-to-downstream graph layout.
- [x] Add parameter ports and parameter-driver connections to the recipe graph.
- [x] Add automatic upstream-to-downstream graph layout.
- [ ] Add graph history, multi-select, snapping, and keyboard shortcuts.
- [ ] Add node creation, deletion, enable/disable, drag-to-reorder, and connections.
- [ ] Add node property editing and energy remapping controls.
- [ ] Add designer graph pan, zoom, and fit-to-view behavior.
- [ ] Add the designer's layout, square, and wide preview modes.
- [ ] Add designer dependency summaries and live renderer updates.
- [ ] Add save-to-catalog and export-to-JSON actions.

## Export

- [ ] Replace the React Export placeholder with the export workflow.
- [ ] Add target, resolution, FPS, and duration controls.
- [ ] Implement playlist rendering across scenes.
- [ ] Implement canvas capture and `MediaRecorder` encoding.
- [ ] Add export progress, cancellation/error handling, and download behavior.
- [ ] Verify export output uses the same renderer as the interactive preview.

## Layouts and persistence

- [ ] Restore named saved-layout creation, selection, and deletion.
- [ ] Restore saved-layout validation and screen snapshot behavior.
- [ ] Define a versioned React state schema and migrations for future changes.

## Documentation and cleanup

- [ ] Add automated coverage for state migrations, recipe operations, playback, and export settings.
- [ ] Update product documentation as each missing capability is reimplemented.

