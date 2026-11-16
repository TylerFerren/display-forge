import { describe, expect, it } from 'vitest';
import { createGraphNode, normalizeGraphDocument } from '../src/graph/model/document.js';
import { nodeDefinitions } from '../src/graph/model/node-definitions.js';
import { validateGraphConnection } from '../src/graph/model/validation.js';
import { createRecipeNode, nodeDefaults, nodePortTypes, recipeNodeTypes } from '../src/engine/recipe-document.js';

describe('graph model', () => {
  it('uses the graph catalog for recipe node types, defaults, and ports', () => {
    expect(recipeNodeTypes).toEqual(Object.keys(nodeDefinitions));

    for (const type of recipeNodeTypes) {
      const definition = nodeDefinitions[type];
      const node = createRecipeNode(type, 0);

      expect(node.type).toBe(type);
      expect(node.params).toEqual(definition.defaults);
      expect(nodeDefaults[type]).toEqual(definition.defaults);
      expect(nodePortTypes[type]).toMatchObject({
        input: definition.input,
        inputs: definition.inputs,
        output: definition.output,
        params: definition.params,
      });
    }
  });

  it('accepts compatible typed connections', () => {
    const source = createGraphNode('solid', 0);
    const target = createGraphNode('blend', 1);
    const layer = { nodes: [source, target], connections: [], parameterConnections: [] };

    expect(validateGraphConnection(layer, { source: source.id, target: target.id, sourceHandle: 'output', targetHandle: 'base' })).toEqual({ valid: true });
  });

  it('accepts color and scalar sources for parameter ports', () => {
    const colorSource = createGraphNode('solid', 0);
    const colorTarget = createGraphNode('gradient', 1);
    const scalarSource = createGraphNode('noise', 2);
    const enumTarget = createGraphNode('pattern', 3);
    const layer = { nodes: [colorSource, colorTarget, scalarSource, enumTarget], connections: [], parameterConnections: [] };

    expect(validateGraphConnection(layer, { source: colorSource.id, target: colorTarget.id, targetHandle: 'param:colorA' }).valid).toBe(true);
    expect(validateGraphConnection(layer, { source: scalarSource.id, target: enumTarget.id, targetHandle: 'param:pattern' }).valid).toBe(true);
  });

  it('rejects incompatible typed connections', () => {
    const source = createGraphNode('noise', 0);
    const target = createGraphNode('blend', 1);
    const layer = { nodes: [source, target], connections: [], parameterConnections: [] };

    expect(validateGraphConnection(layer, { source: source.id, target: target.id, sourceHandle: 'output', targetHandle: 'base' }).valid).toBe(false);
  });

  it('rejects ordinary graph cycles', () => {
    const first = createGraphNode('gradient', 0);
    const second = createGraphNode('transform', 1);
    const layer = { nodes: [first, second], connections: [{ from: first.id, to: second.id, toPort: 'input' }], parameterConnections: [] };

    expect(validateGraphConnection(layer, { source: second.id, target: first.id, sourceHandle: 'output', targetHandle: 'input' }).valid).toBe(false);
  });

  it('rejects cycles that pass through parameter connections', () => {
    const field = createGraphNode('noise', 0);
    const gradient = createGraphNode('gradient', 1);
    const layer = {
      nodes: [field, gradient],
      connections: [{ from: field.id, to: gradient.id, toPort: 'input' }],
      parameterConnections: [],
    };

    expect(validateGraphConnection(layer, {
      source: gradient.id,
      target: field.id,
      sourceHandle: 'output',
      targetHandle: 'param:scale',
    }).valid).toBe(false);
  });

  it('normalizes legacy mix nodes and preserves structural nodes', () => {
    const document = normalizeGraphDocument({ layers: [{ id: 'layer-normalize', nodes: [
      { id: 'background-1', type: 'background', params: { mode: 'solid', color: '#123456' } },
      { id: 'mix-1', type: 'mix', params: {} },
      { id: 'output-1', type: 'output', params: {} },
    ], connections: [] }] });

    const nodes = document.layers[0].nodes;
    expect(nodes.map(node => node.type)).toEqual(['background', 'blend', 'output']);
    expect(nodes[0].params.default).toEqual({ type: 'solid', color: '#123456' });
    expect(nodes[1].params.mode).toBe('mix');
  });

  it('restores parameter defaults and canonicalizes parameter handles', () => {
    const time = { id: 'time-1', type: 'time', params: {} };
    const transform = { id: 'transform-1', type: 'transform', params: {} };
    const document = normalizeGraphDocument({ layers: [{ id: 'layer-parameters', nodes: [
      { id: 'background-1', type: 'background', params: {} }, time, transform, { id: 'output-1', type: 'output', params: {} },
    ], connections: [{ from: transform.id, to: 'output-1', toPort: 'input' }], parameterConnections: [{ fromNode: time.id, toNode: transform.id, toParam: 'param:y' }] }] });

    const layer = document.layers[0];
    expect(layer.nodes.find(node => node.id === transform.id).params).toMatchObject(nodeDefinitions.transform.defaults);
    expect(layer.parameterConnections).toEqual([{ fromNode: time.id, toNode: transform.id, toParam: 'y' }]);
  });
});
