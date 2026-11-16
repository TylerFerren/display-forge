import { createRecipeDocument } from './recipe-document';
import { createGraphNode, normalizeGraphDocument } from '../graph/model/document';

const colors = {
  midnightTeal: ['#0d1d24', '#236b70', '#d4c47f'],
  warmSanctuary: ['#231a18', '#a95f3f', '#f2d39b'],
  forestContour: ['#101e1a', '#477565', '#c7d29e'],
  emberField: ['#211719', '#c75b37', '#ffd08b'],
  lunarRipple: ['#11172a', '#586fa4', '#e8d6a8'],
};

function makeNode(type, name, x, y, params = {}, index = 0) {
  return { ...createGraphNode(type, index), name, x, y, params: { ...params } };
}

function createPreset({ id, name, description, palette, fieldType, fieldName, fieldParams, effectType, effectName, effectParams, energy }) {
  const [backgroundA, rampA, rampB] = palette;
  const background = makeNode('background', 'Background', 80, 100, { default: { type: 'gradient', colorA: backgroundA, colorB: rampA, angle: 0 } }, 0);
  const field = makeNode(fieldType, fieldName, 80, 300, fieldParams, 1);
  const ramp = makeNode('ramp', 'Color ramp', 340, 300, { colorA: rampA, colorB: rampB, midpoint: 0.5 }, 2);
  const blend = makeNode('blend', 'Blend', 600, 200, { amount: 0.78, mode: 'mix' }, 3);
  const effect = makeNode(effectType, effectName, 860, 200, effectParams, 4);
  const output = makeNode('output', 'Output', 1120, 200, {}, 5);
  const baseDocument = createRecipeDocument();
  const document = {
    ...baseDocument,
    name,
    description,
    controls: { ...baseDocument.controls, energy },
    layers: [{
      ...baseDocument.layers[0],
      name: 'Recipe graph',
      nodes: [background, field, ramp, blend, effect, output],
      connections: [
        { from: background.id, to: blend.id, toPort: 'base' },
        { from: field.id, to: ramp.id, toPort: 'input' },
        { from: ramp.id, to: blend.id, toPort: 'overlay' },
        { from: blend.id, to: effect.id, toPort: 'input' },
        { from: effect.id, to: output.id, toPort: 'input' },
      ],
      parameterConnections: [],
    }],
  };
  return { id, name, description, document: normalizeGraphDocument(document) };
}

export const starterRecipePresets = [
  createPreset({
    id: 'preset-midnight-tide',
    name: 'Midnight Tide',
    description: 'A slow teal current with a soft luminous lift.',
    palette: colors.midnightTeal,
    fieldType: 'noise',
    fieldName: 'Tide field',
    fieldParams: { scale: 2.8, speed: 0.16, direction: 18, intensity: 0.42, softness: 0.72, density: 0.58 },
    effectType: 'glow',
    effectName: 'Soft glow',
    effectParams: { threshold: 0.5, intensity: 0.32, radius: 0.28, color: '#d4c47f' },
    energy: 38,
  }),
  createPreset({
    id: 'preset-sanctuary-beams',
    name: 'Sanctuary Beams',
    description: 'Warm directional rays that open gently toward the stage.',
    palette: colors.warmSanctuary,
    fieldType: 'rays',
    fieldName: 'Beam field',
    fieldParams: { scale: 1.9, speed: 0.07, direction: -22, intensity: 0.52, softness: 0.84, density: 0.44 },
    effectType: 'transform',
    effectName: 'Slow drift',
    effectParams: { x: 0.04, y: -0.02, scale: 1.05, rotation: -3 },
    energy: 30,
  }),
  createPreset({
    id: 'preset-forest-contours',
    name: 'Forest Contours',
    description: 'Quiet topographic bands with a softened edge.',
    palette: colors.forestContour,
    fieldType: 'contours',
    fieldName: 'Contour field',
    fieldParams: { scale: 4.2, speed: 0.1, direction: 12, intensity: 0.36, softness: 0.64, density: 0.66 },
    effectType: 'blur',
    effectName: 'Edge soften',
    effectParams: { radius: 0.14, softness: 0.72 },
    energy: 26,
  }),
  createPreset({
    id: 'preset-ember-rise',
    name: 'Ember Rise',
    description: 'A warm field of drifting light with gentle bloom.',
    palette: colors.emberField,
    fieldType: 'embers',
    fieldName: 'Ember field',
    fieldParams: { scale: 9, speed: 0.18, direction: 0, intensity: 0.6, softness: 0.38, density: 0.5 },
    effectType: 'glow',
    effectName: 'Ember bloom',
    effectParams: { threshold: 0.42, intensity: 0.46, radius: 0.34, color: '#ffd08b' },
    energy: 44,
  }),
  createPreset({
    id: 'preset-lunar-ripples',
    name: 'Lunar Ripples',
    description: 'Centered rings that pulse through a cool night palette.',
    palette: colors.lunarRipple,
    fieldType: 'radial',
    fieldName: 'Ripple field',
    fieldParams: { centerX: 0.1, centerY: -0.08, scale: 3.2, speed: 0.11, thickness: 0.16, softness: 0.5 },
    effectType: 'vignette',
    effectName: 'Night vignette',
    effectParams: { amount: 0.28, radius: 0.7, softness: 0.42, color: '#08101b' },
    energy: 34,
  }),
];
