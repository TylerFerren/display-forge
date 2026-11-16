import { ensureRecipeDocument } from './recipe-document';

const colorKeys = new Set(['color', 'colorA', 'colorB']);

function labelForKey(key) {
  return key === 'colorA' ? 'Color A' : key === 'colorB' ? 'Color B' : 'Color';
}

function controlId(nodeId, key, nestedKey) {
  return `${nodeId}:${nestedKey ? `${nestedKey}.` : ''}${key || 'gradient'}`;
}

export function getRecipeColorControls(recipeDocument) {
  const graph = ensureRecipeDocument(recipeDocument).layers[0];
  const controls = [];
  (graph?.nodes || []).forEach(node => {
    const defaultValue = node.params?.default;
    if (node.type === 'background' && defaultValue?.type === 'gradient' && typeof defaultValue.colorA === 'string' && typeof defaultValue.colorB === 'string') {
      const id = controlId(node.id, null, 'default');
      controls.push({ controlId: id, nodeId: node.id, kind: 'gradient', nestedKey: 'default', label: node.name, value: { from: defaultValue.colorA, to: defaultValue.colorB, angle: defaultValue.angle || 0 }, defaultValue: recipeDocument.controls?.colorDefaults?.[id] || { from: defaultValue.colorA, to: defaultValue.colorB, angle: defaultValue.angle || 0 } });
      return;
    }
    if (node.type === 'ramp' && typeof node.params?.colorA === 'string' && typeof node.params?.colorB === 'string') {
      const id = controlId(node.id, null, 'ramp');
      controls.push({ controlId: id, nodeId: node.id, kind: 'ramp', label: node.name, value: { from: node.params.colorA, to: node.params.colorB, angle: 90 }, defaultValue: recipeDocument.controls?.colorDefaults?.[id] || { from: node.params.colorA, to: node.params.colorB, angle: 90 } });
      return;
    }
    if (node.type === 'gradient' && typeof node.params?.colorA === 'string' && typeof node.params?.colorB === 'string') {
      const id = controlId(node.id, null, 'gradient');
      controls.push({ controlId: id, nodeId: node.id, kind: 'gradient', label: node.name, value: { from: node.params.colorA, to: node.params.colorB, angle: node.params.angle || 0 }, defaultValue: recipeDocument.controls?.colorDefaults?.[id] || { from: node.params.colorA, to: node.params.colorB, angle: node.params.angle || 0 } });
      return;
    }
    Object.entries(node.params || {}).forEach(([key, value]) => {
      if (key === 'default' && value && typeof value === 'object') {
        ['color', 'colorA', 'colorB'].forEach(nestedKey => {
          if (typeof value[nestedKey] === 'string') { const id = controlId(node.id, nestedKey, 'default'); controls.push({ controlId: id, nodeId: node.id, key: nestedKey, nestedKey: 'default', label: `${node.name} · ${labelForKey(nestedKey)}`, value: value[nestedKey], defaultValue: recipeDocument.controls?.colorDefaults?.[id] || value[nestedKey] }); }
        });
      } else if (colorKeys.has(key) && typeof value === 'string') {
        const id = controlId(node.id, key); controls.push({ controlId: id, nodeId: node.id, key, label: `${node.name} · ${labelForKey(key)}`, value, defaultValue: recipeDocument.controls?.colorDefaults?.[id] || value });
      }
    });
  });
  return controls;
}

export function ensureRecipeEditorDefaults(recipeDocument) {
  const document = ensureRecipeDocument(recipeDocument);
  if (document.controls?.defaultsInitialized) return document;
  const colors = Object.fromEntries(getRecipeColorControls(document).map(control => [control.controlId, control.value]));
  return { ...document, controls: { ...document.controls, defaultsInitialized: true, energyDefault: Number(document.controls?.energy ?? 50), colorDefaults: colors } };
}

export function updateRecipeColor(recipeDocument, control, value) {
  const document = ensureRecipeDocument(recipeDocument);
  return {
    ...document,
    layers: document.layers.map(layer => ({
      ...layer,
      nodes: layer.nodes.map(node => {
        if (node.id !== control.nodeId) return node;
        if (control.kind === 'ramp') {
          return { ...node, params: { ...node.params, colorA: value.from, colorB: value.to } };
        }
        if (control.kind === 'gradient') {
          const nextValue = { ...(node.params?.[control.nestedKey] || {}), colorA: value.from, colorB: value.to };
          if (value.angle !== undefined) nextValue.angle = value.angle;
          return control.nestedKey
            ? { ...node, params: { ...node.params, [control.nestedKey]: nextValue } }
            : { ...node, params: { ...node.params, colorA: value.from, colorB: value.to, ...(value.angle !== undefined ? { angle: value.angle } : {}) } };
        }
        if (control.nestedKey) {
          return { ...node, params: { ...node.params, [control.nestedKey]: { ...node.params?.[control.nestedKey], [control.key]: value } } };
        }
        return { ...node, params: { ...node.params, [control.key]: value } };
      }),
    })),
  };
}
