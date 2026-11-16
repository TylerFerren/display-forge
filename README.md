# Display Forge

A local-first React/Vite app for planning display layouts and building procedural worship backgrounds.

## Run it

Install dependencies with `npm install`, then run `npm run dev`. Use `npm run build` to create a production build.

Run `npm run verify` before meaningful changes are handed off. It runs the unit
tests and production build. See [TESTING.md](TESTING.md) for current coverage.

## Prototype features

- Arrange multiple screens and save or recall named layouts.
- Browse recipes, adjust their colors and energy, and preview playlist scenes.
- Preview a shared canvas across screens or separate feeds.
- Store project settings in the browser's local storage.

The remaining migration work is tracked in [MIGRATION-TASKS.md](MIGRATION-TASKS.md). The React UI currently contains placeholders for the full Recipe Designer and video export workflows.

Architecture documentation:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [NODE_CONTRACTS.md](NODE_CONTRACTS.md)
- [DECISIONS.md](DECISIONS.md)
- [AGENTS.md](AGENTS.md)
