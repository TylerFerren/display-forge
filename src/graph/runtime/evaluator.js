import { nodeDefinitions } from '../model/node-definitions';

function colorValue(material) { return { kind: 'color', material }; }

function number(value, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback; }
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function hexToRgb(hex) { const value = String(hex || '#000000').replace('#', ''); const normalized = value.length === 3 ? value.split('').map(char => `${char}${char}`).join('') : value.padEnd(6, '0').slice(0, 6); return [0, 2, 4].map(index => parseInt(normalized.slice(index, index + 2), 16) / 255); }
function rgbToHex(rgb) { return `#${rgb.map(channel => Math.round(clamp(channel) * 255).toString(16).padStart(2, '0')).join('')}`; }
function mixHex(a, b, amount) { const from = hexToRgb(a); const to = hexToRgb(b); const mix = clamp(amount); return rgbToHex(from.map((channel, index) => channel + (to[index] - channel) * mix)); }
function rampPosition(value, midpoint = 0.5) { const point = clamp(midpoint); if (point <= 0.001) return clamp(value); if (point >= 0.999) return clamp(value); return value < point ? (value / point) * 0.5 : 0.5 + ((value - point) / (1 - point)) * 0.5; }
function remap(value, inputMin, inputMax, outputMin, outputMax, curve = 1) {
  const range = inputMax - inputMin;
  const normalized = range === 0 ? 0 : clamp((value - inputMin) / range);
  return outputMin + (outputMax - outputMin) * Math.pow(normalized, Math.max(0.001, curve));
}
function scalarResult(value, input, field = input?.field) { return { kind: 'scalar', value, field }; }
function appendFieldOperation(field, operation) { return field ? { ...field, operations: [...(field.operations || []), operation] } : field; }
function colorEffect(input, key, params) { return input?.kind === 'color' ? colorValue({ ...input.material, effects: { ...(input.material.effects || {}), [key]: params } }) : input; }
function resolveParameterValue(value, node, name) {
  if (!value) return undefined;
  const type = nodeDefinitions[node.type]?.params?.[name];
  if (type === 'scalar') return value.kind === 'scalar' ? value.value : undefined;
  if (type === 'color') {
    if (value.kind !== 'color') return undefined;
    return value.material?.color || value.material?.colorB;
  }
  if (type === 'enum' && value.kind === 'scalar') {
    const options = nodeDefinitions[node.type]?.options?.[name] || [];
    if (!options.length) return undefined;
    return options[Math.max(0, Math.min(options.length - 1, Math.round(value.value * (options.length - 1))))];
  }
  return undefined;
}

