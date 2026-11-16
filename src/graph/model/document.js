import { getPortType, nodeDefinitions } from './node-definitions';
function compatibleTypes(sourceType, targetType) { return sourceType === targetType || sourceType === 'any' || targetType === 'any' || (targetType === 'enum' && sourceType === 'scalar'); }

export const graphVersion = 1;

export function createGraphNode(type = 'solid', index = 0) {
  const definition = nodeDefinitions[type] || nodeDefinitions.solid;
  const nodeType = nodeDefinitions[type] ? type : 'solid';
  return { id: `node-${Date.now()}-${index}`, type: nodeType, name: definition.label, x: 80 + index * 220, y: 80, params: { ...(definition.defaults || {}) } };
}

function validConnection(nodes, edge) {
  const source = nodes.find(node => node.id === edge.from);
  const target = nodes.find(node => node.id === edge.to);
  const targetPort = edge.toPort || 'input';
  return Boolean(source && target && getPortType(source, 'output') && getPortType(target, targetPort) && getPortType(source, 'output') === getPortType(target, targetPort));
}

function validParameterConnection(nodes, edge) {
  const source = nodes.find(node => node.id === edge.fromNode);
  const target = nodes.find(node => node.id === edge.toNode);
  const sourceType = getPortType(source, 'output');
  const targetType = getPortType(target, `param:${edge.toParam}`);
  return Boolean(source && target && sourceType && targetType && compatibleTypes(sourceType, targetType));
}

function normalizeParameterConnection(edge) {
  if (!edge || typeof edge !== 'object') return edge;
  return { ...edge, toParam: String(edge.toParam || '').replace(/^param:/, '') };
}

export function normalizeGraphDocument(document, colors = ['#172426', '#668f76', '#d2cc83']) {
  const source = document || {};
  const layers = (source.layers || []).map(layer => {
    const sourceNodes = Array.isArray(layer.nodes) ? layer.nodes : [];
    const background = sourceNodes.find(node => node.type === 'background');
    const output = sourceNodes.find(node => node.type === 'output');
    const protectedIds = new Set(sourceNodes.filter(node => (node.type === 'background' && node !== background) || (node.type === 'output' && node !== output)).map(node => node.id));
    const nodes = sourceNodes.filter(node => !protectedIds.has(node.id)).map(node => {
      const normalized = node.type === 'mix' ? { ...node, type: 'blend', name: nodeDefinitions.blend.label, params: { ...node.params, mode: node.params?.mode || 'mix' } } : node;
      const definition = nodeDefinitions[normalized.type] || {};
      return { ...normalized, params: { ...(definition.defaults || {}), ...(normalized.params || {}) } };
    });
    const legacy = background?.params || {};
    const defaultValue = legacy.default || (legacy.mode === 'solid'
      ? { type: 'solid', color: legacy.color || legacy.colorA || colors[1] }
      : { type: 'gradient', colorA: legacy.colorA || colors[0], colorB: legacy.colorB || colors[2], angle: legacy.angle || 0 });
    const normalizedBackground = background ? { ...background, params: { default: defaultValue } } : (() => {
      const node = createGraphNode('background', 0);
      node.name = 'Background';
      node.params = { default: { type: 'gradient', colorA: colors[0], colorB: colors[2], angle: 0 } };
      return node;
    })();
    const normalizedOutput = output || createGraphNode('output', nodes.length + 1);
    const normalizedNodes = [normalizedBackground, ...nodes.filter(node => node.id !== normalizedBackground.id && node.id !== normalizedOutput.id), normalizedOutput];
    const legacyConnections = (layer.connections || []).map(edge => { const target = normalizedNodes.find(node => node.id === edge.to); if (edge.toPort || !target) return edge; if (['mix', 'blend'].includes(target.type)) return { ...edge, toPort: 'base' }; if (target.type === 'mask') return { ...edge, toPort: 'color' }; return edge; });
    const connections = legacyConnections.filter(edge => !protectedIds.has(edge.from) && !protectedIds.has(edge.to) && validConnection(normalizedNodes, edge));
    const parameterConnections = (layer.parameterConnections || []).map(normalizeParameterConnection).filter(edge => !protectedIds.has(edge.fromNode) && !protectedIds.has(edge.toNode) && validParameterConnection(normalizedNodes, edge));
    return { ...layer, nodes: normalizedNodes, connections, parameterConnections };
  });
  return { version: graphVersion, ...source, layers };
}
