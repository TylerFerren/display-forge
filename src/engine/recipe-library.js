import { ensureRecipeDocument } from './recipe-document';

export const recipeLibraryVersion = 1;

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash) + value.charCodeAt(index) | 0;
  return Math.abs(hash).toString(36);
}

function hexToHsl(hex) {
  const value = String(hex || '#808080').replace('#', '').padEnd(6, '0').slice(0, 6);
  const rgb = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
  const max = Math.max(...rgb); const min = Math.min(...rgb); const lightness = (max + min) / 2;
  if (max === min) return { hue: 0, saturation: 0, lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === rgb[0]) hue = (rgb[1] - rgb[2]) / delta + (rgb[1] < rgb[2] ? 6 : 0);
  else if (max === rgb[1]) hue = (rgb[2] - rgb[0]) / delta + 2;
  else hue = (rgb[0] - rgb[1]) / delta + 4;
  return { hue: hue * 60, saturation, lightness };
}

function paletteWord(colors) {
  const values = colors.filter(Boolean).map(hexToHsl);
  if (!values.length) return 'Quiet';
  const average = values.reduce((sum, color) => sum + color.hue, 0) / values.length;
  const saturation = values.reduce((sum, color) => sum + color.saturation, 0) / values.length;
  if (saturation < 0.12) return 'Silver';
  if (average < 35 || average >= 330) return 'Amber';
  if (average < 75) return 'Moss';
  if (average < 175) return 'Teal';
  if (average < 255) return 'Azure';
  if (average < 315) return 'Violet';
  return 'Rose';
}

function styleWord(types) {
  if (types.includes('rays')) return 'Rays';
  if (types.includes('contours')) return 'Contours';
  if (types.includes('wave')) return 'Waves';
  if (types.includes('radial')) return 'Ripple';
  if (types.includes('embers')) return 'Embers';
  if (types.includes('dust')) return 'Sparkle';
  if (types.includes('voronoi')) return 'Cells';
  if (types.includes('noise')) return 'Drift';
  if (types.includes('pattern')) return 'Facets';
  if (types.includes('gradient')) return 'Gradient';
  return 'Field';
}

function moodWord(types) {
  if (types.includes('glow')) return 'Luminous';
  if (types.includes('blur')) return 'Soft';
  if (types.includes('blend')) return 'Layered';
  if (types.includes('domainWarp')) return 'Flowing';
  if (types.includes('radial')) return 'Centered';
  return 'Quiet';
}

export function getRecipeColors(recipeDocument) {
  const document = ensureRecipeDocument(recipeDocument);
  const colors = [];
  (document.layers[0]?.nodes || []).forEach(node => {
    const value = node.params?.default || node.params || {};
    ['color', 'colorA', 'colorB'].forEach(key => { if (typeof value[key] === 'string') colors.push(value[key]); });
  });
  return [...new Set(colors)].slice(0, 4).length ? [...new Set(colors)].slice(0, 4) : ['#172426', '#668f76', '#d2cc83'];
}

export function generateRecipeName(recipeDocument, existingNames = []) {
  const document = ensureRecipeDocument(recipeDocument);
  const graph = document.layers[0];
  const nodes = graph?.nodes || [];
  const types = nodes.map(node => node.type);
  const colors = [];
  nodes.forEach(node => {
    const value = node.params?.default || node.params || {};
    ['color', 'colorA', 'colorB'].forEach(key => { if (typeof value[key] === 'string') colors.push(value[key]); });
  });
  const base = `${moodWord(types)} ${paletteWord(colors)} ${styleWord(types)}`;
  const names = new Set(existingNames.map(name => String(name).trim().toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
}

export function createRecipeLibraryEntry(recipeDocument, options = {}, existingEntries = []) {
  const document = ensureRecipeDocument(recipeDocument);
  const existingNames = existingEntries.map(entry => entry.name);
  const requestedName = String(options.name || document.name || '').trim();
  const name = requestedName && !/^untitled recipe$/i.test(requestedName) ? requestedName : generateRecipeName(document, existingNames);
  const now = new Date().toISOString();
  return {
    id: options.id || `recipe-${Date.now()}-${hashString(JSON.stringify(document))}`,
    name,
    source: options.source || 'user',
    description: options.description || document.description || 'A reusable Display Forge recipe.',
    createdAt: options.createdAt || now,
    updatedAt: now,
    recipeDocument: { ...document, name, description: options.description || document.description || 'A reusable Display Forge recipe.' },
  };
}

export function normalizeRecipeLibrary(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(entry => entry && typeof entry === 'object' && entry.recipeDocument).map(entry => {
    const recipeDocument = ensureRecipeDocument(entry.recipeDocument);
    return { ...entry, id: entry.id || `recipe-${Date.now()}-${hashString(JSON.stringify(recipeDocument))}`, name: entry.name || recipeDocument.name || generateRecipeName(recipeDocument), source: entry.source === 'official' ? 'official' : 'user', description: entry.description || recipeDocument.description || 'A reusable Display Forge recipe.', recipeDocument, createdAt: entry.createdAt || new Date().toISOString(), updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString() };
  });
}

export function saveRecipeLibraryEntry(entries, recipeDocument, libraryId = null) {
  const current = normalizeRecipeLibrary(entries);
  const existing = libraryId ? current.find(entry => entry.id === libraryId) : null;
  if (existing) {
    const document = ensureRecipeDocument(recipeDocument);
    const name = document.name || existing.name;
    return current.map(entry => entry.id === libraryId ? { ...entry, name, description: document.description || entry.description, recipeDocument: { ...document, name, description: document.description || entry.description }, updatedAt: new Date().toISOString() } : entry);
  }
  return [...current, createRecipeLibraryEntry(recipeDocument, {}, current)];
}