export function evaluateGraph(document, layerId, inputs = {}, time = 0, previewNodeId = null) {
  const layer = document.layers.find(item => item.id === layerId);
  if (!layer) return { values: {}, output: null, errors: ['Layer not found.'], warnings: [] };
  const energyScale = Math.max(0, number(document.controls?.energy, 50) / 50);
  const nodes = new Map((layer.nodes || []).map(node => [node.id, node]));
  const incoming = new Map((layer.connections || []).map(edge => [`${edge.to}:${edge.toPort || 'input'}`, edge]));
  const parameterInputs = new Map();
  (layer.parameterConnections || []).forEach(edge => parameterInputs.set(`${edge.toNode}:${edge.toParam}`, edge));
  const values = { ...inputs }; const errors = []; const visiting = new Set();
  const getInput = (id, port = 'input') => incoming.get(`${id}:${port}`) ? evaluateNode(incoming.get(`${id}:${port}`).from) : null;

  const evaluateNode = id => {
    if (values[id]) return values[id];
    const node = nodes.get(id);
    if (!node) { errors.push(`Node ${id} does not exist.`); return null; }
    if (visiting.has(id)) { errors.push(`Cycle detected at ${node.name}.`); return null; }
    visiting.add(id);
    const input = getInput(id);
    const params = { ...(node.params || {}) };
    Object.keys(params).forEach(name => {
      const connection = parameterInputs.get(`${id}:${name}`);
      if (connection) {
        const value = evaluateNode(connection.fromNode);
        const resolved = resolveParameterValue(value, node, name);
        if (resolved !== undefined) params[name] = resolved;
      }
    });
    if (params.speed !== undefined) params.speed = number(params.speed) * energyScale;

    let value = null;
    if (node.type === 'background') {
      const defaultValue = params.default || {};
      value = colorValue(defaultValue.type === 'solid'
        ? { type: 'solid', color: defaultValue.color, colorB: defaultValue.color, opacity: 1 }
        : { type: 'gradient', color: defaultValue.colorA, colorB: defaultValue.colorB, gradient: defaultValue });
    } else if (node.type === 'solid') {
      value = colorValue({ type: 'solid', color: params.color, colorB: params.color, opacity: number(params.opacity, 1) });
    } else if (node.type === 'gradient') {
      const base = input?.kind === 'color' ? input.material : {};
      value = colorValue({ type: 'gradient', color: params.colorA || base.color, colorB: params.colorB || base.colorB, gradient: params, effects: input?.material?.effects });
    } else if (['noise', 'rays', 'contours', 'embers', 'radial', 'voronoi', 'wave', 'dust'].includes(node.type)) {
      const phase = time * number(params.speed, 0.2) + number(params.scale, 3);
      value = scalarResult(Math.sin(phase) * 0.5 + 0.5, null, { module: node.type, speed: number(params.speed, 0.15), scale: number(params.scale, 2), direction: number(params.direction), intensity: number(params.intensity, 0.35), softness: number(params.softness, 0.6), density: number(params.density, 0.5), centerX: number(params.centerX), centerY: number(params.centerY), thickness: number(params.thickness, 0.2), randomness: number(params.randomness, 0.75), operations: [] });
    } else if (node.type === 'domainWarp') {
      const source = input?.kind === 'scalar' ? input.value : 0.5;
      const warp = { amount: number(params.amount, 0.45), scale: number(params.scale, 2.4), speed: number(params.speed, 0.12), direction: number(params.direction) };
      value = scalarResult(source, input, input?.field ? { ...input.field, warp } : { module: 'domainWarp', ...warp });
    } else if (node.type === 'time') {
      const loop = number(params.loop, 0);
      const valueAtTime = time * number(params.speed, 1) + number(params.phase, 0);
      value = scalarResult(loop > 0 ? ((valueAtTime % loop) + loop) % loop : valueAtTime, null, { module: 'time', speed: number(params.speed, 1), phase: number(params.phase), loop, centerX: number(params.phase), centerY: loop, operations: [] });
    } else if (node.type === 'coordinate') {
      value = scalarResult(0.5, null, { module: 'coordinate', axis: params.axis || 'x', scale: number(params.scale, 1), offset: number(params.offset) });
    } else if (node.type === 'timeRemap') {
      const source = input?.kind === 'scalar' ? input.value : time;
      const remapped = source * number(params.speed, 1) + number(params.offset);
      const loop = number(params.loop, 0);
      const looped = loop > 0 ? ((remapped % loop) + loop) % loop : remapped;
      value = scalarResult(Math.pow(Math.max(0, looped), Math.max(0.001, number(params.curve, 1))), input, appendFieldOperation(input?.field, { type: 'timeRemap', speed: number(params.speed, 1), offset: number(params.offset), loop, curve: number(params.curve, 1) }));
    } else if (node.type === 'remap') {
      const source = input?.kind === 'scalar' ? input.value : 0;
      value = scalarResult(remap(source, number(params.inputMin), number(params.inputMax, 1), number(params.outputMin), number(params.outputMax, 1), number(params.curve, 1)), input, appendFieldOperation(input?.field, { type: 'remap', inputMin: number(params.inputMin), inputMax: number(params.inputMax, 1), outputMin: number(params.outputMin), outputMax: number(params.outputMax, 1), curve: number(params.curve, 1) }));
    } else if (node.type === 'threshold') {
      const source = input?.kind === 'scalar' ? input.value : 0.5;
      const edge = number(params.edge, 0.5); const softness = Math.max(0.001, number(params.softness, 0.08));
      const thresholded = clamp((source - (edge - softness)) / (softness * 2));
      value = scalarResult(params.invert === 'on' ? 1 - thresholded : thresholded, input, appendFieldOperation(input?.field, { type: 'threshold', edge, softness, invert: params.invert === 'on' ? 1 : 0 }));
    } else if (node.type === 'invert') {
      const source = input?.kind === 'scalar' ? input.value : 0;
      value = scalarResult(1 - source, input, appendFieldOperation(input?.field, { type: 'invert' }));
    } else if (node.type === 'clamp') {
      const source = input?.kind === 'scalar' ? input.value : 0;
      value = scalarResult(Math.max(number(params.min, 0), Math.min(number(params.max, 1), source)), input, appendFieldOperation(input?.field, { type: 'clamp', min: number(params.min, 0), max: number(params.max, 1) }));
    } else if (node.type === 'smoothstep') {
      const source = input?.kind === 'scalar' ? input.value : 0;
      const edge0 = number(params.edge0, 0.25); const edge1 = number(params.edge1, 0.75); const normalized = clamp((source - edge0) / Math.max(0.001, edge1 - edge0));
      value = scalarResult(normalized * normalized * (3 - 2 * normalized), input, appendFieldOperation(input?.field, { type: 'smoothstep', edge0, edge1 }));
    } else if (['add', 'multiply', 'math'].includes(node.type)) {
      const aInput = getInput(id, 'a'); const bInput = getInput(id, 'b'); const a = aInput?.kind === 'scalar' ? aInput.value : number(params.valueA, node.type === 'multiply' ? 1 : 0); const b = bInput?.kind === 'scalar' ? bInput.value : number(params.valueB, node.type === 'multiply' ? 1 : 0);
      const operation = node.type === 'add' ? 'add' : node.type === 'multiply' ? 'multiply' : params.operation || 'add';
      const result = operation === 'subtract' ? a - b : operation === 'multiply' ? a * b : operation === 'divide' ? (Math.abs(b) < 0.0001 ? 0 : a / b) : operation === 'min' ? Math.min(a, b) : operation === 'max' ? Math.max(a, b) : a + b;
      const field = aInput?.field || bInput?.field;
      const operationType = operation === 'add' ? 'add' : operation === 'multiply' ? 'multiply' : operation;
      const operationAmount = aInput?.field ? b : a;
      value = scalarResult(result, aInput || bInput, appendFieldOperation(field, { type: operationType, amount: operationAmount }));
    } else if (node.type === 'ramp' || node.type === 'colorize') {
      const source = input?.kind === 'scalar' ? clamp(input.value) : number(params.midpoint, 0.5);
      const field = input?.field;
      const midpoint = number(params.midpoint, 0.5);
      value = colorValue(field
        ? { type: 'procedural', color: params.colorA || '#172426', colorB: params.colorB || '#d8f27b', procedural: field, ramp: true, rampMidpoint: midpoint }
        : { type: 'solid', color: mixHex(params.colorA || '#172426', params.colorB || '#d8f27b', rampPosition(source, midpoint)), colorB: mixHex(params.colorA || '#172426', params.colorB || '#d8f27b', rampPosition(source, midpoint)), opacity: 1 });
    } else if (node.type === 'pattern') {
      value = colorValue({ type: 'pattern', color: params.colorA, colorB: params.colorB, pattern: params });
    } else if (node.type === 'blend') {
      const base = getInput(id, 'base');
      const overlay = getInput(id, 'overlay') || (params.colorB ? colorValue({ type: 'solid', color: params.colorB, colorB: params.colorB }) : null);
      if (!base || !overlay) errors.push(`${node.name} needs base and overlay color inputs.`);
      value = base?.kind === 'color' && overlay?.kind === 'color' ? colorValue({
        ...base.material,
        composite: {
          base: base.material,
          overlay: overlay.material,
          amount: clamp(number(params.amount, 0.5)),
          mode: params.mode || 'mix',
        },
        effects: {
          ...(base.material.effects || {}),
          blend: {
            material: overlay.material,
            amount: clamp(number(params.amount, 0.5)),
            mode: params.mode || 'mix',
          },
        },
      }) : null;
    } else if (node.type === 'adjust') {
      if (!input) errors.push(`${node.name} needs a color input.`);
      value = input?.kind === 'color' ? colorValue({ ...input.material, effects: { ...(input.material.effects || {}), adjust: params } }) : input;
    } else if (node.type === 'glow' || node.type === 'chromatic' || node.type === 'grain' || node.type === 'displacement') {
      if (!input) errors.push(`${node.name} needs a color input.`);
      const effectName = node.type === 'glow' ? 'glow' : node.type;
      value = input?.kind === 'color' ? colorEffect(input, effectName, params) : input;
    } else if (node.type === 'mask') {
      const colorInput = getInput(id, 'color');
      const maskInput = getInput(id, 'mask');
      if (!colorInput || !maskInput) errors.push(`${node.name} needs color and mask inputs.`);
      value = colorInput?.kind === 'color' ? colorValue({ ...colorInput.material, effects: { ...(colorInput.material.effects || {}), mask: { value: clamp(maskInput?.kind === 'scalar' ? maskInput.value : number(params.mask, 1)), amount: clamp(number(params.amount, 1)) } } }) : null;
    } else if (node.type === 'blur') {
      if (!input) errors.push(`${node.name} needs a color input.`);
      value = input?.kind === 'color' ? colorValue({ ...input.material, effects: { ...(input.material.effects || {}), blur: params } }) : input;
    } else if (node.type === 'vignette') {
      if (!input) errors.push(`${node.name} needs a color input.`);
      value = input?.kind === 'color' ? colorValue({ ...input.material, effects: { ...(input.material.effects || {}), vignette: params } }) : input;
    } else if (node.type === 'transform') {
      if (!input) errors.push(`${node.name} needs a color input.`);
      if (input?.material?.composite) {
        const { composite } = input.material;
        const transform = {
          x: number(params.x),
          y: number(params.y),
          scale: number(params.scale, 1),
          rotation: number(params.rotation),
        };
        value = colorValue({
          ...input.material,
          composite: { ...composite, transforms: [...(composite.transforms || []), transform] },
        });
      } else if (input?.kind === 'color') {
        const baseGradient = input.material.gradient || {};
        const baseProcedural = input.material.procedural;
        const transformScale = number(params.scale, 1);
        const gradient = { ...baseGradient, centerX: number(params.x, number(baseGradient.centerX)), centerY: number(params.y, number(baseGradient.centerY)), scale: transformScale, rotation: number(params.rotation, number(baseGradient.rotation, number(baseGradient.angle))) };
        const procedural = baseProcedural ? { ...baseProcedural, direction: number(baseProcedural.direction) + number(params.rotation), scale: number(baseProcedural.scale, 1) * transformScale } : baseProcedural;
        value = colorValue({ ...input.material, gradient, ...(procedural ? { procedural } : {}) });
      } else value = input;
    } else if (node.type === 'output') {
      if (!input) errors.push('Output is not connected.');
      value = input;
    } else errors.push(`Unsupported node type: ${node.type}.`);
    visiting.delete(id); if (value) values[id] = value; return value;
  };

  const outputNode = (layer.nodes || []).find(node => node.type === 'output');
  const previewNode = previewNodeId ? nodes.get(previewNodeId) : outputNode;
  const output = previewNode ? evaluateNode(previewNode.id) : null;
  return { values, output, errors: [...new Set(errors)], warnings: [] };
}
