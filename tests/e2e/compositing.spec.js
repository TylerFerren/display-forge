import { expect, test } from '@playwright/test';

test('renders both nested Blend inputs and moves their composite with Time → Transform Y', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { RenderEngine } = await import('/src/engine/render-engine.js');
    const { applyRecipeToSceneDocument, evaluateDesignerPreview } = await import('/src/engine/recipe-bridge.js');
    const { ensureRecipeDocument } = await import('/src/engine/recipe-document.js');
    const { createSceneDocument } = await import('/src/engine/scene-document.js');

    const recipe = ensureRecipeDocument({
      controls: { energy: 50 },
      layers: [{
        id: 'graph',
        nodes: [
          { id: 'red', type: 'gradient', params: { colorA: '#000000', colorB: '#ff0000' } },
          { id: 'green', type: 'gradient', params: { colorA: '#000000', colorB: '#00ff00' } },
          { id: 'blue', type: 'solid', params: { color: '#0000ff' } },
          { id: 'inner', type: 'blend' },
          { id: 'outer', type: 'blend' },
          { id: 'transform', type: 'transform' },
          { id: 'time', type: 'time' },
          { id: 'output', type: 'output' },
        ],
        connections: [
          { from: 'red', to: 'inner', toPort: 'base' },
          { from: 'green', to: 'inner', toPort: 'overlay' },
          { from: 'inner', to: 'outer', toPort: 'base' },
          { from: 'blue', to: 'outer', toPort: 'overlay' },
          { from: 'outer', to: 'transform' },
          { from: 'transform', to: 'output' },
        ],
        parameterConnections: [{ fromNode: 'time', toNode: 'transform', toParam: 'y' }],
      }],
    });
    const scene = createSceneDocument();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;width:64px;height:64px';
    document.body.append(canvas);
    const engine = new RenderEngine(canvas);
    const sample = (document, time) => {
      engine.render(document, time);
      const gl = engine.gl;
      const rgba = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      return Array.from(rgba);
    };
    try {
      return {
        start: sample(applyRecipeToSceneDocument(scene, recipe, 0), 0),
        moved: sample(applyRecipeToSceneDocument(scene, recipe, 0.5), 0.5),
        designer: sample(evaluateDesignerPreview(scene, recipe, 0.5).document, 0.5),
        still: sample(evaluateDesignerPreview(scene, recipe, 0.5, 'outer').document, 0.5),
        glError: engine.gl.getError(),
      };
    } finally {
      engine.dispose();
      canvas.remove();
    }
  });

  expect(result.glError).toBe(0);
  expect(result.start[0]).toBeGreaterThan(25);
  expect(result.start[1]).toBeGreaterThan(25);
  expect(result.start[2]).toBeGreaterThan(110);
  expect(result.moved[0]).toBeLessThan(result.still[0] - 20);
  expect(result.moved[1]).toBeLessThan(result.still[1] - 20);
  expect(result.moved[2]).toBe(result.still[2]);
  expect(result.designer).toEqual(result.moved);
});
