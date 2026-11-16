const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export const sceneDocumentVersion = 2;

export const layerTypes = {
  geometry: { label: 'Geometry', description: 'A renderable 2D/3D surface.' },
  image: { label: 'Image', description: 'An imported image texture.' },
  video: { label: 'Video', description: 'A time-synced video texture.' },
  text: { label: 'Text', description: 'A branded text layer.' },
};

export function createLayer(type = 'geometry', index = 0) {
  const name = layerTypes[type]?.label || 'Layer';
  return {
    id: `${type}-${Date.now()}-${index}`,
    name: `${name} ${index + 1}`,
    type,
    geometry: { primitive: 'plane', size: [2, 2, 1] },
    transform: { matrix: identity, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: { type: type === 'geometry' ? 'solid' : 'texture', color: '#253226', opacity: 1, customFragment: null },
    asset: null,
    visible: true,
  };
}

export function createSceneDocument() {
  return {
    version: sceneDocumentVersion,
    color: {
      workingSpace: 'srgb-linear',
      displaySpace: 'srgb',
      toneMapping: 'aces',
      exposure: 0,
    },
    camera: {
      type: 'orthographic',
      coordinateSpace: 'extended-canvas',
      fit: 'cover',
      position: [0, 0, 5],
      target: [0, 0, 0],
      up: [0, 1, 0],
      zoom: 1,
    },
    postProcess: { bloom: 0, trails: 0 },
    layers: [
      {
        id: 'background',
        name: 'Background',
        type: 'geometry',
        geometry: { primitive: 'plane', size: [2, 2, 1] },
        transform: { matrix: identity, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        material: {
          type: 'solid',
          color: '#253226',
          opacity: 1,
          customFragment: null,
        },
        visible: true,
      },
    ],
    outputs: [{ id: 'main', type: 'canvas', colorSpace: 'srgb', width: 1920, height: 1080 }],
  };
}

export function ensureSceneDocument(document) {
  const source = document && typeof document === 'object' ? document : {};
  const fallback = createSceneDocument();
  return {
    ...fallback,
    ...source,
    version: sceneDocumentVersion,
    color: { ...fallback.color, ...(source.color || {}) },
    camera: { ...fallback.camera, ...(source.camera || {}) },
    postProcess: { ...fallback.postProcess, ...(source.postProcess || {}) },
    layers: (Array.isArray(source.layers) && source.layers.length ? source.layers : fallback.layers).map((layer, index) => {
      if (index !== 0 || layer.type !== 'geometry' || layer.material?.procedural) return layer;
      return {
        ...layer,
        material: {
          ...layer.material,
          type: 'procedural',
          colorB: layer.material?.colorB || '#d2cc83',
          procedural: { module: 'gradient', intensity: 0, speed: 0.15, scale: 2, direction: 0, softness: 0.6, density: 0.5 },
        },
      };
    }),
    outputs: Array.isArray(source.outputs) && source.outputs.length ? source.outputs : fallback.outputs,
  };
}

