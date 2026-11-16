import { evaluateGraph } from '../graph/runtime/evaluator';
import { ensureSceneDocument } from './scene-document';

function evaluateRecipeOutput(recipeDocument, time, nodeId = null) {
  const layer = recipeDocument?.layers?.[0];
  if (!layer) return { output: null, errors: ['Recipe has no graph layer.'] };
  const { output, errors } = evaluateGraph(recipeDocument, layer.id, {}, time, nodeId);
  return { output: errors.length ? null : output, errors };
}

export function evaluateRecipeMaterial(recipeDocument, time = 0) {
  const { output, errors } = evaluateRecipeOutput(recipeDocument, time);
  return { material: output?.kind === 'color' ? output.material : null, errors };
}

function scalarPreviewMaterial({ field, value }) {
  if (field) {
    return {
      type: 'procedural',
      color: '#111311',
      colorB: '#f4f7ef',
      procedural: { ...field, intensity: 1 },
      scalar: true,
    };
  }
  const intensity = Number(value);
  const normalized = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0.5;
  const channel = Math.round(normalized * 255).toString(16).padStart(2, '0');
  const color = '#' + channel.repeat(3);
  return { type: 'solid', color, colorB: color, opacity: 1 };
}

function withRecipeMaterial(layer, material) {
  const { opacity, customFragment } = layer.material || {};
  return {
    ...layer,
    material: {
      ...material,
      ...(opacity !== undefined ? { opacity } : {}),
      ...(customFragment !== undefined ? { customFragment } : {}),
    },
  };
}

export function evaluateDesignerPreview(sceneDocument, recipeDocument, time = 0, nodeId = null) {
  const { output, errors } = evaluateRecipeOutput(recipeDocument, time, nodeId);
  let material = null;
  if (output?.kind === 'color') material = output.material;
  if (output?.kind === 'scalar') material = scalarPreviewMaterial(output);
  const document = ensureSceneDocument(sceneDocument);
  const layers = material
    ? [{ ...withRecipeMaterial(document.layers[0], material), id: 'recipe-preview', visible: true }]
    : [];
  return { document: { ...document, layers }, errors };
}

export function applyRecipeToSceneDocument(sceneDocument, recipeDocument, time = 0) {
  const document = ensureSceneDocument(sceneDocument);
  const { material } = evaluateRecipeMaterial(recipeDocument, time);
  if (!material) return document;
  const [firstLayer, ...otherLayers] = document.layers;
  return { ...document, layers: [withRecipeMaterial(firstLayer, material), ...otherLayers] };
}
