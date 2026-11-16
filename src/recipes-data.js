export const recipes = [
  ['blank', 'Blank scene', 'utility', 'A neutral scene ready for your own treatment.', ['#808080', '#808080', '#808080', '#808080']],
  ['aurora', 'Quiet aurora', 'atmosphere', 'Soft color fields drift across a cool, dusky sky.', ['#111b1e', '#668f76', '#d2cc83', '#263b42']],
  ['tide', 'Slow tide', 'water', 'Layered sea colors move in calm, rolling waves.', ['#10282d', '#d2b58b', '#3d8087', '#244b50']],
  ['dust', 'Desert dust', 'warm', 'Warm amber light gathers like a quiet sunset.', ['#ad6448', '#e0bd88', '#594033', '#281c19']],
  ['still', 'Morning light', 'warm', 'Gentle dawn glow with a small point of light.', ['#172426', '#568174', '#e1ba86', '#324f49']],
  ['tidal-lines', 'Tidal Lines', 'water', 'Layered current bands sweep in long, fluid curves.', ['#10272f', '#3b8381', '#bdd2c0', '#244d5a']],
  ['contour-maps', 'Contour Maps', 'geometry', 'Topographic lines trace slow, shifting terrain.', ['#172824', '#78906b', '#d2bf91', '#3d5b4b']],
  ['orbit-rings', 'Orbit Rings', 'cosmos', 'Concentric orbital paths gather around a quiet center.', ['#101a30', '#dfbd86', '#6e88bf', '#34476e']],
  ['quiet-stars', 'Quiet Stars', 'cosmos', 'Small lights twinkle at different depths in a night sky.', ['#101522', '#f1dfb4', '#b2c5df', '#343e58']],
  ['fractal-bloom', 'Fractal Bloom', 'atmosphere', 'Petal-like forms slowly unfold from a radial core.', ['#261c2d', '#9a6b91', '#e4bd9a', '#563a5b']],
  ['prism-facets', 'Prism Facets', 'geometry', 'Faceted planes catch light in a shifting mosaic.', ['#15242b', '#4b9b9b', '#d6ad78', '#536a91']],
  ['sanctuary-rays', 'Sanctuary Rays', 'light', 'Broad beams of warm light fan upward across the stage.', ['#29221b', '#f0d4a0', '#c58a4d', '#76533a']],
  ['floating-embers', 'Floating Embers', 'light', 'Glowing particles rise and drift at different speeds.', ['#201a1b', '#ffd08a', '#dd7441', '#5a3030']],
];
export const recipeMap = Object.fromEntries(recipes.map(([id, name, category, description, colors]) => [id, { id, name, category, description, colors }]));
