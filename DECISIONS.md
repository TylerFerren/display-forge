# Architecture decisions

## ADR-001: Keep the graph model independent from React Flow

Status: Accepted

React Flow is used for visual editing, but recipe documents are the product
model. This keeps saved designs independent from editor implementation details
and allows the evaluator and future export path to run without React.

## ADR-002: Use one authoritative node catalog

Status: Accepted

`src/graph/model/node-definitions.js` owns node types, defaults, ports, and
metadata. `src/engine/recipe-document.js` retains compatibility exports for
existing callers but derives them from the graph catalog. This prevents editor,
validation, persistence, and runtime behavior from drifting apart.

## ADR-003: Prefer pure runtime evaluation before optimization

Status: Accepted

Graph evaluation is a pure document/time boundary with explicit errors. Caching
or GPU-side evaluation can be added later after correctness and invalidation
rules are measured and covered by tests.

## ADR-004: Keep persistence local-first for the prototype

Status: Accepted

The current application persists browser state locally and uses versioned
documents plus normalization. A database or authentication service is deferred
until product requirements justify the additional operational complexity.

## ADR-005: Use focused verification instead of mandatory release workflow

Status: Accepted

The one-developer prototype uses `npm run verify` for unit tests and the
production build. Browser, visual, and export checks will be added when those
systems are implemented. Pull-request gates and deployment infrastructure are
deferred.
