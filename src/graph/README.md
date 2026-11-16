# Recipe graph architecture

The graph document is the product model. React Flow is only an editor adapter.

- `model/` contains nodes, ports, documents, and validation.
- `editor/` contains commands, history, and React Flow serialization.
- `runtime/` evaluates recipes without depending on React or React Flow.
- `persistence/` owns document migrations.

`model/node-definitions.js` is the authoritative node catalog. Recipe-document
helpers re-export compatibility views of this catalog for existing callers; do
not add a second set of node defaults or port definitions there.

Do not persist React Flow nodes or edges directly. Convert them through `editor/react-flow-adapter.js` and keep recipe documents renderer- and editor-independent.
