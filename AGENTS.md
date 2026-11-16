# Display Forge development rules

## Before changing code

- Inspect relevant existing code, tests, and data contracts before editing.
- Identify affected consumers and dependencies before changing shared behavior.
- Preserve the current architecture and public data shapes unless a change is explicitly required.
- Prefer the smallest focused change; do not rewrite working systems or remove functionality to make a check pass.

## Graph and rendering code

- Keep graph documents independent from React Flow editor state.
- Keep node definitions, ports, defaults, validation, evaluation, and rendering behavior consistent.
- Reuse shared graph and rendering utilities instead of duplicating operations in individual nodes.
- Treat serialized recipe and scene documents as versioned contracts.
- Add regression coverage for graph, node, compositing, persistence, or rendering behavior changes.

## Verification

- Add or update tests for behavioral changes and bug fixes.
- Run focused tests, then run `npm run verify` for meaningful changes.
- Never claim a check passed unless it actually ran successfully.
- Report checks that could not run and any remaining unverified behavior.
- Do not weaken or delete a test to accommodate incorrect behavior.
- For bug fixes, reproduce the issue in a test when practical, make the smallest correction, run focused regressions, then run `npm run verify`.
- Run `npm run test:e2e` when changing user workflows, navigation, persistence, or layout-sensitive UI.
- Treat visual snapshot updates as reviewed changes; do not update snapshots merely to hide an unexpected regression.
- Disclose untested browser, WebGL, export, or external-service behavior explicitly.

## Scope and maintainability

- Avoid unnecessary dependencies and enterprise-level abstractions.
- Preserve unrelated user changes in the working tree.
- Document significant architectural decisions and intentional behavior changes.
- For larger changes, state a brief implementation plan before editing; small low-risk changes may proceed directly.
