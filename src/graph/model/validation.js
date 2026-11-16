import { getPortType } from './node-definitions';
function compatibleTypes(sourceType, targetType) { return sourceType === targetType || sourceType === 'any' || targetType === 'any' || (targetType === 'enum' && sourceType === 'scalar'); }
function hasPath(layer, start, target, replacingTarget, replacingPort) {
  const ordinaryEdges = (layer.connections || [])
    .filter(edge => edge.to !== replacingTarget || (replacingPort && (edge.toPort || 'input') !== replacingPort))
    .map(edge => ({ from: edge.from, to: edge.to }));
  const parameterEdges = (layer.parameterConnections || [])
    .filter(edge => edge.toNode !== replacingTarget || (replacingPort && replacingPort !== `param:${edge.toParam}`))
    .map(edge => ({ from: edge.fromNode, to: edge.toNode }));
  const outgoing = new Map((layer.nodes || []).map(node => [node.id, []]));
  [...ordinaryEdges, ...parameterEdges].forEach(edge => outgoing.get(edge.from)?.push(edge.to));
  const seen = new Set();
  const visit = id => {
    if (id === target) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (outgoing.get(id) || []).some(visit);
  };
  return visit(start);
}

export function validateGraphConnection(layer, connection) {
  const source = layer.nodes.find(node => node.id === connection.source);
  const target = layer.nodes.find(node => node.id === connection.target);
  if (!source || !target) return { valid: false, message: 'Both nodes must exist.' };
  if (source.id === target.id) return { valid: false, message: 'A node cannot connect to itself.' };
  const sourceType = getPortType(source, connection.sourceHandle || 'output');
  const targetPort = connection.targetHandle || 'input';
  const targetType = getPortType(target, targetPort);
  if (!sourceType) return { valid: false, message: `${source.name} does not expose that output port.` };
  if (!targetType) return { valid: false, message: `${target.name} does not accept that input.` };
  if (!compatibleTypes(sourceType, targetType)) return { valid: false, message: `Type mismatch: ${sourceType} cannot drive ${targetType}.` };
  if (hasPath(layer, target.id, source.id, target.id, targetPort)) return { valid: false, message: 'That connection would create a cycle.' };
  return { valid: true };
}
