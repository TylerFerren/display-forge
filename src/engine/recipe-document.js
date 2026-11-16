import { getPortType, graphNodeTypes, nodeDefinitions } from '../graph/model/node-definitions';
import { normalizeGraphDocument } from '../graph/model/document';

export const recipeDocumentVersion = 2;

// Compatibility exports for existing recipe-document consumers. The graph model
// is the single source of truth for node types, defaults, ports, and parameters.
export const nodeDefaults = Object.fromEntries(Object.entries(nodeDefinitions).map(([type, definition]) => [type, { ...(definition.defaults || {}) }]));
export const recipeNodeTypes = graphNodeTypes;
export const nodePortTypes = Object.fromEntries(Object.entries(nodeDefinitions).map(([type, definition]) => [type, {
  input: definition.input,
  inputs: definition.inputs,
  output: definition.output,
  params: definition.params || {},
}]));

export function getNodePortType(node, port = 'output', param) {
  return getPortType(node, port === 'parameter' ? `param:${param}` : port);
}

function createsCycle(layer, from, to) {
  const edges = [...(layer.connections || []).filter(connection => connection.to !== to), { from, to }];
  const outgoing = new Map((layer.nodes || []).map(node => [node.id, []]));
  edges.forEach(edge => outgoing.get(edge.from)?.push(edge.to));
  const visiting = new Set();
  const visited = new Set();
  const visit = id => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); if ((outgoing.get(id) || []).some(visit)) return true; visiting.delete(id); visited.add(id); return false; };
  return [...outgoing.keys()].some(visit);
}

export function validateNodeConnection(layer, { fromNode, toNode, toPort = 'input', toParam }) {
  if (!fromNode || !toNode) return { valid: false, message: 'Both nodes must exist.' };
  if (fromNode.id === toNode.id) return { valid: false, message: 'A node cannot connect to itself.' };
  const fromType = getNodePortType(fromNode, 'output');
  const targetType = getNodePortType(toNode, toPort, toParam);
  if (!fromType || !targetType) return { valid: false, message: 'That port is not available on this node.' };
  if (fromType !== targetType && fromType !== 'any' && targetType !== 'any') return { valid: false, message: `${fromNode.name} outputs ${fromType}, but ${toParam || 'this input'} requires ${targetType}.` };
  if (toPort === 'input' && createsCycle(layer, fromNode.id, toNode.id)) return { valid: false, message: 'That connection would create a cycle.' };
  return { valid: true };
}

export function createRecipeNode(type = 'solid', index = 0) {
  const definition = nodeDefinitions[type] || nodeDefinitions.solid;
  const nodeType = nodeDefinitions[type] ? type : 'solid';
  return { id: `node-${Date.now()}-${index}`, type: nodeType, name: definition.label, x: 40 + (index % 3) * 170, y: 36 + Math.floor(index / 3) * 120, params: { ...(definition.defaults || {}) } };
}

export function createRecipeDocument() {
  const nodes = [createRecipeNode('background', 0), createRecipeNode('gradient', 1), createRecipeNode('noise', 2), createRecipeNode('output', 3)];
  return {
    version: recipeDocumentVersion,
    name: 'Untitled recipe',
    description: 'A reusable Display Forge recipe.',
    duration: 30,
    controls: { energy: 50 },
    layers: [{ id: 'layer-1', name: 'Background', enabled: true, nodes, connections: [{ from: nodes[0].id, to: nodes[1].id }, { from: nodes[1].id, to: nodes[3].id }], parameterConnections: [{ fromNode: nodes[2].id, fromPort: 'output', toNode: nodes[1].id, toParam: 'angle' }] }],
  };
}

function collapseRecipeLayers(layers) {
  if (layers.length <= 1) return layers;
  const primary = { ...layers[0], id: layers[0].id || 'recipe-graph', name: 'Recipe graph', nodes: [], connections: [], parameterConnections: [] };
  const usedIds = new Set();
  layers.forEach((layer, layerIndex) => {
    const idMap = new Map();
    (layer.nodes || []).forEach(node => {
      const baseId = String(node.id || `node-${layerIndex}`);
      let id = layerIndex === 0 ? baseId : `${layer.id || `layer-${layerIndex}`}-${baseId}`;
      while (usedIds.has(id)) id = `${id}-copy`;
      usedIds.add(id);
      idMap.set(node.id, id);
      primary.nodes.push({ ...node, id });
    });
    (layer.connections || []).forEach(connection => { const from = idMap.get(connection.from); const to = idMap.get(connection.to); if (from && to) primary.connections.push({ ...connection, from, to }); });
    (layer.parameterConnections || []).forEach(connection => { const fromNode = idMap.get(connection.fromNode); const toNode = idMap.get(connection.toNode); if (fromNode && toNode) primary.parameterConnections.push({ ...connection, fromNode, toNode }); });
  });
  return [primary];
}

export function ensureRecipeDocument(document) {
  const fallback = createRecipeDocument();
  const source = document && typeof document === 'object' ? document : {};
  const layers = collapseRecipeLayers(Array.isArray(source.layers) && source.layers.length ? source.layers : fallback.layers);
  const normalized = normalizeGraphDocument({ ...source, layers });
  return {
    ...fallback,
    ...normalized,
    version: recipeDocumentVersion,
    controls: { ...fallback.controls, ...(source.controls || {}) },
    layers: normalized.layers.map(layer => ({ ...layer, name: 'Recipe graph' })),
  };
}

export function autoLayoutLayer(layer) {
  const nodes = Array.isArray(layer?.nodes) ? layer.nodes : [];
  const nodeIds = new Set(nodes.map(node => node.id));
  const connections = (layer?.connections || []).filter(connection => nodeIds.has(connection.from) && nodeIds.has(connection.to) && connection.from !== connection.to);
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  connections.forEach(connection => {
    outgoing.get(connection.from).push(connection.to);
    incoming.set(connection.to, incoming.get(connection.to) + 1);
  });
  const queue = nodes.filter(node => incoming.get(node.id) === 0).map(node => node.id);
  const depth = new Map(queue.map(id => [id, 0]));
  const visited = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    outgoing.get(id).forEach(next => {
      depth.set(next, Math.max(depth.get(next) || 0, (depth.get(id) || 0) + 1));
      incoming.set(next, incoming.get(next) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    });
  }
  nodes.forEach(node => { if (!depth.has(node.id)) depth.set(node.id, 0); });
  const columns = new Map();
  nodes.forEach(node => { const column = columns.get(depth.get(node.id)) || []; column.push(node); columns.set(depth.get(node.id), column); });
  const positions = new Map();
  [...columns.entries()].sort(([a], [b]) => a - b).forEach(([column, columnNodes]) => columnNodes.forEach((node, index) => positions.set(node.id, { x: 80 + column * 230, y: 80 + index * 120 })));
  return { ...layer, nodes: nodes.map(node => ({ ...node, ...positions.get(node.id) })) };
}

