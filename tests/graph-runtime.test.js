import { describe, expect, it } from 'vitest';
import { createRecipeDocument, createRecipeNode } from '../src/engine/recipe-document.js';
import { evaluateGraph } from '../src/graph/runtime/evaluator.js';

describe('graph runtime', () => {
  it('evaluates the default recipe graph at a fixed timestamp', () => {
    const document = createRecipeDocument();
    const result = evaluateGraph(document, document.layers[0].id, {}, 2.5);

    expect(result.errors).toEqual([]);
    expect(result.output?.kind).toBe('color');
  });

  it('reports missing required blend inputs predictably', () => {
    const background = createRecipeNode('background', 0);
    const blend = createRecipeNode('blend', 1);
    const output = createRecipeNode('output', 2);
    const document = { layers: [{ id: 'layer-test', nodes: [background, blend, output], connections: [
      { from: background.id, to: blend.id, toPort: 'base' },
      { from: blend.id, to: output.id, toPort: 'input' },
    ], parameterConnections: [] }] };

    const result = evaluateGraph(document, 'layer-test');

    expect(result.output).toBeNull();
    expect(result.errors).toContain('Blend / Composite needs base and overlay color inputs.');
  });

  it('detects cycles during evaluation instead of recursing indefinitely', () => {
    const first = createRecipeNode('gradient', 0);
    const second = createRecipeNode('transform', 1);
    const output = createRecipeNode('output', 2);
    const document = { layers: [{ id: 'layer-cycle', nodes: [first, second, output], connections: [
      { from: first.id, to: second.id, toPort: 'input' },
      { from: second.id, to: first.id, toPort: 'input' },
      { from: first.id, to: output.id, toPort: 'input' },
    ], parameterConnections: [] }] };

    const result = evaluateGraph(document, 'layer-cycle');

    expect(result.errors.some(error => error.startsWith('Cycle detected'))).toBe(true);
  });

  it('preserves both inputs through a blend and nested blend chain', () => {
    const base = createRecipeNode('solid', 0);
    base.params.color = '#112233';
    const overlay = createRecipeNode('solid', 1);
    overlay.params.color = '#aabbcc';
    const firstBlend = createRecipeNode('blend', 2);
    const secondBlend = createRecipeNode('blend', 3);
    const finalOverlay = createRecipeNode('solid', 4);
    finalOverlay.params.color = '#ffffff';
    const output = createRecipeNode('output', 5);
    const document = { layers: [{ id: 'layer-blend', nodes: [base, overlay, firstBlend, secondBlend, finalOverlay, output], connections: [
      { from: base.id, to: firstBlend.id, toPort: 'base' },
      { from: overlay.id, to: firstBlend.id, toPort: 'overlay' },
      { from: firstBlend.id, to: secondBlend.id, toPort: 'base' },
      { from: finalOverlay.id, to: secondBlend.id, toPort: 'overlay' },
      { from: secondBlend.id, to: output.id, toPort: 'input' },
    ], parameterConnections: [] }] };

    const result = evaluateGraph(document, 'layer-blend');

    expect(result.errors).toEqual([]);
    expect(result.output?.material.effects.blend.material.color).toBe('#ffffff');
    expect(result.values[firstBlend.id].material.effects.blend.material.color).toBe('#aabbcc');
    expect(result.output.material.composite.base.composite.overlay.color).toBe('#aabbcc');
    expect(result.output.material.composite.base.composite.base.color).toBe('#112233');
  });

  it('applies a scalar parameter driver before evaluating the color node', () => {
    const field = createRecipeNode('noise', 0);
    const gradient = createRecipeNode('gradient', 1);
    const output = createRecipeNode('output', 2);
    const document = { controls: { energy: 50 }, layers: [{ id: 'layer-param', nodes: [field, gradient, output], connections: [
      { from: gradient.id, to: output.id, toPort: 'input' },
    ], parameterConnections: [{ fromNode: field.id, toNode: gradient.id, toParam: 'angle' }] }] };

    const result = evaluateGraph(document, 'layer-param', {}, 1);

    expect(result.errors).toEqual([]);
    expect(result.output.material.gradient.angle).toBe(result.values[field.id].value);
  });

  it('propagates a time parameter through transform output evaluation', () => {
    const source = createRecipeNode('gradient', 0);
    const time = createRecipeNode('time', 1);
    const transform = createRecipeNode('transform', 2);
    const output = createRecipeNode('output', 3);
    const document = { controls: { energy: 50 }, layers: [{ id: 'layer-transform-time', nodes: [source, time, transform, output], connections: [
      { from: source.id, to: transform.id, toPort: 'input' },
      { from: transform.id, to: output.id, toPort: 'input' },
    ], parameterConnections: [{ fromNode: time.id, toNode: transform.id, toParam: 'y' }] }] };

    const atStart = evaluateGraph(document, 'layer-transform-time', {}, 0);
    const later = evaluateGraph(document, 'layer-transform-time', {}, 1);

    expect(atStart.errors).toEqual([]);
    expect(later.errors).toEqual([]);
    expect(atStart.output.material.gradient.centerY).not.toBe(later.output.material.gradient.centerY);
  });

  it('resolves color and enum parameter drivers consistently', () => {
    const colorSource = createRecipeNode('solid', 0);
    colorSource.params.color = '#123456';
    const scalarSource = createRecipeNode('coordinate', 1);
    const gradient = createRecipeNode('gradient', 2);
    const pattern = createRecipeNode('pattern', 3);
    const output = createRecipeNode('output', 4);
    const document = { layers: [{ id: 'layer-params', nodes: [colorSource, scalarSource, gradient, pattern, output], connections: [
      { from: gradient.id, to: pattern.id, toPort: 'input' },
      { from: pattern.id, to: output.id, toPort: 'input' },
    ], parameterConnections: [
      { fromNode: colorSource.id, toNode: gradient.id, toParam: 'colorA' },
      { fromNode: scalarSource.id, toNode: pattern.id, toParam: 'pattern' },
    ] }] };

    const result = evaluateGraph(document, 'layer-params', {}, 0);

    expect(result.errors).toEqual([]);
    expect(result.values[gradient.id].material.gradient.colorA).toBe('#123456');
    expect(result.values[pattern.id].material.pattern.pattern).toBe('stripes');
  });

  it('reports cycles that combine main and parameter dependencies', () => {
    const gradient = createRecipeNode('gradient', 0);
    const transform = createRecipeNode('transform', 1);
    const output = createRecipeNode('output', 2);
    const document = { layers: [{ id: 'layer-mixed-cycle', nodes: [gradient, transform, output], connections: [
      { from: gradient.id, to: transform.id, toPort: 'input' },
      { from: transform.id, to: output.id, toPort: 'input' },
    ], parameterConnections: [{ fromNode: transform.id, toNode: gradient.id, toParam: 'angle' }] }] };

    const result = evaluateGraph(document, 'layer-mixed-cycle');

    expect(result.errors.some(error => error.startsWith('Cycle detected'))).toBe(true);
  });
});
