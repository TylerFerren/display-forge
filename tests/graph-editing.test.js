import { describe, expect, it } from 'vitest';
import { graphCommands } from '../src/graph/editor/commands.js';
import { createHistory } from '../src/graph/editor/history.js';
import { createRecipeDocument, createRecipeNode, ensureRecipeDocument } from '../src/engine/recipe-document.js';
import { migrateGraphDocument } from '../src/graph/persistence/migrations.js';

describe('graph editing and persistence', () => {
  it('adds, moves, and removes a node with all dependent edges', () => {
    const document = createRecipeDocument();
    const layer = document.layers[0];
    const node = createRecipeNode('glow', 5);
    const withNode = graphCommands.addNode(document, layer.id, node);
    const withEdges = {
      ...withNode,
      layers: withNode.layers.map(item => item.id === layer.id ? {
        ...item,
        connections: [...item.connections, { from: node.id, to: item.nodes[0].id, toPort: 'input' }],
        parameterConnections: [{ fromNode: node.id, toNode: item.nodes[1].id, toParam: 'angle' }],
      } : item),
    };
    const moved = graphCommands.moveNode(withEdges, layer.id, node.id, { x: 400, y: 240 });
    const removed = graphCommands.removeNode(moved, layer.id, node.id);
    const finalLayer = removed.layers[0];

    expect(moved.layers[0].nodes.find(item => item.id === node.id)).toMatchObject({ x: 400, y: 240 });
    expect(finalLayer.nodes.some(item => item.id === node.id)).toBe(false);
    expect(finalLayer.connections.some(edge => edge.from === node.id || edge.to === node.id)).toBe(false);
    expect(finalLayer.parameterConnections.some(edge => edge.fromNode === node.id || edge.toNode === node.id)).toBe(false);
  });

  it('supports undo, redo, and redo invalidation after a new commit', () => {
    const initial = { value: 0 };
    const history = createHistory(initial);
    history.commit({ value: 1 });
    history.commit({ value: 2 });

    expect(history.undo()).toEqual({ value: 1 });
    expect(history.redo()).toEqual({ value: 2 });
    history.undo();
    history.commit({ value: 3 });
    expect(history.redo()).toEqual({ value: 3 });
  });

  it('round-trips graph documents without changing evaluation structure', () => {
    const original = ensureRecipeDocument(createRecipeDocument());
    const restored = ensureRecipeDocument(JSON.parse(JSON.stringify(original)));

    expect(restored.version).toBe(original.version);
    expect(restored.layers[0].nodes.map(node => node.type)).toEqual(original.layers[0].nodes.map(node => node.type));
    expect(restored.layers[0].connections).toEqual(original.layers[0].connections);
    expect(restored.layers[0].parameterConnections).toEqual(original.layers[0].parameterConnections);
  });

  it('fills missing serialized connection arrays during migration', () => {
    const migrated = migrateGraphDocument({ version: 0, layers: [{ id: 'layer-1', nodes: [] }] });

    expect(migrated.layers[0].connections).toEqual([]);
    expect(migrated.layers[0].parameterConnections).toEqual([]);
  });

  it('upgrades legacy blend ports and parameter handles at the recipe boundary', () => {
    const document = ensureRecipeDocument({
      version: 1,
      controls: { energy: 42 },
      layers: [{
        id: 'legacy',
        nodes: [
          { id: 'base', type: 'solid' },
          { id: 'overlay', type: 'solid' },
          { id: 'blend', type: 'mix' },
          { id: 'time', type: 'time' },
          { id: 'output', type: 'output' },
        ],
        connections: [
          { from: 'base', to: 'blend' },
          { from: 'overlay', to: 'blend', toPort: 'overlay' },
          { from: 'blend', to: 'output' },
        ],
        parameterConnections: [{ fromNode: 'time', toNode: 'blend', toParam: 'param:amount' }],
      }],
    });

    expect(document.controls.energy).toBe(42);
    expect(document.layers[0].nodes.find(node => node.id === 'blend')).toMatchObject({
      type: 'blend', params: { amount: 0.5, mode: 'mix' },
    });
    expect(document.layers[0].connections[0]).toEqual({ from: 'base', to: 'blend', toPort: 'base' });
    expect(document.layers[0].parameterConnections).toEqual([{ fromNode: 'time', toNode: 'blend', toParam: 'amount' }]);
    expect(ensureRecipeDocument(document)).toEqual(document);
  });
});
