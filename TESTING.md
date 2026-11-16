# Testing

## Ordinary verification

Run `npm run verify` to execute the pure JavaScript unit tests and then the production build.

Run only the unit suite with `npm run test:unit`.

Run browser end-to-end and visual regression tests with `npm run test:e2e`.
The suite starts Vite automatically and currently targets Chromium. Update a
visual baseline intentionally with `npx playwright test --update-snapshots` and
review the resulting image before committing it.

## Current scope

The unit suite covers graph contracts, connection validation, normalization,
graph editing commands, history, serialization, recipe-library snapshots,
representative node combinations, animation determinism, and the
renderer-facing material bridge. The browser suite covers layout loading,
local persistence, workspace navigation, preview masking, and a header visual
baseline. Full-canvas WebGL visual regression and video export tests are not
configured yet and must not be reported as verified.

When changing graph or rendering behavior, add a focused regression test before refactoring shared logic.
