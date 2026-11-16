import { describe, expect, it } from 'vitest';
import { createRecipeDocument } from '../src/engine/recipe-document.js';
import { createRecipeLibraryEntry, normalizeRecipeLibrary, saveRecipeLibraryEntry } from '../src/engine/recipe-library.js';

describe('recipe library and design documents', () => {
  it('creates a named editable recipe snapshot', () => {
    const document = createRecipeDocument();
    const entry = createRecipeLibraryEntry({ ...document, name: 'Sunday Drift' });

    expect(entry.name).toBe('Sunday Drift');
    expect(entry.recipeDocument.name).toBe('Sunday Drift');
    expect(entry.recipeDocument).not.toBe(document);
  });

  it('normalizes malformed entries without mutating the source array', () => {
    const source = [{ id: 'recipe-1', recipeDocument: createRecipeDocument() }, null, { id: 'invalid' }];
    const normalized = normalizeRecipeLibrary(source);

    expect(normalized).toHaveLength(1);
    expect(source).toHaveLength(3);
    expect(normalized[0].recipeDocument.layers[0].connections).toBeDefined();
  });

  it('updates an existing library snapshot without mutating other entries', () => {
    const first = createRecipeLibraryEntry({ ...createRecipeDocument(), name: 'First' });
    const second = createRecipeLibraryEntry({ ...createRecipeDocument(), name: 'Second' });
    const updated = saveRecipeLibraryEntry([first, second], { ...first.recipeDocument, name: 'First Updated' }, first.id);

    expect(updated).toHaveLength(2);
    expect(updated.find(entry => entry.id === first.id).name).toBe('First Updated');
    expect(updated.find(entry => entry.id === second.id).name).toBe('Second');
    expect(second.name).toBe('Second');
  });
});
