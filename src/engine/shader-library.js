import { createRecipeDocument, createRecipeNode } from './recipe-document';

// Proven graph recipes used by the simple Editor. These are starter graphs,
// not opaque shader modules: every visual behavior remains editable as nodes.

export const shaderModules = {
  gradient: { id: 'gradient', label: 'Gradient field', description: 'A calm two-color field with gentle motion.' },
  noise: { id: 'noise', label: 'Flowing noise', description: 'Soft organic movement with spatial variation.' },
  rays: { id: 'rays', label: 'Sanctuary rays', description: 'Broad, soft beams of light.' },
  contours: { id: 'contours', label: 'Contour lines', description: 'Slow topographic lines with a restrained glow.' },
  embers: { id: 'embers', label: 'Floating embers', description: 'Small lights drifting through the atmosphere.' },
};

export const shaderModuleIds = Object.keys(shaderModules);

export const recipeTemplates = {
  blank: {
    name: 'Blank scene', module: 'gradient', colors: ['#808080', '#808080', '#808080'],
    controls: { speed: 0, intensity: 0, scale: 2, direction: 0, softness: 0.6, density: 0.5 },
  },
  aurora: {
    name: 'Quiet aurora', module: 'noise', colors: ['#111b1e', '#668f76', '#d2cc83'],
    controls: { speed: 0.18, intensity: 0.42, scale: 2.6, direction: 0, softness: 0.7, density: 0.55 },
  },
  sanctuary: {
    name: 'Sanctuary rays', module: 'rays', colors: ['#29221b', '#f0d4a0', '#c58a4d'],
    controls: { speed: 0.08, intensity: 0.48, scale: 1.8, direction: -18, softness: 0.82, density: 0.42 },
  },
  contours: {
    name: 'Contour maps', module: 'contours', colors: ['#172824', '#78906b', '#d2bf91'],
    controls: { speed: 0.12, intensity: 0.34, scale: 4.5, direction: 12, softness: 0.58, density: 0.62 },
  },
  embers: {
    name: 'Floating embers', module: 'embers', colors: ['#201a1b', '#ffd08a', '#dd7441'],
    controls: { speed: 0.2, intensity: 0.55, scale: 10, direction: 0, softness: 0.35, density: 0.48 },
  },
};

const templateByRecipe = {
  blank: 'blank',
  aurora: 'aurora',
  'sanctuary-rays': 'sanctuary',
  'contour-maps': 'contours',
  'floating-embers': 'embers',
};

export function getRecipeTemplate(recipeId, colors, name) {
  const id = templateByRecipe[recipeId] || 'aurora';
  const template = recipeTemplates[id];
  return { ...template, id, name: name || template.name, colors: colors?.length >= 3 ? [colors[0], colors[1], colors[2]] : template.colors };
}

export function createProceduralMaterial(template = recipeTemplates.aurora) {
  const controls = { ...recipeTemplates.aurora.controls, ...(template.controls || {}) };
  return {
    type: 'procedural',
    color: template.colors?.[0] || '#172426',
    colorB: template.colors?.[2] || '#d2cc83',
    procedural: { module: template.module || 'noise', ...controls },
    effects: { adjust: { saturation: 1, brightness: 1, contrast: 1, opacity: 1 } },
  };
}

export function createRecipeDocumentForTemplate(template = recipeTemplates.aurora) {
  const document = createRecipeDocument();
  const background = createRecipeNode('background', 0);
  const fieldType = template.module === 'gradient' ? 'gradient' : template.module || 'noise';
  const field = createRecipeNode(fieldType, 1);
  const ramp = fieldType === 'gradient' ? null : createRecipeNode('ramp', 2);
  const output = createRecipeNode('output', ramp ? 3 : 2);
  const controls = { ...recipeTemplates.aurora.controls, ...(template.controls || {}) };
  background.params = { default: { type: 'gradient', colorA: template.colors?.[0] || '#172426', colorB: template.colors?.[2] || '#d2cc83', angle: 0 } };
  if (fieldType === 'gradient') {
    field.params = { ...field.params, colorA: template.colors?.[0] || '#172426', colorB: template.colors?.[2] || '#d2cc83', angle: 0 };
    return { ...document, name: template.name || document.name, layers: [{ ...document.layers[0], nodes: [background, field, output], connections: [{ from: background.id, to: field.id }, { from: field.id, to: output.id }], parameterConnections: [] }] };
  }
  field.params = { ...field.params, ...controls };
  ramp.params = { ...ramp.params, colorA: template.colors?.[0] || '#172426', colorB: template.colors?.[2] || '#d2cc83', midpoint: 0.5 };
  return { ...document, name: template.name || document.name, layers: [{ ...document.layers[0], nodes: [background, field, ramp, output], connections: [{ from: field.id, to: ramp.id, toPort: 'input' }, { from: ramp.id, to: output.id }], parameterConnections: [] }] };
}

export function applyRecipeTemplate(document, template) {
  const material = createProceduralMaterial(template);
  return {
    ...document,
    postProcess: {
      ...document.postProcess,
      bloom: template.module === 'rays' || template.module === 'embers' ? 0.38 : 0.22,
      trails: template.module === 'embers' ? 0.16 : 0.04,
    },
    layers: (document.layers || []).map((layer, index) => index === 0
      ? { ...layer, name: template.name || layer.name, material }
      : layer),
  };
}
