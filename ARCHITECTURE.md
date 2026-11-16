# Display Forge architecture

## Current boundaries

Display Forge is a local-first React/Vite prototype. The boundaries below are
logical responsibilities within one application, not separate services.

### Application and editor UI

`src/App.jsx` owns the current project shell, screen layout controls, tabs,
playlist state, and browser persistence wiring. The active graph editor is
`src/components/designer-flow.jsx`, which adapts the recipe document to
React Flow and sends graph changes back through document updates.

React Flow is an editor surface only. React Flow node and edge objects are not
the persisted product model.

### Graph data model

`src/graph/model/` defines graph nodes, ports, defaults, documents, and typed
connection validation. `node-definitions.js` is the single source of truth for
node types, labels, ports, defaults, parameter types, and metadata.

Recipe documents contain versioned layers with nodes, ordinary connections,
and parameter connections. Node positions are editor metadata on the document;
React Flow-specific state is not serialized.

### Graph editing

`src/graph/editor/` contains editing commands, history, and React Flow
adapters. Editor operations should produce immutable document updates and keep
connections consistent when nodes are removed or replaced.

### Evaluation

`src/graph/runtime/evaluator.js` evaluates a graph by dependency traversal at a
given timestamp. It produces typed runtime values such as scalar fields and
color materials. It does not import React or React Flow.

Missing inputs and cycles produce explicit evaluation errors. Parameter
connections are dependencies too and are evaluated before the destination node
operation.

### Scene and rendering

`src/engine/recipe-bridge.js` converts evaluated recipe output into a scene
document. `src/engine/scene-document.js` owns the versioned scene shape.
`src/engine/render-engine.js` owns WebGL2 context setup, shader programs,
render targets, blur/bloom/trail passes, and drawing the scene document.

The stage and Designer previews share output evaluation and scene material
overrides in the recipe bridge. The stage keeps the project's layers and falls
back to its scene material when evaluation fails. Designer isolates the recipe
layer, supports inspecting scalar nodes, and displays graph errors. Both use
the same render engine. Video export itself is not implemented yet.

The app owns one session playhead for stage and Designer previews. Timeline
components subscribe to clock ticks without rerendering the graph workspace.
Recipe auditions are transient preview inputs. Applying, adding, or remixing
a recipe is an explicit scene update.

### Persistence and templates

Editor and Designer both normalize recipes through `ensureRecipeDocument`.
It collapses legacy recipe layers and delegates node, port, and parameter
migration to the graph model. A playlist scene owns its recipe snapshot
after it is added from the library. Scene activation and thumbnails use that
snapshot, with a library fallback for older scenes without one. Saving to the
library is an explicit action.

The current browser persistence stores project state in localStorage. Database,
authentication, and server persistence are future boundaries, not current
dependencies.

## Change guidance

For graph behavior, change the model contract first, then update the editor,
evaluator, renderer bridge, and tests as needed. Do not put evaluation rules in
React components or React Flow callbacks. For renderer changes, preserve the
scene-document boundary and add a deterministic material or frame regression
test where a browser/WebGL test is not available.

Known prototype limitations are tracked in [MIGRATION-TASKS.md](MIGRATION-TASKS.md).
