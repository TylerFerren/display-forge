import { describe, expect, it } from 'vitest';
import { applyRecipeToSceneDocument, evaluateDesignerPreview, evaluateRecipeMaterial } from '../src/engine/recipe-bridge.js';
import { createRecipeDocument } from '../src/engine/recipe-document.js';
import { createSceneDocument, ensureSceneDocument } from '../src/engine/scene-document.js';

describe('animation and renderer-facing contracts', () => {
  it('evaluates time-dependent recipes deterministically at the same timestamp', () => {
    const document = createRecipeDocument();
    const first = evaluateRecipeMaterial(document, 1.25);
    const second = evaluateRecipeMaterial(document, 1.25);

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(second.material).toEqual(first.material);
  });

  it('changes animated procedural output as time advances', () => {
    const document = createRecipeDocument();
    const atStart = evaluateRecipeMaterial(document, 0);
    const later = evaluateRecipeMaterial(document, 2);

    expect(atStart.errors).toEqual([]);
    expect(later.errors).toEqual([]);
    expect(later.material.gradient.angle).not.toBe(atStart.material.gradient.angle);
  });

  it('applies the timestamp to the scene material, not only the renderer uniform', () => {
    const recipe = createRecipeDocument();
    const scene = createSceneDocument();
    const atStart = applyRecipeToSceneDocument(scene, recipe, 0);
    const later = applyRecipeToSceneDocument(scene, recipe, 2);

    expect(later.layers[0].material.gradient.angle).not.toBe(atStart.layers[0].material.gradient.angle);
  });

  it('applies recipe output without discarding scene output settings', () => {
    const scene = createSceneDocument();
    const recipe = createRecipeDocument();
    scene.outputs[0].width = 3840;
    scene.layers[0].material.opacity = 0.7;

    const applied = applyRecipeToSceneDocument(scene, recipe);

    expect(applied.outputs[0].width).toBe(3840);
    expect(applied.layers[0].material.opacity).toBe(0.7);
    expect(applied.layers[0].material.type).toBe('gradient');
  });

  it('adds a stable default procedural material when restoring a scene document', () => {
    const restored = ensureSceneDocument({ layers: [{ id: 'background', type: 'geometry', material: { color: '#123456' } }] });

    expect(restored.version).toBe(2);
    expect(restored.layers[0].material.type).toBe('procedural');
    expect(restored.layers[0].material.procedural.module).toBe('gradient');
  });

  it('shares Time-driven Transform output and overrides between previews at the same timestamp', () => {
    const scene = createSceneDocument();
    scene.layers[0].material.opacity = 0.7;
    scene.layers[0].material.customFragment = 'example';
    scene.layers.push({ ...scene.layers[0], id: 'additional-layer' });
    const recipe = {
      controls: { energy: 25 },
      layers: [{
        id: 'graph',
        nodes: [
          { id: 'gradient', type: 'gradient', params: { colorA: '#000000', colorB: '#ffffff' } },
          { id: 'time', type: 'time', params: { speed: 1 } },
          { id: 'transform', type: 'transform', params: { y: 0 } },
          { id: 'output', type: 'output' },
        ],
        connections: [{ from: 'gradient', to: 'transform' }, { from: 'transform', to: 'output' }],
        parameterConnections: [{ fromNode: 'time', toNode: 'transform', toParam: 'y' }],
      }],
    };

    const stage = applyRecipeToSceneDocument(scene, recipe, 0.5);
    const designer = evaluateDesignerPreview(scene, recipe, 0.5);
    expect(designer.errors).toEqual([]);
    expect(designer.document.layers[0].material).toEqual(stage.layers[0].material);
    expect(stage.layers[0].material).toMatchObject({
      opacity: 0.7,
      customFragment: 'example',
      gradient: { centerY: 0.25 },
    });
    expect(designer.document.layers).toHaveLength(1);
    expect(stage.layers[1]).toEqual(scene.layers[1]);

    const scalar = evaluateDesignerPreview(scene, recipe, 0.5, 'time');
    expect(scalar.document.layers[0].material).toMatchObject({
      scalar: true,
      procedural: { module: 'time', speed: 0.5 },
    });
  });

  it('reports disconnected output in Designer and keeps the stage fallback scene', () => {
    const scene = createSceneDocument();
    const recipe = { layers: [{ id: 'graph', nodes: [{ id: 'output', type: 'output' }] }] };

    const designer = evaluateDesignerPreview(scene, recipe);
    expect(designer.errors).toEqual(['Output is not connected.']);
    expect(designer.document.layers).toEqual([]);
    expect(applyRecipeToSceneDocument(scene, recipe)).toEqual(ensureSceneDocument(scene));
  });
});
